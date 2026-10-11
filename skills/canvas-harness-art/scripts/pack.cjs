#!/usr/bin/env node
// Makes, checks and opens Canvas Harness quick upload packs.
//
//   Make a pack (one target after another; each takes the files or folders that follow it):
//     node scripts/pack.cjs --course "Marine Biology" marine/
//     node scripts/pack.cjs --course "Marine Biology" marine/ --course "Astronomy|Astro 101" astro/ --overview home/
//     node scripts/pack.cjs --every-course shared-frame.svg --name "Blue frames"
//   Targets:  --course "Name"   one course, by name ("A|B" lists names it might go by)
//             --course-id 12345 one course, by the number in its Canvas address (use with or without --course)
//             --overview        the All courses page
//             --every-course    every course the user has
//   Options:  --name "Pack name"  --out file.chpack  --print (also write the pack text to the terminal, to paste)
//             --fit contain|cover  --position left|center|right  (banners of the current target)
//   The slot comes from the file name (…banner…, …icon…, …border… or …frame…), else from the shape of the viewBox.
//
//   Check a pack (reads it the way the extension will, and validates every SVG in it):
//     node scripts/pack.cjs --check file.chpack
//   Open a pack into separate SVG files (for uploading one by one in a Canvas Harness without Quick upload):
//     node scripts/pack.cjs --unpack file.chpack [--out folder]
//
// No dependencies. Exit code 1 if anything is refused.
const fs = require('fs'), path = require('path'), P = require('./quick-pack.js');
const vendored = path.join(__dirname, 'vendor', 'custom-art.js'), inRepo = path.join(__dirname, '..', '..', '..', 'extension', 'custom-art.js');
const A = require(fs.existsSync(inRepo) ? inRepo : vendored);
const argv = process.argv.slice(2), slug = s => P.normalizeName(s).replace(/ /g, '-') || 'pack', kib = n => (n / 1024).toFixed(1) + ' KiB';
const die = m => { console.error(m); process.exit(2); };
if (!argv.length || argv.includes('--help')) die(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 22).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));

function report(text, label) {
  const r = P.parse(text); let bad = 0;
  if (!r.ok) { console.log(`REFUSED  ${label}`); for (const e of r.errors) console.log('  x ' + e.message); return { r, bad: 1 }; }
  console.log(`pack "${r.name || '(no name)'}"  format ${r.version}  ${r.parts.length} piece(s)  ${kib(Buffer.byteLength(text))}`);
  for (const p of r.parts) {
    const to = !p.target ? '?' : p.target.type === 'course' ? `course ${[...p.target.names.map(n => `"${n}"`), p.target.id ? '#' + p.target.id : ''].filter(Boolean).join(' or ')}` : p.target.type;
    let size = '';
    if (p.svg && !p.errors.length) try { size = kib(Buffer.byteLength(A.importSVG(p.svg, p.name).svg)); } catch (e) { p.errors.push({ code: 'refused', message: e.message }); }
    const real = p.errors.filter(e => e.code !== 'replaced');
    if (real.length) bad++;
    console.log(`${p.errors.length ? (real.length ? 'REFUSED ' : 'replaced') : 'accepted'} ${String(p.index).padStart(2)}  ${(p.slot || '?').padEnd(6)} -> ${to}${p.fit || p.position ? `  (${[p.fit, p.position].filter(Boolean).join(', ')})` : ''}  ${size}`);
    for (const e of p.errors) console.log('  x ' + e.message);
    for (const w of p.warnings) console.log('  ! ' + w.message);
  }
  for (const s of r.skipped) console.log(`skipped  ${String(s.index).padStart(2)}  <?ch-${s.kind}?>  (${s.reason})`);
  for (const w of r.warnings) { console.log('! ' + w.message); if (w.code === 'no-end' || w.code === 'count-mismatch') bad++; }
  return { r, bad };
}

if (argv[0] === '--check') {
  if (!argv[1]) die('Usage: node scripts/pack.cjs --check file.chpack');
  let bad = 0; for (const f of argv.slice(1)) bad += report(fs.readFileSync(f, 'utf8'), f).bad;
  process.exit(bad ? 1 : 0);
}
if (argv[0] === '--unpack') {
  const f = argv[1]; if (!f) die('Usage: node scripts/pack.cjs --unpack file.chpack [--out folder]');
  const o = argv.indexOf('--out'), dir = path.resolve(o > 0 ? argv[o + 1] : path.join(path.dirname(f), path.basename(f).replace(/\.[^.]+$/, '') + '-files'));
  const { r, bad } = report(fs.readFileSync(f, 'utf8'), f); if (!r.ok) process.exit(1);
  fs.mkdirSync(dir, { recursive: true });
  for (const p of r.parts) { if (p.errors.length) continue; const t = p.target, who = t.type === 'course' ? (t.names[0] || 'course-' + t.id) : t.type; fs.writeFileSync(path.join(dir, `${slug(who)}-${p.slot === 'frame' ? 'border' : p.slot}.svg`), p.svg + '\n'); }
  console.log(`\nfiles: ${dir}`); process.exit(bad ? 1 : 0);
}

// ---- make
const slotOf = (name, vb) => /icon|mini/i.test(name) ? 'icon' : /border|frame/i.test(name) ? 'frame' : /banner|pano|title/i.test(name) ? 'banner' : vb && Math.abs(vb[2] / vb[3] - 1) < .2 ? 'icon' : vb && vb[2] / vb[3] > 5 ? 'banner' : 'frame';
const parts = []; let target = null, name = '', out = '', print = false, refused = 0;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i], val = () => argv[++i] ?? die(`${a} needs a value`);
  if (a === '--course') target = { course: val().split('|').map(s => s.trim()).filter(Boolean) };
  else if (a === '--course-id') { const id = val(); target = target && target.course && !target.used ? { ...target, courseId: id } : { courseId: id }; }
  else if (a === '--overview') target = { place: 'overview' };
  else if (a === '--every-course') target = { place: 'every-course' };
  else if (a === '--fit' || a === '--position') { if (!target) die(`${a} comes after a target`); target = { ...target, [a.slice(2)]: val(), used: false }; }
  else if (a === '--name') name = val(); else if (a === '--out') out = val(); else if (a === '--print') print = true;
  else if (a.startsWith('--')) die(`Unknown option ${a}`);
  else {
    if (!target) die(`Say who "${a}" is for first: --course "Name", --overview or --every-course.`);
    if (!fs.existsSync(a)) die(`Not found: ${a}`);
    target.used = true;
    const files = fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter(f => /\.svg$/i.test(f)).sort().map(f => path.join(a, f)) : [a];
    if (!files.length) die(`No .svg files in ${a}`);
    const batch = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8'), vbm = src.match(/viewBox\s*=\s*["']([^"']+)["']/), vb = vbm ? vbm[1].trim().split(/[\s,]+/).map(Number) : null, slot = slotOf(path.basename(file), vb);
      try { A.importSVG(src, path.basename(file)); } catch (e) { refused++; console.log(`REFUSED  ${file}\n  x ${e.message}`); continue; }
      const open = src.search(/<svg[\s>]/), close = src.lastIndexOf('</svg>'), { used, fit, position, ...who } = target;
      batch.push({ ...who, slot, svg: src.slice(open, close + 6), ...(slot === 'banner' && fit ? { fit } : {}), ...(slot === 'banner' && position ? { position } : {}), file });
    }
    parts.push(...batch.sort((x, y) => P.SLOTS.indexOf(x.slot) - P.SLOTS.indexOf(y.slot)));
  }
}
if (refused) die('\nNothing was packed: fix the refused files first (node scripts/check.cjs explains them).');
if (!parts.length) die('Nothing to pack.');
const who = p => p.place || (p.course ? p.course[0] : '#' + p.courseId), keys = new Set();
for (const p of parts) { const k = `${who(p)}/${p.slot}`; if (keys.has(k)) die(`Two files for the ${p.slot} of ${who(p)}. Name them so the slot is clear (…-banner.svg, …-icon.svg, …-border.svg).`); keys.add(k); }
if (!name) { const all = [...new Set(parts.map(who))]; name = all.length === 1 ? all[0] : `${all.length} sets`; }
parts.sort((x, y) => (y.place === 'every-course') - (x.place === 'every-course'));   // read more naturally first; the order does not change the result
let text; try { text = P.build({ name, parts }); } catch (e) { die(e.message); }
const file = path.resolve(out || path.join(fs.statSync(parts[0].file).isDirectory() ? parts[0].file : path.dirname(parts[0].file), slug(name) + '.chpack'));
fs.writeFileSync(file, text);
const { bad } = report(text, file);
console.log(`\npack: ${file}\nTo use it: copy all of its text into Quick upload in Canvas Harness (Customize workspace), or drop the file there.`);
if (print) console.log('\n' + text);
process.exit(bad ? 1 : 0);
