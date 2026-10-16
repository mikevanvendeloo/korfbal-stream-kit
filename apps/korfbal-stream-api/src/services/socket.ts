import {Server as SocketIOServer} from 'socket.io';
import type {IncomingMessage, Server as HttpServer} from 'http';
import {logger} from '../utils/logger';
import {timeSyncService} from './timeSyncService';
import {initializeClient} from './productionState';
import {requireOrganizationId, runWithOrganization} from './organizationContext';
import {findActiveOrganization} from '../middleware/organizationContext';
import type {SeasonDto} from './season';

let io: SocketIOServer | undefined;

/** Room of an organization's clients: every live event goes there (D6). */
export function organizationRoom(organizationId: number): string {
  return `org:${organizationId}`;
}

export const UNKNOWN_ORGANIZATION_MESSAGE = 'Onbekende of inactieve organisatie';

/**
 * The organization a client asked for in the handshake (`auth.organization` = slug). Without one the
 * client connects but only gets the global events (heartbeat, season_changed); an unknown, inactive or
 * malformed slug is refused.
 */
export async function resolveHandshakeOrganization(slug: unknown): Promise<number | undefined> {
  if (slug === undefined || slug === null || slug === '') return undefined;
  const organization = typeof slug === 'string' ? await findActiveOrganization(slug.trim()) : null;
  if (!organization) throw new Error(UNKNOWN_ORGANIZATION_MESSAGE);
  return organization.id;
}

function hostnameOf(host: string): string | null {
  try {
    return new URL(`http://${host.trim()}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Browsers always connect same-origin (the Vite dev proxy and nginx forward /socket.io), so a handshake
 * from a page on another host is refused. Only hostnames are compared: nginx forwards `$host` without
 * the port and the Vite proxy rewrites Host to the API's port. Clients without an Origin (vMix, Node)
 * aren't browsers and pass.
 */
export function isSameOriginHandshake(req: Pick<IncomingMessage, 'headers'>): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  const hosts = [req.headers['x-forwarded-host'], req.headers.host]
    .flatMap((h) => (Array.isArray(h) ? h : h ? h.split(',') : []))
    .map(hostnameOf);
  return hosts.includes(originHost);
}

export function initSocket(httpServer: HttpServer) {
  const server = new SocketIOServer(httpServer, {
    transports: ['websocket', 'polling'], // Zorg dat beide transports expliciet aan staan
    allowRequest: (req, callback) => callback(null, isSameOriginHandshake(req)),
  });
  io = server;

  server.use((socket, next) => {
    resolveHandshakeOrganization(socket.handshake.auth?.organization)
      .then((organizationId) => {
        socket.data.organizationId = organizationId;
        next();
      })
      .catch((err: Error) => next(new Error(err.message === UNKNOWN_ORGANIZATION_MESSAGE ? err.message : 'Verbinding geweigerd')));
  });

  server.on('connection', (socket) => {
    const organizationId = socket.data.organizationId as number | undefined;
    logger.info(`🔌 New client connected: ${socket.id}${organizationId ? ` (organization ${organizationId})` : ''}`);

    if (organizationId) {
      socket.join(organizationRoom(organizationId));
      // Stuur de huidige tijd- en live-status van de eigen organisatie naar de nieuwe client
      runWithOrganization(organizationId, () => {
        timeSyncService.initializeClient(socket);
        initializeClient(socket);
      });
    }

    socket.on('disconnect', () => {
      logger.info(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Verstuur elke 2 seconden een heartbeat om clients gesynchroniseerd te houden (globaal)
  setInterval(() => {
    server.emit('heartbeat', { serverTime: Date.now() });
  }, 2000).unref();

  logger.info('🚀 Socket.io initialized with heartbeat');
  return server;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

/** Sends a live event to the clients of the organization in the context. */
export function emitToOrganization(event: string, ...args: unknown[]) {
  if (!io) return;
  io.to(organizationRoom(requireOrganizationId('A live event'))).emit(event, ...args);
}

export const SEASON_CHANGED_EVENT = 'season_changed';

/** Tells every connected crew browser that the active season changed, so it can refetch season-scoped data. */
export function emitSeasonChanged(season: SeasonDto) {
  if (!io) return;
  io.emit(SEASON_CHANGED_EVENT, season);
}
