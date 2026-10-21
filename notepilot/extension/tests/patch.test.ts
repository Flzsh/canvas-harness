import { describe, expect, it } from 'vitest';
import { applyPatch, checkInvariants, insertFallbackUnits, type ApplyContext } from '../src/core/patch';
import { parseRewriteResponse, extractJson, stripNullOpFields } from '../src/core/schema';
import { emptyOrganizedDoc, UNSORTED_SECTION_ID, type OrganizedDoc } from '../src/core/types';

const ctx = (ids: string[], extra: Partial<ApplyContext> = {}): ApplyContext => ({
  validSourceIds: new Set(ids),
  requiredSourceIds: ids,
  now: 1000,
  sourceVersion: 1,
  allowExpansion: true,
  ...extra,
});

function apply(doc: OrganizedDoc, ops: unknown[], c: ApplyContext, title?: string) {
  const parsed = parseRewriteResponse({ title, ops });
  expect(parsed.invalidOps).toEqual([]);
  const r = applyPatch(doc, parsed.ops, c, parsed.title);
  expect(checkInvariants(r.doc)).toEqual([]);
  return r;
}

function base(): OrganizedDoc {
  return apply(
    emptyOrganizedDoc('d'),
    [
      { op: 'create_section', ref: 'new:resp', title: 'Cellular Respiration', parent: null, after: null },
      { op: 'create_section', ref: 'new:gly', title: 'Glycolysis', parent: 'new:resp', after: null },
      { op: 'create_section', ref: 'new:etc', title: 'Electron Transport Chain', parent: 'new:resp', after: 'new:gly' },
      { op: 'create_unit', ref: 'new:u1', section: 'new:gly', type: 'paragraph', content: 'Glycolysis occurs in the **cytoplasm**.', origin: 'user', sources: ['b2'] },
      { op: 'create_unit', ref: 'new:u2', section: 'new:gly', after: 'new:u1', type: 'paragraph', content: 'It does not require oxygen.', origin: 'user', sources: ['b5'] },
      { op: 'create_unit', ref: 'new:u3', section: 'new:etc', content: 'The ETC requires **oxygen**.', origin: 'user', sources: ['b4'] },
      { op: 'create_unit', ref: 'new:u4', section: 'new:etc', content: 'Oxygen is the terminal electron acceptor.', origin: 'expansion', sources: ['b4'] },
    ],
    ctx(['b2', 'b4', 'b5']),
    'Cellular Respiration',
  ).doc;
}

describe('applyPatch', () => {
  it('builds a nested organized document with resolved refs', () => {
    const doc = base();
    expect(doc.title).toBe('Cellular Respiration');
    expect(doc.rootSections).toHaveLength(1);
    const root = doc.sections[doc.rootSections[0]];
    expect(root.children.map((c) => doc.sections[c].title)).toEqual(['Glycolysis', 'Electron Transport Chain']);
    const gly = doc.sections[root.children[0]];
    expect(gly.units.map((u) => doc.units[u].content)).toEqual(['Glycolysis occurs in the **cytoplasm**.', 'It does not require oxygen.']);
  });

  it('updates an earlier unit in place (no append) and preserves identity of untouched units', () => {
    const doc = base();
    const [u1, u2] = doc.sections[doc.sections[doc.rootSections[0]].children[0]].units;
    const r = apply(doc, [{ op: 'update_unit', id: u1, content: 'Glycolysis occurs in the **cytoplasm** and yields a net 2 ATP.', sources: ['b2', 'b9'] }], ctx(['b2', 'b4', 'b5', 'b9']));
    expect(r.doc.units[u1].content).toContain('net 2 ATP');
    expect(r.doc.units[u1].sources).toEqual(['b2', 'b9']);
    expect(r.doc.units[u2]).toBe(doc.units[u2]); // copy-on-write: untouched object identity kept
    expect(r.changed.units).toEqual([u1]);
  });

  it('rejects ops with unknown references, cycles and invalid sources', () => {
    const doc = base();
    const root = doc.rootSections[0];
    const child = doc.sections[root].children[0];
    const r = applyPatch(
      doc,
      parseRewriteResponse({
        ops: [
          { op: 'create_unit', ref: 'new:x', section: 'sec_999', content: 'x', origin: 'user', sources: ['b2'] },
          { op: 'update_section', id: root, parent: child },
          { op: 'create_unit', ref: 'new:y', section: child, content: 'hallucinated', origin: 'user', sources: ['b404'] },
        ],
      }).ops,
      ctx(['b2', 'b4', 'b5']),
    );
    expect(r.rejected.map((x) => x.reason).sort()).toEqual([
      'move would create a cycle',
      'unit has no valid source references',
      'unknown section "sec_999"',
    ]);
    expect(checkInvariants(r.doc)).toEqual([]);
  });

  it('reverts a deletion that would lose user content', () => {
    const doc = base();
    const [u1] = doc.sections[doc.sections[doc.rootSections[0]].children[0]].units;
    const r = apply(doc, [{ op: 'delete_unit', id: u1 }], ctx(['b2', 'b4', 'b5']));
    expect(r.restored).toEqual([u1]);
    expect(r.doc.units[u1]).toBeDefined();
    expect(r.uncovered).toEqual([]);
  });

  it('allows deletion when the content was merged into another unit', () => {
    const doc = base();
    const [u1, u2] = doc.sections[doc.sections[doc.rootSections[0]].children[0]].units;
    const r = apply(
      doc,
      [
        { op: 'update_unit', id: u1, content: 'Glycolysis occurs in the cytoplasm and does not require oxygen.', sources: ['b2', 'b5'] },
        { op: 'delete_unit', id: u2 },
      ],
      ctx(['b2', 'b4', 'b5']),
    );
    expect(r.restored).toEqual([]);
    expect(r.doc.units[u2]).toBeUndefined();
  });

  it('removes units whose source passages were deleted from the raw notes', () => {
    const doc = base();
    // b4 (ETC requires oxygen) deleted by the user; the model did nothing about it.
    const r = apply(doc, [], ctx(['b2', 'b5']));
    expect(r.autoRemoved).toHaveLength(2); // the user unit and the expansion anchored to it
    const titles = Object.values(r.doc.sections).map((s) => s.title);
    expect(titles).not.toContain('Electron Transport Chain'); // empty section pruned
  });

  it('does not treat facts that differ only in numbers as duplicates', () => {
    const doc = base();
    const gly = doc.sections[doc.sections[doc.rootSections[0]].children[0]];
    const r = apply(doc, [{ op: 'create_unit', ref: 'new:n', section: gly.id, content: 'Step 2 occurs in the cytoplasm.', origin: 'user', sources: ['b7'] }, { op: 'create_unit', ref: 'new:m', section: gly.id, content: 'Step 3 occurs in the cytoplasm.', origin: 'user', sources: ['b8'] }], ctx(['b2', 'b4', 'b5', 'b7', 'b8']));
    expect(r.deduped).toEqual([]);
    expect(Object.keys(r.doc.units)).toHaveLength(Object.keys(doc.units).length + 2);
  });

  it('merges duplicate units instead of creating a second copy', () => {
    const doc = base();
    const gly = doc.sections[doc.sections[doc.rootSections[0]].children[0]];
    const r = apply(doc, [{ op: 'create_unit', ref: 'new:d', section: gly.id, content: 'Glycolysis occurs in the cytoplasm.', origin: 'user', sources: ['b7'] }], ctx(['b2', 'b4', 'b5', 'b7']));
    expect(r.doc.units[gly.units[0]].sources).toEqual(['b2', 'b7']);
    expect(Object.keys(r.doc.units)).toHaveLength(Object.keys(doc.units).length);
  });

  it('supports moving units, merging and splitting sections', () => {
    const doc = base();
    const root = doc.sections[doc.rootSections[0]];
    const [gly, etc] = root.children;
    const etcUnits = doc.sections[etc].units;
    const r = apply(
      doc,
      [
        { op: 'create_section', ref: 'new:aer', title: 'Aerobic Stages', parent: root.id, after: gly },
        { op: 'move_unit', id: etcUnits[0], section: 'new:aer', after: null },
        { op: 'move_unit', id: etcUnits[1], section: 'new:aer', after: etcUnits[0] },
        { op: 'delete_section', id: etc },
        { op: 'update_section', id: gly, title: 'Glycolysis (Anaerobic Stage)' },
      ],
      ctx(['b2', 'b4', 'b5']),
    );
    const titles = r.doc.sections[root.id].children.map((c) => r.doc.sections[c].title);
    expect(titles).toEqual(['Glycolysis (Anaerobic Stage)', 'Aerobic Stages']);
    expect(r.rejected).toEqual([]);
  });

  it('refuses to delete a non-empty section', () => {
    const doc = base();
    const etc = doc.sections[doc.rootSections[0]].children[1];
    const r = applyPatch(doc, parseRewriteResponse({ ops: [{ op: 'delete_section', id: etc }] }).ops, ctx(['b2', 'b4', 'b5']));
    expect(r.rejected[0].reason).toMatch(/still contains units/);
    expect(r.doc.sections[etc]).toBeDefined();
  });

  it('honours the expansion setting', () => {
    const doc = base();
    const etc = doc.sections[doc.rootSections[0]].children[1];
    const r = applyPatch(
      doc,
      parseRewriteResponse({ ops: [{ op: 'create_unit', ref: 'new:e', section: etc, content: 'Extra background.', origin: 'expansion', sources: ['b4'] }] }).ops,
      ctx(['b2', 'b4', 'b5'], { allowExpansion: false }),
    );
    expect(r.rejected[0].reason).toBe('AI expansions are disabled');
  });

  it('reports uncovered passages and the fallback makes them visible', () => {
    const doc = base();
    const r = apply(doc, [], ctx(['b2', 'b4', 'b5', 'b8']));
    expect(r.uncovered).toEqual(['b8']);
    const withFallback = insertFallbackUnits(r.doc, [{ id: 'b8', text: 'fermentation regenerates NAD+' }], 2000, 2);
    expect(checkInvariants(withFallback)).toEqual([]);
    const sec = withFallback.sections[UNSORTED_SECTION_ID];
    expect(withFallback.units[sec.units[0]]).toMatchObject({ needsReview: true, sources: ['b8'], origin: 'user' });
    expect(withFallback.rootSections.at(-1)).toBe(UNSORTED_SECTION_ID);
  });

  it('retries ops that reference sections defined later in the patch', () => {
    const r = apply(
      emptyOrganizedDoc('d'),
      [
        { op: 'create_unit', ref: 'new:u', section: 'new:s', content: 'Fact.', origin: 'user', sources: ['b1'] },
        { op: 'create_section', ref: 'new:s', title: 'Topic', parent: null, after: null },
      ],
      ctx(['b1']),
    );
    expect(r.rejected).toEqual([]);
    expect(Object.values(r.doc.units)).toHaveLength(1);
  });

  it('limits nesting depth to 3', () => {
    const r = apply(
      emptyOrganizedDoc('d'),
      [
        { op: 'create_section', ref: 'new:a', title: 'A', parent: null },
        { op: 'create_section', ref: 'new:b', title: 'B', parent: 'new:a' },
        { op: 'create_section', ref: 'new:c', title: 'C', parent: 'new:b' },
        { op: 'create_section', ref: 'new:d', title: 'D', parent: 'new:c' },
        ...['a', 'b', 'c', 'd'].map((s, i) => ({ op: 'create_unit', ref: `new:u${i}`, section: `new:${s}`, content: `Fact ${s} about item ${i}`, origin: 'user', sources: ['b1'] })),
      ],
      ctx(['b1']),
    );
    const d = Object.values(r.doc.sections).find((s) => s.title === 'D')!;
    expect(r.doc.sections[d.parentId!].title).toBe('B');
  });
});

describe('schema helpers', () => {
  it('extracts JSON from fenced or chatty model output', () => {
    expect(extractJson('```json\n{"ops": []}\n```')).toEqual({ ops: [] });
    expect(extractJson('Sure! Here is the patch: {"ops": [], "title": null} Hope it helps.')).toEqual({ ops: [], title: null });
    expect(() => extractJson('no json here')).toThrow();
  });

  it('reports invalid ops individually instead of failing the whole patch', () => {
    const r = parseRewriteResponse({ ops: [{ op: 'create_unit', ref: 'x' }, { op: 'delete_unit', id: 'u_1' }, { op: 'drop_table' }] });
    expect(r.ops).toEqual([{ op: 'delete_unit', id: 'u_1' }]);
    expect(r.invalidOps).toHaveLength(2);
  });

  it('normalizes strict json_schema output (all keys present, null when unused)', () => {
    const full = { op: 'delete_unit', id: 'u_1', ref: null, title: null, parent: null, after: null, section: null, type: null, content: null, origin: null, sources: null, concepts: null, uncertain: null };
    const r = parseRewriteResponse(stripNullOpFields({ title: null, ops: [full] }));
    expect(r.ops).toEqual([{ op: 'delete_unit', id: 'u_1' }]);
  });
});

describe('applyPatch atomicity', () => {
  it('a rejected update_section leaves no partial change (title untouched)', () => {
    const doc = base();
    const root = doc.rootSections[0];
    const child = doc.sections[root].children[0];
    const r = applyPatch(doc, parseRewriteResponse({ ops: [{ op: 'update_section', id: root, title: 'Renamed', parent: child }] }).ops, ctx(['b2', 'b4', 'b5']));
    expect(r.rejected[0].reason).toBe('move would create a cycle');
    expect(r.doc.sections[root].title).toBe('Cellular Respiration');
  });
});
