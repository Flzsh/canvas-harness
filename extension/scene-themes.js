/*! Canvas Harness — packaged dashboard scenes. Original creator: Flzsh. */
(function(global){
 'use strict';
 const motifs={starry:['moon','star','swirl','cypress','cottage','sunflower'],sea:['turtle','fish','coral','jelly','shell','ray'],stars:['giant','binary','galaxy','redgiant','cluster','nebula'],blueprint:['gear','divider','pendulum','rocket','orbit','bulb']};
 const names=Object.freeze({starry:'Starry Night',sea:'Under the Sea',stars:'Starfield',blueprint:'Blueprint'});
 let active=null;
 // The dashboard draws Starfield directly; its packaged document reuses the same renderer.
 function starSky(cv,doc,win){
const document = doc, W = 1600, H = 440, g = cv.getContext?.('2d'); if (!g) return null;
// Logical coordinates stay at the original banner size; the backing store matches its displayed size.
let scaleX = 1, scaleY = 1, vignette, sceneTime = 0;
function sizeCanvas() { const box = cv.getBoundingClientRect(), dpr = Math.min(2, Math.max(1, win.devicePixelRatio || 1));
  const w = Math.max(1, Math.min(W, Math.round((box.width || win.innerWidth || W) * dpr))), h = Math.max(1, Math.min(H, Math.round((box.height || H) * dpr)));
  cv.width = w; cv.height = h; scaleX = w / W; scaleY = h / H; vignette = null; }
sizeCanvas();
let s = 61803; const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647, gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) * Math.SQRT2; };
const perm = (() => { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } return [...p, ...p]; })();
const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t, gr2 = (h, x, y) => ((h & 1) ? x : -x) + ((h & 2) ? y : -y) * ((h & 4) ? .5 : 1);
// ---------------------------------------------------------------- black-body colour, sprites by temperature
function bbRGB(T) {
  const t = T / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332),
    gg = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755),
    b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = [r, gg, b].map(v => Math.max(0, Math.min(255, v))), m = Math.max(...c); return c.map(v => v / m * 255); }
const BINS = [2600, 3200, 3700, 4200, 4700, 5200, 5800, 6400, 7200, 8500, 10000, 13000, 18000, 26000];
const binOf = T => { let k = 0; while (k < BINS.length - 1 && BINS[k + 1] <= T) k++; return k; };
const mk = (stops) => {
  const k = document.createElement('canvas');
  k.width = k.height = 64;
  const x = k.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return k;
};
const SPR = BINS.map(T => {
  const [r, gg, b] = bbRGB(T).map(v => v | 0);
  return mk([[0, 'rgba(255,255,255,1)'], [.05, `rgba(${(r + 255) >> 1},${(gg + 255) >> 1},${(b + 255) >> 1},.95)`], [.12, `rgba(${r},${gg},${b},.42)`], [.3, `rgba(${r},${gg},${b},.11)`], [.62, `rgba(${r},${gg},${b},.025)`], [1, `rgba(${r},${gg},${b},0)`]]);
});
const SOFT = BINS.map(T => { const [r, gg, b] = bbRGB(T).map(v => v | 0); return mk([[0, `rgba(${r},${gg},${b},1)`], [.4, `rgba(${r},${gg},${b},.35)`], [1, `rgba(${r},${gg},${b},0)`]]); });
const HII = mk([[0, 'rgba(255,190,210,1)'], [.25, 'rgba(255,110,150,.55)'], [1, 'rgba(230,60,110,0)']]);
const PIN = BINS.map(T => `rgb(${bbRGB(T).map(v => (v * .7 + 255 * .3) | 0).join(',')})`);
// ---------------------------------------------------------------- the galaxy, in its own plane (units: kpc)
const RD = 3.2, RMAX = 15, V0 = 1, R0 = 1.4, OMP = .042, BAR = 3.6, PITCH = .23;      // disc scale length, edge, rotation curve, pattern speed, bar half-length, arm pitch
const omega = r => V0 * (1 - Math.exp(-r / R0)) / Math.max(r, .05);
// the arms start at the bar's ends and wind out as logarithmic spirals: phase of the arm through radius r
const armPhase = (r, k) => k * Math.PI + Math.log(Math.max(r, BAR) / BAR) / Math.tan(PITCH);
const expDisc = () => { let r; do { r = -RD * Math.log(rnd() * rnd()); } while (r > RMAX); return r; };     // exponential disc: r e^-r/Rd
const G = [];
for (let i = 0; i < 9000; i++) G.push({ kind: 'old', r: expDisc(), th: rnd() * 6.283, z: gauss() * .25, T: 4200 + rnd() * 2400, L: .25 + Math.pow(rnd(), 3) * 1.6 });
for (let i = 0; i < 3200; i++) {
  const r = Math.abs(gauss()) * .9;
  G.push({ kind: 'bulge', r, th: rnd() * 6.283, z: gauss() * .55 * Math.exp(-r / 2), T: 3900 + rnd() * 1300, L: .3 + Math.pow(rnd(), 3) * 2 });
}
for (let i = 0; i < 2600; i++) G.push({ kind: 'bar', u: gauss() * BAR * .48, v: gauss() * .45, z: gauss() * .25, T: 4000 + rnd() * 1500, L: .3 + Math.pow(rnd(), 3) * 1.6 });
for (let i = 0; i < 9000; i++)
  G.push({ kind: 'young', r: BAR * .9 + Math.pow(rnd(), .8) * (RMAX - BAR), th: rnd() * 6.283, z: gauss() * .08, T: 9000 + Math.pow(rnd(), 2) * 17000, L: .35 + Math.pow(rnd(), 4) * 3.6 });
for (let i = 0; i < 220; i++) G.push({ kind: 'hii', r: BAR + rnd() * (RMAX - BAR - 2), th: rnd() * 6.283, z: 0, T: 0, L: .6 + rnd() * 1.4 });
// ---------------------------------------------------------------- the foreground field (units: pc)
function fieldStar() { const [a, b, al] = rnd() < .62 ? [.08, .5, -1.3] : [.5, 30, -2.3], k = al + 1, M = Math.pow(Math.pow(a, k) + rnd() * (Math.pow(b, k) - Math.pow(a, k)), 1 / k);
  let T = 5772 * Math.pow(M, .54), L = M < .43 ? .23 * Math.pow(M, 2.3) : Math.pow(M, 3.5);
  if (rnd() < .04) { T = 3600 + rnd() * 1400; L = 50 + Math.pow(rnd(), 2) * 750; }
  return { T: Math.min(26000, T), L };
}
const FOC = 900, F = []; for (let i = 0; i < 11000; i++) { const st = fieldStar(), Z = 2 + Math.pow(rnd(), .34) * 600; F.push({ X: (rnd() - .5) * Z * 2.2, Y: (rnd() - .5) * Z * .36, Z, ...st }); }
// ---------------------------------------------------------------- projection: the galaxy's place, size, tilt and turn on the banner
const GX = 1120, GY = 200, PX = 23, INC = 62 * Math.PI / 180, PA = -.32, ci = Math.cos(INC), si = Math.sin(INC), cp = Math.cos(PA), sp = Math.sin(PA);
const projected = new Float64Array(2);
const project = (x, y, z) => { const y2 = y * ci - z * si; projected[0] = GX + (x * cp - y2 * sp) * PX; projected[1] = GY + (x * sp + y2 * cp) * PX; return projected; };
// dust: optical depth at a point of the disc, on the inner (leading) edge of each arm and along the bar's leading sides
// The noise's x coordinate belongs to the star; only its y coordinate changes with the orbit.
function starNoise(p, y) { const Y = Math.floor(y) & 255; y -= Math.floor(y); const v = fade(y), a = p.na + Y, b = p.nb + Y, x = p.nf;
  return lerp(lerp(gr2(perm[a], x, y), gr2(perm[b], x - 1, y), p.nu), lerp(gr2(perm[a + 1], x, y - 1), gr2(perm[b + 1], x - 1, y - 1), p.nu), v); }
function dustTau(p, th, tp) { if (!p.dust) return 0; let tau = 0;
  for (let k = 0; k < 2; k++) { let d = th - tp - p.phases[k] + .2; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; tau += Math.exp(-d * d / (2 * .09 * .09)); }
  return tau * 1.3 * (.6 + .6 * starNoise(p, th * 2.3)) * p.atten; }
// ---------------------------------------------------------------- one frame
const LOGF0 = Math.log10(1 / (600 * 600)), MAG = 2.4;
// ---------------------------------------------------------------- painted once: far galaxies and a companion
// The far galaxies are small tilted smudges, warm (old light, red-shifted); the companion is a dwarf elliptical beside the
// spiral, a soft yellow-white glow with its own faint stars.
const BACK = document.createElement('canvas'), backSeed = s;
function backdrop() {
  const seed = s;
  s = backSeed;
  BACK.width = cv.width;
  BACK.height = cv.height;
  const b = BACK.getContext('2d');
  b.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  b.globalCompositeOperation = 'lighter';
  const blob = (x, y, r, rgb, a) => {
    const gr = b.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    b.fillStyle = gr;
    b.beginPath();
    b.arc(x, y, r, 0, Math.PI * 2);
    b.fill();
  };
  b.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, sz = 3 + Math.pow(rnd(), 2) * 7;
    b.save();
    b.translate(x, y);
    b.rotate(a);
    b.scale(1, .3 + rnd() * .5);
    blob(0, 0, sz, rnd() < .7 ? '255,215,170' : '200,215,255', .45);
    blob(0, 0, sz * .3, '255,240,220', .6);
    b.restore();
  }
  {
    const cx = GX + 250, cy = GY - 70;
    blob(cx, cy, 34, '255,235,200', .32);
    blob(cx, cy, 12, '255,245,225', .6);
    for (let i = 0; i < 260; i++) {
      const r = Math.abs(gauss()) * 16;
      const a = rnd() * Math.PI * 2;
      b.fillStyle = 'rgba(255,240,215,.7)';
      b.fillRect(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r, 1, 1);
    }
  }
  s = seed;
}
backdrop();
// ---------------------------------------------------------------- the pointer drags the stars along
// As the pointer moves, the stars near it are carried a little along its path (most at its point, fading with distance),
// as if drawn through water; a pointer that stays still moves nothing, so there is never a ring or a hole around it. Once
// it has moved on they drift slowly back to their places (no spring, no wobble: most of the way back in about 3 x
// EASE_BACK seconds). A grid of offsets (CELL px) is stepped at 60 Hz; only the cells near a moving pointer or still
// settling are visited, and nothing at all is computed once everything is still. A star is drawn at its place plus the
// offset there. The dashboard supplies normalized pointer coordinates; the reach remains small.
const CELL = 10, GW = Math.ceil(W / CELL) + 2, GH = Math.ceil(H / CELL) + 2, FX = new Float32Array(GW * GH), FY = new Float32Array(GW * GH);
const DRAG = .38, REACH = 20, MAXOFF = 12, EASE_BACK = 1.2, SETTLE = 1 - Math.exp(-1 / (60 * EASE_BACK));   // how much of the pointer's step a star follows, its reach (px), the most a star is moved, and how slowly it returns
let QX = null, QY = null, LX = null, LY = null, live = false, lastT = -1, A0 = 1e9, A1 = -1, B0 = 1e9, B1 = -1;   // the pointer's place and where the field last saw it, the cells still settling
function spring() {
  const s2 = 2 * REACH * REACH, far = 9 * REACH * REACH, R = Math.ceil(3 * REACH / CELL); let a0 = A0, a1 = A1, b0 = B0, b1 = B1;
  const mx = QX !== null && LX !== null ? QX - LX : 0, my = QX !== null && LY !== null ? QY - LY : 0, moved = Math.abs(mx) + Math.abs(my) > .01; LX = QX; LY = QY;
  if (moved) { const ci = Math.round(QX / CELL), cj = Math.round(QY / CELL); a0 = Math.min(a0, ci - R); a1 = Math.max(a1, ci + R); b0 = Math.min(b0, cj - R); b1 = Math.max(b1, cj + R); }
  a0 = Math.max(0, a0); b0 = Math.max(0, b0); a1 = Math.min(GW - 1, a1); b1 = Math.min(GH - 1, b1); A0 = B0 = 1e9; A1 = B1 = -1;
  for (let j = b0; j <= b1; j++) for (let i = a0, n = j * GW + a0; i <= a1; i++, n++) {
    if (moved) {
      const ex = i * CELL - QX, ey = j * CELL - QY, d2 = ex * ex + ey * ey;
      if (d2 < far) { const w = Math.exp(-d2 / s2); FX[n] += mx * DRAG * w; FY[n] += my * DRAG * w; const m = Math.hypot(FX[n], FY[n]); if (m > MAXOFF) { FX[n] *= MAXOFF / m; FY[n] *= MAXOFF / m; } }
    }
    FX[n] -= FX[n] * SETTLE; FY[n] -= FY[n] * SETTLE;
    if (Math.abs(FX[n]) + Math.abs(FY[n]) > .05) { if (i < A0) A0 = i; if (i > A1) A1 = i; if (j < B0) B0 = j; if (j > B1) B1 = j; } else FX[n] = FY[n] = 0;
  }
  live = A1 >= 0 || moved;
}
const step = dt => { if (!live) return; for (let k = Math.max(1, Math.min(4, Math.round(dt * 60))); k > 0 && live; k--) spring(); };
const aim = (x, y, inside) => { if (inside) { QX = x; QY = y; } else QX = QY = LX = LY = null; live = true; };
// A reused result and a cell bounds check keep the lens work local to the pointer.
const lensed = new Float64Array(3);
const lens = (x, y) => { lensed[0] = x; lensed[1] = y; lensed[2] = 1;
  if (!live || x < (A0 - 1) * CELL || x > (A1 + 1) * CELL || y < (B0 - 1) * CELL || y > (B1 + 1) * CELL) return lensed;
  const gx = x / CELL, gy = y / CELL, i = Math.floor(gx), j = Math.floor(gy); if (i < 0 || j < 0 || i >= GW - 1 || j >= GH - 1) return lensed;
  const u = gx - i, v = gy - j, n = j * GW + i, a = (1 - u) * (1 - v), b = u * (1 - v), c = (1 - u) * v, d = u * v;
  lensed[0] += FX[n] * a + FX[n + 1] * b + FX[n + GW] * c + FX[n + GW + 1] * d; lensed[1] += FY[n] * a + FY[n + 1] * b + FY[n + GW] * c + FY[n + GW + 1] * d; return lensed; };
// Parallax moves x only. Flux, y, sprite, size and colour never change for a foreground star.
const field = [];
for (const p of F) { const sy = H / 2 + p.Y / p.Z * FOC * 1.9, m = (Math.log10(p.L / (p.Z * p.Z)) - LOGF0) / MAG; if (sy < -20 || sy > H + 20 || m <= 0) continue;
  const b = binOf(p.T), pin = m < 1.05, z = pin ? .7 + m * .5 : 7 + Math.pow(m - 1, 1.4) * 24, spike = m > 1.9 ? 10 + (m - 1.9) * 40 : 0;
  field.push({
    X:p.X,
    Z:p.Z,
    sy,
    z,
    spike,
    pin,
    sprite:SPR[b],
    colour:PIN[b],
    alpha:pin ? Math.min(1, m * .85) : Math.min(1, .55 + (m - 1) * .45),
    spikeAlpha:Math.min(.8, (m - 1.9) * .9),
    extent:Math.max(z / 2, spike)
  }); }
for (const p of G) {
  p.radius = p.kind === 'bar' ? Math.hypot(p.u, p.v) : p.r;
  p.om = omega(p.radius);
  p.phases = [armPhase(p.radius, 0), armPhase(p.radius, 1)];
  const nx = p.radius * .7, ix = Math.floor(nx) & 255;
  p.nf = nx - Math.floor(nx);
  p.nu = fade(p.nf);
  p.na = perm[ix];
  p.nb = perm[ix + 1];
  p.atten = Math.exp(-p.radius / 9);
  p.dust = p.radius <= RMAX && p.radius > BAR * .8;
  p.dim = p.kind === 'bulge' || p.kind === 'bar' ? .5 : 1;
}
function frame(t, advance = true) {
  sceneTime = t; g.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#020307'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  if (advance) { step(lastT < 0 ? 0 : t - lastT); lastT = t; }
  const tg = t * 1.1, tp = OMP * tg, camX = t * 1.4;                            // galactic time (fast), the pattern's turn, the camera's drift (pc)
  g.globalAlpha = 1; g.drawImage(BACK, -((camX * .02) % W), 0, W, H); g.drawImage(BACK, W - ((camX * .02) % W), 0, W, H);
  // the field, behind and in front alike: parallax from the drift, inverse-square light
  for (const p of field) { const sx = W / 2 + (p.X - camX) / p.Z * FOC, wx = ((sx + 200) % (W + 400) + W + 400) % (W + 400) - 200;
    if (wx + p.extent + MAXOFF < 0 || wx - p.extent - MAXOFF > W) continue;
    const [lx, ly] = lens(wx, p.sy); if (lx + p.extent < 0 || lx - p.extent > W) continue;
    g.globalAlpha = p.alpha;
    if (p.pin) { g.fillStyle = p.colour; g.fillRect(lx - p.z / 2, ly - p.z / 2, p.z, p.z); }
    else { g.drawImage(p.sprite, lx - p.z / 2, ly - p.z / 2, p.z, p.z);
      if (p.spike) { g.globalAlpha = p.spikeAlpha; g.fillStyle = p.colour; g.fillRect(lx - p.spike, ly - .5, p.spike * 2, 1); g.fillRect(lx - .5, ly - p.spike, 1, p.spike * 2); } } }
  // the galaxy's unresolved light: the bulge and the bar
  {
    const [bx0, by0] = project(0, 0, 0), [bx, by] = lens(bx0, by0);
    g.globalAlpha = .34;
    g.drawImage(SOFT[binOf(4600)], bx - 70, by - 40, 140, 80);
    g.globalAlpha = .48;
    g.drawImage(SOFT[binOf(5000)], bx - 26, by - 16, 52, 32);
  }
  // its stars
  const barCos = Math.cos(tp), barSin = Math.sin(tp);
  for (const p of G) {
    let x, y, z = p.z, a = 1, T = p.T, L = p.L, r, th;
    if (p.kind === 'bar') { const c = barCos, s2 = barSin; x = p.u * c - p.v * s2; y = p.u * s2 + p.v * c; r = p.radius; th = Math.atan2(y, x); }
    else { r = p.r; th = p.th + p.om * tg; }
    if (p.kind === 'young' || p.kind === 'hii') {
      let d = 9;
      for (let k = 0; k < 2; k++) { let delta = th - tp - p.phases[k]; delta = ((delta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; d = Math.min(d, Math.abs(delta)); }
      a = Math.exp(-d * d / (2 * (p.kind === 'hii' ? .08 : .17) ** 2));
      if (a < .03) continue;
    }
    if (p.kind !== 'bar') { x = Math.cos(th) * r; y = Math.sin(th) * r; }
    const [sx0, sy0] = project(x, y, z), [sx, sy, mu] = lens(sx0, sy0); if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
    // dust between this star and us: the disc's dust where the line of sight crosses it, if the star lies behind the plane
    const tau = dustTau(p, th, tp) * (p.kind === 'old' || p.kind === 'young' ? .7 : 1) + (z < 0 || p.kind === 'bulge' ? dustTau(p, th - .05, tp) * .6 : 0);
    const ext = Math.exp(-tau); T = T ? T / (1 + tau * .2) : 0;
    if (p.kind === 'hii') { const zz = 5 + L * 4; g.globalAlpha = .55 * a * ext; g.drawImage(HII, sx - zz / 2, sy - zz / 2, zz, zz); continue; }
    // the bulge and the bar hold thousands of stars in a small place: each gives less light, so the centre glows instead of burning white
    const dim = p.dim, m = L * a * ext * mu * dim, b = binOf(T);
    if (m < 1) { g.globalAlpha = Math.min(1, (.16 + m * .55) * dim); g.fillStyle = PIN[b]; const zz = .8 + m * .5; g.fillRect(sx - zz / 2, sy - zz / 2, zz, zz); }
    else { const zz = 5 + Math.pow(m - 1, 1.2) * 7; g.globalAlpha = Math.min(1, .45 + (m - 1) * .25); g.drawImage(SPR[b], sx - zz / 2, sy - zz / 2, zz, zz); }
  }
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  if (!vignette) {
    vignette = g.createLinearGradient(0, 0, W, 0);
    vignette.addColorStop(0, 'rgba(2,3,7,.45)');
    vignette.addColorStop(.15, 'rgba(2,3,7,0)');
    vignette.addColorStop(.9, 'rgba(2,3,7,0)');
    vignette.addColorStop(1, 'rgba(2,3,7,.4)');
  }
  g.fillStyle = vignette;
  g.fillRect(0, 0, W, H);
}

  let dead = false, paused = true, raf = 0, lastNow = null, lastDraw = -Infinity, elapsed = 0, needsSize = false;
  function forget() { QX = QY = LX = LY = null; FX.fill(0); FY.fill(0); A0 = B0 = 1e9; A1 = B1 = -1; live = false; lastT = -1; }
  function tick(now) {
    raf = 0; if (dead || paused) return;
    if (lastNow !== null) elapsed += Math.min(50, Math.max(0, now - lastNow)) / 1000; lastNow = now;
    if (now - lastDraw >= 1000 / 30 - 2) { lastDraw = now; frame(elapsed); }
    raf = win.requestAnimationFrame(tick);
  }
  return {
    pause(value) { if (dead || paused === value) return; paused = value; lastNow = null;
      if (paused) { if (raf) win.cancelAnimationFrame(raf); raf = 0; forget(); }
      else if (!raf) { if(needsSize){sizeCanvas();backdrop();needsSize=false;}lastDraw = -Infinity; raf = win.requestAnimationFrame(tick); }
    },
    aim(x, y, inside) { if (!paused && !dead) aim(x * W, y * H, inside); },
    resize() { if (dead) return; if(paused){needsSize=true;return;}sizeCanvas(); backdrop(); frame(elapsed, false); },
    destroy() { dead = true; if (raf) win.cancelAnimationFrame(raf); raf = 0; forget(); }
  };
 }

 // Starfield: the frames' stars are drawn here, star by star, so the pointer's lens bends each one as it bends the sky's.
 // Every frame is a ring of star streams (clumped like the Milky Way, knotted at the corners). At rest each ring is four
 // cached edge strips; frames near the pointer are drawn star by star through a point lens (r' = (r + sqrt(r^2 + 4E^2)) / 2,
 // brightened by mu = (u^2 + 2) / (u sqrt(u^2 + 4))). Nothing is drawn while nothing changes.
 function starFrames(rd,doc,win,isHidden){
  const canvas=doc.createElement('canvas');canvas.className='tk-starframes';canvas.setAttribute('aria-hidden','true');canvas.setAttribute('data-rd-keep','');
  Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',width:'100vw',height:'100vh',pointerEvents:'none',zIndex:'2'});
  const g=canvas.getContext?.('2d'),rings=new WeakMap(),observed=new Set();if(!g)return null;
  // the course sidebar has no ring of its own: its course cards carry the stars
  const KIND=[['.rd-rail-all .rd-frame, .rd-rail-course .rd-frame','card'],['.rd-course-information, .rd-work-column, .rd-information','panel']];
  // card: the ring 7px inside the card; panel: 8px outside the panel; rail: just outside the rail
  const SHAPE={
    card:{grow:-2,radius:5,spread:3,density:.72,clump:13,size:.43},
    panel:{grow:8,radius:6,spread:4.4,density:.62,clump:21,size:.4},
    rail:{grow:2,radius:6,spread:4.4,density:.62,clump:21,size:.4}
  };
  const PAD=16;
  let dpr=1,W=0,H=0,raf=0,dirty=true,dead=false,geometry=null,base=null,painted=null;
  // THE POINTER DRAGS THE STARS ALONG (as in the sky): as it moves, the stars near it are carried a little along its path,
  // and a pointer that stays still moves nothing (no ring round it); once it has moved on they drift slowly back, with
  // no spring and no wobble. Stepped at 60 Hz over only the cells near a moving pointer or still settling; a star there
  // is drawn at its place plus the offset. Rings away from it stay their cached strips; nothing runs once all is still.
  const CELL=10,DRAG=.34,REACH=20,MAXOFF=7,EASE_BACK=1.2,SETTLE=1-Math.exp(-1/(60*EASE_BACK));
  let GW=0,GH=0,FX=new Float32Array(0),FY=new Float32Array(0),live=false,box=null,px=null,py=null,lx=null,ly=null,last=0,A0=1e9,A1=-1,B0=1e9,B1=-1;
  function grid(){
    const gw=Math.ceil(W/CELL)+2,gh=Math.ceil(H/CELL)+2;
    if(gw===GW&&gh===GH)return;
    GW=gw;
    GH=gh;
    const n=GW*GH;
    FX=new Float32Array(n);
    FY=new Float32Array(n);
    A0=B0=1e9;
    A1=B1=-1;
    box=null;
    live=px!==null;
  }
  function spring(){
   const s2=2*REACH*REACH,far=9*REACH*REACH,R=Math.ceil(3*REACH/CELL);let a0=A0,a1=A1,b0=B0,b1=B1;
   const mx=px!==null&&lx!==null?px-lx:0,my=px!==null&&ly!==null?py-ly:0,moved=Math.abs(mx)+Math.abs(my)>.01;lx=px;ly=py;
   if(moved){const ci=Math.round(px/CELL),cj=Math.round(py/CELL);a0=Math.min(a0,ci-R);a1=Math.max(a1,ci+R);b0=Math.min(b0,cj-R);b1=Math.max(b1,cj+R);}
   a0=Math.max(0,a0);b0=Math.max(0,b0);a1=Math.min(GW-1,a1);b1=Math.min(GH-1,b1);A0=B0=1e9;A1=B1=-1;let moving=false;
   for(let j=b0;j<=b1;j++)for(let i=a0,n=j*GW+a0;i<=a1;i++,n++){
    if(moved){
      const ex=i*CELL-px,ey=j*CELL-py,d2=ex*ex+ey*ey;
      if(d2<far){const w=Math.exp(-d2/s2);FX[n]+=mx*DRAG*w;FY[n]+=my*DRAG*w;const m=Math.hypot(FX[n],FY[n]);if(m>MAXOFF){FX[n]*=MAXOFF/m;FY[n]*=MAXOFF/m;}}
    }
    FX[n]-=FX[n]*SETTLE;FY[n]-=FY[n]*SETTLE;
    if(Math.abs(FX[n])+Math.abs(FY[n])>.05){moving=true;if(i<A0)A0=i;if(i>A1)A1=i;if(j<B0)B0=j;if(j>B1)B1=j;}else FX[n]=FY[n]=0;
   }
   live=moving||moved;
  }
  // steps the spring for dt seconds and finds the box (window px) that still holds any offset
  function step(dt){
   if(!live||!GW)return;for(let k=Math.max(1,Math.min(4,Math.round(dt*60)));k>0&&live;k--)spring();
   box=A1>=0?{x0:(A0-1)*CELL,y0:(B0-1)*CELL,x1:(A1+1)*CELL,y1:(B1+1)*CELL}:null;
  }
  const shifted=new Float64Array(2);
  const offset=(x,y)=>{const gx=x/CELL,gy=y/CELL,i=Math.floor(gx),j=Math.floor(gy);if(i<0||j<0||i>=GW-1||j>=GH-1)return shifted.fill(0);
   const u=gx-i,v=gy-j,n=j*GW+i,a=(1-u)*(1-v),b=u*(1-v),c=(1-u)*v,d=u*v;
   shifted[0]=FX[n]*a+FX[n+1]*b+FX[n+GW]*c+FX[n+GW+1]*d;shifted[1]=FY[n]*a+FY[n+1]*b+FY[n+GW]*c+FY[n+GW+1]*d;return shifted;};
  const seeded=seed=>{let s=seed>>>0||1;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
  const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;};
  // glow sprites, one per tint, drawn once
  const glow=rgb=>{
    const c=doc.createElement('canvas');
    c.width=c.height=64;
    const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,`rgba(${rgb},1)`);
    gr.addColorStop(.25,`rgba(${rgb},.45)`);
    gr.addColorStop(1,`rgba(${rgb},0)`);
    x.fillStyle=gr;
    x.fillRect(0,0,64,64);
    return c;
  };
  const SPRITE={cool:glow('195,214,255'),warm:glow('255,205,160'),core:glow('255,255,255')};
  // a point on the rounded ring at arc length s, with its outward normal
  function track(w,h,r){
   const straight=[w-2*r,h-2*r],arc=Math.PI*r/2,parts=[];let at=0;
   const edge=(x,y,dx,dy,nx,ny,len)=>{parts.push({at,len,f:s=>[x+dx*s,y+dy*s,nx,ny]});at+=len;};
   const bend=(cx,cy,a0)=>{parts.push({at,len:arc,f:s=>{const a=a0+s/r;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r,Math.cos(a),Math.sin(a)];}});at+=arc;};
   edge(r,0,1,0,0,-1,straight[0]);bend(w-r,r,-Math.PI/2);edge(w,r,0,1,1,0,straight[1]);bend(w-r,h-r,0);
   edge(w-r,h,-1,0,0,1,straight[0]);bend(r,h-r,Math.PI/2);edge(0,h-r,0,-1,-1,0,straight[1]);bend(r,r,Math.PI);
   return {length:at,point(s){s=((s%at)+at)%at;const p=parts.find(q=>s<q.at+q.len)||parts.at(-1);return p.f(s-p.at);}};
  }
  // the stars of one ring, in ring coordinates (0,0 = the ring's top left); the same frame size always gets the same sky
  function stars(kind,w,h,key){
   const S=SHAPE[kind],r=Math.min(S.radius,w/2,h/2),T=track(w,h,r),rnd=seeded(hash(key)),gauss=()=>{
     let u=0;
     while(!u)u=rnd();
     return Math.sqrt(-2*Math.log(u))*Math.cos(6.2832*rnd());
   },out=[];
   const clumps=[];for(let s=rnd()*S.clump;s<T.length;s+=S.clump*(.6+rnd()*.8))clumps.push([s,S.clump*(.1+rnd()*.26)]);
   const waves=[0,1].map(()=>[60+rnd()*90,rnd()*6.2832]),wob=s=>waves.reduce((a,[p,f])=>a+Math.sin(s/p*6.2832+f),0)*S.spread*.28;
   const add=(x,y,b,warm)=>out.push([x,y,b,warm]);
   const n=Math.round(T.length*S.density);
   for(let k=0;k<n;k++){
     const c=clumps[(rnd()*clumps.length)|0],s=rnd()<.7&&c?c[0]+gauss()*c[1]:rnd()*T.length,[x,y,nx,ny]=T.point(s),off=wob(s)+gauss()*S.spread*.45;
     add(x+nx*off,y+ny*off,Math.pow(rnd(),3.2),rnd()<.14);
   }
   const flares=[];
   for(const [cx,cy,big] of [[0,0,1],[w,0,0],[w,h,0],[0,h,0]]){
    const ix=cx?cx-r*.3:r*.3,iy=cy?cy-r*.3:r*.3;
    for(let q=0;q<14;q++)add(ix+gauss()*S.spread*.6,iy+gauss()*S.spread*.6,Math.pow(rnd(),2.2),rnd()<.2);
    flares.push([ix,iy,big?1:.55+rnd()*.25]);
   }
   return {stars:out,flares,size:S.size};
  }
  // one star at (x,y), brightness b (m scales its light; 1 = as drawn)
  function star(ctx,x,y,b,warm,k,m){
   if(b>.55){const R=(2+b*5)*k*Math.sqrt(m);ctx.globalAlpha=Math.min(1,.42*m);ctx.drawImage(warm?SPRITE.warm:SPRITE.cool,x-R,y-R,2*R,2*R);
    const c=(.8+b)*k*Math.sqrt(m);ctx.globalAlpha=Math.min(1,.9*m);ctx.drawImage(SPRITE.core,x-c,y-c,2*c,2*c);
    if(b>.85)spikes(ctx,x,y,(4+b*6)*k*Math.sqrt(m),warm,.42*Math.min(1,m));}
   else{const z=Math.max(.6,(.7+b*1.6)*k*1.15)*Math.sqrt(m);ctx.globalAlpha=Math.min(1,(.35+b)*m);ctx.fillStyle=warm?'rgb(255,215,180)':'rgb(215,228,255)';ctx.fillRect(x-z/2,y-z/2,z,z);}
  }
  function spikes(ctx,x,y,len,warm,alpha){
   ctx.globalAlpha=alpha;ctx.strokeStyle=warm?'rgba(255,214,180,.9)':'rgba(214,226,255,.9)';ctx.lineWidth=.6;ctx.beginPath();
   ctx.moveTo(x-len,y);ctx.lineTo(x+len,y);ctx.moveTo(x,y-len);ctx.lineTo(x,y+len);ctx.stroke();
  }
  function dragRing(ctx,ring,ox,oy,bx){
   const k=ring.size,inside=(x,y)=>x>=bx.x0&&x<=bx.x1&&y>=bx.y0&&y<=bx.y1;
   for(const [sx,sy,b,warm] of ring.stars){const x=ox+sx,y=oy+sy;if(!inside(x,y))continue;const [dx,dy]=offset(x,y);star(ctx,x+dx,y+dy,b,warm,k,1);}
   for(const [fx,fy,s] of ring.flares){
     const x=ox+fx,y=oy+fy;
     if(!inside(x,y))continue;
     const [dx,dy]=offset(x,y);
     ctx.globalAlpha=.85;
     const c=1.3*s;
     ctx.drawImage(SPRITE.core,x+dx-c*2,y+dy-c*2,c*4,c*4);
     spikes(ctx,x+dx,y+dy,7*s,false,.5*s);
   }
   ctx.globalAlpha=1;
  }
  function drawRing(ctx,ring,ox,oy){
   const k=ring.size;
   for(const [sx,sy,b,warm] of ring.stars)star(ctx,ox+sx,oy+sy,b,warm,k,1);
   for(const [fx,fy,s] of ring.flares){const x=ox+fx,y=oy+fy;ctx.globalAlpha=.85;const c=1.3*s;ctx.drawImage(SPRITE.core,x-c*2,y-c*2,c*4,c*4);spikes(ctx,x,y,7*s,false,.5*s);}
   ctx.globalAlpha=1;
  }
  // a ring at rest: four thin strips cached at the screen's pixel ratio (only the edges hold stars)
  function strips(ring,w,h){
   const band=PAD*2,make=(sw,sh)=>{
     const c=doc.createElement('canvas');
     c.width=Math.max(1,Math.ceil(sw*dpr));
     c.height=Math.max(1,Math.ceil(sh*dpr));
     const x=c.getContext('2d');
     x.setTransform(dpr,0,0,dpr,0,0);
     x.globalCompositeOperation='lighter';
     return [c,x];
   };
   const parts=[[-PAD,-PAD,w+band,band],[-PAD,h-PAD,w+band,band],[-PAD,PAD,band,h-band],[w-PAD,PAD,band,h-band]].filter(p=>p[2]>0&&p[3]>0);
   return parts.map(([x0,y0,sw,sh])=>{
     const [c,x]=make(sw,sh);
     x.save();
     x.beginPath();
     x.rect(0,0,sw,sh);
     x.clip();
     drawRing(x,ring,-x0,-y0);
     x.restore();
     return {c,x0,y0,sw,sh};
   });
  }
  function frames(){
   const list=[];
   for(const [selector,kind] of KIND)for(const el of rd.querySelectorAll(selector)){
    const b=el.getBoundingClientRect();if(b.width<8||b.height<8)continue;
    const S=SHAPE[kind],x=b.left-S.grow,y=b.top-S.grow,w=b.width+2*S.grow,h=b.height+2*S.grow;if(w<8||h<8)continue;
    let clip=null;if(kind==='card'){const rail=el.closest('.rd-course-rail');if(rail){const c=rail.getBoundingClientRect();clip=[c.left,c.top,c.width,c.height];}}
    list.push({el,kind,x,y,w,h,clip});
   }
   return list;
  }
  function ringOf(f,index){
   const key=f.kind+':'+index+':'+Math.round(f.w)+'x'+Math.round(f.h)+'@'+dpr;let ring=rings.get(f.el);
   if(!ring||ring.key!==key){
     const made=stars(f.kind,f.w,f.h,f.kind+index+':'+Math.round(f.w)+'x'+Math.round(f.h));
     ring={key,...made};
     ring.strips=strips(ring,f.w,f.h);
     rings.set(f.el,ring);
   }
   return ring;
  }
  function paint(){
   raf=0;if(dead)return;
   if(isHidden()){dirty=true;return;}
   const nd=Math.min(2,win.devicePixelRatio||1),nw=win.innerWidth,nh=win.innerHeight;
   if(nd!==dpr||nw!==W||nh!==H){dpr=nd;W=nw;H=nh;canvas.width=Math.ceil(W*dpr);canvas.height=Math.ceil(H*dpr);dirty=true;}
   grid();const now=win.performance?.now?.()??Date.now();step(last?Math.max(0,(now-last)/1000):0);last=live?now:0;
   if(dirty||!geometry){
     base=canvas.getBoundingClientRect();
     geometry=frames();
     const present=new Set(geometry.map(f=>f.el));
     for(const el of observed)if(!present.has(el)){resize?.unobserve?.(el);observed.delete(el);}
     for(const el of present)if(!observed.has(el)){resize?.observe(el);observed.add(el);}
   }
   const bx=box&&{x0:box.x0-base.left,y0:box.y0-base.top,x1:box.x1-base.left,y1:box.y1-base.top};
   // Restore only the old/new push area; the rest of the canvas already holds the cached rings.
   const boxes=[painted,bx].filter(Boolean),
     pad=PAD+MAXOFF,
     area=dirty?
       {x0:0,y0:0,x1:W,y1:H}:
       boxes.length?
         {x0:Math.min(...boxes.map(b=>b.x0))-pad,y0:Math.min(...boxes.map(b=>b.y0))-pad,x1:Math.max(...boxes.map(b=>b.x1))+pad,y1:Math.max(...boxes.map(b=>b.y1))+pad}:
         null;
   if(!area)return;
   g.setTransform(dpr,0,0,dpr,0,0);
   g.save();
   g.beginPath();
   g.rect(area.x0,area.y0,area.x1-area.x0,area.y1-area.y0);
   g.clip();
   g.globalCompositeOperation='source-over';
   g.globalAlpha=1;
   g.clearRect(area.x0,area.y0,area.x1-area.x0,area.y1-area.y0);
   g.globalCompositeOperation='lighter';
   geometry.forEach((f,index)=>{
    const ox=f.x-base.left,oy=f.y-base.top;if(ox+f.w+PAD<area.x0||ox-PAD>area.x1||oy+f.h+PAD<area.y0||oy-PAD>area.y1)return;const ring=ringOf(f,index);
    if(f.clip){g.save();g.beginPath();g.rect(f.clip[0]-base.left,f.clip[1]-base.top,f.clip[2],f.clip[3]);g.clip();}
    const near=!!bx&&bx.x1>ox-PAD&&bx.x0<ox+f.w+PAD&&bx.y1>oy-PAD&&bx.y0<oy+f.h+PAD;
    // the strips draw everything outside the push box; inside it the ring's own stars are drawn where the push has moved them
    if(near){g.save();g.beginPath();g.rect(0,0,W,H);g.rect(bx.x0,bx.y0,bx.x1-bx.x0,bx.y1-bx.y0);g.clip('evenodd');}
    for(const s of ring.strips)g.drawImage(s.c,ox+s.x0,oy+s.y0,s.sw,s.sh);
    if(near){g.restore();dragRing(g,ring,ox,oy,bx);}
    if(f.clip)g.restore();
   });
   g.restore();painted=bx;dirty=false;
   if(live)raf=win.requestAnimationFrame(paint);
  }
  const wake=()=>{if(!dead&&!raf&&!isHidden())raf=win.requestAnimationFrame(paint);};
  const resize=typeof win.ResizeObserver==='function'?new win.ResizeObserver(()=>{dirty=true;wake();}):null;resize?.observe(rd);
  return {canvas,
   // where the pointer is (or null when it left / motion is off): the stars near it are pushed aside and spring back
   aim(x,y,on){const nx=x==null||!on?null:x,ny=nx===null?null:y;if(nx===px&&ny===py)return;px=nx;py=ny;live=true;wake();},
   pause(){if(raf)win.cancelAnimationFrame(raf);raf=0;px=py=lx=ly=null;FX.fill(0);FY.fill(0);A0=B0=1e9;A1=B1=-1;box=null;live=false;last=0;dirty=true;},
   dirty(){dirty=true;wake();},
   destroy(){dead=true;resize?.disconnect();if(raf)win.cancelAnimationFrame(raf);raf=0;canvas.remove();}};
 }
 // remove(rd) takes the scene down only if that dashboard owns it, so an old dashboard being torn down never removes a newer one's
 function remove(rd){if(active&&(!rd||active.rd===rd)){const previous=active;active=null;previous.destroy();}}
 function apply(root,rd,id,opts={}){
  if(!id||!Object.hasOwn(motifs,id)||global.ReserveFeatures?.enabled('scene-themes')===false){remove(rd);return;}
  if(active?.root===root&&active.rd===rd&&active.id===id){active.update(opts);return;}
  remove();
  if(!root||!rd||!global.chrome?.runtime?.getURL)return;
  const doc=rd.ownerDocument||global.document,base=global.chrome.runtime.getURL('themes/'+id+'/');
  const reduced=global.matchMedia?.('(prefers-reduced-motion: reduce)');
  const previousKit=rd.getAttribute('data-theme-kit'),previousPause=rd.hasAttribute('data-scene-paused'),icons=new Map(),minis=new Map(),lens=new Map(),disposers=[];
  let options=opts,
    dead=false,
    timer=0,
    raf=0,
    point=null,
    intersecting=true,
    skyInView=true,
    playing=false,
    mediaSource='',
    skyAnimator=null,
    invisibleState=false,
    drawingPaused=true;
  const link=doc.createElement('link');link.rel='stylesheet';link.setAttribute('href',base+'theme.css');
  const sky=doc.createElement('div');sky.className='tk-sky';sky.setAttribute('aria-hidden','true');sky.setAttribute('data-rd-keep','');
  const media=doc.createElement(id==='stars'?'canvas':'video');
  const poster=doc.createElement('img');poster.className='tk-poster';poster.alt='';poster.setAttribute('src',base+'poster.jpg');
  if(id==='stars')media.setAttribute('aria-hidden','true');
  else{media.muted=true;media.loop=true;media.playsInline=true;media.autoplay=false;media.preload='none';media.poster=base+'poster.jpg';}
  sky.append(media,poster);
  const frames=id==='stars'?starFrames(rd,doc,global,()=>invisibleState||doc.hidden||doc.visibilityState==='hidden'||rd.isConnected===false):null;
  function listen(target,type,fn,options){target?.addEventListener?.(type,fn,options);disposers.push(()=>target?.removeEventListener?.(type,fn,options));}
  function animated(){return (rd.dataset.motionStyle??options.motionStyle??'gentle')==='gentle'&&!reduced?.matches;}
  function hidden(){
   if(doc.hidden||doc.visibilityState==='hidden'||rd.isConnected===false||!intersecting)return true;
   for(let el=rd;el;el=el.parentElement||(el===root.host?null:el.getRootNode?.()?.host)){
    if(el.hidden||el.getAttribute?.('aria-hidden')==='true')return true;
    const style=global.getComputedStyle?.(el);if(style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse')return true;
   }
   // A shadow root is not a parentElement. Always check its host and ancestors.
   for(let el=root.host;el;el=el.parentElement){
    if(el.hidden||el.getAttribute?.('aria-hidden')==='true')return true;
    const style=global.getComputedStyle?.(el);if(style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse')return true;
   }
   return false;
  }
  function restoreLens(el){
   const before=lens.get(el);if(!before)return;
   if(before.value)el.style.setProperty('--lens',before.value,before.priority);else el.style.removeProperty('--lens');
   lens.delete(el);
  }
  function clearLens(){for(const el of lens.keys())restoreLens(el);}
  function syncMedia(){
   if(dead)return;
   // the sky also rests while it is scrolled out of view (the frames' stars keep drawing; they are on the page)
   const motion=animated(),rest=rd.hasAttribute?.('data-art-rest'),invisible=hidden(),paused=!motion||invisible||!skyInView||rest;
   const pauseDrawing=!motion||invisible||rest;
   invisibleState=invisible;drawingPaused=!!pauseDrawing;
   if(pauseDrawing&&!rd.hasAttribute('data-scene-paused'))rd.setAttribute('data-scene-paused','');
   else if(!pauseDrawing&&rd.hasAttribute('data-scene-paused'))rd.removeAttribute('data-scene-paused');
   media.hidden=paused;poster.hidden=!paused;
   if(id==='stars'){
    if(!paused&&!skyAnimator){skyAnimator=starSky(media,doc,global);skyAnimator?.resize();}
    skyAnimator?.pause(paused);
    if(!skyAnimator){media.hidden=true;poster.hidden=false;}
   }else{
    media.autoplay=!paused;
    if(!paused&&!mediaSource){mediaSource=base+'sky.mp4';media.setAttribute('src',mediaSource);media.preload='metadata';}
    if(!paused&&!playing){playing=true;const started=media.play();started?.catch?.(()=>{playing=false;media.hidden=true;poster.hidden=false;});}
    else if(paused){media.pause();playing=false;}
   }
   if(paused){point=null;if(raf){global.cancelAnimationFrame(raf);raf=0;}clearLens();frames?.pause();}
   frames?.dirty();
  }
  function sync(){
   if(dead)return;
   if(link.parentNode!==root)root.append(link);
   if(rd.getAttribute('data-theme-kit')!==id)rd.dataset.themeKit=id;
   restMirror();
   // put back only when it is gone: moving a frame reloads it (and its whole sky)
   if(sky.parentNode!==rd){rd.prepend(sky);skyAnimator?.resize();}
   if(frames){if(frames.canvas.parentNode!==rd)rd.append(frames.canvas);frames.dirty();}
   const arts=[...rd.querySelectorAll('.rd-rail-art')],present=new Set(arts);
   for(const [art,icon]of icons)if(!present.has(art)){icon.remove();icons.delete(art);}
   arts.forEach((art,index)=>{
    const motif=motifs[id][index%6];let icon=icons.get(art);
    if(!icon){icon=doc.createElement('img');icon.className='tk-icon';icon.alt='';icons.set(art,icon);}
    if(icon.dataset.motif!==motif){icon.dataset.motif=motif;icon.setAttribute('src',base+'icon-'+motif+'.png');}
    if(icon.parentNode!==art)art.append(icon);
   });
   // the small drawings elsewhere (an empty state's picture, a module's badge) wear the theme's pictures too: the theme's
   // showpiece for an empty state, the others in turn; the drawing itself stays, hidden while the theme is on
   const smalls=[...rd.querySelectorAll('svg.rd-mini')].filter(svg=>!svg.closest('.rd-rail-art')),keep=new Set(smalls);
   for(const [svg,icon]of minis)if(!keep.has(svg)){icon.remove();minis.delete(svg);}
   smalls.forEach((svg,index)=>{
    const empty=!!svg.closest('.rd-empty-art'),motif=motifs[id][empty?2:(index+3)%6];let icon=minis.get(svg);
    if(!icon){icon=doc.createElement('img');icon.className='tk-icon tk-mini';icon.alt='';minis.set(svg,icon);}
    if(icon.dataset.motif!==motif){icon.dataset.motif=motif;icon.setAttribute('src',base+'icon-'+motif+'.png');}
    const box=svg.getBoundingClientRect?.();if(box?.width){icon.style.width=box.width+'px';icon.style.height=box.height+'px';}
    if(icon.nextSibling!==svg)svg.before(icon);
   });
   for(const el of lens.keys())if(!rd.contains(el))restoreLens(el);
   syncMedia();
  }
  function schedule(){if(dead)return;global.clearTimeout(timer);timer=global.setTimeout(()=>{timer=0;sync();},60);}
  // The idle rest (data-art-rest on the root, motion.js) pauses the scene's loops through data-kit-rest, which only a scene
  // writes (scene-themes.css): a rule keyed on data-art-rest itself restyled the whole dashboard each time the rest started
  // or ended, with or without a scene. Mirrored as the root changes (the observer runs before the next frame, so the pause
  // lands in the same frame as before) and on every sync (a scene applied while the page rests).
  function restMirror(){
    if(dead)return;
    const on=!!rd.hasAttribute?.('data-art-rest');
    if(on!==!!rd.hasAttribute?.('data-kit-rest')){if(on)rd.setAttribute('data-kit-rest','');else rd.removeAttribute('data-kit-rest');}
  }
  function bend(){
   raf=0;if(dead||!point||drawingPaused||doc.hidden||!intersecting)return;
   const {x:px,y:py}=point,r=sky.getBoundingClientRect();
   const x=r.width?(px-r.left)/r.width:0,y=r.height?(py-r.top)/r.height:0;
   skyAnimator?.aim(Math.max(0,Math.min(1,x)),Math.max(0,Math.min(1,y)),!!r.width&&!!r.height&&x>=0&&x<=1&&y>=0&&y<=.82);
   // the frames' stars bend one by one (starFrames), only while the pointer is over the dashboard
   const box=rd.getBoundingClientRect();frames?.aim(px,py,px>=box.left&&px<=box.right&&py>=box.top&&py<=box.bottom);
  }
  function pointer(event){if(dead||drawingPaused)return;point={x:event.clientX,y:event.clientY};if(!raf)raf=global.requestAnimationFrame(bend);}
  function leave(){if(dead||drawingPaused)return;point={x:-1e4,y:-1e4};if(!raf)raf=global.requestAnimationFrame(bend);}
  function onMotionChange(){syncMedia();}
  listen(doc,'visibilitychange',syncMedia);
  listen(global,'pagehide',()=>remove(rd));
  if(reduced?.addEventListener)listen(reduced,'change',onMotionChange);
  if(id==='stars'){
   listen(global,'pointermove',pointer,{passive:true});listen(doc.documentElement,'pointerleave',leave);
   if(frames){
     const redraw=()=>frames.dirty();
     listen(doc,'scroll',redraw,{capture:true,passive:true});
     listen(root,'scroll',redraw,{capture:true,passive:true});
     listen(global,'resize',()=>{redraw();skyAnimator?.resize();},{passive:true});
   }
  }
  const observer=typeof global.MutationObserver==='function'?new global.MutationObserver(()=>{restMirror();schedule();}):null;
  observer?.observe(root,{childList:true,subtree:true});
  observer?.observe(rd,{attributes:true,attributeFilter:['data-motion-style','hidden','class','style','data-art-rest']});
  // Size observers cover reflow; class/style changes can move a frame without changing its size.
  const layout=frames&&typeof global.MutationObserver==='function'?new global.MutationObserver(changes=>{
    if(changes.some(change=>!change.target?.closest?.('.tk-sky, .tk-icon, .tk-starframes')))frames.dirty();
  }):null;
  layout?.observe(root,{attributes:true,subtree:true,attributeFilter:['class','style','hidden']});
  if(frames){listen(root,'transitionend',()=>frames.dirty(),true);listen(root,'animationend',()=>frames.dirty(),true);}
  const watched=new Set();
  for(const start of [rd.parentElement,root.host])
    for(let el=start;el;el=el.parentElement){if(watched.has(el))continue;watched.add(el);observer?.observe(el,{attributes:true,attributeFilter:['hidden','style','class','aria-hidden']});}
  const visibility=typeof global.IntersectionObserver==='function'?new global.IntersectionObserver(entries=>{
    for(const entry of entries){if(entry.target===rd)intersecting=entry.isIntersecting;else if(entry.target===sky)skyInView=entry.isIntersecting;}
    syncMedia();
  }):null;
  visibility?.observe(rd);visibility?.observe(sky);
  const skySize=id==='stars'&&typeof global.ResizeObserver==='function'?new global.ResizeObserver(()=>skyAnimator?.resize()):null;skySize?.observe(sky);
  active={root,rd,id,update(next){options=next;sync();},destroy(){
   dead=true;
   observer?.disconnect();
   layout?.disconnect();
   visibility?.disconnect();
   skySize?.disconnect();
   global.clearTimeout(timer);
   if(raf)global.cancelAnimationFrame(raf);
   for(const dispose of disposers)dispose();clearLens();frames?.destroy();
   if(id==='stars')skyAnimator?.destroy();else{media.pause();media.removeAttribute('src');media.load?.();}
   link.remove();sky.remove();for(const icon of icons.values())icon.remove();icons.clear();for(const icon of minis.values())icon.remove();minis.clear();
   rd.removeAttribute('data-kit-rest');
   if(previousKit===null)rd.removeAttribute('data-theme-kit');else rd.setAttribute('data-theme-kit',previousKit);
   if(previousPause)rd.setAttribute('data-scene-paused','');else rd.removeAttribute('data-scene-paused');
  }};
  sync();
 }
 const api={apply,remove,names,createStarSky:starSky};global.ReserveSceneThemes=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
