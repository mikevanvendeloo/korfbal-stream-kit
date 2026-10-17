import {Router} from 'express';
import {
  getScoreboardUrl,
  getSetting,
  getShotclockUrl,
  getSponsorNamesTypes,
  getSponsorRowsTypes,
  getSponsorSlidesTypes,
  getVmixUrl, PRODUCTION_TEAM_NAMES_KEY,
  setScoreboardUrl,
  setSetting,
  setShotclockUrl,
  setSponsorNamesTypes,
  setSponsorRowsTypes,
  setSponsorSlidesTypes,
  VmixUrlSchema
} from '../services/appSettings';
import {config} from '../services/config';
import {z} from 'zod';
import {VmixCallsheetPushSchema} from '../schemas/vmixCallsheet';
import {getCallsheetPushConfig, setCallsheetPushConfig} from '../services/vmixCallsheetPush';
import {VmixInstancesConfigSchema} from '../schemas/vmixInstances';
import {getVmixInstancesConfig, setFirstVmixUrl, setVmixInstancesConfig} from '../services/vmixInstances';
import {getOwnClubId, setOwnClubId} from '../services/ownClub';

export const settingsRouter: Router = Router();

// GET /api/settings/version
// Returns the backend version
settingsRouter.get('/version', async (_req, res, next) => {
  try {
    res.json({ version: config.appVersion });
  } catch (e) { next(e); }
});

// GET /api/settings/vmix-url (the first vMix instance; see /vmix-instances for all of them)
settingsRouter.get('/vmix-url', async (_req, res, next) => {
  try {
    const url = await getVmixUrl();
    return res.json({ vmixWebUrl: url });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/settings/vmix-url
settingsRouter.put('/vmix-url', async (req, res, next) => {
  try {
    const url = req.body?.vmixWebUrl;
    if (!url) return res.status(400).json({ error: 'Missing vmixWebUrl' });
    if (!VmixUrlSchema.safeParse(url).success) return res.status(400).json({ error: 'Invalid URL for vMix Web URL' });
    await setFirstVmixUrl(url);
    return res.json({ vmixWebUrl: url });
  } catch (err) {
    return next(err);
  }
});

// GET /api/settings/vmix-instances
settingsRouter.get('/vmix-instances', async (_req, res, next) => {
  try {
    return res.json(await getVmixInstancesConfig());
  } catch (err) {
    return next(err);
  }
});

// PUT /api/settings/vmix-instances  { instances: [{id?, name, url}], targets: {countdown, callsheet} }
settingsRouter.put('/vmix-instances', async (req, res, next) => {
  try {
    const parsed = VmixInstancesConfigSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Invalid vMix instances', details: parsed.error.flatten()});
    return res.json(await setVmixInstancesConfig(parsed.data));
  } catch (err) {
    return next(err);
  }
});

// GET /api/settings/vmix-callsheet-push
settingsRouter.get('/vmix-callsheet-push', async (_req, res, next) => {
  try {
    return res.json(await getCallsheetPushConfig());
  } catch (err) {
    return next(err);
  }
});

// PUT /api/settings/vmix-callsheet-push
settingsRouter.put('/vmix-callsheet-push', async (req, res, next) => {
  try {
    const parsed = VmixCallsheetPushSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'Invalid callsheet push settings', details: parsed.error.flatten()});
    await setCallsheetPushConfig(parsed.data);
    return res.json(parsed.data);
  } catch (err) {
    return next(err);
  }
});

// GET /api/settings/sponsor-config
settingsRouter.get('/sponsor-config', async (_req, res, next) => {
  try {
    const [namesTypes, rowsTypes, slidesTypes] = await Promise.all([
      getSponsorNamesTypes(),
      getSponsorRowsTypes(),
      getSponsorSlidesTypes(),
    ]);
    return res.json({ namesTypes, rowsTypes, slidesTypes });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/settings/sponsor-config
const SponsorConfigSchema = z.object({
  namesTypes: z.array(z.string()),
  rowsTypes: z.array(z.string()),
  slidesTypes: z.array(z.string()).optional(),
});

settingsRouter.put('/sponsor-config', async (req, res, next) => {
  try {
    const parsed = SponsorConfigSchema.parse(req.body);
    await Promise.all([
      setSponsorNamesTypes(parsed.namesTypes),
      setSponsorRowsTypes(parsed.rowsTypes),
      setSponsorSlidesTypes(parsed.slidesTypes || []),
    ]);
    return res.json(parsed);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// GET /api/settings/scoreboard-config
settingsRouter.get('/scoreboard-config', async (_req, res, next) => {
  try {
    const [scoreboardUrl, shotclockUrl] = await Promise.all([
      getScoreboardUrl(),
      getShotclockUrl(),
    ]);
    // Return stored values, or fall back to config defaults if not set in DB
    return res.json({
      scoreboardUrl: scoreboardUrl || config.scoreBoardBaseUrl,
      shotclockUrl: shotclockUrl || config.shotClockBaseUrl
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/settings/scoreboard-config
const ScoreboardConfigSchema = z.object({
  scoreboardUrl: z.string().optional(),
  shotclockUrl: z.string().optional(),
});

settingsRouter.put('/scoreboard-config', async (req, res, next) => {
  try {
    const parsed = ScoreboardConfigSchema.parse(req.body);
    await Promise.all([
      setScoreboardUrl(parsed.scoreboardUrl || ''),
      setShotclockUrl(parsed.shotclockUrl || ''),
    ]);
    return res.json(parsed);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// GET /api/settings/club-config
// ownClubId is the organization's club (Organization.clubId), the same one Beheer → Organisaties shows.
settingsRouter.get('/club-config', async (_req, res, next) => {
  try {
    const [ownClubId, productionTeamNames] = await Promise.all([
      getOwnClubId(),
      getSetting<string[]>(PRODUCTION_TEAM_NAMES_KEY),
    ]);
    return res.json({
      ownClubId,
      productionTeamNames: productionTeamNames || [],
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/settings/club-config
const ClubConfigSchema = z.object({
  ownClubId: z.number().int().positive().nullable(),
  productionTeamNames: z.array(z.string()),
});

settingsRouter.put('/club-config', async (req, res, next) => {
  try {
    const parsed = ClubConfigSchema.parse(req.body);
    if (!(await setOwnClubId(parsed.ownClubId))) return res.status(400).json({error: 'Club bestaat niet'});
    await setSetting(PRODUCTION_TEAM_NAMES_KEY, parsed.productionTeamNames);
    return res.json(parsed);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});
