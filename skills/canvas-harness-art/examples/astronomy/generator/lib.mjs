// Small drawing helpers for hand-made SVG paths (wobble, pen lifts, blobs, the house figure).
export const RAD = Math.PI / 180;
let seed = 20261009;
export const reseed = s => { seed = s; };
export const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
export const J = a => (rnd() * 2 - 1) * a;
export const R = v => { const r = Math.round(v * 10) / 10; return Object.is(r, -0) ? 0 : r; };
const s1 = v => String(R(v)).replace(/^(-?)0\./, '$1.');
export const fmt = arr => arr.map(s1).reduce((a, s, i) => a + (i && s[0] !== '-' ? ' ' : '') + s, '');
export const lerp = (a, b, t) => a + (b - a) * t;
export const rot = (p, c, deg) => { const a = deg * RAD, dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)]; };

export class Pth {
  constructor() { this.d = ''; this.x = 0; this.y = 0; }
  M(x, y) { x = R(x); y = R(y); this.d += 'M' + fmt([x, y]); this.x = x; this.y = y; return this; }
  C(a, b, c, d, e, f) { const v = [a - this.x, b - this.y, c - this.x, d - this.y, e - this.x, f - this.y].map(R); this.d += 'c' + fmt(v); this.x = R(this.x + v[4]); this.y = R(this.y + v[5]); return this; }
  L(x, y) { const v = [R(x - this.x), R(y - this.y)]; this.d += 'l' + fmt(v); this.x = R(this.x + v[0]); this.y = R(this.y + v[1]); return this; }
  Z() { this.d += 'z'; return this; }
  // a hand-drawn "straight" stroke to (bx,by): drifts a unit or two
  W(bx, by, k = 1) {
    const ax = this.x, ay = this.y, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const amp = Math.min(2.2, .3 + L * .016) * k, w1 = J(amp), w2 = J(amp);
    return this.C(ax + dx / 3 + nx * w1, ay + dy / 3 + ny * w1, ax + dx * 2 / 3 + nx * w2, ay + dy * 2 / 3 + ny * w2, bx, by);
  }
  // a bowed stroke (limbs)
  B(bx, by, bow = .7) {
    const ax = this.x, ay = this.y, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L * bow, ny = dx / L * bow;
    return this.C(ax + dx / 3 + nx, ay + dy / 3 + ny, ax + dx * 2 / 3 + nx, ay + dy * 2 / 3 + ny, bx, by);
  }
  toString() { return this.d; }
}
// open polyline, hand-wobbled; a segment longer than ~115 is drawn in two or three strokes that overlap
export function S(p, pts, k = 1, lift = true) {
  p.M(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [bx, by] = pts[i], ax = p.x, ay = p.y, L = Math.hypot(bx - ax, by - ay);
    if (lift && L > 115) {
      const n = Math.ceil(L / 100), ux = (bx - ax) / L, uy = (by - ay) / L;
      for (let j = 1; j <= n; j++) {
        const last = j === n; p.W(ax + (bx - ax) * j / n + (last ? 0 : J(.7)), ay + (by - ay) * j / n + (last ? 0 : J(.7)), k);
        if (!last) p.M(p.x - ux * 3 + J(.4), p.y - uy * 3 + J(.6));
      }
    } else p.W(bx, by, k);
  }
  return p;
}
// closed outline drawn side by side, each side its own stroke, corners slightly crossed or short
export function sides(p, pts, k = 1) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, o1 = J(1.2), o2 = rnd() * 2.2 - .6;
    S(p, [[a[0] - ux * o1 + J(.5), a[1] - uy * o1 + J(.5)], [b[0] + ux * o2 + J(.5), b[1] + uy * o2 + J(.5)]], k);
  }
  return p;
}
// loose flat wash: closed, wobbly, never exactly on its outline
export function wash(p, pts, k = 1.2) {
  p.M(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.W(pts[i][0], pts[i][1], k);
  p.W(pts[0][0], pts[0][1], k); return p.Z();
}
const seg = (p, p0, p1, p2, p3) => p.C(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
export function crClosed(p, pts) { const n = pts.length; p.M(pts[0][0], pts[0][1]); for (let i = 0; i < n; i++) seg(p, pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]); return p.Z(); }
export function crOpen(p, pts) { const n = pts.length; p.M(pts[0][0], pts[0][1]); for (let i = 0; i < n - 1; i++) seg(p, pts[Math.max(i - 1, 0)], pts[i], pts[i + 1], pts[Math.min(i + 2, n - 1)]); return p; }
export function ringPts(cx, cy, rx, ry = rx, { n = 7, j = .045, tilt = 0, a0 = rnd() * 6.283 } = {}) {
  const o = []; for (let i = 0; i < n; i++) { const a = a0 + i * 6.2832 / n, k = 1 + J(j), x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k, t = tilt * RAD; o.push([cx + x * Math.cos(t) - y * Math.sin(t), cy + x * Math.sin(t) + y * Math.cos(t)]); } return o;
}
// filled round blob
export const blob = (p, cx, cy, rx, ry = rx, o = {}) => crClosed(p, ringPts(cx, cy, rx, ry, o));
// pen outline of a round thing: comes round and overshoots its start
export function ringStroke(p, cx, cy, rx, ry = rx, o = {}) {
  const r = ringPts(cx, cy, rx, ry, o), n = r.length, inw = (q, f) => [lerp(q[0], cx, f), lerp(q[1], cy, f)];
  const e = [r[n - 1], ...r, inw(r[0], .07), inw([lerp(r[0][0], r[1][0], .5), lerp(r[0][1], r[1][1], .5)], .06)];
  p.M(e[1][0], e[1][1]); for (let i = 1; i < e.length - 1; i++) seg(p, e[i - 1], e[i], e[i + 1], e[Math.min(i + 2, e.length - 1)]); return p;
}
// half-ellipse lune between two terminators (k = -1 left limb ... 1 right limb), for Moon phases
export function lune(p, cx, cy, r, k1, k2) {
  const K = .5523, arc = (k, down) => { const X = k * r, s = down ? 1 : -1; p.C(cx + K * X, cy - s * r, cx + X, cy - s * K * r, cx + X, cy); p.C(cx + X, cy + s * K * r, cx + K * X, cy + s * r, cx, cy + s * r); };
  p.M(cx, cy - r); arc(k2, true); arc(k1, false); return p.Z();
}
export function star4(p, cx, cy, r, turn = 0) {
  const tips = [0, 1, 2, 3].map(i => { const a = turn * RAD + i * Math.PI / 2 - Math.PI / 2, rr = r * (i % 2 ? .82 : 1) * (1 + J(.07)); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
  p.M(tips[0][0], tips[0][1]);
  for (let i = 0; i < 4; i++) { const a = turn * RAD + i * Math.PI / 2 - Math.PI / 4, q = r * .27 * (1 + J(.15)), m = [cx + Math.cos(a) * q, cy + Math.sin(a) * q], t = tips[(i + 1) % 4]; p.C(m[0], m[1], m[0], m[1], t[0], t[1]); }
  return p.Z();
}
// a straight bar (leg, post): returns its wash quad and two inked edges
export function bar(a, b, w) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L * w / 2, ny = (b[0] - a[0]) / L * w / 2;
  const q = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
  return { q, edges: [[q[0], q[1]], [q[3], q[2]]] };
}
// ---------- two-bone IK (y down) ----------
export function ik(Sh, T, a, b, pick) {
  const dx = T[0] - Sh[0], dy = T[1] - Sh[1], d = Math.hypot(dx, dy) || .001, dd = Math.min(Math.max(d, Math.abs(a - b) + .3), a + b - .12);
  const base = Math.atan2(dy, dx), A = Math.acos((a * a + dd * dd - b * b) / (2 * a * dd));
  const c = [1, -1].map(s => [Sh[0] + a * Math.cos(base + s * A), Sh[1] + a * Math.sin(base + s * A)]);
  const E = pick(c[0], c[1]) ? c[0] : c[1];
  return { E, H: [Sh[0] + dx / d * dd, Sh[1] + dy / d * dd] };
}
const norm = a => { while (a > 180) a -= 360; while (a <= -180) a += 360; return a; };
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
// The house figure. Drawn in its own units round its ground point; x is flipped by `dir` in the numbers (never by a transform).
// arms: [{T:[banner x,y], elbow:'down'|'up', id, poses:[{at:'0%,4%', T:[x,y]|null, tf:'...'}], held:(H,E)=>svg}]
export function figure({ X, Y = 214, sc = 1.3, dir = 1, lean = 4, ank = [-6, 0], arms = [], acc, cycle = 16 }) {
  const fx = v => v * dir, o = pt => [fx(pt[0]), pt[1]], loc = b => [(b[0] - X) / sc * dir, (b[1] - Y) / sc];
  const sl = Math.sin(lean * RAD), cl = Math.cos(lean * RAD), hip = [0, -46], top = [37 * sl, -46 - 37 * cl], sh = [33 * sl, -46 - 33 * cl], hc = [53.8 * sl, -46 - 53.8 * cl];
  let out = '', css = '';
  const I = (w, d) => `<path class="i" stroke-width="${w}" d="${d}"/>`;
  for (const ax of ank) {
    const A = [ax, -6.7], k = ik(hip, A, 24, 18, (a, b) => a[0] > b[0]).E, toe = [ax + 9.2, -1];
    out += I(3, new Pth().M(...o(hip)).B(...o(k), .5 * dir)) + I(2.6, new Pth().M(...o(k)).B(...o(A), -.5 * dir)) + I(2.2, new Pth().M(...o(A)).B(...o(toe), .9 * dir));
  }
  out += I(3.2, new Pth().M(...o(hip)).B(...o(top), .9 * dir));
  const H = o(hc);
  out += `<path class="h" d="${ringStroke(new Pth(), H[0], H[1], 11.2, 11.2, { n: 7, j: .03, a0: -1.9 })}"/>`;
  if (acc) out += acc(H, dir);
  for (const arm of arms) {
    const pick = arm.elbow === 'up' ? (a, b) => a[1] < b[1] : (a, b) => a[1] > b[1];
    const solve = T => { const r = ik(sh, loc(T), 16, 15, pick); return { E: o(r.E), H: o(r.H) }; };
    const Sh = o(sh), rest = solve(arm.T), u0 = ang(Sh, rest.E), f0 = ang(rest.E, rest.H);
    const upper = new Pth().M(...Sh).B(...rest.E, .5), fore = new Pth().M(...rest.E).B(...rest.H, -.4);
    const held = arm.held ? arm.held(rest.H, rest.E) : '';
    if (arm.poses) {
      const ku = [], kf = [];
      for (const ps of arm.poses) {
        const s = ps.T ? solve(ps.T) : rest, du = norm(ang(Sh, s.E) - u0), df = norm((ang(s.E, s.H) - ang(Sh, s.E)) - (f0 - u0)), tf = ps.tf ? `;animation-timing-function:${ps.tf}` : '';
        ku.push(`${ps.at}{transform:rotate(${R(du)}deg)${tf}}`); kf.push(`${ps.at}{transform:rotate(${R(df)}deg)${tf}}`);
      }
      css += `.${arm.id}u{transform-origin:${R(Sh[0])}px ${R(Sh[1])}px;animation:${arm.id}u ${cycle}s infinite}.${arm.id}f{transform-origin:${R(rest.E[0])}px ${R(rest.E[1])}px;animation:${arm.id}f ${cycle}s infinite}@keyframes ${arm.id}u{${ku.join('')}}@keyframes ${arm.id}f{${kf.join('')}}`;
      out += `<g class="${arm.id}u">${I(3, upper)}<g class="${arm.id}f">${I(2.6, fore)}${held}</g></g>`;
    } else out += I(3, upper) + I(2.6, fore) + held;
  }
  return { svg: `<g transform="translate(${X} ${Y}) scale(${sc})">${out}</g>`, css };
}
// Kepler: eccentric anomaly from mean anomaly
export function kepler(M, e) { let E = M; for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
