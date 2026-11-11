# Unified Matrix – Backend

Express + MongoDB + Socket.IO. Read-only unified inbox for **Android SMS**, **WhatsApp Business**, **Telegram** and **Gmail**.

## Run

```bash
npm install
cp .env.example .env   # then fill in values
npm run dev            # auto-restart on changes
```

Connectors without credentials are skipped. The API still runs, and `GET /api/status` shows `not_configured`.

## Connect platforms

| Platform | Steps |
|---|---|
| **Telegram** | 1. Get `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` at https://my.telegram.org → API development tools<br>2. `npm run telegram:login` → paste the printed `TELEGRAM_SESSION` into `.env` |
| **Gmail** | 1. Google Cloud Console → enable **Gmail API** → OAuth consent screen (add yourself as test user) → create OAuth client, redirect URI `http://localhost:4001/oauth2callback`<br>2. Put `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` in `.env`<br>3. `npm run gmail:auth` → paste the printed `GMAIL_REFRESH_TOKEN` into `.env` |
| **SMS** | Point your Android forwarder at `POST /webhooks/sms` with header `Authorization: Bearer <SMS_WEBHOOK_TOKEN>` |
| **WhatsApp Business** | Official Cloud API (Meta). See [WhatsApp setup](#whatsapp-business-setup) below. |

## WhatsApp Business setup

Messages arrive by webhook from Meta, so the backend must be reachable over **public HTTPS** (e.g. Cloudflare Tunnel exposing `/webhooks/whatsapp`).

1. At developers.facebook.com, create an app (type **Business**) and add the **WhatsApp** product. Add your business phone number.
2. In `.env`:
   - `WHATSAPP_VERIFY_TOKEN`: any long random string (one is generated for you)
   - `WHATSAPP_APP_SECRET`: from **App settings → Basic → App secret**
3. Restart the backend.
4. In Meta: **WhatsApp → Configuration → Webhook**
   - Callback URL: `https://<your-public-host>/webhooks/whatsapp`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN`
   - Click **Verify and save**, then subscribe to the **`messages`** field.
   - Optional: subscribe to **`smb_message_echoes`** to also see replies you send from the WhatsApp Business app (only for numbers onboarded with "coexistence").

Every webhook is checked against Meta's `X-Hub-Signature-256` HMAC (computed with your app secret). Unsigned or forged requests get `401`.

What's stored: text, captions, locations, contact cards, button/list replies and reactions. Media (images, voice notes, documents) is recorded as an attachment with its type, but the file itself isn't downloaded yet. Delivery and read receipts are ignored.

## API

All `/api/*` routes except `health` and `auth/login` need `Authorization: Bearer <JWT>`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | `{ password }` → `{ token }` |
| GET | `/api/status` | Connector states |
| GET | `/api/conversations?platform=&unread=true&limit=&before=` | Inbox, newest first |
| GET | `/api/conversations/unread-counts` | `{ total, sms, telegram, gmail }` |
| GET | `/api/conversations/:key` | One conversation (`key` = `telegram:123`) |
| GET | `/api/conversations/:key/messages?limit=&before=` | Messages, oldest → newest |
| POST | `/api/conversations/:key/read` | Mark as read |
| GET | `/api/messages?q=&platform=&limit=&before=` | Search / latest across platforms |
| GET | `/api/messages/:id` | Full message (with email HTML) |
| POST | `/webhooks/sms` | SMS from phone (single object or array) |
| POST | `/webhooks/sms/heartbeat` | Phone "alive" ping |
| GET | `/webhooks/whatsapp` | Meta webhook verification (`hub.challenge` echo) |
| POST | `/webhooks/whatsapp` | WhatsApp messages from Meta (signature-checked) |

**SMS payload:** `{ "id": "123", "from": "+919876543210", "body": "Hi", "timestamp": 1731312000000, "contactName": "Mom", "sim": 1 }`

## Socket.IO

Connect with `io(url, { auth: { token: '<JWT>' } })`. Events: `message:new`, `conversation:updated`, `connector:status`, `connectors` (on connect).

## Structure

```
src/
  server.js, app.js
  config/        env, db
  models/        Message, Conversation, SyncState
  core/          messageService (normalize → dedupe → save → emit), eventBus
  connectors/    telegram/ (GramJS live + backfill), gmail/ (History API sync), status
  webhooks/      sms
  api/routes/    auth, conversations, messages
  auth/          JWT + device token
  realtime/      Socket.IO
scripts/         telegram-login, gmail-auth
```
