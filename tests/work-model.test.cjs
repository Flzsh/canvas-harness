const test = require('node:test');
const assert = require('node:assert/strict');

global.ReserveCore = require('../extension/core.js');
const Work = require('../extension/work-model.js');

function assignment(overrides = {}) {
  return {
    id: '1',
    courseId: '10',
    courseName: 'Chemistry',
    name: 'Practice',
    dueAt: '2026-09-16T16:00:00Z',
    state: 'unsubmitted',
    missing: false,
    redoRequested: false,
    score: null,
    updatedAt: '2026-09-13T12:00:00Z',
    ...overrides,
  };
}

const NOW = Date.parse('2026-09-13T16:00:00Z'); // Sep 13, noon in New York

test('exports the classic-script/CommonJS Work Model API', () => {
  assert.equal(global.ReserveWorkModel, Work);
  assert.equal(typeof Work.insights, 'function');
});

test('next recommendation follows actual priority flags in order', () => {
  const items = [
    assignment({ id: 'deadline', name: 'Deadline', dueAt: '2026-09-13T18:00:00Z' }),
    assignment({ id: 'started', name: 'Started', dueAt: '2026-09-15T18:00:00Z' }),
    assignment({ id: 'pinned', name: 'Pinned', dueAt: '2026-09-16T18:00:00Z' }),
    assignment({ id: 'planned', name: 'Planned', dueAt: null }),
    assignment({ id: 'later', name: 'Later', dueAt: '2026-09-14T20:00:00Z' }),
  ];
  const local = {
    started: { progress: 'in-progress' },
    pinned: { pinned: true },
    planned: { plannedDate: '2026-09-13' },
  };

  assert.equal(Work.insights(items, local, { now: NOW }).next.item.id, 'deadline');
  assert.equal(Work.insights(items, local, { now: NOW }).next.reason, 'Due within 24 hours');

  const withoutDeadline = items.filter(item => item.id !== 'deadline');
  assert.equal(Work.insights(withoutDeadline, local, { now: NOW }).next.item.id, 'started');
  assert.equal(Work.insights(withoutDeadline, local, { now: NOW }).next.reason, 'You already started this');

  const withoutStarted = withoutDeadline.filter(item => item.id !== 'started');
  assert.equal(Work.insights(withoutStarted, local, { now: NOW }).next.item.id, 'pinned');
  assert.equal(Work.insights(withoutStarted, local, { now: NOW }).next.reason, 'Pinned by you');
});

test('recent overdue can be recommended but an old pinned item remains an intentional pin', () => {
  const recent = assignment({ id: 'recent', dueAt: '2026-09-12T16:00:00Z' });
  const recentResult = Work.insights([recent], {}, { now: NOW });
  assert.equal(recentResult.next.item.id, 'recent');
  assert.equal(recentResult.next.reason, 'Overdue in Canvas');

  const oldPinned = assignment({ id: 'old-pin', dueAt: '2026-07-01T16:00:00Z' });
  const oldResult = Work.insights([oldPinned], { 'old-pin': { pinned: true } }, { now: NOW });
  assert.equal(oldResult.next.item.id, 'old-pin');
  assert.equal(oldResult.next.reason, 'Pinned by you');
});

test('local done means ready without faking Canvas completion and is excluded from next', () => {
  const items = [
    assignment({ id: 'ready', dueAt: '2026-09-14T12:00:00Z' }),
    assignment({ id: 'submitted', dueAt: '2026-09-14T13:00:00Z', state: 'submitted' }),
    assignment({ id: 'fallback', dueAt: '2026-09-15T12:00:00Z' }),
  ];
  const local = {
    ready: { progress: 'done', plannedDate: '2026-09-13' },
    submitted: { progress: 'done', plannedDate: '2026-09-13' },
  };

  const result = Work.insights(items, local, { now: NOW });
  assert.deepEqual(result.ready.map(item => item.id), ['ready']);
  assert.deepEqual(result.planned.map(item => item.id), ['ready']);
  assert.equal(result.next.item.id, 'fallback');
});

test('planned today uses the configured local calendar date and can include undated or old work', () => {
  const now = Date.parse('2026-09-14T02:30:00Z'); // Sep 13, 22:30 EDT
  const items = [
    assignment({ id: 'undated', dueAt: null }),
    assignment({ id: 'old', dueAt: '2026-05-01T16:00:00Z' }),
    assignment({ id: 'tomorrow-plan', dueAt: null }),
  ];
  const local = {
    undated: { plannedDate: '2026-09-13' },
    old: { plannedDate: '2026-09-13' },
    'tomorrow-plan': { plannedDate: '2026-09-14' },
  };

  const result = Work.insights(items, local, { now, timeZone: 'America/New_York' });
  assert.deepEqual(result.planned.map(item => item.id), ['old', 'undated']);
});

test('planned minutes use only explicit positive numeric estimates and count the rest unestimated', () => {
  const items = [
    assignment({ id: 'estimated', dueAt: null }),
    assignment({ id: 'zero', dueAt: null }),
    assignment({ id: 'string-estimate', dueAt: null }),
    assignment({ id: 'negative', dueAt: null }),
  ];
  const local = {
    estimated: { plannedDate: '2026-09-13', estimate: 25 },
    zero: { plannedDate: '2026-09-13', estimate: 0 },
    'string-estimate': { plannedDate: '2026-09-13', estimate: '30' },
    negative: { plannedDate: '2026-09-13', estimate: -5 },
  };

  const result = Work.insights(items, local, { now: NOW });
  assert.equal(result.minutes, 25);
  assert.equal(result.unestimated, 3);
});

test('missing includes recent missing or redo conflicts regardless of grade and excludes old or excused work', () => {
  const items = [
    assignment({ id: 'graded-missing', dueAt: '2026-09-10T16:00:00Z', state: 'graded', missing: true, score: 0 }),
    assignment({ id: 'future-redo', dueAt: '2026-09-20T16:00:00Z', state: 'graded', redoRequested: true, score: 9 }),
    assignment({ id: 'old-missing', dueAt: '2026-08-01T16:00:00Z', missing: true }),
    assignment({ id: 'excused-missing', dueAt: '2026-09-12T16:00:00Z', state: 'excused', missing: true }),
    assignment({ id: 'normal-grade', dueAt: '2026-09-12T18:00:00Z', state: 'graded', score: 8 }),
  ];

  const result = Work.insights(items, {}, { now: NOW });
  assert.deepEqual(result.missing.map(item => item.id), ['graded-missing', 'future-redo']);
  assert.deepEqual(result.recentGrades.map(item => item.id), ['normal-grade']);
});

test('recent grades accept a real zero, reject null/conflicted grades, sort real timestamps, and cap at five', () => {
  const items = [
    assignment({ id: 'zero', state: 'graded', score: 0, gradedAt: '2026-09-13T15:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }),
    assignment({ id: 'second', state: 'graded', score: 2, updatedAt: '2026-09-13T14:00:00Z' }),
    assignment({ id: 'third', state: 'graded', score: 3, updatedAt: '2026-09-13T13:00:00Z' }),
    assignment({ id: 'fourth', state: 'graded', score: 4, updatedAt: '2026-09-13T12:00:00Z' }),
    assignment({ id: 'fifth', state: 'graded', score: 5, updatedAt: '2026-09-13T11:00:00Z' }),
    assignment({ id: 'sixth', state: 'graded', score: 6, updatedAt: '2026-09-13T10:00:00Z' }),
    assignment({ id: 'null-score', state: 'graded', score: null, updatedAt: '2026-09-13T16:00:00Z' }),
    assignment({ id: 'missing-grade', state: 'graded', score: 10, missing: true, updatedAt: '2026-09-13T16:00:00Z' }),
    assignment({ id: 'redo-grade', state: 'graded', score: 10, redoRequested: true, updatedAt: '2026-09-13T16:00:00Z' }),
    assignment({ id: 'excused-grade', state: 'excused', score: 10, updatedAt: '2026-09-13T16:00:00Z' }),
  ];

  const result = Work.insights(items, {}, { now: NOW });
  assert.deepEqual(result.recentGrades.map(item => item.id), ['zero', 'second', 'third', 'fourth', 'fifth']);
});

test('course scope applies to every insight collection and next recommendation', () => {
  const items = [
    assignment({ id: 'course-10', courseId: '10', dueAt: '2026-09-13T17:00:00Z', missing: true }),
    assignment({ id: 'course-20', courseId: '20', dueAt: '2026-09-13T16:30:00Z', missing: true }),
  ];
  const local = {
    'course-10': { plannedDate: '2026-09-13' },
    'course-20': { plannedDate: '2026-09-13' },
  };

  const result = Work.insights(items, local, { now: NOW, courseId: '10' });
  assert.equal(result.next.item.id, 'course-10');
  assert.deepEqual(result.planned.map(item => item.id), ['course-10']);
  assert.deepEqual(result.missing.map(item => item.id), ['course-10']);
});
