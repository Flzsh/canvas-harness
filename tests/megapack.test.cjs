'use strict';
// The megapack downloader (extension/megapack.js): row and manifest checks, the download into Cache Storage, resume
// after the worker sleeps or restarts, two asks joining, remove, progress records, the update refresh, bundled files.
// Fakes for fetch, caches, chrome.storage and alarms, as the other worker tests use; each "worker start" runs the file
// again in a fresh context over the same storage, caches and Market (nothing kept in memory survives, as in MV3).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash,webcrypto}=require('node:crypto');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const BASE='https://flzsh.github.io/canvas-harness-packs/',ID='soul-passage',CACHE='megapack-soul-passage',RECORD='megapack:soul-passage',JOB='megapack-job:soul-passage';
const OWNER={origin:'https://school.instructure.com',accountId:'7'},ACCOUNT='reserve:v1:https://school.instructure.com:7',LOOK='reserve:appearance';
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),sha=b=>createHash('sha256').update(b).digest('hex'),tick=()=>new Promise(setImmediate);
async function until(check,what,turns=4000){for(let i=0;i<turns;i++){if(await check())return;await tick();}assert.fail('timed out waiting for '+what);}
function event(){const all=[];return {addListener:fn=>all.push(fn),emit:(...args)=>all.map(fn=>fn(...args))};}
function area(log){const map=new Map();return {map,async get(keys){const names=keys==null?[...map.keys()]:typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys);return Object.fromEntries(names.filter(k=>map.has(k)).map(k=>[k,clone(map.get(k))]));},async set(values){for(const [k,v]of Object.entries(values)){map.set(k,clone(v));log?.push([k,clone(v)]);}},async remove(keys){for(const k of [].concat(keys))map.delete(k);}};}
function cacheStorage(){
 const stores=new Map(),url=key=>String(key?.url||key);
 return {stores,async has(name){return stores.has(name);},async delete(name){return stores.delete(name);},async open(name){
  if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);
  return {async match(key){const v=m.get(url(key));return v?new Response(v.bytes.slice(),{headers:{'content-type':v.type}}):undefined;},
   async put(key,response){if(!/^https?:/.test(url(key)))throw TypeError("Request scheme 'chrome-extension' is unsupported");m.set(url(key),{bytes:new Uint8Array(await response.arrayBuffer()),type:response.headers.get('content-type')});},
   async keys(){return [...m.keys()].map(u=>({url:u}));},async delete(key){return m.delete(url(key));}};
 }};
}
// a small megapack with names from every download rule; webp files carry the RIFF/WEBP header, json files parse (land-abyss-*: a name
// megapack version 2 carries; still valid in 4.2.2, which shows the deep sea nowhere)
const NAMES=['cabin-dusk.webp','flow-sea-0.webp','land-abyss-dusk-0.webp','live-clouds.json','live-sea.json','page-grove-noon-1.webp','page-grove-noon.webp','pieces-night.webp','sprites-metro-night.webp','sprites-metro.webp','sun-sea.json','under.webp'];
function bytesFor(name,salt=''){if(name.endsWith('.json'))return Buffer.from(JSON.stringify({name,salt,n:[1,2,3]}));const body=Buffer.from(('art '+name+salt+' ').repeat(40+name.length*7));const head=Buffer.alloc(12);head.write('RIFF',0,'ascii');head.writeUInt32LE(body.length+4,4);head.write('WEBP',8,'ascii');return Buffer.concat([head,body]);}
function pack({version=1,engine=1,salt={},names=NAMES,patch={},rowPatch={}}={}){
 const files=names.map(name=>{const bytes=bytesFor(name,salt[name]||'');return {name,size:bytes.length,sha256:sha(bytes),bytes};});
 const manifest={megapack:ID,scene:'train',version,engine,bytes:files.reduce((a,f)=>a+f.size,0),files:files.map(({name,size,sha256})=>({name,size,sha256})),...patch};
 const text=Buffer.from(JSON.stringify(manifest)),row={id:ID,name:'Soul Passage',kind:'megapack',file:`megapacks/${ID}/${version}.json`,size:text.length,sha256:sha(text),bytes:manifest.bytes,scene:'train',engine,needs:'4.2.0',...rowPatch};
 return {files,manifest,text,row};
}
const keyOf=f=>BASE+'megapacks/'+ID+'/files/'+f.sha256+'.'+f.name.split('.').pop();
// The Market: packs.json, the manifest, the files; every request recorded with its options
function marketOf(p,options={}){
 const m={p,requests:[],pkg:[],active:0,max:0,offline:false,cutAfter:Infinity,served:0,tamper:new Set(),hold:null,extra:new Map(),packs:options.packs||(()=>[m.p.row])};
 m.fetch=async(url,init={})=>{
  url=String(url);
  if(url.startsWith('chrome-extension://')){m.pkg.push(url);const ok=m.bundled?.(url);if(ok===undefined)throw TypeError('Failed to fetch');return new Response(ok?'{}':'nf',{status:ok?200:404});}
  m.requests.push({url,init:{credentials:init.credentials,referrerPolicy:init.referrerPolicy,redirect:init.redirect,cache:init.cache,headers:init.headers}});
  m.active++;m.max=Math.max(m.max,m.active);
  try{
   await tick();if(m.hold&&url.includes('/files/'))await m.hold;
   if(m.offline)throw TypeError('Failed to fetch');
   if(m.extra.has(url))return new Response(m.extra.get(url));
   if(url===BASE+'packs.json')return new Response(JSON.stringify(m.packs()));
   if(url===BASE+m.p.row.file)return new Response(m.p.text);
   const f=m.p.files.find(f=>keyOf(f)===url);if(!f)return new Response('not found',{status:404});
   if(m.served>=m.cutAfter)throw TypeError('Failed to fetch');m.served++;
   if(m.tamper.has(f.name)){const b=Buffer.from(f.bytes);b[b.length-1]^=1;return new Response(b);}
   return new Response(f.bytes);
  }finally{m.active--;}
 };
 return m;
}
function shared(p=pack(),options={}){const s={sessionLog:[],localLog:[],alarms:new Map(),caches:cacheStorage(),used:[]};s.local=area(s.localLog);s.session=area(s.sessionLog);s.market=marketOf(p,options);s.market.bundled=()=>false;
 // (the public worker puts the scene on through the account's own store, as a choice in Look does: the store's update writes the
 // device look's scene and sets the account's own theme aside; recorded here as the built-in scene used for that account)
 s.storage={createStore:({origin,accountId,adapter})=>{let data=null;const key='reserve:v1:'+origin+':'+accountId;return {
  load:async()=>{const raw=await adapter.read(key);data={settings:clone(raw?.settings||{}),pet:{}};return data;},
  update:async fn=>{fn(data);s.used.push(['builtin:scene:'+data.settings.sceneTheme,{owner:{origin,accountId}}]);const look=s.local.map.get(LOOK)||{theme:'light',motion:'gentle',nightArt:0,pet:true,sceneTheme:''};
   await s.local.set({[LOOK]:{...look,sceneTheme:data.settings.sceneTheme}});const saved=s.local.map.get(key);if(saved){const next=clone(saved);next.settings={...next.settings,makeYourOwn:data.settings.makeYourOwn};if(!data.settings.makeYourOwn)delete next.settings.makeYourOwn;await s.local.set({[key]:next});}return data;},
  destroy(){s.destroyed=(s.destroyed||0)+1;}};}};return s;}
// one start of the worker
function life(s,opts={}){
 const runtime={id:'test',getURL:f=>'chrome-extension://test/'+f,onStartup:event(),onInstalled:event(),onMessage:event(),...(opts.version?{getManifest:()=>({version:opts.version})}:{})};
 const alarms={create:async(name,info)=>{s.alarms.set(name,clone(info));},clear:async name=>s.alarms.delete(name),onAlarm:event()};
 const env=vm.createContext({chrome:{runtime,storage:{local:s.local,session:s.session},alarms},caches:s.caches,fetch:async(...a)=>{if(opts.dead&&String(a[0]).includes('/files/'))await new Promise(()=>{});return s.market.fetch(...a);},crypto:webcrypto,Response,Headers,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,AbortController,AbortSignal,URL,console:{warn(){},log(){},error(){}},setTimeout,clearTimeout,importScripts(){},ReserveStorage:s.storage});
 vm.runInContext(read('page-preferences.js'),env,{filename:'page-preferences.js'});vm.runInContext(read('megapack.js'),env,{filename:'megapack.js'});
 // answers in this realm's objects (the context's own Object prototype would fail deepEqual)
 const raw=env.ReserveMegapack,plain=v=>v==null||typeof v!=='object'?v:clone(v),M={};
 for(const [k,v]of Object.entries(raw))M[k]=typeof v!=='function'?v:(...a)=>{const r=v(...a);return r&&typeof r.then==='function'?r.then(plain):plain(r);};
 return {env,M,runtime,alarms};
}
const stored=s=>[...(s.caches.stores.get(CACHE)?.keys()||[])].sort();
const fileFetches=s=>s.market.requests.filter(r=>r.url.includes('/files/'));

// ---------------------------------------------------------------- checks
test('the row: every protocol limit, a bad shape, and a scene or engine the code does not have',async()=>{
 const s=shared(),{M}=life(s),{row}=pack(),bad=patch=>assert.throws(()=>M.checkRow(ID,{...row,...patch}),e=>e.kind==='bad',JSON.stringify(patch));
 assert.equal(M.checkRow(ID,row).version,1);assert.equal(M.ENGINE,1);
 assert.equal(M.checkRow(ID,{...row,size:200000}).size,200000);assert.equal(M.checkRow(ID,{...row,bytes:80000000}).bytes,80000000);
 for(const patch of [{size:200001},{size:0},{size:1.5},{size:'9'},{bytes:0},{bytes:1.5},{bytes:'9'},{sha256:'A'.repeat(64)},{sha256:'0'.repeat(63)},{id:'other'},{kind:'theme'},{name:''},{name:' Soul'},{name:'x'.repeat(121)},{needs:'4.2'},{needs:4.2},{file:'megapacks/soul-passage/0.json'},{file:'megapacks/other/1.json'},{file:'megapacks/soul-passage/../1.json'},{file:'/megapacks/soul-passage/1.json'},{file:'megapacks/soul-passage/1.json?x'},{file:'https://flzsh.github.io/canvas-harness-packs/megapacks/soul-passage/1.json'},{engine:0},{engine:1.5},{engine:'1'},{scene:7}])bad(patch);
 for(const patch of [{scene:'castle'},{scene:'starry'},{engine:2},{bytes:80000001}])assert.throws(()=>M.checkRow(ID,{...row,...patch}),e=>e.kind==='update'&&e.message==='Update Canvas Harness to add this',JSON.stringify(patch));
 assert.throws(()=>M.checkRow('other-pack',{...row,id:'other-pack'}),e=>e.kind==='bad');
 assert.deepEqual(Object.keys(M.checkRow(ID,{...row,extra:'<script>'})).sort(),['bytes','engine','file','id','kind','name','needs','scene','sha256','size','version'],'unknown fields are dropped');
});
test('the row\'s "needs" against this version: an equal or older one is taken, a newer one is refused with the update text (public)',async()=>{
 const {row}=pack();
 for(const [version,needs,ok] of [['4.2.0','4.2.0',true],['4.2.0','4.1.9',true],['4.2.0','3.10.0',true],['4.2.1','4.2.0',true],['4.10.0','4.9.99',true],
  ['4.2.0','4.2.1',false],['4.2.0','4.3.0',false],['4.2.0','5.0.0',false],['4.9.99','4.10.0',false],['4.1.0','4.2.0',false]]){
  const {M}=life(shared(),{version});
  if(ok)assert.equal(M.checkRow(ID,{...row,needs}).needs,needs,version+' takes a row needing '+needs);
  else assert.throws(()=>M.checkRow(ID,{...row,needs}),e=>e.kind==='update'&&e.message==='Update Canvas Harness to add this',version+' refuses a row needing '+needs);
 }
 assert.equal(life(shared()).M.newer('9.9.9',''),false,'with no version to compare (a test, a preview) the row is taken');
 // a row needing a newer version is not downloaded: nothing past packs.json is read, and the student is told to update
 const s=shared(pack({rowPatch:{needs:'4.3.0'}})),w=life(s,{version:'4.2.0'});await w.M.get(ID,{account:OWNER});await w.M.wait(ID);
 assert.deepEqual(s.market.requests.map(r=>r.url),[BASE+'packs.json']);assert.equal(s.session.map.get(RECORD).reason,'Update Canvas Harness to add this');assert.equal(s.local.map.has(RECORD),false);
});
test('the manifest: its size and hash, each file limit, names outside the patterns, order and totals',async()=>{
 const s=shared(),{M}=life(s),good=pack(),row=M.checkRow(ID,good.row);
 assert.equal(M.checkManifest(ID,good.text,row).files.length,NAMES.length);
 assert.throws(()=>M.checkManifest(ID,good.text.subarray(1),row),e=>e.kind==='check','a wrong size');
 const remade=(edit,rowPatch={})=>{const m=clone(good.manifest);edit(m);const text=Buffer.from(JSON.stringify(m));return [text,M.checkRow(ID,{...good.row,size:text.length,sha256:sha(text),bytes:m.bytes,...rowPatch})];};
 const fails=(edit,why)=>{const [text,r]=remade(edit);assert.throws(()=>M.checkManifest(ID,text,r),e=>e.kind==='bad',why);};
 for(const name of ['evil.js','page-grove-noon.html','../page-grove-noon.webp','page-mars-noon.webp','page-grove-teatime.webp','kit-paper.png','poster.jpg','ride.json','lever.webp','band.js','Page-grove-noon.webp','page-grove-noon.webp ','page-grove-noon-10.webp','live-clouds.JSON'])fails(m=>{m.files[0].name=name;m.files.sort((a,b)=>a.name<b.name?-1:1);},'the name '+name);
 fails(m=>{m.files[1].size=6000001;m.bytes+=6000001-good.manifest.files[1].size;},'a file over 6,000,000 bytes');
 fails(m=>{m.files.reverse();},'files not sorted by name');
 fails(m=>{m.files[1]={...m.files[0]};m.bytes=m.files.reduce((a,f)=>a+f.size,0);},'a name twice');
 fails(m=>{m.bytes+=1;},'a total that is not the sum');
 fails(m=>{m.extra=1;},'another key');
 fails(m=>{m.files[0].kind='x';},'another file key');
 fails(m=>{m.files[0].sha256='z'.repeat(64);},'a bad hash text');
 fails(m=>{m.files=[];},'no files');
 for(const [key,value]of [['scene','sea'],['engine',2],['version',2],['megapack','other']]){const [text]=remade(m=>{m[key]=value;});const r={...row,size:text.length,sha256:sha(text)};assert.throws(()=>M.checkManifest(ID,text,r),e=>e.kind==='bad',key);}
 assert.equal(M.nameOK(ID,'page-grove-noon-1.webp'),true);assert.equal(M.nameOK(ID,'page-grove-noon-1.webp.js'),false);
});
test('the names the code accepts are the engine\'s lands and stages (and the deep sea\'s, for version 2), and the package keeps everything else',()=>{
 const scene=read('scene-themes.js'),lands=[...new Set([...scene.matchAll(/"([a-z]+)":\{"stages":/g)].map(m=>m[1]))].sort(),stages=JSON.parse(/LIVE_STAGES=(\[[^\]]+\])/.exec(scene)[1].replace(/'/g,'"'));
 assert.deepEqual(lands,['citadel','clouds','grove','mesa','metro','peaks','sea']);
 // (4.2.2) the deep sea left the engine, but megapack version 2 (published) carries its files: its name stays one the code accepts, so
 // a version 2 stays whole and valid whether it is installed already or comes now; nothing shows those files
 const src=read('megapack.js');assert.deepEqual(/const L='\(\?:([a-z|]+)\)'/.exec(src)[1].split('|').sort(),[...lands,'abyss'].sort());assert.deepEqual(/S='\(\?:([a-z|]+)\)'/.exec(src)[1].split('|'),stages);
 const {M}=life(shared()),dir=path.join(__dirname,'../extension/themes/train'),files=fs.readdirSync(dir);
 for(const f of files.filter(f=>!M.nameOK(ID,f)))assert.match(f,/^(?:[a-z-]+\.(?:html|js|css)|kit-[a-z0-9-]+\.png|[a-z]+-(?:card|panel)-dark\.png|icon-[a-z0-9-]+\.png|lever\.webp|poster\.jpg|ride\.json)$/,'a packaged file the download rules do not name: '+f);
 assert.ok(M.nameOK(ID,'live-clouds.json'),'the bundled probe is a downloaded kind of file');
 for(const name of ['land-abyss-noon-0.webp','page-abyss-night-1.webp','flow-abyss-2.webp','sprites-abyss.webp','sun-abyss.json','live-abyss.json'])assert.ok(M.nameOK(ID,name),'version 2\'s '+name+' is still a name a megapack may carry');
 assert.ok(!files.some(f=>/abyss/.test(f)),'the package holds nothing of the deep sea');
});

// ---------------------------------------------------------------- the download
test('a full download: every file checked and stored under its Market address, the records, no cookies, four at a time',async()=>{
 const s=shared(),w=life(s);s.local.map.set(LOOK,{theme:'light',motion:'gentle',nightArt:0,pet:true,sceneTheme:'maple'});
 assert.deepEqual(await w.M.state(ID),{state:'none'});
 const reply=await w.M.get(ID,{account:OWNER});assert.deepEqual(reply,{state:'getting',started:true});
 assert.equal((await w.M.state(ID)).state,'getting','getting from the moment it starts, whether or not a progress record is written yet');
 await until(async()=>s.alarms.has('megapack-resume'),'the alarm');assert.deepEqual(s.alarms.get('megapack-resume'),{delayInMinutes:.5,periodInMinutes:.5},'an alarm wakes the worker every 30 s while it runs');
 await w.M.wait(ID);
 const p=s.market.p;assert.deepEqual(stored(s),p.files.map(keyOf).sort());
 for(const f of p.files){const c=await (await s.caches.open(CACHE)).match(keyOf(f));assert.equal(sha(Buffer.from(await c.arrayBuffer())),f.sha256);assert.equal(c.headers.get('content-type'),f.name.endsWith('.json')?'application/json':'image/webp');}
 const record=s.local.map.get(RECORD);
 assert.deepEqual(Object.keys(record),['version','engine','bytes','count','manifest','names','at']);
 assert.deepEqual({...record,at:0},{version:1,engine:1,bytes:p.manifest.bytes,count:NAMES.length,manifest:p.row.sha256,names:Object.fromEntries(p.files.map(f=>[f.name,f.sha256+'.'+f.name.split('.').pop()])),at:0});
 assert.equal(s.local.map.has(JOB),false,'the job record goes when the download ends');assert.equal(s.alarms.has('megapack-resume'),false,'and the alarm');
 assert.deepEqual({...s.session.map.get(RECORD),at:0},{state:'here',done:p.manifest.bytes,total:p.manifest.bytes,at:0});
 // requests: exactly packs.json, the manifest, each file once; no cookies, no referrer, no query, nothing else
 assert.deepEqual(s.market.requests.map(r=>r.url).sort(),[BASE+'packs.json',BASE+p.row.file,...p.files.map(keyOf)].sort());
 for(const r of s.market.requests){assert.deepEqual(r.init,{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',headers:undefined});assert.doesNotMatch(r.url,/[?#]/);}
 assert.ok(s.market.max<=4&&s.market.max>=2,'four files at a time, not more ('+s.market.max+')');
 // the scene goes on for the account that asked
 assert.deepEqual(s.used,[['builtin:scene:train',{owner:OWNER}]]);
 assert.deepEqual(await w.M.state(ID),{state:'here'});
 assert.deepEqual(await w.M.installed(),[ID]);
});
test('progress: a session record after each file, done never goes back, total is the row\'s bytes',async()=>{
 const s=shared(),w=life(s),p=s.market.p;await w.M.get(ID,{});await w.M.wait(ID);
 const writes=s.sessionLog.filter(([k])=>k===RECORD).map(([,v])=>v),getting=writes.filter(v=>v.state==='getting');
 assert.ok(getting.length>=3,'progress is written as files arrive ('+getting.length+')');
 assert.equal(getting[0].done,0);for(let i=1;i<getting.length;i++)assert.ok(getting[i].done>=getting[i-1].done,'done never goes back');
 assert.ok(getting.slice(1).every(v=>v.total===p.row.bytes));assert.equal(writes.at(-1).state,'here');
 for(const v of writes)assert.deepEqual(Object.keys(v).sort(),v.state==='getting'||v.state==='here'?['at','done','state','total']:['at','done','reason','state','total']);
});
test('a wrong byte in one file: that file is refused, the others are stored, no record; the next ask fetches only it',async()=>{
 const s=shared(),w=life(s),p=s.market.p;s.market.tamper.add('page-grove-noon.webp');
 await w.M.get(ID,{});await w.M.wait(ID);
 const st=await w.M.state(ID);assert.equal(st.state,'failed');assert.equal(st.reason,'A file from the Market did not match its check. Try again later.');
 assert.equal(s.local.map.has(RECORD),false,'no record while a file is missing');assert.equal(stored(s).length,NAMES.length-1);
 assert.ok(!stored(s).includes(keyOf(p.files.find(f=>f.name==='page-grove-noon.webp'))));
 const job=s.local.map.get(JOB);assert.equal(job.tries,1);assert.ok(job.retryAt>Date.now());assert.ok(s.alarms.get('megapack-resume').when>=job.retryAt-5,'one alarm at the retry time');
 s.market.tamper.clear();s.market.requests.length=0;
 assert.equal((await w.M.get(ID,{})).state,'getting');await w.M.wait(ID);
 assert.deepEqual(fileFetches(s).map(r=>r.url),[keyOf(p.files.find(f=>f.name==='page-grove-noon.webp'))]);assert.equal((await w.M.state(ID)).state,'here');
});
test('a wrong size: a longer file, a shorter file and a manifest that is not the row\'s are refused',async()=>{
 for(const kind of ['long','short','manifest']){
  const s=shared(),w=life(s),p=s.market.p,f=p.files[2];
  if(kind==='manifest')s.market.extra.set(BASE+p.row.file,Buffer.concat([p.text,Buffer.from(' ')]));
  else s.market.extra.set(keyOf(f),kind==='long'?Buffer.concat([f.bytes,Buffer.from('x')]):f.bytes.subarray(0,f.size-1));
  await w.M.get(ID,{});await w.M.wait(ID);const st=await w.M.state(ID);
  assert.equal(st.state,'failed',kind);assert.match(st.reason,/did not match its check/,kind);assert.equal(s.local.map.has(RECORD),false,kind);
  if(kind==='manifest')assert.equal(fileFetches(s).length,0,'no file is fetched for a manifest that is not the row\'s');
 }
});
test('a picture whose bytes are not a picture is refused even when the manifest vouches for it',async()=>{
 const s=shared(),w=life(s),p=s.market.p,f=p.files.find(f=>f.name==='under.webp'),html=Buffer.from('<html><script>alert(1)</script></html>'.padEnd(f.size,' '));
 f.bytes=html;f.sha256=sha(html);const m=clone(p.manifest);m.files.find(x=>x.name==='under.webp').sha256=f.sha256;p.text=Buffer.from(JSON.stringify(m));p.row={...p.row,sha256:sha(p.text),size:p.text.length};
 await w.M.get(ID,{});await w.M.wait(ID);assert.equal((await w.M.state(ID)).state,'failed');assert.ok(!stored(s).includes(keyOf(f)));
});
test('the network cut half way: the alarm at the retry time goes on from where it stopped (files kept, each fetched once)',async()=>{
 const s=shared(),w=life(s),p=s.market.p;s.market.cutAfter=5;
 await w.M.get(ID,{account:OWNER});await w.M.wait(ID);
 let st=await w.M.state(ID);assert.equal(st.state,'failed');assert.match(st.reason,/connection to the Market was lost/);assert.ok(st.done>0&&st.done<p.row.bytes,'part of it is here');
 assert.equal(stored(s).length,5);assert.equal(s.local.map.get(JOB).account.accountId,'7','the job keeps the account that asked');
 // the alarm before the retry time does nothing; a fresh start (onStartup) goes on at once
 s.market.cutAfter=Infinity;s.market.requests.length=0;const w2=life(s);
 w2.alarms.onAlarm.emit({name:'megapack-resume'});for(let i=0;i<20;i++)await tick();assert.equal(fileFetches(s).length,0,'not before the retry time');
 // time passes: the alarm at the retry time goes on
 s.local.map.set(JOB,{...s.local.map.get(JOB),retryAt:Date.now()-1});w2.alarms.onAlarm.emit({name:'megapack-resume'});await until(async()=>s.local.map.has(RECORD),'the record after the resume');
 assert.equal(fileFetches(s).length,NAMES.length-5,'only the missing files came down');assert.equal(new Set(fileFetches(s).map(r=>r.url)).size,NAMES.length-5);
 assert.deepEqual(s.used,[['builtin:scene:train',{owner:OWNER}]],'the scene goes on for the account that asked before the cut');
});
test('the worker sleeps mid-download: its next start (any event, or the 30 s alarm) goes on without fetching stored files again',async()=>{
 const s=shared(),w=life(s,{dead:true}),p=s.market.p;
 // half the files stored; this worker's file fetches never come back (it is stopped while they run)
 const cache=await s.caches.open(CACHE);for(const f of p.files.slice(0,6))await cache.put(keyOf(f),new Response(f.bytes));
 await w.M.get(ID,{account:OWNER});await until(async()=>s.session.map.get(RECORD)?.done>0,'progress from the stored half');
 assert.equal(s.local.map.get(JOB).account.accountId,'7');assert.equal(s.session.map.get(RECORD).state,'getting');
 s.market.requests.length=0;
 // a new start of the worker: its top-level resume picks the job up from the job record
 const w2=life(s);await until(async()=>s.local.map.has(RECORD),'the record after the wake');
 const urls=fileFetches(s).map(r=>r.url);for(const f of p.files.slice(0,6))assert.ok(!urls.includes(keyOf(f)),'a stored file with the right hash is not fetched again: '+f.name);
 assert.equal((await w2.M.state(ID)).state,'here');assert.equal(stored(s).length,NAMES.length);
});
test('a stored file whose bytes changed is fetched again; one with the right hash is skipped',async()=>{
 const s=shared(),w=life(s),p=s.market.p,cache=await s.caches.open(CACHE);
 for(const f of p.files)await cache.put(keyOf(f),new Response(f.bytes));const bad=p.files[3];const b=Buffer.from(bad.bytes);b[0]^=1;await cache.put(keyOf(bad),new Response(b));
 await w.M.get(ID,{});await w.M.wait(ID);assert.deepEqual(fileFetches(s).map(r=>r.url),[keyOf(bad)]);assert.equal((await w.M.state(ID)).state,'here');
});
test('the job record (cut by a restart or an update) resumes on onInstalled with the session gone',async()=>{
 const s=shared(),w=life(s),p=s.market.p;s.market.cutAfter=4;await w.M.get(ID,{account:OWNER});await w.M.wait(ID);
 s.session.map.clear();s.market.cutAfter=Infinity;s.market.requests.length=0;// an update clears chrome.storage.session
 const w2=life(s);w2.runtime.onInstalled.emit({reason:'update'});await until(async()=>s.local.map.has(RECORD),'resumed after the update');
 assert.equal(fileFetches(s).length,NAMES.length-4);assert.equal((await w2.M.state(ID)).state,'here');
});
test('two asks join one download: each file comes down once, the second answer says it joined',async()=>{
 const s=shared(),w=life(s);let release;s.market.hold=new Promise(r=>{release=r;});
 const [a,b]=await Promise.all([w.M.get(ID,{}),w.M.get(ID,{account:OWNER})]);
 assert.deepEqual([a,b].map(x=>x.state),['getting','getting']);assert.equal([a,b].filter(x=>x.started).length,1);assert.equal([a,b].filter(x=>x.joined).length,1);
 assert.deepEqual((await w.M.get(ID,{})).joined,true);release();await w.M.wait(ID);
 assert.equal(fileFetches(s).length,NAMES.length);assert.equal(new Set(fileFetches(s).map(r=>r.url)).size,NAMES.length);
 assert.deepEqual(s.used,[['builtin:scene:train',{owner:OWNER}]],'the joining ask brought the account');
 assert.deepEqual(await w.M.get(ID,{}),{state:'here'},'asking when it is here answers here');assert.equal(fileFetches(s).length,NAMES.length);
});
test('the scene is not put on when the account chose another look meanwhile, nor for nobody',async()=>{
 const s=shared(),w=life(s);s.local.map.set(LOOK,{theme:'light',motion:'gentle',nightArt:0,pet:true,sceneTheme:'maple'});let release;s.market.hold=new Promise(r=>{release=r;});
 await w.M.get(ID,{account:OWNER});await until(async()=>s.session.map.get(RECORD)?.total>0,'started');
 s.local.map.set(LOOK,{...s.local.map.get(LOOK),sceneTheme:'sea'});release();await w.M.wait(ID);
 assert.equal(s.local.map.has(RECORD),true);assert.deepEqual(s.used,[]);assert.equal(s.local.map.get(LOOK).sceneTheme,'sea');
 const s2=shared(),w2=life(s2);await w2.M.get(ID,{});await w2.M.wait(ID);assert.deepEqual(s2.used,[],'no account asked');
 // a look decided by the account's older settings (no device look chosen yet)
 const s3=shared(),w3=life(s3);s3.local.map.set(ACCOUNT,{settings:{sceneTheme:'maple'}});await w3.M.get(ID,{account:OWNER});await w3.M.wait(ID);assert.deepEqual(s3.used,[['builtin:scene:train',{owner:OWNER}]]);
});
test('remove: during a download and after; the files, both records and the job go; whoever wears the scene goes to none',async()=>{
 const s=shared(),w=life(s);let release;s.market.hold=new Promise(r=>{release=r;});
 await w.M.get(ID,{});await until(async()=>s.session.map.get(RECORD)?.total>0,'started');
 const removing=w.M.remove(ID);release();assert.deepEqual(await removing,{state:'none',sceneOff:false});
 assert.equal(s.caches.stores.has(CACHE),false);for(const k of [RECORD,JOB])assert.equal(s.local.map.has(k),false,k);assert.equal(s.session.map.has(RECORD),false);assert.equal(s.alarms.has('megapack-resume'),false);
 assert.deepEqual(await w.M.state(ID),{state:'none'});
 await w.M.get(ID,{account:OWNER});await w.M.wait(ID);assert.equal(s.local.map.get(LOOK).sceneTheme,'train');
 const r=await w.M.remove(ID);assert.equal(r.sceneOff,true);assert.equal(s.local.map.get(LOOK).sceneTheme,'');assert.equal(s.caches.stores.has(CACHE),false);assert.deepEqual(await w.M.installed(),[]);
 // a scene still decided by an account's older settings goes to none too (the device look records the choice)
 s.local.map.delete(LOOK);s.local.map.set('reserve:v1:https://school.instructure.com:8',{settings:{sceneTheme:'train'}});await w.M.remove(ID);
 assert.equal(s.local.map.get(LOOK).sceneTheme,'');assert.deepEqual(s.local.map.get(LOOK).chosen,['sceneTheme']);
});
test('the update refresh: a record for an older engine is refreshed from the Market, fetching only changed files',async()=>{
 const v1=pack(),s=shared(v1),w=life(s);await w.M.get(ID,{});await w.M.wait(ID);
 // an older engine wrote this record; the Market now has version 2 with three changed files (one renamed away)
 s.local.map.set(RECORD,{...s.local.map.get(RECORD),engine:0});
 const names2=NAMES.filter(n=>n!=='sprites-metro-night.webp'),v2=pack({version:2,names:names2,salt:{'cabin-dusk.webp':'2','under.webp':'2','live-sea.json':'2'}});
 s.market.p=v2;s.market.requests.length=0;s.sessionLog.length=0;const before=s.local.map.get(RECORD);
 const w2=life(s);w2.runtime.onInstalled.emit({reason:'update'});
 await until(async()=>s.local.map.get(RECORD)?.version===2,'the version 2 record');
 assert.deepEqual(fileFetches(s).map(r=>r.url).sort(),v2.files.filter(f=>['cabin-dusk.webp','under.webp','live-sea.json'].includes(f.name)).map(keyOf).sort());
 assert.equal(s.sessionLog.filter(([,v])=>v.state==='getting').length,0,'no progress is shown while the version here stays usable');
 assert.deepEqual(stored(s),v2.files.map(keyOf).sort(),'files no version names any more are deleted');assert.equal(s.local.map.get(RECORD).engine,1);
 assert.notEqual(before.manifest,s.local.map.get(RECORD).manifest);
 // nothing newer on the Market: the record stays, only packs.json and the manifest are read, no file
 s.local.map.set(RECORD,{...s.local.map.get(RECORD),engine:0});s.market.requests.length=0;const w3=life(s);w3.runtime.onInstalled.emit({reason:'update'});
 await until(async()=>s.local.map.get(RECORD)?.engine===1,'checked again');assert.equal(fileFetches(s).length,0);
 // an ordinary start does not ask the Market
 s.market.requests.length=0;const w4=life(s);w4.runtime.onStartup.emit();for(let i=0;i<50;i++)await tick();assert.equal(s.market.requests.length,0);
});
test('files gone from the store (site data cleared) are fetched again on the next start; the record does not lie',async()=>{
 const s=shared(),w=life(s);await w.M.get(ID,{});await w.M.wait(ID);await s.caches.delete(CACHE);s.market.requests.length=0;
 const w2=life(s);w2.runtime.onStartup.emit();await until(async()=>stored(s).length===NAMES.length&&s.local.map.has(RECORD),'fetched again');assert.equal(fileFetches(s).length,NAMES.length);
});
test('bundled: the package still holding a downloaded kind of file answers here, bundled',async()=>{
 const s=shared(),w=life(s);s.market.bundled=url=>url==='chrome-extension://test/themes/train/live-clouds.json';
 assert.deepEqual(await w.M.state(ID),{state:'here',bundled:true});assert.equal(await w.M.bundled(ID),true);
 const s2=shared(),w2=life(s2);s2.market.bundled=()=>undefined;assert.deepEqual(await w2.M.state(ID),{state:'none'},'a missing package file (fetch rejects) is not bundled');
 // a download in a bundled build still reports its progress (the bridge follows it)
 let release;s.market.hold=new Promise(r=>{release=r;});await w.M.get(ID,{});await until(async()=>s.session.map.get(RECORD)?.total>0,'started');
 const st=await w.M.state(ID);assert.equal(st.state,'getting');assert.equal(st.bundled,true);release();await w.M.wait(ID);
 assert.equal((await w.M.state(ID)).bundled,true);assert.deepEqual(await w.M.installed(),[ID]);
});
test('listings that cannot be used: no row, a newer engine, a bad row; no retry is planned for them',async()=>{
 for(const [packs,reason]of [[[],'This is not on the Market now.'],[[{...pack().row,engine:2}],'Update Canvas Harness to add this'],[[{...pack().row,size:-1}],'The Market listing for this is not valid.'],[{packs:[pack().row,pack().row]},'The Market listing for this is not valid.']]){
  const s=shared(pack(),{packs:()=>packs}),w=life(s);await w.M.get(ID,{});await w.M.wait(ID);
  const st=await w.M.state(ID);assert.deepEqual([st.state,st.reason],['failed',reason]);assert.equal(s.local.map.has(JOB),false);assert.equal(fileFetches(s).length,0);
 }
 const s=shared(),w=life(s);await assert.rejects(w.M.get(ID,{entry:{...pack().row,engine:2}}),/Update Canvas Harness to add this/);await assert.rejects(w.M.get('other',{}),/not valid/);
 assert.equal(s.market.requests.length,0,'a bad entry is refused before any request');
});
test('a checked entry from the bridge saves reading packs.json; the worker checks it again',async()=>{
 const s=shared(),w=life(s);await w.M.get(ID,{entry:s.market.p.row});await w.M.wait(ID);
 assert.equal(s.market.requests.some(r=>r.url.endsWith('/packs.json')),false);assert.equal((await w.M.state(ID)).state,'here');
});
test('retries back off and stop after six; a fresh start tries again',async()=>{
 const s=shared(),w=life(s);s.market.offline=true;
 for(let i=1;i<=6;i++){await w.M.get(ID,{tries:i-1});await w.M.wait(ID);assert.equal(s.local.map.get(JOB).tries,i);}
 const job=s.local.map.get(JOB);assert.equal(job.retryAt,undefined,'no retry time after six');assert.equal(s.alarms.has('megapack-resume'),false);
 assert.deepEqual(await w.M.resumeAll({reason:'alarm'}),{[ID]:'waiting'});
 s.market.offline=false;assert.deepEqual(await w.M.resumeAll({reason:'startup'}),{[ID]:'getting'});await w.M.wait(ID);assert.equal((await w.M.state(ID)).state,'here');
});
