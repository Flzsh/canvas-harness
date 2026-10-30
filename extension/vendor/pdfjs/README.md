# PDF.js (third-party, unmodified)

These files are Mozilla's PDF.js, copied byte for byte from the official npm package. They are the readable modern
builds: not minified, not transpiled, and without bundled polyfills.

- Package: `pdfjs-dist` 6.4.299 (PDF.js build `d0991a0d5`),
  https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz
  (npm integrity `sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==`)
- Source: https://github.com/mozilla/pdf.js
- License: Apache-2.0 (`LICENSE` in this folder, identical to the package's `LICENSE`)

| File here | File in the package | Bytes | SHA-256 |
|---|---|---|---|
| `pdf.mjs` | `build/pdf.mjs` | 860,818 | `dd13af821c9c3e1778653340d6539a1ba07bc56cba40073a4c727864cf0c232a` |
| `pdf.worker.mjs` | `build/pdf.worker.mjs` | 2,229,713 | `07ceb740d746e5d9012fcf9f27d5c7dea09f7d2f5e74f5c8109e5787551a2333` |
| `LICENSE` | `LICENSE` | 10,174 | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` |

## Why the modern build

The package's `legacy/build` files bundle core-js polyfills for old browsers. The modern `build` files contain only
PDF.js's own code and use the browser's built-in features instead.

A few of the built-ins it calls directly are newer than Chrome 126: `Math.sumPrecise` (Chrome 147),
`Map.prototype.getOrInsert` and `getOrInsertComputed` and the `WeakMap` versions (145), `Blob.prototype.bytes` (144),
the `Uint8Array` base64 and hex methods (140), `Response.prototype.bytes` (132) and `Promise.try` (128). The extension
never loads these files directly. It loads `pdf-library.mjs` in the page and `pdf-worker.mjs` as the worker; each first
imports `pdf-polyfills.js`, which adds those built-ins when the browser lacks them (written from their standards,
readable, no core-js), and then imports the unmodified file here. With them, the newest feature PDF.js still needs
from the browser is `URL.parse` (Chrome 126), so the extension's `minimum_chrome_version` is 126. Its newest syntax
is class static blocks (Chrome 94). Newer features (`Float16Array`, `Iterator.prototype.join`, `Sanitizer`, WebGPU,
Brotli in `DecompressionStream`) are feature-tested by PDF.js and have fallbacks.

Neither file contains `eval`, `new Function`, iframes, `javascript:` URLs or code that writes HTML into a document.

## Upstream code paths that stay switched off

PDF.js ships optional paths that Canvas Harness never turns on. They are left in place so the files stay identical
to the npm package.

| Path in PDF.js | Where | Why it never runs here |
|---|---|---|
| PostScript functions compiled to WebAssembly | `pdf.worker.mjs` lines 30885-31645 (`./src/core/postscript/wasm_compiler.js`), called at line 32184 only if `useWasm` | Every `getDocument` call passes `useWasm: false`, and the extension's content security policy (`script-src 'self'`, no `'wasm-unsafe-eval'`) blocks WebAssembly compilation anyway. PDF.js uses its PostScript interpreter instead. |
| WebAssembly decoders for ICC colour (qcms), JBIG2 and JPEG 2000 (OpenJPEG) | `pdf.worker.mjs` lines 1741-1983 and 2670-2813 (qcms), 9311-9682 (JBIG2 and the shared `WasmImage` loader), 10111-10709 (OpenJPEG) | They load their `.wasm` and fallback files only from the `wasmUrl` option. Canvas Harness never sets `wasmUrl` and passes `useWasm: false`; no `.wasm` file is packaged. |
| Fetching fonts, CMaps and other resources by URL | `fetch` and `XMLHttpRequest` calls in both files | Canvas Harness sets none of `cMapUrl`, `standardFontDataUrl`, `iccUrl` or `wasmUrl`, passes `useWorkerFetch: false`, and opens every PDF from bytes it already has (`data`). The text reader also replaces the resource loader with one that always refuses. |
| A worker wrapper for workers on another site (`_createCDNWrapper`, `await import(...)` in a Blob) and the main-thread fallback worker (`await import(workerSrc)`) | `pdf.mjs` lines 16223-16228 and 16377 | Canvas Harness creates the worker itself from the packaged `pdf-worker.mjs` (the polyfills, then `pdf.worker.mjs`) and hands it to PDF.js, so neither path is reached. |
| XFA forms | both files | `enableXfa: false`. |

## The Brotli dictionary line

`pdf.worker.mjs` line 9180 is a single 131,686-byte call:
`unpackDictionaryData(dictionaryData, "wjnfgltmojef...", ...)`. It is data, not code:

- **What it is:** the 122,784-byte static dictionary of the Brotli compression format (RFC 7932, Appendix A). Every
  Brotli decoder carries it. RFC 7932 gives its CRC-32 as `0x5136cb04`; its SHA-256 is
  `20e42eb1b511c21806d4d227d07e5dd06877d8ce7b3a817f378f313653f35c70`.
- **Where it comes from:** Google's Brotli JavaScript decoder (https://github.com/google/brotli, `js/decode.js`,
  MIT license), which PDF.js includes as `external/brotli/decode.js` (the marker at line 7338).
- **Why it looks scrambled:** upstream stores the bytes as printable text. Runs of characters are XOR-ed with 3 or with
  236; the third string argument lists the run lengths. `unpackDictionaryData` (line 9156) undoes this once, into a
  byte table. Nothing in the string is executed.
- **What uses it:** only the `BrotliDecode` PDF stream filter (line 11689, `BrotliStream` at line 9272).
- **How to check it:** `node scripts/pdfjs-brotli-dictionary.cjs` in the Canvas Harness source decodes the string with
  its own code (it does not run PDF.js), checks the length, the CRC-32 from RFC 7932 and the SHA-256 above, and looks
  for the same bytes inside the Node.js program, whose built-in Brotli library carries the same dictionary.

## Other long lines

`pdf.worker.mjs` also keeps upstream's other data tables on single lines: font metric, glyph mapping and CFF
standard string tables, and the fixed Huffman code table of the Flate decoder (up to about 5.7 KB each).
They are data, not code. `pdf.mjs` has no line over 3,500 bytes.

Canvas Harness uses PDF.js only to show and read the PDFs a student opens from their own Canvas. No code or data is
loaded from anywhere else.
