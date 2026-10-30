// PDF.js for the PDF reader page and the offscreen text reader. The standard built-ins it needs that older browsers
// lack are added first (pdf-polyfills.js; imports run in order), then the unmodified library in vendor/pdfjs is loaded
// and its exports passed on.
import './pdf-polyfills.js';
export * from './vendor/pdfjs/pdf.mjs';
