'use strict';
// Store readability rules for the files that go into the package (used by scripts/release-audit.cjs).
//
// The Chrome Web Store rejects code that looks obfuscated. These rules keep out the patterns a reviewer reads that
// way, in our own files and in vendored ones:
//   - code that builds or runs code from text: eval, new Function, string timers, document.write, javascript: URLs,
//     a 'java' + ... string split, and the core-js iframe helper that the store cited in 3.7.0;
//   - invisible or direction-changing characters (zero-width, bidi controls, BOM inside text);
//   - long base64 runs in our own files, except data:image URLs whose bytes really are that image;
//   - in our own JavaScript, lines with more than readable-lines.LIMIT bytes of code (scripts/readable-lines.cjs fixes
//     those, changing whitespace only).

const readableLines = require('./readable-lines.cjs');

const CODE_FILE = /\.(?:[cm]?js|html?)$/i;
const AUTHORED_CODE = /\.[cm]?js$/i;
const AUTHORED_TEXT = /\.(?:[cm]?js|css|html?|svg|json)$/i;

const CONCEALMENT = [
  ['core-js', /\bcore-js\b/],
  ['NullProtoObjectViaIFrame', /NullProtoObjectViaIFrame/],
  ['split javascript: string', /(['"`])java\1\s*\+/],
  ['javascript: URL', /javascript\s*:/i],
  ['document.write', /[dD]ocument\s*\.\s*write(?:ln)?\s*\(/],
  ['eval', /(?<![\w$.])eval\s*\(/],
  ['new Function', /\bnew\s+Function\s*\(/],
  ['Function constructor', /(?<![\w$.])Function\s*\(/],
  ['string timer', /\bset(?:Timeout|Interval)\s*\(\s*['"`]/],
];

// Zero-width characters, bidi embedding/override/isolate controls, invisible operators, BOM, soft hyphen.
const INVISIBLE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

const DATA_IMAGE = /data:image\/(png|jpeg|gif|webp);base64,((?:[A-Za-z0-9+/=]|\\\r?\n)+)/g;
const MAGIC = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpeg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46],
};
const BASE64_RUN = /[A-Za-z0-9+/]{200,}/g;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Returns a list of findings ({rule, line, detail}) for one packaged file.
function findings(name, text, authored) {
  const out = [];
  if (CODE_FILE.test(name)) {
    for (const [rule, pattern] of CONCEALMENT) {
      const match = pattern.exec(text);
      if (match) {
        out.push({ rule, line: lineOf(text, match.index), detail: match[0] });
      }
    }
  }
  for (const match of text.matchAll(INVISIBLE)) {
    out.push({ rule: 'invisible character', line: lineOf(text, match.index), detail: 'U+' + match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0') });
  }
  if (authored && AUTHORED_TEXT.test(name)) {
    let rest = text;
    for (const match of text.matchAll(DATA_IMAGE)) {
      const bytes = Buffer.from(match[2].replace(/\\\r?\n/g, ''), 'base64');
      if (!MAGIC[match[1]].every((byte, i) => bytes[i] === byte)) {
        out.push({ rule: 'data:image is not that image', line: lineOf(text, match.index), detail: 'image/' + match[1] });
      }
      rest = rest.replace(match[0], ' ');
    }
    for (const match of rest.matchAll(BASE64_RUN)) {
      out.push({ rule: 'base64 run outside a data:image URL', line: null, detail: match[0].slice(0, 40) + '...' });
    }
  }
  if (authored && AUTHORED_CODE.test(name)) {
    const options = { ecmaVersion: 'latest', sourceType: /\.mjs$/i.test(name) ? 'module' : 'script', allowHashBang: true, allowReturnOutsideFunction: true };
    for (const entry of readableLines.denseLines(text, options)) {
      out.push({ rule: 'dense code line', line: entry.line, detail: entry.bytes + ' bytes of code (limit ' + readableLines.LIMIT + '; run node scripts/readable-lines.cjs)' });
    }
  }
  return out;
}

module.exports = { findings, CONCEALMENT, INVISIBLE };
