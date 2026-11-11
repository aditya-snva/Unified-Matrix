// Convert a Gmail API message (format: 'full') into the unified message shape.

const MAX_HTML = 200_000; // cap stored HTML size per email
const MAX_TEXT = 50_000;

const decode = (data) => (data ? Buffer.from(data, 'base64url').toString('utf8') : '');

function header(headers, name) {
  const h = headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

/** "Jane Doe <jane@x.com>" -> { name: 'Jane Doe', handle: 'jane@x.com' } */
export function parseAddress(value) {
  if (!value) return {};
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim() || match[2].trim(), handle: match[2].trim().toLowerCase() };
  const email = value.trim().toLowerCase();
  return { name: email, handle: email };
}

/** Walk the MIME tree and collect text, html and attachments. */
function walk(part, out) {
  if (!part) return;
  const mime = part.mimeType || '';

  if (part.filename && part.body?.attachmentId) {
    out.attachments.push({
      type: mime.startsWith('image/') ? 'image' : 'file',
      name: part.filename,
      mimeType: mime,
      size: part.body.size,
    });
    return;
  }

  if (mime === 'text/plain' && part.body?.data && !out.text) out.text = decode(part.body.data);
  else if (mime === 'text/html' && part.body?.data && !out.html) out.html = decode(part.body.data);

  for (const child of part.parts || []) walk(child, out);
}

export function htmlToText(html) {
  return html
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * @param {object} msg Gmail API message resource
 * @returns {object|null} unified message, or null to skip
 */
export function normalizeGmailMessage(msg) {
  const labels = msg.labelIds || [];
  // Only inbox and sent mail; skip drafts, spam, trash, chats.
  if (labels.includes('DRAFT') || labels.includes('SPAM') || labels.includes('TRASH') || labels.includes('CHAT')) {
    return null;
  }
  if (!labels.includes('INBOX') && !labels.includes('SENT')) return null;

  const headers = msg.payload?.headers || [];
  const subject = header(headers, 'Subject') || '(no subject)';
  const isSent = labels.includes('SENT') && !labels.includes('INBOX');

  const body = { text: '', html: '', attachments: [] };
  walk(msg.payload, body);

  let text = body.text || (body.html ? htmlToText(body.html) : '') || msg.snippet || '';
  if (text.length > MAX_TEXT) text = `${text.slice(0, MAX_TEXT)}\n...[truncated]`;

  const html = body.html && body.html.length <= MAX_HTML ? body.html : undefined;

  return {
    platform: 'gmail',
    externalId: msg.id,
    conversation: { externalId: msg.threadId, title: subject, type: 'email' },
    from: parseAddress(header(headers, 'From')),
    direction: isSent ? 'out' : 'in',
    subject,
    text,
    html,
    attachments: body.attachments,
    timestamp: new Date(Number(msg.internalDate) || Date.now()),
    meta: {
      to: header(headers, 'To'),
      cc: header(headers, 'Cc') || undefined,
      labels,
      unreadInGmail: labels.includes('UNREAD'),
    },
  };
}
