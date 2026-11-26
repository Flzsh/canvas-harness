/*! Canvas Harness — the land under the Train Cabin's room in its own page (page.html). Original creator: Flzsh. */
// The dashboard (scene-themes.js framePage) shows this page in a frame under the band and tells it the moment: {tkPage:1, show:{g,
// land, hours, moving, travel, epoch, most, still, paint, quality}}, or clear. This page draws the land with the painter (painter.js,
// WebGL2: the land in the window and under the room, living) when the dashboard allows it and the painter works, else lays it as
// before with the dashboard's own engine (pageHere: roomPage under the room; the band then keeps its own land in the window). It
// answers its parent: ready (once, with the moment this page began), placed (the land is laid), painting (the painter draws, or no
// longer), failed. It listens to its parent only, and what it says holds nothing of the student.
(function(global){
 'use strict';
 const doc=global.document,scenes=global.ReserveSceneThemes,host=doc.querySelector('.tk-host'),root=doc.querySelector('.rd'),base=new global.URL('.',global.location.href).href,id='train';
 const parent=global.parent&&global.parent!==global?global.parent:null;
 const say=message=>{try{parent?.postMessage({tkPage:1,...message},'*');}catch{}};
 let land=null,broken=false,laid='',painter=null,glDead=false,painting=false,last=null,waiting=false;
 const number=(value,low,high,or)=>Number.isFinite(value)?Math.min(high,Math.max(low,value)):or;
 const STAGES=['morning','noon','sunset','dusk','night'];
 function make(){
  if(land||broken)return land;
  land=scenes?.pageHere?.(doc,base,id,{fail:()=>{if(broken)return;broken=true;try{land?.clear();}catch{}land=null;say({failed:true});}})||null;
  if(!land||!host){broken=true;say({failed:true});return null;}
  host.append(land.node);return land;
 }
 // (engine 2: the painter draws the land when the dashboard allows it (Graphics Medium and up) and WebGL2 is there; without it, or once
 // its context is lost twice, the land is laid as before. Until the painter has drawn its first whole frame the land is laid as before
 // under it too, so nothing is ever missing)
 function paintOff(){if(painter){try{painter.destroy();}catch{}painter=null;}if(painting){painting=false;say({painting:false});}}
 function paint(m,l){
  if(glDead||!m.paint||!global.ReserveTrainPainter){paintOff();return false;}
  if(!painter){
   painter=global.ReserveTrainPainter.make(doc,base,{on:{painting:v=>{
     v=!!v;
     if(v===painting)return;
     painting=v;
     say({painting:v});
     if(last)apply(last);
   },fail:()=>{glDead=true;paintOff();if(last)apply(last);}}});
   if(!painter){glDead=true;return false;}root?.append(painter.canvas);
  }
  const info=l.info?.(m.land);if(!info){paintOff();return false;}
  // (the window's strips are named by the ride (ride.json): until it is read the land is laid as before, then painted)
  if(!l.ride?.lands){if(!waiting){waiting=true;l.ride?.whenRead?.(()=>{waiting=false;if(last&&l.ride?.lands)apply(last);});}return false;}
  painter.show({
    land:m.land,
    hours:m.hours,
    info,
    lands:l.ride?.lands?.[m.land]||null,
    live:m.quality>=1?l.ride?.live?.(m.land)||null:null,
    win:m.g.win,
    k:m.g.k,
    page:{x:m.g.x,top:m.g.top},
    moving:m.moving,
    epoch:m.epoch,
    ride:l.ride,
    quality:m.quality,
    floor:m.quality<=1?1:0
  });
  painter.run(m.moving>0);return true;
 }
 // only what a moment is made of goes on to the land: numbers within their bounds, a land's name, the hours that show
 function moment(raw){
  const g=raw?.g||{},name=typeof raw?.land==='string'&&/^[a-z]{1,16}$/.test(raw.land)?raw.land:'';if(!name)return null;
  const k=number(g.k,0,8,0),deep=number(g.deep,0,20000,0),win=g.win&&typeof g.win==='object'?{x:number(g.win.x,-40000,40000,0),y:number(g.win.y,-4000,4000,0)}:null;if(!(k>0)||!(deep>0))return null;
  const hours=(Array.isArray(raw.hours)?raw.hours:[]).slice(0,4).filter(h=>Array.isArray(h)&&STAGES.includes(h[0])&&Number.isFinite(h[1])).map(h=>
    [h[0],number(h[1],0,1,0)]);
  if(!hours.length)return null;
  const t=raw.travel;
  return {g:{x:number(g.x,-40000,40000,0),k,top:number(g.top,0,20000,0),deep,win},land:name,hours,moving:number(raw.moving,0,2,0),
   // (the travel: its pace, the moment on the band's clock, how far the journey had come, how much of the ride's loop had gone by; and
   // while the speed changes, the speed, acceleration and jerk it began with and how long the change takes)
   travel:Array.isArray(t)?
     [
       number(Number(t[0]),0,12,1),
       number(Number(t[1]),-1e13,1e13,0),
       number(Number(t[2]),-1e13,1e13,0),
       number(Number(t[3]),-1e13,1e13,0),
       ...(t.length>=8?[number(Number(t[4]),0,12,0),number(Number(t[5]),-50,50,0),number(Number(t[6]),-500,500,0),number(Number(t[7]),0,60,0)]:[])
     ]:
     null,
   // (the band's page began at this moment of this page's clock; the lever's greatest pace)
   epoch:number(raw.epoch,-864e5,864e5,0),most:number(raw.most,0,12,1),still:raw.still===1,
   // (may the painter draw it, and how much: 1 Medium, 2 High, 3 Extra high)
   paint:raw.paint===true,quality:Math.round(number(raw.quality,1,3,2))};
 }
 function apply(raw){
  const m=moment(raw);if(!m)return;const l=make();if(!l)return;if(l.node.parentNode!==host)host.append(l.node);
  // (Still, Off and reduced motion: as in the dashboard's page, nothing fades by itself either)
  if(root&&root.hasAttribute('data-tk-still')!==m.still){if(m.still)root.setAttribute('data-tk-still','');else root.removeAttribute('data-tk-still');}
  last=raw;const drawn=paint(m,l);
  if(l.show(m.g,m.land,m.hours,m.moving,m.travel,m.epoch,m.most,!drawn||!painting)&&laid!==m.land){laid=m.land;say({placed:true});}
 }
 global.addEventListener('message',event=>{
  if(!parent||event.source!==parent)return;const said=event.data;if(!said||said.tkPage!==1)return;
  if(said.show)apply(said.show);
  else if(said.clear){last=null;paintOff();land?.clear();laid='';}
  // (for the benches: how the painter is doing)
  else if(said.stats){if(said.sprites)painter?.look?.(true);say({stats:painter?{...painter.stats,painting}:{painting:false,glDead}});}
 });
 // (origin: the moment this page began, so the dashboard can tell this page the band's moments on its own clock)
 if(parent)say({ready:true,origin:global.performance?.timeOrigin||0});
})(globalThis);
