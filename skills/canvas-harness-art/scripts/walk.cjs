#!/usr/bin/env node
// Keyframes for a walk of the house figure, with the planted foot fixed on the floor.
//   node scripts/walk.cjs --cycle 12 --start 2 --steps 6 [--dir 1] [--step 20] [--pace 0.6] [--name w]
// The figure is the one in templates/banner-rig.svg: thigh 24, shin 18, drawn standing with the hip 39.3 above the
// ankle, knee 7.3 forward (thigh 17.7 deg forward of straight down, shin bent 41.7 deg back relative to the thigh).
// Structure it expects (each group rotates about its joint, the body group carries everything):
//   <g class="w-body"> <g class="w-legA"><path thigh/><g class="w-shinA"><path shin/><path foot/></g></g>
//                      <g class="w-legB">...</g>  torso, head, arms ... </g>
// Give .w-legA/.w-legB transform-origin at the hip and .w-shinA/.w-shinB at the knee, as drawn.
// Output: CSS to paste into <style>. The figure stands (rest pose) before --start and after the walk; it does not
// come back, so pair it with a story in which it stays there, or walk it back with a second call and --dir -1
// only if it is drawn facing that way (never mirror a figure).
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] || process.argv[i + 1] : d; };
const C = arg('cycle', 12), T0 = arg('start', 2), STEPS = arg('steps', 6), DIR = arg('dir', 1), STEP = arg('step', 20), PACE = arg('pace', 0.6), NAME = String(arg('name', 'w'));
const TH = 24, SH = 18, H = 39.3, deg = r => r * 180 / Math.PI, r1 = v => Math.round(v * 10) / 10, REST = ik(0, H);
function ik(ax, ay) {                     // ankle relative to the hip (y down); the knee bends forward
  const d = Math.min(Math.hypot(ax, ay), TH + SH - .01), a = Math.acos((TH * TH + d * d - SH * SH) / (2 * TH * d));
  const th = Math.atan2(ax, ay) + a, kx = TH * Math.sin(th), ky = TH * Math.cos(th), sh = Math.atan2(ax - kx, ay - ky);
  return { thigh: deg(th), knee: deg(sh - th) };
}
// one step = 4 poses (contact, down, passing, up). phase 0..1 over two steps: planted for the first half, swinging for the second
function leg(p) {
  const bob = [0, 1, 0, -1][Math.round(p * 8) % 4];
  let ax, lift = 0;
  if (p < .5) ax = STEP / 2 - STEP * (p / .5); else { const q = (p - .5) / .5; ax = -STEP / 2 + STEP * q; lift = 7 * Math.sin(Math.PI * q); }
  const k = ik(ax, H + bob - lift); return { thigh: k.thigh - REST.thigh, knee: k.knee - REST.knee, bob };
}
const dur = STEPS * PACE, pct = t => r1(100 * t / C), rot = v => `transform:rotate(${r1(-DIR * v)}deg)`;
if (T0 + dur + 0.3 > C) { console.error('The walk does not fit in the cycle. Shorten it or lengthen the cycle.'); process.exit(1); }
const poses = STEPS * 4, K = { tA: [], sA: [], tB: [], sB: [], body: [] };
const stand = { tA: 0, sA: 0, tB: 0, sB: 0 };
const push = (k, t, v) => K[k].push(`${pct(t)}%{${v}}`);
for (const k of ['tA', 'sA', 'tB', 'sB']) push(k, 0, rot(0)), push(k, T0 - .15, rot(0));
push('body', 0, 'transform:translate(0px,0px)'); push('body', T0, 'transform:translate(0px,0px);animation-timing-function:linear');
for (let i = 0; i <= poses; i++) {
  const t = T0 + dur * i / poses, p = (i / 8) % 1, a = leg(p), b = leg((p + .5) % 1);
  push('tA', t, rot(a.thigh)); push('sA', t, rot(a.knee)); push('tB', t, rot(b.thigh)); push('sB', t, rot(b.knee));
  push('body', t, `transform:translate(${r1(DIR * STEP * STEPS * i / poses)}px,${a.bob}px);animation-timing-function:linear`);
}
for (const k of ['tA', 'sA', 'tB', 'sB']) push(k, T0 + dur + .2, rot(0));
const END = `transform:translate(${DIR * STEP * STEPS}px,0px)`;
push('body', T0 + dur + .2, END); push('body', C - .01, END + ';animation-timing-function:steps(1)');
for (const k of ['tA', 'sA', 'tB', 'sB']) push(k, C, rot(0)); push('body', C, 'transform:translate(0px,0px)');
const out = [
  `/* walk: ${STEPS} steps of ${STEP} units, ${dur}s, starting at ${T0}s of a ${C}s cycle. The figure jumps back unseen at the cycle's end: hide that moment (off-stage, behind something) or end the cycle there. */`,
  `.${NAME}-body{animation:${NAME}body ${C}s infinite}.${NAME}-legA{animation:${NAME}tA ${C}s linear infinite}.${NAME}-shinA{animation:${NAME}sA ${C}s linear infinite}.${NAME}-legB{animation:${NAME}tB ${C}s linear infinite}.${NAME}-shinB{animation:${NAME}sB ${C}s linear infinite}`,
  `@keyframes ${NAME}body{${K.body.join('')}}`, `@keyframes ${NAME}tA{${K.tA.join('')}}`, `@keyframes ${NAME}sA{${K.sA.join('')}}`, `@keyframes ${NAME}tB{${K.tB.join('')}}`, `@keyframes ${NAME}sB{${K.sB.join('')}}`,
];
console.log(out.join('\n'));
