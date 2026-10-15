'use strict';
// Canvas's own menu bar drawn in the workspace's style (extension/canvas-nav.js and canvas-nav.css).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ext=path.join(__dirname,'../extension'),read=f=>fs.readFileSync(path.join(ext,f),'utf8');
const Nav=require('../extension/canvas-nav.js'),manifest=JSON.parse(read('manifest.json'));

test('Canvas items are known by their link ids, Studio by its label; anything else keeps Canvas’s icon',()=>{
 const link=(id,label='')=>({id,querySelector:()=>({textContent:label})});
 for(const [id,kind] of [['global_nav_profile_link','account'],['global_nav_dashboard_link','dashboard'],['global_nav_courses_link','courses'],['global_nav_calendar_link','calendar'],['global_nav_conversations_link','inbox'],['global_nav_history_link','history'],['global_nav_help_link','help']])
  assert.equal(Nav.kindOf(link(id)),kind,id);
 assert.equal(Nav.kindOf(link('context_external_tool_9_menu_item',' Studio ')),'studio');
 assert.equal(Nav.kindOf(link('context_external_tool_12_menu_item','Commons')),'');
 assert.deepEqual(Object.keys(Nav.DRAWINGS).sort(),['account','calendar','courses','dashboard','help','history','inbox','studio']);
 for(const [kind,svg] of Object.entries(Nav.DRAWINGS))assert.doesNotMatch(svg,/<script|\son\w+=|href=|url\(/i,kind);
});

test('every school’s logo is shown well: light marks on nothing turn to ink, a logo with its own ground stays as drawn',()=>{
 const pixels=(w,h,paint)=>{const a=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=paint(x,y);a.set(p,(y*w+x)*4);}return a;};
 const white=pixels(40,20,(x,y)=>x>10&&x<30&&y>5&&y<15?[255,255,255,255]:[0,0,0,0]);
 const dark=pixels(40,20,(x,y)=>x>10&&x<30&&y>5&&y<15?[20,30,40,255]:[0,0,0,0]);
 const badge=pixels(40,20,(x,y)=>x>15?[18,74,140,255]:[240,190,40,255]);
 const photo=pixels(40,20,(x,y)=>[x*6,y*12,120,255]);
 assert.equal(Nav.logoKind(white),'ink');assert.equal(Nav.logoKind(dark),'dark');
 assert.equal(Nav.logoKind(badge),'framed');assert.equal(Nav.logoKind(photo),'framed');
 assert.equal(Nav.logoKind(new Uint8ClampedArray(16)),'framed','an empty logo is left alone');
 // A logo that cannot be read (no CORS) falls back to the plate in the school's own menu colour.
 assert.match(read('canvas-nav.js'),/catch\{done\('plate'\);\}/);
 const css=read('canvas-nav.css');
 assert.match(css,/\[data-chn-logo=plate\] \.ic-app-header__logomark \{ background-color: var\(--chn-school-logo, var\(--chn-school, #394B58\)\) !important; \}/);
 assert.match(css,/\[data-chn-logo=ink\] \.ic-app-header__logomark \{ filter: brightness\(0\);/);
});

test('it only ever touches Canvas’s menu bar, and only while it is switched on',()=>{
 const css=read('canvas-nav.css').replace(/\/\*[\s\S]*?\*\//g,'');
 const selectors=[...css.matchAll(/(^|\})\s*([^@{}][^{}]*)\{/g)].map(m=>m[2].trim()).filter(s=>s&&!/^(@|from|to|\d+%)/.test(s));
 for(const group of selectors)for(const one of group.split(/,(?![^(]*\))/))assert.match(one.trim(),/^html\.chn-nav(\[|:not\(|\s)/,one);
 assert.match(read('canvas-nav.js'),/values\[KEY\]==='original'\|\|values\['reserve:enabled'\]===false\)return;/);
});

test('the copied frame rules match the workspace’s, and the files are wired in',()=>{
 const sync=require('../scripts/canvas-nav-css.cjs');assert.equal(sync.build(),read('canvas-nav.css'));
 const all=manifest.content_scripts.find(entry=>entry.js.includes('content.js'));
 assert.ok(all.js.includes('canvas-nav.js'));assert.ok(all.js.indexOf('course-art.js')<all.js.indexOf('canvas-nav.js'),'it draws with the course frames');
 for(const entry of manifest.web_accessible_resources)assert.ok(entry.resources.includes('canvas-nav.css'));
 const popup=read('popup.html');assert.match(popup,/<select id="canvas-nav"><option value="drawn">Hand-drawn<\/option><option value="original">Canvas original<\/option><\/select>/);
 assert.match(read('popup.js'),/'reserve:canvasNav':menuBar\.value/);
});
