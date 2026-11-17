'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{req,NOW,mount,settle}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-01: Canvas practice quizzes and surveys (no assignment of their own: Canvas Harness lists them as quiz-N) could not be
// bookmarked, planned, noted or marked done; the save failed with "Invalid task record in backup."
test('B1-01 storage keeps a local record (bookmark, plan, done) for a practice quiz item quiz-N',async()=>{
 const {createStore}=req('storage.js'),state={},adapter={read:async k=>structuredClone(state[k]),write:async(k,v)=>{state[k]=structuredClone(v);}};
 const store=createStore({accountId:'1',adapter});await store.load();
 await store.update(s=>{s.tasks['quiz-5']={pinned:true,checkedOff:true,plannedDate:'2026-11-05'};});
 assert.equal(store.get().tasks['quiz-5'].pinned,true,'the practice quiz keeps its bookmark');
 assert.equal(store.get().tasks['quiz-5'].checkedOff,true);
 await assert.rejects(store.update(s=>{s.tasks['quiz-x']={pinned:true};}),/Invalid task record/,'other odd ids are still refused');
 store.destroy();
});
test('B1-01 Home bookmarks, plans and takes notes on a practice quiz item quiz-N',async()=>{
 const f=mount({assignments:[{id:'quiz-5',course_id:'7',name:'Practice quiz',due_at:new Date(NOW+86400000).toISOString(),submission_types:['online_quiz'],quiz_id:'5'}]});
 await settle();
 f.click('pin',{id:'quiz-5'});await settle();
 assert.equal(f.data.tasks['quiz-5']?.pinned,true,'Bookmark saves');
 f.click('schedule',{id:'quiz-5',day:'2026-11-05'});await settle();
 assert.equal(f.data.tasks['quiz-5']?.plannedDate,'2026-11-05','Plan for today saves');
 f.events.change({target:{dataset:{rdField:'notes',id:'quiz-5'},value:'Review chapter 4'}});await settle();
 assert.equal(f.data.tasks['quiz-5']?.notes,'Review chapter 4','the note is kept');
 f.view.destroy();
});
test('B1-01 a restored view keeps a practice quiz open in the reader',()=>{
 const Model=req('dashboard-model.js');
 assert.equal(Model.cleanCourseView({selectedId:'quiz-5',readerOpen:true},'7').selectedId,'quiz-5');
});
