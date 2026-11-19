'use strict';
// The Bookmarks shelf on Home sits in an `auto` column of the filter row's grid. A percentage max-width on it resolves
// against that column itself, so the shelf took 42% of its own column and the bookmark's name was cut to two letters
// ("Re", "De") with empty space beside it (seen 2026-11-14 at 1366x768 and 1440x900).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'..','extension','responsive-layout.css'),'utf8');
test('the Home Bookmarks shelf in the filter grid has no percentage max-width',()=>{
 const rules=[...css.matchAll(/([^{}]*\.rd-desk-toolbar\s*>\s*\.rd-bookmarks\s*)\{([^}]*)\}/g)].map(m=>m[2]);
 assert.ok(rules.length,'the shelf rule is there');
 for(const body of rules){const m=body.match(/max-width\s*:\s*([^;]+)/);if(m)assert.doesNotMatch(m[1],/%/,'max-width: '+m[1]);}
});
test('the shelf is still bounded and its list still scrolls sideways when there are many bookmarks',()=>{
 assert.match(css,/\.rd-desk-toolbar > \.rd-bookmarks \{[^}]*max-width: 560px/);
 assert.match(css,/\.rd-bookmark-list \{[^}]*overflow-x: auto/);
});
