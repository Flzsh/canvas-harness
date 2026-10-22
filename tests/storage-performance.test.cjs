'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const origin='https://school.instructure.com',KEY='reserve:v1:'+origin+':1',file=path.join(__dirname,'../extension/storage.js');
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
function fixture(){
 const data={},callbacks=new Map(),stats={reads:0,clones:0,serializations:0,settings:0,budgets:0,unsubscribes:0};
 const customization=require('../extension/customization-model.js');
 const context=vm.createContext({module:{exports:{}},require:createRequire(file),URL,Intl,TextEncoder,
  ReserveSite:{origin:()=>origin,timeZone:()=> 'UTC'},
  structuredClone(value){if(value?.settings&&value?.tasks)stats.clones++;return structuredClone(value);},
  JSON:{parse:JSON.parse,stringify(value,...args){if(value?.tasks||value?.data?.tasks)stats.serializations++;return JSON.stringify(value,...args);}},
  ReserveCustomization:{...customization,cleanSettings(value){stats.settings++;return customization.cleanSettings(value);},checkBudget(value){stats.budgets++;return customization.checkBudget(value);}}});
 vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:'storage.js'});
 const adapter={read:async key=>{if(key===KEY)stats.reads++;return structuredClone(data[key]);},
  async write(key,value){data[key]=structuredClone(value);for(const fn of callbacks.get(key)||[])fn({newValue:structuredClone(value)});},
  subscribe(key,fn){if(!callbacks.has(key))callbacks.set(key,new Set());callbacks.get(key).add(fn);return()=>{stats.unsubscribes++;callbacks.get(key).delete(fn);};}};
 const store=context.ReserveStorage.createStore({accountId:'1',origin,adapter}),reset=()=>{for(const key of Object.keys(stats))stats[key]=0;};
 return {data,stats,adapter,store,context,reset,callbacks};
}

test('large account saves keep the baseline read and reuse validated artwork without echo rereads',async t=>{
 const f=fixture();t.after(()=>f.store.destroy());await f.store.load();
 await f.store.update(data=>{for(let i=1;i<=150;i++)data.tasks[i]={notes:'x'.repeat(18000)};});await settle();f.reset();
 await f.store.update(data=>{data.tasks['1'].pinned=true;});await settle();
 assert.equal(f.stats.reads,1);assert.equal(f.stats.clones,2,'one draft and one returned snapshot');assert.equal(f.stats.serializations,1,'one normalized byte-budget check');assert.equal(f.stats.settings,0);assert.equal(f.stats.budgets,0);
 assert.equal(f.store.get().tasks['150'].notes.length,18000);
});

test('first save normalizes defaults before cached validation can reuse them',async t=>{
 const f=fixture();t.after(()=>f.store.destroy());await f.store.load();await f.store.update(()=>{});
 assert.equal(f.data[KEY].settings.overviewArt.bannerFit,'contain');assert.equal(f.data[KEY].settings.overviewArt.bannerPosition,'right');
});

test('delayed own echoes skip reads while foreign edits and account deletion still reload',async t=>{
 const f=fixture();t.after(()=>f.store.destroy());await f.store.load();const pending=[],write=f.adapter.write;
 f.adapter.write=async(key,value)=>{if(key===KEY){f.data[key]=structuredClone(value);pending.push(structuredClone(value));}else await write(key,value);};
 let notifications=0;f.store.subscribe(()=>notifications++);await f.store.update(data=>{data.tasks['1']={notes:'Saved'};});await settle();f.reset();
 await write(KEY,pending[0]);await settle();assert.equal(f.stats.reads,0);assert.equal(notifications,1);
 await write(KEY,{...f.data[KEY],tasks:{...f.data[KEY].tasks,'2':{notes:'Other tab'}}});await settle();assert.equal(f.store.get().tasks['2'].notes,'Other tab');assert.equal(notifications,2);
 await write(KEY,undefined);await settle();assert.equal(f.store.get().tasks['1'],undefined);assert.equal(notifications,3);
});

test('appearance notifications avoid account reads and public snapshots cannot mutate validated branches',async t=>{
 const f=fixture();t.after(()=>f.store.destroy());await f.store.load();await f.store.update(data=>{data.tasks['1']={notes:'Private'};});await settle();f.reset();
 await f.adapter.write('reserve:appearance',{theme:'dark',motion:'gentle',nightArt:0,pet:true});await settle();assert.equal(f.stats.reads,0);assert.equal(f.store.get().settings.theme,'dark');
 const snapshot=f.store.get();snapshot.tasks['1'].notes='Tampered';snapshot.settings.coursePrefs['9']={name:'Tampered'};
 await f.store.update(data=>{data.tasks['2']={notes:'Next'};});assert.equal(f.store.get().tasks['1'].notes,'Private');assert.equal(f.store.get().settings.coursePrefs['9'],undefined);
});

test('cached validation keeps rejecting changed invalid notes, SVG, hostile keys and oversized data',async t=>{
 const f=fixture();t.after(()=>f.store.destroy());await f.store.load();await f.store.update(data=>{data.tasks['1']={notes:'Safe'};});
 await assert.rejects(f.store.update(data=>{data.tasks['1'].notes='x'.repeat(20001);}),/20,000/);
 await assert.rejects(f.store.update(data=>{data.settings.coursePrefs['9']={iconArt:{svg:'<svg><script>bad</script></svg>'}};}),/art|SVG|unsafe/i);
 await assert.rejects(f.store.update(data=>{data.toolbox.extra=JSON.parse('{"__proto__":{"unsafe":true}}');}),/unsafe key/);
 await assert.rejects(f.store.update(data=>{for(let i=2;i<225;i++)data.tasks[i]={notes:'x'.repeat(18000)};}),/too large/);
 assert.equal(f.store.get().tasks['1'].notes,'Safe');
 const validate=f.context.ReserveStorage.accountValidator();validate(f.data[KEY]);const next=structuredClone(f.data[KEY]);next.tasks['1'].pinned=true;f.reset();validate(next);assert.equal(f.stats.settings,0);assert.equal(f.stats.budgets,0);
 assert.throws(()=>validate({...next,tasks:{'1':{notes:'x'.repeat(20001)}}}),/20,000/);
});

test('Chrome change events carry the saved value to avoid rereading an own account write',async()=>{
 const f=fixture();f.store.destroy();const listeners=new Set();let reads=0;
 f.context.chrome={storage:{local:{async get(key){if(key===KEY)reads++;return {[key]:structuredClone(f.data[key])};},async set(values){const changes={};for(const [key,value]of Object.entries(values)){f.data[key]=structuredClone(value);changes[key]={newValue:structuredClone(value)};}for(const fn of listeners)fn(changes,'local');}},onChanged:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}}};
 const store=f.context.ReserveStorage.createStore({accountId:'1',origin});try{await store.load();reads=0;await store.update(data=>{data.tasks['1']={notes:'Saved'};});await settle();assert.equal(reads,1);assert.equal(store.get().tasks['1'].notes,'Saved');}finally{store.destroy();}assert.equal(listeners.size,0);
});

test('store cleanup unsubscribes once and ignores callbacks retained by a delayed adapter',async()=>{
 const f=fixture();await f.store.load();const callbacks=[...f.callbacks.get(KEY)];f.reset();f.store.destroy();f.store.destroy();
 assert.equal(f.stats.unsubscribes,2);for(const fn of callbacks)fn();await settle();assert.equal(f.stats.reads,0);
});
