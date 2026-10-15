'use strict';
// Faster style matching without changing what any rule means.
//
// Chrome files every rule under the class, id, tag or attribute of its subject (the rightmost compound), and only tries
// it on elements that have one. A subject written as `:is(.a, .b)` has none of these, so the rule is tried on every
// element of the workspace on every restyle (measured on the dashboard: about 300 such rules, each tried ~3,900 times a
// tab switch). `X :is(.a, .b)` matches exactly what `X .a, X .b` matches, so this writes rules in that second form.
//
// It rewrites a selector only when nothing can change: the `:is()` is the whole subject or the subject's first part,
// every argument is one compound (no combinators, no nesting of its own lists), the arguments all have the same
// specificity (so each spelled-out selector keeps the specificity `:is()` gave the rule), there is no pseudo-element, and
// the result stays at most 16 selectors long. Everything else is left as written.
//
// `node scripts/css-subjects.cjs` rewrites extension/*.css in place and reports; `--check` fails if a file still has a
// selector it would rewrite (npm run check).
const fs = require('node:fs'), path = require('node:path');
const ext = path.join(__dirname, '..', 'extension');
const FILES = ['app.css', 'dashboard.css', 'workspace.css', 'refresh.css', 'customize.css', 'settings-dock.css', 'gpa.css', 'selection.css', 'responsive-layout.css', 'widgets.css', 'pet.css', 'subject-art.css'];

// Split on a separator at depth 0 (outside (), [] and strings).
function splitTop(text, sep) {
  const out = []; let depth = 0, quote = '', start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && c === sep) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start)); return out;
}
// The index where the subject compound starts: after the last combinator (space, >, +, ~) at depth 0.
function subjectStart(sel) {
  let depth = 0, quote = '', last = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && /[\s>+~]/.test(c)) last = i + 1;
  }
  return last;
}
// Specificity of one compound [ids, classes/attributes/pseudo-classes, types]; null when it holds anything we do not
// want to reason about (nested lists, :not/:has/:where, pseudo-elements, namespaces).
function specificity(compound) {
  const c = compound.trim();
  if (!c || /[\s>+~,]/.test(c.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, ''))) return null;
  if (/::|:(is|not|has|where|matches|host|slotted|part)\(|\||^\*/.test(c)) return null;
  // Only pseudo-classes every Chrome this extension supports knows: a spelled-out list with one it does not know would
  // drop the whole rule, where :is() quietly ignores that one argument.
  for (const [, name] of c.matchAll(/:([\w-]+)/g)) if (!KNOWN.has(name)) return null;
  let rest = c, ids = 0, classes = 0, types = 0;
  rest = rest.replace(/\[[^\]]*\]/g, () => { classes++; return ''; });
  rest = rest.replace(/:[\w-]+\([^)]*\)/g, () => { classes++; return ''; });
  rest = rest.replace(/#[\w-]+/g, () => { ids++; return ''; });
  rest = rest.replace(/\.[\w-]+/g, () => { classes++; return ''; });
  rest = rest.replace(/:[\w-]+/g, () => { classes++; return ''; });
  if (/^[a-zA-Z][\w-]*$/.test(rest)) { types++; rest = ''; }
  return rest.trim() ? null : [ids, classes, types];
}
const KNOWN = new Set(['hover', 'focus', 'focus-visible', 'focus-within', 'active', 'checked', 'disabled', 'enabled', 'first-child', 'last-child', 'only-child', 'first-of-type', 'last-of-type', 'empty', 'nth-child', 'nth-of-type', 'nth-last-child', 'placeholder-shown', 'visited', 'link', 'target', 'read-only', 'required', 'invalid', 'default', 'indeterminate', 'open']);
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
// One selector -> a list of selectors (itself when it cannot be rewritten safely).
function expand(sel) {
  const s = sel.trim(), at = subjectStart(s), prefix = s.slice(0, at), subject = s.slice(at);
  if (!subject.startsWith(':is(')) return [s];
  let depth = 0, end = -1;
  for (let i = 3; i < subject.length; i++) { if (subject[i] === '(') depth++; else if (subject[i] === ')' && --depth === 0) { end = i; break; } }
  if (end < 0) return [s];
  const inner = subject.slice(4, end), tail = subject.slice(end + 1);
  if (/[\s>+~]/.test(tail.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, ''))) return [s];
  // After the brackets: pseudo-classes, then at most one pseudo-element (they apply to every spelled-out selector alike).
  const pseudo = tail.match(/^((?::[\w-]+(?:\([^)]*\))?)*)((?:::[\w-]+(?:\([^)]*\))?)?)$/);
  // The part after the brackets is copied unchanged onto every spelled-out selector, so its own contents (even a
  // :has()) cannot make them differ; it only has to be pseudo-classes and at most one pseudo-element.
  if (!pseudo) return [s];
  const args = splitTop(inner, ',').map(a => a.trim());
  if (args.length < 2) return [s];
  const specs = args.map(specificity);
  if (specs.some(x => !x) || specs.some(x => !same(x, specs[0]))) return [s];
  return args.map(a => prefix + a + tail);
}
// A block another script writes (/* <name:generated> */ ... /* </name:generated> */) stays exactly as that script wrote
// it, so its own check still matches.
function rewrite(css) {
  const parts = css.split(/(\/\* <([\w-]+):generated> \*\/[\s\S]*?\/\* <\/\2:generated> \*\/)/);
  let changed = 0, out = '';
  for (let i = 0; i < parts.length; i += 3) {
    const r = rewriteRules(parts[i]); changed += r.changed; out += r.css;
    if (i + 1 < parts.length) out += parts[i + 1];
  }
  return { css: out, changed };
}
function rewriteRules(css) {
  let changed = 0, out = '', i = 0;
  // Walk rules; only rewrite selector preludes of style rules (not @-rule preludes or declarations).
  const stack = [];
  while (i < css.length) {
    const open = css.indexOf('{', i), close = css.indexOf('}', i), comment = css.indexOf('/*', i);
    if (comment !== -1 && (open === -1 || comment < open) && (close === -1 || comment < close)) {
      const e = css.indexOf('*/', comment + 2); out += css.slice(i, e + 2); i = e + 2; continue;
    }
    if (open === -1 && close === -1) { out += css.slice(i); break; }
    if (close !== -1 && (open === -1 || close < open)) { out += css.slice(i, close + 1); i = close + 1; stack.pop(); continue; }
    const prelude = css.slice(i, open), lead = prelude.match(/^\s*/)[0], text = prelude.slice(lead.length);
    const inDecls = stack.length && stack[stack.length - 1] === 'rule';
    if (!inDecls && text && !text.trim().startsWith('@') && !/^(from|to|\d+%)/.test(text.trim())) {
      const sels = splitTop(text, ','), next = sels.flatMap(expand);
      const joined = next.join(', ');
      if (next.length > sels.length && next.length <= 16) { changed += next.length - sels.length; out += lead + joined + (/\s$/.test(text) ? ' ' : ''); }
      else out += prelude;
      stack.push('rule');
    } else { out += prelude; stack.push(text.trim().startsWith('@') ? 'at' : 'rule'); }
    out += '{'; i = open + 1;
  }
  return { css: out, changed };
}
module.exports = { expand, rewrite, specificity, FILES };
if (require.main === module) {
  let total = 0, pending = 0;
  for (const file of FILES) {
    const p = path.join(ext, file); if (!fs.existsSync(p)) continue;
    const before = fs.readFileSync(p, 'utf8'), { css, changed } = rewrite(before);
    if (process.argv.includes('--check')) { if (changed) { pending += changed; console.error(`${file}: ${changed} selectors could be spelled out`); } continue; }
    if (changed) { fs.writeFileSync(p, css); total += changed; console.log(`${file}: +${changed} spelled-out selectors`); }
  }
  if (process.argv.includes('--check')) { if (pending) process.exit(1); console.log('CSS subjects: every safe :is() subject is spelled out.'); }
  else console.log(`done: ${total} selectors added by spelling out :is() subjects`);
}
