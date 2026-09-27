import {io, Socket} from 'socket.io-client';
import {getSocketUrl} from './api';

let sharedSocket: Socket | null = null;

/**
 * The single app-wide Socket.io connection, created on first use. Hooks register and remove their own
 * handlers on it but never disconnect it, so every tab keeps exactly one connection to the API.
 */
export function getSharedSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      timeout: 20000,
    });
  }
  return sharedSocket;
}

/** A Socket.io event handler; payloads are typed by each handler itself. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- socket.io listeners receive arbitrary payloads
export type SocketListener = (...args: any[]) => void;
