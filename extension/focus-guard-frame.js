/* Canvas Harness distraction guard switch (focus-guard.html). Switching it on asks Chrome for access to other
   websites, straight from the student's click, with Chrome's own prompt; nothing asks at install. The focus room
   keeps the switch's state; this page only tells it what the student chose and whether Chrome allowed it. Only the
   focus room on a supported Canvas page can talk to it. */
(function(){
 'use strict';
 const parentOrigin=(location.ancestorOrigins&&location.ancestorOrigins[0])||'';
 const LOCAL=/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
 const allowed=origin=>!!origin&&origin===parentOrigin&&(globalThis.ReserveSite?.supported?.(origin)||LOCAL.test(location.origin)&&LOCAL.test(origin));
 const tell=message=>{if(parentOrigin&&window.parent!==window)window.parent.postMessage({type:'reserve-focus-guard',...message},parentOrigin);};
 const ALL_SITES={permissions:['scripting'],origins:['https://*/*']};
 const perms=globalThis.chrome?.permissions,box=document.getElementById('on'),params=new URLSearchParams(location.search);
 // A local preview has no browser permissions to ask for, so it behaves as if allowed.
 let on=params.get('on')==='1',granted=perms?.request?null:LOCAL.test(location.origin);
 const tone=value=>{document.documentElement.dataset.tone=value==='dark'?'dark':'light';};
 const paint=()=>{box.checked=on&&granted!==false;};
 tone(params.get('tone'));paint();
 window.addEventListener('message',event=>{
  if(event.source!==window.parent||!allowed(event.origin))return;
  const m=event.data;if(m?.type!=='reserve-focus-room'||m.op!=='guard')return;
  on=m.on===true;tone(m.tone);paint();
 });
 box.addEventListener('click',()=>{
  if(!box.checked){on=false;tell({op:'set',on:false,granted});return;}
  if(!perms?.request){on=granted===true;paint();tell(on?{op:'set',on:true,granted:true}:{op:'denied',granted:false});return;}
  // IMPORTANT: asked synchronously from the click, before anything is awaited, or Chrome will not show its prompt.
  perms.request(ALL_SITES).then(ok=>{granted=ok;on=ok;paint();tell(ok?{op:'set',on:true,granted:true}:{op:'denied',granted:false});},
   ()=>{on=false;paint();tell({op:'denied',granted:false});});
 });
 (perms?.contains?perms.contains(ALL_SITES).catch(()=>false):Promise.resolve(granted)).then(ok=>{granted=ok;paint();tell({op:'ready',granted:ok});});
})();
