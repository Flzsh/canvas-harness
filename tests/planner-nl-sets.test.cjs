'use strict';
require('../extension/site.js');
// The Planner's quick add, measured on two sealed sets of student lines (4.2, second round): set T (200 lines, used to
// improve the reader) and set U (150 lines, never tuned on). Each line is read on its own day and clock. Also: a reading
// that is a guess says so and keeps the other reading one press away; a line that is not a plan is left alone; "move X
// to <day>" moves the task that is there. Sample data only.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const P=require('../extension/planner-model.js'),K=require('./planner-nl-corpus.cjs'),T=require('./planner-nl-set-t.cjs'),U=require('./planner-nl-set-u.cjs');
const here=f=>path.join(__dirname,f),ext=f=>path.join(__dirname,'..','extension',f);
// what the Planner does with a line: the reader's answer, with the day of the field it was typed in when it names none
function check([typed,when,name,day,x={}]){
 const [today,clock='16:00']=String(when).split(' '),[h,m]=clock.split(':').map(Number);
 const r=P.parseQuick(typed,today,{courses:K.COURSES,now:h*60+m,...(x.field?{day:x.field}:{})});
 const want={name:K.fold(name),day,due:!!x.due,at:x.at||'',min:x.min||0,course:x.course||'',rep:x.rep||'',pri:!!x.pri,none:!!x.none,move:!!x.move};
 const got={name:K.fold(r.notTask?'':r.name),day:r.notTask?'':(r.day||x.field||''),due:!!r.due,at:r.at||'',min:r.estimate||0,course:r.courseId||'',rep:P.repeatKey(r.repeat),pri:r.priority==='high',none:!!r.notTask,move:!!r.move};
 return Object.keys(want).filter(k=>want[k]!==got[k]).map(k=>`${k}: wanted ${JSON.stringify(want[k])}, read ${JSON.stringify(got[k])}`);
}
const misses=lines=>lines.map(l=>[l,check(l)]).filter(([,bad])=>bad.length).map(([l,bad])=>`${l[0]} [${l[1]}] -> ${bad.join('; ')}`);

test('sets T and U are the sealed ones (U is a measure only: any change to it shows here)',()=>{
 const seal=JSON.parse(fs.readFileSync(here('planner-nl-sets.seal.json'),'utf8')),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(here(f),'utf8').replace(/\r\n/g,'\n')).digest('hex');
 assert.equal(hash(seal.t.file),seal.t.sha256,'set T changed since it was sealed');assert.equal(hash(seal.u.file),seal.u.sha256,'set U changed since it was sealed');
 assert.equal(T.length,200);assert.equal(U.length,150);
 const old=new Set([...K.CASES,...K.HELD].map(c=>c[0].toLowerCase())),all=[...T,...U].map(l=>l[0].toLowerCase());
 assert.equal(new Set(all).size,all.length,'no line twice');assert.ok(all.every(t=>!old.has(t)),'no line from the old corpus');
});
test('every line of set T reads as the student meant (day, time, deadline, length, course, repeat, importance, name)',()=>{
 const bad=misses(T);assert.deepEqual(bad,[],`${bad.length} of ${T.length} read wrong:\n${bad.join('\n')}`);
});
test('set U, never tuned on, reads at least as well as when it was first measured (147 of 150)',()=>{
 const bad=misses(U);assert.ok(U.length-bad.length>=147,`${U.length-bad.length} of ${U.length}:\n${bad.join('\n')}`);
});

test('a reading that may not be what was meant is marked as a guess, with the other reading kept',()=>{
 const read=(t,day,clock='09:00',ignore=[])=>{const [h,m]=clock.split(':').map(Number);return P.parseQuick(t,day,{courses:K.COURSES,now:h*60+m,ignore});};
 // "fri" said on a Friday: next Friday (the rule), today one press away
 let r=read('chem lab fri','2026-11-27');assert.equal(r.day,'2026-12-04');assert.deepEqual(r.guess,{date:'2026-11-27'});
 r=read('chem lab fri','2026-11-27','09:00',['alt-date']);assert.equal(r.day,'2026-11-27');assert.equal(r.guess,undefined);
 // "next wed" on a Monday: Wednesday of next week, or this Wednesday
 r=read('quiz next wed','2026-11-23');assert.equal(r.day,'2026-12-02');assert.deepEqual(r.guess,{date:'2026-11-25'});
 assert.equal(read('quiz next wed','2026-11-26').guess,undefined,'said on Thursday, "next wed" can only be the coming one');
 // "next week" / "next month" with no day: Monday / the 1st, marked; the press takes the day back
 assert.deepEqual(read('start research next week','2026-11-25').guess,{date:''});assert.deepEqual(read('budget next month','2026-11-25').guess,{date:''});
 // "this weekend": Saturday, or Sunday
 assert.deepEqual(read('clean room this weekend','2026-11-25').guess,{date:'2026-11-29'});
 // "tmrw" typed after midnight: the day after, or the day that has just begun
 assert.deepEqual(read('essay tmrw','2026-11-24','00:40').guess,{date:'2026-11-24'});assert.equal(read('essay tmrw','2026-11-24','06:00').guess,undefined);
 // an hour from 5 to 11 with no am/pm: the usual half, the other one press away; not when the other has already gone today
 r=read('practice at 9','2026-11-24','08:00');assert.equal(r.at,'09:00');assert.deepEqual(r.guess,{time:'21:00'});
 assert.equal(read('practice at 9','2026-11-24','08:00',['alt-time']).at,'21:00');
 assert.equal(read('call mom at 7','2026-11-25','15:00').guess,undefined,'7 this morning has gone: 7 PM is meant');
 assert.equal(read('call at 2','2026-11-25','09:00').guess,undefined,'2 is the afternoon');assert.equal(read('gym 6pm fri','2026-11-25').guess,undefined);
 assert.equal(read('meet tutor tonight at 9','2026-11-25').guess,undefined,'tonight says which half');
});

test('words that only look like hours stay in the name; an hour said after a day or at the end is read',()=>{
 const read=t=>P.parseQuick(t,'2026-11-23',{courses:K.COURSES,now:16*60});
 for(const t of ['quiz 2 fri','fri quiz 2','fri read ch 4-6','fri hw 6','practice fri 3 chapters','sat 2 games','fri period 3','ethics reading ch 3 & 4 thursday','gym 6'])assert.equal(read(t).at,'',t);
 assert.equal(read('dinner w grandma sun 6').at,'18:00');assert.equal(read('fri 3-5').estimate,120);assert.equal(read('every mon 6').at,'18:00');assert.equal(read('6ish dinner').at,'18:00');
 assert.equal(read('end of day reflection').name,'end of day reflection');assert.equal(read('move to new house sat').move,undefined);
 assert.equal(read('study w/ sam fri').repeat,null);assert.equal(read('t/f quiz fri').repeat,null);assert.equal(read('push ups every morning').move,undefined);
 assert.equal(read('what if essay').notTask,undefined);assert.equal(read('how to train your dragon essay fri').notTask,undefined);assert.equal(read('do my hw tmrw').notTask,undefined);
 assert.equal(read('todo').name,'todo','a filler alone stays a word');
});

// The page's reading line, drawn in a sandbox of its own (as planner-42.test.cjs does)
function sandbox(){
 const box={console,Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map,RegExp,Error};box.globalThis=box;vm.createContext(box);
 for(const file of ['site.js','core.js','planner-model.js','widgets.js','planner-ui.js'])vm.runInContext(fs.readFileSync(ext(file),'utf8'),box,{filename:file});
 const h={formatDate:(v,tz,o)=>new Intl.DateTimeFormat('en-US',{timeZone:tz,...o}).format(new Date(v))};
 return {UI:box.ReservePlannerUI,h};
}
const plainJSON=v=>JSON.parse(JSON.stringify(v));   // values from the sandbox, compared as plain data
const opts=(h,extra={})=>({today:'2026-11-27',now:9*60,courses:K.COURSES,ignore:[],tz:'America/New_York',formatDate:h.formatDate,...extra});
test('the reading line: a guess shows a pen "?" and its other reading; not a plan is left alone; a move names the task',()=>{
 const {UI,h}=sandbox();
 let r=UI.reading('chem lab fri',opts(h));const date=r.chips.find(c=>c.kind==='date');
 assert.equal(date.text,'Fri, Dec 4');assert.equal(date.guess,true);assert.equal(date.alt,'Today');
 r=UI.reading('chem lab fri',opts(h,{ignore:['alt-date']}));assert.equal(r.parsed.day,'2026-11-27');assert.equal(r.chips.find(c=>c.kind==='date').guess,undefined);
 // not a plan: one tag, no name (Enter adds nothing), and the tag pressed reads it as a task
 r=UI.reading("what's due tmrw?",opts(h));assert.deepEqual(plainJSON(r.chips.map(c=>[c.kind,c.text])),[['notask','Not a task']]);assert.equal(r.parsed.name,'');
 r=UI.reading("what's due tmrw?",opts(h,{ignore:['notask']}));assert.ok(r.parsed.name);assert.equal(r.chips[0].kind,'notask');assert.equal(r.chips[0].off,true);
 // a move: the one open task the words name; with none there, the same words are a new task
 const list=[{id:'local-m',title:'Math HW',courseId:'personal',done:false},{id:'31',title:'Quiz 4',courseId:'101',done:false},{id:'32',title:'Lab report',courseId:'101',done:true}];
 r=UI.reading('move math hw to sat',opts(h,{list}));assert.equal(r.parsed.moveId,'local-m');assert.equal(r.parsed.day,'2026-11-28');assert.deepEqual(plainJSON(r.chips.map(c=>c.kind)),['move','date']);assert.equal(r.chips[0].text,'Move Math HW');
 r=UI.reading('push chem quiz to mon',opts(h,{list:()=>list}));assert.equal(r.parsed.moveId,'31','"chem" names the course of Quiz 4');
 r=UI.reading('move lab report to mon',opts(h,{list}));assert.equal(r.parsed.moveId,undefined,'finished work is not moved');assert.equal(r.parsed.name,'move lab report');assert.equal(r.parsed.day,'2026-11-30');
 r=UI.reading('move furniture to sat',opts(h,{list}));assert.equal(r.parsed.moveId,undefined);assert.equal(r.parsed.name,'move furniture');
});
test('a guessed tag: pressed once it takes the other reading, twice it is taken back, three times it is read again',()=>{
 const {UI,h}=sandbox(),drafts=[];
 const container={ownerDocument:{addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],dataset:{}};
 const planner=UI.create({container,store:{get:()=>({})},save:async()=>true,rerender(){},getContext:()=>({now:Date.parse('2026-11-27T14:00:00Z'),s:{timeZone:'America/New_York'},courses:K.COURSES,items:[],local:{},personal:{}}),helpers:()=>({dayKey:()=>'2026-11-27',formatDate:h.formatDate})});
 planner.ui.drafts['']={text:'chem lab fri',ignore:[]};
 const press=chip=>planner.click({target:{closest:sel=>sel==='[data-rd-action]'?{dataset:{rdAction:'plan-chip',fieldDay:'',kind:chip.kind,...(chip.alt?{alt:'true'}:{})}}:null}});
 const chipNow=()=>UI.reading('chem lab fri',opts(h,{ignore:planner.ui.drafts[''].ignore})).chips.find(c=>c.kind==='date');
 press(chipNow());drafts.push([...planner.ui.drafts[''].ignore]);assert.equal(chipNow().text,'Today');
 press(chipNow());drafts.push([...planner.ui.drafts[''].ignore]);assert.equal(chipNow().off,true);
 press(chipNow());drafts.push([...planner.ui.drafts[''].ignore]);assert.equal(chipNow().guess,true);
 assert.deepEqual(drafts,[['alt-date'],['date'],[]]);
});
test('the tag markup: a guess carries the pen "?" and says its other reading aloud',()=>{
 const src=fs.readFileSync(ext('planner-ui.js'),'utf8');
 assert.match(src,/data-guess="true"\$\{c\.alt\?' data-alt="true"':''\}/);assert.match(src,/class="rd-plan-q"/);
 assert.match(src,/a guess: \$\{c\.alt\?`press for \$\{c\.alt\}`:'press to take it back'\}/);
 assert.match(fs.readFileSync(ext('widgets.css'),'utf8'),/\.rd \.rd-plan-chip\[data-guess=true\] > span \{[^}]*underline dotted/);
});
test('a deadline read on or for the daylight-saving days lands at the wall-clock time the student typed',()=>{
 const due=(t,day)=>{const r=P.parseQuick(t,day,{courses:K.COURSES,now:16*60});return P.instant(r.day,r.at||'23:59','America/New_York');};
 assert.equal(due('lab due sun 11:59pm','2027-03-12'),'2027-03-15T03:59:00.000Z','2027-03-14: clocks went forward, 11:59 PM is EDT');
 assert.equal(due('essay due sun 11:59pm','2026-10-30'),'2026-11-02T04:59:00.000Z','2026-11-01: clocks went back, 11:59 PM is EST');
 assert.equal(due('physics hw due tmrw 8am','2026-10-31'),'2026-11-01T13:00:00.000Z');assert.equal(due('lab due tmrw 8am','2027-03-13'),'2027-03-14T12:00:00.000Z');
});
