import { google } from 'googleapis';
import { env } from '../../config/env.js';
import { ingestMessage } from '../../core/messageService.js';
import { getState, setState } from '../../models/SyncState.js';
import { setStatus } from '../status.js';
import { normalizeGmailMessage } from './parse.js';

const NAME = 'gmail';
const HISTORY_KEY = 'gmail:historyId';
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export function createOAuthClient() {
  return new google.auth.OAuth2(env.gmail.clientId, env.gmail.clientSecret, env.gmail.redirectUri);
}

/**
 * Gmail connector (read-only, gmail.readonly scope).
 *
 * Sync strategy: Gmail History API.
 *  - First run: backfill the latest N messages and store the mailbox historyId.
 *  - Then every GMAIL_POLL_INTERVAL_SEC: fetch only what changed since the stored historyId.
 * `sync()` is exposed so a Pub/Sub push webhook can trigger it instantly later.
 */
export function createGmailConnector() {
  let gmail = null;
  let timer = null;
  let running = false;
  let syncing = false;
  let failures = 0;

  async function fetchAndIngest(id) {
    try {
      const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      const normalized = normalizeGmailMessage(data);
      if (normalized) await ingestMessage(normalized);
    } catch (err) {
      if (err.code === 404) return; // deleted before we fetched it
      throw err;
    }
  }

  async function backfill() {
    const { data: profile } = await gmail.users.getProfile({ userId: 'me' });
    // Take the historyId BEFORE listing so nothing arriving during backfill is missed.
    const startHistoryId = profile.historyId;

    const { data } = await gmail.users.messages.list({
      userId: 'me',
      maxResults: env.gmail.backfillCount,
      q: 'in:inbox OR in:sent',
    });

    const ids = (data.messages || []).map((m) => m.id).reverse(); // oldest first
    for (const id of ids) await fetchAndIngest(id);

    await setState(HISTORY_KEY, startHistoryId);
    console.log(`[gmail] backfilled ${ids.length} messages`);
  }

  async function syncHistory() {
    const startHistoryId = await getState(HISTORY_KEY);
    if (!startHistoryId) return backfill();

    const newIds = new Set();
    let pageToken;
    let latestHistoryId = startHistoryId;

    try {
      do {
        const { data } = await gmail.users.history.list({
          userId: 'me',
          startHistoryId,
          historyTypes: ['messageAdded'],
          pageToken,
        });
        for (const h of data.history || []) {
          for (const added of h.messagesAdded || []) newIds.add(added.message.id);
        }
        if (data.historyId) latestHistoryId = data.historyId;
        pageToken = data.nextPageToken;
      } while (pageToken);
    } catch (err) {
      // historyId too old (Gmail keeps roughly a week): start fresh.
      if (err.code === 404) {
        console.warn('[gmail] history expired, re-backfilling');
        return backfill();
      }
      throw err;
    }

    for (const id of newIds) await fetchAndIngest(id);
    await setState(HISTORY_KEY, latestHistoryId);
    if (newIds.size) console.log(`[gmail] synced ${newIds.size} new messages`);
  }

  async function sync() {
    if (syncing || !gmail) return; // never overlap
    syncing = true;
    try {
      await syncHistory();
      if (failures) setStatus(NAME, 'connected');
      failures = 0;
    } catch (err) {
      failures++;
      const msg = /invalid_grant/i.test(err.message)
        ? 'Refresh token revoked or expired. Run `npm run gmail:auth` again.'
        : err.message;
      console.error('[gmail] sync failed:', msg);
      setStatus(NAME, 'error', msg);
    } finally {
      syncing = false;
    }
  }

  function scheduleNext() {
    if (!running) return;
    // Back off on repeated errors: 1x, 2x, 4x ... capped at 10 minutes.
    const base = env.gmail.pollIntervalSec * 1000;
    const delay = Math.min(base * 2 ** Math.min(failures, 6), 10 * 60 * 1000);
    timer = setTimeout(async () => {
      await sync();
      scheduleNext();
    }, delay);
  }

  return {
    name: NAME,
    sync,

    async start() {
      setStatus(NAME, 'starting');

      const auth = createOAuthClient();
      auth.setCredentials({ refresh_token: env.gmail.refreshToken });
      gmail = google.gmail({ version: 'v1', auth });

      // Verifies credentials early so a bad token fails at startup.
      const { data: profile } = await gmail.users.getProfile({ userId: 'me' });
      console.log(`[gmail] connected as ${profile.emailAddress}`);

      running = true;
      setStatus(NAME, 'connected');

      await sync();
      scheduleNext();
    },

    async stop() {
      running = false;
      if (timer) clearTimeout(timer);
      timer = null;
      gmail = null;
      setStatus(NAME, 'stopped');
    },
  };
}
