import { memo, useState } from 'react';
import type { Insight, InsightCategory } from '../../core/types';
import { CATEGORY_ORDER } from '../../core/insights';
import type { EngineView } from '../../engine/state';
import type { Settings } from '../../core/settings';
import { Markdown } from './Markdown';
import { Badge, Icon, cx, relativeTime, type IconName } from './ui';
import { useNow } from './NotesView';

const META: Record<InsightCategory, { label: string; icon: IconName; tone: string }> = {
  error: { label: 'Possible errors', icon: 'warn', tone: 'text-red-600 dark:text-red-400' },
  connection: { label: 'Connections', icon: 'connection', tone: 'text-accent-600 dark:text-accent-300' },
  deeper: { label: 'Deeper explanations', icon: 'deeper', tone: 'text-violet-600 dark:text-violet-300' },
  gap: { label: 'Knowledge gaps', icon: 'gap', tone: 'text-amber-600 dark:text-amber-400' },
  practice: { label: 'Active learning', icon: 'practice', tone: 'text-emerald-600 dark:text-emerald-400' },
};

export function InsightsView({ view, settings, onGo }: { view: EngineView; settings: Settings; onGo: (sectionId: string) => void }) {
  const [filter, setFilter] = useState<InsightCategory | 'all'>('all');
  const now = useNow(10_000);
  const counts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, view.insights.filter((i) => i.category === c).length])) as Record<InsightCategory, number>;
  const shown = view.insights.filter((i) => filter === 'all' || i.category === filter);
  const latest = Math.max(0, ...view.insights.map((i) => i.updatedAt));

  if (settings.insightDepth === 'off') {
    return <p className="px-6 py-16 text-center text-[12.5px] text-ink-400">Insights are turned off. You can enable them in Settings.</p>;
  }

  return (
    <div className="px-4 pb-16 pt-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11.5px] text-ink-400">
          {view.insightsBusy ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" /> Updating insights…
            </span>
          ) : view.insights.length ? (
            `Updated ${relativeTime(latest, now)}`
          ) : (
            ''
          )}
        </p>
        <Badge tone="neutral" title="Insights are written by AI from your organized notes; no external sources were consulted.">
          AI-generated
        </Badge>
      </div>

      {view.insights.length > 0 && (
        <div className="-mx-1 mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Insight categories">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            All {view.insights.length}
          </Chip>
          {CATEGORY_ORDER.filter((c) => counts[c]).map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
              {META[c].label} {counts[c]}
            </Chip>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-[13px] font-medium text-ink-700 dark:text-ink-200">{view.organized.rootSections.length ? 'Insights will appear shortly' : 'No insights yet'}</p>
          <p className="mx-auto mt-1 max-w-[250px] text-[12px] text-ink-400">
            Connections, likely mistakes, knowledge gaps and practice questions appear here once your notes have some content.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((i) => (
            <InsightCard key={i.id} insight={i} view={view} fresh={now - (view.recent[i.id] ?? 0) < 30_000} onGo={onGo} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        'np-focus rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        active ? 'border-ink-900 bg-ink-900 text-white dark:border-ink-100 dark:bg-ink-100 dark:text-ink-900' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800',
      )}
    >
      {children}
    </button>
  );
}

const InsightCard = memo(function InsightCard({ insight, view, fresh, onGo }: { insight: Insight; view: EngineView; fresh: boolean; onGo: (id: string) => void }) {
  const [reveal, setReveal] = useState(false);
  const meta = META[insight.category];
  const sections = insight.sectionIds.map((id) => view.organized.sections[id]).filter(Boolean);
  return (
    <article
      className={cx(
        'rounded-lg border bg-white px-3 py-2.5 dark:bg-ink-900/60',
        insight.category === 'error'
          ? insight.severity === 'high'
            ? 'border-red-200 dark:border-red-500/30'
            : 'border-amber-200 dark:border-amber-500/30'
          : 'border-ink-150 border-ink-200/80 dark:border-ink-800',
      )}
    >
      <header className="flex items-center gap-1.5">
        <span className={meta.tone}>
          <Icon name={meta.icon} className="h-3.5 w-3.5" />
        </span>
        <span className={cx('text-[10.5px] font-semibold uppercase tracking-wide', meta.tone)}>{meta.label.replace(/s$/, '')}</span>
        {fresh && <span className="h-1.5 w-1.5 rounded-full bg-accent-500" title="New or updated" />}
        <span className="flex-1" />
        {insight.needsVerification && (
          <Badge tone="amber" title="States facts beyond your notes that were not checked against an external source">
            Unverified
          </Badge>
        )}
        {insight.category === 'error' && insight.severity && <Badge tone={insight.severity === 'high' ? 'red' : 'amber'}>{insight.severity}</Badge>}
      </header>
      <h3 className="mt-1.5 text-[13px] font-semibold leading-snug text-ink-900 dark:text-ink-50">{insight.title}</h3>
      <div className="mt-1">
        <Markdown text={insight.body} className="np-prose-sm" />
      </div>
      {insight.question && (
        <div className="mt-2 rounded-md bg-emerald-50/70 px-2.5 py-2 dark:bg-emerald-500/[0.07]">
          <Markdown text={insight.question.prompt} className="np-prose-sm" />
          {insight.question.answer &&
            (reveal ? (
              <div className="mt-1.5 border-t border-emerald-200/60 pt-1.5 dark:border-emerald-500/20">
                <Markdown text={insight.question.answer} className="np-prose-sm" />
              </div>
            ) : (
              <button type="button" onClick={() => setReveal(true)} className="np-focus mt-1 text-[11.5px] font-medium text-emerald-700 hover:underline dark:text-emerald-300">
                Show answer
              </button>
            ))}
        </div>
      )}
      {sections.length > 0 && (
        <footer className="mt-2 flex flex-wrap items-center gap-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onGo(s.id)}
              className="np-focus inline-flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
            >
              <Icon name="link" className="h-3 w-3" /> {s.title}
            </button>
          ))}
          <span className="ml-auto text-[10.5px] text-ink-400">{insight.confidence} confidence</span>
        </footer>
      )}
    </article>
  );
});
