import { describe, expect, it } from 'vitest';
import { assignIdentities, diffById } from '../src/core/identity';
import { makeRawBlock } from '../src/core/docParser';
import type { SourceBlock } from '../src/core/types';

const raw = (...texts: string[]) => texts.map((t) => makeRawBlock('paragraph', t));
function minter() {
  let n = 0;
  return () => `b${++n}`;
}

describe('assignIdentities', () => {
  it('keeps ids stable when a paragraph is inserted at the top', () => {
    const mint = minter();
    const v1 = assignIdentities([], raw('alpha fact', 'beta fact'), mint).blocks;
    const v2 = assignIdentities(v1, raw('new first line', 'alpha fact', 'beta fact'), mint);
    expect(v2.blocks.map((b) => b.id)).toEqual(['b3', 'b1', 'b2']);
    expect(v2.stats).toMatchObject({ added: 1, unchanged: 2, removed: 0 });
  });

  it('treats an edited paragraph as modified (same id)', () => {
    const mint = minter();
    const v1 = assignIdentities([], raw('mitochondria makes ATP', 'glycolysis in cytoplasm', 'krebs produces nadh'), mint).blocks;
    const v2 = assignIdentities(v1, raw('mitochondria makes ATP', 'glycolysis happens in the cytoplasm', 'krebs produces nadh'), mint);
    expect(v2.blocks.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
    expect(v2.stats.modified).toBe(1);
    const d = diffById(v1, v2.blocks);
    expect(d.modified.map((m) => m.after.id)).toEqual(['b2']);
    expect(d.added).toHaveLength(0);
  });

  it('detects deletions and replacements', () => {
    const mint = minter();
    const v1 = assignIdentities([], raw('one fact here', 'two fact here', 'three fact here'), mint).blocks;
    const v2 = assignIdentities(v1, raw('one fact here', 'completely different statement', 'three fact here'), mint);
    const d = diffById(v1, v2.blocks);
    expect(d.removed.map((b) => b.id)).toEqual(['b2']);
    expect(d.added.map((b) => b.text)).toEqual(['completely different statement']);
  });

  it('keeps the id of moved paragraphs and reports no content change', () => {
    const mint = minter();
    const v1 = assignIdentities([], raw('A first', 'B second', 'C third', 'D fourth'), mint).blocks;
    const v2 = assignIdentities(v1, raw('C third', 'A first', 'B second', 'D fourth'), mint);
    expect(v2.blocks.map((b) => b.id)).toEqual(['b3', 'b1', 'b2', 'b4']);
    expect(diffById(v1, v2.blocks)).toEqual({ added: [], modified: [], removed: [] });
  });

  it('handles duplicate lines without id collisions', () => {
    const mint = minter();
    const v1 = assignIdentities([], raw('same', 'same', 'other'), mint).blocks;
    const v2 = assignIdentities(v1, raw('same', 'other', 'same', 'same'), mint);
    const ids = v2.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(4);
    expect(diffById(v1, v2.blocks).added).toHaveLength(1);
  });

  it('scales to long documents', () => {
    const mint = minter();
    const texts = Array.from({ length: 3000 }, (_, i) => `note number ${i} about topic ${i % 37}`);
    const v1 = assignIdentities([], raw(...texts), mint).blocks;
    const edited = [...texts];
    edited.splice(1500, 1, 'note number 1500 about topic 20 — edited with more words');
    edited.splice(10, 0, 'inserted line');
    const t0 = performance.now();
    const v2 = assignIdentities(v1, raw(...edited), mint);
    expect(performance.now() - t0).toBeLessThan(1500);
    const d = diffById(v1, v2.blocks);
    expect(d.added.map((b) => b.text)).toEqual(['inserted line']);
    expect(d.modified).toHaveLength(1);
  });

  it('diffById ignores pure reordering but reports text changes', () => {
    const a: SourceBlock[] = [
      { id: 'b1', kind: 'paragraph', text: 'x', hash: 'h1' },
      { id: 'b2', kind: 'paragraph', text: 'y', hash: 'h2' },
    ];
    const b: SourceBlock[] = [
      { id: 'b2', kind: 'paragraph', text: 'y', hash: 'h2' },
      { id: 'b1', kind: 'paragraph', text: 'x!', hash: 'h3' },
    ];
    const d = diffById(a, b);
    expect(d.modified.map((m) => m.after.id)).toEqual(['b1']);
  });
});
