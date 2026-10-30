/**
 * Converts simple LaTeX (the kind found in study notes: chemical equations, fractions, Greek
 * letters, sub/superscripts) to HTML text with <sub>/<sup>, for places that can't render math,
 * such as the exported Google Doc. Anything it doesn't recognise stays readable as plain text.
 */

const SYMBOLS: Record<string, string> = {
  rightarrow: '→', to: '→', longrightarrow: '⟶', leftarrow: '←', gets: '←', leftrightarrow: '↔', rightleftharpoons: '⇌', Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', implies: '⇒', iff: '⇔', uparrow: '↑', downarrow: '↓',
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', sim: '∼', equiv: '≡', propto: '∝', ll: '≪', gg: '≫',
  infty: '∞', partial: '∂', nabla: '∇', sum: 'Σ', prod: 'Π', int: '∫', oint: '∮', sqrt: '√', degree: '°', circ: '∘', ldots: '…', cdots: '⋯', dots: '…', prime: '′',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', angle: '∠', perp: '⊥', parallel: '∥', therefore: '∴', because: '∵',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  quad: ' ', qquad: '  ', ' ': ' ', ',': ' ', ';': ' ', ':': ' ', '!': '', '%': '%', '{': '{', '}': '}', '#': '#', '&': '&', '_': '_', $: '$',
};
/** Relations and arrows read better with spaces around them. */
const SPACED = new Set(['→', '⟶', '←', '↔', '⇌', '⇒', '⇐', '⇔', '≤', '≥', '≠', '≈', '≡', '∝', '∈', '∉', '⊂', '⊆']);
const DROP = new Set(['left', 'right', 'displaystyle', 'textstyle', 'big', 'Big', 'bigg', 'Bigg', 'limits', 'nolimits']);
const WRAPPERS = /\\(?:mathrm|text|textrm|mathbf|textbf|mathit|textit|mathsf|mathtt|operatorname|boldsymbol|mathcal|ce|mbox|vec|hat|bar|overline|underline)\s*\{([^{}]*)\}/g;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function latexToHtml(src: string): string {
  let s = src.trim();
  // Unwrap formatting commands, innermost first.
  for (let i = 0; i < 10; i++) {
    const before = s;
    s = s.replace(WRAPPERS, '$1');
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a: string, b: string) => `${wrap(a)}/${wrap(b)}`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_, a: string) => (a.trim().length > 1 ? `√(${a.trim()})` : `√${a.trim()}`));
    if (s === before) break;
  }
  s = s.replace(/\^\s*\\circ/g, '°').replace(/\\\\/g, ' ');
  return render(s);
}

/** Parenthesizes a fraction part that has more than one term. */
function wrap(a: string): string {
  const t = a.trim();
  return /^[\w.]+$/.test(t) || /^\\[a-zA-Z]+$/.test(t) ? t : `(${t})`;
}

function render(s: string): string {
  let out = '';
  let i = 0;
  const group = (): string => {
    // Reads the argument of ^ or _: {…} or a single (possibly escaped) token.
    while (s[i] === ' ') i++;
    if (s[i] === '{') {
      let depth = 0;
      const start = i;
      for (; i < s.length; i++) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}' && --depth === 0) break;
      }
      const inner = s.slice(start + 1, i);
      i++;
      return render(inner);
    }
    if (s[i] === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      if (m) {
        i += m[0].length;
        return esc(SYMBOLS[m[1]] ?? m[1]);
      }
    }
    return esc(s[i++] ?? '');
  };
  while (i < s.length) {
    const c = s[i];
    if (c === '^' || c === '_') {
      i++;
      const g = group();
      out += c === '^' ? `<sup>${g}</sup>` : `<sub>${g}</sub>`;
    } else if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      if (!m) {
        i++;
        continue;
      }
      i += m[0].length;
      // A space after a command name only ends the name (\Delta G → ΔG).
      if (/^[a-zA-Z]/.test(m[1]) && s[i] === ' ') i++;
      if (DROP.has(m[1])) continue;
      const sym = SYMBOLS[m[1]] ?? m[1];
      out += SPACED.has(sym) ? ` ${sym} ` : esc(sym);
    } else if (c === '{' || c === '}') {
      i++;
    } else if (c === '~') {
      out += ' ';
      i++;
    } else {
      out += esc(c);
      i++;
    }
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}
