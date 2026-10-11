/* Canvas Harness — extension-only AI routing. No externally_connectable entry point. */
importScripts('site.js','ai-providers.js','ai-inject.js','ai-web.js');
(function(){
 'use strict';
 const channels=new Map(),panels=new Set(),requests=new Map(),handoffs=new Map();
 let offscreenPending;

 const post=(port,message)=>{try{port.postMessage(message);}catch{}};
 const fail=(port,id,error)=>post(port,{id,ok:false,error:String(error?.message||error||'The request could not finish.')});
 const validId=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id);
 const sourceFor=port=>channels.get(port.sender?.tab?.id);
 function canvasSender(sender){return sender.id===chrome.runtime.id&&sender.frameId===0&&Number.isInteger(sender.tab?.id)&&ReserveSite.supported(sender.url);}
 function panelSender(sender){return sender.id===chrome.runtime.id&&Number.isInteger(sender.tab?.id)&&sender.url===chrome.runtime.getURL('ai-panel.html');}
 async function liveSource(port){
  const entry=sourceFor(port);if(!entry?.catalog)throw Error('Open Canvas Harness on a signed-in Canvas page first.');
  const tab=await chrome.tabs.get(port.sender.tab.id);
  if(!ReserveSite.supported(tab.url)||new URL(tab.url).origin!==new URL(entry.port.sender.url).origin)throw Error('This Canvas tab changed. Reopen the AI tools.');
  return entry;
 }
 async function verifyAccount(entry){
  const origin=new URL(entry.port.sender.url).origin,expected=entry.catalog.scopeKey.split('|')[1];
  const response=await fetch(origin+'/api/v1/users/self/profile',{credentials:'include',redirect:'error',headers:{Accept:'application/json+canvas-string-ids'},signal:AbortSignal.timeout(15000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('json'))throw Error('Sign in to Canvas again before sharing context.');
  const profile=await response.json();
  if(String(profile.id)!==expected)throw Error('Your Canvas account changed. Reload Canvas Harness before sharing context.');
 }
 async function verifyShare(panel,message,entry){
  const current=()=>sourceFor(panel)===entry&&message.scopeKey===entry.catalog?.scopeKey;
  if(typeof message.scopeKey!=='string'||!current())throw Error('Your Canvas view changed. Review the context again before sharing.');
  await verifyAccount(entry);
  if(!current())throw Error('Your Canvas view changed. Review the context again before sharing.');
 }
 async function pdf(base64){
  if(typeof base64!=='string'||base64.length>Math.ceil(2*1024*1024/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('Choose a PDF no larger than 2 MiB.');
  if(!await chrome.offscreen.hasDocument()){
   offscreenPending??=chrome.offscreen.createDocument({url:'ai-offscreen.html',reasons:['WORKERS'],justification:'Read text from explicitly selected small PDFs locally.'}).finally(()=>{offscreenPending=null;});
   await offscreenPending;
  }
  const reply=await chrome.runtime.sendMessage({target:'ch-pdf',base64});if(!reply?.ok)throw Error(reply?.error||'PDF text could not be extracted.');return reply.result;
 }
 function sourceRequest(panel,message,entry){
  if(!['catalog','load-course','collect','close','preference'].includes(message.action))throw Error('Unsupported Canvas context request.');
  if(message.action==='preference'&&typeof message.autoSend!=='boolean')throw Error('Invalid AI preference.');
  if(message.action==='collect'&&(!Array.isArray(message.ids)||message.ids.length>30||message.ids.some(x=>typeof x!=='string'||x.length>1000)))throw Error('Choose at most 30 sources.');
  const id=crypto.randomUUID(),timer=setTimeout(()=>{const pending=requests.get(id);if(pending){requests.delete(id);fail(panel,message.id,'Context gathering took too long. Try fewer sources.');}},120000);
  requests.set(id,{panel,originalId:message.id,source:entry.port,timer});
  post(entry.port,{kind:'source-request',id,action:message.action,courseId:message.courseId,ids:message.ids,all:message.all===true,includeAssignmentPdfs:message.includeAssignmentPdfs===true,autoSend:message.autoSend===true});
 }
 async function onPanel(panel,message){
  if(!validId(message?.id))return;
  if(message.action==='cancel'){
   if(!validId(message.requestId))return;
   if(handoffs.get(panel)===message.requestId)handoffs.delete(panel);
   for(const [id,pending] of requests)if(pending.panel===panel&&pending.originalId===message.requestId){clearTimeout(pending.timer);requests.delete(id);}
   post(panel,{id:message.id,ok:true,result:{cancelled:true}});return;
  }
  // Register before any await: a timeout can arrive while tab/account checks
  // are still pending, and it must not be overwritten when they resolve.
  if(message.action==='web'&&message.op==='inject')handoffs.set(panel,message.id);
  try{
   const entry=await liveSource(panel);
   if(['catalog','load-course','collect','close','preference'].includes(message.action)){if(message.action==='close')handoffs.delete(panel);sourceRequest(panel,message,entry);return;}
   if(message.action==='web'){
    if(!['status','open','inject'].includes(message.op))throw Error('Unsupported website action.');
    if(message.op==='inject'&&(typeof message.text!=='string'||!message.text.trim()||message.text.length>140000))throw Error('Choose some context to send, up to 140,000 characters.');
    if(message.op==='inject'){await verifyShare(panel,message,entry);if(handoffs.get(panel)!==message.id)throw Error('The AI panel closed or the request was replaced. Click Send again when ready.');}
    let result;try{result=await CanvasHarnessWeb.handle({type:'ch-ai-web',action:message.op,provider:message.provider,text:message.text,autoSend:message.autoSend===true},{...entry.port.sender,tab:entry.port.sender.tab},{canShare:()=>handoffs.get(panel)===message.id&&panels.has(panel)&&sourceFor(panel)===entry&&message.scopeKey===entry.catalog?.scopeKey});}finally{if(handoffs.get(panel)===message.id)handoffs.delete(panel);}
    post(panel,{id:message.id,ok:true,result});return;
   }
   if(message.action==='pdf'){post(panel,{id:message.id,ok:true,result:await pdf(message.base64)});return;}
   throw Error('Unsupported AI action.');
  }catch(error){if(handoffs.get(panel)===message.id)handoffs.delete(panel);fail(panel,message.id,error);}
 }
 chrome.runtime.onConnect.addListener(port=>{
  if(port.name==='ch-ai-source'&&canvasSender(port.sender)){
   const tabId=port.sender.tab.id,old=channels.get(tabId);if(old)old.port.disconnect();
   const entry={port,catalog:null};channels.set(tabId,entry);
   port.onMessage.addListener(message=>{
    if(message?.kind==='catalog'&&message.data&&typeof message.data.scopeKey==='string'){
     const owner=message.data.scopeKey.split('|').slice(0,2).join('|'),prior=entry.catalog?.scopeKey.split('|').slice(0,2).join('|');
     // An account switch destroys conversations rather than attaching a new account's sources.
     if(prior&&owner!==prior){for(const panel of panels)if(panel.sender.tab.id===tabId)panel.disconnect();entry.catalog=null;return;}
     entry.catalog=message.data;
     for(const panel of panels)if(panel.sender.tab.id===tabId)post(panel,{kind:'catalog',data:message.data});
    }else if(validId(message?.id)){
     const pending=requests.get(message.id);if(!pending||pending.source!==port)return;
     clearTimeout(pending.timer);requests.delete(message.id);
     if(message.ok&&message.result?.sources&&message.result?.scopeKey)entry.catalog=message.result;
     post(pending.panel,{...message,id:pending.originalId});
    }
   });
   port.onDisconnect.addListener(()=>{
    if(channels.get(tabId)!==entry)return;channels.delete(tabId);
    for(const [id,p] of requests)if(p.source===port){clearTimeout(p.timer);fail(p.panel,p.originalId,'The Canvas session closed. Reopen AI tools.');requests.delete(id);}
    for(const panel of panels)if(panel.sender.tab.id===tabId)panel.disconnect();
   });
  }else if(port.name==='ch-ai-panel'&&panelSender(port.sender)){
   panels.add(port);port.onMessage.addListener(message=>onPanel(port,message));
   const data=sourceFor(port)?.catalog;if(data)post(port,{kind:'catalog',data});
   port.onDisconnect.addListener(()=>{
    panels.delete(port);handoffs.delete(port);
    for(const [id,p] of requests)if(p.panel===port){clearTimeout(p.timer);requests.delete(id);}
   });
  }else port.disconnect();
 });
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='ch-ai-pdf')return;
  if(!canvasSender(sender)||!channels.has(sender.tab.id)){reply({ok:false,error:'An active Canvas context is required.'});return;}
  pdf(message.base64).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));return true;
 });
})();
