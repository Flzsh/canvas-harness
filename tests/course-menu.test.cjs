'use strict';
// A course's own Canvas menu (#section-tabs) drawn like the course sidebar (extension/canvas-nav.css).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8');
// A course's own menu (Home, Assignments, Grades, …) in the same style: looks only, and nothing moves between pages.
test('a course’s menu is drawn like the course sidebar: looks only, the same box for every item',()=>{
 const css=read('canvas-nav.css'),part=css.slice(css.lastIndexOf('/*',css.indexOf("a course's own menu")));
 assert.ok(part.length>200,'the course menu section is there');
 const rules=[...part.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m=>[m[1].trim(),m[2]]).filter(([sel])=>!sel.startsWith('@'));
 // canvas-nav.test.cjs already requires every rule in canvas-nav.css to start with html.chn-nav (on only while the
 // hand-drawn menu bar is); these rules also stay inside the course menu.
 for(const [sel,body] of rules){
  assert.match(sel,/^(@media[^{]*)?html\.chn-nav (#left-side|#section-tabs)/,sel);
  assert.doesNotMatch(body,/display:\s*none|visibility:\s*hidden|(^|[;\s])order:|content:\s*"[^"]/,sel+' hides, reorders or renames nothing');
 }
 const active=rules.find(([sel])=>/a\.active$/.test(sel))[1];
 assert.doesNotMatch(active,/margin|padding/,'the current page keeps the same box as the others');
 assert.match(active,/font: 600 15px\/20px "Literata"/);
 assert.match(rules.find(([sel])=>/li\.section a$/.test(sel))[1],/font: 450 15px\/20px/,'same line height as the current page');
 assert.match(part,/#section-tabs \.nav-badge \{[^}]*background: var\(--cn-accent\)/);
 assert.match(part,/a:focus-visible \{ outline: 2px solid var\(--cn-accent\)/,'keyboard focus stays visible');
 assert.match(part,/--cn-accent: var\(--chn-accent, #A9522F\)/,'coloured by the workspace palette');
});
