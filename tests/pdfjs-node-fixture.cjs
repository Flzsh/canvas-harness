'use strict';
// The extension ships PDF.js's modern build, which calls a few built-ins that only newer browsers have (Node 22/24
// lack several of them too). In the extension, pdf-library.mjs and pdf-worker.mjs load extension/pdf-polyfills.js
// before PDF.js; tests that import the vendored build directly load that same file here, so they run PDF.js on the
// polyfills the extension ships wherever Node has no built-in.
require('../extension/pdf-polyfills.js');
