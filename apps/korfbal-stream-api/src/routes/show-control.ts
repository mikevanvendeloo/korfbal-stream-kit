// apps/korfbal-stream-api/src/routes/show-control.ts
import {Router} from 'express';
import {prisma} from '../services/prisma';
import * as productionStateService from '../services/productionState';

export const showControlRouter: Router = Router();

// POST /api/show/start/:productionId - Start de hele show
showControlRouter.post('/start/:productionId', async (req, res, next) => {
    try {
        const productionId = Number(req.params.productionId);
        const firstEvent = await prisma.productionEvent.findFirst({
            where: {productionId},
            orderBy: {order: 'asc'},
        });

        if (!firstEvent) {
            return res.status(404).json({error: 'No events found for this production.'});
        }

        productionStateService.startProduction(productionId, firstEvent);
        return res.status(200).json({message: 'Show started!', activeEvent: firstEvent});
    } catch (err) {
        return next(err);
    }
});

// POST /api/show/next - Ga naar het volgende item
showControlRouter.post('/next', async (req, res, next) => {
    try {
        const activeProductionId = productionStateService.getActiveProductionId();
        if (!activeProductionId) {
            return res.status(400).json({error: 'No active production.'});
        }

    const nextEvent = await productionStateService.getNextEvent();

    if (!nextEvent) {
      return res.status(404).json({error: 'End of show reached.'});
    }

    const updatedEvent = await productionStateService.setActiveEvent(nextEvent.id, activeProductionId);
    return res.status(200).json(updatedEvent);
  } catch (err) {
    return next(err);
  }
});

// POST /api/show/previous - Ga naar het vorige item
showControlRouter.post('/previous', async (req, res, next) => {
  try {
    const activeProductionId = productionStateService.getActiveProductionId();
    if (!activeProductionId) {
      return res.status(400).json({error: 'No active production.'});
    }

    const previousEvent = await productionStateService.getPreviousEvent();

    if (!previousEvent) {
      return res.status(404).json({error: 'Start of show reached.'});
    }

    const updatedEvent = await productionStateService.setActiveEvent(previousEvent.id, activeProductionId);
    return res.status(200).json(updatedEvent);
  } catch (err) {
    return next(err);
  }
});

// Recalculate production times based on a specific event (or active event)
showControlRouter.post('/recalculate/:productionId', async (req, res, next) => {
    try {
        const productionId = Number(req.params.productionId);
        const { anchorEventId, anchorTime } = req.body;

        let eventId = anchorEventId;
        let time = anchorTime ? new Date(anchorTime) : new Date();

        if (!eventId) {
            // Fallback to active event if no specific event ID provided
            const activeEvent = await prisma.productionEvent.findFirst({
                where: { productionId, status: 'ACTIVE' }
            });
            if (!activeEvent) {
                return res.status(400).json({ error: 'No active event found to use as anchor' });
            }
            eventId = activeEvent.id;
            // If we use the active event, we probably want to use its actualStartTime if it exists
            if (!anchorTime && activeEvent.actualStartTime) {
                time = new Date(activeEvent.actualStartTime);
            }
        }

        await productionStateService.recalculateProductionTimes(productionId, time, eventId, true);
        return res.status(200).json({ message: 'Production times recalculated successfully' });
    } catch (err) {
        return next(err);
    }
});

// Reset production times based on the match start time anchor
showControlRouter.post('/reset/:productionId', async (req, res, next) => {
    try {
        const productionId = Number(req.params.productionId);
        const production = await prisma.production.findUnique({
            where: { id: productionId },
            include: { matchSchedule: true }
        });

        if (!production || !production.matchSchedule) {
            return res.status(400).json({ error: 'Production or match schedule not found' });
        }

        const anchorEvent = await prisma.productionEvent.findFirst({
            where: { productionId, isTimeAnchor: true }
        });

        if (!anchorEvent) {
            return res.status(400).json({ error: 'No time anchor found in callsheet' });
        }

        const anchorTime = new Date(production.matchSchedule.date);

        // Update production liveTime to match the match start time
        await prisma.production.update({
            where: { id: productionId },
            data: {
                liveTime: anchorTime
            }
        });

        // Reset production state: clear actual times and status
        await prisma.productionEvent.updateMany({
            where: { productionId },
            data: {
                actualStartTime: null,
                status: 'WAITING'
            }
        });

        // Clear active event in memory if it belongs to this production
        if (productionStateService.getActiveProductionId() === productionId) {
            await productionStateService.setActiveEvent('', productionId);
            productionStateService.stopProductionClock();
        }

        // We call recalculateProductionTimes with force=true to ensure all times are updated
        // even if the anchor time didn't change (e.g. if previous actual times were different)
        await productionStateService.recalculateProductionTimes(productionId, anchorTime, anchorEvent.id, true);

        return res.status(200).json({ message: 'Production times reset to match start successfully' });
    } catch (err) {
        return next(err);
    }
});

// POST /api/show/clock - Update de scorebordklok
showControlRouter.post('/clock', (req, res) => {
    const {time} = req.body; // verwacht bijv. "15:34"
    if (typeof time !== 'string') {
        return res.status(400).json({error: 'Invalid time format.'});
    }
    productionStateService.updateVenueClock(time);
    return res.status(200).send();
});
