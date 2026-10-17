import {Router} from 'express';
import {MatchSourceInputSchema} from '../schemas/organization';
import {
  getMatchScheduleProvider,
  getMatchSource,
  MatchSourceNotConfiguredError,
  saveMatchSource,
  toMatchSourceDto,
} from '../services/matchSchedule';
import {logger} from '../utils/logger';

function upstreamFailure(err: unknown): {status: number | null; code: string | null} {
  const e = err as {response?: {status?: number}; code?: string} | null;
  return {status: e?.response?.status ?? null, code: e?.code ?? null};
}

/** Match import settings of the chosen organization (Beheer → Organisatie → Wedstrijdimport). The token is never returned. */
export const matchSourceRouter: Router = Router();

matchSourceRouter.get('/', async (_req, res, next) => {
  try {
    return res.json(toMatchSourceDto(await getMatchSource()));
  } catch (err) {
    return next(err);
  }
});

// PUT /api/match-source {provider, baseUrl, apiToken?, isEnabled?}: apiToken absent keeps it, null removes it
matchSourceRouter.put('/', async (req, res, next) => {
  try {
    const parsed = MatchSourceInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Ongeldige wedstrijdimport', issues: parsed.error.issues.map(({path, message}) => ({path, message}))});
    return res.json(toMatchSourceDto(await saveMatchSource(parsed.data)));
  } catch (err) {
    return next(err);
  }
});

// POST /api/match-source/test -> fetches today's matches with the stored settings: only ok or failed.
// Nothing of the upstream answer (status, body, count, kind of failure) goes back: the address is
// chosen by the caller, so details would make this a probe for other servers (and could echo the token).
matchSourceRouter.post('/test', async (_req, res) => {
  try {
    const provider = await getMatchScheduleProvider();
    await provider.fetchMatches({date: new Date().toISOString().slice(0, 10)});
    return res.json({ok: true});
  } catch (err) {
    if (err instanceof MatchSourceNotConfiguredError) return res.status(409).json({ok: false, error: err.message});
    const {status, code} = upstreamFailure(err);
    logger.warn('Match source test failed', {status, code});
    return res.status(502).json({ok: false, error: 'Geen verbinding met de wedstrijdbron'});
  }
});
