# Unified Matrix

A personal, read-only inbox that shows **SMS (Android)**, **WhatsApp Business**, **Telegram** and **Gmail** messages in one place, in real time.

| Folder | What | Stack |
|---|---|---|
| [backend/](backend/) | API, connectors, SMS webhook, live updates | Node.js, Express, MongoDB, Socket.IO |
| [frontend/](frontend/) | Web app, installable as a PWA | Angular 22, Tailwind CSS v4 |

## Quick start

```bash
# 1. Backend (needs MongoDB running locally)
cd backend
npm install
cp .env.example .env      # fill in ADMIN_PASSWORD, JWT_SECRET, etc.
npm run dev               # http://localhost:4000

# 2. Frontend
cd frontend
npm install
npm start                 # http://localhost:4200
```

See [backend/README.md](backend/README.md) for connecting Telegram, Gmail and SMS, and [frontend/README.md](frontend/README.md) for PWA notes.
