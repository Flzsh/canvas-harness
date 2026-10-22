'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const file=path.join(__dirname,'../extension/storage.js'),origin='https://school.instructure.com',key='reserve:v1:'+origin+':7';
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
function worker({ready}={}){
 const listeners=new Set(),data={},writes=[];let pause=null;
 const runtime={id:'test',onMessage:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}};
 const local={async get(name){return {[name]:structuredClone(data[name])};},async set(values){if(pause)await pause;for(const [name,value]of Object.entries(values)){writes.push(name);data[name]=structuredClone(value);}}};
 const env=vm.createContext({module:{exports:{}},require:createRequire(file),URL,Intl,TextEncoder,structuredClone,
  ReserveSite:{origin:()=>origin,timeZone:()=> 'UTC',supported:value=>{try{return new URL(value).origin===origin||new URL(value).origin==='https://canvas.example.edu';}catch{return false;}}}});
 vm.runInContext(fs.readFileSync(file,'utf8'),env,{filename:'storage.js'});
 const api=env.ReserveStorage,server=api.serveAccountWrites({runtime,local,ready}),sender={id:'test',frameId:0,tab:{id:1},url:origin+'/courses'};
 function request(message,source=sender){return new Promise(resolve=>{let handled=false;for(const listener of listeners)if(listener(message,source,resolve)===true)handled=true;if(!handled)resolve(undefined);});}
 return {api,server,runtime,local,data,writes,listeners,sender,request,pause:promise=>{pause=promise;}};
}

test('account writer serializes compare-and-write and rejects stale snapshots without replacing saved data',async t=>{
 const f=worker();t.after(()=>f.server.destroy());let release;f.pause(new Promise(resolve=>{release=resolve;}));
 const first=f.request({target:'ch-account-write',key,before:undefined,value:{tasks:{'1':{notes:'First'}}}});
 await flush();const stale=f.request({target:'ch-account-write',key,before:undefined,value:{tasks:{'2':{notes:'Stale'}}}});await flush();assert.equal(f.writes.length,0);
 release();assert.equal((await first).ok,true);const rejected=await stale;assert.equal(rejected.ok,false);assert.equal(rejected.conflict,true);assert.equal(f.writes.length,1);assert.equal(f.data[key].tasks['1'].notes,'First');assert.equal(f.data[key].tasks['2'],undefined);
 const next=structuredClone(f.data[key]);next.tasks['2']={notes:'Rebased'};assert.equal((await f.request({target:'ch-account-write',key,before:f.data[key],value:next})).ok,true);assert.equal(f.data[key].tasks['2'].notes,'Rebased');
});

test('account writer binds writes to a trusted top frame and the sender site',async t=>{
 const f=worker();t.after(()=>f.server.destroy());const message={target:'ch-account-write',key,before:undefined,value:{}};
 for(const sender of [{...f.sender,id:'other'},{...f.sender,frameId:1},{...f.sender,tab:{}},{...f.sender,url:'https://untrusted.example/'},{...f.sender,url:'https://user:pass@school.instructure.com/'}])assert.equal((await f.request(message,sender)).ok,false);
 for(const wrongKey of [key+':cache',key.replace(':7',':not-an-account'),key.replace(origin,'https://other.instructure.com')])assert.equal((await f.request({...message,key:wrongKey})).ok,false);
 const custom='https://canvas.example.edu';assert.equal((await f.request({...message,key:'reserve:v1:'+custom+':7'},{...f.sender,url:custom+'/courses'})).ok,true);
 assert.deepEqual(f.writes,['reserve:v1:'+custom+':7']);
});

test('cached worker validation rejects changed unsafe data and permits a later valid write',async t=>{
 const f=worker();t.after(()=>f.server.destroy());const value={tasks:{'1':{notes:'Safe'}}};
 assert.equal((await f.request({target:'ch-account-write',key,value})).ok,true);
 for(const invalid of [{tasks:{'1':{notes:'x'.repeat(20001)}}},JSON.parse('{"tasks":{"__proto__":{}}}'),{toolbox:{scratchpad:'x'.repeat(4000001)}}]){
  const result=await f.request({target:'ch-account-write',key,before:f.data[key],value:invalid});assert.equal(result.ok,false);
 }
 assert.equal(f.data[key].tasks['1'].notes,'Safe');
 const next={tasks:{'1':{notes:'Next'}}};assert.equal((await f.request({target:'ch-account-write',key,before:f.data[key],value:next})).ok,true);
});

test('account writer setup and cleanup are idempotent and ignores unrelated messages',async()=>{
 const f=worker();assert.strictEqual(f.api.serveAccountWrites({runtime:f.runtime,local:f.local}),f.server);assert.equal(f.listeners.size,1);
 assert.equal(await f.request({target:'unrelated'}),undefined);f.server.destroy();f.server.destroy();assert.equal(f.listeners.size,0);
 const again=f.api.serveAccountWrites({runtime:f.runtime,local:f.local});assert.notStrictEqual(again,f.server);again.destroy();
});

test('account requests await the current school-registration readiness before checking and saving',async t=>{
 let release;const ready=new Promise(resolve=>{release=resolve;}),f=worker({ready:()=>ready});t.after(()=>f.server.destroy());
 const request=f.request({target:'ch-account-write',key,value:{tasks:{'1':{notes:'After registration'}}}});await flush();assert.equal(f.writes.length,0);
 release();assert.equal((await request).ok,true);assert.equal(f.data[key].tasks['1'].notes,'After registration');
});

function retryStore(){
 const data={},writes=[];let intervene=()=>{};
 const api=require('../extension/storage.js');
 const adapter={read:async name=>structuredClone(data[name]),async write(name,value){data[name]=structuredClone(value);},
  async compareWrite(name,value,before){writes.push(name);intervene(name);if(!same(data[name],before))throw Object.assign(Error('Account changed'),{code:'storage-conflict'});data[name]=structuredClone(value);}};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),store=api.createStore({accountId:'7',origin,adapter});
 return {store,data,writes,intervene:fn=>{intervene=fn;}};
}

test('store retries rebase independent account edits without rerunning the mutator',async t=>{
 const f=retryStore();t.after(()=>f.store.destroy());await f.store.load();await f.store.update(data=>{data.tasks['1']={notes:'Original'};});
 let attempts=0,mutations=0;f.intervene(name=>{if(attempts++===0)f.data[name].tasks['2']={notes:'Other document'};});
 await f.store.update(data=>{mutations++;data.tasks['1'].pinned=true;});
 assert.equal(attempts,2);assert.equal(mutations,1);assert.equal(f.store.get().tasks['1'].pinned,true);assert.equal(f.store.get().tasks['2'].notes,'Other document');
});

test('competing edits to the same value fail without overwriting the other document',async t=>{
 const f=retryStore();t.after(()=>f.store.destroy());await f.store.load();await f.store.update(data=>{data.tasks['1']={notes:'Original'};});
 let mutations=0;f.intervene(name=>{f.data[name].tasks['1'].notes='Other document';});
 await assert.rejects(f.store.update(data=>{mutations++;data.tasks['1'].notes='Local edit';}),error=>error.code==='storage-conflict');
 assert.equal(mutations,1);assert.equal(f.data[key].tasks['1'].notes,'Other document');assert.equal(f.store.get().tasks['1'].notes,'Original');
});

test('backup replacement never retries against a newly changed account',async t=>{
 const f=retryStore();t.after(()=>f.store.destroy());await f.store.load();await f.store.update(data=>{data.tasks['1']={notes:'Original'};});
 const before=f.writes.length;f.intervene(name=>{f.data[name].tasks['2']={notes:'New remote task'};});
 await assert.rejects(f.store.replace({tasks:{'3':{notes:'Imported'}}}),error=>error.code==='storage-conflict');
 assert.equal(f.writes.length-before,1);assert.equal(f.data[key].tasks['2'].notes,'New remote task');assert.equal(f.data[key].tasks['3'],undefined);
});

test('continuous conflicts stop after a bounded retry count',async t=>{
 const f=retryStore();t.after(()=>f.store.destroy());await f.store.load();await f.store.update(data=>{data.tasks['1']={notes:'Original'};});
 let attempts=0,mutations=0;f.intervene(name=>{f.data[name].tasks[String(100+attempts++)]={notes:'Remote'};});
 await assert.rejects(f.store.update(data=>{mutations++;data.tasks['1'].pinned=true;}),error=>error.code==='storage-conflict');
 assert.equal(attempts,8);assert.equal(mutations,1);assert.equal(f.store.get().tasks['1'].pinned,false);
});
