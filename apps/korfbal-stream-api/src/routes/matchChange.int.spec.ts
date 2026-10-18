import request from 'supertest';
import {afterAll, afterEach, describe, expect, it} from 'vitest';
import app from '../main';
import {createProductionScenario, ensureOrganization, ProductionScenario} from '../../test-scenarios';
import {inTestOrganization, testDb as prisma} from '../../test-helpers';
import {recordingServer} from '../test-support/recordingServer';
import {startProduction, stopProduction} from '../services/productionState';
import {shiftProductionTimesForMatchDateChange} from '../services/matchChange';
import {formatTime} from '../utils/time';
import {runWithOrganization} from '../services/organizationContext';

const runDb = process.env.REQUIRE_DB === 'true';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Sat 21 March 2026 19:30 in Amsterdam (winter time, CET = UTC+1) */
const WINTER_SATURDAY = new Date('2026-03-21T18:30:00.000Z');
/** Sun 29 March 2026 20:00 in Amsterdam (summer time since that night, CEST = UTC+2) */
const SUMMER_SUNDAY = new Date('2026-03-29T18:00:00.000Z');
/** Sat 14 November 2026 19:30 / Sun 15 November 20:00 in Amsterdam: +24h30m */
const SATURDAY = new Date('2026-11-14T18:30:00.000Z');
const SUNDAY = new Date('2026-11-15T19:00:00.000Z');

const shifted = (date: Date | null | undefined, deltaMs: number) => (date ? new Date(date.getTime() + deltaMs).toISOString() : null);

/** A production on `date`, broadcast 5 minutes before kickoff, with callsheet items and LIVE events from 19:00. */
function showOn(date: Date, extra: Parameters<typeof createProductionScenario>[1] = {}) {
  return createProductionScenario(prisma, {
    match: {date, isManual: true, homeTeamName: 'Verplaatst Thuis', awayTeamName: 'Verplaatst Uit', externalId: null},
    liveTime: new Date(date.getTime() - 5 * MINUTE),
    startsAt: new Date(date.getTime() - 30 * MINUTE),
    items: [{title: 'Opening', durationSec: 1800}, {title: 'Aftrap', durationSec: 60}],
    callSheet: true,
    ...extra,
  });
}

/** The stored times of the scenario's production, read in its own organization. */
function times(show: ProductionScenario) {
  return runWithOrganization(show.organizationId, () => readTimes(show));
}

async function readTimes(show: ProductionScenario) {
  const production = await prisma.production.findUniqueOrThrow({where: {id: show.productionId}});
  const items = await prisma.callSheetItem.findMany({where: {id: {in: show.callSheetItemIds}}, orderBy: {orderIndex: 'asc'}});
  const events = await prisma.productionEvent.findMany({where: {id: {in: show.eventIds}}, orderBy: {order: 'asc'}});
  return {
    liveTime: production.liveTime?.toISOString() ?? null,
    items: items.map((i) => [i.timeStart?.toISOString() ?? null, i.timeEnd?.toISOString() ?? null]),
    events: events.map((e) => [e.plannedStartTime?.toISOString() ?? null, e.plannedEndTime?.toISOString() ?? null]),
  };
}

function shiftAll(before: Awaited<ReturnType<typeof readTimes>>, deltaMs: number) {
  const pair = ([start, end]: (string | null)[]) => [shifted(start ? new Date(start) : null, deltaMs), shifted(end ? new Date(end) : null, deltaMs)];
  return {liveTime: shifted(before.liveTime ? new Date(before.liveTime) : null, deltaMs), items: before.items.map(pair), events: before.events.map(pair)};
}

const putManualMatch = (id: number, date: Date, teams = {homeTeamName: 'Verplaatst Thuis', awayTeamName: 'Verplaatst Uit'}) =>
  request(app).put(`/api/manual-matches/${id}`).send({date: date.toISOString(), ...teams});

describe.runIf(runDb)('a moved match takes its production times along (integration)', () => {
  const shows: ProductionScenario[] = [];
  const track = async (show: Promise<ProductionScenario>) => {
    const made = await show;
    shows.push(made);
    return made;
  };

  afterAll(async () => {
    for (const show of shows) await show.cleanup();
  });

  describe('manual match edit', () => {
    it('moves Sat 19:30 → Sun 20:00 by +24h30m: liveTime, callsheet item times and planned event times', async () => {
      const show = await track(showOn(SATURDAY));
      const before = await times(show);

      const res = await putManualMatch(show.matchId, SUNDAY);
      expect(res.status, res.text).toBe(200);

      const delta = 24 * HOUR + 30 * MINUTE;
      expect(SUNDAY.getTime() - SATURDAY.getTime()).toBe(delta);
      expect(await times(show)).toEqual(shiftAll(before, delta));
      // Still 5 minutes before kickoff, in Amsterdam time
      expect(formatTime(String((await times(show)).liveTime))).toBe('19:55');
    });

    it('uses the exact difference between the UTC instants across the change to summer time', async () => {
      const show = await track(showOn(WINTER_SATURDAY));
      const before = await times(show);
      expect(formatTime(String(before.liveTime))).toBe('19:25');

      expect((await putManualMatch(show.matchId, SUMMER_SUNDAY)).status).toBe(200);

      // 8 days later on the calendar and 30 minutes later on the clock, but only 7d 23h 30m in real time
      const delta = SUMMER_SUNDAY.getTime() - WINTER_SATURDAY.getTime();
      expect(delta).toBe(8 * 24 * HOUR - 30 * MINUTE);
      const after = await times(show);
      expect(after).toEqual(shiftAll(before, delta));
      expect(after.liveTime).toBe('2026-03-29T17:55:00.000Z');
      expect(formatTime(String(after.liveTime))).toBe('19:55');
    });

    it('leaves the times alone when only the teams change, and GET /api/production shows the new names', async () => {
      const show = await track(showOn(SATURDAY));
      const before = await times(show);

      const res = await putManualMatch(show.matchId, SATURDAY, {homeTeamName: 'Hernoemd Thuis', awayTeamName: 'Hernoemd Uit'});
      expect(res.status).toBe(200);
      expect(await times(show)).toEqual(before);

      const match = await prisma.matchSchedule.findUniqueOrThrow({where: {id: show.matchId}});
      const list = await request(app).get(`/api/production?seasonId=${match.seasonId}`);
      expect(list.status).toBe(200);
      const production = list.body.items.find((p: {id: number}) => p.id === show.productionId);
      expect(production.matchSchedule).toMatchObject({homeTeamName: 'Hernoemd Thuis', awayTeamName: 'Hernoemd Uit'});
      expect(production.liveTime).toBe(before.liveTime);
    });

    it('leaves a production alone that is live right now (only the match moves)', async () => {
      const show = await track(showOn(SATURDAY, {active: true}));
      const before = await times(show);
      const firstEvent = await prisma.productionEvent.findUniqueOrThrow({where: {id: show.eventIds[0]}});
      await inTestOrganization(() => startProduction(show.productionId, firstEvent));
      try {
        expect((await putManualMatch(show.matchId, SUNDAY)).status).toBe(200);
        expect((await prisma.matchSchedule.findUniqueOrThrow({where: {id: show.matchId}})).date.toISOString()).toBe(SUNDAY.toISOString());
        const after = await times(show);
        expect(after.liveTime).toBe(before.liveTime);
        expect(after.items).toEqual(before.items);
        // The first event's planned times are what they were (its actual start is the live show's)
        expect(after.events).toEqual(before.events);
      } finally {
        await inTestOrganization(() => stopProduction(show.productionId));
      }
    });
  });

  describe('match import', () => {
    const EXTERNAL_ID = 'mc-import-1';
    const SHARED_EXTERNAL_ID = 'mc-import-2';
    let upstreamClose: (() => Promise<void>) | undefined;

    afterEach(async () => {
      await upstreamClose?.();
      upstreamClose = undefined;
      await prisma.matchSource.deleteMany({});
    });

    async function importWith(items: object[]) {
      const upstream = await recordingServer({status: 200, body: JSON.stringify(items)});
      upstreamClose = upstream.close;
      expect((await request(app).put('/api/match-source').send({provider: 'vrijwilligers', baseUrl: upstream.url, apiToken: 'mc-token', isEnabled: true})).status).toBe(200);
      return request(app).post('/api/match/matches/schedule/import?date=14-11-2026');
    }

    it('moves the production of an updated match and shows the new teams', async () => {
      const show = await track(showOn(SATURDAY, {match: {date: SATURDAY, externalId: EXTERNAL_ID, homeTeamName: 'Oud Thuis', awayTeamName: 'Oud Uit'}}));
      const before = await times(show);

      const res = await importWith([{id: EXTERNAL_ID, date: SUNDAY.toISOString(), homeTeamName: 'Nieuw Thuis', awayTeamName: 'Nieuw Uit', isHomeMatch: true}]);
      expect(res.status, res.text).toBe(200);
      expect(res.body).toMatchObject({ok: true, updated: 1, inserted: 0});

      expect(await times(show)).toEqual(shiftAll(before, SUNDAY.getTime() - SATURDAY.getTime()));
      const match = await prisma.matchSchedule.findUniqueOrThrow({where: {id: show.matchId}});
      const list = await request(app).get(`/api/production?seasonId=${match.seasonId}`);
      expect(list.body.items.find((p: {id: number}) => p.id === show.productionId).matchSchedule).toMatchObject({
        homeTeamName: 'Nieuw Thuis', awayTeamName: 'Nieuw Uit', date: SUNDAY.toISOString(),
      });
    });

    it('never touches the production of another organization with the same external id (security)', async () => {
      const otherOrganizationId = await ensureOrganization(prisma, 'mc-other', 'MC Other');
      const own = await track(showOn(SATURDAY, {match: {date: SATURDAY, externalId: SHARED_EXTERNAL_ID}}));
      const other = await showOn(SATURDAY, {organizationId: otherOrganizationId, match: {date: SATURDAY, externalId: SHARED_EXTERNAL_ID}});
      try {
        const otherBefore = await times(other);

        const res = await importWith([{id: SHARED_EXTERNAL_ID, date: SUNDAY.toISOString(), homeTeamName: 'Nieuw Thuis', awayTeamName: 'Nieuw Uit', isHomeMatch: true}]);
        expect(res.status, res.text).toBe(200);
        expect((await times(own)).liveTime).toBe(shifted(SATURDAY, SUNDAY.getTime() - SATURDAY.getTime() - 5 * MINUTE));

        // A manual edit of the other organization's match id answers 404
        expect((await putManualMatch(other.matchId, SUNDAY)).status).toBe(404);
        // And the service itself, called with that id, finds no production
        const direct = await inTestOrganization(() => prisma.$transaction((tx) =>
          shiftProductionTimesForMatchDateChange(tx, other.matchId, SATURDAY, SUNDAY)));
        expect(direct).toEqual({shifted: [], skippedLive: []});

        expect(await times(other)).toEqual(otherBefore);
        const otherMatch = await runWithOrganization(otherOrganizationId, () => prisma.matchSchedule.findUniqueOrThrow({where: {id: other.matchId}}));
        expect(otherMatch.date.toISOString()).toBe(SATURDAY.toISOString());
      } finally {
        await other.cleanup();
        await prisma.organization.deleteMany({where: {id: otherOrganizationId}});
      }
    });
  });
});
