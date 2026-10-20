/* Canvas Harness — extension-only AI routing. No externally_connectable entry point. */
importScripts('site.js','ai-providers.js','ai-inject.js','ai-web.js','focus-guard-model.js');
(function(){
 'use strict';
 const channels=new Map(),panels=new Set(),requests=new Map(),handoffs=new Map();
 let offscreenPending;

 const post=(port,message)=>{try{port.postMessage(message);}catch{}};
 const fail=(port,id,error)=>post(port,{id,ok:false,error:String(error?.message||error||'The request could not finish.')});
 const validId=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id);
 const sourceFor=port=>channels.get(port.sender?.tab?.id);
 function canvasSender(sender){return sender.id===chrome.runtime.id&&sender.frameId===0&&Number.isInteger(sender.tab?.id)&&ReserveSite.supported(sender.url);}
 // The panel frame may be served from the extension's per-session address (use_dynamic_url), so compare the page, not the host.
 function panelSender(sender){try{const u=new URL(sender.url);return sender.id===chrome.runtime.id&&Number.isInteger(sender.tab?.id)&&u.protocol==='chrome-extension:'&&u.pathname==='/ai-panel.html'&&!u.search&&!u.hash;}catch{return false;}}
 async function liveSource(port){
  await ready;
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
 // School Canvas sites on their own address. The student adds one in the popup; the browser asks for
 // access to that one site; the same scripts that run on instructure.com are then registered there.
 // Taking access away in the browser's extension settings removes them again.
 const SITES='reserve:sites',PENDING='reserve:pendingSite',PREFIX='ch-site-';
 async function grantedSites(){
  const saved=(await chrome.storage.local.get(SITES))[SITES],out=[];
  for(const value of Array.isArray(saved)?saved:[]){
   const origin=ReserveSite.customSite(value);
   if(origin&&!out.includes(origin)&&await chrome.permissions.contains({origins:[origin+'/*']}).catch(()=>false))out.push(origin);
  }
  return out;
 }
 async function loadSites(){const sites=await grantedSites();ReserveSite.trustSites(sites);return sites;}
 async function registerSites(){
  const sites=await loadSites();
  if(!chrome.scripting?.registerContentScripts)return sites;
  const old=(await chrome.scripting.getRegisteredContentScripts()).map(s=>s.id).filter(id=>id.startsWith(PREFIX));
  if(old.length)await chrome.scripting.unregisterContentScripts({ids:old});
  if(sites.length){
   const matches=sites.map(origin=>origin+'/*'),marked=js=>js.flatMap(file=>file==='site.js'?[file,'custom-site.js']:[file]);
   await chrome.scripting.registerContentScripts(chrome.runtime.getManifest().content_scripts.map((entry,i)=>({
    id:PREFIX+i,matches,js:marked(entry.js),...(entry.css?{css:entry.css}:{}),runAt:entry.run_at||'document_idle',allFrames:false,persistAcrossSessions:true})));
  }
  return sites;
 }
 let ready=loadSites().catch(()=>[]);
 const resync=()=>(ready=registerSites().catch(()=>[]));
 chrome.runtime.onInstalled?.addListener(resync);
 chrome.runtime.onStartup?.addListener(resync);
 chrome.permissions?.onRemoved?.addListener(resync);
 // A first install opens the welcome page, where the student sets their school's Canvas address before visiting it.
 chrome.runtime.onInstalled?.addListener(details=>{if(details?.reason==='install')chrome.tabs.create({url:chrome.runtime.getURL('welcome.html')}).catch?.(()=>{});});
 chrome.permissions?.onAdded?.addListener(async added=>{
  // The popup saves the address just before it asks, so give that write a moment to land.
  let pending;
  for(let i=0;i<5&&!pending;i++){pending=ReserveSite.customSite((await chrome.storage.local.get(PENDING))[PENDING]);if(!pending)await new Promise(r=>setTimeout(r,100));}
  if(!pending||!added?.origins?.includes(pending+'/*'))return;
  const saved=(await chrome.storage.local.get(SITES))[SITES];
  await chrome.storage.local.set({[SITES]:[...new Set([...(Array.isArray(saved)?saved:[]),pending])]});
  await chrome.storage.local.remove(PENDING);
  await resync();
  await chrome.tabs.create({url:pending+'/?reserve=open'});
 });

 // The focus room's distraction guard (focus-guard-model.js). The room copies a running session to its own key; while
 // it runs, the reminder (focus-guard-page.js) is added to the sites on the student's list and nowhere else, and only
 // once the student has allowed access to other websites by switching the guard on. Canvas and the school's own
 // sites are left out. Pages already open on those sites get it when a session starts.
 const Guard=globalThis.ReserveFocusGuardModel,GUARD_ID='ch-focus-guard',GUARD_FILES=['site.js','focus-guard-model.js','focus-guard-page.js'];
 const ALL_SITES={permissions:['scripting'],origins:['https://*/*']};
 let guardQueue=Promise.resolve();
 const syncGuard=(fresh=false)=>(guardQueue=guardQueue.then(()=>applyGuard(fresh)).catch(()=>{}));
 async function applyGuard(fresh){
  if(!Guard||!chrome.scripting?.registerContentScripts||!chrome.storage?.local)return;
  const rec=Guard.cleanRecord((await chrome.storage.local.get(Guard.KEY))[Guard.KEY]);
  const old=await chrome.scripting.getRegisteredContentScripts({ids:[GUARD_ID]}).catch(()=>[]);
  if(old.some(s=>s.id===GUARD_ID))await chrome.scripting.unregisterContentScripts({ids:[GUARD_ID]});
  if(!(rec.until>Date.now())||!rec.sites.length||!await chrome.permissions.contains(ALL_SITES).catch(()=>false))return;
  const schools=await grantedSites(),matches=Guard.matches(rec.sites);
  await chrome.scripting.registerContentScripts([{id:GUARD_ID,matches,excludeMatches:['https://*.instructure.com/*',...schools.map(origin=>origin+'/*')],
   js:GUARD_FILES,runAt:'document_start',allFrames:false,persistAcrossSessions:false}]);
  if(!fresh||!chrome.tabs?.query)return;
  for(const tab of await chrome.tabs.query({url:matches}).catch(()=>[]))
   if(Guard.status(rec,tab.url,{protect:schools}).site)chrome.scripting.executeScript({target:{tabId:tab.id},files:GUARD_FILES}).catch(()=>{});
 }
 chrome.storage?.onChanged?.addListener((changes,area)=>{
  const change=area==='local'&&Guard&&changes[Guard.KEY];if(!change)return;
  const was=Guard.cleanRecord(change.oldValue),now=Guard.cleanRecord(change.newValue);
  syncGuard(now.until>Date.now()&&(was.until!==now.until||was.sites.join()!==now.sites.join()));
 });
 chrome.runtime.onInstalled?.addListener(()=>syncGuard());
 chrome.runtime.onStartup?.addListener(()=>syncGuard());
 chrome.permissions?.onAdded?.addListener(()=>syncGuard(true));
 chrome.permissions?.onRemoved?.addListener(()=>syncGuard());

 chrome.runtime.onConnect.addListener(port=>{
  // A school's own address is known only once the saved list has loaded; hold its early messages until then.
  if(port.name==='ch-ai-source'&&!canvasSender(port.sender)&&ReserveSite.customSite(port.sender?.url)){
   const held=[],hold=message=>held.push(message);port.onMessage.addListener(hold);
   ready.then(()=>{port.onMessage.removeListener?.(hold);connect(port,held);});return;
  }
  connect(port,[]);
 });
 function connect(port,held){
  if(port.name==='ch-ai-source'&&canvasSender(port.sender)){
   const tabId=port.sender.tab.id,old=channels.get(tabId);if(old)old.port.disconnect();
   const entry={port,catalog:null};channels.set(tabId,entry);
   const onSource=message=>{
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
   };
   port.onMessage.addListener(onSource);held.forEach(onSource);
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
 }
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.type!=='ch-ai-pdf')return;
  ready.then(()=>{
   if(!canvasSender(sender)||!channels.has(sender.tab.id)){reply({ok:false,error:'An active Canvas context is required.'});return;}
   return pdf(message.base64).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));
  });
  return true;
 });
})();
