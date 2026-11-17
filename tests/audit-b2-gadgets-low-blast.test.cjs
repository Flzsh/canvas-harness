'use strict';
// Audit B2 (gadgets), finding G1: on Low graphics (and on a weak machine, where Low is chosen for the student) a blast took only
// words still in plain text; letters an earlier tool had already opened (eraser, painter, garden, hammer, laser) were left standing.
const { test } = require('node:test'), assert = require('node:assert/strict'), { fixture } = require('./play-tools-fixture.cjs');
const run = (h, n, ms = 16) => { for (let i = 0; i < n; i++) h.frame(ms); };
// letters the eraser opened but did not take: "abcd" rubbed at its first letter leaves c and d split and on the page
function rubbedThenShot(low) {
  const h = fixture({ text: 'abcd efgh', width: 1200, height: 800, mountOptions: { low } });
  h.api.erase(105, 130);
  const left = h.page.querySelectorAll('.chb-ch').filter(s => s.textContent === 'c' || s.textContent === 'd');
  assert.equal(left.length, 2, 'c and d are opened by the eraser'); assert.ok(left.every(s => s.style.visibility !== 'hidden'), 'and still on the page');
  h.api.railgun(1100, 130); run(h, 70);
  return { h, left };
}
test('the railgun shot takes letters another tool already opened, on Low as on High', () => {
  const high = rubbedThenShot(false); assert.ok(high.left.every(s => s.style.visibility === 'hidden'), 'High: the opened letters in the band go with the shot');
  const low = rubbedThenShot(true); assert.ok(low.left.every(s => s.style.visibility === 'hidden'), 'Low: the opened letters in the band go too, none is left standing');
  low.h.api.undo(); low.h.finish(); assert.equal(low.h.page.textContent, 'abcd efgh'); assert.equal(low.h.page.children[0], low.h.original, 'Put it back is still exact');
});
