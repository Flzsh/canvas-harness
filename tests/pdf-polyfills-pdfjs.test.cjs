'use strict';
// PDF.js on the polyfills alone. A separate Node process removes every built-in that extension/pdf-polyfills.js
// provides (and Float16Array, which Chrome 126 lacks too and PDF.js tests for), then loads PDF.js through the
// extension's own entry points: pdf-library.mjs for the page and pdf-worker.mjs as the worker. It opens self-made PDFs,
// builds every page's drawing operations (what the canvas renderer paints), reads their text, checks the fingerprint,
// and saves marks into a copy with the extension's exporter. Counting wrappers show which polyfills PDF.js called.
// The work runs in its own process because the suite shares one process and its built-ins must stay as they are.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const CHILD_FLAG = 'CANVAS_HARNESS_PDFJS_WITHOUT_BUILT_INS';
const extension = path.resolve(__dirname, '../extension');

// The built-ins pdf-polyfills.js provides, as [owner expression, property name].
const POLYFILLED = [
  ['Math', 'sumPrecise'],
  ['Promise', 'try'],
  ['Map.prototype', 'getOrInsert'],
  ['Map.prototype', 'getOrInsertComputed'],
  ['WeakMap.prototype', 'getOrInsert'],
  ['WeakMap.prototype', 'getOrInsertComputed'],
  ['Uint8Array', 'fromBase64'],
  ['Uint8Array', 'fromHex'],
  ['Uint8Array.prototype', 'toBase64'],
  ['Uint8Array.prototype', 'toHex'],
  ['Uint8Array.prototype', 'setFromBase64'],
  ['Uint8Array.prototype', 'setFromHex'],
  ['Blob.prototype', 'bytes'],
  ['Response.prototype', 'bytes'],
];

if (process.env[CHILD_FLAG] === '1') {
  runWithoutBuiltIns().then(
    result => process.stdout.write(JSON.stringify(result)),
    error => {
      process.stderr.write(String(error && error.stack || error));
      process.exitCode = 1;
    },
  );
} else {
  defineTests();
}

function defineTests() {
  const { test } = require('node:test');
  const assert = require('node:assert/strict');
  let outcome;
  const run = () => {
    if (!outcome) {
      const child = spawnSync(process.execPath, [__filename], {
        env: { ...process.env, [CHILD_FLAG]: '1' },
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 4 * 1024 * 1024,
      });
      assert.equal(child.status, 0, 'the PDF.js run failed:\n' + child.stderr);
      outcome = JSON.parse(child.stdout);
    }
    return outcome;
  };

  test('the PDF.js process starts with none of the built-ins the polyfills provide', () => {
    const result = run();
    assert.deepEqual(result.presentAfterRemoval, []);
    assert.equal(result.float16ArrayAfterRemoval, 'undefined');
  });

  test('loading pdf-library.mjs adds every polyfill before PDF.js runs', () => {
    const result = run();
    assert.deepEqual(result.missingAfterLoad, []);
    assert.deepEqual(result.nativeAfterLoad, [], 'each one is the polyfill, not a built-in');
    assert.equal(result.libraryExports, true);
  });

  test('PDF.js opens, draws and reads PDFs through pdf-library.mjs and pdf-worker.mjs on the polyfills', () => {
    const result = run();
    assert.deepEqual(result.documents.map(document => document.name), ['two text pages', 'image page', 'cross-reference stream', 'compressed content']);
    for (const document of result.documents) {
      assert.ok(document.operators.every(count => count > 0), document.name + ': every page has drawing operations');
      assert.equal(document.fingerprint, document.expectedFingerprint, document.name + ': fingerprint (MD5 hex)');
    }
    assert.deepEqual(result.documents[0].text, ['First page of the handout', 'Second page: questions']);
    assert.deepEqual(result.documents[2].text, ['Packed cross-reference']);
    assert.deepEqual(result.documents[3].text, ['Compressed page text']);
  });

  test('the exporter saves marks into a copy that opens again, on the polyfills', () => {
    const result = run();
    assert.equal(result.saved.incremental, true, 'the original bytes are kept as the start of the copy');
    assert.deepEqual(result.saved.annotations, [['Highlight', 'Ink'], ['FreeText']]);
    assert.deepEqual(result.saved.text, ['First page of the handout', 'Second page: questions']);
  });

  test('PDF.js really called the polyfills', () => {
    const { calls } = run();
    for (const name of ['Promise.try', 'Math.sumPrecise', 'Uint8Array.prototype.toHex', 'Response.prototype.bytes']) {
      assert.ok(calls[name] > 0, name + ' was called ' + calls[name] + ' times');
    }
    assert.ok(calls['Map.prototype.getOrInsertComputed'] + calls['WeakMap.prototype.getOrInsertComputed'] > 0);
  });

  test('Blob and Response bytes() work in place of the removed built-ins', () => {
    const { bytes } = run();
    assert.deepEqual(bytes.blob, [1, 2, 3, 104, 105]);
    assert.deepEqual(bytes.response, [9, 8, 7]);
    assert.equal(bytes.usedBody, 'TypeError');
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The child process

function owner(expression) {
  return expression.split('.').reduce((object, key) => object[key], globalThis);
}

const isNative = fn => /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(fn));

async function runWithoutBuiltIns() {
  const { createHash } = require('node:crypto');
  const { deflateSync } = require('node:zlib');
  const { pathToFileURL } = require('node:url');

  for (const [object, name] of POLYFILLED) {
    delete owner(object)[name];
  }
  delete globalThis.Float16Array;
  const result = {
    presentAfterRemoval: POLYFILLED.filter(([object, name]) => name in owner(object)).map(pair => pair.join('.')),
    float16ArrayAfterRemoval: typeof globalThis.Float16Array,
  };

  // Node has no DOM graphics API; these unused stand-ins only let the browser build of PDF.js load.
  globalThis.DOMMatrix ??= class DOMMatrix {};
  globalThis.Path2D ??= class Path2D {};
  globalThis.ImageData ??= class ImageData {};

  const lib = await import(pathToFileURL(path.join(extension, 'pdf-library.mjs')).href);
  result.libraryExports = typeof lib.getDocument === 'function' && typeof lib.GlobalWorkerOptions === 'function';
  result.missingAfterLoad = POLYFILLED.filter(([object, name]) => typeof owner(object)[name] !== 'function').map(pair => pair.join('.'));
  result.nativeAfterLoad = POLYFILLED.filter(([object, name]) => isNative(owner(object)[name])).map(pair => pair.join('.'));

  // Count calls without changing behaviour or property attributes.
  const calls = {};
  for (const [object, name] of POLYFILLED) {
    const target = owner(object);
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    const polyfill = descriptor.value;
    const label = object + '.' + name;
    calls[label] = 0;
    const counted = {
      [name](...args) {
        calls[label]++;
        return Reflect.apply(polyfill, this, args);
      },
    }[name];
    Object.defineProperty(target, name, { ...descriptor, value: counted });
  }

  // In Node, PDF.js runs the worker module in the same process (its "fake worker"), loaded from workerSrc.
  lib.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(extension, 'pdf-worker.mjs')).href;
  const options = {
    verbosity: 0,
    isEvalSupported: false,
    enableXfa: false,
    useWasm: false,
    useWorkerFetch: false,
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: false,
  };
  const open = data => lib.getDocument({ ...options, data: Uint8Array.from(data) });
  const textOf = async document => {
    const text = [];
    for (let number = 1; number <= document.numPages; number++) {
      const content = await (await document.getPage(number)).getTextContent();
      text.push(content.items.map(item => item.str).join(''));
    }
    return text;
  };

  result.documents = [];
  for (const [name, data] of samplePdfs(deflateSync)) {
    const task = open(data);
    const document = await task.promise;
    try {
      const operators = [];
      for (let number = 1; number <= document.numPages; number++) {
        const list = await (await document.getPage(number)).getOperatorList();
        operators.push(list.fnArray.length);
      }
      result.documents.push({
        name,
        operators,
        text: await textOf(document),
        fingerprint: document.fingerprints[0],
        // A PDF without an /ID is fingerprinted by the MD5 of its first 1,024 bytes, zero-filled when shorter.
        expectedFingerprint: createHash('md5').update(Buffer.concat([data.subarray(0, 1024), Buffer.alloc(1024)]).subarray(0, 1024)).digest('hex'),
      });
    } finally {
      await task.destroy();
    }
  }

  const exporter = require(path.join(extension, 'pdf-export.js'));
  const original = samplePdfs(deflateSync)[0][1];
  const pen = Array.from({ length: 80 }, (_, i) => [30 + i * 2, 150 + Math.round(10 * Math.sin(i / 5))]);
  const marks = [
    { id: 'highlight', type: 'highlight', page: 0, color: '#f6de7a', rects: [[40, 330, 140, 345]], text: 'First page' },
    { id: 'pen', type: 'pen', page: 0, color: '#b5552e', points: pen },
    { id: 'note', type: 'note', page: 1, point: [70, 220], text: 'Check the units.\nUse SI units.' },
  ];
  const saved = await exporter.withMarks({ lib, data: original, annotations: marks, name: 'Handout.pdf' });
  const reopening = open(saved.bytes);
  const reopened = await reopening.promise;
  try {
    const annotations = [];
    for (let number = 1; number <= reopened.numPages; number++) {
      const list = await (await reopened.getPage(number)).getAnnotations();
      annotations.push(list.map(annotation => annotation.subtype).sort());
    }
    result.saved = {
      incremental: Buffer.from(saved.bytes.subarray(0, original.length)).equals(Buffer.from(original)),
      annotations,
      text: await textOf(reopened),
    };
  } finally {
    await reopening.destroy();
  }

  // Calls made by PDF.js only; the checks below call bytes() themselves.
  result.calls = { ...calls };

  const response = new Response('used');
  await response.text();
  result.bytes = {
    blob: Array.from(await new Blob([new Uint8Array([1, 2, 3]), 'hi']).bytes()),
    response: Array.from(await new Response(new Uint8Array([9, 8, 7])).bytes()),
    usedBody: await response.bytes().then(() => 'resolved', error => error.name),
  };
  return result;
}

// Self-made, byte-correct PDFs: no binary fixtures. Each is [name, bytes].
function samplePdfs(deflateSync) {
  const latin = text => Buffer.from(text, 'latin1');
  const literal = text => text.replace(/[\\()]/g, '\\$&');
  const stream = (body, extra = '') => `<< /Length ${latin(body).length}${extra} >>\nstream\n${body}\nendstream`;
  const font = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  function build(objects, trailer = '') {
    let body = '%PDF-1.7\n';
    const offsets = [];
    objects.forEach((object, index) => {
      offsets.push(latin(body).length);
      body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = latin(body).length;
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    body += offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${trailer} >>\nstartxref\n${xref}\n%%EOF\n`;
    return new Uint8Array(latin(body));
  }

  function textPages(texts) {
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '', font];
    const kids = [];
    for (const text of texts) {
      const page = objects.length + 1;
      kids.push(`${page} 0 R`);
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`);
      objects.push(stream(`BT /F1 12 Tf 40 350 Td (${literal(text)}) Tj ET 0.2 0.4 0.6 rg 40 300 120 20 re f`));
    }
    objects[1] = `<< /Type /Pages /Count ${kids.length} /Kids [${kids.join(' ')}] >>`;
    return build(objects);
  }

  const imagePage = build([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>',
    stream('q 120 0 0 120 40 40 cm /Im1 Do Q'),
    '<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 12 >>\nstream\n' +
      '\xff\x00\x00\x00\xff\x00\x00\x00\xff\xff\xff\x00\nendstream',
  ]);

  // The same text page with its cross-reference table packed into a compressed /XRef stream.
  function crossReferenceStream() {
    const plain = Buffer.from(textPages(['Packed cross-reference'])).toString('latin1');
    const body = plain.slice(0, plain.indexOf('\nxref\n') + 1);
    const starts = [...body.matchAll(/^(\d+) 0 obj/gm)].map(match => match.index);
    const offsets = [0, ...starts, latin(body).length];
    const records = Buffer.alloc(offsets.length * 7);
    offsets.forEach((offset, id) => {
      records[id * 7] = id === 0 ? 0 : 1;
      records.writeUInt32BE(offset, id * 7 + 1);
      records.writeUInt16BE(id === 0 ? 65535 : 0, id * 7 + 5);
    });
    const packed = deflateSync(records);
    const id = offsets.length - 1;
    const xref = `${id} 0 obj\n<< /Type /XRef /Size ${offsets.length} /Root 1 0 R /W [1 4 2] /Filter /FlateDecode /Length ${packed.length} >>\nstream\n` +
      `${packed.toString('latin1')}\nendstream\nendobj\nstartxref\n${offsets[id]}\n%%EOF\n`;
    return new Uint8Array(latin(body + xref));
  }

  const content = deflateSync(latin('BT /F1 14 Tf 30 300 Td (Compressed page text) Tj ET'));
  const compressed = build([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n${content.toString('latin1')}\nendstream`,
    font,
  ]);

  return [
    ['two text pages', textPages(['First page of the handout', 'Second page: questions'])],
    ['image page', imagePage],
    ['cross-reference stream', crossReferenceStream()],
    ['compressed content', compressed],
  ];
}
