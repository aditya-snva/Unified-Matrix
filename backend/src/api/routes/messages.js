import { Router } from 'express';
import { Message } from '../../models/Message.js';

const router = Router();
const PLATFORMS = ['sms', 'telegram', 'gmail'];

/**
 * GET /api/messages?q=invoice&platform=gmail&limit=30&before=<ISO date>
 * Search across all platforms (q uses MongoDB full-text search) or list the latest messages.
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, platform, before } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

    const filter = {};
    if (q) filter.$text = { $search: String(q) };
    if (platform && PLATFORMS.includes(platform)) filter.platform = platform;
    if (before) filter.timestamp = { $lt: new Date(before) };

    const items = await Message.find(filter, { html: 0 }).sort({ timestamp: -1 }).limit(limit).lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

/** GET /api/messages/:id  - full message (includes email HTML) */
router.get('/:id', async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id).lean();
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json(message);
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });
    next(err);
  }
});

export default router;
