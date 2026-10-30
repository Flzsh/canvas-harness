/* Install the phase-one engine in the worker; legacy entries remain in background.js. */
(function(root){
 'use strict';
 function serve({api,pdf,requireFeature,verifyAccount,canvasSender}){
  const chrome=root.chrome;if(!root.indexedDB)return null;
  const journal=root.CanvasHarnessRunStore.create(),
    serial=(key,fn)=>root.ReserveAccountWrites.run(key,fn),
    keyFor=scope=>'reserve:v1:'+scope.replace('|',':'),
    copy=v=>structuredClone(v);
  const projection=r=>
    r?
      {
        id:r.id,
        state:r.state,
        revision:r.revision,
        progress:r.progress,
        needsYou:r.needsYou,
        entry:r.entry,
        phase:r.phase,
        step:r.phase==='deliver'&&Array.isArray(r.picks)?[r.pickIndex||0,r.picks.length]:null,
        turnId:r.turns?.[r.turnIndex]?.id
      }:
      null;
  // chrome.storage keeps JSON: a key holding undefined is not saved, and keys may come back in another order.
  const stored=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),
    sameValue=(a,b)=>
      a===b||
        !!a&&
          !!b&&
          typeof a==='object'&&
          typeof b==='object'&&
          Array.isArray(a)===Array.isArray(b)&&
          Object.keys(a).length===Object.keys(b).length&&
          Object.keys(a).every(k=>Object.hasOwn(b,k)&&sameValue(a[k],b[k]));
  async function checkLocal(run){
   if(!run||!/^https:\/\/[a-z0-9.-]+\|\d+$/i.test(run.scope)||!root.ReserveSite?.supported?.(run.scope.split('|')[0]))throw Error('A verified Canvas account is required.');
   const tab=await chrome.tabs.get(run.sourceTab).catch(()=>null);if(tab&&root.CanvasHarnessAgentActions.quiz(tab.url))throw Error('Prepare is unavailable while taking a quiz.');
   const saved=(await chrome.storage.local.get(keyFor(run.scope)))[keyFor(run.scope)],settings=saved?.toolbox?.agent?.settings;
   if(settings?.on!==true||run.consent&&root.CanvasHarnessAIEngine.settingsKey(settings)!==run.consent.settingsKey)throw Error('Prepare settings changed. Start a new run.');
   const policy=JSON.stringify([saved.settings?.showGrades===true,saved.toolbox?.aiTeacherFeedback===true]);
   if(run.sourcePolicy&&policy!==run.sourcePolicy)throw Error('Source privacy changed. Start a new run.');
   return {saved,settings,policy,tab};
  }
  async function authorize(run){
   const {saved,settings,policy,tab}=await checkLocal(run);if(tab)await requireFeature('ai',{id:chrome.runtime.id,frameId:0,tab:{id:tab.id},url:tab.url});
   // Sending and waiting only touch the AI chat; scanning and publishing check the Canvas account first.
   if(!['asking','awaiting-reply'].includes(run.state)){
     const fetcher=root.CanvasHarnessAICanvas.createFetch({chrome,run}),response=await fetcher(run.scope.split('|')[0]+'/api/v1/users/self/profile',{method:'GET'});
     if(!response.ok||String((await response.json()).id)!==run.scope.split('|')[1])throw Error('Your Canvas account changed.');
   }
   const studyKey=root.CanvasHarnessStudyUI.storageKey(run.scope),study=(await chrome.storage.local.get(studyKey))[studyKey]||{};
   let connectionRevision;
   if(settings.way==='api'){
     const cfg=await api.get(run.scope);
     if(!cfg.hasKey||cfg.way!=='api')throw Error('Connect an API first.');
     connectionRevision=cfg.revision;
     if(run.connectionRevision!==undefined&&connectionRevision!==run.connectionRevision)throw Error('API settings changed.');
   }
   return {
     settings,
     perKindWishes:study.$wishes||{},
     notes:Array.isArray(study.$notes)?study.$notes.slice(-40):[],
     connectionRevision,
     sourcePolicy:policy,
     daily:saved.toolbox.agent.daily,
     publishedRunIds:(saved.toolbox.agent.runs||[]).filter(r=>r.publishedAt).map(r=>r.id)
   };
  }
  async function runnerFor(run,{guard,signal}){
   const key=keyFor(run.scope),[origin,accountId]=run.scope.split('|'),adapter={read:async k=>(await chrome.storage.local.get(k))[k],write:async(k,v)=>{
     await guard();
     await chrome.storage.local.set({[k]:v});
   },compareWrite:async(k,value,before)=>serial(k,async()=>{
     await guard();
     const current=(await chrome.storage.local.get(k))[k];
     if(JSON.stringify(current)!==JSON.stringify(before))throw Object.assign(Error('Account changed.'),{code:'storage-conflict'});
     await guard();
     await chrome.storage.local.set({[k]:value});
   })};
   const account=root.ReserveStorage.createStore({origin,accountId,adapter});await account.load();
   const studyWriter=root.CanvasHarnessStudyWrites.create({local:chrome.storage.local,serial});
   const external={get:async k=>(await chrome.storage.local.get(k))[k],set:async(k,value,options={})=>{
    if(k===root.CanvasHarnessStudyUI.storageKey(run.scope))return studyWriter.commit(k,options.expected,value,{guard,current:()=>!signal.aborted});
    return serial(k,async()=>{
      await guard();
      await guard();
      const current=(await chrome.storage.local.get(k))[k];
      if(JSON.stringify(current)!==JSON.stringify(options.expected))throw Error('This saved tool changed.');
      if(signal.aborted)throw Error('Stopped');
      if(value===undefined)await chrome.storage.local.remove(k);else await chrome.storage.local.set({[k]:value});
    });
   }};
   const canvas=root.CanvasHarnessAICanvas.create({store:account,scope:run.scope,run,chrome,parsePDF:async(bytes,options={})=>{
     await guard();
     let binary='';
     for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
     const result=await pdf(root.btoa(binary),options.pages);
     await guard();
     return result;
   },modules:data=>root.CanvasHarnessAgentClient.modules(data)});
   const delivery=run.way==='api'?root.CanvasHarnessDeliveryAPI.create({api}):root.CanvasHarnessDeliveryWeb.create(),
     results=root.CanvasHarnessAIResults.create({store:account,external,url:()=>origin+'/',guard:()=>!signal.aborted});
   return root.CanvasHarnessAIRunner.create({canvas,account,results,adapter:delivery});
  }
  const engine=root.CanvasHarnessAIEngine.create({store:journal,authorize,checkLocal,runnerFor,alarm:chrome.alarms,notify:async run=>{
   // A broadcast that leaves the saved status as it is writes nothing: every account write makes each open Canvas tab
   // reload and clean the whole record (pages follow the run itself through 'ch-ai-run' below).
   const key=keyFor(run.scope);
   await serial(key,async()=>{
     const current=(await journal.get(run.id));
     if(current.revision!==run.revision)return;
     const saved=(await chrome.storage.local.get(key))[key];
     if(!saved?.toolbox)return;
     const status=projection(run);
     if(saved.toolbox.agent&&sameValue(saved.toolbox.agent.prepareStatus,stored(status)))return;
     const data=copy(saved);
     data.toolbox.agent.prepareStatus=status;
     await chrome.storage.local.set({[key]:data});
   });
   const tabs=await chrome.tabs.query({url:run.scope.split('|')[0]+'/*'});
   for(const tab of tabs)void chrome.tabs.sendMessage(tab.id,{target:'ch-ai-run',scope:run.scope,run:projection(run)}).catch(()=>{});
  }});
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
   if(message?.target==='ch-study-write'){
    (async()=>{
      const match=/^reserve:study:(https:\/\/[a-z0-9.-]+):(\d+)$/i.exec(message.key||''),tab=await chrome.tabs.get(sender.tab?.id).catch(()=>null);
      const folder=sender.url?.split('#')[0]===chrome.runtime.getURL('overnight.html');
      if(sender.id!==chrome.runtime.id||
        !match||
        !root.ReserveSite.supported(match[1])||
        !folder&&(!tab||!root.ReserveSite.supported(tab.url)||!canvasSender(sender)&&!(()=>{
          try{const u=new URL(sender.url);return u.protocol==='chrome-extension:'&&u.pathname==='/ai-panel.html'&&!u.search&&!u.hash;}catch{return false;}
        })()))
        throw Error('Invalid study owner.');
      if(tab&&root.CanvasHarnessAgentActions.quiz(tab.url))throw Error('Study storage is unavailable on quiz-taking pages.');
      if(!folder)await requireFeature('ai',{...sender,frameId:0,url:tab.url});
      const scope=match[1]+'|'+match[2],
        fetcher=root.CanvasHarnessAICanvas.createFetch({chrome,run:{scope,...(!folder?{sourceTab:tab.id}:{})}}),
        profile=await fetcher(match[1]+'/api/v1/users/self/profile',{method:'GET'});
      if(!profile.ok||String((await profile.json()).id)!==match[2])throw Error('Your Canvas account changed.');
      return root.CanvasHarnessStudyWrites.create({local:chrome.storage.local,serial}).commit(message.key,message.before,message.remove?undefined:message.value);
    })().then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));
    return true;
   }

   if(message?.target==='ch-ai-engine-permit'){
    (async()=>{
      const r=await journal.get(message.runId),turn=r?.turns[r.turnIndex],receipt=turn?.deliveryReceipt;
      if(sender.id!==chrome.runtime.id||
        sender.frameId!==0||
        sender.tab?.id!==receipt?.tabId||
        turn.id!==message.turnId||
        receipt.status!=='send-intent'||
        new URL(sender.url).origin!==receipt.origin)
        throw Error('Invalid Send authorization.');
      await engine.verifyEpoch(r.id,message.epoch);
      return {ok:true};
    })().then(reply,()=>reply({ok:false}));
    return true;
   }
   if(message?.target!=='ch-ai-engine')return;
   (async()=>{
    if(!canvasSender(sender)||message.scopeKey!==new URL(sender.url).origin+'|'+message.scopeKey?.split('|')[1]||!/^\d+$/.test(message.scopeKey?.split('|')[1]))throw Error('Open a verified Canvas page.');
    const scope=message.scopeKey,all=await journal.all(),watching=['get','subscribe'].includes(message.op);
    // The status line follows one-shot runs only; a finished or stuck one drops out after 12 hours.
    const current=r=>r.flow==='one-shot'&&(!root.CanvasHarnessRunStore.terminal(r)&&!['needs-you','blocked'].includes(r.state)||Date.now()-Number(r.updatedAt||0)<12*3600e3);
    let run=message.runId?
      all.find(r=>r.id===message.runId&&r.scope===scope):
      all.filter(r=>r.scope===scope&&(!watching||current(r))).sort((a,b)=>b.createdAt-a.createdAt)[0];
    if(!['start','importReply','resume'].includes(message.op)){
      const fetcher=root.CanvasHarnessAICanvas.createFetch({chrome,run:{scope,sourceTab:sender.tab.id}}),profile=await fetcher(scope.split('|')[0]+'/api/v1/users/self/profile',{method:'GET'});
      if(!profile.ok||String((await profile.json()).id)!==scope.split('|')[1])throw Error('Your Canvas account changed.');
    }
    // A card's Read on a Google Doc: the access page opens beside Canvas (GitHub installs; store installs paste).
    if(message.op==='docs-access'){await chrome.tabs.create({url:chrome.runtime.getURL('ai-permission.html?source=google-docs'),index:(sender.tab.index??0)+1});return {opened:true};}
    if(message.op==='ask'){
     const s=v=>typeof v==='string'?v:undefined,
       input={
         id:'run-ask-'+(root.crypto?.randomUUID?.()||Date.now().toString(36)),
         scope,
         sourceTab:sender.tab.id,
         triggerKey:'ask:'+String(message.requestId||'').slice(0,80),
         day:message.day,
         entry:'band',
         kind:'ask',
         question:s(message.question),
         itemId:s(message.itemId),
         courseId:s(message.courseId),
         itemTitle:s(message.itemTitle),
         itemText:s(message.itemText),
         card:s(message.card),
         ...(/^[\w:.-]{1,120}$/.test(String(message.cardKey||''))&&s(message.card)?{cardKey:message.cardKey}:{}),
         ...(['auto','test','reading','translate','examples'].includes(message.make)?{make:message.make}:{}),
         ...(message.more===true?{more:true}:{}),
         ...(Array.isArray(message.items)?
           {items:message.items.slice(0,3).map(it=>({itemId:s(it?.itemId),courseId:s(it?.courseId),itemTitle:s(it?.itemTitle)?.slice(0,300)}))}:
           {}),
         ...(typeof message.pasted==='string'&&message.pasted.trim()&&message.make==='auto'?{pasted:message.pasted.slice(0,30000),pastedTitle:s(message.pastedTitle)?.slice(0,160)||''}:{})
       };
     if(!/^[\w-]{6,80}$/.test(String(message.requestId||'')))throw Error('Invalid question.');
     return projection(await engine.start(input));
    }
    if(message.op==='start'){
     const input={id:message.requestId,scope,sourceTab:sender.tab.id,triggerKey:message.triggerKey,day:message.day,entry:message.entry==='manual'?'manual':'visit'};
     return projection(await engine.start(input));
    }
    if(['get','subscribe'].includes(message.op)){
      if(run&&!root.CanvasHarnessRunStore.terminal(run)&&run.sourceTab!==sender.tab.id){
        const old=await chrome.tabs.get(run.sourceTab).catch(()=>null);
        if(!old||!root.ReserveSite.supported(old.url))await journal.mutate(run.id,null,r=>{r.sourceTab=sender.tab.id;});
      }
      return projection(run);
    }
    if(!run)throw Error('Run not found.');
    if(message.op==='review'){
      if(run.state!=='needs-you')throw Error('This run is no longer waiting for a reply.');
      const turn=run.turns[run.turnIndex];
      if(!turn)throw Error('No reply turn is available.');
      return {runId:run.id,turnId:turn.id,kind:turn.expectedKind,text:turn.reply||'',scope:run.scope};
    }
    if(message.op==='cancel')return projection(await engine.cancel(run.id));
    if(message.op==='importReply')return projection(await engine.importReply(run.id,message.turnId,message.text));
   if(message.op==='retry')return projection(await engine.retry(run.id));
    if(message.op==='open'){
      if(run.needsYou?.action==='Refresh Canvas'){await chrome.tabs.reload(run.sourceTab);return projection(run);}
      const turn=run.turns[run.turnIndex],receipt=turn?.deliveryReceipt,open=receipt?.tabId?await chrome.tabs.get(receipt.tabId).catch(()=>null):null;
      let same=false;
      try{same=!!open?.url&&new URL(open.url).origin===receipt.origin;}catch{}
     // The chat may have moved to its real address since; bring the tab forward as it is.
     if(same){await chrome.tabs.update(open.id,{active:true});await chrome.windows.update(open.windowId,{focused:true}).catch(()=>{});}
     else if(receipt?.tabId)
       await chrome.tabs.update(receipt.tabId,{url:receipt.conversationURL,active:true});
     else await chrome.tabs.create({url:root.CanvasHarnessProviders.get(run.provider).url});
     return projection(run);
    }
    if(message.op==='resume'){
      await authorize(run);
      await journal.mutate(run.id,null,r=>{if(r.state==='needs-you'){r.state=r.needsYou.resumeState;r.needsYou=null;r.lease={epoch:r.lease.epoch+1,expiresAt:0};}});
      void engine.execute(run.id);
      return projection(await journal.get(run.id));
    }
    throw Error('Unknown engine operation.');
   })().then(result=>reply({ok:true,result}),error=>reply({ok:false,error:String(error.message||error)}));return true;
  });
  chrome.alarms?.onAlarm.addListener(alarm=>{if(alarm.name==='ch-ai-recovery')void engine.recover().catch(()=>{});});
  chrome.storage.onChanged?.addListener((changes,area)=>{
    if(area!=='local')return;
    void(async()=>{
      for(const r of await journal.all()){
        const c=changes[keyFor(r.scope)];
        if(c&&
          !root.CanvasHarnessRunStore.terminal(r)&&
          (root.CanvasHarnessAIEngine.settingsKey(c.newValue?.toolbox?.agent?.settings)!==r.consent.settingsKey||
            JSON.stringify([c.newValue?.settings?.showGrades===true,c.newValue?.toolbox?.aiTeacherFeedback===true])!==r.sourcePolicy))
          await engine.cancel(r.id);
      }
    })().catch(()=>{});
  });
  // New worker instance: persisted epochs invalidate any callbacks from its predecessor.
  void engine.recover({workerStart:true}).catch(()=>{});return engine;
 }
 root.CanvasHarnessPrepare={serve};if(typeof module==='object'&&module.exports)module.exports={serve};
})(globalThis);
