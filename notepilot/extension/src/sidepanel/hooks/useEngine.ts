import { useEffect, useMemo, useRef, useState } from 'react';
import { docIdFromUrl } from '../../core/docParser';
import type { Settings } from '../../core/settings';
import type { EngineView } from '../../engine/state';
import { SyncEngine } from '../../engine/syncEngine';
import { docsClient, gateFor, getSettings, pipelines, storeFor } from '../runtime';

export interface EngineControls {
  syncNow(): void;
  rebuild(): void;
}

type Msg =
  | { type: 'view'; docId: string; view: EngineView }
  | { type: 'hello'; docId: string }
  | { type: 'command'; docId: string; cmd: 'syncNow' | 'rebuild' };

/**
 * Runs the SyncEngine for the active document.
 *
 * If the same document is open in side panels of several windows, a Web Lock elects one leader
 * that polls and calls the AI; the others mirror its state over a BroadcastChannel. This prevents
 * duplicate AI calls and conflicting writes to local state. When the leader closes, a follower
 * takes over automatically.
 */
export function useEngine(docId: string | null, settings: Settings | null): [EngineView | null, EngineControls] {
  const [view, setView] = useState<EngineView | null>(null);
  const engineRef = useRef<SyncEngine | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const ready = !!settings;
  const storeLocally = settings?.privacy.storeLocally;

  useEffect(() => {
    if (!docId || !ready) return;
    setView(null);
    let cancelled = false;
    let releaseLock: () => void = () => undefined;
    const held = new Promise<void>((r) => (releaseLock = r));
    const channel = new BroadcastChannel('notepilot-sync');
    channelRef.current = channel;
    let lastBroadcast = 0;
    let broadcastTimer: ReturnType<typeof setTimeout> | null = null;

    const becomeLeader = async () => {
      const engine = new SyncEngine(docId, {
        docs: docsClient,
        ai: pipelines,
        store: storeFor(getSettings()),
        getSettings,
        gate: () => gateFor(docId),
      });
      engineRef.current = engine;
      let latest: EngineView | null = null;
      const send = () => {
        lastBroadcast = Date.now();
        broadcastTimer = null;
        if (latest) channel.postMessage({ type: 'view', docId, view: { ...latest, role: 'follower' } } satisfies Msg);
      };
      engine.subscribe((v) => {
        if (cancelled) return;
        setView(v);
        // Mirror to follower panels (throttled; the timer always sends the most recent view).
        latest = v;
        if (Date.now() - lastBroadcast > 300) send();
        else broadcastTimer ??= setTimeout(send, 300);
      });
      await engine.start();
    };

    channel.onmessage = (ev: MessageEvent<Msg>) => {
      const m = ev.data;
      if (!m || m.docId !== docId) return;
      const engine = engineRef.current;
      if (m.type === 'view' && !engine) setView(m.view);
      else if (m.type === 'hello' && engine) channel.postMessage({ type: 'view', docId, view: { ...engine.view(), role: 'follower' } } satisfies Msg);
      else if (m.type === 'command' && engine) (m.cmd === 'rebuild' ? void engine.rebuild() : engine.syncNow());
    };

    const lockName = `notepilot:${docId}`;
    if ('locks' in navigator) {
      void navigator.locks.request(lockName, async () => {
        if (cancelled) return;
        await becomeLeader();
        await held;
      });
      // Until we hold the lock, ask the current leader for its state.
      void navigator.locks.query().then((s) => {
        if (s.held?.some((l) => l.name === lockName) && !engineRef.current) channel.postMessage({ type: 'hello', docId } satisfies Msg);
      });
    } else {
      void becomeLeader();
    }

    const onMessage = (msg: { type?: string; at?: number; hidden?: boolean }, sender: chrome.runtime.MessageSender) => {
      const engine = engineRef.current;
      if (!engine || docIdFromUrl(sender.tab?.url) !== docId) return;
      if (msg.type === 'np-activity') engine.notifyActivity(Math.min(msg.at ?? Date.now(), Date.now()));
      else if (msg.type === 'np-visibility') engine.notifyVisibility(!msg.hidden);
    };
    chrome.runtime.onMessage.addListener(onMessage);
    const onOnline = () => engineRef.current?.syncNow();
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(onMessage);
      window.removeEventListener('online', onOnline);
      if (broadcastTimer) clearTimeout(broadcastTimer);
      engineRef.current?.stop();
      engineRef.current = null;
      channel.close();
      channelRef.current = null;
      releaseLock();
    };
  }, [docId, ready, storeLocally]);

  // Settings changes (consent, model, frequency…) take effect immediately.
  useEffect(() => {
    const t = setTimeout(() => engineRef.current?.syncNow(), 600);
    return () => clearTimeout(t);
  }, [settings]);

  const controls = useMemo<EngineControls>(
    () => ({
      syncNow: () => {
        if (engineRef.current) engineRef.current.syncNow();
        else if (docId) channelRef.current?.postMessage({ type: 'command', docId, cmd: 'syncNow' } satisfies Msg);
      },
      rebuild: () => {
        if (engineRef.current) void engineRef.current.rebuild();
        else if (docId) channelRef.current?.postMessage({ type: 'command', docId, cmd: 'rebuild' } satisfies Msg);
      },
    }),
    [docId],
  );

  return [view, controls];
}
