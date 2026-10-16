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
 assert.match(js,/reel=setTimeout\(roll,1000\/\(now\(\)-lastInput<6000\?24:12\)\)/,'24 a second while used, 12 after');
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
