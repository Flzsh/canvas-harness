'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
const {createDOM,settle}=require('./market-fixture.cjs'),source=fs.readFileSync(require('node:path').join(__dirname,'../extension/media-store.js'),'utf8');
const media=require('../extension/media-store.js'),model=require('../extension/customization-model.js');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'),gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'),jpeg=Buffer.from([255,216,255,192,0,8,8,0,1,0,1,1,255,218,0,2,0,255,217]);
const id=()=>webcrypto.randomUUID(),asset=(extra={})=>({mediaId:id(),name:'My photo.webp',kind:'image',type:'image/webp',width:1200,height:600,palette:['#cc0000','#00cc00','#0000cc'],...extra});
function memory(){let state={media:[],kits:[]};return {transact:async(fn,write)=>{const copy=structuredClone(state),result=fn(copy);if(write)state=copy;return result;},get state(){return state;},seed(s){state=s;}};}
 function environment(extra={}){const env=vm.createContext({Blob,URL,TextEncoder,structuredClone,crypto:webcrypto,setTimeout,clearTimeout,console,...extra});vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../extension/media-reference.js'),'utf8'),env);vm.runInContext(source,env);return env;}
test('references validate slot, kind, type, dimensions, duration and palette without URLs',()=>{
 assert.equal(media.cleanReference(asset()).width,1200);
 for(const change of [{mediaId:'https://evil.test/a'},{kind:'script'},{type:'image/svg+xml'},{width:2401},{height:0},{palette:['red']},{src:'https://evil.test/x'},{duration:5}])assert.throws(()=>media.cleanReference(asset(change)));
 const video=asset({kind:'video',type:'video/mp4',duration:60,width:1920});assert.equal(media.cleanReference(video).duration,60);assert.throws(()=>media.cleanReference(video,'title'));assert.throws(()=>media.cleanReference(asset(),'border'));assert.throws(()=>media.cleanReference(asset(),'icon'));
});
test('video metadata rejects excess bytes, duration, dimensions and nonfinite values',()=>{
 const good={size:30000000,width:1920,height:1080,duration:60};assert.doesNotThrow(()=>media.validateVideo(good));
 for(const change of [{size:30000001},{size:0},{duration:60.01},{duration:Infinity},{duration:NaN},{duration:0},{width:1921},{height:0}])assert.throws(()=>media.validateVideo({...good,...change}));
});
test('palette returns three stable colours and ignores transparent pixels',()=>{
 const rgba=new Uint8ClampedArray([255,0,0,255,255,0,0,255,0,255,0,255,0,255,0,255,0,0,255,255,0,0,255,255,255,255,255,0]);
 assert.deepEqual(media.palette(rgba).sort(),['#0000ff','#00ff00','#ff0000']);assert.deepEqual(media.palette(new Uint8Array()),['#a9522f','#367964','#5f5ccc']);assert.deepEqual(media.palette(new Uint8Array([3,4,5,255])),['#030405','#030405','#030405']);
});
function photoHarness({width=4800,height=1200,webp=true,bytes=50,decodeError=false}={}){
 const canvases=[],bitmaps=[];let decodes=0;const document={createElement:tag=>{assert.equal(tag,'canvas');const c={width:0,height:0,draws:[],toBlob(fn,type){fn(new Blob([new Uint8Array(bytes)],{type:type==='image/webp'&&!webp?'image/png':type}));},getContext(){return {drawImage:(...args)=>c.draws.push(args),getImageData:()=>({data:new Uint8Array([50,80,90,255,60,90,100,255,70,100,110,255])})};}};canvases.push(c);return c;}};
 const env=environment({document,createImageBitmap:async blob=>{decodes++;if(decodeError)throw Error('bad');const b={width,height,close(){this.closed=true;}};bitmaps.push(b);return b;}});
 return {api:env.ReserveMedia,canvases,bitmaps,get decodes(){return decodes;}};
}
test('photos decode asynchronously, downscale to 2400px, encode new bytes and close bitmap',async()=>{
 const h=photoHarness(),input=new Blob([jpeg],{type:'image/jpeg'}),pending=h.api.prepare(input,'banner','Me.jpg');assert.equal(h.decodes,0);
 const result=await pending;assert.equal(result.asset.width,2400);assert.equal(result.asset.height,600);assert.equal(result.blob.type,'image/webp');assert.notEqual(await result.blob.text(),'private metadata');assert.equal(h.bitmaps[0].closed,true);assert.equal(h.canvases[1].width,64);assert.ok(h.canvases[1].height<=64);
});
test('GIF is rasterized once; title alpha uses a clear canvas and PNG fallback',async()=>{
 const h=photoHarness({width:50,height:50,webp:false});await h.api.prepare(new Blob([gif],{type:'image/gif'}),'banner','Still.gif');assert.equal(h.decodes,1);
 const photo=await h.api.prepare(new Blob([png],{type:'image/png'}),'title','Title.png');assert.equal(photo.blob.type,'image/png');assert.equal(photo.asset.width,50);assert.equal(h.canvases.at(-2).draws.length,1);
 for(const type of ['image/jpeg','image/gif','video/mp4','text/html','image/svg+xml'])await assert.rejects(h.api.prepare(new Blob(['x'],{type}),'title','x'));
});
test('photo refusal paths keep decoding bounded and release resources',async()=>{
 await assert.rejects(photoHarness({bytes:3000001}).api.prepare(new Blob([png],{type:'image/png'}),'banner','x'),/3 MB/);
 const huge=photoHarness({width:100000,height:16000});await assert.rejects(huge.api.prepare(new Blob([png],{type:'image/png'}),'banner','x'),/dimensions/);assert.equal(huge.bitmaps[0].closed,true);
 await assert.rejects(photoHarness({decodeError:true}).api.prepare(new Blob([png],{type:'image/png'}),'banner','x'),/could not/);
 const h=photoHarness();await assert.rejects(h.api.prepare(new Blob([new Uint8Array(30000001)],{type:'image/png'}),'banner','x'),/30 MB/);assert.equal(h.decodes,0);
});
function videoHarness(change={}){
 const base=photoHarness(),doc={createElement(tag){if(tag==='canvas'){const c={width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8Array([3,40,80,255])})}),toBlob:fn=>fn(new Blob(['poster'],{type:'image/webp'}))};return c;}assert.equal(tag,'video');return video;}},events=new Map(),revoked=[];
 let source='',loads=0,pauses=0;const video={videoWidth:1920,videoHeight:1080,duration:60,readyState:2,...change,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),set src(value){source=value;},get src(){return source;},load(){loads++;if(source)queueMicrotask(()=>events.get(change.error?'error':'loadedmetadata')?.());},pause(){pauses++;},removeAttribute(key){if(key==='src')source='';}};
 const env=environment({document:doc,URL:{createObjectURL:()=> 'blob:local-video',revokeObjectURL:url=>revoked.push(url)}});return {api:env.ReserveMedia,video,revoked,get loads(){return loads;},get pauses(){return pauses;},events};
}
test('detached video import checks metadata, extracts one still and releases source on success/refusal',async()=>{
 const h=videoHarness(),result=await h.api.prepare(new Blob(['MP4'],{type:'video/mp4'}),'banner','Mine.mp4');assert.equal(result.asset.duration,60);assert.equal(result.asset.width,1920);assert.equal(result.poster.type,'image/webp');assert.equal(h.video.preload,'metadata');assert.equal(h.video.muted,true);assert.equal(h.video.src,'');assert.equal(h.pauses,1);assert.deepEqual(h.revoked,['blob:local-video']);assert.equal(h.events.size,0);
 for(const change of [{duration:3601},{videoWidth:16001},{duration:Infinity},{error:true}]){const bad=videoHarness(change);await assert.rejects(bad.api.prepare(new Blob(['x'],{type:'video/webm'}),'banner','x.webm'));assert.equal(bad.video.src,'');assert.equal(bad.revoked.length,1);assert.equal(bad.events.size,0);}
});
test('scaled video references and fractional framing survive storage and binary backup',async()=>{
 const frame=require('../extension/media-frame.js'),item={asset:asset({name:'Scaled.webm',kind:'video',type:'video/webm',width:1920,height:528,duration:11.8}),blob:new Blob(['recorded'],{type:'video/webm'}),poster:new Blob([png],{type:'image/png'})},framed=frame.clean({asset:item.asset,loop:{start:0,end:11.8},still:11.8},a=>media.cleanReference(a,'banner')),store=media.createStore({accountId:'105',origin:'https://school.instructure.com'},{adapter:memory()});await store.putMany([item]);const restored=media.decodeMedia(JSON.parse(JSON.stringify(await media.encodeMedia(await store.get(item.asset.mediaId)))));assert.deepEqual(restored.asset,item.asset);assert.deepEqual(frame.clean({...framed,asset:restored.asset},a=>media.cleanReference(a,'banner')),framed);assert.equal(await restored.blob.text(),'recorded');assert.throws(()=>media.cleanReference({...item.asset,width:1921}));assert.throws(()=>media.cleanMedia({...item,blob:new Blob([new Uint8Array(30000001)],{type:'video/webm'})}));
});
test('budget plans oldest unused first and never removes pinned or incoming media',()=>{
 const row=(mediaId,createdAt,size)=>({asset:{mediaId},createdAt,blob:{size}}),rows=[row('new',3,20),row('old',1,20),row('used',0,20)];
 assert.deepEqual(media.planBudget(rows,[{blob:{size:20}}],new Set(['used']),60),['old']);assert.throws(()=>media.planBudget(rows,[{blob:{size:61}}],new Set(),60),/full/);assert.throws(()=>media.planBudget(rows,[{blob:{size:20}}],new Set(['old','new','used']),60),/full/);
 assert.deepEqual(media.planBudget([{...row('one',1,20),poster:{size:10}}],[{blob:{size:31}}],new Set(),60),['one']);
});
test('account-scoped media and kits keep pins; removal frees only kit references',async()=>{
 const adapter=memory(),a=media.createStore({accountId:'1',origin:'https://school.instructure.com'},{adapter}),b=media.createStore({accountId:'2',origin:'https://school.instructure.com'},{adapter}),photo={asset:asset(),blob:new Blob(['photo'],{type:'image/webp'})};await a.putMany([photo]);assert.ok(await a.get(photo.asset.mediaId));assert.equal(await b.get(photo.asset.mediaId),null);
 const kit={id:id(),name:'Mine',appearance:{bannerArt:photo.asset},accent:'#123456',font:'serif',bannerSize:'large'};await a.saveKit(kit);assert.equal((await a.listKits()).length,1);assert.deepEqual(await b.listKits(),[]);await a.removeKit(kit.id);assert.deepEqual(await a.listKits(),[]);assert.ok(await a.get(photo.asset.mediaId));
 await assert.rejects(a.saveKit({...kit,id:id(),appearance:{bannerArt:asset()}}),/missing/);assert.deepEqual(await a.listKits(),[]);
});
test('60 MB budget refuses without consent, then atomically removes only unused media',async()=>{
 const adapter=memory(),store=media.createStore({accountId:'1',origin:'https://school.instructure.com'},{adapter}),blob=new Blob([new Uint8Array(30000000)],{type:'video/mp4'}),make=()=>({asset:asset({kind:'video',type:'video/mp4',width:1920,duration:60}),blob});
 const first=make(),second=make(),third=make();await store.putMany([first,second]);let confirmations=0;
 await assert.rejects(store.putMany([third],{usedIds:new Set([second.asset.mediaId]),confirm:async()=>{confirmations++;return false;}}),/full/);assert.ok(await store.get(first.asset.mediaId));assert.equal(await store.get(third.asset.mediaId),null);
 await store.putMany([third],{usedIds:new Set([second.asset.mediaId]),confirm:async()=>{confirmations++;return true;}});assert.equal(confirmations,2);assert.equal(await store.get(first.asset.mediaId),null);assert.ok(await store.get(second.asset.mediaId));assert.ok(await store.get(third.asset.mediaId));
 await assert.rejects(store.putMany([make()],{usedIds:new Set([second.asset.mediaId,third.asset.mediaId]),confirm:async()=>{throw Error('must not ask');}}),/full/);
});
test('saved kit pins protect media under pressure and malformed batches never partly save',async()=>{
 const adapter=memory(),store=media.createStore({accountId:'5',origin:'https://school.instructure.com'},{adapter}),blob=new Blob([new Uint8Array(30000000)],{type:'video/webm'}),make=()=>({asset:asset({kind:'video',type:'video/webm',width:1920,duration:60}),blob}),one=make(),two=make();await store.putMany([one,two]);await store.saveKit({id:id(),name:'Kept',appearance:{bannerArt:one.asset,titleArt:undefined},accent:'forest',font:'system',bannerSize:'standard'});
 await assert.rejects(store.putMany([make()],{usedIds:new Set([two.asset.mediaId]),confirm:async()=>{throw Error('must not evict');}}),/full/);assert.ok(await store.get(one.asset.mediaId));
 const good={asset:asset(),blob:new Blob(['image'],{type:'image/webp'})},bad={asset:asset(),blob:new Blob(['html'],{type:'text/html'})};await assert.rejects(store.putMany([good,bad]));assert.equal(await store.get(good.asset.mediaId),null);
});
test('concurrent publishers retain pending bytes until preferences are visible to other tabs',async()=>{
 const adapter=memory(),owner={accountId:'51',origin:'https://school.instructure.com'},used=new Set(),a=media.createStore(owner,{adapter,readUsed:async()=>used}),b=media.createStore(owner,{adapter,readUsed:async()=>used}),blob=new Blob([new Uint8Array(30000000)],{type:'video/mp4'}),make=()=>({asset:asset({kind:'video',type:'video/mp4',width:1920,duration:60}),blob}),first=make(),unused=make(),incoming=make(),hold=id();
 await a.putMany([first],{hold});await a.putMany([unused]);let removed;await b.putMany([incoming],{confirm:async ids=>{removed=ids;return true;}});assert.deepEqual(removed,[unused.asset.mediaId]);assert.ok(await a.get(first.asset.mediaId));used.add(first.asset.mediaId);await a.release(hold);assert.ok(await a.get(first.asset.mediaId));
});
test('publication during a budget snapshot forces an authoritative reference refresh',async()=>{
 const adapter=memory(),owner={accountId:'52',origin:'https://school.instructure.com'},used=new Set(),a=media.createStore(owner,{adapter,readUsed:async()=>used}),blob=new Blob([new Uint8Array(30000000)],{type:'video/webm'}),make=()=>({asset:asset({kind:'video',type:'video/webm',width:1920,duration:60}),blob}),first=make(),old=make(),incoming=make(),hold=id();await a.putMany([first],{hold});await a.putMany([old]);let reads=0;
 const b=media.createStore(owner,{adapter,readUsed:async()=>{const snapshot=new Set(used);if(++reads===1){used.add(first.asset.mediaId);await a.release(hold);}return snapshot;}});let removed;await b.putMany([incoming],{confirm:async ids=>{removed=ids;return true;}});assert.ok(reads>=2);assert.deepEqual(removed,[old.asset.mediaId]);assert.ok(await a.get(first.asset.mediaId));
});
test('backup restore during cleanup confirmation protects its newly published media',async()=>{
 const adapter=memory(),owner={accountId:'55',origin:'https://school.instructure.com'},data={},personalAdapter={read:async key=>structuredClone(data[key]),write:async(key,value)=>{data[key]=structuredClone(value);}},storage=require('../extension/storage.js'),used=async()=>media.referenced(data[`reserve:v1:${owner.origin}:${owner.accountId}`]?.settings),local=media.createStore(owner,{adapter,readUsed:used}),store=storage.createStore({...owner,adapter:personalAdapter,mediaStore:local}),blob=new Blob([new Uint8Array(30000000)],{type:'video/mp4'}),make=()=>({asset:asset({kind:'video',type:'video/mp4',width:1920,duration:60}),blob}),first=make(),old=make(),incoming=make();await store.load();await local.putMany([first,old]);let confirmations=0;
 const backup=store.exportBackup();backup.data.settings.overviewArt={bannerArt:first.asset};await local.putMany([incoming],{confirm:async ids=>{if(++confirmations===1)await store.replace(storage.validateBackup(backup,owner));return true;}});assert.ok(await local.get(first.asset.mediaId));assert.equal(await local.get(old.asset.mediaId),null);assert.equal(store.get().settings.overviewArt.bannerArt.mediaId,first.asset.mediaId);
});
test('failed preference writes release publication holds and never create dangling references',async()=>{
 const adapter=memory(),owner={accountId:'56',origin:'https://school.instructure.com'},local=media.createStore(owner,{adapter}),data={},personalAdapter={read:async key=>structuredClone(data[key]),write:async(key,value)=>{if(key.startsWith('reserve:v1:'))throw Error('write refused');data[key]=structuredClone(value);}},store=require('../extension/storage.js').createStore({...owner,adapter:personalAdapter,mediaStore:local}),photo={asset:asset(),blob:new Blob(['photo'],{type:'image/webp'})};await store.load();await local.putMany([photo]);await assert.rejects(store.update(d=>{d.settings.overviewArt={bannerArt:photo.asset};}),/write refused/);assert.deepEqual(adapter.state.media[0].holds,[]);assert.equal(store.get().settings.overviewArt.bannerArt,undefined);
 await assert.rejects(store.update(d=>{d.settings.overviewArt={bannerArt:asset()};}),/missing/);assert.equal(store.get().settings.overviewArt.bannerArt,undefined);
});
test('overlapping kit-use reservations cannot release each other',async()=>{
 const adapter=memory(),owner={accountId:'53',origin:'https://school.instructure.com'},store=media.createStore(owner,{adapter}),photo={asset:asset(),blob:new Blob(['photo'],{type:'image/webp'})};await store.putMany([photo]);const one=id(),two=id(),ids=new Set([photo.asset.mediaId]);await store.reserve(ids,one);await store.reserve(ids,two);await store.release(one);assert.deepEqual(adapter.state.media[0].holds,[two]);await store.release(two);assert.deepEqual(adapter.state.media[0].holds,[]);
});
test('Web Locks protect live publications and recover crashed holds before confirmed cleanup',async()=>{
 const active=new Set(),locks={async request(name,options,fn){if(typeof options==='function'){fn=options;options={};}if(active.has(name)){assert.equal(options.ifAvailable,true);return fn(null);}active.add(name);try{return await fn({name});}finally{active.delete(name);}}},adapter=memory(),owner={accountId:'54',origin:'https://school.instructure.com'},a=environment({navigator:{locks}}).ReserveMedia.createStore(owner,{adapter}),b=environment({navigator:{locks}}).ReserveMedia.createStore(owner,{adapter}),blob=new Blob([new Uint8Array(30000000)],{type:'video/mp4'}),make=()=>({asset:asset({kind:'video',type:'video/mp4',width:1920,duration:60}),blob}),first=make(),other=make(),third=make(),hold=id();
 await a.putMany([first],{hold});await b.putMany([other]);let removed;await b.putMany([third],{confirm:async ids=>{removed=ids;return true;}});assert.deepEqual(Array.from(removed),[other.asset.mediaId]);assert.ok(await a.get(first.asset.mediaId));await a.release(hold);
 adapter.state.media.find(r=>r.asset.mediaId===first.asset.mediaId).holds=[id()];adapter.state.media.find(r=>r.asset.mediaId===first.asset.mediaId).createdAt=0;const fourth=make();await assert.rejects(b.putMany([fourth],{confirm:async()=>false}),/full/);assert.ok(await a.get(first.asset.mediaId));await b.putMany([fourth],{confirm:async ids=>{removed=ids;return true;}});assert.deepEqual(Array.from(removed),[first.asset.mediaId]);assert.equal(await a.get(first.asset.mediaId),null);
});
// Minimal IndexedDB request/transaction fixture. No DOM, browser or filesystem database.
function indexedFixture(){
 const tables=new Map();let opens=0,commits=0,aborts=0;const db={objectStoreNames:{contains:n=>tables.has(n)},createObjectStore(n){tables.set(n,new Map());return {createIndex(){}};},close(){},transaction(names,mode){const maps=new Map(names.map(n=>[n,new Map(structuredClone([...tables.get(n)]))]));let pending=0,ended=false;const tx={objectStore(n){return {index(){return {getAll(owner){pending++;const request={};queueMicrotask(()=>{if(ended)return;request.result=[...maps.get(n).values()].filter(r=>r.owner===owner);request.onsuccess();pending--;queueMicrotask(()=>{if(ended||pending)return;ended=true;if(mode==='readwrite'){for(const [name,rows]of maps)tables.set(name,rows);commits++;}tx.oncomplete?.();});});return request;}};},put(r){maps.get(n).set(r.key,structuredClone(r));},delete(key){maps.get(n).delete(key);}};},abort(){if(ended)return;ended=true;aborts++;queueMicrotask(()=>tx.onabort?.());}};return tx;}};
 return {api:{open(){opens++;const r={};queueMicrotask(()=>{r.result=db;r.onupgradeneeded?.();r.onsuccess();});return r;}},get opens(){return opens;},get commits(){return commits;},get aborts(){return aborts;},tables};
}
test('IndexedDB adapter upgrades stores, filters owners, commits bytes/kits atomically and aborts refusals',async()=>{
 const indexed=indexedFixture(),env=environment({indexedDB:indexed.api,ReserveCustomization:model}),a=env.ReserveMedia.createStore({accountId:'10',origin:'https://school.instructure.com'}),b=env.ReserveMedia.createStore({accountId:'11',origin:'https://school.instructure.com'}),photo={asset:asset(),blob:new Blob(['photo'],{type:'image/webp'})};await a.putMany([photo]);assert.ok(await a.get(photo.asset.mediaId));assert.equal(await b.get(photo.asset.mediaId),null);assert.deepEqual([...indexed.tables.keys()],['media','kits','meta']);
 const kit={id:id(),name:'Local',appearance:{bannerArt:photo.asset},accent:'clay',font:'system',bannerSize:'standard'};await a.saveKit(kit);assert.equal((await a.listKits()).length,1);assert.equal((await b.listKits()).length,0);const commits=indexed.commits;await assert.rejects(a.saveKit({...kit,id:id(),appearance:{titleArt:asset()}}),/missing/);assert.equal(indexed.commits,commits);assert.equal(indexed.aborts,1);assert.equal((await a.listKits()).length,1);await a.removeKit(kit.id);assert.equal((await a.listKits()).length,0);a.close();b.close();
});
test('storage cleaning accepts media and hex accent, refusing photo frames and injected accents',()=>{
 const storage=require('../extension/storage.js'),backup={format:'reserve-backup',version:1,data:{settings:{accent:'#d123ab',overviewArt:{bannerArt:asset(),titleArt:asset()}}}};assert.equal(storage.validateBackup(backup).settings.accent,'#d123ab');
 assert.throws(()=>model.cleanAppearance({borderArt:asset()}));assert.throws(()=>model.cleanAppearance({iconArt:asset()}));backup.data.settings.accent='url(https://evil.test)';assert.throws(()=>storage.validateBackup(backup));
});
function controllerHarness({reduced=false}={}){
 const doc=createDOM('<div id="rd"><div id="heading"></div></div>'),container=doc.getElementById('rd');container.ownerDocument=doc;doc.visibilityState='visible';const video=doc.createElement('video');video.setAttribute('data-ch-media',id());container.querySelector('#heading').append(video);video.readyState=2;video.currentTime=0;let plays=0,pauses=0,revoked=[],url=0,decode=0;
 video.play=()=>{plays++;return Promise.resolve();};video.pause=()=>{pauses++;};let intersection;const listeners=new Map(),query={matches:reduced,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
 const env=environment({document:doc,createImageBitmap:()=>{decode++;throw Error('must not decode');},matchMedia:()=>query,URL:{createObjectURL:()=>`blob:test-${++url}`,revokeObjectURL:v=>revoked.push(v)},IntersectionObserver:class{constructor(fn){intersection=fn;}observe(){}unobserve(){}disconnect(){this.disconnected=true;}}});
 const api=env.ReserveMedia,blob=new Blob(['local'],{type:'video/mp4'}),poster=new Blob(['frame'],{type:'image/webp'}),controller=api.createController(container,{get:async()=>({blob,poster})});controller.sync();
 return {doc,container,video,controller,query,async ready(){await settle();video.dispatchEvent({type:'loadeddata'});},visibility(v){doc.visibilityState=v;doc.dispatchEvent({type:'visibilitychange'});},intersect(v){intersection([{target:video,isIntersecting:v}]);},reduce(v){query.matches=v;listeners.get('change')?.();},get plays(){return plays;},get pauses(){return pauses;},get decode(){return decode;},revoked};
}
test('banner img/video markup escapes names and sets fit, muted, loop and inline playback',()=>{
 assert.match(media.render(asset(),{fit:'cover',position:'left'}),/^<img .*object-fit:cover;object-position:left/);
 const v=asset({kind:'video',type:'video/webm',duration:20});assert.match(media.render(v,{playback:true}),/^<video .* muted loop playsinline/);assert.doesNotMatch(media.render(v),/<video/);assert.match(media.render(v),/data-ch-poster/);assert.doesNotMatch(media.render(asset()),/src=/);
});
test('one connected banner plays silently only in view, pauses when hidden, and releases URLs',async()=>{
 const h=controllerHarness();await h.ready();assert.equal(h.plays,0);h.intersect(true);assert.equal(h.plays,1);assert.equal(h.video.muted,true);assert.equal(h.video.loop,true);assert.equal(h.video.playsInline,true);assert.equal(h.video.volume,0);
 h.visibility('hidden');assert.ok(h.pauses>0);h.visibility('visible');assert.equal(h.plays,2);h.intersect(false);const count=h.plays;h.visibility('visible');assert.equal(h.plays,count);h.intersect(true);assert.equal(h.plays,count+1);assert.equal(h.decode,0);
 h.controller.destroy();assert.equal(h.revoked.length,2);assert.equal(h.video.getAttribute('src'),null);
});
test('live reduced motion never autoplays and returns to the first frame',async()=>{
 const h=controllerHarness({reduced:true});await h.ready();h.intersect(true);assert.equal(h.plays,0);h.reduce(false);assert.equal(h.plays,1);h.video.currentTime=12;h.reduce(true);assert.equal(h.video.currentTime,0);assert.equal(h.plays,1);h.controller.destroy();
});
test('Artwork accepts banner media and title images, keeps SVG-only icon/border uploads, kit palette accents, kit actions and busy state',()=>{
 const art=require('../extension/custom-art.js'),env=vm.createContext({ReserveCustomization:model,ReserveCustomArt:art,ReserveMedia:media,ReserveCustomKits:require('../extension/custom-kits.js'),ReserveFeatures:{enabled:id=>!['quick-pack','pony'].includes(id)}});vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../extension/customize-ui.js'),'utf8'),env);
 const markup=env.ReserveCustomizeUI.render({s:{overviewArt:{bannerArt:asset()}},allCourses:[],courses:[],customizeOpen:true,customizeTab:'art',customizeBusy:true,kitName:'Mine',customKits:[{id:id(),name:'<script>bad</script>'}]}),doc=createDOM(markup);
 const accepts=kind=>doc.querySelector('input[data-kind="'+kind+'"]').getAttribute('accept').split(',');
 for(const kind of ['banner','title','border','icon'])for(const type of ['image/svg+xml','.svg'])assert.ok(accepts(kind).includes(type));
 for(const kind of ['border','icon'])assert.deepEqual(accepts(kind),['image/svg+xml','.svg']);
 for(const type of ['image/png','image/jpeg','image/webp','image/avif','image/gif','video/mp4','video/webm'])assert.ok(accepts('banner').includes(type));
 for(const type of ['image/png','image/webp'])assert.ok(accepts('title').includes(type));
 assert.ok(accepts('title').every(type=>!type.startsWith('video/')));
 assert.equal(doc.querySelectorAll('[data-rd-action="accent"]').length,3);
 assert.equal(doc.querySelector('[data-rd-field="kit-name"]').getAttribute('maxlength'),'40');
 for(const action of ['kit-save','kit-use','kit-export','kit-remove'])assert.ok(doc.querySelector('[data-rd-action="'+action+'"]').hasAttribute('disabled'));
 assert.equal(doc.querySelector('.ch-art-controls').getAttribute('aria-busy'),'true');
 assert.equal(doc.querySelectorAll('.ch-hint').length,0);
 assert.equal(doc.querySelectorAll('script').length,0);
 assert.match(markup,/&lt;script&gt;/);
});
test('inline kit assets expose isolated still references without requiring raw course media upload controls',()=>{
 const banner=asset({kind:'video',type:'video/mp4',width:1920,duration:15}),title=asset({width:600,height:200});assert.match(media.render(banner,{fit:'cover',position:'center'}),/^<img .*object-fit:cover;object-position:center/);assert.match(media.render(banner),/data-ch-poster/);assert.match(media.render(title,{kind:'title'}),/^<img /);assert.throws(()=>media.render(banner,{kind:'title'}));
});

test('the shared pack picker accepts only pack files and adds no raw media banner control',()=>{
 const ui=require('../extension/make-your-own.js'),markup=ui.render({busy:false},{makeYourOwn:{installed:{}}}),doc=createDOM(markup),input=doc.querySelector('[data-rd-field="make-file"]');assert.equal(input.getAttribute('accept'),'.chpack,.chkit,.chtheme,.chpet,.chpreset');assert.doesNotMatch(markup,/accept="[^"]*(?:video\/|image\/|\.mp4|\.webm)/);
});
