import {Router} from 'express';
import {MatchSourceInputSchema} from '../schemas/organization';
import {
  fetchFromMatchSource,
  getMatchSource,
  MatchSourceError,
  saveMatchSource,
  sendMatchImportError,
  toMatchSourceDto,
} from '../services/matchSchedule';

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

// POST /api/match-source/test -> asks the source for the coming week with the stored settings and
// answers {ok: true, matches} or {ok: false, error, code, hint}. A failure is only a category (token,
// URL, server error, timeout, unreachable, unexpected answer): the address is chosen in Beheer, so the
// upstream body, headers or exact status would make this a probe for other servers (and could echo the
// token). The details go to the server log.
matchSourceRouter.post('/test', async (_req, res, next) => {
  try {
    const matches = await fetchFromMatchSource({date: '1-weeks'});
    return res.json({ok: true, matches: matches.length});
  } catch (err) {
    if (err instanceof MatchSourceError) return sendMatchImportError(res, err.code);
    return next(err);
  }
});
