import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ingestMessage } from '../core/messageService.js';
import { patchStatus } from '../connectors/status.js';
import { normalizePhone } from './sms.js';

const router = Router();

/**
 * httpSMS (https://httpsms.com) signs each webhook with a JWT:
 *   Authorization: Bearer <JWT signed with HS256 using your webhook "signing key">
 * Returns true only for a valid, unexpired token signed with our key.
 */
export function isValidHttpSmsToken(authHeader, signingKey) {
  if (!signingKey || !authHeader?.startsWith('Bearer ')) return false;
  try {
    jwt.verify(authHeader.slice(7), signingKey, { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

/** Convert an httpSMS `message.phone.received` event into a unified message. */
export function httpSmsToUnified(event) {
  const d = event?.data || {};
  if (!d.message_id || !d.contact) return null;
  const from = normalizePhone(d.contact);
  return {
    platform: 'sms',
    externalId: `httpsms:${d.message_id}`,
    conversation: { externalId: from, title: from, type: 'sms' },
    from: { name: from, handle: from },
    direction: 'in',
    text: String(d.content ?? ''),
    timestamp: new Date(d.timestamp || event.time || Date.now()),
    meta: { provider: 'httpsms', sim: d.sim, owner: d.owner },
  };
}

/**
 * POST /webhooks/httpsms
 * Events (CloudEvents JSON, type also in the X-Event-Type header):
 *   message.phone.received   -> stored as an incoming SMS
 *   phone.heartbeat.online / phone.heartbeat.offline -> "phone last seen" status
 *   anything else            -> acknowledged and ignored (this app is read-only)
 * httpSMS waits 5s and retries on 5xx, so we answer 500 only when storing fails.
 */
router.post('/', async (req, res) => {
  if (!env.httpsms.signingKey) return res.status(503).json({ error: 'httpSMS webhook not configured' });
  if (!isValidHttpSmsToken(req.get('authorization'), env.httpsms.signingKey)) {
    console.warn('[httpsms] rejected webhook with invalid token');
    return res.status(401).json({ error: 'Invalid token' });
  }

  const type = req.get('x-event-type') || req.body?.type;

  try {
    if (type === 'message.phone.received') {
      const message = httpSmsToUnified(req.body);
      if (!message) return res.status(400).json({ error: 'Missing message_id or contact' });
      await ingestMessage(message);
      patchStatus('sms', { lastSeenAt: new Date() });
    } else if (type === 'phone.heartbeat.online') {
      patchStatus('sms', { lastSeenAt: new Date() });
    } else if (type === 'phone.heartbeat.offline') {
      const last = req.body?.data?.last_heartbeat_timestamp;
      patchStatus('sms', { lastSeenAt: last ? new Date(last) : null });
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('[httpsms] failed to process event', type, err.message);
    res.status(500).json({ error: 'Failed to store message' }); // httpSMS will retry
  }
});

export default router;
