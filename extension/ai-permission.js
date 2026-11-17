/* Canvas Harness — optional permissions requested only from this page's click. GPL-3.0-only. */
(function (root) {
  'use strict';
  const byId = id => document.getElementById(id);
  const name = byId('provider-name'), origin = byId('provider-origin'), status = byId('permission-status');
  const grant = byId('grant-access'), revoke = byId('revoke-access'), close = byId('close-page');
  const params = new URLSearchParams(location.search);
  const provider = root.CanvasHarnessProviders.get(params.get('provider'));
  let busy = false;
  // The status line carries its state (wait / off / on) so the page can draw a tick beside "Allowed".
  const say = (text, state) => { status.textContent = text; status.className = 'status is-' + state; };
  // Lines that are true of one provider only are shown for that provider alone.
  const only = id => { if (document.querySelectorAll) for (const node of document.querySelectorAll('[data-only]')) node.hidden = node.getAttribute('data-only') !== id; };
  close.addEventListener('click', () => { window.close(); });
  // ?source=google-docs: the same page asks for docs.google.com, so Help can read the Google Docs assignments link.
  // Store installs (they carry an update_url) never ask; the student pastes a Doc on its card instead.
  if (params.get('source') === 'google-docs' && Array.from(params.keys()).length === 1) {
    const origins = ['https://docs.google.com/*'], words = (allowed, text) => {
      busy = false;
      grant.hidden = grant.disabled = allowed;
      revoke.hidden = revoke.disabled = !allowed;
      say(text, allowed ? 'on' : 'off');
    };
    document.title = 'Google Docs access';
    document.getElementById('permission-title').textContent = 'Read the Google Docs your assignments link';
    for (const node of document.querySelectorAll('.route, .intro, .facts, .more')) node.hidden = true;
    grant.textContent = 'Allow'; revoke.textContent = 'Remove access'; close.textContent = 'Close';
    let store = true; try { store = !!chrome.runtime.getManifest().update_url; } catch (_) {}
    if (store) { grant.hidden = true; revoke.hidden = true; say('Paste the Doc on its card instead.', 'off'); return; }
    grant.addEventListener('click', async () => {
      if (busy || grant.disabled) return;
      busy = true; grant.disabled = true;
      // Requested inside the click, before anything awaits, so the browser keeps the gesture.
      try {
        const allowed = await chrome.permissions.request({origins});
        words(allowed, allowed ? 'Allowed. Go back to Canvas and press Read on the card again.' : 'Not allowed. You can paste the Doc on its card instead.');
      }
      catch (_) { words(false, 'The browser could not ask. You can paste the Doc on its card instead.'); }
    });
    revoke.addEventListener('click', async () => {
      if (busy || revoke.disabled) return;
      busy = true; revoke.disabled = true;
      try { const removed = await chrome.permissions.remove({origins}); words(!removed, removed ? 'Removed.' : 'The browser kept access. Check the extension’s site access in browser settings.'); }
      catch (_) { words(true, 'Access could not be removed here.'); }
    });
    chrome.permissions.contains({origins}).then(allowed => { if (!busy) words(allowed, allowed ? 'Allowed.' : 'Not allowed yet.'); }, () => { if (!busy) words(false, 'Not allowed yet.'); });
    return;
  }
  if (!provider || params.getAll('provider').length !== 1 || Array.from(params.keys()).some(key => key !== 'provider')) {
    grant.disabled = true; revoke.hidden = true; only('');
    say('Unsupported provider. Close this page and choose one in Canvas.', 'off');
    return;
  }
  name.textContent = provider.label;
  origin.textContent = new URL(provider.url).hostname;
  only(provider.id);
  const request = {permissions: ['scripting'], origins: Array.from(provider.origins)};
  function display(allowed, message) {
    busy = false;
    grant.disabled = allowed; grant.hidden = allowed;
    revoke.hidden = !allowed; revoke.disabled = !allowed;
    say(message, allowed ? 'on' : 'off');
  }
  grant.addEventListener('click', async () => {
    if (busy || grant.disabled) return;
    busy = true; grant.disabled = true;
    try {
      // IMPORTANT: invoke request synchronously from the button listener,
      // before any await, storage lookup, or message round trip loses the gesture.
      const pending = chrome.permissions.request(request);
      const allowed = await pending;
      display(allowed, allowed ? 'Allowed. Go back to Canvas and press Send again.' : 'Not granted. You can allow it later, or paste by hand.');
    } catch (_) {
      display(false, 'The browser could not ask. Reload the extension, then try again.');
    }
  });
  revoke.addEventListener('click', async () => {
    if (busy || revoke.disabled) return;
    busy = true; revoke.disabled = true;
    try {
      // Keep shared scripting permission for other providers; remove only this
      // website's host permission. This is sufficient to prevent further access.
      const removed = await chrome.permissions.remove({origins: Array.from(provider.origins)});
      if (removed) display(false, 'Removed. You can still paste by hand.');
      else display(true, 'The browser kept access. Check the extension’s site access in browser settings.');
    } catch (_) { display(true, 'Access could not be removed here. Check the extension’s site access in browser settings.'); }
  });
  chrome.permissions.contains(request).then(allowed => {
    if (!busy) display(allowed, allowed ? 'Allowed. Go back to Canvas and press Send.' : 'Not allowed yet.');
  }, () => { if (!busy) display(false, 'Not allowed yet.'); });
})(globalThis);
