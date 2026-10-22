import type { PatchOp } from './schema';
import type { OrgSection, OrgUnit, OrganizedDoc, UnitChange, UnitOrigin } from './types';
import { UNSORTED_SECTION_ID } from './types';
import { isNearDuplicate, truncate } from './text';

/**
 * Applies AI-produced patch operations to the organized document.
 *
 * Guarantees enforced here (independently of what the model returns):
 *  - referential integrity (sections/units/sources must exist; no section cycles; bounded depth),
 *  - copy-on-write: unchanged sections/units keep object identity, so the UI re-renders only
 *    what actually changed,
 *  - no silent loss: a deletion that would leave a source passage unrepresented is reverted,
 *  - reconciliation: units whose source passages were deleted from the raw notes are removed,
 *  - duplicate detection: near-identical units are merged,
 *  - coverage report: every substantive source passage must be cited by a user/clarification unit;
 *    whatever is not covered is returned so the caller can repair it.
 */

export interface ApplyContext {
  /** Block ids that exist in the source snapshot this patch is applied against. */
  validSourceIds: Set<string>;
  /** Substantive (non-heading) block ids that must be represented. */
  requiredSourceIds: string[];
  now: number;
  sourceVersion: number;
  allowExpansion: boolean;
  maxDepth?: number;
}

export interface ApplyResult {
  doc: OrganizedDoc;
  applied: number;
  rejected: { op: unknown; reason: string }[];
  restored: string[];
  autoRemoved: string[];
  deduped: string[];
  uncovered: string[];
  changed: UnitChange;
}

const isFactual = (o: UnitOrigin) => o === 'user' || o === 'clarification';

class Draft {
  sections: Record<string, OrgSection>;
  units: Record<string, OrgUnit>;
  rootSections: string[];
  nextId: number;
  title: string;
  private copiedSections = new Set<string>();
  private copiedUnits = new Set<string>();

  constructor(private base: OrganizedDoc) {
    this.sections = { ...base.sections };
    this.units = { ...base.units };
    this.rootSections = [...base.rootSections];
    this.nextId = base.nextId;
    this.title = base.title;
  }

  mintId(prefix: 'sec' | 'u'): string {
    let id: string;
    do id = `${prefix}_${this.nextId++}`;
    while (this.sections[id] || this.units[id]);
    return id;
  }

  /** Returns a mutable copy of a section (copy-on-write). */
  sec(id: string): OrgSection {
    if (!this.copiedSections.has(id)) {
      const s = this.sections[id];
      this.sections[id] = { ...s, children: [...s.children], units: [...s.units] };
      this.copiedSections.add(id);
    }
    return this.sections[id];
  }

  unit(id: string): OrgUnit {
    if (!this.copiedUnits.has(id)) {
      const u = this.units[id];
      this.units[id] = { ...u, sources: [...u.sources], concepts: [...u.concepts] };
      this.copiedUnits.add(id);
    }
    return this.units[id];
  }

  markNewSection(id: string) {
    this.copiedSections.add(id);
  }
  markNewUnit(id: string) {
    this.copiedUnits.add(id);
  }

  siblings(parentId: string | null): string[] {
    return parentId === null ? this.rootSections : this.sec(parentId).children;
  }

  depth(id: string): number {
    let d = 1;
    let p = this.sections[id]?.parentId ?? null;
    while (p) {
      d++;
      p = this.sections[p]?.parentId ?? null;
    }
    return d;
  }

  height(id: string): number {
    const s = this.sections[id];
    if (!s || s.children.length === 0) return 1;
    return 1 + Math.max(...s.children.map((c) => this.height(c)));
  }

  isDescendant(candidate: string, ancestor: string): boolean {
    let p: string | null = candidate;
    while (p) {
      if (p === ancestor) return true;
      p = this.sections[p]?.parentId ?? null;
    }
    return false;
  }

  sectionUnitIds(sectionId: string): string[] {
    return this.sections[sectionId]?.units ?? [];
  }

  finalize(changedTitle: boolean, now: number): OrganizedDoc {
    return {
      ...this.base,
      title: this.title,
      sections: this.sections,
      units: this.units,
      rootSections: this.rootSections,
      nextId: this.nextId,
      version: this.base.version + 1,
      updatedAt: changedTitle || this.copiedSections.size || this.copiedUnits.size ? now : this.base.updatedAt,
    };
  }
}

function insertAfter(arr: string[], id: string, after: string | null | undefined): void {
  const existing = arr.indexOf(id);
  if (existing >= 0) arr.splice(existing, 1);
  if (after === null) {
    arr.unshift(id);
    return;
  }
  const idx = after === undefined ? -1 : arr.indexOf(after);
  if (idx < 0) arr.push(id);
  else arr.splice(idx + 1, 0, id);
}

function removeFrom(arr: string[], id: string): number {
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1);
  return i;
}

class Rejection extends Error {
  constructor(
    msg: string,
    readonly retryable = false,
  ) {
    super(msg);
  }
}

export function applyPatch(doc: OrganizedDoc, ops: PatchOp[], ctx: ApplyContext, newTitle?: string | null): ApplyResult {
  const maxDepth = ctx.maxDepth ?? 3;
  const d = new Draft(doc);
  const refMap = new Map<string, string>();
  const rejected: { op: unknown; reason: string }[] = [];
  const deleted: { unit: OrgUnit; sectionId: string; index: number }[] = [];
  const touchedUnits = new Set<string>();
  let applied = 0;

  const resolve = (x: string | null | undefined): string | null | undefined =>
    x === null || x === undefined ? x : refMap.get(x) ?? x;
  const needSection = (x: string, retryable = true): string => {
    const id = resolve(x)!;
    if (!d.sections[id]) throw new Rejection(`unknown section "${x}"`, retryable);
    return id;
  };
  const needUnit = (x: string): string => {
    const id = resolve(x)!;
    if (!d.units[id]) throw new Rejection(`unknown unit "${x}"`, true);
    return id;
  };
  const validSources = (list: string[]) => [...new Set(list.filter((s) => ctx.validSourceIds.has(s)))];

  const applyOne = (op: PatchOp): void => {
    switch (op.op) {
      case 'create_section': {
        let parent = op.parent ? needSection(op.parent) : null;
        while (parent && d.depth(parent) >= maxDepth) parent = d.sections[parent].parentId;
        const existing = Object.values(d.sections).find(
          (s) => s.parentId === parent && s.title.trim().toLowerCase() === op.title.trim().toLowerCase(),
        );
        if (existing) {
          // Same title under the same parent: reuse instead of creating a duplicate section.
          refMap.set(op.ref, existing.id);
          return;
        }
        const id = d.mintId('sec');
        d.sections[id] = { id, title: op.title.trim(), parentId: parent, children: [], units: [], createdAt: ctx.now, updatedAt: ctx.now };
        d.markNewSection(id);
        insertAfter(d.siblings(parent), id, resolve(op.after));
        refMap.set(op.ref, id);
        return;
      }
      case 'update_section': {
        const id = needSection(op.id);
        // Validate everything before mutating, so a rejected op leaves no partial change.
        const newParent = op.parent === undefined ? undefined : op.parent === null ? null : needSection(op.parent);
        if (newParent) {
          if (d.isDescendant(newParent, id)) throw new Rejection('move would create a cycle');
          if (d.depth(newParent) + d.height(id) > maxDepth) throw new Rejection('move would exceed maximum depth');
        } else if (newParent === null && d.height(id) > maxDepth) throw new Rejection('move would exceed maximum depth');
        const s = d.sec(id);
        if (op.title && op.title.trim() !== s.title) s.title = op.title.trim();
        if (newParent !== undefined) {
          if (newParent !== s.parentId) {
            removeFrom(d.siblings(s.parentId), id);
            s.parentId = newParent;
          }
          insertAfter(d.siblings(newParent), id, op.after === undefined ? undefined : resolve(op.after));
        } else if (op.after !== undefined) {
          insertAfter(d.siblings(s.parentId), id, resolve(op.after));
        }
        s.updatedAt = ctx.now;
        return;
      }
      case 'delete_section': {
        const id = needSection(op.id, false);
        const s = d.sections[id];
        if (s.units.length > 0) throw new Rejection('section still contains units; move or delete them first');
        const siblings = d.siblings(s.parentId);
        const idx = removeFrom(siblings, id);
        // Lift any child sections into the deleted section's position.
        s.children.forEach((child, k) => {
          d.sec(child).parentId = s.parentId;
          siblings.splice(Math.max(0, idx) + k, 0, child);
        });
        delete d.sections[id];
        return;
      }
      case 'create_unit': {
        const sectionId = needSection(op.section);
        if (op.origin === 'expansion' && !ctx.allowExpansion) throw new Rejection('AI expansions are disabled');
        const sources = validSources(op.sources);
        if (sources.length === 0) throw new Rejection('unit has no valid source references');
        const content = op.content.trim();
        // Duplicate detection: merge into an existing near-identical unit of the same kind.
        const dup = Object.values(d.units).find(
          (u) => isFactual(u.origin) === isFactual(op.origin) && isNearDuplicate(u.content, content),
        );
        if (dup) {
          const u = d.unit(dup.id);
          u.sources = [...new Set([...u.sources, ...sources])];
          u.updatedAt = ctx.now;
          touchedUnits.add(dup.id);
          refMap.set(op.ref, dup.id);
          return;
        }
        const id = d.mintId('u');
        d.units[id] = {
          id,
          sectionId,
          type: op.type,
          content,
          origin: op.origin,
          sources,
          concepts: op.concepts ?? [],
          uncertain: op.uncertain || undefined,
          createdAt: ctx.now,
          updatedAt: ctx.now,
          sourceVersion: ctx.sourceVersion,
        };
        d.markNewUnit(id);
        touchedUnits.add(id);
        const after = resolve(op.after);
        insertAfter(d.sec(sectionId).units, id, after === null || (after && d.units[after]?.sectionId === sectionId) ? after : undefined);
        refMap.set(op.ref, id);
        return;
      }
      case 'update_unit': {
        const id = needUnit(op.id);
        const u = d.unit(id);
        if (op.origin && op.origin !== u.origin) {
          if (op.origin === 'expansion' && !ctx.allowExpansion) throw new Rejection('AI expansions are disabled');
          u.origin = op.origin;
        }
        if (op.content !== undefined) u.content = op.content.trim();
        if (op.type) u.type = op.type;
        if (op.sources) {
          const s = validSources(op.sources);
          if (s.length) u.sources = s;
        }
        if (op.concepts) u.concepts = op.concepts;
        if (op.uncertain !== undefined) u.uncertain = op.uncertain || undefined;
        u.needsReview = undefined;
        u.updatedAt = ctx.now;
        u.sourceVersion = ctx.sourceVersion;
        touchedUnits.add(id);
        return;
      }
      case 'move_unit': {
        const id = needUnit(op.id);
        const target = needSection(op.section);
        const u = d.unit(id);
        removeFrom(d.sec(u.sectionId).units, id);
        u.sectionId = target;
        const after = resolve(op.after);
        insertAfter(d.sec(target).units, id, after === null || (after && d.units[after]?.sectionId === target) ? after : undefined);
        u.updatedAt = ctx.now;
        touchedUnits.add(id);
        return;
      }
      case 'delete_unit': {
        const id = needUnit(op.id);
        const u = d.units[id];
        const index = removeFrom(d.sec(u.sectionId).units, id);
        deleted.push({ unit: u, sectionId: u.sectionId, index });
        delete d.units[id];
        return;
      }
    }
  };

  // Ops are applied in order; ops that reference something defined later are retried once.
  let pending: PatchOp[] = ops;
  for (let pass = 0; pass < 2 && pending.length; pass++) {
    const retry: PatchOp[] = [];
    for (const op of pending) {
      try {
        applyOne(op);
        applied++;
      } catch (e) {
        if (e instanceof Rejection && e.retryable && pass === 0) retry.push(op);
        else rejected.push({ op, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    pending = retry;
  }

  const ensureUnsorted = (): string => {
    if (!d.sections[UNSORTED_SECTION_ID]) {
      d.sections[UNSORTED_SECTION_ID] = {
        id: UNSORTED_SECTION_ID,
        title: 'Not Yet Organized',
        parentId: null,
        children: [],
        units: [],
        createdAt: ctx.now,
        updatedAt: ctx.now,
      };
      d.markNewSection(UNSORTED_SECTION_ID);
      d.rootSections.push(UNSORTED_SECTION_ID);
    }
    return UNSORTED_SECTION_ID;
  };

  // 1. Revert deletions that would lose user content.
  const coverage = () => {
    const c = new Map<string, number>();
    for (const u of Object.values(d.units)) if (isFactual(u.origin)) for (const s of u.sources) c.set(s, (c.get(s) ?? 0) + 1);
    return c;
  };
  const restored: string[] = [];
  if (deleted.length) {
    const cov = coverage();
    for (const del of deleted.reverse()) {
      if (!isFactual(del.unit.origin)) continue;
      const lost = del.unit.sources.filter((s) => ctx.validSourceIds.has(s) && !cov.get(s));
      if (!lost.length) continue;
      const sectionId = d.sections[del.sectionId] ? del.sectionId : ensureUnsorted();
      d.units[del.unit.id] = { ...del.unit, sectionId };
      const arr = d.sec(sectionId).units;
      arr.splice(Math.min(Math.max(del.index, 0), arr.length), 0, del.unit.id);
      for (const s of del.unit.sources) cov.set(s, (cov.get(s) ?? 0) + 1);
      restored.push(del.unit.id);
      rejected.push({ op: { op: 'delete_unit', id: del.unit.id }, reason: 'deletion reverted: it would remove content still present in the notes' });
    }
  }

  // 2. Reconcile with the source: drop references to passages that no longer exist.
  const autoRemoved: string[] = [];
  for (const u of Object.values(d.units)) {
    if (u.sources.every((s) => ctx.validSourceIds.has(s))) continue;
    const kept = u.sources.filter((s) => ctx.validSourceIds.has(s));
    if (kept.length === 0) {
      removeFrom(d.sec(u.sectionId).units, u.id);
      delete d.units[u.id];
      autoRemoved.push(u.id);
    } else {
      d.unit(u.id).sources = kept;
    }
  }

  // 3. Duplicate detection among units touched by this patch.
  const deduped: string[] = [];
  for (const id of touchedUnits) {
    const u = d.units[id];
    if (!u) continue;
    for (const other of Object.values(d.units)) {
      if (other.id === id || isFactual(other.origin) !== isFactual(u.origin)) continue;
      if (!isNearDuplicate(other.content, u.content)) continue;
      // Keep the older unit (stable position); merge sources from the newer one.
      const [keep, drop] = other.createdAt <= u.createdAt ? [other, u] : [u, other];
      d.unit(keep.id).sources = [...new Set([...keep.sources, ...drop.sources])];
      removeFrom(d.sec(drop.sectionId).units, drop.id);
      delete d.units[drop.id];
      deduped.push(drop.id);
      break;
    }
  }

  // 4. Prune sections left empty.
  let pruned = true;
  while (pruned) {
    pruned = false;
    for (const s of Object.values(d.sections)) {
      if (s.units.length === 0 && s.children.length === 0) {
        removeFrom(d.siblings(s.parentId), s.id);
        delete d.sections[s.id];
        pruned = true;
      }
    }
  }

  if (newTitle && newTitle.trim() && newTitle.trim() !== d.title) d.title = newTitle.trim();

  const result = d.finalize(!!newTitle && newTitle.trim() !== doc.title, ctx.now);

  // 5. Coverage.
  const cov = coverageOf(result);
  const uncovered = ctx.requiredSourceIds.filter((s) => !cov.has(s));

  return {
    doc: result,
    applied,
    rejected,
    restored,
    autoRemoved,
    deduped,
    uncovered,
    changed: changedBetween(doc, result),
  };
}

export function coverageOf(doc: OrganizedDoc): Set<string> {
  const s = new Set<string>();
  for (const u of Object.values(doc.units)) if (isFactual(u.origin)) u.sources.forEach((x) => s.add(x));
  return s;
}

/** Ids of units and sections whose object identity changed (copy-on-write ⇒ content/position changed). */
export function changedBetween(before: OrganizedDoc, after: OrganizedDoc): UnitChange {
  const units: string[] = [];
  const sections: string[] = [];
  for (const [id, u] of Object.entries(after.units)) {
    const old = before.units[id];
    if (!old || old.content !== u.content || old.sectionId !== u.sectionId || old.origin !== u.origin || old.type !== u.type) units.push(id);
  }
  const changedUnits = new Set(units);
  for (const [id, s] of Object.entries(after.sections)) {
    const old = before.sections[id];
    if (!old || old.title !== s.title || old.parentId !== s.parentId || s.units.length !== old.units.length || s.units.some((u) => changedUnits.has(u)))
      sections.push(id);
  }
  return { units, sections };
}

/**
 * Safety net: represents uncovered source passages verbatim in a "Not Yet Organized" section so
 * nothing the user wrote is ever missing from the sidebar. The next AI pass reorganizes them.
 */
export function insertFallbackUnits(
  doc: OrganizedDoc,
  blocks: { id: string; text: string }[],
  now: number,
  sourceVersion: number,
): OrganizedDoc {
  if (!blocks.length) return doc;
  const sections = { ...doc.sections };
  const units = { ...doc.units };
  const rootSections = [...doc.rootSections];
  let nextId = doc.nextId;
  if (!sections[UNSORTED_SECTION_ID]) {
    sections[UNSORTED_SECTION_ID] = { id: UNSORTED_SECTION_ID, title: 'Not Yet Organized', parentId: null, children: [], units: [], createdAt: now, updatedAt: now };
    rootSections.push(UNSORTED_SECTION_ID);
  }
  const sec = { ...sections[UNSORTED_SECTION_ID], units: [...sections[UNSORTED_SECTION_ID].units] };
  for (const b of blocks) {
    let id: string;
    do id = `u_${nextId++}`;
    while (units[id]);
    units[id] = {
      id,
      sectionId: UNSORTED_SECTION_ID,
      type: 'paragraph',
      content: truncate(b.text, 4000),
      origin: 'user',
      sources: [b.id],
      concepts: [],
      needsReview: true,
      createdAt: now,
      updatedAt: now,
      sourceVersion,
    };
    sec.units.push(id);
  }
  sec.updatedAt = now;
  sections[UNSORTED_SECTION_ID] = sec;
  return { ...doc, sections, units, rootSections, nextId, version: doc.version + 1, updatedAt: now };
}

/** Depth-first section order (used for rendering, context building and export). */
export function sectionOrder(doc: OrganizedDoc): { id: string; depth: number }[] {
  const out: { id: string; depth: number }[] = [];
  const visit = (id: string, depth: number) => {
    const s = doc.sections[id];
    if (!s) return;
    out.push({ id, depth });
    s.children.forEach((c) => visit(c, depth + 1));
  };
  doc.rootSections.forEach((id) => visit(id, 1));
  return out;
}

/** Structural self-check used by tests and as a guard before persisting. */
export function checkInvariants(doc: OrganizedDoc): string[] {
  const errs: string[] = [];
  const seenSections = new Set<string>();
  const visit = (id: string, parent: string | null) => {
    const s = doc.sections[id];
    if (!s) return errs.push(`missing section ${id}`);
    if (seenSections.has(id)) return errs.push(`section ${id} appears twice`);
    seenSections.add(id);
    if (s.parentId !== parent) errs.push(`section ${id} parent mismatch`);
    for (const u of s.units) {
      if (!doc.units[u]) errs.push(`section ${id} references missing unit ${u}`);
      else if (doc.units[u].sectionId !== id) errs.push(`unit ${u} sectionId mismatch`);
    }
    s.children.forEach((c) => visit(c, id));
  };
  doc.rootSections.forEach((id) => visit(id, null));
  for (const id of Object.keys(doc.sections)) if (!seenSections.has(id)) errs.push(`orphan section ${id}`);
  const placed = new Set(Object.values(doc.sections).flatMap((s) => s.units));
  for (const id of Object.keys(doc.units)) if (!placed.has(id)) errs.push(`orphan unit ${id}`);
  return errs;
}
