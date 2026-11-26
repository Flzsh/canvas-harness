'use strict';
// "Your week" when the days are full (owner, 2026-11-23: a finding that offers only Dismiss helps nobody). A test with
// nothing planned and big work with no day still get their one action, on the least loaded day before them, marked full;
// the day then says "Too much" itself and offers what can move off it. A session added for a test never moves to the
// test's own day or past it. Sample data only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../extension/help-plan.js'),P=require('../extension/planner-model.js'),Personal=require('../extension/personal-work.js');
delete globalThis.ReserveHelpPlan;
const ZONE='America/New_York',NOW=Date.parse('2026-11-22T15:00:00Z');   // Sunday 22 November 2026, 10:00 AM in New York
const COURSES=[{id:'101',name:'Chemistry'}];
const dayIn=v=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(typeof v==='number'?v:Date.parse(v));
const canvas=(id,name,dueAt,extra={})=>({id,name,courseId:'101',courseName:'Chemistry',courseColor:'#286452',dueAt,personal:false,points:20,submissionTypes:['online_upload'],...extra});
const listOf=(data,items=[])=>P.entries([...items,...Personal.normalize(data,COURSES)],data.tasks||{},{dayOf:dayIn,isDone:(i,m)=>m.checkedOff===true||m.progress==='done',today:dayIn(NOW)});
function planner(rows){const d={customTasks:[],tasks:{},toolbox:{}};rows.forEach(([name,day,minutes],i)=>{const id='local-p'+i;d.customTasks.push({id,name,courseId:'personal',dueAt:null,createdAt:'2026-11-20T12:00:00.000Z'});d.tasks[id]={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:minutes,plannedDate:day,checklist:[]};});return d;}
const check=(data,items=[])=>H.weekCheck(listOf(data,items),{now:NOW,zone:ZONE,items,toolbox:data.toolbox});

test('a quiz tomorrow with today already full: a session is still offered, today, marked full; then the day says it is too much',()=>{
 const items=[canvas('810','Quiz 7','2026-11-23T17:00:00Z')],data=planner([1,2,3,4].map(i=>['T'+i,'2026-11-22',30]));
 const found=check(data,items);assert.deepEqual(found.map(f=>f.kind),['prep'],'four things: full, not yet too much');
 const f=found[0];assert.equal(f.text,'Nothing planned for Quiz 7 tomorrow.');
 assert.equal(f.action.type,'add');assert.equal(f.action.day,'2026-11-22');assert.equal(f.action.label,'Add a session today');assert.equal(f.action.full,true);assert.equal(f.action.done,'Added a session today.');
 const a=H.act(f,{now:NOW,zone:ZONE,id:'local-w1'});a.change(data);
 const after=check(data,items);assert.deepEqual(after.map(x=>x.kind),['heavy'],'planned now, and the day is too much');
 assert.equal(after[0].text,'Too much today: 5 things, 2 h 30 min.');
 assert.equal(after[0].action.type,'move');assert.notEqual(after[0].action.id,'local-w1','the study session is not what moves: it has to come before the quiz');
 a.undo(data);assert.deepEqual(check(data,items).map(x=>x.kind),['prep'],'Undo: as it was');
});

test('big work due soon with every day before it full: it still gets a day, the least loaded one',()=>{
 const items=[canvas('805','Research essay','2026-11-24T17:00:00Z',{points:100})];
 const data=planner([...[1,2,3,4].map(i=>['A'+i,'2026-11-22',30]),...[1,2,3,4].map(i=>['B'+i,'2026-11-23',20])]);
 const found=check(data,items);assert.deepEqual(found.map(f=>f.kind),['soon']);
 const f=found[0];assert.equal(f.action.type,'move');assert.equal(f.action.full,true);assert.equal(f.action.day,'2026-11-23','Monday carries less than today');assert.equal(f.action.label,'Plan it for tomorrow');
});

test('with room, the action is the one it was and is not marked full',()=>{
 const items=[canvas('810','Quiz 7','2026-11-23T17:00:00Z')],[f]=check(planner([]),items);
 assert.equal(f.action.day,'2026-11-22');assert.equal(f.action.label,'Add a session today');assert.equal(Object.hasOwn(f.action,'full'),false);
});

test('a day with too much: a session added for a test moves to a day before the test, never to the test\'s own day',()=>{
 const items=[canvas('820','Unit 4 Test','2026-11-25T17:00:00Z'),...[1,2,3,4].map(i=>canvas('83'+i,'Worksheet '+i,'2026-11-24T17:00:00Z'))],data=planner([]);
 const [prep]=check(data,items).filter(f=>f.kind==='prep');assert.equal(prep.action.day,'2026-11-23','the least loaded day before the test: Tuesday has four worksheets due');
 // a session for that test stands on Tuesday instead, beside the four worksheets, under a name that does not say "test"
 // (a plan's sessions are named for their topics; one named for the test is never offered to move at all)
 H.act({...prep,action:{...prep.action,day:'2026-11-24',title:'Review stoichiometry'}},{now:NOW,zone:ZONE,id:'local-w2'}).change(data);
 const heavy=check(data,items).find(f=>f.kind==='heavy');assert.equal(heavy.day,'2026-11-24');
 assert.equal(heavy.action.id,'local-w2','the thing with no due date of its own is offered first');
 assert.ok(heavy.action.day<'2026-11-25','before the test ('+heavy.action.day+')');
});
