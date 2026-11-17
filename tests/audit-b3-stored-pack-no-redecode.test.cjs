'use strict';
// Audit B3 (2026-11-14): a theme or companion pack's pictures and videos are decoded and re-encoded (ReserveMedia.prepare)
// when the pack is added, as a check; the result is not kept. Reading the installed pack again (every dashboard load
// for the theme in use, every popup Look check, every Make it yours list with previews, every Use) ran the same decode
// again, for every picture and video of the pack, and threw the result away. The stored pack is still checked on each
// read (structure, hashes, SVG cleaning, media containers); only the repeated decode is gone.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'),hash=value=>createHash('sha256').update(value).digest('hex');
const asset={type:'image/png',data:png.toString('base64'),sha256:hash(png)};
const theme={format:'chtheme',version:1,name:'Pictures',colors:{light:{bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#444444',line:'#cccccc',accent:'#0055aa'}},icons:['a','b'],assets:{a:asset,b:asset}};
async function harness(){
 const data={},local={async get(keys){return structuredClone(Object.fromEntries((keys===null?Object.keys(data):[].concat(keys)).filter(key=>key in data).map(key=>[key,data[key]])));},async set(values){Object.assign(data,structuredClone(values));},async remove(keys){for(const key of [].concat(keys))delete data[key];}};
 const h={data,decodes:0},env=vm.createContext({Blob,URL,Headers,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,structuredClone,crypto:webcrypto,atob,btoa,AbortSignal,setTimeout,clearTimeout,importScripts(){},chrome:{runtime:{id:'x',onMessage:{addListener(){}}},storage:{local,onChanged:{addListener(){},removeListener(){}}}},fetch:async()=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>({id:'7'})})});
 for(const file of ['features.js','site.js','core.js','market-site.js','custom-art.js','media-reference.js','media-store.js','media-frame.js','workspace-arrange.js','customization-model.js','backup-media.js','custom-kits.js','quick-pack.js','gpa-model.js','personal-work.js','page-preferences.js','storage.js','planner-model.js','pet-art.js','agent-clock.js','pony-ask.js','account-writes.js','pack-common.js','theme-pack.js','pet-pack.js','preset-pack.js','packs.js'])vm.runInContext(read(file),env,{filename:file});
 // the worker's offscreen decoder, counted
 env.ReservePackMedia={async prepare(blob,slot,name){h.decodes++;return {asset:{mediaId:webcrypto.randomUUID(),name,type:blob.type,kind:'image',width:1,height:1,palette:[]},blob};}};
 h.owner={origin:'https://school.instructure.com',accountId:'7'};h.env=env;h.api=env.ReservePacks;
 h.store=env.ReserveStorage.createStore({...h.owner,adapter:{read:async key=>(await local.get(key))[key],write:(key,value)=>local.set({[key]:value})}});await h.store.load();return h;
}
test('an installed pack is decoded once, when it is added, not on every read',async()=>{
 const h=await harness(),source=JSON.stringify(theme),row=await h.api.installLocal({name:'p.chtheme',size:Buffer.byteLength(source),text:async()=>source},{store:h.store});
 assert.equal(h.decodes,2,'both pictures are decoded when the pack is added');
 for(let i=0;i<3;i++){const seen=await h.api.readLocal(row.id,{owner:h.owner});assert.equal(seen.pack.icons.length,2);}
 await h.api.installed({owner:h.owner,store:h.store});await h.api.useLocal(row.id,{store:h.store});
 assert.equal(h.decodes,2,'reading, listing and using it again decode nothing');
 h.store.destroy();
});
test('a stored pack is still checked on every read',async()=>{
 const h=await harness(),source=JSON.stringify(theme),row=await h.api.installLocal({name:'p.chtheme',size:Buffer.byteLength(source),text:async()=>source},{store:h.store});
 const key=Object.keys(h.data).find(name=>name.endsWith(':pack:'+row.id)),tampered=JSON.parse(h.data[key].source);
 tampered.assets.a.data=Buffer.from('not a picture at all').toString('base64');h.data[key]={...h.data[key],source:JSON.stringify(tampered)};
 await assert.rejects(h.api.readLocal(row.id,{owner:h.owner}),/./,'changed bytes no longer match their hash');
 h.store.destroy();
});
