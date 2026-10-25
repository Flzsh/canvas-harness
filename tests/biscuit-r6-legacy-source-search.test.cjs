'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ROOT=path.resolve(__dirname,'..'),engineFile=path.join(ROOT,'extension/biscuit-engine.js'),variant=engineFile;
function engine(itemWeights={bias:[0],title:[1000]}){const context={module:{exports:{}},require:require('node:module').createRequire(engineFile),console};vm.runInNewContext(fs.readFileSync(variant,'utf8'),context,{filename:engineFile});const model=labels=>({labels,scale:1000,weights:{bias:labels.map(()=>0)}}),pack={schemaVersion:1,tier:'basic',features:{charMax:0},patterns:[],thresholds:{context:.5},models:{action:model(['bookmark']),kind:model(['ask']),context:model(['yes']),item:{...model(['yes']),weights:itemWeights}}};return context.module.exports.create({pack});}
function snapshot(){return {now:Date.parse('2028-02-07T12:00:00Z'),timeZone:'UTC',showGrades:false,courses:[{id:'writing',name:'Civic Writing'}],assignments:[{id:'a-draft',courseId:'writing',title:'Policy proposal draft',text:'First version of the proposal.'},{id:'z-revision',courseId:'writing',title:'Policy proposal revision',text:'Later version of the proposal.'}]};}
test('legacy learned search honors an explicit positive source contrast before truncating its results',()=>{
 assert.equal(engine().search('bookmark the revision rather than the draft',snapshot())[0].id,'z-revision');
});
test('legacy exact bookmark commands use the same source exclusion as general source requests',()=>{
 const card=engine().evaluate('bookmark the revision rather than the draft',snapshot());assert.equal(card.action,'bookmark');assert.equal(card.next.fields.itemId,'z-revision');
});
test('negative source admission removes excluded titles while preserving the complete feature world',()=>{
 const s=snapshot(),before=JSON.stringify(s),results=engine().search('find the revision instead of the draft',s);assert.ok(results.every(row=>row.id!=='a-draft'));assert.equal(results[0].id,'z-revision');assert.equal(JSON.stringify(s),before);
});
test('public source search keeps its read-only ranking actor when the query contains timer wording',()=>{const s=snapshot();s.assignments=[{id:'authored-timer-work',courseId:'writing',title:'Focus 17 minutes notes',text:'Timer reference.'}];s.files=[{id:'authored-timer-guide',courseId:'writing',title:'Focus 17 minutes guide',text:'Timer reference.'}];assert.equal(engine({bias:[0],'role:open/find|title|file':[100000],'role:focus|title|assignment':[100000]}).search('focus 17 minutes',s)[0].id,'authored-timer-guide');});
