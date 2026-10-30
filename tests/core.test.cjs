const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const corePath = path.join(__dirname, '..', 'extension', 'core.js');
const Core = fs.existsSync(corePath) ? require(corePath) : {};

function assignment(overrides = {}) {
  return {
    id: 'a-1',
    courseId: 'c-1',
    courseName: 'Biology',
    name: 'Cell essay',
    description: '',
    dueAt: '2026-09-12T16:00:00Z',
    unlockAt: null,
    lockAt: null,
    url: '/courses/c-1/assignments/a-1',
    points: 10,
    score: null,
    grade: null,
    state: 'unsubmitted',
    missing: false,
    late: false,
    redoRequested: false,
    hasSubmission: false,
    locked: false,
    submissionTypes: ['online_upload'],
    rubric: [],
    updatedAt: null,
    ...overrides,
  };
}

test('exports the required classic-script/CommonJS API', () => {
  const names = [
    'normalizeCourse',
    'normalizeAssignment',
    'dayKey',
    'dueBucket',
    'isComplete',
    'selectAssignments',
    'exportICS',
  ];

  for (const name of names) assert.equal(typeof Core[name], 'function', name);
  assert.equal(globalThis.ReserveCore, Core);
});

test('normalizeCourse preserves a real zero score and current grade', () => {
  const course = Core.normalizeCourse({
    id: 17,
    name: 'Chemistry',
    course_code: 'CHEM',
    enrollments: [{ computed_current_score: 0, computed_current_grade: 'F' }],
  });

  assert.equal(course.id, '17');
  assert.equal(course.score, 0);
  assert.equal(course.grade, 'F');
  assert.equal(course.url, '/courses/17');
});

test('normalizeCourse keeps absent scores null and never averages enrollments', () => {
  const missing = Core.normalizeCourse({ id: 1, enrollments: [{}] });
  const multiple = Core.normalizeCourse({
    id: 2,
    enrollments: [
      { computed_current_score: 84, computed_current_grade: 'B' },
      { computed_current_score: 96, computed_current_grade: 'A' },
    ],
  });

  assert.equal(missing.score, null);
  assert.equal(missing.grade, null);
  assert.equal(multiple.score, 84);
  assert.notEqual(multiple.score, 90);
});

test('normalizeCourse never mixes a score and grade from different enrollment records', () => {
  const course = Core.normalizeCourse({
    id: 3,
    enrollments: [
      { computed_current_grade: 'A' },
      { computed_current_score: 96 },
    ],
  });

  assert.equal(course.score, null);
  assert.equal(course.grade, 'A');
});

test('normalizeCourse ignores teacher and observer totals when a student enrollment exists', () => {
  const course = Core.normalizeCourse({
    id: 4,
    enrollments: [
      { type: 'TeacherEnrollment', computed_current_score: 100, computed_current_grade: 'A+' },
      { type: 'ObserverEnrollment', computed_current_score: 99, computed_current_grade: 'A+' },
      { type: 'StudentEnrollment', computed_current_score: 88, computed_current_grade: 'B+' },
    ],
  });

  assert.equal(course.score, 88);
  assert.equal(course.grade, 'B+');
  assert.equal(course.scoreScope, 'overall');
});

test('normalizeCourse selects documented current grading-period totals without falling back to overall', () => {
  const course = Core.normalizeCourse({
    id: 5,
    hide_final_grades: false,
    enrollments: [
      {
        type: 'StudentEnrollment',
        computed_current_score: 91,
        computed_current_grade: 'A-',
        current_grading_period_id: 27,
        current_grading_period_title: 'Fall 1',
        current_period_computed_current_score: null,
        current_period_computed_current_grade: null,
      },
    ],
  });

  assert.equal(course.score, null);
  assert.equal(course.grade, null);
  assert.equal(course.scoreScope, 'current-period');
  assert.equal(course.gradingPeriodId, '27');
  assert.equal(course.gradingPeriodTitle, 'Fall 1');
  assert.equal(course.overallScore, 91);
  assert.equal(course.overallGrade, 'A-');
});

test('normalizeCourse keeps demo-style overall totals when no grading-period data exists', () => {
  const course = Core.normalizeCourse({
    id: 6,
    enrollments: [{ computed_current_score: 93, computed_current_grade: 'A' }],
  });

  assert.equal(course.score, 93);
  assert.equal(course.grade, 'A');
  assert.equal(course.scoreScope, 'overall');
  assert.equal(course.gradingPeriodId, null);
  assert.equal(course.overallScore, 93);
});

test('normalizeCourse respects hide_final_grades even if score fields are present', () => {
  const course = Core.normalizeCourse({
    id: 7,
    hide_final_grades: true,
    enrollments: [
      {
        type: 'StudentEnrollment',
        computed_current_score: 98,
        computed_current_grade: 'A+',
        current_grading_period_id: 9,
        current_period_computed_current_score: 97,
        current_period_computed_current_grade: 'A+',
      },
    ],
  });

  assert.equal(course.score, null);
  assert.equal(course.grade, null);
  assert.equal(course.overallScore, null);
  assert.equal(course.overallGrade, null);
  assert.equal(course.scoreScope, 'hidden');
  assert.equal(course.hideFinalGrades, true);
});

test('normalizeAssignment trusts the current user submission, not has_submitted_submissions', () => {
  const item = Core.normalizeAssignment(
    {
      id: 9,
      name: 'Lab',
      due_at: '2026-09-14T03:59:00Z',
      has_submitted_submissions: true,
      submission_types: ['online_upload'],
      submission: {
        workflow_state: 'unsubmitted',
        missing: true,
        late: false,
        score: 0,
      },
    },
    { id: 4, name: 'Physics' },
  );

  assert.equal(item.state, 'unsubmitted');
  assert.equal(item.missing, true);
  assert.equal(item.score, 0);
});

test('normalizeAssignment marks paper work with no user submission evidence unknown', () => {
  const item = Core.normalizeAssignment(
    {
      id: 10,
      name: 'Notebook check',
      submission_types: ['on_paper'],
      has_submitted_submissions: true,
    },
    { id: 4, name: 'Physics' },
  );

  assert.equal(item.state, 'unknown');
  assert.equal(item.missing, false);
  assert.equal(item.late, false);
});

test('normalizeAssignment treats an online assignment without submission evidence as unsubmitted', () => {
  const item = Core.normalizeAssignment(
    { id: 11, submission_types: ['online_text_entry'] },
    { id: 4, name: 'Physics' },
  );

  assert.equal(item.state, 'unsubmitted');
});

test('normalizeAssignment keeps a graded-but-missing zero-attempt submission actionable and preserves grade', () => {
  const item = Core.normalizeAssignment(
    {
      id: 13,
      due_at: '2026-09-10T16:00:00Z',
      submission_types: ['online_upload'],
      submission: {
        workflow_state: 'graded',
        missing: true,
        attempt: 0,
        submitted_at: null,
        score: 0,
        grade: '0',
      },
    },
    { id: 4, name: 'Physics' },
  );

  assert.equal(item.state, 'graded');
  assert.equal(item.missing, true);
  assert.equal(item.hasSubmission, false);
  assert.equal(item.score, 0);
  assert.equal(item.grade, '0');
  assert.equal(Core.isComplete(item), false);
});

test('normalizeAssignment exposes redo requests and keeps reassigned graded work actionable', () => {
  const item = Core.normalizeAssignment(
    {
      id: 14,
      due_at: '2026-09-12T16:00:00Z',
      submission_types: ['online_upload'],
      submission: {
        workflow_state: 'graded',
        missing: false,
        redo_request: true,
        attempt: 1,
        submitted_at: '2026-09-10T14:00:00Z',
        score: 8,
        grade: '8',
      },
    },
    { id: 4, name: 'Physics' },
  );

  assert.equal(item.redoRequested, true);
  assert.equal(item.hasSubmission, true);
  assert.equal(item.state, 'graded');
  assert.equal(Core.isComplete(item), false);
});

test('isComplete lets excused take precedence over missing or redo flags and rejects prototype-like states', () => {
  assert.equal(
    Core.isComplete(assignment({ state: 'excused', missing: true, redoRequested: true })),
    true,
  );
  assert.equal(Core.isComplete(assignment({ state: 'toString' })), false);
  assert.equal(Core.isComplete(assignment({ state: 'constructor' })), false);
});

test('personal completion uses only the explicit personal done state while Canvas completion semantics stay unchanged', () => {
  assert.equal(Core.isComplete({ personal: true, state: 'done' }), true);
  assert.equal(Core.isComplete({ personal: true, state: 'personal' }), false);
  assert.equal(Core.isComplete({ personal: true, state: 'graded' }), false);
  assert.equal(Core.isComplete(assignment({ state: 'done', progress: 'done' })), false);
  assert.equal(Core.isComplete(assignment({ state: 'graded', progress: 'done' })), true);
});

test('normalizeAssignment validates dates and copies arrays without sharing them', () => {
  const types = ['online_upload'];
  const rubric = [{ id: 'r1', points: 5 }];
  const item = Core.normalizeAssignment(
    {
      id: 12,
      due_at: '',
      unlock_at: 'not-a-date',
      lock_at: '2026-09-13T12:00:00Z',
      updated_at: '2026-09-11T12:00:00Z',
      submission_types: types,
      rubric,
      points_possible: 0,
    },
    { id: 4, name: 'Physics' },
  );

  assert.equal(item.dueAt, null);
  assert.equal(item.unlockAt, null);
  assert.equal(item.lockAt, '2026-09-13T12:00:00.000Z');
  assert.equal(item.updatedAt, '2026-09-11T12:00:00.000Z');
  assert.equal(item.points, 0);
  assert.deepEqual(item.submissionTypes, types);
  assert.deepEqual(item.rubric, rubric);
  assert.notEqual(item.submissionTypes, types);
  assert.notEqual(item.rubric, rubric);
});

test('dayKey uses the requested timezone near a UTC date boundary', () => {
  assert.equal(
    Core.dayKey('2026-09-12T02:30:00Z', 'America/New_York'),
    '2026-09-11',
  );
  assert.equal(Core.dayKey('invalid', 'America/New_York'), null);
});

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
  for (let pass = 0; pass < 2; pass += 1) assert.throws(() => Core.dayKey(instant, 'Not/AZone'), RangeError);
});

test('dueBucket makes a past instant overdue even when it is still today', () => {
  const now = Date.parse('2026-09-11T16:00:00Z');
  const item = assignment({ dueAt: '2026-09-11T15:59:59Z' });

  assert.equal(Core.dueBucket(item, now, 'America/New_York'), 'overdue');
});

test('dueBucket respects calendar midnight and DST instead of 24-hour arithmetic', () => {
  const beforeSpringForward = Date.parse('2026-03-07T23:30:00-05:00');
  const justAfterMidnight = assignment({ dueAt: '2026-03-08T00:30:00-05:00' });
  const sevenCalendarDays = assignment({ dueAt: '2026-03-14T12:00:00-04:00' });
  const eightCalendarDays = assignment({ dueAt: '2026-03-15T12:00:00-04:00' });

  assert.equal(
    Core.dueBucket(justAfterMidnight, beforeSpringForward, 'America/New_York'),
    'tomorrow',
  );
  assert.equal(
    Core.dueBucket(sevenCalendarDays, beforeSpringForward, 'America/New_York'),
    'week',
  );
  assert.equal(
    Core.dueBucket(eightCalendarDays, beforeSpringForward, 'America/New_York'),
    'later',
  );
});

test('Canvas completion state wins over deadline buckets', () => {
  const now = Date.parse('2026-09-11T16:00:00Z');

  for (const state of ['submitted', 'graded', 'excused']) {
    const item = assignment({ state, dueAt: '2026-09-01T12:00:00Z' });
    assert.equal(Core.isComplete(item), true, state);
    assert.equal(Core.dueBucket(item, now, 'America/New_York'), 'completed', state);
  }
  assert.equal(Core.isComplete(assignment({ state: 'unknown' })), false);
});

test('selectAssignments open excludes Canvas-complete work but keeps locally done work', () => {
  const items = [
    assignment({ id: 'open', name: 'Open' }),
    assignment({ id: 'local-done', name: 'Local done' }),
    assignment({ id: 'submitted', name: 'Submitted', state: 'submitted' }),
  ];

  const result = Core.selectAssignments(items, {
    view: 'open',
    local: { 'local-done': { progress: 'done' } },
  });

  assert.deepEqual(result.map((item) => item.id), ['local-done', 'open']);
});

test('selectAssignments normalizes diacritics in search and filters by course', () => {
  const items = [
    assignment({ id: '1', courseId: 'eth', courseName: 'Philosophy', name: 'Éthique reflection' }),
    assignment({ id: '2', courseId: 'bio', courseName: 'Biología', name: 'Lab' }),
  ];

  assert.deepEqual(
    Core.selectAssignments(items, { query: 'ethique', view: 'all' }).map((item) => item.id),
    ['1'],
  );
  assert.deepEqual(
    Core.selectAssignments(items, { query: 'biologia', courseId: 'bio', view: 'all' }).map((item) => item.id),
    ['2'],
  );
});

test('selectAssignments week view includes today, tomorrow, and the seven-day bucket only', () => {
  const now = Date.parse('2026-09-11T16:00:00Z');
  const items = [
    assignment({ id: 'today', dueAt: '2026-09-11T20:00:00Z' }),
    assignment({ id: 'tomorrow', dueAt: '2026-09-12T20:00:00Z' }),
    assignment({ id: 'week', dueAt: '2026-09-18T20:00:00Z' }),
    assignment({ id: 'later', dueAt: '2026-09-19T20:00:00Z' }),
    assignment({ id: 'undated', dueAt: null }),
  ];

  assert.deepEqual(
    Core.selectAssignments(items, { view: 'week', now, timeZone: 'America/New_York' }).map((item) => item.id),
    ['today', 'tomorrow', 'week'],
  );
});

test('selectAssignments today includes earlier overdue work from the same local day', () => {
  const now = Date.parse('2026-09-11T16:00:00Z');
  const items = [
    assignment({ id: 'earlier-today', dueAt: '2026-09-11T13:00:00Z' }),
    assignment({ id: 'later-today', dueAt: '2026-09-11T20:00:00Z' }),
    assignment({ id: 'yesterday', dueAt: '2026-09-10T20:00:00Z' }),
  ];

  assert.deepEqual(
    Core.selectAssignments(items, { view: 'today', now, timeZone: 'America/New_York' }).map((item) => item.id),
    ['earlier-today', 'later-today'],
  );
});

test('selectAssignments week includes overdue earlier today but excludes older overdue work', () => {
  const now = Date.parse('2026-09-11T16:00:00Z');
  const items = [
    assignment({ id: 'older-overdue', dueAt: '2026-09-10T20:00:00Z' }),
    assignment({ id: 'earlier-today', dueAt: '2026-09-11T13:00:00Z' }),
    assignment({ id: 'tomorrow', dueAt: '2026-09-12T20:00:00Z' }),
    assignment({ id: 'week', dueAt: '2026-09-18T20:00:00Z' }),
  ];

  assert.deepEqual(
    Core.selectAssignments(items, { view: 'week', now, timeZone: 'America/New_York' }).map((item) => item.id),
    ['older-overdue', 'earlier-today', 'tomorrow', 'week'].filter((id) => id !== 'older-overdue'),
  );
});

test('selectAssignments in-progress excludes truly complete Canvas work but keeps redo work', () => {
  const items = [
    assignment({ id: 'open' }),
    assignment({ id: 'submitted', state: 'submitted' }),
    assignment({ id: 'redo', state: 'graded', redoRequested: true }),
  ];
  const local = {
    open: { progress: 'in-progress' },
    submitted: { progress: 'in-progress' },
    redo: { progress: 'in-progress' },
  };

  assert.deepEqual(
    Core.selectAssignments(items, { view: 'in-progress', local }).map((item) => item.id),
    ['open', 'redo'],
  );
});

test('selectAssignments due sorting puts known dates first, uses name/id ties, and does not mutate input', () => {
  const items = [
    assignment({ id: 'u', name: 'Undated', dueAt: null }),
    assignment({ id: 'b', name: 'Beta', dueAt: '2026-09-13T12:00:00Z' }),
    assignment({ id: 'z', name: 'Alpha', dueAt: '2026-09-13T12:00:00Z' }),
    assignment({ id: 'a', name: 'Alpha', dueAt: '2026-09-13T12:00:00Z' }),
    assignment({ id: 'early', name: 'Early', dueAt: '2026-09-12T12:00:00Z' }),
  ];
  const before = JSON.stringify(items);

  const result = Core.selectAssignments(items, { view: 'all', sort: 'due' });

  assert.deepEqual(result.map((item) => item.id), ['early', 'a', 'z', 'b', 'u']);
  assert.equal(JSON.stringify(items), before);
  assert.notEqual(result, items);
});

test('selectAssignments points and priority sorting honor null-last and pins-first', () => {
  const items = [
    assignment({ id: 'null', name: 'Null', points: null, dueAt: null }),
    assignment({ id: 'zero', name: 'Zero', points: 0, dueAt: '2026-09-12T12:00:00Z' }),
    assignment({ id: 'ten', name: 'Ten', points: 10, dueAt: '2026-09-13T12:00:00Z' }),
    assignment({ id: 'pin', name: 'Pinned', points: 1, dueAt: null }),
  ];
  const local = { pin: { pinned: true } };

  assert.deepEqual(
    Core.selectAssignments(items, { view: 'all', sort: 'points', local }).map((item) => item.id),
    ['ten', 'pin', 'zero', 'null'],
  );
  assert.deepEqual(
    Core.selectAssignments(items, { view: 'all', sort: 'priority', local }).map((item) => item.id),
    ['pin', 'zero', 'ten', 'null'],
  );
});

test('exportICS emits CRLF UTC events, stable course-aware UIDs, and skips completed/undated work', () => {
  const items = [
    assignment({ id: 'same', courseId: 'c1', name: 'One', dueAt: '2026-09-12T16:05:06Z' }),
    assignment({ id: 'same', courseId: 'c2', name: 'Two', dueAt: '2026-09-13T17:06:07Z' }),
    assignment({ id: 'done', state: 'graded', dueAt: '2026-09-14T18:00:00Z' }),
    assignment({ id: 'none', dueAt: null }),
  ];
  const ics = Core.exportICS(items, { now: Date.parse('2026-09-11T12:34:56Z') });

  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTAMP:20260911T123456Z\r\n/);
  assert.match(ics, /DTSTART:20260912T160506Z\r\n/);
  assert.match(ics, /UID:[^\r\n]*c1[^\r\n]*same/);
  assert.match(ics, /UID:[^\r\n]*c2[^\r\n]*same/);
  assert.doesNotMatch(ics, /done|none/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(ics.endsWith('\r\n'), true);
});

test('exportICS escapes text, replaces unsafe source URLs, and folds UTF-8 lines to 75 octets', () => {
  const longName = `Essay, part; \\ draft\n${'é'.repeat(60)}`;
  const item = assignment({
    id: 'escape',
    courseId: 'course',
    courseName: 'Lit, Seminar; A',
    name: longName,
    description: 'First line\nSecond, line; slash \\',
    url: 'javascript:alert(1)',
  });
  const ics = Core.exportICS([item], {
    now: Date.parse('2026-09-11T12:34:56Z'),
    origin: 'https://school.instructure.com',
  });
  const unfolded = ics.replace(/\r\n[ \t]/g, '');

  assert.match(unfolded, /SUMMARY:Essay\\, part\\; \\\\ draft\\n/);
  assert.match(unfolded, /DESCRIPTION:Lit\\, Seminar\\; A\\nFirst line\\nSecond\\, line\\; slash \\\\.*Source: https:\/\/school.instructure.com\/courses\/course\/assignments\/escape/);
  assert.doesNotMatch(ics, /javascript:/i);
  assert.match(unfolded, /URL:https:\/\/school.instructure.com\/courses\/course\/assignments\/escape/);
  assert.equal(ics.split('\r\n').some((line) => line.startsWith(' ')), true);

  for (const line of ics.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `${Buffer.byteLength(line, 'utf8')} octets: ${line}`);
  }
});

test('exportICS includes graded missing and redo-requested assignments because they remain actionable', () => {
  const items = [
    assignment({ id: 'plain-graded', state: 'graded' }),
    assignment({ id: 'missing-graded', state: 'graded', missing: true }),
    assignment({ id: 'redo-graded', state: 'graded', redoRequested: true }),
    assignment({ id: 'excused-redo', state: 'excused', redoRequested: true }),
  ];

  const ics = Core.exportICS(items, { now: Date.parse('2026-09-11T12:34:56Z') });

  assert.doesNotMatch(ics, /plain-graded|excused-redo/);
  assert.match(ics, /missing-graded/);
  assert.match(ics, /redo-graded/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
});
