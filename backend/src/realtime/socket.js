import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken } from '../auth/auth.js';
import { eventBus } from '../core/eventBus.js';
import { getStatuses } from '../connectors/status.js';

let io;

/**
 * Socket.IO for the Angular app.
 * Client connects with: io(url, { auth: { token: '<JWT>' } })
 * Server -> client events:
 *   'message:new'          { message, conversation }
 *   'conversation:updated' { conversation }
 *   'connector:status'     { name, state, error, updatedAt }
 *   'connectors'           { telegram: {...}, gmail: {...}, sms: {...} }  (sent on connect)
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientOrigin } });

  io.use((socket, next) => {
    try {
      socket.data.user = verifyToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.emit('connectors', getStatuses());
  });

  // Strip heavy email HTML from live pushes; the UI fetches it on demand.
  eventBus.on('message:new', ({ message, conversation }) => {
    const { html, ...light } = message;
    io.emit('message:new', { message: { ...light, hasHtml: Boolean(html) }, conversation });
  });
  eventBus.on('conversation:updated', (payload) => io.emit('conversation:updated', payload));
  eventBus.on('connector:status', (status) => io.emit('connector:status', status));

  return io;
}

export function getIo() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
