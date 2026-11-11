import { Router } from 'express';
import { requireAuth } from '../../auth/auth.js';
import { getStatuses } from '../../connectors/status.js';
import authRoutes from './auth.js';
import conversationRoutes from './conversations.js';
import messageRoutes from './messages.js';

const router = Router();

// Public
router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
router.use('/auth', authRoutes);

// Protected (user JWT)
router.use(requireAuth);
router.get('/status', (req, res) => res.json(getStatuses()));
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);

export default router;
