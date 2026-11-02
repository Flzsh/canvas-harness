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

test('the railgun gets everything ready during its charge: the shot itself reads nothing and adds nothing, and pieces in the air go home with Put it back', () => {
  const h = heavy(); let shot = null; h.context.ReservePlaySpace = { rail: (fx, pit, hot, o) => { shot = o; return { frame() {}, done: false }; } };
  h.api.railgun(600, 130); assert.equal(shot, null, 'nothing is read on the click itself'); h.frame(40);
  assert.ok(shot.pieces.length > 20, `${shot.pieces.length} pieces`); assert.ok(shot.digits.length > 20);
  assert.ok(shot.pieces.every(p => p.s.style.visibility !== 'hidden' && p.c.style.visibility === 'hidden' && /translate\(/.test(p.c.style.transform)), 'the page is untouched and each copy waits where its piece will land');
  const reads = h.reads, spans = h.document.querySelectorAll('#chb-layer *').length; h.frame(900); assert.equal(h.reads, reads, 'firing measures nothing');
  const first = shot.pieces[0], second = shot.pieces[1]; shot.onGo(first); shot.onLand(first); shot.onGo(second);
  assert.equal(first.s.style.visibility, 'hidden'); assert.equal(first.c.style.visibility, ''); assert.equal(second.c.style.visibility, 'hidden'); assert.ok(h.document.querySelectorAll('#chb-layer *').length <= spans + 4, 'one screen dimmer is all the shot adds');
  h.api.undo(); h.finish(); assert.equal(h.page.children[0], h.original); assert.equal(h.page.querySelectorAll('.chb-ch').length, 0); assert.equal(h.document.getElementById('chb-layer').children.length, 0);
});

test('the laser draws its cut a stretch at a time: a long cut adds nothing to the page but what it cuts, and buttons and pictures are cut too', () => {
  const h = fixture({ text: 'abcde '.repeat(40).trim(), width: 1200, height: 800 }); const cuts = []; h.context.ReservePlaySpace = { cutter: () => ({ cut: (...a) => cuts.push(a), spit() {}, stop() {}, frame() {}, alive: false }) };
  const btn = h.document.createElement('button'); btn.rect = { left: 300, top: 300, width: 80, height: 40, right: 380, bottom: 340 }; h.page.append(btn); btn.cloneNode = () => { const c = h.document.createElement('button'); c.removeAttribute = () => {}; return c; };
  h.context.getComputedStyle = () => ({ borderTopWidth: '0', borderBottomWidth: '0', borderLeftWidth: '0', borderRightWidth: '0' });
  h.api.laser(100, 500, true); h.api.laser(105, 500, false); const start = h.document.getElementById('chb-layer').children.length; for (let i = 1; i <= 60; i++) h.api.laser(105 + i * 10, 500, false);
  assert.equal(cuts.length, 61, 'one stretch per move'); assert.equal(h.document.getElementById('chb-layer').children.length, start, 'the cut is one picture however long it gets');
  h.frame(400); h.api.laser(340, 320, true); h.api.laser(345, 320, false); assert.ok(btn.style.visibility === 'hidden' && btn._halves?.length === 2, 'the button is cut in two'); assert.match(btn._halves[0].style.clipPath, /^polygon\(0px 0px,80px 0px,80px 20px,0px 20px\)$/, 'the top half, parted along the beam'); h.api.laserOff?.();
});

test('a far line goes as one long piece, never over a word already taken: no text is doubled', () => {
  const h = fixture({ text: 'First', width: 1600, height: 900 }); h.original.rect = { left: 4, top: 4, width: 50, height: 20, right: 54, bottom: 24 };
  let shot = null; h.context.ReservePlaySpace = { hole: (cv, x, y, o) => { shot = o; return { frame() {}, close() {}, closeNow() {}, done: false, timeAt: d => d * 2, closeAt: 9600, reachMax: 600, W: 1600, H: 900 }; }, textSheet: () => ({}) };
  for (let i = 0; i < 200; i++) { const left = 100 + i % 10 * 60, top = 30 + Math.floor(i / 10) * 40; h.page.append('abcde fghij klmno'); h.page.children.at(-1).rect = { left, top, width: 170, height: 20, right: left + 170, bottom: top + 20 }; }
  h.document.elementsFromPoint = () => []; const before = h.page.textContent; h.api.blackhole(500, 400); h.frame(40); assert.equal(h.page.textContent, before, 'the page reads exactly as before');
});

test('the page folds whole, sidebar and top bar too, and never the tray', () => {
  const h = fixture({ width: 1200, height: 800, mountOptions: { blocks: '.named' } }); const top = h.document.createElement('nav'), side = h.document.createElement('aside'), named = h.document.createElement('section'); named.className = 'named'; h.page.append(top, side, named); h.page.append(h.box);
  for (const el of [top, side, named]) el.rect = { left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40 };
  h.api.foil(600, 400); h.frame(2500); const folded = h.animations.filter(a => /scale\(1\.06,\.004\)/.test(JSON.stringify(a.keys))).map(a => a.el);
  for (const el of [top, side, named]) assert.ok(folded.includes(el), el.tagName); assert.ok(!folded.some(el => el === h.box || el.querySelector?.('.chb-box')), 'the tray stays, Put it back is in it');
});

test('a balloon takes whatever is under it, not only a word', () => {
  const h = fixture({ text: 'abcde', width: 1200, height: 800 }), btn = h.document.createElement('button'); btn.rect = { left: 300, top: 300, width: 80, height: 40, right: 380, bottom: 340 }; h.page.append(btn); btn.cloneNode = () => { const c = h.document.createElement('button'); c.removeAttribute = () => {}; return c; };
  h.context.getComputedStyle = () => ({ borderTopWidth: '0', borderBottomWidth: '0', borderLeftWidth: '0', borderRightWidth: '0' }); h.document.elementsFromPoint = () => [];
  const b = h.api.balloon(340, 320); assert.ok(b?.body, 'it is tied on'); assert.equal(btn.style.visibility, 'hidden'); assert.equal(b.body.parts[0].s, btn);
  const empty = h.api.balloon(900, 700); assert.equal(empty.ties.length, 0, 'empty paper gives nothing to tie to, and the balloon goes up all the same'); assert.ok(empty.el.isConnected);
});

test('a thrown piece falls by one set of rules: toss is the path of flight turned into keyframes', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.js'), 'utf8'); assert.match(source, /function toss\(x0, y0, vx, vy, spin, h = 12, mid = ''\) \{\n  const path = flight\(/);
  const space = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-space.js'), 'utf8'), body = space.slice(space.indexOf('function rail('), space.indexOf('the black hole, opened in the page'));
  assert.doesNotMatch(body.slice(body.indexOf('function frame(t)')), /fillText|createElement/, 'text is pictures from the sheet by the time it flies');
  assert.doesNotMatch(body.slice(body.indexOf('function shot(t)')), /shadowBlur|\.filter/, 'no blur while it plays');
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

test('a copy keeps the paint the page gave its insides: art the page draws with fill none is no black block, and a nested drawing keeps its place', () => {
  const h = fixture({ width: 1200, height: 800 }), NS = 'http://www.w3.org/2000/svg', art = tag => { const n = h.document.createElement(tag); n.namespaceURI = NS; n.localName = tag; return n; }, box = (left, top) => ({ left, top, width: 40, height: 40, right: left + 40, bottom: top + 40 });
  const svg = art('svg'), line = art('path'), svgCopy = art('svg'), lineCopy = art('path'); svg.append(line); svgCopy.append(lineCopy); svg.rect = box(340, 320); svg.cloneNode = () => svgCopy; h.page.append(svg);
  const btn = h.document.createElement('button'), icon = art('svg'), btnCopy = h.document.createElement('button'), iconCopy = art('svg'); btn.append(icon); btnCopy.append(iconCopy); btn.rect = box(300, 320); btn.cloneNode = () => btnCopy; h.page.append(btn);
  h.context.getComputedStyle = el => el === line ? { fill: 'none', stroke: 'rgb(201, 100, 66)', strokeWidth: '2px', transform: 'none' } : el === icon ? { position: 'static', width: '16px', height: '16px', fill: 'rgb(1, 2, 3)', transform: 'none' } : { fill: 'rgb(0, 0, 0)', position: 'static', transform: 'none' };
  h.api.blackhole(340, 320); assert.equal(svg.style.visibility, 'hidden', 'the picture went'); assert.equal(lineCopy.style.fill, 'none'); assert.equal(lineCopy.style.stroke, 'rgb(201, 100, 66)'); assert.equal(lineCopy.style.strokeWidth, '2px'); assert.equal(svgCopy.style.position, 'absolute', 'the copy itself sits where the thing was');
  assert.equal(iconCopy.style.position, 'static', 'a drawing in a button stays in the button'); assert.equal(iconCopy.style.width, '16px');
});

const crumb = (h, text) => { const li = h.document.createElement('li'); li.rect = { left: 300, top: 300, width: 160, height: 20, right: 460, bottom: 320 }; h.page.append(li); li.append(text); li.children[0].rect = li.rect; return li; };
const watcher = h => { const w = { fire: null, off: 0 }; h.context.MutationObserver = class { constructor(fn) { w.fire = fn; } observe() {} disconnect() { w.off++; } }; return w; };
const redraw = (h, li, text) => { const old = li.children[0]; old.remove(); li.append(text); return [{ target: li, removedNodes: [old] }]; };
test('a host that redraws text we split gets our holder back: nothing reads twice, and Put it back leaves the host its own fresh text', () => {
  const h = fixture({ width: 1200, height: 800 }), w = watcher(h), li = crumb(h, 'Course home page'); h.api.blackhole(330, 310); h.frame(40); const holder = li.children[0];
  assert.ok(holder.querySelectorAll('.chb-ch').length || holder.classList.contains('chb-run'), 'the bomb split it'); assert.ok(w.fire, 'the watcher is on while anything is split');
  const records = redraw(h, li, 'Course home page'), fresh = li.children[0]; assert.notEqual(fresh, holder); w.fire(records); assert.equal(li.children[0], holder, 'our holder is back in place of the fresh text'); assert.equal(li.children.length, 1); assert.equal(li.textContent, 'Course home page');
  h.api.undo(); h.finish(); assert.ok(w.off > 0, 'the watcher is off for Put it back'); assert.equal(li.children[0], fresh, 'the host keeps its fresh text node'); assert.equal(li.children.length, 1); assert.equal(li.textContent, 'Course home page'); assert.equal(li.querySelectorAll('.chb-ch').length, 0);
});

test('a framework that keeps fighting back is left alone after three returns: the crumb is hidden until Put it back, and it is not doubled', () => {
  const h = fixture({ width: 1200, height: 800 }), w = watcher(h), li = crumb(h, 'Course home page'); h.api.blackhole(330, 310); h.frame(40);
  for (let i = 0; i < 3; i++) { w.fire(redraw(h, li, 'Course home page')); assert.notEqual(li.children[0].nodeType, 3, `return ${i + 1}`); assert.notEqual(li.style.visibility, 'hidden'); }
  w.fire(redraw(h, li, 'Course home page')); assert.equal(li.children[0].nodeType, 3, 'the host has it now'); assert.equal(li.style.visibility, 'hidden', 'hidden, not doubled');
  h.api.undo(); h.finish(); assert.notEqual(li.style.visibility, 'hidden'); assert.equal(li.textContent, 'Course home page');
});

test('a host that changes the words while pieces are out: the new text waits a moment, then that crumb is hidden until Put it back rather than left half shown', () => {
  const h = fixture({ width: 1200, height: 800 }), w = watcher(h), li = crumb(h, 'Course home page'); h.api.blackhole(330, 310); h.frame(40);
  w.fire(redraw(h, li, 'Course home…')); assert.notEqual(li.style.visibility, 'hidden', 'it may still be coming back'); assert.equal(li.children[0].nodeType, 3); h.frame(200); h.frame(200); assert.equal(li.style.visibility, 'hidden');
  h.api.undo(); h.finish(); assert.notEqual(li.style.visibility, 'hidden'); assert.equal(li.textContent, 'Course home…');
});

test('the hole\'s pull is the whole screen: far words lean with no copies, words past every budget go at the burst, nothing comes back, and Put it back is exact', () => {
  const h = fixture({ text: 'First', width: 1600, height: 900 }); h.original.rect = { left: 4, top: 4, width: 50, height: 20, right: 54, bottom: 24 }; let shot = null;
  h.context.ReservePlaySpace = { hole: (cv, x, y, o) => { shot = o; return { frame() {}, close() {}, closeNow() {}, done: false, timeAt: d => Math.min(d, 400) / 500, popAt: 1000, closeAt: 2000, hitAt: d => 1000 + d / 4, energyAt: () => 0, flat: .3, reachMax: 300, W: 1600, H: 900 }; }, textSheet: pieces => { for (const p of pieces) p.e = { x: 0, y: 0, w: 1, h: 1, dw: 1, dh: 1 }; return { width: 1, height: 1 }; } };
  for (let i = 0; i < 1400; i++) { const left = i % 40 * 39, top = Math.floor(i / 40) * 25; h.page.append('abc def'); h.page.children.at(-1).rect = { left, top, width: 36, height: 20, right: left + 36, bottom: top + 20 }; }
  h.document.elementsFromPoint = () => []; const before = h.page.textContent; h.api.blackhole(800, 450); h.frame(40); assert.equal(h.page.textContent, before, 'wrapped, and it reads exactly as before');
  assert.equal(h.document.querySelectorAll('#chb-layer > span').length, 0, 'the far field needs no copies'); const pieces = h.page.querySelectorAll('.chb-ch'); assert.ok(pieces.length >= 1400, `${pieces.length} pieces cover the screen`);
  const ctx = { getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), setTransform() {}, translate() {}, rotate() {}, scale() {}, drawImage() {}, globalAlpha: 1 }; shot.after(ctx, .9, 1); h.frame(1200); shot.after(ctx, 1.2, 1); assert.ok(pieces.every(s => s.style.visibility === 'hidden'), 'no word is left on the page after the burst');
  shot.after(ctx, 3, 1); assert.ok(pieces.every(s => s.style.visibility === 'hidden'), 'and none comes back when it closes');
  h.api.undo(); h.finish(); assert.equal(h.page.textContent, before); assert.equal(h.page.querySelectorAll('.chb-ch').length, 0); assert.equal(h.document.getElementById('chb-layer').children.length, 0);
});

test('Put it back in the middle of the hole, before and after the burst, restores the page exactly', () => {
  for (const at of [40, 1300]) { const h = fixture({ text: 'First', width: 1600, height: 900 }); h.original.rect = { left: 4, top: 4, width: 50, height: 20, right: 54, bottom: 24 }; let shot = null;
    h.context.ReservePlaySpace = { hole: (cv, x, y, o) => { shot = o; return { frame() {}, close() {}, closeNow() {}, done: false, timeAt: d => Math.min(d, 400) / 500, popAt: 1000, closeAt: 2000, hitAt: d => 1000 + d / 4, energyAt: () => 0, flat: .3, reachMax: 300, W: 1600, H: 900 }; }, textSheet: pieces => { for (const p of pieces) p.e = { x: 0, y: 0, w: 1, h: 1, dw: 1, dh: 1 }; return { width: 1, height: 1 }; } };
    for (let i = 0; i < 1000; i++) { const left = i % 40 * 39, top = Math.floor(i / 40) * 25; h.page.append('abc def'); h.page.children.at(-1).rect = { left, top, width: 36, height: 20, right: left + 36, bottom: top + 20 }; }
    h.document.elementsFromPoint = () => []; const before = h.page.textContent, nodes = [...h.page.children]; h.api.blackhole(800, 450); h.frame(at); h.api.undo(); h.finish(); assert.equal(h.page.textContent, before); assert.equal(h.page.querySelectorAll('.chb-ch').length, 0); assert.ok(h.page.children.every((n, i) => n === nodes[i]), 'the same text nodes, in the same order'); assert.equal(h.document.getElementById('chb-layer').children.length, 0); }
});

// the laser's sheet: a stroke of several self-crossings, loops closed on another stroke, rings, corners. Every piece a cut encloses goes, once
const laserBench = () => { const { cutMap } = require('../extension/play-space.js'), h = fixture({ text: 'abcde '.repeat(40).trim(), width: 1440, height: 900 }), spits = [], cleared = []; h.context.ReservePlaySpace = { cutMap, cutter: () => ({ cut() {}, spit: (...a) => spits.push(a), clear: l => cleared.push(...l), stop() {}, frame() {}, alive: false }) };
  Object.getPrototypeOf(h.page).cloneNode = function () { const c = h.document.createElement('span'); Object.assign(c.style, this.style); return c; };
  const opened = () => h.document.getElementById('chb-layer').children.filter(c => c.style.overflow === 'hidden' && c.style.clipPath).length, settle = () => { for (let i = 0; i < 40; i++) h.frame(60); };
  const stroke = pts => { h.api.laser(pts[0][0], pts[0][1], true); for (const [x, y] of pts.slice(1)) h.api.laser(x, y, false); h.api.laserOff(); settle(); };
  return { h, spits, cleared, opened, stroke, settle }; };
const beamLine = (a, b, c, d, n = 40) => Array.from({ length: n + 1 }, (_, i) => [a + (c - a) * i / n, b + (d - b) * i / n]), beamRing = (cx, cy, r, turn = 1) => Array.from({ length: 91 }, (_, i) => [cx + Math.cos(i / 90 * 6.283 * turn) * r, cy + Math.sin(i / 90 * 6.283 * turn) * r]);
test('one long stroke crossing itself drops every piece it encloses, and a piece never drops twice', () => {
  const { opened, stroke } = laserBench(), knot = Array.from({ length: 240 }, (_, i) => { const t = i / 239 * 6.283, k = 1 + .16 * Math.sin(5 * t + 1); return [720 + Math.sin(3 * t + .5) * 360 * k, 378 + Math.sin(2 * t) * 240 * k]; });
  stroke(knot); assert.equal(opened(), 8, 'all eight closed pieces, where the old loop finder freed three'); stroke(knot); assert.equal(opened(), 8, 'cutting the same way again frees nothing new');
});
test('a loop closed on another stroke drops, a ring round a gone piece drops without covering it, and a cut inside a hole leaves no mark', () => {
  const a = laserBench(); a.stroke([...beamLine(300, 300, 700, 300), ...beamLine(700, 300, 700, 640).slice(1)]); assert.equal(a.opened(), 0, 'not closed yet'); a.stroke([...beamLine(720, 620, 300, 620), ...beamLine(300, 620, 300, 280).slice(1)]); assert.equal(a.opened(), 1, 'the second stroke closes on the first');
  const b = laserBench(); b.stroke(beamRing(500, 400, 80)); assert.equal(b.opened(), 1); b.stroke(beamRing(500, 400, 170)); assert.equal(b.opened(), 2); const hole = b.h.document.getElementById('chb-layer').children.filter(c => c.style.overflow === 'hidden' && c.style.clipPath).at(-1); assert.match(hole.style.clipPath, /^path\('M.*ZM.*Z'\)$/, 'the ring keeps the first hole open');
  const c = laserBench(); c.stroke(beamRing(500, 400, 170)); const before = c.h.document.getElementById('chb-layer').children.length; c.stroke(beamRing(500, 400, 80)); assert.equal(c.opened(), 1, 'nothing to free in a hole'); assert.equal(c.h.document.getElementById('chb-layer').children.length, before);
});
test('the two sides of a cut between two freed pieces are both gone, so the seam between them goes too', () => {
  const { opened, cleared, stroke } = laserBench(); stroke(beamRing(500, 400, 120)); assert.equal(cleared.length, 0, 'a hole keeps its rim'); stroke([...beamLine(620, 400, 860, 400), ...beamLine(860, 400, 860, 520).slice(1), ...beamLine(860, 520, 560, 520).slice(1), ...beamLine(560, 520, 560, 508).slice(1)]); assert.equal(opened(), 2); assert.ok(cleared.length > 0 && cleared.every(([x0, y0]) => x0 > 555 && y0 > 395), 'the stretch of the ring between the two pieces');
  const t = laserBench(); t.stroke(beamLine(300, 300, 900, 300)); t.stroke(beamLine(300, 600, 900, 600)); t.stroke(beamLine(300, 280, 300, 620)); t.stroke(beamLine(600, 280, 600, 620)); assert.equal(t.opened(), 1); t.stroke(beamLine(900, 280, 900, 620)); assert.equal(t.opened(), 2); assert.ok(t.cleared.length > 0 && t.cleared.every(([x0, , x1]) => Math.abs(x0 - 600) < 1 && Math.abs(x1 - 600) < 1), 'only the cut between them');
});
test('a cut from screen edge to screen edge drops the smaller side; a cut that stops short of the edge or misses by more than a few pixels drops nothing', () => {
  const a = laserBench(); a.stroke(beamLine(0, 240, 300, 0)); assert.equal(a.opened(), 1, 'the corner is cut off'); const b = laserBench(); b.stroke(beamLine(8, 240, 300, 8)); assert.equal(b.opened(), 1, 'a few pixels short still reaches it');
  const c = laserBench(); c.stroke(beamLine(200, 450, 1200, 450)); assert.equal(c.opened(), 0); const d = laserBench(); d.stroke(beamRing(500, 400, 120, .97)); assert.equal(d.opened(), 0, 'a gap of 22 pixels is a gap'); const e = laserBench(); e.stroke(beamRing(500, 400, 120, .99)); assert.equal(e.opened(), 1, 'a gap of 7 pixels is closed');
});
test('Put it back after a cut restores the page and the next cut starts on a clean sheet', () => {
  const { h, opened, stroke } = laserBench(), words = h.page.textContent; stroke(beamRing(500, 400, 170)); h.api.undo(); h.finish(); assert.equal(h.page.children[0], h.original); assert.equal(h.page.textContent, words); assert.equal(opened(), 0); stroke(beamRing(500, 400, 170)); assert.equal(opened(), 1, 'the same cut works again'); h.api.undo(); h.finish(); assert.equal(h.page.textContent, words);
});

test('wet paint dries quickly so the woken words are seen: a long stroke starts a new sheet and the old one goes first', () => {
 const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.js'), 'utf8'), [, hold, fade] = source.match(/DRY_HOLD = (\d+), DRY_FADE = (\d+)/);
 assert.ok(+hold + +fade <= 1600, 'gone in about a second and a half, not seven');
 const h = fixture({ text: 'abcde', width: 1200, height: 800 }), sheets = () => h.document.querySelectorAll('canvas').length; h.document.elementsFromPoint = () => [];
 h.api.pick('painter'); h.dispatch('pointerdown', h.page, 100, 300); for (let i = 1; i <= 8; i++) h.dispatch('pointermove', h.page, 100 + i * 100, 300);
 assert.ok(sheets() >= 2, 'a long stroke has moved on to a new sheet'); h.dispatch('pointerup', h.page, 900, 300);
});

test('the beam cutting a picture in two takes its style before hiding it, so Put it back does not restore it hidden', () => {
 const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.js'), 'utf8'), at = source.indexOf('const t = half(true), b = half(false);');
 assert.ok(at > 0 && source.indexOf("s.style.visibility = 'hidden'", at) - at < 60, 'hidden right after the copies are made, never before');
});

test('a badge goes whole, its number with it, and a font icon goes too: left out they stay behind as a dot or a tick', () => {
 const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.js'), 'utf8');
 assert.match(source, /const THINGS = '[^\n]*BADGE[^\n]*i\[class\*=icon-\]/); assert.match(source, /const SKIP = [^\n]*BADGE/, 'its number is not taken a second time as a word');
});

test('what the page keeps at nothing stays: a hover card under a dock tile has a box but no copy, and it would fade up as an empty frame', () => {
 const h = fixture({ text: 'abcde', width: 1200, height: 800 }), make = (left, show) => { const b = h.document.createElement('button'); b.rect = { left, top: 300, width: 80, height: 40, right: left + 80, bottom: 340 }; h.page.append(b); b.cloneNode = () => { const c = h.document.createElement('button'); c.removeAttribute = () => {}; return c; }; b.checkVisibility = () => show; return b; };
 const card = make(300, false), seen = make(500, true); h.context.getComputedStyle = () => ({ borderTopWidth: '0', borderBottomWidth: '0', borderLeftWidth: '0', borderRightWidth: '0' });
 h.api.laser(340, 320, true); h.api.laser(345, 320, false); h.frame(400); h.api.laser(540, 320, true); h.api.laser(545, 320, false);
 assert.equal(seen._halves?.length, 2, 'what shows is cut'); assert.ok(!card._halves && card.style.visibility !== 'hidden', 'what does not is left alone'); h.api.laserOff?.();
});

test('a fast laser swipe cuts all it crossed, not only where the pointer landed, and a picture parts along the beam', () => {
 const h = fixture({ text: 'abcde', width: 1200, height: 800 }), pic = h.document.createElement('button'); pic.rect = { left: 400, top: 300, width: 200, height: 200, right: 600, bottom: 500 }; h.page.append(pic); pic.cloneNode = () => { const c = h.document.createElement('button'); c.removeAttribute = () => {}; return c; };
 h.context.getComputedStyle = () => ({ borderTopWidth: '0', borderBottomWidth: '0', borderLeftWidth: '0', borderRightWidth: '0' });
 h.api.laser(200, 300, true); h.api.laser(800, 500, false);
 assert.equal(pic._halves?.length, 2, 'one long move, and the picture in the middle of it is cut'); for (const c of pic._halves) assert.match(c.style.clipPath, /^polygon\(/); assert.notEqual(pic._halves[0].style.clipPath, pic._halves[1].style.clipPath); h.api.laserOff?.();
});

test('a block with a transform of its own keeps it through the pull and the fold, and a drawer parked off the side is left out', () => {
 const read = f => require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/' + f), 'utf8').replace(/\s+/g, '');
 const source = read('play-tools.js');
 for (const text of ['r.right>0&&r.left<innerWidth', "own=ownMove(el),an=el.animate([{transform:own||'none'}", "own=ownMove(el),a=el.animate([{transform:own||'none'}", 'folds.push({el,a:an,prev,own})', 'folds.push({el,a,prev,own})', "{transform:f.own||'none'}"]) assert.ok(source.includes(text), text);
 assert.ok(!read('submit-celebrate.js').includes("shake:'#application"), 'a transform on the application would re-anchor everything fixed inside it');
});

test('after the burst nothing is left: the page blocks go too, panels and backgrounds with them, but not the edge that brings out the dock', () => {
 const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.js'), 'utf8').replace(/\s+/g, '');
 assert.ok(source.includes("for(constelofpageBlocks()){if(hushed.has(el)||el.matches?.('.chn-edge'))continue;hushed.set(el,el.style.visibility);el.style.visibility='hidden';}"), 'its own visibility kept for Put it back');
});

test('a fast paint stroke wakes every word it crossed, not only the one where the brush ended', () => {
 const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.js'), 'utf8'), at = source.indexOf('function paint(x, y, first)'), body = source.slice(at, source.indexOf('\n}\n', at));
 assert.match(body, /splitWords\(wordsNear\(mx, my, reach\)\.filter\(w => crossed\(w\.r, lx, ly, x, y, 14\)\)\)/); assert.match(body, /if \(!crossed\(r, lx, ly, x, y, 5\)\) continue;/); assert.doesNotMatch(body, /splitWords\(wordsNear\(x, y, 14\)\)/);
});

test('text in a display: contents wrapper still counts as shown: the check has no box to look at there, so the parent answers', () => {
 const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.js'), 'utf8').replace(/\s+/g, '');
 assert.ok(source.includes("constshowing=el=>{for(lete=el;e;e=e.parentElement){if(e.checkVisibility?.({checkOpacity:true,checkVisibilityCSS:true})!==false)returntrue;if(getComputedStyle(e).display!=='contents')returnfalse;}returntrue;};"));
});

test('the beam cuts the letters it passes through the middle of, not the lines above and below it', () => {
 const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../extension/play-tools.js'), 'utf8');
 assert.ok(source.replace(/\s+/g, '').includes('if(!s._thing&&segDist(r.left+r.width/2,r.top+r.height/2,lx,ly,x,y)>9)continue;'));
 const seg = new Function('return ' + source.match(/const segDist = ([\s\S]*?\});/)[1])();
 assert.equal(seg(5, 10, 0, 0, 10, 0), 10); assert.equal(seg(-3, 4, 0, 0, 10, 0), 5); assert.equal(seg(4, 0, 4, 0, 4, 0), 0);
});

