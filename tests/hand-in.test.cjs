'use strict';
// "To hand in" (extension/hand-in.js): missing work and dropboxes due this week or next, from the loaded assignments,
// with "Done another way" dismissals kept as a reason on Canvas Harness's own Mark done.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const H=require('../extension/hand-in.js');
const {createStore}=require('../extension/storage.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..','extension',f),'utf8');
const NOW=Date.parse('2026-10-20T15:00:00Z');   // a Tuesday
const dayOf=v=>new Date(v).toISOString().slice(0,10);
const at=(day,hour=23)=>`2026-${day}T${String(hour).padStart(2,'0')}:59:00Z`;
const a=(id,extra)=>({id:String(id),courseId:'5',name:'A'+id,url:'https://school.instructure.com/courses/5/assignments/'+id,state:'unsubmitted',submissionTypes:['online_upload'],...extra});

test('weeks end on Sunday night',()=>{
 assert.deepEqual(H.weekEnds('2026-10-20'),{thisWeek:'2026-10-25',nextWeek:'2026-11-01'});
 assert.deepEqual(H.weekEnds('2026-10-25'),{thisWeek:'2026-10-25',nextWeek:'2026-11-01'},'a Sunday is the end of its own week');
});

test('the lists: missing first, then dropboxes due this week and next; paper, submitted, past and later work stay out',()=>{
 const items=[
  a(1,{dueAt:at('10-22')}),a(2,{dueAt:at('10-29')}),a(3,{dueAt:at('11-05')}),                       // this week, next week, later
  a(4,{dueAt:at('10-22'),submissionTypes:['on_paper']}),a(5,{dueAt:at('10-22'),state:'submitted'}),     // paper; handed in
  a(6,{dueAt:at('10-15'),missing:true}),a(7,{dueAt:at('10-24'),submissionTypes:['online_quiz']}),     // missing; a quiz
  a(8,{dueAt:at('10-21'),submissionTypes:['online_text_entry']}),a(9,{dueAt:at('10-18')}),            // text dropbox; past, not missing
  {id:'local-1',name:'Mine',personal:true,dueAt:at('10-22')}];
 const l=H.lists({items,local:{},now:NOW},{dayOf,complete:i=>i.state==='submitted'});
 assert.deepEqual(l.missing.map(i=>i.id),['6']);
 assert.deepEqual(l.thisWeek.map(i=>i.id),['8','1']);assert.deepEqual(l.nextWeek.map(i=>i.id),['2']);
});

test('dismissed work leaves the lists and waits under "hidden" with its reason',()=>{
 const items=[a(1,{dueAt:at('10-22')}),a(6,{dueAt:at('10-15'),missing:true}),a(2,{dueAt:at('10-23')})];
 const l=H.lists({items,local:{1:{checkedOff:true,doneReason:'paper'},6:{checkedOff:true,doneReason:'class'},2:{checkedOff:true}},now:NOW},{dayOf,complete:()=>false});
 assert.equal(l.thisWeek.length+l.missing.length,0);
 assert.deepEqual(l.hidden.map(x=>[x.item.id,x.reason]),[['1','paper'],['6','class']],'a plain Mark done is not listed as hidden');
 assert.equal(H.reasonText('teacher'),'Talked to the teacher');assert.equal(H.cleanReason('drop table'),'');
});

test('the module: rows open the reader, link to Canvas, and offer the four reasons; empty when nothing is due',()=>{
 const E=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const action=(n,t,x='',cls='')=>`<button class="${cls}" data-rd-action="${n}" ${x}>${t}</button>`;
 const c={items:[a(1,{dueAt:at('10-22'),name:'Lab <report>'})],local:{},now:NOW,s:{timeZone:'UTC'},courseMap:new Map([['5',{name:'Chemistry',color:'#C96442'}]])};
 const h={E,dayKey:v=>dayOf(v),complete:()=>false,formatDate:()=>'Thu, Oct 22, 11:59 PM'};
 const html=H.render(c,h,{action});
 assert.match(html,/Due this week <span>1<\/span>/);assert.match(html,/Lab &lt;report&gt;/);
 assert.match(html,/data-rd-action="preview" data-id="1"/);assert.match(html,/href="https:\/\/school\.instructure\.com\/courses\/5\/assignments\/1" target="_blank" rel="noopener noreferrer"/);
 for(const [k] of H.REASONS)assert.match(html,new RegExp(`data-rd-action="handin-dismiss" data-id="1" data-value="${k}"`));
 assert.match(H.render({...c,items:[]},h,{action}),/Nothing missing, and no dropbox due this week or next\./);
});

test('the reason is kept with the task, and only known reasons',async()=>{
 const mem=new Map(),adapter={read:async k=>mem.get(k),write:async(k,v)=>{mem.set(k,structuredClone(v));}};
 const store=createStore({accountId:'7',origin:'https://school.instructure.com',adapter});await store.load();
 await store.update(d=>{d.tasks['12']={checkedOff:true,doneReason:'class'};d.tasks['13']={checkedOff:true,doneReason:'<b>'};});
 assert.equal(store.get().tasks['12'].doneReason,'class');assert.ok(!('doneReason' in store.get().tasks['13']));
});

test('wired in: a Home module, loaded before widgets.js, dismissals through the workspace\'s own Mark done',()=>{
 const manifest=JSON.parse(read('manifest.json')),js=manifest.content_scripts.find(c=>c.js.includes('dashboard.js')).js;
 assert.ok(js.indexOf('hand-in.js')<js.indexOf('widgets.js'));
 assert.match(read('workspace-arrange.js'),/const EXTRA=\['today','handin',/);assert.match(read('workspace-arrange.js'),/handin:'To hand in'/);
 const w=read('widgets.js');
 assert.match(w,/data\.tasks\[id\]=\{\.\.\.data\.tasks\[id\],checkedOff:true,doneReason:why\}/);
 assert.doesNotMatch(read('hand-in.js'),/fetch\(|XMLHttpRequest|chrome\./,'no requests of its own');
});
