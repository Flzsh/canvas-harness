'use strict';
// The 4.2.13 Planner: the chosen day's page at the left (a tick list in time order, "Add a task" under it, No date, Overdue
// folded to one line with All to today and Tick all), the calendar at the right (Month: as many weeks as fit the height;
// Week: one tall row; chips, due marks, "+n", drag, keys), a task's sheet as one floating card, "Your week" behind one
// button; outside the Planner the same day button and picker on every piece of work, Home's "My plan" as the same day page,
// "Add a task" from the top bar; the old view names, old data, and older builds reading this build's data. Everything runs
// in sandboxes of its own (loaded into the suite's process, planner-model and widgets would register their Biscuit sources
// there and change other tests). Sample data only. (Replaces planner-43.test.cjs, the 4.2.12 Planner's tests.)
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {validateBackup,createStore}=require('../extension/storage.js');
// (the public tree spreads long lines over several (scripts/readable-lines.cjs, whitespace only): the source checks below
// read it with those line breaks taken out again)
const dense=s=>s.replace(/\n[ \t]*/g,'');
const ext=f=>path.join(__dirname,'..','extension',f);
const ZONE='America/New_York',NOW=Date.parse('2026-11-22T17:00:00Z'),TODAY='2026-11-22';   // Sunday, noon in New York
const tick=()=>new Promise(r=>setTimeout(r,0));
const plain=v=>JSON.parse(JSON.stringify(v));
function box(files=['site.js','core.js','personal-work.js','planner-model.js','help-plan.js','widgets.js','planner-ui.js'],extra={}){
 const sandbox={console,Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map,RegExp,Error,Promise,setTimeout,clearTimeout,...extra};sandbox.globalThis=sandbox;vm.createContext(sandbox);
 for(const file of files)vm.runInContext(fs.readFileSync(ext(file),'utf8'),sandbox,{filename:file});
 return sandbox;
}
// a student's week: two courses, Canvas work (one long overdue), own tasks (one left on Thursday, timed ones, a repeat,
// some with no day)
function world({withHelp=true,toolbox={}}={}){
 const S=box(withHelp?undefined:['site.js','core.js','personal-work.js','planner-model.js','widgets.js','planner-ui.js']),Core=S.ReserveCore;
 const chem={id:'7',name:'Chemistry',color:'#286452'},eng={id:'8',name:'English',color:'#7A4E8C'};
 const canvas=(id,name,due,course=chem,types=['online_upload'])=>Core.normalizeAssignment({id,name,due_at:due,submission_types:types,submission:{workflow_state:'unsubmitted'}},course);
 const data={customTasks:[],tasks:{},toolbox:{...toolbox}};
 const own=(id,name,courseId,rec={},task={})=>{data.customTasks.push({id,name,courseId,dueAt:null,createdAt:'2026-11-20T12:00:00.000Z',...task});data.tasks[id]={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:0,plannedDate:'',checklist:[],...rec};};
 own('local-a','Flashcards','8',{plannedDate:TODAY,estimate:30,plannedTime:'16:00'});
 own('local-b','Outline the lab','7',{plannedDate:TODAY,estimate:45,plannedTime:'18:30',notes:'Use Tuesday\'s table.',checklist:[{id:'s1',text:'Find the table',done:true}]});
 own('local-c','Read pages 40-62','8',{plannedDate:TODAY,estimate:60});
 own('local-d','Problem set','7',{plannedDate:TODAY,estimate:60,priority:'high'});
 own('local-e','Pack gym bag','personal',{plannedDate:'2026-11-19'});
 own('local-f','Email the club','personal');
 own('local-g','College essay draft','personal');
 own('local-h','Piano','personal',{plannedDate:'2026-11-23',estimate:20},{repeat:{every:'week',interval:1,days:[1,4]}});
 data.tasks['21']={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:0,plannedDate:'2026-11-25',checklist:[]};
 const items=()=>[canvas('17','Gas laws','2026-11-24T20:00:00Z'),canvas('19','Unit 4 Test','2026-11-27T17:00:00Z',chem,['online_quiz']),canvas('21','Research essay','2026-12-03T17:00:00Z',eng),canvas('23','Old lab report','2026-09-03T21:00:00Z'),...S.ReservePersonalWork.normalize(JSON.parse(JSON.stringify(data)),[chem,eng])];
 const h={E:v=>String(v??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';'),dayKey:(v,tz)=>Core.dayKey(v,tz),complete:Core.isComplete,formatDate:(v,tz,o)=>new Intl.DateTimeFormat('en-US',{timeZone:tz,...o}).format(new Date(v))};
 const ctx=()=>({now:NOW,s:{timeZone:ZONE},local:data.tasks,courses:[chem,eng],courseMap:new Map([['7',chem],['8',eng]]),items:items(),personal:{toolbox:data.toolbox},__plan:null});
 return {S,UI:S.ReservePlannerUI,P:S.ReservePlanner,HP:S.ReserveHelpPlan,data,ctx,h};
}
// the planner's controller over a page that is only what the handlers ask of it
function controller(w,{notePlan=null,noteDone=null,noteAdded=null,view=()=>{},nodes={}}={}){
 const listeners={},doc={addEventListener:(t,f)=>{(listeners[t]||(listeners[t]=new Set())).add(f);},removeEventListener:(t,f)=>listeners[t]?.delete(f),createElement:()=>({setAttribute(){},style:{},remove(){},animate(){},querySelector:()=>null,contains:()=>false})};
 const container={dataset:{},style:{setProperty(){},removeProperty(){}},ownerDocument:doc,addEventListener(){},removeEventListener(){},querySelector:sel=>nodes[sel]||(sel==='.rd-plan'?{}:null),querySelectorAll:()=>[],append(){},contains:()=>true};
 const saves=[];const ui=w.UI.create({container,store:{get:()=>w.data},save:change=>{change(w.data);saves.push(1);return Promise.resolve(true);},rerender(){},getContext:w.ctx,helpers:()=>w.h,view,notePlan,noteDone,noteAdded});
 // (the press's target is the button itself: what the button is inside, the target is inside too)
 const press=(action,dataset={},attrs={},extra={})=>{const button={dataset:{rdAction:action,...dataset},getAttribute:k=>attrs[k]??null,closest:()=>null,classList:{contains:()=>false},...extra};return ui.click({target:{closest:sel=>sel==='[data-rd-action]'?button:button.closest(sel)}});};
 const field=(name,value,dataset={})=>({dataset:{rdField:name,...dataset},value,tagName:'INPUT',closest:()=>null});
 const key=(k,target,mods={})=>ui.keydown({key:k,target,preventDefault(){},composedPath:()=>[target],...mods});
 return {ui,press,field,key,listeners,container,saves};
}
const between=(html,a,b)=>{const i=html.indexOf(a);return i<0?'':html.slice(i,b?html.indexOf(b,i+a.length):undefined);};
const rowIds=html=>[...html.matchAll(/<div class="rd-plan-item" role="listitem" data-rd-key="[^"]+" data-plan-id="([^"]+)"/g)].map(m=>m[1]);
const page=html=>between(html,'<section class="rd-plan-page"','<section class="rd-plan-cal"');
const cell=(html,day)=>{const i=html.indexOf(`data-rd-key="pc-${day}"`);return i<0?'':html.slice(i,html.indexOf('<div class="rd-plan-cell"',i+10)>0?html.indexOf('<div class="rd-plan-cell"',i+10):html.indexOf('</section>',i));};

test('the page: the chosen day at the left in time order, the add line under it, No date, Overdue folded to one line; the calendar at the right',()=>{
 const w=world(),html=w.UI.render(w.ctx(),w.h,{});
 assert.match(html,/<div class="rd-plan" data-rd-key="plan" data-mode="month">/,'Month is the default');
 assert.match(html,/<h1 class="rd-page-heading rd-plan-h1 rd-sr-only">Planner<\/h1>/);
 const p=page(html);
 // the heading: back, the day, Today, forward
 assert.match(p,/data-rd-action="plan-step" data-delta="-1" aria-label="Previous day"[\s\S]*<h2 id="rd-plan-day-title" tabindex="-1" aria-label="Sunday, November 22, today">Sun, Nov 22<\/h2><em class="rd-plan-today">Today<\/em>[\s\S]*data-rd-action="plan-step" data-delta="1" aria-label="Next day"/);
 // timed rows first by their time, then the rest (important first); Thursday's undone task is NOT poured into today
 assert.deepEqual(rowIds(between(p,'rd-plan-day-rows','<form')),['local-a','local-b','local-d','local-c']);
 assert.match(p,/data-plan-id="local-a"[^>]*>[\s\S]*?<span class="rd-plan-at" id="rd-pr-pi-local-a-at">4:00 PM<\/span><button type="button" class="rd-plan-title" data-rd-action="plan-sheet" data-id="local-a" aria-label="Flashcards" aria-describedby="rd-pr-pi-local-a-at rd-pr-pi-local-a"[\s\S]*?<small class="rd-plan-meta" id="rd-pr-pi-local-a"><span>30 min<\/span><span class="rd-plan-course"><i class="rd-plan-dot"[^>]*><\/i><span class="rd-plan-cname">English<\/span><\/span><\/small>/,'tick, time, title, and the quiet line: length, course');
 assert.match(p,/data-rd-key="pi-local-d"[^>]*data-priority="high"[\s\S]*?<b class="rd-plan-bang" aria-hidden="true">!<\/b>/);
 assert.match(p,/data-timed="true"/,'a time column only when the day has a timed row');
 // "Add a task" right under the list: the field itself, its day the chosen one; n and / jump to it
 assert.match(p,/<\/div><form class="rd-quick-add rd-plan-add" data-rd-form="plan-quick" data-day="2026-11-22" data-at=""><svg class="rd-plan-plus-art"[\s\S]*?<input type="text" data-rd-field="plan-quick" data-day="2026-11-22" data-at="" maxlength="200" autocomplete="off" aria-label="Add a task" aria-keyshortcuts="n \/" placeholder="Add a task" value="">/);
 // No date: own tasks with no day and no deadline
 assert.match(p,/<section class="rd-plan-nodate" data-rd-key="plan-nodate" data-plan-drop="" aria-labelledby="rd-plan-nodate-h"><h3 class="rd-plan-label" id="rd-plan-nodate-h"><span>No date<\/span><b>2<\/b><\/h3>/);
 assert.deepEqual(rowIds(between(p,'rd-plan-nodate','</section>')),['local-g','local-f']);
 // Overdue: one quiet line, its count (Thursday's task and the September lab), at the foot
 assert.match(p,/<button type="button" class="rd-plan-overdue" data-rd-action="plan-overdue" aria-expanded="false" aria-label="Overdue: 2"><span>Overdue<\/span><b>2<\/b>/);
 assert.ok(p.indexOf('rd-plan-overdue')>p.indexOf('rd-plan-nodate'));
 // nothing of 4.2.12's page is left: no day rows, no To plan, no hours, no stamps
 for(const gone of ['rd-plan-side','rd-plan-tab','plan-all','rd-plan-hours','plan-hours','rd-plan-stamp','Carried over','rd-plan-list','plan-suggest'])assert.ok(!html.includes(gone),gone);
 // the narrow page: the chosen day's week as seven days over the page (dots), the month behind its switch
 assert.match(p,/<div class="rd-plan-strip" role="group" aria-label="Week of Monday, November 16">/);assert.equal((p.match(/class="rd-plan-sday"/g)||[]).length,7);assert.match(p,/data-rd-action="plan-cal-open"[^>]*>Month</);
});

test('another day chosen: its rows (a Canvas due that day with no day of its own, a repeat\'s day), the add line for that day; past days dimmed',()=>{
 const w=world();
 const tue=page(w.UI.render(w.ctx(),w.h,{day:'2026-11-24'}));
 assert.match(tue,/<h2 id="rd-plan-day-title"[^>]*>Tue, Nov 24<\/h2>/);assert.doesNotMatch(tue,/rd-plan-today/);
 assert.match(tue,/data-plan-id="17"[\s\S]*?<span>due 3:00 PM<\/span>/,'Canvas work due that day, with no day of its own: on its due day, "due 3:00 PM"');
 assert.match(tue,/data-rd-field="plan-quick" data-day="2026-11-24"/,'typed here, it lands on the chosen day');
 const mon=page(w.UI.render(w.ctx(),w.h,{day:'2026-11-23'}));assert.ok(rowIds(mon).includes('local-h'),'the repeat on its day');
 const thu=page(w.UI.render(w.ctx(),w.h,{day:'2026-11-26'}));assert.match(thu,/data-rd-key="pi-local-h@2026-11-26" data-plan-id="local-h"[^>]*data-echo="true"/,'its next day: a quiet echo');
 const past=w.UI.render(w.ctx(),w.h,{day:'2026-11-19'});assert.match(page(past),/<section class="rd-plan-page" data-rd-key="plan-page" aria-labelledby="rd-plan-day-title" data-past="true"/);
 assert.match(page(w.UI.render(w.ctx(),w.h,{day:'2026-11-28'})),/<p class="rd-plan-nothing" role="listitem">Nothing on Saturday<\/p>/);
});

test('the calendar: Monday first, from the week with today in it, as many rows as fit the height (2 to 6), chips, due marks, "+n", today\'s disc, the chosen day',()=>{
 const w=world(),UI=w.UI;
 // rows from the height: at least 128 px a row, 2 to 6; Week one row
 assert.deepEqual([400,480,640,700,900,1200].map(height=>UI.fit({height}).rows),[2,3,4,4,6,6]);
 assert.equal(UI.fit({height:700,mode:'week'}).rows,1);assert.equal(UI.fit({}).rows,4,'4 before anything is measured');
 assert.ok(UI.fit({height:700}).chips>=3&&UI.fit({height:480}).chips>=2);
 let html=UI.render(w.ctx(),w.h,{});
 assert.match(html,/<h2 id="rd-plan-cal-title" class="rd-plan-months" aria-label="November – December"><span class="rd-plan-months-l">November – December<\/span>/);
 assert.match(html,/data-rd-action="plan-move" data-delta="-1" aria-label="Earlier weeks"[\s\S]*data-rd-action="plan-today"[^>]*>Today<[\s\S]*data-rd-action="plan-move" data-delta="1" aria-label="Later weeks"/);
 assert.match(html,/<div class="rd-plan-grid" role="grid" aria-labelledby="rd-plan-cal-title" aria-describedby="rd-plan-help" data-rows="4" style="--rd-plan-rows:4">/);
 // the days shown in one quiet line (4.0's line under the bar): n of m done, x planned; "A clear week" when nothing is there
 assert.match(html,/<p class="rd-plan-sub" data-rd-key="plan-sub"><i><\/i><span>\d+ of \d+ done<\/span> <span>· \d+ h( \d+ min)?<\/span> <span>planned<\/span><\/p>/);
 const bare={...w.ctx(),items:[],local:{},__plan:null};assert.match(UI.render(bare,w.h,{mode:'week'}),/<p class="rd-plan-sub" data-rd-key="plan-sub"><i><\/i><span>A clear week<\/span><\/p>/);assert.match(UI.render(bare,w.h,{}),/>Clear weeks<\/span><\/p>/);
 const cells=[...html.matchAll(/data-rd-key="pc-(\d{4}-\d{2}-\d{2})"/g)].map(m=>m[1]);assert.equal(cells.length,28);assert.equal(cells[0],'2026-11-16','Monday of the week with today');assert.equal(cells.at(-1),'2026-12-13');
 assert.match(html,/<span role="columnheader" aria-label="Monday">Mon<\/span>/);
 // today: the disc (CSS on data-today), chosen (ringed) and the one in the tab order
 assert.match(cell(html,TODAY),/^data-rd-key="pc-2026-11-22" data-day="2026-11-22" data-plan-drop="2026-11-22" tabindex="0" aria-selected="true" aria-label="Sunday, November 22, today: 4 to do, a heavy day" data-today="true" data-past="false" data-chosen="true" data-heavy="true"/);
 assert.match(cell(html,'2026-11-19'),/data-past="true"/);assert.match(cell(html,'2026-12-01'),/<span class="rd-plan-num" aria-hidden="true">Dec 1<\/span>/,'a month\'s first day says its month');
 // chips: planned work (a tick and the title on its course's wash), Canvas work due with no day (the same, dashed: CSS on
 // data-kind="due"), a repeat's coming day (an echo, no tick), work planned for another day leaves a "due" mark
 assert.match(cell(html,'2026-11-24'),/<div class="rd-plan-entry" data-kind="due" data-rd-key="pe-17@2026-11-24" data-plan-id="17" data-done="false" style="--rd-course:#286452"><button type="button" class="rd-plan-etick" data-rd-action="check-off" data-id="17" aria-pressed="false" aria-label="Mark done: Gas laws" tabindex="-1">/);
 assert.match(cell(html,'2026-11-25'),/data-kind="planned" data-rd-key="pe-21@2026-11-25"/);
 assert.match(cell(html,'2026-12-03'),/<button type="button" class="rd-plan-entry rd-plan-mark" data-rd-action="plan-sheet" data-id="21" data-from="mark" data-rd-key="pm-21" tabindex="-1" aria-haspopup="dialog" aria-label="Research essay: due 12:00 PM, planned for Wednesday, November 25"[^>]*><span class="rd-plan-due-word">due<\/span><span class="rd-plan-etitle">Research essay<\/span><\/button>/);
 assert.match(cell(html,'2026-11-26'),/data-kind="echo" data-rd-key="pe-local-h@2026-11-26"[^>]*data-echo="true"[^>]*><span class="rd-plan-etick" data-still="true"/);
 // the plus on a day (on hover or focus): that day chosen, the caret in "Add a task"
 assert.match(cell(html,'2026-11-27'),/data-rd-action="plan-add-on" data-day="2026-11-27" tabindex="-1" aria-label="Add a task on Friday, November 27"/);
 // "+n" when they do not fit: pressing it chooses that day
 const tight=UI.render(w.ctx(),w.h,{height:480,calHead:56,names:26});const t=cell(tight,TODAY);
 assert.match(t,/data-rd-action="plan-choose" data-day="2026-11-22" tabindex="-1" aria-label="(\d+) more on Sunday, November 22">\+\d+<\/button>/);
 assert.equal((t.match(/class="rd-plan-entry"/g)||[]).length+ +/>\+(\d+)<\/button>/.exec(t)[1],4,'shown and "+n" together: every one');
 // Week: one row of seven tall days, a task with its time
 html=UI.render(w.ctx(),w.h,{mode:'week'});assert.match(html,/data-mode="week"/);assert.equal([...html.matchAll(/data-rd-key="pc-/g)].length,7);assert.match(html,/aria-label="Previous week"/);
 assert.match(cell(html,TODAY),/<span class="rd-plan-etime">4 PM<\/span><span class="rd-plan-etitle">Flashcards<\/span>/);
 assert.match(html,/<h2 id="rd-plan-cal-title" class="rd-plan-months">November<\/h2>/);
});

test('views: Month or Week remembered; the views 4.2.12 ("list", "week") and 4.2 ("day") saved read as Month / Week; Home and Biscuit open a day',async()=>{
 const w=world(),UI=w.UI;
 assert.match(UI.render(w.ctx(),w.h,{mode:'day',day:'2026-11-24'}),/data-mode="month"[\s\S]*<h2 id="rd-plan-day-title"[^>]*>Tue, Nov 24</,'a 4.2 "day" view: Month, that day chosen');
 assert.match(UI.render(w.ctx(),w.h,{mode:'list',open:'2026-11-25'}),/data-mode="month"[\s\S]*<h2 id="rd-plan-day-title"[^>]*>Wed, Nov 25</,'a 4.2.12 "list" with a day open: Month, that day chosen');
 for(const [saved,want] of [['week','week'],['list','month'],['day','month'],['month','month'],['nonsense','month'],[undefined,'month']]){
  const v=world({toolbox:saved?{planner:{view:saved}}:{}}),c=controller(v);assert.equal(c.ui.ui.mode,want,String(saved));assert.match(v.UI.render(v.ctx(),v.h,c.ui.ui),new RegExp(`data-mode="${want}"`));}
 const c=controller(w);c.press('plan-mode',{mode:'week'});await tick();assert.equal(w.data.toolbox.planner.view,'week','remembered');c.press('plan-mode',{mode:'month'});await tick();assert.equal(w.data.toolbox.planner.view,'month');
 // Home's Week module and Biscuit: the Planner at that day (chosen; the calendar moves to show it)
 c.ui.goto('2026-12-20');assert.equal(c.ui.ui.day,'2026-12-20');const far=UI.render(w.ctx(),w.h,c.ui.ui);assert.match(far,/data-rd-key="pc-2026-12-20"[^>]*aria-selected="true"/);assert.match(far,/Sun, Dec 20</);
 c.ui.goto('');assert.equal(c.ui.ui.day,TODAY);
 const wsrc=dense(fs.readFileSync(ext('widgets.js'),'utf8'));assert.match(wsrc,/if\(action==='plan-open'\)\{planner\?\.goto\(button\.dataset\.day\);go\('plan'\);return true;\}/);assert.match(wsrc,/planner\?\.goto\(from\);go\('plan'\)/);
});

test('moving: the page\'s arrows and Today, the calendar\'s back and forward by its rows, a day pressed, its plus; the add line lands on the chosen day',async()=>{
 const w=world(),c=controller(w),ui=c.ui.ui;
 c.press('plan-step',{delta:'1'});assert.equal(ui.day,'2026-11-23');c.press('plan-step',{delta:'-1'});c.press('plan-step',{delta:'-1'});assert.equal(ui.day,'2026-11-21');
 c.press('plan-today');assert.equal(ui.day,TODAY);assert.equal(ui.start,'');
 c.press('plan-move',{delta:'1'});assert.equal(ui.start,'2026-12-14','Month: four weeks on');assert.equal(ui.day,TODAY,'the chosen day stays');
 c.press('plan-move',{delta:'-1'});assert.equal(ui.start,'2026-11-16');
 c.press('plan-mode',{mode:'week'});c.press('plan-move',{delta:'1'});assert.equal(ui.start,'2026-11-23','Week: seven days');c.press('plan-mode',{mode:'month'});
 // a day's empty part (no button under the press) chooses it; "+n" too
 c.ui.click({target:{closest:sel=>sel==='.rd-plan-cell'?{dataset:{day:'2026-11-27'}}:null}});assert.equal(ui.day,'2026-11-27');
 c.press('plan-choose',{day:'2026-11-24'});assert.equal(ui.day,'2026-11-24');
 // a day chosen far ahead: the calendar follows so it is in view
 c.press('plan-today');for(let i=0;i<40;i++)c.press('plan-step',{delta:'1'});assert.equal(ui.day,'2027-01-01');assert.ok(ui.start<=ui.day&&w.P.between(ui.start,ui.day)<28,'in view');
 // the plus: that day, the caret in the add line; typed, the task lands on the chosen day unless the words name another
 c.press('plan-add-on',{day:'2026-11-27'});assert.equal(ui.day,'2026-11-27');
 const f=c.field('plan-quick','buy poster board',{day:'2026-11-27',at:''});assert.equal(c.ui.read(f).day,'2026-11-27');
 assert.equal(c.ui.read(c.field('plan-quick','buy poster board tomorrow',{day:'2026-11-27',at:''})).day,'2026-11-23','the words win');
});

test('Overdue: never poured into today; one line opens the list (each with its day button), All to today and Tick all each one note with Undo',async()=>{
 const w=world(),notes=[],done=[],c=controller(w,{notePlan:rows=>{notes.push(plain(rows));return true;},noteDone:ids=>{done.push(plain(ids));return true;}});
 assert.ok(!rowIds(page(w.UI.render(w.ctx(),w.h,{}))).includes('local-e'),'Thursday\'s task is not on today');
 c.press('plan-overdue');assert.equal(c.ui.ui.overdueOpen,true);
 let html=w.UI.render(w.ctx(),w.h,c.ui.ui),p=page(html);
 assert.match(p,/<section class="rd-plan-page" data-rd-key="plan-page-overdue" data-view="overdue"[\s\S]*data-rd-action="plan-overdue-back"[^>]*aria-label="Back to Sunday, November 22"[\s\S]*<h2 id="rd-plan-day-title" tabindex="-1">Overdue<\/h2><b class="rd-plan-count">2<\/b>/);
 assert.match(p,/data-rd-action="plan-overdue-today"[^>]*>[\s\S]*?<span>All to today<\/span>[\s\S]*data-rd-action="plan-overdue-tick"[^>]*>[\s\S]*?<span>Tick all<\/span>/);
 assert.deepEqual(rowIds(p),['23','local-e'],'oldest first');
 assert.match(p,/data-plan-id="23"[\s\S]*?<span class="rd-plan-late">due Sep 3<\/span>[\s\S]*?<button type="button" class="rd-plan-daybtn" data-rd-action="plan-pick" data-id="23" data-day="" data-planned="false" aria-haspopup="dialog" aria-expanded="false" aria-label="Plan Old lab report">[\s\S]*?<span>Plan<\/span>/);
 assert.match(p,/data-plan-id="local-e"[\s\S]*?data-rd-action="plan-pick" data-id="local-e" data-day="2026-11-19" data-planned="true"[^>]*><svg[\s\S]*?<\/svg><span>Nov 19<\/span>/);
 // All to today: one save, one note (what each was), the list empties
 const before=c.saves.length;c.press('plan-overdue-today');await tick();assert.equal(c.saves.length-before,1);
 assert.equal(w.data.tasks['23'].plannedDate,TODAY);assert.equal(w.data.tasks['local-e'].plannedDate,TODAY);
 assert.deepEqual(notes.at(-1).map(x=>[x.id,x.day,x.previous.plannedDate]).sort(),[['23',TODAY,''],['local-e',TODAY,'2026-11-19']]);
 // the dashboard's Undo (putBack, kind "plan") puts each back where it was ("no day" included)
 const D=dense(fs.readFileSync(ext('dashboard.js'),'utf8'));assert.match(D,/if\(x\.kind==='plan'\)\{const t=data\.tasks\?\.\[x\.taskId\];if\(t&&\(t\.plannedDate\|\|''\)===\(x\.day\|\|''\)\)\{t\.plannedDate=x\.previous\?\.plannedDate\|\|'';/);
 assert.match(D,/notePlan:list=>notePlanned\(list\),noteDone:ids=>noteDone\(ids\),noteAdded:list=>noteAdded\(list\)/);
 // Tick all on a fresh week: every overdue thing marked done (checkedOff, as a tick), one save, one note of kind "done"
 const v=world(),d2=[],c2=controller(v,{noteDone:ids=>{d2.push(plain(ids));return true;}});c2.press('plan-overdue');const b2=c2.saves.length;c2.press('plan-overdue-tick');await tick();
 assert.equal(c2.saves.length-b2,1);assert.deepEqual(d2[0].sort(),['23','local-e']);assert.equal(v.data.tasks['23'].checkedOff,true);assert.equal(v.data.tasks['local-e'].checkedOff,true);
 assert.match(D,/function noteDone\(ids\)\{[\s\S]*?kind:'done'/);
 // without the dashboard's note (a page with no dashboard, the tests): the same one Undo in place
 const x=world(),c3=controller(x);c3.press('plan-overdue');c3.press('plan-overdue-tick');await tick();
 html=x.UI.render(x.ctx(),x.h,c3.ui.ui);assert.match(html,/<p class="rd-plan-advice" data-done="true" data-rd-key="adv-done"><span>2 marked done\.<\/span><button type="button" class="rd-text-button" data-rd-action="plan-check-undo" >Undo<\/button>/);
 c3.press('plan-check-undo');await tick();assert.equal(x.data.tasks['23']?.checkedOff,undefined);assert.equal(x.data.tasks['local-e'].checkedOff,false);
 const y=world(),c4=controller(y);c4.press('plan-overdue');c4.press('plan-overdue-today');await tick();assert.match(y.UI.render(y.ctx(),y.h,c4.ui.ui),/<span>Planned 2\.<\/span>/);
 c4.press('plan-check-undo');await tick();assert.equal(y.data.tasks['23'].plannedDate,'');assert.equal(y.data.tasks['local-e'].plannedDate,'2026-11-19');
 // the note's words for a Tick all and for a move to no day
 const View=box(['dashboard-view.js']).ReserveDashboardView,E=w.h.E,icon=k=>`<i data-i="${k}"></i>`;
 assert.equal(View.noteHTML({entries:[{id:'23',kind:'done',name:'Old lab report'},{id:'local-e',kind:'done',name:'Pack gym bag'}],state:'open'},{E,icon}).said,'2 marked done: Old lab report, Pack gym bag');
 assert.match(D,/due:day\?formatDate\(Date\.parse\(day\+'T12:00:00Z'\),'UTC',\{weekday:'short',month:'short',day:'numeric'\}\):'No date'/);
});

test('No date: own tasks with no day; what the day leaves and "n more" when the day is crowded; a drop there takes the day away',async()=>{
 const w=world();for(let i=0;i<5;i++){w.data.customTasks.push({id:'local-n'+i,name:'Loose '+i,courseId:'personal',dueAt:null,createdAt:'2026-11-20T12:00:00.000Z'});w.data.tasks['local-n'+i]={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:0,plannedDate:'',checklist:[]};}
 const roomy=page(w.UI.render(w.ctx(),w.h,{listRoom:900}));assert.equal(rowIds(between(roomy,'rd-plan-nodate','</section>')).length,7);assert.doesNotMatch(roomy,/data-crowded/);
 const tight=page(w.UI.render(w.ctx(),w.h,{listRoom:300}));assert.match(tight,/data-crowded="true"/);assert.equal(rowIds(between(tight,'rd-plan-nodate','</section>')).length,1);
 assert.match(tight,/data-rd-action="plan-more" data-tray="nodate">6 more</);
 const c=controller(w);c.ui.ui.listRoom=300;c.press('plan-more',{tray:'nodate'});assert.equal(c.ui.ui.nodateMore,true);assert.equal(rowIds(between(page(w.UI.render(w.ctx(),w.h,c.ui.ui)),'rd-plan-nodate','</section>')).length,7);
});

test('drag: a row of the page or a chip onto a day of the calendar, the page or No date: its day changes, with the change note and its Undo',async()=>{
 const w=world(),notes=[];
 const ghost={classList:{add(){}},setAttribute(){},removeAttribute(){},style:{},remove(){},getBoundingClientRect:()=>({left:0,top:0,width:10,height:10})};
 const cellBox=(day,l,t)=>({dataset:{planDrop:day},getBoundingClientRect:()=>({left:l,top:t,right:l+100,bottom:t+100,width:100,height:100}),setAttribute(){},removeAttribute(){}});
 const fri=cellBox('2026-11-27',600,100),nodate=cellBox('',100,500);
 const row={dataset:{planId:'local-c',rdKey:'pi-local-c'},getBoundingClientRect:()=>({left:100,top:300,right:400,bottom:344,width:300,height:44}),cloneNode:()=>ghost,removeAttribute(){},closest:s=>s==='.rd-plan'?{}:null};
 const chip={dataset:{planId:'local-a',rdKey:'pe-local-a@2026-11-22'},getBoundingClientRect:()=>({left:700,top:300,right:780,bottom:322,width:80,height:22}),cloneNode:()=>ghost,removeAttribute(){},closest:s=>s==='.rd-plan'?{}:null};
 const handlers={},doc={addEventListener:(t,f)=>{handlers[t]=f;},removeEventListener:t=>{delete handlers[t];}};
 let down=null;const container={dataset:{},style:{setProperty(){}},ownerDocument:doc,addEventListener:(t,f)=>{if(t==='pointerdown')down=f;},removeEventListener(){},querySelector:()=>null,querySelectorAll:sel=>sel==='.rd-plan [data-plan-drop]'?[fri,nodate]:[],append(){},contains:()=>true};
 w.S.requestAnimationFrame=()=>0;w.S.cancelAnimationFrame=()=>{};
 const ui=w.UI.create({container,store:{get:()=>w.data},save:change=>{change(w.data);return Promise.resolve(true);},rerender(){},getContext:w.ctx,helpers:()=>w.h,notePlan:rows=>{notes.push(plain(rows));return true;}});
 const target=el=>({closest:s=>s.startsWith('.rd-plan-item[data-plan-id]')?el:s.startsWith('button:not')?null:null});
 const ev=(x,y,t)=>({button:0,isPrimary:true,pointerId:1,clientX:x,clientY:y,target:t,preventDefault(){}});
 down(ev(150,320,target(row)));handlers.pointermove(ev(400,200,target(row)));handlers.pointermove(ev(650,150,target(row)));handlers.pointerup(ev(650,150,target(row)));await tick();
 assert.equal(w.data.tasks['local-c'].plannedDate,'2026-11-27');assert.deepEqual(notes[0],[{id:'local-c',day:'2026-11-27',previous:{plannedDate:TODAY}}]);
 down(ev(720,310,target(chip)));handlers.pointermove(ev(500,400,target(chip)));handlers.pointermove(ev(150,550,target(chip)));handlers.pointerup(ev(150,550,target(chip)));await tick();
 assert.equal(w.data.tasks['local-a'].plannedDate,'','No date');assert.equal(w.data.tasks['local-a'].plannedTime,undefined,'no day, no time');assert.deepEqual(notes[1],[{id:'local-a',day:'',previous:{plannedDate:TODAY,plannedTime:'16:00'}}],'the note keeps the time to put back');
 // a press that does not move is a press (no drag, no change)
 const n=notes.length;down(ev(150,320,target(row)));handlers.pointerup(ev(151,321,target(row)));await tick();assert.equal(notes.length,n);
 ui.destroy();
});

test('keys: n and / to the add line; the calendar a grid (arrows, Home / End, Page Up / Down, Enter); Shift + left / right moves a task and the page goes with it; Escape',async()=>{
 const w=world(),notes=[],focused=[];
 const add={focus(){focused.push('add');},select(){}};
 const c=controller(w,{notePlan:rows=>{notes.push(plain(rows));return true;},nodes:{'.rd-plan-page:not([data-view]) [data-rd-field="plan-quick"]':add,'.rd-plan-page [data-rd-field="plan-quick"]':add}});
 const body={tagName:'BODY',dataset:{},classList:{contains:()=>false},closest:()=>null};
 c.key('n',body);c.key('/',body);assert.deepEqual(focused,['add','add']);
 c.key('n',{...body,tagName:'INPUT'});assert.equal(focused.length,2,'not while typing');
 // the grid: a focused day
 const day=k=>({tagName:'DIV',dataset:{day:k},classList:{contains:x=>x==='rd-plan-cell'},closest:()=>null});
 c.key('ArrowRight',day(TODAY));assert.equal(c.ui.ui.day,'2026-11-23');c.key('ArrowDown',day('2026-11-23'));assert.equal(c.ui.ui.day,'2026-11-30');
 c.key('ArrowUp',day('2026-11-30'));c.key('ArrowLeft',day('2026-11-23'));assert.equal(c.ui.ui.day,TODAY);
 c.key('Home',day('2026-11-25'));assert.equal(c.ui.ui.day,'2026-11-23');c.key('End',day('2026-11-25'));assert.equal(c.ui.ui.day,'2026-11-29');
 c.key('PageDown',day(TODAY));assert.equal(c.ui.ui.day,'2026-12-20');assert.equal(c.ui.ui.start,'2026-12-14','the calendar moves by its rows with it');
 c.key('PageUp',day('2026-12-20'));assert.equal(c.ui.ui.day,TODAY);
 c.key('Enter',day('2026-11-26'));assert.equal(c.ui.ui.day,'2026-11-26');assert.equal(focused.at(-1),'add','Enter: the caret in "Add a task"');
 // a task on the page: Shift + right moves it a day, the page follows it; on a chip in the calendar it moves too
 c.press('plan-today');
 const title=id=>{const row={dataset:{planId:id},closest:s=>s.startsWith('.rd-plan-page:not')?{}:s.startsWith('.rd-plan-nodate')?null:null};return {tagName:'BUTTON',dataset:{},classList:{contains:()=>false},closest:s=>s==='.rd-plan-title, .rd-plan-eopen'?{closest:()=>row}:null};};
 c.key('ArrowRight',title('local-c'),{shiftKey:true});await tick();assert.equal(w.data.tasks['local-c'].plannedDate,'2026-11-23');assert.equal(c.ui.ui.day,'2026-11-23','the page follows');assert.equal(notes.at(-1)[0].previous.plannedDate,TODAY);
 c.key('ArrowLeft',title('local-c'),{shiftKey:true});await tick();assert.equal(w.data.tasks['local-c'].plannedDate,TODAY);
 // Escape: closes the open things in turn (Show, the sheet, the overdue list)
 c.press('plan-show');c.key('Escape',body);assert.equal(c.ui.ui.showOpen,false);
 c.press('plan-sheet',{id:'local-a'});assert.equal(c.ui.ui.sheet,'local-a');c.key('Escape',body);assert.equal(c.ui.ui.sheet,null);
 c.press('plan-overdue');c.key('Escape',body);assert.equal(c.ui.ui.overdueOpen,false);
});

test('the sheet: one floating card beside what was pressed, with every field (rename, day by the shared picker, time, length, due, course, repeat, important, steps, note, delete)',async()=>{
 const w=world(),opened=[],c=controller(w,{view:id=>opened.push(id)}),inSheet={closest:s=>s==='.rd-plan-sheet'?{}:null},sp=(a,d,attrs={})=>c.press(a,d,attrs,inSheet);
 c.press('plan-sheet',{id:'local-b'});assert.equal(c.ui.ui.sheet,'local-b');
 let html=w.UI.render(w.ctx(),w.h,c.ui.ui);const sheet=()=>between(html,'<section class="rd-plan-sheet"');
 // one card over the page: a dialog of the Planner's own, not in the layout's flow; placed (left, top, its height) once
 assert.match(html,/<section class="rd-plan-sheet" id="rd-plan-sheet" role="dialog" data-rd-key="plan-sheet" data-id="local-b" tabindex="-1" aria-label="Outline the lab" data-placing="true" style="--rd-course:#286452">/);
 assert.ok(html.indexOf('rd-plan-sheet')>html.indexOf('<section class="rd-plan-cal"'),'after the page and the calendar: it pushes nothing');
 c.ui.ui.sheetPos={left:420,top:30,max:640};html=w.UI.render(w.ctx(),w.h,c.ui.ui);assert.match(html,/style="--rd-course:#286452;left:420px;top:30px;max-height:640px"/);assert.doesNotMatch(sheet(),/data-placing/);
 assert.match(html,/data-plan-id="local-b"[^>]*data-sheet="true"[\s\S]*?aria-expanded="true"/);
 for(const piece of ['data-rd-action="plan-sheet-close"','data-rd-field="plan-sheet-name" data-id="local-b" maxlength="200" value="Outline the lab"','data-rd-action="plan-view" data-id="local-b"','data-rd-field="plan-sheet-time" data-id="local-b" value="18:30"','data-rd-field="plan-sheet-due-day"','data-rd-field="plan-sheet-course"','<option value="7" selected>Chemistry</option>','data-rd-action="plan-repeat"','data-rd-action="plan-priority"','data-rd-action="plan-step-toggle" data-id="local-b" data-step="s1" aria-pressed="true"','data-rd-field="plan-step-new"','maxlength="2000"','>Use Tuesday&#39;s table.</textarea>','data-rd-action="plan-delete"'])assert.ok(sheet().includes(piece),piece);
 // its Day row is the same picker as the day button's: quick days, None, the small month
 assert.match(sheet(),/<div class="rd-plan-picker-body rd-plan-picker-inline" data-id="local-b"><div class="rd-plan-quickdays" role="group" aria-label="Quick days">/);
 assert.equal((sheet().match(/class="rd-plan-pick"/g)||[]).length,6,'Today, Tomorrow, four more days');assert.match(sheet(),/data-rd-action="plan-pick-day" data-id="local-b" data-day="2026-11-22" aria-pressed="true"[^>]*>Today</);
 assert.match(sheet(),/class="rd-plan-pick rd-plan-pick-none" data-rd-action="plan-pick-day" data-id="local-b" data-day="" aria-pressed="false" aria-label="No day">None</);
 assert.match(sheet(),/<strong>November 2026<\/strong>/);assert.equal((sheet().match(/class="rd-plan-mday"/g)||[]).length,42,'Oct 26 to Dec 6');
 assert.equal((sheet().match(/data-rd-action="plan-estimate"/g)||[]).length,6);assert.match(sheet(),/data-minutes="0" aria-label="45 min" aria-pressed="true"/,'pressed again: no length');
 // rename (a draft survives a redraw, saved when the field is left); an empty name is not saved
 c.ui.input({target:c.field('plan-sheet-name','Outline the lab (v2)',{id:'local-b'})});html=w.UI.render(w.ctx(),w.h,c.ui.ui);assert.match(sheet(),/value="Outline the lab \(v2\)"/);
 c.ui.change({target:c.field('plan-sheet-name','Outline the lab (v2)',{id:'local-b'})});await tick();assert.equal(w.data.customTasks.find(t=>t.id==='local-b').name,'Outline the lab (v2)');
 c.ui.change({target:c.field('plan-sheet-name','   ',{id:'local-b'})});await tick();assert.equal(w.data.customTasks.find(t=>t.id==='local-b').name,'Outline the lab (v2)');
 // a day from its picker (the time stays), another month, no day; time, no time; length
 c.press('plan-pick-day',{id:'local-b',day:'2026-11-24'},{},{closest:s=>s==='.rd-plan-sheet'?{}:null});await tick();assert.equal(w.data.tasks['local-b'].plannedDate,'2026-11-24');assert.equal(w.data.tasks['local-b'].plannedTime,'18:30');
 c.press('plan-pick-month',{id:'local-b',month:'2026-11',delta:'1'},{},{closest:s=>s==='.rd-plan-sheet'?{}:null});assert.equal(c.ui.ui.pickMonth['local-b'],'2026-12');html=w.UI.render(w.ctx(),w.h,c.ui.ui);assert.match(sheet(),/<strong>December 2026<\/strong>/);
 c.press('plan-pick-day',{id:'local-b',day:'2026-12-10'},{},{closest:s=>s==='.rd-plan-sheet'?{}:null});await tick();assert.equal(w.data.tasks['local-b'].plannedDate,'2026-12-10');
 c.ui.change({target:c.field('plan-sheet-time','07:15',{id:'local-b'})});await tick();assert.equal(w.data.tasks['local-b'].plannedTime,'07:15');
 c.ui.change({target:c.field('plan-sheet-time','',{id:'local-b'})});await tick();assert.equal(w.data.tasks['local-b'].plannedTime,undefined);
 c.press('plan-pick-day',{id:'local-b',day:''},{},{closest:s=>s==='.rd-plan-sheet'?{}:null});await tick();assert.equal(w.data.tasks['local-b'].plannedDate,'');
 sp('plan-estimate',{id:'local-b',minutes:'90'});await tick();assert.equal(w.data.tasks['local-b'].estimate,90);sp('plan-estimate',{id:'local-b',minutes:'0'});await tick();assert.equal(w.data.tasks['local-b'].estimate,0);
 // due in the student's zone; course; repeat; important
 c.ui.change({target:c.field('plan-sheet-due-day','2026-11-27',{id:'local-b'})});await tick();assert.equal(w.data.customTasks.find(t=>t.id==='local-b').dueAt,'2026-11-28T04:59:00.000Z','11:59 PM when no time');
 c.ui.change({target:{...c.field('plan-sheet-due-time','17:00',{id:'local-b'}),closest:()=>({querySelector:sel=>sel.includes('due-day')?{value:'2026-11-27'}:sel.includes('due-time')?{value:'17:00'}:null})}});await tick();assert.equal(w.data.customTasks.find(t=>t.id==='local-b').dueAt,'2026-11-27T22:00:00.000Z');
 c.ui.change({target:c.field('plan-sheet-course','8',{id:'local-b'})});await tick();assert.equal(w.data.customTasks.find(t=>t.id==='local-b').courseId,'8');
 sp('plan-repeat',{id:'local-b',every:'weekdays',wd:'0'});await tick();assert.deepEqual(plain(w.data.customTasks.find(t=>t.id==='local-b').repeat),{every:'weekdays',interval:1});
 html=w.UI.render(w.ctx(),w.h,c.ui.ui);assert.match(sheet(),/data-rd-action="plan-repeat-skip"/);
 sp('plan-repeat',{id:'local-b',every:'',wd:'0'});await tick();assert.equal(w.data.customTasks.find(t=>t.id==='local-b').repeat,undefined);
 sp('plan-priority',{id:'local-b'});await tick();assert.equal(w.data.tasks['local-b'].priority,'high');
 // steps: add (Enter), tick, edit, take out (the reader's "Make a plan" list)
 const stepField=c.field('plan-step-new','Write the method',{id:'local-b'});c.key('Enter',stepField);await tick();
 const steps=()=>plain(w.data.tasks['local-b'].checklist);assert.deepEqual(steps().map(x=>[x.text,x.done]),[['Find the table',true],['Write the method',false]]);
 const id2=steps()[1].id;sp('plan-step-toggle',{id:'local-b',step:id2},{'aria-pressed':'false'});await tick();assert.equal(steps()[1].done,true);
 c.ui.change({target:c.field('plan-step-text','Write the method section',{id:'local-b',step:id2})});await tick();assert.equal(steps()[1].text,'Write the method section');
 sp('plan-step-remove',{id:'local-b',step:'s1'});await tick();assert.deepEqual(steps().map(x=>x.text),['Write the method section']);
 // a note: saved when left; what is typed and not left is saved when the sheet closes (Escape)
 c.ui.change({target:c.field('plan-sheet-note','Ask about error bars.',{id:'local-b'})});await tick();assert.equal(w.data.tasks['local-b'].notes,'Ask about error bars.');
 c.ui.input({target:c.field('plan-sheet-note','Ask about error bars. And units.',{id:'local-b'})});c.key('Escape',{dataset:{},tagName:'DIV',closest:()=>null});await tick();
 assert.equal(c.ui.ui.sheet,null);assert.equal(w.data.tasks['local-b'].notes,'Ask about error bars. And units.');
 // Canvas work: its name fixed, Open is the reader; no rename, due, course, repeat, delete
 c.press('plan-sheet',{id:'17'});html=w.UI.render(w.ctx(),w.h,c.ui.ui);
 assert.match(sheet(),/<h2 class="rd-plan-sheet-title">Gas laws<\/h2>/);for(const no of ['data-rd-field="plan-sheet-name"','data-rd-field="plan-sheet-due-day"','data-rd-field="plan-sheet-course"','data-rd-action="plan-repeat"','plan-delete'])assert.ok(!sheet().includes(no),no);
 assert.match(sheet(),/<p class="rd-plan-sheet-fixed">Tue, Nov 24 · 3:00 PM<\/p>/);sp('plan-view',{id:'17'});assert.deepEqual(opened,['17']);
 // pressed again: it closes; another task: that one's sheet; a press anywhere else closes it
 c.press('plan-sheet',{id:'17'});assert.equal(c.ui.ui.sheet,null);c.press('plan-sheet',{id:'local-g'});c.ui.click({target:{closest:()=>null}});assert.equal(c.ui.ui.sheet,null);
 c.press('plan-sheet',{id:'local-g'});sp('plan-delete',{id:'local-g'});await tick();assert.equal(w.data.customTasks.some(t=>t.id==='local-g'),false);assert.equal(c.ui.ui.sheet,null);
 // the placing: beside what was pressed, never off screen, its own scroll when the window is short (planner-ui.js)
 const src=dense(fs.readFileSync(ext('planner-ui.js'),'utf8'));assert.match(src,/x=a\.right\+14\+w<=lo\.right\?a\.right\+14:a\.left-14-w>=lo\.left\?a\.left-14-w/);assert.match(src,/y=Math\.max\(lo\.top,Math\.min\(lo\.bottom-hgt,y\)\)/);
 const css=fs.readFileSync(ext('widgets.css'),'utf8');assert.match(css,/\.rd \.rd-plan-sheet \{position:absolute;z-index:80;[^}]*overflow-y:auto;/);
});

test('the day button and its one picker: on every row of Home and Assignments (a course\'s list too), in the reader, on the overdue list; choosing writes the day with the note',async()=>{
 const w=world(),UI=w.UI,E=w.h.E,fd=w.h.formatDate;
 assert.match(UI.dayButton({id:'17',planned:'',title:'Gas laws'},{E,today:TODAY,formatDate:fd}),/^<button type="button" class="rd-plan-daybtn" data-rd-action="plan-pick" data-id="17" data-day="" data-planned="false" aria-haspopup="dialog" aria-expanded="false" aria-label="Plan Gas laws"><svg class="rd-plan-ic"[\s\S]*?<\/svg><span>Plan<\/span><\/button>$/);
 const word=day=>/<span>([^<]+)<\/span><\/button>$/.exec(UI.dayButton({id:'1',planned:day,title:'x'},{E,today:TODAY,formatDate:fd}))[1];
 assert.deepEqual(['2026-11-22','2026-11-23','2026-11-26','2026-12-04','2026-11-19'].map(word),['Today','Mon','Thu','Dec 4','Nov 19']);
 assert.match(UI.dayButton({id:'1',planned:'2026-11-23',title:'Gas laws'},{E,today:TODAY,formatDate:fd}),/aria-label="Gas laws: planned for Monday, November 23\. Change the day"/);
 // the picker: quick days, None, a small month (Monday first); the suggested day carries a dot
 const pk=UI.pickerHTML({id:'17',planned:'2026-11-24',today:TODAY,suggested:'2026-11-25',E,formatDate:fd});
 assert.deepEqual([...pk.matchAll(/class="rd-plan-pick" [^>]*>([^<]+)</g)].map(m=>m[1]),['Today','Tomorrow','Tue','Wed','Thu','Fri']);
 assert.match(pk,/data-day="2026-11-24" aria-pressed="true"/);assert.match(pk,/data-day="2026-11-25" aria-pressed="false" data-suggest="true" aria-label="Wednesday, November 25, suggested"/);
 assert.match(pk,/<div class="rd-plan-mnames" aria-hidden="true"><span>M<\/span><span>T<\/span>/);assert.match(pk,/class="rd-plan-mday" data-rd-action="plan-pick-day" data-id="17" data-day="2026-11-24" aria-pressed="true"[^>]*tabindex="0"/);
 // the shared row renderer (Home's lists, Assignments, a course's list) and the reader carry it (dashboard-view.js)
 const V=dense(fs.readFileSync(ext('dashboard-view.js'),'utf8'));
 assert.match(V,/<div class="rd-row-actions">\$\{finished\(item\)\?'':dayButton\(item\)\}\$\{bookmarkButton\(item\)\}/);
 assert.match(V,/\$\{planUI\?dayButton\(item\):action\('schedule',icon\(planned\?'check':'plus'\)\+\(planned\?'In today’s plan':'Plan for today'\)/,'in the reader in place of "Plan for today" (kept where the Planner is off)');
 // choosing in the floating picker writes the planned day the Planner writes, with the same note; None too
 const notes=[],c=controller(w,{notePlan:rows=>{notes.push(plain(rows));return true;}});
 c.press('plan-pick-day',{id:'17',day:'2026-11-26'});await tick();assert.equal(w.data.tasks['17'].plannedDate,'2026-11-26');assert.deepEqual(notes[0],[{id:'17',day:'2026-11-26',previous:{plannedDate:''}}]);
 c.press('plan-pick-day',{id:'17',day:''});await tick();assert.equal(w.data.tasks['17'].plannedDate,'');assert.equal(notes[1][0].day,'');
 // the picker is one card of its own over the page (kept across the dashboard's redraws), placed by its button
 const src=dense(fs.readFileSync(ext('planner-ui.js'),'utf8'));assert.match(src,/function float\(cls,label\)\{const n=doc\.createElement\('div'\);n\.className=cls;n\.setAttribute\('data-rd-keep',''\);n\.setAttribute\('role','dialog'\)/);assert.match(src,/float\('rd-plan-picker',`Day for \$\{e\.title\}`\)/);
});

test('Home\'s "My plan" is the Planner\'s own day page for today: its rows in time order, ticks, the add line (Home\'s course kept)',()=>{
 const w=world(),UI=w.UI,home=UI.dayPage(w.ctx(),w.h,{});
 assert.match(home,/^<div class="rd-plan-home" data-rd-key="plan-home"><div class="rd-plan-rows rd-plan-day-rows" role="list" aria-label="Today" data-timed="true">/);
 assert.deepEqual(rowIds(home),['local-a','local-b','local-d','local-c']);
 assert.match(home,/data-rd-action="check-off" data-id="local-a"/);assert.match(home,/data-rd-action="preview" data-id="local-a"/,'a title opens the reader beside, as Home does');
 assert.match(home,/<form class="rd-quick-add rd-plan-add" data-rd-form="plan-quick" data-day="2026-11-22" data-at="home">/);
 assert.deepEqual(rowIds(UI.dayPage(w.ctx(),w.h,{},{courseId:'7'})),['local-b','local-d'],'only the course chosen on Home');
 const V=dense(fs.readFileSync(ext('dashboard-view.js'),'utf8'));assert.match(V,/const rows=asPlan\?root\.ReservePlannerUI\.dayPage\(c,h,c\.planUI\|\|\{\},\{courseId:state\.courseId\}\)/);
 assert.match(V,/if\(homePlan\(\)\)\{const k=planOpen\(\);if\(Number\.isFinite\(k\)\)n\.planned=k;\}/,'its count is the page\'s');
});

test('Add a task from the top bar on any tab: one plus, the key n; the same add line and tags; Enter adds and the note says where it went',async()=>{
 const w=world(),added=[],c=controller(w,{noteAdded:rows=>{added.push(plain(rows));return true;}});
 const V=dense(fs.readFileSync(ext('dashboard-view.js'),'utf8'));
 assert.match(V,/action\('plan-add-pop',root\.ReservePlannerUI\.plus\|\|icon\('plus'\),'aria-label="Add a task" title="Add a task · N" aria-keyshortcuts="n" aria-haspopup="dialog" aria-expanded="false"','rd-icon-button rd-plan-add-pop'\)/);
 // on another tab (no Planner on the page) n opens the card; not while a field has the caret, not over a room
 const opened=[];const src=dense(fs.readFileSync(ext('planner-ui.js'),'utf8'));assert.match(src,/event\.preventDefault\(\);openAdd\(\);return true;/);
 const none=w.UI.create({container:{dataset:{},style:{setProperty(){}},ownerDocument:{addEventListener(){},removeEventListener(){},createElement:()=>{const n={className:'',style:{},attrs:{},setAttribute(k,v){n.attrs[k]=v;},remove(){opened.push('closed');},animate(){},querySelector:()=>({focus(){opened.push('focus');}}),contains:()=>false,set innerHTML(v){n.html=v;},get innerHTML(){return n.html;}};opened.push(n);return n;}},addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],append(){},contains:()=>true},store:{get:()=>w.data},save:ch=>{ch(w.data);return Promise.resolve(true);},rerender(){},getContext:w.ctx,helpers:()=>w.h,noteAdded:rows=>{added.push(plain(rows));return true;}});
 const body={tagName:'BODY',dataset:{},classList:{contains:()=>false},closest:()=>null};
 none.keydown({key:'n',target:body,preventDefault(){},composedPath:()=>[body]});const card=opened.find(x=>typeof x==='object');
 assert.ok(card,'the card opened');assert.equal(card.className,'rd-plan-addpop');assert.equal(card.attrs['data-rd-keep'],'');assert.equal(card.attrs.role,'dialog');
 assert.match(card.html,/<form class="rd-quick-add rd-plan-add" data-rd-form="plan-quick" data-day="2026-11-22" data-at="pop">/,'the same add line; a task lands on today unless the words say');
 // added from the card: the note (where it went) and the card closes; elsewhere the caret stays
 w.data.customTasks.push({id:'local-new',name:'piano',courseId:'personal',dueAt:null,createdAt:'2026-11-22T12:00:00.000Z'});w.data.tasks['local-new']={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:30,plannedDate:'2026-11-27',plannedTime:'17:00',checklist:[]};
 assert.equal(none.added('local-new','pop'),false);assert.deepEqual(added[0],[{id:'local-new',day:'2026-11-27'}]);assert.ok(opened.includes('closed'));
 assert.equal(c.ui.added('local-new',''),true);
 // the note: an add says where it went, and its Undo takes the new task out again (dashboard.js putBack, kind "add")
 const D=dense(fs.readFileSync(ext('dashboard.js'),'utf8'));assert.match(D,/if\(x\.kind==='add'\)\{if\(\/\^local-\[\\w-\]\+\$\/\.test\(x\.taskId\|\|''\)\)\{data\.customTasks=\(data\.customTasks\|\|\[\]\)\.filter\(t=>t&&t\.id!==x\.taskId\);delete data\.tasks\[x\.taskId\];\}continue;\}/);
 const View=box(['dashboard-view.js']).ReserveDashboardView,n=View.noteHTML({entries:[{id:'add:local-new',kind:'add',name:'piano',due:'Fri, Nov 27'}],state:'folded'},{E:w.h.E,icon:k=>`<i data-i="${k}"></i>`});
 assert.equal(n.said,'Added: piano, Fri, Nov 27');assert.match(n.html,/<span>Added<\/span> <span class="rd-note-one">piano · Fri, Nov 27<\/span>/);assert.match(n.html,/data-i="plus"/);
 // widgets.js: the caret stays in the line it was typed in (the top bar's card closes instead)
 const W=dense(fs.readFileSync(ext('widgets.js'),'utf8'));assert.match(W,/if\(planner\?\.added\?\.\(id,at\)!==false\)container\.querySelector\(`\[data-rd-field="plan-quick"\]\[data-at="\$\{at\}"\]`\)/);
});

test('"Your week": no advice stands on the page; one quiet button with the count opens its findings, each with its action, Dismiss and Undo',async()=>{
 const w=world();let html=w.UI.render(w.ctx(),w.h,{});
 const n=w.HP.weekCheck(w.S.ReserveWidgets.plan(w.ctx(),w.h).list,{now:NOW,zone:ZONE,items:w.ctx().items,toolbox:w.data.toolbox}).length;assert.ok(n>0);
 assert.match(html,new RegExp(`<button type="button" class="rd-button rd-plan-tool rd-plan-week-btn" data-rd-action="plan-week-open" aria-expanded="false" aria-haspopup="true"><svg[\\s\\S]*?<\\/svg><span>Your week<\\/span><b>${n}<\\/b><\\/button>`));
 assert.doesNotMatch(html,/rd-plan-weekpop|data-rd-action="plan-check-act"/,'closed: nothing of it on the page');
 const c=controller(w);c.press('plan-week-open');html=w.UI.render(w.ctx(),w.h,c.ui.ui);
 assert.match(html,/<div class="rd-plan-pop rd-plan-weekpop" id="rd-plan-week-pop" role="group" aria-label="Your week">/);
 assert.match(html,/<li class="rd-plan-finding" data-rd-key="adv-heavy:2026-11-22" data-advice-place="week"><p>Too much today[^<]*<\/p><span class="rd-plan-advice"><button type="button" class="rd-button rd-plan-check-act" data-rd-action="plan-check-act" data-key="heavy:2026-11-22"/);
 assert.match(html,/data-rd-action="plan-check-dismiss" data-key="heavy:2026-11-22" aria-label="Dismiss: Too much today/);
 const before=plain(w.data.tasks);c.ui.click({target:{closest:sel=>sel==='[data-rd-action]'?{dataset:{rdAction:'plan-check-act',key:'heavy:2026-11-22'},closest:()=>null}:sel==='.rd-plan-weekbox'?{}:null}});await tick();
 html=w.UI.render(w.ctx(),w.h,c.ui.ui);assert.match(html,/<p class="rd-plan-advice" data-done="true" data-rd-key="adv-done"><span>Moved [^<]+\.<\/span><button type="button" class="rd-text-button" data-rd-action="plan-check-undo" >Undo<\/button>/,'the done line, in the card');
 c.ui.ui.check.at=Date.now()-91000;assert.doesNotMatch(w.UI.render(w.ctx(),w.h,c.ui.ui),/data-rd-key="adv-done"/,'gone after 90 seconds');c.ui.ui.check.at=Date.now();
 c.press('plan-check-undo');await tick();assert.deepEqual(plain(w.data.tasks),before);
 // no findings: no button
 const quiet=world({withHelp:false});assert.doesNotMatch(quiet.UI.render(quiet.ctx(),quiet.h,{}),/plan-week-open/);
});

test('Show: the courses (their colours), Mine, Everything and Finished in one small card; the page and the calendar follow; not saved',async()=>{
 const w=world(),c=controller(w);
 c.press('plan-show');let html=w.UI.render(w.ctx(),w.h,c.ui.ui);
 assert.match(html,/<div class="rd-plan-pop" id="rd-plan-show-pop" role="group" aria-label="Show">/);assert.equal((html.match(/data-rd-action="plan-show-pick"/g)||[]).length,3);assert.match(html,/data-rd-action="plan-done" aria-pressed="false"/);
 c.press('plan-show-pick',{course:'7'});html=w.UI.render(w.ctx(),w.h,c.ui.ui);
 assert.match(html,/data-filtered="true"/);assert.match(html,/<span>Show 1 of 3<\/span>/);assert.deepEqual(rowIds(page(html)).filter(id=>!id.startsWith('local-n')),['local-b','local-d']);
 assert.doesNotMatch(cell(html,'2026-11-25'),/pe-21@/,'the calendar follows');
 c.press('plan-show-all');assert.equal(c.ui.ui.show,null);assert.equal(w.data.toolbox.planner,undefined,'not saved');
 // Finished: hidden unless it is on (a tick stays two minutes)
 c.press('check-off',{id:'local-c'},{},{closest:s=>s==='[data-plan-id]'?{dataset:{planId:'local-c'}}:null});w.data.tasks['local-c'].checkedOff=true;
 assert.ok(rowIds(page(w.UI.render(w.ctx(),w.h,c.ui.ui))).includes('local-c'),'just ticked: it stays a while');
 c.ui.ui.recent.set('local-c',Date.now()-130000);assert.ok(!rowIds(page(w.UI.render(w.ctx(),w.h,c.ui.ui))).includes('local-c'),'then it is hidden');
 c.press('plan-done');assert.match(page(w.UI.render(w.ctx(),w.h,c.ui.ui)),/data-plan-id="local-c" data-done="true"/,'Finished on: struck, at the end');
});

test('Biscuit\'s study blocks are rows of their day in the same time order (not tickable)',()=>{
 const w=world(),at=Date.parse('2026-11-22T22:00:00Z');   // 5:00 PM in New York
 w.data.toolbox.biscuitPlan={records:{'local-a':{after:{plannedDate:TODAY,plannedTime:'16:00',estimate:30}}},blocks:[{kind:'study',itemId:'local-a',title:'Flashcards',start:at,end:at+30*60000,reason:'Before the quiz'},{kind:'break',title:'Break',start:at+30*60000,end:at+40*60000,reason:'A short rest'}]};
 const p=page(w.UI.render(w.ctx(),w.h,{})),order=[...p.matchAll(/data-rd-key="(p[bi]-[^"]+)"/g)].map(m=>m[1].replace(/-\d{10,}-/,'-'));
 assert.deepEqual(order.slice(0,5),['pi-local-a','pb-local-a','pb-break','pi-local-b','pi-local-d'],'4 PM, the 5 PM block, its break, 6:30 PM, then the untimed');
 assert.match(p,/<div class="rd-plan-item" role="listitem" data-block="study"[^>]*title="Before the quiz"><span class="rd-plan-blockmark" aria-hidden="true"><\/span><span class="rd-plan-at">5:00 PM<\/span><button type="button" class="rd-plan-title" data-rd-action="plan-view" data-id="local-a"/);
 assert.match(p,/data-block="break"[\s\S]*?<span class="rd-plan-title rd-plan-title-still">Break<\/span><small class="rd-plan-meta"><span>until 5:40 PM<\/span>/);
});

test('saved data: 4.2.11\'s and 4.2.12\'s load unchanged in this build; this build\'s loads in 4.2.12 and 4.2.11 with nothing lost',async()=>{
 const old={format:'reserve-backup',version:1,data:{settings:{},toolbox:{planner:{view:'list',hours:true}},customTasks:[{id:'local-1',name:'Outline the lab write-up',courseId:'101',dueAt:null,createdAt:'2026-11-10T12:00:00.000Z'},{id:'local-2',name:'Piano',courseId:'personal',dueAt:null,createdAt:'2026-11-10T12:00:00.000Z',repeat:{every:'week',interval:1,days:[1]}}],
  tasks:{'local-1':{pinned:false,checkedOff:false,progress:'not-started',notes:'n1',estimate:45,plannedDate:'2026-11-23',plannedTime:'16:00',checklist:[{id:'a',text:'Intro',done:true}]},'local-2':{pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:30,plannedDate:'2026-11-23',repeatLog:[{day:'2026-11-16'}],repeatFrom:'2026-11-16',checklist:[]}}}};
 const data=validateBackup(plain(old)),S=box(['planner-model.js']);
 assert.deepEqual(plain(S.ReservePlanner.migrate(plain(data))),plain(data),'nothing to rewrite');
 // this build's changes (the sheet, a drag to no day, All to today, Tick all, an add), the record saved and read back
 const P=S.ReservePlanner,mine=plain(data);
 P.rename('local-1','Outline the lab write-up (draft)')(mine);P.setNote('local-1','Ask about error bars.')(mine);P.addStep('local-1','Write the method','step-x')(mine);
 P.setDue('local-1','2026-11-27','17:00','America/New_York')(mine);P.planMany([['local-1','2026-11-24']])(mine);P.plan('local-2','')(mine);mine.tasks['local-2'].checkedOff=true;
 P.addTask({name:'piano',day:'2026-11-27',at:'17:00',estimate:30},{id:'local-3',nowISO:'2026-11-22T12:00:00.000Z',zone:'America/New_York'})(mine);
 mine.toolbox={...mine.toolbox,planner:{...mine.toolbox.planner,view:'month'}};
 const adapter=(()=>{const m={};return {read:async k=>structuredClone(m[k]),write:async(k,v)=>{m[k]=structuredClone(v);}};})(),store=createStore({accountId:'44',adapter});await store.load();
 await store.update(s=>{s.customTasks=mine.customTasks;s.tasks=mine.tasks;s.toolbox={...s.toolbox,...mine.toolbox};});
 const saved=await createStore({accountId:'44',adapter}).load(),back=validateBackup({format:'reserve-backup',version:1,data:saved});
 assert.deepEqual(back.toolbox.planner,{view:'month',hours:true},'the view saved; 4.2.12\'s hours kept untouched');
 assert.deepEqual(back.customTasks.find(t=>t.id==='local-3'),{id:'local-3',name:'piano',courseId:'personal',dueAt:null,createdAt:'2026-11-22T12:00:00.000Z'});
 // the older builds' own planner models on that record (kept as tests/fixtures/planner-model-4.2.11.js and -4.2.12.js)
 for(const name of ['planner-model-4.2.11.js','planner-model-4.2.12.js']){
  const O=vm.createContext({console,Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map,RegExp,Error});O.globalThis=O;vm.runInContext(fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8'),O,{filename:name});
  const OP=O.ReservePlanner;assert.equal(typeof OP.span,'undefined','(an older model indeed)');
  assert.deepEqual(plain(OP.migrate(plain(back))),plain(back),name+' rewrites nothing');
  const items=back.customTasks.map(t=>({id:t.id,name:t.name,courseId:t.courseId,courseName:'',personal:true,dueAt:t.dueAt,repeat:t.repeat}));
  const list=plain(OP.entries(items,back.tasks,{dayOf:v=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(v)),today:'2026-11-22',isDone:(i,m)=>m.checkedOff===true}));
  const e=list.find(x=>x.id==='local-1');assert.deepEqual([e.title,e.planned,e.plannedTime,e.estimate,e.steps,e.dueDay],['Outline the lab write-up (draft)','2026-11-24','16:00',45,2,'2026-11-27'],name);
  assert.equal(list.find(x=>x.id==='local-3').planned,'2026-11-27');assert.equal(list.find(x=>x.id==='local-3').plannedTime,'17:00');
  const view=OP.range(list,'2026-11-22','2026-11-22',7);assert.ok(view.days.find(d=>d.key==='2026-11-24').all.some(x=>x.id==='local-1'));
 }
 // 4.2.12 opens such data on its List (it reads "month" as List), 4.2.11 on its Week (any view but "day")
 const o12=fs.readFileSync(path.join(__dirname,'fixtures','planner-model-4.2.12.js'),'utf8');assert.match(o12,/planMany/);
});

test('motion off and a short window keep every state; the Planner never makes the page scroll (it is measured, its rows follow)',()=>{
 const css=fs.readFileSync(ext('widgets.css'),'utf8');
 assert.match(css,/\.rd:is\(\[data-motion-style=off\],\[data-motion-style=still\]\) :is\(\.rd-plan,\.rd-plan-picker,\.rd-plan-addpop\) :is\(\*,\*::before,\*::after\) \{animation:none!important;transition:none!important;\}/);
 assert.match(css,/\.rd \.rd-plan-body \{display:grid;grid-template-columns:clamp\(380px,30%,520px\) minmax\(0,1fr\);[^}]*height:var\(--rd-plan-h,auto\);min-height:300px;/);
 assert.match(css,/@container rd-plan \(max-width: 759\.98px\)/);
 const src=dense(fs.readFileSync(ext('planner-ui.js'),'utf8'));
 assert.match(src,/const floor=plan\.getBoundingClientRect\(\)\.width<760\?FLOOR_ONE:FLOOR,roomH=Math\.floor\(bottom-top-below-4\),tuck=roomH<floor;/);assert.match(src,/const over=scroller\.scrollHeight-scroller\.clientHeight;if\(!tuck&&over>0&&H>floor\)\{H=Math\.max\(floor,H-over\);set\(H\);\}/);
 assert.match(src,/if\(JSON\.stringify\(key\(\)\)!==before\)rerender\(\);/,'a new count of rows redraws once; the same never does');
});

// ---- (4.2.14) other window sizes: what a smaller or shorter window could not read or reach ------------------------------------
test('other sizes: two months have a short form beside the long one; one month stays whole; the count line is whole phrases',()=>{
 const w=world(),html=w.UI.render(w.ctx(),w.h,{});
 // both forms are in the page, the stylesheet shows one; the heading's name for a reader is the long one
 assert.match(html,/<h2 id="rd-plan-cal-title" class="rd-plan-months" aria-label="November – December"><span class="rd-plan-months-l">November – December<\/span><span class="rd-plan-months-s" aria-hidden="true">Nov – Dec<\/span><\/h2>/);
 assert.match(w.UI.render(w.ctx(),w.h,{mode:'week'}),/<h2 id="rd-plan-cal-title" class="rd-plan-months">November<\/h2>/,'one month: nothing to shorten');
 // into another year: the long form names both years, the short one marks the year that is not this one
 const later=w.UI.render(w.ctx(),w.h,{start:'2026-12-21'});
 assert.match(later,/aria-label="December 2026 – January 2027"><span class="rd-plan-months-l">December 2026 – January 2027<\/span><span class="rd-plan-months-s" aria-hidden="true">Dec – Jan ’27<\/span>/);
 // the count line: three pieces, so a narrow heading drops whole ones ("planned" first) and never shows "14 h" for "14 h 25 min"
 const sub=html.match(/<p class="rd-plan-sub" data-rd-key="plan-sub">(.*?)<\/p>/)[1];
 assert.match(sub,/^<i><\/i><span>\d+ of \d+ done<\/span> <span>· \d+ h( \d+ min)?<\/span> <span>planned<\/span>$/);
 assert.equal(sub.replace(/<[^>]+>/g,'').trim().replace(/\s+/g,' ').match(/^\d+ of \d+ done · \d+ h( \d+ min)? planned$/)!==null,true,'it still reads as one line');
 const css=fs.readFileSync(ext('widgets.css'),'utf8');
 assert.match(css,/\.rd \.rd-plan-months-s \{display:none;\}/);
 assert.match(css,/@container rd-plan \(max-width: 1419\.98px\) \{\r?\n \.rd \.rd-plan-months-l \{display:none;\}\r?\n \.rd \.rd-plan-months-s \{display:inline;\}/);
 assert.match(css,/\.rd \.rd-plan-sub > span \{display:inline-block;white-space:nowrap;\}/);
 assert.match(css,/\.rd \.rd-plan-cal-head \{flex-wrap:wrap;row-gap:6px;\}/,'what still does not fit goes under: Week | Month is never pushed off the page');
});

test('other sizes: today first. No date gets what the day\'s own rows leave, folds to one line, opens on a press and folds again',()=>{
 const w=world();for(let i=0;i<5;i++){w.data.customTasks.push({id:'local-n'+i,name:'Loose '+i,courseId:'personal',dueAt:null,createdAt:'2026-11-20T12:00:00.000Z'});w.data.tasks['local-n'+i]={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:0,plannedDate:'',checklist:[]};}
 const nod=room=>between(page(w.UI.render(w.ctx(),w.h,{listRoom:room})),'rd-plan-nodate','</section>'),day=room=>rowIds(between(page(w.UI.render(w.ctx(),w.h,{listRoom:room})),'rd-plan-day-rows','rd-plan-add'));
 // four rows today (176 px), seven with no date: the day's rows are all there at every size
 for(const room of [900,400,300,200,120])assert.equal(day(room).length,4,'the day keeps its rows at '+room);
 assert.equal(rowIds(nod(900)).length,7);assert.doesNotMatch(nod(900),/rd-plan-fold|plan-more/);
 // 400 - 176 - label 40 - "n more" 26 = 158: three rows; 300: one; 200 and less: its one line
 assert.equal(rowIds(nod(400)).length,3);assert.match(nod(400),/data-rd-action="plan-more" data-tray="nodate">4 more</);
 assert.equal(rowIds(nod(300)).length,1);assert.match(nod(300),/data-rd-action="plan-more" data-tray="nodate">6 more</);
 const folded=nod(200);assert.equal(rowIds(folded).length,0);assert.match(folded,/data-folded="true"/);assert.doesNotMatch(folded,/class="rd-plan-rows"|rd-plan-more-link/);
 assert.match(folded,/<h3 class="rd-plan-label" id="rd-plan-nodate-h"><button type="button" class="rd-plan-fold" data-rd-action="plan-more" data-tray="nodate" data-fold="open" aria-expanded="false" aria-label="No date: 7"><span>No date<\/span><b>7<\/b><svg/);
 assert.match(folded,/data-plan-drop=""/,'folded, it still takes a drop');
 // the room is measured without the Overdue line's "auto" top margin (the free room itself): a roomy page is never taken for a crowded one
 const src=dense(fs.readFileSync(ext('planner-ui.js'),'utf8'));
 assert.match(src,/const od=page\?\.querySelector\(':scope > \.rd-plan-overdue'\);/);assert.match(src,/\.reduce\(\(n,s\)=>n\+outer\(page\.querySelector\(s\)\),0\)-\(od\?od\.getBoundingClientRect\(\)\.height:0\)-28\)\);/);
 assert.doesNotMatch(src,/':scope > \.rd-plan-read',':scope > \.rd-plan-overdue'\]\.reduce/);
 // a press opens it (all seven, its own scroll), the same line folds it again
 const c=controller(w);c.ui.ui.listRoom=200;c.press('plan-more',{tray:'nodate',fold:'open'});assert.equal(c.ui.ui.nodateMore,true);
 const open=between(page(w.UI.render(w.ctx(),w.h,c.ui.ui)),'rd-plan-nodate','</section>');assert.equal(rowIds(open).length,7);assert.match(open,/data-fold="close" aria-expanded="true"/);
 c.press('plan-more',{tray:'nodate',fold:'close'});assert.equal(c.ui.ui.nodateMore,false);
});

test('other sizes: a short window. One week when two rows do not fit; the Planner is as tall as its room from 340 px, and takes the whole column under that',()=>{
 const w=world(),UI=w.UI;
 assert.deepEqual([240,280,289,290,330,400].map(height=>UI.fit({height}).rows),[1,1,1,2,2,2],'two rows need 104 px each under the heading and the day names');
 assert.ok(UI.fit({height:280}).chips>=5,'the one week holds its tasks');assert.equal(UI.fit({height:300}).chips,3);
 assert.match(UI.render(w.ctx(),w.h,{height:280}),/data-rows="1" style="--rd-plan-rows:1"/);
 const src=dense(fs.readFileSync(ext('planner-ui.js'),'utf8')),css=fs.readFileSync(ext('widgets.css'),'utf8');
 assert.match(src,/const FLOOR=340,FLOOR_ONE=440;let tuckFor=null,tucked=false,tuckAt=0;/);
 assert.match(src,/let H=tuck\?Math\.max\(300,Math\.floor\(\(own\?box\.clientHeight:\(root\.innerHeight\|\|800\)\)-below-4\)\):roomH;set\(H\);/,'short of room: the whole column');
 assert.match(src,/if\(tuck\)\{const now=own\?box\.scrollTop:docTop;if\(tuckFor!==plan\|\|!tucked\|\|Math\.abs\(now-tuckAt\)<2\)\{const at=[^;]+;try\{if\(own\)box\.scrollTop=at;else se\.scrollTop=at;\}catch\{\}tuckAt=own\?box\.scrollTop:\(se\.scrollTop\|\|0\);\}\}/,'brought into view when it opens or the window gets that short, and kept there while the heading settles; never after the student scrolled away');
 // what scrolls it: its own column, or the nearest thing round it that scrolls (the shell, with the courses across the top), or the window
 assert.match(src,/let box=column\?ws:null;if\(!box\)for\(let a=\(ws\|\|plan\)\.parentElement;a;a=a\.parentElement\)if\(scrolls\(a\)\)\{box=a;break;\}/);
 assert.match(src,/const own=!!box,scroller=own\?box:se;if\(!scroller\)return;/);assert.match(src,/const host=column\?ws:plan\.parentElement,/);
 assert.match(src,/tuckFor=plan;tucked=tuck;/);
 assert.doesNotMatch(css,/\.rd \.rd-plan-body \{[^}]*min-height:4[24]0px/);
 assert.match(css,/\.rd \.rd-plan\[data-cal=open\] \.rd-plan-cal-back \{display:inline-flex;\}/,'the one-column page: its month has a way back to the day');
 assert.match(UI.render(w.ctx(),w.h,{}),/<header class="rd-plan-cal-head"><button type="button" class="rd-button rd-plan-cal-back" data-rd-action="plan-cal-open" aria-label="Back to Sunday, November 22"><svg[^>]*>.*?<\/svg><span>Day<\/span><\/button><h2 /,'it says where it goes ("Day", as the day\'s page says "Month"), not a second arrow beside the weeks\' own');
});

test('other sizes: the stylesheet. The name first in a row, chips without their ring in a narrow day, bars at a phone\'s width, the house scroll bar',()=>{
 const css=fs.readFileSync(ext('widgets.css'),'utf8'),block=css.slice(css.indexOf('/* (4.2.14) other window sizes'));
 assert.ok(block.length>500&&block.length<9000,'one block, after the Planner\'s own rules');
 // the course is its dot between the one-column page and 1420 px (the one-column page keeps the name: it has the width)
 assert.match(block,/@container rd-plan \(min-width: 760px\) and \(max-width: 1419\.98px\) \{\r?\n \.rd \.rd-plan-meta \.rd-plan-cname \{display:none;\}/);
 assert.match(block,/\.rd \.rd-plan-page\[data-view=overdue\] \.rd-plan-meta \{flex:none;max-width:none;\}/,'the overdue list never cuts the due day');
 assert.match(block,/@container rd-plan \(max-width: 1269\.98px\) \{\r?\n \.rd \.rd-plan-cal \.rd-plan-entry > \.rd-plan-etick \{display:none;\}/);
 assert.match(block,/@container rd-plan \(max-width: 1239\.98px\) \{\r?\n \.rd \.rd-plan-tool > span \{display:none;\}/);
 assert.match(block,/\.rd \.rd-plan\[data-mode=week\] \.rd-plan-etime \{white-space:nowrap;\}\r?\n\.rd \.rd-plan\[data-mode=week\] \.rd-plan-etime \+ \.rd-plan-etitle::before \{content:"\\200B";\}/,'"9:30 AM" stays in one piece, and the name may start the next line (only after a time: a chip with no time keeps its first line)');
 assert.match(block,/\.rd \.rd-plan-page\[data-view=overdue\] \.rd-plan-meta \.rd-plan-cname \{display:none;\}/);
 const phone=block.slice(block.indexOf('@container rd-plan (max-width: 559.98px)'));assert.ok(phone.length>100,'a phone\'s width has its own rules');
 assert.match(phone,/^@container rd-plan \(max-width: 559\.98px\) \{\r?\n \.rd \.rd-plan-meta \.rd-plan-cname \{display:none;\}/,'the name first there too');
 assert.match(phone,/\.rd \.rd-plan-cal \.rd-plan-entry,\.rd \.rd-plan\[data-mode=week\] \.rd-plan-cal \.rd-plan-entry \{height:8px;/);
 // the scroll bar is the house's (refresh.css, "thin and warm, no arrows"): the same numbers
 const house=fs.readFileSync(ext('refresh.css'),'utf8');
 assert.match(house,/::-webkit-scrollbar-thumb \{ border: 2px solid transparent; border-radius: 6px; background: color-mix\(in srgb, var\(--rd-ink\) 26%, transparent\) padding-box; \}/);
 assert.match(block,/\.rd \.rd-plan-day-rows::-webkit-scrollbar,[^{]*\{width:9px;height:9px;\}/);
 assert.match(block,/::-webkit-scrollbar-thumb \{border:2px solid transparent;border-radius:6px;background:color-mix\(in srgb,var\(--rd-ink\) 26%,transparent\) padding-box;\}/);
 assert.match(block,/\.rd \.rd-plan-day-rows,\.rd \.rd-plan-nodate > \.rd-plan-rows,\.rd \.rd-plan-sheet,\.rd \.rd-plan-pop \{scrollbar-width:auto;scrollbar-color:auto;\}/,'the standard properties would switch the drawn bar off');
 // nothing here moves: motion Off, Still and reduced motion keep it all
 assert.doesNotMatch(block.replace(/transition:rotate \.16s;/,''),/animation|transition/);
});
