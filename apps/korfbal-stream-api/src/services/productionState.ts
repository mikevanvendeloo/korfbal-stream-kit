import {ProductionEvent} from '@prisma/client';
import {getIO} from './socket';
import {prisma} from './prisma';
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
}

// This is our in-memory "source of truth" for the live show.
const currentState: LiveProductionState = {
  productionId: null,
  activeEventId: null,
  clocks: {
    productionTime: 0,
    scoreboardTime: 0,
  },
  isClockRunning: false,
  autoAdvanceTimer: null,
};

let clockInterval: NodeJS.Timeout | null = null;

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

export async function broadcastState() {
  const io = getIO();
  if (!io) return;

  // Stuur de globale state
  io.emit('callsheet_state_update', currentState);

  // Als er een actieve productie is, stuur dan ook de geüpdatete events mee
  if (currentState.productionId) {
    const events = await prisma.productionEvent.findMany({
      where: { productionId: currentState.productionId },
      include: {
        positions: { include: { position: true } },
      },
      orderBy: { order: 'asc' },
    });

    // We kunnen een specifiek event sturen voor de events-lijst
    // Sanitize elk event om stack overflow in socket.io-parser te voorkomen
    const sanitizedEvents = events.map(sanitizeEvent);
    io.emit('production_events_update', { items: sanitizedEvents });
  }
}

export function startProductionClock(productionId: number) {
  if (currentState.isClockRunning) return;

  currentState.productionId = productionId;
  currentState.isClockRunning = true;

  if (clockInterval) clearInterval(clockInterval);

  clockInterval = setInterval(() => {
    currentState.clocks.productionTime++;
    broadcastState();
  }, 1000);

  logger.info(`Production clock started for production ID: ${productionId}`);
}

export function stopProductionClock() {
  if (!clockInterval) return;
  clearInterval(clockInterval);
  clockInterval = null;
  currentState.isClockRunning = false;
  logger.info('Production clock stopped.');
}

export function updateScoreboardClock(timeInSeconds: number) {
  currentState.clocks.scoreboardTime = timeInSeconds;
  broadcastState();
}

export async function initializeProductionState() {
  if (process.env.REQUIRE_DB === 'false' || (process.env.NODE_ENV === 'test' && !process.env.REQUIRE_DB)) {
    logger.info('Skipping production state initialization in test/no-db environment.');
    return;
  }
  logger.info('Initializing production state...');
  const activeProduction = await prisma.production.findFirst({
    where: { isActive: true },
    include: {
      events: {
        where: { status: 'ACTIVE' },
        orderBy: { order: 'asc' },
        take: 1
      }
    }
  });

  if (activeProduction) {
    currentState.productionId = activeProduction.id;
    if (activeProduction.events.length > 0) {
      const activeEvent = activeProduction.events[0];
      currentState.activeEventId = activeEvent.id;
      logger.info(`Restored active production ${activeProduction.id} with event ${activeEvent.id}`);

      // Emit de status naar alle verbonden clients
      const io = getIO();
      if (io) {
        io.emit('active_event_update', sanitizeEvent(activeEvent));
      }

      // Start de klok en timers opnieuw als we een actief event hebben
      if (!currentState.isClockRunning) {
        startProductionClock(activeProduction.id);
      }

      // Als er een actuele starttijd is, bereken dan ook de productionTime opnieuw voor de klok
      if (activeEvent.actualStartTime) {
        const elapsedMs = new Date().getTime() - new Date(activeEvent.actualStartTime).getTime();
        // Dit is een versimpeling, we zouden eigenlijk door alle eerdere events moeten lopen om de totale tijd te weten
        // Maar voor nu zetten we hem op 0 of laten we hem doortellen vanaf het huidige event
        currentState.clocks.productionTime = Math.max(0, Math.floor(elapsedMs / 1000));
      }

      // We moeten setActiveEvent aanroepen om de timers (auto-advance) goed te zetten
      // Maar we willen niet de status updaten in de DB, dus we doen het handmatig
      setupAutoAdvance(activeEvent);
    } else {
      logger.info(`Restored active production ${activeProduction.id} but no active event found.`);
    }
  } else {
    logger.info('No active production found to restore.');
  }
}

function setupAutoAdvance(event: any) {
  if (currentState.autoAdvanceTimer) {
    clearTimeout(currentState.autoAdvanceTimer);
    currentState.autoAdvanceTimer = null;
  }

  if (event.autoAdvance && event.durationSec != null && event.actualStartTime) {
    const now = Date.now();
    const startTime = new Date(event.actualStartTime).getTime();
    const durationMs = event.durationSec * 1000;
    const remainingMs = durationMs - (now - startTime);

    if (remainingMs > 0) {
      logger.info(`Restoring auto-advance for event ${event.id} ("${event.title}") in ${Math.round(remainingMs/1000)}s`);
      currentState.autoAdvanceTimer = setTimeout(async () => {
        logger.info(`--- AUTO-ADVANCE TIMER EXPIRED (restored) for event ${event.id} ---`);
        try {
          const pId = currentState.productionId || event.productionId;
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
      }, remainingMs);
    } else {
      logger.info(`Auto-advance for event ${event.id} ("${event.title}") already expired, triggering now.`);
      // We wachten heel even om te zorgen dat alles is geïnitialiseerd
      setTimeout(async () => {
          logger.info(`--- AUTO-ADVANCE TIMER EXPIRED (expired/immediate) for event ${event.id} ---`);
          const pId = currentState.productionId || event.productionId;
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
      }, 2000);
    }
  }
}

export async function setActiveEvent(eventId: string, productionId: number) {
  if (!eventId) {
    logger.info(`Clearing active event for production ${productionId}`);
    currentState.activeEventId = null;
    currentState.productionId = productionId;
    if (currentState.autoAdvanceTimer) {
      clearTimeout(currentState.autoAdvanceTimer);
      currentState.autoAdvanceTimer = null;
    }
    const io = getIO();
    if (io) {
      io.emit('active_event_update', null);
    }
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

  // Set previous active event to COMPLETED
  if (currentState.activeEventId) {
    await prisma.productionEvent.update({
      where: { id: currentState.activeEventId },
      data: { status: 'COMPLETED' },
    });
  } else if (productionId) {
    // Fail-safe: als currentState leeg is, zet alle andere ACTIVE events voor deze productie op COMPLETED
    await prisma.productionEvent.updateMany({
      where: { productionId, status: 'ACTIVE', id: { not: eventId } },
      data: { status: 'COMPLETED' }
    });
  }

  // Set the new event to ACTIVE
  const activeEvent = await prisma.productionEvent.update({
    where: { id: eventId },
    data: { status: 'ACTIVE', actualStartTime: new Date() },
    include: {
      positions: { include: { position: true } },
    }
  });

  logger.info(`Event ${activeEvent.id} ("${activeEvent.title}") set to ACTIVE in DB`);

  currentState.activeEventId = activeEvent.id;
  currentState.productionId = productionId; // Ensure productionId is set
  if (!currentState.isClockRunning) {
    startProductionClock(productionId);
  }

  const io = getIO();
  if (io) {
    io.emit('active_event_update', sanitizeEvent(activeEvent));
  }

  // Stop bestaande auto-advance timer
  if (currentState.autoAdvanceTimer) {
    clearTimeout(currentState.autoAdvanceTimer);
    currentState.autoAdvanceTimer = null;
  }

  // Start nieuwe auto-advance timer indien nodig
  if (activeEvent.autoAdvance && activeEvent.durationSec != null) {
    const delayMs = activeEvent.durationSec * 1000;
    const currentProdId = productionId; // Bewaar in closure

    logger.info(`Auto-advance scheduled for event ${activeEvent.id} ("${activeEvent.title}") in ${activeEvent.durationSec}s (${delayMs}ms)`);

    // Meld aan alle clients dat er een auto-advance gepland is
    const io = getIO();
    if (io) {
      io.emit('auto_advance_scheduled', {
          eventId: activeEvent.id,
          delayMs: delayMs,
          scheduledAt: new Date().toISOString()
      });
    }

    if (delayMs <= 0) {
        logger.info(`Immediate auto-advance triggered for event ${activeEvent.id} (duration 0s)`);
        // Gebruik een kleine timeout om te voorkomen dat we in een oneindige loop komen
        // of dat de database transactie van de huidige setActiveEvent nog niet klaar is.
        currentState.autoAdvanceTimer = setTimeout(async () => {
            try {
                const checkProdId = currentState.productionId || currentProdId;
                const nextEvent = await getNextEventWithId(checkProdId, activeEvent.id);
                if (nextEvent) {
                    logger.info(`Auto-advancing (immediate) to next event: ${nextEvent.id} ("${nextEvent.title}")`);
                    await setActiveEvent(nextEvent.id, checkProdId);
                }
            } catch (err) {
                logger.error(`Error during immediate auto-advance from ${activeEvent.id}:`, err);
            }
        }, 1000);
    } else {
        currentState.autoAdvanceTimer = setTimeout(async () => {
          logger.info(`--- AUTO-ADVANCE TIMER EXPIRED for event ${activeEvent.id} ---`);
          try {
            const checkProdId = currentState.productionId || currentProdId;

            // Check of dit event nog steeds het actieve event is
            const currentActiveDb = await prisma.productionEvent.findFirst({
              where: { productionId: checkProdId, status: 'ACTIVE' }
            });

            if (currentActiveDb && currentActiveDb.id !== activeEvent.id) {
              logger.info(`Auto-advance aborted: current active event in DB (${currentActiveDb.id}) is different from the one that started the timer (${activeEvent.id})`);
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
        }, delayMs);
    }
  } else {
    logger.info(`No auto-advance for event ${activeEvent.id} ("${activeEvent.title}"). AutoAdvance: ${activeEvent.autoAdvance}, Duration: ${activeEvent.durationSec}`);
  }

  // Herbereken de tijden voor de hele callsheet bij elke event-wissel
  await recalculateProductionTimes(productionId, activeEvent.actualStartTime || new Date(), eventId);

  broadcastState();

  // Stuur ook een signaal dat de events zijn bijgewerkt (tijden zijn veranderd)
  getIO().emit('production_events_update_needed');

  return activeEvent;
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
  const io = getIO();
  if (io) {
    io.emit('production_events_update_needed');
  }

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
  const ioFinal = getIO();
  if (ioFinal) {
    ioFinal.emit('production_events_update_needed');
  }
}

export async function getNextEvent(): Promise<ProductionEvent | null> {
    if (!currentState.productionId) {
        logger.warn('getNextEvent called but currentState.productionId is missing');
        return null;
    }
    return getNextEventWithId(currentState.productionId, currentState.activeEventId);
}

async function getNextEventWithId(productionId: number, activeEventId: string | null): Promise<ProductionEvent | null> {
    logger.info(`getNextEventWithId: starting search for next event. prodId: ${productionId}, currentId: ${activeEventId}`);
    // Gebruik een expliciete Prisma instance als die in de module state zit
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
    if (!currentState.productionId || !currentState.activeEventId) return null;

    const currentEvent = await prisma.productionEvent.findUnique({ where: { id: currentState.activeEventId }});
    if (!currentEvent) return null;

    return prisma.productionEvent.findFirst({
        where: {
            productionId: currentState.productionId,
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
  return currentState.productionId;
}

export function initializeClient(socket: any) {
  socket.emit('callsheet_state_update', currentState);

  // Als we een actief event hebben, stuur die dan ook direct mee
  if (currentState.activeEventId) {
    prisma.productionEvent.findUnique({
      where: { id: currentState.activeEventId },
      include: {
        positions: { include: { position: true } },
      }
    }).then(event => {
      if (event) {
        socket.emit('active_event_update', sanitizeEvent(event));
      }
    });
  }
}

export async function startProduction(productionId: number, firstEvent: ProductionEvent) {
  currentState.productionId = productionId;
  currentState.activeEventId = firstEvent.id;
  const startTime = new Date();

  if (!currentState.isClockRunning) {
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

  const io = getIO();
  if (io) {
    io.emit('active_event_update', sanitizeEvent(activeEvent));
  }

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
    currentState.clocks.scoreboardTime = minutes * 60 + seconds;

    // Stuur ook de geformatteerde tijd mee voor directe weergave
    const io = getIO();
    if (io) {
        io.emit('time_state_update', {
            mode: 'counting_down', // Korfbal klok telt meestal af
            serverStartTime: Date.now(),
            initialDuration: currentState.clocks.scoreboardTime,
            venueClock: time
        });
    }

    broadcastState();
  }
}
