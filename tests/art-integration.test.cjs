// SPDX-License-Identifier: GPL-3.0-only
// Original creator: Flzsh.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..'),extension=path.join(root,'extension');
const read=name=>fs.readFileSync(path.join(extension,name),'utf8');
const manifest=()=>JSON.parse(read('manifest.json'));
const artFiles=new Set(['site.js','core.js','custom-art.js','subject-art-data.js','subject-art.js','generic-art.js','course-art.js']);
const decode=value=>value.replace(/&(?:amp|lt|gt|quot|apos);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[entity]));
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,key,value])=>[key,decode(value)]));
const displayedLabel=svg=>[...svg.matchAll(/<g class="rd-generic-line"[^>]*>/g)].map(([tag])=>{const a=attributes(tag);return (a['data-join']||'')+a['data-label'];}).join('');
const sample=name=>({id:'sample-course',name,shortName:name,originalName:name,color:'#456789'});
const overview=()=>({id:'folio-home',name:'All courses',color:'#456789'});
const chemistry=()=>sample('Chemistry');
// Artificial courses and supplied SVGs only. No account, school, or private art fixtures.
function load(files,env=vm.createContext({TextEncoder,URL})){
 for(const file of files)vm.runInContext(read(file),env,{filename:path.join(extension,file)});
 return env;
}
function runtime(){
 const scripts=manifest().content_scripts.find(entry=>entry.js?.includes('course-art.js'))?.js;
 assert.ok(scripts,'the runtime manifest loads course-art.js');
 return load(scripts.filter(file=>artFiles.has(file)));
}
function genericTitle(art,course,label,place='heading'){
 const piece=art.titled(course);assert.ok(piece,'an id-bearing course has illustrated title information');
 assert.equal(piece.generic,true,label);assert.equal(piece.name,label);assert.notEqual(piece.custom,true);
 assert.ok(piece.width>=360&&piece.width<=720);
 const svg=art.title(course,{place}),a=attributes(svg.match(/^<svg\b[^>]*>/)?.[0]||'');
 assert.equal(a.class,'rd-art rd-generic-title');assert.equal(a['data-crop'],'title');assert.equal(a['aria-hidden'],'true');assert.equal(a.focusable,'false');
 assert.equal(a.viewBox,'0 0 '+piece.width+' 240');assert.equal(displayedLabel(svg),label);
 assert.equal(decode(svg.match(/<title>([\s\S]*?)<\/title>/)?.[1]||''),label);
 assert.ok(art.titleFrame(course,{place}).includes(svg));
 assert.equal(art.titleStyle(course),'--rd-name-w:'+piece.width+';--rd-room-w:'+art.width(piece.kind));
 return svg;
}
function supplied(custom){
 return {
  title:custom.importSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240"><text x="20" y="160" font-size="44" fill="#355768">Uploaded title</text><path d="M20 200H580" stroke="#355768"/></svg>','sample-title.svg'),
  banner:custom.importSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 240"><rect width="960" height="240" fill="#123456"/></svg>','sample-banner.svg'),
  border:custom.importSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><path d="M5 5H295V95H5Z" fill="none" stroke="#456789" stroke-width="2"/></svg>','sample-border.svg')
 };
}
function embeddedSVG(markup){
 const source=markup.match(/<img\b[^>]*\bsrc="(data:image\/svg\+xml[^"]*)"/)?.[1];
 assert.ok(source,'the actual supplied asset is rendered as an isolated SVG image');
 return decodeURIComponent(source.slice(source.indexOf(',')+1));
}
function inert(svg){
 assert.doesNotMatch(svg,/<(?:script|style|foreignObject|image|use|a)\b/i);
 for(const [tag] of svg.matchAll(/<[A-Za-z][^>]*>/g)){
  const a=attributes(tag);
  assert.ok(!Object.keys(a).some(key=>/^(?:on\w+|href|xlink:href)$/i.test(key)),'no executable or external attribute');
 }
}

test('runtime content scripts load generic art before course art and expose a working classic-script fallback',()=>{
 const entries=manifest().content_scripts.filter(entry=>entry.js?.includes('course-art.js'));assert.ok(entries.length);
 for(const entry of entries){
  assert.equal(entry.js.filter(file=>file==='generic-art.js').length,1);
  assert.ok(entry.js.indexOf('generic-art.js')<entry.js.indexOf('course-art.js'));
  const env=load(entry.js.filter(file=>artFiles.has(file)));
  assert.equal(typeof env.ReserveGenericArt?.title,'function');
  genericTitle(env.ReserveCourseArt,sample('Independent Research Seminar'),'Independent Research Seminar');
 }
});

test('each preview loading course art loads generic art first and can render the same fallback',async t=>{
 const directory=path.join(root,'preview');
 const previews=fs.readdirSync(directory).filter(file=>file.endsWith('.html')).map(file=>({
  file,scripts:[...fs.readFileSync(path.join(directory,file),'utf8').matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(([,src])=>src)
 })).filter(preview=>preview.scripts.some(src=>path.basename(src)==='course-art.js'));
 assert.ok(previews.length,'at least one preview uses course art');
 for(const {file,scripts} of previews){
  await t.test(file,()=>{
  const names=scripts.map(src=>path.basename(src));
  assert.equal(names.filter(name=>name==='generic-art.js').length,1,file);
  assert.ok(names.indexOf('generic-art.js')<names.indexOf('course-art.js'),file);
  const env=load(names.filter(name=>artFiles.has(name)));
  genericTitle(env.ReserveCourseArt,overview(),'All courses');
  genericTitle(env.ReserveCourseArt,sample('Independent Research Seminar'),'Independent Research Seminar');
  });
 }
});

test('All courses and courses without a theme of their own get their complete displayed names as generic artwork',()=>{
 const art=runtime().ReserveCourseArt;
 for(const [course,label] of [
  [overview(),'All courses'],
  [{...overview(),name:'Legacy overview name'},'All courses'],
  [sample('Independent Research Seminar'),'Independent Research Seminar'],
  [{...sample('Studio Section A'),shortName:'My Studio'},'My Studio'],
  [{id:'sample-unnamed'},'Course']
 ])genericTitle(art,course,label);
});

test('a course with a subject theme always wears its subject’s drawn title, never the generic board or plain lettering',()=>{
 const art=runtime().ReserveCourseArt,original=chemistry();
 for(const course of [sample('Organic Chemistry Seminar'),sample('CL Chemistry-Rivera'),{...sample('My Lab'),originalName:'Chemistry'},{...original,originalName:'Chemistry Seminar'}]){
  const piece=art.titled(course);assert.equal(piece.kind,'chemistry');assert.equal(piece.name,art.titled(original).name);assert.notEqual(piece.generic,true);
  assert.match(art.title(course),/^<svg class="rd-art" data-art="chemistry" data-crop="title"/);assert.doesNotMatch(art.titleFrame(course),/rd-generic-title/);
 }
});

test('null and missing or empty IDs still produce no title information, markup, frame, or style',()=>{
 const env=runtime(),art=env.ReserveCourseArt,asset=supplied(env.ReserveCustomArt).title;
 for(const course of [null,undefined,{}, {name:'Chemistry'}, {id:'',name:'Chemistry'}, {id:null,name:'Chemistry',artPrefs:{titleArt:asset}}]){
  assert.equal(art.titled(course),null);assert.equal(art.title(course),'');assert.equal(art.titleFrame(course),'');assert.equal(art.titleStyle(course),'');
 }
});

test('a subject course keeps its built-in title, scene, icon, and border when renamed',()=>{
 const art=runtime().ReserveCourseArt,course=chemistry(),piece=art.titled(course),svg=art.title(course);
 assert.equal(piece.kind,'chemistry');assert.equal(piece.name,'Chemistry');assert.notEqual(piece.generic,true);assert.notEqual(piece.custom,true);
 assert.match(svg,/^<svg class="rd-art" data-art="chemistry" data-crop="title"/);assert.doesNotMatch(svg,/rd-generic-title/);
 const renamed={...course,name:'My Lab',shortName:'My Lab'};
 assert.equal(art.title(renamed),svg,'a renamed course keeps its subject’s drawn title');
 for(const crop of ['heading','wide'])assert.equal(art.scene(renamed,{crop}),art.scene(course,{crop}),'renaming keeps the original subject scene');
 assert.equal(art.mini(renamed),art.mini(course),'renaming keeps the original subject icon');
 assert.equal(art.frame(art.kind(renamed),renamed.id,renamed),art.frame(piece.kind,course.id,course),'renaming keeps the subject border');
 assert.equal(art.title(course),svg,'the original matching artwork is stable');
});

test('a real supplied custom title outranks built-in and generic lettering even with a banner and border upload',()=>{
 const env=runtime(),art=env.ReserveCourseArt,custom=env.ReserveCustomArt,assets=supplied(custom);
 for(const base of [chemistry(),sample('Independent Research Seminar'),{...sample('My Lab'),originalName:'Chemistry'},overview()]){
  const course={...base,artMotion:false,artPrefs:{titleArt:assets.title,bannerArt:assets.banner,borderArt:assets.border}},piece=art.titled(course),svg=art.title(course);
  assert.equal(piece.custom,true);assert.notEqual(piece.generic,true);assert.equal(piece.width,600);
  assert.match(svg,/ch-custom-title/);assert.doesNotMatch(svg,/rd-generic-title|data-art="chemistry"/);
  assert.equal(embeddedSVG(svg),embeddedSVG(custom.render(assets.title,{kind:'title',motion:false,fit:'contain',position:'left'})));
  assert.match(embeddedSVG(svg),/>Uploaded title<\/text>/);assert.doesNotMatch(embeddedSVG(svg),/#123456|#456789/);
  assert.ok(art.titleFrame(course).includes(svg));assert.match(art.titleStyle(course),/^--rd-name-w:600;/);
 }
});

test('a banner upload alone retains the original subject title or the generic actual-label title',()=>{
 const env=runtime(),art=env.ReserveCourseArt,banner=supplied(env.ReserveCustomArt).banner,original=chemistry();
 const decorated={...original,artPrefs:{bannerArt:banner}};
 assert.equal(art.title(decorated),art.title(original),'the exact built-in title is unchanged by a banner');
 assert.notEqual(art.titled(decorated).generic,true);assert.match(art.scene(decorated),/ch-custom-banner/);
 for(const base of [sample('Independent Research Seminar'),{...sample('My Lab'),originalName:'Chemistry'},overview()]){
  const course={...base,artPrefs:{bannerArt:banner}};
  genericTitle(art,course,base.name);assert.match(art.scene(course),/ch-custom-banner/);
 }
});

test('a real supplied custom border outranks both subject borders and generic or overview frames',()=>{
 const env=runtime(),art=env.ReserveCourseArt,custom=env.ReserveCustomArt,border=supplied(custom).border;
 for(const base of [chemistry(),sample('Independent Research Seminar'),overview()]){
  const course={...base,artPrefs:{borderArt:border},artMotion:false},frame=art.frame(art.kind(course),course.id,course);
  assert.match(frame,/^<span class="rd-frame ch-custom-frame" aria-hidden="true">/);assert.match(frame,/ch-custom-border/);
  assert.equal(embeddedSVG(frame),embeddedSVG(custom.render(border,{kind:'border',motion:false,fit:'fill'})));
  assert.match(embeddedSVG(frame),/stroke="#456789"/);assert.doesNotMatch(frame,/rd-frame-orn|rd-frame-extra|data-kind="generic"/);
 }
});

test('an unmatched course gets one light outline while All courses retains its stacked frame',()=>{
 const art=runtime().ReserveCourseArt,course=sample('Independent Research Seminar'),frame=art.frame(art.kind(course),course.id,course);
 assert.match(frame,/^<span class="rd-frame" data-kind="generic" aria-hidden="true">/);
 assert.equal((frame.match(/<svg\b/g)||[]).length,1);assert.equal((frame.match(/class="rd-frame-edge"/g)||[]).length,1);
 assert.doesNotMatch(frame,/rd-frame-wash|rd-frame-orn|rd-frame-extra|data-accent/);inert(frame);
 const all=overview(),stack=art.frame(art.kind(all),all.id,all);
 assert.match(stack,/data-kind="home"/);assert.match(stack,/rd-frame-extra/);assert.ok((stack.match(/<svg\b/g)||[]).length>1);
 assert.notEqual(stack,frame);
});

test('hostile names and Unicode reach generic lettering intact without injecting elements or attributes',()=>{
 const art=runtime().ReserveCourseArt;
 for(const label of ['Research <script>alert("sample")</script> & "quoted" course','Séminaire de recherche et société','跨学科研究与工程设计 🧪','Seminar 👩🏽‍🔬 and Studio','العلم والمجتمع']){
  const course={id:'"><script onload="sample">',name:label,shortName:label,originalName:'Independent Research Seminar'};
  const svg=genericTitle(art,course,label,'"><img onerror="sample">'),a=attributes(svg.match(/^<svg\b[^>]*>/)[0]);
  assert.match(a['data-rd-key'],/^art-[A-Za-z0-9_-]+-generic-title$/);assert.match(a['data-place'],/^[A-Za-z0-9_-]+$/);inert(svg);
  if(label.includes('<script>'))assert.match(svg,/&lt;script&gt;/);
  else assert.match(svg,/<text\b/,'Unicode remains visible through the native font fallback');
 }
});

test('generic lettering is stable across renders and motion off keeps the label without moving parts',()=>{
 const art=runtime().ReserveCourseArt,course=sample('Independent Research Seminar'),svg=genericTitle(art,course,course.name);
 assert.equal(art.title(course),svg);assert.match(svg,/class="art-loop"/);
 const still={...course,artMotion:false},rest=genericTitle(art,still,course.name);
 assert.match(rest,/data-cycle="0"/);assert.doesNotMatch(rest,/class="art-loop"|data-loop=/);
 assert.equal(art.title(still),rest);
});

function dashboard(env,{course=null,overviewArt={},greeting='off',timeZone='UTC',now=Date.parse('2026-10-11T12:00:00Z'),user=null}={}){
 load(['ui-utils.js','icons.js','workspace-arrange.js','customization-model.js','customize-ui.js','dashboard-view.js'],env);
 const courses=course?[course]:[],c={
  s:{timeZone,motion:'off',livingArt:'off',greeting,showGrades:false,showBookmarks:false,overviewArt},
  state:{courseId:course?course.id:'all',mode:'actionable',query:'',day:null},
  courses,allCourses:courses,courseMap:new Map(courses.map(x=>[x.id,x])),items:[],filtered:{items:[],olderCount:0},
  local:{},insights:{ready:[],recentGrades:[]},resourcePins:[],courseLoad:new Map(),glance:{},modeCounts:{},visibleLimit:20,
  now,user,status:'Sample data',workspace:'work'
 };
 const h={
  E:env.ReserveUI.escapeHTML,icon:env.ReserveIcon,dayKey:env.ReserveCore.dayKey,complete:env.ReserveCore.isComplete,
  formatDate:(value,timeZone,options)=>new Intl.DateTimeFormat('en-US',{timeZone,...options}).format(new Date(value)),
  assignmentLink:()=>'/courses/sample-course/assignments',dueText:()=>'',scoreText:()=>'',gradePeriodLabel:()=>''
 };
 const html=env.ReserveDashboardView.render(c,h),start=html.indexOf('<div class="rd-course-heading"'),end=html.indexOf('<label class="rd-search rd-work-search"',start);
 assert.ok(start>=0&&end>start,'the real dashboard renderer produced its heading before the search field');
 return {html,heading:html.slice(start,end)};
}

test('All courses keeps its original text heading and stacked rail frame when greetings are off',()=>{
 const env=runtime(),{html,heading}=dashboard(env);
 assert.match(heading,/^<div class="rd-course-heading">/);assert.match(heading,/<h1>Your work<\/h1>/);
 assert.doesNotMatch(heading,/data-titled|rd-title-art|rd-generic-title/);
 const rail=html.match(/<button\b[^>]*class="rd-rail-all"[^>]*>[\s\S]*?<\/button>/)?.[0]||'';
 assert.match(rail,/data-kind="home"/);assert.match(rail,/rd-frame-extra/);assert.doesNotMatch(rail,/data-kind="generic"/);
});

test('All courses shows a personal greeting for the student time zone instead of an illustrated All courses label',()=>{
 const cases=[['2026-10-11T11:00:00Z','Good morning'],['2026-10-11T17:00:00Z','Good afternoon'],
  ['2026-10-11T23:00:00Z','Good evening'],['2026-10-12T03:00:00Z','Working late']];
 for(const [at,words] of cases){
  const {heading}=dashboard(runtime(),{greeting:'on',timeZone:'America/New_York',now:Date.parse(at),user:{short_name:'Learner Example'}});
  assert.ok(heading.includes('<h1>'+words+', Learner<span class="rd-sr-only">'),at);
  assert.doesNotMatch(heading,/data-titled|rd-title-art|rd-generic-title/);
  assert.match(heading,/rd-heading-art/,'the overview keeps its scene');
 }
});

test('an explicitly uploaded overview title takes priority while a banner alone keeps the original text heading',()=>{
 const env=runtime(),assets=supplied(env.ReserveCustomArt);
 const uploaded=dashboard(env,{overviewArt:{titleArt:assets.title,bannerArt:assets.banner}}).heading;
 assert.match(uploaded,/data-titled="true"/);assert.match(uploaded,/--rd-name-w:600/);assert.match(uploaded,/ch-custom-title/);assert.match(uploaded,/ch-custom-banner/);
 assert.match(embeddedSVG(uploaded.match(/<span class="rd-title-art"[\s\S]*/)[0]),/>Uploaded title<\/text>/);
 assert.doesNotMatch(uploaded,/rd-generic-title/);assert.match(uploaded,/<h1>Your work<\/h1>/);
 const bannerOnly=dashboard(env,{overviewArt:{bannerArt:assets.banner}}).heading;
 assert.match(bannerOnly,/ch-custom-banner/);assert.match(bannerOnly,/<h1>Your work<\/h1>/);assert.doesNotMatch(bannerOnly,/data-titled|rd-title-art|rd-generic-title/);
});

test('rendered course headers use the displayed short name for generic art and retain the accessible heading',()=>{
 const env=runtime();
 for(const course of [sample('Independent Research Seminar'),{...sample('Studio Section A'),shortName:'My Studio'}]){
  const {heading}=dashboard(env,{course});
  assert.match(heading,/data-titled="true"/);assert.equal(displayedLabel(heading),course.shortName);
  assert.ok(heading.includes('>'+env.ReserveUI.escapeHTML(course.shortName)+'</h1>'));
  assert.ok(heading.includes(env.ReserveCourseArt.titleFrame(course,{place:'heading'})));
 }
});

test('a themed course header shows its subject’s drawn title and keeps the accessible heading',()=>{
 const env=runtime(),course={...sample('My Lab'),originalName:'Chemistry'},{heading}=dashboard(env,{course});
 assert.match(heading,/data-titled="true"/);assert.match(heading,/data-art="chemistry" data-crop="title"/);assert.doesNotMatch(heading,/rd-generic-title/);assert.ok(heading.includes('>'+env.ReserveUI.escapeHTML(course.shortName)+'</h1>'));
});
