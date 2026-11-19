'use strict';
// Owner, 2026-10-26: instructions for one card or for all cards, carried through future AI, and the student sees all of
// them. Notes are saved with the account's study cards; each help gets the ones that apply to it.
const {test}=require('node:test'),assert=require('node:assert/strict');
const UI=require('../extension/study-ui.js'),S=require('../extension/study-prompts.js'),{storage}=require('./study-fixture.cjs');
const scope='https://school.instructure.com|7';

test('notes are added for a card, a kind of help or all help, listed in order, capped, and removed one by one',async()=>{
 const env={chrome:{storage:{local:storage()}}},store=UI.createStore(env);
 const a=await store.addNote(scope,{scope:'card',itemId:'12',title:'Homework for Monday',text:'  Give the dictionary form of every verb  '});
 const b=await store.addNote(scope,{scope:'kind',kind:'examples',text:'Show units at every step'});
 await store.addNote(scope,{scope:'all',text:'Keep answers short'});
 const list=await store.getNotes(scope);assert.deepEqual(list.map(n=>[n.scope,n.kind,n.itemId,n.text]),[['card','','12','Give the dictionary form of every verb'],['kind','examples','','Show units at every step'],['all','','','Keep answers short']]);
 assert.equal(list[0].title,'Homework for Monday');assert.ok(a.id&&b.id&&a.id!==b.id);
 await assert.rejects(store.addNote(scope,{scope:'card',text:'   '}),/Write what to remember/);await assert.rejects(store.addNote(scope,{scope:'everything',text:'x'}),/Write what to remember/);
 await store.removeNote(scope,b.id);assert.deepEqual((await store.getNotes(scope)).map(n=>n.text),['Give the dictionary form of every verb','Keep answers short']);
 for(let i=0;i<45;i++)await store.addNote(scope,{scope:'all',text:'n'+i});assert.equal((await store.getNotes(scope)).length,40,'the newest forty stay');
});

test('each help gets the notes that apply: all-card notes, its kind\'s (every kind labelled when the AI chooses) and its item\'s',()=>{
 const instructions={standingText:'Short answers.',notes:[{scope:'all',text:'I am in 10th grade.'},{scope:'kind',kind:'test',text:'Mix in free response.'},{scope:'kind',kind:'reading',text:'Quote more.'},{scope:'card',itemId:'12',text:'Use the textbook notation.'},{scope:'card',itemId:'99',text:'Other item.'}]};
 assert.equal(S.noteText(instructions,'test','12'),'Short answers.\nI am in 10th grade.\nFor practice tests: Mix in free response.\nFor this item: Use the textbook notation.');
 assert.equal(S.noteText(instructions,'auto','99'),'Short answers.\nI am in 10th grade.\nFor practice tests: Mix in free response.\nFor reading breakdowns: Quote more.\nFor this item: Other item.');
 assert.equal(S.noteText({},'test','12'),'');
 const prompt=S.buildDeliver('test',{wishes:S.noteText(instructions,'test','12')});assert.match(prompt,/<<<WISHES>>>\nShort answers\. I am in 10th grade\. For practice tests: Mix in free response\. For this item: Use the textbook notation\.\n<<<END WISHES>>>/);assert.equal(S.noteText({notes:[{scope:'all',text:'Keep answers short'}]},'test','1'),'Keep answers short.');
});

test('the runner sends a pick\'s notes, and CH reads them from the study store with the run\'s consent',async()=>{
 const fs=require('fs');assert.match(fs.readFileSync(require.resolve('../extension/ai-prepare.js'),'utf8'),/notes:Array\.isArray\(study\.\$notes\)\?study\.\$notes\.slice\(-40\):\[\]/);
 const Runner=require('../extension/ai-runner.js');
 const runner=Runner.create({canvas:{reader:()=>({cache:new Map(),read:async req=>({id:req.id,text:'TEXT'})}),validate:async()=>{}},results:{},account:{get:()=>({settings:{timeZone:'UTC'},toolbox:{}}),sync:async()=>{}},adapter:{},now:()=>Date.parse('2026-10-26T16:00:00Z'),uuid:()=>'x'});
 const run={id:'run-n',state:'gathering',mode:'prepare',phase:'deliver',picks:[{ref:'A1',make:'examples',focus:'',sources:[]}],pickIndex:0,made:[],errors:[],turns:[],messages:[],refs:{A1:{id:'12',courseId:'7',title:'Homework #7'}},instructions:{standingText:'',notes:[{scope:'card',itemId:'12',text:'Use the textbook notation.'},{scope:'kind',kind:'test',text:'Not for examples.'}]},settings:{},
  snapshot:{index:[['assignment:7:12',{id:'assignment:7:12',what:'assignment',title:'Homework #7',courseId:'7',item:{courseName:'Calculus'}}]],snapshot:{items:[]},brief:{text:'brief'}}};
 await runner.step(run,{save:async r=>r,guard:async()=>{},signal:new AbortController().signal});
 assert.match(run.messages[0].content,/<<<WISHES>>>\nFor this item: Use the textbook notation\.\n<<<END WISHES>>>/);assert.doesNotMatch(run.messages[0].content,/Not for examples/);
});
