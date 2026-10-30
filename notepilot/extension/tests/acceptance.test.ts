import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHarness, idByText, outline, sectionByTitle, unitsOf, type RewritePayload } from './harness';
import { checkInvariants, coverageOf } from '../src/core/patch';
import { percentile } from '../src/engine/state';

/**
 * Spec §15 acceptance workflow, run against the real SyncEngine with a fake Google Docs backend
 * and a scripted model. The scripted model also asserts that it was given the context a real
 * model needs (e.g. the earlier section in full when a related fact is added).
 */

afterEach(() => vi.useRealTimers());

const NOTES = [
  'mitochondria makes ATP.',
  'glycolysis cytoplasm.',
  'krebs produces nadh.',
  'ETC requires oxygen.',
  "glycolysis doesn't need oxygen.",
  'ATP synthase proton gradient.',
];

function initialBuild(p: RewritePayload) {
  expect(p.organized.sections).toEqual([]);
  expect(p.changes.added!.map((b) => b.text)).toEqual(NOTES);
  const id = (t: string) => idByText(p, t);
  return {
    title: 'Cellular Respiration',
    ops: [
      { op: 'create_section', ref: 'new:root', title: 'Cellular Respiration', parent: null },
      { op: 'create_section', ref: 'new:ov', title: 'Overview', parent: 'new:root' },
      { op: 'create_section', ref: 'new:gly', title: 'Glycolysis', parent: 'new:root', after: 'new:ov' },
      { op: 'create_section', ref: 'new:kre', title: 'Citric Acid Cycle', parent: 'new:root', after: 'new:gly' },
      { op: 'create_section', ref: 'new:etc', title: 'Electron Transport Chain', parent: 'new:root', after: 'new:kre' },
      { op: 'create_unit', ref: 'new:u_ov', section: 'new:ov', content: '**Mitochondria** produce ATP through cellular respiration.', origin: 'user', sources: [id('mitochondria')] },
      {
        op: 'create_unit',
        ref: 'new:u_gly',
        section: 'new:gly',
        type: 'list',
        content: '**Glycolysis** occurs in the **cytoplasm**.\n\n- Does not directly require oxygen.',
        origin: 'user',
        sources: [id('glycolysis cytoplasm'), id("doesn't need")],
      },
      { op: 'create_unit', ref: 'new:u_kre', section: 'new:kre', content: 'The **citric acid cycle** (Krebs cycle) produces **NADH**.', origin: 'user', sources: [id('krebs')] },
      { op: 'create_unit', ref: 'new:u_etc', section: 'new:etc', content: 'The **electron transport chain (ETC)** requires **oxygen**.', origin: 'user', sources: [id('ETC')] },
      { op: 'create_unit', ref: 'new:u_syn', section: 'new:etc', after: 'new:u_etc', content: '**ATP synthase** uses the **proton gradient** to produce ATP.', origin: 'user', sources: [id('ATP synthase')] },
      { op: 'create_unit', ref: 'new:u_x', section: 'new:etc', after: 'new:u_syn', content: 'Oxygen acts as the terminal electron acceptor in aerobic respiration.', origin: 'expansion', sources: [id('ETC')] },
    ],
  };
}

describe('Acceptance workflow (spec §15)', () => {
  it('organizes, integrates, reconciles and keeps insights current without prompts — and never writes to the doc', async () => {
    const h = createHarness();
    const { docs, ai, engine } = h;

    // 1–3. Open a doc, open the sidebar, type unstructured notes.
    docs.set(NOTES);
    ai.onRewrite = initialBuild;
    ai.onInsights = (p) => {
      const etc = p.organized.sections.find((s) => s.title === 'Electron Transport Chain')!;
      return {
        upsert: [
          {
            category: 'connection',
            title: 'Electron transport powers ATP synthase',
            body: 'The ETC builds the proton gradient that ATP synthase uses.',
            sectionIds: [etc.id],
            unitIds: etc.units.map((u) => u.id),
            needsVerification: false,
          },
          {
            category: 'gap',
            title: 'Why does oxygen depletion stop oxidative phosphorylation?',
            body: 'Oxygen is not used by ATP synthase directly — what links them?',
            sectionIds: [etc.id],
            needsVerification: false,
          },
        ],
        remove: [],
      };
    };
    await engine.start();
    await h.advance(4000);

    // 4. The sidebar automatically shows polished, structured notes.
    let doc = engine.state.organized;
    expect(outline(doc)).toEqual(['Cellular Respiration', '  Overview', '  Glycolysis', '  Citric Acid Cycle', '  Electron Transport Chain']);
    expect(doc.title).toBe('Cellular Respiration');
    expect(engine.view().status).toBe('live');
    expect(checkInvariants(doc)).toEqual([]);
    const allBlocks = engine.state.current!.blocks.map((b) => b.id);
    expect(allBlocks.every((b) => coverageOf(doc).has(b))).toBe(true); // nothing lost

    // 9 (initial). Insights appear on their own.
    await h.advance(20_000);
    expect(engine.state.insights.map((i) => i.category)).toEqual(['connection', 'gap']);
    const glyUnitId = unitsOf(doc, 'Glycolysis')[0].id;

    // New fact about anaerobic metabolism, typed at the very bottom of the raw notes.
    ai.onRewrite = (p) => {
      expect(p.changes.added!.map((b) => b.text)).toEqual(['fermentation regenerates NAD+ when no oxygen.']);
      const gly = p.organized.sections.find((s) => s.title === 'Glycolysis')!;
      expect(gly.units[0].preview).toBeUndefined(); // related section sent in full
      const root = p.organized.sections.find((s) => s.title === 'Cellular Respiration')!;
      return {
        ops: [
          { op: 'create_section', ref: 'new:an', title: 'Anaerobic Metabolism', parent: root.id, after: gly.id },
          {
            op: 'create_unit',
            ref: 'new:f',
            section: 'new:an',
            content: 'When oxygen is unavailable, **fermentation** regenerates **NAD⁺**, allowing glycolysis to continue.',
            origin: 'user',
            sources: [idByText(p, 'fermentation')],
          },
        ],
      };
    };
    docs.edit((p) => [...p, 'fermentation regenerates NAD+ when no oxygen.']);
    await h.advance(12_000);
    doc = engine.state.organized;
    // Placed at the right conceptual location — not appended at the bottom.
    expect(outline(doc)).toEqual([
      'Cellular Respiration',
      '  Overview',
      '  Glycolysis',
      '  Anaerobic Metabolism',
      '  Citric Acid Cycle',
      '  Electron Transport Chain',
    ]);

    // 5–6. Another fact about an earlier topic updates the earlier section in place.
    ai.onRewrite = (p) => {
      const added = idByText(p, 'net 2 ATP');
      const gly = p.organized.sections.find((s) => s.title === 'Glycolysis')!;
      expect(gly.units.map((u) => u.id)).toEqual([glyUnitId]);
      return {
        ops: [
          {
            op: 'update_unit',
            id: glyUnitId,
            content: '**Glycolysis** occurs in the **cytoplasm**.\n\n- Does not directly require oxygen.\n- Produces a net gain of 2 ATP.',
            sources: [...gly.units[0].sources, added],
          },
        ],
      };
    };
    const sectionCount = Object.keys(doc.sections).length;
    docs.edit((p) => [...p, 'glycolysis net 2 ATP']);
    await h.advance(12_000);
    doc = engine.state.organized;
    expect(unitsOf(doc, 'Glycolysis').map((u) => u.id)).toEqual([glyUnitId]);
    expect(doc.units[glyUnitId].content).toContain('net gain of 2 ATP');
    expect(Object.keys(doc.sections)).toHaveLength(sectionCount);
    expect(engine.state.recent[glyUnitId]).toBeGreaterThan(0); // flagged as recently updated
    const overviewUnit = unitsOf(doc, 'Overview')[0].id;
    expect(engine.state.recent[overviewUnit]).toBeUndefined(); // untouched passages are not flagged

    // 7–8a. Change an earlier statement → the organized version is reconciled.
    const kreUnit = unitsOf(doc, 'Citric Acid Cycle')[0];
    ai.onRewrite = (p) => {
      const m = p.changes.modified!;
      expect(m).toHaveLength(1);
      expect(m[0]).toMatchObject({ before: 'krebs produces nadh.', after: 'krebs produces nadh and fadh2 in the matrix.', cited_by: [kreUnit.id] });
      return {
        ops: [{ op: 'update_unit', id: kreUnit.id, content: 'The **citric acid cycle** (Krebs cycle) takes place in the mitochondrial **matrix** and produces **NADH** and **FADH₂**.' }],
      };
    };
    docs.edit((p) => p.map((x) => (x === 'krebs produces nadh.' ? 'krebs produces nadh and fadh2 in the matrix.' : x)));
    await h.advance(12_000);
    doc = engine.state.organized;
    expect(doc.units[kreUnit.id].content).toContain('FADH₂');

    // 7–8b. Delete an earlier statement → content it supported disappears.
    const [etcUnit, synUnit, expUnit] = unitsOf(doc, 'Electron Transport Chain');
    ai.onRewrite = (p) => {
      expect(p.changes.removed!.map((r) => r.text)).toEqual(['ETC requires oxygen.']);
      expect(p.changes.removed![0].cited_by).toEqual(expect.arrayContaining([etcUnit.id, expUnit.id]));
      return { ops: [{ op: 'delete_unit', id: etcUnit.id }] }; // the model forgets the anchored expansion
    };
    ai.onInsights = (p) => {
      expect(p.current_insights.length).toBeGreaterThan(0);
      const etc = p.organized.sections.find((s) => s.title === 'Electron Transport Chain')!;
      return {
        upsert: [{ category: 'practice', title: 'Check yourself', body: 'Explain chemiosmosis.', sectionIds: [etc.id], question: { prompt: 'What drives ATP synthase?', answer: 'The proton gradient.' } }],
        remove: [],
      };
    };
    docs.edit((p) => p.filter((x) => x !== 'ETC requires oxygen.'));
    await h.advance(12_000);
    doc = engine.state.organized;
    expect(doc.units[etcUnit.id]).toBeUndefined();
    expect(doc.units[expUnit.id]).toBeUndefined(); // engine removed the expansion whose basis was deleted
    expect(doc.units[synUnit.id]).toBeDefined();
    expect(checkInvariants(doc)).toEqual([]);

    // 9. Insights update automatically.
    await h.advance(60_000);
    expect(engine.state.insights.some((i) => i.category === 'practice' && i.question?.answer === 'The proton gradient.')).toBe(true);
    expect(ai.insightCalls).toBeGreaterThanOrEqual(2);

    // 10. The Google Doc is only ever read.
    expect(docs.requests.every((r) => r.method === 'GET')).toBe(true);

    // Latency: change detected → sidebar updated, measured by the engine itself.
    const p90 = percentile(engine.state.metrics.detectToRender, 90)!;
    expect(p90).toBeLessThanOrEqual(15_000);
    expect(engine.view().status).toBe('live');
    engine.stop();
  });

  it('starts processing as soon as typing pauses (content-script activity signal)', async () => {
    const h = createHarness();
    h.docs.set(['first note about photosynthesis']);
    h.ai.latency = 2000;
    h.ai.onRewrite = (p) => ({
      ops: (p.changes.added ?? []).map((b, i) => ({
        op: 'create_unit',
        ref: `new:u${i}`,
        section: p.organized.sections[0]?.id ?? 'new:s',
        content: b.text,
        origin: 'user',
        sources: [b.id],
      })).concat(p.organized.sections.length ? [] : [{ op: 'create_section', ref: 'new:s', title: 'Photosynthesis', parent: null } as never]),
    });
    await h.engine.start();
    await h.advance(3000);
    expect(h.ai.rewriteCalls).toHaveLength(1);

    // Continuous typing: keystrokes every 500 ms for 20 s; the doc saves every 2 s.
    for (let t = 0; t < 20_000; t += 500) {
      h.engine.notifyActivity();
      if (t % 2000 === 0) h.docs.edit((p) => [...p, `light reaction detail ${t}`]);
      await h.advance(500);
    }
    // Max-wait keeps the sidebar moving during continuous typing (not just at the end).
    expect(h.ai.rewriteCalls.length).toBeGreaterThanOrEqual(3);

    // Typing stops → processed shortly after the pause, then live.
    await h.advance(9000);
    expect(h.engine.view().pendingChanges).toBe(0);
    expect(h.engine.view().status).toBe('live');
    h.engine.stop();
  });
});
