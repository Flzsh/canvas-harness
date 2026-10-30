/* Canvas Harness play tools: the black hole, rendered. The page tears open (a drawn paper lip, inked, curling) onto deep
 * space: a starfield bent by gravitational lensing (each star's image pushed out to r' = (r + sqrt(r^2 + 4 rE^2)) / 2 and
 * stretched round the hole), a faint nebula, the back end's 0 and 1 streaming in, and the hole itself: a black shadow,
 * a thin blazing photon ring, an accretion disk of orbiting particles (faster inside, Keplerian), white-hot inside and
 * orange out, brighter on the side coming toward us, its far side lensed up over the top and under the bottom.
 * ReservePlaySpace.open(canvas, {size}) -> {frame(t), close(), done}: the caller runs frame(seconds) on animation frames
 * for as long as it lives (a few seconds); nothing runs once it is done. */
(function(root){
 'use strict';
 const TAU = Math.PI * 2;
 function open(cv, { size = 560, reduce = false } = {}) {
  const dpr = Math.min(2, root.devicePixelRatio || 1), W = size, H = Math.round(size * .78); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
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
    if (!reduce) { g.save(); g.filter = 'blur(6px)'; g.globalAlpha = .8; g.drawImage(c, 0, 0, W, H); g.filter = 'blur(20px)'; g.globalAlpha = .5; g.drawImage(c, 0, 0, W, H); g.restore(); }
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
 // A blinding touch and a streak of light across the screen; then space itself is seen: a faint grid over the page that
 // bends toward the line and is drawn in as the collapse runs up and down. The two collapse fronts are curtains of light
 // split into red and blue; behind them the page is gone to a dark void where its own colours race outward along the
 // line in thin streaks. The line is the whole world now: a white-hot core with a shifting rainbow sheen (thin-film
 // colours), beads of light racing along it both ways, lightning crackling on it; then it calms. foil(canvas, x, y,
 // {speed, cols}) -> {frame(t), done, life}; cols: [x, css colour] samples of the page along the line.
 function foil(cv, x0, y0, { speed = 550, reduce = false, cols = [] } = {}) {
  const W = innerWidth, H = innerHeight, k = .7;
  cv.width = Math.ceil(W * k);
  cv.height = Math.ceil(H * k);
  Object.assign(cv.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none' });
  const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
  let seed = 99; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647, far = Math.max(y0, H - y0) + 40, life = far / speed + 1.7, D0 = .15;
  const palette = cols.length ? cols.map(c => c[1]) : ['#5B7FB5', '#C96442', '#3C7D3E', '#2D3B45', '#E2B865'];
  const sparks = [...Array(160)].map(() => ({ x: rnd() * W, t0: .25 + rnd() * (far / speed), v: (rnd() < .5 ? -1 : 1) * (60 + rnd() * 300), c: rnd() < .4 ? '255,236,180' : '200,230,255' }));
  // what the page became: streaks of its own colours, each starting where the front took it and racing out along the line
  const streaks = [...Array(reduce ? 80 : 340)].map(() =>
    ({
      x: rnd() * W,
      dy: 20 + rnd() * far,
      side: rnd() < .5 ? -1 : 1,
      dir: rnd() < .5 ? -1 : 1,
      len: 30 + rnd() * 160,
      v: 500 + rnd() * 1400,
      c: palette[(rnd() * palette.length) | 0],
      w: .8 + rnd() * 1.8
    }));
  const beads = [...Array(9)].map((_, i) => ({ dir: i % 2 ? 1 : -1, ph: rnd(), v: 900 + rnd() * 1300, r: 10 + rnd() * 16 }));
  let done = false, bolts = [], boltT = -1;
  const fan = [...Array(14)].map((_, i) => ({ a: -Math.PI / 2 + (i / 13 - .5) * 2.4 + (rnd() - .5) * .08, h: i / 13 * 300, len: .6 + rnd() * .5 })).concat([...Array(14)].map((_, i) =>
    ({ a: Math.PI / 2 + (i / 13 - .5) * 2.4 + (rnd() - .5) * .08, h: 300 - i / 13 * 300, len: .6 + rnd() * .5 })));
  const glitch = [...Array(reduce ? 0 : 46)].map(() => ({ y: rnd() * H, h: 1 + rnd() * 3.5, x: rnd() * W * .5, w: 120 + rnd() * W * .6, t0: .05 + rnd() * .7, life: .03 + rnd() * .07 }));
  const rainbow = (t, a) => { const q = g.createLinearGradient(0, 0, W, 0); for (let i = 0; i <= 12; i++) q.addColorStop(i / 12, `hsla(${(i * 50 + t * 160) % 360},95%,68%,${a})`); return q; };
  function frame(t) {
   if (done) return; t = Math.max(0, t); g.clearRect(0, 0, W, H); if (t > life) { done = true; return; }
   const d = Math.max(0, t - D0) * speed, cool = clamp((t - (life - 1.2)) / 1.2), fade = Math.pow(1 - cool, 3), top = y0 - d, bot = y0 + d;
   // the void the page has gone to (between the fronts), the page beyond them dimmed by the strike
   g.globalCompositeOperation = 'source-over';
   g.fillStyle = `rgba(30,44,140,${.16 * Math.min(1, t / .1) * fade})`; g.fillRect(0, 0, W, H);
   if (d > 0) {
     const vg = g.createLinearGradient(0, top, 0, bot);
     vg.addColorStop(0, `rgba(10,14,52,${.6 * fade})`);
     vg.addColorStop(.5, `rgba(6,8,34,${.93 * fade})`);
     vg.addColorStop(1, `rgba(10,14,52,${.6 * fade})`);
     g.fillStyle = vg;
     g.fillRect(0, Math.max(0, top), W, Math.min(H, bot) - Math.max(0, top));
   }
   // space, seen: a grid over the page not yet taken, its lines bent toward the line and drawn in near the front
   if (!reduce && fade > 0) { const S = 46; g.lineWidth = 1;
    for (const sgn of [-1, 1]) { const edge = sgn < 0 ? top : bot;
     for (let gy = y0 + sgn * S * .5; sgn < 0 ? gy > -S : gy < H + S; gy += sgn * S) {
       const ahead = sgn * (gy - edge);
       if (ahead < 0) continue;
       const pull = Math.exp(-ahead / 110), yy = gy - sgn * pull * 38, a = (.1 + .55 * pull) * fade * Math.min(1, t / .3);
      g.strokeStyle = `rgba(70,110,255,${a})`;
      g.beginPath();
      for (let x = 0; x <= W; x += 24) {
        const wob = Math.sin(x * .018 + t * 7 + gy) * 5 * pull, sag = Math.exp(-(((x - x0) / (W * .6)) ** 2)) * pull * 16;
        const py = yy + sgn * (wob - sag);
        x ? g.lineTo(x, py) : g.moveTo(x, py);
      }
      g.stroke();
      if (pull > .25) { g.strokeStyle = `rgba(110,150,255,${a * .35})`; g.lineWidth = 5; g.stroke(); g.lineWidth = 1; }
     }
     for (let gx = x0 % S; gx < W; gx += S) {
       const y1 = sgn < 0 ? -10 : H + 10, a = .14 * fade * Math.min(1, t / .3);
       if (sgn * (y1 - edge) <= 0) continue;
       const lean = (gx - x0) * .04;
       g.strokeStyle = `rgba(70,110,255,${a})`;
       g.beginPath();
       g.moveTo(gx, y1);
       g.quadraticCurveTo(gx - lean * .3, (y1 + edge) / 2, gx - lean, edge);
       g.stroke();
     } } }
   g.globalCompositeOperation = 'lighter';
   // the touch: a white flash over everything, a streak of light across the whole screen and a four-pointed flare
   if (t < .5) { const a = 1 - t / .5; g.fillStyle = `rgba(235,242,255,${a * a * .8})`; g.fillRect(0, 0, W, H);
    const st = g.createLinearGradient(0, y0 - 40, 0, y0 + 40);
    st.addColorStop(0, 'rgba(120,170,255,0)');
    st.addColorStop(.5, `rgba(200,225,255,${a})`);
    st.addColorStop(1, 'rgba(120,170,255,0)');
    g.fillStyle = st;
    g.fillRect(0, y0 - 40, W, 80);
    const r = 40 + t * 260, q = g.createRadialGradient(x0, y0, 0, x0, y0, r);
    q.addColorStop(0, `rgba(255,255,255,${a})`);
    q.addColorStop(.25, `rgba(200,225,255,${a * .6})`);
    q.addColorStop(1, 'rgba(120,170,255,0)');
    g.fillStyle = q;
    g.fillRect(x0 - r, y0 - r, r * 2, r * 2);
    g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0 - r * 1.6, y0); g.lineTo(x0 + r * 1.6, y0); g.moveTo(x0, y0 - r * .9); g.lineTo(x0, y0 + r * .9); g.stroke();
    // a ring of pressed space running out from the touch, flattened like everything else will be
    g.globalCompositeOperation = 'source-over';
    const rx = t * W * 1.5;
    g.strokeStyle = `rgba(90,130,255,${a * .8})`;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(x0, y0, rx, rx * .22, 0, 0, TAU);
    g.stroke();
    g.globalCompositeOperation = 'lighter';
   }
   // the touch splits the light like a prism: a fan of colours thrown up and down from it, fading as the line takes over
   if (t < 1) { const a = Math.pow(1 - t, 2), L = Math.max(W, H) * (.25 + t * .9); for (const f of fan) { const ex = x0 + Math.cos(f.a) * L * f.len, ey = y0 + Math.sin(f.a) * L * f.len * .55, sp = .035;
     const q = g.createLinearGradient(x0, y0, ex, ey);
     q.addColorStop(0, `hsla(${f.h},100%,75%,${.5 * a})`);
     q.addColorStop(1, `hsla(${f.h},100%,60%,0)`);
     g.fillStyle = q;
     g.beginPath();
     g.moveTo(x0, y0);
     g.lineTo(x0 + Math.cos(f.a - sp) * L * f.len, y0 + Math.sin(f.a - sp) * L * f.len * .55);
     g.lineTo(x0 + Math.cos(f.a + sp) * L * f.len, y0 + Math.sin(f.a + sp) * L * f.len * .55);
     g.closePath();
     g.fill();
   } }
   // rings of flattened space running out along the line from the touch, one after another
   for (let i = 0; i < 6; i++) {
     const u = t - .08 - i * .16;
     if (u < 0 || u > 1.3) continue;
     const rx = u * W * .9, a = (1 - u / 1.3) * .7 * fade;
     g.strokeStyle = `rgba(190,215,255,${a})`;
     g.lineWidth = 2.2 - u;
     g.beginPath();
     g.ellipse(x0, y0, rx, Math.max(1, rx * .06), 0, 0, TAU);
     g.stroke();
     g.strokeStyle = `rgba(255,140,200,${a * .5})`;
     g.lineWidth = 1;
     g.beginPath();
     g.ellipse(x0, y0, rx * .985, Math.max(1, rx * .06), 0, 0, TAU);
     g.stroke();
   }
   // glitch bars: the screen itself stutters for a moment as it loses a dimension
   for (const b of glitch) {
     const u = t - b.t0;
     if (u < 0 || u > b.life) continue;
     const a = .38 * (1 - u / b.life);
     for (const [c, dx] of [['255,70,110', -5], ['70,190,255', 5], ['255,255,255', 0]]) { g.fillStyle = `rgba(${c},${c === '255,255,255' ? a * .6 : a})`; g.fillRect(b.x + dx, b.y, b.w, b.h); }
   }   // split into red and blue like a torn signal
   // the streaks: taken in by the front, squeezed onto the line, racing out along it in the page's own colours
   g.globalCompositeOperation = 'source-over'; g.lineCap = 'round';
   for (const s of streaks) {
     const tp = D0 + s.dy / speed;
     if (t < tp) continue;
     const u = t - tp, sq = Math.exp(-u * 7), yy = y0 + s.side * s.dy * sq + s.side * (1 - sq) * (rnd() * 0 + 1.2), xx = s.x + s.dir * s.v * u, a = Math.min(1, u * 6) * fade * (.55 + .45 * sq);
    if (xx < -s.len || xx > W + s.len) continue;
    g.globalAlpha = a;
    g.strokeStyle = s.c;
    g.lineWidth = s.w * (.4 + .6 * sq);
    g.beginPath();
    g.moveTo(xx, yy);
    g.lineTo(xx - s.dir * s.len * (1.6 - sq), yy);
    g.stroke();
   }
   g.globalAlpha = 1; g.globalCompositeOperation = 'lighter';
   // the two fronts: shimmering curtains of light split into red and blue, a sheen trailing behind each
   if (d < far) for (const sgn of [-1, 1]) { const y = y0 + sgn * d, wob = x => Math.sin(x * .02 + t * 9) * 2.4 + Math.sin(x * .007 - t * 5) * 3;
    const band = g.createLinearGradient(0, y, 0, y - sgn * 90);
    band.addColorStop(0, `rgba(200,225,255,${.4 * fade})`);
    band.addColorStop(1, 'rgba(200,225,255,0)');
    g.fillStyle = band;
    g.fillRect(0, Math.min(y, y - sgn * 90), W, 90);
    for (const [col, off, w] of [['255,110,110', -2, 1.6], ['120,160,255', 2, 1.6], ['245,250,255', 0, 2.8]]) {
      g.strokeStyle = `rgba(${col},.9)`;
      g.lineWidth = w;
      g.beginPath();
      for (let x = 0; x <= W; x += 16) { const yy = y + wob(x) + off * sgn; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
      g.stroke();
     g.strokeStyle = `rgba(${col},.25)`; g.lineWidth = w * 5; g.stroke(); } }
   // the line: the whole world now. A white-hot core that trembles, its rainbow sheen above and below, beads racing on it
   const reach = Math.min(Math.max(x0, W - x0), t * 9000), x1 = x0 - reach, x2 = x0 + reach, hot = 1 - cool * .75, pulse = .85 + .15 * Math.sin(t * 22);
   {
     const gb = g.createLinearGradient(0, y0 - 80, 0, y0 + 80);
     gb.addColorStop(0, 'rgba(120,170,255,0)');
     gb.addColorStop(.5, `rgba(150,195,255,${.4 * hot * pulse})`);
     gb.addColorStop(1, 'rgba(120,170,255,0)');
     g.fillStyle = gb;
     g.fillRect(x1, y0 - 80, x2 - x1, 160);
   }
   for (const [off, a, w] of [[-7, .45, 1.6], [-4, .65, 1.4], [4, .65, 1.4], [7, .45, 1.6], [-12, .22, 3], [12, .22, 3]]) {
     g.strokeStyle = rainbow(t + off * .01, a * hot);
     g.lineWidth = w;
     g.beginPath();
     g.moveTo(x1, y0 + off);
     g.lineTo(x2, y0 + off);
     g.stroke();
   }
   const tremble = x => Math.sin(x * .031 - t * 24) * 1.3 * hot + Math.sin(x * .011 + t * 9) * .8 * hot;
   for (const [col, w] of [['150,200,255,.35', 16 * hot + 2], ['190,225,255,.6', 6 * hot + 1.5], ['255,255,255,1', (2.6 * pulse) * hot + .7]]) {
     g.strokeStyle = `rgba(${col})`;
     g.lineWidth = w;
     g.beginPath();
     for (let x = x1; x <= x2 + 16; x += 16) { const yy = y0 + tremble(x); x === x1 ? g.moveTo(x, yy) : g.lineTo(Math.min(x, x2), yy); }
     g.stroke();
   }
   if (t > .3)
     for (const b of beads) {
       const bx = x0 + b.dir * (((t * b.v) / W + b.ph) % 1) * W * .9, r = b.r * hot;
       if (Math.abs(bx - x0) > reach) continue;
       const q = g.createRadialGradient(bx, y0, 0, bx, y0, r);
       q.addColorStop(0, `rgba(255,255,255,${.95 * hot})`);
       q.addColorStop(.3, `rgba(190,220,255,${.5 * hot})`);
       q.addColorStop(1, 'rgba(150,200,255,0)');
       g.fillStyle = q;
       g.fillRect(bx - r, y0 - r, r * 2, r * 2);
    g.strokeStyle = `rgba(255,255,255,${.6 * hot})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx - b.dir * r * 4, y0); g.lineTo(bx, y0); g.stroke(); }
   // lightning along the line, re-struck every few frames, and sparks thrown off it and pulled back
   if (!reduce && t < life - .8 && (boltT < 0 || t - boltT > .06)) {
     boltT = t;
     bolts = [...Array(6)].map(() => {
       const xa = Math.max(0, Math.min(W, x0 + (rnd() - .5) * reach * 2)), len = 80 + rnd() * 300, pts = [];
       for (let i = 0; i <= 12; i++) pts.push([xa + len * i / 12, y0 + (rnd() - .5) * 34 * Math.sin(i / 12 * Math.PI)]);
       return pts;
     });
   }
   if (t < life - .8)
     for (const b of bolts) {
       for (const [col, w] of [['150,200,255,.3', 5], ['240,248,255,.95', 1.4]]) {
         g.strokeStyle = `rgba(${col})`;
         g.lineWidth = w;
         g.beginPath();
         b.forEach(([bx, by], i) => i ? g.lineTo(bx, by) : g.moveTo(bx, by));
         g.stroke();
       }
     }
   for (const s of sparks) {
     const u = t - s.t0;
     if (u < 0 || u > 1.1) continue;
     const yy = y0 + s.v * u - s.v * u * u * 1.1, a = 1 - u / 1.1;
     g.fillStyle = `rgba(${s.c},${a})`;
     g.beginPath();
     g.arc(s.x, yy, 1.7, 0, TAU);
     g.fill();
   }
   g.globalCompositeOperation = 'source-over';
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
   const dpr = Math.min(2, root.devicePixelRatio || 1);
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
 // ---------------------------------------------------------------- the black hole, opened in the page: it pulls, the page breaks in
 // It appears as a point and grows. Its pull reaches further and further: cracks run out across the page from it, joined
 // into a web by rings; the pieces between them come loose, nearest first, lift and are dragged in on spirals, drawn out
 // as they fall; behind them is the back end, dark, its 0 and 1 streaming into the hole, and the hole itself (a true
 // black shadow, a blazing photon ring, an orbiting disk whose far side is lensed over the top, with bloom). Closing,
 // everything falls in. Full screen. hole(canvas, x, y, {paper}) -> {frame(t), close(t), closeNow(), done, timeAt(d),
 // reachMax}: timeAt(d) is when its pull reaches a point d px away (for the caller's letters).
 function hole(cv, x, y, { reduce = false, paper = '#FFFFFF', dark = null } = {}) {
  const SLOW = 2;   // the whole thing runs this much slower than the times written below
  const W = innerWidth, H = innerHeight, K = Math.min(1.25, root.devicePixelRatio || 1);
  cv.width = Math.ceil(W * K);
  cv.height = Math.ceil(H * K);
  Object.assign(cv.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none' });
  const g = cv.getContext('2d');
  if (dark) { dark.width = cv.width; dark.height = cv.height; Object.assign(dark.style, { position: 'fixed', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none' }); }
  const gd = dark?.getContext('2d');
  let seed = 5150; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const far = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)),
    Rmax = Math.min(far * 1.05, Math.max(W, H) * .62),
    rsMax = clamp(Math.min(W, H) * .1, 44, 96),
    r0 = 10,
    GROW = 4.2;
  const front = t => Rmax * Math.pow(clamp((t - .25) / (GROW - .25)), .8), when = r => .25 + (GROW - .25) * Math.pow(clamp(r / Rmax), 1.25);
  const RS0 = 3.5, GK = Math.log(rsMax / RS0) / 4.3, rsAt = t => {
    const e = RS0 * Math.exp(GK * t);
    return e * rsMax / Math.cbrt(e * e * e + rsMax * rsMax * rsMax);
  }, ease3 = u => 1 - Math.pow(1 - clamp(u), 3);
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
  const rays = [...Array(reduce ? 0 : 170)].map(() =>
    ({ r0: Rmax * (.25 + .9 * rnd()), a0: rnd() * TAU, ph: rnd(), sp: .18 + rnd() * .16, w: .5 + rnd() * 1.1, c: rnd() < .5 ? '255,244,220' : rnd() < .5 ? '210,226,255' : '255,214,160' }));
  let dim = 0;
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
  const bits = [...Array(reduce ? 200 : 720)].map(() =>
    ({ r0: r0 + (Rmax * .8 - r0) * Math.sqrt(rnd()), a0: rnd() * TAU, ph: rnd(), v: rnd() < .5 ? '0' : '1', s: 11 + rnd() * 7, c: rnd() < .3 ? '#E4FAD8' : '#8BE07A', sp: .16 + rnd() * .12 }));
  // the disk: particles on circular orbits in a plane seen almost edge on, drawn on two small layers and bloomed
  const COSI = .2, parts = [...Array(reduce ? 500 : 1300)].map(() => ({ u: Math.pow(rnd(), 1.6), a: rnd() * TAU, len: .06 + rnd() * .18, b: .45 + rnd() * .55 }));
  const TINT = [[255, 236, 196], [255, 214, 140], [255, 160, 80], [220, 90, 40]], ti = k => k < .15 ? 0 : k < .4 ? 1 : k < .7 ? 2 : 3, WID = [1.4, 1.7, 1.1, 1.5];
  // (the disk's layers at a lower resolution: it is all glow, and they are large now that the hole grows big)
  const LS = Math.ceil(rsMax * 4.8 * 2 + 80), KL = K * .6, mk = () => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(LS * KL);
    c.height = Math.ceil(LS * KL);
    return [c, c.getContext('2d')];
  }, [backC, bk] = mk(), [frontC, fr] = mk();
  const bloom = c => {
    const X = x - LS / 2, Y = y - LS / 2;
    g.globalCompositeOperation = 'lighter';
    if (!reduce) { g.save(); g.filter = 'blur(6px)'; g.globalAlpha = .8; g.drawImage(c, X, Y, LS, LS); g.filter = 'blur(18px)'; g.globalAlpha = .5; g.drawImage(c, X, Y, LS, LS); g.restore(); }
    g.drawImage(c, X, Y, LS, LS);
  };
  function disk(t, rs, fade) {
   const rin = rs * 1.35, rout = rs * 4.6;
   for (const c of [bk, fr]) { c.setTransform(KL, 0, 0, KL, 0, 0); c.clearRect(0, 0, LS, LS); c.translate(LS / 2 - x, LS / 2 - y); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; }
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
       c = ti(p.u),
       al = Math.min(1, p.b * (.45 + .55 * Math.max(0, -Math.cos(a)))) * fade;
    if (Math.sin(a) < 0) { put(0, c, px, py, x2, y2, al, 0); const rl = rs * 1.1 + p.u * rs * 1.35, th = Math.PI + (Math.cos(a) * .5 + .5) * Math.PI, th2 = th - p.len * .7;
     put(1, c, x + Math.cos(th) * rl, y + Math.sin(th) * rl * .96, x + Math.cos(th2) * rl, y + Math.sin(th2) * rl * .96, Math.min(1, al * 1.15), 1);
     put(1, c, x + Math.cos(-th) * rl * .88, y + Math.sin(-th) * rl * .74, x + Math.cos(-th2) * rl * .88, y + Math.sin(-th2) * rl * .74, al * .3, 2);
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
   bloom(backC); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, rs, 0, TAU); g.fill(); bloom(frontC); g.globalCompositeOperation = 'source-over';
  }
  let closing = -1, done = false, last = 0;
  function frame(t) {
   if (done) return; t = Math.max(0, t) / SLOW; last = t;
   const cK = closing < 0 ? 0 : clamp((t - closing) / .55);
   g.setTransform(1, 0, 0, 1, 0, 0);
   g.clearRect(0, 0, cv.width, cv.height);
   if (gd) { gd.setTransform(1, 0, 0, 1, 0, 0); gd.clearRect(0, 0, dark.width, dark.height); }
   if (cK >= 1) { done = true; dim = 0; return; }
   const keep = 1 - cK * cK; g.setTransform(K, 0, 0, K, 0, 0); g.translate(x, y); g.scale(keep, keep); g.translate(-x, -y);
   const F = front(t), rs = rsAt(t), open0 = 1, dR = rs * 1.3;
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
   add([...Array(40)].map((_, i) => [x + Math.cos(i / 40 * TAU) * dR, y + Math.sin(i / 40 * TAU) * dR]));
   for (const c of gone) add(c.poly);
   // its broken edges: only where an open piece meets page still in place
   const lips = new Path2D(), isGone = c => c && t >= c.go, line = pts => {
     let on = false;
     for (const [a, b] of pts) { if (Math.hypot(a - x, b - y) < dR + 2) { on = false; continue; } on ? lips.lineTo(a, b) : lips.moveTo(a, b); on = true; }
   };   // (an edge inside the hole's own disc is gone with it)
   for (let i = 0; i < NR; i++) if (!isGone(cellAt(1, i))) line(seg[0][i].pts.map(([a, b]) => [x + (a - x) * open0, y + (b - y) * open0]));
   for (const c of gone) {
     for (const [o, pts] of [[cellAt(c.k + 1, c.i), c.hi], [cellAt(c.k, (c.i + NR - 1) % NR), c.sideA], [cellAt(c.k, (c.i + 1) % NR), c.sideB], [c.k > 1 ? cellAt(c.k - 1, c.i) : { go: 0 }, c.lo]])
       if (!isGone(o)) line(pts);
   }
   // on the page still in place: the cracks running out and the broken lip of paper along the open edges (the open region,
   // drawn next, covers whatever of them lies inside it)
   const grow = t0 => .55 + .45 * clamp((t - t0) / 1.6);
   for (const R of rad) { let n = 0; while (n < R.pts.length - 1 && R.pts[n + 1][2] <= F) n++; if (n) crackLine(g, R.pts, 3.4 * grow(.25), .6, n / (R.pts.length - 1), .55); }
   for (const b of branches) if (t > b.t0) crackLine(g, b.pts, 1.6 * grow(b.t0), .4, clamp((t - b.t0) / .45), .4);
   for (let k = 1; k < RING.length; k++) for (const s of seg[k]) if (s && t > s.t0) crackLine(g, s.pts, Math.max(1, 2.4 - k * .22) * grow(s.t0), Math.max(.8, 2 - k * .2), clamp((t - s.t0) / .3), .4);
   g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = edgeCol; g.lineWidth = 6.4; g.stroke(lips); g.strokeStyle = 'rgba(20,20,19,.95)'; g.lineWidth = 2.6; g.stroke(lips);
   // behind: the back end, dark, deepest at the hole, its 0 and 1 streaming in on spirals and drawn out as they near it
   g.save(); g.clip(region);
   const bg = g.createRadialGradient(x, y, rs, x, y, Rmax); bg.addColorStop(0, '#010206'); bg.addColorStop(1, '#0a1626'); g.fillStyle = bg; g.fillRect(x - Rmax, y - Rmax, Rmax * 2, Rmax * 2);
   g.globalCompositeOperation = 'lighter'; g.textAlign = 'center'; g.textBaseline = 'middle';
   for (const b of bits) {
     const u = (b.ph + t * b.sp) % 1,
       e = Math.pow(u, 1.5),
       r = rs + (b.r0 - rs) * (1 - e),
       a = b.a0 + e * 3.4,
       px = x + Math.cos(a) * r,
       py = y + Math.sin(a) * r,
       st = 1 + (1 - (r - rs) / (b.r0 - rs + 1)) * 2.2,
       sz = b.s * clamp(.55 + r / 500, .55, 1.1);
    g.save();
    g.translate(px, py);
    g.rotate(a + Math.PI / 2);
    g.scale(sz / 18 / Math.sqrt(st), sz / 18 * st);
    g.globalAlpha = Math.min(1, (1 - u) * 3) * .85;
    g.drawImage(GLYPH[b.v + b.c], -10, -10, 20, 20);
    g.restore();
   }
   g.globalAlpha = 1; disk(t, rs, 1);
   g.globalCompositeOperation = 'source-over';
   for (const [w, a] of [[20, .22], [11, .3], [5, .38]]) { g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = w; g.stroke(lips); }   // a soft shadow under each broken edge (no full-screen blur)
   g.restore();
   // the light of the page is swallowed: it darkens round the hole (darkest near it, deeper as it grows), the open region
   // stays lit by the hole's own light; streaks of light from all over are caught and drawn in on spirals
   dim = Math.pow(clamp(t / 4.6), 1.6) * (1 - cK);
   if (gd && dim > .005) { gd.setTransform(K, 0, 0, K, 0, 0); gd.translate(x, y); gd.scale(keep, keep); gd.translate(-x, -y);
    const dk = gd.createRadialGradient(x, y, dR, x, y, Rmax * 1.25);
    dk.addColorStop(0, `rgba(4,5,26,${.94 * dim})`);
    dk.addColorStop(.3, `rgba(8,10,46,${.82 * dim})`);
    dk.addColorStop(1, `rgba(14,18,70,${.52 * dim})`);
    gd.fillStyle = dk;
    gd.fillRect(x - Rmax * 3, y - Rmax * 3, Rmax * 6, Rmax * 6);
    gd.globalCompositeOperation = 'destination-out'; gd.fill(region); gd.globalCompositeOperation = 'lighter'; gd.lineCap = 'round';
    for (const r of rays) {
      const u = (r.ph + t * r.sp) % 1, pos = v => {
        const e = Math.pow(v, 1.7), rr = dR + (r.r0 - dR) * (1 - e), a = r.a0 + e * 2.6;
        return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
      }, al = dim * Math.sin(Math.PI * u) * .8;
     if (al < .02) continue;
     const [ax, ay] = pos(Math.max(0, u - .035)), [mx, my] = pos(Math.max(0, u - .017)), [bx, by] = pos(u), q = gd.createLinearGradient(ax, ay, bx, by);
     q.addColorStop(0, `rgba(${r.c},0)`);
     q.addColorStop(1, `rgba(${r.c},${al})`);
     gd.strokeStyle = q; gd.lineWidth = r.w * (1 + u * 1.8); gd.beginPath(); gd.moveTo(ax, ay); gd.quadraticCurveTo(mx, my, bx, by); gd.stroke(); }
    gd.globalCompositeOperation = 'source-over'; }
   // the pieces that came away: a breath of lift (their shadow falls on the dark), then dragged in, turning, drawn out
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
   g.globalAlpha = 1;
  }
  // (with reduced motion its clock stands still, so closing ends it at once)
  const reachMax = Math.min(Rmax * .75, 650);
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
  }, get done() { return done; }, get dim() { return dim; }, timeAt: d => when(d / .85) * SLOW, closeAt: 4800 * SLOW, reachMax, W, H };
 }
 // ---------------------------------------------------------------- the bomb's mark: the page shattered, a hole onto the back end
 // A jagged hole (the caller lays the back end, streams of 0 and 1, under it) with a thin broken lip of paper, chips
 // lifted along it and a shadow inside; cracks run out from its corners, some branching, a few joined by a ring further
 // out. It breaks open in a quarter of a second, then stays. shatter(canvas, x, y, R) -> {frame(t), done, outline}.
 function shatter(cv, x, y, R, { reduce = false } = {}) {
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
  let done = false;
  function frame(t) {
   if (done) return; const p = reduce ? 1 : clamp(t / .28), e = 1 - Math.pow(1 - p, 3), k = .55 + .45 * (1 - Math.pow(1 - clamp(t / .12), 3)), hp = holePath(reduce ? 1 : k);
   g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
   // the shadow inside the hole, under its lip
   g.save(); g.clip(hp); g.filter = 'blur(4px)'; g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineWidth = 12; g.stroke(hp); g.restore();
   for (const cr of cracks) crackLine(g, cr.pts, cr.w, .5, e, .5);
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
   if (p >= 1 && t > .3) done = true;
  }
  const outline = hole.map(([hx, hy, a]) => [x + (hx - c) + Math.cos(a) * 2, y + (hy - c) + Math.sin(a) * 2]);
  return { frame, get done() { return done; }, outline };
 }
 // ---------------------------------------------------------------- the hammer's mark: the page cracked where it was struck
 // A crushed point and a star of cracks running out of it. Struck again in the same place, the cracks run further, branch
 // and join into a web: the same seed, so a second blow extends the first instead of drawing a new one. No dent, no grey
 // shading, only the breaks (a third blow breaks through: the caller uses shatter). crackStar(canvas, x, y, R, level, {seed}).
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
      pts = crackPath(c + Math.cos(a) * R * .07, c + Math.sin(a) * R * .07, a, len, rnd, .26, 8);
   const bf = .4 + rnd() * .3, bs = rnd() < .5 ? -1 : 1, bl = len * (.25 + rnd() * .25), bOn = rnd() < .5, bseed = rnd();
   if (!shown) continue; mains.push({ pts, a }); cracks.push({ pts, w: 1.6 + level * .55 });
   if (level >= 2 && bOn) {
     const at = pts[Math.floor(pts.length * bf)];
     let s2 = 7 + Math.floor(bseed * 1e5);
     const r2 = () => (s2 = (s2 * 48271) % 2147483647) / 2147483647;
     cracks.push({ pts: crackPath(at[0], at[1], a + bs * (.5 + bseed * .4), bl, r2, .26, 8), w: 1.1 + level * .3 });
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
  let done = false;
  function frame(t) {
   if (done) return; const p = reduce ? 1 : clamp(t / .2), e = 1 - Math.pow(1 - p, 3);
   g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
   for (const cr of cracks) crackLine(g, cr.pts, cr.w, .4, e, level >= 2 ? .35 : 0);
   const cp = new Path2D(); crush.forEach(([a, b], i) => i ? cp.lineTo(a, b) : cp.moveTo(a, b)); cp.closePath();
   g.lineJoin = 'miter';
   g.strokeStyle = 'rgba(255,255,255,.85)';
   g.lineWidth = 1.2;
   g.save();
   g.translate(-.8, -.8);
   g.stroke(cp);
   g.restore();
   g.strokeStyle = 'rgba(20,20,19,.92)';
   g.lineWidth = 1.3;
   g.stroke(cp);
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
 function blast(cv, x, y, R, { reduce = false } = {}) {
  const S = Math.ceil(R * 7), dpr = sized(cv, S, x, y), g = cv.getContext('2d'), c = S / 2; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let seed = 61; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const P = [...Array(reduce ? 0 : 190)].map(() => { const a = rnd() * TAU, v = (.35 + rnd() * .65) * R * 9; return { a, v, s: R * (.12 + rnd() * .3), life: .55 + rnd() * .6, spin: rnd() }; });
  const ramp = [[0, [255, 252, 236]], [.12, [255, 226, 140]], [.35, [250, 156, 60]], [.62, [190, 72, 34]], [.85, [80, 40, 26]], [1, [40, 26, 20]]];
  const colAt = u => {
    for (let i = 1; i < ramp.length; i++) if (u <= ramp[i][0]) { const [u0, c0] = ramp[i - 1], [u1, c1] = ramp[i]; return mixc(c0, c1, (u - u0) / (u1 - u0)); }
    return ramp[ramp.length - 1][1];
  };
  let done = false; const LIFE = reduce ? .01 : 1.3;
  function frame(t) {
   if (done) return; g.clearRect(0, 0, S, S); if (t > LIFE) { done = true; return; }
   // the flash at the heart
   const fl = Math.max(0, 1 - t / .22);
   if (fl > 0) {
     const q = g.createRadialGradient(c, c, 0, c, c, R * 2.6);
     q.addColorStop(0, `rgba(255,255,245,${fl})`);
     q.addColorStop(.35, `rgba(255,220,140,${fl * .7})`);
     q.addColorStop(1, 'rgba(255,160,60,0)');
     g.globalCompositeOperation = 'lighter';
     g.fillStyle = q;
     g.fillRect(0, 0, S, S);
   }
   // the particles: drag slows them (distance = v (1 - e^-kt) / k), they rise as they cool; young ones add light
   for (const p of P) {
     const u = t / p.life;
     if (u >= 1) continue;
     const k = 4.2,
       d = p.v * (1 - Math.exp(-k * t)) / k,
       px = c + Math.cos(p.a) * d,
       py = c + Math.sin(p.a) * d * .85 - 60 * t * t,
       r = p.s * (1 + u * 1.8),
       col = colAt(u),
       a = (u < .1 ? u / .1 : 1) * (1 - u) * .9;
    g.globalCompositeOperation = u < .64 ? 'lighter' : 'source-over';
    const q = g.createRadialGradient(px, py, 0, px, py, r);
    q.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${u > .7 ? a * .55 : a})`);
    q.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0)`);
    g.fillStyle = q;
    g.fillRect(px - r, py - r, r * 2, r * 2);
   }
   g.globalCompositeOperation = 'source-over';
  }
  return { frame, get done() { return done; } };
 }
 const api = { open, hole, foil, burn, shatter, crackStar, dent, blast, crackPath, crackLine }; root.ReservePlaySpace = api; if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
