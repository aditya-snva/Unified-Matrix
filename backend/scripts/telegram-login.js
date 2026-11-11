// One-time Telegram login. Prints a session string to put in .env as TELEGRAM_SESSION.
// Usage: npm run telegram:login   (needs TELEGRAM_API_ID and TELEGRAM_API_HASH in .env)
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { env } from '../src/config/env.js';

if (!env.telegram.apiId || !env.telegram.apiHash) {
  console.error('Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first (get them at https://my.telegram.org).');
  process.exit(1);
}

const rl = readline.createInterface({ input: stdin, output: stdout });
const client = new TelegramClient(new StringSession(''), env.telegram.apiId, env.telegram.apiHash, {
  connectionRetries: 5,
});
client.setLogLevel('error');

try {
  await client.start({
    phoneNumber: () => rl.question('Phone number (with country code, e.g. +91...): '),
    phoneCode: () => rl.question('Code you received in Telegram: '),
    password: () => rl.question('2FA password (leave empty if none): '),
    onError: (err) => console.error('Error:', err.message),
  });

  const session = client.session.save();
  console.log('\nLogin successful. Add this line to your .env (keep it SECRET, it gives full account access):\n');
  console.log(`TELEGRAM_SESSION=${session}\n`);
} finally {
  rl.close();
  await client.disconnect();
  process.exit(0);
}
