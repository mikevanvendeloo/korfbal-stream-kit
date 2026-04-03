import {Server as SocketIOServer} from 'socket.io';
import {Server as HttpServer} from 'http';
import {logger} from '../utils/logger';
import {timeSyncService} from './timeSyncService';
import {initializeClient} from './productionState';

let io: SocketIOServer;

export function initSocket(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
    },
    transports: ['websocket', 'polling'], // Zorg dat beide transports expliciet aan staan
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 New client connected: ${socket.id}`);

    // Stuur de huidige tijd-status naar de nieuwe client
    timeSyncService.initializeClient(socket);
    initializeClient(socket);

    socket.on('disconnect', () => {
      logger.info(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Verstuur elke 2 seconden een heartbeat om clients gesynchroniseerd te houden
  setInterval(() => {
    io.emit('heartbeat', { serverTime: Date.now() });
  }, 2000);

  logger.info('🚀 Socket.io initialized with heartbeat');
  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}
