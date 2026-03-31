import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {PrismaClient} from '@prisma/client';
import * as productionState from './productionState';

const prisma = new PrismaClient();

// Mock socket.io
vi.mock('./socket', () => ({
  getIO: vi.fn(() => ({
    emit: vi.fn(),
  })),
}));

describe.runIf(process.env.REQUIRE_DB === 'true')('ProductionState Service Auto-Advance', () => {
  let productionId: number;
  let event1Id: string;
  let event2Id: string;

  beforeEach(async () => {
    vi.useFakeTimers();


    // Create test data
    const match = await prisma.matchSchedule.create({
      data: {
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should automatically advance to the next event after duration expires', async () => {
    vi.useFakeTimers();

    // Start production state
    await productionState.initializeProductionState();

    // Set event 1 as active
    console.log('--- TEST: Setting event 1 to active ---');
    await productionState.setActiveEvent(event1Id, productionId);

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
});
