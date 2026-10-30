'use strict';
// Day keys are asked for many times per render (filters, buckets, the planner, insights). core.js keeps one
// Intl.DateTimeFormat per time zone and remembers each zone|instant answer; dashboard-model.js remembers its day keys
// the same way. Both caches are bounded, and the answers must stay exactly what a fresh formatter gives.
const test = require('node:test');
const assert = require('node:assert/strict');

global.ReserveSite ??= require('../extension/site.js');
const Core = global.ReserveCore = require('../extension/core.js');
const Model = require('../extension/dashboard-model.js');

function assignment(overrides = {}) {
  return { id: '1', courseId: '10', courseName: 'Chemistry', name: 'Practice', dueAt: '2026-09-14T16:00:00Z', state: 'unsubmitted', missing: false, redoRequested: false, ...overrides };
}

test('dayKey cached formatters and memo keep per-zone answers and still reject a bad zone', () => {
  const instant = '2026-09-12T02:30:00Z';
  const zones = { 'America/New_York': '2026-09-11', 'Asia/Shanghai': '2026-09-12', UTC: '2026-09-12', 'Pacific/Honolulu': '2026-09-11' };
  // Asked twice each, across more than 12 zones, so both the memo and the formatter cache wrap.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const [zone, key] of Object.entries(zones)) assert.equal(Core.dayKey(instant, zone), key);
    for (const zone of ['Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Pacific/Auckland', 'Pacific/Chatham']) {
      assert.match(Core.dayKey(instant, zone), /^2026-09-1[12]$/);
    }
  }
  assert.equal(Core.dayKey(new Date(Date.parse(instant)), 'America/New_York'), '2026-09-11');
  assert.equal(Core.dayKey(instant), '2026-09-11');
  for (let index = 0; index < 5000; index += 1) Core.dayKey(Date.parse('2026-01-01T12:00:00Z') + index * 3600000, 'America/New_York');
  assert.equal(Core.dayKey(instant, 'America/New_York'), '2026-09-11');
  assert.equal(Core.dayKey('invalid', 'America/New_York'), null);
  for (let pass = 0; pass < 2; pass += 1) assert.throws(() => Core.dayKey(instant, 'Not/AZone'), RangeError);
});

test('day memo is keyed by zone and instant: repeated renders and zone switches keep the same answers', () => {
  const now = Date.parse('2026-09-14T02:30:00Z'); // Sep 13 22:30 in New York, Sep 14 10:30 in Shanghai
  const items = [
    assignment({ id: 'near-midnight', dueAt: '2026-09-14T03:00:00Z' }),
    assignment({ id: 'next-utc-day', dueAt: '2026-09-14T17:00:00Z' }),
    assignment({ id: 'no-date', dueAt: null }),
  ];
  const ids = (mode, timeZone, day) => Model.filterAssignments(items, { now, mode, timeZone, day }).items.map(x => x.id);
  for (let pass = 0; pass < 2; pass += 1) {
    assert.deepEqual(ids('today', 'America/New_York'), ['near-midnight']);
    assert.deepEqual(ids('tomorrow', 'America/New_York'), ['next-utc-day']);
    assert.deepEqual(ids('today', 'Asia/Shanghai'), ['near-midnight']);
    assert.deepEqual(ids('tomorrow', 'Asia/Shanghai'), ['next-utc-day']);
    assert.deepEqual(ids('today', 'Europe/London'), ['near-midnight', 'next-utc-day']);
    assert.deepEqual(ids('tomorrow', 'Europe/London'), []);
    assert.deepEqual(ids('dated', 'America/New_York', '2026-09-13'), ['near-midnight']);
    assert.deepEqual(ids('dated', 'Asia/Shanghai', '2026-09-13'), []);
    // An unknown zone falls back to New York, as before.
    assert.deepEqual(ids('today', 'Not/AZone'), ['near-midnight']);
    // Modes that ignore the day window are unchanged.
    assert.deepEqual(ids('dated', 'America/New_York'), ['near-midnight', 'next-utc-day']);
    assert.deepEqual(ids('undated', 'America/New_York'), ['no-date']);
    assert.deepEqual(ids('upcoming', 'Asia/Shanghai'), ['near-midnight', 'next-utc-day']);
    assert.equal(Model.deadlineHint(items[1], { now, timeZone: 'America/New_York' }), 'Due tomorrow');
  }
});
