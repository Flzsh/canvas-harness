'use strict';
/* Job biscuit-42: the round 6 short gate (1,333 primary reserved short lines, the owner's standing short-line measure)
   with the Basic pack, as scripts/biscuit-r7-report.cjs reserved() counts it. --tree runs another build's own scripts;
   --rows <file> writes each primary line's verdict (to compare two builds line by line).
   Usage: node scripts/biscuit-42-gate.cjs [--tree <build root>] [--rows out.json] */
const path = require('node:path'), fs = require('node:fs');
const args = process.argv.slice(2), arg = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const tree = path.resolve(arg('--tree') || path.join(__dirname, '..'));
const Eval = require(path.join(tree, 'scripts/biscuit-r6-eval.cjs'));
const Engine = require(path.join(tree, 'extension/biscuit-engine.js'));
const pack = JSON.parse(fs.readFileSync(path.join(tree, 'extension/biscuit-rules/basic.json'), 'utf8'));
const v = Eval.loadShortValidation();
const engine = Engine.create({ pack }), seen = [];
const spy = { evaluate(line, s, session) { const r = engine.evaluate(line, s, session); seen.push(r); return r; } };
const m = Eval.scoreSituations({ schemaVersion: 1, worlds: {}, offers: [] }, v.rows.map(row => ({ ...row, world: row.snapshot || row.world, moment: row.snapshot ? {} : row.moment, split: row.split || 'tune' })), spy);
console.log(JSON.stringify({ tree, count: m.count, top1Pct: m.top1Pct, primary: { count: m.primary.count, top1Pct: m.primary.top1Pct, top1: m.primary.top1 } }));
if (arg('--rows')) {
  const out = v.rows.map((row, i) => ({ id: row.id, line: row.line, primary: Eval.isPrimary(row), top1: !!m.perRow[i]?.ranking?.top1, expected: row.expected, action: seen[i]?.next?.action || seen[i]?.action, fields: seen[i]?.next?.fields, reason: seen[i]?.understanding?.reason || seen[i]?.routing?.reason, message: String(seen[i]?.message || '').slice(0, 160) }));
  fs.writeFileSync(path.resolve(arg('--rows')), JSON.stringify(out));
}
