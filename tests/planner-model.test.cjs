const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../extension/planner-model.js');
const T='2026-10-12';   // a Monday
test('quick add reads a day, a length and a course hint, and leaves the rest as the name',()=>{
 assert.deepEqual(P.parseQuick('Read chapter 3 fri 45m #chem',T),{name:'Read chapter 3',day:'2026-10-16',estimate:45,course:'chem'});
 assert.deepEqual(P.parseQuick('  essay   outline tomorrow 1.5h ',T),{name:'essay outline',day:'2026-10-13',estimate:90,course:''});
 assert.equal(P.parseQuick('Lab report today',T).day,T);
 assert.equal(P.parseQuick('Flashcards monday',T).day,'2026-10-19','the same weekday means next week');
 assert.equal(P.parseQuick('Flashcards next wed',T).day,'2026-10-21');
 assert.equal(P.parseQuick('Project oct 30 2h 15m',T).day,'2026-10-30');assert.equal(P.parseQuick('Project oct 30 2h 15m',T).estimate,135);
 assert.equal(P.parseQuick('Form 1/5',T).day,'2027-01-05','a date already past is next year');
 assert.equal(P.parseQuick('Form 2/30',T).day,'','an impossible date is not a date');assert.equal(P.parseQuick('Form 2/30',T).name,'Form 2/30');
});
test('quick add does not mistake ordinary words or numbers for dates and lengths',()=>{
 assert.deepEqual(P.parseQuick('Buy a sun hat for 3 friends',T),{name:'Buy a sun hat for 3 friends',day:'',estimate:0,course:''});
 assert.equal(P.parseQuick('Monitor the reaction',T).day,'');assert.equal(P.parseQuick('Chapter 12 problems',T).estimate,0);
 assert.equal(P.parseQuick('Read 30 pages 30 min',T).name,'Read 30 pages');
 assert.equal(P.parseQuick('x'.repeat(400),T).name.length,200);assert.equal(P.parseQuick('study 99h',T).estimate,1440);
});
test('a course hint matches a whole word, then the start of a word',()=>{
 const courses=[{id:'1',name:'AP Biology',shortName:'Bio',code:'APBIO'},{id:'2',name:'Chemistry',code:'CHEM101'},{id:'3',name:'Biochemistry Club',code:'BC'}];
 assert.equal(P.matchCourse('bio',courses).id,'1');assert.equal(P.matchCourse('chem',courses).id,'2');assert.equal(P.matchCourse('club',courses).id,'3');assert.equal(P.matchCourse('zzz',courses),null);assert.equal(P.matchCourse('',courses),null);
});
const items=[
 {id:'11',name:'Lab prep',courseId:'1',courseName:'Chemistry',courseColor:'#a00',dueAt:'2026-10-12T17:00:00Z'},
 {id:'12',name:'Essay',courseId:'2',courseName:'English',dueAt:'2026-10-16T17:00:00Z'},
 {id:'13',name:'Old quiz',courseId:'2',courseName:'English',dueAt:'2026-10-09T17:00:00Z'},
 {id:'14',name:'Reading',courseId:'3',courseName:'History',dueAt:'2026-10-22T17:00:00Z'},
 {id:'15',name:'Far project',courseId:'3',courseName:'History',dueAt:'2026-11-20T17:00:00Z'},
 {id:'local-a',name:'Tidy notes',courseId:'personal',courseName:'Personal',personal:true,dueAt:null}];
const local={'12':{plannedDate:'2026-10-14',estimate:60,checklist:[{id:'a',text:'x',done:true},{id:'b',text:'y',done:false}]},'11':{estimate:30},'14':{plannedDate:'bad'}};
const list=P.entries(items,local,{dayOf:v=>v.slice(0,10),isDone:(item,mine)=>mine.progress==='done'});
test('a week shows planned work on its chosen day and unplanned work on the day it is due',()=>{
 const b=P.board(list,T);
 assert.deepEqual(b.days.map(d=>d.key),['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18']);
 assert.deepEqual(b.days[0].all.map(e=>e.id),['11']);assert.equal(b.days[0].minutes,30);
 assert.deepEqual(b.days[2].planned.map(e=>e.id),['12'],'planned for Wednesday');assert.deepEqual(b.days[4].all,[], 'and so no longer listed on its due day');
 assert.equal(b.days[2].planned[0].steps,2);assert.equal(b.days[2].planned[0].stepsDone,1);
});
test('work without a day waits in its own lists: overdue, due soon, and personal tasks with no date',()=>{
 const b=P.board(list,T);
 assert.deepEqual(b.overdue.map(e=>e.id),['13']);assert.deepEqual(b.waiting.map(e=>e.id),['14'],'due within two weeks, outside this week; an invalid saved day is ignored');
 assert.deepEqual(b.someday.map(e=>e.id),['local-a']);assert.ok(![...b.waiting,...b.overdue].some(e=>e.id==='15'),'far-off work is not pushed at the student');
 assert.deepEqual(P.board(list,T,1).days.map(d=>d.key)[0],'2026-10-19');assert.deepEqual(P.board(list,T,1).days[3].all.map(e=>e.id),['14']);
});
test('planning changes are plain functions over the saved data',()=>{
 const data={tasks:{'12':{plannedDate:'2026-10-10',progress:'not-started'},'13':{plannedDate:'2026-10-09',progress:'done'}},customTasks:[]};
 P.plan('11','2026-10-13')(data);assert.equal(data.tasks['11'].plannedDate,'2026-10-13');P.plan('11','not a day')(data);assert.equal(data.tasks['11'].plannedDate,'2026-10-13');P.plan('11','')(data);assert.equal(data.tasks['11'].plannedDate,'');
 P.estimate('11',5000)(data);assert.equal(data.tasks['11'].estimate,1440);
 P.carryOver(T,['12','13','99'])(data);assert.equal(data.tasks['12'].plannedDate,T,'unfinished planned work moves to today');assert.equal(data.tasks['13'].plannedDate,'2026-10-09','finished work stays where it was');
 P.addTask(P.parseQuick('Tidy desk tomorrow 10m',T),{id:'local-z',nowISO:'2026-10-12T10:00:00.000Z'})(data);
 assert.deepEqual(data.customTasks,[{id:'local-z',name:'Tidy desk',courseId:'personal',dueAt:null,createdAt:'2026-10-12T10:00:00.000Z'}]);assert.equal(data.tasks['local-z'].plannedDate,'2026-10-13');assert.equal(data.tasks['local-z'].estimate,10);
 P.addTask(P.parseQuick('   ',T),{id:'local-y',nowISO:'x'})(data);assert.equal(data.customTasks.length,1,'an empty name adds nothing');
});
test('lengths read naturally',()=>{assert.equal(P.minutes(0),'');assert.equal(P.minutes(45),'45 min');assert.equal(P.minutes(60),'1 h');assert.equal(P.minutes(95),'1 h 35 min');});
