'use strict';
/* Job biscuit-42: scores Biscuit on written student lines the way the bubble runs them (pets.js enginePreview):
   the named-control reader first, then the engine, then the answer card. One invented world
   (tests/biscuit-42/world.cjs), a fresh session per line. A line is a hit only when every check its label names holds;
   a wrong fact (an item that does not belong, a wrong day, a refusal of something he can do) is a miss.
   Usage: node scripts/biscuit-42-eval.cjs --set tests/biscuit-42/set-a.json [--tree <build root>] [--rows out.json] [--quiet]
   --tree runs another build's extension (for the before number) with the same world and checker. */
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2), arg = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const HERE = path.resolve(__dirname, '..');
const tree = path.resolve(arg('--tree', HERE));
const ext = file => path.join(tree, 'extension', file);

function load() {
  const Engine = require(ext('biscuit-engine.js')), Controls = require(ext('biscuit-controls.js')), Answer = require(ext('biscuit-answer.js'));
  return { Engine, Controls, Answer };
}
// the invented student a set is written for (set.world); set A and B use world.cjs, set C world-c.cjs
let W = require(path.join(HERE, 'tests/biscuit-42/world.cjs'));
const list = v => Array.isArray(v) ? v : [];
const str = v => v == null ? '' : String(v);

function run(line, mods, engine, base) {
  const world = { ...base, now: base.now }, session = {};
  let card = null, error = null, answer = null;
  try {
    card = (line && mods.Controls.featureControl?.(line, world)) || engine.evaluate(line, world, session);
    try { answer = mods.Answer.build(card, world, session, { line, previous: null }); } catch (e) { answer = null; }
  } catch (e) { error = String(e && e.stack || e); }
  return { card, answer, error };
}

function shownIds(card, answer) {
  const ids = [];
  const add = v => { if (v != null && v !== '') ids.push(String(v)); };
  for (const it of list(card?.items)) add(it?.id);
  const rows = r => { for (const x of list(r)) { add(x?.itemId); add(x?.id); } };
  // (answer.left = work a plan says can wait: not shown as an answer, so not counted)
  if (answer) { rows(answer.rows); for (const g of list(answer.groups)) rows(g?.rows); rows(answer.also); add(answer.focus); }
  return [...new Set(ids)];
}
function textOf(card, answer) {
  const parts = [card?.message];
  // (round 2: a value shown on the card, a grade or a fact, is read too: answer.value {label,text} and each row's value)
  if (answer) { parts.push(answer.title, answer.summary, answer.value?.label, answer.value?.text, typeof answer.value === 'string' ? answer.value : '', answer.text); for (const r of list(answer.rows)) parts.push(r?.name, r?.title, r?.due?.text, r?.stateText, r?.value); for (const g of list(answer.groups)) { parts.push(g?.label, g?.title); for (const r of list(g?.rows)) parts.push(r?.name, r?.title, r?.due?.text); } for (const n of list(answer.notes)) parts.push(n?.text); }
  return parts.filter(v => typeof v === 'string' || typeof v === 'number').map(String).join(' · ');
}
let WORK = new Set(W.world().assignments.map(a => a.id));
function useWorld(file) { W = require(path.resolve(HERE, file || 'tests/biscuit-42/world.cjs')); WORK = new Set(W.world().assignments.map(a => a.id)); return W; }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b) || String(a) === String(b);

function check(want, card, answer) {
  // alt: the line is right when any one of the alternative labels holds
  if (Array.isArray(want.alt)) { const tries = want.alt.map(w => check(w, card, answer)); return tries.some(t => !t.length) ? [] : [tries.map(t => t.join(', ')).join(' || ')]; }
  const why = [];
  const action = card?.next?.action || card?.action || '';
  const fields = { ...(card?.next?.fields || {}) };
  const ids = shownIds(card, answer), text = textOf(card, answer);
  const acts = want.act ? [].concat(want.act) : null;
  if (acts && !acts.includes(action)) why.push('action ' + action + ' not ' + acts.join('|'));
  if (want.fields) for (const [k, v] of Object.entries(want.fields)) { const vs = [].concat(v); if (!vs.some(x => same(fields[k], x))) why.push('field ' + k + '=' + JSON.stringify(fields[k]) + ' not ' + JSON.stringify(v)); }
  if (want.items) for (const id of want.items) if (!ids.includes(id)) why.push('missing item ' + id);
  if (want.any && !want.any.some(id => ids.includes(id))) why.push('none of ' + want.any.join(','));
  if (want.first) { const first = String(fields.itemId || answer?.focus || list(card?.items)[0]?.id || ''); if (first !== want.first) why.push('first ' + first + ' not ' + want.first); }
  if (want.only) { const allowed = new Set([...(want.items || []), ...(want.also || [])]); const extra = ids.filter(id => WORK.has(id) && !allowed.has(id)); if (extra.length) why.push('extra items ' + extra.join(',')); }
  if (want.none) for (const id of want.none) if (ids.includes(id)) why.push('wrong item ' + id);
  if (want.noWork && ids.some(id => WORK.has(id))) why.push('shows work items ' + ids.filter(id => WORK.has(id)).join(','));
  // noCourse: the line names a course the student does not have; opening some other course is a wrong fact
  if (want.noCourse && (fields.courseId != null || fields.tab === 'course')) why.push('opened course ' + fields.courseId);
  if (want.notAct && [].concat(want.notAct).includes(action)) why.push('action ' + action + ' is wrong here');
  for (const re of list(want.says)) if (!new RegExp(re, 'i').test(text)) why.push('does not say /' + re + '/');
  for (const re of list(want.notSays)) if (new RegExp(re, 'i').test(text)) why.push('says /' + re + '/');
  // always wrong: the stock "not sure" give-up, an error, a raw refusal word on a line with a label that asks for an answer
  if (!want.allowUnsure && /^(?:I am not sure|I do not know that one|Say a bit more|Unavailable|I couldn.t find|I didn.t catch that|I don.t know that one|I couldn.t do that)/i.test(str(card?.message))) why.push('gave up: ' + str(card?.message).slice(0, 80));
  return why;
}

function main() {
  const setFile = path.resolve(HERE, arg('--set')), set = JSON.parse(fs.readFileSync(setFile, 'utf8'));useWorld(set.world);
  const mods = load(), engine = mods.Engine.create(), base = W.world();
  const rows = [], by = {};
  let hit = 0;
  for (const c of set.lines) {
    const { card, answer, error } = run(c.line, mods, engine, base);
    const why = error ? ['error: ' + error.split('\n')[0]] : check(c.want || {}, card, answer);
    const ok = !why.length; if (ok) hit++;
    const b = by[c.cat] ||= { n: 0, hit: 0 }; b.n++; if (ok) b.hit++;
    rows.push({ id: c.id, cat: c.cat, line: c.line, ok, why, action: card?.next?.action || card?.action, fields: card?.next?.fields, message: card?.message, ids: shownIds(card, answer), kind: answer?.kind, title: answer?.title });
  }
  const n = set.lines.length, pct = x => (100 * x / n).toFixed(1);
  const out = { set: path.basename(setFile), tree, n, hit, pct: +pct(hit), byCat: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, `${v.hit}/${v.n}`])), short: (() => { const s = rows.filter(r => r.line.trim().split(/\s+/).length <= 3); return `${s.filter(r => r.ok).length}/${s.length}`; })() };
  if (arg('--rows')) fs.writeFileSync(path.resolve(arg('--rows')), JSON.stringify({ ...out, rows }, null, 1));
  if (!args.includes('--quiet')) for (const r of rows.filter(r => !r.ok)) console.log(`MISS ${r.id} [${r.cat}] "${r.line}" -> ${r.action} ${JSON.stringify(r.fields || {}).slice(0, 120)} | ${str(r.message).slice(0, 140)} | ${r.why.join('; ')}`);
  console.log(JSON.stringify(out));
}
if (require.main === module) main();
module.exports = { run, check, shownIds, textOf, load, useWorld };
