/* Canvas Harness play physics. Viewport pixels and seconds; no DOM or layout in the solver. */
(function(root){
'use strict';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
// how far from the far side of the window a pile may rise, as a share of the window (each body a little different, so a full pile is a heap, not one line)
const PILE_REACH = .12, pileLimit = (extent, size, share) => size + 8 >= extent ? extent / 2 : extent * share;
// A wall's pile: a height per column, and the highest it has reached, so a body far from the wall never looks it up.
class Pile extends Map {
  top = 0;
  set(key, value) { if (value > this.top) this.top = value; return super.set(key, value); }
  delete(key) { const had = super.delete(key); if (!this.size) this.top = 0; return had; }
  clear() { super.clear(); this.top = 0; }
}
function create(options = {}) {
  const bodies = [],
    members = new Set(),
    floor = new Pile(),
    walls = { bottom: floor, top: new Pile(), left: new Pile(), right: new Pile() },
    attractors = new Map(),
    listeners = new Set(),
    dirty = new Set(),
    loopers = [];
  let width = Math.max(32, finite(options.width, 800)),
    height = Math.max(32, finite(options.height, 600)),
    gravity = { x: finite(options.gravity?.x), y: finite(options.gravity?.y, 2300) },
    portals = [],
    serial = 0,
    time = 0,
    quiet = 0,
    unsaid = false,
    stepped = false;
  let reduced = !!options.reduced; const maxSpeed = clamp(finite(options.maxSpeed, 1200), 100, 1800); let topSpeed = maxSpeed; const drag = Math.max(0, finite(options.drag, .35));
  // listeners hear about a change once per batch, however many bodies it touched
  const notify = () => { if (quiet) unsaid = true; else for (const fn of listeners) fn(); }, changed = b => { if (b) dirty.add(b); notify(); }, active = b => !!b && !b.retired && members.has(b);
  const batch = fn => { quiet++; try { return fn(); } finally { if (!--quiet && unsaid) { unsaid = false; notify(); } } };
  const unpile = b => {
    if (!b.pile) return;
    for (const [map, key, value] of b.pile) { const next = (map.get(key) || 0) - value; if (next > .001) map.set(key, next); else map.delete(key); }
    b.pile = null;
    b.seat = '';
  };
  const sideOfGravity = () => Math.abs(gravity.x) > Math.abs(gravity.y) ? gravity.x < 0 ? 'left' : 'right' : gravity.y < 0 ? 'top' : 'bottom';
  const bins = (b, side) => {
    const horizontal = side === 'bottom' || side === 'top', center = horizontal ? b.x : b.y, span = horizontal ? b.width : b.height;
    return [Math.floor((center - span * .45) / 7), Math.floor((center + span * .45) / 7)];
  };
  const pileHeight = (b, side) => {
    const map = walls[side];
    if (!map.size) return 0;
    const [a, z] = bins(b, side);
    let h = 0;
    for (let i = a; i <= z; i++) { const v = map.get(i); if (v > h) h = v; }
    return h;
  };
  // (gap: how far the body's edge is from that wall; further than the pile has ever reached, it cannot be touching it)
  // the part of the pile a body can land on: a stack taller than it is beside it, so it falls past instead of being lifted up; with stacks all across it is buried and stays where it is
  const pileNear = (b, gap, side) => {
    if (b.seat === side) return b.seatAt;
    if (gap > 4 + walls[side].top) return 0;
    const map = walls[side], [a, z] = bins(b, side);
    let h = 0, open = false;
    for (let i = a; i <= z; i++) { const v = map.get(i) || 0; if (v > gap + 16) continue; open = true; if (v > h) h = v; }
    return open || side !== sideOfGravity() ? h : Math.max(0, gap - 4);
  };
  const limitPosition = b => {
    b.x = clamp(b.x, Math.min(b.width / 2 + 4, width / 2), Math.max(width / 2, width - b.width / 2 - 4));
    b.y = clamp(b.y, Math.min(b.height / 2 + 4, height / 2), Math.max(height / 2, height - b.height / 2 - 4));
  };
  function deposit(b, side) {
    if (b.pile || b.thin) return;
    const horizontal = side === 'bottom' || side === 'top',
      extent = horizontal ? height : width,
      size = horizontal ? b.height : b.width,
      depth = side === 'bottom' ? height - 4 - b.y + b.height / 2 : side === 'top' ? b.y - 4 + b.height / 2 : side === 'left' ? b.x - 4 + b.width / 2 : width - 4 - b.x + b.width / 2,
      map = walls[side],
      [a, z] = bins(b, side);
    b.pile = [];
    for (let i = a; i <= z; i++) { const old = map.get(i) || 0, next = Math.max(old, Math.min(extent - size - 8, depth)); if (next > old) { map.set(i, next); b.pile.push([map, i, next - old]); } }
  }
  // a landing body takes its place at once, so the next one lands on top of it, not through it; it keeps the height it landed on while it bounces
  function seat(b, side) {
    b.seatAt = Math.max(0, (side === 'bottom' ? height - b.y - b.height / 2 : side === 'top' ? b.y - b.height / 2 : side === 'left' ? b.x - b.width / 2 : width - b.x - b.width / 2) - 4);
    b.seat = side;
    deposit(b, side);
  }
  function settle(b, side = sideOfGravity()) {
    if (!b || b.retired) return;
    unpile(b);
    const h = pileHeight(b, side);
    if (side === 'bottom') b.y = height - 4 - h - b.height / 2;
    if (side === 'top') b.y = 4 + h + b.height / 2;
    if (side === 'left') b.x = 4 + h + b.width / 2;
    if (side === 'right') b.x = width - 4 - h - b.width / 2;
    limitPosition(b);
    b.vx = b.vy = b.spin = b.still = 0;
    b.awake = b.dragged = false;
    b.constraint = null;
    deposit(b, side);
    changed(b);
  }
  const wake = b => { if (!active(b)) return; unpile(b); b.awake = true; b.still = 0; notify(); };
  const speedLimit = b => {
    const squared = b.vx * b.vx + b.vy * b.vy;
    if (squared > topSpeed * topSpeed) { const k = topSpeed / Math.sqrt(squared); b.vx *= k; b.vy *= k; }
    b.spin = clamp(b.spin, -540, 540);
  };
  function add(spec = {}) {
    unpile(spec);
    if (bodies.length >= 400) {
      const oldest = bodies.shift();
      members.delete(oldest);
      settle(oldest, 'bottom');
      oldest.retired = true;
      const i = loopers.indexOf(oldest);
      if (i >= 0) loopers.splice(i, 1);
    }
    const b = {
      ...spec,
      id: ++serial,
      x: finite(spec.x),
      y: finite(spec.y),
      width: Math.max(1, finite(spec.width, 12)),
      height: Math.max(1, finite(spec.height, 16)),
      vx: finite(spec.vx),
      vy: finite(spec.vy),
      angle: finite(spec.angle),
      spin: finite(spec.spin),
      awake: true,
      dragged: false,
      retired: false,
      still: 0,
      teleports: 0,
      portalBlocked: false,
      constraint: null,
      pile: null
    };
    b.tumble = Math.min(1, 44 / b.width);
    speedLimit(b);
    bodies.push(b);
    members.add(b);
    changed(b);
    return b;
  }
  function remove(b) {
    if (!members.delete(b)) return;
    unpile(b);
    bodies.splice(bodies.indexOf(b), 1);
    const k = loopers.indexOf(b);
    if (k >= 0) loopers.splice(k, 1);
    b.awake = b.dragged = false;
    b.retired = true;
    dirty.delete(b);
    changed();
  }
  function force(b, x, y) { if (!active(b)) return; wake(b); b.vx += finite(x); b.vy += finite(y); speedLimit(b); }
  function constrain(b, spec) {
    if (!active(b)) return;
    wake(b);
    b.constraint = { length: 0, stiffness: 90, damping: 18, sway: 0, ...spec };
    if (reduced) {
      b.x = b.constraint.x;
      b.y = b.constraint.y + b.constraint.length;
      limitPosition(b);
      if (spec.angle !== undefined) b.angle = spec.angle;
      b.vx = b.vy = b.spin = 0;
      b.awake = false;
      changed(b);
    }
    return b.constraint;
  }
  function release(b) { if (!active(b)) return; b.constraint = null; wake(b); if (reduced) settle(b); }
  function dragStart(b, x, y, stamp = 0) {
    if (!active(b)) return;
    wake(b);
    b.dragged = true;
    b.grab = { x: b.x - x, y: b.y - y, lastX: x, lastY: y, stamp, vx: 0, vy: 0, teleports: b.teleports };
    b.vx = b.vy = b.spin = 0;
  }
  function dragMove(b, x, y, stamp = 0) {
    if (!b?.dragged) return;
    const g = b.grab, dt = clamp((stamp - g.stamp) / 1000, .008, .1);
    g.vx = (x - g.lastX) / dt;
    g.vy = (y - g.lastY) / dt;
    g.lastX = x;
    g.lastY = y;
    g.stamp = stamp;
    const oldX = b.x, oldY = b.y;
    b.x = x + g.x;
    b.y = y + g.y;
    b.vx = g.vx;
    b.vy = g.vy;
    speedLimit(b);
    teleport(b, oldX, oldY);
    if (b.teleports !== (g.teleports || 0)) { g.x = b.x - x; g.y = b.y - y; g.vx = b.vx; g.vy = b.vy; g.teleports = b.teleports; }
    limitPosition(b);
    changed(b);
  }
  function dragEnd(b, stamp = 0) {
    if (!b?.dragged) return;
    const g = b.grab, fresh = stamp - g.stamp <= 100;
    b.dragged = false;
    b.grab = null;
    b.vx = fresh ? g.vx : 0;
    b.vy = fresh ? g.vy : 0;
    b.spin = b.vx * .12 * b.tumble;
    speedLimit(b);
    wake(b);
    if (reduced) { if (b.constraint) constrain(b, b.constraint); else settle(b); }
  }
  function setGravity(x, y, limit) {
    gravity = { x: finite(x), y: finite(y) };
    topSpeed = clamp(finite(limit, maxSpeed), maxSpeed, 1800);
    batch(() => { for (const b of bodies) wake(b); if (reduced) for (const b of bodies) if (!b.dragged) { if (b.constraint) constrain(b, b.constraint); else settle(b); } });
  }
  function setAttractor(id, spec) {
    attractors.set(id, { strength: 2200, radius: 130, ...spec });
    const reach = (spec.radius || 130) ** 2;
    batch(() => { for (const b of bodies) { const dx = b.x - spec.x, dy = b.y - spec.y; if (dx * dx + dy * dy < reach) wake(b); } });
  }
  function removeAttractor(id) { attractors.delete(id); }
  function setPortals(pair) {
    portals = pair.slice(0, 2).map(p => ({ ...p, size: clamp(finite(p.size, 80), 40, 220), angle: finite(p.angle, -Math.PI / 2) }));
    batch(() => { for (const b of bodies) if (!b.portalBlocked) wake(b); });
  }
  // A portal has two faces and takes what comes at either: whatever goes in leaves the other portal by its front, moving outward. (From the back the turn is a half turn less, so the
  // way through still points out of the front.) A body in the hand gets longer before it can go back in, or the hand still moving the same way would throw it straight back.
  function teleport(b, oldX, oldY) {
    if (portals.length !== 2 || b.portalBlocked || time < (b.portalUntil || 0)) return;
    for (let i = 0; i < 2; i++) {
      const a = portals[i],
        nx = Math.cos(a.angle),
        ny = Math.sin(a.angle),
        px = clamp(a.x, Math.min(width / 2, 4 + b.width / 2), Math.max(width / 2, width - 4 - b.width / 2)),
        py = clamp(a.y, Math.min(height / 2, 4 + b.height / 2), Math.max(height / 2, height - 4 - b.height / 2)),
        before = (oldX - px) * nx + (oldY - py) * ny,
        after = (b.x - px) * nx + (b.y - py) * ny,
        along = b.vx * nx + b.vy * ny,
        front = before >= 0 && after <= 0 && along < 0;
      if (!front && !(before <= 0 && after >= 0 && along > 0)) continue;
      const fraction = before / (before - after || 1), tangent = -(oldX + (b.x - oldX) * fraction - a.x) * ny + (oldY + (b.y - oldY) * fraction - a.y) * nx;
      if (Math.abs(tangent) > a.size / 2) continue;
      const out = portals[1 - i],
        rotation = out.angle - a.angle + (front ? Math.PI : 0),
        c = Math.cos(rotation),
        s = Math.sin(rotation),
        vx = b.vx,
        ex = Math.cos(out.angle),
        ey = Math.sin(out.angle),
        clearance = Math.abs(ex) * b.width / 2 + Math.abs(ey) * b.height / 2 + 6,
        offset = clamp(front ? -tangent : tangent, -out.size * .4, out.size * .4);
      unpile(b);
      b.vx = vx * c - b.vy * s;
      b.vy = vx * s + b.vy * c;
      b.x = out.x + ex * clearance - ey * offset;
      b.y = out.y + ey * clearance + ex * offset;
      b.angle += rotation * 180 / Math.PI;
      b.portalUntil = time + (b.dragged ? .4 : .045);
      b.teleports++;
      if (!loopers.includes(b)) { loopers.push(b); while (loopers.length > 60) { const oldest = loopers.shift(); if (oldest.awake) { oldest.portalBlocked = true; settle(oldest, 'bottom'); } } }
      return;
    }
  }
  function collide(b) {
    let contact = false;
    const halfW = b.width / 2,
      halfH = b.height / 2,
      reach = PILE_REACH + (b.id % 9) * .012,
      left = Math.min(pileLimit(width, b.width, 1 - reach), 4 + pileNear(b, b.x - halfW, 'left') + halfW),
      right = Math.max(pileLimit(width, b.width, reach), width - 4 - pileNear(b, width - b.x - halfW, 'right') - halfW),
      top = Math.min(pileLimit(height, b.height, 1 - reach), 4 + pileNear(b, b.y - halfH, 'top') + halfH),
      bottom = Math.max(pileLimit(height, b.height, reach), height - 4 - pileNear(b, height - b.y - halfH, 'bottom') - halfH);
    const hit = (axis, edge, normal) => {
      b[axis] = edge;
      const key = axis === 'x' ? 'vx' : 'vy', tangent = axis === 'x' ? 'vy' : 'vx', speed = b[key] * normal;
      if (speed < 0) {
        b[key] = speed < -110 && !reduced ? -b[key] * .34 : 0;
        b[tangent] *= .64;
        b.spin = reduced ? 0 : (-b.spin * .35 + b[tangent] * .08 + (b.id % 2 ? 1 : -1) * Math.min(40, Math.abs(speed) * .06)) * b.tumble;
      }
      contact = axis === 'x' ? normal > 0 ? 'left' : 'right' : normal > 0 ? 'top' : 'bottom';
    };
    if (b.x <= left) hit('x', left, 1); else if (b.x >= right) hit('x', right, -1);
    if (b.y <= top) hit('y', top, 1); else if (b.y >= bottom) hit('y', bottom, -1);
    return contact;
  }
  function integrate(b, dt, decay, spinDecay, weightless) {
    if (!b.awake || b.dragged) return;
    if (reduced && !b.constraint) { settle(b); return; }
    const oldX = b.x, oldY = b.y;
    let ax = gravity.x, ay = gravity.y;
    for (const a of attractors.values()) {
      const dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < a.radius && d > .01) { const k = a.strength * (1 - d / a.radius) / d; ax += dx * k; ay += dy * k; }
    }
    const q = b.constraint;
    if (q) {
      const dx = q.x + Math.sin(time * 2.3 + b.id) * q.sway - b.x, dy = q.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (!q.length) { ax = dx * q.stiffness - b.vx * q.damping; ay = dy * q.stiffness - b.vy * q.damping; }
      else if (d > q.length) { const tension = (d - q.length) * q.stiffness + (-(b.vx * dx + b.vy * dy) / d) * q.damping; ax += dx / d * tension; ay += dy / d * tension; }
    }
    b.vx = (b.vx + ax * dt) * decay;
    b.vy = (b.vy + ay * dt) * decay;
    b.spin *= spinDecay;
    speedLimit(b);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle = (b.angle + b.spin * dt) % 360;
    if (q?.angle !== undefined) { b.spin = 0; b.angle += ((q.angle - b.angle + 540) % 360 - 180) * Math.min(1, dt * 9); }
    teleport(b, oldX, oldY);
    if (!b.awake) return;
    const contact = collide(b);
    if (contact && !q && !b.pile && !weightless && contact === sideOfGravity()) seat(b, contact);
    const slow = b.vx * b.vx + b.vy * b.vy < 196 && Math.abs(b.spin) < 12;
    b.still = slow && (contact || q || weightless) && !q?.sway ? b.still + dt : 0;
    if (b.still > .22) { b.awake = false; b.vx = b.vy = b.spin = 0; if (contact && !q) deposit(b, contact); }
    dirty.add(b);
    stepped = true;
  }
  function step(seconds) {
    const duration = clamp(finite(seconds), 0, .05),
      steps = Math.max(1, Math.ceil(duration * 120)),
      dt = duration / steps,
      decay = Math.exp(-drag * dt),
      spinDecay = Math.exp(-1.2 * dt),
      weightless = gravity.x * gravity.x + gravity.y * gravity.y < 1e-4;
    stepped = false;
    return batch(() => { for (let i = 0; i < steps; i++) { time += dt; for (const b of bodies) integrate(b, dt, decay, spinDecay, weightless); } if (stepped) notify(); return bodies; });
  }
  function clear() {
    for (const b of bodies) { b.awake = b.dragged = false; b.constraint = b.grab = null; b.retired = true; }
    bodies.length = loopers.length = 0;
    members.clear();
    attractors.clear();
    portals = [];
    for (const map of Object.values(walls)) map.clear();
    dirty.clear();
    time = 0;
    changed();
  }
  const api = { setReduced(value) {
    reduced = !!value;
    if (reduced) for (const b of bodies) { if (b.constraint) constrain(b, b.constraint); else settle(b); }
  },
  bodies,
  floor,
  attractors,
  batch,
  add,
  remove,
  step,
  force,
  wake,
  settle,
  setGravity,
  setAttractor,
  removeAttractor,
  constrain,
  release,
  dragStart,
  dragMove,
  dragEnd,
  setPortals,
  clear,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, takeChanges() {
    const list = [...dirty];
    dirty.clear();
    return list;
  }, resize(w, h) {
    width = Math.max(32, w);
    height = Math.max(32, h);
    batch(() => { for (const b of bodies) wake(b); });
  }, get awake() {
    return bodies.some(b => b.awake || b.dragged);
  }, get gravity() {
    return { ...gravity };
  }, get time() { return time; }, get portals() { return portals; }, get looping() { return loopers.length; }, get width() { return width; }, get height() { return height; } };
  return api;
}
function attach(engine, options = {}) {
  const doc = options.document || root.document,
    request = options.requestFrame || root.requestAnimationFrame.bind(root),
    cancel = options.cancelFrame || root.cancelAnimationFrame.bind(root),
    render = options.render || (b => {
    if (b.el) b.el.style.transform = `translate(${b.x - b.homeX}px,${b.y - b.homeY}px) rotate(${b.angle}deg)`;
  });
  let frame = null, last = null, stopped = false, ticking = false, held = false;
  const hidden = () => held || doc?.hidden || doc?.visibilityState === 'hidden';
  const flush = () => { for (const b of engine.takeChanges()) render(b); options.onRender?.(); };
  function wake() {
    if (stopped || ticking || hidden()) return;
    flush();
    if (!engine.awake) { if (frame !== null) cancel(frame); frame = last = null; } else if (frame === null) frame = request(tick);
  }
  function tick(now) {
    frame = null;
    if (stopped || hidden()) { last = null; return; }
    ticking = true;
    const dt = last === null ? 1 / 60 : Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    options.onFrame?.(dt);
    if (stopped || hidden()) { ticking = false; last = null; return; }
    engine.step(dt);
    flush();
    ticking = false;
    if (engine.awake && !stopped && !hidden()) frame = request(tick); else last = null;
  }
  function visibility() { if (hidden()) { if (frame !== null) cancel(frame); frame = last = null; } else wake(); }
  const unsubscribe = engine.subscribe(wake); doc?.addEventListener('visibilitychange', visibility);
  const api = { wake, hold(value) {
    held = !!value;
    visibility();
  }, clear() {
    if (frame !== null) cancel(frame);
    frame = last = null;
    engine.clear();
  }, destroy() {
    stopped = true;
    if (frame !== null) cancel(frame);
    frame = last = null;
    unsubscribe();
    doc?.removeEventListener('visibilitychange', visibility);
  }, get running() { return frame !== null; } };
  wake();
  return api;
}
const api = { create, attach }; root.ReservePlayPhysics = api; if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
