import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHarness, type RewritePayload } from './harness';
import { DocsApiError } from '../src/google/docsApi';
import { AIError } from '../src/ai/client';
import { SyncEngine } from '../src/engine/syncEngine';
import { coverageOf, checkInvariants } from '../src/core/patch';
import { UNSORTED_SECTION_ID } from '../src/core/types';

afterEach(() => vi.useRealTimers());

/** A simple "model": puts every added/unrepresented block into one section, updates modified ones. */
function simpleModel(p: RewritePayload) {
  const sec = p.organized.sections.find((s) => s.title === 'Notes');
  const ops: unknown[] = [];
  if (!sec) ops.push({ op: 'create_section', ref: 'new:s', title: 'Notes', parent: null });
  const target = sec?.id ?? 'new:s';
  [...(p.changes.added ?? []), ...(p.changes.unrepresented ?? [])].forEach((b, i) =>
    ops.push({ op: 'create_unit', ref: `new:u${i}`, section: target, content: `Rewritten: ${b.text}`, origin: 'user', sources: [b.id] }),
  );
  for (const m of p.changes.modified ?? []) for (const u of m.cited_by) ops.push({ op: 'update_unit', id: u, content: `Rewritten: ${m.after}` });
  // Placeholder units (needs_review) get reorganized.
  for (const s of p.organized.sections)
    for (const u of s.units as { id: string; needs_review?: boolean; content: string }[])
      if (u.needs_review) {
        ops.push({ op: 'move_unit', id: u.id, section: target });
        ops.push({ op: 'update_unit', id: u.id, content: `Rewritten: ${u.content}` });
      }
  return { ops };
}

describe('SyncEngine robustness', () => {
  it('rejects stale results when the organized document was reset mid-flight', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one', 'beta note two']);
    h.ai.onRewrite = simpleModel;
    h.ai.latency = 5000;
    await h.engine.start();
    await h.advance(1000); // rewrite in flight
    expect(h.ai.rewriteCalls).toHaveLength(1);
    await h.engine.rebuild(); // user clicks "Rebuild" while the model is working
    await h.advance(12_000);
    expect(h.engine.state.metrics.staleRejected).toBeGreaterThanOrEqual(1);
    expect(h.ai.rewriteCalls).toHaveLength(2); // rebuilt from scratch exactly once more
    expect(Object.values(h.engine.state.organized.units)).toHaveLength(2);
    h.engine.stop();
  });

  it('cancels an in-flight insights request when new notes need rewriting', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one']);
    h.ai.onRewrite = simpleModel;
    h.ai.insightLatency = 20_000;
    h.ai.onInsights = (p) => ({ upsert: [{ category: 'gap', title: 'Q', body: 'B', sectionIds: [p.organized.sections[0].id] }], remove: [] });
    await h.engine.start();
    await h.advance(15_000);
    expect(h.ai.insightCalls).toBe(1); // insights running
    h.docs.edit((p) => [...p, 'gamma note three']);
    await h.advance(10_000);
    expect(h.ai.aborted).toBeGreaterThanOrEqual(1);
    expect(h.engine.state.metrics.cancelled).toBeGreaterThanOrEqual(1);
    expect(Object.values(h.engine.state.organized.units).map((u) => u.content)).toContain('Rewritten: gamma note three');
    await h.advance(90_000);
    expect(h.engine.state.insights).toHaveLength(1); // retried later and completed
    h.engine.stop();
  });

  it('backs off on Docs API rate limits and honours Retry-After', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one']);
    h.ai.onRewrite = simpleModel;
    await h.engine.start();
    await h.advance(5000);
    h.docs.failNext = [new DocsApiError('rate_limit', 'Too many requests', 429, 30_000)];
    const before = h.docs.requests.length;
    await h.advance(6000);
    expect(h.engine.view().status).toBe('error');
    const afterError = h.docs.requests.length;
    expect(afterError - before).toBe(1);
    await h.advance(25_000);
    expect(h.docs.requests.length).toBe(afterError); // silent during back-off
    await h.advance(10_000);
    expect(h.docs.requests.length).toBeGreaterThan(afterError);
    expect(h.engine.view().status).toBe('live');
    h.engine.stop();
  });

  it('survives network outages and keeps the last organized version visible', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one']);
    h.ai.onRewrite = simpleModel;
    await h.engine.start();
    await h.advance(5000);
    const organized = h.engine.state.organized;
    h.docs.failNext = Array.from({ length: 4 }, () => new DocsApiError('network', 'offline'));
    await h.advance(10_000);
    expect(h.engine.view().status).toBe('offline');
    expect(h.engine.view().organized).toBe(organized);
    await h.advance(60_000);
    expect(h.engine.view().status).toBe('live');
    h.engine.stop();
  });

  it('shows notes verbatim after repeated unusable AI output, then reorganizes them later', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one', 'beta note two']);
    let failures = 2;
    h.ai.onRewrite = (p) => (failures-- > 0 ? new AIError('invalid_output', 'not JSON') : simpleModel(p));
    await h.engine.start();
    await h.advance(13_000);
    const doc = h.engine.state.organized;
    expect(doc.sections[UNSORTED_SECTION_ID]).toBeDefined();
    expect(Object.values(doc.units).every((u) => u.needsReview)).toBe(true);
    expect(coverageOf(doc).size).toBe(2); // nothing lost even while the model misbehaves
    await h.advance(120_000); // heal pass
    const healed = h.engine.state.organized;
    expect(healed.sections[UNSORTED_SECTION_ID]).toBeUndefined();
    expect(Object.values(healed.units).every((u) => u.content.startsWith('Rewritten:') && !u.needsReview)).toBe(true);
    expect(checkInvariants(healed)).toEqual([]);
    h.engine.stop();
  });

  it('repairs patches that leave notes unrepresented', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one', 'beta note two', 'gamma note three']);
    h.ai.onRewrite = (p) => {
      if (p.changes.unrepresented) return simpleModel(p);
      const r = simpleModel(p);
      r.ops = r.ops.filter((o) => !JSON.stringify(o).includes('gamma')); // model drops one note
      return r;
    };
    await h.engine.start();
    await h.advance(10_000);
    expect(h.ai.rewriteCalls.at(-1)!.changes.unrepresented!.map((b) => b.text)).toEqual(['gamma note three']);
    expect(h.engine.state.metrics.repairs).toBe(1);
    expect(coverageOf(h.engine.state.organized).size).toBe(3);
    expect(h.engine.state.organized.sections[UNSORTED_SECTION_ID]).toBeUndefined();
    h.engine.stop();
  });

  it('never calls the AI without consent, but still reconciles deletions', async () => {
    let consent = true;
    const h = createHarness({ gate: () => (consent ? { ok: true } : { ok: false, reason: 'no_consent' }) });
    h.docs.set(['alpha note one', 'beta note two']);
    h.ai.onRewrite = simpleModel;
    await h.engine.start();
    await h.advance(5000);
    consent = false;
    const calls = h.ai.rewriteCalls.length;
    h.docs.edit(() => ['alpha note one', 'photosynthesis occurs in chloroplasts']);
    await h.advance(20_000);
    expect(h.ai.rewriteCalls.length).toBe(calls);
    expect(h.engine.view().status).toBe('needs_consent');
    const contents = Object.values(h.engine.state.organized.units).map((u) => u.content);
    expect(contents).toEqual(['Rewritten: alpha note one']); // deleted note gone, new note awaits consent
    h.engine.stop();
  });

  it('enforces the cost limit via the gate and keeps the last version', async () => {
    let over = false;
    const h = createHarness({ gate: () => (over ? { ok: false, reason: 'budget' } : { ok: true }) });
    h.docs.set(['alpha note one']);
    h.ai.onRewrite = simpleModel;
    await h.engine.start();
    await h.advance(5000);
    over = true;
    h.docs.edit((p) => [...p, 'beta note two']);
    await h.advance(20_000);
    expect(h.engine.view().status).toBe('budget');
    expect(h.engine.view().pendingChanges).toBe(1);
    h.engine.stop();
  });

  it('polls cheaply when idle and respects quota', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one']);
    h.ai.onRewrite = simpleModel;
    await h.engine.start();
    await h.advance(10 * 60_000);
    const full = h.docs.requests.filter((r) => r.kind === 'full').length;
    expect(full).toBe(1); // only revision checks while nothing changes
    expect(h.docs.requests.length).toBeLessThan(70); // ≈ 6 req/min idle, far below 300/min/user
    h.engine.notifyVisibility(false);
    const n = h.docs.requests.length;
    await h.advance(10 * 60_000);
    expect(h.docs.requests.length - n).toBeLessThanOrEqual(11); // background tab: once a minute
    h.engine.stop();
  });

  it('resumes from persisted state without repeating work', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one', 'beta note two']);
    h.ai.onRewrite = simpleModel;
    await h.engine.start();
    await h.advance(5000);
    h.engine.stop();
    const calls = h.ai.rewriteCalls.length;
    const again = new SyncEngine('DOC_1234567890abcdefghij', { docs: h.docs, ai: h.ai, store: h.store, getSettings: () => h.settings, gate: () => ({ ok: true }) });
    await again.start();
    expect(Object.keys(again.state.organized.units)).toHaveLength(2); // visible immediately from IndexedDB state
    await h.advance(10_000);
    expect(h.ai.rewriteCalls.length).toBe(calls);
    // Offline edits made while the panel was closed are caught up on reopen.
    again.stop();
    h.docs.edit((p) => [...p, 'gamma note three']);
    const third = new SyncEngine('DOC_1234567890abcdefghij', { docs: h.docs, ai: h.ai, store: h.store, getSettings: () => h.settings, gate: () => ({ ok: true }) });
    await third.start();
    await h.advance(5000);
    expect(h.ai.rewriteCalls.at(-1)!.changes.added!.map((b) => b.text)).toEqual(['gamma note three']);
    third.stop();
  });

  it('batches the initial build of long documents', async () => {
    const h = createHarness();
    const paras = Array.from({ length: 300 }, (_, i) => `Paragraph ${i}: ${'detail '.repeat(14)}`);
    h.docs.set(paras);
    h.ai.onRewrite = simpleModel;
    h.ai.latency = 2000;
    await h.engine.start();
    await h.advance(60_000);
    expect(h.ai.rewriteCalls.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...h.ai.rewriteCalls.map((c) => (c.changes.added ?? []).reduce((n, b) => n + b.text.length, 0)))).toBeLessThanOrEqual(8200);
    expect(coverageOf(h.engine.state.organized).size).toBe(300);
    h.engine.stop();
  });
});

describe('SyncEngine fallbacks', () => {
  it('falls back to full fetches if the cheap revision check is rejected', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one']);
    h.ai.onRewrite = simpleModel;
    const orig = h.docs.getRevisionId.bind(h.docs);
    let rejected = 0;
    h.docs.getRevisionId = async () => {
      rejected++;
      throw new DocsApiError('server', 'Invalid field selection', 400);
    };
    await h.engine.start();
    await h.advance(5000);
    h.docs.edit((p) => [...p, 'beta note two']);
    await h.advance(15_000);
    expect(rejected).toBe(1);
    expect(h.engine.view().status).toBe('live');
    expect(Object.values(h.engine.state.organized.units)).toHaveLength(2);
    void orig;
    h.engine.stop();
  });
});

describe('SyncEngine regressions (independent review findings)', () => {
  it('verbatim fallback uses the job snapshot, so edits made during the call stay pending', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one']);
    h.ai.onRewrite = simpleModel;
    await h.engine.start();
    await h.advance(5000);
    let fail = 2;
    h.ai.onRewrite = (p) => (fail-- > 0 ? new AIError('invalid_output', 'bad') : simpleModel(p));
    h.docs.edit((p) => [...p, 'beta note two original']);
    await h.advance(8000); // first failure, back-off, second call starts
    h.docs.edit((p) => p.map((x) => (typeof x === 'string' && x.startsWith('beta') ? 'beta note two EDITED version' : x)));
    await h.advance(40_000);
    const texts = Object.values(h.engine.state.organized.units).map((u) => u.content).join(' | ');
    expect(texts).toContain('EDITED');
    expect(h.engine.view().pendingChanges).toBe(0);
    h.engine.stop();
  });

  it('typing does not shorten a rate-limit back-off', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one']);
    h.ai.onRewrite = simpleModel;
    await h.engine.start();
    await h.advance(5000);
    h.docs.failNext = [new DocsApiError('rate_limit', 'slow down', 429, 60_000)];
    await h.advance(6000);
    const n = h.docs.requests.length;
    for (let t = 0; t < 30_000; t += 500) {
      h.engine.notifyActivity();
      h.engine.notifyVisibility(true);
      await h.advance(500);
    }
    expect(h.docs.requests.length).toBe(n);
    h.engine.stop();
  });

  it('does not probe every 2 s while processing is blocked', async () => {
    const h = createHarness({ settings: { frequency: 'saver' }, gate: () => ({ ok: false, reason: 'disabled' }) });
    h.docs.set(['alpha note one']);
    await h.engine.start();
    await h.advance(5 * 60_000);
    const n = h.docs.requests.length;
    await h.advance(60_000);
    expect(h.docs.requests.length - n).toBeLessThanOrEqual(2); // saver idle cadence, not 30/min
    expect(h.engine.view().status).toBe('paused');
    h.engine.stop();
  });

  it('emits when only the document title changes', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one']);
    h.ai.onRewrite = simpleModel;
    const titles: string[] = [];
    h.engine.subscribe((v) => titles.push(v.title));
    await h.engine.start();
    await h.advance(5000);
    const orig = h.docs.getDocument.bind(h.docs);
    h.docs.getDocument = async () => ({ ...(await orig()), title: 'Renamed notes' });
    h.docs.revision++;
    await h.advance(20_000);
    expect(titles.at(-1)).toBe('Renamed notes');
    h.engine.stop();
  });

  it('keeps the identity of a paragraph deleted and restored (undo) before the removal was processed', async () => {
    const h = createHarness();
    h.docs.set(['alpha note one', 'beta note two']);
    h.ai.onRewrite = simpleModel;
    await h.engine.start();
    await h.advance(5000);
    const betaId = h.engine.state.current!.blocks[1].id;
    const calls = h.ai.rewriteCalls.length;
    h.docs.edit((p) => p.slice(0, 1));
    h.engine.syncNow();
    await h.advance(100); // a poll lands while the paragraph is deleted…
    expect(h.engine.state.current!.blocks).toHaveLength(1);
    expect(h.engine.view().pendingChanges).toBe(1);
    h.docs.edit((p) => [...p, 'beta note two']); // …then undo restores it
    h.engine.syncNow();
    await h.advance(100);
    expect(h.engine.state.current!.blocks[1].id).toBe(betaId);
    expect(h.engine.view().pendingChanges).toBe(0);
    await h.advance(20_000);
    expect(h.ai.rewriteCalls.length).toBe(calls); // no wasted AI work
    h.engine.stop();
  });
});
