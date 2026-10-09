/*! Canvas Harness · isolated AI panel. Original creator: Flzsh. MIT. */
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
  const string = value => typeof value === 'string' ? value : '';
  const array = value => Array.isArray(value) ? value : [];
  const errorText = error => string(error?.message) || string(error) || 'The request could not be completed.';
  const compose = (prompt, context) => [prompt.trim(), context].filter(Boolean).join('\n\n---\n\n');

  // Only the extension runtime port carries production prompts. The alternate
  // transport is restricted to the same-origin, direct parent on local previews.
  function createTransport(env, callbacks = {}) {
    const pending = new Map();
    let port = null, closed = false, available = false, failure = '';
    const production = Boolean(env.chrome?.runtime?.id);
    let preview = false;
    try { const url = new URL(env.location.origin); preview = !production && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname); } catch {}
    function settle(id, error, value) {
      const item = pending.get(id); if (!item) return;
      env.clearTimeout(item.timer); pending.delete(id);
      if (error) item.reject(error); else item.resolve(value);
    }
    function arm(id, item) {
      env.clearTimeout(item.timer);
      item.timer = env.setTimeout(() => settle(id, new Error('The request timed out. Review your draft before trying again.')), item.timeout);
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
      if (closed) return; available = false; closed = true;
      const reason = string(env.chrome?.runtime?.lastError?.message) || 'The panel disconnected. Copy your draft before reloading Canvas Harness.';
      for (const id of [...pending.keys()]) settle(id, new Error(reason));
      callbacks.disconnect?.(reason);
    }
    const onWindowMessage = event => {
      if (event.source === env.parent && event.origin === env.location.origin && event.data?.type === 'ch-ai-reply') receive(event.data.reply);
    };
    try {
      if (production) {
        port = env.chrome.runtime.connect({name: 'ch-ai-panel'});
        port.onMessage.addListener(receive); port.onDisconnect.addListener(disconnected); available = true;
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
          const timeout = options.timeout || (action === 'native' && data.op === 'authenticate' ? 330000 : action === 'native' && data.op === 'chat' ? 180000 : action === 'collect' || action === 'pdf' || action === 'load-course' ? 60000 : 15000);
          const item = {resolve, reject, onDelta: options.onDelta, timeout}; pending.set(id, item); arm(id, item);
          const request = {...data, id, action};
          try {
            if (production) port.postMessage(request);
            else env.parent.postMessage({type: 'ch-ai-request', request}, env.location.origin);
          } catch (error) { settle(id, error); }
        });
        promise.id = id; return promise;
      },
      abort(id, reason = new Error('Request stopped.')) { settle(id, reason); },
      dispose() {
        for (const id of [...pending.keys()]) settle(id, new Error('The panel closed.'));
        closed = true; available = false;
        if (production && port) { port.onMessage.removeListener?.(receive); port.onDisconnect.removeListener?.(disconnected); try { port.disconnect(); } catch {} }
        if (preview) env.removeEventListener('message', onWindowMessage);
      }
    };
  }

  function unwrap(value) {
    let result = value;
    for (let n = 0; n < 3; n++) {
      if (!result || typeof result !== 'object') break;
      if (result.ok === false || result.type === 'error' || result.kind === 'error' || result.error) throw new Error(errorText(result.error) === 'The request could not be completed.' ? string(result.message) || 'The companion request failed.' : errorText(result.error));
      if (result.result && typeof result.result === 'object') result = result.result;
      else if (result.data && typeof result.data === 'object' && !('connected' in result) && !('models' in result) && !('text' in result)) result = result.data;
      else break;
    }
    return result || {};
  }
  function normalizeNative(value) {
    const result = unwrap(value);
    return {...result, connected: result.connected === true && result.planUsageEnabled !== false,
      label: string(result.account?.label) || string(result.account?.email) || string(result.label) || string(result.email) || 'ChatGPT account'};
  }
  function normalizeModels(value) {
    const result = unwrap(value), seen = new Set();
    return array(Array.isArray(result) ? result : result.models).flatMap(model => {
      if (!model || ('visibility' in model && !['list', 'visible', true].includes(model.visibility))) return [];
      const slug = string(model.slug) || string(model.id);
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(slug) || seen.has(slug)) return [];
      seen.add(slug); return [{slug, name: string(model.display_name) || string(model.name) || slug}];
    });
  }

  function createController({transport, permissions, clipboard, onChange = () => {}, env = globalThis}) {
    const state = {
      catalog: null, selected: new Set(), knownSources: new Map(), all: false, courseFilter: '',
      pdfs: [], draft: '', history: [], messages: [], context: null, reviewAccepted: null,
      provider: 'chatgpt', route: 'web', connected: false, accountLabel: '', models: [], model: '',
      demo: transport.preview, online: transport.available, busy: '', notice: '', error: '', webStatus: '',
      fallback: '', manualCopy: false, revision: 0, scopeVersion: 0, activeChat: null
    };
    let operation = 0, websiteCheck = 0, dead = false;
    const changed = () => { if (!dead) onChange(state); };
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
    function stopRemote(chat) {
      if (!chat) return Promise.resolve();
      transport.abort?.(chat.id, new Error('Response stopped.'));
      return transport.request('native', {op: 'cancel', requestId: chat.id}, {timeout: 10000}).then(unwrap);
    }
    function setCatalog(catalog) {
      if (!catalog || typeof catalog.scopeKey !== 'string' || !catalog.scopeKey) { state.error = 'Canvas returned an invalid source catalog. Reload Canvas Harness.'; changed(); return; }
      const previous = state.catalog, switched = previous?.scopeKey !== catalog.scopeKey;
      if (switched) {
        const chat = state.activeChat; operation++; state.scopeVersion++; state.busy = ''; state.activeChat = null;
        state.selected = new Set(catalog.active?.id ? [catalog.active.id] : []);
        state.knownSources = new Map(); state.all = false; state.history = []; state.messages = []; state.pdfs = [];
        state.courseFilter = string(catalog.active?.courseId) || (catalog.courseId !== 'all' ? string(catalog.courseId) : '');
        if (previous) state.notice = 'Canvas view changed. Conversation and PDFs were cleared; your unsent draft is still here.';
        if (chat) void stopRemote(chat).catch(error => { if (!dead) { state.error = 'Cancellation was not confirmed: ' + errorText(error); changed(); } });
      }
      state.catalog = {...catalog, sources: array(catalog.sources).filter(source => source && typeof source.id === 'string'), courses: array(catalog.courses)};
      for (const source of state.catalog.sources) state.knownSources.set(source.id, source);
      state.demo = transport.preview || catalog.demo === true;
      if (state.demo) { state.connected = false; state.models = []; state.model = ''; }
      invalidate(); changed();
    }
    function selectedIds() { return state.all && state.catalog?.active?.id ? [state.catalog.active.id] : [...state.selected]; }
    function promptValid() { if (state.draft.length > PROMPT_LIMIT) fail('Keep your prompt within 20,000 characters. Your draft has been preserved.'); }
    async function collect() {
      if (!state.catalog) fail('Wait for the Canvas source list, then try again.');
      const revision = state.revision, scopeKey = state.catalog.scopeKey, ids = selectedIds();
      const raw = await transport.request('collect', {ids, all: state.all && Boolean(state.catalog.active)});
      if (dead || revision !== state.revision || scopeKey !== state.catalog?.scopeKey || raw?.scopeKey !== scopeKey) fail('The Canvas view or selected context changed. Review the current scope and try again.');
      const included = array(raw.included).map(source => ({...source}));
      if (!state.all && (included.some(source => !ids.includes(source.id)) || (!ids.length && string(raw.text).trim()))) fail('Unexpected or unselected context was returned. Nothing was shared. Refresh the selected sources and try again.');
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
    async function modelsImpl() {
      const models = normalizeModels(await transport.request('native', {op: 'models'}));
      state.models = models;
      if (!models.some(model => model.slug === state.model)) state.model = models[0]?.slug || '';
      if (!models.length) fail('Your account returned no available models. Refresh models or use Alongside.');
    }
    function applyConnection(value) {
      const result = normalizeNative(value); state.connected = result.connected; state.accountLabel = result.connected ? result.label : '';
      if (!state.connected) { state.models = []; state.model = ''; }
      return result;
    }
    async function refreshConnection() {
      if (state.demo || !state.online) return false;
      return run('Checking connection', async alive => {
        if (!permissions?.contains || !(await permissions.contains({permissions: ['nativeMessaging']}))) return false;
        const result = await transport.request('native', {op: 'status'}); if (!alive()) return false;
        applyConnection(result); if (state.connected) await modelsImpl(); return state.connected;
      });
    }
    function connect() {
      return run('Connecting', async alive => {
        realOnly();
        if (!permissions?.request) fail('Native messaging permission is unavailable. Open this panel in the installed extension.');
        // This is the first asynchronous operation, invoked directly by click.
        const granted = await permissions.request({permissions: ['nativeMessaging']});
        if (!alive()) return false;
        if (granted !== true) fail('Native messaging permission was not granted. You can continue with Alongside.');
        let result = await transport.request('native', {op: 'status'}); if (!alive()) return false;
        if (!normalizeNative(result).connected) {
          unwrap(await transport.request('native', {op: 'authenticate', reauthorize: result.planUsageEnabled === false})); if (!alive()) return false;
          result = await transport.request('native', {op: 'status'}); if (!alive()) return false;
        }
        if (!applyConnection(result).connected) fail('ChatGPT has not confirmed an authorized connection. Complete companion setup and sign in again.');
        await modelsImpl(); state.notice = 'ChatGPT connected. Choose a model and send when ready.'; return true;
      });
    }
    async function send() {
      return run('Preparing context', async (alive, ticket) => {
        realOnly(); promptValid();
        if (state.provider !== 'chatgpt' || state.route !== 'connected') fail('Choose ChatGPT and Connected chat to send here.');
        if (!state.connected) fail('Sign in with ChatGPT before sending, or use Alongside.');
        if (!state.model || !state.models.some(model => model.slug === state.model)) fail('Choose an available account model before sending.');
        const prompt = state.draft; if (!prompt.trim()) fail('Write a question before sending.');
        const context = await collect(); if (!alive() || needsReview(context)) return false;
        if (state.draft !== prompt) fail('Your draft changed while context was loading. Review it and send again.');
        const content = compose(prompt, context.text), id = env.crypto.randomUUID();
        const user = {id: id + '-user', role: 'user', content: prompt, status: 'sent'};
        const assistant = {id: id + '-assistant', role: 'assistant', content: '', status: 'streaming'};
        const chat = {id, user, assistant, ticket}; state.activeChat = chat; state.history.push(user, assistant); state.busy = 'Replying'; changed();
        try {
          const raw = await transport.request('native', {op: 'chat', scopeKey:context.scopeKey, messages: [...state.messages, {role: 'user', content}], model: state.model}, {
            id, onDelta(text) {
              if (!alive() || state.activeChat !== chat) return;
              if (assistant.content.length + text.length > 1000000) { transport.abort?.(id, new Error('Response exceeded the panel text limit.')); return; }
              assistant.content += text; changed();
            }
          });
          if (!alive() || state.activeChat !== chat) return false;
          const result = unwrap(raw);
          if (result.cancelled || ['cancelled', 'failed', 'incomplete'].includes(result.status) || (typeof result.reason === 'string' && result.reason !== 'completed')) fail('The response did not complete. Your draft is still here.');
          const answer = typeof result.text === 'string' ? result.text : assistant.content;
          if (!answer.trim()) fail('The companion returned no answer text. Your draft is still here.');
          if (answer.length > 1000000) fail('Response exceeded the panel text limit.');
          assistant.content = answer; assistant.status = 'complete';
          // Re-attach only the current selection on the next request. Repeated
          // document bundles waste space and would resend sources the user removed.
          state.messages.push({role: 'user', content: prompt}, {role: 'assistant', content: answer});
          if (state.draft === prompt) state.draft = '';
          state.notice = 'Response complete.'; return true;
        } catch (error) {
          if (alive() && state.activeChat === chat) {
            user.status = 'failed'; assistant.status = 'error'; assistant.error = errorText(error);
            void stopRemote(chat).catch(() => {});
          }
          throw error;
        } finally { if (state.activeChat === chat) state.activeChat = null; }
      });
    }
    async function cancel() {
      const chat = state.activeChat; if (!chat) return false;
      operation++; const ticket = operation; state.activeChat = null; state.busy = 'Stopping'; chat.assistant.status = 'stopped'; chat.user.status = 'stopped'; changed();
      try { await stopRemote(chat); if (ticket === operation) state.notice = 'Response stopped. Your draft is still here.'; return true; }
      catch (error) { if (ticket === operation) state.error = 'Stopped displaying the response; remote cancellation was not confirmed: ' + errorText(error); return false; }
      finally { if (ticket === operation) { state.busy = ''; changed(); } }
    }
    async function inject() {
      return run('Preparing context', async alive => {
        realOnly(); promptValid();
        const prompt = state.draft, provider = state.provider, context = await collect();
        if (!alive() || needsReview(context)) return false;
        const text = compose(prompt, context.text); if (!text.trim()) fail('Choose some context or write a prompt to inject.');
        state.fallback = text; state.busy = 'Injecting'; changed();
        const result = unwrap(await transport.request('web', {op: 'inject', provider, text, scopeKey:context.scopeKey}));
        if (!alive()) return false;
        state.webStatus = string(result.message);
        if (result.status !== 'injected') fail(string(result.message) || 'The website draft was not available. Copy the prepared text and open the website below.');
        state.fallback = ''; state.notice = 'Inserted into ' + providerName() + '. Review its draft and send there when ready.'; return true;
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
      state, setCatalog, connect, refreshConnection, send, cancel, inject, openWebsite, copy, attach,
      initialize: async () => { await run('Loading sources', async alive => { const catalog = await transport.request('catalog'); if (alive()) setCatalog(catalog); }); await refreshConnection(); },
      preview: () => run('Reading selected context', async () => { await collect(); state.notice = 'Preview ready. Nothing has been sent to a provider.'; return true; }),
      setSelection(id, checked) { if (state.busy || state.all) return; if (!state.knownSources.has(id) && !state.selected.has(id)) return; if (checked) state.selected.add(id); else state.selected.delete(id); invalidate(); changed(); },
      setAll(checked) { if (state.busy) return; state.all = checked === true && Boolean(state.catalog?.active); invalidate(); changed(); },
      setDraft(text) { state.draft = string(text); state.fallback = ''; state.manualCopy = false; changed(); },
      setProvider(provider) { if (state.busy || !PROVIDERS.some(p => p[0] === provider)) return; state.provider = provider; if (provider !== 'chatgpt') state.route = 'web'; state.fallback = ''; state.webStatus = ''; state.notice = ''; state.error = ''; changed(); void checkWebsite(); },
      setMode(mode) { if (state.busy || !['web', 'connected'].includes(mode) || (mode === 'connected' && state.provider !== 'chatgpt')) return; state.route = mode; state.notice = ''; state.error = ''; changed(); },
      setModel(slug) { if (!state.busy && state.models.some(model => model.slug === slug)) { state.model = slug; changed(); } },
      setCourse(courseId) { if (!state.busy && (!courseId || state.catalog?.courses.some(course => String(course.id) === courseId))) { state.courseFilter = courseId; changed(); } },
      acceptIssues(value) { if (!state.busy) { state.reviewAccepted = value && state.context ? state.context.fingerprint : null; changed(); } },
      removePDF(id) { if (state.busy) return; state.pdfs = state.pdfs.filter(pdf => pdf.id !== id); invalidate(); changed(); },
      loadCourse: () => run('Loading course materials', async alive => { if (!state.courseFilter) fail('Choose a course first.'); const catalog = await transport.request('load-course', {courseId: state.courseFilter}); if (alive()) setCatalog(catalog); }),
      loadModels: () => run('Loading models', async () => { realOnly(); if (!state.connected) fail('Sign in before loading models.'); await modelsImpl(); }),
      signout: () => run('Signing out', async alive => { realOnly(); unwrap(await transport.request('native', {op: 'signout'})); if (!alive()) return; state.connected = false; state.models = []; state.model = ''; state.accountLabel = ''; state.history = []; state.messages = []; state.notice = 'Signed out of the companion. Your unsent draft is still here.'; }),
      clear() { if (state.busy) return; state.history = []; state.messages = []; state.notice = 'Conversation cleared from this panel.'; changed(); },
      async close() {
        const chat = state.activeChat; operation++; state.busy = ''; state.activeChat = null;
        // Closing must invalidate an in-flight collect before it can share text.
        if (chat) {
          chat.assistant.status = 'stopped'; chat.user.status = 'stopped';
          void stopRemote(chat).catch(error => { if (!dead) { state.error = 'Cancellation was not confirmed: ' + errorText(error); changed(); } });
        }
        changed();
        try { await transport.request('close'); return true; }
        catch (error) { state.error = errorText(error); changed(); return false; }
      },
      disconnected(reason) { operation++; state.online = false; state.connected = false; state.models = []; state.model = ''; state.busy = ''; if (state.activeChat) { state.activeChat.assistant.status = 'error'; state.activeChat.assistant.error = reason; state.activeChat = null; } state.error = reason; changed(); },
      dispose() { const chat = state.activeChat; dead = true; operation++; state.activeChat = null; if (chat) void stopRemote(chat).catch(() => {}); }
    };
    return controller;
  }

  function chromePermissions(env) {
    const invoke = (method, value) => new Promise((resolve, reject) => {
      if (!env.chrome?.permissions?.[method]) { if (method === 'contains') resolve(false); else reject(new Error('Native messaging permission is unavailable.')); return; }
      try {
        const task = env.chrome.permissions[method](value, allowed => { const error = env.chrome.runtime?.lastError; if (error) reject(new Error(error.message)); else resolve(allowed); });
        if (task?.then) task.then(resolve, reject);
      } catch (error) { reject(error); }
    });
    return {request: value => invoke('request', value), contains: value => invoke('contains', value)};
  }

  function mount(env) {
    const document = env.document, byId = id => document.getElementById(id);
    if (!byId('composer')) return null;
    const providerLabels = new Map(PROVIDERS);
    for (const provider of array(env.CanvasHarnessProviders?.list)) if (providerLabels.has(provider.id) && typeof provider.label === 'string') providerLabels.set(provider.id, provider.label);
    const make = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
    function options(select, rows, selected) {
      const key = JSON.stringify(rows); if (select.dataset.options !== key) { select.replaceChildren(...rows.map(([value, label]) => { const option = make('option', label); option.value = value; return option; })); select.dataset.options = key; } select.value = selected;
    }
    options(byId('more-providers'), [['', 'More'], ...PROVIDERS.slice(3).map(([id]) => [id, providerLabels.get(id)])], '');
    for (const button of document.querySelectorAll('[data-provider]')) button.textContent = providerLabels.get(button.dataset.provider);
    const setText = (id, value) => { const node = byId(id); if (node.textContent !== value) node.textContent = value; };
    const hidden = (id, value) => { byId(id).hidden = Boolean(value); };
    let controller, lastContext = null, sourceKey = '', historyNodes = new Map();
    const transport = createTransport(env, {catalog: data => controller?.setCatalog(data), disconnect: reason => controller?.disconnected(reason)});
    function render(state) {
      const busy = Boolean(state.busy), connectedMode = state.route === 'connected', name = providerLabels.get(state.provider), catalog = state.catalog;
      const scrollbox = byId('scrollbox'), nearBottom = scrollbox.scrollHeight - scrollbox.scrollTop - scrollbox.clientHeight < 85;
      document.documentElement.dataset.theme = catalog?.theme === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.motion = ['off', 'reduced', 'none', 'still'].includes(catalog?.motion) ? 'off' : 'standard';
      setText('scope-label', catalog?.active ? [catalog.active.courseName, catalog.active.title].filter(Boolean).join(' · ') : 'Home · Choose what you share');
      byId('scope-label').title = byId('scope-label').textContent;
      hidden('demo-label', !state.demo); hidden('website-info', connectedMode); hidden('connection-info', !connectedMode); hidden('conversation', !connectedMode);
      for (const button of document.querySelectorAll('[data-provider]')) { button.setAttribute('aria-pressed', String(button.dataset.provider === state.provider)); button.disabled = busy; }
      byId('more-providers').value = PROVIDERS.slice(3).some(p => p[0] === state.provider) ? state.provider : '';
      byId('more-providers').parentElement.dataset.active = String(Boolean(byId('more-providers').value));
      byId('more-providers').disabled = busy;
      byId('route-web').setAttribute('aria-pressed', String(!connectedMode)); byId('route-connected').setAttribute('aria-pressed', String(connectedMode));
      byId('route-web').disabled = busy; byId('route-connected').disabled = busy || state.provider !== 'chatgpt';
      byId('route-connected').title = state.provider === 'chatgpt' ? 'Chat here using your optional native companion' : 'Connected chat is available for ChatGPT';
      setText('website-name', name); setText('sharing-note', 'Selected context goes to ' + name + ' when you inject.');
      setText('website-status', state.webStatus); hidden('website-status', !state.webStatus);
      setText('account-label', state.connected ? state.accountLabel + ' · Connected' : 'ChatGPT is not connected');
      byId('connection-dot').dataset.connected = String(state.connected);
      setText('connection-help', state.demo ? 'Artificial preview cannot sign in or request AI responses.' : state.connected ? 'Selected context and this conversation go to ChatGPT when you send.' : 'Use the optional companion and official Sign in with ChatGPT to chat here.');
      hidden('connect', state.connected); hidden('signout', !state.connected); hidden('model-row', !state.connected);
      options(byId('model'), state.models.length ? state.models.map(model => [model.slug, model.name]) : [['', 'No models available']], state.model);
      byId('model').disabled = busy || !state.models.length;
      byId('connect').disabled = busy || state.demo || !state.online;
      byId('signout').disabled = busy; byId('refresh-models').disabled = busy;
      hidden('clear', !connectedMode || !state.history.length); byId('clear').disabled = busy;
      const count = (state.all ? 1 : state.selected.size) + state.pdfs.length;
      setText('selection-summary', state.all ? 'Assignment + linked materials' : count ? count + (count === 1 ? ' source selected' : ' sources selected') : 'Nothing selected');
      setText('scope-hint', catalog?.active ? 'Only this opened assignment starts selected. Add or remove sources before sharing.' : 'Choose the material to share. Home starts with nothing selected.');
      options(byId('course'), [['', 'Choose a course'], ...array(catalog?.courses).map(course => [String(course.id), string(course.name)])], state.courseFilter);
      byId('course').disabled = busy; byId('load-course').disabled = busy || !state.courseFilter || !state.online;
      hidden('all-row', !catalog?.active); byId('all-linked').checked = state.all; byId('all-linked').disabled = busy;
      const currentSources = new Map(array(catalog?.sources).map(source => [source.id, source]));
      const rows = [...currentSources.values()].filter(source => !state.courseFilter || String(source.courseId) === state.courseFilter || state.selected.has(source.id));
      for (const id of state.selected) if (!currentSources.has(id)) rows.push(state.knownSources.get(id) || {id, title: 'Selected source unavailable'});
      const nextSourceKey = JSON.stringify([rows, [...state.selected], state.all, busy, state.pdfs.map(pdf => [pdf.id, pdf.title, pdf.pages, pdf.totalPages, pdf.warnings, pdf.truncated])]);
      if (nextSourceKey !== sourceKey) {
        sourceKey = nextSourceKey; const focused = document.activeElement?.dataset?.sourceId;
        byId('sources').replaceChildren(...rows.map(source => {
          const missing = !currentSources.has(source.id), label = make('label', undefined, 'check-row' + (missing ? ' source-missing' : ''));
          const input = make('input'); input.type = 'checkbox'; input.dataset.sourceId = source.id; input.checked = state.all ? source.id === catalog?.active?.id : state.selected.has(source.id); input.disabled = busy || state.all;
          const span = make('span', string(source.title) || 'Untitled source');
          span.append(make('small', missing ? 'No longer available; uncheck or review the omission.' : [string(source.kind) || 'Source', source.loaded ? 'Text ready' : 'Read on preview', source.courseName].filter(Boolean).join(' · ')));
          label.append(input, span); input.addEventListener('change', () => controller.setSelection(source.id, input.checked)); return label;
        }));
        if (focused) [...byId('sources').querySelectorAll('input')].find(input => input.dataset.sourceId === focused)?.focus({preventScroll: true});
        byId('pdf-list').replaceChildren(...state.pdfs.map(pdf => {
          const row = make('div', undefined, 'pdf-item'), label = make('div', pdf.title);
          label.append(make('small', `${pdf.pages} page${pdf.pages === 1 ? '' : 's'} read` + (pdf.totalPages > pdf.pages ? ` of ${pdf.totalPages}` : '') + (pdf.truncated || pdf.warnings.length ? ' · Review warnings' : ' · Read locally')));
          const remove = make('button', '×', 'icon-button'); remove.type = 'button'; remove.disabled = busy; remove.setAttribute('aria-label', 'Remove ' + pdf.title); remove.addEventListener('click', () => controller.removePDF(pdf.id)); row.append(label, remove); return row;
        }));
      }
      hidden('empty-sources', rows.length > 0);
      byId('preview').disabled = busy || !catalog || !state.online;
      for (const id of ['attach', 'composer-attach', 'pdf-input']) byId(id).disabled = busy || !catalog || !state.online;
      hidden('context-preview', !state.context);
      if (lastContext !== state.context) {
        lastContext = state.context;
        if (state.context) {
          const context = state.context;
          setText('context-count', context.characters.toLocaleString() + ' characters');
          setText('context-text', context.text || 'No context selected. Only your prompt will be shared.');
          byId('included-sources').replaceChildren(...context.included.map(source => make('li', (string(source.title) || 'Source') + (source.truncated ? ' · Truncated' : ''))));
          byId('issue-list').replaceChildren(...context.issues.map(issue => make('li', issue.title + ': ' + issue.reason)));
          hidden('context-issues', !context.issues.length);
          if (context.issues.length) byId('context-details').open = true;
        }
      }
      byId('accept-issues').checked = Boolean(state.context && state.reviewAccepted === state.context.fingerprint); byId('accept-issues').disabled = busy;
      hidden('empty-chat', state.history.length > 0);
      const existing = new Set(state.history.map(message => message.id));
      for (const [id, entry] of historyNodes) if (!existing.has(id)) { entry.node.remove(); historyNodes.delete(id); }
      for (const message of state.history) {
        let entry = historyNodes.get(message.id);
        if (!entry) {
          const node = make('article', undefined, 'message'), label = make('p', message.role === 'user' ? 'You' : 'ChatGPT', 'message-label');
          const text = make('div', undefined, 'message-text'), status = make('p', undefined, 'message-status'); node.dataset.role = message.role; node.append(label, text, status); byId('history').append(node); entry = {node, text, status}; historyNodes.set(message.id, entry);
        }
        entry.node.dataset.status = message.status;
        if (entry.text.textContent !== message.content) entry.text.textContent = message.content;
        entry.status.textContent = message.status === 'streaming' ? 'Responding…' : message.status === 'stopped' ? 'Stopped · Not added to the next request' : message.status === 'error' ? message.error || 'Response did not complete.' : message.status === 'failed' ? 'Draft preserved for retry' : '';
        entry.status.hidden = !entry.status.textContent;
      }
      hidden('fallback', !state.fallback); if (byId('fallback-text').value !== state.fallback) byId('fallback-text').value = state.fallback;
      setText('notice', state.busy || state.notice); hidden('notice', !(state.busy || state.notice)); setText('error', state.error); hidden('error', !state.error);
      if (byId('prompt').value !== state.draft) byId('prompt').value = state.draft;
      byId('prompt').disabled = busy;
      setText('prompt-count', state.draft.length.toLocaleString() + ' / 20,000');
      byId('prompt').placeholder = connectedMode ? 'Ask about your selected material…' : 'Add a question, or just inject context…';
      setText('prompt-label', connectedMode ? 'Message to ChatGPT' : 'Optional prompt to add to the website draft');
      setText('send', connectedMode ? 'Send' : state.all ? 'Inject all' : 'Inject context');
      byId('send').disabled = busy || !state.online || state.demo || !catalog || (connectedMode ? !state.connected || !state.model || !state.draft.trim() : !state.draft.trim() && !count);
      hidden('stop', !state.activeChat && state.busy !== 'Stopping'); byId('stop').disabled = state.busy === 'Stopping'; hidden('send', Boolean(state.activeChat) || state.busy === 'Stopping');
      for (const id of ['open-website', 'open-fallback']) byId(id).disabled = busy || state.demo || !state.online;
      byId('copy').disabled = busy || (!state.draft && !count && !state.fallback); byId('copy-fallback').disabled = busy;
      setText('composer-help', connectedMode ? 'Enter to send · Shift + Enter for a new line' : 'Enter to inject · Shift + Enter for a new line');
      if (nearBottom && state.activeChat) scrollbox.scrollTop = scrollbox.scrollHeight;
      if (state.manualCopy && !busy) { byId('fallback-text').focus(); byId('fallback-text').select(); }
    }
    controller = createController({transport, permissions: chromePermissions(env), clipboard: env.navigator?.clipboard, onChange: render, env});
    const click = (id, action) => byId(id).addEventListener('click', action);
    for (const button of document.querySelectorAll('[data-provider]')) button.addEventListener('click', () => controller.setProvider(button.dataset.provider));
    byId('more-providers').addEventListener('change', event => { if (event.target.value) controller.setProvider(event.target.value); });
    click('route-web', () => controller.setMode('web')); click('route-connected', () => controller.setMode('connected'));
    click('connect', () => controller.connect()); click('signout', () => controller.signout()); click('refresh-models', () => controller.loadModels());
    byId('model').addEventListener('change', event => controller.setModel(event.target.value));
    byId('course').addEventListener('change', event => controller.setCourse(event.target.value)); click('load-course', () => controller.loadCourse());
    byId('all-linked').addEventListener('change', event => controller.setAll(event.target.checked));
    byId('accept-issues').addEventListener('change', event => controller.acceptIssues(event.target.checked));
    click('preview', () => controller.preview());
    const selectPDF = () => { byId('context-details').open = true; byId('pdf-input').click(); };
    click('attach', selectPDF); click('composer-attach', selectPDF);
    byId('pdf-input').addEventListener('change', event => { const file = event.target.files?.[0]; event.target.value = ''; void controller.attach(file); });
    click('open-website', () => controller.openWebsite()); click('open-fallback', () => controller.openWebsite());
    click('copy', () => controller.copy()); click('copy-fallback', () => controller.copy()); click('stop', () => controller.cancel()); click('clear', () => controller.clear());
    click('close', () => controller.close());
    byId('prompt').addEventListener('input', event => controller.setDraft(event.target.value));
    const submit = () => controller.state.route === 'connected' ? controller.send() : controller.inject();
    byId('composer').addEventListener('submit', event => { event.preventDefault(); if (!byId('send').disabled) void submit(); });
    byId('prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!event.repeat && !byId('send').disabled) void submit(); } });
    env.addEventListener('pagehide', () => { controller.dispose(); transport.dispose(); }, {once: true});
    render(controller.state); void controller.initialize(); return controller;
  }
  return {createTransport, normalizeNative, normalizeModels, createController, mount, CONTEXT_LIMIT, PROMPT_LIMIT, PDF_LIMIT};
});
