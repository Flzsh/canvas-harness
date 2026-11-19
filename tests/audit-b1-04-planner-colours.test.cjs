'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{req,ext,NOW}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-04: Canvas work carries no colour of its own, so every Planner card, Week-module dot and the Clock's next due
// were drawn in the personal-task grey instead of their course's colour.
// (widgets.js and planner-model.js run in a sandbox of their own: loaded into the suite's shared process they would
// register their Biscuit sources there and change other tests.)
test('B1-04 the planner list carries each Canvas item\'s course colour',()=>{
 const sandbox={console,Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map};sandbox.globalThis=sandbox;vm.createContext(sandbox);
 for(const file of ['planner-model.js','widgets.js'])vm.runInContext(fs.readFileSync(ext(file),'utf8'),sandbox,{filename:file});
 const W=sandbox.ReserveWidgets,Core=req('core.js'),course={id:'7',name:'Chemistry',color:'#286452'};
 const c={now:NOW,s:{timeZone:'America/New_York'},local:{},courses:[course],courseMap:new Map([['7',course]]),items:[Core.normalizeAssignment({id:'17',name:'Gas laws',due_at:'2026-11-06T20:00:00Z',submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}},course),{id:'local-a',name:'Mine',courseId:'personal',personal:true,courseColor:'#7c718d',dueAt:null,state:'personal'}]};
 const h={dayKey:(v,tz)=>Core.dayKey(v,tz),complete:Core.isComplete},list=W.plan(c,h).list;
 assert.equal(list[0].color,'#286452');
 assert.equal(list[1].color,'#7c718d','a personal task keeps its own colour');
});
