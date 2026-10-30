'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {tick,panelFixture}=require('./study-fixture.cjs');
const scope='https://school.instructure.com|7|c1|a';

test('the message is about the item the student picked, not the item open on the page, with a readable due date',async t=>{
 const catalog={scopeKey:scope,active:{id:'open',title:'Mentor Engagement',courseId:'c2',courseName:'BioDesign',due:'2026-10-20T03:59:59.000Z'},courseId:'c2',courses:[{id:'c1',name:'Latin'},{id:'c2',name:'BioDesign'}],
  sources:[{id:'open',title:'Mentor Engagement',kind:'assignment',courseId:'c2',courseName:'BioDesign'},{id:'quiz',title:'Metamorphoses Quiz II',kind:'assignment',courseId:'c1',courseName:'Latin',due:'2026-10-23T03:59:00.000Z'}],selectedIds:['quiz']};
 const f=panelFixture({catalog});t.after(()=>f.close());await tick();await f.controller.setMode('practice');
 const preview=f.get('ch-study-preview').textContent;
 assert.match(preview,/Metamorphoses Quiz II/);assert.doesNotMatch(preview,/Mentor Engagement/);
 assert.doesNotMatch(preview,/T03:59/,'no raw timestamp');assert.match(preview,/Oct 2[23]/);
});
