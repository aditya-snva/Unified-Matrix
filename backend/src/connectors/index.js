import { isConfigured } from '../config/env.js';
import { setStatus } from './status.js';
import { createTelegramConnector } from './telegram/index.js';
import { createGmailConnector } from './gmail/index.js';

const RETRY_MS = 60_000;

const registry = [
  { name: 'telegram', configured: isConfigured.telegram, create: createTelegramConnector },
  { name: 'gmail', configured: isConfigured.gmail, create: createGmailConnector },
];

const active = new Map();
const retryTimers = new Map();

async function startOne(entry) {
  const connector = entry.create();
  try {
    await connector.start();
    active.set(entry.name, connector);
  } catch (err) {
    console.error(`[${entry.name}] failed to start:`, err.message);
    setStatus(entry.name, 'error', err);
    await connector.stop().catch(() => {});
    setStatus(entry.name, 'error', err); // keep the error visible after stop()
    // Retry later (network down at boot, etc.)
    retryTimers.set(entry.name, setTimeout(() => startOne(entry), RETRY_MS));
  }
}

/** Start every configured connector. Missing credentials are skipped, not fatal. */
export async function startConnectors() {
  // SMS and WhatsApp are push-only (webhooks), so they have no connector process; just report status.
  setStatus('sms', isConfigured.sms() ? 'connected' : 'not_configured');
  setStatus('whatsapp', isConfigured.whatsapp() ? 'connected' : 'not_configured');

  await Promise.all(
    registry.map(async (entry) => {
      if (!entry.configured()) {
        console.log(`[${entry.name}] not configured, skipping`);
        setStatus(entry.name, 'not_configured');
        return;
      }
      await startOne(entry);
    }),
  );
}

export async function stopConnectors() {
  for (const t of retryTimers.values()) clearTimeout(t);
  retryTimers.clear();
  await Promise.all([...active.values()].map((c) => c.stop().catch(() => {})));
  active.clear();
}

export function getConnector(name) {
  return active.get(name);
}
