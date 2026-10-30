'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../extension/storage.js'),B=require('../extension/pony-brain.js'),A=require('../extension/pony-ask.js');
const memory=()=>{const data=new Map();return {data,read:async key=>structuredClone(data.get(key)),write:async(key,value)=>data.set(key,structuredClone(value))};};
const backup=data=>({format:'reserve-backup',version:1,data});

test('Biscuit schedules skills and learning stay in their own account and site through recovery and backup',async t=>{
 const adapter=memory(),owner={accountId:'71',origin:'https://school.instructure.com'},store=S.createStore({...owner,adapter}),now=Date.now();t.after(()=>store.destroy());await store.load();
 await store.update(data=>{
  data.tasks['7']={notes:'Keep the original note',plannedDate:'2030-01-02',plannedTime:'19:30',estimate:35};data.toolbox.scratchpad='Keep the public scratchpad';
  data.pet.skills={...B.cleanSkills(),wellbeing:false};data.pet.brain={...B.cleanLearning(),quietUntil:now+60000,hiddenUntil:now+120000};
  data.pet.reminders=[{id:'pony-1',text:'Pack bag',at:now+300000,createdAt:now}];data.pet.routines=[{id:'pony-2',name:'every sunday evening plan my week',days:[0],minute:1140,action:'plan',data:{mode:'week'},createdAt:now,last:''}];
 });
 const restored=S.validateBackup(store.exportBackup(),owner);assert.equal(restored.tasks['7'].plannedTime,'19:30');assert.equal(restored.tasks['7'].notes,'Keep the original note');assert.equal(restored.toolbox.scratchpad,'Keep the public scratchpad');assert.equal(restored.pet.skills.wellbeing,false);assert.equal(restored.pet.brain.quietUntil,now+60000);assert.equal(restored.pet.reminders[0].text,'Pack bag');assert.equal(restored.pet.routines[0].data.mode,'week');
 await store.saveRecovery();const recovery=await store.readRecovery();assert.deepEqual(recovery.pet,restored.pet);
 for(const identity of [{...owner,accountId:'72'},{...owner,origin:'https://other.instructure.com'}]){const other=S.createStore({...identity,adapter});t.after(()=>other.destroy());const data=await other.load();assert.deepEqual(data.pet.reminders,[]);assert.deepEqual(data.pet.routines,[]);assert.equal(data.tasks['7'],undefined);assert.throws(()=>S.validateBackup(store.exportBackup(),identity),/different Canvas account or site/);}
});

// 4.0: 4.0 keeps the study skills; agent metadata stays out (storage).

test('Biscuit cleaners bound collections and counters and reject impossible planned time and cycle metadata',()=>{
 const now=Date.now(),reminders=Array.from({length:30},(_,i)=>({id:'r'+i,text:'  Bring\n bag  ',at:now+60000,createdAt:now})),data=S.validateBackup(backup({pet:{brain:{kinds:{focus:{shown:Infinity,used:-1}},nudges:{items:Array.from({length:1000},(_,i)=>String(i))},quietUntil:Infinity},reminders}}));
 assert.equal(data.pet.reminders.length,20);assert.equal(data.pet.reminders[0].text,'Bring bag');assert.equal(data.pet.brain.kinds.focus.shown,0);assert.equal(data.pet.brain.kinds.focus.used,0);assert.equal(data.pet.brain.quietUntil,0);assert.ok(data.pet.brain.nudges.items.length<=512);
 assert.deepEqual(A.cleanReminders(reminders,now),data.pet.reminders);
 assert.throws(()=>S.validateBackup(backup({tasks:{'7':{plannedTime:'25:00'}}})),/planned time/);
 assert.throws(()=>S.validateBackup(backup({focus:{phase:'focus',focusMinutes:25,breakMinutes:5,cycles:4,cycle:5}})),/timer cycles/);
 assert.throws(()=>S.validateBackup(backup({focus:{phase:'study'}})),/timer phase/);
});

test('Biscuit metadata never weakens the public backup hostile-key checks or changes legacy timer data',()=>{
 const legacy={minutes:45,remaining:1200,endsAt:null,itemId:'17',sessions:3};assert.deepEqual(S.validateBackup(backup({focus:legacy})).focus,legacy);
 for(const value of [JSON.parse('{"pet":{"brain":{"kinds":{"__proto__":{}}}}}'),JSON.parse('{"pet":{"routines":[{"data":{"constructor":{}}}]}}'),JSON.parse('{"tasks":{"__proto__":{}}}')])assert.throws(()=>S.validateBackup(backup(value)),/unsafe key/);
});

test('public account writes and pack writes share one queue and recover after a rejected mutation',async()=>{
 // Exercise the fallback queue in an isolated service-worker realm, independent of Node's native Web Locks.
 const env=vm.createContext({TextEncoder,structuredClone,Promise,Map,WeakMap});for(const file of ['storage.js','account-writes.js'])vm.runInContext(fs.readFileSync(require.resolve('../extension/'+file),'utf8'),env,{filename:file});
 const shared=env.ReserveStorage,pack=env.ReserveAccountWrites,key='reserve:v1:https://school.instructure.com:731',trace=[];let release,started;
 const gate=new Promise(resolve=>{release=resolve;}),began=new Promise(resolve=>{started=resolve;}),first=shared.runAccountWrite(key,async()=>{trace.push('first');started();await gate;trace.push('released');});
 await began;const second=pack.run(key,()=>trace.push('second'));await shared.runAccountWrite(key+'-independent',()=>trace.push('independent'));assert.ok(!trace.includes('second'));release();await Promise.all([first,second]);assert.ok(trace.indexOf('released')<trace.indexOf('second'));
 await assert.rejects(pack.run(key,()=>{throw Error('Rejected write');}),/Rejected write/);await shared.runAccountWrite(key,()=>trace.push('after rejection'));assert.equal(trace.at(-1),'after rejection');
});
