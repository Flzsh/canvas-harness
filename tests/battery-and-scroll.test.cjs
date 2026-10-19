const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','extension',f),'utf8');

// The user (2026-10-15) runs a laptop on battery at school: smooth, and as little work as possible while nothing moves.
test('the film clock reads every loop state before it writes any frame (one restyle a tick, not one a loop)',()=>{
 const js=read('motion.js'),loop=js.slice(js.indexOf('function frameLoops('),js.indexOf('function freeLoops('));
 const filter=loop.indexOf("const live=[...loops].filter(([a])=>{if(a.playState!=='idle')"),write=loop.indexOf('frame(a,r,t);');
 assert.ok(filter>0&&write>filter,'states are read first');
 assert.ok(!/for\(const \[a,r\] of \[\.\.\.loops\]\)\{\s*if\(a\.playState/.test(loop),'no state read between frame writes');
});
test('the pony\u2019s endless loops run on a film clock and its walk at most 60 frames a second',()=>{
 const js=read('pets.js');
 assert.match(js,/const quiet=now\(\)-lastInput;if\(quiet>=120000\)return;\s*reel=setTimeout\(roll,1000\/\(quiet<6000\?24:quiet<25000\?12:6\)\)/,'24 a second while used, 12 after, 6 in the idle rest, held after two minutes');assert.match(js,/if\(!reel&&layer&&!doc\.hidden\)roll\(\);/,'the next input lets it go on');assert.match(read('pet.css'),/\.pet-layer\{position:fixed;inset:0;z-index:1500;pointer-events:none;overflow:visible;contain:strict\}/,'its paint is walled off from the page');
 assert.match(js,/iterations!==Infinity\)continue;/,'only endless loops are taken over');
 assert.match(js,/if\(last&&ts-last<15\)\{raf=win\.requestAnimationFrame\(frame\);return;\}/,'a 120-240 Hz screen does not redraw the page every refresh');
 assert.match(js,/clearTimeout\(reel\);reel=0;reels\.clear\(\);layer\.remove\(\)/,'the clock stops with the pony');
});
test('the page does not scroll on desktop: the workspace column is as tall as the rail and scrolls by itself',()=>{
 const css=read('refresh.css');
 assert.match(css,/\.rd:not\(\[data-course-navigation=topbar\]\) \.rd-shell > \.rd-workspace \{\s*height: calc\(100dvh - min\(var\(--rd-rail-top, 150px\), 45dvh\) - var\(--rd-status-h, 56px\)\);[^}]*overflow-y: auto; overscroll-behavior: contain;/);
 assert.match(css,/100dvh - min\(var\(--rd-rail-top, 150px\), 45dvh\) - var\(--rd-status-h, 18px\)\)\);/,'the rail ends where the column ends');
 assert.match(css,/\.rd \.rd-course-rail \{ overflow-x: hidden; overflow-y: auto;/,'the rail never scrolls sideways');
 assert.match(read('dashboard.js'),/const column=container\.querySelector\('\.rd-shell > \.rd-workspace'\);if\(column\?\.scrollTop\)column\.scrollTop=0;/,'a new tab starts at its top');
});
test('the rail\u2019s foot only counts hidden courses; the Canvas sync line is the refresh button\u2019s tooltip',()=>{
 const js=read('dashboard-view.js'),foot=js.slice(js.indexOf('function railFoot('),js.indexOf('\n',js.indexOf('function railFoot(')));
 assert.ok(!/Synced|sync-dot|rd-rail-sync/.test(foot),'no sync line in the foot');
 assert.match(foot,/return hiddenCount\?/,'no foot when nothing is hidden');
 assert.match(js,/title="\$\{E\(sync\.text\)\}"\$\{sync\.failed&&!c\.refreshing\?' data-tone="danger"':''\}/);
});
test('nothing in the workspace column is squeezed to fit its height (a course banner collapsed in 2.26.0)',()=>{
 assert.match(read('refresh.css'),/\.rd:not\(\[data-course-navigation=topbar\]\) \.rd-shell > \.rd-workspace > \* \{ flex-shrink: 0; \}/);
});
test('Canvas\u2019s own page does not scroll while the workspace column does (one scroll bar, not two)',()=>{
 assert.match(read('dashboard.js'),/classList\?\.toggle\?\.\('reserve-fit',fits\)/);
 assert.match(read('startup.css'),/html\.reserve-inline-active\.reserve-fit,html\.reserve-inline-active\.reserve-fit body\{overflow-y:hidden!important\}/);
});
test('courses across the top: the strip stands above the heading, so the heading cannot paint over the cards',()=>{
 assert.match(read('customize.css'),/\.rd\[data-course-navigation=topbar\]\[data-courses=true\] \.rd-course-rail \{ z-index: 1; \}/);
});

// The user (2026-10-15 screenshot): the pony stood on an assignment's title. It now only stands where nothing the student
// reads or uses is under it, steps off when the page changes under it, and walks far less.
test('the pony stands only on free spots, steps off when something appears under it, and is calmer',()=>{
 const js=read('pets.js');
 assert.match(js,/const USED='a,button,input,select,textarea,summary,label,\[role=button\],\[role=link\],\[role=tab\],svg,img,canvas,video';/);
 assert.match(js,/if\(layer\?\.contains\(el\)\|\|el\.closest\?\.\('\.rd-frame, \.chn-frames'\)\)continue;/,'outlines are its ground, not something it covers');
 assert.match(js,/if\(!free\(here,spot\.u\)\)\{moveOff\(here\);return;\}/);
 assert.match(js,/if\(idle<2500\)\{settle\(/,'still while the student scrolls or types');
 assert.match(js,/if\(roll<\.2\)walk\(\);/,'walks on a fifth of its choices (was two fifths)');
 assert.match(js,/const to=freeOn\(l\);if\(to==null\)\{settle\('stand',6000\);return;\}/);
});

test('the column is not scrolled by the browser while the workspace lays itself out (scroll anchoring off)',()=>{
 const css=read('refresh.css');
 assert.match(css,/\.rd \.rd-workspace, \.rd \.rd-workspace \* \{ overflow-anchor: none; \}/);
});
