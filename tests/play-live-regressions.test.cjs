'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { fixture } = require('./play-tools-fixture.cjs');
const run = (h, count) => { for (let i = 0; i < count; i++) h.frame(); };
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: expected ${expected}, got ${actual}`);
function renderedBounds(body) {
  const points = [];
  for (const { c, r } of body.parts) {
    const [, dx, dy, degrees] = c.style.transform.match(/translate\(([-\d.e+]+)px,([-\d.e+]+)px\) rotate\(([-\d.e+]+)deg\)/);
    const [ox, oy] = c.style.transformOrigin.split(' ').map(parseFloat), angle = +degrees * Math.PI / 180;
    for (const x of [0, r.width]) for (const y of [0, r.height]) points.push({ x: parseFloat(c.style.left) + ox + (x - ox) * Math.cos(angle) - (y - oy) * Math.sin(angle) + +dx, y: parseFloat(c.style.top) + oy + (x - ox) * Math.sin(angle) + (y - oy) * Math.cos(angle) + +dy });
  }
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}
function tether(balloon) {
  assert.equal(balloon.string.style.transformOrigin, '0 50%');
  const [, x, y, degrees] = balloon.string.style.transform.match(/^translate\(([-\d.e+]+)px,([-\d.e+]+)px\) rotate\(([-\d.e+]+)deg\)$/), angle = +degrees * Math.PI / 180;
  const line = balloon.string.querySelector('path'), [, length] = line.getAttribute('d').match(/^M0 0L([-\d.e+]+) 0$/);
  const bounds = renderedBounds(balloon.body);
  near(+x, balloon.x, 'string starts at the knot x');
  near(+y, balloon.y + 1, 'string starts at the knot y');
  near(+x + Math.cos(angle) * +length, (bounds.left + bounds.right) / 2, 'string ends at the rendered group centre x');
  near(+y + Math.sin(angle) * +length, bounds.top, 'string ends at the rendered group top');
  assert.equal(line.getAttribute('vector-effect'), 'non-scaling-stroke');
  assert.equal(line.getAttribute('stroke-linecap'), 'butt', 'the cap must not extend beyond the endpoint');
  assert.equal(line.getAttribute('stroke-width'), '1.3', 'a long string retains a thin stroke');
}

test('1: the balloon tether ends at the rendered word bounds after every solver frame and drag', () => {
  const h = fixture(), b = h.api.balloon(110, 130);
  tether(b);
  const reads = h.reads;
  for (let i = 0; i < 140; i++) { h.frame(); tether(b); }
  assert.equal(h.reads, reads, 'the rise and drawing loop perform no layout reads');
  const copy = b.body.parts[0].c;
  h.dispatch('pointerdown', copy, b.body.x, b.body.y, { pointerType: 'mouse' });
  h.dispatch('pointermove', copy, b.body.x + 80, b.body.y + 35, { pointerType: 'mouse' });
  tether(b);
  h.dispatch('pointerup', copy, b.body.x, b.body.y, { pointerType: 'mouse' });
  h.api.physics.force(b.body, 100, 0);
  b.body.angle = 31.25;
  for (let i = 0; i < 20; i++) { h.frame(); tether(b); }
});

test('2: staggered balloons keep independent visible words and unscaled thin tethers above a floor pile', () => {
  const h = fixture();
  h.api.pick('balloon');
  h.dispatch('click', h.page, 110, 130, { pointerType: 'mouse' });
  const first = h.api.balloons[0], copies = first.body.parts.map(p => p.c);
  run(h, 160);
  h.dispatch('click', h.page, 160, 130, { pointerType: 'mouse' });
  const second = h.api.balloons[1];
  assert.ok(second);
  assert.notEqual(first.body, second.body);
  h.api.physics.settle(h.api.physics.add({ x: 120, y: 500, width: 100, height: 20 }));
  assert.ok(h.api.physics.floor.size);
  for (let i = 0; i < 250; i++) {
    h.frame();
    for (const b of [first, second]) {
      tether(b);
      assert.equal(b.body.retired, false);
      assert.equal(b.body.pile, null, 'a carried word never joins the floor pile');
      const bounds = renderedBounds(b.body);
      assert.ok(bounds.bottom < 600 && bounds.left >= 0 && bounds.right <= 800);
      if (b.tied) assert.ok(bounds.top > b.y, 'after attachment the word stays under its own balloon');
      for (const p of b.body.parts) { assert.equal(p.c.isConnected, true); assert.equal(p.c._body, b.body); assert.equal(p.s._c, p.c); assert.notEqual(p.c.style.visibility, 'hidden'); assert.notEqual(p.c.style.opacity, '0'); }
    }
  }
  assert.deepEqual(first.body.parts.map(p => p.c), copies, 'placing a second balloon preserves the first copies');
  assert.equal(first.body.parts.map(p => p.c.textContent).join(''), 'Play');
  assert.equal(second.body.parts.map(p => p.c.textContent).join(''), 'with');
  h.api.popBalloon(second);
  run(h, 500);
  tether(first);
  assert.ok(first.body.parts.every(p => p.c.isConnected));
  h.api.undo(); h.finish();
  assert.equal(h.page.children[0], h.original);
  assert.equal(h.document.querySelectorAll('.chb-physics-body').length, 0);
  assert.equal(h.frames.size, 0);
});

test('3: lifted letters keep the page type with a letter-shaped shadow, no card, and every live tool copy receives it', () => {
  const css = fs.readFileSync(path.join(__dirname, '../extension/play-tools.css'), 'utf8');
  const rule = css.match(/#chb-layer\s+\.chb-physics-body\{([^}]+)\}/);
  assert.ok(rule, 'the letter style is scoped to the overlay so a host span rule cannot override it');
  assert.equal(rule[1], 'background:none;box-shadow:none;filter:drop-shadow(1.5px 2.5px 1px rgb(20 20 19/.22))');
  assert.match(css, /\.chb-physics-body\{[^}]*z-index:5/, 'letters paint above the tether');
  for (const mode of ['balloon', 'portal', 'gravity', 'magnet']) {
    const h = fixture();
    if (mode === 'balloon') h.api.balloon(110, 130);
    if (mode === 'gravity') h.api.gravity();
    if (mode === 'magnet') h.api.magnet(160, 130);
    if (mode === 'portal') { h.api.pick('portal'); h.dispatch('pointerdown', h.page, 110, 130); h.dispatch('pointermove', h.page, 160, 140); h.dispatch('pointerup', h.page, 160, 140); }
    assert.ok(h.api.physics.bodies.length, mode);
    for (const b of h.api.physics.bodies) for (const { c, r } of b.parts) {
      assert.ok(c.classList.contains('chb-physics-body'), mode);
      assert.equal(c.parentElement.id, 'chb-layer', mode);
      assert.equal(parseFloat(c.style.width), r.width, 'the rendered copy has its cached width');
      assert.equal(parseFloat(c.style.height), r.height, 'the rendered copy has its cached height');
      for (const key of ['background', 'backgroundColor', 'borderRadius', 'boxShadow']) assert.ok(!c.style[key], `${mode}: no inline ${key} overrides the paper rule`);
    }
    const reads = h.reads; run(h, 30); assert.equal(h.reads, reads, mode + ': no layout reads in the loop');
  }
});

test('4: a low word rises all the way to the visible balloon ceiling and then bobs there', () => {
  const h = fixture();
  Object.assign(h.original.rect, { top: 480, bottom: 500 });
  const b = h.api.balloon(110, 490);
  run(h, 90);
  let last = renderedBounds(b.body).top;
  const reads = h.reads;
  for (let second = 0; second < 8; second++) {
    run(h, 63);
    const top = renderedBounds(b.body).top;
    assert.ok(top < last - 10 || b.y < 65, 'the carried word keeps ascending until the balloon is at the ceiling');
    last = top;
  }
  assert.ok(b.y >= 52 && b.y < 65, `the entire balloon reaches the top: knot y = ${b.y}`);
  const positions = [];
  for (let i = 0; i < 160; i++) { h.frame(); positions.push(b.y); tether(b); }
  assert.ok(Math.max(...positions) - Math.min(...positions) > 2, 'the balloon bobs at the ceiling');
  assert.ok(positions.every(y => y >= 52 && y < 65));
  assert.equal(h.reads, reads);
  h.api.popBalloon(b); run(h, 900);
  assert.equal(h.frames.size, 0, 'the loop sleeps after the carried word is released and settles');
});

test('5: reduced motion keeps tether endpoints correct with no loop, and undo restores each tool completely', () => {
  for (const mode of ['balloon', 'portal', 'gravity', 'magnet']) {
    const h = fixture({ reduced: true });
    if (mode === 'balloon') { const b = h.api.balloon(110, 130); tether(b); assert.equal(b.tied, true); }
    if (mode === 'portal') { h.api.pick('portal'); h.dispatch('pointerdown', h.page, 110, 130); h.dispatch('pointermove', h.page, 160, 140); h.dispatch('pointerup', h.page, 160, 140); }
    if (mode === 'gravity') h.api.gravity();
    if (mode === 'magnet') { h.api.magnet(160, 130); h.api.magnet(210, 160); }
    assert.equal(h.frames.size, 0, mode);
    h.api.undo(); h.finish();
    assert.equal(h.page.children[0], h.original, mode);
    assert.equal(h.page.textContent, 'Play with words', mode);
    assert.equal(h.api.physics.bodies.length, 0, mode);
    assert.equal(h.api.physics.floor.size, 0, mode);
    assert.equal(h.api.physics.attractors.size, 0, mode);
    assert.equal(h.document.getElementById('chb-layer').children.length, 0, mode);
    assert.equal(h.frames.size, 0, mode);
  }
});

test('balloons created while hidden retain initial bounds and redraw the correct tether on visibility', () => {
  for (const reduced of [false, true]) {
    const h = fixture({ reduced });
    h.document.hidden = true; h.dispatch('visibilitychange');
    const b = h.api.balloon(110, 130);
    assert.ok(b);
    assert.equal(h.frames.size, 0);
    run(h, 60);
    assert.equal(b.age, 0);
    h.document.hidden = false; h.dispatch('visibilitychange');
    tether(b);
    if (reduced) assert.equal(h.frames.size, 0);
    else { h.frame(); tether(b); }
    h.api.undo(); h.finish();
    assert.equal(h.frames.size, 0);
    assert.equal(h.page.children[0], h.original);
  }
});
