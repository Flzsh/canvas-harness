'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../extension/workspace-arrange.js');
const G = require('../extension/workspace-gestures.js');
const {fixture} = require('./gesture-fixture.cjs');

const read = name => fs.readFileSync(require.resolve('../extension/' + name), 'utf8');

function rules(text) {
  const result = [], stack = [];
  let buffer = '';
  for (const char of text.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      stack.push(buffer.trim());
      buffer = '';
    } else if (char === '}') {
      const selector = stack.pop();
      if (selector && !selector.startsWith('@') && buffer.trim()) {
        const declarations = buffer.split(';').filter(part => part.includes(':')).map(part => {
          const colon = part.indexOf(':');
          return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()];
        });
        result.push({selector, body: Object.fromEntries(declarations)});
      }
      buffer = '';
    } else buffer += char;
  }
  return result;
}

test('topbar bounds the shell and scrolls Home modules inside their allocated space', () => {
  const shellSelector = '.rd[data-course-navigation=topbar] .rd-shell';
  const container = rules(read('workspace.css')).find(rule => rule.selector === shellSelector)?.body;
  assert.equal(container?.['container-type'], 'inline-size', 'the heading above the strip has a size container');
  assert.equal(container?.['container-name'], 'work-area');
  const appearance = rules(read('customize.css'));
  assert.equal(appearance.find(rule => rule.selector === shellSelector + ' > .rd-course-rail')?.body.top, '0');
  assert.equal(appearance.find(rule => rule.selector === shellSelector + ' > .rd-workspace-heading')?.body['margin-bottom'], '0', 'the strip sits directly under the heading');
  const css = read('responsive-layout.css');
  const all = rules(css);
  const find = (suffix, property) => all.find(rule =>
    rule.selector.startsWith('.rd[data-course-navigation=topbar]') &&
    rule.selector.endsWith(suffix) && rule.body[property] !== undefined
  )?.body;
  const shell = find(' .rd-shell', 'height');
  assert.ok(shell, 'topbar has a viewport-bounded shell');
  assert.match(shell.height, /100dvh - var\(--rd-rail-top,150px\) - var\(--rd-status-h,56px\)/);
  assert.equal(shell.flex, 'none');
  assert.equal(shell['min-height'], '0');
  assert.equal(shell.display, 'grid');
  assert.equal(shell['grid-template-columns'], 'minmax(0,1fr)!important');
  const column = find(' .rd-shell > .rd-workspace', 'overflow-y');
  assert.equal(column['min-height'], '0');
  assert.equal(column['overflow-y'], 'auto');
  assert.equal(column['overflow-anchor'], 'none');
  assert.equal(find(' .rd-shell > .rd-workspace > *', 'flex-shrink')['flex-shrink'], '0');
  const home = find(' .rd-shell > .rd-workspace', 'overflow');
  assert.equal(home.overflow, 'hidden');
  const desk = find(' .rd-main.rd-desk', 'grid-template-rows');
  assert.equal(desk.flex, '1 1 0');
  assert.match(desk['grid-template-rows'], /--rd-layout-rows/);
  assert.equal(find(' .rd-main.rd-desk', 'grid-template-columns')['grid-template-columns'], 'var(--rd-layout-columns,minmax(0,1fr))!important');
  const module = find(' .rd-main.rd-desk > [data-arrange-key]', 'overflow');
  assert.deepEqual(
    ['height', 'min-height', 'max-height', 'overflow', 'overscroll-behavior', 'scrollbar-width', 'scrollbar-gutter'].map(key => module[key]),
    ['100%', '0', '100%', 'auto', 'contain', 'thin', 'stable']
  );
  assert.equal(module['grid-column'], 'var(--rd-panel-column,auto)!important');
  assert.equal(module['grid-row'], 'var(--rd-panel-row,auto)!important');
  assert.equal(find(' .rd-information > .rd-reader', 'position').position, 'static');
  assert.equal(find(' .rd-information > .rd-reader .rd-reader-content', 'overflow').overflow, 'visible');
  assert.doesNotMatch(css, /data-course-navigation=dock/, 'the port adds no course dock layout');
});

test('topbar keeps stacked Home cells stable as content grows and cleans up its observers', () => {
  const f = fixture();
  f.controller.destroy();
  f.container.dataset.courseNavigation = 'topbar';
  f.settings.workspaceLayout = {axis: 'x', children: ['context', {axis: 'y', children: ['work', 'reader']}]};
  const desk = f.container.querySelector('.rd-main');
  const win = f.container.ownerDocument.defaultView;
  const observers = [], counts = {reads: 0, writes: 0};
  win.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.nodes = new Set(); observers.push(this); }
    observe(node) { this.nodes.add(node); }
    unobserve(node) { this.nodes.delete(node); }
    disconnect() { this.nodes.clear(); }
  };
  for (const node of Object.values(f.panels)) {
    Object.defineProperty(node, 'offsetHeight', {get() { counts.reads++; return node.rect.height; }});
  }
  Object.defineProperty(desk, 'clientWidth', {get() { counts.reads++; return desk.rect.width; }});
  for (const node of [desk, ...Object.values(f.panels)]) {
    node.style.getPropertyValue = key => node.style[key] || '';
    const put = node.style.setProperty;
    node.style.setProperty = (key, value) => { counts.writes++; put(key, value); };
  }
  const controller = G.create({container: f.container, getSettings: () => f.settings, onChange: () => true}, M);
  const observe = () => {
    for (const observer of observers) observer.callback([...observer.nodes].map(target => ({
      target,
      contentRect: {width: target.rect.width, height: target.rect.height},
      borderBoxSize: [{inlineSize: target.rect.width, blockSize: target.rect.height}]
    })));
    f.tick(20);
  };
  try {
    controller.sync();
    observe();
    const rows = desk.style['--rd-layout-rows'];
    const cells = Object.fromEntries(Object.entries(f.panels).map(([key, node]) => [key, node.style['--rd-panel-row']]));
    assert.equal(rows, 'minmax(0,0.5fr) minmax(0,0.5fr)');
    assert.deepEqual(cells, {context: '1 / 3', work: '1 / 2', reader: '2 / 3'});
    assert.notEqual(desk.dataset.rows, 'measured');
    const before = {...counts};
    f.panels.work.rect.height = 4000;
    observe();
    assert.equal(counts.reads, before.reads, 'observed changes add no synchronous layout reads');
    assert.equal(counts.writes, before.writes, 'long content cannot enlarge the allocated cells');
    assert.equal(desk.style['--rd-layout-rows'], rows);
    assert.deepEqual(Object.fromEntries(Object.entries(f.panels).map(([key, node]) => [key, node.style['--rd-panel-row']])), cells);
    f.container.dataset.courseNavigation = 'sidebar';
    controller.sync();
    assert.equal(desk.dataset.rows, 'measured');
    f.container.dataset.courseNavigation = 'topbar';
    controller.sync();
    assert.equal(desk.style['--rd-layout-rows'], rows);
    assert.ok(Object.values(f.panels).every(node => node.style['--rd-panel-grow'] === '0px'));
  } finally {
    controller.destroy();
  }
  assert.ok(observers.every(observer => observer.nodes.size === 0));
  assert.equal(f.listeners.size, 0);
});

test('fitted rows preserve unequal nested stack proportions and narrow wrapping', () => {
  const tree = {axis: 'x', children: [
    {axis: 'y', children: ['context', 'work']},
    {axis: 'y', children: ['reader', 'notes', 'clock']}
  ]};
  const wide = M.grid(tree, 1800);
  assert.equal(wide.rows, 'auto auto auto auto');
  assert.equal(wide.fitRows, 'minmax(0,0.3333fr) minmax(0,0.1667fr) minmax(0,0.1667fr) minmax(0,0.3333fr)');
  const narrow = M.grid(tree, 380);
  assert.equal(new Set(Object.values(narrow.cells).map(cell => cell.column)).size, 1);
  assert.ok(narrow.fitRows.split('minmax').length > 3);
});

function topbarDashboard(showCourseStrip) {
  const writes = [], timers = [], observers = [], classes = new Set();
  let top = 106, visible = true, revision = 0;
  const shell = {getClientRects: () => visible ? [{}] : [], getBoundingClientRect: () => ({top})};
  const column = {css: {overflowY: 'hidden'}};
  const rail = {display: showCourseStrip ? 'flex' : 'none', getClientRects: () => visible && showCourseStrip ? [{}] : [], parentElement: shell, querySelectorAll: () => []};
  const status = {css: {position: 'absolute'}, getBoundingClientRect() { throw Error('hidden status must not be measured'); }};
  const page = {nodeType: 1, css: {paddingBottom: '12px'}};
  const host = {nodeType: 1, parentElement: page};
  const area = {nodeType: 1, getRootNode: () => ({host})};
  const element = {
    dataset: {}, nodeType: 1, parentElement: area, css: {paddingBottom: '14px', borderBottomWidth: '1px'},
    style: {setProperty: (key, value) => writes.push([key, value])},
    setAttribute() {}, addEventListener() {}, removeEventListener() {}, remove() {},
    querySelector: selector => selector === '.rd-shell' ? shell : selector === '.rd-shell > .rd-workspace' ? column : selector === '.rd-shell .rd-course-rail' ? rail : selector === '.rd-status' ? status : null,
    querySelectorAll: () => []
  };
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(node) { this.targets.push(node); }
    disconnect() { this.targets = []; }
  }
  const store = {
    owner: {origin: 'https://school.instructure.com', accountId: '5'},
    get: () => ({settings: {theme: 'light', courseNavigation: 'topbar', showCourseStrip}, tasks: {}}),
    subscribe: () => () => {}, update: async () => {}
  };
  const context = {
    URL, Intl, Date, Map, Set, ResizeObserver, scrollY: 30,
    ReserveSite: {origin: () => store.owner.origin},
    document: {documentElement: {classList: {contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name)}}, createElement: () => element, addEventListener() {}, removeEventListener() {}},
    sessionStorage: {getItem: () => null, setItem() {}},
    setInterval: () => 0, clearInterval() {},
    setTimeout: (callback, ms) => timers.push({callback, ms, done: false}),
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].done = true; },
    getComputedStyle: node => ({display: node.display || 'block', getPropertyValue: () => '', ...node.css}),
    ReservePersonalWork: {normalize: () => []}, ReserveUI: require('../extension/ui-utils.js'),
    ReserveCore: require('../extension/core.js'), ReserveDashboardModel: require('../extension/dashboard-model.js'),
    ReserveWorkModel: require('../extension/work-model.js'), ReserveDashboardView: require('../extension/dashboard-view.js'),
    ReserveCustomization: require('../extension/customization-model.js')
  };
  vm.runInNewContext(read('dashboard.js'), context);
  const view = context.ReserveDashboard.mount({append() {}}, {snapshot: {courses: [{id: '7', name: 'Chemistry'}], assignments: []}, store, initialState: {workspace: 'work'}});
  const layout = observers.find(observer => observer.targets.includes(element));
  const flush = () => { for (const timer of timers) if (!timer.done && timer.ms === 0) { timer.done = true; timer.callback(); } };
  return {
    view, writes, classes,
    value: key => writes.filter(([name]) => name === key).at(-1)?.[1],
    resize() { layout.callback([{target: element, contentRect: {width: 1200, height: 900 + ++revision}}]); flush(); },
    set top(value) { top = value; }, set visible(value) { visible = value; }
  };
}

for (const showCourseStrip of [true, false]) test('topbar measures its shell and bottom reserve with course strip ' + (showCourseStrip ? 'shown' : 'hidden'), () => {
  const f = topbarDashboard(showCourseStrip);
  try {
    assert.equal(f.value('--rd-rail-top'), '136px');
    assert.equal(f.value('--rd-status-h'), '27px', 'includes padding through the shadow host ancestors');
    assert.ok(f.classes.has('reserve-fit'), 'Home modules scroll while the Canvas page stays fitted');
    const before = f.writes.length;
    f.resize();
    assert.equal(f.writes.length, before, 'unchanged geometry does not write again');
    f.visible = false; f.top = 0; f.resize();
    assert.equal(f.value('--rd-rail-top'), '136px', 'hidden host retains its last valid offset');
    f.visible = true; f.top = 160; f.resize();
    assert.equal(f.value('--rd-rail-top'), '190px');
  } finally { f.view.destroy(); }
});
