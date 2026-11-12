import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import apiRoutes from './api/routes/index.js';
import smsWebhook from './webhooks/sms.js';
import whatsappWebhook from './webhooks/whatsapp.js';
import httpSmsWebhook from './webhooks/httpsms.js';

const app = express();

app.set('trust proxy', 1); // behind Cloudflare Tunnel / reverse proxy
app.use(helmet());
app.use(cors({ origin: env.clientOrigin }));
app.use(
  express.json({
    limit: '2mb',
    // Keep the exact bytes: WhatsApp webhook signatures are computed over the raw body.
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use('/api', apiRoutes);
app.use('/webhooks/sms', smsWebhook);
app.use('/webhooks/whatsapp', whatsappWebhook);
app.use('/webhooks/httpsms', httpSmsWebhook);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error('[http]', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
