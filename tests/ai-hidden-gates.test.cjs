'use strict';
// AI help hidden (the default every store student gets): the worker routes the existing lock tests do not reach.
// Stability check 2026-11-14: every operation of the AI engine, and the Send authorization a chat page asks for,
// answer "off" while AI help is locked, and none of them reaches the engine.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const F=require('../extension/features.js'),Unlocked=require('./ai-unlocked.cjs');
const ext=path.join(__dirname,'../extension'),source=file=>fs.readFileSync(path.join(ext,file),'utf8');
const tick=async(n=20)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
function event(){const listeners=[];return {addListener:f=>listeners.push(f),removeListener:()=>{},emit:(...a)=>listeners.map(f=>f(...a))};}
function worker(prefs){
 const store={[F.KEY]:prefs},calls=[],onMessage=event();
 const chrome={runtime:{id:'x',onMessage,getURL:f=>'chrome-extension://x/'+f},alarms:{onAlarm:event(),clear:async()=>{},create:async()=>{calls.push('alarm');}},
  storage:{onChanged:event(),local:{get:async k=>({[k]:structuredClone(store[k])}),set:async o=>{Object.assign(store,o);}}},
  tabs:{get:async()=>null,create:async o=>{calls.push('tab:'+o.url);return {id:9};},reload:async()=>{calls.push('reload');}},permissions:{contains:async()=>false}};
 const env=vm.createContext({URL,URLSearchParams,console,structuredClone,chrome,indexedDB:{}});env.globalThis=env;
 vm.runInContext(source('features.js'),env,{filename:'features.js'});
 const runs=[{id:'run-a',scope:'https://school.instructure.com|7',state:'awaiting-reply',turnIndex:0,turns:[{id:'turn-1',deliveryReceipt:{tabId:5,status:'send-intent',origin:'https://chatgpt.com'}}],lease:{epoch:1}}];
 env.CanvasHarnessRunStore={create:()=>({all:async()=>runs,get:async id=>runs.find(r=>r.id===id)}),terminal:r=>['cards-ready','cancelled','failed'].includes(r.state)};
 const engine={};for(const op of ['recover','cancel','start','importReply','retry','execute','verifyEpoch'])engine[op]=async()=>{calls.push(op);return {};};
 env.CanvasHarnessAIEngine={create:()=>engine,settingsKey:()=>''};env.ReserveAccountWrites={run:(k,fn)=>fn()};
 vm.runInContext(source('ai-prepare.js'),env,{filename:'ai-prepare.js'});
 env.CanvasHarnessPrepare.serve({api:null,pdf:null,requireFeature:async()=>{},verifyAccount:async()=>{},canvasSender:()=>true});
 const ask=(message,sender)=>new Promise(resolve=>{onMessage.emit(message,sender,resolve);});
 return {calls,ask};
}
const canvas={id:'x',frameId:0,tab:{id:1,index:0},url:'https://school.instructure.com/'};

test('locked: every AI engine operation is refused before it reaches the engine, and only Stop does anything',async()=>{
 const w=worker({preset:'full'});await tick();w.calls.length=0;
 for(const op of ['start','ask','check','get','subscribe','review','retry','importReply','resume','open','ai-access','docs-access']){
  const reply=await w.ask({target:'ch-ai-engine',op,scopeKey:'https://school.instructure.com|7',requestId:'abcdef1',runId:'run-a',provider:'chatgpt'},canvas);
  assert.equal(reply.ok,false,op);assert.match(reply.error,/AI help is off/,op);
 }
 assert.deepEqual(w.calls,[],'no engine call, no tab opened, no alarm set');
 const stop=await w.ask({target:'ch-ai-engine',op:'cancel',scopeKey:'https://school.instructure.com|7'},canvas);
 assert.equal(stop.ok,false);assert.ok(w.calls.every(c=>c==='cancel'),'Stop only cancels what is left');
});

test('locked: a chat page asking to click Send gets no authorization',async()=>{
 const w=worker({preset:'full'});await tick();
 const reply=await w.ask({target:'ch-ai-engine-permit',runId:'run-a',turnId:'turn-1',epoch:1},{id:'x',frameId:0,tab:{id:5},url:'https://chatgpt.com/c/abc'});
 assert.deepEqual(JSON.parse(JSON.stringify(reply)),{ok:false});assert.ok(!w.calls.includes('verifyEpoch'));
 const open=worker(Unlocked.prefs());await tick();
 const allowed=await open.ask({target:'ch-ai-engine-permit',runId:'run-a',turnId:'turn-1',epoch:1},{id:'x',frameId:0,tab:{id:5},url:'https://chatgpt.com/c/abc'});
 assert.deepEqual(JSON.parse(JSON.stringify(allowed)),{ok:true},'the same request goes through once AI help is on');
});
