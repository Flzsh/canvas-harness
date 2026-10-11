/* Canvas Harness — controlled provider tabs; explicit insertion only. GPL-3.0-only. */
(function (root) {
  'use strict';
  // A service worker can simply importScripts('ai-web.js'). Explicitly importing
  // ai-providers.js and ai-inject.js first also works. No provider content scripts
  // or page listeners are installed, and no text is stored for future insertion.
  if (typeof root.importScripts === 'function') {
    if (!root.CanvasHarnessProviders) root.importScripts('ai-providers.js');
    if (!root.CanvasHarnessInject) root.importScripts('ai-inject.js');
  } else if (typeof module === 'object' && module.exports) {
    if (!root.CanvasHarnessProviders) root.CanvasHarnessProviders = require('./ai-providers.js');
    if (!root.CanvasHarnessInject) root.CanvasHarnessInject = require('./ai-inject.js');
  }
  const locks = new Map();
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
  async function createBrowserTab(chrome, source, url, staged = true) {
    // Service workers otherwise use the last active window, which can be a
    // standalone provider app. Read the live Canvas tab in case it was moved.
    const canvas = await chrome.tabs.get(source);
    const sourceWindow = await chrome.windows.get(canvas.windowId);
    const initialURL = staged ? 'about:blank' : url;
    let tab;
    if (sourceWindow.type === 'normal') {
      tab = await chrome.tabs.create({url: initialURL, active: true, windowId: canvas.windowId, openerTabId: source});
    } else {
      const window = await chrome.windows.create({url: initialURL, type: 'normal', focused: true, incognito: Boolean(canvas.incognito)});
      tab = window?.tabs?.[0];
    }
    if (!tabId(tab?.id) || !await normalWindow(chrome, tab) || Boolean(tab.incognito) !== Boolean(canvas.incognito)) {
      throw Object.assign(new Error('Expected a normal browser tab'), {code: 'browser-window'});
    }
    // Navigate an already-created browser tab rather than handing a website
    // link to an app launcher. No context is ever part of this URL.
    if (staged) tab = await chrome.tabs.update(tab.id, {url, active: true});
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
  async function open(chrome, key, source, provider) {
    const existing = await storedTarget(chrome, key, source, provider);
    if (existing) {
      await focus(chrome, existing.tab);
      return reply('opened', provider.label + ' is open. Sign in if needed, then return to Canvas to insert a draft.');
    }
    const tab = await createBrowserTab(chrome, source, provider.url);
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
  // Parent MUST validate the Canvas sender origin and current account before
  // calling this method, and only dispatch inject from an explicit user click.
  // These additional checks reject malformed callers and provider/target spoofing.
  async function handle(message, sender, {canShare = () => true} = {}) {
    const chrome = root.chrome;
    const provider = message && root.CanvasHarnessProviders && root.CanvasHarnessProviders.get(message.provider);
    if (!message || message.type !== 'ch-ai-web' || !['status', 'open', 'inject'].includes(message.action) || !provider) {
      return reply('error', 'Unsupported provider website request.');
    }
    if (!chrome || !chrome.storage || !chrome.storage.session || !sender || !sender.tab || !tabId(sender.tab.id) ||
        (sender.frameId !== undefined && sender.frameId !== 0) || (sender.id && sender.id !== chrome.runtime.id)) {
      return reply('error', 'Open this tool from the main Canvas tab.');
    }
    if (message.text !== undefined && (typeof message.text !== 'string' || message.text.length > 140000)) {
      return reply('error', 'Context must be plain text with at most 140000 characters.');
    }
    if (message.action === 'inject' && (typeof message.text !== 'string' || !message.text.trim())) {
      return reply('error', 'Select some context before inserting a draft.');
    }
    const source = sender.tab.id, key = keyFor(source, provider);
    try {
      if (message.action === 'open') return await serial(key, () => open(chrome, key, source, provider));
      if (message.action === 'status') {
        if (!await permissionGranted(chrome, provider)) return reply('needs-permission', 'Draft insertion needs optional access to ' + provider.label + '. Click Insert draft to open the permission page.');
        const target = await storedTarget(chrome, key, source, provider);
        return target ? reply('opened', provider.label + ' is ready for an explicit draft insertion.') : reply('error', 'Open ' + provider.label + ' from this Canvas tab first.');
      }
      return await serial(key, async () => {
        if (!await permissionGranted(chrome, provider)) {
          await openPermissionPage(chrome, source, provider);
          return reply('needs-permission', 'Grant optional draft insertion access on the permission page, then return to Canvas and click Send again.');
        }
        if (!chrome.scripting || !root.CanvasHarnessInject) return reply('error', 'AI insertion code is unavailable. Reload the extension and refresh Canvas, or use Copy.');
        if (!canShare()) return reply('error', 'The Canvas selection changed. Review it and click Send again.');
        // Text exists only in this explicit request. Never put it in the URL,
        // session storage, a future content script, or a clipboard without a click.
        const saved = (await chrome.storage.session.get(key))[key];
        if (!saved) {
          const opened = await open(chrome, key, source, provider);
          if (opened.status !== 'opened') return opened;
        }
        let last = reply('no-editor', 'The chat is not ready. Finish signing in, then return to Canvas Harness and click Send again.');
        const attempts = typeof root.setTimeout === 'function' ? 40 : 1;
        let focused=false;
        for (let attempt = 0; attempt < attempts; attempt++) {
          if (!canShare()) return reply('error', 'The Canvas selection changed. Nothing more was inserted.');
          const target = await storedTarget(chrome, key, source, provider);
          if (!target) {
            // Only wait for the fresh tab created by this click. An existing tab
            // changing origin or navigating must be explicitly reopened.
            if (saved) return reply('error', 'The provider is no longer in a ready browser tab. Click Open website / sign in to open a regular browser tab, then try Send again.');
          } else if (target.tab.status !== 'loading') {
            if(!focused){await focus(chrome, target.tab);focused=true;}
            if (!canShare()) return reply('error', 'The Canvas selection changed. Click Send again.');
            if (!await storedTarget(chrome, key, source, provider)) return reply('error', 'The provider browser tab changed before insertion. Reopen the website and try Send again.');
            const results = await chrome.scripting.executeScript({
              target: {tabId: target.tab.id, frameIds: [0]}, world: 'ISOLATED',
              func: root.CanvasHarnessInject.insertDraft,
              args: [message.text, {id: provider.id, origin: target.saved.origin, expectedURL: target.tab.url, autoSend:message.autoSend===true}]
            });
            const result = results && results.length === 1 && results[0].frameId === 0 && results[0].result;
            if (!result || !['injected', 'sent', 'send-uncertain', 'no-editor', 'error'].includes(result.status) || typeof result.message !== 'string') return reply('error', 'The provider page did not confirm insertion. Review the page before retrying.');
            last = reply(result.status, result.message);
            if (result.status !== 'no-editor' || !result.retryable) return last;
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
  const api = Object.freeze({handle});
  root.CanvasHarnessWeb = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
