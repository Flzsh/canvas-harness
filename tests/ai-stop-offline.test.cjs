'use strict';
// Stop works when Canvas does not answer (offline, signed out of Canvas, asleep): it only ends this account's runs, so
// it needs no Canvas profile check (stability check 2026-11-14; owner: "I can not stop it from working").
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const F=require('../extension/features.js');
const ext=path.join(__dirname,'../extension'),source=file=>fs.readFileSync(path.join(ext,file),'utf8');
const tick=async(n=20)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
function event(){const listeners=[];return {addListener:f=>listeners.push(f),removeListener:()=>{},emit:(...a)=>listeners.map(f=>f(...a))};}
// AI on: the agreed record where the build has the AI lock, else the switch itself.
let prefs;try{prefs=require('./ai-unlocked.cjs').prefs();}catch{prefs={preset:'custom',custom:['dashboard','planner','tools','ai']};}

test('Stop ends the runs even while Canvas cannot be reached, and asks Canvas nothing',async()=>{
 const store={[F.KEY]:prefs},calls=[],onMessage=event(),origin='https://canvas.test',scope=origin+'|7';
 const chrome={runtime:{id:'x',onMessage,getURL:f=>'chrome-extension://x/'+f},alarms:{onAlarm:event(),clear:async()=>{},create:async()=>{}},
  storage:{onChanged:event(),local:{get:async k=>{const keys=Array.isArray(k)?k:[k];return Object.fromEntries(keys.map(key=>[key,structuredClone(store[key])]));},set:async o=>{Object.assign(store,o);}}},
  tabs:{get:async()=>null},permissions:{contains:async()=>false}};
 const env=vm.createContext({URL,URLSearchParams,console,structuredClone,chrome,indexedDB:{}});env.globalThis=env;
 vm.runInContext(source('features.js'),env,{filename:'features.js'});
 const runs=[{id:'run-a',scope,state:'awaiting-reply',flow:'one-shot',createdAt:1,turns:[],lease:{epoch:1}}];
 env.CanvasHarnessRunStore={create:()=>({all:async()=>runs,get:async id=>runs.find(r=>r.id===id)}),terminal:r=>['cards-ready','cancelled','failed'].includes(r.state)};
 env.CanvasHarnessAIEngine={create:()=>({recover:async()=>{},start:async()=>({}),cancel:async(id,o)=>{calls.push(['cancel',id,JSON.parse(JSON.stringify(o||{}))]);return {id,state:'cancelled'};}}),settingsKey:()=>''};
 env.CanvasHarnessAICanvas={createFetch:()=>async()=>{calls.push(['canvas']);throw Error('Failed to fetch');}};
 env.ReserveAccountWrites={run:(k,fn)=>fn()};
 vm.runInContext(source('ai-prepare.js'),env,{filename:'ai-prepare.js'});
 env.CanvasHarnessPrepare.serve({api:null,pdf:null,requireFeature:async()=>{},verifyAccount:async()=>{},canvasSender:()=>true});
 await tick();
 const reply=await new Promise(resolve=>{onMessage.emit({target:'ch-ai-engine',op:'cancel',scopeKey:scope,runId:'run-a'},{id:'x',frameId:0,tab:{id:1},url:origin+'/'},resolve);});
 assert.equal(reply.ok,true,String(reply.error));
 assert.deepEqual(calls,[['cancel','run-a',{pause:true,close:true}]],'no Canvas request, one Stop with its tab closing and pause');
});
