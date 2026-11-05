'use strict';
// Independent unrun consumer contracts. These exercise real source modules with
// tiny constant synthetic action heads; never load a fitted model or corpus.
const test=require('node:test'),assert=require('node:assert/strict');
const load=file=>require('../'+file),I=load('extension/biscuit-intent.js'),N=load('extension/biscuit-inference.js');
const NOW=Date.parse('2029-07-09T10:00:00Z'),MIN=60000;
const linear=label=>({labels:[label],weights:{bias:[1]},scale:1});
const pack=action=>({tier:'basic',features:{charMax:0},patterns:[],models:{action:{...linear(action),weights:{bias:[1],'w:grade':[0]}},item:linear('yes'),kind:linear('ask')}});
const state=extra=>({now:NOW,timeZone:'UTC',ai:true,courses:[],...extra});
const evaluate=(line,action,s=state(),rows=[])=>N.evaluate(line,s,{},pack(action),rows,()=>{throw Error('Unexpected legacy fallback');});

test('time-prefixed creation keeps exact delay and discards narrative from title',()=>{
 const r=evaluate('The sediment is settling; in 37 minutes remind me: inspect the jars','reminder');
 assert.equal(r.action,'reminder');assert.equal(r.next.fields.title,'inspect the jars');assert.equal(r.next.fields.at,NOW+37*MIN);
});

test('a titled literal note keeps its source Unicode byte sequence',()=>{
 const text='Café Δ — don’t alter this;  x  +  y 🧪';
 const r=evaluate('Please preserve the sentence "'+text+'" in a new note titled Échantillons. I need its exact wording.','note');
 assert.equal(r.action,'note');assert.equal(r.next.fields.text,text);assert.equal(r.next.fields.title,'Échantillons');
});

test('prose-cleanup lookalikes inside exact note text are literal data',()=>{
 const text='I keep remembering the name; do not rewrite this. Associate it with the samples';
 const r=evaluate('Copy the sentence "'+text+'" into a new note.','note');
 assert.equal(r.action,'note');assert.equal(r.next.fields.text,text);
});

test('negative and hypothetical literal storage still does no write',()=>{
 for(const line of ['Do not copy "Open the cabinet" into a personal note.','If I create a personal note, what happens?']){
  const r=evaluate(line,'note');assert.equal(r.action,'none',line);
 }
});

test('invalid reminder times still abstain',()=>{
 const r=evaluate('in 0 minutes remind me: inspect the jars','reminder');assert.equal(r.action,'none');
});

test('a real AI-disabled gate still beats positive question generation',()=>{
 const r=evaluate('Ask me what would count as evidence for a second account.','ai',state({ai:false}));assert.equal(r.action,'none');
});

test('a real grade privacy gate still beats a confident factual model',()=>{
 const row={id:'work',kind:'assignment',title:'Investigation',courseId:'studio',currentPercent:83,text:'Public directions.'};
 const r=evaluate('Show my grade.','open/find',state({showGrades:false,courses:[{id:'studio',name:'Inquiry Studio'}],selectedItemId:'work'}),[row]);
 assert.equal(r.action,'none');assert.match(r.message,/grade access is disabled/i);
});

test('generation negation still beats a confident AI model',()=>{
 const r=evaluate('Do not ask me a practice question.','ai');assert.equal(r.action,'none');
 assert.equal(I.negated('Do not quiz us on this guide.','ai'),true);
});
