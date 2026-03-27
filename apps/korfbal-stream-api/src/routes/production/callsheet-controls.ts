import {Router} from 'express';
import {getNextEvent, getPreviousEvent, setActiveEvent, updateScoreboardClock} from '../../services/productionState';

export const callsheetControlsRouter: Router = Router();

// Manually set the active event
callsheetControlsRouter.post('/callsheet/set-active/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const productionId = Number(req.body.productionId); // Assuming productionId is sent in the body
        if (!productionId) {
            return res.status(400).json({ error: 'productionId is required' });
        }
        const event = await setActiveEvent(id, productionId);
        if (!event) {
            return res.status(404).json({ error: 'Event not found or production ID mismatch.' });
        }
       return  res.status(200).json(event);
    } catch (err) {
       return next(err);
    }
});

// Trigger the next event in the sequence
callsheetControlsRouter.post('/callsheet/next', async (req, res, next) => {
    try {
        const nextEvent = await getNextEvent();
        if (!nextEvent) {
            return res.status(404).json({ message: 'No next event found.' });
        }
        const event = await setActiveEvent(nextEvent.id, nextEvent.productionId);
        return res.status(200).json(event);
    } catch (err) {
        return next(err);
    }
});

// Trigger the previous event in the sequence
callsheetControlsRouter.post('/callsheet/previous', async (req, res, next) => {
    try {
        const prevEvent = await getPreviousEvent();
        if (!prevEvent) {
            return res.status(404).json({ message: 'No previous event found.' });
        }
        const event = await setActiveEvent(prevEvent.id, prevEvent.productionId);
        return res.status(200).json(event);
    } catch (err) {
        return next(err);
    }
});

// Endpoint for the scoreboard to push its time to
callsheetControlsRouter.post('/callsheet/update-scoreboard-time', (req, res) => {
    const { timeInSeconds } = req.body;
    if (typeof timeInSeconds !== 'number') {
        return res.status(400).json({ error: 'timeInSeconds must be a number.' });
    }
    updateScoreboardClock(timeInSeconds);
    return res.status(200).json({ message: 'Scoreboard time updated.' });
});
