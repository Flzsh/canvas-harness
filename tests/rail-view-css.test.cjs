'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../extension/refresh.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
function rule(selector){
 const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].trim()===selector);
 assert.ok(rules.length,selector);
 return Object.fromEntries(rules.at(-1)[2].split(';').map(line=>line.trim()).filter(Boolean).map(line=>{const i=line.indexOf(':');return [line.slice(0,i).trim(),line.slice(i+1).trim()];}));
}

test('the drawn toolbar has its own opaque background above the rail',()=>{
 const bar=rule('.rd .rd-toolbar');
 assert.equal(bar.background,'var(--rd-toolbar-plate, var(--rd-surface))');
 assert.equal(bar.isolation,'isolate');
 const search=rule('.rd .rd-toolbar > .rd-bar-search');
 assert.equal(search.background,'none');assert.match(search['border-bottom'],/dashed/);
});

test('every window size: the row stays one line and the tabs keep their words, which are all they have',()=>{
 assert.doesNotMatch(css,/rd-workspace-tab\[aria-selected=false\][^{]*\{[^}]*clip-path/);
 assert.match(css,/@media \(min-width: 1000px\) \{ \.rd \{ --rd-search-at: bar; \} \}/);
 const narrow=css.slice(css.indexOf('@media (min-width: 601px) {'));
 assert.match(narrow,/\.rd \.rd-toolbar > \.rd-workspace-tabs \{ flex: 0 1 auto; width: auto; min-width: 0; \}/);
 assert.match(narrow,/\.rd \.rd-toolbar > \.rd-bar-search:not\(\[hidden\]\) \{ flex: 0 10 300px; min-width: 140px; \}/);
});
