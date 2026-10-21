import { describe, expect, it } from 'vitest';
import { docIdFromUrl, parseDocument } from '../src/core/docParser';
import { docsResponse } from './fixtures';

describe('parseDocument', () => {
  it('extracts paragraphs, headings, list items and tables from the Docs API structure', () => {
    const doc = docsResponse([
      { text: 'Cell Respiration', style: 'HEADING_1' },
      'mitochondria makes ATP.',
      '',
      { text: 'glycolysis cytoplasm', bullet: 0 },
      { text: 'net 2 ATP', bullet: 1 },
      { table: [['stage', 'location'], ['glycolysis', 'cytoplasm']] },
    ]);
    const parsed = parseDocument(doc);
    expect(parsed.title).toBe('Bio notes');
    expect(parsed.revisionId).toBe('rev-1');
    expect(parsed.blocks.map((b) => [b.kind, b.text, b.level])).toEqual([
      ['heading', 'Cell Respiration', 1],
      ['paragraph', 'mitochondria makes ATP.', undefined],
      ['list_item', 'glycolysis cytoplasm', 0],
      ['list_item', 'net 2 ATP', 1],
      ['table', '| stage | location |\n| glycolysis | cytoplasm |', undefined],
    ]);
  });

  it('handles smart chips, soft line breaks and legacy (tab-less) bodies', () => {
    const parsed = parseDocument({
      title: 'x',
      body: {
        content: [
          {
            paragraph: {
              elements: [
                { textRun: { content: 'Ask ' } },
                { person: { personProperties: { name: 'Dr. Lee', email: 'lee@example.edu' } } },
                { textRun: { content: ' about\u000bETC' } },
                { richLink: { richLinkProperties: { title: 'Lecture slides', uri: 'https://example.edu/s' } } },
                { equation: {} },
                { textRun: { content: '\n' } },
              ],
            },
          },
        ],
      },
    });
    expect(parsed.blocks[0].text).toBe('Ask Dr. Lee about\nETCLecture slides (https://example.edu/s)[equation]');
  });

  it('gives whitespace-only variants the same hash', () => {
    const a = parseDocument(docsResponse(['krebs  produces NADH ']));
    const b = parseDocument(docsResponse(['krebs produces NADH']));
    expect(a.blocks[0].hash).toBe(b.blocks[0].hash);
  });

  it('adds tab titles as headings for multi-tab documents', () => {
    const parsed = parseDocument({
      title: 't',
      tabs: [
        { tabProperties: { title: 'Week 1' }, documentTab: { body: { content: [{ paragraph: { elements: [{ textRun: { content: 'a fact\n' } }] } }] } } },
        { tabProperties: { title: 'Week 2' }, documentTab: { body: { content: [] } } },
      ],
    });
    expect(parsed.blocks.map((b) => b.text)).toEqual(['Week 1', 'a fact', 'Week 2']);
  });
});

describe('docIdFromUrl', () => {
  it('recognizes Google Docs URLs only', () => {
    expect(docIdFromUrl('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#heading=h.1')).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
    expect(docIdFromUrl('https://docs.google.com/document/u/1/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit')).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
    expect(docIdFromUrl('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit')).toBeNull();
    expect(docIdFromUrl('https://evil.example/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBeNull();
  });
});
