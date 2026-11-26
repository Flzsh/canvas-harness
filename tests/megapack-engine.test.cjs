'use strict';
// Megapack (megapack engine 1): the frames read every downloaded-kind file through one
// read(name): the store first (Cache Storage 'megapack-soul-passage', the key found through the local record's names map), then
// the package, so a build that carries the files works as before. Canvas's own page never looks in the store (it cannot see it).
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const SRC=fs.readFileSync(path.join(__dirname,'../extension/scene-themes.js'),'utf8');
const BASE='chrome-extension://mp-test/themes/train/',HOST='https://flzsh.github.io/canvas-harness-packs/megapacks/soul-passage/files/';
const SHA='a'.repeat(64),SHA2='b'.repeat(64);
function world({protocol='chrome-extension:',record=null,store={},pkg={}}={}){
 const log={opens:0,matches:[],fetched:[],gets:0},changes=[];
 const response=(body,from)=>({ok:true,status:200,from,text:async()=>body,blob:async()=>({body,from}),json:async()=>JSON.parse(body)});
 const env={console,URL,Promise,
  location:{protocol},
  caches:{open:async name=>{log.opens++;assert.equal(name,'megapack-soul-passage','one store');return {match:async key=>{log.matches.push(key);return Object.hasOwn(store,key)?response(store[key],'store'):undefined;}};}},
  fetch:async url=>{log.fetched.push(url);const name=url.replace(BASE,'');return Object.hasOwn(pkg,name)?response(pkg[name],'package'):{ok:false,status:404};},
  chrome:{runtime:{getURL:f=>'chrome-extension://mp-test/'+f},storage:{local:{get:(key,cb)=>{log.gets++;cb({[key]:record});}},onChanged:{addListener:fn=>changes.push(fn)}}}};
 vm.runInContext(SRC,vm.createContext(env),{filename:'scene-themes.js'});
 return {api:env.ReserveSceneThemes,log,env,change:next=>{record=next;for(const fn of changes)fn({'megapack:soul-passage':{newValue:next}},'local');}};
}
const recordWith=names=>({version:1,engine:1,bytes:3,count:Object.keys(names).length,manifest:'c'.repeat(64),names,at:1});
test('read(name): the store first, through the record\'s names map and the file\'s Market address',async()=>{
 const w=world({record:recordWith({'cabin-noon.webp':SHA+'.webp'}),store:{[HOST+SHA+'.webp']:'store bytes'},pkg:{'cabin-noon.webp':'package bytes'}}),read=w.api.reader(BASE);
 const r=await read(BASE+'cabin-noon.webp');assert.equal(r.ok,true);assert.equal(r.from,'store');assert.equal(await r.text(),'store bytes');
 assert.deepEqual(w.log.matches,[HOST+SHA+'.webp'],'the key is the Market address of the name\'s file');assert.deepEqual(w.log.fetched,[],'the package is not read');
 assert.equal((await read('cabin-noon.webp')).from,'store','a bare name reads the same');
});
test('a store miss, a name the record does not have, or no record: the package; neither: not ok',async()=>{
 const miss=world({record:recordWith({'cabin-noon.webp':SHA+'.webp'}),store:{},pkg:{'cabin-noon.webp':'package bytes'}});
 assert.equal((await miss.api.reader(BASE)(BASE+'cabin-noon.webp')).from,'package','in the record, not in the store');
 const other=world({record:recordWith({'cabin-noon.webp':SHA+'.webp'}),store:{[HOST+SHA+'.webp']:'x'},pkg:{'land-sea-noon-0.webp':'package bytes'}});
 assert.equal((await other.api.reader(BASE)(BASE+'land-sea-noon-0.webp')).from,'package','not in the record');assert.equal(other.log.opens,0,'the store is not opened for it');
 const none=world({record:null,pkg:{'page-sea-noon.webp':'p'}});assert.equal((await none.api.reader(BASE)(BASE+'page-sea-noon.webp')).from,'package','no record');
 const neither=world({record:recordWith({}),pkg:{}});const r=await neither.api.reader(BASE)(BASE+'page-sea-noon.webp');assert.equal(r.ok,false,'neither: not ok, as a missing file was before');
 const odd=world({record:recordWith({'page-sea-noon.webp':'../../evil.js'}),store:{[HOST+'../../evil.js']:'x'},pkg:{'page-sea-noon.webp':'p'}});
 assert.equal((await odd.api.reader(BASE)(BASE+'page-sea-noon.webp')).from,'package','a names entry that is not "<sha256>.<ext>" is not followed');assert.equal(odd.log.opens,0);
});
test('only the downloaded kind goes to the store; Canvas\'s own page never looks there',async()=>{
 const w=world({record:recordWith({'ride.json':SHA+'.json','kit-sea-rug-peri.png':SHA2+'.png'}),store:{[HOST+SHA+'.json']:'{}',[HOST+SHA2+'.png']:'x'},pkg:{'ride.json':'{"lands":{}}','kit-sea-rug-peri.png':'k'}}),read=w.api.reader(BASE);
 assert.equal((await read(BASE+'ride.json')).from,'package','ride.json always comes with the package');assert.equal((await read(BASE+'kit-sea-rug-peri.png')).from,'package','so do the kits');assert.equal(w.log.gets,0,'the record is not even read');
 for(const name of ['page-sea-noon-2.webp','land-abyss-night-1.webp','cabin-dusk.webp','pieces-noon.webp','flow-mesa-3.webp','sprites-peaks-sunset.webp','under.webp','under-sea.webp','sun-grove.json','live-metro.json'])assert.ok(w.api.megapacks.train.kind.test(name),name+' is of the downloaded kind');
 for(const name of ['ride.json','lever.webp','poster.jpg','icon-cat.png','kit-peaks-label.png','train-card-dark.png','theme.css','band.js'])assert.ok(!w.api.megapacks.train.kind.test(name),name+' stays in the package');
 const page=world({protocol:'https:',record:recordWith({'cabin-noon.webp':SHA+'.webp'}),store:{[HOST+SHA+'.webp']:'store bytes'},pkg:{'cabin-noon.webp':'package bytes'}});
 assert.equal((await page.api.reader(BASE)(BASE+'cabin-noon.webp')).from,'package');assert.equal(page.log.opens,0,'Canvas\'s page does not open a store');
});
test('the record is read once a document, and again when it changes',async()=>{
 const w=world({record:null,store:{[HOST+SHA+'.webp']:'store bytes'},pkg:{'cabin-noon.webp':'package bytes'}}),read=w.api.reader(BASE);
 assert.equal((await read(BASE+'cabin-noon.webp')).from,'package');await read(BASE+'cabin-noon.webp');assert.equal(w.log.gets,1,'once');
 w.change(recordWith({'cabin-noon.webp':SHA+'.webp'}));assert.equal((await read(BASE+'cabin-noon.webp')).from,'store','the download has ended');assert.equal(w.log.gets,2);
 assert.equal(await w.api.megapack('train'),'packaged','without a manifest to say otherwise the files are taken as packaged');
});
