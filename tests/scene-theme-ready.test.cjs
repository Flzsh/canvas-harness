// A scene theme's sky and pictures wait for the theme's own stylesheet (fixed in 3.9.2 and 4.0 Preview 5): picking "Under the
// sea" put the sky's full-width poster into the page before theme.css had loaded, so for a moment the picture filled the
// top of the page at full size and pushed Home down, then snapped into place.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..','extension',file),'utf8');
// the public tree spreads long lines (scripts/readable-lines.cjs): the code is read joined up
const js=read('scene-themes.js').replace(/\n\s*/g,''),css=read('scene-themes.css');

test('until the theme sheet is in, its sky, star frames and pictures are kept out of the page',()=>{
  const rule=css.split('\n').find(line=>line.includes(':not([data-theme-kit-ready])'));
  assert.ok(rule,'scene-themes.css holds them back');
  for(const part of ['.tk-sky','.tk-starframes','.tk-icon'])assert.ok(rule.includes(part),part);
  assert.match(rule,/display:none!important/);
});

test('the theme marks itself ready when its sheet loads, keeps the mark, and drops it when it goes',()=>{
  assert.match(js,/link\.addEventListener\('load',\(\)=>\{sheetReady=true;if\(!dead\)rd\.setAttribute\('data-theme-kit-ready',''\);\}\)/);
  assert.match(js,/if\(sheetReady&&!rd\.hasAttribute\('data-theme-kit-ready'\)\)rd\.setAttribute\('data-theme-kit-ready',''\);/);
  assert.match(js,/rd\.removeAttribute\('data-theme-kit-ready'\);link\.remove\(\);/);
  assert.ok(js.indexOf("link.addEventListener('load'")<js.indexOf('function sync('),'the listener is there before the sheet is added');
});
