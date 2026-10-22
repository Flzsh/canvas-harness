/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Canvas Harness portable artwork kits. No storage, URL loading or third-party dependencies.
 * Local kits hold sanitized SVGs or verified media references. Version 1 .chkit
 * files contain base64 bytes and SHA-256 hashes only, never reference IDs/URLs.
 * Import validates the complete schema and all hashes before parsing SVGs or
 * calling ReserveMedia.prepare. Optional {media: codec} is a unit-test seam;
 * browser globals take precedence over lazy CommonJS dependency loading.
 */
(function(root){
 'use strict';
 const limits=Object.freeze({fileBytes:40000000});
 const slots=['bannerArt','borderArt','titleArt','iconArt','cardArt','backgroundArt'],appearanceKeys=[...slots,'bannerFit','bannerPosition','titlePlacement'],frameKeys=['focus','zoom','fit','height','loop','still'];
 const settingsKeys=['accent','font','bannerSize'],wireKeys=['version','name','assets',...settingsKeys,'bannerFit','bannerPosition','titlePlacement'];
 const uuid=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,color=/^#[\da-f]{6}$/i;
 const imageTypes=['image/png','image/webp'],videoTypes=['video/mp4','video/webm'],bannerTypes=[...imageTypes,'image/jpeg','image/gif','image/avif',...videoTypes];
 const encoder=new TextEncoder(),nativeObject=Function.prototype.toString.call(Object),nativeArray=Function.prototype.toString.call(Array);
 const fail=message=>{throw Error('Custom kit: '+message);};
 const own=(value,key)=>Object.hasOwn(value,key),bytes=value=>encoder.encode(value);
 // Accept plain records from another realm too, without accepting a custom
 // prototype, accessor or inherited field as part of the saved schema.
 function plain(value,array=false){
  if(!value||typeof value!=='object'||Array.isArray(value)!==array)return false;
  const proto=Object.getPrototypeOf(value);if(!proto)return !array;
  const ctor=Object.getOwnPropertyDescriptor(proto,'constructor');
  if(!ctor||!own(ctor,'value')||typeof ctor.value!=='function')return false;
  const original=Object.getOwnPropertyDescriptor(ctor.value,'prototype');
  return !!original&&original.value===proto&&Function.prototype.toString.call(ctor.value)===(array?nativeArray:nativeObject)&&(!array?Object.getPrototypeOf(proto)===null:true);
 }
 function record(value,allowed,label,required=[]){
  if(!plain(value))fail(label+' must be a plain object, without a custom prototype or arrays.');
  const keys=Reflect.ownKeys(value);if(keys.length>allowed.length)fail('Too many fields in '+label+'.');
  const out=Object.create(null);
  for(const key of keys){
   if(typeof key!=='string'||!allowed.includes(key))fail('Unknown field in '+label+'.');
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(!descriptor||!own(descriptor,'value')||!descriptor.enumerable)fail(label+' requires enumerable data properties, not accessors.');
   out[key]=descriptor.value;
  }
  for(const key of required)if(!own(out,key))fail('Missing required '+key+' in '+label+'.');
  return out;
 }
 function nameOf(value,max=40,fallback){
  if(value===undefined&&fallback!==undefined)return fallback;
  if(typeof value!=='string'||value.length>max*4||/[\p{C}\u2028\u2029]/u.test(value))fail('Name must contain 1-'+max+' printable characters.');
  const name=value.trim();if(!name||name.length>max)fail('Name must contain 1-'+max+' printable characters.');return name;
 }
 function choice(value,allowed,fallback,key){
  if(value===undefined)return fallback;
  if(typeof value!=='string'||!allowed.includes(value))fail('Invalid '+key+' setting.');return value;
 }
 function settings(value){
  const accent=value.accent===undefined?'clay':value.accent;
  if(typeof accent!=='string'||!(['clay','forest','indigo','rose','ocean','amber'].includes(accent)||color.test(accent)))fail('Invalid accent setting.');
  return {accent:accent.toLowerCase(),font:choice(value.font,['system','humanist','serif'],'system','font'),bannerSize:choice(value.bannerSize,['compact','standard','large'],'standard','bannerSize')};
 }
 function placement(value){return {bannerFit:choice(value.bannerFit,['contain','cover'],'contain','bannerFit'),bannerPosition:choice(value.bannerPosition,['left','center','right'],'right','bannerPosition'),titlePlacement:choice(value.titlePlacement,['separate','banner'],'separate','titlePlacement')};}
 function artwork(){
  const art=root.ReserveCustomArt||(typeof module==='object'&&module.exports?require('./custom-art.js'):null);
  if(!art||typeof art.importSVG!=='function'||typeof art.cleanAsset!=='function'||!Number.isSafeInteger(art.limits?.fileBytes)||art.limits.fileBytes<1||!Number.isSafeInteger(art.limits?.totalBytes)||art.limits.totalBytes<1)fail('SVG artwork support is unavailable.');return art;
 }
 function mediaCodec(deps){
  const media=deps.media||root.ReserveMedia||(typeof module==='object'&&module.exports?require('./media-store.js'):null);
  if(!media||typeof media.prepare!=='function')fail('Media import support is unavailable.');return media;
 }
 function references(){const api=root.ReserveMediaReference||(typeof module==='object'&&module.exports?require('./media-reference.js'):null);if(!api?.cleanFrame||!api.cleanReference)fail('Saved media validation is unavailable.');return api;}
 const wrapped=value=>plain(value)&&own(value,'asset'),unwrapped=value=>wrapped(value)?references().asset(value):value,slotFor=key=>['bannerArt','cardArt','backgroundArt','titleArt'].includes(key)?key.slice(0,-3):key;
 function cleanFrame(value,cleanAsset,provisional=false){
  const input=record(value,['asset',...frameKeys],'media framing',['asset']);
  if(own(input,'focus'))input.focus=record(input.focus,['x','y'],'focus',['x','y']);if(own(input,'loop'))input.loop=record(input.loop,['start','end'],'loop',['start','end']);
  const out=references().cleanFrame(input,cleanAsset);if(out.asset.kind==='video'&&(out.loop?out.loop.end-out.loop.start:provisional?0:out.asset.duration)>references().limits.duration)fail('Video loop must be at most 60 s.');return out;
 }
 function frameData(value,type){const input=record(value,frameKeys,'encoded framing'),{asset,...frame}=cleanFrame({asset:{type,kind:videoTypes.includes(type)?'video':'image',...(videoTypes.includes(type)?{duration:references().limits.sourceDuration}:{})},...input},v=>v,true);return frame;}
 function dependencies(value){return record(value===undefined?{}:value,['media'],'codec dependencies');}
 function cryptography(){
  const crypto=root.crypto||(typeof module==='object'&&module.exports?require('node:crypto').webcrypto:null);
  if(!crypto||typeof crypto.randomUUID!=='function'||typeof crypto.subtle?.digest!=='function')fail('Secure cryptography is unavailable.');return crypto;
 }
 function newId(){return cryptography().randomUUID();}
 async function sha256(value){const digest=new Uint8Array(await cryptography().subtle.digest('SHA-256',value));return Array.from(digest,c=>c.toString(16).padStart(2,'0')).join('');}
 function svgBytes(value){const art=artwork();if(typeof value!=='string'||value.length>art.limits.fileBytes||bytes(value).length>art.limits.fileBytes)fail('SVG file exceeds the artwork byte limit.');}
 function svgBudget(total){if(total>artwork().limits.totalBytes)fail('Total SVG artwork exceeds the aggregate artwork budget.');}
 function cleanSVG(value){
  const input=record(value,['name','svg'],'SVG asset',['svg']);svgBytes(input.svg);
  const asset=artwork().cleanAsset({name:nameOf(input.name,160,'Custom artwork.svg'),svg:input.svg});svgBytes(asset.svg);return {name:asset.name,svg:asset.svg};
 }
 function paletteOf(value){
  if(!plain(value,true)||![0,3].includes(value.length))fail('Invalid media palette; provide zero or three colours.');
  const keys=Reflect.ownKeys(value);if(keys.length!==value.length+1||keys.some(key=>key!=='length'&&!['0','1','2'].includes(key)))fail('Invalid media palette fields.');
  const out=[];for(let i=0;i<value.length;i++){
   const property=Object.getOwnPropertyDescriptor(value,String(i));
   if(!property||!own(property,'value')||!property.enumerable||typeof property.value!=='string'||!color.test(property.value))fail('Invalid media palette colour.');out.push(property.value.toLowerCase());
  }return out;
 }
 function cleanReference(value,slot){
  if(!['banner','card','background','title'].includes(slot))fail('Media is only supported in artwork slots.');
  const input=record(value,['mediaId','name','type','kind','width','height','duration','palette','animated'],'media reference',['mediaId','name','type','kind','width','height','palette']);
  input.palette=paletteOf(input.palette);return references().cleanReference(input,slot);
 }
 function blobOf(blob,type,max){if(!(blob instanceof Blob)||blob.type!==type||!Number.isSafeInteger(blob.size)||blob.size<1||blob.size>max)fail('Invalid media blob type or byte size.');return blob;}
 function mediaRecord(value,slot,stored=false){
  const input=record(value,stored?['asset','blob','poster','createdAt','owner','key']:['asset','blob','poster','framing'],'media record',['asset','blob']);
  const asset=cleanReference(input.asset,slot),budget=references().limits,blob=blobOf(input.blob,asset.type,asset.kind==='video'?budget.videoBytes:budget.imageBytes);
  if(own(input,'createdAt')&&(!Number.isSafeInteger(input.createdAt)||input.createdAt<0))fail('Invalid media record timestamp.');
  for(const key of ['owner','key'])if(own(input,key))nameOf(input[key],2048);
  if(own(input,'framing')){const frame=record(input.framing,['loop','still'],'prepared framing');cleanFrame({asset,...frame},v=>v);}
  let poster;if(input.poster!==undefined){if(asset.kind!=='video'&&!asset.animated||!imageTypes.includes(input.poster?.type))fail('Invalid media poster type.');poster=blobOf(input.poster,input.poster.type,budget.imageBytes);}
  return {asset,blob,...(poster?{poster}:{})};
 }
 function cleanAppearance(value){
  const input=record(value,appearanceKeys,'appearance'),out={};let total=0;
  for(const key of slots){
   if(input[key]==null)continue;
   const cleanAsset=part=>{if(plain(part)&&own(part,'mediaId'))return cleanReference(part,slotFor(key));const asset=cleanSVG(part);total+=bytes(asset.svg).length;svgBudget(total);return asset;};
   if(wrapped(input[key])&&!['banner','card','background'].includes(slotFor(key)))fail('Framing is only supported in banner, card or background slots.');out[key]=wrapped(input[key])?cleanFrame(input[key],cleanAsset):cleanAsset(input[key]);
  }return Object.assign(out,placement(input));
 }
 async function verifiedMedia(appearance,store){
  const records=Object.create(null);
  for(const key of slots){
   const asset=unwrapped(appearance[key]);if(!asset?.mediaId)continue;
   if(!store||typeof store.get!=='function')fail('A media store is required to verify local references.');
   const loaded=await store.get(asset.mediaId);if(!loaded)fail('Referenced media is missing from local storage.');
   const found=mediaRecord(loaded,slotFor(key),true);
   if(JSON.stringify(found.asset)!==JSON.stringify(asset))fail('Media reference does not match its stored metadata.');records[key]=found;
   if(wrapped(appearance[key])&&(asset.kind==='video'||asset.animated)&&!found.poster)fail('Saved media still is missing.');
  }return records;
 }
 async function capture(name,appearance={},options={},mediaStore){
  const cleanName=nameOf(name),look=cleanAppearance(appearance),prefs=settings(record(options,settingsKeys,'kit settings'));
  const saved=await verifiedMedia(look,mediaStore),kit={id:newId(),name:cleanName,appearance:look,...prefs};preflight(kit,saved);return kit;
 }
 function cleanKit(value){
  const input=record(value,['id','name','appearance',...settingsKeys],'local kit',['id','name','appearance',...settingsKeys]);
  if(typeof input.id!=='string'||!uuid.test(input.id))fail('Invalid local kit id.');
  return {id:input.id,name:nameOf(input.name),appearance:cleanAppearance(input.appearance),...settings(input)};
 }
 function encode64(value){
  if(typeof Buffer==='function')return Buffer.from(value.buffer,value.byteOffset,value.byteLength).toString('base64');
  let out='';for(let i=0;i<value.length;i+=24576)out+=root.btoa(String.fromCharCode.apply(null,value.subarray(i,i+24576)));return out;
 }
 function sextet(code){return code>=65&&code<=90?code-65:code>=97&&code<=122?code-71:code>=48&&code<=57?code+4:code===43?62:code===47?63:-1;}
 function base64Size(data){
  if(typeof data!=='string'||!data.length||data.length>limits.fileBytes||data.length%4)fail('Invalid base64 asset data or length.');
  const padding=data.endsWith('==')?2:data.endsWith('=')?1:0,end=data.length-padding;
  // A linear scan avoids the stack/memory growth of a repeated-group regex on
  // a large valid file. Check unused padding bits before allocating bytes.
  for(let i=0;i<end;i++)if(sextet(data.charCodeAt(i))<0)fail('Malformed base64 asset data.');
  if(padding&&(sextet(data.charCodeAt(end-1))&(padding===2?15:3)))fail('Noncanonical base64 asset padding.');
  return data.length/4*3-padding;
 }
 function decode64(data){
  if(typeof Buffer==='function')return new Uint8Array(Buffer.from(data,'base64'));
  const binary=root.atob(data),out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;
 }
 // Full wire size is exact: empty data fields retain every JSON/UTF-8 byte,
 // fixed-length hashes retain their width, and base64 adds four bytes per trio.
 // Verified Blob.size is sufficient; capture/import never reread media bytes.
 function preflight(kit,saved){
  const appearance=kit.appearance;
  const doc={version:1,name:kit.name,assets:{},accent:kit.accent,font:kit.font,bannerSize:kit.bannerSize,...placement(appearance)},sources=[];
  let encodedBytes=0;
  for(const key of slots){
   const value=appearance[key];if(!value)continue;const part=unwrapped(value);
   const source=saved[key]?{blob:saved[key].blob}:{bytes:bytes(part.svg)};
   const length=source.blob?source.blob.size:source.bytes.length;
   const target=doc.assets[key]={name:part.name,type:saved[key]?part.type:'image/svg+xml',data:'',sha256:'0'.repeat(64)};
   if(wrapped(value)){const {asset,...frame}=value;target.frame=frame;}
   encodedBytes+=Math.ceil(length/3)*4;sources.push({target,...source,length});
   if(saved[key]?.poster){const blob=saved[key].poster,poster=target.poster={type:blob.type,data:'',sha256:'0'.repeat(64)};encodedBytes+=Math.ceil(blob.size/3)*4;sources.push({target:poster,blob,length:blob.size});}
  }
  if(bytes(JSON.stringify(doc)).length+encodedBytes>limits.fileBytes)fail('Encoded kit JSON exceeds the 40 MB file byte limit.');
  return {doc,sources};
 }
 async function exportKit(value,mediaStore){
  const kit=cleanKit(value),saved=await verifiedMedia(kit.appearance,mediaStore),{doc,sources}=preflight(kit,saved);
  for(const source of sources){
   const original=source.bytes||new Uint8Array(await source.blob.arrayBuffer());if(original.length!==source.length)fail('Media blob byte size changed during export.');
   source.target.sha256=await sha256(original);source.target.data=encode64(original);
  }
  const blob=new Blob([JSON.stringify(doc)],{type:'application/json'});if(blob.size>limits.fileBytes)fail('Encoded kit JSON exceeds the 40 MB file byte limit.');return blob;
 }
 function cleanDocument(value){
  const input=record(value,wireKeys,'kit document',wireKeys);if(input.version!==1)fail('Unsupported kit version; expected version 1.');
  const result={name:nameOf(input.name),...settings(input),...placement(input),assets:[]},assets=record(input.assets,slots,'kit assets');let total=0;
  for(const key of slots){
   if(!own(assets,key))continue;
   const part=record(assets[key],['name','type','data','sha256','frame','poster'],'encoded asset',['name','type','data','sha256']),name=nameOf(part.name,160),type=part.type;
   if(typeof type!=='string'||!(type==='image/svg+xml'||(['banner','card','background'].includes(slotFor(key))?bannerTypes:key==='titleArt'?imageTypes:[]).includes(type)))fail('Unsupported asset type for '+key+' slot.');
   if(typeof part.sha256!=='string'||!/^[a-f0-9]{64}$/.test(part.sha256))fail('Invalid SHA-256 asset hash.');
   const size=base64Size(part.data);
   if(type==='image/svg+xml'){const art=artwork();if(size>art.limits.fileBytes)fail('SVG file exceeds the artwork byte limit.');total+=size;svgBudget(total);}
   else if(size>references().limits.inputBytes)fail('Media data exceeds the input byte limit.');
   let frame,poster;if(own(part,'frame')){if(!['banner','card','background'].includes(slotFor(key)))fail('Framing is only supported in banner, card or background slots.');frame=frameData(part.frame,type);}
   if(own(part,'poster')){poster=record(part.poster,['type','data','sha256'],'encoded poster',['type','data','sha256']);if(type==='image/svg+xml'||!imageTypes.includes(poster.type)||typeof poster.sha256!=='string'||!/^[a-f0-9]{64}$/.test(poster.sha256)||base64Size(poster.data)>references().limits.imageBytes)fail('Invalid encoded poster type, hash or byte limit.');}
   result.assets.push({key,name,type,data:part.data,sha256:part.sha256,...(frame?{frame}:{}),...(poster?{poster}:{})});
  }return result;
 }
 async function importKit(file,deps){
  const support=dependencies(deps);
  if(!file||typeof file!=='object'||Array.isArray(file)||typeof file.text!=='function')fail('Provide a local .chkit file.');
  if(file.name!==undefined&&(typeof file.name!=='string'||file.name.length>1024||!file.name.toLowerCase().endsWith('.chkit')))fail('File extension must be .chkit.');
  if(!Number.isSafeInteger(file.size)||file.size<1||file.size>limits.fileBytes)fail('Kit file must be nonempty and at most 40 MB in byte size.');
  let source;try{source=typeof file.arrayBuffer==='function'?new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()):await file.text();}catch{fail('Kit file must use valid UTF-8.');}if(typeof source!=='string')fail('Kit file must contain JSON text.');
  if(source.length>limits.fileBytes||bytes(source).length>limits.fileBytes)fail('Kit JSON exceeds the 40 MB file byte limit.');
  let parsed;try{parsed=JSON.parse(source);}catch{fail('Malformed kit JSON.');}
  const doc=cleanDocument(parsed),decoded=[];
  // Decode only the already bounded base64 here; do not decode *media* or parse
  // SVG until every entry's hash of its original bytes has been verified.
  for(const part of doc.assets){const original=decode64(part.data);if(await sha256(original)!==part.sha256)fail('SHA-256 hash mismatch for '+part.key+'.');let poster;if(part.poster){poster=decode64(part.poster.data);if(await sha256(poster)!==part.poster.sha256)fail('SHA-256 poster hash mismatch for '+part.key+'.');}decoded.push({...part,bytes:original,...(poster?{posterBytes:poster}:{})});}
  const appearance={},media=[],saved=Object.create(null);let total=0;
  for(const part of decoded)if(part.type==='image/svg+xml'){
   let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(part.bytes);}catch{fail('SVG bytes must use valid UTF-8 encoding.');}
   const asset=cleanSVG(artwork().importSVG(source,part.name));appearance[part.key]=part.frame?cleanFrame({asset,...part.frame},v=>v):asset;total+=bytes(asset.svg).length;svgBudget(total);
  }
  for(const part of decoded)if(part.type!=='image/svg+xml'){
   const slot=slotFor(part.key),blob=new Blob([part.bytes],{type:part.type}),options=part.frame?{...(part.frame.loop?{loop:part.frame.loop}:{}),...(part.frame.still!==undefined?{still:part.frame.still}:{})}:{};
   let info,poster;if(part.frame||part.poster){const inspector=root.ReserveMedia||(typeof module==='object'&&module.exports?require('./media-store.js'):null);if(!inspector?.inspectPortable)fail('Portable media validation is unavailable.');info=inspector.inspectPortable(part.bytes,part.type,options);if(part.frame)cleanFrame({asset:info,...part.frame},v=>v);if(part.poster){const still=inspector.inspectPortable(part.posterBytes,part.poster.type);if(still.animated||still.kind!=='image'||still.width>references().limits.imageWidth)fail('Poster must be a static image within the media limits.');poster=new Blob([part.posterBytes],{type:part.poster.type});}}
   const prepared=mediaRecord(await mediaCodec(support).prepare(blob,slot,part.name,options),slot);
   if(part.frame){const {animated,...metadata}=info;prepared.asset=cleanReference({...prepared.asset,...metadata,...(animated&&info.kind==='image'?{animated:true}:{})},slot);prepared.blob=blob;}
   if(poster)prepared.poster=poster;prepared.asset.mediaId=newId();const checked=mediaRecord(prepared,slot);if(part.frame&&(checked.asset.kind==='video'||checked.asset.animated)&&!checked.poster)fail('Media still is missing.');
   appearance[part.key]=part.frame?cleanFrame({asset:checked.asset,...part.frame},v=>v):checked.asset;saved[part.key]=checked;media.push(checked);
  }
  Object.assign(appearance,placement(doc));const kit={id:newId(),name:doc.name,appearance,accent:doc.accent,font:doc.font,bannerSize:doc.bannerSize};preflight(kit,saved);return {kit,media};
 }
 const helpers=Object.freeze({plain,record,encode64,decode64,base64Size,sha256});
 const api=Object.freeze({limits,capture,exportKit,importKit,helpers});root.ReserveCustomKits=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
