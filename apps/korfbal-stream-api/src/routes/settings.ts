import { Router } from 'express';
import { getVmixUrl, setVmixUrl } from '../services/appSettings';
import { config } from '../services/config';

export const settingsRouter: Router = Router();

// GET /api/settings/vmix-url
settingsRouter.get('/vmix-url', async (_req, res, next) => {
  try {
    const url = await getVmixUrl();
    res.json({ vmixWebUrl: url || null });
  } catch (e) { next(e); }
});

// PUT /api/settings/vmix-url  { vmixWebUrl: string }
settingsRouter.put('/vmix-url', async (req, res, next) => {
  try {
    const url = String(req.body?.vmixWebUrl || '').trim();
    await setVmixUrl(url);
    res.status(200).json({ vmixWebUrl: url });
  } catch (e) { next(e); }
});

// GET /api/settings/version
// Returns the backend version
settingsRouter.get('/version', async (_req, res, next) => {
  try {
    res.json({ version: config.appVersion });
  } catch (e) { next(e); }
});

export default settingsRouter;
