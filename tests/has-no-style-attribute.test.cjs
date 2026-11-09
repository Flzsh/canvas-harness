'use strict';
// Speed (2026-11-05): a :has() that reads the style attribute ([style...] inside it) makes Chrome re-check :has() on every
// inline style change anywhere on the page; with the dashboard's broad :has() rules that restyled all of Home on each frame
// of the moving drawings (about 2,100 elements a frame). No stylesheet may read [style] inside :has().
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','extension');
// (the dashboard's sheets, the ones startup.js puts in its shadow root; native-page.css styles Canvas's own pages and reads
// teachers' inline colours there on purpose)
const sheets=fs.readFileSync(path.join(dir,'startup.js'),'utf8').match(/const allSheets=\[([^\]]*)\]/)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));
test('no :has() in the dashboard reads the style attribute',()=>{
 assert.ok(sheets.length>10&&sheets.includes('settings-dock.css'));
 const bad=[];
 for(const file of sheets){
  const css=fs.readFileSync(path.join(dir,file),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  for(const m of css.matchAll(/:has\(/g)){let depth=1,i=m.index+5;for(;i<css.length&&depth;i++){if(css[i]==='(')depth++;else if(css[i]===')')depth--;}const arg=css.slice(m.index,i);if(/\[\s*style\b/.test(arg))bad.push(file+': '+arg.slice(0,90));}
 }
 assert.deepEqual(bad,[]);
});
test('the choices grids carry their column count as data-cols',()=>{
 assert.match(fs.readFileSync(path.join(dir,'customize-ui.js'),'utf8'),/data-cols="\$\{cols\}" style="--cz-cols:\$\{cols\}"/);
 assert.match(fs.readFileSync(path.join(dir,'settings-dock.css'),'utf8'),/\.cz-scenes\[data-cols="2"\]\+\.ch-make-list/);
});
// Speed (2026-11-05): a :has() asked of the root .rd made Chrome re-check the root, and restyle the whole page, for every
// node an animation inserted (each frame after a click). The root carries such states as attributes instead.
test('no dashboard rule asks :has() of the root .rd',()=>{
 const bad=[];
 for(const file of sheets){const css=fs.readFileSync(path.join(dir,file),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');for(const m of css.matchAll(/(^|[\s,{}>+~(])\.rd((?:\[[^\]]*\])*):has\(/g))bad.push(file+': .rd'+m[2]+':has(');}
 assert.deepEqual(bad,[]);
 const refresh=fs.readFileSync(path.join(dir,'refresh.css'),'utf8'),dash=fs.readFileSync(path.join(dir,'dashboard.js'),'utf8');
 assert.match(refresh,/\.rd\[data-rv-drawer=open\] \.rd-dock \{/);assert.match(refresh,/\.rd\[data-rv-drawer=open\]::after \{ display: none; \}/);
 assert.match(dash,/return v!=='false'&&v!=='';/,'the same test the :has() made: a Review room whose drawer is neither false nor empty');
 assert.match(dash,/drawerWatch\?\.disconnect\?\.\(\)/);
});
