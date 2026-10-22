'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {read}=require('./market-fixture.cjs');
const SITE='https://canvas.example.edu',OTHER='https://other.example.edu',owner={origin:SITE,accountId:'7'};
function fixture({worker=false,registered=true,granted=true,permissions=worker}={}){
 const source=JSON.stringify({format:'chtheme',version:1,name:'Garden',colors:{light:{bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#444444',line:'#cccccc',accent:'#0055aa'}}}),doc={id:'local-garden',name:'Garden',kind:'theme',installedAt:1,source,receipt:{kind:'theme',applications:[]}},base='reserve:market-media:'+JSON.stringify([SITE,'7']);
 const data={'reserve:sites':registered?[SITE,OTHER]:[],[base+':packs']:{version:1,documents:[{id:doc.id,name:doc.name,kind:doc.kind,installedAt:1,bytes:Buffer.byteLength(JSON.stringify(doc))}]},[base+':pack:'+doc.id]:doc};
 const chrome={runtime:{id:'test'},storage:{local:{get:async key=>structuredClone(Object.hasOwn(data,key)?{[key]:data[key]}:{}),set:async()=>{throw Error('Reads must not mutate');}}}},permissionsCalls=[];
 if(permissions)chrome.permissions={contains:async value=>{permissionsCalls.push(value);return granted;}};
 const env=vm.createContext({URL,Blob,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,structuredClone,location:new URL(SITE+'/dashboard'),chrome,...(worker?{importScripts(){}}:{})});
 for(const file of ['site.js','market-site.js','media-reference.js','media-store.js','custom-art.js','custom-kits.js','pack-common.js','theme-pack.js','pet-pack.js','preset-pack.js','packs.js'])vm.runInContext(read(file),env,{filename:file});
 if(registered)env.ReserveSite.trustSites([SITE,OTHER]);return {env,data,permissionsCalls};
}
test('a registered custom-school page without chrome.permissions can hydrate only its own packs',async()=>{
 const h=fixture();assert.equal(h.env.chrome.permissions,undefined);assert.equal(await h.env.ReserveMarketSite.allowed(SITE),true);const row=await h.env.ReservePacks.readLocal('local-garden',{owner});assert.equal(row.pack.name,'Garden');assert.equal(await h.env.ReserveMarketSite.allowed(OTHER),false);await assert.rejects(h.env.ReservePacks.readLocal('local-garden',{owner:{...owner,origin:OTHER}}),/not allowed/);
 delete h.data['reserve:sites'];assert.equal(await h.env.ReserveMarketSite.allowed(SITE),false);
});
test('worker custom-school access requires both stored registration and current browser permission',async()=>{
 for(const options of [{registered:false},{granted:false},{permissions:false}]){const h=fixture({worker:true,...options});assert.equal(await h.env.ReserveMarketSite.allowed(SITE),false);await assert.rejects(h.env.ReservePacks.readLocal('local-garden',{owner}),/not allowed/);}
 const h=fixture({worker:true});assert.equal(await h.env.ReserveMarketSite.allowed(SITE),true);assert.deepEqual(JSON.parse(JSON.stringify(h.permissionsCalls[0])),{origins:[SITE+'/*']});
});
test('sender checks wait for public startup and reject foreign, cross-site, subframe and credentialed owners',async()=>{
 const h=fixture({worker:true});let release,settled=false;h.env.ReserveMarketReady=()=>new Promise(resolve=>{release=resolve;});const sender={id:'test',frameId:0,tab:{id:4},url:SITE+'/dashboard'},pending=h.env.ReserveMarketSite.sender(sender,owner).then(value=>{settled=true;return value;});
 await Promise.resolve();assert.equal(settled,false);h.env.ReserveMarketReady=()=>Promise.resolve();release();assert.equal(await pending,true);
 for(const source of [{...sender,id:'other'},{...sender,frameId:1},{...sender,tab:undefined},{...sender,url:OTHER+'/'},{...sender,url:'https://user@canvas.example.edu/'}])assert.equal(await h.env.ReserveMarketSite.sender(source,owner),false);
});
