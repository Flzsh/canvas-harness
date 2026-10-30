/* Explicitly selected PDF data is kept in memory for this extraction only. */
(function(){
 'use strict';
 function pages(value){
   if(value===undefined)return undefined;
   let list;
   if(typeof value==='string'&&/^\d{1,9}(?:-\d{1,9})?$/.test(value)){
     const [first,last=first]=value.split('-').map(Number);
     if(first<1||last<first||last-first>=20)throw Error('Choose 1-20 valid PDF pages.');
     return value;
   }
   if(Array.isArray(value)&&value.length>0&&value.length<=20)list=value;else throw Error('Choose 1-20 valid PDF pages.');
   if(list.some(page=>!Number.isSafeInteger(page)||page<1)||new Set(list).size!==list.length)throw Error('Choose 1-20 distinct positive PDF pages.');
   return list.slice();
 }
 let busy=false;
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.target!=='ch-pdf'||sender.id!==chrome.runtime.id||sender.tab)return;
  if(busy){reply({ok:false,error:'Another PDF is being read. Try again in a moment.'});return;}
  busy=true;
  (async()=>{
   if(typeof message.base64!=='string'||message.base64.length>2796204)throw Error('Choose a PDF no larger than 2 MiB.');
   const selected=pages(message.pages);
   const binary=atob(message.base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
   const result=await CanvasHarnessPDF.extract(bytes,{maxPages:20,maxChars:60000,timeoutMs:15000,...(selected!==undefined?{pages:selected}:{})});
   return {...result,...(Array.isArray(result.pageTexts)?{pageTexts:result.pageTexts}:{})};
  })().then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message||'This PDF could not be read.'})).finally(()=>{busy=false;});
  return true;
 });
})();
