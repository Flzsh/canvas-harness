import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { RAD, reseed, rnd, J, R, lerp, rot, Pth, S, sides, wash, crClosed, crOpen, ringPts, blob, ringStroke, lune, star4, bar, figure, kepler } from './lib.mjs';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'astronomy-banner.svg');
reseed(7741);
const C = { paper: '#FAF9F5', ink: '#141413', clay: '#D97757', clayD: '#C96442', kraft: '#D4A27F', oat: '#E3DACC', shadow: '#CFC2AC', manila: '#EBDBBC', sky: '#C9D6DF', sageD: '#7D8B5F', gold: '#E2B865', slate: '#6F7F8C', chart: '#34508E', key: '#76819E', violet: '#A98FBC', blue: '#5F82BD', orange: '#DD8A4E', red: '#C2503A' };
const CY = 16;                                   // one clock, seconds
const P = (cls, d, extra = '') => `<path class="${cls}"${extra} d="${d}"/>`;
const F = (fill, d, extra = '') => `<path fill="${fill}"${extra} d="${d}"/>`;
const I = (w, d, extra = '') => `<path class="i" stroke-width="${w}"${extra} d="${d}"/>`;
let css = '', L = [];                            // L = layers, back to front
const add = s => L.push(s);

// ================= ground =================
{
  const top = [], bot = []; for (let x = 0; x <= 1680; x += 210) { top.push([x, 210.5 + J(1.1)]); bot.push([x, 226.5 + J(1.2)]); }
  const p = new Pth(); p.M(...top[0]); for (let i = 1; i < top.length; i++) p.W(...top[i], .8); p.L(1680, bot[8][1]); for (let i = 7; i >= 0; i--) p.W(...bot[i], .8); p.Z();
  add(F(C.oat, p, ' opacity=".55"'));
  const sh = new Pth();
  for (const [x, w] of [[68, 20], [372, 20], [566, 12], [604, 10], [640, 12], [670, 28], [724, 14], [772, 26], [1030, 14], [1132, 46], [1322, 18], [1440, 26], [1541, 18]]) { sh.M(x - w / 2, 219 + J(.6)); sh.W(x + w / 2, 219 + J(.6), .5); }
  add(`<path fill="none" stroke="${C.shadow}" stroke-width="5" stroke-linecap="round" opacity=".85" d="${sh}"/>`);
  add(P('f', S(new Pth(), [[0, 214], [562, 212.6]]) + '' + S(new Pth(), [[556, 213.2], [1196, 212.5]]) + S(new Pth(), [[1190, 213.1], [1680, 214]])));
}

// ================= the title: a star chart on two legs =================
const TB = [[22, 25], [421, 23], [423, 190], [21, 191]];
{
  let g = '';
  for (const x of [68, 372]) { const b = bar([x, 189], [x + J(1), 213], 9); g += F(C.kraft, wash(new Pth(), b.q, .6)) + P('f', S(new Pth(), b.edges[0]) + S(new Pth(), b.edges[1])); }
  // the blue: loose, stops short of the top right corner, wavy lower edge
  const w = [[24.5, 27.5], [150, 26.5], [290, 25.8], [412, 25.6], [419.5, 31], [421, 110], [421.5, 186.5]];
  for (let x = 360; x >= 60; x -= 60) w.push([x, 188 + J(1.4)]); w.push([24, 188.5], [23.5, 110]);
  g += F(C.chart, wash(new Pth(), w, .9));
  g += `<path fill="none" stroke="${C.paper}" stroke-width="1.5" stroke-linecap="round" opacity=".5" d="${sides(new Pth(), [[30, 33], [413, 31], [415, 181], [29, 182.5]], .7)}"/>`;
  // crescent, ecliptic, a planet on it, four faint stars
  g += F(C.paper, lune(new Pth(), 60, 62, 15.5, .46, 1), ' transform="rotate(-18 60 62)"');
  g += `<path fill="none" stroke="${C.paper}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="6 7.5" opacity=".75" d="${crOpen(new Pth(), [[90, 80], [150, 61], [228, 49], [306, 50], [364, 62]])}"/>`;
  g += F(C.clay, blob(new Pth(), 236, 48.6, 4.2, 4.2, { n: 6 }));
  const dots = new Pth(); for (const [x, y] of [[120, 42], [196, 37], [296, 35], [338, 82]]) blob(dots, x, y, 2.1, 2.1, { n: 5 });
  g += F(C.paper, dots, ' opacity=".8"');
  // letters
  const LET = {
    A: { w: 33, s: [[[0, 1], [.5, 0], [1, 1]], [[.2, .63], [.8, .63]]], big: [1] },
    S: { w: 28, s: [[[.98, .13], [.5, 0], [.03, .24], [.5, .5], [.97, .76], [.5, 1], [.02, .87]]], big: [] },
    T: { w: 30, s: [[[0, 0], [1, 0]], [[.5, 0], [.5, 1]]], big: [] },
    R: { w: 28, s: [[[0, 1], [0, 0], [.72, .02], [1, .27], [.7, .52], [0, .52]], [[.7, .52], [1, 1]]], big: [3] },
    O: { w: 30, s: [[[.5, 0], [.98, .25], [1, .75], [.5, 1], [.02, .75], [0, .25], [.5, 0]]], big: [] },
    N: { w: 29, s: [[[0, 1], [0, 0], [1, 1], [1, 0]]], big: [3] },
    M: { w: 36, s: [[[0, 1], [0, 0], [.5, .64], [1, 0], [1, 1]]], big: [] },
    Y: { w: 31, s: [[[0, 0], [.5, .52], [1, 0]], [[.5, .52], [.5, 1]]], big: [1] }
  };
  const word = 'ASTRONOMY', y0 = 100, h = 68, gap = 13; let x = 33, lines = '', under = '', stars = new Pth(), bigs = new Pth();
  [...word].forEach((ch, k) => {
    const d = LET[ch], lean = J(.035), seen = new Map(), p = new Pth(); let vi = 0;
    const V = (u, v) => { const key = u + ',' + v; if (!seen.has(key)) seen.set(key, [x + u * d.w + (1 - v) * h * lean + J(1.1), y0 + v * h + J(1.2)]); return seen.get(key); };
    for (const st of d.s) { const pts = st.map(q => V(...q)); p.M(...pts[0]); for (let i = 1; i < pts.length; i++) p.W(...pts[i], .45); }
    for (const [key, q] of seen) { if (d.big.includes(vi) && (ch !== 'O')) star4(bigs, q[0], q[1], 9.2, J(8)); else blob(stars, q[0], q[1], 4.3 + rnd() * .6, 4.3 + rnd() * .6, { n: 6, j: .035 }); vi++; }
    lines += `<path class="cl L${k}" pathLength="1" d="${p}"/>`; under += p;
    const a = 75 + 2.3 * k;
    css += `.L${k}{animation:L${k} ${CY}s infinite}@keyframes L${k}{0%,${R(a)}%{stroke-dashoffset:0}${R(a + .1)}%{stroke-dashoffset:1;animation-timing-function:cubic-bezier(.3,0,.4,1)}${R(a + 3.5)}%,100%{stroke-dashoffset:0}}`;
    x += d.w + gap;
  });
  g += `<path fill="none" stroke="${C.paper}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round" opacity=".4" d="${under}"/>` + lines + F(C.gold, stars) + F(C.gold, bigs);
  g += P('t', new Pth().M(398, 176).W(392, 185, .3).M(405, 176).W(399, 185, .3).M(412, 176).W(406, 185, .3));
  g += I(2.8, sides(new Pth(), TB));
  // the target star the telescope is aimed at
  g += `<g class="tstar">${F(C.gold, star4(new Pth(), 402, 58, 12.5, 6))}</g>`;
  css += `.cl{fill:none;stroke:${C.paper};stroke-width:5.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1}.tstar{transform-origin:402px 58px;animation:tstar ${CY}s infinite}@keyframes tstar{0%,23.5%{transform:scale(1)}26%{transform:scale(1.45)}30.5%,100%{transform:scale(1)}}`;
  add(g);
}

// ================= moon-phase garland =================
const SCR = { tl: [990, 27], bl: [990, 177], tr: [1034, 20], br: [1034, 170] };
{
  const A = [421, 24], B = SCR.tl, cy = s => lerp(A[1], B[1], s) + 44 * s * (1 - s), cpts = [];
  for (let i = 0; i <= 8; i++) cpts.push([lerp(A[0], B[0], i / 8), cy(i / 8) + (i % 8 ? J(.6) : 0)]);
  let g = I(1.9, crOpen(new Pth(), cpts));
  const ph = [[-1, 1], [-1, .5], [-1, 0], [-1, -.5], null, [.5, 1], [0, 1], [-.5, 1]], th = new Pth(), dark = new Pth(), lit = new Pth(), ol = new Pth();
  ph.forEach((k, i) => {
    const x = 462 + 58 * i + J(2), s = (x - A[0]) / (B[0] - A[0]), r = 11 + J(.5), t = 5 + rnd() * 3, yc = cy(s) + t + r;
    th.M(x + J(.4), cy(s)); th.W(x, yc - r, .4);
    blob(lit, x, yc, r, r, { n: 7, j: .02 });
    if (k) lune(dark, x, yc, r - .3, k[0], k[1]);
    ringStroke(ol, x, yc, r, r, { n: 7, j: .025 });
  });
  g += I(1.7, th) + F(C.paper, lit) + F(C.slate, dark) + I(2.1, ol);
  // knots where the cord is tied
  g += I(2, new Pth().M(419, 22).W(424, 27, .3).M(988, 25).W(993, 30, .3));
  add(g);
}

// ================= telescope (static part: tripod and yoke) =================
const TP = [600.9, 92.9], TA = 10, U = [Math.cos(TA * RAD), Math.sin(TA * RAD)], V = [-U[1], U[0]];
const tp = (u, v) => [TP[0] + u * U[0] + v * V[0], TP[1] + u * U[1] + v * V[1]];
{
  let g = '';
  const legs = [[[603, 116], [604.5, 212], 5.5], [[599.5, 114], [565, 212], 6.5], [[603.5, 114], [640, 212], 6.5]];
  const lw = new Pth(), li = new Pth();
  for (const [a, b, w] of legs) { const q = bar(a, b, w); wash(lw, q.q, .5); S(li, q.edges[0]); S(li, q.edges[1]); S(li, [[b[0] - w / 2 - 1, b[1] + .6], [b[0] + w / 2 + 1, b[1] + .4]]); }
  g += F(C.kraft, lw) + P('f', li) + P('f', S(new Pth(), [[583.5, 163], [622.5, 164.5]]));
  g += F(C.slate, wash(new Pth(), [[593, 99], [609.5, 101], [608, 117.5], [595, 117]], .5)) + I(2.4, sides(new Pth(), [[593, 99], [609.5, 101], [608, 117.5], [595, 117]], .5));
  add(g);
}

// ================= bench (table), grating holder, screen =================
const G = [800, 128];
{
  let g = '';
  // top surface (a little depth), front edge, legs, stretcher
  const top = [[719, 169.5], [1041, 169], [1047, 179], [713, 179.5]];
  for (const x of [726, 1031]) { const b = bar([x, 184], [x + J(1), 212.5], 7.5); g += F(C.kraft, wash(new Pth(), b.q, .5)) + P('f', S(new Pth(), b.edges[0]) + S(new Pth(), b.edges[1])); }
  g += P('f', S(new Pth(), [[730, 199], [1027, 198]]));
  g += F(C.kraft, wash(new Pth(), [[718, 170.5], [880, 170], [1040, 170], [1046, 180], [1045, 184.5], [880, 185.5], [715, 185], [714, 180]], .7));
  g += F(C.paper, wash(new Pth(), [[760, 171.5], [990, 171], [996, 175.5], [757, 176]], .5), ' opacity=".35"');
  g += P('f', S(new Pth(), [top[0], top[1]]) + S(new Pth(), [top[1], top[2]]) + S(new Pth(), [top[3], top[0]]) + S(new Pth(), [[713, 185.5], [1046, 185]]) + S(new Pth(), [[713, 179], [713.5, 185.5]]) + S(new Pth(), [[1047, 179], [1046.5, 185]]));
  g += I(2.5, S(new Pth(), [top[3], top[2]]));
  g += F(C.ink, new Pth().M(722, 186.5).C(800, 189.5, 960, 189.5, 1040, 186).C(960, 187.4, 800, 187.6, 722, 186.5).Z());
  // hatching at the shaded end of the top
  g += P('t', new Pth().M(1016, 181).W(1011, 185, .3).M(1024, 181).W(1019, 185, .3).M(1032, 181).W(1027, 185, .3));
  // grating holder: foot, post, clip
  g += F(C.ink, blob(new Pth(), 800.5, 175, 8.5, 2.6, { n: 6, j: .05 }));
  g += I(2.7, S(new Pth(), [[800.6, 174], [800.2, 148.5]])) + I(2.6, new Pth().M(793.6, 139.5).W(794.4, 148.6, .3).W(806.8, 147.2, .3).W(807.3, 138, .3));
  // screen: a sheet on a board, propped from behind
  g += I(2.3, S(new Pth(), [[1030, 60], [1043, 170.5]]));
  const sq = [SCR.tl, SCR.tr, SCR.br, SCR.bl];
  g += F(C.paper, wash(new Pth(), sq, .4)) + F(C.oat, wash(new Pth(), [[1022, 24], [1033, 22], [1033.5, 168], [1023, 170]], .5), ' opacity=".7"');
  g += P('t', new Pth().M(1031, 132).W(1025, 141, .3).M(1031.5, 141).W(1025.5, 150, .3).M(1032, 150).W(1026, 159, .3)) + I(2.7, sides(new Pth(), sq, .6));
  g += F(C.ink, new Pth().M(986, 178).C(1000, 177.5, 1022, 173.5, 1038, 170.5).C(1022, 175.6, 1000, 179.8, 986, 178).Z());
  add(g);
}

// ================= orrery (Kepler) =================
const OC = [1174, 104], OA = 84, OB = 28, OE = .5, SUN = [OC[0] - OA * OE, OC[1]];
const orb = E => [OC[0] - OA * Math.cos(E), OC[1] + OB * Math.sin(E)];   // E = 0 at perihelion (left); 0..pi is the near half
{
  let g = '';
  const arc = (a, b, n = 9) => { const o = []; for (let i = 0; i <= n; i++) { const q = orb(lerp(a, b, i / n)); o.push([q[0] + J(.5), q[1] + J(.5)]); } return o; };
  // far half of the hoop (thin), the two equal-area sectors, post and base, the Sun, the arms, the near half
  g += `<path class="i" stroke-width="2" stroke-opacity=".7" d="${crOpen(new Pth(), arc(Math.PI - .04, 2 * Math.PI + .04, 10))}"/>`;
  const E1 = 0.7245, E2 = 2.8783, sect = (a, b) => { const p = new Pth().M(SUN[0], SUN[1]), pts = arc(a, b, 5).map(q => [lerp(q[0], SUN[0], .04), lerp(q[1], SUN[1], .04)]); p.W(...pts[0], .4); for (let i = 1; i < pts.length; i++) p.W(...pts[i], .3); p.W(SUN[0], SUN[1], .4); return p.Z(); };
  g += F(C.clay, sect(-E1, E1) + sect(E2, 2 * Math.PI - E2), ' opacity=".5"');
  const post = bar([SUN[0], OC[1] + 10], [SUN[0] + .6, 204], 5);
  g += F(C.kraft, wash(new Pth(), post.q, .4)) + P('f', S(new Pth(), post.edges[0]) + S(new Pth(), post.edges[1]));
  g += I(2.6, new Pth().M(1110, 212).W(1121, 205, .4).W(1144, 205, .3).W(1155, 212, .4)) + I(2.6, S(new Pth(), [[1118, 205.5], [1147, 205]]));
  // arms from a collar on the post out to the hoop
  const h1 = orb(.3), h2 = orb(2.1), cl = orb(Math.acos(OE));
  g += I(2.3, S(new Pth(), [[SUN[0] - 2, 166], [h1[0] + 1, h1[1] + 1]]) + S(new Pth(), [[SUN[0] + 2, 172], [h2[0], h2[1] + 1]]));
  g += F(C.ink, blob(new Pth(), SUN[0] + .2, 169, 4.4, 5.4, { n: 6 }));
  g += F(C.gold, blob(new Pth(), SUN[0], SUN[1], 13.4, 13.4, { n: 7, j: .02 })) + F(C.paper, blob(new Pth(), SUN[0] - 4, SUN[1] - 5, 5, 3.6, { n: 6, tilt: -30 }), ' opacity=".35"') + I(2.7, ringStroke(new Pth(), SUN[0], SUN[1], 13.4, 13.4, { n: 7, j: .02 }));
  g += I(2.8, crOpen(new Pth(), arc(-.04, Math.PI + .04, 10))) + F(C.ink, blob(new Pth(), cl[0], cl[1], 3.6, 3.2, { n: 5 }));
  // the planet, on its own clock: one orbit every 8 s, Kepler's equation sampled every 1/40 of the period
  const E0 = 2.25, M0 = E0 - OE * Math.sin(E0), p0 = orb(E0), N = 40, kf = [];
  for (let i = 0; i <= N; i++) { const q = orb(kepler(M0 + 2 * Math.PI * i / N, OE)); kf.push(`${R(100 * i / N)}%{transform:translate(${R(q[0] - p0[0])}px,${R(q[1] - p0[1])}px)}`); }
  css += `.pl{animation:pl 8s linear infinite}@keyframes pl{${kf.join('')}}`;
  g += `<g class="pl">${F(C.clay, blob(new Pth(), p0[0], p0[1], 6.6, 6.6, { n: 6, j: .03 }))}${I(2.3, ringStroke(new Pth(), p0[0], p0[1], 6.6, 6.6, { n: 6, j: .03 }))}</g>`;
  add(g);
}

// ================= H-R board =================
const hx = T => 1335 + (4.602 - Math.log10(T)) / 1.204 * 193, hy = l => 168 - (l + 4) * 12.4, SUNPT = [hx(5772), hy(0)];
{
  let g = '';
  for (const x of [1322, 1541]) { const b = bar([x, 188], [x + J(1), 213], 9); g += F(C.kraft, wash(new Pth(), b.q, .6)) + P('f', S(new Pth(), b.edges[0]) + S(new Pth(), b.edges[1])); }
  const HB = [[1297, 27], [1566, 25], [1568, 187], [1296, 189]];
  const w = [[1299.5, 29.5], [1430, 28.5], [1563, 27.5], [1565.5, 100], [1566, 181], [1560, 185]];
  for (let x = 1510; x >= 1340; x -= 56) w.push([x, 186.5 + J(1.3)]); w.push([1298.5, 186.5], [1298.5, 100]);
  g += F(C.slate, wash(new Pth(), w, .9));
  g += F(C.paper, wash(new Pth(), [[1306, 32], [1400, 31], [1412, 38], [1310, 40]], .6), ' opacity=".14"');
  // chalk axes, ticks; the temperature strip under the axis: hot blue-white at the left, cool red at the right
  const ch = new Pth(); S(ch, [[1319, 38], [1320.5, 175.5]]); S(ch, [[1318, 175], [1553, 174]]);
  for (const y of [57, 82, 107, 132, 157]) ch.M(1315, y + J(.6)).W(1320.5, y + J(.6), .3);
  for (const x of [1355, 1403, 1451, 1499, 1547]) ch.M(x + J(.6), 174.5).W(x + J(.6), 179, .3);
  g += `<path fill="none" stroke="${C.paper}" stroke-width="2.2" stroke-linecap="round" opacity=".9" d="${ch}"/>`;
  const dab = (x, c) => `<path fill="none" stroke="${c}" stroke-width="4.4" stroke-linecap="round" d="${new Pth().M(x - 13, 182.2 + J(.4)).W(x + 13, 182 + J(.4), .3)}"/>`;
  g += dab(1352, C.sky) + dab(1397, C.paper) + dab(1442, C.gold) + dab(1487, C.orange) + dab(1530, C.red);
  // the stars: [T, log L, radius, colour]
  const st = [[30000, 4.7, 6.2, C.sky], [20000, 3.5, 5.5, C.sky], [12500, 2.3, 4.9, '#E4ECEF'], [4400, -.8, 3.9, C.orange], [3800, -1.35, 3.6, C.clay], [3000, -2.5, 3.2, C.red], [2600, -3.25, 3, C.red],
    [5000, 1.75, 6, C.gold], [4500, 2.15, 6.6, C.orange], [3950, 2.75, 7.2, C.clay], [3500, 5, 8.2, C.red], [12000, 5.05, 7, C.sky], [25000, -1.5, 3, C.paper], [16000, -2.05, 2.9, C.paper], [10500, -2.7, 2.8, '#E4ECEF']];
  const by = new Map(); for (const [T, l, r, c] of st) { if (!by.has(c)) by.set(c, new Pth()); blob(by.get(c), hx(T) + J(.8), hy(l) + J(.8), r, r, { n: 6, j: .05 }); }
  for (const [c, p] of by) g += F(c, p);
  g += I(2.8, sides(new Pth(), HB));
  add(g);
}

// ================= moving things =================
// --- the tube (turns about the yoke)
{
  let g = '';
  const q = (a, b, c, d) => [tp(a, c), tp(b, c), tp(b, d), tp(a, d)];
  g += F(C.slate, wash(new Pth(), q(-72, -28, -18.5, -13), .4)) + I(2, sides(new Pth(), q(-72, -28, -18.5, -13), .4) + new Pth().M(...tp(-62, -13)).W(...tp(-62, -9), .2).M(...tp(-38, -13)).W(...tp(-38, -9), .2));
  g += F(C.key, wash(new Pth(), [tp(-96, -8.2), tp(-20, -8.6), tp(60, -8.2), tp(61, 8.4), tp(-20, 8.8), tp(-96, 8.4)], .6));
  g += F(C.key, wash(new Pth(), q(-119, -97, -10.6, 10.6), .5));
  g += F(C.paper, wash(new Pth(), [tp(-90, -6.5), tp(40, -6.5), tp(44, -3.4), tp(-92, -3.2)], .5), ' opacity=".3"');
  g += F(C.sky, wash(new Pth(), q(62, 82, -4.8, 4.8), .4));
  g += F(C.ink, wash(new Pth(), q(82, 90.5, -3.5, 3.5), .3));
  // ink: tube edges (two strokes each), shield, lens, rear cell, focuser, knob
  const ed = new Pth();
  S(ed, [tp(-98, -9), tp(62, -9)]); S(ed, [tp(-98, 9), tp(62, 9)]); S(ed, [tp(62, -9.6), tp(62.4, 9.6)]);
  sides(ed, q(-120, -98, -11, 11), .4);
  S(ed, [tp(62, -5), tp(82.5, -5)]); S(ed, [tp(62, 5), tp(82.5, 5)]); S(ed, [tp(82, -5.4), tp(82, 5.4)]);
  g += I(2.8, ed);
  const lens = tp(-120.5, 0);
  g += F(C.sky, blob(new Pth(), lens[0], lens[1], 3.4, 10.6, { n: 6, j: .02, tilt: TA })) + I(2.2, ringStroke(new Pth(), lens[0], lens[1], 3.4, 10.6, { n: 6, j: .02, tilt: TA }));
  const kn = tp(70, 8.5); g += F(C.ink, blob(new Pth(), kn[0], kn[1], 3.3, 3.3, { n: 5 }));
  g += P('t', new Pth().M(...tp(20, 2)).W(...tp(16, 7), .2).M(...tp(28, 2)).W(...tp(24, 7), .2).M(...tp(36, 2)).W(...tp(32, 7), .2).M(...tp(44, 2)).W(...tp(40, 7), .2));
  const bolt = F(C.ink, blob(new Pth(), TP[0], TP[1] + 2, 3, 3, { n: 5 }));
  css += `.tube{transform-origin:${TP[0]}px ${TP[1]}px;animation:tube ${CY}s infinite}@keyframes tube{0%,4%{transform:rotate(0deg);animation-timing-function:cubic-bezier(.4,0,.3,1)}8%,13.5%{transform:rotate(-5deg)}15%{transform:rotate(-5.8deg);animation-timing-function:cubic-bezier(.3,0,.2,1)}21%{transform:rotate(.7deg)}23.5%,100%{transform:rotate(0deg)}}`;
  add(`<g class="tube">${g}</g>${bolt}`);
}
const tubeAt = (u, v, deg) => rot(tp(u, v), TP, deg);
// --- the sight line from the target star to the objective
{
  const a = [414, 60.2], b = tp(-123, 0);
  css += `.sight{animation:sight ${CY}s infinite}@keyframes sight{0%,4%{opacity:1}5%,22.5%{opacity:0}24%,100%{opacity:1}}`;
  add(`<path class="sight" fill="none" stroke="${C.gold}" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 8" d="${new Pth().M(...a).W(...b, .3)}"/>`);
}
// --- beam, straight-through spot, rays, spectrum, lines
const Ept = tp(90.5, 0), slope = Math.tan(TA * RAD), phi = nm => Math.asin(nm * 8e-4) - TA * RAD;     // 800 lines per mm, first order
const XL = 997, bandY = (nm, x) => G[1] - (XL - G[0]) * Math.tan(phi(nm)) + (x - XL) * -.159;
{
  const spot = [1005, G[1] + (1005 - G[0]) * slope];
  css += `.beam{stroke-dasharray:1;animation:beam ${CY}s infinite}@keyframes beam{0%,4.5%{stroke-dashoffset:0;opacity:1}6.4%{stroke-dashoffset:1;opacity:1}6.5%,23.4%{stroke-dashoffset:1;opacity:0}23.5%{stroke-dashoffset:1;opacity:1;animation-timing-function:cubic-bezier(.3,0,.5,1)}30%,100%{stroke-dashoffset:0;opacity:1}}`;
  css += `.spot{transform-origin:${R(spot[0])}px ${R(spot[1])}px;animation:spot ${CY}s infinite}@keyframes spot{0%,6%{transform:scale(1)}6.6%,29.4%{transform:scale(0)}31%{transform:scale(1.45)}33.5%,100%{transform:scale(1)}}`;
  add(`<path class="beam" pathLength="1" fill="none" stroke="${C.gold}" stroke-width="4.2" stroke-linecap="round" d="${new Pth().M(...Ept).W(G[0], G[1], .25).W(spot[0], spot[1], .25)}"/><g class="spot">${F(C.gold, blob(new Pth(), spot[0], spot[1], 5.4, 5, { n: 6 }))}</g>`);
  const bands = [[390, 440, C.violet], [440, 490, C.blue], [490, 560, C.sageD], [560, 590, C.gold], [590, 630, C.orange], [630, 700, C.red]];
  let rays = '', spec = '';
  for (const [a, b, c] of bands) {
    const m = (a + b) / 2;
    rays += `<path class="ray" pathLength="1" fill="none" stroke="${c}" stroke-width="2.7" stroke-linecap="round" d="${new Pth().M(806.5, G[1] - .8 + J(.3)).W(XL, bandY(m, XL), .2)}"/>`;
    spec += F(c, wash(new Pth(), [[XL + J(.6), bandY(a, XL) + .4], [1027 + J(.8), bandY(a, 1027) + .4], [1027 + J(.8), bandY(b, 1027) - .4], [XL + J(.6), bandY(b, XL) - .4]], .25));
  }
  css += `.ray{stroke-dasharray:1;animation:ray ${CY}s infinite}@keyframes ray{0%,3.4%{stroke-dashoffset:0;opacity:1}4.6%{stroke-dashoffset:1;opacity:1}4.7%,41.5%{stroke-dashoffset:1;opacity:0}41.6%{stroke-dashoffset:1;opacity:1;animation-timing-function:cubic-bezier(.3,0,.5,1)}47.5%,100%{stroke-dashoffset:0;opacity:1}}`;
  css += `.spec{transform-origin:${XL}px 70px;animation:spec ${CY}s infinite}@keyframes spec{0%,3.6%{transform:scale(1,1)}5%,45.5%{transform:scale(0,1);animation-timing-function:cubic-bezier(.3,0,.3,1)}51.5%,100%{transform:scale(1,1)}}`;
  css += `.lines{transform-origin:${XL}px 70px;animation:lines ${CY}s infinite}@keyframes lines{0%,3.6%{transform:scale(1,1)}4.6%,52%{transform:scale(0,1);animation-timing-function:cubic-bezier(.3,0,.3,1)}56.5%,100%{transform:scale(1,1)}}`;
  // Sun-like star: Ca H 396.8, G band 430.8, H-beta 486.1, Mg b 517.5, Na D 589.3, H-alpha 656.3
  let ln = '';
  for (const [nm, w] of [[396.8, 2.6], [430.8, 1.9], [486.1, 2.1], [517.5, 1.8], [589.3, 2.5], [656.3, 2.1]]) ln += `<path class="i" stroke-width="${w}" d="${new Pth().M(XL + .6, bandY(nm, XL) + J(.2)).W(1026.4, bandY(nm, 1026.4) + J(.2), .15)}"/>`;
  add(rays + `<g class="spec">${spec}</g><g class="lines">${ln}</g>`);
}
// --- the grating slide
{
  const sq = [[794.8, 116.5], [805.6, 113.4], [806.4, 140.6], [795.6, 143.6]];
  css += `.slide{animation:slide ${CY}s infinite}@keyframes slide{0%,3%{transform:translate(0px,0px);animation-timing-function:cubic-bezier(.4,0,1,1)}5%{transform:translate(0px,-13px);animation-timing-function:cubic-bezier(0,0,.3,1)}7.5%,33%{transform:translate(0px,-26px)}34.5%{transform:translate(0px,-28px);animation-timing-function:cubic-bezier(.4,0,1,1)}38%{transform:translate(0px,-13px);animation-timing-function:cubic-bezier(0,0,.3,1)}41.5%{transform:translate(0px,1.2px)}43%,100%{transform:translate(0px,0px)}}`;
  add(`<g class="slide">${F(C.sky, wash(new Pth(), sq, .3))}${P('t', new Pth().M(798, 119).W(798.6, 140, .15).M(800.8, 118.2).W(801.4, 139.4, .15).M(803.6, 117.4).W(804.2, 138.6, .15))}${I(2.5, sides(new Pth(), sq, .3))}</g>`);
}
// --- figures
const capAcc = col => (H, dir) => { const top = [], n = 6; for (let i = 0; i <= n; i++) { const a = (-172 + 158 * i / n) * RAD; top.push([H[0] + dir * Math.cos(a) * 11.9, H[1] + Math.sin(a) * 11.9]); } const base = [[H[0] + dir * 8, H[1] - 3.2], [H[0], H[1] - 4.4], [H[0] - dir * 8.5, H[1] - 2.4]]; const brim = new Pth().M(H[0] + dir * 10.5, H[1] - 3).C(H[0] + dir * 14, H[1] - 3.4, H[0] + dir * 17, H[1] - 2.2, H[0] + dir * 19, H[1] - .4); return F(col, crClosed(new Pth(), [...top, ...base])) + I(2, crOpen(new Pth(), [...top]) + crOpen(new Pth(), [top[n], ...base, top[0]])) + I(2.4, brim); };
const scarfAcc = col => (H, dir) => `<path fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" d="${new Pth().M(H[0] - dir * 1.5, H[1] + 14.4).C(H[0] - dir * 6, H[1] + 15.5, H[0] - dir * 9.5, H[1] + 19, H[0] - dir * 11.5, H[1] + 24.5).M(H[0] - dir * 1.5, H[1] + 14.6).C(H[0] - dir * 6.5, H[1] + 14, H[0] - dir * 11, H[1] + 15, H[0] - dir * 14.5, H[1] + 18.5)}"/>` + F(col, blob(new Pth(), H[0] - dir * .6, H[1] + 14.4, 4, 3.4, { n: 6 }));
const tailAcc = (H, dir) => I(2.3, new Pth().M(H[0] - dir * 8.6, H[1] - 6.8).C(H[0] - dir * 14, H[1] - 5.4, H[0] - dir * 16.5, H[1] + .6, H[0] - dir * 15.5, H[1] + 8.4).M(H[0] - dir * 9.6, H[1] - 4.2).C(H[0] - dir * 13, H[1] - 2.4, H[0] - dir * 13.6, H[1] + 2, H[0] - dir * 12.6, H[1] + 6));
{
  // F1: both hands on the tube; they follow it as it turns
  const A = d => tubeAt(31, -1, d), B = d => tubeAt(83, 4.6, d), ease = 'cubic-bezier(.4,0,.3,1)';
  const poses = f => [{ at: '0%,4%', T: f(0), tf: ease }, { at: '8%,13.5%', T: f(-5) }, { at: '15%', T: f(-5.8), tf: 'cubic-bezier(.3,0,.2,1)' }, { at: '21%', T: f(.7) }, { at: '23.5%,100%', T: f(0) }];
  const f1 = figure({ X: 672, dir: -1, lean: 10, ank: [-10, 5], acc: capAcc(C.clay), arms: [{ id: 'a1', T: A(0), elbow: 'down', poses: poses(A) }, { id: 'b1', T: B(0), elbow: 'down', poses: poses(B) }] });
  // F2: one hand on the edge of the slide, which she lifts out and lowers in
  const Hs = dy => [795.2, 131 + dy];
  const f2 = figure({ X: 770, dir: 1, lean: 4, ank: [-6, 1], acc: scarfAcc(C.key), arms: [{ T: [764, 150], elbow: 'down' }, { id: 'a2', T: Hs(0), elbow: 'down', poses: [{ at: '0%,3%', T: Hs(0), tf: 'cubic-bezier(.4,0,1,1)' }, { at: '5%', T: Hs(-13), tf: 'cubic-bezier(0,0,.3,1)' }, { at: '7.5%,33%', T: Hs(-26) }, { at: '34.5%', T: Hs(-28), tf: 'cubic-bezier(.4,0,1,1)' }, { at: '38%', T: Hs(-13), tf: 'cubic-bezier(0,0,.3,1)' }, { at: '41.5%', T: Hs(1.2) }, { at: '43%,100%', T: Hs(0) }] }] });
  // F3: chalk on the plotted star; she rubs it out, lowers her arm, and later plots it again
  const hand = [SUNPT[0] - 9.5, SUNPT[1] + 3.5], hang = [1446, 151], e = 'cubic-bezier(.3,0,.2,1)';
  const chalk = (H, E) => { const L = Math.hypot(H[0] - E[0], H[1] - E[1]), u = [(H[0] - E[0]) / L, (H[1] - E[1]) / L]; return `<path fill="none" stroke="${C.paper}" stroke-width="2.6" stroke-linecap="round" d="${new Pth().M(H[0] + u[0] * .6, H[1] + u[1] * .6).L(H[0] + u[0] * 4.6, H[1] + u[1] * 4.6)}"/>`; };
  const clip = (H) => F(C.manila, wash(new Pth(), [[H[0] - 3.2, H[1] - 6], [H[0] + 5.4, H[1] - 4.6], [H[0] + 3.6, H[1] + 7.4], [H[0] - 5, H[1] + 6]], .2)) + I(2, sides(new Pth(), [[H[0] - 3.2, H[1] - 6], [H[0] + 5.4, H[1] - 4.6], [H[0] + 3.6, H[1] + 7.4], [H[0] - 5, H[1] + 6]], .2));
  const f3 = figure({ X: 1438, dir: 1, lean: 5, ank: [-7, 2], acc: tailAcc, arms: [{ T: [1432, 146], elbow: 'down', held: clip }, { id: 'a3', T: hand, elbow: 'down', held: chalk, poses: [{ at: '0%,3%', T: hand }, { at: '4.2%', T: [hand[0] - 3.5, hand[1] + 4] }, { at: '5.4%', T: [hand[0] + 1, hand[1] - 2] }, { at: '6.6%', T: [hand[0] - 3.5, hand[1] + 4] }, { at: '7.8%', T: hand }, { at: '8.6%', T: [hand[0] + 1, hand[1] - 3], tf: e }, { at: '13%,60%', T: hang }, { at: '61.5%', T: [hang[0] - 2.5, hang[1] + 1], tf: e }, { at: '67.5%', T: [hand[0] + 1.5, hand[1] - 2.5] }, { at: '69.5%,100%', T: hand }] }] });
  css += f1.css + f2.css + f3.css;
  // the plotted star: gold, with a chalk ring round it
  css += `.sun{transform-origin:${R(SUNPT[0])}px ${R(SUNPT[1])}px;animation:sun ${CY}s infinite}@keyframes sun{0%,4.2%{transform:scale(1)}7.8%,68.5%{transform:scale(0)}70.5%{transform:scale(1.4)}73%,100%{transform:scale(1)}}`;
  const sun = `<g class="sun"><path fill="none" stroke="${C.paper}" stroke-width="2" stroke-linecap="round" d="${ringStroke(new Pth(), SUNPT[0], SUNPT[1], 10, 10, { n: 7, j: .04 })}"/>${F(C.gold, blob(new Pth(), SUNPT[0], SUNPT[1], 5.6, 5.6, { n: 6 }))}</g>`;
  add(sun + f1.svg + f2.svg + f3.svg);
}

const style = `.i{fill:none;stroke:${C.ink};stroke-linecap:round;stroke-linejoin:round}.f{fill:none;stroke:${C.ink};stroke-opacity:.75;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.t{fill:none;stroke:${C.ink};stroke-opacity:.6;stroke-width:1.6;stroke-linecap:round}.h{fill:${C.paper};stroke:${C.ink};stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}` + css;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 240"><title>Astronomy</title><style>${style}</style>${L.join('')}</svg>`;
fs.writeFileSync(OUT, svg);
console.log('banner', (svg.length / 1024).toFixed(1), 'KiB');
