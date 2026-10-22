import type { Insight, OrganizedDoc } from './types';
import { sectionOrder } from './patch';
import { CATEGORY_ORDER } from './insights';
import { fillsToBrackets, stripFills } from './fills';

export const CATEGORY_LABEL: Record<Insight['category'], string> = {
  connection: 'Conceptual connections',
  deeper: 'Deeper explanations',
  error: 'Possible errors',
  gap: 'Knowledge gaps',
  practice: 'Active learning',
};

/** Serializes the organized notes (and optionally insights) to Markdown for an explicit export. */
export function toMarkdown(doc: OrganizedDoc, opts: { insights?: Insight[]; labelOrigins?: boolean; includeExpansions?: boolean } = {}): string {
  const { labelOrigins = true, includeExpansions = true } = opts;
  const lines: string[] = [`# ${doc.title || 'Organized Notes'}`, ''];
  for (const { id, depth } of sectionOrder(doc)) {
    const s = doc.sections[id];
    lines.push(`${'#'.repeat(Math.min(depth + 1, 6))} ${s.title}`, '');
    for (const uid of s.units) {
      const raw = doc.units[uid];
      if (raw.origin === 'expansion' && !includeExpansions) continue;
      // AI-completed words: [editorial brackets] when labelling, plain words otherwise.
      const u = { ...raw, content: labelOrigins ? fillsToBrackets(raw.content) : stripFills(raw.content) };
      if (labelOrigins && u.origin === 'expansion') {
        lines.push(...u.content.split('\n').map((l, i) => `> ${i === 0 ? '*AI expansion (unverified):* ' : ''}${l}`), '');
      } else {
        lines.push(u.content, '');
        if (labelOrigins && u.origin === 'clarification') lines.push('<sub>AI clarification</sub>', '');
      }
      if (u.uncertain) lines.push(`> *Ambiguous in the original notes:* ${u.uncertain}`, '');
    }
  }
  if (opts.insights?.length) {
    lines.push('---', '', '## AI Insights', '');
    for (const cat of CATEGORY_ORDER) {
      const items = opts.insights.filter((i) => i.category === cat);
      if (!items.length) continue;
      lines.push(`### ${CATEGORY_LABEL[cat]}`, '');
      for (const i of items) {
        lines.push(`**${i.title}**${i.needsVerification ? ' *(unverified)*' : ''}`, '', i.body, '');
        if (i.question) lines.push(`*Q:* ${i.question.prompt}`, '', i.question.answer ? `*A:* ${i.question.answer}` : '', '');
      }
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
