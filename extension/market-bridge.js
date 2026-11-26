/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Canvas Harness market: isolated, trusted-click-only pack downloads. */
(function(){
 'use strict';
 const ORIGIN='https://flzsh.github.io',PREFIX='/canvas-harness-packs/',MAX_CATALOG=1000000,MAX_PACK=40000000,KINDS=['kit','course-art','feature','theme','pet','preset'],UPDATE='Update Canvas Harness to add this';
 const printable=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&value===value.trim()&&!/[\p{C}\u2028\u2029]/u.test(value);
 const validId=value=>printable(value,100)&&/^[a-z0-9][a-z0-9._-]*$/i.test(value)&&!['__proto__','constructor','prototype'].includes(value);
 const RELOADED='Canvas Harness was just updated or reloaded. Reload this page, then Add again.';
 const reason=value=>{
  const text=typeof value==='string'?value:value?.message;
  if(typeof text==='string'&&/context invalidated|receiving end does not exist|message port closed/i.test(text))return RELOADED;
  return (typeof text==='string'?text:'Install failed').replace(/[^\x20-\x7e]/g,' ').trim().slice(0,160)||'Install failed';
 };
 function safeURL(raw,base){
  if(typeof raw!=='string'||raw.length>2048||!/^[\x21-\x7e]+$/.test(raw)||/[\\%?#]/.test(raw)||raw.split('/').some(part=>part==='.'||part==='..'))throw Error('Unsafe market URL');
  const url=new URL(raw,base);
  if(url.protocol!=='https:'||
   url.origin!==ORIGIN||
   url.username||
   url.password||
   /\/\/[^/]*@/.test(raw)||
   url.search||
   url.hash||
   !url.pathname.startsWith(PREFIX)||
   url.pathname.includes('%'))
   throw Error('Unsafe market URL');
  return url;
 }
 let initial;try{initial=safeURL(location.href);}catch{return;}
 const post=message=>window.postMessage({ch:'market',...message},location.origin);
 /* The band gate (one Market card, two files). A theme row may carry "bands": [{level, file, size, sha256}], copies of the
    same theme with a band. Versions before 4.1 keep only {id, name, kind, file, size, sha256} and install the plain
    "file"; this one installs the highest band copy whose level its band kit reads, and the plain file whenever no copy
    fits or a copy's fields are not usable. BAND is band-kit.js's level, written here so a click never waits on the
    worker (a test keeps the two equal). */
 const BAND=2;
 /* Megapacks (megapack engine 1): a row of kind "megapack" points at a manifest; the worker downloads its files itself.
    Versions before 4.2 skip the kind (unknown kinds return null). MEGAPACK is the highest megapack engine this extension
    has code for (megapack.js ENGINE; a test keeps the two equal); it is told to the page once after load. A row that needs
    a newer Canvas Harness than this one (its "needs") is skipped the same way, so its Add says to update; so is a row bigger than this build takes
   (MAX_MEGA), never spoiling the rest of the catalogue. */
 const MEGAPACK=1,MEGA_SCENES=['train'],MAX_MANIFEST=200000,MAX_MEGA=80000000,MEGA_ID=/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
 const versionOf=text=>/^(\d{1,4})\.(\d{1,4})\.(\d{1,6})$/.exec(String(text||''))?.slice(1).map(Number)||null;
 function needsNewer(needs){
  let here=null;try{here=versionOf(chrome.runtime.getManifest?.()?.version);}catch{}
  const want=versionOf(needs);if(!want||!here)return false;
  for(let i=0;i<3;i++)if(want[i]!==here[i])return want[i]>here[i];
  return false;
 }
 function megapackEntry(raw,base){
  if(!MEGA_ID.test(String(raw.id))||
   !validId(raw.id)||
   !printable(raw.name,120)||
   typeof raw.file!=='string'||
   !new RegExp('^megapacks/'+raw.id+'/[1-9][0-9]{0,5}\\.json$').test(raw.file)||
   !Number.isSafeInteger(raw.size)||
   raw.size<1||
   raw.size>MAX_MANIFEST||
   typeof raw.sha256!=='string'||
   !/^[0-9a-f]{64}$/.test(raw.sha256)||
   !Number.isSafeInteger(raw.bytes)||
   raw.bytes<1||
   typeof raw.scene!=='string'||
   !/^[a-z][a-z0-9-]{0,40}$/.test(raw.scene)||
   !Number.isSafeInteger(raw.engine)||
   raw.engine<1||
   typeof raw.needs!=='string'||
   !/^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(raw.needs))
   throw Error('Invalid market catalog entry');
  safeURL(raw.file,base);
  if(raw.engine>MEGAPACK||!MEGA_SCENES.includes(raw.scene)||raw.bytes>MAX_MEGA||needsNewer(raw.needs))return null;
  return {id:raw.id,name:raw.name,kind:'megapack',file:raw.file,size:raw.size,sha256:raw.sha256,bytes:raw.bytes,scene:raw.scene,engine:raw.engine,needs:raw.needs};
 }
 function banded(raw,item,base){
  let best=item,top=0;if(item.kind!=='theme'||!Array.isArray(raw?.bands))return item;
  for(const b of raw.bands.slice(0,8)){
   try{
    if(!b||
     typeof b!=='object'||
     Array.isArray(b)||
     !Number.isInteger(b.level)||
     b.level<1||
     b.level>BAND||
     b.level<=top||
     !Number.isSafeInteger(b.size)||
     b.size<1||
     b.size>MAX_PACK||
     typeof b.sha256!=='string'||
     !/^[0-9a-f]{64}$/.test(b.sha256))
     continue;
    safeURL(b.file,base);
    best={...item,file:b.file,size:b.size,sha256:b.sha256};
    top=b.level;
   }catch{}
  }
  return best;
 }
 async function installed(){
  try{
   const reply=await chrome.runtime.sendMessage({type:'market-installed'});
   if(reply?.ok===true&&Array.isArray(reply.installed)&&safeURL(location.href).href===initial.href){
    // what this version's band kit reads (its level and block names), so the page can say when a band needs a later version
    const band=reply.band&&typeof reply.band==='object'&&!Array.isArray(reply.band)&&Number.isInteger(reply.band.level)&&reply.band.level>0?
     JSON.parse(JSON.stringify(reply.band)):
     null;
    post({installed:[...new Set(reply.installed.filter(validId))],...(band?{band}:{})});
    // a megapack still coming down (asked from Canvas, or before this page was reloaded): its progress is followed from here
    if(Array.isArray(reply.getting))for(const id of new Set(reply.getting.slice(0,8)))if(typeof id==='string'&&MEGA_ID.test(id))void follow(id,{state:'getting'});
   }
  }catch{}
 }
 async function download(url,limit){
  const response=await fetch(url.href,{credentials:'omit',redirect:'error'});let reader;
  try{
   if(!response.ok)throw Error('Market download failed');if(response.redirected||safeURL(response.url).href!==url.href)throw Error('Unexpected market download URL');
   const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>limit))throw Error('Download exceeds size limit');
   reader=response.body?.getReader();if(!reader)throw Error('Streaming download unavailable');const bytes=new Uint8Array(limit);let size=0;
   for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    if(!(value instanceof Uint8Array))throw Error('Invalid download data');
    if(value.byteLength>limit-size)throw Error('Download exceeds size limit');
    bytes.set(value,size);
    size+=value.byteLength;
   }
   return bytes.subarray(0,size);
  }catch(error){try{if(reader)await reader.cancel();else await response.body?.cancel?.();}catch{}throw error;}finally{reader?.releaseLock();}
 }
 function catalogEntry(raw,base){
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&raw.kind==='megapack')return megapackEntry(raw,base);
  if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&typeof raw.kind==='string'&&!KINDS.includes(raw.kind))return null;
  if(!raw||
   typeof raw!=='object'||
   Array.isArray(raw)||
   !validId(raw.id)||
   !printable(raw.name,120)||
   !KINDS.includes(raw.kind)||
   !Number.isSafeInteger(raw.size)||
   raw.size<1||
   raw.size>MAX_PACK||
   typeof raw.sha256!=='string'||
   !/^[0-9a-f]{64}$/.test(raw.sha256))
   throw Error('Invalid market catalog entry');
  safeURL(raw.file,base);
  return {id:raw.id,name:raw.name,kind:raw.kind,file:raw.file,size:raw.size,sha256:raw.sha256};
 }
 function base64(bytes){let encoded='';for(let i=0;i<bytes.length;i+=24576)encoded+=btoa(String.fromCharCode(...bytes.subarray(i,i+24576)));return encoded;}
 async function install(id){
  const page=safeURL(location.href),
   catalogURL=safeURL('packs.json',page),
   catalog=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await download(catalogURL,MAX_CATALOG))),
   list=Array.isArray(catalog)?catalog:catalog?.packs;
  if(!Array.isArray(list))throw Error('Invalid market catalog');const ids=new Set();let entry,unsupported=false;
  for(const raw of list){
   const item=catalogEntry(raw,catalogURL);
   if(!item){if(raw.id===id)unsupported=true;continue;}
   if(ids.has(item.id))throw Error('Duplicate market pack id');
   ids.add(item.id);
   if(item.id===id)entry=banded(raw,item,catalogURL);
  }
  if(!entry)throw Error(unsupported?UPDATE:'Market pack not found');
  // A megapack's files come down in the worker (file by file, checked there); this page only follows its progress.
  if(entry.kind==='megapack'){
   if(safeURL(location.href).href!==page.href)throw Error('Market page changed');
   const reply=await chrome.runtime.sendMessage({type:'megapack-get',id:entry.id,entry});
   if(reply?.ok!==true)throw Error(reason(reply?.reason||reply?.error));
   return {megapack:{state:reply.state}};
  }
  const bytes=await download(safeURL(entry.file,catalogURL),entry.size);
  if(bytes.byteLength!==entry.size)throw Error('Pack size does not match');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  if(hash!==entry.sha256)throw Error('Pack hash does not match');
  if(safeURL(location.href).href!==page.href)throw Error('Market page changed');
  const reply=await chrome.runtime.sendMessage({type:'market-install',entry,bytes:base64(bytes)});
  if(reply?.ok!==true)throw Error(reason(reply?.reason||reply?.error));
  return null;
 }
 /* While a megapack comes down: its state is asked of the worker (content scripts cannot read chrome.storage.session)
    every 250 ms, so the page gets at most 4 "getting" messages a second, then "added" or "failed". Asking also keeps
    the worker awake, and wakes it to go on if it slept. A click on that card meanwhile does nothing. */
 const following=new Set(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function follow(id,first){
  if(following.has(id))return;
  following.add(id);
  let last='',state=first;
  try{
   for(;;){
    if(state?.state==='here'){post({id,state:'added',reason:''});return;}
    if(state?.state==='failed'||state?.state==='none'){post({id,state:'failed',reason:reason(state.state==='none'?'The download stopped.':state.reason||'The download stopped.')});return;}
    const done=state?.done,total=state?.total;
    if(state?.state==='getting'&&Number.isSafeInteger(total)&&total>0&&Number.isSafeInteger(done)&&done>=0){
     const now=Math.min(done,total)+'/'+total;
     if(now!==last){last=now;post({id,state:'getting',done:Math.min(done,total),total});}
    }
    await wait(250);
    const reply=await chrome.runtime.sendMessage({type:'megapack-state',id});
    if(reply?.ok!==true)throw Error(reason(reply?.reason||reply?.error));
    state=reply;
   }
  }catch(error){post({id,state:'failed',reason:reason(error)});}finally{following.delete(id);}
 }
 let busy=false;
 document.addEventListener('click',async event=>{
  if(event.isTrusted!==true)return;
  const target=event.target?.nodeType===1?event.target:event.target?.parentElement,button=target?.closest?.('[data-ch-pack]');
  if(!button||!document.contains(button))return;
  const id=button.getAttribute('data-ch-pack');
  if(!validId(id))return;
  event.preventDefault();
  if(busy||following.has(id))return;
  busy=true;
  let megapack=null;
  try{
   const result=await install(id);
   if(result&&typeof result==='object'&&result.megapack)megapack=result.megapack;
   else post({id,state:'added',reason:''});
  }catch(error){post({id,state:'failed',reason:reason(error)});}finally{busy=false;}
  if(megapack)await follow(id,megapack);
 },true);
 void installed();
 // once after load: the megapack engine this extension has code for (no such message: the page asks for a newer version)
 let told=false;
 const hello=()=>{if(told)return;told=true;post({megapack:MEGAPACK});};
 if(document.readyState==='complete')hello();else window.addEventListener?.('load',hello,{once:true});
})();
