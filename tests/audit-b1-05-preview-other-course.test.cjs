'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{mount,settle}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-05: with one course chosen, opening another course's item (a Planner card, the Clock module's next due) switched
// the list to "All dated" and closed the reader on a different item instead of showing the one asked for.
test('B1-05 a preview of another course\'s item opens it instead of switching the list and closing the reader',async()=>{
 const f=mount({initialState:{courseId:'7'}});await settle();
 f.click('preview',{id:'18'});await settle();
 const state=f.view.getState();
 assert.equal(state.selectedId,'18','the History item is the one shown');
 assert.equal(state.readerOpen,true,'its reader is open');
 assert.equal(state.courseId,'all');
 f.view.destroy();
});
test('B1-05 a preview inside the chosen course keeps the course',async()=>{
 const f=mount({initialState:{courseId:'7'}});await settle();
 f.click('preview',{id:'17'});await settle();
 const state=f.view.getState();
 assert.equal(state.courseId,'7');assert.equal(state.selectedId,'17');assert.equal(state.readerOpen,true);
 f.view.destroy();
});
