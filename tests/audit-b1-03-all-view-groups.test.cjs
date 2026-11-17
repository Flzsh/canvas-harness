'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{mount,settle}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-03: on the Assignments page (All), work already late today made a "Due today" group ahead of "Past due", and the
// rest of today's work a second "Due today" group after it.
const work=[
 {id:'31',course_id:'7',name:'Morning lab',due_at:'2026-11-05T13:00:00Z',submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}},
 {id:'32',course_id:'7',name:'Old worksheet',due_at:'2026-11-03T20:00:00Z',submission_types:['online_upload'],submission:{workflow_state:'unsubmitted',missing:true}},
 {id:'33',course_id:'7',name:'Night reading',due_at:'2026-11-06T04:00:00Z',submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}}];
const heads=html=>[...html.matchAll(/class="rd-date-group"[^>]*><span>([^<]+)<\/span>/g)].map(m=>m[1]);
test('B1-03 All keeps one Due today group: work already late today reads as Past due with the other late work',async()=>{
 const f=mount({initialState:{workspace:'assignments'},assignments:work});await settle();
 assert.deepEqual(heads(f.html()),['Past due','Due today']);
 assert.match(f.html(),/Morning lab[\s\S]*?<span aria-hidden="true">Today · 8:00\sAM<\/span>/,'under Past due its time says which day');
 f.view.destroy();
});
test('B1-03 Up next is unchanged: late work due earlier today stays under Due today, in time order',async()=>{
 const f=mount({assignments:work});await settle();
 assert.deepEqual(heads(f.html()),['Past due','Due today']);
 assert.ok(f.html().indexOf('Morning lab')<f.html().indexOf('Night reading'));
 f.view.destroy();
});
