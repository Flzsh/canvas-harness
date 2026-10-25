// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),plain=v=>JSON.parse(JSON.stringify(v)),owner={origin:'https://school.instructure.com',accountId:'7'},key='reserve:v1:'+owner.origin+':7';
const theme=name=>({format:'chtheme',version:1,name,colors:{light:{bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#444444',line:'#cccccc',accent:'#0055aa'}}});
const preset=(name,accent)=>({format:'chpreset',version:1,name,kind:'settings',data:{accent}});
const svg='<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24"/></svg>',wireAsset=(type,value)=>{const bytes=Buffer.from(value);return {type,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')};};
const pet=name=>({format:'chpet',version:1,name,size:[64,64],ground:60,faces:'right',poses:{stand:'body',walk:'body',sleep:'body'},assets:{body:wireAsset('image/svg+xml',svg)}});
const file=(doc,ext=doc.format)=>{const source=JSON.stringify(doc);return {name:'local.'+ext,size:Buffer.byteLength(source),text:async()=>source};};
function harness(saved={}){
 const data=structuredClone(saved),writes=[],fetches=[],listeners=[],profile={id:'7'};let failAccount=false,failDocuments=false;
 const local={async get(keys){return structuredClone(Object.fromEntries((keys===null?Object.keys(data):[].concat(keys)).filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]])));},async set(values){if(failAccount&&Object.hasOwn(values,key))throw Error('Account disk full');if(failDocuments&&Object.keys(values).some(k=>k.includes(':pack:')||k.endsWith(':packs')))throw Error('Pack disk full');Object.assign(data,structuredClone(values));writes.push(structuredClone(values));},async remove(keys){for(const k of [].concat(keys))delete data[k];}};
 const env=vm.createContext({Blob,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,structuredClone,crypto:webcrypto,atob,btoa,AbortSignal,setTimeout,clearTimeout,importScripts(){},chrome:{storage:{local,onChanged:{addListener(){},removeListener(){}}},runtime:{onMessage:{addListener(fn){listeners.push(fn);}}}},fetch:async(url,options)=>{assert.equal(url,owner.origin+'/api/v1/users/self/profile','local packs may only verify their Canvas profile');assert.equal(options.method,undefined);assert.equal(options.credentials,'include');assert.equal(options.redirect,'error');fetches.push({url,options});return {ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>({id:profile.id})};}});
 env.importScripts=(...files)=>files.forEach(file=>vm.runInContext(read(file),env,{filename:file}));
 require('./market-fixture.cjs').loadMarketSite(env);
 for(const f of ['features.js','core.js','custom-art.js','media-reference.js','media-store.js','workspace-arrange.js','customization-model.js','backup-media.js','custom-kits.js','quick-pack.js','gpa-model.js','personal-work.js','page-preferences.js','storage.js','planner-model.js','pet-art.js','agent-clock.js','pony-ask.js','account-writes.js','pack-common.js','theme-pack.js','pet-pack.js','preset-pack.js','packs.js'])vm.runInContext(read(f),env,{filename:f});
 const store=env.ReserveStorage.createStore({...owner,adapter:{read:async k=>(await local.get(k))[k],write:async(k,v)=>local.set({[k]:v})}});
 return {data,writes,env,api:env.ReservePacks,store,local,fetches,get profile(){return profile.id;},set profile(value){profile.id=value;},set failAccount(v){failAccount=v;},set failDocuments(v){failDocuments=v;}};
}
function profileOnly(h){assert.ok(h.fetches.length>=3,'mutations recheck the profile inside the account queue');assert.ok(h.fetches.every(call=>call.url===owner.origin+'/api/v1/users/self/profile'&&call.options.method===undefined&&call.options.credentials==='include'&&call.options.redirect==='error'));}
module.exports={harness,theme,preset,pet,file,owner,key,profileOnly,plain};
