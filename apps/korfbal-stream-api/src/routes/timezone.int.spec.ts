import request from 'supertest';
import axios from 'axios';
import app from '../main';
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';
import {inTestOrganization, testDb as prisma} from '../../test-helpers';
import {getSetting, setSetting, VMIX_URL_KEY} from '../services/appSettings';
import {setVmixInstancesConfig, VMIX_INSTANCES_KEY} from '../services/vmixInstances';
import {pushCallsheetToVmix, setCallsheetPushConfig, VMIX_CALLSHEET_PUSH_KEY} from '../services/vmixCallsheetPush';
import {VmixCallsheetPushSchema} from '../schemas/vmixCallsheet';

const runDb = process.env.REQUIRE_DB === 'true';

/**
 * A match at 19:30 in Amsterdam must read 19:30 everywhere vMix and the reports get text, whatever the
 * server's zone. vitest.config.ts runs the tests with TZ=UTC (Docker's zone); run them with
 * TZ=America/New_York as well to see that the zone doesn't matter.
 */
describe.runIf(runDb)('Amsterdam time in text for vMix and reports (integration)', () => {
  const cases = [
    {name: 'winter (CET)', kickoff: '2026-11-14T18:30:00.000Z', date: 'zaterdag 14 november 2026', dateShort: '14-11-2026'},
    {name: 'summer (CEST)', kickoff: '2026-06-13T17:30:00.000Z', date: 'zaterdag 13 juni 2026', dateShort: '13-06-2026'},
  ];

  describe.each(cases)('a match at 19:30 in $name', ({kickoff, date, dateShort}) => {
    let show: ProductionScenario;

    beforeAll(async () => {
      const start = new Date(kickoff);
      show = await createProductionScenario(prisma, {
        active: true,
        match: {date: start, homeTeamName: 'Tijdzone Thuis', awayTeamName: 'Tijdzone Uit', attendanceTime: new Date(start.getTime() - 3_600_000)},
        // Opening at 19:00, kickoff item at 19:30 (Amsterdam)
        startsAt: new Date(start.getTime() - 1_800_000),
        items: [{title: 'Opening', status: 'ACTIVE', durationSec: 1800}, {title: 'Aftrap', durationSec: 60}],
        segments: [{naam: 'Wedstrijd', duurInMinuten: 60}],
      });
      await prisma.production.update({where: {id: show.productionId}, data: {liveTime: new Date(start.getTime() - 300_000)}});
    });

    afterAll(async () => {
      await show.cleanup();
    });

    it('gives vMix the match info in Amsterdam time', async () => {
      const res = await request(app).get('/api/vmix/active-production/match');
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({kickoff: '19:30', attendanceTime: '18:30', liveStart: '19:25', date, dateShort});
    });

    it('gives vMix the start time of the next callsheet item in Amsterdam time', async () => {
      const res = await request(app).get('/api/vmix/callsheet/timing');
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({currentTitle: 'Opening', nextTitle: 'Aftrap', nextStartTime: '19:30'});
    });

    it('writes the times of the WhatsApp and Markdown reports in Amsterdam time', async () => {
      const whatsapp = await request(app).get(`/api/production/${show.productionId}/report/whatsapp`);
      expect(whatsapp.status).toBe(200);
      expect(whatsapp.text).toContain('Tijdzone Thuis - Tijdzone Uit: 19:30 uur');
      expect(whatsapp.text).toContain('• 19:25 - LIVESTREAM START');
      const markdown = await request(app).get(`/api/production/${show.productionId}/report/markdown`);
      expect(markdown.status).toBe(200);
      expect(markdown.text).toContain('19:30 uur');
      expect(markdown.headers['content-disposition']).toContain(`_${kickoff.slice(0, 10)}.md`);
    });
  });

  describe('callsheet push to vMix', () => {
    let show: ProductionScenario;
    let previous: {push: unknown; instances: unknown; url: unknown};

    beforeAll(async () => {
      previous = await inTestOrganization(async () => ({
        push: await getSetting(VMIX_CALLSHEET_PUSH_KEY),
        instances: await getSetting(VMIX_INSTANCES_KEY),
        url: await getSetting(VMIX_URL_KEY),
      }));
      show = await createProductionScenario(prisma, {
        active: true,
        startsAt: new Date('2026-11-14T18:00:00.000Z'),
        items: [{title: 'Opening', status: 'ACTIVE', durationSec: 1800}, {title: 'Aftrap', durationSec: 60}],
      });
      await inTestOrganization(async () => {
        await setVmixInstancesConfig({instances: [{name: 'Stream-PC', url: 'http://vmix.invalid:8088'}], targets: {}});
        await setCallsheetPushConfig(VmixCallsheetPushSchema.parse({
          enabled: false, input: 'Callsheet', next: {titleField: 'Volgend.Text', startTimeField: 'VolgendStart.Text'},
        }));
      });
    });

    afterEach(() => vi.restoreAllMocks());

    afterAll(async () => {
      await show.cleanup();
      await inTestOrganization(async () => {
        await setSetting(VMIX_CALLSHEET_PUSH_KEY, previous.push as never);
        await setSetting(VMIX_INSTANCES_KEY, previous.instances as never);
        await setSetting(VMIX_URL_KEY, previous.url as never);
      });
    });

    it('sends the start time as Amsterdam time (19:30 for 18:30Z in November)', async () => {
      const get = vi.spyOn(axios, 'get').mockResolvedValue({status: 200, data: ''});
      const result = await inTestOrganization(() => pushCallsheetToVmix(true, new Date('2026-11-14T18:10:00.000Z')));
      expect(result.errors).toEqual([]);
      expect(result.timing?.nextStartTime).toBe('19:30');
      const urls = get.mock.calls.map(([url]) => String(url));
      expect(urls).toContain('http://vmix.invalid:8088/api/?Function=SetText&Input=Callsheet&SelectedName=VolgendStart.Text&Value=19%3A30');
    });
  });

  describe('day filters follow the Amsterdam day', () => {
    let show: ProductionScenario;

    beforeAll(async () => {
      // 00:30 on 15 November in Amsterdam, still 14 November in UTC
      show = await createProductionScenario(prisma, {items: [], match: {date: new Date('2026-11-14T23:30:00.000Z'), homeTeamName: 'Nachtwedstrijd'}});
    });

    afterAll(async () => {
      await show.cleanup();
    });

    it('lists a match just after midnight on the Amsterdam day', async () => {
      const on15 = await request(app).get('/api/reports/daily-occupancy?date=2026-11-15');
      expect(on15.status).toBe(200);
      expect(on15.body.productions.map((p: { homeTeam: string }) => p.homeTeam)).toContain('Nachtwedstrijd');
      const on14 = await request(app).get('/api/reports/daily-occupancy?date=2026-11-14');
      expect(on14.body.productions.map((p: { homeTeam: string }) => p.homeTeam)).not.toContain('Nachtwedstrijd');
    });
  });

  describe('invalid times from the client give 400, not 500', () => {
    let show: ProductionScenario;
    const created: number[] = [];

    beforeAll(async () => {
      show = await createProductionScenario(prisma, {items: []});
    });

    afterAll(async () => {
      await show.cleanup();
      await prisma.matchSchedule.deleteMany({where: {id: {in: created}}});
    });

    it.each(['nonsense', '2026-02-31T18:30:00.000Z', '2026-11-14T25:00', 12345, {}])('manual match date %j', async (date) => {
      const res = await request(app).post('/api/manual-matches').send({date, homeTeamName: 'A', awayTeamName: 'B'});
      expect(res.status).toBe(400);
    });

    it('stores a manual match at 19:30 Amsterdam as 18:30Z', async () => {
      const res = await request(app).post('/api/manual-matches').send({date: '2026-11-14T18:30:00.000Z', homeTeamName: 'Tz Handmatig', awayTeamName: 'B'});
      expect(res.status).toBe(201);
      created.push(res.body.id);
      expect(res.body.date).toBe('2026-11-14T18:30:00.000Z');
    });

    it.each(['nonsense', '2026-02-31T18:30:00Z', 42, '9999-12-31T23:59:59-14:00'])('production liveTime %j', async (liveTime) => {
      const res = await request(app).put(`/api/production/${show.productionId}`).send({liveTime});
      expect(res.status).toBe(400);
    });

    it('a location that is not one value gives 400', async () => {
      expect((await request(app).get('/api/match/matches/schedule?location[]=HOME')).status).toBe(400);
      expect((await request(app).get('/api/match/matches/schedule?location=HOME&location=AWAY')).status).toBe(400);
    });

    it('the production export file name cannot change the download header', async () => {
      await prisma.matchSchedule.update({where: {id: show.matchId}, data: {homeTeamName: `Thuis"; filename*=UTF-8''evil.html`, awayTeamName: 'Ωmega'}});
      const res = await request(app).get(`/api/production/${show.productionId}/export`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="production-[A-Za-z0-9._-]+-export\.json"$/);
      expect(res.headers['content-disposition']).not.toContain('filename*');
    });

    it('callsheet item times', async () => {
      const sheet = await request(app).post(`/api/production/${show.productionId}/callsheets`).send({name: 'Tijdzone'});
      expect(sheet.status).toBe(201);
      const bad = await request(app).post(`/api/production/callsheets/${sheet.body.id}/items`)
        .send({cue: 'A', title: 'B', durationSec: 10, timeStart: 'not a time'});
      expect(bad.status).toBe(400);
      const good = await request(app).post(`/api/production/callsheets/${sheet.body.id}/items`)
        .send({cue: 'A', title: 'B', durationSec: 10, timeStart: '2026-11-14T18:30:00.000Z'});
      expect(good.status).toBe(201);
      const update = await request(app).put(`/api/production/callsheet-items/${good.body.id}`).send({timeEnd: '2026-02-30T10:00:00Z'});
      expect(update.status).toBe(400);
    });
  });
});
