'use strict';
// Development check, not packaged: shows that the one 131,686-byte line in vendor/pdfjs/pdf.worker.mjs is the
// standard Brotli dictionary (RFC 7932, Appendix A) and nothing else.
//
// It reads the string arguments of upstream's unpackDictionaryData(...) call, undoes the packing with its own code
// (it never runs PDF.js), and checks the result against the length and CRC-32 that RFC 7932 gives, and against the
// SHA-256 recorded in vendor/pdfjs/README.md. When the running Node.js program carries the same dictionary (Node's
// built-in Brotli library does), it also finds the identical bytes there.
//
// Usage: node scripts/pdfjs-brotli-dictionary.cjs [path/to/pdf.worker.mjs]

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const WORKER = path.resolve(__dirname, '../extension/vendor/pdfjs/pdf.worker.mjs');
const RFC_7932_LENGTH = 122784;
const RFC_7932_CRC32 = 0x5136cb04;
const SHA256 = '20e42eb1b511c21806d4d227d07e5dd06877d8ce7b3a817f378f313653f35c70';
const CALL = /^\s*unpackDictionaryData\(dictionaryData, "/;

// Node's own copy of the acorn parser, used only to read the string literals of one line.
function loadParser() {
  const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
  if (!source) {
    throw Error('This Node build does not expose its bundled JavaScript parser.');
  }
  const parserModule = { exports: {} };
  vm.runInNewContext(source, { module: parserModule, exports: parserModule.exports }, { timeout: 5000 });
  return parserModule.exports;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Returns the call's literal arguments: [packedPart1, packedPart2, skipFlipRuns, sizeBits].
function readCall(workerText) {
  const lines = workerText.split('\n').filter(line => CALL.test(line));
  if (lines.length !== 1) {
    throw Error('Expected one unpackDictionaryData call, found ' + lines.length + '.');
  }
  const call = loadParser().parse(lines[0], { ecmaVersion: 'latest' }).body[0].expression;
  const names = call.arguments.map(arg => (arg.type === 'Identifier' ? arg.name : null));
  const strings = call.arguments.filter(arg => arg.type === 'Literal' && typeof arg.value === 'string');
  if (call.arguments.length !== 6 || names[0] !== 'dictionaryData' || names[4] !== 'dictionarySizeBits' || strings.length !== 4) {
    throw Error('The unpackDictionaryData call has an unexpected shape.');
  }
  return strings.map(arg => arg.value);
}

// The packing of Google's Brotli JavaScript decoder: every character is one byte, and the run list says how
// many bytes in turn to XOR with 3 ("skip") and with 236 ("flip"), each count stored as a character code plus 36.
function unpack([part1, part2, runs]) {
  const text = part1 + part2;
  const bytes = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 255) {
      throw Error('The packed dictionary has a character outside one byte.');
    }
    bytes[i] = code;
  }
  let offset = 0;
  for (let i = 0; i + 1 < runs.length; i += 2) {
    const skip = runs.charCodeAt(i) - 36;
    const flip = runs.charCodeAt(i + 1) - 36;
    for (let j = 0; j < skip; j++) {
      bytes[offset++] ^= 3;
    }
    for (let j = 0; j < flip; j++) {
      bytes[offset++] ^= 236;
    }
  }
  if (offset !== bytes.length) {
    throw Error('The XOR runs cover ' + offset + ' of ' + bytes.length + ' bytes.');
  }
  return bytes;
}

// Word lengths 0-24: each length L with N bits holds 2^N words of L bytes. Together they must fill the dictionary.
function sizeBitsTotal(sizeBits) {
  let total = 0;
  for (let length = 0; length < sizeBits.length; length++) {
    const bits = sizeBits.charCodeAt(length) - 65;
    if (bits > 0) {
      total += length << bits;
    }
  }
  return total;
}

function check(workerPath = WORKER) {
  const args = readCall(fs.readFileSync(workerPath, 'utf8'));
  const dictionary = unpack(args);
  const result = {
    bytes: dictionary.length,
    wordTableBytes: sizeBitsTotal(args[3]),
    crc32: crc32(dictionary),
    sha256: crypto.createHash('sha256').update(dictionary).digest('hex'),
    firstWords: dictionary.subarray(0, 32).toString('latin1'),
    inNodeBinary: null,
  };
  if (result.bytes !== RFC_7932_LENGTH || result.wordTableBytes !== RFC_7932_LENGTH) {
    throw Error('The dictionary is ' + result.bytes + ' bytes (word table ' + result.wordTableBytes + '), not ' + RFC_7932_LENGTH + '.');
  }
  if (result.crc32 !== RFC_7932_CRC32) {
    throw Error('CRC-32 ' + result.crc32.toString(16) + ' differs from RFC 7932 (' + RFC_7932_CRC32.toString(16) + ').');
  }
  if (result.sha256 !== SHA256) {
    throw Error('SHA-256 ' + result.sha256 + ' differs from vendor/pdfjs/README.md.');
  }
  try {
    result.inNodeBinary = fs.readFileSync(process.execPath).indexOf(dictionary) >= 0;
  } catch {
    result.inNodeBinary = null;
  }
  return result;
}

if (require.main === module) {
  const result = check(process.argv[2] ? path.resolve(process.argv[2]) : WORKER);
  console.log('Brotli dictionary in pdf.worker.mjs: ' + result.bytes + ' bytes, starts "' + result.firstWords + '"');
  console.log('CRC-32 ' + result.crc32.toString(16) + ' (RFC 7932 Appendix A), SHA-256 ' + result.sha256);
  if (result.inNodeBinary === true) {
    console.log('The same bytes are in this Node.js program (' + process.execPath + '), whose Brotli library carries the dictionary.');
  } else if (result.inNodeBinary === false) {
    console.log('This Node.js program does not carry its own copy of the dictionary (Brotli may be linked separately).');
  }
}

module.exports = { check, unpack, readCall, crc32, SHA256, RFC_7932_CRC32, RFC_7932_LENGTH };
