/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Version 1 .chtheme documents; no persistence or remote resources. */
(function(root){
 'use strict';
 const C=root.ReservePackCommon||(typeof module==='object'&&module.exports?require('./pack-common.js'):null),
   colors=['bg','surface','ink','muted','line','accent'],
   types=C.imageTypes.concat(C.videoTypes),
   licenses=['OFL-1.1','Apache-2.0','CC0-1.0'];
 function luminance(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
 function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 function clean(source,c){
  const {input,pack}=C.header(source,'chtheme',['colors','background','banner','frames','title','icons','assets'],['colors'],c),modes=c.record(input.colors,['light','dark'],'$.colors');pack.colors={};
  if(!Object.keys(modes).length)c.add('$.colors','provide light, dark or both');
  for(const mode of Object.keys(modes)){
   const field='$.colors.'+mode,palette=c.record(modes[mode],colors,field,colors),out={};
   for(const key of colors){const value=palette[key];if(typeof value!=='string'||!/^#[a-f0-9]{6}$/i.test(value))c.add(field+'.'+key,'expected #RRGGBB');else out[key]=value.toLowerCase();}
   for(const [ink,surface,min]of [['ink','bg',4.5],['ink','surface',4.5],['muted','surface',3],['accent','surface',3]])
     if(out[ink]&&out[surface]){const ratio=contrast(out[ink],out[surface]);if(ratio<min)c.add(field+'.'+ink,'contrast on '+field+'.'+surface+' is '+ratio.toFixed(2)+':1; requires '+min+':1');}
   pack.colors[mode]=out;
  }
  if(C.own(input,'assets'))pack.assets=C.assets(input.assets,c);const assets=pack.assets||{};
  for(const key of ['background','banner'])if(C.own(input,key)){
   const field='$.'+key,
     value=c.record(input[key],['asset','still','stillAsset','fit','position','focus','zoom','height','loop'],field,['asset']),
     out={asset:C.reference(value.asset,assets,types,field+'.asset',c)},
     video=C.videoTypes.includes(assets[out.asset]?.type);
   if(C.own(value,'still')){
     if(typeof value.still==='number'){out.still=c.number(value.still,field+'.still',0,3600);if(!video)c.add(field+'.still','a still time is only valid for video');}
     else out.still=C.reference(value.still,assets,C.imageTypes,field+'.still',c);
   }
   if(C.own(value,'stillAsset')){
     out.stillAsset=C.reference(value.stillAsset,assets,C.imageTypes,field+'.stillAsset',c);
     if(typeof out.still==='string')c.add(field+'.stillAsset','use one static still asset reference');
   }
   if(C.own(value,'focus')){const focus=c.record(value.focus,['x','y'],field+'.focus',['x','y']);out.focus={x:c.number(focus.x,field+'.focus.x',0,1),y:c.number(focus.y,field+'.focus.y',0,1)};}
   if(C.own(value,'zoom'))out.zoom=c.number(value.zoom,field+'.zoom',1,4);if(C.own(value,'height'))out.height=c.choice(value.height,['small','medium','tall'],field+'.height');
   if(C.own(value,'loop')){
     const loop=c.record(value.loop,['start','end'],field+'.loop',['start','end']);
     out.loop={start:c.number(loop.start,field+'.loop.start',0,3600),end:c.number(loop.end,field+'.loop.end',0,3600)};
     if(!video)c.add(field+'.loop','a loop is only valid for video');
     if(out.loop.end-out.loop.start<.05||out.loop.end-out.loop.start>60)c.add(field+'.loop','loop must be from 0.05 s to 60 s');
   }
   if(C.own(value,'fit'))out.fit=c.choice(value.fit,key==='background'?['cover','contain','tile']:['cover','contain'],field+'.fit');
   if(C.own(value,'position'))out.position=c.choice(value.position,key==='background'?['top','center','bottom']:['left','center','right'],field+'.position');
   pack[key]=out;
  }
  if(C.own(input,'frames')){
   const frames=c.record(input.frames,['panel','card'],'$.frames');
   pack.frames={};
   for(const key of Object.keys(frames)){
     const field='$.frames.'+key,
       value=c.record(frames[key],['asset','slice'],field,['asset','slice']),
       slice=c.array(value.slice,field+'.slice',4,4).map((n,i)=>c.number(n,field+'.slice['+i+']',0,Number.MAX_VALUE));
     pack.frames[key]={asset:C.reference(value.asset,assets,['image/svg+xml'],field+'.asset',c),slice};
   }
  }
  if(C.own(input,'title')){
   const value=c.record(input.title,['asset','family','weight','license'],'$.title',['asset','family','weight','license']);
   pack.title={
     asset:C.reference(value.asset,assets,['font/woff2'],'$.title.asset',c),
     family:c.text(value.family,'$.title.family',40),
     weight:c.number(value.weight,'$.title.weight',100,900,true),
     license:c.choice(value.license,licenses,'$.title.license')
   };
  }
  if(C.own(input,'icons'))pack.icons=c.array(input.icons,'$.icons',0,6).map((id,i)=>C.reference(id,assets,C.imageTypes.filter(type=>type!=='image/gif'),'$.icons['+i+']',c));return pack;
 }
 async function validate(source,deps={}){
  const c=C.context(),pack=clean(source,c),{media,infos}=await C.processAssets(pack,c,deps);
  for(const key of ['background','banner'])if(pack[key]){
   const value=pack[key],info=infos[value.asset],still=value.stillAsset||(typeof value.still==='string'?value.still:null),field='$.'+key;
   if((info?.animated||pack.assets[value.asset]?.type==='image/gif')&&!still)c.add(field+'.still','a video, GIF or animated image needs a separate static still asset');
   if(still&&infos[still]?.animated)c.add(field+'.'+(value.stillAsset?'stillAsset':'still'),'still asset must have no animation');
   if(value.loop&&info?.duration!==undefined&&value.loop.end>info.duration)c.add(field+'.loop.end','loop exceeds video duration');
   if(typeof value.still==='number'&&info?.duration!==undefined&&value.still>info.duration)c.add(field+'.still','still time exceeds video duration');
  }
  for(const id of pack.icons||[])if(infos[id]?.animated&&pack.assets[id].type!=='image/svg+xml')c.add('$.icons','animated raster icons cannot provide a reduced-motion copy; use static raster or SVG');
  for(const [key,frame]of Object.entries(pack.frames||{})){
   const svg=pack.assets[frame.asset]?.svg,match=svg&&/\bviewBox="([^"]+)"/.exec(svg),box=match?.[1].trim().split(/[\s,]+/).map(Number);
   if(box?.length===4){const [top,right,bottom,left]=frame.slice;if(top+bottom>box[3]||left+right>box[2])c.add('$.frames.'+key+'.slice','opposing slices exceed the SVG drawing box');}
  }
  c.finish();return {pack,media};
 }
 const api=Object.freeze({
   limits:C.limits,
   validate,
   importPack:(file,deps={})=>C.importPack(file,'chtheme',validate,deps),
   problems:(source,deps={})=>C.problems(validate,source,deps),
   portable:C.portable,
   contrast
 });
 root.ReserveThemePack=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
