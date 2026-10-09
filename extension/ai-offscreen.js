/* Explicitly selected PDF data is kept in memory for this extraction only. */
(function(){
 'use strict';
 let busy=false;
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.target!=='ch-pdf'||sender.id!==chrome.runtime.id||sender.tab)return;
  if(busy){reply({ok:false,error:'Another PDF is being read. Try again in a moment.'});return;}
  busy=true;
  (async()=>{
   if(typeof message.base64!=='string'||message.base64.length>2796204)throw Error('Choose a PDF no larger than 2 MiB.');
   const binary=atob(message.base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
   return CanvasHarnessPDF.extract(bytes,{maxPages:20,maxChars:60000,timeoutMs:15000});
  })().then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message||'This PDF could not be read.'})).finally(()=>{busy=false;});
  return true;
 });
})();
