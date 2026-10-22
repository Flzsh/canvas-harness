'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {worker,message}=require('./market-worker-fixture.cjs'),{indexedMemory}=require('./market-indexed-fixture.cjs'),{read,deferred}=require('./market-fixture.cjs');
const A='https://school.instructure.com',B='https://other.instructure.com',marketURL='https://flzsh.github.io/canvas-harness-packs/',owner={origin:A,accountId:'7'},key=(origin=A,id='7')=>'reserve:v1:'+origin+':'+id;
const art='<?ch-pack version="1"?><?ch-art place="overview" slot="icon"?><svg viewBox="0 0 20 20"><circle r="4"/></svg><?ch-end parts="1"?>',kit={version:1,name:'Personal',assets:{},accent:'clay',font:'system',bannerSize:'standard',bannerFit:'contain',bannerPosition:'right',titlePlacement:'separate'};
for(const saved of [true,false])test('Market keeps originating school B after activation'+(saved?' with saved school A':' without a saved school'),async()=>{
 const h=worker({indexedDB:indexedMemory(),saved:saved?{'reserve:school':A}:{}}),tabs=new Map([[9,{id:9,url:B+'/dashboard'}]]);let active=9;
 h.chrome.tabs.query=async()=>[tabs.get(active)];h.chrome.tabs.create=async options=>{const tab={id:12,...options};tabs.set(12,tab);active=12;return tab;};h.chrome.tabs.update=async(id,options)=>{Object.assign(tabs.get(id),options);active=id;return tabs.get(id);};
 const page=vm.createContext({URL,chrome:{...h.chrome,runtime:{...h.chrome.runtime,sendMessage:msg=>h.request(msg,h.popup)},permissions:{...h.chrome.permissions,request:async()=>true}}});vm.runInContext(read('market.js'),page);await page.ReserveMarket.open(marketURL);
 const sender={id:'test',frameId:0,tab:{id:12},url:marketURL},reply=await h.request(message('course-art',art),sender);assert.equal(reply.ok,true,reply.reason);assert.match(h.data[key(B)].settings.overviewArt.iconArt.svg,/<circle/);assert.equal(h.data[key()].settings.overviewArt.iconArt,undefined);
 h.env.fetch=async()=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>({id:'8'})});const before=structuredClone(h.data),switched=await h.request(message('course-art',art,'switched'),sender);assert.equal(switched.ok,false);assert.match(switched.reason,/account changed/i);assert.deepEqual(h.data,before);
});
for(const op of ['install','remove'])test('queued artwork '+op+' rechecks account after acquiring its account queue',async()=>{
 const h=worker({indexedDB:indexedMemory()}),payload=message('course-art',art);if(op==='remove')await h.env.ReservePacks.install(payload.entry,payload.bytes);
 const before=structuredClone(h.data),entered=deferred(),release=deferred(),queued=deferred(),run=h.env.ReserveAccountWrites.run;
 h.env.ReserveAccountWrites={run:(name,fn)=>{if(name===key())queued.resolve();return run(name,fn);}};
 const hold=run(key(),async()=>{entered.resolve();await release.promise;});await entered.promise;
 const action=op==='install'?h.env.ReservePacks.install(payload.entry,payload.bytes):h.env.ReservePacks.remove('one'),result=action.then(value=>({value}),error=>({error}));await queued.promise;
 h.env.fetch=async()=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>({id:'8'})});release.resolve();await hold;const outcome=await result;assert.ok(outcome.error,'queued mutation must reject after the profile changes');assert.match(outcome.error.message,/account changed/i);assert.deepEqual(h.data,before);
});
test('a restored personal shared kit can be removed without a Market receipt',async()=>{
 const source=worker({indexedDB:indexedMemory()}),pool=source.env.ReserveMedia.createPackStore(owner),id=webcrypto.randomUUID();await pool.saveKit({id,name:'Personal',accent:'clay',font:'system',bannerSize:'standard',appearance:{}});pool.close();
 const store=source.env.ReserveStorage.createStore({...owner,adapter:{read:async name=>(await source.local.get(name))[name],write:(name,value)=>source.local.set({[name]:value})}});await store.load();const backup=await store.exportBackupWithPacks();store.destroy();
 const target=worker({indexedDB:indexedMemory()}),sender={id:'test',frameId:0,tab:{id:9},url:A+'/dashboard'};const restored=await target.request({type:'market-local',op:'restore',backup,owner},sender);assert.equal(restored.ok,true,restored.reason);
 const shared=target.env.ReserveMedia.createPackStore(owner);assert.equal((await shared.listKits()).length,1);const removed=await target.request({type:'market-kit-remove',owner,kitId:id},sender);assert.equal(removed.ok,true,removed.reason);assert.equal((await shared.listKits()).length,0);shared.close();
});
for(const kind of ['kit','course-art'])test('the same '+kind+' catalogue entry installs independently under accounts 7 and 8',async()=>{
 const h=worker({indexedDB:indexedMemory()}),payload=message(kind,kind==='kit'?kit:art),first=await h.env.ReservePacks.install(payload.entry,payload.bytes),seven=structuredClone(h.data[key()]);
 h.env.fetch=async url=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>String(url).includes('/profile')?{id:'8'}:[]});assert.equal((await h.env.ReservePacks.installed()).length,0);const second=await h.env.ReservePacks.install(payload.entry,payload.bytes);assert.notEqual(second.id,first.id);assert.equal((await h.env.ReservePacks.installed()).length,1);await assert.rejects(h.env.ReservePacks.install(payload.entry,payload.bytes),/already installed/);assert.deepEqual(h.data[key()],seven);
 await h.env.ReservePacks.remove(second.id);assert.equal((await h.env.ReservePacks.installed()).length,0);assert.deepEqual(h.data[key()],seven);h.env.fetch=async url=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>String(url).includes('/profile')?{id:'7'}:[]});assert.equal((await h.env.ReservePacks.installed()).length,1);await h.env.ReservePacks.remove(first.id);assert.equal((await h.env.ReservePacks.installed()).length,0);
});
