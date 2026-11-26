'use strict';
// Job biscuit-42: are any of the new lines already in Biscuit's training, validation or docs data? (exact after folding case and punctuation)
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const mine = [...require('./set-a.json').lines, ...require('./set-b.json').lines, ...require('./set-c.json').lines];
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const seen = new Map();
const KEY = /"(?:line|text|input|utterance|prompt)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), st = fs.statSync(p);
    if (st.isDirectory()) { if (!/node_modules|[\\/]biscuit-42$/.test(p)) walk(p); continue; }
    if (!/\.(json|cjs|js|md)$/.test(f) || st.size > 300e6) continue;
    let t; try { t = fs.readFileSync(p, 'utf8'); } catch { continue; }
    for (const m of t.matchAll(KEY)) { const k = norm(m[1]); if (k && !seen.has(k)) seen.set(k, path.relative(ROOT, p)); }
  }
}
for (const d of ['tests', 'docs', 'scripts']) walk(path.join(ROOT, d));
let dup = 0;
for (const l of mine) { const k = norm(l.line); if (seen.has(k)) { dup++; console.log('SEEN', l.id, JSON.stringify(l.line), 'in', seen.get(k)); } }
console.log(JSON.stringify({ lines: mine.length, alreadySeen: dup, corpusLines: seen.size }));
