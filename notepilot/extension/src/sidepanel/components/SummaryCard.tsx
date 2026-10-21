import type { ReactNode } from 'react';
import type { SummarySection } from '../../core/summary';
import type { OrganizedDoc } from '../../core/types';
import type { SummaryState } from '../hooks/useSummary';
import { Markdown } from './Markdown';
import { Icon, cx, relativeTime, sectionHeadingClass, type IconName } from './ui';

/** The on-demand summary shown at the top of the organized notes, with the companion Google Doc. */
export function SummaryCard({
  state,
  doc,
  now,
  onRefresh,
  onGo,
  onClose,
}: {
  state: SummaryState;
  doc: OrganizedDoc;
  now: number;
  onRefresh: () => void;
  onGo: (sectionId: string) => void;
  onClose: () => void;
}) {
  const { summary, phase, error, docError, exportDoc } = state;
  const stale = !!summary && summary.orgVersion !== doc.version;
  const busy = phase !== 'idle';
  const showSummary = !!summary && phase !== 'summarizing';
  const iconButton = 'np-focus rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-40 dark:hover:bg-ink-800 dark:hover:text-ink-200';

  return (
    <section
      aria-label="Summary"
      data-testid="summary-card"
      className="mx-4 mt-3 overflow-hidden rounded-xl border border-ink-200/80 bg-white font-sans shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_20px_-10px_rgba(0,0,0,0.12)] dark:border-ink-800 dark:bg-ink-900/40 dark:shadow-none"
    >
      <header className="flex items-center gap-2.5 border-b border-ink-100 bg-ink-50/70 px-3.5 py-2 dark:border-ink-800 dark:bg-ink-900/60">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-50 text-accent-600 ring-1 ring-accent-100 dark:bg-accent-500/10 dark:text-accent-300 dark:ring-accent-500/20">
          <Icon name="summary" className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="text-[13px] font-semibold text-ink-900 dark:text-ink-50">Summary</h2>
          <p className="truncate text-[10.5px] text-ink-400">
            {phase === 'summarizing' ? 'Reading your organized notes…' : summary ? `AI-generated from your notes · ${relativeTime(summary.createdAt, now)}` : 'AI-generated from your notes'}
          </p>
        </div>
        {summary && (
          <button type="button" onClick={onRefresh} disabled={busy} title="Make a new summary" aria-label="Make a new summary" className={iconButton}>
            <Icon name="refresh" />
          </button>
        )}
        <button type="button" onClick={onClose} title="Hide summary" aria-label="Hide summary" className={iconButton}>
          <Icon name="close" />
        </button>
      </header>

      {stale && showSummary && (
        <p className="flex items-center gap-1.5 border-b border-amber-200/70 bg-amber-50 px-3.5 py-1.5 text-[11.5px] text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          <Icon name="warn" className="h-3 w-3 shrink-0" />
          <span className="flex-1">Your notes changed since this summary.</span>
          <button type="button" onClick={onRefresh} disabled={busy} className="np-focus font-semibold underline underline-offset-2 disabled:opacity-50">
            Update
          </button>
        </p>
      )}

      {(phase === 'summarizing' || error || showSummary) && (
        <div className="px-3.5 pb-4 pt-3">
          {phase === 'summarizing' && <Skeleton />}
          {error && <p className="text-[12px] text-red-700 dark:text-red-300">{error}</p>}

          {showSummary && (
            <div className="space-y-5">
              <div className="rounded-r-md border-l-[3px] border-amber-300 bg-amber-50/60 px-3 py-2 dark:border-amber-400/60 dark:bg-amber-400/5">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700/80 dark:text-amber-300/80">In short</p>
                <Markdown text={summary.overview} markFills={false} />
              </div>

              <div>
                {summary.sections.map((s) => (
                  <SummarySectionRow key={s.sectionId} section={s} live={!!doc.sections[s.sectionId]} onGo={onGo} />
                ))}
              </div>

              {(summary.keyTerms.length > 0 || summary.review.length > 0) && (
                <div className="space-y-4 border-t border-dashed border-ink-200 pt-4 dark:border-ink-800">
                  {summary.keyTerms.length > 0 && (
                    <div>
                      <Eyebrow icon="summary">Key terms</Eyebrow>
                      <div className="np-prose mt-1.5 overflow-x-auto">
                        <table className="!my-0">
                          <tbody>
                            {summary.keyTerms.map((t, i) => {
                              const target = t.sectionIds.find((id) => doc.sections[id]);
                              return (
                                <tr key={i}>
                                  <td className="w-[38%] font-semibold">
                                    {target ? (
                                      <button type="button" className="np-focus text-left hover:underline hover:underline-offset-2" onClick={() => onGo(target)} title={`Go to “${doc.sections[target].title}”`}>
                                        {t.term}
                                      </button>
                                    ) : (
                                      t.term
                                    )}
                                  </td>
                                  <td>
                                    <Markdown text={t.definition} className="np-inline" markFills={false} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {summary.review.length > 0 && (
                    <div>
                      <Eyebrow icon="gap">Review next</Eyebrow>
                      <ul className="mt-1.5 space-y-1.5">
                        {summary.review.map((r, i) => (
                          <li key={i} className="flex gap-2 rounded-md bg-amber-50/60 px-2.5 py-1.5 ring-1 ring-amber-200/60 dark:bg-amber-400/5 dark:ring-amber-400/20">
                            <Icon name="gap" className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                            <div className="min-w-0">
                              <Markdown text={r.text} className="np-prose-sm np-inline" markFills={false} />
                              <SectionChips ids={r.sectionIds} doc={doc} onGo={onGo} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(summary || busy || docError || exportDoc) && (
        <footer className="flex items-center gap-2 border-t border-ink-100 bg-ink-50/70 px-3.5 py-2 text-[11.5px] dark:border-ink-800 dark:bg-ink-900/60">
          <Icon name="doc" className="h-4 w-4 shrink-0" />
          {phase === 'saving' ? (
            <span className="flex flex-1 items-center gap-1.5 text-ink-500" role="status">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-500" /> Saving to Google Docs…
            </span>
          ) : docError ? (
            <span className="flex-1 text-amber-800 dark:text-amber-200">{docError}</span>
          ) : exportDoc ? (
            <>
              <span className="min-w-0 flex-1 truncate text-ink-600 dark:text-ink-300">Saved to Google Docs · {relativeTime(exportDoc.updatedAt, now)}</span>
              <a
                href={exportDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="np-focus inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-200 bg-white px-2 py-0.5 font-medium text-ink-800 shadow-sm hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:bg-ink-800"
              >
                Open <Icon name="external" className="h-3 w-3" />
              </a>
            </>
          ) : (
            <span className="flex-1 text-ink-500">Not saved to Google Docs yet.</span>
          )}
        </footer>
      )}
    </section>
  );
}

function Eyebrow({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <h3 className="m-0 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
      <Icon name={icon} className="h-3 w-3" />
      {children}
    </h3>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-12 animate-pulse rounded-md bg-amber-50 dark:bg-amber-400/5" />
      {[38, 92, 74, 30, 86].map((w, i) => (
        <div key={i} className={cx('h-2.5 animate-pulse rounded bg-ink-100 dark:bg-ink-800', (i === 0 || i === 3) && 'h-3.5')} style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

function SectionChips({ ids, doc, onGo }: { ids: string[]; doc: OrganizedDoc; onGo: (id: string) => void }) {
  const live = ids.filter((id) => doc.sections[id]);
  if (!live.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {live.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onGo(id)}
          title={`Go to “${doc.sections[id].title}”`}
          className="np-focus max-w-[11rem] truncate rounded bg-white px-1.5 py-px text-[10.5px] font-medium text-accent-700 ring-1 ring-ink-200 hover:bg-accent-50 dark:bg-ink-950 dark:text-accent-300 dark:ring-ink-700 dark:hover:bg-ink-800"
        >
          {doc.sections[id].title}
        </button>
      ))}
    </span>
  );
}

/**
 * One section of the summary, laid out like the same section in the organized notes. Subsections
 * hang off a thin guide line (padding, not margins, and flow-root so list margins stay inside: the line runs unbroken).
 */
function SummarySectionRow({ section: s, live, onGo }: { section: SummarySection; live: boolean; onGo: (id: string) => void }) {
  const Tag = s.depth === 1 ? 'h3' : s.depth === 2 ? 'h4' : 'h5';
  const heading = (
    <>
      {s.number && <span className="mr-1 font-normal tabular-nums text-ink-300 dark:text-ink-600">{s.number}</span>}
      <span className="min-w-0 flex-1">{s.title}</span>
    </>
  );
  return (
    <div
      data-testid="summary-section"
      className={cx('flow-root', s.depth === 1 ? 'mt-5 first:mt-0' : 'border-l border-ink-200/80 pl-3 pt-3 dark:border-ink-800')}
      style={s.depth > 1 ? { marginLeft: (s.depth - 2) * 12 + 2 } : undefined}
    >
      <Tag className={cx('m-0 flex items-baseline gap-1', sectionHeadingClass(s.depth))}>
        {live ? (
          <button type="button" onClick={() => onGo(s.sectionId)} title="Go to this section in your notes" className="np-focus flex min-w-0 flex-1 items-baseline gap-1 rounded text-left hover:underline hover:decoration-ink-300 hover:underline-offset-4">
            {heading}
          </button>
        ) : (
          heading
        )}
      </Tag>
      {s.content && (
        <div className="mt-1.5">
          <Markdown text={s.content} markFills={false} />
        </div>
      )}
    </div>
  );
}
