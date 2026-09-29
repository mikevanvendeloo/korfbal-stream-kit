import {Router} from 'express';
import {z} from 'zod';
import {logger} from '../utils/logger';
import {prisma} from '../services/prisma';
import {getMatchScheduleProvider, InvalidMatchScheduleResponseError} from '../services/matchSchedule';
import {MatchScheduleImportQuerySchema} from '../schemas/matchSchedule';
import {createSeasonIdResolver, seasonNameForStartYear, seasonStartYearForDate} from '../services/season';

export const matchRouter: Router = Router();

// POST /api/match/matches/schedule/import
matchRouter.post('/matches/schedule/import', async (req, res) => {
  try {
    const {date, location} = MatchScheduleImportQuerySchema.parse(req.query);

    const items = await getMatchScheduleProvider().fetchMatches({date, location});

    // Resolve (and create when missing) each match's season, derived from the match date, before
    // the transaction: seasons are idempotent, so one left over after a rolled-back import is harmless,
    // and a unique-constraint retry inside the transaction would abort it.
    const seasons = createSeasonIdResolver();
    // Imported matches per season, so the UI can say where they landed.
    const bySeasonStartYear = new Map<number, { seasonId: number; name: string; count: number }>();
    const rows = [];
    for (const item of items) {
      const startYear = seasonStartYearForDate(item.date);
      const seasonId = await seasons.forStartYear(startYear);
      const seasonCount = bySeasonStartYear.get(startYear) ?? {seasonId, name: seasonNameForStartYear(startYear), count: 0};
      seasonCount.count++;
      bySeasonStartYear.set(startYear, seasonCount);
      rows.push({...item, seasonId});
    }

    // One transaction, so a failing row can't leave a half-imported schedule behind
    const {inserted, updated} = await prisma.$transaction(
      async (tx) => {
        let inserted = 0;
        let updated = 0;
        for (const data of rows) {
          const existing = await tx.matchSchedule.findUnique({where: {externalId: data.externalId}});
          if (existing) {
            await tx.matchSchedule.update({where: {externalId: data.externalId}, data});
            updated++;
          } else {
            await tx.matchSchedule.create({data});
            inserted++;
          }
        }
        return {inserted, updated};
      },
      // A 20-week import is a few hundred rows - well past the 5s default
      {timeout: 60_000}
    );

    const bySeason = [...bySeasonStartYear.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, seasonCount]) => seasonCount);
    logger.info('Program import: persistence summary', {inserted, updated, total: items.length, bySeason} as any);
    return res.json({ok: true, inserted, updated, total: items.length, bySeason});
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({error: err.issues?.[0]?.message || 'Invalid query'});
    logger.error('Program import failed', {error: err?.message});
    if (err instanceof InvalidMatchScheduleResponseError) return res.status(502).json({error: err.message});
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
