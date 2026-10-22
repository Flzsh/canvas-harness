/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Portable saved media and kit snapshots. Reads only on an explicit capture call;
 * no rendering, media decoding, object URLs, database upgrades or writes. */
(function(root){
 'use strict';
 const reference=root.ReserveMediaReference||(typeof module==='object'&&module.exports&&typeof require==='function'?require('./media-reference.js'):null);
 const limits=Object.freeze({...reference?.limits,assets:2000,kits:200,metadataBytes:6500000,fileBytes:66500000});
 const UUID=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,HASH=/^[a-f0-9]{64}$/;
 const SLOTS=['bannerArt','titleArt','borderArt','iconArt','cardArt','backgroundArt'],REF_KEYS=['mediaId','name','type','kind','width','height','duration','palette','animated'];
 const KIT_KEYS=['id','name','appearance','accent','font','bannerSize'],APPEARANCE_KEYS=[...SLOTS,'bannerFit','bannerPosition','titlePlacement'];
 const nativeObject=Function.prototype.toString.call(Object),nativeArray=Function.prototype.toString.call(Array),own=(v,k)=>Object.hasOwn(v,k);
 const fail=message=>{throw Error('Backup media: '+message);},textBytes=value=>new TextEncoder().encode(value).length;
 const dependency=(name,file)=>root[name]||(typeof module==='object'&&module.exports&&typeof require==='function'?require('./'+file+'.js'):null);
 function refs(){const api=dependency('ReserveMediaReference','media-reference');if(!api?.cleanReference)fail('Saved media validation is unavailable.');return api;}
 function art(){const api=dependency('ReserveCustomArt','custom-art');if(!api?.cleanAsset||!Number.isSafeInteger(api.limits?.fileBytes)||!Number.isSafeInteger(api.limits?.totalBytes))fail('SVG validation is unavailable.');return api;}
 function plain(value,array=false){
  if(!value||typeof value!=='object'||Array.isArray(value)!==array)return false;
  const proto=Object.getPrototypeOf(value);if(!proto)return !array;
  const ctor=Object.getOwnPropertyDescriptor(proto,'constructor'),original=ctor&&own(ctor,'value')&&typeof ctor.value==='function'&&Object.getOwnPropertyDescriptor(ctor.value,'prototype');
  return !!original&&original.value===proto&&Function.prototype.toString.call(ctor.value)===(array?nativeArray:nativeObject)&&(array||Object.getPrototypeOf(proto)===null);
 }
 function record(value,allowed,label,required=[]){
  if(!plain(value))fail(label+' must be a plain data record.');const keys=Reflect.ownKeys(value),out=Object.create(null);
  if(keys.length>(allowed?allowed.length:5000))fail('Too many fields in '+label+'.');
  for(const key of keys){if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)||allowed&&!allowed.includes(key))fail('Unknown field in '+label+'.');const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!own(d,'value')||!d.enumerable)fail(label+' requires enumerable data fields.');out[key]=d.value;}
  for(const key of required)if(!own(out,key))fail('Missing '+key+' in '+label+'.');return out;
 }
 function array(value,max,label){
  if(!plain(value,true)||value.length>max)fail('Invalid or oversized '+label+'.');const keys=Reflect.ownKeys(value);if(keys.length!==value.length+1)fail('Invalid '+label+' fields.');
  const out=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!own(d,'value')||!d.enumerable)fail(label+' must contain data entries.');out.push(d.value);}return out;
 }
 function id(value,label='media id'){if(typeof value!=='string'||!UUID.test(value))fail('Invalid '+label+'.');return value;}
 function name(value,max,label){if(typeof value!=='string'||value.length>max||!value.trim()||/[\p{C}\u2028\u2029]/u.test(value))fail('Invalid '+label+'.');return value.trim();}
 function ownerScope(value){
  const o=record(value,['origin','accountId'],'owner',['origin','accountId']);let url;try{url=new URL(o.origin);}catch{}
  if(typeof o.origin!=='string'||!url||url.protocol!=='https:'||url.origin!==o.origin||url.username||url.password||url.port||typeof o.accountId!=='string'||!/^\d{1,20}$/.test(o.accountId))fail('A canonical HTTPS origin and numeric account id are required.');
  return JSON.stringify([o.origin,o.accountId]);
 }
 function cleanReference(value,slot='background'){
  const v=record(value,REF_KEYS,'media reference',['mediaId','name','type','kind','width','height','palette']);v.palette=array(v.palette,3,'media palette');return refs().cleanReference(v,slot);
 }
 function svg(value,budget){
  const v=record(value,['name','svg'],'SVG asset',['name','svg']),api=art();if(typeof v.svg!=='string'||textBytes(v.svg)>api.limits.fileBytes)fail('SVG file byte budget exceeded.');name(v.name,160,'SVG name');
  const clean=api.cleanAsset(v),size=Math.max(textBytes(v.svg),textBytes(clean.svg));budget.svg+=size;if(size>api.limits.fileBytes||budget.svg>api.limits.totalBytes)fail('Aggregate SVG byte budget exceeded.');return {name:clean.name,svg:clean.svg};
 }
 function appearance(value,budget,strict=true){
  const input=record(value,strict?APPEARANCE_KEYS:null,'appearance'),out={};
  for(const key of SLOTS){const part=input[key];if(part==null)continue;const clean=asset=>plain(asset)&&own(asset,'mediaId')?cleanReference(asset,key.replace('Art','')):svg(asset,budget);if(plain(part)&&own(part,'asset')){if(!['bannerArt','cardArt','backgroundArt'].includes(key))fail('Invalid framed artwork slot.');const frame=record(part,refs().frameKeys,'media framing',['asset']);if(own(frame,'focus'))frame.focus=record(frame.focus,['x','y'],'focus',['x','y']);if(own(frame,'loop'))frame.loop=record(frame.loop,['start','end'],'loop',['start','end']);out[key]=refs().cleanFrame(frame,clean);}else out[key]=clean(part);}
  for(const [key,allowed,fallback]of [['bannerFit',['contain','cover'],'contain'],['bannerPosition',['left','center','right'],'right'],['titlePlacement',['separate','banner'],'separate']]){const v=input[key]===undefined?fallback:input[key];if(!allowed.includes(v))fail('Invalid '+key+'.');out[key]=v;}
  return out;
 }
 function settingReferences(settings,budget){
  const s=record(settings??{},null,'settings'),looks=[];
  if(s.themeArt!==undefined)looks.push(appearance(s.themeArt,budget,false));if(s.overviewArt!==undefined)looks.push(appearance(s.overviewArt,budget,false));
  if(s.coursePrefs!==undefined){const courses=record(s.coursePrefs,null,'course preferences');for(const key of Object.keys(courses))looks.push(appearance(courses[key],budget,false));}
  if(s.customKits!==undefined)for(const value of array(s.customKits,limits.kits,'saved kits'))looks.push(kit(value).appearance);
  return looks.flatMap(appearanceReferences);
 }
 function appearanceReferences(look){return SLOTS.map(key=>refs().asset(look[key])).filter(part=>part?.mediaId);}
 function kit(value){
  // Inventory entries each retain the format's SVG allowance. Current settings
  // use their own shared budget; only metadataBudget sums the whole inventory.
  const budget={svg:0},k=record(value,KIT_KEYS,'kit',KIT_KEYS),accent=k.accent;
  if(typeof accent!=='string'||!(['clay','forest','indigo','rose','ocean','amber'].includes(accent)||/^#[a-f\d]{6}$/i.test(accent))||!['system','humanist','serif'].includes(k.font)||!['compact','standard','large'].includes(k.bannerSize))fail('Invalid kit appearance settings.');
  return {id:id(k.id,'kit id'),name:name(k.name,40,'kit name'),appearance:appearance(k.appearance,budget),accent:accent.toLowerCase(),font:k.font,bannerSize:k.bannerSize};
 }
 const sextet=c=>c>=65&&c<=90?c-65:c>=97&&c<=122?c-71:c>=48&&c<=57?c+4:c===43?62:c===47?63:-1;
 function checkBase64(data,size){
  if(typeof data!=='string'||data.length!==4*Math.ceil(size/3))fail('Invalid base64 byte length.');const padding=(3-size%3)%3,end=data.length-padding;
  for(let i=0;i<end;i++)if(sextet(data.charCodeAt(i))<0)fail('Noncanonical base64 bytes.');
  for(let i=end;i<data.length;i++)if(data[i]!=='=')fail('Noncanonical base64 padding.');
  if(padding&&(sextet(data.charCodeAt(end-1))&(padding===2?15:3)))fail('Noncanonical base64 padding bits.');
 }
 function byteRecord(value,types,max,hashRequired=true){
  const v=record(value,['type','size','data','sha256'],'byte record',hashRequired?['type','size','data','sha256']:['type','size','data']);
  if(!types.includes(v.type)||!Number.isSafeInteger(v.size)||v.size<1||v.size>max)fail('Invalid media type or byte size.');
  if(own(v,'sha256')&&(typeof v.sha256!=='string'||!HASH.test(v.sha256)))fail('Invalid SHA-256 digest.');checkBase64(v.data,v.size);return {type:v.type,size:v.size,data:v.data,...(own(v,'sha256')?{sha256:v.sha256}:{})};
 }
 function decode64(value){
  const out=new Uint8Array(value.size);let at=0;
  for(let i=0;i<value.data.length;i+=4){const a=sextet(value.data.charCodeAt(i)),b=sextet(value.data.charCodeAt(i+1)),c=sextet(value.data.charCodeAt(i+2)),d=sextet(value.data.charCodeAt(i+3));out[at++]=(a<<2)|(b>>4);if(at<out.length)out[at++]=((b&15)<<4)|(c>>2);if(at<out.length)out[at++]=((c&3)<<6)|d;}
  return out;
 }
 function encode64(value){
  if(typeof Buffer==='function')return Buffer.from(value.buffer,value.byteOffset,value.byteLength).toString('base64');
  let out='';for(let i=0;i<value.length;i+=24576)out+=root.btoa(String.fromCharCode.apply(null,value.subarray(i,i+24576)));return out;
 }
 async function hash(bytes){
  const crypto=root.crypto||(typeof module==='object'&&module.exports&&typeof require==='function'?require('node:crypto').webcrypto:null);if(typeof crypto?.subtle?.digest!=='function')fail('SHA-256 support is unavailable.');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 }
 async function verifyBytes(value){const bytes=decode64(value);if(await hash(bytes)!==value.sha256)fail('SHA-256 mismatch.');return bytes;}
 function cleanRow(value){
  const row=record(value,['asset','bytes','poster'],'asset row',['asset','bytes']),asset=cleanReference(row.asset),bytes=byteRecord(row.bytes,[asset.type],asset.kind==='video'?limits.videoBytes:limits.imageBytes);let poster;
  if(own(row,'poster')){if(asset.kind!=='video'&&!asset.animated)fail('Only video or animated references may have posters.');poster=byteRecord(row.poster,['image/png','image/webp'],limits.imageBytes);}
  return {asset,bytes,...(poster?{poster}:{})};
 }
 function unique(rows,label,key){const ids=new Set();for(const row of rows){const value=key(row).toLowerCase();if(ids.has(value))fail('Duplicate '+label+'.');ids.add(value);}}
 function metadataBudget(assets,kits){
  const entry=part=>({type:part.type,size:part.size,data:'',sha256:part.sha256||'0'.repeat(64)}),metadata={version:1,assets:assets.map(({asset,bytes,poster})=>({asset,bytes:entry(bytes),...(poster?{poster:entry(poster)}:{})})),kits},size=textBytes(JSON.stringify(metadata));
  if(size>limits.metadataBytes)fail('Metadata byte budget exceeded.');
  if(size+assets.reduce((n,row)=>n+4*Math.ceil(row.bytes.size/3)+(row.poster?4*Math.ceil(row.poster.size/3):0),0)>limits.fileBytes)fail('Encoded media backup file byte budget exceeded.');
 }
 function requireReferences(assets,kits,settingsRefs){
  const byId=new Map(assets.map(row=>[row.asset.mediaId,row.asset]));
  for(const ref of [...settingsRefs,...kits.flatMap(k=>appearanceReferences(k.appearance))]){const found=byId.get(ref.mediaId);if(!found)fail('Required media is missing: '+ref.mediaId);if(JSON.stringify(found)!==JSON.stringify(ref))fail('Referenced media metadata does not match: '+ref.mediaId);}
 }
 async function inspectRow(row,bytes,poster,inspect){
  const options=row.asset.kind==='video'?{loop:{start:0,end:Math.min(limits.duration,row.asset.duration)},still:0}:{},info=await inspect(bytes,row.bytes.type,options);if(!info||info.type!==row.asset.type||info.kind!==row.asset.kind||info.width!==row.asset.width||info.height!==row.asset.height||row.asset.kind==='image'&&!!info.animated!==(row.asset.animated===true)||row.asset.kind==='video'&&(!Number.isFinite(info.duration)||Math.abs(info.duration-row.asset.duration)>.001))fail('Inspected media metadata does not match.');
  if(poster){const p=await inspect(poster,row.poster.type);if(!p||p.type!==row.poster.type||p.kind!=='image'||p.animated||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.width>limits.imageWidth||p.height<1||p.height>16000||p.width*p.height>48000000)fail('Invalid inspected poster.');}
 }
 async function verified(payload,{settings={},inspect}={}){
  if(inspect!==undefined&&typeof inspect!=='function')fail('inspect must be a pure byte inspector.');const budget={svg:0},required=settingReferences(settings,budget);
  if(payload===undefined){if(required.length)fail('Required media is missing from the backup.');return;}
  const input=record(payload,['version','assets','kits'],'payload',['version','assets','kits']);if(input.version!==1)fail('Unsupported backup media version.');
  const assets=array(input.assets,limits.assets,'assets').map(cleanRow),kits=array(input.kits,limits.kits,'kits').map(value=>kit(value));unique(assets,'media id',row=>row.asset.mediaId);unique(kits,'kit id',row=>row.id);
  const total=assets.reduce((n,row)=>n+row.bytes.size+(row.poster?.size||0),0);if(total>limits.totalBytes)fail('Combined media byte budget exceeded.');metadataBudget(assets,kits);requireReferences(assets,kits,required);
  const decoded=[];for(const row of assets)decoded.push({bytes:await verifyBytes(row.bytes),poster:row.poster?await verifyBytes(row.poster):undefined});
  // Every digest is verified before any caller-supplied container inspection.
  if(inspect)for(let i=0;i<assets.length;i++)await inspectRow(assets[i],decoded[i].bytes,decoded[i].poster,inspect);
  return {payload:{version:1,assets,kits},decoded};
 }
 async function validate(payload,options){return (await verified(payload,options))?.payload;}
 async function decode(payload,options){
  const checked=await verified(payload,options);if(!checked)return;const BlobType=root.Blob;if(typeof BlobType!=='function')fail('Blob support is unavailable.');
  return {version:1,assets:checked.payload.assets.map((row,i)=>({asset:row.asset,blob:new BlobType([checked.decoded[i].bytes],{type:row.bytes.type}),...(row.poster?{poster:new BlobType([checked.decoded[i].poster],{type:row.poster.type})}:{})})),kits:checked.payload.kits};
 }
 function provenance(row,scope,idValue,required=false){
  if((required||own(row,'owner'))&&row.owner!==scope||(required||own(row,'key'))&&row.key!==scope+':'+idValue)fail('Stored media belongs to another owner or id.');
  if(own(row,'createdAt')&&(!Number.isSafeInteger(row.createdAt)||row.createdAt<0))fail('Invalid media timestamp.');
  if(own(row,'holds'))for(const token of array(row.holds,2000,'transient holds'))id(token,'hold id');
 }
 function blobInfo(value,types,max){
  const B=root.Blob;let type,size;try{type=Object.getOwnPropertyDescriptor(B.prototype,'type').get.call(value);size=Object.getOwnPropertyDescriptor(B.prototype,'size').get.call(value);}catch{fail('Invalid stored Blob.');}
  if(!types.includes(type)||!Number.isSafeInteger(size)||size<1||size>max)fail('Invalid stored Blob type or size.');return {type,size};
 }
 function localRow(value,scope,required=false){
  const row=record(value,['asset','blob','poster','owner','key','createdAt','holds'],'local asset',['asset','blob']),asset=cleanReference(row.asset);provenance(row,scope,asset.mediaId,required);
  const bytes=blobInfo(row.blob,[asset.type],asset.kind==='video'?limits.videoBytes:limits.imageBytes);let poster;
  if(own(row,'poster')){if(asset.kind!=='video'&&!asset.animated)fail('Only video or animated references may have posters.');poster=blobInfo(row.poster,['image/png','image/webp'],limits.imageBytes);}
  return {asset,bytes,poster,raw:row,encoded:false};
 }
 function storedKit(value,scope,required=true){const row=record(value,['kit','owner','key'],'stored kit',['kit']);const clean=kit(row.kit);provenance(row,scope,clean.id,required);return clean;}
 function indexBytes(value,types,max){const v=record(value,['type','size'],'shared byte index',['type','size']);if(!types.includes(v.type)||!Number.isSafeInteger(v.size)||v.size<1||v.size>max)fail('Invalid shared byte index.');return {type:v.type,size:v.size};}
 async function sharedSnapshot(reader,scope){
  const base='reserve:market-media:'+scope,indexKey=base+':index',current=await reader.read(indexKey),legacy=current==null,raw=legacy?await reader.read(base):current;
  const rows=[],kits=[];if(raw==null)return {rows,kits,check:async()=>{if(await reader.read(indexKey)!=null||await reader.read(base)!=null)fail('Shared media changed during capture. Try again.');}};
  const input=record(raw,['version','media','kits','meta'],'shared pool',['version','media','kits','meta']);if(input.version!==(legacy?1:2))fail('Invalid shared pool version.');
  for(const value of array(input.media,limits.assets,'shared assets')){
   const row=record(value,['asset','blob','poster','key','owner','createdAt','holds'],'shared asset',['asset','blob','key','owner','createdAt','holds']),asset=cleanReference(row.asset);provenance(row,scope,asset.mediaId,true);
   const max=asset.kind==='video'?limits.videoBytes:limits.imageBytes,bytes=legacy?byteRecord(row.blob,[asset.type],max,false):indexBytes(row.blob,[asset.type],max);let poster;
   if(own(row,'poster')){if(asset.kind!=='video'&&!asset.animated)fail('Only video or animated references may have posters.');poster=legacy?byteRecord(row.poster,['image/png','image/webp'],limits.imageBytes,false):indexBytes(row.poster,['image/png','image/webp'],limits.imageBytes);}
   rows.push({asset,bytes,poster,encoded:true,raw:legacy?{blob:bytes,...(poster?{poster}:{})}:null});
  }
  unique(rows,'shared media id',row=>row.asset.mediaId);
  for(const value of array(input.kits,limits.kits,'shared kits'))kits.push(storedKit(value,scope));unique(kits,'shared kit id',row=>row.id);
  for(const value of array(input.meta,1,'shared revision')){const meta=record(value,['key','owner','revision'],'shared revision',['key','owner','revision']);if(meta.key!==scope||meta.owner!==scope)fail('Invalid shared revision owner.');id(meta.revision,'revision id');}
  const signature=JSON.stringify(raw);
  return {rows,kits,async load(row){
   if(row.raw)return;const raw=record(await reader.read(base+':asset:'+row.asset.mediaId),['blob','poster'],'shared asset bytes',['blob']);
   const bytes=byteRecord(raw.blob,[row.bytes.type],row.asset.kind==='video'?limits.videoBytes:limits.imageBytes,false),poster=own(raw,'poster')?byteRecord(raw.poster,['image/png','image/webp'],limits.imageBytes,false):undefined;
   if(bytes.size!==row.bytes.size||!!poster!==!!row.poster||poster&&(poster.type!==row.poster.type||poster.size!==row.poster.size))fail('Shared byte records do not match their index.');row.raw={blob:bytes,...(poster?{poster}:{})};
  },async check(){if(legacy&&await reader.read(indexKey)!=null||JSON.stringify(await reader.read(legacy?base:indexKey))!==signature)fail('Shared media changed during capture. Try again.');}};
 }
 async function localDatabase(scope){
  // A worker cannot read a Canvas origin's IndexedDB. Never try to open its own.
  if(typeof root.importScripts==='function')return {media:[],kits:[]};const idb=root.indexedDB;if(!idb)return {media:[],kits:[]};
  if(typeof idb.databases!=='function')fail('Cannot safely discover local media. Supply a localStore reader.');
  const databases=await idb.databases();if(!databases.some(db=>db.name==='reserve-media-v1'))return {media:[],kits:[]};
  const db=await new Promise((resolve,reject)=>{let settled=false,missing=false;const request=idb.open('reserve-media-v1');const stop=error=>{if(!settled){settled=true;reject(error);}};
   request.onupgradeneeded=()=>{missing=true;request.transaction.abort();};request.onerror=()=>{if(missing){if(!settled){settled=true;resolve(null);}}else stop(Error('Could not open existing local media.'));};request.onblocked=()=>stop(Error('Local media is blocked by another page.'));
   request.onsuccess=()=>{if(settled||missing){request.result.close();return;}settled=true;resolve(request.result);};
  });if(!db)return {media:[],kits:[]};
  try{return await new Promise((resolve,reject)=>{
   const names=['media','kits'];if(names.some(name=>!db.objectStoreNames.contains(name))){reject(Error('Incomplete local media schema.'));return;}
   let state={},error;const tx=db.transaction(names,'readonly');tx.oncomplete=()=>resolve(state);tx.onerror=tx.onabort=()=>reject(error||Error('Could not read local media.'));
   try{for(const name of names){const request=tx.objectStore(name).index('owner').getAll(scope);request.onsuccess=()=>{state[name]=request.result;};request.onerror=()=>{error=Error('Could not read local '+name+'.');};}}
   catch(e){error=e;tx.abort();}
  });}finally{db.close();}
 }
 async function capture({owner,settings={},adapter,localStore}={}){
  const scope=ownerScope(owner),budget={svg:0},required=settingReferences(settings,budget),reader=adapter||{async read(key){const storage=root.chrome?.storage?.local;return storage?(await storage.get(key))[key]:undefined;}};
  if(typeof reader.read!=='function')fail('A read-only shared adapter is required.');const shared=await sharedSnapshot(reader,scope),localRows=[],localKits=[];
  if(localStore!==undefined){
   if(!localStore||typeof localStore.listKits!=='function'||typeof localStore.get!=='function')fail('Invalid localStore reader.');for(const value of array(await localStore.listKits(),limits.kits,'local kits'))localKits.push(kit(value));unique(localKits,'local kit id',row=>row.id);
   const needed=new Set([...required,...shared.kits.concat(localKits).flatMap(k=>appearanceReferences(k.appearance))].map(ref=>ref.mediaId)),seen=new Set();
   if(localStore.listAssets!==undefined){if(typeof localStore.listAssets!=='function')fail('Invalid listAssets reader.');for(const value of array(await localStore.listAssets(),limits.assets,'local assets')){
    const listed=typeof value==='string'?id(value):plain(value)&&own(value,'mediaId')?cleanReference(value):null,key=typeof listed==='string'?listed:listed?.mediaId;
    const found=key?await localStore.get(key):value;if(!found)fail('A listed local asset is missing.');const row=localRow(found,scope);if(seen.has(row.asset.mediaId.toLowerCase()))fail('Duplicate local media id.');if(key&&row.asset.mediaId!==key||listed&&typeof listed!=='string'&&JSON.stringify(row.asset)!==JSON.stringify(listed))fail('Local asset listing does not match.');seen.add(row.asset.mediaId.toLowerCase());localRows.push(row);
   }}
   for(const key of needed){if(seen.has(key.toLowerCase()))continue;const found=await localStore.get(key);if(!found)continue;const row=localRow(found,scope);if(row.asset.mediaId!==key)fail('Local media id does not match.');seen.add(key.toLowerCase());localRows.push(row);}
  }else{
   const state=await localDatabase(scope);for(const value of array(state.media,limits.assets,'local assets'))localRows.push(localRow(value,scope,true));unique(localRows,'local media id',row=>row.asset.mediaId);
   for(const value of array(state.kits,limits.kits,'local kits'))localKits.push(storedKit(value,scope));unique(localKits,'local kit id',row=>row.id);
  }
  const kits=new Map();for(const k of [...shared.kits,...localKits]){const old=kits.get(k.id.toLowerCase());if(old&&JSON.stringify(old)!==JSON.stringify(k))fail('Conflicting duplicate kit id.');kits.set(k.id.toLowerCase(),k);}
  if(kits.size>limits.kits)fail('Kit count limit exceeded.');const grouped=new Map();let total=0;
  for(const row of [...shared.rows,...localRows]){const key=row.asset.mediaId.toLowerCase(),old=grouped.get(key),size=row.bytes.size+(row.poster?.size||0);if(old){const first=old[0];if(JSON.stringify(first.asset)!==JSON.stringify(row.asset)||first.bytes.type!==row.bytes.type||first.bytes.size!==row.bytes.size||!!first.poster!==!!row.poster||row.poster&&(first.poster.type!==row.poster.type||first.poster.size!==row.poster.size))fail('Conflicting duplicate media id.');old.push(row);}else{total+=size;grouped.set(key,[row]);}}
  if(grouped.size>limits.assets||total>limits.totalBytes)fail('Combined media count or byte budget exceeded.');metadataBudget([...grouped.values()].map(rows=>rows[0]),[...kits.values()]);const assets=[];
  for(const candidates of grouped.values()){
   let expected;for(const row of candidates){if(row.encoded)await shared.load(row);
    const portable=async(source,info)=>{const raw=row.encoded?source:{...info,data:encode64(new Uint8Array(await root.Blob.prototype.arrayBuffer.call(source)))},value=byteRecord(raw,[info.type],info.type.startsWith('video/')?limits.videoBytes:limits.imageBytes,false),bytes=decode64(value),digest=await hash(bytes);if(value.sha256&&value.sha256!==digest)fail('SHA-256 mismatch in stored bytes.');return {...value,sha256:digest};};
    const bytes=await portable(row.raw.blob,row.bytes),poster=row.poster?await portable(row.raw.poster,row.poster):undefined,result={asset:row.asset,bytes,...(poster?{poster}:{})};if(expected&&JSON.stringify(result)!==JSON.stringify(expected))fail('Conflicting duplicate media bytes.');expected=result;
   }assets.push(expected);
  }
  await shared.check();const payload={version:1,assets,kits:[...kits.values()]};const clean=await validate(payload,{settings});return clean.assets.length||clean.kits.length?clean:undefined;
 }
 const api=Object.freeze({limits,capture,validate,decode});root.ReserveBackupMedia=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
