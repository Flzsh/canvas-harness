/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Packaged offscreen media codec; messages carry bounded bytes, never URLs or code. */
(function(root){
 'use strict';
 const refs=root.ReserveMediaReference||(typeof module==='object'&&module.exports?require('./media-reference.js'):null),limits=refs?.limits,MAX=limits?.inputBytes;
 if(!limits||!refs.cleanFrame)throw Error('Load media-reference.js before market-media.js.');
 const encode=value=>{let out='';for(let i=0;i<value.length;i+=24576)out+=root.btoa(String.fromCharCode(...value.subarray(i,i+24576)));return out;};
 function decode(value,max){
  if(typeof value!=='string'||!value.length||value.length>Math.ceil(max/3)*4||value.length%4)throw Error('Invalid media bytes.');
  const binary=root.atob(value);
  if(!binary.length||binary.length>max)throw Error('Invalid media size.');
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
 }
 function optionsOf(value={},duration=limits.sourceDuration){
  const input=refs.dataRecord(value,['loop','still']),frame=refs.cleanFrame({asset:{type:'video/mp4',kind:'video',duration},...input}),out={};
  for(const key of ['loop','still'])if(Object.hasOwn(frame,key))out[key]=frame[key];
  return out;
 }
 function framingOf(value,asset){if(value===undefined)return undefined;if(asset.kind!=='video')throw Error('Only video has loop framing.');return optionsOf(value,asset.duration);}
 let opening;
 async function ensure(){
  if(opening)return opening;
  opening=(async()=>{
   if(!await root.chrome.offscreen.hasDocument())
    await root.chrome.offscreen.createDocument({url:'ai-offscreen.html',reasons:['WORKERS','BLOBS'],justification:'Read local PDFs and validate local pack media.'});
  })().finally(()=>{
   opening=null;
  });
  return opening;
 }
 async function prepare(blob,slot,name,options={}){
  if(!(blob instanceof Blob)||blob.size<1||blob.size>MAX)throw Error('Invalid media size.');const selection=optionsOf(options);await ensure();
  const reply=await root.chrome.runtime.sendMessage({target:'ch-pack-media',data:encode(new Uint8Array(await blob.arrayBuffer())),type:blob.type,slot,name,options:selection});
  if(!reply?.ok)throw Error(reply?.error||'Media could not be read.');
  const asset=refs.cleanReference(reply.asset,slot),safe=new Blob([decode(reply.data,asset.kind==='video'?limits.videoBytes:limits.imageBytes)],{type:asset.type});
  let poster;
  if(reply.poster){
   if(asset.kind!=='video'&&!asset.animated||!['image/png','image/webp'].includes(reply.poster.type))throw Error('Invalid media poster.');
   poster=new Blob([decode(reply.poster.data,limits.imageBytes)],{type:reply.poster.type});
  }
  const framing=framingOf(reply.framing,asset);return {asset,blob:safe,...(poster?{poster}:{}),...(framing?{framing}:{})};
 }
 if(typeof root.importScripts==='function'){root.ReservePackMedia=Object.freeze({ensure,prepare});return;}
 let busy=false;
 root.chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.target!=='ch-pack-media'||sender?.id!==root.chrome.runtime.id||sender.tab||sender.url&&sender.url!==root.chrome.runtime.getURL('background.js'))return;
  if(busy){reply({ok:false,error:'Media import is busy.'});return;}busy=true;
  (async()=>{
   const options=optionsOf(message.options),
    bytes=decode(message.data,MAX),
    prepared=await root.ReserveMedia.prepare(new Blob([bytes],{type:message.type}),message.slot,message.name,options),
    asset=refs.cleanReference(prepared.asset,message.slot),
    framing=framingOf(prepared.framing,asset);
   return {
    ok:true,
    asset,
    data:encode(new Uint8Array(await prepared.blob.arrayBuffer())),
    ...(prepared.poster?{poster:{type:prepared.poster.type,data:encode(new Uint8Array(await prepared.poster.arrayBuffer()))}}:{}),
    ...(framing?{framing}:{})
   };
  })().then(reply,error=>reply({ok:false,error:String(error?.message||'Invalid media.')})).finally(()=>{
   busy=false;
  });
  return true;
 });
})(globalThis);
