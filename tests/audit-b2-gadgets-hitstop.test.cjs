'use strict';
// Audit B2 (gadgets), finding G4: the hit-stop (a hammer blow, the bomb) pauses every running effect and plays it again a beat later
// on a plain timer. Put it back inside that beat cancels the black hole's pull on the page blocks (a fill-forwards animation), and the
// timer then played the cancelled pull again: the block was dragged toward the old hole and stayed there, out of reach of Put it back.
const { test } = require('node:test'), assert = require('node:assert/strict'), { fixture } = require('./play-tools-fixture.cjs');
const hole = h => { h.context.ReservePlaySpace = { hole: () => ({ frame() {}, close() {}, closeNow() {}, done: false, timeAt: d => Math.min(d, 400) / 500, popAt: 1000, closeAt: 2000, hitAt: d => 1000 + d / 4, energyAt: () => 0, flat: .3, reachMax: 300, W: 1200, H: 800 }), textSheet: pieces => { for (const p of pieces) p.e = { x: 0, y: 0, w: 1, h: 1, dw: 1, dh: 1 }; return { width: 1, height: 1 }; } }; h.document.elementsFromPoint = () => []; };
// the fixture's animations, with the play state a browser keeps
const live = h => { const proto = Object.getPrototypeOf(h.page), base = proto.animate; proto.animate = function (keys, options) { const a = base.call(this, keys, options), cancel = a.cancel; Object.assign(a, { playState: 'running', played: 0, pause() { if (this.playState === 'running') this.playState = 'paused'; }, play() { this.playState = 'running'; this.played++; }, updatePlaybackRate(rate) { this.rate = rate; }, cancel() { cancel.call(this); this.playState = 'idle'; } }); return a; }; };
test('Put it back during a hit-stop: what it cancelled is not played again afterwards', () => {
  const h = fixture({ width: 1200, height: 800, mountOptions: { blocks: 'main' } }); hole(h); live(h);
  h.api.blackhole(400, 150); h.frame(40);
  const pull = h.animations.filter(a => a.el === h.page && a.options?.fill === 'forwards'); assert.equal(pull.length, 1, 'the black hole pulls the page block');
  h.api.hammer(900, 500); h.frame(510); assert.equal(pull[0].playState, 'paused', 'the hammer blow holds everything still for a beat');
  h.api.undo(); assert.equal(pull[0].playState, 'idle', 'Put it back cancels the pull');
  h.frame(100); h.frame(100);
  assert.equal(pull[0].played, 0, 'the beat ends without playing the cancelled pull again'); assert.equal(pull[0].playState, 'idle');
});
test('without Put it back the hit-stop still lets everything go on', () => {
  const h = fixture({ width: 1200, height: 800, mountOptions: { blocks: 'main' } }); hole(h); live(h);
  h.api.blackhole(400, 150); h.frame(40); const pull = h.animations.find(a => a.el === h.page && a.options?.fill === 'forwards');
  h.api.hammer(900, 500); h.frame(510); assert.equal(pull.playState, 'paused'); h.frame(100); assert.equal(pull.playState, 'running'); assert.equal(pull.played, 1);
});
