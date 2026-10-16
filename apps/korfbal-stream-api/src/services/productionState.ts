import {ProductionEvent} from '@prisma/client';
import {emitToOrganization} from './socket';
import {prisma, prismaUnscoped} from './prisma';
import {bindOrganization, requireOrganizationId, runWithOrganization} from './organizationContext';
import {logger} from '../utils/logger';

interface ClockState {
  productionTime: number; // in seconds
  scoreboardTime: number; // in seconds
}

interface LiveProductionState {
  productionId: number | null;
  activeEventId: string | null;
  clocks: ClockState;
  isClockRunning: boolean;
  autoAdvanceTimer: NodeJS.Timeout | null;
  clockInterval: NodeJS.Timeout | null;
}

// The in-memory "source of truth" for the live show, one per organization (D6). Every exported
// function works on the state of the organization in the context.
const liveStates = new Map<number, LiveProductionState>();

function newLiveState(): LiveProductionState {
  return {
    productionId: null,
    activeEventId: null,
    clocks: {productionTime: 0, scoreboardTime: 0},
    isClockRunning: false,
    autoAdvanceTimer: null,
    clockInterval: null,
  };
}

function live(): LiveProductionState {
  const organizationId = requireOrganizationId('The live state');
  let state = liveStates.get(organizationId);
  if (!state) {
    state = newLiveState();
    liveStates.set(organizationId, state);
  }
  return state;
}

function clearAutoAdvance(state: LiveProductionState) {
  if (state.autoAdvanceTimer) clearTimeout(state.autoAdvanceTimer);
  state.autoAdvanceTimer = null;
}

/** Live events only reach the clients of the organization in the context (room org:<id>). */
const emit = (event: string, ...args: unknown[]) => emitToOrganization(event, ...args);

function sanitizeEvent(event: any) {
  if (!event) return null;
  // Maak een kopie met alleen de velden die we in de frontend nodig hebben
  // en voorkom dat we parent/children recursief meesturen als dat per ongeluk in de include zit
  const sanitized = {
    ...event,
    // Verwijder potentieel circulaire of te grote relaties als ze niet nodig zijn
    parent: undefined,
    linkedItems: undefined,
  };

  // Als we positions hebben, zorg dat die ook schoon zijn
  if (Array.isArray(event.positions)) {
      sanitized.positions = event.positions.map((p: any) => ({
          id: p.id,
          positionId: p.positionId,
          productionEventId: p.productionEventId,
          position: p.position ? {
              id: p.position.id,
              name: p.position.name,
              color: p.position.color
          } : undefined
      }));
  }

  return sanitized;
}

/**
 * The state as sent to clients. Leaves out the timers: a Node Timeout has circular references, which
 * make socket.io-parser (hasBinary) fail with 'Maximum call stack size exceeded', and JSON too.
 */
export function liveStateSnapshot() {
  const {productionId, activeEventId, clocks, isClockRunning} = live();
  return {productionId, activeEventId, clocks: {...clocks}, isClockRunning};
}

export async function broadcastState() {
  const state = live();
  emit('callsheet_state_update', liveStateSnapshot());

  // Als er een actieve productie is, stuur dan ook de geüpdatete events mee
  if (state.productionId) {
    const events = await prisma.productionEvent.findMany({
      where: { productionId: state.productionId },
      include: {
        positions: { include: { position: true } },
      },
      orderBy: { order: 'asc' },
    });

    // Sanitize elk event om stack overflow in socket.io-parser te voorkomen
    emit('production_events_update', { items: events.map(sanitizeEvent) });
  }
}

export function startProductionClock(productionId: number) {
  const state = live();
  if (state.isClockRunning) return;

  state.productionId = productionId;
  state.isClockRunning = true;

  if (state.clockInterval) clearInterval(state.clockInterval);

  state.clockInterval = setInterval(bindOrganization(() => {
    state.clocks.productionTime++;
    broadcastState().catch((err) => logger.error('Live state broadcast failed:', err));
  }), 1000);

  logger.info(`Production clock started for production ID: ${productionId}`);
}

export function stopProductionClock() {
  const state = live();
  if (!state.clockInterval) return;
  clearInterval(state.clockInterval);
  state.clockInterval = null;
  state.isClockRunning = false;
  logger.info('Production clock stopped.');
}

export function updateScoreboardClock(timeInSeconds: number) {
  live().clocks.scoreboardTime = timeInSeconds;
  logger.debug(`Scoreboard clock updated to ${timeInSeconds}s`);
  broadcastState();
}

/** The live state of the organization in the context (also the timers; send `liveStateSnapshot()` to clients). */
export function getCurrentState() {
  return live();
}

/** Organizations with an active production (in the database), for background services. */
export async function organizationsWithActiveProduction(): Promise<number[]> {
  const rows = await prismaUnscoped.production.findMany({
    where: {isActive: true},
    distinct: ['organizationId'],
    select: {organizationId: true},
  });
  return rows.map((r) => r.organizationId);
}

/** Restores the active production of every organization (startup). */
export async function initializeProductionState() {
  if (process.env.REQUIRE_DB === 'false' || (process.env.NODE_ENV === 'test' && !process.env.REQUIRE_DB)) {
    logger.info('Skipping production state initialization in test/no-db environment.');
    return;
  }
  logger.info('Initializing production state...');
  const organizationIds = await organizationsWithActiveProduction();
  if (organizationIds.length === 0) {
    logger.info('No active production found to restore.');
    return;
  }
  for (const organizationId of organizationIds) {
    await runWithOrganization(organizationId, restoreActiveProduction).catch((err) => {
      logger.error(`Restoring the active production of organization ${organizationId} failed:`, err);
    });
  }
}

async function restoreActiveProduction() {
  const state = live();
  const activeProduction = await prisma.production.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      productionEvents: {
        where: { status: 'ACTIVE' },
        orderBy: { order: 'asc' },
        take: 1
      }
    }
  });
  if (!activeProduction) {
    logger.info('No active production found to restore.');
    return;
  }
  state.productionId = activeProduction.id;
  if (activeProduction.productionEvents.length === 0) {
    logger.info(`Restored active production ${activeProduction.id} but no active event found.`);
    return;
  }
  const activeEvent = activeProduction.productionEvents[0];
  state.activeEventId = activeEvent.id;
  logger.info(`Restored active production ${activeProduction.id} with event ${activeEvent.id}`);

  emit('active_event_update', sanitizeEvent(activeEvent));

  // Start de klok en timers opnieuw als we een actief event hebben
  if (!state.isClockRunning) {
    startProductionClock(activeProduction.id);
  }

  // Als er een actuele starttijd is, bereken dan ook de productionTime opnieuw voor de klok
  if (activeEvent.actualStartTime) {
    const elapsedMs = new Date().getTime() - new Date(activeEvent.actualStartTime).getTime();
    // Een versimpeling: de klok telt door vanaf het huidige event
    state.clocks.productionTime = Math.max(0, Math.floor(elapsedMs / 1000));
  }

  // De auto-advance timer opnieuw zetten, zonder de status in de DB te wijzigen
  setupAutoAdvance(activeEvent);
}

function setupAutoAdvance(event: any) {
  const state = live();
  clearAutoAdvance(state);

  if (event.autoAdvance && event.durationSec != null && event.actualStartTime) {
    const now = Date.now();
    const startTime = new Date(event.actualStartTime).getTime();
    const durationMs = event.durationSec * 1000;
    const remainingMs = durationMs - (now - startTime);

    if (remainingMs > 0) {
      logger.info(`Restoring auto-advance for event ${event.id} ("${event.title}") in ${Math.round(remainingMs/1000)}s`);
      state.autoAdvanceTimer = setTimeout(bindOrganization(async () => {
        logger.info(`--- AUTO-ADVANCE TIMER EXPIRED (restored) for event ${event.id} ---`);
        try {
          const pId = state.productionId || event.productionId;
          if (!pId) {
            logger.warn(`AUTO-ADVANCE TRIGGERED (restored) but productionId is missing! Event: ${event.id}`);
            return;
          }
          logger.info(`AUTO-ADVANCE TRIGGERED (restored) from event ${event.id} ("${event.title}")`);
          const nextEvent = await getNextEventWithId(pId, event.id);
          if (nextEvent) {
            logger.info(`Auto-advancing (restored) to next event: ${nextEvent.id} ("${nextEvent.title}")`);
            await setActiveEvent(nextEvent.id, pId);
          } else {
            logger.info('No next event found for restored auto-advance');
          }
        } catch (err) {
          logger.error('Error during restored auto-advance:', err);
        }
      }), remainingMs);
    } else {
      logger.info(`Auto-advance for event ${event.id} ("${event.title}") already expired, triggering now.`);
      // We wachten heel even om te zorgen dat alles is geïnitialiseerd
      state.autoAdvanceTimer = setTimeout(bindOrganization(async () => {
          logger.info(`--- AUTO-ADVANCE TIMER EXPIRED (expired/immediate) for event ${event.id} ---`);
          try {
            const pId = state.productionId || event.productionId;
            if (!pId) {
              logger.warn(`AUTO-ADVANCE EXPIRED TRIGGERED but productionId is missing! Event: ${event.id}`);
              return;
            }
            const nextEvent = await getNextEventWithId(pId, event.id);
            if (nextEvent) {
                logger.info(`Auto-advancing (expired) to next event: ${nextEvent.id} ("${nextEvent.title}")`);
                await setActiveEvent(nextEvent.id, pId);
            } else {
              logger.info('No next event found for expired auto-advance');
            }
          } catch (err) {
            logger.error('Error during expired auto-advance:', err);
          }
      }), 2000);
    }
  }
}

export async function setActiveEvent(eventId: string, productionId: number) {
  const state = live();
  if (!eventId) {
    logger.info(`Clearing active event for production ${productionId}`);
    state.activeEventId = null;
    state.productionId = productionId;
    clearAutoAdvance(state);
    emit('active_event_update', null);
    return null;
  }

  logger.info(`Setting active event ${eventId} for production ${productionId}`);
  const event = await prisma.productionEvent.findUnique({
    where: { id: eventId },
    include: {
      positions: { include: { position: true } },
    }
  });
  if (!event || event.productionId !== productionId) {
    logger.warn(`Event ${eventId} not found or doesn't match production ${productionId}`);
    return;
  }

  // Set every other ACTIVE event of this production to COMPLETED - not just the one in memory, so a
  // leftover ACTIVE event (e.g. from a restored backup or a restart) can't linger next to the new one
  await prisma.productionEvent.updateMany({
    where: { productionId, status: 'ACTIVE', id: { not: eventId } },
    data: { status: 'COMPLETED' }
  });

  // Set the new event to ACTIVE
  const activeEvent = await prisma.productionEvent.update({
    where: { id: eventId },
    data: { status: 'ACTIVE', actualStartTime: new Date() },
    include: {
      positions: { include: { position: true } },
    }
  });

  logger.info(`Event ${activeEvent.id} ("${activeEvent.title}") set to ACTIVE in DB`);

  state.activeEventId = activeEvent.id;
  state.productionId = productionId;
  if (!state.isClockRunning) {
    startProductionClock(productionId);
  }

  emit('active_event_update', sanitizeEvent(activeEvent));

  // Stop bestaande auto-advance timer
  clearAutoAdvance(state);

  // Start nieuwe auto-advance timer indien nodig
  if (activeEvent.autoAdvance && activeEvent.durationSec != null) {
    const delayMs = activeEvent.durationSec * 1000;
    const currentProdId = productionId; // Bewaar in closure

    logger.info(`Auto-advance scheduled for event ${activeEvent.id} ("${activeEvent.title}") in ${activeEvent.durationSec}s (${delayMs}ms)`);

    // Meld aan de clients dat er een auto-advance gepland is
    emit('auto_advance_scheduled', {
      eventId: activeEvent.id,
      delayMs: delayMs,
      scheduledAt: new Date().toISOString()
    });

    if (delayMs <= 0) {
        logger.info(`Immediate auto-advance triggered for event ${activeEvent.id} (duration 0s)`);
        // Gebruik een kleine timeout om te voorkomen dat we in een oneindige loop komen
        // of dat de database transactie van de huidige setActiveEvent nog niet klaar is.
        state.autoAdvanceTimer = setTimeout(bindOrganization(async () => {
            try {
                const checkProdId = state.productionId || currentProdId;
                const nextEvent = await getNextEventWithId(checkProdId, activeEvent.id);
                if (nextEvent) {
                    logger.info(`Auto-advancing (immediate) to next event: ${nextEvent.id} ("${nextEvent.title}")`);
                    await setActiveEvent(nextEvent.id, checkProdId);
                }
            } catch (err) {
                logger.error(`Error during immediate auto-advance from ${activeEvent.id}:`, err);
            }
        }), 1000);
    } else {
        state.autoAdvanceTimer = setTimeout(bindOrganization(async () => {
          logger.info(`--- AUTO-ADVANCE TIMER EXPIRED for event ${activeEvent.id} ---`);
          try {
            const checkProdId = state.productionId || currentProdId;

            // Check of dit event nog steeds het actieve event is (in-memory state is leidend)
            if (state.activeEventId !== activeEvent.id) {
              logger.info(`Auto-advance aborted: current active event (${state.activeEventId}) is different from the one that started the timer (${activeEvent.id})`);
              return;
            }

            logger.info(`Proceeding with auto-advance from ${activeEvent.id}`);
            const nextEvent = await getNextEventWithId(checkProdId, activeEvent.id);

            if (nextEvent) {
              logger.info(`Auto-advancing to next event: ${nextEvent.id} ("${nextEvent.title}")`);
              await setActiveEvent(nextEvent.id, checkProdId);
            } else {
              logger.info('No next event found for auto-advance');
            }
          } catch (err) {
            logger.error(`Error during auto-advance from ${activeEvent.id}:`, err);
          }
        }), delayMs);
    }
  } else {
    logger.info(`No auto-advance for event ${activeEvent.id} ("${activeEvent.title}"). AutoAdvance: ${activeEvent.autoAdvance}, Duration: ${activeEvent.durationSec}`);
  }

  // Herbereken de tijden voor de hele callsheet bij elke event-wissel
  await recalculateProductionTimes(productionId, activeEvent.actualStartTime || new Date(), eventId);

  broadcastState();

  // Stuur ook een signaal dat de events zijn bijgewerkt (tijden zijn veranderd)
  emit('production_events_update_needed');

  return activeEvent;
}

/**
 * Sets the remaining time of the active item to `seconds` from now: its duration becomes the time it has
 * run so far plus `seconds`. Auto-advance is rescheduled and the following items move along. The item's
 * planned duration in the callsheet stays as it was, so the timing report still compares with the plan.
 * Returns null when no item is active.
 */
export async function setActiveEventRemaining(seconds: number) {
  const state = live();
  const eventId = state.activeEventId;
  const productionId = state.productionId;
  if (!eventId || !productionId) return null;

  const event = await prisma.productionEvent.findUnique({where: {id: eventId}});
  if (!event) return null;
  const start = event.actualStartTime ?? new Date();
  const elapsedSec = Math.max(0, Math.round((Date.now() - start.getTime()) / 1000));
  const durationSec = elapsedSec + seconds;

  const updated = await prisma.productionEvent.update({
    where: {id: eventId},
    data: {durationSec, actualStartTime: start, plannedEndTime: new Date(start.getTime() + durationSec * 1000)},
    include: {positions: {include: {position: true}}},
  });
  logger.info(`Remaining time of event ${eventId} ("${updated.title}") set to ${seconds}s (duration ${durationSec}s)`);

  setupAutoAdvance(updated);
  // The items after this one start earlier or later now
  await recalculateProductionTimes(productionId, start, eventId, true);

  emit('active_event_update', sanitizeEvent(updated));
  if (updated.autoAdvance) emit('auto_advance_scheduled', {eventId, delayMs: seconds * 1000, scheduledAt: new Date().toISOString()});
  emit('production_events_update_needed');
  broadcastState();
  return updated;
}

/**
 * Herrekent alle geplande tijden van de callsheet items en production events
 * op basis van een nieuw ankerpunt (bijv. een trigger vanuit vMix of handmatig).
 */
export async function recalculateProductionTimes(productionId: number, anchorTime: Date, anchorEventId: string, force = false) {
  const anchorEvent = await prisma.productionEvent.findUnique({
    where: { id: anchorEventId }
  });
  if (!anchorEvent) return;

  const oldAnchorTime = anchorEvent.plannedStartTime ? new Date(anchorEvent.plannedStartTime) : anchorTime;
  const timeShiftMs = anchorTime.getTime() - oldAnchorTime.getTime();

  if (!force && Math.abs(timeShiftMs) < 1000) return; // Geen noemenswaardige shift

  logger.info(`Recalculating times for production ${productionId} with shift of ${timeShiftMs}ms`);

  // Update alle events (events met een hogere order dan het huidige)
  const allEvents = await prisma.productionEvent.findMany({
    where: { productionId },
    orderBy: { order: 'asc' }
  });

  const anchorIdx = allEvents.findIndex(e => e.id === anchorEventId);
  if (anchorIdx === -1) return;

  const eventUpdates = [];

  // Anchor zelf
  const anchorEnd = new Date(anchorTime.getTime() + ((allEvents[anchorIdx].durationSec || 0) * 1000));
  eventUpdates.push(prisma.productionEvent.update({
    where: { id: allEvents[anchorIdx].id },
    data: { plannedStartTime: anchorTime, plannedEndTime: anchorEnd }
  }));

  // Vooruit rekenen vanaf anker
  let nextStart = anchorEnd;
  for (let i = anchorIdx + 1; i < allEvents.length; i++) {
    const ev = allEvents[i];
    const end = new Date(nextStart.getTime() + ((ev.durationSec || 0) * 1000));
    eventUpdates.push(prisma.productionEvent.update({
      where: { id: ev.id },
      data: { plannedStartTime: nextStart, plannedEndTime: end }
    }));
    nextStart = end;
  }

  // Achteruit rekenen vanaf anker
  let prevStart = anchorTime;
  for (let i = anchorIdx - 1; i >= 0; i--) {
    const ev = allEvents[i];
    const start = new Date(prevStart.getTime() - ((ev.durationSec || 0) * 1000));
    eventUpdates.push(prisma.productionEvent.update({
      where: { id: ev.id },
      data: { plannedStartTime: start, plannedEndTime: prevStart }
    }));
    prevStart = start;
  }

  if (eventUpdates.length > 0) {
    await prisma.$transaction(eventUpdates);
  }

  // Broadcast that events need update
  emit('production_events_update_needed');

  // Update ook de bijbehorende callsheet items
  const callSheets = await prisma.callSheet.findMany({
    where: { productionId }
  });

  for (const cs of callSheets) {
    const itemsToUpdate = await prisma.callSheetItem.findMany({
      where: {
        callSheetId: cs.id,
      }
    });

    const callSheetItemUpdates = [];
    for (const item of itemsToUpdate) {
      const correspondingEvent = allEvents.find(e => e.callSheetItemId === item.id);
      if (correspondingEvent) {
        callSheetItemUpdates.push(prisma.callSheetItem.update({
          where: { id: item.id },
          data: {
            timeStart: correspondingEvent.plannedStartTime,
            timeEnd: correspondingEvent.plannedEndTime
          }
        }));
      }
    }

    if (callSheetItemUpdates.length > 0) {
      await prisma.$transaction(callSheetItemUpdates);
    }
  }

  // Broadcast again after items update
  emit('production_events_update_needed');
}

export async function getNextEvent(): Promise<ProductionEvent | null> {
    const state = live();
    if (!state.productionId) {
        logger.warn('getNextEvent called but the live state has no productionId');
        return null;
    }
    return getNextEventWithId(state.productionId, state.activeEventId);
}

async function getNextEventWithId(productionId: number, activeEventId: string | null): Promise<ProductionEvent | null> {
    logger.info(`getNextEventWithId: starting search for next event. prodId: ${productionId}, currentId: ${activeEventId}`);
    const currentEventOrder = await (async () => {
        if (activeEventId) {
            const currentEvent = await prisma.productionEvent.findUnique({ where: { id: activeEventId }});
            if (currentEvent) {
                logger.info(`getNextEventWithId: current active event ${activeEventId} has order ${currentEvent.order}`);
                return currentEvent.order;
            }
            logger.warn(`getNextEventWithId: activeEventId ${activeEventId} not found in DB`);
        }

        const activeDbEvent = await prisma.productionEvent.findFirst({
            where: { productionId, status: 'ACTIVE' },
            orderBy: { order: 'desc' }
        });
        if (activeDbEvent) {
            logger.info(`getNextEventWithId: found ACTIVE event ${activeDbEvent.id} in DB with order ${activeDbEvent.order}`);
            return activeDbEvent.order;
        }

        logger.info('getNextEventWithId: no current order found, defaulting to -1');
        return -1;
    })();

    const next = await prisma.productionEvent.findFirst({
        where: {
            productionId,
            order: {
                gt: currentEventOrder,
            },
        },
        orderBy: [
            { order: 'asc' },
            { createdAt: 'asc' }
        ],
    });

    if (next) {
        logger.info(`getNextEventWithId: next event will be ${next.id} ("${next.title}") with order ${next.order}`);
    } else {
        logger.info(`getNextEventWithId: no next event found with order > ${currentEventOrder}`);
    }

    return next;
}

export async function getPreviousEvent(): Promise<ProductionEvent | null> {
    const state = live();
    if (!state.productionId || !state.activeEventId) return null;

    const currentEvent = await prisma.productionEvent.findUnique({ where: { id: state.activeEventId }});
    if (!currentEvent) return null;

    return prisma.productionEvent.findFirst({
        where: {
            productionId: state.productionId,
            order: {
                lt: currentEvent.order,
            },
        },
        orderBy: [
            { order: 'desc' },
            { createdAt: 'desc' }
        ],
    });
}

export function getActiveProductionId() {
  return live().productionId;
}

export async function stopProduction(productionId: number) {
  const state = live();
  if (state.productionId !== productionId) {
    logger.warn(`stopProduction called for ${productionId} but current is ${state.productionId}`);
    return;
  }

  logger.info(`Stopping production ${productionId}`);

  // Stop clock and auto-advance
  stopProductionClock();
  clearAutoAdvance(state);

  // Mark currently active event as COMPLETED
  if (state.activeEventId) {
    await prisma.productionEvent.update({
      where: { id: state.activeEventId },
      data: { status: 'COMPLETED' },
    }).catch(err => logger.error('Failed to mark active event as COMPLETED on stop:', err));
  }

  // Clear in-memory state
  state.productionId = null;
  state.activeEventId = null;
  state.clocks.productionTime = 0;
  state.clocks.scoreboardTime = 0;

  emit('production_stopped', { productionId });
  emit('active_event_update', null);
  emit('callsheet_state_update', liveStateSnapshot());

  logger.info(`Production ${productionId} stopped and websocket broadcasts halted.`);
}

/** Sends the live state to a client that just joined; runs in the client's organization. */
export function initializeClient(socket: { emit: (event: string, ...args: unknown[]) => unknown }) {
  socket.emit('callsheet_state_update', liveStateSnapshot());

  // Als we een actief event hebben, stuur die dan ook direct mee
  const eventId = live().activeEventId;
  if (eventId) {
    prisma.productionEvent.findUnique({
      where: { id: eventId },
      include: {
        positions: { include: { position: true } },
      }
    }).then(event => {
      if (event) {
        socket.emit('active_event_update', sanitizeEvent(event));
      }
    }).catch((err) => logger.error('Sending the active event to a new client failed:', err));
  }
}

export async function startProduction(productionId: number, firstEvent: ProductionEvent) {
  const state = live();
  state.productionId = productionId;
  state.activeEventId = firstEvent.id;
  const startTime = new Date();

  if (!state.isClockRunning) {
    startProductionClock(productionId);
  }

  // Update de status van het eerste event en zet de werkelijke starttijd
  const activeEvent = await prisma.productionEvent.update({
    where: { id: firstEvent.id },
    data: { status: 'ACTIVE', actualStartTime: startTime },
    include: {
      positions: { include: { position: true } },
    }
  });

  emit('active_event_update', sanitizeEvent(activeEvent));

  // Zoek alle callsheet items voor deze productie die gepland zijn
  const callSheets = await prisma.callSheet.findMany({
    where: { productionId },
    include: {
      items: {
        orderBy: [{ orderIndex: 'asc' }],
      }
    }
  });

  for (const cs of callSheets) {
    const anchorItem = cs.items.find(it => it.isTimeAnchor);
    if (!anchorItem) continue;

    // Gebruik de huidige tijd als de nieuwe anker-tijd (Start livestream/productie)
    const newAnchorTime = startTime;
    const oldAnchorTime = anchorItem.timeStart ? new Date(anchorItem.timeStart) : startTime;
    const timeShiftMs = newAnchorTime.getTime() - oldAnchorTime.getTime();

    const updates = cs.items.map(item => {
      let newStart = item.timeStart;
      let newEnd = item.timeEnd;

      if (item.timeStart) {
        newStart = new Date(new Date(item.timeStart).getTime() + timeShiftMs);
      }
      if (item.timeEnd) {
        newEnd = new Date(new Date(item.timeEnd).getTime() + timeShiftMs);
      }

      return prisma.callSheetItem.update({
        where: { id: item.id },
        data: {
          timeStart: newStart,
          timeEnd: newEnd
        }
      });
    });

    await prisma.$transaction(updates);

    // Na het updaten van de callsheet items, moeten ook de ProductionEvents worden bijgewerkt
    // als deze gesynchroniseerd zijn.
    const events = await prisma.productionEvent.findMany({
      where: { productionId }
    });

    const eventUpdates = events.map(event => {
      // We zoeken het bijbehorende callsheet item op basis van titel en volgorde (simpele match voor nu)
      const matchingItem = cs.items.find(it => it.title === event.title && it.orderIndex === event.order);
      if (matchingItem) {
        // Bereken nieuwe tijden voor het event op basis van de shift
        let newPlannedStart = event.plannedStartTime;
        let newPlannedEnd = event.plannedEndTime;

        if (event.plannedStartTime) {
          newPlannedStart = new Date(new Date(event.plannedStartTime).getTime() + timeShiftMs);
        }
        if (event.plannedEndTime) {
          newPlannedEnd = new Date(new Date(event.plannedEndTime).getTime() + timeShiftMs);
        }

        return prisma.productionEvent.update({
          where: { id: event.id },
          data: {
            plannedStartTime: newPlannedStart,
            plannedEndTime: newPlannedEnd
          }
        });
      }
      return null;
    }).filter(u => u !== null) as any[];

    if (eventUpdates.length > 0) {
      await prisma.$transaction(eventUpdates);
    }
  }

  broadcastState();
}

export function updateVenueClock(time: string) {
  // Parse time "MM:SS" to seconds
  const [minutes, seconds] = time.split(':').map(Number);
  if (!isNaN(minutes) && !isNaN(seconds)) {
    const totalSeconds = minutes * 60 + seconds;
    live().clocks.scoreboardTime = totalSeconds;

    logger.debug(`Venue clock sync: ${time} (${totalSeconds}s)`);

    // Stuur ook de geformatteerde tijd mee voor directe weergave
    emit('time_state_update', {
      mode: 'counting_down', // Korfbal klok telt meestal af
      serverStartTime: Date.now(),
      initialDuration: totalSeconds,
      venueClock: time
    });

    broadcastState();
  }
}
