import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { safeEqual } from '../auth/auth.js';
import { ingestMessage } from '../core/messageService.js';
import { patchStatus } from '../connectors/status.js';
import { extractWhatsAppMessages } from '../connectors/whatsapp/normalize.js';

const router = Router();

/** Meta signs every webhook: X-Hub-Signature-256: sha256=HMAC_SHA256(appSecret, rawBody) */
export function isValidSignature(rawBody, header, appSecret) {
  if (!rawBody || !header || !appSecret || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return safeEqual(header.slice(7), expected);
}

/**
 * GET /webhooks/whatsapp - one-time verification when you register the webhook in Meta.
 * Meta sends hub.mode=subscribe, hub.verify_token=<yours>, hub.challenge=<random>;
 * we must echo the challenge back if the token matches.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!env.whatsapp.verifyToken) return res.status(503).send('WhatsApp webhook not configured');
  if (mode === 'subscribe' && token && safeEqual(token, env.whatsapp.verifyToken)) {
    console.log('[whatsapp] webhook verified by Meta');
    return res.status(200).type('text/plain').send(String(challenge ?? ''));
  }
  res.status(403).send('Verification failed');
});

/**
 * POST /webhooks/whatsapp - incoming messages from Meta.
 * Replies 200 straight away (Meta retries slow or failed deliveries), then stores the messages.
 * Duplicate deliveries are dropped by the (platform, externalId) unique index.
 */
router.post('/', (req, res) => {
  if (!env.whatsapp.appSecret) return res.status(503).json({ error: 'WhatsApp webhook not configured' });
  if (!isValidSignature(req.rawBody, req.get('x-hub-signature-256'), env.whatsapp.appSecret)) {
    console.warn('[whatsapp] rejected webhook with invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  res.sendStatus(200);

  const messages = extractWhatsAppMessages(req.body);
  patchStatus('whatsapp', { lastSeenAt: new Date() });

  (async () => {
    for (const m of messages) {
      try {
        await ingestMessage(m);
      } catch (err) {
        console.error('[whatsapp] failed to store message', m.externalId, err.message);
      }
    }
  })();
});

export default router;
