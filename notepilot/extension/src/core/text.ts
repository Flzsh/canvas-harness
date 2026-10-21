/** Small, dependency-free text utilities shared by the diff, patch and context modules. */

/** cyrb53: fast, well-distributed 53-bit string hash. Not cryptographic; used for change detection. */
export function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Collapses whitespace so formatting-only edits are not treated as content changes. */
export function normalizeText(text: string): string {
  return text.replace(/[  -​  　]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** True if the text carries enough content to require representation in the organized notes. */
export function isSubstantive(text: string): boolean {
  const letters = text.match(/[\p{L}\p{N}]/gu);
  return !!letters && letters.length >= 2;
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = normalizeText(s).toLowerCase();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Sørensen–Dice coefficient on character bigrams (0..1). Robust to small edits and typos. */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let sizeA = 0;
  let sizeB = 0;
  A.forEach((v) => (sizeA += v));
  B.forEach((v) => (sizeB += v));
  if (sizeA + sizeB === 0) return 0;
  let overlap = 0;
  A.forEach((v, k) => {
    const w = B.get(k);
    if (w) overlap += Math.min(v, w);
  });
  return (2 * overlap) / (sizeA + sizeB);
}

const STOPWORDS = new Set(
  'a an the and or but if then else of to in on at by for with from as is are was were be been being it its this that these those there their they them he she we you i not no do does did doesnt dont can could should would will may might must has have had into over under than so such also very more most less least about via per vs eg ie etc which who whom whose what when where why how all any each both few other some own same just only'.split(
    ' ',
  ),
);

/** Lowercased content words with light plural stemming, for topic matching. */
export function contentWords(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}+'-]*/gu) ?? []) {
    let w = raw.replace(/'s$/, '');
    if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
    else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    out.push(w);
  }
  return out;
}

/** Jaccard similarity of word sets (0..1); used for duplicate detection. */
export function wordJaccard(a: string, b: string): number {
  const A = new Set(contentWords(a));
  const B = new Set(contentWords(b));
  if (A.size === 0 && B.size === 0) return a.trim() === b.trim() ? 1 : 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / (A.size + B.size - inter);
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

/** Rough token estimate (≈4 chars/token for English prose). Good enough for budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const NUMBER_RE = /\d+(?:[.,]\d+)?/g;

/**
 * Conservative near-duplicate test for organized units: word sets must be nearly identical, the
 * character-level similarity high, and all numbers equal ("Step 1 …" and "Step 2 …" are different facts).
 */
export function isNearDuplicate(a: string, b: string): boolean {
  const plain = (s: string) => normalizeText(s.replace(/[*_`~#>⟦⟧]/g, '')).toLowerCase();
  const na = plain(a);
  const nb = plain(b);
  if (na === nb) return true;
  const numsA = (na.match(NUMBER_RE) ?? []).sort().join('|');
  const numsB = (nb.match(NUMBER_RE) ?? []).sort().join('|');
  if (numsA !== numsB) return false;
  const tok = (s: string) => new Set(s.match(/[\p{L}\p{N}]+/gu) ?? []);
  const A = tok(na);
  const B = tok(nb);
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  const jac = inter / (A.size + B.size - inter || 1);
  return jac >= 0.9 && diceSimilarity(na, nb) >= 0.9;
}
