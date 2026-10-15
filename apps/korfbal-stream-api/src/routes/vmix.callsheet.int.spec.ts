import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {prisma} from '../services/prisma';
import {currentSeasonId} from '../../test-helpers';
import {getSetting, setSetting} from '../services/appSettings';
import {VMIX_CALLSHEET_PUSH_KEY} from '../services/vmixCallsheetPush';

const runDb = process.env.REQUIRE_DB === 'true';

describe.runIf(runDb)('vMix callsheet timing (integration)', () => {
  let productionId: number;
  let matchId: number;
  let previousConfig: unknown = null;
  const positionIds: number[] = [];

  beforeAll(async () => {
    previousConfig = await getSetting(VMIX_CALLSHEET_PUSH_KEY);
    // Other productions must not be active, or they'd be picked instead of ours
    await prisma.production.updateMany({where: {isActive: true}, data: {isActive: false}});

    for (const name of ['Callsheet Int Presentatie', 'Callsheet Int Camera']) {
      const position = await prisma.position.upsert({where: {name}, create: {name}, update: {}});
      positionIds.push(position.id);
    }
    const match = await prisma.matchSchedule.create({
      data: {
        seasonId: await currentSeasonId(prisma), externalId: `callsheet-int-${Date.now()}`, date: new Date(),
        homeTeamName: 'Home', awayTeamName: 'Away', isHomeMatch: true,
      },
    });
    matchId = match.id;
    const production = await prisma.production.create({data: {matchScheduleId: match.id, isActive: true}});
    productionId = production.id;

    const now = Date.now();
    await prisma.productionEvent.create({
      data: {
        productionId, title: 'Opening', order: 1, status: 'ACTIVE', durationSec: 300,
        actualStartTime: new Date(now - 60_000), positions: {create: [{positionId: positionIds[0]}]},
      },
    });
    await prisma.productionEvent.create({
      data: {
        productionId, title: 'Shots zaal', order: 2, durationSec: 60,
        plannedStartTime: new Date(now + 240_000), positions: {create: [{positionId: positionIds[1]}]},
      },
    });
    await prisma.productionEvent.create({
      data: {
        productionId, title: 'Interview', order: 3, durationSec: 120,
        plannedStartTime: new Date(now + 300_000), positions: {create: [{positionId: positionIds[0]}]},
      },
    });
  });

  afterAll(async () => {
    await setSetting(VMIX_CALLSHEET_PUSH_KEY, previousConfig as any);
    await prisma.production.deleteMany({where: {id: productionId}});
    await prisma.matchSchedule.deleteMany({where: {id: matchId}});
    await prisma.position.deleteMany({where: {id: {in: positionIds}}});
    await prisma.club.deleteMany({where: {slug: 'callsheet-int-club'}});
  });

  it('returns the current and next item for a position', async () => {
    const res = await request(app).get('/api/vmix/callsheet/timing?position=Callsheet Int Presentatie');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      productionId,
      currentTitle: 'Opening',
      currentDuration: '05:00',
      currentState: 'normal',
      nextTitle: 'Interview',
      nextDuration: '02:00',
      nextState: 'normal',
    });
    expect(res.body[0].currentRemainingSeconds).toBeGreaterThan(230);
    expect(res.body[0].currentRemainingSeconds).toBeLessThanOrEqual(240);
    expect(res.body[0].currentTimerVmix).toMatch(/^00:0[34]:\d\d$/);
  });

  it('has no current item when the active item is for another position', async () => {
    const res = await request(app).get('/api/vmix/callsheet/timing?position=callsheet-int-camera');
    expect(res.body[0]).toMatchObject({currentTitle: '', nextTitle: 'Shots zaal'});
  });

  it('stores and validates the push settings', async () => {
    const saved = await request(app).put('/api/settings/vmix-callsheet-push').send({
      enabled: false, input: 'Callsheet', positions: ['Callsheet Int Presentatie'], warningSeconds: 15,
      current: {titleField: 'Titel.Text', colors: {overtime: {background: '#AA0000', text: '#FFFFFF'}}},
    });
    expect(saved.status).toBe(200);
    expect(saved.body.current.colors.overtime.background).toBe('#AA0000');
    expect(saved.body.current.colors.normal.background).toBe('#22C55E');

    const loaded = await request(app).get('/api/settings/vmix-callsheet-push');
    expect(loaded.body).toMatchObject({input: 'Callsheet', warningSeconds: 15, current: {titleField: 'Titel.Text'}});

    // Without ?position the timing endpoint follows the positions from the settings
    const timing = await request(app).get('/api/vmix/callsheet/timing');
    expect(timing.body[0]).toMatchObject({positions: 'Callsheet Int Presentatie', nextTitle: 'Interview'});

    const invalid = await request(app).put('/api/settings/vmix-callsheet-push').send({current: {colors: {normal: {background: 'green', text: '#fff'}}}});
    expect(invalid.status).toBe(400);
  });

  it('fills interview placeholders with the selected names', async () => {
    const match = await prisma.matchSchedule.findUniqueOrThrow({where: {id: matchId}});
    const club = await prisma.club.create({data: {name: 'Callsheet Int Club', shortName: 'callsheet-int-club', slug: 'callsheet-int-club'}});
    const coach = await prisma.player.create({data: {clubId: club.id, seasonId: match.seasonId, name: 'Jan de Coach', function: 'Coach'}});
    await prisma.interviewSubject.create({data: {productionId, side: 'AWAY', role: 'COACH', playerId: coach.id}});
    await prisma.productionEvent.updateMany({where: {productionId, title: 'Interview'}, data: {title: 'Interview {coach-uit:kort} & {speler-thuis}'}});

    const names = await request(app).get(`/api/production/${productionId}/interview-names`);
    expect(names.status).toBe(200);
    expect(names.body).toEqual({ownSide: 'HOME', names: {HOME: {PLAYER: null, COACH: null}, AWAY: {PLAYER: null, COACH: 'Jan de Coach'}}});

    const timing = await request(app).get('/api/vmix/callsheet/timing?position=Callsheet Int Presentatie');
    expect(timing.body[0].nextTitle).toBe('Interview J. de Coach & speler thuis');
  });

  it('refuses more than one position in the push settings', async () => {
    const res = await request(app).put('/api/settings/vmix-callsheet-push').send({positions: ['Callsheet Int Presentatie', 'Callsheet Int Camera']});
    expect(res.status).toBe(400);
  });
});
