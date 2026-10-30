/* Canvas Harness — explicit draft insertion with an opt-in, single send. GPL-3.0-only. */
(function (root) {
  'use strict';
  // This function is intentionally self-contained. Chrome serializes `func`
  // without its module closure. Keep the exact-origin table in sync with the
  // provider registry; both boundaries must independently reject other hosts.
  function insertDraft(text, provider) {
    'use strict';
    const reply = (status, message) => ({status, message});
    if (typeof text !== 'string' || !text.trim() || text.length > 2100000) {
      return reply('error', 'Choose context containing between 1 and 2100000 characters.');
    }
    const sites = {
      // Current ChatGPT uses a markdown editor inside its composer body, with
      // no legacy prompt-textarea id. Scope the marker to that body so ordinary
      // document editors never become an insertion target; labels can localize.
      chatgpt: {origin: 'https://chatgpt.com', selectors: ['#prompt-textarea', 'textarea[data-testid="prompt-textarea"]', '[contenteditable="true"][data-testid="prompt-textarea"]', '[data-composer-body] [data-composer-markdown][role="textbox"][contenteditable="true"]']},
      claude: {origin: 'https://claude.ai', selectors: ['.ProseMirror[contenteditable="true"][data-placeholder="Reply to Claude"]', '.ProseMirror[contenteditable="true"][data-placeholder="Reply to Claude..."]', '.ProseMirror[contenteditable="true"][data-placeholder="Reply to Claude…"]', '.ProseMirror[contenteditable="true"][data-placeholder="How can I help you today?"]', '.ProseMirror[contenteditable="true"][data-placeholder="What can I help you with?"]', '[contenteditable="true"][data-testid="chat-input"]', '[contenteditable="true"][aria-label="Write your prompt to Claude"]', 'textarea[placeholder="Message Claude"]']},
      gemini: {origin: 'https://gemini.google.com', selectors: ['rich-textarea .ql-editor[contenteditable="true"]']},
      grok: {origin: 'https://grok.com', selectors: ['textarea[aria-label="Ask Grok"]', 'textarea[placeholder="Ask anything"]', 'textarea[placeholder="What do you want to know?"]', '[contenteditable="true"][data-testid="grok-composer"]']},
      deepseek: {origin: 'https://chat.deepseek.com', selectors: ['textarea#chat-input', 'textarea[placeholder="Message DeepSeek"]']},
      kimi: {origin: 'https://www.kimi.com', selectors: ['.chat-input-editor[contenteditable="true"]', '.chat-input [contenteditable="true"]', 'textarea[placeholder="Ask anything..."]']},
      qwen: {origin: 'https://chat.qwen.ai', selectors: ['textarea#chat-input', '#chat-input[contenteditable="true"]', 'textarea[placeholder="How can I help you today?"]']},
      zai: {origin: 'https://chat.z.ai', selectors: ['textarea#chat-input', '#chat-input[contenteditable="true"]', 'textarea[placeholder="How can I help you today?"]', 'textarea[placeholder="Send a Message"]']}
    };
    const id = typeof provider === 'string' ? provider : provider && provider.id;
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(sites, id)) {
      return reply('error', 'This provider is not supported.');
    }
    const site = sites[id];
    const guard = typeof provider === 'object' && provider !== null ? provider : null;
    function authorized(action){
      if(guard?.consent===undefined)return action();const consent=guard.consent;
      if(!consent||typeof consent.key!=='string'||!/^reserve:v1:https:\/\/[^/?#]+:\d+$/.test(consent.key)||typeof consent.settingsKey!=='string'||consent.settingsKey.length>10000)
        return reply('error','Agent consent is unavailable. Start a new run.');
      return Promise.resolve().then(async()=>{
        try{
          const storage=globalThis.chrome?.storage?.local;
          if(!storage?.get)return reply('error','Agent consent could not be checked. Start a new run.');
          const saved=(await storage.get(consent.key))[consent.key],
            settings=saved?.toolbox?.agent?.settings,
            key=JSON.stringify(Object.keys(settings||{}).sort().map(k=>[k,settings[k]]));
          if(settings?.on!==true||key!==consent.settingsKey)return reply('error','Agent settings changed. Start a new run.');
        }catch{return reply('error','Agent consent could not be checked. Start a new run.');}
        return action();
      });
    }
    function correctDocument() {
      try {
        const current = new URL(location.href);
        const conversation=guard?.conversationToken?document.__canvasHarnessAgentConversation:null;
        return top === self && current.origin === site.origin && !current.username && !current.password &&
          (!guard || (guard.origin === site.origin && typeof guard.expectedURL === 'string' && current.href === guard.expectedURL))&&
          (!guard?.conversationToken||conversation?.token===guard.conversationToken&&!conversation.invalid&&conversation.url===current.href);
      } catch (_) { return false; }
    }
    if (!correctDocument()) return reply('error', 'The provider page changed. Open it again, then explicitly insert your draft.');
    if (/(?:^|\/)(?:auth|login|log-in|signin|sign-in|signup|sign-up|register|oauth)(?:\/|$)/i.test(location.pathname)) {
      return reply('no-editor', 'Sign in on the provider website, then return to Canvas and click Send again.');
    }
    const view = document.defaultView;
    function visible(node) {
      if (!node.isConnected || node.hidden || node.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
      const style = view.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && node.getClientRects().length > 0;
    }
    // Read only authentication FIELD ATTRIBUTES to refuse sign-in screens,
    // including an email/code dialog displayed over an existing chat composer.
    // No credentials, transcript, history, cookies, or unrelated field values.
    function authenticationForm() {
      return Array.from(document.querySelectorAll('input[type="password"], input[type="email"], input[autocomplete="username"], input[autocomplete="one-time-code"], input[autocomplete="current-password"], input[autocomplete="new-password"]')).some(visible);
    }
    if (authenticationForm()) {
      return reply('no-editor', 'Finish signing in, then return to Canvas and explicitly insert the draft.');
    }
    function usable(node) {
      if (!visible(node) || node.disabled || node.readOnly || node.getAttribute('aria-disabled') === 'true' || node.getAttribute('aria-readonly') === 'true') return false;
      if (node.closest('[role="search"], [role="dialog"], form[action*="login"], form[action*="signin"], [data-testid*="login"], [data-testid*="signin"]')) return false;
      const labels = ['name', 'type', 'role', 'aria-label', 'placeholder', 'data-placeholder', 'autocomplete'].map(name => node.getAttribute(name) || '').join(' ');
      if (/search|password|sign[ -]?in|log[ -]?in|e-?mail|username|one[ -]?time|verification/i.test(labels)) return false;
      return node.tagName === 'TEXTAREA' || (node.isContentEditable && node.getAttribute('contenteditable') === 'true');
    }
    const candidates = Array.from(new Set(site.selectors.flatMap(selector => Array.from(document.querySelectorAll(selector))))).filter(usable);
    // Claude can put the placeholder on a paragraph inside its editor.
    if (id === 'claude' && !candidates.length) {
      for (const node of document.querySelectorAll('.ProseMirror[contenteditable="true"]')) {
        const placeholder = node.querySelector?.('[data-placeholder]')?.getAttribute('data-placeholder') || '';
        if (/^(?:Reply to Claude|How can I help|What can I help|Write your prompt)/i.test(placeholder) && usable(node)) candidates.push(node);
      }
    }
    if (candidates.length !== 1) {
      return {...reply('no-editor', candidates.length ? 'More than one composer is visible. Leave one chat composer open, then try again.' : 'The chat input could not be detected. If it is already visible, use Copy draft; otherwise open a chat or finish signing in, then try Send again.'), retryable:candidates.length === 0};
    }
    const editor = candidates[0], textarea = editor.tagName === 'TEXTAREA';
    const read = () => textarea ? editor.value : editor.innerText;
    // Rich composers add line breaks around links and paragraphs; compare text without any whitespace.
    const normalize = value => String(value || '').replace(/\s+/g, '');
    // ChatGPT restores unsent drafts in new chats. A draft made only of earlier Canvas Harness blocks is Canvas Harness's own leftover:
    // it is replaced instead of appended to, so automatic sending is not blocked. Anything else stays untouched.
    const staleOnly = value =>
      !!String(value || '').trim() && !String(value).replace(/(?:\[\[Canvas Harness agent [\w-]+\]\]\s*)?\[\[Canvas Harness context ([\w-]+)\]\][\s\S]*?\[\[End Canvas Harness context \1\]\]/g, '').replace(/\[\[Canvas Harness agent [\w-]+\]\]/g, '').trim();
    // Fingerprint is a marker only: the entire literal block must still be
    // present before we skip a repeat. User edits are never removed or replaced.
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    const token=guard?.turnId||guard?.conversationToken;
    const marker = hash.toString(16) + '-' + text.length+(token?'-'+token:'');
    const block = (token?'[[Canvas Harness agent '+token+']]\n':'')+'[[Canvas Harness context ' + marker + ']]\n' + text + '\n[[End Canvas Harness context ' + marker + ']]';
    const autoSend = guard?.autoSend === true;
    function finish() {
      if (!autoSend) return reply('injected', 'Question and context are in the chat box. Review them and send when ready.');
      if (normalize(read()) !== normalize(block)) return reply('injected', 'Inserted beside an existing draft. Review and send it yourself so your other text is not sent unexpectedly.');
      const selectors = {
        chatgpt: 'button[data-testid="send-button"], button[type="submit"][aria-label="Send"], button[aria-label="Send prompt"]',
        claude: 'button[aria-label="Send message"], button[data-testid="send-button"]',
        gemini: 'button.send-button[aria-label="Send message"], button[aria-label="Send message"]',
        grok: 'button[aria-label="Submit"], button[aria-label="Send message"]',
        deepseek: 'button[aria-label="Send message"]', kimi: 'button[aria-label="Send message"]',
        qwen: 'button[aria-label="Send message"], button#send-message-button', zai: 'button[aria-label="Send message"], button#send-message-button'
      };
      const attempt = n => authorized(()=>{
        if (!correctDocument() || authenticationForm() || !usable(editor) || normalize(read()) !== normalize(block))
          return reply('injected', 'Draft inserted. The page changed before sending; review the chat and send manually.');
        if (editor.getAttribute('data-canvas-harness-send') === marker) return reply('send-uncertain', 'Send was already clicked for this draft. Check the chat; Canvas Harness will not click it again.');
        const buttons = Array.from(new Set(document.querySelectorAll(selectors[id]))).filter(node => visible(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true');
        if (buttons.length === 1) {
          editor.setAttribute('data-canvas-harness-send', marker);
          try { buttons[0].click(); } catch { return reply('send-uncertain', 'Send could not be confirmed. Check the chat before trying again.'); }
          const confirmed = () => !normalize(read()) ? reply('sent', 'Sent to the AI website. You can return to Canvas and ask another question.') : reply('send-uncertain', 'Send was clicked. Check the AI website; Canvas Harness will not send a duplicate automatically.');
          return typeof view.setTimeout === 'function' ? new Promise(resolve => view.setTimeout(() => resolve(confirmed()), 300)) : confirmed();
        }
        // A freshly opened provider tab keeps Send disabled for a few seconds while it starts; wait up to ~15 s.
        if (n < 60 && typeof view.setTimeout === 'function') return new Promise(resolve => view.setTimeout(() => resolve(attempt(n + 1)), 250));
        return reply('injected', 'Draft inserted, but the Send button is not ready. Send it on the AI website when ready.');
      });
      return attempt(0);
    }
    const beforeReady = read();
    function writeNow() { try {
      if (!correctDocument()) return reply('error', 'The provider page changed before insertion. Try again explicitly.');
      if (authenticationForm()) return reply('no-editor', 'Finish signing in before sending from Canvas.');
      if (!usable(editor)) return {...reply('no-editor', 'Waiting for the chat composer to finish loading…'), retryable:true};
      if (read() !== beforeReady) return reply('no-editor', 'The draft changed while the chat loaded. Review it before sending again.');
      editor.focus();
      if (!correctDocument()) return reply('error', 'The provider page changed before insertion. Try again explicitly.');
      if (!usable(editor) || authenticationForm()) return reply('no-editor', 'The composer changed before insertion. Try again explicitly.');
      const current = read();
      if (typeof current !== 'string' || current.length > 2100000) return reply('no-editor', 'This composer cannot safely accept more context.');
      if(guard?.turnId&&current.trim()&&!staleOnly(current)&&normalize(current)!==normalize(block))return reply('needs-you','Review the existing draft');
      if (autoSend && editor.getAttribute('data-canvas-harness-send') === marker) return reply('send-uncertain', 'Send was already clicked for this question. Check the chat before asking it again.');
      // Browser rich-text editing can turn each newline into a paragraph:
      // innerText gains spacing and textContent loses it. Compare rendered
      // whitespace as well so retrying never appends the same material twice.
      const stale = staleOnly(current) && normalize(current) !== normalize(block);
      if (!stale && (current.includes(block) || (!textarea && (editor.textContent.includes(block) || normalize(current).includes(normalize(block)))))) return finish();
      const addition = stale ? block : (current.length ? '\n\n' : '') + block;
      if (textarea && editor.maxLength >= 0 && (stale ? 0 : current.length) + addition.length > editor.maxLength) {
        return reply('no-editor', 'The context exceeds this composer’s text limit. Shorten it and try again.');
      }
      const options = {bubbles: true, composed: true, inputType: 'insertText', data: addition};
      const before = new view.InputEvent('beforeinput', {...options, cancelable: true});
      if (!editor.dispatchEvent(before)) return reply('no-editor', 'The provider declined draft insertion. Paste the context manually.');
      if (!correctDocument()) return reply('error', 'The provider page changed before insertion. Try again explicitly.');
      if (!usable(editor) || authenticationForm() || read() !== current) return reply('no-editor', 'The draft changed while inserting. Review it and try again explicitly.');
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(editor, stale ? block : current + addition);
        editor.setSelectionRange(editor.value.length, editor.value.length);
      } else {
        // Use the browser editing transaction so rich-text frameworks update
        // their document model. A naked DOM append can vanish on the next render.
        const selection = view.getSelection(), range = document.createRange();
        range.selectNodeContents(editor); if (!stale) range.collapse(false);
        selection.removeAllRanges(); selection.addRange(range);
        if (typeof document.execCommand !== 'function' || !document.execCommand('insertText', false, addition))
          return reply('no-editor', 'This editor declined insertion. Copy the prepared draft and paste it into the chat.');
      }
      editor.setAttribute('data-canvas-harness-context', marker);
      editor.dispatchEvent(new view.InputEvent('input', options));
      const verify = () => {
        if (!correctDocument() || !usable(editor) || !normalize(read()).includes(normalize(block))) {
          // Retry only a proven framework reset to the exact original draft.
          // Partial edits, navigation and an uncertain Send are never replayed.
          return {
            ...reply('no-editor', 'The editor did not keep the inserted text. Your draft is still available in Canvas Harness to copy.'),
            retryable:correctDocument() && usable(editor) && !authenticationForm() && read() === current
          };
        }
        return finish();
      };
      // Chrome waits for this promise. Let the provider process its input event
      // before claiming success; test doubles without timers verify immediately.
      return typeof view.setTimeout === 'function' ? new Promise(resolve => view.setTimeout(() => resolve(verify()), 250)) : verify();
    } catch (_) {
      return reply('no-editor', 'The provider could not accept this draft. Review the composer before trying again or pasting manually.');
    } }
    const write=()=>authorized(writeNow);
    // A visible input can precede framework hydration. Let that first render
    // settle before touching it; subsequent successful drafts need no extra wait.
    return typeof view.setTimeout === 'function' && !editor.getAttribute('data-canvas-harness-context') ? new Promise(resolve => view.setTimeout(() => resolve(write()), 200)) : write();
  }
  function readStudyBlock(guard) {
    'use strict';
    const origins={chatgpt:'https://chatgpt.com',claude:'https://claude.ai',gemini:'https://gemini.google.com',grok:'https://grok.com',deepseek:'https://chat.deepseek.com',kimi:'https://www.kimi.com',qwen:'https://chat.qwen.ai',zai:'https://chat.z.ai'};
    try {
      const url=new URL(location.href);
      if(top!==self||
        !Object.hasOwn(origins,guard?.id)||
        url.origin!==origins[guard.id]||
        guard.origin!==url.origin||
        url.username||
        url.password||
        guard.expectedURL&&guard.expectedURL!==url.href)
        return {status:'stopped'};
    } catch {return {status:'stopped'};}
    if(!['agent','prepare','practice','reading','lab','rubric','fixes','notes','help','ask','steps','outline','message','summary','flashcards'].includes(guard.kind))return {status:'stopped'};
    const helpKinds=Array.isArray(guard.helpKinds)&&
      guard.helpKinds.length>=2&&
      guard.helpKinds.length<=12&&
      new Set(guard.helpKinds).size===guard.helpKinds.length&&
      guard.helpKinds.every(kind=>['ask','practice','reading','lab','rubric','fixes','notes','steps','outline','message','summary','flashcards'].includes(kind))?
      guard.helpKinds:
      ['ask','practice','reading','lab','rubric','fixes','notes','steps','outline','message','summary','flashcards'];
    let conversation;
    if(guard.conversationToken!==undefined){
      if(typeof guard.conversationToken!=='string'||!/^[\w-]{8,100}$/.test(guard.conversationToken))return {status:'stopped'};
      if(guard.bindConversation===true&&guard.countOnly===true)
        document.__canvasHarnessAgentConversation={token:guard.conversationToken,url:location.href,assign:true,marker:'[[Canvas Harness agent '+guard.conversationToken+']]'};
      conversation=document.__canvasHarnessAgentConversation;
      if(!conversation||conversation.token!==guard.conversationToken||conversation.invalid)return {status:'stopped'};
      if(conversation.url!==location.href){
        const routes={
          chatgpt:[/^\/(?:new\/?)?$/,/^\/c\/[^/]+\/?$/],
          claude:[/^\/new\/?$/,/^\/chat\/[^/]+\/?$/],
          gemini:[/^\/app\/?$/,/^\/app\/[^/]+\/?$/],
          grok:[/^\/$/,/^\/(?:c|chat)\/[^/]+\/?$/],
          deepseek:[/^\/$/,/^\/(?:a\/)?chat\/s\/[^/]+\/?$/],
          kimi:[/^\/$/,/^\/chat\/[^/]+\/?$/],
          qwen:[/^\/$/,/^\/c\/[^/]+\/?$/],
          zai:[/^\/$/,/^\/c\/[^/]+\/?$/]
        },
          pair=routes[guard.id];
        const assigned=conversation.assign&&
          pair[0].test(new URL(conversation.url).pathname)&&
          pair[1].test(location.pathname)&&
          Array.from(document.querySelectorAll('[data-message-author-role="user"], [data-conversation-role="user"], [data-turn="user"], [data-user-message-bubble], [data-testid="user-message"], user-query, .user-query, .human-message, [data-role="user"], .user-message')).some(node=>{
          const text=node.textContent;
          return typeof text==='string'&&text.length<=200000&&text.includes(conversation.marker);
        });
        if(!assigned){conversation.invalid=true;return {status:'stopped'};}
        conversation.url=location.href;conversation.assign=false;
      }
    }
    const codeSelector='pre, code, code-block, .code-block__code, .code-block-content, .md-code-block';
    const selectors={chatgpt:'[data-turn="assistant"], [data-conversation-role="assistant"], [data-message-author-role="assistant"]',claude:'[data-testid="assistant-message"]',gemini:'model-response',grok:'[data-message-author-role="assistant"], [data-role="assistant"]',deepseek:'.ds-message--assistant, [data-role="assistant"]',kimi:'.segment-assistant, [data-role="assistant"]',qwen:'[data-role="assistant"], [data-message-role="assistant"]',zai:'[data-role="assistant"], [data-message-role="assistant"]'};
    const found=Array.from(document.querySelectorAll(selectors[guard.id]));
    let messages=[
      ...new Set(found.filter(node=>!found.some(other=>other!==node&&other.contains(node))).map(node=>/^H[1-6]$/.test(node.tagName)&&node.parentElement?node.parentElement:node))
    ];
    if(guard.turnId){
      const users=[
        ...new Set(Array.from(document.querySelectorAll('[data-message-author-role="user"], [data-conversation-role="user"], [data-turn="user"], [data-user-message-bubble], [data-testid="user-message"], user-query, .user-query, .human-message, [data-role="user"], .user-message')).map(n=>
          /^H[1-6]$/.test(n.tagName)&&n.parentElement?n.parentElement:n))
      ];
      const logical=users.filter(n=>!users.some(other=>other!==n&&other.contains(n)));
      const matched=logical.filter(n=>n.textContent?.includes('[[Canvas Harness agent '+guard.turnId+']]'));
      if(matched.length!==1)return {status:'waiting',matchingTurn:false};
      const user=matched[0],after=(a,b)=>!!(a.compareDocumentPosition?.(b)&4),following=logical.find(n=>n!==user&&after(user,n));
      messages=messages.filter(n=>after(user,n)&&(!following||after(n,following))).slice(0,1);
      if(!messages.length){
        // ChatGPT sometimes ends a long reply after thinking, with no answer: no Stop button, "Response complete",
        // and nothing after the student's message. Three such reads in a row mean the AI stopped before answering.
        if(guard.kind==='prepare'){
          const busy=Array.from(document.querySelectorAll('button[aria-label^="Stop" i], [data-testid="stop-button"]')).length>0,
            complete=Array.from(document.querySelectorAll('[aria-live], [role="status"]')).some(n=>/Response complete/i.test(n.textContent||'')),
            seen=document.__canvasHarnessAbandoned||={};
          seen[guard.turnId]=!busy&&complete?(seen[guard.turnId]||0)+1:0;
          if(seen[guard.turnId]>=3)return {status:'provider-error',message:'The AI stopped before answering',matchingTurn:true};
        }
        return {status:'waiting',matchingTurn:true};
      }
    }
    const leaves=scope=>{
      const nodes=Array.from(scope.querySelectorAll(codeSelector));
      return nodes.filter(node=>!nodes.some(child=>child!==node&&node.contains(child)));
    };
    // Only providers without a recognized turn container use the legacy code search.
    const userTurns=messages.length||guard.kind==='agent'||conversation?
      []:
      Array.from(document.querySelectorAll('[data-message-author-role="user"], [data-conversation-role="user"], [data-turn="user"], [data-user-message-bubble], [data-testid="user-message"], user-query, .user-query, .human-message, [data-role="user"], .user-message')).map(node=>
        /^H[1-6]$/.test(node.tagName)&&node.parentElement?node.parentElement:node);
    const fallback=messages.length||guard.kind==='agent'||conversation?
      []:
      leaves(document).filter(node=>!userTurns.some(turn=>turn.contains(node))&&!node.closest?.('[contenteditable="true"], [data-composer-body]'));
    if(guard.countOnly===true)return {count:messages.length||fallback.length,foundTurn:messages.length>0,...(conversation?{conversationURL:conversation.url}:{})};
    if(!Number.isInteger(guard.after)||guard.after<0)return {status:'stopped'};
    const assistant=messages.length>guard.after?messages.at(-1):null;
    const blocks=messages.length?(assistant?leaves(assistant):[]):fallback.slice(guard.after);
    const answerIndex=messages.length?messages.length-1:(fallback.length-1);
    const hidden=node=>{
      if(node.hidden||node.closest?.('[hidden], [inert], [aria-hidden="true"]'))return true;
      const style=document.defaultView?.getComputedStyle?.(node);
      return style?.display==='none'||style?.visibility==='hidden'||style?.visibility==='collapse';
    };
    const stops='button[aria-label^="Stop" i], [data-testid="stop-button"]'+(guard.id==='claude'?', [aria-label="Stop response"]':guard.id==='gemini'?', .stop, [aria-label="Stop"]':'');
    const generating=Array.from(document.querySelectorAll(stops)).some(node=>!hidden(node));
    const sample=assistant?assistant.textContent:blocks.map(node=>node.textContent).join('\n');
    function visibleText(node){
      if(!node)return '';
      const content=node.querySelector?.('[class*="MarkdownRoot-"]')||node;
      if(typeof content.innerText==='string'&&!content.querySelector?.('li'))return content.innerText.trim();
      if(content===assistant&&!content.childNodes)return sample||'';
      // innerText is unavailable in jsdom. Keep paragraph/list boundaries and skip UI.
      // Only the provider's sr-only turn heading is UI; visible answer h4s stay.
      function read(n){
        if(n.nodeType===3)return n.textContent;
        if(n.nodeType===1&&(hidden(n)||/^(BUTTON|SCRIPT|STYLE)$/.test(n.tagName)||n.tagName==='H4'&&found.includes(n)&&/(?:^|\s)sr-only(?:\s|$)/.test(n.getAttribute('class')||'')))return '';
        if(n.tagName==='BR')return '\n';
        if(!n.childNodes)return n.textContent||'';
        const text=Array.from(n.childNodes,read).join('');
        return /^(P|DIV|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE)$/.test(n.tagName)?'\n'+(n.tagName==='LI'?'- ':'')+text+'\n':text;
      }
      return read(content).replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    }
    const text=visibleText(assistant);
    // This short-lived state lives in the isolated document, never extension storage.
    const key=JSON.stringify([guard.id,guard.kind,guard.after,guard.answerId||guard.conversationToken||'']);
    const states=document.__canvasHarnessAnswerReads||=new Map();
    if(!states.has(key)){if(states.size>=16)states.delete(states.keys().next().value);states.set(key,{revision:0,changed:Date.now()});}
    const state=states.get(key),now=Date.now();
    if(state.text!==sample||state.node!==assistant||state.index!==answerIndex||state.generating!==generating){
      state.text=sample;
      state.node=assistant;
      state.index=answerIndex;
      state.changed=now;
      state.revision++;
    }
    state.generating=generating;
    const meta={index:answerIndex,foundTurn:messages.length>0,revision:state.revision,...(conversation?{conversationURL:conversation.url}:{})};
    const waiting=()=>({status:'waiting',...meta});
    if(generating)return {status:'generating',...meta};
    if(guard.kind==='prepare'){
      // Prepare replies come as one JSON code block (told to avoid code blocks, ChatGPT wraps the JSON in <escape>,
      // which its page does not show); take the first complete cards object.
      const raw=String(text||'').replace(/<\/?escape>/g,''),open=raw.indexOf('{'),close=raw.lastIndexOf('}');
      if(open>=0&&close>open){
        try{const data=JSON.parse(raw.slice(open,close+1));if(Array.isArray(data?.cards))return {status:'answer',text:raw.slice(open,close+1),...meta};}catch{}
      }
      const problem=String(text||'').length<=300?String(text||'').match(/Connection interrupted|Something went wrong|network error|An error occurred|There was an error generating a response|Too many requests|You['’]ve reached|usage limit/i):null;
      if(problem)return {status:'provider-error',message:problem[0],...meta};
      // A finished reply that is not cards is handed over once it stops changing, so CH can ask the student to read it.
      state.still=state.text===state.lastPrepareText?(state.still||0)+1:0;state.lastPrepareText=state.text;
      return text&&state.still>=4?{status:'answer',text:String(text),...meta}:{status:'waiting',...meta};
    }
    const errorPattern=/Connection interrupted|Something went wrong|network error|An error occurred|There was an error generating a response|Too many requests|You['\u2019]ve reached|usage limit/i;
    const errorMessage=value=>{const match=String(value||'').match(errorPattern);return match?match[0]:null;};
    const answer=(value,extra={})=>{if(conversation)conversation.assign=false;return {status:'answer',text:value,...meta,...extra};};
    if(guard.kind==='agent'){
      // Agent schema and extraction stay unchanged; only the delivery guard is shared.
      const valid=raw=>{
        if(typeof raw!=='string'||raw.length>140000)return null;
        try{
          const data=JSON.parse(raw);
          return data&&typeof data==='object'&&!Array.isArray(data)&&data.v===1&&(Array.isArray(data.read)||Array.isArray(data.actions))?raw.trimEnd():null;
        }catch{return null;}
      },named=value=>{
        if(typeof value!=='string'||value.length>280000)return null;
        const matches=Array.from(value.matchAll(/```[ \t]*chagent[ \t]*\r?\n([\s\S]*?)```/gi));
        for(const match of matches.reverse()){const raw=valid(match[1]);if(raw)return raw;}
        return null;
      },rawJSON=value=>{
        if(typeof value!=='string'||value.length>140100||/```[ \t]*chagent\b/i.test(value))return null;
        const matches=Array.from(value.matchAll(/```[ \t]*(?:json)?[ \t]*\r?\n([\s\S]*?)```/gi));
        for(const match of matches.reverse()){const raw=valid(match[1]);if(raw)return raw;}
        if(value.includes('```'))return null;
        const start=value.indexOf('{'),end=value.lastIndexOf('}');
        return start>=0&&end>start?valid(value.slice(start,end+1)):null;
      };
      let raw=assistant&&named(sample);
      if(assistant){
        if(!raw)for(const node of blocks.slice().reverse()){const value=node.textContent;raw=named(value)||rawJSON(value);if(raw)break;}
        raw||=rawJSON(sample);
      }
      if(raw)return answer('```chagent\n'+raw+'\n```');
    }else{
      let structured=false;
      // Recognize offered kinds here; the shared parser validates cards and envelopes.
      const offered=kind=>guard.kind==='help'?helpKinds.includes(kind):kind===guard.kind;
      for(const value of [...blocks.slice().reverse().map(node=>node.textContent),...(assistant?[text]:[])]){
        if(typeof value!=='string')continue;
        const match=value.match(/```\s*chstudy\s*\n([\s\S]*?)(?:```|$)/i)||value.match(/```\s*(?:json)?\s*\n(\{[\s\S]*?)(?:```|$)/i),
          start=value.indexOf('{'),
          end=value.lastIndexOf('}'),
          raw=match?match[1]:start>=0?value.slice(start,end>start?end+1:undefined):null;
        if(!raw)continue;
        structured ||= Boolean(match)||/^\s*[\[{]/.test(value)||/"(?:kind|v)"\s*:/.test(raw);let matches=false,malformed=false;
        try{
          const data=JSON.parse(raw);
          matches=data&&
            typeof data==='object'&&
            !Array.isArray(data)&&
            (offered(data.kind)||!Object.hasOwn(data,'kind')&&Array.isArray(data.cards)&&data.cards.every(card=>offered(card?.kind)));
        }catch{
          malformed=true;
          // A malformed object's top-level kind may reach the reader for JSON errors.
          if(raw.trim().startsWith('{')){
            let depth=0,previous='',kind;
            for(const token of raw.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)){
              const v=token[0];
              if(v[0]==='"'&&depth===1&&['{',','].includes(previous))
                try{if(JSON.parse(v)==='kind'){const found=raw.slice(token.index+v.length).match(/^\s*:\s*("(?:\\.|[^"\\])*")/);kind=found?JSON.parse(found[1]):undefined;}}catch{}
              if(v==='{'||v==='[')depth++;else if(v==='}'||v===']')depth--;
              previous=v;
            }
            matches=guard.kind==='help'?helpKinds.includes(kind):kind===guard.kind;
          }
        }
        if(matches){if(malformed&&now-state.changed<4000)return waiting();return answer(value,{...(malformed?{malformed:true}:{})});}
      }
      state.structured=structured||/```|~~~|^\s*[\[{]/.test(text);
    }
    const turnError=text.length<=300?text.trim().match(/^(?:Connection interrupted|Something went wrong|There was an error generating a response|An error occurred|Network error|Too many requests|You['\u2019]ve reached\b[^!?;:]*\blimit\b)/i)?.[0]:null;
    if(turnError)return {status:'provider-error',message:turnError,...meta};
    if(guard.kind!=='agent'&&assistant&&text&&!state.structured&&now-state.changed>=2500)return answer(text,{prose:true});
    // A finished block or prose answer wins over an error banner left after Retry.
    const banners=Array.from(document.querySelectorAll('[role="alert"], [data-testid*="error"], .error-message'));
    const banner=banners.filter(node=>!hidden(node)).map(node=>errorMessage(node.textContent)).find(Boolean);
    if(banner&&!(state.banner===banner&&state.errorRevision!==state.revision&&text)){
      state.banner=banner;state.errorRevision=state.revision;return {status:'provider-error',message:banner,...meta};
    }
    return waiting();
  }

  // Serialized separately: the worker journals send-intent before invoking mode=click.
  // This function never removes a chip, accepts consent, retries, or clicks a non-Send control.
  function inspectTurn(guard){
    'use strict';
    if(guard.mode==='click'&&guard.consent&&!guard.checked)
      return Promise.resolve().then(async()=>{
        const c=guard.consent;
        try{
          const saved=(await globalThis.chrome.storage.local.get(c.key))[c.key],
            s=saved?.toolbox?.agent?.settings,
            key=JSON.stringify(Object.keys(s||{}).sort().map(k=>[k,s[k]]));
          if(s?.on!==true||key!==c.settingsKey)return {status:'needs-you',message:'Prepare settings changed'};
          const permit=await globalThis.chrome.runtime.sendMessage({target:'ch-ai-engine-permit',runId:guard.runId,turnId:guard.turnId,epoch:guard.epoch});
          if(!permit?.ok)return {status:'needs-you',message:'Prepare stopped before Send'};
        }catch{return {status:'needs-you',message:'Prepare consent could not be checked'};}
        return inspectTurn({...guard,checked:true});
      });
    const origins={chatgpt:'https://chatgpt.com',claude:'https://claude.ai',gemini:'https://gemini.google.com',grok:'https://grok.com',deepseek:'https://chat.deepseek.com',kimi:'https://www.kimi.com',qwen:'https://chat.qwen.ai',zai:'https://chat.z.ai'},
      normalize=v=>String(v||'').replace(/\s+/g,'');
    if(top!==self||location.origin!==origins[guard.id]||location.href!==guard.expectedURL||!/^turn-[\w-]+$/.test(guard.turnId))return {status:'needs-you',message:'Open the original chat'};
    const visible=n=>n.isConnected!==false&&!n.hidden&&!n.closest?.('[hidden], [inert], [aria-hidden="true"]')&&(()=>{
      const s=document.defaultView.getComputedStyle(n);
      return s.display!=='none'&&s.visibility!=='hidden'&&n.getClientRects().length>0;
    })();
    if(Array.from(document.querySelectorAll('input[type="password"], input[type="email"], input[autocomplete="username"], input[autocomplete="one-time-code"], [role="dialog"]')).some(visible))
      return {status:'needs-you',message:'Sign in or review the chat dialog'};
    if(Array.from(document.querySelectorAll('[role="alert"], [data-testid*="error"], .error-message')).some(n=>visible(n)&&/error|wrong|limit|interrupted|sign.?in/i.test(n.textContent||'')))
      return {status:'needs-you',message:'The AI website needs your attention'};
    const marker='[[Canvas Harness agent '+guard.turnId+']]',users=Array.from(document.querySelectorAll('[data-message-author-role="user"], [data-conversation-role="user"], [data-turn="user"], [data-user-message-bubble], [data-testid="user-message"], user-query, .user-query, .human-message, [data-role="user"], .user-message'));
    const logical=users.filter(n=>!users.some(other=>other!==n&&other.contains?.(n)));
    let hash=2166136261;for(let i=0;i<guard.text.length;i++)hash=Math.imul(hash^guard.text.charCodeAt(i),16777619)>>>0;
    const key=hash.toString(16)+'-'+guard.text.length+'-'+guard.turnId,header='[[Canvas Harness context '+key+']]';
    // Sites show long messages formatted and cut short, so the full text is never on the page; the turn marker plus
    // the context header (a fingerprint of the exact text and its length) identify the sent message.
    const matched=logical.filter(n=>{const text=normalize(n.textContent);return text.includes(normalize(marker))&&text.includes(normalize(header));});
    if(matched.length)return {status:'sent',conversationURL:location.href};
    const chips=document.querySelectorAll('[data-testid="attachment-chip"], [data-testid="file-chip"], [data-testid="composer-attachment"], [data-testid="composer-file"], [data-attachment-id], [data-file-id], .attachment-chip, .file-chip');
    if(Array.from(chips).some(n=>visible(n)&&!/^(?:BUTTON|INPUT|LABEL)$/.test(n.tagName||'')&&!n.closest?.('[data-message-author-role], [data-conversation-role], [data-turn], [data-testid="user-message"], model-response, user-query')))
      return {status:'needs-you',message:'Review the existing attachment draft'};
    const editors=Array.from(new Set(document.querySelectorAll('textarea, [contenteditable="true"][role="textbox"], #prompt-textarea, .ProseMirror[contenteditable="true"], rich-textarea .ql-editor[contenteditable="true"], .chat-input-editor[contenteditable="true"], #chat-input[contenteditable="true"]'))).filter(n=>
      visible(n)&&!n.disabled&&!n.readOnly&&n.getAttribute('aria-disabled')!=='true'&&n.getAttribute('aria-readonly')!=='true'&&!n.closest?.('[role="search"], [role="dialog"]'));
    if(editors.length!==1)return {status:'waiting',message:'Waiting for the chat composer'};
    const editor=editors[0],value=editor.tagName==='TEXTAREA'?editor.value:editor.innerText;
    const block=marker+'\n'+header+'\n'+guard.text+'\n[[End Canvas Harness context '+key+']]';
    if(!normalize(value))return {status:'waiting',message:'Waiting for the matching student turn'};
    if(normalize(value)!==normalize(block))return {status:'needs-you',message:'Review the existing draft'};
    const selectors={chatgpt:'button[data-testid="send-button"], button[type="submit"][aria-label="Send"], button[aria-label="Send prompt"]',claude:'button[aria-label="Send message"], button[data-testid="send-button"]',gemini:'button.send-button[aria-label="Send message"], button[aria-label="Send message"]',grok:'button[aria-label="Submit"], button[aria-label="Send message"]',deepseek:'button[aria-label="Send message"]',kimi:'button[aria-label="Send message"]',qwen:'button[aria-label="Send message"], button#send-message-button',zai:'button[aria-label="Send message"], button#send-message-button'};
    const buttons=Array.from(new Set(document.querySelectorAll(selectors[guard.id]))).filter(n=>visible(n)&&!n.disabled&&n.getAttribute('aria-disabled')!=='true');
    if(buttons.length!==1)return {status:'waiting',message:'Waiting for Send'};
    if(guard.mode!=='click')return {status:'ready'};
    if(editor.getAttribute('data-canvas-harness-send')===key)return {status:'waiting'};
    editor.setAttribute('data-canvas-harness-send',key);buttons[0].click();return {status:'waiting',clicked:true};
  }
  const api = Object.freeze({insertDraft,readStudyBlock,inspectTurn});
  root.CanvasHarnessInject = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
