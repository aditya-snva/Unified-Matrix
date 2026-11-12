// Writes the production backend URL into src/environments/environment.ts before `ng build`.
// Used on Vercel: set API_URL (e.g. https://1-2-3-4.sslip.io) in Project Settings > Environment Variables.
// Without API_URL the file is left unchanged.
import { readFileSync, writeFileSync } from 'node:fs';

const apiUrl = (process.env.API_URL || '').trim().replace(/\/+$/, '');
if (!apiUrl) {
  console.log('[set-api-url] API_URL not set; keeping environment.ts as is');
  process.exit(0);
}
if (!/^https:\/\//.test(apiUrl)) {
  console.error(`[set-api-url] API_URL must start with https:// (got "${apiUrl}")`);
  process.exit(1);
}

const file = new URL('../src/environments/environment.ts', import.meta.url);
const src = readFileSync(file, 'utf8');
const out = src.replace(/apiUrl:\s*'[^']*'/, `apiUrl: '${apiUrl}'`);
if (out === src && !src.includes(`apiUrl: '${apiUrl}'`)) {
  console.error('[set-api-url] could not find apiUrl in environment.ts');
  process.exit(1);
}
writeFileSync(file, out);
console.log(`[set-api-url] apiUrl = ${apiUrl}`);
