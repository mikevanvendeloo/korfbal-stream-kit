import {Router, type Request, type Response} from 'express';
import {enrichShotclock, type VenueDevice} from '@korfbal-stream-kit/venue-protocol';
import {requireOrganizationId} from '../services/organizationContext';
import {currentReading, latestReading} from '../services/venueData';

/**
 * The scoreboard, the venue clock and the shot clock as the venue-bridge last read them (it sits at the venue;
 * the API never asks the devices itself).
 */
export const scoreboardRouter: Router = Router();

function deviceRoute(device: VenueDevice, label: string, transform: (data: unknown[]) => unknown[] = (data) => data) {
  return (_req: Request, res: Response) => {
    const organizationId = requireOrganizationId('scoreboard');
    const reading = currentReading(organizationId, device);
    if (reading) return res.json(transform(reading.data));
    // A device that answers something else than an array is a different failure from one that does not answer
    if (latestReading(organizationId, device)?.error === 'invalid') return res.status(502).json({error: `Invalid response format from ${label}`});
    return res.status(502).json({error: `Failed to fetch ${label}`});
  };
}

// GET /api/scoreboard
scoreboardRouter.get('/', deviceRoute('score', 'scoreboard'));

// GET /api/scoreboard/shotclock
scoreboardRouter.get('/shotclock', deviceRoute('shotclock', 'shotclock', enrichShotclock));

// GET /api/scoreboard/clock
scoreboardRouter.get('/clock', deviceRoute('clock', 'scoreboard clock'));

export default scoreboardRouter;
