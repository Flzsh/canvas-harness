/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Version 1 .chtheme documents; no persistence or remote resources.
   band (optional, 2026-11-07): one picture or video painted across the whole band at the top of Home (behind the menu
   bar, the greeting and the Bookmarks row), like the packaged scenes' skies; authored at 8:1 (4096 x 512). It takes
   the background and banner rules for stills and loops, a focus (object-position, default x 1, y .5) and an optional
   dark picture (band.dark: asset, still, stillAsset, loop; same rules) shown in dark mode instead; nothing else.
   Canvas Harness versions before it reject a band as an unknown field.
   Band level 2 (2026-11-09, band-kit.js): the band is read by the kit, and the kit is tolerant. Inside `band` an unknown
   key is ignored and an unknown or unusable piece, variant or narrow picture is left out; only the basics still fail a
   pack (no usable main picture, a broken still or loop, the size limits). What was ignored or left out comes back from
   validate() as `band: {needs, notes}` for the checker. Two top-level keys travel with it: `minBand` (the lowest band
   level that shows this band; a lower version installs the theme without its band) and `companion` (a whole .chpet
   document; checked by the pet reader, left out when it does not pass). Assets nothing reads any more are dropped. */
(function(root){
 'use strict';
 const dependency=(global,file)=>root[global]||(typeof module==='object'&&module.exports?require('./'+file+'.js'):null),K=dependency('ReserveBandKit','band-kit');
 const C=root.ReservePackCommon||(typeof module==='object'&&module.exports?require('./pack-common.js'):null),
   colors=['bg','surface','ink','muted','line','accent'],
   types=C.imageTypes.concat(C.videoTypes),
   licenses=['OFL-1.1','Apache-2.0','CC0-1.0'];
 function luminance(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
 function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 /* A pack for a later band level (minBand above the level this version reads): its band is held, and so is whatever
    beside the band this version cannot read yet (a top-level key it does not know, an asset of a type it does not take),
    so a later level can grow the format without failing this version's install. Any other pack is read as before. */
 const topKeys=['format','version','name','by','colors','background','banner','band','minBand','companion','frames','title','icons','assets'],assetTypes=types.concat('font/woff2');
 function later(source,c){
  let doc;try{doc=typeof source==='string'?JSON.parse(source):source;}catch{return source;}
  if(!K||!doc||typeof doc!=='object'||Array.isArray(doc)||!Number.isInteger(doc.minBand)||doc.minBand<=K.level||doc.minBand>999)return source;
  const held=path=>{c.band.notes.push({path,kind:'held',message:'this pack needs band level '+doc.minBand+'; held with its band'});return false;};
  const out=Object.fromEntries(Object.entries(doc).filter(([key])=>topKeys.includes(key)||held('$.'+key)));
  if(out.assets&&typeof out.assets==='object'&&!Array.isArray(out.assets))
    out.assets=Object.fromEntries(Object.entries(out.assets).filter(([id,a])=>!(a&&typeof a==='object'&&typeof a.type==='string'&&!assetTypes.includes(a.type))||held('$.assets.'+id)));
  return out;
 }
 function clean(source,c){
  c.band={needs:{level:1,uses:[]},notes:[],frames:[],held:false,companion:null};source=later(source,c);
  const {input,pack}=C.header(source,'chtheme',['colors','background','banner','band','minBand','companion','frames','title','icons','assets'],['colors'],c),
    modes=c.record(input.colors,['light','dark'],'$.colors');
  pack.colors={};
  if(!Object.keys(modes).length)c.add('$.colors','provide light, dark or both');
  for(const mode of Object.keys(modes)){
   const field='$.colors.'+mode,palette=c.record(modes[mode],colors,field,colors),out={};
   for(const key of colors){const value=palette[key];if(typeof value!=='string'||!/^#[a-f0-9]{6}$/i.test(value))c.add(field+'.'+key,'expected #RRGGBB');else out[key]=value.toLowerCase();}
   for(const [ink,surface,min]of [['ink','bg',4.5],['ink','surface',4.5],['muted','surface',3],['accent','surface',3]])
     if(out[ink]&&out[surface]){const ratio=contrast(out[ink],out[surface]);if(ratio<min)c.add(field+'.'+ink,'contrast on '+field+'.'+surface+' is '+ratio.toFixed(2)+':1; requires '+min+':1');}
   pack.colors[mode]=out;
  }
  if(C.own(input,'assets'))pack.assets=C.assets(input.assets,c);const assets=pack.assets||{};
  // A placed picture: background, banner, band, or the band's dark picture (each with the fields it takes).
  function placed(raw,field,allowed,key){
   const value=c.record(raw,allowed,field,['asset']),
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
   return {out,value};
  }
  const fields={background:['asset','still','stillAsset','fit','position','focus','zoom','height','loop'],banner:['asset','still','stillAsset','fit','position','focus','zoom','height','loop'],band:['asset','still','stillAsset','focus','loop','dark']};
  const B=c.band,note=(path,kind,message)=>B.notes.push({path,kind,message});
  // every string the band names: an asset only the band named and nothing reads after reading it is dropped, not an error
  B.named=new Set();(function walk(v,d){if(typeof v==='string')B.named.add(v);else if(v&&typeof v==='object'&&d<20)for(const x of Object.values(v))walk(x,d+1);})(input.band,0);
  if(C.own(input,'minBand')){
    if(Number.isInteger(input.minBand)&&input.minBand>=1&&input.minBand<=999)pack.minBand=input.minBand;else note('$.minBand','ignored','expected a whole number from 1; left out');
  }
  if(C.own(input,'companion')){
    if(K&&input.companion&&typeof input.companion==='object'&&!Array.isArray(input.companion))
      B.companion=input.companion;
    else note('$.companion','skipped','expected a whole companion document; left out');
  }
  /* The kit reads the band; this file still places its pictures. A picture the band cannot do without (the main one, a
     dark one) is placed strictly, as before; an optional one (narrow, a variant) that does not pass is left out whole,
     and what it added to the problems and to the used assets is taken back. */
  function picture(value,field,strict){
   const mark=c.problems.length,used=[...c.used],out=placed(value,field,K.pictureKeys,'band').out;
   if(!strict&&c.problems.length>mark){c.problems.length=mark;c.used.clear();for(const id of used)c.used.add(id);return null;}
   B.frames.push({value:out,field});return out;
  }
  const drawable=id=>{const ok=typeof id==='string'&&C.own(assets,id)&&C.imageTypes.includes(assets[id].type)&&assets[id].type!=='image/gif';if(ok)c.used.add(id);return ok;};
  for(const key of ['background','banner','band'])if(C.own(input,key)){
   if(key==='band'&&K){
    if(pack.minBand>K.level){B.held=true;note('$.band','held','this band asks for band level '+pack.minBand+' and this version reads level '+K.level+'; the theme is installed without its band');continue;}
    if(!input.band||typeof input.band!=='object'||Array.isArray(input.band)){placed(input.band,'$.band',K.pictureKeys,key);continue;}
    const read=K.clean(input.band,{picture,image:drawable});pack.band=read.source;B.needs=read.needs;B.notes.push(...read.notes);continue;
   }
   const {out,value}=placed(input[key],'$.'+key,fields[key],key);pack[key]=out;
   // band.dark: the band's own picture for dark mode (optional; without it the one band shows in both modes, like the scenes)
   if(key==='band'&&C.own(value,'dark'))out.dark=placed(value.dark,'$.band.dark',['asset','still','stillAsset','loop'],key).out;
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
  const c=C.context(),pack=clean(source,c),B=c.band;
  // When part of the band was ignored, left out or held back, an asset may have lost its only reader: it is dropped, not an error.
  if(pack.assets)
    for(const key of Object.keys(pack.assets))
      if(!c.used.has(key)&&(B.notes.some(item=>['ignored','skipped','held','fallback'].includes(item.kind))||B.named.has(key))){
        delete pack.assets[key];
        B.notes.push({path:'$.assets.'+key,kind:'dropped',message:'nothing reads this asset here; it is not kept'});
      }
  const {media,infos}=await C.processAssets(pack,c,deps),
    pictures=K?B.frames.map(frame=>[frame.value,frame.field]):[pack.band?[[pack.band,'$.band']]:[],pack.band?.dark?[[pack.band.dark,'$.band.dark']]:[]].flat();
  for(const [value,field]of [['background','banner'].filter(key=>pack[key]).map(key=>[pack[key],'$.'+key]),pictures].flat()){
   const info=infos[value.asset],still=value.stillAsset||(typeof value.still==='string'?value.still:null);
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
  c.finish();
  // The companion is a whole pet document: the pet reader decides. One that does not pass is left out; the theme still installs.
  if(B.companion){
   try{const pets=dependency('ReservePetPack','pet-pack');if(!pets?.validate)throw Error('companions cannot be read here');pack.companion=(await pets.validate(JSON.stringify(B.companion),deps)).pack;}
   catch(error){
     B.notes.push({path:'$.companion',kind:'skipped',message:'the companion does not pass the companion check and is left out ('+String(error?.message||error).split('\n')[0].slice(0,160)+')'});
   }
  }
  return {pack,media,band:{level:K?.level||1,needs:B.needs,notes:B.notes,held:B.held}};
 }
 const portable=pack=>{const {companion,...rest}=pack,out=C.portable(rest);if(companion)out.companion=C.portable(companion);return out;};
 const api=Object.freeze({
   limits:C.limits,
   validate,
   importPack:(file,deps={})=>C.importPack(file,'chtheme',validate,deps),
   problems:(source,deps={})=>C.problems(validate,source,deps),
   portable,
   contrast
 });
 root.ReserveThemePack=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
