import { useEffect } from 'react';
import type { EngineView } from '../../engine/state';
import { Badge, Icon, relativeTime } from './ui';
import { FILL_CLASS, hasFills } from '../../core/fills';

const ORIGIN_TEXT = {
  user: ['From your notes', 'Rewritten from what you wrote.'],
  clarification: ['AI clarification', 'Your information, with minimal wording added by AI to make it understandable.'],
  expansion: ['AI expansion', 'Background added by AI that is not in your notes. It has not been checked against an external source.'],
} as const;

/** Shows the original passages behind an organized passage (source traceability, spec §10). */
export function SourceSheet({ view, unitId, onClose }: { view: EngineView; unitId: string; onClose: () => void }) {
  const unit = view.organized.units[unitId];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!unit) return null;
  const blocks = new Map(view.blocks.map((b) => [b.id, b]));
  const [label, explanation] = ORIGIN_TEXT[unit.origin];
  const section = view.organized.sections[unit.sectionId];
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Source passages">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink-950/20 dark:bg-black/40" onClick={onClose} />
      <div className="relative max-h-[70%] overflow-y-auto rounded-t-xl border-t border-ink-200 bg-white px-4 pb-5 pt-3 shadow-2xl dark:border-ink-800 dark:bg-ink-900">
        <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-ink-200 dark:bg-ink-700" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{section?.title}</p>
            <h2 className="mt-0.5 flex items-center gap-2 text-[14px] font-semibold text-ink-900 dark:text-ink-50">
              Source passages
              <Badge tone={unit.origin === 'expansion' ? 'violet' : unit.origin === 'clarification' ? 'sky' : 'neutral'}>{label}</Badge>
            </h2>
          </div>
          <button type="button" onClick={onClose} className="np-focus rounded p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-ink-500 dark:text-ink-400">{explanation}</p>
        {hasFills(unit.content) && (
          <p className="mt-1.5 text-[12px] text-ink-500 dark:text-ink-400">
            <span className={FILL_CLASS}>Highlighted words</span> were added by AI to finish something your notes left unfinished. They are not in your document.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {unit.sources.map((id) => {
            const b = blocks.get(id);
            return (
              <li key={id} className="rounded-md border border-ink-100 bg-ink-50 px-3 py-2 dark:border-ink-800 dark:bg-ink-950">
                {b ? (
                  <p className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-800 dark:text-ink-200">{b.text}</p>
                ) : (
                  <p className="text-[12px] italic text-ink-400">This passage is no longer in the document; the next update will reconcile it.</p>
                )}
              </li>
            );
          })}
        </ul>
        {unit.uncertain && (
          <p className="mt-3 text-[12px] text-amber-700 dark:text-amber-300">
            <span className="font-semibold">Ambiguity kept:</span> {unit.uncertain}
          </p>
        )}
        <p className="mt-3 text-[11px] text-ink-400">Last rewritten {relativeTime(unit.updatedAt)} · source version {unit.sourceVersion}</p>
      </div>
    </div>
  );
}
