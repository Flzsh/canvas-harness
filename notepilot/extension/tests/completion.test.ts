import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildRewriteMessages, buildInsightMessages } from '../src/core/context';
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from '../src/core/settings';
import { FILL_CLOSE as C, FILL_OPEN as O, fillsToBrackets, hasFills, stripFills } from '../src/core/fills';
import { toMarkdown } from '../src/core/export';
import { applyPatch } from '../src/core/patch';
import { isNearDuplicate } from '../src/core/text';
import { emptyOrganizedDoc, type SourceBlock } from '../src/core/types';
import { makeRawBlock } from '../src/core/docParser';
import { Markdown } from '../src/sidepanel/components/Markdown';

const block = (id: string, text: string): SourceBlock => ({ id, ...makeRawBlock('paragraph', text) });
const systemFor = (s: Settings) => {
  const b = block('b1', 'ATP synthase uses proton gradient to');
  return buildRewriteMessages({ organized: emptyOrganizedDoc('d'), currentBlocks: [b], batch: { added: [b], modified: [], removed: [] }, settings: s }).messages[0].content;
};
const render = (text: string, markFills = true) => renderToStaticMarkup(createElement(Markdown, { text, markFills }));

describe('finishing incomplete notes: prompt', () => {
  it('defaults to "develop", including for settings saved by older versions', () => {
    expect(DEFAULT_SETTINGS.completion).toBe('develop');
    const old = { ...DEFAULT_SETTINGS } as Partial<Settings>;
    delete old.completion;
    expect(mergeSettings(old).completion).toBe('develop');
  });

  it('develop: finishes sentences, develops started ideas, marks added words, and does not flag truncation as ambiguous', () => {
    const sys = systemFor(DEFAULT_SETTINGS);
    expect(sys).toContain('UNFINISHED NOTES');
    expect(sys).toMatch(/Finish every unfinished sentence/);
    expect(sys).toMatch(/Also develop ideas the student started/);
    expect(sys).toContain(`Wrap EVERY word you add that is not in the notes in ${O} ${C}`);
    expect(sys).toMatch(/do NOT use "uncertain" to say a sentence was unfinished, truncated or cut off/);
    expect(sys).toMatch(/Never invent specific numbers, dates, names/);
    expect(sys).toContain('MAKE IT EASY TO UNDERSTAND');
    // The old blanket "do NOT guess" rule (which produced "Source text appears truncated") is gone.
    expect(sys).not.toContain('If shorthand is ambiguous, do NOT guess');
  });

  it('finish: completes sentences but does not develop ideas', () => {
    const sys = systemFor({ ...DEFAULT_SETTINGS, completion: 'finish' });
    expect(sys).toMatch(/Finish every unfinished sentence/);
    expect(sys).not.toMatch(/Also develop ideas/);
    expect(sys).toMatch(/Only finish what the student started/);
  });

  it('off: no completions and no markers', () => {
    const sys = systemFor({ ...DEFAULT_SETTINGS, completion: 'off' });
    expect(sys).toMatch(/Do not complete unfinished sentences/);
    expect(sys).not.toMatch(/Finish every unfinished sentence/);
    expect(sys).toMatch(/Do not use "uncertain" just to say that a sentence is unfinished/);
  });

  it('marks text that NotePilot itself shortened, so the model does not report it as truncated notes', () => {
    const long = block('b2', 'word '.repeat(400).trim()); // ~2,000 chars: shortened only as context
    const added = block('b3', 'new note');
    const user = buildRewriteMessages({
      organized: emptyOrganizedDoc('d'),
      currentBlocks: [long, added],
      batch: { added: [added], modified: [], removed: [] },
      settings: DEFAULT_SETTINGS,
    }).messages[1].content;
    const json = JSON.parse(user.slice(user.indexOf('{')));
    expect(json.context_blocks[0].shortened).toBe(true);
    expect(json.changes.added[0].shortened).toBeUndefined();
    // A changed block of the same size is sent in full.
    const asChange = buildRewriteMessages({ organized: emptyOrganizedDoc('d'), currentBlocks: [long], batch: { added: [long], modified: [], removed: [] }, settings: DEFAULT_SETTINGS }).messages[1].content;
    const j2 = JSON.parse(asChange.slice(asChange.indexOf('{')));
    expect(j2.changes.added[0].text).toBe(long.text);
    expect(j2.changes.added[0].shortened).toBeUndefined();
  });

  it('tells the insights reviewer which words were AI completions', () => {
    const msgs = buildInsightMessages({ organized: emptyOrganizedDoc('d'), insights: [], changedSectionIds: [], settings: DEFAULT_SETTINGS }).messages;
    expect(msgs[0].content).toMatch(/filled in by AI to finish an unfinished note/);
  });
});

describe('finishing incomplete notes: display and export', () => {
  const text = `**ATP synthase** uses the proton gradient to ${O}make ATP${C}.`;

  it('highlights AI-completed words and hides the markers', () => {
    const html = render(text);
    expect(html).toContain('<span class="np-filled" title="Completed by AI. Not in your notes.">make ATP</span>');
    expect(html).not.toContain(O);
    expect(html).not.toContain(C);
  });

  it('wraps every piece of a completion that spans emphasis', () => {
    const html = render(`The ETC ${O}pumps **protons** out${C} of the matrix.`);
    expect(html.match(/class="np-filled"/g)?.length).toBe(3);
    expect(html).toContain('<strong><span class="np-filled" title="Completed by AI. Not in your notes.">protons</span></strong>');
  });

  it('removes markers without highlighting when labels are off, and never breaks math', () => {
    expect(render(text, false)).not.toContain('np-filled');
    expect(render(text, false)).toContain('uses the proton gradient to make ATP.');
    const math = render(`Energy ${O}$E = mc^2$${C} applies.`);
    expect(math).toContain('katex');
    expect(math).not.toContain('katex-error');
  });

  it('an unclosed marker does not leak into the next paragraph', () => {
    const html = render(`first ${O}unfinished\n\nsecond paragraph`);
    expect(html).toContain('<p>second paragraph</p>');
  });

  it('exports completions in [editorial brackets], or as plain text without labels', () => {
    expect(fillsToBrackets(text)).toBe('**ATP synthase** uses the proton gradient to \\[make ATP\\].');
    expect(stripFills(text)).toBe('**ATP synthase** uses the proton gradient to make ATP.');
    expect(hasFills(text)).toBe(true);
    const doc = applyPatch(
      emptyOrganizedDoc('d'),
      [
        { op: 'create_section', ref: 'new:s', title: 'ETC', parent: null },
        { op: 'create_unit', ref: 'new:u', section: 'new:s', type: 'paragraph', content: text, origin: 'user', sources: ['b1'] },
      ] as never,
      { validSourceIds: new Set(['b1']), requiredSourceIds: ['b1'], now: 1, sourceVersion: 1, allowExpansion: true },
      'T',
    ).doc;
    expect(toMarkdown(doc)).toContain('to \\[make ATP\\].');
    expect(toMarkdown(doc, { labelOrigins: false })).toContain('to make ATP.');
  });

  it('duplicate detection ignores the markers', () => {
    expect(isNearDuplicate(text, '**ATP synthase** uses the proton gradient to make ATP.')).toBe(true);
  });
});
