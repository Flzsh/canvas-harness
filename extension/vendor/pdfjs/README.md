# PDF.js (third-party, unmodified)

These files are Mozilla's PDF.js, copied byte for byte from the official npm package. They are the readable builds,
not the minified ones.

- Package: `pdfjs-dist` 6.4.299, https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz
  (npm integrity `sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==`)
- Source: https://github.com/mozilla/pdf.js
- License: Apache-2.0 (`LICENSE` in this folder)

| File here | File in the package | SHA-256 |
|---|---|---|
| `pdf.mjs` | `legacy/build/pdf.mjs` | `bc51f4874a66e3853189cb5d50aba4b3096afa83ed433b885d293a3d94583cdc` |
| `pdf.worker.mjs` | `legacy/build/pdf.worker.mjs` | `bb422f60804477de4a0b09091d8347a916a387755ed1cbad24ccaec1d09c78bf` |

The legacy build is used because it runs on Chrome 120, the extension's minimum version. The one very long line in
`pdf.worker.mjs` is the Brotli decoder's built-in dictionary, which upstream ships as a string of data.
Canvas Harness uses PDF.js only to show and read the PDFs a student opens from their own Canvas. No code or data is
loaded from anywhere else.
