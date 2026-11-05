// Home beside the docked PDF reader: Home's width rules follow the room it has (content.js fitWidth), the reader no
// longer zooms Home (pdf-host.js), and the course dock stays inside that room without breaking a word (customize.css).
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..','extension',file),'utf8');
const content=read('content.js');
const fitMedia=(()=>{const a=content.indexOf('function fitMedia('),b=content.indexOf('globalThis.ReserveFitMedia');assert.ok(a>0&&b>a,'fitMedia is in content.js');return new Function(content.slice(a,b)+';return fitMedia;')();})();

test('a width rule is on or off for the room, other conditions are left to the browser',()=>{
  assert.equal(fitMedia('(max-width:900px)',476),'all');
  assert.equal(fitMedia('(max-width:900px)',1536),'not all');
  assert.equal(fitMedia('(min-width: 1401px)',1536),'all');
  assert.equal(fitMedia('(min-width: 1401px)',476),'not all');
  assert.equal(fitMedia('(min-width: 601px) and (max-width: 779.98px)',700),'all');
  assert.equal(fitMedia('(min-width: 601px) and (max-width: 779.98px)',476),'not all');
  assert.equal(fitMedia('(max-height: 559.98px) and (max-width: 859.98px)',476),'(max-height: 559.98px)');
  assert.equal(fitMedia('(max-height: 559.98px) and (max-width: 859.98px)',1536),'not all');
  assert.equal(fitMedia('(max-height: 820px), (max-width: 900px)',1536),'(max-height: 820px)');
  assert.equal(fitMedia('screen and (max-width:800px)',476),'screen');
});

test('the edges match the browser: max-width includes its value, min-width starts at its value',()=>{
  assert.equal(fitMedia('(max-width: 900px)',900),'all');
  assert.equal(fitMedia('(max-width: 900px)',901),'not all');
  assert.equal(fitMedia('(min-width: 901px)',901),'all');
  assert.equal(fitMedia('(min-width: 901px)',900),'not all');
});

test('without the reader the width is the window, and the rules are switched after the sheets load and on resize',()=>{
  // the public tree spreads long lines (scripts/readable-lines.cjs): this check reads content.js joined up
  const flat=content.replace(/\n\s*/g,'');
  assert.match(flat,/function pageWidth\(\)\{const panel=document\.getElementById\?\.\('reserve-pdf-host'\)/);
  assert.match(content,/function fitWidth\(fresh\)\{\s*try\{fitWidthNow\(fresh\);\}catch\{\}/);
  assert.match(content,/mark\('styles'\);fitWidth\(true\);reveal\(\);/);
  assert.match(content,/new ResizeObserver\(\(\)=>fitWidth\(\)\)/);
});

test('the reader zooms Canvas pages to fit, never Canvas Harness pages',()=>{
  const host=read('pdf-host.js');
  assert.match(host,/const ours=!!doc\.documentElement\?\.classList\?\.contains\('reserve-inline-active'\)/);
  assert.match(host,/fit=!ours&&room>0&&room<900\?/);
});

test('the course dock keeps to its room and never breaks a word in the middle',()=>{
  const css=read('customize.css');
  assert.match(css,/\.rd \.rd-dock\[data-look=cards\]\{[^}]*max-width:min\(calc\(100vw - 32px\),calc\(var\(--rd-dock-available,100vw\) - 16px\)\)/);
  assert.match(css,/\.rd \.rd-dock \{--rd-dock-space:var\(--rd-dock-available,100vw\);[^}]*left:var\(--rd-dock-center,50%\);width:var\(--rd-dock-available,100vw\)/);
  assert.match(css,/\.rd \.rd-dock-words b\{[^}]*overflow-wrap:normal;word-break:normal\}/);
  assert.doesNotMatch(css,/\.rd \.rd-dock-words b\{[^}]*overflow-wrap:anywhere/);
  assert.match(css,/\.rd \.rd-dock-card\{[^}]*min-width:136px/);
});
