import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { OrgSection, OrgUnit, OrganizedDoc, SourceBlock } from '../../core/types';
import { UNSORTED_SECTION_ID } from '../../core/types';
import type { Settings } from '../../core/settings';
import type { EngineView } from '../../engine/state';
import { loadCollapsed, saveCollapsed } from '../../storage/settingsStore';
import { Markdown } from './Markdown';
import { SummaryCard } from './SummaryCard';
import type { SummaryControls, SummaryState } from '../hooks/useSummary';
import { Badge, Icon, Segmented, cx, relativeTime, sectionHeadingClass } from './ui';

const FRESH_MS = 30_000;

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

type Row =
  | { kind: 'section'; id: string; depth: number; section: OrgSection; collapsed: boolean; fresh: boolean; number: string }
  | { kind: 'unit'; id: string; depth: number; unit: OrgUnit; fresh: boolean };

function buildRows(doc: OrganizedDoc, collapsed: Set<string>, recent: Record<string, number>, now: number, showExpansions: boolean, highlight: boolean): Row[] {
  const rows: Row[] = [];
  const isFresh = (id: string) => highlight && now - (recent[id] ?? 0) < FRESH_MS;
  const subtreeFresh = (id: string): boolean => {
    const s = doc.sections[id];
    return !!s && (s.units.some(isFresh) || s.children.some(subtreeFresh));
  };
  const visit = (id: string, depth: number, number: string) => {
    const s = doc.sections[id];
    if (!s) return;
    const isCollapsed = collapsed.has(id);
    rows.push({ kind: 'section', id, depth, section: s, collapsed: isCollapsed, fresh: subtreeFresh(id), number });
    if (isCollapsed) return;
    for (const uid of s.units) {
      const u = doc.units[uid];
      if (!u || (u.origin === 'expansion' && !showExpansions)) continue;
      rows.push({ kind: 'unit', id: uid, depth, unit: u, fresh: isFresh(uid) });
    }
    s.children.forEach((c, i) => visit(c, depth + 1, `${number}.${i + 1}`));
  };
  let n = 0;
  doc.rootSections.forEach((id) => visit(id, 1, id === UNSORTED_SECTION_ID ? '' : String(++n)));
  return rows;
}

export function NotesView({
  view,
  settings,
  onShowSource,
  scrollTarget,
  onScrollTargetHandled,
  summary,
  summaryControls,
}: {
  view: EngineView;
  settings: Settings;
  onShowSource: (unitId: string) => void;
  scrollTarget: { id: string; nonce: number } | null;
  onScrollTargetHandled: () => void;
  summary: SummaryState;
  summaryControls: SummaryControls;
}) {
  const [mode, setMode] = useState<'organized' | 'original'>('organized');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  useEffect(() => setSummaryOpen(false), [view.docId]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const now = useNow(5000);
  const doc = view.organized;

  useEffect(() => {
    let alive = true;
    void loadCollapsed(view.docId).then((ids) => alive && setCollapsed(new Set(ids)));
    return () => {
      alive = false;
    };
  }, [view.docId]);

  const toggle = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        void saveCollapsed(view.docId, [...next]);
        return next;
      });
    },
    [view.docId],
  );

  const rows = useMemo(
    () => buildRows(doc, collapsed, view.recent, now, settings.display.showExpansions, settings.display.highlightUpdates),
    [doc, collapsed, view.recent, now, settings.display.showExpansions, settings.display.highlightUpdates],
  );

  // Navigation from the outline or from an insight: expand ancestors, then scroll (never focus).
  const pendingScroll = useRef<string | null>(null);
  const goTo = useCallback(
    (id: string) => {
      setMode('organized');
      const sectionId = doc.sections[id] ? id : doc.units[id]?.sectionId;
      if (!sectionId) return;
      setCollapsed((prev) => {
        const next = new Set(prev);
        let s: string | null = sectionId;
        while (s) {
          next.delete(s);
          s = doc.sections[s]?.parentId ?? null;
        }
        return next;
      });
      pendingScroll.current = doc.units[id] ? `np-unit-${id}` : `np-sec-${id}`;
    },
    [doc],
  );
  // Each navigation request is handled exactly once (not again on later updates or remounts).
  const handled = useRef(0);
  useEffect(() => {
    if (!scrollTarget || scrollTarget.nonce === handled.current) return;
    handled.current = scrollTarget.nonce;
    goTo(scrollTarget.id);
    onScrollTargetHandled();
  }, [scrollTarget, goTo, onScrollTargetHandled]);
  useLayoutEffect(() => {
    if (!pendingScroll.current) return;
    const el = document.getElementById(pendingScroll.current);
    pendingScroll.current = null;
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  const unitCount = Object.keys(doc.units).length;
  const titleIsRootHeading = doc.rootSections.length === 1 && doc.sections[doc.rootSections[0]]?.title.trim().toLowerCase() === (doc.title || view.title).trim().toLowerCase();
  const empty = doc.rootSections.length === 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink-100 bg-white/90 px-4 py-2 backdrop-blur dark:border-ink-900 dark:bg-ink-950/90">
        <Segmented
          size="sm"
          label="Notes view"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'organized', label: 'Organized' },
            { value: 'original', label: 'Original' },
          ]}
        />
        <div className="flex-1" />
        {!empty && (
          <button
            type="button"
            onClick={() => {
              setMode('organized');
              setSummaryOpen(true);
              summaryControls.run(view, settings);
            }}
            disabled={summary.phase !== 'idle'}
            title="Summarize these notes and save everything to a Google Doc"
            className={cx(
              'np-focus inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium disabled:opacity-60',
              summaryOpen ? 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-white' : 'text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800',
            )}
          >
            <Icon name="summary" /> {summary.phase === 'idle' ? 'Summarize' : summary.phase === 'summarizing' ? 'Summarizing…' : 'Saving…'}
          </button>
        )}
        {mode === 'organized' && !empty && (
          <button
            type="button"
            onClick={() => setOutlineOpen((o) => !o)}
            aria-expanded={outlineOpen}
            className={cx(
              'np-focus inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium',
              outlineOpen ? 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-white' : 'text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800',
            )}
          >
            <Icon name="outline" /> Outline
          </button>
        )}
      </div>

      {mode === 'organized' && outlineOpen && !empty && <Outline doc={doc} recent={view.recent} now={now} onGo={goTo} />}
      {mode === 'organized' && summaryOpen && !empty && (
        <SummaryCard
          state={summary}
          doc={doc}
          now={now}
          onRefresh={() => summaryControls.run(view, settings, { force: true })}
          onGo={goTo}
          onClose={() => setSummaryOpen(false)}
        />
      )}

      {mode === 'original' ? (
        <OriginalView blocks={view.blocks} doc={doc} onGo={goTo} />
      ) : empty ? (
        <EmptyNotes view={view} />
      ) : (
        <article className="px-4 pb-16 pt-4" aria-live="off">
          <header className="mb-4">
            {!titleIsRootHeading && <h1 className="font-sans text-[19px] font-semibold leading-tight tracking-[-0.01em] text-ink-900 dark:text-ink-50">{doc.title || view.title}</h1>}
            <p className={cx('text-[11.5px] text-ink-400', !titleIsRootHeading && 'mt-1')}>
              Updated {relativeTime(doc.updatedAt, now)} · {unitCount} {unitCount === 1 ? 'note' : 'notes'} from “{view.title}”
            </p>
          </header>
          {rows.map((r) =>
            r.kind === 'section' ? (
              <SectionRow key={r.id} id={r.id} title={r.section.title} depth={r.depth} number={r.number} collapsed={r.collapsed} fresh={r.fresh} onToggle={toggle} unsorted={r.id === UNSORTED_SECTION_ID} />
            ) : (
              <UnitRow key={r.id} unit={r.unit} depth={r.depth} fresh={r.fresh} showLabels={settings.display.showOriginLabels} onShowSource={onShowSource} />
            ),
          )}
        </article>
      )}
    </div>
  );
}

function EmptyNotes({ view }: { view: EngineView }) {
  const hasNotes = view.blocks.length > 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      {hasNotes && (view.status === 'rewriting' || view.status === 'pending' || view.status === 'starting') ? (
        <>
          <div className="mb-4 w-full max-w-[260px] space-y-2" aria-hidden>
            {[80, 95, 60, 88].map((w, i) => (
              <div key={i} className="h-2.5 animate-pulse rounded bg-ink-100 dark:bg-ink-800" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
          <p className="text-[13px] font-medium text-ink-700 dark:text-ink-200">Organizing your notes…</p>
          <p className="mt-1 text-[12px] text-ink-400">Reading {view.blocks.length} passages from your document.</p>
        </>
      ) : hasNotes ? (
        <>
          <p className="text-[13px] font-medium text-ink-700 dark:text-ink-200">Your notes are ready to organize</p>
          <p className="mt-1 max-w-[260px] text-[12px] text-ink-400">{view.statusDetail}. Your original notes are available under “Original”.</p>
        </>
      ) : (
        <>
          <p className="text-[13px] font-medium text-ink-700 dark:text-ink-200">Start typing in your Google Doc</p>
          <p className="mt-1 max-w-[250px] text-[12px] leading-relaxed text-ink-400">
            Write naturally — fragments and shorthand are fine. A rewritten, organized version will build itself here.
          </p>
        </>
      )}
    </div>
  );
}

const SectionRow = memo(function SectionRow({
  id,
  title,
  depth,
  number,
  collapsed,
  fresh,
  onToggle,
  unsorted,
}: {
  id: string;
  title: string;
  depth: number;
  number: string;
  collapsed: boolean;
  fresh: boolean;
  onToggle: (id: string) => void;
  unsorted: boolean;
}) {
  const Tag = depth === 1 ? 'h2' : depth === 2 ? 'h3' : 'h4';
  return (
    <div id={`np-sec-${id}`} className={cx('group scroll-mt-12', depth === 1 ? 'mt-6 first:mt-0' : depth === 2 ? 'mt-4' : 'mt-3')} style={{ paddingLeft: (depth - 1) * 10 }}>
      <Tag className="m-0">
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={!collapsed}
          className={cx(
            'np-focus -ml-4 flex w-[calc(100%+1rem)] items-baseline gap-1 rounded text-left',
            sectionHeadingClass(depth),
            unsorted && 'text-ink-500 dark:text-ink-400',
          )}
        >
          <span className={cx('w-4 shrink-0 self-center text-ink-300 transition-transform dark:text-ink-600', collapsed ? '' : 'rotate-90', !collapsed && 'opacity-0 group-hover:opacity-100')}>
            <Icon name="chevron" className="h-3 w-3" />
          </span>
          {number && <span className="mr-1 font-normal tabular-nums text-ink-300 dark:text-ink-600">{number}</span>}
          <span className="min-w-0 flex-1">{title}</span>
          {fresh && <span className="ml-1 h-1.5 w-1.5 shrink-0 self-center rounded-full bg-accent-500" title="Recently updated" />}
        </button>
      </Tag>
      {unsorted && !collapsed && <p className="mt-1 text-[11.5px] text-ink-400">Notes shown as written until the next pass organizes them.</p>}
    </div>
  );
});

const ORIGIN_LABEL = { clarification: 'Clarified', expansion: 'AI expansion · unverified' } as const;

const UnitRow = memo(function UnitRow({
  unit,
  depth,
  fresh,
  showLabels,
  onShowSource,
}: {
  unit: OrgUnit;
  depth: number;
  fresh: boolean;
  showLabels: boolean;
  onShowSource: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    // A soft, one-off highlight when this passage changes. No layout shift, no focus change.
    const isFirst = first.current;
    first.current = false;
    if (!fresh || (isFirst && Date.now() - unit.updatedAt > 8000)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ref.current?.animate([{ backgroundColor: 'rgba(250, 204, 21, 0.20)' }, { backgroundColor: 'rgba(250, 204, 21, 0)' }], { duration: 3500, easing: 'ease-out' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.updatedAt]);

  const expansion = unit.origin === 'expansion';
  const clarification = unit.origin === 'clarification';
  return (
    <div
      id={`np-unit-${unit.id}`}
      ref={ref}
      data-origin={unit.origin}
      className={cx(
        'group/unit relative mt-2 scroll-mt-12 rounded-md',
        expansion && showLabels && 'border border-violet-200/70 bg-violet-50/60 px-3 py-2 dark:border-violet-500/20 dark:bg-violet-500/[0.06]',
        clarification && showLabels && 'border-l-2 border-sky-300 pl-3 dark:border-sky-500/50',
        unit.needsReview && 'border border-dashed border-ink-200 px-3 py-2 dark:border-ink-700',
        unit.type === 'callout' && !expansion && 'border-l-2 border-amber-300 bg-amber-50/50 px-3 py-2 dark:bg-amber-400/5',
        unit.type === 'definition' && !expansion && !clarification && 'pl-0',
      )}
      style={{ marginLeft: (depth - 1) * 10 }}
    >
      {fresh && <span className="absolute -left-3 top-2 h-1.5 w-1.5 rounded-full bg-accent-500" title="Recently updated" />}
      {showLabels && (expansion || clarification) && (
        <div className="mb-1">
          <Badge tone={expansion ? 'violet' : 'sky'} title={expansion ? 'Background added by AI, not from your notes, and not checked against a source' : 'Wording added by AI to clarify your note'}>
            {ORIGIN_LABEL[unit.origin as 'clarification' | 'expansion']}
          </Badge>
        </div>
      )}
      <div className={cx(unit.needsReview && 'italic text-ink-500')}>
        <Markdown text={unit.content} markFills={showLabels} />
      </div>
      {unit.uncertain && (
        <p className="mt-1.5 flex items-start gap-1.5 font-sans text-[11.5px] leading-snug text-amber-700 dark:text-amber-300">
          <Icon name="warn" className="mt-px h-3 w-3 shrink-0" />
          <span>
            <span className="font-semibold">Ambiguous in your notes:</span> {unit.uncertain}
          </span>
        </p>
      )}
      <button
        type="button"
        onClick={() => onShowSource(unit.id)}
        title="Show the original passages this came from"
        aria-label="Show source passages"
        className="np-focus absolute -right-1 top-0 rounded p-1 text-ink-300 opacity-0 transition-opacity hover:bg-ink-100 hover:text-ink-700 focus-visible:opacity-100 group-hover/unit:opacity-100 dark:text-ink-600 dark:hover:bg-ink-800 dark:hover:text-ink-200"
      >
        <Icon name="source" />
      </button>
    </div>
  );
});

function Outline({ doc, recent, now, onGo }: { doc: OrganizedDoc; recent: Record<string, number>; now: number; onGo: (id: string) => void }) {
  const items: { id: string; depth: number; title: string; fresh: boolean }[] = [];
  const visit = (id: string, depth: number) => {
    const s = doc.sections[id];
    if (!s) return;
    const fresh = s.units.some((u) => now - (recent[u] ?? 0) < FRESH_MS);
    items.push({ id, depth, title: s.title, fresh });
    s.children.forEach((c) => visit(c, depth + 1));
  };
  doc.rootSections.forEach((id) => visit(id, 1));
  return (
    <nav aria-label="Outline" className="border-b border-ink-100 bg-ink-50/60 px-4 py-2 dark:border-ink-900 dark:bg-ink-900/40">
      <ul className="space-y-px">
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => onGo(it.id)}
              className={cx(
                'np-focus flex w-full items-center gap-1.5 truncate rounded px-1.5 py-[3px] text-left hover:bg-white dark:hover:bg-ink-800',
                it.depth === 1 ? 'text-[12px] font-medium text-ink-800 dark:text-ink-100' : 'text-[11.5px] text-ink-500 dark:text-ink-400',
              )}
              style={{ paddingLeft: 6 + (it.depth - 1) * 12 }}
            >
              <span className="truncate">{it.title}</span>
              {it.fresh && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function OriginalView({ blocks, doc, onGo }: { blocks: SourceBlock[]; doc: OrganizedDoc; onGo: (id: string) => void }) {
  const citing = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const u of Object.values(doc.units)) for (const s of u.sources) (m.get(s) ?? m.set(s, []).get(s)!).push(u.id);
    return m;
  }, [doc]);
  if (!blocks.length) return <p className="px-4 py-10 text-center text-[12px] text-ink-400">The document is empty.</p>;
  return (
    <div className="px-4 pb-16 pt-3">
      <p className="mb-3 text-[11.5px] text-ink-400">Read-only view of your Google Doc as NotePilot sees it. NotePilot never edits it.</p>
      <ol className="space-y-1.5">
        {blocks.map((b) => {
          const units = citing.get(b.id) ?? [];
          return (
            <li key={b.id} className="group flex items-start gap-2">
              <div
                className={cx(
                  'min-w-0 flex-1 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-700 dark:text-ink-300',
                  b.kind === 'heading' && 'font-semibold text-ink-900 dark:text-ink-100',
                  b.kind === 'list_item' && 'before:mr-1 before:content-["•"]',
                  b.kind === 'table' && 'overflow-x-auto whitespace-pre text-[11px]',
                )}
                style={b.kind === 'list_item' ? { paddingLeft: (b.level ?? 0) * 12 } : undefined}
              >
                {b.text}
              </div>
              {units.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onGo(units[0])}
                  title={`Used in ${units.length} organized ${units.length === 1 ? 'passage' : 'passages'}`}
                  className="np-focus mt-0.5 shrink-0 rounded px-1 text-[10.5px] font-medium tabular-nums text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
                >
                  ↗ {units.length}
                </button>
              ) : (
                b.kind !== 'heading' && <span title="Not organized yet" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
