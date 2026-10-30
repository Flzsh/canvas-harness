import { z } from 'zod';
import { stripFills } from './fills';
import { UNSORTED_SECTION_ID, type OrganizedDoc } from './types';

/**
 * On-demand study summary of the organized notes ("Summary" button). It follows the organized
 * notes' own outline (same sections, order, titles and numbers) with each section shortened to a
 * few bullets, steps or a small table, so it reads like a condensed version of the rewrite. It is
 * generated only when the user asks for it, shown at the top of the notes, and included in the
 * companion Google Doc.
 */
export interface SummarySection {
  sectionId: string;
  /** Title, number ("2.1") and depth (1-3) of the organized section when the summary was made. */
  title: string;
  number: string;
  depth: number;
  /** Restricted markdown: a few bullets, numbered steps or a compact table. Null for a heading kept only to place its summarized subsections. */
  content: string | null;
}

export interface DocSummary {
  /** One or two sentences: the big picture. */
  overview: string;
  /** The notes condensed section by section, in the notes' order. */
  sections: SummarySection[];
  /** Key terms with a short meaning, linked to sections. */
  keyTerms: { term: string; definition: string; sectionIds: string[] }[];
  /** What to look at again: unclear spots, possible errors, gaps (drawn from the notes and insights). */
  review: { text: string; sectionIds: string[] }[];
  /** OrganizedDoc.version the summary describes (older ⇒ "notes changed since this summary"). */
  orgVersion: number;
  createdAt: number;
}

export const SUMMARY_LIMITS = { sections: 16, sectionChars: 900, keyTerms: 8, review: 3 } as const;

/** Summaries saved by earlier versions (a flat list of key points) are not shown; the next Summarize replaces them. */
export function isCurrentSummary(x: unknown): x is DocSummary {
  return !!x && Array.isArray((x as DocSummary).sections);
}

/** Section numbers as the notes view shows them ("1", "1.2"), in document order. The unsorted section has none. */
export function sectionNumbers(doc: OrganizedDoc): Map<string, { number: string; depth: number }> {
  const out = new Map<string, { number: string; depth: number }>();
  const visit = (id: string, depth: number, number: string) => {
    const s = doc.sections[id];
    if (!s) return;
    out.set(id, { number, depth });
    s.children.forEach((c, i) => visit(c, depth + 1, `${number}.${i + 1}`));
  };
  let n = 0;
  doc.rootSections.forEach((id) => visit(id, 1, id === UNSORTED_SECTION_ID ? '' : String(++n)));
  return out;
}

const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Cleans a section's markdown: no AI-fill markers, no headings (the summary has its own), whole lines up to `max` characters so lists and tables stay valid. */
function sectionContent(md: string, max: number): string {
  const lines = stripFills(md)
    .split('\n')
    .filter((l) => !/^\s{0,3}#{1,6}\s/.test(l));
  const out: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length > max && out.length) break;
    out.push(line);
    used += line.length + 1;
  }
  // A table cut right after its header row would render as an empty table.
  if (out.length >= 2 && TABLE_RULE.test(out[out.length - 1])) out.splice(-2);
  return out.join('\n').trim();
}

const str = (max: number) =>
  z
    .string()
    .transform(stripFills)
    .pipe(z.string().trim().min(1).max(max * 3))
    .transform((s) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s));
const ids = z.array(z.string()).max(6).optional().default([]);

const summaryResponse = z.object({
  overview: str(400),
  sections: z.array(z.object({ section: z.string(), content: z.string().max(SUMMARY_LIMITS.sectionChars * 3) })).max(60),
  key_terms: z.array(z.object({ term: str(80), definition: str(160), sections: ids })).max(30).optional().default([]),
  review: z.array(z.object({ text: str(200), sections: ids })).max(12).optional().default([]),
});

/** Validates model output, puts sections in the notes' order, drops references to sections that don't exist, and enforces the limits. */
export function parseSummaryResponse(json: unknown, doc: OrganizedDoc, now = Date.now()): DocSummary {
  const r = summaryResponse.parse(json);
  const keep = (list: string[]) => [...new Set(list.filter((id) => doc.sections[id]))];
  const numbers = sectionNumbers(doc);

  const content = new Map<string, string>();
  for (const e of r.sections) {
    if (content.size >= SUMMARY_LIMITS.sections) break;
    if (!numbers.has(e.section) || content.has(e.section)) continue;
    const text = sectionContent(e.content, SUMMARY_LIMITS.sectionChars);
    if (text) content.set(e.section, text);
  }
  if (!content.size) throw new Error('the summary has no sections that match the notes');

  // Ancestors of summarized sections stay as headings, so the summary keeps the notes' outline.
  const shown = new Set<string>();
  for (const id of content.keys()) {
    for (let s: string | null = id; s && !shown.has(s); s = doc.sections[s]?.parentId ?? null) shown.add(s);
  }

  return {
    overview: r.overview,
    sections: [...numbers]
      .filter(([id]) => shown.has(id))
      .map(([id, { number, depth }]) => ({ sectionId: id, title: doc.sections[id].title, number, depth, content: content.get(id) ?? null })),
    keyTerms: r.key_terms.slice(0, SUMMARY_LIMITS.keyTerms).map((t) => ({ term: t.term, definition: t.definition, sectionIds: keep(t.sections) })),
    review: r.review.slice(0, SUMMARY_LIMITS.review).map((p) => ({ text: p.text, sectionIds: keep(p.sections) })),
    orgVersion: doc.version,
    createdAt: now,
  };
}
