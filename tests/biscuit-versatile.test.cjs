'use strict';
// What "extremely versatile" means for Biscuit's Ask line: the ways students really type it. now = Mon 11 May 2026,
// 12:00 in New York. Everything here must be understood locally (never sent to the AI).
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const P=require(path.resolve(__dirname,'../extension/biscuit-parse.js'));
const now=Date.parse('2026-05-11T16:00:00Z'),courses=[{id:'calc',name:'Calculus',shortName:'MATH 201'},{id:'chem',name:'Chemistry',course_code:'CHEM 101'},{id:'bio',name:'Biology'},{id:'lit',name:'Literature'},{id:'eng',name:'English'}],workItems=[{id:'titration',title:'Titration Lab',course:'Chemistry',courseId:'chem',dueAt:'2026-05-15T20:00:00Z',kind:'lab'}];
const ctx=(extra={})=>({now,timeZone:'America/New_York',courses,workItems,focus:{running:true,minutes:25},skills:{},...extra}),idle=()=>ctx({focus:{running:false}});
const expect=(q,intent,fields={},s=ctx())=>{const out=P.parse(q,s);assert.ok(Array.isArray(out)&&out.length,q+': nothing understood');assert.equal(out[0].intent,intent,q);for(const [k,v] of Object.entries(fields))assert.deepEqual(out[0].fields[k],v,q+' -> '+k);assert.ok(out.every(c=>c.intent!=='ai'),q+': must not go to the AI');};

// focus: the number anywhere, units in any form, number words, typos
for(const [q,minutes] of [['25 minute focus',25],['25 min focus',25],['25m focus',25],['25 mins of focus',25],['twenty five minute focus',25],['twenty-five minutes of focus',25],['half an hour focus',30],['half hour of studying',30],['focus for half an hour',30],['focus for an hour and a half',90],['an hour and a half of focus',90],['1.5h focus',90],['1h30 focus',90],['90 minute study session',90],['quick 10 min focus',10],['timer 25',25],['timer for 25 min',25],['set a 25 minute timer',25],['start a 40 minute timer',40],['lets focus',25],["let's focus for 40",40],['i need to focus for 40',40],['i want to study for an hour',60],['help me focus 20',20],['focus pls',25],['deep work 50',50],['study session 45m',45],['concentrate 30',30],['work for 25 minutes',25],['foucs 25 min',25],['fcous for 25',25],['focsu twenty',20],['a quarter hour of focus',15],['45 minutes',45]])
 test('focus: '+q,()=>expect(q,'focus',{minutes},idle()));
for(const [q,minutes,courseId] of [['do 25 minutes of chem',25,'chem'],['25 min calc',25,'calc'],['focus calc 40',40,'calc'],['40 minutes of biology',40,'bio'],['study english for half an hour',30,'eng']])
 test('focus on a course: '+q,()=>expect(q,'focus',{minutes,courseId},idle()));
// focus until a time (now is 12:00)
for(const [q,minutes] of [['focus till 1',60],['focus until 12:45',45],['focus until 2pm',120],['study until 1:30',90],['focus till half past 12',30],['work until 3',180]])
 test('focus until: '+q,()=>expect(q,'focus',{minutes},idle()));
// pomodoros and a planned break
for(const [q,minutes,cycles,breakMinutes] of [['pomodoro',25,1,5],['a pomodoro',25,1,5],['4 pomodoros',25,4,5],['two pomodoros',25,2,5],['pomodoro x3',25,3,5],['focus 25 then 5 min break',25,1,5],['focus 50 with a 10 minute break',50,1,10],['3 rounds of 25 minutes',25,3,5]])
 test('cycles: '+q,()=>expect(q,'focus',{minutes,cycles,breakMinutes},idle()));
// breaks
for(const [q,minutes] of [['5 min break',5],['5 minute break',5],['take a 10 minute break',10],['ten minute break',10],['quick break',5],['short break',5],['long break',15],['break for a quarter of an hour',15],['rest 10',10],['i need a break',5]])
 test('break: '+q,()=>expect(q,'break',{minutes}));
// the running timer: controls and questions
for(const [q,action,minutes] of [['add five minutes','adjust',5],['give me 10 more minutes','adjust',10],['extend by 15','adjust',15],['cut 5 minutes','adjust',-5],['5 minutes less','adjust',-5],['stop the timer','stop'],['end the session','stop'],["i'm done",'stop'],['hold on','pause'],['continue','resume'],['keep going','resume']])
 test('timer control: '+q,()=>expect(q,'focus-control',minutes==null?{action}:{action,minutes}));
for(const q of ['how long left','time left','how much time is left','how long do i have left'])
 test('timer question: '+q,()=>expect(q,'focus-status'));
// reminders: the next sensible time (12:00 now, so "at 9" is tonight)
for(const [q,date,time,title] of [['remind me at 9 to pack my bag','2026-05-11','21:00','pack my bag'],['remind me at 7 to call mom','2026-05-11','19:00','call mom'],['remind me in 20 min to stretch','2026-05-11','12:20','stretch'],['in 2 hours remind me to eat','2026-05-11','14:00','eat'],['remind me tonight to review notes','2026-05-11','20:00','review notes'],['remind me tomorrow morning to bring the graph','2026-05-12','07:30','bring the graph'],['remind me after school to return the book','2026-05-11','15:30','return the book'],["don't let me forget the lab report at 6",'2026-05-11','18:00','the lab report'],['ping me at 8pm to text sam','2026-05-11','20:00','text sam'],['remind me friday at 4 to submit the form','2026-05-15','16:00','submit the form']])
 test('reminder: '+q,()=>expect(q,'reminder',{date,time,title}));
// the Planner: day, minutes, course
for(const [q,date,minutes,courseId] of [['plan chem lab thursday 40m','2026-05-14',40,'chem'],['put 30 minutes of bio on wednesday','2026-05-13',30,'bio'],['schedule calc homework tomorrow for an hour','2026-05-12',60,'calc'],['plan 45 min of english on friday','2026-05-15',45,'eng']])
 test('plan: '+q,()=>expect(q,'plan',{date,minutes,courseId}));
// what is due
for(const [q,date] of [['what do i have tomorrow','2026-05-12'],['anything due friday','2026-05-15'],["what's due tomorrow",'2026-05-12']])
 test('due: '+q,()=>expect(q,'due',{date}));
