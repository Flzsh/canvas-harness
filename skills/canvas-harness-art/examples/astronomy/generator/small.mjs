import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { RAD, reseed, rnd, J, R, lerp, Pth, S, wash, crClosed, crOpen, ringPts, blob, ringStroke, lune, star4, kepler } from './lib.mjs';
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = { ink: '#141413', shadow: '#CFC2AC', gold: '#E2B865', key: '#76819E', kraft: '#D4A27F', paper: '#FAF9F5', indigo: '#2F4A8C' };

// ======================= ICON: a small refractor on its tripod; it dips to the horizon and comes back up to its target =======================
{
  reseed(311);
  const M = [53, 55], EL = 60 * RAD, u = [-Math.cos(EL), -Math.sin(EL)], v = [-u[1], u[0]], tp = (s, w) => [M[0] + s * u[0] + w * v[0], M[1] + s * u[1] + w * v[1]];
  const q = (a, b, w) => [tp(a, -w), tp(b, -w), tp(b, w), tp(a, w)], CY = 5;
  const css = `.i{fill:none;stroke:${C.ink};stroke-width:6.2;stroke-linecap:round;stroke-linejoin:round}.t{fill:none;stroke:${C.ink};stroke-width:4.6;stroke-linecap:round;stroke-linejoin:round}` +
    `.tube{transform-origin:${M[0]}px ${M[1]}px;animation:aim ${CY}s infinite}@keyframes aim{0%,8%{transform:rotate(0deg)}12%{transform:rotate(3deg);animation-timing-function:cubic-bezier(.3,0,.2,1)}25%,32%{transform:rotate(-25deg)}36%{transform:rotate(-27.5deg);animation-timing-function:cubic-bezier(.3,0,.2,1)}51%{transform:rotate(2.5deg)}57%,100%{transform:rotate(0deg)}}`;
  let s = `<path d="${new Pth().M(20, 95.6).C(36, 97, 70, 97, 88, 95.2)}" fill="none" stroke="${C.shadow}" stroke-width="5" stroke-linecap="round"/>`;
  s += `<path class="i" d="${new Pth().M(M[0] - 1.5, M[1] + 3).B(26.5, 92, .8).M(M[0] + 1.5, M[1] + 3).B(83, 91.4, -.8).M(M[0], M[1] + 6).B(M[0] + 1.6, 93, .5)}"/>`;
  let g = `<path fill="${C.key}" d="${wash(new Pth(), q(-15, 35, 7.2), .25)}"/><path fill="${C.gold}" d="${wash(new Pth(), q(34, 47.5, 9.4), .2)}"/><path fill="${C.gold}" d="${wash(new Pth(), q(-24, -15, 4.4), .2)}"/>`;
  const e1 = new Pth(); S(e1, [tp(-16, -7.6), tp(35, -7.8)], .5); S(e1, [tp(-16, 7.6), tp(35, 7.8)], .5); S(e1, [tp(-16, -7.4), tp(-16.4, 7.4)], .3);
  const sh = q(35, 48, 9.6); S(e1, [sh[0], sh[1]], .3); S(e1, [sh[1], sh[2]], .3); S(e1, [sh[2], sh[3]], .3); S(e1, [sh[3], sh[0]], .3);
  g += `<path class="i" d="${e1}"/>`;
  g += `<path class="t" d="${new Pth().M(...tp(-16, -4.2)).W(...tp(-24.5, -4.2), .2).M(...tp(-16, 4.2)).W(...tp(-24.5, 4.2), .2).M(...tp(-24.5, -5)).W(...tp(-24.5, 5), .2).M(...tp(-25, 0)).W(...tp(-29.5, 0), .2)}"/>`;
  s += `<g class="tube">${g}</g><path fill="${C.ink}" d="${blob(new Pth(), M[0], M[1] + .5, 4.6, 4.6, { n: 6 })}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>Astronomy</title><style>${css}</style>${s}</svg>`;
  fs.writeFileSync(path.join(DIR, 'astronomy-icon.svg'), svg); console.log('icon', (svg.length / 1024).toFixed(1), 'KiB');
}

// ======================= BORDER (layout of slots.md: the icon stands bottom left, text x 72-336) =======================
{
  reseed(977);
  const NS = 'vector-effect:non-scaling-stroke', CY = 12;
  let css = `.p{fill:none;stroke:${C.indigo};stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;${NS}}.q{fill:none;stroke:${C.indigo};stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;${NS}}.d{fill:${C.indigo}}`;
  let s = '';
  // bottom: a long flat orbit to the right of the icon, the Sun at its focus (Kepler's equation, e = 0.6)
  const O = [213, 99.6], a = 131, b = 6.2, e = .6, orb = E => [O[0] - a * Math.cos(E), O[1] + b * Math.sin(E)], sun = [O[0] - a * e, O[1]];
  const arc = (A, B, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const q = orb(lerp(A, B, i / n)); return [q[0], q[1] + J(.25)]; });
  // the pen line: a plain floor under the icon, left side, top (broken by the constellation and a star), right side, back to the orbit
  const pen = new Pth();
  pen.M(82.5, 100.4).C(60, 102.8, 40, 103.2, 21, 102.2).C(12.6, 101.4, 8.4, 96.6, 7.6, 88).C(6.6, 66, 6.8, 44, 8, 22).C(8.8, 13, 12, 8, 20, 6.4).C(44, 5.2, 70, 4.8, 97, 5.4);
  pen.M(212, 5.6).C(228, 5, 244, 5.2, 259, 5.8);
  pen.M(277, 6).C(300, 6.2, 322, 6.6, 341, 7.4).C(349, 8.6, 352.4, 12.4, 353.2, 20).C(354, 42, 353.6, 64, 352.6, 86).C(352, 93.4, 349.6, 97.6, 343.6, 99.4);
  s += `<path class="p" d="${pen}"/>`;
  // top left, above the icon: the corner signature, a crescent Moon and its star
  s += `<path fill="${C.gold}" stroke="${C.indigo}" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke" transform="rotate(-22 27 23)" d="${lune(new Pth(), 27, 23, 11.5, .34, 1)}"/>`;
  const st = (x, y, r, turn) => `<path fill="${C.gold}" stroke="${C.indigo}" stroke-width="1.3" stroke-linejoin="round" vector-effect="non-scaling-stroke" d="${star4(new Pth(), x, y, r, turn)}"/>`;
  s += st(50, 15, 4.6, 10);
  // top: a seven-star constellation on the line, its brightest star gold; one more star; a short hour scale
  const cs = [[99, 5.6], [117, 3.2], [134, 8.6], [152, 4], [170, 8.4], [189, 4.2], [208, 6]];
  const cl = new Pth().M(...cs[0]); for (let i = 1; i < cs.length; i++) cl.W(...cs[i], .25);
  const cd = new Pth(); cs.forEach((q, i) => { if (i !== 3) blob(cd, q[0], q[1], 2.1, 1.9, { n: 5 }); });
  s += `<path class="q" d="${cl}"/><path class="d" d="${cd}"/>` + st(cs[3][0], cs[3][1], 5.4, 8) + st(268, 6, 4.6, -6);
  const hk = new Pth(); [292, 302, 312, 322, 332].forEach((x, i) => hk.M(x + J(.4), 6.6 + i * .1).W(x + J(.4), i % 2 ? 9.4 : 11, .2));
  s += `<path class="q" d="${hk}"/>`;
  // right: absorption lines across the edge, some strong, some faint
  const dash = (cls, ys) => { const p = new Pth(); for (const y of ys) p.M(348 + J(.5), y).W(357.4 + J(.4), y + J(.5), .2); return `<path class="${cls}" d="${p}"/>`; };
  s += dash('p', [38, 54.5, 75]) + dash('q', [34.5, 45, 58, 64, 78.5]);
  // the orbit, the Sun, the planet that travels
  s += `<path class="q" d="${crOpen(new Pth(), arc(Math.PI, 2 * Math.PI))}"/>`;
  const E0 = 2.45, M0 = E0 - e * Math.sin(E0), p0 = orb(E0), N = 48, kf = []; let tPi, t2Pi, prev = E0;
  for (let i = 0; i <= N; i++) { const E = kepler(M0 + 2 * Math.PI * i / N, e), q = orb(E), pct = 100 * i / N; if (prev < Math.PI && E >= Math.PI) tPi = pct; if (prev < 2 * Math.PI && E >= 2 * Math.PI) t2Pi = pct; prev = E; kf.push(`${R(pct)}%{transform:translate(${R(q[0] - p0[0])}px,${R(q[1] - p0[1])}px)}`); }
  css += `.mv{animation:mv ${CY}s linear infinite}@keyframes mv{${kf.join('')}}.pf{animation:pf ${CY}s steps(1) infinite}@keyframes pf{0%{opacity:1}${R(tPi)}%{opacity:0}${R(t2Pi)}%,100%{opacity:1}}.pb{animation:pb ${CY}s steps(1) infinite}@keyframes pb{0%{opacity:0}${R(tPi)}%{opacity:1}${R(t2Pi)}%,100%{opacity:0}}`;
  const planet = `<path fill="${C.key}" stroke="${C.indigo}" stroke-width="1.8" vector-effect="non-scaling-stroke" d="${blob(new Pth(), p0[0], p0[1], 4.6, 4.2, { n: 6, j: .02 })}"/>`;
  s += `<g class="mv"><g class="pb" opacity="0">${planet}</g></g>`;
  s += `<path fill="${C.gold}" stroke="${C.indigo}" stroke-width="1.8" vector-effect="non-scaling-stroke" d="${blob(new Pth(), sun[0], sun[1], 6, 5.2, { n: 6, j: .03 })}"/>`;
  s += `<path class="p" d="${crOpen(new Pth(), arc(0, Math.PI))}"/>`;
  s += `<g class="mv"><g class="pf">${planet}</g></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 110"><title>Astronomy</title><style>${css}</style>${s}</svg>`;
  fs.writeFileSync(path.join(DIR, 'astronomy-border.svg'), svg); console.log('border', (svg.length / 1024).toFixed(1), 'KiB');
}
