// The PDF.js worker's entry point (a module worker). The standard built-ins PDF.js needs that older browsers lack are
// added first (pdf-polyfills.js; imports run in order), then the unmodified worker in vendor/pdfjs is loaded; it
// starts answering the page as it loads. Its exports are passed on for PDF.js's in-page worker, which tests use.
import './pdf-polyfills.js';
export * from './vendor/pdfjs/pdf.worker.mjs';
