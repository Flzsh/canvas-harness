/* One clock for the Focus room and Home ring. The browser interpolates a single SVG stroke;
   the one-second text tick never starts another transition. No animation-frame loop or layout reads. */
(function(root){'use strict';
 const model=()=>root.ReserveFocusRoomModel||(typeof require==='function'?require('./focus-room-model.js'):null);
 // Closed, clockwise, and starting at noon. The old sketch overlapped itself at the seam.
 const PATH='M60 9a51 51 0 1 1 0 102a51 51 0 1 1 0-102Z';
 function sample(focus,now=Date.now()){
  const f=model().full(focus),open=f.mode==='open',duration=(open?3600:f.minutes*60)*1000;
  const elapsed=open?(f.elapsed*1000+(f.startedAt?Math.max(0,now-f.startedAt):0)):
   f.endsAt?duration-Math.max(0,Math.min(duration,f.endsAt-now)):duration-(f.remaining||f.minutes*60)*1000;
  const progress=open?(elapsed%duration)/duration:Math.max(0,Math.min(1,elapsed/duration));
  return {progress,duration,running:open?!!f.startedAt:!!f.endsAt,open};
 }
 function create(arc,{getFocus,now=Date.now}={}){
  const doc=arc.ownerDocument,media=doc.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)');
  let animation=null,key='',dead=false;
  function sync(force=false){
   if(dead)return;
   const focus=getFocus(),f=model().full(focus),s=sample(f,now());
   const next=JSON.stringify([f.mode,f.minutes,f.remaining,f.endsAt,f.startedAt,f.elapsed,!!media?.matches,!!doc.hidden]);
   arc.style.opacity=s.progress===0&&!s.running?'0':'1';
   if(!force&&key===next&&!media?.matches){
    // A workspace reconciliation may remove inline styles; paused/unsupported dials still need their snapshot.
    if(!animation)arc.style.strokeDashoffset=String(1-s.progress);
    return;
   }
   key=next;animation?.cancel();animation=null;
   arc.style.strokeDashoffset=String(1-s.progress);
   if(!s.running||!s.open&&s.progress===1||doc.hidden||media?.matches||!arc.animate)return;
   animation=arc.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{
    duration:s.duration,iterations:s.open?Infinity:1,easing:'linear',fill:'both'});
   animation.currentTime=s.progress*s.duration;
  }
  const refresh=()=>sync(true);
  doc.addEventListener('visibilitychange',refresh);media?.addEventListener?.('change',refresh);
  sync();
  return {sync,destroy(){dead=true;animation?.cancel();animation=null;doc.removeEventListener('visibilitychange',refresh);media?.removeEventListener?.('change',refresh);}};
 }
 const api={PATH,sample,create};root.ReserveFocusDial=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
