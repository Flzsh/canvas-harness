#!/usr/bin/env node
// Checks course artwork for Canvas Harness and writes a preview page.
//   node scripts/check.cjs <file-or-folder> [more files...] [--out preview.html] [--harness path/to/custom-art.js]
// 1. Runs each SVG through Canvas Harness's own validator.
// 2. Lints for the house style and for the format's traps (things the validator accepts but that will look wrong).
// 3. Writes preview.html: every piece rendered exactly as the extension renders it (an isolated <img>) at the real
//    sizes, animated and still, on the light and the dark page, plus eight frozen moments of each loop.
// Only the .svg files directly in a folder are checked: keep scratch files in a subfolder.
// Exit code 1 if any file is refused. No dependencies.
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const outArg = opt('out'), harness = opt('harness');
// The validator: --harness, else the extension's own file when this skill sits inside the Canvas Harness repository
// (skills/canvas-harness-art/), else the copy in scripts/vendor.
const vendored = path.join(__dirname, 'vendor', 'custom-art.js'), inRepo = path.join(__dirname, '..', '..', '..', 'extension', 'custom-art.js');
const validator = harness ? path.resolve(harness) : fs.existsSync(inRepo) ? inRepo : vendored;
const A = require(validator);
if (validator === inRepo && fs.existsSync(vendored) && fs.readFileSync(inRepo, 'utf8') !== fs.readFileSync(vendored, 'utf8')) console.log('note: scripts/vendor/custom-art.js differs from extension/custom-art.js; using the extension\'s. Refresh the vendored copy.');
if (!args.length) { console.error('Usage: node scripts/check.cjs <file-or-folder> [...] [--out preview.html] [--harness custom-art.js]'); process.exit(2); }
const files = args.flatMap(a => fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter(f => /\.svg$/i.test(f)).map(f => path.join(a, f)) : [a]);
const kindOf = (name, vb) => /icon|mini/i.test(name) ? 'icon' : /border|frame/i.test(name) ? 'border' : /banner|pano|title/i.test(name) ? 'banner' : vb && Math.abs(vb[2] / vb[3] - 1) < .2 ? 'icon' : vb && vb[2] / vb[3] > 5 ? 'banner' : 'border';
const TARGET = { banner: 70000, icon: 6000, border: 14000 }, PARTS = { banner: 40, icon: 4, border: 8 };

// A rough bounding box of a path from its numbers (control points included), good enough to say where a drawing sits.
function pathBox(d) {
  const t = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || [], n = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, box = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (px, py) => { box = [Math.min(box[0], px), Math.min(box[1], py), Math.max(box[2], px), Math.max(box[3], py)]; };
  while (i < t.length) {
    if (/[a-z]/i.test(t[i])) { cmd = t[i++]; if (cmd.toLowerCase() === 'z') { x = sx; y = sy; continue; } }
    const k = cmd.toLowerCase(), rel = cmd === k, a = t.slice(i, i + n[k]).map(Number); if (a.length < n[k] || !n[k]) break; i += n[k];
    if (k === 'h') { x = rel ? x + a[0] : a[0]; } else if (k === 'v') { y = rel ? y + a[0] : a[0]; }
    else if (k === 'a') { x = rel ? x + a[5] : a[5]; y = rel ? y + a[6] : a[6]; }
    else { for (let j = 0; j < a.length - 2; j += 2) add(rel ? x + a[j] : a[j], rel ? y + a[j + 1] : a[j + 1]); x = rel ? x + a[a.length - 2] : a[a.length - 2]; y = rel ? y + a[a.length - 1] : a[a.length - 1]; }
    add(x, y); if (k === 'm') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
  }
  return box[0] === Infinity ? null : box;
}
const overlap = (b, r) => Math.max(0, Math.min(b[2], r[2]) - Math.max(b[0], r[0])) * Math.max(0, Math.min(b[3], r[3]) - Math.max(b[1], r[1]));

let refused = 0; const cards = [];
for (const file of files) {
  const name = path.basename(file), src = fs.readFileSync(file, 'utf8'), notes = [], warn = m => notes.push('  ! ' + m), info = m => notes.push('  - ' + m);
  const vbm = src.match(/viewBox\s*=\s*["']([^"']+)["']/), vb = vbm ? vbm[1].trim().split(/[\s,]+/).map(Number) : null, kind = kindOf(name, vb);
  let asset = null;
  try { asset = A.importSVG(src, name); } catch (e) { refused++; console.log(`REFUSED  ${name}\n  x ${e.message}`); }
  if (!asset) { cards.push({ name, kind, error: true }); continue; }
  const bytes = Buffer.byteLength(asset.svg), css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n'), noKf = css.replace(/@(?:-webkit-)?keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  // --- format traps the validator does not catch
  if (!vb) warn('no viewBox');
  else if (kind === 'banner' && Math.abs(vb[2] / vb[3] - 7) > .2 && !(vb[2] / vb[3] > 9)) warn(`banner viewBox is ${vb[2]}x${vb[3]}; the house size is 1680x240 (or 2400x240 for "cover")`);
  else if (kind === 'icon' && Math.abs(vb[2] - vb[3]) > 1) warn('icon viewBox should be square (0 0 100 100)');
  else if (kind === 'border' && Math.abs(vb[2] / vb[3] - 360 / 110) > .5) warn(`border viewBox is ${vb[2]}x${vb[3]}; the house size is 360x110`);
  if (/<text[\s>]/.test(src)) warn('<text> found: no fonts reach an isolated image. Draw the lettering as paths.');
  if (/<(rect|circle|ellipse|line|polygon|polyline)[\s/>]/.test(src)) warn('ruled shapes (rect/circle/ellipse/line/poly) found: draw visible things as hand-made paths.');
  if (/<filter[\s>]/.test(src)) warn('filter found: slow when animated, and not the house look.');
  if (/<(linear|radial)Gradient[\s>]/.test(src)) warn('gradient found: the house style uses flat washes.');
  if (/currentColor/i.test(src)) warn('currentColor has no meaning in an isolated image; write the colour.');
  if (/prefers-color-scheme/.test(src)) warn('prefers-color-scheme follows the system, not the Canvas Harness theme. Remove it.');
  if (/<!--/.test(src)) info('XML comments found: fine, but they count toward the size. Ship without them.');
  // a class that sets a paint property silently overrides the same presentation attribute on its elements
  const classProps = new Map();
  for (const m of noKf.matchAll(/([^{}]+)\{([^{}]*)\}/g)) for (const sel of m[1].split(',')) { const one = sel.trim().match(/^\.([A-Za-z_][\w-]*)$/); if (one) for (const p of m[2].matchAll(/(?:^|;)\s*(stroke|fill|stroke-width|opacity|stroke-opacity|fill-opacity)\s*:/g)) (classProps.get(one[1]) || classProps.set(one[1], new Set()).get(one[1])).add(p[1]); }
  const clashes = new Set();
  for (const m of src.matchAll(/<(?:path|g|use)\b([^>]*)>/g)) { const cls = (m[1].match(/\sclass\s*=\s*["']([^"']+)["']/) || [])[1]; if (!cls) continue; for (const c of cls.split(/\s+/)) for (const p of classProps.get(c) || []) if (new RegExp('\\s' + p + '\\s*=').test(m[1])) clashes.add(`.${c} sets ${p}`); }
  if (clashes.size) warn(`a class overrides the same attribute on its element (${[...clashes].slice(0, 4).join('; ')}${clashes.size > 4 ? '; ...' : ''}): the attribute is ignored. Use a separate class.`);
  const hidden = (src.match(/\sopacity\s*=\s*["']0(?:\.0*)?["']|visibility\s*=\s*["']hidden["']|display\s*=\s*["']none["']/g) || []).length;
  if (hidden) info(`${hidden} element(s) hidden at rest: right for extra poses, wrong for anything that belongs in the still picture.`);
  if (/stroke-dashoffset\s*=\s*["'](?!0["'])/.test(src) || /[{;]\s*stroke-dashoffset\s*:\s*(?!0\s*[;}])[^;}]+[;}]/.test(noKf)) warn('a base stroke-dashoffset hides a line at rest: the still copy will show it missing. Hide lines only inside keyframes.');
  if (/[{;]\s*opacity\s*:\s*0(?:\.0*)?\s*[;}]/.test(noKf)) warn('a CSS rule sets opacity:0 outside keyframes. The still copy keeps that rule; if this is an extra pose, good, otherwise it is missing from the still picture.');
  for (const m of src.matchAll(/<animateMotion\b[^>]*>/g)) { const p = (m[0].match(/\bpath\s*=\s*["']([^"']+)/) || [])[1]; if (p && !/^\s*[Mm]\s*0(?:\.0*)?[\s,]+-?0(?:\.0*)?(?![\d.])/.test(p)) warn('animateMotion path does not start at "M0 0". The still copy removes all SMIL, so the thing must be DRAWN at its rest position and the path must be relative to it (start at M0 0).'); }
  // --- where things sit
  const boxes = [...src.matchAll(/<path\b[^>]*\sd\s*=\s*["']([^"']+)["']/g)].map(m => pathBox(m[1])).filter(Boolean), transformed = /<g\b[^>]*\stransform\s*=/.test(src);
  if (kind === 'border' && vb && !transformed) {
    const text = [80, 16, 330, 80], icon = [8, 60, 62, 108];
    const inText = boxes.filter(b => (b[2] - b[0]) * (b[3] - b[1]) < 6000 && overlap(b, text) > 40).length, inIcon = boxes.filter(b => (b[2] - b[0]) * (b[3] - b[1]) < 3000 && overlap(b, icon) > 120).length;
    if (inText) warn(`${inText} drawing(s) reach into the text area (x 72-336, y 12-82). Keep border art on the edges.`);
    if (inIcon) warn(`${inIcon} drawing(s) sit where the icon stands (bottom-left, about x 7-65, y 55-109). Leave a plain floor line there.`);
  }
  if (kind === 'icon' && vb && !transformed) { const out = boxes.filter(b => b[0] < 1 || b[1] < 1 || b[2] > 99 || b[3] > 99).length; if (out) warn(`${out} path(s) reach the edge of the box: keep the drawing inside 6-94.`); if (boxes.length && Math.max(...boxes.map(b => b[3])) < 86) info('the drawing ends well above the bottom of the box: in the sidebar the icon should stand on the row\'s bottom line (ground at y 92-97).'); }
  // --- motion
  const toS = (v, u) => +v * (u === 'ms' ? .001 : 1);
  const durs = [...css.matchAll(/animation(?:-duration)?\s*:[^;}]*?(\d*\.?\d+)(ms|s)\b/g)].map(m => toS(m[1], m[2])).concat([...src.matchAll(/\bdur\s*=\s*["'](\d*\.?\d+)(ms|s)["']/g)].map(m => toS(m[1], m[2])));
  let cycle = 0;
  if (!durs.length) info('no animation');
  else {
    cycle = Math.max(...durs); const odd = [...new Set(durs.filter(d => Math.abs(cycle / d - Math.round(cycle / d)) > .01))];
    const animatedClasses = new Set([...noKf.matchAll(/([^{}]+)\{[^{}]*animation(?:-name)?\s*:/g)].flatMap(m => [...m[1].matchAll(/\.([A-Za-z_][\w-]*)/g)].map(c => c[1])));
    const parts = [...src.matchAll(/\sclass\s*=\s*["']([^"']+)["']/g)].filter(m => m[1].split(/\s+/).some(c => animatedClasses.has(c))).length + (src.match(/<(?:animate|animateTransform|animateMotion|set)\b/g) || []).length + (src.match(/style\s*=\s*["'][^"']*animation/g) || []).length;
    info(`cycle ${cycle}s, about ${parts} animated element(s)`);
    if (parts > PARTS[kind] * 1.25) warn(`about ${parts} animated elements; aim for at most ${PARTS[kind]} in a ${kind}.`);
    if (odd.length) warn(`durations ${odd.join(', ')}s do not divide the ${cycle}s cycle: the picture will not loop as a whole.`);
    const fast = [...new Set(durs.filter(d => d < 1.5))];
    if (fast.length) info(`fast loops (${fast.join(', ')}s): keep these for things that never stop (flame, water, a wheel). No shaking.`);
    const range = { banner: [8, 20], icon: [3, 8], border: [6, 18] }[kind];
    if (cycle < range[0] || cycle > range[1]) warn(`a ${kind} usually runs a ${range[0]}-${range[1]}s cycle; this one is ${cycle}s.`);
    if (/animation-delay\s*:/.test(css)) info('animation-delay found: it shifts a loop against the shared rest pose. Prefer keyframe percentages.');
    if (/scale\(\s*-/.test(src)) warn('negative scale found: never mirror a figure to turn it.');
  }
  if (kind === 'border' && !/vector-effect/.test(src)) warn('no vector-effect="non-scaling-stroke": the pen line will thicken and thin when the row stretches the image.');
  if (bytes > TARGET[kind]) info(`${(bytes / 1024).toFixed(1)} KiB is over the ${Math.round(TARGET[kind] / 1000)} KB target for a ${kind} (limit 256 KiB per file, 2 MiB for all artwork).`);
  console.log(`accepted ${name}  [${kind}]  ${(bytes / 1024).toFixed(1)} KiB${notes.length ? '\n' + notes.join('\n') : ''}`);
  cards.push({ name, kind, asset, vb, cycle });
}

// --- preview page: the harness's own render() output (an <img> with a data URL), at the real sizes
// (the extension loads these images lazily; in a preview that hides them from a screenshot of a long page)
const R = (asset, o) => A.render(asset, o).replace(/ loading="lazy"/g, ''), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// eight frozen moments: inline copies inside an isolated frame, each paused at its time (CSS animations and SMIL)
const moments = c => {
  if (!c.cycle) return '';
  const N = 8, w = { banner: 730, icon: 86, border: 255 }[c.kind], h = Math.round(c.kind === 'border' ? 87 : w * c.vb[3] / c.vb[2]), cols = c.kind === 'banner' ? 2 : c.kind === 'icon' ? 8 : 4;
  const svg = c.asset.svg.replace(/<svg\b/, `<svg width="${w}" height="${h}"${c.kind === 'border' ? ' preserveAspectRatio="none"' : ''}`);
  const doc = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:transparent;font:10px sans-serif;color:#8a8880}.g{display:grid;grid-template-columns:repeat(${cols},${w}px);gap:10px 14px}svg{display:block}</style><div class="g">${Array.from({ length: N }, (_, i) => `<div data-t="${(c.cycle * i / N).toFixed(3)}">${(c.cycle * i / N).toFixed(1)} s${svg}</div>`).join('')}</div><script>addEventListener('load',()=>{for(const c of document.querySelectorAll('[data-t]')){const t=+c.dataset.t,s=c.querySelector('svg');for(const a of s.getAnimations({subtree:true})){a.pause();a.currentTime=t*1000}try{s.pauseAnimations();s.setCurrentTime(t)}catch(e){}}})<\/script>`;
  const rows = Math.ceil(N / cols);
  return `<p>Eight moments of the ${c.cycle}s loop (frozen). The first is the rest pose.</p><iframe class="mo" style="width:${cols * (w + 14)}px;height:${rows * (h + 24)}px" srcdoc="${esc(doc)}"></iframe>`;
};
const sect = c => {
  if (c.error) return `<section><h2>${esc(c.name)}</h2><p class="bad">Refused by the validator. See the terminal.</p></section>`;
  const a = c.asset;
  if (c.kind === 'banner') return `<section><h2>${esc(c.name)} <small>banner</small></h2>
${[['Standard, contain right (the default)', 140, 'contain', 'right', true], ['Large, contain right', 220, 'contain', 'right', true], ['Compact, contain right', 80, 'contain', 'right', true], ['Standard, cover', 140, 'cover', 'center', true], ['Standard, still copy (what reduced-motion users see)', 140, 'contain', 'right', false]].map(([label, h, fit, position, motion]) => `<p>${label}</p><div class="head"><div class="ban" style="height:${h}px">${R(a, { kind: 'banner', fit, position, motion })}</div><div class="h1">Course name</div><div class="det">Course · Today · Canvas home · Modules · Assignments</div></div>`).join('')}${moments(c)}</section>`;
  if (c.kind === 'icon') return `<section><h2>${esc(c.name)} <small>icon</small></h2><div class="icons">${[160, 40, 22].map(s => `<figure><div style="width:${s}px;height:${s}px">${R(a, { kind: 'icon', fit: 'contain' })}</div><figcaption>${s}px</figcaption></figure>`).join('')}<figure><div style="width:40px;height:40px">${R(a, { kind: 'icon', fit: 'contain', motion: false })}</div><figcaption>still</figcaption></figure></div>${moments(c)}</section>`;
  const icon = cards.find(k => k.kind === 'icon' && !k.error && k.name.split(/-(?:icon|mini)/i)[0] === c.name.split(/-(?:border|frame)/i)[0]) || cards.find(k => k.kind === 'icon' && !k.error);
  return `<section><h2>${esc(c.name)} <small>border, stretched to the row (icon and text placed as in Canvas Harness 2.19 and 2.20)</small></h2><div class="rows">${[[255, 87], [225, 84], [255, 56], [300, 132], [255, 87, false]].map(([w, h, motion = true]) => `<figure><div class="row" style="width:${w}px;height:${h}px"><span class="fr">${R(a, { kind: 'border', fit: 'fill', motion })}</span><span class="ic">${icon ? R(icon.asset, { kind: 'icon', fit: 'contain', motion }) : ''}</span><span class="tx"><b>Course name</b>${h > 60 ? '<i>Fri · Something due</i>' : ''}${h > 100 ? '<i>next week</i>' : ''}</span><span class="ct">2</span></div><figcaption>${w} x ${h}${motion ? '' : ' still'}</figcaption></figure>`).join('')}</div>${moments(c)}</section>`;
};
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Artwork preview</title><style>
:root{--page:#FAF9F5;--rail:#F3F1EA;--ink:#141413;--muted:#5E5D59;--line:#E8E6DC}
html[data-theme=dark]{--page:#1F1E1D;--rail:#262624;--ink:#F0EEE6;--muted:#A6A39A;--line:#3A3936}
body{margin:0;padding:28px 32px 60px;background:var(--page);color:var(--ink);font:14px/1.5 "Segoe UI",system-ui,sans-serif}
h1{font:500 26px Georgia,serif;margin:0 0 4px}h2{font:500 19px Georgia,serif;margin:34px 0 6px}small{font:12px sans-serif;color:var(--muted)}p{margin:14px 0 4px;color:var(--muted);font-size:12px}
.bad{color:#B5333A}button{font:inherit;padding:5px 12px;border:1px solid var(--line);border-radius:8px;background:none;color:inherit;cursor:pointer}
.head{max-width:1500px}.ban{width:100%;overflow:hidden;border-radius:10px}.h1{font:500 26px Georgia,serif;margin-top:10px}.det{color:var(--muted);font-size:12px}
picture,picture img{display:block;width:100%;height:100%}iframe.mo{border:0;display:block;max-width:100%;background:transparent}
.icons,.rows{display:flex;gap:26px;align-items:flex-end;flex-wrap:wrap}figure{margin:0}figcaption{font-size:11px;color:var(--muted);margin-top:6px}
.rows{background:var(--rail);padding:22px;border-radius:14px;align-items:flex-start}
.row{position:relative;box-sizing:border-box}.fr{position:absolute;inset:0}.ic{position:absolute;left:5px;bottom:1px;width:40px;height:40px}
.tx{position:absolute;left:52px;top:11px;right:30px;display:flex;flex-direction:column;font-size:13px;line-height:1.45}.tx b{font-size:15px}.tx i{font-style:normal;color:var(--muted)}
.ct{position:absolute;right:13px;top:11px;font-size:12px;color:var(--muted)}
</style><h1>Artwork preview</h1><div>Each file as an isolated image, the way Canvas Harness shows it. The animated pictures play from the moment the page loads (they can take a few seconds to appear), so judge a loop from the frozen moments under each piece. <button onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'">Light / dark page</button></div>
${cards.map(sect).join('\n')}</html>`;
const out = path.resolve(outArg || path.join(path.dirname(files[0]), 'preview.html'));
fs.writeFileSync(out, html);
console.log(`\npreview: ${out}`);
process.exit(refused ? 1 : 0);
