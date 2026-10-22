/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Pure saved-reference validation and read-only portable document access.
 * Safe for Lite: no DOM, media decoding, IDB, object URLs, timers or listeners.
 */
(function(root){
 'use strict';
 const limits=Object.freeze({imageBytes:3000000,animatedBytes:3000000,inputBytes:30000000,videoBytes:30000000,totalBytes:60000000,imageWidth:2400,backgroundWidth:3840,videoWidth:1920,duration:60,sourceDuration:3600,animationFrames:300,animationPixels:240000000,decodeMs:10000});
 const slots=Object.freeze(['bannerArt','cardArt','backgroundArt','titleArt']),frameKeys=Object.freeze(['asset','fit','focus','zoom','height','loop','still']);
 const uuid=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,color=/^#[\da-f]{6}$/i,kinds=['theme','pet','preset'];
 const own=(value,key)=>Object.hasOwn(value,key),record=value=>value&&typeof value==='object'&&!Array.isArray(value),fail=message=>{throw Error(message);};
 const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
 const packId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(value)&&!['__proto__','constructor','prototype'].includes(value);
 function nameOf(value,max=160){if(typeof value!=='string'||!value.trim()||value.length>max||/[\p{C}\u2028\u2029]/u.test(value))fail('Choose a valid file name.');return value.trim();}
 function dimensions(width,height,maxWidth){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>maxWidth||height>16000||width*height>48000000)fail('Media dimensions are too large.');}
 const nativeObject=Function.prototype.toString.call(Object);
 function dataRecord(value,allowed,label='media framing'){
  if(!record(value))fail('Invalid '+label+'.');const proto=Object.getPrototypeOf(value);
  if(proto){const ctor=Object.getOwnPropertyDescriptor(proto,'constructor'),original=ctor&&own(ctor,'value')&&typeof ctor.value==='function'&&Object.getOwnPropertyDescriptor(ctor.value,'prototype');if(!original||original.value!==proto||Function.prototype.toString.call(ctor.value)!==nativeObject||Object.getPrototypeOf(proto)!==null)fail('Invalid '+label+'.');}
  const out=Object.create(null);for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!allowed.includes(key)||!d?.enumerable||!own(d,'value'))fail('Invalid '+label+' field.');out[key]=d.value;}return out;
 }
 function videoSource({size,width,height,duration},input=false){
  if(!Number.isSafeInteger(size)||size<=0||size>limits.videoBytes)fail('Video must be at most 30 MB.');dimensions(width,height,input?16000:limits.videoWidth);
  if(!Number.isFinite(duration)||duration<=0||duration>limits.sourceDuration)fail('Video must be at most 3600 s.');
 }
 function videoTiming(duration,options={}){
  if(!Number.isFinite(duration)||duration<=0||duration>limits.sourceDuration)fail('Invalid video duration.');const input=dataRecord(options,['loop','still']);
  const time=value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>duration)fail('Invalid media framing time.');return value;};
  const loop=input.loop===undefined?{start:0,end:Math.min(duration,limits.duration)}:dataRecord(input.loop,['start','end']);const start=time(loop.start),end=time(loop.end);
  if(end-start<.05||end-start>limits.duration)fail('Video loop must be from 0.05 s to 60 s.');
  const still=input.still===undefined?start+(end-start>1.5?Math.min(1,(end-start)/3):0):time(input.still);return {loop:{start,end},still};
 }
 function validateVideo(value,options={}){videoSource(value);const input=dataRecord(options,['loop','still']);if(input.loop===undefined&&value.duration>limits.duration)fail('Video must be at most 60 s.');videoTiming(value.duration,input);}
 function framed(value){return record(value)&&own(value,'asset');}
 function asset(value){if(!framed(value))return value;const d=Object.getOwnPropertyDescriptor(value,'asset');if(!d||!own(d,'value')||!d.enumerable)fail('Invalid media framing asset.');return d.value;}
 function cleanFrame(value,cleanAsset=value=>value){
  const input=dataRecord(value,frameKeys);if(!own(input,'asset'))fail('Invalid media framing asset.');const a=cleanAsset(input.asset);if(!record(a))fail('Invalid media framing asset.');
  const number=(value,min,max)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail('Invalid media framing number.');return value;},focus=input.focus===undefined?{x:.5,y:.5}:dataRecord(input.focus,['x','y']);
  const out={asset:a,focus:{x:number(focus.x,0,1),y:number(focus.y,0,1)},zoom:number(input.zoom===undefined?1:input.zoom,1,4),fit:input.fit===undefined?'cover':input.fit,height:input.height===undefined?'medium':input.height};
  if(!['cover','contain'].includes(out.fit)||!['small','medium','tall'].includes(out.height))fail('Invalid media framing setting.');
  const video=a.kind==='video'||/^video\//.test(a.type||''),duration=Number.isFinite(a.duration)?a.duration:limits.sourceDuration;
  if(own(input,'loop')){if(!video)fail('Only video has loop framing.');const loop=dataRecord(input.loop,['start','end']),start=number(loop.start,0,duration),end=number(loop.end,0,duration);if(end-start<.05||end-start>limits.duration)fail('Video loop must be from 0.05 s to 60 s.');out.loop={start,end};}
  if(own(input,'still')){if(!video)fail('Only video has a still time.');out.still=number(input.still,0,duration);}return out;
 }
 function cleanReference(value,slot='banner'){
  value=dataRecord(value,['mediaId','name','type','kind','width','height','duration','palette','animated'],'media reference');
  if(!['banner','card','background','title'].includes(slot)||typeof value.mediaId!=='string'||!uuid.test(value.mediaId))fail('Invalid media reference.');
  const video=['video/mp4','video/webm'].includes(value.type);
  if(value.kind!==(video?'video':'image')||!video&&!['image/webp','image/png'].includes(value.type)&&!(value.type==='image/gif'&&value.animated===true&&slot!=='title')||video&&slot==='title')fail('Invalid artwork type.');
  if(own(value,'animated')&&(typeof value.animated!=='boolean'||value.animated&&!['image/gif','image/webp'].includes(value.type)))fail('Invalid media animation setting.');
  dimensions(value.width,value.height,video?limits.videoWidth:slot==='background'?limits.backgroundWidth:limits.imageWidth);
  if(video)videoSource({size:1,width:value.width,height:value.height,duration:value.duration});else if(own(value,'duration'))fail('Invalid photo duration.');
  if(!Array.isArray(value.palette)||![0,3].includes(value.palette.length)||value.palette.some(value=>typeof value!=='string'||!color.test(value)))fail('Invalid artwork colours.');
  return {mediaId:value.mediaId,name:nameOf(value.name),type:value.type,kind:value.kind,width:value.width,height:value.height,...(video?{duration:value.duration}:{}),palette:value.palette.map(value=>value.toLowerCase()),...(own(value,'animated')?{animated:value.animated}:{})};
 }
 function referenced(settings){const ids=new Set(),looks=[settings?.themeArt,settings?.overviewArt,...Object.values(settings?.coursePrefs||{})];if(Array.isArray(settings?.customKits))for(const kit of settings.customKits.slice(0,200))looks.push(kit?.appearance);for(const pref of looks)for(const key of slots){const ref=asset(pref?.[key]);if(ref?.mediaId)ids.add(ref.mediaId);}return ids;}
 function undoMediaReferences(receipts,owner){
  ownerScope(owner);const key='reserve:v1:'+owner.origin+':'+owner.accountId,out=new Map();
  for(const receipt of Object.values(receipts||{})){
   if(!record(receipt)||receipt.kind!=='course-art'||receipt.key!==key)continue;
   if(!Array.isArray(receipt.changes)||receipt.changes.length>4000)fail('Invalid account artwork receipt.');
   for(const change of receipt.changes){
    const before=asset(change?.before);if(!before?.mediaId)continue;
    const path=change.path;if(change.beforeOwn!==true||!Array.isArray(path)||!(path.length===1&&['overviewArt','themeArt'].includes(path[0])||path.length===2&&path[0]==='coursePrefs'&&/^\d+$/.test(path[1]))||!slots.includes(change.key))fail('Invalid retained artwork reference.');
    const clean=value=>cleanReference(value,change.key.slice(0,-3)),ref=framed(change.before)?cleanFrame(change.before,clean).asset:clean(before),previous=out.get(ref.mediaId);if(previous&&JSON.stringify(previous)!==JSON.stringify(ref))fail('Conflicting retained artwork reference.');out.set(ref.mediaId,ref);
   }
  }return [...out.values()];
 }
 const undoReferences=(receipts,owner)=>new Set(undoMediaReferences(receipts,owner).map(asset=>asset.mediaId));
 function ownerScope(owner){
  let url;try{url=new URL(owner?.origin);}catch{}
  if(!url||url.protocol!=='https:'||url.username||url.password||url.port||url.origin!==owner.origin||typeof owner.accountId!=='string'||!/^\d+$/.test(owner.accountId))fail('A verified account is required for media.');
  return JSON.stringify([owner.origin,owner.accountId]);
 }
 function cleanPackDocument(value){
  if(!record(value)||Object.keys(value).some(key=>!['id','name','kind','installedAt','source','receipt','market'].includes(key))||!packId(value.id)||!kinds.includes(value.kind)||typeof value.name!=='string'||!value.name.trim()||value.name.length>120||/[\p{C}\u2028\u2029]/u.test(value.name)||!Number.isSafeInteger(value.installedAt)||value.installedAt<0||typeof value.source!=='string'||!value.source.length||bytes(value.source)>40000000||!record(value.receipt))fail('Invalid stored pack.');
  if(own(value,'market')&&(!record(value.market)||Object.keys(value.market).length!==2||value.market.id!==value.id||typeof value.market.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.market.sha256)))fail('Invalid Market provenance.');
  const check=(item,depth=0)=>{if(depth>16)fail('Invalid pack receipt.');if(item&&typeof item==='object')for(const key of Object.keys(item)){if(['__proto__','constructor','prototype'].includes(key))fail('Invalid pack receipt.');check(item[key],depth+1);}};
  check(value.receipt);if(bytes(value.receipt)>4000000)fail('Pack receipt is too large.');return structuredClone(value);
 }
 function cleanPackIndex(raw){
  if(raw===undefined)return [];
  if(!record(raw)||Object.keys(raw).some(key=>!['version','documents'].includes(key))||raw.version!==1||!Array.isArray(raw.documents)||raw.documents.length>50)fail('Invalid pack storage.');
  const ids=new Set();let total=0;
  return raw.documents.map(row=>{
   if(!record(row)||Object.keys(row).some(key=>!['id','name','kind','installedAt','bytes'].includes(key))||!packId(row.id)||ids.has(row.id)||!kinds.includes(row.kind)||typeof row.name!=='string'||!row.name.trim()||row.name.length>120||/[\p{C}\u2028\u2029]/u.test(row.name)||!Number.isSafeInteger(row.installedAt)||row.installedAt<0||!Number.isSafeInteger(row.bytes)||row.bytes<1||(total+=row.bytes)>limits.totalBytes)fail('Invalid pack storage.');
   ids.add(row.id);return structuredClone(row);
  });
 }
 function createPackReader(owner,{storage=root.chrome?.storage?.local}={}){
  const base='reserve:market-media:'+ownerScope(owner),key=base+':packs';
  async function index(){if(!storage?.get)fail('Shared pack storage is unavailable.');return cleanPackIndex((await storage.get(key))[key]);}
  async function getPack(id){
   if(!packId(id))fail('Invalid pack id.');const row=(await index()).find(row=>row.id===id);if(!row)return null;
   const documentKey=base+':pack:'+id,doc=cleanPackDocument((await storage.get(documentKey))[documentKey]);
   if(doc.id!==id||doc.name!==row.name||doc.kind!==row.kind||doc.installedAt!==row.installedAt||bytes(doc)!==row.bytes)fail('Stored pack is incomplete.');return doc;
  }
  return {listPacks:async()=>(await index()).map(({bytes,...row})=>row),getPack,close(){}};
 }
 // A worker cannot inspect Canvas-origin IndexedDB. The page can compare its
 // read-only capture and send only conflicting IDs, with no local byte payload.
 function backupConflicts(incoming,current){
  if(!incoming||!current)return;const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),media=new Map(current.assets.map(row=>[row.asset.mediaId,row])),kits=new Map(current.kits.map(row=>[row.id,row])),mediaIds=[],kitIds=[];
  for(const row of incoming.assets){const old=media.get(row.asset.mediaId);if(old&&(!equal(old.asset,row.asset)||old.bytes.type!==row.bytes.type||old.bytes.size!==row.bytes.size||old.bytes.sha256!==row.bytes.sha256||!!old.poster!==!!row.poster||row.poster&&(old.poster.type!==row.poster.type||old.poster.size!==row.poster.size||old.poster.sha256!==row.poster.sha256)))mediaIds.push(row.asset.mediaId);}
  const moved=new Set(mediaIds);for(const kit of incoming.kits){const old=kits.get(kit.id);if(old&&(!equal(old,kit)||[...referenced({overviewArt:kit.appearance})].some(id=>moved.has(id))))kitIds.push(kit.id);}
  return mediaIds.length||kitIds.length?{mediaIds,kitIds}:undefined;
 }
 const api=Object.freeze({limits,slots,frameKeys,asset,framed,cleanFrame,dataRecord,cleanReference,referenced,undoMediaReferences,undoReferences,videoSource,videoTiming,validateVideo,cleanPackDocument,cleanPackIndex,createPackReader,backupConflicts});root.ReserveMediaReference=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
