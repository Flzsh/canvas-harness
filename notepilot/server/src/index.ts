import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

// Minimal .env loader (no dependency): KEY=VALUE lines, existing env wins.
for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const config = loadConfig();
const { handler } = createApp(config);
createServer(handler).listen(config.port, () => {
  console.log(`NotePilot proxy listening on http://localhost:${config.port} → ${config.upstreamBaseUrl} (${config.tokens.size} users)`);
});
