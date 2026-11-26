'use strict';
// "On Canvas" off in the popup takes every part of Canvas Harness off Canvas (2026-11-22: a course page kept the drawn
// course menu and the add-ons after the switch was turned off). Preferences marked off resolve to nothing; the worker
// loads no add-on into a Canvas page and does no add-on work while off; an open Canvas tab reloads when the switch
// changes, unless something was typed in it. Switched on again, the student's own add-on choice is back.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Unlocked=require('./ai-unlocked.cjs');
const read=name=>fs.readFileSync(path.join(__dirname,'../extension',name),'utf8');
const Features=require('../extension/features.js');
const json=value=>JSON.parse(JSON.stringify(value));

test('preferences marked off select nothing at all, whatever was chosen; unmarked they are as before',()=>{
 for(const prefs of [undefined,'lite',{preset:'full'},{preset:'custom',custom:['dashboard','grades']},Unlocked.prefs()]){
  const on=Features.resolve(prefs),off=Features.resolve(Features.forSwitch(prefs,false));
  assert.ok(on.enabled.length>0&&on.js.length>0);
  assert.deepEqual({enabled:off.enabled,js:off.js,css:off.css,startupJS:off.startupJS,aiUnlocked:off.aiUnlocked,off:off.off},
   {enabled:[],js:[],css:[],startupJS:[],aiUnlocked:false,off:true});
  assert.equal(off.preset,on.preset,'the preset is remembered');
  assert.deepEqual(Features.resolve(Features.forSwitch(Features.forSwitch(prefs,false),true)),on,'on again is the same selection');
  assert.deepEqual(Features.resolve(Features.forSwitch(prefs,true)),on);
 }
 // the AI help record stays with the choice: switched on again, AI help is as it was (the lock itself is unchanged)
 assert.equal(Features.aiUnlocked(Features.forSwitch(Unlocked.prefs(),false)),true);
 assert.ok(Features.resolve(Features.forSwitch(Features.forSwitch(Unlocked.prefs(),false),true)).enabled.includes('ai'));
 assert.equal(Features.ON,'reserve:enabled');assert.equal(Features.OFFHINT,'reserve:off');
});

test('every script the manifest puts on Canvas by itself is either gated by the selection or reads the switch',()=>{
 const manifest=JSON.parse(read('manifest.json')),always=[...new Set(manifest.content_scripts.flatMap(group=>group.js||[]))];
 // (what each of them does while Canvas Harness is off, so a new always-on script has to be thought about here)
 const how={'features.js':'the selection itself','site.js':'no page effect','startup-art.js':'drawings only, handed out through the selection',
  'startup.js':'reads the switch','core.js':'no page effect','api.js':'no page effect','personal-work.js':'no page effect','custom-art.js':'no page effect',
  'workspace-arrange.js':'no page effect','canvas-nav.js':'starts through the selection and reads the switch',
  'page-switch.js':'hidden while switched off (the On Canvas hint), shown only on hand-in pages','course-nav-art.js':'drawings only, handed out through the selection','course-nav.js':'starts through the selection',
  'feature-loader.js':'asks the worker for the selection'};
 assert.deepEqual(always.filter(file=>!how[file]),[],'a script that always runs on Canvas must say how it obeys the switch');
 assert.match(read('startup.js'),/saved\['reserve:enabled'\]===false/);
 assert.match(read('canvas-nav.js'),/values\['reserve:enabled'\]===false/);
 for(const [file,id] of [['canvas-nav.js','canvas-nav'],['course-nav.js','course-nav'],['course-nav-art.js','course-nav'],['startup-art.js','motion']])
  assert.match(read(file),new RegExp("ReserveFeatures\\.early\\('"+id+"',load"),file);
});

// A Canvas page's own selection: the add-on hint and the switch's hint in localStorage, the storage read, the worker's reply.
function page({hint={preset:'full'},offHint=false,saved={'reserve:features':{preset:'full'}}}={}){
 const values=new Map([['reserve:features-hint',JSON.stringify(hint)],...(offHint?[['reserve:off','1']]:[])]),reads=[],heard=new Map();
 let finish;const stored=new Promise(resolve=>{finish=resolve;});
 const env=vm.createContext({TextEncoder,TextDecoder,structuredClone,URL,Event,console,location:new URL('https://school.instructure.com/courses/7/grades'),
  document:{documentElement:{classList:{add(){},remove(){},contains:()=>false},dataset:{}},readyState:'loading',addEventListener:(type,fn)=>heard.set(type,fn),removeEventListener(){},dispatchEvent:()=>true},
  localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},
  chrome:{storage:{local:{get:key=>{reads.push(key);return stored.then(all=>({[key]:all[key]}));}},onChanged:{addListener(){},removeListener(){}}}}});
 env.window=env;env.top=env;
 vm.runInContext(read('features.js'),env,{filename:'features.js'});vm.runInContext(read('site.js'),env,{filename:'site.js'});
 const started=[];
 env.ReserveFeatures.early('course-nav',()=>started.push('start'),()=>started.push('stop'));
 // the loader's announcement: the worker's reply for this document
 const loaded=async reply=>{env.ReserveFeatureLoad=Promise.resolve(reply);heard.get('reserve:features-ready')?.();await new Promise(setImmediate);};
 return {env,values,reads,started,loaded,finish:()=>finish(saved),F:env.ReserveFeatures};
}

test('a page opened while off is plain from its first frame and stays so; the add-on hint is kept for later',async()=>{
 const p=page({offHint:true,saved:{'reserve:features':{preset:'full'},'reserve:enabled':false}});
 assert.deepEqual(p.started,[],'nothing starts on the hint');assert.equal(p.F.current.off,true);
 p.finish();await p.F.earlyReady;await new Promise(setImmediate);
 assert.deepEqual(p.started,[]);assert.deepEqual(p.reads,['reserve:features','reserve:enabled']);
 assert.equal(p.values.get('reserve:off'),'1');assert.deepEqual(JSON.parse(p.values.get('reserve:features-hint')),{preset:'full'},'the hint is not emptied');
 // what loads later in the page (the start-up's own read, the worker's apply) cannot switch it back on by itself
 p.F.apply({preset:'full'});assert.deepEqual(json(p.F.current.enabled),[]);assert.deepEqual(p.started,[]);
 p.F.apply(Features.forSwitch({preset:'lite'},false));assert.deepEqual(json(p.F.current.enabled),[]);
 // switched on: the last choice the page was given comes back, and the hint for the next page goes
 p.F.setSwitch(true);assert.deepEqual(json(p.F.current.enabled),Features.resolve({preset:'lite'}).enabled);assert.equal(p.values.get('reserve:off'),undefined);
 assert.equal(p.F.current.enabled.includes('course-nav'),false,'Lite has no drawn course menu');
});

test('switched off under an open page: the early drawings stop at once and the next page is told; a stale off hint is cleared',async()=>{
 const p=page({saved:{'reserve:features':{preset:'full'},'reserve:enabled':true}});
 assert.deepEqual(p.started,['start'],'the Full hint starts the drawn menu');
 p.finish();await p.F.earlyReady;await new Promise(setImmediate);
 p.F.setSwitch(false);assert.deepEqual(p.started,['start','stop']);assert.equal(p.values.get('reserve:off'),'1');assert.deepEqual(json(p.F.current.enabled),[]);
 p.F.setSwitch(true);assert.deepEqual(p.started,['start','stop','start']);assert.equal(p.values.get('reserve:off'),undefined);
 const stale=page({offHint:true,saved:{'reserve:features':{preset:'full'},'reserve:enabled':true}});
 assert.deepEqual(stale.started,[]);stale.finish();await stale.F.earlyReady;await new Promise(setImmediate);
 assert.deepEqual(stale.started,['start'],'the saved switch wins over the hint');assert.equal(stale.values.get('reserve:off'),undefined);
});

test('the worker\'s reply for a switched-off page keeps it off and keeps the student\'s choice for later',async()=>{
 // the switch went off between the page's own read and the worker's: the worker's reply is the newer word
 const p=page({saved:{'reserve:features':{preset:'full'},'reserve:enabled':true}});p.finish();await p.F.earlyReady;await new Promise(setImmediate);
 assert.deepEqual(p.started,['start']);
 await p.loaded({ok:true,preset:'full',enabled:[],off:true});
 assert.deepEqual(json(p.F.current.enabled),[]);assert.deepEqual(p.started,['start','stop']);assert.equal(p.values.get('reserve:off'),'1');
 assert.deepEqual(JSON.parse(p.values.get('reserve:features-hint')).preset,'full');
 p.F.setSwitch(true);assert.deepEqual(json(p.F.current.enabled),Features.resolve({preset:'full'}).enabled,'its empty list is not taken for the student\'s choice');
 // and the other way: a page that started off and is loaded on by the worker is on
 const q=page({offHint:true,saved:{'reserve:features':{preset:'full'},'reserve:enabled':false}});q.finish();await q.F.earlyReady;await new Promise(setImmediate);
 await q.loaded({ok:true,preset:'lite',enabled:Features.resolve({preset:'lite'}).enabled});
 assert.deepEqual(json(q.F.current.enabled),Features.resolve({preset:'lite'}).enabled);assert.equal(q.values.get('reserve:off'),undefined);
});

function loader({typed=false,off=false,focus=null}={}){
 const listeners=[],docListeners=new Map(),local=new Map(),calls={reload:0,setSwitch:[]};
 const sandbox={console,URL,Event,setTimeout:()=>0,clearTimeout(){},
  location:{href:'https://school.instructure.com/courses/7/grades',reload(){calls.reload++;}},
  localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,String(value)),removeItem:key=>local.delete(key)},
  document:{activeElement:focus,addEventListener:(type,fn)=>docListeners.set(type,fn),removeEventListener(){},dispatchEvent(){}},
  chrome:{runtime:{sendMessage:async()=>({ok:true,preset:'full',enabled:off?[]:['dashboard'],...(off?{off:true}:{})})},storage:{onChanged:{addListener:fn=>listeners.push(fn)}}},
  ReserveSite:{supported:()=>true},
  ReserveFeatures:{earlyReady:Promise.resolve(),apply(){},resolve:()=>({preset:'full',enabled:['dashboard']}),setSwitch:on=>calls.setSwitch.push(on)}};
 sandbox.window=sandbox;sandbox.top=sandbox;sandbox.globalThis=sandbox;
 const context=vm.createContext(sandbox);vm.runInContext(read('feature-loader.js'),context,{filename:'feature-loader.js'});
 if(typed)docListeners.get('input')({target:{tagName:'TEXTAREA'}});
 return {calls,local,context,
  change:(newValue,oldValue)=>listeners.forEach(fn=>fn({'reserve:enabled':{newValue,...(oldValue===undefined?{}:{oldValue})}},'local')),
  other:changes=>listeners.forEach(fn=>fn(changes,'local')),sync:changes=>listeners.forEach(fn=>fn(changes,'sync'))};
}

test('an open Canvas tab reloads when the switch really changes, tells the selection first, and never for anything else',()=>{
 let p=loader();p.change(false,true);assert.deepEqual(json(p.calls),{reload:1,setSwitch:[false]});
 p=loader();p.change(false);assert.equal(p.calls.reload,1,'never saved before counts as on');
 p=loader();p.change(true,false);assert.deepEqual(json(p.calls),{reload:1,setSwitch:[true]});
 p=loader();p.change(true,true);p.change(true);p.change(false,false);assert.deepEqual(json(p.calls),{reload:0,setSwitch:[]},'the same state again changes nothing');
 p=loader();p.other({'reserve:appearance':{newValue:{theme:'dark'}}});p.sync({'reserve:enabled':{newValue:false,oldValue:true}});assert.equal(p.calls.reload,0);
});

test('a tab where something was typed, or whose focus is in an editor frame, is not reloaded: the selection is told, the page holds from its next load',()=>{
 let p=loader({typed:true});p.change(false,true);
 assert.deepEqual(json(p.calls),{reload:0,setSwitch:[false]});
 p=loader({focus:{tagName:'IFRAME'}});p.change(false,true);
 assert.deepEqual(json(p.calls),{reload:0,setSwitch:[false]},'Canvas\'s text editor lives in a frame whose typing this page does not hear');
 p=loader({focus:{tagName:'A'}});p.change(false,true);assert.equal(p.calls.reload,1);
});

test('while off, the loader does not write an empty add-on hint over the student\'s own',async()=>{
 const p=loader({off:true});p.local.set('reserve:features-hint','{"preset":"lite","enabled":["dashboard"]}');
 await p.context.ReserveFeatureLoad;
 assert.equal(p.local.get('reserve:features-hint'),'{"preset":"lite","enabled":["dashboard"]}');
});

// The worker: what it loads into a Canvas page and which add-on work it does.
function worker(saved){
 const data=new Map(Object.entries(saved)),executions=[],listeners=[];
 const event=()=>({addListener(){}}),runtime={id:'test-extension',getURL:file=>'chrome-extension://test-extension/'+file,onMessage:{addListener:fn=>listeners.push(fn)},onConnect:event()};
 const env=vm.createContext({TextEncoder,TextDecoder,structuredClone,URL,console,setTimeout,clearTimeout,
  chrome:{runtime,storage:{local:{get:async key=>Object.fromEntries((Array.isArray(key)?key:[key]).filter(k=>data.has(k)).map(k=>[k,structuredClone(data.get(k))]))}},
   scripting:{executeScript:async options=>{executions.push(options);},insertCSS:async()=>{}}}});
 env.importScripts=(...files)=>{for(const file of files)vm.runInContext(read(file),env,{filename:file});};
 vm.runInContext(read('background.js'),env,{filename:'background.js'});
 const sender={id:runtime.id,tab:{id:12},frameId:0,documentId:'document-one',url:'https://school.instructure.com/courses/7/grades'};
 const request=(message={target:'ch-features',op:'load'},who=sender)=>new Promise(resolve=>{for(const listener of listeners)listener(message,who,resolve);});
 return {data,executions,sender,request,files:()=>executions.flatMap(call=>call.files||[])};
}

test('the worker loads no add-on into a Canvas page while On Canvas is off and does no add-on work; on again it loads the same choice',async()=>{
 const w=worker({'reserve:features':{preset:'full'},'reserve:enabled':false});
 assert.deepEqual(json(await w.request()),{ok:true,preset:'full',enabled:[],off:true});
 assert.deepEqual(w.files(),[],'no add-on file, not even the core ones');
 assert.equal(w.executions.find(call=>call.args)?.args[0].off,true,'the page is told it is off');
 const play=await w.request({target:'ch-play',op:'load'});assert.equal(play.ok,false);assert.match(play.error,/off on Canvas/);
 w.data.set('reserve:enabled',true);
 const reloaded={...w.sender,documentId:'document-two'},again=await w.request(undefined,reloaded);
 assert.equal(again.off,undefined);assert.deepEqual(json(again.enabled),Features.resolve({preset:'full'}).enabled,'the same add-ons as before');
 assert.deepEqual(w.files(),Features.resolve({preset:'full'}).js.filter(file=>!Features.staticJS.includes(file)));
 assert.equal((await w.request({target:'ch-play',op:'load'},reloaded)).ok,true);
 // switched off under that open page (something was typed, so it did not reload): its add-on work is refused all the same
 w.data.set('reserve:enabled',false);
 const late=await w.request({target:'ch-play',op:'load'},reloaded);assert.equal(late.ok,false);assert.match(late.error,/off on Canvas/);
});

test('with AI help agreed to, no AI request is taken from a Canvas page while On Canvas is off',async()=>{
 const w=worker({...Unlocked.storage(),'reserve:enabled':false}),scopeKey='https://school.instructure.com|7';
 for(const op of ['connections','begin']){
  const reply=await w.request({target:'ch-agent',op,scopeKey,runId:'run-1'});assert.equal(reply.ok,false,op);assert.match(reply.error,/off on Canvas/,op);
 }
 w.data.set('reserve:enabled',true);
 const on=await w.request({target:'ch-agent',op:'connections',scopeKey});assert.doesNotMatch(String(on.error||''),/off on Canvas/,'on again the request reaches its own checks');
});
