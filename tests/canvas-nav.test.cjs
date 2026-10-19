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
 const js=read('canvas-nav.js');assert.match(js,/if\(values\['reserve:enabled'\]===false\)return;\s*if\(values\[KEY\]!=='original'\)enable\(values\[KEY\]\);/);
});

test('the copied frame rules match the workspace’s, and the files are wired in',()=>{
 const sync=require('../scripts/canvas-nav-css.cjs');assert.equal(sync.build(),read('canvas-nav.css'));
 const all=manifest.content_scripts.find(entry=>entry.js.includes('content.js'));
 assert.ok(all.js.includes('canvas-nav.js'));assert.ok(all.js.indexOf('course-art.js')<all.js.indexOf('canvas-nav.js'),'it draws with the course frames');
 for(const entry of manifest.web_accessible_resources)assert.ok(entry.resources.includes('canvas-nav.css'));
 const popup=read('popup.html');
 for(const value of ['drawn','shown','top','original'])assert.match(popup,new RegExp('data-nav="'+value+'"'));
 assert.match(read('popup.js'),/'reserve:canvasNav':button\.dataset\.nav/);
});

test('the bar sits against the window’s edge with its pen line on three sides, and keeps Canvas’s quirks tidy',()=>{
 const css=read('canvas-nav.css'),js=read('canvas-nav.js');
 assert.match(css,/#header::before \{ inset: var\(--chn-top, 12px\) 0 var\(--chn-bottom, 12px\) 0; background: var\(--chn-sidebar-c\); border-radius: 0 16px 16px 0; \}/,'flush against the left edge');
 assert.match(css,/M-4 6\.4C8 5\.8/,'the line starts off the left edge, so it reads as "]"');
 assert.match(css,/\.menu-item__badge:is\(:empty, \[data-chn-empty\]\) \{ display: none !important; \}/,'an empty badge stays hidden');
 assert.match(js,/badge\.dataset\.chnEmpty=''/);
 assert.match(css,/white-space: nowrap; overflow-wrap: normal; word-break: keep-all;/,'labels never break inside a word');
 assert.ok(!js.includes(''),'no control characters in the matchers');
 const link=(id,label)=>({id,querySelector:()=>({textContent:label})});
 assert.equal(Nav.kindOf(link('context_external_tool_3_menu_item','Canvas Studio')),'studio');assert.equal(Nav.kindOf(link('x','Studios of Art')),'');
 assert.match(js,/class="chn-logo-art"/,'a kept logo hangs in a drawn frame');
 assert.match(css,/\.ic-app-header__secondary-navigation \{ background: none !important; padding-bottom: calc\(var\(--chn-bottom, 12px\) \+ 10px\); \}/,'the collapse arrow stays above the bar’s bottom line');
});

// The user (2026-10-15): the bar is used now and then, so it hides off the left edge, comes out as a shorter card in the
// middle of the edge when the pointer reaches the edge, and Canvas's page takes the whole width meanwhile.
// The user (2026-10-15): three ways to have it. Full height; out from the left edge, moving the page aside so it covers
// nothing; or across the top, in the free stretch of the dashboard's toolbar (a strip across the page elsewhere).
test('the layouts: drawer by default (it moves the page aside), full height, or across the top',()=>{
 const css=read('canvas-nav.css'),js=read('canvas-nav.js');
 assert.match(js,/const LAYOUTS=\{drawn:'drawer',shown:'column',top:'top'\};/);
 assert.match(js,/html\.dataset\.chnLayout=LAYOUTS\[choice\]\|\|'drawer';/,'the drawer is the default');
 // drawer: hidden, centred, as tall as its items; the page moves aside by the bar's width, as one picture, then re-lays out once
 assert.match(css,/html\.chn-nav\[data-chn-layout=drawer\] #wrapper \{ margin-left: var\(--chn-push, 0px\) !important; transition: margin-left 260ms cubic-bezier\(\.25, \.8, \.3, 1\); \}/,'the page makes room beside the bar, easing (the user, 2026-10-16: nothing out of reach, nothing jumping)');
 assert.match(css,/html\.chn-nav\[data-chn-layout=drawer\] #header \{[^}]*top: 50% !important;[^}]*height: auto !important;[^}]*transform: translate\(calc\(-100% - 24px\), -50%\);/);
 assert.match(js,/html\.style\.setProperty\('--chn-push',by\+'px'\);/);
 assert.doesNotMatch(js,/page\.style\.transform/,'the page is never shifted past the window\u2019s edge');
 for(const hook of ["edge.addEventListener('pointerenter',open,{signal})","header.addEventListener('pointerleave',()=>close(),{signal})","header.addEventListener('focusin',open,{signal})",'trayOpen()'])assert.ok(js.includes(hook),hook);
 // across the top: in the toolbar while it fits (names, then drawings alone, then without the logo), else a strip
 assert.match(js,/for\(const kind of \['full','icons','bare'\]\)/);
 assert.match(js,/html\.dataset\.chnPlace='toolbar';/);assert.match(js,/html\.dataset\.chnPlace='strip';/);
 assert.match(css,/html\.chn-nav\[data-chn-layout=top\]\[data-chn-place=strip\] #wrapper \{ margin-top: 58px !important; \}/);
 assert.match(css,/html\.chn-nav\[data-chn-layout=top\] #header \{[^}]*flex-direction: row !important;[^}]*transform: none !important;/,'its own row, none of the column\u2019s slide');
 assert.match(css,/#header\[data-chn-fit=bare\] \.ic-app-header__logomark-container \{ display: none !important; \}/);
});

// The user (2026-10-15) could not find the choice in the toolbar popup: it is in Make it yours too, and any change
// applies to every open Canvas page at once, with no motion while it switches.
test('Make it yours offers the four menu bar choices, stored where the popup keeps it, and open pages switch at once',()=>{
 const ui=read('customize-ui.js'),dash=read('dashboard.js'),js=read('canvas-nav.js'),css=read('canvas-nav.css');
 assert.match(ui,/choices\('canvasNav','Canvas menu bar',\[\['drawn','From the left edge'[\s\S]*?\['shown','Full height'[\s\S]*?\['top','Across the top'[\s\S]*?\['original','Canvas\u2019s own'[\s\S]*?\{value:c\.canvasNav\|\|'drawn',cols:2,field:'canvas-nav'\}\)/);
 assert.match(dash,/if\(field==='canvas-nav'\)\{const value=event\.target\.value;if\(!NAV_CHOICES\.includes\(value\)\)return;canvasNav=value;root\.chrome\?\.storage\?\.local\?\.set\?\.\(\{'reserve:canvasNav':value\}\)/);
 assert.match(dash,/root\.chrome\?\.storage\?\.onChanged\?\.addListener\?\.\(navChanged\)/);assert.match(dash,/removeListener\?\.\(navChanged\)/);
 assert.match(js,/root\.chrome\.storage\.onChanged\?\.addListener\(\(changes,area\)=>\{if\(area==='local'&&changes\[KEY\]\)apply\(changes\[KEY\]\.newValue\);\}\);/);
 assert.match(js,/for\(const step of undo\.splice\(0\)\)try\{step\(\);\}catch\{\}/,'each layout is undone before the next');
 assert.match(js,/if\(header\)undecorate\(header\);html\.classList\.remove\('chn-nav'\)/,'Canvas original takes every drawing off');
 assert.match(css,/html\.chn-nav\[data-chn-switching\] #header, html\.chn-nav\[data-chn-switching\] #header \*, html\.chn-nav\[data-chn-switching\] #wrapper \{ transition: none !important; animation: none !important; \}/);
});

// Seen on a real Canvas (2026-10-16): Canvas makes the logo's container full width and lets the navigation grow, which in a
// row pushed the whole menu past the bar's end. Both take their own width across the top, and the fit counts any spill.
test('across the top, the logo and the navigation take only their own width, and the fit counts anything that spills',()=>{
 const css=read('canvas-nav.css'),js=read('canvas-nav.js');
 assert.match(css,/html\.chn-nav\[data-chn-layout=top\] #header \.ic-app-header__main-navigation \{[^}]*width: auto !important; flex: none !important;/);
 assert.match(css,/html\.chn-nav\[data-chn-layout=top\] #header \.ic-app-header__logomark-container \{ flex: none !important; width: auto !important;/);
 assert.match(js,/if\(Math\.max\(header\.offsetWidth,header\.scrollWidth\)<=width\)return true;/);
});
