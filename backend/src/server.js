import http from 'node:http';
import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { initSocket } from './realtime/socket.js';
import { startConnectors, stopConnectors } from './connectors/index.js';

function checkConfig() {
  const missing = [];
  if (!env.auth.jwtSecret) missing.push('JWT_SECRET');
  if (!env.auth.adminPassword) missing.push('ADMIN_PASSWORD');
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')} (see .env.example)`);
  }
  if (env.auth.jwtSecret.length < 32) console.warn('[config] JWT_SECRET should be at least 32 characters');
  if (env.auth.adminPassword === 'change-me') console.warn('[config] ADMIN_PASSWORD is still the default "change-me"');
}

async function start() {
  checkConfig();
  await connectDb();

  const server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => server.listen(env.port, env.host, resolve));
  console.log(`Server running on http://${env.host || 'localhost'}:${env.port}`);

  // Connectors start after the server is up; a failing connector never blocks the API.
  startConnectors().catch((err) => console.error('[connectors]', err));

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    await stopConnectors();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
