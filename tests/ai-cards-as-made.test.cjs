'use strict';
// AI plan step 5 (owner, 2026-11-02: "Stop keeps finished cards"): each Help card is saved the moment it is made, so
// Stop, a settings change or a newer run loses nothing, and a step replayed after a restart writes it once.
const test = require('node:test'), assert = require('node:assert/strict');
const Runner = require('../extension/ai-runner.js'), Results = require('../extension/ai-results.js'), UI = require('../extension/study-ui.js');
const fence = '```', scope = 'https://canvas.test|7', key = UI.storageKey(scope);
const outline = title => fence + 'json\n' + JSON.stringify({ kind: 'outline', title, size: 'l', thesis: '', sections: [{ part: 'Question', purpose: 'Say what the lab asks.', src: 'Handout', words: 0, evidence: [] }, { part: 'Method', purpose: 'Say how it was measured.', src: 'Handout', words: 0, evidence: [] }], gaps: [] }) + '\n' + fence;

function setup() {
 const mem = new Map(), external = { get: async k => mem.get(k), set: async (k, v) => { mem.set(k, structuredClone(v)); } };
 const results = Results.create({ store: { update: async f => f({}) }, external, now: () => Date.parse('2026-11-02T12:00:00Z') });
 const runner = Runner.create({ canvas: { reader: () => ({ cache: new Map(), read: async r => ({ id: r.id, text: 'x' }) }), validate: async () => {} }, results, account: { get: () => ({ settings: { timeZone: 'UTC' }, toolbox: {} }), sync: async () => {} }, adapter: {}, now: () => Date.parse('2026-11-02T12:00:00Z'), uuid: () => 'u' });
 const run = { id: 'run-m', scope, day: '2026-11-02', kind: 'prepare', mode: 'prepare', phase: 'deliver', state: 'awaiting-reply', picks: [{ ref: 'A1', make: 'auto' }, { ref: 'A2', make: 'auto' }], pickIndex: 0, made: [], retries: 0,
  refs: { A1: { id: '11', courseId: '7', title: 'Lab report' }, A2: { id: '12', courseId: '7', title: 'Essay' } }, snapshot: { index: [], brief: { text: '' } }, turns: [{ id: 't1', reply: outline('Lab report plan') }], turnIndex: 0, messages: [{ role: 'user', content: 'prompt' }], errors: [], settings: {} };
 let stopped = false;
 const ctx = { save: async r => r, guard: async () => { if (stopped) throw Error('Run epoch stopped.'); }, signal: new AbortController().signal };
 return { mem, run, runner, ctx, stop: () => { stopped = true; }, cards: () => Object.entries(mem.get(key) || {}).filter(([k]) => k.startsWith('prepare:run-m:')) };
}

test('the first card is saved when it is made, before the run goes on, and a stop after it keeps it', async () => {
 const f = setup();
 await f.runner.step(f.run, f.ctx);
 assert.equal(f.run.pickIndex, 1); assert.equal(f.run.cardCount, 1);
 assert.deepEqual(f.cards().map(([k, v]) => [k, v.kind, v.itemId, v.rank]), [['prepare:run-m:0', 'outline', '11', 1]]);
 f.stop();
 await assert.rejects(f.runner.step(f.run, f.ctx), /stopped/);
 assert.equal(f.cards().length, 1, 'Stop leaves the finished card');
});

test('a card made after Stop is not saved', async () => {
 const f = setup(); f.stop();
 await assert.rejects(f.runner.step(f.run, f.ctx), /stopped/);
 assert.equal(f.cards().length, 0);
});

test('a step replayed after a restart writes its card to the same key once, keeping what the student did on it', async () => {
 const f = setup(), before = structuredClone(f.run);
 await f.runner.step(f.run, f.ctx);
 const map = f.mem.get(key); map['prepare:run-m:0'].progress = { ticked: true }; f.mem.set(key, map);
 // the worker died before the run's own save: the same checkpoint runs again
 const again = structuredClone(before); await f.runner.step(again, f.ctx);
 assert.equal(f.cards().length, 1); assert.deepEqual(f.mem.get(key)['prepare:run-m:0'].progress, { ticked: true });
});

test('the second card takes the next place, and the end of the run saves nothing more', async () => {
 const f = setup();
 await f.runner.step(f.run, f.ctx);
 Object.assign(f.run, { state: 'awaiting-reply', turns: [...f.run.turns, { id: 't2', reply: outline('Essay plan') }], turnIndex: 1 });
 await f.runner.step(f.run, f.ctx);
 assert.deepEqual(f.cards().map(([k, v]) => [k, v.itemId, v.rank]), [['prepare:run-m:0', '11', 1], ['prepare:run-m:1', '12', 2]]);
 assert.equal(f.run.state, 'gathering'); assert.equal(f.run.pickIndex, 2);
 const written = JSON.stringify(f.mem.get(key));
 await f.runner.step(f.run, f.ctx);
 assert.equal(f.run.state, 'publishing'); assert.equal(f.run.cardCount, 2); assert.equal(JSON.stringify(f.mem.get(key)), written);
});

test('More on a card adds its questions once, even when the step is replayed', async () => {
 const mem = new Map(), external = { get: async k => mem.get(k), set: async (k, v) => { mem.set(k, structuredClone(v)); } };
 const results = Results.create({ store: { update: async f => f({}) }, external, now: () => 1 });
 mem.set(key, { 'ask:old:0': { v: 1, kind: 'test', ask: true, day: '2026-11-02', savedAt: 1, data: { kind: 'test', questions: [{ q: 'Q1' }] }, progress: {}, runId: 'old' } });
 const run = { id: 'run-more', scope, day: '2026-11-02', more: true, cardKey: 'ask:old:0' }, card = { kind: 'test', questions: [{ q: 'Q2' }, { q: 'Q3' }] };
 await results.saveCards(run, [card], {}, { ask: true, at: 0 });
 await results.saveCards(run, [card], {}, { ask: true, at: 0 });
 assert.deepEqual(mem.get(key)['ask:old:0'].data.questions.map(q => q.q), ['Q1', 'Q2', 'Q3']);
});
