import {NextFunction, Request, Response, Router} from 'express';
import {z} from 'zod';
import {sendApiError} from '../services/apiErrorCodes';
import {BridgeNotConfiguredError, BridgeOfflineError, bridgeGet, statsTeam, withTeamSource, type BridgeAnswer} from '../services/stats/statsBridge';
import {requireOrganizationId} from '../services/organizationContext';

/**
 * Match statistics from the statistics PC, through the statistics bridge (its own app: a failing PC or
 * share takes down the bridge, not this API). Same URLs as ever, feed routes (API key): this only forwards.
 */
export const statsRouter: Router = Router();

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof BridgeOfflineError) return sendApiError(res, 'STATS_BRIDGE_OFFLINE');
    if (err instanceof BridgeNotConfiguredError) return res.status(409).json({error: err.message});
    if (err instanceof z.ZodError) return res.status(400).json({error: err.issues[0]?.message || 'Ongeldige invoer'});
    return next(err);
  }
};

const LiveQuery = z.object({
  team: z.enum(['home', 'away']),
  vak: z.coerce.number().int().min(1).max(4).optional(),
});
const TableParam = z.string().min(1).max(200);

/** What the bridge says about its token is a setup problem here, not an offline bridge. */
function mapBridgeAnswer(answer: BridgeAnswer): BridgeAnswer {
  if (answer.status === 401 || answer.status === 403) {
    return {...answer, status: 502, body: {error: 'De statistics bridge weigert het bridge-token: controleer het token bij Instellingen → Statistieken'}};
  }
  return answer;
}

/** Forward `path` to the bridge (with the production's team unless `withTeam` is false) and pass its answer on. */
async function forward(res: Response, path: string, query: Record<string, string | number | undefined> = {}, withTeam = true) {
  const team = withTeam ? await statsTeam() : null;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) params.set(k, String(v));
  if (team) params.set('team', team.value);
  const qs = params.toString();
  const answer = mapBridgeAnswer(await bridgeGet(`${path}${qs ? `?${qs}` : ''}`));
  const {headers, body} = team ? withTeamSource(answer, team) : {headers: answer.headers, body: answer.body};
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  return res.status(answer.status).json(body);
}

// GET /api/stats/status: {bridge: {ok, ms}} plus the bridge's own connection test when it is online. Never an error
// for an offline bridge: the kit shows it as "offline". Cached 3 s per organization, one running check shared.
const STATUS_CACHE_MS = 3000;
type StatusEntry = {at: number; value?: unknown; pending?: Promise<unknown>};
const statusEntries = new Map<string, StatusEntry>();

export function clearStatsStatusCache(): void {
  statusEntries.clear();
}

async function bridgeStatus(): Promise<unknown> {
  const team = await statsTeam();
  try {
    const answer = mapBridgeAnswer(await bridgeGet(`/status?team=${team.value}`));
    if (answer.status !== 200) return {bridge: {ok: false, ms: null}, team};
    const {body} = withTeamSource(answer, team);
    return {bridge: {ok: true, ms: answer.ms}, ...(body as object), ...((body as {team?: unknown}).team ? {team} : {})};
  } catch (err) {
    if (err instanceof BridgeOfflineError) return {bridge: {ok: false, ms: null}, team};
    throw err;
  }
}

statsRouter.get('/status', wrap(async (_req, res) => {
  const key = String(requireOrganizationId('statistics status'));
  const hit = statusEntries.get(key);
  if (hit?.pending) return res.json(await hit.pending);
  if (hit?.value && Date.now() - hit.at < STATUS_CACHE_MS) return res.json(hit.value);
  const entry: StatusEntry = {at: 0};
  entry.pending = bridgeStatus().then(
    (value) => {
      entry.value = value;
      entry.at = Date.now();
      entry.pending = undefined;
      return value;
    },
    (err) => {
      statusEntries.delete(key);
      throw err;
    },
  );
  statusEntries.set(key, entry);
  return res.json(await entry.pending);
}));

// GET /api/stats/live
statsRouter.get('/live', wrap(async (_req, res) => forward(res, '/live', {}, false)));

// GET /api/stats/live/players?team=home|away&vak=1
statsRouter.get('/live/players', wrap(async (req, res) => {
  const q = LiveQuery.parse({team: req.query.team, vak: req.query.vak});
  return forward(res, '/live/players', {team: q.team, vak: q.vak}, false);
}));

// GET /api/stats/matches
statsRouter.get('/matches', wrap(async (_req, res) => forward(res, '/matches')));

// GET /api/stats/matches/:table/actions and /players
statsRouter.get('/matches/:table/actions', wrap(async (req, res) => forward(res, `/matches/${encodeURIComponent(TableParam.parse(req.params.table))}/actions`)));
statsRouter.get('/matches/:table/players', wrap(async (req, res) => forward(res, `/matches/${encodeURIComponent(TableParam.parse(req.params.table))}/players`)));

// GET /api/stats/players
statsRouter.get('/players', wrap(async (_req, res) => forward(res, '/players')));

// GET /api/stats/current/players: the bridge answers from the database, else the page
statsRouter.get('/current/players', wrap(async (_req, res) => forward(res, '/current/players')));

// GET /api/stats/team-stats and /top-scorers: flat rows per team / per player of the current match
statsRouter.get('/team-stats', wrap(async (_req, res) => forward(res, '/team-stats')));
statsRouter.get('/top-scorers', wrap(async (_req, res) => forward(res, '/top-scorers')));

// GET /api/stats/analysis: the analysis of the current match for the analist (database only; the bridge answers 503 without it)
statsRouter.get('/analysis', wrap(async (_req, res) => forward(res, '/analysis')));
