/*! Canvas Harness · isolated AI panel. Original creator: Flzsh. GPL-3.0-only. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CanvasHarnessAIPanel = api;
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', () => api.mount(root), {once: true});
    else api.mount(root);
  }
})(globalThis, function () {
  'use strict';
  const CONTEXT_LIMIT = 500000, PROMPT_LIMIT = 20000, PDF_LIMIT = 2 * 1024 * 1024;
  const STUDY_LEVEL = 'high school';
  const StudyKind = globalThis.CanvasHarnessStudyKind || (typeof module === 'object' && module.exports ? require('./study-kind.js') : null);
  const Study = globalThis.CanvasHarnessStudy || (typeof module === 'object' && module.exports ? require('./study-prompts.js') : null);
  const StudyUI = globalThis.CanvasHarnessStudyUI || (typeof module === 'object' && module.exports ? require('./study-ui.js') : null);
  const Band = globalThis.CanvasHarnessStudyBand || (typeof module === 'object' && module.exports && typeof require==='function' ? require('./study-band.js') : null);
  const Context = globalThis.CanvasHarnessContext || (typeof module === 'object' && module.exports ? require('./ai-context.js') : null);
  const Providers = globalThis.CanvasHarnessProviders || (typeof module === 'object' && module.exports && typeof require==='function' ? require('./ai-providers.js') : null);
  const PROVIDERS = Providers?.list.map(provider=>[provider.id,provider.label]) ||
    [['chatgpt','ChatGPT'],['claude','Claude'],['gemini','Gemini'],['grok','Grok'],['deepseek','DeepSeek'],['kimi','Kimi'],['qwen','Qwen'],['zai','Z.ai (GLM)']];
  const PROVIDER_ORIGINS = Object.freeze({
    chatgpt:['https://chatgpt.com/*'],
    claude:['https://claude.ai/*'],
    gemini:['https://gemini.google.com/*'],
    grok:['https://grok.com/*'],
    deepseek:['https://chat.deepseek.com/*'],
    kimi:['https://www.kimi.com/*'],
    qwen:['https://chat.qwen.ai/*'],
    zai:['https://chat.z.ai/*']
  });
  const API_PROVIDERS=[['anthropic','Anthropic'],['openai','OpenAI'],['google','Google'],['compatible','OpenAI-compatible']],API_ORIGINS={anthropic:'https://api.anthropic.com',openai:'https://api.openai.com',google:'https://generativelanguage.googleapis.com'};
  const API_SETTINGS_CHANGED='API settings changed. Review the message again.';
  const apiDefault=()=>({provider:'anthropic',baseUrl:'',model:'claude-opus-5-5',dailyLimit:20,last4:'',hasKey:false,revision:0});
  function apiOrigin(config){
    if(API_ORIGINS[config.provider])return API_ORIGINS[config.provider];
    let url;
    try{url=new URL(config.baseUrl);}catch{throw Error('Enter an HTTPS base address.');}
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Enter an HTTPS base address.');
    return url.origin;
  }
  const string = value => typeof value === 'string' ? value : '';
  const array = value => Array.isArray(value) ? value : [];
  const agentCatalog=catalog=>
    Boolean(catalog?.agent&&typeof catalog.agent==='object'&&!array(catalog.sources).some(source=>String(source?.id).startsWith('pdf-page:'))&&string(catalog.scopeKey).split('|')[2]!=='pdf-page');
  const agentSettings=catalog=>({on:true,way:'web',grades:false,everyDay:false,dailyCap:3,wishes:'',...catalog?.agent?.settings});
  const agentText=value=>
    value==null?'':typeof value==='string'?value:typeof value==='object'?string(value.status)||string(value.message)||string(value.text)||JSON.stringify(value):String(value);
  const errorText = error => string(error?.message) || string(error) || 'The request could not be completed.';
  const compose = (prompt, context, ctx) => {const text=[prompt.trim(),context].filter(Boolean).join('\n\n---\n\n');return text?text+'\n\nLevel: '+StudyKind.level(ctx.level):'';};
  const shouldSendKey = event => event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229 && !event.repeat;

  // Only the extension runtime port carries production prompts. The alternate
  // transport is restricted to the same-origin, direct parent on local previews.
  function createTransport(env, callbacks = {}) {
    const pending = new Map();
    let port = null, portListeners = null, closed = false, available = false, failure = '', reconnectTimer = null, reconnectDelay = 250;
    const production = Boolean(env.chrome?.runtime?.id);
    let preview = false;
    try { const url = new URL(env.location.origin); preview = !production && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname); } catch {}
    function settle(id, error, value) {
      const item = pending.get(id); if (!item) return;
      env.clearTimeout(item.timer); pending.delete(id);
      if (error) item.reject(error); else item.resolve(value);
    }
    function cancel(id) {
      if (!pending.has(id) || closed || !available) return;
      const request = {id: env.crypto.randomUUID(), action: 'cancel', requestId: id};
      try {
        if (production) port?.postMessage(request);
        else env.parent.postMessage({type: 'ch-ai-request', request}, env.location.origin);
      } catch {}
      // The request also becomes unusable when its runtime port closes.
    }
    function arm(id, item) {
      env.clearTimeout(item.timer);
      item.timer = env.setTimeout(() => { cancel(id); settle(id, new Error('The request timed out. Review your draft before trying again.')); }, item.timeout);
      item.timer?.unref?.();
    }
    function receive(message) {
      if (closed || !message || typeof message !== 'object') return;
      if(message.kind==='agent-progress'){callbacks.agentProgress?.(message.data);return;}
      if(message.kind==='overnight'){callbacks.overnight?.(message.data);return;}
      if (message.kind === 'catalog') { callbacks.catalog?.(message.data); return; }
      const item = pending.get(message.id); if (!item) return;
      if(message.kind==='progress'){item.onProgress?.(message.data);return;}
      if (message.kind === 'delta') { if (typeof message.text === 'string') { arm(message.id, item); item.onDelta?.(message.text); } return; }
      if (message.ok === true) settle(message.id, null, message.result);
      else if (message.ok === false) settle(message.id, new Error(string(message.error) || 'The background request failed.'));
    }
    function disconnected() {
      if (closed) return; available = false; port = null;
      const reason = 'Reconnecting to Canvas. Your question is preserved; interrupted messages will not be sent again.';
      for (const id of [...pending.keys()]) settle(id, new Error(reason));
      callbacks.disconnect?.(reason);
      scheduleReconnect();
    }
    function scheduleReconnect() {
      if (closed || reconnectTimer !== null) return;
      reconnectTimer = env.setTimeout(() => { reconnectTimer = null; connect(); }, reconnectDelay);
      reconnectTimer?.unref?.(); reconnectDelay = Math.min(5000, reconnectDelay * 2);
    }
    function connect() {
      if (closed || port) return;
      try {
        const next = env.chrome.runtime.connect({name: 'ch-ai-panel'});
        port = next; available = true; failure = '';
        const onMessage = message => { if (port === next && !closed) { reconnectDelay = 250; receive(message); } };
        const onDisconnect = () => { void env.chrome.runtime.lastError; if (port === next) disconnected(); };
        portListeners = {onMessage, onDisconnect};
        next.onMessage.addListener(onMessage); next.onDisconnect.addListener(onDisconnect);
        callbacks.connect?.();
      } catch (error) {
        available = false; failure = errorText(error); callbacks.disconnect?.('Connection unavailable. Your draft is preserved. Reconnecting…'); scheduleReconnect();
      }
    }
    const onWindowMessage = event => {
      if (event.source === env.parent && event.origin === env.location.origin && event.data?.type === 'ch-ai-reply') receive(event.data.reply);
    };
    try {
      if (production) {
        connect();
      } else if (preview) { env.addEventListener('message', onWindowMessage); available = true; }
      else failure = 'Open this panel from the Canvas Harness extension. Its connection is unavailable here.';
    } catch (error) { failure = errorText(error); }
    return {
      get available() { return available && !closed; }, preview,
      request(action, data = {}, options = {}) {
        const id = options.id || env.crypto.randomUUID();
        const promise = new Promise((resolve, reject) => {
          if (!available || closed) { reject(new Error(failure || 'The panel disconnected. Copy your draft before reloading Canvas Harness.')); return; }
          if (preview && ['native', 'web','api','agent'].includes(action)) { reject(new Error('Artificial preview cannot sign in, contact AI, or inject into a provider website.')); return; }
          if (pending.has(id)) { reject(new Error('Duplicate request identifier.')); return; }
          const timeout = options.timeout || (action==='api'?65000:action === 'web' && data.op === 'inject' ? 60000 : action === 'collect' || action === 'pdf' || action === 'load-course' ? 60000 : 15000);
          const item = {resolve, reject, onDelta: options.onDelta, onProgress:options.onProgress, timeout}; pending.set(id, item); arm(id, item);
          const request = {...data, id, action};
          try {
            if (production) port.postMessage(request);
            else env.parent.postMessage({type: 'ch-ai-request', request}, env.location.origin);
          } catch (error) { settle(id, error); }
        });
        promise.id = id; return promise;
      },
      abort(id, reason = new Error('Request stopped.')) { cancel(id); settle(id, reason); },
      dispose() {
        for (const id of [...pending.keys()]) settle(id, new Error('The panel closed.'));
        closed = true; available = false;
        if (reconnectTimer !== null) env.clearTimeout(reconnectTimer);
        if (production && port) {
          port.onMessage.removeListener?.(portListeners?.onMessage);
          port.onDisconnect.removeListener?.(portListeners?.onDisconnect);
          try { port.disconnect(); } catch {}
        }
        if (preview) env.removeEventListener('message', onWindowMessage);
      }
    };
  }

  function unwrap(value) {
    let result = value;
    for (let n = 0; n < 3; n++) {
      if (!result || typeof result !== 'object') break;
      if (result.ok === false || result.type === 'error' || result.kind === 'error' || result.error)
        throw new Error(errorText(result.error) === 'The request could not be completed.' ? string(result.message) || 'The request failed.' : errorText(result.error));
      if (result.result && typeof result.result === 'object') result = result.result;
      else if (result.data && typeof result.data === 'object' && !('connected' in result) && !('models' in result) && !('text' in result)) result = result.data;
      else break;
    }
    return result || {};
  }
  function createController({transport, permissions, clipboard, onChange = () => {}, onQuestionReady = () => {}, env = globalThis}) {
    const state = {
      catalog: null, selected: new Set(), knownSources: new Map(), all: false, includeAssignmentPdfs: true, courseFilter: '',
      pdfs: [], photos: [], draft: '', helpExcluded:new Set(),history: [], messages: [], context: null, reviewAccepted: null,
      provider: 'chatgpt', autoSend: false, bringAnswers: true, teacherFeedback: false, level: STUDY_LEVEL, answerId: '', waiting: false,
      demo: transport.preview, online: transport.available, busy: '', notice: '', error: '', webStatus: '',
      fallback: '', manualCopy: false, revision: 0, scopeVersion: 0
    };
    Object.assign(state,{
      mode:'ask',
      helpChoice:false,
      helpTyped:false,
      inference:null,
      helpPreferences:{},
      studyMessage:'',
      studyRequest:null,
      answer:'',
      studyErrors:[],
      saved:{},
      wishes:{},
      currentAid:null,
      currentAidKey:'',
      currentAidOptions:{}
    });
    Object.assign(state,{way:'web',api:apiDefault(),apiModels:[],apiTokens:null,apiAnswer:'',apiRetry:false,apiDirty:false});
    let agentRequestId='';
    function applyAgent(result){
      if(!result||typeof result!=='object'||!result.settings)fail('Your AI returned an invalid state.');
      state.catalog={...state.catalog,agent:result};
      if(['web','api','overnight'].includes(result.settings.way))state.way=result.settings.way;
    }
    async function agentRequest(op,data={}){
      return unwrap(await transport.request('agent',{op,...data},op==='run'?{timeout:30*60*1000+5000,onProgress:progress=>{
        if(alive()&&typeof progress?.message==='string'){state.notice=progress.message;changed();}
      }}:{}));
    }
    async function persistAgentWay(way,alive){
      if(!agentCatalog(state.catalog))return true;
      const scope=state.catalog.scopeKey,result=await agentRequest('settings',{settings:{way}});
      if(!alive()||scope!==state.catalog?.scopeKey)return false;
      applyAgent(result);
      return true;
    }
    function agentCommand(op,data={},label='Updating your AI'){
      return run(label,async alive=>{
        realOnly();
        if(!agentCatalog(state.catalog))fail('Your AI is unavailable.');
        const scope=state.catalog.scopeKey,result=await agentRequest(op,data);
        if(!alive()||scope!==state.catalog?.scopeKey)return false;
        applyAgent(result);
        return true;
      });
    }
    function runAgent(){
      return run('Running your AI',async alive=>{
        realOnly();
        promptValid();
        resetReply();
        const scope=state.catalog.scopeKey,task=transport.request('agent',{op:'run',question:state.draft,provider:state.provider},{timeout:30*60*1000+5000,onProgress:progress=>{
          if(alive()&&typeof progress?.message==='string'){state.notice=progress.message;changed();}
        }});
        agentRequestId=task.id;
        try{
          const result=unwrap(await task);
          if(!alive()||scope!==state.catalog?.scopeKey)return false;
          applyAgent(result);
          return true;
        }finally{if(agentRequestId===task.id)agentRequestId='';}
      });
    }
    async function stopAgent(){
      if(dead||!agentCatalog(state.catalog)||state.busy==='Stopping your AI')return false;
      const ticket=++operation,scope=state.catalog.scopeKey;
      state.busy='Stopping your AI';
      state.error='';
      changed();
      try{
        realOnly();
        const task=agentRequest('stop');
        if(agentRequestId)transport.abort(agentRequestId);
        agentRequestId='';
        const result=await task;
        if(dead||ticket!==operation||scope!==state.catalog?.scopeKey)return false;
        applyAgent(result);
        return true;
      }catch(error){if(!dead&&ticket===operation)state.error=errorText(error);return false;}finally{if(!dead&&ticket===operation){state.busy='';changed();}}
    }
    function setAgentSettings(patch){
      if(!patch||typeof patch!=='object')return Promise.resolve(false);
      if(Object.hasOwn(patch,'dailyCap')&&(!Number.isSafeInteger(patch.dailyCap)||patch.dailyCap<0)){state.error='Enter a whole daily cap of at least 0.';changed();return Promise.resolve(false);}
      return agentCommand('settings',{settings:patch},'Saving your AI settings');
    }
    Object.assign(state,{overnight:{enabled:false,after:'20:00',folder:'',schedule:'',needsAllow:false,errors:[]}});let overnightOwner='';
    const studyStore=StudyUI.createStore(env);
    async function overnightRequest(op,data={}){return unwrap(await transport.request('overnight',{op,scopeKey:state.catalog?.scopeKey,...data},op==='prepare'?{timeout:120000}:{}));}
    function applyOvernight(result){
      if(typeof result?.enabled!=='boolean')return;
      state.overnight={...state.overnight,...result};
      if(result.enabled&&!agentCatalog(state.catalog))state.way='overnight';
    }
    function loadOvernight(catalog){
      const owner=studyStore.key(catalog.scopeKey);
      if(owner!==overnightOwner){overnightOwner=owner;state.overnight={enabled:false,after:'20:00',folder:'',schedule:'',needsAllow:false,errors:[]};}
      applyOvernight(catalog.overnightSettings);
    }
    function prepareOvernight(){
      return run('Preparing overnight',async alive=>{
        realOnly();
        await flushWishes();
        const result=await overnightRequest('prepare');
        if(!alive())return false;
        applyOvernight(result);
        state.overnight.errors=array(result.errors);
        state.overnight.needsAllow=result.needsAllow===true;
        state.saved=await studyStore.list(state.catalog.scopeKey);
        if(!alive())return false;
        state.notice=result.prepared?'Prepared.':result.needsAllow?'Allow the prep folder':result.folder?'Prepared for today.':'Choose a prep folder.';
        return result.prepared===true;
      });
    }
    let apiOwner='',apiRequestId='',apiEstimate='',apiPermissionOrigin='';const apiPhotos=new Map();
    const structured=()=>state.mode!=='ask'||state.helpChoice||state.helpTyped||!!state.helpHandoff||state.catalog?.helpContext?.requested===true,
      requestKind=()=>state.helpChoice?'help':state.mode;
    const helpKinds=()=>state.helpHandoff?.mode==='choice'?state.helpHandoff.kinds:StudyKind.HELP_SHAPES;
    const contextLimit=()=>Math.max(1000,Math.min(Study.LIMITS.maxMaterial,Number(state.catalog?.helpContext?.maxChars||state.catalog?.contextBudget)||CONTEXT_LIMIT));
    const apiMessage=()=>structured()?state.studyMessage:compose(shareText(state.draft),state.context?.text||'',{level:state.level});
    const apiFingerprint=()=>JSON.stringify([state.catalog?.scopeKey,state.mode,state.api,apiMessage(),state.photos.map(photo=>[photo.id,apiPhotos.has(photo.id)])]);
    function stopAPI(){if(apiRequestId)transport.abort(apiRequestId);apiRequestId='';}
    function applyAPI(result){
      if(!API_PROVIDERS.some(([id])=>id===result?.provider))return;
      state.way=result.way==='api'?'api':'web';
      state.api={
        provider:result.provider,
        baseUrl:string(result.baseUrl),
        model:string(result.model),
        dailyLimit:Number.isSafeInteger(result.dailyLimit)?result.dailyLimit:20,
        last4:string(result.last4).slice(-4),
        hasKey:result.hasKey===true,
        revision:Number.isSafeInteger(result.revision)&&result.revision>=0?result.revision:0
      };
      state.apiDirty=false;
      state.apiTokens=null;
      apiEstimate='';
      if(state.way==='api')apiPermissionOrigin=apiOrigin(state.api);
    }
    async function apiRequest(op,data={}){
      const task=transport.request('api',{op,scopeKey:state.catalog?.scopeKey,...data});
      apiRequestId=task.id;
      try{return unwrap(await task);}finally{if(apiRequestId===task.id)apiRequestId='';}
    }
    function runAPI(label,action){
      return run(label,async alive=>{
        const scopeKey=state.catalog?.scopeKey,current=()=>alive()&&scopeKey===state.catalog?.scopeKey;
        try{
          return await action(current);
        }catch(error){
          if(errorText(error)===API_SETTINGS_CHANGED&&current()){
            state.apiTokens=null;
            apiEstimate='';
            state.apiModels=[];
            state.apiAnswer='';
            state.apiRetry=false;
            resetReply();
            state.currentAid=null;
            state.currentAidKey='';
            state.currentAidOptions={};
            changed();
            try{const result=await apiRequest('get',{scopeKey});if(current())applyAPI(result);}catch{}
          }
          throw error;
        }
      });
    }
    function loadAPI(catalog){
      const owner=studyStore.key(catalog.scopeKey);
      if(owner===apiOwner)return;
      apiOwner=owner;
      state.way='web';
      state.api=apiDefault();
      state.apiModels=[];
      applyAPI(catalog.apiSettings);
    }
    const providerPhotos=()=>state.photos.map(photo=>{const dataUrl=apiPhotos.get(photo.id);if(!dataUrl)fail('Attach a file for every photo before sending.');return {dataUrl};});
    async function refreshModels(alive){
      const rows=await apiRequest('models');
      if(!alive())return;
      state.apiModels=array(rows).map(row=>({id:string(row.id),label:string(row.label)||string(row.id)})).filter(row=>row.id);
      changed();
    }
    function saveAPI(key='',way=state.way){
      return run('Saving API settings',async alive=>{
        realOnly();
        if(way==='api'&&(state.way!=='api'||apiPermissionOrigin!==apiOrigin(state.api))){
          const origins=[apiOrigin(state.api)+'/*'];
          if(!permissions?.request||await permissions.request({origins})!==true)fail('API access was not granted.');
        }
        if(!alive())return false;
        stopReturn(true);
        const result=await apiRequest('save',{settings:way==='web'?{way}:{...state.api,way,...(key?{key}:{})}});
        key='';
        if(!alive())return false;
        applyAPI(result);
        resetReply();
        if(!await persistAgentWay(state.way,alive))return false;
        if(state.way==='api'&&state.api.hasKey)await refreshModels(alive);
        return true;
      });
    }
    function estimateAPI(){
      return runAPI('Counting tokens',async alive=>{
        realOnly();
        if(state.apiDirty)fail('Save API settings first.');
        promptValid();
        if(state.mode!=='ask')await wishesReady;
        const reviewed=state.context?.message,context=await collect();
        if(!alive()||needsReview(context,reviewed))return false;
        const fingerprint=apiFingerprint(),revision=state.api.revision,result=await apiRequest('estimate',{text:apiMessage(),photos:providerPhotos(),revision});
        if(!alive()||fingerprint!==apiFingerprint())return false;
        state.apiTokens=result.tokens;
        apiEstimate=fingerprint;
        return true;
      });
    }
    function sendAPI(){
      return runAPI('Preparing context',async alive=>{
        realOnly();
        if(state.apiDirty)fail('Save API settings first.');
        promptValid();
        resetReply();
        state.apiRetry=false;
        if(state.mode!=='ask')await wishesReady;
        const reviewed=state.context?.message,context=await collect();
        if(!alive()||needsReview(context,reviewed))return false;
        const text=apiMessage(),photos=providerPhotos(),fingerprint=apiFingerprint(),revision=state.api.revision;
        if(apiEstimate!==fingerprint){
          const estimate=await apiRequest('estimate',{text,photos,revision});
          if(!alive()||fingerprint!==apiFingerprint())return false;
          state.apiTokens=estimate.tokens;
          apiEstimate=fingerprint;
          changed();
        }
        state.busy='Waiting for the answer';
        state.apiAnswer='';
        changed();
        const request=structured()?
          {...metadata(),kind:requestKind(),allowed:state.helpChoice?[...helpKinds()]:null,scopeKey:context.scopeKey,provider:state.provider}:
          null;
        state.studyRequest=request;
        const result=await apiRequest('generate',{text,photos,studyKind:requestKind(),revision});
        if(!alive()||fingerprint!==apiFingerprint())return false;
        if(result.status!=='answer'){state.notice=string(result.message);state.apiRetry=result.status==='max_tokens';return false;}
        if(!structured()){state.apiAnswer=string(result.text);return true;}
        state.answer=string(result.text);
        return parseStudyAnswer(request,()=>alive()&&sameStudy(request),true);
      });
    }
    let wishesOwner='',wishesTimer=null,wishesReady=Promise.resolve(),wishesSaved=Promise.resolve(),wishesLoad=0;
    const pendingWishes=new Map(),editedWishes=new Set();
    let operation = 0,
      websiteCheck = 0,
      dead = false,
      preferenceLoaded = false,
      bringPreferenceLoaded=false,
      feedbackPreferenceLoaded=false,
      levelPreferenceLoaded=false,
      manualMode=false,
      selectionEdited=false,
      returnVersion=0,
      returnRequestId='',
      ponyQuestionId = '',
      bandQuestion = null,
      ponyStudyId='',
      savedOwner='',
      savedLoad=0,
      aidRequestId='',
      pendingAidKey='',
      pendingAidOptions={},
      previewRequested=false,
      previewQueued=false,
      pendingQuestion=null;
    const changed = area => { if (!dead) onChange(state, area); };
    function flushWishes(){
      if(wishesTimer!==null){env.clearTimeout(wishesTimer);wishesTimer=null;}
      if(!pendingWishes.size)return wishesSaved;
      const pending=[...pendingWishes];
      pendingWishes.clear();
      wishesSaved=Promise.all([wishesSaved,...pending.map(([kind,{scope,value}])=>studyStore.setWishes(scope,kind,value).catch(error=>{
        if(!dead&&studyStore.key(state.catalog?.scopeKey)===studyStore.key(scope)){state.error=errorText(error);changed();}
      }))]).then(()=>{});
      return wishesSaved;
    }
    function loadWishes(scope){
      const owner=studyStore.key(scope);
      if(owner===wishesOwner)return;
      const saving=flushWishes();
      wishesOwner=owner;
      state.wishes={};
      editedWishes.clear();
      const ticket=++wishesLoad;
      wishesReady=saving.then(()=>studyStore.getWishes(scope)).then(saved=>{
        if(dead||ticket!==wishesLoad)return;
        for(const [kind,value]of Object.entries(saved))if(!editedWishes.has(kind))state.wishes[kind]=value;
        studyMessage();
        changed();
      }).catch(error=>{
        if(!dead&&ticket===wishesLoad){state.error=errorText(error);changed();}
      });
    }
    const fail = message => { throw new Error(message); };
    const providerName = () => PROVIDERS.find(p => p[0] === state.provider)?.[1] || 'provider';
    const photoSources = () =>
      state.photos.map((photo,i)=>
        ({label:'Photo '+(i+1)+': '+photo.text,text:'The student attaches this photo in this chat. Read it as part of the material. If it is missing or cannot be read, say so '+(state.mode==='ask'?'at the start of the answer.':'in "gaps".')}));
    const photoText = () => photoSources().map(source=>source.label+'\n'+source.text).join('\n\n');
    const photoReminder = () => state.way==='web'&&state.photos.length?'Attach '+state.photos.map((_,i)=>'Photo '+(i+1)).join(', ')+' in '+providerName()+' before sending.':'';
    const withReminder = text => [text,photoReminder()].filter(Boolean).join(' ');
    const isFeedback = id => state.knownSources.get(id)?.kind==='feedback'||String(id).startsWith('feedback:');
    const feedbackSources = () => state.teacherFeedback?array(state.catalog?.sources).filter(source=>source.kind==='feedback'&&[...state.selected].some(id=>{
      const item=state.knownSources.get(id);
      return item?.kind==='assignment'&&String(item.assignmentId||item.id)===String(source.assignmentId)&&String(item.courseId)===String(source.courseId);
    })):[];
    function pruneFeedback() {
      const allowed=new Set(feedbackSources().map(source=>source.id));
      for(const id of state.selected)if(isFeedback(id)&&!allowed.has(id))state.selected.delete(id);
    }
    const shareText=value=>state.catalog?.showGrades===true?string(value):Context.withoutScores(string(value)); // Class policies survive this second pass too.
    function helpContext(){
      const catalog=state.catalog||{},
        items=selectedIds().filter(id=>!isFeedback(id)).map(id=>
          catalog.active?.id===id?{...state.knownSources.get(id),...catalog.active}:state.knownSources.get(id)).filter(Boolean),
        base=catalog.helpContext||{},
        active=items.find(item=>item.id===(base.active||catalog.active)?.id)||null,
        item=items.length===1?{...items[0],...((base.item||base.active)?.id===items[0].id?base.item||base.active:{})}:null;
      return {
        ...base,
        active,
        item,
        itemId:item?.assignmentId||null,
        nextAssessment:items.some(value=>value.id===base.nextAssessment?.id)?base.nextAssessment:undefined,
        selectedText:state.helpExcluded.has('selectedText')?undefined:base.selectedText,
        draft:state.helpExcluded.has('draft')?undefined:base.draft||state.pdfs.some(pdf=>/\b(?:draft|my essay|my writing|my work)\b/i.test(pdf.title.replace(/[_-]/g,' '))),
        items,
        typed:state.draft,
        photos:state.photos.map(photo=>({...photo,name:photo.text,description:photo.text})),
        preferences:state.helpPreferences,
        teacherFeedback:state.teacherFeedback,
        feedback:state.teacherFeedback&&(active&&base.feedback||items.some(v=>StudyKind.classify(v).feedback))||null
      };
    }
    function autoMode() {
      if(manualMode)return;
      const h=state.helpHandoff;
      if(h&&state.draft===h.wishes){
        state.helpChoice=h.mode==='choice';
        state.helpTyped=true;
        state.inference={shape:h.mode==='build'?h.kind:'ask',confidence:state.helpChoice?0.5:1,reason:'Biscuit selected this help for the reviewed material.'};
        state.mode=state.inference.shape;
        return;
      }
      const context=helpContext(),items=context.items,decision=StudyKind.inferHelp(context);
      if(items.length>1&&!context.active&&!StudyKind.requestedHelp(context)){
        const modes=items.map(item=>StudyKind.inferHelp({...context,item,items:[]}).shape);
        if(!modes.every(k=>k===modes[0]))Object.assign(decision,{shape:'ask',confidence:0.4,reason:'The selected materials could support different kinds of help.'});
      }
      state.inference=decision;
      const academic=!!state.catalog?.helpContext&&(state.catalog.helpContext.requested||items.length),
        agentDefault=agentCatalog(state.catalog)&&!academic&&!StudyKind.requestedHelp(context);
      state.helpTyped=agentCatalog(state.catalog)&&(!!StudyKind.requestedHelp(context)||!!academic&&decision.shape==='ask'&&decision.confidence>=StudyKind.HELP_THRESHOLD);
      const mode=agentDefault?'ask':decision.shape;
      state.helpChoice=agentDefault?false:decision.confidence<StudyKind.HELP_THRESHOLD;
      if(state.mode!==mode){state.mode=mode;state.currentAid=null;state.currentAidKey='';}
    }
    function notesAvailable(){
      if(state.catalog?.quizTaking===true)return false;
      if(state.helpHandoff?.mode==='build'&&state.helpHandoff.kind==='notes')return true;
      const items=selectedIds().filter(id=>!isFeedback(id)).map(id=>({...state.knownSources.get(id),...(state.catalog?.active?.id===id?state.catalog.active:{})}));
      return items.length>0&&(items.every(item=>StudyKind.classify(item).notes)||['reading','notes'].includes(state.catalog?.intent)&&items.every(item=>String(item.id).startsWith('pdf-page:')));
    }
    // a due date the AI and the student can both read: "Fri, Oct 23, 11:59 PM"
    function readableDue(value){
      if(!value||/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
      const zone=state.catalog?.helpContext?.timeZone;
      return (Context?.when?Context.when(value,zone):value)+(zone?' ('+zone+')':'');
    }

    function metadata() {
      const h=state.helpHandoff;
      if(h&&selectedIds().length)return {course:shareText(h.course),item:shareText(h.item),due:'',itemId:string(h.itemId),courseId:string(h.courseId)};
      // the first item the student picked names what this is for; the item open on the page only when nothing is picked
      const catalog=state.catalog,
        picked=array(catalog?.sources).find(s=>selectedIds().includes(s.id)&&s.kind!=='file'&&s.kind!=='pdf'),
        opened=selectedIds().includes(catalog?.active?.id)?catalog.active:null,
        active=picked&&picked.id===opened?.id?{...picked,...opened}:picked||opened,
        courseId=string(active?.courseId)||string(catalog?.courseId);
      return {
        course:shareText(string(active?.courseName)||string(catalog?.courses.find(c=>String(c.id)===courseId)?.name)),
        item:shareText(active?.title),
        due:readableDue(string(active?.due)||string(active?.dueAt)),
        itemId:string(active?.assignmentId)||string(active?.id),
        courseId:courseId==='all'?'':courseId
      };
    }
    function studyMessage(context=state.context) {
      const meta=metadata(),
        catalog=state.catalog,
        sources=context?.sources||[],
        next=catalog?.helpContext?.nextAssessment,
        toolContext=catalog?.helpContext?
          {
            courseId:meta.courseId,
            itemId:meta.itemId,
            sources:array(catalog.sources).filter(s=>selectedIds().includes(s.id)).map(s=>({id:s.id,courseId:s.courseId,title:shareText(s.title)})),
            aids:Object.entries(state.saved).filter(([,aid])=>aid.itemId===meta.itemId&&aid.courseId===meta.courseId).map(([key,aid])=>
              ({key,kind:aid.kind,courseId:aid.courseId}))
          }:
          undefined,
        ctx={
          showGrades:catalog?.showGrades===true,
          toolContext,
          level:state.level,
          course:meta.course,
          item:meta.item,
          due:meta.due,
          sources,
          wishes:shareText([!manualMode?state.draft:'',state.wishes[state.mode]||''].filter(Boolean).join('\n')),
          maxChars:contextLimit(),
          now:catalog?.helpContext?.now,
          timeZone:catalog?.helpContext?.timeZone,
          today:catalog?.helpContext?.now?readableDue(catalog.helpContext.now):undefined,
          soon:next&&selectedIds().includes(next.id)?shareText(next.title):undefined
        };
      state.studyMessage=state.helpChoice?Study.buildChoice(helpKinds(),ctx):structured()?Study.build(state.mode,ctx):'';
      return state.studyMessage;
    }
    function stopReturn(reset=false) {
      returnVersion++;
      const id=returnRequestId;
      returnRequestId='';
      if(state.waiting)state.notice='';
      state.waiting=false;
      if(reset)state.answerId='';
      if(id)transport.abort(id);
    }
    function resetReply() {stopReturn(true);state.studyRequest=null;state.answer='';state.studyErrors=[];}
    function invalidate(reset=true) {
      state.revision++;
      state.context = null;
      state.reviewAccepted = null;
      state.fallback = '';
      state.manualCopy = false;
      state.apiTokens=null;
      apiEstimate='';
      if(reset)resetReply();
      studyMessage();
      previewRequested=state.mode!=='ask'||!!state.catalog?.helpContext?.requested;
    }
    function queuePreview() {
      if(dead||state.prepareReply||state.catalog?.biscuitInvalid||!previewRequested||previewQueued||state.busy||!state.catalog||!state.online)return;
      previewQueued=true;Promise.resolve().then(async()=>{
        previewQueued=false;if(dead||state.prepareReply||state.catalog?.biscuitInvalid||state.busy||!previewRequested)return;previewRequested=false;
        const question=pendingQuestion,ready=await controller.preview();
        if(!question||pendingQuestion!==question||dead)return;
        pendingQuestion=null;
        if(question.scopeKey!==state.catalog?.scopeKey||question.text!==state.draft)return;
        // Automatic sending still uses inject's source, privacy and changed-message review gates.
        if(ready&&state.autoSend&&!state.catalog.quizTaking){if(await inject())return;}
        if(!dead&&question.scopeKey===state.catalog?.scopeKey)onQuestionReady();
      });
    }
    function awaitingAnswer(answerId='') {
      resetReply();
      if(structured()){
        state.studyRequest={...metadata(),kind:requestKind(),allowed:state.helpChoice?[...helpKinds()]:null,scopeKey:state.catalog.scopeKey,provider:state.provider};
        state.answerId=state.bringAnswers?string(answerId):'';
      }
    }
    function sameStudy(request) {
      if(request?.engineRunId)return !dead&&request===state.studyRequest&&request.scopeKey===state.catalog?.scopeKey;
      return !dead&&request&&request===state.studyRequest&&request.kind===requestKind()&&request.scopeKey===state.catalog?.scopeKey&&request.provider===state.provider;
    }
    async function parseStudyAnswer(request,alive,prose=false) {
      if(!alive())return false;
      const catalog=state.catalog,
        privacy={
          prose,
          showGrades:catalog?.showGrades===true,
          privacy:catalog?.privacy,
          toolContext:{
            courseId:request.courseId,
            courses:array(catalog?.courses),
            items:array(catalog?.sources).filter(s=>s.kind==='assignment').map(s=>({...s,id:s.assignmentId||s.id})),
            sources:array(catalog?.sources),
            studyAids:state.saved
          }
        },
        parsed=request.allowed?Study.parseChosen(state.answer,request.allowed,privacy):Study.parse(state.answer,request.kind,privacy);
      state.studyErrors=parsed.ok?[]:parsed.errors;
      if(!parsed.ok)return false;
      const cards=Array.isArray(parsed.data.cards)&&parsed.data.cards.some(card=>card?.kind)?parsed.data.cards:[parsed.data],
        savedAt=Date.now(),
        answerId=env.crypto?.randomUUID?.()||String(savedAt),
        selectedItem=[catalog?.active,...array(catalog?.sources)].find(item=>
          item&&(item.assignmentId||item.id)===request.itemId&&(!request.courseId||item.courseId===request.courseId));
      const aids=cards.map(data=>
        ({
          v:1,
          kind:data.kind,
          itemId:request.itemId,
          courseId:request.courseId,
          title:data.title,
          item:request.item,
          savedAt,
          dueAt:selectedItem?.dueAt||selectedItem?.due,
          data,
          progress:{},
          ...(parsed.plain?{plainAnswer:true}:{})
        })),
        aid=aids[0];
      let result;
      try{
        [result]=await studyStore.saveAnswer(request.scopeKey,aids,answerId);
      }catch(error){if(!alive())return false;state.currentAid=aid;state.currentAidKey=null;state.currentAidOptions={};state.notice='Not saved: '+errorText(error);return true;}
      if(!alive())return false;const saved=await studyStore.list(request.scopeKey);if(!alive())return false;
      state.saved=saved;state.currentAid=result.aid;state.currentAidKey=result.key;state.currentAidOptions={};state.notice='Saved.';return true;
    }
    async function acceptReturn(result,request,alive) {
      if(!alive())return false;
      if(result.status==='answer'){state.answer=string(result.text);return parseStudyAnswer(request,alive,result.prose===true);}
      const message=string(result.message)||(result.status==='timeout'?'No new answer yet. Bring it in or paste the answer.':result.status==='stopped'?'Stopped.':'The answer could not be read.');
      if(!['timeout','stopped','unreadable','waiting','generating','provider-error'].includes(result.status))fail(message);
      state.notice=message;
      return false;
    }
    async function watchAnswer() {
      const request=state.studyRequest,answerId=state.answerId;
      if(!sameStudy(request)||!state.bringAnswers||!answerId)return false;
      stopReturn();
      const version=returnVersion,alive=()=>sameStudy(request)&&state.bringAnswers&&version===returnVersion;
      state.waiting=true;
      state.notice='Waiting for '+providerName();
      changed();
      try{
        const task=transport.request('web',{op:'watch',provider:request.provider,studyKind:request.kind,scopeKey:request.scopeKey,answerId},{timeout:30*60*1000+5000,onProgress:progress=>{
          if(alive()&&typeof progress?.message==='string'){state.notice=progress.message;changed();}
        }});
        returnRequestId=task.id;
        const result=unwrap(await task);
        if(!alive())return false;
        returnRequestId='';
        state.waiting=false;
        state.notice='';
        return await acceptReturn(result,request,alive);
      }catch(error){if(alive()){state.notice='';state.error=errorText(error);}return false;}finally{if(alive()){returnRequestId='';state.waiting=false;changed();}}
    }
    function readAnswer() {
      if(state.busy||dead)return Promise.resolve(false);
      stopReturn();
      return run('Reading answer',async alive=>{
        const request=state.studyRequest;
        if(!sameStudy(request))fail('Send or copy the study message first.');
        if(request.engineRunId){
          await transport.request('agent',{op:'importReply',runId:request.engineRunId,turnId:request.engineTurnId,question:state.answer}).then(unwrap);
          if(!alive())return false;
          state.prepareReply=null;
          state.studyRequest=null;
          state.notice='Prepare resumed.';
          return true;
        }
        return parseStudyAnswer(request,()=>alive()&&sameStudy(request),true);
      });
    }
    function bringAnswer() {
      const request=state.studyRequest,answerId=state.answerId;
      if(state.busy||!sameStudy(request)||!state.bringAnswers||!answerId)return Promise.resolve(false);
      stopReturn();
      const version=returnVersion;
      return run('Bringing answer',async alive=>{
        const current=()=>alive()&&sameStudy(request)&&state.bringAnswers&&version===returnVersion;
        try{
          realOnly();
          const task=transport.request('web',{op:'read',provider:request.provider,studyKind:request.kind,scopeKey:request.scopeKey,answerId});
          returnRequestId=task.id;
          const result=unwrap(await task);
          if(!current())return false;
          if(['generating','waiting','provider-error'].includes(result.status)){void watchAnswer();return false;}
          return acceptReturn(result,request,current);
        }catch(error){if(!current())return false;throw error;}finally{if(version===returnVersion)returnRequestId='';}
      });
    }
    function openPendingAid() {
      if(!pendingAidKey||state.busy)return;
      const key=pendingAidKey,options=pendingAidOptions;
      pendingAidKey='';
      pendingAidOptions={};
      if(!controller.openAid(key,options)){state.error=state.error||'This saved study aid is no longer available.';changed();}
    }
    async function loadSaved(scope,request) {
      const owner=studyStore.key(scope);
      if(owner===savedOwner&&!request)return;
      if(owner!==savedOwner){savedOwner=owner;state.saved={};state.currentAid=null;state.currentAidKey='';}
      const ticket=++savedLoad;
      pendingAidKey='';
      try{
        const [saved,preferences]=await Promise.all([studyStore.list(scope),studyStore.getHelpPreferences(scope)]);
        if(!dead&&ticket===savedLoad){
          state.saved=saved;
          state.helpPreferences={...preferences,...state.helpPreferences};
          const previous=state.mode,choice=state.helpChoice;
          autoMode();
          if(previous!==state.mode||choice!==state.helpChoice){invalidate();queuePreview();}
          if(request&&scope===state.catalog?.scopeKey){pendingAidKey=request.key;pendingAidOptions=request.missed===true?{missed:true}:{};}
          openPendingAid();
          changed();
        }
      }catch(error){if(!dead&&ticket===savedLoad){state.error=errorText(error);changed();}}
    }
    function realOnly() {
      if (state.demo || transport.preview) fail('Artificial preview supports context review only. Sign-in and provider requests are unavailable.');
      if (!state.online) fail('The panel is disconnected. Copy your draft before reloading Canvas Harness.');
    }
    async function run(label, action) {
      if (state.busy || dead) return false;
      const ticket = ++operation; state.busy = label; state.error = ''; state.notice = ''; changed();
      try { return await action(() => !dead && ticket === operation, ticket); }
      catch (error) { if (!dead && ticket === operation) state.error = errorText(error); return false; }
      finally { if (!dead && ticket === operation) { state.busy = ''; openPendingAid();changed();queuePreview(); } }
    }
    function setCatalog(catalog) {
      if (!catalog || typeof catalog.scopeKey !== 'string' || !catalog.scopeKey) { state.error = 'Canvas returned an invalid source catalog. Reload Canvas Harness.'; changed(); return; }
      if (state.error === 'Open Canvas Harness on a signed-in Canvas page first.') state.error = '';
      const question=catalog.ponyQuestion,
        h=question?.handoff,
        newQuestion=question&&typeof question.id==='string'&&typeof question.text==='string'&&question.text.trim()&&question.id!==ponyQuestionId,
        newHandoff=!!h&&question.id!==ponyQuestionId,
        study=catalog.ponyStudy,
        studyChanged=study&&typeof study.id==='string'&&study.id!==ponyStudyId&&['practice','reading','lab','rubric','fixes','notes','steps','outline','message','summary','flashcards'].includes(study.kind);
      if(!h||catalog.biscuitInvalid)state.helpHandoff=null;
      const previous = state.catalog,
        switched = newHandoff||
          studyChanged ||
          previous?.scopeKey !== catalog.scopeKey ||
          previous?.active?.id !== catalog.active?.id ||
          previous?.courseId !== catalog.courseId ||
          Boolean(previous?.demo) !== Boolean(catalog.demo);
      const priorMode=state.mode;if(switched||JSON.stringify(previous?.selectedIds)!==JSON.stringify(catalog.selectedIds))selectionEdited=false;
      let requestedMode='';
      if(studyChanged){requestedMode=study.kind;ponyStudyId=study.id;}
      else if(['practice','reading','lab','rubric','fixes','notes','steps','outline','message','summary','flashcards'].includes(catalog.intent)&&(switched||previous?.intent!==catalog.intent))
        requestedMode=catalog.intent;
      else if(previous?.intent&&!catalog.intent)requestedMode='ask';
       if (newQuestion) {
         requestedMode=h||question.fromBand?'':'ask';
         state.draft=question.text.slice(0,question.fromBand?PROMPT_LIMIT:h?4096:240);
         ponyQuestionId=question.id;
         if(h&&!catalog.biscuitInvalid){
           const kinds=array(h.kinds),allowed=[...StudyKind.HELP_SHAPES,'notes'];
           if(!['ask','build','choice'].includes(h.mode)||
             h.mode==='build'&&!allowed.includes(h.kind)||
             h.mode==='choice'&&(kinds.length<2||new Set(kinds).size!==kinds.length||kinds.some(kind=>!allowed.includes(kind)))){
             catalog={...catalog,biscuitInvalid:true};
             state.helpHandoff=null;
           }
           else state.helpHandoff={...h,kinds:[...kinds],wishes:state.draft};
         }
       }
      const priorSelection = JSON.stringify([...state.selected].sort());
      const priorFeedback=switched?[]:[...state.selected].filter(isFeedback);
      if (!preferenceLoaded && typeof catalog.autoSend === 'boolean') { state.autoSend = catalog.autoSend; preferenceLoaded = true; }
      if(!bringPreferenceLoaded&&typeof catalog.bringAnswers==='boolean'){
        state.bringAnswers=catalog.bringAnswers;
        bringPreferenceLoaded=true;
        if(!state.bringAnswers)stopReturn(true);
      }
      if((!feedbackPreferenceLoaded||switched&&(catalog.helpContext?.feedbackRequested||previous?.helpContext?.feedbackRequested))&&typeof catalog.teacherFeedback==='boolean'){
        state.teacherFeedback=catalog.teacherFeedback;
        feedbackPreferenceLoaded=true;
      }
      if(!levelPreferenceLoaded&&Object.hasOwn(catalog,'level')){state.level=StudyKind.level(catalog.level);levelPreferenceLoaded=true;}
      if (!state.online && transport.available) { state.online = true; state.error = ''; state.notice = 'Reconnected. Your question is ready; click Send when you want to continue.'; }
      if (switched) {
        state.helpExcluded=new Set();
        if(studyStore.key(previous?.scopeKey)!==studyStore.key(catalog.scopeKey))state.helpPreferences={};
        stopAPI();apiPhotos.clear();state.apiAnswer='';state.apiRetry=false;
        operation++; state.scopeVersion++; state.busy = '';
        state.selected = new Set(array(catalog.selectedIds ?? (catalog.active?.id ? [catalog.active.id] : [])));
        state.knownSources = new Map(); state.all = false; state.history = []; state.messages = []; state.pdfs = [];state.photos=[];pendingAidKey='';
        state.currentAid=null;state.currentAidKey='';resetReply();
        state.courseFilter = string(catalog.active?.courseId) || (catalog.courseId !== 'all' ? string(catalog.courseId) : '');
        if (previous) state.notice = 'Canvas view changed. Selected material changed; your question is still here.';
      }
      if (!selectionEdited&&Array.isArray(catalog.selectedIds)) state.selected = new Set(catalog.selectedIds);
      state.catalog = {...catalog, sources: array(catalog.sources).filter(source => source && typeof source.id === 'string'), courses: array(catalog.courses)};
      loadWishes(catalog.scopeKey);
      for(const [id,source]of state.knownSources)if(source.kind==='feedback')state.knownSources.delete(id);
      for (const source of state.catalog.sources) state.knownSources.set(source.id, source);
      for(const id of state.selected)if(isFeedback(id)&&!catalog.helpContext?.feedbackRequested)state.selected.delete(id);
      for(const id of priorFeedback)state.selected.add(id);pruneFeedback();
      state.demo = transport.preview || catalog.demo === true;
      loadAPI(catalog);
      loadOvernight(catalog);
      if(agentCatalog(catalog)){
        state.way=agentSettings(catalog).way;
        const chosen=agentSettings(catalog).provider;
        if(!state.busy&&PROVIDERS.some(p=>p[0]===chosen))state.provider=chosen;
      }
      // Loading fresh assignment metadata republishes the catalog. It must not
      // cancel the very collection that loaded it; actual scope/selection changes do.
      const selectionChanged=priorSelection !== JSON.stringify([...state.selected].sort()),gradesChanged=previous?.showGrades!==catalog.showGrades;
      if(switched||selectionChanged)manualMode=false;
      if(requestedMode){state.mode=requestedMode;state.helpChoice=false;manualMode=true;}else autoMode();
      if(state.mode==='notes'&&!notesAvailable()){manualMode=false;autoMode();}
      if(!switched&&(selectionChanged||priorMode!==state.mode||gradesChanged)){operation++;state.busy='';if(gradesChanged)stopAPI();}
      if (switched || selectionChanged || priorMode!==state.mode || gradesChanged || !state.busy) invalidate(switched||selectionChanged||priorMode!==state.mode||gradesChanged);
      const recovery=catalog.prepareReply;
      if(recovery&&typeof recovery.runId==='string'&&typeof recovery.turnId==='string'&&recovery.scope===catalog.scopeKey.split('|').slice(0,2).join('|')){
        const fresh=state.prepareReply?.id!==recovery.id;
        state.prepareReply=recovery;
        if(fresh){stopReturn(true);previewRequested=false;pendingQuestion=null;bandQuestion=null;}
        if(state.studyRequest?.engineRunId!==recovery.runId||state.studyRequest?.engineTurnId!==recovery.turnId)
          state.studyRequest={kind:recovery.kind,scopeKey:catalog.scopeKey,engineRunId:recovery.runId,engineTurnId:recovery.turnId};
        if(fresh)state.answer=string(recovery.text);
        state.currentAid=null;
        state.currentAidKey='';
        state.answerId='';
        state.studyErrors=[];
      }
      else if(!state.busy&&state.prepareReply){state.prepareReply=null;if(state.studyRequest?.engineRunId)state.studyRequest=null;}
      // Help with this item is being made by the engine: show its progress, not an older saved answer.
      if(catalog.engineHelp&&catalog.engineHelp.status!==state.engineHelpStatus){
        state.engineHelpStatus=catalog.engineHelp.status;
        state.notice=catalog.engineHelp.status;
        state.currentAid=null;
        state.currentAidKey='';
      }
      else if(!catalog.engineHelp&&state.engineHelpStatus){state.engineHelpStatus='';}
      const request=catalog.openAid,requestId=request&&typeof request.id==='string'&&typeof request.key==='string'?catalog.scopeKey+'|'+request.id:'';
      const openRequest=requestId&&requestId!==aidRequestId?request:null;if(openRequest)aidRequestId=requestId;
      if(newQuestion&&question.fromBand)bandQuestion={id:question.id,text:state.draft};else if(bandQuestion&&question?.id!==bandQuestion.id)bandQuestion=null;
      if(bandQuestion&&catalog.helpContext?.requested){
        pendingQuestion={scopeKey:catalog.scopeKey,text:bandQuestion.text};
        bandQuestion=null;
      } // a band question can arrive before its assignment has loaded; send it once that catalog arrives
      void loadSaved(catalog.scopeKey,openRequest);changed();queuePreview();
    }
    function selectedIds() { return state.all && state.catalog?.active?.id ? [state.catalog.active.id] : [...state.selected]; }
    function promptValid() {
      if(!state.draft.trim()&&!selectedIds().length&&!state.pdfs.length&&!state.photos.length&&!state.catalog?.helpContext?.requested)fail('Choose some context or write a prompt to send.');
      if(state.draft.length>PROMPT_LIMIT)fail('Keep your prompt within 20,000 characters. Your draft has been preserved.');
    }
    async function collect() {
      previewRequested=false;
      if (!state.catalog) fail('Wait for the Canvas source list, then try again.');
      const revision = state.revision, scopeKey = state.catalog.scopeKey, ids = selectedIds();
      const raw = await transport.request('collect', {
        ids,
        ...(selectionEdited?{selectedIds:ids}:{}),
        all: state.all && Boolean(state.catalog.active),
        includeAssignmentPdfs: state.includeAssignmentPdfs,
        maxChars:contextLimit()
      });
      if (dead || revision !== state.revision || scopeKey !== state.catalog?.scopeKey || raw?.scopeKey !== scopeKey)
        fail('The Canvas view or selected context changed. Review the current scope and try again.');
      const included = array(raw.included).map(source => ({...Context.filterSource(source,{showGrades:state.catalog.showGrades===true})}));
      const sources=included.map(source=>{
        const found=array(raw.sources).find(s=>s?.id===source.id);
        return {
          label:shareText(string(found?.label)||string(source.title)),
          text:shareText(string(found?.text)||string(source.text)||(state.helpChoice&&included.length===1?string(raw.text):''))
        };
      });
      if(structured()&&included.some((source,i)=>!sources[i].text&&typeof source.text!=='string'&&!array(raw.sources).some(s=>s?.id===source.id&&typeof s.text==='string')))
        fail('The selected source text is unavailable. Refresh the sources and try again.');
      const allowedAttachment = source => {
        const parent = state.knownSources.get(source.attachmentOf);
        return state.includeAssignmentPdfs &&
          ids.includes(source.attachmentOf) &&
          parent?.kind === 'assignment' &&
          parent.courseId === source.courseId &&
          (source.kind === 'file' && source.mime === 'application/pdf'||state.catalog?.helpContext?.requested&&['page','file'].includes(source.kind));
      };
      const helpReview=state.catalog?.helpContext?.requested;
      if (helpReview&&included.some(source=>!state.knownSources.has(source.id)) ||
        !state.all && (included.some(source => !ids.includes(source.id) && (helpReview||!allowedAttachment(source))) || (!ids.length && string(raw.text).trim())))
        fail('Unexpected or unselected context was returned. Nothing was shared. Refresh the selected sources and try again.');
      const issues = array(raw.omitted).map(item => ({title: string(item?.title) || 'Source', reason: string(item?.reason) || 'Source unavailable'}));
      const addIssue = (title, reason) => { if (!issues.some(item => item.title === title && item.reason === reason)) issues.push({title, reason}); };
      for (const source of included) {
        if (source.truncated) addIssue(string(source.title) || 'Source', 'Text was truncated.');
        for (const warning of array(source.warnings)) addIssue(string(source.title) || 'Source', errorText(warning));
      }
      for (const id of ids) {
        const source = state.knownSources.get(id), title = string(source?.title) || 'Selected source';
        if (!included.some(item => item.id === id) && !issues.some(item => item.title === title)) addIssue(title, 'This selected source was not included.');
      }
      if(issues.length)sources.push({label:'Source limitations',text:issues.map(i=>i.title+': not available in full: '+i.reason).join('\n')});
      const photos=photoSources();sources.unshift(...photos);
      const help=state.catalog.helpContext;
      if(help){
        const moment=[
          help.page?'Page: '+(help.page.kind||help.page):'',
          help.now?'Now: '+(typeof help.now==='number'?new Date(help.now).toISOString():help.now):'',
          help.timeZone?'Time zone: '+help.timeZone:''
        ].filter(Boolean).join('\n');
        if(moment)sources.push({label:'Current task and dates',text:moment});
        for(const [key,label]of [['selectedText','Selected text'],['draft','Student draft']])
          if(!state.helpExcluded.has(key)&&typeof help[key]==='string'&&help[key].trim())sources.push({label,text:help[key]});
      }
      if(!manualMode&&structured()&&state.draft.trim())sources.unshift({label:'Student request',text:state.draft});
      let text = [shareText(photoText()),shareText(raw.text)].filter(Boolean).join('\n\n');
      const budget=contextLimit();
      if (text.length > budget) {
        text = text.slice(0, budget - 36) + '\n[Truncated at context size limit]';
        addIssue('Selected context', 'Text exceeded the '+budget.toLocaleString()+'-character limit and was truncated.');
      }
      for (const pdf of state.pdfs) {
        const prefix = (text ? '\n\n' : '') + '[Attached PDF: ' + shareText(pdf.title) + ']\n';
        const remaining = budget - text.length - prefix.length;
        if (remaining <= 40) { addIssue(pdf.title, 'Omitted because the '+budget.toLocaleString()+'-character context limit was reached.'); continue; }
        const filtered=shareText(pdf.text),cut = filtered.length > remaining;
        const body = cut ? filtered.slice(0, remaining - 36) + '\n[Truncated at context size limit]' : filtered;
        text += prefix + body; included.push({id: pdf.id, title: pdf.title, kind: 'pdf', truncated: cut || pdf.truncated});
        sources.push({label:pdf.title,text:body});
        if (cut || pdf.truncated) addIssue(pdf.title, 'PDF text was truncated.');
        for (const warning of pdf.warnings) addIssue(pdf.title, warning);
        if (pdf.totalPages > pdf.pages) addIssue(pdf.title, `${pdf.pages} of ${pdf.totalPages} pages were read.`);
      }
      state.photos.forEach((photo,i)=>included.push({id:photo.id,title:photos[i].label,kind:'photo'}));
      for(const source of sources){source.label=shareText(source.label);source.text=shareText(source.text);}
      if (ids.length && !text.trim() && !issues.length) addIssue('Selected context', 'No readable text was returned.');
      if(structured()){
       // Measure the shape actually being sent, including source wrappers and clock.
       // Never reserve schemas for kinds that are absent from this message.
       const whole=studyMessage({sources}),frame=studyMessage({sources:sources.map(s=>({...s,text:''}))}).length;
       if(whole.length>budget){
         let left=Math.max(0,budget-frame-160);
         for(const source of sources){
           if(source.text.length>left){
             source.text=source.text.slice(0,left);
             addIssue(source.label,'Text exceeds the '+budget.toLocaleString()+'-character message budget and was shortened or omitted.');
             included.forEach(s=>{if(s.title===source.label)s.truncated=true;});
           }
           left=Math.max(0,left-source.text.length);
         }
        const notice={label:'Source limitations',text:'Selected source text was shortened at the message budget; consult the named context issues before continuing.'};
        // Keep this explicit missing-source notice inside the measured allowance.
        sources.push(notice);
        // Escaping source delimiters can expand text. Fit the actual serialized
        // message too, keeping the longest prefix that fits, never a guessed reserve.
        for(let i=sources.length-2;i>=0&&studyMessage({sources}).length>budget;i--){
         const source=sources[i],original=source.text;if(!original)continue;
         source.text='';addIssue(source.label,'Text exceeds the '+budget.toLocaleString()+'-character message budget and was shortened or omitted.');
         if(studyMessage({sources}).length>budget)continue;
         let low=0,high=original.length;
         while(low<high){const mid=Math.ceil((low+high)/2);source.text=original.slice(0,mid);if(studyMessage({sources}).length<=budget)low=mid;else high=mid-1;}
         source.text=original.slice(0,low);
        }
       }
      }
      const context = {text, sources, included, issues, omitted: issues, characters: text.length, scopeKey};
      state.context = context;
      studyMessage(context);
      context.message=apiMessage();
      context.preparedDraft=state.draft;
      context.fingerprint = JSON.stringify([scopeKey, context.message, sources, included.map(s => [s.id, s.title, Boolean(s.truncated)]), issues]);
      if (state.reviewAccepted !== context.fingerprint) state.reviewAccepted = null;
      state.context = context;studyMessage(context); changed(); return context;
    }
    function needsReview(context,reviewed) {
      if(arguments.length>1&&(reviewed!==undefined||state.helpHandoff||state.catalog?.helpContext?.requested)&&reviewed!==context.message){
        state.notice='The message changed. Review the updated text, then click Send again.';
        changed();
        return true;
      }
      if (context.issues.length && state.reviewAccepted !== context.fingerprint) {
        state.notice = 'Some selected text is missing or shortened. Review the context issues, then explicitly continue or change your selection.'; changed(); return true;
      }
      return false;
    }
    async function inject() {
      if(state.prepareReply)return run('Reading Prepare reply',async()=>fail('Paste the answer below and choose Read it.'));
      if(state.catalog?.biscuitInvalid)return run('Reviewing context',async()=>fail('The Canvas view changed. Ask Biscuit again to choose the current material.'));
      if(state.mode==='ask'&&agentCatalog(state.catalog)&&!structured())return runAgent();
      if(state.way==='overnight')return prepareOvernight();
      if(state.way==='api')return sendAPI();
      return run('Preparing context', async alive => {
        realOnly(); promptValid();resetReply();
        // Request at the initiating click, before collection can consume the gesture.
        const origins = PROVIDER_ORIGINS[state.provider];
        if (!permissions?.request || await permissions.request({permissions: ['scripting'], origins}) !== true) fail('Website access was not granted. Your question stays here; you can copy it instead.');
        if (!alive()) return false;
        if(state.mode!=='ask')await wishesReady;if(!alive())return false;
        const provider = state.provider, reviewed=state.context?.message, context = await collect();
        if (!alive() || needsReview(context,reviewed)) return false;
        const text = context.message; if (!text.trim()) fail('Choose some context or write a prompt to send.');
        state.fallback = text; state.busy = 'Opening AI and inserting your draft…'; changed();
        state.notice=photoReminder();
        const result = unwrap(await transport.request('web', {
          op: 'inject',
          provider,
          text,
          autoSend:state.autoSend&&!state.photos.length,
          scopeKey:context.scopeKey,
          studyKind:structured()?requestKind():undefined,
          ...(state.helpChoice?{helpKinds:[...helpKinds()]}:{}),
          bringAnswers:state.bringAnswers
        }));
        if (!alive()) return false;
        state.webStatus = string(result.message);
        if (!['injected','sent','send-uncertain'].includes(result.status)) fail(string(result.message) || 'The website draft was not available. Copy the prepared text and open the website below.');
        state.fallback = '';
        awaitingAnswer(result.answerId);
        state.notice = withReminder(string(result.message) || 'Inserted into ' + providerName() + '. Review its draft there.');
        if(state.answerId)void watchAnswer();
        return true;
      });
    }
    async function openWebsite() {
      return run('Opening website', async alive => {
        realOnly(); const result = unwrap(await transport.request('web', {op: 'open', provider: state.provider})); if (!alive()) return false;
        state.webStatus = string(result.message);
        if (result.status !== 'opened') fail(string(result.message) || 'The provider website could not be opened.');
        state.notice = string(result.message) || providerName() + ' opened. Nothing was sent.'; return true;
      });
    }
    async function checkWebsite() {
      if (state.demo || !state.online) return;
      const provider = state.provider, check = ++websiteCheck;
      try {
        const result = unwrap(await transport.request('web', {op: 'status', provider}));
        if (!dead && provider === state.provider && check === websiteCheck) { state.webStatus = string(result.message); changed(); }
      } catch (error) { if (!dead && provider === state.provider && check === websiteCheck) { state.webStatus = errorText(error); changed(); } }
    }
    async function copy() {
      return run('Preparing copy', async alive => {
        promptValid();resetReply();if(state.mode!=='ask')await wishesReady;if(!alive())return false;
        if(state.mode!=='ask'&&!state.catalog)fail('Load the Canvas sources before copying a study message.');
        let text = state.mode==='ask'?state.fallback:'';
        if (!text) {
          if(state.mode!=='ask'&&!state.context&&!state.online)fail('Reconnect to Canvas to review the selected study material.');
          const context = (structured()&&state.context?.preparedDraft!==state.draft?null:state.context) ||
            (state.online && state.catalog ?
              await collect() :
              {text:shareText(photoText()),sources:photoSources().map(source=>Context.filterSource(source,{showGrades:state.catalog?.showGrades===true})),issues:[]});
          if (!alive() || needsReview(context)) return false; text = structured()?studyMessage(context):compose(shareText(state.draft), context.text,{level:state.level});
        }
        if (!text.trim()) fail('There is no draft or selected context to copy.');
        if(state.context)state.context.message=text;
        state.fallback = text;
        state.notice=photoReminder();
        try {
          if (!clipboard?.writeText) throw new Error('Clipboard API unavailable');
          await clipboard.writeText(text); if (alive()) {awaitingAnswer();state.notice = withReminder('Copied. Paste into the provider’s draft and review before sending.');} return true;
        } catch { if (alive()) { state.manualCopy = true;awaitingAnswer(); fail('Clipboard access was unavailable. Select and copy the prepared text below.'); } return false; }
      });
    }
    async function attach(file) {
      if (!file) return false;
      return run('Reading PDF', async alive => {
        if (!state.catalog) fail('Load your Canvas view before attaching a PDF.');
        if (!Number.isFinite(file.size) || file.size <= 0 || file.size > PDF_LIMIT) fail('Choose a non-empty PDF no larger than 2 MiB.');
        if (!/\.pdf$/i.test(file.name || '') && file.type !== 'application/pdf') fail('Choose a PDF file.');
        const scope = state.catalog.scopeKey, bytes = new Uint8Array(await file.arrayBuffer());
        if (!alive() || scope !== state.catalog?.scopeKey) return false;
        if (bytes.length > PDF_LIMIT) fail('Choose a PDF no larger than 2 MiB.');
        if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') fail('This file does not have a PDF header.');
        let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const result = unwrap(await transport.request('pdf', {base64: env.btoa(binary)}));
        if (!alive() || scope !== state.catalog?.scopeKey) return false;
        const text = string(result.text), warnings = array(result.warnings).map(errorText);
        if (!text.trim()) fail('No readable text was found in this PDF.' + (warnings.length ? ' ' + warnings.join(' ') : ' It may contain scanned images.'));
        state.pdfs.push({id: 'pdf:' + env.crypto.randomUUID(), title: string(file.name) || 'Attached PDF', text: text.slice(0, CONTEXT_LIMIT),
          courseId: string(state.catalog.active?.courseId) || string(state.catalog.courseId), pages: Number(result.pages) || 0, totalPages: Number(result.totalPages) || 0,
          truncated: result.truncated === true || text.length > CONTEXT_LIMIT, warnings});
        autoMode();invalidate(); state.notice = 'PDF read locally. Preview its text and any warnings before sharing.'; return true;
      });
    }
    const controller = {
      dismissAgent:(runId,actionId)=>agentCommand('dismiss',{runId,actionId}),
      agentProgress:data=>{
        if(!dead&&typeof data?.message==='string'){state.notice=data.message;changed();}
      },setOvernightStatus:result=>{
        applyOvernight(result);
        if(agentCatalog(state.catalog))state.way=agentSettings(state.catalog).way;
        if(result.imported&&state.catalog){
          const scope=state.catalog.scopeKey;
          void studyStore.list(scope).then(saved=>{if(!dead&&scope===state.catalog?.scopeKey){state.saved=saved;changed();}}).catch(error=>{
            if(!dead){state.error=errorText(error);changed();}
          });
        }
        changed();
      },
      state,
      setCatalog,
      inject,
      openWebsite,
      copy,
      attach,
      readAnswer,
      bringAnswer,
      feedbackSources,
      notesAvailable,
      stopAgent,
      setAgentSettings,
      undoAgent:(runId,actionId)=>agentCommand('undo',{runId,...(actionId===undefined?{}:{actionId})}),
      answerAgent:(runId,actionId,value)=>agentCommand('answer',{runId,actionId,value}),
      forgetAgent:memoryId=>agentCommand('forget',{memoryId}),
      async setWay(way){
        if(state.busy||!['web','api','overnight'].includes(way))return false;
        if(way==='overnight')
          return run('Saving overnight settings',async alive=>{
            realOnly();
            const result=await overnightRequest('configure',{enabled:true});
            if(!alive())return false;
            applyOvernight(result);
            state.way='overnight';
            resetReply();
            return persistAgentWay(way,alive);
          });
        if(!await saveAPI('',way))return false;
        if(state.overnight.enabled)
          return run('Saving overnight settings',async alive=>{const result=await overnightRequest('configure',{enabled:false});if(!alive())return false;applyOvernight(result);return true;});
        return true;
      },
      prepareOvernight,chooseOvernightFolder:()=>run('Opening prep folder settings',async()=>{realOnly();await overnightRequest('folder');return true;}),
      copyOvernightTask:()=>run('Copying task',async()=>{await clipboard.writeText(state.overnight.schedule);return true;}),
      refreshOvernight:async()=>{
        if(!state.catalog)return;
        const scope=state.catalog.scopeKey,result=await overnightRequest('status');
        if(!dead&&scope===state.catalog?.scopeKey){applyOvernight(result);changed();}
      },
      saveAPI,estimateAPI,
      setAPIField(name,value){
        if(state.busy||!['provider','baseUrl','model','dailyLimit'].includes(name))return;
        if(name==='provider'){
          if(!API_PROVIDERS.some(([id])=>id===value))return;
          state.api={...apiDefault(),dailyLimit:state.api.dailyLimit,provider:value,model:value==='anthropic'?'claude-opus-5-5':''};
          state.apiModels=[];
        }
        else state.api[name]=name==='dailyLimit'?Number(value):string(value);
        if(name==='baseUrl'){state.api.last4='';state.api.hasKey=false;state.apiModels=[];}
        state.apiDirty=true;
        state.apiTokens=null;
        apiEstimate='';
        resetReply();
        changed();
      },
      loadAPIModels:()=>run('Loading models',async alive=>{await refreshModels(alive);return true;}),
      removeAPIKey:()=>run('Removing key',async alive=>{stopAPI();const result=await apiRequest('remove');if(!alive())return false;applyAPI(result);state.apiModels=[];return true;}),
      stopAPI(){stopAPI();operation++;state.busy='';state.notice='Stopped.';changed();},
      async copyAPIAnswer(){try{await clipboard.writeText(state.apiAnswer);state.notice='Copied.';changed();return true;}catch{state.error='Clipboard access was unavailable.';changed();return false;}},
      async attachPhoto(file){
        if(state.busy||!state.catalog||state.photos.length>=6||!file)return false;
        return run('Reading photo',async alive=>{
          if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size<=0||file.size>8*1024*1024)fail('Choose a supported photo up to 8 MiB.');
          const bytes=new Uint8Array(await file.arrayBuffer());
          if(!alive())return false;
          if(bytes.length>8*1024*1024)fail('Choose a photo up to 8 MiB.');
          let binary='';
          for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));
          const id='photo:'+env.crypto.randomUUID();
          apiPhotos.set(id,'data:'+file.type+';base64,'+env.btoa(binary));
          state.photos.push({id,text:string(file.name).slice(0,80)||'Photo'});
          autoMode();
          invalidate();
          return true;
        });
      },
      setWishes(value){
        if(dead||state.busy||state.mode==='ask'||!studyStore.key(state.catalog?.scopeKey))return false;
        const kind=state.mode,text=string(value).slice(0,600);
        state.wishes[kind]=text;
        editedWishes.add(kind);
        pendingWishes.set(kind,{scope:state.catalog.scopeKey,value:text});
        if(wishesTimer!==null)env.clearTimeout(wishesTimer);
        wishesTimer=env.setTimeout(()=>{wishesTimer=null;void flushWishes();},250);
        wishesTimer?.unref?.();
        resetReply();
        state.fallback='';
        state.manualCopy=false;
        studyMessage();
        changed();
        return true;
      },
      addPhoto(text) {
        if(state.busy||!state.catalog||state.photos.length>=6)return false;
        const description=string(text).replace(/\s+/g,' ').trim().slice(0,80);
        if(!description)return false;
        state.photos.push({id:'photo:'+env.crypto.randomUUID(),text:description});
        autoMode();
        invalidate();
        changed();
        queuePreview();
        return true;
      },
      removePhoto(id) {
        if(state.busy)return;
        apiPhotos.delete(id);
        state.photos=state.photos.filter(photo=>photo.id!==id);
        autoMode();
        invalidate();
        changed();
        queuePreview();
      },
      setMode(mode) {
        if(state.busy||!['ask','practice','reading','lab','rubric','fixes','notes','steps','outline','message','summary','flashcards'].includes(mode)||mode==='notes'&&!notesAvailable())return false;
        void flushWishes();
        manualMode=true;
        state.helpHandoff=null;
        state.helpChoice=false;
        state.helpTyped=false;
        if(state.mode===mode)return true;
        state.mode=mode;
        state.currentAid=null;
        state.currentAidKey='';
        invalidate();
        changed();
        return mode==='ask'?true:controller.preview();
      },
      setAnswer(text) {stopReturn();state.answer=string(text);changed();},
      excludeHelpPart(key){if(state.busy||!['selectedText','draft'].includes(key))return;state.helpExcluded.add(key);autoMode();invalidate();changed();queuePreview();},
      stopAnswer() {stopReturn();state.notice='Stopped.';changed();},
      openAid(key,options) {
        if(state.busy||!Object.hasOwn(state.saved,key))return false;
        const aid=state.saved[key];
        if(!Object.hasOwn(StudyUI.LABELS,aid.kind))return false;
        const parsed=Study.parse(JSON.stringify(aid.data),aid.kind,{storedPlainAnswer:aid.plainAnswer===true});
        if(!parsed.ok){state.error=parsed.errors.join('\n');changed();return false;}
        stopReturn();
        state.currentAid={...aid,data:parsed.data};
        state.currentAidKey=key;
        state.currentAidOptions=options?.missed===true?{missed:true}:{};
        changed();
        return true;
      },
      closeAid() {state.currentAid=null;state.currentAidKey='';changed();},
      async saveBandProgress(key,progress){
        const aid=state.saved[key],scope=state.catalog?.scopeKey;
        if(!aid)return;
        if(state.currentAidKey===key)return controller.saveProgress(progress);
        aid.progress=progress;
        try{
          const saved=await studyStore.progress(scope,key,progress);
          if(saved&&scope===state.catalog?.scopeKey)state.saved[key]=saved;
        }catch(error){if(scope===state.catalog?.scopeKey){state.error=errorText(error);changed();}}
      },
      runStudyTool:tool=>transport.request('study-tool',{scopeKey:state.catalog?.scopeKey,tool}).then(unwrap),
      removeAid:key=>run('Removing aid',async alive=>{
        const scope=state.catalog?.scopeKey;
        await studyStore.remove(scope,key);
        if(!alive())return false;
        delete state.saved[key];
        if(state.currentAidKey===key){state.currentAid=null;state.currentAidKey='';}
        return true;
      }),
      async saveProgress(progress) {
        const aid=state.currentAid,key=state.currentAidKey,scope=state.catalog?.scopeKey;
        if(!aid)return;
        aid.progress=progress;
        if(!key)return;
        if(state.saved[key])state.saved[key].progress=progress;
        try{
          const saved=await studyStore.progress(scope,key,progress);
          if(saved&&!dead&&scope===state.catalog?.scopeKey){
            for(const entry of [aid,state.saved[key]])if(entry){if(saved.review)entry.review=saved.review;else delete entry.review;}
          }
        }catch(error){if(!dead&&scope===state.catalog?.scopeKey){state.error=errorText(error);changed();}}
      },
      initialize: async () => { await run('Loading sources', async alive => { const catalog = await transport.request('catalog'); if (alive()) setCatalog(catalog); }); },
      preview: () => run('Reading selected context', async () => { await collect(); state.notice = 'Preview ready. Nothing has been sent to a provider.'; return true; }),
      setSelection(id, checked) {
        if (state.busy) return;
        if (!state.knownSources.has(id) && !state.selected.has(id)) return;
        selectionEdited=true;
        state.helpHandoff=null;
        if(state.all&&!isFeedback(id))state.all=false;
        const before=JSON.stringify(selectedIds().sort());
        if(isFeedback(id)){if(checked&&!feedbackSources().some(source=>source.id===id))return;state.all=false;}
        if (checked) state.selected.add(id); else state.selected.delete(id);
        pruneFeedback();
        if(before!==JSON.stringify(selectedIds().sort()))manualMode=false;
        autoMode();
        invalidate();
        changed();
        queuePreview();
      },
      setAll(checked) {
        if (state.busy) return;
        const before=JSON.stringify(selectedIds().sort());
        state.helpHandoff=null;
        state.all = checked === true && Boolean(state.catalog?.active);
        if(before!==JSON.stringify(selectedIds().sort()))manualMode=false;
        autoMode();
        invalidate();
        changed();
        queuePreview();
      },
      setAssignmentPdfs(checked) { if (state.busy) return; state.includeAssignmentPdfs = checked === true; invalidate(); changed();queuePreview(); },
      setDraft(text) {
        if(state.busy||dead)return;
        const before=state.mode,choice=state.helpChoice;
        state.draft=string(text);
        if(state.helpHandoff&&state.draft!==state.helpHandoff.wishes)state.helpHandoff=null;
        const context=helpContext(),shape=StudyKind.requestedHelp(context),correction=shape&&/\b(?:instead|actually|just|make it|rather)\b/i.test(state.draft);
        if(correction){
          manualMode=false;
          const key=StudyKind.helpKey(context),scope=state.catalog?.scopeKey;
          state.helpPreferences[key]=shape;
          if(studyStore.key(scope))
            void studyStore.setHelpPreference(scope,key,shape).catch(error=>{if(!dead&&scope===state.catalog?.scopeKey){state.error=errorText(error);changed();}});
        }
        if(!manualMode||correction)autoMode();
        const switched=before!==state.mode||choice!==state.helpChoice;
        if(switched){state.currentAid=null;state.currentAidKey='';resetReply();}
        state.fallback='';
        state.manualCopy=false;
        state.apiTokens=null;
        apiEstimate='';
        if(state.catalog?.helpContext?.requested)invalidate(false);else studyMessage();
        changed(switched||state.catalog?.helpContext?.requested?'all':'composer');
        queuePreview();
      },
      setAutoSend(value) { if (!state.busy) {
        state.autoSend = value === true; preferenceLoaded = true; changed();
        if (state.online) void transport.request('preference',{autoSend:state.autoSend}).catch(()=>{state.notice='This choice applies to the open panel, but could not be saved.';changed();});
      } },
      setBringAnswers(value) {
        if(state.busy||dead)return;
        state.bringAnswers=value===true;
        bringPreferenceLoaded=true;
        stopReturn(true);
        changed();
        if(state.online)void transport.request('preference',{bringAnswers:state.bringAnswers}).catch(()=>{state.notice='This choice applies to the open panel, but could not be saved.';changed();});
      },
      setTeacherFeedback(value) {
        if(state.busy||dead)return;
        state.teacherFeedback=value===true;
        feedbackPreferenceLoaded=true;
        if(!state.teacherFeedback&&state.catalog?.helpContext?.feedbackRequested)selectionEdited=true;
        pruneFeedback();
        autoMode();
        invalidate();
        changed();
        queuePreview();
        if(state.online)void transport.request('preference',{teacherFeedback:state.teacherFeedback}).catch(()=>{state.notice='This choice applies to the open panel, but could not be saved.';changed();});
      },
      setLevel(value) {
        if(state.busy||dead)return;
        state.level=StudyKind.level(value);
        levelPreferenceLoaded=true;
        invalidate();
        changed();
        queuePreview();
        if(state.online)void transport.request('preference',{level:state.level}).catch(()=>{state.notice='This choice applies to the open panel, but could not be saved.';changed();});
      },
      setProvider(provider) { if (state.busy || !PROVIDERS.some(p => p[0] === provider)) return;if(provider!==state.provider)resetReply();state.provider = provider;
      // The picked AI is the student's AI everywhere: Daily AI help and Help with this use it too.
      if(!state.demo&&agentCatalog(state.catalog)&&agentSettings(state.catalog).provider!==provider)
        Promise.resolve(agentRequest('settings',{settings:{provider}})).then(result=>{if(result?.settings&&state.catalog)state.catalog={...state.catalog,agent:result};},()=>{});
      state.fallback = '';
      state.webStatus = '';
      state.notice = '';
      state.error = '';
      changed();
      void checkWebsite();
      },
      setCourse(courseId) { if (!state.busy && (!courseId || state.catalog?.courses.some(course => String(course.id) === courseId))) { state.courseFilter = courseId; changed(); } },
      acceptIssues(value) { if (!state.busy) { state.reviewAccepted = value && state.context ? state.context.fingerprint : null; changed(); } },
      removePDF(id) { if (state.busy) return; state.pdfs = state.pdfs.filter(pdf => pdf.id !== id); autoMode();invalidate(); changed();queuePreview(); },
      loadCourse: () => run('Loading course materials', async alive => {
        if (!state.courseFilter) fail('Choose a course first.');
        const catalog = await transport.request('load-course', {courseId: state.courseFilter});
        if (alive()) setCatalog(catalog);
      }),
      clear() { if (state.busy) return; state.history = []; state.messages = []; state.notice = 'Conversation cleared from this panel.'; changed(); },
      async close() {
        stopAPI();
        operation++;
        resetReply();
        state.busy='';
        changed();
        try { await flushWishes();await transport.request('close'); return true; } catch(error) {state.error=errorText(error);changed();return false;}
      },
      disconnected(reason) {stopAPI();operation++;resetReply();state.online=false;state.busy='';state.error=reason;changed();},
      dispose() {stopAPI();apiPhotos.clear();void flushWishes();resetReply();dead=true;operation++;}

    };
    return controller;
  }

  function chromePermissions(env) {
    const invoke = (method, value) => new Promise((resolve, reject) => {
      if (!env.chrome?.permissions?.[method]) { if (method === 'contains') resolve(false); else reject(new Error('Website permission is unavailable in this preview.')); return; }
      try {
        const task = env.chrome.permissions[method](value, allowed => {
          const error = env.chrome.runtime?.lastError;
          if (error) reject(new Error(error.message)); else resolve(allowed);
        });
        if (task?.then) task.then(resolve, reject);
      } catch (error) { reject(error); }
    });
    return {request: value => invoke('request', value), contains: value => invoke('contains', value)};
  }

  function mount(env) {
    const document=env.document, byId=id=>document.getElementById(id);
    if(!byId('composer'))return null;
    const make=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
    for(const [id,label] of PROVIDERS.slice(3)){const option=make('option',label);option.value=id;byId('more-providers').append(option);}
    let controller,viewerRecord=null,bandRecord='',bandView=null,savedButtons=[],pdfButtons=[],photoButtons=[],feedbackInputs=[],feedbackButtons=[];
    const rendered=new Map();
    // Compare rendered fields, rather than mutable Sets, arrays or saved records.
    const renderChanged=(key,inputs,draw)=>{
      const previous=rendered.get(key);
      if(previous&&previous.length===inputs.length&&inputs.every((value,i)=>Object.is(value,previous[i])))return;
      draw();
      rendered.set(key,inputs);
    };
    const transport=createTransport(env,{
      agentProgress:data=>controller?.agentProgress(data),
      overnight:data=>controller?.setOvernightStatus(data),
      catalog:data=>controller?.setCatalog(data),
      disconnect:reason=>controller?.disconnected(reason),
      connect:()=>{
      if(controller)void controller.initialize();
    }});
    let agentLogRequest='';
    function renderAgent(state){
      const available=agentCatalog(state.catalog),
        agent=available?state.catalog.agent:null,
        settings=agentSettings(state.catalog),
        busy=Boolean(state.busy),
        disabled=busy||!state.online||state.demo;
      byId('ch-agent-view').hidden=!available||state.mode!=='ask'||state.helpChoice||state.helpTyped||state.catalog?.helpContext?.requested===true;
      byId('ch-agent-settings').hidden=!available;
      byId('ch-agent-status').textContent=agentText(agent?.status);
      if(byId('ch-agent-snapshot-text').textContent!==string(agent?.snapshot))byId('ch-agent-snapshot-text').textContent=string(agent?.snapshot);
      byId('ch-agent-stop').disabled=!available||!state.online||state.demo||state.busy==='Stopping your AI';
      byId('ch-agent-on').checked=settings.on!==false;byId('ch-agent-everyday').checked=settings.everyDay===true;
      byId('ch-agent-grades').checked=settings.grades===true;
      byId('ch-agent-cap').value=String(settings.dailyCap);
      if(document.activeElement!==byId('ch-agent-wishes'))byId('ch-agent-wishes').value=string(settings.wishes);
      for(const id of ['ch-agent-on','ch-agent-everyday','ch-agent-grades','ch-agent-cap','ch-agent-wishes'])byId(id).disabled=disabled;
      renderChanged(
        'agent',
        [available,agent?.snapshot,agentText(agent?.status),JSON.stringify(agent?.runs),JSON.stringify(agent?.memory),JSON.stringify(agent?.questions),disabled],
        ()=>{
        const button=(label,action)=>{
          const node=make('button',label,'ch-agent-button');
          node.type='button';
          node.disabled=disabled;
          node.addEventListener('click',action);
          return node;
        },at=value=>typeof value==='number'?value:Date.parse(value)||Number(value)||0;
        byId('ch-agent-runs').replaceChildren(...array(agent?.runs).filter(run=>array(run.actions).some(e=>['kept','done'].includes(e.outcome))).slice().sort((a,b)=>at(b.at)-at(a.at)).map(run=>{
          const row=make('li',undefined,'ch-agent-run'),head=make('div',undefined,'ch-agent-run-head');
          head.append(make('time',at(run.at)?new Date(at(run.at)).toLocaleString():agentText(run.at),'ch-agent-at'),make('span',agentText(run.status),'ch-agent-run-status'));
          if(array(run.actions).length)head.append(button('Undo all',()=>controller.undoAgent(run.id)));
          row.append(head);
          const actions=make('ol',undefined,'ch-agent-actions');
          actions.append(...array(run.actions).map(action=>{
            const item=make('li',undefined,'ch-agent-action'),name=typeof action.action==='object'?agentText(action.action?.tool==='today_done'?'Today item':action.action?.tool):agentText(action.action);
            item.append(make('p',name,'ch-agent-action-name'),make('p',agentText(action.why||action.action?.why),'ch-agent-action-why'),make('p',agentText(action.outcome),'ch-agent-action-status'));
            if(action.error)item.append(make('p',agentText(action.error),'ch-agent-action-error'));
            item.append(button('Undo',()=>controller.undoAgent(run.id,action.id)));
            return item;
          }));
          row.append(actions);
          if(array(run.errors).length){const errors=make('ul',undefined,'ch-agent-errors');errors.append(...run.errors.map(error=>make('li',agentText(error),'ch-agent-error')));row.append(errors);}
          return row;
        }));
        {const list=byId('ch-agent-runs'),snap=byId('ch-agent-snapshot');if(list?.parentElement)list.parentElement.hidden=!list.children.length;if(snap)snap.hidden=true;}
        byId('ch-agent-memory-list').replaceChildren(...array(agent?.memory).map(memory=>{
          const row=make('li',undefined,'ch-agent-memory-item'),line=make('div',undefined,'ch-agent-memory-row');
          line.append(make('span',agentText(memory.fact),'ch-agent-memory-fact'),button('Delete',()=>controller.forgetAgent(memory.id)));
          row.append(line);
          if(memory.about)row.append(make('p',agentText(memory.about),'ch-agent-memory-about'));
          if(memory.until)row.append(make('time',agentText(memory.until),'ch-agent-memory-until'));
          return row;
        }));
        byId('ch-agent-questions').replaceChildren(...array(agent?.questions).filter(question=>!question.dismissed).map(question=>{
          const row=make('section',undefined,'ch-agent-question'),choices=make('div',undefined,'ch-agent-choices'),answered=question.answer!==undefined&&question.answer!==null&&question.answer!=='';
          row.append(make('p',agentText(question.question),'ch-agent-question-text'));
          choices.append(...array(question.choices).map(choice=>{
            const node=button(agentText(choice),()=>controller.answerAgent(question.runId,question.actionId,choice));
            node.disabled=disabled||answered;
            node.setAttribute('aria-pressed',String(answered&&question.answer===choice));
            return node;
          }));
          row.append(choices);
          if(!answered)row.append(button('Dismiss',()=>controller.dismissAgent(question.runId,question.actionId)));
          return row;
        }));
      });
      const logId=state.catalog?.agentLog?.id;
      if(available&&logId&&agentLogRequest!==state.catalog.scopeKey+'|'+logId){
        agentLogRequest=state.catalog.scopeKey+'|'+logId;
        const heading=byId('ch-agent-history-title');
        heading.tabIndex=-1;
        heading.scrollIntoView?.({block:'start'});
        heading.focus?.();
      }
    }
    function renderComposer(state){
      const busy=Boolean(state.busy);
      byId('fallback').hidden=!state.fallback;byId('fallback-text').value=state.fallback;
      if(byId('prompt').value!==state.draft)byId('prompt').value=state.draft;
      byId('prompt').disabled=busy;byId('prompt-count').textContent=state.draft.length.toLocaleString()+' / 20,000';
      byId('send').textContent=busy?'Preparing…':!state.online?'Reconnecting…':state.draft.trim()?'Send ↗':'Help with this';
      byId('send').disabled=busy||
        !state.online||
        state.demo||
        !state.catalog||
        (state.way!=='overnight'&&state.mode==='ask'&&!state.draft.trim()&&!state.selected.size&&!state.pdfs.length&&!state.photos.length);
      byId('ch-api-message').textContent=state.mode==='ask'&&!state.helpChoice&&!state.helpTyped&&!state.catalog?.helpContext?.requested?
        compose(state.catalog?.showGrades===true?state.draft:Context.withoutScores(state.draft),state.context?.text||'',{level:state.level}):
        state.studyMessage;
      const tokens=state.apiTokens??(state.api.provider!=='anthropic'?Math.ceil(byId('ch-api-message').textContent.length/4):null);
      byId('ch-api-tokens').textContent=tokens===null?'':'About '+tokens+' tokens';
      if(state.way==='overnight')byId('send').textContent=busy?'Preparing?':'Prepare now';
      if(state.way==='api')byId('send').textContent=busy?'Preparing…':state.apiRetry?'Try again':'Send';
      if(state.mode==='ask'&&!state.helpChoice&&!state.helpTyped&&!state.catalog?.helpContext?.requested&&agentCatalog(state.catalog)){
        byId('send').textContent=busy?state.busy:'Ask your AI';
        byId('send').disabled=busy||!state.online||state.demo||!state.catalog;
      }
    }
    function render(state,area){
      if(area==='composer'){renderComposer(state);return;}
      const busy=Boolean(state.busy),
        catalog=state.catalog,
        name=PROVIDERS.find(x=>x[0]===state.provider)[1],
        agent=agentCatalog(catalog),
        agentAsk=agent&&state.mode==='ask'&&!state.helpChoice&&!state.helpTyped&&!catalog?.helpContext?.requested;
      renderAgent(state);byId('panel-title').textContent=agent?'Ask your AI':'Ask AI';byId('ch-agent-context').hidden=agentAsk;byId('ch-agent-privacy').hidden=agent;
      const night=state.way==='overnight'&&!agentAsk,direct=state.way!=='web';
      byId('ch-overnight-settings').hidden=state.way!=='overnight';
      byId('ch-overnight-folder').textContent=state.overnight.folder||'Choose folder';
      
      byId('ch-overnight-allow').hidden=state.way!=='overnight'||!state.overnight.needsAllow;
      byId('ch-overnight-task').hidden=!state.overnight.folder;
      byId('ch-overnight-schedule').textContent=state.overnight.schedule;
      for(const id of ['ch-overnight-folder','ch-overnight-prepare','ch-overnight-allow','ch-overnight-copy'])byId(id).disabled=busy;
      renderChanged(
        'overnight-errors',
        state.overnight.errors.flatMap(row=>[row.item,...array(row.reasons)]),
        ()=>byId('ch-overnight-errors').replaceChildren(...state.overnight.errors.map(row=>make('li',row.item+': '+array(row.reasons).join(' '),'ch-overnight-error'))));
      byId('ch-overnight-errors').hidden=!state.overnight.errors.length;
      const api=state.way==='api';
      byId('ch-api-way').value=state.way;
      byId('ch-api-way').disabled=busy;
      byId('ch-api-settings').hidden=!api;
      byId('ch-api-preview').hidden=!api||agentAsk;
      byId('ch-api-progress').hidden=!api||!busy||agentAsk;
      byId('ch-api-progress-text').textContent=state.busy;
      byId('ch-api-answer').hidden=!api||!state.apiAnswer||agentAsk;
      byId('ch-api-answer-text').textContent=state.apiAnswer;
      byId('ch-api-provider').value=state.api.provider;
      byId('ch-api-base-row').hidden=state.api.provider!=='compatible';
      if(byId('ch-api-base').value!==state.api.baseUrl)byId('ch-api-base').value=state.api.baseUrl;
      byId('ch-api-limit').value=String(state.api.dailyLimit);
      byId('ch-api-key-mask').textContent=state.api.hasKey?'••••'+state.api.last4:'';
      byId('ch-api-remove').disabled=busy||!state.api.hasKey;
      byId('ch-api-privacy').textContent='Only what you pick goes to '+
        API_PROVIDERS.find(([id])=>id===state.api.provider)[1]+
        ', with your key. '+
        (state.catalog?.showGrades===true?'Grades can be shared while Show grades is on.':'Grades never.');
      byId('ch-api-privacy').hidden=agentAsk;const privacy=document.querySelector?.('.privacy-note');if(privacy)privacy.hidden=agentAsk;
      renderChanged('api-models',[state.api.provider,...state.apiModels.flatMap(row=>[row.id,row.label]),state.api.model],()=>{
        const rows=state.apiModels.length?state.apiModels:state.api.provider==='anthropic'?['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5'].map(id=>({id,label:id})):[];
        const all=state.api.model&&!rows.some(row=>row.id===state.api.model)?[{id:state.api.model,label:state.api.model},...rows]:rows;
        const blank=make('option','','ch-api-option');
        blank.value='';
        byId('ch-api-model').replaceChildren(blank,...all.map(row=>{const option=make('option',row.label,'ch-api-option');option.value=row.id;return option;}));
        byId('ch-api-model').value=state.api.model;
      });
      for(const id of ['ch-api-provider','ch-api-base','ch-api-model','ch-api-key','ch-api-limit','ch-api-save','ch-api-estimate','ch-api-photo'])byId(id).disabled=busy;
      byId('ch-api-models').disabled=busy||!state.api.hasKey;
      for(const node of document.querySelectorAll('.providers'))node.hidden=direct;
      for(const id of ['auto-send','bring-answers','photo-description']){const node=byId(id);if(node.parentNode)node.parentNode.hidden=direct;}
      byId('open-website').hidden=direct;byId('open-fallback').hidden=direct;
      byId('sharing-note').hidden=direct||agentAsk;
      for(const id of ['composer-attach','photo-add','copy','preview','context-details','prompt-count','ch-study-wishes'])byId(id).hidden=night||agentAsk;
      if(byId('selection-summary').parentNode)byId('selection-summary').parentNode.hidden=night||agentAsk;
      if(byId('selected-items').parentNode)byId('selected-items').parentNode.hidden=night||agentAsk;
      document.querySelector?.('main')?.setAttribute('data-way',state.way);
      document.querySelector?.('main')?.setAttribute('data-study',String(state.mode!=='ask'||state.helpChoice||state.helpTyped||catalog?.helpContext?.requested||Boolean(state.currentAid)));
      byId('ch-study-wishes').hidden=night||state.mode==='ask';
      byId('ch-study-wishes-text').disabled=busy||!StudyUI.storageKey(catalog?.scopeKey);
      byId('ch-study-wishes-clear').disabled=busy||!state.wishes[state.mode];
      if(byId('ch-study-wishes-text').value!==(state.wishes[state.mode]||''))byId('ch-study-wishes-text').value=state.wishes[state.mode]||'';
      byId('prompt').hidden=night;
      byId('prompt-label').hidden=night;
      byId('ch-study-preview').hidden=direct||state.mode==='ask'&&!state.helpChoice&&!state.helpTyped&&!catalog?.helpContext?.requested;
      renderChanged('study-preview',[state.studyMessage],()=>{byId('ch-study-preview').textContent=state.studyMessage;});
      byId('composer').hidden=false;
      // The panel shows only the answer it is working on, as one full-width card; every saved answer lives in the
      // Home Help band (a whole band squeezed into this column was unreadable).
      const bandAids=state.currentAid?{[state.currentAidKey||'unsaved']:state.currentAid}:{};
      byId('ch-study-viewer').hidden=!state.currentAid;
      const bandSignature=JSON.stringify([
        state.catalog?.scopeKey,
        state.currentAidKey,
        state.currentAidOptions,
        Object.entries(bandAids).map(([key,aid])=>[key,aid.data,aid.savedAt])
      ]);
      if(bandSignature!==bandRecord||state.currentAid!==viewerRecord){
        viewerRecord=state.currentAid;
        bandRecord=bandSignature;
        bandView?.destroy();
        if(!byId('ch-study-viewer').hidden)
          bandView=Band.renderBand(byId('ch-study-viewer'),bandAids,{
            env,
            expanded:true,
            scope:state.catalog?.scopeKey,
            store:StudyUI.createStore(env),
            selectedKey:state.currentAidKey,
            missed:state.currentAidOptions?.missed,
            onProgress:(key,progress)=>key==='unsaved'?controller.saveProgress(progress):controller.saveBandProgress(key,progress),
            onTool:tool=>controller.runStudyTool(tool),
            onError:error=>{
            state.error=errorText(error);
          }});
      }
      byId('ch-study-paste').hidden=!state.studyRequest||Boolean(state.currentAid);
      if(byId('ch-study-answer').value!==state.answer)byId('ch-study-answer').value=state.answer;
      byId('ch-study-read').disabled=busy;byId('ch-study-answer').disabled=busy;
      byId('ch-study-wait').hidden=!state.waiting;byId('ch-study-stop').disabled=!state.waiting;
      byId('ch-study-bring').hidden=!state.bringAnswers||!state.answerId||!state.studyRequest;
      byId('ch-study-bring').disabled=busy||!state.online||!state.bringAnswers||!state.answerId||!state.studyRequest;
      renderChanged('study-errors',[...state.studyErrors],()=>{byId('ch-study-errors').replaceChildren(...state.studyErrors.map(error=>make('li',error)));});
      byId('ch-study-errors').hidden=!state.studyErrors.length;
      const saved=Object.entries(state.saved).filter(([,aid])=>Object.hasOwn(StudyUI.LABELS,aid?.kind)).sort((a,b)=>b[1].savedAt-a[1].savedAt);
      renderChanged('saved',saved.flatMap(([key,aid])=>[key,aid.title,aid.kind]),()=>{
        savedButtons=[];
        byId('ch-study-saved-list').replaceChildren(...saved.map(([key,aid])=>{
          const row=make('li',undefined,'ch-study-saved-item');
          row.append(make('span',aid.title),make('small',StudyUI.LABELS[aid.kind]||''));
          for(const [label,action]of [['Open',()=>controller.openAid(key)],['Remove',()=>controller.removeAid(key)]]){
            const b=make('button',label,'quiet-button');
            b.type='button';
            b.addEventListener('click',action);
            row.append(b);
            savedButtons.push(b);
          }
          return row;
        }));
      });
      for(const button of savedButtons)button.disabled=busy;
      document.documentElement.dataset.theme=catalog?.theme==='dark'?'dark':'light';
      document.documentElement.dataset.motion=['off','reduced','none','still'].includes(catalog?.motion)?'off':'standard';
      byId('close').hidden=!!env.parent&&env.parent!==env&&!!catalog&&string(catalog.scopeKey).split('|')[2]!=='pdf-page';
      byId('demo-label').hidden=!state.demo;
      for(const button of document.querySelectorAll('[data-provider]')){button.setAttribute('aria-pressed',String(button.dataset.provider===state.provider));button.disabled=busy;}
      byId('more-providers').value=PROVIDERS.slice(3).some(x=>x[0]===state.provider)?state.provider:'';byId('more-providers').disabled=busy;
      byId('sharing-note').textContent=state.photos.length?'Send opens '+name+' with your draft. Attach the named photos there before sending.':state.autoSend?'Send opens '+name+', adds your question and selected material, then submits it.':'Send opens '+name+' with your question and selected material. Review and submit the draft there, or enable automatic sending below.';
      byId('auto-send').checked=state.autoSend&&!state.photos.length;byId('auto-send').disabled=busy||Boolean(state.photos.length);
      byId('bring-answers').checked=state.bringAnswers;byId('bring-answers').disabled=busy;
      byId('teacher-feedback').checked=state.teacherFeedback;byId('teacher-feedback').disabled=busy;
      byId('ch-study-level').value=state.level;byId('ch-study-level').disabled=busy;
      const feedback=controller?.feedbackSources()||[];
      renderChanged('feedback',feedback.flatMap(source=>[source.id,source.title,state.selected.has(source.id)]),()=>{
        feedbackInputs=[];
        byId('teacher-feedback-list').replaceChildren(...feedback.map(source=>{
          const row=make('label',undefined,'check-row'),input=make('input');
          input.type='checkbox';
          input.checked=state.selected.has(source.id);
          input.addEventListener('change',()=>controller.setSelection(source.id,input.checked));
          row.append(input,make('span',source.title));
          feedbackInputs.push(input);
          return row;
        }));
      });
      byId('teacher-feedback-list').hidden=!feedback.length;
      for(const input of feedbackInputs)input.disabled=busy;
      const chosen=[...state.selected].map(id=>state.knownSources.get(id)).filter(Boolean).concat(['selectedText','draft'].filter(key=>
        !state.helpExcluded.has(key)&&state.catalog?.helpContext?.[key]).map(key=>
        ({id:'help:'+key,title:key==='draft'?'Student draft':'Selected text',kind:'context',localPart:key})));
      // from the PDF reader the material is the chosen pages' words, not items picked with circles on Canvas
      const fromPdf=chosen.length>0&&chosen.every(source=>String(source.id).startsWith('pdf-page:'));
      byId('prompt').placeholder=fromPdf?'Ask about these pages…':agentAsk?'Ask your AI':'What would you like help with?';
      const pdfStudy=fromPdf&&state.mode!=='ask'&&Number.isSafeInteger(catalog.page)&&Number.isSafeInteger(catalog.endPage);
      byId('selection-summary').textContent=pdfStudy?
        StudyUI.LABELS[state.mode]+' from pages '+(catalog.page+1)+'–'+(catalog.endPage+1):
        fromPdf?'From your PDF':chosen.length?chosen.length+' selected on Canvas':catalog?.active?'Opened assignment':'No Canvas items selected';
      renderChanged('selected',chosen.flatMap(source=>[source.id,source.title,fromPdf?'every word on these pages':source.courseName||source.kind]),()=>{
        feedbackButtons=[];
        byId('selected-items').replaceChildren(...chosen.map(source=>{
          const li=make('li');
          li.append(make('strong',source.title),make('small',fromPdf?'every word on these pages':source.courseName||source.kind));
          {
            const remove=make('button','Remove','quiet-button');
            remove.type='button';
            remove.dataset.sourceId=source.id;
            remove.setAttribute('aria-label','Remove '+source.title);
            remove.addEventListener('click',()=>source.localPart?controller.excludeHelpPart(source.localPart):controller.setSelection(source.id,false));
            li.append(remove);
            feedbackButtons.push(remove);
          }
          return li;
        }));
      });
      for(const button of feedbackButtons)button.disabled=busy;
      byId('scope-hint').textContent=fromPdf?'These words go to the AI site with your question.':chosen.length?'Change your selection using the circles on Canvas.':'Use the circles on Canvas to choose assignments or material. You can also ask a question without context.';
      byId('all-row').hidden=!catalog?.active||chosen.length!==1||chosen[0]?.id!==catalog.active.id;
      byId('all-linked').checked=state.all;byId('all-linked').disabled=busy;
      byId('assignment-pdfs-row').hidden=!chosen.some(source=>source.kind==='assignment');
      byId('assignment-pdfs').checked=state.includeAssignmentPdfs;byId('assignment-pdfs').disabled=busy;
      renderChanged('pdfs',state.pdfs.flatMap(pdf=>[pdf.id,pdf.title]),()=>{
        pdfButtons=[];
        byId('pdf-list').replaceChildren(...state.pdfs.map(pdf=>{
          const li=make('div',undefined,'pdf-item');
          li.append(make('span',pdf.title));
          const remove=make('button','Remove','quiet-button');
          remove.type='button';
          remove.addEventListener('click',()=>controller.removePDF(pdf.id));
          li.append(remove);
          pdfButtons.push(remove);
          return li;
        }));
      });
      for(const button of pdfButtons)button.disabled=busy;
      renderChanged('photos',state.photos.flatMap(photo=>[photo.id,photo.text]),()=>{
        photoButtons=[];
        byId('photo-list').replaceChildren(...state.photos.map((photo,i)=>{
          const chip=make('div',undefined,'pdf-item photo-item');
          chip.append(make('span','Photo '+(i+1)+': '+photo.text));
          const remove=make('button','Remove','quiet-button');
          remove.type='button';
          remove.addEventListener('click',()=>controller.removePhoto(photo.id));
          chip.append(remove);
          photoButtons.push(remove);
          return chip;
        }));
      });
      for(const button of photoButtons)button.disabled=busy;
      byId('photo-description').disabled=busy||state.photos.length>=6;byId('photo-add').disabled=busy||!catalog||state.photos.length>=6;
      const context=state.context;
      renderChanged('context',[Boolean(context),context?.text,context?.message,context?.characters,...array(context?.issues).flatMap(issue=>[issue.title,issue.reason])],()=>{
        if(!context)byId('context-count').textContent='';byId('context-preview').hidden=!context;
        if(context){
          byId('context-text').textContent=context.message||context.text;
          byId('context-count').textContent=(context.message||context.text).length.toLocaleString()+' characters';
          byId('issue-list').replaceChildren(...context.issues.map(x=>make('li',x.title+': '+x.reason)));
          byId('context-issues').hidden=!context.issues.length;
          if(context.issues.length)byId('context-details').open=true;
        }
      });
      byId('accept-issues').checked=Boolean(context&&state.reviewAccepted===context.fingerprint);byId('accept-issues').disabled=busy;
      byId('notice').textContent=state.busy||state.notice;byId('notice').hidden=!(state.busy||state.notice);
      byId('error').textContent=state.error;byId('error').hidden=!state.error;
      renderComposer(state);
      for(const id of ['preview','composer-attach','copy','copy-fallback'])byId(id).disabled=busy;
      for(const id of ['open-website','open-fallback'])byId(id).disabled=busy||state.demo||!state.online;
      if(state.manualCopy&&!busy){byId('fallback-text').focus();byId('fallback-text').select();}
    }
    controller=createController({transport,permissions:chromePermissions(env),clipboard:env.navigator?.clipboard,onChange:render,onQuestionReady:()=>{
      if(document.hasFocus?.()!==false)byId('send').focus();
    },env});
    const click=(id,action)=>byId(id).addEventListener('click',action);
    click('ch-agent-stop',()=>controller.stopAgent());
    byId('ch-agent-on').addEventListener('change',e=>controller.setAgentSettings({on:e.target.checked===true}));
    byId('ch-agent-everyday').addEventListener('change',e=>controller.setAgentSettings({everyDay:e.target.checked===true}));
    byId('ch-agent-grades').addEventListener('change',e=>controller.setAgentSettings({grades:e.target.checked===true}));
    byId('ch-agent-cap').addEventListener('change',e=>controller.setAgentSettings({dailyCap:Number(e.target.value)}));
    byId('ch-agent-wishes').addEventListener('change',e=>controller.setAgentSettings({wishes:e.target.value}));
    byId('ch-api-way').addEventListener('change',e=>{byId('ch-api-key').value='';void controller.setWay(e.target.value);});
    for(const [id,field]of [['ch-api-provider','provider'],['ch-api-base','baseUrl'],['ch-api-model','model'],['ch-api-limit','dailyLimit']])
      byId(id).addEventListener('change',e=>controller.setAPIField(field,e.target.value));
    click('ch-api-save',()=>{const field=byId('ch-api-key'),key=field.value;field.value='';return controller.saveAPI(key);});
    click('ch-overnight-folder',()=>controller.chooseOvernightFolder());
    click('ch-overnight-allow',()=>controller.chooseOvernightFolder());
    click('ch-overnight-prepare',()=>controller.prepareOvernight());
    click('ch-overnight-copy',()=>controller.copyOvernightTask());
    
    click('ch-api-remove',()=>controller.removeAPIKey());
    click('ch-api-models',()=>controller.loadAPIModels());
    click('ch-api-estimate',()=>controller.estimateAPI());
    click('ch-api-stop',()=>controller.stopAPI());
    click('ch-api-copy',()=>controller.copyAPIAnswer());
    click('ch-api-photo',()=>byId('ch-api-photo-input').click());
    byId('ch-api-photo-input').addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';void controller.attachPhoto(file);});
    byId('ch-study-wishes-text').addEventListener('input',e=>controller.setWishes(e.target.value));click('ch-study-wishes-clear',()=>controller.setWishes(''));
    byId('ch-study-answer').addEventListener('input',e=>controller.setAnswer(e.target.value));click('ch-study-read',()=>controller.readAnswer());
    click('ch-study-bring',()=>controller.bringAnswer());click('ch-study-stop',()=>controller.stopAnswer());
    for(const button of document.querySelectorAll('[data-provider]'))button.addEventListener('click',()=>controller.setProvider(button.dataset.provider));
    byId('more-providers').addEventListener('change',e=>{if(e.target.value)controller.setProvider(e.target.value);});
    byId('all-linked').addEventListener('change',e=>controller.setAll(e.target.checked));
    byId('assignment-pdfs').addEventListener('change',e=>controller.setAssignmentPdfs(e.target.checked));
    byId('auto-send').addEventListener('change',e=>controller.setAutoSend(e.target.checked));
    byId('bring-answers').addEventListener('change',e=>controller.setBringAnswers(e.target.checked));
    byId('teacher-feedback').addEventListener('change',e=>controller.setTeacherFeedback(e.target.checked));
    byId('ch-study-level').addEventListener('change',e=>controller.setLevel(e.target.value));
    byId('accept-issues').addEventListener('change',e=>controller.acceptIssues(e.target.checked));
    click('preview',()=>{byId('context-details').open=true;void controller.preview();});
    click('composer-attach',()=>byId('pdf-input').click());
    const addPhoto=()=>{if(controller.addPhoto(byId('photo-description').value))byId('photo-description').value='';};
    click('photo-add',addPhoto);byId('photo-description').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();e.stopPropagation();if(shouldSendKey(e))addPhoto();}});
    byId('pdf-input').addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';void controller.attach(file);});
    for(const id of ['copy','copy-fallback'])click(id,()=>controller.copy());
    for(const id of ['open-website','open-fallback'])click(id,()=>controller.openWebsite());
    click('close',()=>controller.close());
    byId('prompt').addEventListener('input',e=>controller.setDraft(e.target.value));
    byId('composer').addEventListener('submit',e=>{e.preventDefault();if(!byId('send').disabled)void controller.inject();});
    byId('prompt').addEventListener('keydown',e=>{
      if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();if(shouldSendKey(e)&&!byId('send').disabled)void controller.inject();}
    });
    env.addEventListener('focus',()=>{void controller.refreshOvernight().catch(()=>{});});
    env.addEventListener('pagehide',()=>{controller.dispose();transport.dispose();},{once:true});
    render(controller.state);void controller.initialize();return controller;
  }
  return {createTransport,createController,mount,shouldSendKey,CONTEXT_LIMIT,PROMPT_LIMIT,PDF_LIMIT,STUDY_LEVEL};
});
