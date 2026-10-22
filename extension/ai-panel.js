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
  const CONTEXT_LIMIT = 100000, PROMPT_LIMIT = 20000, PDF_LIMIT = 2 * 1024 * 1024;
  const PROVIDERS = [['chatgpt', 'ChatGPT'], ['claude', 'Claude'], ['gemini', 'Gemini'], ['grok', 'Grok'], ['deepseek', 'DeepSeek'], ['kimi', 'Kimi'], ['qwen', 'Qwen'], ['zai', 'Z.ai (GLM)']];
  const PROVIDER_ORIGINS = Object.freeze({chatgpt:['https://chatgpt.com/*'],claude:['https://claude.ai/*'],gemini:['https://gemini.google.com/*'],grok:['https://grok.com/*'],deepseek:['https://chat.deepseek.com/*'],kimi:['https://www.kimi.com/*'],qwen:['https://chat.qwen.ai/*'],zai:['https://chat.z.ai/*']});
  const string = value => typeof value === 'string' ? value : '';
  const array = value => Array.isArray(value) ? value : [];
  const errorText = error => string(error?.message) || string(error) || 'The request could not be completed.';
  const compose = (prompt, context) => [prompt.trim(), context].filter(Boolean).join('\n\n---\n\n');
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
      } catch {} // The request also becomes unusable when its runtime port closes.
    }
    function arm(id, item) {
      env.clearTimeout(item.timer);
      item.timer = env.setTimeout(() => { cancel(id); settle(id, new Error('The request timed out. Review your draft before trying again.')); }, item.timeout);
      item.timer?.unref?.();
    }
    function receive(message) {
      if (closed || !message || typeof message !== 'object') return;
      if (message.kind === 'catalog') { callbacks.catalog?.(message.data); return; }
      const item = pending.get(message.id); if (!item) return;
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
          if (preview && ['native', 'web'].includes(action)) { reject(new Error('Artificial preview cannot sign in, contact AI, or inject into a provider website.')); return; }
          if (pending.has(id)) { reject(new Error('Duplicate request identifier.')); return; }
          const timeout = options.timeout || (action === 'web' && data.op === 'inject' ? 60000 : action === 'collect' || action === 'pdf' || action === 'load-course' ? 60000 : 15000);
          const item = {resolve, reject, onDelta: options.onDelta, timeout}; pending.set(id, item); arm(id, item);
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
        if (closed) return;
        for (const id of [...pending.keys()]) settle(id, new Error('The panel closed.'));
        closed = true; available = false;
        if (reconnectTimer !== null) env.clearTimeout(reconnectTimer);
        if (production && port) { port.onMessage.removeListener?.(portListeners?.onMessage); port.onDisconnect.removeListener?.(portListeners?.onDisconnect); try { port.disconnect(); } catch {} }
        if (preview) env.removeEventListener('message', onWindowMessage);
      }
    };
  }

  function unwrap(value) {
    let result = value;
    for (let n = 0; n < 3; n++) {
      if (!result || typeof result !== 'object') break;
      if (result.ok === false || result.type === 'error' || result.kind === 'error' || result.error) throw new Error(errorText(result.error) === 'The request could not be completed.' ? string(result.message) || 'The request failed.' : errorText(result.error));
      if (result.result && typeof result.result === 'object') result = result.result;
      else if (result.data && typeof result.data === 'object' && !('connected' in result) && !('models' in result) && !('text' in result)) result = result.data;
      else break;
    }
    return result || {};
  }
  function createController({transport, permissions, clipboard, onChange = () => {}, env = globalThis}) {
    const state = {
      catalog: null, selected: new Set(), knownSources: new Map(), all: false, includeAssignmentPdfs: true, courseFilter: '',
      pdfs: [], draft: '', history: [], messages: [], context: null, reviewAccepted: null,
      provider: 'chatgpt', autoSend: false,
      demo: transport.preview, online: transport.available, busy: '', notice: '', error: '', webStatus: '',
      fallback: '', manualCopy: false, revision: 0, scopeVersion: 0
    };
    let operation = 0, websiteCheck = 0, dead = false, preferenceLoaded = false;
    const changed = area => { if (!dead) onChange(state, area); };
    const fail = message => { throw new Error(message); };
    const providerName = () => PROVIDERS.find(p => p[0] === state.provider)?.[1] || 'provider';
    function invalidate() { state.revision++; state.context = null; state.reviewAccepted = null; state.fallback = ''; state.manualCopy = false; }
    function realOnly() {
      if (state.demo || transport.preview) fail('Artificial preview supports context review only. Sign-in and provider requests are unavailable.');
      if (!state.online) fail('The panel is disconnected. Copy your draft before reloading Canvas Harness.');
    }
    async function run(label, action) {
      if (state.busy || dead) return false;
      const ticket = ++operation; state.busy = label; state.error = ''; state.notice = ''; changed();
      try { return await action(() => !dead && ticket === operation, ticket); }
      catch (error) { if (!dead && ticket === operation) state.error = errorText(error); return false; }
      finally { if (!dead && ticket === operation) { state.busy = ''; changed(); } }
    }
    function setCatalog(catalog) {
      if (!catalog || typeof catalog.scopeKey !== 'string' || !catalog.scopeKey) { state.error = 'Canvas returned an invalid source catalog. Reload Canvas Harness.'; changed(); return; }
      const previous = state.catalog, switched = previous?.scopeKey !== catalog.scopeKey || previous?.active?.id !== catalog.active?.id || previous?.courseId !== catalog.courseId || Boolean(previous?.demo) !== Boolean(catalog.demo);
      const priorSelection = JSON.stringify([...state.selected].sort());
      if (!preferenceLoaded && typeof catalog.autoSend === 'boolean') { state.autoSend = catalog.autoSend; preferenceLoaded = true; }
      if (!state.online && transport.available) { state.online = true; state.error = ''; state.notice = 'Reconnected. Your question is ready; click Send when you want to continue.'; }
      if (switched) {
        operation++; state.scopeVersion++; state.busy = '';
        state.selected = new Set(array(catalog.selectedIds ?? (catalog.active?.id ? [catalog.active.id] : [])));
        state.knownSources = new Map(); state.all = false; state.history = []; state.messages = []; state.pdfs = [];
        state.courseFilter = string(catalog.active?.courseId) || (catalog.courseId !== 'all' ? string(catalog.courseId) : '');
        if (previous) state.notice = 'Canvas view changed. Selected material changed; your question is still here.';
      }
      if (Array.isArray(catalog.selectedIds)) state.selected = new Set(catalog.selectedIds);
      state.catalog = {...catalog, sources: array(catalog.sources).filter(source => source && typeof source.id === 'string'), courses: array(catalog.courses)};
      for (const source of state.catalog.sources) state.knownSources.set(source.id, source);
      state.demo = transport.preview || catalog.demo === true;
      // Loading fresh assignment metadata republishes the catalog. It must not
      // cancel the very collection that loaded it; actual scope/selection changes do.
      if (switched || priorSelection !== JSON.stringify([...state.selected].sort()) || !state.busy) invalidate();
      changed();
    }
    function selectedIds() { return state.all && state.catalog?.active?.id ? [state.catalog.active.id] : [...state.selected]; }
    function promptValid() { if (state.draft.length > PROMPT_LIMIT) fail('Keep your prompt within 20,000 characters. Your draft has been preserved.'); }
    async function collect() {
      if (!state.catalog) fail('Wait for the Canvas source list, then try again.');
      const revision = state.revision, scopeKey = state.catalog.scopeKey, ids = selectedIds();
      const raw = await transport.request('collect', {ids, all: state.all && Boolean(state.catalog.active), includeAssignmentPdfs: state.includeAssignmentPdfs});
      if (dead || revision !== state.revision || scopeKey !== state.catalog?.scopeKey || raw?.scopeKey !== scopeKey) fail('The Canvas view or selected context changed. Review the current scope and try again.');
      const included = array(raw.included).map(source => ({...source}));
      const allowedAttachment = source => {
        const parent = state.knownSources.get(source.attachmentOf);
        return state.includeAssignmentPdfs && ids.includes(source.attachmentOf) && parent?.kind === 'assignment' && parent.courseId === source.courseId && source.kind === 'file' && source.mime === 'application/pdf';
      };
      if (!state.all && (included.some(source => !ids.includes(source.id) && !allowedAttachment(source)) || (!ids.length && string(raw.text).trim()))) fail('Unexpected or unselected context was returned. Nothing was shared. Refresh the selected sources and try again.');
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
      let text = string(raw.text);
      if (text.length > CONTEXT_LIMIT) { text = text.slice(0, CONTEXT_LIMIT - 36) + '\n[Truncated at context size limit]'; addIssue('Selected context', 'Text exceeded the 100,000-character limit and was truncated.'); }
      for (const pdf of state.pdfs) {
        const prefix = (text ? '\n\n' : '') + '[Attached PDF: ' + pdf.title + ']\n';
        const remaining = CONTEXT_LIMIT - text.length - prefix.length;
        if (remaining <= 40) { addIssue(pdf.title, 'Omitted because the 100,000-character context limit was reached.'); continue; }
        const cut = pdf.text.length > remaining;
        const body = cut ? pdf.text.slice(0, remaining - 36) + '\n[Truncated at context size limit]' : pdf.text;
        text += prefix + body; included.push({id: pdf.id, title: pdf.title, kind: 'pdf', truncated: cut || pdf.truncated});
        if (cut || pdf.truncated) addIssue(pdf.title, 'PDF text was truncated.');
        for (const warning of pdf.warnings) addIssue(pdf.title, warning);
        if (pdf.totalPages > pdf.pages) addIssue(pdf.title, `${pdf.pages} of ${pdf.totalPages} pages were read.`);
      }
      if (ids.length && !text.trim() && !issues.length) addIssue('Selected context', 'No readable text was returned.');
      const context = {text, included, issues, omitted: issues, characters: text.length, scopeKey};
      context.fingerprint = JSON.stringify([scopeKey, text, included.map(s => [s.id, s.title, Boolean(s.truncated)]), issues]);
      if (state.reviewAccepted !== context.fingerprint) state.reviewAccepted = null;
      state.context = context; changed(); return context;
    }
    function needsReview(context) {
      if (context.issues.length && state.reviewAccepted !== context.fingerprint) {
        state.notice = 'Some selected text is missing or shortened. Review the context issues, then explicitly continue or change your selection.'; changed(); return true;
      }
      return false;
    }
    async function inject() {
      return run('Preparing context', async alive => {
        realOnly(); promptValid();
        // Request at the initiating click, before collection can consume the gesture.
        const origins = PROVIDER_ORIGINS[state.provider];
        if (!permissions?.request || await permissions.request({permissions: ['scripting'], origins}) !== true) fail('Website access was not granted. Your question stays here; you can copy it instead.');
        if (!alive()) return false;
        const prompt = state.draft, provider = state.provider, context = await collect();
        if (!alive() || needsReview(context)) return false;
        const text = compose(prompt, context.text); if (!text.trim()) fail('Choose some context or write a prompt to send.');
        state.fallback = text; state.busy = 'Opening AI and inserting your draft…'; changed();
        const result = unwrap(await transport.request('web', {op: 'inject', provider, text, autoSend:state.autoSend, scopeKey:context.scopeKey}));
        if (!alive()) return false;
        state.webStatus = string(result.message);
        if (!['injected','sent','send-uncertain'].includes(result.status)) fail(string(result.message) || 'The website draft was not available. Copy the prepared text and open the website below.');
        state.fallback = ''; state.notice = string(result.message) || 'Inserted into ' + providerName() + '. Review its draft there.'; return true;
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
        promptValid();
        let text = state.fallback;
        if (!text) {
          const context = state.context || (state.online && state.catalog ? await collect() : {text: ''});
          if (!alive()) return false; text = compose(state.draft, context.text);
        }
        if (!text.trim()) fail('There is no draft or selected context to copy.');
        state.fallback = text;
        try {
          if (!clipboard?.writeText) throw new Error('Clipboard API unavailable');
          await clipboard.writeText(text); if (alive()) state.notice = 'Copied. Paste into the provider’s draft and review before sending.'; return true;
        } catch { if (alive()) { state.manualCopy = true; fail('Clipboard access was unavailable. Select and copy the prepared text below.'); } return false; }
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
        invalidate(); state.notice = 'PDF read locally. Preview its text and any warnings before sharing.'; return true;
      });
    }
    const controller = {
      state, setCatalog, inject, openWebsite, copy, attach,
      initialize: async () => { await run('Loading sources', async alive => { const catalog = await transport.request('catalog'); if (alive()) setCatalog(catalog); }); },
      preview: () => run('Reading selected context', async () => { await collect(); state.notice = 'Preview ready. Nothing has been sent to a provider.'; return true; }),
      setSelection(id, checked) { if (state.busy || state.all) return; if (!state.knownSources.has(id) && !state.selected.has(id)) return; if (checked) state.selected.add(id); else state.selected.delete(id); invalidate(); changed(); },
      setAll(checked) { if (state.busy) return; state.all = checked === true && Boolean(state.catalog?.active); invalidate(); changed(); },
      setAssignmentPdfs(checked) { if (state.busy) return; state.includeAssignmentPdfs = checked === true; invalidate(); changed(); },
      setDraft(text) { state.draft = string(text); state.fallback = ''; state.manualCopy = false; changed('composer'); },
      setAutoSend(value) { if (!state.busy) {
        state.autoSend = value === true; preferenceLoaded = true; changed();
        if (state.online) void transport.request('preference',{autoSend:state.autoSend}).catch(()=>{state.notice='This choice applies to the open panel, but could not be saved.';changed();});
      } },
      setProvider(provider) { if (state.busy || !PROVIDERS.some(p => p[0] === provider)) return; state.provider = provider; state.fallback = ''; state.webStatus = ''; state.notice = ''; state.error = ''; changed(); void checkWebsite(); },
      setCourse(courseId) { if (!state.busy && (!courseId || state.catalog?.courses.some(course => String(course.id) === courseId))) { state.courseFilter = courseId; changed(); } },
      acceptIssues(value) { if (!state.busy) { state.reviewAccepted = value && state.context ? state.context.fingerprint : null; changed(); } },
      removePDF(id) { if (state.busy) return; state.pdfs = state.pdfs.filter(pdf => pdf.id !== id); invalidate(); changed(); },
      loadCourse: () => run('Loading course materials', async alive => { if (!state.courseFilter) fail('Choose a course first.'); const catalog = await transport.request('load-course', {courseId: state.courseFilter}); if (alive()) setCatalog(catalog); }),
      clear() { if (state.busy) return; state.history = []; state.messages = []; state.notice = 'Conversation cleared from this panel.'; changed(); },
      async close() { operation++; state.busy=''; changed(); try { await transport.request('close'); return true; } catch(error) {state.error=errorText(error);changed();return false;} },
      disconnected(reason) {operation++;state.online=false;state.busy='';state.error=reason;changed();},
      dispose() {if(dead)return;dead=true;operation++;}

    };
    return controller;
  }

  function chromePermissions(env) {
    const invoke = (method, value) => new Promise((resolve, reject) => {
      if (!env.chrome?.permissions?.[method]) { if (method === 'contains') resolve(false); else reject(new Error('Website permission is unavailable in this preview.')); return; }
      try {
        const task = env.chrome.permissions[method](value, allowed => { const error = env.chrome.runtime?.lastError; if (error) reject(new Error(error.message)); else resolve(allowed); });
        if (task?.then) task.then(resolve, reject);
      } catch (error) { reject(error); }
    });
    return {request: value => invoke('request', value), contains: value => invoke('contains', value)};
  }

  function mount(env) {
    const document=env.document, byId=id=>document.getElementById(id);
    if(!byId('composer'))return null;
    // The containing toolbox supplies its own close control. A standalone panel keeps this one.
    byId('close').hidden=env.name==='ch-toolbox-ai';
    const make=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
    for(const [id,label] of PROVIDERS.slice(3)){const option=make('option',label);option.value=id;byId('more-providers').append(option);}
    let controller,pdfButtons=[];
    const rendered=new Map();
    // Store rendered primitive fields so in-place source edits invalidate the right list.
    const renderChanged=(key,inputs,draw)=>{const previous=rendered.get(key);if(previous&&previous.length===inputs.length&&inputs.every((value,i)=>Object.is(value,previous[i])))return;draw();rendered.set(key,inputs);};
    const transport=createTransport(env,{catalog:data=>controller?.setCatalog(data),disconnect:reason=>controller?.disconnected(reason),connect:()=>{ if(controller)void controller.initialize(); }});
    function renderComposer(state){
      const busy=Boolean(state.busy);
      byId('fallback').hidden=!state.fallback;if(byId('fallback-text').value!==state.fallback)byId('fallback-text').value=state.fallback;
      if(byId('prompt').value!==state.draft)byId('prompt').value=state.draft;
      byId('prompt').disabled=busy;byId('prompt-count').textContent=state.draft.length.toLocaleString()+' / 20,000';
      byId('send').textContent=busy?'Preparing…':!state.online?'Reconnecting…':'Send ↗';
      byId('send').disabled=busy||!state.online||state.demo||!state.catalog||(!state.draft.trim()&&!state.selected.size&&!state.pdfs.length);
    }
    function render(state,area){
      if(area==='composer'){renderComposer(state);return;}
      const busy=Boolean(state.busy),catalog=state.catalog,name=PROVIDERS.find(x=>x[0]===state.provider)[1];
      document.documentElement.dataset.theme=catalog?.theme==='dark'?'dark':'light';
      document.documentElement.dataset.motion=['off','reduced','none','still'].includes(catalog?.motion)?'off':'standard';
      byId('demo-label').hidden=!state.demo;
      for(const button of document.querySelectorAll('[data-provider]')){button.setAttribute('aria-pressed',String(button.dataset.provider===state.provider));button.disabled=busy;}
      byId('more-providers').value=PROVIDERS.slice(3).some(x=>x[0]===state.provider)?state.provider:'';byId('more-providers').disabled=busy;
      byId('sharing-note').textContent=state.autoSend?'Send opens '+name+', adds your question and selected material, then submits it.':'Send opens '+name+' with your question and selected material. Review and submit the draft there, or enable automatic sending below.';
      byId('auto-send').checked=state.autoSend;byId('auto-send').disabled=busy;
      const chosen=[...state.selected].map(id=>state.knownSources.get(id)).filter(Boolean);
      // from the PDF reader the material is the chosen pages' words, not items picked with circles on Canvas
      const fromPdf=chosen.length>0&&chosen.every(source=>String(source.id).startsWith('pdf-page:'));
      byId('prompt').placeholder=fromPdf?'Ask about these pages…':'What would you like help with?';
      byId('selection-summary').textContent=fromPdf?'From your PDF':chosen.length?chosen.length+' selected on Canvas':catalog?.active?'Opened assignment':'No Canvas items selected';
      renderChanged('selected',chosen.flatMap(source=>[source.id,source.title,fromPdf?'every word on these pages':source.courseName||source.kind]),()=>{byId('selected-items').replaceChildren(...chosen.map(source=>{const li=make('li');li.append(make('strong',source.title),make('small',fromPdf?'every word on these pages':source.courseName||source.kind));return li;}));});
      byId('scope-hint').textContent=fromPdf?'These words go to the AI site with your question.':chosen.length?'Change your selection using the circles on Canvas.':'Use the circles on Canvas to choose assignments or material. You can also ask a question without context.';
      byId('all-row').hidden=!catalog?.active||chosen.length!==1||chosen[0]?.id!==catalog.active.id;
      byId('all-linked').checked=state.all;byId('all-linked').disabled=busy;
      byId('assignment-pdfs-row').hidden=!chosen.some(source=>source.kind==='assignment');
      byId('assignment-pdfs').checked=state.includeAssignmentPdfs;byId('assignment-pdfs').disabled=busy;
      renderChanged('pdfs',state.pdfs.flatMap(pdf=>[pdf.id,pdf.title]),()=>{
        pdfButtons=[];byId('pdf-list').replaceChildren(...state.pdfs.map(pdf=>{const li=make('div',undefined,'pdf-item');li.append(make('span',pdf.title));const remove=make('button','Remove','quiet-button');remove.type='button';remove.addEventListener('click',()=>controller.removePDF(pdf.id));li.append(remove);pdfButtons.push(remove);return li;}));
      });
      for(const button of pdfButtons)button.disabled=busy;
      const context=state.context;
      renderChanged('context',[Boolean(context),context?.text,context?.characters,...array(context?.issues).flatMap(issue=>[issue.title,issue.reason])],()=>{
        if(!context)byId('context-count').textContent='';byId('context-preview').hidden=!context;
        if(context){byId('context-text').textContent=context.text;byId('context-count').textContent=context.characters.toLocaleString()+' characters';byId('issue-list').replaceChildren(...context.issues.map(x=>make('li',x.title+': '+x.reason)));byId('context-issues').hidden=!context.issues.length;if(context.issues.length)byId('context-details').open=true;}
      });
      byId('accept-issues').checked=Boolean(context&&state.reviewAccepted===context.fingerprint);byId('accept-issues').disabled=busy;
      byId('notice').textContent=state.busy||state.notice;byId('notice').hidden=!(state.busy||state.notice);
      byId('error').textContent=state.error;byId('error').hidden=!state.error;
      renderComposer(state);
      for(const id of ['preview','composer-attach','copy','copy-fallback'])byId(id).disabled=busy;
      for(const id of ['open-website','open-fallback'])byId(id).disabled=busy||state.demo||!state.online;
      if(state.manualCopy&&!busy){byId('fallback-text').focus();byId('fallback-text').select();}
    }
    controller=createController({transport,permissions:chromePermissions(env),clipboard:env.navigator?.clipboard,onChange:render,env});
    const click=(id,action)=>byId(id).addEventListener('click',action);
    for(const button of document.querySelectorAll('[data-provider]'))button.addEventListener('click',()=>controller.setProvider(button.dataset.provider));
    byId('more-providers').addEventListener('change',e=>{if(e.target.value)controller.setProvider(e.target.value);});
    byId('all-linked').addEventListener('change',e=>controller.setAll(e.target.checked));
    byId('assignment-pdfs').addEventListener('change',e=>controller.setAssignmentPdfs(e.target.checked));
    byId('auto-send').addEventListener('change',e=>controller.setAutoSend(e.target.checked));
    byId('accept-issues').addEventListener('change',e=>controller.acceptIssues(e.target.checked));
    click('preview',()=>{byId('context-details').open=true;void controller.preview();});
    click('composer-attach',()=>byId('pdf-input').click());
    byId('pdf-input').addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';void controller.attach(file);});
    for(const id of ['copy','copy-fallback'])click(id,()=>controller.copy());
    for(const id of ['open-website','open-fallback'])click(id,()=>controller.openWebsite());
    click('close',()=>controller.close());
    byId('prompt').addEventListener('input',e=>controller.setDraft(e.target.value));
    byId('composer').addEventListener('submit',e=>{e.preventDefault();if(!byId('send').disabled)void controller.inject();});
    byId('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();if(shouldSendKey(e)&&!byId('send').disabled)void controller.inject();}});
    env.addEventListener('pagehide',()=>{controller.dispose();transport.dispose();},{once:true});
    render(controller.state);void controller.initialize();return controller;
  }
  return {createTransport,createController,mount,shouldSendKey,CONTEXT_LIMIT,PROMPT_LIMIT,PDF_LIMIT};
});
