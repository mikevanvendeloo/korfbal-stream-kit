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

        const currentEvent = await prisma.productionEvent.findFirst({
            where: {productionId: activeProductionId, status: 'ACTIVE'}
        })

        const nextEvent = await prisma.productionEvent.findFirst({
            where: {
                productionId: activeProductionId,
                order: {gt: currentEvent?.order ?? -1},
            },
            orderBy: {order: 'asc'},
        });

        if (!nextEvent) {
            return res.status(404).json({error: 'End of show reached.'});
        }

        await productionStateService.setActiveEvent(nextEvent.id, activeProductionId);
        return res.status(200).json(nextEvent);
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
