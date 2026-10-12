// SPDX-License-Identifier: GPL-3.0-only
// Original creator: Flzsh.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const modulePath=path.join(__dirname,'../extension/generic-art.js');
const art=()=>require(modulePath);
const decode=value=>value.replace(/&(?:amp|lt|gt|quot|apos);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[entity]));
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,name,value])=>[name,decode(value)]));
const lineTags=svg=>[...svg.matchAll(/<g class="rd-generic-line"[^>]*>/g)].map(([tag])=>attrs(tag));
const displayLabel=svg=>lineTags(svg).map(line=>(line['data-join']||'')+line['data-label']).join('');
const safeSvg=svg=>{
 assert.doesNotMatch(svg,/<(?:script|style|animate|animateTransform|set|foreignObject|image|use)\b|\s(?:on\w+|href|xlink:href)\s*=|(?:url|eval)\s*\(/i);
 assert.doesNotMatch(svg,/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/);
};

test('exports the complete generic art API to CommonJS and an isolated browser global',()=>{
 assert.ok(fs.existsSync(modulePath),'the new generic artwork module exists');
 const api=art();
 assert.deepEqual(Object.keys(api).sort(),['frame','info','title']);
 assert.equal(globalThis.ReserveGenericArt,api);
 const browser={};
 vm.runInNewContext(fs.readFileSync(modulePath,'utf8'),browser,{filename:'generic-art.js'});
 assert.equal(typeof browser.ReserveGenericArt.title,'function');
 assert.equal(browser.ReserveGenericArt.title('All courses',{id:'all'}),api.title('All courses',{id:'all'}));
});

test('All courses and personal course names get distinct complete, drawn title SVGs',()=>{
 for(const label of ['All courses','College Counseling','My Lab 27','Making & Doing','AP Study / Lab 2']){
  const api=art(),info=api.info(label),svg=api.title(label,{id:'course-17',place:'heading'});
  assert.deepEqual(Object.keys(info).sort(),['cycle','width']);
  assert.ok(info.width>=360&&info.width<=720);
  assert.ok(info.cycle>0&&info.cycle<=12);
  const root=attrs(svg.match(/^<svg\b[^>]*>/)[0]);
  assert.equal(root.class,'rd-art rd-generic-title');
  assert.equal(root['data-crop'],'title');
  assert.equal(root['data-place'],'heading');
  assert.equal(root['data-rd-key'],'art-course-17-generic-title');
  assert.equal(root['data-cycle'],String(info.cycle));
  assert.equal(root.viewBox,'0 0 '+info.width+' 240');
  assert.equal(root.preserveAspectRatio,'xMinYMax meet');
  assert.equal(root['aria-hidden'],'true');
  assert.equal(root.focusable,'false');
  assert.ok(svg.endsWith('</svg>'));
  assert.equal(displayLabel(svg),label);
  assert.doesNotMatch(svg,/<text\b|<h[1-6]\b/);
  assert.ok((svg.match(/class="rd-generic-glyph"/g)||[]).length>=label.replace(/\s/g,'').length);
  assert.match(svg,/<g class="art-ground"[^>]*data-ground="214"/);
  for(const color of ['#3C3A32','#FAF9F5','#D97757','#B7BFA0','#D4A27F'])assert.ok(svg.includes(color),color);
  safeSvg(svg);
 }
 assert.notEqual(art().title('My Lab 27',{id:'one'}),art().title('All courses',{id:'one'}));
});

test('ordinary long multiword names use two or three readable lines with the full label',()=>{
 const labels=[
  'Advanced Interdisciplinary Studies in Environmental Design and Community Research',
  'American Literature and The Free Market Economy',
  'Social Enterprise, Creative Practice and Community Leadership',
  'College Counseling and Planning for the Class of 2027'
 ];
 for(const label of labels){
  const svg=art().title(label,{id:'long',motion:false}),lines=lineTags(svg);
  assert.ok(lines.length>=2&&lines.length<=3,label+': '+lines.length+' lines');
  assert.equal(displayLabel(svg),label);
  assert.ok(lines.every(line=>Number(line['data-font-size'])>=36),label);
  const width=art().info(label).width;
  for(const line of lines){
   assert.ok(Number(line['data-line-width'])<=width-80,label);
   const [,x,y]=line.transform.match(/^translate\(([\d.]+) ([\d.]+)\)/)||[];
   assert.ok(Number(x)>=39&&Number(y)>=25&&Number(y)<200,label);
  }
  assert.doesNotMatch(svg,/…|\.\.\./);
 }
});

test('unbroken long names remain complete, bounded and nonempty',()=>{
 const label='InterdisciplinaryEnvironmentalEngineeringResearchStudio2027';
 const svg=art().title(label,{motion:false});
 assert.equal(lineTags(svg).map(line=>line['data-label']).join(''),label);
 assert.ok(art().info(label).width<=720);
 assert.ok(lineTags(svg).every(line=>Number(line['data-font-size'])>=26));
 safeSvg(svg);
});

test('Unicode is visibly represented with escaped SVG text instead of discarded characters',()=>{
 for(const label of ['Français et société','跨学科研究与工程设计 🧪','Δημιουργική μάθηση — 2027','History 👩🏽‍🔬 and Science','العلم والمجتمع']){
  const svg=art().title(label,{id:'unicode',motion:false});
  assert.equal(displayLabel(svg),label);
  assert.match(svg,/<text\b[^>]*font-family=/);
  assert.ok(art().info(label).width>=360&&art().info(label).width<=720);
  safeSvg(svg);
 }
 const long='跨学科研究与工程设计、社会实践与文化交流 🧪 Français et société — Interdisciplinary studies';
 assert.equal(displayLabel(art().title(long)),long);
});

test('labels, IDs and places cannot inject markup or attributes',()=>{
 const label='Study <script>alert("x")</script> & "quoted" \'course\'';
 const svg=art().title(label,{id:'"><script id="evil">',place:'" onload="boom'});
 assert.equal(displayLabel(svg),label);
 assert.match(svg,/&lt;script&gt;/);
 assert.match(svg,/&amp;/);
 const root=attrs(svg.match(/^<svg\b[^>]*>/)[0]);
 assert.match(root['data-rd-key'],/^art-[A-Za-z0-9_-]+-generic-title$/);
 assert.match(root['data-place'],/^[A-Za-z0-9_-]+$/);
 assert.equal(root.onload,undefined);
 safeSvg(svg);
 for(const value of [null,undefined,'','   ']){
  assert.equal(displayLabel(art().title(value)),'All courses');
  assert.equal(art().info(value).width,art().info('All courses').width);
 }
 const invalid=art().title('Course \u0000\uD800\uFFFF',{motion:false});
 assert.match(invalid,/\uFFFD/);
 safeSvg(invalid);
});

test('motion uses the real keys rig parser, returns to rest, and moves only restrained decorative detail',()=>{
 const Motion=require('../extension/motion.js');
 const svg=art().title('All courses',{id:'all'}),cycle=art().info('All courses').cycle;
 const groups=[...svg.matchAll(/<g class="art-loop"[^>]*>/g)];
 assert.ok(groups.length>=1&&groups.length<=2);
 for(const [tag] of groups){
  const attributes=attrs(tag),node={getAttribute:name=>attributes[name]??null};
  const spec=Motion.loopSpec(node,cycle);
  assert.equal(spec.type,'keys');
  assert.equal(spec.period,cycle);
  assert.ok(spec.origin.every(Number.isFinite));
  const frames=Motion.loopFrames(spec);
  assert.ok(frames.length>=3);
  assert.equal(frames[0].offset,0);
  assert.equal(frames.at(-1).offset,1);
  assert.equal(frames[0].transform,frames.at(-1).transform);
  for(const frame of frames){
   assert.ok(!frame.transform.includes('NaN'));
   assert.ok(frame.offset>=0&&frame.offset<=1);
  }
  for(const key of spec.keys.split(';').filter(Boolean)){
   const numbers=key.split(':')[1].trim().split(/\s+/).slice(0,3).map(Number);
   assert.ok(numbers.every(value=>!Number.isFinite(value)||Math.abs(value)<=1.2));
  }
 }
 const still=art().title('All courses',{motion:false});
 assert.match(still,/data-cycle="0"/);
 assert.doesNotMatch(still,/art-loop|data-(?:loop|period|phase|origin|keys|rig)=/);
 assert.equal(displayLabel(still),'All courses');
 safeSvg(still);
});

test('generic course frames keep the standard ghost and frame controller structure with one visible outline',()=>{
 const svg=art().frame('course-17');
 assert.match(svg,/^<span class="rd-frame" data-kind="generic" aria-hidden="true"><span class="rd-frame-stretch"><svg class="rd-frame-svg rd-frame-main"/);
 const root=attrs(svg.match(/<svg\b[^>]*>/)[0]);
 assert.equal(root.viewBox,'0 0 300 100');
 assert.equal(root.preserveAspectRatio,'none');
 assert.equal(root['aria-hidden'],'true');
 assert.equal(root.focusable,'false');
 assert.equal((svg.match(/<svg\b/g)||[]).length,1);
 assert.equal((svg.match(/<span\b/g)||[]).length,2);
 assert.ok(svg.endsWith('</svg></span></span>'));
 const paths=[...svg.matchAll(/<path\b[^>]*>/g)].map(([tag])=>attrs(tag));
 assert.equal(paths.length,3);
 assert.deepEqual(paths.map(part=>part.class),['rd-frame-edge','rd-frame-retrace','rd-frame-ink']);
 assert.equal(paths[0].d,paths[2].d,'the hidden reveal pen retraces the primary outline');
 assert.ok(paths.every(part=>part['vector-effect']==='non-scaling-stroke'));
 assert.ok(paths[1].d.length<paths[0].d.length/2,'the secondary stroke is a short quiet retrace');
 assert.doesNotMatch(svg,/rd-frame-(?:extra|orn|wash)|art-loop|<g\b|<rect\b|<text\b|stack|pile|book|tab|stroke-width=|--f-/i);
 for(const value of paths[0].d.match(/-?\d+(?:\.\d+)?/g).map(Number))assert.ok(value>0&&value<300);
 safeSvg(svg);
 assert.equal(art().frame('course-17'),svg);
 assert.doesNotThrow(()=>art().frame(null));
 safeSvg(art().frame('"><script>'));
});

test('both repositories receive byte-identical standalone modules and focused tests with GPL notices',t=>{
 const here=path.resolve(__dirname,'..'),name=path.basename(here);
 const peer=path.join(path.dirname(here),name==='canvas-harness'?'canvas-reserve':'canvas-harness');
 if(!fs.existsSync(path.join(peer,'extension')))t.diagnostic(`Skipped the byte comparison: no sibling checkout at ${peer}`);
 else for(const relative of ['extension/generic-art.js','tests/generic-art.test.cjs']){
  assert.equal(fs.readFileSync(path.join(here,relative),'utf8'),fs.readFileSync(path.join(peer,relative),'utf8'),relative);
 }
 const source=fs.readFileSync(modulePath,'utf8');
 assert.match(source,/SPDX-License-Identifier: GPL-3\.0-only/);
 assert.match(source,/Original creator: Flzsh/);
 assert.doesNotMatch(source,/MIT License|require\(|fetch\(|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
});
