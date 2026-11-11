import 'dotenv/config';

const bool = (v, def = false) =>
  v === undefined || v === '' ? def : ['1', 'true', 'yes'].includes(String(v).toLowerCase());
const num = (v, def) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? def : Number(v));

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 4000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/unified_matrix',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:4200',

  auth: {
    adminPassword: process.env.ADMIN_PASSWORD || '',
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  sms: {
    webhookToken: process.env.SMS_WEBHOOK_TOKEN || '',
  },

  whatsapp: {
    // Any string you choose; paste the same value in Meta's webhook settings.
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    // Meta App > Settings > Basic > App secret. Used to verify webhook signatures.
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
  },

  telegram: {
    apiId: num(process.env.TELEGRAM_API_ID, 0),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    session: process.env.TELEGRAM_SESSION || '',
    includeChannels: bool(process.env.TELEGRAM_INCLUDE_CHANNELS, false),
    backfillDialogs: num(process.env.TELEGRAM_BACKFILL_DIALOGS, 20),
    backfillPerDialog: num(process.env.TELEGRAM_BACKFILL_PER_DIALOG, 10),
  },

  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:4001/oauth2callback',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    pollIntervalSec: num(process.env.GMAIL_POLL_INTERVAL_SEC, 15),
    backfillCount: num(process.env.GMAIL_BACKFILL_COUNT, 25),
  },
};

export const isConfigured = {
  telegram: () => Boolean(env.telegram.apiId && env.telegram.apiHash && env.telegram.session),
  gmail: () => Boolean(env.gmail.clientId && env.gmail.clientSecret && env.gmail.refreshToken),
  sms: () => Boolean(env.sms.webhookToken),
  whatsapp: () => Boolean(env.whatsapp.verifyToken && env.whatsapp.appSecret),
};
