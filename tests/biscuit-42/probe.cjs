'use strict';
// Job biscuit-42: print what Biscuit answers for lines given on the command line (one per argument), for label design
// and finding causes. WORLD=tests/biscuit-42/world-c.cjs picks the other invented student; TREE= another build.
const path = require('node:path');
const E = require('../../scripts/biscuit-42-eval.cjs');
const W = E.useWorld(process.env.WORLD || 'tests/biscuit-42/world.cjs');
const tree = process.env.TREE || path.resolve(__dirname, '../..');
const mods = (() => { const ext = f => path.join(tree, 'extension', f); return { Engine: require(ext('biscuit-engine.js')), Controls: require(ext('biscuit-controls.js')), Answer: require(ext('biscuit-answer.js')) }; })();
const engine = mods.Engine.create(), base = W.world();
for (const line of process.argv.slice(2)) {
  const { card, answer, error } = E.run(line, mods, engine, base);
  if (error) { console.log(line, 'ERROR', error.split('\n')[0]); continue; }
  console.log(JSON.stringify({ line, action: card?.next?.action, reason: card?.understanding?.reason || card?.routing?.reason, fields: card?.next?.fields, msg: card?.message, ids: E.shownIds(card, answer), kind: answer?.kind, title: answer?.title, summary: answer?.summary }).slice(0, 650));
}
