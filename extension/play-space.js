/* Canvas Harness play tools: the black hole, rendered. The page tears open (a drawn paper lip, inked, curling) onto deep
 * space: a starfield bent by gravitational lensing (each star's image pushed out to r' = (r + sqrt(r^2 + 4 rE^2)) / 2 and
 * stretched round the hole), a faint nebula, the back end's 0 and 1 streaming in, and the hole itself: a black shadow,
 * a thin blazing photon ring, an accretion disk of orbiting particles (faster inside, Keplerian), white-hot inside and
 * orange out, brighter on the side coming toward us, its far side lensed up over the top and under the bottom.
 * ReservePlaySpace.open(canvas, {size}) -> {frame(t), close(), done}: the caller runs frame(seconds) on animation frames
 * for as long as it lives (a few seconds); nothing runs once it is done. */
(function(root){
 'use strict';
 const TAU = Math.PI * 2, LOW = () => !!root.ReservePlayLow;   // (set by play-tools on a weak machine: smaller canvases, no blur, fewer particles)
 function open(cv, { size = 560, reduce = false } = {}) {
  const dpr = Math.min(LOW() ? 1 : 2, root.devicePixelRatio || 1), W = size, H = Math.round(size * .78); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let seed = 4242; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const cx = W / 2, cy = H / 2, rs = W * .075, rE = rs * 1.45, tearR = W * .43;
  // the sky behind: stars (by temperature), a faint nebula painted once
  const stars = [...Array(520)].map(() => {
    const r = Math.sqrt(rnd()) * W * .6, a = rnd() * TAU, T = rnd();
    return { r, a, m: Math.pow(rnd(), 3) * 2.2 + .35, c: T < .2 ? [255, 190, 150] : T < .55 ? [255, 244, 228] : [190, 210, 255], tw: rnd() * TAU };
  });
  const neb = document.createElement('canvas');
  neb.width = W;
  neb.height = H;
  {
    const n = neb.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = cx + (rnd() - .5) * W,
        y = cy + (rnd() - .5) * H,
        r = 40 + rnd() * 140,
        q = n.createRadialGradient(x, y, 0, x, y, r),
        col = rnd() < .5 ? '70,60,140' : rnd() < .5 ? '40,90,150' : '140,60,110';
      q.addColorStop(0, `rgba(${col},${.06 + rnd() * .07})`);
      q.addColorStop(1, `rgba(${col},0)`);
      n.fillStyle = q;
      n.fillRect(0, 0, W, H);
    }
  }
  // the disk: particles on circular orbits in a plane seen almost edge on (cos i = .2)
  const COSI = .2, rin = rs * 1.35, rout = rs * 4.6, parts = [...Array(1700)].map(() => {
    const u = rnd(), r = rin + (rout - rin) * Math.pow(u, 1.6);
    return { r, a: rnd() * TAU, w: Math.pow(rin / r, 1.5) * 4.2, len: .06 + rnd() * .18, b: .45 + rnd() * .55 };
  });
  const tint = r => { const k = (r - rin) / (rout - rin); return k < .15 ? [255, 250, 235] : k < .4 ? [255, 222, 150] : k < .7 ? [255, 160, 80] : [220, 90, 40]; };
  // the back end's 0 and 1, drifting in on spirals
  const bits = [...Array(150)].map(() => ({ r0: tearR * (.55 + rnd() * .5), a0: rnd() * TAU, ph: rnd(), s: 9 + rnd() * 6, v: rnd() < .5 ? '0' : '1', c: rnd() < .3 ? '#DDF7D0' : '#86D877' }));
  // the paper's torn edge (a ragged ellipse) and the curls on it
  const edge = [...Array(72)].map((_, i) => {
    const a = i / 72 * TAU, k = 1 + Math.sin(a * 3 + 1.1) * .07 + Math.sin(a * 7 + .4) * .05 + (rnd() - .5) * .12;
    return [Math.cos(a) * k, Math.sin(a) * k * .82];
  });
  const layer = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; }, [backC, bg2] = layer(), [frontC, fg2] = layer();
  // a layer drawn with its own bloom (two blurred passes added under it)
  const bloom = (c) => {
    g.globalCompositeOperation = 'lighter';
    if (!reduce && !LOW()) { g.save(); g.filter = 'blur(6px)'; g.globalAlpha = .8; g.drawImage(c, 0, 0, W, H); g.filter = 'blur(20px)'; g.globalAlpha = .5; g.drawImage(c, 0, 0, W, H); g.restore(); }
    g.drawImage(c, 0, 0, W, H);
  };
  let closing = -1, done = false, last = 0;
  const ease = u => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  function frame(t) {
   if (done) return; last = t;
   const openK = ease(t / .7), closeK = closing < 0 ? 0 : Math.min(1, (t - closing) / .45), scale = openK * (1 - ease(closeK)), R = tearR * scale;
   if (closing >= 0 && closeK >= 1) { done = true; g.clearRect(0, 0, W, H); return; }
   g.clearRect(0, 0, W, H); if (R < 2) return;
   const tearPath = new Path2D(); edge.forEach(([x, y], i) => { const px = cx + x * R, py = cy + y * R; i ? tearPath.lineTo(px, py) : tearPath.moveTo(px, py); }); tearPath.closePath();
   g.save(); g.clip(tearPath);
   // space
   let bg = g.createRadialGradient(cx, cy, rs, cx, cy, tearR * 1.1);
   bg.addColorStop(0, '#05060f');
   bg.addColorStop(1, '#0b1026');
   g.fillStyle = bg;
   g.fillRect(0, 0, W, H);
   g.globalAlpha = .9;
   g.drawImage(neb, 0, 0);
   g.globalAlpha = 1;
   // stars, lensed: the image of each star pushed out from the hole and drawn out along the circle round it
   g.globalCompositeOperation = 'lighter'; const drift = t * .05;
   for (const s of stars) {
     const a = s.a + drift,
       r = s.r,
       rp = (r + Math.sqrt(r * r + 4 * rE * rE)) / 2,
       stretch = Math.min(9, rp / Math.max(1, r)),
       x = cx + Math.cos(a) * rp,
       y = cy + Math.sin(a) * rp * .82,
       tw = .7 + .3 * Math.sin(t * 3 + s.tw),
       al = Math.min(1, s.m * .5) * tw;
    g.strokeStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${al})`;
    g.lineWidth = s.m * .9;
    g.lineCap = 'round';
    const da = Math.min(.5, s.m * .004 * stretch * stretch);
    g.beginPath();
    g.ellipse(cx, cy, rp, rp * .82, 0, a - da, a + da);
    g.stroke();
    if (s.m > 1.6) {
      const h = g.createRadialGradient(x, y, 0, x, y, s.m * 3.2);
      h.addColorStop(0, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${al * .55})`);
      h.addColorStop(1, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},0)`);
      g.fillStyle = h;
      g.fillRect(x - s.m * 3.2, y - s.m * 3.2, s.m * 6.4, s.m * 6.4);
    }
    if (r < rE * 2.2) {
      const rn = (Math.sqrt(r * r + 4 * rE * rE) - r) / 2, xn = cx - Math.cos(a) * rn, yn = cy - Math.sin(a) * rn * .82;
      g.fillStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${al * .45})`;
      g.beginPath();
      g.arc(xn, yn, s.m * .6, 0, TAU);
      g.fill();
    } }
   // the back end's 0 and 1 falling in, stretched as they near the hole, fading into the disk
   g.font = '700 12px Consolas,"Courier New",monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
   for (const b of bits) {
     const u = (b.ph + t * .32) % 1, r = b.r0 * scale * (1 - u * u * .82), a = b.a0 + u * u * 4.2, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .82, st = 1 + (1 - r / (b.r0 * scale + 1)) * 2.4;
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2);
    g.scale(1 / Math.sqrt(st), st);
    g.globalAlpha = Math.min(1, (1 - u) * 2.2) * .85;
    g.fillStyle = b.c;
    g.font = `700 ${b.s}px Consolas,"Courier New",monospace`;
    g.fillText(b.v, 0, 0);
    g.restore();
   }
   // the disk, the lensed arches, the photon ring and the shadow, drawn on a layer and bloomed
   bg2.clearRect(0, 0, W, H); fg2.clearRect(0, 0, W, H); for (const c of [bg2, fg2]) { c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; }
   const spin = scale, put = (c, x0, y0, x1, y1, col, al, w) => {
     c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${al})`;
     c.lineWidth = w;
     c.beginPath();
     c.moveTo(x0, y0);
     c.lineTo(x1, y1);
     c.stroke();
   }, fade = closing < 0 ? 1 : 1 - closeK;
   for (const p of parts) {
     const a = p.a + t * p.w,
       rr = p.r * spin,
       a2 = a - p.len,
       x = cx + Math.cos(a) * rr,
       y = cy + Math.sin(a) * rr * COSI,
       x2 = cx + Math.cos(a2) * rr,
       y2 = cy + Math.sin(a2) * rr * COSI,
       col = tint(p.r),
       toward = Math.max(0, -Math.cos(a)),
       al = Math.min(1, p.b * (.45 + .55 * toward)) * fade;
    if (Math.sin(a) < 0) { put(bg2, x, y, x2, y2, col, al, 1.4);
     // the far half's light, bent up over the top of the shadow, and a fainter image under it
     const k = (p.r - rin) / (rout - rin), rl = (rs * 1.1 + k * rs * 1.35) * spin, th = Math.PI + (Math.cos(a) * .5 + .5) * Math.PI, th2 = th - p.len * .7;
     put(fg2, cx + Math.cos(th) * rl, cy + Math.sin(th) * rl * .96, cx + Math.cos(th2) * rl, cy + Math.sin(th2) * rl * .96, col, Math.min(1, al * 1.15), 1.7);
     put(fg2, cx + Math.cos(-th) * rl * .88, cy + Math.sin(-th) * rl * .74, cx + Math.cos(-th2) * rl * .88, cy + Math.sin(-th2) * rl * .74, col, al * .3, 1.1); }
    else put(fg2, x, y, x2, y2, col, al, 1.5); }
   fg2.strokeStyle = `rgba(255,242,215,${.95 * fade})`;
   fg2.lineWidth = 1.8;
   fg2.beginPath();
   fg2.arc(cx, cy, rs * 1.06 * spin, 0, TAU);
   fg2.stroke();
   fg2.strokeStyle = `rgba(255,200,140,${.35 * fade})`;
   fg2.lineWidth = 5;
   fg2.stroke();
   // back half (bloomed), then the shadow, truly black, then the front half, the ring and the lensed light (bloomed)
   bloom(backC); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, rs * spin, 0, TAU); g.fill(); bloom(frontC);
   g.restore();
   // the paper's torn lip: white, a little shadow cast in onto space, curls of it lifting, inked like the rest of the page
   g.save(); g.globalCompositeOperation = 'source-over'; g.save(); g.clip(tearPath); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 10; g.stroke(tearPath); g.restore();
   g.lineJoin = 'round'; g.strokeStyle = '#FAF9F5'; g.lineWidth = 5; g.stroke(tearPath); g.strokeStyle = '#141413'; g.lineWidth = 1.8; g.stroke(tearPath);
   for (let i = 0; i < edge.length; i += 6) {
     const [ex, ey] = edge[i], a = Math.atan2(ey, ex), px = cx + ex * R, py = cy + ey * R, w = 9 + (i % 5) * 2, h = 6 + (i % 3) * 3;
     g.save();
     g.translate(px, py);
     g.rotate(a - Math.PI / 2);
    g.fillStyle = 'rgba(207,194,172,.9)'; g.beginPath(); g.moveTo(-w + 2, 2); g.quadraticCurveTo(2, h + 4, w + 2, 2); g.closePath(); g.fill();
    g.fillStyle = '#EBDBBC'; g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(0, h + 2, w, 0); g.closePath(); g.fill(); g.strokeStyle = '#141413'; g.lineWidth = 1.4; g.stroke(); g.restore(); }
   g.restore();
  }
  return { frame, close: t => { if (closing < 0) closing = t; }, closeNow: () => { if (closing < 0) closing = last; }, get done() { return done; }, W, H };
 }
 // ---------------------------------------------------------------- the foil's strike: the page collapsing into one dimension
 // A blinding touch and a prism of the card's colours; then space itself is seen: a faint grid over the page that bends
 // toward the line and is drawn in as the collapse runs up and down. Behind the two fronts the page becomes one sheet of the
 // card's holographic film, its soft folds flowing into the line, colours fading through each other and light running over the
 // crests. The line is the whole world now: a white-hot core, beads of light racing both ways, lightning on it; the sheet is
 // drawn in, snaps shut with a flare, and it calms. foil(canvas, x, y, {speed, cols}) -> {frame(t), done, life}; cols: [x, css colour] samples along the line.
 // The film's colours, made once: the card's stops fading into each other around a circle, a deeper, richer version in the hollows of the folds, paler on their slopes and white only on the crests
 const FOIL_PALE = ['#FFB8DD', '#B8E6FF', '#D6FFC4', '#FFF1B8', '#DCC4FF', '#B8FFF0'], FOIL_DEEP = ['#FA6FB4', '#58AEFA', '#6FDBA6', '#FBCB55', '#A07CF7', '#4FDCCB'];
 let foilTable = null, cosTable = null;
 function foilReady() {
  if (foilTable) return;
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), round = (list, h) => {
    const u = h / 256 * 6, i = Math.floor(u), f = u - i;
    return mixc(rgb(list[i % 6]), rgb(list[(i + 1) % 6]), f * f * (3 - 2 * f));
  }, WHITE = [255, 255, 255];
  foilTable = new Uint32Array(32 * 256); cosTable = Float32Array.from({ length: 1024 }, (_, i) => Math.cos(i / 1024 * TAU));
  for (let l = 0; l < 32; l++)
    for (let h = 0; h < 256; h++) {
      const u = l / 31;
      let c = u < .66 ? mixc(round(FOIL_DEEP, h), round(FOIL_PALE, h), Math.pow(u / .66, .8)) : mixc(round(FOIL_PALE, h), WHITE, Math.pow((u - .66) / .34, 1.5));
      foilTable[l << 8 | h] = (255 << 24 | Math.round(c[2]) << 16 | Math.round(c[1]) << 8 | Math.round(c[0])) >>> 0;
    }
 }
 function foil(cv, x0, y0, { speed = 550, reduce = false, cols = [], after = null } = {}) {
  const W = innerWidth, H = innerHeight, low = LOW(), k = low ? .7 : 1;
  cv.width = Math.ceil(W * k);
  cv.height = Math.ceil(H * k);
  Object.assign(cv.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none' });
  const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.lineCap = g.lineJoin = 'round'; foilReady();
  // The foil is worked out point by point on a small canvas under this one, the way a sheet of holographic film catches light: a surface of soft folds, each point's colour set by the slope there.
  // So the colours fade into each other as they do on the card, the folds have real depth, and only the crests go white. It is all soft, so the compositor scales it up for free.
  const SC = low ? 9 : 5, FW = Math.ceil(W / SC), FH = Math.ceil(H / SC), sh = document.createElement('canvas'), o = sh.getContext('2d');
  sh.className = cv.className;
  sh.width = FW;
  sh.height = FH;
  Object.assign(sh.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none', transition: 'background-color .5s' });
  cv.parentNode?.insertBefore(sh, cv);
  const img = o.createImageData(FW, FH),
    px = new Uint32Array(img.data.buffer),
    COS = cosTable,
    TABLE = foilTable,
    warp = new Float32Array(FW),
    ripple = new Float32Array(FW),
    tint = new Float32Array(FW),
    edge = new Float32Array(FW),
    glint = new Uint8Array(FW + FH);
  let seed = 99; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647, J = n => (rnd() * 2 - 1) * n;
  const far = Math.max(y0, H - y0) + 40, D0 = .15, RUN = far / speed, END = RUN + 1.15, life = END + 1.6, MID = y0 / SC, INK = '#141413';
  const LIGHT = ['247,143,201', '134,198,247', '164,230,162', '249,213,110', '183,155,244', '125,228,210'];
  const TILE = 512, ROLL = 1010, SCALE = ROLL / TILE, SHADE = (() => {
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = 2;
    const q = c.getContext('2d'), v = q.createLinearGradient(0, 0, TILE, 0);
    [...FOIL_DEEP, FOIL_DEEP[0]].forEach((col, i) => v.addColorStop(i / 6, col));
    q.fillStyle = v;
    q.fillRect(0, 0, TILE, 2);
    return g.createPattern(c, 'repeat');
  })(), rolled = off => {
    g.setTransform(k * SCALE, 0, 0, k, -(((off % ROLL) + ROLL) % ROLL) * k, 0);
    g.strokeStyle = SHADE;
  }, flat = () => g.setTransform(k, 0, 0, k, 0, 0);
  const wob = (x, t) => Math.sin(x * .02 + t * 9) * 3 + Math.sin(x * .007 - t * 5) * 4;
  // how far the film reaches from the line: out with the fronts, then the whole sheet is drawn in and snaps shut
  const reachOf = (t, d) => t < RUN ? d : far * (1 - clamp((t - RUN - .1) / (END - RUN - .1)) ** 3);
  function film(t, E) {
   const zoom = t > RUN ? far / Math.max(E, far * .05) : 1, flow = t * 430; glint.fill(0);
   for (const [v, off, wide] of low ? [[150, 0, 34]] : [[190, 0, 30], [118, .55, 46]]) {
     const at = (t * v + off * (FW + 300)) % (FW + 300) - 150;
     for (let i = Math.max(0, Math.ceil(at - wide)), n = Math.min(glint.length - 1, at + wide); i <= n; i++) { const u = (i - at) / wide; glint[i] = Math.max(glint[i], 15 * (1 - u * u) ** 2); }
   }
   for (let c = 0; c < FW; c++) {
     const x = c * SC, dx = Math.abs(x - x0);
     warp[c] = COS[(x * .62 + t * 210) & 1023] * 240 + COS[(dx * 1.1 - t * 340) & 1023] * 120;
     ripple[c] = x * .8 - t * 300;
     tint[c] = x * .42 + t * 62;
     edge[c] = (E + wob(x, t) * Math.min(1, E / 60)) / SC;
   }
   for (let r = 0, i = 0; r < FH; r++) { const ay = Math.abs(r - MID), d = ay * SC * zoom, m = Math.pow(d, .74) * 13 + flow, hy = Math.pow(d, .8) * .9, side = r < MID ? 77 : 0, slant = r * .36;
    for (let c = 0; c < FW; c++, i++) {
      if (ay > edge[c]) { px[i] = 0; continue; }
      const n = COS[(m + warp[c]) & 1023] * .68 + COS[(m * 1.9 + ripple[c]) & 1023] * .32, hue = (tint[c] + hy + side + n * 58) & 255;
      const l = ((n + 1) * 10.5 + 5 | 0) + glint[c + slant | 0], rim = edge[c] - ay, col = TABLE[(l > 31 ? 31 : l) << 8 | hue];
      px[i] = rim < 1 ? (col & 0xFFFFFF | (rim * 255 | 0) << 24) >>> 0 : col;
    } }
   o.putImageData(img, 0, 0); }
  // the card's four-point sparkles
  const star = col => {
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    const q = c.getContext('2d'), four = s => {
      q.beginPath();
      q.moveTo(20, 20 - s);
      q.quadraticCurveTo(20 + s * .14, 20 - s * .14, 20 + s, 20);
      q.quadraticCurveTo(20 + s * .14, 20 + s * .14, 20, 20 + s);
      q.quadraticCurveTo(20 - s * .14, 20 + s * .14, 20 - s, 20);
      q.quadraticCurveTo(20 - s * .14, 20 - s * .14, 20, 20 - s);
      q.fill();
    };
    q.fillStyle = col;
    four(19);
    q.fillStyle = '#fff';
    four(9);
    return c;
  }, STARS = FOIL_DEEP.map(star);
  const orb = document.createElement('canvas');
  orb.width = orb.height = 64;
  {
    const q = orb.getContext('2d'), v = q.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [at, c] of [[0, '#fff'], [.26, 'rgba(255,255,255,.9)'], [.5, 'rgba(214,214,255,.5)'], [1, 'rgba(190,210,255,0)']]) v.addColorStop(at, c);
    q.fillStyle = v;
    q.fillRect(0, 0, 64, 64);
  }
  const fan = [...Array(low ? 18 : 28)].map((_, i, all) => {
    const half = all.length / 2, up = i < half, u = (up ? i : i - half) / (half - 1);
    return { a: (up ? -1 : 1) * Math.PI / 2 + (u - .5) * 2.4 + (rnd() - .5) * .08, c: LIGHT[i % 6], len: .6 + rnd() * .5 };
  });
  const sparks = [...Array(low ? 60 : 130)].map(() => {
    const side = rnd() < .5 ? -1 : 1, at = rnd() * far;
    return { x: rnd() * W, side, at, t0: D0 + at / speed, v: 50 + rnd() * 230, c: Math.floor(rnd() * 6), life: .45 + rnd() * .65, s: 9 + rnd() * 17 };
  });
  // light racing out along the line, each streak starting where the front took the page there
  const streaks = [...Array(low ? 70 : 150)].map(() => ({ x: rnd() * W, dy: 20 + rnd() * far, side: rnd() < .5 ? -1 : 1, dir: rnd() < .5 ? -1 : 1, len: 40 + rnd() * 190, v: 700 + rnd() * 1500 }));
  const beads = [...Array(9)].map((_, i) => ({ dir: i % 2 ? 1 : -1, ph: rnd(), v: 900 + rnd() * 1300, r: 12 + rnd() * 16 }));
  const glitch = [...Array(reduce ? 0 : low ? 14 : 40)].map(() => ({ y: rnd() * H, h: 1 + rnd() * 3.5, x: rnd() * W * .5, w: 120 + rnd() * W * .6, t0: .05 + rnd() * .7, life: .03 + rnd() * .07 }));
  let done = false, bolts = [], boltT = -1, tint0 = 0;
  function frame(t) {
   if (done) return; t = Math.max(0, t); flat(); g.clearRect(0, 0, W, H); if (t > life) { done = true; sh.remove(); return; }
   if (tint0 < (t > END ? 2 : 1)) { tint0 = t > END ? 2 : 1; sh.style.backgroundColor = tint0 < 2 ? 'rgba(104,120,235,.13)' : 'rgba(104,120,235,0)'; }
   const d = Math.max(0, t - D0) * speed, E = reachOf(t, d), cast = clamp(1 - (t - END) / .6), roll = t * 320, snap = clamp(1 - Math.abs(t - END) / .16);
   if (E > 0) film(t, E); else if (t < END + .1) o.clearRect(0, 0, FW, FH);
   // space, seen: a grid over the page not yet taken, its lines bent toward the fronts and drawn in close to them
   if (!reduce && t < RUN)
     for (const sgn of [-1, 1]) {
       const edge0 = y0 + sgn * d;
       for (let gy = y0 + sgn * 23; sgn < 0 ? gy > -46 : gy < H + 46; gy += sgn * 46) {
         const ahead = sgn * (gy - edge0);
         if (ahead < 0) continue;
         const pull = Math.exp(-ahead / 120), a = Math.min(1, t / .3) * (.12 + .62 * pull);
         g.beginPath();
         for (let x = 0; x <= W; x += 30) { const py = gy - sgn * pull * 36 + Math.sin(x * .018 + t * 7 + gy) * 5 * pull; x ? g.lineTo(x, py) : g.moveTo(x, py); }
         g.strokeStyle = `rgba(112,126,240,${a.toFixed(3)})`;
         g.lineWidth = 1.1;
         g.stroke();
         if (pull > .25) { g.strokeStyle = `rgba(226,140,214,${(a * .3).toFixed(3)})`; g.lineWidth = 5; g.stroke(); }
       }
     }
   // the touch splits the light like a prism, a fan of the card's colours thrown up and down from it
   if (t < 1) {
     const a = (1 - t) ** 2, L = Math.max(W, H) * (.25 + t * .9);
     for (const f of fan) {
       const ex = Math.cos(f.a) * L * f.len, ey = Math.sin(f.a) * L * f.len * .55, sp = .035, q = g.createLinearGradient(x0, y0, x0 + ex, y0 + ey);
       q.addColorStop(0, `rgba(${f.c},${(.72 * a).toFixed(3)})`);
       q.addColorStop(1, `rgba(${f.c},0)`);
       g.fillStyle = q;
       g.beginPath();
       g.moveTo(x0, y0);
       g.lineTo(x0 + Math.cos(f.a - sp) * L * f.len, y0 + Math.sin(f.a - sp) * L * f.len * .55);
       g.lineTo(x0 + Math.cos(f.a + sp) * L * f.len, y0 + Math.sin(f.a + sp) * L * f.len * .55);
       g.closePath();
       g.fill();
     }
   }
   // rings of flattened space running out along the line, one after another
   for (let i = 0; i < 6; i++) {
     const u = t - .08 - i * .16;
     if (u < 0 || u > 1.3) continue;
     const rx = u * W * .9, a = (1 - u / 1.3) * .75 * cast;
     g.strokeStyle = `rgba(134,178,247,${a.toFixed(3)})`;
     g.lineWidth = 2.2 - u;
     g.beginPath();
     g.ellipse(x0, y0, rx, Math.max(1, rx * .06), 0, 0, TAU);
     g.stroke();
     g.strokeStyle = `rgba(247,143,201,${(a * .7).toFixed(3)})`;
     g.lineWidth = 1;
     g.beginPath();
     g.ellipse(x0, y0, rx * .985, Math.max(1, rx * .06), 0, 0, TAU);
     g.stroke();
   }
   // the screen itself stutters for a moment as it loses a dimension
   for (const b of glitch) {
     const u = t - b.t0;
     if (u < 0 || u > b.life) continue;
     const a = .42 * (1 - u / b.life);
     for (const [c, dx] of [['247,120,190', -5], ['100,176,250', 5], ['255,255,255', 0]]) { g.fillStyle = `rgba(${c},${a.toFixed(3)})`; g.fillRect(b.x + dx, b.y, b.w, b.h); }
   }
   // the sheet's edge as it is drawn back in: the card's own ink edge
   if (t >= RUN && E > 2) {
     for (const sgn of [-1, 1]) {
       g.beginPath();
       for (let x = 0; x <= W + 30; x += 30) { const py = y0 + sgn * (E + wob(x, t) * Math.min(1, E / 60)); x ? g.lineTo(x, py) : g.moveTo(x, py); }
       g.strokeStyle = '#fff';
       g.lineWidth = 2.4;
       g.stroke();
       g.strokeStyle = INK;
       g.lineWidth = 1.2;
       g.stroke();
     }
   }
   // the page's own text, stretched flat as it goes into the line, over the foil
   after?.(g, t, k); g.lineCap = g.lineJoin = 'round';
   if (cast > 0) {
     g.globalAlpha = cast;
     g.strokeStyle = 'rgba(255,255,255,.8)';
     g.lineWidth = 1.6;
     g.beginPath();
     for (const s of streaks) {
       const tp = D0 + s.dy / speed;
       if (t < tp) continue;
       const u = t - tp, sq = Math.exp(-u * 7), xx = s.x + s.dir * s.v * u;
       if (xx < -s.len || xx > W + s.len) continue;
       const yy = y0 + s.side * (s.dy * sq + 1.2);
       g.moveTo(xx, yy);
       g.lineTo(xx - s.dir * s.len * (1.6 - sq), yy);
     }
     g.stroke();
     g.globalAlpha = 1;
   }
   // the two fronts: a curtain of light running ahead of the sheet, split into pink and blue
   if (d < far)
     for (const sgn of [-1, 1]) {
       const y = y0 + sgn * d, band = g.createLinearGradient(0, y, 0, y + sgn * 110);
       band.addColorStop(0, 'rgba(226,234,255,.8)');
       band.addColorStop(1, 'rgba(226,234,255,0)');
       g.fillStyle = band;
       g.fillRect(0, Math.min(y, y + sgn * 110), W, 110);
    for (const [col, off, w] of [['247,120,190', -3, 2], ['100,170,250', 3, 2], ['255,255,255', 0, 2.8]]) {
      g.beginPath();
      for (let x = 0; x <= W; x += 16) { const py = y + wob(x, t) + off * sgn; x ? g.lineTo(x, py) : g.moveTo(x, py); }
      g.strokeStyle = `rgba(${col},.95)`;
      g.lineWidth = w;
      g.stroke();
      g.strokeStyle = `rgba(${col},.26)`;
      g.lineWidth = w * 6;
      g.stroke();
    } }
   for (const s of sparks) {
     const u = t - s.t0;
     if (u < 0 || u > s.life) continue;
     const v = u / s.life, size = s.s * (v < .25 ? v * 4 : 1 - (v - .25) / .75), py = y0 + s.side * (s.at + s.v * u - 200 * u * u);
     if (size > 1) g.drawImage(STARS[s.c], s.x - size / 2, py - size / 2, size, size);
   }
   // the line: the whole world now. A white-hot core that trembles, the card's colours above and below it, beads racing on it, lightning crackling along it; it flares as the sheet snaps shut, then calms
   const reach = Math.min(Math.max(x0, W - x0) + 20, t * 9000),
     xa = x0 - reach,
     xb = x0 + reach,
     hot = clamp(1 - (t - END) / 1.1),
     pulse = .85 + .15 * Math.sin(t * 22),
     tremble = x => (Math.sin(x * .031 - t * 24) * 1.5 + Math.sin(x * .011 + t * 9)) * hot,
     along = off => {
     g.beginPath();
     for (let x = xa; x <= xb + 16; x += 16) { const py = y0 + off + tremble(x); x === xa ? g.moveTo(x, py) : g.lineTo(Math.min(x, xb), py); }
   };
   if (hot > 0) {
     const spread = 84 + 150 * snap, gb = g.createLinearGradient(0, y0 - spread, 0, y0 + spread);
     gb.addColorStop(0, 'rgba(226,226,255,0)');
     gb.addColorStop(.5, `rgba(240,240,255,${Math.min(1, .78 * hot * pulse + .4 * snap).toFixed(3)})`);
     gb.addColorStop(1, 'rgba(226,226,255,0)');
     g.fillStyle = gb;
     g.fillRect(xa, y0 - spread, xb - xa, spread * 2);
    for (const [off, w, a] of [[-13, 3.4, .55], [-8, 2.4, .85], [-4.5, 2, 1], [4.5, 2, 1], [8, 2.4, .85], [13, 3.4, .55]]) {
      along(off * hot);
      rolled(roll * 1.7 + off * 24);
      g.globalAlpha = a * Math.min(1, hot * 1.4);
      g.lineWidth = w;
      g.stroke();
      flat();
    }
    g.globalAlpha = 1;
    for (const [col, w] of [['rgba(170,200,255,.4)', 18 * hot + 2 + 30 * snap], ['rgba(214,228,255,.75)', 7 * hot + 1.5 + 12 * snap], ['#fff', 3 * pulse * hot + .7 + 3 * snap]]) {
      along(0);
      g.strokeStyle = col;
      g.lineWidth = w;
      g.stroke();
    }
    if (t > .3)
      for (const b of beads) {
        const bx = x0 + b.dir * (((t * b.v) / W + b.ph) % 1) * W * .9, r = b.r * hot;
        if (Math.abs(bx - x0) > reach) continue;
        g.drawImage(orb, bx - r, y0 - r, r * 2, r * 2);
        g.strokeStyle = `rgba(255,255,255,${(.7 * hot).toFixed(3)})`;
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(bx - b.dir * r * 4, y0);
        g.lineTo(bx, y0);
        g.stroke();
      } }
   if (!reduce && t < END && (boltT < 0 || t - boltT > .06)) {
     boltT = t;
     bolts = [...Array(6)].map(() => {
       const xa2 = Math.max(0, Math.min(W, x0 + (rnd() - .5) * reach * 2)), len = 80 + rnd() * 300, pts = [];
       for (let i = 0; i <= 12; i++) pts.push([xa2 + len * i / 12, y0 + J(17) * Math.sin(i / 12 * Math.PI)]);
       return pts;
     });
   }
   if (t < END)
     for (const [col, w] of [['rgba(150,180,255,.34)', 5], ['rgba(250,246,255,.96)', 1.4]]) {
       g.strokeStyle = col;
       g.lineWidth = w;
       g.beginPath();
       for (const b of bolts) b.forEach(([bx, by], i) => i ? g.lineTo(bx, by) : g.moveTo(bx, by));
       g.stroke();
     }
   // the touch: a white flash over everything, the light gathered at the point and a four-pointed flare, over all of it
   if (t < .5) {
     const a = 1 - t / .5, r = 44 + t * 280, q = g.createRadialGradient(x0, y0, 0, x0, y0, r);
     g.fillStyle = `rgba(246,246,255,${(a * a * .85).toFixed(3)})`;
     g.fillRect(0, 0, W, H);
     q.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
     q.addColorStop(.3, `rgba(255,200,232,${(a * .62).toFixed(3)})`);
     q.addColorStop(1, 'rgba(184,230,255,0)');
     g.fillStyle = q;
     g.fillRect(x0 - r, y0 - r, r * 2, r * 2);
     g.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
     g.lineWidth = 1.8;
     g.beginPath();
     g.moveTo(x0 - r * 1.6, y0);
     g.lineTo(x0 + r * 1.6, y0);
     g.moveTo(x0, y0 - r * .9);
     g.lineTo(x0, y0 + r * .9);
     g.stroke();
   }
  }
  return { frame, get done() { return done; }, life };
 }
 // ---------------------------------------------------------------- shared: smooth value noise
 const perm = (() => {
   let s = 7;
   const p = [...Array(256).keys()];
   for (let i = 255; i > 0; i--) { s = (s * 48271) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
   return [...p, ...p];
 })();
 const nz = (x, y) => {
   const xi = Math.floor(x),
     yi = Math.floor(y),
     xf = x - xi,
     yf = y - yi,
     u = xf * xf * (3 - 2 * xf),
     v = yf * yf * (3 - 2 * yf),
     h = (a, b) => perm[(perm[a & 255] + b) & 255] / 255,
     a = h(xi, yi),
     b = h(xi + 1, yi),
     c = h(xi, yi + 1),
     d = h(xi + 1, yi + 1);
   return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
 };
 const fbm = (x, y) => nz(x, y) * .55 + nz(x * 2.03, y * 2.03) * .28 + nz(x * 4.1, y * 4.1) * .17;
 const lerp = (a, b, t) => a + (b - a) * t, mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)], clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
 const sized = (cv, S, x, y) => {
   const dpr = Math.min(LOW() ? 1 : 2, root.devicePixelRatio || 1);
   cv.width = Math.ceil(S * dpr);
   cv.height = Math.ceil(S * dpr);
   Object.assign(cv.style, { position: 'absolute', left: Math.round(x - S / 2) + 'px', top: Math.round(y - S / 2) + 'px', width: S + 'px', height: S + 'px', pointerEvents: 'none' });
   return dpr;
 };
 // ---------------------------------------------------------------- the bomb's burn: a hole burnt through the page
 // Every pixel is coloured by its distance from a ragged edge: the hole itself is left open (the caller lays the back
 // end, streams of 0 and 1, under it), its walls darkening toward a thin black char; charred brown; a scorched tan halo
 // fading irregularly into the paper. The edge holds live embers that flicker and cool, and sparks fly up off the rim;
 // what stays is the burn. burn(canvas, x, y, R) -> {frame(t), done, outline} (outline: the hole, in page pixels).
 function burn(cv, x, y, R, { reduce = false, seedOff = Math.random() * 50 } = {}) {
  const S = Math.ceil(R * 4.6), dpr = sized(cv, S, x, y), N = cv.width, c = N / 2, unit = N / S, g = cv.getContext('2d');
  const edgeR = th => R * unit * (.78 + .42 * fbm(Math.cos(th) * 1.6 + seedOff, Math.sin(th) * 1.6 + seedOff));
  const img = g.createImageData(N, N), ember = g.createImageData(N, N), D = img.data, E = ember.data;
  const HOLE = [13, 9, 7], CHAR = [18, 12, 8], BROWN = [74, 42, 20], TAN = [176, 128, 74], LIGHT = [214, 182, 136];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
   const dx = i - c,
     dy = (j - c) / .9,
     r = Math.hypot(dx, dy),
     th = Math.atan2(dy, dx),
     wob = (fbm(i * .045 / unit + seedOff, j * .045 / unit) - .5) * 9 * unit,
     d = (r - edgeR(th) + wob) / unit,
     halo = 30 + 26 * fbm(Math.cos(th) * 2 + 3 + seedOff, Math.sin(th) * 2 + 3),
     k = (j * N + i) * 4;
   let col, a;
   if (d < 0) { col = HOLE; a = Math.pow(clamp(1 + d / 9), 1.6); }
   else if (d < 2.5) { col = CHAR; a = 1; }
   else if (d < 9) { col = mixc(CHAR, BROWN, (d - 2.5) / 6.5); a = 1; }
   else if (d < 9 + halo * .45) { const u = (d - 9) / (halo * .45); col = mixc(BROWN, TAN, u); a = lerp(.97, .7, u); }
   else if (d < 9 + halo) { const u = (d - 9 - halo * .45) / (halo * .55); col = mixc(TAN, LIGHT, u); a = lerp(.7, 0, Math.pow(u, .8)) * (.75 + .25 * fbm(i * .08 / unit, j * .08 / unit + 5)); }
   else { a = 0; col = LIGHT; }
   const grain = (nz(i * .5 / unit, j * .5 / unit) - .5) * 18;
   D[k] = clamp(col[0] + grain, 0, 255);
   D[k + 1] = clamp(col[1] + grain, 0, 255);
   D[k + 2] = clamp(col[2] + grain, 0, 255);
   D[k + 3] = a * 255;
   // the embers: a ragged glowing seam just outside the hole, broken where the paper has gone cold
   if (d > -1 && d < 4.5) {
     const live = fbm(Math.cos(th) * 5 + 11 + seedOff, Math.sin(th) * 5 + 11) > .42 ? 1 : 0, e = (1 - Math.abs(d - 1.6) / 3) * live;
     if (e > 0) { E[k] = 255; E[k + 1] = 120 + 110 * e; E[k + 2] = 30 + 60 * e * e; E[k + 3] = e * 255; }
   }
  }
  const burnt = document.createElement('canvas'), glow = document.createElement('canvas');
  burnt.width = glow.width = N;
  burnt.height = glow.height = N;
  burnt.getContext('2d').putImageData(img, 0, 0);
  glow.getContext('2d').putImageData(ember, 0, 0);
  let seed = 31; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const sparks = [...Array(46)].map(() => { const th = rnd() * TAU; return { th, v: 60 + rnd() * 200, up: 120 + rnd() * 260, t0: rnd() * .6, life: .6 + rnd() * .9 }; });
  let done = false; const LIFE = reduce ? .01 : 4.6;
  function frame(t) {
   if (done) return; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, N, N);
   const grow = reduce ? 1 : 1 - Math.pow(1 - clamp(t / .45), 3); g.save(); g.translate(c, c); g.scale(grow, grow); g.translate(-c, -c); g.drawImage(burnt, 0, 0);
   // the embers glow (with bloom) and cool: bright at once, flickering, gone after a few seconds
   const heat = reduce ? 0 : Math.exp(-t / 1.3) * (.85 + .15 * Math.sin(t * 23) * Math.sin(t * 7.3));
   if (heat > .01) {
     g.globalCompositeOperation = 'lighter';
     g.globalAlpha = heat;
     g.filter = `blur(${Math.round(5 * unit)}px)`;
     g.drawImage(glow, 0, 0);
     g.filter = 'none';
     g.drawImage(glow, 0, 0);
     g.globalAlpha = 1;
     g.globalCompositeOperation = 'source-over';
   }
   g.restore();
   // sparks thrown up off the rim
   if (!reduce) { g.save(); g.setTransform(unit, 0, 0, unit, 0, 0); const cc = S / 2;
    g.globalCompositeOperation = 'lighter';
    for (const s of sparks) {
      const u = t - s.t0;
      if (u < 0 || u > s.life) continue;
      const er = edgeR(s.th) / unit, px = cc + Math.cos(s.th) * (er + s.v * u * .3), py = cc + Math.sin(s.th) * er * .9 - s.up * u + 220 * u * u, a = 1 - u / s.life;
      g.fillStyle = `rgba(255,${Math.round(170 + 60 * a)},90,${a})`;
      g.beginPath();
      g.arc(px, py, 1.4, 0, TAU);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over'; g.restore(); }
   if (t > LIFE) { done = true; }
  }
  // the hole's outline a few pixels outside its edge (the char covers the margin), for the back end laid under it
  const outline = [...Array(64)].map((_, i) => { const th = i / 64 * TAU, r = edgeR(th) / unit + 7; return [x + Math.cos(th) * r, y + Math.sin(th) * r * .9]; });
  return { frame, get done() { return done; }, outline };
 }
 // ---------------------------------------------------------------- cracks: the page broken open onto the back end
 // One crack is a dark seam that tapers from where it started, a hairline of light along its upper-left lip (the broken
 // edge catching the light) and, where it is wide, a green glow from the back end showing through. crackPath walks a
 // crack out from a point (straight on the whole, small kinks); crackLine draws the first part (0..1) of one.
 function crackPath(x0, y0, a, len, rnd, wander = .5, step = 7) {
   const pts = [[x0, y0]];
   let x = x0, y = y0, d = a;
   for (let s = 0; s < len; s += step) { d += (rnd() - .5) * wander; d += (a - d) * .3; x += Math.cos(d) * step; y += Math.sin(d) * step; pts.push([x, y]); }
   return pts;
 }
 function crackLine(g, pts, w0, w1, part = 1, glow = 0) {
  const n = Math.max(1, Math.floor((pts.length - 1) * clamp(part))); if (pts.length < 2) return; g.lineCap = 'round'; g.lineJoin = 'round';
  // drawn in four lengths, each at its own width (the taper), so a crack costs a few strokes, not one per kink
  const CH = Math.max(1, Math.ceil(n / 4)), wAt = i => lerp(w0, w1, i / Math.max(1, pts.length - 2));
  const pass = (style, dx, dy, k, minW = 0) => {
    g.strokeStyle = style;
    for (let i = 0; i < n; i += CH) {
      const j = Math.min(n, i + CH), w = wAt((i + j) / 2) * k;
      if (w < minW) break;
      g.lineWidth = Math.max(.4, w);
      g.beginPath();
      g.moveTo(pts[i][0] + dx, pts[i][1] + dy);
      for (let q = i + 1; q <= j; q++) g.lineTo(pts[q][0] + dx, pts[q][1] + dy);
      g.stroke();
    }
  };
  pass('rgba(255,255,255,.85)', -.8, -.8, .55); pass('rgba(20,20,19,.92)', 0, 0, 1); if (glow > 0) pass(`rgba(150,236,140,${glow})`, 0, 0, .3, .48);
 }
 // a crack with depth: a torn wedge, opening just past its start and closing to a hair, dark inside; the wall facing the light catches it
 function crackWedge(g, pts, w0, part = 1, glow = 0) {
  const last = pts.length - 1, n = Math.min(pts.length, Math.max(2, Math.ceil(last * clamp(part)) + 1)); if (last < 1) return; const a = [], b = [];
  for (let i = 0; i < n; i++) {
    const p = pts[Math.max(0, i - 1)],
      q = pts[Math.min(last, i + 1)],
      dx = q[0] - p[0],
      dy = q[1] - p[1],
      d = Math.hypot(dx, dy) || 1,
      w = (w0 * Math.pow(1 - i / last, 1.8) * .5 + .14) * (.5 + (i * 7 % 5) * .25) * Math.min(1, (i + 1) / 3);
    a.push([pts[i][0] - dy / d * w, pts[i][1] + dx / d * w]);
    b.push([pts[i][0] + dy / d * w * .8, pts[i][1] - dx / d * w * .8]);
  }
  const gap = new Path2D(); [...a, ...b.reverse()].forEach(([x, y], i) => i ? gap.lineTo(x, y) : gap.moveTo(x, y)); gap.closePath();
  const lay = (style, dx, dy) => { g.save(); g.translate(dx, dy); g.fillStyle = style; g.fill(gap); g.restore(); };
  lay('rgba(70,78,150,.3)', -1, -1); lay('rgba(255,255,255,.96)', 1, 1); lay('rgba(10,13,22,.97)', 0, 0);
  if (glow > 0) {
    const k = Math.max(2, Math.ceil(n * .55));
    g.lineCap = 'round';
    g.strokeStyle = `rgba(150,236,140,${glow})`;
    g.lineWidth = Math.max(.5, w0 * .16);
    g.beginPath();
    for (let i = 0; i < k; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]);
    g.stroke();
  }
 }
 // ---------------------------------------------------------------- flying text
 // Every different piece of text is drawn once, upright, into one sheet. From then on a piece is a picture to turn: text at a new
 // angle is rasterised from scratch, every letter on every frame, and that was nearly all the cost of flying it on a canvas.
 // pieces: {text, font, color, h}; each gets .e, its place in the sheet.
 function textSheet(pieces, K = 1) {
  const S = Math.max(1, K), sized = new Map(), probe = document.createElement('canvas').getContext('2d'); let x = 0, y0 = 0, row = 0;
  for (const s of pieces) {
    if (!s.text) continue;
    const key = s.font + '|' + s.color + '|' + s.text;
    let e = sized.get(key);
    if (!e) {
      probe.font = s.font;
      const w = Math.ceil(probe.measureText(s.text).width * S) + 4, ht = Math.ceil(s.h * S * 1.3) + 4;
      if (x + w > 2040) { x = 0; y0 += row; row = 0; }
      e = { x, y: y0, w, h: ht, dw: w / S, dh: ht / S, font: s.font, color: s.color, text: s.text };
      x += w;
      row = Math.max(row, ht);
      sized.set(key, e);
    }
    s.e = e;
  }
  const sheet = document.createElement('canvas');
  sheet.width = 2048;
  sheet.height = Math.max(1, Math.min(4096, y0 + row + 1));
  const t = sheet.getContext('2d');
  t.textAlign = 'center';
  t.textBaseline = 'middle';
  for (const e of sized.values()) { t.font = e.font; t.fillStyle = e.color; t.setTransform(S, 0, 0, S, e.x + e.w / 2, e.y + e.h / 2); t.fillText(e.text, 0, 0); }
  return sheet;
 }
 // pieces of the page in flight, on one canvas: {cx, cy, t0, track, text, font, color, h} as for the railgun. flock(cv, pieces, {onGo, onLand}) -> {frame(t), done}
 function flock(cv, pieces, { onGo = () => {}, onLand = () => {} } = {}) {
  const W = innerWidth,
    H = innerHeight,
    K = Math.min(LOW() ? .75 : 1.5, root.devicePixelRatio || 1),
    type = textSheet(pieces, K),
    g = cv.getContext('2d'),
    order = [...pieces].sort((m, n) => m.t0 - n.t0);
  let next = 0, left = pieces.length;
  cv.width = Math.ceil(W * K); cv.height = Math.ceil(H * K); Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px' });
  function frame(t) { g.setTransform(K, 0, 0, K, 0, 0); g.clearRect(0, 0, W, H); while (next < order.length && order[next].t0 <= t) onGo(order[next++]);
   for (const s of pieces) {
     if (s.landed || t < s.t0) continue;
     const tr = s.track, n = tr.length / 3, f = Math.min(n - 1, (t - s.t0) * 30), i = Math.floor(f), j = Math.min(n - 1, i + 1), k = f - i;
     if (f >= n - 1) { s.landed = true; left--; onLand(s); continue; }
     const px = s.cx + lerp(tr[i * 3], tr[j * 3], k), py = s.cy + lerp(tr[i * 3 + 1], tr[j * 3 + 1], k), a = lerp(tr[i * 3 + 2], tr[j * 3 + 2], k), c = Math.cos(a), m = Math.sin(a), e = s.e;
     g.setTransform(K * c, K * m, -K * m, K * c, px * K, py * K);
     g.drawImage(type, e.x, e.y, e.w, e.h, -e.dw / 2, -e.dh / 2, e.dw, e.dh);
   } }
  return { frame, get done() { return left <= 0; } };
 }
 // a burst, as the house draws one: spikes in clay, gold off the line, paper at the heart, a pen coming round past its start
 // ---------------------------------------------------------------- the laser's cut
 // The cut is burnt into one still canvas a stretch at a time, so a long cut costs what a short one does: a thin dark kerf, the edge
 // of the paper catching the light, the back end's green down inside it. Over it lies the hot end: the newest of the cut still
 // hot, white to gold to clay as it cools, sparks thrown back from the beam, and a glow where it meets the paper.
 // That canvas runs only while something on it is alive. cutter(seam, fx) -> {cut(x0, y0, x1, y1), spit(x, y, n, flash), stop(), frame(now), alive}.
 function cutter(seam, fx, { reduce = false } = {}) {
  const rnd = Math.random, J = n => (rnd() * 2 - 1) * n, W = innerWidth, H = innerHeight, low = LOW(), K = Math.min(low ? 1 : 1.5, root.devicePixelRatio || 1), COOL = 1.7;
  for (const c of [seam, fx]) { c.width = Math.ceil(W * K); c.height = Math.ceil(H * K); Object.assign(c.style, { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px' }); }
  const s = seam.getContext('2d'), g = fx.getContext('2d'); s.scale(K, K); s.lineCap = g.lineCap = g.lineJoin = 'round';
  const orb = document.createElement('canvas');
  orb.width = orb.height = 96;
  {
    const q = orb.getContext('2d'), v = q.createRadialGradient(48, 48, 0, 48, 48, 48);
    for (const [at, c] of [[0, '#fff'], [.14, 'rgba(255,244,214,1)'], [.3, 'rgba(255,190,90,.75)'], [.6, 'rgba(255,120,40,.24)'], [1, 'rgba(255,100,30,0)']]) v.addColorStop(at, c);
    q.fillStyle = v;
    q.fillRect(0, 0, 96, 96);
  }
  const segs = [], sparks = [], flashes = []; let hx = 0, hy = 0, on = false, stamp = 0;
  const line = (ctx, x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const throwOut = (x, y, n, dx, dy, now) => {
    for (let i = 0; i < n; i++) {
      const v = 90 + rnd() * 300, a = Math.atan2(dy, dx) + J(.9);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60 - rnd() * 170, t0: now, life: .22 + rnd() * .42 });
    }
    if (sparks.length > 240) sparks.splice(0, sparks.length - 240);
  };
  function cut(x0, y0, x1, y1, air = false) {
    const now = performance.now() / 1000;
    if (air) { hx = x1; hy = y1; on = true; stamp = now; return; }
    const d = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / d, uy = (y1 - y0) / d, up = uy > 0 ? -1 : 1, ox = -uy * up * 1.3, oy = ux * up * 1.3;
   s.strokeStyle = 'rgba(255,255,255,.92)';
   s.lineWidth = 1;
   line(s, x0 + ox, y0 + oy, x1 + ox, y1 + oy);
   s.strokeStyle = '#0B0D15';
   s.lineWidth = 2.6;
   line(s, x0, y0, x1, y1);
   s.strokeStyle = 'rgba(134,226,126,.8)';
   s.lineWidth = .7;
   line(s, x0, y0, x1, y1);
   segs.push([x0, y0, x1, y1, now]); if (segs.length > 500) segs.shift(); if (!reduce) throwOut(x1, y1, low ? 1 : 2 + Math.min(3, d / 14 | 0), -ux, -uy, now); hx = x1; hy = y1; on = true; stamp = now; }
  function spit(x, y, n = 14, flash = 70) {
    const now = performance.now() / 1000;
    if (reduce) return;
    for (let i = 0; i < 2; i++) throwOut(x, y, n / 2, i ? 1 : -1, 0, now);
    flashes.push({ x, y, r: flash, t0: now });
  }
  function frame(nowMs) { const now = nowMs / 1000; g.setTransform(K, 0, 0, K, 0, 0); g.clearRect(0, 0, W, H);
   while (segs.length && now - segs[0][4] > COOL) segs.shift();
   if (segs.length) { g.strokeStyle = 'rgba(255,140,50,.2)'; g.lineWidth = 10; g.beginPath(); for (const p of segs) if (now - p[4] < .5) { g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); } g.stroke();
    for (const [lo, hi, col, w] of [[1.1, COOL, 'rgba(150,44,20,.5)', 1.2], [.7, 1.1, '#CC4F1C', 1.6], [.3, .7, '#FF9636', 2.2], [.1, .3, '#FFE08C', 2.6], [0, .1, '#FFFFFF', 3]]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      for (const p of segs) { const age = now - p[4]; if (age >= lo && age < hi) { g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); } }
      g.stroke();
    } }
   if (sparks.length) {
     let n = 0;
     for (const p of sparks) if (now - p.t0 < p.life) sparks[n++] = p;
     sparks.length = n;
     for (const [lo, hi, col, w] of [[0, .35, '#FFF4D8', 1.8], [.35, .7, '#FFC04C', 1.5], [.7, 1, '#EC7426', 1.2]]) {
       g.strokeStyle = col;
       g.lineWidth = w;
       g.beginPath();
       for (const p of sparks) {
         const u = now - p.t0, v = u / p.life;
         if (v < lo || v >= hi) continue;
         const b = Math.max(0, u - .02);
         g.moveTo(p.x + p.vx * u, p.y + p.vy * u + 620 * u * u);
         g.lineTo(p.x + p.vx * b, p.y + p.vy * b + 620 * b * b);
       }
       g.stroke();
     }
   }
   for (let i = flashes.length - 1; i >= 0; i--) {
     const f = flashes[i], u = (now - f.t0) / .4;
     if (u >= 1) { flashes.splice(i, 1); continue; }
     const r = f.r * (1 + u * .6);
     g.globalAlpha = 1 - u;
     g.drawImage(orb, f.x - r, f.y - r, r * 2, r * 2);
     g.globalAlpha = 1;
   }
   if (on) { if (now - stamp > .12) { g.globalAlpha = .75; } const r = 24 + J(4); g.drawImage(orb, hx - r, hy - r, r * 2, r * 2); g.globalAlpha = 1; } }
  // (a stretch of cut with no paper left on either side goes with the paper: only a hole's rim keeps its burnt edge)
  function clear(list) {
    s.save();
    s.globalCompositeOperation = 'destination-out';
    s.lineCap = 'butt';
    s.lineWidth = 7;
    s.beginPath();
    for (const [x0, y0, x1, y1] of list) { s.moveTo(x0, y0); s.lineTo(x1, y1); }
    s.stroke();
    s.restore();
  }
  return { cut, spit, clear, stop: () => { on = false; }, frame, get alive() { return on || segs.length > 0 || sparks.length > 0 || flashes.length > 0; } };
 }
 // ---------------------------------------------------------------- the laser's sheet
 // Which parts of the page the cuts have freed. Every cut goes into a coarse grid, and a flood through the paper finds the pieces, however many strokes, crossings and loops made them:
 // a loop closed on an older cut, on another stroke or on the rim of a hole frees what it holds, and so does a ring round a piece already gone. Nothing here runs on the path of a frame.
 // The page is a sheet. A piece that never reaches the screen's edge is free; of the pieces that do, the biggest is the page and the rest were cut off it, so a cut across a corner drops the corner.
 // A beam that misses an older cut or the screen's edge by a few pixels has met it, at the closest it came, unless it crossed. Each freed piece is traced round and the outline laid back
 // on the real cut, so its edge is the cut and not the grid. A freed piece is marked gone at once, so it can never drop twice.
 // cutMap(W, H) -> {line(x0, y0, x1, y1) -> true when something may have closed, end() at the end of a stroke, air(x, y), free() -> [{poly, inner, area, x, y, spots}] with .bare, the stretches with no paper left beside them}.
 function cutMap(W, H) {
  const C = Math.max(3, Math.ceil(Math.sqrt(W * H / 256000))),
    cols = Math.ceil(W / C),
    rows = Math.ceil(H / C),
    N = cols * rows,
    cw = cols + 1,
    WALL = 1,
    GONE = 2,
    GAP = 9,
    EDGE = 12,
    TURN = 90,
    MIN = Math.ceil(60 / C / C);
  const kind = new Uint8Array(N),
    by = new Int32Array(N),
    when = new Float32Array(N),
    label = new Int32Array(N),
    stack = new Int32Array(N),
    corner = new Uint8Array(cw * (rows + 1)),
    segs = [],
    step = [1, cw, -1, -cw];
  let run = 0, pass = null, crossed = false, fresh = true;
  const cellAt = (x, y) => { const u = Math.floor(x / C), v = Math.floor(y / C); return u < 0 || v < 0 || u >= cols || v >= rows ? -1 : v * cols + u; };
  const foot = (t, x, y) => {
    const ex = t[2] - t[0], ey = t[3] - t[1], k = Math.max(0, Math.min(1, ((x - t[0]) * ex + (y - t[1]) * ey) / (ex * ex + ey * ey || 1)));
    return [t[0] + k * ex, t[1] + k * ey];
  };
  const meet = (p, t) => {
    const ex = p[2] - p[0], ey = p[3] - p[1], fx = t[2] - t[0], fy = t[3] - t[1], d = ex * fy - ey * fx;
    if (Math.abs(d) < .05 * Math.hypot(ex, ey) * Math.hypot(fx, fy)) return null;
    const a = ((t[0] - p[0]) * fy - (t[1] - p[1]) * fx) / d;
    return [p[0] + a * ex, p[1] + a * ey];
  };
  // (steps shorter than a cell, so the wall has no gap: the flood moves square by square, and a wall joined only at its corners stops it)
  function wall(x0, y0, x1, y1, shown = true) {
    const i = segs.length, d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d * 1.5 / C));
    let met = false;
    segs.push([x0, y0, x1, y1, shown, false]);
   for (let k = 0; k <= n; k++) {
     const t = k / n, at = run + d * t, c = cellAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
     if (c < 0 || kind[c] === GONE) continue;
     if (!kind[c]) { kind[c] = WALL; by[c] = i; when[c] = at; }
     for (const e of [c, c - 1, c + 1, c - cols, c + cols]) if (kind[e] === WALL && at - when[e] > 14) met = true;
   }
   run += d; return met; }
  // the closest the beam came to an older cut or to the screen's edge on this pass; it is joined up when the beam leaves, unless the beam crossed
  function settle() { const p = pass; pass = null; if (!p) return false; wall(p.x, p.y, p.px, p.py, false); return true; }
  function seek(x, y) { const r = Math.ceil(GAP / C), u = Math.floor(x / C), v = Math.floor(y / C); let best = GAP * GAP, px = 0, py = 0, found = false, e = Math.min(x, y, W - x, H - y);
   for (let b = v - r; b <= v + r; b++)
     for (let a = u - r; a <= u + r; a++) {
       if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
       const c = b * cols + a;
       if (kind[c] !== WALL || run - when[c] < TURN) continue;
       const [fx, fy] = foot(segs[by[c]], x, y), d = (fx - x) ** 2 + (fy - y) ** 2;
       if (d < best) { best = d; px = fx; py = fy; found = true; }
     }
   if (e <= EDGE && (!found || Math.max(e, 0) ** 2 < best)) { best = Math.max(e, 0) ** 2; found = true; [px, py] = e === x ? [-1, y] : e === W - x ? [W + 1, y] : e === y ? [x, -1] : [x, H + 1]; }
   if (!found) { crossed = false; return settle(); } if (!crossed && (!pass || best < pass.d)) pass = { x, y, px, py, d: best }; return false; }
  function line(x0, y0, x1, y1) { if (fresh) { fresh = false; seek(x0, y0); } const met = wall(x0, y0, x1, y1); if (met) { pass = null; crossed = true; } return seek(x1, y1) || met; }
  function end() { fresh = true; crossed = false; const closed = settle(); run += TURN + 16; return closed; }
  const air = (x, y) => { const c = cellAt(x, y); return c >= 0 && (kind[c] === GONE || kind[c] === WALL && kind[c - 1] !== 0 && kind[c + 1] !== 0 && kind[c - cols] !== 0 && kind[c + cols] !== 0); };
  // an outline's corner, laid on the nearest real cut (the screen's edge is exact). [x, y, stretch]
  function fit(p) { const v = p / cw | 0, u = p % cw; let x = Math.min(W, u * C), y = Math.min(H, v * C), best = Infinity, seg = -1, ox = x, oy = y;
   for (let b = v - 2; b < v + 2; b++)
     for (let a = u - 2; a < u + 2; a++) {
       if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
       const c = b * cols + a;
       if (kind[c] !== WALL) continue;
       const [fx, fy] = foot(segs[by[c]], ox, oy), d = (fx - ox) ** 2 + (fy - oy) ** 2;
       if (d < best) { best = d; x = fx; y = fy; seg = by[c]; }
     }
   if (u <= 0) x = 0; else if (u >= cols) x = W; if (v <= 0) y = 0; else if (v >= rows) y = H; return [x, y, seg]; }
  // straight runs of the outline become one line; what is kept is still on the cut to under a pixel
  function thin(pts) {
    const n = pts.length;
    if (n < 8) return pts.map(([x, y]) => [x, y]);
    let far = 0, most = -1;
    for (let i = 1; i < n; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > most) { most = d; far = i; } }
    const keep = new Uint8Array(n), todo = [[0, far], [far, n]];
    keep[0] = keep[far] = 1;
   while (todo.length) {
     const [a, b] = todo.pop(), [ax, ay] = pts[a], [bx, by2] = pts[b % n], ex = bx - ax, ey = by2 - ay, L = ex * ex + ey * ey || 1;
     let at = -1, worst = .36;
     for (let i = a + 1; i < b; i++) {
       const k = Math.max(0, Math.min(1, ((pts[i][0] - ax) * ex + (pts[i][1] - ay) * ey) / L)), d = (ax + k * ex - pts[i][0]) ** 2 + (ay + k * ey - pts[i][1]) ** 2;
       if (d > worst) { worst = d; at = i; }
     }
     if (at >= 0) { keep[at] = 1; todo.push([a, at], [at, b]); }
   }
   const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push([pts[i][0], pts[i][1]]); return out; }
  // (the point of a thin wedge lies further on, past where the flood could fit: it counts only if the way there is all cut)
  const solid = (q, p) => { for (let k = 0; k < 4; k++) if (kind[cellAt(q[0] + (p[0] - q[0]) * k / 4, q[1] + (p[1] - q[1]) * k / 4)] !== WALL) return false; return true; };
  // round the corners of the grid the outline is laid on the cut; where it turns from one stretch to another it goes through the point the two really meet
  function lay(raw) {
    const pts = raw.map(fit), out = [];
    for (let i = 0, n = pts.length; i < n; i++) {
      const p = pts[i], t = pts[(i + 1) % n];
      out.push(p);
      if (p[2] < 0 || t[2] < 0 || p[2] === t[2]) continue;
      const q = meet(segs[p[2]], segs[t[2]]);
      if (!q) continue;
      const a = Math.hypot(q[0] - p[0], q[1] - p[1]), b = Math.hypot(q[0] - t[0], q[1] - t[1]);
      if (a < C * 2.5 && b < C * 2.5 || a < C * 12 && b < C * 12 && solid(q, p) && solid(q, t)) out.push([q[0], q[1], -1]);
    }
    return thin(out);
  }
  const size = p => { let A = 0; for (let i = 0, n = p.length; i < n; i++) { const [a, b] = p[i], [c, d] = p[(i + 1) % n]; A += a * d - c * b; } return A / 2; };
  const within = (p, x, y) => {
    let o = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) o = !o; }
    return o;
  };
  function trace({ id, cells, x0, y0, x1, y1 }) { let seen = 0, x = 0, y = 0, best = Infinity; const gap = Math.ceil(cells / 7), spots = [], mx = (x0 + x1 + 1) / 2, my = (y0 + y1 + 1) / 2;
   for (let v = y0; v <= y1; v++)
     for (let u = x0; u <= x1; u++) {
       const i = v * cols + u;
       if (label[i] !== id) continue;
       const p = v * cw + u, d = (u + .5 - mx) ** 2 + (v + .5 - my) ** 2;
       if (d < best) { best = d; x = (u + .5) * C; y = (v + .5) * C; }
       if (seen++ % gap === gap >> 1) spots.push([(u + .5) * C, (v + .5) * C]);
    if (!v || label[i - cols] !== id) corner[p] |= 1;
    if (u === cols - 1 || label[i + 1] !== id) corner[p + 1] |= 2;
    if (v === rows - 1 || label[i + cols] !== id) corner[p + cw + 1] |= 4;
    if (!u || label[i - 1] !== id) corner[p + cw] |= 8;
   }
   // the flood's edge, walked with the piece on the right hand: the outline runs clockwise, a hole inside it the other way
   const loops = [];
   for (let v = y0; v <= y1 + 1; v++)
     for (let u = x0; u <= x1 + 1; u++) {
       const p = v * cw + u;
       while (corner[p]) {
         const raw = [];
         let at = p, d = Math.log2(corner[p] & -corner[p]);
         for (;;) {
           corner[at] &= ~(1 << d);
           raw.push(at);
           at += step[d];
           const m = corner[at];
           if (!m) break;
           const r = d + 1 & 3, l = d + 3 & 3;
           d = m >> r & 1 ? r : m >> d & 1 ? d : m >> l & 1 ? l : d + 2 & 3;
         }
         loops.push(lay(raw));
       }
     }
   const ranked = loops.map(p => [size(p), p]).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])), poly = ranked[0][1], inner = [];
   // what lies in the piece: a stray cut inside it is no hole, a piece already gone or going is
   for (const [, p] of ranked.slice(1)) {
     let u0 = Infinity, v0 = Infinity, u1 = -1, v1 = -1;
     for (const [a, b] of p) { u0 = Math.min(u0, a); v0 = Math.min(v0, b); u1 = Math.max(u1, a); v1 = Math.max(v1, b); }
     u0 = Math.floor(u0 / C);
     v0 = Math.floor(v0 / C);
     u1 = Math.ceil(u1 / C);
     v1 = Math.ceil(v1 / C);
     let holds = false;
     for (let v = v0; v <= v1 && !holds; v++)
       for (let u = u0; u <= u1 && !holds; u++) { const c = v * cols + u; if (c >= 0 && c < N && kind[c] !== WALL && label[c] !== id && within(p, (u + .5) * C, (v + .5) * C)) holds = true; }
     if (holds) inner.push(p);
   }
   poly.inner = inner; return { poly, inner, area: Math.abs(ranked[0][0]) - inner.reduce((n, p) => n + Math.abs(size(p)), 0), x, y, spots }; }
  const paperBy = (x, y, ox, oy) => { for (let k = 1; k <= 3; k++) { const e = kind[cellAt(x + ox * k, y + oy * k)]; if (!e) return e === 0; if (e === GONE) return false; } return false; };
  function free() { label.fill(0); const parts = []; let id = 0;
   for (let i = 0; i < N; i++) { if (kind[i] || label[i]) continue; id++; let top = 0, cells = 0, x0 = cols, y0 = rows, x1 = 0, y1 = 0, edge = false; label[i] = id; stack[top++] = i;
    while (top) {
      const c = stack[--top], u = c % cols, v = (c - u) / cols;
      cells++;
      if (u < x0) x0 = u;
      if (u > x1) x1 = u;
      if (v < y0) y0 = v;
      if (v > y1) y1 = v;
      if (!u || !v || u === cols - 1 || v === rows - 1) edge = true;
     if (u && !kind[c - 1] && !label[c - 1]) { label[c - 1] = id; stack[top++] = c - 1; }
     if (u < cols - 1 && !kind[c + 1] && !label[c + 1]) { label[c + 1] = id; stack[top++] = c + 1; }
     if (v && !kind[c - cols] && !label[c - cols]) { label[c - cols] = id; stack[top++] = c - cols; }
     if (v < rows - 1 && !kind[c + cols] && !label[c + cols]) { label[c + cols] = id; stack[top++] = c + cols; }
    }
    parts.push({ id, cells, x0, y0, x1, y1, edge }); }
   let page = null; for (const p of parts) if (p.edge && (!page || p.cells > page.cells)) page = p;
   const going = parts.filter(p => p !== page && p.cells >= MIN), out = going.map(trace); out.bare = [];
   for (const { id: k, x0, y0, x1, y1 } of going) for (let v = y0; v <= y1; v++) for (let u = x0; u <= x1; u++) { const i = v * cols + u; if (label[i] === k) kind[i] = GONE; }
   if (going.length)
     for (const t of segs) {
       if (!t[4] || t[5]) continue;
       const L = Math.hypot(t[2] - t[0], t[3] - t[1]) || 1, mx = (t[0] + t[2]) / 2, my = (t[1] + t[3]) / 2, ox = (t[1] - t[3]) / L * C * 1.5, oy = (t[2] - t[0]) / L * C * 1.5;
       if (!paperBy(mx, my, ox, oy) && !paperBy(mx, my, -ox, -oy)) { t[5] = true; out.bare.push(t.slice(0, 4)); }
     }
   return out; }
  return { line, end, air, free, cell: C };
 }
 // ---------------------------------------------------------------- the railgun's shot
 // Everything it will need is worked out before it fires (the caller does that during the charge), so the shot itself is only
 // drawing, on one canvas: a line that charges, one shape of light from the gun to the far edge, shock rings, sparks, and every piece of the page that flies, read from
 // tracks made ahead of time. No element is added and nothing is measured while it plays. Behind the beam the page tears open
 // column by column (each column a compositor animation, so the tear costs the main thread nothing) onto a canyon of data: dark walls in ledges, lit green from below, a river of 0 and 1 along the floor,
 // cracks running out of the paper lips with 0 and 1 in them. What stays is one still picture, the river and the settled digits.
 // rail(fx, pit, hot, {mx, x1, y, hw, pieces, digits, river}) -> {frame(t), done}: fx a canvas, pit, hot and river empty boxes; t in seconds from the shot, negative while it charges.
 // pieces, rods (lengths of the page's ruled lines) and digits: {cx, cy, track, t0, ...}, track [x, y, angle, ...] at 30 steps a second.
 function rail(fx, pit, hot, { mx, x1, y, hw = 34, pieces = [], rods = [], digits = [], river = null, reduce = false, onGo = () => {}, onLand = () => {} } = {}) {
  const rnd = Math.random,
    J = n => (rnd() * 2 - 1) * n,
    W = innerWidth,
    H = innerHeight,
    low = LOW(),
    K = Math.min(low ? .75 : 1.5, root.devicePixelRatio || 1),
    dir = Math.sign(x1 - mx) || 1,
    a = Math.min(mx, x1),
    b = Math.max(mx, x1),
    L = b - a,
    V = 9000;
  const BH = Math.ceil((hw * 1.6 + 70) * 2), mid = BH / 2, STEP = 6, seed = rnd() * 90, top = [], bot = [];
  const make = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  // the valley's two lips: wide swells, torn chunks and a fine rag, narrowing to nothing at the muzzle
  for (let u = a; u <= b + STEP; u += STEP) {
    const taper = clamp(Math.abs(u - mx) / 110),
      swell = .62 + .5 * (.5 + .5 * Math.sin(u * .013 + seed)) + (fbm(u * .016, seed) - .5) * .7,
      w = hw * swell * taper + 1.2,
      rag = () => (fbm(u * .09, seed + rnd()) - .5) * 9 * taper + J(1.5) * taper;
    top.push([u, mid - w * 1.04 + rag()]);
    bot.push([u, mid + w * .92 + rag()]);
  }
  const trace = (g, p) => { g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); };
  const pair = k => {
    const n = (i, v) => (fbm(i * .11, k * 7 + seed) - .5) * 10 * (1 - k * .4) * clamp(Math.abs(v - mid) / 18),
      t = top.map(([u, v], i) => [u, mid + (v - mid) * k + n(i, v)]),
      c = bot.map(([u, v], i) => [u, mid + (v - mid) * k + n(i + 40, v)]);
    return [t, c];
  };
  const B = make(W * K, BH * K), q = B.getContext('2d'); q.scale(K, K);
  // the walls step down in ledges, near black at the bottom (blue-black, never grey)
  const wall = [[1, '#2C3244'], [.84, '#222737'], [.66, '#191D2B'], [.46, '#121520'], [.27, '#0B0D15']], ledges = [];
  for (const [k, col] of wall) {
    const [t, c] = k === 1 ? [top, bot] : pair(k);
    ledges.push([t, c, k]);
    q.fillStyle = col;
    q.beginPath();
    trace(q, [...t, ...[...c].reverse()]);
    q.closePath();
    q.fill();
  }
  q.globalCompositeOperation = 'source-atop';
  // weathering: runs down the walls, then the green of the river lighting the walls from below
  q.lineCap = 'round';
  for (let i = 0, n = L / (low ? 12 : 6); i < n; i++) {
    const u = a + rnd() * L, up = rnd() < .5, v = mid + (up ? -1 : 1) * (6 + rnd() * hw), len = 5 + rnd() * 16;
    q.strokeStyle = rnd() < .7 ? 'rgba(4,5,10,.42)' : 'rgba(150,170,214,.08)';
    q.lineWidth = .7 + rnd() * .9;
    q.beginPath();
    q.moveTo(u, v);
    q.lineTo(u + J(1.4), v + (up ? len : -len));
    q.stroke();
  }
  {
    const v = q.createLinearGradient(0, mid - hw * 1.1, 0, mid + hw * 1.1);
    v.addColorStop(0, 'rgba(127,184,110,0)');
    v.addColorStop(.5, 'rgba(127,212,120,.38)');
    v.addColorStop(1, 'rgba(127,184,110,0)');
    q.fillStyle = v;
    q.fillRect(a, mid - hw * 1.1, L, hw * 2.2);
  }
  // the back end shows through the rock in the walls: small 0 and 1, brighter down near the river
  q.font = "700 6px Consolas,'Courier New',monospace";
  q.textAlign = 'center';
  for (let i = 0, n = L / (low ? 9 : 4); i < n; i++) {
    const k = rnd(), u = a + rnd() * L, v = mid + (rnd() < .5 ? -1 : 1) * (5 + k * hw * .9);
    q.fillStyle = `rgba(127,184,110,${(.6 - k * .44).toFixed(2)})`;
    q.fillText(rnd() < .5 ? '0' : '1', u, v);
  }
  for (const [t, c, k] of ledges.slice(1)) {
    q.strokeStyle = `rgba(150,226,140,${(.52 - k * .46).toFixed(2)})`;
    q.lineWidth = .9;
    q.beginPath();
    trace(q, t);
    q.stroke();
    q.strokeStyle = `rgba(150,226,140,${(.34 - k * .3).toFixed(2)})`;
    q.beginPath();
    trace(q, c);
    q.stroke();
  }
  q.globalCompositeOperation = 'source-over';
  // cracks run out of the paper, with 0 and 1 running along them
  q.font = "700 6px Consolas,'Courier New',monospace";
  for (let i = 0, n = low ? 12 : 22; i < n; i++) {
    const pts = i % 2 ? bot : top,
      p = pts[6 + Math.floor(rnd() * (pts.length - 12))],
      side = i % 2 ? 1 : -1,
      len = 22 + rnd() * rnd() * 74,
      path = crackPath(p[0], p[1], side * Math.PI / 2 + J(.62), len, rnd, .6, 6);
    crackWedge(q, path, 3 + rnd() * 2.4, 1, .55);
   for (let s = 1; s < path.length - 1; s++) {
     if (rnd() < .3) continue;
     const [x0, y0] = path[s], [x2, y2] = path[s + 1];
     q.save();
     q.translate(x0 + side * 3.4, y0);
     q.rotate(Math.atan2(y2 - y0, x2 - x0));
     q.fillStyle = `rgba(94,142,84,${(.95 - s / path.length * .6).toFixed(2)})`;
     q.fillText(rnd() < .5 ? '0' : '1', 0, 2);
     q.restore();
   } }
  // the torn paper: its thickness catches the light, a clean lip and no halo round it
  for (const [p, s] of [[top, -1], [bot, 1]]) {
    const out = p.map(([u, v]) => [u + 1.4, v + s * (2.6 + rnd() * 2.6)]);
    q.fillStyle = '#E3DACC';
    q.beginPath();
    trace(q, [...out, ...[...p].reverse()]);
    q.closePath();
    q.fill();
    q.strokeStyle = '#141413';
    q.lineWidth = 2.3;
    q.lineCap = 'round';
    q.lineJoin = 'round';
    q.beginPath();
    trace(q, p);
    q.stroke();
  }
  // the lips stay hot for a moment after the shot, white to gold; this layer fades on its own and is gone
  const heat = make(W * K, BH * K);
  {
    const g = heat.getContext('2d');
    g.scale(K, K);
    g.lineJoin = 'round';
    for (const [w, style] of [[7, 'rgba(255,150,50,.2)'], [3.4, 'rgba(255,190,90,.55)'], [1.3, '#FFF3CF']]) {
      g.strokeStyle = style;
      g.lineWidth = w;
      g.beginPath();
      trace(g, top);
      trace(g, bot);
      g.stroke();
    }
  }
  // both are cut into columns: each opens with its own small delay behind the shot
  const CW = low ? 96 : 64, cut = (box, src) => {
    Object.assign(box.style, { position: 'absolute', left: '0', top: Math.round(y - mid) + 'px', width: W + 'px', height: BH + 'px' });
    const out = [];
    for (let u = a; u < b; u += CW) {
      const sx = Math.max(0, Math.floor(u * K)), sw = Math.min(src.width - sx, Math.ceil(CW * K) + 1);
      if (sw <= 0) continue;
      const c = make(sw, src.height);
      c.getContext('2d').drawImage(src, -sx, 0);
      Object.assign(c.style, { position: 'absolute', left: sx / K + 'px', top: '0', width: sw / K + 'px', height: BH + 'px' });
      if (!reduce) c.style.transform = 'scaleY(0)';
      box.append(c);
      out.push(c);
    }
    return out;
  }, columns = [...cut(pit, B), ...(reduce ? [] : cut(hot, heat))];
  const OPEN = [...Array(15)].map((_, i) => ({ transform: i === 14 ? 'none' : `scaleY(${(1 - Math.exp(-.455 * i) * Math.cos(.65 * i)).toFixed(3)})` }));
  // a river of 0 and 1: three strips that repeat, moved by the compositor and cut to the floor of the valley
  if (river) {
    const period = 216, floor = pair(.34), keep = pts => pts.filter((_, i) => i % 3 === 0).map(([u, v]) => `${Math.round(u)}px ${Math.round(v * 10) / 10}px`);
    Object.assign(river.style, {
      position: 'absolute',
      left: '0',
      top: Math.round(y - mid) + 'px',
      width: W + 'px',
      height: BH + 'px',
      clipPath: `polygon(${[...keep(floor[0]), ...keep(floor[1]).reverse()].join(',')})`
    });
   [[-8.6, 1.5, '#7FB86E', .72, 6.6], [0, 1.05, '#C9F0B4', 1, 7.4], [8.6, 2, '#7FB86E', .72, 6.6]].forEach(([dy, dur, col, alpha, size]) => {
     const s = Math.max(1, K), c = make((W + period) * s, 14 * s), g = c.getContext('2d');
     g.scale(s, s);
     g.font = `700 ${size}px Consolas,'Courier New',monospace`;
     g.fillStyle = col;
     g.textBaseline = 'middle';
     const cells = 50, row = [...Array(cells)].map(() => rnd() < .5 ? '0' : '1');
     for (let i = 0, n = Math.ceil((W + period) / (period / cells)); i < n; i++) g.fillText(row[i % cells], i * period / cells, 7);
    Object.assign(c.style, {
      position: 'absolute',
      left: -period + 'px',
      top: Math.round(mid + dy - 7) + 'px',
      width: W + period + 'px',
      height: '14px',
      opacity: alpha,
      animation: `chb-river ${dur * 5}s linear infinite`,
      animationDirection: dir > 0 ? 'normal' : 'reverse'
    });
    river.append(c);
   }); }
  // light, drawn once: the shot's cross-section, white at its heart and saturated out to its edge so it shows on white paper, and a round glow
  const strip = make(2, 96);
  {
    const g = strip.getContext('2d'), v = g.createLinearGradient(0, 0, 0, 96);
    for (const [s, c] of [[0, 'rgba(255,110,36,0)'], [.14, 'rgba(255,118,36,.3)'], [.3, 'rgba(255,140,40,.86)'], [.4, 'rgba(255,190,70,1)'], [.46, 'rgba(255,238,180,1)'], [.5, '#fff'], [.54, 'rgba(255,238,180,1)'], [.6, 'rgba(255,190,70,1)'], [.7, 'rgba(255,140,40,.86)'], [.86, 'rgba(255,118,36,.3)'], [1, 'rgba(255,110,36,0)']])
      v.addColorStop(s, c);
    g.fillStyle = v;
    g.fillRect(0, 0, 2, 96);
  }
  const orb = make(128, 128);
  {
    const g = orb.getContext('2d'), v = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [s, c] of [[0, '#fff'], [.16, 'rgba(255,240,200,1)'], [.34, 'rgba(255,190,90,.8)'], [.6, 'rgba(255,130,40,.28)'], [1, 'rgba(255,110,30,0)']]) v.addColorStop(s, c);
    g.fillStyle = v;
    g.fillRect(0, 0, 128, 128);
  }
  const glyph = (ch, col) => {
    const c = make(40, 40), g = c.getContext('2d');
    g.font = "700 28px Consolas,'Courier New',monospace";
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(127,184,110,.9)';
    g.shadowBlur = 9;
    g.fillStyle = col;
    g.fillText(ch, 20, 21);
    return c;
  }, GL = { 0: [glyph('0', '#7FB86E'), glyph('0', '#B7E4A0')], 1: [glyph('1', '#7FB86E'), glyph('1', '#B7E4A0')] };
  const type = textSheet(pieces, K);
  fx.width = Math.ceil(W * K); fx.height = Math.ceil(H * K); Object.assign(fx.style, { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px' });
  const g = fx.getContext('2d');
  const rings = [...Array(low ? 7 : 12)].map((_, i, all) => ({ u: mx + dir * L * Math.pow((i + .6) / all.length, 1.2), r: 40 + rnd() * 26, hand: [...Array(16)].map(() => 1 + J(.09)) }));
  const sparks = [...Array(low ? 80 : 190)].map(() => {
    const u = rnd(), side = rnd() < .5 ? -1 : 1, near = rnd() < .22;
    return {
      x: mx + dir * L * u,
      y: y + J(6),
      t0: u * L / V + rnd() * .03,
      vx: dir * (near ? 300 + rnd() * 900 : 120 + rnd() * 760),
      vy: side * (70 + rnd() * rnd() * 720),
      life: .22 + rnd() * .6,
      c: rnd()
    };
  });
  const embers = [...Array(low ? 28 : 74)].map(() => {
    const side = rnd() < .5 ? top : bot, q2 = side[Math.floor(rnd() * side.length)];
    return { x: q2[0], y: q2[1] + y - mid, t0: .3 + rnd() * 1.1, life: .7 + rnd() * 1.1, up: 26 + rnd() * 72, ph: rnd() * 6, r: .7 + rnd() * .9 };
  });
  const motes = [...Array(low ? 18 : 44)].map(() => ({ a: rnd() * TAU, d: 60 + rnd() * 120, t0: rnd() * .46, life: .22 + rnd() * .22 }));
  const order = [...pieces].sort((m, n) => m.t0 - n.t0); let nextUp = 0, fired = false, done = false;
  const lastT = Math.max(2.2, ...[...pieces, ...digits, ...rods].map(s => s.t0 + s.track.length / 3 / 30));
  // a piece at its moment: its track read between two steps
  const pose = (s, t, out) => {
    const tr = s.track, n = tr.length / 3, f = Math.min(n - 1, Math.max(0, (t - s.t0) * 30)), i = Math.floor(f), j = Math.min(n - 1, i + 1), k = f - i;
    out[0] = s.cx + lerp(tr[i * 3], tr[j * 3], k);
    out[1] = s.cy + lerp(tr[i * 3 + 1], tr[j * 3 + 1], k);
    out[2] = lerp(tr[i * 3 + 2], tr[j * 3 + 2], k);
    return f >= n - 1;
  }, at3 = [0, 0, 0];
  const sight = new Path2D();
  { let px = a; sight.moveTo(px, y); while (px < b) { px += 60 + rnd() * 50; sight.quadraticCurveTo(px - 30, y + J(1.4), px, y + J(.9)); if (rnd() < .3) { px += 7; sight.moveTo(px, y + J(.8)); } } }
  // The whole shot is one shape of light: one cross-section carried from the gun to its point, wide at the muzzle, thin along the page, opening where it leaves it.
  // Nothing joins anything, so there is nowhere for a flash and a beam to meet, and the glow over each end is soft enough to belong to it.
  function bolt(t, reach, w) {
    const arrive = L / V,
      late = t - arrive,
      muzzle = 64 * Math.min(1, t / .05) * Math.max(0, 1 - (t / .3) ** 2),
      mouth = late > 0 ? 124 * Math.min(1, late / .06) * Math.max(0, 1 - (late / .32) ** 2) : 0,
      flying = t < arrive;
   const half = d => {
     const v = d / 250,
       far = (L - d) / 340,
       left = reach - d,
       bump = v < 1 ? Math.sin(Math.PI * Math.pow(v, .55)) ** 1.5 : 0,
       open = far < 1 ? (1 - far) ** 2.6 : 0,
       slug = flying ? 11 * Math.exp(-((left - 70) ** 2) / 1600) : 0,
       point = flying ? Math.pow(Math.min(1, left / 150), .7) : 1;
     return (w / 2 + muzzle * bump + mouth * open + slug) * point * (1 + (fbm(d * .014 + t * 7, seed) - .5) * .34);
   };
   for (let d = 0, step; d < reach; d += step) {
     const busy = d < 300 || L - d < 420 || reach - d < 170;
     step = Math.min(low ? (busy ? 10 : 40) : busy ? 5 : 24, reach - d);
     const h = half(d + step / 2) * 1.7, e0 = Math.round((mx + dir * d) * K), e1 = Math.round((mx + dir * (d + step)) * K);
     if (e0 !== e1) g.drawImage(strip, .5, 0, 1, 96, Math.min(e0, e1) / K, y - h, Math.abs(e1 - e0) / K, h * 2);
   } }
  function charge(t) { const T = -t, u = clamp(1 - T / .6); if (u <= 0) return; const shut = T < .1 ? T / .1 : 1, flick = .7 + .3 * Math.sin(t * 92);
   g.globalAlpha = u * u * .85 * flick;
   g.drawImage(strip, a, y - 4, L, 8);
   g.globalAlpha = u * u * shut;
   g.lineCap = 'round';
   g.strokeStyle = '#FFF4D6';
   g.lineWidth = 1.2;
   g.stroke(sight);
   g.globalAlpha = 1;
   // motes drawn into the muzzle
   g.strokeStyle = '#FFC862';
   g.lineWidth = 1.8;
   g.beginPath();
   for (const m of motes) {
     const v = (u * .6 - m.t0) / m.life;
     if (v < 0) continue;
     const w = v % 1, d = m.d * (1 - w * w), d2 = m.d * (1 - Math.min(1, w + .12) ** 2);
     g.moveTo(mx + Math.cos(m.a) * d, y + Math.sin(m.a) * d);
     g.lineTo(mx + Math.cos(m.a) * d2, y + Math.sin(m.a) * d2);
   }
   g.stroke();
   // arcs that jump off the muzzle, harder as it fills
   g.strokeStyle = 'rgba(255,214,130,.9)';
   g.lineWidth = 1.2;
   g.beginPath();
   for (let i = 0, n = 2 + Math.round(u * 4); i < n; i++) {
     const an = rnd() * TAU, len = 24 + u * 62 * rnd();
     g.moveTo(mx, y);
     for (let s = 1; s <= 5; s++) g.lineTo(mx + Math.cos(an) * len * s / 5 + J(5), y + Math.sin(an) * len * s / 5 + J(5));
   }
   g.stroke();
   const r = (16 + 46 * u * u) * shut + 7 * (1 - shut) + J(1.5); g.globalAlpha = .55 + .45 * u; g.drawImage(orb, mx - r, y - r, r * 2, r * 2); g.globalAlpha = 1; }
  function shot(t) { const reach = Math.min(L, t * V), arrive = L / V, w = (6 + 44 * Math.exp(-t * 11)) * clamp(1 - (t - .2) / .3);
   // shock rings left along the line, the wake of something far too fast for the air
   g.strokeStyle = '#FFB14E';
   for (const r of rings) {
     const u = (t - Math.abs(r.u - mx) / V) / .44;
     if (u <= 0 || u >= 1) continue;
     const e = 1 - (1 - u) ** 3, rx = 2.5 + 15 * e, ry = 6 + r.r * 1.4 * e;
     g.globalAlpha = (1 - u) * .85;
     g.lineWidth = .6 + 2.4 * (1 - u);
     g.beginPath();
     r.hand.forEach((k, i) => { const an = i / 16 * TAU, px = r.u + Math.cos(an) * rx * k, py = y + Math.sin(an) * ry * k; i ? g.lineTo(px, py) : g.moveTo(px, py); });
     g.closePath();
     g.stroke();
   }
   g.globalAlpha = 1;
   // sparks, three heats in three passes
   g.lineCap = 'round';
   for (const [lo, hi, col, wd] of [[0, .3, '#FFF6DE', 2], [.3, .62, '#FFC24E', 1.6], [.62, 1.01, '#EE7A2A', 1.3]]) {
     g.strokeStyle = col;
     g.lineWidth = wd;
     g.beginPath();
     for (const s of sparks) {
       const u = t - s.t0, v = u / s.life;
       if (u <= 0 || v >= 1 || v < lo || v >= hi) continue;
       const b2 = u - .016;
       g.moveTo(s.x + s.vx * u, s.y + s.vy * u + 700 * u * u);
       g.lineTo(s.x + s.vx * b2, s.y + s.vy * b2 + 700 * b2 * b2);
     }
     g.stroke();
   }
   g.fillStyle = '#FFD27A';
   for (const e of embers) {
     const u = t - e.t0, v = u / e.life;
     if (u <= 0 || v >= 1) continue;
     g.globalAlpha = v < .15 ? v / .15 : 1 - (v - .15) / .85;
     g.beginPath();
     g.arc(e.x + Math.sin(u * 3 + e.ph) * 7, e.y - e.up * u, e.r, 0, TAU);
     g.fill();
   }
   g.globalAlpha = 1;
   if (w > .4 || t < .5) bolt(t, reach, w);
   { const r = 170 * Math.exp(-t * 8); if (r > 6) { g.globalAlpha = Math.min(1, r / 90) * .85; g.drawImage(orb, mx - r, y - r, r * 2, r * 2); g.globalAlpha = 1; } }
   { const u = t - arrive; if (u > 0) { const r = 250 * Math.exp(-u * 6); if (r > 8) { g.globalAlpha = Math.min(1, r / 90) * .9; g.drawImage(orb, x1 - r, y - r, r * 2, r * 2); g.globalAlpha = 1; } } } }
  function drawDigits(t) {
    for (const d of digits) {
      if (t < d.t0) continue;
      pose(d, t, at3);
      const c = Math.cos(at3[2]), n = Math.sin(at3[2]);
      g.setTransform(K * c, K * n, -K * n, K * c, at3[0] * K, at3[1] * K);
      g.drawImage(GL[d.v][d.c], -d.s, -d.s, d.s * 2, d.s * 2);
    }
    g.setTransform(K, 0, 0, K, 0, 0);
  }
  function drawRods(t) {
    for (const d of rods) {
      pose(d, t, at3);
      const c = Math.cos(at3[2]), n = Math.sin(at3[2]);
      g.setTransform(K * c, K * n, -K * n, K * c, at3[0] * K, at3[1] * K);
      g.fillStyle = d.color;
      g.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
    }
    g.setTransform(K, 0, 0, K, 0, 0);
  }
  function drawPieces(t) {
    for (const s of pieces) {
      if (s.landed || t < s.t0) continue;
      if (pose(s, t, at3)) { s.landed = true; onLand(s); continue; }
      const c = Math.cos(at3[2]), n = Math.sin(at3[2]), e = s.e;
      g.setTransform(K * c, K * n, -K * n, K * c, at3[0] * K, at3[1] * K);
      g.drawImage(type, e.x, e.y, e.w, e.h, -e.dw / 2, -e.dh / 2, e.dw, e.dh);
    }
    g.setTransform(K, 0, 0, K, 0, 0);
  }
  function frame(t) {
   if (done || t < -.6) return; g.setTransform(K, 0, 0, K, 0, 0); g.clearRect(0, 0, W, H); if (t < 0) { charge(t); return; }
   if (!fired) {
     fired = true;
     for (const c of columns) { c.animate(OPEN, { duration: 910, delay: 12 + Math.abs(parseFloat(c.style.left) + parseFloat(c.style.width) / 2 - mx) / V * 1000, fill: 'both' }); c.style.transform = ''; }
     hot.animate([{ opacity: 1 }, { opacity: 1, offset: .2 }, { opacity: 0 }], { duration: 2400, fill: 'forwards' }).onfinish = () => hot.remove();
   }
   while (nextUp < order.length && order[nextUp].t0 <= t) onGo(order[nextUp++]);
   drawRods(t); drawPieces(t); drawDigits(t); shot(t);
   if (t >= lastT) { g.clearRect(0, 0, W, H); drawRods(lastT + 9); drawDigits(lastT + 9); for (const s of order) { if (!s.landed) { s.landed = true; onLand(s); } } done = true; }
  }
  if (reduce) { hot.remove(); done = true; }
  return { frame, get done() { return done; } };
 }
 // ---------------------------------------------------------------- the black hole, opened in the page: it pulls, the page breaks in
 // It starts behind the page, seen only through the opening it makes, and grows there until it is large, its pull weak at first. The energy
 // climbs exponentially: light runs out along the cracks, the disk spins up and burns hotter, the page darkens and the jolts come closer and
 // closer; then it bursts out through the page: a white flash, shock rings over the whole screen, jets from both poles, and it hangs in front
 // of everything against black space, the whole page blown outward and then torn in (POP, in the hole's own clock). It only ever grows.
 // It appears as a point and grows. Its pull reaches further and further: cracks run out across the page from it, joined
 // into a web by rings; the pieces between them come loose, nearest first, lift and are dragged in on spirals, drawn out
 // as they fall; behind them is the back end, dark, its 0 and 1 streaming into the hole, and the hole itself (a true
 // black shadow, a blazing photon ring, an orbiting disk whose far side is lensed over the top, with bloom). Closing,
 // everything falls in. Full screen. hole(canvas, x, y, {paper}) -> {frame(t), close(t), closeNow(), done, timeAt(d),
 // reachMax}: timeAt(d) is when its pull reaches a point d px away (for the caller's letters).
 function hole(cv, x, y, { reduce = false, paper = '#FFFFFF', dark = null, after = null } = {}) {
  const SLOW = 2;   // the whole thing runs this much slower than the times written below
  const W = innerWidth, H = innerHeight, K = Math.min(LOW() ? .75 : 1.25, root.devicePixelRatio || 1);
  cv.width = Math.ceil(W * K);
  cv.height = Math.ceil(H * K);
  Object.assign(cv.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none' });
  const g = cv.getContext('2d');
  const KD = K / 2;
  if (dark) {
    dark.width = Math.ceil(W * KD);
    dark.height = Math.ceil(H * KD);
    Object.assign(dark.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none' });
  }
  const gd = dark?.getContext('2d');
  let seed = 5150; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const far = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)),
    Rmax = Math.min(far * 1.05, Math.max(W, H) * .85),
    rsMax = clamp(Math.min(W, H) * .1, 44, 96),
    r0 = 10,
    GROW = 4.2;
  const HALO = document.createElement('canvas');
  HALO.width = HALO.height = 160;
  {
    const q = HALO.getContext('2d'), v = q.createRadialGradient(80, 80, 15, 80, 80, 80);
    v.addColorStop(0, 'rgba(0,0,0,.96)');
    v.addColorStop(.46, 'rgba(0,0,0,.62)');
    v.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = v;
    q.fillRect(0, 0, 160, 160);
  }
  const POP = 3.1, EARLY = .7, AFTER = .55;   // (EARLY: the share of its reach it has before it pops; AFTER: how long the rest takes)
  const CHARGE = 1.9,
    EK = 5.4,
    energy = t => reduce ? 0 : (Math.exp(EK * clamp((t - CHARGE) / (POP - CHARGE))) - 1) / (Math.exp(EK) - 1),
    spinOf = t => t < POP ? t + 1.5 * energy(t) : POP + 1.5 + (t - POP) * 1.7 + .6 * (1 - Math.exp(-(t - POP) * 7));   // (CHARGE: when the climb starts; EK: how steep)
  const front = t => t < POP ? Rmax * EARLY * Math.pow(clamp((t - .25) / (POP - .25)), 1.15) : Rmax * (EARLY + (1 - EARLY) * (1 - Math.pow(1 - clamp((t - POP) / AFTER), 3))), when = r => {
    const k = clamp(r / Rmax);
    return k < EARLY ? .25 + (POP - .25) * Math.pow(k / EARLY, .87) : POP + AFTER * (1 - Math.cbrt(1 - (k - EARLY) / (1 - EARLY)));
  };
  const RS0 = 3.5, BEHIND = rsMax * .8, OUT = rsMax * 1.6, GK = Math.log(BEHIND / RS0) / POP * 1.15, small = t => {
    const e = RS0 * Math.exp(GK * t);
    return e * BEHIND / Math.cbrt(e * e * e + BEHIND * BEHIND * BEHIND);
  }, rsAt = t => t < POP ? small(t) * (1 + .22 * energy(t)) : lerp(small(POP) * 1.22, OUT, 1 - Math.exp(-(t - POP) * 16)) + (t - POP) * rsMax * .05, ease3 = u => 1 - Math.pow(1 - clamp(u), 3);
  const edgeCol = (() => {
    const m = String(paper).match(/\d+(\.\d+)?/g), [r, gg, b] = m && m.length >= 3 ? m.slice(0, 3).map(Number) : [250, 249, 245];
    return `rgb(${r * .82 | 0},${gg * .82 | 0},${b * .82 | 0})`;
  })();
  // the cracks: radials out from the hole, nearly straight with small kinks; each point knows its distance from the hole
  const NR = 11 + Math.floor(rnd() * 5), rad = [...Array(NR)].map((_, i) => {
    const a = (i + (rnd() - .5) * .8) / NR * TAU, len = Rmax * (.45 + .55 * rnd()), pts = [];
    let d = a, px = x + Math.cos(a) * r0, py = y + Math.sin(a) * r0;
    pts.push([px, py, r0]);
   while (pts[pts.length - 1][2] < len && pts.length < 400) { d += (rnd() - .5) * .32; d += (a - d) * .3; px += Math.cos(d) * 12; py += Math.sin(d) * 12; pts.push([px, py, Math.hypot(px - x, py - y)]); }
   return { a, pts, len };
  });
  const at = (R, r) => {
    const p = R.pts;
    for (let i = 1; i < p.length; i++) if (p[i][2] >= r) { const u = (r - p[i - 1][2]) / Math.max(1e-6, p[i][2] - p[i - 1][2]); return [lerp(p[i - 1][0], p[i][0], u), lerp(p[i - 1][1], p[i][1], u), i]; }
    return null;
  };
  const between = (R, r1, r2) => { const a = at(R, r1), b = at(R, r2); if (!a || !b) return null; return [[a[0], a[1]], ...R.pts.slice(a[2], b[2]).map(q => [q[0], q[1]]), [b[0], b[1]]]; };
  const branches = [];
  for (const R of rad)
    for (let i = 4; i < R.pts.length - 4; i++)
      if (rnd() < .035) {
        const [px, py, pr] = R.pts[i], side = rnd() < .5 ? -1 : 1;
        branches.push({ pts: crackPath(px, py, R.a + side * (.5 + rnd() * .4), Math.min(160, Rmax * (.08 + rnd() * .14)), rnd, .22, 10), t0: when(pr) + .05 });
      }
  // rings join neighbouring radials into a web: kinked chords, each appearing once the cracks have run past it
  const RING = [r0, ...[.1, .19, .3, .43, .58, .76].map(f => Rmax * f)], seg = [];
  for (let k = 0; k < RING.length; k++) { seg[k] = []; for (let i = 0; i < NR; i++) { const A = rad[i], B = rad[(i + 1) % NR], rk = k ? RING[k] * (1 + (rnd() - .5) * .36) : r0;
   if (k && (A.len < rk || B.len < rk || rnd() > (k < 3 ? .9 : k < 5 ? .68 : .42))) { seg[k][i] = null; continue; }
   const p = at(A, rk), q = at(B, rk); if (!p || !q) { seg[k][i] = null; continue; }
   let pts; if (k) pts = [[p[0], p[1]], [(p[0] + q[0]) / 2 + (rnd() - .5) * rk * .16, (p[1] + q[1]) / 2 + (rnd() - .5) * rk * .16], [q[0], q[1]]];
   else {
     pts = [];
     const a0 = Math.atan2(p[1] - y, p[0] - x);
     let a1 = Math.atan2(q[1] - y, q[0] - x);
     if (a1 < a0) a1 += TAU;
     for (let s = 0; s <= 6; s++) { const aa = lerp(a0, a1, s / 6); pts.push([x + Math.cos(aa) * r0, y + Math.sin(aa) * r0]); }
   }
   seg[k][i] = { pts, r: rk, t0: k ? when(rk) + .1 + rnd() * .35 : 0 }; } }
  // the pieces of page between them; the near ones all come away, a few further out, never the outermost
  const cells = new Map(); for (let k = 1; k < RING.length; k++) for (let i = 0; i < NR; i++) { const lo = seg[k - 1][i], hi = seg[k][i]; if (!lo || !hi) continue;
   const sideA = between(rad[i], lo.r, hi.r), sideB = between(rad[(i + 1) % NR], lo.r, hi.r); if (!sideA || !sideB) continue;
   const poly = [...lo.pts, ...sideB.slice(1), ...hi.pts.slice().reverse().slice(1), ...sideA.slice().reverse().slice(1, -1)];
   let cx = 0, cy = 0; for (const [a, b] of poly) { cx += a; cy += b; } cx /= poly.length; cy /= poly.length;
   let go = k <= 3 || (k === 4 && rnd() < .55) ? Math.max(lo.t0, hi.t0) + .2 + rnd() * .5 + k * .12 : Infinity; if (go > 4.4) go = Infinity;
   cells.set(k +
     ',' +
     i, { k, i, poly, cx, cy, go, rIn: lo.r, rOut: hi.r, lo: lo.pts, hi: hi.pts, sideA, sideB, fall: .55 + rnd() * .3, turn: (1.2 + rnd() * .9) * (rnd() < .5 ? -1 : 1), spin: (rnd() - .5) * 7 }); }
  const cellAt = (k, i) => cells.get(k + ',' + i), list = [...cells.values()].sort((a, b) => a.go - b.go);
  // light from all over the page, caught and drawn in on spirals
  const rays = [...Array(reduce ? 0 : LOW() ? 60 : 170)].map(() =>
    ({ r0: Rmax * (.25 + .9 * rnd()), a0: rnd() * TAU, ph: rnd(), sp: .18 + rnd() * .16, w: .5 + rnd() * 1.1, c: rnd() < .5 ? '255,244,220' : rnd() < .5 ? '210,226,255' : '255,214,160' }));
  let dim = 0;
  // the burst's light, made once: a long soft spoke, the jet that leaves the poles, and the open space it leaves behind (made when the climb nears)
  const sprite = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; };
  const SPOKE = sprite(256, 32, (q, w, h) => {
    const a = q.createLinearGradient(0, 0, w, 0), b = q.createLinearGradient(0, 0, 0, h);
    a.addColorStop(0, 'rgba(255,246,226,1)');
    a.addColorStop(.35, 'rgba(255,214,150,.55)');
    a.addColorStop(1, 'rgba(255,170,90,0)');
    q.fillStyle = a;
    q.fillRect(0, 0, w, h);
    b.addColorStop(0, 'rgba(0,0,0,0)');
    b.addColorStop(.5, '#000');
    b.addColorStop(1, 'rgba(0,0,0,0)');
    q.globalCompositeOperation = 'destination-in';
    q.fillStyle = b;
    q.fillRect(0, 0, w, h);
  });
  const JET = sprite(1024, 96, (q, w, h) => {
    const c = sprite(2, 64, (s2, a, b) => {
      const v = s2.createLinearGradient(0, 0, 0, b);
      for (const [at, col] of [[0, 'rgba(90,110,255,0)'], [.2, 'rgba(110,130,255,.35)'], [.38, 'rgba(170,190,255,.9)'], [.47, 'rgba(236,240,255,1)'], [.5, '#fff'], [.53, 'rgba(236,240,255,1)'], [.62, 'rgba(170,190,255,.9)'], [.8, 'rgba(110,130,255,.35)'], [1, 'rgba(90,110,255,0)']]) v.addColorStop(at, col);
      s2.fillStyle = v;
      s2.fillRect(0, 0, a, b);
    });
    for (let px = 0; px < w; px += 4) {
      const k = px / w, hh = h / 2 * (.2 + .8 * (1 - k) ** 1.7) * (.72 + fbm(px * .011, 3) * .56);
      q.globalAlpha = 1 - k * k * k;
      q.drawImage(c, .5, 0, 1, 64, px, h / 2 - hh, 4, hh * 2);
    }
  });
  // a soft point of light, and the leading edge of a shock: a bright line with its light falling away behind it
  const GLINT = sprite(24, 24, (q, w, h) => {
    const v = q.createRadialGradient(12, 12, 0, 12, 12, 12);
    v.addColorStop(0, 'rgba(255,255,255,1)');
    v.addColorStop(.18, 'rgba(255,240,214,.85)');
    v.addColorStop(.5, 'rgba(255,190,120,.16)');
    v.addColorStop(1, 'rgba(255,160,90,0)');
    q.fillStyle = v;
    q.fillRect(0, 0, w, h);
  });
  const SHOCK = sprite(640, 640, (q, w) => {
    const c = w / 2, v = q.createRadialGradient(c, c, c * .55, c, c, c);
    for (const [at, col] of [[0, 'rgba(255,226,186,0)'], [.62, 'rgba(255,226,186,.04)'], [.88, 'rgba(255,232,200,.2)'], [.97, 'rgba(255,246,228,.75)'], [1, 'rgba(255,246,228,0)']]) v.addColorStop(at, col);
    q.fillStyle = v;
    q.fillRect(0, 0, w, w);
  });
  // the stars, sharp, on a still layer of their own that costs nothing a frame: pushed out and drawn into small arcs round the hole, as a mass bends light, with a faint second image of each close in
  let stars = null;
  const makeStars = () => {
    stars = sprite(Math.ceil(W * K), Math.ceil(H * K), q => {
      q.scale(K, K);
      q.lineCap = 'round';
      const TH = rsMax * 2.8, tone = i => ['255,255,255', '255,242,224', '226,234,255', '255,226,196'][i % 4], mark = (d, th, stretch, r, a, col) => {
        const rr = d;
        if (stretch > 1.2) {
          const sweep = Math.min(.5, r * stretch * 1.6 / rr);
          q.strokeStyle = `rgba(${col},${a.toFixed(2)})`;
          q.lineWidth = r * 1.5;
          q.beginPath();
          q.arc(x, y, rr, th - sweep, th + sweep);
          q.stroke();
        }
        else { q.fillStyle = `rgba(${col},${a.toFixed(2)})`; q.beginPath(); q.arc(x + Math.cos(th) * rr, y + Math.sin(th) * rr, r, 0, TAU); q.fill(); }
      };
      for (let i = 0, n = W * H / 1900; i < n; i++) {
        const sx = rnd() * W * 1.4 - W * .2,
          sy = rnd() * H * 1.4 - H * .2,
          d = Math.hypot(sx - x, sy - y) || 1,
          th = Math.atan2(sy - y, sx - x),
          m = rnd(),
          r = .32 + m * m * m * m * 1.15,
          a = .22 + .78 * m * m,
          col = tone(i),
          out1 = (d + Math.sqrt(d * d + 4 * TH * TH)) / 2,
          in1 = (Math.sqrt(d * d + 4 * TH * TH) - d) / 2;
        mark(out1, th, out1 / d, r, a, col);
        if (d < TH * 2.4) mark(in1, th + Math.PI, Math.min(9, in1 / d * 3), r * .8, a * .5, col);
        if (m > .95) q.drawImage(GLINT, x + Math.cos(th) * out1 - 7, y + Math.sin(th) * out1 - 7, 14, 14);
      }
    });
    Object.assign(stars.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none', opacity: 0, transition: 'opacity .5s' });
    stars.className = dark?.className || '';
    dark?.after?.(stars);
  };
  const spokes = [...Array(reduce ? 0 : LOW() ? 10 : 26)].map(() => {
    const fine = rnd() < .6;
    return { a: rnd() * TAU, sp: (rnd() - .5) * .8, k: fine ? .6 + rnd() * .4 : .3 + rnd() * .5, len: .55 + rnd() * .75, w: fine ? 5 + rnd() * 13 : 40 + rnd() * 84 };
  });
  const ringAt = u => 1 - (1 - clamp(u)) ** 2.2;
  // light riding the cloud round and slowly in: mostly fine dust, a few bright
  const reachOut = Math.max(W, H), threads = [...Array(reduce ? 0 : LOW() ? 160 : 620)].map(() => {
    const k = rnd(), r = rsMax * 4.6 + k * k * reachOut * 1.05, n = rnd(), b = rnd();
    return { r, a: rnd() * TAU, len: .1 + rnd() * .6, om: 1.2 * Math.pow(rsMax * 4.6 / r, 1.2), c: n < .34 ? 0 : n < .72 ? 1 : 2, q: b < .14 ? 0 : b < .45 ? 1 : 2 };
  }), THREAD = ['255,244,222', '250,214,160', '226,158,104'];
  const falling = [...Array(reduce ? 0 : LOW() ? 90 : 240)].map(() => {
    const n = rnd(), k = rnd();
    return { r0: rsMax * 5 + k * k * reachOut * .95, a0: rnd() * TAU, ph: rnd(), sp: .05 + rnd() * .07, c: n < .4 ? 0 : n < .8 ? 1 : 2, dim: rnd() < .7, om0: .5 + rnd() * .5 };
  });
  const COMET = ['255,250,238', '255,206,138', '255,146,76'], P = [0, 0];
  function comets(list, place, step, light = 1) { const paths = COMET.map(() => [0, 1, 2, 3].map(() => new Path2D())); g.lineCap = 'round';
   for (const o of list) {
     if (!place(o, 0)) continue;
     let ax = P[0], ay = P[1];
     for (let i = 0; i < 4; i++) { if (!place(o, (i + 1) * step)) break; const q = paths[o.c][i]; q.moveTo(ax, ay); q.lineTo(P[0], P[1]); ax = P[0]; ay = P[1]; }
   }
   COMET.forEach((col, c) => paths[c].forEach((q, i) => { g.strokeStyle = `rgba(${col},${([1, .55, .26, .1][i] * light).toFixed(3)})`; g.lineWidth = [1.6, 1.2, .85, .55][i]; g.stroke(q); })); }
  function around(t, rs, spin) {
    g.globalCompositeOperation = 'lighter';
    const inner = rs * 1.5, T = t * .9, spread = rs * 1.2 + ringAt((t - POP) / .3) * far * 1.25, lines = THREAD.map(() => [new Path2D(), new Path2D(), new Path2D()]);
    for (const o of threads) {
      if (o.r > spread) continue;
      const a = o.a + spin * o.om;
      lines[o.c][o.q].moveTo(x + Math.cos(a) * o.r, y + Math.sin(a) * o.r * .3);
      lines[o.c][o.q].ellipse(x, y, o.r, o.r * .3, 0, a, a + o.len);
    }
    g.lineCap = 'round';
    THREAD.forEach((col, c) => lines[c].forEach((q, i) => { g.strokeStyle = `rgba(${col},${[.5, .3, .17][i]})`; g.lineWidth = [.95, .75, .6][i]; g.stroke(q); }));
    for (const [dust, light, step] of [[true, .4, .014], [false, .9, .02]])
      comets(falling.filter(o => o.dim === dust), (o, back) => {
        const u = (o.ph + T * o.sp) % 1 - back, seen = Math.min(o.r0, spread);
        if (u < 0) return false;
        const e = u * u, r = inner * 2 + (o.r0 - inner * 2) * (1 - e);
        if (r > seen) return false;
        const a = o.a0 + spin * o.om0 + u * 5.2;
        P[0] = x + Math.cos(a) * r;
        P[1] = y + Math.sin(a) * r * CLOUD_FLAT;
        return true;
      }, step, light);
    g.globalCompositeOperation = 'source-over';
  }
  const SNAP = .86, CS = LOW() ? 4 : 2, cloud = { ready: false }, cloudC = document.createElement('canvas'), cloudG = cloudC.getContext('2d');
  cloudC.width = Math.ceil(W / CS);
  cloudC.height = Math.ceil(H / CS);
  cloudC.className = dark?.className || '';
  Object.assign(cloudC.style, { position: 'fixed', left: 0, top: 0, width: cloudC.width * CS + 'px', height: cloudC.height * CS + 'px', pointerEvents: 'none', opacity: 0, transition: 'opacity .25s' });
  let cloudJob = reduce ? null : cloudMaker(cloud, cloudC.width, cloudC.height, x, y, rsMax * 1.1, Math.max(W, H) * 1.5, CS), cloudImg = null, cloudPx = null, cloudBeat = 0;
  const cloudOff = new Int32Array(CLOUD_RINGS), cloudOpen = new Uint16Array(CLOUD_RINGS);
  function paintCloud(spin, opened) {
    if (!cloudImg) { cloudImg = cloudG.createImageData(cloudC.width, cloudC.height); cloudPx = new Uint32Array(cloudImg.data.buffer); dark?.after?.(cloudC); }
    const { az, row, turn } = cloud, T = cloudTexture, PAL = cloudPal, reach = opened * CLOUD_RINGS * 1.4;
    for (let i = 0; i < CLOUD_RINGS; i++) { const u = clamp((reach - i) / (CLOUD_RINGS * .4)); cloudOff[i] = spin * turn[i]; cloudOpen[i] = u * u * (3 - 2 * u) * 256; }
    for (let i = 0, n = az.length; i < n; i++) {
      const w = row[i], r = w >> 4, f = w & 15, a = (az[i] - cloudOff[r]) & 1023;
      cloudPx[i] = PAL[(T[a | r << 10] * (16 - f) + T[a | r + 1 << 10] * f) * cloudOpen[r] >> 12];
    }
    cloudG.putImageData(cloudImg, 0, 0);
  }
  function burstBehind(s, rs) { g.globalCompositeOperation = 'lighter';
   // a sunburst from behind the hole, gone in a moment
   const sun = Math.max(0, 1 - s / .5);
   if (sun > 0)
     for (const r of spokes) {
       const L = far * 1.1 * r.len * (1 - Math.exp(-s * 16)) + 30;
       g.save();
       g.translate(x, y);
       g.rotate(r.a + s * r.sp);
       g.globalAlpha = sun * sun * r.k;
       g.drawImage(SPOKE, rs * .8, -r.w / 2, L, r.w);
       g.restore();
     }
   // the jets from both poles, right across the screen, thinning away
   {
     const u = s / .95;
     if (u < 1) {
       const on = Math.min(1, s / .05), off = (1 - u) ** 1.4, L = far * 1.35 * (1 - Math.exp(-s * 13)), wide = (150 + 40 * Math.sin(s * 70)) * off + 20;
       for (const side of [-1, 1]) {
         g.save();
         g.translate(x, y);
         g.rotate(side * Math.PI / 2);
         for (const [k, al] of [[1, .95], [2, .42]]) { g.globalAlpha = al * on * off; g.drawImage(JET, rs * .55, -wide * k / 2, L, wide * k); }
         g.restore();
       }
     }
   }
   g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  function burstOut(s, rs) { g.globalCompositeOperation = 'lighter';
   // the shock: three rings that run out over everything, each a sharp line with its light falling away behind it
   for (const [lag, big] of [[0, 1], [.06, .7], [.15, .45]]) {
     const u = (s - lag) / .3;
     if (u <= 0 || u >= 1) continue;
     const r = rs * 1.2 + ringAt(u) * far * 1.25, R0 = r / .97, a = (1 - u) * big;
     g.globalAlpha = a;
     g.drawImage(SHOCK, x - R0, y - R0, R0 * 2, R0 * 2);
     g.globalAlpha = 1;
     g.beginPath();
     g.arc(x, y, r, 0, TAU);
     g.strokeStyle = `rgba(255,252,244,${(a * .9).toFixed(3)})`;
     g.lineWidth = 1.5;
     g.stroke();
   }
   g.globalCompositeOperation = 'source-over'; }
  // the back end's 0 and 1, streaming in on spirals
  // the 0 and 1 are drawn from four small pre-rendered sprites, not set as text every frame
  const glyph = (ch, col) => {
    const c = document.createElement('canvas'), z = Math.ceil(20 * K);
    c.width = c.height = z;
    const x2 = c.getContext('2d');
    x2.scale(K, K);
    x2.fillStyle = col;
    x2.font = '700 18px Consolas,"Courier New",monospace';
    x2.textAlign = 'center';
    x2.textBaseline = 'middle';
    x2.fillText(ch, 10, 10.5);
    return c;
  };
  const GLYPH = {}; for (const ch of '01') for (const col of ['#E4FAD8', '#8BE07A']) GLYPH[ch + col] = glyph(ch, col);
  const bits = [...Array(reduce ? 200 : LOW() ? 260 : 720)].map(() =>
    ({ r0: r0 + (Rmax * .8 - r0) * Math.sqrt(rnd()), a0: rnd() * TAU, ph: rnd(), v: rnd() < .5 ? '0' : '1', s: 11 + rnd() * 7, c: rnd() < .3 ? '#E4FAD8' : '#8BE07A', sp: .16 + rnd() * .12 }));
  // the disk: particles on circular orbits in a plane seen almost edge on, drawn on two small layers and bloomed
  const COSI = .2, parts = [...Array(reduce ? 500 : LOW() ? 460 : 1300)].map(() => ({ u: Math.pow(rnd(), 1.6), a: rnd() * TAU, len: .06 + rnd() * .18, b: .45 + rnd() * .55 }));
  const TINT = [[255, 236, 196], [255, 214, 140], [255, 160, 80], [220, 90, 40]], ti = k => k < .15 ? 0 : k < .4 ? 1 : k < .7 ? 2 : 3, WID = [1.4, 1.7, 1.1, 1.5];
  // (the disk's layers at a lower resolution: it is all glow, and they are large now that the hole grows big)
  const LS = Math.ceil(rsMax * 1.85 * 4.8 * 2 + 80), KL = K * .6, mk = () => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(LS * KL);
    c.height = Math.ceil(LS * KL);
    return [c, c.getContext('2d')];
  }, [backC, bk] = mk(), [frontC, fr] = mk();
  const softLayer = (scale, px) => {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(LS * scale);
    const q = c.getContext('2d');
    q.filter = `blur(${px * scale}px)`;
    return { c, q, scale };
  }, softs = [0, 1].map(() => [softLayer(.25, 6), softLayer(.125, 18)]);
  // only the part of each layer the disk reaches is drawn: most of it is empty while the hole is small
  let hw = LS / 2, hh = LS / 2;
  // the blur is the dearest thing here and too soft for a few frames' lag to show: the four take turns, one a frame, the others showing their last
  let beat = 0;
  const blurred = (c, s, alpha, due) => {
    if (due || !s.hw) {
      s.hw = hw;
      s.hh = hh;
      s.dw = hw * 2 * s.scale;
      s.dh = hh * 2 * s.scale;
      s.q.clearRect(0, 0, s.c.width, s.c.height);
      s.q.drawImage(c, (LS / 2 - hw) * KL, (LS / 2 - hh) * KL, hw * 2 * KL, hh * 2 * KL, 0, 0, s.dw, s.dh);
    }
    g.globalAlpha = alpha;
    g.drawImage(s.c, 0, 0, s.dw, s.dh, x - s.hw, y - s.hh, s.hw * 2, s.hh * 2);
  };
  let heat = 0;
  const bloom = (c, [near, wide], due, extra = 0) => {
    g.globalCompositeOperation = 'lighter';
    if (!reduce) { g.save(); blurred(c, near, .8, due === 0); blurred(c, wide, .5, due === 1); if (extra > .12) blurred(c, wide, Math.min(1, extra), false); g.restore(); }
    g.drawImage(c, (LS / 2 - hw) * KL, (LS / 2 - hh) * KL, hw * 2 * KL, hh * 2 * KL, x - hw, y - hh, hw * 2, hh * 2);
  };
  function disk(t, rs, fade) {
   const rin = rs * 1.35, rout = rs * 4.6; hw = Math.min(LS / 2, rout + 70); hh = Math.min(LS / 2, rs * 2.7 + 70);
   for (const c of [bk, fr]) {
     c.setTransform(KL, 0, 0, KL, 0, 0);
     c.clearRect(LS / 2 - hw, LS / 2 - hh, hw * 2, hh * 2);
     c.translate(LS / 2 - x, LS / 2 - y);
     c.globalCompositeOperation = 'lighter';
     c.lineCap = 'round';
   }
   // every stroke gathered into a few paths by layer, colour, brightness and width
   const B = new Map(), put = (front, c, x0, y0, x1, y1, al, w) => {
     if (al < .03) return;
     const q = Math.min(3, Math.floor(al * 4.6)), key = (front ? 1 : 0) + ',' + c + ',' + q + ',' + w;
     let o = B.get(key);
     if (!o) B.set(key, o = { front, c, al: Math.min(1, (q + .6) / 4), w, p: new Path2D() });
     o.p.moveTo(x0, y0);
     o.p.lineTo(x1, y1);
   };
   for (const p of parts) {
     const r = rin + (rout - rin) * p.u,
       a = p.a + t * Math.pow(rin / r, 1.5) * 4.2,
       a2 = a - p.len,
       px = x + Math.cos(a) * r,
       py = y + Math.sin(a) * r * COSI,
       x2 = x + Math.cos(a2) * r,
       y2 = y + Math.sin(a2) * r * COSI,
       c = ti(Math.max(0, p.u - heat * .7)),
       al = Math.min(1, p.b * (.45 + .55 * Math.max(0, -Math.cos(a))) * (1 + heat * .5)) * fade;
    if (Math.sin(a) < 0) { put(0, c, px, py, x2, y2, al, 0); const rl = rs * 1.1 + p.u * rs * 1.35, th = Math.PI + (Math.cos(a) * .5 + .5) * Math.PI, th2 = th - p.len * .7;
     put(1, ti(p.u), x + Math.cos(th) * rl, y + Math.sin(th) * rl * .96, x + Math.cos(th2) * rl, y + Math.sin(th2) * rl * .96, Math.min(1, al * 1.15), 1);
     put(1, ti(p.u), x + Math.cos(-th) * rl * .88, y + Math.sin(-th) * rl * .74, x + Math.cos(-th2) * rl * .88, y + Math.sin(-th2) * rl * .74, al * .3, 2);
    }
    else put(1, c, px, py, x2, y2, al, 3); }
   for (const o of B.values()) { const L = o.front ? fr : bk, col = TINT[o.c]; L.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${o.al})`; L.lineWidth = WID[o.w]; L.stroke(o.p); }
   fr.strokeStyle = `rgba(255,242,215,${.95 * fade})`;
   fr.lineWidth = 1.8;
   fr.beginPath();
   fr.arc(x, y, rs * 1.06, 0, TAU);
   fr.stroke();
   fr.strokeStyle = `rgba(255,200,140,${.35 * fade})`;
   fr.lineWidth = 5;
   fr.stroke();
   const turn = beat++ % 4;
   bloom(backC, softs[0], turn, heat);
   g.globalCompositeOperation = 'source-over';
   g.fillStyle = '#000';
   g.beginPath();
   g.arc(x, y, rs, 0, TAU);
   g.fill();
   bloom(frontC, softs[1], turn - 2);
   g.globalCompositeOperation = 'source-over';
  }
  // the cracks stand still between one small growth and the next, and thousands of strokes a frame was the hole's largest cost: they
  // live on a layer of their own, redrawn a few times a second while they grow and never once they have stopped
  const crackC = document.createElement('canvas'); crackC.width = cv.width; crackC.height = cv.height; const cq = crackC.getContext('2d'), CRACKS_END = GROW + 2.2; let crackAt = -1;
  let veins = new Path2D(), veinParts = [new Path2D(), new Path2D(), new Path2D()];   // (the same cracks as one path, and in three lengths from the hole out: the energy runs along them)
  function drawCracks(t, F) {
    const every = LOW() ? .28 : .1;
    if (crackAt >= 0 && (t - crackAt < every || crackAt > CRACKS_END)) return;
    crackAt = t;
    cq.setTransform(K, 0, 0, K, 0, 0);
    cq.clearRect(0, 0, W, H);
    const grow = t0 => .55 + .45 * clamp((t - t0) / 1.6);
    veins = new Path2D();
    veinParts = [new Path2D(), new Path2D(), new Path2D()];
   for (const R of rad) {
     let n = 0;
     while (n < R.pts.length - 1 && R.pts[n + 1][2] <= F) n++;
     if (n) {
       crackLine(cq, R.pts, 3.4 * grow(.25), .6, n / (R.pts.length - 1), .55);
       for (let i = 0; i <= n; i++) {
         const [px, py] = R.pts[i];
         i ? veins.lineTo(px, py) : veins.moveTo(px, py);
         if (i) { const part = veinParts[i / n < .34 ? 0 : i / n < .67 ? 1 : 2]; part.moveTo(R.pts[i - 1][0], R.pts[i - 1][1]); part.lineTo(px, py); }
       }
     }
   }
   for (const b of branches) if (t > b.t0) crackLine(cq, b.pts, 1.6 * grow(b.t0), .4, clamp((t - b.t0) / .45), .4);
   for (let k = 1; k < RING.length; k++) for (const s of seg[k]) if (s && t > s.t0) crackLine(cq, s.pts, Math.max(1, 2.4 - k * .22) * grow(s.t0), Math.max(.8, 2 - k * .2), clamp((t - s.t0) / .3), .4); }
  // the energy before the burst, sharp, on a canvas of its own over the darkened page: thin hot light along the cracks, thinning toward the tips, bright beads racing out along them, and a ring of pressure with each jolt
  let veinC = null, vq = null;
  function charged(t, rs, e, spin) {
    if (!veinC) {
      veinC = document.createElement('canvas');
      veinC.width = cv.width;
      veinC.height = cv.height;
      veinC.className = dark?.className || '';
      Object.assign(veinC.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none' });
      dark?.after?.(veinC);
      vq = veinC.getContext('2d');
    }
   vq.setTransform(K, 0, 0, K, 0, 0); vq.clearRect(0, 0, W, H); vq.globalCompositeOperation = 'lighter'; vq.lineCap = 'round'; const v = Math.min(1, e * 1.5);
   veinParts.forEach((part, i) => {
     vq.strokeStyle = `rgba(255,${[246, 226, 196][i]},${[226, 188, 140][i]},${(v * [1, .7, .42][i]).toFixed(3)})`;
     vq.lineWidth = [1.8, 1.25, .8][i] * (.7 + .5 * e);
     vq.stroke(part);
   });
   for (const R of rad)
     for (let b = 0; b < 3; b++) {
       const u = (R.a * 2.3 + b / 3 + spin * 1.1) % 1, r = r0 + u * Math.min(F0, R.len), head = at(R, r);
       if (!head) continue;
       const fall = Math.sin(Math.PI * u) * v, tail = 22 + 110 * e;
       vq.globalAlpha = fall;
       vq.drawImage(GLINT, head[0] - 7, head[1] - 7, 14, 14);
       let [ax, ay] = head;
       for (let i = 1; i <= 3; i++) {
         const back = at(R, Math.max(r0, r - tail * i / 3));
         if (!back) break;
         vq.globalAlpha = fall * [.9, .5, .2][i - 1];
         vq.strokeStyle = '#FFF0D6';
         vq.lineWidth = [1.8, 1.3, .8][i - 1];
         vq.beginPath();
         vq.moveTo(ax, ay);
         vq.lineTo(back[0], back[1]);
         vq.stroke();
         ax = back[0];
         ay = back[1];
       }
     }
   for (let i = 0; i < 8; i++) {
     const t0 = POP - .75 * Math.pow(.66, i), u = (t - t0) / .16;
     if (u <= 0 || u >= 1) continue;
     const strong = .3 + .7 * energy(t0), r = rs * 1.3 + u * Rmax * (.2 + .55 * strong), R0 = r / .97, a = (1 - u) ** 2 * strong;
     vq.globalAlpha = a * .8;
     vq.drawImage(SHOCK, x - R0, y - R0, R0 * 2, R0 * 2);
     vq.globalAlpha = a;
     vq.strokeStyle = '#FFF6E6';
     vq.lineWidth = 1.2;
     vq.beginPath();
     vq.arc(x, y, r, 0, TAU);
     vq.stroke();
   }
   vq.globalAlpha = 1; }
  // the swirl's fine lines: thousands of thin tapered arcs, tighter toward the hole, drawn once a little at a time on a few large canvases in the cloud's plane and turned
  // by the compositor, each ring at its own speed, the inner ones faster, so a frame pays nothing for them. They show with the cloud, under the black disc, and leave with the close.
  const fineWrap = document.createElement('div'),
    fineRings = [],
    fineSpec = reduce || !dark ? [] : LOW() ? [[1.5, 4.4, 520, 8.5, .8], [4, 8, 420, 15, .55]] : [[1.5, 4.4, 1500, 8.5, 1.35], [4, 8, 1500, 15, .95], [7.4, 13.5, 1300, 30, .66], [12.5, 22, 900, 62, .5]];
  Object.assign(fineWrap.style, { position: 'fixed', left: x + 'px', top: y + 'px', width: 0, height: 0, transform: `scale(1,${CLOUD_FLAT})`, pointerEvents: 'none', zIndex: 3 });
  function* fineMaker() { let seed2 = 8191; const rf = () => (seed2 = (seed2 * 48271) % 2147483647) / 2147483647, TONE = ['255,248,232', '255,236,204', '250,214,150', '255,240,214', '150,92,50', '96,50,26'];
   for (const [i0, [ra, rb, n, turn, k0]] of fineSpec.entries()) {
     const c = document.createElement('canvas'),
       r1 = rsMax * ra,
       r2 = rsMax * rb,
       side = c.width = c.height = Math.ceil(r2 * 2 * k0),
       k = side / (r2 * 2),
       q = c.getContext('2d', { willReadFrequently: true });
     Object.assign(c.style, {
       position: 'absolute',
       left: -r2 + 'px',
       top: -r2 + 'px',
       width: r2 * 2 + 'px',
       height: r2 * 2 + 'px',
       opacity: .004,
       willChange: 'transform',
       animation: `chb-fine ${turn}s linear infinite`,
       animationDelay: -(i0 * 3.7) + 's',
       transition: `opacity .5s ease-out ${(i0 * .12).toFixed(2)}s`
     });
     fineRings.push(c);
     yield;
    const mid = c.width / 2, span = Math.log(r2 / r1), lanes = [...Array(72)].map(() => rf() ** 1.3); q.setTransform(k, 0, 0, k, mid, mid); q.lineCap = 'round';
    for (let i = 0; i < n;) {
      const ton = rf() * TONE.length | 0,
        tone = TONE[ton],
        level = (ton > 3 ? .5 : .34) + rf() * (ton > 3 ? .3 : .62),
        w = (.42 + rf() * .46) * Math.max(1, 1 / (k * 1.1)),
        stop = Math.min(n, i + (LOW() ? 8 : 24)),
        tier = [new Path2D(), new Path2D(), new Path2D()];
     for (; i < stop; i++) {
       const u = Math.max(0, Math.min(1, lanes[rf() * lanes.length | 0] + (rf() - .5) * .022)),
         r0 = r1 * Math.exp(span * u),
         a0 = rf() * TAU,
         len = (.2 + rf() * rf() * 1.5) * Math.min(1, Math.min(u, 1 - u) * 9 + .35),
         steps = Math.max(5, Math.min(16, Math.ceil(len * r0 / 26)));
       let on = [false, false, false];
      for (let j = 0; j <= steps; j++) {
        const v = j / steps, a = a0 + len * v, r = r0 * Math.exp(-.1 * len * v), px = Math.cos(a) * r, py = Math.sin(a) * r;
        for (let m = 0; m < 3; m++) { if (v < m * .17 || v > 1 - m * .17) continue; on[m] ? tier[m].lineTo(px, py) : tier[m].moveTo(px, py); on[m] = true; }
      } }
     tier.forEach((p, m) => { q.strokeStyle = `rgba(${tone},${(level * [.4, .65, 1][m]).toFixed(3)})`; q.lineWidth = w * [.55, .8, 1][m]; q.stroke(p); }); q.getImageData(0, 0, 1, 1); yield; }
     fineReady.push(c);
     yield;
   } }
  let fineJob = fineSpec.length ? fineMaker() : null, fineGoing = false;
  const fineReady = [], fineOff = () => { fineJob = null; fineWrap.remove(); for (const c of fineRings) c.width = c.height = 0; fineRings.length = fineSpec.length = 0; };
  function fineStep(t, cK) {
    if (!fineSpec.length) return;
    if (fineJob) { const stop = performance.now() + (LOW() ? 1 : 2); while (performance.now() < stop) if (fineJob.next().done) { fineJob = null; break; } }
   if (cK >= SNAP) { fineOff(); return; }
   if (t > POP - .35) {
     if (!fineWrap.isConnected) dark.after(fineWrap);
     if (t >= POP) for (const c of fineWrap.children) if (c.style.opacity !== '1') c.style.opacity = 1;
     for (const c of fineReady.splice(0)) fineWrap.append(c);
   }
   if (closing >= 0 && fineWrap.isConnected && !fineGoing) {
     fineGoing = true;
     fineWrap.animate(
       [{ transform: `scale(1,${CLOUD_FLAT})`, opacity: 1 }, { transform: `scale(.26,${CLOUD_FLAT * .26})`, opacity: 0 }],
       { duration: SNAP * .55 * SLOW * 1000, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
   } }
  let F0 = 0, rsNow = 0;
  let closing = -1, done = false, last = 0, darkened = false, darkFull = false, joltAmp = 0, jolted = false;
  function frame(t) {
   if (done) return; const clock = Math.max(0, t); t = clock / SLOW; last = t;
   const cK = closing < 0 ? 0 : clamp((t - closing) / .55);
   g.setTransform(1, 0, 0, 1, 0, 0);
   g.clearRect(0, 0, cv.width, cv.height);
   const holdDark = darkFull && cK < SNAP;
   if (gd && darkened && !holdDark) { gd.setTransform(1, 0, 0, 1, 0, 0); gd.clearRect(0, 0, dark.width, dark.height); darkened = false; }
   if (cK >= 1) { done = true; dim = 0; stars?.remove(); cloudC.remove(); veinC?.remove(); fineOff(); return; }
   const keep = 1 - cK * cK; g.setTransform(K, 0, 0, K, 0, 0); g.translate(x, y); g.scale(keep, keep); g.translate(-x, -y);
   if (t >= POP && !jolted && !reduce) { jolted = true; joltAmp = 44; } if (joltAmp > .4) { g.translate((rnd() - .5) * joltAmp, (rnd() - .5) * joltAmp); joltAmp *= .93; }
   const F = F0 = front(t), rs = rsNow = rsAt(t), open0 = 1, dR = rs * 1.3, e = energy(t), out = t >= POP, deep = out && !reduce ? ease3((t - POP) / .03) : 0, spin = spinOf(t);
   heat = out ? Math.exp(-(t - POP) * 3) : e;
   if (cloudJob) { const stop = performance.now() + 3; while (performance.now() < stop) if (cloudJob.next().done) { cloudJob = null; break; } }
   fineStep(t, cK);
   if (!stars && !reduce && t > .6) makeStars();
   if (stars) { const want = out && cK < SNAP ? '1' : '0'; if (stars.style.opacity !== want) { if (want === '0') stars.style.transition = 'none'; stars.style.opacity = want; } }
   // as it grows it eats the page: a piece it has grown over is simply gone into it (no lift, no fall), whatever its turn
   for (const c of list) if (c.go > t && dR > c.rOut * .85) c.go = t - 10;
   const gone = list.filter(c => t >= c.go);
   // what is open: the hole's own disc and every piece of page that has come away
   // every shape added turning the same way, so where the disc and the pieces overlap they add up instead of cancelling
   const region = new Path2D(), add = pts => {
     let A = 0;
     for (let i = 0; i < pts.length; i++) { const [a, b] = pts[i], [c2, d2] = pts[(i + 1) % pts.length]; A += a * d2 - c2 * b; }
     const q = A < 0 ? pts.slice().reverse() : pts;
     q.forEach(([a, b], i) => i ? region.lineTo(a, b) : region.moveTo(a, b));
     region.closePath();
   };
   const paperLeft = 1 - deep;   // (once it is out the page's structure goes into the dark, and nothing of it is worked out any more)
   if (!out) { add([...Array(40)].map((_, i) => [x + Math.cos(i / 40 * TAU) * dR, y + Math.sin(i / 40 * TAU) * dR])); for (const c of gone) add(c.poly); }
   // its broken edges: only where an open piece meets page still in place
   const lips = new Path2D(), isGone = c => c && t >= c.go, line = pts => {
     let on = false;
     for (const [a, b] of pts) { if (Math.hypot(a - x, b - y) < dR + 2) { on = false; continue; } on ? lips.lineTo(a, b) : lips.moveTo(a, b); on = true; }
   };   // (an edge inside the hole's own disc is gone with it)
   if (paperLeft > 0) for (let i = 0; i < NR; i++) if (!isGone(cellAt(1, i))) line(seg[0][i].pts.map(([a, b]) => [x + (a - x) * open0, y + (b - y) * open0]));
   if (paperLeft > 0)
     for (const c of gone) {
       for (const [o, pts] of [[cellAt(c.k + 1, c.i), c.hi], [cellAt(c.k, (c.i + NR - 1) % NR), c.sideA], [cellAt(c.k, (c.i + 1) % NR), c.sideB], [c.k > 1 ? cellAt(c.k - 1, c.i) : { go: 0 }, c.lo]])
         if (!isGone(o)) line(pts);
     }
   // on the page still in place: the cracks running out and the broken lip of paper along the open edges (the open region,
   // drawn next, covers whatever of them lies inside it)
   if (paperLeft > 0) {
     g.globalAlpha = paperLeft;
     drawCracks(t, F);
     g.drawImage(crackC, 0, 0, W, H);
     g.lineJoin = 'round';
     g.lineCap = 'round';
     g.strokeStyle = edgeCol;
     g.lineWidth = 6.4;
     g.stroke(lips);
     g.strokeStyle = 'rgba(20,20,19,.95)';
     g.lineWidth = 2.6;
     g.stroke(lips);
     g.globalAlpha = 1;
   }
   // behind: the back end, dark, deepest at the hole, its 0 and 1 streaming in on spirals and drawn out as they near it
   g.save();
   if (!out) {
     g.clip(region);
     const bg = g.createRadialGradient(x, y, rs, x, y, Rmax);
     bg.addColorStop(0, '#000');
     bg.addColorStop(1, '#060607');
     g.fillStyle = bg;
     g.fillRect(x - Rmax, y - Rmax, Rmax * 2, Rmax * 2);
   }
   g.globalCompositeOperation = 'lighter'; g.textAlign = 'center'; g.textBaseline = 'middle';
   let open = dR; for (const c of gone) if (c.rOut > open) open = c.rOut; open = open * 1.2 + 30; const base = g.getTransform(), { a: ba, b: bb, c: bc, d: bd, e: be, f: bf } = base;
   if (!out)
     for (const b of bits) {
       const u = (b.ph + t * b.sp) % 1, e = Math.pow(u, 1.5), r = rs + (b.r0 - rs) * (1 - e);
       if (r > open) continue;
       const a = b.a0 + e * 3.4,
         px = x + Math.cos(a) * r,
         py = y + Math.sin(a) * r,
         st = 1 + (1 - (r - rs) / (b.r0 - rs + 1)) * 2.2,
         sz = b.s * clamp(.55 + r / 500, .55, 1.1),
         c = Math.cos(a + Math.PI / 2),
         n = Math.sin(a + Math.PI / 2),
         sx = sz / 18 / Math.sqrt(st),
         sy = sz / 18 * st;
    const ma = c * sx, mb = n * sx, mc = -n * sy, md = c * sy;
    g.setTransform(ba * ma + bc * mb, bb * ma + bd * mb, ba * mc + bc * md, bb * mc + bd * md, ba * px + bc * py + be, bb * px + bd * py + bf);
    g.globalAlpha = Math.min(1, (1 - u) * 3) * .85;
    g.drawImage(GLYPH[b.v + b.c], -10, -10, 20, 20);
   }
   g.setTransform(base); g.globalAlpha = 1; if (!out) disk(spin, rs, 1);
   g.globalCompositeOperation = 'source-over';
   if (!out) for (const [w, a] of [[20, .22], [11, .3], [5, .38]]) { g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = w; g.stroke(lips); }   // a soft shadow under each broken edge (no full-screen blur)
   g.restore();
   // out of the page: nothing cuts it off now
   if (out && cloud.ready) {
     if (cK < SNAP) {
       const rise = clamp((t - POP) / .4), opened = rise * rise * (3 - 2 * rise);
       if (cK > 0 || rise < 1 || cloudBeat++ % (LOW() ? 2 : 3) === 0) paintCloud(spin + cK * cK * 4, opened * (1 - cK / SNAP) ** 1.6);
       if (cloudC.style.opacity !== '1') cloudC.style.opacity = '1';
     }
     else if (cloudC.style.opacity !== '0') { cloudC.style.transition = 'none'; cloudC.style.opacity = '0'; }
   }
   if (out) {
     const hr = rs * 4.6;
     g.globalAlpha = clamp((t - POP) / .1) * (cloud.ready ? clamp(1 - (t - POP) / .2) : 1);
     g.drawImage(HALO, x - hr, y - hr * .62, hr * 2, hr * 1.24);
     g.globalAlpha = 1;
     if (!reduce) around(t, rs, spin);
     if (!reduce && t - POP < 1.4) burstBehind(t - POP, rs);
     disk(spin, rs, 1);
     if (!reduce && t - POP < 1.4) burstOut(t - POP, rs);
   }
   // the light of the page is swallowed: it darkens round the hole (darkest near it, deeper as it grows), the open region
   // stays lit by the hole's own light; streaks of light from all over are caught and drawn in on spirals
   dim = cK >= SNAP ? 0 : out ? .74 + .26 * deep : (.16 * clamp(t / POP) + .58 * e) * (1 - cK);
   if (gd && dim > .005 && !holdDark) { darkened = true; darkFull = deep >= 1; gd.setTransform(KD, 0, 0, KD, 0, 0); gd.translate(x, y); gd.scale(keep, keep); gd.translate(-x, -y);
    const dk = gd.createRadialGradient(x, y, dR, x, y, Rmax * 1.25);
    const tone = 1 - deep, hue = (r0, g0, b0) => `${Math.round(r0 * tone)},${Math.round(g0 * tone)},${Math.round(b0 * tone)}`;   // (open space is black)
    dk.addColorStop(0, `rgba(${hue(4, 5, 26)},${lerp(.94, 1, deep) * dim})`);
    dk.addColorStop(.3, `rgba(${hue(8, 10, 46)},${lerp(.82, 1, deep) * dim})`);
    dk.addColorStop(1, `rgba(${hue(14, 18, 70)},${lerp(.52, .97, deep) * dim})`);
    gd.fillStyle = dk;
    gd.fillRect(x - Rmax * 3, y - Rmax * 3, Rmax * 6, Rmax * 6);
    if (!out) { gd.globalCompositeOperation = 'destination-out'; gd.fill(region); } gd.globalCompositeOperation = 'lighter'; gd.lineCap = 'round';
    const beams = new Map(), bucket = (c, q, w) => { const key = c + q + w; let o = beams.get(key); if (!o) beams.set(key, o = { c, q, w, p: new Path2D() }); return o.p; };
    if (!out)
      for (const r of rays) {
        const u = (r.ph + t * r.sp) % 1, pos = v => {
          const e = Math.pow(v, 1.7), rr = dR + (r.r0 - dR) * (1 - e), a = r.a0 + e * 2.6;
          return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
        }, al = dim * Math.sin(Math.PI * u) * .8;
     if (al < .02) continue;
     const [ax, ay] = pos(Math.max(0, u - .035)),
       [mx, my] = pos(Math.max(0, u - .017)),
       [bx, by] = pos(u),
       q = Math.ceil(al * 3),
       w = r.w * (1 + u * 1.8) > 1.4 ? 2 : 1,
       tail = bucket(r.c, q - 1 || 1, w),
       hd = bucket(r.c, q, w);
     tail.moveTo(ax, ay);
     tail.lineTo(mx, my);
     hd.moveTo(mx, my);
     hd.lineTo(bx, by);
    }
    for (const o of beams.values()) { gd.strokeStyle = `rgba(${o.c},${(o.q / 3 * .8).toFixed(2)})`; gd.lineWidth = o.w === 2 ? 2.2 : 1.1; gd.stroke(o.p); }
    // the energy's soft light: tight round the hole, a falling glow along the cracks (the sharp part is charged(), below)
    if (e > .004 && !out) {
      const R = rs * 5 + 50, q = gd.createRadialGradient(x, y, 0, x, y, R);
      q.addColorStop(0, `rgba(255,238,206,${(.9 * e).toFixed(3)})`);
      q.addColorStop(.3, `rgba(255,196,128,${(.3 * e).toFixed(3)})`);
      q.addColorStop(1, 'rgba(255,170,100,0)');
      gd.fillStyle = q;
      gd.fillRect(x - R, y - R, R * 2, R * 2);
      gd.lineCap = 'round';
      for (const [w, a] of [[16, .07], [9, .1], [4.5, .16]]) { gd.strokeStyle = `rgba(255,196,120,${(a * Math.min(1, e * 1.3)).toFixed(3)})`; gd.lineWidth = w; gd.stroke(veins); }
    }
    gd.globalCompositeOperation = 'source-over'; }
   // the pieces that came away: a breath of lift (their shadow falls on the dark), then dragged in, turning, drawn out
   if (!out)
     for (const c of gone) {
       const s = t - c.go;
       if (s > .1 + c.fall) continue;
       const u = clamp((s - .1) / c.fall), e = u * u, lift = clamp(s / .1), a0 = Math.atan2(c.cy - y, c.cx - x), d0 = Math.hypot(c.cx - x, c.cy - y), a = a0 + e * c.turn, d = d0 * (1 - e), sc = 1 - e * .82;
    const P = new Path2D(); c.poly.forEach(([qx, qy], i) => i ? P.lineTo(qx - c.cx, qy - c.cy) : P.moveTo(qx - c.cx, qy - c.cy)); P.closePath();
    g.save();
    g.translate(x + Math.cos(a) * d - lift * 1.5, y + Math.sin(a) * d - lift * 2.5);
    g.rotate(a);
    g.scale(sc * (1 + e * 1.3), sc * (1 - e * .45));
    g.rotate(-a + e * c.spin);
    g.globalAlpha = 1 - clamp((e - .8) / .2);
    g.save(); g.translate(3 + 4 * lift, 4 + 6 * lift); g.fillStyle = `rgba(0,0,0,${.3 * (1 - e)})`; g.fill(P); g.restore();
    g.save(); g.translate(1.6, 2.2); g.fillStyle = edgeCol; g.fill(P); g.restore(); g.fillStyle = paper; g.fill(P); if (dim > .02) { g.fillStyle = `rgba(6,8,40,${dim * .68})`; g.fill(P); }
    const turn = .5 - .5 * Math.cos(e * c.spin * 1.3); if (turn > .02) { g.fillStyle = `rgba(0,0,0,${.32 * turn})`; g.fill(P); }
    g.strokeStyle = 'rgba(20,20,19,.9)'; g.lineWidth = 1.2 / Math.max(.3, sc); g.stroke(P); g.restore(); }
   g.globalAlpha = 1; after?.(g, clock, K);
   if (e > .004 && !out && !reduce) charged(t, rs, e, spin); else if (veinC) { veinC.remove(); veinC = null; }
   // it snaps shut: white, and the page is back behind it
   if (closing >= 0 && !reduce) {
     const f = cK < SNAP ? clamp((cK - .8) / (SNAP - .8)) ** 2 : 1 - (cK - SNAP) / (1 - SNAP);
     if (f > 0) { g.setTransform(K, 0, 0, K, 0, 0); g.fillStyle = `rgba(255,252,244,${f.toFixed(3)})`; g.fillRect(0, 0, W, H); }
   }
   // the burst itself: everything white for an instant
   if (out && !reduce && t - POP < .09) { g.setTransform(K, 0, 0, K, 0, 0); g.fillStyle = `rgba(255,252,244,${((1 - (t - POP) / .09) ** 3).toFixed(3)})`; g.fillRect(0, 0, W, H); }
  }
  // (with reduced motion its clock stands still, so closing ends it at once)
  const reachMax = Rmax * .75;
  return { frame, close: t => {
    if (closing < 0) closing = t / SLOW;
  }, closeNow: () => {
    if (reduce) {
      done = true;
      dim = 0;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      if (gd) { gd.setTransform(1, 0, 0, 1, 0, 0); gd.clearRect(0, 0, dark.width, dark.height); }
      return;
    }
    if (closing < 0) closing = last;
  }, get done() {
    return done;
  }, get dim() {
    return dim;
  }, get radius() {
    return rsNow;
  },
  flat: CLOUD_FLAT,
  timeAt: d => when(d / .85) * SLOW,
  popAt: POP * SLOW * 1000,
  hitAt: d => (POP + .3 * (1 - Math.pow(1 - clamp(d / (far * 1.25)), 1 / 2.2))) * SLOW * 1000,
  energyAt: ms => energy(ms / 1000 / SLOW),
  closeAt: 5400 * SLOW,
  jolt: a => {
    joltAmp = Math.max(joltAmp, a);
  }, reachMax, W, H };
 }
 // ---------------------------------------------------------------- the cloud round the black hole
 // A wide disk of gas behind the hole's own, seen at a slant: soft clouds sheared into long spirals with fine lines running through them, turning
 // faster toward the middle. It is worked out point by point on a small canvas of its own, so it is soft and costs the compositor nothing; a frame is
 // only lookups into a texture turned ring by ring. Made a little at a time before it is needed.
 const CLOUD_FLAT = .3, CLOUD_RINGS = 512; let cloudTexture = null, cloudPal = null;
 function* cloudMaker(out, FW, FH, hx, hy, R0, R1, SC) {
  const COS = cosTable ||= Float32Array.from({ length: 1024 }, (_, i) => Math.cos(i / 1024 * TAU)), NR = CLOUD_RINGS;
  if (!cloudTexture) { const T = new Uint8Array(1024 * NR); let seed = 4099; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
   const wander = gap => {
     const n = Math.ceil(NR / gap) + 2, at = Float32Array.from({ length: n }, rnd), o = new Float32Array(NR);
     for (let i = 0; i < NR; i++) { const u = i / gap, a = Math.floor(u), f = u - a, e = f * f * (3 - 2 * f); o[i] = at[a] + (at[a + 1] - at[a]) * e; }
     return o;
   };
   const PUFF = [1, 2, 3, 4, 6, 9, 13],
     FINE = [21, 34, 55, 89],
     pp = PUFF.map(k => wander(Math.max(12, 110 / Math.sqrt(k)))),
     pf = FINE.map(() => wander(9)),
     rings = [wander(4), wander(9), wander(20), wander(46)],
     ampP = PUFF.map(k => k ** -.6),
     ampF = FINE.map(k => k ** -.3),
     sumP = ampP.reduce((a, k) => a + k, 0),
     sumF = ampF.reduce((a, k) => a + k, 0);
   for (let row = 0; row < NR; row++) {
     const u = row / (NR - 1), shape = Math.pow(1 - u, 1.05) * Math.min(1, (NR - 1 - row) / 160), band = .74 + .52 * (rings[0][row] * .32 + rings[1][row] * .3 + rings[2][row] * .23 + rings[3][row] * .15);
    for (let az = 0; az < 1024; az++) {
      let p = 0, f = 0;
      for (let q = 0; q < PUFF.length; q++) p += COS[(az * PUFF[q] + pp[q][row] * 7000 | 0) & 1023] * ampP[q];
      for (let q = 0; q < FINE.length; q++) f += COS[(az * FINE[q] + pf[q][row] * 9000 | 0) & 1023] * ampF[q];
      p = .5 + p / sumP * .95;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      f = .5 + f / sumF * 1.1;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      const v = 255 * shape * (.34 + .9 * p) * band * (.84 + .3 * f);
      T[row << 10 | az] = v > 255 ? 255 : v;
    }
    if (row % 4 === 3) yield; }
   cloudTexture = T; }
  if (!cloudPal) {
    cloudPal = new Uint32Array(256);
    const stops = [[0, [34, 14, 8]], [.1, [92, 44, 22]], [.24, [152, 92, 52]], [.42, [206, 154, 100]], [.6, [238, 206, 156]], [.8, [252, 234, 204]], [1, [255, 250, 240]]];
    for (let i = 0, s = 1; i < 256; i++) {
      const u = i / 255;
      while (s < stops.length - 1 && u > stops[s][0]) s++;
      const [u0, c0] = stops[s - 1], [u1, c1] = stops[s], c = mixc(c0, c1, (u - u0) / (u1 - u0));
      cloudPal[i] = (Math.min(255, i * 5) * 16777216 + (Math.round(c[2]) << 16 | Math.round(c[1]) << 8 | Math.round(c[0]))) >>> 0;
    }
  }
  const N = FW * FH, az = new Uint16Array(N), row = new Uint16Array(N), span = Math.log(R1 / R0);
  for (let py = 0, i = 0; py < FH; py++) {
    const dy = ((py + .5) * SC - hy) / CLOUD_FLAT;
    for (let px = 0; px < FW; px++, i++) {
      const dx = (px + .5) * SC - hx, d = Math.hypot(dx, dy), v = d <= R0 ? 0 : Math.min(NR - 1.01, Math.log(d / R0) / span * (NR - 1));
      row[i] = v * 16;
      az[i] = (Math.atan2(dy, dx) / TAU + 1) * 1024 + v * 1.2;
    }
    if (py % 8 === 7) yield;
  }
  Object.assign(out, { az, row, turn: Float32Array.from({ length: NR }, (_, i) => 2.4 * Math.pow(Math.exp(i / (NR - 1) * span), -1.35) / TAU * 1024), ready: true });
 }
 // ---------------------------------------------------------------- the bomb's mark: the page shattered, a hole onto the back end
 // A jagged hole (the caller lays the back end, streams of 0 and 1, under it) with a thin broken lip of paper, chips
 // lifted along it and a shadow inside; cracks run out from its corners, some branching, a few joined by a ring further
 // out. It breaks open in a quarter of a second, then stays. shatter(canvas, x, y, R) -> {frame(t), done, outline}.
 function shatter(cv, x, y, R, { reduce = false, hot = 0 } = {}) {
  const S = Math.ceil(R * 6), dpr = sized(cv, S, x, y), g = cv.getContext('2d'), c = S / 2;
  let seed = 7 + Math.floor(Math.random() * 1e6); const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const N = 15, hole = [...Array(N)].map((_, i) => {
    const a = (i + (rnd() - .5) * .5) / N * TAU, r = R * (.62 + .38 * rnd()) * (i % 2 ? .78 : 1);
    return [c + Math.cos(a) * r, c + Math.sin(a) * r * .92, a];
  });
  // the main cracks: bold, nearly straight, kinked, from the hole's corners; a few branch
  const cracks = [], mains = [];
  for (const [hx, hy, a] of hole) {
    if (rnd() > .62) continue;
    const len = R * (.7 + 1.3 * rnd()), main = crackPath(hx, hy, a + (rnd() - .5) * .25, len, rnd, .22, 11);
    mains.push({ pts: main, a });
    cracks.push({ pts: main, w: 3.4 });
   if (rnd() < .35) {
     const at = main[Math.floor(main.length * (.4 + rnd() * .3))];
     cracks.push({ pts: crackPath(at[0], at[1], a + (rnd() < .5 ? -1 : 1) * (.5 + rnd() * .35), len * (.3 + rnd() * .25), rnd, .22, 10), w: 1.8 });
   } }
  // straight chords joining neighbouring cracks further out, the way a struck sheet breaks into a web
  mains.sort((p, q) => p.a - q.a);
  for (let i = 0; i < mains.length; i++) {
    const A = mains[i].pts, B = mains[(i + 1) % mains.length].pts;
    if (rnd() > .55 || A.length < 6 || B.length < 6) continue;
    const p = A[Math.floor(A.length * (.45 + rnd() * .3))], q = B[Math.floor(B.length * (.45 + rnd() * .3))], m = [(p[0] + q[0]) / 2 + (rnd() - .5) * 8, (p[1] + q[1]) / 2 + (rnd() - .5) * 8];
    cracks.push({ pts: [p, m, q], w: 1.6 });
  }
  const chips = hole.filter(() => rnd() < .45).map(([hx, hy, a]) => ({ x: hx, y: hy, a, s: 3 + rnd() * 4 }));
  const holePath = k => {
    const p = new Path2D();
    hole.forEach(([hx, hy], i) => { const px = c + (hx - c) * k, py = c + (hy - c) * k; i ? p.lineTo(px, py) : p.moveTo(px, py); });
    p.closePath();
    return p;
  };
  let done = false, baked = null;
  const cooling = (hp, t) => {
    const heat = hot && !reduce ? clamp(1 - t / hot) : 0;
    if (heat > 0) { g.strokeStyle = `rgb(255,${Math.round(96 + 150 * heat * heat)},${Math.round(24 + 90 * heat * heat)})`; g.lineWidth = 5 * heat; g.stroke(hp); }
  };
  function frame(t) {
   if (done) return;
   if (baked) {
     const hp = holePath(1);
     g.setTransform(1, 0, 0, 1, 0, 0);
     g.clearRect(0, 0, baked.width, baked.height);
     g.drawImage(baked, 0, 0);
     g.setTransform(dpr, 0, 0, dpr, 0, 0);
     cooling(hp, t);
     if (t > hot) done = true;
     return;
   }
   const p = reduce ? 1 : clamp(t / .28), e = 1 - Math.pow(1 - p, 3), k = .55 + .45 * (1 - Math.pow(1 - clamp(t / .12), 3)), hp = holePath(reduce ? 1 : k);
   g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
   // the shadow inside the hole, under its lip
   g.save(); g.clip(hp); if (!LOW()) g.filter = 'blur(4px)'; g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineWidth = 12; g.stroke(hp); g.restore();
   for (const cr of cracks) crackWedge(g, cr.pts, cr.w * 1.6, e, .5);
   // the broken lip: a band of paper seen edge on, inked; chips of it lifted along the edge
   g.lineJoin = 'miter'; g.strokeStyle = 'rgba(218,214,204,1)'; g.lineWidth = 3.4; g.stroke(hp); g.strokeStyle = 'rgba(20,20,19,.95)'; g.lineWidth = 1.3; g.stroke(hp);
   for (const ch of chips) {
     g.save();
     g.translate(c + (ch.x - c) * k, c + (ch.y - c) * k);
     g.rotate(ch.a);
     g.fillStyle = 'rgba(250,249,245,1)';
     g.beginPath();
     g.moveTo(0, -ch.s);
     g.lineTo(ch.s * 1.2, ch.s * .2);
     g.lineTo(-ch.s * .4, ch.s);
     g.closePath();
     g.fill();
     g.strokeStyle = 'rgba(20,20,19,.9)';
     g.lineWidth = .9;
     g.stroke();
     g.restore();
   }
   // (a blast leaves the broken edge glowing; it cools to nothing)
   if (p >= 1 && t > .3) {
     if (hot > t && !reduce) { baked = root.document.createElement('canvas'); baked.width = cv.width; baked.height = cv.height; baked.getContext('2d').drawImage(cv, 0, 0); cooling(hp, t); }
     else done = true;
   }
   else cooling(hp, t);
  }
  const outline = hole.map(([hx, hy, a]) => [x + (hx - c) + Math.cos(a) * 2, y + (hy - c) + Math.sin(a) * 2]);
  return { frame, get done() { return done; }, outline };
 }
 // ---------------------------------------------------------------- the hammer's mark: the page cracked where it was struck
 // A soft pit and a star of cracks running out of it. Struck again in the same place, the cracks run further, branch
 // and join into a web: the same seed, so a second blow extends the first instead of drawing a new one. No dent, only the
 // breaks (a third blow breaks through: the caller uses shatter). crackStar(canvas, x, y, R, level, {seed}).
 function crackStar(cv, x, y, R, level = 1, { reduce = false, seed: sd = .5 } = {}) {
  const S = Math.ceil(R * 2.2 * (1 + level * .4)), dpr = sized(cv, S, x, y), g = cv.getContext('2d'), c = S / 2;
  let seed = 1000 + Math.floor(sd * 1e6); const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const crush = [...Array(9)].map((_, i) => { const a = (i + rnd() * .5) / 9 * TAU, r = R * (.05 + .05 * rnd()) * (1 + level * .3); return [c + Math.cos(a) * r, c + Math.sin(a) * r]; });
  const cracks = [], mains = [];
  for (let i = 0; i < 11; i++) {
    const a = (i + rnd() * .6) / 11 * TAU,
      base = R * (.45 + .55 * rnd()),
      shown = i % 2 === 0 || i < 3 + level * 3,
      len = base * (.42 + .34 * level),
      pts = crackPath(c + Math.cos(a) * R * .07, c + Math.sin(a) * R * .07, a, len, rnd, .62, 8);
   const bf = .4 + rnd() * .3, bs = rnd() < .5 ? -1 : 1, bl = len * (.25 + rnd() * .25), bOn = rnd() < .5, bseed = rnd();
   if (!shown) continue; mains.push({ pts, a }); cracks.push({ pts, w: 1.6 + level * .55 });
   if (level >= 2 && bOn) {
     const at = pts[Math.floor(pts.length * bf)];
     let s2 = 7 + Math.floor(bseed * 1e5);
     const r2 = () => (s2 = (s2 * 48271) % 2147483647) / 2147483647;
     cracks.push({ pts: crackPath(at[0], at[1], a + bs * (.5 + bseed * .4), bl, r2, .62, 8), w: 1.1 + level * .3 });
   } }
  if (level >= 2) {
    mains.sort((p, q) => p.a - q.a);
    for (let i = 0; i < mains.length; i++) {
      const A = mains[i].pts, B = mains[(i + 1) % mains.length].pts, f = .45 + ((i * 37) % 10) / 40;
      if ((i * 7) % 10 > 3 + level * 2 || A.length < 6 || B.length < 6) continue;
      const p = A[Math.floor(A.length * f)], q = B[Math.floor(B.length * f)], m = [(p[0] + q[0]) / 2 + ((i * 13) % 7 - 3), (p[1] + q[1]) / 2 + ((i * 17) % 7 - 3)];
      cracks.push({ pts: [p, m, q], w: 1.2 });
    }
  }
  const chips = crush.filter((_, i) => i % 3 === 0).map(([px, py], i) => ({ x: px, y: py, a: i * 2.1, s: 2.2 + level * .8 }));
  const rim = Math.max(...crush.map(([a, b]) => Math.hypot(a - c, b - c))), pit = g.createRadialGradient(c, c, 0, c, c, rim);
  pit.addColorStop(0, 'rgba(10,13,22,.92)');
  pit.addColorStop(.4, 'rgba(10,13,22,.74)');
  pit.addColorStop(.75, 'rgba(10,13,22,.16)');
  pit.addColorStop(1, 'rgba(10,13,22,0)');
  let done = false;
  function frame(t) {
   if (done) return; const p = reduce ? 1 : clamp(t / .2), e = 1 - Math.pow(1 - p, 3);
   g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
   for (const cr of cracks) crackWedge(g, cr.pts, cr.w * 1.9, e, level >= 2 ? .55 : .3);
   const cp = new Path2D(); crush.forEach(([a, b], i) => i ? cp.lineTo(a, b) : cp.moveTo(a, b)); cp.closePath();
   g.fillStyle = pit; g.fill(cp);
   for (const ch of chips) {
     g.save();
     g.translate(ch.x, ch.y);
     g.rotate(ch.a);
     g.fillStyle = 'rgba(250,249,245,1)';
     g.beginPath();
     g.moveTo(0, -ch.s);
     g.lineTo(ch.s * 1.2, ch.s * .2);
     g.lineTo(-ch.s * .4, ch.s);
     g.closePath();
     g.fill();
     g.strokeStyle = 'rgba(20,20,19,.9)';
     g.lineWidth = .9;
     g.stroke();
     g.restore();
   }
   if (p >= 1 && t > .25) done = true;
  }
  return { frame, get done() { return done; } };
 }
 // ---------------------------------------------------------------- the hammer's dent: the page pressed in and crumpled
 // A height map (a bowl pressed into the paper, crumpled into radial facets; deeper with each blow) lit from the upper
 // left: where the paper turns to the light it brightens, where it turns away it darkens, so the page looks embossed
 // and its words still show through. A second blow adds cracks in the relief; a third tears it through.
 function dent(cv, x, y, R, level = 1, { seedOff = Math.random() * 50 } = {}) {
  const S = Math.ceil(R * 3.2), dpr = sized(cv, S, x, y), N = cv.width, c = N / 2, unit = N / S, g = cv.getContext('2d'), img = g.createImageData(N, N), D = img.data;
  const depth = 10 + level * 5, sig = R * .5 * unit, facets = 11, L = [-.52, -.62, .58], ln = Math.hypot(...L), flat = L[2] / ln;
  const cracks = level >= 2 ? [...Array(7)].map((_, i) => i / 7 * TAU + (fbm(i, seedOff) - .5)) : [];
  const H = (i, j) => {
    const dx = i - c,
      dy = j - c,
      r = Math.hypot(dx, dy),
      th = Math.atan2(dy, dx),
      bowl = -depth * unit * Math.exp(-r * r / (2 * sig * sig)),
      u = th / TAU * facets + fbm(Math.cos(th) * 2 + seedOff, Math.sin(th) * 2) * 1.6,
      ridge = .5 - .5 * Math.cos(u * TAU),
      fall = 1 - clamp((r - R * .35 * unit) / (R * .95 * unit)),
      crumple = -ridge * depth * .16 * unit * fall * clamp(r / (R * unit)) * 1.6,
      rim = depth * .22 * unit * Math.exp(-((r - R * .95 * unit) ** 2) / (2 * (R * .2 * unit) ** 2));
   let crack = 0;
   for (const a of cracks) {
     const da = Math.abs(((th - a + Math.PI) % TAU + TAU) % TAU - Math.PI) * r;
     if (da < 2.2 * unit && r > R * .12 * unit && r < R * 1.15 * unit) crack -= 2.4 * unit * (1 - da / (2.2 * unit));
   }
   return bowl + crumple + rim + crack; };
  const tearR = level >= 3 ? R * .42 * unit : 0;
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
   const k = (j * N + i) * 4, dx = i - c, dy = j - c, r = Math.hypot(dx, dy);
   if (tearR) {
     const th = Math.atan2(dy, dx), er = tearR * (.8 + .45 * fbm(Math.cos(th) * 2.2 + seedOff, Math.sin(th) * 2.2 + seedOff));
     if (r < er) { D[k] = 14; D[k + 1] = 16; D[k + 2] = 20; D[k + 3] = 255; continue; }
     if (r < er + 2.2 * unit) { const fib = nz(th * 30, r * .3) > .45; D[k] = D[k + 1] = 250; D[k + 2] = 245; D[k + 3] = fib ? 255 : 200; continue; }
   }
   const hx = (H(i + 1, j) - H(i - 1, j)) / 2,
     hy = (H(i, j + 1) - H(i, j - 1)) / 2,
     nx = -hx,
     ny = -hy,
     nzv = 1,
     nl = Math.hypot(nx, ny, nzv),
     s = (nx * L[0] + ny * L[1] + nzv * L[2]) / nl / ln,
     dlt = s - flat;
   const occ = Math.exp(-r * r / (2 * (sig * .55) ** 2)) * .12 * level;
   const edgeFade = 1 - clamp((r - R * 1.15 * unit) / (R * .35 * unit));
   if (dlt > 0) { D[k] = 255; D[k + 1] = 255; D[k + 2] = 255; D[k + 3] = clamp(dlt * 2.6) * 230 * edgeFade; }
   else { D[k] = 52; D[k + 1] = 56; D[k + 2] = 66; D[k + 3] = clamp(-dlt * 2.2 + occ) * 225 * edgeFade; }
  }
  g.putImageData(img, 0, 0);
  let done = false;
  return { frame(t) {
    if (done) return;
    const k = clamp(t / .09);
    cv.style.transform = `scale(${(.6 + .4 * k).toFixed(3)})`;
    if (t > .12) { cv.style.transform = ''; done = true; }
  }, get done() { return done; } };
 }
 // ---------------------------------------------------------------- the bomb's blast: a fireball of glowing particles
 // A white flash at the heart; hundreds of particles thrown out and slowed by the air, cooling as they go (white, gold,
 // orange, deep red, then dark), rising a little as they burn out; drawn with bloom. blast(canvas, x, y, R) -> {frame, done}.
 // Fire for a white page, where added light shows nothing: a heat field. Soft puffs of heat pile up in a small buffer, rolling noise breaks them into flame and
 // a colour table turns heat into solid colour: white at the heart, then gold, orange and red, then nothing (no smoke, no scorch). The buffer is small and scaled
 // up, so the cost does not follow the size of the ball.
 let fireTile = null;
 function noiseTile() {
  if (fireTile) return fireTile; const N = 128, sum = new Float32Array(N * N); let seed = 9173; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (const [cells, amp] of [[6, .55], [13, .3], [27, .15]]) {
    const grid = Float32Array.from({ length: cells * cells }, () => rnd()), at = (i, j) => grid[(j % cells) * cells + (i % cells)], step = cells / N;
   for (let y = 0; y < N; y++)
     for (let x = 0; x < N; x++) {
       const u = x * step, v = y * step, i = u | 0, j = v | 0, fu = u - i, fv = v - j, su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
       sum[y * N + x] += amp * (at(i, j) * (1 - su) * (1 - sv) + at(i + 1, j) * su * (1 - sv) + at(i, j + 1) * (1 - su) * sv + at(i + 1, j + 1) * su * sv);
     } }
  return fireTile = Uint8Array.from(sum, v => Math.max(0, Math.min(255, (v - .5) * 480 + 128)));
 }
 // The bomb's blast, in the house hand with real light behind it: a cloud of lobes in flat washes set a little off each other, a pen round the whole of it, hatching on
 // its shaded side, slivers of ink thrown out and a pen ring running away. Drawn at 24 steps a second with the line boiling from drawing to
 // drawing, like hand animation. It comes apart into puffs that shrink to nothing; no glow, no gradient, no smoke.
 function blast(cv, x, y, R, { reduce = false } = {}) {
  const S = Math.ceil(R * 9), dpr = sized(cv, S, x, y), g = cv.getContext('2d'), c = S / 2, low = LOW(), LIFE = 1.05; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let done = false, step = -1; const rnd = Math.random, J = n => (rnd() * 2 - 1) * n;
  if (reduce) return { frame() { done = true; }, get done() { return done; } };
  const INK = '#141413', PAPER = '#FFF8DA', GOLD = '#FFC629', CLAY = '#FF7A1A', RUST = '#E23A1C', EMBER = '#A81E12', SIDES = 13;
  const orb = root.document.createElement('canvas');
  orb.width = orb.height = 128;
  {
    const q = orb.getContext('2d'), v = q.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [at, col] of [[0, '#fff'], [.16, 'rgba(255,244,200,1)'], [.36, 'rgba(255,198,60,.84)'], [.62, 'rgba(255,112,30,.32)'], [1, 'rgba(255,80,20,0)']]) v.addColorStop(at, col);
    q.fillStyle = v;
    q.fillRect(0, 0, 128, 128);
  }
  const puff = (a, far, r) => ({ a, far, r, late: rnd() * .05, rise: 14 + rnd() * 34, go: .42 + rnd() * .2, boil: [0, 1, 2].map(() => [...Array(SIDES)].map(() => 1 + J(.11))) });
  const lobes = [...Array(low ? 9 : 14)].map((_, i, all) => puff((i + J(.3)) / all.length * TAU, (i % 2 ? .82 : .46) + rnd() * .22, R * (.44 + rnd() * .36))),
    core = [...Array(6)].map((_, i) => puff((i + J(.3)) / 6 * TAU, .2 + rnd() * .12, R * (.42 + rnd() * .16)));
  // flame licks standing out of the cloud, so its edge is fire and not a round thing
  const licks = [...Array(low ? 7 : 11)].map((_, i, all) => ({ a: (i + J(.35)) / all.length * TAU, len: R * (.7 + rnd() * .95), w: .2 + rnd() * .12, bend: J(.3) }));
  const slivers = [...Array(low ? 9 : 16)].map(() => ({ a: rnd() * TAU, r0: R * (1 + rnd() * .3), len: R * (.7 + rnd() * 1.1), w: 2.4 + rnd() * 2.6, bow: J(.14), t0: rnd() * .05 }));
  const bits = [...Array(low ? 14 : 30)].map(() => {
    const a = rnd() * TAU, v = 240 + rnd() * 460;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v * .8 - 160, life: .4 + rnd() * .5, col: [GOLD, CLAY, RUST, GOLD, INK][Math.floor(rnd() * 5)], w: 3 + rnd() * 2.4 };
  });
  const ring = [...Array(30)].map(() => 1 + J(.018));
  const lobe = (l, k, dx, dy, grow, boil, set) => {
    const w = l.boil[boil], d = l.far * R * 1.16 * grow * (1 + set.spread), cx = c + Math.cos(l.a) * d + dx, cy = c + Math.sin(l.a) * d * .92 + dy - l.rise * set.up, r = l.r * k * grow * set.size;
    if (r < .5) return;
    const at = i => { const an = i / SIDES * TAU + l.a, q = w[i % SIDES]; return [cx + Math.cos(an) * r * q, cy + Math.sin(an) * r * q]; };
    let [ax, ay] = at(0);
    for (let i = 0; i <= SIDES; i++) { const [bx, by] = at(i + 1), mx = (ax + bx) / 2, my = (ay + by) / 2; i ? g.quadraticCurveTo(ax, ay, mx, my) : g.moveTo(mx, my); ax = bx; ay = by; }
    g.closePath();
  };
  const lick = (l, grow, keep) => {
    const base = R * .86 * grow, tip = base + l.len * grow * keep;
    if (keep <= 0) return;
    g.moveTo(c + Math.cos(l.a - l.w) * base, c + Math.sin(l.a - l.w) * base * .92);
    g.quadraticCurveTo(
      c + Math.cos(l.a - l.w * .3) * (base + tip) / 2,
      c + Math.sin(l.a - l.w * .3) * (base + tip) / 2 * .92,
      c + Math.cos(l.a + l.bend * .4) * tip,
      c + Math.sin(l.a + l.bend * .4) * tip * .92);
    g.quadraticCurveTo(c + Math.cos(l.a + l.w * .4) * (base + tip) / 2, c + Math.sin(l.a + l.w * .4) * (base + tip) / 2 * .92, c + Math.cos(l.a + l.w) * base, c + Math.sin(l.a + l.w) * base * .92);
    g.closePath();
  };
  function cloud(t, boil) {
    const grow = 1 - Math.pow(1 - clamp((t - .03) / .3), 3), age = clamp((t - .36) / .62), reach = 1 - clamp(age * 2.6), set = l => {
      const v = clamp((age - l.late) / (1 - l.late));
      return { size: Math.max(0, 1 - v * v * (1 + l.go)), spread: v * .34, up: v * v };
    };
   const lay = (col, list, k, dx, dy, keep = 1) => {
     g.fillStyle = col;
     g.beginPath();
     for (const l of list) { const st = set(l); lobe(l, k, dx, dy, grow, boil, { ...st, size: st.size * keep }); }
     g.fill();
   };
   // the pen first and the wash over it, so only the outside of the whole cloud keeps its line
   g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round'; g.beginPath(); for (const l of lobes) lobe(l, 1, 0, 0, grow, boil, set(l)); for (const l of licks) lick(l, grow, reach); g.stroke();
   const shell = age > .55 ? EMBER : RUST;
   g.fillStyle = shell;
   g.beginPath();
   for (const l of licks) lick(l, grow, reach);
   g.fill();
   lay(shell, lobes, 1, 0, 0);
   g.fillStyle = CLAY;
   g.beginPath();
   for (const l of licks) lick(l, grow * .92, reach * .72);
   g.fill();
   lay(age > .75 ? RUST : CLAY, lobes, .82, 1.6, 2);
   g.fillStyle = GOLD;
   g.beginPath();
   for (const l of licks) lick(l, grow * .84, reach * .42);
   g.fill();
   const heat = 1 - clamp(age * 1.5); if (heat > 0) { lay(GOLD, core, 1.12, 2, 2.4, heat); } const heart = 1 - clamp(age * 2.8); if (heart > 0) lay(PAPER, core, .62, 1.4, 1.6, heart);
   // hatching on the shaded side of each lobe, a few strokes all falling the same way
   g.strokeStyle = 'rgba(20,20,19,.6)';
   g.lineWidth = 1.7;
   g.lineCap = 'round';
   g.beginPath();
   for (let n = 0; n < lobes.length; n += 2) {
     const l = lobes[n], st = set(l), d = l.far * R * 1.16 * grow * (1 + st.spread), r = l.r * grow * st.size;
     if (r < 12) continue;
     const px = c + Math.cos(l.a) * d + r * .34, py = c + Math.sin(l.a) * d * .92 - l.rise * st.up + r * .38;
     for (let i = 0; i < 4; i++) { g.moveTo(px + i * 4.2, py); g.lineTo(px + i * 4.2 - 4, py + 9); }
   }
   g.stroke();
  }
  function frame(t) {
   if (done) return;
   t = Math.max(0, t);
   const now = Math.floor(t * 24);
   if (now === step) return;
   step = now;
   const q = now / 24, boil = now % 3;
   g.setTransform(dpr, 0, 0, dpr, 0, 0);
   g.clearRect(0, 0, S, S);
   if (q >= LIFE) { done = true; return; }
   // the pen ring of pressed air, thinning as it runs out
   {
     const u = clamp(q / .42);
     if (u < 1) {
       const r = R * (.7 + 3 * (1 - (1 - u) ** 2.4));
       g.strokeStyle = INK;
       g.lineWidth = 3.4 * (1 - u) + .5;
       g.beginPath();
       const at = i => { const an = i / 30 * TAU, k = ring[i % 30]; return [c + Math.cos(an) * r * k, c + Math.sin(an) * r * k * .94]; };
       for (let i = 0; i <= 30; i++) { const [px, py] = at(i), [nx, ny] = at(i + 1), mx = (px + nx) / 2, my = (py + ny) / 2; i ? g.quadraticCurveTo(px, py, mx, my) : g.moveTo(mx, my); }
       g.stroke();
     }
   }
   // slivers of ink thrown straight out, thin at both ends
   g.fillStyle = INK;
   for (const s of slivers) {
     const u = (q - s.t0) / .24;
     if (u <= 0 || u >= 1) continue;
     const a = s.a + s.bow, head = s.r0 + s.len * (1 - (1 - u) ** 2) * 1.5, tail = head - s.len * (1 - u), mid = (head + tail) / 2, nx = -Math.sin(a), ny = Math.cos(a), w = s.w * (1 - u * .5);
     g.beginPath();
     g.moveTo(c + Math.cos(a) * tail, c + Math.sin(a) * tail);
     g.lineTo(c + Math.cos(a) * mid + nx * w, c + Math.sin(a) * mid + ny * w);
     g.lineTo(c + Math.cos(a) * head, c + Math.sin(a) * head);
     g.lineTo(c + Math.cos(a) * mid - nx * w, c + Math.sin(a) * mid - ny * w);
     g.closePath();
     g.fill();
   }
   // real light on the page behind the paint, gone as it burns out
   if (q < .7) { const r = R * 3.6; g.globalAlpha = .7 * (1 - q / .7) ** 2 * Math.min(1, q / .04 + .3); g.drawImage(orb, c - r, c - r, r * 2, r * 2); g.globalAlpha = 1; }
   cloud(q, boil);
   // the first instant: white at the heart of it, gone before the cloud has filled
   { const u = q / .13; if (u < 1) { const r = R * (1.2 + u * 1.7); g.globalAlpha = 1 - u * u; g.drawImage(orb, c - r, c - r, r * 2, r * 2); g.globalAlpha = 1; } }
   // dabs flung out and falling
   g.lineCap = 'round';
   for (const b of bits) {
     const u = q - .03;
     if (u <= 0 || u >= b.life) continue;
     const e = u - .018;
     g.strokeStyle = b.col;
     g.lineWidth = b.w * (1 - u / b.life * .5);
     g.beginPath();
     g.moveTo(c + b.vx * u, c + b.vy * u + 520 * u * u);
     g.lineTo(c + b.vx * e, c + b.vy * e + 520 * e * e);
     g.stroke();
   }
  }
  return { frame, get done() { return done; } };
 }
 const api = { open, hole, foil, foilReady, burn, shatter, crackStar, dent, blast, rail, cutter, cutMap, textSheet, flock, crackPath, crackLine };
 root.ReservePlaySpace = api;
 if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
