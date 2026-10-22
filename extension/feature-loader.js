/*! Small document bootstrap; early drawings self-check, remaining add-ons load through the worker. */
(function(){
 'use strict';
 if(window.top!==window||globalThis.ReserveFeatureLoad||!globalThis.ReserveSite?.supported(location.href))return;
 let revision=0;
 function hint(selection){try{localStorage.setItem('reserve:features-hint',JSON.stringify({preset:selection.preset,enabled:selection.enabled}));}catch{}}
 // Keep the next document's prepaint selection current without changing this
 // document's snapshot. A pending worker reply must not restore an older hint.
 globalThis.chrome?.storage?.onChanged?.addListener((changes,area)=>{
  if(area==='local'&&changes['reserve:features']){revision++;hint(globalThis.ReserveFeatures.resolve(changes['reserve:features'].newValue));}
 });
 // Static art must confirm its hint and reconcile before modules injected by
 // the worker capture it, including when this document has a stale hint.
 globalThis.ReserveFeatureLoad=Promise.resolve(globalThis.ReserveFeatures?.earlyReady).then(async()=>{
  const reading=revision,reply=await chrome.runtime.sendMessage({target:'ch-features',op:'load'});
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
