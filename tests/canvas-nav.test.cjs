'use strict';
// Canvas's own menu bar drawn in the workspace's style (extension/canvas-nav.js and canvas-nav.css).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ext=path.join(__dirname,'../extension'),read=f=>fs.readFileSync(path.join(ext,f),'utf8');
// scripts/readable-lines.cjs spreads dense code over several lines (whitespace only); match the code without them.
const compact=text=>text.replace(/\n[ \t]*/g,'');
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
 const js=read('canvas-nav.js');assert.match(js,/if\(values\['reserve:enabled'\]===false\)\{apply\('original'\);return;\}\s*if\(values\[KEY\]!=='original'\)enable\(values\[KEY\]\);else apply\('original'\);/);
});

test('the copied frame rules match the workspace’s, and the files are wired in',()=>{
 const sync=require('../scripts/canvas-nav-css.cjs');assert.equal(sync.build(),read('canvas-nav.css'));
 const all=manifest.content_scripts.find(entry=>entry.js?.includes('canvas-nav.js'));assert.ok(all,'the static manifest loads the menu');
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
 const ui=compact(read('customize-ui.js')),dash=compact(read('dashboard.js')),js=compact(read('canvas-nav.js')),css=read('canvas-nav.css');
 assert.match(ui,/choices\('canvasNav','Canvas menu bar',\[\['drawn','From the left edge'[\s\S]*?\['shown','Full height'[\s\S]*?\['top','Across the top'[\s\S]*?\['original','Canvas\u2019s own'[\s\S]*?\{value:c\.canvasNav\|\|'drawn',cols:2,field:'canvas-nav'\}\)/);
 assert.match(dash,/if\(field==='canvas-nav'\)\{const value=event\.target\.value;if\(!NAV_CHOICES\.includes\(value\)\)return;canvasNav=value;root\.chrome\?\.storage\?\.local\?\.set\?\.\(\{'reserve:canvasNav':value\}\)/);
 assert.match(dash,/root\.chrome\?\.storage\?\.onChanged\?\.addListener\?\.\(navChanged\)/);assert.match(dash,/removeListener\?\.\(navChanged\)/);
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

function storageFixture(){
 const listeners=new Set(),classes=new Set(),errors=[];let resolveRead,completion;
 const ready=new Promise(resolve=>{resolveRead=resolve;}),html={dataset:{},style:{setProperty(){}},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)}};
 const local={get(keys){assert.deepEqual(Array.from(keys),['reserve:canvasNav','reserve:navPalette','reserve:navLogo','reserve:enabled']);return {then(fn){completion=ready.then(fn);completion.catch(error=>errors.push(error));return completion;}};}};
 const env=vm.createContext({chrome:{storage:{local,onChanged:{addListener:fn=>listeners.add(fn)}}},ReserveSite:{supported:()=>true},location:{href:'https://canvas.example.edu/'},document:{documentElement:html,getElementById:()=>null,addEventListener(){},removeEventListener(){}},MutationObserver:class{observe(){}disconnect(){}},addEventListener(){},requestAnimationFrame:()=>1});
 vm.runInContext('globalThis.top=globalThis;',env);
 vm.runInContext(read('canvas-nav.js'),env,{filename:'canvas-nav.js'});
 return {env,html,classes,errors,listeners,async finish(values={'reserve:canvasNav':'original'}){resolveRead(values);await completion.catch(()=>{});},change(changes,area='local'){for(const fn of listeners)fn(changes,area);}};
}

for(const [name,chrome] of [['chrome is gone',undefined],['storage is gone',{}],['onChanged is gone',{storage:{}}],['addListener is gone',{storage:{onChanged:{}}}]]){
 test('a tab open across an extension update finishes its storage read when '+name,async()=>{
  const f=storageFixture();f.env.chrome=chrome;await f.finish();assert.deepEqual(f.errors,[],'the late storage continuation does not throw');assert.equal(f.listeners.size,0);assert.equal(f.classes.has('chn-nav'),false);
 });
}

test('available storage listeners still switch the open page and ignore unrelated changes',async()=>{
 const f=storageFixture();await f.finish();assert.deepEqual(f.errors,[]);assert.equal(f.listeners.size,1);
 f.change({'reserve:canvasNav':{newValue:'shown'}},'sync');f.change({'reserve:unrelated':{newValue:'shown'}});assert.equal(f.classes.has('chn-nav'),false);
 f.change({'reserve:canvasNav':{newValue:'shown'}});assert.equal(f.classes.has('chn-nav'),true);assert.equal(f.html.dataset.chnLayout,'column');
 f.change({'reserve:canvasNav':{newValue:'top'}});assert.equal(f.html.dataset.chnLayout,'top');
 f.change({'reserve:canvasNav':{newValue:'original'}});assert.equal(f.classes.has('chn-nav'),false);assert.equal(f.html.dataset.chnLayout,undefined);
});

test('on the dashboard the bar’s two edges are both read before either is written, so the page restyles once, not twice',()=>{
 const src=read('canvas-nav.js'),from=src.indexOf('const sync=()=>{',src.indexOf('function followWorkspace'));
 assert.ok(from>0,'followWorkspace has its sync step');
 const body=src.slice(from,src.indexOf('const later=',from));
 const make=new Function('rd','root','html','stopped','readPalette','applyPalette','store','saved','PALETTE','lastPalette',body+'return sync;');
 const run=({top=62,bottom=786,scrollY=0,innerHeight=800,shown=true}={})=>{
  const log=[],box=(name,rect)=>({getClientRects:()=>{log.push('read '+name);return shown?[rect]:[];},getBoundingClientRect:()=>{log.push('read '+name);return rect;}});
  const parts={'.rd-toolbar':box('bar',{top,bottom:top+40}),'.rd-course-rail':box('rail',{top:120,bottom})};
  const html={style:{setProperty:(k,v)=>log.push('write '+k+' '+v)}};
  make({querySelector:q=>parts[q]||null},{scrollY,innerHeight},html,false,()=>({}),()=>{},{set:()=>Promise.resolve()},{},'p','{}')();
  return log;
 };
 const log=run(),firstWrite=log.findIndex(l=>l.startsWith('write'));
 assert.deepEqual(log.slice(firstWrite),['write --chn-top 62px','write --chn-bottom 14px'],'the same two values as before');
 assert.ok(log.slice(0,firstWrite).filter(l=>l.startsWith('read')).length>=4&&!log.slice(firstWrite).some(l=>l.startsWith('read')),'every layout read comes before the first write');
 assert.deepEqual(run({top:200,bottom:700}),['read bar','read bar','read rail','read rail'],'out-of-range edges are left alone');
 assert.deepEqual(run({scrollY:40}),[],'a scrolled page is not measured');
 assert.deepEqual(run({shown:false}),['read bar','read rail'],'a hidden bar is not measured');
});

// The dashboard now writes only attributes that changed, so its old same-value writes no longer re-sync the bar
// after every render. The bar must still follow a new font, surface, scene or kit, and a host shown late or a box replaced.
test('on the dashboard the bar follows the workspace’s font, surface, scene and kit, and measures again when its boxes show or change',()=>{
 const src=read('canvas-nav.js'),from=src.indexOf('function followWorkspace(){'),to=src.indexOf('\n  }\n',from)+4;
 assert.ok(from>0&&to>from,'followWorkspace is found');
 const timers=[],intervals=[],observers=[],sizes=[],events={},writes=[],applied=[];let font='Segoe UI',shown=false;
 const box=(rect)=>({getClientRects:()=>shown?[rect]:[],getBoundingClientRect:()=>rect});
 const parts={'.rd-toolbar':box({top:62,bottom:102}),'.rd-course-rail':box({top:120,bottom:786})};
 const rd={dataset:{},querySelector:q=>parts[q]||null};
 const root={scrollY:0,innerHeight:800,setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){},setTimeout:fn=>{timers.push(fn);return timers.length;},
  ResizeObserver:class{constructor(fn){this.fn=fn;this.els=[];sizes.push(this);}observe(el){this.els.push(el);}disconnect(){this.els=[];this.off=true;}}};
 class MO{constructor(fn){this.fn=fn;observers.push(this);}observe(el,options){this.el=el;this.options=options;}disconnect(){}}
 const make=new Function('root','workspace','MutationObserver','listen','readPalette','applyPalette','store','saved','PALETTE','html',
  'let stopped=false,lastPalette="",workspaceTimer,workspaceObserver,workspaceSizes=null,workspaceQueued=0;'+src.slice(from,to)+'return followWorkspace;');
 make(root,()=>rd,MO,(target,type,fn)=>{events[type]=fn;},()=>({font}),p=>applied.push(p.font),{set:()=>Promise.resolve()},{},'p',{style:{setProperty:(k,v)=>writes.push(k+' '+v)}})();
 const flush=()=>{while(timers.length)timers.shift()();};
 intervals[0]();assert.deepEqual(applied,['Segoe UI']);assert.deepEqual(writes,[],'a hidden host has nothing to measure yet');
 const filter=observers[0].options.attributeFilter;
 for(const name of ['data-font','data-surface-style','data-scene-theme','data-theme-kit','data-page-tint','data-theme'])assert.ok(filter.includes(name),name+' is followed');
 const watcher=sizes.at(-1);assert.deepEqual(watcher.els,[parts['.rd-toolbar'],parts['.rd-course-rail']],'both measured boxes are watched for size');
 shown=true;watcher.fn([]);flush();assert.deepEqual(writes,['--chn-top 62px','--chn-bottom 14px'],'shown later, the edges are measured then');
 font='Calibri';observers[0].fn([{attributeName:'data-font'}]);flush();assert.deepEqual(applied,['Segoe UI','Calibri'],'a new interface font reaches the bar');
 const rail=box({top:120,bottom:780});parts['.rd-course-rail']=rail;watcher.fn([]);flush();
 assert.ok(watcher.off&&sizes.at(-1).els.includes(rail),'a replaced rail is watched instead of the old one');assert.equal(writes.at(-1),'--chn-bottom 20px');
 root.scrollY=300;events.scroll();assert.equal(timers.length,0,'scrolling down does nothing');root.scrollY=0;events.scroll();assert.equal(timers.length,1,'back at the top it measures again');
});
