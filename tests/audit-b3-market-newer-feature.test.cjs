'use strict';
// Audit B3 (2026-11-14): the Market lists one catalogue for every version. A feature pack for a feature or a scene that
// only a newer CH has was refused with "Unknown feature.", while a new pack kind says "Update Canvas Harness to add
// this". A student on an older build now gets the same update message; anything malformed is still refused as before.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),UPDATE='Update Canvas Harness to add this';
const payload=(doc,id='pack')=>{const bytes=Buffer.from(JSON.stringify(doc));return [{id,name:id,kind:'feature',file:'files/'+id+'.json',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},bytes.toString('base64')];};
function harness(){
 const data={},writes=[],local={async get(keys){return structuredClone(Object.fromEntries([].concat(keys).filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]])));},async set(values){Object.assign(data,structuredClone(values));writes.push(values);},async remove(){}};
 const env=vm.createContext({Blob,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,structuredClone,crypto:webcrypto,atob,btoa,AbortSignal,setTimeout,clearTimeout,importScripts(){},chrome:{storage:{local,onChanged:{addListener(){},removeListener(){}}},runtime:{onMessage:{addListener(){}}}},fetch:async()=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>({id:'7'})})});
 for(const name of ['features.js','site.js','core.js','market-site.js','custom-art.js','media-reference.js','media-store.js','workspace-arrange.js','customization-model.js','backup-media.js','custom-kits.js','quick-pack.js','gpa-model.js','personal-work.js','page-preferences.js','storage.js','planner-model.js','pet-art.js','agent-clock.js','pony-ask.js','account-writes.js','pack-common.js','theme-pack.js','pet-pack.js','preset-pack.js','packs.js'])vm.runInContext(read(name),env,{filename:name});
 return {api:env.ReservePacks,writes};
}
test('a newer feature or scene asks for an update; malformed or refused ones stay refused without writes',async()=>{
 for(const doc of [{feature:'flashcards-plus'},{feature:'scene-themes',sceneTheme:'winter-lights'}]){const h=harness();await assert.rejects(h.api.install(...payload(doc)),{message:UPDATE},JSON.stringify(doc));assert.equal(h.writes.length,0);}
 for(const doc of [{feature:'developer'},{feature:'https://evil.test/code.js'},{feature:'pony',code:'alert(1)'},{feature:'scene-themes',sceneTheme:'<script>'},{feature:false},['pony']]){const h=harness();await assert.rejects(h.api.install(...payload(doc)),error=>error.message!==UPDATE,JSON.stringify(doc));assert.equal(h.writes.length,0);}
});
