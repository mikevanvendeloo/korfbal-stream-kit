import {Router} from 'express';
import {requireOrganizationId} from '../services/organizationContext';
import {venueBridgeStatus} from '../services/venueData';

/** The venue-bridge's connection state, for the kit and for devices with a feed key. */
export const venueBridgeRouter: Router = Router();

// GET /api/venue-bridge/status
venueBridgeRouter.get('/status', (_req, res) => res.json(venueBridgeStatus(requireOrganizationId('venue-bridge status'))));
