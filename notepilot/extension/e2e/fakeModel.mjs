/**
 * Scripted stand-in for an OpenAI-compatible model, used only by the end-to-end test.
 * It reads the real request the extension sends and answers with the patch a capable model
 * would produce for each step of the acceptance scenario.
 */

const findSection = (p, title) => p.organized.sections.find((s) => s.title === title);
const byText = (p, frag) => {
  const all = [...(p.changes.added ?? []), ...(p.changes.unrepresented ?? []), ...(p.changes.modified ?? []).map((m) => ({ id: m.id, text: m.after }))];
  return all.find((b) => b.text.includes(frag))?.id;
};

export function rewrite(p) {
  const added = (p.changes.added ?? []).map((b) => b.text);
  if (p.organized.sections.length === 0) {
    const id = (t) => byText(p, t);
    return {
      title: 'Cellular Respiration',
      ops: [
        { op: 'create_section', ref: 'new:root', title: 'Cellular Respiration', parent: null },
        { op: 'create_section', ref: 'new:ov', title: 'Overview', parent: 'new:root' },
        { op: 'create_section', ref: 'new:gly', title: 'Glycolysis', parent: 'new:root', after: 'new:ov' },
        { op: 'create_section', ref: 'new:kre', title: 'Citric Acid Cycle', parent: 'new:root', after: 'new:gly' },
        { op: 'create_section', ref: 'new:etc', title: 'Electron Transport Chain', parent: 'new:root', after: 'new:kre' },
        {
          op: 'create_unit', ref: 'new:u1', section: 'new:ov', type: 'paragraph', origin: 'user', sources: [id('mitochondria')],
          content: 'Cellular respiration is the set of metabolic processes by which cells extract energy from nutrients; the **mitochondria** are where most **ATP** is produced.',
          concepts: ['cellular respiration', 'ATP'],
        },
        {
          op: 'create_unit', ref: 'new:u2', section: 'new:gly', type: 'list', origin: 'user', sources: [id('glycolysis cytoplasm'), id("doesn't need")],
          content: '**Glycolysis** occurs in the **cytoplasm** and breaks glucose down into pyruvate.\n\n- Does not directly require oxygen.',
          concepts: ['glycolysis'],
        },
        {
          op: 'create_unit', ref: 'new:u3', section: 'new:kre', type: 'paragraph', origin: 'user', sources: [id('krebs')],
          content: 'The **citric acid cycle** (also called the Krebs cycle) produces the reduced electron carrier **NADH**.',
          concepts: ['citric acid cycle', 'NADH'],
        },
        {
          op: 'create_unit', ref: 'new:u4', section: 'new:etc', type: 'paragraph', origin: 'user', sources: [id('ETC')],
          content: 'The **electron transport chain (ETC)** requires **oxygen**.',
          concepts: ['electron transport chain'],
        },
        {
          op: 'create_unit', ref: 'new:u5', section: 'new:etc', after: 'new:u4', type: 'paragraph', origin: 'clarification', sources: [id('ATP synthase')],
          content: '**ATP synthase** uses the **proton gradient** across the inner mitochondrial membrane to ⟦produce ATP⟧.',
          concepts: ['ATP synthase', 'proton gradient'],
        },
        {
          op: 'create_unit', ref: 'new:u6', section: 'new:etc', after: 'new:u5', type: 'equation', origin: 'expansion', sources: [id('ETC')],
          content: 'Oxygen acts as the terminal electron acceptor:\n\n$$\\tfrac{1}{2}\\,\\mathrm{O_2} + 2\\,e^- + 2\\,\\mathrm{H^+} \\rightarrow \\mathrm{H_2O}$$',
          concepts: ['oxygen'],
        },
      ],
    };
  }
  if (added.some((t) => t.startsWith('fermentation'))) {
    const root = findSection(p, 'Cellular Respiration');
    const gly = findSection(p, 'Glycolysis');
    return {
      title: null,
      ops: [
        { op: 'create_section', ref: 'new:an', title: 'Anaerobic Metabolism', parent: root.id, after: gly.id },
        {
          op: 'create_unit', ref: 'new:f', section: 'new:an', type: 'paragraph', origin: 'user', sources: [byText(p, 'fermentation')],
          content: 'When oxygen is unavailable, **fermentation** regenerates **NAD⁺**, which allows glycolysis to continue producing ATP.',
          uncertain: null,
        },
      ],
    };
  }
  if (added.some((t) => t.includes('net 2 ATP'))) {
    const gly = findSection(p, 'Glycolysis');
    const u = gly.units[0];
    return {
      title: null,
      ops: [
        {
          op: 'update_unit', id: u.id, sources: [...u.sources, byText(p, 'net 2 ATP')],
          content: '**Glycolysis** occurs in the **cytoplasm** and breaks glucose down into pyruvate.\n\n- Does not directly require oxygen.\n- Produces a net gain of **2 ATP** per glucose.',
        },
      ],
    };
  }
  if ((p.changes.modified ?? []).length) {
    const m = p.changes.modified[0];
    return {
      title: null,
      ops: m.cited_by.map((id) => ({
        op: 'update_unit', id,
        content: 'The **citric acid cycle** (Krebs cycle) takes place in the mitochondrial **matrix** and produces **NADH** and **FADH₂**.',
      })),
    };
  }
  if ((p.changes.removed ?? []).length) {
    const r = p.changes.removed[0];
    const user = r.cited_by.filter((id) => p.organized.sections.some((s) => s.units.some((u) => u.id === id && u.origin === 'user')));
    return { title: null, ops: user.map((id) => ({ op: 'delete_unit', id })) };
  }
  return { title: null, ops: [] };
}

export function insights(p) {
  const etc = p.organized.sections.find((s) => s.title === 'Electron Transport Chain');
  const gly = p.organized.sections.find((s) => s.title === 'Glycolysis');
  const an = p.organized.sections.find((s) => s.title === 'Anaerobic Metabolism');
  const upsert = [];
  if (etc && gly) {
    upsert.push({
      category: 'connection', title: 'The ETC and ATP synthase work as one system', confidence: 'high', needsVerification: false,
      body: 'Electron transport pumps protons and builds the **electrochemical gradient**; ATP synthase spends that gradient to make ATP. Neither produces much ATP without the other.',
      sectionIds: [etc.id], unitIds: etc.units.map((u) => u.id),
    });
    upsert.push({
      category: 'gap', title: 'Why does oxygen depletion stop oxidative phosphorylation?', confidence: 'medium', needsVerification: false,
      body: 'ATP synthase never touches oxygen. What happens to the proton gradient when the chain has no final electron acceptor?',
      sectionIds: [etc.id],
    });
    upsert.push({
      category: 'deeper', title: 'Where the energy actually comes from', confidence: 'medium', needsVerification: true,
      body: 'Most of the ATP from one glucose comes from oxidative phosphorylation — roughly 26–28 of about 30–32 total — far more than the 2 net ATP from glycolysis.',
      sectionIds: [etc.id, gly.id],
    });
  }
  if (an) {
    upsert.push({
      category: 'practice', title: 'Check your understanding', confidence: 'high', needsVerification: false,
      body: 'Connect the anaerobic and aerobic parts of your notes.',
      sectionIds: [an.id, gly.id],
      question: { prompt: 'Why must cells regenerate NAD⁺ for glycolysis to keep running without oxygen?', answer: 'Glycolysis reduces NAD⁺ to NADH; without regeneration (by fermentation or the ETC) NAD⁺ runs out and glycolysis stops.' },
    });
  }
  return { upsert, remove: [] };
}

export function summary(p) {
  const id = (title) => p.organized.sections.find((s) => s.title === title)?.id;
  const ids = (...t) => t.map(id).filter(Boolean);
  const entry = (title, content) => ({ section: id(title), content });
  return {
    overview: 'Cells release energy from glucose in stages: glycolysis in the cytoplasm, then the citric acid cycle and electron transport in the mitochondria. Without oxygen, fermentation keeps glycolysis going.',
    sections: [
      // Deliberately out of order: NotePilot puts entries in the notes' order.
      entry('Electron Transport Chain', '1. NADH and FADH₂ hand electrons to the chain.\n2. The chain pumps protons, building a gradient.\n3. **ATP synthase** uses the gradient to make ATP.'),
      entry('Glycolysis', '- **Glycolysis** splits glucose into pyruvate in the cytoplasm.\n- Net yield: **2 ATP** per glucose.'),
      entry('Anaerobic Metabolism', '- **Fermentation** regenerates NAD⁺ so glycolysis continues without oxygen.'),
      entry('Citric Acid Cycle', '| Where | Products |\n|---|---|\n| Mitochondrial matrix | NADH, FADH₂ |'),
    ].filter((e) => e.section),
    key_terms: [
      { term: 'ATP synthase', definition: 'Enzyme that uses the proton gradient to make ATP.', sections: ids('Electron Transport Chain') },
      { term: 'Fermentation', definition: 'Anaerobic pathway that regenerates NAD⁺.', sections: ids('Anaerobic Metabolism') },
    ],
    review: [{ text: 'Why oxygen matters for the electron transport chain is not explained.', sections: ids('Electron Transport Chain') }],
  };
}
