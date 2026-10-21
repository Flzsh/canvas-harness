import type { AIPipelines } from '../ai/pipelines';
import { AIError } from '../ai/client';
import { buildInsightMessages, buildRewriteMessages } from '../core/context';
import { contentHashOf, parseDocument } from '../core/docParser';
import { assignIdentities, diffById, isEmptyDiff, type BlockDiff } from '../core/identity';
import { applyInsights, reconcileInsights } from '../core/insights';
import { applyPatch, changedBetween, checkInvariants, insertFallbackUnits } from '../core/patch';
import { insightLimits } from '../core/prompts';
import { POLL_INTERVALS, type Settings } from '../core/settings';
import { isSubstantive } from '../core/text';
import type { OrganizedDoc, SourceBlock } from '../core/types';
import { DocsApiError, type DocsSource } from '../google/docsApi';
import type { DocStore } from '../storage/db';
import { emptyDocState, pushMetric, type DocState, type EngineStatus, type EngineView } from './state';

/**
 * Continuous, autonomous synchronization for one Google Doc.
 *
 *   poll (adaptive) ──► revision changed? ──► fetch + parse ──► stable block ids ──► "current"
 *                                                                             │
 *   debounce (typing pause / max wait) ◄──────────────────────────────────────┘
 *        │
 *        ▼
 *   rewrite job (single flight, cancellable, stale-checked)
 *        │  diff(processed → current) → context → AI patch → validate/apply → coverage repair
 *        ▼
 *   organized doc committed ──► insights job (low priority, preemptible)
 *
 * The Google Doc is only ever read. All results live in the extension's own state.
 */

export type ProcessGate =
  | { ok: true }
  | { ok: false; reason: 'disabled' | 'not_configured' | 'no_consent' | 'excluded' | 'needs_approval' | 'budget' };

export interface EngineDeps {
  docs: DocsSource & { stats?: { recent: number[] } };
  ai: Pick<AIPipelines, 'rewrite' | 'insights'>;
  store: DocStore;
  getSettings: () => Settings;
  gate: () => ProcessGate;
}

/** Timing constants (ms). */
export const TIMING = {
  /** Minimum time since the last detected content change before a rewrite starts. */
  quiet: 1200,
  /** No keystroke for this long ⇒ the user paused typing. */
  typingPause: 2500,
  /** Start a rewrite at most this long after the first unprocessed change, even if typing continues. */
  maxWait: 9000,
  /** Minimum gap between Docs API polls triggered by typing activity. */
  minPollGap: 1500,
  rewriteTimeout: 90_000,
  insightsQuiet: 8000,
  maxBackoff: 120_000,
  /** Max characters of new/changed note text sent in one rewrite call (long docs are batched). */
  batchChars: 8000,
};

const GATE_STATUS: Record<Exclude<ProcessGate, { ok: true }>['reason'], [EngineStatus, string]> = {
  disabled: ['paused', 'Automatic processing is off'],
  not_configured: ['needs_setup', 'Connect an AI provider to start organizing'],
  no_consent: ['needs_consent', 'Waiting for your consent to send notes to the AI provider'],
  excluded: ['excluded', 'This document is excluded from processing'],
  needs_approval: ['needs_approval', 'Approve this document to start organizing'],
  budget: ['budget', 'Daily cost limit reached — showing the last organized version'],
};

export class SyncEngine {
  private st: DocState;
  private listeners = new Set<(v: EngineView) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private timerDueAt = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private ticking = false;
  private pollCtl: AbortController | null = null;
  private rewriteCtl: AbortController | null = null;
  private insightCtl: AbortController | null = null;
  private epoch = 0;

  private lastRevision: string | null = null;
  private cheapCheckUnsupported = false;
  private lastCheckedAt = 0;
  private lastPollAt = 0;
  private lastChangeAt = 0;
  private firstPendingAt = 0;
  private lastPollChanged = false;
  private lastActivityAt = 0;
  private catchUp = true;
  private docVisible = true;
  private backoffMs = 0;
  private aiBackoffUntil = 0;
  private aiFailures = 0;
  private lastHealAt = 0;
  private pollInterval = 0;

  private changeLog: number[] = [];

  private status: EngineStatus = 'starting';
  private statusDetail = 'Connecting to Google Docs…';
  /** Problem reading the Google Doc (cleared by the next successful poll). */
  private pollIssue: { status: EngineStatus; detail: string } | null = null;
  /** Problem with the AI provider (cleared by the next successful rewrite). */
  private aiIssue: { status: EngineStatus; detail: string } | null = null;

  constructor(
    readonly docId: string,
    private deps: EngineDeps,
  ) {
    this.st = emptyDocState(docId);
  }

  // ───────────────────────────── public API ─────────────────────────────

  async start(): Promise<void> {
    const saved = await this.deps.store.load(this.docId).catch(() => null);
    if (saved && saved.schema === 1 && checkInvariants(saved.organized).length === 0) this.st = saved;
    this.emit();
    this.schedule(0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.pollCtl?.abort();
    this.rewriteCtl?.abort();
    this.insightCtl?.abort();
    this.flushPersist();
    this.listeners.clear();
  }

  subscribe(fn: (v: EngineView) => void): () => void {
    this.listeners.add(fn);
    fn(this.view());
    return () => this.listeners.delete(fn);
  }

  /** Called when the content script reports typing in the Google Docs tab. */
  notifyActivity(at = Date.now()): void {
    this.lastActivityAt = at;
    if (this.backoffMs) return; // never shorten an error back-off (rate limits, auth, offline)
    const due = Math.max(0, this.lastPollAt + TIMING.minPollGap - Date.now());
    if (!this.ticking && this.timerDueAt - Date.now() > due + 250) this.schedule(due);
  }

  notifyVisibility(visible: boolean): void {
    this.docVisible = visible;
    if (visible && !this.backoffMs && !this.ticking) this.schedule(0);
  }

  /** Immediate check (manual refresh, network back online, settings changed, sign-in completed). */
  syncNow(): void {
    this.backoffMs = 0;
    this.aiBackoffUntil = 0;
    this.pollIssue = null;
    this.aiIssue = null;
    this.schedule(0);
  }

  /** Discards the organized version and rebuilds it from the current notes. */
  async rebuild(): Promise<void> {
    this.epoch++;
    this.rewriteCtl?.abort();
    this.insightCtl?.abort();
    const fresh = emptyDocState(this.docId);
    fresh.current = this.st.current;
    fresh.title = this.st.title;
    fresh.nextBlockId = this.st.nextBlockId;
    fresh.metrics = this.st.metrics;
    this.st = fresh;
    this.catchUp = true;
    this.persistNow();
    this.emit();
    this.schedule(0);
  }

  view(): EngineView {
    const diff = this.st.current ? diffById(this.st.processed, this.st.current.blocks) : null;
    const pending = diff ? diff.added.length + diff.modified.length + diff.removed.length : 0;
    return {
      docId: this.docId,
      title: this.st.title,
      status: this.status,
      statusDetail: this.statusDetail,
      lastCheckedAt: this.lastCheckedAt,
      lastUpdatedAt: this.st.organized.updatedAt,
      organized: this.st.organized,
      insights: this.st.insights,
      blocks: this.st.current?.blocks ?? [],
      pendingChanges: pending,
      insightsBusy: !!this.insightCtl,
      recent: this.st.recent,
      metrics: this.st.metrics,
      pollIntervalMs: this.pollInterval,
      docsRequestsPerMin: this.deps.docs.stats?.recent.filter((t) => t > Date.now() - 60_000).length ?? 0,
      role: 'leader',
    };
  }

  /** Exposed for tests / diagnostics. */
  get state(): Readonly<DocState> {
    return this.st;
  }

  // ───────────────────────────── scheduling ─────────────────────────────

  private schedule(ms: number): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timerDueAt = Date.now() + ms;
    this.timer = setTimeout(() => void this.tick(), ms);
  }

  private nextInterval(): number {
    const [active, recent, idle, background] = POLL_INTERVALS[this.deps.getSettings().frequency];
    const now = Date.now();
    const since = now - Math.max(this.lastActivityAt, this.lastChangeAt);
    let ms = since < 20_000 ? active : since < 120_000 ? recent : idle;
    // Unprocessed changes: probe again soon to confirm the user paused (revision checks are tiny).
    if (this.st.current && this.firstPendingAt && now >= this.aiBackoffUntil && this.deps.gate().ok) ms = Math.min(ms, Math.min(active, 2000));
    if (!this.docVisible) ms = Math.max(ms, background);
    if (this.backoffMs) ms = Math.max(ms, this.backoffMs);
    return ms;
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.ticking) return;
    this.ticking = true;
    this.timer = null;
    try {
      await this.poll();
      this.backoffMs = 0;
      this.pollIssue = null;
    } catch (e) {
      this.handlePollError(e);
    } finally {
      this.ticking = false;
    }
    if (this.stopped) return;
    this.maybeStartRewrite();
    this.maybeStartInsights();
    this.refreshStatus();
    this.pollInterval = this.nextInterval();
    this.schedule(this.pollInterval);
  }

  // ───────────────────────────── polling ─────────────────────────────

  private async poll(): Promise<void> {
    const ctl = new AbortController();
    this.pollCtl = ctl;
    const timeout = setTimeout(() => ctl.abort(), 20_000);
    try {
      this.lastPollAt = Date.now();
      if (this.st.current && this.lastRevision && !this.cheapCheckUnsupported) {
        let rev: string | null = null;
        try {
          rev = await this.deps.docs.getRevisionId(this.docId, ctl.signal);
        } catch (e) {
          // If the partial-response check is ever rejected, fall back to full fetches permanently.
          if (!(e instanceof DocsApiError && e.status === 400)) throw e;
          this.cheapCheckUnsupported = true;
        }
        this.lastCheckedAt = Date.now();
        if (rev && rev === this.lastRevision) {
          this.lastPollChanged = false;
          return;
        }
      }
      const raw = await this.deps.docs.getDocument(this.docId, ctl.signal);
      this.lastCheckedAt = Date.now();
      const parsed = parseDocument(raw);
      this.lastRevision = parsed.revisionId;
      const hash = contentHashOf(parsed.blocks);
      const titleChanged = parsed.title !== this.st.title;
      this.st.title = parsed.title;
      if (this.st.current && hash === this.st.current.contentHash) {
        // Revision changed without a text change (formatting, comments, …).
        this.lastPollChanged = false;
        if (titleChanged) {
          this.persistSoon();
          this.emit();
        }
        return;
      }
      // Also match against processed blocks whose removal hasn't been handled yet, so a paragraph
      // that is deleted and restored (undo) between polls keeps its identity.
      const known = this.st.current?.blocks ?? [];
      const knownIds = new Set(known.map((b) => b.id));
      const pendingRemoved = this.st.processed.filter((b) => !knownIds.has(b.id));
      const { blocks } = assignIdentities([...known, ...pendingRemoved], parsed.blocks, () => `b${this.st.nextBlockId++}`);
      const now = Date.now();
      this.st.current = {
        docId: this.docId,
        title: parsed.title,
        revisionId: parsed.revisionId,
        fetchedAt: now,
        version: (this.st.current?.version ?? 0) + 1,
        contentHash: hash,
        blocks,
      };
      this.lastChangeAt = now;
      this.changeLog.push(now);
      if (this.changeLog.length > 50) this.changeLog.shift();
      this.lastPollChanged = true;
      if (!this.firstPendingAt) this.firstPendingAt = now;
      this.persistSoon();
      this.emit();
    } finally {
      clearTimeout(timeout);
      this.pollCtl = null;
    }
  }

  private handlePollError(e: unknown): void {
    if (e instanceof DocsApiError) {
      switch (e.kind) {
        case 'auth':
          this.pollIssue = { status: 'needs_auth', detail: 'Sign in with Google to read this document' };
          this.backoffMs = 60_000;
          break;
        case 'forbidden':
          this.pollIssue = { status: 'error', detail: e.message };
          this.backoffMs = 60_000;
          break;
        case 'not_found':
          this.pollIssue = { status: 'error', detail: e.message };
          this.backoffMs = 60_000;
          break;
        case 'rate_limit':
        case 'server':
          this.backoffMs = Math.min(TIMING.maxBackoff, Math.max(e.retryAfterMs ?? 0, this.backoffMs ? this.backoffMs * 2 : 5000));
          this.pollIssue = { status: 'error', detail: `${e.message} — retrying in ${Math.round(this.backoffMs / 1000)}s` };
          break;
        case 'network':
          this.backoffMs = Math.min(60_000, this.backoffMs ? this.backoffMs * 2 : 2000);
          this.pollIssue = { status: 'offline', detail: `Offline — retrying in ${Math.round(this.backoffMs / 1000)}s` };
          break;
      }
    } else if (!(e instanceof DOMException && e.name === 'AbortError')) {
      this.backoffMs = Math.min(TIMING.maxBackoff, this.backoffMs ? this.backoffMs * 2 : 5000);
      this.pollIssue = { status: 'error', detail: e instanceof Error ? e.message : String(e) };
    }
    this.emit();
  }

  // ───────────────────────────── rewrite pipeline ─────────────────────────────

  private maybeStartRewrite(): void {
    if (this.stopped || this.rewriteCtl || !this.st.current) return;
    const now = Date.now();
    const diff = diffById(this.st.processed, this.st.current.blocks);
    const placeholders = Object.values(this.st.organized.units).some((u) => u.needsReview);

    if (isEmptyDiff(diff)) {
      this.firstPendingAt = 0;
      this.catchUp = false;
      if (placeholders && now - this.lastHealAt > 60_000 && now - this.lastChangeAt > 20_000 && this.deps.gate().ok && now >= this.aiBackoffUntil) {
        this.lastHealAt = now;
        void this.runRewrite({ added: [], modified: [], removed: [] }, true);
      }
      return;
    }
    if (now < this.aiBackoffUntil) return;

    const gate = this.deps.gate();
    if (!gate.ok) {
      // Removals need no AI: reconcile them immediately so deleted notes disappear.
      if (diff.removed.length && this.st.organized.rootSections.length) this.commitWithoutAI({ added: [], modified: [], removed: diff.removed });
      return;
    }

    if (!this.firstPendingAt) this.firstPendingAt = this.lastChangeAt || now;
    const quiet = now - this.lastChangeAt >= TIMING.quiet;
    const typingPaused = this.lastActivityAt ? now - this.lastActivityAt >= TIMING.typingPause : !this.lastPollChanged;
    const overdue = now - this.firstPendingAt >= TIMING.maxWait;
    if (!(this.catchUp || (quiet && typingPaused) || overdue)) return;

    this.catchUp = false;
    // Rewrites keep the organized notes current and take priority over optional insights.
    if (this.insightCtl) {
      this.insightCtl.abort();
      this.st.metrics.cancelled++;
    }
    void this.runRewrite(selectBatch(diff, TIMING.batchChars), false);
  }

  private async runRewrite(batch: BlockDiff, reorganizeOnly: boolean): Promise<void> {
    const current = this.st.current!;
    const settings = this.deps.getSettings();
    const job = {
      epoch: this.epoch,
      baseOrgVersion: this.st.organized.version,
      startedAt: Date.now(),
      firstPendingAt: this.firstPendingAt || Date.now(),
      activityAt: this.lastActivityAt,
    };
    const ctl = new AbortController();
    this.rewriteCtl = ctl;
    const timeout = setTimeout(() => ctl.abort(), TIMING.rewriteTimeout);
    this.refreshStatus();
    this.emit();

    const newProcessed = advanceProcessed(this.st.processed, current.blocks, batch);
    const validSourceIds = new Set(newProcessed.map((b) => b.id));
    const requiredSourceIds = newProcessed.filter((b) => b.kind !== 'heading' && isSubstantive(b.text)).map((b) => b.id);

    try {
      const built = buildRewriteMessages({ organized: this.st.organized, currentBlocks: current.blocks, batch, settings, reorganizeOnly });
      const res = await this.deps.ai.rewrite(built.messages, ctl.signal);
      if (!res.cached) pushMetric(this.st.metrics.aiLatency, res.latencyMs);
      if (this.isStale(job)) return;

      const ctx = { validSourceIds, requiredSourceIds, now: Date.now(), sourceVersion: current.version, allowExpansion: settings.aiExpansion };
      let result = applyPatch(this.st.organized, res.ops, ctx, res.title);
      let doc = result.doc;

      // Integrity: anything the patch failed to represent gets one targeted repair attempt…
      if (result.uncovered.length && this.deps.gate().ok) {
        const uncoveredBlocks = newProcessed.filter((b) => result.uncovered.includes(b.id));
        try {
          this.st.metrics.repairs++;
          const repairMsgs = buildRewriteMessages({ organized: doc, currentBlocks: current.blocks, batch: { added: [], modified: [], removed: [] }, settings, repair: uncoveredBlocks });
          const fix = await this.deps.ai.rewrite(repairMsgs.messages, ctl.signal);
          if (this.isStale(job)) return;
          result = applyPatch(doc, fix.ops, { ...ctx, now: Date.now() }, null);
          doc = result.doc;
        } catch (e) {
          if (ctl.signal.aborted) throw e;
        }
      }
      // …and whatever is still missing is shown verbatim, so no note is ever silently lost.
      if (result.uncovered.length) {
        this.st.metrics.fallbacks++;
        doc = insertFallbackUnits(
          doc,
          newProcessed.filter((b) => result.uncovered.includes(b.id)),
          Date.now(),
          current.version,
        );
      }
      this.commit(doc, newProcessed, job);
      this.aiFailures = 0;
      this.aiIssue = null;
    } catch (e) {
      if (ctl.signal.aborted && this.isStale(job)) return;
      this.handleAIError(e, batch, current.blocks);
    } finally {
      clearTimeout(timeout);
      if (this.rewriteCtl === ctl) this.rewriteCtl = null;
      if (!this.stopped) {
        this.refreshStatus();
        this.emit();
        // More changes may have arrived while the model was working.
        setTimeout(() => {
          this.maybeStartRewrite();
          this.maybeStartInsights();
          this.refreshStatus();
          this.emit();
        }, 0);
      }
    }
  }

  private isStale(job: { epoch: number; baseOrgVersion: number }): boolean {
    if (this.stopped || job.epoch !== this.epoch || this.st.organized.version !== job.baseOrgVersion) {
      this.st.metrics.staleRejected++;
      return true;
    }
    return false;
  }

  private commit(doc: OrganizedDoc, newProcessed: SourceBlock[], job: { startedAt: number; firstPendingAt: number; activityAt: number }): void {
    const before = this.st.organized;
    const now = Date.now();
    const changed = changedBetween(before, doc);
    // The first build is not "an update": highlighting everything would make the indicator meaningless.
    if (before.rootSections.length > 0) for (const id of [...changed.units, ...changed.sections]) this.st.recent[id] = now;
    for (const [id, t] of Object.entries(this.st.recent)) if (now - t > 10 * 60_000) delete this.st.recent[id];

    this.st.organized = doc;
    this.st.processed = newProcessed;
    this.st.processedVersion++;
    this.st.insights = reconcileInsights(this.st.insights, doc);
    this.st.insightsDirtySections = [...new Set([...this.st.insightsDirtySections, ...changed.sections])];

    pushMetric(this.st.metrics.detectToRender, now - job.firstPendingAt);
    if (job.activityAt && now - job.activityAt < 120_000) pushMetric(this.st.metrics.typeToRender, now - job.activityAt);
    const remaining = this.st.current ? !isEmptyDiff(diffById(newProcessed, this.st.current.blocks)) : false;
    if (!remaining) this.firstPendingAt = 0;
    else {
      // Remaining work is either the next batch of a long change set or edits made while the model was working.
      const later = this.changeLog.find((t) => t > job.startedAt);
      this.firstPendingAt = later ?? job.firstPendingAt;
    }
    this.persistNow();
  }

  /** Applies a change set without the model (used for removals while AI is unavailable). */
  private commitWithoutAI(batch: BlockDiff): void {
    const current = this.st.current!;
    const newProcessed = advanceProcessed(this.st.processed, current.blocks, batch);
    const ids = new Set(newProcessed.map((b) => b.id));
    const r = applyPatch(this.st.organized, [], {
      validSourceIds: ids,
      requiredSourceIds: [],
      now: Date.now(),
      sourceVersion: current.version,
      allowExpansion: true,
    });
    this.commit(r.doc, newProcessed, { startedAt: Date.now(), firstPendingAt: this.firstPendingAt || Date.now(), activityAt: 0 });
    this.emit();
  }

  private handleAIError(e: unknown, batch: BlockDiff, jobBlocks: SourceBlock[]): void {
    this.aiFailures++;
    const err = e instanceof AIError ? e : new AIError('server', e instanceof Error ? e.message : String(e));
    const wait = err.retryAfterMs ?? Math.min(60_000, 3000 * 2 ** (this.aiFailures - 1));
    this.aiBackoffUntil = Date.now() + (err.kind === 'auth' ? 10 * 60_000 : wait);
    const label: Record<string, string> = {
      auth: 'The AI provider rejected the API key — check Settings',
      rate_limit: 'AI rate limit reached',
      network: 'AI provider unreachable',
      invalid_output: 'AI returned an unusable response',
      bad_request: 'AI request rejected',
      server: 'AI provider error',
      aborted: 'AI request timed out',
    };
    this.aiIssue = { status: 'error', detail: `${label[err.kind] ?? 'AI error'}: ${err.message.slice(0, 140)} — retrying in ${Math.round((this.aiBackoffUntil - Date.now()) / 1000)}s` };

    // After repeated unusable output, show new notes verbatim rather than leaving them out.
    if (err.kind === 'invalid_output' && this.aiFailures >= 2 && batch.added.length) {
      this.st.metrics.fallbacks++;
      const addedOnly: BlockDiff = { added: batch.added, modified: [], removed: batch.removed };
      // Use the snapshot the job was built from: edits made during the call stay pending.
      const processed = advanceProcessed(this.st.processed, jobBlocks, addedOnly);
      const ids = new Set(processed.map((b) => b.id));
      let doc = applyPatch(this.st.organized, [], { validSourceIds: ids, requiredSourceIds: [], now: Date.now(), sourceVersion: this.st.current!.version, allowExpansion: true }).doc;
      doc = insertFallbackUnits(doc, batch.added.filter((b) => b.kind !== 'heading' && isSubstantive(b.text)), Date.now(), this.st.current!.version);
      this.commit(doc, processed, { startedAt: Date.now(), firstPendingAt: this.firstPendingAt || Date.now(), activityAt: 0 });
    }
  }

  // ───────────────────────────── insights pipeline ─────────────────────────────

  private maybeStartInsights(): void {
    const settings = this.deps.getSettings();
    if (this.stopped || settings.insightDepth === 'off' || this.insightCtl || this.rewriteCtl) return;
    const doc = this.st.organized;
    if (!doc.rootSections.length || !this.st.current) return;
    if (!this.st.insightsDirtySections.length && this.st.insightsOrgVersion !== 0 && this.st.insights.length) return;
    if (this.st.insightsOrgVersion === doc.version) return;
    const now = Date.now();
    if (now - this.lastChangeAt < TIMING.insightsQuiet) return;
    if (!isEmptyDiff(diffById(this.st.processed, this.st.current.blocks))) return;
    const minGap = { brief: 60_000, standard: 45_000, deep: 30_000 }[settings.insightDepth];
    if (now - this.st.lastInsightsAt < minGap) return;
    if (now < this.aiBackoffUntil || !this.deps.gate().ok) return;
    void this.runInsights();
  }

  private async runInsights(): Promise<void> {
    const settings = this.deps.getSettings();
    const ctl = new AbortController();
    this.insightCtl = ctl;
    const timeout = setTimeout(() => ctl.abort(), TIMING.rewriteTimeout);
    const epoch = this.epoch;
    const orgVersion = this.st.organized.version;
    this.st.lastInsightsAt = Date.now();
    this.emit();
    try {
      const built = buildInsightMessages({ organized: this.st.organized, insights: this.st.insights, changedSectionIds: this.st.insightsDirtySections, settings });
      const res = await this.deps.ai.insights(built.messages, ctl.signal);
      if (this.stopped || epoch !== this.epoch) return;
      const lim = insightLimits(settings);
      const { insights, changedIds } = applyInsights(this.st.insights, res, this.st.organized, {
        now: Date.now(),
        perCategory: lim.perCategory,
        total: lim.total,
        mintId: () => `ins_${this.st.nextInsightId++}`,
      });
      this.st.insights = insights;
      for (const id of changedIds) this.st.recent[id] = Date.now();
      this.st.insightsOrgVersion = orgVersion;
      // Sections that changed again during the call stay dirty.
      if (this.st.organized.version === orgVersion) this.st.insightsDirtySections = [];
      this.persistNow();
    } catch (e) {
      if (!ctl.signal.aborted && !(e instanceof AIError && e.kind === 'aborted')) {
        // Insights are optional: log the problem, keep the previous insights, retry later.
        console.warn('[NotePilot] insights failed', e);
      }
    } finally {
      clearTimeout(timeout);
      if (this.insightCtl === ctl) this.insightCtl = null;
      if (!this.stopped) this.emit();
    }
  }

  // ───────────────────────────── status & persistence ─────────────────────────────

  private refreshStatus(): void {
    let status: EngineStatus;
    let detail: string;
    const pending = this.st.current ? !isEmptyDiff(diffById(this.st.processed, this.st.current.blocks)) : false;
    const gate = this.deps.gate();
    if (this.pollIssue) ({ status, detail } = this.pollIssue);
    else if (!this.st.current) [status, detail] = ['starting', 'Reading your document…'];
    else if (this.rewriteCtl) [status, detail] = ['rewriting', 'Updating organized notes…'];
    else if (this.aiIssue && pending) ({ status, detail } = this.aiIssue);
    else if (!gate.ok) [status, detail] = GATE_STATUS[gate.reason];
    else if (pending) [status, detail] = ['pending', 'New notes detected — waiting for a pause in typing'];
    else [status, detail] = ['live', 'Up to date'];
    this.status = status;
    this.statusDetail = detail;
  }

  private emit(): void {
    if (this.stopped) return;
    this.refreshStatus();
    const v = this.view();
    this.listeners.forEach((l) => l(v));
  }

  private persistSoon(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => this.persistNow(), 2000);
  }

  private persistNow(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    void this.deps.store.save(this.st).catch((e) => console.warn('[NotePilot] could not persist state', e));
  }

  private flushPersist(): void {
    if (this.persistTimer) this.persistNow();
  }
}

/** Picks a bounded subset of changes for one model call (initial builds of long docs are batched). */
export function selectBatch(diff: BlockDiff, maxChars: number): BlockDiff {
  let budget = maxChars;
  const take = <T>(items: T[], size: (t: T) => number): T[] => {
    const out: T[] = [];
    for (const it of items) {
      const s = size(it);
      if (out.length && s > budget) break;
      out.push(it);
      budget -= s;
    }
    return out;
  };
  const modified = take(diff.modified, (m) => m.before.text.length + m.after.text.length);
  const added = modified.length === diff.modified.length ? take(diff.added, (b) => b.text.length) : [];
  return { added, modified, removed: diff.removed };
}

/** The processed snapshot after applying `batch`: batch blocks take their current text, others keep the processed text. */
export function advanceProcessed(processed: SourceBlock[], current: SourceBlock[], batch: BlockDiff): SourceBlock[] {
  const include = new Set([...batch.added.map((b) => b.id), ...batch.modified.map((m) => m.after.id)]);
  const removed = new Set(batch.removed.map((b) => b.id));
  const prev = new Map(processed.map((b) => [b.id, b]));
  const out: SourceBlock[] = [];
  const seen = new Set<string>();
  for (const b of current) {
    if (include.has(b.id)) out.push(b);
    else if (prev.has(b.id)) out.push(prev.get(b.id)!);
    seen.add(b.id);
  }
  // Removed-from-current blocks that are not part of this batch stay until their removal is processed.
  for (const b of processed) if (!seen.has(b.id) && !removed.has(b.id)) out.push(b);
  return out;
}
