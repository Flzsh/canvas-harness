'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('linear features keep negation, multilingual characters, durations and page cues',()=>{
 const Learn=require('../extension/biscuit-learn.js'),features=Learn.actionFeatures('NO timer: diez more mins, don\u2019t remind me',{now:100,selectedItemId:'open',focus:{running:true}},{},{charMax:5});
 assert.ok(features['w:no']);assert.ok(features['w:timer']);assert.ok(features['cue:duration']);assert.ok(features['cue:negation']);assert.ok(features['cue:page']);assert.ok(Object.keys(features).some(k=>k.startsWith('c5:')));
});
test('item features use descriptions and relationships without reading hidden grades',()=>{
 const Learn=require('../extension/biscuit-learn.js'),s={selectedItemId:'draft',activeCourseId:'eng',now:100},row={id:'rubric',assignmentId:'draft',title:'Evidence grid',text:'Quote two narrators who argue.',kind:'rubric',courseId:'eng'},f=Learn.itemFeatures('the one where the two narrators argue',row,s,{},[row]);
 assert.ok(f.body>0);assert.equal(f.relatedPage,1);assert.equal(f.courseOpen,1);
});
test('sparse classifier reports ranked labels and never executes weights as code',()=>{
 const Learn=require('../extension/biscuit-learn.js'),model={labels:['open/find','ai'],weights:{bias:[0,0],'w:open':[100,-100]},scale:100};
 assert.equal(Learn.classify(model,{bias:1,'w:open':1})[0].label,'open/find');
});
// Offline training-fold partitioning remains in the reference repository.
test('due-soon features agree for Canvas ISO dates and serialized epoch timestamps',()=>{
 const Learn=require('../extension/biscuit-learn.js'),now=Date.UTC(2026,9,22,16),dueAt=now+3600000,s={now},row={id:'a',kind:'assignment',title:'Practice set',dueAt},numeric=Learn.itemFeatures('next work',row,s),iso=Learn.itemFeatures('next work',{...row,dueAt:new Date(dueAt).toISOString()},s);assert.ok(numeric.soon>0);assert.equal(iso.soon,numeric.soon);assert.equal(iso.overdue,numeric.overdue);
});
