import type {Server as HttpServer} from 'node:http';
import {Server as SocketIOServer, type Socket} from 'socket.io';
import {VENUE_BRIDGE_PATH, VENUE_EVENTS, VenueReadingSchema, MAX_READING_BYTES} from '@korfbal-stream-kit/venue-protocol';
import {logger} from '../utils/logger';
import {isSameOriginRequest} from '../middleware/sameOrigin';
import {API_ERRORS} from './apiErrorCodes';
import {findOrganizationByApiKey} from './apiKeys';
import {runWithOrganization} from './organizationContext';
import {getBridge, removeBridge, setBridge} from './venueBridge';
import {bridgeConnected, bridgeDisconnected, recordReading} from './venueData';
import {pushVenueConfigNow} from './venueConfig';

/** A little over the 10 MB the API accepts for a statistics answer; only this server takes messages that large. */
export const VENUE_BRIDGE_MAX_BUFFER_BYTES = 11 * 1024 * 1024;

function refusal(code: 'API_KEY_MISSING' | 'API_KEY_INVALID'): Error {
  const err = new Error(API_ERRORS[code].error) as Error & {data?: {code: string}};
  err.data = {code};
  return err;
}

const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

/** The key of a handshake: `auth.key`, the X-Api-Key header or `?key=`. Only the key is read, never logged. */
function handshakeKey(socket: Socket): string | null {
  const {auth, headers, query} = socket.handshake;
  return text(auth?.key, 200) ?? text(headers['x-api-key'], 200) ?? text(query?.key, 200);
}

/**
 * The socket.io server of the venue-bridge, on the same http server as the browsers' one but with its own path
 * (default namespace): a key in the handshake decides the organization; one socket per organization. It has the
 * large message limit (the browsers' server keeps the default) and the same same-origin rule on the handshake.
 */
export function registerVenueBridgeSocket(httpServer: HttpServer): SocketIOServer {
  const server = new SocketIOServer(httpServer, {
    path: VENUE_BRIDGE_PATH,
    transports: ['websocket', 'polling'],
    allowRequest: (req, callback) => callback(null, isSameOriginRequest(req)),
    maxHttpBufferSize: VENUE_BRIDGE_MAX_BUFFER_BYTES,
    destroyUpgrade: false,
  });
  const namespace = server.of('/');

  namespace.use((socket, next) => {
    const key = handshakeKey(socket);
    if (!key) return next(refusal('API_KEY_MISSING'));
    findOrganizationByApiKey(key)
      .then((organization) => {
        if (!organization?.isActive) return next(refusal('API_KEY_INVALID'));
        socket.data.organizationId = organization.id;
        return next();
      })
      .catch(() => next(new Error('Verbinding geweigerd')));
  });

  namespace.on('connection', (socket) => {
    const organizationId = socket.data.organizationId as number;
    const {auth} = socket.handshake;
    const previous = setBridge(organizationId, {
      socket,
      name: text(auth?.name, 80) ?? 'venue-bridge',
      version: text(auth?.version, 40) ?? 'onbekend',
      pageUrl: text(auth?.pageUrl, 300),
      connectedAt: new Date(),
    });
    // A second bridge replaces the first one
    if (previous) previous.socket.disconnect(true);
    logger.info('Venue-bridge connected', {organizationId, name: getBridge(organizationId)?.name});
    bridgeConnected(organizationId);
    void pushVenueConfigNow(organizationId).catch((err: unknown) => logger.warn('Sending the venue configuration failed', {organizationId, error: (err as Error)?.message}));

    socket.on(VENUE_EVENTS.reading, (payload: unknown) => {
      if (getBridge(organizationId)?.socket.id !== socket.id) return;
      if (JSON.stringify(payload ?? null).length > MAX_READING_BYTES + 200) return;
      const parsed = VenueReadingSchema.safeParse(payload);
      if (!parsed.success) return;
      runWithOrganization(organizationId, () => recordReading(organizationId, parsed.data));
    });

    socket.on('disconnect', () => {
      if (!removeBridge(organizationId, socket)) return;
      logger.info('Venue-bridge disconnected', {organizationId});
      bridgeDisconnected(organizationId);
    });
  });

  return server;
}
