'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{mount,settle}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-02: in a course, the New chip counted every course's new work, and opening it marked every course's work seen.
const newChip=html=>html.match(/data-rd-action="glance"[^>]*data-mode="new"[^>]*>[\s\S]*?<b>(\d+)<\/b>/)?.[1];
test('B1-02 the New chip counts only the chosen course, and opening it leaves other courses new',async()=>{
 const f=mount({initialState:{courseId:'7'},seen:{ids:[],graded:[]}});await settle();
 assert.equal(newChip(f.html()),'1','one new item in Chemistry, not two');
 f.click('glance',{mode:'new'});await settle();
 const record=JSON.parse(f.local.get('reserve:seen-work:5'));
 assert.ok(record.ids.includes('17'),'the Chemistry item shown is seen now');
 assert.ok(!record.ids.includes('18'),'History work never shown stays new');
 f.view.destroy();
});
test('B1-02 under All courses New still counts and marks every course',async()=>{
 const f=mount({seen:{ids:[],graded:[]}});await settle();
 assert.equal(newChip(f.html()),'2');
 f.click('glance',{mode:'new'});await settle();
 assert.deepEqual(JSON.parse(f.local.get('reserve:seen-work:5')).ids.sort(),['17','18']);
 f.view.destroy();
});
test('B1-02 a mark for work this refresh did not list (a course that failed to load) is kept',async()=>{
 const f=mount({seen:{ids:['99'],graded:[]}});await settle();
 f.click('glance',{mode:'new'});await settle();
 assert.ok(JSON.parse(f.local.get('reserve:seen-work:5')).ids.includes('99'));
 f.view.destroy();
});
