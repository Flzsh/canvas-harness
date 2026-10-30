import { docIdFromUrl } from './docParser';

/**
 * The companion Google Doc NotePilot saves on Summarize ("<title> — NotePilot notes"). When it is
 * open in a tab, the panel must not treat it as notes: it would rewrite NotePilot's own output and
 * a Summarize there would create yet another doc.
 */
export const COMPANION_SUFFIX = ' — NotePilot notes';

/** Browser tab title of a companion doc, e.g. "Cellular Respiration — NotePilot notes - Google Docs". */
export function isCompanionTitle(title: string | undefined): boolean {
  return !!title && /— NotePilot notes(\s+-\s+Google Docs)?\s*$/.test(title);
}

export type TabKind =
  | { kind: 'doc'; docId: string }
  /** A companion doc: show the notes it was made from (null when they are not known on this device). */
  | { kind: 'companion'; sourceDocId: string | null }
  | { kind: 'other' };

export async function classifyTab(tab: { url?: string; title?: string }, sourceOfCompanion: (fileId: string) => Promise<string | null>): Promise<TabKind> {
  const id = docIdFromUrl(tab.url);
  if (!id) return { kind: 'other' };
  const source = await sourceOfCompanion(id);
  if (source) return { kind: 'companion', sourceDocId: source };
  if (isCompanionTitle(tab.title)) return { kind: 'companion', sourceDocId: null };
  return { kind: 'doc', docId: id };
}
