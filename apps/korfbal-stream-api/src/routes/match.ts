import {Router} from 'express';
import {logger} from '../utils/logger';
import {prisma} from '../services/prisma';
import {matchScheduleProvider} from '../services/matchSchedule';

export const matchRouter: Router = Router();

// POST /api/match/matches/schedule/import
matchRouter.post('/matches/schedule/import', async (req, res) => {
  try {
    const date = (req.query.date as string) || '20-weeks';
    const location = (req.query.location as string) || undefined;

    const items = await matchScheduleProvider.fetchMatches({date, location});

    let inserted = 0;
    let updated = 0;

    for (const data of items) {
      const existing = await prisma.matchSchedule.findUnique({where: {externalId: data.externalId}});
      if (existing) {
        await prisma.matchSchedule.update({where: {externalId: data.externalId}, data});
        updated++;
      } else {
        await prisma.matchSchedule.create({data});
        inserted++;
      }
    }

    logger.info('Program import: persistence summary', {inserted, updated, total: items.length} as any);
    return res.json({ok: true, inserted, updated, total: items.length});
  } catch (err: any) {
    logger.error('Program import failed', {error: err?.message});
    return res.status(502).json({error: 'Failed to import program'});
  }
});

// GET /api/match/matches/schedule
matchRouter.get('/matches/schedule', async (req, res) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const location = ((req.query.location as string) || 'HOME').toUpperCase();

    const dayStart = new Date(dateStr + 'T00:00:00.000Z');
    const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

    const locationWhere: any = {};
    if (location === 'HOME') {
      locationWhere.isHomeMatch = true;
    } else if (location === 'AWAY') {
      locationWhere.isHomeMatch = false;
    }

    const matches = await prisma.matchSchedule.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        OR: [
          { isManual: true },
          locationWhere
        ]
      },
      orderBy: { date: 'asc' }
    });

    logger.info('Program list', { date: dateStr, location, count: matches.length } as any);
    return res.json({ items: matches, count: matches.length, date: dateStr });
  } catch (err: any) {
    logger.error('Program list failed', { error: err?.message });
    return res.status(500).json({ error: 'Failed to list program' });
  }
});

export default matchRouter;
