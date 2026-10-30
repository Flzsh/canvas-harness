/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
// Standalone on Canvas assignment pages: wait for a new receipt before loading the drawings.
(() => {
 'use strict';
 const KEY='reserve:just-submitted',LAST='reserve:last-submit-scene';
 const STATUS='#sidebar_content, #right-side .details, .submission-details, [data-testid="assignment-student-header"], [data-testid="submission-status"]';
 const assignment=()=>globalThis.ReserveSite?.vanillaPage(location)===true;
 const identity=(path=location.pathname)=>typeof path==='string'?path.match(/^\/courses\/\d+\/assignments\/\d+(?=\/|$)/)?.[0]:null;
 let reduced,observer,timer,box,scene,play,inFlight,lastScene,motion='gentle',dead=false;
 let featureEnabled=globalThis.ReserveFeatures?.enabled('play')!==false;
 let featureReady=!globalThis.ReserveFeatures?.early,
  featureRevision=0,
  globalEnabled=false,
  globalReady=false,
  globalRevision=0,
  epoch=0,
  domReady=document.readyState!=='loading';
 const enabled=()=>!dead&&domReady&&globalReady&&globalEnabled&&featureReady&&featureEnabled;
 const disposers=[];
 function listen(target,type,fn,options){target?.addEventListener?.(type,fn,options);disposers.push(()=>target?.removeEventListener?.(type,fn,options));}
 function record(){
  try{const value=JSON.parse(sessionStorage.getItem(KEY)),age=Date.now()-value?.t;
   return !!identity()&&
    typeof value?.path==='string'&&
    identity(value.path)===identity()&&
    Array.isArray(value.before)&&
    value.before.every(x=>typeof x==='string')&&
    typeof value.t==='number'&&
    age>=0&&
    age<180000?
    value:
    null;
  }catch{return null;}
 }
 function submitted(){
  const found=new Map(),text=node=>node===box||node===scene?'':node.nodeType===3?node.textContent:[...node.childNodes].map(text).join(' ');
  for(const area of document.querySelectorAll(STATUS))for(const el of [area,...area.querySelectorAll('*')]){
   const own=[...el.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join('').trim();
   if(/^submitted!?$/i.test(own))found.set(el,text(el.closest(STATUS)||area).replace(/\s+/g,' ').trim().toLowerCase().replace(/\bsubmitted!(?=\s|$)/g,'submitted'));
  }
  return [...found].map(([marker,attempt])=>({marker,attempt}));
 }
 function stop(){observer?.disconnect();clearTimeout(timer);timer=0;}
 function ensureMotion(){if(reduced)return;reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');if(reduced?.addEventListener)listen(reduced,'change',syncMotion);}
 function syncMotion(){
  if(motion==='off'){scene?.remove();scene=null;}
  if(scene){scene.classList.toggle('chs-still',motion==='still'||!!reduced?.matches);scene.classList.toggle('chs-paused',!!document.hidden||document.visibilityState==='hidden');}
  play?.setMotion?.(motion);
 }
 function suspend(){
  epoch++;stop();if(inFlight)inFlight.cancelled=true;
  play?.destroy?.();play=null;scene?.remove();scene=null;box?.remove();box=null;
  if(globalReady&&!globalEnabled||featureReady&&!featureEnabled)try{sessionStorage.removeItem(KEY);}catch{}
 }
 async function render(marker,job){
  const [loaded,saved]=await Promise.all([chrome.runtime.sendMessage({target:'ch-play',op:'load'}),chrome.storage.local.get('reserve:appearance')]);
  if(!loaded?.ok)throw Error(loaded?.error||'The celebration could not load.');
  if(!enabled()||job.cancelled||job.epoch!==epoch||!assignment()||identity()!==job.assignment)throw Error('The assignment changed or Canvas Harness was turned off; the celebration was cancelled.');
  ensureMotion();
  motion=saved?.['reserve:appearance']?.motion||'gentle';marker=marker?.isConnected?marker:submitted()[0]?.marker;
  const parent=document.querySelector('#right-side')||document.querySelector('#content')||document.body;
  // Every receipt gets one fresh deal. Restore earlier page play before replacing its tray.
  play?.destroy?.();play=null;box?.remove();scene?.remove();scene=null;box=document.createElement('div');
  if(motion!=='off'){
   let previous=lastScene;try{previous=localStorage.getItem(LAST)||previous;}catch{}
   const art=globalThis.ReserveSubmitScenes||{},all=Object.keys(art),keys=all.filter(key=>key!==previous),pool=keys.length?keys:all;
   const key=pool[Math.min(pool.length-1,Math.floor(Math.random()*pool.length))];
   if(key){scene=document.createElement('div');scene.className='chs-scene';scene.setAttribute('aria-hidden','true');scene.style.width='290px';scene.style.maxWidth='100%';scene.innerHTML=art[key];
    lastScene=key;try{localStorage.setItem(LAST,key);}catch{}
   }
  }
  const parts=scene?[scene,box]:[box];if(marker)marker.after(...parts);else parent.prepend(...parts);
  play=globalThis.ReservePlay.mount({box,motion,root:document.querySelector('#content')||document.body,
   blocks:'#content > *, #right-side-wrapper > *, #left-side',shake:'#application, #wrapper',ours:'.chs-scene',allowed:()=>enabled()&&assignment()});
  syncMotion();
 }
 function celebrate(marker){
  const key=identity();if(inFlight?.assignment===key&&!inFlight.cancelled)return inFlight.promise;
  if(inFlight)inFlight.cancelled=true;
  const job={assignment:key,epoch};inFlight=job;
  return job.promise=render(marker,job).finally(()=>{if(inFlight===job)inFlight=null;});
 }
 function check(){
  const saved=record();if(!enabled()||!assignment()||!saved){stop();return;}
  const marker=submitted().find(receipt=>!saved.before.includes(receipt.attempt))?.marker;if(!marker)return;
  try{sessionStorage.removeItem(KEY);}catch{}
  stop();void celebrate(marker).catch(()=>{});
 }
 function watch(){
  observer??=new MutationObserver(check);observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  clearTimeout(timer);timer=setTimeout(stop,20000);
 }
 function remember(){
  if(!enabled()||!assignment())return;
  const before=record()?.before||submitted().map(receipt=>receipt.attempt);
  try{sessionStorage.setItem(KEY,JSON.stringify({path:identity(),t:Date.now(),before}));}catch{return;}
  watch();
 }
 function reconcile(){if(!enabled()){suspend();return;}if(assignment()&&record()){watch();check();}}
 listen(document,'submit',event=>{const form=event.target?.closest?.('form');if(form?.closest('#submit_assignment'))remember();},true);
 listen(document,'click',event=>{const button=event.target?.closest?.('button, [role="button"], [data-testid="submit-button"]');
  if(button&&(button.getAttribute('data-testid')==='submit-button'||/^submit assignment$/i.test(button.textContent.trim())))remember();
 },true);
 listen(document,'visibilitychange',syncMotion);
 const changed=(changes,area)=>{
  if(area!=='local'||dead)return;
  if(changes['reserve:enabled']){globalRevision++;globalReady=true;globalEnabled=changes['reserve:enabled'].newValue!==false;}
  if(changes['reserve:features']){
   const model=globalThis.ReserveFeatures,selection=model?.resolve?.(changes['reserve:features'].newValue);
   featureRevision++;featureReady=true;featureEnabled=selection?selection.enabled.includes('play'):model?.enabled('play')!==false;
  }
  if(changes['reserve:enabled']||changes['reserve:features'])reconcile();
  if(changes['reserve:appearance']){motion=changes['reserve:appearance'].newValue?.motion||'gentle';syncMotion();}
 };
 chrome.storage.onChanged?.addListener(changed);disposers.push(()=>chrome.storage.onChanged?.removeListener(changed));
 function destroy(){if(dead)return;dead=true;suspend();for(const dispose of disposers)dispose();}
 listen(globalThis,'pagehide',destroy);
 globalThis.ReserveSubmitCelebrate={destroy};
 if(!domReady)listen(document,'DOMContentLoaded',()=>{domReady=true;reconcile();},{once:true});
 if(globalThis.ReserveFeatures?.early)
  globalThis.ReserveFeatures.early('play',()=>{
   if(!featureRevision)featureEnabled=true;
   featureReady=true;
   reconcile();
  },()=>{if(!featureRevision)featureEnabled=false;featureReady=true;reconcile();});
 const reading=globalRevision;
 Promise.resolve().then(()=>chrome.storage.local.get('reserve:enabled')).then(saved=>{
  if(dead||reading!==globalRevision)return;globalReady=true;globalEnabled=saved?.['reserve:enabled']!==false;reconcile();
 },()=>{if(dead||reading!==globalRevision)return;globalReady=true;globalEnabled=false;reconcile();});
})();
