/* Canvas Harness — official provider website allowlist. MIT. */
(function (root, factory) {
  'use strict';
  const api = factory();
  root.CanvasHarnessProviders = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis, function () {
  'use strict';
  // Official website links verified 2026-10-09. Origins are Chrome permission
  // patterns, deliberately limited to each chat website (never wildcard hosts).
  // Sources: https://openai.com/chatgpt/ ; https://www.anthropic.com/claude ;
  // https://gemini.google.com/app ; https://docs.x.ai/grok/overview ;
  // https://www.deepseek.com/ ; https://www.kimi.com/en/help/new-user-guide/overview ;
  // https://qwenlm.github.io/blog/qwen3/ ; https://z.ai/ (redirects to chat.z.ai).
  const list = Object.freeze([
    {id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com/', primary: true},
    {id: 'claude', label: 'Claude', url: 'https://claude.ai/new', primary: true},
    {id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app', primary: true},
    {id: 'grok', label: 'Grok', url: 'https://grok.com/', primary: false},
    {id: 'deepseek', label: 'DeepSeek', url: 'https://chat.deepseek.com/', primary: false},
    {id: 'kimi', label: 'Kimi', url: 'https://www.kimi.com/', primary: false},
    {id: 'qwen', label: 'Qwen', url: 'https://chat.qwen.ai/', primary: false},
    {id: 'zai', label: 'Z.ai (GLM)', url: 'https://chat.z.ai/', primary: false}
  ].map(provider => Object.freeze({...provider, origins: Object.freeze([new URL(provider.url).origin + '/*'])})));
  function get(id) {
    return typeof id === 'string' ? list.find(provider => provider.id === id) || null : null;
  }
  return Object.freeze({list, get});
});
