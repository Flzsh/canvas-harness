'use strict';
// Publish a release to the Chrome Web Store with the store's API (v2), so no one has to click through the dashboard.
//
//   node scripts/store-publish.cjs status            check the credentials and show the item's current state
//   node scripts/store-publish.cjs upload            upload dist/Canvas-Harness-<version>.zip, then submit it for review
//   node scripts/store-publish.cjs upload --no-submit   upload only (submit later from the dashboard or with `submit`)
//   node scripts/store-publish.cjs submit            submit the last uploaded package for review
//
// It signs in as a Google Cloud service account that the publisher has added in the Developer Dashboard (Account).
// Nothing secret is in this repository: the settings live in a private folder outside it,
//   %USERPROFILE%\.canvas-harness-store\config.json  (or the file named by CH_STORE_CONFIG)
// with { "keyFile": "<path to the service account's JSON key>", "publisherId": "...", "extensionId": "..." }.
// Uses only Node's own crypto and fetch.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');

const API = 'https://chromewebstore.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const b64url = data => Buffer.from(data).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function loadConfig() {
  const file = process.env.CH_STORE_CONFIG || path.join(os.homedir(), '.canvas-harness-store', 'config.json');
  if (!fs.existsSync(file)) throw Error(`No store settings at ${file}. See the comment at the top of scripts/store-publish.cjs.`);
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['keyFile', 'publisherId', 'extensionId']) if (!config[key]) throw Error(`${file} is missing "${key}".`);
  const keyPath = path.resolve(path.dirname(file), config.keyFile);
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  if (key.type !== 'service_account' || !key.private_key || !key.client_email) throw Error(`${keyPath} is not a service account key.`);
  return { ...config, key };
}

// A signed JWT for the service account (RS256), exchanged for an access token (OAuth 2.0 JWT bearer grant).
function assertion(key, now = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: key.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signature = crypto.createSign('RSA-SHA256').update(`${head}.${claims}`).sign(key.private_key);
  return `${head}.${claims}.${b64url(signature)}`;
}
async function accessToken(key, fetchImpl = fetch) {
  const response = await fetchImpl(key.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: assertion(key) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw Error(`Google refused the sign-in (${response.status}): ${body.error_description || body.error || 'no token'}`);
  return body.access_token;
}

async function call(token, method, url, body, headers = {}) {
  const response = await fetch(url, { method, headers: { authorization: `Bearer ${token}`, ...headers }, body });
  const text = await response.text();let data;try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw Error(`${method} ${url.replace(API, '')} failed (${response.status}): ${data.error?.message || text.slice(0, 300)}`);
  return data;
}
const item = c => `publishers/${encodeURIComponent(c.publisherId)}/items/${encodeURIComponent(c.extensionId)}`;
const status = (token, c) => call(token, 'GET', `${API}/v2/${item(c)}:fetchStatus`);
const describe = s => {
  const rev = r => r ? `${r.state || '?'}${(r.distributionChannels || []).map(d => ` v${d.crxVersion}${d.deployPercentage != null ? ` (${d.deployPercentage}%)` : ''}`).join('')}` : 'none';
  return `published: ${rev(s.publishedItemRevisionStatus)} | submitted: ${rev(s.submittedItemRevisionStatus)}${s.lastAsyncUploadState ? ` | last upload: ${s.lastAsyncUploadState}` : ''}${s.takenDown ? ' | TAKEN DOWN' : ''}${s.warned ? ' | WARNED' : ''}`;
};

async function main(argv) {
  const [command = 'status'] = argv, config = loadConfig(), token = await accessToken(config.key);
  if (command === 'status') { console.log(describe(await status(token, config))); return; }
  if (command === 'upload') {
    const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extension', 'manifest.json'), 'utf8')).version;
    const zip = path.join(__dirname, '..', 'dist', `Canvas-Harness-${version}.zip`);
    if (!fs.existsSync(zip)) throw Error(`${zip} is missing: run npm run build first.`);
    console.log(`Uploading ${path.basename(zip)} (${fs.statSync(zip).size} bytes)…`);
    let result = await call(token, 'POST', `${API}/upload/v2/${item(config)}:upload`, fs.readFileSync(zip), { 'content-type': 'application/zip' });
    for (let i = 0; result.uploadState === 'UPLOAD_IN_PROGRESS' && i < 30; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const s = await status(token, config);result = { ...result, uploadState: s.lastAsyncUploadState };
    }
    console.log(`Upload: ${result.uploadState || 'done'}${result.crxVersion ? `, version ${result.crxVersion}` : ''}`);
    if (result.uploadState && !/SUCCEEDED|SUCCESS/.test(result.uploadState)) throw Error(`The upload did not finish (${result.uploadState}).`);
    if (argv.includes('--no-submit')) return;
  } else if (command !== 'submit') throw Error(`Unknown command "${command}" (status, upload, submit).`);
  const published = await call(token, 'POST', `${API}/v2/${item(config)}:publish`, JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }), { 'content-type': 'application/json' });
  console.log(`Submitted for review: ${published.state || 'ok'}`);
  for (const w of published.warningInfo?.warnings || []) console.log(`  warning ${w.reason}: ${w.description}`);
  console.log(describe(await status(token, config)));
}

module.exports = { assertion, accessToken, describe };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(1); });
