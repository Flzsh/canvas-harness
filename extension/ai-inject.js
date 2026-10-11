/* Canvas Harness — explicit draft insertion with an opt-in, single send. GPL-3.0-only. */
(function (root) {
  'use strict';
  // This function is intentionally self-contained. Chrome serializes `func`
  // without its module closure. Keep the exact-origin table in sync with the
  // provider registry; both boundaries must independently reject other hosts.
  function insertDraft(text, provider) {
    'use strict';
    const reply = (status, message) => ({status, message});
    if (typeof text !== 'string' || !text.trim() || text.length > 140000) {
      return reply('error', 'Choose context containing between 1 and 140000 characters.');
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
    function correctDocument() {
      try {
        const current = new URL(location.href);
        return top === self && current.origin === site.origin && !current.username && !current.password &&
          (!guard || (guard.origin === site.origin && typeof guard.expectedURL === 'string' && current.href === guard.expectedURL));
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
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    // Fingerprint is a marker only: the entire literal block must still be
    // present before we skip a repeat. User edits are never removed or replaced.
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    const marker = hash.toString(16) + '-' + text.length;
    const block = '[[Canvas Harness context ' + marker + ']]\n' + text + '\n[[End Canvas Harness context ' + marker + ']]';
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
      const attempt = n => {
        if (!correctDocument() || authenticationForm() || !usable(editor) || normalize(read()) !== normalize(block)) return reply('injected', 'Draft inserted. The page changed before sending; review the chat and send manually.');
        if (editor.getAttribute('data-canvas-harness-send') === marker) return reply('send-uncertain', 'Send was already clicked for this draft. Check the chat; Canvas Harness will not click it again.');
        const buttons = Array.from(new Set(document.querySelectorAll(selectors[id]))).filter(node => visible(node) && !node.disabled && node.getAttribute('aria-disabled') !== 'true');
        if (buttons.length === 1) {
          editor.setAttribute('data-canvas-harness-send', marker);
          try { buttons[0].click(); } catch { return reply('send-uncertain', 'Send could not be confirmed. Check the chat before trying again.'); }
          const confirmed = () => !normalize(read()) ? reply('sent', 'Sent to the AI website. You can return to Canvas and ask another question.') : reply('send-uncertain', 'Send was clicked. Check the AI website; Canvas Harness will not send a duplicate automatically.');
          return typeof view.setTimeout === 'function' ? new Promise(resolve => view.setTimeout(() => resolve(confirmed()), 300)) : confirmed();
        }
        if (n < 12 && typeof view.setTimeout === 'function') return new Promise(resolve => view.setTimeout(() => resolve(attempt(n + 1)), 150));
        return reply('injected', 'Draft inserted, but the Send button is not ready. Send it on the AI website when ready.');
      };
      return attempt(0);
    }
    const beforeReady = read();
    function write() { try {
      if (!correctDocument()) return reply('error', 'The provider page changed before insertion. Try again explicitly.');
      if (authenticationForm()) return reply('no-editor', 'Finish signing in before sending from Canvas.');
      if (!usable(editor)) return {...reply('no-editor', 'Waiting for the chat composer to finish loading…'), retryable:true};
      if (read() !== beforeReady) return reply('no-editor', 'The draft changed while the chat loaded. Review it before sending again.');
      editor.focus();
      if (!correctDocument()) return reply('error', 'The provider page changed before insertion. Try again explicitly.');
      if (!usable(editor) || authenticationForm()) return reply('no-editor', 'The composer changed before insertion. Try again explicitly.');
      const current = read();
      if (typeof current !== 'string' || current.length > 1000000) return reply('no-editor', 'This composer cannot safely accept more context.');
      if (autoSend && editor.getAttribute('data-canvas-harness-send') === marker) return reply('send-uncertain', 'Send was already clicked for this question. Check the chat before asking it again.');
      // Browser rich-text editing can turn each newline into a paragraph:
      // innerText gains spacing and textContent loses it. Compare rendered
      // whitespace as well so retrying never appends the same material twice.
      if (current.includes(block) || (!textarea && (editor.textContent.includes(block) || normalize(current).includes(normalize(block))))) return finish();
      const addition = (current.length ? '\n\n' : '') + block;
      if (textarea && editor.maxLength >= 0 && current.length + addition.length > editor.maxLength) {
        return reply('no-editor', 'The context exceeds this composer’s text limit. Shorten it and try again.');
      }
      const options = {bubbles: true, composed: true, inputType: 'insertText', data: addition};
      const before = new view.InputEvent('beforeinput', {...options, cancelable: true});
      if (!editor.dispatchEvent(before)) return reply('no-editor', 'The provider declined draft insertion. Paste the context manually.');
      if (!correctDocument()) return reply('error', 'The provider page changed before insertion. Try again explicitly.');
      if (!usable(editor) || authenticationForm() || read() !== current) return reply('no-editor', 'The draft changed while inserting. Review it and try again explicitly.');
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(editor, current + addition);
        editor.setSelectionRange(editor.value.length, editor.value.length);
      } else {
        // Use the browser editing transaction so rich-text frameworks update
        // their document model. A naked DOM append can vanish on the next render.
        const selection = view.getSelection(), range = document.createRange();
        range.selectNodeContents(editor); range.collapse(false);
        selection.removeAllRanges(); selection.addRange(range);
        if (typeof document.execCommand !== 'function' || !document.execCommand('insertText', false, addition)) return reply('no-editor', 'This editor declined insertion. Copy the prepared draft and paste it into the chat.');
      }
      editor.setAttribute('data-canvas-harness-context', marker);
      editor.dispatchEvent(new view.InputEvent('input', options));
      const verify = () => {
        if (!correctDocument() || !usable(editor) || !normalize(read()).includes(normalize(block))) {
          // Retry only a proven framework reset to the exact original draft.
          // Partial edits, navigation and an uncertain Send are never replayed.
          return {...reply('no-editor', 'The editor did not keep the inserted text. Your draft is still available in Canvas Harness to copy.'), retryable:correctDocument() && usable(editor) && !authenticationForm() && read() === current};
        }
        return finish();
      };
      // Chrome waits for this promise. Let the provider process its input event
      // before claiming success; test doubles without timers verify immediately.
      return typeof view.setTimeout === 'function' ? new Promise(resolve => view.setTimeout(() => resolve(verify()), 250)) : verify();
    } catch (_) {
      return reply('no-editor', 'The provider could not accept this draft. Review the composer before trying again or pasting manually.');
    } }
    // A visible input can precede framework hydration. Let that first render
    // settle before touching it; subsequent successful drafts need no extra wait.
    return typeof view.setTimeout === 'function' && !editor.getAttribute('data-canvas-harness-context') ? new Promise(resolve => view.setTimeout(() => resolve(write()), 200)) : write();
  }
  const api = Object.freeze({insertDraft});
  root.CanvasHarnessInject = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
