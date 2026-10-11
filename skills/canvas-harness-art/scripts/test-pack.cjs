#!/usr/bin/env node
// Runs the quick upload test packs (quick-upload/vectors) against a reader and compares with the expected results.
//   node scripts/test-pack.cjs                      the reference reader, scripts/quick-pack.js
//   node scripts/test-pack.cjs path/to/reader.js    another implementation exporting { parse, matchCourse }
//   node scripts/test-pack.cjs --write              rewrite the expected results from the reference reader
// Every vector is read twice, once as written and once with Windows line endings; both must give the same result.
// Pieces the reader accepts are also run through the artwork validator, so the vectors stay valid artwork.
const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..', 'quick-upload', 'vectors');
const args = process.argv.slice(2), write = args.includes('--write'), impl = args.find(a => !a.startsWith('--'));
const P = require(impl ? path.resolve(impl) : './quick-pack.js');
const vendored = path.join(__dirname, 'vendor', 'custom-art.js'), inRepo = path.join(__dirname, '..', '..', '..', 'extension', 'custom-art.js');
const A = require(fs.existsSync(inRepo) ? inRepo : vendored);
const codes = list => (list || []).map(e => e.code);
// what a reader must agree on: everything except the wording of messages
const summary = r => ({ ok: r.ok, version: r.version, name: r.name, errors: codes(r.errors), warnings: codes(r.warnings), skipped: (r.skipped || []).map(s => ({ index: s.index, kind: s.kind, reason: s.reason })),
  parts: (r.parts || []).map(p => ({ index: p.index, slot: p.slot, target: p.target, name: p.name, ...(p.fit ? { fit: p.fit } : {}), ...(p.position ? { position: p.position } : {}), svgBytes: p.svg ? Buffer.byteLength(p.svg) : 0, errors: codes(p.errors), warnings: codes(p.warnings), ...(p.replacedBy ? { replacedBy: p.replacedBy } : {}) })) });
let failed = 0, ran = 0;
for (const f of fs.readdirSync(dir).filter(f => /\.(chpack|txt)$/.test(f)).sort()) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n'), exp = path.join(dir, f.replace(/\.[^.]+$/, '.expected.json'));
  const got = summary(P.parse(text)), crlf = summary(P.parse(text.replace(/\n/g, '\r\n')));
  if (write) { fs.writeFileSync(exp, JSON.stringify(got, null, 2) + '\n'); console.log('wrote', path.basename(exp)); continue; }
  ran++; const want = JSON.parse(fs.readFileSync(exp, 'utf8')), problems = [];
  if (JSON.stringify(got) !== JSON.stringify(want)) problems.push('result differs from ' + path.basename(exp) + '\n    got  ' + JSON.stringify(got) + '\n    want ' + JSON.stringify(want));
  if (JSON.stringify(crlf) !== JSON.stringify(got)) problems.push('Windows line endings change the result');
  for (const p of P.parse(text).parts || []) if (p.svg && !p.errors.length) try { A.importSVG(p.svg, p.name); } catch (e) { problems.push(`piece ${p.index}: the validator refuses its SVG: ${e.message}`); }
  if (problems.length) failed++;
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${f}${problems.map(p => '\n  ' + p).join('')}`);
}
if (!write) {
  const M = JSON.parse(fs.readFileSync(path.join(dir, 'matching.json'), 'utf8'));
  for (const c of M.cases) {
    ran++; const r = P.matchCourse(c.target, M.courses), got = r.status === 'matched' ? String(r.course.id) : r.status, ids = (r.candidates || []).map(x => String(x.id));
    const ok = got === c.expect && (c.expect !== 'ambiguous' || JSON.stringify(ids) === JSON.stringify(c.candidates));
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} match: ${c.why}${ok ? '' : `\n  got ${got} ${ids.join(',')}  want ${c.expect} ${(c.candidates || []).join(',')}`}`);
  }
  // writing and reading back
  ran++; const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M22 90L50 18L78 90Z" fill="#D97757"/></svg>';
  const back = P.parse(P.build({ name: 'Round "trip" & more', parts: [{ slot: 'banner', course: ['R&D "Makers" <Lab>', 'Makers'], svg, fit: 'cover', position: 'left' }, { slot: 'frame', place: 'every-course', svg }, { slot: 'icon', courseId: '7', svg, name: 'Seven' }] }));
  const good = back.ok && back.name === 'Round "trip" & more' && back.parts.length === 3 && back.parts[0].target.names.join('/') === 'R&D "Makers" <Lab>/Makers' && back.parts[0].fit === 'cover' && back.parts[0].position === 'left' && back.parts[1].target.type === 'every-course' && back.parts[2].target.id === '7' && back.parts[2].name === 'Seven' && back.parts.every(p => p.svg === svg && !p.errors.length) && !back.warnings.length;
  if (!good) failed++; console.log(`${good ? 'ok  ' : 'FAIL'} build() then parse() gives the same pieces back`);
  if (P.applyOrder) {
    ran++; const order = P.applyOrder(P.parse(P.build({ parts: [{ slot: 'frame', course: 'Astronomy', svg }, { slot: 'frame', place: 'every-course', svg }, { slot: 'icon', place: 'overview', svg }] }))).map(p => p.index).join(',');
    if (order !== '2,1,3') failed++; console.log(`${order === '2,1,3' ? 'ok  ' : 'FAIL'} applyOrder() puts every-course pieces first, so a named course wins`);
  }
  console.log(`\n${ran - failed} of ${ran} passed`);
}
process.exit(failed ? 1 : 0);
