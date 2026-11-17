/*! Small document bootstrap; early drawings self-check, remaining add-ons load through the worker. */
(function(){
 'use strict';
 if(window.top!==window||globalThis.ReserveFeatureLoad||!globalThis.ReserveSite?.supported(location.href))return;
 let revision=0;
 function hint(selection){
  try{
   localStorage.setItem('reserve:features-hint',JSON.stringify({preset:selection.preset,enabled:selection.enabled}));
   if(!selection.enabled.includes('canvas-nav'))localStorage.removeItem('reserve:navEarly');
  }catch{}
 }
 // Keep the next document's prepaint selection current without changing this
 // document's snapshot. A pending worker reply must not restore an older hint.
 globalThis.chrome?.storage?.onChanged?.addListener((changes,area)=>{
  if(area==='local'&&changes['reserve:features']&&globalThis.ReserveFeatures){revision++;hint(globalThis.ReserveFeatures.resolve(changes['reserve:features'].newValue));}
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
