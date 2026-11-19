'use strict';
// Audit B2 (gadgets), finding G2: Put it back cancelled every pending effect but not the page shake. The black hole's rumble runs
// 12 seconds on the page (the foil's 2.2, the railgun's charge 0.9), so a page put back mid-effect went on shaking under the student.
const { test } = require('node:test'), assert = require('node:assert/strict'), { fixture } = require('./play-tools-fixture.cjs');
const hole = h => { h.context.ReservePlaySpace = { hole: () => ({ frame() {}, close() {}, closeNow() {}, done: false, timeAt: d => Math.min(d, 400) / 500, popAt: 1000, closeAt: 2000, hitAt: d => 1000 + d / 4, energyAt: () => 0, flat: .3, reachMax: 300, W: 1200, H: 800 }), textSheet: pieces => { for (const p of pieces) p.e = { x: 0, y: 0, w: 1, h: 1, dw: 1, dh: 1 }; return { width: 1, height: 1 }; } }; h.document.elementsFromPoint = () => []; };
test('Put it back stops the page shaking: the black hole rumble does not go on over the restored page', () => {
  const h = fixture({ width: 1200, height: 800, mountOptions: { shake: 'main' } }); hole(h);
  h.api.blackhole(400, 150); h.frame(40);
  const rumble = h.animations.filter(a => a.el === h.page && a.options?.duration === 12000);
  assert.equal(rumble.length, 1, 'the twelve-second rumble is running on the page');
  h.api.undo();
  assert.ok(rumble.every(a => a.cancelled), 'Put it back stops it');
  assert.equal(h.animations.filter(a => a.el === h.page && !a.cancelled && a.options?.easing === 'linear' && a.keys.length > 2).length, 0, 'no shake of any tool is left on the page');
});
test('Put it back during the railgun charge stops its rumble too', () => {
  const h = fixture({ width: 1200, height: 800, mountOptions: { shake: 'main' } });
  h.api.railgun(900, 300); h.frame(40); const charge = h.animations.filter(a => a.el === h.page && a.options?.duration === 900);
  assert.equal(charge.length, 1); h.api.undo(); assert.ok(charge.every(a => a.cancelled));
});
