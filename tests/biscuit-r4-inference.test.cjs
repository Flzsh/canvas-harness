'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Learn=require('../extension/biscuit-learn.js');
const model=(labels,bias)=>({labels,scale:1,weights:{bias}}),pack=(action,extra={})=>({schemaVersion:1,tier:'basic',features:{charMax:3},models:{action:model([action],[10]),item:model(['yes'],[0]),kind:model(['notes'],[10]),context:model(['yes'],[-100]),...extra},patterns:[],thresholds:{context:.45}}),s=()=>({now:Date.parse('2026-10-22T16:00:00Z'),timeZone:'America/New_York',ai:true,settings:{showGrades:true},selectedItemId:'work',courses:[{id:'c',name:'History'}],assignments:[{id:'work',title:'Two narrators',courseId:'c',instructions:'Compare both voices.'}],rubrics:[{id:'grid',assignmentId:'work',courseId:'c',title:'Voice rubric',body:'Evidence: quote both narrators.'}]});
test('learned decisions run through the real engine and select item using model features',()=>{
 const Engine=require('../extension/biscuit-engine.js'),p=pack('open/find');p.models.item.weights={'title':[3],'relatedPage':[2]};const r=Engine.create({pack:p}).evaluate('the two narrators',s());assert.equal(r.next.fields.itemId,'work');assert.equal(r.route,'local');assert.ok(r.understanding?.learned);
});
test('AI context selection uses exact selected sources and study prompt construction',()=>{
 const Engine=require('../extension/biscuit-engine.js'),p=pack('ai');p.models.context.weights={page:[10],bias:[-5]};const r=Engine.create({pack:p}).evaluate('prepare notes using this assignment',s());assert.equal(r.route,'ai');assert.deepEqual(r.handoff.contextIds,['work']);assert.equal(r.handoff.kind,'notes');assert.ok(r.handoff.prompt.includes('Compare both voices.'));assert.ok(!r.handoff.prompt.includes('Evidence: quote both narrators.'));
});
test('a learned mutation cannot override negation or disabled AI',()=>{
 const Engine=require('../extension/biscuit-engine.js');assert.notEqual(Engine.create({pack:pack('complete')}).evaluate("do not mark this complete",s()).action,'complete');const world=s();world.ai=false;assert.notEqual(Engine.create({pack:pack('ai')}).evaluate('write a summary',world).route,'ai');
});
test('learned planning can build a proposal without shadowing its operation fields',()=>{
 const Engine=require('../extension/biscuit-engine.js'),r=Engine.create({pack:pack('plan')}).evaluate('fit my loaded work into tonight',s());assert.equal(r.action,'plan');assert.equal(r.route,'local');
});
test('negation inside an explicitly saved note remains literal payload',()=>{
 const Engine=require('../extension/biscuit-engine.js'),r=Engine.create({pack:pack('note')}).evaluate('note: do not stop focus when the robot crosses the line',s());assert.equal(r.action,'note');assert.equal(r.next.fields.text,'do not stop focus when the robot crosses the line');
});
test('parser rejections and negated feature commands cannot become learned writes',()=>{
 const Engine=require('../extension/biscuit-engine.js'),p=pack('feature',{'detail:feature':model(['{"id":"ai","on":true}'],[10])}),E=Engine.create({pack:p});
 for(const line of ["don't enable AI",'do not disable motion','what if I enable AI?'])assert.notEqual(E.evaluate(line,s()).action,'feature');
});
test('earned totals never enter AI source labels or instructional prompt metadata',()=>{
 const Engine=require('../extension/biscuit-engine.js'),world=s(),p=pack('ai');world.assignments=[];world.rubrics=[];world.courseGrades=[{id:'total',title:'Chemistry 82%',courseId:'c',currentPercent:82}];world.selectedItemId='total';p.models.context.weights={bias:[10]};const r=Engine.create({pack:p}).evaluate('prepare study notes',world);assert.equal(r.route,'ai');assert.ok(!JSON.stringify(r.handoff).includes('82'));
});
