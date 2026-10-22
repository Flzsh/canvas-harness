/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
// Packaged Starfield document. It shares the dashboard renderer and never loads remote content.
(() => {
 'use strict';
 const canvas=document.getElementById('c'),poster=document.getElementById('poster');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),still=new URLSearchParams(location.search).has('still');
 let animator,dead=false,parentPaused=false;
 const disposers=[];
 function listen(target,type,fn,options){target.addEventListener(type,fn,options);disposers.push(()=>target.removeEventListener(type,fn,options));}
 function sync(){
  if(dead)return;
  const paused=still||reduced.matches||document.hidden||document.visibilityState==='hidden'||parentPaused;
  if(!paused&&!animator)animator=globalThis.ReserveSceneThemes?.createStarSky(canvas,document,globalThis);
  animator?.pause(paused);canvas.hidden=paused||!animator;poster.hidden=!canvas.hidden;
 }
 function aim(x,y,inside){if(!canvas.hidden)animator?.aim(x,y,inside);}
 listen(document,'visibilitychange',sync);
 if(reduced.addEventListener)listen(reduced,'change',sync);
 listen(globalThis,'resize',()=>animator?.resize(),{passive:true});
 listen(globalThis,'pointermove',event=>{const box=canvas.getBoundingClientRect();if(box.width&&box.height)aim((event.clientX-box.left)/box.width,(event.clientY-box.top)/box.height,true);},{passive:true});
 listen(document.documentElement,'pointerleave',()=>aim(0,0,false));
 listen(globalThis,'message',event=>{
  if(event.source!==parent||parent===globalThis||!event.data||typeof event.data!=='object')return;
  const data=event.data;
  if(typeof data.pause==='boolean'){parentPaused=data.pause;sync();}
  if(data.lens===1&&Number.isFinite(data.x)&&Number.isFinite(data.y)&&data.x>=0&&data.x<=1&&data.y>=0&&data.y<=1)aim(data.x,data.y,data.inside===true);
 });
 listen(globalThis,'pagehide',()=>{dead=true;animator?.destroy();for(const dispose of disposers)dispose();});
 sync();if(parent!==globalThis)parent.postMessage({tkSky:'ready'},'*');
})();
