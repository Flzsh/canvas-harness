import type { DocsDocument } from '../src/core/docParser';

/** Builds a Docs API `documents.get` response from simple paragraph specs. */
export type ParaSpec = string | { text: string; style?: string; bullet?: number } | { table: string[][] };

export function docsResponse(paras: ParaSpec[], opts: { title?: string; revisionId?: string; id?: string } = {}): DocsDocument {
  const content = paras.map((p) => {
    if (typeof p === 'string') return { paragraph: { elements: [{ textRun: { content: p + '\n' } }], paragraphStyle: { namedStyleType: 'NORMAL_TEXT' } } };
    if ('table' in p)
      return {
        table: {
          tableRows: p.table.map((row) => ({
            tableCells: row.map((cell) => ({ content: [{ paragraph: { elements: [{ textRun: { content: cell + '\n' } }] } }] })),
          })),
        },
      };
    return {
      paragraph: {
        elements: [{ textRun: { content: p.text + '\n' } }],
        paragraphStyle: { namedStyleType: p.style ?? 'NORMAL_TEXT' },
        ...(p.bullet !== undefined ? { bullet: { listId: 'l1', nestingLevel: p.bullet } } : {}),
      },
    };
  });
  return {
    documentId: opts.id ?? 'DOC_1234567890abcdefghij',
    title: opts.title ?? 'Bio notes',
    revisionId: opts.revisionId ?? 'rev-1',
    tabs: [{ tabProperties: { tabId: 't.0', title: 'Tab 1' }, documentTab: { body: { content: [{ sectionBreak: {} }, ...content] } } }],
  };
}
