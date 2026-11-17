'use strict';
// Audit B2 (gadgets), finding G5: a ruled line can be taken whole (gravity, the black hole's last sweep: hideLine, no drawing of
// what is left) or a stretch at a time (takeLine, which redraws what is left). The railgun reads its lines while it charges and takes
// them when it fires; a line taken whole in between made takeLine write to a drawing that does not exist. The shot's last steps
// then never ran: the gun stayed on screen, the page did not jolt, the rest of the lines stayed doubled until Put it back.
const { test } = require('node:test'), assert = require('node:assert/strict'), { fixture } = require('./play-tools-fixture.cjs');
const run = (h, n, ms = 16) => { for (let i = 0; i < n; i++) h.frame(ms); };
test('a line gravity took whole while the railgun charged does not break the shot', () => {
  const h = fixture({ text: 'aa bb', width: 1200, height: 800 });
  // a block with a ruled top edge, out of view at first (so the apple, placed then, leaves it alone)
  const rule = h.document.createElement('div'); rule.rect = { left: 0, top: 2000, width: 1200, height: 20, right: 1200, bottom: 2020 }; h.page.append(rule);
  const plain = { font: '16px serif', color: '#141413', transform: 'none', lineHeight: '20px', borderTopWidth: '0', borderBottomWidth: '0', borderLeftWidth: '0', borderRightWidth: '0' };
  h.context.getComputedStyle = el => el === rule ? { ...plain, borderTopWidth: '2px', borderTopStyle: 'solid', borderTopColor: 'rgb(20, 20, 19)' } : { ...plain, transform: el.style?.transform || 'none' };
  h.document.elementsFromPoint = () => [rule];
  h.context.ReservePlaySpace = { rail: () => ({ frame() {}, done: false }) };
  h.api.gravity(); run(h, 60);
  // the page scrolls: the rule comes into view
  rule.rect = { left: 0, top: 300, width: 1200, height: 20, right: 1200, bottom: 320 }; h.dispatch('scroll');
  h.api.railgun(1100, 300); h.frame(40);
  h.api.pick('gravity');
  assert.equal(rule.style.borderTopColor, 'transparent', 'the gravity button took the rule whole while the gun charged');
  assert.doesNotThrow(() => run(h, 70), 'the shot fires');
  assert.equal(h.document.querySelectorAll('.chb-box').length, 1);
  h.api.undo(); h.finish(); assert.equal(rule.style.borderTopColor, undefined, 'Put it back gives the rule its colour back');
});
