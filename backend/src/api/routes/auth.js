import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { checkPassword, signToken } from '../../auth/auth.js';

const router = Router();

// 10 login attempts per 15 minutes per IP.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

// POST /api/auth/login  { password }
router.post('/login', loginLimiter, (req, res) => {
  if (!checkPassword(req.body?.password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  res.json({ token: signToken() });
});

export default router;
