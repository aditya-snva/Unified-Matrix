import { Router } from 'express';
import { Conversation } from '../../models/Conversation.js';
import { Message } from '../../models/Message.js';
import { markConversationRead } from '../../core/messageService.js';
import { PLATFORMS } from '../../core/platforms.js';

const router = Router();

const clampLimit = (v, def = 30, max = 100) => Math.min(Math.max(Number(v) || def, 1), max);

/**
 * GET /api/conversations?platform=telegram&unread=true&limit=30&before=<ISO date>
 * Newest first. Use `before` = lastMessageAt of the last item to load the next page.
 */
router.get('/', async (req, res, next) => {
  try {
    const { platform, unread, before } = req.query;
    const filter = {};
    if (platform && PLATFORMS.includes(platform)) filter.platform = platform;
    if (unread === 'true') filter.unreadCount = { $gt: 0 };
    if (before) filter.lastMessageAt = { $lt: new Date(before) };

    const items = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(clampLimit(req.query.limit))
      .lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/** GET /api/conversations/unread-counts -> { total, sms, telegram, gmail, whatsapp } */
router.get('/unread-counts', async (req, res, next) => {
  try {
    const rows = await Conversation.aggregate([{ $group: { _id: '$platform', count: { $sum: '$unreadCount' } } }]);
    const counts = { total: 0, ...Object.fromEntries(PLATFORMS.map((p) => [p, 0])) };
    for (const r of rows) {
      counts[r._id] = r.count;
      counts.total += r.count;
    }
    res.json(counts);
  } catch (err) {
    next(err);
  }
});

/** GET /api/conversations/:key  (key looks like "telegram:12345") */
router.get('/:key', async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({ key: req.params.key }).lean();
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/conversations/:key/messages?limit=50&before=<ISO date>
 * Returned oldest -> newest (chat order). Use `before` = timestamp of the first item for older pages.
 */
router.get('/:key/messages', async (req, res, next) => {
  try {
    const filter = { conversationKey: req.params.key };
    if (req.query.before) filter.timestamp = { $lt: new Date(req.query.before) };

    const items = await Message.find(filter)
      .sort({ timestamp: -1 })
      .limit(clampLimit(req.query.limit, 50, 200))
      .lean();
    res.json({ items: items.reverse() });
  } catch (err) {
    next(err);
  }
});

/** POST /api/conversations/:key/read  - mark all messages in the conversation as read */
router.post('/:key/read', async (req, res, next) => {
  try {
    const conversation = await markConversationRead(req.params.key);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

export default router;
