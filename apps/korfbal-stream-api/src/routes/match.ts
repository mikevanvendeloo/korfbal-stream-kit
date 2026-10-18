import {Router} from 'express';
import {logger} from '../utils/logger';
import {prisma} from '../services/prisma';
import {fetchFromMatchSource, MatchSourceError, type NormalizedMatchItem, sendMatchImportError} from '../services/matchSchedule';
import {INDOOR_IMPORT_DATE, MatchScheduleImportQuerySchema} from '../schemas/matchSchedule';
import {createSeasonIdResolver, getActiveSeason, seasonNameForStartYear, seasonStartYearForDate} from '../services/season';
import {dateColumnToIsoDay} from '../utils/dayDate';
import {amsterdamDay, amsterdamDayRange, amsterdamInputToDate} from '../utils/time';

export const matchRouter: Router = Router();

// POST /api/match/matches/schedule/import?date=&location=
// date: DD-MM-YYYY or YYYY-MM-DD (from that day through the end of the published programme), N-weeks
// (from the current week; default 30-weeks) or `indoor` (from the indoor competition start date of
// the active season). Failures answer {ok: false, error, code, hint} (services/apiErrorCodes.ts).
matchRouter.post('/matches/schedule/import', async (req, res) => {
  try {
    const query = MatchScheduleImportQuerySchema.safeParse(req.query);
    if (!query.success) {
      const issue = query.error.issues[0];
      if (issue?.path[0] === 'date') return sendMatchImportError(res, 'INVALID_DATE', issue.code === 'custom' ? issue.message : undefined);
      return res.status(400).json({ok: false, error: issue?.message || 'Invalid query'});
    }
    let {date} = query.data;
    const {location} = query.data;
    if (date === INDOOR_IMPORT_DATE) {
      const season = await getActiveSeason();
      const indoorStart = dateColumnToIsoDay(season.indoorStartDate);
      if (!indoorStart) {
        return res.status(400).json({
          ok: false, code: 'INVALID_DATE',
          error: `De startdatum van de zaalcompetitie is niet ingesteld voor seizoen ${season.name}`,
          hint: 'Stel de startdatum van de zaalcompetitie in bij Seizoenen (Instellingen → Seizoen).',
        });
      }
      date = indoorStart;
    }

    const items = await fetchFromMatchSource({date, location});

    // Resolve (and create when missing) each match's season, derived from the match date, before
    // the transaction: seasons are idempotent, so one left over after a rolled-back import is harmless,
    // and a unique-constraint retry inside the transaction would abort it.
    const seasons = createSeasonIdResolver();
    // Imported matches per season, so the UI can say where they landed.
    const bySeasonStartYear = new Map<number, { seasonId: number; name: string; count: number }>();
    const rows: Array<NormalizedMatchItem & {seasonId: number}> = [];
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
          const existing = await tx.matchSchedule.findFirst({where: {externalId: data.externalId}, select: {id: true}});
          if (existing) {
            await tx.matchSchedule.update({where: {id: existing.id}, data});
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
    logger.info('Program import done', {date, fetched: items.length, created: inserted, updated, bySeason});
    return res.json({ok: true, date, inserted, updated, total: items.length, bySeason});
  } catch (err: any) {
    if (err instanceof MatchSourceError) return sendMatchImportError(res, err.code);
    logger.error('Program import failed', {error: err?.message});
    return res.status(500).json({ok: false, error: 'Wedstrijden opslaan mislukt'});
  }
});

// GET /api/match/matches/schedule
matchRouter.get('/matches/schedule', async (req, res) => {
  try {
    const dateStr = req.query.date == null || req.query.date === '' ? amsterdamDay(new Date()) : String(req.query.date);
    if (req.query.location !== undefined && typeof req.query.location !== 'string') return res.status(400).json({error: 'Invalid location'});
    const location = (req.query.location || 'HOME').toUpperCase();
    if (!amsterdamInputToDate(dateStr) || dateStr.length !== 10) return res.status(400).json({error: 'Invalid date (YYYY-MM-DD)'});

    // The Amsterdam day, whatever the server's zone
    const {start: dayStart, end: nextDay} = amsterdamDayRange(dateStr);
    const dayEnd = new Date(nextDay.getTime() - 1);

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
