/* Canvas Harness distraction guard: asks Chrome for access to other websites, straight from the student's click on this
   page (focus-guard.html), with Chrome's own prompt. Nothing asks at install. background.js notices the new access
   and starts covering the listed sites if a session is running; the focus room shows the result. */
(function(){
 'use strict';
 const ALL_SITES={permissions:['scripting'],origins:['https://*/*']};
 const perms=globalThis.chrome?.permissions,$=id=>document.getElementById(id);
 const allow=$('allow'),close=$('close'),status=$('status');
 const done=()=>{allow.hidden=true;close.textContent='Close';status.textContent='Allowed. The guard is ready; you can close this window and go back to Canvas.';setTimeout(()=>window.close(),2500);};
 close.addEventListener('click',()=>window.close());
 allow.addEventListener('click',()=>{
  if(!perms?.request){status.textContent='This browser can’t give the access here.';return;}
  allow.disabled=true;
  // IMPORTANT: asked synchronously from the click, before anything is awaited, or Chrome will not show its prompt.
  perms.request(ALL_SITES).then(ok=>{allow.disabled=false;if(ok)done();else status.textContent='Chrome didn’t allow it, so the guard stays off. You can try again here.';},
   ()=>{allow.disabled=false;status.textContent='Chrome couldn’t ask just now. Try the button again.';});
 });
 if(perms?.contains)perms.contains(ALL_SITES).then(ok=>{if(ok)done();},()=>{});
 allow.focus();
})();
