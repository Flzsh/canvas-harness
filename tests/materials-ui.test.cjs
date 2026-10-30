const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(overrides={},onCapture=()=>{},extra={}){
 let data={resourcePins:[],settings:{},tasks:{}},calls=0,changed=0,auth=0,sanitized=[];
 const raw={origin:'https://school.instructure.com',accountId:'5',courseId:'7',modules:[{id:'10',name:'Unit 1 · gases',items:[{id:'11',type:'File',content_id:'21',title:'Gas worksheet.pdf',html_url:'/courses/7/files/21'},{id:'12',type:'File',content_id:'22',title:'Other practice.pdf',html_url:'/courses/7/files/22'},{id:'13',type:'Page',page_url:'lesson',title:'Lesson notes',html_url:'/courses/7/pages/lesson'}]}],pages:[],files:[],fetchedAt:new Date().toISOString(),errors:[]};
 const store={owner:{origin:raw.origin,accountId:'5'},get:()=>structuredClone(data),update:async fn=>{if(store.fail)throw Error('Storage full');fn(data);},readResourceCache:async()=>store.cached||null,writeResourceCache:async value=>{store.cached=value;}};
 const client={loadCourseResources:async()=>{calls++;return structuredClone(raw);},readCoursePage:async()=>'<p>Teacher instructions from the API body.</p>',...overrides};
 const context={ReserveSite:{...require('../extension/site.js'),origin:()=> 'https://school.instructure.com'},URL,Date,Map,Set,AbortController,ReserveMaterials:require('../extension/material-model.js'),ReserveUI:{escapeHTML:require('../extension/ui-utils.js').escapeHTML,safeRichHTML:html=>{sanitized.push(html);return 'SANITIZED '+html;}},document:{createElement:()=>({content:{querySelectorAll:()=>[]}})},...extra};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/materials-ui.js'),'utf8'),context);
 const ui=context.ReserveMaterialsUI.create({store,onCapture,user:{id:'5'},client,onChange:()=>changed++,onAuthError:()=>auth++});
 return {ui,store,raw,client,get calls(){return calls;},get changed(){return changed;},get auth(){return auth;},sanitized};
}
test('materials do not load during construction or assignment rendering, then reuse one course catalog',async()=>{
 const f=setup();f.ui.renderRelated({id:'2',courseId:'7',name:'Gas work'});assert.equal(f.calls,0);
 await f.ui.load('7');await f.ui.load('7');assert.equal(f.calls,1);assert.equal(f.ui.getItems('7').length,3);f.ui.destroy();
});
test('material search prioritizes filename matches over a broad matching module name',async()=>{
 const f=setup();await f.ui.load('7');f.ui.input('material-query','gas');const html=f.ui.renderLibrary({id:'7',name:'Chemistry'});
 assert.match(html,/Gas worksheet/);assert.doesNotMatch(html,/Other practice|Lesson notes/);f.ui.destroy();
});
test('page reader accepts the string body returned by the real API contract and sanitizes it',async()=>{
 const f=setup();await f.ui.load('7');f.ui.handle('material-read',{resource:'module:10:13',course:'7'});await new Promise(setImmediate);
 assert.equal(f.sanitized[0],'<p>Teacher instructions from the API body.</p>');assert.match(f.ui.renderLibrary({id:'7',name:'Chemistry'}),/SANITIZED.*Teacher instructions/);f.ui.destroy();
});
test('saved materials stay accessible beside assignments and failed custom saves keep the entered text',async()=>{
 const f=setup();await f.ui.load('7');f.ui.handle('material-pin',{resource:'module:10:11',course:'7'});await new Promise(setImmediate);
 assert.equal(f.store.get().resourcePins[0].url,'https://school.instructure.com/courses/7/modules/items/11');assert.match(f.ui.renderRelated({courseId:'7',name:'Gas work'}),/Gas worksheet/);
 f.store.fail=true;f.ui.input('material-title','My draft');f.ui.input('material-url','https://docs.google.com/document/d/example/edit');f.ui.handle('material-add',{course:'7'});await new Promise(setImmediate);
 const html=f.ui.renderLibrary({id:'7',name:'Chemistry'});assert.match(html,/Storage full/);assert.match(html,/value="My draft"/);f.ui.destroy();
});
test('changed account rejects the material result and clears displayed course items',async()=>{
 const f=setup();await f.ui.load('7');f.client.loadCourseResources=async()=>({...f.raw,accountId:'different'});await f.ui.load('7',{force:true});
 assert.equal(f.auth,1);assert.equal(f.ui.getItems('7').length,0);f.ui.destroy();
});
test('fresh owned cache skips a download and partial cache is refreshed',async()=>{
 const f=setup();f.store.cached=f.raw;await f.ui.load('7');assert.equal(f.calls,0);f.ui.destroy();
 const g=setup();g.store.cached={...g.raw,errors:[{source:'files',message:'Offline'}]};await g.ui.load('7');assert.equal(g.calls,1);g.ui.destroy();
});
test('closing a materials workspace prevents late responses from publishing',async()=>{
 let resolve;const f=setup({loadCourseResources:()=>new Promise(r=>resolve=r)});const pending=f.ui.load('7');await new Promise(setImmediate);f.ui.destroy();const changes=f.changed;resolve(f.raw);await pending;assert.equal(f.changed,changes);assert.equal(f.ui.getItems('7').length,0);
});
test('old saved external module links use Canvas even before refreshed lock information arrives',async()=>{
 const f=setup();await f.store.update(d=>d.resourcePins.push({id:'module:10:99',courseId:'7',title:'Private reference',url:'https://docs.google.com/document/d/private/edit'}));
 const html=f.ui.renderRelated({courseId:'7',name:'Work'});assert.match(html,/https:\/\/school.instructure.com\/courses\/7\/modules\/items\/99/);assert.doesNotMatch(html,/docs.google.com/);f.ui.destroy();
});
test('partial material loads are disclosed beside assignment suggestions',async()=>{
 const f=setup();f.raw.errors=[{source:'files',message:'Offline'}];await f.ui.load('7');assert.match(f.ui.renderRelated({courseId:'7',name:'Gas work'}),/Some course materials could not load/);f.ui.destroy();
});
test('reading and closing a course page request focus on the title and its originating resource',async()=>{
 const f=setup();await f.ui.load('7');f.ui.handle('material-read',{resource:'module:10:13',course:'7'});assert.equal(f.ui.takeFocusRequest().type,'title');assert.equal(f.ui.takeFocusRequest(),null);
 await new Promise(setImmediate);f.ui.handle('material-close',{});assert.deepEqual(JSON.parse(JSON.stringify(f.ui.takeFocusRequest())),{type:'resource',courseId:'7',id:'module:10:13'});f.ui.destroy();
});
test('refreshing materials discards an older page response and allows a fresh page read',async()=>{
 let resolve;const f=setup({readCoursePage:()=>new Promise(r=>resolve=r)});await f.ui.load('7');f.ui.handle('material-read',{resource:'module:10:13',course:'7'});
 await f.ui.load('7',{force:true});resolve('<p>Outdated instructions</p>');await new Promise(setImmediate);assert.doesNotMatch(f.ui.renderLibrary({id:'7',name:'Chemistry'}),/Outdated instructions/);
 f.client.readCoursePage=async()=>'<p>Updated instructions</p>';f.ui.handle('material-read',{resource:'module:10:13',course:'7'});await new Promise(setImmediate);assert.match(f.ui.renderLibrary({id:'7',name:'Chemistry'}),/Updated instructions/);f.ui.destroy();
});

test('planning from a material keeps the canonical module path and avoids hidden locked content',async()=>{
 const drafts=[],f=setup({},draft=>drafts.push(draft));await f.ui.load('7');f.ui.handle('material-capture',{resource:'module:10:11',course:'7'});
 assert.equal(drafts[0].name,'Gas worksheet','the plan item reads the clean title');assert.equal(drafts[0].source.title,'Gas worksheet.pdf','its source keeps the file name');assert.equal(drafts[0].courseId,'7');assert.equal(drafts[0].source.url,'https://school.instructure.com/courses/7/modules/items/11');assert.equal(drafts[0].dueAt,undefined);
 f.ui.handle('material-capture',{resource:'nonexistent',course:'7'});assert.equal(drafts.length,1);f.ui.destroy();
});

function multiCourse(){const f=setup();f.store.readResourceCache=async()=>null;f.client.loadCourseResources=async id=>({...structuredClone(f.raw),courseId:String(id)});return f;}
const settle=()=>new Promise(setImmediate);
test('course material searches, filters and shortcut drafts remain attached to their course',async()=>{
 const f=multiCourse();await f.ui.load('7');await f.ui.load('8');
 f.ui.renderLibrary({id:'7',name:'Chemistry'});f.ui.input('material-query','gas');f.ui.input('material-category','Worksheet');f.ui.input('material-title','Chem lab');f.ui.input('material-url','https://example.com/chem');
 const other=f.ui.renderLibrary({id:'8',name:'Literature'});assert.doesNotMatch(other,/value="gas"|value="Chem lab"|value="https:\/\/example.com\/chem"/);assert.match(other,/value="all">All materials/);
 f.ui.input('material-query','lesson');f.ui.input('material-title','Reading log');f.ui.input('material-url','https://example.com/reading');
 const first=f.ui.renderLibrary({id:'7',name:'Chemistry'});assert.match(first,/value="gas"/);assert.match(first,/<option selected>Worksheet/);assert.match(first,/value="Chem lab"/);assert.doesNotMatch(first,/value="Reading log"/);
 f.ui.handle('material-add',{course:'7'});await settle();assert.equal(f.store.get().resourcePins[0].courseId,'7');assert.equal(f.store.get().resourcePins[0].title,'Chem lab');assert.match(f.ui.renderLibrary({id:'8',name:'Literature'}),/value="Reading log"/);f.ui.destroy();
});

test('open teacher pages and scroll positions return without another page request',async()=>{
 const f=multiCourse();let reads=0;f.client.readCoursePage=async id=>{reads++;return '<p>Instructions for '+id+'</p>';};await f.ui.load('7');await f.ui.load('8');
 f.ui.renderLibrary({id:'7',name:'Chemistry'});f.ui.handle('material-read',{course:'7',resource:'module:10:13'});await settle();f.ui.rememberPageScroll('7','module:10:13',412);
 f.ui.renderLibrary({id:'8',name:'Literature'});f.ui.handle('material-read',{course:'8',resource:'module:10:13'});await settle();f.ui.rememberPageScroll('8','module:10:13',81);
 const first=f.ui.renderLibrary({id:'7',name:'Chemistry'});assert.match(first,/Instructions for 7/);assert.doesNotMatch(first,/Instructions for 8/);assert.equal(f.ui.pageScroll('7','module:10:13'),412);assert.equal(f.ui.pageScroll('8','module:10:13'),81);assert.equal(reads,2);assert.equal(f.ui.takeFocusRequest(),null);f.ui.destroy();
});

test('an older successful shortcut save cannot clear newer text or another course draft',async()=>{
 const f=multiCourse();await f.ui.load('7');await f.ui.load('8');f.ui.renderLibrary({id:'7',name:'Chemistry'});f.ui.input('material-title','First draft');f.ui.input('material-url','https://example.com/first');
 const update=f.store.update;let resolve;f.store.update=async fn=>{await new Promise(r=>resolve=r);await update(fn);};f.ui.handle('material-add',{course:'7'});
 f.ui.input('material-title','Next draft');f.ui.input('material-url','https://example.com/next');f.ui.renderLibrary({id:'8',name:'Literature'});f.ui.input('material-title','Reading draft');resolve();await settle();
 assert.match(f.ui.renderLibrary({id:'8',name:'Literature'}),/value="Reading draft"/);assert.match(f.ui.renderLibrary({id:'7',name:'Chemistry'}),/value="Next draft"/);assert.equal(f.store.get().resourcePins[0].title,'First draft');f.ui.destroy();
});

test('a save error returns to its originating course and preserves the draft for retry',async()=>{
 const f=multiCourse();await f.ui.load('7');await f.ui.load('8');f.ui.renderLibrary({id:'7',name:'Chemistry'});f.ui.input('material-title','Lab notes');f.ui.input('material-url','https://example.com/lab');let reject;f.store.update=()=>new Promise((_,r)=>reject=r);f.ui.handle('material-add',{course:'7'});f.ui.renderLibrary({id:'8',name:'Literature'});reject(Error('Storage full'));await settle();
 assert.doesNotMatch(f.ui.renderLibrary({id:'8',name:'Literature'}),/Storage full|value="Lab notes"/);const html=f.ui.renderLibrary({id:'7',name:'Chemistry'});assert.match(html,/Storage full/);assert.match(html,/value="Lab notes"/);f.ui.destroy();
});

test('refresh invalidates the correct remembered reader while keeping shortcut drafts',async()=>{
 const f=multiCourse();await f.ui.load('7');await f.ui.load('8');f.ui.renderLibrary({id:'7',name:'Chemistry'});f.ui.input('material-title','Unfinished shortcut');f.ui.handle('material-read',{course:'7',resource:'module:10:13'});await settle();f.ui.rememberPageScroll('7','module:10:13',200);
 f.ui.renderLibrary({id:'8',name:'Literature'});f.ui.handle('material-read',{course:'8',resource:'module:10:13'});await settle();await f.ui.load('7',{force:true});assert.match(f.ui.renderLibrary({id:'8',name:'Literature'}),/Course page preview/);
 const html=f.ui.renderLibrary({id:'7',name:'Chemistry'});assert.doesNotMatch(html,/Course page preview/);assert.match(html,/value="Unfinished shortcut"/);assert.equal(f.ui.pageScroll('7','module:10:13'),0);f.ui.destroy();
});

test('account invalidation clears course drafts and rejects late page publications',async()=>{
 const f=multiCourse();await f.ui.load('7');await f.ui.load('8');f.ui.renderLibrary({id:'7',name:'Chemistry'});f.ui.input('material-title','Private draft');let resolve;f.client.readCoursePage=()=>new Promise(r=>resolve=r);f.ui.handle('material-read',{course:'7',resource:'module:10:13'});
 f.client.loadCourseResources=async()=>({...f.raw,accountId:'someone-else'});await f.ui.load('8',{force:true});const changes=f.changed;resolve('<p>Late private text</p>');await settle();const html=f.ui.renderLibrary({id:'7',name:'Chemistry'});assert.doesNotMatch(html,/Private draft|Late private text/);assert.equal(f.changed,changes);assert.equal(f.auth,1);f.ui.destroy();
});

test('destroyed or invalidated material views cannot expose pins or accept further saves',async()=>{
 const f=multiCourse();await f.ui.load('7');await f.store.update(d=>d.resourcePins.push({id:'private',courseId:'7',title:'Private link',url:'https://example.com/private'}));f.ui.destroy();
 assert.equal(f.ui.renderRelated({courseId:'7',name:'Work'}),'');assert.equal(f.ui.renderLibrary({id:'7',name:'Class'}),'');f.ui.input('material-title','New private note');f.ui.input('material-url','https://example.com/new');f.ui.handle('material-add',{course:'7'});await settle();assert.equal(f.store.get().resourcePins.length,1);
});

test('a pending shortcut save completing after destroy cannot recreate course state',async()=>{
 const f=multiCourse();await f.ui.load('7');f.ui.renderLibrary({id:'7',name:'Class'});f.ui.input('material-title','Saved before leaving');f.ui.input('material-url','https://example.com/saved');let resolve;f.store.update=()=>new Promise(r=>resolve=r);f.ui.handle('material-add',{course:'7'});f.ui.destroy();const changes=f.changed;resolve();await settle();assert.equal(f.changed,changes);assert.equal(f.ui.renderLibrary({id:'7',name:'Class'}),'');
});

test('refreshing a removed material category falls back to all instead of an invisible stale filter',async()=>{
 const f=multiCourse();await f.ui.load('7');f.ui.renderLibrary({id:'7',name:'Class'});f.ui.input('material-category','Worksheet');
 f.raw.modules[0].items=f.raw.modules[0].items.filter(item=>item.type==='Page');await f.ui.load('7',{force:true});const html=f.ui.renderLibrary({id:'7',name:'Class'});assert.match(html,/Lesson notes/);assert.doesNotMatch(html,/<option selected>Worksheet/);f.ui.destroy();
});
test('the materials banner uses the short course title with the teacher before its description',async()=>{
 const f=setup();await f.ui.load('7');
 const html=f.ui.renderLibrary({id:'7',name:'Honors Chemistry-Rivera-Patel',shortName:'Chemistry',teacher:'Rivera-Patel',sub:''});
 assert.match(html,/<h2 title="Honors Chemistry-Rivera-Patel">Chemistry<\/h2><p><strong class="rd-course-detail">Rivera-Patel<\/strong> · Worksheets, pages & schedules<\/p>/);
 assert.match(f.ui.renderLibrary({id:'7',name:'Chemistry'}),/<h2 title="Chemistry">Chemistry<\/h2><p>Worksheets, pages & schedules<\/p>/);
 f.ui.destroy();
});

test('Materials: a card-less banner, a composer-shaped search with the type as text and a tray for your own shortcut, and bare grouped rows whose title reads the page',async()=>{
 const f=setup();await f.ui.load('7');const html=f.ui.renderLibrary({id:'7',name:'Chemistry',color:'#a05252'});
 assert.match(html,/<header class="rd-materials-header rd-course-banner" style="--rd-course:#a05252;--rd-course-ink:#a05252"><div class="rd-banner-art" aria-hidden="true"><\/div>/);
 assert.match(html,/<div class="rd-material-search"><div class="rd-composer-field"><label class="rd-search">[\s\S]*?<input type="search" data-rd-field="material-query" placeholder="Find a worksheet, lesson or schedule"[^>]*><\/label><span class="rd-select-text"><select data-rd-field="material-category" aria-label="Material type">/);
 assert.match(html,/<div class="rd-composer-tray"><details class="rd-add-shortcut" data-rd-section="shortcut-7" ><summary>(?:<svg[\s\S]*?<\/svg>)?Add your own shortcut<\/summary>/,'the existing disclosure lives in the tray');
 assert.match(html,/<section class="rd-material-group rd-chapter" data-rd-key="chapter-7-module-10" aria-labelledby="rd-chapter-7-module-10"><h3 class="rd-chapter-head" id="rd-chapter-7-module-10" tabindex="-1" data-chapter="module-10" data-course="7"><span class="rd-chapter-name">Unit 1 · gases<\/span> <span class="rd-chapter-count">3 items<\/span><\/h3><ul class="rd-chapter-items" id="rd-chapter-7-module-10-items">/,'each module is a chapter: a serif head with its count, its items inside it');
 assert.match(html,/<li class="rd-teacher-row" data-rd-key="material-row-7-module:10:13" data-rd-row="module:10:13"><button type="button" class="rd-row-open" data-rd-action="material-read" data-resource="module:10:13" data-course="7" aria-label="Read Lesson notes" data-read-row="true">Lesson notes<\/button>/,'a readable page opens here from its title (a real control)');
 assert.match(html,/<a class="rd-text-button" href="https:\/\/school\.instructure\.com\/courses\/7\/pages\/lesson" target="_blank" rel="noopener noreferrer" aria-label="Open Lesson notes in Canvas">Canvas <span aria-hidden="true">↗<\/span><\/a>/,'the original stays one quiet link away');
  assert.match(html,/<a class="rd-row-open" href="https:\/\/school\.instructure\.com\/courses\/7\/files\/21" target="_blank" rel="noopener noreferrer" title="Gas worksheet\.pdf"(?: data-pdf-[\w-]+="[^"]*")*>Gas worksheet&nbsp;<span aria-hidden="true">↗<\/span><\/a><span class="rd-material-actions">[\s\S]*?<\/span><span class="rd-row-kind"><\/span><span class="rd-row-format"><span>PDF<\/span><\/span><\/li>/,'one line: the clean title (the file name in its tooltip), Plan · Save, then the format tag; never "File"');
 assert.doesNotMatch(html,/>File</,'no vague "File" tag when the format is known');
 assert.doesNotMatch(html,/rd-chapter-jump/,'two or fewer chapters need no chapter line');
 assert.match(html,/<p class="rd-material-footnote">3 resources · <span title="[^"]+">Saved just now<\/span>\./);
 assert.match(html,/data-rd-action="material-refresh" data-resource="" data-course="7" aria-label="Refresh materials"/);
 f.ui.destroy();
});

// The student's Engineering › Materials, reduced: chapters of a book instead of a flat list of bold heads.
function engineering(){
 const page=(id,title)=>({id,type:'Page',page_url:title.toLowerCase().replace(/\W+/g,'-'),title,html_url:'/courses/7/pages/'+id});
 const file=(id,title)=>({id,type:'File',content_id:'9'+id,title,html_url:'/courses/7/files/9'+id});
 const raw={origin:'https://school.instructure.com',accountId:'5',courseId:'7',modules:[
  {id:'1',name:'Magic 8-Ball',items:[page('11','Magic 8-Ball')]},
  {id:'2',name:'Final Project',items:[page('21','Final Project 2026')]},
  {id:'3',name:'Course Description and Syllabus',items:[file('31','Engineering Syllabus.pdf'),{id:'32',type:'ExternalUrl',title:'2026 Daily Syllabus',external_url:'https://docs.google.com/document/d/x/edit'}]}
 ],pages:[],files:Array.from({length:12},(_,i)=>({id:String(500+i),display_name:i===0?'Truss WS.pdf':i===1?'Truss WS-ANSWER KEY.pdf':`Handout ${i}.pdf`,url:'/files/'+(500+i)})),fetchedAt:new Date().toISOString(),errors:[]};
 return setup({loadCourseResources:async()=>structuredClone(raw)});
}
test('Materials chapters: Canvas-order numerals, a one-item chapter of its own name reads as one row, clear kinds and formats, and a paired answer key',async()=>{
 const f=engineering();await f.ui.load('7');const html=f.ui.renderLibrary({id:'7',name:'Engineering'});
 assert.match(html,/<div class="rd-material-list rd-chapters--numbered">/,'modules without numbers of their own are numbered in Canvas order');
 assert.match(html,/<span class="rd-chapter-no" aria-hidden="true">2<\/span><span class="rd-chapter-name">Final Project<\/span> <span class="rd-chapter-count">1 item<\/span>/);
 assert.match(html,/<section class="rd-material-group rd-chapter rd-chapter--single" data-rd-key="chapter-7-module-1" aria-labelledby="rd-chapter-7-module-1"><div class="rd-teacher-row rd-chapter-row" data-rd-key="material-row-7-module:1:11" data-rd-row="module:1:11"><h3 class="rd-chapter-head" id="rd-chapter-7-module-1" tabindex="-1" data-chapter="module-1" data-course="7"><span class="rd-chapter-no" aria-hidden="true">1<\/span><button type="button" class="rd-row-open" data-rd-action="material-read" data-resource="module:1:11" data-course="7" aria-label="Read Magic 8-Ball" data-read-row="true">Magic 8-Ball<\/button><\/h3><span class="rd-material-actions">/,'Magic 8-Ball › Magic 8-Ball is one chapter row whose head reads the page');
 assert.doesNotMatch(html,/rd-chapter-name">Magic 8-Ball/,'no duplicate line under it');
  assert.match(html,/title="Engineering Syllabus\.pdf"(?: data-pdf-[\w-]+="[^"]*")*>Engineering Syllabus&nbsp;<span aria-hidden="true">↗<\/span><\/a>[\s\S]*?<span class="rd-row-kind">Syllabus<\/span><span class="rd-row-format"><span>PDF<\/span><\/span>/);
 assert.match(html,/>2026 Daily Syllabus&nbsp;<span aria-hidden="true">↗<\/span><\/a>[\s\S]*?<span class="rd-row-kind">Schedule<\/span><span class="rd-row-format"><span>Doc<\/span><\/span>/,'a Google Doc link says Doc, not Link');
  assert.match(html,/title="Truss WS\.pdf"(?: data-pdf-[\w-]+="[^"]*")*>Truss WS&nbsp;<span aria-hidden="true">↗<\/span><\/a>[\s\S]*?<span class="rd-row-kind"><a class="rd-row-key" href="https:\/\/school\.instructure\.com\/files\/501" target="_blank" rel="noopener noreferrer" title="Truss WS-ANSWER KEY\.pdf"(?: data-pdf-[\w-]+="[^"]*")* aria-label="Answer key for Truss WS">Answer key <span aria-hidden="true">↗<\/span><\/a><\/span>/,'the matching key joins its worksheet as a secondary link');
 assert.doesNotMatch(html,/>Truss WS — Answer key</,'and is not a row of its own');
 assert.match(html,/<span class="rd-chapter-no" aria-hidden="true">3<\/span><span class="rd-chapter-name">Course Description and Syllabus<\/span>[\s\S]*?<span class="rd-chapter-name">Course resources<\/span> <span class="rd-chapter-count">12 items<\/span>/,'loose pages and files close the book, unnumbered');
 f.ui.destroy();
});
test('Materials chapters: a long chapter opens on its first five items, Show all moves focus to the first it revealed, the chapter line jumps, and search keeps the chapters of its matches',async()=>{
 const f=engineering();await f.ui.load('7');let html=f.ui.renderLibrary({id:'7',name:'Engineering'});
 assert.match(html,/<nav class="rd-chapter-jump" aria-label="Chapters"><span class="rd-chapter-jump-label" aria-hidden="true">Chapters<\/span><button type="button" class="rd-chapter-link" data-rd-action="material-jump" data-resource="module-1" data-course="7">Magic 8-Ball<\/button>/);
 assert.match(html,/data-resource="resources" data-course="7">Course resources <span class="rd-n">12<span class="rd-sr-only"> items<\/span><\/span><\/button><\/nav>/);
 const resources=()=>{const at=html.indexOf('data-rd-key="chapter-7-resources"');return html.slice(at,html.indexOf('</section>',at));};
 assert.equal((resources().match(/class="rd-teacher-row"/g)||[]).length,5,'folded to its first five rows');
 assert.match(resources(),/<button type="button" class="rd-chapter-more" data-rd-action="material-more" data-resource="resources" data-course="7" aria-expanded="false" aria-controls="rd-chapter-7-resources-items">Show all 12<\/button>/);
 f.ui.handle('material-more',{resource:'resources',course:'7'});assert.deepEqual({...f.ui.takeFocusRequest()},{type:'row',courseId:'7',id:'file:7:506'},'focus moves to the first revealed item');
 html=f.ui.renderLibrary({id:'7',name:'Engineering'});assert.equal((resources().match(/class="rd-teacher-row"/g)||[]).length,11,'every row (the key rides with its worksheet)');
 assert.match(resources(),/aria-expanded="true" aria-controls="rd-chapter-7-resources-items">Show fewer<\/button>/);
 f.ui.handle('material-more',{resource:'resources',course:'7'});assert.deepEqual({...f.ui.takeFocusRequest()},{type:'more',action:'material-more',courseId:'7',id:'resources'},'closing keeps focus on the control');
 f.ui.handle('material-jump',{resource:'module-3',course:'7'});assert.deepEqual({...f.ui.takeFocusRequest()},{type:'chapter',courseId:'7',id:'module-3'});
 f.ui.input('material-query','handout 7');html=f.ui.renderLibrary({id:'7',name:'Engineering'});
 assert.match(html,/<span class="rd-chapter-name">Course resources<\/span> <span class="rd-chapter-count">1 item<\/span>[\s\S]*?>Handout 7&nbsp;</);assert.doesNotMatch(html,/rd-chapter-more|Final Project|rd-chapter-jump/,'only the chapter with the match, its head kept');
 f.ui.input('material-query','answer key');html=f.ui.renderLibrary({id:'7',name:'Engineering'});
 assert.match(html,/>Truss WS — Answer key&nbsp;<span aria-hidden="true">↗<\/span><\/a>[\s\S]*?<span class="rd-row-kind">Answer key<\/span>/,'a key found alone is its own row');
 f.ui.input('material-query','Truss WS-ANSWER');assert.match(f.ui.renderLibrary({id:'7',name:'Engineering'}),/Truss WS — Answer key/,'search still finds the original file name');
 f.ui.destroy();
});

