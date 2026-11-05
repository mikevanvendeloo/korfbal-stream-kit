import {Router} from 'express';
import {clearStatsBridgeCache} from '../services/stats/statsBridge';
import {clearStatsTeamCache} from '../services/stats/statsTeam';
import {
  getMatchStats,
  MatchStatsSchema,
  setMatchStats,
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
import {SponsorTypeEnum} from '../schemas/sponsor';
import {VmixCallsheetPushSchema} from '../schemas/vmixCallsheet';
import {getCallsheetPushConfig, setCallsheetPushConfig} from '../services/vmixCallsheetPush';
import {scheduleVenueConfigPush} from '../services/venueConfig';
import {VmixInstancesConfigSchema} from '../schemas/vmixInstances';
import {getVmixInstancesConfig, setFirstVmixUrl, setVmixInstancesConfig} from '../services/vmixInstances';
import {getOwnClubId, setOwnClubId} from '../services/ownClub';
import {DayPlanningSettingsSchema, getDayPlanningSettings, setDayPlanningSettings} from '../services/dayPlanning';

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
    scheduleVenueConfigPush();
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
    const saved = await setVmixInstancesConfig(parsed.data);
    scheduleVenueConfigPush();
    return res.json(saved);
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
  namesTypes: z.array(SponsorTypeEnum),
  rowsTypes: z.array(SponsorTypeEnum),
  slidesTypes: z.array(SponsorTypeEnum).optional(),
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
    // The addresses are for the venue-bridge, which reads the devices
    return res.json({
      scoreboardUrl: scoreboardUrl || '',
      shotclockUrl: shotclockUrl || ''
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
    scheduleVenueConfigPush();
    return res.json(parsed);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// GET /api/settings/match-stats: what the venue-bridge needs to read the statistics PC
settingsRouter.get('/match-stats', async (_req, res, next) => {
  try {
    return res.json(await getMatchStats());
  } catch (err) {
    return next(err);
  }
});

// PUT /api/settings/match-stats {pageUrl, mdbPath, mdbEnabled, shareHost, keepCopy}; the bridge gets them at once
settingsRouter.put('/match-stats', async (req, res, next) => {
  try {
    const parsed = MatchStatsSchema.parse(req.body);
    await setMatchStats(parsed);
    clearStatsBridgeCache();
    clearStatsTeamCache();
    scheduleVenueConfigPush();
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
    const [ownClubId, productionTeamNames, dayPlanning] = await Promise.all([
      getOwnClubId(),
      getSetting<string[]>(PRODUCTION_TEAM_NAMES_KEY),
      getDayPlanningSettings(),
    ]);
    return res.json({
      ownClubId,
      productionTeamNames: productionTeamNames || [],
      ...dayPlanning,
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/settings/club-config
// The day planning defaults (verzamelen / opbouw in minutes before live) are optional: left out, they stay.
const ClubConfigSchema = z.object({
  ownClubId: z.number().int().positive().nullable(),
  productionTeamNames: z.array(z.string()),
}).merge(DayPlanningSettingsSchema.partial());

settingsRouter.put('/club-config', async (req, res, next) => {
  try {
    const parsed = ClubConfigSchema.parse(req.body);
    if (!(await setOwnClubId(parsed.ownClubId))) return res.status(400).json({error: 'Club bestaat niet'});
    await setSetting(PRODUCTION_TEAM_NAMES_KEY, parsed.productionTeamNames);
    const dayPlanning = {...(await getDayPlanningSettings())};
    if (parsed.crewCallMinutes !== undefined) dayPlanning.crewCallMinutes = parsed.crewCallMinutes;
    if (parsed.setupMinutes !== undefined) dayPlanning.setupMinutes = parsed.setupMinutes;
    await setDayPlanningSettings(dayPlanning);
    return res.json({ownClubId: parsed.ownClubId, productionTeamNames: parsed.productionTeamNames, ...dayPlanning});
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});
