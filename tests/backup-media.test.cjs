'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../extension/backup-media.js'),F=require('./backup-media-fixture.cjs');
const {owner,scope,id,clone,plain,png,asset,wire,row,payload,kit,settings,localRow,stored,localStore,shared,environment,indexed}=F;
const empty=()=>({read:async()=>undefined});

test('loading the pure helper does not discover storage, touch DOM, decode media, create URLs or start work',()=>{
 const attempts=[],blocked=label=>({get(){attempts.push(label);throw Error(label);}}),extra={};
 for(const key of ['document','indexedDB','chrome','localStorage','createImageBitmap','setInterval','setTimeout','fetch'])Object.defineProperty(extra,key,blocked(key));
 // Install getters after context construction, then evaluate the module again.
 const {env}=environment();for(const key of Object.getOwnPropertyNames(extra))Object.defineProperty(env,key,Object.getOwnPropertyDescriptor(extra,key));
 require('node:vm').runInContext(require('node:fs').readFileSync(require.resolve('../extension/backup-media.js'),'utf8'),env);
 assert.deepEqual(attempts,[]);assert.equal(typeof env.ReserveBackupMedia.capture,'function');
});

test('fresh accounts export no media payload for undefined or legacy-null missing KV',async()=>{
 for(const missing of [undefined,null]){const {api}=environment(),adapter={read:async()=>missing};assert.equal(await api.capture({owner,settings:{},adapter}),undefined);}
 assert.equal(await B.validate(undefined,{settings:{}}),undefined);
 assert.deepEqual(await B.validate(payload([],[])),payload([],[]));
});

test('invalid owners reject before any adapter or IndexedDB read',async()=>{
 let reads=0;const adapter={read:async()=>{reads++;}};
 for(const bad of [undefined,null,{}, {...owner,origin:'http://school.instructure.com'},{...owner,origin:owner.origin+'/'},{...owner,origin:'https://user:secret@school.instructure.com'},{...owner,origin:'https://school.instructure.com:8443'},{...owner,accountId:7},{...owner,accountId:'7/8'},{...owner,extra:true}])await assert.rejects(B.capture({owner:bad,adapter}),/owner|HTTPS|account/i);
 assert.equal(reads,0);
});

test('shared v2 capture reads exact indexed byte records, adds hashes and keeps held unreferenced assets',async()=>{
 const a=asset(1),h=shared([row(1),row(2)]),before=clone([...h.values]);const result=await B.capture({owner,settings:settings(a),adapter:h.adapter});
 assert.deepEqual(result.assets.map(r=>r.asset.mediaId),[id(1),id(2)]);assert.equal(result.assets[0].bytes.sha256,wire().sha256);assert.deepEqual(result.assets[1],row(2));
 assert.doesNotMatch(JSON.stringify(result),/createdAt|holds|owner|reserve:market-media/);assert.deepEqual([...h.values],before);assert.ok(h.reads.includes(h.base+':asset:'+id(2)));
});

test('legacy v1 inline pool and nullable missing v2 index are captured without migration',async()=>{
 const h=shared([row()],[],{legacy:true,missing:null}),result=await B.capture({owner,adapter:h.adapter});assert.deepEqual(result.assets,[row()]);assert.ok(h.reads.includes(h.base));assert.equal(h.reads.some(k=>k.includes(':asset:')),false);
});

test('a published v2 index takes precedence over stale legacy pool bytes',async()=>{
 const h=shared([row()]);h.values.set(h.base,{version:1,unsafe:'old interrupted migration'});assert.equal((await B.capture({owner,adapter:h.adapter})).assets.length,1);assert.equal(h.reads.includes(h.base),false);
});

test('local reader seam captures current refs, every named kit, inline SVG and enumerable undo-held assets',async()=>{
 const current=asset(1),kitRef=asset(2),unused=asset(3),k=kit(100,{bannerArt:kitRef,borderArt:{name:'Frame.svg',svg:'<svg><path d="M0 0L2 2"/></svg>'}}),local=localStore([localRow(current),localRow(kitRef),localRow(unused)],[k]);
 const result=await B.capture({owner,settings:settings(current),adapter:empty(),localStore:local.api});assert.deepEqual(result.assets.map(r=>r.asset.mediaId),[id(1),id(2),id(3)]);assert.equal(result.kits[0].id,k.id);assert.match(result.kits[0].appearance.borderArt.svg,/<path/);assert.equal(result.kits[0].accent,'#123abc');
});

test('local seam without enumeration reads known settings and kit refs without claiming inventory enumeration',async()=>{
 const k=kit(100,{titleArt:asset(2)}),local=localStore([localRow(asset(1)),localRow(asset(2))],[k],{enumerate:false});
 const result=await B.capture({owner,settings:settings(asset()),adapter:empty(),localStore:local.api});assert.equal(result.assets.length,2);assert.equal(local.calls.some(c=>c[0]==='assets'),false);assert.deepEqual(new Set(local.calls.filter(c=>c[0]==='get').map(c=>c[1])),new Set([id(1),id(2)]));
});

test('reference and id listAssets seams retrieve records through get and verify returned ids',async()=>{
 for(const listing of [[asset()],[id(1)]]){const local=localStore([localRow()],[],{listing});assert.equal((await B.capture({owner,adapter:empty(),localStore:local.api})).assets[0].asset.mediaId,id(1));}
 const local=localStore([localRow(asset(2))],[],{listing:[id(1)]});await assert.rejects(B.capture({owner,adapter:empty(),localStore:local.api}),/listed local asset is missing/);
});

test('default page reader opens only an existing database, reads both owner indexes readonly and closes it',async()=>{
 const k=kit(100,{titleArt:asset()}),db=indexed([stored(localRow()),stored(localRow(asset(2)))],[{key:scope(owner)+':'+k.id,owner:scope(owner),kit:k}]),{api}=environment({indexedDB:db.api});
 const result=await api.capture({owner,adapter:empty()});assert.equal(result.assets.length,2);assert.equal(result.kits.length,1);assert.deepEqual(db.calls.find(c=>c[0]==='open'),['open','reserve-media-v1']);assert.deepEqual(plain(db.calls.find(c=>c[0]==='transaction')),['transaction',['media','kits'],'readonly']);assert.ok(db.calls.filter(c=>c[0]==='getAll').every(c=>c[2]===scope(owner)));assert.equal(db.closes,1);assert.equal(db.upgradeAborts,0);
});

test('missing local database is never opened or created; a deletion race aborts the implicit upgrade',async()=>{
 const absent=indexed([],[],{listed:false}),a=environment({indexedDB:absent.api});assert.equal(await a.api.capture({owner,adapter:empty()}),undefined);assert.equal(absent.calls.some(c=>c[0]==='open'),false);
 const race=indexed([],[],{raceMissing:true}),b=environment({indexedDB:race.api});assert.equal(await b.api.capture({owner,adapter:empty()}),undefined);assert.equal(race.upgradeAborts,1);
});

test('worker realm does not even access IndexedDB and uses only shared KV',async()=>{
 let accesses=0;const {env,api}=environment({importScripts(){throw Error('must not call importScripts');}});Object.defineProperty(env,'indexedDB',{get(){accesses++;throw Error('worker IDB is forbidden');}});
 const h=shared([row()]);assert.equal((await api.capture({owner,adapter:h.adapter})).assets.length,1);assert.equal(accesses,0);
});

test('concurrent page captures retain their own owner scope',async()=>{
 const other={...owner,accountId:'8'},db=indexed([stored(localRow(asset(1))),stored(localRow(asset(2)),other)]),{api}=environment({indexedDB:db.api});
 const [a,b]=await Promise.all([api.capture({owner,adapter:empty()}),api.capture({owner:other,adapter:empty()})]);assert.deepEqual(plain(a.assets.map(r=>r.asset.mediaId)),[id(1)]);assert.deepEqual(plain(b.assets.map(r=>r.asset.mediaId)),[id(2)]);assert.equal(db.closes,2);
});

test('incomplete local reads and unsafe discovery fail explicitly instead of omitting local inventory',async()=>{
 const db=indexed([],[],{readError:true}),{api}=environment({indexedDB:db.api});await assert.rejects(api.capture({owner,adapter:empty()}),/read local/);assert.equal(db.closes,1);
 await assert.rejects(environment({indexedDB:{open(){throw Error('must not create a database');}}}).api.capture({owner,adapter:empty()}),/safely discover/);
});

test('foreign source owner, key mismatch, duplicate source rows and unknown source fields reject',async()=>{
 for(const change of [r=>{r.owner=scope({...owner,accountId:'8'});},r=>{r.key+='wrong';},r=>{r.script='unsafe';}]){const h=shared([row()]);change(h.values.get(h.base+':index').media[0]);await assert.rejects(B.capture({owner,adapter:h.adapter}),/owner|Unknown|id/i);}
 const h=shared([row()]);h.values.get(h.base+':index').media.push(clone(h.index.media[0]));await assert.rejects(B.capture({owner,adapter:h.adapter}),/Duplicate/);
 const db=indexed([stored(localRow(),{...owner,accountId:'8'})],[],{leakForeign:true});await assert.rejects(environment({indexedDB:db.api}).api.capture({owner,adapter:empty()}),/owner/);
});

test('missing settings and named-kit media fail capture and validation',async()=>{
 await assert.rejects(B.capture({owner,settings:settings(asset()),adapter:empty()}),/Required media is missing/);await assert.rejects(B.validate(undefined,{settings:settings(asset())}),/Required media/);
 await assert.rejects(B.validate(payload([], [kit(100,{bannerArt:asset()})])),/Required media/);
 const local=localStore([], [kit(100,{titleArt:asset()})]);await assert.rejects(B.capture({owner,adapter:empty(),localStore:local.api}),/Required media/);
});

test('all referenced metadata must match its stored asset and media cannot occupy icon or frame slots',async()=>{
 for(const ref of [asset(1,{width:2}),asset(1,{palette:['#111111','#222222','#333333']}),asset(1,{name:'Different'})])await assert.rejects(B.validate(payload(),{settings:settings(ref)}),/metadata does not match/);
 await assert.rejects(B.validate(payload(),{settings:{overviewArt:{iconArt:asset()}}}),/media reference|artwork type/i);
});

test('payload duplicates reject even when equal; exact cross-pool copies merge with original media and kit ids',async()=>{
 await assert.rejects(B.validate(payload([row(),row()])),/Duplicate/);await assert.rejects(B.validate(payload([], [kit(),kit()])),/Duplicate/);
 const k=kit(100,{bannerArt:asset()}),h=shared([row()],[k]),local=localStore([localRow()],[k]),result=await B.capture({owner,adapter:h.adapter,localStore:local.api});assert.equal(result.assets.length,1);assert.equal(result.kits.length,1);assert.equal(result.assets[0].asset.mediaId,id(1));assert.equal(result.kits[0].id,k.id);
});

test('conflicting cross-pool bytes, metadata and kit records fail rather than choosing a source',async()=>{
 const different=Buffer.from(png);different[25]^=1;const h=shared([row()]);await assert.rejects(B.capture({owner,adapter:h.adapter,localStore:localStore([localRow(asset(),different)]).api}),/Conflicting duplicate media bytes/);
 await assert.rejects(B.capture({owner,adapter:h.adapter,localStore:localStore([localRow(asset(1,{width:2}))]).api}),/Conflicting duplicate media id/);
 const h2=shared([], [kit()]);await assert.rejects(B.capture({owner,adapter:h2.adapter,localStore:localStore([], [{...kit(),name:'Changed'}]).api}),/Conflicting duplicate kit id/);
});

test('local duplicate inventory and a listed-but-missing record reject',async()=>{
 await assert.rejects(B.capture({owner,adapter:empty(),localStore:localStore([localRow(),localRow()]).api}),/Duplicate local/);
 await assert.rejects(B.capture({owner,adapter:empty(),localStore:localStore([],[],{listing:[id(1)]}).api}),/listed local asset is missing/);
});

test('tampered payload or preexisting shared SHA-256 rejects before any inspector runs',async()=>{
 const p=payload(),changed=Buffer.from(png);changed[20]^=1;p.assets[0].bytes.data=changed.toString('base64');let calls=0;await assert.rejects(B.validate(p,{inspect:()=>{calls++;}}),/SHA-256 mismatch/);assert.equal(calls,0);
 const h=shared([row()],[],{digests:true});h.values.get(h.base+':asset:'+id(1)).blob.sha256='0'.repeat(64);await assert.rejects(B.capture({owner,adapter:h.adapter}),/SHA-256 mismatch/);
});

test('every asset and poster digest is checked before the first binary inspection',async()=>{
 const p=payload([row(1),row(2)]);p.assets[1].bytes.sha256='0'.repeat(64);let calls=0;await assert.rejects(B.validate(p,{inspect:()=>{calls++;}}),/SHA-256 mismatch/);assert.equal(calls,0);
 const v=asset(3,{name:'Clip.mp4',type:'video/mp4',kind:'video',duration:3}),video={asset:v,bytes:wire(Buffer.from('saved clip'),'video/mp4'),poster:wire()};video.poster.sha256='0'.repeat(64);
 await assert.rejects(B.validate(payload([video]),{inspect:()=>{calls++;}}),/SHA-256 mismatch/);assert.equal(calls,0);
});

test('optional pure inspection verifies actual container metadata after hashes',async()=>{
 const inspect=require('../extension/media-store.js').inspectPortable;assert.equal((await B.validate(payload(),{inspect})).assets[0].asset.width,1);
 await assert.rejects(B.validate(payload([row(1,{asset:asset(1,{width:2})})]),{inspect}),/Inspected media metadata/);
});

test('optional video poster roundtrips through capture and decode without media decoding or object URLs',async()=>{
 const ref=asset(3,{name:'Clip.mp4',type:'video/mp4',kind:'video',duration:3}),bytes=Buffer.from('checked saved video fixture'),local=localStore([localRow(ref,bytes,png)]),result=await B.capture({owner,adapter:empty(),localStore:local.api}),decoded=await B.decode(result);
 assert.equal(result.assets[0].poster.sha256,wire().sha256);assert.equal(decoded.assets[0].asset.mediaId,ref.mediaId);assert.equal(decoded.assets[0].blob.type,'video/mp4');assert.deepEqual(Buffer.from(await decoded.assets[0].blob.arrayBuffer()),bytes);assert.deepEqual(Buffer.from(await decoded.assets[0].poster.arrayBuffer()),png);
 await assert.rejects(B.validate(payload([row(1,{poster:wire()})])),/Only video/);
});

test('canonical base64 rejects whitespace, wrong padding, nonzero unused bits and malformed hash fields',async()=>{
 const small=row(1,{bytes:wire(Buffer.from([1]))});for(const data of ['AR==','AQ=','AQ===','A Q=','AQ\n=','AQ-_']){const p=payload([clone(small)]);p.assets[0].bytes.data=data;await assert.rejects(B.validate(p),/base64/i);}
 for(const sha256 of ['bad','A'.repeat(64),null,0]){const p=payload();p.assets[0].bytes.sha256=sha256;await assert.rejects(B.validate(p),/SHA-256/);}
});

test('unknown fields, accessors and custom prototypes reject throughout the portable schema',async()=>{
 const cases=[p=>{p.script=true;},p=>{p.assets[0].url='https://outside.test';},p=>{p.assets[0].asset.url='https://outside.test';},p=>{p.assets[0].bytes.command='run';},p=>{p.kits=[{...kit(),code:'no'}];},p=>{p.kits=[kit(100,{extra:true})];},p=>{p.kits=[kit(100,{borderArt:{name:'Frame.svg',svg:'<svg/>',script:'no'}})];},p=>{Object.setPrototypeOf(p.assets[0],{unexpected:true});},p=>{Object.defineProperty(p.assets[0].asset,'name',{enumerable:true,get(){throw Error('Accessor must not execute');}});}];
 for(const change of cases){const p=payload();change(p);await assert.rejects(B.validate(p),/Unknown|Too many fields|plain data|enumerable data/);}
});

test('invalid types, dimensions, UUIDs, palette and individual byte budgets reject',async()=>{
 for(const extra of [{type:'text/html'},{mediaId:'https://outside.test'},{width:require('../extension/media-reference.js').limits.backgroundWidth+1},{palette:['red']},{duration:5}])await assert.rejects(B.validate(payload([row(1,{asset:asset(1,extra)})])));
 for(const change of [{type:'image/jpeg'},{size:3000001},{size:0},{size:Infinity}])await assert.rejects(B.validate(payload([row(1,{bytes:{...wire(),...change}})])),/type or byte size/);
 await assert.rejects(B.validate(payload([], [kit(100,{bannerPosition:null})])),/bannerPosition/);
});

test('combined raw byte budget refuses before fetching any shared asset bodies',async()=>{
 const refs=[1,2,3].map(n=>asset(n,{name:'Clip.mp4',type:'video/mp4',kind:'video',duration:3})),h=shared([]);h.values.get(h.base+':index').media=refs.map(ref=>({key:scope(owner)+':'+ref.mediaId,owner:scope(owner),asset:ref,createdAt:1,holds:[],blob:{type:'video/mp4',size:25000000}}));
 await assert.rejects(B.capture({owner,adapter:h.adapter}),/Combined media/);assert.equal(h.reads.some(k=>k.includes(':asset:')),false);
});

test('encoded file budget is checked before reading bodies despite a permitted raw byte total',async()=>{
 const h=shared([]);h.values.get(h.base+':index').media=[1,2].map(n=>{const ref=asset(n,{name:'Clip.mp4',type:'video/mp4',kind:'video',duration:3});return {key:scope(owner)+':'+ref.mediaId,owner:scope(owner),asset:ref,createdAt:1,holds:[],blob:{type:'video/mp4',size:26000000}};});
 await assert.rejects(B.capture({owner,adapter:h.adapter}),/Encoded media backup file byte budget/);assert.equal(h.reads.some(k=>k.includes(':asset:')),false);
});

test('multiple kits may exceed 2 MiB of aggregate SVG while each kit and overall metadata remain bounded',async()=>{
 const svg='<svg><text>'+('A'.repeat(220000))+'</text></svg>',look=Object.fromEntries(['bannerArt','titleArt','borderArt','iconArt'].map(key=>[key,{name:key+'.svg',svg}])),kits=[kit(100,look),kit(101,look),kit(102,look)];
 const result=await B.validate(payload([],kits),{settings:{overviewArt:look,coursePrefs:{'1':look}}});assert.equal(result.kits.length,3);assert.ok(Buffer.byteLength(JSON.stringify(result))>2*1024*1024);assert.ok(Buffer.byteLength(JSON.stringify(result))<B.limits.metadataBytes);
 const local=localStore([],kits);assert.equal((await B.capture({owner,adapter:empty(),localStore:local.api})).kits.length,3);
 const h=shared([],kits);assert.equal((await B.capture({owner,adapter:h.adapter})).kits.length,3);
});

test('capture preserves the existing 200-kit inventory limit for shared and owner-indexed local storage',async()=>{
 const kits=Array.from({length:200},(_,i)=>kit(100+i)),h=shared([],kits);assert.equal((await B.capture({owner,adapter:h.adapter})).kits.length,200);
 const db=indexed([],kits.map(k=>({key:scope(owner)+':'+k.id,owner:scope(owner),kit:k}))),{api}=environment({indexedDB:db.api});assert.equal((await api.capture({owner,adapter:empty()})).kits.length,200);
 h.index.kits.push({key:scope(owner)+':'+id(400),owner:scope(owner),kit:kit(400)});await assert.rejects(B.capture({owner,adapter:h.adapter}),/oversized shared kits/);
});

test('per-SVG, current settings SVG and whole-inventory metadata budgets remain enforced',async()=>{
 await assert.rejects(B.validate(payload([], [kit(100,{borderArt:{name:'Huge.svg',svg:'<svg><text>'+('A'.repeat(262144))+'</text></svg>'}})])),/SVG file byte budget/);
 const svg='<svg><text>'+('B'.repeat(240000))+'</text></svg>',look=Object.fromEntries(['bannerArt','titleArt','borderArt','iconArt'].map(key=>[key,{name:key+'.svg',svg}]));
 const kits=Array.from({length:7},(_,i)=>kit(100+i,look));await assert.rejects(B.validate(payload([],kits)),/Metadata byte budget/);
 const h=shared([],kits);await assert.rejects(B.capture({owner,adapter:h.adapter}),/Metadata byte budget/);assert.equal(h.reads.some(key=>key.includes(':asset:')),false);
 await assert.rejects(B.validate(payload([],[]),{settings:{coursePrefs:{'1':look,'2':look,'3':look}}}),/Aggregate SVG byte budget/);
});

test('SVG validation rejects executable or external kit artwork rather than shipping it in metadata',async()=>{
 for(const svg of ['<svg><script>alert(1)</script></svg>','<svg><image href="https://outside.test/a.png"/></svg>'])await assert.rejects(B.validate(payload([], [kit(100,{borderArt:{name:'Unsafe.svg',svg}})])));
});

test('shared changes during capture reject rather than publishing a mixed snapshot',async()=>{
 const h=shared([row()]),read=h.adapter.read;let indexReads=0;h.adapter.read=async key=>{if(key===h.base+':index'&&++indexReads===2)h.values.get(key).meta[0].revision=id(992);return read(key);};await assert.rejects(B.capture({owner,adapter:h.adapter}),/changed during capture/);
});

test('returned payload is clean data independent of caller records and decode validates before allocating blobs',async()=>{
 const p=payload([row()], [kit(100,{titleArt:asset()})]),result=await B.validate(p);result.assets[0].asset.name='Other';assert.equal(p.assets[0].asset.name,'Pixel.png');result.kits[0].appearance.titleArt.palette.push('#111111');assert.deepEqual(p.kits[0].appearance.titleArt.palette,[]);
 const bad=payload();bad.assets[0].bytes.sha256='0'.repeat(64);await assert.rejects(B.decode(bad),/SHA-256 mismatch/);
});

test('framed theme, overview, course and named kit media survive pure capture, validation and decode',async()=>{
 const frame=asset=>({asset,fit:'contain',focus:{x:.8,y:.2},zoom:2,height:'tall'}),first=asset(1),wide=asset(2,{width:3840}),look={bannerArt:frame(first),cardArt:frame(first),backgroundArt:frame(wide)},k=kit(100,look),local=localStore([localRow(first),localRow(wide)],[k],{enumerate:false}),saved={themeArt:{backgroundArt:frame(wide)},overviewArt:{cardArt:frame(first)},coursePrefs:{'12':{bannerArt:frame(first)}}};
 const captured=await B.capture({owner,settings:saved,adapter:empty(),localStore:local.api}),checked=await B.validate(captured,{settings:saved}),decoded=await B.decode(checked,{settings:saved});assert.equal(captured.assets.length,2);assert.deepEqual(captured.kits[0].appearance.cardArt,look.cardArt);assert.deepEqual(captured.kits[0].appearance.backgroundArt,look.backgroundArt);assert.deepEqual(checked,captured);assert.deepEqual(decoded.kits,captured.kits);assert.deepEqual(Buffer.from(await decoded.assets[0].blob.arrayBuffer()),png);
 const absent=clone(captured);absent.assets=absent.assets.filter(row=>row.asset.mediaId!==wide.mediaId);await assert.rejects(B.validate(absent,{settings:saved}),/Required media/);
});

test('framed video selections and animated artwork posters retain exact backup bytes and metadata',async()=>{
 const animated=asset(1,{type:'image/gif',animated:true}),video=asset(2,{type:'video/mp4',kind:'video',duration:120}),still=wire(),p=payload([{asset:animated,bytes:wire(Buffer.from('animation'),'image/gif'),poster:still},{asset:video,bytes:wire(Buffer.from('source movie'),'video/mp4'),poster:still}],[kit(100,{cardArt:{asset:animated,fit:'cover',focus:{x:.5,y:.5},zoom:1,height:'small'},backgroundArt:{asset:video,fit:'cover',focus:{x:.2,y:.7},zoom:3,height:'tall',loop:{start:65,end:80},still:72}})]);
 const clean=await B.validate(p),decoded=await B.decode(clean);assert.equal(decoded.assets[0].asset.animated,true);assert.equal(decoded.assets[1].asset.duration,120);assert.deepEqual(decoded.kits[0].appearance.backgroundArt,p.kits[0].appearance.backgroundArt);assert.deepEqual(Buffer.from(await decoded.assets[0].poster.arrayBuffer()),png);assert.equal(await decoded.assets[1].blob.text(),'source movie');
 const corrupt=clone(p);corrupt.assets[0].poster.sha256='0'.repeat(64);let inspections=0;await assert.rejects(B.validate(corrupt,{inspect(){inspections++;}}),/SHA-256 mismatch/);assert.equal(inspections,0);
});

test('backup frames use the pure schema and reject unsafe nested data without renderer access',async()=>{
 const frame={asset:asset(),fit:'cover',focus:{x:.5,y:.5},zoom:1,height:'medium'},p=payload([row()],[kit(100,{backgroundArt:frame})]),{env,api}=environment();for(const key of ['ReserveMedia','ReserveMediaFrame','document','createImageBitmap','indexedDB'])Object.defineProperty(env,key,{get(){assert.fail('Pure frame validation must not access '+key);}});
 assert.deepEqual(plain(await api.validate(p)),await B.validate(p));
 for(const change of [f=>{f.focus.x=1.1;},f=>{f.zoom=5;},f=>{f.url='https://outside.test';},f=>{f.loop={start:0,end:1};},f=>{Object.defineProperty(f.focus,'x',{enumerable:true,get(){assert.fail('Getter must not run');}});}]){const bad=clone(p);change(bad.kits[0].appearance.backgroundArt);await assert.rejects(B.validate(bad));}
 await assert.rejects(B.validate(payload([row()],[kit(100,{titleArt:frame})])),/framed artwork slot/);
});
