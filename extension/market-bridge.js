/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Canvas Harness market: isolated, trusted-click-only pack downloads. */
(function(){
 'use strict';
 const ORIGIN='https://flzsh.github.io',PREFIX='/canvas-harness-packs/',MAX_CATALOG=1000000,MAX_PACK=40000000,KINDS=['kit','course-art','feature','theme','pet','preset'],UPDATE='Update Canvas Harness to add this';
 const printable=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&value===value.trim()&&!/[\p{C}\u2028\u2029]/u.test(value);
 const validId=value=>printable(value,100)&&/^[a-z0-9][a-z0-9._-]*$/i.test(value)&&!['__proto__','constructor','prototype'].includes(value);
 const reason=value=>{const text=typeof value==='string'?value:value?.message;return (typeof text==='string'?text:'Install failed').replace(/[^\x20-\x7e]/g,' ').trim().slice(0,160)||'Install failed';};
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
 async function installed(){
  try{
   const reply=await chrome.runtime.sendMessage({type:'market-installed'});
   if(reply?.ok===true&&Array.isArray(reply.installed)&&safeURL(location.href).href===initial.href)post({installed:[...new Set(reply.installed.filter(validId))]});
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
   if(item.id===id)entry=item;
  }
  if(!entry)throw Error(unsupported?UPDATE:'Market pack not found');
  const bytes=await download(safeURL(entry.file,catalogURL),entry.size);
  if(bytes.byteLength!==entry.size)throw Error('Pack size does not match');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  if(hash!==entry.sha256)throw Error('Pack hash does not match');
  if(safeURL(location.href).href!==page.href)throw Error('Market page changed');
  const reply=await chrome.runtime.sendMessage({type:'market-install',entry,bytes:base64(bytes)});
  if(reply?.ok!==true)throw Error(reason(reply?.reason||reply?.error));
 }
 let busy=false;
 document.addEventListener('click',async event=>{
  if(event.isTrusted!==true)return;
  const target=event.target?.nodeType===1?event.target:event.target?.parentElement,button=target?.closest?.('[data-ch-pack]');
  if(!button||!document.contains(button))return;
  const id=button.getAttribute('data-ch-pack');
  if(!validId(id))return;
  event.preventDefault();
  if(busy)return;
  busy=true;
  try{await install(id);post({id,state:'added',reason:''});}catch(error){post({id,state:'failed',reason:reason(error)});}finally{busy=false;}
 },true);
 void installed();
})();
