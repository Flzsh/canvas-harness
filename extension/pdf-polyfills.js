/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Standard built-ins that PDF.js (vendor/pdfjs, the unmodified modern build) calls directly but that Chrome and Edge
// only gained after version 126, the extension's minimum_chrome_version:
//
//   Math.sumPrecise                                     Chrome 147   ECMAScript 2026
//   Map.prototype / WeakMap.prototype .getOrInsert,
//     .getOrInsertComputed                              Chrome 145   ECMAScript 2026
//   Blob.prototype.bytes                                Chrome 144   File API
//   Uint8Array.prototype .toBase64, .toHex,
//     .setFromBase64, .setFromHex;
//     Uint8Array.fromBase64, Uint8Array.fromHex         Chrome 140   ECMAScript 2026
//   Response.prototype.bytes                            Chrome 132   Fetch
//   Promise.try                                         Chrome 128   ECMAScript 2025
//
// Each one is added only when the browser does not already have it, follows the steps of its standard (the step
// comments name them), and is defined the way the browser defines its own: writable and configurable, not enumerable
// for ECMAScript built-ins and enumerable for the Blob and Response methods, as Web IDL does. Methods are written as
// method definitions, so like built-in methods they cannot be called with `new` and have no `prototype`.
//
// pdf-library.mjs (the page) and pdf-worker.mjs (the worker) import this file before PDF.js. It has no imports or
// exports, so it also runs as a classic script, and Node tests load it with require().
(function installPdfPolyfills(global) {
  'use strict';

  const NativeUint8Array = global.Uint8Array;
  const NativePromise = global.Promise;
  const promiseThen = NativePromise.prototype.then;
  const reflectApply = Reflect.apply;

  // Adds each method that `target` does not already have.
  function install(target, methods, enumerable = false) {
    for (const name of Object.keys(methods)) {
      if (typeof target[name] === 'function') {
        continue;
      }
      Object.defineProperty(target, name, { value: methods[name], writable: true, enumerable, configurable: true });
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Promise.try (ECMAScript 2025, 27.2.4.8)

  // NewPromiseCapability(C)
  function newPromiseCapability(C) {
    let resolve;
    let reject;
    const promise = new C((resolveFunction, rejectFunction) => {
      if (resolve !== undefined || reject !== undefined) {
        throw new TypeError('The promise executor was already called.');
      }
      resolve = resolveFunction;
      reject = rejectFunction;
    });
    if (typeof resolve !== 'function' || typeof reject !== 'function') {
      throw new TypeError('The promise constructor did not supply resolve and reject functions.');
    }
    return { promise, resolve, reject };
  }

  install(NativePromise, {
    try(callback, ...args) {
      // 1-2. The this value must be an object; 3. NewPromiseCapability throws unless it is a constructor.
      const C = this;
      if ((typeof C !== 'object' || C === null) && typeof C !== 'function') {
        throw new TypeError('Promise.try must be called on a constructor.');
      }
      const capability = newPromiseCapability(C);
      // 4. Call the callback synchronously with an undefined this value. A throw (also the TypeError for a callback
      // that is not callable) rejects the promise; 5-6. an error from the capability's own functions propagates.
      let value;
      try {
        value = reflectApply(callback, undefined, args);
      } catch (error) {
        reflectApply(capability.reject, undefined, [error]);
        return capability.promise;
      }
      reflectApply(capability.resolve, undefined, [value]);
      return capability.promise;
    },
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Map.prototype.getOrInsert, Map.prototype.getOrInsertComputed, and the WeakMap versions (ECMAScript 2026).
  // The original has/get/set are kept so that the steps work on the map's own entries, as the standard does, even if
  // a subclass or a later script replaces those methods. has() throws a TypeError for a receiver that is not a Map
  // (or WeakMap), which is the standard's RequireInternalSlot step.

  const mapHas = Map.prototype.has;
  const mapGet = Map.prototype.get;
  const mapSet = Map.prototype.set;

  install(Map.prototype, {
    getOrInsert(key, value) {
      if (reflectApply(mapHas, this, [key])) {
        return reflectApply(mapGet, this, [key]);
      }
      // set() stores -0 as +0 (CanonicalizeKeyedCollectionKey). The value argument itself is returned.
      reflectApply(mapSet, this, [key, value]);
      return value;
    },
    getOrInsertComputed(key, callbackfn) {
      const present = reflectApply(mapHas, this, [key]);
      if (typeof callbackfn !== 'function') {
        throw new TypeError('Map.prototype.getOrInsertComputed needs a callback function.');
      }
      if (present) {
        return reflectApply(mapGet, this, [key]);
      }
      // CanonicalizeKeyedCollectionKey: the callback receives +0 for -0.
      const canonicalKey = Object.is(key, -0) ? 0 : key;
      const value = reflectApply(callbackfn, undefined, [canonicalKey]);
      // If the callback added the key, its entry keeps its place and takes the new value; otherwise it is appended.
      reflectApply(mapSet, this, [canonicalKey, value]);
      return value;
    },
  });

  const weakMapHas = WeakMap.prototype.has;
  const weakMapGet = WeakMap.prototype.get;
  const weakMapSet = WeakMap.prototype.set;

  // CanBeHeldWeakly: objects, and symbols that are not in the global symbol registry.
  function canBeHeldWeakly(value) {
    if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
      return true;
    }
    return typeof value === 'symbol' && Symbol.keyFor(value) === undefined;
  }

  install(WeakMap.prototype, {
    getOrInsert(key, value) {
      const present = reflectApply(weakMapHas, this, [key]);
      if (!canBeHeldWeakly(key)) {
        throw new TypeError('Invalid value used as a WeakMap key.');
      }
      if (present) {
        return reflectApply(weakMapGet, this, [key]);
      }
      reflectApply(weakMapSet, this, [key, value]);
      return value;
    },
    getOrInsertComputed(key, callbackfn) {
      const present = reflectApply(weakMapHas, this, [key]);
      if (!canBeHeldWeakly(key)) {
        throw new TypeError('Invalid value used as a WeakMap key.');
      }
      if (typeof callbackfn !== 'function') {
        throw new TypeError('WeakMap.prototype.getOrInsertComputed needs a callback function.');
      }
      if (present) {
        return reflectApply(weakMapGet, this, [key]);
      }
      const value = reflectApply(callbackfn, undefined, [key]);
      reflectApply(weakMapSet, this, [key, value]);
      return value;
    },
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Math.sumPrecise (ECMAScript 2026, 21.3.2.34): the sum of the values as if computed exactly, then rounded once to
  // the nearest double (ties to even).
  //
  // The exact sum is kept as a list of "partials": doubles that do not overlap and whose exact total is the sum so
  // far (Shewchuk, "Adaptive Precision Floating-Point Arithmetic", 1997; the same method as Python's math.fsum).
  // Partial sums past the largest double are kept exact too: `overflow` counts multiples of 2^1024 that were moved
  // out of the partials, the way the reference polyfill of the TC39 proposal (proposal-math-sum) does it.

  const TWO_POW_1023 = 2 ** 1023;
  const MAX_DOUBLE = Number.MAX_VALUE; // 2^1024 - 2^971
  const MAX_ULP = 2 ** 971; // the gap between MAX_DOUBLE and the double below it
  const MAX_COUNT = 2 ** 53;

  // Adds one finite, nonzero double to the partials; returns the new overflow count.
  function addToPartials(partials, value, overflow) {
    let x = value;
    let used = 0;
    for (let i = 0; i < partials.length; i++) {
      let y = partials[i];
      if (Math.abs(x) < Math.abs(y)) {
        [x, y] = [y, x];
      }
      let high = x + y;
      if (Math.abs(high) === Infinity) {
        // Move 2^1024 (as two halves, which are exact) out of x and count it instead.
        const sign = high > 0 ? 1 : -1;
        overflow += sign;
        x = x - sign * TWO_POW_1023 - sign * TWO_POW_1023;
        if (Math.abs(x) < Math.abs(y)) {
          [x, y] = [y, x];
        }
        high = x + y;
      }
      // With |x| >= |y|, high + low is exactly x + y.
      const low = y - (high - x);
      if (low !== 0) {
        partials[used++] = low;
      }
      x = high;
    }
    partials.length = used;
    if (x !== 0) {
      partials.push(x);
    }
    return overflow;
  }

  // Rounds the exact total of overflow * 2^1024 plus the partials to the nearest double.
  function roundPartials(partials, overflow) {
    let n = partials.length - 1;
    let high = 0;
    let low = 0;
    if (overflow !== 0) {
      const next = n >= 0 ? partials[n] : 0;
      n--;
      if (Math.abs(overflow) > 1 || (overflow > 0 && next > 0) || (overflow < 0 && next < 0)) {
        return overflow > 0 ? Infinity : -Infinity;
      }
      // overflow is +1 or -1 and the largest partial has the other sign: add them at half scale so nothing overflows.
      high = overflow * TWO_POW_1023 + next / 2;
      low = next / 2 - (high - overflow * TWO_POW_1023);
      low *= 2;
      if (Math.abs(2 * high) === Infinity) {
        // Rounds to the largest double only when exactly half a unit below 2^1024 and the rest pulls it down.
        if (high > 0) {
          return high === TWO_POW_1023 && low === -MAX_ULP / 2 && n >= 0 && partials[n] < 0 ? MAX_DOUBLE : Infinity;
        }
        return high === -TWO_POW_1023 && low === MAX_ULP / 2 && n >= 0 && partials[n] > 0 ? -MAX_DOUBLE : -Infinity;
      }
      if (low !== 0) {
        partials[n + 1] = low;
        n++;
        low = 0;
      }
      high *= 2;
    }
    // Add from the largest partial down until a rounding error appears.
    while (n >= 0) {
      const x = high;
      const y = partials[n];
      n--;
      high = x + y;
      low = y - (high - x);
      if (low !== 0) {
        break;
      }
    }
    // When that error is exactly half a unit, the next partial decides which way the tie goes.
    if (n >= 0 && ((low < 0 && partials[n] < 0) || (low > 0 && partials[n] > 0))) {
      const twice = low * 2;
      const rounded = high + twice;
      if (twice === rounded - high) {
        high = rounded;
      }
    }
    return high;
  }

  install(Math, {
    sumPrecise(items) {
      // 1. RequireObjectCoercible(items); 2. GetIterator(items) (for...of closes the iterator when a step throws).
      if (items === undefined || items === null) {
        throw new TypeError('Math.sumPrecise needs an iterable of numbers.');
      }
      // 3-6. state is one of: minus-zero, finite, plus-infinity, minus-infinity, not-a-number.
      let state = 'minus-zero';
      let count = 0;
      const partials = [];
      let overflow = 0;
      for (const value of items) {
        count++;
        if (count >= MAX_COUNT) {
          throw new RangeError('Math.sumPrecise received too many values.');
        }
        if (typeof value !== 'number') {
          throw new TypeError('Math.sumPrecise only adds numbers.');
        }
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
          if (value !== 0) {
            overflow = addToPartials(partials, value, overflow);
          }
        }
      }
      // 8-12.
      if (state === 'not-a-number') {
        return NaN;
      }
      if (state === 'plus-infinity') {
        return Infinity;
      }
      if (state === 'minus-infinity') {
        return -Infinity;
      }
      if (state === 'minus-zero') {
        return -0;
      }
      return roundPartials(partials, overflow);
    },
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Uint8Array to and from base64 and hex (ECMAScript 2026, 23.3: Uint8Array.fromBase64, fromHex and the
  // prototype methods, with the abstract operations FromBase64 and FromHex).

  const TypedArrayPrototype = Object.getPrototypeOf(NativeUint8Array.prototype);
  const typedArrayGetter = name => Object.getOwnPropertyDescriptor(TypedArrayPrototype, name).get;
  // The [[TypedArrayName]] of a typed array (undefined for anything else); it cannot be faked by a subclass.
  const typedArrayName = typedArrayGetter(Symbol.toStringTag);
  const typedArrayLength = typedArrayGetter('length');
  // %TypedArray%.prototype.keys starts with ValidateTypedArray, which throws a TypeError for a detached or
  // out-of-bounds view; it reads nothing.
  const validateTypedArray = TypedArrayPrototype.keys;

  // ValidateUint8Array: a Uint8Array (or a subclass); other typed arrays, Uint8ClampedArray included, are refused.
  function validateUint8Array(value) {
    if (reflectApply(typedArrayName, value, []) !== 'Uint8Array') {
      throw new TypeError('The receiver must be a Uint8Array.');
    }
  }

  // IsTypedArrayOutOfBounds and TypedArrayLength, as GetUint8ArrayBytes and setFromBase64/setFromHex use them.
  function uint8ArrayLength(array) {
    reflectApply(validateTypedArray, array, []);
    return reflectApply(typedArrayLength, array, []);
  }

  // GetOptionsObject
  function getOptionsObject(options) {
    if (options === undefined) {
      return Object.create(null);
    }
    if ((typeof options === 'object' && options !== null) || typeof options === 'function') {
      return options;
    }
    throw new TypeError('The options argument must be an object.');
  }

  function readAlphabet(options) {
    let alphabet = options.alphabet;
    if (alphabet === undefined) {
      alphabet = 'base64';
    }
    if (alphabet !== 'base64' && alphabet !== 'base64url') {
      throw new TypeError('alphabet must be "base64" or "base64url".');
    }
    return alphabet;
  }

  function readLastChunkHandling(options) {
    let handling = options.lastChunkHandling;
    if (handling === undefined) {
      handling = 'loose';
    }
    if (handling !== 'loose' && handling !== 'strict' && handling !== 'stop-before-partial') {
      throw new TypeError('lastChunkHandling must be "loose", "strict" or "stop-before-partial".');
    }
    return handling;
  }

  const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  // Six-bit value of each character of the standard alphabet, by character code; -1 for every other character.
  const BASE64_VALUES = new Int8Array(128).fill(-1);
  for (let i = 0; i < 64; i++) {
    BASE64_VALUES[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  const HEX_PAIRS = [];
  for (let i = 0; i < 256; i++) {
    HEX_PAIRS.push(i.toString(16).padStart(2, '0'));
  }

  // The five ASCII whitespace characters: tab, line feed, form feed, carriage return and space.
  function skipAsciiWhitespace(text, index) {
    while (index < text.length) {
      const code = text.charCodeAt(index);
      if (code !== 0x09 && code !== 0x0a && code !== 0x0c && code !== 0x0d && code !== 0x20) {
        break;
      }
      index++;
    }
    return index;
  }

  // DecodeBase64Chunk: `chunk` holds 2, 3 or 4 six-bit values. A short chunk is decoded as if padded with "A"; with
  // throwOnExtraBits, the bits that padding would drop must be zero.
  function decodeBase64Chunk(chunk, throwOnExtraBits) {
    const bits = (chunk[0] << 18) | (chunk[1] << 12) | ((chunk[2] || 0) << 6) | (chunk[3] || 0);
    const bytes = [bits >> 16, (bits >> 8) & 0xff, bits & 0xff];
    if (chunk.length === 2) {
      if (throwOnExtraBits && bytes[1] !== 0) {
        throw new SyntaxError('The last base64 chunk has nonzero padding bits.');
      }
      return [bytes[0]];
    }
    if (chunk.length === 3) {
      if (throwOnExtraBits && bytes[2] !== 0) {
        throw new SyntaxError('The last base64 chunk has nonzero padding bits.');
      }
      return [bytes[0], bytes[1]];
    }
    return bytes;
  }

  // The standard's FromBase64(string, alphabet, lastChunkHandling, maxLength): returns { read, bytes, error }.
  // `read` counts the characters used for the bytes returned; `error` is a SyntaxError or null. As the standard says, it
  // stops as soon as the target is full or the next chunk would not fit, without looking at the rest of the string.
  function decodeBase64(text, alphabet, lastChunkHandling, maxLength = Number.MAX_SAFE_INTEGER) {
    if (maxLength === 0) {
      return { read: 0, bytes: [], error: null };
    }
    let read = 0;
    const bytes = [];
    let chunk = [];
    let index = 0;
    const length = text.length;
    const done = () => ({ read, bytes, error: null });
    const fail = message => ({ read, bytes, error: new SyntaxError(message) });
    for (;;) {
      index = skipAsciiWhitespace(text, index);
      if (index === length) {
        if (chunk.length > 0) {
          if (lastChunkHandling === 'stop-before-partial') {
            return done();
          }
          if (lastChunkHandling === 'strict') {
            return fail('The base64 string ends with an incomplete chunk.');
          }
          if (chunk.length === 1) {
            return fail('The base64 string ends with a single character.');
          }
          bytes.push(...decodeBase64Chunk(chunk, false));
        }
        return { read: length, bytes, error: null };
      }
      let code = text.charCodeAt(index);
      index++;
      if (code === 0x3d) {
        // "=": padding ends the string.
        if (chunk.length < 2) {
          return fail('Unexpected "=" in the base64 string.');
        }
        index = skipAsciiWhitespace(text, index);
        if (chunk.length === 2) {
          if (index === length) {
            if (lastChunkHandling === 'stop-before-partial') {
              return done();
            }
            return fail('The base64 padding is incomplete.');
          }
          if (text.charCodeAt(index) === 0x3d) {
            index = skipAsciiWhitespace(text, index + 1);
          }
        }
        if (index < length) {
          return fail('Unexpected characters after the base64 padding.');
        }
        let last;
        try {
          last = decodeBase64Chunk(chunk, lastChunkHandling === 'strict');
        } catch (error) {
          return { read, bytes, error };
        }
        bytes.push(...last);
        return { read: length, bytes, error: null };
      }
      if (alphabet === 'base64url') {
        if (code === 0x2b || code === 0x2f) {
          return fail('"+" and "/" are not in the base64url alphabet.');
        }
        if (code === 0x2d) {
          code = 0x2b;
        } else if (code === 0x5f) {
          code = 0x2f;
        }
      }
      const value = code < 128 ? BASE64_VALUES[code] : -1;
      if (value < 0) {
        return fail('Invalid character in the base64 string.');
      }
      // Stop before a chunk whose bytes would not fit.
      const remaining = maxLength - bytes.length;
      if ((remaining === 1 && chunk.length === 2) || (remaining === 2 && chunk.length === 3)) {
        return done();
      }
      chunk.push(value);
      if (chunk.length === 4) {
        bytes.push(...decodeBase64Chunk(chunk, false));
        chunk = [];
        read = index;
        if (bytes.length === maxLength) {
          return done();
        }
      }
    }
  }

  function hexValue(code) {
    if (code >= 0x30 && code <= 0x39) {
      return code - 0x30;
    }
    if (code >= 0x41 && code <= 0x46) {
      return code - 0x41 + 10;
    }
    if (code >= 0x61 && code <= 0x66) {
      return code - 0x61 + 10;
    }
    return -1;
  }

  // The standard's FromHex(string, maxLength): returns { read, bytes, error }.
  function decodeHex(text, maxLength = Number.MAX_SAFE_INTEGER) {
    const length = text.length;
    const bytes = [];
    let read = 0;
    if (length % 2 !== 0) {
      return { read, bytes, error: new SyntaxError('A hex string must have an even length.') };
    }
    while (read < length && bytes.length < maxLength) {
      const high = hexValue(text.charCodeAt(read));
      const low = hexValue(text.charCodeAt(read + 1));
      if (high < 0 || low < 0) {
        return { read, bytes, error: new SyntaxError('Invalid character in the hex string.') };
      }
      read += 2;
      bytes.push(high * 16 + low);
    }
    return { read, bytes, error: null };
  }

  function newUint8Array(bytes) {
    const array = new NativeUint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      array[i] = bytes[i];
    }
    return array;
  }

  install(NativeUint8Array, {
    fromBase64(string, options = undefined) {
      if (typeof string !== 'string') {
        throw new TypeError('Uint8Array.fromBase64 needs a string.');
      }
      const opts = getOptionsObject(options);
      const alphabet = readAlphabet(opts);
      const lastChunkHandling = readLastChunkHandling(opts);
      const result = decodeBase64(string, alphabet, lastChunkHandling);
      if (result.error) {
        throw result.error;
      }
      return newUint8Array(result.bytes);
    },
    fromHex(string) {
      if (typeof string !== 'string') {
        throw new TypeError('Uint8Array.fromHex needs a string.');
      }
      const result = decodeHex(string);
      if (result.error) {
        throw result.error;
      }
      return newUint8Array(result.bytes);
    },
  });

  // An optional argument is written `options = undefined` so that .length counts only the required arguments, as in
  // the standard: toBase64.length is 0; fromBase64.length and setFromBase64.length are 1.
  install(NativeUint8Array.prototype, {
    toBase64(options = undefined) {
      validateUint8Array(this);
      const opts = getOptionsObject(options);
      const alphabet = readAlphabet(opts);
      const omitPadding = Boolean(opts.omitPadding);
      // GetUint8ArrayBytes comes after the options, whose getters could have detached the buffer.
      const length = uint8ArrayLength(this);
      const table = alphabet === 'base64' ? BASE64_ALPHABET : BASE64URL_ALPHABET;
      const parts = [];
      let i = 0;
      for (; i + 2 < length; i += 3) {
        const bits = (this[i] << 16) | (this[i + 1] << 8) | this[i + 2];
        parts.push(table[bits >> 18] + table[(bits >> 12) & 63] + table[(bits >> 6) & 63] + table[bits & 63]);
      }
      if (length - i === 1) {
        const bits = this[i] << 16;
        parts.push(table[bits >> 18] + table[(bits >> 12) & 63] + (omitPadding ? '' : '=='));
      } else if (length - i === 2) {
        const bits = (this[i] << 16) | (this[i + 1] << 8);
        parts.push(table[bits >> 18] + table[(bits >> 12) & 63] + table[(bits >> 6) & 63] + (omitPadding ? '' : '='));
      }
      return parts.join('');
    },
    toHex() {
      validateUint8Array(this);
      const length = uint8ArrayLength(this);
      let out = '';
      for (let i = 0; i < length; i++) {
        out += HEX_PAIRS[this[i]];
      }
      return out;
    },
    setFromBase64(string, options = undefined) {
      validateUint8Array(this);
      if (typeof string !== 'string') {
        throw new TypeError('Uint8Array.prototype.setFromBase64 needs a string.');
      }
      const opts = getOptionsObject(options);
      const alphabet = readAlphabet(opts);
      const lastChunkHandling = readLastChunkHandling(opts);
      const byteLength = uint8ArrayLength(this);
      const result = decodeBase64(string, alphabet, lastChunkHandling, byteLength);
      // The bytes decoded before an error are written too.
      for (let i = 0; i < result.bytes.length; i++) {
        this[i] = result.bytes[i];
      }
      if (result.error) {
        throw result.error;
      }
      return { read: result.read, written: result.bytes.length };
    },
    setFromHex(string) {
      validateUint8Array(this);
      if (typeof string !== 'string') {
        throw new TypeError('Uint8Array.prototype.setFromHex needs a string.');
      }
      const byteLength = uint8ArrayLength(this);
      const result = decodeHex(string, byteLength);
      for (let i = 0; i < result.bytes.length; i++) {
        this[i] = result.bytes[i];
      }
      if (result.error) {
        throw result.error;
      }
      return { read: result.read, written: result.bytes.length };
    },
  });

  // ---------------------------------------------------------------------------------------------------------------
  // Blob.prototype.bytes (File API) and Response.prototype.bytes (Fetch): the same bytes as arrayBuffer(), as a
  // Uint8Array. Like every promise-returning Web IDL method, a wrong receiver gives a rejected promise, not a throw.

  function bytesMethod(arrayBuffer) {
    return {
      bytes() {
        try {
          return reflectApply(promiseThen, reflectApply(arrayBuffer, this, []), [buffer => new NativeUint8Array(buffer)]);
        } catch (error) {
          return new NativePromise((resolve, reject) => reject(error));
        }
      },
    };
  }

  for (const name of ['Blob', 'Response']) {
    const Interface = global[name];
    if (typeof Interface === 'function' && typeof Interface.prototype.arrayBuffer === 'function') {
      install(Interface.prototype, bytesMethod(Interface.prototype.arrayBuffer), true);
    }
  }
})(globalThis);
