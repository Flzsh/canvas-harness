import type { RawBlock, SourceBlock } from './types';
import { diceSimilarity } from './text';

/**
 * Assigns stable ids to freshly parsed blocks by matching them against the previous snapshot.
 *
 * Google Docs does not expose paragraph ids, so identity is reconstructed on every fetch:
 *  1. exact matches in order (common prefix/suffix + LCS over content hashes),
 *  2. exact matches out of order (moved paragraphs keep their id → no AI work needed),
 *  3. fuzzy matches inside each changed region (edited paragraphs keep their id → "modified"),
 *  4. everything else gets a fresh id ("added"); unmatched old blocks are "removed".
 *
 * Stable ids are what let the organized notes keep precise source references while the raw
 * notes keep changing underneath them.
 */

export interface IdentityStats {
  unchanged: number;
  moved: number;
  modified: number;
  added: number;
  removed: number;
}

export interface IdentityResult {
  blocks: SourceBlock[];
  stats: IdentityStats;
}

const FUZZY_THRESHOLD = 0.5;
const GLOBAL_FUZZY_THRESHOLD = 0.8;
const LCS_CELL_LIMIT = 4_000_000;

function kindsCompatible(a: RawBlock, b: RawBlock): boolean {
  if (a.kind === b.kind) return true;
  const prose = new Set(['paragraph', 'list_item', 'heading']);
  return prose.has(a.kind) && prose.has(b.kind);
}

/** Longest common subsequence over hashes; returns matched [oldIdx, newIdx] pairs (ascending). */
function lcsPairs(oldH: string[], newH: string[]): [number, number][] {
  const n = oldH.length;
  const m = newH.length;
  if (n === 0 || m === 0) return [];
  if (n * m > LCS_CELL_LIMIT) {
    // Greedy monotone matching for very large rewrites: O(n + m).
    const pos = new Map<string, number[]>();
    oldH.forEach((h, i) => (pos.get(h) ?? pos.set(h, []).get(h)!).push(i));
    const pairs: [number, number][] = [];
    let last = -1;
    for (let j = 0; j < m; j++) {
      const list = pos.get(newH[j]);
      if (!list) continue;
      const k = list.findIndex((i) => i > last);
      if (k >= 0) {
        last = list[k];
        pairs.push([last, j]);
        list.splice(k, 1);
      }
    }
    return pairs;
  }
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldH[i] === newH[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldH[i] === newH[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

export function assignIdentities(prev: SourceBlock[], next: RawBlock[], mintId: () => string): IdentityResult {
  const stats: IdentityStats = { unchanged: 0, moved: 0, modified: 0, added: 0, removed: 0 };
  const assigned: (string | null)[] = new Array(next.length).fill(null);
  const oldUsed = new Array(prev.length).fill(false);

  // 1a. Common prefix / suffix (the common case: one paragraph edited in place).
  let start = 0;
  while (start < prev.length && start < next.length && prev[start].hash === next[start].hash) {
    assigned[start] = prev[start].id;
    oldUsed[start] = true;
    start++;
  }
  let endOld = prev.length - 1;
  let endNew = next.length - 1;
  while (endOld >= start && endNew >= start && prev[endOld].hash === next[endNew].hash) {
    assigned[endNew] = prev[endOld].id;
    oldUsed[endOld] = true;
    endOld--;
    endNew--;
  }

  // 1b. LCS over the middle region.
  const midOld = prev.slice(start, endOld + 1);
  const midNew = next.slice(start, endNew + 1);
  const anchors = lcsPairs(
    midOld.map((b) => b.hash),
    midNew.map((b) => b.hash),
  ).map(([i, j]) => [i + start, j + start] as [number, number]);
  for (const [i, j] of anchors) {
    assigned[j] = prev[i].id;
    oldUsed[i] = true;
  }
  stats.unchanged = assigned.filter(Boolean).length;

  // 2. Moved blocks: identical content, different position.
  const unusedOldByHash = new Map<string, number[]>();
  prev.forEach((b, i) => {
    if (!oldUsed[i]) (unusedOldByHash.get(b.hash) ?? unusedOldByHash.set(b.hash, []).get(b.hash)!).push(i);
  });
  next.forEach((b, j) => {
    if (assigned[j]) return;
    const list = unusedOldByHash.get(b.hash);
    if (list?.length) {
      const i = list.shift()!;
      assigned[j] = prev[i].id;
      oldUsed[i] = true;
      stats.moved++;
    }
  });

  // 3. Fuzzy matching within each changed region (between consecutive in-order anchors).
  const allAnchors: [number, number][] = [[-1, -1]];
  for (let k = 0; k < start; k++) allAnchors.push([k, k]);
  allAnchors.push(...anchors);
  for (let k = 0; endNew + 1 + k < next.length; k++) allAnchors.push([endOld + 1 + k, endNew + 1 + k]);
  allAnchors.push([prev.length, next.length]);
  allAnchors.sort((a, b) => a[1] - b[1]);

  const fuzzyPair = (oldIdx: number[], newIdx: number[], threshold: number) => {
    const cands: { i: number; j: number; s: number }[] = [];
    for (const j of newIdx) {
      for (const i of oldIdx) {
        if (!kindsCompatible(prev[i], next[j])) continue;
        const s = diceSimilarity(prev[i].text, next[j].text);
        if (s >= threshold) cands.push({ i, j, s });
      }
    }
    cands.sort((a, b) => b.s - a.s || Math.abs(a.i - a.j) - Math.abs(b.i - b.j));
    for (const c of cands) {
      if (oldUsed[c.i] || assigned[c.j]) continue;
      assigned[c.j] = prev[c.i].id;
      oldUsed[c.i] = true;
      stats.modified++;
    }
  };

  for (let k = 0; k < allAnchors.length - 1; k++) {
    const [oi0, nj0] = allAnchors[k];
    const [oi1, nj1] = allAnchors[k + 1];
    const oldIdx: number[] = [];
    const newIdx: number[] = [];
    for (let i = oi0 + 1; i < oi1 && i < prev.length; i++) if (i >= 0 && !oldUsed[i]) oldIdx.push(i);
    for (let j = nj0 + 1; j < nj1 && j < next.length; j++) if (j >= 0 && !assigned[j]) newIdx.push(j);
    if (oldIdx.length && newIdx.length && oldIdx.length * newIdx.length <= 40_000) {
      fuzzyPair(oldIdx, newIdx, FUZZY_THRESHOLD);
    }
  }

  // 3b. Global high-confidence fuzzy pass (moved *and* edited).
  const leftoverOld = prev.map((_, i) => i).filter((i) => !oldUsed[i]);
  const leftoverNew = next.map((_, j) => j).filter((j) => !assigned[j]);
  if (leftoverOld.length && leftoverNew.length && leftoverOld.length * leftoverNew.length <= 40_000) {
    fuzzyPair(leftoverOld, leftoverNew, GLOBAL_FUZZY_THRESHOLD);
  }

  // 4. New blocks.
  const blocks: SourceBlock[] = next.map((b, j) => {
    let id = assigned[j];
    if (!id) {
      id = mintId();
      stats.added++;
    }
    return { ...b, id };
  });
  stats.removed = oldUsed.filter((u) => !u).length;
  return { blocks, stats };
}

export interface BlockDiff {
  added: SourceBlock[];
  modified: { before: SourceBlock; after: SourceBlock }[];
  removed: SourceBlock[];
}

/** Content changes between two snapshots that share block identities. Pure moves are not changes. */
export function diffById(from: SourceBlock[], to: SourceBlock[]): BlockDiff {
  const fromMap = new Map(from.map((b) => [b.id, b]));
  const toIds = new Set(to.map((b) => b.id));
  const added: SourceBlock[] = [];
  const modified: { before: SourceBlock; after: SourceBlock }[] = [];
  for (const b of to) {
    const old = fromMap.get(b.id);
    if (!old) added.push(b);
    else if (old.hash !== b.hash) modified.push({ before: old, after: b });
  }
  const removed = from.filter((b) => !toIds.has(b.id));
  return { added, modified, removed };
}

export function isEmptyDiff(d: BlockDiff): boolean {
  return d.added.length === 0 && d.modified.length === 0 && d.removed.length === 0;
}
