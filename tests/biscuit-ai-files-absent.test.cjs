'use strict';
// B7 of the function check (4.0.0 with AI help locked; the development build with it off): with AI help off its files (study-prompts.js, ai-context.js) are not on
// the Canvas page, but help lines ("help me with chem homework") still built the AI hand-off, which read those missing
// files: "Cannot read properties of null (reading 'withoutScores')", and Biscuit gave no answer. Now, without the AI
// files, the engine answers exactly as with AI help off, and with AI help off no reply or act offers the AI.
const test=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const E0=require('../extension/biscuit-engine.js'),A=require('../extension/biscuit-answer.js');
// as on a Canvas page without AI help: these two files are not there, so the engine's lookup finds nothing (null). Only
// while a line is answered: the suite runs every file in one process and later files need the real modules.
function withoutAI(fn){const real=Module._load,saved={study:globalThis.CanvasHarnessStudy,context:globalThis.CanvasHarnessContext};delete globalThis.CanvasHarnessStudy;delete globalThis.CanvasHarnessContext;
 Module._load=function(request,...rest){if(/(^|[\/])(study-prompts|ai-context)\.js$/.test(request))return null;return real.call(this,request,...rest);};
 try{return fn();}finally{Module._load=real;if(saved.study!==undefined)globalThis.CanvasHarnessStudy=saved.study;if(saved.context!==undefined)globalThis.CanvasHarnessContext=saved.context;}}
const E={evaluate:(line,s,session={})=>withoutAI(()=>E0.evaluate(line,s,session))};
const now=Date.parse('2026-10-22T22:00:00Z');
const world=patch=>({now,timeZone:'America/New_York',settings:{showGrades:true,bedtime:'22:30'},
 courses:[{id:'10',name:'Chemistry',score:88}],
 assignments:[{id:'1',title:'Rates investigation',courseId:'10',dueAt:'2026-10-24T03:59Z'},{id:'3',title:'Titration lab',courseId:'10',dueAt:'2026-10-30T03:59Z'}],
 grades:[{id:'g1',title:'Density lab',courseId:'10',assignmentId:'9',score:34,pointsPossible:40,feedback:'Good work, check units.'}],...patch});
const AI_WORDS=/\b(?:your ai|ask ai|ai panel|ai help|help band|study aids?)\b/i;
test('without the AI files on the page, help lines get the AI-off answer instead of throwing',()=>{
 for(const line of ['help me with chem homework','help me with rates investigation','explain crystal violet','help me understand density lab','quiz me','make flashcards for the titration lab']){
  let r;assert.doesNotThrow(()=>{r=E.evaluate(line,world());},line);
  assert.notEqual(r.action,'ai',line);assert.equal(r.handoff,undefined,line);assert.doesNotMatch(String(r.message),AI_WORDS,line);
  assert.equal(r.message,E.evaluate(line,world({ai:false})).message,line);
 }
});
test('with AI help off no answer offers the AI: no Ask AI, no Help with this',()=>{
 for(const line of ['titration lab','help me with chem homework','what is due','rates investigation']){
  const s=world({ai:false}),r=E.evaluate(line,s,{}),a=A.build(r,s,{},{line});
  assert.ok(!a.acts.some(x=>x.intent==='ai'),line);
  for(const row of a.rows)assert.ok(!A.rowActs(row).some(x=>x.intent==='ai'),line+': '+row.name);
  assert.doesNotMatch(JSON.stringify(a),/Help with this|Ask AI|Your AI/,line);
 }
});
