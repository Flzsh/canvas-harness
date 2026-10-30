'use strict';
// The minute tick redraws Home and the course pages only when the clock changes what they show.
// No TZ pin here: the repo runner loads every test file in one process with America/New_York, and a top-level
// pin would change the zone for the whole suite. The fixtures hold under any zone whose hours turn with UTC's.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./dashboard-heading-fixture.cjs');
const MIN=60000,DAY=86400000,EPOCH=Date.UTC(2026,9,17,10);
// The fixture's clock starts 100 ms after EPOCH (Sat 17 Oct 2026, 10:00 UTC); the minute timer fires at :00.100.
const at=minutes=>new Date(EPOCH+minutes*MIN).toISOString();

function home({assignments=[],timeZone='UTC',workspace='work',courseId='all'}={}){
 let renders=0;
 const f=fixture({courseId,assignments,initialState:{workspace},setup({env,store}){
  store.get().settings.timeZone=timeZone;
  const View=env.ReserveDashboardView,original=View.render;View.render=(...args)=>{renders++;return original.apply(View,args);};
 }});
 f.tick(0);
 // Minutes (from 10:00) at which the minute timer redrew the page, over the next `count` minutes.
 const minutes=count=>{const drawn=[];for(let i=0;i<count;i++){const before=renders;f.tick(MIN);if(renders>before)drawn.push(Math.round((f.env.Date.now()-EPOCH)/MIN));}return drawn;};
 return {f,minutes,get renders(){return renders;},text:selector=>f.container.querySelector(selector)?.textContent||'',has:selector=>!!f.container.querySelector(selector)};
}

test('an idle Home redraws once in ten minutes instead of every minute',t=>{
 const h=home();t.after(()=>h.f.dashboard.destroy());
 assert.ok(h.renders>0,'the page drew');
 assert.deepEqual(h.minutes(9),[],'nothing changes with the clock for nine minutes');
 assert.deepEqual(h.minutes(1),[10],'the ten-minute safety render');
 assert.deepEqual(h.minutes(20),[20,30]);
});

test('the status line updates on the minute while the page is left alone',t=>{
 const h=home();t.after(()=>h.f.dashboard.destroy());
 h.f.dashboard.updateSnapshot({...h.f.snapshot,fetchedAt:at(0)});h.f.tick(0);
 const drawn=h.renders;h.minutes(3);
 assert.equal(h.renders,drawn,'no render');
 assert.equal(h.text('.rd-status [role="status"]'),'Updated 3 min ago');
});

test('a due time passing redraws on the next minute and the work turns Overdue',t=>{
 const h=home({assignments:[{id:'1',name:'Lab report',course_id:'10',due_at:at(5.5)}]});t.after(()=>h.f.dashboard.destroy());
 assert.equal(h.has('[data-rd-action="glance"][data-mode="overdue"]'),false);
 assert.deepEqual(h.minutes(5),[],'not yet due');
 assert.deepEqual(h.minutes(1),[6],'the first tick after 10:05:30');
 assert.equal(h.has('[data-rd-action="glance"][data-mode="overdue"]'),true,'drawn overdue');
});

test('24 hours before a due time redraws (Due within 24 hours, soon)',t=>{
 const h=home({assignments:[{id:'1',name:'Essay',course_id:'10',due_at:at(24*60+3.5)}]});t.after(()=>h.f.dashboard.destroy());
 assert.deepEqual(h.minutes(5),[4]);
});

test('work 14 days past due leaves the list on the next minute',t=>{
 const h=home({assignments:[{id:'1',name:'Old quiz',course_id:'10',due_at:at(-14*24*60+2.5)}]});t.after(()=>h.f.dashboard.destroy());
 assert.equal(h.has('[data-rd-action="glance"][data-mode="overdue"]'),true,'still in the list: overdue');
 assert.deepEqual(h.minutes(4),[3]);
 assert.equal(h.has('[data-rd-action="glance"][data-mode="overdue"]'),false,'gone after 14 days');
});

test('the greeting changes on the hour, not ten minutes later',t=>{
 const h=home();t.after(()=>h.f.dashboard.destroy());
 h.minutes(113);// 11:53
 // Any render (new Canvas data here) restarts the ten-minute count at 11:53.
 h.f.dashboard.updateSnapshot({...h.f.snapshot});h.f.tick(0);
 assert.match(h.text('.rd-workspace-heading h1'),/Good morning/);
 assert.deepEqual(h.minutes(10),[120],'12:00, not 12:03');
 assert.match(h.text('.rd-workspace-heading h1'),/Good afternoon/);
});

test('midnight in the account time zone redraws Tomorrow as Today, in a zone a quarter hour off UTC',t=>{
 // Chatham Islands (UTC+13:45 in October): 10:00 UTC is 23:45; local midnight falls at 10:15 UTC.
 const zone='Pacific/Chatham',local=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(EPOCH);
 assert.equal(local,'23:45','ICU knows the zone');
 const h=home({timeZone:zone,assignments:[{id:'1',name:'Reading',course_id:'10',due_at:at(40)}]});t.after(()=>h.f.dashboard.destroy());
 assert.equal(h.has('[data-rd-action="glance"][data-mode="tomorrow"]'),true);
 assert.deepEqual(h.minutes(15),[10,15],'the safety render, then local midnight');
 assert.equal(h.has('[data-rd-action="glance"][data-mode="today"]'),true,'due today after midnight');
 assert.equal(h.has('[data-rd-action="glance"][data-mode="tomorrow"]'),false);
});

test('a course page uses the same rule; other workspaces still redraw every minute',t=>{
 const course=home({courseId:'10'});t.after(()=>course.f.dashboard.destroy());
 assert.deepEqual(course.minutes(10),[10]);
 const plan=home({workspace:'plan'});t.after(()=>plan.f.dashboard.destroy());
 assert.deepEqual(plan.minutes(3),[1,2,3],'the Planner keeps its minute render');
});

test('a long sleep redraws on the first minute tick after it',t=>{
 const h=home();t.after(()=>h.f.dashboard.destroy());
 h.minutes(2);const before=h.renders;
 h.f.tick(3*3600000);assert.equal(h.renders,before+1,'woke three hours later');
});

test('the same snapshot again (a tab return) keeps the caches and redraws only when the clock asks',t=>{
 const h=home();t.after(()=>h.f.dashboard.destroy());
 let normalized=0;const core=h.f.env.ReserveCore,original=core.normalizeAssignment;core.normalizeAssignment=(...args)=>{normalized++;return original.apply(core,args);};
 const snapshot={...h.f.snapshot,assignments:[{id:'1',name:'Lab',course_id:'10',due_at:at(300)}]};
 h.f.dashboard.updateSnapshot(snapshot);h.f.tick(0);
 const renders=h.renders,count=normalized;assert.ok(count>0,'new data is normalized and drawn');
 h.minutes(2);
 // content.js hands back the object it already gave: nothing is drawn or normalized again.
 h.f.dashboard.updateSnapshot(snapshot);h.f.tick(0);
 assert.equal(h.renders,renders,'no render');assert.equal(normalized,count,'caches kept');
 // Back after three hours behind another tab: one render for the clock, still from the kept caches.
 h.f.document.visibilityState='hidden';h.f.tick(3*3600000);assert.equal(h.renders,renders,'a hidden page does not render');
 h.f.document.visibilityState='visible';h.f.dashboard.updateSnapshot(snapshot);h.f.tick(0);
 assert.equal(h.renders,renders+1,'the clock moved: one render');assert.equal(normalized,count,'caches kept');
 // A new snapshot object still replaces the data.
 h.f.dashboard.updateSnapshot({...snapshot});h.f.tick(0);assert.equal(h.renders,renders+2);assert.ok(normalized>count);
});

// widgets.js: the countdown keeps its own 15 s tick, so Home needs no minute render for it.
class Node{
 constructor(tag='div',dataset={}){this.tagName=tag.toUpperCase();this.dataset={...dataset};this.children=[];this.attributes={};this.style={};this.textContent='';this.hidden=false;}
 addEventListener(){}removeEventListener(){}getRootNode(){return {};}remove(){}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
 matches(selector){return selector.split(',').some(s=>{const m=s.trim().match(/^\[data-([\w-]+)\]$/);return !!m&&Object.hasOwn(this.dataset,m[1].replace(/-([a-z])/g,(_s,c)=>c.toUpperCase()));});}
 closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
test('a countdown without the time line still ticks every 15 seconds',async()=>{
 const Core=require('../extension/core.js'),Storage=require('../extension/storage.js'),read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8');
 let now=EPOCH,next=0;const intervals=new Map(),memory=new Map();
 const store=Storage.createStore({accountId:'freshness-tests',adapter:{read:async k=>memory.get(k),write:async(k,v)=>memory.set(k,structuredClone(v))}});await store.load();
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}},createElement:tag=>new Node(tag)},container=new Node();container.ownerDocument=doc;
 const countdown=new Node('b',{rdCountdown:'',due:String(EPOCH+90*MIN)});countdown.textContent='1 h 30 min';container.append(countdown);
 const env=vm.createContext({console,Date:Clock,Map,Set,Promise,Intl,ReserveCore:Core,ReserveFeatures:{enabled:()=>true},ReservePetArt:{},ReservePets:{clean:x=>x,create:()=>({sync(){},setFocus(){},destroy(){}})},
  setInterval:(fn,ms)=>{intervals.set(++next,{fn,ms});return next;},clearInterval:id=>intervals.delete(id),setTimeout:()=>1,clearTimeout(){}});
 for(const file of ['workspace-arrange.js','agent-clock.js','pony-ask.js','widgets.js'])vm.runInContext(read(file),env);
 const helpers={E:String,dayKey:Core.dayKey,complete:Core.isComplete,formatDate:(v,z,o)=>new Intl.DateTimeFormat('en-US',{timeZone:z,...o}).format(new Date(v))};
 const controller=env.ReserveWidgets.create({container,store,save:async fn=>{await store.update(fn);return true;},rerender(){},getContext:()=>({s:store.get().settings,personal:store.get(),items:[],courses:[],local:{},studyAids:{},now,theme:'light',courseMap:new Map()}),helpers:()=>helpers});
 try{
  assert.equal(container.querySelector('[data-rd-clock]'),null,'no time line on the page');
  controller.sync();
  const tick=[...intervals.values()].find(t=>t.ms===15000);assert.ok(tick,'the 15 s tick runs for the countdown');
  now+=31*MIN;tick.fn();assert.equal(countdown.textContent,'59 min');
  container.children.length=0;controller.sync();assert.equal([...intervals.values()].some(t=>t.ms===15000),false,'and stops when it leaves');
 }finally{controller.destroy();store.destroy();}
});
