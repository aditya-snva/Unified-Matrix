// Convert WhatsApp Business Cloud API webhook payloads into unified messages.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
//
// Handled webhook fields:
//   messages            - messages customers send to your business number (direction: in)
//   smb_message_echoes  - messages you send from the WhatsApp Business app on the same number,
//                         when the number uses "coexistence" (direction: out)

const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

const plus = (n) => (n ? `+${String(n).replace(/^\+/, '')}` : '');

/** Human-readable text + attachments for any WhatsApp message type. */
export function describeMessage(msg) {
  const type = msg.type;

  if (type === 'text') return { text: msg.text?.body || '', attachments: [] };

  if (MEDIA_TYPES.includes(type)) {
    const media = msg[type] || {};
    return {
      text: media.caption || `[${type}]`,
      attachments: [
        {
          type: type === 'sticker' ? 'image' : type,
          name: media.filename,
          mimeType: media.mime_type,
        },
      ],
      mediaId: media.id,
    };
  }

  switch (type) {
    case 'location': {
      const l = msg.location || {};
      const place = [l.name, l.address].filter(Boolean).join(', ');
      return { text: `📍 ${place || `${l.latitude}, ${l.longitude}`}`, attachments: [] };
    }
    case 'contacts': {
      const names = (msg.contacts || []).map((c) => c.name?.formatted_name).filter(Boolean);
      return { text: `👤 ${names.join(', ') || 'Contact card'}`, attachments: [] };
    }
    case 'interactive': {
      const i = msg.interactive || {};
      return { text: i.button_reply?.title || i.list_reply?.title || '[interactive reply]', attachments: [] };
    }
    case 'button':
      return { text: msg.button?.text || '[button]', attachments: [] };
    case 'reaction':
      return { text: msg.reaction?.emoji ? `Reacted ${msg.reaction.emoji}` : '', attachments: [] };
    case 'system':
      return { text: msg.system?.body || '[system message]', attachments: [] };
    default:
      return { text: `[${type || 'unsupported'}]`, attachments: [] };
  }
}

function toUnified(msg, { direction, customer, customerName, metadata }) {
  const { text, attachments, mediaId } = describeMessage(msg);
  if (!text && !attachments.length) return null; // e.g. a removed reaction

  const handle = plus(customer);
  return {
    platform: 'whatsapp',
    externalId: msg.id, // wamid.* - globally unique
    conversation: { externalId: handle, title: customerName || handle, type: 'private' },
    from: direction === 'out' ? { name: 'You' } : { name: customerName || handle, handle },
    direction,
    text,
    attachments,
    timestamp: new Date(Number(msg.timestamp) * 1000 || Date.now()),
    meta: {
      type: msg.type,
      businessNumber: metadata?.display_phone_number,
      phoneNumberId: metadata?.phone_number_id,
      ...(mediaId ? { mediaId } : {}),
      ...(msg.context?.id ? { replyTo: msg.context.id } : {}),
    },
  };
}

/**
 * @param {object} payload Raw webhook body from Meta
 * @returns {object[]} unified messages (may be empty, e.g. for delivery status updates)
 */
export function extractWhatsAppMessages(payload) {
  if (payload?.object !== 'whatsapp_business_account') return [];
  const out = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const metadata = value.metadata;

      if (change.field === 'messages') {
        const names = new Map((value.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
        for (const msg of value.messages || []) {
          const m = toUnified(msg, { direction: 'in', customer: msg.from, customerName: names.get(msg.from), metadata });
          if (m) out.push(m);
        }
        // value.statuses (sent/delivered/read receipts) are ignored: the app is read-only.
      }

      if (change.field === 'smb_message_echoes') {
        for (const msg of value.message_echoes || []) {
          const m = toUnified(msg, { direction: 'out', customer: msg.to, metadata });
          if (m) out.push(m);
        }
      }
    }
  }
  return out;
}
