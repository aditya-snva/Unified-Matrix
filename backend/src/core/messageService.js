import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { eventBus } from './eventBus.js';

const PREVIEW_LEN = 160;

export const conversationKey = (platform, externalId) => `${platform}:${externalId}`;

/**
 * Save a normalized message from any connector.
 * Duplicates (same platform + externalId) are ignored, so connectors can safely retry and backfill.
 *
 * Normalized input shape:
 * {
 *   platform: 'sms' | 'telegram' | 'gmail',
 *   externalId: string,
 *   conversation: { externalId: string, title?: string, type?: string },
 *   from: { name?: string, handle?: string },
 *   direction: 'in' | 'out',
 *   subject?: string, text: string, html?: string,
 *   attachments?: [{ type, name, mimeType, size }],
 *   timestamp: Date,
 *   meta?: object
 * }
 *
 * @returns {Promise<{ created: boolean, message?: object, conversation?: object }>}
 */
export async function ingestMessage(input) {
  const key = conversationKey(input.platform, input.conversation.externalId);
  const timestamp = input.timestamp instanceof Date ? input.timestamp : new Date(input.timestamp);
  const direction = input.direction === 'out' ? 'out' : 'in';

  const doc = {
    platform: input.platform,
    externalId: String(input.externalId),
    conversationKey: key,
    from: input.from || {},
    direction,
    subject: input.subject,
    text: input.text || '',
    html: input.html,
    attachments: input.attachments || [],
    timestamp,
    read: direction === 'out', // your own messages count as read
    meta: input.meta,
  };

  let result;
  try {
    result = await Message.updateOne(
      { platform: doc.platform, externalId: doc.externalId },
      { $setOnInsert: doc },
      { upsert: true },
    );
  } catch (err) {
    if (err?.code === 11000) return { created: false }; // concurrent duplicate
    throw err;
  }

  if (!result.upsertedCount) return { created: false };

  const message = await Message.findById(result.upsertedId).lean();
  const conversation = await upsertConversation(key, input, message);

  eventBus.emit('message:new', { message, conversation });
  return { created: true, message, conversation };
}

async function upsertConversation(key, input, message) {
  const preview = (message.subject ? `${message.subject} - ` : '') + (message.text || '');
  const lastMessage = {
    text: preview.slice(0, PREVIEW_LEN),
    fromName: message.from?.name || message.from?.handle,
    direction: message.direction,
    timestamp: message.timestamp,
  };

  // Ensure the conversation exists and keep its title fresh.
  const set = {};
  if (input.conversation.title) set.title = input.conversation.title;
  if (input.conversation.type) set.type = input.conversation.type;

  await Conversation.updateOne(
    { key },
    {
      $setOnInsert: { key, platform: input.platform, externalId: String(input.conversation.externalId) },
      ...(Object.keys(set).length ? { $set: set } : {}),
    },
    { upsert: true },
  );

  // Only move lastMessage forward (backfill can deliver older messages later).
  await Conversation.updateOne(
    { key, $or: [{ lastMessageAt: null }, { lastMessageAt: { $lte: message.timestamp } }] },
    { $set: { lastMessage, lastMessageAt: message.timestamp } },
  );

  if (!message.read) {
    await Conversation.updateOne({ key }, { $inc: { unreadCount: 1 } });
  }

  return Conversation.findOne({ key }).lean();
}

export async function markConversationRead(key) {
  await Message.updateMany({ conversationKey: key, read: false }, { $set: { read: true } });
  const conversation = await Conversation.findOneAndUpdate(
    { key },
    { $set: { unreadCount: 0 } },
    { returnDocument: 'after' },
  ).lean();
  if (conversation) eventBus.emit('conversation:updated', { conversation });
  return conversation;
}
