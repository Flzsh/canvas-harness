'use strict';
// Four fixes to Biscuit's drawn answers found by the function check of the merged Canvas Harness (2026-11-16):
// 1. a plan that starts at the day's study time never hides work due before its first slot;
// 2. a found item after its act reads like a person wrote it, not as Canvas's raw fields;
// 3. a note (or any change) the sentence already names is not shown twice;
// 4. a line Biscuit cannot match offers no unrelated item.
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../extension/biscuit-engine.js'),P=require('../extension/biscuit-planner.js'),Clock=require('../extension/agent-clock.js');
const A=require('../extension/biscuit-answer.js'),V=require('../extension/biscuit-view.js');
// the two modules publish themselves on globalThis; the rest of the suite runs in this process and must not see them
delete globalThis.ReserveBiscuitAnswer;delete globalThis.ReserveBiscuitView;
const {world,wall}=require('./fixtures/biscuit-answer-world.cjs');
const zone='America/New_York',local=Clock.calendar(zone),minute=at=>local(at).minute;
const lite={pet:{knowledge:'lite'}},MON_NIGHT=wall(2026,11,16,3,20),MON_DAY=wall(2026,11,16,16,30);
const draw=(a,st={})=>V.render(a,{zone,rowActs:A.rowActs,...st});
const work=a=>a.rows.filter(r=>r.type==='work');
// the made-up student, plus one piece of work due at 1:59 PM on the day asked: before a weekday plan's 3:30 PM start
function student(at=MON_NIGHT,{knowledge='lite',extra=[]}={}){
 const s=world({at,extra:knowledge==='lite'?lite:{}});
 s.assignments.push({id:'120',title:'Reaction Rates Prep',name:'Reaction Rates Prep',courseId:'10',kind:'assignment',workKind:'assignment',dueAt:new Date(wall(2026,11,16,13,59)).toISOString(),points:20,description:'<p>Read the lab sheet and answer the pre-lab questions.</p>',submissionTypes:['online_upload'],url:'https://school.instructure.com/courses/10/assignments/120',missing:false,submitted:false,state:'unsubmitted',done:false,estimate:0},...extra);
 return s;
}
const ask=(line,s)=>{const c=(require('../extension/biscuit-controls.js').featureControl?.(line,s))||E.evaluate(line,s,{});return {c,a:A.build(c,s,{},{line})};};

// ---- 1. work due before the plan starts
test('1: a night plan names work due before its first slot instead of leaving it out',()=>{
 const s=student(),p=P.build(s,{local:true,line:'plan my night'});
 assert.equal(p.night,true);assert.equal(minute(p.blocks[0].start),930,'the plan still starts at 3:30 PM');
 assert.deepEqual(p.before.map(v=>v.itemId),['120']);assert.ok(!p.blocks.some(b=>b.itemId==='120'),'not scheduled after it is due');
 assert.match(p.message,/Reaction Rates Prep is due at 1:59 PM, before this plan starts\./);
 const later=p.later;const without=P.build({...s,assignments:s.assignments.filter(v=>v.id!=='120'),workItems:undefined,planner:undefined},{local:true,line:'plan my night'});
 assert.equal(later,without.later,'it is not counted among the work that can wait');
});
test('1: a catch-up plan asked at night does not schedule work after its due time either',()=>{
 for(const line of ['show me missing work catch up','plan catch up']){const p=P.build(student(),{local:true,line});
  assert.deepEqual(p.before.map(v=>v.itemId),['120'],line);for(const b of p.blocks.filter(b=>b.itemId)){const due=Date.parse(student().assignments.find(v=>v.id===b.itemId).dueAt);assert.ok(due<p.now||b.end<=due||due<=b.start&&due<p.now,line+': '+b.title+' is planned after it is due');}}
});
test('1: plans that start now, exact windows and work due later are unchanged',()=>{
 const day=P.build(student(MON_DAY),{local:true,line:'plan my day'});assert.equal(day.before,undefined,'a plan that starts now has nothing before it');
 const now=P.build(student(),{local:true,line:'plan my day now'});assert.equal(now.before,undefined);assert.equal(now.blocks[0].itemId,'120','from now, the 1:59 PM work comes first');
 const s=student(),start=wall(2026,11,16,15,0),end=wall(2026,11,16,16,0),exact=P.build(s,{local:true,itemIds:['105'],window:{start,end}});assert.equal(exact.before,undefined,'exact windows are left alone');
});
test('1: when everything is due before the plan starts, the plan says so and suggests no review',()=>{
 const s=world({at:MON_NIGHT,extra:lite});s.assignments.length=0;s.assignments.push(...student().assignments.filter(v=>v.id==='120'));
 const p=P.build(s,{local:true,line:'plan my night'});assert.equal(p.blocks.length,0);assert.equal(p.reviewSuggestion,undefined);assert.match(p.message,/^Reaction Rates Prep is due at 1:59 PM/);
 const {a}=ask('plan my night',s);assert.equal(a.kind,'none');assert.equal(a.title,'Nothing else to plan');assert.deepEqual(a.before.map(r=>r.id),['120']);
 const html=draw(a);assert.match(html,/Due before this plan starts/);assert.match(html,/data-ba-plan="now"/);
});
test('1: the plan card shows that work on top, tappable, with its due time and "Plan from now"',()=>{
 const s=student(),{a}=ask('plan my night',s);assert.equal(a.kind,'plan');assert.match(a.title,/^Today, 3:30/);
 assert.deepEqual(a.before.map(r=>r.name),['Reaction Rates Prep']);const r=a.before[0];assert.equal(r.due.text,'Due today 1:59 PM');assert.ok(r.detail,'details to open');assert.ok(r.minutes>0,'its length');
 assert.ok(!(a.left||[]).some(x=>x.id==='120'),'not in "can wait"');
 const html=draw(a),top=html.indexOf('Due before this plan starts'),timeline=html.indexOf('<ol class="ba-time"');
 assert.ok(top>0&&top<timeline,'above the timeline');assert.match(html,/data-ba-row="120"[^>]*>Reaction Rates Prep</);assert.match(html,/Today 1:59 PM/);assert.match(html,/data-ba-plan="now">Plan from now</);
 const open=draw(a,{open:{120:true}});assert.match(open,/data-ba-detail="120"/);assert.match(open,/data-ba-act="canvas:120"/);
 assert.ok(A.rowActs(r).some(x=>x.id==='open:120'),'the same acts as other rows');
});
test('1: "Plan from now" starts now with that work first, within three hours; Use this plan builds the same',()=>{
 const s=student(),{a}=ask('plan my night',s),now=A.edit(a,s,{op:'now'});
 assert.equal(now.kind,'plan');assert.equal(now.before,undefined);assert.equal(work(now)[0].itemId,'120');assert.ok(work(now)[0].start-s.now<5*60000,'starts now');
 const use=now.acts.find(x=>x.id==='use-plan');assert.equal(use.fields.itemIds[0],'120');assert.equal(use.fields.start,s.now);assert.equal(use.fields.line,undefined);
 assert.ok(now.rows.at(-1).end-work(now)[0].start<=4*3600000,'about three hours of work, not the whole list');
 const built=P.build(s,{...use.fields,mode:'tonight'});assert.equal(built.blocks[0].itemId,'120');assert.equal(built.blocks[0].start,work(now)[0].start);
 const tomorrow=ask('plan tomorrow',s).a;assert.ok(tomorrow.before.some(r=>r.id==='120'));assert.equal(work(A.edit(tomorrow,s,{op:'now'}))[0].itemId,'120','a plan for another day too');
});
test('1: edits, "only chem" and the used plan keep the work due before it on top',()=>{
 const s=student(),{a}=ask('plan my night',s),first=work(a)[0].itemId;
 const dropped=A.edit(a,s,{op:'drop',itemId:first});assert.deepEqual(dropped.before.map(r=>r.id),['120']);assert.ok(!work(dropped).some(r=>r.itemId===first));
 const narrow=A.build(E.evaluate('only chem',s,{}),s,{},{line:'only chem',previous:a});assert.deepEqual((narrow.before||[]).map(r=>r.id),['120']);
 const used=A.result('plan',{},{ok:true,message:'Plan saved.'},s,a);assert.equal(used.applied,true);assert.deepEqual(used.before.map(r=>r.id),['120']);
 assert.match(draw(used),/Due before this plan starts[\s\S]*Plan from now/);assert.equal(A.edit(used,s,{op:'now'}).kind,'plan','Plan from now works after the plan was used');
});

// ---- 2. a found item after its act
const RAW='Kinetics Test: Kinetics Test. Answer every question and show your work. due Sun, Nov 15, 8:00 AM; attempts used: ; late: false; submission types: online_upload; allowed extensions:';
test('2: the item\'s search fields are said in plain words; empty and false ones go',()=>{
 assert.equal(A.tidy(RAW),'Kinetics Test: Kinetics Test. Answer every question and show your work. Due Sun, Nov 15, 8:00 AM. Hand in: file upload.');
 assert.equal(A.tidy('Cardboard Bridge: Build it. due Mon, Nov 9, 11:59 PM; attempts used: 2; late: true; submission types: online_upload, online_url; allowed extensions: pdf, .DOCX'),'Cardboard Bridge: Build it. Due Mon, Nov 9, 11:59 PM. Attempts used: 2. Late. Hand in: file upload, website link. File types: .pdf, .docx.');
 for(const plain of ['Note · email coach','Saved. Reload Canvas to apply.','Lab moved: due to the assembly; bring goggles','Essay: draft it; then revise'])assert.equal(A.tidy(plain),plain,'ordinary sentences stay as they are');
});
test('2: after the act, a found item is its title, course and due, and its details in the stage-2 layout',()=>{
 const s=world({at:wall(2026,11,11,16,30),extra:lite}),prev=ask('open the kinetics test',s).a;assert.equal(prev.kind,'item');
 const d=A.result('find',{},{ok:true,message:RAW},s,prev);
 assert.equal(d.kind,'done');assert.equal(d.title,'Kinetics Test');assert.equal(d.summary,prev.summary);assert.equal(d.focus,'106');assert.equal(d.rows.length,1);
 assert.doesNotMatch(d.text,/attempts used|late: false|submission types|allowed extensions/);
 const html=draw(d,{history:[{label:'Kinetics Test'}]});
 for(const raw of [/attempts used/i,/late: false/i,/submission types/i,/allowed extensions/i,/online_upload/])assert.doesNotMatch(html,raw);
 assert.match(html,/<dt>Hand in<\/dt><dd>File upload<\/dd>/);assert.match(html,/<dt>Due<\/dt>/);assert.match(html,/Answer every question/);assert.match(html,/data-ba-undo/);
 assert.equal((html.match(/>Kinetics Test</g)||[]).length,1,'the name once, in the title');assert.ok((html.match(/ba-btn--primary/g)||[]).length<=1);
});
test('2: the real Full-tier sentence for a found item draws clean, and file types show only when Canvas names them',()=>{
 const s=world({at:wall(2026,11,11,16,30)});for(const v of s.assignments){v.late=false;v.attemptsUsed=null;v.allowedExtensions=[];}
 const c=E.evaluate('kinetics test',s,{}),prev=A.build(c,s,{},{line:'kinetics test'});
 if(/^Kinetics Test: /.test(c.message)){assert.match(c.message,/late: false/,'the engine still says it raw (training job)');const d=A.result(c.next.action,{},{ok:true,message:c.message},s,prev);assert.equal(d.title,'Kinetics Test');assert.doesNotMatch(draw(d),/late: false|attempts used|submission types/);}
 const typed=world({at:wall(2026,11,11,16,30),extra:lite});typed.assignments.find(v=>v.id==='106').allowedExtensions=['pdf','.DOCX'];
 assert.match(draw(ask('open the kinetics test',typed).a),/<dd>File upload \(\.pdf, \.docx\)<\/dd>/);
 assert.match(draw(ask('open the kinetics test',world({at:wall(2026,11,11,16,30),extra:lite})).a),/<dd>File upload<\/dd>/);
});
test('2: something the engine added beyond the details stays, in plain words',()=>{
 const s=world({at:wall(2026,11,11,16,30),extra:lite}),prev=ask('open the kinetics test',s).a;
 const d=A.result('find',{},{ok:true,message:'Kinetics Test: 100 points possible. Kinetics Test. Answer every question and show your work. Open the item in Canvas or Market to review and finish that step yourself.'},s,prev);
 assert.equal(d.title,'Kinetics Test');assert.match(d.summary,/100 points possible/);assert.match(d.summary,/finish that step yourself/);assert.doesNotMatch(d.summary,/Answer every question/,'the instructions are in the details already');
 const fact=ask('when is the kinetics test',s).a;assert.equal(fact.kind,'fact');
 const f=A.result('find',{},{ok:true,message:RAW},s,fact);assert.equal(f.title,'Kinetics Test','the same from a one-fact answer');assert.doesNotMatch(draw(f),/attempts used|late: false|submission types/);
 assert.equal(A.result('find',{},{ok:true,message:'Kinetics Test due: Sun 8:00 AM.'},s,fact).title,'Kinetics Test due: Sun 8:00 AM.','a plain fact sentence stays the title');
});

// ---- 3. a change named once
test('3: "note to self email coach" shows the note once after it is saved',()=>{
 const s=world({at:MON_DAY,extra:lite}),{c,a}=ask('note to self email coach',s);assert.equal(a.kind,'change');
 const d=A.result(c.next.action,{},{ok:true,message:c.message},s,a);assert.equal(d.title,'Note · email coach');assert.equal(d.rows.length,0);
 assert.equal((draw(d).match(/email coach/g)||[]).length,2,'the title and its aria-label only');
 const setting=A.result('feature',{},{ok:true,message:'Saved. Reload Canvas to apply.'},s,{kind:'change',rows:[{id:'c-0',type:'change',name:'Play & submission celebrations',to:'Off'}]});
 assert.equal(setting.rows.length,1,'a change the sentence does not name is still shown');
});

// ---- 4. nothing unrelated for a line nothing matched
test('4: a line nothing matched offers no unrelated item; "nothing due" still offers what is next',()=>{
 const s=world({at:MON_DAY,extra:lite});
 const none=A.build({action:'none',message:'No matching words or item are loaded. Name a course, item or action.',items:[],next:{action:'none',fields:{}}},s,{},{line:'black hole tool'});
 assert.equal(none.kind,'none');assert.equal(none.rows.length,0);assert.doesNotMatch(draw(none),/Next up|data-ba-row/);
 assert.equal(A.result('',{},{ok:true,message:none.text},s,none).rows.length,0,'nor after Enter');
 const due=A.build({action:'none',message:'Nothing due Fri. Next up: Kinetics Test on Sun.',items:[],next:{action:'none',fields:{}}},s,{},{line:'what about friday'});
 assert.equal(due.rows.length,1);assert.match(draw(due),/Next up/);
 const unknown=A.build({action:'none',message:'I am not sure about that one. Name the item and what to change.',items:[],next:{action:'none',fields:{}}},s,{},{line:'the black hole tool please'});
 assert.equal(unknown.kind,'unknown');assert.equal(unknown.rows.length,0,'"the" alone does not make "Close Reading: Chapter Three" a match');
 const near=A.build({action:'none',message:'I am not sure about that one. Name the item and what to change.',items:[],next:{action:'none',fields:{}}},s,{},{line:'that kinetics thing'});
 assert.deepEqual(near.rows.map(r=>r.name),['Kinetics Test'],'a real word in a title still finds it');
});
