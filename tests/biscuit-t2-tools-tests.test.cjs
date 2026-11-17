'use strict';
// T2 (2026-11-16): a tool named alone opens it in Tools; "where is" says its place first and offers Open. The tests,
// quizzes and exams ahead are listed nearest first with course, day and time; one is that one with its day in words;
// none is said plainly and offers what is due instead, never some other item. What counts as a test: a Canvas quiz, a
// title word, an assignment group, a calendar event, or a recent announcement that names a test with a date.
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../extension/biscuit-engine.js'),A=require('../extension/biscuit-answer.js');
// Wednesday 2026-11-18, 3:00 PM in New York
const now=Date.parse('2026-11-18T20:00:00Z'),day=864e5,at=(d,h=13,m=30)=>{const x=new Date(now+d*day);x.setUTCHours(h,m,0,0);return x.toISOString();};
const courses=[{id:'10',name:'Chemistry 11-Birch',shortName:'Chemistry'},{id:'20',name:'AP Calculus BC',shortName:'Calc BC'},{id:'30',name:'English: Modern Fiction',shortName:'Modern Fiction'},{id:'40',name:'Spanish 3',shortName:'Spanish'},{id:'50',name:'German 2',shortName:'German'}];
const assignments=[
 {id:'a1',title:'Kinetics Test',courseId:'10',dueAt:at(2)},                        // Friday
 {id:'a2',title:'Unit 5 Quiz',courseId:'20',dueAt:at(1)},                          // Thursday
 {id:'a3',title:'Vocabulario 7',courseId:'40',dueAt:at(5),submissionTypes:['online_quiz'],quizId:'77'}, // a Canvas quiz, Monday
 {id:'a4',title:'Chapter 9 check',courseId:'30',dueAt:at(6),assignmentGroup:{name:'Tests & Quizzes'}}, // a test by its group
 {id:'a5',title:'Kinetics Test corrections',courseId:'10',dueAt:at(4)},            // not a test
 {id:'a6',title:'Final draft: research essay',courseId:'30',dueAt:at(3)},          // not a test
 {id:'a7',title:'Problem Set 12',courseId:'20',dueAt:at(1)},
 {id:'a8',title:'Lab report: rates',courseId:'10',dueAt:at(3)},
 {id:'a9',title:'Midterm exam',courseId:'20',dueAt:at(20)},                         // beyond two weeks
 {id:'a10',title:'Old Quiz 3',courseId:'30',dueAt:at(-3),submitted:true}
];
const events=[{id:'e1',title:'Spanish oral exam',courseId:'40',start:at(7,15,0),kind:'event'},{id:'e2',title:'Chemistry review session',courseId:'10',start:at(1,21,0),kind:'event'}];
const announcements=[
 {id:'n1',title:'German test next week',message:'<p>Our Unit 4 test is on Tuesday, November 24. Bring a pencil.</p>',courseId:'50',posted_at:at(-1,14,0)},
 {id:'n2',title:'Reminder',message:'<p>The quiz is Friday, November 26.</p>',courseId:'50',posted_at:at(-1,14,0)}, // Nov 26 is a Thursday: two days, so no day
 {id:'n3',title:'Old news',message:'<p>Test on Friday 10/2.</p>',courseId:'50',posted_at:at(-40,14,0)}
];
const features=[{id:'tools',on:true},{id:'gpa',on:true}];
const world=(extra={})=>({now,timeZone:'America/New_York',ai:true,pet:{knowledge:'lite'},settings:{showGrades:true,timeZone:'America/New_York'},courses,assignments,workItems:[],personalTasks:[],files:[],events,announcements,features,pageKind:'dashboard',...extra});
const ask=(line,extra)=>{const s=world(extra),r=E.evaluate(line,s,{});return {r,a:A.build(r,s,{},{line})};};

test('a tool named alone or with open / show / use opens it, the right calculator when the words say which',()=>{
 for(const [line,tool,mode] of [['calculator','calculator',undefined],['open calculator','calculator',undefined],['desmos','calculator','graphing'],['open desmos pls','calculator','graphing'],['graphing calc','calculator','graphing'],['show me the graphing calculator','calculator','graphing'],['sci calc','calculator','scientific'],['use the scientific calculator','calculator','scientific'],['gpa','gpa',undefined],['quick open','quick',undefined]]){
  const {r,a}=ask(line);assert.equal(r.action,'navigate',line);assert.equal(r.next.fields.tool,tool,line);assert.equal(r.next.fields.mode,mode,line);assert.equal(r.next.fields.tab,undefined,line);
  assert.equal(a.kind,'place',line);assert.equal(a.acts[0].label,'Open',line);assert.deepEqual(a.acts[0].fields,r.next.fields,line);
 }
});
test('"calc" is the Calculus course when one is called that; "calculator" is always the tool',()=>{
 assert.notEqual(ask('calc').r.next?.fields?.tool,'calculator');assert.notEqual(ask('calc hw').r.next?.fields?.tool,'calculator');
 const other=world({courses:courses.filter(c=>c.id!=='20')});assert.equal(E.evaluate('calc',other,{}).next.fields.tool,'calculator');
 assert.equal(ask('calculator').r.next.fields.tool,'calculator');
});
test('where is / how do i open a tool: its place first, an Open act, nothing changed',()=>{
 for(const line of ['where is the calculator','how do i open desmos','where is gpa']){const {r,a}=ask(line);assert.equal(r.action,'none',line);assert.equal(r.ui.path[0],'Tools',line);assert.match(r.message,/Tools > /,line);const open=a.acts.find(x=>x.label==='Open');assert.ok(open,line);assert.equal(open.intent,'navigate');assert.ok(open.fields.tool,line);assert.ok(!a.acts.some(x=>x.intent==='point'),line+': Show me only points inside Make it yours');}
 assert.equal(ask('how do i open desmos').a.acts.find(x=>x.label==='Open').fields.mode,'graphing');
});
test('Tools off: says so, opens nothing',()=>{const {r}=ask('calculator',{features:[{id:'tools',on:false}]});assert.equal(r.action,'none');assert.match(r.message,/is off/);});

test('tests ahead are listed nearest first with course, day and time; only tests count',()=>{
 for(const line of ['upcoming test','tests','test?','next test','any tests','what tests do i have','when is my next test','any tests coming up','upcoming exams and quizzes']){
  const {r,a}=ask(line);assert.equal(r.action,'find',line);assert.equal(r.next.fields.itemId,undefined,line+': a list opens no one item');assert.equal(a.kind,'list',line);
  const ids=a.rows.map(x=>x.id);assert.deepEqual(ids,['a2','a1','a3','a4','n1','e1'],line);
  for(const row of a.rows){assert.ok(row.course?.short,line+': course');assert.match(row.due.text,/^(?:Today|Tomorrow|[A-Z][a-z]+day|[A-Z][a-z]{2}, [A-Z][a-z]{2} \d+)/,line+': day');}
  assert.match(a.rows[0].due.text,/^Tomorrow 8:30 AM$/,line+': time');
 }
 const n=ask('tests').a.rows.find(x=>x.id==='n1');assert.equal(n.dayOnly,true);assert.doesNotMatch(n.due.text,/\d:\d\d/,'an announcement that gives no time states no time');const g=ask('when is the german test').r;assert.equal(g.next.fields.itemId,'n1');assert.match(g.message,/^Unit 4 test \(German\) is Tuesday, Nov 24 \(no time given\) \(from a German announcement\)\.$/);
});
test('one test: that one with its day in words; a course with none says so plainly and opens nothing',()=>{
 let {r,a}=ask('when is my chem test');assert.equal(r.action,'find');assert.equal(r.next.fields.itemId,'a1');assert.match(r.message,/^Kinetics Test \(Chemistry\) is Friday, Nov 20 at 8:30 AM\.$/);assert.equal(a.kind,'fact');assert.match(a.value.text,/^Friday, Nov 20 · 8:30 AM$/);
 ({r,a}=ask('chem test'));assert.equal(r.next.fields.itemId,'a1');
 ({r,a}=ask('when is the modern fiction final'));assert.equal(r.action,'none');assert.match(r.message,/^No final found for Modern Fiction in the next two weeks\./);assert.equal(a.kind,'none');for(const row of a.rows)assert.equal(row.course.id,'30','what is due instead is that course\'s');
 ({r}=ask('spanish quiz wen'));assert.equal(r.next.fields.itemId,'a3','a Canvas quiz counts');
});
test('a day: the tests that day, or none for that day; never another day\'s item',()=>{
 let {r,a}=ask('quiz tmrw?');assert.equal(r.action,'find');assert.equal(r.next.fields.itemId,'a2');assert.match(r.message,/is tomorrow at 8:30 AM/);
 ({r}=ask('do i have a test fri'));assert.equal(r.next.fields.itemId,'a1');assert.match(r.message,/Friday, Nov 20/);
 ({r,a}=ask('is there a quiz on saturday'));assert.equal(r.action,'none');assert.match(r.message,/^No quizzes found for Saturday\./);assert.ok(!a.rows.some(x=>/quiz/i.test(x.name)&&x.due.at&&new Date(x.due.at).getUTCDay()===6));
 ({r}=ask('test tmrw'));assert.notEqual(r.action,'task','a question about tests never adds a to-do');
 ({r}=ask('quiz today'));assert.equal(r.action,'none');assert.match(r.message,/^No quizzes found for today\./);
 ({r,a}=ask('any tests this week'));assert.equal(a.kind,'list');assert.deepEqual(a.rows.map(x=>x.id),['a2','a1'],'the week ends on Sunday');
 ({r,a}=ask('tests next week'));assert.deepEqual(a.rows.map(x=>x.id),['a3','a4','n1','e1']);
});
test('a weekday that is today means today, then the same day next week',()=>{
 const wed=world({assignments:[{id:'w1',title:'Bio Quiz',courseId:'10',dueAt:at(7)}]});const r=E.evaluate('quiz wed?',wed,{});assert.equal(r.next.fields.itemId,'w1');assert.match(r.message,/Wednesday, Nov 25/);
});
test('lines with test words that are not "the tests ahead" keep their own answers',()=>{
 assert.notEqual(ask('quiz me').r.message,ask('tests').r.message);
 for(const line of ['quiz me','what do i need on the chem test','i finished the chem test','answers to the chem quiz','i have to study for my drivers test','open the chem test','i have a chem test tomorrow','help me study for my chem test'])assert.notEqual(ask(line).r.understanding?.reason,'mind:tests-ahead',line);
 assert.equal(ask('i finished the chem test').r.action,'complete');
 assert.notEqual(ask('answers to the chem quiz').r.action,'find');
 assert.equal(ask('i have to study for my drivers test').r.action,'task');
 assert.equal(ask('open the chem test').r.next.fields.itemId,'a1');
});
test('none at all: says so, offers what is due, adds nothing',()=>{
 const empty=world({assignments:assignments.filter(v=>['a6','a7','a8'].includes(v.id)),events:[],announcements:[]});const r=E.evaluate('upcoming test',empty,{}),a=A.build(r,empty,{},{line:'upcoming test'});
 assert.equal(r.action,'none');assert.match(r.message,/^No tests, quizzes or exams found in the next two weeks\./);assert.equal(a.kind,'none');assert.ok(a.rows.length<=1);
});
test('a named test outside the window is still that one, with its own day; a subject with no course says none',()=>{
 let {r}=ask('when is the calc midterm exam');assert.equal(r.next.fields.itemId,'a9');assert.match(r.message,/^Midterm exam \(Calc BC\) is Tuesday, Dec 8 at 8:30 AM\.$/);
 ({r}=ask('midterms'));assert.equal(r.action,'none');assert.match(r.message,/^No midterms found in the next two weeks\. The next one is Midterm exam \(Calc BC\), Tuesday, Dec 8 at 8:30 AM\.$/);
 ({r}=ask('bio quiz tmrw?'));assert.equal(r.action,'none','no biology course: none, never another course\'s quiz');assert.match(r.message,/^No quiz found for bio tomorrow\./);
 ({r}=ask('when is the german test'));assert.deepEqual({...r.next.fields,url:undefined},{itemId:'n1',entryId:'n1',kind:'announcement',url:undefined},'an announcement\'s test opens the announcement');
});
test('two courses of the same name: Biscuit asks which, as before (not this reading)',()=>{
 const two=world({courses:[...courses,{id:'60',name:'Chemistry 11 Lab',shortName:'Chemistry Lab'}]});assert.notEqual(E.evaluate('chem test',two,{}).understanding?.reason,'mind:tests-ahead');
});
test('handed-in work (Canvas state submitted or graded) is never "not yet"; every lab of the course in: yes, all of them',()=>{
 const t0=Date.parse('2026-11-17T03:40:00Z'),iso=d=>new Date(t0+d*864e5).toISOString();
 const w={now:t0,timeZone:'America/New_York',settings:{showGrades:true},courses:[{id:'101',name:'Chemistry'},{id:'106',name:'Physics'}],assignments:[{id:'p1',title:'Density lab',courseId:'106',dueAt:iso(-18),state:'graded'},{id:'p2',title:'Gas laws lab',courseId:'106',dueAt:iso(-17),state:'graded'},{id:'c1',title:'Titration lab',courseId:'101',dueAt:iso(9)}]};
 let r=E.evaluate('did i submit the physics lab',w,{});assert.match(r.message,/^Yes, both Physics labs are in: Density lab, Gas laws lab\.$/);
 r=E.evaluate('did i submit the density lab',w,{});assert.match(r.message,/^Yes, Density lab is in\./);
 r=E.evaluate('did i turn in the chem lab',w,{});assert.match(r.message,/^Not yet\. Titration lab/);
});
test('a control named in quotes is the one with exactly that label, not a lookalike that differs in punctuation',()=>{
 const C=require('../extension/biscuit-controls.js');
 assert.deepEqual(C.propose('where is "{label} {count}" in Home?',{now})?.ui?.path,['Home','{label} {count}']);
 // (Biscuit's own answer chips, biscuit-view.js, are not controls in the public catalogue, so the '·' lookalike is not there)
 assert.deepEqual(C.propose('where is "Put back" in Home?',{now})?.ui?.path,['Home','Put back']);
});
