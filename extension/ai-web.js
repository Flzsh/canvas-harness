/* Canvas Harness — controlled provider tabs; explicit insertion only. GPL-3.0-only. */
(function (root) {
  'use strict';
  // A service worker can simply importScripts('ai-web.js'). Explicitly importing
  // ai-providers.js and ai-inject.js first also works. No provider content scripts
  // are installed, and no text is stored for future insertion or answer retrieval.
  if (typeof root.importScripts === 'function') {
    if (!root.CanvasHarnessProviders) root.importScripts('ai-providers.js');
    if (!root.CanvasHarnessInject) root.importScripts('ai-inject.js');
  } else if (typeof module === 'object' && module.exports) {
    if (!root.CanvasHarnessProviders) root.CanvasHarnessProviders = require('./ai-providers.js');
    if (!root.CanvasHarnessInject) root.CanvasHarnessInject = require('./ai-inject.js');
  }
  const locks = new Map();
  const answers = new Map(), watches = new Map(), conversations = new Map();
  const studyKinds=['agent','practice','reading','lab','rubric','fixes','notes','help','ask','steps','outline','message','summary','flashcards'];
  let sequence=0;
  const reply = (status, message) => ({status, message});
  const tabId = value => Number.isInteger(value) && value >= 0;
  const keyFor = (source, provider) => 'ch-ai-web:v1:' + source + ':' + provider.id;
  const originFor = provider => new URL(provider.url).origin;
  function strictOrigin(url, origin) {
    try { const u = new URL(url); return u.protocol === 'https:' && u.origin === origin && !u.username && !u.password; }
    catch (_) { return false; }
  }
  async function serial(key, operation) {
    const previous = locks.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    locks.set(key, next);
    try { return await next; }
    finally { if (locks.get(key) === next) locks.delete(key); }
  }
  async function permissionGranted(chrome, provider) {
    return Boolean(chrome.permissions && await chrome.permissions.contains({permissions: ['scripting'], origins: Array.from(provider.origins)}));
  }
  async function normalWindow(chrome, tab) {
    if (!tab || !tabId(tab.windowId) || !chrome.windows?.get) return false;
    try { return (await chrome.windows.get(tab.windowId)).type === 'normal'; }
    catch (_) { return false; }
  }
  async function createBrowserTab(chrome, source, url, staged = true, foreground = true) {
    // Service workers otherwise use the last active window, which can be a
    // standalone provider app. Read the live Canvas tab in case it was moved.
    const canvas = await chrome.tabs.get(source);
    const sourceWindow = await chrome.windows.get(canvas.windowId);
    const initialURL = staged ? 'about:blank' : url;
    let tab;
    if (sourceWindow.type === 'normal') {
      tab = await chrome.tabs.create({url: initialURL, active: foreground, windowId: canvas.windowId, openerTabId: source});
    } else {
      const window = await chrome.windows.create({url: initialURL, type: 'normal', focused: foreground, incognito: Boolean(canvas.incognito)});
      tab = window?.tabs?.[0];
    }
    if (!tabId(tab?.id) || !await normalWindow(chrome, tab) || Boolean(tab.incognito) !== Boolean(canvas.incognito)) {
      throw Object.assign(new Error('Expected a normal browser tab'), {code: 'browser-window'});
    }
    // Navigate an already-created browser tab rather than handing a website
    // link to an app launcher. No context is ever part of this URL.
    if (staged) tab = await chrome.tabs.update(tab.id, {url, active: foreground});
    return tab;
  }
  async function storedTarget(chrome, key, source, provider) {
    const saved = (await chrome.storage.session.get(key))[key];
    if (!saved || saved.sourceTab !== source || saved.provider !== provider.id || saved.origin !== originFor(provider) || !tabId(saved.tabId)) return null;
    let tab;
    try { tab = await chrome.tabs.get(saved.tabId); } catch (_) { return null; }
    if (tab.id !== saved.tabId || !strictOrigin(tab.url, saved.origin) || (tab.pendingUrl && tab.pendingUrl !== tab.url) || !await normalWindow(chrome, tab)) return null;
    return {saved, tab};
  }
  async function focus(chrome, tab) {
    await chrome.tabs.update(tab.id, {active: true});
    if (chrome.windows && tabId(tab.windowId)) await chrome.windows.update(tab.windowId, {focused: true});
  }
  async function open(chrome, key, source, provider, foreground = true) {
    const existing = await storedTarget(chrome, key, source, provider);
    if (existing) {
      if(foreground)await focus(chrome, existing.tab);
      return reply('opened', provider.label + ' is open. Sign in if needed, then return to Canvas to insert a draft.');
    }
    const tab = await createBrowserTab(chrome, source, provider.url, true, foreground);
    if (!tabId(tab.id)) return reply('error', 'The browser could not open the provider website.');
    await chrome.storage.session.set({[key]: {sourceTab: source, provider: provider.id, tabId: tab.id, origin: originFor(provider)}});
    return reply('opened', provider.label + ' opened. Sign in there if needed, then use Send in Canvas Harness.');
  }
  async function openPermissionPage(chrome, source, provider) {
    const key = 'ch-ai-web:permission:v1:' + provider.id;
    // Only provider ID appears in the URL or storage. This page does not receive
    // the source Canvas tab, context, draft, account, or an automatic continuation.
    const url = chrome.runtime.getURL('ai-permission.html') + '?provider=' + encodeURIComponent(provider.id);
    await serial(key, async () => {
      const saved = (await chrome.storage.session.get(key))[key];
      if (saved && tabId(saved.tabId)) {
        try {
          const tab = await chrome.tabs.get(saved.tabId);
          if (tab.url === url && (!tab.pendingUrl || tab.pendingUrl === url) && await normalWindow(chrome, tab)) { await focus(chrome, tab); return; }
        } catch (_) { /* A closed permission page is opened again on this click. */ }
      }
      const tab = await createBrowserTab(chrome, source, url, false);
      if (tabId(tab.id)) await chrome.storage.session.set({[key]: {tabId: tab.id}});
    });
  }
  function clearAnswer(owner) {watches.get(owner)?.();answers.delete(owner);}
  function forget(owner) {clearAnswer(owner);conversations.get(owner)?.dispose?.();conversations.delete(owner);}
  function pinConversation(chrome,owner,pin){
    const invalidate=()=>{pin.invalid=true;watches.get(owner)?.();};
    const removed=id=>{if(id===pin.tabId)invalidate();};
    const updated=(id,change,tab)=>{
      if(id!==pin.tabId)return;
      for(const url of [change?.url,change?.pendingUrl,tab?.url,tab?.pendingUrl])if(url&&url!==pin.url&&(!pin.newChat||!strictOrigin(url,pin.origin)))invalidate();
    };
    conversations.get(owner)?.dispose?.();pin.dispose=()=>{chrome.tabs.onRemoved?.removeListener?.(removed);chrome.tabs.onUpdated?.removeListener?.(updated);};
    conversations.set(owner,pin);chrome.tabs.onRemoved?.addListener(removed);chrome.tabs.onUpdated?.addListener(updated);
  }
  async function conversationTarget(chrome,pin){
    if(pin.invalid)return null;
    let tab;try{tab=await chrome.tabs.get(pin.tabId);}catch{return null;}
    if(tab.id!==pin.tabId||
      !strictOrigin(tab.url,pin.origin)||
      tab.pendingUrl&&tab.pendingUrl!==tab.url||
      !await normalWindow(chrome,tab)||
      pin.invalid||
      tab.url!==pin.url&&!pin.newChat)
      return null;
    return {saved:{origin:pin.origin},tab};
  }
  function readAnswer(chrome, provider, message, owner, signal, canRead, onProgress) {
    const target=answers.get(owner),watch=message.action==='watch';
    if(!target||target.id!==message.answerId||target.provider!==provider.id||target.kind!==message.studyKind||target.scopeKey!==message.scopeKey)
      return Promise.resolve(reply('error','No answer tab'));
    const pin=target.conversation;
    if(pin&&(conversations.get(owner)!==pin||pin.invalid||message.conversationToken!==undefined&&message.conversationToken!==pin.token))
      return Promise.resolve(reply('error','The agent conversation changed. Start a new run.'));
    watches.get(owner)?.();
    return new Promise(resolve=>{
      let ended=false,timer,deadline,idleDeadline,last='',index=-1,changed=0,progress='';
      target.lastChange??=target.started;
      const active=()=>!ended&&!signal?.aborted&&answers.get(owner)===target&&canRead()&&(!pin||!pin.invalid&&conversations.get(owner)===pin);
      const finish=result=>{
        if(ended)return;
        ended=true;
        root.clearTimeout(timer);
        root.clearTimeout(deadline);
        root.clearTimeout(idleDeadline);
        signal?.removeEventListener('abort',stop);
        chrome.tabs.onRemoved?.removeListener?.(removed);
        chrome.tabs.onUpdated?.removeListener?.(updated);
        if(watches.get(owner)===stop)watches.delete(owner);
        last='';
        resolve(result);
      };
      const stop=()=>finish(reply('stopped','Stopped'));
      const removed=id=>{if(id===target.tabId)stop();};
      const updated=(id,change,tab)=>{
        if(id===target.tabId&&[change?.url,change?.pendingUrl,tab?.url,tab?.pendingUrl].some(url=>url&&!strictOrigin(url,target.origin)))stop();
      };
      watches.set(owner,stop);signal?.addEventListener('abort',stop,{once:true});chrome.tabs.onRemoved?.addListener(removed);chrome.tabs.onUpdated?.addListener(updated);
      const expires=target.started+30*60*1000;
      const idle=()=>{
        root.clearTimeout(idleDeadline);
        if(watch)idleDeadline=root.setTimeout(()=>finish(reply('timeout','No new answer yet. Bring it in or paste the answer.')),Math.max(0,target.lastChange+180000-Date.now()));
      };
      const report=result=>{
        const elapsedMs=Math.max(0,Date.now()-target.started),
          message=result.status==='provider-error'?
            provider.label+' stopped: '+result.message.replace(/[.!?]+$/,'')+'. Retry it there; CH keeps watching.':
            'Waiting for '+provider.label+(elapsedMs>=60000?' \u00b7 '+Math.floor(elapsedMs/60000)+' min':'');
        const key=result.status+'|'+message;
        if(key!==progress){progress=key;try{onProgress?.({status:result.status,message,elapsedMs});}catch{}}
      };
      const check=async()=>{
        try {
          if(!active()){stop();return;}
          if(watch&&Date.now()>=expires){finish(reply('timeout','Timed out'));return;}
          if(!await permissionGranted(chrome,provider)){finish(reply('error','Website access unavailable'));return;}
          if(!active()){stop();return;}
          const tab=await chrome.tabs.get(target.tabId);
          if(!active()){stop();return;}
          if(!strictOrigin(tab.url,target.origin)||tab.pendingUrl&&(!strictOrigin(tab.pendingUrl,target.origin)||pin&&tab.pendingUrl!==tab.url)){
            if(pin)pin.invalid=true;
            stop();
            return;
          }
          const results=await chrome.scripting.executeScript({
            target:{tabId:target.tabId,frameIds:[0]},
            world:'ISOLATED',
            func:root.CanvasHarnessInject.readStudyBlock,
            args:[
              {
                id:provider.id,
                origin:target.origin,
                kind:target.kind,
                ...(target.helpKinds?{helpKinds:target.helpKinds}:{}),
                after:target.count,
                answerId:target.id,
                ...(pin?{conversationToken:pin.token}: {})
              }
            ]
          });
          if(!active()){stop();return;}
          const result=results?.length===1&&results[0].frameId===0&&results[0].result;
          if(!result||result.status==='stopped'){if(pin)pin.invalid=true;stop();return;}
          if(pin&&typeof result.conversationURL==='string'){pin.url=result.conversationURL;if(result.status==='answer'||pin.url!==pin.initialURL)pin.newChat=false;}
          const now=Date.now();
          target.seenTurn ||= result.foundTurn===true;
          const observation=JSON.stringify([result.revision,result.index,result.text,result.status==='provider-error'?result.message:null]);
          if(result.status==='generating'||observation!==target.observation){target.lastChange=now;target.observation=observation;}
          if(result.status==='generating'){root.clearTimeout(idleDeadline);target.unreadableSince=undefined;}else idle();
          if(!target.seenTurn&&result.foundTurn===false&&!['generating','answer'].includes(result.status)){
            target.unreadableSince??=now;
            if(now-target.unreadableSince>=60000){finish(reply('unreadable',"CH can't read this page. Copy the answer and paste it here."));return;}
          }
          if(result.status==='answer'&&typeof result.text==='string'&&Number.isInteger(result.index)){
            if(result.text!==last||result.index!==index){last=result.text;index=result.index;changed=now;}
            if(!watch||result.prose||result.malformed||now-changed>=2500){
              finish({status:'answer',text:result.text,...(result.prose?{prose:true}:{}),...(pin?{conversationToken:pin.token}:{})});
              return;
            }
          }else {last='';index=-1;changed=0;}
          if(!watch){
            finish({...result,message:result.status==='provider-error'?provider.label+' stopped: '+result.message+'. Retry it there; CH keeps watching.':'No finished answer yet. CH keeps watching; you can also paste the answer.'});
            return;
          }
          report(result);
          timer=root.setTimeout(check,500);
        }catch {finish(reply('error','Answer unavailable'));}
      };
      if(watch){deadline=root.setTimeout(()=>finish(reply('timeout','No new answer yet. Bring it in or paste the answer.')),Math.max(0,expires-Date.now()));idle();}
      void check();
    });
  }
  // Parent MUST validate the Canvas sender origin and current account before
  // calling this method, and authorize each manual send or configured agent run.
  // These additional checks reject malformed callers and provider/target spoofing.
  async function handle(message, sender, {canShare = () => true,canRead = () => true,beforeSend = async()=>{},owner,signal,onProgress} = {}) {
    const chrome = root.chrome;
    const provider = message && root.CanvasHarnessProviders && root.CanvasHarnessProviders.get(message.provider);
    if (!message || message.type !== 'ch-ai-web' || !['status', 'open', 'inject','watch','read'].includes(message.action) || !provider) {
      return reply('error', 'Unsupported provider website request.');
    }
    if (!chrome || !chrome.storage || !chrome.storage.session || !sender || !sender.tab || !tabId(sender.tab.id) ||
        (sender.frameId !== undefined && sender.frameId !== 0) || (sender.id && sender.id !== chrome.runtime.id)) {
      return reply('error', 'Open this tool from the main Canvas tab.');
    }
    if (message.text !== undefined && (typeof message.text !== 'string' || message.text.length > 2100000)) {
      return reply('error', 'Context must be plain text with at most 2100000 characters.');
    }
    if (message.action === 'inject' && (typeof message.text !== 'string' || !message.text.trim())) {
      return reply('error', 'Select some context before inserting a draft.');
    }
    if(message.continue!==undefined&&typeof message.continue!=='boolean'||message.automatic!==undefined&&typeof message.automatic!=='boolean')return reply('error','Invalid conversation continuation.');
    const continuing=message.continue===true,agentRun=message.studyKind==='agent'||continuing,foreground=message.automatic!==true;
    if(agentRun&&!studyKinds.includes(message.studyKind))return reply('error','Unsupported agent answer kind.');
    const source = sender.tab.id, key = keyFor(source, provider);
    owner=owner??key;
    try {
      if(['watch','read'].includes(message.action)){
        if(conversations.has(owner)&&conversations.get(owner).source!==source)return reply('error','The agent Canvas tab changed.');
        return await readAnswer(chrome,provider,message,owner,signal,canRead,onProgress);
      }
      if (message.action === 'open') return await serial(key, () => open(chrome, key, source, provider));
      if (message.action === 'status') {
        if (!await permissionGranted(chrome, provider)) return reply('needs-permission', 'Draft insertion needs optional access to ' + provider.label + '. Click Insert draft to open the permission page.');
        const target = await storedTarget(chrome, key, source, provider);
        return target ? reply('opened', provider.label + ' is ready for an explicit draft insertion.') : reply('error', 'Open ' + provider.label + ' from this Canvas tab first.');
      }
      return await serial(key, async () => {
        let pin=continuing?conversations.get(owner):null;
        if(continuing&&
          (!pin||
            pin.invalid||
            pin.source!==source||
            pin.scopeKey!==message.scopeKey||
            pin.provider!==provider.id||
            message.conversationToken!==undefined&&message.conversationToken!==pin.token))
          return reply('error','The original agent conversation is unavailable. Start a new run; a continuation never opens another chat.');
        if(continuing)clearAnswer(owner);else forget(owner);
        if (!await permissionGranted(chrome, provider)) {
          if(agentRun)return reply('needs-permission','Grant website access before starting or continuing an agent run.');
          await openPermissionPage(chrome, source, provider);
          return reply('needs-permission', 'Grant optional draft insertion access on the permission page, then return to Canvas and click Send again.');
        }
        if (!chrome.scripting || !root.CanvasHarnessInject) return reply('error', 'AI insertion code is unavailable. Reload the extension and refresh Canvas, or use Copy.');
        if (!canShare()||signal?.aborted) return reply('error', 'The Canvas selection changed. Review it and click Send again.');
        // Text exists only in this explicit request. Never put it in the URL,
        // session storage, a future content script, or a clipboard without a click.
        const saved = continuing?{tabId:pin.tabId}:(await chrome.storage.session.get(key))[key];
        if (!saved&&!continuing) {
          const opened = await open(chrome, key, source, provider, foreground);
          if (opened.status !== 'opened') return opened;
        }
        let last = reply('no-editor', 'The chat is not ready. Finish signing in, then return to Canvas Harness and click Send again.');
        const attempts = typeof root.setTimeout === 'function' ? 40 : 1;
        let focused=false,answerTarget=null;
        for (let attempt = 0; attempt < attempts; attempt++) {
          if (!canShare()||signal?.aborted||pin?.invalid) return reply('error', 'The Canvas selection or agent conversation changed. Nothing more was inserted.');
          const target = continuing?await conversationTarget(chrome,pin):await storedTarget(chrome, key, source, provider);
          if (!target) {
            if(continuing){pin.invalid=true;return reply('error','The original agent conversation closed or navigated. Start a new run.');}
            // Only wait for the fresh tab created by this click. An existing tab
            // changing origin or navigating must be explicitly reopened.
            if (saved) return reply('error', 'The provider is no longer in a ready browser tab. Click Open website / sign in to open a regular browser tab, then try Send again.');
          } else if (target.tab.status !== 'loading') {
            if(!focused&&foreground){await focus(chrome, target.tab);focused=true;}
            if (!canShare()||signal?.aborted) return reply('error', 'The Canvas selection changed. Click Send again.');
            if (!(continuing?await conversationTarget(chrome,pin):await storedTarget(chrome, key, source, provider)))
              return reply('error', 'The provider browser tab changed before insertion. Reopen the website and try Send again.');
            if((message.bringAnswers===true||agentRun)&&studyKinds.includes(message.studyKind)){
              if(!await permissionGranted(chrome,provider)||!canShare())return reply('error','Website access unavailable');
              if(!answerTarget){
                if(agentRun&&!pin){
                  const token=root.crypto?.randomUUID?.()||'ch-'+Date.now().toString(36)+'-'+(++sequence);
                  pin={
                    token,
                    source,
                    scopeKey:message.scopeKey,
                    provider:provider.id,
                    tabId:target.tab.id,
                    origin:target.saved.origin,
                    url:target.tab.url,
                    initialURL:target.tab.url,
                    newChat:new URL(target.tab.url).pathname===new URL(provider.url).pathname
                  };
                }
                const snapshot=await chrome.scripting.executeScript({
                  target:{tabId:target.tab.id,frameIds:[0]},
                  world:'ISOLATED',
                  func:root.CanvasHarnessInject.readStudyBlock,
                  args:[
                    {
                      id:provider.id,
                      origin:target.saved.origin,
                      expectedURL:target.tab.url,
                      kind:message.studyKind,
                      ...(message.helpKinds?{helpKinds:message.helpKinds}:{}),
                      countOnly:true,
                      ...(pin?{conversationToken:pin.token,bindConversation:!continuing}:{})
                    }
                  ]
                });
                const count=snapshot?.length===1&&snapshot[0].frameId===0&&snapshot[0].result?.count;
                if(!Number.isInteger(count)||count<0){if(pin)pin.invalid=true;return reply('error','Answer tab or agent conversation changed. Start a new run.');}
                if(pin&&typeof snapshot[0].result.conversationURL==='string'){pin.url=snapshot[0].result.conversationURL;if(pin.url!==pin.initialURL)pin.newChat=false;}
                answerTarget={
                  id:message.answerId,
                  provider:provider.id,
                  kind:message.studyKind,
                  ...(message.studyKind==='help'&&
                    Array.isArray(message.helpKinds)&&
                    message.helpKinds.length>=2&&
                    message.helpKinds.length<=12&&
                    new Set(message.helpKinds).size===message.helpKinds.length&&
                    message.helpKinds.every(kind=>studyKinds.includes(kind)&&!['agent','help'].includes(kind))?
                    {helpKinds:[...message.helpKinds]}:
                    {}),
                  scopeKey:message.scopeKey,
                  tabId:target.tab.id,
                  origin:target.saved.origin,
                  count,
                  seenTurn:snapshot[0].result.foundTurn===true,
                  started:Date.now(),
                  ...(pin?{conversation:pin}:{})
                };
              }
              if(!canShare()||signal?.aborted||pin?.invalid||!await permissionGranted(chrome,provider))return reply('error','Stopped');
            }
            await beforeSend();if(!canShare()||signal?.aborted||pin?.invalid)return reply('error','Stopped');
            const results = await chrome.scripting.executeScript({
              target: {tabId: target.tab.id, frameIds: [0]}, world: 'ISOLATED',
              func: root.CanvasHarnessInject.insertDraft,
              args: [
                message.text,
                {
                  id: provider.id,
                  origin: target.saved.origin,
                  expectedURL: target.tab.url,
                  autoSend:message.autoSend===true,
                  ...(pin?{conversationToken:pin.token}:{}),
                  ...(agentRun&&message.consent?{consent:message.consent}:{})
                }
              ]
            });
            const result = results && results.length === 1 && results[0].frameId === 0 && results[0].result;
            if (!result || !['injected', 'sent', 'send-uncertain', 'no-editor', 'error'].includes(result.status) || typeof result.message !== 'string')
              return reply('error', 'The provider page did not confirm insertion. Review the page before retrying.');
            last = reply(result.status, result.message);
            if (result.status !== 'no-editor' || !result.retryable) {
              if(answerTarget&&canShare()&&!signal?.aborted&&!pin?.invalid&&['injected','sent','send-uncertain'].includes(result.status)){
                if(pin){pinConversation(chrome,owner,pin);last.conversationToken=pin.token;}
                answers.set(owner,answerTarget);
                last.answerId=answerTarget.id;
              }
              return last;
            }
          }
          if (attempt + 1 < attempts) await new Promise(resolve => root.setTimeout(resolve, 500));
        }
        return last;
      });
    } catch (error) {
      // Browser errors may contain URLs or page details; do not expose or log them.
      if (error?.code === 'browser-window') return reply('error', 'The website opened outside a regular browser window. Nothing was pasted. Use Copy draft, or reopen Canvas in a browser tab and retry.');
      return reply('error', 'The browser could not complete this action. Check website access, reopen the provider, and try again explicitly.');
    }
  }
  const api = Object.freeze({handle,forget});
  root.CanvasHarnessWeb = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
