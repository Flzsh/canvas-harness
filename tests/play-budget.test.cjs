'use strict';
// The play tools stay cheap: a page-sized tool works in a budget of pieces, bulk physics speaks once, nothing reads layout
// between writes, and "Put it back" still restores the page exactly.
const { test } = require('node:test'), assert = require('node:assert/strict'), { create, attach } = require('../extension/play-physics.js'), { fixture } = require('./play-tools-fixture.cjs');
const run = (h, n) => { for (let i = 0; i < n; i++) h.frame(); };
const BUDGET = 300;
const pieces = h => h.document.querySelectorAll('.chb-physics-body');

test('a short page falls letter by letter, each a one-letter span that stays in the flow', () => {
  const h = fixture(); h.api.gravity();
  assert.equal(h.api.physics.bodies.length, 13);
  assert.ok(h.api.physics.bodies.every(b => b.parts.length === 1));
  assert.equal(pieces(h).map(c => c.textContent).sort().join(''), 'Playwithwords'.split('').sort().join(''));
  assert.ok(h.page.querySelectorAll('.chb-ch').every(s => s.classList.contains('chb-run')), 'no inline-block letters: hiding text cannot rewrap a line');
  assert.equal(h.page.querySelectorAll('.chb-word').length, 0);
});

test('past the budget in letters the page falls in whole words', () => {
  const h = fixture({ text: 'abcde '.repeat(100).trim(), width: 8000 }); h.api.gravity();
  assert.equal(h.api.physics.bodies.length, 100);
  assert.ok(pieces(h).every(c => c.textContent === 'abcde'));
  assert.equal(h.page.querySelectorAll('.chb-ch').length, 100);
});

test('a text-heavy page falls in runs of words: no per-character spans, every word still falls, the budget holds', () => {
  const words = 2000, text = 'abcde '.repeat(words).trim(), h = fixture({ text, width: 200000 }); h.api.gravity();
  const n = h.api.physics.bodies.length; assert.ok(n <= BUDGET && n > BUDGET / 2, `${n} bodies`);
  assert.ok(h.page.querySelectorAll('.chb-ch').length <= BUDGET, 'one span per piece, none per character');
  assert.equal(h.page.querySelectorAll('.chb-word').length, 0);
  assert.equal(h.page.querySelectorAll('.chb-split').length, 1, 'one holder per text node');
  assert.equal(pieces(h).length, n, 'one copy per piece');
  assert.equal(pieces(h).map(c => c.textContent).join(' '), text, 'nothing on screen is left behind or doubled');
  assert.equal(h.api.physics.bodies.filter(b => b.retired).length, 0);
  assert.ok(h.api.physics.bodies.every(b => b.awake), 'every piece really falls: none snaps to the floor');
});

test('only what is on screen is touched: the rest of a long text node stays plain text', () => {
  const h = fixture({ text: 'abcde '.repeat(4000).trim(), width: 1000 }); h.api.gravity();
  const holder = h.page.children[0]; assert.ok(holder.classList.contains('chb-split'));
  assert.ok(h.page.querySelectorAll('.chb-ch').length < 200);
  assert.ok(holder.children.at(-1).nodeType === 3 && holder.children.at(-1).textContent.length > 20000, 'the part off screen is one text node');
});

test('hundreds of short labels: runs cannot join across nodes, so neighbours share a body and the budget still holds', () => {
  const h = fixture({ text: 'First', width: 1600, height: 1000 });
  for (let i = 1; i < 500; i++) { h.page.append('label' + i); h.page.children.at(-1).rect = { left: 10 + i * 57 % 1500, top: 10 + (i * 23 % 900), width: 50, height: 20, right: 60 + i * 57 % 1500, bottom: 30 + (i * 23 % 900) }; }
  h.original.rect = { left: 4, top: 4, width: 50, height: 20, right: 54, bottom: 24 };
  h.api.gravity();
  assert.ok(h.api.physics.bodies.length <= BUDGET, `${h.api.physics.bodies.length} bodies`);
  assert.equal(h.api.physics.bodies.reduce((n, b) => n + b.parts.length, 0), 500, 'every label is part of a body');
  assert.equal(pieces(h).length, 500);
  assert.equal(h.page.querySelectorAll('.chb-split').length, 0, 'a label that falls whole needs no holder round it');
  h.api.undo(); h.finish();
  assert.equal(h.page.querySelectorAll('.chb-split').length + h.page.querySelectorAll('.chb-ch').length, 0);
  assert.equal(h.page.children[0], h.original);
  assert.equal(h.page.children.length, 500);
});

test('whatever the page, Gravity adds a bounded number of elements: a screen of 5,000 labels stays under 1,500', () => {
  const h = fixture({ text: 'First', width: 2560, height: 1440 }), count = () => h.document.documentElement.querySelectorAll('*').length;
  for (let i = 1; i < 5000; i++) { h.page.append('label' + (i % 50 ? '' : ' with a longer name') + i); h.page.children.at(-1).rect = { left: 4 + i * 37 % 2500, top: 4 + (i * 19 % 1400), width: 50, height: 16, right: 54 + i * 37 % 2500, bottom: 20 + (i * 19 % 1400) }; }
  h.original.rect = { left: 4, top: 4, width: 50, height: 16, right: 54, bottom: 20 };
  const before = count(); h.api.gravity(); const added = count() - before;
  assert.ok(added <= 1500, `${added} elements added`); assert.ok(pieces(h).length <= 600); assert.ok(h.api.physics.bodies.length <= BUDGET);
  assert.ok(pieces(h).every(c => c.textContent.length > 0));
  h.api.undo(); h.finish(); assert.equal(h.page.querySelectorAll('.chb-ch').length, 0); assert.equal(h.document.getElementById('chb-layer').children.length, 0);
});

test('a text-heavy page adds elements in the hundreds, not the thousands', () => {
  const h = fixture({ text: 'abcde '.repeat(6000).trim(), width: 200000 }), count = () => h.document.documentElement.querySelectorAll('*').length, before = count(); h.api.gravity();
  assert.ok(count() - before <= 2 * BUDGET + 30, `${count() - before} elements added`);
});

test('a node of tens of thousands of words is searched, not read word by word', () => {
  const h = fixture({ text: 'abcde '.repeat(30000).trim(), width: 1000 }), reads = h.reads; h.api.gravity();
  assert.ok(pieces(h).length > 0);
  assert.ok(h.reads - reads < 31000, 'one read per word at most, plus the search');
});

test('on Home the tray lives in a shadow root: with a tool in hand Put it back and the tray are not taken for the page', () => {
  const h = fixture(), host = h.document.createElement('div'); h.document.body.append(host); h.api.gravity(); h.api.pick('balloon');
  const undo = h.document.getElementById('chb-undo'), inside = extra => ({ composedPath: () => [undo, host, h.document.documentElement], ...extra });
  assert.notEqual(h.dispatch('click', host, 5, 5, inside()).prevented, true, 'the click goes on to the button');
  assert.equal(h.api.physics.bodies.length, 13, 'and no second tool action fired');
  assert.notEqual(h.dispatch('pointerdown', host, 5, 5, inside()).prevented, true);
  assert.equal(h.dispatch('click', host, 5, 5, { composedPath: () => [host, h.document.documentElement] }).prevented, true, 'the page itself is still ours while a tool is in hand');
});

test('type is read once per parent, not once per piece, and nothing reads again after the writes begin', () => {
  const h = fixture({ text: 'abcde '.repeat(2000).trim(), width: 200000 }), styles = h.styleReads; h.api.gravity();
  assert.equal(h.styleReads - styles, 1);
  const reads = h.reads; run(h, 30); assert.equal(h.reads, reads, 'the frame loop performs no layout or style reads');
});

test('a second Gravity click re-throws the pieces it already has, without doubling them', () => {
  const h = fixture({ text: 'abcde '.repeat(2000).trim(), width: 200000 }); h.api.gravity(); const n = h.api.physics.bodies.length; run(h, 900); assert.equal(h.frames.size, 0);
  h.api.gravity(); assert.equal(h.api.physics.bodies.length, n); assert.equal(pieces(h).length, n); assert.ok(h.frames.size > 0); run(h, 900); assert.equal(h.frames.size, 0);
  assert.equal(h.page.querySelectorAll('.chb-ch').length, n);
});

test('Put it back restores a budgeted page exactly: the same text node, no spans, nothing hidden, nothing in the layer', () => {
  const text = 'abcde '.repeat(2000).trim(), h = fixture({ text, width: 200000 }); h.api.gravity(); run(h, 40); h.api.undo(); h.finish();
  assert.equal(h.page.children.length, 1); assert.equal(h.page.children[0], h.original); assert.equal(h.original.nodeValue, text); assert.equal(h.page.textContent, text);
  assert.equal(h.page.querySelectorAll('.chb-ch').length + h.page.querySelectorAll('.chb-split').length, 0);
  assert.equal(h.document.getElementById('chb-layer').children.length, 0);
  assert.equal(h.api.physics.bodies.length, 0); assert.equal(h.frames.size, 0);
});

test('Put it back is exact after another tool hit a fallen piece, and after a letter tool opened the plain remainder', () => {
  const text = 'abcde '.repeat(400).trim(), h = fixture({ text, width: 900 }); h.api.gravity(); run(h, 900);
  const b = h.api.physics.bodies[0]; h.api.hammer(b.x, b.y); h.frame(600); assert.ok(h.api.physics.bodies.length < 300 + 1); h.finish();
  const rest = h.page.children[0].children.at(-1); assert.equal(rest.nodeType, 3); h.api.erase(600, 130); h.api.undo(); h.finish();
  assert.equal(h.page.children[0], h.original); assert.equal(h.page.textContent, text); assert.equal(h.document.getElementById('chb-layer').children.length, 0);
});

test('a fallen piece can still be grabbed, thrown and caught by the magnet', () => {
  const h = fixture({ text: 'abcde '.repeat(2000).trim(), width: 200000 }); h.api.gravity(); run(h, 900);
  const b = h.api.physics.bodies[0], c = b.parts[0].c; h.dispatch('pointerdown', c, b.x, b.y); h.frame(); h.dispatch('pointermove', c, b.x + 30, b.y - 60); h.dispatch('pointerup', c, b.x + 30, b.y - 60); assert.ok(b.vy < 0, 'thrown upward');
  h.api.magnet(b.x, b.y); assert.ok(h.document.querySelectorAll('.chb-magnet-clump').length >= 1); h.api.letGo();
});

test('aiming the handle coalesces to one update a frame and release applies the last aim', () => {
  const h = fixture(); h.api.gravity(); run(h, 900); const handle = h.document.querySelector('.chb-gravity-handle');
  let sets = 0; const set = h.api.physics.setGravity; h.api.physics.setGravity = (...a) => { sets++; return set(...a); };
  h.dispatch('pointerdown', handle, 400, 380); for (let i = 0; i < 12; i++) h.dispatch('pointermove', handle, 500 + i * 20, 380); h.frame(); h.dispatch('pointermove', handle, 90, 300); h.dispatch('pointerup', handle, 90, 300);
  assert.ok(h.api.physics.gravity.x < 0, 'the last aim wins'); assert.equal(sets, 2);
});

test('setGravity, attractors, portals and resize tell listeners once, however many bodies they wake', () => {
  const engine = create({ width: 640, height: 600 }); engine.batch(() => { for (let i = 0; i < 300; i++) engine.settle(engine.add({ x: 20 + i * 2, y: 100 })); });
  let told = 0; engine.subscribe(() => told++);
  for (const act of [() => engine.setGravity(100, 2000), () => engine.setAttractor('m', { x: 300, y: 500, radius: 800 }), () => engine.setPortals([{ x: 10, y: 10 }, { x: 600, y: 10 }]), () => engine.resize(620, 590), () => engine.step(1 / 60)]) { told = 0; act(); assert.equal(told, 1); }
  told = 0; engine.batch(() => { for (let i = 0; i < 50; i++) engine.add({ x: 300, y: 50 }); }); assert.equal(told, 1);
});

test('wake and force never scan the bodies, and a wake paints nothing by itself', () => {
  const engine = create({ width: 640, height: 600 }), bodies = Array.from({ length: 300 }, (_, i) => engine.add({ x: 20 + i, y: 100 }));
  const scan = () => { throw Error('scanned the body list'); }; engine.bodies.includes = engine.bodies.indexOf = scan;
  engine.takeChanges(); for (const b of bodies) { engine.wake(b); engine.force(b, 1, 1); } assert.deepEqual(engine.takeChanges(), []);
  engine.setGravity(0, -2300); assert.deepEqual(engine.takeChanges(), [], 'tilting gravity repaints nothing until the bodies move');
  assert.equal(engine.step(1 / 60).length, 300); assert.equal(engine.takeChanges().length, 300);
});

test('stepping says so once and only when something moved; a sleeping world is silent', () => {
  const engine = create({ width: 640, height: 600 }); let told = 0; const b = engine.add({ x: 300, y: 590 }); engine.subscribe(() => told++);
  while (engine.awake) { told = 0; engine.step(1 / 60); assert.equal(told, 1); } assert.equal(b.awake, false);
  told = 0; engine.step(1 / 60); assert.equal(told, 0);
});

test('a body the wall piles have never reached does not look them up', () => {
  const engine = create({ width: 640, height: 600 }), floor = engine.add({ x: 300, y: 590, width: 40, height: 20 }); engine.settle(floor); const b = engine.add({ x: 300, y: 40, width: 40, height: 20 });
  let reads = 0; const get = Map.prototype.get; Map.prototype.get = function (...a) { reads++; return get.apply(this, a); }; try { engine.step(1 / 60); } finally { Map.prototype.get = get; }
  assert.equal(reads, 0); assert.ok(b.y > 40);
});

test('the floor pile keeps its high water mark and a wide piece tumbles less than a letter', () => {
  const engine = create({ width: 640, height: 600 }), a = engine.add({ x: 300, y: 100 }); engine.settle(a); assert.equal(engine.floor.top, 16); engine.wake(a); assert.equal(engine.floor.top, 0, 'an emptied pile starts again');
  const wide = engine.add({ x: 300, y: 560, width: 440, height: 20, vy: 800 }), small = engine.add({ x: 100, y: 560, width: 10, height: 20, vy: 800 }); for (let i = 0; i < 6; i++) engine.step(1 / 120);
  assert.ok(Math.abs(wide.spin) < Math.abs(small.spin) / 5, `${wide.spin} against ${small.spin}`);
});

test('the frame adapter renders a body only when it moved', () => {
  const engine = create({ width: 640, height: 600 }), pending = new Map(); let id = 0; const renders = [], adapter = attach(engine, { document: { addEventListener() {}, removeEventListener() {} }, requestFrame: fn => { pending.set(++id, fn); return id; }, cancelFrame: n => pending.delete(n), render: b => renders.push(b.id) }), b = engine.add({ x: 300, y: 100 }); engine.settle(b); renders.length = 0;
  engine.setGravity(0, 2000); assert.deepEqual(renders, [], 'waking is not a repaint');
  adapter.destroy();
});

test('no tool walks the whole page: ruled lines come from hit tests near the blast, read once per box', () => {
  const h = fixture({ text: 'abcde '.repeat(200).trim(), width: 2000 }), all = h.page.querySelectorAll.bind(h.page); let probes = 0;
  h.page.querySelectorAll = selector => { assert.notEqual(selector, '*', 'a walk of every element'); return all(selector); };
  h.document.elementsFromPoint = () => { probes++; return [h.page]; };
  h.api.erase(110, 130); const first = probes, styles = h.styleReads; assert.ok(first > 0 && first < 40, `${first} probes`);
  for (let x = 112; x < 150; x += 2) h.api.erase(x, 130); assert.ok(probes - first < 30, 'moving the eraser reuses what it has read');
  assert.ok(h.styleReads - styles < 60);
});

test('a blast splits only the words it can throw, nearest first', () => {
  const h = fixture({ text: 'abcde '.repeat(1000).trim(), width: 2000 });
  h.api.hammer(600, 130); h.frame(600);
  const near = h.page.querySelectorAll('.chb-ch').length; assert.ok(near > 0 && near < 200, `${near} letter spans`);
  assert.equal(h.document.querySelectorAll('.chb-split').length, 1); h.api.undo(); h.finish(); assert.equal(h.page.children[0], h.original);
});

test('rubbing along a long text node opens only the words under the eraser', () => {
  const h = fixture({ text: 'abcde '.repeat(1000).trim(), width: 8000 }), before = h.page.textContent; for (let x = 100; x < 400; x += 8) h.api.erase(x, 130);
  assert.ok(h.page.querySelectorAll('.chb-ch').length < 300, 'not the whole node'); assert.equal(h.page.textContent.length, before.length); h.api.undo(); h.finish(); assert.equal(h.page.children[0], h.original);
});

test('a full magnet stops opening words as it moves', () => {
  const h = fixture({ text: 'abcde '.repeat(2000).trim(), width: 200000 }); for (let x = 110; x < 3000; x += 40) h.api.magnet(x, 130);
  const letters = h.page.querySelectorAll('.chb-ch').length; for (let x = 3000; x < 6000; x += 40) h.api.magnet(x, 130); assert.equal(h.page.querySelectorAll('.chb-ch').length, letters); assert.ok(letters < 400, `${letters} letter spans`); h.api.letGo();
});

const heavy = (width = 4000) => fixture({ text: 'abcde '.repeat(4000).trim(), width, height: 900 });
const hidden = h => h.page.querySelectorAll('.chb-ch').filter(s => s.style.visibility === 'hidden').length;
// (the foil is held to the shared budget by the element guard; the blasts stay in letters unless the machine is weak, see WORDS_IN_BLASTS)
for (const [name, act, wait, limit] of [['railgun', h => h.api.railgun(600, 130), 1000, 720], ['black hole', h => h.api.blackhole(600, 130), 200, 520], ['foil', h => h.api.foil(600, 130), 2500, BUDGET]]) test(`${name} keeps to its limit of pieces on a page full of text, and Put it back is exact`, () => {
  const h = heavy(); act(h); h.frame(wait); h.frame();
  const count = h.page.querySelectorAll('.chb-ch').length; assert.ok(count > 20, `${count} pieces`); assert.ok(count <= limit + 40, `${count} pieces`); assert.ok(hidden(h) <= limit);
  assert.ok(h.document.querySelectorAll('#chb-layer > span').length <= limit, 'copies');
  h.api.undo(); h.finish(); assert.equal(h.page.children[0], h.original); assert.equal(h.page.querySelectorAll('.chb-ch').length, 0); assert.equal(h.document.getElementById('chb-layer').children.length, 0);
});

test('the foil smears letters nearest the line and whole words beyond them, under the budget', () => {
  const h = fixture({ text: 'First', width: 1600, height: 900 }); h.original.rect = { left: 4, top: 4, width: 50, height: 20, right: 54, bottom: 24 };
  for (let i = 0; i < 300; i++) { const left = 100 + i % 15 * 60, top = 30 + Math.floor(i / 15) * 40; h.page.append('abcde'); h.page.children.at(-1).rect = { left, top, width: 50, height: 20, right: left + 50, bottom: top + 20 }; }
  h.api.foil(550, 400); h.frame(2500); h.frame(); const spans = h.page.querySelectorAll('.chb-ch'), whole = spans.filter(s => s.textContent.length > 1), letters = spans.filter(s => s.textContent.length === 1);
  assert.ok(letters.length > 50 && letters.length <= BUDGET / 2, `${letters.length} letters`); assert.ok(whole.length > 20, `${whole.length} words`); assert.ok(spans.length <= BUDGET, `${spans.length} pieces`);
  const away = s => { const r = s.getBoundingClientRect(); return Math.abs(r.top + r.height / 2 - 400); };
  assert.ok(Math.max(...letters.map(away)) <= Math.min(...whole.map(away)) + 40, 'the letters are the nearest pieces');
  h.api.undo(); h.finish(); assert.equal(h.page.querySelectorAll('.chb-ch').length, 0);
});

test('blasts stay in letters unless the machine is weak: one switch', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.js'), 'utf8'); assert.match(source, /const WORDS_IN_BLASTS = LOW,/);
  const h = heavy(); h.api.blackhole(600, 130); assert.ok(h.page.querySelectorAll('.chb-ch').every(s => s.textContent.length === 1));
});

test('the page shake can run on the compositor: replace, unless an element has a transform of its own', () => {
  const h = fixture({ mountOptions: { shake: 'main' } }); h.api.shake('bomb'); assert.ok(h.animations.filter(a => a.el === h.page).length === 1); assert.ok(h.animations.every(a => a.options.composite === 'replace'));
  const k = fixture({ mountOptions: { shake: 'main' } }); k.page.style.transform = 'rotate(1deg)'; k.api.shake('bomb'); assert.equal(k.animations.find(a => a.el === k.page).options.composite, 'add');
});

test('hit-stop and bullet time never ask the document for every animation', () => {
  const h = fixture({ text: 'abcde '.repeat(40).trim(), width: 2000 }); h.document.getAnimations = () => { throw Error('the whole document was asked'); };
  h.api.hammer(120, 130); h.frame(600); h.frame(); h.api.undo(); h.finish();
});

test('with no input for two minutes the marks rest, any input wakes them, and Put it back clears it', () => {
  const h = fixture(), html = h.document.documentElement; h.api.garden(110, 130); h.frame(60000); assert.equal(html.classList.contains('chb-rest'), false); h.frame(61000); assert.equal(html.classList.contains('chb-rest'), true);
  h.dispatch('pointermove', h.page, 120, 130); assert.equal(html.classList.contains('chb-rest'), false); h.frame(61000); assert.equal(html.classList.contains('chb-rest'), false, 'input restarts the wait'); h.frame(61000); assert.equal(html.classList.contains('chb-rest'), true);
  h.api.undo(); h.finish(); assert.equal(html.classList.contains('chb-rest'), false);
});

test('the rest and the hidden aim are real rules in the style sheet', () => {
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.css'), 'utf8');
  assert.match(css, /html\.chb-rest #chb-layer \*[^{]*\{animation-play-state:paused!important\}/); assert.match(css, /#chb-aim:not\(\.is-on\) \.chb-spin\{animation-play-state:paused\}/);
});

test('an effect leaves no empty style attribute behind', () => {
  const h = fixture(), removed = []; const remove = h.page.removeAttribute.bind(h.page); h.page.removeAttribute = name => { removed.push(name); remove(name); };
  h.api.blackhole(110, 130); h.api.undo(); h.finish(); assert.equal(h.page.children[0], h.original);
});

test('at rest the balloons stop too: no frame is asked for until input returns, and Put it back still works from rest', () => {
  const h = fixture(), html = h.document.documentElement, b = h.api.balloon(110, 130); run(h, 100); assert.ok(h.frames.size > 0, 'a floating balloon keeps its loop');
  for (let i = 0; i < 13; i++) h.frame(10000); assert.equal(html.classList.contains('chb-rest'), true); assert.equal(h.frames.size, 0, 'no frames at rest'); const y = b.y; run(h, 5); assert.equal(b.y, y);
  h.dispatch('pointermove', h.page, 120, 130); assert.equal(html.classList.contains('chb-rest'), false); assert.ok(h.frames.size > 0, 'input starts it again');
  for (let i = 0; i < 13; i++) h.frame(10000); assert.equal(h.frames.size, 0); h.api.undo(); h.finish(); assert.equal(html.classList.contains('chb-rest'), false); assert.equal(h.page.children[0], h.original); assert.equal(h.frames.size, 0);
  h.api.balloon(110, 130); assert.ok(h.frames.size > 0, 'after Put it back the loop is free to run again');
});

test('Home re-rendering while pieces are out can reuse our span as its own: Put it back leaves that element alone', () => {
  for (const text of ['Play with words', 'a']) {
    const h = fixture({ text }); h.api.gravity(); const ours = h.page.children[0]; assert.ok(ours.classList.contains('chb-split') || ours.classList.contains('chb-run'));
    ours.className = 'rd-count'; ours.textContent = '14'; h.api.undo(); h.finish();
    assert.equal(h.page.children[0], ours, 'the element the page now owns stays'); assert.equal(h.page.textContent, '14'); assert.equal(h.document.getElementById('chb-layer').children.length, 0);
  }
});

test('a blast opens letters in the flow, with no word wrapped round them, so it cannot move a line and adds fewer elements', () => {
  const h = heavy(); h.api.blackhole(600, 130); assert.equal(h.page.querySelectorAll('.chb-word').length, 0); assert.ok(h.page.querySelectorAll('.chb-ch').every(s => s.classList.contains('chb-run')));
  const k = heavy(); k.api.erase(600, 130); assert.ok(k.page.querySelectorAll('.chb-word').length > 0, 'a small tool keeps its words: a balloon can still lift what is left of one');
});
