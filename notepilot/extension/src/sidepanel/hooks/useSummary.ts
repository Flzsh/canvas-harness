import { useCallback, useEffect, useRef, useState } from 'react';
import { AIError } from '../../ai/client';
import { buildSummaryMessages } from '../../core/context';
import type { Settings } from '../../core/settings';
import { isCurrentSummary, type DocSummary } from '../../core/summary';
import { hash53 } from '../../core/text';
import type { EngineView } from '../../engine/state';
import { auth, EXPORT_SCOPES } from '../../google/auth';
import { ExportError, saveAsGoogleDoc } from '../../google/driveExport';
import { extrasStore, type DocExtras } from '../../storage/db';
import { gateFor, pipelines } from '../runtime';

export type SummaryPhase = 'idle' | 'summarizing' | 'saving';

export interface SummaryState {
  summary: DocSummary | null;
  exportDoc: NonNullable<DocExtras['exportDoc']> | null;
  phase: SummaryPhase;
  /** Why the summary could not be made. */
  error: string | null;
  /** Why the Google Doc could not be saved (the summary may still be shown). */
  docError: string | null;
}

export interface SummaryControls {
  /** Summarize (when the notes changed since the last summary, or `force`) and save the Google Doc. Call from a click. */
  run(view: EngineView, settings: Settings, opts?: { force?: boolean }): void;
}

const GATE_MESSAGE: Record<string, string> = {
  not_configured: 'Connect an AI provider in Settings first.',
  no_consent: 'Allow NotePilot to send notes to your AI provider first (Settings).',
  excluded: 'This document is excluded from AI processing.',
  needs_approval: 'Approve this document for AI processing first.',
  budget: 'Daily cost limit reached. Raise it in Settings → Cost limits.',
  disabled: 'Processing is paused.',
};

const AI_MESSAGE: Record<string, string> = {
  auth: 'The AI provider rejected the API key. Check Settings → AI model.',
  rate_limit: 'The AI provider is rate-limiting requests. Try again in a minute.',
  network: 'Could not reach the AI provider. Check your connection.',
  invalid_output: 'The AI returned an unusable summary. Try again.',
  bad_request: 'The AI provider rejected the request',
  server: 'The AI provider had an error. Try again shortly.',
  aborted: 'The summary took too long. Try again.',
};

const EMPTY: SummaryState = { summary: null, exportDoc: null, phase: 'idle', error: null, docError: null };

/** On-demand summary + companion Google Doc for the active document. Works in any panel. */
export function useSummary(docId: string | null): [SummaryState, SummaryControls] {
  const [state, setState] = useState<SummaryState>(EMPTY);
  const stateRef = useRef(state);
  stateRef.current = state;
  const docRef = useRef(docId);
  docRef.current = docId;
  const exportKey = useRef<string | null>(null);

  useEffect(() => {
    setState(EMPTY);
    exportKey.current = null;
    if (!docId) return;
    let alive = true;
    void extrasStore.get(docId).then((x) => {
      if (alive && x) setState((s) => ({ ...s, summary: isCurrentSummary(x.summary) ? x.summary : null, exportDoc: x.exportDoc ?? null }));
    });
    return () => {
      alive = false;
    };
  }, [docId]);

  const run = useCallback((view: EngineView, settings: Settings, opts: { force?: boolean } = {}) => {
    if (stateRef.current.phase !== 'idle') return;
    const id = view.docId;
    const live = () => docRef.current === id;
    const patch = (p: Partial<SummaryState>) => live() && setState((s) => ({ ...s, ...p }));
    let summary = stateRef.current.summary;
    const needSummary = !!opts.force || !summary || summary.orgVersion !== view.organized.version;
    if (!view.organized.rootSections.length) return void patch({ error: 'Nothing to summarize yet.' });
    if (needSummary) {
      const gate = gateFor(id, { manual: true });
      if (!gate.ok) return void patch({ error: GATE_MESSAGE[gate.reason] ?? 'AI processing is not available.' });
    }
    // Ask for the "create Google Docs" permission right away, while this still counts as a click.
    const permission = auth.getToken(true, EXPORT_SCOPES).then(
      () => null,
      (e: unknown) => e,
    );

    void (async () => {
      if (needSummary || !summary) {
        patch({ phase: 'summarizing', error: null, docError: null });
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 90_000);
        try {
          const built = buildSummaryMessages({ organized: view.organized, insights: view.insights, settings });
          summary = (await pipelines.summary(built.messages, view.organized, ctl.signal, { fresh: !!opts.force })).summary;
        } catch (e) {
          const msg = e instanceof AIError ? `${AI_MESSAGE[e.kind] ?? 'AI error'}${e.kind === 'bad_request' ? `: ${e.message.slice(0, 120)}` : ''}` : 'Could not make the summary.';
          return patch({ phase: 'idle', error: msg });
        } finally {
          clearTimeout(timer);
        }
        if (!live()) return;
        patch({ summary });
        void persist(id, settings, summary, stateRef.current.exportDoc);
      }

      // Save the Google Doc (skipped when nothing changed since the last save).
      const key = hash53(
        JSON.stringify([view.organized.version, summary.createdAt, view.insights.map((i) => [i.id, i.updatedAt]), settings.display.showExpansions]),
      );
      if (!opts.force && key === exportKey.current && stateRef.current.exportDoc) return patch({ phase: 'idle' });
      patch({ phase: 'saving', error: null, docError: null });
      const denied = await permission;
      if (denied) return patch({ phase: 'idle', docError: 'Google Doc not saved: permission to create Google Docs was not granted. Click Summarize again to retry.' });
      try {
        // Loaded on demand: the HTML renderer is only needed when saving.
        const { buildExportHtml, exportDocName } = await import('../exportHtml');
        const html = buildExportHtml({
          organized: view.organized,
          insights: view.insights,
          summary,
          sourceTitle: view.title,
          sourceDocId: id,
          includeExpansions: settings.display.showExpansions,
        });
        const saved = await saveAsGoogleDoc({
          html,
          name: exportDocName(view.organized, view.title),
          sourceDocId: id,
          existingFileId: stateRef.current.exportDoc?.fileId,
          auth,
        });
        const exportDoc = { fileId: saved.fileId, url: saved.url, updatedAt: Date.now(), orgVersion: view.organized.version };
        exportKey.current = key;
        patch({ phase: 'idle', exportDoc });
        void persist(id, settings, summary, exportDoc);
      } catch (e) {
        patch({ phase: 'idle', docError: `Google Doc not saved: ${e instanceof ExportError ? e.message : 'unexpected error.'}` });
      }
    })();
  }, []);

  return [state, { run }];
}

async function persist(docId: string, settings: Settings, summary: DocSummary | null, exportDoc: DocExtras['exportDoc'] | null): Promise<void> {
  // The summary is note content: only kept on disk when "store organized notes on this device" is on.
  // The companion doc's id is kept either way, so later exports update the same Google Doc.
  await extrasStore
    .put({ docId, ...(settings.privacy.storeLocally && summary ? { summary } : {}), ...(exportDoc ? { exportDoc } : {}) })
    .catch(() => undefined);
}
