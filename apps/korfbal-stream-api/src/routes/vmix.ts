import { Router } from 'express';
import { prisma } from '../services/prisma';
import { logger } from '../utils/logger';

export const vmixRouter = Router();

// GET /api/vmix/sponsor-names
// Returns a JSON object with the concatenated sponsor names string under the
// property "sponsor-names". The value uses three spaces, a vertical bar, and
// three spaces as separator ("   |   ") and includes a trailing separator.
vmixRouter.get('/sponsor-names', async (_req, res, next) => {
  try {
    const sponsors = await prisma.sponsor.findMany({ orderBy: { id: 'asc' } });
    const names = sponsors.map((s) => (s.name || '').trim()).filter(Boolean);
    const sep = '   |   ';
    const ticker = names.length > 0 ? names.join(sep) + sep : '';
    return res.status(200).json({ 'sponsor-names': ticker });
  } catch (err) {
    logger.error('GET /vmix/sponsor-names failed', err as any);
    return next(err);
  }
});

export default vmixRouter;
