'use strict';
// Biscuit's rule list, on a made-up student: what a student types and what they should get back.
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../extension/biscuit-engine.js'),R=require('../extension/biscuit-rules.js');
const now=Date.parse('2026-11-01T18:30:00Z'),day=864e5,iso=d=>new Date(now+d*day).toISOString();
const courses=[{id:'10',name:'Chemistry 11-Birch',shortName:'Chemistry'},{id:'20',name:'Engineering Design-Stone',shortName:'Engineering'},{id:'30',name:'English: Modern Fiction',shortName:'Modern Fiction'},{id:'50',name:'Latin Reading',shortName:'Latin'}];
const rows=[['1','Homework for Tuesday, 10/20','50',-12,1],['2','Homework for Friday, 9/4/2026','50',-58,1],['5','Cardboard Bridge','20',-2,1],['6','Aeneid Quiz II','50',2],['7','Solar Car Build','20',2],['9','Cycle Sheet','30',3],['10','Equilibrium Worksheet','10',1],['11','Kinetics Test','10',8]];
const assignments=rows.map(([id,title,courseId,d,missing])=>({id,title,courseId,dueAt:iso(d),points:10,kind:'assignment',missing:!!missing,submitted:false}));
const world=(knowledge='lite',extra={})=>({now,timeZone:'America/New_York',ai:true,pet:{knowledge},settings:{showGrades:false,bedtime:'22:30',timeZone:'America/New_York'},courses,assignments,workItems:[],personalTasks:[],files:[],pageKind:'dashboard',...extra});
const ask=(line,...rest)=>E.evaluate(line,world(...rest),{});

for(const [line,action,words] of [
 ['i want to work on my college essay tomorrow','task',/^Add to your list: College essay, tomorrow/],
 ['i have math homework from my textbook, page 212','task',/Math homework from my textbook, page 212/],
 ['my teacher gave us a paper worksheet for tomorrow','task',/Paper worksheet, tomorrow, about 30 min/],
 ['we have a reading for english, about 40 pages, due friday','task',/Friday, about 1 h 20 min/],
 ['i have a project for history that isnt on canvas','task',/Project for history, about 1 hour/],
 ['my tutor gave me homework','task',/Tutor homework/],
 ['do my laundry tonight','task',/Laundry, tonight/],
 ['add a task','chat',/What should I add/],
])test('work outside Canvas: '+line,()=>{const r=ask(line);assert.equal(r.action,action);assert.match(r.message,words);});

for(const [line,words] of [
 ['i have swim practice 5 to 7 tomorrow',/^Swim practice tomorrow at 5 pm, noted/],
 ['i work 4 to 9 on friday',/^Work Friday at 4 pm, noted/],
 ['i have a game saturday at noon',/^Game Saturday at 12 pm, noted/],
 ['i have a doctors appointment at 3 tomorrow',/^Doctors appointment tomorrow at 3 pm, noted/],
 ['i have a piano lesson at 4 tomorrow so plan around it',/^Piano lesson tomorrow at 4 pm, noted/],
])test('their day comes first: '+line,()=>{const r=ask(line);assert.equal(r.action,'plan');assert.match(r.message,words);assert.ok(r.next.fields.avoid?.length);});

test('busy until a time starts the plan after it, even without am or pm',()=>{const r=ask('i have robotics until 8 tonight');assert.equal(r.next.fields.after,'20:15');assert.match(r.message,/^Tonight 8:15 PM/);});
test('a plan never reaches for months old work unless asked',()=>{for(const line of ['plan 2 hours','plan from 4 to 6','plan everything','make me a schedule'])assert.doesNotMatch(ask(line).message,/Homework for/,line);assert.match(ask('plan catch up').message,/missing work/);});
test('a plan keeps the hours it was given',()=>{assert.match(ask('plan from 4 to 6').message,/^Today 4:00 PM/);assert.match(ask('plan 2 hours').message,/to 3:\d\d PM/);});
test('wanting only one thing plans only that thing',()=>{const one=ask('tomorrow i just want to do the cardboard bridge');assert.equal(one.action,'plan');assert.match(one.message,/^Tomorrow .*Cardboard Bridge/);assert.doesNotMatch(one.message,/Worksheet/);const course=ask('tomorrow i only want to do chem');assert.equal(course.action,'plan');assert.doesNotMatch(course.message,/Cardboard|Quiz/);});

for(const [line,action,words] of [
 ['what do i have tomorrow','find',/Equilibrium Worksheet/],
 ['what about tomorrow','find',/^1 thing due tomorrow: Equilibrium Worksheet/],
 ['and friday','find',/^Nothing due Fri/],
 ['when is the kinetics test','open',/due Mon, Nov 9, 1:30 PM/],
 ['any quizzes this week','open',/^Aeneid Quiz II, due Tuesday/],
 ['any exams this week','chat',/^No exams this week/],
 ['did i turn in the cardboard bridge','open',/^Not yet/],
 ['what did i forget','find',/still open/],
 ['am i behind','find',/^A little\./],
 ['how long will my homework take','find',/for this week, my guess/],
 ['what is the quickest thing','focus',/about 25 min/],
 ['whats worth the most points','open',/looks biggest/],
])test('the list: '+line,()=>{const r=ask(line);assert.equal(r.action,action);assert.match(r.message,words);});

for(const [line,action,words] of [
 ['i already did the cardboard bridge','complete',/^Mark Cardboard Bridge done/],
 ['mark the quiz done','complete',/Aeneid Quiz II/],
 ['i did that already','chat',/^Which one/],
 ['not that one','chat',/^Which one/],
 ['yes','chat',/^Okay/],
 ['maybe later','chat',/I am here/],
 ['thanks','chat',/^You are welcome/],
 ['asdfgh','none',/^Say a bit more/],
 ['study chem','focus',/Equilibrium Worksheet/],
 ['quiz me','ai',/quiz you on Aeneid/],
 ['this is too hard','ai',/^Stuck happens/],
 ['i go to bed at 11','setting',/^Bedtime 11:00 PM/],
 ['go away','setting',/^Hide the companion/],
])test('talk: '+line,()=>{const r=ask(line);assert.equal(r.action,action);assert.match(r.message,words);});

test('reminders read like a person wrote them',()=>{assert.match(ask('remind me to bring my lab goggles tomorrow').message,/^Remind you to bring your lab goggles/);assert.match(ask('remind me at 7 to study').message,/^Remind you to study, Sun, Nov 1, 7:00 PM/);});
test('questions are never taken for work to add',()=>{assert.notEqual(ask('what do i need to do for the cardboard bridge').action,'task');assert.equal(ask('how do i start the essay').action,'ai');});

test('Full answers everyday lines by the rules, not the trained pack',async()=>{
 await R.load('most');
 for(const line of ['what do i have tomorrow','whats due','timer','how much time is left','i finished the cardboard bridge','thanks']){const full=ask(line,'most'),lite=ask(line,'lite');assert.deepEqual([full.action,full.message],[lite.action,lite.message],line);}
});

test('what was just talked about carries over',()=>{
 const session={lastItemId:'5',itemId:'5'},say=line=>E.evaluate(line,world(),session);
 assert.match(say('how long will it take').message,/^About \d+ min/);assert.equal(say('i did it').action,'complete');assert.match(say('start it').message,/Cardboard Bridge/);assert.match(say('why').message,/^Because /);
 assert.notEqual(say('something else').items[0].id,'5');
 assert.match(ask('how long will it take').message,/^Which one/);
});
test('a follow-up event does not take "and" for its name',()=>assert.match(ask('and practice at 7').message,/^Practice/));

test('what is new reads the list Home already keeps',()=>{
 assert.match(ask('whats new').message,/^Nothing new/);
 const r=E.evaluate('whats new',world('lite',{newWork:['7','10']}),{});assert.match(r.message,/^2 new since you last looked: Solar Car Build, Equilibrium Worksheet\.$/);
});
