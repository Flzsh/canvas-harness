'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {deflateSync} = require('node:zlib');
const modulePath = path.resolve(__dirname, '../extension/pdf-context.js');

test('exposes the opt-in PDF context extraction entry point', () => {
  assert.ok(fs.existsSync(modulePath), 'The bounded PDF extraction module is missing');
  assert.equal(typeof require(modulePath).extract, 'function');
});

// Self-authored, byte-correct fixtures: no network, Canvas files, or binary fixtures.
function pdfObjects(objects, trailer = '') {
  let body = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailer} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, 'latin1'));
}
const literal = text => text.replace(/[\\()]/g, '\\$&');
const stream = bytes => `<< /Length ${Buffer.byteLength(bytes, 'latin1')} >>\nstream\n${bytes}\nendstream`;
function tinyPDF(texts = ['Hello Canvas PDF'], {image = false, activeContent = false} = {}) {
  const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids = [];
  for (const text of texts) {
    const pageId = objects.length + 1, contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const content = image ? 'q 20 0 0 20 20 20 cm /Im1 Do Q' : `BT /F1 12 Tf 20 100 Td (${literal(text)}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 3 0 R >> ${image ? `/XObject << /Im1 ${contentId + 1} 0 R >>` : ''} >> /Contents ${contentId} 0 R >>`);
    objects.push(stream(content));
    if (image) objects.push('<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n\xff\x00\x00\nendstream');
  }
  let catalogExtra = '';
  if (activeContent) {
    const actionId = objects.length + 1, fieldId = actionId + 1;
    objects.push(`<< /S /JavaScript /JS (globalThis.__pdfExecuted = true;) >>`);
    objects.push('<< /FT /Tx /T (Secret field) /V (FORM VALUE MUST NOT BECOME CONTEXT) >>');
    catalogExtra = `/OpenAction ${actionId} 0 R /AcroForm << /Fields [${fieldId} 0 R] >>`;
  }
  objects[0] = `<< /Type /Catalog /Pages 2 0 R ${catalogExtra} >>`;
  objects[1] = `<< /Type /Pages /Count ${kids.length} /Kids [${kids.join(' ')}] >>`;
  return pdfObjects(objects);
}
function xrefStreamPDF() {
  const original = Buffer.from(tinyPDF()).toString('latin1');
  const body = original.slice(0, original.indexOf('\nxref\n') + 1);
  const offsets = [0, ...[...body.matchAll(/^(\d+) 0 obj/gm)].map(match => match.index), Buffer.byteLength(body, 'latin1')];
  const records = Buffer.alloc(offsets.length * 7);
  offsets.forEach((offset, id) => { records[id * 7] = id === 0 ? 0 : 1; records.writeUInt32BE(offset, id * 7 + 1); records.writeUInt16BE(id === 0 ? 65535 : 0, id * 7 + 5); });
  const packed = deflateSync(records);
  const xref = `6 0 obj\n<< /Type /XRef /Size 7 /Root 1 0 R /W [1 4 2] /Filter /FlateDecode /Length ${packed.length} >>\nstream\n${packed.toString('latin1')}\nendstream\nendobj\nstartxref\n${offsets[6]}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body + xref, 'latin1'));
}
function incrementalPDF() {
  const original = Buffer.from(tinyPDF()).toString('latin1');
  const previous = /startxref\n(\d+)/.exec(original)[1];
  const position = Buffer.byteLength(original, 'latin1');
  const catalog = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const xref = position + catalog.length;
  return new Uint8Array(Buffer.from(`${original}${catalog}xref\n1 1\n${String(position).padStart(10, '0')} 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R /Prev ${previous} >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1'));
}

// PDF Standard Security Handler, revision 2. Both password-required and empty
// user-password encryption must be refused, even when PDF.js can open the latter.
function rc4(key, bytes) {
  const state = Array.from({length: 256}, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + state[i] + key[i % key.length]) & 255; [state[i], state[j]] = [state[j], state[i]]; }
  let i = 0; j = 0;
  return Buffer.from([...bytes].map(byte => {
    i = (i + 1) & 255; j = (j + state[i]) & 255; [state[i], state[j]] = [state[j], state[i]];
    return byte ^ state[(state[i] + state[j]) & 255];
  }));
}
function encryptedPDF(password) {
  const padding = Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a', 'hex');
  const pad = value => Buffer.concat([Buffer.from(value, 'latin1'), padding]).subarray(0, 32);
  const md5 = bytes => createHash('md5').update(bytes).digest();
  const owner = rc4(md5(pad('owner')).subarray(0, 5), pad(password));
  const fileId = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
  const permissions = Buffer.alloc(4); permissions.writeInt32LE(-4);
  const key = md5(Buffer.concat([pad(password), owner, permissions, fileId])).subarray(0, 5);
  const user = rc4(key, padding);
  const contentKey = md5(Buffer.concat([key, Buffer.from([5, 0, 0, 0, 0])])).subarray(0, 10);
  const content = rc4(contentKey, Buffer.from('BT /F1 12 Tf 20 100 Td (Encrypted text) Tj ET')).toString('latin1');
  return pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [4 0 R] >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    stream(content),
    `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${owner.toString('hex')}> /U <${user.toString('hex')}> /P -4 >>`
  ], `/Encrypt 6 0 R /ID [<${fileId.toString('hex')}> <${fileId.toString('hex')}>]`);
}

let libraryPromise;
async function realLibrary() {
  // Node has no DOM graphics API; these unused stand-ins only permit the actual
  // browser PDF.js build to import. Text parsing itself uses the real worker code.
  globalThis.DOMMatrix ??= class DOMMatrix {};
  globalThis.Path2D ??= class Path2D {};
  globalThis.ImageData ??= class ImageData {};
  libraryPromise ??= import(pathToFileURL(path.resolve(__dirname, '../extension/vendor/pdfjs/pdf.mjs')).href).then(library => {
    library.GlobalWorkerOptions.workerSrc = pathToFileURL(path.resolve(__dirname, '../extension/vendor/pdfjs/pdf.worker.mjs')).href;
    return library;
  });
  return libraryPromise;
}
function realExtractor() {
  return require(modulePath).createExtractor({
    loadLibrary: realLibrary,
    createWorker: library => {
      const worker = library.PDFWorker.create({verbosity: 0});
      return {worker, terminate: () => worker.destroy()};
    }
  });
}
function controlled({texts = ['Alpha', 'Beta'], load, read, destroy, metadata, pageError, chunk} = {}) {
  const observed = {loads: 0, pages: [], reads: 0, cancelled: 0, cleaned: [], destroyed: 0, terminated: 0, parameters: null};
  const document = {
    numPages: texts.length,
    getMetadata: async () => metadata ?? {info: {EncryptFilterName: null}},
    getPermissions: async () => null,
    getPage: async number => {
      observed.pages.push(number);
      if (pageError) throw pageError;
      let done = false;
      return {
        streamTextContent: () => ({getReader: () => ({
          async read() {
            observed.reads++;
            if (read) return read();
            if (done) return {done: true};
            done = true;
            return {done: false, value: chunk ?? {items: [{str: texts[number - 1], hasEOL: false}]}};
          },
          cancel: async () => { observed.cancelled++; },
          releaseLock() {}
        })}),
        cleanup: () => { observed.cleaned.push(number); },
        render() { throw Error('Rendering is forbidden'); },
        getAnnotations() { throw Error('Forms/annotations are forbidden'); },
        getOperatorList() { throw Error('Image decoding is forbidden'); }
      };
    },
    getJSActions() { throw Error('PDF JavaScript is forbidden'); }
  };
  const task = {promise: load ? load(document) : Promise.resolve(document), destroy() { observed.destroyed++; return destroy ? destroy() : Promise.resolve(); }};
  const extractor = require(modulePath).createExtractor({
    loadLibrary: async () => {
      observed.loads++;
      return {getDocument: parameters => { observed.parameters = parameters; return task; }};
    },
    createWorker: () => ({worker: {}, terminate: () => { observed.terminated++; }})
  });
  return {extractor, observed, task};
}

test('classic browser entry point is lazy and exposes a global', () => {
  const sandbox = {chrome: {runtime: {getURL() { throw Error('Unexpected eager import'); }}}};
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), sandbox, {filename: modulePath});
  assert.equal(typeof sandbox.CanvasHarnessPDF.extract, 'function');
});
test('extracts text from a real tiny PDF without detaching the input', async () => {
  const bytes = tinyPDF(); const original = bytes.slice();
  assert.ok(bytes.length < 1000);
  const result = await realExtractor().extract(bytes);
  assert.deepEqual(result, {text: 'Hello Canvas PDF', pages: 1, totalPages: 1, truncated: false, warnings: []});
  assert.deepEqual(bytes, original);
});
test('real page limit skips later pages and retains source order', async () => {
  const result = await realExtractor().extract(tinyPDF(['First page', 'Second page', 'Third page']), {maxPages: 2});
  assert.equal(result.text, 'First page\n\nSecond page');
  assert.equal(result.pages, 2); assert.equal(result.totalPages, 3); assert.equal(result.truncated, true);
  assert.match(result.warnings.join(' '), /page limit/i);
});
test('real character limit counts page separators', async () => {
  const result = await realExtractor().extract(tinyPDF(['Alpha', 'Beta', 'Gamma']), {maxChars: 10});
  assert.equal(result.text, 'Alpha\n\nBet'); assert.equal(result.pages, 2); assert.equal(result.truncated, true);
  assert.match(result.warnings.join(' '), /character limit/i);
});
test('accepts real compressed xref streams and incremental PDF updates', async () => {
  for (const data of [xrefStreamPDF(), incrementalPDF()]) assert.equal((await realExtractor().extract(data)).text, 'Hello Canvas PDF');
});
test('warns about a real image-only page and does not perform OCR', async () => {
  const result = await realExtractor().extract(tinyPDF([''], {image: true}));
  assert.equal(result.text, ''); assert.equal(result.pages, 1); assert.equal(result.truncated, false);
  assert.match(result.warnings.join(' '), /image.only|scanned/i); assert.match(result.warnings.join(' '), /OCR/i);
});
test('ignores real document JavaScript and form values', async () => {
  delete globalThis.__pdfExecuted;
  const result = await realExtractor().extract(tinyPDF(['Visible class notes'], {activeContent: true}));
  assert.equal(result.text, 'Visible class notes'); assert.equal(globalThis.__pdfExecuted, undefined);
});
for (const password of ['', 'secret']) {
  test(`refuses a real encrypted PDF with ${password ? 'a required' : 'an empty'} password`, async () => {
    await assert.rejects(realExtractor().extract(encryptedPDF(password)), error => error.code === 'encrypted');
  });
}
test('refuses malformed and truncated real PDFs', async () => {
  const extractor = realExtractor();
  await assert.rejects(extractor.extract(new TextEncoder().encode('%PDF-1.7\nnot a document\n%%EOF')), error => error.code === 'corrupt');
  const valid = tinyPDF();
  await assert.rejects(extractor.extract(valid.subarray(0, valid.length - 12)), error => error.code === 'corrupt');
  const badOffset = Buffer.from(valid).toString('latin1').replace(/startxref\n\d+/, 'startxref\n1');
  await assert.rejects(extractor.extract(new Uint8Array(Buffer.from(badOffset, 'latin1'))), error => error.code === 'corrupt');
  const badCatalog = Buffer.from(valid).toString('latin1').replace('/Type /Catalog', '/Type /Invalid');
  await assert.rejects(extractor.extract(new Uint8Array(Buffer.from(badCatalog, 'latin1'))), error => error.code === 'corrupt');
  const badEntry = Buffer.from(valid).toString('latin1').replace(/\d{10} 00000 n/, '0000000001 00000 n');
  await assert.rejects(extractor.extract(new Uint8Array(Buffer.from(badEntry, 'latin1'))), error => error.code === 'corrupt');
});
test('refuses input larger than 2 MiB before importing a parser', async () => {
  const {extractor, observed} = controlled();
  for (const data of [new Uint8Array(2097153), new ArrayBuffer(2097153), new Blob([new Uint8Array(2097153)]), Array(2097153).fill(0)]) {
    await assert.rejects(extractor.extract(data), error => error.code === 'oversize');
  }
  assert.equal(observed.loads, 0);
});
test('accepts exactly 2 MiB and rejects URL strings without fetching them', async () => {
  const {extractor, observed} = controlled({texts: ['Small text']});
  const source = tinyPDF(); const data = new Uint8Array(2097152); data.fill(32); data.set(source);
  // Keep the valid PDF trailer at the end; the body padding precedes it.
  const eof = Buffer.from(source).lastIndexOf('startxref');
  data.set(source.subarray(eof), data.length - (source.length - eof));
  assert.equal((await extractor.extract(data)).text, 'Small text');
  await assert.rejects(extractor.extract('https://school.instructure.com/file.pdf'), error => error.code === 'input');
  assert.equal(observed.loads, 1);
});
test('supports ArrayBuffer, byte views, byte arrays and Blob data', async () => {
  const source = tinyPDF();
  const padded = new Uint8Array(source.length + 10); padded.set(source, 5);
  for (const data of [source.buffer, new DataView(padded.buffer, 5, source.length), [...source], new Blob([source])]) {
    assert.equal((await realExtractor().extract(data)).text, 'Hello Canvas PDF');
  }
});
test('rejects malformed byte arrays and invalid limits before loading', async () => {
  const {extractor, observed} = controlled();
  for (const data of [[-1], [256], [1.5], [], {}, null]) await assert.rejects(extractor.extract(data), error => error.code === 'input' || error.code === 'corrupt');
  for (const options of [{maxPages: 0}, {maxChars: -1}, {timeoutMs: Infinity}, {maxPages: '2'}, {maxChars: NaN}, {maxPages: 1.5}]) {
    await assert.rejects(extractor.extract(tinyPDF(), options), error => error.code === 'options');
  }
  assert.equal(observed.loads, 0);
});
test('higher requested limits cannot exceed the hard page and character ceilings', async () => {
  const {extractor, observed} = controlled({texts: Array(30).fill('A'.repeat(4000))});
  const result = await extractor.extract(tinyPDF(), {maxPages: 1000, maxChars: 1000000});
  assert.equal(result.text.length, 60000); assert.equal(result.truncated, true); assert.ok(result.pages <= 20);
  assert.equal(observed.terminated, 1); assert.equal(observed.destroyed, 1);
  const pageLimited = controlled({texts: Array(30).fill('A')});
  assert.equal((await pageLimited.extractor.extract(tinyPDF(), {maxPages: 1000})).pages, 20);
  assert.equal(pageLimited.observed.pages.length, 20);
});
test('only requests text, with eval, XFA, rendering and automatic resource fetching disabled', async () => {
  const {extractor, observed} = controlled({texts: ['Only plain text']});
  assert.equal((await extractor.extract(tinyPDF())).text, 'Only plain text');
  const options = observed.parameters;
  for (const key of ['isEvalSupported', 'enableXfa', 'useWorkerFetch', 'useWasm', 'isOffscreenCanvasSupported', 'isImageDecoderSupported', 'useSystemFonts']) assert.equal(options[key], false, key);
  for (const key of ['stopAtErrors', 'disableFontFace', 'disableRange', 'disableStream', 'disableAutoFetch', 'disableWorkerRendering']) assert.equal(options[key], true, key);
  assert.equal(options.url, undefined); assert.equal(observed.destroyed, 1); assert.equal(observed.terminated, 1);
  assert.deepEqual(observed.cleaned, [1]);
});
test('cancels the text stream as soon as extra characters exceed the budget', async () => {
  const {extractor, observed} = controlled({texts: ['A'.repeat(100000), 'Must never read this page']});
  const result = await extractor.extract(tinyPDF(), {maxChars: 9});
  assert.equal(result.text, 'AAAAAAAAA'); assert.equal(result.truncated, true);
  assert.deepEqual(observed.pages, [1]); assert.equal(observed.reads, 1); assert.equal(observed.cancelled, 1);
});
test('preserves EOL boundaries, skips marked-content records, and does not split surrogate pairs', async () => {
  const {extractor} = controlled({texts: ['unused'], chunk: {items: [{type: 'beginMarkedContent'}, {str: 'Alpha', hasEOL: true}, {str: 'Beta', hasEOL: false}, {str: '😀', hasEOL: false}]}});
  const result = await extractor.extract(tinyPDF(), {maxChars: 12});
  assert.equal(result.text, 'Alpha\nBeta '); assert.equal(result.truncated, true);
  assert.ok(!/[\uD800-\uDBFF]$/.test(result.text));
});
test('a pre-aborted signal does not import the library', async () => {
  const {extractor, observed} = controlled(); const controller = new AbortController(); controller.abort();
  await assert.rejects(extractor.extract(tinyPDF(), {signal: controller.signal}), error => error.name === 'AbortError' && error.code === 'aborted');
  assert.equal(observed.loads, 0);
});
test('abort while loading destroys the task and worker without awaiting an unresponsive parser', async () => {
  const {extractor, observed} = controlled({load: () => new Promise(() => {}), destroy: () => new Promise(() => {})});
  const controller = new AbortController(); const pending = extractor.extract(tinyPDF(), {signal: controller.signal});
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  await assert.rejects(pending, error => error.code === 'aborted');
  assert.equal(observed.destroyed, 1); assert.equal(observed.terminated, 1);
});
test('abort while streaming cancels the reader and cleans the active page', async () => {
  const {extractor, observed} = controlled({read: () => new Promise(() => {})});
  const controller = new AbortController(); const pending = extractor.extract(tinyPDF(), {signal: controller.signal});
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  await assert.rejects(pending, error => error.code === 'aborted');
  assert.equal(observed.cancelled, 1); assert.deepEqual(observed.cleaned, [1]);
  assert.equal(observed.destroyed, 1); assert.equal(observed.terminated, 1);
});
test('a page resolving after cancellation is cleaned without starting text extraction', async () => {
  let finishPage, cleaned = 0;
  const {extractor} = controlled({load: document => {
    document.getPage = () => new Promise(resolve => { finishPage = resolve; });
    return Promise.resolve(document);
  }});
  const controller = new AbortController();
  const pending = extractor.extract(tinyPDF(), {signal: controller.signal});
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  await assert.rejects(pending, error => error.code === 'aborted');
  finishPage({cleanup() { cleaned++; }, streamTextContent() { assert.fail('Late page text must not be read'); }});
  await new Promise(resolve => setImmediate(resolve)); assert.equal(cleaned, 1);
});
test('a higher requested timeout cannot exceed the 15 second ceiling', async () => {
  const {extractor} = controlled({texts: ['Small text']});
  const original = globalThis.setTimeout, delays = [];
  globalThis.setTimeout = (callback, delay, ...args) => { delays.push(delay); return original(callback, delay, ...args); };
  try { await extractor.extract(tinyPDF(), {timeoutMs: 999999}); }
  finally { globalThis.setTimeout = original; }
  assert.deepEqual(delays, [15000]);
});
test('timeout covers stalled library loading without starting late work', async () => {
  let finish, started = 0;
  const extractor = require(modulePath).createExtractor({loadLibrary: () => new Promise(resolve => { finish = resolve; }), createWorker: () => { started++; }});
  const pending = extractor.extract(tinyPDF(), {timeoutMs: 20});
  await assert.rejects(pending, error => error.name === 'TimeoutError' && error.code === 'timeout');
  finish({getDocument() { started++; }});
  await new Promise(resolve => setImmediate(resolve)); assert.equal(started, 0);
});
test('the deadline also covers reading Blob bytes', async () => {
  class StalledBlob extends Blob { arrayBuffer() { return new Promise(() => {}); } }
  const {extractor, observed} = controlled();
  await assert.rejects(extractor.extract(new StalledBlob([tinyPDF()]), {timeoutMs: 20}), error => error.code === 'timeout');
  assert.equal(observed.loads, 0);
});
test('refuses a document whose encryption metadata cannot be verified', async () => {
  const {extractor, observed} = controlled({metadata: {}});
  await assert.rejects(extractor.extract(tinyPDF()), error => error.code === 'corrupt');
  assert.equal(observed.destroyed, 1); assert.equal(observed.terminated, 1);
});
test('timeout covers text streams and teardown cannot extend the deadline', async () => {
  for (const behavior of [{read: () => new Promise(() => {})}, {texts: ['Done'], destroy: () => new Promise(() => {})}]) {
    const {extractor, observed} = controlled(behavior);
    await assert.rejects(extractor.extract(tinyPDF(), {timeoutMs: 20}), error => error.code === 'timeout');
    assert.equal(observed.destroyed, 1); assert.equal(observed.terminated, 1);
  }
});
test('parser errors reject the whole result instead of returning partial text', async () => {
  const {extractor, observed} = controlled({pageError: Error('Malformed content stream')});
  await assert.rejects(extractor.extract(tinyPDF()), error => error.code === 'corrupt');
  assert.equal(observed.destroyed, 1); assert.equal(observed.terminated, 1);
});
test('concurrent extractions keep independent worker lifetimes', async () => {
  const slow = controlled({load: () => new Promise(() => {})}); const fast = controlled({texts: ['Independent']});
  const controller = new AbortController();
  const pending = slow.extractor.extract(tinyPDF(), {signal: controller.signal});
  assert.equal((await fast.extractor.extract(tinyPDF())).text, 'Independent'); controller.abort();
  await assert.rejects(pending, error => error.code === 'aborted');
  assert.equal(slow.observed.terminated, 1); assert.equal(fast.observed.terminated, 1);
});
test('the three vendor artifacts match the recorded official package hashes', () => {
  const {vendor} = require(modulePath);
  const vendorPath = path.resolve(__dirname, '../extension/vendor/pdfjs');
  assert.deepEqual(fs.readdirSync(vendorPath).sort(), ['LICENSE', 'pdf.mjs', 'pdf.worker.mjs']);
  for (const [name, hash] of Object.entries(vendor.sha256)) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(vendorPath, name))).digest('hex'), hash);
});
