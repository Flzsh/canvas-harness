/**
 * Activity signal for adaptive polling.
 *
 * Runs in Google Docs frames (including the hidden text-input iframe) and reports only *that*
 * the user is typing — never what they type. It does not read document content, does not
 * touch focus/selection, and never prevents or alters events. The side panel uses the signal to
 * poll the Docs API sooner while you type and to detect pauses in typing.
 */
(() => {
  const w = window as Window & { __notepilotActivity?: boolean };
  if (w.__notepilotActivity) return;
  w.__notepilotActivity = true;

  const THROTTLE_MS = 1000;
  let last = 0;
  let pendingTrailing: ReturnType<typeof setTimeout> | null = null;

  const send = (msg: { type: string; at: number; hidden?: boolean }) => {
    try {
      chrome.runtime.sendMessage(msg).catch(() => undefined);
    } catch {
      // Extension reloaded or side panel closed: nothing to do.
    }
  };

  const onActivity = () => {
    const now = Date.now();
    if (now - last >= THROTTLE_MS) {
      last = now;
      send({ type: 'np-activity', at: now });
    } else if (!pendingTrailing) {
      // Trailing signal so the panel learns when the *last* keystroke happened.
      pendingTrailing = setTimeout(() => {
        pendingTrailing = null;
        last = Date.now();
        send({ type: 'np-activity', at: last });
      }, THROTTLE_MS);
    }
  };

  for (const type of ['keydown', 'paste', 'cut', 'drop', 'compositionend']) {
    window.addEventListener(type, onActivity, { capture: true, passive: true });
  }

  if (window === window.top) {
    document.addEventListener('visibilitychange', () => send({ type: 'np-visibility', at: Date.now(), hidden: document.hidden }));
  }
})();
