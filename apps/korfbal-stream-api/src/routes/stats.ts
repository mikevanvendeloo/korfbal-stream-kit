import {NextFunction, Request, Response, Router} from 'express';
import {z} from 'zod';
import {derivePlayerStats, teamNamesOf} from '../services/stats/matchActions';
import {getLiveStats} from '../services/stats/liveStats';
import type {Sourced} from '../services/stats/mdbFile';
import {listStatsMatches, readMatchActions, readStatsPlayers} from '../services/stats/mdbFile';
import {derivedPlayerRows, livePlayerRows} from '../services/stats/flatRows';
import {StatsError} from '../services/stats/statsErrors';
import {statsConnection} from '../services/stats/connectionTest';

/** Match statistics from the statistics PC: the live page and the Access database. Feed routes (API key). */
export const statsRouter: Router = Router();

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof StatsError) return res.status(err.status).json({error: err.message});
    if (err instanceof z.ZodError) return res.status(400).json({error: err.issues[0]?.message || 'Ongeldige invoer'});
    return next(err);
  }
};

/** Arrays stay plain arrays (vMix data sources); where the data came from goes in headers. */
function sendSourced<T>(res: Response, result: Sourced<T>, body: unknown = result.data) {
  res.setHeader('X-Stats-Source', result.source);
  res.setHeader('X-Stats-Read-At', result.readAt);
  return res.json(body);
}

const LiveQuery = z.object({
  team: z.enum(['home', 'away']),
  vak: z.coerce.number().int().min(1).max(4).optional(),
});

// GET /api/stats/live
// Connection test: the statistics PC on the network (SMB port), the database file and the page; ok/failed only
statsRouter.get('/status', wrap(async (_req, res) => res.json(await statsConnection())));

statsRouter.get('/live', wrap(async (_req, res) => res.json(await getLiveStats())));

// GET /api/stats/live/players?team=home|away&vak=1
statsRouter.get('/live/players', wrap(async (req, res) => {
  const q = LiveQuery.parse({team: req.query.team, vak: req.query.vak});
  return res.json(livePlayerRows(await getLiveStats(), q.team, q.vak));
}));

// GET /api/stats/matches
statsRouter.get('/matches', wrap(async (_req, res) => sendSourced(res, await listStatsMatches())));

const TableParam = z.string().min(1).max(200);

// GET /api/stats/matches/:table/actions
statsRouter.get('/matches/:table/actions', wrap(async (req, res) => {
  const table = TableParam.parse(req.params.table);
  const result = await readMatchActions(table);
  return sendSourced(res, result, result.data.filter((r) => r.optelveld !== 0));
}));

// GET /api/stats/matches/:table/players
statsRouter.get('/matches/:table/players', wrap(async (req, res) => {
  const table = TableParam.parse(req.params.table);
  const {source, readAt, data: rows} = await readMatchActions(table);
  const teams = teamNamesOf(rows);
  return res.json({source, readAt, teams, players: derivedPlayerRows(derivePlayerStats(rows), teams)});
}));

const PLAYER_COLUMNS = ['SPELERSNAAM', 'NUMMER', 'vereniging', 'SEX', 'afstandschotgoal', 'afstandschottotaal', 'doorloopgoal', 'doorlooptotaal', 'kortschotgoal', 'kortschottotaal', 'vrijebalgoal', 'vrijebaltotaal', 'strafworpgoal', 'strafworptotaal', 'totaalgoals', 'totaalpogingen', 'reboundgewonnen', 'reboundtotaal', 'aangeef'];

// GET /api/stats/players
statsRouter.get('/players', wrap(async (_req, res) => {
  const result = await readStatsPlayers();
  return sendSourced(res, result, result.data.map((r) => Object.fromEntries(PLAYER_COLUMNS.filter((c) => c in r).map((c) => [c, r[c] instanceof Date ? (r[c] as Date).toISOString() : r[c]]))));
}));

// GET /api/stats/current/players: the newest match of the database (share or local copy); when neither is
// readable, the player rows of the live page. Same flat rows either way, with `source` and `readAt`.
statsRouter.get('/current/players', wrap(async (_req, res) => {
  try {
    const list = await listStatsMatches();
    const newest = list.data[0];
    if (!newest) throw new StatsError(404, 'Geen wedstrijden in het statistiekenbestand');
    const {source, readAt, data: rows} = await readMatchActions(newest.table);
    const teams = teamNamesOf(rows);
    const out = derivedPlayerRows(derivePlayerStats(rows), teams).map((p) => ({...p, source, readAt}));
    return sendSourced(res, {source, readAt, data: out}, out);
  } catch (err) {
    if (!(err instanceof StatsError)) throw err;
    let page;
    try {
      page = await getLiveStats();
    } catch {
      throw new StatsError(503, 'Geen statistieken beschikbaar: het bestand en de statistiekenpagina zijn niet bereikbaar');
    }
    const readAt = new Date().toISOString();
    const out = [...livePlayerRows(page, 'home'), ...livePlayerRows(page, 'away')].map((p) => ({...p, source: 'page' as const, readAt}));
    res.setHeader('X-Stats-Source', 'page');
    res.setHeader('X-Stats-Read-At', readAt);
    return res.json(out);
  }
}));
