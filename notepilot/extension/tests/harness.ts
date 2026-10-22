import { vi } from 'vitest';
import type { AIPipelines } from '../src/ai/pipelines';
import { AIError } from '../src/ai/client';
import type { ChatMessage } from '../src/core/context';
import { parseInsightsResponse, parseRewriteResponse } from '../src/core/schema';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/settings';
import type { OrganizedDoc } from '../src/core/types';
import { sectionOrder } from '../src/core/patch';
import { DocsApiError, type DocsSource } from '../src/google/docsApi';
import { memoryStore } from '../src/storage/db';
import { SyncEngine, type ProcessGate } from '../src/engine/syncEngine';
import { docsResponse, type ParaSpec } from './fixtures';

/** A fake Google Docs backend: a mutable document plus a log of every request the engine makes. */
export class FakeDocs implements DocsSource {
  paras: ParaSpec[] = [];
  revision = 1;
  requests: { method: string; kind: 'revision' | 'full' }[] = [];
  failNext: DocsApiError[] = [];
  stats = { recent: [] as number[] };

  set(paras: ParaSpec[]) {
    this.paras = paras;
    this.revision++;
  }
  edit(fn: (p: ParaSpec[]) => ParaSpec[]) {
    this.set(fn([...this.paras]));
  }
  async getRevisionId() {
    this.requests.push({ method: 'GET', kind: 'revision' });
    const f = this.failNext.shift();
    if (f) throw f;
    return `rev-${this.revision}`;
  }
  async getDocument() {
    this.requests.push({ method: 'GET', kind: 'full' });
    const f = this.failNext.shift();
    if (f) throw f;
    return docsResponse(this.paras, { revisionId: `rev-${this.revision}` });
  }
}

export interface RewritePayload {
  organized: { title: string | null; sections: { id: string; title: string; parent: string | null; units: { id: string; content: string; sources: string[]; preview?: boolean }[] }[] };
  changes: {
    added?: { id: string; text: string }[];
    modified?: { id: string; before: string; after: string; cited_by: string[] }[];
    removed?: { id: string; text: string; cited_by: string[] }[];
    unrepresented?: { id: string; text: string }[];
  };
}

export type RewriteHandler = (payload: RewritePayload, messages: ChatMessage[]) => { title?: string | null; ops: unknown[] } | Error;
export type InsightHandler = (payload: { organized: RewritePayload['organized']; current_insights: { id: string }[] }) => { upsert: unknown[]; remove: string[] };

export function payloadOf(messages: ChatMessage[]): RewritePayload {
  const user = messages.find((m) => m.role === 'user')!.content;
  return JSON.parse(user.slice(user.indexOf('{')));
}

/** A scripted model: each handler returns the ops a model would return, with a simulated latency. */
export class FakeAI implements Pick<AIPipelines, 'rewrite' | 'insights'> {
  rewriteCalls: RewritePayload[] = [];
  insightCalls = 0;
  onRewrite: RewriteHandler = () => ({ ops: [] });
  onInsights: InsightHandler = () => ({ upsert: [], remove: [] });
  latency = 3000;
  insightLatency = 5000;
  aborted = 0;

  private delay(ms: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        this.aborted++;
        reject(new AIError('aborted', 'cancelled'));
      });
    });
  }

  async rewrite(messages: ChatMessage[], signal: AbortSignal) {
    const payload = payloadOf(messages);
    this.rewriteCalls.push(payload);
    await this.delay(this.latency, signal);
    const out = this.onRewrite(payload, messages);
    if (out instanceof Error) throw out;
    return { ...parseRewriteResponse(out), latencyMs: this.latency, cached: false };
  }

  async insights(messages: ChatMessage[], signal: AbortSignal) {
    this.insightCalls++;
    await this.delay(this.insightLatency, signal);
    return { ...parseInsightsResponse(this.onInsights(payloadOf(messages) as never)), latencyMs: this.insightLatency, cached: false };
  }
}

export function createHarness(opts: { settings?: Partial<Settings>; gate?: () => ProcessGate } = {}) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(new Date('2026-10-19T14:00:00Z'));
  const docs = new FakeDocs();
  const ai = new FakeAI();
  const store = memoryStore();
  const settings: Settings = { ...DEFAULT_SETTINGS, ...opts.settings };
  const engine = new SyncEngine('DOC_1234567890abcdefghij', {
    docs,
    ai,
    store,
    getSettings: () => settings,
    gate: opts.gate ?? (() => ({ ok: true })),
  });
  return {
    docs,
    ai,
    store,
    settings,
    engine,
    advance: (ms: number) => vi.advanceTimersByTimeAsync(ms),
  };
}

/** Helpers to read the organized document like a user would. */
export function outline(doc: OrganizedDoc): string[] {
  return sectionOrder(doc).map(({ id, depth }) => `${'  '.repeat(depth - 1)}${doc.sections[id].title}`);
}
export function sectionByTitle(doc: OrganizedDoc, title: string) {
  return Object.values(doc.sections).find((s) => s.title === title);
}
export function unitsOf(doc: OrganizedDoc, title: string) {
  return (sectionByTitle(doc, title)?.units ?? []).map((u) => doc.units[u]);
}
export function idByText(p: RewritePayload, fragment: string): string {
  const all = [...(p.changes.added ?? []), ...(p.changes.unrepresented ?? []), ...(p.changes.modified ?? []).map((m) => ({ id: m.id, text: m.after }))];
  const hit = all.find((b) => b.text.includes(fragment));
  if (!hit) throw new Error(`fake model: no block containing "${fragment}" in ${JSON.stringify(all.map((b) => b.text))}`);
  return hit.id;
}
