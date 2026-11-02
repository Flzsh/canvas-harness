'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../extension/refresh.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
function rule(selector){
 const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].trim()===selector);
 assert.ok(rules.length,selector);
 return Object.fromEntries(rules.at(-1)[2].split(';').map(line=>line.trim()).filter(Boolean).map(line=>{const i=line.indexOf(':');return [line.slice(0,i).trim(),line.slice(i+1).trim()];}));
}

// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).

test('every window size: a tab that gives up its word keeps its drawing and shows its name as a tooltip',()=>{
 const view=fs.readFileSync(path.join(__dirname,'../extension/dashboard-view.js'),'utf8');
 assert.match(view,/data-tab="\$\{key\}" title="\$\{label\}"/);assert.match(view,/'>'\+draw\(key\)\+'\$1'/);
 assert.match(css,/rd-workspace-tab > span:not\(\.rd-n\):not\(\.rd-sr-only\) \{ position: absolute;/);
 assert.match(css,/@media \(min-width: 860px\) \{ \.rd \{ --rd-search-at: bar; \} \}/);
});
