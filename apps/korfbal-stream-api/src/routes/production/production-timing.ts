import {Router} from 'express';
import {prisma} from '../../services/prisma';

export const productionTimingRouter: Router = Router();

// -------- Timing preview for a production --------
productionTimingRouter.get('/:id/timing', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id }, include: { matchSchedule: true } });
    if (!prod) return res.status(404).json({ error: 'Not found' });
    const segments = await prisma.productionSegment.findMany({ where: { productionId: id }, orderBy: { volgorde: 'asc' } });
    if (segments.length === 0) return res.json([]);

    const anchorIdx = segments.findIndex((s) => s.isTimeAnchor);
    if (anchorIdx === -1) return res.status(400).json({ error: 'No anchor segment defined' });

    const anchorStart = new Date(prod.matchSchedule.date).getTime();

    const result = segments.map((s) => ({ ...s, start: '', end: '' }));

    // forward from anchor
    let t = anchorStart;
    for (let i = anchorIdx; i < result.length; i++) {
      result[i].start = new Date(t).toISOString();
      t += result[i].duurInMinuten * 60 * 1000;
      result[i].end = new Date(t).toISOString();
    }

    // backward before anchor
    t = anchorStart;
    for (let i = anchorIdx - 1; i >= 0; i--) {
      t -= result[i].duurInMinuten * 60 * 1000;
      result[i].start = new Date(t).toISOString();
      result[i].end = new Date(t + result[i].duurInMinuten * 60 * 1000).toISOString();
    }

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/next-date
// Returns the date of the next upcoming production (or today if none)
productionTimingRouter.get('/next-date', async (req, res, next) => {
  try {
    const now = new Date();
    // Find the first production with a match date >= now
    const nextProd = await prisma.production.findFirst({
      where: {
        matchSchedule: {
          date: {
            gte: now
          }
        }
      },
      orderBy: {
        matchSchedule: {
          date: 'asc'
        }
      },
      include: {
        matchSchedule: true
      }
    });

    if (nextProd) {
      // Return date part only (YYYY-MM-DD)
      const dateStr = nextProd.matchSchedule.date.toISOString().split('T')[0];
      return res.json({ date: dateStr });
    }

    // Fallback to today if no future production found
    return res.json({ date: now.toISOString().split('T')[0] });
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/dates
// Returns a list of all dates that have at least one production
productionTimingRouter.get('/dates', async (req, res, next) => {
  try {
    const productions = await prisma.production.findMany({
      select: {
        matchSchedule: {
          select: {
            date: true
          }
        }
      },
      orderBy: {
        matchSchedule: {
          date: 'asc'
        }
      }
    });

    // Extract unique dates (YYYY-MM-DD)
    const dates = new Set<string>();
    for (const p of productions) {
      if (p.matchSchedule?.date) {
        dates.add(p.matchSchedule.date.toISOString().split('T')[0]);
      }
    }

    return res.json(Array.from(dates));
  } catch (err) {
    return next(err);
  }
});
