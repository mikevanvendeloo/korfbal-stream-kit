import {Router} from 'express';
import {
  getScoreboardUrl,
  getShotclockUrl,
  getSponsorNamesTypes,
  getSponsorRowsTypes,
  getSponsorSlidesTypes,
  getVmixUrl,
  setScoreboardUrl,
  setShotclockUrl,
  setSponsorNamesTypes,
  setSponsorRowsTypes,
  setSponsorSlidesTypes,
  setVmixUrl
} from '../services/appSettings';
import {config} from '../services/config';
import {z} from 'zod';

export const settingsRouter: Router = Router();

// GET /api/settings/version
// Returns the backend version
settingsRouter.get('/version', async (_req, res, next) => {
  try {
    res.json({ version: config.appVersion });
  } catch (e) { next(e); }
});

// GET /api/settings/vmix-url
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
    await setVmixUrl(url);
    return res.json({ vmixWebUrl: url });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
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
