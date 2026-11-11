// Convert a GramJS Api.Message into the unified message shape.

export function displayName(entity) {
  if (!entity) return undefined;
  if (entity.title) return entity.title; // group / channel
  const full = [entity.firstName, entity.lastName].filter(Boolean).join(' ');
  return full || entity.username || entity.phone || undefined;
}

export function handleOf(entity) {
  if (!entity) return undefined;
  if (entity.username) return `@${entity.username}`;
  if (entity.phone) return `+${entity.phone}`;
  return entity.id !== undefined ? String(entity.id) : undefined;
}

export function chatType(message) {
  if (message.isPrivate) return 'private';
  if (message.isGroup) return 'group';
  if (message.isChannel) return 'channel';
  return 'private';
}

function attachmentsOf(message) {
  const media = message.media;
  if (!media) return [];

  const className = media.className || '';
  if (className === 'MessageMediaPhoto') return [{ type: 'photo' }];

  if (className === 'MessageMediaDocument' && media.document) {
    const doc = media.document;
    const fileAttr = (doc.attributes || []).find((a) => a.className === 'DocumentAttributeFilename');
    const mime = doc.mimeType || '';
    let type = 'document';
    if (mime.startsWith('video/')) type = 'video';
    else if (mime.startsWith('audio/')) type = 'audio';
    else if (mime.startsWith('image/')) type = 'image';
    return [{ type, name: fileAttr?.fileName, mimeType: mime, size: doc.size ? Number(doc.size) : undefined }];
  }

  // Location, contact, poll, sticker, etc.
  return [{ type: className.replace('MessageMedia', '').toLowerCase() || 'media' }];
}

/**
 * @param {import('telegram').Api.Message} message
 * @returns {Promise<object|null>} unified message, or null to skip
 */
export async function normalizeTelegramMessage(message) {
  // Skip service messages (joined group, pinned, etc.)
  if (!message || message.className !== 'Message') return null;

  const [sender, chat] = await Promise.all([
    message.getSender().catch(() => undefined),
    message.getChat().catch(() => undefined),
  ]);

  const chatId = String(message.chatId);
  const text = message.message || '';
  const attachments = attachmentsOf(message);

  return {
    platform: 'telegram',
    // Message ids are only unique per chat for channels/supergroups, so include the chat id.
    externalId: `${chatId}:${message.id}`,
    conversation: {
      externalId: chatId,
      title: displayName(chat) || displayName(sender),
      type: chatType(message),
    },
    from: message.out
      ? { name: 'You' }
      : { name: displayName(sender), handle: handleOf(sender) },
    direction: message.out ? 'out' : 'in',
    text: text || (attachments.length ? `[${attachments[0].type}]` : ''),
    attachments,
    timestamp: new Date(message.date * 1000),
    meta: { messageId: message.id, chatId },
  };
}
