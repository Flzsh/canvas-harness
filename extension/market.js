/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Optional market access. Request must begin directly in the popup click. */
(function(root){
 'use strict';
 const HOST='https://flzsh.github.io/*',MATCH='https://flzsh.github.io/canvas-harness-packs/*';let pending=Promise.resolve();
 const access=()=>({origins:[HOST],...(root.chrome.runtime.getManifest().optional_permissions?.includes('scripting')?{permissions:['scripting']}:{})});
 function sync(){
  pending=pending.catch(()=>{}).then(async()=>{
   const chrome=root.chrome;if(!chrome.permissions?.contains||!chrome.scripting?.getRegisteredContentScripts)return;
   const granted=await chrome.permissions.contains(access()),[current]=await chrome.scripting.getRegisteredContentScripts({ids:['ch-market']});
   if(!granted){if(current)await chrome.scripting.unregisterContentScripts({ids:['ch-market']});return;}
   if(!current){const script={id:'ch-market',matches:[MATCH],js:['market-bridge.js'],runAt:'document_idle',allFrames:false,world:'ISOLATED',persistAcrossSessions:true};
    try{await chrome.scripting.registerContentScripts([script]);}catch(error){if(!(await chrome.scripting.getRegisteredContentScripts({ids:['ch-market']})).length)throw error;}
   }
   // Permission removal can race the registration await.
   if(!await chrome.permissions.contains(access()))await chrome.scripting.unregisterContentScripts({ids:['ch-market']});
  });return pending;
 }
 async function open(url){
  let granted=false;try{granted=await root.chrome.permissions?.request(access());}catch{}
  if(granted)try{await sync();}catch{}
  if(root.chrome.runtime.sendMessage){const reply=await root.chrome.runtime.sendMessage({type:'market-open',url});if(!reply?.ok)throw Error(reply?.reason||'Choose your Canvas school before opening Market.');return reply.tab;}
  return root.chrome.tabs.create({url});
 }
 root.ReserveMarket=Object.freeze({sync,open});
})(globalThis);
