'use strict';
// Development-only: spread dense lines of the extension's own JavaScript over several lines, one statement (or one
// property, argument or operand) per line, so that no line carries more than LIMIT bytes of code. Strings, template
// text, regular expressions, numbers and comments are data and do not count; so is a template literal as a whole
// (HTML with ${...} holes), except function bodies written inside it. Long lines that hold several statements next to
// string data are spread too where they can be. scripts/release-audit.cjs enforces LIMIT on the package.
//
// Only whitespace changes. Every run proves it for every file it writes: the token sequence is identical, and the
// JavaScript AST (without positions) is identical. Lines that are already short are left byte for byte.
//
// Usage:
//   node scripts/readable-lines.cjs            rewrite extension/**/*.js (not vendor/) where needed
//   node scripts/readable-lines.cjs --check    list dense lines and exit 1 if there are any
//   node scripts/readable-lines.cjs FILE...    only these files

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const EXTENSION = path.join(ROOT, 'extension');
const LIMIT = 160;
// Also spread where possible: lines over LINE_LIMIT bytes that carry more than LINE_CODE_FLOOR bytes of code.
const LINE_LIMIT = 200;
const LINE_CODE_FLOOR = 80;
const worthSpreading = (codeBytes, lineBytes) => codeBytes > LIMIT || (lineBytes > LINE_LIMIT && codeBytes > LINE_CODE_FLOOR);
const PARSE = { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: true };
const DATA_TOKENS = new Set(['string', 'template', 'regexp', 'num', 'bigint', '`']);

let acorn;
function parser() {
  if (!acorn) {
    const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
    if (!source) {
      throw Error('This Node build does not expose its bundled JavaScript parser.');
    }
    const parserModule = { exports: {} };
    vm.runInNewContext(source, { module: parserModule, exports: parserModule.exports }, { timeout: 5000 });
    acorn = parserModule.exports;
  }
  return acorn;
}

function optionsFor(file) {
  return { ...PARSE, sourceType: /\.mjs$/.test(file) ? 'module' : 'script' };
}

function tokens(text, options) {
  const list = [];
  for (const token of parser().tokenizer(text, options)) {
    list.push({ start: token.start, end: token.end, label: token.type.label, keyword: token.type.keyword, value: token.value });
  }
  return list;
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return starts;
}

function lineIndex(starts, position) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (starts[middle] <= position) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

// 1 where a character is inside a template literal and not inside a function body written in it.
function templateMask(ast, length) {
  const mask = new Uint8Array(length);
  const visit = (node, inTemplate) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }
    if (node.type === 'TemplateLiteral') {
      mask.fill(1, node.start, node.end);
      inTemplate = true;
    } else if (inTemplate && node.type === 'BlockStatement') {
      mask.fill(0, node.start, node.end);
      inTemplate = false;
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          visit(item, inTemplate);
        }
      } else if (child && typeof child.type === 'string') {
        visit(child, inTemplate);
      }
    }
  };
  visit(ast, false);
  return mask;
}

// Bytes of code tokens on each line (index = line number - 1).
function codeBytesPerLine(text, options = PARSE, list = tokens(text, options), ast = parser().parse(text, options)) {
  const starts = lineStarts(text);
  const mask = templateMask(ast, text.length);
  const perLine = new Array(starts.length).fill(0);
  for (const token of list) {
    if (!DATA_TOKENS.has(token.label) && !mask[token.start]) {
      perLine[lineIndex(starts, token.start)] += Buffer.byteLength(text.slice(token.start, token.end));
    }
  }
  return perLine;
}

function lineBytes(text) {
  return text.split('\n').map(line => Buffer.byteLength(line.replace(/^[ \t]+/, '')));
}

// Lines with more than LIMIT bytes of code: the rule the release audit enforces.
function denseLines(text, options = PARSE) {
  const total = lineBytes(text);
  return codeBytesPerLine(text, options)
    .map((bytes, index) => ({ line: index + 1, bytes, lineBytes: total[index] }))
    .filter(entry => entry.bytes > LIMIT);
}

// The AST without positions or raw spellings, as the proof that only layout changed.
function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'bigint' ? String(value) + 'n' : value;
  }
  if (value instanceof RegExp) {
    return String(value);
  }
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (!['start', 'end', 'loc', 'raw'].includes(key)) {
      out[key] = canonical(value[key]);
    }
  }
  return out;
}

function sameProgram(before, after, options) {
  const spell = text => tokens(text, options).map(token => text.slice(token.start, token.end));
  const a = spell(before);
  const b = spell(after);
  if (a.length !== b.length || a.some((token, i) => token !== b[i])) {
    return 'token sequence changed';
  }
  const astBefore = JSON.stringify(canonical(parser().parse(before, options)));
  const astAfter = JSON.stringify(canonical(parser().parse(after, options)));
  return astBefore === astAfter ? null : 'AST changed';
}

// Every place a line may break, grouped by the AST node that owns it. A break goes before an element (a statement,
// property, argument, operand ...) or before a closing bracket, never between a keyword such as return and its value.
function breakGroups(ast, text, list) {
  const groups = [];
  const tokenAt = new Map(list.map((token, index) => [token.start, index]));
  const tokenEndingAt = new Map(list.map((token, index) => [token.end, index]));
  // A parenthesised element breaks before its opening parenthesis, not inside it.
  const elementStart = element => {
    let index = tokenAt.get(element.start);
    if (index === undefined) {
      return element.start;
    }
    let end = element.end;
    while (index > 1 && list[index - 1].label === '(' && !ENDS_VALUE(list[index - 2]) && !PAREN_KEYWORDS.has(list[index - 2].keyword)) {
      const last = tokenEndingAt.get(end);
      const after = last === undefined ? -1 : last + 1;
      if (after < 0 || after >= list.length || list[after].label !== ')') {
        break;
      }
      index--;
      end = list[after].end;
    }
    return list[index].start;
  };
  const add = (node, depth, elements, closing = null, aligned = []) => {
    const positions = elements.filter(element => element && typeof element.start === 'number').map(element => (element.type ? elementStart(element) : element.start));
    if (positions.length) {
      groups.push({ node, depth, rank: RANK[node.type] ?? 1, positions, closing, aligned: new Set(aligned.filter(Boolean).map(element => element.start)) });
    }
  };
  const keywordBetween = (from, to, word) => {
    let index = tokenAt.get(from);
    if (index === undefined) {
      index = list.findIndex(token => token.start >= from);
    }
    for (; index >= 0 && index < list.length && list[index].start < to; index++) {
      if (list[index].keyword === word) {
        return { start: list[index].start };
      }
    }
    return null;
  };
  // f(a, b => {...}) and f({...}) keep their head on one line and break inside the last argument instead.
  const hugsLastArgument = node => {
    const args = node.arguments || [];
    const last = args[args.length - 1];
    if (!last) {
      return false;
    }
    const block = (last.type === 'ArrowFunctionExpression' || last.type === 'FunctionExpression') && last.body.type === 'BlockStatement';
    if (!block && last.type !== 'ObjectExpression' && last.type !== 'ArrayExpression') {
      return false;
    }
    const head = args.slice(0, -1);
    return head.every(arg => !/Function/.test(arg.type)) && head.reduce((sum, arg) => sum + arg.end - arg.start, 0) <= 60;
  };
  const chain = (node, operator, out) => {
    if (node.type === 'LogicalExpression' && node.operator === operator && !node.extra) {
      chain(node.left, operator, out);
      out.push(node.right);
    } else {
      out.push(node);
    }
    return out;
  };
  const visit = (node, depth, parent, inTemplate) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }
    // Template literals (HTML and label text with ${...} holes) are kept as written; a function body inside one is
    // ordinary code again.
    if (node.type === 'TemplateLiteral') {
      inTemplate = true;
    } else if (inTemplate && node.type === 'BlockStatement') {
      inTemplate = false;
    }
    switch (inTemplate ? '' : node.type) {
      case 'Program':
        add(node, depth, node.body);
        break;
      case 'BlockStatement':
      case 'StaticBlock':
      case 'ClassBody':
        add(node, depth, node.body, node.end - 1);
        break;
      case 'SwitchStatement':
        add(node, depth, node.cases, node.end - 1);
        break;
      case 'SwitchCase':
        add(node, depth, node.consequent);
        break;
      case 'ObjectExpression':
      case 'ObjectPattern':
        add(node, depth, node.properties, node.end - 1);
        break;
      case 'ArrayExpression':
      case 'ArrayPattern':
        add(node, depth, node.elements, text[node.end - 1] === ']' ? node.end - 1 : null);
        break;
      case 'CallExpression':
      case 'NewExpression':
        if ((node.arguments || []).length > 1 && !hugsLastArgument(node)) {
          add(node, depth, node.arguments);
        }
        break;
      case 'VariableDeclaration':
        add(node, depth, node.declarations.slice(1));
        break;
      case 'SequenceExpression':
        add(node, depth, node.expressions.slice(1));
        break;
      case 'LogicalExpression':
        if (!(parent && parent.type === 'LogicalExpression' && parent.operator === node.operator && parent.left === node)) {
          add(node, depth, chain(node, node.operator, []).slice(1));
        }
        break;
      case 'BinaryExpression':
        if (node.operator === '+' && !(parent && parent.type === 'BinaryExpression' && parent.operator === '+' && parent.left === node)) {
          const operands = [];
          let left = node;
          while (left.type === 'BinaryExpression' && left.operator === '+') {
            operands.unshift(left.right);
            left = left.left;
          }
          add(node, depth, operands);
        }
        break;
      case 'ConditionalExpression':
        add(node, depth, [node.consequent, node.alternate]);
        break;
      case 'ArrowFunctionExpression':
        if (node.expression) {
          add(node, depth, [node.body]);
        }
        break;
      case 'IfStatement': {
        const elements = [];
        if (node.consequent.type !== 'BlockStatement') {
          elements.push(node.consequent);
        }
        const otherwise = node.alternate ? keywordBetween(node.consequent.end, node.alternate.start, 'else') : null;
        elements.push(otherwise);
        add(node, depth, elements, null, [otherwise]);
        break;
      }
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'WhileStatement':
        if (node.body.type !== 'BlockStatement') {
          add(node, depth, [node.body]);
        }
        break;
      default:
        break;
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end') {
        continue;
      }
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          visit(item, depth + 1, node, inTemplate);
        }
      } else if (child && typeof child.type === 'string') {
        visit(child, depth + 1, node, inTemplate);
      }
    }
  };
  visit(ast, 0, null, false);
  return groups;
}

// Which breaks come first on a dense line: statements, then the outermost expression list or operator chain.
const RANK = {
  Program: 0, BlockStatement: 0, StaticBlock: 0, ClassBody: 0, SwitchStatement: 0, SwitchCase: 0, IfStatement: 0,
  ForStatement: 0, ForInStatement: 0, ForOfStatement: 0, WhileStatement: 0,
};
const breakOrder = (x, y) => x.rank - y.rank || x.depth - y.depth || x.node.start - y.node.start;

// Breaking before these tokens, or after these keywords, could change how the code parses; such places are skipped.
const NEVER_BEFORE = new Set(['++/--', '=>', '.', '?.', ',', ';', ')']);
const NEVER_AFTER = new Set(['return', 'throw', 'break', 'continue', 'yield', 'async', 'let', 'get', 'set', 'static', 'of']);
// A ( [ or ` after one of these would continue the value before it (a call, an index, a tagged template).
const OPENS_CONTINUATION = new Set(['(', '[', '`', 'template']);
const VALUE_KEYWORDS = new Set(['this', 'super', 'true', 'false', 'null']);
const ENDS_VALUE = token => ['name', ')', ']', '}', 'string', 'num', 'bigint', 'regexp', 'template', '`', '++/--', 'privateId'].includes(token.label) || VALUE_KEYWORDS.has(token.keyword);
const PAREN_KEYWORDS = new Set(['if', 'while', 'for', 'switch', 'catch', 'with', 'function']);

function indentUnit(text) {
  let one = 0;
  let two = 0;
  for (const line of text.split('\n')) {
    const spaces = /^ */.exec(line)[0].length;
    if (spaces === 1) {
      one++;
    } else if (spaces === 2) {
      two++;
    }
  }
  return one >= two ? ' ' : '  ';
}

function spread(text, file = 'input.js') {
  const options = optionsFor(file);
  const unit = indentUnit(text);
  let current = text;
  for (let round = 0; round < 40; round++) {
    const list = tokens(current, options);
    const ast = parser().parse(current, options);
    const starts = lineStarts(current);
    const perLine = codeBytesPerLine(current, options, list, ast);
    const total = lineBytes(current);
    const dense = new Set(perLine.map((bytes, index) => (worthSpreading(bytes, total[index]) ? index : -1)).filter(index => index >= 0));
    if (!dense.size) {
      return current;
    }
    const byStart = new Map(list.map((token, index) => [token.start, index]));
    const indentOf = index => /^[ \t]*/.exec(current.slice(starts[index], starts[index + 1] ?? current.length))[0];
    const breakable = position => {
      const index = byStart.get(position);
      if (index === undefined || index === 0) {
        return false;
      }
      const token = list[index];
      const before = list[index - 1];
      if (NEVER_BEFORE.has(token.label) || NEVER_AFTER.has(before.keyword || before.value)) {
        return false;
      }
      if (OPENS_CONTINUATION.has(token.label) && ENDS_VALUE(before)) {
        return false;
      }
      // Something other than indentation must come before it on its line.
      return lineIndex(starts, before.start) === lineIndex(starts, position) && before.end <= position;
    };
    const groups = breakGroups(ast, current, list);
    const chosen = new Map();
    for (const lineNumber of dense) {
      const from = starts[lineNumber];
      const to = starts[lineNumber + 1] ?? current.length;
      let best = null;
      for (const group of groups) {
        const inside = group.positions.filter(position => position > from && position < to && breakable(position));
        const closing = group.closing !== null && group.closing > from && group.closing < to && breakable(group.closing) ? group.closing : null;
        if (!inside.length) {
          continue;
        }
        if (!best || breakOrder(group, best.group) < 0) {
          best = { group, inside, closing };
        }
      }
      if (!best) {
        continue;
      }
      const openLine = lineIndex(starts, best.group.node.start);
      const outer = indentOf(openLine);
      for (const position of best.inside) {
        const elementIndent = openLine === lineNumber && best.group.node.type !== 'Program' ? outer + unit : indentOf(lineNumber);
        chosen.set(position, best.group.aligned.has(position) ? outer : elementIndent);
      }
      if (best.closing !== null) {
        chosen.set(best.closing, outer);
      }
    }
    if (!chosen.size) {
      return current;
    }
    let next = current;
    for (const position of [...chosen.keys()].sort((a, b) => b - a)) {
      let cut = position;
      while (cut > 0 && (next[cut - 1] === ' ' || next[cut - 1] === '\t')) {
        cut--;
      }
      next = next.slice(0, cut) + '\n' + chosen.get(position) + next.slice(position);
    }
    const problem = sameProgram(current, next, options);
    if (problem) {
      throw Error(file + ': ' + problem + ' in round ' + round);
    }
    current = next;
  }
  return current;
}

function authoredFiles() {
  return fs
    .readdirSync(EXTENSION, { recursive: true })
    .map(name => name.split(path.sep).join('/'))
    .filter(name => /\.m?js$/.test(name) && !name.startsWith('vendor/'))
    .sort();
}

function main(args) {
  const check = args.includes('--check');
  const named = args.filter(arg => !arg.startsWith('--'));
  const files = named.length ? named.map(name => path.relative(EXTENSION, path.resolve(name)).split(path.sep).join('/')) : authoredFiles();
  let remaining = 0;
  let changed = 0;
  for (const name of files) {
    const full = path.join(EXTENSION, name);
    const before = fs.readFileSync(full, 'utf8');
    const options = optionsFor(name);
    if (check) {
      for (const entry of denseLines(before, options)) {
        console.log(name + ':' + entry.line + ' has ' + entry.bytes + ' bytes of code in a ' + entry.lineBytes + '-byte line');
        remaining++;
      }
      continue;
    }
    const after = spread(before, name);
    if (after !== before) {
      const problem = sameProgram(before, after, options);
      if (problem) {
        throw Error(name + ': ' + problem);
      }
      fs.writeFileSync(full, after);
      changed++;
    }
    const left = denseLines(after, options);
    for (const entry of left) {
      console.log(name + ':' + entry.line + ' still has ' + entry.bytes + ' bytes of code in a ' + entry.lineBytes + '-byte line');
    }
    remaining += left.length;
  }
  if (check) {
    console.log(remaining ? remaining + ' dense lines.' : 'No dense lines.');
  } else {
    console.log('Spread ' + changed + ' files; tokens and AST unchanged. Dense lines left: ' + remaining + '.');
  }
  return remaining ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { LIMIT, codeBytesPerLine, denseLines, spread, sameProgram, canonical };
