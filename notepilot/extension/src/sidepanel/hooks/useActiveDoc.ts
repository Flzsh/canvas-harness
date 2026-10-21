import { useEffect, useState } from 'react';
import { classifyTab } from '../../core/companion';
import { extrasStore } from '../../storage/db';

export interface ActiveDoc {
  docId: string | null;
  tabId: number | null;
  /** False when the active tab is not a Google Doc (the panel keeps showing the last doc). */
  activeTabIsDoc: boolean;
  /** The active tab is NotePilot's own companion doc: the panel shows the notes it was made from instead. */
  activeTabIsCompanion: boolean;
}

/**
 * Follows the Google Doc in the active tab of this panel's window. `?doc=<id>` pins the panel to
 * one document (used by "open in tab" and by the end-to-end tests). NotePilot's own companion doc
 * is never followed as notes; the panel shows the notes it was made from.
 */
export function useActiveDoc(): ActiveDoc {
  const pinned = new URLSearchParams(location.search).get('doc');
  const [state, setState] = useState<ActiveDoc>({ docId: pinned, tabId: null, activeTabIsDoc: !!pinned, activeTabIsCompanion: false });

  useEffect(() => {
    if (pinned) return;
    let windowId: number | undefined;
    let alive = true;
    let latest = 0;

    const consider = async (tab: chrome.tabs.Tab | undefined) => {
      if (!alive || !tab || (windowId !== undefined && tab.windowId !== windowId)) return;
      const seq = ++latest;
      const t = await classifyTab(tab, (id) => extrasStore.sourceOfCompanion(id));
      if (!alive || seq !== latest) return; // a later tab change won
      setState((prev) =>
        t.kind === 'doc'
          ? { docId: t.docId, tabId: tab.id ?? null, activeTabIsDoc: true, activeTabIsCompanion: false }
          : t.kind === 'companion'
            ? { ...prev, ...(t.sourceDocId && t.sourceDocId !== prev.docId ? { docId: t.sourceDocId, tabId: null } : {}), activeTabIsDoc: false, activeTabIsCompanion: true }
            : { ...prev, activeTabIsDoc: false, activeTabIsCompanion: false },
      );
    };

    void (async () => {
      const win = await chrome.windows.getCurrent();
      windowId = win.id;
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      void consider(tab);
    })();

    const onActivated = (info: { tabId: number; windowId: number }) => {
      if (windowId !== undefined && info.windowId !== windowId) return;
      chrome.tabs.get(info.tabId).then(consider, () => undefined);
    };
    const onUpdated = (_id: number, change: { url?: string; status?: string }, tab: chrome.tabs.Tab) => {
      if (tab.active && (change.url || change.status === 'complete')) void consider(tab);
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      alive = false;
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [pinned]);

  return state;
}
