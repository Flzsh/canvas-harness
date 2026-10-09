/* Canvas Harness — explicit, plain-text draft insertion; never submit. MIT. */
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
      chatgpt: {origin: 'https://chatgpt.com', selectors: ['#prompt-textarea', 'textarea[data-testid="prompt-textarea"]', '[contenteditable="true"][data-testid="prompt-textarea"]']},
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
      return reply('no-editor', 'Sign in on the provider website, then return to Canvas and click Insert draft again.');
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
    if (candidates.length !== 1) {
      return reply('no-editor', candidates.length ? 'More than one composer is visible. Leave one chat composer open, then try again.' : 'No supported chat composer is ready. Sign in or open a new chat, then click Insert draft again.');
    }
    const editor = candidates[0], textarea = editor.tagName === 'TEXTAREA';
    const read = () => textarea ? editor.value : editor.innerText;
    // Fingerprint is a marker only: the entire literal block must still be
    // present before we skip a repeat. User edits are never removed or replaced.
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    const marker = hash.toString(16) + '-' + text.length;
    const block = '[[Canvas Harness context ' + marker + ']]\n' + text + '\n[[End Canvas Harness context ' + marker + ']]';
    try {
      editor.focus();
      if (!correctDocument()) return reply('error', 'The provider page changed before insertion. Try again explicitly.');
      if (!usable(editor) || authenticationForm()) return reply('no-editor', 'The composer changed before insertion. Try again explicitly.');
      const current = read();
      if (typeof current !== 'string' || current.length > 1000000) return reply('no-editor', 'This composer cannot safely accept more context.');
      if (current.includes(block) || (!textarea && editor.textContent.includes(block))) return reply('injected', 'This exact context is already in your draft. Review it before sending.');
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
        // Append a Text node; do not flatten or reinterpret the user's rich draft.
        editor.appendChild(document.createTextNode(addition));
      }
      editor.setAttribute('data-canvas-harness-context', marker);
      editor.dispatchEvent(new view.InputEvent('input', options));
      return reply('injected', 'Context appended to your draft. Review it and send it yourself.');
    } catch (_) {
      return reply('no-editor', 'The provider could not accept this draft. Review the composer before trying again or pasting manually.');
    }
  }
  const api = Object.freeze({insertDraft});
  root.CanvasHarnessInject = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
