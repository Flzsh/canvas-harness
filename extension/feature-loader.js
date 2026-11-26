/*! Small document bootstrap; early drawings self-check, remaining add-ons load through the worker. */
(function(){
 'use strict';
 if(window.top!==window||globalThis.ReserveFeatureLoad||!globalThis.ReserveSite?.supported(location.href))return;
 let revision=0;
 function hint(selection){
  // (switched off on Canvas the selection is empty: the hint keeps what the student chose, for the day it is on again)
  if(selection?.off)return;
  try{
   localStorage.setItem('reserve:features-hint',JSON.stringify({preset:selection.preset,enabled:selection.enabled}));
   if(!selection.enabled.includes('canvas-nav'))localStorage.removeItem('reserve:navEarly');
  }catch{}
 }
 // "On Canvas" switched in the popup while this tab is open: the page in front of the student becomes the one they asked
 // for. Not while something has been typed here (a reply, a submission comment), nor while the focus is in a frame (Canvas's
 // text editor types in one, out of this page's hearing): then the page holds until its next load.
 // An assignment or submission page is never reloaded by Canvas Harness (typing there can sit inside Canvas's editor
 // frame, where this page cannot see it, and a chosen file would be lost): what it draws there follows the switch at once.
 const handIn=globalThis.ReserveSite?.vanillaPage?.(location)===true;
 let typed=false;
 if(!handIn)document.addEventListener?.('input',event=>{
  const at=event.composedPath?.()[0]||event.target;
  if(at&&(at.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(at.tagName||'')))typed=true;
 },true);
 const holding=()=>handIn||typed||document.activeElement?.tagName==='IFRAME';
 // Keep the next document's prepaint selection current without changing this
 // document's snapshot. A pending worker reply must not restore an older hint.
 globalThis.chrome?.storage?.onChanged?.addListener((changes,area)=>{
  if(area!=='local')return;
  const on=changes['reserve:enabled'];
  if(on&&(on.newValue===false)!==(on.oldValue===false)){
   try{globalThis.ReserveFeatures?.setSwitch?.(on.newValue!==false);}catch{}
   if(!holding()){location.reload();return;}
  }
  if(changes['reserve:features']&&globalThis.ReserveFeatures){revision++;hint(globalThis.ReserveFeatures.resolve(changes['reserve:features'].newValue));}
 });
 // A worker that was stopped or restarted during the ask drops it (the message fails or comes back empty): two more
 // asks, 1 and 3 s apart, while the cover holds. An explicit refusal is final.
 async function ask(){
  for(let i=0;;i++){
   let reply,failed;
   try{reply=await chrome.runtime.sendMessage({target:'ch-features',op:'load'});}catch(error){failed=error;}
   if(reply||i>=2){if(!reply&&failed)throw failed;return reply;}
   await new Promise(done=>globalThis.setTimeout(done,i?3000:1000));
  }
 }
 // Edge runs an extension's content-script groups in the order of their internal ids compared as text ("_mc_10" before
 // "_mc_9"), not as the manifest lists them: this file, last in the second group, can run before features.js of the
 // first. Wait for it a task at a time, so the early drawings still confirm their hint first.
 if(!globalThis.ReserveFeatures)globalThis.ReserveFeatureOrderSwapped=true;// (for content.js's start-up record)
 const featuresReady=new Promise(done=>{
  let n=0;
  (function look(){if(globalThis.ReserveFeatures||++n>40)done(globalThis.ReserveFeatures);else globalThis.setTimeout(look,n<4?0:25);})();
 });
 // Static art must confirm its hint and reconcile before modules injected by
 // the worker capture it, including when this document has a stale hint.
 globalThis.ReserveFeatureLoad=featuresReady.then(features=>features?.earlyReady).then(async()=>{
  const reading=revision,reply=await ask();
  if(!reply?.ok)throw Error(reply?.error||'Canvas Harness could not load.');
  // Only the content world can write the Canvas origin's synchronous prepaint hint.
  if(revision===reading)hint(reply);
  document.dispatchEvent(new Event('reserve:features-ready'));
  return reply;
 }).catch(error=>{
  globalThis.ReserveStartup?.release();
  console.warn('Canvas Harness:',error.message);
  return {ok:false,error:error.message};
 });
})();
