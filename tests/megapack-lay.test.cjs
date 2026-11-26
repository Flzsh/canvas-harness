'use strict';
// Megapack (4.2): the land under the room (roomPage, in the land's own page) lays each picture as CSS. A build that carries the
// megapack's files lays the package's address at once and swaps to the store's blob once read, as before. A build that does not
// carry them (the public one: they are downloaded) never asks the package for them first: the picture waits for the store's blob,
// and only a file the store turns out not to have takes the package's address. So a land shown from the store asks the package
// for nothing (no "Failed to load resource" in the frame for page-<land>-<stage>.webp, its layers or under.webp).
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createDOM,read,settle}=require('./addons-fixture.cjs');
const BASE='chrome-extension://lay-test/themes/train/',HOST='https://flzsh.github.io/canvas-harness-packs/megapacks/soul-passage/files/';
const SRC=read('scene-themes.js'),RIDE=fs.readFileSync(path.join(__dirname,'../extension/themes/train/ride.json'),'utf8');
// the sea at noon: its page, its three travelling layers and the carriage's underside
const SEA=['page-sea-noon.webp','page-sea-noon-1.webp','page-sea-noon-2.webp','page-sea-noon-3.webp','under.webp'];
const sha=i=>String(i).padStart(2,'0').repeat(32);
function world({packaged,stored=SEA,named=SEA}){
 const document=createDOM('<html><body></body></html>'),made=new Map(),fetched=[],matched=[],images=[];let serial=0;
 const decorate=el=>{el.animate=()=>({cancel(){}});el.getBoundingClientRect=()=>({left:0,top:0,width:1366,height:300,right:1366,bottom:300});if(el.tagName==='IMG')images.push(el);return el;};
 const create=document.createElement;document.createElement=tag=>decorate(create(tag));
 const names=Object.fromEntries(named.map((name,i)=>[name,sha(i+1)+'.webp']));
 const store=Object.fromEntries(stored.map(name=>[HOST+names[name],name]));
 class Address extends URL{static createObjectURL(blob){const url='blob:lay-'+(++serial);made.set(url,blob.name);return url;}static revokeObjectURL(){}}
 const resources=['themes/train/ride.json','themes/train/poster.jpg',...(packaged?SEA.map(f=>'themes/train/'+f):[])];
 const env=vm.createContext({document,console,Promise,URL:Address,location:{protocol:'chrome-extension:'},performance:{now:()=>0},
  setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,cancelAnimationFrame(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
  caches:{open:async()=>({match:async key=>{matched.push(key);return Object.hasOwn(store,key)?{ok:true,blob:async()=>({name:store[key]})}:undefined;}})},
  fetch:async url=>{fetched.push(String(url).replace(BASE,''));return String(url)===BASE+'ride.json'?{ok:true,json:async()=>JSON.parse(RIDE),blob:async()=>({name:'ride.json'})}:{ok:false,status:404};},
  chrome:{runtime:{getURL:f=>'chrome-extension://lay-test/'+f,getManifest:()=>({web_accessible_resources:[{resources,matches:['https://*.instructure.com/*']}]})},
   storage:{local:{get:(key,cb)=>cb({[key]:{version:4,engine:1,bytes:1,count:named.length,manifest:'c'.repeat(64),names,at:1}})},onChanged:{addListener(){}}}}});
 vm.runInContext(SRC,env,{filename:'scene-themes.js'});
 const api=env.ReserveSceneThemes,here=api.pageHere(document,BASE,'train');document.body.append(here.node);
 // every picture laid so far, by the file it names (a blob's file, or the package's)
 const pictures=()=>{const out={};const walk=n=>{for(const c of n.children||[]){const m=/url\("([^"]+)"\)/.exec(c.style?.backgroundImage||'');if(m)out[m[1].startsWith('blob:')?made.get(m[1]):m[1].replace(BASE,'')]=m[1].startsWith('blob:')?'store':'package';walk(c);}};walk(here.node);return out;};
 return {api,here,fetched,matched,images,pictures,made};
}
const G={x:0,k:.5,top:0,deep:1000};
// show the sea at noon, the train moving at its fastest stop (so the far layers' smears are prepared at once)
const show=async w=>{assert.equal(w.here.show(G,'sea',[['noon',1]],2,[4,0,0,0],0,4),true);await settle();await settle();await settle();};

test('a build that does not carry the files asks the package for none of them: each picture waits for the store\'s blob',async()=>{
 const w=world({packaged:false});
 assert.equal(w.here.show(G,'sea',[['noon',1]],2,[4,0,0,0],0,4),true);
 assert.deepEqual(w.pictures(),{},'nothing laid from the package while the store is read');
 await settle();await settle();await settle();
 assert.deepEqual(w.pictures(),Object.fromEntries(SEA.map(f=>[f,'store'])),'every picture laid from the store');
 assert.deepEqual(w.fetched.filter(f=>SEA.includes(f)),[],'the package was never asked for them');
 assert.ok(w.images.some(img=>img.getAttribute('src')),'the fastest layer\'s smear is being made');
 for(const img of w.images){const src=img.getAttribute('src');if(src)assert.match(src,/^blob:/,'a smear is made from the store\'s picture, never the package\'s');}
});

test('a file the store turns out not to have: the package\'s address, as before (only that one)',async()=>{
 const w=world({packaged:false,stored:SEA.filter(f=>f!=='page-sea-noon-2.webp')});await show(w);
 const p=w.pictures();assert.equal(p['page-sea-noon-2.webp'],'package','the missing one falls back to the package');
 for(const f of SEA.filter(f=>f!=='page-sea-noon-2.webp'))assert.equal(p[f],'store',f);
 const gone=world({packaged:false,named:SEA.filter(f=>f!=='under.webp')});await show(gone);
 assert.equal(gone.pictures()['under.webp'],'package','a name the record does not have: the package');
});

test('a build that carries the files: the package\'s address at once, then the store\'s blob, exactly as before',async()=>{
 const w=world({packaged:true});
 assert.equal(w.here.show(G,'sea',[['noon',1]],2,[4,0,0,0],0,4),true);
 assert.deepEqual(w.pictures(),Object.fromEntries(SEA.map(f=>[f,'package'])),'laid from the package at once');
 await settle();await settle();await settle();
 assert.deepEqual(w.pictures(),Object.fromEntries(SEA.map(f=>[f,'store'])),'then swapped to the store\'s blobs');
});
