import type { InsightItem } from './schema';
import type { Insight, InsightCategory, OrganizedDoc } from './types';
import { wordJaccard } from './text';

export const CATEGORY_ORDER: InsightCategory[] = ['error', 'connection', 'deeper', 'gap', 'practice'];

/** Applies an insights patch, enforcing reference validity, per-category limits and de-duplication. */
export function applyInsights(
  existing: Insight[],
  patch: { upsert: InsightItem[]; remove: string[] },
  doc: OrganizedDoc,
  opts: { now: number; perCategory: number; total: number; mintId: () => string },
): { insights: Insight[]; changedIds: string[] } {
  const byId = new Map(existing.map((i) => [i.id, i]));
  const changed: string[] = [];
  for (const id of patch.remove) byId.delete(id);

  for (const item of patch.upsert) {
    const sectionIds = item.sectionIds.filter((s) => doc.sections[s]);
    const unitIds = item.unitIds.filter((u) => doc.units[u]);
    for (const u of unitIds) {
      const sec = doc.units[u].sectionId;
      if (!sectionIds.includes(sec)) sectionIds.push(sec);
    }
    if (sectionIds.length === 0) continue; // every insight must point at the notes

    const question = item.category === 'practice' && item.question ? { prompt: item.question.prompt, answer: item.question.answer } : undefined;
    const prev = item.id ? byId.get(item.id) : undefined;
    // Treat a "new" insight that restates an existing one as an update of it.
    const twin =
      prev ??
      [...byId.values()].find((i) => i.category === item.category && wordJaccard(i.title + ' ' + i.body, item.title + ' ' + item.body) > 0.75);
    const id = twin?.id ?? opts.mintId();
    const next: Insight = {
      id,
      category: item.category,
      title: item.title,
      body: item.body,
      sectionIds,
      unitIds,
      confidence: item.confidence,
      needsVerification: item.needsVerification,
      severity: item.category === 'error' ? item.severity ?? 'medium' : undefined,
      question,
      createdAt: twin?.createdAt ?? opts.now,
      updatedAt: opts.now,
      orgVersion: doc.version,
    };
    if (twin && twin.title === next.title && twin.body === next.body && sameRefs(twin, next)) continue;
    byId.set(id, next);
    changed.push(id);
  }

  // Enforce limits, keeping the most recently updated insights in each category.
  const result: Insight[] = [];
  for (const cat of CATEGORY_ORDER) {
    const items = [...byId.values()].filter((i) => i.category === cat).sort((a, b) => b.updatedAt - a.updatedAt);
    result.push(...items.slice(0, opts.perCategory));
  }
  result.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || b.updatedAt - a.updatedAt);
  return { insights: result.slice(0, opts.total), changedIds: changed.filter((id) => result.some((r) => r.id === id)) };
}

function sameRefs(a: Insight, b: Insight): boolean {
  return a.sectionIds.join() === b.sectionIds.join() && a.unitIds.join() === b.unitIds.join();
}

/** Drops references to sections/units that no longer exist; removes insights left without any. */
export function reconcileInsights(insights: Insight[], doc: OrganizedDoc): Insight[] {
  let changed = false;
  const out: Insight[] = [];
  for (const i of insights) {
    const sectionIds = i.sectionIds.filter((s) => doc.sections[s]);
    const unitIds = i.unitIds.filter((u) => doc.units[u]);
    if (sectionIds.length === i.sectionIds.length && unitIds.length === i.unitIds.length) {
      out.push(i);
      continue;
    }
    changed = true;
    if (sectionIds.length) out.push({ ...i, sectionIds, unitIds });
  }
  return changed ? out : insights;
}
