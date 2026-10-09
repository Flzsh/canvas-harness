/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
/*
 * Opt-in, text-only PDF context. Load this classic script in the extension's
 * offscreen document; PDF.js is imported only when extract() is explicitly called.
 * No PDF URL fetching, rendering, annotations, actions, scripting, forms or OCR.
 *
 * Vendored unchanged from the official npm pdfjs-dist 6.4.299 package (Mozilla
 * PDF.js build d0991a0d5), verified against its registry SHA-512 integrity.
 * legacy/build/pdf.min.mjs -> vendor/pdfjs/pdf.mjs
 * legacy/build/pdf.worker.min.mjs -> vendor/pdfjs/pdf.worker.mjs
 * LICENSE -> vendor/pdfjs/LICENSE (Apache-2.0)
 * The legacy ESM build includes compatibility polyfills for Chrome 120.
 * Source/version/integrity and SHA-256 file hashes are exposed as `vendor` below.
 * API references: https://mozilla.github.io/pdf.js/examples/
 * https://mozilla.github.io/pdf.js/api/draft/api.js.html
 *
 * extract(data, {signal, maxPages=20, maxChars=60000, timeoutMs=15000})
 *   -> {text, pages, totalPages, truncated, warnings}
 * `pages` is the number of pages visited (including blank/image-only pages).
 * Text is in PDF content order with two newlines between nonempty pages.
 * Character counts are UTF-16 code units, including separators. Limits can be
 * reduced; higher values are clamped to the defaults, which are hard ceilings.
 * Input must be bytes (ArrayBuffer/view, byte array, or Blob), at most 2 MiB.
 * Errors have stable `code`: input, options, oversize, corrupt, encrypted,
 * unavailable, aborted (AbortError), timeout (TimeoutError).
 * Each extraction owns a dedicated worker. The browser path requires a real
 * Worker and never falls back to parsing untrusted bytes on the document thread.
 *
 * Tests/other hosts can use createExtractor({loadLibrary, createWorker}).
 * loadLibrary() returns the PDF.js API; createWorker(library) synchronously
 * returns {worker: PDFWorker, terminate()}. These are trusted dependencies.
 * Offscreen integration: permission `offscreen`, reason `WORKERS`, local HTML
 * and a local message bridge script loading this file. Keep the existing
 * script-src 'self' CSP; worker-src 'self' can be explicit. Neither vendor file
 * needs web_accessible_resources when used solely by the offscreen document.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CanvasHarnessPDF = api;
})(globalThis, function (root) {
  'use strict';
  const MAX_BYTES = 2 * 1024 * 1024;
  const MAX_PAGES = 20, MAX_CHARS = 60000, MAX_TIMEOUT = 15000;
  const vendor = Object.freeze({
    version: '6.4.299',
    build: 'd0991a0d5',
    source: 'https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz',
    integrity: 'sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==',
    sha256: Object.freeze({
      'pdf.mjs': 'bccc24ea711db8e44503629519904a5292d73b9daaa214bbe7cdcc282b0f4259',
      'pdf.worker.mjs': '145d2dd3ab0c86151011dba95acfa2d5336e2accd59388ea43dbee0efddaaec6',
      LICENSE: '0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594'
    })
  });
  class PDFContextError extends Error {
    constructor(message, code, name = 'PDFContextError') {
      super(message); this.name = name; this.code = code;
    }
  }
  const error = (message, code, name) => new PDFContextError(message, code, name);
  const encrypted = () => error('Encrypted PDFs cannot be added as text context.', 'encrypted');
  const corrupt = () => error('The PDF is corrupt, incomplete, or cannot be read safely.', 'corrupt');

  function limit(value, ceiling) {
    if (value === undefined) return ceiling;
    if (!Number.isSafeInteger(value) || value < 1) throw error('PDF limits must be positive integers.', 'options');
    return Math.min(value, ceiling);
  }
  function inputSize(data) {
    let size;
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) size = data.byteLength;
    else if (Array.isArray(data)) size = data.length;
    else if (typeof root.Blob === 'function' && data instanceof root.Blob) size = data.size;
    else throw error('Supply PDF bytes, not a URL or string.', 'input');
    if (size > MAX_BYTES) throw error('PDF text context is limited to 2 MiB per file.', 'oversize');
    if (size === 0) throw error('The PDF is empty.', 'input');
    return size;
  }
  function copyBytes(data) {
    if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
    if (ArrayBuffer.isView(data)) return new Uint8Array(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    for (const byte of data) if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw error('The PDF byte array contains invalid values.', 'input');
    return new Uint8Array(data);
  }
  function ascii(bytes, start, end) {
    const parts = [];
    for (let i = start; i < end; i += 8192) parts.push(String.fromCharCode(...bytes.subarray(i, Math.min(end, i + 8192))));
    return parts.join('');
  }
  function dictionaryEnd(text, start) {
    // Find the matching dictionary close without crossing an incremental
    // update or mistaking literal strings, hex strings or comments for tokens.
    let depth = 0, literalDepth = 0;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (literalDepth) {
        if (char === '\\') i++;
        else if (char === '(') literalDepth++;
        else if (char === ')') literalDepth--;
      } else if (char === '(') literalDepth = 1;
      else if (char === '%') { while (i < text.length && text[i] !== '\r' && text[i] !== '\n') i++; }
      else if (text.startsWith('<<', i)) { depth++; i++; }
      else if (text.startsWith('>>', i)) { if (--depth === 0) return i + 2; i++; }
      else if (char === '<') { while (i < text.length && text[i] !== '>') i++; }
    }
    throw corrupt();
  }
  function checkEnvelope(bytes) {
    // PDF.js intentionally recovers some damaged files. Refuse missing/invalid
    // envelopes and broken final xref offsets before permitting that parser.
    if (!/%PDF-(?:1\.[0-7]|2\.0)(?:\s|$)/.test(ascii(bytes, 0, Math.min(bytes.length, 1024)))) throw corrupt();
    const tail = ascii(bytes, Math.max(0, bytes.length - 2048), bytes.length);
    const trailer = /startxref\s+(\d+)\s+%%EOF[\s\x00]*$/.exec(tail);
    if (!trailer) throw corrupt();
    const offset = Number(trailer[1]);
    if (!Number.isSafeInteger(offset) || offset < 8 || offset >= bytes.length) throw corrupt();
    const xref = ascii(bytes, offset, Math.min(bytes.length, offset + 4096));
    // Both ordinary xref tables and modern xref streams are supported.
    if (/^xref\b/.test(xref)) checkXrefTables(bytes, offset);
    else if (!/^\d+\s+\d+\s+obj\b[\s\S]*?\/Type\s*\/XRef\b/.test(xref)) throw corrupt();
  }
  function checkXrefTables(bytes, offset) {
    // Validate object offsets instead of accepting PDF.js's xref repair mode.
    // Walk incremental-update /Prev tables, retaining the most recent entries.
    const visited = new Set(), entries = new Map();
    let rootRef, hybrid = false;
    while (offset != null) {
      if (visited.has(offset) || visited.size >= 64 || !Number.isSafeInteger(offset) || offset < 8 || offset >= bytes.length) throw corrupt();
      visited.add(offset);
      const table = ascii(bytes, offset, bytes.length);
      // An earlier revision can use a cross-reference stream. PDF.js handles
      // its binary/compressed index, while the envelope check validates its type.
      if (!/^xref\b/.test(table)) {
        if (!/^\d+\s+\d+\s+obj\b[\s\S]*?\/Type\s*\/XRef\b/.test(table.slice(0, 4096))) throw corrupt();
        hybrid = true; break;
      }
      let cursor = 4;
      const section = /\s*(\d+)\s+(\d+)[ \t]*(?:\r\n|\r|\n)/y;
      const entry = /[ \t]*(\d{10})[ \t]+(\d{5})[ \t]+([nf])[ \t]*(?:\r\n|\r|\n)/y;
      while (true) {
        while (/\s/.test(table[cursor] || '') && cursor < table.length) cursor++;
        if (table.startsWith('trailer', cursor)) break;
        section.lastIndex = cursor;
        const range = section.exec(table);
        if (!range) throw corrupt();
        const start = Number(range[1]), count = Number(range[2]);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || count < 1 || count > bytes.length / 18 || !Number.isSafeInteger(start + count)) throw corrupt();
        cursor = section.lastIndex;
        for (let index = 0; index < count; index++) {
          entry.lastIndex = cursor;
          const record = entry.exec(table);
          if (!record) throw corrupt();
          cursor = entry.lastIndex;
          const id = start + index, position = Number(record[1]), generation = Number(record[2]);
          if (generation > 65535) throw corrupt();
          if (record[3] === 'n') {
            if (position < 8 || position >= bytes.length) throw corrupt();
            const header = /^(\d+)\s+(\d+)\s+obj\b/.exec(ascii(bytes, position, Math.min(bytes.length, position + 64)));
            if (!header || Number(header[1]) !== id || Number(header[2]) !== generation) throw corrupt();
          }
          if (!entries.has(id)) entries.set(id, record[3] === 'n' ? {position, generation} : null);
        }
      }
      const begin = cursor + 7;
      if (!/^\s*<</.test(table.slice(begin, begin + 64))) throw corrupt();
      const trailer = table.slice(begin, dictionaryEnd(table, begin));
      const reference = /\/Root\s+(\d+)\s+(\d+)\s+R\b/.exec(trailer);
      if (!rootRef && reference) rootRef = {id: Number(reference[1]), generation: Number(reference[2])};
      if (/\/XRefStm\s+\d+\b/.test(trailer)) hybrid = true;
      const previous = /\/Prev\s+(\d+)\b/.exec(trailer);
      offset = previous ? Number(previous[1]) : null;
    }
    if (!rootRef) { if (hybrid) return; throw corrupt(); }
    const catalog = entries.get(rootRef.id);
    if (!catalog) { if (hybrid && catalog === undefined) return; throw corrupt(); }
    if (catalog.generation !== rootRef.generation) throw corrupt();
    const object = ascii(bytes, catalog.position, Math.min(bytes.length, catalog.position + 4096));
    const begin = object.indexOf('<<');
    if (begin < 0) throw corrupt();
    const dictionary = object.slice(0, dictionaryEnd(object, begin));
    if (!/^\d+\s+\d+\s+obj\s*<</.test(dictionary) || !/\/Type\s*\/Catalog\b/.test(dictionary)) throw corrupt();
  }

  let libraryPromise;
  function packagedURL(path) {
    if (typeof root.chrome?.runtime?.getURL !== 'function') throw error('PDF extraction requires the extension offscreen document.', 'unavailable');
    return root.chrome.runtime.getURL(path);
  }
  function loadPackagedLibrary() {
    if (!libraryPromise) {
      libraryPromise = import(packagedURL('vendor/pdfjs/pdf.mjs')).then(library => {
        if (library.version !== vendor.version) throw error('The packaged PDF library version is incorrect.', 'unavailable');
        library.GlobalWorkerOptions.workerSrc = packagedURL('vendor/pdfjs/pdf.worker.mjs');
        return library;
      }).catch(() => {
        libraryPromise = undefined;
        throw error('The packaged PDF library could not be loaded.', 'unavailable');
      });
    }
    return libraryPromise;
  }
  function createPackagedWorker(library) {
    if (typeof root.Worker !== 'function') throw error('A dedicated PDF worker is required.', 'unavailable');
    const port = new root.Worker(packagedURL('vendor/pdfjs/pdf.worker.mjs'), {type: 'module'});
    let worker;
    try { worker = library.PDFWorker.create({port, verbosity: 0}); }
    catch (_) { port.terminate(); throw error('The PDF worker could not be created.', 'unavailable'); }
    return {worker, terminate() { try { port.terminate(); } finally { worker.destroy(); } }};
  }

  function createExtractor({loadLibrary = loadPackagedLibrary, createWorker = createPackagedWorker} = {}) {
    if (typeof loadLibrary !== 'function' || typeof createWorker !== 'function') throw error('Invalid PDF parser dependencies.', 'options');
    async function extract(data, options = {}) {
      if (!options || typeof options !== 'object') throw error('Invalid PDF extraction options.', 'options');
      const {signal} = options;
      const maxPages = limit(options.maxPages, MAX_PAGES), maxChars = limit(options.maxChars, MAX_CHARS), timeoutMs = limit(options.timeoutMs, MAX_TIMEOUT);
      if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function' || typeof signal.aborted !== 'boolean')) throw error('Invalid PDF abort signal.', 'options');
      if (signal?.aborted) throw error('PDF extraction cancelled.', 'aborted', 'AbortError');
      inputSize(data); // Reject oversize input before copying bytes or importing.

      const deadline = Date.now() + timeoutMs;
      let task, destruction, resource, readerState, pageState, stoppedError, rejectStop, terminated = false;
      const warnings = [];
      const stopped = new Promise((_, reject) => { rejectStop = reject; });
      stopped.catch(() => {});
      const ignore = promise => { Promise.resolve(promise).catch(() => {}); };
      function cancelReader() {
        if (!readerState || readerState.done || readerState.cancelled) return;
        readerState.cancelled = true;
        // PDF.js requires an Error cancellation reason. A string throws inside
        // its stream callback after the controller closes, racing worker replies.
        try { ignore(readerState.reader.cancel(stoppedError || new Error('PDF text limit reached.'))); } catch (_) { /* Worker teardown still runs. */ }
      }
      function cleanPage() {
        if (!pageState || pageState.cleaned) return;
        pageState.cleaned = true;
        try { pageState.page.cleanup(); } catch (_) { /* Full document teardown follows. */ }
      }
      function destroyTask() {
        if (!task) return Promise.resolve();
        if (!destruction) {
          try { destruction = Promise.resolve(task.destroy()); }
          catch (failure) { destruction = Promise.reject(failure); }
          ignore(destruction);
        }
        return destruction;
      }
      function terminateWorker() {
        if (!resource || terminated) return;
        terminated = true;
        try { resource.terminate(); } catch (_) { /* Do not mask the original error. */ }
      }
      function stop(reason) {
        if (stoppedError) return;
        stoppedError = reason;
        rejectStop(reason);
        cancelReader(); cleanPage(); ignore(destroyTask()); terminateWorker();
      }
      const abort = () => stop(error('PDF extraction cancelled.', 'aborted', 'AbortError'));
      const timeout = () => stop(error('PDF extraction exceeded its time limit.', 'timeout', 'TimeoutError'));
      const timer = setTimeout(timeout, timeoutMs);
      signal?.addEventListener('abort', abort, {once: true});
      function ensureActive() {
        if (signal?.aborted) abort();
        if (!stoppedError && Date.now() >= deadline) timeout();
        if (stoppedError) throw stoppedError;
      }
      async function guard(operation) {
        ensureActive();
        const result = await Promise.race([Promise.resolve().then(operation), stopped]);
        ensureActive();
        return result;
      }

      let stage = 'input';
      try {
        const source = typeof root.Blob === 'function' && data instanceof root.Blob ? await guard(() => data.arrayBuffer()) : data;
        inputSize(source);
        const bytes = copyBytes(source);
        checkEnvelope(bytes); ensureActive();
        stage = 'library';
        const library = await guard(loadLibrary);
        if (typeof library?.getDocument !== 'function') throw error('The PDF parser is unavailable.', 'unavailable');
        resource = createWorker(library);
        if (!resource?.worker || typeof resource.terminate !== 'function') throw error('The PDF worker is unavailable.', 'unavailable');
        ensureActive();
        stage = 'parse';
        // No URL or resource URLs are provided. This also disallows fallback
        // font/CMap/ICC/wasm fetches, even if future library defaults change.
        class NoExternalData {
          async fetch() { throw error('External PDF font resources are unavailable.', 'unavailable'); }
        }
        task = library.getDocument({
          data: bytes, worker: resource.worker, stopAtErrors: true,
          isEvalSupported: false, enableXfa: false, disableFontFace: true,
          useSystemFonts: false, useWorkerFetch: false, useWasm: false,
          isOffscreenCanvasSupported: false, isImageDecoderSupported: false,
          disableWorkerRendering: true, maxImageSize: 0,
          disableRange: true, disableStream: true, disableAutoFetch: true,
          BinaryDataFactory: NoExternalData, verbosity: 0
        });
        task.onPassword = () => stop(encrypted()); // No password prompts or retries.
        const document = await guard(() => task.promise);
        if (!Number.isSafeInteger(document?.numPages) || document.numPages < 1) throw corrupt();
        const metadata = await guard(() => document.getMetadata());
        const permissions = await guard(() => document.getPermissions());
        if (!metadata?.info || !Object.hasOwn(metadata.info, 'EncryptFilterName')) throw corrupt();
        // Metadata also detects encryption where the user password is empty,
        // and where an invalid/missing permission entry would otherwise be null.
        if (metadata?.info?.EncryptFilterName != null || permissions != null) throw encrypted();
        const totalPages = document.numPages;
        let text = '', pages = 0, charLimit = false;
        const pageLimit = Math.min(totalPages, maxPages);
        for (let number = 1; number <= pageLimit; number++) {
          ensureActive();
          const page = await guard(() => Promise.resolve(document.getPage(number)).then(value => {
            // A cancelled dependency can still resolve. Dispose that late page
            // even though the caller has already received its abort/timeout.
            if (stoppedError || signal?.aborted || Date.now() >= deadline) {
              try { value?.cleanup(); } catch (_) { /* Its worker is already stopping. */ }
            }
            return value;
          }));
          pageState = {page, cleaned: false}; pages++;
          let hasText = false, separator = '';
          try {
            const reader = page.streamTextContent({includeMarkedContent: false, disableNormalization: false}).getReader();
            readerState = {reader, done: false, cancelled: false};
            while (!charLimit) {
              const chunk = await guard(() => reader.read());
              if (chunk.done) { readerState.done = true; break; }
              if (!Array.isArray(chunk.value?.items)) throw corrupt();
              for (const item of chunk.value.items) {
                ensureActive();
                if (typeof item?.str !== 'string') continue;
                const remaining = maxChars - text.length;
                // Slice before normalization: a malicious text item must not
                // cause an unbounded secondary string/regex allocation here.
                const sample = item.str.slice(0, remaining + 1);
                const clean = sample.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim();
                if (clean) {
                  const prefix = hasText ? separator : (text ? '\n\n' : '');
                  const piece = prefix + clean;
                  let taken = piece.slice(0, remaining);
                  if (/[\uD800-\uDBFF]$/.test(taken)) taken = taken.slice(0, -1);
                  text += taken; hasText = true;
                  if (piece.length > remaining) charLimit = true;
                }
                if (item.str.length > sample.length) charLimit = true;
                if (item.hasEOL) separator = '\n';
                else if (clean) separator = ' ';
                if (charLimit) break;
              }
            }
            if (!hasText && !charLimit) warnings.push(`Page ${number} has no extractable text (possibly image-only or blank); OCR is not supported.`);
          } finally {
            cancelReader();
            try { readerState?.reader.releaseLock(); } catch (_) { /* A cancelled read may still be settling. */ }
            readerState = undefined; cleanPage(); pageState = undefined;
          }
          if (charLimit || (text.length >= maxChars && pages < totalPages)) { charLimit = true; break; }
        }
        if (totalPages > maxPages) warnings.push(`The page limit is ${maxPages}; this PDF contains ${totalPages} pages.`);
        if (charLimit) warnings.push(`Text was truncated at the ${maxChars}-character limit.`);
        return {text, pages, totalPages, truncated: charLimit || pages < totalPages, warnings};
      } catch (failure) {
        if (stoppedError) throw stoppedError;
        if (failure instanceof PDFContextError) throw failure;
        if (failure?.name === 'PasswordException') throw encrypted();
        if (stage === 'library') throw error('The PDF library or worker could not be loaded.', 'unavailable');
        throw corrupt();
      } finally {
        try {
          cancelReader(); cleanPage();
          const ending = destroyTask();
          if (!stoppedError) {
            try { await guard(() => ending); }
            catch (failure) {
              if (stoppedError) throw stoppedError;
              warnings.push('The PDF task could not finish cleanup; its worker was terminated.');
            }
          }
        } finally {
          terminateWorker(); clearTimeout(timer); signal?.removeEventListener('abort', abort);
        }
      }
    }
    return Object.freeze({extract});
  }
  return Object.freeze({extract: createExtractor().extract, createExtractor, PDFContextError, vendor});
});
