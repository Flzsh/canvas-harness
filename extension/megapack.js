/* Megapacks: a scene's large pictures and data, downloaded by the worker from the public Market, file by file.
   Shapes: megapack protocol v1 (packs.json row, manifest, Cache Storage, records). Only the worker runs this file.
   - Requests to the Market carry no cookies, no referrer and nothing of the student; the address is the file's own.
   - Each file is checked (size, SHA-256, kind) before it is stored; one already stored with the right hash is skipped.
   - The complete record (chrome.storage.local "megapack:<id>") is written only when every file is stored and checked.
   - A download cut by the worker's sleep, a restart or an update goes on: the job's own record
     (chrome.storage.local "megapack-job:<id>") stays until the download ends, an alarm wakes the worker every 30 s
     while it runs, and every start of the worker (any event), onStartup and onInstalled pick it up again. */
(function(root){
 'use strict';
 const chrome=root.chrome;
 const ORIGIN='https://flzsh.github.io',BASE=ORIGIN+'/canvas-harness-packs/',ENGINE=1,ALARM='megapack-resume',AT_ONCE=4,TRIES=6,FILE_TIME=60000;
 const LIMIT=Object.freeze({catalog:1000000,manifest:200000,bytes:80000000,file:6000000});
 // The names the train engine reads in its frames (the exporter's DOWNLOAD_RULES): lands L, stages S. (abyss stays in L though
 // 4.2.2 shows it nowhere: megapack version 2 carries the deep sea's files, and a version 2 must stay whole and valid)
 const L='(?:abyss|citadel|clouds|grove|mesa|metro|peaks|sea)',S='(?:morning|noon|sunset|dusk|night)';
 const TRAIN=new RegExp(`^(?:page-${L}-${S}(?:-[0-9])?\\.webp|land-${L}-${S}-[0-9]\\.webp|(?:cabin|pieces)-(?:${L}-)?${S}\\.webp|flow-${L}-[0-9]\\.webp|sprites-${L}(?:-${S})?\\.webp|glow-${L}-${S}-[0-9]\\.webp|(?:alt|ids)-${L}-${S}-[0-9]\\.webp|clear-${L}-${S}\\.webp|under(?:-${L})?\\.webp|(?:live|sun)-${L}\\.json)$`);
 // id -> the scene whose code reads it, its names, and one downloaded file that tells whether the package still holds them
 const PACKS=Object.freeze({'soul-passage':Object.freeze({scene:'train',names:TRAIN,probe:'live-clouds.json'})});
 const TYPES=Object.freeze({webp:'image/webp',png:'image/png',json:'application/json'});
 const TEXT=Object.freeze({
  net:'The connection to the Market was lost. The download goes on from where it stopped.',
  check:'A file from the Market did not match its check. Try again later.',
  bad:'The Market listing for this is not valid.',
  update:'Update Canvas Harness to add this',
  room:'There is not enough room on this computer for it.',
  missing:'This is not on the Market now.',
  gone:'The download stopped.'
 });
 const problem=(kind,text)=>Object.assign(Error(text||TEXT[kind]),{kind});
 // "needs": the least version of Canvas Harness that can use the row (a.b.c). A row needing a newer one than this is refused
 // with the update text, as a newer engine is.
 const versionOf=text=>/^(\d{1,4})\.(\d{1,4})\.(\d{1,6})$/.exec(String(text||''))?.slice(1).map(Number)||null;
 function newer(needs,running){const a=versionOf(needs),b=versionOf(running);if(!a||!b)return false;for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;}
 const running=()=>{try{return String(chrome?.runtime?.getManifest?.()?.version||'');}catch{return '';}};
 const RECORD=id=>'megapack:'+id,JOB=id=>'megapack-job:'+id,CACHE=id=>'megapack-'+id;
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null;
 const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 const hex64=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
 const printable=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max&&v===v.trim()&&!/[\p{C}\u2028\u2029]/u.test(v);
 const extOf=name=>name.slice(name.lastIndexOf('.')+1);
 const known=id=>typeof id==='string'&&Object.hasOwn(PACKS,id);
 const fileKey=(id,file)=>BASE+'megapacks/'+id+'/files/'+file.sha256+'.'+extOf(file.name);
 const storedKey=(id,stored)=>BASE+'megapacks/'+id+'/files/'+stored;
 const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
 const sha256=async bytes=>hex(await root.crypto.subtle.digest('SHA-256',bytes));
 const utf8=bytes=>new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const now=()=>Date.now();
 const local=()=>chrome.storage.local,session=()=>chrome.storage.session;
 const ownerOf=v=>
   object(v)&&typeof v.origin==='string'&&/^https:\/\/[a-z0-9.-]+$/i.test(v.origin)&&typeof v.accountId==='string'&&/^\d+$/.test(v.accountId)?{origin:v.origin,accountId:v.accountId}:null;

 // ---- checks (the protocol's limits) ----
 function checkRow(id,raw){
  if(!known(id))throw problem('bad');
  const row=object(raw),file=typeof row?.file==='string'?/^megapacks\/([a-z0-9-]+)\/([1-9][0-9]{0,5})\.json$/.exec(row.file):null;
  if(!row||
    row.id!==id||
    row.kind!=='megapack'||
    !printable(row.name,120)||
    !file||
    file[1]!==id||
    !int(row.size,1,LIMIT.manifest)||
    !hex64(row.sha256)||
    !int(row.bytes,1,Number.MAX_SAFE_INTEGER)||
    typeof row.needs!=='string'||
    !/^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(row.needs)||
    typeof row.scene!=='string'||
    !int(row.engine,1,Number.MAX_SAFE_INTEGER))
    throw problem('bad');
  // a well-formed row for a newer engine, a scene this code does not have, or more bytes than this build takes: an update brings it
  if(row.scene!==PACKS[id].scene||row.engine>ENGINE||row.bytes>LIMIT.bytes||newer(row.needs,running()))throw problem('update');
  return {
    id,
    name:row.name,
    kind:'megapack',
    file:row.file,
    size:row.size,
    sha256:row.sha256,
    bytes:row.bytes,
    scene:row.scene,
    engine:row.engine,
    needs:row.needs,
    version:Number(file[2])
  };
 }
 function checkManifest(id,bytes,row){
  if(bytes.byteLength!==row.size||bytes.byteLength>LIMIT.manifest)throw problem('check');
  let m;try{m=JSON.parse(utf8(bytes));}catch{throw problem('bad');}
  const keys=['megapack','scene','version','engine','bytes','files'];
  if(!object(m)||
    Object.keys(m).length!==keys.length||
    !keys.every(k=>Object.hasOwn(m,k))||
    m.megapack!==id||
    m.scene!==row.scene||
    m.version!==row.version||
    m.engine!==row.engine||
    m.bytes!==row.bytes||
    !Array.isArray(m.files)||
    !m.files.length)
    throw problem('bad');
  let total=0,last='';const names=PACKS[id].names;
  for(const f of m.files){
   if(!object(f)||Object.keys(f).length!==3||typeof f.name!=='string'||f.name.length>100||!names.test(f.name)||!int(f.size,1,LIMIT.file)||!hex64(f.sha256))throw problem('bad');
   if(f.name<=last)throw problem('bad'); // sorted by name, never twice
   last=f.name;total+=f.size;
  }
  if(total!==m.bytes||total>LIMIT.bytes)throw problem('bad');
  return {version:m.version,engine:m.engine,bytes:m.bytes,files:m.files.map(f=>({name:f.name,size:f.size,sha256:f.sha256}))};
 }
 // the right kind of bytes for the name (a picture is a picture; data parses)
 function kindOK(name,bytes){
  const ext=extOf(name),ascii=(a,b)=>String.fromCharCode(...bytes.subarray(a,b));
  if(ext==='webp')return bytes.length>=12&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';
  if(ext==='png')return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
  if(ext==='json')try{JSON.parse(utf8(bytes));return true;}catch{return false;}
  return false;
 }

 // ---- the Market (no cookies, no referrer, nothing of the student) ----
 async function download(url,limit,signal){
  let response;
  try{response=await root.fetch(url,{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',signal});}
  catch(error){throw problem(signal?.aborted?'gone':'net');}
  let reader;
  try{
   if(!response.ok)throw problem('net');
   if(response.redirected||response.url&&response.url!==url)throw problem('bad');
   const length=response.headers?.get?.('content-length');if(length!=null&&(!/^\d+$/.test(length)||Number(length)>limit))throw problem('check');
   reader=response.body?.getReader?.();if(!reader)throw problem('net');
   const bytes=new Uint8Array(limit);let size=0;
   for(;;){
    let part;try{part=await reader.read();}catch{throw problem(signal?.aborted?'gone':'net');}
    if(part.done)break;const value=part.value;
    if(!(value instanceof Uint8Array))throw problem('check');if(value.byteLength>limit-size)throw problem('check');
    bytes.set(value,size);size+=value.byteLength;
   }
   return bytes.subarray(0,size);
  }catch(error){try{if(reader)await reader.cancel();else await response.body?.cancel?.();}catch{}throw error;}
  finally{try{reader?.releaseLock();}catch{}}
 }
 async function fetchRow(id,signal){
  let list;
  try{list=JSON.parse(utf8(await download(BASE+'packs.json',LIMIT.catalog,signal)));}catch(error){throw error?.kind?error:problem('bad');}
  list=Array.isArray(list)?list:Array.isArray(object(list)?.packs)?list.packs:null;if(!list)throw problem('bad');
  const rows=list.filter(r=>object(r)&&r.id===id);if(rows.length>1)throw problem('bad');if(!rows.length)throw problem('missing');
  return checkRow(id,rows[0]);
 }

 // ---- records ----
 const jobs=new Map(),gates=new Map(),bundles=new Map();
 const readLocal=async keys=>(await local().get(keys))||{};
 async function setSession(id,value){try{await session()?.set({[RECORD(id)]:{...value,at:now()}});}catch{}}
 async function saveJob(job){
   await local().set({[JOB(job.id)]:{account:job.account,look:job.look,refresh:job.refresh,tries:job.tries,...(job.retryAt?{retryAt:job.retryAt}:{}),at:job.at}});
 }
 async function arm(when){try{await chrome.alarms?.create?.(ALARM,when?{when}:{delayInMinutes:.5,periodInMinutes:.5});}catch{}}
 async function disarm(){
   try{
     if(jobs.size)return;
     const saved=await readLocal(Object.keys(PACKS).map(JOB));
     if(Object.values(saved).some(Boolean))return;
     await chrome.alarms?.clear?.(ALARM);
   }catch{}
 }
 async function complete(id,record){
  try{
   if(!object(record?.names)||!int(record.count,1,100000)||Object.keys(record.names).length!==record.count||!await root.caches.has(CACHE(id)))return false;
   const cache=await root.caches.open(CACHE(id)),keys=new Set((await cache.keys()).map(r=>r.url));
   return Object.values(record.names).every(s=>typeof s==='string'&&keys.has(storedKey(id,s)));
  }catch{return false;}
 }
 async function have(cache,key,file){
   try{
     const r=await cache.match(key);
     if(!r)return false;
     const b=new Uint8Array(await r.arrayBuffer());
     return b.byteLength===file.size&&await sha256(b)===file.sha256;
   }catch{return false;}
 }
 // progress after each file; writes are chained so "done" never goes back
 function progress(job){
  if(job.quiet)return Promise.resolve();job.dirty=true;
  if(!job.writing)job.writing=(async()=>{while(job.dirty){job.dirty=false;await setSession(job.id,{state:'getting',done:job.done,total:job.total});}job.writing=null;})();
  return job.writing;
 }

 // ---- the scene of the account that asked ----
 const accountKey=owner=>'reserve:v1:'+owner.origin+':'+owner.accountId;
 async function lookOf(owner){
  const P=root.ReservePagePreferences;if(!P||!owner)return null;
  const key=accountKey(owner),
    saved=await readLocal([key,P.KEY]),
    data=object(saved[key])||{},
    value=saved[P.KEY],
    chosen=Array.isArray(object(value)?.chosen)?value.chosen:null;
  const scene=value==null||chosen&&!chosen.includes('sceneTheme')?P.fromData(data).sceneTheme:(await P.read({read:async k=>saved[k]})).sceneTheme;
  return JSON.stringify([scene||'',object(object(data.settings)?.makeYourOwn)?.theme?.id||'']);
 }
 // When the files are here: the scene goes on for the account that asked, unless it chose another look meanwhile.
 async function sceneOn(job){
  const owner=ownerOf(job.account),scene=PACKS[job.id].scene;if(!owner||typeof job.look!=='string'||!root.ReserveStorage?.createStore)return false;
  const look=await lookOf(owner);if(JSON.parse(look)[0]===scene)return true;if(look!==job.look)return false;
  // (as a choice of the scene in Look: the device's look wears it, and the account's own theme, if any, is set aside)
  const store=root.ReserveStorage.createStore({...owner,adapter:{read:async key=>(await local().get(key))[key],write:(key,value)=>local().set({[key]:value})}});
  try{await store.load();await store.update(data=>{if(data.settings.makeYourOwn)delete data.settings.makeYourOwn.theme;data.settings.sceneTheme=scene;});}
  finally{try{store.destroy?.();}catch{}}
  return true;
 }
 // Remove: whoever wears the scene on this browser goes to none (the look is the device's; older account settings
 // decide only while it has not been chosen here).
 async function sceneOff(scene){
  const P=root.ReservePagePreferences;if(!P)return false;
  const adapter={read:async k=>(await local().get(k))[k],write:(k,v)=>local().set({[k]:v})},
    value=await adapter.read(P.KEY),
    chosen=Array.isArray(object(value)?.chosen)?value.chosen:null;
  let wearing;
  if(value!=null&&(!chosen||chosen.includes('sceneTheme')))wearing=(await P.read(adapter)).sceneTheme===scene;
  else wearing=Object.entries(await local().get(null)||{}).some(([k,v])=>/^reserve:v1:https:\/\/[^:]+:\d+$/.test(k)&&object(v)?.settings?.sceneTheme===scene);
  if(wearing)await P.write(adapter,{sceneTheme:''});return wearing;
 }

 // ---- the download ----
 async function run(job){
  const id=job.id,signal=job.ctrl.signal;
  const row=job.entry?checkRow(id,job.entry):await fetchRow(id,signal);
  job.total=row.bytes;await progress(job);
  const raw=await download(BASE+row.file,row.size,signal);
  if(raw.byteLength!==row.size||await sha256(raw)!==row.sha256)throw problem('check');
  const manifest=checkManifest(id,raw,row),cache=await root.caches.open(CACHE(id)),queue=[...manifest.files],failures=[];
  let stored=0,netFails=0,stop=false;job.done=0;job.fetched=0;
  const one=async file=>{
   const key=fileKey(id,file);
   if(await have(cache,key,file)){stored++;job.done+=file.size;progress(job);return;}
   for(let attempt=1;!stop&&!signal.aborted;attempt++){
    try{
     const bytes=await download(key,file.size,AbortSignal.any([signal,AbortSignal.timeout(FILE_TIME)]));
     if(bytes.byteLength!==file.size||await sha256(bytes)!==file.sha256||!kindOK(file.name,bytes))throw problem('check');
     if(signal.aborted)return;
     try{await cache.put(key,new Response(bytes,{headers:{'content-type':TYPES[extOf(file.name)]}}));}catch(error){throw error?.name==='QuotaExceededError'?problem('room'):error;}
     netFails=0;stored++;job.fetched++;job.done+=file.size;progress(job);return;
    }catch(error){
     if(signal.aborted)return;
     const kind=['check','room','bad'].includes(error?.kind)?error.kind:'net';
     if(kind==='net'&&attempt<2)continue;
     if(kind==='net'&&++netFails>=3||kind==='room')stop=true;
     failures.push(problem(kind));return;
    }
   }
  };
  await Promise.all(Array.from({length:Math.min(AT_ONCE,queue.length)},async()=>{while(queue.length&&!stop&&!signal.aborted)await one(queue.shift());}));
  if(signal.aborted)throw problem('gone');
  if(failures.length||stored!==manifest.files.length)throw failures.find(f=>f.kind==='room')||failures.find(f=>f.kind==='check')||failures[0]||problem('net');
  await job.writing;
  const names={};for(const f of manifest.files)names[f.name]=f.sha256+'.'+extOf(f.name);
  const record={version:manifest.version,engine:manifest.engine,bytes:manifest.bytes,count:manifest.files.length,manifest:row.sha256,names,at:now()};
  await local().set({[RECORD(id)]:record});
  await setSession(id,{state:'here',done:record.bytes,total:record.bytes});
  // files no version names any more
  try{const keep=new Set(manifest.files.map(f=>fileKey(id,f)));for(const request of await cache.keys())if(!keep.has(request.url))await cache.delete(request);}catch{}
  return record;
 }
 async function failed(job,error){
  // a failure of our own kinds speaks plainly; anything else is logged and shown as a stop (and retried)
  if(!error?.kind)console.warn('Canvas Harness megapack:',error?.message||error);
  const id=job.id,kind=error?.kind||'net',reason=error?.kind?String(error.message).slice(0,160):TEXT.gone;
  await job.writing;jobs.delete(id);
  if(kind==='bad'||kind==='update'||kind==='missing'){try{await local().remove(JOB(id));}catch{}await disarm();}
  else{
    job.tries++;
    job.retryAt=job.tries<TRIES?now()+Math.min(60,2**(job.tries-1))*60000:0;
    try{await saveJob(job);}catch{}
    if(job.retryAt)await arm(job.retryAt);else try{await chrome.alarms?.clear?.(ALARM);}catch{}
  }
  if(!job.quiet)await setSession(id,{state:'failed',done:job.done,total:job.total,reason});
 }
 function start(id,options){
  const job={
    id,
    entry:options.entry,
    account:ownerOf(options.account),
    look:typeof options.look==='string'?options.look:null,
    refresh:!!options.quiet,
    quiet:!!options.quiet,
    tries:options.tries||0,
    at:options.at||now(),
    done:0,
    total:options.entry?.bytes||0,
    ctrl:new AbortController()
  };
  jobs.set(id,job);
  job.promise=(async()=>{
   try{
    await saveJob(job);await arm();await progress(job);
    const record=await run(job);
    await local().remove(JOB(id));jobs.delete(id);await disarm();
    try{await sceneOn(job);}catch(error){console.warn('Canvas Harness megapack: the scene was not put on:',error?.message||error);}
    return record;
   }catch(error){if(job.removed)return null;await failed(job,error);return null;}
   finally{if(jobs.get(id)===job)jobs.delete(id);}
  })();
  return job;
 }

 // ---- the API ----
 // get(id, {entry?, account?}): starts or joins the download. entry = a row the bridge read (checked again here);
 // without it packs.json is read. Answers {state:'here'|'getting', started?, joined?}.
 async function get(id,options={}){
  if(!known(id))throw problem('bad');
  if(options.entry!==undefined)checkRow(id,options.entry);
  const asked=ownerOf(options.account);
  for(;;){
   const running=jobs.get(id);
   if(running){
    if(!running.account&&asked){running.account=asked;running.look=await lookOf(asked).catch(()=>null);await saveJob(running).catch(()=>{});}
    return {state:'getting',joined:true};
   }
   const gate=gates.get(id);if(gate){await gate;continue;}
   let open;gates.set(id,new Promise(resolve=>{open=resolve;}));
   try{
    const saved=await readLocal([RECORD(id),JOB(id)]),record=object(saved[RECORD(id)]),job=object(saved[JOB(id)]),account=asked||ownerOf(job?.account);
    const whole=!!record&&await complete(id,record);
    if(record&&!whole)await local().remove(RECORD(id)); // files went missing: not here any more
    if(whole&&!options.refresh&&(!options.entry||options.entry.sha256===record.manifest)){
     if(job){await local().remove(JOB(id));await disarm();try{await sceneOn({id,account,look:job.look});}catch{}} // a job cut after its record
     await setSession(id,{state:'here',done:record.bytes,total:record.bytes});return {state:'here'};
    }
    const look=typeof options.look==='string'?options.look:job&&!asked?job.look:asked?await lookOf(asked).catch(()=>null):null;
    // a newer version while the one here stays usable: no progress shown, nothing taken away
    start(id,{entry:options.entry,account,look,quiet:whole,tries:options.tries,at:job?.at});
    return {state:'getting',started:true};
   }finally{gates.delete(id);open();}
  }
 }
 // state(id): the session record, or {state:'here'} from the local record, or {state:'none'}; bundled:true while the
 // package itself still holds the files.
 async function state(id){
  if(!known(id))throw problem('bad');
  let s=null;try{s=object((await session()?.get(RECORD(id)))?.[RECORD(id)]);}catch{}
  const extra=await bundled(id)?{bundled:true}:{};
  if(s&&(s.state==='getting'||s.state==='failed')){
   if(s.state==='getting'&&!jobs.has(id))void resumeAll({reason:'wake'}); // the worker slept or restarted mid-download
   return {
     state:s.state,
     done:int(s.done,0,LIMIT.bytes)?s.done:0,
     total:int(s.total,0,LIMIT.bytes)?s.total:0,
     ...(s.state==='failed'&&typeof s.reason==='string'?{reason:s.reason}:{}),
     ...(int(s.at,0,Number.MAX_SAFE_INTEGER)?{at:s.at}:{}),
     ...extra
   };
  }
  // a download that has started but not written its first progress record yet is already "getting" (the picker asked at once
  // after its press and was told "none" for a moment); a quiet refresh of files that are here shows nothing
  const running=jobs.get(id);
  if(running&&!running.quiet)return {state:'getting',done:int(running.done,0,LIMIT.bytes)?running.done:0,total:int(running.total,0,LIMIT.bytes)?running.total:0,...extra};
  if(object((await readLocal(RECORD(id)))[RECORD(id)]))return {state:'here',...extra};
  return extra.bundled?{state:'here',bundled:true}:{state:'none'};
 }
 // bundled(id): the package still holds the downloaded kind of file (decided once per worker life)
 function bundled(id){
  if(!known(id))return Promise.resolve(false);
  if(!bundles.has(id))
    bundles.set(id,(async()=>{
      try{
        const r=await root.fetch(chrome.runtime.getURL('themes/'+PACKS[id].scene+'/'+PACKS[id].probe));
        const ok=!!r?.ok;
        try{await r.body?.cancel?.();}catch{}
        return ok;
      }catch{return false;}
    })());
  return bundles.get(id);
 }
 async function remove(id){
  if(!known(id))throw problem('bad');
  for(;;){const gate=gates.get(id);if(!gate)break;await gate;}
  const job=jobs.get(id);if(job){job.removed=true;job.ctrl.abort();await job.promise.catch(()=>{});}
  try{await root.caches?.delete(CACHE(id));}catch{}
  await local().remove([RECORD(id),JOB(id)]);try{await session()?.remove(RECORD(id));}catch{}
  await disarm();
  let off=false;try{off=await sceneOff(PACKS[id].scene);}catch(error){console.warn('Canvas Harness megapack: the scene was not taken off:',error?.message||error);}
  return {state:await bundled(id)?'here':'none',sceneOff:off};
 }
 async function installed(){const saved=await readLocal(Object.keys(PACKS).map(RECORD));return Object.keys(PACKS).filter(id=>object(saved[RECORD(id)]));}
 async function getting(){
  let saved={};try{saved=await session()?.get(Object.keys(PACKS).map(RECORD))||{};}catch{}
  return Object.keys(PACKS).filter(id=>jobs.has(id)&&!jobs.get(id).quiet||object(saved[RECORD(id)])?.state==='getting');
 }
 // resumeAll: from onStartup, onInstalled, the alarm and every start of the worker. A cut download goes on (a failed
 // one waits for its retry time, except on a fresh start); after an update a record for an older engine is refreshed
 // (only changed files come down); a record whose files went missing is fetched again.
 async function resumeAll(details={}){
  const reason=details.reason||'wake',fresh=['startup','install','update'].includes(reason),out={};
  for(const id of Object.keys(PACKS)){
   try{
    if(jobs.has(id)){out[id]='running';continue;}
    const saved=await readLocal([RECORD(id),JOB(id)]),record=object(saved[RECORD(id)]),job=object(saved[JOB(id)]);
    if(job){
     if(!fresh&&int(job.retryAt,1,Number.MAX_SAFE_INTEGER)&&job.retryAt>now()){await arm(job.retryAt);out[id]='later';continue;}
     if(!fresh&&int(job.tries,TRIES,Number.MAX_SAFE_INTEGER)){out[id]='waiting';continue;}
     out[id]=(await get(id,{
       account:job.account,
       look:typeof job.look==='string'?job.look:undefined,
       refresh:job.refresh===true,
       tries:fresh?0:int(job.tries,0,TRIES)?job.tries:0
     })).state;
     continue;
    }
    if(record&&reason==='update'&&!(record.engine>=ENGINE)){out[id]=(await get(id,{refresh:true})).state;continue;}
    if(record&&fresh&&!await complete(id,record)){out[id]=(await get(id,{})).state;continue;}
    out[id]=record?'here':'none';
   }catch{out[id]='error';}
  }
  await disarm();return out;
 }
 const api=Object.freeze({
   ENGINE,
   BASE,
   LIMIT,
   ids:Object.keys(PACKS),
   known,
   newer,
   sceneOf:id=>known(id)?PACKS[id].scene:'',
   nameOK:(id,name)=>known(id)&&typeof name==='string'&&name.length<=100&&PACKS[id].names.test(name),
  cacheName:CACHE,recordKey:RECORD,jobKey:JOB,fileKey,checkRow,checkManifest,get,state,remove,resumeAll,bundled,installed,getting,
  running:id=>{const job=jobs.get(id);return job?{done:job.done,total:job.total,fetched:job.fetched||0,quiet:job.quiet}:null;},
  wait:id=>jobs.get(id)?.promise||Promise.resolve(null)});
 root.ReserveMegapack=api;
 // The worker: picked up again on every start, onStartup, onInstalled, and the alarm while a download runs.
 if(typeof root.importScripts==='function'&&chrome?.runtime?.id){
  chrome.runtime.onStartup?.addListener(()=>{void resumeAll({reason:'startup'});});
  chrome.runtime.onInstalled?.addListener(details=>{void resumeAll({reason:['install','update'].includes(details?.reason)?details.reason:'startup'});});
  chrome.alarms?.onAlarm?.addListener(alarm=>{if(alarm?.name===ALARM)void resumeAll({reason:'alarm'});});
  void resumeAll({reason:'wake'}).catch(()=>{});
 }
})(globalThis);
