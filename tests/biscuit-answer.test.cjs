'use strict';
// Biscuit's answers as data (biscuit-answer.js) and drawn (biscuit-view.js), on a made-up student. Every kind he can be in:
// what the student sees must name the work, its course, its due time and length, and keep the rest reachable.
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../extension/biscuit-engine.js'),C=require('../extension/biscuit-controls.js');
const A=require('../extension/biscuit-answer.js'),V=require('../extension/biscuit-view.js');
// the two modules publish themselves on globalThis; the rest of the suite runs in this process and must not see them
delete globalThis.ReserveBiscuitAnswer;delete globalThis.ReserveBiscuitView;
const {world,wall}=require('./fixtures/biscuit-answer-world.cjs');
const DAY=wall(2026,11,11,16,30),NIGHT=wall(2026,11,14,0,50);
const lite={pet:{knowledge:'lite'}};
function ask(line,{at=DAY,variant='normal',grades=false}={}){const s=world({at,variant,grades,extra:lite});const c=(C.featureControl&&C.featureControl(line,s))||E.evaluate(line,s,{});return {s,c,a:A.build(c,s,{},{line})};}
const draw=(a,st={})=>V.render(a,{zone:'America/New_York',rowActs:A.rowActs,...st});
const work=a=>a.rows.filter(r=>r.type==='work');

test('a day plan is a timeline: each block has a start, an end, the work, its course and how long',()=>{
 const {a}=ask('plan my day');
 assert.equal(a.kind,'plan');assert.match(a.title,/^Today, 4:30 – \d+:\d\d PM$/);assert.match(a.summary,/^3 things · 2 h 15 min of work/);
 for(const r of work(a)){assert.ok(r.start<r.end,'start before end');assert.ok(r.course?.short,'course on '+r.name);assert.ok(r.due.text);assert.ok(r.minutes>0);assert.ok(['saved','guess'].includes(r.minutesFrom));}
 assert.ok(a.rows.some(r=>r.type==='break'),'breaks are rows');
 const times=a.rows.map(r=>r.start);assert.deepEqual(times,[...times].sort((x,y)=>x-y),'in time order');
 assert.equal(a.acts[0].label,'Use this plan');assert.equal(a.acts[0].intent,'plan');assert.ok(a.acts[0].primary);
 assert.ok(a.notes.some(n=>n.key==='later'),'what can wait is said');
});
test('a plan asked after midnight starts when the day starts, not in the night',()=>{
 const {a}=ask('plan my day',{at:NIGHT});assert.equal(a.kind,'plan');assert.match(a.title,/^Today, 10:00/);
 for(const r of a.rows)assert.ok(new Date(r.start).getUTCHours()>=15,'no block before 10 AM local');
});
test('late work in a plan is marked late on its row and on top',()=>{
 const {a}=ask('plan catch up');assert.equal(a.kind,'plan');const late=work(a).filter(r=>r.state==='late');
 assert.ok(late.length,'catch up plans late work');for(const r of late)assert.match(r.due.short,/late$/);
 assert.ok(a.notes.some(n=>n.key==='late'&&/late$/.test(n.text)));
});
test('a plan around something named draws that time as busy',()=>{
 const {a}=ask('i have swim practice 5 to 7 tomorrow');assert.equal(a.kind,'plan');assert.ok(a.rows.some(r=>r.type==='busy'),'busy row');
});
test('a week plan groups work by day',()=>{
 const {a}=ask('plan my week');assert.equal(a.kind,'week');assert.ok(a.groups.length>=3);for(const g of a.groups)assert.ok(g.label&&g.rows.length);
});
test('a list shows the whole list the sentence cut to three, grouped by when, with course filters',()=>{
 const {a,c}=ask('what is due this week');assert.equal(a.kind,'list');assert.equal(c.items.length,3);assert.equal(a.rows.length,8);
 assert.deepEqual(a.groups.map(g=>g.label),['Today','Tomorrow','This week']);assert.ok(a.filters.length>=4);
 assert.equal(a.acts[0].label,'Plan these');assert.equal(a.acts[0].fields.itemIds.length,8);
});
test('late work: every one named, with its course, even when two share a date-only title',()=>{
 const {a}=ask('what did i forget');assert.equal(a.kind,'list');assert.equal(a.rows.length,5);
 const same=a.rows.filter(r=>r.name==='Homework for Wednesday, 11/11/2026');assert.equal(same.length,2);assert.notEqual(same[0].course.short,same[1].course.short);
 for(const r of a.rows){assert.equal(r.state,'late');assert.match(r.due.short,/days? late$/);}
});
test('one course, and one day',()=>{
 assert.ok(ask('whats left for chem').a.rows.every(r=>r.course.short==='Chemistry'));
 const t=ask('what do i have tomorrow').a;assert.equal(t.kind,'list');assert.equal(t.title,'Due tomorrow');assert.equal(t.rows.length,2);
});
test('one assignment carries its details: the start of the instructions, links, how it is handed in, an open link',()=>{
 const {a}=ask('open the kinetics test');assert.equal(a.kind,'item');const r=a.rows[0];
 assert.equal(r.name,'Kinetics Test');assert.equal(r.points,100);assert.match(r.detail.text,/^Kinetics Test\.\nAnswer every question/);assert.doesNotMatch(r.detail.text,/<|&lt;/);
 assert.deepEqual(r.detail.links.map(l=>l.kind),['file','link']);assert.deepEqual(r.detail.submit,['File upload']);
 const canvas=a.acts.find(x=>x.intent==='link');assert.equal(canvas.link,'https://school.instructure.com/courses/10/assignments/106');
 for(const label of ['Open','Plan it','Focus','Mark done','Bookmark','Help with this'])assert.ok(a.acts.some(x=>x.label===label||x.label==='Bookmarked'&&label==='Bookmark'),label);
 assert.doesNotMatch(a.text,/submission types/);
});
test('single facts: when, and turned in',()=>{
 const w=ask('when is the kinetics test').a;assert.equal(w.kind,'fact');assert.equal(w.value.label,'Due');assert.match(w.value.text,/^Sunday, Nov 15 · 8:00 AM$/);assert.equal(w.value.sub,'in 4 days');
 const t=ask('did i turn in the cardboard bridge').a;assert.equal(t.kind,'fact');assert.equal(t.value.text,'Not yet');assert.equal(t.rows[0].state,'late');
});
test('grades, and grades while hidden',()=>{
 assert.equal(ask('what is my chem grade').a.kind,'blocked');assert.equal(ask('what is my chem grade').a.acts[0].fields.key,'showGrades');
});
test('announcements and files are rows with their own facts and plain text',()=>{
 const m=ask('any announcements').a;assert.equal(m.kind,'messages');assert.ok(m.rows.length>=2);for(const r of m.rows)assert.doesNotMatch(r.excerpt||'',/<p>/);assert.ok(m.rows.some(r=>r.unread));
 const f=ask('find the kinetics review sheet').a;assert.equal(f.kind,'files');assert.equal(f.rows[0].format,'PDF');assert.equal(f.rows[0].size,'210 KB');
 const p=ask('calc syllabus').a;assert.equal(p.kind,'files');assert.equal(p.rows[0].format,'Page');assert.match(p.rows[0].excerpt,/Late work loses 10% a day/);
});
test('a course, a question back, several steps',()=>{
 const pl=ask('open calc').a;assert.equal(pl.kind,'place');assert.equal(pl.title,'Calculus');assert.ok(pl.rows.length);
 const ch=ask('homework for wednesday').a;assert.equal(ch.kind,'choose');assert.deepEqual(ch.rows.map(r=>r.choice),[1,2]);
 const st=ask('dark mode and hide the clock').a;assert.equal(st.kind,'steps');assert.equal(st.rows.length,2);assert.ok(st.rows.every(r=>r.intent&&r.state==='waiting'));
});
test('a change shows what it will change before it changes',()=>{
 const done=ask('mark the cardboard bridge done').a;assert.equal(done.kind,'change');assert.deepEqual(done.rows[0].change,{from:'Late',to:'Done on your list'});assert.equal(done.acts[0].intent,'complete');
 const set=ask('dark mode').a;assert.equal(set.rows[0].to,'Dark');
 const rem=ask('remind me to study at 7').a;assert.match(rem.rows[0].to,/7:00/);
});
test('timer, feature help, AI handoff, nothing found, not understood, small talk',()=>{
 const t=ask('focus on the kinetics test for 30 min').a;assert.equal(t.kind,'timer');assert.equal(t.title,'Focus 30 min');assert.match(t.summary,/^Until 5:00 PM$/);assert.equal(t.rows[0].name,'Kinetics Test');
 const f=ask('how do i change the theme').a;assert.equal(f.kind,'feature');assert.deepEqual(f.path,['Make it yours','Look','Theme'],'the public catalogue names the theme setting Theme');assert.equal(f.acts[0].intent,'point');
 // ("where is the focus room" with the room off: the off card comes from the development build's featureControl, not in the public build)
 const ai=ask('explain equilibrium').a;assert.equal(ai.kind,'ai');assert.equal(ai.rows[0].name,'Equilibrium notes.pdf');
 const u=ask('asdfgh').a;assert.equal(u.kind,'unknown');assert.ok(u.follow.length>=2);
 const chat=ask('what can you do').a;assert.equal(chat.title,'Things to try');assert.ok(chat.follow.includes('plan tonight'));
});
test('no work at all: lists and plans say so instead of drawing empty frames',()=>{
 const l=ask('what is due this week',{variant:'empty'}).a;assert.ok(['none','chat'].includes(l.kind));assert.equal(l.rows.length,0);
 const p=ask('plan my day',{variant:'empty'}).a;assert.ok(['plan','none','chat'].includes(p.kind));
});
test('many items with long names: all kept, nothing cut from the data',()=>{
 const {a}=ask('what is due this week',{variant:'long'});assert.ok(a.rows.length>8);for(const r of a.rows)assert.ok(r.name.length>60);
});
test('a plan edited before it is used: drop, earlier, later, and dropping everything',()=>{
 const {s,a}=ask('plan my day'),ids=[...new Set(work(a).map(r=>r.itemId))];
 const dropped=A.edit(a,s,{op:'drop',itemId:ids[0]});assert.ok(!work(dropped).some(r=>r.itemId===ids[0]));assert.deepEqual(dropped.acts[0].fields.itemIds,ids.slice(1));
 const later=A.edit(a,s,{op:'later',itemId:ids[0]});assert.deepEqual([...new Set(work(later).map(r=>r.itemId))].slice(0,2),[ids[1],ids[0]]);
 let left=a;for(const id of ids)left=A.edit(left,s,{op:'drop',itemId:id});assert.equal(left.kind,'none');
});
test('after an act: what changed with undo, a failure with retry, offline, working',()=>{
 const {s,a}=ask('mark the cardboard bridge done');const d=A.result('complete',{},{ok:true,message:'Marked Cardboard Bridge done locally.'},s,a);
 assert.equal(d.kind,'done');assert.equal(d.rows[0].state,'done');
 assert.equal(A.result('plan',{},{ok:false,message:'The planner changed.'},s).acts[0].intent,'retry');
 assert.equal(A.offline({...s,loadedAt:s.now-3600e3}).summary,'Showing what loaded Today 3:30 PM');
 assert.equal(A.progress('Making your plan').kind,'progress');
});
test('every kind draws, escapes what it shows, and keeps one main act',()=>{
 const lines=['plan my day','plan my week','what should i do','what is due this week','open the kinetics test','when is the kinetics test','any announcements','find the kinetics review sheet','open calc','homework for wednesday','dark mode and hide the clock','mark the cardboard bridge done','focus on the kinetics test for 30 min','how do i change the theme','explain equilibrium','what is my chem grade','asdfgh','what can you do'];
 for(const line of lines){const {a}=ask(line),html=draw(a);assert.match(html,/^<section class="ba" data-ba-kind="/,line);assert.ok((html.match(/ba-btn--primary/g)||[]).length<=1,line+' has one main act');}
 const {a}=ask('open the kinetics test');a.rows[0].name='<img src=x onerror=alert(1)>';assert.doesNotMatch(draw(a),/<img src=x/);
});
test('drawn plan: one row per piece of work, its breaks inside it, details and edits on open',()=>{
 const {a}=ask('plan my day'),html=draw(a);assert.equal((html.match(/data-type="work"/g)||[]).length,3,'three pieces of work');assert.match(html,/1 break/);
 const first=V.mergeParts(a.rows).find(r=>r.type==='work'),open=draw(a,{open:{[first.id]:true}});
 assert.match(open,/data-ba-plan="drop"/);assert.match(open,/class="ba-detail"/);assert.match(open,/Answer every question/);assert.match(open,/data-ba-act="canvas:/);
});
test('drawn list: six rows at the bubble size then "Show N more"; one at a time; choose some',()=>{
 const {a}=ask('what is due this week',{variant:'long'}),html=draw(a);assert.equal((html.match(/class="ba-row"/g)||[]).length,6);assert.match(html,new RegExp('Show '+(a.rows.length-6)+' more'));
 assert.equal((draw(a,{all:true}).match(/class="ba-row"/g)||[]).length,a.rows.length);
 assert.match(draw(a,{step:0}),/1 of \d+/);
 const pick=draw(a,{picking:'plan-these',picked:{[a.rows[0].id]:false}});assert.match(pick,new RegExp('Plan these · '+(a.rows.length-1)));
});
test('follow-ups work on the answer on screen: only a course, show more, the second one, which one',()=>{
 const {s,a}=ask('what is due this week'),line=l=>{const c=E.evaluate(l,s,{});return A.build(c,s,{},{line:l,previous:a});};
 const only=line('only chem');assert.equal(only.kind,'list');assert.equal(only.narrowed,'10');
 assert.equal(line('show more').widened,true);
 const second=line('the second one');assert.equal(second.kind,'item');assert.equal(second.rows[0].name,a.rows[1].name);
 const plan=ask('plan my day').a,narrow=A.build(E.evaluate('only chem',s,{}),s,{},{line:'only chem',previous:plan});assert.equal(narrow.kind,'plan');assert.ok(work(narrow).every(r=>r.course.short==='Chemistry'));
 assert.equal(A.build(E.evaluate('what is due this week',s,{}),s,{},{line:'what is due this week',previous:plan}).kind,'list','a new question is a new answer');
});
test('a grade is the value, named busy time keeps its name, a date-only title leads with its course',()=>{
 const g=ask('my chem grade',{grades:true}).a;assert.equal(g.kind,'grades');assert.deepEqual(g.value,{label:'Chemistry grade',text:'91.4%'});assert.ok(g.rows.every(r=>r.type==='grade'));
 assert.ok(ask('i have swim practice 5 to 7 tomorrow').a.rows.some(r=>r.type==='busy'&&r.name==='Swim practice'));
 assert.equal(ask('what is homework for monday').a.title,'Latin · Homework for Monday, 11/9/2026');
 assert.match(draw(ask('homework for wednesday').a),/ba-lead[^>]*>Latin<\/span> Homework for Wednesday/);
});
