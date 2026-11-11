import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Constant-time string comparison (avoids timing attacks on secrets). */
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkPassword(password) {
  return Boolean(env.auth.adminPassword) && safeEqual(password || '', env.auth.adminPassword);
}

export function signToken() {
  return jwt.sign({ sub: 'owner' }, env.auth.jwtSecret, { expiresIn: env.auth.jwtExpiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, env.auth.jwtSecret);
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Express middleware: requires a valid user JWT. */
export function requireAuth(req, res, next) {
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Express middleware: requires the SMS device token. */
export function requireDeviceToken(req, res, next) {
  const token = bearer(req);
  if (!env.sms.webhookToken) return res.status(503).json({ error: 'SMS webhook not configured' });
  if (!token || !safeEqual(token, env.sms.webhookToken)) return res.status(401).json({ error: 'Invalid device token' });
  next();
}
