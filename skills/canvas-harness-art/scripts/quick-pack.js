/* Canvas Harness quick upload pack: reference reader and writer (format version 1). GPL-3.0-only.
 *
 * A pack is plain text. It names itself, then lists parts; each part is a directive followed by its body:
 *
 *   <?ch-pack version="1" name="Marine Biology"?>
 *   <?ch-art course="Marine Biology" slot="banner"?>
 *   <svg ...>...</svg>
 *   <?ch-art course="Marine Biology" slot="icon"?>
 *   <svg ...>...</svg>
 *   <?ch-end parts="2"?>
 *
 * The same text is either pasted into Quick upload or saved as a .chpack file and dropped there.
 * This file has no dependencies and no side effects. It works as a CommonJS module (Node) and as a plain script in a
 * page or extension, where it defines globalThis.CanvasHarnessPack. It never evaluates anything it reads, and it
 * does NOT validate SVG: every SVG a pack carries must still go through the extension's own artwork validator.
 * The full specification is quick-upload/SPEC.md.
 */
(function (root) {
  'use strict';
  const VERSION = 1, MAX_PACK_BYTES = 3 * 1024 * 1024, MAX_PARTS = 128, MAX_DIRECTIVE = 2048;
  const SLOTS = ['banner', 'icon', 'frame'], SLOT_ALIAS = Object.freeze(Object.assign(Object.create(null), { border: 'frame' }));
  // where each slot is stored in Canvas Harness's course appearance (coursePrefs[id] or overviewArt)
  const SLOT_KEYS = { banner: 'bannerArt', icon: 'iconArt', frame: 'borderArt' };
  const PLACES = ['overview', 'every-course'], FITS = ['contain', 'cover'], POSITIONS = ['left', 'center', 'right'];
  const bytes = s => (typeof TextEncoder === 'function' ? new TextEncoder().encode(s).length : Buffer.byteLength(s));
  const decode = s => s.replace(/&(quot|apos|amp|lt|gt);/g, (_, n) => ({ quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' }[n]));
  const encode = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const wholeNumber = value => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;

  // The same normalisation Canvas Harness uses for course names: case, accents kept, punctuation and spacing ignored.
  function normalizeName(value) { return String(value == null ? '' : value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }

  function readAttrs(text) {
    const attrs = Object.create(null), re = /([A-Za-z0-9-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|“([^”]*)”|([^\s"'“”]+))/y;
    let at = 0, clean = true;
    while (at < text.length) {
      const separated = at === 0 || /\s/.test(text[at]);
      while (at < text.length && /\s/.test(text[at])) at++;
      if (at === text.length) break;
      re.lastIndex = at;
      const m = separated && re.exec(text);
      if (m) {
        const key = m[1].toLowerCase();
        if (!Object.hasOwn(attrs, key)) attrs[key] = decode(m[2] ?? m[3] ?? m[4] ?? m[5]).trim();
        at = re.lastIndex;
        continue;
      }
      // Ignore a malformed token whole, including its quoted text; never recover a target from inside it.
      clean = false;
      let quote = '';
      while (at < text.length) {
        const c = text[at++];
        if (quote) { if (c === quote) quote = ''; }
        else if (c === '“') quote = '”';
        else if (c === '"' || c === "'") quote = c;
        else if (/\s/.test(c)) { at--; break; }
      }
    }
    return { attrs, clean };
  }

  function readDirectives(text) {
    const found = [], prefix = /<\?ch-([A-Za-z][A-Za-z0-9-]*)(?=[\s?])/y;
    let at = 0, start;
    while ((start = text.indexOf('<?ch-', at)) !== -1) {
      prefix.lastIndex = start;
      const m = prefix.exec(text);
      if (!m) { at = start + 5; continue; }
      const close = text.indexOf('?>', prefix.lastIndex);
      // No terminator remains, so later prefixes cannot form complete directives either.
      if (close === -1) break;
      found.push({ kind: m[1].toLowerCase(), raw: text.slice(prefix.lastIndex, close), start, end: close + 2 });
      at = close + 2;
    }
    return found;
  }

  function readArt(attrs, body, part) {
    const err = (code, message) => part.errors.push({ code, message }), warn = (code, message) => part.warnings.push({ code, message });
    const slot = SLOT_ALIAS[(attrs.slot || '').toLowerCase()] || (attrs.slot || '').toLowerCase();
    if (!attrs.slot) err('no-slot', 'This piece does not say which slot it is for (banner, icon or frame).');
    else if (!SLOTS.includes(slot)) err('bad-slot', `"${attrs.slot}" is not a slot this version knows. Use banner, icon or frame.`);
    else part.slot = slot;
    const names = (attrs.course || '').split('|').map(s => s.trim()).filter(s => normalizeName(s)), id = (attrs['course-id'] || '').trim(), place = (attrs.place || '').toLowerCase();
    if (place && (names.length || id)) err('two-targets', 'This piece names both a course and a place. It needs exactly one.');
    else if (place) { if (PLACES.includes(place)) part.target = { type: place }; else err('bad-place', `"${attrs.place}" is not a place this version knows. Use overview or every-course.`); }
    else if (names.length || id) { part.target = { type: 'course', names }; if (id) part.target.id = id; }
    else err('no-target', 'This piece does not say which course it is for.');
    for (const [key, allowed] of [['fit', FITS], ['position', POSITIONS]]) {
      if (attrs[key] === undefined) continue;
      const value = attrs[key].toLowerCase();
      if (part.slot && part.slot !== 'banner') warn('option-ignored', `${key} only applies to a banner.`);
      else if (!allowed.includes(value)) warn('option-ignored', `${key}="${attrs[key]}" is not one of ${allowed.join(', ')}.`);
      else part[key] = value;
    }
    // the SVG is everything from the first <svg to the last </svg>; code fences and stray words round it are dropped
    const open = body.search(/<svg[\s>]/), close = body.lastIndexOf('</svg>');
    if (open < 0 || close < open) err('no-svg', open < 0 ? 'No SVG follows this piece.' : 'The SVG of this piece is not complete (its closing </svg> is missing).');
    else part.svg = body.slice(open, close + 6);
    const first = part.target && part.target.type === 'course' ? (names[0] || 'course ' + id) : part.target ? part.target.type : 'artwork';
    part.name = (attrs.name || `${first} ${part.slot || 'art'}`).slice(0, 120);
  }

  function targetKey(part) {
    const t = part.target; if (!t || !part.slot) return null;
    return (t.type === 'course' ? 'course:' + (t.id ? '#' + t.id : normalizeName(t.names[0])) : t.type) + '/' + part.slot;
  }

  function parse(input) {
    const out = { ok: false, version: null, name: '', attrs: {}, parts: [], skipped: [], warnings: [], errors: [] };
    const fail = (code, message) => { out.errors.push({ code, message }); return out; };
    if (typeof input !== 'string') return fail('not-text', 'A pack is text.');
    if (bytes(input) > MAX_PACK_BYTES) return fail('too-large', 'This pack is larger than 3 MiB. Send it as several smaller packs.');
    const text = input.replace(/^\uFEFF/, ''), found = readDirectives(text);
    const head = found.findIndex(d => d.kind === 'pack');
    if (head < 0) return fail('not-a-pack', 'This is not a Canvas Harness pack: it has no <?ch-pack ...?> line.');
    if (found.slice(0, head).length) out.warnings.push({ code: 'before-header', message: 'Pieces listed before the <?ch-pack ...?> line were ignored.' });
    if (found[head].raw.length > MAX_DIRECTIVE) return fail('bad-directive', 'The pack line exceeds the 2,048-character directive limit.');
    const header = readAttrs(found[head].raw).attrs, major = wholeNumber(header.version);
    out.attrs = header; out.name = (header.name || '').slice(0, 120);
    if (!Number.isInteger(major) || major < 1) return fail('bad-version', 'The pack does not state its format version as a positive whole number (version="1").');
    out.version = major;
    if (major > VERSION) return fail('newer-version', `This pack uses format version ${major}. Update Canvas Harness to read it.`);
    let ended = false, declared = null;
    for (let i = head + 1; i < found.length; i++) {
      const d = found[i], next = found[i + 1];
      if (d.raw.length > MAX_DIRECTIVE && (d.kind === 'pack' || d.kind === 'end')) {
        out.warnings.push({ code: 'bad-directive', message: `The <?ch-${d.kind}?> line exceeds the 2,048-character directive limit and was ignored.` });
        continue;
      }
      if (d.kind === 'pack') { out.warnings.push({ code: 'second-header', message: 'A second <?ch-pack ...?> line was treated as the end of the pack.' }); break; }
      if (d.kind === 'end') { ended = true; const n = wholeNumber(readAttrs(d.raw).attrs.parts); if (Number.isInteger(n)) declared = n; break; }
      const index = out.parts.length + out.skipped.length + 1;
      if (index > MAX_PARTS) return fail('too-many-parts', `A pack holds at most ${MAX_PARTS} pieces.`);
      if (d.raw.length > MAX_DIRECTIVE) { out.skipped.push({ index, kind: d.kind, reason: 'bad-directive' }); continue; }
      if (d.kind !== 'art') { out.skipped.push({ index, kind: d.kind, reason: 'unknown-kind' }); continue; }
      const { attrs, clean } = readAttrs(d.raw), body = text.slice(d.end, next ? next.start : text.length);
      const part = { index, kind: 'art', slot: null, target: null, name: '', svg: null, attrs, errors: [], warnings: [] };
      if (!clean) part.warnings.push({ code: 'directive-text', message: 'Part of this piece\'s directive could not be read and was ignored.' });
      readArt(attrs, body, part);
      out.parts.push(part);
    }
    // two pieces for the same slot of the same target: the later one wins
    const seen = new Map();
    for (const part of out.parts) {
      if (part.errors.length) continue;
      const key = targetKey(part), earlier = seen.get(key);
      if (earlier) { earlier.replacedBy = part.index; earlier.errors.push({ code: 'replaced', message: `Piece ${part.index} is for the same slot; the later piece is used.` }); }
      seen.set(key, part);
    }
    const total = out.parts.length + out.skipped.length;
    if (!ended) out.warnings.push({ code: 'no-end', message: 'The pack has no <?ch-end?> line. It may have been cut off: check that nothing is missing.' });
    else if (declared !== null && declared !== total) out.warnings.push({ code: 'count-mismatch', message: `The pack says it holds ${declared} piece(s) but ${total} were found. Something may be missing.` });
    if (out.skipped.length) out.warnings.push({ code: 'skipped', message: `${out.skipped.length} piece(s) are of a kind this version does not know and were skipped.` });
    if (!total) return fail('empty', 'The pack holds no pieces.');
    out.ok = true;
    return out;
  }

  // Write a pack. parts: [{ slot, svg, course | courseId | place, fit?, position?, name? }]; course may be a string or
  // an array of names the course might go by.
  function build(pack) {
    const parts = (pack && pack.parts) || [];
    if (!parts.length) throw new Error('A pack needs at least one piece.');
    if (parts.length > MAX_PARTS) throw new Error(`A pack holds at most ${MAX_PARTS} pieces.`);
    const attr = (k, v) => v === undefined || v === null || v === '' ? '' : ` ${k}="${encode(v)}"`;
    const directive = (kind, raw) => {
      if (raw.length > MAX_DIRECTIVE) throw new Error(`The ${kind} directive exceeds the 2,048-character limit.`);
      return `<?ch-${kind}${raw}?>`;
    };
    const lines = ['Canvas Harness quick upload pack. Paste all of this text into Quick upload in Canvas Harness, or drop this file there.', '',
      directive('pack', attr('version', VERSION) + attr('name', pack.name))];
    for (const [i, p] of parts.entries()) {
      const slot = SLOT_ALIAS[p.slot] || p.slot, where = `Piece ${i + 1}`;
      if (!SLOTS.includes(slot)) throw new Error(`${where}: slot must be banner, icon or frame.`);
      const names = [].concat(p.course || []).map(s => String(s).trim()).filter(s => normalizeName(s));
      if (names.some(n => n.includes('|'))) throw new Error(`${where}: a course name cannot contain "|".`);
      if (p.place ? (names.length || p.courseId) : !(names.length || p.courseId)) throw new Error(`${where}: give exactly one of course (or courseId) and place.`);
      if (p.place && !PLACES.includes(p.place)) throw new Error(`${where}: place must be overview or every-course.`);
      if (p.fit && !FITS.includes(p.fit) || p.position && !POSITIONS.includes(p.position)) throw new Error(`${where}: fit is contain or cover; position is left, center or right.`);
      if ((p.fit || p.position) && slot !== 'banner') throw new Error(`${where}: fit and position only apply to a banner.`);
      const svg = String(p.svg || '').trim();
      if (!/^<svg[\s>]/.test(svg) || !/<\/svg>$/.test(svg)) throw new Error(`${where}: the SVG must start with <svg and end with </svg> (no XML declaration, nothing after it).`);
      if (/<\?ch-/i.test(svg)) throw new Error(`${where}: the SVG contains "<?ch-", which would break the pack.`);
      lines.push('', directive('art', `${attr('course', names.join('|'))}${attr('course-id', p.courseId)}${attr('place', p.place)}${attr('slot', slot)}${attr('fit', p.fit)}${attr('position', p.position)}${attr('name', p.name)}`), svg);
    }
    lines.push('', directive('end', attr('parts', parts.length)), '');
    const text = lines.join('\n');
    if (bytes(text) > MAX_PACK_BYTES) throw new Error('The pack is larger than 3 MiB. Split it into several packs.');
    return text;
  }

  // Which of the user's courses a piece is for. courses: [{ id, name, originalName?, code? }].
  // Returns { status: 'matched', course } | { status: 'ambiguous', candidates } | { status: 'none', candidates: [] }.
  // 'ambiguous' and 'none' mean: ask the user. Never guess.
  function matchCourse(target, courses) {
    const list = Array.isArray(courses) ? courses : [], result = found => found.length === 1 ? { status: 'matched', course: found[0] } : { status: found.length ? 'ambiguous' : 'none', candidates: found };
    if (!target || target.type !== 'course') return { status: 'none', candidates: [] };
    if (target.id) { const byId = list.filter(c => String(c.id) === String(target.id)); if (byId.length === 1) return result(byId); }
    const wanted = (target.names || []).map(normalizeName).filter(Boolean);
    if (!wanted.length) return { status: 'none', candidates: [] };
    const labels = c => [c.originalName, c.name, c.code].map(normalizeName).filter(Boolean);
    const exact = list.filter(c => labels(c).some(l => wanted.includes(l)));
    if (exact.length) return result(exact);
    const words = s => s.split(' '), contains = (label, want) => { const have = new Set(words(label)); return words(want).every(w => have.has(w)); };
    return result(list.filter(c => labels(c).some(l => wanted.some(w => contains(l, w)))));
  }

  // The pieces of a parsed pack that can be applied, in the order to apply them: every-course pieces first, so that
  // a piece for a named course or for the overview always wins over an every-course piece for the same slot.
  function applyOrder(parsed) {
    const good = ((parsed && parsed.parts) || []).filter(p => p.kind === 'art' && !p.errors.length);
    return [...good.filter(p => p.target.type === 'every-course'), ...good.filter(p => p.target.type !== 'every-course')];
  }

  const api = Object.freeze({ VERSION, MAX_PACK_BYTES, MAX_PARTS, SLOTS, SLOT_KEYS, PLACES, FITS, POSITIONS, parse, build, matchCourse, applyOrder, normalizeName });
  root.CanvasHarnessPack = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
