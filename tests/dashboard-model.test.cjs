const test = require('node:test');
const assert = require('node:assert/strict');

global.ReserveCore = require('../extension/core.js');
const Model = require('../extension/dashboard-model.js');

function assignment(overrides = {}) {
  return {
    id: '1',
    courseId: '10',
    courseName: 'Chemistry',
    name: 'Practice',
    dueAt: '2026-09-14T16:00:00Z',
    state: 'unsubmitted',
    missing: false,
    redoRequested: false,
    ...overrides,
  };
}

test('exports the classic-script/CommonJS dashboard-model API', () => {
  assert.equal(global.ReserveDashboardModel, Model);
  for (const name of ['filterAssignments', 'summary', 'cleanState', 'deadlineHint']) {
    assert.equal(typeof Model[name], 'function', name);
  }
});

test('default actionable keeps future and recent overdue open work with ReserveCore completion semantics', () => {
  const now = Date.parse('2026-09-13T16:00:00Z');
  const items = [
    assignment({ id: 'recent', dueAt: '2026-09-10T16:00:00Z' }),
    assignment({ id: 'old', dueAt: '2026-08-20T16:00:00Z' }),
    assignment({ id: 'future', dueAt: '2026-09-20T16:00:00Z' }),
    assignment({ id: 'undated', dueAt: null }),
    assignment({ id: 'submitted', dueAt: '2026-09-15T16:00:00Z', state: 'submitted' }),
    assignment({ id: 'graded-missing', dueAt: '2026-09-16T16:00:00Z', state: 'graded', missing: true }),
    assignment({ id: 'graded-redo', dueAt: '2026-09-17T16:00:00Z', state: 'graded', redoRequested: true }),
    assignment({ id: 'excused', dueAt: '2026-09-18T16:00:00Z', state: 'excused', missing: true }),
  ];

  const result = Model.filterAssignments(items, { now });
  assert.deepEqual(result.items.map(item => item.id), ['recent', 'graded-missing', 'graded-redo', 'future']);
  assert.equal(result.olderCount, 1);
  assert.equal(result.totalScoped, 8);
  assert.equal(result.searching, false);
});

test('explicit views use open-state rules and local calendar dates', () => {
  const now = Date.parse('2026-09-13T16:00:00Z'); // noon in New York
  const items = [
    assignment({ id: 'earlier-today', dueAt: '2026-09-13T14:00:00Z' }),
    assignment({ id: 'later-today', dueAt: '2026-09-13T20:00:00Z' }),
    assignment({ id: 'tomorrow', dueAt: '2026-09-14T14:00:00Z' }),
    assignment({ id: 'sixth-day', dueAt: '2026-09-19T14:00:00Z' }),
    assignment({ id: 'seventh-day', dueAt: '2026-09-20T14:00:00Z' }),
    assignment({ id: 'old', dueAt: '2026-08-01T14:00:00Z' }),
    assignment({ id: 'done-dated', dueAt: '2026-09-14T15:00:00Z', state: 'submitted' }),
    assignment({ id: 'no-date', dueAt: null }),
    assignment({ id: 'done-no-date', dueAt: null, state: 'graded' }),
  ];

  assert.deepEqual(Model.filterAssignments(items, { now, mode: 'today' }).items.map(x => x.id), ['earlier-today', 'later-today']);
  assert.deepEqual(Model.filterAssignments(items, { now, mode: 'tomorrow' }).items.map(x => x.id), ['tomorrow']);
  assert.deepEqual(Model.filterAssignments(items, { now, mode: 'week' }).items.map(x => x.id), ['earlier-today', 'later-today', 'tomorrow', 'sixth-day']);
  assert.deepEqual(Model.filterAssignments(items, { now, mode: 'upcoming' }).items.map(x => x.id), ['later-today', 'tomorrow', 'sixth-day', 'seventh-day']);
  assert.deepEqual(Model.filterAssignments(items, { now, mode: 'overdue' }).items.map(x => x.id), ['earlier-today']);
  assert.deepEqual(Model.filterAssignments(items, { now, mode: 'dated' }).items.map(x => x.id), ['old', 'earlier-today', 'later-today', 'tomorrow', 'done-dated', 'sixth-day', 'seventh-day']);
  assert.deepEqual(Model.filterAssignments(items, { now, mode: 'undated' }).items.map(x => x.id), ['done-no-date', 'no-date']);
});

test('day filter selects only open assignments on the requested New York calendar date', () => {
  const now = Date.parse('2026-09-13T16:00:00Z');
  const items = [
    assignment({ id: 'late-local', courseId: '10', name: 'Target late', dueAt: '2026-09-14T01:00:00Z' }), // Sep 13, 21:00 EDT
    assignment({ id: 'next-local', courseId: '10', name: 'Target next', dueAt: '2026-09-14T05:00:00Z' }), // Sep 14, 01:00 EDT
    assignment({ id: 'done-local', courseId: '10', name: 'Target done', dueAt: '2026-09-14T02:00:00Z', state: 'submitted' }),
    assignment({ id: 'other-course', courseId: '11', name: 'Target other', dueAt: '2026-09-14T01:30:00Z' }),
  ];

  const result = Model.filterAssignments(items, {
    now,
    day: '2026-09-13',
    courseId: '10',
    query: 'target',
    mode: 'dated',
    timeZone: 'America/New_York',
  });
  assert.deepEqual(result.items.map(x => x.id), ['late-local']);
  assert.equal(result.searching, false);
});

test('actionable search spans old, undated, and completed matches while keeping useful results first', () => {
  const now = Date.parse('2026-09-13T16:00:00Z');
  const items = [
    assignment({ id: 'old', name: 'Archive worksheet', dueAt: '2026-01-10T16:00:00Z' }),
    assignment({ id: 'current', name: 'Archive current', dueAt: '2026-09-14T16:00:00Z' }),
    assignment({ id: 'undated', name: 'Archive reading', dueAt: null }),
    assignment({ id: 'complete', name: 'Archive submitted', dueAt: '2026-09-12T16:00:00Z', state: 'submitted' }),
    assignment({ id: 'other-course', courseId: '99', name: 'Archive elsewhere', dueAt: '2026-09-14T15:00:00Z' }),
  ];

  const result = Model.filterAssignments(items, { now, query: 'archive', courseId: '10' });
  assert.equal(result.searching, true);
  assert.deepEqual(result.items.map(x => x.id), ['current', 'undated', 'old', 'complete']);
  assert.equal(result.totalScoped, 4);

  const explicit = Model.filterAssignments(items, { now, mode: 'upcoming', query: 'archive', courseId: '10' });
  assert.equal(explicit.searching, false);
  assert.deepEqual(explicit.items.map(x => x.id), ['current']);
});

test('pinned local state gets priority in actionable mode and explicit pinned mode is respected', () => {
  const now = Date.parse('2026-09-13T16:00:00Z');
  const items = [
    assignment({ id: 'soon', dueAt: '2026-09-14T16:00:00Z' }),
    assignment({ id: 'pinned-later', dueAt: '2026-09-20T16:00:00Z' }),
    assignment({ id: 'pinned-done', dueAt: '2026-09-12T16:00:00Z', state: 'graded' }),
  ];
  const local = { 'pinned-later': { pinned: true }, 'pinned-done': { pinned: true } };

  assert.deepEqual(Model.filterAssignments(items, { now, local }).items.map(x => x.id), ['pinned-later', 'soon']);
  assert.deepEqual(Model.filterAssignments(items, { now, mode: 'pinned', local }).items.map(x => x.id), ['pinned-done', 'pinned-later']);
});

test('summary respects New York date boundaries near UTC midnight', () => {
  const now = Date.parse('2026-09-14T02:30:00Z'); // Sep 13, 22:30 EDT
  const items = [
    assignment({ id: 'today-overdue', dueAt: '2026-09-14T01:00:00Z' }),
    assignment({ id: 'today-later', dueAt: '2026-09-14T03:00:00Z' }),
    assignment({ id: 'tomorrow', dueAt: '2026-09-14T04:30:00Z' }),
    assignment({ id: 'undated', dueAt: null }),
    assignment({ id: 'done', dueAt: '2026-09-14T03:30:00Z', state: 'submitted' }),
  ];

  assert.deepEqual(Model.summary(items, { now, timeZone: 'America/New_York' }), {
    today: 2,
    tomorrow: 1,
    week: 3,
    overdue: 1,
    undated: 1,
  });
});

test('week uses calendar dates across the spring DST transition', () => {
  const now = Date.parse('2026-03-08T04:30:00Z'); // Mar 7, 23:30 EST; DST begins Mar 8
  const items = [
    assignment({ id: 'today', dueAt: '2026-03-08T04:45:00Z' }),
    assignment({ id: 'day-six', dueAt: '2026-03-13T16:00:00Z' }),
    assignment({ id: 'day-seven', dueAt: '2026-03-14T16:00:00Z' }),
  ];

  assert.deepEqual(Model.filterAssignments(items, { now, mode: 'week', timeZone: 'America/New_York' }).items.map(x => x.id), ['today', 'day-six']);
  assert.equal(Model.summary(items, { now, timeZone: 'America/New_York' }).week, 2);
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

test('cleanState ignores inherited/hostile values, validates dates, and clamps limits', () => {
  assert.equal(Model.cleanState({mode:'constructor'}).mode,'actionable');
  assert.equal(Model.cleanState({mode:'toString'}).mode,'actionable');
  const hostile = Object.create({ mode: 'overdue', courseId: '99', day: '2026-09-13' });
  hostile.query = ['not', 'text'];
  hostile.limit = 999;
  hostile.mode = 'javascript:alert(1)';
  hostile.courseId = '__proto__';
  hostile.day = '2026-02-29';

  assert.deepEqual(Model.cleanState(hostile), {
    query: '',
    courseId: 'all',
    mode: 'actionable',
    day: '',
    limit: 500,
  });

  assert.deepEqual(Model.cleanState({ query: 'x'.repeat(250), courseId: '0012', mode: 'week', day: '2028-02-29', limit: 12 }), {
    query: 'x'.repeat(200),
    courseId: '0012',
    mode: 'week',
    day: '2028-02-29',
    limit: 60,
  });
});

test('deadlineHint is timezone-aware, contextual, and completion-safe', () => {
  const now = Date.parse('2026-09-13T16:00:00Z'); // Sep 13, 12:00 EDT
  const options = { now, timeZone: 'America/New_York' };

  assert.equal(Model.deadlineHint(assignment({ dueAt: '2026-09-13T16:35:00Z' }), options), 'Due in 35 min');
  assert.equal(Model.deadlineHint(assignment({ dueAt: '2026-09-13T18:00:00Z' }), options), 'Due in 2 h');
  assert.equal(Model.deadlineHint(assignment({ dueAt: '2026-09-14T13:00:00Z' }), options), 'Due tomorrow');
  assert.equal(Model.deadlineHint(assignment({ dueAt: '2026-09-13T14:00:00Z' }), options), 'Overdue by 2 h');
  assert.equal(Model.deadlineHint(assignment({ dueAt: '2026-09-13T15:59:59Z' }), options), 'Overdue by 1 min');
  assert.equal(Model.deadlineHint(assignment({ dueAt: null }), options), 'No due date');
  assert.equal(Model.deadlineHint(assignment({ state: 'submitted' }), options), 'Submitted');
  assert.equal(Model.deadlineHint(assignment({ state: 'graded' }), options), 'Graded');
  assert.equal(Model.deadlineHint(assignment({ state: 'excused', missing: true, dueAt: '2026-09-13T14:00:00Z' }), options), 'Excused');
  assert.equal(Model.deadlineHint(assignment({ state: 'graded', missing: true, dueAt: '2026-09-13T14:00:00Z' }), options), 'Overdue by 2 h');
  assert.notEqual(Model.deadlineHint(assignment({ dueAt: '2026-09-13T15:59:59Z' }), options), 'Due now');
});
test('daily plan and hand-in views preserve the distinction between personal progress and Canvas state',()=>{
 const now=Date.parse('2026-09-14T02:00:00Z');
 const items=[assignment({id:'ready',dueAt:null}),assignment({id:'sent',state:'submitted'}),assignment({id:'redo',state:'graded',redoRequested:true,dueAt:'2026-09-14T12:00:00Z'}),assignment({id:'excused',state:'excused',missing:true})];
 const local={ready:{plannedDate:'2026-09-13',progress:'done'},sent:{plannedDate:'2026-09-13',progress:'done'}};
 assert.deepEqual(Model.filterAssignments(items,{mode:'planned',local,now}).items.map(x=>x.id),['ready']);
 assert.deepEqual(Model.filterAssignments(items,{mode:'ready',local,now}).items.map(x=>x.id),['ready']);
 assert.deepEqual(Model.filterAssignments(items,{mode:'missing',local,now}).items.map(x=>x.id),['redo']);
 assert.ok(Model.filterAssignments(items,{mode:'completed',local,now}).items.every(x=>['sent','excused'].includes(x.id)));
});

test('an undated personal reminder planned today is actionable without changing its deadline',()=>{
 const M=require('../extension/dashboard-model.js'),now=Date.parse('2026-09-14T16:00:00Z');const items=[{id:'local-today',personal:true,name:'Read',courseId:'7',state:'personal',dueAt:null},{id:'local-later',personal:true,name:'Later',courseId:'7',state:'personal',dueAt:null},{id:'17',personal:false,name:'Canvas undated',courseId:'7',state:'unsubmitted',dueAt:null}];
 const local={'local-today':{plannedDate:'2026-09-14'},'local-later':{plannedDate:'2026-09-15'}};
 assert.deepEqual(M.filterAssignments(items,{now,local,timeZone:'America/New_York',mode:'actionable'}).items.map(x=>x.id),['local-today']);assert.equal(items[0].dueAt,null);
});
