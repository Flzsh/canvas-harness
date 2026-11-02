/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
// "Play with this page" after a submission. A drawn tool to play with the assignment page.
// Only for show: Canvas's data is never touched; while a tool is in hand the page's own clicks and links are ours;
// everything moved, hidden, drawn or folded is recorded and "Put it back" restores the page exactly. Esc puts a tool down.
// Behind the front end is the back end: wherever the page is torn, cut or cracked, streams of 0 and 1 show through.
// Usage: ReservePlay.mount({ box, root, blocks, shake, ours }) -> api. box: the element the tray and "Put it back" go in;
// root: the page area the tools work on; blocks: the page blocks the foil folds; shake: the elements a jolt moves;
// ours: a selector for anything of ours inside root that the tools must leave alone. Everything is undone by "Put it back".
(() => {
'use strict';
const TIER = Object.freeze({
  painter: 'common',
  balloon: 'common',
  ink: 'common',
  garden: 'common',
  eraser: 'uncommon',
  magnet: 'uncommon',
  hammer: 'rare',
  gravity: 'rare',
  portal: 'rare',
  laser: 'rare',
  bomb: 'epic',
  railgun: 'epic',
  blackhole: 'legendary',
  foil: 'legendary'
});
// every gadget has its own chance out of 100; the band shows on its button
const CHANCE = Object.freeze({ painter: 13, balloon: 13, ink: 12, garden: 12, eraser: 9, magnet: 9, hammer: 6, gravity: 6, portal: 5, laser: 5, bomb: 4, railgun: 3, blackhole: 2, foil: 1 });
// Supplying an RNG makes the public deal reproducible without changing the drawing's own seeded randomness.
function deal({ random = Math.random, last = '' } = {}) {
  const value = Number(random()), pool = Object.keys(TIER).filter(key => key !== last);
  let roll = (Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0) * pool.reduce((sum, key) => sum + CHANCE[key], 0);
  for (const key of pool) { roll -= CHANCE[key]; if (roll < 0) return key; }
  return pool.at(-1);
}
const mount = (opts = {}) => {
const listeners = [], listen = (target, type, fn, options) => {
  target.addEventListener(type, fn, options);
  listeners.push(() => target.removeEventListener?.(type, fn, options));
};
if (globalThis.ReserveFeatures?.enabled('play') === false) return null;
let dead = false, serial = 0, pausedAt = null, pausedTime = 0;
const nativeNow = () => globalThis.performance.now(), hidden = () => document.hidden || document.visibilityState === 'hidden';
if (hidden()) pausedAt = nativeNow();
const performance = { now: () => (pausedAt ?? nativeNow()) - pausedTime };
const frameJobs = new Map(), timeoutJobs = new Map(), pageAnimations = new Set(), heldAnimations = new Set();
function startFrame(job) { if (!dead && !hidden()) job.native = globalThis.requestAnimationFrame(() => { frameJobs.delete(job.id); if (!dead) job.fn(performance.now()); }); }
function requestAnimationFrame(fn) { if (dead) return 0; const job = { id: ++serial, fn }; frameJobs.set(job.id, job); startFrame(job); return job.id; }
function cancelAnimationFrame(id) { const job = frameJobs.get(id); if (job?.native != null) globalThis.cancelAnimationFrame(job.native); frameJobs.delete(id); }
function startTimeout(job) {
  if (!dead && !hidden()) job.native = globalThis.setTimeout(() => { timeoutJobs.delete(job.id); if (!dead) job.fn(); }, Math.max(0, job.at - performance.now()));
}
function setTimeout(fn, ms = 0) { if (dead) return 0; const job = { id: ++serial, fn, at: performance.now() + ms }; timeoutJobs.set(job.id, job); startTimeout(job); return job.id; }
function clearTimeout(id) { const job = timeoutJobs.get(id); if (job?.native != null) globalThis.clearTimeout(job.native); timeoutJobs.delete(id); }
function cancelWork() { for (const id of frameJobs.keys()) cancelAnimationFrame(id); for (const id of timeoutJobs.keys()) clearTimeout(id); }
// ---------------------------------------------------------------- the hand (the art skill's rules, in miniature)
let seed = 31; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647, J = a => (rnd() * 2 - 1) * a, R = v => Math.round(v * 10) / 10;
const ring = (cx, cy, rx, ry, n = 9, j = .06) => {
  const p = [];
  for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + J(.2), k = 1 + J(j); p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  return p;
};
const closed = pts => {
  const n = pts.length;
  let d = `M${R(pts[0][0])} ${R(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${R(p1[0] + (p2[0] - p0[0]) / 6)} ${R(p1[1] + (p2[1] - p0[1]) / 6)} ${R(p2[0] - (p3[0] - p1[0]) / 6)} ${R(p2[1] - (p3[1] - p1[1]) / 6)} ${R(p2[0])} ${R(p2[1])}`;
  }
  return d + 'Z';
};
const over = pts => {
  const q = [...pts, pts[0], [(pts[0][0] * 2 + pts[1][0]) / 3, (pts[0][1] * 2 + pts[1][1]) / 3]];
  let d = `M${R(q[0][0])} ${R(q[0][1])}`;
  for (let i = 0; i < q.length - 1; i++) {
    const p0 = q[Math.max(0, i - 1)], p1 = q[i], p2 = q[i + 1], p3 = q[Math.min(q.length - 1, i + 2)];
    d += `C${R(p1[0] + (p2[0] - p0[0]) / 6)} ${R(p1[1] + (p2[1] - p0[1]) / 6)} ${R(p2[0] - (p3[0] - p1[0]) / 6)} ${R(p2[1] - (p3[1] - p1[1]) / 6)} ${R(p2[0])} ${R(p2[1])}`;
  }
  return d;
};
const lerp = (a, b, k) => a + (b - a) * k, TAU = Math.PI * 2;
const lin = p => 'M' + p.map(([x, y]) => `${R(x)} ${R(y)}`).join('L') + 'Z';
const INK = '#141413',
  PAPER = '#FAF9F5',
  GOLD = '#E2B865',
  CLAY = '#D97757',
  DEEP = '#C96442',
  OAT = '#E3DACC',
  SLATE = '#6F7F8C',
  SKY = '#C9D6DF',
  KRAFT = '#D4A27F',
  SAGE2 = '#7D8B5F',
  VOID = '#16181B',
  DATA = '#7FB86E',
  DATA2 = '#B7E4A0',
  DATAINK = '#5E8F4E';
const inkP = (d, w = 2.4, o = 1, extra = '') => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o < 1 ? ` stroke-opacity="${o}"` : ''}${extra}/>`;
const bits = n => { let t = ''; for (let i = 0; i < n; i++) t += rnd() < .5 ? '0' : '1'; return t; };
const MONO = `font-family="Consolas,'Courier New',monospace" font-weight="700"`;

// ---------------------------------------------------------------- the tools' drawings (tray icons and in-hand), detailed
// shape: a wash set off its outline, the outline drawn over it and run past its start; lobe: the one lighter highlight
const off = (p, dx = 1.2, dy = 1) => p.map(([x, y]) => [x + dx, y + dy]);
const polyOver = p => 'M' + p.map(([x, y]) => `${R(x)} ${R(y)}`).join('L') + `L${R(p[0][0])} ${R(p[0][1])}L${R(p[0][0] + (p[1][0] - p[0][0]) * .3)} ${R(p[0][1] + (p[1][1] - p[0][1]) * .3)}`;
const shp = (p, c, w = 2, smooth = false) => `<path d="${smooth ? closed(off(p)) : lin(off(p))}" fill="${c}"/>` + inkP(smooth ? over(p) : polyOver(p), w);
const lobe = (p, o = .45) => `<path d="${closed(p)}" fill="${PAPER}" opacity="${o}"/>`;
const hat = (x, y, n = 3, len = 5, gap = 2.2, w = 1.1) => [...Array(n)].map((_, i) => inkP(`M${R(x + i * gap)} ${R(y)}l${R(-len * .45)} ${R(len)}`, w, .55)).join('');
const dot = (x, y, r, c) => `<path d="${closed(ring(x, y, r, r, 6, .08))}" fill="${c}"/>`;
const ART = {
  // a claw hammer: a steel head with a curved claw and a bevelled face, a wooden handle with grain and a clay grip
  hammer: () => shp([[-4.6, 6], [3.4, 6], [4.4, 50], [-3.6, 50]], KRAFT, 2.2) + inkP('M-1.6 10C-1.2 20 -1.8 30 -1 40M1.4 14C1.8 22 1.2 30 1.8 36', 1, .4)
    + shp([[-4.8, 36], [4.2, 36], [4.6, 51], [-4, 51]], DEEP, 2.2) + hat(-1, 40, 3, 6, 2.4)
    + shp([[-6, -9], [9, -9.6], [10, 6.4], [-5.6, 7]], SLATE, 2.4) + shp([[9, -8.6], [14.4, -9.4], [15, 6], [9.8, 6.4]], '#8E9AA4', 2.2)
    + `<path d="M-6 -8C-12 -8 -18 -4 -21 2C-18 -1 -13 -2 -8 -1Z" fill="${SLATE}" transform="translate(1 1)"/>` + inkP('M-6 -8.4C-12.6 -8 -18.4 -4 -21.4 2.4C-18 -1.2 -13 -2.4 -6 -1.6', 2.2) + inkP('M-15 -3.6C-17 -2.4 -18.6 -.6 -19.6 1', 1.2, .6)
    + lobe(ring(1, -5.6, 5, 1.6, 6, .1)) + inkP('M11.4 -7L12 4.6', 1, .5),
  // a laser cutter: a body with cooling fins and a status lamp, a lens ring at the nozzle, a cable out of the back, the beam with its hot tip
  laser: () => `<path d="M-15 2C-22 4 -24 12 -18 15C-14 17 -12 13 -16 11" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`
    + shp([[-15, -8], [8, -9], [9, 6], [-14, 7]], SKY, 2.2) + lobe(ring(-6, -5.6, 8, 1.4, 6, .1), .5)
    + [-10, -7, -4].map(x => inkP(`M${x} -8.4L${x + .4} 6.4`, 1.2, .6)).join('') + dot(4, -4, 2, GOLD) + inkP(over(ring(4, -4, 2, 2, 6, .05)), 1.2)
    + shp([[-11, 6.6], [-4, 6.4], [-6, 16], [-12, 16]], SLATE, 2) + hat(-10, 9, 2, 5, 2.4)
    + shp([[9, -5], [14, -4], [14, 4], [9, 5]], '#8E9AA4', 2) + shp([[14, -2.6], [18, -1.6], [18, 1.6], [14, 2.6]], GOLD, 1.8)
    + `<path d="M18.6 0L30 0" stroke="${DEEP}" stroke-width="3.4" stroke-linecap="round"/><path d="M18.6 0L29 0" stroke="${GOLD}" stroke-width="1.4" stroke-linecap="round"/>`
    + inkP('M31.6 -3.4l1.6 -2.2M32.4 0l2.8 0M31.6 3.4l1.6 2.2', 1.4).replace(INK, DEEP),
  // the bomb: an iron ball with a lighter lobe and a soft shade, a riveted brass neck, a braided fuse and its spark
  bomb: () => { const body = ring(0, 0, 13, 12.4, 9, .03); return `<path d="${closed(off(body, 1.4, 1.2))}" fill="#2E3033"/><path d="${closed(ring(4, 5, 8, 6, 7, .1))}" fill="#141413" opacity=".35"/>${lobe(ring(-4.4, -4.6, 4.2, 3, 7, .05), .4)}${lobe(ring(-7, -1, 1.2, 1.2, 5, .1), .5)}${inkP(over(body), 2.6)}`
    + shp([[-4, -12.6], [4, -12.6], [4.4, -18.4], [-4.4, -18.4]], GOLD, 2) + dot(-2.2, -15.4, .7, INK) + dot(2.2, -15.4, .7, INK)
    + inkP('M0 -18.4c.4-4.2 2.8-7.4 6.8-8.6 2.6-.8 4.8.2 6.2 2', 2.4, 1, ' class="fuse" pathLength="1"') + inkP('M1.6 -21l1.4 .6M3.6 -24l1.2 1M6.6 -26l.6 1.4', 1, .5)
    + `<g class="spark">${inkP('M13 -24.6l2.6-3.2M14.6 -22l4-.6M12.4 -27.6l.2-3.6M10.6 -26.4l-2-2', 1.8).replace(INK, DEEP)}${dot(13, -24.6, 2.4, GOLD)}${dot(17.4, -28.6, .8, GOLD)}${dot(9.4, -29.6, .7, GOLD)}</g>`; },
  // a railgun: twin rails over a body, gold coils, a capacitor bank under it, a grip and trigger, arcs between the rails at the muzzle
  railgun: () => shp([[-24, -5], [-8, -6], [-7, 5], [-23, 6]], SKY, 2.2) + lobe(ring(-17, -2.4, 4.4, 1, 6, .1), .5)
    + shp([[-30, -2], [-24, -3], [-23, 6], [-29, 8]], KRAFT, 2) + hat(-27, 0, 2, 5, 1.8)
    + shp([[-19, 5], [-13, 5], [-15, 15], [-21, 15]], KRAFT, 2) + inkP('M-13 7C-9 8 -9 12 -12 13', 1.4)
    + `<path d="${closed(ring(-15, 14.6, 4.2, 2.2, 7, .05))}" fill="#8E9AA4"/>` + inkP(over(ring(-15, 14.6, 4.2, 2.2, 7, .05)), 1.4)
    + shp([[-8, -8], [26, -8.4], [26.2, -4.6], [-8, -4.2]], SLATE, 2) + shp([[-8, 4.2], [26, 3.8], [26.2, 7.6], [-8, 8]], SLATE, 2)
    + inkP('M-6 0H24', 1, .35) + [0, 8, 16].map(x => `<path d="${closed(ring(x, 0, 2.6, 10, 7, .03))}" fill="${GOLD}"/>` + inkP(over(ring(x, 0, 2.6, 10, 7, .03)), 1.6) + inkP(`M${x - .6} -7l1.2 1.2M${x - .6} -3l1.2 1.2`, .8, .6)).join('')
    + inkP('M28 -3.6l2 1.8-2 1.8 2 1.8', 1.4).replace(INK, GOLD) + `<path d="${closed(ring(29, 0, 1.4, 1.4, 5, .1))}" fill="${GOLD}"/>`,
  // a black hole: the far side of its disk bent up over the top, the hole with its thin photon ring, the near side crossing in front
  blackhole: () => `<path d="M-15 -1C-15 -14 15 -14 15 -1" fill="none" stroke="${GOLD}" stroke-width="4.4" stroke-linecap="round"/><path d="M-12 -2C-12 -11 12 -11 12 -2" fill="none" stroke="${CLAY}" stroke-width="1.6" stroke-linecap="round"/>`
    + `<path d="${closed(ring(0, 0, 9, 9, 10, .02))}" fill="${VOID}"/><path d="${over(ring(0, 0, 10.4, 10.4, 10, .02))}" fill="none" stroke="${GOLD}" stroke-width="1.2"/>${inkP(over(ring(0, 0, 9, 9, 10, .02)), 2)}`
    + `<path d="M-21 2C-10 7.6 10 7.6 21 2C10 4 -10 4 -21 2Z" fill="${GOLD}"/><path d="M-21 2C-10 7.6 10 7.6 21 2" fill="none" stroke="${CLAY}" stroke-width="2" stroke-linecap="round"/>${inkP('M-22 1.4C-10 8.6 10 8.6 22 1.4', 1.4, .8)}${inkP('M-6 4.6l3 .2M4 4.8l3-.2', 1, .5)}`,
  // the dimensional foil: a thin card hovering over its shadow, a sheen across it, a corner just lifting; ticks show it has no depth
  foil: () => `<path d="${closed(ring(1, 14, 10, 2.4, 7, .05))}" fill="${INK}" opacity=".15"/>` + shp([[-10, -8], [10, -10], [11, 8], [-9, 9.4]], '#E9EEF2', 2)
    + `<path d="M-7 -7L1 -8.2L-7 2Z" fill="${PAPER}" opacity=".7"/><path d="M3 -8.6L6 -9L-6 7.6L-8 7.8Z" fill="${PAPER}" opacity=".45"/>` + inkP('M-6 6.6L8 6L8.6 -6', 1, .35)
    + `<path d="M8 6.4L11 8L9 9.2Z" fill="${SKY}"/>` + inkP('M-14 -1h-3M15 -1h3M0 -13v-3', 1.2, .5),
  // a painter's brush over a palette with three dabs of colour
  painter: () =>
    shp([[-13, 2], [-2, -6], [11, -2], [9, 9], [-6, 12]], '#E9DCC0', 2, true) +
      dot(-6, 3, 2.6, CLAY) +
      dot(0, -1.6, 2.4, GOLD) +
      dot(5, 4, 2.4, '#5F82BD') +
      dot(-1, 7, 2.2, '#7D8B5F') +
      dot(-8, 8.6, 1.6, PAPER)
    + `<g transform="rotate(-38)">${shp([[-1.6, -18], [1.6, -18], [2, -4], [-2, -4]], KRAFT, 1.8)}${shp([[-2.4, -4], [2.4, -4], [2.4, 1], [-2.4, 1]], '#8E9AA4', 1.6)}<path d="M-2.6 1C-3 6 -1 9 0 11C1 9 3 6 2.6 1Z" fill="${DEEP}"/>${inkP('M-2.6 1C-3 6 -1 9 0 11C1 9 3 6 2.6 1', 1.6)}</g>`,
  // a flower in a clay pot: soil, two leaves with veins, petals round a centre
  garden: () =>
    shp([[-8, 6], [8, 6], [6, 17], [-6, 17]], CLAY, 2) + shp([[-9.4, 4], [9.4, 4], [9.4, 7.4], [-9.4, 7.4]], DEEP, 1.8) + `<path d="${closed(ring(0, 4.6, 7.6, 1.6, 6, .1))}" fill="#5B4636"/>` + hat(4, 9, 2, 5, 2.2)
    + `<path d="M0 4C-1 -2 1 -7 0 -11" fill="none" stroke="${SAGE2}" stroke-width="2.2" stroke-linecap="round"/>`
    + `<path d="M0 -1C-4 -1 -9 -4 -9 -7C-5 -8 -2 -5 0 -2Z" fill="#B7C0A0"/>${inkP('M0 -1C-4 -1 -9.4 -4 -9.4 -7.4C-5 -8.4 -1.6 -5 0 -2', 1.6)}${inkP('M-1.4 -2.4L-7 -6', .9, .6)}`
    + `<path d="M0 1C3 0 8 -2 8.6 -5C5 -6 2 -3 .4 0Z" fill="#B7C0A0"/>${inkP('M0 1C3 0 8.6 -2 8.6 -5.4C5 -6.2 2 -3.4 .4 0', 1.6)}`
    + [0, 1, 2, 3, 4].map(k => {
      const a = k / 5 * 6.28 - 1.57;
      return `<path d="${closed(ring(Math.cos(a) * 4.6, -12 + Math.sin(a) * 4.6, 3.4, 2.6, 6, .08))}" fill="${GOLD}"/>`;
    }).join('') + inkP(over(ring(0, -12, 7.6, 7.4, 8, .1)), 1.2, .5) + dot(0, -12, 2.4, DEEP),
  // two balloons with highlights, strings tied together in a bow
  balloon: () => `<path d="M-4 3C-3 8 -1 10 0 14M5 2C4 8 1 10 0 14" fill="none" stroke="${INK}" stroke-width="1.2"/>`
    + shp(ring(6, -6, 7.4, 8.6, 8, .03), SKY, 2, true) + lobe(ring(3.4, -9.6, 1.8, 2.8, 6, .1), .55) + inkP('M5 2.6L7 2.6L6 4.2Z', 1.2)
    + shp(ring(-4.6, -8, 8.2, 9.6, 8, .03), CLAY, 2.2, true) + lobe(ring(-8, -12, 2.2, 3.4, 6, .1), .5) + inkP('M-5.6 1.6L-3.4 1.6L-4.6 3.4Z', 1.2)
    + `<path d="M0 14C-4 12 -6 15 -3 16C-1 16.6 0 15 0 14C0 15 1 16.6 3 16C6 15 4 12 0 14Z" fill="${DEEP}"/>${inkP('M0 14C-4 12 -6.2 15.2 -3 16.2M0 14C4 12 6.2 15.2 3 16.2', 1.2)}`,
  // gravity: Newton's apple, falling, with its leaf and a few drawn motion lines, the ground below
  gravity: () => inkP('M-4 -16v6M0 -18v5M4 -16v6', 1.2, .45) + shp(ring(0, 0, 9.6, 8.6, 9, .03), DEEP, 2.2, true) + lobe(ring(-3.6, -3, 2.4, 3.4, 6, .1), .45)
    + inkP('M0 -7C0 -9 1 -11 2.4 -12', 1.8) + `<path d="M2.4 -11C5 -14 9 -13 9 -11C7 -9 4 -9 2.4 -11Z" fill="#7D8B5F"/>` + inkP('M2.4 -11C5 -14.2 9.2 -13 9.2 -11C7 -8.8 4 -8.8 2.4 -11', 1.4)
    + `<path d="${closed(ring(1, 15, 9, 1.8, 6, .1))}" fill="${INK}" opacity=".15"/>` + inkP('M-14 16.4C-6 15.6 6 16 14 16.6', 1.8, .7),
  // portals: two rings seen in perspective, the way in (lilac) and the way out (sage); a letter going in, the same letter coming out
  portal: () => shp(ring(-8, 2, 6.6, 11, 9, .03), '#C9B6CC', 2, true) + `<path d="${closed(ring(-7.6, 2, 3.6, 7.6, 8, .04))}" fill="${VOID}"/>` + inkP(over(ring(-7.6, 2, 3.6, 7.6, 8, .04)), 1)
    + shp(ring(10, 2, 6.6, 11, 9, .03), '#B7C0A0', 2, true) + `<path d="${closed(ring(10.4, 2, 3.6, 7.6, 8, .04))}" fill="${VOID}"/>` + inkP(over(ring(10.4, 2, 3.6, 7.6, 8, .04)), 1)
    + `<text x="-17" y="-6" font-size="7" font-family="Georgia" font-weight="700" fill="${INK}" transform="rotate(20 -17 -6)">a</text><text x="13" y="-3" font-size="7" font-family="Georgia" font-weight="700" fill="${INK}" transform="rotate(-24 13 -3)">a</text>`,
  // an eraser with a worn corner and a printed sleeve (0 and 1 on it), crumbs beside it
  eraser: () => shp([[-13, -6], [10, -9], [13, 4], [-9, 8], [-13, 3]], '#F0B9B0', 2.2) + lobe(ring(-6, -3.6, 4, 1, 6, .1), .45)
    + shp([[0, -7.6], [7, -8.6], [9.6, 5.6], [2.6, 6.6]], '#9DB4C8', 1.6) + `<text x="2.6" y="2" font-size="4" ${MONO} fill="${INK}" transform="rotate(-8 2.6 2)">01</text>`
    + dot(-15, 11, 1.4, '#E8A79C') + dot(-11, 13, 1.1, '#E8A79C') + dot(-17.4, 7.6, .9, '#E8A79C'),
  // a horseshoe magnet with steel tips, field lines, and a letter on its way to it
  magnet: () => `<path d="M-16 -12C-22 -2 -14 10 0 10M16 -12C22 -2 14 10 0 10" fill="none" stroke="${SLATE}" stroke-width="1" stroke-dasharray="2 2" opacity=".7"/>`
    + `<path d="M-12 -10C-12 6 12 6 12 -10L5 -10C5 -2 -5 -2 -5 -10Z" fill="${DEEP}" transform="translate(1.2 1)"/>` + lobe(ring(-9, -2, 1.4, 3.4, 6, .1), .45)
    + shp([[-12, -15], [-5, -15], [-5, -9.4], [-12, -9.4]], '#D8E1E7', 1.8) + shp([[5, -15], [12, -15], [12, -9.4], [5, -9.4]], '#D8E1E7', 1.8)
    + inkP('M-12 -14C-12 7 12 7 12 -14L5 -14C5 -1 -5 -1 -5 -14Z', 2.4) + hat(6, 0, 2, 4, 2, .9)
    + `<text x="-2.6" y="-15" font-size="7" font-family="Georgia" font-weight="700" fill="${INK}" transform="rotate(-18 -2.6 -15)">a</text>` + inkP('M2 -20l2 1.4M3.6 -22.4l2.4.4', 1, .5),
  // an ink bottle: a cork, a paper label, a drip down its side, a shine
  ink: () => shp(ring(0, 3, 10, 8.4, 9, .04), '#3B3D42', 2.2, true) + lobe(ring(-4, 0, 2.4, 3.6, 6, .1), .4)
    + shp([[-4.4, -10.6], [4.4, -10.6], [4.4, -4], [-4.4, -4]], '#8E9AA4', 1.8) + shp([[-3.6, -15.4], [3.6, -15.4], [3, -10.4], [-3, -10.4]], KRAFT, 1.8) + hat(1, -14.6, 2, 3, 1.6, .8)
    + shp([[-6, 1], [6, .6], [6.2, 7], [-5.8, 7.4]], '#E9DCC0', 1.4) + inkP('M-4 3.6h7M-4 5.4h5', .8, .6)
    + `<path d="M7 -2C8.4 2 8 6 8.6 9" fill="none" stroke="#141413" stroke-width="2.2" stroke-linecap="round"/>` + dot(8.8, 10.6, 1.6, '#141413'),
};

// [key, name, icon box, click|drag, group, power, reach, shake (0-5), how it works]
const TOOLS = [
  ['hammer', 'Hammer', '-24 -14 42 68', 'click', 'weapon'],
  ['laser', 'Laser', '-25 -12 62 30', 'drag', 'weapon'],
  ['bomb', 'Bomb', '-16 -32 36 48', 'click', 'weapon'],
  ['railgun', 'Railgun', '-32 -12 64 30', 'click', 'weapon'],
  ['blackhole', 'Black hole', '-23 -15 46 26', 'click', 'weapon'],
  ['foil', 'Foil', '-19 -17 38 34', 'click', 'weapon'],
  ['painter', 'Painter', '-15 -16 30 30', 'drag', 'play'],
  ['garden', 'Garden', '-11 -18 22 36', 'click', 'play'],
  ['balloon', 'Balloons', '-14 -19 28 37', 'click', 'play'],
  ['gravity', 'Gravity', '-15 -19 30 38', 'click', 'play'],
  ['portal', 'Portals', '-18 -11 36 26', 'click', 'play'],
  ['eraser', 'Eraser', '-19 -11 34 26', 'drag', 'play'],
  ['magnet', 'Magnet', '-18 -24 36 32', 'drag', 'play'],
  ['ink', 'Ink', '-12 -17 24 30', 'click', 'play']];
const burstSVG = r => {
  const n = 11, pts = [];
  for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * 6.2832 + J(.08), rr = (i % 2 ? r * .52 : r) * (1 + J(.12)); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  const inner = pts.map(([x, y]) => [x * .55, y * .55]);
  return `<path d="${lin(pts.map(([x, y]) => [x + 2, y + 1.6]))}" fill="${GOLD}"/><path d="${lin(inner.map(([x, y]) => [x + 1.4, y + 1.2]))}" fill="${CLAY}"/>${inkP(lin(pts) + `L${R(pts[0][0] + 2)} ${R(pts[0][1] + 3)}`, 2.6)}${inkP(lin(inner), 1.8, .8)}`;
};
const puffSVG = r => `<path d="${closed(ring(1.4, 1.2, r, r * .82, 8, .08))}" fill="${OAT}"/>${inkP(over(ring(0, 0, r, r * .82, 8, .08)), 2, .7)}`;
// the scar: a torn hole showing the back end (binary), cracks out from it written in 0 and 1
let uid = 0;
const scarSVG = r => {
  const id = 'chbS' + (++uid), hole = [];
  for (let i = 0; i < 15; i++) { const a = i / 15 * 6.2832 + J(.12), k = (i % 2 ? .78 : 1) * (1 + J(.16)); hole.push([Math.cos(a) * r * .5 * k, Math.sin(a) * r * .31 * k]); }
  const lip = hole.map(([x, y]) => [x * 1.14 + J(1), y * 1.18 + J(.8)]);
  let rows = ''; for (let row = -7; row <= 7; row++) rows += `<text x="${R(-r * .62 + J(2))}" y="${R(row * 6.4)}" fill="${rnd() < .25 ? DATA2 : DATA}" opacity="${R(.55 + rnd() * .45)}">${bits(30)}</text>`;
  let cracks = '', defs = '';
  for (let c = 0; c < 7; c++) { const a = c / 7 * 6.2832 + J(.35); let pt = [Math.cos(a) * r * .5, Math.sin(a) * r * .31], d = `M${R(pt[0])} ${R(pt[1])}`; const len = r * (.55 + rnd() * .5);
    for (let k = 1; k <= 4; k++) { const aa = a + J(.45); pt = [pt[0] + Math.cos(aa) * len / 4, pt[1] + Math.sin(aa) * len / 4 * .7]; d += `L${R(pt[0])} ${R(pt[1])}`; }
    defs += `<path id="${id}c${c}" d="${d}"/>`; cracks += `<g class="chb-crack"><path d="${d}" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".25" stroke-linecap="round"/><text class="chb-flicker" style="animation-delay:${R(rnd() * 3)}s" font-size="6.4" fill="${INK}" opacity=".62" dy="-1.2"><textPath href="#${id}c${c}">${bits(Math.round(len / 3.6))}</textPath></text></g>`; }
  const embers = [0, 1, 2, 3, 4].map(i => {
    const q = lip[Math.floor(rnd() * lip.length)];
    return `<path class="chb-ember" style="animation-delay:${R(rnd() * 2)}s" d="${closed(ring(q[0] + J(2), q[1] + J(1.5), 1.6 + rnd(), 1.4, 5, .2))}" fill="${GOLD}"/>`;
  }).join('');
  return `<defs><clipPath id="${id}h"><path d="${lin(hole)}"/></clipPath>${defs}</defs><path d="${closed(ring(0, 0, r * .95, r * .58, 11, .14))}" fill="#3B3D42" opacity=".14"/>${cracks}<path d="${lin(lip.map(([x, y]) => [x + 1.6, y + 1.4]))}" fill="${OAT}"/><path d="${lin(hole)}" fill="${VOID}"/><g clip-path="url(#${id}h)" ${MONO} font-size="6.2"><g class="chb-run"><g class="chb-stream">${rows}</g></g></g>${inkP(lin(lip) + `L${R(lip[1][0])} ${R(lip[1][1])}`, 1.6, .7)}${inkP(lin(hole), 2.2)}${embers}`;
};

// ---------------------------------------------------------------- the generated drawings (play-art.js, the art skill's hand), placed with fresh ids
const PA = globalThis.ReservePlayArt || null, pickOf = a => a[Math.floor(rnd() * a.length)], fresh = svg => svg.replaceAll('§', 'chbA' + (++uid) + '_');
// ---------------------------------------------------------------- the page, and everything we change on it
const box = opts.box || document.body, layer = document.getElementById('chb-layer') || Object.assign(document.createElement('div'), { id: 'chb-layer' });
layer.setAttribute('aria-hidden', 'true'); if (!layer.isConnected) document.documentElement.append(layer);
box.insertAdjacentHTML('beforeend', `<div class="chb-box"><div class="chb-lbl">Play with this page</div><div id="chb-tray" role="toolbar" aria-label="Tools to play with this page"></div><button id="chb-undo" type="button">Put it back</button></div>`);
const tray = box.querySelector('#chb-tray'), undo = box.querySelector('#chb-undo');
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduce = reducedQuery.matches || ['still', 'off'].includes(opts.motion);
const D = ms => reduce ? 1 : ms;
document.documentElement.classList.toggle('chb-reduced', reduce);
// every delayed effect goes through later(): "Put it back" cancels whatever is still pending (a ticking bomb, a hammer in mid-swing)
const timers = new Set(), later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
const PAGE = () => (typeof opts.root === 'function' ? opts.root() : opts.root) || document.body, OURS = '#chb-tray,#chb-undo,.chb-box,script,style,#chb-layer' + (opts.ours ? ',' + opts.ours : '');
const splits = [], moved = new Set(), marks = [], lines = new Map(), folds = [], holes = [], returning = new Set();
const shown = () => { undo.style.display = 'inline'; stir(); };
let stirred = 0, resting = false, restTimer = 0; const REST = 120000, htmlEl = document.documentElement;
function stir() {
  stirred = performance.now();
  if (resting) { resting = false; htmlEl.classList.remove('chb-rest'); physicsView.hold(false); pourWake(); }
  if (!restTimer) restTimer = setTimeout(rest, REST);
}
function rest() {
  restTimer = 0;
  const left = REST - (performance.now() - stirred);
  if (left > 0) restTimer = setTimeout(rest, left); else { resting = true; htmlEl.classList.add('chb-rest'); physicsView.hold(true); }
}
const unrest = () => { clearTimeout(restTimer); restTimer = 0; resting = false; htmlEl.classList.remove('chb-rest'); physicsView.hold(false); };
function place(inner, x, y, box) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', box.join(' '));
  Object.assign(s.style, { left: x + 'px', top: y + 'px', width: box[2] + 'px', height: box[3] + 'px', marginLeft: box[0] + 'px', marginTop: box[1] + 'px' });
  s.innerHTML = inner;
  layer.append(s);
  return s;
}
const sheet = () => { const s = place('', 0, 0, [0, 0, innerWidth, innerHeight]); s.style.left = s.style.top = '0'; return s; };
// (words inside a button go with the button, and text kept for screen readers is not on the page)
const BADGE = '.badge,.nav-badge,.unread-count,[class$=__badge],[class$=-badge]:not([class*=has-])';
const SKIP = OURS + ',.chb-ch,.screenreader-only,[class*=screenReaderContent],.ui-helper-hidden-accessible' + (opts.things === false ? '' : ',button,select,textarea,[role=button],.btn,.Button,' + BADGE);
const textWalker = () =>
  document.createTreeWalker(PAGE(), NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.nodeValue.trim() && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
// The text nodes and where they lie are read once per gesture (a walk of the page per pointer move is what made the small
// tools stutter); only the words a tool reaches become letters, the rest of their node stays plain text.
let textIndex = null, textIndexAt = -1e9;
function textBoxes() {
  const now = performance.now(); if (textIndex && now - textIndexAt < 300) { textIndexAt = now; return textIndex; } textIndex = []; textIndexAt = now;
  const walk = textWalker(); for (let n; (n = walk.nextNode());) textIndex.push({ n, boxes: null });
  return textIndex;
}
// what the page keeps at nothing is not on screen, though it has a box: a dock's hover card lies under every tile at no opacity, and a copy of it fades up as an empty frame
// (an element laid out as display: contents has no box of its own, so the check says no for it: its parent answers instead)
const showing = el => {
  for (let e = el; e; e = e.parentElement) {
    if (e.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) !== false) return true;
    if (getComputedStyle(e).display !== 'contents') return false;
  }
  return true;
};
const touches = (b, x, y, rad) => b.right > x - rad && b.left < x + rad && b.bottom > y - rad && b.top < y + rad;
function textNodesNear(x, y, rad) {
  const out = [], range = document.createRange();
  for (const t of textBoxes()) {
    if (!t.n.isConnected) continue;
    if (!t.boxes) { range.selectNodeContents(t.n); t.boxes = showing(t.n.parentElement) ? [...range.getClientRects()] : []; }
    for (const b of t.boxes) if (touches(b, x, y, rad) && inView(b)) { out.push(t.n); break; }
  }
  return out;
}
function wordsNear(x, y, rad) {
  const out = [], range = document.createRange();
  for (const n of textNodesNear(x, y, rad))
    for (const m of n.nodeValue.matchAll(/\S+/g)) {
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      const r = range.getClientRects()[0];
      if (r && touches(r, x, y, rad) && inView(r)) out.push({ node: n, start: m.index, end: m.index + m[0].length, r });
    }
  return out;
}
// one pass, no reads. (flat: letters that only leave as copies need no word round them, and in the flow they cannot move a line)
function splitWords(words, flat = false) {
  for (let i = 0; i < words.length;) { const node = words[i].node, text = node.nodeValue, frag = document.createDocumentFragment(), holder = document.createElement('span'); let at = 0;
    for (; i < words.length && words[i].node === node; i++) {
      const { start, end, whole, ghost } = words[i], word = text.slice(start, end);
      if (start > at) frag.append(text.slice(at, start));
      at = end;
      if (whole || flat) {
        for (const piece of whole ? [word] : word) { const s = document.createElement('span'); s.className = 'chb-ch chb-run'; s.textContent = piece; s._ghost = ghost; frag.append(s); }
        continue;
      }
      const w = document.createElement('span');
      w.className = 'chb-word';
      for (const ch of word) { const s = document.createElement('span'); s.className = 'chb-ch'; s.textContent = ch; w.append(s); }
      frag.append(w);
    }
    if (at < text.length) frag.append(text.slice(at)); holder.className = 'chb-split'; holder.append(frag); node.replaceWith(holder); keepSplit(holder, node);
    for (const n of holder.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) textIndex?.push({ n, boxes: null }); }
}
// A host page can redraw text we split (Canvas's breadcrumb does, right after a bomb): its fresh text shows while copies of the same words
// are in the air, and every word reads twice. While anything is split a watcher notices a holder taken off the page by someone else, and
// puts it back in place of the host's fresh text, so what has gone stays gone and the rest still reads. Only elements leaving count, so our
// own writes (a text node swapped for a holder, copies in the layer) cost a glance at the record. A framework can fight back: after three
// returns the nearest small part of the page is hidden until Put it back. A holder with nothing out is forgotten: the host's text is right.
let watcher = null, mendAt = 0; const hushed = new Map();
function keepSplit(holder, node) {
  const chain = [];
  for (let p = holder.parentNode, i = 0; p && i < 8; p = p.parentNode, i++) chain.push(p);
  splits.push({ holder, node, chain, back: 0, wait: 0 });
  if (!watcher && !restoring) watchSplits();
}
function watchSplits() {
  const MO = globalThis.MutationObserver, root = PAGE();
  if (!MO || !root) return;
  watcher = new MO(list => { for (const r of list) { if (r.target === layer) continue; for (const n of r.removedNodes) if (n.nodeType !== 3) { mend(); return; } } });
  watcher.observe(root, { childList: true, subtree: true });
}
const unwatch = () => { watcher?.disconnect(); watcher = null; };
function freshText(sp) {
  const want = (sp.node.nodeValue || '').trim(), el = sp.chain.find(e => e.isConnected);
  if (!want || !el) return null;
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement?.closest('.chb-split,.chb-ch') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n, i = 0; (n = walk.nextNode()) && i < 600; i++) if (n.nodeValue.trim() === want) return n;
  return null;
}
function hush(sp) {
  for (const el of sp.chain) {
    if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height <= innerWidth * innerHeight * .15 && !hushed.has(el)) { hushed.set(el, el.style.visibility); el.style.visibility = 'hidden'; }
    return;
  }
}
function mend() { mendAt = 0; let waiting = false;
  for (let i = splits.length - 1; i >= 0; i--) {
    const sp = splits[i], { holder } = sp;
    if (holder.isConnected) continue;
    let out = false;
    for (const s of holder.classList.contains('chb-run') ? [holder] : holder.querySelectorAll('.chb-ch')) if (moved.has(s) || s._ghost) { out = true; break; }
    if (!out) { splits.splice(i, 1); continue; } const fresh = sp.back < 3 ? freshText(sp) : null;
    if (fresh) { fresh.replaceWith(holder); sp.node = fresh; sp.back++; sp.wait = 0; continue; }
    if (++sp.wait < 3 && sp.back < 3) { waiting = true; continue; } splits.splice(i, 1); hush(sp); }
  if (!splits.length) unwatch(); else if (waiting && !restoring) mendAt = later(mend, 140); }
// what the tools have already split, looked up only in the text nodes near the point
function splitNear(x, y, rad, selector) {
  const out = new Set();
  for (const { holder } of splits) if (holder.isConnected && touches(holder.getBoundingClientRect(), x, y, rad)) for (const el of holder.querySelectorAll(selector)) out.add(el);
  return out;
}
// ---------------------------------------------------------------- what is on screen, read without touching the page
// Budget the pieces, not the text: everything on screen falls, in as many pieces as a smooth frame can carry. Letters on a
// short page, whole words next, runs of words along their line on a text-heavy one; past that, neighbours share a body.
// Ranges read the words where they are, so nothing is split or laid out until the pieces are known.
// Blasts stay in letters on a normal machine. Under the shared budget their outer part goes as whole words, which shows on the floor and in the
// ring round the hit, and saves about a third of the bomb's main-thread work: this is the one switch.
// A Chromebook or a small laptop (4 GB or less, or two cores) gets the same effects at a price it can pay: about half the pieces, whole words in the
// blasts, fewer sparks and smaller canvases. Nothing to turn on; opts.low overrides it for tests.
const chosenLow = (() => { try { return globalThis.localStorage?.getItem('reserve:graphics') === 'low'; } catch { return false; } })();
const LOW = opts.low ?? (chosenLow || (globalThis.navigator?.deviceMemory || 8) <= 4 || (globalThis.navigator?.hardwareConcurrency || 8) <= 2), FX = LOW ? .45 : 1;
globalThis.ReservePlayLow = LOW;
const WORDS_IN_BLASTS = LOW,
  blast = (cover, cap = 300) => WORDS_IN_BLASTS ? { cap: Math.round(cap * .6), cover: Math.round(cover * .7), letters: 0, flat: true } : { cap: cover, letters: cover, flat: true };
const PIECES = LOW ? 170 : 300, CEILING = LOW ? 320 : 600, inView = r => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
function wordsInView() {
  const out = [], range = document.createRange(), walk = textWalker();
  for (let n; (n = walk.nextNode());) {
    range.selectNodeContents(n);
    let on = false;
    for (const b of range.getClientRects()) if (inView(b)) { on = true; break; }
    if (!on || !showing(n.parentElement)) continue;
    const found = [...n.nodeValue.matchAll(/\S+/g)], box = m => {
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      return range.getClientRects()[0];
    }, first = past => { let lo = 0, hi = found.length; while (lo < hi) { const mid = (lo + hi) >> 1, r = box(found[mid]); if (r && past(r)) hi = mid; else lo = mid + 1; } return lo; };
    // (a node of thousands of words is searched for the part on screen rather than read word by word)
    const from = found.length > 2000 ? first(r => r.bottom > 0) : 0, to = found.length > 2000 ? first(r => r.top >= innerHeight) : found.length;
    for (let i = from; i < to; i++) { const m = found[i], r = box(m); if (r && inView(r)) out.push({ node: n, start: m.index, end: m.index + m[0].length, r }); } }
  return out;
}
const lettersOf = words => {
  const out = [], range = document.createRange();
  for (const { node, start, end } of words)
    for (let at = start; at < end;) {
      const next = at + (node.nodeValue.codePointAt(at) > 65535 ? 2 : 1);
      range.setStart(node, at);
      range.setEnd(node, next);
      const r = range.getClientRects()[0];
      if (r) out.push({ node, start: at, end: next, r });
      at = next;
    }
  return out;
};
function piecesOf(words, budget) {
  if (words.reduce((n, w) => n + w.end - w.start, 0) <= budget) return lettersOf(words);
  if (words.length <= budget) return words;
  for (let run = Math.max(2, Math.ceil(words.length / budget)); ; run = Math.ceil(run * 1.5)) { const out = []; let at = null, n = 0;
    for (const w of words) {
      if (at && at.node === w.node && n < run && Math.abs(w.r.top - at.r.top) < at.r.height / 2 && w.r.left >= at.r.right - 1) {
        at.end = w.end;
        at.r = { left: at.r.left, top: at.r.top, right: w.r.right, bottom: at.r.bottom, width: w.r.right - at.r.left, height: at.r.height };
        n++;
      }
      else { at = { ...w }; out.push(at); n = 1; }
    }
    if (out.length <= budget || run >= words.length) return out; }
}
// a page of thousands of tiny labels (a gradebook) has more nodes than runs can join: the copies stop at the ceiling, the largest
// pieces fall and the smallest labels stay where they are
const atCeiling = pieces => {
  if (pieces.length <= CEILING) return pieces;
  const keep = new Set([...pieces].sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height).slice(0, CEILING));
  return pieces.filter(p => keep.has(p));
};
// (Home's render reuses elements by position and tag, so a span of ours can become one of its own while pieces are out: it takes
// the new class, and Put it back then leaves it alone, see below)
// one pass, no reads: each piece becomes a span in the flow (the line stays exactly as it was), the rest of its node stays plain text
function wrapPieces(pieces) {
  for (let i = 0; i < pieces.length;) { const node = pieces[i].node, text = node.nodeValue, one = pieces[i];
    // (a node that falls whole is its own span: no holder round it)
    if (pieces[i + 1]?.node !== node && !text.slice(0, one.start).trim() && !text.slice(one.end).trim()) {
      const s = one.s = document.createElement('span');
      s.className = 'chb-ch chb-run';
      s.textContent = text;
      s._type = one.type;
      s._ghost = one.ghost;
      node.replaceWith(s);
      keepSplit(s, node);
      i++;
      continue;
    }
    const frag = document.createDocumentFragment(), holder = document.createElement('span'); let at = 0;
    for (; i < pieces.length && pieces[i].node === node; i++) {
      const p = pieces[i], s = p.s = document.createElement('span');
      if (p.start > at) frag.append(text.slice(at, p.start));
      s.className = 'chb-ch chb-run';
      s.textContent = text.slice(p.start, p.end);
      s._type = p.type;
      s._ghost = p.ghost;
      frag.append(s);
      at = p.end;
    }
    if (at < text.length) frag.append(text.slice(at)); holder.className = 'chb-split'; holder.append(frag); node.replaceWith(holder); keepSplit(holder, node); }
  textIndex = null;
}
// past the budget one cell of the screen falls as one torn-off scrap, so the bodies never outnumber the budget
function clumps(items, budget) {
  if (items.length <= budget) return items.map(p => [p]);
  const side = Math.sqrt(innerWidth * innerHeight / budget) * 1.2, cells = new Map();
  for (const p of items) {
    const key = Math.floor((p.r.left + p.r.width / 2) / side) + Math.floor((p.r.top + p.r.height / 2) / side) * 4096, cell = cells.get(key);
    if (cell) cell.push(p); else cells.set(key, [p]);
  }
  return [...cells.values()];
}
// a wide area that only nudges what it reaches (the railgun's outer ring) does it in pieces, not letters
function piecesNear(x, y, rad, near, budget) {
  const pieces = piecesOf(wordsNear(x, y, rad).filter(w => near(w.r.left + w.r.width / 2, w.r.top + w.r.height / 2)), budget); types = new WeakMap();
  for (const p of pieces) p.type = typeIn(p.node.parentElement); wrapPieces(pieces);
  return pieces.map(p => ({ s: p.s, r: p.r, cx: p.r.left + p.r.width / 2, cy: p.r.top + p.r.height / 2 }));
}
// a copy keeps the page's type. It is read once per parent, before anything is written, so laying the copies down never forces a style recalculation
let types = new WeakMap(), copies = null;
const typeIn = el => {
  let t = types.get(el);
  if (!t) {
    const cs = getComputedStyle(el);
    t = { font: cs.font, color: cs.color, textTransform: cs.textTransform, letterSpacing: cs.letterSpacing, wordSpacing: cs.wordSpacing };
    types.set(el, t);
  }
  return t;
}, typeOf = s => typeIn(s.parentElement?.classList.contains('chb-painted') ? s : s.parentElement || s);
// (near: a test that also holds for a whole word; cap: the pieces this tool can use, nearest first by rank. Half of them at most
// are letters, the nearest; the words round those go whole. letters: a different share of letters. whole: which words may go whole.
// cover: how many letters' worth of text it reaches, so cutting it into fewer pieces does not make it reach further)
const allThings = (found, n, order = null) => {
  const solid = [], text = [];
  for (const p of found) (p.s._thing ? solid : text).push(p);
  if (order) text.sort(order);
  return [...text.slice(0, n), ...solid];
};
function lettersNear(x, y, rad, test, kept = false, { near, cap = 0, rank, letters: share = cap / 2, whole, cover = Infinity, flat = false, things = true, runs = 0, rest = false } = {}) {
  let words = wordsNear(x, y, rad); if (near) words = words.filter(w => near(w.r.left + w.r.width / 2, w.r.top + w.r.height / 2, w.r));
  if (cap) {
    const place = new Map(words.map((w, i) => [w, i])),
      score = rank || ((cx, cy) => Math.hypot(cx - x, cy - y)),
      ranked = words.map(w => [score(w.r.left + w.r.width / 2, w.r.top + w.r.height / 2), w]).sort((a, b) => a[0] - b[0]);
    let used = 0, spent = 0, covered = 0, at = 0;
    words = [];
    for (const [, w] of ranked) {
      if (spent >= cap || covered >= cover) break;
      at++;
      const n = w.end - w.start;
      covered += n;
      if (whole ? whole(w.r) : used + n > share) { w.whole = true; spent++; } else { used += n; spent += n; }
      words.push(w);
    }
    // (runs: what the budget did not reach still goes, neighbours on a line together as one long piece, so a sidebar far from the hit is not left out)
    if (runs) {
      let last = null, n = 0, added = 0, prev = -2;
      for (const [, w] of ranked.slice(at).sort((p, q) => place.get(p[1]) - place.get(q[1]))) {
        const next = place.get(w), joined = next === prev + 1;
        prev = next;
        if (last && joined && last.node === w.node && (last.ghost || (n < (rest ? 14 : 9) && Math.abs(w.r.top - last.r.top) < last.r.height / 2 && w.r.left >= last.r.right - 1))) {
          last.end = w.end;
          if (!last.ghost) last.r = { left: last.r.left, top: last.r.top, right: w.r.right, bottom: last.r.bottom, width: w.r.right - last.r.left, height: last.r.height };
          n++;
        }
        else { if (added >= runs) { if (!rest) break; last = w; last.whole = last.ghost = true; words.push(last); n = 1; continue; } last = w; last.whole = true; words.push(last); n = 1; added++; }
      }
    }
    words.sort((a, b) => (place.get(a) ?? 1e9) - (place.get(b) ?? 1e9)); }
  const out = [];
  if (LOW && flat) {
    types = new WeakMap();
    for (const w of words) w.type = typeIn(w.node.parentElement);
    wrapPieces(words);
    for (const { s, r } of words) { const cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = Math.hypot(cx - x, cy - y); if (test ? test(cx, cy, r) : d <= rad) out.push({ s, r, d, cx, cy }); }
  }
  else { splitWords(words, flat);
  for (const s of splitNear(x, y, rad, '.chb-ch')) {
    if (moved.has(s)) continue;
    const r = s.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = Math.hypot(cx - x, cy - y);
    if (test ? test(cx, cy, r) : d <= rad) out.push({ s, r, d, cx, cy });
  } }
  // letters already knocked about (resting copies in our layer: knocked askew, piled on the floor) can be hit again,
  // found where they lie now
  if (kept)
    for (const s of moved) {
      const c = s._c;
      if (!c?.isConnected || s._halves) continue;
      const tf = getComputedStyle(c).transform,
        m = new DOMMatrixReadOnly(tf === 'none' ? undefined : tf),
        w = c.offsetWidth,
        h = parseFloat(c.style.lineHeight) || c.offsetHeight,
        left = parseFloat(c.style.left) + m.e,
        top = parseFloat(c.style.top) + m.f;
    const r = { left, top, width: w, height: h, right: left + w, bottom: top + h }, cx = left + w / 2, cy = top + h / 2, d = Math.hypot(cx - x, cy - y);
    if (test ? test(cx, cy, r) : d <= rad) out.push({ s, r, d, cx, cy });
  }
  if (things)
    for (const { el, r } of thingBoxes()) {
      if (moved.has(el)) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, gap = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (test ? test(cx, cy, r) : gap <= rad) out.push({ s: el, r, d: Math.hypot(cx - x, cy - y), cx, cy });
    }
  types = new WeakMap(); for (const p of out) if (p.s._thing) lookReady(p.s); else if (!p.s._line && !p.s._dot && !p.s._type) p.s._type = typeOf(p.s);
  return out;
}
// ---------------------------------------------------------------- the rest of the page: pictures, icons, buttons and fields go with the text
// Each is found once per gesture and moves whole, as a copy in its own look; not a picture that fills the page, and the biggest first when there are too many.
// (a badge is a filled shape round its number, an icon is drawn by a font: neither has a word for the tools to take, so left out they stay behind as a dot or a tick)
const THINGS = 'img,svg,canvas,video,button,input:not([type=hidden]),select,textarea,[role=button],.btn,.Button,' + BADGE + ',i[class*=icon-]';
let thingIndex = null, thingsAt = -1e9, thingSpare = [], linesSpare = [];
// list bullets are not text: each is a dot of its own, and its list item loses the marker until Put it back
const dots = new Map();
function dotsInView(most = 40) {
  const out = []; if (opts.things === false) return out;
  for (const li of PAGE().querySelectorAll?.('li') || []) {
    if (dots.has(li) || li.closest(OURS)) continue;
    const cs = getComputedStyle(li);
    if (!/disc|circle|square/.test(cs.listStyleType || '')) continue;
    const r = li.getBoundingClientRect(), size = parseFloat(cs.fontSize) || 14;
    if (r.width < 6 || !inView(r)) continue;
    const side = Math.max(4, size * .36), left = r.left - size * .9, top = r.top + size * .45, s = document.createElement('span');
    s._dot = { li, color: cs.color, inline: li.style.listStyleType };
    out.push({ s, r: { left, top, width: side, height: side, right: left + side, bottom: top + side } });
    if (out.length >= most) break;
  }
  return out;
}
function thingBoxes() {
  const now = performance.now(); if (thingIndex && now - thingsAt < 300) return thingIndex; thingsAt = now; thingIndex = []; if (opts.things === false) return thingIndex;
  const most = innerWidth * innerHeight * .4, big = [];
  for (const el of PAGE().querySelectorAll?.(THINGS) || []) {
    if (moved.has(el) || el.closest(OURS) || el.parentElement?.closest(THINGS)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || !inView(r) || !showing(el)) continue;
    if (r.width * r.height > most) { big.push({ el, r }); continue; }
    el._thing = true;
    thingIndex.push({ el, r });
  }
  thingIndex.sort((p, q) => q.r.width * q.r.height - p.r.width * p.r.height);
  thingSpare = [...thingIndex.slice(LOW ? 50 : 110), ...big];
  thingIndex = thingIndex.slice(0, LOW ? 50 : 110);
  return thingIndex;
}
const LOOK = ['backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft', 'borderRadius', 'boxShadow', 'color', 'font', 'padding', 'textAlign', 'textDecoration', 'textTransform', 'letterSpacing', 'lineHeight', 'objectFit'];
const lookOf = el => { const cs = getComputedStyle(el), look = {}; for (const k of LOOK) look[k] = cs[k]; return look; };
// A copy leaves the page's style sheet behind: art that the page paints by selector (fill: none on a dock's frame) falls back to solid black in our
// layer, and what sits inside a button loses its look. So the paint of each node inside a thing is read once, walking the original, and laid on the
// copy, node for node. (#chb-layer svg is ours and would pull a nested drawing out of the flow, so a nested svg keeps its place and size too.)
const PAINT = ['fill', 'stroke', 'strokeWidth', 'strokeDasharray', 'opacity', 'fillOpacity', 'strokeOpacity', 'strokeLinecap', 'strokeLinejoin'], SVG_BOX = [...PAINT, 'position', 'display', 'width', 'height', 'verticalAlign', 'overflow'], INNER = [...LOOK, 'display', 'margin', 'verticalAlign', 'opacity', 'whiteSpace', 'position'];
function paintOf(el) { const kids = el.querySelectorAll?.('*'), isSvg = n => /svg$/.test(n.namespaceURI || ''), root = isSvg(el); if (!root && !kids?.length) return null; const out = []; let i = 0;
  for (const n of [el, ...(kids || [])]) {
    if (i++ > 120) break;
    if (n === el && !root) { out.push(null); continue; }
    const svg = isSvg(n), keys = !svg ? INNER : n.localName === 'svg' ? SVG_BOX : PAINT, cs = getComputedStyle(n), look = {};
    for (const k of keys) if (cs[k] != null) look[k] = cs[k];
    out.push(look);
  }
  return out;
}
const lookReady = el => { el._look ||= lookOf(el); if (el._paint === undefined) el._paint = paintOf(el); };
function hideLine(L) {
  let sides = lines.get(L.el);
  if (!sides) lines.set(L.el, sides = {});
  if (!sides[L.side]) { sides[L.side] = { ...L, keepRanges: [], inline: L.el.style['border' + L.side + 'Color'], svg: null }; L.el.style['border' + L.side + 'Color'] = 'transparent'; }
}
function thingCopy(s, r) {
  const at = { position: 'absolute', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' };
  if (s._line) { const c = document.createElement('div'); Object.assign(c.style, at, { background: s._line.color }); hideLine(s._line); return c; }
  if (s._dot) {
    const c = document.createElement('div');
    Object.assign(c.style, at, { background: s._dot.color, borderRadius: '50%' });
    if (!dots.has(s._dot.li)) { dots.set(s._dot.li, s._dot.inline); s._dot.li.style.listStyleType = 'none'; }
    return c;
  }
  if (s._style === undefined) s._style = s.getAttribute?.('style') ?? null;
  lookReady(s);
  const c = s.cloneNode(true);
  c.removeAttribute?.('id');
  c.setAttribute?.('aria-hidden', 'true');
  c.setAttribute?.('tabindex', '-1');
  if (s._paint) { const all = [c, ...(c.querySelectorAll?.('*') || [])]; s._paint.forEach((look, i) => { if (look && all[i]?.style) Object.assign(all[i].style, look); }); }
  Object.assign(c.style, s._look, at, { margin: '0', boxSizing: 'border-box', visibility: 'visible', transition: 'none' });
  if ('value' in s) c.value = s.value;
  return c;
}
// every ruled line on screen, broken into lengths that fall on their own (a table's worth of cells stops at 80 lengths, the longest lines first)
function linesInView() {
  probeLines(60, 12, innerWidth, innerHeight, 120, 24); const out = [], found = [];
  for (const list of ruled.values())
    for (const L of list) {
      const far = L.h ? innerWidth : innerHeight, a = Math.max(0, L.a), b = Math.min(far, L.b);
      if (lines.get(L.el)?.[L.side] || b - a < 12 || L.pos < 0 || L.pos > (L.h ? innerHeight : innerWidth)) continue;
      found.push({ L, a, b });
    }
  found.sort((p, q) => q.b - q.a - p.b + p.a);
  linesSpare = [];
  for (const { L, a, b } of found) {
    if (out.length >= 80) { linesSpare.push(L); continue; }
    const n = Math.ceil((b - a) / 110), len = (b - a) / n, pos = L.pos - L.w / 2, w = Math.max(1, L.w);
    for (let i = 0; i < n && out.length < 80; i++) {
      const u = a + i * len, s = document.createElement('span');
      s._line = L;
      out.push({ s, r: L.h ? { left: u, top: pos, width: len, height: w, right: u + len, bottom: pos + w } : { left: pos, top: u, width: w, height: len, right: pos + w, bottom: u + len } });
    }
  }
  return out;
}
// a moved letter is a copy in the fixed layer (it can never stretch the page); the real one is only hidden
function loosen(s) { if (s._body) { const b = s._body; b.parts = b.parts.filter(p => p.s !== s); if (!b.parts.length) physics.remove(b); delete s._body; } delete s._physicsPath; }
function copyOf(s, r) { if (s._thing || s._line || s._dot) return thingCopy(s, r);
  const t = s._type || typeOf(s), c = document.createElement('span');
  c.textContent = s.classList.contains('chb-run') ? s.textContent.trim().replace(/\s+/g, ' ') : s.textContent;
  Object.assign(c.style, {
    position: 'absolute',
    left: r.left + 'px',
    top: r.top + 'px',
    font: t.font,
    color: t.color,
    textTransform: t.textTransform,
    letterSpacing: t.letterSpacing,
    wordSpacing: t.wordSpacing,
    lineHeight: r.height + 'px',
    whiteSpace: 'pre'
  });
  return c;
}
const caseOf = (s, t) => {
  const text = s.classList.contains('chb-run') ? s.textContent.trim().replace(/\s+/g, ' ') : s.textContent;
  return t.textTransform === 'uppercase' ? text.toUpperCase() : t.textTransform === 'lowercase' ? text.toLowerCase() : text;
};
function lift(s, r) { loosen(s); if (s._c) { s._c.remove(); delete s._c; } const c = copyOf(s, r); (copies || layer).append(c); s.style.visibility = 'hidden'; moved.add(s); return c; }
function fly(s, r, k, dur, delay = 0) {
  const c = lift(s, r);
  s._k = k;
  s._d = D(dur);
  c.animate(k, { duration: s._d, delay: D(delay), easing: 'linear', fill: 'forwards' }).onfinish = () => c.remove();
  if (!reduce) c.style.textShadow = '3px 8px 4px rgba(20,20,19,.2)'; return c; }
function keep(s, r, k, dur, easing = 'cubic-bezier(.3,1.4,.5,1)', delay = 0) {
  const c = lift(s, r);
  s._c = c;
  if (!reduce) c.style.textShadow = '1px 3px 2px rgba(20,20,19,.18)';
  c.animate(k, { duration: D(dur), delay: D(delay), easing, fill: 'forwards' });
  return c;
}
const ballistic = (vx, vy, spin, fall = 900, T = 1.1) => {
  const k = [], ang = Math.atan2(vy, vx) * 180 / Math.PI;
  for (let i = 0; i <= 10; i++) { const t = i / 10 * T, st = i === 1 ? ` rotate(${R(ang)}deg) scale(1.5,.7) rotate(${R(-ang)}deg)` : '';
  k.push({ transform: `translate(${R(vx * t)}px,${R(vy * t + fall * t * t)}px) rotate(${R(spin * t)}deg)${st}`, opacity: i < 7 ? 1 : 1 - (i - 7) / 3 }); } return k; };
const spiral = (dx, dy, turns = 1.4) => {
  const k = [], r0 = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx);
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, e = t * t, r = r0 * (1 - e), a = a0 + turns * 6.2832 * e;
    k.push({ transform: `translate(${R(Math.cos(a) * r - dx)}px,${R(Math.sin(a) * r - dy)}px) rotate(${R(turns * 360 * e)}deg) scale(${R((1 - e * .9) * 100) / 100})`, opacity: t < .85 ? 1 : (1 - t) / .15 });
  }
  return k;
};

// the page's ruled lines (borders) break too: the part inside a blast leaves in pieces, the rest stays
// (a few hit tests find the boxes near the blast, so the cost follows the blast and not the size of the page: a scan of every
// element on each pointer move, or on each step along the railgun's shot, is what made those tools stutter. Each box is read
// once per gesture, and a line already cut is left alone, as its colour has gone)
let ruled = null, ruledAt = -1e9, probed = new Set();
function ruledOf(el) {
  let list = ruled.get(el); if (list) return list; ruled.set(el, list = []); if (el.closest(OURS)) return list; const cs = getComputedStyle(el); let r = null;
  for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
    const w = parseFloat(cs['border' + side + 'Width']); if (!w || cs['border' + side + 'Style'] === 'none' || /,\s*0\)$/.test(cs['border' + side + 'Color'])) continue; r ||= el.getBoundingClientRect();
    const h = side === 'Top' || side === 'Bottom', pos = side === 'Top' ? r.top + w / 2 : side === 'Bottom' ? r.bottom - w / 2 : side === 'Left' ? r.left + w / 2 : r.right - w / 2;
    list.push({ el, side, h, pos, a: h ? r.left : r.top, b: h ? r.right : r.bottom, w, color: cs['border' + side + 'Color'], r });
  }
  return list;
}
function probeLines(x0, y0, x1, y1, stepX, stepY) {
  const now = performance.now(), root = PAGE(), scope = root.getRootNode?.() || document;
  if (!ruled || now - ruledAt >= 300) { ruled = new Map(); probed = new Set(); for (const el of root.querySelectorAll('hr')) ruledOf(el); } ruledAt = now;   // (a rule is too thin to rely on hitting it)
  for (let px = x0; px <= x1; px += stepX)
    for (let py = y0; py <= y1; py += stepY) {
      const key = Math.round(px / 20) * 16384 + Math.round(py / 20);
      if (probed.has(key)) continue;
      probed.add(key);
      for (const el of scope.elementsFromPoint?.(px, py) || []) if (root.contains(el)) ruledOf(el);
    }
}
function bordersNear(x, y, rad, ready = false) {
  const step = Math.max(20, rad / 3), n = Math.ceil(rad / step), out = []; if (!ready) probeLines(x - n * step, y - n * step, x + n * step, y + n * step, step, step);
  for (const list of ruled.values())
    for (const L of list) { const { r, h } = L; if (r.right < x - rad || r.left > x + rad || r.bottom < y - rad || r.top > y + rad || lines.get(L.el)?.[L.side]) continue;
    const dist = Math.abs((h ? y : x) - L.pos);
    if (dist >= rad) continue;
    const half = Math.sqrt(rad * rad - dist * dist), c0 = Math.max(L.a, (h ? x : y) - half), c1 = Math.min(L.b, (h ? x : y) + half);
    if (c1 <= c0) continue;
    out.push({ ...L, cut: [c0, c1] });
  }
  return out;
}
function takeLine(L, c0, c1) {
  let sides = lines.get(L.el); if (!sides) lines.set(L.el, sides = {}); let rec = sides[L.side];
  if (!rec) { rec = sides[L.side] = { ...L, keepRanges: [[L.a, L.b]], inline: L.el.style['border' + L.side + 'Color'], svg: sheet() }; L.el.style['border' + L.side + 'Color'] = 'transparent'; }
  const next = [], gone = [];
  for (const [a, b] of rec.keepRanges) {
    if (b <= c0 || a >= c1) { next.push([a, b]); continue; }
    if (a < c0) next.push([a, c0]);
    if (b > c1) next.push([c1, b]);
    gone.push([Math.max(a, c0), Math.min(b, c1)]);
  }
  rec.keepRanges = next;
  rec.svg.innerHTML = next.map(([a, b]) => {
    const p = rec.h ? [[a, rec.pos], [b, rec.pos]] : [[rec.pos, a], [rec.pos, b]];
    return `<path d="M${R(p[0][0])} ${R(p[0][1])}L${R(p[1][0])} ${R(p[1][1])}" stroke="${rec.color}" stroke-width="${rec.w}" fill="none"/>`;
  }).join('');
  return { rec, gone };
}
function flyLine(rec, a, b, x, y, rad, how, force) {
  for (let u = a; u < b; u += 18 + rnd() * 10) {
    const v = Math.min(b, u + 18 + rnd() * 10), mid = (u + v) / 2, px = rec.h ? mid : rec.pos, py = rec.h ? rec.pos : mid, dx = px - x, dy = py - y, d = Math.hypot(dx, dy) || 1, len = v - u;
    const piece = place(`<path d="${rec.h ? `M${R(-len / 2)} 0L${R(len / 2)} ${R(J(.6))}` : `M0 ${R(-len / 2)}L${R(J(.6))} ${R(len / 2)}`}" stroke="${rec.color}" stroke-width="${rec.w + .4}" stroke-linecap="round" fill="none"/>`, px, py, [-len / 2 - 4, -len / 2 - 4, len + 8, len + 8]);
    const k = how === 'in' ?
      spiral(dx, dy) :
      how === 'drop' ?
        [{ transform: 'none' }, { transform: `translate(${R(J(6))}px,${R(30 + rnd() * 30)}px) rotate(${R(J(60))}deg)`, opacity: 0 }] :
        ballistic(dx / d * (force * (1 - d / rad) * .8 + .3) * 420 + J(40), dy / d * (force * (1 - d / rad) * .8 + .3) * 340 - 200 * force, J(540));
    piece.animate(k, { duration: D(how === 'in' ? 900 + d * 4 : 1000 + J(200)), easing: how === 'in' ? 'linear' : 'ease-in', fill: 'forwards' }).onfinish = () => piece.remove();
  }
}
function breakLines(x, y, rad, how = 'out', force = 1, ready = false) {
  for (const L of bordersNear(x, y, rad, ready)) { const { rec, gone } = takeLine(L, L.cut[0], L.cut[1]); for (const [a, b] of gone) flyLine(rec, a, b, x, y, rad, how, force); }
}
// a blast's reach over the ruled lines: the stretch under it breaks and flies as ever, the stretch the shock reaches beyond that is pushed crooked and stays so
function reachLines(x, y, rad, ring, how = 'out', force = 1) {
  for (const L of bordersNear(x, y, ring)) {
    const { rec, gone } = takeLine(L, L.cut[0], L.cut[1]),
      along = rec.h ? x : y,
      off = Math.abs((rec.h ? y : x) - rec.pos),
      half = off < rad ? Math.sqrt(rad * rad - off * off) : 0,
      i0 = along - half,
      i1 = along + half;
    for (const [a, b] of gone) { const in0 = Math.max(a, i0), in1 = Math.min(b, i1); if (half && in1 > in0) flyLine(rec, in0, in1, x, y, rad, how, force);
      for (const [c0, c1] of half ? [[a, Math.min(b, i0)], [Math.max(a, i1), b]] : [[a, b]])
        if (c1 > c0)
          for (let n = Math.ceil((c1 - c0) / 64), len = (c1 - c0) / n, i = 0; i < n; i++) {
            const mid = c0 + (i + .5) * len,
              px = rec.h ? mid : rec.pos,
              py = rec.h ? rec.pos : mid,
              dx = px - x,
              dy = py - y,
              d = Math.hypot(dx, dy) || 1,
              f = Math.max(0, 1 - d / ring),
              push = 3 + 12 * f,
              rod = place(`<path d="${rec.h ? `M${R(-len / 2)} 0L${R(len / 2)} 0` : `M0 ${R(-len / 2)}L0 ${R(len / 2)}`}" stroke="${rec.color}" stroke-width="${rec.w}" fill="none"/>`, px, py, [-len / 2 - 2, -len / 2 - 2, len + 4, len + 4]);
        rod.animate(
          [{ transform: 'none' }, { transform: `translate(${R(dx / d * push * 1.5)}px,${R(dy / d * push * 1.5)}px) rotate(${R(J(5) * f)}deg)`, offset: .4 }, { transform: `translate(${R(dx / d * push)}px,${R(dy / d * push)}px) rotate(${R(J(4) * f)}deg)` }],
          { duration: D(420), delay: D(d / 2), easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' }); } } }
}
const mark = el => { marks.push(el); return el; };
// (a page element we only styled for a while gets no empty style attribute left behind)
const tidy = el => { if (!el.getAttribute('style')) el.removeAttribute('style'); };
// what a closed black hole leaves (a pinhole, the back end still turning in it) can itself be broken: anything that hits
// it makes it pop (a flash and a puff of 0 and 1), another black hole swallows it, the foil flattens it
const PINS = [];
function breakPins(test, how = 'pop', delayOf = () => 0) {
  for (let i = PINS.length - 1; i >= 0; i--) { const p = PINS[i]; if (!test(p.x, p.y)) continue; PINS.splice(i, 1); const el = p.el, wait = delayOf(p.x, p.y);
    el.getAnimations?.().forEach(a => a.cancel());
    if (how === 'flat') {
      el.animate(
        [{ transform: 'none' }, { transform: `scale(${R(2.4 + rnd())},.05)`, opacity: .6, offset: .6 }, { transform: 'scale(4,.02)', opacity: 0 }],
        { duration: D(600), delay: D(wait), easing: 'cubic-bezier(.7,0,.9,.6)', fill: 'forwards' }).onfinish = () =>
        el.remove();
      continue;
    }
    if (how === 'swallow') {
      const [hx, hy] = p.to;
      el.animate(
        [{ transform: 'none' }, { transform: `translate(${R(hx - p.x)}px,${R(hy - p.y)}px) rotate(${R(540 + J(180))}deg) scale(.1)`, opacity: .2 }],
        { duration: D(900), delay: D(wait), easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' }).onfinish = () =>
        el.remove();
      continue;
    }
    later(() => { if (!el.isConnected) return; light(p.x, p.y, 70, '200,240,190', 360, .9);
      el.animate(
        [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.35)', offset: .25 }, { transform: 'scale(0) rotate(160deg)', opacity: 0 }],
        { duration: D(420), easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' }).onfinish = () =>
        el.remove();
      if (!reduce)
        for (let k = 0; k < 12 * FX; k++) {
          const d = document.createElement('span');
          d.textContent = rnd() < .5 ? '0' : '1';
          Object.assign(d.style, {
            position: 'absolute',
            left: R(p.x - 4) + 'px',
            top: R(p.y - 8) + 'px',
            font: `700 ${R(10 + rnd() * 6)}px Consolas,'Courier New',monospace`,
            color: rnd() < .3 ? DATA2 : DATA,
            textShadow: '0 0 6px rgba(127,184,110,.7)'
          });
          layer.append(d);
          mark(d);
        const [kf, dur] = toss(p.x, p.y, J(260), -(160 + rnd() * 320), J(720), 14); d.animate(kf, { duration: dur, easing: 'linear', fill: 'both' }); } }, wait); }
}
// ---------------------------------------------------------------- the page itself reacts: light falls on it, things cast shadows on it, blasts stain
// and dent it. Each kind lives on its own fixed sheet with its own blend mode, so it darkens or lights the paper and the
// words underneath (a mark is part of the page, not laid on top of it). The light comes from the upper left.
const blendSheet = (id, mode, above) => {
  let d = document.getElementById(id);
  if (!d) {
    d = document.createElement('div');
    d.id = id;
    d.className = 'chb-blend';
    d.style.mixBlendMode = mode;
    d.setAttribute('aria-hidden', 'true');
    if (above) layer.after(d); else layer.before(d);
  }
  return d;
};
const MUL = blendSheet('chb-mul', 'multiply', false), OVL = blendSheet('chb-ovl', 'overlay', false), SCR = blendSheet('chb-scr', 'screen', true);
const fxEl = (host, x, y, w, h, css = {}) => {
  const d = document.createElement('div');
  Object.assign(d.style, { left: R(x - w / 2) + 'px', top: R(y - h / 2) + 'px', width: R(w) + 'px', height: R(h) + 'px' }, css);
  host.append(d);
  return d;
};
const soft = (rgb, a, mid = .45) => `radial-gradient(closest-side, rgba(${rgb},${a}), rgba(${rgb},${a * mid}) 55%, rgba(${rgb},0))`;
// a burst of light thrown on the page: brightens what is under it, then fades
function light(x, y, r, rgb = '255,214,150', dur = 600, peak = .85) { if (reduce) return; const d = fxEl(SCR, x, y, r * 2, r * 2, { background: soft(rgb, peak, .35) });
  d.animate(
    [{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1)', offset: .1 }, { opacity: 0, transform: 'scale(1.2)' }],
    { duration: D(dur), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () =>
    d.remove(); }
// a light that stays while something glows (a laser's hot point, a black hole's disc, a portal)
const glow = (x, y, r, rgb, a = .7) => fxEl(SCR, x, y, r * 2, r * 2, { background: soft(rgb, a, .3) });
// a stain soaked into the paper: grained, darkens paper and ink alike; it stays until "Put it back"
function stain(x, y, rx, ry, rgb = '40,28,16', a = .5, rot = 0, grain = true) {
  const d = mark(fxEl(MUL, x, y, rx * 2, ry * 2, { background: soft(rgb, a, .5), transform: `rotate(${R(rot)}deg)` }));
  if (grain) d.classList.add('chb-grain');
  if (!reduce) d.animate([{ opacity: 0, transform: `rotate(${R(rot)}deg) scale(.7)` }, { opacity: 1, transform: `rotate(${R(rot)}deg)` }], { duration: D(520), easing: 'ease-out', fill: 'backwards' });
  return d;
}
// a dent pressed into the paper: shaded on the side toward the light, lit on the far side (overlay keeps the words readable)
function dent(x, y, r) { const d = mark(fxEl(OVL, x, y, r * 2, r * 2, { background: 'radial-gradient(circle at 64% 68%, rgba(255,255,255,.62), rgba(255,255,255,0) 44%), radial-gradient(circle at 36% 32%, rgba(0,0,0,.5), rgba(0,0,0,0) 50%)' }));
  if (!reduce) d.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: D(240), fill: 'backwards' }); return d; }
// the shadow of something above the page; height 0 = touching (dark, small, sharp), 1 = high (faint, wide, soft)
const shadowCss = h => ({ opacity: String(R((.6 - h * .48) * 100) / 100), transform: `scale(${R((1 + h * .5) * 100) / 100})`, filter: `blur(${R(2 + h * 9)}px)` });
function shadow(x, y, w, h = 0) { const d = fxEl(MUL, x + 6, y + 10, w, w * .34, { background: soft('20,20,19', .9, .55), ...shadowCss(h) }); d.className = 'chb-shadow'; return d; }
const moveShadow = (d, x, y, h) => { const w = parseFloat(d.style.width); Object.assign(d.style, { left: R(x + 6 - w / 2) + 'px', top: R(y + 10 - w * .17) + 'px' }, h == null ? {} : shadowCss(h)); };
const fallShadow = (d, from, to, dur, delay = 0, easing = 'ease-in') => {
  if (reduce) return;
  d.animate([shadowCss(from), shadowCss(to)], { duration: D(dur), delay: D(delay), easing, fill: 'forwards' });
};

// the page jolts: amplitude, length and character differ per weapon (the bomb jolts hard, the railgun kicks sideways,
// the black hole rumbles low and long, the hammer knocks once, the foil is silent)
const baseTransform = new WeakMap();
const SHAKE = {
  foil: [18, 520, 'all'],
  foiljolt: [8, 240, 'y'],
  foiljolt2: [6, 220, 'all'],
  foilrumble: [2.6, 2200, 'rumble'],
  foilend: [11, 440, 'y'],
  bomb: [17, 760, 'all'],
  hammer: [4, 200, 'all'],
  hammer2: [7, 260, 'all'],
  hammer3: [12, 420, 'all'],
  railgun: [13, 400, 'x'],
  railcharge: [1.4, 900, 'rumble'],
  close: [9, 360, 'all'],
  blackhole: [7, 12000, 'build'],
  bhjolt: [12, 320, 'all'],
  bhjolt2: [16, 380, 'all'],
  bhclose: [20, 660, 'all'],
  bhquake: [16, 420, 'all'],
  bhbuild: [5, 150, 'all'],
  bhbuild2: [9, 170, 'all'],
  bhbuild3: [14, 190, 'all'],
  bhburst: [36, 980, 'all'],
  gravity: [3, 300, 'y']
};
// the page in blocks: those the host names, and everything beside them, so a sidebar, a top bar or a footer is never left standing
function pageBlocks() {
  const named = [...document.querySelectorAll(opts.blocks || 'body > *')], out = [], walk = el => {
    for (const c of el.children || []) {
      if (c.nodeType === 3 || c.closest(OURS + ',.chb-blend,#chb-layer') || /^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(c.tagName)) continue;
      if (c.querySelector('.chb-box')) walk(c); else if (named.includes(c)) out.push(c); else if (named.some(n => c.contains(n))) walk(c); else out.push(c);
    }
  };
  walk(PAGE()); for (const n of named) if (!out.includes(n) && !n.closest('.chb-box, #chb-layer') && !n.querySelector('.chb-box')) out.push(n);
  // (a drawer parked off the side of the screen is not part of the page: moved, it comes into view in the wrong place)
  return out.filter(el => { const r = el.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; });
}
// a block's own transform goes first in a move of ours: an animated transform replaces it, and a drawer held in place by one drops out of place
const ownMove = el => { const t = getComputedStyle(el).transform; return t && t !== 'none' ? t + ' ' : ''; };
function shake(kind, pageOnly = false) {
  const sp = SHAKE[kind]; if (!sp || reduce) return; const [amp, dur, how] = sp, n = how === 'rumble' || how === 'build' ? 70 : 10, k = [];
  for (let i = 0; i <= n; i++) {
    const f = how === 'build' ? (i === n ? 0 : .45 + .55 * Math.pow(i / n, 1.4)) : how === 'rumble' ? (i === 0 || i === n ? 0 : Math.sin(i / n * Math.PI)) : (1 - i / n) ** 2, a = amp * f;
    const dx = how === 'y' ? 0 : J(a), dy = how === 'x' ? J(a * .15) : J(a); k.push({ transform: i === n ? 'none' : `translate(${R(how === 'x' && i < 3 ? -a : dx)}px,${R(dy)}px)` }); }
  // the effects layer shakes with the page, so cracks, scars and falling pieces (even ones added during a long shake) move with it
  // Nested Canvas wrappers must not multiply the jolt. The overlay receives the same transform exactly once.
  // (a jolt laid over a longer rumble takes over for its moment, which nobody can tell from adding to it; 'add' is only kept for
  // an element with a transform of its own, as replacing would drop that)
  const page = [...document.querySelectorAll(opts.shake || 'body > *:not(#chb-layer)')];
  for (const el of new Set([...page.filter(el => !page.some(parent => parent !== el && parent.contains?.(el))), ...(pageOnly ? [] : [layer])])) {
    if (!baseTransform.has(el)) baseTransform.set(el, getComputedStyle(el).transform);
    const own = baseTransform.get(el), animation = el.animate(k, { duration: dur, easing: 'linear', composite: own && own !== 'none' ? 'add' : 'replace' });
    pageAnimations.add(animation); animation.onfinish = () => pageAnimations.delete(animation);
  }
}

// ---------------------------------------------------------------- bomb: tears the page open to the back end
function debris(x, y, n, force = 1) {
  if (!PA || reduce) return;
  for (let i = 0; i < n; i++) { const a = rnd() * 6.283, v = (160 + rnd() * 260) * force, sc = place(fresh(pickOf(PA.scrap)), x + J(10), y + J(8), [-10, -10, 20, 20]);
  sc.animate(ballistic(Math.cos(a) * v, Math.sin(a) * v * .8 - 220 * force, J(900), 900, 1.2), { duration: 1100 + rnd() * 400, easing: 'linear', fill: 'forwards' }).onfinish = () => sc.remove(); } }
function puffs(x, y, n, spread = 30, rise = 40) {
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28 + J(.4), d = spread * (.6 + rnd() * .6), p = place(PA ? fresh(pickOf(PA.puff)) : puffSVG(14), x + Math.cos(a) * d * .3, y + Math.sin(a) * d * .25, [-26, -22, 52, 44]);
  p.animate(
    [{ transform: 'scale(.3) rotate(0deg)', opacity: 0 }, { transform: `translate(${R(Math.cos(a) * d)}px,${R(Math.sin(a) * d * .6)}px) scale(1.05) rotate(${R(J(10))}deg)`, opacity: 1, offset: .2 }, { transform: `translate(${R(Math.cos(a) * d * 1.35)}px,${R(Math.sin(a) * d * .6 - rise)}px) scale(1.35) rotate(${R(J(20))}deg)`, opacity: 0 }],
    { duration: D(1500 + rnd() * 500), delay: D(40 + i * 25), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }).onfinish = () =>
    p.remove(); } }
// what the tools have running (not the whole document's: that list grows with the page and with Home's own art)
function ourAnimations() {
  return [
    ...new Set([
      ...pageAnimations,
      ...folds.map(f => f.a),
      ...[...returning].map(f => f.a),
      ...[layer, MUL, OVL, SCR, aim, box.querySelector('.chb-box')].flatMap(el => el?.getAnimations?.({ subtree: true }) || [])
    ])
  ];
}
// hit-stop: everything holds still for a beat on impact, which is what makes a hit feel heavy
function hitStop(ms) {
  if (reduce) return;
  const list = ourAnimations().filter(a => a.playState === 'running');
  for (const a of list) a.pause();
  setTimeout(() => { for (const a of list) a.play(); }, ms);
}
// ---------------------------------------------------------------- things thrown to the floor: real falls, bounces and a pile that grows
// A thrown letter, chip or shard is simulated once (gravity, the sides of the screen, a floor it bounces on and comes to
// rest on, on top of whatever landed there before) and its path is handed to the Web Animations API as keyframes, so
// nothing of ours runs per frame. What lands stays on the floor until "Put it back".
const HITS = [], balloons = [];
const physics = globalThis.ReservePlayPhysics.create({ width: innerWidth, height: innerHeight, reduced: reduce }), FLOOR = physics.floor;
const physicsView = globalThis.ReservePlayPhysics.attach(physics, {
  document,
  requestFrame: requestAnimationFrame,
  cancelFrame: cancelAnimationFrame,
  render: renderBody,
  onFrame: physicsFrame,
  onRender: drawBalloons
});
// one transform per frame, written only when it changed. The way home is sampled as it goes; when it grows long every second
// stop is dropped, so it never holds more than a smooth half-second walk back can show
function renderBody(b) {
  // (a body that has just come through a portal is still small; only then does the string carry a scale)
  if (b.teleports !== (b.crossed || 0)) { b.crossed = b.teleports; if (!reduce) b.grew = physics.time; }
  const grown = b.grew === undefined ? 1 : Math.min(1, (physics.time - b.grew) / .16);
  if (grown >= 1) b.grew = undefined;
  const size = (b.scale ?? 1) * (.55 + .45 * grown), transform = `translate(${R(b.x - b.homeX)}px,${R(b.y - b.homeY)}px) rotate(${R(b.angle)}deg)` + (size !== 1 ? ` scale(${Math.round(size * 1000) / 1000})` : '');
  if (transform === b.drawn || !b.parts) return; b.drawn = transform; for (const p of b.parts) p.c.style.transform = transform;
  const path = b.path; if (!path || restoring || physics.time - (b.sampled || 0) <= .06) return; b.sampled = physics.time; path.push({ transform });
  if (path.length >= 64) { let kept = 1; for (let i = 2; i < path.length; i += 2) path[kept++] = path[i]; path.length = kept; }
}
// where a string meets what hangs from it: the middle of the piece's top, wherever the piece has turned
function topOf(b) {
  const dx = R(b.x - b.homeX), dy = R(b.y - b.homeY), a = R(b.angle) * Math.PI / 180, half = b.height / 2;
  return { x: b.homeX + dx + Math.sin(a) * half, y: b.homeY + dy - Math.cos(a) * half };
}
function liveBody(items) {
  if (!items.length) return null;
  const left = Math.min(...items.map(p => p.r.left)),
    top = Math.min(...items.map(p => p.r.top)),
    right = Math.max(...items.map(p => p.r.left + p.r.width)),
    bottom = Math.max(...items.map(p => p.r.top + p.r.height)),
    path = [{ transform: 'none' }],
    parts = items.map(({ s, r }) => {
    const c = lift(s, r);
    s._c = c;
    s._physicsPath = path;
    c.classList.add('chb-physics-body');
    Object.assign(c.style, { width: r.width + 'px', height: r.height + 'px', boxSizing: 'border-box', transformOrigin: `${(left + right) / 2 - r.left}px ${(top + bottom) / 2 - r.top}px` });
    return { s, c, r };
  }), b = physics.add({ x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, homeX: (left + right) / 2, homeY: (top + bottom) / 2, parts, path });
  for (const p of parts) p.s._body = p.c._body = b;
  shown();
  return b;
}
function wordAt(x, y) {
  splitWords(wordsNear(x, y, 12));
  for (const w of splitNear(x, y, 12, '.chb-word')) {
    const r = w.getBoundingClientRect();
    if (x < r.left - 3 || x > r.right + 3 || y < r.top - 4 || y > r.bottom + 4) continue;
    const items = [...w.children].filter(s => !moved.has(s)).map(s => ({ s, r: s.getBoundingClientRect() }));
    return liveBody(items);
  }
  return null;
}
// what a live tool picks up is whatever is under the pointer: a word, and failing that a picture, a button or an icon, or a length of a ruled line
function pieceAt(x, y, tooBig = () => false) {
  const word = wordAt(x, y); if (word) return word;
  for (const { el, r } of thingBoxes()) if (!moved.has(el) && !tooBig(r) && x >= r.left - 3 && x <= r.left + r.width + 3 && y >= r.top - 3 && y <= r.top + r.height + 3) return liveBody([{ s: el, r }]);
  for (const L of bordersNear(x, y, 9)) { const b = lineBody(L, L.h ? x : y); if (b) return b; }
  return null;
}
function lineBody(L, along) {
  const c0 = Math.max(L.a, along - 60), c1 = Math.min(L.b, along + 60), s = document.createElement('span'), w = Math.max(1, L.w);
  if (c1 - c0 < 6) return null;
  takeLine(L, c0, c1);
  s._line = L;
  return liveBody([
    {
      s,
      r: L.h ? { left: c0, top: L.pos - w / 2, width: c1 - c0, height: w, right: c1, bottom: L.pos + w / 2 } : { left: L.pos - w / 2, top: c0, width: w, height: c1 - c0, right: L.pos + w / 2, bottom: c1 }
    }
  ]);
}
// a way through pulls at what lies round it for as long as the pair stands: the nearest things lying still near the way in (words, pictures, buttons, lengths of ruled line, pieces already
// loose) are drawn in a few at a time, each on a spiral that tightens and flattens into the ring, shrinking as it goes, and each comes out of the way out small and grows back as it flies.
// The page is read once per batch and the batch handed out over the passes after it. With nothing left to take the passes stop; moving, turning or resizing a portal starts them again.
const pouring = [], pourReady = [], POURS = 3, TURN = Math.PI * 2; let pourTimer = 0, pourIdle = 0, pourPage = false;
const pourReach = p => Math.max(220, p.size * 2.4), easeInOut = t => t * t * (3 - 2 * t);
function pourArm(ms) { if (!pourTimer) pourTimer = later(pourPass, ms); }
function pourWake() { if (reduce || restoring || portals.length !== 2) return; pourIdle = 0; pourPage = true; pourReady.length = 0; if (!resting) pourArm(90); }
function pourPull(body) {
  const [p] = portals,
    ax = Math.cos(p.angle),
    ay = Math.sin(p.angle),
    dx = body.x - p.x,
    dy = body.y - p.y,
    q = physics.constrain(body, { x: body.x, y: body.y, stiffness: 1400, damping: 76, sway: .01 });
  if (!q) return;
  body.pours = (body.pours || 0) + 1;
  body.portalUntil = Infinity;
  body.spin = 150 + rnd() * 240;
  pouring.push({
    body,
    q,
    t: 0,
    dur: .8 + Math.min(1, Math.hypot(dx, dy) / pourReach(p)) * .55 + rnd() * .12,
    u: ay * -dx + ax * dy,
    v: ax * dx + ay * dy,
    turns: 1 + rnd() * .5,
    end: Math.max(.02, Math.min(.16, p.size * .2 / Math.max(body.width, body.height))),
    s: 1,
    out: false
  });
  physicsView.wake?.();
}
// (the rest of a ruled line a first piece was taken from: bordersNear leaves a line out once it has been touched)
function looseLines(p, rad, most) {
  const out = [];
  for (const sides of lines.values())
    for (const rec of Object.values(sides))
      for (const [a, b] of rec.keepRanges || []) {
        const at = rec.h ? p.x : p.y, along = Math.max(a, Math.min(b, at));
        if (b - a >= 6 && Math.hypot(along - at, rec.pos - (rec.h ? p.y : p.x)) < rad) out.push({ line: { ...rec, a, b }, along });
      }
  return out.slice(0, most);
}
function pourRead(p, rad) {
  const most = LOW ? 8 : 14,
    got = lettersNear(p.x, p.y, rad, undefined, false, { cap: most, letters: 0, flat: true }).sort((m, n) => m.d - n.d).slice(0, most),
    rules = bordersNear(p.x, p.y, rad).slice(0, 2).map(L => ({ line: L, along: L.h ? p.x : p.y }));
  pourReady.push(...got);
  pourReady.splice(Math.min(3, pourReady.length), 0, ...rules, ...looseLines(p, rad, 2));
  if (!pourReady.length) pourPage = false;
}
function pourPass() {
  pourTimer = 0;
  if (reduce || restoring || resting || portals.length !== 2) return;
  if (document.hidden) { pourArm(1000); return; }
  const [p] = portals, rad = pourReach(p), most = Math.min(LOW ? 2 : 3, (LOW ? 3 : 6) - pouring.reduce((n, k) => n + !k.out, 0));
  let took = 0;
  if (most > 0) {
    for (const b of physics.bodies) {
      if (took >= most) break;
      if (!b.awake && !b.dragged && !b.constraint && b.parts?.length && (b.pours || 0) < POURS && Math.hypot(b.x - p.x, b.y - p.y) < rad) { pourPull(b); took++; }
    }
    if (took < most && !pourReady.length && pourPage) pourRead(p, rad);
    while (took < most && pourReady.length) {
      const it = pourReady.shift(), body = it.line ? lineBody(it.line, it.along) : moved.has(it.s) || it.s.isConnected === false ? null : liveBody([{ s: it.s, r: it.r }]);
      if (body) { pourPull(body); took++; }
    } }
  pourIdle = took ? 0 : pourIdle + 1; const busy = took || pourReady.length || pouring.length; if (busy || physics.awake || pourIdle < 3) pourArm(busy ? LOW ? 380 : 240 : 700); }
function pourFrame(dt) {
  if (portals.length !== 2) { pouring.length = 0; return; }
  const [p, q] = portals, ax = Math.cos(p.angle), ay = Math.sin(p.angle), nx = Math.cos(q.angle), ny = Math.sin(q.angle);
  for (let i = pouring.length - 1; i >= 0; i--) { const k = pouring[i], b = k.body; if (b.retired) { pouring.splice(i, 1); continue; } k.t += dt;
    if (k.out) { const u = Math.min(1, k.t / .34); b.scale = k.s + (1 - k.s) * (1 - (1 - u) ** 3); if (u >= 1) { b.scale = 1; pouring.splice(i, 1); } continue; }
    // (it comes in to the ring first, then goes round inside it, tightening, as the ring flattens it. Taken by the hand or the magnet on the way in, it stops being pulled and grows back where it is)
    if (b.dragged || b.constraint !== k.q) { if (b.constraint === k.q) physics.release(b); b.portalUntil = physics.time + .2; k.out = true; k.t = 0; k.s = b.scale ?? 1; continue; }
    const u = Math.min(1, k.t / k.dur),
      ring = p.size * .46,
      r0 = Math.hypot(k.u, k.v) || 1,
      lead = easeInOut(Math.min(1, u / .6)),
      r = u < .6 ? r0 > ring ? ring + (r0 - ring) * (1 - lead) : r0 : Math.min(r0, ring) * (1 - easeInOut((u - .6) / .4)),
      keep = r / r0,
      turn = k.turns * TURN * u ** 1.6,
      c = Math.cos(turn),
      s = Math.sin(turn),
      along = (k.u * c - k.v * s) * keep,
      off = (k.u * s + k.v * c) * keep * (1 - .58 * lead);
    k.q.x = p.x - ay * along + ax * off;
    k.q.y = p.y + ax * along + ay * off;
    b.scale = 1 + (k.end - 1) * easeInOut(Math.max(0, (u - .3) / .7));
    if (u < 1) continue;
    physics.release(b);
    b.x = q.x + nx * 8;
    b.y = q.y + ny * 8;
    const v = 460 + rnd() * 380, side = J(.5), cs = Math.cos(side), sn = Math.sin(side);
    b.vx = (nx * cs - ny * sn) * v;
    b.vy = (nx * sn + ny * cs) * v;
    b.spin = J(260);
    b.portalUntil = physics.time + .25;
    physics.wake(b);
    k.out = true;
    k.t = 0;
    k.s = b.scale;
} }
function physicsFrame(dt) {
  if (pouring.length) pourFrame(dt);
  if (!pourTimer && !reduce && portals.length === 2) pourArm(700);
  if (!reduce) for (const b of [...balloons]) if (!b.body.retired) flyBalloon(b, dt);
  for (const k of caught) if (!k.body.retired && k.body.constraint) { const point = k.body.constraint; point.x = magnetX + k.off[0]; point.y = magnetY + k.off[1]; }
}
function drawBalloons() {
  for (const b of [...balloons]) {
    for (let i = b.ties.length - 1; i >= 0; i--) if (b.ties[i].body.retired) { b.ties.splice(i, 1)[0].string.remove(); if (!i) leadTie(b); }
    if (b.ghost ? b.body.retired : !b.ties.length) { dropBalloon(b); continue; }
    b.el.style.transform = `translate(${b.x}px,${b.y}px) rotate(${R(b.tilt)}deg) scale(${b.size.toFixed(3)})`;
    for (const t of b.ties) {
      const top = topOf(t.body), dx = top.x - b.x, dy = top.y - b.y - 1, length = Math.hypot(dx, dy);
      t.thread.setAttribute('d', `M0 0L${length} 0`);
      t.string.style.transformOrigin = '0 50%';
      t.string.style.transform = `translate(${b.x}px,${b.y + 1}px) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
    }
  }
}
listen(document, 'scroll', () => { ruled = textIndex = thingIndex = null; pourWake(); }, true);
listen(globalThis, 'resize', () => {
  ruled = textIndex = thingIndex = null;
  physics.resize(innerWidth, innerHeight);
  for (const p of portals) { p.x = Math.max(4, Math.min(innerWidth - 4, p.x)); p.y = Math.max(4, Math.min(innerHeight - 4, p.y)); drawPortal(p); }
  syncPortals();
});
// the rendered marks (play-space.js): a canvas laid under the flying letters, run on animation frames until it settles
const SPX = () => globalThis.ReservePlaySpace, liveCanvas = cls => { const cv = document.createElement('canvas'); cv.className = cls; layer.prepend(cv); return cv; };
// (a weak machine draws the big canvases every other frame)
const everyOther = () => { let n = 0; return () => !LOW || ++n % 2 === 0; };
const run = (cv, anim) => {
  const t0 = performance.now(), tick = now => { if (!cv.isConnected) return; anim.frame((now - t0) / 1000); if (!anim.done) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};
function flight(x0, y0, vx, vy, spin, h = 12) {
  const path = [], g = 2300, dt = 1 / 60; let x = 0, y = 0, a = 0, still = 0, i = 0; const col = () => Math.round((x0 + x) / 7);
  for (; i < 160 && still < 4; i++) {
    vy += g * dt; x += vx * dt; y += vy * dt; a += spin * dt;
    if (x0 + x < 6) { x = 6 - x0; vx = Math.abs(vx) * .45; } if (x0 + x > innerWidth - 6) { x = innerWidth - 6 - x0; vx = -Math.abs(vx) * .45; }
    const fl = innerHeight - 4 - (FLOOR.get(col()) || 0) - h / 2;
    if (y0 + y >= fl && vy > 0) { y = fl - y0; if (vy > 260) { vy = -vy * .34; vx *= .62; spin = -spin * .4; } else { vy = 0; vx *= .5; spin *= .3; still++; } }
    path.push(x, y, a);
  }
  { const c = col(); [.12, .3, .55, .3, .12].forEach((w, d) => FLOOR.set(c + d - 2, Math.min(64, (FLOOR.get(c + d - 2) || 0) + h * w * .7))); }
  return path;
}
// a path of flight as a canvas reads it: 30 steps a second, in radians
const railTrack = p => {
  const o = [];
  for (let i = 0; i < p.length; i += 6) o.push(p[i], p[i + 1], p[i + 2] * Math.PI / 180);
  if (p.length % 6 !== 3) o.push(p.at(-3), p.at(-2), p.at(-1) * Math.PI / 180);
  return o;
};
// a piece that will fly on a canvas: its copy waits, hidden, where it will land, and nothing on the page changes until it goes
function readyPiece(list, s, r, cx, cy, track, t0) {
  const c = copyOf(s, r), end = track.length - 3, old = s._c, t = s._type || typeOf(s);
  c.style.visibility = 'hidden';
  c.style.transform = `translate(${R(track[end])}px,${R(track[end + 1])}px) rotate(${R(track[end + 2] * 180 / Math.PI)}deg)`;
  c.dataset.chbHeld = '';
  copies.append(c);
  moved.add(s);
  s._c = c;
  list.push({ s, c, old, cx, cy, track, t0, text: caseOf(s, t), font: t.font, color: t.color, h: r.height });
}
const pieceGoes = p => { p.old?.remove(); loosen(p.s); p.s.style.visibility = 'hidden'; }, pieceLands = p => { p.c.style.visibility = ''; delete p.c.dataset.chbHeld; };
function toss(x0, y0, vx, vy, spin, h = 12, mid = '') {
  const path = flight(x0, y0, vx, vy, spin, h),
    n = path.length / 3,
    k = [{ transform: mid || 'none' }],
    at = i => `translate(${R(path[i * 3])}px,${R(path[i * 3 + 1])}px) ${mid} rotate(${R(path[i * 3 + 2])}deg)`;
  for (let i = 2; i < n; i += 3) k.push({ transform: at(i) });
  k.push({ transform: at(n - 1) });
  return [k, Math.max(300, n / 60 * 1000)];
}
// bullet time: on the blast everything runs slow for a beat, then catches up
function slowmo(rate, ms) {
  if (reduce) return;
  const list = ourAnimations().filter(a => a.playState !== 'finished');
  for (const a of list) a.updatePlaybackRate(rate);
  later(() => { for (const a of list) try { a.updatePlaybackRate(1); } catch {} }, ms);
}
// the fireball: a white heart, then yellow, orange, red and a dark smoky rim, each a ragged blob set off its outline
const fireSVG = r => {
  let out = '';
  for (const [k, c] of [[1, '#4A3A30'], [.84, '#B8502A'], [.66, '#EE8A3A'], [.47, '#F8C451'], [.27, '#FFF4CC']]) out += `<path d="${closed(ring(J(2.4), J(2.4), r * k, r * k * .9, 13, .17))}" fill="${c}"/>`;
  return out + inkP(over(ring(0, 0, r, r * .9, 13, .17)), 2.2, .45);
};
// a small flame: an orange tongue with a yellow heart, its outline run past its start
const flameSVG = () => `<path d="M1 7C-4 3 -3.4 -3 0.6 -10C4.4 -3 5 3 1 7Z" fill="#EE8A3A"/><path d="M0.6 5.6C-1.8 3 -1.4 -0.6 0.4 -4.6C2.2 -0.6 2.6 3 0.6 5.6Z" fill="#F8C451"/>` + inkP('M0 6.4C-4.6 2.6 -3.8 -3.4 0 -10C3.8 -3.4 4.4 2.6 0 6.4C-1 5.6', 1.2, .55);
function bomb(x, y) {
  const g = place(ART.bomb(), x, y, [-20, -34, 42, 50]); let ready = null; later(() => { ready = aimBomb(x, y); }, reduce ? 0 : 34);
  const fl = glow(x - 5, y - 30, 30, '255,190,110', .9);
  fl.style.opacity = '0';
  if (!reduce)
    fl.animate(
      [{ opacity: .4, transform: 'none' }, { opacity: 1 }, { opacity: .55 }, { opacity: .95 }, { opacity: .5, transform: 'translate(-12px,8px)' }],
      { duration: D(900), delay: D(380), fill: 'forwards' });
  g.animate(
    [
      { transform: 'translate(0,-46px) rotate(-14deg)' },
      { transform: 'rotate(4deg)', offset: .55, easing: 'ease-in' },
      { transform: 'translate(0,-8px) rotate(-2deg)', offset: .75, easing: 'ease-out' },
      { transform: 'none' }
    ],
    { duration: D(420), fill: 'forwards' });
  const fuse = g.querySelector('.fuse'); fuse.style.strokeDasharray = '1'; fuse.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: .98 }], { duration: D(900), delay: D(380), fill: 'forwards' });
  g.querySelector('.spark').animate(
    [{ transform: 'none' }, { transform: 'translate(-6px,1px)', offset: .4 }, { transform: 'translate(-12px,8px)' }],
    { duration: D(900), delay: D(380), fill: 'forwards' });
  if (!reduce) {
    // the fuse spits sparks as it burns down
    for (let i = 0; i < 14; i++) {
      const u = i / 14, sx = x + 1 - 12 * u, sy = y - 31 + 8 * u, a = -Math.PI / 2 + J(1.2), v = 90 + rnd() * 120, sp = place(dot(0, 0, 1.3 + rnd(), rnd() < .5 ? GOLD : '#FFE7A8'), sx, sy, [-3, -3, 6, 6]);
      sp.animate(ballistic(Math.cos(a) * v, Math.sin(a) * v, 0, 700, .45), { duration: 420, delay: 380 + u * 900, easing: 'linear', fill: 'both' }).onfinish = () => sp.remove(); }
    // the last moment: it swells and glows red
    g.animate(
      [{ transform: 'none', filter: 'none' }, { transform: 'scale(1.12)', filter: 'drop-shadow(0 0 5px rgba(255,90,40,.8))' }, { transform: 'scale(.97)' }, { transform: 'scale(1.18)', filter: 'drop-shadow(0 0 9px rgba(255,80,30,1))' }],
      { duration: 360, delay: 1020, composite: 'add', fill: 'forwards' });
  }
  later(() => { g.remove(); fl.remove(); boom(x, y, ready); }, reduce ? 0 : 1380);
}
// The fuse is the time to read the page: the letters then go on a canvas of their own, so the blast adds nothing to the page in the frame that matters most
function aimBomb(x, y) {
  if (reduce || !SPX()?.flock) return null; const R0 = 150, flying = [], solid = [], held = copies = document.createDocumentFragment(); bordersNear(x, y, R0 * 2.3);
  for (const p of allThings(lettersNear(x, y, R0 * 2.3, undefined, true, blast(520)), 520, (m, n) => m.d - n.d)) {
    const { s, r, d, cx, cy } = p, a = Math.atan2(cy - y, cx - x);
    if (s._thing || s._line || s._dot) { solid.push(p); continue; }
    if (d <= R0) {
      const f = (1 - d / R0) * .75 + .35;
      readyPiece(flying, s, r, cx, cy, railTrack(flight(cx, cy, Math.cos(a) * f * 780 + J(90), Math.sin(a) * f * 520 - 560 * f - 120 + J(60), J(900), r.height)), 0);
      continue;
    }
    const f = 1 - (d - R0) / (R0 * 1.3), push = 3 + 11 * f, ax = Math.cos(a) * push, ay = Math.sin(a) * push, ra = J(.28) * f, rb = J(.2) * f;
    readyPiece(
      flying,
      s,
      r,
      cx,
      cy,
      [0, 0, 0, ax * .9, ay * .55 - 2 * f, ra * .6, ax * 1.5, ay * .95 - 4 * f, ra, ax * 1.6, ay - 4 * f, ra, ax * 1.3, ay * .8, lerp(ra, rb, .5), ax, ay * .6, rb],
      (d - R0) / 1100);
  }
  copies = null; layer.append(held); return { flying, solid };
}
function boom(x, y, ready = null) {
  const R0 = 150; breakPins((px, py) => Math.hypot(px - x, py - y) < R0, 'pop', (px, py) => Math.hypot(px - x, py - y) * .6);
  if (!reduce) {
    // the fireball: rendered, cooling from white through gold and orange to red
    if (SPX()?.blast) {
      const cv = document.createElement('canvas');
      cv.className = 'chb-blast';
      cv.style.zIndex = '3';
      layer.append(cv);
      const bl = SPX().blast(cv, x, y, 92, { reduce }), t0 = performance.now(), draw = everyOther(), tick = now => {
        if (!cv.isConnected) return;
        if (draw()) bl.frame((now - t0) / 1000);
        if (bl.done) cv.remove(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    else {
      const fb = place(fireSVG(70), x, y, [-80, -76, 160, 152]);
      fb.animate(
        [
          { transform: 'scale(.15)', opacity: 1, filter: 'brightness(1.3)' },
          { transform: 'scale(1)', offset: .16 },
          { transform: 'scale(1.2) translateY(-10px)', opacity: .92, filter: 'brightness(.8)', offset: .5 },
          { transform: 'scale(1.45) translateY(-46px)', opacity: 0, filter: 'brightness(.35) grayscale(.6)' }
        ],
        { duration: 1300, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () =>
        fb.remove();
    }
    // a column of smoke that lingers, leaning with the air (the rendered burn sends up its own thin smoke)
    if (!SPX()?.burn) for (let i = 0; i < 10; i++) { const p = place(PA ? fresh(pickOf(PA.puff)) : puffSVG(14), x + J(18), y - 6, [-26, -22, 52, 44]); p.style.filter = 'grayscale(.6) brightness(.86)';
      p.animate(
        [{ transform: 'scale(.5)', opacity: 0 }, { transform: `translate(${R(J(10))}px,-30px) scale(1.1)`, opacity: .8, offset: .2 }, { transform: `translate(${R(30 + J(30))}px,${R(-150 - rnd() * 90)}px) scale(2.3) rotate(${R(J(40))}deg)`, opacity: 0 }],
        { duration: 2800 + rnd() * 900, delay: 260 + i * 190, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' }).onfinish = () =>
        p.remove(); }
    // embers drifting up and down, slowly
    for (let i = 0; i < 22; i++) {
      const a = rnd() * 6.283, v = 120 + rnd() * 320, e = place(dot(0, 0, 1.2 + rnd() * 1.4, rnd() < .4 ? '#FFE7A8' : rnd() < .5 ? GOLD : '#EE8A3A'), x + J(20), y + J(14), [-4, -4, 8, 8]);
      e.animate(ballistic(Math.cos(a) * v, Math.sin(a) * v * .7 - 230, J(200), 240, 2.3), { duration: 2300 + rnd() * 900, easing: 'linear', fill: 'forwards' }).onfinish = () => e.remove(); }
  }
  if (!SPX()?.blast) { const flash = place(PA ? fresh(pickOf(PA.burst)) : burstSVG(46), x, y, [-75, -70, 150, 140]);
  flash.animate(
    [
      { transform: 'scale(1.7)', opacity: 1 },
      { transform: 'scale(1.7)', opacity: 1, offset: .06 },
      { transform: 'scale(.9)', offset: .3 },
      { transform: 'scale(1.05)', offset: .55 },
      { transform: 'scale(.4) rotate(12deg)', opacity: 0 }
    ],
    { duration: D(820), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () =>
    flash.remove();
  puffs(x, y, 9, 46, 52); }
  debris(x, y, 18, 1.2);
  // the mark it leaves: the page shattered open onto the back end (no scorch: a clean break)
  if (SPX()?.shatter) { const cv = mark(liveCanvas('chb-burn')), bn = SPX().shatter(cv, x, y + 4, 88, { reduce, hot: .95 }); run(cv, bn); backEnd(bn.outline, cv, x, y + 4); }
  else if (SPX()?.burn) { const cv = mark(liveCanvas('chb-burn')), bn = SPX().burn(cv, x, y + 4, 58, { reduce }); run(cv, bn); if (bn.outline) backEnd(bn.outline, cv, x, y + 4); }
  else { stain(x, y + 8, 160, 104, '36,26,14', .52, J(12)); stain(x + 4, y + 6, 82, 54, '22,16,10', .58, J(20)); mark(place(PA ? fresh(pickOf(PA.scar)) : scarSVG(50), x, y + 4, [-95, -62, 190, 124])); }
  if (!reduce && !SPX()?.burn && !SPX()?.shatter) { // little flames lick along the burnt edge, then go out in a breath of smoke
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.283 + J(.3), f = place(flameSVG(), x + Math.cos(a) * 44, y + 4 + Math.sin(a) * 26, [-6, -11, 12, 19]), life = 2200 + rnd() * 1800;
      f.style.transformOrigin = '50% 90%';
      f.animate(
        [
          { transform: 'scale(0)' },
          { transform: 'scale(1.1,1.25)', offset: .06 },
          { transform: 'scale(.9,.8) rotate(-8deg)', offset: .2 },
          { transform: 'scale(1.05,1.2) rotate(6deg)', offset: .36 },
          { transform: 'scale(.85,.9) rotate(-5deg)', offset: .52 },
          { transform: 'scale(1,1.1) rotate(4deg)', offset: .7 },
          { transform: 'scale(0)', opacity: .6 }
        ],
        { duration: life, delay: 300 + rnd() * 400, easing: 'ease-in-out', fill: 'both' }).onfinish = () => {
        f.remove();
        puffs(x + Math.cos(a) * 44, y + Math.sin(a) * 26 - 6, 1, 8, 30);
      }; }
  }
  // the letters in the blast are thrown, bounce and pile up on the floor; those the shockwave reaches further out are
  // knocked askew and stay that way
  // (a burst this size goes in two tasks, a frame apart, which nobody can see; the jolt waits for the second so bullet time takes every letter)
  if (!ready) bordersNear(x, y, R0 * 2.3);
  const thrown = ready ? ready.solid : allThings(lettersNear(x, y, R0 * 2.3, undefined, true, blast(520)), 520, (p, q) => p.d - q.d).sort((p, q) => p.d - q.d),
    rest = thrown.splice(Math.ceil(thrown.length / 2)),
    throwOne = ({ s: l, r, d, cx, cy }) => {
    const a = Math.atan2(cy - y, cx - x);
    if (d <= R0) {
      const f = (1 - d / R0) * .75 + .35, [k, dur] = toss(cx, cy, Math.cos(a) * f * 780 + J(90), Math.sin(a) * f * 520 - 560 * f - 120 + J(60), J(900), r.height);
      keep(l, r, k, dur, 'linear');
    }
    else {
      const f = 1 - (d - R0) / (R0 * 1.3), push = 3 + 11 * f;
      keep(l, r, [{ transform: 'none' }, { transform: `translate(${R(Math.cos(a) * push * 1.6)}px,${R(Math.sin(a) * push - 4 * f)}px) rotate(${R(J(16) * f)}deg)`, offset: .4 }, { transform: `translate(${R(Math.cos(a) * push)}px,${R(Math.sin(a) * push * .6)}px) rotate(${R(J(12) * f)}deg)` }], 420, 'cubic-bezier(.2,.9,.3,1)', (d - R0) / 1.1);
    } };
  if (ready?.flying.length) { // (bullet time reaches the canvas too: it holds for the hit, runs slow for a beat, then catches up)
    const cv = document.createElement('canvas'), fl = SPX().flock(cv, ready.flying, { onGo: pieceGoes, onLand: pieceLands });
    layer.append(cv);
    let t = 0, last = performance.now();
    const start = last;
    const tick = now => {
      if (!cv.isConnected) return;
      const since = now - start;
      t += (now - last) / 1000 * (since < 70 ? 0 : since < 450 ? .3 : 1);
      last = now;
      fl.frame(t);
      if (fl.done) cv.remove(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  thrown.forEach(throwOne); later(() => { rest.forEach(throwOne); reachLines(x, y, R0 * .8, R0 * 2.3); shake('bomb'); hitStop(70); slowmo(.3, 380); shown(); }, 0);
}
// ---------------------------------------------------------------- hammer: cracks like glass, with the data in the cracks
function crackSVG(r) {
  let out = '', defs = ''; const id = 'chbK' + (++uid), tips = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 6.2832 + J(.3);
    let p = [0, 0], d = 'M0 0';
    const len = r * (.75 + rnd() * .4);
    for (let k = 1; k <= 4; k++) { const aa = a + J(.35); p = [p[0] + Math.cos(aa) * len / 4, p[1] + Math.sin(aa) * len / 4]; d += `L${R(p[0])} ${R(p[1])}`; }
    tips.push(a);
    defs += `<path id="${id}${i}" d="${d}"/>`; out += inkP(d, 1.3, .75); if (i % 2 === 0) out += `<text class="chb-flicker" style="animation-delay:${R(rnd() * 3)}s" font-size="5.6" fill="${DATAINK}" ${MONO} dy="-1"><textPath href="#${id}${i}" startOffset="6">${bits(Math.round(len / 4))}</textPath></text>`; }
  for (const rr of [r * .35, r * .7]) out += inkP(lin(tips.map(a => [Math.cos(a) * rr * (1 + J(.15)), Math.sin(a) * rr * (1 + J(.15))])), 1, .5);
  return `<defs>${defs}</defs><path d="${closed(ring(0, 0, 5, 4, 7, .2))}" fill="${VOID}"/>` + out;
}
// the impact frame: a flash of paper with ink lines bursting out of it (two frames, as a drawn hit is shown)
const impactSVG = r => {
  let out = `<path d="${closed(ring(0, 0, r * .3, r * .3, 9, .12))}" fill="${PAPER}"/>`;
  for (let i = 0; i < 20; i++) { const a = i / 20 * 6.2832 + J(.12), r0 = r * (.34 + rnd() * .1), r1 = r * (.72 + rnd() * .38), w = 1.1 + rnd() * 2.3, nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
  out += `<path d="M${R(Math.cos(a) * r0 + nx)} ${R(Math.sin(a) * r0 + ny)}L${R(Math.cos(a) * r1)} ${R(Math.sin(a) * r1)}L${R(Math.cos(a) * r0 - nx)} ${R(Math.sin(a) * r0 - ny)}Z" fill="${INK}"/>`; } return out; };
// a shard of the page: a torn polygon of paper, its edge inked
const shardSVG = () => {
  const n = 3 + (rnd() * 2 | 0), p = [];
  for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + J(.5), rr = 6 + rnd() * 9; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return `<path d="${lin(off(p, 1.4, 1.8))}" fill="#CFC2AC" opacity=".55"/><path d="${lin(p)}" fill="#FFFFFF"/><path d="${lin(p)}" fill="none" stroke="#D9D4C8" stroke-width=".8"/>`;
};
function hammer(x, y) {
  // where it struck before, it strikes harder: a second blow spreads the crack, a third shatters the page there
  let hit = HITS.find(h => Math.hypot(h.x - x, h.y - y) < 40); if (!hit) HITS.push(hit = { x, y, n: 0 }); const n = Math.min(3, ++hit.n);
  breakPins((px, py) => Math.hypot(px - x, py - y) < 36, 'pop', () => reduce ? 0 : 480);
  const g = place(ART.hammer(), x + 6, y - 2, [-24, -14, 42, 68]); g.style.transformOrigin = '50% 95%';
  // the swing: raised, drawn back further (the wind-up), then down hard, a rebound, away
  g.animate(
    [
      { transform: 'translate(26px,-24px) rotate(-70deg)' },
      { transform: 'translate(36px,-38px) rotate(-98deg)', offset: .46, easing: 'cubic-bezier(.7,0,1,.6)' },
      { transform: 'none', offset: .62 },
      { transform: 'translate(2px,-6px) rotate(-10deg)', offset: .74 },
      { transform: 'translate(30px,-30px) rotate(-70deg)', opacity: 0 }
    ],
    { duration: D(820), fill: 'forwards' }).onfinish = () =>
    g.remove();
  if (!reduce) { // the smear of the fast swing: three ink arcs that flash and fade
    let d = '';
    for (const [rad, w, o] of [[50, 3.2, .5], [57, 2.4, .34], [64, 1.6, .2]]) {
      let path = '';
      for (let i = 0; i <= 10; i++) {
        const u = i / 10, th = (-98 + 90 * u) * Math.PI / 180, px = 6 + 36 * (1 - u) + rad * Math.sin(th), py = 48 - 38 * (1 - u) - rad * Math.cos(th);
        path += (i ? 'L' : 'M') + R(px) + ' ' + R(py);
      }
      d += inkP(path, w, o);
    }
    const sm = place(d, x, y, [-90, -90, 180, 180]);
    sm.animate([{ opacity: 0 }, { opacity: 0, offset: .48 }, { opacity: 1, offset: .58 }, { opacity: 0, offset: .7 }, { opacity: 0 }], { duration: 820, fill: 'forwards' }).onfinish = () => sm.remove();
  }
  later(() => strike(x, y, n), reduce ? 0 : 508);
}
function strike(x, y, n) {
  const rad = 64 + n * 22;
  if (!reduce) {
    const f = place(impactSVG(58 + n * 18), x, y, [-110, -110, 220, 220]);
    f.animate([{ opacity: 1 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: 95, fill: 'forwards' }).onfinish = () => f.remove();
    const rp = place(`<circle r="40" fill="none" stroke="${PAPER}" stroke-width="5" opacity=".85"/><circle r="40" fill="none" stroke="${INK}" stroke-width="1" opacity=".3"/>`, x, y, [-42, -42, 84, 84]);
    rp.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: `scale(${R(rad * 1.7 / 40)})`, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.1,.6,.3,1)', fill: 'forwards' }).onfinish = () =>
      rp.remove();
  }
  let c; if (SPX()?.crackStar) { // the page cracks: a star of cracks, longer and webbed with each blow on the same spot, broken through on the third
    const hit = HITS.find(h => Math.hypot(h.x - x, h.y - y) < 40), hx = hit ? hit.x : x, hy = hit ? hit.y : y;
    hit?.cv?.remove();
    hit?.hole?.remove();
    c = mark(liveCanvas('chb-dent'));
    if (hit) { hit.cv = c; if (hit.seed == null) hit.seed = rnd(); }
    if (n >= 3 && SPX().shatter) { const bn = SPX().shatter(c, hx, hy, 40, { reduce }); run(c, bn); const h2 = backEnd(bn.outline, c, hx, hy); if (hit) hit.hole = h2; }
    else run(c, SPX().crackStar(c, hx, hy, 66, n, { reduce, seed: hit ? hit.seed : rnd() })); }
  else if (SPX()?.dent) {
    const hit = HITS.find(h => Math.hypot(h.x - x, h.y - y) < 40);
    hit?.cv?.remove();
    c = mark(liveCanvas('chb-dent'));
    if (hit) hit.cv = c;
    run(c, SPX().dent(c, x, y, 60 + n * 12, n));
  }
  else { c = mark(place(n >= 2 ? crackSVG(70 + n * 18) : PA ? fresh(pickOf(PA.crack)) : crackSVG(54), x, y, [-130, -130, 260, 260])); c.style.transform = `rotate(${R(J(40))}deg)`;
  c.animate(
    [{ transform: c.style.transform + ' scale(.3)', opacity: .5 }, { transform: c.style.transform + ' scale(1.08)', opacity: 1, offset: .6 }, { transform: c.style.transform }],
    { duration: D(260 + n * 60), easing: 'ease-out' }); }
  hitStop(40 + n * 25);
  if (n >= 3) shatter(x, y);
  else for (const { s, r, d } of lettersNear(x, y, rad, undefined, true, { cap: PIECES, letters: PIECES })) {
    const f = 1 - d / rad;
    keep(
      s,
      r,
      [
        { transform: 'none' },
        { transform: `translate(${R(J(4) * f)}px,${R(-(8 + rnd() * 16) * f * n)}px) rotate(${R(J(24) * f)}deg)`, offset: .32, easing: 'ease-out' },
        { transform: `translate(${R(J(6) * f)}px,${R((3 + rnd() * 5) * f * n)}px) rotate(${R(J(30) * f)}deg)`, offset: .7, easing: 'ease-in' },
        { transform: `translate(${R(J(5) * f)}px,${R((2 + rnd() * 4) * f * n)}px) rotate(${R(J(26) * f)}deg)` }
      ],
      560);
  }
  // chips of paper jump out and land on the floor
  if (!reduce)
    for (let i = 0; i < 4 + n * 3; i++) {
      const a = -Math.PI / 2 + J(1.4), v = 260 + rnd() * 260 * n, ch = mark(place(shardSVG(), x + J(8), y + J(6), [-16, -16, 32, 32])), [k, dur] = toss(x, y, Math.cos(a) * v, Math.sin(a) * v, J(900), 8);
      ch.style.transform = 'scale(.45)';
      ch.animate(k.map(f => ({ transform: f.transform + ' scale(.45)' })), { duration: dur, easing: 'linear', fill: 'forwards' });
    }
  if (!SPX()?.dent) { dent(x, y, 58 + n * 14); stain(x, y + 2, 66 + n * 14, 54 + n * 10, '90,80,66', .2 + n * .05, J(30)); }
  light(x, y, 64 + n * 16, '255,250,236', 240, .8);
  if (!SPX()?.dent) puffs(x, y + 6, 3 + n * 2, 22 + n * 6, 18);
  reachLines(x, y, 34 + n * 14, rad + 44, 'drop'); shake(n >= 3 ? 'hammer3' : n === 2 ? 'hammer2' : 'hammer'); shown();
}
// the third blow: the page gives way. Its letters there drop to the floor, shards of it fall after them, and the hole
// shows the back end
function shatter(x, y) {
  if (!SPX()?.dent)
    mark(place(PA ? fresh(pickOf(PA.scar)) : scarSVG(50), x, y, [-95, -62, 190, 124])).animate(
      [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'none' }],
      { duration: D(260), easing: 'ease-out', fill: 'backwards' });   // (the third rendered dent tears its own hole)
  const nearHit = [];
  for (const l of moved) {
    const c = l._c;
    if (!c || l._halves || !c.isConnected) continue;
    const b = c.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    if (Math.hypot(cx - x, cy - y) <= 96) nearHit.push({ c, b, cx, cy, cur: getComputedStyle(c).transform, running: c.getAnimations() });
  }
  for (const { c, b, cx, cy, cur, running } of nearHit) {
    const mid = cur === 'none' ? '' : cur, [k, dur] = toss(cx, cy, J(160), -60 - rnd() * 120, J(500), b.height, mid);
    running.forEach(a => a.cancel());
    c.style.transform = mid;
    c.animate(k, { duration: D(dur), easing: 'linear', fill: 'forwards' });
  }
  for (const { s: l, r, cx, cy } of lettersNear(x, y, 96, undefined, false, { cap: PIECES, letters: PIECES })) {
    const [k, dur] = toss(cx, cy, J(160), -60 - rnd() * 160, J(500), r.height);
    keep(l, r, k, dur, 'linear', rnd() * 120);
  }
  if (!reduce)
    for (let i = 0; i < 14; i++) {
      const sx = x + J(60), sy = y + J(36), sc = .7 + rnd() * .7, sd = mark(place(shardSVG(), sx, sy, [-16, -16, 32, 32])), [k, dur] = toss(sx, sy, J(220), -80 - rnd() * 200, J(700), 10);
    sd.animate(k.map(f => ({ transform: f.transform + ` scale(${R(sc)})` })), { duration: dur, delay: 60 + rnd() * 160, easing: 'linear', fill: 'both' }); }
}
// ---------------------------------------------------------------- laser cutter: drag; it cuts letters in half and lines through
// The cut and its glow are drawn a stretch at a time (play-space.js), so nothing on the page repaints with the length of the cut.
// Whatever the beam meets is cut: a letter, a picture, a button, a sidebar icon, each parted where the beam crossed it; ruled lines drop away.
let beam = null, cutSheet = null, cutGlow = null, cutRun = null, glowing = false, sheetMap = null, sweep = 0, fallTimer = 0, lastTip = [0, 0], falling = [];
const glowTick = now => {
  if (!cutGlow?.isConnected || !cutRun) { glowing = false; return; }
  cutRun.frame(now);
  if (cutRun.alive) requestAnimationFrame(glowTick); else { glowing = false; cutGlow.remove(); }
}, glowOn = () => { if (!cutGlow.isConnected) layer.append(cutGlow); if (!glowing && !reduce) { glowing = true; requestAnimationFrame(glowTick); } };
// does a stretch of beam pass through a box (grown by pad)? Clipped against its four sides, so a long fast move finds all it crossed
function crossed(r, ax, ay, bx, by, pad) {
  let from = 0, to = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - r.left + pad], [dx, r.right + pad - ax], [-dy, ay - r.top + pad], [dy, r.bottom + pad - ay]]) {
    if (!p) { if (q < 0) return false; continue; }
    const u = q / p;
    if (p < 0) { if (u > to) return false; if (u > from) from = u; } else { if (u < from) return false; if (u < to) to = u; }
  }
  return true;
}
// how far a point is from a stretch of beam
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
};
// the part of a w by h box on one side of the line through (px, py) along (dx, dy), as a clip-path
function sideOf(w, h, px, py, dx, dy, side) {
  const corners = [[0, 0], [w, 0], [w, h], [0, h]], at = ([cx, cy]) => side * (dx * (cy - py) - dy * (cx - px)), out = [];
  corners.forEach((c, i) => {
    const d = corners[(i + 1) % 4], u = at(c), v = at(d);
    if (u >= 0) out.push(c);
    if (u * v < 0) { const k = u / (u - v); out.push([c[0] + (d[0] - c[0]) * k, c[1] + (d[1] - c[1]) * k]); }
  });
  return out.length > 2 ? `polygon(${out.map(([u, v]) => `${R(u)}px ${R(v)}px`).join(',')})` : null;
}
function laser(x, y, first) {
  if (first || !beam) {
    if (!cutSheet?.isConnected) {
      cutSheet = mark(document.createElement('canvas'));
      cutGlow = document.createElement('canvas');
      layer.append(cutSheet);
      cutRun = SPX()?.cutter?.(cutSheet, cutGlow, { reduce }) || null;
      sheetMap = SPX()?.cutMap?.(innerWidth, innerHeight) || null;
    }
    beam = { last: [x, y], nozzle: place(`<g transform="translate(-31 0)">${ART.laser()}</g>`, 0, 0, [-58, -14, 66, 32]) }; }
  const [lx, ly] = beam.last, step = Math.hypot(x - lx, y - ly); beam.nozzle.style.transform = `translate(${R(x)}px,${R(y)}px)`; if (step < 2) return;
  // (over a hole there is nothing left to cut: the beam passes and leaves no mark)
  const air = sheetMap?.air(lx, ly) && sheetMap.air(x, y); if (cutRun) { cutRun.cut(lx, ly, x, y, air); glowOn(); } beam.last = [x, y]; if (air) return;
  // what the beam passes through is cut in two: the halves part along the cut and the lower one slips
  const onBeam = (cx, cy, r) => crossed(r, lx, ly, x, y, 9), dx = x - lx, dy = y - ly;
  for (const { s, r } of lettersNear((lx + x) / 2, (ly + y) / 2, step / 2 + 9, onBeam, false, { near: onBeam })) {
    // (a letter is cut when the beam passes its middle, as before: by its box, the lines above and below would go too)
    if (!s._thing && segDist(r.left + r.width / 2, r.top + r.height / 2, lx, ly, x, y) > 9) continue;
    // (a thing parts along the beam, through the point of it nearest the thing's middle, or through its middle if the beam only grazed it)
    const cs = s._type,
      mid = s._thing ? Math.max(0, Math.min(1, ((r.left + r.width / 2 - lx) * dx + (r.top + r.height / 2 - ly) * dy) / (step * step))) : 0,
      px = lx + dx * mid - r.left,
      py = ly + dy * mid - r.top,
      inside = px > 0 && px < r.width && py > 0 && py < r.height,
      cutAt = inside ? [px, py] : [r.width / 2, r.height / 2],
      half = top => {
      let c;
      if (s._thing)
        c = thingCopy(s, r);
      else {
        c = document.createElement('span');
        c.textContent = s.textContent;
        Object.assign(c.style, { position: 'absolute', left: r.left + 'px', top: r.top + 'px', font: cs.font, color: cs.color, lineHeight: r.height + 'px', whiteSpace: 'pre' });
      }
      c.style.clipPath = s._thing ? sideOf(r.width, r.height, cutAt[0], cutAt[1], dx, dy, (dx < 0 ? 1 : -1) * (top ? 1 : -1)) || 'none' : top ? 'inset(0 0 50% 0)' : 'inset(50% 0 0 0)';
      layer.insertBefore(c, cutSheet);
      return c;
    };
    // (the copies first: a thing's own style is read as it is copied, and must be read before it is hidden, or Put it back restores it hidden)
    const t = half(true), b = half(false); s.style.visibility = 'hidden'; moved.add(s); s._halves = [t, b];
    t.animate([{ transform: 'none' }, { transform: `translate(${R(J(1.5))}px,-1.5px) rotate(${R(J(s._thing ? 2 : 6))}deg)` }], { duration: D(300), fill: 'forwards' });
    b.animate([{ transform: 'none' }, { transform: `translate(${R(1 + J(2))}px,4px) rotate(${R(J(s._thing ? 3 : 10))}deg)` }], { duration: D(420), easing: 'cubic-bezier(.4,0,.6,1.4)', fill: 'forwards' });
  }
  breakLines(x, y, 5, 'drop'); if (sheetMap?.line(lx, ly, x, y) && !sweep) sweep = setTimeout(sweepCuts, 50); if (PINS.length) breakPins((px, py) => Math.hypot(px - x, py - y) < 16); shown();
}
// what the cuts have freed is worked out off the path of a frame (play-space.js, cutMap), when the beam meets an older cut and when it lifts; the pieces then go one at a time, nearest the beam first
function sweepCuts() {
  sweep = 0;
  if (!sheetMap) return;
  const tip = beam?.last || lastTip, found = sheetMap.free();
  if (!found.length) return;
  found.sort((p, q) => Math.hypot(p.x - tip[0], p.y - tip[1]) - Math.hypot(q.x - tip[0], q.y - tip[1]));
  found.at(-1).bare = found.bare;
  falling.push(...found);
  if (!fallTimer) fallNext();
}
function fallNext() {
  fallTimer = 0;
  const r = falling.shift();
  if (!r) return;
  const tip = beam?.last || lastTip;
  let hinge = r.poly[0], best = Infinity;
  for (const p of r.poly) { const d = Math.hypot(p[0] - tip[0], p[1] - tip[1]); if (d < best) { best = d; hinge = p; } }
  dropOut(r, hinge);
  if (r.bare?.length) cutRun?.clear?.(r.bare);
  if (falling.length) fallTimer = setTimeout(fallNext, falling.length > 6 ? 16 : 45);
}
// what the page is made of under a point: the first solid background there
const solidAt = (px, py) => {
  for (let el = document.elementsFromPoint?.(px, py)?.find(e => !e.closest(OURS + ',.chb-blend')); el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !/,\s*0\)$/.test(bg)) return { el, bg };
  }
  return null;
}, paperAt = (px, py) => solidAt(px, py)?.bg || PAPER;
// the piece tips on the last point that held it, then falls through the hole and away into the dark behind the page;
// the hole shows the back end (data, as the bomb's scar does), shaded on the side the light comes from
const inPoly = (poly, px, py) => {
  let o = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) o = !o; }
  return o;
};
function dropOut({ poly, inner, area, x: midX, y: midY, spots }, hinge) {
  let A = 0, cx = 0, cy = 0; for (let i = 0, n = poly.length; i < n; i++) { const [a, b] = poly[i], [c, d] = poly[(i + 1) % n], k = a * d - c * b; A += k; cx += (a + c) * k; cy += (b + d) * k; }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [a, b] of poly) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
  const w = x1 - x0, h = y1 - y0, path = [poly, ...inner].map(lin).join(''), inside = (px, py) => inPoly(poly, px, py) && !inner.some(p => inPoly(p, px, py));
  dataHole(poly, cutSheet, true);
  // (a sliver only opens: the flash is the whole of it)
  if (area < (LOW || falling.length > 10 ? 1500 : 300)) { cutRun?.spit(hinge[0], hinge[1], 6, 26); if (cutRun) glowOn(); return; }
  // the piece: the paper and all it carries, seen only through the hole it leaves. It is made of what it was cut from: the biggest solid background under it, with the others that were under it laid on
  const wrap = mark(document.createElement('div'));
  Object.assign(wrap.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: innerWidth + 'px',
    height: innerHeight + 'px',
    clipPath: `path('${path}')`,
    perspective: '760px',
    perspectiveOrigin: `${R(cx)}px ${R(cy)}px`
  });
  layer.insertBefore(wrap, cutSheet);
  const piece = document.createElement('div');
  Object.assign(piece.style, { position: 'absolute', left: R(x0) + 'px', top: R(y0) + 'px', width: R(w) + 'px', height: R(h) + 'px', transformOrigin: `${R(hinge[0] - x0)}px ${R(hinge[1] - y0)}px` });
  wrap.append(piece);
  const grounds = new Map(); for (const [px, py] of [[midX, midY], ...spots]) { const at = solidAt(px, py); if (at) grounds.set(at.el, at.bg); }
  const under = [...grounds].map(([el, bg]) => ({ bg, r: el.getBoundingClientRect() })).sort((p, q) => q.r.width * q.r.height - p.r.width * p.r.height),
    box = `style="position:absolute;left:0;top:0;width:${R(w)}px;height:${R(h)}px"`;
  piece.innerHTML = `<svg viewBox="${R(x0)} ${R(y0)} ${R(w)} ${R(h)}" ${box}><path d="${path}" fill="${under[0]?.bg || PAPER}"/></svg>${under.slice(1).map(({ bg, r }) => `<div style="position:absolute;left:${R(r.left - x0)}px;top:${R(r.top - y0)}px;width:${R(r.width)}px;height:${R(r.height)}px;background:${bg}"></div>`).join('')}<svg viewBox="${R(x0)} ${R(y0)} ${R(w)} ${R(h)}" ${box}><path d="${path}" fill="none" stroke="#141622" stroke-width="2.6" stroke-opacity=".8"/><path d="${path}" fill="none" stroke="${GOLD}" stroke-width=".8" stroke-opacity=".7"/></svg>`;
  // the ruled lines under it go with it (the part under the hole needs no hiding: the hole covers it)
  probeLines(x0, y0, x1, y1, Math.max(60, w / 16), Math.max(24, h / 24));
  for (const list of ruled?.values() || [])
    for (const L of list) {
      if (L.pos < (L.h ? y0 : x0) || L.pos > (L.h ? y1 : x1)) continue;
      const lo = L.h ? x0 : y0, hi = L.h ? x1 : y1;
      for (const [a, b] of lines.get(L.el)?.[L.side]?.keepRanges || [[L.a, L.b]]) {
        const u = Math.max(a, lo), v = Math.min(b, hi);
        if (v <= u) continue;
        const c = document.createElement('div'), t = Math.max(1, L.w);
        Object.assign(
          c.style,
          { position: 'absolute', background: L.color },
          L.h ?
            { left: R(u - x0) + 'px', top: R(L.pos - t / 2 - y0) + 'px', width: R(v - u) + 'px', height: t + 'px' } :
            { left: R(L.pos - t / 2 - x0) + 'px', top: R(u - y0) + 'px', width: t + 'px', height: R(v - u) + 'px' });
        piece.append(c);
      }
    }
  // and so does what the beam cut on its way round: the part inside rides on the piece, the part outside stays where it was cut
  for (const s of moved) {
    const half = s._halves?.[0];
    if (!half) continue;
    const l = parseFloat(half.style.left), t = parseFloat(half.style.top);
    if (!(l < x1 && t < y1 && l > x0 - 500 && t > y0 - 500)) continue;
    const c = half.cloneNode(true);
    Object.assign(c.style, { left: R(l - x0) + 'px', top: R(t - y0) + 'px', clipPath: '' });
    piece.append(c);
  }
  for (const { s, r } of dotsInView(60)) if (inside(r.left, r.top)) piece.append(thingCopy(s, { ...r, left: r.left - x0, top: r.top - y0 }));
  // every word in it goes. Past the budget they go together in long runs, and what is left of a very big piece goes unseen, under the hole
  const touch = r => inside(r.left + r.width / 2, r.top + r.height / 2) || inside(r.left, r.top) || inside(r.right, r.top) || inside(r.left, r.bottom) || inside(r.right, r.bottom);
  for (const { s, r } of lettersNear(x0 +
    w / 2, y0 +
      h / 2,
      Math.hypot(w, h) / 2 + 4,
      inside,
      false,
      {
        near: (a, b, o) => touch(o),
        cap: PIECES,
        letters: PIECES,
        runs: LOW ? 90 : 160,
        rest: true,
        whole: b => inside(b.left, b.top) && inside(b.right, b.top) && inside(b.left, b.bottom) && inside(b.right, b.bottom)
      })) {
    if (s._ghost) { s.style.visibility = 'hidden'; moved.add(s); continue; }
    if (s._thing) { piece.append(thingCopy(s, { ...r, left: r.left - x0, top: r.top - y0 })); s.style.visibility = 'hidden'; moved.add(s); continue; }
    const cs = s._type, c = document.createElement('span');
    c.textContent = s.textContent;
    Object.assign(c.style, { position: 'absolute', left: R(r.left - x0) + 'px', top: R(r.top - y0) + 'px', font: cs.font, color: cs.color, lineHeight: r.height + 'px', whiteSpace: 'pre' });
    if (s.classList.contains('chb-run')) c.textContent = s.textContent.trim().replace(/\s+/g, ' ');
    piece.append(c);
    s.style.visibility = 'hidden';
    moved.add(s);
  }
  // it tips about the line through the hinge, square to the way the piece lies from it: the free side sinks first
  const ux = cx - hinge[0],
    uy = cy - hinge[1],
    L = Math.hypot(ux, uy) || 1,
    ax = R(-uy / L * 100) / 100,
    ay = R(ux / L * 100) / 100,
    sink = h * .26 + 14,
    tip = deg => `rotate3d(${ax},${ay},0,${deg}deg)`,
    drift = J(8),
    spin = J(16);
  // a beat still, a sag, a catch as the last fibre lets go, then gravity; it darkens as it turns from the light and fades far down
  piece.animate([{ transform: 'none', easing: 'ease-in-out' }, { transform: 'none', offset: .08, easing: 'cubic-bezier(.4,0,.6,1)' },
    { transform: tip(12), offset: .3, easing: 'ease-out' }, { transform: tip(9.5), offset: .37, easing: 'ease-in' },
    { transform: tip(11), offset: .42, easing: 'cubic-bezier(.5,0,1,.5)' },
    { transform: `translate3d(${R(drift * .75)}px,${R(sink * .8)}px,-430px) ${tip(44)} rotate(${R(spin * .75)}deg)`, opacity: 1, offset: .88 },
    { transform: `translate3d(${R(drift)}px,${R(sink)}px,-560px) ${tip(52)} rotate(${R(spin)}deg)`, opacity: 0 }],
    { duration: D(2000), easing: 'linear', fill: 'forwards' }).onfinish = () => wrap.remove();
  // (it turns from the light into the blue of the dark behind the page, never grey)
  const dim = document.createElement('div');
  Object.assign(dim.style, { position: 'absolute', inset: '-2px', background: '#10164A', opacity: '0' });
  piece.append(dim);
  dim.animate([{ opacity: 0 }, { opacity: 0, offset: .08 }, { opacity: .2, offset: .3 }, { opacity: .7, offset: .88 }, { opacity: .8 }], { duration: D(2000), fill: 'forwards' });
  // the moment it comes free: a spit of sparks and a flash at the last point
  cutRun?.spit(hinge[0], hinge[1], 16, 64); if (cutRun) glowOn();
}
// what a cut or a burn opens onto: the back end, streams of 0 and 1 in the dark, laid under the rim. One picture moved by the compositor
// and cut to the hole's shape (a sheet of live text here repainted the whole screen on every frame, for as long as the hole was there)
function dataHole(poly, before, shaded = false) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [a, b] of poly) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
  x0 = Math.floor(x0) - 2;
  y0 = Math.floor(y0) - 2;
  const w = Math.ceil(x1 - x0) + 4,
    h = Math.ceil(y1 - y0) + 4,
    scale = Math.min(LOW ? 1 : 1.5, globalThis.devicePixelRatio || 1),
    box = mark(document.createElement('div')),
    stream = document.createElement('canvas');
  Object.assign(box.style, {
    position: 'absolute',
    left: x0 + 'px',
    top: y0 + 'px',
    width: w + 'px',
    height: h + 'px',
    background: VOID,
    overflow: 'hidden',
    clipPath: poly.inner?.length ? `path('${[poly, ...poly.inner].map(p => lin(p.map(([a, b]) => [a - x0, b - y0]))).join('')}')` : `polygon(${poly.map(([a, b]) => `${R(a - x0)}px ${R(b - y0)}px`).join(',')})`
  });
  stream.width = Math.ceil(w * scale);
  stream.height = Math.ceil((h + 13) * scale);
  stream.className = 'chb-stream';
  Object.assign(stream.style, { position: 'absolute', left: '0', top: '-13px', width: w + 'px', height: h + 13 + 'px' });
  const g = stream.getContext?.('2d');
  if (g) {
    g.scale(scale, scale);
    g.font = "700 6.2px Consolas,'Courier New',monospace";
    for (let yy = 4; yy < h + 17; yy += 6.4) { g.fillStyle = rnd() < .25 ? DATA2 : DATA; g.globalAlpha = .38 + rnd() * .45; g.fillText(bits(Math.ceil(w / 3.4) + 5), J(3) - 6, yy); }
  }
  box.append(stream);
  if (shaded && g) {
    const k = w * h > 250000 ? .5 : 1, lid = document.createElement('canvas'), q = lid.getContext('2d');
    lid.width = Math.ceil(w * k);
    lid.height = Math.ceil(h * k);
    Object.assign(lid.style, { position: 'absolute', left: '0', top: '0', width: w + 'px', height: h + 'px' });
    q.scale(k, k);
    q.filter = `blur(${3.2 * k}px)`;
    q.fillStyle = 'rgba(0,0,0,.62)';
    q.beginPath();
    q.rect(-40, -40, w + 80, h + 80);
    for (const p of [poly, ...(poly.inner || [])]) { p.forEach(([a, b], i) => { const px = a - x0 + 5, py = b - y0 + 6; if (i) q.lineTo(px, py); else q.moveTo(px, py); }); q.closePath(); }
    q.fill('evenodd');
    box.append(lid);
  }
  layer.insertBefore(box, before); return box;
}
function backEnd(poly, before, cx, cy) {
  const hole = dataHole(poly, before);
  if (!reduce) {
    hole.style.transformOrigin = `${R(cx - parseFloat(hole.style.left))}px ${R(cy - parseFloat(hole.style.top))}px`;
    hole.animate([{ transform: 'scale(0)' }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.33,1,.68,1)' });
  }
  return hole;
}
function laserOff() {
  if (!beam) return;
  beam.nozzle.remove();
  cutRun?.stop();
  lastTip = beam.last;
  beam = null;
  if (sheetMap) { sheetMap.end(); clearTimeout(sweep); sweep = setTimeout(sweepCuts, 0); }
}
// ---------------------------------------------------------------- railgun: fired from the page edge, straight through, a trench of data behind it
// The stall a shot used to cost came from doing everything on the frame it fired. Now the page is read, split and copied while
// only the gun is moving (the compositor carries that), and the shot is drawing: the flying pieces are on one canvas, from
// tracks made ahead of time, and each copy, already in place, shows when its piece lands.
function railgun(x, y) {
  breakPins((px, py) => Math.abs(py - y) < 28, 'pop', () => reduce ? 0 : 960);
  const left = x < innerWidth / 2,
    x0 = left ? 6 : innerWidth - 6,
    dir = left ? 1 : -1,
    x1 = left ? innerWidth + 20 : -20,
    mx = x0 + dir * 66,
    CHARGE = reduce ? 0 : 900,
    SPEED = 9000,
    firesAt = performance.now() + CHARGE;
  const arcs = `<g class="chb-arcs">${[0, 1, 2].map(i => `<path d="M${3 + i * 8} -4l2 2-2 2 2 2-2 2" fill="none" stroke="${GOLD}" stroke-width="1.4" stroke-linecap="round" opacity="0"/>`).join('')}</g>`;
  const glows = [0, 8, 16].map(cx => `<path class="chb-coil" d="${closed(ring(cx, 0, 2, 8.6, 7, .03))}" fill="${PAPER}" opacity="0"/>`).join('');
  const gun = place(`<g transform="scale(${dir * 1.6} 1.6)">${ART.railgun()}${glows}${arcs}</g>`, x0 + dir * 36, y, [-44, -24, 88, 48]);
  gun.animate([{ transform: `translateX(${-dir * 70}px)` }, { transform: 'none', offset: .35, easing: 'cubic-bezier(.2,.8,.3,1)' }, { transform: 'none' }], { duration: D(900), fill: 'forwards' });
  shake('railcharge');
  if (!reduce) {
    gun.querySelectorAll('.chb-coil').forEach((c, i) => c.animate([{ opacity: 0 }, { opacity: .75, offset: .5 }, { opacity: .3 }], { duration: 260, delay: 300 + i * 120, fill: 'forwards' }));
    gun.querySelectorAll('.chb-arcs path').forEach((a, i) =>
      a.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 480 + i * 60, iterations: 2 })); }
  const HW = 34, a = Math.min(mx, x1), b = Math.max(mx, x1), start = left ? a : b; let drawn = null, view = null, pit = null, river = null, hot = null, takeLines = null; const flying = [], things = [];
  const aim = () => {
    probeLines(a, y - HW - 98, b, y + HW + 98, 44, 22);   // (before anything on the page changes: a hit test after a write lays the whole page out again)
    const held = copies = document.createDocumentFragment(),
      band = HW + 8,
      reach = HW + 90,
      inBand = r => r.top < y + band && r.bottom > y - band,
      inReach = r => r.top < y + reach && r.bottom > y - reach,
      away = r => Math.max(0, Math.abs(r.top + r.height / 2 - y) - r.height / 2 - band);
    const arrive = cx => Math.abs(cx - mx) / SPEED, ready = (s, r, cx, cy, track, t0) => readyPiece(flying, s, r, cx, cy, track, t0);
    for (const { s, r, cx, cy } of allThings(
      lettersNear(x, y, 9999, (cx, cy, r) => inBand(r), true, { ...blast(420, 200), near: (cx, cy) => Math.abs(cy - y) < band, rank: (cx, cy) => Math.abs(cy - y) }),
      420)) {
      const side = cy < y ? -1 : 1, vx = dir * (180 + rnd() * 420), vy = side * (160 + rnd() * 280) - 140, spin = J(800), t0 = arrive(cx);
      if (s._thing || s._line || s._dot || reduce || !SPX()?.rail) { const [k, dur] = toss(cx, cy, vx, vy, spin, r.height); things.push([s, r, k, dur, t0]); }
      else ready(s, r, cx, cy, railTrack(flight(cx, cy, vx, vy, spin, r.height)), t0);
    }
    for (const { s, r, cx, cy } of piecesNear(x, y, 9999, (cx, cy) => Math.abs(cy - y) >= HW + 8 && Math.abs(cy - y) < HW + 90, WORDS_IN_BLASTS ? 136 : 300)) {
      const side = cy < y ? -1 : 1, f = 1 - (Math.abs(cy - y) - HW - 8) / 82, t0 = arrive(cx);
      if (reduce || !SPX()?.rail) {
        things.push([s, r, [{ transform: 'none' }, { transform: `translate(${R(dir * 6 * f)}px,${R(side * (8 + rnd() * 8) * f)}px) rotate(${R(J(14) * f)}deg)`, offset: .35 }, { transform: `translate(${R(dir * 3 * f)}px,${R(side * (4 + rnd() * 5) * f)}px) rotate(${R(J(10) * f)}deg)` }], 420, t0, 'cubic-bezier(.2,.9,.3,1)']);
        continue;
      }
      const px = dir * 6 * f, py = side * (8 + rnd() * 8) * f, pa = J(.24) * f, ex = dir * 3 * f, ey = side * (4 + rnd() * 5) * f, ea = J(.17) * f, track = [];
      for (let i = 0; i <= 13; i++) {
        const u = i / 13, k = u < .35 ? 1 - (1 - u / .35) ** 3 : ((u - .35) / .65) * (2 - (u - .35) / .65);
        if (u < .35) track.push(px * k, py * k, pa * k); else track.push(lerp(px, ex, k), lerp(py, ey, k), lerp(pa, ea, k));
      }
      ready(s, r, cx, cy, track, t0);
    }
    // the rest of the page goes with it: pictures, buttons and bullets in the ring are shoved, and the ruled lines (borders, rules, a
    // sidebar's edge) go too, the stretch in the band flying and the stretch beside it pushed crooked; the rest of each line stays
    const shove = (s, r, f) => {
      const side = r.top + r.height / 2 < y ? -1 : 1;
      things.push([
        s,
        r,
        [{ transform: 'none' }, { transform: `translate(${R(dir * 6 * f)}px,${R(side * (8 + rnd() * 8) * f)}px) rotate(${R(J(10) * f)}deg)`, offset: .35 }, { transform: `translate(${R(dir * 3 * f)}px,${R(side * (4 + rnd() * 5) * f)}px) rotate(${R(J(7) * f)}deg)` }],
        420,
        arrive(r.left + r.width / 2),
        'cubic-bezier(.2,.9,.3,1)'
      ]);
    };
    const taken = new Set(things.map(t => t[0])); for (const { el, r } of thingBoxes()) if (!taken.has(el) && !moved.has(el) && inReach(r)) shove(el, r, 1 - away(r) / 82);
    for (const { s, r } of dotsInView()) {
      if (!inReach(r)) continue;
      if (inBand(r)) { const [k, dur] = toss(r.left, r.top, dir * (180 + rnd() * 300), (r.top < y ? -1 : 1) * (160 + rnd() * 240) - 140, J(600), r.height); things.push([s, r, k, dur, arrive(r.left)]); }
      else shove(s, r, 1 - away(r) / 82);
    }
    const lengths = [];
    for (const list of ruled.values())
      for (const L of list) { if (lines.get(L.el)?.[L.side]) continue; const from = Math.max(L.a, 0), to = Math.min(L.b, L.h ? innerWidth : innerHeight); if (to - from < 6) continue;
      if (L.h) { const off = Math.abs(L.pos - y); if (off < reach) lengths.push([L, from, to, off < band]); continue; }
      if (L.pos < a || L.pos > b) continue;
      const top = Math.max(from, y - reach), low = Math.min(to, y + reach);
      if (low <= top) continue;
      const in0 = Math.max(top, y - band), in1 = Math.min(low, y + band);
      if (top < in0) lengths.push([L, top, in0, false]);
      if (in1 > in0) lengths.push([L, in0, in1, true]);
      if (low > in1) lengths.push([L, in1, low, false]);
    }
    const room = LOW ? 70 : 170, total = lengths.reduce((n, [, c0, c1]) => n + c1 - c0, 0), rods = [];
    for (const [L, c0, c1, flies] of lengths) {
      const each = Math.max(flies ? 44 : 86, total / room), n = Math.ceil((c1 - c0) / each), len = (c1 - c0) / n, w = Math.max(1, L.w);
      for (let i = 0; i < n; i++) {
        const mid = c0 + (i + .5) * len, cx = L.h ? mid : L.pos, cy = L.h ? L.pos : mid, side = cy < y ? -1 : 1, t0 = arrive(cx), f = 1 - Math.max(0, Math.abs(cy - y) - band) / 82;
        rods.push({
          cx,
          cy,
          t0,
          w: L.h ? len + .5 : w,
          h: L.h ? w : len + .5,
          color: L.color,
          track: flies ?
            railTrack(flight(cx, cy, dir * (120 + rnd() * 360), side * (180 + rnd() * 320) - 120, J(500), 3)) :
            [0, 0, 0, dir * 3 * f, side * (9 + rnd() * 7) * f, J(.12) * f, dir * 4 * f, side * (12 + rnd() * 8) * f, J(.16) * f, dir * 3.5 * f, side * (10 + rnd() * 6) * f, J(.1) * f]
        }); } }
    takeLines = () => { for (const [L, c0, c1] of lengths) takeLine(L, c0, c1); };
    copies = null; if (!SPX()?.rail) return layer.append(held);
    const digits = reduce ? [] : [...Array(Math.round(120 * FX))].map(() => {
      const u = a + rnd() * (b - a), z = 7 + rnd() * 6;
      return {
        cx: u,
        cy: y,
        v: rnd() < .5 ? 0 : 1,
        c: rnd() < .3 ? 1 : 0,
        s: z,
        t0: .16 + Math.abs(u - start) / (b - a) * .26 + rnd() * .24,
        track: railTrack(flight(u, y, J(220), -(260 + rnd() * 520), J(720), 14))
      };
    });
    pit = document.createElement('div');
    river = document.createElement('div');
    hot = document.createElement('div');
    view = document.createElement('canvas');
    river.style.visibility = 'hidden';
    layer.append(pit, river, hot, held, view);
    drawn = SPX().rail(view, pit, hot, { mx, x1, y, hw: HW, pieces: flying, rods: reduce ? [] : rods, digits, river, reduce, onGo: pieceGoes, onLand: pieceLands });
    if (reduce) { view.remove(); return; }
    const draw = everyOther(), tick = now => { if (!view.isConnected) return; if (draw()) drawn.frame((now - firesAt) / 1000); if (drawn.done) mark(view); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  later(aim, reduce ? 0 : 34);
  later(() => {
    gun.animate([{ transform: 'none' }, { transform: `translateX(${-dir * 18}px)`, offset: .2 }, { transform: 'none' }], { duration: D(420), easing: 'cubic-bezier(.2,.8,.3,1)' });
    for (const [s, r, k, dur, delay, easing] of things) keep(s, r, k, dur, easing || 'linear', delay * 1000);
    for (const el of [pit, river, hot]) if (el) mark(el);
    if (river) { river.style.visibility = ''; river.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 260, fill: 'backwards' }); }
    if (drawn && !reduce) takeLines(); else for (let u = a; u < b; u += 16) breakLines(u, y, HW, 'out', .7, true);
    shake('railgun');
    gun.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(500), delay: D(500), fill: 'forwards' }).onfinish = () => gun.remove(); shown();
  }, CHARGE);
}
// ---------------------------------------------------------------- black hole: everything nearby spirals in, the page itself bends toward it; then it snaps shut
// The drawing, back to front: the far side of its disk, bent up over the top by the hole's gravity; the flat disk; the
// shadow with its thin photon ring; the near half of the disk crossing in front. The side turning toward us is brighter
// (as a real disk's is). Streaks race round the disk and wisps spiral in.
function holeSVG() {
  const id = 'chbH' + (++uid), band = (rx, ry, rx2, ry2) => {
    const o = [], n = 48;
    for (let i = 0; i <= n; i++) { const a = i / n * TAU; o.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
    const inn = [];
    for (let i = n; i >= 0; i--) { const a = i / n * TAU; inn.push([Math.cos(a) * rx2, Math.sin(a) * ry2]); }
    return 'M' + o.map(([x, y]) => `${R(x)} ${R(y)}`).join('L') + 'Z M' + inn.map(([x, y]) => `${R(x)} ${R(y)}`).join('L') + 'Z';
  };
  const arch = (r1, h1, r2, h2) => `M${-r1} 4C${R(-r1)} ${R(-h1 * 1.3)} ${R(r1)} ${R(-h1 * 1.3)} ${r1} 4L${r2} 4C${R(r2)} ${R(-h2 * 1.3)} ${R(-r2)} ${R(-h2 * 1.3)} ${-r2} 4Z`;
  const streaks = (rx, ry, k, cls = 'chb-streak') => [0, 1, 2].map(i => `<ellipse class="${cls}" style="animation-delay:${R(-i * .7 - rnd())}s;animation-duration:${R(1.1 + i * .5)}s" rx="${R(rx * (.62 + i * .17))}" ry="${R(ry * (.62 + i * .17))}" fill="none" stroke="${i ? '#FFE9B0' : '#FFF8E6'}" stroke-width="${R(1.6 - i * .3)}" stroke-linecap="round" stroke-dasharray="${k} ${k * 2.2}" pathLength="64" opacity="${R(.9 - i * .2)}"/>`).join('');
  const wisps = [0, 1, 2, 3, 4, 5].map(i => `<path class="chb-infall" style="animation-delay:${R(-i * .5)}s" d="M${R(120 * Math.cos(i))} ${R(40 * Math.sin(i))}C${R(80 * Math.cos(i + .9))} ${R(30 * Math.sin(i + .9))} ${R(40 * Math.cos(i + 1.8))} ${R(14 * Math.sin(i + 1.8))} 0 0" fill="none" stroke="#F3C969" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`).join('');
  return `<defs><linearGradient id="${id}d" x1="0" x2="1"><stop offset="0" stop-color="#FFF3CC"/><stop offset=".35" stop-color="#F6CF72"/><stop offset=".7" stop-color="#E58E3D"/><stop offset="1" stop-color="#B4532C"/></linearGradient>
<linearGradient id="${id}a" x1="0" x2="1"><stop offset="0" stop-color="#FFE7A6"/><stop offset=".5" stop-color="#F0B957"/><stop offset="1" stop-color="#C0612F"/></linearGradient><clipPath id="${id}f"><rect x="-140" y="0" width="280" height="60"/></clipPath></defs>
<path d="${arch(104, 70, 46, 40)}" fill="url(#${id}a)" transform="translate(1.6 1.4)" opacity=".55"/><path d="${arch(104, 70, 46, 40)}" fill="url(#${id}a)"/>${inkP(arch(104, 70, 46, 40), 1.4, .55)}
<g opacity=".85">${[0, 1].map(i => `<path class="chb-streak" style="animation-delay:${R(-i)}s" d="M${-90 + i * 18} 2C${-88 + i * 18} ${-82 + i * 14} ${88 - i * 18} ${-82 + i * 14} ${90 - i * 18} 2" fill="none" stroke="#FFF8E6" stroke-width="1.3" stroke-dasharray="5 9" pathLength="64"/>`).join('')}</g>
<path d="${band(124, 26, 44, 10)}" fill-rule="evenodd" fill="url(#${id}d)"/>${streaks(118, 24, 6)}
<circle r="40" fill="none" stroke="#FFF4CC" stroke-width="1" opacity=".5"/><circle r="35.5" fill="none" stroke="#FFF8E6" stroke-width="2.6"/>
<path d="${closed(ring(0, 0, 33, 33, 12, .02))}" fill="${VOID}"/>${inkP(over(ring(0, 0, 33.4, 33.4, 12, .02)), 1.6, .8)}
<g clip-path="url(#${id}f)"><path d="${band(124, 26, 44, 10)}" fill-rule="evenodd" fill="url(#${id}d)"/>${streaks(118, 24, 6)}</g>
${inkP(over(ring(0, 0, 124, 26, 16, .015)), 1.6, .7)}${inkP(over(ring(0, 0, 44, 10, 12, .02)), 1, .45)}<g opacity=".8">${wisps}</g>`;
}
function blackhole(x, y) {
  const R0 = 180, SP = globalThis.ReservePlaySpace; let g, disc, space = null, reach = R0, timeAt = () => 0, flockDraw = null;
  if (SP?.hole) { // it opens in the page: its pull reaches further and further, the page cracks and breaks in toward it (play-space.js)
    const cv = document.createElement('canvas'), dk = document.createElement('canvas'); cv.className = 'chb-space'; dk.className = 'chb-space-dark'; layer.prepend(cv); layer.append(dk);
    space = SP.hole(cv, x, y, { reduce, paper: paperAt(x, y), dark: dk, after: (ctx, t, K) => flockDraw?.(ctx, t, K) }); g = cv; reach = space.reachMax; timeAt = d => space.timeAt(d) * 1000;
    const t0 = performance.now(), draw = everyOther(), tick = now => {
      if (!cv.isConnected) { dk.remove(); return; }
      if (draw()) space.frame(reduce ? 2.6 * 2 : (now - t0) / 1000);
      if (space.done) { cv.remove(); dk.remove(); } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } else if (SP) { // the page tears open onto space: a rendered black hole in a canvas laid under the flying letters
    const cv = document.createElement('canvas');
    cv.className = 'chb-space';
    layer.prepend(cv);
    space = SP.open(cv, { size: Math.min(620, Math.max(420, innerWidth * .42)), reduce });
    Object.assign(cv.style, { position: 'absolute', left: R(x - space.W / 2) + 'px', top: R(y - space.H / 2) + 'px', pointerEvents: 'none' });
    g = cv;
    const t0 = performance.now(), draw = everyOther(), tick = now => {
      if (!cv.isConnected) return;
      if (draw()) space.frame(reduce ? 1.6 : (now - t0) / 1000);
      if (space.done) cv.remove(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  else {
    g = mark(place(holeSVG(), x, y, [-140, -100, 280, 170]));
    disc = glow(x, y, 120, '255,206,140', .42);
    if (!reduce) disc.animate([{ opacity: .55, transform: 'scale(.95)' }, { opacity: 1, transform: 'scale(1.05)' }, { opacity: .55, transform: 'scale(.95)' }], { duration: 2400, iterations: Infinity });
    g.animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.12)', offset: .7 }, { transform: 'none' }], { duration: D(600), easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  // Its pull reaches further as it grows: each letter goes when the pull reaches it, nearest first, more and more, and everything else
  // on the page with it: pictures, buttons, bullets and every ruled line, the sidebar's edge too, length by length. With the hole's own
  // canvas to draw on, the text is drawn there, so five hundred letters are not five hundred layers for ten seconds; a letter that
  // only leans keeps a copy, already in the place it ends up, that shows when the hole lets go of it.
  bordersNear(x, y, R0 * .8);
  // (with the hole proper its pull is the whole screen: the far field leans toward it before the pop, and after the burst nothing on screen is left)
  const whole = !!space?.popAt, screenFar = Math.max(Math.hypot(x, y), Math.hypot(innerWidth - x, y), Math.hypot(x, innerHeight - y), Math.hypot(innerWidth - x, innerHeight - y)) + 40;
  const leaning = [], edge = whole ? Math.max(reach * .9, screenFar - reach) : reach * .9, canvasText = !!space?.timeAt && !reduce, flock = [], left = []; let spareLines = [];
  // (before it pops a piece drifts in slowly; after, it is torn in)
  const fallMs = d => timeAt(d) < (space?.popAt ?? -1) ? 1200 + d * 2.6 : space?.popAt ? 340 + d * .7 : 1200 + d * 2.6;
  // the shock of the burst throws everything outward as it passes, before the pull takes it
  const blown = (el, d, cx, cy, size = 54) => {
    if (!space?.hitAt || reduce) return null;
    const a = Math.atan2(cy - y, cx - x), o = size * Math.max(.3, 1 - d / 1500);
    return el.animate(
      [{ transform: 'none' }, { transform: `translate(${R(Math.cos(a) * o)}px,${R(Math.sin(a) * o)}px)`, offset: .2 }, { transform: 'none' }],
      { duration: 640, delay: space.hitAt(d), easing: 'cubic-bezier(.2,.7,.3,1)', composite: 'add' });
  };
  const takeOne = ({ s, r, d, cx, cy }) => { const solid = s._thing || s._line || s._dot;
    if (d <= reach || (whole && reduce)) {
      if (!canvasText || solid) { const c = fly(s, r, spiral(cx - x, cy - y), space?.timeAt ? fallMs(d) : 700 + d * 7, timeAt(d)); blown(c, d, cx, cy); return; }
      const t = s._type || typeOf(s);
      moved.add(s);
      s._home = () => spiral(cx - x, cy - y);
      s._d = fallMs(d);
      s._c?.remove();
      delete s._c;
      flock.push({ s, cx, cy, d, a0: Math.atan2(cy - y, cx - x), t0: timeAt(d) / 1000, dur: fallMs(d) / 1000, text: caseOf(s, t), font: t.font, color: t.color, h: r.height });
      return;
    }
    // further out: pulled a little way in, turned and drawn out toward it (stretched along the pull)
    const f = Math.max(whole ? .2 : 0, 1 - (d - reach) / edge), a = Math.atan2(y - cy, x - cx), deg = R(a * 180 / Math.PI), pull = 4 + 16 * f;
    if (canvasText && !solid) {
      const t = s._type || typeOf(s), old = s._c;
      moved.add(s);
      delete s._c;
      flock.push({ s, old, cx, cy, d, lean: true, a, f, pull, turn: J(.31) * f, t0: timeAt(Math.min(d, reach * 1.3)) * .6 / 1000, text: caseOf(s, t), font: t.font, color: t.color, h: r.height });
      return;
    }
    const held = keep(
      s,
      r,
      [{ transform: 'none' }, { transform: `translate(${R(Math.cos(a) * pull)}px,${R(Math.sin(a) * pull)}px) rotate(${deg}deg) scaleX(${R(1 + .7 * f)}) rotate(${-deg}deg) rotate(${R(J(18) * f)}deg)` }],
      space?.timeAt ? 5200 : 900 + rnd() * 500,
      space?.timeAt ? 'cubic-bezier(.6,0,.9,.5)' : 'cubic-bezier(.4,0,.2,1)',
      space?.timeAt ? timeAt(Math.min(d, reach * 1.3)) * .6 : 0);
    blown(held, d, cx, cy);
    leaning.push({ c: held, a, f, s });
  };
  let swept = false;
  const sweep = () => { if (swept) return; swept = true; for (const { c, s } of leaning.splice(0)) { c.getAnimations().forEach(a => a.cancel()); c.remove(); if (s._c === c) delete s._c; }
    for (const s of left) {
      if (s._dot) { if (!dots.has(s._dot.li)) { dots.set(s._dot.li, s._dot.inline); s._dot.li.style.listStyleType = 'none'; } continue; }
      if (moved.has(s) && !s._c) continue;
      if (s._thing || !s.classList?.contains('chb-ch')) { s._thing = true; if (s._style === undefined) s._style = s.getAttribute?.('style') ?? null; }
      s._ghost = true;
      s._c?.remove();
      delete s._c;
      s.style.visibility = 'hidden';
      moved.add(s);
    }
    left.length = 0; for (const L of spareLines) hideLine(L);
    // and the blocks themselves: what is drawn as a panel, a background or a pseudo-element (an open dock's paper, a logo, a badge's circle) has no
    // word or picture to take. Only its visibility is kept for Put it back: the pull has written its transform since. (Not our edge handle, so the dock can still be brought out.)
    for (const el of pageBlocks()) { if (hushed.has(el) || el.matches?.('.chn-edge')) continue; hushed.set(el, el.style.visibility); el.style.visibility = 'hidden'; } };
  const aimHole = () => {
    const held = copies = document.createDocumentFragment(),
      found = lettersNear(
        x,
        y,
        whole ? screenFar : reach + edge,
        undefined,
        true,
        LOW ? { cap: 312, cover: 1100, letters: 0, flat: true, runs: 200, rest: whole } : { cap: 520, cover: 2800, letters: 300, flat: true, runs: 240, rest: whole }),
      taken = allThings(found.filter(p => !p.s._ghost), 760, (p, q) => p.d - q.d),
      box = p => {
      const cx = p.r.left + p.r.width / 2, cy = p.r.top + p.r.height / 2;
      return { ...p, cx, cy, d: Math.hypot(cx - x, cy - y) };
    };
    // (what no budget carries goes at the burst behind the black, unseen: no copy, no flight)
    if (whole) { const on = new Set(taken); for (const p of found) if (!on.has(p)) left.push(p.s); for (const { el } of thingSpare) left.push(el); }
    const bullets = dotsInView(whole ? 400 : 40).map(box); if (whole) for (const p of bullets.splice(40)) left.push(p.s);
    taken.forEach(takeOne);
    bullets.forEach(takeOne);
    for (const p of linesInView().map(box)) takeOne(p);
    spareLines = linesSpare;
    copies = null;
    layer.insertBefore(held, g.nextSibling);
    if (!flock.length) return; const sheet = SP.textSheet(flock), order = [...flock].sort((p, q) => p.t0 - q.t0), CLOSE = (space.closeAt || 4800) / 1000; let next = 0;
    // (against open space the words are lit by the burst: the same sheet in one light colour)
    const lit = document.createElement('canvas');
    lit.width = sheet.width;
    lit.height = sheet.height;
    { const q = lit.getContext?.('2d'); if (q) { q.drawImage(sheet, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = '#FFE9C8'; q.fillRect(0, 0, lit.width, lit.height); } }
    for (const p of flock) p.hit = (space.hitAt?.(p.d) ?? 1e9) / 1000;
    flockDraw = (ctx, t, K) => {
      if (whole && t * 1000 > space.popAt + 130) sweep();
      while (next < order.length && order[next].t0 <= t) { const p = order[next++]; p.old?.remove(); p.s.style.visibility = 'hidden'; loosen(p.s); }
      const e0 = ctx.getTransform();
      const charge = space.energyAt?.(t * 1000) ?? 0;
      for (const p of flock) {
        const u = t - p.t0;
        if (u < 0 || p.gone) continue;
        const e = p.e, h = t - p.hit, blow = h > 0 ? 1500 * h * Math.exp(-h * 6) * Math.max(.3, 1 - p.d / 1500) : 0, ink = h > 0 ? lit : sheet;
        if (!p.lean) {
          const v = u / p.dur;
          if (v >= 1) { p.gone = true; continue; }
          const q = v * v,
            rr = p.d * (1 - q) + blow,
            an = p.a0 + 8.8 * q,
            torn = h > 0,
            FLAT = space.flat || .3,
            lie = torn ? Math.min(1, h * 2.8) : 0,
            turn = torn ? Math.atan2(Math.cos(an) * FLAT, -Math.sin(an)) : 8.8 * q,
            sx = torn ? 1 + (2 + 7 * lie) * Math.min(1, v * 2.2) : 1 - q * .9,
            sy = torn ? Math.max(.1, 1 - Math.min(1, lie + v) * .9) : 1 - q * .9,
            rim = torn ? (space.radius || 0) * 3.2 : 0,
            fade = torn && rim ? Math.max(0, Math.min(1, (rr - rim) / rim)) : 1;
          if (!fade) continue;
          ctx.globalAlpha = (v < .85 ? 1 : (1 - v) / .15) * fade;
          const c = Math.cos(turn), n = Math.sin(turn), A = c * sx, B = n * sx, C = -n * sy, D = c * sy, px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * lerp(1, FLAT, lie);
          ctx.setTransform(e0.a * A + e0.c * B, e0.b * A + e0.d * B, e0.a * C + e0.c * D, e0.b * C + e0.d * D, e0.a * px + e0.c * py + e0.e, e0.b * px + e0.d * py + e0.f);
          ctx.drawImage(ink, e.x, e.y, e.w, e.h, -e.dw / 2, -e.dh / 2, e.dw, e.dh);
          continue;
        }
        const late = t - CLOSE,
          k = Math.min(1, u / 5.2),
          hard = 1 + 2.4 * Math.min(1, Math.max(0, (t - (space.popAt || 0) / 1000) / .5)) + charge * .8,
          pull = k * k * (3 - 2 * k) * k * hard,
          back = late > 0 ? Math.min(1, late / .52) : 0,
          ease = 1 - (1 - back) ** 3;
        if (back >= 1) { p.gone = true; continue; }
        const buzz = Math.sin(t * 84 + p.cx) * charge * 2.4 * (h > 0 ? 0 : 1),
          dx = Math.cos(p.a) * (p.pull * pull - blow) + buzz,
          dy = Math.sin(p.a) * (p.pull * pull - blow) + buzz,
          rot = p.turn * pull,
          long = 1 + .7 * p.f * pull;
        ctx.setTransform(e0);
        const sag = h > .2 ? Math.min(1, (h - .2) / .9) : 0, line = sag * sag * (3 - 2 * sag);
        if (line > 0) {
          const FLAT = space.flat || .3,
            ox = p.cx + dx - x,
            oy = (p.cy + dy - y) / FLAT,
            r = Math.hypot(ox, oy) || 1,
            at = Math.atan2(oy, ox) + (h - .2) * 34 / Math.sqrt(r),
            len = (p.long ??= (70 + ((p.cx * 7.3 + p.cy * 3.1) % 1 + 1) % 1 * 300) / Math.max(8, e.dw)),
            along = Math.atan2(Math.cos(at) * FLAT, -Math.sin(at));
          ctx.globalAlpha = (1 - .42 * line) * (1 - ease);
          ctx.translate(lerp(p.cx + dx, x + Math.cos(at) * r, line), lerp(p.cy + dy, y + Math.sin(at) * r * FLAT, line));
          ctx.rotate(lerp(rot, along, line));
          ctx.scale(1 + len * line, Math.max(.1, 1 - .9 * line));
          ctx.drawImage(ink, e.x, e.y, e.w, e.h, -e.dw / 2, -e.dh / 2, e.dw, e.dh);
          continue;
        }
        ctx.globalAlpha = 1 - ease;
        ctx.translate(p.cx + dx, p.cy + dy);
        ctx.rotate(p.a);
        ctx.scale(long, 1);
        ctx.rotate(rot - p.a);
        ctx.drawImage(ink, e.x, e.y, e.w, e.h, -e.dw / 2, -e.dh / 2, e.dw, e.dh);
      }
      ctx.setTransform(e0); ctx.globalAlpha = 1; }; };
  if (space?.timeAt)
    later(aimHole, reduce ? 0 : 34);
  else {
    const taken = lettersNear(x, y, reach + edge, undefined, true, blast(520)).sort((p, q) => p.d - q.d).slice(0, 520), rest = taken.splice(Math.ceil(taken.length / 2));
    taken.forEach(takeOne);
    later(() => rest.forEach(takeOne), 0);
  }
  // (spiral() takes the vector from the hole to the letter, so the letters fall in)
  // the page itself bends toward it: each block near it is drawn in, turned and shrunk a little (springs back when it closes)
  const pulled = []; if (!reduce) for (const el of pageBlocks()) {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = Math.hypot(cx - x, cy - y);
    if ((!whole && d > 700) || r.width * r.height > innerWidth * innerHeight * .7) continue;
    const f = Math.max(whole ? .1 : 0, 1 - d / 700), a = Math.atan2(y - cy, x - cx), prev = { t: el.style.transform, o: el.style.transformOrigin };
    el.style.transformOrigin = `${R(x - r.left)}px ${R(y - r.top)}px`;
    const strong = SP?.hole ? 1.6 : 1,
      own = ownMove(el),
      an = el.animate(
        [{ transform: own || 'none' }, { transform: `${own}translate(${R(Math.cos(a) * 26 * f * strong)}px,${R(Math.sin(a) * 26 * f * strong)}px) rotate(${R((cx < x ? 1 : -1) * 3 * f * strong)}deg) scale(${R((1 - .05 * f * strong) * 1000) / 1000})` }],
        { duration: D(SP?.hole ? 10600 : 1800), easing: SP?.hole ? 'cubic-bezier(.6,0,.9,.55)' : 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    folds.push({ el, a: an, prev, own }); pulled.push({ el, an, prev, own }); }
  if (space?.hitAt && !reduce)
    for (const el of pageBlocks()) {
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, a = blown(el, Math.hypot(cx - x, cy - y), cx, cy, 40);
      if (!a) continue;
      const f = { el, a, prev: { t: el.style.transform, o: el.style.transformOrigin } };
      folds.push(f);
      a.onfinish = () => { const i = folds.indexOf(f); if (i >= 0) folds.splice(i, 1); };
    }
  for (const p of PINS) p.to = [x, y]; breakPins((px, py) => Math.hypot(px - x, py - y) < reach + (whole ? edge : 0) + 120, 'swallow', (px, py) => timeAt(Math.hypot(px - x, py - y)) * .8);
  shake('blackhole');
  // (the burst's black is up by then: the far solids' copies and whatever no budget carried leave the page unseen, and nothing comes back when it closes)
  if (whole) later(sweep, reduce ? 0 : space.popAt + 420);
  if (space?.popAt) {
    [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => later(() => shake(i < 3 ? 'bhbuild' : i < 6 ? 'bhbuild2' : 'bhbuild3'), space.popAt - 1500 * .66 ** i));
    later(() => { g.style.zIndex = '4'; for (const a of [...pageAnimations]) if (a.effect?.target === layer) { a.cancel(); pageAnimations.delete(a); } shake('bhburst', true); }, space.popAt);
    [.72, .83, .93].forEach(u => later(() => { shake('bhquake', true); space.jolt?.(18); }, (space.closeAt || 10800) * u));
  }
  else [.3, .52, .7, .86].forEach((u, k) => later(() => shake(k < 2 ? 'bhjolt' : 'bhjolt2'), 9600 * u));
  later(() => {
    if (space)
      space.closeNow();
    else g.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.15)', offset: .2 }, { transform: 'scale(0)', opacity: 0 }], { duration: D(420), easing: 'ease-in', fill: 'forwards' });
    // the letters it was pulling spring most of the way back, still a little askew; the page springs back past straight and settles
    for (const { c, a, f } of leaning) {
      if (!c.isConnected) continue;
      const from = getComputedStyle(c).transform;
      c.getAnimations().forEach(x => x.cancel());
      c.style.transform = from;
      c.animate([{ transform: from }, { transform: `translate(${R(Math.cos(a) * 3 * f)}px,${R(Math.sin(a) * 3 * f)}px) rotate(${R(J(10) * f)}deg)` }], { duration: D(520), easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'forwards' });
    }
    for (const p of pulled) { const i = folds.findIndex(f => f.el === p.el && f.a === p.an); if (i < 0) continue; const [f] = folds.splice(i, 1); returnFold(f, 700, 'cubic-bezier(.3,1.7,.5,1)'); }
    if (!reduce) { // it snaps shut: a flash, a ring of pressed air, and two jets of 0 and 1 thrown out that rain onto the floor
      const sw = place(`<circle r="40" fill="none" stroke="${PAPER}" stroke-width="6" opacity=".9"/><circle r="40" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".3"/>`, x, y, [-42, -42, 84, 84]);
      sw.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(7)', opacity: 0 }], { duration: 560, delay: 950, easing: 'cubic-bezier(.1,.6,.3,1)', fill: 'both' }).onfinish = () =>
        sw.remove();
      later(() => shake('bhclose', true), 950);
      for (let i = 0; i < 44 * FX; i++) {
        const up = i % 2 ? -1 : 1, d = document.createElement('span');
        d.textContent = rnd() < .5 ? '0' : '1';
        Object.assign(d.style, {
          position: 'absolute',
          left: R(x - 4) + 'px',
          top: R(y - 8) + 'px',
          font: `700 ${R(11 + rnd() * 7)}px Consolas,'Courier New',monospace`,
          color: rnd() < .3 ? DATA2 : DATA,
          textShadow: '0 0 6px rgba(127,184,110,.7)'
        });
        layer.append(d);
        mark(d);
        const [k, dur] = toss(x, y, J(140), up * (520 + rnd() * 520), J(720), 14); d.animate(k, { duration: dur, delay: 960 + rnd() * 160, easing: 'linear', fill: 'both' }); } }
    if (disc) {
      disc.getAnimations().forEach(a => a.cancel());
      disc.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.2)' }], { duration: D(420), easing: 'ease-in', fill: 'forwards' }).onfinish = () => disc.remove();
    }
    // it closes to a pinhole, the back end still turning inside
    const s = mark(place(PA?.pin ? fresh(pickOf(PA.pin)) : `<path d="${closed(ring(0, 0, 13, 13, 9, .05))}" fill="${VOID}" opacity=".9"/><g class="chb-swirl">${[0, 1, 2].map(i => `<path d="M0 0C${4 + i * 3} ${-2 - i * 2} ${8 + i * 3} ${3 + i} ${6 + i * 4} ${8 + i * 2}" fill="none" stroke="${i ? DATA : GOLD}" stroke-width="1.4" stroke-linecap="round" transform="rotate(${i * 120})"/>`).join('')}</g>${inkP(over(ring(0, 0, 13, 13, 9, .05)), 1.8)}`, x, y, PA?.pin ? [-62, -42, 124, 84] : [-20, -20, 40, 40]));
    s.animate(
      [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'scale(.92)', offset: .7 }, { opacity: 1, transform: 'none' }],
      { duration: D(520), delay: D(900), easing: 'cubic-bezier(.3,0,.2,1)', fill: 'backwards' });
    PINS.push({ el: s, x, y });
  }, reduce ? 0 : (space?.closeAt || 4800));
  shown();
}
// ---------------------------------------------------------------- dimensional foil: a little foil flutters down; where it touches, the page collapses into one dimension
// The flattening runs out from the line it touched as a bright wavefront, up and down the page; whatever it passes is
// smeared flat onto that line, and the page ends as one thin line of streaks in the page's own colours.
let flat = false;
// the foil itself: a little holographic card, its colours sliding across it as it turns, a sheen running over it
const foilCard = () => { const id = 'chbF' + (++uid); return `<g transform="scale(1.5)"><defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1" spreadMethod="reflect"><stop offset="0" stop-color="#FFB8DD"/><stop offset=".2" stop-color="#B8E6FF"/><stop offset=".4" stop-color="#D6FFC4"/><stop offset=".6" stop-color="#FFF1B8"/><stop offset=".8" stop-color="#DCC4FF"/><stop offset="1" stop-color="#B8FFF0"/><animateTransform attributeName="gradientTransform" type="translate" values="-.6 -.6;.6 .6;-.6 -.6" dur="1.4s" repeatCount="indefinite"/></linearGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2=".3"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/><animateTransform attributeName="gradientTransform" type="translate" values="-1 0;1 0" dur=".9s" repeatCount="indefinite"/></linearGradient>
<radialGradient id="${id}h"><stop offset="0" stop-color="#E8F0FF" stop-opacity=".9"/><stop offset="1" stop-color="#C8D8FF" stop-opacity="0"/></radialGradient></defs>
<ellipse rx="26" ry="22" fill="url(#${id}h)"><animate attributeName="opacity" values=".55;1;.55" dur=".7s" repeatCount="indefinite"/></ellipse>
<path d="M-12 -8.6L12.4 -9.4L11.6 8.8L-11.4 9.4Z" fill="url(#${id}g)"/><path d="M-12 -8.6L12.4 -9.4L11.6 8.8L-11.4 9.4Z" fill="url(#${id}s)"/>
<path d="M-8 -5.6L8.6 -6.2M-8.4 -1.8L8.4 -2.4M-8.6 2.2L8.2 1.6M-8.8 6L7.6 5.4" stroke="#FFFFFF" stroke-width=".5" opacity=".75"/>
<path d="M-12 -8.6L12.4 -9.4L11.6 8.8L-11.4 9.4Z" fill="none" stroke="#FFFFFF" stroke-width="1.6" opacity=".9"/>${inkP('M-12 -8.6L12.4 -9.4L11.6 8.8L-11.4 9.4L-11.6 -7', 1.2, .85)}</g>`; };
function foil(x, y) {
  if (flat) return; flat = true; const FALL = 2400, SPEED = .2, SPC = globalThis.ReservePlaySpace;   // (SPEED: px per ms, how fast the flattening runs up and down the page)
  const f = place(foilCard(), x, y, [-42, -36, 84, 72]);
  // it tumbles as it flutters down (turning over in depth, so its colours flash), trailing sparkles
  const path = [[-30, -160, -30, 0], [10, -110, 20, 70], [-12, -60, -16, 160], [4, -20, 8, 250], [0, 0, 0, 360]];
  f.animate(
    path.map(([dx, dy, r, ry], i) => ({ transform: `perspective(240px) translate(${dx}px,${dy}px) rotate(${r}deg) rotateY(${ry}deg)`, offset: [0, .3, .6, .85, 1][i] })),
    { duration: D(FALL), easing: 'ease-in-out', fill: 'forwards' });
  if (!reduce)
    for (let ms = 60; ms < FALL - 50; ms += 70)
      later(() => {
        const u = ms / FALL, k = Math.min(3, Math.floor(u * 4)), v = u * 4 - k, [ax, ay] = path[k], [bx, by] = path[k + 1], px = x + ax + (bx - ax) * v + J(8), py = y + ay + (by - ay) * v + J(6);
    const sp = place(`<path d="M0 -4C.5 -1 1 -.5 4 0C1 .5 .5 1 0 4C-.5 1 -1 .5 -4 0C-1 -.5 -.5 -1 0 -4Z" fill="hsl(${R(rnd() * 360)},100%,82%)"/>`, px, py, [-5, -5, 10, 10]);
    sp.animate(
      [{ transform: 'scale(.3) rotate(0deg)', opacity: 1 }, { transform: `translate(${R(J(10))}px,${R(14 + rnd() * 20)}px) scale(1.1) rotate(90deg)`, opacity: .9, offset: .4 }, { transform: `translate(${R(J(16))}px,${R(30 + rnd() * 30)}px) scale(.2) rotate(180deg)`, opacity: 0 }],
      { duration: 700 + rnd() * 400, easing: 'ease-out', fill: 'forwards' }).onfinish = () =>
      sp.remove(); },
    ms);
  // the colours of the page along the touched band, gathered before anything moves: they become the line's streaks
  const colours = () => {
    const out = [];
    for (let u = 4; u < innerWidth; u += 5) {
      const el = document.elementFromPoint(u, Math.max(1, Math.min(innerHeight - 2, y - 80 + rnd() * 160)));
      if (!el || el.closest('#chb-layer')) continue;
      const cs = getComputedStyle(el), hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
      const c = hasText && rnd() < .6 ? cs.color : !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) ? cs.backgroundColor : cs.color; out.push([u, c]); } return out; };
  const smearOf = (cy, end) =>
    [
      { transform: 'none' },
      { transform: `perspective(320px) translate(${R(J(2))}px,${R((y - cy) * .2)}px) rotateX(${cy < y ? -48 : 48}deg)`, offset: .25 },
      { transform: `perspective(320px) translate(${R(J(4))}px,${R((y - cy) * .55)}px) rotateX(${cy < y ? -70 : 70}deg) scale(1.3,.55)`, offset: .5 },
      { transform: `translate(${R(J(18))}px,${R((y - cy) * .85)}px) scale(${R(1.6 + rnd())},.2)`, offset: .75 },
      { transform: `translate(${R(J(36))}px,${R(y - cy + J(1.4))}px) scale(${R(end)},.06)` }
    ];
  // Everything the strike needs is read while the card flutters down and only the compositor is busy. The text then goes on the strike's
  // own canvas, nothing added to the page, so all of it can go, sidebars too, in place of the nearest few hundred pieces.
  let cols = null, after = null; const solids = [], blocks = [];
  if (SPC?.foil && !reduce)
    later(() => {
      SPC.foilReady?.();
      cols = colours();
      blocks.push(...pageBlocks());
      for (const p of linesInView()) if (!blocks.some(b => b.contains(p.s._line.el))) solids.push({ ...p, cy: p.r.top + p.r.height / 2 });
    const found = allThings(
      lettersNear(
        x,
        y,
        Math.max(innerWidth, innerHeight) * 1.5,
        (cx, cy) => cy > -20 && cy < innerHeight + 20,
        false,
        LOW ?
          { cap: 260, cover: 1000, letters: 0, flat: true, runs: 140, rank: (cx, cy) => Math.abs(cy - y) } :
          { cap: 420, cover: 2800, letters: 200, flat: true, runs: 260, rank: (cx, cy) => Math.abs(cy - y) }),
      700),
      text = [];
    for (const p of found) {
      const { s, r, cx, cy } = p;
      if (s._thing) { solids.push(p); continue; }
      const t = s._type || typeOf(s);
      moved.add(s);
      text.push({ s, cx, cy, t0: Math.abs(cy - y) / SPEED / 1000, jitter: J(36), wide: 2.2 + rnd() * 2.4, text: caseOf(s, t), font: t.font, color: t.color, h: r.height });
    }
    const sheet = SPC.textSheet(text), order = [...text].sort((p, q) => p.t0 - q.t0); let next = 0;
    after = (g, t, k) => {
      while (next < order.length && order[next].t0 <= t) order[next++].s.style.visibility = 'hidden';
      for (const p of text) {
        const u = (t - p.t0) / 1.1;
        if (u < 0 || u >= 1) continue;
        const e = u * u * (.5 + .5 * u), e2 = Math.min(1, e * 1.5), sx = 1 + (p.wide - 1) * e, sy = 1 - .94 * e2, q = p.e;
        g.globalAlpha = Math.min(1, (1 - u) * 2.6);
        g.setTransform(k * sx, 0, 0, k * sy, k * (p.cx + p.jitter * e), k * (p.cy + (y - p.cy) * e));
        g.drawImage(sheet, q.x, q.y, q.w, q.h, -q.dw / 2, -q.dh / 2, q.dw, q.dh);
      }
      g.globalAlpha = 1;
      g.setTransform(k, 0, 0, k, 0, 0);
    }; }, 140);
  later(() => {
    // the strike shakes the whole page: a hard jolt at the touch, jolt after jolt as the collapse runs, a last one as it settles
    if (!reduce) {
      shake('foil');
      later(() => shake('foilrumble'), 80);
      const runMs = Math.max(y, innerHeight - y) / SPEED;
      for (let tt = 170; tt < runMs + 260; tt += 150 + rnd() * 170) later(() => shake(rnd() < .55 ? 'foiljolt' : 'foiljolt2'), tt);
      later(() => shake('foilend'), runMs + 1150);
    }
    breakPins(() => true, 'flat', (px, py) => Math.abs(py - y) / SPEED);
    f.animate(
      [{ transform: 'none' }, { transform: 'scale(60,.08)', opacity: .9, offset: .5 }, { transform: 'scale(120,.04)', opacity: 0 }],
      { duration: D(900), easing: 'ease-in', fill: 'forwards' }).onfinish = () =>
      f.remove();
    cols ||= colours();
    // the strike itself, rendered: the touch, space bending in, the fronts, the void and the line that is left (play-space.js)
    if (SPC?.foil && !reduce) {
      const cv = document.createElement('canvas');
      cv.className = 'chb-strike';
      layer.append(cv);
      const st = SPC.foil(cv, x, y, { speed: SPEED * 1000, cols, after: (g, t, k) => after?.(g, t, k) }), t0 = performance.now(), draw = everyOther(), tick = now => {
        if (!cv.isConnected) return;
        if (draw()) st.frame((now - t0) / 1000);
        if (st.done) cv.remove(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    if (!reduce) {
      // the wavefront: a thin bright plane running up and down from the line (when the rendered strike is not there)
      if (!SPC?.foil)
        for (const sgn of [-1, 1]) {
          const far = sgn < 0 ? y + 30 : innerHeight - y + 30,
            wf = fxEl(SCR, innerWidth / 2, y, innerWidth, 12, { background: 'linear-gradient(180deg, rgba(225,236,255,0), rgba(240,246,255,.95) 50%, rgba(225,236,255,0))' });
        wf.animate(
          [{ transform: 'none', opacity: 1 }, { transform: `translateY(${R(sgn * far)}px) scaleY(2.6)`, opacity: .55 }],
          { duration: far / SPEED, easing: 'linear', fill: 'forwards' }).onfinish = () =>
          wf.remove(); }
      // whatever cannot be drawn on the strike's canvas (pictures, buttons, the lines beside the blocks) is smeared flat as a copy; every letter too, without that canvas
      const smeared = SPC?.foil ? solids : (() => {
        let n = 0;
        return lettersNear(
          x,
          y,
          Math.max(innerWidth, innerHeight) * 1.5,
          (cx, cy) => cy > -20 && cy < innerHeight + 20,
          false,
          { cap: PIECES, cover: 900, flat: true, rank: (cx, cy) => Math.abs(cy - y) }).sort((p, q) =>
          Math.abs(p.cy - y) - Math.abs(q.cy - y)).filter(() => ++n <= PIECES);
      })();
      for (const { s: l, r, cy } of smeared) keep(l, r, smearOf(cy, 2.2 + rnd() * 2.4), 1100, 'cubic-bezier(.6,0,.9,.5)', Math.abs(cy - y) / SPEED);
    }
    // every block of the page (not our tray) folds flat toward the line, as the wavefront reaches it
    for (const el of blocks.length ? blocks : pageBlocks()) { const r = el.getBoundingClientRect(), oy = y - r.top, ox = x - r.left, prev = { t: el.style.transform, o: el.style.transformOrigin };
      el.style.transformOrigin = `${R(ox)}px ${R(oy)}px`;
      const dist = Math.max(0, Math.min(Math.abs(r.top - y), Math.abs(r.bottom - y), r.top < y && r.bottom > y ? 0 : 1e9)), delay = D(dist / SPEED);
      const own = ownMove(el),
        a = el.animate(
          [{ transform: own || 'none' }, { transform: own + 'scale(1.01,.6)', offset: .5 }, { transform: own + 'scale(1.06,.004)', opacity: 1, offset: .9 }, { transform: own + 'scale(1.06,.004)', opacity: 0 }],
          { duration: D(1100), delay, easing: 'cubic-bezier(.7,0,.9,.6)', fill: 'forwards' });
      folds.push({ el, a, prev, own }); }
    // the line it all became: streaks in the page's own colours, the ink line and the back end's 0 and 1 along it
    const l = mark(sheet()); l.innerHTML = cols.map(([u, c]) => `<path d="M${R(u)} ${R(y + J(2.6))}h${R(4 + rnd() * 22)}" stroke="${c}" stroke-width="${R(.8 + rnd() * 1.4)}" stroke-linecap="round" opacity="${R(.55 + rnd() * .4)}"/>`).join('') + `<defs><linearGradient id="chbFoilLine" gradientUnits="userSpaceOnUse" x1="0" x2="${R(innerWidth)}" y1="0" y2="0">${['#F78FC9', '#86C6F7', '#A4E6A2', '#F9D56E', '#B79BF4', '#7DE4D2', '#F78FC9', '#86C6F7', '#A4E6A2', '#F9D56E', '#B79BF4', '#7DE4D2'].map((c, i) => `<stop offset="${R(i / 11)}" stop-color="${c}"/>`).join('')}</linearGradient></defs><path d="M0 ${R(y - 2.4)}H${innerWidth}" stroke="url(#chbFoilLine)" stroke-width="3"/><path d="M0 ${R(y + 2.4)}H${innerWidth}" stroke="url(#chbFoilLine)" stroke-width="3"/>` + inkP(`M0 ${R(y)}L${innerWidth} ${R(y)}`, 1.1, .7);
    l.animate([{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'none' }], { duration: D(900), delay: D(700), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    l.style.transformOrigin = `${R(x)}px ${R(y)}px`;
    {
      const run = mark(document.createElement('canvas')), g = run.getContext?.('2d');
      run.width = innerWidth + 216;
      run.height = 10;
      Object.assign(run.style, { position: 'absolute', left: '-216px', top: R(y - 8) + 'px', animation: 'chb-river 14s linear infinite' });
      if (g) { g.font = `700 5px Consolas,'Courier New',monospace`; g.fillStyle = DATAINK; g.fillText(bits(Math.ceil((innerWidth + 216) / 3)), 0, 7); }
      layer.append(run);
      run.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D(900), delay: D(900), fill: 'backwards' });
    }
    shown();
  }, reduce ? 0 : FALL);
}
// ---------------------------------------------------------------- eraser, magnet, ink
let eraserEl = null;
let rubbed = null;
function erase(x, y) {
  if (!rubbed?.isConnected) rubbed = flatSheet();
  const rub = rubbed.getContext?.('2d');
  if (rub) {
    rub.lineCap = 'round';
    rub.lineWidth = 24 + J(3);
    rub.strokeStyle = 'rgba(232,167,156,.07)';
    rub.beginPath();
    rub.moveTo(eraserEl?._px ?? x, eraserEl?._py ?? y);
    rub.lineTo(x + .1, y);
    rub.stroke();
    rub.lineWidth = 1;
    rub.strokeStyle = 'rgba(120,70,60,.08)';
    for (let i = 0; i < 3; i++) { const o = J(10); rub.beginPath(); rub.moveTo((eraserEl?._px ?? x) + o, (eraserEl?._py ?? y) + o); rub.lineTo(x + o, y + o + .1); rub.stroke(); }
  }
  if (!eraserEl) { eraserEl = place(ART.eraser(), 0, 0, [-19, -11, 34, 26]); eraserEl.style.filter = 'drop-shadow(1px 2px 1px rgba(20,20,19,.3))'; eraserEl._sh = shadow(x, y, 36, .08); }
  eraserEl.style.left = x + 'px';
  eraserEl.style.top = y + 'px';
  eraserEl._px = x;
  eraserEl._py = y;
  moveShadow(eraserEl._sh, x, y);
  for (const { s, r } of lettersNear(x, y, 11)) {
    const c = lift(s, r);
    c.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(1px,2px) scale(.6)' }], { duration: D(260), fill: 'forwards' }).onfinish = () => c.remove();
    if (rub && r.width < 40) {
      rub.globalAlpha = .78;
      rub.fillStyle = DATAINK;
      rub.font = `700 ${R(r.height * .62)}px Consolas,'Courier New',monospace`;
      rub.textAlign = 'center';
      rub.textBaseline = 'middle';
      rub.fillText(rnd() < .5 ? '0' : '1', r.left + r.width / 2, r.top + r.height / 2);
      rub.globalAlpha = 1;
    }
    if (rnd() < .35) {
      const cx = x + J(6),
        cy = y + 6,
        cr = mark(place(`<path d="${closed(ring(0, 0, 1.8, 1.4, 5, .2))}" fill="#E8A79C"/>`, cx, cy, [-3, -3, 6, 6])),
        [k, dur] = toss(cx, cy, J(80), -40 - rnd() * 60, J(400), 3);
      cr.animate(k, { duration: D(dur), easing: 'linear', fill: 'forwards' });
    } }
  breakLines(x, y, 9, 'drop'); if (PINS.length) breakPins((px, py) => Math.hypot(px - x, py - y) < 18); shown();
}
let magnetEl = null, caught = [], magnetX = 0, magnetY = 0, polarity = 1, clumped = 0; const inClump = new Set();
function magnet(x, y) {
  magnetX = x;
  magnetY = y;
  if (!magnetEl) { magnetEl = mark(place(magnetArt(false), 0, 0, [-26, -32, 52, 64])); magnetEl.classList.add('chb-magnet-live'); polarity = 1; }
  magnetEl.style.transform = 'translate(' + R(x) + 'px,' + R(y) + 'px)';
  clumped = caught.reduce((n, k) => n + k.body.parts.length, 0);
  const room = polarity > 0 ? 160 - clumped : 160, nearby = room > 0 ? lettersNear(x, y, 130, undefined, false, { cap: room, letters: room }).sort((a, b) => a.d - b.d) : [];
  physics.batch(() => { physics.setAttractor('magnet', { x, y, radius: 150, strength: polarity * 11000 });
    for (const p of nearby) {
      if (polarity > 0 && clumped >= 160) break;
      const body = liveBody([p]);
      if (polarity < 0) { const dx = body.x - x, dy = body.y - y, d = Math.hypot(dx, dy) || 1; physics.force(body, dx / d * 850, dy / d * 850 - 120); continue; }
      catchLetter(body);
    }
    if (polarity > 0)
      for (const body of physics.bodies) { if (clumped >= 160) break; if (!body.retired && !body.constraint && !body.dragged && Math.hypot(body.x - x, body.y - y) < 150) catchLetter(body); }
    for (const k of caught) {
      if (k.body.constraint) {
        k.body.constraint.x = x + k.off[0];
        k.body.constraint.y = y + k.off[1];
        if (reduce) physics.constrain(k.body, k.body.constraint); else physics.wake(k.body);
      }
    } });
    shown();
}
function catchLetter(body) {
  if (inClump.has(body) || clumped + body.parts.length > 160) return;
  inClump.add(body);
  clumped += body.parts.length;
  const i = caught.length, a = i * 2.39996, radius = 22 + 6.5 * Math.sqrt(i), off = [Math.cos(a) * radius, -13 + Math.sin(a) * radius];
  caught.push({ body, off });
  for (const p of body.parts) p.c.classList.add('chb-magnet-clump');
  physics.constrain(body, { x: magnetX + off[0], y: magnetY + off[1], stiffness: 115, damping: 15, sway: reduce ? 0 : 1.8, angle: (a * 180 / Math.PI + 90) % 180 - 90 });
} // the letters stand around the magnet like filings, each pointing at it, far enough apart to stay letters
function flipMagnet() {
  if (!magnetEl) return;
  polarity *= -1;
  magnetEl.classList.toggle('is-repel', polarity < 0);
  magnetEl.innerHTML = magnetArt(polarity < 0);
  physics.removeAttractor('magnet');
  const clump = caught.splice(0);
  inClump.clear();
  physics.batch(() => {
    for (const k of clump) { physics.release(k.body); for (const p of k.body.parts) p.c.classList.remove('chb-magnet-clump'); }
    if (polarity < 0) {
      for (const b of physics.bodies) {
        const dx = b.x - magnetX, dy = b.y - magnetY, d = Math.hypot(dx, dy);
        if (d > 180) continue;
        physics.force(b, (dx || (b.id % 2 ? -1 : 1)) / (d || 1) * 950, dy / (d || 1) * 950 - 150);
      }
    }
  });
  magnet(magnetX, magnetY);
}
function letGo() {
  physics.removeAttractor('magnet');
  physics.batch(() => { for (const k of caught) { physics.release(k.body); for (const p of k.body.parts) p.c.classList.remove('chb-magnet-clump'); } });
  caught = [];
  inClump.clear();
  magnetEl?.remove();
  magnetEl = null;
  polarity = 1;
}

function ink(x, y) {
  const pot = place(ART.ink(), x - 18, y - 22, [-12, -17, 24, 30]);
  pot.style.transformOrigin = '70% 90%';
  pot.style.filter = 'drop-shadow(1px 2px 1px rgba(20,20,19,.3))';
  { const psh = shadow(x - 18, y - 10, 26, .6); fallShadow(psh, .6, 0, 240); later(() => psh.remove(), reduce ? 0 : 1100); }
  pot.animate(
    [
      { transform: 'translateY(-30px)', opacity: 0 },
      { transform: 'none', opacity: 1, offset: .3, easing: 'ease-out' },
      { transform: 'rotate(-8deg)', offset: .45 },
      { transform: 'rotate(100deg)', offset: .75, easing: 'cubic-bezier(.6,0,.9,.6)' },
      { transform: 'rotate(96deg) translateY(-2px)', offset: .85 },
      { transform: 'rotate(100deg)', opacity: 0 }
    ],
    { duration: D(1100), fill: 'forwards' }).onfinish = () =>
    pot.remove();
  later(() => splat(x, y), reduce ? 0 : 780);
}
// the blot: lobed and thrown, not a circle; wet ink, lit from the upper left, with the paper soaking it up around the edge
const blotShape = () => {
  const n = 28, k = 3 + Math.floor(rnd() * 3), ph = rnd() * 6.28, pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.2832, w = 1 + .17 * Math.sin(a * k + ph) + .1 * Math.sin(a * (k * 2 + 1) + ph * 1.7) + (rnd() < .2 ? .22 * rnd() : 0);
    pts.push([Math.cos(a) * 30 * w, Math.sin(a) * 26 * w]);
  }
  return pts;
};
function splat(x, y) {
  const col = [DEEP, '#3B3D42', SLATE, SAGE2][Math.floor(rnd() * 4)], blot = blotShape(), drips = [0, 1, 2].map(() => [J(16), 12 + rnd() * 6, 4 + rnd() * 3, 20 + rnd() * 26]);
  const g = mark(place(`<path d="${closed(blot.map(([px, py]) => [px * 1.09 + 1, py * 1.09 + 1]))}" fill="${col}" opacity=".2"/><path d="${closed(blot)}" fill="${col}" opacity=".95"/>${drips.map(([dx, dy, w, h]) => `<g class="drip" style="transform-origin:${R(dx)}px ${R(dy)}px"><path d="M${R(dx - w / 2)} ${R(dy)}L${R(dx - w / 2)} ${R(dy + h)}A${R(w / 2)} ${R(w / 2)} 0 0 0 ${R(dx + w / 2)} ${R(dy + h)}L${R(dx + w / 2)} ${R(dy)}Z" fill="${col}" opacity=".9"/></g>`).join('')}${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => {
    const a = rnd() * 6.28, d = 42 + rnd() * rnd() * 46, w = Math.max(1.2, 6.5 - d / 14 + J(1));
    return `<path transform="translate(${R(Math.cos(a) * d)} ${R(Math.sin(a) * d * .86)}) rotate(${R(a * 57.3)})" d="${closed(ring(0, 0, w * 1.5, w, 7, .12))}" fill="${col}" opacity=".93"/>`;
  }).join('')}${drips.map(([dx, dy, w, h], i) => `<path class="chb-drop" style="animation-delay:${R(1 + i * .9 + rnd())}s" d="${closed(ring(dx, dy + h + 4, w * .42, w * .55, 6, .05))}" fill="${col}" opacity=".9"/>`).join('')}<g clip-path="url(#chbI${++uid})"><path class="chb-sheen" d="M-30 -30L-22 -30L-40 30L-48 30Z" fill="${PAPER}" opacity=".3"/></g><clipPath id="chbI${uid}"><path d="${closed(blot)}"/></clipPath><radialGradient id="chbG${uid}" cx=".36" cy=".32" r=".82"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient><path d="${closed(blot)}" fill="url(#chbG${uid})"/><path d="M-18 -11Q-10 -19 2 -18Q-8 -14 -14 -6Z" fill="${PAPER}" opacity=".72"/><path d="${closed(ring(-19, -2, 1.9, 1.7, 6, .1))}" fill="${PAPER}" opacity=".6"/>${inkP(over(blot), 1.2, .3)}`, x, y, [-46, -40, 92, 110]));
  g.animate([{ transform: 'scale(.2)' }, { transform: 'scale(1.1)', offset: .6 }, { transform: 'none' }], { duration: D(260), easing: 'ease-out' });
  { const rgb = col === DEEP ? '150,60,30' : col === SLATE ? '60,80,100' : col === SAGE2 ? '70,90,50' : '40,42,48'; stain(x, y + 4, 44, 36, rgb, .32, J(30)); stain(x + 2, y + 30, 26, 46, rgb, .16, 0); }
  g.querySelectorAll('.drip').forEach((d, i) =>
    d.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: D(900 + i * 300), delay: D(200), easing: 'cubic-bezier(.3,0,.3,1)', fill: 'backwards' }));
  shown();
}

// ---------------------------------------------------------------- painter: words brushed come alive in a random colour style
const PAINTS = ['chb-p-wave', 'chb-p-hop', 'chb-p-sweep', 'chb-p-jelly', 'chb-p-stack', 'chb-p-script', 'chb-p-type', 'chb-p-flag'];
const painted = new Map(); let brush = null;
// wet paint: one canvas a stroke, so a long stroke costs no more than a short one (every step used to add paths to a page-sized drawing).
// A broad band of colour under a dozen bristles of its own darker and lighter tones, some running dry for a moment, one catching the light.
const shade = (hex, t) => {
  const n = parseInt(hex.slice(1), 16), to = t < 0 ? 0 : 255, k = Math.abs(t), c = s => Math.round(((n >> s) & 255) * (1 - k) + to * k);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};
function flatSheet(opacity = 1) {
  const c = document.createElement('canvas'), dpr = Math.min(globalThis.devicePixelRatio || 1, 1.5);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  Object.assign(c.style, { position: 'absolute', left: '0', top: '0', width: innerWidth + 'px', height: innerHeight + 'px', opacity });
  layer.prepend(c);
  c.getContext?.('2d')?.scale(dpr, dpr);
  return mark(c);
}
const bristles = col =>
  [...Array(13)].map((_, i) => ({ off: (i - 6) * 1.2 + J(.4), w: .8 + rnd() * 1.5, a: .5 + rnd() * .45, dry: 0, tone: i === 2 ? shade(col, .62) : shade(col, (Math.abs(i - 6) > 4 ? -.3 : 0) + J(.2)) }));
function paint(x, y, first) {
  const col = [DEEP, GOLD, '#3F9C8E', '#8A63B8', '#4F93C9'][Math.floor(rnd() * 5)];
  if (first || !brush) brush = { last: [x, y], col, hairs: bristles(col), el: place(`<g transform="translate(-7 -9)">${ART.painter()}</g>`, x, y, [-24, -26, 34, 34]) };
  brush.el.style.left = x + 'px'; brush.el.style.top = y + 'px';
  const [lx, ly] = brush.last, step = Math.hypot(x - lx, y - ly); if (step > 3) {
    if (!brush.svg) { brush.svg = flatSheet(.9); brush.went = 0; brush.next = 50 + rnd() * 60; }
    const g = brush.svg.getContext?.('2d'), nx = -(y - ly) / step, ny = (x - lx) / step;
    if (g) { g.lineCap = 'round'; g.globalAlpha = 1; g.strokeStyle = brush.col; g.lineWidth = 13.5 + J(1); g.beginPath(); g.moveTo(lx, ly); g.lineTo(x, y); g.stroke();
      for (const h of brush.hairs) {
        if (h.dry > 0) { h.dry -= step; continue; }
        if (rnd() < .02) h.dry = 8 + rnd() * 18;
        g.strokeStyle = h.tone;
        g.globalAlpha = h.a;
        g.lineWidth = h.w;
        g.beginPath();
        g.moveTo(lx + nx * h.off, ly + ny * h.off);
        g.lineTo(x + nx * h.off, y + ny * h.off);
        g.stroke();
      }
      if (rnd() < .06 && !reduce) {
        const d = 10 + rnd() * 26, a = rnd() * 6.28;
        g.globalAlpha = .9;
        g.fillStyle = brush.col;
        g.beginPath();
        g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, .8 + rnd() * 2.2, 0, 6.2832);
        g.fill();
      } }
    brush.went += step; brush.sheet = (brush.sheet || 0) + step; brush.last = [x, y];
    if (brush.went > brush.next && !reduce) {
      brush.went = 0;
      brush.next = 60 + rnd() * 90;
      const h = 14 + rnd() * 34, dw = 3 + rnd() * 2.5, dx = x + J(4), lean = J(1.6);   // a drip runs down from the wet paint: thin from the stroke, a bead at its end, lit down one side
      const d = mark(place(`<path d="M${R(-dw)} 0Q${R(-dw * .42)} 3 ${R(-dw * .36 + lean)} ${R(h * .6)}L${R(-dw * .5)} ${R(h)}A${R(dw * .62)} ${R(dw * .72)} 0 1 0 ${R(dw * .5)} ${R(h)}L${R(dw * .36 + lean)} ${R(h * .6)}Q${R(dw * .42)} 3 ${R(dw)} 0Z" fill="${shade(brush.col, -.08)}" opacity=".93"/><path d="M${R(-dw * .16 + lean)} ${R(h * .5)}L${R(-dw * .2)} ${R(h + 1)}" stroke="${PAPER}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>`, dx, y + 2, [-8, -2, 16, h + 12]));
      (brush.drips ||= []).push(d);
      d.style.transformOrigin = '50% 0';
      d.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 700 + rnd() * 700, easing: 'cubic-bezier(.3,0,.3,1)', fill: 'backwards' });
    }
    if (brush.sheet > DRY_STRETCH) { dry([brush.svg, ...(brush.drips || [])]); brush.svg = brush.drips = null; brush.sheet = 0; }
  }
  // (every word the stroke crossed wakes, not only the one under the brush where a fast stroke ended)
  const mx = (lx + x) / 2, my = (ly + y) / 2, reach = step / 2 + 14; splitWords(wordsNear(mx, my, reach).filter(w => crossed(w.r, lx, ly, x, y, 14)));
  for (const w of splitNear(mx, my, reach, '.chb-word')) { if (painted.has(w)) continue; const r = w.getBoundingClientRect(); if (!crossed(r, lx, ly, x, y, 5)) continue;
    const style = PAINTS[Math.floor(rnd() * PAINTS.length)]; painted.set(w, style); w.classList.add('chb-painted', style);
    [...w.children].forEach((c, i) => c.style.setProperty('--i', i));
    w.style.setProperty('--n', w.children.length);
    w.animate([{ transform: 'scale(1.25)' }, { transform: 'none' }], { duration: D(300), easing: 'cubic-bezier(.3,1.6,.5,1)' });
  }
  shown();
}
// wet paint lies over the words it woke, so it dries quickly and they are seen: it holds a moment, then fades and sags away with its drips and
// spatters. A long stroke dries as it goes: past a stretch, the paint so far starts to dry and the brush carries on on a new sheet
const DRY_HOLD = 550, DRY_FADE = 900, DRY_STRETCH = 520;
function dry(parts) {
  later(() => {
    for (const el of parts) {
      if (!el.isConnected) continue;
      el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: reduce ? 'none' : 'translateY(6px)' }], { duration: DRY_FADE, easing: 'ease-in', fill: 'forwards' }).onfinish = () =>
        el.remove();
    }
  }, DRY_HOLD);
}
function paintOff() { const b = brush; brush = null; b?.el.remove(); if (b?.svg) dry([b.svg, ...(b.drips || [])]); }
// ---------------------------------------------------------------- garden: a seed falls and the words themselves grow: each sends up a stem, leaves unfold, a flower opens
// the plants are small drawings of their own, each swaying as a whole: a page-sized drawing would repaint on every frame of the sway
const plants = [];
function leafArt(u, v, side) {
  const s = 1 + rnd() * .3,
    a = .55 + J(.25),
    L = 12 * s,
    tx = u + side * Math.cos(a) * L,
    ty = v - Math.sin(a) * L,
    nx = -(ty - v) / L,
    ny = (tx - u) / L,
    w = 3.6 * s,
    m1 = [u + (tx - u) * .45 + nx * w, v + (ty - v) * .45 + ny * w],
    m2 = [u + (tx - u) * .45 - nx * w, v + (ty - v) * .45 - ny * w];
  const leaf = `M${R(u)} ${R(v)}Q${R(m1[0])} ${R(m1[1])} ${R(tx)} ${R(ty)}Q${R(m2[0])} ${R(m2[1])} ${R(u)} ${R(v)}`;
  return `<path d="${leaf}Z" fill="#B7C0A0" transform="translate(.7 .7)"/><path d="M${R(u)} ${R(v)}Q${R(m2[0])} ${R(m2[1])} ${R(tx)} ${R(ty)}L${R(u)} ${R(v)}Z" fill="#9EAA82"/>${inkP(leaf, 1.2)}`;
}
function bloomArt(fx, fy) {
  const c = [GOLD, CLAY, '#C9B6CC', PAPER, '#E8A79C'][Math.floor(rnd() * 5)], kind = rnd();
  if (kind < .22) return `<path d="${closed(ring(fx, fy - 2, 3.2, 4.6, 6, .08))}" fill="#E8A79C"/>${inkP(over(ring(fx, fy - 2, 3.2, 4.6, 6, .08)), 1.1)}`;   // a bud
  if (kind < .5) { const w = 6 + rnd() * 1.6, h = 9 + rnd() * 2, cup = `M${R(fx - w)} ${R(fy - h)}Q${R(fx - w * .5)} ${R(fy - h * .55)} ${R(fx)} ${R(fy - h * 1.1)}Q${R(fx + w * .5)} ${R(fy - h * .55)} ${R(fx + w)} ${R(fy - h)}Q${R(fx + w * 1.05)} ${R(fy + 1)} ${R(fx)} ${R(fy + 2)}Q${R(fx - w * 1.05)} ${R(fy + 1)} ${R(fx - w)} ${R(fy - h)}Z`; return `<path d="${cup}" fill="${c}" transform="translate(.8 .8)"/><path d="${cup}" fill="${c}"/>${inkP(cup, 1.2, .85)}<path d="${closed(ring(fx - w * .45, fy - h * .45, w * .2, h * .22, 5, .1))}" fill="${PAPER}" opacity=".55"/>`; }   // a tulip
  const np = 5 + Math.floor(rnd() * 2), pr = 5.2 + rnd() * 1.6;   // a daisy
  const at = k => ring(fx + Math.cos(k / np * 6.28) * pr, fy + Math.sin(k / np * 6.28) * pr * .92, pr * .72, pr * .52, 7, .08);
  const petals = [...Array(np)].map((_, k) => `<path d="${closed(at(k).map(([u, v]) => [u + .8, v + .8]))}" fill="${c}"/>`).join(''),
    ink = [...Array(np)].map((_, k) => inkP(over(at(k)), 1.1, .85)).join('');
  return `${petals}${ink}<path d="${closed(ring(fx, fy, pr * .42, pr * .4, 6, .08))}" fill="${DEEP}"/>${inkP(over(ring(fx, fy, pr * .42, pr * .4, 6, .08)), 1)}<path d="${closed(ring(fx - pr * .4, fy - pr * .45, pr * .28, pr * .16, 5, .1))}" fill="${PAPER}" opacity=".55"/>`;
}
function garden(x, y) {
  splitWords(wordsNear(x, y, 150));
  const near = [...splitNear(x, y, 150, '.chb-word')].map(w => {
    const r = w.getBoundingClientRect(), cx = r.left + r.width / 2;
    return { w, r, cx, d: Math.hypot(cx - x, r.top + r.height / 2 - y) };
  }).filter(o => o.r.width && inView(o.r) && !painted.has(o.w)).sort((a, b) => a.d - b.d), picked = [];
  for (const o of near) { if (picked.some(p => Math.abs(p.cx - o.cx) < 38 && Math.abs(p.r.top - o.r.top) < 26)) continue; picked.push(o); if (picked.length >= 14) break; }
  for (const { w, r, d } of picked) {
    painted.set(w, 'chb-sprout'); w.classList.add('chb-painted', 'chb-sprout');
    const h = 18 + rnd() * 24, lean = J(7), u = r.left + r.width * (.3 + rnd() * .4), v = r.top + r.height * .3, t = .34 + rnd() * .3, box = [-28, -h - 20, 56, h + 26], tall = R(-h * t);
    const plant = mark(place(`${inkP(`M0 0C-2.4 ${R(-h * .34)} ${R(lean + 2.4)} ${R(-h * .68)} ${R(lean)} ${R(-h)}`, 2.6, .35)}<path d="M0 0C-2.4 ${R(-h * .34)} ${R(lean + 2.4)} ${R(-h * .68)} ${R(lean)} ${R(-h)}" fill="none" stroke="${SAGE2}" stroke-width="1.9" stroke-linecap="round"/>${leafArt(lean * t, tall, rnd() < .5 ? -1 : 1)}${h > 28 ? leafArt(lean * (t + .2), R(-h * (t + .22)), rnd() < .5 ? -1 : 1) : ''}${bloomArt(lean, -h)}`, u, v, box));
    plant.classList.add('chb-plant'); plant.style.transformOrigin = `${-box[0]}px ${-box[1]}px`; plant.style.animationDelay = `${R(d / 320)}s, ${R(rnd() * 4)}s`; plants.push(plant);
  }
  for (const old of plants.splice(0, Math.max(0, plants.length - 70))) old.remove();
  const seedEl = place(`<path d="${closed(ring(0, 0, 4, 2.8, 6, .1))}" fill="${KRAFT}"/>${inkP(over(ring(0, 0, 4, 2.8, 6, .1)), 1.6)}`, x, y, [-6, -6, 12, 12]);
  seedEl.animate(
    [
      { transform: 'translateY(-50px) rotate(-40deg)' },
      { transform: 'rotate(10deg)', offset: .7, easing: 'ease-in' },
      { transform: 'translateY(-4px)', offset: .82 },
      { transform: 'none', offset: .9 },
      { transform: 'none', opacity: 0 }
    ],
    { duration: D(900), fill: 'forwards' }).onfinish = () =>
    seedEl.remove();
  shown();
}
// ---------------------------------------------------------------- balloons: one swells where the page is clicked and goes up; what lies closest ties on as it passes; a pop lets it all fall
// a balloon: a full rubber body a little narrower at the knot, its colour deeper on the shaded side, a long soft shine and a
// small sharp one, a knot and a stub of string (the string to the word is drawn separately, from the knot)
const balloonSVG = (col, len) => { const k = -len, body = ring(0, k - 24, 19, 23, 10, .03).map(([x, y]) => [x * (y > k - 24 ? 1 - (y - (k - 24)) / 70 : 1), y]);
  return `<path d="M0 0C-5 ${R(-len * .33)} 5 ${R(-len * .6)} 0 ${R(-len)}" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".7"/><path d="${closed(body.map(([x, y]) => [x + 1.4, y + 1.6]))}" fill="${col}"/>`
  + `<path d="${closed(ring(6, k - 20, 9, 13, 8, .08))}" fill="${INK}" opacity=".12"/><path d="M-11 ${R(k - 32)}C-12 ${R(k - 24)} -9 ${R(k - 16)} -5 ${R(k - 12)}" fill="none" stroke="${PAPER}" stroke-width="3.2" stroke-linecap="round" opacity=".55"/>`
  + `<path d="${closed(ring(-7, k - 37, 2.4, 3.2, 6, .1))}" fill="${PAPER}" opacity=".85"/>${inkP(over(body), 2.1)}${inkP(`M-2.2 ${R(k - 1.6)}L2.2 ${R(k - 1.6)}L0 ${R(k + 1.8)}Z`, 1.4)}`; };
// (how long the swell takes; how far the knot hangs under the balloon's middle; how high a knot with something on its strings goes;
// how far a hanging piece stretches its string; what is too heavy to lift)
const SWELL = .26, KNOT = 24, BALLOON_TOP = 59, STRING_SAG = 2300 / 130, tooBig = r => r.width * r.height > 64000 || r.width > 420 || r.height > 320;
let balloonsMade = 0;
// what a balloon can carry round a point, nearest first: what lies loose, the words still on the page, pictures, buttons and icons, two lengths of ruled line at most
function piecesRound(x, y, rad, most, first) {
  const gap = r => Math.hypot(Math.max(r.left - x, 0, x - r.left - r.width), Math.max(r.top - y, 0, y - r.top - r.height)),
    near = [],
    word = r => [gap(r), () => wordAt(r.left + r.width / 2, r.top + r.height / 2)];
  for (const b of physics.bodies)
    if (b !== first && !b.constraint && !b.dragged && b.parts?.length) near.push([gap({ left: b.x - b.width / 2, top: b.y - b.height / 2, width: b.width, height: b.height }), () => b]);
  for (const w of wordsNear(x, y, rad)) near.push(word(w.r));
  for (const w of splitNear(x, y, rad, '.chb-word')) if ([...w.children].some(s => !moved.has(s))) near.push(word(w.getBoundingClientRect()));
  for (const { el, r } of thingBoxes()) if (!moved.has(el) && !tooBig(r)) near.push([gap(r), () => liveBody([{ s: el, r }])]);
  for (const L of bordersNear(x, y, rad).sort((p, q) => Math.abs((p.h ? y : x) - p.pos) - Math.abs((q.h ? y : x) - q.pos)).slice(0, 2))
    near.push([Math.abs((L.h ? y : x) - L.pos), () => lineBody(L, L.h ? x : y)]);
  const got = []; for (const [d, make] of near.sort((p, q) => p[0] - q[0])) { if (got.length >= most) break; if (d > rad) break; const b = make(); if (b) got.push(b); } return got;
}
const leadTie = b => { const t = b.ties[0]; if (t) Object.assign(b, { body: t.body, string: t.string, thread: t.thread, point: t.point, tied: t.tied }); };
// a bunch: the nearest piece hangs alone under the knot, the others in pairs below it, each on its own string
function hangTies(ties) {
  let drop = 44;
  for (let i = 0; i < ties.length;) {
    const row = ties.slice(i, i ? i + 2 : 1);
    row.forEach((t, k) => { t.off = row.length < 2 ? 0 : (k ? 1 : -1) * (t.body.width / 2 + 9); t.length = Math.max(6, drop + t.body.height / 2 - STRING_SAG); });
    drop += Math.max(...row.map(t => t.body.height)) + 9;
    i += row.length;
  }
}
function balloon(x, y, taken) {
  const first = taken || pieceAt(x, y, tooBig),
    bodies = [...first ? [first] : [], ...piecesRound(x, y, 130, (LOW ? 3 : 6) - (first ? 1 : 0), first)],
    n = balloonsMade++,
    el = mark(place(balloonSVG([CLAY, GOLD, SKY][n % 3], 0), 0, 0, [-26, -52, 52, 58]));
  el.classList.add('chb-balloon-live'); el.style.transformOrigin = '26px 52px';
  const ties = bodies.map(body => {
    const string = mark(place(inkP('M0 0L1 0', 1.3, .8, ' vector-effect="non-scaling-stroke"').replace('stroke-linecap="round"', 'stroke-linecap="butt"'), 0, 0, [0, -2, 1, 4]));
    string.classList.add('chb-balloon-string');
    if (!reduce) string.style.opacity = '0';
    return { body, string, thread: string.querySelector('path'), off: 0, length: 40, tied: false, point: null };
  });
  const b = {
    ties,
    body: null,
    string: null,
    thread: null,
    el,
    ghost: !ties.length,
    x,
    baseX: x,
    y: y + KNOT * .12,
    cy: y,
    size: .12,
    tilt: 0,
    v: 0,
    age: 0,
    next: 0,
    high: null,
    tied: false,
    phase: n * 1.7,
    point: null
  };
  el._balloon = b;
  hangTies(ties);
  // (nothing to carry: an empty body keeps the loop awake while it goes up, and is what the loop stops for)
  if (b.ghost) { b.body = physics.add({ x, y, width: 1, height: 1, homeX: x, homeY: y, parts: [], thin: true }); physics.constrain(b.body, { x, y, sway: reduce ? 0 : .01 }); } else leadTie(b);
  balloons.push(b);
  if (reduce) {
    b.size = 1;
    if (ties.length) { b.x = b.baseX = b.body.x; b.y = b.body.y - 42; } else { b.y = y + KNOT; later(() => dropBalloon(b), 1400); }
    for (const t of ties) { t.tied = true; t.point = physics.constrain(t.body, { x: t.body.x, y: t.body.y - 42, length: 32 }); }
    leadTie(b);
  }
  else { for (const t of ties) physics.constrain(t.body, { x: t.body.x, y: t.body.y, sway: .01 }); physicsFrame(0); }
  drawBalloons(); shown(); return b;
}
// a piece is held where it lay until the balloon has gone past it; then its string goes on with just the slack it needs, so it swings in under the balloon and is drawn up
function tieOn(b, t) {
  const { body } = t, dx = body.x - b.x - t.off, dy = body.y - b.y, d = Math.hypot(dx, dy) || 1;
  t.tied = true;
  t.point = physics.constrain(body, { x: b.x + t.off, y: b.y, length: Math.max(1, d - STRING_SAG * Math.max(0, dy) / d), stiffness: 130, damping: 17, sway: 5, angle: body.angle });
  t.string.style.opacity = '';
  t.string.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 110 });
  b.v *= .55;
  leadTie(b);
}
function flyBalloon(b, dt) {
  b.age += dt; const time = physics.time, u = Math.min(1, b.age / SWELL) - 1, sway = Math.min(1, b.age / 1.6), carrying = b.ties.length > 0; b.size = .12 + .88 * (1 + 2.2 * u * u * u + 1.2 * u * u);
  if (u > -.4) { b.v += ((carrying ? 68 : 104) - b.v) * Math.min(1, dt * 1.7); b.cy -= b.v * dt; } if (carrying && b.cy + KNOT <= BALLOON_TOP) { b.high ??= time; b.cy = BALLOON_TOP - KNOT; }
  const bob = b.high == null ? 0 : time - b.high;
  b.y = b.cy + KNOT * b.size + Math.sin(bob * 1.8) * 3 * Math.min(1, bob / 1.2);
  b.x = b.baseX + Math.sin(time * 1.4 + b.phase) * 7 * sway;
  b.tilt = Math.cos(time * 1.4 + b.phase) * 3 * sway;
  if (b.ghost && b.y < -8) { dropBalloon(b); return; }
  let free = b.age > SWELL * .85 && time >= b.next; const calm = Math.exp(-dt * 1.5);
  for (const t of b.ties) { const { body } = t; if (!t.tied) { if (free && (b.y < body.y - body.height / 2 - 2 || b.high != null)) { tieOn(b, t); free = false; b.next = time + .09; } continue; }
    const q = t.point;
    if (body.constraint !== q) continue;
    q.x = b.x + t.off;
    q.y = b.y;
    q.length = q.length < t.length ? Math.min(t.length, q.length + b.v * dt) : Math.max(t.length, q.length - 130 * dt);
    const dy = body.y - b.y; q.angle = Math.max(-26, Math.min(26, -Math.atan2(body.x - q.x, Math.max(dy, 20)) * 57.3 * Math.max(0, Math.min(1, dy / 70)) - t.off * .1)); body.vx *= calm; }
}
function dropBalloon(b) {
  const i = balloons.indexOf(b);
  if (i >= 0) balloons.splice(i, 1);
  for (const el of [b.el, ...b.ties.map(t => t.string)]) { const k = marks.indexOf(el); if (k >= 0) marks.splice(k, 1); el.remove(); }
  if (b.ghost) physics.remove(b.body);
}
function popBalloon(b) {
  if (!balloons.includes(b)) return;
  const { ties, x } = b, y = b.y - KNOT * b.size;
  dropBalloon(b);
  physics.batch(() => { for (const t of ties) physics.release(t.body); });
  const burst = mark(place(PA ? fresh(pickOf(PA.burst)) : burstSVG(16), x, y, [-24, -24, 48, 48]));
  burst.classList.add('chb-balloon-pop');
  if (!reduce)
    burst.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.2)', opacity: 0 }], { duration: 260, fill: 'forwards' }).onfinish = () => burst.remove();
  else later(() => burst.remove(), 150);
  if (!reduce)
    for (let q = 0; q < 6; q++) {
      const c = mark(place(PA ? fresh(pickOf(PA.scrap)) : ART.foil(), x, y, [-10, -10, 20, 20]));
      c.classList.add('chb-balloon-shred');
      const [k, dur] = toss(x, y, J(240), -100 - rnd() * 180, J(600), 4);
      c.animate(k, { duration: dur, easing: 'linear', fill: 'forwards' });
    }
}
// ---------------------------------------------------------------- gravity: loose letters, a handle that aims the force
let gravityHandle = null, gravityX = 0, gravityY = 2300, gravityPull = 2300, gravitySpeed = 0;
// one apple: it lands where the page is clicked and the tool is put away, so nothing is left in the hand while it is there
function gravity(x = innerWidth / 2, y = innerHeight / 2 + 80) {
  gravityFall();
  if (!gravityHandle) {
    gravityHandle = mark(place(gravityArt(), 0, 0, [-16, -22, 32, 68]));
    gravityHandle.classList.add('chb-gravity-handle');
    gravityHandle._x = x;
    gravityHandle._y = Math.min(y, innerHeight - 50);
  }
  drawGravity();
  shown();
  if (tool === 'gravity') pick(null);
}
// every read comes first (where the loose pieces lie, where the words are, their type); then one pass of writes
function gravityFall(fresh = false) {
  types = new WeakMap(); const loose = [];
  if (!fresh)
    for (const s of moved) {
      const c = s._c;
      if (!c?.isConnected || s._halves) continue;
      const b = s._body,
        p = b?.parts.find(q => q.s === s),
        r = p ?
          { left: p.r.left + b.x - b.homeX, top: p.r.top + b.y - b.homeY, width: p.r.width, height: p.r.height, right: p.r.right + b.x - b.homeX, bottom: p.r.bottom + b.y - b.homeY } :
          c.getBoundingClientRect();
      if (inView(r)) loose.push({ s, r });
    }
  for (const s of PAGE().querySelectorAll('.chb-ch')) { if (moved.has(s)) continue; const r = s.getBoundingClientRect(); if (inView(r)) loose.push({ s, r }); }
  const things = []; for (const { el, r } of thingBoxes()) if (!moved.has(el)) { lookReady(el); things.push({ s: el, r }); } const thin = [...linesInView(), ...dotsInView()];
  const pieces = atCeiling(piecesOf(wordsInView(), Math.max(60, PIECES - loose.length - things.length)));
  for (const p of pieces) p.type = typeIn(p.node.parentElement);
  for (const p of loose) if (!p.s._thing && !p.s._line && !p.s._dot) p.s._type = typeOf(p.s);
  physics.batch(() => {
    copies = document.createDocumentFragment();
    wrapPieces(pieces);
    const all = [...loose, ...pieces, ...things].sort((a, b) => b.r.top + b.r.height / 2 - a.r.top - a.r.height / 2);
    for (const group of clumps(all, PIECES)) {
      const body = liveBody(group);
      if (body && group.every(p => p.s._line || p.s._dot)) body.thin = true;
      if (reduce) physics.settle(body); else { physics.force(body, J(70), J(110)); if (body && !body.thin) body.spin = J(34) * body.tumble; }
    }
    // (a ruled length or a bullet never shares a body: it falls alone, a rule tipping over as it goes)
    for (const p of thin) {
      const body = liveBody([p]);
      body.thin = true;
      if (reduce) physics.settle(body); else { physics.force(body, J(60), J(90)); body.spin = p.r.height > p.r.width ? (rnd() < .5 ? -1 : 1) * (150 + rnd() * 90) : J(60); }
    }
    layer.append(copies); copies = null; });
}
// The force line is the pull: 12 px at its gentlest, 132 at its hardest, heavier as it grows, green below the normal pull and hot above it. Held, the apple stretches with its speed.
const mix = (from, to, k) => { const c = i => Math.round(parseInt(from.substr(i, 2), 16) * (1 - k) + parseInt(to.substr(i, 2), 16) * k); return `rgb(${c(1)},${c(3)},${c(5)})`; };
function drawGravity() {
  if (!gravityHandle) return;
  const k = Math.max(0, (gravityPull - 450) / 5150),
    len = 12 + 120 * Math.pow(k, 1.1),
    hot = Math.min(1, Math.max(0, (gravityPull - 2300) / 1700)),
    cool = Math.max(0, (2300 - gravityPull) / 1850),
    ink = hot ? mix('#141413', '#D9431E', hot) : mix('#141413', '#7D8B5F', cool),
    width = 1.8 + 3.4 * k,
    tip = R(14 + len + 2),
    held = interaction?.kind === 'gravity' ? Math.min(1, gravitySpeed / 2600) : 0;
  gravityHandle.style.transform = 'translate(' +
    R(gravityHandle._x) +
    'px,' +
    R(gravityHandle._y) +
    'px) rotate(' +
    R(Math.atan2(gravityY, gravityX) * 180 / Math.PI - 90) +
    'deg)' +
    (held ? ' scale(' + R(1 - held * .14) + ',' + R(1 + held * .26) + ')' : '');
  const shaft = gravityHandle.querySelector?.('.chb-g-shaft'), head = gravityHandle.querySelector?.('.chb-g-head');
  shaft?.setAttribute('d', 'M0 14V' + R(14 + len));
  shaft?.setAttribute('stroke', ink);
  shaft?.setAttribute('stroke-width', R(width));
  head?.setAttribute('transform', 'translate(0 ' + tip + ') scale(' + R(1 + k * .9) + ') translate(0 -42)');
  head?.setAttribute('stroke', ink);
  head?.setAttribute('stroke-width', R(width / (1 + k * .9)));
}
// the handle aims once a frame, however many moves arrive in it
let tilt = null, tiltFrame = 0;
// While the apple is held the pull is how fast it is moving now: quicker pulls harder, slower eases off, stopped is the gentlest pull there is, and letting go keeps what it had
const pullAt = speed => Math.max(450, Math.min(5600, 2300 * Math.pow(speed / 900, .7)));
function paceGravity(i, e) {
  const t = stamp(e), dt = t - (i.paceAt || 0);
  if (i.paceAt && dt < 3) return;
  if (i.paceAt) gravitySpeed = gravitySpeed * .55 + Math.hypot(e.clientX - i.paceX, e.clientY - i.paceY) / dt * 450;
  i.paceAt = t;
  i.paceX = e.clientX;
  i.paceY = e.clientY;
}
const pullGravity = () => { physics.setGravity(gravityX, gravityY, gravityPull * .52); drawGravity(); };
function tiltGravity(x, y) { tilt = [x, y]; if (!tiltFrame) tiltFrame = requestAnimationFrame(aimGravity); }
function aimGravity() {
  cancelAnimationFrame(tiltFrame);
  tiltFrame = 0;
  if (!tilt) return;
  const dx = tilt[0] - innerWidth / 2, dy = tilt[1] - innerHeight / 2, d = Math.hypot(dx, dy), held = interaction?.kind === 'gravity';
  if (held) { gravityPull = pullAt(gravitySpeed); gravitySpeed *= .86; } else tilt = null;
  if (d >= 8) { gravityX = dx / d * gravityPull; gravityY = dy / d * gravityPull; pullGravity(); }
  if (held) tiltFrame = requestAnimationFrame(aimGravity);
}
function flipGravity() { gravityY = gravityY < 0 ? gravityPull : -gravityPull; gravityX = 0; pullGravity(); }

// ---------------------------------------------------------------- the live tools' drawings (portals and their handles, the gravity apple, the magnet)
const PCOL = {"in":["#E4602C","#FF9B62","#FFF1E0","#3A1205","228,96,44"],"out":["#1C7FDC","#66BCFF","#EAF7FF","#05223E","28,127,220"]};
// A gate is a stack of canvases in one flat wrapper (the wrapper's squash is the perspective), each painted once, in the plane of the ring, with the rim at radius 60: a soft bloom that
// has to show on white paper so it is colour, not light added; a dark well; the tube of the rim, saturated with a white-hot middle; then bands of fine strands. The bands turn on CSS
// transforms alone, inner ones faster, so an open portal costs no paint at all. A strand is one tapered ribbon filled once.
function strand(g, a0, sweep, r0, r1, w, wave = 0, phase = 0) {
  const n = Math.max(6, Math.ceil(Math.abs(sweep) / .12));
  g.beginPath();
  for (let i = 0; i <= n * 2 + 1; i++) {
    const back = i > n,
      t = (back ? n * 2 + 1 - i : i) / n,
      half = w * Math.sin(Math.PI * t) ** .75 * (back ? -.5 : .5),
      a = a0 + sweep * t,
      r = r0 + (r1 - r0) * t + wave * Math.sin(phase + t * 6.3) + half,
      x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
}
const stops = (f, list) => { for (const [at, colour] of list) f.addColorStop(at, colour); return f; }, tint = (rgb, a) => `rgba(${rgb},${a})`, hot = a => `rgba(255,255,255,${a})`;
const GATE = {
  bloom(g, [c,,,, rgb]) {
    g.fillStyle = stops(g.createRadialGradient(0, 0, 44, 0, 0, 118), [[0, tint(rgb, .8)], [.2, tint(rgb, .46)], [.46, tint(rgb, .17)], [.74, tint(rgb, .05)], [1, tint(rgb, 0)]]);
    g.beginPath();
    g.arc(0, 0, 118, 0, TURN);
    g.fill();
  },
  well(g, [c, c2, c3, deep, rgb]) {
    g.fillStyle = stops(g.createRadialGradient(0, 10, 3, 0, 0, 60), [[0, '#000001'], [.46, '#030406'], [.8, deep], [.96, c], [1, c2]]);
    g.beginPath();
    g.arc(0, 0, 60, 0, TURN);
    g.fill();
    g.fillStyle = stops(g.createRadialGradient(
      0,
      0,
      46,
      0,
      0,
      74), [[0, tint(rgb, 0)], [.2, tint(rgb, .95)], [.42, c], [.47, c2], [.495, c3], [.5, '#FFFFFF'], [.505, c3], [.53, c2], [.58, c], [.8, tint(rgb, .95)], [1, tint(rgb, 0)]]);
    g.beginPath();
    g.arc(0, 0, 74, 0, TURN);
    g.arc(0, 0, 46, TURN, 0, true);
    g.fill();
  },
  // the swirl going down: long fine strands that tighten towards the middle and die out before it, so the bottom of the well stays black
  outer(g, [c, c2, c3,, rgb], k) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0, n = 135 * k; i < n; i++) {
      const r0 = 52 - rnd() * 10, pick = rnd();
      g.fillStyle = pick < .62 ? tint(rgb, .3) : pick < .92 ? c2 + '48' : c3 + '38';
      strand(g, rnd() * TURN, 1.5 + rnd() * 1.5, r0, r0 * (.48 + rnd() * .2), 1.1 + rnd() * 1.5);
    }
  },
  inner(g, [c, c2,,, rgb], k) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0, n = 110 * k; i < n; i++) {
      const r0 = 36 - rnd() * 9;
      g.fillStyle = rnd() < .7 ? tint(rgb, .19) : c2 + '26';
      strand(g, rnd() * TURN, 1.8 + rnd() * 1.8, r0, r0 * (.34 + rnd() * .2), .9 + rnd() * 1.2);
    }
  },
  // the energy on the rim: very many fine strands running round it, a few of them white-hot currents; a second band turns the other way against the first
  rim(g, [c, c2, c3,, rgb], k) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0, n = 240 * k; i < n; i++) {
      const r = 53 + rnd() * 14, pick = rnd();
      g.fillStyle = pick < .66 ? tint(rgb, .4) : pick < .93 ? c2 + '66' : hot(.42);
      strand(g, rnd() * TURN, .3 + rnd() * 1.1, r, r + J(2.4), .6 + rnd() * .9, J(1.3), rnd() * 6);
    }
    for (let i = 0; i < 6; i++) { g.fillStyle = hot(.85); strand(g, rnd() * TURN, .6 + rnd() * .9, 60 + J(1.2), 60 + J(1.2), 1.3 + rnd() * .7, J(.8), rnd() * 6); }
  },
  against(g, [c, c2, c3,, rgb], k) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0, n = 150 * k; i < n; i++) {
      const r = 55 + rnd() * 10;
      g.fillStyle = rnd() < .85 ? c2 + '58' : hot(.34);
      strand(g, rnd() * TURN, .4 + rnd() * 1, r, r + J(2), .6 + rnd() * .8, J(1), rnd() * 6);
    }
    for (let i = 0, n = 60 * k; i < n; i++) {
      const r = 64 + rnd() * 3;
      g.fillStyle = rnd() < .7 ? tint(rgb, .46) : c2 + '60';
      strand(g, rnd() * TURN, .35 + rnd() * .5, r, r + 6 + rnd() * 11, .7 + rnd() * .7);
    }
  },
  glints(g, [, c2, c3,, rgb], k) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0, n = 15 * k; i < n; i++) {
      const a = rnd() * TURN, r = 58 + rnd() * 6, x = Math.cos(a) * r, y = Math.sin(a) * r, size = 2.4 + rnd() * 2.6;
      g.fillStyle = stops(g.createRadialGradient(x, y, 0, x, y, size), [[0, '#FFFFFF'], [.3, c3], [.6, tint(rgb, .5)], [1, tint(rgb, 0)]]);
      g.beginPath();
      g.arc(x, y, size, 0, TURN);
      g.fill();
      g.fillStyle = hot(.8);
      strand(g, a - .05, .1, r, r, 1);
    }
  }
};
// [how it paints, half the canvas's span, its resolution as a share of the full one, seconds a turn, the other way round, pulsing]
const GATE_SHEETS = LOW ?
  [['bloom', 120, .25], ['well', 78, 1], ['outer', 78, 1, 5.4], ['rim', 78, 1, 4.2]] :
  [['bloom', 120, .25], ['well', 78, 1], ['outer', 78, 1, 6.8], ['inner', 78, 1, 3.1], ['rim', 78, 1, 4.6], ['against', 78, 1, 7.4, true], ['glints', 78, 1, 9.5, false, true]];
function makeGate(key) {
  const el = document.createElement('div'),
    wrap = document.createElement('div'),
    hit = document.createElement('div'),
    full = LOW ? 170 : Math.round(210 * Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1))),
    col = PCOL[key],
    k = LOW ? .55 : 1;
  el.className = 'chb-portal-live';
  wrap.className = 'chb-portal-wrap';
  hit.className = 'chb-portal-hit';
  el.append(wrap, hit);
  for (const [name, half, share, seconds, back, pulse] of GATE_SHEETS) {
    const c = document.createElement('canvas'), side = c.width = c.height = Math.round(full * share), g = c.getContext?.('2d', { willReadFrequently: true });
    Object.assign(c.style, { left: -half + 'px', top: -half + 'px', width: half * 2 + 'px', height: half * 2 + 'px' });
    if (g) { g.translate(side / 2, side / 2); g.scale(side / (half * 2), side / (half * 2)); GATE[name](g, col, k); }
    if (seconds && !reduce) {
      c.classList.add('chb-portal-spin');
      if (pulse) c.classList.add('chb-portal-pulse');
      c.style.setProperty('--turn', seconds + 's');
      c.style.setProperty('--way', back ? 'reverse' : 'normal');
      c.style.animationDelay = -R(rnd() * seconds) + 's';
    }
    wrap.append(c);
  }
  el._wrap = wrap; return el; }
const knobArt = c => `<g><circle r="7.5" fill="#E2B865" stroke="#141413" stroke-width="1.4"/><circle cx="-2.2" cy="-2.4" r="2" fill="#FFF3D6" opacity=".9"/><path d="M-11 -2A11 11 0 0 1 4 -10.6" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><path d="M4 -10.6l-4.2 -.6M4 -10.6l-1.6 3.8" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/></g>`;
const edgeArt = c => `<g><path d="M-9 -6L8 -6.6L9 6.4L-8.4 6.8Z" fill="#FFFDF8" stroke="#141413" stroke-width="1.3" stroke-linejoin="round"/><path d="M-5 0H5M-5 0l2.6 -2.4M-5 0l2.6 2.4M5 0l-2.6 -2.4M5 0l-2.6 2.4" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/></g>`;
const gravityArt = () => `<g><path class="chb-g-shaft" d="M0 14V40" stroke="#141413" stroke-width="2.2" stroke-linecap="round"/><path class="chb-g-head" d="M-7 33L0 42L7 33" fill="none" stroke="#141413" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-12 20V30M12 22V31" stroke="#141413" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>
<path d="M-12.6 1C-13.4 -9 -6 -13 0 -9C6 -13 13.4 -9 12.6 1C11.8 10 5 14 0 12C-5 14 -11.8 10 -12.6 1Z" fill="#D9573B" transform="translate(1.2 1.4)"/>
<path d="M-12.6 1C-13.4 -9 -6 -13 0 -9C6 -13 13.4 -9 12.6 1C11.8 10 5 14 0 12C-5 14 -11.8 10 -12.6 1Z" fill="none" stroke="#141413" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M-7 -4C-8 0 -7 4 -5 6" stroke="#FFFDF8" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".6"/>
<path d="M0 -9C0 -13 1 -16 3 -18" stroke="#141413" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M2 -15C6 -19 11 -18 12 -14C8 -12 4 -12 2 -15Z" fill="#9CCB8E" stroke="#141413" stroke-width="1.3" stroke-linejoin="round"/></g>`;
const magnetArt = (repel = false) => { const L = repel ? '#4F93C9' : '#D9573B', Rc = repel ? '#D9573B' : '#4F93C9';
  const lines = [10, 16, 22].map((r, i) => repel ? `<path d="M${-14 - r * .2} 18C${-14 - r} ${18 + r * .8} ${14 + r} ${18 + r * .8} ${14 + r * .2} 18" fill="none" stroke="#141413" stroke-width="1" stroke-dasharray="3 3" opacity="${.5 - i * .12}"/><path d="M0 ${18 + r * .62}v4" stroke="#141413" stroke-width="1.1" opacity="${.5 - i * .12}"/>`
    : `<path d="M-14 22C-14 ${22 + r} 14 ${22 + r} 14 22" fill="none" stroke="#141413" stroke-width="1" opacity="${.5 - i * .12}"/>`).join('');
  return `<g>${lines}<path d="M-20 -14C-20 -30 20 -30 20 -14V16H8V-12C8 -18 -8 -18 -8 -12V16H-20Z" fill="#C9D6DF" transform="translate(1.3 1.5)"/>
<path d="M-20 4H-8V16H-20Z" fill="${L}"/><path d="M8 4H20V16H8Z" fill="${Rc}"/>
<path d="M-20 -14C-20 -30 20 -30 20 -14V16H8V-12C8 -18 -8 -18 -8 -12V16H-20Z" fill="none" stroke="#141413" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M-20 4H-8M8 4H20" stroke="#141413" stroke-width="1.4"/><path d="M-15 -14C-15 -24 -6 -26 0 -26" fill="none" stroke="#FFFDF8" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
${repel ? '<path d="M-14 20l-3 6M-14 20l3 6M14 20l-3 6M14 20l3 6" stroke="#E2B865" stroke-width="1.6" stroke-linecap="round"/>' : '<path d="M-14 20v5M14 20v5" stroke="#E2B865" stroke-width="1.6" stroke-linecap="round"/>'}</g>`; };
// ---------------------------------------------------------------- portals: a way in (clay) and a way out (blue)
const portals = [];
// (the gates are painted when the tool is picked up, so a click only has to show one)
const gates = {}, gateFor = key => { const g = gates[key] || makeGate(key); delete gates[key]; layer.append(g); return g; }; let portalTurn = 0;
const facing = y => y > innerHeight / 2 ? -Math.PI / 2 : Math.PI / 2;
const gateOpens = p => p.el._wrap?.animate?.([{ transform: 'scale(.14,.06)', opacity: .3 }, { transform: 'scale(1,.42)', opacity: 1 }], { duration: D(420), easing: 'cubic-bezier(.16,.84,.3,1)' });
// a third click does not wipe the pair: each new click takes the portal that has stood longest to the new place, and the other goes on working
function portal(x, y) {
  if (portals.length === 2) {
    const p = portals[0].turn <= portals[1].turn ? portals[0] : portals[1];
    p.x = x;
    p.y = y;
    p.angle = facing(y);
    p.turn = ++portalTurn;
    gateOpens(p);
    drawPortal(p);
    syncPortals();
    shown();
    return p;
  }
  const key = portals.length ? 'out' : 'in',
    el = mark(gateFor(key)),
    knob = mark(place(knobArt(PCOL[key][0]), 0, 0, [-14, -14, 26, 24])),
    edge = mark(place(edgeArt(PCOL[key][0]), 0, 0, [-11, -9, 22, 18])),
    halo = mark(glow(x, y, 105, PCOL[key][4], .45)),
    p = { x, y, size: 120, angle: facing(y), el, knob, edge, halo, homeX: x, homeY: y, turn: ++portalTurn, near: false };
  knob.classList.add('chb-portal-knob');
  edge.classList.add('chb-portal-edge');
  halo.classList.add('chb-portal-halo');
  el._portal = knob._portal = edge._portal = p;
  knob._portalAction = 'rotate';
  edge._portalAction = 'resize';
  portals.push(p);
  gateOpens(p);
  drawPortal(p);
  syncPortals();
  shown();
  return p;
}
// the handles only come out when the pointer is near that portal
function nearPortals(x, y) {
  for (const p of portals) {
    const near = interaction?.portal === p || Math.hypot(x - p.x, y - p.y) < p.size * .8 + 44;
    if (near !== p.near) { p.near = near; p.knob.classList.toggle('is-near', near); p.edge.classList.toggle('is-near', near); }
  }
}
function drawPortal(p) {
  const degrees = p.angle * 180 / Math.PI + 90, nx = Math.cos(p.angle), ny = Math.sin(p.angle), k = p.size / 120, reach = p.size * .21 + 26;
  p.el.style.transform = 'translate(' + R(p.x) + 'px,' + R(p.y) + 'px) rotate(' + R(degrees) + 'deg) scale(' + Math.round(k * 1000) / 1000 + ')';
  p.knob.style.transform = 'translate(' + R(p.x + nx * reach) + 'px,' + R(p.y + ny * reach) + 'px)';
  p.edge.style.transform = 'translate(' + R(p.x - ny * (p.size * .5 + 18)) + 'px,' + R(p.y + nx * (p.size * .5 + 18)) + 'px)';
  p.halo.style.transform = 'translate(' + R(p.x - p.homeX) + 'px,' + R(p.y - p.homeY) + 'px) scale(' + R(k) + ')';
}
function syncPortals() { physics.setPortals(portals.map(({ x, y, size, angle }) => ({ x, y, size, angle }))); pourWake(); }

// ---------------------------------------------------------------- the tray and the input
// rarity: the gentle tools are common, the strong ones rare, so being dealt a black hole feels like a prize
const TIERNAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const btnHTML = ([k, name, box]) => `<button type="button" data-tool="${k}" data-tier="${TIER[k] || 'common'}" aria-pressed="false"><svg viewBox="${box}">${ART[k]()}</svg><span>${name}</span>${!opts.all && TIERNAME[TIER[k]] ? `<em class="chb-tier">${TIERNAME[TIER[k]]}</em>` : ''}</button>`;
let last = opts.lastTool || ''; if (!last) try { last = localStorage.getItem('reserve:last-play-tool') || ''; } catch {}
const dealt = Object.hasOwn(TIER, opts.deal) ? opts.deal : deal({ random: opts.random || Math.random, last });
const OFFER = opts.all ? TOOLS : [TOOLS.find(t => t[0] === dealt)];
if (!opts.all) try { localStorage.setItem('reserve:last-play-tool', dealt); } catch {}
// only the shelves that hold a tool
const shelf = g => { const on = OFFER.filter(t => t[4] === g); return on.length ? `<div class="chb-shelf" data-group="${g}">${on.map(btnHTML).join('')}</div>` : ''; };
tray.innerHTML = shelf('weapon') + shelf('play');
// the one tool dealt is revealed like a prize: it pops in; from rare up, drawn rays fan out behind it once and a shine
// crosses it; epic and legendary throw sparkles; legendary's rays are gold
if (!opts.all && opts.reveal !== false) {
  const b = tray.querySelector('button'), tier = b?.dataset.tier || 'common';
  if (b && !reduce) { box.querySelector('.chb-box')?.classList.add('chb-dealt'); b.classList.add('chb-reveal');
  if (tier !== 'common' && tier !== 'uncommon') {
    const col = { rare: '#9DB4C8', epic: '#DE9A7C', legendary: GOLD }[tier], n = tier === 'legendary' ? 16 : 12, rays = [...Array(n)].map((_, i) => {
      const a = i / n * 6.2832, a2 = a + 6.2832 / n * .45, r1 = 44 + (i % 2) * 8;
      return `<path d="M0 0L${R(Math.cos(a) * r1)} ${R(Math.sin(a) * r1)}L${R(Math.cos(a2) * r1)} ${R(Math.sin(a2) * r1)}Z" fill="${col}" opacity=".85"/>` + inkP(`M${R(Math.cos(a) * 14)} ${R(Math.sin(a) * 14)}L${R(Math.cos(a) * r1)} ${R(Math.sin(a) * r1)}`, 1, .35);
    }).join('');
   // the rays sit in the tray behind the card (a child would paint over the card's face)
   b.insertAdjacentHTML('afterbegin', '<i class="chb-shine" aria-hidden="true"></i>'); tray.insertAdjacentHTML('afterbegin', `<svg class="chb-rays" viewBox="-52 -52 104 104" aria-hidden="true" style="left:${b.offsetLeft + b.offsetWidth / 2}px;top:${b.offsetTop + b.offsetHeight * .42}px">${rays}</svg>`); b.style.zIndex = '1';
   if (tier === 'epic' || tier === 'legendary')
     for (let i = 0; i < (tier === 'legendary' ? 14 : 8); i++) {
       const a = Math.random() * 6.2832, d = 34 + Math.random() * 30, s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
       s.setAttribute('viewBox', '-6 -6 12 12');
       s.setAttribute('class', 'chb-spark');
       s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<path d="M0 -5.4C.6 -1.2 1.2 -.6 5.4 0C1.2 .6 .6 1.2 0 5.4C-.6 1.2 -1.2 .6 -5.4 0C-1.2 -.6 -.6 -1.2 0 -5.4Z" fill="${tier === 'legendary' ? GOLD : '#F2DC8E'}"/>` + inkP('M0 -5.4C.6 -1.2 1.2 -.6 5.4 0C1.2 .6 .6 1.2 0 5.4C-.6 1.2 -1.2 .6 -5.4 0C-1.2 -.6 -.6 -1.2 0 -5.4Z', .8, .7);
    s.style.setProperty('--dx', R(Math.cos(a) * d) + 'px'); s.style.setProperty('--dy', R(Math.sin(a) * d) + 'px'); s.style.animationDelay = R(.25 + Math.random() * .35) + 's'; b.append(s); } } } }
let tool = null, down = false;
const HOW = Object.fromEntries(TOOLS.map(t => [t[0], t[3]]));
function pick(name) {
  if (name && (dead || opts.allowed?.() === false)) name = null;
  if (tool === 'magnet') letGo();
  releaseInteraction(true);
  release();
  // the apple is already out: the button drops only what is on screen and has not fallen yet, and everything fallen stays where it lies
  if (name === 'gravity' && gravityHandle) {
    gravityFall(true);
    if (!reduce) gravityHandle.animate?.([{ scale: 1 }, { scale: 1.22, offset: .4 }, { scale: 1 }], { duration: 280, easing: 'ease-out' });
    name = null;
  }
  tool = tool === name ? null : name;
  for (const b of tray.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  document.documentElement.classList.toggle('chb-armed', !!tool);
  document.documentElement.dataset.chbTool = tool || '';
  aimFor = null;
  if (!tool) aimOff();
  if (tool === 'portal') ['in', 'out'].forEach((key, i) => later(() => { if (!gates[key] && portals.length <= i) gates[key] = makeGate(key); }, 40 + i * 90));
}
// the aim: a drawn crosshair that always marks where the pointer is while a tool is in hand (the system cursor is hidden
// only while the aim is showing), with the tool itself as a small badge beside it. Kept out of #chb-layer: never undone.
const aim = document.getElementById('chb-aim') || Object.assign(document.createElement('div'), { id: 'chb-aim' });
aim.setAttribute('aria-hidden', 'true'); if (!aim.isConnected) document.documentElement.append(aim);
let aimFor = null;
function aimArt(k) {
  const t = TOOLS.find(t => t[0] === k), acc = t[4] === 'weapon' ? DEEP : SAGE2, rim = ring(0, 0, 10.5, 10.5, 9, .035);
  const halo = (d, w) => `<path d="${d}" fill="none" stroke="${PAPER}" stroke-width="${w}" stroke-linecap="round" stroke-opacity=".92"/>`;
  const ticks = [0, 1, 2, 3].map(i => {
    const a = i * 1.5708 + J(.05), c = Math.cos(a), si = Math.sin(a), d = `M${R(c * 13.6)} ${R(si * 13.6)}L${R(c * (19 + J(.6)))} ${R(si * (19 + J(.6)))}`;
    return halo(d, 4.6) + inkP(d, 1.9);
  }).join('');
  const hatch = [0, 1, 2].map(i => { const a = .5 + i * .22, c = Math.cos(a), si = Math.sin(a); return inkP(`M${R(c * 6.6)} ${R(si * 6.6)}L${R(c * 8.6)} ${R(si * 8.6)}`, 1, .5); }).join('');
  aim.innerHTML = `<svg class="chb-ret" viewBox="-21 -21 42 42"><g class="chb-ticks">${ticks}</g><g class="chb-spin">${halo(over(rim), 5.2)}<path d="${over(off(rim, 1.3, 1.1))}" fill="none" stroke="${acc}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="21 9 13 12" opacity=".85"/>${inkP(over(rim), 1.9)}${hatch}</g>`
    + `<path d="${closed(ring(0, 0, 2.8, 2.8, 6, .05))}" fill="${PAPER}" opacity=".92"/><path d="${closed(ring(.2, .2, 1.5, 1.5, 6, .08))}" fill="${INK}"/></svg>`
    + `<svg class="chb-badge" viewBox="-16 -16 32 32">${shp(ring(0, 0, 13, 12, 8, .06), PAPER, 1.6, true)}<svg x="-10" y="-10" width="20" height="20" viewBox="${t[2]}">${ART[k]()}</svg></svg>`;
  aimFor = k;
}
// (on Home the tray lives in a shadow root: at the document an event's target is the host, so the path says what was really hit)
const hit = e => e.composedPath?.()[0] || e.target;
function aimAt(e) {
  const show = opts.allowed?.() !== false && !!tool && !(opts.ours && hit(e).closest?.(opts.ours)) && e.pointerType !== 'touch' && !hit(e).closest?.('.chb-box') && e.target.tagName !== 'IFRAME';
  if (show && aimFor !== tool) aimArt(tool);
  if (show) aim.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  aim.classList.toggle('is-on', show); document.documentElement.classList.toggle('chb-aiming', show);
}
function aimOff() { aim.classList.remove('is-on', 'is-down'); document.documentElement.classList.remove('chb-aiming'); }
const aimPulse = () => {
  if (!reduce)
    aim.querySelector('.chb-ret')?.animate(
      [{ transform: 'none' }, { transform: 'scale(.78)', offset: .35 }, { transform: 'scale(1.12)', offset: .7 }, { transform: 'none' }],
      { duration: 260, easing: 'ease-out' });
};
listen(document, 'pointerover', aimAt, true);
listen(document, 'pointerout', e => { if (!e.relatedTarget) aimOff(); }, true);
listen(globalThis, 'blur', aimOff);
tray.addEventListener('click', e => { const b = e.target.closest('button[data-tool]'); if (b) { e.stopPropagation(); pick(b.dataset.tool); } });
const notOurs = e => !tool || opts.allowed?.() === false || hit(e).closest?.('#chb-tray,#chb-undo') || !!(opts.ours && hit(e).closest?.(opts.ours));
let restoring = false;
const CLICK = { bomb, hammer, railgun, blackhole, foil, ink, garden, balloon, portal, gravity };
let interaction = null, swallowUntil = -1, swallowX = 0, swallowY = 0;
const stamp = e => Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now();
const managed = e => e.target.closest?.('.chb-physics-body,.chb-balloon-live,.chb-gravity-handle,.chb-portal-live,.chb-portal-knob,.chb-portal-edge');
const ownedInput = e =>
  opts.allowed?.() !== false && !(opts.ours && hit(e).closest?.(opts.ours)) && !hit(e).closest?.('#chb-tray,#chb-undo') && (!tool || ['portal', 'gravity', 'balloon', 'magnet'].includes(tool));
function captureInteraction(e, value) {
  interaction = { ...value, id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, target: e.target };
  try { e.target.setPointerCapture?.(e.pointerId); } catch {}
  e.preventDefault();
  e.stopPropagation();
}
function releaseInteraction(cancelled = false, e) {
  if (!interaction || e && e.pointerId !== interaction.id) return;
  const i = interaction;
  interaction = null;
  if (i.body) physics.dragEnd(i.body, cancelled ? (e ? stamp(e) : performance.now()) + 1000 : stamp(e || {}));
  if (i.kind === 'gravity') { if (i.moved) { aimGravity(); gravitySpeed = 0; drawGravity(); } else if (!cancelled) flipGravity(); }
  if (i.kind === 'balloon' && !cancelled) popBalloon(i.balloon);
  if (i.kind === 'body' && !i.moved && !cancelled && e && tool === 'balloon') { aimPulse(); balloon(e.clientX, e.clientY, i.body.constraint ? null : i.body); }
  if (i.kind !== 'pending' || i.moved) { swallowUntil = (e ? stamp(e) : performance.now()) + 450; swallowX = e?.clientX ?? i.startX; swallowY = e?.clientY ?? i.startY; }
  try { i.target.releasePointerCapture?.(i.id); } catch {}
}
listen(document, 'click', e => {
  if (stamp(e) <= swallowUntil && Math.hypot(e.clientX - swallowX, e.clientY - swallowY) < 8 && !hit(e).closest?.('#chb-tray,#chb-undo')) {
    swallowUntil = -1;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (notOurs(e)) return;
  e.preventDefault();
  e.stopPropagation();
  if (restoring) return;
  if (CLICK[tool]) aimPulse();
  CLICK[tool]?.(e.clientX, e.clientY);
}, true);
listen(document, 'pointerdown', e => {
  if (restoring || e.isPrimary === false || e.button > 0 || interaction) return;
  if (portals.length) nearPortals(e.clientX, e.clientY);
  const target = managed(e);
  if (ownedInput(e) && target) {
    if (target._balloon) { captureInteraction(e, { kind: 'balloon', balloon: target._balloon }); return; }
    if (target === gravityHandle) { captureInteraction(e, { kind: 'gravity' }); return; }
    if (target._portal) {
      const p = target._portal, action = target._portalAction || 'move';
      p.turn = ++portalTurn;
      captureInteraction(e, { kind: 'portal', portal: p, action, dx: p.x - e.clientX, dy: p.y - e.clientY, rim: p.size / 2 - Math.hypot(e.clientX - p.x, e.clientY - p.y) });
      nearPortals(e.clientX, e.clientY);
      return;
    }
    if (target._body && tool !== 'magnet') {
      let body = target._body;
      if (body.retired) { body = physics.add({ ...body, awake: true, retired: false }); for (const p of body.parts) p.s._body = p.c._body = body; }
      physics.dragStart(body, e.clientX, e.clientY, stamp(e));
      captureInteraction(e, { kind: 'body', body });
      return;
    }
  }
  if (notOurs(e)) return;
  e.preventDefault();
  if (tool === 'portal') { captureInteraction(e, { kind: 'pending' }); return; }
  if (HOW[tool] !== 'drag') return;
  down = true;
  aim.classList.add('is-down');
  if (tool === 'eraser') erase(e.clientX, e.clientY);
  if (tool === 'magnet') { if (magnetEl) flipMagnet(); else magnet(e.clientX, e.clientY); }
  if (tool === 'laser') laser(e.clientX, e.clientY, true);
  if (tool === 'painter') paint(e.clientX, e.clientY, true);
}, true);
listen(document, 'pointermove', e => {
  if (opts.allowed?.() === false) { pick(null); return; }
  if (restTimer || resting) stir();
  aimAt(e);
  if (portals.length) nearPortals(e.clientX, e.clientY);
  if (interaction && interaction.id === e.pointerId) {
    const i = interaction;
    if (Math.hypot(e.clientX - i.startX, e.clientY - i.startY) > 4) i.moved = true;
    if (i.kind === 'pending' && i.moved) { const body = pieceAt(i.startX, i.startY); i.kind = 'body'; if (body) { i.body = body; physics.dragStart(body, i.startX, i.startY, stamp(e) - 16); } }
    if (i.body) physics.dragMove(i.body, e.clientX, e.clientY, stamp(e));
    if (i.kind === 'gravity' && i.moved) { gravityHandle._x = e.clientX; gravityHandle._y = e.clientY; paceGravity(i, e); tiltGravity(e.clientX, e.clientY); }
    if (i.kind === 'portal') {
      const p = i.portal;
      if (i.action === 'rotate')
        p.angle = Math.atan2(e.clientY - p.y, e.clientX - p.x);
      else if (i.action === 'resize')
        p.size = Math.max(40, Math.min(220, (Math.hypot(e.clientX - p.x, e.clientY - p.y) + i.rim) * 2));
      else { p.x = Math.max(4, Math.min(innerWidth - 4, e.clientX + i.dx)); p.y = Math.max(4, Math.min(innerHeight - 4, e.clientY + i.dy)); }
      drawPortal(p);
      syncPortals();
    }
    e.preventDefault();
    return;
  }
  if (tool === 'magnet' && magnetEl) magnet(e.clientX, e.clientY);
  if (!down) return;
  if (tool === 'eraser') erase(e.clientX, e.clientY);
  if (tool === 'laser') laser(e.clientX, e.clientY);
  if (tool === 'painter') paint(e.clientX, e.clientY);
}, true);
const release = () => {
  if (!down) return;
  down = false;
  aim.classList.remove('is-down');
  if (tool !== 'magnet') letGo();
  laserOff();
  paintOff();
  eraserEl?._sh?.remove();
  eraserEl?.remove();
  eraserEl = null;
};
listen(document, 'pointerup', e => { releaseInteraction(false, e); release(); }, true);
listen(document, 'pointercancel', e => { releaseInteraction(true, e); release(); if (tool === 'magnet') letGo(); }, true);
listen(document, 'wheel', e => {
  const target = managed(e);
  if (!ownedInput(e) || !target?._portal || restoring) return;
  e.preventDefault();
  e.stopPropagation();
  const p = target._portal;
  p.size = Math.max(40, Math.min(220, p.size - Math.sign(e.deltaY) * 10));
  drawPortal(p);
  syncPortals();
}, { capture: true, passive: false });
listen(document, 'contextmenu', e => {
  if (tool !== 'magnet' || notOurs(e) || restoring) return;
  e.preventDefault();
  e.stopPropagation();
  if (magnetEl) flipMagnet(); else magnet(e.clientX, e.clientY);
}, true);
listen(document, 'keydown', e => { if (restTimer || resting) stir(); if (e.key === 'Escape') { releaseInteraction(true); if (tool) pick(tool); else letGo(); } });
listen(globalThis, 'blur', () => { releaseInteraction(true); release(); letGo(); });

function returnFold(f, duration, easing) {
  const from = getComputedStyle(f.el).transform; f.a.cancel();
  const back = { ...f, a: f.el.animate([{ transform: from }, { transform: f.own || 'none' }], { duration: D(duration), easing }) };
  returning.add(back); back.a.onfinish = () => { f.el.style.transform = f.prev.t; f.el.style.transformOrigin = f.prev.o; back.a.cancel(); returning.delete(back); tidy(f.el); };
}
// ---------------------------------------------------------------- put it back: letters home along their own paths, lines mended, the page unfolded
undo.addEventListener('click', () => {
  if (restoring) return;
  // nothing still pending may land after the page is restored; drawings caught mid-way (not marks) go at once
  for (const id of timers) clearTimeout(id);
  timers.clear();
  restoring = true;
  unwatch();
  mendAt = 0;
  releaseInteraction(true);
  tilt = null;
  letGo();
  physicsView.clear();
  balloons.length = 0;
  portals.length = 0;
  pouring.length = pourReady.length = pourTimer = 0;
  gravityHandle = null;
  gravityX = gravitySpeed = 0;
  gravityY = gravityPull = 2300;
  physics.setGravity(0, 2300);
  {
    const keepers = new Set(marks);
    for (const s of moved) { if (s._c) keepers.add(s._c); for (const h of s._halves || []) keepers.add(h); }
    for (const el of [...layer.children, ...MUL.children, ...OVL.children, ...SCR.children]) if (!keepers.has(el)) el.remove();
  }
  if (tool) pick(tool); letGo(); laserOff(); paintOff(); let longest = 400;
  for (const [w, st] of painted) w.classList.remove('chb-painted', st); painted.clear();
  for (const f of folds.splice(0)) { returnFold(f, 1100, 'cubic-bezier(.2,.9,.3,1)'); longest = Math.max(longest, 1100); }
  const held = new Map(); for (const s of moved) if (s._c && !s._physicsPath) held.set(s, [getComputedStyle(s._c).transform, s._c.getAnimations()]);
  for (const s of moved) try {
    // (taken off the page by the host: its own text stands, there is nowhere to fly home to)
    if (!s.isConnected && !s._line && !s._dot) { s._c?.remove(); for (const h of s._halves || []) h.remove(); continue; }
    if (s._ghost) { s.style.visibility = ''; continue; }
    if (s._halves) {
      for (const h of s._halves)
        h.animate([{ transform: getComputedStyle(h).transform }, { transform: 'none' }], { duration: D(360), fill: 'forwards' }).onfinish = () => { h.remove(); s.style.visibility = ''; };
      continue;
    }
    if (s._c?.dataset.chbHeld != null) { s._c.remove(); s.style.visibility = ''; continue; }
    if (s._c) {
      const c = s._c,
        [from, running] = held.get(s) || [c.style.transform || 'none', []],
        home = s._physicsPath ? [...s._physicsPath].reverse().map(f => ({ ...f })) : [{ transform: from }, { transform: 'none' }];
      if (s._physicsPath) { home[0] = { transform: from }; home.push({ transform: 'none' }); }
      running.forEach(a => a.cancel());
      c.style.transition = 'none';
      c.style.transform = 'none';
      c.animate(home, { duration: D(520), easing: 'cubic-bezier(.3,0,.2,1)' }).onfinish = () => { c.remove(); s.style.visibility = ''; tidy(s); };
      longest = Math.max(longest, 520);
      continue;
    }
    if (s._line || s._dot) continue;
    const r = s.getBoundingClientRect(), cs = getComputedStyle(s);
    let c = document.createElement('span');
    if (s._thing)
      c = thingCopy(s, r);
    else {
      c.textContent = s.textContent;
      Object.assign(c.style, { position: 'absolute', left: r.left + 'px', top: r.top + 'px', font: cs.font, color: cs.color, lineHeight: r.height + 'px', whiteSpace: 'pre' });
    }
    layer.append(c);
    // the path home is the flight reversed (timed stops mirrored so they stay in order)
    if (s._home) s._k = s._home();
    if (s._k) { const back = [...s._k].reverse().map(f => { const g = { ...f, opacity: 1 }; if (f.offset != null) g.offset = 1 - f.offset; delete g.easing; return g; });
      c.animate(back, { duration: D(s._d / 1.6), easing: 'cubic-bezier(.3,0,.2,1)' }).onfinish = () => { c.remove(); s.style.visibility = ''; }; longest = Math.max(longest, s._d / 1.6); }
    else c.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: D(360) }).onfinish = () => { c.remove(); s.style.visibility = ''; };
  } catch { s.style.visibility = ''; s._c?.remove(); }
  clearTimeout(sweep);
  clearTimeout(fallTimer);
  sweep = fallTimer = 0;
  falling.length = 0;
  sheetMap = cutSheet = cutRun = null;
  cutGlow?.remove();
  FLOOR.clear();
  HITS.length = 0;
  PINS.length = 0;
  flat = false;
  ruled = textIndex = thingIndex = null;
  unrest();
  for (const m of marks.splice(0)) m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(400), fill: 'forwards' }).onfinish = () => m.remove();
  setTimeout(() => {
    for (const [el, sides] of lines) { for (const side in sides) el.style['border' + side + 'Color'] = sides[side].inline; tidy(el); }
    lines.clear();
    for (const [li, inline] of dots) { li.style.listStyleType = inline; tidy(li); }
    dots.clear();
    for (const [el, inline] of hushed) { el.style.visibility = inline; tidy(el); }
    hushed.clear();
    for (const { holder, node } of splits.splice(0)) if (holder.isConnected && (holder.classList.contains('chb-split') || holder.classList.contains('chb-run'))) holder.replaceWith(node);
    for (const s of moved) {
      if (s._thing) { if (s._style == null) s.removeAttribute('style'); else s.setAttribute('style', s._style); delete s._thing; delete s._look; delete s._paint; delete s._style; }
      delete s._ghost;
      delete s._c;
      delete s._k;
      delete s._home;
      delete s._halves;
      delete s._body;
      delete s._physicsPath;
    }
    moved.clear();
    undo.style.display = 'none';
    restoring = false;
  }, reduce ? 0 : longest + 80);
});
// Teardown is synchronous: a disabled feature never waits for the animated Undo path to finish.
function reset() {
  cancelWork();
  timers.clear();
  releaseInteraction(true);
  pick(null);
  letGo();
  laserOff();
  paintOff();
  eraserEl?._sh?.remove();
  eraserEl?.remove();
  eraserEl = null;
  physicsView.clear();
  for (const animation of ourAnimations()) animation.cancel(); pageAnimations.clear(); heldAnimations.clear();
  for (const f of [...folds.splice(0), ...returning]) { f.a.cancel(); f.el.style.transform = f.prev.t; f.el.style.transformOrigin = f.prev.o; } returning.clear();
  for (const [el, sides] of lines) for (const side in sides) el.style['border' + side + 'Color'] = sides[side].inline;
  lines.clear(); for (const [li, inline] of dots) { li.style.listStyleType = inline; tidy(li); } dots.clear();
  for (const [word, style] of painted) word.classList.remove('chb-painted', style); painted.clear();
  for (const s of moved) {
    s.style.visibility = ''; s._c?.remove(); for (const h of s._halves || []) h.remove();
    if (s._thing) { if (s._style == null) s.removeAttribute('style'); else s.setAttribute('style', s._style); delete s._thing; delete s._look; delete s._style; }
    for (const key of ['_c', '_k', '_halves', '_body', '_physicsPath']) delete s[key];
  }
  moved.clear(); for (const { holder, node } of splits.splice(0)) if (holder.parentNode) holder.replaceWith(node);
  for (const el of [...layer.children]) if ([MUL, OVL, SCR].includes(el)) { for (const child of [...el.children]) child.remove(); } else el.remove();
  marks.length = holes.length = HITS.length = PINS.length = balloons.length = portals.length = plants.length = 0;
  FLOOR.clear(); flat = false; thingIndex = null; gravityHandle = null; gravityX = 0; gravityY = gravityPull = 2300; physics.setGravity(0, 2300);
  undo.style.display = 'none'; restoring = false; cancelWork();
}
function setMotion(value) {
  opts.motion = value; const next = reducedQuery.matches || ['still', 'off'].includes(value);
  if (next === reduce) return;
  reset(); reduce = next; physics.setReduced(next); document.documentElement.classList.toggle('chb-reduced', reduce);
}
function visibility() {
  const off = hidden(); document.documentElement.classList.toggle('chb-paused', off);
  if (off) {
    if (pausedAt === null) pausedAt = nativeNow(); aimOff(); releaseInteraction(true); release();
    for (const job of frameJobs.values()) { if (job.native != null) globalThis.cancelAnimationFrame(job.native); job.native = null; }
    for (const job of timeoutJobs.values()) { if (job.native != null) globalThis.clearTimeout(job.native); job.native = null; }
    for (const a of ourAnimations()) if (a.playState === 'running') { heldAnimations.add(a); a.pause(); }
  } else {
    if (pausedAt !== null) { pausedTime += nativeNow() - pausedAt; pausedAt = null; }
    for (const a of heldAnimations) if (a.playState === 'paused') a.play(); heldAnimations.clear();
    for (const job of frameJobs.values()) if (job.native == null) startFrame(job);
    for (const job of timeoutJobs.values()) if (job.native == null) startTimeout(job);
  }
}
listen(document, 'visibilitychange', visibility);
if (reducedQuery.addEventListener) listen(reducedQuery, 'change', () => setMotion(opts.motion));
listen(globalThis, 'pagehide', () => destroy());
function destroy() {
  if (dead) return; dead = true; reset(); physicsView.destroy();
  for (const remove of listeners) remove(); box.querySelector('.chb-box')?.remove(); layer.remove(); aim.remove();
  document.documentElement.classList.remove('chb-armed', 'chb-aiming', 'chb-reduced', 'chb-paused');
  delete document.documentElement.dataset.chbTool;
}
visibility();
return {
  physics,
  physicsView,
  balloons,
  portals,
  flipMagnet,
  flipGravity,
  popBalloon,
  ART,
  TOOLS,
  scarSVG,
  crackSVG,
  burstSVG,
  bomb,
  hammer,
  laser,
  laserOff,
  railgun,
  blackhole,
  foil,
  erase,
  magnet,
  letGo,
  ink,
  paint,
  paintOff,
  garden,
  balloon,
  gravity,
  portal,
  pick,
  shake,
  setMotion,
  dealt,
  get tool() {
  return tool;
}, destroy, undo: () => undo.click() };
};
globalThis.ReservePlay = { mount, deal, tiers: TIER, weights: CHANCE };
})();
