/**
 * "Fills": words the AI added to finish an unfinished note (a cut-off sentence, a half-written
 * idea). The model wraps them in ⟦ ⟧ so they stay distinguishable from what the student wrote:
 * the panel highlights them, exports render them in [editorial brackets], and comparisons ignore
 * the markers.
 */

export const FILL_OPEN = '⟦'; // ⟦
export const FILL_CLOSE = '⟧'; // ⟧
const MARKERS = /[⟦⟧]/g;
const HAS_MARKER = /[⟦⟧]/;

export function hasFills(text: string): boolean {
  return text.includes(FILL_OPEN);
}

/** Removes the markers, keeping the words. */
export function stripFills(text: string): string {
  return text.replace(MARKERS, '');
}

/** ⟦words⟧ → \[words\] (escaped so Markdown never reads them as a link). Stray markers are dropped. */
export function fillsToBrackets(text: string): string {
  return text.replace(/⟦([^⟦⟧]*)⟧/g, (_, inner: string) => (inner.trim() ? `\\[${inner}\\]` : '')).replace(MARKERS, '');
}

/* ---------- remark plugin (mdast → highlighted spans) ---------- */

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

/** Block nodes that start a fresh marker state, so one unclosed ⟦ can't leak into the next block. */
const BLOCKS = new Set(['paragraph', 'heading', 'tableCell', 'listItem', 'blockquote', 'definition']);
/** Literal nodes whose text must not contain markers (math would fail to render, code would show them). */
const LITERALS = new Set(['inlineMath', 'math', 'inlineCode', 'code']);

export const FILL_CLASS = 'np-filled';
export const FILL_TITLE = 'Completed by AI. Not in your notes.';

/**
 * Turns ⟦…⟧ ranges into <span class="np-filled"> (mark = true) or plain text (mark = false).
 * The range may span emphasis (⟦the **ETC** pumps⟧): each piece of text inside is wrapped.
 */
export function remarkFills(options: { mark?: boolean } = {}) {
  const mark = options.mark !== false;
  return (tree: MdNode) => {
    walk(tree, { open: false }, mark);
  };
}

function walk(node: MdNode, state: { open: boolean }, mark: boolean): void {
  if (!node.children) return;
  const out: MdNode[] = [];
  for (const child of node.children) {
    if (BLOCKS.has(child.type)) state.open = false;
    if (child.type === 'text' && typeof child.value === 'string') {
      out.push(...splitText(child.value, state, mark));
    } else if (LITERALS.has(child.type) && typeof child.value === 'string') {
      child.value = stripFills(child.value);
      out.push(child);
    } else {
      walk(child, state, mark);
      out.push(child);
    }
  }
  node.children = out;
}

function splitText(value: string, state: { open: boolean }, mark: boolean): MdNode[] {
  if (!state.open && !HAS_MARKER.test(value)) return [{ type: 'text', value }];
  const nodes: MdNode[] = [];
  let buf = '';
  const flush = () => {
    if (!buf) return;
    nodes.push(
      state.open && mark
        ? { type: 'fill', children: [{ type: 'text', value: buf }], data: { hName: 'span', hProperties: { className: [FILL_CLASS], title: FILL_TITLE } } }
        : { type: 'text', value: buf },
    );
    buf = '';
  };
  for (const ch of value) {
    if (ch === FILL_OPEN || ch === FILL_CLOSE) {
      flush();
      state.open = ch === FILL_OPEN;
    } else buf += ch;
  }
  flush();
  return nodes;
}
