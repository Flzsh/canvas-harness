'use strict';
// Function check of 4.0.171 (2026-11-17), two rules:
// 1. A "did I turn in X" question that matches several items never answers about one picked silently: it lists them, the
//    open / next-due one first and named in the head line, the handed-in ones after. Kind is read from the title, the
//    kind field or the assignment group ("Labs"); handed-in work from Canvas's state (graded / submitted).
// 2. A question never changes anything: "what's next" lists what is next due (nearest open first, then two more) and makes
//    no plan; no question form writes the planner, marks, bookmarks, adds a task or hides.
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../extension/biscuit-engine.js'),A=require('../extension/biscuit-answer.js');
// Monday 2026-11-16, 10:30 PM in New York (the function check's evening)
const now=Date.parse('2026-11-17T03:30:00Z'),day=864e5,at=(d,h=4,m=59)=>{const x=new Date(now+d*day);x.setUTCHours(h,m,0,0);return x.toISOString();};
const courses=[{id:'101',name:'Chemistry'},{id:'102',name:'Calculus AB'},{id:'103',name:'English Literature'},{id:'106',name:'Physics'}];
const assignmentGroups=[{id:'1062',name:'Labs',courseId:'106'},{id:'1063',name:'Sets',courseId:'106'},{id:'1012',name:'Labs',courseId:'101'},{id:'1011',name:'Tests',courseId:'101'}];
const assignments=[
 {id:'1060',title:'Motion graphs: a quick investigation',courseId:'106',dueAt:at(5),assignmentGroupId:'1062',state:'unsubmitted'},   // Sat
 {id:'1061',title:'Forces problem set',courseId:'106',dueAt:at(7),assignmentGroupId:'1063',state:'unsubmitted'},
 {id:'1092',title:'Density lab',courseId:'106',dueAt:at(-17,21,46),assignmentGroupId:'1062',state:'graded'},
 {id:'1093',title:'Gas laws lab',courseId:'106',dueAt:at(-16,21,46),assignmentGroupId:'1062',state:'graded'},
 {id:'1010',title:'Reaction rates: lab preparation',courseId:'101',dueAt:at(0,18,59),assignmentGroupId:'1012',state:'unsubmitted'}, // Tue 1:59 PM
 {id:'1011',title:'Unit 3 Test',courseId:'101',dueAt:at(4),assignmentGroupId:'1011',state:'unsubmitted'},
 {id:'1030',title:'A close reading of chapter three',courseId:'103',dueAt:at(1,3,59),state:'unsubmitted'},                           // Tue 10:59 PM
 {id:'1020',title:'Derivatives: practice set',courseId:'102',dueAt:at(1),state:'unsubmitted'}                                        // Tue 11:59 PM
];
const world=extra=>({now,timeZone:'America/New_York',ai:true,settings:{showGrades:true,bedtime:'22:30'},courses,assignmentGroups,assignments,workItems:assignments,personalTasks:[],files:[],pageKind:'dashboard',...extra});
const ask=(line,session={})=>{const s=world(),r=E.evaluate(line,s,session);return {r,a:A.build(r,s,session,{line})};};
const CHANGES=new Set(['plan','complete','bookmark','task','move','remove','reminder','note']);

test('a turned-in question that matches several items lists them, the open one first and named in the head line',()=>{
 const {r,a}=ask('did i submit the physics lab');
 assert.match(r.message,/^Motion graphs: a quick investigation, due Sat: not turned in yet\. Turned in: /);
 assert.match(r.message,/Turned in: Density lab, Gas laws lab\.$/);
 assert.notEqual(r.next.action,'complete');assert.equal(r.next.fields.itemId,undefined,'no one item is picked silently');
 assert.equal(a.kind,'list');assert.deepEqual(a.rows.map(x=>x.id),['1060','1092','1093'],'open first, then the handed-in ones');
 assert.equal(a.rows[0].state,'open');assert.equal(a.rows[1].state,'graded');
 // a list about state, not a to-do list: grouped and counted by state, no minutes of work for handed-in items
 assert.equal(a.summary,'1 not turned in · 2 turned in');
 assert.deepEqual(a.groups.map(g=>[g.label,g.rows]),[['Not turned in yet',['1060']],['Turned in',['1092','1093']]]);
});
test('one match is answered as before; all handed in says so',()=>{
 assert.match(ask('did i submit the density lab').r.message,/^Yes, Density lab is in\./);
 const rest=assignments.filter(v=>v.id!=='1060'),w=world({assignments:rest,workItems:rest});const r=E.evaluate('did i turn in the physics lab',w,{});
 assert.match(r.message,/^Yes, both Physics labs are in: Density lab, Gas laws lab\./);
 // title words beat a course guessed from subject words ("gas laws" reads as Chemistry, which has an open lab)
 assert.match(ask('did i submit the gas laws lab').r.message,/^Yes, Gas laws lab is in\./);
});
test('a graded question puts the not-graded, next-due item first and names it; the graded ones are listed after',()=>{
 const {r,a}=ask('is the physics lab graded');
 assert.equal(r.message,'Motion graphs: a quick investigation, due Sat: not graded yet, not turned in. Graded: Density lab, Gas laws lab.');
 assert.equal(a.kind,'list');assert.deepEqual(a.rows.map(x=>x.id),['1060','1092','1093']);
 assert.equal(a.summary,'1 not graded yet · 2 graded');assert.deepEqual(a.groups.map(g=>g.label),['Not graded yet','Graded']);
 assert.match(ask('has the density lab been graded').r.message,/^Yes, Density lab is graded\./);
 assert.match(ask('is the chem quiz graded').r.message,/^No quiz in Chemistry/);
});
test('an item picked by its kind within a course is the open, next-due one, named in the answer',()=>{
 const {r}=ask('when is the physics lab due');
 assert.equal(r.next.fields.itemId,'1060');assert.match(r.message,/Motion graphs/);
});
test('"what\'s next" and its sisters list what is next due and change nothing',()=>{
 for(const line of ['wat next','what\'s next','whats next','what is next','next?','what next']){
  const {r,a}=ask(line);assert.ok(!CHANGES.has(r.next.action)&&!CHANGES.has(r.action),line+': '+r.action);
  assert.equal(r.next.fields.itemId,undefined,line);assert.match(r.message,/^Next: Reaction rates: lab preparation \(Chemistry\), tomorrow at 1:59 PM\. Then A close reading of chapter three \(English Literature\), tomorrow at 10:59 PM; Derivatives: practice set \(Calculus AB\), tomorrow at 11:59 PM\./,line);
  assert.equal(a.kind,'list',line);assert.deepEqual(a.rows.map(x=>x.id),['1010','1030','1020'],line);
 }
 assert.equal(ask('what should i do tonight').r.action,'plan','a line that asks for doing may still plan');
 assert.equal(ask('plan tonight').r.action,'plan');
});
test('no question form writes the planner, marks, bookmarks, adds a task or hides',()=>{
 for(const line of ['what is due tomorrow','whats due fri','what now','what is my next test','is the unit 3 test soon','did i finish the physics lab','when is the motion graphs lab due','what about tomorrow','what is left this week','which one is first','how much is due this week','do i have homework']){
  const {r}=ask(line);const act=r.next?.action||r.action,f=r.next?.fields||{};
  assert.ok(!CHANGES.has(act),line+': '+act);assert.ok(!(act==='module'&&f.action==='hide')&&!(act==='setting'&&f.value===false)&&!(act==='feature'&&f.on===false),line+': hides');
 }
});
