/**
 * Core data model for NotePilot AI.
 *
 * Two parallel representations are maintained:
 *  - SourceSnapshot: a read-only, parsed view of the user's Google Doc (the source of truth).
 *  - OrganizedDoc:   the AI-maintained, rewritten and reorganized document shown in the side panel.
 *
 * Every OrgUnit references the SourceBlock ids it was derived from, which is what makes
 * traceability, reconciliation after edits/deletions, and loss-prevention possible.
 */

export type BlockKind = 'paragraph' | 'heading' | 'list_item' | 'table' | 'other';

/** A paragraph-level piece of the original document, with a stable identity across edits. */
export interface SourceBlock {
  id: string;
  kind: BlockKind;
  text: string;
  /** Heading level (1-6) or list nesting level (0-based). */
  level?: number;
  /** Hash of the normalized text + kind. Whitespace-only edits do not change it. */
  hash: string;
}

/** A parsed block before identity assignment. */
export type RawBlock = Omit<SourceBlock, 'id'>;

export interface SourceSnapshot {
  docId: string;
  title: string;
  revisionId: string | null;
  fetchedAt: number;
  /** Local, monotonically increasing version, bumped whenever content changes. */
  version: number;
  contentHash: string;
  blocks: SourceBlock[];
}

/** Type 1 / Type 2 / Type 3 content (see spec §10). */
export type UnitOrigin = 'user' | 'clarification' | 'expansion';

export type UnitType = 'paragraph' | 'list' | 'table' | 'equation' | 'definition' | 'example' | 'callout';

export interface OrgUnit {
  id: string;
  sectionId: string;
  type: UnitType;
  /** Restricted markdown (GFM + $math$), never raw HTML. */
  content: string;
  origin: UnitOrigin;
  /** SourceBlock ids this unit is derived from (or, for expansions, anchored to). */
  sources: string[];
  /** Key concepts this unit is about (used for concept tracking & related-concept lookups). */
  concepts: string[];
  /** Set when the source shorthand was ambiguous; describes the uncertainty instead of guessing. */
  uncertain?: string;
  /** Raw placeholder inserted by the integrity safety net; to be organized on a later pass. */
  needsReview?: boolean;
  createdAt: number;
  updatedAt: number;
  /** SourceSnapshot.version this unit was last written against. */
  sourceVersion: number;
}

export interface OrgSection {
  id: string;
  title: string;
  parentId: string | null;
  /** Ordered child section ids. */
  children: string[];
  /** Ordered unit ids. */
  units: string[];
  createdAt: number;
  updatedAt: number;
}

export interface OrganizedDoc {
  docId: string;
  title: string;
  version: number;
  rootSections: string[];
  sections: Record<string, OrgSection>;
  units: Record<string, OrgUnit>;
  /** Counter used to mint ids for sections/units. */
  nextId: number;
  updatedAt: number;
}

export type InsightCategory = 'connection' | 'deeper' | 'error' | 'gap' | 'practice';

export interface Insight {
  id: string;
  category: InsightCategory;
  title: string;
  body: string;
  sectionIds: string[];
  unitIds: string[];
  confidence: 'low' | 'medium' | 'high';
  /** True for factual claims that were not checked against an approved retrieval source. */
  needsVerification: boolean;
  severity?: 'low' | 'medium' | 'high';
  question?: { prompt: string; answer?: string };
  createdAt: number;
  updatedAt: number;
  orgVersion: number;
}

export interface UnitChange {
  units: string[];
  sections: string[];
}

export function emptyOrganizedDoc(docId: string, now = Date.now()): OrganizedDoc {
  return { docId, title: '', version: 0, rootSections: [], sections: {}, units: {}, nextId: 1, updatedAt: now };
}

export const UNSORTED_SECTION_ID = 'sec_unsorted';
