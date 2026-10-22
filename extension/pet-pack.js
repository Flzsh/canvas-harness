/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Version 1 .chpet: isolated SVG and raster poses with prepared reduced-motion copies. */
(function(root){
 'use strict';
 const C=root.ReservePackCommon||(typeof module==='object'&&module.exports?require('./pack-common.js'):null),poses=Object.freeze(['stand','walk','sleep','trot','lie','read','eat','cheer','flag','fall','held']),fallbacks=Object.freeze({trot:'walk',lie:'sleep',read:'stand',eat:'stand',cheer:'stand',flag:'stand',fall:'stand',held:'stand'});
 async function validate(source,deps={}){
  const c=C.context(),{input,pack}=C.header(source,'chpet',['size','ground','faces','poses','assets'],['size','ground','faces','poses','assets'],c);
  const types=['image/svg+xml','image/png','image/webp','image/gif'];pack.size=c.array(input.size,'$.size',2,2).map((n,i)=>c.number(n,'$.size['+i+']',32,128,true));pack.ground=c.number(input.ground,'$.ground',0,pack.size[1]??128,true);pack.faces=c.choice(input.faces,['left','right'],'$.faces');pack.assets=C.assets(input.assets,c,types);
  const values=c.record(input.poses,poses,'$.poses',['stand','walk','sleep']);pack.poses={};for(const key of Object.keys(values))pack.poses[key]=C.reference(values[key],pack.assets,types,'$.poses.'+key,c);
  for(const [key,asset]of Object.entries(pack.assets))if(asset.type!=='image/svg+xml'){const size=c.attempt('$.assets.'+key+'.data',()=>C.dependency('ReserveCustomKits','custom-kits').helpers.base64Size(asset.data));if(size>2097152)c.add('$.assets.'+key+'.data','raster pose exceeds 2097152 bytes (2 MiB)');}
  const {media}=await C.processAssets(pack,c,deps);c.finish();return {pack,media};
 }
 function pose(pack,name='stand',still=false){const key=C.own(pack.poses,name)?name:C.own(fallbacks,name)?fallbacks[name]:'stand',asset=pack.assets[pack.poses[key]];return still&&asset.animated&&!asset.svg?pack.assets[pack.poses.stand]:asset;}
 const api=Object.freeze({limits:C.limits,poses,fallbacks,pose,validate,importPack:(file,deps={})=>C.importPack(file,'chpet',validate,deps),problems:(source,deps={})=>C.problems(validate,source,deps),portable:C.portable});root.ReservePetPack=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
