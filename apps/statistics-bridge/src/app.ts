import crypto from 'node:crypto';
import express, {NextFunction, Request, Response} from 'express';
import {z} from 'zod';
import {config} from './config';
import {logger} from './logger';
import {derivePlayerStats, teamNamesOf} from './services/matchActions';
import {getLiveStats} from './services/liveStats';
import {DatabaseUnavailableError, listStatsMatches, readMatchActions, readStatsPlayers, type Sourced} from './services/mdbFile';
import {derivedPlayerRows, livePlayerRows, pagePlayersAsDerived} from './services/flatRows';
import {currentPlayers} from './services/currentPlayers';
import {statsConnection} from './services/connectionTest';
import {StatsError} from './services/statsErrors';
import type {TweedeScherm} from './services/tweedeScherm';

export const TOKEN_HEADER = 'x-bridge-token';

function tokenMatches(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  // Hash both sides: timingSafeEqual needs equal lengths and the length of the secret stays hidden
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Every route but /health needs the shared secret when BRIDGE_TOKEN is set. */
function requireToken(req: Request, res: Response, next: NextFunction) {
  const expected = config.bridgeToken;
  if (!expected || req.path === '/health') return next();
  if (tokenMatches(req.header(TOKEN_HEADER), expected)) return next();
  return res.status(401).json({error: 'Bridge-token ontbreekt of is ongeldig'});
}

const TeamQuery = z.string().regex(/^\d{1,2}$/, 'Ongeldig teamnummer');
const teamOf = (req: Request): string => (req.query.team === undefined ? '1' : TeamQuery.parse(req.query.team));

const LiveQuery = z.object({
  team: z.enum(['home', 'away']),
  vak: z.coerce.number().int().min(1).max(4).optional(),
});
const TableParam = z.string().min(1).max(200);

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
function setSourceHeaders(res: Response, source: string, readAt: string, team: {value: string} | null, database?: 'disabled' | 'unreachable') {
  res.setHeader('X-Stats-Source', source);
  res.setHeader('X-Stats-Read-At', readAt);
  if (team) res.setHeader('X-Stats-Team', team.value);
  if (database) res.setHeader('X-Stats-Database', database);
}

function sendSourced<T>(res: Response, result: Sourced<T>, body: unknown = result.data) {
  setSourceHeaders(res, result.source, result.readAt, result.team);
  return res.json(body);
}

/** The page as stand-in when the database is off or cannot be read; its own failure is the answer then. */
async function pageOrOffline(): Promise<TweedeScherm> {
  try {
    return await getLiveStats();
  } catch {
    throw new StatsError(503, 'Geen statistieken beschikbaar: de database en de statistiekenpagina zijn niet bereikbaar');
  }
}

const databaseReason = (err: DatabaseUnavailableError) => err.reason;

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requireToken);

  // Process is up (no token, no share, no page: the container healthcheck)
  app.get('/health', (_req, res) => res.json({ok: true}));

  // Connection test: the statistics PC on the network, the database file, the page; ok/failed only
  app.get('/status', wrap(async (req, res) => res.json(await statsConnection(teamOf(req)))));

  app.get('/live', wrap(async (_req, res) => res.json(await getLiveStats())));

  app.get('/live/players', wrap(async (req, res) => {
    const q = LiveQuery.parse({team: req.query.team, vak: req.query.vak});
    return res.json(livePlayerRows(await getLiveStats(), q.team, q.vak));
  }));

  // The match tables; without a usable database one entry for the live page
  app.get('/matches', wrap(async (req, res) => {
    try {
      return sendSourced(res, await listStatsMatches(teamOf(req)));
    } catch (err) {
      if (!(err instanceof DatabaseUnavailableError)) throw err;
      const page = await pageOrOffline();
      const readAt = new Date().toISOString();
      setSourceHeaders(res, 'page', readAt, null, databaseReason(err));
      return res.json([{table: 'live', home: page.home.name, away: page.away.name, date: page.date, source: 'page'}]);
    }
  }));

  app.get('/matches/:table/actions', wrap(async (req, res) => {
    const table = TableParam.parse(req.params.table);
    const result = await readMatchActions(teamOf(req), table);
    return sendSourced(res, result, result.data.filter((r) => r.optelveld !== 0));
  }));

  app.get('/matches/:table/players', wrap(async (req, res) => {
    const table = TableParam.parse(req.params.table);
    const team = teamOf(req);
    try {
      const {source, readAt, team: chosen, data: rows} = await readMatchActions(team, table);
      const teams = teamNamesOf(rows);
      return res.json({source, readAt, team: chosen, teams, players: derivedPlayerRows(derivePlayerStats(rows), teams)});
    } catch (err) {
      // The synthetic "live" match: the page's players, whole match
      if (!(err instanceof DatabaseUnavailableError) || table !== 'live') throw err;
      const page = await pageOrOffline();
      const teams = {own: page.home.name, opponent: page.away.name};
      return res.json({source: 'page', readAt: new Date().toISOString(), team: null, database: databaseReason(err), teams, players: derivedPlayerRows(pagePlayersAsDerived(page), teams)});
    }
  }));

  const PLAYER_COLUMNS = ['SPELERSNAAM', 'NUMMER', 'vereniging', 'SEX', 'afstandschotgoal', 'afstandschottotaal', 'doorloopgoal', 'doorlooptotaal', 'kortschotgoal', 'kortschottotaal', 'vrijebalgoal', 'vrijebaltotaal', 'strafworpgoal', 'strafworptotaal', 'totaalgoals', 'totaalpogingen', 'reboundgewonnen', 'reboundtotaal', 'aangeef'];

  app.get('/players', wrap(async (req, res) => {
    const result = await readStatsPlayers(teamOf(req));
    return sendSourced(res, result, result.data.map((r) => Object.fromEntries(PLAYER_COLUMNS.filter((c) => c in r).map((c) => [c, r[c] instanceof Date ? (r[c] as Date).toISOString() : r[c]]))));
  }));

  // The match with the latest action from the database; without a usable database the page's player rows
  app.get('/current/players', wrap(async (req, res) => {
    try {
      const current = await currentPlayers(teamOf(req));
      setSourceHeaders(res, current.source, current.readAt, current.team);
      return res.json(current.rows);
    } catch (err) {
      // A refused path (400) is a configuration error, not a reason for the page
      if (!(err instanceof StatsError) || err.status === 400) throw err;
      const page = await pageOrOffline();
      const readAt = new Date().toISOString();
      const out = [...livePlayerRows(page, 'home'), ...livePlayerRows(page, 'away')].map((p) => ({...p, source: 'page' as const, readAt}));
      setSourceHeaders(res, 'page', readAt, null, err instanceof DatabaseUnavailableError ? databaseReason(err) : 'unreachable');
      return res.json(out);
    }
  }));

  app.use((_req, res) => res.status(404).json({error: 'Niet gevonden'}));

  // Errors without internals: details go to the log, never into the answer
  // Express recognizes an error handler by its four parameters
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Request failed', {error: err instanceof Error ? err.message : String(err)});
    res.status(500).json({error: 'Interne serverfout'});
  });

  return app;
}
