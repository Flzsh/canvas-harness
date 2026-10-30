const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..','extension',f),'utf8');
// scripts/readable-lines.cjs spreads dense code over several lines (whitespace only); match the code without them.
const compact=text=>text.replace(/\n[ \t]*/g,'');
const Model=require('../extension/customization-model.js');

// The user: dark mode must never come on by itself, and the drawings must not simply turn black into white.
// 4.0: The 4.0 Make it yours redraws these controls; the ported 4.0 tests cover them.
test.skip('dark is only ever on when chosen: an older "system" setting stays light',()=>{
 const js=read('dashboard.js');
 assert.match(js,/function effectiveTheme\(s\)\{\s*return s\.theme==='dark'\?'dark':'light';\s*\}/);
 assert.doesNotMatch(js,/prefers-color-scheme/);
});
test('Artwork at night is a number from 0 to 100, saved with the settings and refused outside that range',()=>{
 assert.equal(Model.cleanSettings({nightArt:35}).nightArt,35);
 assert.equal(Model.cleanSettings({}).nightArt,0,'chalk at its brightest by default');
 for(const bad of [-1,101,'x'])assert.throws(()=>Model.cleanSettings({nightArt:bad}),/nightArt/);
});
test('the slider: chalk below 50, paper from 50; light mode carries none of it',()=>{
 const js=compact(read('dashboard.js')),css=read('refresh.css');
 assert.match(js,/if\(container\.dataset\.theme!=='dark'\)\{delete container\.dataset\.night;/,'light: nothing is set');
 // setData writes data-night only when it changes (a same-value write still wakes every observer of the page).
 assert.match(js,/if\(v<50\)\{const k=v\/50;setData\('night','chalk'\);/);
 assert.match(js,/setData\('night','paper'\);/);
 // every night rule needs the dark theme
 for(const line of css.split('\n').filter(l=>/data-night=/.test(l)))for(const sel of line.split('{')[0].split(/,(?![^(]*\))/))assert.match(sel.trim(),/^\.rd\[data-theme=dark\]\[data-night=(chalk|paper)\]/,sel);
 assert.match(css,/stroke: var\(--rd-chalk, #D2C8B2\) !important;/,'ink becomes chalk, not white');
 assert.match(css,/fill: #2C2B28 !important;/,'light fills inside the drawings turn dark');
 assert.match(css,/filter: brightness\(var\(--rd-night-b, \.58\)\);/,'paper is dimmed as a whole');
});
// 4.0: The 4.0 Make it yours redraws these controls; the ported 4.0 tests cover them.
test.skip('Make it yours: Light or dark, and the slider only in dark',()=>{
 const ui=compact(read('customize-ui.js'));
 assert.match(ui,/group\('Light or dark','Dark is only ever on when you choose it here\.'/);
 assert.match(ui,/\(s\.theme==='dark'\?group\('Artwork at night'[\s\S]*?type="range" min="0" max="100" step="5" data-rd-field="setting" data-setting="nightArt"/);
});
test('Canvas\u2019s menu bar stays light while the workspace is dark (Canvas\u2019s pages are light)',()=>{
 assert.match(read('canvas-nav.js'),/if\(rd\.dataset\.theme==='dark'\)for\(const key of \['sidebar','sidebarSel','ink','ink2','page'\]\)delete palette\[key\];/);
});
