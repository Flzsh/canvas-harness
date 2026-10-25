// Adapted from Gary Wu's pull request #47 to Canvas Harness.
/* Canvas Harness — extension-only AI routing. No externally_connectable entry point. */
importScripts('features.js','site.js','core.js','market-site.js','ai-providers.js','ai-inject.js','ai-web.js','page-preferences.js',
 'custom-art.js','media-reference.js','media-store.js','workspace-arrange.js','customization-model.js','backup-media.js','custom-kits.js','quick-pack.js',
 'gpa-model.js','personal-work.js','storage.js','planner-model.js','pet-art.js','agent-clock.js','pony-ask.js',
 'pack-common.js','theme-pack.js','pet-pack.js','preset-pack.js','account-writes.js','market-holds.js','packs.js','market.js','market-media.js');
// Appearance changes from every page are applied here, one at a time (page-preferences.js).
globalThis.ReservePagePreferences?.serve();
(function(){
 'use strict';
 const channels=new Map(),panels=new Set(),requests=new Map(),handoffs=new Map();
 let offscreenPending;
 const featureLoads=new Map(),featureTabs=new Map(),featureCurrent=new Map(),tabFeatureKey=(id,documentId)=>'reserve:features:tab:'+id+':'+(documentId||'frame-0');
 const featureTarget=sender=>({tabId:sender.tab.id,...(sender.documentId?{documentIds:[sender.documentId]}:{frameIds:[sender.frameId??0]})});
 async function featurePrefs(){return (await chrome.storage.local.get(ReserveFeatures.KEY))[ReserveFeatures.KEY];}
 async function documentPrefs(sender){
  const tab=sender?.tab?.id,documentId=sender?.frameId===0?sender.documentId:channels.get(tab)?.port.sender.documentId,key=tabFeatureKey(tab,documentId);
  let prefs=featureTabs.get(key);
  if(!featureTabs.has(key)){
   const session=Number.isInteger(tab)?await chrome.storage.session?.get(key):null;
   prefs=session&&Object.hasOwn(session,key)?session[key]:await featurePrefs();
  }
  return prefs;
 }
 async function requireFeature(id,sender){
  const prefs=await documentPrefs(sender);
  if(!ReserveFeatures.resolve(prefs).enabled.includes(id))throw Error('This add-on is off. Reload Canvas to apply your add-ons.');
 }
 async function loadFeatures(sender){
  await ready;
  if(!canvasSender(sender))throw Error('Features may load only in a trusted Canvas top frame.');
  const key=tabFeatureKey(sender.tab.id,sender.documentId);
  featureCurrent.set(sender.tab.id,key);
  if(featureLoads.has(key))return featureLoads.get(key);
  const task=(async()=>{
   const prefs=await documentPrefs(sender),selection=ReserveFeatures.resolve(prefs),target=featureTarget(sender);
   // The preference read can finish after another document becomes current.
   // Probe the top frame without changing it, then publish only this document's snapshot.
   if(sender.documentId){
    const frames=await chrome.scripting.executeScript({target:{tabId:sender.tab.id,frameIds:[0]},world:'ISOLATED',func:()=>null});
    if(frames?.[0]?.documentId&&frames[0].documentId!==sender.documentId)throw Error('This Canvas document changed before its add-ons finished loading.');
   }
   if(featureCurrent.get(sender.tab.id)===key){
    featureTabs.set(key,prefs??null);
    if(chrome.storage.session?.set)await chrome.storage.session.set({[key]:prefs??null});
   }
   await chrome.scripting.executeScript({target,world:'ISOLATED',injectImmediately:true,func:value=>{globalThis.ReserveFeatures.apply(value);globalThis.ReserveStartup?.setFeatures?.(value,true);},args:[prefs??null]});
   // Prepaint JS/CSS already belongs to document_start; never evaluate it twice.
   const files=[...selection.startupJS,...selection.js].filter(file=>!ReserveFeatures.staticJS.includes(file));
   await chrome.scripting.executeScript({target,world:'ISOLATED',injectImmediately:true,files});
   return {ok:true,preset:selection.preset,enabled:selection.enabled};
  })();
  featureLoads.set(key,task);
  if(featureLoads.size>300)featureLoads.delete(featureLoads.keys().next().value);
  task.catch(()=>featureLoads.delete(key));return task;
 }

 const post=(port,message)=>{try{port.postMessage(message);}catch{}};
 const fail=(port,id,error)=>post(port,{id,ok:false,error:String(error?.message||error||'The request could not finish.')});
 const validId=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id);
 const sourceFor=port=>channels.get(port.sender?.tab?.id);
 function canvasSender(sender){return sender?.id===chrome.runtime.id&&sender.frameId===0&&Number.isInteger(sender.tab?.id)&&ReserveSite.supported(sender.url);}
 // The panel frame may be served from the extension's per-session address (use_dynamic_url), so compare the page, not the host.
 function panelSender(sender){try{const u=new URL(sender.url);return sender.id===chrome.runtime.id&&Number.isInteger(sender.tab?.id)&&u.protocol==='chrome-extension:'&&u.pathname==='/ai-panel.html'&&!u.search&&!u.hash;}catch{return false;}}
 // A Biscuit handoff is only a bounded composer draft in this exact source scope.
 // It never enters the provider or context-collection request paths.
 function validDraft(entry,draft){
  if(!draft||typeof draft!=='object'||!validId(draft.id)||typeof draft.text!=='string'||!draft.text.trim()||draft.text.length>20000||draft.text.includes('\u0000')||typeof draft.scopeKey!=='string'||draft.scopeKey.length>8192||draft.scopeKey.includes('\u0000')||draft.scopeKey!==entry.catalog?.scopeKey)return false;
  const [origin,accountId]=draft.scopeKey.split('|');return origin===new URL(entry.port.sender.url).origin&&/^\d+$/.test(accountId||'');
 }
 function publishDraft(entry,panel){if(entry?.draft&&panels.has(panel)&&sourceFor(panel)===entry&&validDraft(entry,entry.draft))post(panel,{kind:'draft',draft:entry.draft});}
 function setSourceCatalog(entry,data,tabId){
  const prior=entry.catalog?.scopeKey,owner=data.scopeKey.split('|').slice(0,2).join('|');
  if(prior!==data.scopeKey)entry.draft=null;
  if(prior&&owner!==prior.split('|').slice(0,2).join('|')){for(const panel of panels)if(panel.sender.tab.id===tabId)panel.disconnect();entry.catalog=null;return false;}
  entry.catalog=data;return true;
 }
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
  requests.set(id,{panel,originalId:message.id,source:entry.port,timer,scopeKey:entry.catalog.scopeKey});
  post(entry.port,{kind:'source-request',id,action:message.action,courseId:message.courseId,ids:message.ids,all:message.all===true,includeAssignmentPdfs:message.includeAssignmentPdfs===true,autoSend:message.autoSend===true});
 }
 async function onPanel(panel,message){
  if(!validId(message?.id))return;
  if(message.kind==='draft-ack'){
   const entry=sourceFor(panel),draft=entry?.draft;
   if(!panels.has(panel)||!draft||message.id!==draft.id||message.scopeKey!==draft.scopeKey||!validDraft(entry,draft))return;
   entry.draft=null;post(entry.port,{kind:'draft-ack',id:draft.id,scopeKey:draft.scopeKey});return;
  }
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
   await requireFeature('ai',panel.sender);
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
 function schoolSender(sender){return sender?.id===chrome.runtime.id&&(sender.frameId===undefined||sender.frameId===0)&&['welcome.html','popup.html'].some(page=>sender.url===chrome.runtime.getURL(page));}
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
  if(!chrome.scripting?.registerContentScripts){if(sites.length)throw Error('School site registration is unavailable. Reload Canvas Harness and try again.');return sites;}
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
 // Pack requests share the same registered-school trust list and account checks.
 globalThis.ReserveMarketReady=()=>ready;
 importScripts('market-worker.js');
 // Serialize account writes across origins after the current school registration settles.
 globalThis.ReserveStorage?.serveAccountWrites({ready:()=>ready});
 globalThis.ReserveFeatures.serveWrites({ready:()=>ready});
 // Keep the queue usable after a failure, but return this run's rejection to callers awaiting registration.
 const resync=()=>{const run=ready.then(registerSites);ready=run.catch(()=>[]);return run;};
 const sync=()=>resync().catch(()=>{});
 chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes[SITES])sync();});
 chrome.runtime.onInstalled?.addListener(sync);
 chrome.runtime.onStartup?.addListener(sync);
 chrome.permissions?.onRemoved?.addListener(sync);
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

 chrome.runtime.onConnect.addListener(port=>{
  if(port.name==='ch-ai-panel'&&!panelSender(port.sender)){port.disconnect();return;}
  if(['ch-ai-source','ch-ai-panel'].includes(port.name)){
   const held=[],hold=message=>held.push(message);port.onMessage.addListener(hold);
   let closed=false;port.onDisconnect.addListener(()=>{closed=true;});
   ready.then(()=>requireFeature('ai',port.sender)).then(()=>{port.onMessage.removeListener?.(hold);if(!closed)connect(port,held);},()=>port.disconnect());return;
  }
  connect(port,[]);
 });
 function connect(port,held){
  if(port.name==='ch-ai-source'&&canvasSender(port.sender)){
   const tabId=port.sender.tab.id,old=channels.get(tabId);if(old)old.port.disconnect();
   const entry={port,catalog:null,draft:null};channels.set(tabId,entry);
   const onSource=message=>{
    if(channels.get(tabId)!==entry)return;
    if(message?.kind==='catalog'&&message.data&&typeof message.data.scopeKey==='string'){
     // An account switch destroys conversations rather than attaching a new account's sources.
     if(!setSourceCatalog(entry,message.data,tabId))return;
     for(const panel of panels)if(panel.sender.tab.id===tabId){post(panel,{kind:'catalog',data:message.data});publishDraft(entry,panel);}
    }else if(message?.kind==='draft'){
     if(!validDraft(entry,message.draft))return;
     entry.draft={id:message.draft.id,text:message.draft.text,scopeKey:message.draft.scopeKey};
     for(const panel of panels)if(panel.sender.tab.id===tabId)publishDraft(entry,panel);
    }else if(validId(message?.id)){
     const pending=requests.get(message.id);if(!pending||pending.source!==port)return;
     clearTimeout(pending.timer);requests.delete(message.id);
     if(message.ok&&message.result?.scopeKey&&pending.scopeKey!==entry.catalog?.scopeKey&&message.result.scopeKey!==entry.catalog?.scopeKey){fail(pending.panel,pending.originalId,'The Canvas view changed. Review the new sources.');return;}
     if(message.ok&&message.result?.sources&&typeof message.result?.scopeKey==='string'&&!setSourceCatalog(entry,message.result,tabId))return;
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
   held.forEach(message=>onPanel(port,message));
   const entry=sourceFor(port),data=entry?.catalog;if(data){post(port,{kind:'catalog',data});publishDraft(entry,port);}
   port.onDisconnect.addListener(()=>{
    panels.delete(port);handoffs.delete(port);
    for(const [id,p] of requests)if(p.panel===port){clearTimeout(p.timer);requests.delete(id);}
   });
  }else port.disconnect();
 }
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.target==='ch-course-files'){
   if(message.op!=='load'){reply({ok:false,error:'Unsupported course file operation.'});return;}
   (async()=>{
    await ready;if(!canvasSender(sender))throw Error('Course file backups require a trusted Canvas top frame.');
    await chrome.scripting.executeScript({target:featureTarget(sender),world:'ISOLATED',files:['course-files.js']});
   })().then(()=>reply({ok:true}),error=>reply({ok:false,error:String(error?.message||error)}));return true;
  }
  if(message?.target==='ch-play'){
   if(message.op!=='load'){reply({ok:false,error:'Unsupported play operation.'});return;}
   (async()=>{
    await ready;if(!canvasSender(sender))throw Error('Play tools require a trusted Canvas top frame.');
    await requireFeature('play',sender);
    const target=featureTarget(sender);
    await chrome.scripting.executeScript({target,world:'ISOLATED',files:['submit-scenes.js','play-art.js','play-space.js','play-physics.js','play-tools.js']});
    await chrome.scripting.insertCSS({target,files:['play-tools.css']});
   })().then(()=>reply({ok:true}),error=>reply({ok:false,error:String(error?.message||error||'The play tools could not load.')}));return true;
  }
  if(message?.target==='ch-features'){
   if(message.op!=='load'){reply({ok:false,error:'Unsupported feature operation.'});return;}
   loadFeatures(sender).then(reply,error=>reply({ok:false,error:String(error?.message||error)}));return true;
  }
  if(message?.type==='ch-school-ready'){
   const origin=ReserveSite.customSite(message.origin);
   if(!schoolSender(sender)||!origin||origin!==message.origin){reply({ok:false,error:'Invalid school registration request.'});return;}
   resync().then(sites=>reply(sites.includes(origin)?{ok:true,origin}:{ok:false,error:'Allow access to your school’s Canvas site and try again.'}),error=>reply({ok:false,error:String(error?.message||error||'School registration failed. Try again.')}));
   return true;
  }
  if(message?.type!=='ch-ai-pdf')return;
  ready.then(()=>requireFeature('ai',sender)).then(()=>{
   if(!canvasSender(sender)||!channels.has(sender.tab.id)){reply({ok:false,error:'An active Canvas context is required.'});return;}
   return pdf(message.base64).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));
  }).catch(error=>reply({ok:false,error:error.message}));
  return true;
 });
 chrome.tabs?.onRemoved?.addListener(tab=>{
  featureCurrent.delete(tab);const prefix='reserve:features:tab:'+tab+':';
  for(const map of [featureTabs,featureLoads])for(const key of map.keys())if(key.startsWith(prefix))map.delete(key);
  void(async()=>{try{const saved=await chrome.storage.session?.get(null);if(saved)await chrome.storage.session.remove(Object.keys(saved).filter(key=>key.startsWith(prefix)));}catch{}})();
 });
})();
