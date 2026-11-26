// pages-42: Materials as the course's shelf. Recent first (newest first, grouped by age), the shelves Recent · Modules ·
// Files · Pages · Links · Saved with their counts, every item named by a kraft tag, the course's own drawing at the head.
// Every behaviour of the old page is kept (tests/materials-ui.test.cjs); these cover what is new.
require('../extension/site.js');
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const M=require('../extension/material-model.js');
const day=864e5,ago=d=>new Date(Date.now()-d*day).toISOString();
function catalog(){return {origin:'https://school.instructure.com',accountId:'5',courseId:'7',modules:[{id:'10',name:'Unit 1',items:[
  {id:'11',type:'File',content_id:'21',title:'Gas worksheet.pdf',html_url:'/courses/7/files/21'},
  {id:'12',type:'Page',page_url:'lesson',title:'Lesson notes',html_url:'/courses/7/pages/lesson'},
  {id:'13',type:'ExternalUrl',title:'Class video',external_url:'https://www.youtube.com/watch?v=x'},
  {id:'14',type:'Quiz',content_id:'31',title:'Check-in quiz',html_url:'/courses/7/quizzes/31'},
  {id:'15',type:'File',content_id:'22',title:'Locked key.pdf',html_url:'/courses/7/files/22',content_details:{locked_for_user:true}},
  {id:'16',type:'Assignment',content_id:'41',title:'Homework 1',html_url:'/courses/7/assignments/41'}]}],
 pages:[{page_id:'61',url:'lesson',title:'Lesson notes',updated_at:ago(2)},{page_id:'62',url:'old-page',title:'Old page',updated_at:ago(45)}],
 files:[{id:'21',display_name:'Gas worksheet.pdf',updated_at:ago(1),url:'/files/21'},{id:'22',display_name:'Locked key.pdf',updated_at:ago(10),url:'/files/22'},{id:'23',display_name:'Slides week 3.pptx',updated_at:ago(20),url:'/files/23'}],
 fetchedAt:new Date().toISOString(),errors:[]};}
function setup(raw=catalog(),extra={}){
 let data={resourcePins:[],settings:{},tasks:{}};const drafts=[];
 const store={owner:{origin:raw.origin,accountId:'5'},get:()=>structuredClone(data),update:async fn=>{fn(data);},readResourceCache:async()=>null,writeResourceCache:async()=>{}};
 const client={loadCourseResources:async()=>structuredClone(raw),readCoursePage:async()=>'<p>Teacher page.</p>'};
 const context={ReserveSite:{...require('../extension/site.js'),origin:()=>'https://school.instructure.com'},URL,Date,Map,Set,AbortController,ReserveMaterials:M,ReserveUI:{escapeHTML:require('../extension/ui-utils.js').escapeHTML,safeRichHTML:html=>html},document:{createElement:()=>({content:{querySelectorAll:()=>[]}})},
  ReserveCourseArt:{mini:(course,{place})=>`<svg class="rd-mini" data-place="${place}" data-course="${course.id}"></svg>`},...extra};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/materials-ui.js'),'utf8'),context);
 const ui=context.ReserveMaterialsUI.create({store,user:{id:'5'},client,onCapture:d=>drafts.push(d)});
 return {ui,store,context,drafts};
}
const course={id:'7',name:'Chemistry',color:'#a05252'};
const settle=()=>new Promise(setImmediate);
const order=(html,titles)=>titles.map(t=>html.indexOf('>'+t)).every((at,i,all)=>at>0&&(i===0||at>all[i-1]));

test('the model dates every item it can: files and pages their own, module items their file or page; links none',()=>{
 const raw=catalog(),items=M.normalizeCatalog(raw),at=t=>items.find(x=>x.title===t)?.updatedAt;
 assert.equal(at('Gas worksheet.pdf'),new Date(raw.files[0].updated_at).toISOString(),'a module file borrows its file\'s date');
 assert.ok(Date.parse(at('Lesson notes'))>0,'a module page borrows its page\'s date');
 assert.ok(Date.parse(at('Old page'))>0&&Date.parse(at('Slides week 3.pptx'))>0,'loose pages and files carry their own');
 assert.equal(at('Class video'),null);assert.equal(at('Check-in quiz'),null);
 assert.deepEqual(['File','Page','FrontPage','Syllabus','ExternalUrl','ExternalTool','Quiz','Discussion','Assignment'].map(kind=>M.shelfOf({kind})),['files','pages','pages','pages','links','links','','','']);
 const list=[{t:'a',updatedAt:null},{t:'b',updatedAt:ago(3)},{t:'c',updatedAt:null},{t:'d',updatedAt:ago(1)}];
 assert.deepEqual(M.byRecent(list).map(x=>x.t),['d','b','a','c'],'newest first; undated keep Canvas order after them');
 const now=Date.now();assert.deepEqual([ago(0),ago(6.9),ago(7.1),ago(29),ago(31),null].map(v=>M.ageGroup(v,now)),['week','week','month','month','earlier','undated']);
});

test('Recent is the first shelf: newest first in groups by age, each row behind its kraft tag with its module and its day',async()=>{
 const f=setup();await f.ui.load('7');const html=f.ui.renderLibrary(course,{sharedHeading:true});
 assert.match(html,/<section class="rd-materials rd-shelf" aria-label="Course materials" data-shelf="recent" style="--rd-course:#a05252;--rd-course-ink:#a05252">/);
 assert.ok(order(html,['This week','Gas worksheet','Lesson notes','This month','Locked key','Slides week 3','Earlier','Old page','No date','Class video','Check-in quiz']),'newest first, the undated last in Canvas order');
 assert.match(html,/<h3 class="rd-shelf-age" id="rd-chapter-7-age-week" tabindex="-1" data-chapter="age-week" data-course="7"><span class="rd-shelf-age-name">This week<\/span> <span class="rd-chapter-count">2<\/span><\/h3>/);
 assert.match(html,/<span class="rd-file-tag" data-paper="doc">PDF<\/span><a class="rd-row-open"[^>]*>Gas worksheet&nbsp;[\s\S]*?<span class="rd-row-kind"><span class="rd-row-where" title="Unit 1">Unit 1<\/span><\/span><span class="rd-row-date"><time datetime="[^"]+" title="[^"]+">Yesterday<\/time><\/span><\/li>/,'tag, title, where it lives (in the kind\'s line), the day');
 assert.match(html,/<span class="rd-row-kind">Quiz<span aria-hidden="true"> · <\/span><span class="rd-row-where" title="Unit 1">Unit 1<\/span><\/span>/,'a kind word and where it lives share the second line');
 assert.match(html,/<span class="rd-file-tag" data-paper="slides">Slides<\/span>/);
 assert.match(html,/<span class="rd-file-tag" data-paper="media">Video<\/span>/,'a video link is media');
 assert.match(html,/<span class="rd-file-tag" data-paper="doc">Quiz<\/span>/,'a quiz names itself');
 assert.doesNotMatch(html,/Homework 1/,'assignments never stand on the shelf');
 f.ui.destroy();
});

test('the shelves are one pen-chip segment whose counts never follow the search',async()=>{
 const f=setup();await f.ui.load('7');let html=f.ui.renderLibrary(course,{sharedHeading:true});
 const tabs=html.match(/<div class="rd-filter-group rd-shelf-tabs" role="group" aria-label="Which materials">([\s\S]*?)<\/div>/)[1];
 assert.equal(tabs,['<button type="button" class="rd-filter" data-rd-action="material-kind" data-value="recent" data-course="7" aria-pressed="true">Recent <span class="rd-n">2</span></button>',
  '<button type="button" class="rd-filter" data-rd-action="material-kind" data-value="modules" data-course="7" aria-pressed="false">Modules</button>',
  '<button type="button" class="rd-filter" data-rd-action="material-kind" data-value="files" data-course="7" aria-pressed="false">Files <span class="rd-n">3</span></button>',
  '<button type="button" class="rd-filter" data-rd-action="material-kind" data-value="pages" data-course="7" aria-pressed="false">Pages <span class="rd-n">2</span></button>',
  '<button type="button" class="rd-filter" data-rd-action="material-kind" data-value="links" data-course="7" aria-pressed="false">Links <span class="rd-n">1</span></button>',
  '<button type="button" class="rd-filter" data-rd-action="material-kind" data-value="saved" data-course="7" aria-pressed="false">Saved <span class="rd-n">0</span></button>'].join(''));
 f.ui.input('material-query','gas');html=f.ui.renderLibrary(course,{sharedHeading:true});
 assert.match(html,/data-value="files" data-course="7" aria-pressed="false">Files <span class="rd-n">3<\/span>/,'the count holds while typing');
 f.ui.handle('material-kind',{course:'7',value:'nonsense'});assert.match(f.ui.renderLibrary(course),/data-value="recent" data-course="7" aria-pressed="true"/,'an unknown shelf is refused');
 f.ui.destroy();
});

test('Files, Pages and Links hold only their kind, newest first; quizzes stand on Recent and Modules only',async()=>{
 const f=setup();await f.ui.load('7');const shelf=kind=>{f.ui.handle('material-kind',{course:'7',value:kind});return f.ui.renderLibrary(course);};
 let html=shelf('files');assert.ok(order(html,['Gas worksheet','Locked key','Slides week 3']));assert.doesNotMatch(html,/Lesson notes|Class video|Check-in quiz|Old page/);
 html=shelf('pages');assert.ok(order(html,['Lesson notes','Old page']));assert.doesNotMatch(html,/Gas worksheet|Class video/);
 html=shelf('links');assert.match(html,/Class video/);assert.doesNotMatch(html,/Gas worksheet|Lesson notes|Check-in quiz/);
 html=shelf('modules');assert.match(html,/Check-in quiz/);assert.match(html,/<span class="rd-chapter-name">Unit 1<\/span>/);
 f.ui.destroy();
});

test('Saved holds your bookmarks and own links; the old "Saved shortcuts" filter opens it',async()=>{
 const f=setup();await f.ui.load('7');f.ui.handle('material-pin',{resource:'module:10:11',course:'7'});await settle();
 let html=f.ui.renderLibrary(course);assert.match(html,/data-value="saved" data-course="7" aria-pressed="false">Saved <span class="rd-n">1<\/span>/);
 assert.doesNotMatch(html,/<option value="saved"/,'Saved is a shelf, not a type');
 f.ui.input('material-category','saved');html=f.ui.renderLibrary(course);
 assert.match(html,/data-value="saved" data-course="7" aria-pressed="true"/);assert.match(html,/Gas worksheet/);assert.doesNotMatch(html,/Lesson notes/);
 assert.match(html,/aria-label="Remove bookmark: Gas worksheet" aria-pressed="true">Bookmarked<\/button>/,'unbookmark from the shelf');
 f.ui.handle('material-kind',{course:'7',value:'files'});f.ui.handle('material-kind',{course:'7',value:'saved'});
 f.ui.handle('material-pin',{resource:'module:10:11',course:'7'});await settle();
 assert.match(f.ui.renderLibrary(course),/<h3>Nothing saved yet<\/h3>/);
 f.ui.destroy();
});

test('a shelf switch keeps the search, the type filter and the open page; its folds start closed',async()=>{
 const f=setup();await f.ui.load('7');f.ui.renderLibrary(course);f.ui.input('material-query','notes');f.ui.handle('material-read',{resource:'module:10:12',course:'7'});await settle();
 f.ui.handle('material-kind',{course:'7',value:'pages'});const html=f.ui.renderLibrary(course);
 assert.match(html,/value="notes"/);assert.match(html,/aria-label="Course page preview"/);assert.match(html,/rd-material-columns rd-material-columns--reading/);
 assert.match(html,/aria-current="true"/,'the open page\'s row keeps its mark on the new shelf');
 f.ui.destroy();
});

test('a locked item wears a hatched tag, says so, and cannot be planned',async()=>{
 const f=setup();await f.ui.load('7');f.ui.handle('material-kind',{course:'7',value:'files'});const html=f.ui.renderLibrary(course);
 const row=html.slice(html.indexOf('data-rd-row="module:10:15"'),html.indexOf('</li>',html.indexOf('data-rd-row="module:10:15"')));
 assert.match(row,/<span class="rd-file-tag" data-paper="locked">PDF<\/span>/);assert.match(row,/Locked in Canvas/);assert.doesNotMatch(row,/material-capture/);
 f.ui.handle('material-capture',{resource:'module:10:15',course:'7'});assert.equal(f.drafts.length,0);
 f.ui.destroy();
});

test('an empty shelf shows the course drawing and one sentence',async()=>{
 const raw=catalog();raw.modules[0].items=raw.modules[0].items.filter(x=>x.type!=='ExternalUrl');const f=setup(raw);await f.ui.load('7');
 f.ui.handle('material-kind',{course:'7',value:'links'});let html=f.ui.renderLibrary(course);
 assert.match(html,/<div class="rd-empty rd-shelf-empty"><span class="rd-empty-art" aria-hidden="true"><svg class="rd-mini" data-place="empty" data-course="7"><\/svg><\/span><div><h3>No links in this course<\/h3>/);
 f.ui.handle('material-kind',{course:'7',value:'files'});f.ui.input('material-query','zzz');html=f.ui.renderLibrary(course);
 assert.match(html,/<h3>No files match “zzz”<\/h3>/);
 f.ui.destroy();
});

test('a long group folds to its first five with Show all; opening moves focus to the first it revealed',async()=>{
 const raw=catalog();raw.files=Array.from({length:12},(_,i)=>({id:String(70+i),display_name:`Handout ${i+1}.pdf`,updated_at:ago(10+i),url:'/files/'+(70+i)}));const f=setup(raw);await f.ui.load('7');
 let html=f.ui.renderLibrary(course);const block=()=>{const at=html.indexOf('data-rd-key="shelf-7-age-month"');return html.slice(at,html.indexOf('</section>',at));};
 assert.equal((block().match(/class="rd-teacher-row rd-shelf-row"/g)||[]).length,5);
 assert.match(block(),/data-rd-action="material-more" data-resource="age-month" data-course="7" aria-expanded="false" aria-controls="rd-chapter-7-age-month-items">Show all 12</);
 f.ui.handle('material-more',{resource:'age-month',course:'7'});assert.deepEqual({...f.ui.takeFocusRequest()},{type:'row',courseId:'7',id:'file:7:75'});
 html=f.ui.renderLibrary(course);assert.equal((block().match(/class="rd-teacher-row rd-shelf-row"/g)||[]).length,12);
 f.ui.handle('material-kind',{course:'7',value:'files'});f.ui.handle('material-kind',{course:'7',value:'recent'});html=f.ui.renderLibrary(course);
 assert.equal((block().match(/class="rd-teacher-row rd-shelf-row"/g)||[]).length,5,'a shelf switch folds it again');
 f.ui.destroy();
});

test('a course whose materials carry no dates opens on Modules (Recent would be one undated pile); before the first load only the load control shows',async()=>{
 const raw=catalog();raw.files=[];raw.pages=[];const f=setup(raw);
 let html=f.ui.renderLibrary(course);assert.match(html,/data-rd-action="material-refresh" data-resource="" data-course="7" >Load course materials<\/button>/);assert.doesNotMatch(html,/rd-shelf-empty|rd-chapter-flow/,'no empty sentence before anything was asked');
 await f.ui.load('7');html=f.ui.renderLibrary(course);
 assert.match(html,/data-value="modules" data-course="7" aria-pressed="true"/);assert.match(html,/<span class="rd-chapter-name">Unit 1<\/span>/);
 f.ui.handle('material-kind',{course:'7',value:'recent'});html=f.ui.renderLibrary(course);
 assert.match(html,/data-value="recent" data-course="7" aria-pressed="true"/);assert.match(html,/No date/,'a chosen shelf stays chosen');
 f.ui.destroy();
});

test('on the dashboard the shelf\'s head is the course\'s own drawing and "Materials", with its facts',async()=>{
 const f=setup();await f.ui.load('7');const html=f.ui.renderLibrary({...course,teacher:'Course Teacher'},{sharedHeading:true});
 assert.match(html,/<header class="rd-materials-header rd-shelf-head" style="--rd-course:#a05252;--rd-course-ink:#a05252"><span class="rd-shelf-art" aria-hidden="true"><svg class="rd-mini" data-place="shelf" data-course="7"><\/svg><\/span><div><h2 title="Chemistry">Materials<\/h2><p class="rd-shelf-facts"><strong class="rd-course-detail">Course Teacher<\/strong> · 7 items<span aria-hidden="true"> · <\/span>2 new this week<span aria-hidden="true"> · <\/span><span title="[^"]+">Saved just now<\/span><\/p><\/div>/);
 assert.doesNotMatch(html,/rd-banner-art|A class document or your own work file/,'no second banner, no standing description');
 assert.match(html,/<div class="rd-material-list rd-shelf-sheet">/,'the list is the drawn sheet');
 f.ui.destroy();
});

test('the Course hub and the deck keep their rows: no tag, the format at the right',()=>{
 const {context}=setup();const entry=M.present([{id:'file:7:1',courseId:'7',title:'Notes.pdf',kind:'File',category:'File',url:'https://school.instructure.com/courses/7/files/1'}])[0];
 const row=context.ReserveMaterialsUI.row(entry,{open:'<a class="rd-row-open">Notes</a>',key:'k'});
 assert.equal(row,'<li class="rd-teacher-row" data-rd-key="k" data-rd-row="file:7:1"><a class="rd-row-open">Notes</a><span class="rd-row-kind"></span><span class="rd-row-format"><span>PDF</span></span></li>');
});
