'use strict';
// The Chrome Web Store rejected 3.7.0 as "obfuscated" for core-js code inside the legacy PDF.js build. These tests keep
// the package free of the patterns reviewers read that way, and check the tools that keep it so.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const extension = path.join(root, 'extension');
const rules = require('../scripts/readability-rules.cjs');
const readableLines = require('../scripts/readable-lines.cjs');
const brotli = require('../scripts/pdfjs-brotli-dictionary.cjs');

const packagedText = () =>
  fs
    .readdirSync(extension, { recursive: true })
    .map(name => name.split(path.sep).join('/'))
    .filter(name => /\.(?:[cm]?js|css|html?|json|svg|md|txt)$/i.test(name));

test('every packaged text file passes the store readability rules', () => {
  const found = [];
  for (const name of packagedText()) {
    const text = fs.readFileSync(path.join(extension, name), 'utf8');
    for (const item of rules.findings(name, text, !name.startsWith('vendor/'))) {
      found.push(name + ':' + item.line + ' ' + item.rule + ' ' + item.detail);
    }
  }
  for (const name of ['INSTALL.md', 'AI.md', 'PRIVACY.md', 'LICENSE']) {
    for (const item of rules.findings(name, fs.readFileSync(path.join(root, name), 'utf8'), true)) {
      found.push(name + ':' + item.line + ' ' + item.rule);
    }
  }
  assert.deepEqual(found, []);
});

test('the rules catch what the store cited and other hidden-code patterns', () => {
  const cited = "var NullProtoObjectViaIFrame = function() { var iframe = documentCreateElement('iframe'); var JS = 'java' + SCRIPT + ':'; iframeDocument.write(scriptTag('document.F=Object')); };";
  const names = text => rules.findings('vendor/x.mjs', text, false).map(item => item.rule);
  assert.deepEqual(names(cited).sort(), ['NullProtoObjectViaIFrame', 'document.write', 'split javascript: string'].sort());
  assert.deepEqual(names('setTimeout("run()", 5)'), ['string timer']);
  assert.deepEqual(names('const f = new Function("a", "return a")'), ['new Function', 'Function constructor']);
  assert.deepEqual(names('location.href = "javascript:void 0"'), ['javascript: URL']);
  assert.deepEqual(names('const shortCourseRetrieval = () => 1; shortCourseRetrieval();'), []);
  assert.deepEqual(names('const s = "a‮b";'), ['invisible character']);
  const run = 'QUJD'.repeat(60);
  assert.deepEqual(rules.findings('a.js', 'const blob = "' + run + '";', true).map(item => item.rule), ['base64 run outside a data:image URL']);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(300, 7)]).toString('base64');
  assert.deepEqual(rules.findings('a.js', 'const image = "data:image/png;base64,' + png + '";', true), []);
  assert.deepEqual(rules.findings('a.js', 'const image = "data:image/png;base64,' + run + '";', true).map(item => item.rule), ['data:image is not that image']);
});

test('readable-lines spreads a dense line without changing tokens or the AST, and is idempotent', () => {
  const dense = "(function(root){'use strict';function pick(rows,s){const out=[],seen=new Set();for(const row of rows){if(!row||seen.has(row.id))continue;seen.add(row.id);if(row.kind==='assignment'&&row.dueAt&&Date.parse(row.dueAt)>Date.now()||row.kind==='quiz'&&!row.locked)out.push({id:row.id,title:row.title,course:row.courseId,score:s.weights?.[row.kind]??1});}return out.sort((a,b)=>b.score-a.score||String(a.title).localeCompare(String(b.title)));}root.Pick=pick;})(this);\n";
  assert.ok(readableLines.denseLines(dense).length > 0);
  const spread = readableLines.spread(dense, 'sample.js');
  assert.equal(readableLines.sameProgram(dense, spread, { ecmaVersion: 'latest' }), null);
  assert.deepEqual(readableLines.denseLines(spread), []);
  assert.equal(readableLines.spread(spread, 'sample.js'), spread);
  // Return values, postfix updates, regular expressions, object-bodied arrows and template literals keep their place.
  const tricky = 'function f(a,b){let i=0,j=0;i++;j--;if(a)b(i);else if(!b)throw Error("none");const re=/[{}]+/g,map=x=>({x,y:x*2});'
    + 'for(const k of a)if(re.test(k))j+=map(k).y;return a.map(x=>`<b class="${x?`yes ${x}`:"no"}">${i}</b>`).join("")+String(j)+(i>j?"up":"down")}';
  const spreadTricky = readableLines.spread(tricky, 't.js');
  assert.notEqual(spreadTricky, tricky);
  assert.equal(readableLines.sameProgram(tricky, spreadTricky, { ecmaVersion: 'latest' }), null);
  assert.ok(spreadTricky.includes('`<b class="${x?`yes ${x}`:"no"}">${i}</b>`'));
});

test('the PDF.js Brotli line decodes to the RFC 7932 dictionary', () => {
  const result = brotli.check();
  assert.equal(result.bytes, brotli.RFC_7932_LENGTH);
  assert.equal(result.crc32, brotli.RFC_7932_CRC32);
  assert.equal(result.sha256, brotli.SHA256);
  assert.equal(result.firstWords.slice(0, 16), 'timedownlifeleft');
  assert.ok(fs.readFileSync(path.join(extension, 'vendor/pdfjs/README.md'), 'utf8').includes(brotli.SHA256));
});

test('the Biscuit control catalogue generator reproduces the packaged file', () => {
  const inventory = require('../scripts/biscuit-control-inventory.cjs');
  const file = path.join(extension, 'biscuit-controls.js');
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(inventory.runtimeSource(inventory.extract(), source), source);
});
