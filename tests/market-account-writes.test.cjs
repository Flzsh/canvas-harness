'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{webcrypto}=require('node:crypto'),{read,settle,deferred}=require('./market-fixture.cjs');
const KEY='reserve:v1:https://school.instructure.com:7';
function fixture(){
 const data={},listeners=[],local={async get(keys){return structuredClone(Object.fromEntries([].concat(keys).filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]])));},async set(values){Object.assign(data,structuredClone(values));}},runtime={id:'test',onMessage:{addListener:fn=>listeners.push(fn),removeListener:fn=>listeners.splice(listeners.indexOf(fn),1)}},worker=vm.createContext({chrome:{runtime,storage:{local}},URL,Intl,Blob,TextEncoder,TextDecoder,structuredClone,crypto:webcrypto,Uint8Array,atob,btoa});
 for(const file of ['site.js','core.js','personal-work.js','custom-art.js','media-reference.js','media-store.js','workspace-arrange.js','customization-model.js','gpa-model.js','page-preferences.js','storage.js','market-site.js','account-writes.js'])vm.runInContext(read(file),worker,{filename:file});
 assert.equal(listeners.length,0,'Market queue adapter must not install another account listener');worker.ReserveStorage.serveAccountWrites();assert.equal(listeners.length,1);
 const sender={id:'test',frameId:0,tab:{id:2},url:'https://school.instructure.com/courses/10'};
 const request=(message,source=sender)=>new Promise(resolve=>{const handled=listeners.map(fn=>fn(message,source,resolve));if(!handled.includes(true))resolve(undefined);});
 const content=vm.createContext({URL,Intl,TextEncoder,TextDecoder,structuredClone,crypto:webcrypto,chrome:{storage:{local,onChanged:{addListener(){},removeListener(){}}},runtime:{id:'test',sendMessage:request}}});
 for(const file of ['site.js','core.js','personal-work.js','custom-art.js','workspace-arrange.js','customization-model.js','gpa-model.js','page-preferences.js','storage.js'])vm.runInContext(read(file),content,{filename:file});
 const store=content.ReserveStorage.createStore({accountId:'7'});return {data,local,worker,content,store,request,sender};
}
test('worker account writes reject stale baselines and untrusted senders',async()=>{
 const h=fixture();h.data[KEY]={settings:{},tasks:{'1':{notes:'new'}}};const before={settings:{},tasks:{'1':{notes:'old'}}},message={target:'ch-account-write',key:KEY,before,value:{settings:{},tasks:{'1':{notes:'overwrite'}}}};
 assert.equal((await h.request(message)).conflict,true);assert.equal(h.data[KEY].tasks['1'].notes,'new');for(const sender of [{...h.sender,id:'other'},{...h.sender,frameId:1},{...h.sender,url:'https://evil.test/'},{...h.sender,tab:undefined}])assert.equal((await h.request({...message,before:h.data[KEY]},sender)).ok,false);
 assert.equal((await h.request({...message,key:'reserve:features'})).ok,false);
});
test('separate origins serialize market artwork and a normal personal write without losing either',async()=>{
 const h=fixture();await h.store.load();await h.store.update(s=>{s.tasks['1']={notes:'old'};});const gate=deferred(),entered=deferred();let attempts=0;
 const send=h.content.chrome.runtime.sendMessage;h.content.chrome.runtime.sendMessage=async message=>{if(message.target==='ch-account-write'&&!attempts++){entered.resolve();await gate.promise;}return send(message);};
 const normal=h.store.update(s=>{s.tasks['1'].notes='new';});await entered.promise;
 await h.worker.ReserveAccountWrites.run(KEY,async()=>{const saved=(await h.local.get(KEY))[KEY];saved.settings.overviewArt.iconArt={name:'Market',svg:'<svg/>'};await h.local.set({[KEY]:saved});});gate.resolve();await normal;
 assert.equal(h.data[KEY].tasks['1'].notes,'new');assert.equal(h.data[KEY].settings.overviewArt.iconArt.name,'Market');assert.equal(attempts,2);h.store.destroy();
});
test('market waiting behind a normal save reads the newly saved personal data',async()=>{
 const h=fixture();await h.store.load();await h.store.update(s=>{s.tasks['1']={notes:'old'};});const gate=deferred(),entered=deferred(),set=h.local.set;
 h.local.set=async values=>{if(values[KEY]?.tasks?.['1']?.notes==='new'){entered.resolve();await gate.promise;}return set(values);};const normal=h.store.update(s=>{s.tasks['1'].notes='new';});await entered.promise;
 const market=h.worker.ReserveAccountWrites.run(KEY,async()=>{const saved=(await h.local.get(KEY))[KEY];saved.settings.overviewArt.iconArt={name:'Market',svg:'<svg/>'};await h.local.set({[KEY]:saved});});await settle();gate.resolve();await Promise.all([normal,market]);assert.equal(h.data[KEY].tasks['1'].notes,'new');assert.equal(h.data[KEY].settings.overviewArt.iconArt.name,'Market');h.store.destroy();
});
test('a captured settings snapshot rebases only its original changes, preserving newly installed art',async()=>{
 const h=fixture();await h.store.load();await h.store.update(s=>{s.tasks['1']={notes:'old'};});const captured=structuredClone(h.store.get().settings.coursePrefs),gate=deferred(),entered=deferred();let once=true;const send=h.content.chrome.runtime.sendMessage;h.content.chrome.runtime.sendMessage=async message=>{if(message.target==='ch-account-write'&&once){once=false;entered.resolve();await gate.promise;}return send(message);};
 const normal=h.store.update(s=>{s.settings.coursePrefs=captured;s.tasks['1'].notes='new';});await entered.promise;await h.worker.ReserveAccountWrites.run(KEY,async()=>{const data=(await h.local.get(KEY))[KEY];data.settings.coursePrefs['10']={iconArt:{name:'Market',svg:'<svg/>'}};await h.local.set({[KEY]:data});});gate.resolve();await normal;assert.equal(h.data[KEY].tasks['1'].notes,'new');assert.equal(h.data[KEY].settings.coursePrefs['10'].iconArt.name,'Market');h.store.destroy();
});
test('exhausted account conflicts release every media hold and do not publish device preferences',async()=>{
 const h=fixture();vm.runInContext(read('media-reference.js'),h.content);vm.runInContext(read('media-store.js'),h.content);const calls=[],mediaStore={reserve:async(ids,token)=>calls.push(['reserve',token]),release:async token=>calls.push(['release',token])},store=h.content.ReserveStorage.createStore({accountId:'7',mediaStore});await store.load();const original=structuredClone(h.data),send=h.content.chrome.runtime.sendMessage;h.content.chrome.runtime.sendMessage=message=>message.target==='ch-account-write'?Promise.resolve({ok:false,conflict:true}):send(message);
 await assert.rejects(store.update(s=>{s.settings.theme='dark';s.settings.overviewArt.bannerArt={mediaId:webcrypto.randomUUID(),name:'Image',type:'image/webp',kind:'image',width:20,height:10,palette:[]};s.tasks['1']={notes:'new'};}),/changed/i);assert.equal(calls.length,16);for(let i=0;i<calls.length;i+=2){assert.equal(calls[i][0],'reserve');assert.equal(calls[i+1][0],'release');assert.equal(calls[i][1],calls[i+1][1]);}assert.deepEqual(h.data,original);store.destroy();h.store.destroy();
});
test('a full backup replacement reports concurrent changes instead of merging a partial restore',async()=>{
 const h=fixture();await h.store.load();await h.store.update(s=>{s.tasks['1']={notes:'old'};});const snapshot=h.store.get();snapshot.tasks['1'].notes='restored';const gate=deferred(),entered=deferred(),send=h.content.chrome.runtime.sendMessage;h.content.chrome.runtime.sendMessage=async message=>{if(message.target==='ch-account-write'){entered.resolve();await gate.promise;}return send(message);};const restoring=h.store.replace(snapshot);await entered.promise;await h.worker.ReserveAccountWrites.run(KEY,async()=>{const current=(await h.local.get(KEY))[KEY];current.settings.overviewArt.iconArt={name:'Market',svg:'<svg/>'};await h.local.set({[KEY]:current});});gate.resolve();await assert.rejects(restoring,/changed/i);assert.equal(h.data[KEY].tasks['1'].notes,'old');assert.equal(h.data[KEY].settings.overviewArt.iconArt.name,'Market');h.store.destroy();
});

test('public worker validation rejects changed task structures and unsafe artwork before saving',async()=>{
 const h=fixture();await h.store.load();
 await h.store.update(data=>{data.tasks['1']={notes:'Safe'};});
 const before=structuredClone(h.data[KEY]),value=structuredClone(before);value.tasks=[];
 const reply=await h.request({target:'ch-account-write',key:KEY,before,value});assert.equal(reply.ok,false);assert.match(reply.error,/structure|tasks/i);assert.deepEqual(h.data[KEY],before);
 value.tasks=structuredClone(before.tasks);value.tasks['1'].notes='Still safe';value.settings.coursePrefs['10']={iconArt:{svg:'<svg><script>bad</script></svg>'}};
 assert.equal((await h.request({target:'ch-account-write',key:KEY,before,value})).ok,false);assert.deepEqual(h.data[KEY],before);
 await h.store.update(data=>{data.tasks['2']={notes:'Valid update'};});assert.equal(h.data[KEY].tasks['2'].notes,'Valid update');h.store.destroy();
});
