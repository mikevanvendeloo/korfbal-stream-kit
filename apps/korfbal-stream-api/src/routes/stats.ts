import {NextFunction, Request, Response, Router} from 'express';
import {z} from 'zod';
import {derivePlayerStats, teamNamesOf} from '../services/stats/matchActions';
import {getLiveStats} from '../services/stats/liveStats';
import {listStatsMatches, readMatchActions, readStatsPlayers} from '../services/stats/mdbFile';
import {derivedPlayerRows, livePlayerRows} from '../services/stats/flatRows';
import {StatsError} from '../services/stats/statsErrors';

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

const LiveQuery = z.object({
  team: z.enum(['home', 'away']),
  vak: z.coerce.number().int().min(1).max(4).optional(),
});

// GET /api/stats/live
statsRouter.get('/live', wrap(async (_req, res) => res.json(await getLiveStats())));

// GET /api/stats/live/players?team=home|away&vak=1
statsRouter.get('/live/players', wrap(async (req, res) => {
  const q = LiveQuery.parse({team: req.query.team, vak: req.query.vak});
  return res.json(livePlayerRows(await getLiveStats(), q.team, q.vak));
}));

// GET /api/stats/matches
statsRouter.get('/matches', wrap(async (_req, res) => res.json(await listStatsMatches())));

const TableParam = z.string().min(1).max(200);

// GET /api/stats/matches/:table/actions
statsRouter.get('/matches/:table/actions', wrap(async (req, res) => {
  const table = TableParam.parse(req.params.table);
  return res.json((await readMatchActions(table)).filter((r) => r.optelveld !== 0));
}));

// GET /api/stats/matches/:table/players
statsRouter.get('/matches/:table/players', wrap(async (req, res) => {
  const table = TableParam.parse(req.params.table);
  const rows = await readMatchActions(table);
  const teams = teamNamesOf(rows);
  return res.json({teams, players: derivedPlayerRows(derivePlayerStats(rows)).map((p) => ({...p, teamName: p.team === 'home' ? teams.own : teams.opponent}))});
}));

const PLAYER_COLUMNS = ['SPELERSNAAM', 'NUMMER', 'vereniging', 'SEX', 'afstandschotgoal', 'afstandschottotaal', 'doorloopgoal', 'doorlooptotaal', 'kortschotgoal', 'kortschottotaal', 'vrijebalgoal', 'vrijebaltotaal', 'strafworpgoal', 'strafworptotaal', 'totaalgoals', 'totaalpogingen', 'reboundgewonnen', 'reboundtotaal', 'aangeef'];

// GET /api/stats/players
statsRouter.get('/players', wrap(async (_req, res) => {
  const rows = await readStatsPlayers();
  return res.json(rows.map((r) => Object.fromEntries(PLAYER_COLUMNS.filter((c) => c in r).map((c) => [c, r[c] instanceof Date ? (r[c] as Date).toISOString() : r[c]]))));
}));
