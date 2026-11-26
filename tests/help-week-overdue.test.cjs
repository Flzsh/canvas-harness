'use strict';
// "Your week" and overdue work (owner, 2026-11-25, on a page with 24 stale items from months back: the advice said "Too much
// today" and asked to move today's one real task). Since 4.2.13 the Planner keeps overdue work in its own folded list and no
// longer pours it into today, so it is not today's load either: a day is "too much" only by what stands on that day.
// Sample data only.
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

test('24 stale overdue items and one task today: today is not "too much", nothing is asked to move',()=>{
 const stale=Array.from({length:24},(_,i)=>canvas(String(900+i),'Old homework '+(i+1),new Date(Date.parse('2026-09-01T17:00:00Z')+i*864e5).toISOString()));
 const data=planner([['Prepare English homework','2026-11-22',45]]);
 const found=check(data,stale);
 assert.equal(found.filter(f=>f.kind==='heavy').length,0,JSON.stringify(found.map(f=>f.text)));
 assert.ok(!found.some(f=>f.action?.type==='move'),'no move is offered');
});
test('a day is still "too much" by what stands on it; overdue work beside it changes nothing',()=>{
 const stale=Array.from({length:10},(_,i)=>canvas(String(700+i),'Old '+(i+1),new Date(Date.parse('2026-10-01T17:00:00Z')+i*864e5).toISOString()));
 const rows=[1,2,3,4,5,6].map(i=>['T'+i,'2026-11-22',40]);
 const alone=check(planner(rows)).filter(f=>f.kind==='heavy'),beside=check(planner(rows),stale).filter(f=>f.kind==='heavy');
 assert.equal(alone.length,1);assert.equal(alone[0].day,'2026-11-22');assert.match(alone[0].text,/^Too much today: 6 things, 4 h\.$/);
 assert.deepEqual(beside.map(f=>f.text),alone.map(f=>f.text),'the same finding with ten overdue items around');
});
