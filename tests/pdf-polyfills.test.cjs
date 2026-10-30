'use strict';
// extension/pdf-polyfills.js adds the standard built-ins PDF.js calls that Chrome and Edge 126-146 do not have. Each test
// loads the file into a fresh JavaScript realm (node:vm) whose own versions of those built-ins were removed first, so the
// polyfill is what runs whatever Node version runs the tests. Expected results follow the steps of each standard and the
// test262 cases for them; Math.sumPrecise is also checked against an exact BigInt sum on many random inputs, and each
// polyfill against Node's own built-in wherever Node has one.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.resolve(__dirname, '../extension/pdf-polyfills.js');
const source = fs.readFileSync(file, 'utf8');
const isNative = fn => typeof fn === 'function' && /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(fn));

const REMOVE_BUILT_INS = `
  delete Math.sumPrecise;
  delete Promise.try;
  for (const Type of [Map, WeakMap]) {
    delete Type.prototype.getOrInsert;
    delete Type.prototype.getOrInsertComputed;
  }
  for (const name of ['toBase64', 'toHex', 'setFromBase64', 'setFromHex']) {
    delete Uint8Array.prototype[name];
  }
  delete Uint8Array.fromBase64;
  delete Uint8Array.fromHex;
`;

// Blob and Response are Web APIs, not part of a bare realm. The realm gets Node's own classes as subclasses whose
// bytes() is hidden, so the polyfill adds its version to them while Node's classes stay as they are.
function webClass(Base) {
  const Subclass = class extends Base {};
  Object.defineProperty(Subclass.prototype, 'bytes', { value: undefined, writable: true, configurable: true });
  return Subclass;
}

// Returns the realm's global object, whose properties are that realm's own built-ins.
const contexts = new WeakMap();
function realm(setup = '') {
  const context = vm.createContext({});
  vm.runInContext(REMOVE_BUILT_INS + setup, context);
  context.Blob = webClass(globalThis.Blob);
  context.Response = webClass(globalThis.Response);
  vm.runInContext(source, context, { filename: file });
  const global = vm.runInContext('globalThis', context);
  contexts.set(global, context);
  return global;
}

const R = realm();
const bytesOf = view => Array.from(view);
const ascii = text => Array.from(Buffer.from(text, 'latin1'));
// Map entries come back as the realm's own arrays; copy them so they compare with this realm's arrays.
const entriesOf = map => Array.from(map, ([key, value]) => [key, value]);

test('the file runs as a classic script and as a module: no imports, exports or top-level this', () => {
  assert.doesNotThrow(() => new vm.Script(source, { filename: file }));
  const readableLines = require('../scripts/readable-lines.cjs');
  assert.equal(readableLines.sameProgram(source, source, { ecmaVersion: 'latest', sourceType: 'module' }), null);
  assert.doesNotMatch(source, /^\s*(?:import|export)\b/m);
  assert.doesNotMatch(source, /\beval\s*\(|new Function|Function\s*\(\s*['"`]|document\.write|setTimeout\(\s*['"`]/);
});

const extensionFile = name => fs.readFileSync(path.resolve(__dirname, '../extension', name), 'utf8');
const vendored = extensionFile('vendor/pdfjs/pdf.mjs') + '\n' + extensionFile('vendor/pdfjs/pdf.worker.mjs');

test('the extension needs Chrome 126: each newer built-in PDF.js calls directly is polyfilled', () => {
  assert.equal(JSON.parse(extensionFile('manifest.json')).minimum_chrome_version, '126');
  // [a direct call in the vendored build, the Chrome version that added it, where pdf-polyfills.js puts it]
  const newer = [
    [/\bMath\.sumPrecise\(/, 147, R.Math, 'sumPrecise'],
    [/\.getOrInsertComputed\(/, 145, R.Map.prototype, 'getOrInsertComputed'],
    [/\.getOrInsertComputed\(/, 145, R.WeakMap.prototype, 'getOrInsertComputed'],
    [/\.getOrInsert\(/, 145, R.Map.prototype, 'getOrInsert'],
    [/\.getOrInsert\(/, 145, R.WeakMap.prototype, 'getOrInsert'],
    [/\bblob\.bytes\(\)/, 144, R.Blob.prototype, 'bytes'],
    [/\.toHex\(\)/, 140, R.Uint8Array.prototype, 'toHex'],
    [/\.toBase64\(\)/, 140, R.Uint8Array.prototype, 'toBase64'],
    [/\bUint8Array\.fromBase64\(/, 140, R.Uint8Array, 'fromBase64'],
    [/\bresponse\.bytes\(\)|new Response\([^()]*\)\.bytes\(\)/, 132, R.Response.prototype, 'bytes'],
    [/\bPromise\.try\(/, 128, R.Promise, 'try'],
  ];
  for (const [call, version, target, name] of newer) {
    assert.match(vendored, call, 'PDF.js still calls ' + name + ' (Chrome ' + version + ')');
    assert.equal(typeof target[name], 'function', name + ' is polyfilled');
  }
  // The newest built-in it needs from the browser itself, which sets the minimum.
  assert.match(vendored, /\bURL\.parse\(/);
  // Built-ins Chrome added after 126 that the polyfills do not provide must not be called without a feature test.
  const unprovided = [
    /\bError\.isError\(/, /\bRegExp\.escape\(/, /\bMath\.f16round\(/, /\bAtomics\.pause\(/, /\bIterator\.(?:concat|zip|zipKeyed)\(/,
    /\bTemporal\./, /\bIntl\.DurationFormat\b/, /\.(?:getFloat16|setFloat16)\(/, /\bcaretPositionFromPoint\b/,
    /\b(?:Async)?DisposableStack\b/, /\bSymbol\.(?:asyncDispose|dispose)\b/, /\bReadableStream\.from\(/,
  ];
  for (const pattern of unprovided) {
    assert.doesNotMatch(vendored, pattern);
  }
  // Float16Array (Chrome 135) is used only behind PDF.js's own feature test, with a Float32Array fallback.
  const lines = vendored.split('\n');
  let float16 = 0;
  lines.forEach((line, index) => {
    if (!/\bFloat16Array\b/.test(line)) {
      return;
    }
    float16++;
    const guarded = /typeof Float16Array !== "undefined"|isFloat16ArraySupported \? .*: new Float32Array|isFloat16ArraySupported \? Float16Array : Float32Array/.test(line) ||
      (lines[index - 1].trim() === 'if (FeatureTest.isFloat16ArraySupported) {' && /return new Float32Array/.test(lines[index + 2]));
    assert.ok(guarded, 'unguarded Float16Array: ' + line.trim());
  });
  assert.equal(float16, 6);
});

test('the page and the worker load the polyfills before PDF.js, and nothing loads PDF.js without them', () => {
  for (const [entry, vendorFile] of [['pdf-library.mjs', 'pdf.mjs'], ['pdf-worker.mjs', 'pdf.worker.mjs']]) {
    const statements = extensionFile(entry).split('\n').filter(line => /^(?:import|export)\b/.test(line));
    assert.deepEqual(statements, ["import './pdf-polyfills.js';", `export * from './vendor/pdfjs/${vendorFile}';`], entry);
  }
  const reader = extensionFile('pdf-reader.js');
  assert.match(reader, /await import\('\.\/pdf-library\.mjs'\)/);
  assert.match(reader, /workerSrc=env\.chrome\.runtime\.getURL\('pdf-worker\.mjs'\)/);
  for (const name of fs.readdirSync(path.resolve(__dirname, '../extension')).filter(n => /\.m?js$/.test(n))) {
    assert.doesNotMatch(extensionFile(name), /(?:import\(|getURL\(|packagedURL\(|Worker\()\s*['"`][^'"`]*vendor\/pdfjs\//, name);
  }
  const manifest = JSON.parse(extensionFile('manifest.json'));
  const exposed = manifest.web_accessible_resources.flatMap(entry => entry.resources);
  for (const name of ['pdf-library.mjs', 'pdf-worker.mjs', 'pdf-polyfills.js']) {
    assert.ok(!exposed.includes(name), name + ' is loaded only by the extension\'s own pages');
  }
  assert.match(manifest.content_security_policy.extension_pages, /worker-src 'self'/);
});

test('each built-in is defined like a built-in method: writable, configurable, named, with the standard length', () => {
  const expected = [
    [R.Promise, 'try', 1, false],
    [R.Map.prototype, 'getOrInsert', 2, false],
    [R.Map.prototype, 'getOrInsertComputed', 2, false],
    [R.WeakMap.prototype, 'getOrInsert', 2, false],
    [R.WeakMap.prototype, 'getOrInsertComputed', 2, false],
    [R.Math, 'sumPrecise', 1, false],
    [R.Uint8Array, 'fromBase64', 1, false],
    [R.Uint8Array, 'fromHex', 1, false],
    [R.Uint8Array.prototype, 'toBase64', 0, false],
    [R.Uint8Array.prototype, 'toHex', 0, false],
    [R.Uint8Array.prototype, 'setFromBase64', 1, false],
    [R.Uint8Array.prototype, 'setFromHex', 1, false],
    // Web IDL operations are enumerable.
    [R.Blob.prototype, 'bytes', 0, true],
    [R.Response.prototype, 'bytes', 0, true],
  ];
  for (const [target, name, length, enumerable] of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    assert.equal(typeof descriptor.value, 'function', name);
    assert.equal(descriptor.writable, true, name);
    assert.equal(descriptor.configurable, true, name);
    assert.equal(descriptor.enumerable, enumerable, name);
    assert.equal(descriptor.value.name, name);
    assert.equal(descriptor.value.length, length, name);
    assert.equal(Object.hasOwn(descriptor.value, 'prototype'), false, name);
    assert.throws(() => new descriptor.value(), { name: 'TypeError' }, name + ' is not a constructor');
  }
});

test('a built-in the browser already has is kept as it is', () => {
  const kept = realm('Math.sumPrecise = function sumPrecise() { return "browser"; };');
  assert.equal(kept.Math.sumPrecise([1, 2]), 'browser');
  assert.equal(Object.getOwnPropertyDescriptor(kept.Math, 'sumPrecise').enumerable, true, 'left exactly as found');
  assert.equal(typeof kept.Map.prototype.getOrInsert, 'function', 'the missing ones are still added');
});

// ---------------------------------------------------------------------------------------------------------------------
// Promise.try

test('Promise.try calls the callback at once with the arguments and an undefined this', async () => {
  const calls = [];
  const promise = R.Promise.try(function (...args) {
    calls.push([this, ...args]);
    return 'value';
  }, 1, 2);
  assert.deepEqual(calls, [[undefined, 1, 2]], 'called synchronously');
  assert.ok(promise instanceof R.Promise);
  assert.equal(await promise, 'value');
});

test('Promise.try turns a throw, also from a callback that is not callable, into a rejection', async () => {
  const error = new Error('inside');
  await assert.rejects(R.Promise.try(() => { throw error; }), error);
  for (const notCallable of [undefined, null, 1, {}]) {
    const promise = R.Promise.try(notCallable);
    assert.ok(promise instanceof R.Promise);
    await assert.rejects(promise, { name: 'TypeError' });
  }
});

test('Promise.try follows a returned thenable and uses the constructor it is called on', async () => {
  assert.equal(await R.Promise.try(() => ({ then: resolve => resolve('followed') })), 'followed');
  const Sub = vm.runInContext('(class Sub extends Promise {})', contexts.get(R));
  assert.ok(Sub.try(() => 1) instanceof Sub);
  const record = [];
  function Capability(executor) {
    executor(value => record.push(['resolve', value]), reason => record.push(['reject', reason]));
  }
  Capability.prototype.tag = 'custom';
  const custom = R.Promise.try.call(Capability, () => 'x');
  assert.equal(custom.tag, 'custom');
  assert.deepEqual(record, [['resolve', 'x']]);
  R.Promise.try.call(Capability, () => { throw 'no'; });
  assert.deepEqual(record[1], ['reject', 'no']);
});

test('Promise.try throws for a this value that is not a promise constructor', () => {
  for (const receiver of [undefined, null, 1, 'P', {}, () => {}]) {
    assert.throws(() => R.Promise.try.call(receiver, () => 1), { name: 'TypeError' });
  }
  assert.throws(() => R.Promise.try.call(function NoCapability() {}, () => 1), { name: 'TypeError' });
  const twice = function (executor) {
    executor(() => {}, () => {});
    executor(() => {}, () => {});
  };
  assert.throws(() => R.Promise.try.call(twice, () => 1), { name: 'TypeError' });
});

test('Promise.try agrees with Node\'s built-in where Node has one', { skip: !isNative(Promise.try) && 'Node has no Promise.try' }, async () => {
  const settle = promise => promise.then(value => ['fulfilled', value], reason => ['rejected', reason && reason.name || reason]);
  const cases = [[() => 5], [(a, b) => a + b, 2, 3], [() => { throw new TypeError('x'); }], [undefined], [() => Promise.reject(7)], [() => ({ then: r => r(8) })]];
  for (const [callback, ...args] of cases) {
    assert.deepEqual(await settle(R.Promise.try(callback, ...args)), await settle(Promise.try(callback, ...args)));
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Map and WeakMap getOrInsert / getOrInsertComputed

test('Map getOrInsert returns the value present, or adds and returns the one given', () => {
  const map = new R.Map([['a', 1]]);
  assert.equal(map.getOrInsert('a', 2), 1);
  assert.equal(map.getOrInsert('b', 3), 3);
  assert.deepEqual(entriesOf(map), [['a', 1], ['b', 3]]);
  const value = {};
  assert.equal(map.getOrInsert(-0, value), value);
  assert.ok(Object.is([...map.keys()][2], 0), '-0 is stored as +0');
  assert.equal(map.getOrInsert(0, 'other'), value);
  assert.equal(map.getOrInsert(NaN, 'n'), 'n');
  assert.equal(map.getOrInsert(NaN, 'm'), 'n');
});

test('Map getOrInsertComputed calls the callback only for a missing key, with the key and no this', () => {
  const map = new R.Map([['a', 1]]);
  const calls = [];
  const callback = function (...args) {
    calls.push([this, ...args]);
    return args[0] + '!';
  };
  assert.equal(map.getOrInsertComputed('a', callback), 1);
  assert.deepEqual(calls, []);
  assert.equal(map.getOrInsertComputed('b', callback), 'b!');
  assert.deepEqual(calls, [[undefined, 'b']]);
  assert.equal(map.get('b'), 'b!');
  map.getOrInsertComputed(-0, key => {
    assert.ok(Object.is(key, 0), 'the callback receives +0 for -0');
    return 'zero';
  });
  assert.equal(map.get(0), 'zero');
});

test('Map getOrInsertComputed checks the callback first, even when the key is present', () => {
  const map = new R.Map([['a', 1]]);
  for (const notCallable of [undefined, null, 1, {}]) {
    assert.throws(() => map.getOrInsertComputed('a', notCallable), { name: 'TypeError' });
  }
  assert.deepEqual(entriesOf(map), [['a', 1]]);
});

test('Map getOrInsertComputed: a key the callback added keeps its place and takes the returned value', () => {
  const map = new R.Map([['first', 0]]);
  const result = map.getOrInsertComputed('k', () => {
    map.set('k', 'inner');
    map.set('later', 1);
    return 'outer';
  });
  assert.equal(result, 'outer');
  assert.deepEqual(entriesOf(map), [['first', 0], ['k', 'outer'], ['later', 1]]);
  const thrown = new Error('callback failed');
  assert.throws(() => map.getOrInsertComputed('z', () => { throw thrown; }), thrown);
  assert.equal(map.has('z'), false);
});

test('Map methods refuse a receiver that is not a Map', () => {
  for (const receiver of [{}, new R.WeakMap(), new R.Set(), null, undefined]) {
    assert.throws(() => R.Map.prototype.getOrInsert.call(receiver, 'a', 1), { name: 'TypeError' });
    assert.throws(() => R.Map.prototype.getOrInsertComputed.call(receiver, 'a', () => 1), { name: 'TypeError' });
  }
  class Sub extends R.Map {
    set() {
      throw new Error('the standard does not call set');
    }
  }
  assert.equal(new Sub().getOrInsert('a', 1), 1);
});

test('WeakMap getOrInsert and getOrInsertComputed take only keys that can be held weakly', () => {
  const map = new R.WeakMap();
  const key = {};
  assert.equal(map.getOrInsert(key, 1), 1);
  assert.equal(map.getOrInsert(key, 2), 1);
  assert.equal(map.getOrInsertComputed(key, () => 3), 1);
  const symbol = Symbol('local');
  assert.equal(map.getOrInsertComputed(symbol, value => typeof value), 'symbol');
  assert.equal(map.get(symbol), 'symbol');
  assert.equal(map.getOrInsert(Symbol.iterator, 'well-known'), 'well-known');
  for (const bad of [1, 'a', null, undefined, true, Symbol.for('registered')]) {
    assert.throws(() => map.getOrInsert(bad, 1), { name: 'TypeError' });
    assert.throws(() => map.getOrInsertComputed(bad, () => 1), { name: 'TypeError' });
  }
  assert.throws(() => map.getOrInsertComputed(key, null), { name: 'TypeError' }, 'callback checked even when present');
  let called = 0;
  map.getOrInsertComputed({}, function () {
    called++;
    assert.equal(this, undefined);
  });
  assert.equal(called, 1);
  assert.throws(() => R.WeakMap.prototype.getOrInsert.call(new R.Map(), key, 1), { name: 'TypeError' });
});

test('Map getOrInsert agrees with Node\'s built-in where Node has one', { skip: !isNative(Map.prototype.getOrInsertComputed) && 'Node has no Map.prototype.getOrInsertComputed' }, () => {
  const ours = new R.Map();
  const theirs = new Map();
  for (const key of ['a', 'b', 'a', -0, 0, NaN, NaN]) {
    assert.equal(ours.getOrInsertComputed(key, k => String(k)), theirs.getOrInsertComputed(key, k => String(k)));
    assert.equal(ours.getOrInsert(key + 'x', 1), theirs.getOrInsert(key + 'x', 1));
  }
  assert.deepEqual(entriesOf(ours), entriesOf(theirs));
});

// ---------------------------------------------------------------------------------------------------------------------
// Math.sumPrecise

// The exact sum of finite doubles as a BigInt count of 2^-1074 (the smallest double), rounded once at the end to the
// nearest double, ties to even, with 2^1024 treated as even and turned into Infinity (ECMAScript's "Number value for x").
function units(x) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  const significand = exponent === 0 ? fraction : fraction | (1n << 52n);
  const magnitude = significand << BigInt(exponent === 0 ? 0 : exponent - 1);
  return bits >> 63n ? -magnitude : magnitude;
}

function toDouble(total) {
  if (total === 0n) {
    return 0;
  }
  const negative = total < 0n;
  const magnitude = negative ? -total : total;
  const length = magnitude.toString(2).length;
  let value;
  if (length <= 53) {
    value = Number(magnitude) * 2 ** -1074;
  } else {
    const shift = length - 53;
    let kept = magnitude >> BigInt(shift);
    const rest = magnitude - (kept << BigInt(shift));
    const half = 1n << BigInt(shift - 1);
    if (rest > half || (rest === half && (kept & 1n) === 1n)) {
      kept += 1n;
    }
    value = Number(kept) * 2 ** (shift - 1074);
  }
  return negative ? -value : value;
}

function exactSum(values) {
  let state = 'minus-zero';
  let total = 0n;
  for (const value of values) {
    if (state === 'not-a-number') {
      continue;
    }
    if (Number.isNaN(value)) {
      state = 'not-a-number';
    } else if (value === Infinity) {
      state = state === 'minus-infinity' ? 'not-a-number' : 'plus-infinity';
    } else if (value === -Infinity) {
      state = state === 'plus-infinity' ? 'not-a-number' : 'minus-infinity';
    } else if (!Object.is(value, -0) && (state === 'minus-zero' || state === 'finite')) {
      state = 'finite';
      total += units(value);
    }
  }
  return { 'not-a-number': NaN, 'plus-infinity': Infinity, 'minus-infinity': -Infinity, 'minus-zero': -0 }[state] ?? toDouble(total);
}

const MAX = Number.MAX_VALUE;
const HALF_ULP_OF_MAX = 2 ** 970;

test('Math.sumPrecise: the special cases of the standard', () => {
  const cases = [
    [[], -0],
    [[-0], -0],
    [[-0, -0, -0], -0],
    [[0], 0],
    [[-0, 0], 0],
    [[0, -0], 0],
    [[1, -1], 0],
    [[-1, 1], 0],
    [[Infinity], Infinity],
    [[-Infinity, 5], -Infinity],
    [[Infinity, -Infinity], NaN],
    [[NaN], NaN],
    [[1, NaN, Infinity], NaN],
    [[MAX, Infinity], Infinity],
    [[MAX, MAX], Infinity],
    [[-MAX, -MAX], -Infinity],
  ];
  for (const [values, expected] of cases) {
    assert.ok(Object.is(R.Math.sumPrecise(values), expected), JSON.stringify(values.map(String)) + ' -> ' + expected);
  }
});

test('Math.sumPrecise: exact sums, one rounding, and intermediate sums past the largest double', () => {
  const cases = [
    [[1e20, 0.1, -1e20], 0.1],
    [[1, 1e100, 1, -1e100], 2],
    [[2 ** 53, 1], 2 ** 53],
    [[2 ** 53, 1, 1], 2 ** 53 + 2],
    [[1, 2 ** 53, 1], 2 ** 53 + 2],
    [[2 ** 53, 1, 2 ** -60], 2 ** 53 + 2],
    [[0.1, 0.2, 0.3], 0.6],
    [[1e308, 1e308, 0.1, 0.1, 1e30, 0.1, -1e30, -1e308, -1e308], 0.30000000000000004],
    [[1e308, 1e308, -1e308], 1e308],
    [[MAX, MAX, -MAX], MAX],
    [[-MAX, -MAX, MAX], -MAX],
    [[MAX, -MAX, MAX, -MAX, MAX], MAX],
    // Exactly half a unit above the largest double rounds to 2^1024, which is Infinity; just below it, to MAX.
    [[MAX, HALF_ULP_OF_MAX], Infinity],
    [[MAX, HALF_ULP_OF_MAX, -(2 ** -1074)], MAX],
    [[-MAX, -HALF_ULP_OF_MAX], -Infinity],
    [[-MAX, -HALF_ULP_OF_MAX, 2 ** -1074], -MAX],
    [[MAX, MAX, -MAX, HALF_ULP_OF_MAX, -(2 ** -1074)], MAX],
    [[2 ** -1074, 2 ** -1074, -(2 ** -1073)], 0],
    [[2 ** -1074, 2 ** -1022], 2 ** -1022 + 2 ** -1074],
  ];
  for (const [values, expected] of cases) {
    const got = R.Math.sumPrecise(values);
    assert.ok(Object.is(got, expected), `${values} -> ${expected}, got ${got}`);
    assert.ok(Object.is(exactSum(values), expected), 'the reference agrees: ' + values);
  }
});

function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A double with a random sign and significand and a biased exponent between low and high (0 = subnormal, 2046 = top).
function randomDouble(next, low, high) {
  const view = new DataView(new ArrayBuffer(8));
  const exponent = low + Math.floor(next() * (high - low + 1));
  const sign = next() < 0.5 ? 0x80000000 : 0;
  view.setUint32(0, (sign | (exponent << 20) | Math.floor(next() * 2 ** 20)) >>> 0);
  view.setUint32(4, Math.floor(next() * 2 ** 32) >>> 0);
  return view.getFloat64(0);
}

test('Math.sumPrecise equals the exact sum, rounded once, on 4,000 random lists', () => {
  const next = prng(20261028);
  const shapes = [
    () => [0, 2046],
    () => [2000, 2046],
    () => [0, 80],
    () => {
      const centre = 60 + Math.floor(next() * 1900);
      return [centre - 60, centre + 60];
    },
  ];
  let checked = 0;
  for (let round = 0; round < 1000; round++) {
    for (const shape of shapes) {
      const [low, high] = shape();
      const values = [];
      const count = 1 + Math.floor(next() * 12);
      for (let i = 0; i < count; i++) {
        values.push(randomDouble(next, low, high));
      }
      if (next() < 0.4) {
        // Cancel some values exactly, in another order, so the result comes from the small remainder.
        for (const value of values.slice(0, Math.ceil(count / 2))) {
          values.splice(Math.floor(next() * values.length), 0, -value);
        }
      }
      const expected = exactSum(values);
      const got = R.Math.sumPrecise(values);
      assert.ok(Object.is(got, expected), `sumPrecise(${values.map(v => v.toExponential(17)).join(', ')}) = ${got}, expected ${expected}`);
      checked++;
    }
  }
  assert.equal(checked, 4000);
});

test('Math.sumPrecise reads any iterable, refuses values that are not Numbers and closes the iterator', () => {
  assert.equal(R.Math.sumPrecise(new Set([1, 2, 3])), 6);
  assert.equal(R.Math.sumPrecise((function* () { yield 0.5; yield 0.25; })()), 0.75);
  for (const notIterable of [undefined, null, 5, {}]) {
    assert.throws(() => R.Math.sumPrecise(notIterable), { name: 'TypeError' });
  }
  for (const bad of [['1'], [1n], [new Number(1)], [null], [NaN, 'x'], '12']) {
    assert.throws(() => R.Math.sumPrecise(bad), { name: 'TypeError' }, String(bad));
  }
  let closed = 0;
  let index = 0;
  const iterable = {
    [Symbol.iterator]() {
      return {
        next: () => ({ done: false, value: index++ === 0 ? 1 : '2' }),
        return() {
          closed++;
          return {};
        },
      };
    },
  };
  assert.throws(() => R.Math.sumPrecise(iterable), { name: 'TypeError' });
  assert.equal(closed, 1);
});

test('Math.sumPrecise agrees with Node\'s built-in where Node has one', { skip: !isNative(Math.sumPrecise) && 'Node has no Math.sumPrecise' }, () => {
  const next = prng(7);
  for (let i = 0; i < 2000; i++) {
    const values = Array.from({ length: 1 + (i % 9) }, () => randomDouble(next, i % 2 ? 0 : 1900, 2046));
    assert.ok(Object.is(R.Math.sumPrecise(values), Math.sumPrecise(values)));
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Uint8Array to and from base64 and hex

test('Uint8Array.prototype.toBase64 and toHex encode like RFC 4648, with the alphabet and padding options', () => {
  const next = prng(4648);
  for (let length = 0; length < 70; length++) {
    const bytes = Buffer.from(Array.from({ length }, () => Math.floor(next() * 256)));
    const view = new R.Uint8Array(bytes);
    assert.equal(view.toBase64(), bytes.toString('base64'));
    assert.equal(view.toBase64({ alphabet: 'base64url', omitPadding: true }), bytes.toString('base64url'));
    assert.equal(view.toBase64({ omitPadding: 1 }), bytes.toString('base64').replace(/=+$/, ''));
    assert.equal(view.toBase64({ alphabet: 'base64url' }), bytes.toString('base64').replaceAll('+', '-').replaceAll('/', '_'));
    assert.equal(view.toHex(), bytes.toString('hex'));
  }
  assert.equal(new R.Uint8Array([0, 15, 16, 255]).toHex(), '000f10ff');
  const whole = new R.Uint8Array([1, 2, 3, 4, 5, 251, 255]);
  assert.equal(whole.subarray(2, 6).toBase64(), 'AwQF+w==', 'a view encodes only its own bytes');
  assert.equal(whole.subarray(5).toBase64({ alphabet: 'base64url' }), '-_8=');
});

test('toBase64 reads its options in order and checks the alphabet strictly', () => {
  const read = [];
  const options = new Proxy({}, { get: (target, key) => (read.push(key), undefined) });
  new R.Uint8Array([1]).toBase64(options);
  assert.deepEqual(read, ['alphabet', 'omitPadding']);
  for (const bad of ['Base64', 'base64 ', new String('base64'), null, 0]) {
    assert.throws(() => new R.Uint8Array([1]).toBase64({ alphabet: bad }), { name: 'TypeError' });
  }
  for (const bad of [null, 1, 'base64', true]) {
    assert.throws(() => new R.Uint8Array([1]).toBase64(bad), { name: 'TypeError' });
  }
  assert.equal(new R.Uint8Array([1]).toBase64(() => {}), 'AQ==', 'a function is an object');
});

test('the encoders take only Uint8Arrays, and refuse a detached buffer even one detached by an option getter', () => {
  for (const receiver of [new R.Uint8ClampedArray(1), new R.Int8Array(1), new R.Uint16Array(1), [1], {}, new R.DataView(new R.ArrayBuffer(1))]) {
    for (const name of ['toBase64', 'toHex', 'setFromBase64', 'setFromHex']) {
      assert.throws(() => R.Uint8Array.prototype[name].call(receiver, 'AA'), { name: 'TypeError' }, name);
    }
  }
  class Sub extends R.Uint8Array {}
  assert.equal(new Sub([255]).toHex(), 'ff');
  const detached = new R.Uint8Array(4);
  detached.buffer.transfer();
  assert.throws(() => detached.toBase64(), { name: 'TypeError' });
  assert.throws(() => detached.toHex(), { name: 'TypeError' });
  assert.throws(() => detached.setFromHex('aa'), { name: 'TypeError' });
  const view = new R.Uint8Array(4);
  const sneaky = { get omitPadding() { view.buffer.transfer(); return false; } };
  assert.throws(() => view.toBase64(sneaky), { name: 'TypeError' });
  const target = new R.Uint8Array(4);
  const detachInOptions = { get lastChunkHandling() { target.buffer.transfer(); return undefined; } };
  assert.throws(() => target.setFromBase64('AAAA', detachInOptions), { name: 'TypeError' });
});

test('Uint8Array.fromBase64 decodes with ASCII whitespace anywhere and checks padding', () => {
  const cases = [
    ['', []],
    ['Zg==', ascii('f')],
    ['Zm8=', ascii('fo')],
    ['Zm9v', ascii('foo')],
    ['Zm9vYg==', ascii('foob')],
    ['Zm9vYmE=', ascii('fooba')],
    ['Zm9vYmFy', ascii('foobar')],
    ['Zm9vYg', ascii('foob')],
    ['Zm9vYmE', ascii('fooba')],
    [' Z\tm\n9\fv\r ', ascii('foo')],
    ['Zg = =', ascii('f')],
    ['Zg==\n', ascii('f')],
    ['Zh==', ascii('f')],
    ['Zm9=', ascii('fo')],
    ['+/+/', [0xfb, 0xff, 0xbf]],
  ];
  for (const [text, expected] of cases) {
    assert.deepEqual(bytesOf(R.Uint8Array.fromBase64(text)), expected, JSON.stringify(text));
  }
  const result = R.Uint8Array.fromBase64('Zm9v');
  assert.equal(Object.getPrototypeOf(result), R.Uint8Array.prototype);
  class Sub extends R.Uint8Array {}
  assert.equal(Object.getPrototypeOf(Sub.fromBase64('Zm9v')), R.Uint8Array.prototype, 'always a plain Uint8Array');
});

test('Uint8Array.fromBase64 refuses malformed text with a SyntaxError', () => {
  const bad = ['Z', 'Zg=', '=', 'Z=', 'Z===', 'Zg===', 'Zg==Zg==', 'Zg==a', 'Zm9v=', 'Zm9vZ===', 'Zm-v', 'Zm_v', 'Zm9v!', 'Zm9v ', 'Zm9Ā', 'Zm9v '];
  for (const text of bad) {
    assert.throws(() => R.Uint8Array.fromBase64(text), { name: 'SyntaxError' }, JSON.stringify(text));
  }
  for (const notString of [undefined, 1, new String('Zm9v'), ['Zm9v'], { toString: () => 'Zm9v' }]) {
    assert.throws(() => R.Uint8Array.fromBase64(notString), { name: 'TypeError' });
  }
});

test('fromBase64 alphabets: base64url takes - and _ and refuses + and /', () => {
  assert.deepEqual(bytesOf(R.Uint8Array.fromBase64('-_-_', { alphabet: 'base64url' })), [0xfb, 0xff, 0xbf]);
  assert.deepEqual(bytesOf(R.Uint8Array.fromBase64('-_8=', { alphabet: 'base64url' })), [0xfb, 0xff]);
  assert.throws(() => R.Uint8Array.fromBase64('+/+/', { alphabet: 'base64url' }), { name: 'SyntaxError' });
  assert.throws(() => R.Uint8Array.fromBase64('-_-_'), { name: 'SyntaxError' });
  assert.throws(() => R.Uint8Array.fromBase64('AA==', { alphabet: 'url' }), { name: 'TypeError' });
  const read = [];
  R.Uint8Array.fromBase64('AA==', new Proxy({}, { get: (target, key) => (read.push(key), undefined) }));
  assert.deepEqual(read, ['alphabet', 'lastChunkHandling']);
});

test('fromBase64 lastChunkHandling: loose, strict and stop-before-partial', () => {
  const decode = (text, lastChunkHandling) => {
    try {
      return bytesOf(R.Uint8Array.fromBase64(text, { lastChunkHandling }));
    } catch (error) {
      return error.name;
    }
  };
  const table = [
    // text          loose            strict          stop-before-partial
    ['Zg==', ascii('f'), ascii('f'), ascii('f')],
    ['Zg', ascii('f'), 'SyntaxError', []],
    ['Zm8', ascii('fo'), 'SyntaxError', []],
    ['Zm9vYg', ascii('foob'), 'SyntaxError', ascii('foo')],
    ['Zg=', 'SyntaxError', 'SyntaxError', []],
    ['Z', 'SyntaxError', 'SyntaxError', []],
    ['Zh==', ascii('f'), 'SyntaxError', ascii('f')],
    ['Zm9=', ascii('fo'), 'SyntaxError', ascii('fo')],
    ['Zm9v=', 'SyntaxError', 'SyntaxError', 'SyntaxError'],
    ['Zg==Zg==', 'SyntaxError', 'SyntaxError', 'SyntaxError'],
  ];
  for (const [text, loose, strict, stop] of table) {
    assert.deepEqual(decode(text, undefined), loose, text + ' default');
    assert.deepEqual(decode(text, 'loose'), loose, text + ' loose');
    assert.deepEqual(decode(text, 'strict'), strict, text + ' strict');
    assert.deepEqual(decode(text, 'stop-before-partial'), stop, text + ' stop-before-partial');
  }
  assert.throws(() => R.Uint8Array.fromBase64('AA==', { lastChunkHandling: 'Loose' }), { name: 'TypeError' });
});

test('fromBase64 and toBase64 round-trip random bytes against Node\'s Buffer', () => {
  const next = prng(140);
  for (let length = 0; length < 200; length++) {
    const bytes = Buffer.from(Array.from({ length }, () => Math.floor(next() * 256)));
    assert.deepEqual(bytesOf(R.Uint8Array.fromBase64(bytes.toString('base64'))), [...bytes]);
    assert.deepEqual(bytesOf(R.Uint8Array.fromBase64(bytes.toString('base64url'), { alphabet: 'base64url' })), [...bytes]);
    assert.deepEqual(bytesOf(R.Uint8Array.fromBase64(bytes.toString('base64'), { lastChunkHandling: 'strict' })), [...bytes]);
    assert.deepEqual(bytesOf(R.Uint8Array.fromHex(bytes.toString('hex').toUpperCase())), [...bytes]);
  }
});

test('setFromBase64 writes what fits and reports characters read and bytes written (test262 target-size cases)', () => {
  const run = (size, text, options) => {
    const target = new R.Uint8Array(size).fill(255);
    const result = target.setFromBase64(text, options);
    assert.equal(Object.getPrototypeOf(result), R.Object.prototype);
    assert.deepEqual(Object.keys(result), ['read', 'written']);
    return [result.read, result.written, bytesOf(target)];
  };
  assert.deepEqual(run(5, 'Zm9vYmFy'), [4, 3, [102, 111, 111, 255, 255]]);
  assert.deepEqual(run(4, 'Zm9vYmE='), [4, 3, [102, 111, 111, 255]]);
  assert.deepEqual(run(6, 'Zm9vYmFy'), [8, 6, [102, 111, 111, 98, 97, 114]]);
  assert.deepEqual(run(5, 'Zm9vYmE='), [8, 5, [102, 111, 111, 98, 97]]);
  assert.deepEqual(run(5, 'Zm9vYmE'), [7, 5, [102, 111, 111, 98, 97]]);
  assert.deepEqual(run(5, 'Zm9vYmE=', { lastChunkHandling: 'stop-before-partial' }), [8, 5, [102, 111, 111, 98, 97]]);
  assert.deepEqual(run(5, 'Zm9vYmE', { lastChunkHandling: 'stop-before-partial' }), [4, 3, [102, 111, 111, 255, 255]]);
  assert.deepEqual(run(7, 'Zm9vYmFy'), [8, 6, [102, 111, 111, 98, 97, 114, 255]]);
  assert.deepEqual(run(2, 'Zm9v'), [0, 0, [255, 255]]);
  assert.deepEqual(run(0, 'Zm9v'), [0, 0, []]);
  assert.deepEqual(run(0, '!!'), [0, 0, []], 'an empty target reads nothing, so finds no error');
  assert.deepEqual(run(3, ' Zm9v '), [5, 3, [102, 111, 111]], 'stops reading once the target is full');
  const subarray = new R.Uint8Array(6).fill(0);
  subarray.subarray(2, 4).setFromBase64('Zm9v');
  assert.deepEqual(bytesOf(subarray), [0, 0, 0, 0, 0, 0], 'two bytes cannot hold a whole chunk');
  subarray.subarray(2, 5).setFromBase64('Zm9v');
  assert.deepEqual(bytesOf(subarray), [0, 0, 102, 111, 111, 0]);
});

test('setFromBase64 and setFromHex write the bytes decoded before an error, then throw it', () => {
  const target = new R.Uint8Array(8).fill(255);
  assert.throws(() => target.setFromBase64('Zm9vYmFy!'), { name: 'SyntaxError' });
  assert.deepEqual(bytesOf(target), [102, 111, 111, 98, 97, 114, 255, 255]);
  const strict = new R.Uint8Array(8).fill(255);
  assert.throws(() => strict.setFromBase64('Zm9vYg', { lastChunkHandling: 'strict' }), { name: 'SyntaxError' });
  assert.deepEqual(bytesOf(strict), [102, 111, 111, 255, 255, 255, 255, 255]);
  const hex = new R.Uint8Array(4).fill(255);
  assert.throws(() => hex.setFromHex('aabbxx'), { name: 'SyntaxError' });
  assert.deepEqual(bytesOf(hex), [0xaa, 0xbb, 255, 255]);
  const odd = new R.Uint8Array(4).fill(255);
  assert.throws(() => odd.setFromHex('aab'), { name: 'SyntaxError' });
  assert.deepEqual(bytesOf(odd), [255, 255, 255, 255], 'an odd length is refused before anything is written');
});

test('Uint8Array.fromHex and setFromHex: pairs of hex digits in either case, nothing else', () => {
  assert.deepEqual(bytesOf(R.Uint8Array.fromHex('')), []);
  assert.deepEqual(bytesOf(R.Uint8Array.fromHex('00ffAa10')), [0, 255, 0xaa, 0x10]);
  for (const text of ['a', 'abc', 'gg', ' aa', 'aa ', '0x', '٠١']) {
    assert.throws(() => R.Uint8Array.fromHex(text), { name: 'SyntaxError' }, JSON.stringify(text));
  }
  for (const notString of [undefined, 12, new String('aa')]) {
    assert.throws(() => R.Uint8Array.fromHex(notString), { name: 'TypeError' });
    assert.throws(() => new R.Uint8Array(1).setFromHex(notString), { name: 'TypeError' });
  }
  const target = new R.Uint8Array(2).fill(255);
  assert.deepEqual({ ...target.setFromHex('aabbcc') }, { read: 4, written: 2 });
  assert.deepEqual(bytesOf(target), [0xaa, 0xbb]);
  const larger = new R.Uint8Array(4).fill(255);
  assert.deepEqual({ ...larger.setFromHex('0102') }, { read: 4, written: 2 });
  assert.deepEqual(bytesOf(larger), [1, 2, 255, 255]);
});

test('the base64 and hex methods agree with Node\'s built-ins where Node has them', { skip: !isNative(Uint8Array.fromBase64) && 'Node has no Uint8Array.fromBase64' }, () => {
  const texts = ['', 'Zg==', 'Zg', 'Zg=', 'Z', 'Zh==', 'Zm9v=', ' Zm 9v ', '-_-_', '+/+/', 'Zm9vYmE', 'Zm9=', 'Zg==Zg=='];
  const outcome = fn => {
    try {
      const value = fn();
      return value instanceof Uint8Array || ArrayBuffer.isView(value) ? Array.from(value) : value;
    } catch (error) {
      return error.name;
    }
  };
  for (const text of texts) {
    for (const lastChunkHandling of ['loose', 'strict', 'stop-before-partial']) {
      for (const alphabet of ['base64', 'base64url']) {
        const options = { alphabet, lastChunkHandling };
        assert.deepEqual(outcome(() => R.Uint8Array.fromBase64(text, options)), outcome(() => Uint8Array.fromBase64(text, options)), text);
        for (const size of [0, 1, 2, 4]) {
          const ours = new R.Uint8Array(size);
          const theirs = new Uint8Array(size);
          assert.deepEqual(outcome(() => ({ ...ours.setFromBase64(text, options) })), outcome(() => ({ ...theirs.setFromBase64(text, options) })), text);
          assert.deepEqual(bytesOf(ours), bytesOf(theirs));
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Blob.prototype.bytes and Response.prototype.bytes

test('Blob and Response bytes() resolve to a Uint8Array of the same bytes as arrayBuffer()', async () => {
  const data = [0, 1, 2, 250, 255];
  const blob = new R.Blob([new Uint8Array(data), 'é']);
  const fromBlob = await blob.bytes();
  assert.equal(Object.getPrototypeOf(fromBlob), R.Uint8Array.prototype);
  assert.deepEqual(bytesOf(fromBlob), [...data, 0xc3, 0xa9]);
  assert.deepEqual(bytesOf(await new R.Blob([]).bytes()), []);
  const response = new R.Response(new Uint8Array(data));
  assert.deepEqual(bytesOf(await response.bytes()), data);
  assert.deepEqual(bytesOf(await new R.Response(null).bytes()), []);
  if (typeof Blob.prototype.bytes === 'function') {
    assert.deepEqual(bytesOf(await new R.Blob(['same']).bytes()), bytesOf(await new Blob(['same']).bytes()));
  }
});

test('bytes() rejects, and does not throw, for a used body or a wrong receiver', async () => {
  const response = new R.Response('once');
  await response.text();
  await assert.rejects(response.bytes(), { name: 'TypeError' });
  for (const receiver of [{}, null, new R.Response('x'), 1]) {
    let promise;
    assert.doesNotThrow(() => {
      promise = R.Blob.prototype.bytes.call(receiver);
    });
    await assert.rejects(promise, { name: 'TypeError' });
  }
  const notResponse = R.Response.prototype.bytes.call(new R.Blob(['x']));
  await assert.rejects(notResponse, { name: 'TypeError' });
});
