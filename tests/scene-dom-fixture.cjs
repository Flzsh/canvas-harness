'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '../extension', file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Deliberately no layout API: these tests exercise DOM/state, never rendering.
// innerHTML creates real fixture descendants and clicks retain their original
// bubbling path even when the real panel replaces its markup during a callback.
function createDOM(html) {
  const documentEvents = new Map();
  const decode = value => String(value).replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[\da-f]+);/gi, entity => {
    const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" };
    return named[entity] ?? String.fromCodePoint(entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10));
  });
  const escape = value => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const split = (value, separator) => {
    let depth = 0, quote = '', start = 0;
    const parts = [];
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if ('(['.includes(c)) depth++;
      if (')]'.includes(c)) depth--;
      if (!depth && separator(c)) { if (value.slice(start, i).trim()) parts.push(value.slice(start, i).trim()); start = i + 1; }
    }
    if (value.slice(start).trim()) parts.push(value.slice(start).trim());
    return parts;
  };
  function matches(node, selector) {
    if (node.nodeType !== 1) return false;
    const alternatives = split(selector, c => c === ',');
    if (alternatives.length > 1) return alternatives.some(part => matches(node, part));
    const child = split(selector, c => c === '>');
    if (child.length > 1) return matches(node, child.pop()) && !!node.parentElement && matches(node.parentElement, child.join('>'));
    const parts = split(selector, c => /\s/.test(c));
    if (parts.length > 1) {
      if (!matches(node, parts.pop())) return false;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) if (matches(parent, parts.join(' '))) return true;
      return false;
    }
    let valid = true;
    selector = selector.replace(/:not\(([^()]+)\)/g, (_, inner) => { if (matches(node, inner)) valid = false; return ''; });
    selector = selector.replace(/\[([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\]/g, (_, key, double, single, bare) => {
      const value = double ?? single ?? bare;
      if (!node.hasAttribute(key) || value !== undefined && node.getAttribute(key) !== value) valid = false;
      return '';
    });
    selector = selector.replace(/#([\w-]+)/g, (_, id) => { if (node.id !== id) valid = false; return ''; })
      .replace(/\.([\w-]+)/g, (_, name) => { if (!node.classList.contains(name)) valid = false; return ''; });
    if (selector.includes(':')) throw Error('Unsupported fixture selector: ' + selector);
    return valid && (!selector || selector === '*' || node.tagName === selector.toUpperCase());
  }
  const addListener = (events, type, callback, options) => {
    if (!events.has(type)) events.set(type, []);
    events.get(type).push({ callback, once: !!options?.once });
  };
  const removeListener = (events, type, callback) => events.set(type, (events.get(type) || []).filter(item => item.callback !== callback));
  const dispatch = (events, event) => {
    for (const item of [...(events.get(event.type) || [])]) {
      if (item.once) removeListener(events, event.type, item.callback);
      item.callback(event);
    }
  };
  const document = {
    activeElement: null,
    createElement: tag => new Element(tag),
    createTextNode: text => new TextNode(String(text)),
    addEventListener: (type, fn, options) => addListener(documentEvents, type, fn, options),
    removeEventListener: (type, fn) => removeListener(documentEvents, type, fn),
    dispatchEvent(event) { event.target ??= document; dispatch(documentEvents, event); return !event.defaultPrevented; },
    querySelectorAll: selector => container.querySelectorAll(selector),
    querySelector: selector => container.querySelector(selector),
    getElementById: id => container.querySelector('#' + id)
  };
  class TextNode {
    constructor(value) { this.nodeType = 3; this.nodeValue = value; this.parentNode = null; }
    get textContent() { return this.nodeValue; }
    get outerHTML() { return escape(this.nodeValue); }
    remove() { if (this.parentNode) { this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1); this.parentNode = null; } }
  }
  class Element {
    constructor(tag, attrs = {}) {
      this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.childNodes = []; this.parentNode = null; this.events = new Map();
      this.value = attrs.value || ''; this.checked = 'checked' in attrs;
      this.style = { setProperty(key, value) { this[key] = String(value); }, removeProperty(key) { delete this[key]; } };
      for (const entry of (attrs.style || '').split(';')) { const at = entry.indexOf(':'); if (at >= 0) this.style[entry.slice(0, at).trim()] = entry.slice(at + 1).trim(); }
      this.dataset = new Proxy({}, {
        get: (_, key) => this.getAttribute('data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())) ?? undefined,
        set: (_, key, value) => { this.setAttribute('data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase()), value); return true; }
      });
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
        toggle: (name, force) => { const on = force ?? !this.classList.contains(name); this.classList[on ? 'add' : 'remove'](name); return on; }
      };
    }
    get id() { return this.attrs.id || ''; } set id(value) { this.attrs.id = String(value); }
    get type() { return this.attrs.type || ''; } set type(value) { this.attrs.type = String(value); }
    get className() { return this.attrs.class || ''; } set className(value) { this.attrs.class = String(value); }
    get hidden() { return this.hasAttribute('hidden'); } set hidden(value) { this.toggleAttribute('hidden', value); }
    get disabled() { return this.hasAttribute('disabled'); } set disabled(value) { this.toggleAttribute('disabled', value); }
    get children() { return this.childNodes.filter(node => node.nodeType === 1); }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    get firstChild() { return this.childNodes[0] || null; }
    get firstElementChild() { return this.children[0] || null; }
    get isConnected() { return this === document.documentElement || !!this.parentElement?.isConnected; }
    get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
    set textContent(value) { this.replaceChildren(); if (String(value)) this.append(document.createTextNode(value)); }
    get innerHTML() { return this.childNodes.map(node => node.outerHTML).join(''); }
    set innerHTML(value) { this.replaceChildren(); parse(String(value), this); }
    get outerHTML() { return '<' + this.tagName.toLowerCase() + Object.entries(this.attrs).map(([key, value]) => ` ${key}="${escape(value)}"`).join('') + '>' + this.innerHTML + '</' + this.tagName.toLowerCase() + '>'; }
    set outerHTML(value) { const fragment = new Element('fragment'); parse(String(value), fragment); this.replaceWith(...fragment.childNodes); }
    hasAttribute(name) { return name in this.attrs; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    removeAttribute(name) { delete this.attrs[name]; }
    toggleAttribute(name, force) { if (force ?? !this.hasAttribute(name)) this.setAttribute(name, ''); else this.removeAttribute(name); }
    append(...nodes) { for (let node of nodes) { if (typeof node === 'string') node = document.createTextNode(node); node.remove(); node.parentNode = this; this.childNodes.push(node); } }
    appendChild(node) { this.append(node); return node; }
    replaceChildren(...nodes) { for (const child of this.childNodes) child.parentNode = null; this.childNodes = []; this.append(...nodes); if (document.activeElement && !document.activeElement.isConnected) document.activeElement = document.body; }
    replaceWith(...nodes) {
      if (!this.parentNode) return;
      const parent = this.parentNode, at = parent.childNodes.indexOf(this);
      this.remove(); for (const node of nodes) node.remove(); parent.childNodes.splice(at, 0, ...nodes); for (const node of nodes) node.parentNode = parent;
    }
    remove() { if (this.parentNode) { this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1); this.parentNode = null; } }
    contains(node) { for (let current = node; current; current = current.parentNode) if (current === this) return true; return false; }
    matches(selector) { return matches(this, selector); }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (matches(node, selector)) return node; return null; }
    querySelectorAll(selector) {
      const found = [], visit = node => { for (const child of node.children) { if (matches(child, selector)) found.push(child); visit(child); } };
      visit(this); return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(type, fn, options) { addListener(this.events, type, fn, options); }
    removeEventListener(type, fn) { removeListener(this.events, type, fn); }
    focus() { document.activeElement = this; }
    animate() { return { finished: Promise.resolve(), cancel() {} }; }
    dispatchEvent(event) {
      event.target ??= this;
      const route = []; for (let node = this; node; node = node.parentElement) route.push(node);
      for (const node of route) { event.currentTarget = node; dispatch(node.events, event); if (event.cancelBubble || event.bubbles === false) break; }
      if (!event.cancelBubble && event.bubbles !== false) document.dispatchEvent(event);
      return !event.defaultPrevented;
    }
    click() {
      if (this.closest('button')?.disabled || this.disabled) return;
      const button = this.closest('button'); button?.focus();
      this.dispatchEvent({ type: 'click', bubbles: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.cancelBubble = true; } });
    }
  }
  function parse(source, parent) {
    const stack = [parent], voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    for (const match of source.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[\w-]+\b(?:"[^"]*"|'[^']*'|[^'">])*>|[^<]+/g)) {
      const raw = match[0];
      if (raw.startsWith('<!')) continue;
      if (raw.startsWith('</')) { const name = raw.slice(2, -1).trim().toUpperCase(), index = stack.findLastIndex(node => node.tagName === name); if (index > 0) stack.length = index; continue; }
      if (!raw.startsWith('<')) { stack.at(-1).append(new TextNode(decode(raw))); continue; }
      const [, tag, body] = raw.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/), attrs = {};
      for (const attr of body.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[attr[1]] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
      const node = new Element(tag, attrs); stack.at(-1).append(node);
      if (!voids.has(tag.toLowerCase()) && !raw.endsWith('/>')) stack.push(node);
    }
  }
  const container = new Element('document'); parse(html, container);
  document.documentElement = document.querySelector('html'); document.body = document.querySelector('body'); document.activeElement = document.body;
  return document;
}

module.exports = { read, plain, settle, deferred, createDOM };
