import {Router} from 'express';
import {prisma} from '../../services/prisma';
import {getCurrentState, liveStateSnapshot} from '../../services/productionState';
import {resolveSeasonId} from '../../services/season';
import {amsterdamDay} from '../../utils/time';
import {productionChapterTimings} from '../../services/productionTiming';

export const productionTimingRouter: Router = Router();

// -------- Timing preview for a production --------
productionTimingRouter.get('/:id/timing', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id }, include: { matchSchedule: true } });
    if (!prod) return res.status(404).json({ error: 'Not found' });
    // The hoofdstukken with their times from the items (openspec/changes/chapters D1)
    return res.json(await productionChapterTimings(id, prod.matchSchedule.date));
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/:id/clocks
productionTimingRouter.get('/:id/clocks', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

        const state = getCurrentState();
        // Als we geen actieve productie in de state hebben, zetten we die hier even goed
        // zodat de frontend de juiste context heeft.
        if (!state.productionId) {
            state.productionId = id;
        }

        return res.json(liveStateSnapshot());
    } catch (err) {
        return next(err);
    }
});

// GET /api/production/next-date
// Returns the date of the next upcoming production (or today if none).
// Deliberately not season-scoped: it looks forward from today, whichever season that falls in.
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
      const dateStr = amsterdamDay(nextProd.matchSchedule.date);
      return res.json({ date: dateStr });
    }

    // Fallback to today if no future production found
    return res.json({ date: amsterdamDay(now) });
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/dates?seasonId=
// Returns a list of all dates that have at least one production in the season (default: active season)
productionTimingRouter.get('/dates', async (req, res, next) => {
  try {
    const seasonId = await resolveSeasonId(req.query.seasonId);
    const productions = await prisma.production.findMany({
      where: { matchSchedule: { seasonId } },
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
        dates.add(amsterdamDay(p.matchSchedule.date));
      }
    }

    return res.json(Array.from(dates));
  } catch (err) {
    return next(err);
  }
});
