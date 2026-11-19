/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
// The AI help notice: AI help stays locked until the student, with the AI help add-on installed, ticks the box and
// presses Turn on AI help. Only this page asks the worker to unlock it (background.js, 'ch-ai-notice').
(function(){
 'use strict';
 const $=id=>document.getElementById(id),agree=$('agree'),turnOn=$('turn-on'),notNow=$('not-now'),status=$('status');
 let busy=false,ready=false;
 const say=text=>{status.textContent=text||'';status.hidden=!text;};
 const sync=()=>{turnOn.disabled=!ready||busy||!agree.checked;};
 const ask=op=>chrome.runtime.sendMessage({type:'ch-ai-notice',op}).then(reply=>reply||{ok:false},()=>({ok:false}));
 // The student's own light or dark choice in Canvas Harness; without one, the system's.
 try{
  chrome.storage.local.get('reserve:appearance').then(saved=>{
   const theme=saved?.['reserve:appearance']?.theme;
   if(theme==='dark'||theme==='light')document.documentElement.dataset.theme=theme;
  },()=>{});
 }catch{}
 function done(text){
  agree.checked=true;agree.disabled=true;turnOn.hidden=true;
  notNow.textContent='Close';
  say(text);
 }
 agree.addEventListener('change',sync);
 notNow.addEventListener('click',()=>{window.close();});
 turnOn.addEventListener('click',async()=>{
  if(!ready||busy||!agree.checked)return;
  busy=true;sync();say('');
  const reply=await ask('agree');
  busy=false;
  if(reply.ok&&reply.on){done('AI help is on. Reload Canvas to apply.');return;}
  say(reply.error||'AI help could not be turned on. Try again.');sync();
 });
 ask('state').then(reply=>{
  if(!reply.ok){say(reply.error||'AI help could not be checked. Reload this page.');return;}
  if(!reply.installed){agree.disabled=true;say('Add AI help from the Market first.');return;}
  if(reply.on){done('AI help is on.');return;}
  ready=true;sync();
 });
})();
