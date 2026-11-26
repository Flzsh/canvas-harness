'use strict';
// fix-42 (review-42 findings 3 and 4, and the DST note): month ends in the 4.2 Planner. A monthly task keeps the day its
// series began through short months (Jan 31, Feb 28, Mar 31, Apr 30), in the next day it moves to, in the Planner's echoes
// and after a whole-task tick elsewhere; "in a month" lands on the last day of a shorter month; a time the clocks skip is
// the same time after the jump. Series saved before the start day was kept still work. (Sample data only.)
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../extension/planner-model.js'),{validateBackup,createStore}=require('../extension/storage.js'),Personal=require('../extension/personal-work.js');
const item=(id,repeat)=>({id,name:'Pay phone bill',courseId:'personal',courseName:'Personal',personal:true,dueAt:null,repeat});
const list=(data,today)=>P.entries(Personal.normalize(data,[]),data.tasks,{dayOf:v=>new Date(v).toISOString().slice(0,10),isDone:(i,m)=>m.checkedOff===true||m.progress==='done',today});
const series=(id,day,extra={})=>({customTasks:[{id,name:'Pay phone bill',courseId:'personal',dueAt:null,createdAt:'2026-10-01T00:00:00.000Z',repeat:{every:'month',interval:1}}],tasks:{[id]:{plannedDate:day,checklist:[],...extra}}});
const ticks=(data,id,n)=>{const seen=[];for(let i=0;i<n;i++){P.complete(id,data.tasks[id].plannedDate)(data);seen.push(data.tasks[id].plannedDate);}return seen;};

test('a monthly task on the 31st, ticked each month, comes back on the 31st after every short month',()=>{
 const data=series('local-m','2027-01-31');
 assert.deepEqual(ticks(data,'local-m',3),['2027-02-28','2027-03-31','2027-04-30']);
 assert.equal(data.tasks['local-m'].repeatFrom,'2027-01-31','the day the series began is kept with the task');
 const fall=series('local-n','2026-10-31');assert.deepEqual(ticks(fall,'local-n',2),['2026-11-30','2026-12-31'],'through a 30-day month');
 // a whole year from a quick add, into a leap February
 const added={customTasks:[],tasks:{}};P.addTask(P.parseQuick('pay phone bill monthly','2027-01-31'),{id:'local-y',nowISO:'2027-01-31T12:00:00.000Z',zone:'America/New_York'})(added);
 assert.equal(added.tasks['local-y'].plannedDate,'2027-01-31');assert.equal(added.tasks['local-y'].repeatFrom,'2027-01-31');
 assert.deepEqual(ticks(added,'local-y',13),['2027-02-28','2027-03-31','2027-04-30','2027-05-31','2027-06-30','2027-07-31','2027-08-31','2027-09-30','2027-10-31','2027-11-30','2027-12-31','2028-01-31','2028-02-29']);
 // the 30th and the 29th, and every other month
 assert.deepEqual(ticks(series('local-t','2027-01-30'),'local-t',2),['2027-02-28','2027-03-30']);
 const two=series('local-2','2026-12-31');two.customTasks[0].repeat={every:'month',interval:2};assert.deepEqual(ticks(two,'local-2',3),['2027-02-28','2027-04-30','2027-06-30']);
 // a day done late or skipped still counts from the start
 const late=series('local-l','2027-01-31');P.complete('local-l','2027-02-03')(late);assert.equal(late.tasks['local-l'].plannedDate,'2027-02-28');
 P.complete('local-l','2027-03-01',{skip:true})(late);assert.equal(late.tasks['local-l'].plannedDate,'2027-03-31');
 P.uncomplete('local-l')(late);assert.equal(late.tasks['local-l'].plannedDate,'2027-02-28');P.complete('local-l','2027-02-28')(late);assert.equal(late.tasks['local-l'].plannedDate,'2027-03-31','undo and tick again: the same day');
});

test('the Planner\'s echoes of the next months fall on the series\' day, not on the day of a short month',()=>{
 const echoIn=(data,today,start,count)=>P.range(list(data,today),today,start,count).days.filter(d=>d.echoes.length).map(d=>d.key);
 const kept=series('local-m','2027-02-28',{repeatFrom:'2027-01-31',repeatLog:[{day:'2027-01-31'}]});
 assert.deepEqual(echoIn(kept,'2027-02-28','2027-02-28',62),['2027-03-31','2027-04-30']);
 // a series saved by a 4.2 preview (no start day kept): its log still tells the 31st
 const preview=series('local-m','2027-02-28',{repeatLog:[{day:'2027-01-31'}]});
 assert.deepEqual(echoIn(preview,'2027-02-28','2027-02-28',62),['2027-03-31','2027-04-30']);
 P.complete('local-m','2027-02-28')(preview);assert.equal(preview.tasks['local-m'].plannedDate,'2027-03-31');assert.equal(preview.tasks['local-m'].repeatFrom,'2027-01-31');
 // ...and with nothing to tell it otherwise it counts from its planned day, as it always did
 assert.deepEqual(echoIn(series('local-m','2027-02-28'),'2027-02-28','2027-02-28',62),['2027-03-28','2027-04-28']);
 // ticked as a whole on Home (Archive) after its day: the next day is the series' day
 const archived=series('local-a','2027-02-28',{repeatFrom:'2027-01-31',checkedOff:true});
 const e=list(archived,'2027-03-02').find(x=>x.id==='local-a');assert.equal(e.planned,'2027-03-31');assert.equal(e.done,false);
 P.complete('local-a','2027-03-31')(archived);assert.deepEqual(archived.tasks['local-a'].repeatLog,[{day:'2027-02-28'},{day:'2027-03-31'}]);assert.equal(archived.tasks['local-a'].plannedDate,'2027-04-30');
});

test('a task moved off its series starts a new one; the same repeat chosen again keeps the start, another kind begins anew',()=>{
 const moved=series('local-m','2027-02-20',{repeatFrom:'2027-01-31'});
 P.complete('local-m','2027-02-20')(moved);assert.equal(moved.tasks['local-m'].plannedDate,'2027-03-20');assert.equal(moved.tasks['local-m'].repeatFrom,'2027-02-20');
 const again=series('local-m','2027-02-28',{repeatFrom:'2027-01-31'});P.setRepeat('local-m',{every:'month'},'2027-02-27')(again);assert.equal(again.tasks['local-m'].repeatFrom,'2027-01-31');
 P.setRepeat('local-m',{every:'week',days:[0]},'2027-02-27')(again);assert.equal(again.tasks['local-m'].repeatFrom,'2027-02-28','a weekly series from its planned day');
 P.setRepeat('local-m',{every:'month'},'2027-02-27')(again);assert.equal(again.tasks['local-m'].repeatFrom,'2027-02-28','a monthly series again, from the day it stands on');
 P.setRepeat('local-m',null)(again);assert.equal(again.tasks['local-m'].repeatFrom,undefined);assert.equal(again.customTasks[0].repeat,undefined);
 // daily and weekly series are unchanged by where they count from
 const wk=series('local-w','2026-11-23',{repeatFrom:'2026-11-09'});wk.customTasks[0].repeat={every:'week',interval:2,days:[1]};P.complete('local-w','2026-11-23')(wk);assert.equal(wk.tasks['local-w'].plannedDate,'2026-12-07');
});

test('the start day is kept by the store and by a backup; a day that is not a date is dropped, never a reason to refuse',async()=>{
 const adapter=(()=>{const m={};return {read:async k=>structuredClone(m[k]),write:async(k,v)=>{m[k]=structuredClone(v);}};})(),store=createStore({accountId:'1',adapter});await store.load();
 await store.update(s=>{s.customTasks.push(item('local-m',{every:'month',interval:1}),item('local-x',{every:'month',interval:1}));s.tasks['local-m']={plannedDate:'2027-02-28',repeatFrom:'2027-01-31',repeatLog:[{day:'2027-01-31'}]};s.tasks['local-x']={plannedDate:'2027-02-28',repeatFrom:'2027-02-30',repeatLog:[{day:'2027-13-01'},{day:'2027-01-31'}]};});
 const saved=await createStore({accountId:'1',adapter}).load();
 assert.equal(saved.tasks['local-m'].repeatFrom,'2027-01-31');assert.equal(saved.tasks['local-x'].repeatFrom,undefined);assert.deepEqual(saved.tasks['local-x'].repeatLog,[{day:'2027-01-31'}]);
 assert.deepEqual(validateBackup({format:'reserve-backup',version:1,data:saved}).tasks['local-m'],saved.tasks['local-m']);
 for(const bad of ['x','2027-02-30','2027-13-01',7,null])assert.equal(P.migrate({customTasks:[],tasks:{a:{plannedDate:'2027-02-28',repeatFrom:bad}}}).tasks.a.repeatFrom,undefined,String(bad));
 assert.equal(P.migrate({customTasks:[],tasks:{a:{plannedDate:'2027-02-28',repeatFrom:'2027-01-31'}}}).tasks.a.repeatFrom,'2027-01-31');
 assert.equal(P.validDay('2027-13-01'),false,'never throws');
});

test('"in a month" and "in N months" land on the last day of a shorter month',()=>{
 for(const [text,today,want] of [['read in a month','2027-01-31','2027-02-28'],['read in 1 month','2026-10-31','2026-11-30'],['read in 2 months','2026-12-31','2027-02-28'],['read in a month','2028-01-30','2028-02-29'],['read in 12 months','2028-02-29','2029-02-28'],['read in 3 months','2026-11-22','2027-02-22'],['read in a month','2026-12-15','2027-01-15']])
  assert.equal(P.parseQuick(text,today).day,want,`"${text}" on ${today}`);
 assert.equal(P.addMonths('2027-01-31',13),'2028-02-29');assert.equal(P.addMonths('2026-05-31',-3),'2026-02-28');
});

test('a time the clocks skip is the same time after the jump; every other time is where it was',()=>{
 const at=(day,time,zone='America/New_York')=>P.instant(day,time,zone);
 assert.equal(at('2027-03-14','02:30'),'2027-03-14T07:30:00.000Z','3:30 EDT, not 1:30 EST');
 assert.equal(at('2026-03-08','02:00'),'2026-03-08T07:00:00.000Z');assert.equal(at('2026-03-08','02:59'),'2026-03-08T07:59:00.000Z');
 assert.equal(at('2027-03-14','01:59'),'2027-03-14T06:59:00.000Z');assert.equal(at('2027-03-14','03:00'),'2027-03-14T07:00:00.000Z');
 assert.equal(at('2026-03-08','03:30'),'2026-03-08T07:30:00.000Z');assert.equal(at('2026-11-01','01:30').slice(0,13),'2026-11-01T05','the first 1:30 of the fall-back night');
 assert.equal(at('2026-11-22','23:59'),'2026-11-23T04:59:00.000Z');
 // a zone ahead of UTC jumps the same way (Sydney, 2 AM -> 3 AM on 2026-10-04)
 assert.equal(at('2026-10-04','02:30','Australia/Sydney'),'2026-10-03T16:30:00.000Z');assert.equal(at('2026-10-04','01:30','Australia/Sydney'),'2026-10-03T15:30:00.000Z');
});
