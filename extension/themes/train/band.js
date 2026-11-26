/*! Canvas Harness — the Train Cabin's band in its own page (band.html). Original creator: Flzsh. */
// The dashboard (scene-themes.js frameBand) shows this page in a frame and tells it the moment: {tkBand:1, show:{env,
// view, swap, quiet, page, moving, travel}}, or rest, or clear. This page lays the band with the dashboard's own engine and
// answers its parent: ready (once, with the moment this page began), placed (with the names of the pictures shown), tone ('light', 'dark' or ''), stage
// (the stage of the day), failed. It listens to its parent only, and what it says holds nothing of the student.
(function(global){
 'use strict';
 const doc=global.document,scenes=global.ReserveSceneThemes,host=doc.querySelector('.tk-host'),base=new global.URL('.',global.location.href).href,id='train';
 const parent=global.parent&&global.parent!==global?global.parent:null;
 const say=message=>{try{parent?.postMessage({tkBand:1,...message},'*');}catch{}};
 let band=null,broken=false;
 const number=(value,low,high,or)=>Number.isFinite(value)?Math.min(high,Math.max(low,value)):or;
 function make(){
  if(band||broken)return band;
  band=scenes?.bandHere?.(doc,base,id,{tone:tone=>say({tone:tone||''}),stage:name=>say({stage:name||''}),fail:()=>{
   if(broken)return;
   broken=true;
   try{band?.destroy();}catch{}
   band=null;
   say({failed:true});
  }})||null;
  if(!band||!host){broken=true;say({failed:true});return null;}
  host.append(band.node);
  // the band marks itself laid (data-ready) when every picture of the moment is in: the dashboard fades it in then
  new global.MutationObserver(()=>{
   if(band?.node.hasAttribute('data-ready'))say({placed:true,pictures:band.pictures});
  }).observe(band.node,{attributes:true,attributeFilter:['data-ready']});
  return band;
 }
 // only what a moment is made of goes on to the band: numbers within their bounds, a mode, a box or none
 // (a travel: four numbers (a steady pace) or eight (a change of speed under way: the speed, acceleration and jerk it began with and how
 // long it takes), each within its bounds; anything else, none)
 function travelIn(t){
  if(!Array.isArray(t))return null;
  const out=[number(Number(t[0]),0,12,1),number(Number(t[1]),-1e13,1e13,0),number(Number(t[2]),-1e13,1e13,0),number(Number(t[3]),-1e13,1e13,0)];
  if(t.length>=8)out.push(number(Number(t[4]),0,12,0),number(Number(t[5]),-50,50,0),number(Number(t[6]),-500,500,0),number(Number(t[7]),0,60,0));
  return out;
 }
 function moment(raw){
  const e=raw?.env||{},v=raw?.view||{},q=raw?.quiet,size=(value,most)=>Number.isFinite(value)&&value>=1?Math.min(most,value):0,w=size(v.w,20000),h=size(v.h,4000);
  if(!w||!h)return null;
  return {
   env:{mode:e.mode==='dark'?'dark':'light',hour:number(e.hour,0,24,12),month:number(e.month,1,12,1),day:number(e.day,0,6,0),week:number(e.week,1,53,1),ratio:w/h},
   view:{w,h},
   swap:raw.swap===true,
   quiet:q&&typeof q==='object'?{x:number(q.x,-20000,20000,0),y:number(q.y,-4000,4000,0),w:number(q.w,0,20000,0),h:number(q.h,0,4000,0)}:null,page:number(raw.page,0,1,.5),moving:number(raw.moving,0,2,0),
   // (the travel: its pace, the moment on this page's clock, how far the journey had come, how much of the ride's loop had gone by)
   travel:travelIn(raw.travel),bare:raw.bare===true};
 }
 global.addEventListener('message',event=>{
  if(!parent||event.source!==parent)return;const said=event.data;if(!said||said.tkBand!==1)return;
  if(said.show){const m=moment(said.show);if(m)make()?.show(m.env,m.view,m.swap,m.quiet,m.page,m.moving,m.travel,m.bare);}
  else if(said.clear)band?.clear();
 });
 // (origin: the moment this page began, so what rides in the dashboard's own page moves from the same moment as the band)
 if(parent)say({ready:true,origin:global.performance?.timeOrigin||0});
})(globalThis);
