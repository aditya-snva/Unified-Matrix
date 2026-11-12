# Unified Matrix – Frontend

Angular 22 (standalone, signals, zoneless) + Tailwind CSS v4 with custom components. Installable **PWA**.

## Run

```bash
npm install
npm start          # http://localhost:4200 (backend must run on http://localhost:4000)
npm test           # unit tests (Vitest)
npm run build      # production build -> dist/unified-matrix/browser (includes service worker)
```

The backend URL is set in `src/environments/environment*.ts` (`apiUrl`). The backend's `CLIENT_ORIGIN` must include the URL this app is served from.

**Vercel:** `vercel.json` builds with `npm run build:vercel`, which writes the `API_URL` environment variable (set in Vercel) into the production `apiUrl`. See [../deploy/README.md](../deploy/README.md).

## PWA

- The service worker is **only active in production builds**, not during `npm start`.
- Install prompts and service workers need **HTTPS** (or `localhost`). Once deployed on Vercel it can be installed from your phone's browser.
- New versions are detected automatically, and the app asks before reloading.
- App icons live in `public/icons/` (Angular defaults for now; replace with your own PNGs at the same sizes).

## Browser support

Tailwind v4 needs **Chrome/Edge 111+, Safari 16.4+, Firefox 128+**. Older browsers render the app without colours or the responsive layout.

## Structure

```
src/app/
  core/       models, api, auth (service, interceptor, guards), socket, inbox.store (state),
              theme, notifications, time helpers
  shared/     custom UI: icon, platform-icon, avatar, status-dot, logo, time pipes
  features/
    login/    password login
    shell/    layout + sidebar (drawer on mobile) + reconnect banner
    inbox/    conversation list, conversation view (chat bubbles), email view (sandboxed iframe)
    search/   cross-platform search with highlighting
    settings/ source status, SMS webhook URL, theme, notifications
```

## Security notes

- Email HTML renders in an `<iframe sandbox>` **without `allow-scripts`**, plus a CSP that blocks scripts, forms and frames.
- The JWT is kept in `localStorage` and sent only to the backend's `/api` routes. A `401` response logs you out.
