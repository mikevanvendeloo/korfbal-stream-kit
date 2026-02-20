import {Router} from 'express';
import axios from 'axios';
import {config} from '../services/config';
import {logger} from '../utils/logger';
import {getScoreboardUrl, getShotclockUrl} from '../services/appSettings';

export const scoreboardRouter: Router = Router();

// GET /api/scoreboard
scoreboardRouter.get('/', async (_req, res) => {
  try {
    const baseUrl = await getScoreboardUrl() || config.scoreBoardBaseUrl;
    const url = `${baseUrl.replace(/\/$/, '')}/score-as-array`;
    const response = await axios.get(url, { timeout: 2000 });

    if (!Array.isArray(response.data)) {
      return res.status(502).json({ error: 'Invalid response format from scoreboard' });
    }

    return res.json(response.data);
  } catch (err: any) {
    logger.warn('Scoreboard fetch failed', { error: err?.message });
    return res.status(502).json({ error: 'Failed to fetch scoreboard' });
  }
});

function colorForShotclock(time: number): 'green' | 'orange' | 'red' {
  if (time <= 8) return 'red';
  if (time <= 15) return 'orange';
  return 'green';
}

// GET /api/scoreboard/shotclock
scoreboardRouter.get('/shotclock', async (_req, res) => {
  try {
    const baseUrl = await getShotclockUrl() || config.shotClockBaseUrl;
    const url = `${baseUrl.replace(/\/$/, '')}/time-as-array`;
    const response = await axios.get(url, { timeout: 2000 });

    const data = response.data;
    if (!Array.isArray(data)) {
      return res.status(502).json({ error: 'Invalid response format from shotclock' });
    }

    const enriched = data.map((item: any) => {
      const time = Number(item?.time);
      const color = Number.isFinite(time) ? colorForShotclock(time) : undefined;
      return { ...item, color };
    });

    return res.json(enriched);
  } catch (err: any) {
    logger.warn('Shotclock fetch failed', { error: err?.message });
    return res.status(502).json({ error: 'Failed to fetch shotclock' });
  }
});

// GET /api/scoreboard/clock
scoreboardRouter.get('/clock', async (_req, res) => {
  try {
    const baseUrl = await getScoreboardUrl() || config.scoreBoardBaseUrl;
    const url = `${baseUrl.replace(/\/$/, '')}/time-as-array`;
    const response = await axios.get(url, { timeout: 2000 });

    if (!Array.isArray(response.data)) {
      return res.status(502).json({ error: 'Invalid response format from scoreboard clock' });
    }

    return res.json(response.data);
  } catch (err: any) {
    logger.warn('Scoreboard clock fetch failed', { error: err?.message });
    return res.status(502).json({ error: 'Failed to fetch scoreboard clock' });
  }
});

export default scoreboardRouter;
