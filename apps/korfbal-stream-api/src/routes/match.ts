import {Router} from 'express';
import axios from 'axios';
import {config} from '../services/config';
import {logger} from '../utils/logger';
import {prisma} from '../services/prisma';

export const matchRouter: Router = Router();

type Privacy = 'FULL_NAME' | 'FIRST_NAME' | 'LAST_NAME' | 'HIDDEN';

const teamColors: Record<string, string> = {
  J1: 'red',
  J2: 'red',
  J3: 'red',
  J4: 'yellow',
  J5: 'red',
  J6: 'yellow',
  J7: 'yellow',
  J8: 'yellow',
  J9: 'yellow',
  J10: 'green',
  J11: 'yellow',
  J12: 'green',
  J13: 'green',
  J14: 'green',
  J15: 'green',
  J16: 'green',
  J17: 'green',
  J18: 'green',
  J19: 'blue',
  J20: 'blue',
  J21: 'blue',
  J22: 'blue',
  J23: 'blue',
};

function colorForTeam(name?: string | null): string | undefined {
  if (!name) return undefined;
  // Expect names like "Fortuna/Ruitenheer J1" etc
  const m = name.match(/Fortuna\/Ruitenheer\s+J(\d+)/i);
  if (!m) return undefined;
  const key = `J${m[1]}`.toUpperCase();
  return teamColors[key];
}

function refereeDisplay(user?: { privacy?: Privacy; fullName?: string } | null): string | undefined {
  if (!user || !user.privacy) return undefined;
  const full = (user.fullName || '').trim();
  if (!full) return undefined;
  const [first, ...rest] = full.split(' ');
  const last = rest.join(' ').trim();
  switch (user.privacy) {
    case 'FULL_NAME':
      return full;
    case 'FIRST_NAME':
      return first || undefined;
    case 'LAST_NAME':
      return last || undefined;
    case 'HIDDEN':
    default:
      return undefined;
  }
}

// Derive a single referee name honoring privacy and falling back to provider name
function pickRefereeName(item: any): string | null {
  const user = item?.refereeAssignment?.user;
  const privacy = user?.privacy?.toUpperCase?.();
  // Honor privacy: FULL_NAME -> full, FIRST_NAME -> first, LAST_NAME -> last, HIDDEN -> masked
  if (privacy) {
    if (privacy === 'HIDDEN') return 'Afgeschermd';
    const disp = refereeDisplay(user);
    if (disp) return disp;
  }
  // No explicit privacy provided: use full name if present
  const fromAssignment: string | undefined = user?.fullName;
  if (fromAssignment && fromAssignment.trim()) return fromAssignment.trim();
  // Fallback to provider name if available and not already masked
  const provider: string | undefined = item?.refereeProviderName;
  if (provider && provider.trim() && provider !== 'Afgeschermd') return provider.trim();
  return null;
}

// Normalize field display: remove everything up to and including the first '-' and trim
function cleanField(name?: string | null): string | undefined {
  if (!name) return undefined;
  const trimmed = String(name).trim();
  const parts = trimmed.split('-');
  if (parts.length > 1) {
    return parts.slice(1).join('-').trim();
  }
  return trimmed;
}

// POST /api/match/matches/schedule/import
matchRouter.post('/matches/schedule/import', async (req, res) => {
  try {
    const date = (req.query.date as string) || '20-weeks';
    const location = (req.query.location as string);

    const url = new URL(`${config.matchScheduleBaseUrl.replace(/\/$/, '')}/programs`);
    url.searchParams.set('date', date);
    url.searchParams.set('reserves', 'false');
    if(location != undefined) url.searchParams.set('location', location);
    url.searchParams.set('levelType', 'ALL');
    url.searchParams.set('sortBy', 'time');

    const headers: Record<string, string> = { accept: 'application/json' };
    if (config.matchScheduleApiToken) headers['Authorization'] = `Bearer ${config.matchScheduleApiToken}`;

    logger.info("Requesting match schedule using URL " + url.toString())
    const response = await axios.get(url.toString(), { headers, timeout: 10000 });

    if (!response.data) {
      // Avoid logging entire axios response (circular refs). Log safe details only.
      try {
        logger.error('Invalid response format from program API', {
          status: (response as any)?.status,
          url: url.toString(),
          contentType: (response as any)?.headers?.['content-type'],
          dataType: Array.isArray((response as any)?.data) ? 'array' : typeof (response as any)?.data,
        } as any);
      } catch (_) {
        // swallow logging errors
      }
      return res.status(502).json({ error: 'Invalid response format from program API' });
    }

    // API can return either an array of items or an object keyed by ISO date with arrays as values
    const isArray = Array.isArray(response.data);
    const isObject = !!response.data && typeof response.data === 'object' && !isArray;

    // Log counts per date based on the raw shape
    try {
      if (isObject) {
        const entries = Object.entries(response.data as Record<string, any>);
        const totals = entries
          .filter(([, v]) => Array.isArray(v))
          .map(([date, arr]) => ({ date, count: (arr as any[]).length }))
          .sort((a, b) => a.date.localeCompare(b.date));
        logger.info('Program import: received object keyed by date', {
          dateCount: totals.length,
          totalItems: totals.reduce((sum, t) => sum + t.count, 0),
          perDate: totals,
        } as any);
      } else if (isArray) {
        const arr = response.data as any[];
        const byDate: Record<string, number> = {};
        for (const it of arr) {
          const d = (it?.date ? String(it.date) : '').slice(0, 10);
          if (!d) continue;
          byDate[d] = (byDate[d] || 0) + 1;
        }
        const perDate = Object.entries(byDate)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));
        logger.info('Program import: received array, grouped by item.date', {
          dateCount: perDate.length,
          totalItems: arr.length,
          perDate,
        } as any);
      }
    } catch (_) {
      // ignore logging failures
    }

    const items: any[] = isArray
      ? (response.data as any[])
      : isObject
        ? Object.values(response.data).filter((v: any) => Array.isArray(v)).flat()
        : [];

    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      const externalId: string = item.id;
      if (!externalId) continue;
      const color = colorForTeam(item?.homeTeamName) || colorForTeam(item?.homeTeam?.name) || undefined;
      const referee = pickRefereeName(item);
      const reserveReferee = refereeDisplay(item?.reserveRefereeAssignment?.user);

      const data = {
        externalId,
        date: new Date(item.date),
        homeTeamName: item.homeTeamName,
        awayTeamName: item.awayTeamName,
        accommodationName: item.accommodation?.name || null,
        accommodationRoute: item.accommodation?.route || null,
        attendanceTime: item.attendanceTime ? new Date(item.attendanceTime) : null,
        isPracticeMatch: !!item.isPracticeMatch,
        isHomeMatch: !!item.isHomeMatch,
        isCompetitiveMatch: !!item.isCompetitiveMatch,
        fieldName: cleanField(item.fieldName) || null,
        refereeName: referee || null,
        reserveRefereeName: reserveReferee || null,
        color: color || null,
      } as const;

      const existing = await prisma.matchSchedule.findUnique({ where: { externalId } });
      if (existing) {
        await prisma.matchSchedule.update({ where: { externalId }, data });
        updated++;
      } else {
        await prisma.matchSchedule.create({ data });
        inserted++;
      }
    }

    try {
      logger.info('Program import: persistence summary', { inserted, updated, total: items.length } as any);
    } catch (_) {}
    return res.json({ ok: true, inserted, updated, total: items.length });
  } catch (err: any) {
    logger.error('Program import failed', { error: err?.message });
    return res.status(502).json({ error: 'Failed to import program' });
  }
});

// GET /api/match/matches/schedule
matchRouter.get('/matches/schedule', async (req, res) => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const location = ((req.query.location as string) || 'HOME').toUpperCase();

    const dayStart = new Date(dateStr + 'T00:00:00.000Z');
    const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

    const where: any = { date: { gte: dayStart, lte: dayEnd } };
    if (location === 'HOME') where.isHomeMatch = true;
    else if (location === 'AWAY') where.isHomeMatch = false;

    const matches = await prisma.matchSchedule.findMany({ where, orderBy: { date: 'asc' } });
    logger.info('Program list', { date: dateStr, location, count: matches.length } as any);
    return res.json({ items: matches, count: matches.length, date: dateStr });
  } catch (err: any) {
    logger.error('Program list failed', { error: err?.message });
    return res.status(500).json({ error: 'Failed to list program' });
  }
});






export default matchRouter;
