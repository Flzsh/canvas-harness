import { useEffect, useState, type ReactNode } from 'react';
import { endpointOrigin, type Settings } from '../../core/settings';
import { toMarkdown } from '../../core/export';
import type { DailyUsage } from '../../ai/usage';
import { percentile, type EngineView } from '../../engine/state';
import { auth } from '../../google/auth';
import { indexedDbStore } from '../../storage/db';
import { clearAllLocalSettingsData } from '../../storage/settingsStore';
import { usage } from '../runtime';
import { AIConnectionForm, Field, inputCls } from './AIConnectionForm';
import { Button, Icon, Segmented, Switch } from './ui';

function Card({ title, children, description }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-100 px-4 py-4 dark:border-ink-900">
      <h2 className="text-[12.5px] font-semibold text-ink-900 dark:text-ink-50">{title}</h2>
      {description && <p className="mt-0.5 text-[11.5px] text-ink-400">{description}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12.5px] text-ink-800 dark:text-ink-200">{label}</p>
        {hint && <p className="text-[11px] leading-snug text-ink-400">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const ms = (v: number | null) => (v === null ? '—' : v < 1000 ? `${v} ms` : `${(v / 1000).toFixed(1)} s`);

export function SettingsView({
  settings,
  update,
  view,
  docId,
  onRebuild,
}: {
  settings: Settings;
  update: (fn: (s: Settings) => Settings) => void;
  view: EngineView | null;
  docId: string | null;
  onRebuild: () => void;
}) {
  const [today, setToday] = useState<DailyUsage>(usage.get());
  const [copied, setCopied] = useState(false);
  useEffect(() => usage.subscribe(setToday), []);

  const s = settings;
  const origin = endpointOrigin(s.ai);
  const excluded = !!docId && s.privacy.excludedDocs.includes(docId);
  const approved = !!docId && s.privacy.approvedDocs.includes(docId);
  const m = view?.metrics;

  const exportMd = () => (view ? toMarkdown(view.organized, { insights: view.insights, includeExpansions: s.display.showExpansions }) : '');
  const copy = async () => {
    await navigator.clipboard.writeText(exportMd());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const download = () => {
    const blob = new Blob([exportMd()], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(view?.organized.title || view?.title || 'notes').replace(/[^\w\- ]+/g, '').trim() || 'notes'} (organized).md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="pb-16">
      <Card title="Processing">
        <Row label="Automatic processing" hint="Rewrite and organize while you type">
          <Switch label="Automatic processing" checked={s.autoProcess} onChange={(v) => update((x) => ({ ...x, autoProcess: v }))} />
        </Row>
        <Row label="Update frequency" hint="How often the document is checked for changes">
          <Segmented
            size="sm"
            label="Update frequency"
            value={s.frequency}
            onChange={(frequency) => update((x) => ({ ...x, frequency }))}
            options={[
              { value: 'realtime', label: 'Fast' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'saver', label: 'Saver' },
            ]}
          />
        </Row>
      </Card>

      <Card title="Writing">
        <Row label="Rewriting intensity">
          <Segmented
            size="sm"
            label="Rewriting intensity"
            value={s.rewriteIntensity}
            onChange={(rewriteIntensity) => update((x) => ({ ...x, rewriteIntensity }))}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'thorough', label: 'Thorough' },
            ]}
          />
        </Row>
        <Row label="Level of detail">
          <Segmented
            size="sm"
            label="Level of detail"
            value={s.detailLevel}
            onChange={(detailLevel) => update((x) => ({ ...x, detailLevel }))}
            options={[
              { value: 'concise', label: 'Concise' },
              { value: 'standard', label: 'Standard' },
              { value: 'detailed', label: 'Detailed' },
            ]}
          />
        </Row>
        <Row label="Finish incomplete notes" hint="Finish: completes cut-off sentences. Develop: also writes out ideas you started but didn’t explain. Added words are highlighted.">
          <Segmented
            size="sm"
            label="Finish incomplete notes"
            value={s.completion}
            onChange={(completion) => update((x) => ({ ...x, completion }))}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'finish', label: 'Finish' },
              { value: 'develop', label: 'Develop' },
            ]}
          />
        </Row>
        <Field label="Academic subject" hint="Optional. Helps expand abbreviations correctly (e.g. “AP Biology”, “Organic Chemistry”)." htmlFor="np-subject">
          <input id="np-subject" className={inputCls} value={s.subject} maxLength={80} onChange={(e) => update((x) => ({ ...x, subject: e.target.value }))} placeholder="Inferred from your notes" />
        </Field>
        <Row label="AI expansions" hint="Let AI add background and examples (labelled, kept separate from your notes)">
          <Switch label="AI expansions" checked={s.aiExpansion} onChange={(v) => update((x) => ({ ...x, aiExpansion: v }))} />
        </Row>
        <p className="text-[11px] text-ink-400">Writing changes apply to new updates. Use “Rebuild” below to rewrite everything with the new settings.</p>
      </Card>

      <Card title="Insights">
        <Row label="Insight depth">
          <Segmented
            size="sm"
            label="Insight depth"
            value={s.insightDepth}
            onChange={(insightDepth) => update((x) => ({ ...x, insightDepth }))}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'brief', label: 'Brief' },
              { value: 'standard', label: 'Standard' },
              { value: 'deep', label: 'Deep' },
            ]}
          />
        </Row>
      </Card>

      <Card title="Display">
        <Row label="Label AI clarifications & expansions">
          <Switch label="Label AI content" checked={s.display.showOriginLabels} onChange={(v) => update((x) => ({ ...x, display: { ...x.display, showOriginLabels: v } }))} />
        </Row>
        <Row label="Show AI expansions">
          <Switch label="Show AI expansions" checked={s.display.showExpansions} onChange={(v) => update((x) => ({ ...x, display: { ...x.display, showExpansions: v } }))} />
        </Row>
        <Row label="Highlight recent updates">
          <Switch label="Highlight recent updates" checked={s.display.highlightUpdates} onChange={(v) => update((x) => ({ ...x, display: { ...x.display, highlightUpdates: v } }))} />
        </Row>
      </Card>

      <Card title="AI model" description={origin ? `Currently: ${origin}` : undefined}>
        <AIConnectionForm settings={s} update={update} />
      </Card>

      <Card title="Cost limits">
        <Field label="Daily budget (USD)" hint="Processing pauses when today's estimated cost reaches this amount. 0 = no limit." htmlFor="np-budget">
          <input
            id="np-budget"
            type="number"
            min={0}
            step={0.25}
            className={inputCls}
            value={s.dailyBudgetUSD}
            onChange={(e) => update((x) => ({ ...x, dailyBudgetUSD: Math.max(0, Number(e.target.value) || 0) }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Input $ / 1M tokens" htmlFor="np-pin">
            <input id="np-pin" type="number" min={0} step={0.05} className={inputCls} value={s.ai.inputPricePerM} onChange={(e) => update((x) => ({ ...x, ai: { ...x.ai, inputPricePerM: Math.max(0, Number(e.target.value) || 0) } }))} />
          </Field>
          <Field label="Output $ / 1M tokens" htmlFor="np-pout">
            <input id="np-pout" type="number" min={0} step={0.05} className={inputCls} value={s.ai.outputPricePerM} onChange={(e) => update((x) => ({ ...x, ai: { ...x.ai, outputPricePerM: Math.max(0, Number(e.target.value) || 0) } }))} />
          </Field>
        </div>
        <p className="text-[11px] text-ink-400">Prices are estimates — set them to your provider's current rates.</p>
        <dl className="grid grid-cols-3 gap-2 rounded-md bg-ink-50 px-3 py-2 text-center dark:bg-ink-900">
          <Stat label="Today" value={`$${today.costUSD.toFixed(3)}`} />
          <Stat label="Requests" value={String(today.requests)} />
          <Stat label="Tokens" value={`${((today.promptTokens + today.completionTokens) / 1000).toFixed(1)}k`} />
        </dl>
      </Card>

      <Card title="Privacy">
        <Row label="AI consent" hint={s.consent ? `Notes may be sent to ${s.consent.endpointOrigin} (since ${new Date(s.consent.at).toLocaleDateString()})` : 'Not granted — nothing is sent'}>
          {s.consent && (
            <Button size="sm" variant="secondary" onClick={() => update((x) => ({ ...x, consent: null }))}>
              Revoke
            </Button>
          )}
        </Row>
        <Row label="Redact contact details" hint="Emails, phone and ID numbers are replaced before text is sent">
          <Switch label="Redact contact details" checked={s.privacy.redactPII} onChange={(v) => update((x) => ({ ...x, privacy: { ...x.privacy, redactPII: v } }))} />
        </Row>
        <Row label="Save organized notes on this device" hint="Off: kept only while the panel is open">
          <Switch label="Save organized notes" checked={s.privacy.storeLocally} onChange={(v) => update((x) => ({ ...x, privacy: { ...x.privacy, storeLocally: v } }))} />
        </Row>
        <Row label="Ask before processing a new document">
          <Switch label="Per-document approval" checked={s.privacy.perDocApproval} onChange={(v) => update((x) => ({ ...x, privacy: { ...x.privacy, perDocApproval: v } }))} />
        </Row>
        {docId && s.privacy.perDocApproval && (
          <Row label="This document is approved">
            <Switch
              label="Approve this document"
              checked={approved}
              onChange={(v) =>
                update((x) => ({ ...x, privacy: { ...x.privacy, approvedDocs: v ? [...x.privacy.approvedDocs, docId] : x.privacy.approvedDocs.filter((d) => d !== docId) } }))
              }
            />
          </Row>
        )}
        {docId && (
          <Row label="Never process this document">
            <Switch
              label="Exclude this document"
              checked={excluded}
              onChange={(v) =>
                update((x) => ({ ...x, privacy: { ...x.privacy, excludedDocs: v ? [...x.privacy.excludedDocs, docId] : x.privacy.excludedDocs.filter((d) => d !== docId) } }))
              }
            />
          </Row>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <ConfirmButton
            variant="danger"
            label="Delete local data"
            confirmLabel="Delete all organized notes?"
            onConfirm={async () => {
              await indexedDbStore.clearAll();
              await clearAllLocalSettingsData();
              location.reload();
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => void auth.signOut().then(() => location.reload())}>
            Sign out of Google
          </Button>
        </div>
      </Card>

      <Card title="Organized notes">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void copy()} disabled={!view?.organized.rootSections.length}>
            <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copied' : 'Copy as Markdown'}
          </Button>
          <Button size="sm" variant="secondary" onClick={download} disabled={!view?.organized.rootSections.length}>
            <Icon name="download" /> Download .md
          </Button>
          <ConfirmButton variant="secondary" label="Rebuild" confirmLabel="Rewrite everything?" onConfirm={onRebuild} disabled={!view} icon="refresh" />
        </div>
        <p className="text-[11px] text-ink-400">Exports are separate files. NotePilot never writes to your Google Doc.</p>
      </Card>

      {view && m && (
        <Card title="Diagnostics">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px]">
            <Diag label="Change → sidebar (p50 / p90)" value={`${ms(percentile(m.detectToRender, 50))} / ${ms(percentile(m.detectToRender, 90))}`} />
            <Diag label="Keystroke → sidebar (p50 / p90)" value={`${ms(percentile(m.typeToRender, 50))} / ${ms(percentile(m.typeToRender, 90))}`} />
            <Diag label="Model latency (p50)" value={ms(percentile(m.aiLatency, 50))} />
            <Diag label="Poll interval" value={ms(view.pollIntervalMs)} />
            <Diag label="Docs API requests / min" value={String(view.docsRequestsPerMin)} />
            <Diag label="Pending changes" value={String(view.pendingChanges)} />
            <Diag label="Stale results rejected" value={String(m.staleRejected)} />
            <Diag label="Requests cancelled" value={String(m.cancelled)} />
            <Diag label="Integrity repairs" value={String(m.repairs)} />
            <Diag label="Verbatim fallbacks" value={String(m.fallbacks)} />
            <Diag label="Cache hits today" value={String(today.cacheHits)} />
            <Diag label="This panel" value={view.role === 'leader' ? 'syncing' : 'mirroring another window'} />
          </dl>
        </Card>
      )}
    </div>
  );
}

/** Two-step button (no blocking browser dialogs). */
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  variant,
  disabled,
  icon,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  variant: 'danger' | 'secondary';
  disabled?: boolean;
  icon?: 'refresh';
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      size="sm"
      variant={armed ? 'danger' : variant}
      disabled={disabled}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        void onConfirm();
      }}
    >
      {icon && !armed && <Icon name={icon} />} {armed ? confirmLabel : label}
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="text-[13px] font-semibold tabular-nums text-ink-800 dark:text-ink-100">{value}</dd>
    </div>
  );
}

function Diag({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-right tabular-nums text-ink-700 dark:text-ink-200">{value}</dd>
    </>
  );
}
