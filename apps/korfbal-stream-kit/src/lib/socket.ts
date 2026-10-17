import {io, Socket} from 'socket.io-client';
import {getSocketUrl} from './api';
import {isOrganizationRejectedSocketError, notifyOrganizationRejected, socketAuth} from './organization';

let sharedSocket: Socket | null = null;

/**
 * The single app-wide Socket.io connection, created on first use. Hooks register and remove their own
 * handlers on it but never disconnect it, so every tab keeps exactly one connection to the API.
 * The handshake sends the chosen organization (`auth.organization`), so the API puts this client in
 * that organization's room.
 */
export function getSharedSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      timeout: 20000,
      auth: socketAuth,
    });
    sharedSocket.on('connect_error', (err: Error) => {
      if (isOrganizationRejectedSocketError(err)) notifyOrganizationRejected();
    });
  }
  return sharedSocket;
}

/**
 * After switching organization: connect again, so the handshake sends the new one and the client
 * leaves the old organization's room. A socket that doesn't exist yet gets it on first use.
 */
export function reconnectSharedSocket(): void {
  if (!sharedSocket) return;
  sharedSocket.disconnect();
  sharedSocket.connect?.();
}

/** A Socket.io event handler; payloads are typed by each handler itself. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- socket.io listeners receive arbitrary payloads
export type SocketListener = (...args: any[]) => void;
