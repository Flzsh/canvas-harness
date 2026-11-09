'use strict';
// Grade impact's stage keeps what it knows about an element weakly (2026-11-06). Every Home render that comes back makes a
// new module element; a Map keyed by the module (lastApp) held each old one and its whole drawing alive: in a bench run of
// clicks round the tabs the page's node count rose by 72 a click without end (4,985 -> 13,229 after 120 clicks, the page
// itself steady at 5,336). Measured with perf3/longuse.mjs; this pins the cause.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../extension/grade-impact-art.js'),'utf8');
test('grade impact remembers each module and room weakly, so a replaced one can be collected',()=>{
 assert.match(src,/lastApp=new WeakMap\(\)/,'the last face shown per module or room is a WeakMap');
 assert.doesNotMatch(src,/lastApp=new Map\(/);
 for(const name of ['seen','arrived','outside','values','clays','hiddenRoom','memo'])assert.match(src,new RegExp(name+'=new Weak(Set|Map)\\(\\)'),name+' is weak');
 assert.doesNotMatch(src,/lastApp\.(keys|values|entries|forEach|size|clear)\b/,'nothing walks lastApp, so a WeakMap is all it needs');
});
