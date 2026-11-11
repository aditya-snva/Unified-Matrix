// One-time Gmail authorization. Prints a refresh token to put in .env as GMAIL_REFRESH_TOKEN.
// Usage: npm run gmail:auth   (needs GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env)
import http from 'node:http';
import { env } from '../src/config/env.js';
import { createOAuthClient, GMAIL_SCOPES } from '../src/connectors/gmail/index.js';

if (!env.gmail.clientId || !env.gmail.clientSecret) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const redirect = new URL(env.gmail.redirectUri);
const oauth = createOAuthClient();

const authUrl = oauth.generateAuthUrl({
  access_type: 'offline', // needed to get a refresh token
  prompt: 'consent', // always return a refresh token, even if authorized before
  scope: GMAIL_SCOPES,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirect.origin);
  if (url.pathname !== redirect.pathname) {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end(`Authorization failed: ${url.searchParams.get('error') || 'no code'}`);
    return;
  }

  try {
    const { tokens } = await oauth.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Done. You can close this tab and return to the terminal.');
    if (!tokens.refresh_token) {
      console.error('\nNo refresh token returned. Remove the app at https://myaccount.google.com/permissions and retry.');
    } else {
      console.log('\nAdd this line to your .env (keep it SECRET):\n');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    }
  } catch (err) {
    res.writeHead(500).end('Token exchange failed, see terminal.');
    console.error('Token exchange failed:', err.message);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 200);
  }
});

server.listen(Number(redirect.port) || 80, () => {
  console.log('Open this URL in your browser and allow read-only Gmail access:\n');
  console.log(authUrl, '\n');
  console.log(`Waiting for Google to redirect to ${env.gmail.redirectUri} ...`);
});
