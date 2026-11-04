// Two owner-reported bugs (2026-11-03): the page would not scroll with the wheel over Home's assignment card, and the
// Review card flip (with every animation eased by --rd-pen) never played because the name was reused for an image.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','extension');
const read=file=>fs.readFileSync(path.join(dir,file),'utf8');
const css=fs.readdirSync(dir).filter(f=>f.endsWith('.css'));

test('--rd-pen stays an easing: no stylesheet sets it to anything else, the pen line has its own name',()=>{
  for(const f of css){
    const s=read(f);
    for(const m of s.matchAll(/--rd-pen\s*:\s*([^;}]+)/g))assert.match(m[1].trim(),/^(cubic-bezier|linear|ease|steps)\b/,`${f}: --rd-pen is ${m[1].slice(0,40)}`);
    assert.doesNotMatch(s,/var\(--rd-pen\)/,`${f}: the pen line is var(--rd-pen-line)`);
  }
  const refresh=read('refresh.css');
  assert.equal((refresh.match(/--rd-pen-line: url\(/g)||[]).length,2,'light and dark pen lines');
  assert.match(read('review-deck.css'),/\.rv-cardwrap\[data-side=back\] \.rv-card-in\{animation:rv-flip \.38s var\(--rd-pen,/);
});

test('a reader or Materials page holds the wheel only while it has something to scroll',()=>{
  const refresh=read('refresh.css');
  assert.match(refresh,/\.rd \.rd-reader, \.rd \.rd-reader-content, \.rd \.rd-material-page \{ overscroll-behavior: auto; \}/);
  assert.match(refresh,/\.rd \.rd-workspace \.rd-reader-content\[data-scrolls=true\], \.rd \.rd-workspace \.rd-material-page\[data-scrolls=true\] \{ overscroll-behavior: contain; \}/);
  assert.doesNotMatch(refresh,/\.rd \.rd-workspace \.rd-reader(?![-\w])[^{]*\{ overscroll-behavior: contain; \}/,'the card itself never holds the wheel');
  // the public tree spreads long lines (scripts/readable-lines.cjs): these checks read dashboard.js joined up
  const js=read('dashboard.js').replace(/\n\s*/g,'');
  assert.match(js,/const markScroll=el=>\{const scrolls=el\.scrollHeight>el\.clientHeight\+1&&/);
  assert.match(js,/watchScrollBoxes\(\);remember\(\);/);
  assert.match(js,/readerLayout\?\.disconnect\(\);scrollBoxes\?\.disconnect\(\);/);
});

test('markScroll marks only a box that overflows and can scroll',()=>{
  const js=read('dashboard.js'),a=js.indexOf('const markScroll='),b=js.indexOf(';\n',a)>0?js.indexOf('const scrollBoxes=',a):-1;
  assert.ok(a>0&&b>a);
  const make=new Function('root',js.slice(a,b)+'return markScroll;');
  const box=(sh,ch,overflowY)=>({scrollHeight:sh,clientHeight:ch,dataset:{},style:{overflowY}});
  const mark=make({getComputedStyle:el=>({overflowY:el.style.overflowY})});
  const long=box(900,400,'auto'),short=box(300,300,'auto'),clipped=box(900,400,'visible');
  mark(long);mark(short);mark(clipped);
  assert.equal(long.dataset.scrolls,'true');assert.equal(short.dataset.scrolls,undefined);assert.equal(clipped.dataset.scrolls,undefined);
  short.dataset.scrolls='true';mark(short);assert.equal(short.dataset.scrolls,undefined,'a box that stops overflowing lets go');
});
