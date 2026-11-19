'use strict';
// Audit B2 (gadgets), finding G3: the black hole bends each page block (its pull sets a transform-origin) and then blows it outward;
// the blow recorded the block's style after the pull had changed it. Put it back before the blow ends restored the pull's origin last,
// so the page block kept an inline transform-origin (and its style attribute) after the page was "put back exactly".
const { test } = require('node:test'), assert = require('node:assert/strict'), { fixture } = require('./play-tools-fixture.cjs');
const hole = h => { h.context.ReservePlaySpace = { hole: () => ({ frame() {}, close() {}, closeNow() {}, done: false, timeAt: d => Math.min(d, 400) / 500, popAt: 1000, closeAt: 2000, hitAt: d => 1000 + d / 4, energyAt: () => 0, flat: .3, reachMax: 300, W: 1200, H: 800 }), textSheet: pieces => { for (const p of pieces) p.e = { x: 0, y: 0, w: 1, h: 1, dw: 1, dh: 1 }; return { width: 1, height: 1 }; } }; h.document.elementsFromPoint = () => []; };
test('Put it back in the middle of the black hole leaves no transform-origin on the page blocks', () => {
  for (const at of [40, 500]) {
    const h = fixture({ width: 1200, height: 800, mountOptions: { blocks: 'main' } }); hole(h);
    assert.equal(h.page.style.transformOrigin, undefined);
    h.api.blackhole(400, 150); h.frame(at);
    assert.ok(h.page.style.transformOrigin, 'the pull turns the block about the hole');
    assert.ok(h.animations.filter(a => a.el === h.page && !a.cancelled).length >= 2, 'pulled and blown');
    h.api.undo(); h.finish();
    assert.equal(h.page.style.transformOrigin, undefined, 'at ' + at + ' ms: the block is as it was');
    assert.equal(h.page.getAttribute('style'), undefined, 'and has no style attribute left');
  }
});
