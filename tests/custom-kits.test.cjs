'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash,randomUUID,webcrypto}=require('node:crypto');
const saved=new Map(['ReserveCustomArt','ReserveCustomKits','ReserveMedia'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
after(()=>{for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});
const Art=require('../extension/custom-art.js'),filename=path.join(__dirname,'../extension/custom-kits.js');
let Kits;
function api(){assert.ok(fs.existsSync(filename),'custom-kits.js must implement the kit codec');return Kits||(Kits=require(filename));}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const svg=body=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">'+body+'</svg>';
const bytes=Buffer.from([0,1,2,127,128,254,255]);
const asset=(data=bytes,type='image/png',name='photo.png')=>({name,type,data:Buffer.from(data).toString('base64'),sha256:hash(data)});
const document=(assets={})=>({version:1,name:'My kit',assets,accent:'clay',font:'system',bannerSize:'standard',bannerFit:'contain',bannerPosition:'right',titlePlacement:'separate'});
function file(doc,name='test.chkit'){const blob=new Blob([typeof doc==='string'?doc:JSON.stringify(doc)],{type:'application/json'});if(name!==undefined)Object.defineProperty(blob,'name',{value:name});return blob;}
function ref(type='image/png',extra={}){const video=type.startsWith('video/');return {mediaId:randomUUID(),name:video?'clip.mp4':'photo.png',type,kind:video?'video':'image',width:320,height:180,...(video?{duration:12}:{}),palette:['#123456','#abcdef','#345678'],...extra};}
function store(asset,blob=new Blob([bytes],{type:asset.type})){return {async get(id){return id===asset.mediaId?{asset,blob}:null;},putMany(){assert.fail('codec must not persist media');}};}
// Explicit UNIT fake: exercises kit bytes, hashes and ReserveMedia routing. It
// deliberately does not claim to decode pictures, inspect videos or render UI.
function fakeMedia(calls=[]){return {async prepare(blob,slot,name){calls.push({slot,name,type:blob.type,bytes:Buffer.from(await blob.arrayBuffer())});const type=['image/jpeg','image/gif'].includes(blob.type)?'image/webp':blob.type;return {asset:ref(type,{name}),blob:new Blob([await blob.arrayBuffer()],{type})};}};}
function sandbox(extra={}){api();const context=vm.createContext({Blob,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,atob,btoa,ReserveCustomArt:Art,ReserveMediaReference:require('../extension/media-reference.js'),...extra});vm.runInContext(fs.readFileSync(filename,'utf8'),context);return context;}

test('CommonJS and dependency-free global codec expose the same API and immutable file limit',()=>{
 const kits=api();assert.equal(globalThis.ReserveCustomKits,kits);assert.deepEqual(kits.limits,{fileBytes:40000000});assert.ok(Object.isFrozen(kits.limits));
 const browser=sandbox();for(const key of ['capture','exportKit','importKit'])assert.equal(typeof browser.ReserveCustomKits[key],'function');
});

test('capture normalizes an isolated local snapshot with existing defaults and fresh IDs',async()=>{
 const input={bannerArt:{name:' art.svg ',svg:'<svg><circle r="4"/></svg>'}},original=structuredClone(input);
 const kit=await api().capture('  Studio  ',input,{}),again=await api().capture('Studio',{},{});
 assert.match(kit.id,/^[0-9a-f-]{36}$/);assert.notEqual(kit.id,again.id);assert.equal(kit.name,'Studio');
 assert.deepEqual(kit.appearance,{bannerArt:Art.importSVG(original.bannerArt.svg,'art.svg'),bannerFit:'contain',bannerPosition:'right',titlePlacement:'separate'});
 assert.equal(kit.accent,'clay');assert.equal(kit.font,'system');assert.equal(kit.bannerSize,'standard');assert.deepEqual(input,original);
 input.bannerArt.svg='<svg onload="bad()"/>';assert.doesNotMatch(kit.appearance.bannerArt.svg,/onload/);
 const custom=await api().capture('Custom',{bannerFit:'cover',bannerPosition:'left',titlePlacement:'banner'},{accent:'#Ab12Ef',font:'serif',bannerSize:'large'});
 assert.equal(custom.accent,'#ab12ef');assert.equal(custom.font,'serif');assert.equal(custom.appearance.titlePlacement,'banner');
});

test('capture rejects invalid names, schema keys, prototypes, arrays and accessors without invoking getters',async()=>{
 for(const name of ['', ' '.repeat(3),'x'.repeat(41),'a\nb','a\u007fb','a\u0085b','a\u202eb',42,[],null])await assert.rejects(()=>api().capture(name,{},{}),/name|printable|characters/i);
 for(const appearance of [[],null,'https://example.invalid/a',Object.create({bannerFit:'cover'}),{remote:'https://example.invalid'},{bannerArt:'https://example.invalid/a.svg'},{bannerArt:[]},{bannerArt:{name:'x.svg',svg:'<svg/>',url:'blob:secret'}},JSON.parse('{"__proto__":{}}')])await assert.rejects(()=>api().capture('Kit',appearance,{}),/kit|appearance|asset|object|schema|key|field|SVG/i);
 for(const settings of [[],null,{font:'remote'},{accent:'red'},{bannerSize:'gigantic'},{font:{toString(){return 'serif';}}},{theme:'dark'},JSON.parse('{"constructor":{}}')])await assert.rejects(()=>api().capture('Kit',{},settings),/kit|setting|font|accent|banner|object|key|field/i);
 let invoked=false;const getter={};Object.defineProperty(getter,'bannerArt',{enumerable:true,get(){invoked=true;throw Error('getter ran');}});
 await assert.rejects(()=>api().capture('Kit',getter,{}),/property|accessor|field|data/i);assert.equal(invoked,false);
 const symbol={};symbol[Symbol('secret')]='x';await assert.rejects(()=>api().capture('Kit',symbol,{}),/key|field|property/i);
});

test('capture verifies media records and returns references without blobs or URLs',async()=>{
 const a=ref(),kit=await api().capture('Photo',{bannerArt:a,titleArt:a},{},store(a));
 assert.deepEqual(kit.appearance.bannerArt,a);assert.notEqual(kit.appearance.bannerArt,a);assert.notEqual(kit.appearance.bannerArt.palette,a.palette);
 assert.equal(JSON.stringify(kit).includes('blob:'),false);assert.equal(JSON.stringify(kit).includes('"blob"'),false);
 await assert.rejects(()=>api().capture('Missing',{bannerArt:a},{},{async get(){return null;}}),/missing|reference|found/i);
 await assert.rejects(()=>api().capture('Missing',{bannerArt:a},{}),/store|reference|media/i);
 await assert.rejects(()=>api().capture('Mismatch',{bannerArt:a},{},store({...a,mediaId:randomUUID()})),/missing|reference|match|found/i);
 await assert.rejects(()=>api().capture('Mismatch',{bannerArt:a},{},store({...a,width:321})),/reference|match|metadata/i);
 await assert.rejects(()=>api().capture('Mismatch',{bannerArt:a},{},store(a,new Blob([bytes],{type:'image/webp'}))),/blob|type|media/i);
});

test('capture preflights the full encoded kit from verified blob sizes without reading media bytes',async()=>{
 const banner=ref('video/mp4'),title=ref(),video=new Blob([new Uint8Array(30000000)],{type:banner.type}),photo=new Blob([new Uint8Array(3000000)],{type:title.type});let reads=0;
 const unread=blob=>{blob.arrayBuffer=async()=>{reads++;assert.fail('capture must not read media bytes');};return blob;};unread(photo);
 function snapshot(size,withTitle=true){const blob=unread(video.slice(0,size,banner.type));return {appearance:{bannerArt:banner,...(withTitle?{titleArt:title}:{})},store:{async get(id){return id===banner.mediaId?{asset:banner,blob}:id===title.mediaId?{asset:title,blob:photo}:null;}}};}
 for(const [size,withTitle]of [[30000000,false],[30000000,true],[27000000,true]]){const fixture=snapshot(size,withTitle);await assert.rejects(()=>api().capture('Encoded limit',fixture.appearance,{},fixture.store),/encoded|40 MB|byte limit/i);}
 const smaller=snapshot(26999000),kit=await api().capture('Encoded limit',smaller.appearance,{},smaller.store);assert.equal(kit.appearance.bannerArt.mediaId,banner.mediaId);assert.equal(kit.appearance.titleArt.mediaId,title.mediaId);assert.equal(reads,0);
});

test('capture refuses malformed local media metadata and unsupported slot combinations',async()=>{
 const original=ref();for(const a of [{...original,mediaId:'https://example.invalid'},{...original,url:'https://example.invalid'},{...original,type:'image/jpeg'},{...original,kind:'video'},{...original,width:0},{...original,height:NaN},{...original,width:1e20},{...original,duration:1},{...original,palette:['#ffffff']},{...original,palette:['red','blue','green']},{...original,palette:[null,null,null]}])await assert.rejects(()=>api().capture('Kit',{bannerArt:a},{},store(a)),/reference|media|type|dimension|palette|duration|colour|field/i);
 for(const key of ['borderArt','iconArt'])await assert.rejects(()=>api().capture('Kit',{[key]:original},{},store(original)),/slot|SVG|media|asset/i);
 const video=ref('video/mp4');await assert.rejects(()=>api().capture('Kit',{titleArt:video},{},store(video)),/slot|title|type|media/i);
 for(const duration of [0,-1,Infinity,'12']){const bad={...video,duration};await assert.rejects(()=>api().capture('Kit',{bannerArt:bad},{},store(bad)),/duration|video|media/i);}
 const empty=ref('image/webp',{palette:[]});assert.deepEqual((await api().capture('Empty colours',{titleArt:empty},{},store(empty))).appearance.titleArt.palette,[]);
});

test('UNIT roundtrip exports exact SVG and media bytes with hashes and freshly imports all IDs',async()=>{
 const a=ref(),source={bannerArt:a,borderArt:Art.importSVG(svg('<rect width="20" height="20"/>'),'frame.svg'),iconArt:Art.importSVG(svg('<circle r="4"/>'),'icon.svg')};
 const kit=await api().capture('Mixed',source,{accent:'ocean',font:'humanist',bannerSize:'compact'},store(a)),before=structuredClone(kit);
 const exported=await api().exportKit(kit,store(a));assert.ok(exported instanceof Blob);assert.equal(exported.type,'application/json');
 const doc=JSON.parse(await exported.text());assert.deepEqual(Object.keys(doc),['version','name','assets','accent','font','bannerSize','bannerFit','bannerPosition','titlePlacement']);
 assert.equal(doc.version,1);assert.equal(doc.name,'Mixed');assert.deepEqual(Buffer.from(doc.assets.bannerArt.data,'base64'),bytes);assert.equal(doc.assets.bannerArt.sha256,hash(bytes));
 assert.equal(doc.assets.borderArt.type,'image/svg+xml');assert.equal(Buffer.from(doc.assets.borderArt.data,'base64').toString('utf8'),source.borderArt.svg);assert.equal(doc.assets.borderArt.sha256,hash(Buffer.from(source.borderArt.svg)));
 assert.equal('id'in doc,false);assert.equal('mediaId'in doc.assets.bannerArt,false);assert.deepEqual(kit,before);
 const calls=[],imported=await api().importKit(file(doc,'MIXED.CHKIT'),{media:fakeMedia(calls)}),second=await api().importKit(file(doc),{media:fakeMedia()});
 assert.notEqual(imported.kit.id,kit.id);assert.notEqual(imported.kit.id,second.kit.id);assert.notEqual(imported.kit.appearance.bannerArt.mediaId,a.mediaId);assert.notEqual(imported.kit.appearance.bannerArt.mediaId,second.kit.appearance.bannerArt.mediaId);
 assert.equal(imported.media.length,1);assert.deepEqual(imported.media[0].asset,imported.kit.appearance.bannerArt);assert.deepEqual(Buffer.from(await imported.media[0].blob.arrayBuffer()),bytes);
 assert.deepEqual(imported.kit.appearance.borderArt,source.borderArt);assert.deepEqual(imported.kit.appearance.iconArt,source.iconArt);assert.equal(imported.kit.accent,'ocean');assert.equal(imported.kit.font,'humanist');assert.equal(imported.kit.bannerSize,'compact');
 assert.deepEqual(calls.map(x=>[x.slot,x.name,x.type]),[['banner','photo.png','image/png']]);
});

test('empty kits allow omitted asset slots and do not load the media codec',async()=>{
 const context=sandbox({require(){assert.fail('an empty kit must not require modules');}}),codec=context.ReserveCustomKits;
 const imported=await codec.importKit(file(document()));assert.equal(imported.media.length,0);assert.equal(imported.kit.appearance.bannerFit,'contain');
 const exported=await codec.exportKit(imported.kit);assert.deepEqual(JSON.parse(await exported.text()).assets,{});
});

test('UNIT global codec roundtrips base64 across browser encoding chunk boundaries without Buffer',async()=>{
 const input=Buffer.alloc(24581);for(let i=0;i<input.length;i++)input[i]=i%256;
 const a=ref(),codec=sandbox().ReserveCustomKits,kit=await codec.capture('Browser bytes',{bannerArt:a},{},store(a,new Blob([input],{type:a.type})));
 const exported=await codec.exportKit(kit,store(a,new Blob([input],{type:a.type}))),doc=JSON.parse(await exported.text());
 assert.equal(doc.assets.bannerArt.data,input.toString('base64'));assert.equal(doc.assets.bannerArt.sha256,hash(input));
 const imported=await codec.importKit(exported,{media:fakeMedia()});assert.deepEqual(Buffer.from(await imported.media[0].blob.arrayBuffer()),input);
});

test('UNIT import accepts supported banner MIME types and only PNG or WebP for titles',async()=>{
 for(const type of ['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm']){
  const calls=[],result=await api().importKit(file(document({bannerArt:asset(bytes,type,'source.bin')})),{media:fakeMedia(calls)});
  assert.equal(result.media.length,1);assert.deepEqual(calls.map(x=>[x.slot,x.type,x.name]),[['banner',type,'source.bin']]);assert.deepEqual(calls[0].bytes,bytes);
 }
 for(const type of ['image/png','image/webp'])assert.equal((await api().importKit(file(document({titleArt:asset(bytes,type)})),{media:fakeMedia()})).media.length,1);
 for(const [key,type]of [['titleArt','image/jpeg'],['titleArt','image/gif'],['titleArt','video/mp4'],['borderArt','image/png'],['iconArt','image/webp'],['bannerArt','text/html'],['bannerArt','image/svg'],['bannerArt','image/PNG'],['bannerArt','image/png;url=https://example.invalid']])await assert.rejects(()=>api().importKit(file(document({[key]:asset(bytes,type)})),{media:fakeMedia()}),/type|slot|unsupported|SVG/i);
});

test('UNIT import rejects a kit whose re-encoded title expands beyond the full encoded JSON limit',async()=>{
 const source=file(document({bannerArt:asset(Buffer.alloc(27000000),'video/mp4','clip.mp4'),titleArt:asset(bytes,'image/png','title.png')}));assert.ok(source.size<40000000);
 const expanded=new Blob([new Uint8Array(3000000)],{type:'image/png'}),calls=[];let reads=0;
 const media={async prepare(blob,slot,name){calls.push(slot);const output=slot==='title'?expanded:blob;output.arrayBuffer=async()=>{reads++;assert.fail('post-import preflight must not read prepared blobs');};return {asset:ref(blob.type,{name}),blob:output};}};
 await assert.rejects(()=>api().importKit(source,{media}),/encoded|40 MB|byte limit/i);assert.deepEqual(calls,['banner','title']);assert.equal(reads,0);
});

test('file extension and announced size are checked before any read, then actual UTF-8 bytes are bounded',async()=>{
 let reads=0;const text=async()=>{reads++;return JSON.stringify(document());};
 for(const name of ['kit.json','kit.chkit.exe','kit.chkit/','https://example.invalid/file.json'])await assert.rejects(()=>api().importKit({name,size:100,text}),/extension|chkit/i);
 for(const size of [40000001,Infinity,NaN,-1,0,'123'])await assert.rejects(()=>api().importKit({name:'kit.chkit',size,text}),/size|bytes|limit|MB|empty/i);
 assert.equal(reads,0);
 await assert.rejects(()=>api().importKit({size:1,text:async()=> ' '.repeat(40000001)}),/size|bytes|limit|MB/i);
 await assert.rejects(()=>api().importKit({size:1,text:async()=> '\u00e9'.repeat(20000001)}),/size|bytes|limit|MB/i);
 for(const invalid of [null,[],42,'https://example.invalid/a.chkit',{},new Blob([''])])await assert.rejects(()=>api().importKit(invalid),/file|size|empty|bytes/i);
 for(const textValue of ['{','null','[]','"https://example.invalid/a.chkit"','true'])await assert.rejects(()=>api().importKit(file(textValue)),/JSON|object|kit|schema/i);
});

test('wire schema rejects unknown own keys, arrays and prototype pollution at every object boundary',async()=>{
 const base=document({bannerArt:asset()});
 const cases=[{...base,version:2},{...base,version:'1'},{...base,url:'https://example.invalid'}, {...base,id:randomUUID()}, {...base,assets:[]},{...base,assets:null},{...base,assets:{remoteArt:asset()}},{...base,assets:{bannerArt:'https://example.invalid/a.png'}},{...base,assets:{bannerArt:[]}},{...base,assets:{bannerArt:{...asset(),url:'blob:123'}}},{...base,assets:{bannerArt:{...asset(),mediaId:randomUUID()}}},JSON.parse('{"version":1,"name":"x","assets":{},"__proto__":{"x":1}}'),{...base,assets:JSON.parse('{"constructor":{}}')},{...base,assets:{bannerArt:JSON.parse('{"__proto__":{}}')}}];
 for(const doc of cases)await assert.rejects(()=>api().importKit(file(doc),{media:fakeMedia()}),/version|key|field|schema|object|asset|kit/i);
 for(const key of Object.keys(document())){const doc=document();delete doc[key];await assert.rejects(()=>api().importKit(file(doc)),/required|missing|name|version|assets|accent|font|banner|title/i);}
 for(const key of ['name','type','data','sha256']){const part=asset();delete part[key];await assert.rejects(()=>api().importKit(file(document({bannerArt:part})),{media:fakeMedia()}),/required|missing|name|type|data|hash|sha256/i);}
 assert.equal({}.x,undefined);
});

test('wire names, enum values, hashes and data types are strictly bounded and validated',async()=>{
 for(const [key,value]of [['name','x'.repeat(41)],['name','a\u0000b'],['name',{}],['accent','url(https://example.invalid)'],['accent','#fff'],['accent',[]],['font','remote'],['font',{}],['bannerSize',false],['bannerFit','fill'],['bannerPosition','top'],['titlePlacement','overlap']])await assert.rejects(()=>api().importKit(file({...document(),[key]:value})),/name|accent|font|banner|title|setting|printable|character/i);
 for(const [key,value]of [['name','x'.repeat(161)],['name','a\nb'],['name',[]],['type',null],['data',{}],['data',[]],['sha256',42],['sha256','a'.repeat(63)],['sha256','z'.repeat(64)]])await assert.rejects(()=>api().importKit(file(document({bannerArt:{...asset(),[key]:value}})),{media:fakeMedia()}),/name|type|data|base64|hash|sha256|printable|character/i);
});

test('malformed and noncanonical base64 is refused before calling the media decoder',async()=>{
 const calls=[];for(const data of ['', 'YQ','YQ=','YQ===','Y Q==','YQ==\n','YR==','YWJ=','AA=A','====','_w==','-w==','data:image/png;base64,YQ==','https://example.invalid'])await assert.rejects(()=>api().importKit(file(document({bannerArt:{...asset(),data}})),{media:fakeMedia(calls)}),/base64|data/i);
 assert.equal(calls.length,0);
 for(const input of [Buffer.from([0]),Buffer.from([0,255]),Buffer.from([0,255,127]),bytes])assert.equal((await api().importKit(file(document({bannerArt:asset(input)})),{media:fakeMedia()})).media.length,1);
});

test('every original byte hash is verified before any SVG parser or media decoder runs',async()=>{
 let parses=0;const calls=[],context=sandbox({ReserveCustomArt:{...Art,importSVG(){parses++;assert.fail('hash failure must precede SVG parsing');}}});
 const doc=document({bannerArt:asset(),titleArt:asset(Buffer.from(svg('<circle r="2"/>')),'image/svg+xml','title.svg'),iconArt:{...asset(Buffer.from('<svg/>'),'image/svg+xml','icon.svg'),sha256:'0'.repeat(64)}});
 await assert.rejects(()=>context.ReserveCustomKits.importKit(file(doc),{media:fakeMedia(calls)}),/hash|SHA-?256|integrity/i);assert.equal(parses,0);assert.equal(calls.length,0);
 const tampered=asset();tampered.data=Buffer.from([7,8,9]).toString('base64');await assert.rejects(()=>api().importKit(file(document({bannerArt:tampered})),{media:fakeMedia(calls)}),/hash|SHA-?256|integrity/i);assert.equal(calls.length,0);
});

test('SVG import rejects executable and external resources even with valid hashes',async()=>{
 const calls=[];for(const source of ['<svg><script/></svg>','<svg onload="bad()"/>','<svg><foreignObject/></svg>','<svg><image href="https://example.invalid/p.png"/></svg>','<svg><style>circle{fill:url(https://example.invalid)}</style></svg>','<!DOCTYPE svg><svg/>'])await assert.rejects(()=>api().importKit(file(document({bannerArt:asset(),iconArt:asset(Buffer.from(source),'image/svg+xml','bad.svg')})),{media:fakeMedia(calls)}),/SVG|unsafe|unsupported|resource|external|DTD|event/i);
 assert.equal(calls.length,0);await assert.rejects(()=>api().importKit(file(document({iconArt:asset(Buffer.from([0xff,0xfe]),'image/svg+xml','bad.svg')}))),/UTF-?8|encoding|encoded|SVG/i);
});

test('SVG limits cover original bytes, normalized bytes and the aggregate artwork budget before media decoding',async()=>{
 const oversized=Buffer.from('<svg><desc>'+' '.repeat(Art.limits.fileBytes)+'</desc></svg>');
 await assert.rejects(()=>api().importKit(file(document({iconArt:asset(oversized,'image/svg+xml','huge.svg')}))),/SVG|limit|bytes|KiB/i);
 const near='<svg><desc>'+' '.repeat(Art.limits.fileBytes-'<svg><desc></desc></svg>'.length)+'</desc></svg>';
 assert.equal(Buffer.byteLength(near),Art.limits.fileBytes);await assert.rejects(()=>api().importKit(file(document({iconArt:asset(Buffer.from(near),'image/svg+xml','normalized.svg')}))),/SVG|limit|bytes|KiB/i);
 const calls=[],context=sandbox({ReserveCustomArt:{...Art,limits:{fileBytes:Art.limits.fileBytes,totalBytes:100}}});
 await assert.rejects(()=>context.ReserveCustomKits.importKit(file(document({bannerArt:asset(),borderArt:asset(Buffer.from(svg('<circle r="2"/>')),'image/svg+xml','a.svg'),iconArt:asset(Buffer.from(svg('<circle r="3"/>')),'image/svg+xml','b.svg')})),{media:fakeMedia(calls)}),/total|aggregate|budget|artwork|limit/i);assert.equal(calls.length,0);
 await assert.rejects(()=>context.ReserveCustomKits.capture('Too much',{borderArt:{name:'a.svg',svg:svg('<circle r="2"/>')},iconArt:{name:'b.svg',svg:svg('<circle r="3"/>')}},{}),/total|aggregate|budget|artwork|limit/i);
});

test('export enforces strict local kit validation and counts the full encoded JSON before reading large blobs',async()=>{
 const kit=await api().capture('Small',{},{});for(const bad of [[],null,{...kit,url:'https://example.invalid'},{...kit,id:'bad'},{...kit,appearance:{...kit.appearance,url:'blob:secret'}},Object.assign(Object.create({secret:1}),kit)])await assert.rejects(()=>api().exportKit(bad),/kit|object|id|key|field|appearance/i);
 const a=ref('video/mp4'),blob=new Blob([new Uint8Array(30000000)],{type:a.type});let reads=0;blob.arrayBuffer=async()=>{reads++;assert.fail('encoded size must be checked before reading');};
 const large={...kit,name:'Too large',appearance:{...kit.appearance,bannerArt:a}};await assert.rejects(()=>api().exportKit(large,store(a,blob)),/size|limit|40|MB|bytes/i);assert.equal(reads,0);
});

test('UNIT prepare failures and invalid output records cannot become imported local references',async()=>{
 const doc=file(document({bannerArt:asset()}));await assert.rejects(()=>api().importKit(doc,{media:{async prepare(){throw Error('decoder refused the photo');}}}),/decoder refused/);
 for(const make of [()=>null,()=>({asset:ref(),blob:new Blob([bytes],{type:'text/html'})}),()=>({asset:{...ref(),url:'blob:secret'},blob:new Blob([bytes],{type:'image/png'})}),()=>({asset:ref(),blob:new Blob([],{type:'image/png'})}),()=>({asset:ref(),blob:new Blob([bytes],{type:'image/png'}),url:'https://example.invalid'})])await assert.rejects(()=>api().importKit(doc,{media:{async prepare(){return make();}}}),/media|reference|blob|field|record|object|type/i);
});

test('UNIT global and lazy CommonJS media providers work and optional posters stay local',async()=>{
 const calls=[],media=fakeMedia(calls),context=sandbox({ReserveMedia:media,require(){assert.fail('global media provider takes precedence');}});
 const output=await context.ReserveCustomKits.importKit(file(document({bannerArt:asset()})));assert.equal(output.media.length,1);assert.equal(calls.length,1);
 let loads=0;const lazy=sandbox({module:{exports:{}},require(name){assert.equal(name,'./media-store.js');loads++;return fakeMedia();}});assert.equal(loads,0);await lazy.ReserveCustomKits.importKit(file(document()));assert.equal(loads,0);await lazy.ReserveCustomKits.importKit(file(document({bannerArt:asset()})));assert.equal(loads,1);
 const video=ref('video/mp4'),poster=new Blob([bytes],{type:'image/webp'}),record={asset:video,blob:new Blob([bytes],{type:video.type}),poster,createdAt:10,owner:'local-account',key:'local-key'};
 const kit=await api().capture('Video',{bannerArt:video},{},{async get(){return record;}});assert.equal(kit.appearance.bannerArt.kind,'video');
 const imported=await api().importKit(file(document({bannerArt:asset(bytes,'video/mp4','clip.mp4')})),{media:{async prepare(){return {asset:video,blob:record.blob,poster};}}});assert.equal(imported.media[0].poster,poster);assert.notEqual(imported.media[0].asset.mediaId,video.mediaId);assert.equal('poster'in imported.kit.appearance.bannerArt,false);
});
