import { Router } from 'express';
import { requireDeviceToken } from '../auth/auth.js';
import { ingestMessage } from '../core/messageService.js';
import { patchStatus } from '../connectors/status.js';

const router = Router();

/** Record that the phone just talked to us (shown as "phone last seen" in the UI). */
const touch = () => patchStatus('sms', { lastSeenAt: new Date() });

/** Normalize phone numbers so "+91 98765-43210" and "+919876543210" land in one conversation. */
export function normalizePhone(raw) {
  const s = String(raw || '').trim();
  if (!/\d/.test(s)) return s; // alphanumeric sender id, e.g. "VK-HDFCBK"
  const plus = s.startsWith('+') ? '+' : '';
  return plus + s.replace(/\D/g, '');
}

function toUnified(sms) {
  const from = normalizePhone(sms.from);
  const timestamp = new Date(typeof sms.timestamp === 'number' ? sms.timestamp : sms.timestamp || Date.now());
  return {
    platform: 'sms',
    // Prefer the phone's own id; fall back to a stable composite so retries dedupe.
    externalId: sms.id ? String(sms.id) : `${from}:${timestamp.getTime()}`,
    conversation: { externalId: from, title: sms.contactName || from, type: 'sms' },
    from: { name: sms.contactName || from, handle: from },
    direction: 'in',
    text: String(sms.body || ''),
    timestamp,
    meta: sms.sim !== undefined ? { sim: sms.sim } : undefined,
  };
}

function validate(sms) {
  if (!sms || typeof sms !== 'object') return 'item must be an object';
  if (!sms.from) return '"from" is required';
  if (typeof sms.body !== 'string') return '"body" must be a string';
  if (sms.timestamp !== undefined && Number.isNaN(new Date(sms.timestamp).getTime())) return '"timestamp" is invalid';
  return null;
}

/**
 * POST /webhooks/sms
 * Header: Authorization: Bearer <SMS_WEBHOOK_TOKEN>
 * Body (single or array for batching queued messages):
 *   { "id": "123", "from": "+919876543210", "body": "Hello", "timestamp": 1731312000000,
 *     "contactName": "Mom", "sim": 1 }
 * Responds 200 once stored, so the phone can remove the items from its local queue.
 */
router.post('/', requireDeviceToken, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (!items.length || items.length > 500) return res.status(400).json({ error: 'Send 1-500 messages' });

    for (const [i, sms] of items.entries()) {
      const error = validate(sms);
      if (error) return res.status(400).json({ error: `item ${i}: ${error}` });
    }

    let created = 0;
    for (const sms of items) {
      const result = await ingestMessage(toUnified(sms));
      if (result.created) created++;
    }

    touch();
    res.json({ ok: true, received: items.length, created, duplicates: items.length - created });
  } catch (err) {
    next(err);
  }
});

/** POST /webhooks/sms/heartbeat  { battery: 80, signal: 3 } - lets the UI show "phone last seen". */
router.post('/heartbeat', requireDeviceToken, (req, res) => {
  touch();
  res.json({ ok: true });
});

export default router;
