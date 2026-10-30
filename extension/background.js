// Adapted from Gary Wu's pull request #47 to Canvas Harness.
/* Canvas Harness — extension-only AI routing. No externally_connectable entry point. */
importScripts('features.js','site.js','core.js','market-site.js','ai-providers.js','ai-inject.js','ai-web.js','page-preferences.js',
 'custom-art.js','media-reference.js','media-store.js','workspace-arrange.js','customization-model.js','backup-media.js','custom-kits.js','quick-pack.js',
 'gpa-model.js','personal-work.js','storage.js','planner-model.js','pet-art.js','agent-clock.js','pony-ask.js',
 'pack-common.js','theme-pack.js','pet-pack.js','preset-pack.js','account-writes.js','market-holds.js','packs.js','market.js','market-media.js',
 // Your AI (4.0): providers by API key, Google Docs text, study aids, the Today and overnight runs and their records.
 'ai-api-provider.js','ai-api.js','google-docs.js','study-kind.js','study-prompts.js','study-writes.js','study-ui.js','overnight.js','api.js','study-band.js','ai-context.js',
 'agent-prompts.js','agent-data.js','agent-actions.js','agent-runtime.js','agent-client.js','ai-run-store.js','study-tools.js','prepare-brief.js','ai-canvas-bridge.js','ai-canvas.js',
 'ai-delivery-web.js','ai-delivery-api.js','ai-results.js','ai-runner.js','ai-engine.js','ai-prepare.js');
// Appearance changes from every page are applied here, one at a time (page-preferences.js).
globalThis.ReservePagePreferences?.serve();
(function(){
 'use strict';
 const channels=new Map(),panels=new Set(),requests=new Map(),handoffs=new Map(),catalogWaits=new Map(),answerReads=new Map(),agentJobs=new Map(),agentWrites=new Map();
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
   await chrome.scripting.executeScript({target,world:'ISOLATED',injectImmediately:true,func:value=>{
     globalThis.ReserveFeatures.apply(value);
     globalThis.ReserveStartup?.setFeatures?.(value,true);
   },args:[prefs??null]});
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
 const apiJobs=new Map(),
   api=globalThis.CanvasHarnessAPI?.create({local:chrome.storage.local,permissions:chrome.permissions,provider:globalThis.CanvasHarnessAPIProvider});
 const overnight=globalThis.CanvasHarnessOvernight?.create();
 async function publishCatalog(panel,message){
   const data=message.kind==='catalog'?message.data:message.result;
   let apiSettings,overnightSettings;
   try{if(api)apiSettings=await api.get(data.scopeKey);}catch{}
   try{if(overnight)overnightSettings=await overnight.status(data.scopeKey);}catch{}
   const settings={...(apiSettings?{apiSettings}:{}),...(overnightSettings?{overnightSettings}:{})};
   if(panels.has(panel)&&sourceFor(panel)?.catalog?.scopeKey===data.scopeKey)
     post(panel,{...message,...(message.kind==='catalog'?{data:{...data,...settings}}:{result:{...data,...settings}})});
 }
 function stopAPI(panel,id){
   const jobs=apiJobs.get(panel);
   if(!jobs)return;
   for(const [key,task]of jobs)if(!id||key===id){task.abort();jobs.delete(key);}
   if(!jobs.size)apiJobs.delete(panel);
 }
 const fail=(port,id,error)=>post(port,{id,ok:false,error:String(error?.message||error||'The request could not finish.')});
 const validId=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id);
 const sourceFor=port=>channels.get(port.sender?.tab?.id);
 function canvasSender(sender){return sender.id===chrome.runtime.id&&sender.frameId===0&&Number.isInteger(sender.tab?.id)&&ReserveSite.supported(sender.url);}
 // The panel frame may be served from the extension's per-session address (use_dynamic_url), so compare the page, not the host.
 function panelSender(sender){
   try{
     const u=new URL(sender.url);
     return sender.id===chrome.runtime.id&&Number.isInteger(sender.tab?.id)&&u.protocol==='chrome-extension:'&&u.pathname==='/ai-panel.html'&&!u.search&&!u.hash;
   }catch{return false;}
 }
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
 async function pdf(base64,pages){
  if(typeof base64!=='string'||base64.length>Math.ceil(2*1024*1024/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('Choose a PDF no larger than 2 MiB.');
  if(!await chrome.offscreen.hasDocument()){
   offscreenPending??=chrome.offscreen.createDocument({url:'ai-offscreen.html',reasons:['WORKERS'],justification:'Read text from explicitly selected small PDFs locally.'}).finally(()=>{
     offscreenPending=null;
   });
   await offscreenPending;
  }
  if(pages!==undefined&&(typeof pages!=='string'||!/^\d{1,4}(?:-\d{1,4})?$/.test(pages)))throw Error('Choose a PDF page range.');
  const reply=await chrome.runtime.sendMessage({target:'ch-pdf',base64,...(pages?{pages}:{})});if(!reply?.ok)throw Error(reply?.error||'PDF text could not be extracted.');return reply.result;
 }
 function sourceRequest(panel,message,entry){
  if(!['catalog','load-course','collect','close','preference','overnight','agent','study-tool'].includes(message.action))throw Error('Unsupported Canvas context request.');
   if(message.action==='preference'&&
     (!['autoSend','bringAnswers','teacherFeedback','level'].some(key=>Object.hasOwn(message,key))||
       ['autoSend','bringAnswers','teacherFeedback'].some(key=>Object.hasOwn(message,key)&&typeof message[key]!=='boolean')))
     throw Error('Invalid AI preference.');
  if(message.action==='collect'&&(!Array.isArray(message.ids)||message.ids.length>30||message.ids.some(x=>typeof x!=='string'||x.length>1000)))throw Error('Choose at most 30 sources.');
  if(message.action==='study-tool'){
   if(typeof message.scopeKey!=='string'||message.scopeKey!==entry.catalog?.scopeKey)throw Error('The Canvas view changed. Review the current tools.');
   const tool=message.tool;
   if(!tool||
     typeof tool!=='object'||
     Array.isArray(tool)||
     typeof tool.id!=='string'||
     tool.id.length>200||
     tool.args!==undefined&&(!tool.args||typeof tool.args!=='object'||Array.isArray(tool.args))||
     tool.label!==undefined&&(typeof tool.label!=='string'||tool.label.length>1000)||
     JSON.stringify(tool).length>16000)
     throw Error('Invalid study tool.');
  }
  const id=crypto.randomUUID(),timer=setTimeout(()=>{
    const pending=requests.get(id);
    if(pending){requests.delete(id);fail(panel,message.id,'Context gathering took too long. Try fewer sources.');}
  },120000);
  requests.set(id,{panel,originalId:message.id,source:entry.port,timer});
   post(entry.port,{
     kind:'source-request',
     id,
     action:message.action,
     courseId:message.courseId,
     ids:message.ids,
     all:message.all===true,
     includeAssignmentPdfs:message.includeAssignmentPdfs===true,
     ...(message.action==='study-tool'?{scopeKey:message.scopeKey,tool:message.tool}:{}),
     ...(message.action==='agent'?
       {
         op:message.op,
         question:message.question,
         provider:message.provider,
         runId:message.runId,
         turnId:message.turnId,
         actionId:message.actionId,
         value:message.value,
         memoryId:message.memoryId,
         settings:message.settings
       }:
       {}),
     ...(typeof message.autoSend==='boolean'?{autoSend:message.autoSend}:{}),
     ...(typeof message.bringAnswers==='boolean'?{bringAnswers:message.bringAnswers}:{}),
     ...(typeof message.teacherFeedback==='boolean'?{teacherFeedback:message.teacherFeedback}:{}),
     ...(Object.hasOwn(message,'level')?{level:message.level}:{})
   });
 }
 function stopAnswers(panel,forget=false){answerReads.get(panel)?.controller.abort();answerReads.delete(panel);if(forget)CanvasHarnessWeb.forget?.(panel);}
 async function onPanel(panel,message){
  if(!validId(message?.id))return;
  if(message.action==='cancel'){
   if(!validId(message.requestId))return;
   catalogWaits.get(panel)?.delete(message.requestId);
   if(handoffs.get(panel)===message.requestId)handoffs.delete(panel);
   if(answerReads.get(panel)?.id===message.requestId)stopAnswers(panel);
   stopAPI(panel,message.requestId);
   for(const [id,pending] of requests)if(pending.panel===panel&&pending.originalId===message.requestId){clearTimeout(pending.timer);requests.delete(id);}
   post(panel,{id:message.id,ok:true,result:{cancelled:true}});return;
  }
  // Register before any await: a timeout can arrive while tab/account checks
  // are still pending, and it must not be overwritten when they resolve.
  if(message.action==='close'){handoffs.delete(panel);stopAnswers(panel,true);stopAPI(panel);}
  let apiTask=null;
  if(message.action==='api'){
    let jobs=apiJobs.get(panel);
    if(!jobs)apiJobs.set(panel,jobs=new Map());
    if(jobs.has(message.id))return;
    apiTask=new AbortController();
    jobs.set(message.id,apiTask);
  }
  if(message.action==='web'&&message.op==='inject'){stopAnswers(panel,true);handoffs.set(panel,message.id);}
  const readsAnswer=message.action==='web'&&['watch','read'].includes(message.op);
  if(readsAnswer&&answerReads.get(panel)?.id!==message.id){stopAnswers(panel);answerReads.set(panel,{id:message.id,controller:new AbortController()});}
  const answerRead=readsAnswer?answerReads.get(panel):null;
  try{
   await requireFeature('ai',panel.sender);
   if(!panels.has(panel))return;
   const source=sourceFor(panel);
   if(source&&!source.catalog){let waiting=catalogWaits.get(panel);if(!waiting)catalogWaits.set(panel,waiting=new Map());waiting.set(message.id,message);return;}
   const entry=await liveSource(panel);
   if(!panels.has(panel))return;
   if(sourceFor(panel)!==entry||!entry.catalog)return onPanel(panel,message);
   if(message.action==='overnight'){
    if(!overnight||message.scopeKey!==entry.catalog.scopeKey)throw Error('The Canvas view changed.');
    if(message.op==='prepare'){sourceRequest(panel,message,entry);return;}
    const result=message.op==='status'?
      await overnight.status(message.scopeKey):
      message.op==='configure'?
        await overnight.configure(message.scopeKey,{...(typeof message.enabled==='boolean'?{enabled:message.enabled}:{}),...(typeof message.after==='string'?{after:message.after}:{})}):
        message.op==='folder'?await chrome.tabs.create({url:chrome.runtime.getURL('overnight.html')+'#'+encodeURIComponent(message.scopeKey)}):null;
    if(!result)throw Error('Unsupported prep folder action.');post(panel,{id:message.id,ok:true,result:message.op==='folder'?{}:result});return;
   }
   if(message.action==='api'){
    if(!api||!['get','save','remove','models','estimate','generate'].includes(message.op))throw Error('Unsupported API action.');
    await verifyShare(panel,message,entry);
    const current=()=>!apiTask.signal.aborted&&panels.has(panel)&&sourceFor(panel)===entry&&message.scopeKey===entry.catalog?.scopeKey;
    if(!current())throw Error('Request stopped.');
    const options={signal:apiTask.signal,revision:message.revision},scope=entry.catalog.scopeKey;
    const result=message.op==='get'?
      await api.get(scope):
      message.op==='save'?
        await api.save(scope,message.settings||{},options):
        message.op==='remove'?
          await api.remove(scope,options):
          message.op==='models'?await api.models(scope,options):await api[message.op](scope,{text:message.text,photos:message.photos||[]},options);
    if(current())post(panel,{id:message.id,ok:true,result});return;
   }
   if(['catalog','load-course','collect','close','preference','agent','study-tool'].includes(message.action)){
     if(message.action==='close'){handoffs.delete(panel);stopAnswers(panel,true);}
     sourceRequest(panel,message,entry);
     return;
   }
   if(message.action==='web'){
    if(!['status','open','inject','watch','read'].includes(message.op))throw Error('Unsupported website action.');
    if(readsAnswer&&
      (!['practice','reading','lab','rubric','fixes','notes','help','ask','steps','outline','message','summary','flashcards'].includes(message.studyKind)||
        !validId(message.answerId)||
        message.scopeKey!==entry.catalog.scopeKey||
        answerReads.get(panel)!==answerRead||
        answerRead.controller.signal.aborted))
      throw Error('Answer request stopped.');
    if(message.op==='inject'&&(typeof message.text!=='string'||!message.text.trim()||message.text.length>2100000))throw Error('Choose some context to send, up to 2,100,000 characters.');
    if(message.op==='inject'){await verifyShare(panel,message,entry);if(handoffs.get(panel)!==message.id)throw Error('The AI panel closed or the request was replaced. Click Send again when ready.');}
    let result;
    try{
      result=await CanvasHarnessWeb.handle(
        {
          type:'ch-ai-web',
          action:message.op,
          provider:message.provider,
          text:message.text,
          autoSend:message.autoSend===true,
          bringAnswers:message.bringAnswers===true,
          studyKind:message.studyKind,
          ...(Array.isArray(message.helpKinds)?{helpKinds:message.helpKinds}:{}),
          scopeKey:message.scopeKey,
          answerId:message.op==='inject'?message.id:message.answerId
        },
        {...entry.port.sender,tab:entry.port.sender.tab},
        {owner:panel,signal:answerRead?.controller.signal,onProgress:data=>{
        if(answerReads.get(panel)===answerRead&&!answerRead?.controller.signal.aborted)post(panel,{id:message.id,kind:'progress',data});
      },
      canRead:()=>panels.has(panel)&&sourceFor(panel)===entry&&message.scopeKey===entry.catalog?.scopeKey,
      canShare:()=>handoffs.get(panel)===message.id&&panels.has(panel)&&sourceFor(panel)===entry&&message.scopeKey===entry.catalog?.scopeKey
      });
    }finally{if(handoffs.get(panel)===message.id)handoffs.delete(panel);if(readsAnswer&&answerReads.get(panel)===answerRead)answerReads.delete(panel);}
    post(panel,{id:message.id,ok:true,result});return;
   }
   if(message.action==='pdf'){post(panel,{id:message.id,ok:true,result:await pdf(message.base64)});return;}
   throw Error('Unsupported AI action.');
  }catch(error){
    if(handoffs.get(panel)===message.id)handoffs.delete(panel);
    if(readsAnswer&&answerReads.get(panel)===answerRead)stopAnswers(panel);
    if(!apiTask?.signal.aborted)fail(panel,message.id,message.action==='api'&&message.settings?.key?'API settings could not be saved.':error);
  }
  finally{if(apiTask){const jobs=apiJobs.get(panel);if(jobs?.get(message.id)===apiTask)jobs.delete(message.id);if(!jobs?.size)apiJobs.delete(panel);}}
 }
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
   const entry={port,catalog:null};channels.set(tabId,entry);
   const onSource=message=>{
    if(message?.kind==='catalog'&&message.data&&typeof message.data.scopeKey==='string'){
     const owner=message.data.scopeKey.split('|').slice(0,2).join('|'),prior=entry.catalog?.scopeKey.split('|').slice(0,2).join('|');
     // An account switch destroys conversations rather than attaching a new account's sources.
     if(prior&&owner!==prior){for(const panel of panels)if(panel.sender.tab.id===tabId)panel.disconnect();entry.catalog=null;return;}
     if(entry.catalog?.scopeKey!==message.data.scopeKey)for(const panel of panels)if(panel.sender.tab.id===tabId)stopAPI(panel);
     entry.catalog=message.data;
     for(const panel of panels)
       if(panel.sender.tab.id===tabId){
         void publishCatalog(panel,{kind:'catalog',data:message.data});
         const waiting=catalogWaits.get(panel);
         catalogWaits.delete(panel);
         if(waiting)for(const message of waiting.values())void onPanel(panel,message);
       }
    }else if(validId(message?.id)){
     const pending=requests.get(message.id);if(!pending||pending.source!==port)return;
     clearTimeout(pending.timer);requests.delete(message.id);
     if(message.ok&&message.result?.sources&&message.result?.scopeKey)entry.catalog=message.result;
     if(message.ok&&message.result?.sources&&message.result?.scopeKey)
       void publishCatalog(pending.panel,{...message,id:pending.originalId});
     else post(pending.panel,{...message,id:pending.originalId});
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
   const data=sourceFor(port)?.catalog;if(data)void publishCatalog(port,{kind:'catalog',data});
   port.onDisconnect.addListener(()=>{
    panels.delete(port);handoffs.delete(port);catalogWaits.delete(port);stopAnswers(port,true);stopAPI(port);
    for(const [id,p] of requests)if(p.panel===port){clearTimeout(p.timer);requests.delete(id);}
   });
  }else port.disconnect();
 }
 // School Canvas sites on their own address. The student adds one in the popup; the browser asks for
 // access to that one site; the same scripts that run on instructure.com are then registered there.
 // Taking access away in the browser's extension settings removes them again.
 const SITES='reserve:sites',PENDING='reserve:pendingSite',PREFIX='ch-site-';
 function schoolSender(sender){
   return sender?.id===chrome.runtime.id&&(sender.frameId===undefined||sender.frameId===0)&&['welcome.html','popup.html'].some(page=>sender.url===chrome.runtime.getURL(page));
 }
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

 const agentQuiz=value=>/\/quizzes\/[^/?#]+\/(?:take|resume)(?:[/?#]|$)|\/assessment_sessions\//i.test(value||'');
 const agentSettingsKey=settings=>JSON.stringify(Object.keys(settings||{}).sort().map(k=>[k,settings[k]])),agentAccountKey=scope=>'reserve:v1:'+scope.split('|').slice(0,2).join(':');
 function stopAgent(scope){const task=agentJobs.get(scope);if(task){task.controller.abort();CanvasHarnessWeb.forget?.(task);agentJobs.delete(scope);}}
 async function agentConsent(scope,expected){
   const key=agentAccountKey(scope),saved=(await chrome.storage.local.get(key))[key],settings=saved?.toolbox?.agent?.settings,settingsKey=agentSettingsKey(settings);
   if(settings?.on!==true||!['web','api','overnight'].includes(settings.way)||expected&&settingsKey!==expected){stopAgent(scope);throw Error('Agent settings changed. Start a new run.');}
   return {key,settings,settingsKey};
 }
 chrome.storage.onChanged?.addListener((changes,area)=>{
   if(area!=='local')return;
   for(const [scope,task]of agentJobs){
     const change=changes[agentAccountKey(scope)];
     if(change&&(change.newValue?.toolbox?.agent?.settings?.on!==true||agentSettingsKey(change.newValue?.toolbox?.agent?.settings)!==task.settingsKey))
       stopAgent(scope);
   }
 });
 async function agentRequest(message,sender){
  if(!canvasSender(sender)||typeof message.scopeKey!=='string')throw Error('Your AI needs a verified Canvas page outside a quiz.');
  const scope=message.scopeKey.split('|').slice(0,2).join('|');if(scope.split('|')[0]!==new URL(sender.url).origin||!/^\d+$/.test(scope.split('|')[1]))throw Error('Invalid Canvas account.');
  if(message.op==='stop'){const task=agentJobs.get(scope);if(task?.tabId===sender.tab.id&&(!message.runId||task.runId===message.runId))stopAgent(scope);return {};}
  if(message.op==='finish'){const task=agentJobs.get(scope);if(task?.runId===message.runId&&task.tabId===sender.tab.id)stopAgent(scope);return {};}
  if(agentQuiz(sender.url))throw Error('Your AI is unavailable on quiz-taking pages.');
  await requireFeature('ai',sender);await verifyAccount({port:{sender},catalog:{scopeKey:scope}});
  if(message.op==='connections'){
    const apiSettings=await api?.get(scope),overnightSettings=await overnight?.status(scope);
    return {apiSettings:{way:apiSettings?.way==='api'?'api':'web'},overnightSettings:{enabled:overnightSettings?.enabled===true}};
  }
  if(message.op==='local'){
   const [site,account]=scope.split('|'),studyKey='reserve:study:'+site+':'+account,pdfPrefix='reserve:pdf:'+site+':'+account+':';
   if(message.key!==studyKey&&!(typeof message.key==='string'&&message.key.startsWith(pdfPrefix)&&/^\d+$/.test(message.key.slice(pdfPrefix.length))))
     throw Error('This local tool belongs to another account.');
   if(typeof message.remove!=='boolean'||typeof message.hadExpected!=='boolean'||JSON.stringify(message.value??null).length>1100000||JSON.stringify(message.expected??null).length>1100000)
     throw Error('Invalid local tool update.');
   const write=async()=>{
     await verifyAccount({port:{sender},catalog:{scopeKey:scope}});
     const saved=(await chrome.storage.local.get(message.key))[message.key];
     if(message.runId){
       const task=agentJobs.get(scope);
       if(!task||task.runId!==message.runId||task.controller.signal.aborted)throw Error('Agent run stopped.');
       await agentConsent(scope,task.settingsKey);
       if(agentJobs.get(scope)!==task||task.controller.signal.aborted)throw Error('Agent run stopped.');
     }
     if(message.key===studyKey&&globalThis.CanvasHarnessStudyWrites){
       await CanvasHarnessStudyWrites.create({local:chrome.storage.local}).commit(message.key,message.expected,message.remove?undefined:message.value);
       return {saved:true};
     }
     if((saved!==undefined)!==message.hadExpected||JSON.stringify(saved)!==JSON.stringify(message.expected))throw Error('This tool changed. Try again.');
     if(message.remove)await chrome.storage.local.remove(message.key);else await chrome.storage.local.set({[message.key]:message.value});
     return {saved:true};
   };
   if(globalThis.navigator?.locks)return globalThis.navigator.locks.request(message.key,write);
   const prior=agentWrites.get(message.key)||Promise.resolve(),next=prior.catch(()=>{}).then(write);
   agentWrites.set(message.key,next);
   try{return await next;}finally{if(agentWrites.get(message.key)===next)agentWrites.delete(message.key);}
  }
  if(!validId(message.runId))throw Error('Invalid agent run.');
  if(message.op==='begin'){
   const existing=agentJobs.get(scope);if(existing)return {skipped:'running'};
   const consent=await agentConsent(scope),settings=consent.settings,way=settings.way,provider=settings.provider||'chatgpt';
   if(message.automatic===true&&settings.everyDay!==true)return {skipped:'not-chosen'};
   let revision;
   if(way==='web'){
     const site=CanvasHarnessProviders.get(provider);
     if(!site||!await chrome.permissions.contains({permissions:['scripting'],origins:Array.from(site.origins)}))throw Error('Enable access to your AI website.');
   }
   else if(way==='api'){const cfg=await api?.get(scope);if(!cfg?.hasKey||cfg.way!=='api')throw Error('Connect an API first.');revision=cfg.revision;}
   else{const cfg=await overnight?.status(scope);if(!cfg?.enabled||!cfg.folder)throw Error('Connect an Overnight folder first.');}
   if(agentJobs.has(scope))return {skipped:'running'};
   await agentConsent(scope,consent.settingsKey);
   if(agentJobs.has(scope))return {skipped:'running'};
   agentJobs.set(scope,{
     runId:message.runId,
     tabId:sender.tab.id,
     documentId:sender.documentId,
     controller:new AbortController(),
     way,
     provider,
     revision,
     settingsKey:consent.settingsKey,
     automatic:message.automatic===true
   });
   return {started:true};
  }
  if(message.op!=='turn')throw Error('Unknown agent operation.');
  const task=agentJobs.get(scope);
  if(!task||
    task.runId!==message.runId||
    task.tabId!==sender.tab.id||
    task.documentId&&sender.documentId!==task.documentId||
    task.controller.signal.aborted||
    task.busy)
    throw Error('Agent run stopped.');
  if(typeof message.text!=='string'||
    !message.text.trim()||
    message.text.length>140000||
    !Number.isInteger(message.turn)||
    message.turn<0||
    message.turn>16||
    !['agent','practice','reading','notes','lab','rubric','fixes','steps','outline','message','summary','flashcards'].includes(message.kind))
    throw Error('Invalid agent turn.');
  const current=()=>agentJobs.get(scope)===task&&!task.controller.signal.aborted;
  const consent=async()=>{
    if(!current())throw Error('Agent run stopped.');
    await agentConsent(scope,task.settingsKey);
    if(!current())throw Error('Agent run stopped.');
  },live=async()=>{
    if(!current())throw Error('Agent run stopped.');
    const tab=await chrome.tabs.get(task.tabId);
    if(!ReserveSite.supported(tab.url)||agentQuiz(tab.url)||new URL(tab.url).origin!==scope.split('|')[0])throw Error('Canvas page changed.');
    await verifyAccount({port:{sender},catalog:{scopeKey:scope}});
    await consent();
  };
  task.busy=true;
  try{
    await live();
    let result;
    if(task.way==='api')
      result=await api.generate(scope,{text:message.text,messages:message.messages},{revision:task.revision,signal:task.controller.signal,beforeSend:consent});
   else if(task.way==='overnight'){
     if(!overnight.agent)throw Error('Overnight agent transport is unavailable.');
     result=await overnight.agent(scope,{
       messages:message.messages,
       runId:task.runId,
       kind:message.kind,
       turn:message.turn,
       signal:task.controller.signal,
       canContinue:current,
       beforeSend:consent
     });
   }
   else{
     const answerId='agent-'+message.runId+'-'+message.turn,
       base={
         type:'ch-ai-web',
         provider:task.provider,
         scopeKey:scope,
         studyKind:message.kind,
         answerId,
         automatic:task.automatic,
         consent:{key:agentAccountKey(scope),settingsKey:task.settingsKey}
       };
     result=await CanvasHarnessWeb.handle(
       {...base,action:'inject',text:message.text,autoSend:true,bringAnswers:true,continue:message.continue===true},
       sender,
       {owner:task,signal:task.controller.signal,canShare:current,canRead:current,beforeSend:live});
     if(!['sent','send-uncertain'].includes(result?.status))throw Error(result?.message||'The AI website did not send the message.');
     await live();
     result=await CanvasHarnessWeb.handle({...base,action:'watch'},sender,{owner:task,signal:task.controller.signal,canShare:current,canRead:current,onProgress:data=>{
       if(current())for(const panel of panels)if(sourceFor(panel)?.catalog?.scopeKey.split('|').slice(0,2).join('|')===scope)post(panel,{kind:'agent-progress',data});
     }});
   }
   await live();return result;
  }finally{task.busy=false;}
 }
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message?.target==='ch-agent'){
    agentRequest(message,sender).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:String(error?.message||error)}));
    return true;
  }
  if(message?.target==='ch-overnight-updated'){
   (async()=>{
     if(!overnight||sender.id!==chrome.runtime.id||sender.url?.split('#')[0]!==chrome.runtime.getURL('overnight.html'))throw Error('Open prep folder settings.');
     const data=await overnight.status(message.scopeKey);
     for(const panel of panels)if(sourceFor(panel)?.catalog?.scopeKey.split('|').slice(0,2).join('|')===message.scopeKey.split('|').slice(0,2).join('|'))post(panel,{kind:'overnight',data});
     return {};
   })().then(result=>reply({ok:true,result}),error=>reply({ok:false,error:String(error.message||error)}));
   return true;
  }
  if(message?.target==='ch-overnight'){
   (async()=>{
     if(!overnight||!canvasSender(sender)||typeof message.scopeKey!=='string'||message.scopeKey.split('|')[0]!==new URL(sender.url).origin||!/^\d+$/.test(message.scopeKey.split('|')[1]))
       throw Error('Open a verified Canvas page.');
     await requireFeature('ai',sender);
     if(!['visit','write','folder','pdf'].includes(message.op))throw Error('Unsupported prep folder action.');
     if(message.op==='folder'){await chrome.tabs.create({url:chrome.runtime.getURL('overnight.html')+'#'+encodeURIComponent(message.scopeKey)});return {};}
     const settings=await overnight.status(message.scopeKey);
     if(!settings.enabled||!settings.folder)return {...settings,prepared:false,imported:false,allow:false,needPrepare:false};
     await verifyAccount({port:{sender},catalog:{scopeKey:message.scopeKey}});
     if(message.op==='pdf')return pdf(message.base64);
     const result=await overnight.visit(message.scopeKey,{
       force:message.force===true,
       canPrepare:message.canPrepare!==false,
       ...(message.op==='write'?{build:async()=>message.items}:{})
     });
     for(const panel of panels)
       if(sourceFor(panel)?.catalog?.scopeKey.split('|').slice(0,2).join('|')===message.scopeKey.split('|').slice(0,2).join('|'))post(panel,{kind:'overnight',data:result});
     return result;
   })().then(result=>reply({ok:true,result}),error=>reply({ok:false,error:String(error.message||error)}));
   return true;
  }
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
   resync().then(
     sites=>reply(sites.includes(origin)?{ok:true,origin}:{ok:false,error:'Allow access to your school’s Canvas site and try again.'}),
     error=>reply({ok:false,error:String(error?.message||error||'School registration failed. Try again.')}));
   return true;
  }
  if(message?.type!=='ch-ai-pdf')return;
  ready.then(()=>requireFeature('ai',sender)).then(async()=>{
   if(!canvasSender(sender)||agentQuiz(sender.url)||!channels.has(sender.tab.id)&&!message.agent){reply({ok:false,error:'An active Canvas context is required.'});return;}
   if(message.agent){
     if(typeof message.scopeKey!=='string'||message.scopeKey.split('|')[0]!==new URL(sender.url).origin||!/^\d+$/.test(message.scopeKey.split('|')[1]))throw Error('Invalid Canvas account.');
     await verifyAccount({port:{sender},catalog:{scopeKey:message.scopeKey}});
   }
   return pdf(message.base64,message.pages).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));
  }).catch(error=>reply({ok:false,error:error.message}));return true;
 });
 chrome.tabs?.onRemoved?.addListener(tab=>{
  for(const [scope,task]of agentJobs)if(task.tabId===tab)stopAgent(scope);
  featureCurrent.delete(tab);const prefix='reserve:features:tab:'+tab+':';
  for(const map of [featureTabs,featureLoads])for(const key of map.keys())if(key.startsWith(prefix))map.delete(key);
  void(async()=>{
    try{
      const saved=await chrome.storage.session?.get(null);
      if(saved)await chrome.storage.session.remove(Object.keys(saved).filter(key=>key.startsWith(prefix)));
    }catch{}
  })();
 });
 globalThis.CanvasHarnessPrepare?.serve({api,pdf,requireFeature,verifyAccount,canvasSender});
})();
