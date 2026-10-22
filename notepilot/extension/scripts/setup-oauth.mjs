#!/usr/bin/env node
/**
 * Pins a stable extension ID (required for a Google OAuth "Chrome Extension" client) and records
 * the OAuth client ID in extension/.env.local.
 *
 *   npm run setup:oauth                                   → creates a key, prints the extension ID
 *   npm run setup:oauth -- --client-id=XXXX.apps.googleusercontent.com
 *
 * The private key is written to extension/notepilot-key.pem (keep it; it is only needed if you
 * later want to pack a .crx with the same ID). Only the public key goes into the manifest.
 */
import { generateKeyPairSync, createHash, createPublicKey } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');
const pemPath = resolve(root, 'notepilot-key.pem');
const clientId = process.argv.find((a) => a.startsWith('--client-id='))?.split('=')[1];

const env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const get = (k) => new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1]?.trim();
const set = (text, k, v) => (new RegExp(`^${k}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : `${text.trimEnd()}\n${k}=${v}\n`.trimStart());

let publicKeyB64 = get('NOTEPILOT_EXTENSION_KEY');
if (!publicKeyB64) {
  let privatePem;
  if (existsSync(pemPath)) privatePem = readFileSync(pemPath, 'utf8');
  else {
    ({ privateKey: privatePem } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }));
    writeFileSync(pemPath, privatePem, { mode: 0o600 });
  }
  publicKeyB64 = createPublicKey(privatePem).export({ type: 'spki', format: 'der' }).toString('base64');
}

// Chrome extension ID = first 32 hex chars of SHA-256(DER public key), mapped 0-f → a-p.
const der = Buffer.from(publicKeyB64, 'base64');
const extensionId = [...createHash('sha256').update(der).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

let next = set(env, 'NOTEPILOT_EXTENSION_KEY', publicKeyB64);
if (clientId) next = set(next, 'NOTEPILOT_OAUTH_CLIENT_ID', clientId);
writeFileSync(envPath, next);

console.log(`
Extension ID: ${extensionId}

Next steps (Google Cloud Console → https://console.cloud.google.com):
  1. Enable the "Google Docs API" and the "Google Drive API" for your project.
  2. OAuth consent screen: add the scopes .../auth/documents.readonly and .../auth/drive.file; add yourself as a test user.
  3. Credentials → Create OAuth client ID → Application type "Chrome Extension",
     Item ID = ${extensionId}
  4. npm run setup:oauth -- --client-id=<the client ID>   ${clientId ? '(done ✓)' : ''}
  5. npm run build, then load extension/dist in chrome://extensions (Developer mode → Load unpacked).
`);
