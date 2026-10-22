'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../extension/media-reference.js'),owner={origin:'https://school.instructure.com',accountId:'7'},id='12345678-1234-4234-8234-123456789abc';
const ref={mediaId:id,name:'Pack image',type:'image/png',kind:'image',width:64,height:32,palette:[]};
const doc={id:'local-garden',name:'Garden',kind:'theme',installedAt:1,source:JSON.stringify({format:'chtheme',version:1,name:'Garden'}),receipt:{kind:'theme',applications:[]}};
function fixture(){
 const base='reserve:market-media:'+JSON.stringify([owner.origin,owner.accountId]),key=base+':packs',data={[key]:{version:1,documents:[{id:doc.id,name:doc.name,kind:doc.kind,installedAt:doc.installedAt,bytes:Buffer.byteLength(JSON.stringify(doc))}]},[base+':pack:'+doc.id]:structuredClone(doc)},reads=[];
 const reader=R.createPackReader(owner,{storage:{async get(key){reads.push(key);return structuredClone(Object.hasOwn(data,key)?{[key]:data[key]}:{});}}});return {base,key,data,reads,reader};
}
test('Lite reference helper loads without media, DOM, IDB, timers, listeners or codecs',()=>{
 const calls=[],env=vm.createContext({URL,TextEncoder,structuredClone});
 for(const key of ['document','indexedDB','createImageBitmap','setTimeout','MutationObserver'])Object.defineProperty(env,key,{get(){calls.push(key);throw Error('Unexpected '+key);}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/media-reference.js'),'utf8'),env);
 assert.deepEqual(JSON.parse(JSON.stringify(env.ReserveMediaReference.cleanReference(ref))),ref);assert.deepEqual(calls,[]);assert.equal(env.ReserveMedia,undefined);
});
test('the full store and Lite helper share the exact same reference and document validators',()=>{
 const M=require('../extension/media-store.js');for(const key of ['cleanReference','referenced','cleanPackDocument','validateVideo'])assert.equal(M[key],R[key],key);
 const clean=R.cleanReference({...ref,palette:['#AABBCC','#112233','#123456']});assert.deepEqual(clean.palette,['#aabbcc','#112233','#123456']);assert.deepEqual([...R.referenced({overviewArt:{bannerArt:ref},coursePrefs:{'1':{titleArt:ref}}})],[id]);
});
test('saved references retain slot, type, dimensions, palette and duration limits',()=>{
 for(const value of [{...ref,type:'text/html'},{...ref,kind:'video'},{...ref,width:2401},{...ref,height:16001},{...ref,duration:1},{...ref,palette:['#123456']},{...ref,url:'https://outside.test/a'},{...ref,name:'bad\u202ename'}])assert.throws(()=>R.cleanReference(value));
 const video={...ref,type:'video/mp4',kind:'video',duration:60,width:1920};assert.equal(R.cleanReference(video).duration,60);assert.throws(()=>R.cleanReference(video,'title'));assert.throws(()=>R.validateVideo({...video,duration:61,size:1}));assert.equal(R.cleanReference({...video,duration:61}).duration,61);assert.throws(()=>R.cleanReference({...video,duration:R.limits.sourceDuration+1}));
});
test('the read-only document reader returns detached sources and receipts without fetching media',async()=>{
 const h=fixture();assert.deepEqual(await h.reader.listPacks(),[{id:doc.id,name:doc.name,kind:doc.kind,installedAt:doc.installedAt}]);const loaded=await h.reader.getPack(doc.id);assert.deepEqual(loaded,doc);loaded.name='Changed';assert.equal((await h.reader.getPack(doc.id)).name,doc.name);assert.equal(await h.reader.getPack('missing'),null);
 assert.ok(h.reads.every(key=>key===h.key||key===h.base+':pack:'+doc.id));assert.equal(h.reader.updatePacks,undefined);assert.equal(h.reader.putMany,undefined);h.reader.close();
});
test('Lite refuses corrupt indexes, cross-account rows and incomplete document byte counts',async()=>{
 for(const mutate of [h=>h.data[h.key].documents.push(h.data[h.key].documents[0]),h=>h.data[h.key].documents[0].kind='code',h=>h.data[h.key].documents[0].bytes=60000001,h=>h.data[h.key].code='run',h=>h.data[h.base+':pack:'+doc.id].name='Other',h=>h.data[h.key].documents[0].bytes++,h=>delete h.data[h.base+':pack:'+doc.id]]){const h=fixture();mutate(h);await assert.rejects(h.reader.getPack(doc.id));}
 const h=fixture(),other=R.createPackReader({...owner,accountId:'8'},{storage:{get:async key=>Object.hasOwn(h.data,key)?{[key]:h.data[key]}:{}}});assert.deepEqual(await other.listPacks(),[]);
 for(const value of [{...owner,origin:'https://user@school.instructure.com'},{...owner,origin:'https://school.instructure.com/path'},{...owner,accountId:'7:8'},{...owner,origin:'http://school.instructure.com'}])assert.throws(()=>R.createPackReader(value));
});
test('receipt validation rejects unsafe paths, deep data and document changes without mutation',()=>{
 const input=structuredClone(doc),bad=structuredClone(doc);bad.receipt=JSON.parse('{"kind":"theme","applications":[],"__proto__":{"x":1}}');assert.throws(()=>R.cleanPackDocument(bad),/receipt/);assert.throws(()=>R.cleanPackDocument({...doc,code:'run'}),/stored pack/);assert.deepEqual(R.cleanPackDocument(input),doc);assert.deepEqual(input,doc);
});

test('Lite validates complete frames, new slots and theme art without loading rendering support',()=>{
 const attempts=[],env=vm.createContext({URL,TextEncoder,structuredClone});for(const key of ['ReserveMedia','ReserveMediaFrame','document','indexedDB','createImageBitmap','setTimeout','MutationObserver'])Object.defineProperty(env,key,{get(){attempts.push(key);throw Error('Unexpected '+key);}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/media-reference.js'),'utf8'),env);const api=env.ReserveMediaReference,video={...ref,type:'video/mp4',kind:'video',duration:120},frame={asset:video,fit:'contain',focus:{x:.8,y:.2},zoom:2,height:'tall',loop:{start:65,end:80},still:72};
 assert.deepEqual(JSON.parse(JSON.stringify(api.cleanFrame(frame,a=>api.cleanReference(a,'card')))),frame);assert.deepEqual([...api.referenced({themeArt:{backgroundArt:frame},overviewArt:{cardArt:frame},customKits:[{appearance:{bannerArt:frame}}]})],[id]);assert.deepEqual(attempts,[]);
 assert.equal(api.cleanReference({...ref,width:3840},'background').width,3840);assert.throws(()=>api.cleanReference({...ref,width:3840},'banner'));
 for(const type of ['image/gif','image/webp'])assert.equal(api.cleanReference({...ref,type,animated:true},'card').animated,true);
});

test('saved frames reject accessors, custom prototypes and out-of-duration timing without touching getters',()=>{
 const video={...ref,type:'video/mp4',kind:'video',duration:120},frame={asset:video,focus:{x:.5,y:.5},zoom:1,fit:'cover',height:'medium',loop:{start:30,end:60},still:50};let reads=0;
 const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){reads++;throw Error('Getter ran');}});getter.y=.5;
 for(const value of [{...frame,url:'https://outside.test'},Object.assign(Object.create({}),frame),{...frame,focus:getter},{...frame,focus:{x:-.1,y:.5}},{...frame,zoom:4.01},{...frame,height:'huge'},{...frame,loop:{start:0,end:61}},{...frame,loop:{start:119,end:121}},{...frame,still:121},{...frame,asset:ref}])assert.throws(()=>R.cleanFrame(value));assert.equal(reads,0);
 const selection=R.videoTiming(120,{loop:{start:70,end:80},still:75});assert.deepEqual(selection,{loop:{start:70,end:80},still:75});R.validateVideo({size:1,width:64,height:32,duration:120},selection);assert.throws(()=>R.validateVideo({size:1,width:64,height:32,duration:120}));
});

test('reference retention stays bounded to named slots and retains framed rollback references',()=>{
 const frame={asset:ref,focus:{x:.5,y:.5},zoom:1,fit:'cover',height:'medium'},settings={customKits:[{appearance:{backgroundArt:frame}}]};settings.ignored=settings;assert.deepEqual([...R.referenced(settings)],[id]);
 const key='reserve:v1:'+owner.origin+':'+owner.accountId,receipt={kind:'course-art',key,changes:[{path:['themeArt'],key:'backgroundArt',beforeOwn:true,before:frame}]};assert.deepEqual(R.undoMediaReferences({saved:receipt},owner),[ref]);
 assert.deepEqual(R.undoMediaReferences({saved:{...receipt,key:key+'wrong'}},owner),[]);assert.throws(()=>R.undoMediaReferences({saved:{...receipt,changes:[{...receipt.changes[0],path:['tasks','1']}]}},owner));
 const current={assets:[{asset:ref,bytes:{type:ref.type,size:1,sha256:'a'}}],kits:[{id:'kit',appearance:{backgroundArt:frame}}]},incoming=structuredClone(current);incoming.assets[0].bytes.sha256='b';assert.deepEqual(R.backupConflicts(incoming,current),{mediaIds:[id],kitIds:['kit']});
});
