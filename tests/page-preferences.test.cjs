'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Preferences=require('../extension/page-preferences.js'),{createStore,validateBackup}=require('../extension/storage.js'),{createSession}=require('../extension/session.js');
const origin='https://school.instructure.com',key='reserve:v1:'+origin+':1',appearance='reserve:appearance';
function harness(seed={}){
 const data=structuredClone(seed),listeners=new Set(),writes=[];let fail=false;
 const events={addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)};
 const local={async get(key){return {[key]:structuredClone(data[key])};},async set(values){if(fail)throw Error('Disk full');writes.push(structuredClone(values));const changes={};for(const [key,value]of Object.entries(values)){changes[key]={newValue:structuredClone(value)};data[key]=structuredClone(value);}for(const fn of listeners)fn(changes,'local');}};
 const adapter={read:async key=>(await local.get(key))[key],write:async(key,value)=>local.set({[key]:value}),subscribe(key,fn){const handle=(changes,area)=>{if(area==='local'&&changes[key])fn();};events.addListener(handle);return()=>events.removeListener(handle);}};
 return {data,local,events,adapter,writes,fail:()=>{fail=true;},count:()=>listeners.size};
}
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
test('appearance pages read without creating defaults and change only fields in the device record',async()=>{
 const h=harness(),page=Preferences.create({origin,...h});
 assert.deepEqual(await page.load(),{theme:'light',motion:'gentle',nightArt:0,pet:true,sceneTheme:''});assert.equal(h.writes.length,0);
 await page.set({theme:'dark'});await page.set({motion:'off'});await page.set({nightArt:72});await page.set({pet:false});
 // Saved before any dashboard visit: the record lists what was chosen so a later migration keeps those fields.
 assert.deepEqual(h.data[appearance],{theme:'dark',motion:'off',nightArt:72,pet:false,sceneTheme:'',chosen:['theme','motion','nightArt','pet']});assert.deepEqual(Object.keys(h.data),[appearance]);
 assert.deepEqual(page.get(),{theme:'dark',motion:'off',nightArt:72,pet:false,sceneTheme:''});page.destroy();
});
test('first dashboard load migrates the old account appearance exactly once without touching personal data',async()=>{
 const legacy={settings:{theme:'dark',motion:'still',nightArt:65},pet:{enabled:false,name:'Maple',xp:90},tasks:{'7':{notes:'Keep me'}}};
 const h=harness({[key]:legacy}),store=createStore({origin,accountId:'1',adapter:h.adapter});await store.load();
 assert.deepEqual(h.data[appearance],{theme:'dark',motion:'still',nightArt:65,pet:false,sceneTheme:''});assert.deepEqual(h.data[key],legacy);
 await store.load();const other=createStore({origin:'https://other.instructure.com',accountId:'2',adapter:h.adapter});await other.load();
 assert.equal(h.writes.length,1);assert.equal(other.get().settings.theme,'dark');assert.equal(other.get().tasks['7'],undefined);store.destroy();other.destroy();
});
test('system or missing legacy theme migrates to light',async()=>{
 for(const theme of ['system','light',undefined]){
  const h=harness({[key]:{settings:{...(theme?{theme}:{})}}}),store=createStore({origin,accountId:'1',adapter:h.adapter});
  await store.load();assert.equal(h.data[appearance].theme,'light');store.destroy();
 }
});
test('existing device choices override legacy values and follow external edits live',async()=>{
 const legacy={settings:{theme:'dark',motion:'gentle',nightArt:15},pet:{enabled:true,name:'Maple',xp:90},tasks:{'7':{notes:'Keep me'}}};
 const h=harness({[key]:legacy,[appearance]:{theme:'light',motion:'still',nightArt:20,pet:false}}),store=createStore({origin,accountId:'1',adapter:h.adapter});
 await store.load();assert.equal(store.get().settings.theme,'light');assert.equal(store.get().pet.enabled,false);assert.equal(h.writes.length,0);
 const received=[];store.subscribe(data=>received.push(data));const page=Preferences.create({origin,...h});await page.load();await page.set({theme:'dark',motion:'off'});await settle();
 assert.equal(store.get().settings.theme,'dark');assert.equal(store.get().settings.motion,'off');assert.equal(store.get().settings.nightArt,20);assert.ok(received.some(data=>data.settings.theme==='dark'));
 assert.equal(store.get().pet.name,'Maple');assert.equal(store.get().pet.xp,90);assert.deepEqual(h.data[key],legacy);
 await store.update(data=>{data.settings.nightArt=95;data.pet.enabled=true;});await settle();assert.equal(page.get().nightArt,95);assert.equal(page.get().pet,true);assert.deepEqual(h.data[key],legacy);
 page.destroy();store.destroy();assert.equal(h.count(),0);
});
test('personal saves omit appearance and cannot overwrite a choice during a slow note write',async()=>{
 const h=harness(),store=createStore({origin,accountId:'1',adapter:h.adapter});await store.load();
 const page=Preferences.create({origin,...h});await page.load();let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r),write=h.adapter.write;
 h.adapter.write=async(target,value)=>{if(target===key){entered();await gate;}return write(target,value);};
 const saving=store.update(data=>{data.tasks['7']={notes:'Typing now'};});await started;await page.set({theme:'dark'});release();await saving;await settle();
 assert.equal(h.data[key].tasks['7'].notes,'Typing now');assert.equal(store.get().settings.theme,'dark');
 for(const field of ['theme','motion','nightArt'])assert.equal(h.data[key].settings[field],undefined);assert.equal(h.data[key].pet.enabled,undefined);
 page.destroy();store.destroy();
});
test('appearance writes reject unsupported fields and report storage failures',async()=>{
 const h=harness(),page=Preferences.create({origin,...h});await page.load();
 for(const value of [{theme:'system'},{motion:'lively'},{nightArt:101},{pet:'no'},{tasks:{}}])await assert.rejects(page.set(value),/Invalid|Unknown/);
 assert.equal(h.writes.length,0);h.fail();await assert.rejects(page.set({theme:'dark'}),/Disk full/);assert.equal(page.get().theme,'light');page.destroy();
});
test('normal session startup never writes the personal blob or account activation keys',async()=>{
 const legacy={settings:{theme:'light'},tasks:{'7':{notes:'Original'}}},cached={origin,user:{id:'1'},courses:[],assignments:[],fetchedAt:new Date().toISOString()};
 const h=harness({[key]:legacy,[key+':cache']:cached}),shown=[];
 const session=createSession({client:{origin,profile:async()=>({id:'1'}),loadSnapshot:async()=>{throw Error('Fresh cache');}},createStore:args=>createStore({...args,adapter:h.adapter}),onSnapshot:value=>shown.push(value),onError:error=>{throw error;}});
 await session.start();assert.equal(shown.length,1);assert.deepEqual(h.data[key],legacy);assert.deepEqual(h.writes.map(write=>Object.keys(write)),[[appearance]]);session.destroy();
 const again=createSession({client:{origin,profile:async()=>({id:'1'})},createStore:args=>createStore({...args,adapter:h.adapter}),onSnapshot(){},onError:error=>{throw error;}});
 h.writes.length=0;await again.start();assert.equal(h.writes.length,0);again.destroy();
});

test('a popup save before the first dashboard visit keeps the older account choices it did not touch',async()=>{
 const legacy={settings:{theme:'dark',motion:'still',nightArt:65},pet:{enabled:true,name:'Maple'}};
 const h=harness({[key]:legacy}),page=Preferences.create({origin,...h});await page.load();
 await page.set({pet:false});assert.deepEqual(h.data[appearance].chosen,['pet']);
 const store=createStore({origin,accountId:'1',adapter:h.adapter});await store.load();
 assert.deepEqual(h.data[appearance],{theme:'dark',motion:'still',nightArt:65,pet:false,sceneTheme:''},'migration fills only the unchosen fields and ends the pending list');
 assert.equal(store.get().settings.theme,'dark');assert.equal(store.get().pet.enabled,false);assert.equal(page.get().theme,'dark');
 await page.set({theme:'light'});assert.deepEqual(h.data[appearance],{theme:'light',motion:'still',nightArt:65,pet:false,sceneTheme:''});
 page.destroy();store.destroy();
});
test('damaged stored fields fall back to defaults instead of failing every page',async()=>{
 const h=harness({[appearance]:{theme:'purple',motion:'still',nightArt:'x',pet:false}}),page=Preferences.create({origin,...h});
 assert.deepEqual(await page.load(),{theme:'light',motion:'still',nightArt:0,pet:false,sceneTheme:''});page.destroy();
});
test('the worker applies changes from separate pages one at a time, so neither is lost',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),source=fs.readFileSync(path.join(__dirname,'../extension/page-preferences.js'),'utf8');
 const instance=extra=>{const context=vm.createContext({structuredClone,...extra});vm.runInContext(source,context);return context.ReservePagePreferences;};
 // One storage area whose reads are slow, as when two pages save in the same moment.
 const h=harness({[appearance]:{theme:'dark',motion:'gentle',nightArt:0,pet:true}}),slow={get:async name=>{const value=await h.local.get(name);await new Promise(r=>setTimeout(r,15));return value;},set:values=>h.local.set(values)};
 const race=async remoteFor=>{
  h.data[appearance]={theme:'dark',motion:'gentle',nightArt:0,pet:true};
  const a=instance({}).create({local:slow,events:h.events,remote:remoteFor()}),b=instance({}).create({local:slow,events:h.events,remote:remoteFor()});
  await Promise.all([a.set({theme:'light'}),b.set({pet:false})]);a.destroy();b.destroy();return {...h.data[appearance]};
 };
 assert.deepEqual(await race(()=>null),{theme:'dark',motion:'gentle',nightArt:0,pet:false,sceneTheme:''},'without the worker one page overwrites the other (the bug)');
 let listener;const runtime={id:'ext',onMessage:{addListener:fn=>{listener=fn;}}};
 instance({}).serve({runtime,local:slow});
 const page=instance({chrome:{runtime:{id:'ext',sendMessage:message=>new Promise(resolve=>{const kept=listener(structuredClone(message),{id:'ext'},value=>resolve(structuredClone(value)));assert.equal(kept,true);})}}});
 assert.deepEqual(await race(()=>page.messenger()),{theme:'light',motion:'gentle',nightArt:0,pet:false,sceneTheme:''});
 const ignored=listener({target:'ch-appearance',op:'write',value:{theme:'light'}},{id:'someone-else'},()=>assert.fail('a foreign sender is answered'));assert.equal(ignored,undefined);
 const rejected=await new Promise(resolve=>listener({target:'ch-appearance',op:'write',value:{tasks:{}}},{id:'ext'},resolve));assert.equal(rejected.ok,false);assert.match(rejected.error,/Invalid/);
});
test('when the worker cannot be reached the page still saves the change itself',async()=>{
 const h=harness(),page=Preferences.create({origin,...h,remote:async(request,adapter)=>{throw Error('unreachable');}});await page.load();
 await assert.rejects(page.set({theme:'dark'}),/unreachable/);page.destroy();
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),context=vm.createContext({structuredClone,chrome:{runtime:{id:'ext',sendMessage:async()=>{throw Error('Receiving end does not exist.');}}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/page-preferences.js'),'utf8'),context);
 const offline=context.ReservePagePreferences.create({local:h.local,events:h.events});await offline.load();await offline.set({theme:'dark'});
 assert.equal(h.data[appearance].theme,'dark');offline.destroy();
});

test('device appearance choices reach live account settings and survive reload, recovery and same-account backups',async()=>{
 const legacy={settings:{theme:'dark',motion:'still',nightArt:15},pet:{enabled:false,name:'Saved pony'},tasks:{7:{notes:'Keep these notes'}}};
 const h=harness({[key]:legacy}),store=createStore({origin,accountId:'1',adapter:h.adapter}),page=Preferences.create(h);await store.load();await page.load();
 const seen=[];store.subscribe(data=>seen.push(data.settings.nightArt));await page.set({nightArt:60});await settle();
 assert.equal(store.get().settings.nightArt,60);assert.ok(seen.includes(60));assert.deepEqual(h.data[key],legacy);
 await store.update(data=>{data.settings.nightArt=85;data.tasks['7'].notes='A new note';});await settle();
 assert.equal(page.get().nightArt,85);assert.equal(h.data[appearance].nightArt,85);assert.equal(h.data[key].settings.nightArt,undefined);assert.equal(h.data[key].tasks['7'].notes,'A new note');
 await store.load();assert.equal(store.get().settings.nightArt,85);
 const backup=store.exportBackup(),clean=validateBackup(backup,store.owner);assert.equal(clean.settings.nightArt,85);assert.equal(clean.tasks['7'].notes,'A new note');
 await page.set({nightArt:25});await settle();await store.replace(clean);await settle();assert.equal(page.get().nightArt,85);assert.equal(store.get().settings.nightArt,85);
 await store.saveRecovery();assert.equal((await store.readRecovery()).settings.nightArt,85);assert.equal(validateBackup(store.exportBackup(),store.owner).settings.nightArt,85);
 assert.deepEqual(Preferences.personal(store.get()).settings.nightArt,undefined);page.destroy();store.destroy();assert.equal(h.count(),0);
});

test('personal appearance separation keeps device fields out of account writes without dropping them from live data',()=>{
 const data={settings:{theme:'dark',motion:'off',nightArt:17,accent:'ocean'},pet:{enabled:false,name:'Keep'},tasks:{7:{notes:'Keep'}}};
 const before=structuredClone(data),device=Preferences.fromData(data);assert.deepEqual(device,{theme:'dark',motion:'off',nightArt:17,pet:false,sceneTheme:''});
 const personal=Preferences.personal(data);assert.deepEqual(personal,{settings:{accent:'ocean'},pet:{name:'Keep'},tasks:{7:{notes:'Keep'}}});assert.deepEqual(data,before);
 assert.equal(Preferences.apply(personal,{...device,theme:'light'}).settings.theme,'light');assert.deepEqual(Preferences.fromData({settings:{},pet:{}}),{theme:'light',motion:'gentle',nightArt:0,pet:true,sceneTheme:''});
});
