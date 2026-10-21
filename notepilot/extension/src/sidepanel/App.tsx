import { useCallback, useEffect, useState } from 'react';
import { endpointOrigin, isAIConfigured, type Settings } from '../core/settings';
import type { EngineStatus, EngineView } from '../engine/state';
import { auth } from '../google/auth';
import { indexedDbStore } from '../storage/db';
import { useActiveDoc } from './hooks/useActiveDoc';
import { useEngine, type EngineControls } from './hooks/useEngine';
import { useSettings } from './hooks/useSettings';
import { useSummary } from './hooks/useSummary';
import { InsightsView } from './components/InsightsView';
import { NotesView, useNow } from './components/NotesView';
import { SettingsView } from './components/SettingsView';
import { Setup } from './components/Setup';
import { SourceSheet } from './components/SourceSheet';
import { Button, Logo, cx, relativeTime } from './components/ui';

type Tab = 'notes' | 'insights' | 'settings';

export function App() {
  const [settings, update] = useSettings();
  const active = useActiveDoc();
  const [view, controls] = useEngine(active.docId, settings);
  const [summary, summaryControls] = useSummary(active.docId);
  const [tab, setTab] = useState<Tab>('notes');
  const [sourceUnit, setSourceUnit] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ id: string; nonce: number } | null>(null);

  const showSource = useCallback((id: string) => setSourceUnit(id), []);
  const clearScrollTarget = useCallback(() => setScrollTarget(null), []);
  // Test hook, compiled only into the end-to-end build.
  if (import.meta.env.VITE_E2E_FAKE_AUTH === '1') (window as unknown as { __npView?: EngineView | null }).__npView = view;
  const goToSection = useCallback((id: string) => {
    setTab('notes');
    setScrollTarget({ id, nonce: Date.now() });
  }, []);

  if (!settings) return null;

  const consentValid = !!settings.consent && settings.consent.endpointOrigin === endpointOrigin(settings.ai);
  const needsSetup =
    !isAIConfigured(settings.ai) || !consentValid || (view?.status === 'needs_auth' && !view.organized.rootSections.length) || (!!view && view.status === 'starting' && !view.blocks.length && !consentValid);

  return (
    <div className="flex h-full flex-col">
      <Header view={view} title={view?.organized.title || view?.title || ''} tab={tab} setTab={setTab} insightCount={view?.insights.length ?? 0} />
      {view && !needsSetup && <StatusBanner view={view} settings={settings} update={update} controls={controls} docId={active.docId} openSettings={() => setTab('settings')} />}
      {!active.activeTabIsDoc && active.docId && view && (
        <div className="border-b border-ink-100 bg-ink-50 px-4 py-1.5 text-[11.5px] text-ink-500 dark:border-ink-900 dark:bg-ink-900 dark:text-ink-400">
          {active.activeTabIsCompanion
            ? `This tab is NotePilot's Google Doc. Showing your notes, “${view.title}”.`
            : `Showing “${view.title}”. Switch to a Google Doc tab to follow it.`}
        </div>
      )}
      <main className="np-scroll relative flex-1">
        {!active.docId ? (
          tab === 'settings' ? (
            <SettingsView settings={settings} update={update} view={null} docId={null} onRebuild={() => undefined} />
          ) : (
            <NoDocument />
          )
        ) : tab === 'settings' ? (
          <SettingsView settings={settings} update={update} view={view} docId={active.docId} onRebuild={controls.rebuild} />
        ) : !view ? (
          <Loading />
        ) : tab === 'insights' ? (
          <InsightsView view={view} settings={settings} onGo={goToSection} />
        ) : needsSetup ? (
          <Setup view={view} settings={settings} update={update} onSignedIn={controls.syncNow} />
        ) : (
          <NotesView view={view} settings={settings} onShowSource={showSource} scrollTarget={scrollTarget} onScrollTargetHandled={clearScrollTarget} summary={summary} summaryControls={summaryControls} />
        )}
      </main>
      {sourceUnit && view && <SourceSheet view={view} unitId={sourceUnit} onClose={() => setSourceUnit(null)} />}
    </div>
  );
}

const STATUS: Record<EngineStatus, { label: string; dot: string; pulse?: boolean }> = {
  starting: { label: 'Connecting', dot: 'bg-ink-300' },
  live: { label: 'Live', dot: 'bg-emerald-500' },
  checking: { label: 'Checking', dot: 'bg-emerald-500' },
  pending: { label: 'Changes', dot: 'bg-amber-400', pulse: true },
  rewriting: { label: 'Updating', dot: 'bg-accent-500', pulse: true },
  paused: { label: 'Paused', dot: 'bg-ink-300' },
  needs_setup: { label: 'Setup', dot: 'bg-ink-300' },
  needs_consent: { label: 'Setup', dot: 'bg-ink-300' },
  needs_approval: { label: 'Waiting', dot: 'bg-ink-300' },
  excluded: { label: 'Excluded', dot: 'bg-ink-300' },
  budget: { label: 'Limit', dot: 'bg-amber-500' },
  needs_auth: { label: 'Sign in', dot: 'bg-red-500' },
  offline: { label: 'Offline', dot: 'bg-ink-400' },
  error: { label: 'Retrying', dot: 'bg-red-500' },
};

function Header({ view, title, tab, setTab, insightCount }: { view: EngineView | null; title: string; tab: Tab; setTab: (t: Tab) => void; insightCount: number }) {
  const now = useNow(5000);
  const st = view ? STATUS[view.status] : null;
  const tooltip = view ? `${view.statusDetail}${view.lastCheckedAt ? ` · checked ${relativeTime(view.lastCheckedAt, now)}` : ''}${view.role === 'follower' ? ' · mirrored from another window' : ''}` : '';
  return (
    <header className="shrink-0 border-b border-ink-100 dark:border-ink-900">
      <div className="flex items-center gap-2 px-4 pt-3">
        <Logo className="h-[18px] w-[18px] shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink-800 dark:text-ink-100" title={title}>
          {title || 'NotePilot AI'}
        </span>
        {st && (
          <span title={tooltip} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-200 px-2 py-0.5 text-[11px] font-medium text-ink-600 dark:border-ink-800 dark:text-ink-300" role="status" aria-label={tooltip}>
            <span className={cx('h-1.5 w-1.5 rounded-full', st.dot, st.pulse && 'animate-pulse')} />
            {st.label}
          </span>
        )}
      </div>
      <nav className="mt-2 flex gap-4 px-4" role="tablist" aria-label="Sections">
        {(
          [
            ['notes', 'Notes'],
            ['insights', 'Insights'],
            ['settings', 'Settings'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cx(
              'np-focus -mb-px border-b-2 pb-2 text-[12.5px] font-medium transition-colors',
              tab === id ? 'border-ink-900 text-ink-900 dark:border-ink-100 dark:text-ink-50' : 'border-transparent text-ink-400 hover:text-ink-700 dark:hover:text-ink-200',
            )}
          >
            {label}
            {id === 'insights' && insightCount > 0 && <span className="ml-1 rounded-full bg-ink-100 px-1.5 text-[10.5px] tabular-nums text-ink-500 dark:bg-ink-800 dark:text-ink-400">{insightCount}</span>}
          </button>
        ))}
      </nav>
    </header>
  );
}

function StatusBanner({
  view,
  settings,
  update,
  controls,
  docId,
  openSettings,
}: {
  view: EngineView;
  settings: Settings;
  update: (fn: (s: Settings) => Settings) => void;
  controls: EngineControls;
  docId: string | null;
  openSettings: () => void;
}) {
  let action: { label: string; run: () => void } | null = null;
  let tone: 'neutral' | 'warn' | 'error' = 'neutral';
  switch (view.status) {
    case 'needs_auth':
      tone = 'error';
      action = { label: 'Sign in', run: () => void auth.getToken(true).then(controls.syncNow, () => undefined) };
      break;
    case 'error':
      tone = 'error';
      action = { label: 'Retry now', run: controls.syncNow };
      break;
    case 'offline':
      action = { label: 'Retry', run: controls.syncNow };
      break;
    case 'paused':
      action = { label: 'Resume', run: () => update((s) => ({ ...s, autoProcess: true })) };
      break;
    case 'needs_approval':
      action = docId ? { label: 'Organize this doc', run: () => update((s) => ({ ...s, privacy: { ...s.privacy, approvedDocs: [...s.privacy.approvedDocs, docId] } })) } : null;
      break;
    case 'excluded':
      action = docId ? { label: 'Include', run: () => update((s) => ({ ...s, privacy: { ...s.privacy, excludedDocs: s.privacy.excludedDocs.filter((d) => d !== docId) } })) } : null;
      break;
    case 'budget':
      tone = 'warn';
      action = { label: 'Settings', run: openSettings };
      break;
    default:
      return null;
  }
  void settings;
  return (
    <div
      role="status"
      className={cx(
        'flex items-center gap-2 border-b px-4 py-2 text-[11.5px]',
        tone === 'error' && 'border-red-100 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200',
        tone === 'warn' && 'border-amber-100 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
        tone === 'neutral' && 'border-ink-100 bg-ink-50 text-ink-600 dark:border-ink-900 dark:bg-ink-900 dark:text-ink-300',
      )}
    >
      <span className="min-w-0 flex-1">{view.statusDetail}</span>
      {action && (
        <Button size="sm" variant="secondary" onClick={action.run}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-2 px-4 py-6" aria-hidden>
      {[60, 90, 75, 85].map((w, i) => (
        <div key={i} className="h-2.5 animate-pulse rounded bg-ink-100 dark:bg-ink-800" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function NoDocument() {
  const [recent, setRecent] = useState<{ docId: string; title: string; updatedAt: number }[]>([]);
  useEffect(() => {
    void indexedDbStore.list().then((l) => setRecent(l.slice(0, 6)), () => undefined);
  }, []);
  return (
    <div className="px-6 py-14 text-center">
      <Logo className="mx-auto h-8 w-8" />
      <p className="mt-4 text-[13.5px] font-medium text-ink-800 dark:text-ink-100">Open a Google Doc to begin</p>
      <p className="mx-auto mt-1 max-w-[260px] text-[12px] leading-relaxed text-ink-400">
        NotePilot follows the Google Doc in your current tab and keeps an organized, rewritten copy here. Your document is never changed.
      </p>
      {recent.length > 0 && (
        <div className="mt-8 text-left">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Recent</p>
          <ul className="space-y-0.5">
            {recent.map((r) => (
              <li key={r.docId}>
                <button
                  type="button"
                  onClick={() => void chrome.tabs.create({ url: `https://docs.google.com/document/d/${r.docId}/edit` })}
                  className="np-focus flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12.5px] text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-900"
                >
                  <span className="truncate">{r.title || 'Untitled document'}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-ink-400">{relativeTime(r.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
