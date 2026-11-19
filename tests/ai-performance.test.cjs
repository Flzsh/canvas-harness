'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Context=require('../extension/ai-context.js');
const {panelFixture,tick,reading,wrap,button}=require('./study-fixture.cjs');
const origin='https://school.instructure.com';

// Exercise the real source with deterministic visibility, ports and time. No browser or network.
function sourceFixture({pdf=false,hidden=false,panelHidden=false,subscribe=true,freshContext=false,mount=true,demo=true,shadow=false,client={}}={}){
 const counters={catalogs:0,accountReads:0,serializations:0,contextReads:0,connects:0};
 const ctx={courseId:'10',aiAssignmentId:'1',aiSelectedIds:['assignment:10:1'],s:{theme:'system',motion:'gentle'},
  courses:[{id:'10',name:'Chemistry'},{id:'20',name:'English'}],
  items:[{id:'1',courseId:'10',name:'Lab',courseName:'Chemistry',description:'Original instructions',dueAt:'2026-10-22',rubric:[{description:'Observe',long_description:'Compare trials'}],url:origin+'/courses/10/assignments/1'}],
  aiResources:[{courseId:'10',frontPage:{body:'Home instructions'},syllabusBody:'Syllabus',pages:[{url:'guide',title:'Guide',body:'Page text'}],files:[{id:'24',display_name:'Reading.pdf',size:100}],modules:[{items:[{type:'File',content_id:'25',title:'Module PDF'}]}]}],
  aiUpdates:[{courseId:'10',announcements:[{id:'8',title:'News',body:'Announcement text',url:origin+'/courses/10/announcements/8'}]}]};
 const account={toolbox:{aiAutoSend:false}},listeners=new Set(),events=new Map(),intervals=new Map(),observers=[],ports=[];
 let now=0,nextTimer=0,dark=false;
 function node(tag,parentElement=null){return {tagName:tag,parentElement,hidden:false,open:true,style:{},isConnected:true,
  checkVisibility(){for(let n=this;n;n=n.parentElement||n.getRootNode?.()?.host)if(n.hidden||n.tagName==='DIALOG'&&!n.open||n.style.display==='none'||n.style.visibility==='hidden')return false;return true;}};}
 const host=node('DIV'),dialog=node('DIALOG',host),body=node('DIV',dialog),panel=node('SECTION',body),container=node('DIV',panel);
 if(shadow){dialog.parentElement=null;dialog.getRootNode=()=>({host});}
 panel.hidden=panelHidden;
 const frame=node('IFRAME');frame.handlers=new Map();frame.addEventListener=(type,fn)=>frame.handlers.set(type,fn);frame.remove=()=>{frame.isConnected=false;};frame.focus=()=>{};
 container.append=()=>{frame.parentElement=container;};
 const document={hidden,createElement:()=>frame,addEventListener(type,fn){if(!events.has(type))events.set(type,new Set());events.get(type).add(fn);},removeEventListener:(type,fn)=>events.get(type)?.delete(fn)};
 const store={owner:{origin,accountId:'7'},get(){counters.accountReads++;return structuredClone(account);},async update(fn){fn(account);for(const listener of listeners)listener(structuredClone(account));return structuredClone(account);}};
 if(subscribe)store.subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
 const sandbox={URL,document,Date:{now:()=>now},JSON:{stringify(value){if(value?.sources&&value?.scopeKey)counters.serializations++;return JSON.stringify(value);}},
  CanvasHarnessContext:{...Context,catalog(...args){counters.catalogs++;return Context.catalog(...args);}},
  matchMedia:()=>({get matches(){return dark;}}),fetch(){throw Error('Unexpected network');},removeEventListener(){},
  setInterval(fn,delay){const id=++nextTimer;intervals.set(id,{fn,delay,due:now+delay});return id;},clearInterval:id=>intervals.delete(id),
  MutationObserver:class {constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}observe(target){this.targets.add(target);}disconnect(){this.targets.clear();}},
  chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,connect(){counters.connects++;const port={sent:[],postMessage(message){this.sent.push(structuredClone(message));},onMessage:{addListener(fn){port.receive=fn;}},onDisconnect:{addListener(fn){port.drop=fn;}},disconnect(){port.drop();}};ports.push(port);return port;}}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/ai-source.js'),'utf8'),sandbox);
 const options={container,getContext(){counters.contextReads++;return freshContext?structuredClone(ctx):ctx;},store,user:{id:'7'},client:{profile:async()=>({id:'7'}),...client},demo};
 if(pdf)options.pdfHandoff={origin,accountId:'7',fileId:'42',name:'Reading.pdf',text:'Selected text',page:0,appearance:{theme:'light'}};
 const source=mount?sandbox.CanvasHarnessAISource.mount(options):sandbox.CanvasHarnessAISource.create(options);
 return {source,ctx,store,account,counters,ports,intervals,listeners,events,observers,frame,container,panel,body,dialog,host,handoff:options.pdfHandoff,
  get lastCatalog(){return ports.at(-1)?.sent.filter(message=>message.kind==='catalog').at(-1)?.data;},
  setDark(value){dark=value;},
  visibility(value){document.hidden=value;for(const fn of events.get('visibilitychange')||[])fn();},
  mutate(target,key,value){if(key==='style')target.style=value;else target[key]=value;for(const observer of observers)if(observer.targets.has(target))observer.callback([{target,attributeName:key}]);},
  advance(ms){const end=now+ms;while(true){const entry=[...intervals].filter(([,timer])=>timer.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!entry)break;const [,timer]=entry;now=timer.due;timer.due+=timer.delay;timer.fn();}now=end;}};
}

for(const pdf of [false,true])test((pdf?'PDF':'Canvas')+' polling pauses while the document is hidden and resumes immediately',t=>{
 const f=sourceFixture({pdf});t.after(()=>f.source.destroy());
 assert.equal(f.lastCatalog.sources.length>0,true);assert.equal(f.intervals.size,1);
 const staleTick=[...f.intervals.values()][0].fn;
 f.visibility(true);assert.equal(f.intervals.size,0);
 const paused={...f.counters};f.ports[0].drop();f.advance(24000);staleTick();f.source.update();
 assert.deepEqual(f.counters,paused,'hidden callbacks do no catalog, clone, serialization or reconnection work');
 f.ctx.items[0].name='Changed while hidden';f.visibility(false);
 assert.equal(f.counters.connects,2);assert.equal(f.intervals.size,1);
 assert.equal(f.lastCatalog.sources[0].title,pdf?'Reading.pdf \u00b7 page 1':'Changed while hidden');
 assert.equal([...f.intervals.values()][0].delay,1200);
 f.visibility(false);assert.equal(f.intervals.size,1,'duplicate events cannot duplicate polling');
 f.advance(20400);assert.equal(f.ports[1].sent.at(-1).kind,'ping');
});

test('panel hiding, closing and collapsing stop polling and preserve updates on reopening',t=>{
 const f=sourceFixture();t.after(()=>f.source.destroy());
 for(const [target,key,hidden,shown] of [[f.panel,'hidden',true,false],[f.body,'hidden',true,false],[f.dialog,'open',false,true],[f.host,'style',{display:'none'},{}]]){
  f.mutate(target,key,hidden);assert.equal(f.intervals.size,0);
  const before={...f.counters};f.advance(12000);f.source.update();assert.deepEqual(f.counters,before);
  f.ctx.items[0].name+='!';f.mutate(target,key,shown);
  assert.equal(f.lastCatalog.active.title,f.ctx.items[0].name,'metadata is current before the next timer tick');assert.equal(f.intervals.size,1);
 }
 f.mutate(f.panel,'hidden',true);f.visibility(true);f.mutate(f.panel,'hidden',false);assert.equal(f.intervals.size,0);
 f.visibility(false);assert.equal(f.intervals.size,1);
 f.source.destroy();assert.equal(f.intervals.size,0);assert.equal(f.listeners.size,0);assert.equal(f.events.get('visibilitychange').size,0);assert.equal(f.observers.every(o=>o.targets.size===0),true);
 f.visibility(false);f.mutate(f.panel,'hidden',false);f.source.update();assert.equal(f.intervals.size,0);
});

for(const options of [{hidden:true},{panelHidden:true}])test('an initially hidden source starts polling only when visible: '+JSON.stringify(options),t=>{
 const f=sourceFixture(options);t.after(()=>f.source.destroy());assert.equal(f.intervals.size,0);assert.equal(f.counters.contextReads,0);assert.equal(f.counters.connects,0);
 f.visibility(false);f.mutate(f.panel,'hidden',false);assert.equal(f.intervals.size,1);assert.equal(f.lastCatalog.active.title,'Lab');
});

test('visibility observation crosses shadow hosts and supports the older checkVisibility CSS option',t=>{
 const f=sourceFixture({shadow:true});t.after(()=>f.source.destroy());
 const check=f.frame.checkVisibility;
 f.frame.checkVisibility=function(options){return options.checkVisibilityCSS?check.call(this):true;};
 f.mutate(f.host,'style',{visibility:'hidden'});assert.equal(f.intervals.size,0);
 f.mutate(f.host,'style',{});assert.equal(f.intervals.size,1);
});

test('unchanged PDF metadata reuses serialization and still publishes appearance changes',t=>{
 const f=sourceFixture({pdf:true});t.after(()=>f.source.destroy());f.advance(60000);assert.equal(f.counters.serializations,1);
 f.handoff.appearance.theme='dark';f.source.update();assert.equal(f.lastCatalog.theme,'dark');assert.equal(f.counters.serializations,2);f.advance(1200);assert.equal(f.counters.serializations,2);
});

test('fifty unchanged polls reuse metadata, account snapshot and serialized catalog even with fresh context wrappers',t=>{
 const f=sourceFixture({freshContext:true});t.after(()=>f.source.destroy());f.advance(60000);
 t.diagnostic('50 idle polls: '+JSON.stringify(f.counters));
 assert.equal(f.counters.catalogs,1);assert.equal(f.counters.accountReads,1);assert.equal(f.counters.serializations,1);
 assert.equal(f.ports[0].sent.filter(m=>m.kind==='catalog').length,1);
 f.frame.handlers.get('load')();assert.equal(f.ports[0].sent.filter(m=>m.kind==='catalog').length,2);assert.equal(f.counters.serializations,1,'frame reload reuses serialization but republishes');
 f.ports[0].drop();f.advance(1200);assert.equal(f.ports.length,2);assert.equal(f.ports[1].sent[0].kind,'catalog');assert.equal(f.counters.serializations,1);
 assert.equal(f.source.setQuestion('Explain this'),true);assert.equal(f.lastCatalog.ponyQuestion.text,'Explain this');const serialized=f.counters.serializations;
 f.advance(12000);assert.equal(f.counters.serializations,serialized,'prefill wrappers are cached too');
 assert.equal(f.source.setStudy({kind:'reading',itemId:'1'}),true);assert.equal(f.lastCatalog.ponyQuestion,undefined);assert.equal(f.lastCatalog.ponyStudy.kind,'reading');
 f.ctx.courseId='20';f.source.update();assert.equal(f.lastCatalog.ponyStudy,undefined,'scope changes expire study prefill');
});

test('metadata invalidation covers in-place catalog inputs, including instruction-only changes',async t=>{
 const cases=[
  ['assignment title',f=>{f.ctx.items[0].name='New lab';},s=>assert.equal(s.active.title,'New lab')],
  ['assignment due',f=>{f.ctx.items[0].dueAt='2026-11-01';},s=>assert.equal(s.active.due,'2026-11-01')],
  ['assignment URL',f=>{f.ctx.items[0].url=origin+'/courses/10/assignments/2';},s=>assert.equal(s.sources[0].url,origin+'/courses/10/assignments/2')],
  ['assignment lock',f=>{f.ctx.items[0].locked=true;},s=>assert.equal(s.sources.some(x=>x.id==='assignment:10:1'),false)],
  ['personal assignment',f=>{f.ctx.items[0].personal=true;},s=>assert.equal(s.active,null)],
  ['course name fallback',f=>{delete f.ctx.items[0].courseName;f.ctx.courses[0].shortName='Chem';},s=>{assert.equal(s.active.courseName,'Chem');assert.equal(s.courses[0].name,'Chem');}],
  ['removed course',f=>{f.ctx.courses.splice(0,1);},s=>assert.equal(s.sources.length,0)],
  ['front-page publication',f=>{f.ctx.aiResources[0].frontPage.published=false;},s=>assert.equal(s.sources.some(x=>x.id==='home:10'),false)],
  ['page title',f=>{f.ctx.aiResources[0].pages[0].title='New guide';},s=>assert.equal(s.sources.find(x=>x.id==='page:10:guide').title,'New guide')],
  ['page body removed',f=>{f.ctx.aiResources[0].pages[0].body='';},s=>assert.equal(s.sources.find(x=>x.id==='page:10:guide').loaded,false)],
  ['file size',f=>{f.ctx.aiResources[0].files[0].size=500;},s=>assert.equal(s.sources.find(x=>x.id==='file:10:24').size,500)],
  ['file visibility',f=>{f.ctx.aiResources[0].files[0].hidden_for_user=true;},s=>assert.equal(s.sources.some(x=>x.id==='file:10:24'),false)],
  ['module item',f=>{f.ctx.aiResources[0].modules[0].items[0].title='New module file';},s=>assert.equal(s.sources.find(x=>x.id==='file:10:25').title,'New module file')],
  ['announcement title',f=>{f.ctx.aiUpdates[0].announcements[0].title='New announcement';},s=>assert.equal(s.sources.find(x=>x.id==='announcement:10:8').title,'New announcement')],
  ['announcement lock',f=>{f.ctx.aiUpdates[0].announcements[0].locked_for_user=true;},s=>assert.equal(s.sources.some(x=>x.id==='announcement:10:8'),false)]
 ];
 for(const [name,mutate,check] of cases){const f=sourceFixture({mount:false});try{f.source.summary();mutate(f);const summary=f.source.summary();check(summary);assert.equal(f.counters.catalogs,2,name);f.source.summary();assert.equal(f.counters.catalogs,2,name+' is reused after the change');}finally{f.source.destroy();}}
 const f=sourceFixture({mount:false});t.after(()=>f.source.destroy());f.source.summary();
 f.ctx.items[0].description='Revised instructions';f.ctx.items[0].rubric[0].long_description='Revised rubric';f.ctx.aiResources[0].syllabusBody='Revised syllabus';f.ctx.aiUpdates[0].announcements[0].body='Revised announcement';
 const result=await f.source.collect({ids:['assignment:10:1','syllabus:10','announcement:10:8'],includeAssignmentPdfs:false});
 for(const text of ['Revised instructions','Revised rubric','Revised syllabus','Revised announcement'])assert.ok(result.text.includes(text));
});

test('selection, scope, appearance, system theme and subscribed preference changes invalidate only needed metadata',async t=>{
 const f=sourceFixture();t.after(()=>f.source.destroy());const firstScope=f.lastCatalog.scopeKey;
 f.ctx.aiSelectedIds.splice(0,1,'page:10:guide');f.source.update();assert.deepEqual(f.lastCatalog.selectedIds,['page:10:guide']);assert.notEqual(f.lastCatalog.scopeKey,firstScope);
 f.ctx.aiAssignmentId=null;f.source.update();assert.equal(f.lastCatalog.active,null);
 f.ctx.s.motion='off';f.ctx.s.theme='dark';f.source.update();assert.equal(f.lastCatalog.motion,'off');assert.equal(f.lastCatalog.theme,'dark');
 f.ctx.s.theme='system';f.setDark(false);f.source.update();assert.equal(f.lastCatalog.theme,'light');f.setDark(true);f.advance(1200);assert.equal(f.lastCatalog.theme,'dark');
 await f.store.update(data=>{data.toolbox.aiAutoSend=true;});f.advance(1200);assert.equal(f.lastCatalog.autoSend,true);assert.equal(f.counters.accountReads,1);
 const fallback=sourceFixture({mount:false,subscribe:false});t.after(()=>fallback.source.destroy());assert.equal(fallback.source.summary().autoSend,false);fallback.account.toolbox.aiAutoSend=true;assert.equal(fallback.source.summary().autoSend,true,'stores without subscriptions remain current');
});

test('fresh assignments and loaded course resources invalidate cached metadata and text',async t=>{
 const raw={origin,accountId:'7',courseId:'20',pages:[{url:'new',title:'Loaded page',body:'Loaded instructions'}]};
 const f=sourceFixture({mount:false,demo:false,client:{readAssignment:async()=>({id:'1',name:'Fresh lab',description:'Fresh instructions'}),loadCourseResources:async()=>raw,loadCourseUpdates:async()=>({courseId:'20',announcements:[{id:'9',title:'Fresh update',body:'Fresh announcement'}]})}});t.after(()=>f.source.destroy());
 f.source.summary();await f.source.collect({ids:['assignment:10:1'],includeAssignmentPdfs:false});assert.equal(f.source.summary().active.title,'Fresh lab');
 const loaded=await f.source.loadCourse('20');assert.equal(loaded.sources.find(x=>x.id==='page:20:new').title,'Loaded page');assert.equal(loaded.sources.find(x=>x.id==='announcement:20:9').title,'Fresh update');
 raw.pages[0].title='Loaded page revised';assert.equal(f.source.summary().sources.find(x=>x.id==='page:20:new').title,'Loaded page revised');
 const gathered=await f.source.collect({ids:['page:20:new','announcement:20:9']});assert.match(gathered.text,/Loaded instructions/);assert.match(gathered.text,/Fresh announcement/);
});

function watchPanel(f){
 const counts={replacements:0,contextWrites:0},ids=['selected-items','pdf-list','issue-list','ch-study-saved-list','ch-study-errors'];
 for(const id of ids){const node=f.get(id),replace=node.replaceChildren;node.replaceChildren=function(...args){counts.replacements++;return replace.apply(this,args);};}
 for(const id of ['context-text','context-count']){const node=f.get(id),descriptor=Object.getOwnPropertyDescriptor(f.Element.prototype,'textContent');Object.defineProperty(node,'textContent',{get(){return descriptor.get.call(this);},set(value){counts.contextWrites++;descriptor.set.call(this,value);}});}
 return counts;
}

test('one hundred prompt input events update only the composer and preserve reviewed context',async t=>{
 const f=panelFixture({collect:data=>({scopeKey:'https://school.instructure.com|7|c1|a',text:'Actual selected text',included:data.ids.map(id=>({id,title:'Instructions A'})),omitted:[{title:'PDF',reason:'Unreadable'}]})});t.after(()=>f.close());await tick();
 await f.controller.preview();f.controller.acceptIssues(true);
 const counts=watchPanel(f),nodes=f.nodes.length,selected=f.get('selected-items').children[0],issue=f.get('issue-list').children[0],context=f.controller.state.context,requests=f.requests.length;
 f.document.activeElement=f.get('prompt');f.get('context-text').scrollTop=123;
 for(let i=1;i<=100;i++){f.get('prompt').value='x'.repeat(i);f.get('prompt').fire('input');}
 t.diagnostic('100 prompt inputs: '+JSON.stringify({...counts,nodesCreated:f.nodes.length-nodes}));
 assert.equal(counts.replacements,0);assert.equal(counts.contextWrites,0);assert.equal(f.nodes.length,nodes);
 assert.equal(f.get('selected-items').children[0],selected);assert.equal(f.get('issue-list').children[0],issue);assert.equal(f.controller.state.context,context);assert.equal(f.get('accept-issues').checked,true);assert.equal(f.get('context-text').scrollTop,123);
 assert.equal(f.document.activeElement,f.get('prompt'));assert.equal(f.get('prompt-count').textContent,'100 / 20,000');assert.equal(f.get('send').disabled,false);assert.equal(f.requests.length,requests);
 f.controller.setCatalog({...f.catalog,active:null,selectedIds:[]});f.get('prompt').value=' ';f.get('prompt').fire('input');assert.equal(f.get('send').disabled,true);f.get('prompt').value='Question';f.get('prompt').fire('input');assert.equal(f.get('send').disabled,false);
});

test('unrelated state changes reuse lists and context, while real catalog and context updates render',async t=>{
 let body='First context',reason='First issue';const f=panelFixture({collect:data=>({scopeKey:'https://school.instructure.com|7|c1|a',text:body,included:data.ids.map(id=>({id,title:id})),omitted:[{title:'Reading',reason}]})});t.after(()=>f.close());await tick();await f.controller.preview();
 const selected=f.get('selected-items').children[0],issue=f.get('issue-list').children[0],counts=watchPanel(f);
 f.controller.setAutoSend(true);f.controller.setProvider('claude');await tick();assert.equal(counts.replacements,0);assert.equal(counts.contextWrites,0);assert.match(f.get('sharing-note').textContent,/Claude/);assert.equal(f.get('selected-items').children[0],selected);
 body='Updated context';reason='Updated issue';await f.controller.preview();assert.equal(f.get('context-text').textContent,f.controller.state.context.message);assert.match(f.get('context-text').textContent,/Updated context/);assert.match(f.get('issue-list').textContent,/Updated issue/);assert.notEqual(f.get('issue-list').children[0],issue);assert.equal(f.get('selected-items').children[0],selected);
 f.catalog.sources[0].title='Revised instructions';f.receive({kind:'catalog',data:{...f.catalog}});assert.match(f.get('selected-items').textContent,/Revised instructions/);assert.equal(f.get('context-preview').hidden,true);
 f.controller.setDraft('Keep this question');f.receive({kind:'catalog',data:{...f.catalog,selectedIds:['b']}});assert.match(f.get('selected-items').textContent,/Reading B/);assert.equal(f.get('prompt').value,'Keep this question');assert.equal(f.get('context-preview').hidden,true);
});

test('typing clears manual fallback immediately without taking focus or rerendering context',async t=>{
 const f=panelFixture({clipboardFail:true});t.after(()=>f.close());await tick();f.controller.setDraft('First question');await f.controller.copy();assert.equal(f.get('fallback').hidden,false);
 const counts=watchPanel(f);f.get('prompt').focus();f.get('prompt').value='Edited question';f.get('prompt').fire('input');
 assert.equal(f.get('fallback').hidden,true);assert.equal(f.get('fallback-text').value,'');assert.equal(f.controller.state.manualCopy,false);assert.equal(f.document.activeElement,f.get('prompt'));assert.equal(counts.contextWrites,0);assert.equal(counts.replacements,0);
});

test('saved list controls reflect busy changes and in-place removals without replacing unchanged rows',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();await f.controller.setMode('reading');await f.controller.copy();f.controller.setAnswer(wrap(reading()));assert.equal(await f.controller.readAnswer(),true);f.controller.closeAid();await f.controller.setMode('ask');
 const list=f.get('ch-study-saved-list'),row=list.children[0],key=Object.keys(f.controller.state.saved)[0];assert.ok(row);
 const work=f.controller.preview();assert.equal(list.children[0],row);assert.equal(button(row,'Open').disabled,true);await work;assert.equal(list.children[0],row);assert.equal(button(row,'Open').disabled,false);
 const saved=f.controller.state.saved;await f.controller.removeAid(key);assert.equal(f.controller.state.saved,saved);assert.equal(list.children.length,0);
});

test('real PDF attachment and removal update the list while typing and busy changes preserve its row',async t=>{
 const f=panelFixture();t.after(()=>f.close());await tick();
 const port=f.env.chrome.runtime.connect({name:'ch-ai-panel'}),post=port.postMessage;
 port.postMessage=request=>{if(request.action!=='pdf')return post(request);f.requests.push(request);queueMicrotask(()=>f.receive({id:request.id,ok:true,result:{text:'Attached PDF text',pages:1,totalPages:1,warnings:[]}}));};
 f.env.btoa=value=>Buffer.from(value,'binary').toString('base64');
 assert.equal(await f.controller.attach({name:'Notes.pdf',size:5,arrayBuffer:async()=>new TextEncoder().encode('%PDF-').buffer}),true);
 const list=f.get('pdf-list'),row=list.children[0];assert.match(row.textContent,/Notes.pdf/);
 const counts=watchPanel(f);f.get('prompt').value='About my notes';f.get('prompt').fire('input');assert.equal(list.children[0],row);assert.equal(counts.replacements,0);
 const preview=f.controller.preview();assert.equal(list.children[0],row);assert.equal(button(row,'Remove').disabled,true);await preview;assert.equal(list.children[0],row);assert.equal(button(row,'Remove').disabled,false);assert.match(f.get('context-text').textContent,/Attached PDF text/);
 button(row,'Remove').fire('click');assert.equal(list.children.length,0);assert.equal(f.controller.state.pdfs.length,0);assert.equal(f.get('context-preview').hidden,true);
});
