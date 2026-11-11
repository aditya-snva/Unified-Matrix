import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { env } from '../../config/env.js';
import { ingestMessage } from '../../core/messageService.js';
import { setStatus } from '../status.js';
import { normalizeTelegramMessage } from './normalize.js';

const NAME = 'telegram';

/**
 * Telegram connector (read-only) using the MTProto user API via GramJS.
 * Requires a session string generated once with `npm run telegram:login`.
 */
export function createTelegramConnector() {
  let client = null;
  let handler = null;
  const newMessageEvent = new NewMessage({});

  function shouldSkip(message) {
    // Broadcast channels can be very noisy; groups and private chats are always included.
    return message.isChannel && !message.isGroup && !env.telegram.includeChannels;
  }

  async function handle(message, source) {
    try {
      if (shouldSkip(message)) return;
      const normalized = await normalizeTelegramMessage(message);
      if (normalized) await ingestMessage(normalized);
    } catch (err) {
      console.error(`[telegram] failed to ingest ${source} message:`, err.message);
    }
  }

  /** Pull recent messages from top dialogs so anything missed while offline shows up. */
  async function backfill() {
    const { backfillDialogs, backfillPerDialog } = env.telegram;
    if (!backfillDialogs || !backfillPerDialog) return;

    let count = 0;
    for await (const dialog of client.iterDialogs({ limit: backfillDialogs })) {
      if (dialog.isChannel && !dialog.isGroup && !env.telegram.includeChannels) continue;
      try {
        const messages = await client.getMessages(dialog.entity, { limit: backfillPerDialog });
        // Oldest first, so conversation previews end on the newest message.
        for (const message of [...messages].reverse()) {
          await handle(message, 'backfill');
          count++;
        }
      } catch (err) {
        console.warn(`[telegram] backfill skipped dialog "${dialog.title}":`, err.message);
      }
    }
    console.log(`[telegram] backfill checked ${count} messages`);
  }

  return {
    name: NAME,

    async start() {
      setStatus(NAME, 'starting');

      client = new TelegramClient(new StringSession(env.telegram.session), env.telegram.apiId, env.telegram.apiHash, {
        connectionRetries: Infinity, // keep reconnecting on network drops
        autoReconnect: true,
      });
      client.setLogLevel('error');

      await client.connect();
      if (!(await client.checkAuthorization())) {
        throw new Error('Telegram session is invalid or expired. Run `npm run telegram:login` again.');
      }

      const me = await client.getMe();
      console.log(`[telegram] logged in as ${me.firstName || ''} (@${me.username || me.id})`);

      handler = (event) => handle(event.message, 'live');
      client.addEventHandler(handler, newMessageEvent);

      setStatus(NAME, 'connected');

      // Run backfill in the background so startup isn't blocked.
      backfill().catch((err) => console.error('[telegram] backfill failed:', err.message));
    },

    async stop() {
      if (client) {
        if (handler) client.removeEventHandler(handler, newMessageEvent);
        await client.disconnect().catch(() => {});
        await client.destroy().catch(() => {});
        client = null;
      }
      setStatus(NAME, 'stopped');
    },
  };
}
