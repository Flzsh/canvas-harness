/* Canvas Harness — optional permissions requested only from this page's click. MIT. */
(function (root) {
  'use strict';
  const byId = id => document.getElementById(id);
  const name = byId('provider-name'), origin = byId('provider-origin'), status = byId('permission-status');
  const grant = byId('grant-access'), revoke = byId('revoke-access'), close = byId('close-page');
  const params = new URLSearchParams(location.search);
  const provider = root.CanvasHarnessProviders.get(params.get('provider'));
  let busy = false;
  close.addEventListener('click', () => { window.close(); });
  if (!provider || params.getAll('provider').length !== 1 || Array.from(params.keys()).some(key => key !== 'provider')) {
    grant.disabled = true; revoke.hidden = true;
    status.textContent = 'Unsupported provider. Close this page and choose a provider in Canvas.';
    return;
  }
  name.textContent = provider.label;
  origin.textContent = new URL(provider.url).hostname;
  const request = {permissions: ['scripting'], origins: Array.from(provider.origins)};
  function display(allowed, message) {
    busy = false;
    grant.disabled = allowed; grant.hidden = allowed;
    revoke.hidden = !allowed; revoke.disabled = !allowed;
    status.textContent = message;
  }
  grant.addEventListener('click', async () => {
    if (busy || grant.disabled) return;
    busy = true; grant.disabled = true;
    try {
      // IMPORTANT: invoke request synchronously from the button listener,
      // before any await, storage lookup, or message round trip loses the gesture.
      const pending = chrome.permissions.request(request);
      const allowed = await pending;
      display(allowed, allowed ? 'Access allowed. Return to Canvas and click Insert draft again to transfer your selected context.' : 'Access was not granted. You can allow it here later, or copy and paste your context manually.');
    } catch (_) {
      display(false, 'The browser could not grant access. Reload the extension with its optional permissions configured, then try this button again.');
    }
  });
  revoke.addEventListener('click', async () => {
    if (busy || revoke.disabled) return;
    busy = true; revoke.disabled = true;
    try {
      // Keep shared scripting permission for other providers; remove only this
      // website's host permission. This is sufficient to prevent further access.
      const removed = await chrome.permissions.remove({origins: Array.from(provider.origins)});
      if (removed) display(false, 'This provider’s draft insertion access was removed. You can still open its website and paste manually.');
      else display(true, 'The browser did not remove access. Check the extension’s website permissions in browser settings.');
    } catch (_) { display(true, 'Access could not be removed here. Check the extension’s website permissions in browser settings.'); }
  });
  chrome.permissions.contains(request).then(allowed => {
    if (!busy) display(allowed, allowed ? 'Access is already allowed. Return to Canvas and click Insert draft when ready.' : 'Optional access is off. Click Allow draft insertion to ask the browser for this provider only.');
  }, () => { if (!busy) display(false, 'Access could not be checked. Click Allow draft insertion to ask the browser.'); });
})(globalThis);
