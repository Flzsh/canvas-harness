'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{NOW,mount,settle}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-07: from All courses, the Materials and Course hub tabs open the chosen item's course; when that item was a personal
// reminder (course "personal") they opened on "Choose a course" instead of a course.
test('B1-07 Materials opens the first course when a personal reminder is the chosen item',async()=>{
 const f=mount({personal:{customTasks:[{id:'local-a',name:'Read my notes',courseId:'personal',dueAt:new Date(NOW+5*3600000).toISOString(),createdAt:new Date(NOW-86400000).toISOString()}]}});
 await settle();
 f.click('workspace',{tab:'materials'});await settle();
 const state=f.view.getState();
 assert.equal(state.workspace,'materials');
 assert.equal(state.courseId,'7','a course is chosen, not "Choose a course"');
 f.view.destroy();
});
