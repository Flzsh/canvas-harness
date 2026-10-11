'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const readers = [
  ['extension', path.join(__dirname, '../extension/quick-pack.js')],
  ['skill reference', path.join(__dirname, '../skills/canvas-harness-art/scripts/quick-pack.js')],
];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M22 90L50 18L78 90Z" fill="#D97757"/></svg>';
const codes = issues => issues.map(issue => issue.code);
const directive = (kind, raw = '') => `<?ch-${kind}${raw}?>`;
const padded = (raw, length) => raw + ' '.repeat(length - raw.length);
const art = (raw = ' course="Astronomy" slot="icon"') => directive('art', raw) + '\n' + svg;
const pack = (body = art(), header = ' version="1"', footer = ' parts="1"') =>
  directive('pack', header) + '\n' + body + (footer === null ? '' : '\n' + directive('end', footer));

test('extension and skill reference remain byte-identical', () => {
  assert.deepEqual(fs.readFileSync(readers[0][1]), fs.readFileSync(readers[1][1]));
});

for (const [label, file] of readers) {
  const P = require(file);
  const check = (name, run) => test(`${label}: ${name}`, run);

  for (const version of ['', '1junk', '1.0', '1.5', '1e0', '1e9', '0x1', '+1', '-1', '0', 'NaN', 'Infinity']) {
    check(`rejects nonpositive or incomplete integer version ${JSON.stringify(version)}`, () => {
      const result = P.parse(pack(art(), ` version="${version}"`));
      assert.equal(result.ok, false);
      assert.deepEqual(codes(result.errors), ['bad-version']);
      assert.deepEqual(result.parts, []);
    });
  }
  check('requires a version on the pack line', () => {
    assert.deepEqual(codes(P.parse(pack(art(), '')).errors), ['bad-version']);
  });
  check('accepts complete decimal versions and retains newer-version handling', () => {
    for (const version of ['1', '01', ' 1 ']) {
      const result = P.parse(pack(art(), ` version="${version}"`));
      assert.equal(result.ok, true);
      assert.equal(result.version, 1);
    }
    const newer = P.parse(pack(art(), ' version="2"'));
    assert.equal(newer.ok, false);
    assert.equal(newer.version, 2);
    assert.deepEqual(codes(newer.errors), ['newer-version']);
  });
  check('does not recover a version from a malformed attribute name', () => {
    assert.deepEqual(codes(P.parse(pack(art(), ' _version="1"')).errors), ['bad-version']);
  });

  for (const count of ['9junk', '9.5', '9e0', '0x9', '+9', '-9']) {
    check(`ignores incomplete integer footer count ${JSON.stringify(count)}`, () => {
      const result = P.parse(pack(art(), ' version="1"', ` parts="${count}"`));
      assert.equal(result.ok, true);
      assert.deepEqual(codes(result.warnings), []);
    });
  }
  check('a complete footer count still reports missing pieces', () => {
    assert.deepEqual(codes(P.parse(pack(art(), ' version="1"', ' parts="2"')).warnings), ['count-mismatch']);
  });

  check('accepts a header at the 2048-character directive bound', () => {
    const result = P.parse(pack(art(), padded(' version="1"', 2048)));
    assert.equal(result.ok, true);
    assert.deepEqual(codes(result.warnings), []);
  });
  check('refuses an oversized header before reading its attributes', () => {
    const result = P.parse(pack(art(), padded(' version="1"', 2049)));
    assert.equal(result.ok, false);
    assert.deepEqual(codes(result.errors), ['bad-directive']);
    assert.deepEqual(result.parts, []);
  });
  check('accepts an art directive at the bound and skips one character over it', () => {
    const raw = ' course="Astronomy" slot="icon"';
    const accepted = P.parse(pack(art(padded(raw, 2048))));
    assert.equal(accepted.parts[0].svg, svg);
    assert.deepEqual(accepted.parts[0].errors, []);
    const skipped = P.parse(pack(art(padded(raw, 2049))));
    assert.deepEqual(skipped.parts, []);
    assert.deepEqual(skipped.skipped, [{ index: 1, kind: 'art', reason: 'bad-directive' }]);
    assert.deepEqual(codes(skipped.warnings), ['skipped']);
  });
  check('accepts an end directive at the bound', () => {
    const result = P.parse(pack(art(), ' version="1"', padded(' parts="1"', 2048)));
    assert.equal(result.ok, true);
    assert.deepEqual(codes(result.warnings), []);
  });
  check('an oversized end cannot close the pack or supply its count', () => {
    const result = P.parse(pack(art(), ' version="1"', padded(' parts="999"', 2049)));
    assert.equal(result.ok, true);
    assert.equal(result.parts.length, 1);
    assert.deepEqual(codes(result.warnings), ['bad-directive', 'no-end']);
    assert.deepEqual(result.skipped, []);
  });
  check('an oversized end does not hide later parts or count as artwork', () => {
    const body = art() + '\n' + directive('end', padded(' parts="999"', 2049)) + '\n' + art(' course="Astronomy" slot="frame"');
    const result = P.parse(pack(body, ' version="1"', ' parts="2"'));
    assert.deepEqual(result.parts.map(part => [part.index, part.slot]), [[1, 'icon'], [2, 'frame']]);
    assert.deepEqual(codes(result.warnings), ['bad-directive']);
  });
  check('an oversized second header cannot prematurely end the pack', () => {
    const body = art() + '\n' + directive('pack', padded(' version="999"', 2049)) + '\n' + art(' course="Astronomy" slot="frame"');
    const result = P.parse(pack(body, ' version="1"', ' parts="2"'));
    assert.equal(result.parts.length, 2);
    assert.deepEqual(codes(result.warnings), ['bad-directive']);
  });
  check('a valid second header still ends the first pack', () => {
    const result = P.parse(pack(art() + '\n' + directive('pack', ' version="1"') + '\n' + art(' course="Astronomy" slot="frame"')));
    assert.equal(result.parts.length, 1);
    assert.deepEqual(codes(result.warnings), ['second-header', 'no-end']);
  });
  check('bounds unknown directives before considering their kind', () => {
    const result = P.parse(pack(directive('settings', padded(' name="future"', 2049)), ' version="1"', ' parts="1"'));
    assert.deepEqual(result.skipped, [{ index: 1, kind: 'settings', reason: 'bad-directive' }]);
  });

  check('writer enforces header bounds after escaping attribute values', () => {
    const overhead = ' version="1" name=""'.length;
    const parts = [{ course: 'Astronomy', slot: 'icon', svg }];
    assert.equal(P.parse(P.build({ name: 'x'.repeat(2048 - overhead), parts })).ok, true);
    assert.throws(() => P.build({ name: 'x'.repeat(2049 - overhead), parts }), /directive|2048|2,048/i);
    assert.throws(() => P.build({ name: '&'.repeat(500), parts }), /directive|2048|2,048/i);
  });
  check('writer enforces artwork directive bounds after escaping values', () => {
    const overhead = ' course="Astronomy" slot="icon" name=""'.length;
    assert.deepEqual(P.parse(P.build({ parts: [{ course: 'Astronomy', slot: 'icon', name: 'x'.repeat(2048 - overhead), svg }] })).parts[0].errors, []);
    assert.throws(() => P.build({ parts: [{ course: 'Astronomy', slot: 'icon', name: 'x'.repeat(2049 - overhead), svg }] }), /directive|2048|2,048/i);
    assert.throws(() => P.build({ parts: [{ course: 'A&'.repeat(500), slot: 'icon', svg }] }), /directive|2048|2,048/i);
    assert.throws(() => P.build({ parts: [{ courseId: '9'.repeat(3000), slot: 'icon', svg }] }), /directive|2048|2,048/i);
  });

  check('malformed attribute names cannot smuggle a course id or course alias', () => {
    for (const raw of [' _course-id="7" slot="icon"', ' data_course-id="7" slot="icon"', ' _course="Astronomy" slot="icon"']) {
      const part = P.parse(pack(art(raw))).parts[0];
      assert.equal(part.target, null);
      assert.deepEqual(codes(part.errors), ['no-target']);
      assert.deepEqual(codes(part.warnings), ['directive-text']);
    }
  });
  check('adjacent attributes cannot redirect a course target', () => {
    const part = P.parse(pack(art(' course="Astronomy"course-id="7" slot="icon"'))).parts[0];
    assert.deepEqual(part.target, { type: 'course', names: ['Astronomy'] });
    assert.deepEqual(codes(part.warnings), ['directive-text']);
  });
  check('malformed quoted attributes cannot smuggle nested target attributes', () => {
    const part = P.parse(pack(art(' broken_key="junk course-id=7" slot="icon"'))).parts[0];
    assert.equal(part.target, null);
    assert.deepEqual(codes(part.errors), ['no-target']);
  });
  check('known attributes cannot be recovered from an unknown numeric name', () => {
    const part = P.parse(pack(art(' 1course-id="7" slot="icon"'))).parts[0];
    assert.equal(part.target, null);
    assert.deepEqual(codes(part.errors), ['no-target']);
    assert.deepEqual(codes(part.warnings), []);
  });
  check('duplicate attributes remain case-insensitive and the first wins', () => {
    const part = P.parse(pack(art(' COURSE-ID="900719925474099312345" course-id="7" course="Astro|Astronomy" slot="icon"'))).parts[0];
    assert.deepEqual(part.target, { type: 'course', names: ['Astro', 'Astronomy'], id: '900719925474099312345' });
    assert.deepEqual(part.errors, []);
  });
  check('ids retain precision and leading zeros through writer and reader', () => {
    for (const id of ['900719925474099312345', '00048213']) {
      const result = P.parse(P.build({ parts: [{ courseId: id, course: ['Astro', 'Astronomy'], slot: 'icon', svg }] }));
      assert.equal(result.parts[0].target.id, id);
      assert.equal(P.matchCourse(result.parts[0].target, [{ id, name: 'Different course' }]).course.id, id);
    }
  });
  check('prototype-looking target values remain literal data', () => {
    const result = P.parse(P.build({ parts: [{ courseId: '__proto__', course: ['constructor', '__proto__'], slot: 'border', svg }] }));
    assert.deepEqual(result.parts[0].target, { type: 'course', names: ['constructor', '__proto__'], id: '__proto__' });
    assert.equal(result.parts[0].slot, 'frame');
    assert.deepEqual(result.parts[0].errors, []);
  });
  check('course aliases trim empty names while preserving names and accents', () => {
    const part = P.parse(pack(art(' course=" | Español 3 | !!! | Spanish III | " slot="border"'))).parts[0];
    assert.deepEqual(part.target.names, ['Español 3', 'Spanish III']);
    assert.equal(part.slot, 'frame');
    assert.equal(P.matchCourse(part.target, [{ id: '104', name: 'Español 3' }]).course.id, '104');
  });
  check('inherited properties cannot supply attributes or slot aliases', () => {
    const context = vm.createContext({ TextEncoder });
    vm.runInContext(fs.readFileSync(file, 'utf8'), context);
    vm.runInContext('Object.prototype.title = "banner"; Object.prototype.course = "Injected course"; Object.prototype["course-id"] = "999"; Object.prototype.slot = "banner";', context);
    const reader = context.CanvasHarnessPack;
    const noSlot = reader.parse(pack(art(' course="Astronomy"'))).parts[0];
    assert.deepEqual(Array.from(noSlot.errors, issue => issue.code), ['no-slot']);
    const title = reader.parse(pack(art(' course="Astronomy" slot="title"'))).parts[0];
    assert.deepEqual(Array.from(title.errors, issue => issue.code), ['bad-slot']);
    const byId = reader.parse(pack(art(' course-id="7" slot="icon"'))).parts[0];
    assert.deepEqual(Array.from(byId.target.names), []);
    const byName = reader.parse(pack()).parts[0];
    assert.equal(Object.hasOwn(byName.target, 'id'), false);
    assert.throws(() => reader.build({ parts: [{ course: 'Astronomy', slot: 'title', svg }] }), /slot/);
  });
  check('unknown attributes named like prototype properties retain their first value', () => {
    const attrs = P.parse(pack(art(' constructor="first" CONSTRUCTOR="second" course="Astronomy" slot="icon"'))).parts[0].attrs;
    assert.equal(Object.hasOwn(attrs, 'constructor'), true);
    assert.equal(attrs.constructor, 'first');
  });
  check('version 1 continues to refuse the title slot', () => {
    assert.deepEqual(codes(P.parse(pack(art(' course="Astronomy" slot="title"'))).parts[0].errors), ['bad-slot']);
    assert.throws(() => P.build({ parts: [{ course: 'Astronomy', slot: 'title', svg }] }), /slot/);
  });

  check('pack size is bounded in UTF-8 bytes', () => {
    const base = pack();
    const spare = 3145728 - Buffer.byteLength(base);
    const text = 'é'.repeat(Math.floor(spare / 2)) + 'x'.repeat(spare % 2) + base;
    assert.equal(Buffer.byteLength(text), 3145728);
    assert.equal(P.parse(text).ok, true);
    assert.deepEqual(codes(P.parse(text + 'x').errors), ['too-large']);
  });
  check('128 parts are allowed but a 129th is refused', () => {
    assert.equal(P.parse(pack(Array.from({ length: 128 }, () => art()).join('\n'), ' version="1"', ' parts="128"')).ok, true);
    assert.deepEqual(codes(P.parse(pack(Array.from({ length: 129 }, () => art()).join('\n'), ' version="1"', ' parts="129"')).errors), ['too-many-parts']);
  });
  check('unterminated directive prefixes stay within a bounded scan at the pack limit', () => {
    const script = `
      const P = require(process.argv[1]);
      const header = '<?ch-pack version="1"?>\\n';
      const text = header + '<?ch-art '.repeat(Math.floor((3145728 - header.length) / 9));
      const result = P.parse(text);
      process.stdout.write(JSON.stringify({ok: result.ok, errors: result.errors.map(e => e.code), warnings: result.warnings.map(e => e.code)}));
    `;
    const result = JSON.parse(execFileSync(process.execPath, ['-e', script, file], { encoding: 'utf8', timeout: 3000 }));
    assert.deepEqual(result, { ok: false, errors: ['empty'], warnings: ['no-end'] });
  });
  check('scanner preserves completed directive framing and ignores unterminated tails', () => {
    const result = P.parse('ignored <?ch-! ?>\n' + pack() + '\n<?ch-art '.repeat(10000));
    assert.equal(result.ok, true);
    assert.equal(result.parts[0].svg, svg);
    assert.deepEqual(result.parts[0].errors, []);
    assert.deepEqual(result.warnings, []);
  });
}
