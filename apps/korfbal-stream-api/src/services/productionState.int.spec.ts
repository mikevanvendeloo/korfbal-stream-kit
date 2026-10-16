import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PrismaClient} from '@prisma/client';
import * as productionState from './productionState';
import {currentSeasonId, testDb as prisma, inTestOrganization} from '../../test-helpers';


// Mock socket.io; one shared emit so tests can inspect what was broadcast
const emit = vi.hoisted(() => vi.fn());
vi.mock('./socket', () => ({
  getIO: vi.fn(() => ({
    emit,
  })),
}));

/** Lets the async auto-advance callback finish its DB work after the fake timers fired. */
async function waitForStatus(prisma: PrismaClient, eventId: string, status: string) {
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => {
      vi.useRealTimers();
      setTimeout(() => {
        vi.useFakeTimers();
        resolve(null);
      }, 50);
    });
    const e = await prisma.productionEvent.findUnique({ where: { id: eventId } });
    if (e?.status === status) return;
  }
}

describe.runIf(process.env.REQUIRE_DB === 'true')('ProductionState Service Auto-Advance', () => {
  let productionId: number;
  let event1Id: string;
  let event2Id: string;

  beforeEach(async () => {
    vi.useFakeTimers();


    // Create test data
    const match = await prisma.matchSchedule.create({
      data: { seasonId: await currentSeasonId(prisma),
        externalId: 'test-match-' + Date.now(),
        date: new Date(),
        homeTeamName: 'Home',
        awayTeamName: 'Away',
        isHomeMatch: true,
      },
    });

    const production = await prisma.production.create({
      data: {
        matchScheduleId: match.id,
        isActive: true,
      },
    });
    productionId = production.id;

    const e1 = await prisma.productionEvent.create({
      data: {
        id: 'event-1-' + Date.now(),
        productionId: production.id,
        title: 'Event 1 (Auto)',
        order: 1,
        status: 'WAITING',
        autoAdvance: true,
        durationSec: 1, // 1 second duration for test
      },
    });
    event1Id = e1.id;

    const e2 = await prisma.productionEvent.create({
      data: {
        id: 'event-2-' + Date.now(),
        productionId: production.id,
        title: 'Event 2',
        order: 2,
        status: 'WAITING',
        autoAdvance: false,
      },
    });
    event2Id = e2.id;

    // Reset the internal state of the service if possible
    // Since we can't easily reset private module state without exports,
    // we rely on the fact that setActiveEvent will overwrite it.
  });

  afterEach(async () => {
    // Stop the clock and any pending auto-advance, and remove the active production: later spec
    // files would otherwise restore it and run its timers in the background.
    await inTestOrganization(() => productionState.stopProduction(productionId));
    vi.useRealTimers();
    const production = await prisma.production.findUnique({ where: { id: productionId } });
    await prisma.production.delete({ where: { id: productionId } });
    if (production) await prisma.matchSchedule.delete({ where: { id: production.matchScheduleId } });
  });

  it('should automatically advance to the next event after duration expires', async () => {
    vi.useFakeTimers();

    // Start production state
    await inTestOrganization(() => productionState.initializeProductionState());

    // Set event 1 as active
    console.log('--- TEST: Setting event 1 to active ---');
    await inTestOrganization(() => productionState.setActiveEvent(event1Id, productionId));

    // Verify event 1 is active in DB
    let e1 = await prisma.productionEvent.findUnique({ where: { id: event1Id } });
    expect(e1?.status).toBe('ACTIVE');

    // Fast-forward 1.5 seconds (duration is 1s)
    console.log('--- TEST: Advancing timers by 1500ms ---');

    // In Vitest, fake timers and async DB calls can be tricky.
    // We advance timers and then use real timeouts to wait for DB operations.
    vi.advanceTimersByTime(1500);

    // Give time for the async timer callback to finish its DB work
    // Since we are in a test environment, we might need multiple yields
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => {
        vi.useRealTimers();
        setTimeout(() => {
          vi.useFakeTimers();
          resolve(null);
        }, 50);
      });

      const e2Check = await prisma.productionEvent.findUnique({ where: { id: event2Id } });
      if (e2Check?.status === 'ACTIVE') {
        console.log(`--- TEST: Found event 2 ACTIVE at attempt ${i} ---`);
        break;
      }
    }

    // Check if event 2 is now active in DB
    let e2 = await prisma.productionEvent.findUnique({ where: { id: event2Id } });
    console.log(`--- TEST: Event 2 status in DB: ${e2?.status} ---`);

    expect(e2?.status).toBe('ACTIVE');

    // Check if event 1 is now completed
    e1 = await prisma.productionEvent.findUnique({ where: { id: event1Id } });
    expect(e1?.status).toBe('COMPLETED');
  });

  it('advances even when another event of the production was left ACTIVE', async () => {
    // E.g. a restored backup: an ACTIVE event further down the callsheet
    const stray = await prisma.productionEvent.create({
      data: {
        id: 'event-stray-' + Date.now(),
        productionId,
        title: 'Leftover active event',
        order: 99,
        status: 'ACTIVE',
      },
    });

    await inTestOrganization(() => productionState.setActiveEvent(event1Id, productionId));
    expect((await prisma.productionEvent.findUnique({ where: { id: stray.id } }))?.status).toBe('COMPLETED');

    vi.advanceTimersByTime(1500);
    await waitForStatus(prisma, event2Id, 'ACTIVE');

    expect((await prisma.productionEvent.findUnique({ where: { id: event2Id } }))?.status).toBe('ACTIVE');
  });

  it('broadcasts a serializable state while an auto-advance timer is pending', async () => {
    emit.mockClear();
    await inTestOrganization(() => productionState.setActiveEvent(event1Id, productionId));

    const stateUpdates = emit.mock.calls.filter(([event]) => event === 'callsheet_state_update');
    expect(stateUpdates.length).toBeGreaterThan(0);
    for (const [, payload] of stateUpdates) {
      expect(payload).not.toHaveProperty('autoAdvanceTimer');
      expect(() => JSON.stringify(payload)).not.toThrow();
    }
  });
});
