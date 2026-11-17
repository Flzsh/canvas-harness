'use strict';
// Edge's script order. Edge runs the script groups it loads together in the order of their internal ids compared as text
// (seen in the sign-in harness: a test copy with three manifest groups ran the third first), and a registration it kept
// across a restart sorts before the manifest's: the registered add-ons (content.js ... feature-ready.js) can run before
// both page-start groups, and the second page-start group before the first. 4.0.164's order heal looked for site.js and
// so never ran in that order, feature-loader.js failed without features.js, and some add-ons kept the page-start models
// they found missing while loading.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ext=path.join(__dirname,'../extension'),read=name=>fs.readFileSync(path.join(ext,name),'utf8');

const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};

// (The development build's registered add-ons and their feature-ready.js are not in this build: it loads every add-on through the
// worker, so the two tests of that path are left out here.)
test('the work and dashboard models give the same answers whether core.js ran before or after them',()=>{
 const load=files=>{const ctx=vm.createContext({console,Intl,Date,Math,JSON});vm.runInContext('globalThis.window=globalThis',ctx);for(const f of files)vm.runInContext(read(f),ctx,{filename:f});return ctx;};
 const right=load(['site.js','core.js','dashboard-model.js','work-model.js']),wrong=load(['dashboard-model.js','work-model.js','site.js','core.js']);
 const now=Date.parse('2026-11-14T15:00:00Z'),day=n=>new Date(now+n*864e5).toISOString();
 const items=[{id:'local-1',personal:true,state:'done',courseId:'personal',name:'Read chapter',dueAt:day(1)},{id:'local-2',personal:true,state:'open',courseId:'personal',name:'Plan',dueAt:day(2)},
  {id:'11',courseId:'5',name:'Lab',state:'submitted',dueAt:day(1)},{id:'12',courseId:'5',name:'Set',state:'missing',missing:true,dueAt:day(-1)},{id:'13',courseId:'5',name:'Essay',state:'open',dueAt:day(3)}];
 const run=ctx=>JSON.stringify([ctx.ReserveDashboardModel.filterAssignments(items,{now,timeZone:'America/New_York',mode:'actionable',local:{}}),ctx.ReserveWorkModel.insights(items,{'local-2':{plannedDate:'2026-11-14'}},{now,timeZone:'America/New_York'})]);
 assert.equal(run(wrong),run(right),'a done personal task stays done, and days follow the school time zone, in either order');
});

test('the "To hand in" list works when Edge ran hand-in.js before core.js',()=>{
 const ctx=vm.createContext({console,Intl,Date,Math,JSON});vm.runInContext('globalThis.window=globalThis',ctx);
 for(const f of ['hand-in.js','site.js','core.js'])vm.runInContext(read(f),ctx,{filename:f});
 const now=Date.parse('2026-11-14T15:00:00Z');
 const c={now,s:{timeZone:'America/New_York'},state:{courseId:'all'},local:{},items:[{id:'21',courseId:'5',name:'Upload',state:'missing',missing:true,submissionTypes:['online_upload'],dueAt:new Date(now-864e5).toISOString()}]};
 const out=ctx.ReserveHandIn.lists(c,{dayOf:v=>ctx.ReserveCore.dayKey(v,'America/New_York'),complete:ctx.ReserveCore.isComplete});
 assert.deepEqual(JSON.parse(JSON.stringify(out.missing.map(x=>x.id))),['21']);
});

// feature-loader.js: when Edge did not run the registered add-ons in this document, the worker loads them. A worker that
// was stopped or restarted during the ask drops it; it is asked again (1, then 3 s later). A refusal is final.
function loaderPage(answers){
 let asks=0,now=0;const timers=new Map();let next=0;
 const ctx={location:{href:'https://school.instructure.com/',reload(){}},ReserveSite:{supported:()=>true},console:{warn(){}},Event:class{},
  ReserveFeatures:{REGISTERED:'reserve:features:registered',read:async()=>({}),earlyReady:Promise.resolve(),apply(){},forDev30:p=>p,resolve:()=>({preset:'full',enabled:[]})},
  ReserveStartup:{waitForFeatures(){},setFeatures(){},release(){}},
  chrome:{runtime:{sendMessage:async()=>{const a=answers[asks++];if(a instanceof Error)throw a;return a;}},storage:{onChanged:{addListener(){}}}},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  document:{visibilityState:'visible',dispatchEvent(){},addEventListener(){},removeEventListener(){}},
  setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{at:now+ms,fn});return id;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(ctx);vm.runInContext('globalThis.window=globalThis;globalThis.top=globalThis;',ctx);vm.runInContext(read('feature-loader.js'),ctx,{filename:'feature-loader.js'});
 return {ctx,get asks(){return asks;},async run(ms){const end=now+ms;for(;;){for(let i=0;i<6;i++)await new Promise(setImmediate);const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due){now=end;return;}now=due[1].at;timers.delete(due[0]);due[1].fn();}}};
}
test('a features ask the worker dropped (stopped or restarted) is asked again; a refusal is not',async()=>{
 const dropped=loaderPage([Error('Could not establish connection. Receiving end does not exist.'),{ok:true,preset:'full',enabled:[]}]);await dropped.run(1500);
 assert.equal((await dropped.ctx.ReserveFeatureLoad).ok,true);assert.equal(dropped.asks,2);
 const empty=loaderPage([undefined,undefined,{ok:true,preset:'full',enabled:[]}]);await empty.run(5000);assert.equal((await empty.ctx.ReserveFeatureLoad).ok,true);assert.equal(empty.asks,3);
 const refused=loaderPage([{ok:false,error:'refused'},{ok:true}]);await refused.run(5000);assert.equal((await refused.ctx.ReserveFeatureLoad).ok,false);assert.equal(refused.asks,1);
 const gone=loaderPage([Error('a'),Error('b'),Error('c'),{ok:true}]);await gone.run(5000);assert.equal((await gone.ctx.ReserveFeatureLoad).ok,false);assert.equal(gone.asks,3,'three asks, then Canvas');
});

// Edge runs an extension's content-script groups in the order of their internal ids compared as text ("_mc_10" before
// "_mc_9"), not as the manifest lists them: in the sign-in harness a test copy with three groups ran the third first.
// So Canvas Harness's second page-start group (core.js ... feature-loader.js) can run before its first (features.js ... startup.js).
test('feature-loader.js run before features.js waits for it, and the add-ons still load',async()=>{
 const p=loaderPage([{ok:true,preset:'full',enabled:[]}]),F=p.ctx.ReserveFeatures;delete p.ctx.ReserveFeatures;
 // (loaderPage ran feature-loader.js with features.js already there; run it again the other way round)
 const timers=new Map();let next=0,now=0;
 const ctx={location:{href:'https://school.instructure.com/',reload(){}},ReserveSite:{supported:()=>true},console:{warn(){}},Event:class{},
  chrome:{runtime:{sendMessage:async()=>({ok:true,preset:'full',enabled:[]})},storage:{onChanged:{addListener(){}}}},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  document:{visibilityState:'visible',dispatchEvent(){},addEventListener(){},removeEventListener(){}},
  setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{at:now+ms,fn});return id;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(ctx);vm.runInContext('globalThis.window=globalThis;globalThis.top=globalThis;',ctx);
 vm.runInContext(read('feature-loader.js'),ctx,{filename:'feature-loader.js'});
 assert.equal(typeof ctx.ReserveFeatureLoad?.then,'function','the load promise exists at once, so the order heal does not misfire');
 ctx.ReserveFeatures=F;// features.js runs next, in the first group
 for(let i=0;i<10;i++){await new Promise(setImmediate);const due=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(due&&due[1].at<=now+30){now=due[1].at;timers.delete(due[0]);due[1].fn();}}
 assert.equal((await ctx.ReserveFeatureLoad).ok,true);
});

test('a course-menu drawing set before features.js ran is kept',async()=>{
 const ctx=vm.createContext({URL,console,location:new URL('https://school.instructure.com/courses/7'),document:{documentElement:{dataset:{},classList:{add(){},remove(){}}},addEventListener(){},removeEventListener(){}},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},chrome:{storage:{local:{get:async()=>({})},onChanged:{addListener(){}}}}});
 ctx.window=ctx;ctx.top=ctx;ctx.globalThis=ctx;
 vm.runInContext(read('site.js'),ctx,{filename:'site.js'});
 ctx.ReserveCourseNavArt={icons:{assignments:'<svg/>'}};// course-nav-art.js ran first (second group before the first)
 vm.runInContext(read('features.js'),ctx,{filename:'features.js'});
 for(let i=0;i<6;i++)await new Promise(setImmediate);
 assert.equal(ctx.ReserveCourseNavArt?.icons?.assignments,'<svg/>','the drawing is still there once the selection is read');
});
