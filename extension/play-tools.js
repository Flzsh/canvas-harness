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
const TIER = Object.freeze({ painter: 'common', garden: 'common', balloon: 'common', ink: 'common', eraser: 'common', magnet: 'common', hammer: 'rare', gravity: 'rare', portal: 'rare', laser: 'rare', bomb: 'epic', railgun: 'epic', blackhole: 'legendary', foil: 'legendary' });
const ODDS = Object.freeze({ common: 50, rare: 30, epic: 15, legendary: 5 });
// Tier weights are probabilities for the whole tier, then each eligible tool shares that tier equally.
// Supplying an RNG makes the public deal reproducible without changing the drawing's own seeded randomness.
function deal({ random = Math.random, last = '' } = {}) {
  const roll = () => { const value = Number(random()); return Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0; };
  const pool = Object.keys(TIER).filter(key => key !== last), tiers = Object.keys(ODDS).filter(tier => pool.some(key => TIER[key] === tier));
  let value = roll() * tiers.reduce((sum, tier) => sum + ODDS[tier], 0), tier = tiers.at(-1);
  for (const key of tiers) { value -= ODDS[key]; if (value < 0) { tier = key; break; } }
  const choices = pool.filter(key => TIER[key] === tier);
  return choices[Math.floor(roll() * choices.length)];
}
const mount = (opts = {}) => {
const listeners = [], listen = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener?.(type, fn, options)); };
if (globalThis.ReserveFeatures?.enabled('play') === false) return null;
let dead = false, serial = 0, pausedAt = null, pausedTime = 0;
const nativeNow = () => globalThis.performance.now(), hidden = () => document.hidden || document.visibilityState === 'hidden';
if (hidden()) pausedAt = nativeNow();
const performance = { now: () => (pausedAt ?? nativeNow()) - pausedTime };
const frameJobs = new Map(), timeoutJobs = new Map(), pageAnimations = new Set(), heldAnimations = new Set();
function startFrame(job) { if (!dead && !hidden()) job.native = globalThis.requestAnimationFrame(() => { frameJobs.delete(job.id); if (!dead) job.fn(performance.now()); }); }
function requestAnimationFrame(fn) { if (dead) return 0; const job = { id: ++serial, fn }; frameJobs.set(job.id, job); startFrame(job); return job.id; }
function cancelAnimationFrame(id) { const job = frameJobs.get(id); if (job?.native != null) globalThis.cancelAnimationFrame(job.native); frameJobs.delete(id); }
function startTimeout(job) { if (!dead && !hidden()) job.native = globalThis.setTimeout(() => { timeoutJobs.delete(job.id); if (!dead) job.fn(); }, Math.max(0, job.at - performance.now())); }
function setTimeout(fn, ms = 0) { if (dead) return 0; const job = { id: ++serial, fn, at: performance.now() + ms }; timeoutJobs.set(job.id, job); startTimeout(job); return job.id; }
function clearTimeout(id) { const job = timeoutJobs.get(id); if (job?.native != null) globalThis.clearTimeout(job.native); timeoutJobs.delete(id); }
function cancelWork() { for (const id of frameJobs.keys()) cancelAnimationFrame(id); for (const id of timeoutJobs.keys()) clearTimeout(id); }
// ---------------------------------------------------------------- the hand (the art skill's rules, in miniature)
let seed = 31; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647, J = a => (rnd() * 2 - 1) * a, R = v => Math.round(v * 10) / 10;
const ring = (cx, cy, rx, ry, n = 9, j = .06) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + J(.2), k = 1 + J(j); p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); } return p; };
const closed = pts => { const n = pts.length; let d = `M${R(pts[0][0])} ${R(pts[0][1])}`; for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]; d += `C${R(p1[0] + (p2[0] - p0[0]) / 6)} ${R(p1[1] + (p2[1] - p0[1]) / 6)} ${R(p2[0] - (p3[0] - p1[0]) / 6)} ${R(p2[1] - (p3[1] - p1[1]) / 6)} ${R(p2[0])} ${R(p2[1])}`; } return d + 'Z'; };
const over = pts => { const q = [...pts, pts[0], [(pts[0][0] * 2 + pts[1][0]) / 3, (pts[0][1] * 2 + pts[1][1]) / 3]]; let d = `M${R(q[0][0])} ${R(q[0][1])}`; for (let i = 0; i < q.length - 1; i++) { const p0 = q[Math.max(0, i - 1)], p1 = q[i], p2 = q[i + 1], p3 = q[Math.min(q.length - 1, i + 2)]; d += `C${R(p1[0] + (p2[0] - p0[0]) / 6)} ${R(p1[1] + (p2[1] - p0[1]) / 6)} ${R(p2[0] - (p3[0] - p1[0]) / 6)} ${R(p2[1] - (p3[1] - p1[1]) / 6)} ${R(p2[0])} ${R(p2[1])}`; } return d; };
const lerp = (a, b, k) => a + (b - a) * k, TAU = Math.PI * 2;
const lin = p => 'M' + p.map(([x, y]) => `${R(x)} ${R(y)}`).join('L') + 'Z';
const INK = '#141413', PAPER = '#FAF9F5', GOLD = '#E2B865', CLAY = '#D97757', DEEP = '#C96442', OAT = '#E3DACC', SLATE = '#6F7F8C', SKY = '#C9D6DF', KRAFT = '#D4A27F', SAGE2 = '#7D8B5F', VOID = '#16181B', DATA = '#7FB86E', DATA2 = '#B7E4A0', DATAINK = '#5E8F4E';
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
  painter: () => shp([[-13, 2], [-2, -6], [11, -2], [9, 9], [-6, 12]], '#E9DCC0', 2, true) + dot(-6, 3, 2.6, CLAY) + dot(0, -1.6, 2.4, GOLD) + dot(5, 4, 2.4, '#5F82BD') + dot(-1, 7, 2.2, '#7D8B5F') + dot(-8, 8.6, 1.6, PAPER)
    + `<g transform="rotate(-38)">${shp([[-1.6, -18], [1.6, -18], [2, -4], [-2, -4]], KRAFT, 1.8)}${shp([[-2.4, -4], [2.4, -4], [2.4, 1], [-2.4, 1]], '#8E9AA4', 1.6)}<path d="M-2.6 1C-3 6 -1 9 0 11C1 9 3 6 2.6 1Z" fill="${DEEP}"/>${inkP('M-2.6 1C-3 6 -1 9 0 11C1 9 3 6 2.6 1', 1.6)}</g>`,
  // a flower in a clay pot: soil, two leaves with veins, petals round a centre
  garden: () => shp([[-8, 6], [8, 6], [6, 17], [-6, 17]], CLAY, 2) + shp([[-9.4, 4], [9.4, 4], [9.4, 7.4], [-9.4, 7.4]], DEEP, 1.8) + `<path d="${closed(ring(0, 4.6, 7.6, 1.6, 6, .1))}" fill="#5B4636"/>` + hat(4, 9, 2, 5, 2.2)
    + `<path d="M0 4C-1 -2 1 -7 0 -11" fill="none" stroke="${SAGE2}" stroke-width="2.2" stroke-linecap="round"/>`
    + `<path d="M0 -1C-4 -1 -9 -4 -9 -7C-5 -8 -2 -5 0 -2Z" fill="#B7C0A0"/>${inkP('M0 -1C-4 -1 -9.4 -4 -9.4 -7.4C-5 -8.4 -1.6 -5 0 -2', 1.6)}${inkP('M-1.4 -2.4L-7 -6', .9, .6)}`
    + `<path d="M0 1C3 0 8 -2 8.6 -5C5 -6 2 -3 .4 0Z" fill="#B7C0A0"/>${inkP('M0 1C3 0 8.6 -2 8.6 -5.4C5 -6.2 2 -3.4 .4 0', 1.6)}`
    + [0, 1, 2, 3, 4].map(k => { const a = k / 5 * 6.28 - 1.57; return `<path d="${closed(ring(Math.cos(a) * 4.6, -12 + Math.sin(a) * 4.6, 3.4, 2.6, 6, .08))}" fill="${GOLD}"/>`; }).join('') + inkP(over(ring(0, -12, 7.6, 7.4, 8, .1)), 1.2, .5) + dot(0, -12, 2.4, DEEP),
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
const burstSVG = r => { const n = 11, pts = []; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * 6.2832 + J(.08), rr = (i % 2 ? r * .52 : r) * (1 + J(.12)); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } const inner = pts.map(([x, y]) => [x * .55, y * .55]); return `<path d="${lin(pts.map(([x, y]) => [x + 2, y + 1.6]))}" fill="${GOLD}"/><path d="${lin(inner.map(([x, y]) => [x + 1.4, y + 1.2]))}" fill="${CLAY}"/>${inkP(lin(pts) + `L${R(pts[0][0] + 2)} ${R(pts[0][1] + 3)}`, 2.6)}${inkP(lin(inner), 1.8, .8)}`; };
const puffSVG = r => `<path d="${closed(ring(1.4, 1.2, r, r * .82, 8, .08))}" fill="${OAT}"/>${inkP(over(ring(0, 0, r, r * .82, 8, .08)), 2, .7)}`;
// the scar: a torn hole showing the back end (binary), cracks out from it written in 0 and 1
let uid = 0;
const scarSVG = r => {
  const id = 'chbS' + (++uid), hole = []; for (let i = 0; i < 15; i++) { const a = i / 15 * 6.2832 + J(.12), k = (i % 2 ? .78 : 1) * (1 + J(.16)); hole.push([Math.cos(a) * r * .5 * k, Math.sin(a) * r * .31 * k]); }
  const lip = hole.map(([x, y]) => [x * 1.14 + J(1), y * 1.18 + J(.8)]);
  let rows = ''; for (let row = -7; row <= 7; row++) rows += `<text x="${R(-r * .62 + J(2))}" y="${R(row * 6.4)}" fill="${rnd() < .25 ? DATA2 : DATA}" opacity="${R(.55 + rnd() * .45)}">${bits(30)}</text>`;
  let cracks = '', defs = ''; for (let c = 0; c < 7; c++) { const a = c / 7 * 6.2832 + J(.35); let pt = [Math.cos(a) * r * .5, Math.sin(a) * r * .31], d = `M${R(pt[0])} ${R(pt[1])}`; const len = r * (.55 + rnd() * .5);
    for (let k = 1; k <= 4; k++) { const aa = a + J(.45); pt = [pt[0] + Math.cos(aa) * len / 4, pt[1] + Math.sin(aa) * len / 4 * .7]; d += `L${R(pt[0])} ${R(pt[1])}`; }
    defs += `<path id="${id}c${c}" d="${d}"/>`; cracks += `<g class="chb-crack"><path d="${d}" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".25" stroke-linecap="round"/><text class="chb-flicker" style="animation-delay:${R(rnd() * 3)}s" font-size="6.4" fill="${INK}" opacity=".62" dy="-1.2"><textPath href="#${id}c${c}">${bits(Math.round(len / 3.6))}</textPath></text></g>`; }
  const embers = [0, 1, 2, 3, 4].map(i => { const q = lip[Math.floor(rnd() * lip.length)]; return `<path class="chb-ember" style="animation-delay:${R(rnd() * 2)}s" d="${closed(ring(q[0] + J(2), q[1] + J(1.5), 1.6 + rnd(), 1.4, 5, .2))}" fill="${GOLD}"/>`; }).join('');
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
const shown = () => { undo.style.display = 'inline'; };
function place(inner, x, y, box) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', box.join(' ')); Object.assign(s.style, { left: x + 'px', top: y + 'px', width: box[2] + 'px', height: box[3] + 'px', marginLeft: box[0] + 'px', marginTop: box[1] + 'px' }); s.innerHTML = inner; layer.append(s); return s; }
const sheet = () => { const s = place('', 0, 0, [0, 0, innerWidth, innerHeight]); s.style.left = s.style.top = '0'; return s; };
function textNodesNear(x, y, rad) {
  const out = [], walk = document.createTreeWalker(PAGE(), NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim() && !n.parentElement.closest(OURS + ',.chb-ch') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
  for (let n; (n = walk.nextNode());) { const r = document.createRange(); r.selectNodeContents(n); for (const b of r.getClientRects()) if (b.right > x - rad && b.left < x + rad && b.bottom > y - rad && b.top < y + rad) { out.push(n); break; } }
  return out;
}
function split(node) {
  const frag = document.createDocumentFragment();
  for (const word of node.nodeValue.split(/(\s+)/)) { if (!word) continue; if (/^\s+$/.test(word)) { frag.append(word); continue; } const w = document.createElement('span'); w.className = 'chb-word'; for (const ch of word) { const s = document.createElement('span'); s.className = 'chb-ch'; s.textContent = ch; w.append(s); } frag.append(w); }
  const holder = document.createElement('span'); holder.className = 'chb-split'; holder.append(frag); node.replaceWith(holder); splits.push({ holder, node });
}
function lettersNear(x, y, rad, test, kept = false) {
  for (const n of textNodesNear(x, y, rad)) split(n); const out = [];
  for (const s of PAGE().querySelectorAll('.chb-ch')) { if (moved.has(s)) continue; const r = s.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = Math.hypot(cx - x, cy - y); if (test ? test(cx, cy, r) : d <= rad) out.push({ s, r, d, cx, cy }); }
  // letters already knocked about (resting copies in our layer: knocked askew, piled on the floor) can be hit again,
  // found where they lie now
  if (kept) for (const s of moved) { const c = s._c; if (!c?.isConnected || s._halves) continue; const tf = getComputedStyle(c).transform, m = new DOMMatrixReadOnly(tf === 'none' ? undefined : tf), w = c.offsetWidth, h = parseFloat(c.style.lineHeight) || c.offsetHeight, left = parseFloat(c.style.left) + m.e, top = parseFloat(c.style.top) + m.f;
    const r = { left, top, width: w, height: h, right: left + w, bottom: top + h }, cx = left + w / 2, cy = top + h / 2, d = Math.hypot(cx - x, cy - y); if (test ? test(cx, cy, r) : d <= rad) out.push({ s, r, d, cx, cy }); }
  return out;
}
// a moved letter is a copy in the fixed layer (it can never stretch the page); the real one is only hidden
function lift(s, r) { if (s._body) { const b = s._body; b.parts = b.parts.filter(p => p.s !== s); if (!b.parts.length) physics.remove(b); delete s._body; } delete s._physicsPath; if (s._c) { s._c.getAnimations?.().forEach(a => a.cancel()); s._c.remove(); delete s._c; }
  const cs = getComputedStyle(s), c = document.createElement('span'); c.textContent = s.textContent; Object.assign(c.style, { position: 'absolute', left: r.left + 'px', top: r.top + 'px', font: cs.font, color: cs.color, lineHeight: r.height + 'px', whiteSpace: 'pre' }); layer.append(c); s.style.visibility = 'hidden'; moved.add(s); return c; }
function fly(s, r, k, dur, delay = 0) { const c = lift(s, r); s._k = k; s._d = D(dur); c.animate(k, { duration: s._d, delay: D(delay), easing: 'linear', fill: 'forwards' }).onfinish = () => c.remove();
  if (!reduce) c.animate([{ textShadow: '0 0 0 rgba(20,20,19,0)' }, { textShadow: '4px 11px 5px rgba(20,20,19,.26)', offset: .25 }, { textShadow: '3px 8px 4px rgba(20,20,19,.2)' }], { duration: s._d, fill: 'forwards' }); }
function keep(s, r, k, dur, easing = 'cubic-bezier(.3,1.4,.5,1)', delay = 0) { const c = lift(s, r); s._c = c; if (!reduce) c.style.textShadow = '1px 3px 2px rgba(20,20,19,.18)'; c.animate(k, { duration: D(dur), delay: D(delay), easing, fill: 'forwards' }); return c; }
const ballistic = (vx, vy, spin, fall = 900, T = 1.1) => { const k = [], ang = Math.atan2(vy, vx) * 180 / Math.PI; for (let i = 0; i <= 10; i++) { const t = i / 10 * T, st = i === 1 ? ` rotate(${R(ang)}deg) scale(1.5,.7) rotate(${R(-ang)}deg)` : '';
  k.push({ transform: `translate(${R(vx * t)}px,${R(vy * t + fall * t * t)}px) rotate(${R(spin * t)}deg)${st}`, opacity: i < 7 ? 1 : 1 - (i - 7) / 3 }); } return k; };
const spiral = (dx, dy, turns = 1.4) => { const k = [], r0 = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx); for (let i = 0; i <= 12; i++) { const t = i / 12, e = t * t, r = r0 * (1 - e), a = a0 + turns * 6.2832 * e; k.push({ transform: `translate(${R(Math.cos(a) * r - dx)}px,${R(Math.sin(a) * r - dy)}px) rotate(${R(turns * 360 * e)}deg) scale(${R((1 - e * .9) * 100) / 100})`, opacity: t < .85 ? 1 : (1 - t) / .15 }); } return k; };

// the page's ruled lines (borders) break too: the part inside a blast leaves in pieces, the rest stays
function bordersNear(x, y, rad) {
  const out = [];
  const root = PAGE(); for (const el of [root, ...root.querySelectorAll('*')]) {
    if (el.closest(OURS)) continue; const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.right < x - rad || r.left > x + rad || r.bottom < y - rad || r.top > y + rad) continue;
    for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
      const w = parseFloat(cs['border' + side + 'Width']); if (!w || cs['border' + side + 'Style'] === 'none' || /,\s*0\)$/.test(cs['border' + side + 'Color'])) continue;
      const h = side === 'Top' || side === 'Bottom', pos = side === 'Top' ? r.top + w / 2 : side === 'Bottom' ? r.bottom - w / 2 : side === 'Left' ? r.left + w / 2 : r.right - w / 2, a = h ? r.left : r.top, b = h ? r.right : r.bottom;
      const dist = Math.abs((h ? y : x) - pos); if (dist >= rad) continue; const half = Math.sqrt(rad * rad - dist * dist), c0 = Math.max(a, (h ? x : y) - half), c1 = Math.min(b, (h ? x : y) + half); if (c1 <= c0) continue;
      out.push({ el, side, h, pos, a, b, w, color: cs['border' + side + 'Color'], cut: [c0, c1] });
    }
  }
  return out;
}
function breakLines(x, y, rad, how = 'out', force = 1) {
  for (const L of bordersNear(x, y, rad)) {
    let sides = lines.get(L.el); if (!sides) lines.set(L.el, sides = {}); let rec = sides[L.side];
    if (!rec) { rec = sides[L.side] = { ...L, keepRanges: [[L.a, L.b]], inline: L.el.style['border' + L.side + 'Color'], svg: sheet() }; L.el.style['border' + L.side + 'Color'] = 'transparent'; }
    const [c0, c1] = L.cut, next = [], gone = [];
    for (const [a, b] of rec.keepRanges) { if (b <= c0 || a >= c1) { next.push([a, b]); continue; } if (a < c0) next.push([a, c0]); if (b > c1) next.push([c1, b]); gone.push([Math.max(a, c0), Math.min(b, c1)]); }
    rec.keepRanges = next;
    rec.svg.innerHTML = next.map(([a, b]) => { const p = rec.h ? [[a, rec.pos], [b, rec.pos]] : [[rec.pos, a], [rec.pos, b]]; return `<path d="M${R(p[0][0])} ${R(p[0][1])}L${R(p[1][0])} ${R(p[1][1])}" stroke="${rec.color}" stroke-width="${rec.w}" fill="none"/>`; }).join('');
    for (const [a, b] of gone) for (let u = a; u < b; u += 18 + rnd() * 10) {
      const v = Math.min(b, u + 18 + rnd() * 10), mid = (u + v) / 2, px = rec.h ? mid : rec.pos, py = rec.h ? rec.pos : mid, dx = px - x, dy = py - y, d = Math.hypot(dx, dy) || 1, len = v - u;
      const piece = place(`<path d="${rec.h ? `M${R(-len / 2)} 0L${R(len / 2)} ${R(J(.6))}` : `M0 ${R(-len / 2)}L${R(J(.6))} ${R(len / 2)}`}" stroke="${rec.color}" stroke-width="${rec.w + .4}" stroke-linecap="round" fill="none"/>`, px, py, [-len / 2 - 4, -len / 2 - 4, len + 8, len + 8]);
      const k = how === 'in' ? spiral(dx, dy) : how === 'drop' ? [{ transform: 'none' }, { transform: `translate(${R(J(6))}px,${R(30 + rnd() * 30)}px) rotate(${R(J(60))}deg)`, opacity: 0 }] : ballistic(dx / d * (force * (1 - d / rad) * .8 + .3) * 420 + J(40), dy / d * (force * (1 - d / rad) * .8 + .3) * 340 - 200 * force, J(540));
      piece.animate(k, { duration: D(how === 'in' ? 900 + d * 4 : 1000 + J(200)), easing: how === 'in' ? 'linear' : 'ease-in', fill: 'forwards' }).onfinish = () => piece.remove();
    }
  }
}
const mark = el => { marks.push(el); return el; };
// what a closed black hole leaves (a pinhole, the back end still turning in it) can itself be broken: anything that hits
// it makes it pop (a flash and a puff of 0 and 1), another black hole swallows it, the foil flattens it
const PINS = [];
function breakPins(test, how = 'pop', delayOf = () => 0) {
  for (let i = PINS.length - 1; i >= 0; i--) { const p = PINS[i]; if (!test(p.x, p.y)) continue; PINS.splice(i, 1); const el = p.el, wait = delayOf(p.x, p.y);
    el.getAnimations?.().forEach(a => a.cancel());
    if (how === 'flat') { el.animate([{ transform: 'none' }, { transform: `scale(${R(2.4 + rnd())},.05)`, opacity: .6, offset: .6 }, { transform: 'scale(4,.02)', opacity: 0 }], { duration: D(600), delay: D(wait), easing: 'cubic-bezier(.7,0,.9,.6)', fill: 'forwards' }).onfinish = () => el.remove(); continue; }
    if (how === 'swallow') { const [hx, hy] = p.to; el.animate([{ transform: 'none' }, { transform: `translate(${R(hx - p.x)}px,${R(hy - p.y)}px) rotate(${R(540 + J(180))}deg) scale(.1)`, opacity: .2 }], { duration: D(900), delay: D(wait), easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' }).onfinish = () => el.remove(); continue; }
    later(() => { if (!el.isConnected) return; light(p.x, p.y, 70, '200,240,190', 360, .9);
      el.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.35)', offset: .25 }, { transform: 'scale(0) rotate(160deg)', opacity: 0 }], { duration: D(420), easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' }).onfinish = () => el.remove();
      if (!reduce) for (let k = 0; k < 12; k++) { const d = document.createElement('span'); d.textContent = rnd() < .5 ? '0' : '1'; Object.assign(d.style, { position: 'absolute', left: R(p.x - 4) + 'px', top: R(p.y - 8) + 'px', font: `700 ${R(10 + rnd() * 6)}px Consolas,'Courier New',monospace`, color: rnd() < .3 ? DATA2 : DATA, textShadow: '0 0 6px rgba(127,184,110,.7)' }); layer.append(d); mark(d);
        const [kf, dur] = toss(p.x, p.y, J(260), -(160 + rnd() * 320), J(720), 14); d.animate(kf, { duration: dur, easing: 'linear', fill: 'both' }); } }, wait); }
}
// ---------------------------------------------------------------- the page itself reacts: light falls on it, things cast shadows on it, blasts stain
// and dent it. Each kind lives on its own fixed sheet with its own blend mode, so it darkens or lights the paper and the
// words underneath (a mark is part of the page, not laid on top of it). The light comes from the upper left.
const blendSheet = (id, mode, above) => { let d = document.getElementById(id); if (!d) { d = document.createElement('div'); d.id = id; d.className = 'chb-blend'; d.style.mixBlendMode = mode; d.setAttribute('aria-hidden', 'true'); if (above) layer.after(d); else layer.before(d); } return d; };
const MUL = blendSheet('chb-mul', 'multiply', false), OVL = blendSheet('chb-ovl', 'overlay', false), SCR = blendSheet('chb-scr', 'screen', true);
const fxEl = (host, x, y, w, h, css = {}) => { const d = document.createElement('div'); Object.assign(d.style, { left: R(x - w / 2) + 'px', top: R(y - h / 2) + 'px', width: R(w) + 'px', height: R(h) + 'px' }, css); host.append(d); return d; };
const soft = (rgb, a, mid = .45) => `radial-gradient(closest-side, rgba(${rgb},${a}), rgba(${rgb},${a * mid}) 55%, rgba(${rgb},0))`;
// a burst of light thrown on the page: brightens what is under it, then fades
function light(x, y, r, rgb = '255,214,150', dur = 600, peak = .85) { if (reduce) return; const d = fxEl(SCR, x, y, r * 2, r * 2, { background: soft(rgb, peak, .35) });
  d.animate([{ opacity: 0, transform: 'scale(.55)' }, { opacity: 1, transform: 'scale(1)', offset: .1 }, { opacity: 0, transform: 'scale(1.2)' }], { duration: D(dur), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => d.remove(); }
// a light that stays while something glows (a laser's hot point, a black hole's disc, a portal)
const glow = (x, y, r, rgb, a = .7) => fxEl(SCR, x, y, r * 2, r * 2, { background: soft(rgb, a, .3) });
// a stain soaked into the paper: grained, darkens paper and ink alike; it stays until "Put it back"
function stain(x, y, rx, ry, rgb = '40,28,16', a = .5, rot = 0, grain = true) { const d = mark(fxEl(MUL, x, y, rx * 2, ry * 2, { background: soft(rgb, a, .5), transform: `rotate(${R(rot)}deg)` })); if (grain) d.classList.add('chb-grain');
  if (!reduce) d.animate([{ opacity: 0, transform: `rotate(${R(rot)}deg) scale(.7)` }, { opacity: 1, transform: `rotate(${R(rot)}deg)` }], { duration: D(520), easing: 'ease-out', fill: 'backwards' }); return d; }
// a dent pressed into the paper: shaded on the side toward the light, lit on the far side (overlay keeps the words readable)
function dent(x, y, r) { const d = mark(fxEl(OVL, x, y, r * 2, r * 2, { background: 'radial-gradient(circle at 64% 68%, rgba(255,255,255,.62), rgba(255,255,255,0) 44%), radial-gradient(circle at 36% 32%, rgba(0,0,0,.5), rgba(0,0,0,0) 50%)' }));
  if (!reduce) d.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: D(240), fill: 'backwards' }); return d; }
// the shadow of something above the page; height 0 = touching (dark, small, sharp), 1 = high (faint, wide, soft)
const shadowCss = h => ({ opacity: String(R((.6 - h * .48) * 100) / 100), transform: `scale(${R((1 + h * .5) * 100) / 100})`, filter: `blur(${R(2 + h * 9)}px)` });
function shadow(x, y, w, h = 0) { const d = fxEl(MUL, x + 6, y + 10, w, w * .34, { background: soft('20,20,19', .9, .55), ...shadowCss(h) }); d.className = 'chb-shadow'; return d; }
const moveShadow = (d, x, y, h) => { const w = parseFloat(d.style.width); Object.assign(d.style, { left: R(x + 6 - w / 2) + 'px', top: R(y + 10 - w * .17) + 'px' }, h == null ? {} : shadowCss(h)); };
const fallShadow = (d, from, to, dur, delay = 0, easing = 'ease-in') => { if (reduce) return; d.animate([shadowCss(from), shadowCss(to)], { duration: D(dur), delay: D(delay), easing, fill: 'forwards' }); };

// the page jolts: amplitude, length and character differ per weapon (the bomb jolts hard, the railgun kicks sideways,
// the black hole rumbles low and long, the hammer knocks once, the foil is silent)
const SHAKE = { foil: [18, 520, 'all'], foiljolt: [8, 240, 'y'], foiljolt2: [6, 220, 'all'], foilrumble: [2.6, 2200, 'rumble'], foilend: [11, 440, 'y'], bomb: [17, 760, 'all'], hammer: [4, 200, 'all'], hammer2: [7, 260, 'all'], hammer3: [12, 420, 'all'], railgun: [13, 400, 'x'], railcharge: [1.4, 900, 'rumble'], close: [9, 360, 'all'], blackhole: [7, 9600, 'build'], bhjolt: [12, 320, 'all'], bhjolt2: [16, 380, 'all'], bhclose: [20, 660, 'all'], gravity: [3, 300, 'y'] };
function shake(kind) {
  const sp = SHAKE[kind]; if (!sp || reduce) return; const [amp, dur, how] = sp, n = how === 'rumble' || how === 'build' ? 70 : 10, k = [];
  for (let i = 0; i <= n; i++) { const f = how === 'build' ? (i === n ? 0 : .45 + .55 * Math.pow(i / n, 1.4)) : how === 'rumble' ? (i === 0 || i === n ? 0 : Math.sin(i / n * Math.PI)) : (1 - i / n) ** 2, a = amp * f;
    const dx = how === 'y' ? 0 : J(a), dy = how === 'x' ? J(a * .15) : J(a); k.push({ transform: i === n ? 'none' : `translate(${R(how === 'x' && i < 3 ? -a : dx)}px,${R(dy)}px)` }); }
  // the effects layer shakes with the page, so cracks, scars and falling pieces (even ones added during a long shake) move with it
  const page = [...document.querySelectorAll(opts.shake || 'body > *:not(#chb-layer)')];
  // Nested Canvas wrappers must not multiply the jolt. The overlay receives the same transform exactly once.
  for (const el of new Set([...page.filter(el => !page.some(parent => parent !== el && parent.contains?.(el))), layer])) {
    const animation = el.animate(k, { duration: dur, easing: 'linear', composite: 'add' });
    pageAnimations.add(animation); animation.onfinish = () => pageAnimations.delete(animation);
  }
}

// ---------------------------------------------------------------- bomb: tears the page open to the back end
function debris(x, y, n, force = 1) { if (!PA || reduce) return; for (let i = 0; i < n; i++) { const a = rnd() * 6.283, v = (160 + rnd() * 260) * force, sc = place(fresh(pickOf(PA.scrap)), x + J(10), y + J(8), [-10, -10, 20, 20]); sc.style.filter = 'drop-shadow(3px 6px 2px rgba(20,20,19,.28))';
  sc.animate(ballistic(Math.cos(a) * v, Math.sin(a) * v * .8 - 220 * force, J(900), 900, 1.2), { duration: 1100 + rnd() * 400, easing: 'linear', fill: 'forwards' }).onfinish = () => sc.remove(); } }
function puffs(x, y, n, spread = 30, rise = 40) { for (let i = 0; i < n; i++) { const a = i / n * 6.28 + J(.4), d = spread * (.6 + rnd() * .6), p = place(PA ? fresh(pickOf(PA.puff)) : puffSVG(14), x + Math.cos(a) * d * .3, y + Math.sin(a) * d * .25, [-26, -22, 52, 44]);
  p.animate([{ transform: 'scale(.3) rotate(0deg)', opacity: 0 }, { transform: `translate(${R(Math.cos(a) * d)}px,${R(Math.sin(a) * d * .6)}px) scale(1.05) rotate(${R(J(10))}deg)`, opacity: 1, offset: .2 }, { transform: `translate(${R(Math.cos(a) * d * 1.35)}px,${R(Math.sin(a) * d * .6 - rise)}px) scale(1.35) rotate(${R(J(20))}deg)`, opacity: 0 }], { duration: D(1500 + rnd() * 500), delay: D(40 + i * 25), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }).onfinish = () => p.remove(); } }
// hit-stop: everything holds still for a beat on impact, which is what makes a hit feel heavy
function ourAnimations() { return [...new Set([...pageAnimations, ...folds.map(f => f.a), ...[...returning].map(f => f.a), ...[layer, aim, box.querySelector('.chb-box')].flatMap(el => el?.getAnimations?.({ subtree: true }) || [])])]; }
function hitStop(ms) { if (reduce) return; for (const a of ourAnimations()) { if (a.playState === 'running') { a.pause(); setTimeout(() => a.play(), ms); } } }
// ---------------------------------------------------------------- things thrown to the floor: real falls, bounces and a pile that grows
// A thrown letter, chip or shard is simulated once (gravity, the sides of the screen, a floor it bounces on and comes to
// rest on, on top of whatever landed there before) and its path is handed to the Web Animations API as keyframes, so
// nothing of ours runs per frame. What lands stays on the floor until "Put it back".
const FLOOR = new Map(), HITS = [], balloons = [];
const physics = globalThis.ReservePlayPhysics.create({ width: innerWidth, height: innerHeight, floor: FLOOR, reduced: reduce });
const physicsView = globalThis.ReservePlayPhysics.attach(physics, { document, requestFrame: requestAnimationFrame, cancelFrame: cancelAnimationFrame, render: renderBody, onFrame: physicsFrame, onRender: drawBalloons });
function renderBody(b) {
  const dx = R(b.x - b.homeX), dy = R(b.y - b.homeY), angle = R(b.angle), c = Math.cos(angle * Math.PI / 180), s = Math.sin(angle * Math.PI / 180), transform = `translate(${dx}px,${dy}px) rotate(${angle}deg)`;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of b.parts || []) {
    p.c.style.transform = transform;
    const x = p.r.left + p.r.width / 2 - b.homeX, y = p.r.top + p.r.height / 2 - b.homeY, cx = b.homeX + dx + x * c - y * s, cy = b.homeY + dy + x * s + y * c, hw = (Math.abs(c) * p.r.width + Math.abs(s) * p.r.height) / 2, hh = (Math.abs(s) * p.r.width + Math.abs(c) * p.r.height) / 2;
    left = Math.min(left, cx - hw); right = Math.max(right, cx + hw); top = Math.min(top, cy - hh); bottom = Math.max(bottom, cy + hh);
    if (!restoring) { const path = p.s._physicsPath; if (!path.length || physics.time - (p.lastPath || 0) > .06) { path.push({ transform }); p.lastPath = physics.time; if (path.length > 100) path.splice(1, 1); } }
  }
  b.bounds = { left, top, right, bottom };
}
function liveBody(items) { if (!items.length) return null; const left = Math.min(...items.map(p => p.r.left)), top = Math.min(...items.map(p => p.r.top)), right = Math.max(...items.map(p => p.r.left + p.r.width)), bottom = Math.max(...items.map(p => p.r.top + p.r.height)), parts = items.map(({ s, r }) => { const c = lift(s, r); s._c = c; s._physicsPath = [{ transform: 'none' }]; c.classList.add('chb-physics-body'); Object.assign(c.style, { width: r.width + 'px', height: r.height + 'px', boxSizing: 'border-box', transformOrigin: `${(left + right) / 2 - r.left}px ${(top + bottom) / 2 - r.top}px` }); return { s, c, r }; }), b = physics.add({ x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top, homeX: (left + right) / 2, homeY: (top + bottom) / 2, bounds: { left, top, right, bottom }, parts }); for (const p of parts) p.s._body = p.c._body = b; shown(); return b; }
function wordAt(x, y) { for (const n of textNodesNear(x, y, 12)) split(n); for (const w of PAGE().querySelectorAll('.chb-word')) { const r = w.getBoundingClientRect(); if (x < r.left - 3 || x > r.right + 3 || y < r.top - 4 || y > r.bottom + 4) continue; const items = [...w.children].filter(s => !moved.has(s)).map(s => ({ s, r: s.getBoundingClientRect() })); return liveBody(items); } return null; }
function physicsFrame(dt) { for (const b of balloons) { if (b.body.retired) continue; b.age += dt; if (!reduce) { if (b.age < 1.2) { const u = 1 - Math.pow(1 - b.age / 1.2, 3); b.y = b.startY + (b.tieY - b.startY) * u; } else { if (!b.tied) tieBalloon(b); b.y = Math.max(56, b.tieY - (b.age - 1.2) * 60); if (b.y === 56) b.y = 59 + Math.sin(physics.time * 1.8 + b.phase) * 3; b.x = b.baseX + Math.sin(physics.time * 1.4 + b.phase) * 7; b.point.x = b.x; b.point.y = b.y; } } } for (const k of caught) if (!k.body.retired && k.body.constraint) { const point = k.body.constraint; point.x = magnetX + k.off[0]; point.y = magnetY + k.off[1]; } }
function drawBalloons() { for (const b of [...balloons]) { if (b.body.retired) { b.el.remove(); b.string.remove(); balloons.splice(balloons.indexOf(b), 1); continue; } b.el.style.transform = `translate(${b.x}px,${b.y}px)`; const bounds = b.body.bounds, dx = (bounds.left + bounds.right) / 2 - b.x, dy = bounds.top - b.y - 1, length = Math.hypot(dx, dy); b.thread.setAttribute('d', `M0 0L${length} 0`); b.string.style.transformOrigin = '0 50%'; b.string.style.transform = `translate(${b.x}px,${b.y + 1}px) rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`; } }
listen(globalThis, 'resize', () => { physics.resize(innerWidth, innerHeight); for (const p of portals) { p.x = Math.max(4, Math.min(innerWidth - 4, p.x)); p.y = Math.max(4, Math.min(innerHeight - 4, p.y)); drawPortal(p); } syncPortals(); });
// the rendered marks (play-space.js): a canvas laid under the flying letters, run on animation frames until it settles
const SPX = () => globalThis.ReservePlaySpace, liveCanvas = cls => { const cv = document.createElement('canvas'); cv.className = cls; layer.prepend(cv); return cv; };
const run = (cv, anim) => { const t0 = performance.now(), tick = now => { if (!cv.isConnected) return; anim.frame((now - t0) / 1000); if (!anim.done) requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
function toss(x0, y0, vx, vy, spin, h = 12, mid = '') {
  const k = [{ transform: mid || 'none' }], g = 2300, dt = 1 / 60; let x = 0, y = 0, a = 0, still = 0, i = 0; const col = () => Math.round((x0 + x) / 7);
  for (; i < 160 && still < 4; i++) {
    vy += g * dt; x += vx * dt; y += vy * dt; a += spin * dt;
    if (x0 + x < 6) { x = 6 - x0; vx = Math.abs(vx) * .45; } if (x0 + x > innerWidth - 6) { x = innerWidth - 6 - x0; vx = -Math.abs(vx) * .45; }
    const fl = innerHeight - 4 - (FLOOR.get(col()) || 0) - h / 2;
    if (y0 + y >= fl && vy > 0) { y = fl - y0; if (vy > 260) { vy = -vy * .34; vx *= .62; spin = -spin * .4; } else { vy = 0; vx *= .5; spin *= .3; still++; } }
    if (i % 3 === 2) k.push({ transform: `translate(${R(x)}px,${R(y)}px) ${mid} rotate(${R(a)}deg)` });
  }
  k.push({ transform: `translate(${R(x)}px,${R(y)}px) ${mid} rotate(${R(a)}deg)` }); { const c = col(); [.12, .3, .55, .3, .12].forEach((w, d) => FLOOR.set(c + d - 2, Math.min(64, (FLOOR.get(c + d - 2) || 0) + h * w * .7))); }
  return [k, Math.max(300, i * dt * 1000)];
}
// bullet time: on the blast everything runs slow for a beat, then catches up
function slowmo(rate, ms) { if (reduce) return; const list = ourAnimations().filter(a => a.playState !== 'finished'); for (const a of list) a.updatePlaybackRate(rate); later(() => { for (const a of list) try { a.updatePlaybackRate(1); } catch {} }, ms); }
// the fireball: a white heart, then yellow, orange, red and a dark smoky rim, each a ragged blob set off its outline
const fireSVG = r => { let out = ''; for (const [k, c] of [[1, '#4A3A30'], [.84, '#B8502A'], [.66, '#EE8A3A'], [.47, '#F8C451'], [.27, '#FFF4CC']]) out += `<path d="${closed(ring(J(2.4), J(2.4), r * k, r * k * .9, 13, .17))}" fill="${c}"/>`; return out + inkP(over(ring(0, 0, r, r * .9, 13, .17)), 2.2, .45); };
// a small flame: an orange tongue with a yellow heart, its outline run past its start
const flameSVG = () => `<path d="M1 7C-4 3 -3.4 -3 0.6 -10C4.4 -3 5 3 1 7Z" fill="#EE8A3A"/><path d="M0.6 5.6C-1.8 3 -1.4 -0.6 0.4 -4.6C2.2 -0.6 2.6 3 0.6 5.6Z" fill="#F8C451"/>` + inkP('M0 6.4C-4.6 2.6 -3.8 -3.4 0 -10C3.8 -3.4 4.4 2.6 0 6.4C-1 5.6', 1.2, .55);
function bomb(x, y) {
  const g = place(ART.bomb(), x, y, [-20, -34, 42, 50]); g.style.filter = 'drop-shadow(1px 2px 1px rgba(20,20,19,.3))';
  const sh = shadow(x, y + 4, 44, 1); fallShadow(sh, 1, 0, 230, 0); fallShadow(sh, 0, .05, 190, 230, 'ease-out');
  const fl = glow(x - 5, y - 30, 30, '255,190,110', .9); fl.style.opacity = '0'; if (!reduce) fl.animate([{ opacity: .4, transform: 'none' }, { opacity: 1 }, { opacity: .55 }, { opacity: .95 }, { opacity: .5, transform: 'translate(-12px,8px)' }], { duration: D(900), delay: D(380), fill: 'forwards' });
  g.animate([{ transform: 'translate(0,-46px) rotate(-14deg)' }, { transform: 'rotate(4deg)', offset: .55, easing: 'ease-in' }, { transform: 'translate(0,-8px) rotate(-2deg)', offset: .75, easing: 'ease-out' }, { transform: 'none' }], { duration: D(420), fill: 'forwards' });
  const fuse = g.querySelector('.fuse'); fuse.style.strokeDasharray = '1'; fuse.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: .98 }], { duration: D(900), delay: D(380), fill: 'forwards' });
  g.querySelector('.spark').animate([{ transform: 'none' }, { transform: 'translate(-6px,1px)', offset: .4 }, { transform: 'translate(-12px,8px)' }], { duration: D(900), delay: D(380), fill: 'forwards' });
  if (!reduce) {
    // the fuse spits sparks as it burns down
    for (let i = 0; i < 14; i++) { const u = i / 14, sx = x + 1 - 12 * u, sy = y - 31 + 8 * u, a = -Math.PI / 2 + J(1.2), v = 90 + rnd() * 120, sp = place(dot(0, 0, 1.3 + rnd(), rnd() < .5 ? GOLD : '#FFE7A8'), sx, sy, [-3, -3, 6, 6]);
      sp.animate(ballistic(Math.cos(a) * v, Math.sin(a) * v, 0, 700, .45), { duration: 420, delay: 380 + u * 900, easing: 'linear', fill: 'both' }).onfinish = () => sp.remove(); }
    // the last moment: it swells and glows red
    g.animate([{ transform: 'none', filter: 'drop-shadow(1px 2px 1px rgba(20,20,19,.3))' }, { transform: 'scale(1.12)', filter: 'drop-shadow(0 0 5px rgba(255,90,40,.8))' }, { transform: 'scale(.97)' }, { transform: 'scale(1.18)', filter: 'drop-shadow(0 0 9px rgba(255,80,30,1))' }], { duration: 360, delay: 1020, composite: 'add', fill: 'forwards' });
  }
  later(() => { g.remove(); sh.remove(); fl.remove(); boom(x, y); }, reduce ? 0 : 1380);
}
function boom(x, y) {
  const R0 = 150; breakPins((px, py) => Math.hypot(px - x, py - y) < R0, 'pop', (px, py) => Math.hypot(px - x, py - y) * .6);
  if (!reduce) {
    // the fireball: rendered (a flash, particles cooling from white through gold and orange to dark red, with bloom)
    if (SPX()?.blast) { const cv = document.createElement('canvas'); cv.className = 'chb-blast'; layer.append(cv); const bl = SPX().blast(cv, x, y, 62, { reduce }), t0 = performance.now(), tick = now => { if (!cv.isConnected) return; bl.frame((now - t0) / 1000); if (bl.done) cv.remove(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    else { const fb = place(fireSVG(70), x, y, [-80, -76, 160, 152]); fb.animate([{ transform: 'scale(.15)', opacity: 1, filter: 'brightness(1.3)' }, { transform: 'scale(1)', offset: .16 }, { transform: 'scale(1.2) translateY(-10px)', opacity: .92, filter: 'brightness(.8)', offset: .5 }, { transform: 'scale(1.45) translateY(-46px)', opacity: 0, filter: 'brightness(.35) grayscale(.6)' }], { duration: 1300, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => fb.remove();
    }
    // the shockwave: a ring of pressed air running out across the page
    const sw = place(`<circle r="50" fill="none" stroke="${PAPER}" stroke-width="7" opacity=".9"/><circle r="50" fill="none" stroke="${INK}" stroke-width="1.4" opacity=".35"/>`, x, y, [-52, -52, 104, 104]);
    sw.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: `scale(${R(R0 * 2.4 / 50)})`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.1,.6,.3,1)', fill: 'forwards' }).onfinish = () => sw.remove();
    // a column of smoke that lingers, leaning with the air (the rendered burn sends up its own thin smoke)
    if (!SPX()?.burn) for (let i = 0; i < 10; i++) { const p = place(PA ? fresh(pickOf(PA.puff)) : puffSVG(14), x + J(18), y - 6, [-26, -22, 52, 44]); p.style.filter = 'grayscale(.6) brightness(.86)';
      p.animate([{ transform: 'scale(.5)', opacity: 0 }, { transform: `translate(${R(J(10))}px,-30px) scale(1.1)`, opacity: .8, offset: .2 }, { transform: `translate(${R(30 + J(30))}px,${R(-150 - rnd() * 90)}px) scale(2.3) rotate(${R(J(40))}deg)`, opacity: 0 }], { duration: 2800 + rnd() * 900, delay: 260 + i * 190, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' }).onfinish = () => p.remove(); }
    // embers drifting up and down, slowly
    for (let i = 0; i < 22; i++) { const a = rnd() * 6.283, v = 120 + rnd() * 320, e = place(dot(0, 0, 1.2 + rnd() * 1.4, rnd() < .4 ? '#FFE7A8' : rnd() < .5 ? GOLD : '#EE8A3A'), x + J(20), y + J(14), [-4, -4, 8, 8]);
      e.animate(ballistic(Math.cos(a) * v, Math.sin(a) * v * .7 - 230, J(200), 240, 2.3), { duration: 2300 + rnd() * 900, easing: 'linear', fill: 'forwards' }).onfinish = () => e.remove(); }
  }
  if (!SPX()?.blast) { const flash = place(PA ? fresh(pickOf(PA.burst)) : burstSVG(46), x, y, [-75, -70, 150, 140]);
  flash.animate([{ transform: 'scale(1.7)', opacity: 1 }, { transform: 'scale(1.7)', opacity: 1, offset: .06 }, { transform: 'scale(.9)', offset: .3 }, { transform: 'scale(1.05)', offset: .55 }, { transform: 'scale(.4) rotate(12deg)', opacity: 0 }], { duration: D(820), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => flash.remove();
  puffs(x, y, 9, 46, 52); }
  debris(x, y, 18, 1.2);
  light(x, y, 360, '255,224,170', 1100, 1); light(x, y, 120, '255,255,242', 340, 1);
  // the mark it leaves: the page shattered open onto the back end (no scorch: a clean break)
  if (SPX()?.shatter) { const cv = mark(liveCanvas('chb-burn')), bn = SPX().shatter(cv, x, y + 4, 60, { reduce }); run(cv, bn); backEnd(bn.outline, cv, x, y + 4); }
  else if (SPX()?.burn) { const cv = mark(liveCanvas('chb-burn')), bn = SPX().burn(cv, x, y + 4, 58, { reduce }); run(cv, bn); if (bn.outline) backEnd(bn.outline, cv, x, y + 4); }
  else { stain(x, y + 8, 160, 104, '36,26,14', .52, J(12)); stain(x + 4, y + 6, 82, 54, '22,16,10', .58, J(20)); mark(place(PA ? fresh(pickOf(PA.scar)) : scarSVG(50), x, y + 4, [-95, -62, 190, 124])); }
  if (!reduce && !SPX()?.burn && !SPX()?.shatter) { // little flames lick along the burnt edge, then go out in a breath of smoke
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + J(.3), f = place(flameSVG(), x + Math.cos(a) * 44, y + 4 + Math.sin(a) * 26, [-6, -11, 12, 19]), life = 2200 + rnd() * 1800; f.style.transformOrigin = '50% 90%';
      f.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.1,1.25)', offset: .06 }, { transform: 'scale(.9,.8) rotate(-8deg)', offset: .2 }, { transform: 'scale(1.05,1.2) rotate(6deg)', offset: .36 }, { transform: 'scale(.85,.9) rotate(-5deg)', offset: .52 }, { transform: 'scale(1,1.1) rotate(4deg)', offset: .7 }, { transform: 'scale(0)', opacity: .6 }], { duration: life, delay: 300 + rnd() * 400, easing: 'ease-in-out', fill: 'both' }).onfinish = () => { f.remove(); puffs(x + Math.cos(a) * 44, y + Math.sin(a) * 26 - 6, 1, 8, 30); }; }
  }
  // the letters in the blast are thrown, bounce and pile up on the floor; those the shockwave reaches further out are
  // knocked askew and stay that way
  let n = 0; for (const { s: l, r, d, cx, cy } of lettersNear(x, y, R0 * 2.3, undefined, true).sort((p, q) => p.d - q.d)) { if (++n > 520) break; const a = Math.atan2(cy - y, cx - x);
    if (d <= R0) { const f = (1 - d / R0) * .75 + .35, [k, dur] = toss(cx, cy, Math.cos(a) * f * 780 + J(90), Math.sin(a) * f * 520 - 560 * f - 120 + J(60), J(900), r.height); keep(l, r, k, dur, 'linear'); }
    else { const f = 1 - (d - R0) / (R0 * 1.3), push = 3 + 11 * f; keep(l, r, [{ transform: 'none' }, { transform: `translate(${R(Math.cos(a) * push * 1.6)}px,${R(Math.sin(a) * push - 4 * f)}px) rotate(${R(J(16) * f)}deg)`, offset: .4 }, { transform: `translate(${R(Math.cos(a) * push)}px,${R(Math.sin(a) * push * .6)}px) rotate(${R(J(12) * f)}deg)` }], 420, 'cubic-bezier(.2,.9,.3,1)', (d - R0) / 1.1); } }
  breakLines(x, y, R0 * .8); shake('bomb'); hitStop(70); slowmo(.3, 380); shown();
  if (!reduce) { const wf = fxEl(SCR, innerWidth / 2, innerHeight / 2, innerWidth, innerHeight, { background: 'rgb(255,250,236)' }); wf.animate([{ opacity: .95 }, { opacity: 0 }], { duration: 240, easing: 'ease-out', fill: 'forwards' }).onfinish = () => wf.remove(); }
}
// ---------------------------------------------------------------- hammer: cracks like glass, with the data in the cracks
function crackSVG(r) {
  let out = '', defs = ''; const id = 'chbK' + (++uid), tips = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832 + J(.3); let p = [0, 0], d = 'M0 0'; const len = r * (.75 + rnd() * .4); for (let k = 1; k <= 4; k++) { const aa = a + J(.35); p = [p[0] + Math.cos(aa) * len / 4, p[1] + Math.sin(aa) * len / 4]; d += `L${R(p[0])} ${R(p[1])}`; } tips.push(a);
    defs += `<path id="${id}${i}" d="${d}"/>`; out += inkP(d, 1.3, .75); if (i % 2 === 0) out += `<text class="chb-flicker" style="animation-delay:${R(rnd() * 3)}s" font-size="5.6" fill="${DATAINK}" ${MONO} dy="-1"><textPath href="#${id}${i}" startOffset="6">${bits(Math.round(len / 4))}</textPath></text>`; }
  for (const rr of [r * .35, r * .7]) out += inkP(lin(tips.map(a => [Math.cos(a) * rr * (1 + J(.15)), Math.sin(a) * rr * (1 + J(.15))])), 1, .5);
  return `<defs>${defs}</defs><path d="${closed(ring(0, 0, 5, 4, 7, .2))}" fill="${VOID}"/>` + out;
}
// the impact frame: a flash of paper with ink lines bursting out of it (two frames, as a drawn hit is shown)
const impactSVG = r => { let out = `<path d="${closed(ring(0, 0, r * .3, r * .3, 9, .12))}" fill="${PAPER}"/>`; for (let i = 0; i < 20; i++) { const a = i / 20 * 6.2832 + J(.12), r0 = r * (.34 + rnd() * .1), r1 = r * (.72 + rnd() * .38), w = 1.1 + rnd() * 2.3, nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
  out += `<path d="M${R(Math.cos(a) * r0 + nx)} ${R(Math.sin(a) * r0 + ny)}L${R(Math.cos(a) * r1)} ${R(Math.sin(a) * r1)}L${R(Math.cos(a) * r0 - nx)} ${R(Math.sin(a) * r0 - ny)}Z" fill="${INK}"/>`; } return out; };
// a shard of the page: a torn polygon of paper, its edge inked
const shardSVG = () => { const n = 3 + (rnd() * 2 | 0), p = []; for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + J(.5), rr = 6 + rnd() * 9; p.push([Math.cos(a) * rr, Math.sin(a) * rr]); } return `<path d="${lin(off(p, 1.4, 1.8))}" fill="#CFC2AC" opacity=".55"/><path d="${lin(p)}" fill="#FFFFFF"/><path d="${lin(p)}" fill="none" stroke="#D9D4C8" stroke-width=".8"/>`; };
function hammer(x, y) {
  // where it struck before, it strikes harder: a second blow spreads the crack, a third shatters the page there
  let hit = HITS.find(h => Math.hypot(h.x - x, h.y - y) < 40); if (!hit) HITS.push(hit = { x, y, n: 0 }); const n = Math.min(3, ++hit.n);
  breakPins((px, py) => Math.hypot(px - x, py - y) < 36, 'pop', () => reduce ? 0 : 480);
  const g = place(ART.hammer(), x + 6, y - 2, [-24, -14, 42, 68]); g.style.transformOrigin = '50% 95%'; g.style.filter = 'drop-shadow(1px 2px 1px rgba(20,20,19,.3))';
  const sh = shadow(x + 12, y + 2, 34, .9); if (!reduce) sh.animate([shadowCss(.9), shadowCss(1), shadowCss(0), shadowCss(.3), shadowCss(1)], { duration: D(820), offsets: undefined, fill: 'forwards' }).onfinish = () => sh.remove(); else sh.remove();
  // the swing: raised, drawn back further (the wind-up), then down hard, a rebound, away
  g.animate([{ transform: 'translate(26px,-24px) rotate(-70deg)' }, { transform: 'translate(36px,-38px) rotate(-98deg)', offset: .46, easing: 'cubic-bezier(.7,0,1,.6)' }, { transform: 'none', offset: .62 }, { transform: 'translate(2px,-6px) rotate(-10deg)', offset: .74 }, { transform: 'translate(30px,-30px) rotate(-70deg)', opacity: 0 }], { duration: D(820), fill: 'forwards' }).onfinish = () => g.remove();
  if (!reduce) { // the smear of the fast swing: three ink arcs that flash and fade
    let d = ''; for (const [rad, w, o] of [[50, 3.2, .5], [57, 2.4, .34], [64, 1.6, .2]]) { let path = ''; for (let i = 0; i <= 10; i++) { const u = i / 10, th = (-98 + 90 * u) * Math.PI / 180, px = 6 + 36 * (1 - u) + rad * Math.sin(th), py = 48 - 38 * (1 - u) - rad * Math.cos(th); path += (i ? 'L' : 'M') + R(px) + ' ' + R(py); } d += inkP(path, w, o); }
    const sm = place(d, x, y, [-90, -90, 180, 180]); sm.animate([{ opacity: 0 }, { opacity: 0, offset: .48 }, { opacity: 1, offset: .58 }, { opacity: 0, offset: .7 }, { opacity: 0 }], { duration: 820, fill: 'forwards' }).onfinish = () => sm.remove(); }
  later(() => strike(x, y, n), reduce ? 0 : 508);
}
function strike(x, y, n) {
  const rad = 64 + n * 22;
  if (!reduce) {
    const f = place(impactSVG(58 + n * 18), x, y, [-110, -110, 220, 220]); f.animate([{ opacity: 1 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: 95, fill: 'forwards' }).onfinish = () => f.remove();
    const rp = place(`<circle r="40" fill="none" stroke="${PAPER}" stroke-width="5" opacity=".85"/><circle r="40" fill="none" stroke="${INK}" stroke-width="1" opacity=".3"/>`, x, y, [-42, -42, 84, 84]);
    rp.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: `scale(${R(rad * 1.7 / 40)})`, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.1,.6,.3,1)', fill: 'forwards' }).onfinish = () => rp.remove();
  }
  let c; if (SPX()?.crackStar) { // the page cracks: a star of cracks, longer and webbed with each blow on the same spot, broken through on the third
    const hit = HITS.find(h => Math.hypot(h.x - x, h.y - y) < 40), hx = hit ? hit.x : x, hy = hit ? hit.y : y; hit?.cv?.remove(); hit?.hole?.remove(); c = mark(liveCanvas('chb-dent')); if (hit) { hit.cv = c; if (hit.seed == null) hit.seed = rnd(); }
    if (n >= 3 && SPX().shatter) { const bn = SPX().shatter(c, hx, hy, 40, { reduce }); run(c, bn); const h2 = backEnd(bn.outline, c, hx, hy); if (hit) hit.hole = h2; }
    else run(c, SPX().crackStar(c, hx, hy, 66, n, { reduce, seed: hit ? hit.seed : rnd() })); }
  else if (SPX()?.dent) { const hit = HITS.find(h => Math.hypot(h.x - x, h.y - y) < 40); hit?.cv?.remove(); c = mark(liveCanvas('chb-dent')); if (hit) hit.cv = c; run(c, SPX().dent(c, x, y, 60 + n * 12, n)); }
  else { c = mark(place(n >= 2 ? crackSVG(70 + n * 18) : PA ? fresh(pickOf(PA.crack)) : crackSVG(54), x, y, [-130, -130, 260, 260])); c.style.transform = `rotate(${R(J(40))}deg)`;
  c.animate([{ transform: c.style.transform + ' scale(.3)', opacity: .5 }, { transform: c.style.transform + ' scale(1.08)', opacity: 1, offset: .6 }, { transform: c.style.transform }], { duration: D(260 + n * 60), easing: 'ease-out' }); }
  hitStop(40 + n * 25);
  if (n >= 3) shatter(x, y);
  else for (const { s, r, d } of lettersNear(x, y, rad, undefined, true)) { const f = 1 - d / rad; keep(s, r, [{ transform: 'none' }, { transform: `translate(${R(J(4) * f)}px,${R(-(8 + rnd() * 16) * f * n)}px) rotate(${R(J(24) * f)}deg)`, offset: .32, easing: 'ease-out' }, { transform: `translate(${R(J(6) * f)}px,${R((3 + rnd() * 5) * f * n)}px) rotate(${R(J(30) * f)}deg)`, offset: .7, easing: 'ease-in' }, { transform: `translate(${R(J(5) * f)}px,${R((2 + rnd() * 4) * f * n)}px) rotate(${R(J(26) * f)}deg)` }], 560); }
  // chips of paper jump out and land on the floor
  if (!reduce) for (let i = 0; i < 4 + n * 3; i++) { const a = -Math.PI / 2 + J(1.4), v = 260 + rnd() * 260 * n, ch = mark(place(shardSVG(), x + J(8), y + J(6), [-16, -16, 32, 32])), [k, dur] = toss(x, y, Math.cos(a) * v, Math.sin(a) * v, J(900), 8); ch.style.transform = 'scale(.45)'; ch.animate(k.map(f => ({ transform: f.transform + ' scale(.45)' })), { duration: dur, easing: 'linear', fill: 'forwards' }); }
  if (!SPX()?.dent) { dent(x, y, 58 + n * 14); stain(x, y + 2, 66 + n * 14, 54 + n * 10, '90,80,66', .2 + n * .05, J(30)); } light(x, y, 64 + n * 16, '255,250,236', 240, .8); if (!SPX()?.dent) puffs(x, y + 6, 3 + n * 2, 22 + n * 6, 18);
  breakLines(x, y, 34 + n * 14, 'drop'); shake(n >= 3 ? 'hammer3' : n === 2 ? 'hammer2' : 'hammer'); shown();
}
// the third blow: the page gives way. Its letters there drop to the floor, shards of it fall after them, and the hole
// shows the back end
function shatter(x, y) {
  if (!SPX()?.dent) mark(place(PA ? fresh(pickOf(PA.scar)) : scarSVG(50), x, y, [-95, -62, 190, 124])).animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'none' }], { duration: D(260), easing: 'ease-out', fill: 'backwards' });   // (the third rendered dent tears its own hole)
  for (const l of moved) { const c = l._c; if (!c || l._halves || !c.isConnected) continue; const b = c.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2; if (Math.hypot(cx - x, cy - y) > 96) continue;
    const cur = getComputedStyle(c).transform, mid = cur === 'none' ? '' : cur, [k, dur] = toss(cx, cy, J(160), -60 - rnd() * 120, J(500), b.height, mid); c.getAnimations().forEach(a => a.cancel()); c.style.transform = mid; c.animate(k, { duration: D(dur), easing: 'linear', fill: 'forwards' }); }
  for (const { s: l, r, cx, cy } of lettersNear(x, y, 96)) { const [k, dur] = toss(cx, cy, J(160), -60 - rnd() * 160, J(500), r.height); keep(l, r, k, dur, 'linear', rnd() * 120); }
  if (!reduce) for (let i = 0; i < 14; i++) { const sx = x + J(60), sy = y + J(36), sc = .7 + rnd() * .7, sd = mark(place(shardSVG(), sx, sy, [-16, -16, 32, 32])), [k, dur] = toss(sx, sy, J(220), -80 - rnd() * 200, J(700), 10);
    sd.animate(k.map(f => ({ transform: f.transform + ` scale(${R(sc)})` })), { duration: dur, delay: 60 + rnd() * 160, easing: 'linear', fill: 'both' }); }
}
// ---------------------------------------------------------------- laser cutter: drag; it cuts letters in half and lines through
let beam = null;
function laser(x, y, first) {
  if (first || !beam) { beam = { svg: mark(sheet()), d: `M${R(x)} ${R(y)}`, last: [x, y], hot: null, nozzle: place(`<g transform="translate(-31 0)">${ART.laser()}</g>`, x, y, [-58, -14, 66, 32]), shine: glow(x, y, 46, '255,196,120', .9), nshadow: shadow(x - 22, y, 54, .35), pts: [[x, y, 0]], run: 0 };
    beam.nozzle.style.filter = 'drop-shadow(1px 2px 1px rgba(20,20,19,.3))';
    beam.scorch = mark(document.createElementNS('http://www.w3.org/2000/svg', 'svg')); beam.scorch.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`); Object.assign(beam.scorch.style, { left: 0, top: 0, width: innerWidth + 'px', height: innerHeight + 'px', overflow: 'visible' });
    beam.scorch.innerHTML = '<path fill="none" stroke="rgba(52,32,16,.42)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" style="filter:blur(3.5px)"/><path fill="none" stroke="rgba(30,18,8,.4)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" style="filter:blur(1px)"/>'; MUL.append(beam.scorch); beam.svg.innerHTML = `<path class="seam" fill="none" stroke="${VOID}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" d=""/><path class="glow" fill="none" stroke="${GOLD}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d=""/><path class="hot" fill="none" stroke="${PAPER}" stroke-width="1.6" stroke-linecap="round" d=""/><g class="bits"></g>`; }
  const [lx, ly] = beam.last, step = Math.hypot(x - lx, y - ly); beam.nozzle.style.left = x + 'px'; beam.nozzle.style.top = y + 'px'; beam.shine.style.left = (x - 46) + 'px'; beam.shine.style.top = (y - 46) + 'px'; moveShadow(beam.nshadow, x - 22, y); if (step < 2) return;
  beam.d += `L${R(x)} ${R(y)}`; beam.svg.querySelector('.seam').setAttribute('d', beam.d); beam.scorch.querySelectorAll('path').forEach(p => p.setAttribute('d', beam.d)); beam.svg.querySelector('.glow').setAttribute('d', beam.d); beam.svg.querySelector('.hot').setAttribute('d', `M${R(lx)} ${R(ly)}L${R(x)} ${R(y)}`);
  if (step > 8) { const a = Math.atan2(y - ly, x - lx) * 180 / Math.PI; beam.n = (beam.n || 0) + 1; beam.svg.querySelector('.bits').insertAdjacentHTML('beforeend', `<text class="chb-blink" style="animation-delay:${R(beam.n * .08 % 2.4)}s" x="${R((x + lx) / 2)}" y="${R((y + ly) / 2)}" font-size="5" fill="${DATA2}" ${MONO} text-anchor="middle" dominant-baseline="middle" transform="rotate(${R(a)} ${R((x + lx) / 2)} ${R((y + ly) / 2)})">${bits(Math.max(1, Math.round(step / 3.6)))}</text>`); }
  // a letter the beam passes through is cut in two: the halves part along the cut and the lower one slips
  for (const { s, r } of lettersNear(x, y, 9)) {
    const cs = getComputedStyle(s), half = (top) => { const c = document.createElement('span'); c.textContent = s.textContent; Object.assign(c.style, { position: 'absolute', left: r.left + 'px', top: r.top + 'px', font: cs.font, color: cs.color, lineHeight: r.height + 'px', whiteSpace: 'pre', clipPath: top ? 'inset(0 0 50% 0)' : 'inset(50% 0 0 0)' }); layer.append(c); return c; };
    s.style.visibility = 'hidden'; moved.add(s); const t = half(true), b = half(false); s._halves = [t, b];
    t.animate([{ transform: 'none' }, { transform: `translate(${R(J(1.5))}px,-1.5px) rotate(${R(J(6))}deg)` }], { duration: D(300), fill: 'forwards' });
    b.animate([{ transform: 'none' }, { transform: `translate(${R(1 + J(2))}px,4px) rotate(${R(J(10))}deg)` }], { duration: D(420), easing: 'cubic-bezier(.4,0,.6,1.4)', fill: 'forwards' });
  }
  if (!reduce && rnd() < .7) for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + J(1.3), v = 18 + rnd() * 26, sp = place(`<path d="M0 0l${R(Math.cos(a) * 4)} ${R(Math.sin(a) * 4)}" stroke="${rnd() < .5 ? GOLD : DEEP}" stroke-width="1.6" stroke-linecap="round"/>`, x, y, [-6, -6, 12, 12]);
    sp.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${R(Math.cos(a) * v)}px,${R(Math.sin(a) * v + 18)}px) rotate(${R(J(90))}deg)`, opacity: 0 }], { duration: 320 + rnd() * 200, easing: 'cubic-bezier(.2,.6,.6,1)', fill: 'forwards' }).onfinish = () => sp.remove(); }
  if (!reduce && rnd() < .2) { const w = place(puffSVG(4 + rnd() * 2), x, y - 4, [-8, -8, 16, 16]); w.animate([{ transform: 'scale(.4)', opacity: .7 }, { transform: `translate(${R(J(6))}px,-22px) scale(1.4)`, opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' }).onfinish = () => w.remove(); }
  breakLines(x, y, 5, 'drop'); closeLoop(lx, ly, x, y, step); beam.last = [x, y]; if (PINS.length) breakPins((px, py) => Math.hypot(px - x, py - y) < 16); shown();
}
// a cut that closes on itself frees the piece inside. A loop closes where the new stretch crosses an older one, or when the
// beam comes back within a few pixels of where it passed (after going some way round).
const crossAt = (p, q, r, t) => { const ex = q[0] - p[0], ey = q[1] - p[1], fx = t[0] - r[0], fy = t[1] - r[1], d = ex * fy - ey * fx; if (!d) return null;
  const gx = r[0] - p[0], gy = r[1] - p[1], a = (gx * fy - gy * fx) / d, b = (gx * ey - gy * ex) / d; return a >= 0 && a < 1 && b > 0 && b <= 1 ? [p[0] + a * ex, p[1] + a * ey] : null; };
function closeLoop(ax, ay, bx, by, step) {
  const P = beam.pts, n = P.length, run = beam.run + step; let poly = null, hinge = null, from = -1;
  // the newest older stretch it crosses closes the smallest loop: the one just drawn
  for (let i = n - 3; i >= 0 && !poly; i--) { const q = crossAt(P[i], P[i + 1], [ax, ay], [bx, by]); if (q) { poly = [q, ...P.slice(i + 1).map(([x, y]) => [x, y])]; hinge = q; from = i + 1; } }
  if (!poly) for (let i = n - 2; i >= 0; i--) if (run - P[i][2] > 90 && Math.hypot(P[i][0] - bx, P[i][1] - by) < 9) { poly = [...P.slice(i).map(([x, y]) => [x, y]), [bx, by]]; hinge = [bx, by]; from = i; break; }
  beam.run = run; P.push([bx, by, run]);
  // the freed loop is cut out of the path (its hinge stays), so one cut never frees the same piece twice while later
  // loops can still close on everything drawn before it
  if (poly && poly.length >= 3 && dropOut(poly, hinge)) beam.pts = [...P.slice(0, from), [hinge[0], hinge[1], run], ...(hinge[0] === bx && hinge[1] === by ? [] : [[bx, by, run]])];
  if (beam.pts.length > 1500) beam.pts.splice(0, beam.pts.length - 1500);
}
// what the page is made of under a point: the first solid background there
const paperAt = (px, py) => { for (let el = document.elementsFromPoint(px, py).find(e => !e.closest(OURS + ',.chb-blend')); el; el = el.parentElement) { const bg = getComputedStyle(el).backgroundColor; if (bg && bg !== 'transparent' && !/,\s*0\)$/.test(bg)) return bg; } return PAPER; };
// the piece tips on the last point that held it, then falls through the hole and away into the dark behind the page;
// the hole shows the back end (data, as the bomb's scar does), shaded on the side the light comes from
const inPoly = (poly, px, py) => { let o = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) o = !o; } return o; };
function dropOut(poly, hinge) {
  let A = 0, cx = 0, cy = 0; for (let i = 0, n = poly.length; i < n; i++) { const [a, b] = poly[i], [c, d] = poly[(i + 1) % n], k = a * d - c * b; A += k; cx += (a + c) * k; cy += (b + d) * k; }
  A /= 2; if (!(Math.abs(A) >= 700)) return false; cx /= 6 * A; cy /= 6 * A;
  if (holes.some(h => inPoly(h, cx, cy))) return true;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [a, b] of poly) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
  const w = x1 - x0, h = y1 - y0, path = lin(poly);
  const inside = (px, py) => inPoly(poly, px, py); holes.push(poly);
  // the piece is made of the paper it was cut from: the first solid background under its middle
  let paper = PAPER; for (let el = document.elementsFromPoint(cx, cy).find(e => !e.closest(OURS + ',.chb-blend')); el; el = el.parentElement) { const bg = getComputedStyle(el).backgroundColor; if (bg && bg !== 'transparent' && !/,\s*0\)$/.test(bg)) { paper = bg; break; } }
  const id = 'chbL' + (++uid), hole = mark(sheet()); layer.insertBefore(hole, beam.svg);
  let rows = ''; for (let yy = y0 - 4; yy < y0 + h + 8; yy += 6.4) rows += `<text x="${R(x0 - 6 + J(3))}" y="${R(yy)}" fill="${rnd() < .25 ? DATA2 : DATA}" opacity="${R(.38 + rnd() * .45)}">${bits(Math.ceil(w / 3.4) + 5)}</text>`;
  hole.innerHTML = `<defs><clipPath id="${id}"><path d="${path}"/></clipPath><filter id="${id}b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.2"/></filter></defs><path d="${path}" fill="${VOID}"/>`
    + `<g clip-path="url(#${id})"><g ${MONO} font-size="6.2"><g class="chb-stream">${rows}</g></g>`
    + `<path d="M${R(x0 - 40)} ${R(y0 - 40)}h${R(w + 80)}v${R(h + 80)}h${R(-w - 80)}Z${lin(poly.map(([a, b]) => [a + 5, b + 6]))}" fill="rgba(0,0,0,.62)" fill-rule="evenodd" filter="url(#${id}b)"/></g>`;
  // the piece: the paper and its letters, seen only through the hole it leaves
  const wrap = document.createElement('div'); Object.assign(wrap.style, { position: 'absolute', left: '0', top: '0', width: innerWidth + 'px', height: innerHeight + 'px', clipPath: `path('${path}')`, perspective: '760px', perspectiveOrigin: `${R(cx)}px ${R(cy)}px` }); layer.insertBefore(wrap, beam.svg);
  const piece = document.createElement('div'); Object.assign(piece.style, { position: 'absolute', left: R(x0) + 'px', top: R(y0) + 'px', width: R(w) + 'px', height: R(h) + 'px', transformOrigin: `${R(hinge[0] - x0)}px ${R(hinge[1] - y0)}px` }); wrap.append(piece);
  piece.innerHTML = `<svg viewBox="${R(x0)} ${R(y0)} ${R(w)} ${R(h)}" style="left:0;top:0;width:${R(w)}px;height:${R(h)}px"><path d="${path}" fill="${paper}"/><path d="${path}" fill="none" stroke="#3A2414" stroke-width="2.6" stroke-opacity=".8"/><path d="${path}" fill="none" stroke="${GOLD}" stroke-width=".8" stroke-opacity=".7"/></svg>`;
  for (const { s, r } of lettersNear(x0 + w / 2, y0 + h / 2, Math.hypot(w, h) / 2 + 4, (lx, ly) => inside(lx, ly))) { const cs = getComputedStyle(s), c = document.createElement('span'); c.textContent = s.textContent;
    Object.assign(c.style, { position: 'absolute', left: R(r.left - x0) + 'px', top: R(r.top - y0) + 'px', font: cs.font, color: cs.color, lineHeight: r.height + 'px', whiteSpace: 'pre' }); piece.append(c); s.style.visibility = 'hidden'; moved.add(s); }
  // it tips about the line through the hinge, square to the way the piece lies from it: the free side sinks first
  const ux = cx - hinge[0], uy = cy - hinge[1], L = Math.hypot(ux, uy) || 1, ax = R(-uy / L * 100) / 100, ay = R(ux / L * 100) / 100, sink = h * .26 + 14, tip = deg => `rotate3d(${ax},${ay},0,${deg}deg)`, drift = J(8), spin = J(16);
  // a beat still, a sag, a catch as the last fibre lets go, then gravity; it darkens as it turns from the light and fades far down
  piece.animate([{ transform: 'none', filter: 'brightness(1)', easing: 'ease-in-out' }, { transform: 'none', filter: 'brightness(1)', offset: .08, easing: 'cubic-bezier(.4,0,.6,1)' },
    { transform: tip(12), filter: 'brightness(.84)', offset: .3, easing: 'ease-out' }, { transform: tip(9.5), filter: 'brightness(.86)', offset: .37, easing: 'ease-in' },
    { transform: tip(11), filter: 'brightness(.84)', offset: .42, easing: 'cubic-bezier(.5,0,1,.5)' },
    { transform: `translate3d(${R(drift * .75)}px,${R(sink * .8)}px,-430px) ${tip(44)} rotate(${R(spin * .75)}deg)`, filter: 'brightness(.36)', opacity: 1, offset: .88 },
    { transform: `translate3d(${R(drift)}px,${R(sink)}px,-560px) ${tip(52)} rotate(${R(spin)}deg)`, filter: 'brightness(.26)', opacity: 0 }],
    { duration: D(2000), easing: 'linear', fill: 'forwards' }).onfinish = () => wrap.remove();
  // the moment it comes free: a spit of sparks and a flash at the last point, a breath of smoke out of the cut
  light(hinge[0], hinge[1], 70, '255,206,140', 420, .9);
  if (!reduce) { for (let i = 0; i < 7; i++) { const a = J(Math.PI), v = 20 + rnd() * 34, sp = place(`<path d="M0 0l${R(Math.cos(a) * 4)} ${R(Math.sin(a) * 4)}" stroke="${rnd() < .5 ? GOLD : PAPER}" stroke-width="1.6" stroke-linecap="round"/>`, hinge[0], hinge[1], [-6, -6, 12, 12]);
      sp.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${R(Math.cos(a) * v)}px,${R(Math.sin(a) * v + 22)}px)`, opacity: 0 }], { duration: 380 + rnd() * 240, easing: 'cubic-bezier(.2,.6,.6,1)', fill: 'forwards' }).onfinish = () => sp.remove(); }
    puffs(cx, cy, 3, Math.min(w, h) * .3, 26); }
  return true;
}
// what a burn opens onto: the back end, streams of 0 and 1 in the dark (as a laser cut's hole), laid under the charred
// rim and growing with it
function backEnd(poly, before, cx, cy) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [a, b] of poly) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
  const id = 'chbB' + (++uid), path = lin(poly), w = x1 - x0, hole = mark(sheet()); layer.insertBefore(hole, before);
  let rows = ''; for (let yy = y0 - 4; yy < y1 + 8; yy += 6.4) rows += `<text x="${R(x0 - 6 + J(3))}" y="${R(yy)}" fill="${rnd() < .25 ? DATA2 : DATA}" opacity="${R(.4 + rnd() * .45)}">${bits(Math.ceil(w / 3.4) + 5)}</text>`;
  hole.innerHTML = `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><path d="${path}" fill="${VOID}"/><g clip-path="url(#${id})"><g ${MONO} font-size="6.2"><g class="chb-stream">${rows}</g></g></g>`;
  if (!reduce) { hole.style.transformOrigin = `${R(cx)}px ${R(cy)}px`; hole.animate([{ transform: 'scale(0)' }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.33,1,.68,1)' }); }
  return hole;
}
// the hot edge (a gold line on the char) cools over three seconds, then a faint warmth keeps breathing along the seam
function laserOff() { if (!beam) return; beam.nozzle.remove(); beam.nshadow.remove(); { const sh = beam.shine; sh.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(700), fill: 'forwards' }).onfinish = () => sh.remove(); } beam.svg.querySelector('.hot').animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(300), fill: 'forwards' });
  const g = beam.svg.querySelector('.glow'); g.animate([{ opacity: 1, strokeWidth: 1.4 }, { opacity: .25, strokeWidth: .8 }], { duration: D(3000), easing: 'ease-out', fill: 'forwards' }).onfinish = () => g.classList.add('chb-warm'); beam = null; }
// ---------------------------------------------------------------- railgun: fired from the page edge, straight through, a trench of data behind it
function railgun(x, y) {
  breakPins((px, py) => Math.abs(py - y) < 28, 'pop', () => reduce ? 0 : 960);
  const left = x < innerWidth / 2, x0 = left ? 6 : innerWidth - 6, dir = left ? 1 : -1, x1 = left ? innerWidth + 20 : -20;
  const arcs = `<g class="chb-arcs">${[0, 1, 2].map(i => `<path d="M${3 + i * 8} -4l2 2-2 2 2 2-2 2" fill="none" stroke="${GOLD}" stroke-width="1.4" stroke-linecap="round" opacity="0"/>`).join('')}</g>`;
  const glows = [0, 8, 16].map(cx => `<path class="chb-coil" d="${closed(ring(cx, 0, 2, 8.6, 7, .03))}" fill="${PAPER}" opacity="0"/>`).join('');
  const gun = place(`<g transform="scale(${dir * 1.6} 1.6)">${ART.railgun()}${glows}${arcs}</g>`, x0 + dir * 36, y, [-44, -24, 88, 48]); gun.style.filter = 'drop-shadow(2px 3px 2px rgba(20,20,19,.3))';
  const gsh = shadow(x0 + dir * 36, y + 8, 110, .25); if (!reduce) gsh.animate([{ transform: `translateX(${-dir * 70}px)` }, { transform: 'none', offset: .35 }, { transform: 'none' }], { duration: D(900), fill: 'forwards', composite: 'add' });
  gun.animate([{ transform: `translateX(${-dir * 70}px)` }, { transform: 'none', offset: .35, easing: 'cubic-bezier(.2,.8,.3,1)' }, { transform: 'none' }], { duration: D(900), fill: 'forwards' });
  shake('railcharge');
  // sparks drawn in to the muzzle as it charges
  if (!reduce) for (let i = 0; i < 16; i++) { const a = rnd() * 6.283, d = 40 + rnd() * 60, mx = x0 + dir * 78, sp = place(dot(0, 0, 1.2 + rnd(), rnd() < .5 ? GOLD : '#FFE7A8'), mx + Math.cos(a) * d, y + Math.sin(a) * d, [-3, -3, 6, 6]);
    sp.animate([{ transform: 'none', opacity: 0 }, { opacity: 1, offset: .3 }, { transform: `translate(${R(-Math.cos(a) * d)}px,${R(-Math.sin(a) * d)}px) scale(.4)`, opacity: .2 }], { duration: 380, delay: 300 + i * 34, easing: 'ease-in', fill: 'both' }).onfinish = () => sp.remove(); }
  if (!reduce) { gun.querySelectorAll('.chb-coil').forEach((c, i) => c.animate([{ opacity: 0 }, { opacity: .75, offset: .5 }, { opacity: .3 }], { duration: 260, delay: 300 + i * 120, fill: 'forwards' }));
    gun.querySelectorAll('.chb-arcs path').forEach((a, i) => a.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 480 + i * 60, iterations: 2 })); }
  later(() => {
    gun.animate([{ transform: 'none' }, { transform: `translateX(${-dir * 18}px)`, offset: .2 }, { transform: 'none' }], { duration: D(420), easing: 'cubic-bezier(.2,.8,.3,1)' });
    light(x0 + dir * 78, y, 130, '255,222,150', 420, 1);
    { const a0 = Math.min(x0, x1), b0 = Math.max(x0, x1), band = fxEl(SCR, (a0 + b0) / 2, y, b0 - a0, 90, { background: 'linear-gradient(180deg, rgba(255,232,176,0), rgba(255,232,176,.8) 50%, rgba(255,232,176,0))' }); if (reduce) band.remove(); else band.animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 0 }], { duration: D(700), fill: 'forwards' }).onfinish = () => band.remove();
      const sc = mark(fxEl(MUL, (a0 + b0) / 2, y, b0 - a0, 46, { background: 'linear-gradient(180deg, rgba(40,26,14,0), rgba(40,26,14,.42) 50%, rgba(40,26,14,0))' })); sc.classList.add('chb-grain'); if (!reduce) sc.animate([{ clipPath: left ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: D(220), easing: 'linear' }); }
    const flash = place(burstSVG(20), x0 + dir * 78, y, [-30, -30, 60, 60]); flash.animate([{ transform: 'scale(.3)' }, { transform: 'scale(1.1)', offset: .3 }, { transform: 'scale(.5)', opacity: 0 }], { duration: D(380), fill: 'forwards' }).onfinish = () => flash.remove();
    const slug = place(`<path d="M-30 0L-8 0" stroke="${GOLD}" stroke-width="2" stroke-linecap="round" opacity=".7"/><path d="M-8 -2.6L6 -2.6L10 0L6 2.6L-8 2.6Z" fill="${GOLD}"/>${inkP('M-8 -2.8L6 -2.8L10 0L6 2.8L-8 2.8Z', 1.6)}`, x0 + dir * 78, y, [-32, -4, 44, 8]); slug.style.transform = `scaleX(${dir})`;
    slug.animate([{ transform: `scaleX(${dir})` }, { transform: `translateX(${R(x1 - x0)}px) scaleX(${dir})` }], { duration: D(220), easing: 'linear', fill: 'forwards' }).onfinish = () => slug.remove();
    // the rift: a valley torn through the page. Its edges pull apart after the slug (the paper lips curl back, cracks run out
    // of them written in 0 and 1), its walls fall away in layers, a river of 0 and 1 runs along the bottom, and digits
    // burst out of it and rain onto the floor
    const HW = 34, a = Math.min(x0 + dir * 78, x1), b = Math.max(x0 + dir * 78, x1), start = left ? a : b, top = [], bot = [];
    for (let u = a; u <= b + 7; u += 7) { const taper = Math.min(1, Math.abs(u - start) / 70), w = HW * (.72 + .4 * (.5 + .5 * Math.sin(u * .013 + 1.3))) * taper + 2; top.push([u, y - w * (1 + J(.14)) + J(2.4)]); bot.push([u, y + w * (.86 + J(.14)) + J(2.4)]); }
    const t = mark(sheet()), id = 'chbR' + (++uid), edge = pts => 'M' + pts.map(([u, v]) => `${R(u)} ${R(v)}`).join('L'), hole = lin([...top, ...[...bot].reverse()]);
    const strata = [.78, .56, .36].map((k, i) => inkP(edge(top.map(([u, v]) => [u, y + (v - y) * k + J(1)])), .9, .32 - i * .07, ` stroke="${DATAINK}"`) + inkP(edge(bot.map(([u, v]) => [u, y + (v - y) * k + J(1)])), .9, .32 - i * .07, ` stroke="${DATAINK}"`)).join('').replaceAll(`stroke="${INK}" `, '');
    let cracks = '', cdefs = ''; for (let i = 0; i < 14; i++) { const side = i % 2 ? 1 : -1, pts = side < 0 ? top : bot, q = pts[1 + Math.floor(rnd() * (pts.length - 2))], len = 18 + rnd() * 34; let pt = [q[0], q[1]], d = `M${R(pt[0])} ${R(pt[1])}`;
      for (let k = 1; k <= 3; k++) { const ang = side * Math.PI / 2 + J(.7); pt = [pt[0] + Math.cos(ang) * len / 3, pt[1] + Math.sin(ang) * len / 3]; d += `L${R(pt[0])} ${R(pt[1])}`; }
      const cid = `${id}c${i}`; cdefs += `<path id="${cid}" d="${d}"/>`; cracks += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".5" stroke-linecap="round"/><text class="chb-flicker" style="animation-delay:${R(rnd() * 3)}s" font-size="6" fill="${DATAINK}" ${MONO} dy="-1"><textPath href="#${cid}">${bits(Math.round(len / 3.4))}</textPath></text>`; }
    const river = [-9, 0, 9].map((dy, i) => `<text class="chb-flow" style="animation-duration:${R(1.1 + i * .5)}s" x="${R(a - 30)}" y="${R(y + dy + 2)}" font-size="${R(7.4 - Math.abs(dy) * .12)}" fill="${i === 1 ? DATA2 : DATA}" opacity="${i === 1 ? 1 : .7}">${bits(Math.round((b - a + 60) / 4.1))}</text>`).join('');
    t.innerHTML = `<defs><clipPath id="${id}"><path d="${hole}"/></clipPath><linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B3D42"/><stop offset=".5" stop-color="${VOID}"/><stop offset="1" stop-color="#2E3033"/></linearGradient>${cdefs}</defs>`
      + `<path d="${lin([...top.map(([u, v]) => [u, v - 5]), ...[...bot].reverse().map(([u, v]) => [u, v + 5])])}" fill="#3B3D42" opacity=".16"/>`
      + `<path d="${lin([...top.map(([u, v]) => [u + J(1), v - 3.2]), ...[...top].reverse().map(([u, v]) => [u, v + .5])])}" fill="${OAT}"/><path d="${lin([...bot.map(([u, v]) => [u + J(1), v + 3.2]), ...[...bot].reverse().map(([u, v]) => [u, v - .5])])}" fill="${OAT}"/>`
      + `<path d="${hole}" fill="url(#${id}w)"/><g clip-path="url(#${id})" ${MONO}>${strata}<g opacity=".95">${river}</g></g>${cracks}`
      + inkP(edge(top), 1.8) + inkP(edge(bot), 1.8)
      + `<g class="chb-hotedge"><path d="${edge(top.map(([u, v]) => [u, v + 1.4]))}" fill="none" stroke="${GOLD}" stroke-width="1.4"/><path d="${edge(bot.map(([u, v]) => [u, v - 1.4]))}" fill="none" stroke="${GOLD}" stroke-width="1.4"/></g>`;
    t.animate([{ clipPath: left ? `inset(0 100% 0 0)` : `inset(0 0 0 100%)` }, { clipPath: 'inset(0 0 0 0)' }], { duration: D(220), easing: 'linear' });
    if (!reduce) { t.style.transformOrigin = `0 ${R(y)}px`; t.animate([{ transform: 'scaleY(.08)' }, { transform: 'scaleY(1.12)', offset: .62 }, { transform: 'scaleY(.97)', offset: .82 }, { transform: 'none' }], { duration: 640, delay: 120, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
      const river2 = fxEl(SCR, (a + b) / 2, y, b - a, HW * 1.6, { background: 'linear-gradient(180deg, rgba(127,184,110,0), rgba(160,220,140,.4) 50%, rgba(127,184,110,0))' }); river2.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 300, fill: 'backwards' }); mark(river2);
      // the 0 and 1 break out of the rift and rain down
      for (let i = 0; i < 64; i++) { const u = a + rnd() * (b - a), d = document.createElement('span'); d.textContent = rnd() < .5 ? '0' : '1'; Object.assign(d.style, { position: 'absolute', left: R(u - 4) + 'px', top: R(y - 8) + 'px', font: `700 ${R(10 + rnd() * 8)}px Consolas,'Courier New',monospace`, color: rnd() < .3 ? DATA2 : DATA, textShadow: '0 0 6px rgba(127,184,110,.7)' }); layer.append(d); mark(d);
        const [k, dur] = toss(u, y, J(220), -(260 + rnd() * 520), J(720), 14); d.animate(k, { duration: dur, delay: 200 + Math.abs(u - start) / (b - a) * 260 + rnd() * 240, easing: 'linear', fill: 'both' }); } }
    let torn = 0; for (const { s, r, cx, cy } of lettersNear(x, y, 9999, (cx, cy) => Math.abs(cy - y) < HW + 8, true)) { if (++torn > 420) break; const side = cy < y ? -1 : 1, delay = Math.abs(cx - x0) / Math.abs(x1 - x0) * 220, [k, dur] = toss(cx, cy, dir * (180 + rnd() * 420), side * (160 + rnd() * 280) - 140, J(800), r.height); keep(s, r, k, dur, 'linear', delay); }
    for (const { s, r, cx, cy } of lettersNear(x, y, 9999, (cx, cy) => Math.abs(cy - y) >= HW + 8 && Math.abs(cy - y) < HW + 90)) { const side = cy < y ? -1 : 1, f = 1 - (Math.abs(cy - y) - HW - 8) / 82, delay = Math.abs(cx - x0) / Math.abs(x1 - x0) * 220;
      keep(s, r, [{ transform: 'none' }, { transform: `translate(${R(dir * 6 * f)}px,${R(side * (8 + rnd() * 8) * f)}px) rotate(${R(J(14) * f)}deg)`, offset: .35 }, { transform: `translate(${R(dir * 3 * f)}px,${R(side * (4 + rnd() * 5) * f)}px) rotate(${R(J(10) * f)}deg)` }], 420, 'cubic-bezier(.2,.9,.3,1)', delay); }
    if (!reduce) { // where the slug leaves the screen, a burst; along the trench, smoke rising
      const ex = left ? innerWidth - 10 : 10; light(ex, y, 160, '255,222,150', 500, 1); const eb = place(burstSVG(26), ex, y, [-40, -40, 80, 80]); eb.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.2)', offset: .35 }, { transform: 'scale(.6)', opacity: 0 }], { duration: 420, delay: 200, fill: 'both' }).onfinish = () => eb.remove();
      for (let u = a + 40, i = 0; u < b; u += 110, i++) later(() => puffs(u, y, 1, 10, 46), 240 + i * 40); }
    for (let u = a; u < b; u += 16) breakLines(u, y, HW, 'out', .7); shake('railgun');
    gun.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(500), delay: D(500), fill: 'forwards' }).onfinish = () => gun.remove(); gsh.animate([{ opacity: gsh.style.opacity }, { opacity: 0 }], { duration: D(500), delay: D(500), fill: 'forwards' }).onfinish = () => gsh.remove(); shown();
  }, reduce ? 0 : 900);
}
// ---------------------------------------------------------------- black hole: everything nearby spirals in, the page itself bends toward it; then it snaps shut
// The drawing, back to front: the far side of its disk, bent up over the top by the hole's gravity; the flat disk; the
// shadow with its thin photon ring; the near half of the disk crossing in front. The side turning toward us is brighter
// (as a real disk's is). Streaks race round the disk and wisps spiral in.
function holeSVG() {
  const id = 'chbH' + (++uid), band = (rx, ry, rx2, ry2) => { const o = [], n = 48; for (let i = 0; i <= n; i++) { const a = i / n * TAU; o.push([Math.cos(a) * rx, Math.sin(a) * ry]); } const inn = []; for (let i = n; i >= 0; i--) { const a = i / n * TAU; inn.push([Math.cos(a) * rx2, Math.sin(a) * ry2]); } return 'M' + o.map(([x, y]) => `${R(x)} ${R(y)}`).join('L') + 'Z M' + inn.map(([x, y]) => `${R(x)} ${R(y)}`).join('L') + 'Z'; };
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
  const R0 = 180, SP = globalThis.ReservePlaySpace; let g, disc, space = null, reach = R0, timeAt = () => 0;
  if (SP?.hole) { // it opens in the page: its pull reaches further and further, the page cracks and breaks in toward it (play-space.js)
    const cv = document.createElement('canvas'), dk = document.createElement('canvas'); cv.className = 'chb-space'; dk.className = 'chb-space-dark'; layer.prepend(cv); layer.append(dk);
    space = SP.hole(cv, x, y, { reduce, paper: paperAt(x, y), dark: dk }); g = cv; reach = space.reachMax; timeAt = d => space.timeAt(d) * 1000;
    const t0 = performance.now(), tick = now => { if (!cv.isConnected) { dk.remove(); return; } space.frame(reduce ? 2.6 * 2 : (now - t0) / 1000); if (space.done) { cv.remove(); dk.remove(); } else requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  } else if (SP) { // the page tears open onto space: a rendered black hole in a canvas laid under the flying letters
    const cv = document.createElement('canvas'); cv.className = 'chb-space'; layer.prepend(cv); space = SP.open(cv, { size: Math.min(620, Math.max(420, innerWidth * .42)), reduce }); Object.assign(cv.style, { position: 'absolute', left: R(x - space.W / 2) + 'px', top: R(y - space.H / 2) + 'px', pointerEvents: 'none' }); g = cv;
    const t0 = performance.now(), tick = now => { if (!cv.isConnected) return; space.frame(reduce ? 1.6 : (now - t0) / 1000); if (space.done) cv.remove(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  } else { g = mark(place(holeSVG(), x, y, [-140, -100, 280, 170])); disc = glow(x, y, 120, '255,206,140', .42); if (!reduce) disc.animate([{ opacity: .55, transform: 'scale(.95)' }, { opacity: 1, transform: 'scale(1.05)' }, { opacity: .55, transform: 'scale(.95)' }], { duration: 2400, iterations: Infinity }); g.animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.12)', offset: .7 }, { transform: 'none' }], { duration: D(600), easing: 'cubic-bezier(.2,.8,.3,1)' }); }
  // its pull reaches further as it grows: each letter goes when the pull reaches it, nearest first, more and more
  let n = 0; const leaning = [], edge = reach * .9; for (const { s, r, d, cx, cy } of lettersNear(x, y, reach + edge, undefined, true).sort((p, q) => p.d - q.d)) { if (++n > 520) break;
    if (d <= reach) { fly(s, r, spiral(cx - x, cy - y), space?.timeAt ? 1200 + d * 2.6 : 700 + d * 7, timeAt(d)); continue; }
    // further out: pulled a little way in, turned and drawn out toward it (stretched along the pull)
    const f = 1 - (d - reach) / edge, a = Math.atan2(y - cy, x - cx), deg = R(a * 180 / Math.PI), pull = 4 + 16 * f;
    leaning.push({ c: keep(s, r, [{ transform: 'none' }, { transform: `translate(${R(Math.cos(a) * pull)}px,${R(Math.sin(a) * pull)}px) rotate(${deg}deg) scaleX(${R(1 + .7 * f)}) rotate(${-deg}deg) rotate(${R(J(18) * f)}deg)` }], space?.timeAt ? 5200 : 900 + rnd() * 500, space?.timeAt ? 'cubic-bezier(.6,0,.9,.5)' : 'cubic-bezier(.4,0,.2,1)', space?.timeAt ? timeAt(Math.min(d, reach * 1.3)) * .6 : 0), a, f }); }
  // (spiral() takes the vector from the hole to the letter, so the letters fall in)
  // the page itself bends toward it: each block near it is drawn in, turned and shrunk a little (springs back when it closes)
  const pulled = []; if (!reduce) for (const el of [...document.querySelectorAll(opts.blocks || 'body > *')].filter(el => !el.closest('.chb-box, #chb-layer') && !el.querySelector('.chb-box'))) {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = Math.hypot(cx - x, cy - y); if (d > 700 || r.width * r.height > innerWidth * innerHeight * .7) continue;
    const f = Math.max(0, 1 - d / 700), a = Math.atan2(y - cy, x - cx), prev = { t: el.style.transform, o: el.style.transformOrigin }; el.style.transformOrigin = `${R(x - r.left)}px ${R(y - r.top)}px`;
    const strong = SP?.hole ? 1.6 : 1, an = el.animate([{ transform: 'none' }, { transform: `translate(${R(Math.cos(a) * 26 * f * strong)}px,${R(Math.sin(a) * 26 * f * strong)}px) rotate(${R((cx < x ? 1 : -1) * 3 * f * strong)}deg) scale(${R((1 - .05 * f * strong) * 1000) / 1000})` }], { duration: D(SP?.hole ? 9400 : 1800), easing: SP?.hole ? 'cubic-bezier(.6,0,.9,.55)' : 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    folds.push({ el, a: an, prev }); pulled.push({ el, an, prev }); }
  for (const p of PINS) p.to = [x, y]; breakPins((px, py) => Math.hypot(px - x, py - y) < reach + 120, 'swallow', (px, py) => timeAt(Math.hypot(px - x, py - y)) * .8);
  breakLines(x, y, R0 * .8, 'in'); shake('blackhole'); [.3, .52, .7, .86].forEach((u, k) => later(() => shake(k < 2 ? 'bhjolt' : 'bhjolt2'), 9600 * u));
  later(() => { if (space) space.closeNow(); else g.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.15)', offset: .2 }, { transform: 'scale(0)', opacity: 0 }], { duration: D(420), easing: 'ease-in', fill: 'forwards' });
    // the letters it was pulling spring most of the way back, still a little askew; the page springs back past straight and settles
    for (const { c, a, f } of leaning) { if (!c.isConnected) continue; const from = getComputedStyle(c).transform; c.getAnimations().forEach(x => x.cancel()); c.style.transform = from; c.animate([{ transform: from }, { transform: `translate(${R(Math.cos(a) * 3 * f)}px,${R(Math.sin(a) * 3 * f)}px) rotate(${R(J(10) * f)}deg)` }], { duration: D(520), easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'forwards' }); }
    for (const p of pulled) { const i = folds.findIndex(f => f.el === p.el && f.a === p.an); if (i < 0) continue; const [f] = folds.splice(i, 1); returnFold(f, 700, 'cubic-bezier(.3,1.7,.5,1)'); }
    if (!reduce) { // it snaps shut: a flash, a ring of pressed air, and two jets of 0 and 1 thrown out that rain onto the floor
      light(x, y, 220, '220,230,255', 420, 1); const sw = place(`<circle r="40" fill="none" stroke="${PAPER}" stroke-width="6" opacity=".9"/><circle r="40" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".3"/>`, x, y, [-42, -42, 84, 84]);
      sw.animate([{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(7)', opacity: 0 }], { duration: 560, delay: 380, easing: 'cubic-bezier(.1,.6,.3,1)', fill: 'both' }).onfinish = () => sw.remove(); later(() => shake('bhclose'), 380);
      for (let i = 0; i < 44; i++) { const up = i % 2 ? -1 : 1, d = document.createElement('span'); d.textContent = rnd() < .5 ? '0' : '1'; Object.assign(d.style, { position: 'absolute', left: R(x - 4) + 'px', top: R(y - 8) + 'px', font: `700 ${R(11 + rnd() * 7)}px Consolas,'Courier New',monospace`, color: rnd() < .3 ? DATA2 : DATA, textShadow: '0 0 6px rgba(127,184,110,.7)' }); layer.append(d); mark(d);
        const [k, dur] = toss(x, y, J(140), up * (520 + rnd() * 520), J(720), 14); d.animate(k, { duration: dur, delay: 400 + rnd() * 160, easing: 'linear', fill: 'both' }); } }
    if (disc) { disc.getAnimations().forEach(a => a.cancel()); disc.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.2)' }], { duration: D(420), easing: 'ease-in', fill: 'forwards' }).onfinish = () => disc.remove(); }
    // it closes to a pinhole, the back end still turning inside
    const s = mark(place(PA?.pin ? fresh(pickOf(PA.pin)) : `<path d="${closed(ring(0, 0, 13, 13, 9, .05))}" fill="${VOID}" opacity=".9"/><g class="chb-swirl">${[0, 1, 2].map(i => `<path d="M0 0C${4 + i * 3} ${-2 - i * 2} ${8 + i * 3} ${3 + i} ${6 + i * 4} ${8 + i * 2}" fill="none" stroke="${i ? DATA : GOLD}" stroke-width="1.4" stroke-linecap="round" transform="rotate(${i * 120})"/>`).join('')}</g>${inkP(over(ring(0, 0, 13, 13, 9, .05)), 1.8)}`, x, y, PA?.pin ? [-62, -42, 124, 84] : [-20, -20, 40, 40])); s.animate([{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'scale(.92)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: D(520), delay: D(300), easing: 'cubic-bezier(.3,0,.2,1)', fill: 'backwards' }); PINS.push({ el: s, x, y }); }, reduce ? 0 : (space?.closeAt || 4800));
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
  if (flat) return; flat = true; const FALL = 2400;
  const f = place(foilCard(), x, y, [-42, -36, 84, 72]); f.style.filter = 'drop-shadow(0 0 6px rgba(190,210,255,.9)) drop-shadow(1px 2px 1px rgba(20,20,19,.2))'; const fsh = shadow(x, y, 34, 1); fallShadow(fsh, 1, 0, FALL, 0, 'ease-in');
  // it tumbles as it flutters down (turning over in depth, so its colours flash), trailing sparkles
  const path = [[-30, -160, -30, 0], [10, -110, 20, 70], [-12, -60, -16, 160], [4, -20, 8, 250], [0, 0, 0, 360]];
  f.animate(path.map(([dx, dy, r, ry], i) => ({ transform: `perspective(240px) translate(${dx}px,${dy}px) rotate(${r}deg) rotateY(${ry}deg)`, offset: [0, .3, .6, .85, 1][i] })), { duration: D(FALL), easing: 'ease-in-out', fill: 'forwards' });
  if (!reduce) for (let ms = 60; ms < FALL - 50; ms += 70) later(() => { const u = ms / FALL, k = Math.min(3, Math.floor(u * 4)), v = u * 4 - k, [ax, ay] = path[k], [bx, by] = path[k + 1], px = x + ax + (bx - ax) * v + J(8), py = y + ay + (by - ay) * v + J(6);
    const sp = place(`<path d="M0 -4C.5 -1 1 -.5 4 0C1 .5 .5 1 0 4C-.5 1 -1 .5 -4 0C-1 -.5 -.5 -1 0 -4Z" fill="hsl(${R(rnd() * 360)},100%,82%)"/>`, px, py, [-5, -5, 10, 10]); sp.style.filter = 'drop-shadow(0 0 3px #fff)';
    sp.animate([{ transform: 'scale(.3) rotate(0deg)', opacity: 1 }, { transform: `translate(${R(J(10))}px,${R(14 + rnd() * 20)}px) scale(1.1) rotate(90deg)`, opacity: .9, offset: .4 }, { transform: `translate(${R(J(16))}px,${R(30 + rnd() * 30)}px) scale(.2) rotate(180deg)`, opacity: 0 }], { duration: 700 + rnd() * 400, easing: 'ease-out', fill: 'forwards' }).onfinish = () => sp.remove(); }, ms);
  later(() => {
    const SPEED = .2;   // px per ms: how fast the flattening runs up and down the page
    // the strike shakes the whole page: a hard jolt at the touch, jolt after jolt as the collapse runs, a last one as it settles
    if (!reduce) { shake('foil'); later(() => shake('foilrumble'), 80); const runMs = Math.max(y, innerHeight - y) / SPEED; for (let tt = 170; tt < runMs + 260; tt += 150 + rnd() * 170) later(() => shake(rnd() < .55 ? 'foiljolt' : 'foiljolt2'), tt); later(() => shake('foilend'), runMs + 520); }
    breakPins(() => true, 'flat', (px, py) => Math.abs(py - y) / SPEED);
    // the strike itself, rendered: the pinpoint, the razor line, the wavefronts, lightning and sparks (play-space.js)
    const SPC = globalThis.ReservePlaySpace;
    f.animate([{ transform: 'none' }, { transform: 'scale(60,.08)', opacity: .9, offset: .5 }, { transform: 'scale(120,.04)', opacity: 0 }], { duration: D(900), easing: 'ease-in', fill: 'forwards' }).onfinish = () => f.remove(); fsh.remove();
    // the colours of the page along the touched band, gathered before anything moves: they become the line's streaks
    const cols = []; for (let u = 4; u < innerWidth; u += 5) { const el = document.elementFromPoint(u, Math.max(1, Math.min(innerHeight - 2, y - 80 + rnd() * 160))); if (!el || el.closest('#chb-layer')) continue; const cs = getComputedStyle(el), hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
      const c = hasText && rnd() < .6 ? cs.color : !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) ? cs.backgroundColor : cs.color; cols.push([u, c]); }
    // the strike itself, rendered: the touch, space bending in, the fronts, the void and the line that is left (play-space.js)
    if (SPC?.foil && !reduce) { const cv = document.createElement('canvas'); cv.className = 'chb-strike'; layer.append(cv); const st = SPC.foil(cv, x, y, { speed: SPEED * 1000, cols }), t0 = performance.now(), tick = now => { if (!cv.isConnected) return; st.frame((now - t0) / 1000); if (st.done) cv.remove(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    if (!reduce) {
      // the wavefront: a thin bright plane running up and down from the line (when the rendered strike is not there)
      if (!SPC?.foil) for (const sgn of [-1, 1]) { const far = sgn < 0 ? y + 30 : innerHeight - y + 30, wf = fxEl(SCR, innerWidth / 2, y, innerWidth, 12, { background: 'linear-gradient(180deg, rgba(225,236,255,0), rgba(240,246,255,.95) 50%, rgba(225,236,255,0))' });
        wf.animate([{ transform: 'none', opacity: 1 }, { transform: `translateY(${R(sgn * far)}px) scaleY(2.6)`, opacity: .55 }], { duration: far / SPEED, easing: 'linear', fill: 'forwards' }).onfinish = () => wf.remove(); }
      // every letter on screen is smeared flat onto the line as the wavefront reaches it
      let n = 0; for (const { s: l, r, cy } of lettersNear(x, y, Math.max(innerWidth, innerHeight) * 1.5, (cx, cy) => cy > -20 && cy < innerHeight + 20).sort((p, q) => Math.abs(p.cy - y) - Math.abs(q.cy - y))) { if (++n > 900) break;
        keep(l, r, [{ transform: 'none' }, { transform: `perspective(320px) translate(${R(J(2))}px,${R((y - cy) * .2)}px) rotateX(${cy < y ? -48 : 48}deg)`, offset: .25 }, { transform: `perspective(320px) translate(${R(J(4))}px,${R((y - cy) * .55)}px) rotateX(${cy < y ? -70 : 70}deg) scale(1.3,.55)`, offset: .5 }, { transform: `translate(${R(J(18))}px,${R((y - cy) * .85)}px) scale(${R(1.6 + rnd())},.2)`, offset: .75 }, { transform: `translate(${R(J(36))}px,${R(y - cy + J(1.4))}px) scale(${R(2.2 + rnd() * 2.4)},.06)` }], 1100, 'cubic-bezier(.6,0,.9,.5)', Math.abs(cy - y) / SPEED); }
    }
    // every block of the page (not our tray) folds flat toward the line, as the wavefront reaches it
    const blocks = [...document.querySelectorAll(opts.blocks || 'body > *')].filter(el => !el.closest('.chb-box, #chb-layer') && !el.querySelector('.chb-box'));
    for (const el of blocks) { const r = el.getBoundingClientRect(), oy = y - r.top, ox = x - r.left, prev = { t: el.style.transform, o: el.style.transformOrigin };
      el.style.transformOrigin = `${R(ox)}px ${R(oy)}px`;
      const dist = Math.max(0, Math.min(Math.abs(r.top - y), Math.abs(r.bottom - y), r.top < y && r.bottom > y ? 0 : 1e9)), delay = D(dist / SPEED);
      const a = el.animate([{ transform: 'none', filter: 'none' }, { transform: 'scale(1.01,.6)', offset: .5 }, { transform: 'scale(1.06,.004)' }], { duration: D(1100), delay, easing: 'cubic-bezier(.7,0,.9,.6)', fill: 'forwards' });
      folds.push({ el, a, prev }); }
    // the line it all became: streaks in the page's own colours, the ink line and the back end's 0 and 1 along it
    const l = mark(sheet()); l.innerHTML = cols.map(([u, c]) => `<path d="M${R(u)} ${R(y + J(2.6))}h${R(4 + rnd() * 22)}" stroke="${c}" stroke-width="${R(.8 + rnd() * 1.4)}" stroke-linecap="round" opacity="${R(.55 + rnd() * .4)}"/>`).join('')
      + `${inkP(`M0 ${R(y)}L${innerWidth} ${R(y)}`, 1.1, .7)}<text class="chb-flow" x="-26" y="${R(y - 3)}" font-size="5" fill="${DATAINK}" ${MONO}>${bits(Math.round(innerWidth / 3) + 12)}</text>`;
    l.animate([{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'none' }], { duration: D(900), delay: D(700), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }); l.style.transformOrigin = `${R(x)}px ${R(y)}px`;
    if (!reduce) { const sheen = fxEl(SCR, innerWidth / 2, y, innerWidth, 70, { background: 'linear-gradient(180deg, rgba(220,232,255,0), rgba(220,232,255,.6) 50%, rgba(220,232,255,0))' }); sheen.animate([{ opacity: 0 }, { opacity: 1, offset: .4 }, { opacity: 0 }], { duration: 1800, delay: 300, fill: 'forwards' }).onfinish = () => sheen.remove(); }
    shown();
  }, reduce ? 0 : FALL);
}
// ---------------------------------------------------------------- eraser, magnet, ink
let eraserEl = null;
function erase(x, y) {
  if (!eraserEl) { eraserEl = place(ART.eraser(), 0, 0, [-19, -11, 34, 26]); eraserEl.style.filter = 'drop-shadow(1px 2px 1px rgba(20,20,19,.3))'; eraserEl._sh = shadow(x, y, 36, .08); } eraserEl.style.left = x + 'px'; eraserEl.style.top = y + 'px'; moveShadow(eraserEl._sh, x, y);
  if (rnd() < .3) { const r = mark(fxEl(SCR, x, y + 2, 26, 18, { background: soft('255,255,250', .4, .5) })); r.style.transform = `rotate(${R(J(20))}deg)`; }
  for (const { s, r } of lettersNear(x, y, 11)) { const c = lift(s, r); c.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(1px,2px) scale(.6)' }], { duration: D(260), fill: 'forwards' }).onfinish = () => c.remove();
    { const b0 = rnd() < .5, dl = R(rnd() * 4); mark(place(`<g class="chb-flipA" style="animation-delay:${dl}s"><text x="0" y="3" text-anchor="middle" ${MONO} font-size="${R(r.height * .62)}" fill="${DATAINK}" opacity=".75">${b0 ? '0' : '1'}</text></g><g class="chb-flipB" style="animation-delay:${dl}s"><text x="0" y="3" text-anchor="middle" ${MONO} font-size="${R(r.height * .62)}" fill="${DATAINK}" opacity=".75">${b0 ? '1' : '0'}</text></g>`, r.left + r.width / 2, r.top + r.height / 2, [-6, -8, 12, 16])); }
    if (rnd() < .35) { const cx = x + J(6), cy = y + 6, cr = mark(place(`<path d="${closed(ring(0, 0, 1.8, 1.4, 5, .2))}" fill="#E8A79C"/>`, cx, cy, [-3, -3, 6, 6])), [k, dur] = toss(cx, cy, J(80), -40 - rnd() * 60, J(400), 3); cr.animate(k, { duration: D(dur), easing: 'linear', fill: 'forwards' }); } }
  breakLines(x, y, 9, 'drop'); if (PINS.length) breakPins((px, py) => Math.hypot(px - x, py - y) < 18); shown();
}
let magnetEl = null, caught = [], magnetX = 0, magnetY = 0, polarity = 1;
function magnet(x, y) {
  magnetX = x; magnetY = y; if (!magnetEl) { magnetEl = mark(place(magnetArt(false), 0, 0, [-26, -32, 52, 64])); magnetEl.classList.add('chb-magnet-live'); polarity = 1; } magnetEl.style.transform = 'translate(' + R(x) + 'px,' + R(y) + 'px)';
  physics.setAttractor('magnet', { x, y, radius: 150, strength: polarity * 11000 });
  const nearby = lettersNear(x, y, 130).sort((a, b) => a.d - b.d); for (const p of nearby) { if (polarity > 0 && caught.reduce((n, k) => n + k.body.parts.length, 0) >= 160) break; const body = liveBody([p]); if (polarity < 0) { const dx = body.x - x, dy = body.y - y, d = Math.hypot(dx, dy) || 1; physics.force(body, dx / d * 850, dy / d * 850 - 120); continue; } catchLetter(body); }
  if (polarity > 0) for (const body of physics.bodies) { if (caught.reduce((n, k) => n + k.body.parts.length, 0) >= 160) break; if (!body.retired && !body.constraint && !body.dragged && Math.hypot(body.x - x, body.y - y) < 150) catchLetter(body); }
  for (const k of caught) { if (k.body.constraint) { k.body.constraint.x = x + k.off[0]; k.body.constraint.y = y + k.off[1]; if (reduce) physics.constrain(k.body, k.body.constraint); else physics.wake(k.body); } } shown();
}
function catchLetter(body) { if (caught.some(k => k.body === body) || caught.reduce((n, k) => n + k.body.parts.length, 0) + body.parts.length > 160) return; const i = caught.length, pole = i % 2 ? 1 : -1, ring = Math.floor(i / 12), a = i * 2.39996, radius = 5 + ring * 2.2, off = [pole * 11 + Math.cos(a) * radius, -13 + Math.sin(a) * radius]; caught.push({ body, off }); for (const p of body.parts) p.c.classList.add('chb-magnet-clump'); physics.constrain(body, { x: magnetX + off[0], y: magnetY + off[1], stiffness: 115, damping: 15, sway: reduce ? 0 : 1.8 }); }
function flipMagnet() { if (!magnetEl) return; polarity *= -1; magnetEl.classList.toggle('is-repel', polarity < 0); magnetEl.innerHTML = magnetArt(polarity < 0); physics.removeAttractor('magnet'); const clump = caught.splice(0); for (const k of clump) { physics.release(k.body); for (const p of k.body.parts) p.c.classList.remove('chb-magnet-clump'); } if (polarity < 0) { for (const b of physics.bodies) { const dx = b.x - magnetX, dy = b.y - magnetY, d = Math.hypot(dx, dy); if (d > 180) continue; physics.force(b, (dx || (b.id % 2 ? -1 : 1)) / (d || 1) * 950, dy / (d || 1) * 950 - 150); } } magnet(magnetX, magnetY); }
function letGo() { physics.removeAttractor('magnet'); for (const k of caught) { physics.release(k.body); for (const p of k.body.parts) p.c.classList.remove('chb-magnet-clump'); } caught = []; magnetEl?.remove(); magnetEl = null; polarity = 1; }

function ink(x, y) {
  const pot = place(ART.ink(), x - 18, y - 22, [-12, -17, 24, 30]); pot.style.transformOrigin = '70% 90%'; pot.style.filter = 'drop-shadow(1px 2px 1px rgba(20,20,19,.3))'; { const psh = shadow(x - 18, y - 10, 26, .6); fallShadow(psh, .6, 0, 240); later(() => psh.remove(), reduce ? 0 : 1100); }
  pot.animate([{ transform: 'translateY(-30px)', opacity: 0 }, { transform: 'none', opacity: 1, offset: .3, easing: 'ease-out' }, { transform: 'rotate(-8deg)', offset: .45 }, { transform: 'rotate(100deg)', offset: .75, easing: 'cubic-bezier(.6,0,.9,.6)' }, { transform: 'rotate(96deg) translateY(-2px)', offset: .85 }, { transform: 'rotate(100deg)', opacity: 0 }], { duration: D(1100), fill: 'forwards' }).onfinish = () => pot.remove();
  later(() => splat(x, y), reduce ? 0 : 780);
}
function splat(x, y) {
  const col = [DEEP, '#3B3D42', SLATE, SAGE2][Math.floor(rnd() * 4)], blot = ring(0, 0, 24, 20, 12, .28), drips = [0, 1, 2].map(() => [J(16), 12 + rnd() * 6, 4 + rnd() * 3, 20 + rnd() * 26]);
  const g = mark(place(`<path d="${closed(blot.map(([px, py]) => [px + 1.5, py + 1.5]))}" fill="${col}" opacity=".9"/>${drips.map(([dx, dy, w, h]) => `<g class="drip" style="transform-origin:${R(dx)}px ${R(dy)}px"><path d="M${R(dx - w / 2)} ${R(dy)}L${R(dx - w / 2)} ${R(dy + h)}A${R(w / 2)} ${R(w / 2)} 0 0 0 ${R(dx + w / 2)} ${R(dy + h)}L${R(dx + w / 2)} ${R(dy)}Z" fill="${col}" opacity=".9"/></g>`).join('')}${[0, 1, 2, 3].map(() => { const a = rnd() * 6.28, d = 30 + rnd() * 14; return `<path d="${closed(ring(Math.cos(a) * d, Math.sin(a) * d * .8, 2 + rnd() * 2.4, 2 + rnd() * 2, 6, .2))}" fill="${col}" opacity=".9"/>`; }).join('')}${drips.map(([dx, dy, w, h], i) => `<path class="chb-drop" style="animation-delay:${R(1 + i * .9 + rnd())}s" d="${closed(ring(dx, dy + h + 4, w * .42, w * .55, 6, .05))}" fill="${col}" opacity=".9"/>`).join('')}<g clip-path="url(#chbI${++uid})"><path class="chb-sheen" d="M-30 -30L-22 -30L-40 30L-48 30Z" fill="${PAPER}" opacity=".3"/></g><clipPath id="chbI${uid}"><path d="${closed(blot)}"/></clipPath>${inkP(over(blot), 1.6, .35)}`, x, y, [-46, -40, 92, 110]));
  g.animate([{ transform: 'scale(.2)' }, { transform: 'scale(1.1)', offset: .6 }, { transform: 'none' }], { duration: D(260), easing: 'ease-out' });
  { const rgb = col === DEEP ? '150,60,30' : col === SLATE ? '60,80,100' : col === SAGE2 ? '70,90,50' : '40,42,48'; stain(x, y + 4, 44, 36, rgb, .32, J(30)); stain(x + 2, y + 30, 26, 46, rgb, .16, 0); }
  g.querySelectorAll('.drip').forEach((d, i) => d.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: D(900 + i * 300), delay: D(200), easing: 'cubic-bezier(.3,0,.3,1)', fill: 'backwards' })); shown();
}

// ---------------------------------------------------------------- painter: words brushed come alive in a random colour style
const PAINTS = ['chb-p-wave', 'chb-p-hop', 'chb-p-sweep', 'chb-p-jelly', 'chb-p-stack', 'chb-p-script', 'chb-p-type', 'chb-p-flag'];
const painted = new Map(); let brush = null;
function paint(x, y, first) {
  const col = [CLAY, GOLD, '#7FB8AE', '#C9B6CC', SKY][Math.floor(rnd() * 5)];
  if (first || !brush) brush = { last: [x, y], col, el: place(`<g transform="translate(-7 -9)">${ART.painter()}</g>`, x, y, [-24, -26, 34, 34]) };
  brush.el.style.left = x + 'px'; brush.el.style.top = y + 'px';
  const [lx, ly] = brush.last, step = Math.hypot(x - lx, y - ly); if (step > 3) {
    if (!brush.svg) { brush.svg = mark(sheet()); brush.went = 0; brush.next = 50 + rnd() * 60; }
    const nx = -(y - ly) / step * 3, ny = (x - lx) / step * 3;   // the bristles: a lighter streak along one side of the stroke
    brush.svg.insertAdjacentHTML('beforeend', `<path d="M${R(lx)} ${R(ly)}L${R(x)} ${R(y)}" stroke="${brush.col}" stroke-width="${R(12 + J(2))}" stroke-linecap="round" opacity=".82"/><path d="M${R(lx + nx)} ${R(ly + ny)}L${R(x + nx)} ${R(y + ny)}" stroke="${PAPER}" stroke-width="2" stroke-linecap="round" opacity=".3"/>`);
    brush.went += step; brush.last = [x, y];
    if (brush.went > brush.next && !reduce) { brush.went = 0; brush.next = 60 + rnd() * 90; const h = 14 + rnd() * 34, dw = 4 + rnd() * 3, dx = x + J(4);   // a drip runs down from the wet paint
      const d = mark(place(`<path d="M${R(-dw / 2)} 0L${R(-dw / 2)} ${R(h)}A${R(dw / 2)} ${R(dw / 2)} 0 0 0 ${R(dw / 2)} ${R(h)}L${R(dw / 2)} 0Z" fill="${brush.col}" opacity=".82"/><path d="${closed(ring(0, h + 3, dw * .6, dw * .75, 6, .05))}" fill="${brush.col}" opacity=".82"/>`, dx, y + 2, [-8, -2, 16, h + 12]));
      (brush.drips ||= []).push(d); d.style.transformOrigin = '50% 0'; d.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 1800 + rnd() * 1800, easing: 'cubic-bezier(.3,0,.3,1)', fill: 'backwards' }); }
    if (rnd() < .06 && !reduce) (brush.drips ||= []).push(mark(place(`<path d="${closed(ring(0, 0, 1.6 + rnd() * 2.2, 1.4 + rnd() * 2, 6, .2))}" fill="${brush.col}" opacity=".8"/>`, x + J(26), y + J(20), [-6, -6, 12, 12])));   // a spatter
  }
  for (const n of textNodesNear(x, y, 14)) split(n);
  for (const w of PAGE().querySelectorAll('.chb-word')) { if (painted.has(w)) continue; const r = w.getBoundingClientRect(); if (x < r.left - 4 || x > r.right + 4 || y < r.top - 6 || y > r.bottom + 6) continue;
    const style = PAINTS[Math.floor(rnd() * PAINTS.length)]; painted.set(w, style); w.classList.add('chb-painted', style);
    [...w.children].forEach((c, i) => c.style.setProperty('--i', i)); w.style.setProperty('--n', w.children.length); w.animate([{ transform: 'scale(1.25)' }, { transform: 'none' }], { duration: D(300), easing: 'cubic-bezier(.3,1.6,.5,1)' }); }
  shown();
}
// the brush lifts: its paint dries for a few seconds, then sags a little and falls away with its drips and spatters
function paintOff() { const b = brush; brush = null; b?.el.remove(); if (!b?.svg) return; const parts = [b.svg, ...(b.drips || [])];
  later(() => { for (const el of parts) { if (!el.isConnected) continue; el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: reduce ? 'none' : 'translateY(9px)' }], { duration: 2600, easing: 'ease-in', fill: 'forwards' }).onfinish = () => el.remove(); } }, 4200); }
// ---------------------------------------------------------------- garden: a seed; a vine grows along the line of text, leaves unfold, flowers open
function garden(x, y) { setTimeout(() => { for (const el of layer.querySelectorAll('svg:not([data-lit])')) if (el.querySelector('.chb-flower, .chb-vine, [class*=vine], [class*=flower]')) { el.dataset.lit = '1'; el.style.filter = 'drop-shadow(1px 2px 1px rgba(30,50,20,.28))'; } }, 0);
  // a vine that runs along the line of text both ways, leaves with a vein that unfold in turn, flowers that open and nod,
  // buds between them; all of it drawn in the hand (offset washes, ink past its start, a lighter lobe on each flower)
  const left = Math.max(10, x - 190 - rnd() * 60), right = Math.min(innerWidth - 10, x + 190 + rnd() * 60), base = y + 10, pts = [];
  for (let u = left; u <= right; u += 9) pts.push([u, base + Math.sin(u / 21) * 3.4 + J(.8)]);
  const d = 'M' + pts.map(([u, v]) => `${R(u)} ${R(v)}`).join('L'); let leaves = '', flowers = '';
  pts.forEach(([u, v], i) => {
    if (i % 3 === 1) { const up = i % 2 ? -1 : 1, s = 1.5 + rnd() * .4, a = J(.25) + .6, L = 15 * s, tx = u + Math.cos(a) * L, ty = v + Math.sin(a) * L * up * .9 + up * 2;
      // an almond leaf: two curves from the stalk to the tip, a midrib, the underside a shade darker, the ink run past its start
      const nx = -(ty - v) / L, ny = (tx - u) / L, w = 4.4 * s, m1 = [u + (tx - u) * .45 + nx * w, v + (ty - v) * .45 + ny * w], m2 = [u + (tx - u) * .45 - nx * w, v + (ty - v) * .45 - ny * w];
      const leaf = `M${R(u)} ${R(v)}Q${R(m1[0])} ${R(m1[1])} ${R(tx)} ${R(ty)}Q${R(m2[0])} ${R(m2[1])} ${R(u)} ${R(v)}`, half = `M${R(u)} ${R(v)}Q${R(m2[0])} ${R(m2[1])} ${R(tx)} ${R(ty)}L${R(u)} ${R(v)}Z`;
      leaves += `<g class="chb-leaf" style="transform-origin:${R(u)}px ${R(v)}px;animation-delay:${R(Math.abs(u - x) / 300)}s, ${R(rnd() * 3)}s"><path d="${leaf}Z" fill="#B7C0A0" transform="translate(.8 .8)"/><path d="${half}" fill="#9EAA82"/>${inkP(leaf + `Q${R(m1[0])} ${R(m1[1])} ${R(lerp(u, tx, .25) + nx * w * .5)} ${R(lerp(v, ty, .25) + ny * w * .5)}`, 1.5)}${inkP(`M${R(u)} ${R(v)}Q${R(lerp(u, tx, .5) + nx * 1.2)} ${R(lerp(v, ty, .5) + ny * 1.2)} ${R(lerp(u, tx, .86))} ${R(lerp(v, ty, .86))}`, .9, .6)}</g>`; }
    if (i % 8 === 5) { const c = [GOLD, CLAY, '#C9B6CC', PAPER, '#E8A79C'][Math.floor(rnd() * 5)], fy = v - 16 - rnd() * 8, fx = u + J(3), np = 5 + Math.floor(rnd() * 2), pr = 6.4 + rnd() * 1.6;
      const petals = [...Array(np)].map((_, k) => { const a = k / np * 6.28 + rnd() * .2; return `<path d="${closed(ring(fx + Math.cos(a) * pr + 1, fy + Math.sin(a) * pr * .92 + 1, pr * .72, pr * .52, 7, .08))}" fill="${c}"/>`; }).join('');
      const petalInk = [...Array(np)].map((_, k) => { const a = k / np * 6.28; return inkP(over(ring(fx + Math.cos(a) * pr, fy + Math.sin(a) * pr * .92, pr * .72, pr * .52, 7, .08)), 1.3, .85); }).join('');
      flowers += `<g class="chb-flower" style="transform-origin:${R(u)}px ${R(v)}px;animation-delay:${R(Math.abs(u - x) / 300 + .55)}s, ${R(rnd() * 4)}s">${inkP(`M${R(u)} ${R(v)}C${R(u - 3)} ${R(v - 6)} ${R(fx + 3)} ${R(fy + 7)} ${R(fx)} ${R(fy)}`, 1.8)}${petals}${petalInk}<path d="${closed(ring(fx, fy, pr * .42, pr * .4, 6, .08))}" fill="${DEEP}"/>${inkP(over(ring(fx, fy, pr * .42, pr * .4, 6, .08)), 1.2)}<path d="${closed(ring(fx - pr * .5, fy - pr * .6, pr * .3, pr * .18, 5, .1))}" fill="${PAPER}" opacity=".55"/></g>`; }
    else if (i % 8 === 1) { const bx = u + J(2), by = v - 9; flowers += `<g class="chb-flower" style="transform-origin:${R(u)}px ${R(v)}px;animation-delay:${R(Math.abs(u - x) / 300 + .4)}s, ${R(rnd() * 4)}s">${inkP(`M${R(u)} ${R(v)}C${R(u)} ${R(v - 4)} ${R(bx)} ${R(by + 4)} ${R(bx)} ${R(by)}`, 1.4)}<path d="${closed(ring(bx, by - 2, 2.8, 4, 6, .08))}" fill="#E8A79C"/>${inkP(over(ring(bx, by - 2, 2.8, 4, 6, .08)), 1.2)}</g>`; }
  });
  const g = mark(sheet());
  g.innerHTML = `<path class="chb-vine" pathLength="1" d="${d}" fill="none" stroke="${SAGE2}" stroke-width="3.2" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${INK}" stroke-width="1" stroke-opacity=".35" transform="translate(0 1.6)"/>${leaves}${flowers}`;
  const v = g.querySelector('.chb-vine'); v.style.strokeDasharray = '1'; v.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: D(1500), easing: 'ease-out', fill: 'backwards' });
  const seedEl = place(`<path d="${closed(ring(0, 0, 4, 2.8, 6, .1))}" fill="${KRAFT}"/>${inkP(over(ring(0, 0, 4, 2.8, 6, .1)), 1.6)}`, x, base, [-6, -6, 12, 12]);
  seedEl.animate([{ transform: 'translateY(-50px) rotate(-40deg)' }, { transform: 'rotate(10deg)', offset: .7, easing: 'ease-in' }, { transform: 'translateY(-4px)', offset: .82 }, { transform: 'none', offset: .9 }, { transform: 'none', opacity: 0 }], { duration: D(900), fill: 'forwards' }).onfinish = () => seedEl.remove();
  shown();
}
// ---------------------------------------------------------------- balloons: a bunch tied along the line, which lifts off swaying; one pops on the way up
// a balloon: a full rubber body a little narrower at the knot, its colour deeper on the shaded side, a long soft shine and a
// small sharp one, a knot and a stub of string (the string to the word is drawn separately, from the knot)
const balloonSVG = (col, len) => { const k = -len, body = ring(0, k - 24, 19, 23, 10, .03).map(([x, y]) => [x * (y > k - 24 ? 1 - (y - (k - 24)) / 70 : 1), y]);
  return `<path d="M0 0C-5 ${R(-len * .33)} 5 ${R(-len * .6)} 0 ${R(-len)}" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".7"/><path d="${closed(body.map(([x, y]) => [x + 1.4, y + 1.6]))}" fill="${col}"/>`
  + `<path d="${closed(ring(6, k - 20, 9, 13, 8, .08))}" fill="${INK}" opacity=".12"/><path d="M-11 ${R(k - 32)}C-12 ${R(k - 24)} -9 ${R(k - 16)} -5 ${R(k - 12)}" fill="none" stroke="${PAPER}" stroke-width="3.2" stroke-linecap="round" opacity=".55"/>`
  + `<path d="${closed(ring(-7, k - 37, 2.4, 3.2, 6, .1))}" fill="${PAPER}" opacity=".85"/>${inkP(over(body), 2.1)}${inkP(`M-2.2 ${R(k - 1.6)}L2.2 ${R(k - 1.6)}L0 ${R(k + 1.8)}Z`, 1.4)}`; };
function balloon(x, y) { const body = wordAt(x, y); if (!body) return; const el = mark(place(balloonSVG([CLAY, GOLD, SKY][balloons.length % 3], 0), 0, 0, [-26, -52, 52, 58])), string = mark(place(inkP('M0 0L1 0', 1.3, .8, ' vector-effect="non-scaling-stroke"').replace('stroke-linecap="round"', 'stroke-linecap="butt"'), 0, 0, [0, -2, 1, 4])); el.classList.add('chb-balloon-live'); string.classList.add('chb-balloon-string'); const b = { body, el, string, thread: string.querySelector('path'), x: body.x, baseX: body.x, y: reduce ? body.y - 42 : innerHeight + 36, startY: innerHeight + 36, tieY: Math.max(56, body.y - 60), age: 0, tied: false, phase: balloons.length * 1.7, point: null }; el._balloon = b; balloons.push(b); physics.constrain(body, { x: body.x, y: body.y, sway: reduce ? 0 : .01 }); if (reduce) { b.tied = true; b.point = physics.constrain(body, { x: body.x, y: body.y - 42, length: 32 }); } physicsFrame(0); drawBalloons(); shown(); return b; }
function tieBalloon(b) { b.tied = true; b.point = physics.constrain(b.body, { x: b.x, y: b.y, length: 40, stiffness: 130, damping: 17, sway: reduce ? 0 : 5 }); }
function popBalloon(b) { const i = balloons.indexOf(b); if (i < 0) return; balloons.splice(i, 1); b.el.remove(); b.string.remove(); physics.release(b.body); const burst = mark(place(PA ? fresh(pickOf(PA.burst)) : burstSVG(16), b.x, b.y - 13, [-24, -24, 48, 48])); burst.classList.add('chb-balloon-pop'); if (!reduce) burst.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.2)', opacity: 0 }], { duration: 260, fill: 'forwards' }).onfinish = () => burst.remove(); else later(() => burst.remove(), 150); if (!reduce) for (let q = 0; q < 6; q++) { const c = mark(place(PA ? fresh(pickOf(PA.scrap)) : ART.foil(), b.x, b.y, [-10, -10, 20, 20])); c.classList.add('chb-balloon-shred'); const [k, dur] = toss(b.x, b.y, J(240), -100 - rnd() * 180, J(600), 4); c.animate(k, { duration: dur, easing: 'linear', fill: 'forwards' }); } }
// ---------------------------------------------------------------- gravity: loose letters, a handle that aims the force
let gravityHandle = null, gravityX = 0, gravityY = 2300;
function gravity() { gravityFall(); if (!gravityHandle) { gravityHandle = mark(place(gravityArt(), 0, 0, [-16, -22, 32, 68])); gravityHandle.classList.add('chb-gravity-handle'); gravityHandle._x = innerWidth / 2; gravityHandle._y = innerHeight / 2 + 80; } drawGravity(); shown(); }
function gravityFall() { const onScreen = r => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, all = lettersNear(innerWidth / 2, innerHeight / 2, Math.hypot(innerWidth, innerHeight), (x, y, r) => onScreen(r)); for (const s of moved) if (s._c?.isConnected && !s._halves) { const r = s._c.getBoundingClientRect(); if (onScreen(r)) all.push({ s, r, cy: r.top + r.height / 2 }); } all.sort((a, b) => b.cy - a.cy); for (const p of all) { const body = liveBody([p]); if (reduce) physics.settle(body); else physics.force(body, J(25), J(20)); } }
function drawGravity() { if (gravityHandle) gravityHandle.style.transform = 'translate(' + R(gravityHandle._x) + 'px,' + R(gravityHandle._y) + 'px) rotate(' + R(Math.atan2(gravityY, gravityX) * 180 / Math.PI - 90) + 'deg)'; }
function tiltGravity(x, y) { const dx = x - innerWidth / 2, dy = y - innerHeight / 2, d = Math.hypot(dx, dy); if (d < 8) return; gravityX = dx / d * 2300; gravityY = dy / d * 2300; physics.setGravity(gravityX, gravityY); drawGravity(); }
function flipGravity() { gravityY = gravityY < 0 ? 2300 : -2300; gravityX = 0; physics.setGravity(gravityX, gravityY); drawGravity(); }

// ---------------------------------------------------------------- the live tools' drawings (portals and their handles, the gravity apple, the magnet)
const PCOL = {"in":["#D97757","#F2A27F","#FFE2CF"],"out":["#4F93C9","#8CC0E6","#DDF0FF"]};
const portalArt = function(key, id) {
  const [c, c2, c3] = PCOL[key], g = `chbP${id}`;
  const arms = [0, 120, 240].map(a => `<path d="M0 0C10 -3 22 1 26 8C28 12 26 15 22 16" fill="none" stroke="${c2}" stroke-width="2.2" stroke-linecap="round" opacity=".85" transform="rotate(${a})"/>`).join('');
  const sparks = [...Array(12)].map((_, i) => { const a = i / 12 * Math.PI * 2; return `<circle cx="${(Math.cos(a) * 41).toFixed(1)}" cy="${(Math.sin(a) * 15).toFixed(1)}" r="${(1 + (i % 3) * .5).toFixed(1)}" fill="${c3}"/>`; }).join('');
  const wisps = [-22, -8, 7, 20].map((x, i) => `<path d="M${x} -6C${x - 4} -16 ${x + 5} -24 ${x} -34" fill="none" stroke="${c2}" stroke-width="1.6" stroke-linecap="round" opacity=".55" class="chb-portal-wisp" style="animation-delay:${-i * .45}s"/>`).join('');
  return `<g class="chb-portal-art">
<defs><radialGradient id="${g}v" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#05060A"/><stop offset=".65" stop-color="#11131C"/><stop offset="1" stop-color="${c}" stop-opacity=".9"/></radialGradient>
<linearGradient id="${g}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c3}"/><stop offset=".5" stop-color="${c2}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
${wisps}
<ellipse rx="44" ry="18" fill="none" stroke="${c}" stroke-width="7" opacity=".25"/>
<ellipse rx="40" ry="16" fill="url(#${g}v)"/>
<g transform="scale(1 .4)"><g class="chb-portal-spin">${arms}<circle r="5" fill="${c3}" opacity=".7"/></g></g>
<ellipse rx="28" ry="10.5" fill="none" stroke="${c2}" stroke-width=".9" opacity=".45"/><ellipse rx="17" ry="6.5" fill="none" stroke="${c2}" stroke-width=".8" opacity=".35"/>
<ellipse rx="40" ry="16" fill="none" stroke="url(#${g}r)" stroke-width="4.2"/>
<path d="M-38 -5C-30 -15 30 -15 38 -5" fill="none" stroke="${c3}" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
<ellipse rx="40.6" ry="16.6" fill="none" stroke="#141413" stroke-width="1.3" opacity=".75"/>
<g class="chb-portal-orbit">${sparks}</g></g>`;
};
const knobArt = c => `<g><circle r="7.5" fill="#E2B865" stroke="#141413" stroke-width="1.4"/><circle cx="-2.2" cy="-2.4" r="2" fill="#FFF3D6" opacity=".9"/><path d="M-11 -2A11 11 0 0 1 4 -10.6" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><path d="M4 -10.6l-4.2 -.6M4 -10.6l-1.6 3.8" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/></g>`;
const edgeArt = c => `<g><path d="M-9 -6L8 -6.6L9 6.4L-8.4 6.8Z" fill="#FFFDF8" stroke="#141413" stroke-width="1.3" stroke-linejoin="round"/><path d="M-5 0H5M-5 0l2.6 -2.4M-5 0l2.6 2.4M5 0l-2.6 -2.4M5 0l-2.6 2.4" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/></g>`;
const gravityArt = () => `<g><path d="M0 14V40" stroke="#141413" stroke-width="2.2" stroke-linecap="round"/><path d="M-7 33L0 42L7 33" fill="none" stroke="#141413" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
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
// ---------------------------------------------------------------- portals: a way in and a way out (our own drawing: a lilac ring and a sage ring)
const portals = [];
const portalSVG = (c, cls) => `<g class="${cls}"><path d="${closed(ring(1, 1.4, 22, 9, 12, .03))}" fill="${VOID}"/><g class="chb-swirl2">${[0, 1, 2].map(i => `<path d="M0 0C${6 + i * 4} -3 ${12 + i * 3} 2 ${10 + i * 5} 6" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" transform="scale(1 .4) rotate(${i * 120})"/>`).join('')}</g><path d="${closed(ring(0, 0, 22, 9, 12, .03))}" fill="none" stroke="${c}" stroke-width="5"/>${inkP(over(ring(0, 0, 25, 11, 12, .03)), 2)}${inkP(over(ring(0, 0, 19, 7, 10, .04)), 1.2, .6)}</g>`;
function portal(x, y) { if (portals.length === 2) { for (const p of portals) { p.el.remove(); p.knob.remove(); p.edge.remove(); p.halo.remove(); } portals.length = 0; } const key = portals.length ? 'out' : 'in', art = portalArt(key, ++uid), el = mark(place(art, 0, 0, [-50, -40, 100, 62])), knob = mark(place(knobArt(PCOL[key][0]), 0, 0, [-14, -14, 26, 24])), edge = mark(place(edgeArt(PCOL[key][0]), 0, 0, [-11, -9, 22, 18])), halo = mark(glow(x, y, 70, key === 'in' ? '214,190,230' : '196,214,170', .45)), p = { x, y, size: 80, angle: y > innerHeight / 2 ? -Math.PI / 2 : Math.PI / 2, el, knob, edge, halo, homeX: x, homeY: y }; el.classList.add('chb-portal-live'); knob.classList.add('chb-portal-knob'); edge.classList.add('chb-portal-edge'); halo.classList.add('chb-portal-halo'); el._portal = knob._portal = edge._portal = p; knob._portalAction = 'rotate'; edge._portalAction = 'resize'; portals.push(p); drawPortal(p); syncPortals(); shown(); return p; }
function drawPortal(p) { const degrees = p.angle * 180 / Math.PI + 90, nx = Math.cos(p.angle), ny = Math.sin(p.angle); p.el.style.transform = 'translate(' + R(p.x) + 'px,' + R(p.y) + 'px) rotate(' + R(degrees) + 'deg) scale(' + R(p.size / 80) + ')'; p.knob.style.transform = 'translate(' + R(p.x + nx * p.size * .55) + 'px,' + R(p.y + ny * p.size * .55) + 'px)'; p.edge.style.transform = 'translate(' + R(p.x - ny * p.size * .5) + 'px,' + R(p.y + nx * p.size * .5) + 'px)'; p.halo.style.transform = 'translate(' + R(p.x - p.homeX) + 'px,' + R(p.y - p.homeY) + 'px) scale(' + R(p.size / 80) + ')'; }
function syncPortals() { physics.setPortals(portals.map(({ x, y, size, angle }) => ({ x, y, size, angle }))); }

// ---------------------------------------------------------------- the tray and the input
// rarity: the gentle tools are common, the strong ones rare, so being dealt a black hole feels like a prize
const TIERNAME = { rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
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
if (!opts.all && opts.reveal !== false) { const b = tray.querySelector('button'), tier = b?.dataset.tier || 'common'; if (b && !reduce) { box.querySelector('.chb-box')?.classList.add('chb-dealt'); b.classList.add('chb-reveal');
  if (tier !== 'common') { const col = { rare: '#9DB4C8', epic: '#DE9A7C', legendary: GOLD }[tier], n = tier === 'legendary' ? 16 : 12, rays = [...Array(n)].map((_, i) => { const a = i / n * 6.2832, a2 = a + 6.2832 / n * .45, r1 = 44 + (i % 2) * 8; return `<path d="M0 0L${R(Math.cos(a) * r1)} ${R(Math.sin(a) * r1)}L${R(Math.cos(a2) * r1)} ${R(Math.sin(a2) * r1)}Z" fill="${col}" opacity=".85"/>` + inkP(`M${R(Math.cos(a) * 14)} ${R(Math.sin(a) * 14)}L${R(Math.cos(a) * r1)} ${R(Math.sin(a) * r1)}`, 1, .35); }).join('');
   // the rays sit in the tray behind the card (a child would paint over the card's face)
   b.insertAdjacentHTML('afterbegin', '<i class="chb-shine" aria-hidden="true"></i>'); tray.insertAdjacentHTML('afterbegin', `<svg class="chb-rays" viewBox="-52 -52 104 104" aria-hidden="true" style="left:${b.offsetLeft + b.offsetWidth / 2}px;top:${b.offsetTop + b.offsetHeight * .42}px">${rays}</svg>`); b.style.zIndex = '1';
   if (tier === 'epic' || tier === 'legendary') for (let i = 0; i < (tier === 'legendary' ? 14 : 8); i++) { const a = Math.random() * 6.2832, d = 34 + Math.random() * 30, s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '-6 -6 12 12'); s.setAttribute('class', 'chb-spark'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<path d="M0 -5.4C.6 -1.2 1.2 -.6 5.4 0C1.2 .6 .6 1.2 0 5.4C-.6 1.2 -1.2 .6 -5.4 0C-1.2 -.6 -.6 -1.2 0 -5.4Z" fill="${tier === 'legendary' ? GOLD : '#F2DC8E'}"/>` + inkP('M0 -5.4C.6 -1.2 1.2 -.6 5.4 0C1.2 .6 .6 1.2 0 5.4C-.6 1.2 -1.2 .6 -5.4 0C-1.2 -.6 -.6 -1.2 0 -5.4Z', .8, .7);
    s.style.setProperty('--dx', R(Math.cos(a) * d) + 'px'); s.style.setProperty('--dy', R(Math.sin(a) * d) + 'px'); s.style.animationDelay = R(.25 + Math.random() * .35) + 's'; b.append(s); } } } }
let tool = null, down = false;
const HOW = Object.fromEntries(TOOLS.map(t => [t[0], t[3]]));
function pick(name) { if (name && (dead || opts.allowed?.() === false)) name = null; if (tool === 'magnet') letGo(); releaseInteraction(true); release(); tool = tool === name ? null : name; for (const b of tray.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool)); document.documentElement.classList.toggle('chb-armed', !!tool); document.documentElement.dataset.chbTool = tool || ''; aimFor = null; if (!tool) aimOff(); }
// the aim: a drawn crosshair that always marks where the pointer is while a tool is in hand (the system cursor is hidden
// only while the aim is showing), with the tool itself as a small badge beside it. Kept out of #chb-layer: never undone.
const aim = document.getElementById('chb-aim') || Object.assign(document.createElement('div'), { id: 'chb-aim' });
aim.setAttribute('aria-hidden', 'true'); if (!aim.isConnected) document.documentElement.append(aim);
let aimFor = null;
function aimArt(k) {
  const t = TOOLS.find(t => t[0] === k), acc = t[4] === 'weapon' ? DEEP : SAGE2, rim = ring(0, 0, 10.5, 10.5, 9, .035);
  const halo = (d, w) => `<path d="${d}" fill="none" stroke="${PAPER}" stroke-width="${w}" stroke-linecap="round" stroke-opacity=".92"/>`;
  const ticks = [0, 1, 2, 3].map(i => { const a = i * 1.5708 + J(.05), c = Math.cos(a), si = Math.sin(a), d = `M${R(c * 13.6)} ${R(si * 13.6)}L${R(c * (19 + J(.6)))} ${R(si * (19 + J(.6)))}`; return halo(d, 4.6) + inkP(d, 1.9); }).join('');
  const hatch = [0, 1, 2].map(i => { const a = .5 + i * .22, c = Math.cos(a), si = Math.sin(a); return inkP(`M${R(c * 6.6)} ${R(si * 6.6)}L${R(c * 8.6)} ${R(si * 8.6)}`, 1, .5); }).join('');
  aim.innerHTML = `<svg class="chb-ret" viewBox="-21 -21 42 42"><g class="chb-ticks">${ticks}</g><g class="chb-spin">${halo(over(rim), 5.2)}<path d="${over(off(rim, 1.3, 1.1))}" fill="none" stroke="${acc}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="21 9 13 12" opacity=".85"/>${inkP(over(rim), 1.9)}${hatch}</g>`
    + `<path d="${closed(ring(0, 0, 2.8, 2.8, 6, .05))}" fill="${PAPER}" opacity=".92"/><path d="${closed(ring(.2, .2, 1.5, 1.5, 6, .08))}" fill="${INK}"/></svg>`
    + `<svg class="chb-badge" viewBox="-16 -16 32 32">${shp(ring(0, 0, 13, 12, 8, .06), PAPER, 1.6, true)}<svg x="-10" y="-10" width="20" height="20" viewBox="${t[2]}">${ART[k]()}</svg></svg>`;
  aimFor = k;
}
function aimAt(e) {
  const show = opts.allowed?.() !== false && !!tool && !(opts.ours && e.target.closest?.(opts.ours)) && e.pointerType !== 'touch' && !e.target.closest?.('.chb-box') && e.target.tagName !== 'IFRAME';
  if (show && aimFor !== tool) aimArt(tool);
  if (show) aim.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  aim.classList.toggle('is-on', show); document.documentElement.classList.toggle('chb-aiming', show);
}
function aimOff() { aim.classList.remove('is-on', 'is-down'); document.documentElement.classList.remove('chb-aiming'); }
const aimPulse = () => { if (!reduce) aim.querySelector('.chb-ret')?.animate([{ transform: 'none' }, { transform: 'scale(.78)', offset: .35 }, { transform: 'scale(1.12)', offset: .7 }, { transform: 'none' }], { duration: 260, easing: 'ease-out' }); };
listen(document, 'pointerover', aimAt, true);
listen(document, 'pointerout', e => { if (!e.relatedTarget) aimOff(); }, true);
listen(globalThis, 'blur', aimOff);
tray.addEventListener('click', e => { const b = e.target.closest('button[data-tool]'); if (b) { e.stopPropagation(); pick(b.dataset.tool); } });
const notOurs = e => !tool || opts.allowed?.() === false || e.target.closest('#chb-tray,#chb-undo') || !!(opts.ours && e.target.closest(opts.ours));
let restoring = false;
const CLICK = { bomb, hammer, railgun, blackhole, foil, ink, garden, balloon, portal, gravity: () => gravity() };
let interaction = null, swallowUntil = -1, swallowX = 0, swallowY = 0;
const stamp = e => Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now();
const managed = e => e.target.closest?.('.chb-physics-body,.chb-balloon-live,.chb-gravity-handle,.chb-portal-live,.chb-portal-knob,.chb-portal-edge');
const ownedInput = e => opts.allowed?.() !== false && !(opts.ours && e.target.closest?.(opts.ours)) && !e.target.closest?.('#chb-tray,#chb-undo') && (!tool || ['portal', 'gravity', 'balloon', 'magnet'].includes(tool));
function captureInteraction(e, value) { interaction = { ...value, id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, target: e.target }; try { e.target.setPointerCapture?.(e.pointerId); } catch {} e.preventDefault(); e.stopPropagation(); }
function releaseInteraction(cancelled = false, e) { if (!interaction || e && e.pointerId !== interaction.id) return; const i = interaction; interaction = null; if (i.body) physics.dragEnd(i.body, cancelled ? (e ? stamp(e) : performance.now()) + 1000 : stamp(e || {})); if (i.kind === 'gravity' && !i.moved && !cancelled) flipGravity(); if (i.kind === 'balloon' && !cancelled) popBalloon(i.balloon); if (i.kind !== 'pending' || i.moved) { swallowUntil = (e ? stamp(e) : performance.now()) + 450; swallowX = e?.clientX ?? i.startX; swallowY = e?.clientY ?? i.startY; } try { i.target.releasePointerCapture?.(i.id); } catch {} }
listen(document, 'click', e => { if (stamp(e) <= swallowUntil && Math.hypot(e.clientX - swallowX, e.clientY - swallowY) < 8 && !e.target.closest?.('#chb-tray,#chb-undo')) { swallowUntil = -1; e.preventDefault(); e.stopPropagation(); return; } if (notOurs(e)) return; e.preventDefault(); e.stopPropagation(); if (restoring) return; if (CLICK[tool]) aimPulse(); CLICK[tool]?.(e.clientX, e.clientY); }, true);
listen(document, 'pointerdown', e => { if (restoring || e.isPrimary === false || e.button > 0 || interaction) return; const target = managed(e); if (ownedInput(e) && target) { if (target._balloon) { captureInteraction(e, { kind: 'balloon', balloon: target._balloon }); return; } if (target === gravityHandle) { captureInteraction(e, { kind: 'gravity' }); return; } if (target._portal) { const p = target._portal, action = target._portalAction || (Math.hypot(e.clientX - p.x, e.clientY - p.y) > p.size * .4 ? 'resize' : 'move'); captureInteraction(e, { kind: 'portal', portal: p, action, dx: p.x - e.clientX, dy: p.y - e.clientY }); return; } if (target._body && tool !== 'magnet') { let body = target._body; if (body.retired) { body = physics.add({ ...body, awake: true, retired: false }); for (const p of body.parts) p.s._body = p.c._body = body; } physics.dragStart(body, e.clientX, e.clientY, stamp(e)); captureInteraction(e, { kind: 'body', body }); return; } } if (notOurs(e)) return; e.preventDefault(); if (tool === 'portal') { captureInteraction(e, { kind: 'pending' }); return; } if (HOW[tool] !== 'drag') return; down = true; aim.classList.add('is-down'); if (tool === 'eraser') erase(e.clientX, e.clientY); if (tool === 'magnet') { if (magnetEl) flipMagnet(); else magnet(e.clientX, e.clientY); } if (tool === 'laser') laser(e.clientX, e.clientY, true); if (tool === 'painter') paint(e.clientX, e.clientY, true); }, true);
listen(document, 'pointermove', e => { if (opts.allowed?.() === false) { pick(null); return; } aimAt(e); if (interaction && interaction.id === e.pointerId) { const i = interaction; if (Math.hypot(e.clientX - i.startX, e.clientY - i.startY) > 4) i.moved = true; if (i.kind === 'pending' && i.moved) { const body = wordAt(i.startX, i.startY); i.kind = 'body'; if (body) { i.body = body; physics.dragStart(body, i.startX, i.startY, stamp(e) - 16); } } if (i.body) physics.dragMove(i.body, e.clientX, e.clientY, stamp(e)); if (i.kind === 'gravity' && i.moved) { gravityHandle._x = e.clientX; gravityHandle._y = e.clientY; tiltGravity(e.clientX, e.clientY); } if (i.kind === 'portal') { const p = i.portal; if (i.action === 'rotate') p.angle = Math.atan2(e.clientY - p.y, e.clientX - p.x); else if (i.action === 'resize') p.size = Math.max(40, Math.min(220, Math.hypot(e.clientX - p.x, e.clientY - p.y) * 2)); else { p.x = Math.max(4, Math.min(innerWidth - 4, e.clientX + i.dx)); p.y = Math.max(4, Math.min(innerHeight - 4, e.clientY + i.dy)); } drawPortal(p); syncPortals(); } e.preventDefault(); return; } if (tool === 'magnet' && magnetEl) magnet(e.clientX, e.clientY); if (!down) return; if (tool === 'eraser') erase(e.clientX, e.clientY); if (tool === 'laser') laser(e.clientX, e.clientY); if (tool === 'painter') paint(e.clientX, e.clientY); }, true);
const release = () => { if (!down) return; down = false; aim.classList.remove('is-down'); if (tool !== 'magnet') letGo(); laserOff(); paintOff(); eraserEl?._sh?.remove(); eraserEl?.remove(); eraserEl = null; };
listen(document, 'pointerup', e => { releaseInteraction(false, e); release(); }, true); listen(document, 'pointercancel', e => { releaseInteraction(true, e); release(); if (tool === 'magnet') letGo(); }, true);
listen(document, 'wheel', e => { const target = managed(e); if (!ownedInput(e) || !target?._portal || restoring) return; e.preventDefault(); e.stopPropagation(); const p = target._portal; p.size = Math.max(40, Math.min(220, p.size - Math.sign(e.deltaY) * 10)); drawPortal(p); syncPortals(); }, { capture: true, passive: false });
listen(document, 'contextmenu', e => { if (tool !== 'magnet' || notOurs(e) || restoring) return; e.preventDefault(); e.stopPropagation(); if (magnetEl) flipMagnet(); else magnet(e.clientX, e.clientY); }, true);
listen(document, 'keydown', e => { if (e.key === 'Escape') { releaseInteraction(true); if (tool) pick(tool); else letGo(); } });
listen(globalThis, 'blur', () => { releaseInteraction(true); release(); letGo(); });

function returnFold(f, duration, easing) {
  const from = getComputedStyle(f.el).transform; f.a.cancel();
  const back = { ...f, a: f.el.animate([{ transform: from }, { transform: 'none' }], { duration: D(duration), easing }) };
  returning.add(back); back.a.onfinish = () => { f.el.style.transform = f.prev.t; f.el.style.transformOrigin = f.prev.o; back.a.cancel(); returning.delete(back); };
}
// ---------------------------------------------------------------- put it back: letters home along their own paths, lines mended, the page unfolded
undo.addEventListener('click', () => {
  if (restoring) return;
  // nothing still pending may land after the page is restored; drawings caught mid-way (not marks) go at once
  for (const id of timers) clearTimeout(id); timers.clear(); restoring = true; releaseInteraction(true); letGo(); physicsView.clear(); balloons.length = 0; portals.length = 0; gravityHandle = null; gravityX = 0; gravityY = 2300; physics.setGravity(0, 2300);
  { const keepers = new Set(marks); for (const s of moved) { if (s._c) keepers.add(s._c); for (const h of s._halves || []) keepers.add(h); } for (const el of [...layer.children, ...MUL.children, ...OVL.children, ...SCR.children]) if (!keepers.has(el)) el.remove(); }
  if (tool) pick(tool); letGo(); laserOff(); paintOff(); let longest = 400;
  for (const [w, st] of painted) w.classList.remove('chb-painted', st); painted.clear();
  for (const f of folds.splice(0)) { returnFold(f, 1100, 'cubic-bezier(.2,.9,.3,1)'); longest = Math.max(longest, 1100); }
  for (const s of moved) try {
    if (s._halves) { for (const h of s._halves) h.animate([{ transform: getComputedStyle(h).transform }, { transform: 'none' }], { duration: D(360), fill: 'forwards' }).onfinish = () => { h.remove(); s.style.visibility = ''; }; continue; }
    if (s._c) { const c = s._c, from = getComputedStyle(c).transform, home = s._physicsPath ? [...s._physicsPath].reverse().map(f => ({ ...f })) : [{ transform: from }, { transform: 'none' }]; if (s._physicsPath) { home[0] = { transform: from }; home.push({ transform: 'none' }); } c.getAnimations().forEach(a => a.cancel()); c.style.transition = 'none'; c.style.transform = 'none'; c.animate(home, { duration: D(520), easing: 'cubic-bezier(.3,0,.2,1)' }).onfinish = () => { c.remove(); s.style.visibility = ''; }; longest = Math.max(longest, 520); continue; }
    const r = s.getBoundingClientRect(), cs = getComputedStyle(s), c = document.createElement('span'); c.textContent = s.textContent; Object.assign(c.style, { position: 'absolute', left: r.left + 'px', top: r.top + 'px', font: cs.font, color: cs.color, lineHeight: r.height + 'px', whiteSpace: 'pre' }); layer.append(c);
    // the path home is the flight reversed (timed stops mirrored so they stay in order)
    if (s._k) { const back = [...s._k].reverse().map(f => { const g = { ...f, opacity: 1 }; if (f.offset != null) g.offset = 1 - f.offset; delete g.easing; return g; });
      c.animate(back, { duration: D(s._d / 1.6), easing: 'cubic-bezier(.3,0,.2,1)' }).onfinish = () => { c.remove(); s.style.visibility = ''; }; longest = Math.max(longest, s._d / 1.6); }
    else c.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: D(360) }).onfinish = () => { c.remove(); s.style.visibility = ''; };
  } catch { s.style.visibility = ''; s._c?.remove(); }
  holes.length = 0; FLOOR.clear(); HITS.length = 0; PINS.length = 0; flat = false;
  for (const m of marks.splice(0)) m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D(400), fill: 'forwards' }).onfinish = () => m.remove();
  setTimeout(() => { for (const [el, sides] of lines) for (const side in sides) el.style['border' + side + 'Color'] = sides[side].inline; lines.clear();
    for (const { holder, node } of splits.splice(0)) holder.replaceWith(node); for (const s of moved) { delete s._c; delete s._k; delete s._halves; delete s._body; delete s._physicsPath; } moved.clear(); undo.style.display = 'none'; restoring = false; }, reduce ? 0 : longest + 80);
});
// Teardown is synchronous: a disabled feature never waits for the animated Undo path to finish.
function reset() {
  cancelWork(); timers.clear(); releaseInteraction(true); pick(null); letGo(); laserOff(); paintOff(); eraserEl?._sh?.remove(); eraserEl?.remove(); eraserEl = null; physicsView.clear();
  for (const animation of ourAnimations()) animation.cancel(); pageAnimations.clear(); heldAnimations.clear();
  for (const f of [...folds.splice(0), ...returning]) { f.a.cancel(); f.el.style.transform = f.prev.t; f.el.style.transformOrigin = f.prev.o; } returning.clear();
  for (const [el, sides] of lines) for (const side in sides) el.style['border' + side + 'Color'] = sides[side].inline;
  lines.clear(); for (const [word, style] of painted) word.classList.remove('chb-painted', style); painted.clear();
  for (const s of moved) { s.style.visibility = ''; s._c?.remove(); for (const h of s._halves || []) h.remove(); for (const key of ['_c', '_k', '_halves', '_body', '_physicsPath']) delete s[key]; }
  moved.clear(); for (const { holder, node } of splits.splice(0)) if (holder.parentNode) holder.replaceWith(node);
  for (const el of [...layer.children]) if ([MUL, OVL, SCR].includes(el)) { for (const child of [...el.children]) child.remove(); } else el.remove();
  marks.length = holes.length = HITS.length = PINS.length = balloons.length = portals.length = 0;
  FLOOR.clear(); flat = false; gravityHandle = null; gravityX = 0; gravityY = 2300; physics.setGravity(0, 2300);
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
return { physics, physicsView, balloons, portals, flipMagnet, flipGravity, popBalloon, ART, TOOLS, scarSVG, crackSVG, portalSVG, burstSVG, bomb, hammer, laser, laserOff, railgun, blackhole, foil, erase, magnet, letGo, ink, paint, paintOff, garden, balloon, gravity, portal, pick, shake, setMotion, dealt, get tool() { return tool; }, destroy, undo: () => undo.click() };
};
globalThis.ReservePlay = { mount, deal, tiers: TIER, weights: ODDS };
})();
