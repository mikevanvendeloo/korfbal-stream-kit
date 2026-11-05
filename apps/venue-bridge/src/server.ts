import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, {type Express, NextFunction, Request, Response} from 'express';
import {enrichShotclock, type VenueDevice, type VenueReading} from '@korfbal-stream-kit/venue-protocol';
import {statsErrorHandler, statsNotFound} from './app';
import type {ConfigCache} from './services/configCache';
import type {DeviceReaders} from './services/deviceReaders';
import {buildStatus, deviceStates, STATUS_READING_CURRENT_MS, type BridgeStatusParts} from './services/bridgeStatus';
import {handleStatsRequest} from './services/statsHandler';
import type {VmixClient} from './services/vmixClient';

export type ServerParts = BridgeStatusParts & {
  apiKey: string;
  cache: ConfigCache;
  readers: DeviceReaders;
  vmix: VmixClient;
  /** The built status page (apps/venue-bridge-ui); default: `public` next to the bundle, or PAGE_DIR */
  pageDir?: string;
};

const keyHash = (value: string) => crypto.createHash('sha256').update(value).digest();

function keyMatches(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  // Hash both sides: timingSafeEqual needs equal lengths and the length of the secret stays hidden
  return crypto.timingSafeEqual(keyHash(given), keyHash(expected));
}

/** The API key from the X-Api-Key header or `?key=`, like the central API. */
function requireApiKey(expected: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const given = req.header('x-api-key') || (typeof req.query.key === 'string' ? req.query.key : undefined);
    if (!given) return res.status(401).json({error: 'API-sleutel ontbreekt'});
    if (!keyMatches(given, expected)) return res.status(401).json({error: 'Ongeldige API-sleutel'});
    return next();
  };
}

const PLACEHOLDER_PAGE = `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Venue-bridge</title></head>
<body style="font-family:system-ui,sans-serif;margin:16px"><h1>Venue-bridge</h1>
<p>De statuspagina volgt. De status staat in <a href="/bridge/status">/bridge/status</a>.</p></body></html>`;

/** A reading that is ok and recent: the same bar the API sets (ok, received within 10 s). */
function current(readers: DeviceReaders, device: VenueDevice): VenueReading | null {
  const reading = readers.latest(device);
  if (!reading || !reading.ok) return null;
  return Date.now() - Date.parse(reading.readAt) <= STATUS_READING_CURRENT_MS ? reading : null;
}

export function createApp(parts: ServerParts): Express {
  const app = express();
  app.disable('x-powered-by');
  const {readers, vmix, cache} = parts;

  // Process is up (no key: the container healthcheck)
  app.get('/health', (_req, res) => {
    const devices = Object.fromEntries(Object.entries(deviceStates(readers)).map(([d, v]) => [d, v.state]));
    res.json({ok: true, connected: parts.getApi().connected, devices});
  });

  // For the page: no key, no secrets
  app.get('/bridge/status', (_req, res) => res.json(buildStatus(parts)));
  // The built status page; without a build (dev) a small placeholder
  const pageDir = parts.pageDir ?? process.env.PAGE_DIR ?? path.join(__dirname, 'public');
  if (fs.existsSync(path.join(pageDir, 'index.html'))) {
    app.use(express.static(pageDir, {index: 'index.html', maxAge: '1h', setHeaders: (res, file) => { if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); }}));
  } else {
    app.get('/', (_req, res) => res.type('html').send(PLACEHOLDER_PAGE));
  }

  const api = express.Router();
  api.use(requireApiKey(parts.apiKey));

  // Same paths and answers as the central API, from the bridge's own readings
  const deviceRoute = (device: VenueDevice, label: string, transform: (data: unknown[]) => unknown[] = (d) => d) => async (_req: Request, res: Response) => {
    const reading = readers.latest(device);
    if (reading?.error === 'invalid') return res.status(502).json({error: `Invalid response format from ${label}`});
    const fresh = current(readers, device);
    if (!fresh) return res.status(502).json({error: `Failed to fetch ${label}`});
    return res.json(transform(fresh.data));
  };
  api.get('/scoreboard', deviceRoute('score', 'scoreboard'));
  api.get('/scoreboard/clock', deviceRoute('clock', 'scoreboard clock'));
  api.get('/scoreboard/shotclock', deviceRoute('shotclock', 'shotclock', enrichShotclock));

  api.use('/stats', async (req: Request, res: Response) => {
    // The team in a fallback: the one asked for, else the one the API asked for last
    const url = new URL(req.originalUrl.replace(/([?&])key=[^&]*&?/, '$1').replace(/[?&]$/, ''), 'http://bridge.local');
    const path = url.pathname.replace(/^\/api\/stats/, '') || '/';
    if (req.method !== 'GET') return res.status(404).json({error: 'Niet gevonden'});
    if (!url.searchParams.has('team')) url.searchParams.set('team', cache.statsTeam);
    const answer = await handleStatsRequest(`${path}${url.search}`);
    for (const [name, value] of Object.entries(answer.headers)) if (name !== 'content-type') res.setHeader(name, value);
    return res.status(answer.status).json(answer.body);
  });

  api.post('/vmix/set-timer', express.json({limit: '4kb'}), async (req: Request, res: Response) => {
    const secondsRaw = Number(req.body?.seconds);
    if (!Number.isFinite(secondsRaw) || secondsRaw <= 0) return res.status(400).json({error: 'seconds must be a positive number'});
    const seconds = Math.round(secondsRaw);
    const value = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const instanceId = typeof req.body?.instanceId === 'string' ? req.body.instanceId : undefined;
    const target = vmix.resolve('countdown', instanceId);
    if ('error' in target) return res.status(400).json({error: target.error});
    const answer = await vmix.call({function: 'countdown', instanceId, commands: [{Function: 'SetCountdown', Value: value}]});
    if (!answer.ok) return res.status(502).json({error: 'vMix niet bereikbaar'});
    return res.json({ok: true, seconds, instance: target.instance.name});
  });
  app.use('/api', api);

  app.use(statsNotFound);
  app.use(statsErrorHandler);
  return app;
}
