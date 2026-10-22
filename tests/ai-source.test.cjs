'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../extension/ai-context.js');
const {create,createPdfHandoff}=require('../extension/ai-source.js');
const origin='https://school.instructure.com',user={id:'7'};
function fixture(overrides={}){
 const ctx={courses:[{id:'10',name:'Chemistry'},{id:'20',name:'English'}],courseId:'10',aiAssignmentId:'1',items:[{id:'1',courseId:'10',name:'Lab',courseName:'Chemistry',description:'Read the guide.'}],s:{}};
 const calls=[],client={profile:async()=>user,readAssignment:async()=>{
  calls.push('assignment');return {id:'1',course_id:'10',name:'Lab',description:'<p>Compare the trials.</p><a href="/courses/10/pages/guide">Guide</a><a href="/courses/20/pages/private">Other course</a>',submission:{body:'Private answer'},rubric:[{description:'Use observations'}]};},
  readCoursePage:async(course,slug)=>{calls.push(course+':'+slug);return '<p>Use three trials.</p>';},...overrides};
 return {ctx,calls,client,source:create({getContext:()=>ctx,store:{owner:{origin,accountId:'7'}},client,user})};
}
test('Inject all includes fresh instructions and linked same-course pages, not unrelated grades or work',async()=>{
 const f=fixture();const result=await f.source.collect({all:true,ids:[]});
 assert.deepEqual(f.calls,['assignment','10:guide']);assert.equal(result.included.length,2);
 assert.match(result.text,/Use three trials/);assert.match(result.text,/Use observations/);assert.ok(!result.text.includes('Private answer'));
});
test('an account change during collection rejects the complete result',async()=>{
 let reads=0;const f=fixture({profile:async()=>({id:++reads===1?'7':'8'})});
 await assert.rejects(f.source.collect({ids:['assignment:10:1']}),/account changed/);
});
test('a navigation during a pending source read discards the old context',async()=>{
 const f=fixture();f.client.readAssignment=async()=>{f.ctx.aiAssignmentId=null;return {id:'1',name:'Old page',description:'Do not share stale text'};};
 await assert.rejects(f.source.collect({all:true}),/view changed/);
});
test('home requires choices, and rejects unknown IDs rather than looking up arbitrary resources',async()=>{
 const f=fixture();f.ctx.aiAssignmentId=null;
 assert.equal((await f.source.collect({ids:[]})).text,'');
 await assert.rejects(f.source.collect({all:true}),/Open an assignment/);
 await assert.rejects(f.source.collect({ids:['file:20:999']}),/selection changed/);
 assert.deepEqual(f.calls,[]);
});
test('failed linked reads are reported and never masquerade as extracted text',async()=>{
 const f=fixture({readCoursePage:async()=>{throw Error('Page locked');}});
 const result=await f.source.collect({all:true});assert.equal(result.included.length,1);
 assert.equal(result.omitted[0].reason,'Page locked');assert.ok(!result.text.includes('Page locked'));
});
test('oversized PDFs are skipped before any download request',async()=>{
 const f=fixture({readAssignment:async()=>({id:'1',name:'Lab',description:'<a href="/courses/10/files/24">PDF</a>'}),readFile:async()=>({id:'24',size:3*1024*1024,url:origin+'/files/24/download'})});
 const result=await f.source.collect({all:true});assert.match(result.omitted[0].reason,/2 MiB/);
});
test('malformed URLs and files owned by another course are not followed',()=>{
 const links=globalThis.CanvasHarnessContext.links('<a href="/courses/20/files/24/download">x</a><a href="/courses/10/pages/%E0%A4%A">bad encoding</a><a href="/files/25">allowed reference</a>',origin,'10');
 assert.equal(links.length,1);assert.equal(links[0].fileId,'25');
});
test('explicitly loading another course makes its sources selectable without changing the active assignment',async()=>{
 const f=fixture({loadCourseResources:async id=>({origin,accountId:'7',courseId:id,frontPage:{body:'Selected English reading'}})});
 const catalog=await f.source.loadCourse('20');assert.equal(catalog.active.id,'assignment:10:1');
 assert.ok(catalog.sources.some(s=>s.id==='home:20'));
 const result=await f.source.collect({ids:['home:20']});assert.match(result.text,/Selected English reading/);
});

const pdfSelection={origin,accountId:'7',fileId:'42',name:'Chemistry.pdf',text:'  Compare the rates of diffusion.  ',page:1,endPage:3};
test('plain PDF handoff catalogs contain only the selected source and keep automatic sending off',async()=>{
 const source=createPdfHandoff({...pdfSelection,page:2,endPage:2,appearance:{theme:'dark'}});
 const expected={scopeKey:[origin,'7','pdf-page','42','2',String(pdfSelection.text.length)].join('|'),
  selectedIds:['pdf-page:42:2'],courseId:'all',active:null,courses:[],
  sources:[{id:'pdf-page:42:2',title:'Chemistry.pdf \u00b7 page 3',kind:'file',courseId:'all',loaded:true}],
  demo:false,autoSend:false,theme:'dark',motion:'gentle'};
 assert.deepEqual(source.summary(),expected);assert.deepEqual(await source.catalog(),expected);
 assert.equal(fixture().source.summary().autoSend,false);
});
test('PDF handoff defaults to the selected page and a light appearance',async()=>{
 const source=createPdfHandoff({...pdfSelection,endPage:undefined}),catalog=source.summary();
 assert.equal(catalog.theme,'light');assert.equal(catalog.autoSend,false);
 assert.deepEqual(catalog.selectedIds,['pdf-page:42:1']);assert.equal(catalog.sources[0].title,'Chemistry.pdf \u00b7 page 2');
 assert.equal((await source.collect({ids:catalog.selectedIds})).text,'[PDF text: Chemistry.pdf, page 2]\nCompare the rates of diffusion.');
});
test('PDF handoff rejects invalid account, file, origin, page and text inputs before sharing',()=>{
 for(const invalid of [{origin:'http://school.instructure.com'},{origin:origin+'/'},{origin:'https://user:secret@school.instructure.com'},
  {accountId:''},{accountId:'not-an-account'},{fileId:'not-a-file'},{page:-1},{page:1.5},{endPage:0},{endPage:Infinity},
  {text:''},{text:'   '},{text:null},{text:'x'.repeat(100001)}])assert.throws(()=>createPdfHandoff({...pdfSelection,...invalid}));
 const source=createPdfHandoff({...pdfSelection,text:'x'.repeat(100000)});assert.equal(source.summary().sources.length,1);
});
test('PDF handoff uses selected text without network requests and preserves source selection and teardown guards',async t=>{
 const network=t.mock.method(globalThis,'fetch',async()=>{throw Error('PDF handoff must use the existing selected text');});
 const source=createPdfHandoff(pdfSelection),summary=source.summary(),catalog=await source.catalog(),result=await source.collect({ids:catalog.selectedIds});
 assert.deepEqual(catalog,summary);assert.equal(result.scopeKey,summary.scopeKey);
 assert.equal(result.text,'[PDF text: Chemistry.pdf, pages 2\u20134]\nCompare the rates of diffusion.');
 assert.deepEqual(result.included,[{id:'pdf-page:42:1-3',title:'Chemistry.pdf \u00b7 pages 2\u20134',kind:'file',courseId:'all'}]);assert.deepEqual(result.omitted,[]);
 for(const selection of [{ids:[]},{ids:['pdf-page:42:0']},{ids:catalog.selectedIds,all:true}])await assert.rejects(source.collect(selection),/selection|selected|changed/i);
 await assert.rejects(source.loadCourse('20'),/PDF selection/);
 source.destroy();assert.throws(()=>source.summary(),/closed|unavailable/i);await assert.rejects(source.catalog(),/closed|unavailable/i);
 await assert.rejects(source.collect({ids:catalog.selectedIds}),/closed|unavailable/i);assert.equal(network.mock.callCount(),0);
});

// Real source controller with deterministic ports, ancestry, timers and metadata work counts.
function pollingSource({pdf=false,hidden=false,panelHidden=false,subscribe=true,freshContext=false,mount=true,demo=true,embedded=false,shadow=false,client={}}={}){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Context=globalThis.CanvasHarnessContext;
 const counters={catalogs:0,accountReads:0,serializations:0,contextReads:0,connects:0,disconnects:0,unsubscribes:0};
 const ctx={courseId:'10',aiAssignmentId:'1',aiSelectedIds:['assignment:10:1'],s:{theme:'light',motion:'gentle'},
  courses:[{id:'10',name:'Chemistry'},{id:'20',name:'English'}],items:[{id:'1',courseId:'10',name:'Lab',courseName:'Chemistry',description:'Original instructions',rubric:[{description:'Observe'}]}],
  aiResources:[{courseId:'10',frontPage:{body:'Home instructions'},pages:[{url:'guide',title:'Guide',body:'Page text'}],files:[{id:'24',display_name:'Reading.pdf',size:100}]}],
  aiUpdates:[{courseId:'10',announcements:[{id:'8',title:'News',body:'Announcement text',url:origin+'/courses/10/announcements/8'}]}]};
 const account={toolbox:{aiAutoSend:false}},listeners=new Set(),events=new Map(),intervals=new Map(),observers=[],ports=[];let now=0,sequence=0;
 function node(tag,parentElement=null){return {tagName:tag,parentElement,hidden:false,open:true,style:{},dataset:{},isConnected:true,
  checkVisibility(){for(let n=this;n;n=n.parentElement||n.getRootNode?.()?.host)if(n.hidden||n.tagName==='DIALOG'&&!n.open||n.style.display==='none'||n.style.visibility==='hidden')return false;return true;}};}
 const host=node('DIV'),dialog=node('DIALOG',host),body=node('DIV',dialog),panel=node('SECTION',body),container=node('DIV',panel),frame=node('IFRAME');
 if(shadow){dialog.parentElement=null;dialog.getRootNode=()=>({host});}panel.hidden=panelHidden;
 frame.handlers=new Map();frame.addEventListener=(type,fn)=>frame.handlers.set(type,fn);frame.remove=()=>{frame.isConnected=false;};frame.focus=()=>{};container.append=()=>{frame.parentElement=container;};
 const document={hidden,createElement:()=>frame,addEventListener(type,fn){if(!events.has(type))events.set(type,new Set());events.get(type).add(fn);},removeEventListener:(type,fn)=>events.get(type)?.delete(fn)};
 const store={owner:{origin,accountId:'7'},get(){counters.accountReads++;return structuredClone(account);},async update(fn){fn(account);for(const listener of listeners)listener(structuredClone(account));}};
 if(subscribe)store.subscribe=fn=>{listeners.add(fn);return()=>{counters.unsubscribes++;listeners.delete(fn);};};
 const sandbox={URL,document,Date:{now:()=>now},JSON:{stringify(value){if(value?.sources&&value?.scopeKey)counters.serializations++;return JSON.stringify(value);}},
  CanvasHarnessContext:{...Context,catalog(...args){counters.catalogs++;return Context.catalog(...args);}},fetch(){throw Error('Unexpected network');},removeEventListener(){},
  setInterval(fn,delay){const id=++sequence;intervals.set(id,{fn,delay,due:now+delay});return id;},clearInterval:id=>intervals.delete(id),
  MutationObserver:class{constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}observe(target){this.targets.add(target);}disconnect(){this.targets.clear();}},
  chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,connect(){counters.connects++;const port={sent:[],postMessage(message){this.sent.push(structuredClone(message));},onMessage:{addListener(fn){port.receive=fn;}},onDisconnect:{addListener(fn){port.drop=fn;}},disconnect(){counters.disconnects++;port.drop();}};ports.push(port);return port;}}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/ai-source.js'),'utf8'),sandbox);
 const options={container,getContext(){counters.contextReads++;return freshContext?structuredClone(ctx):ctx;},store,user,client:{profile:async()=>user,...client},demo,embedded};
 if(pdf)options.pdfHandoff={...pdfSelection,appearance:{theme:'light'}};
 const source=mount?sandbox.CanvasHarnessAISource.mount(options):sandbox.CanvasHarnessAISource.create(options);
 return {source,ctx,store,account,counters,ports,intervals,listeners,events,observers,frame,container,panel,body,dialog,host,handoff:options.pdfHandoff,
  get catalog(){return ports.at(-1)?.sent.filter(message=>message.kind==='catalog').at(-1)?.data;},
  visibility(value){document.hidden=value;for(const fn of events.get('visibilitychange')||[])fn();},
  mutate(target,key,value){target[key]=value;for(const observer of observers)if(observer.targets.has(target))observer.callback([{target,attributeName:key}]);},
  advance(ms){const end=now+ms;while(true){const entry=[...intervals].filter(([,timer])=>timer.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!entry)break;const [,timer]=entry;now=timer.due;timer.due+=timer.delay;timer.fn();}now=end;}};
}

for(const pdf of [false,true])test((pdf?'PDF':'Canvas')+' source sleeps while hidden and resumes without replaying collection',t=>{
 const f=pollingSource({pdf});t.after(()=>f.source.destroy());assert.equal(f.intervals.size,1);
 const stale=[...f.intervals.values()][0].fn;f.visibility(true);assert.equal(f.intervals.size,0);const before={...f.counters};
 f.ports[0].drop();f.advance(24000);stale();f.source.update();assert.deepEqual(f.counters,before);
 f.ctx.items[0].name='Changed while hidden';f.visibility(false);assert.equal(f.counters.connects,2);assert.equal(f.intervals.size,1);
 assert.equal(f.catalog.sources[0].title,pdf?'Chemistry.pdf \u00b7 pages 2\u20134':'Changed while hidden');
 f.visibility(false);assert.equal(f.intervals.size,1);f.advance(20400);assert.equal(f.ports[1].sent.at(-1).kind,'ping');assert.equal(f.ports[1].sent.some(message=>message.action==='collect'),false);
});

test('toolbox switching, collapsing, leaving, closing and shadow-host hiding pause source polling',t=>{
 const f=pollingSource({shadow:true});t.after(()=>f.source.destroy());
 for(const [target,key,hidden,shown]of [[f.panel,'hidden',true,false],[f.body,'hidden',true,false],[f.dialog,'dataset',{collapsed:'true'},{}],[f.dialog,'dataset',{leaving:'true'},{}],[f.dialog,'open',false,true],[f.host,'style',{visibility:'hidden'},{}]]){
  f.mutate(target,key,hidden);assert.equal(f.intervals.size,0);const before={...f.counters};f.advance(12000);f.source.update();assert.deepEqual(f.counters,before);
  f.ctx.items[0].name+='!';f.mutate(target,key,shown);assert.equal(f.catalog.active.title,f.ctx.items[0].name);assert.equal(f.intervals.size,1);
 }
 f.source.destroy();f.source.destroy();assert.equal(f.counters.disconnects,1);assert.equal(f.counters.unsubscribes,1);assert.equal(f.listeners.size,0);assert.equal(f.intervals.size,0);
 assert.equal(f.events.get('visibilitychange').size,0);assert.ok(f.observers.every(observer=>observer.targets.size===0));f.source.update();assert.equal(f.intervals.size,0);
});

for(const options of [{hidden:true},{panelHidden:true}])test('an initially hidden source does no context or connection work: '+JSON.stringify(options),t=>{
 const f=pollingSource(options);t.after(()=>f.source.destroy());assert.equal(f.intervals.size,0);assert.equal(f.counters.contextReads,0);assert.equal(f.counters.connects,0);
 f.visibility(false);f.mutate(f.panel,'hidden',false);assert.equal(f.intervals.size,1);assert.equal(f.catalog.active.title,'Lab');
});

test('fifty idle polls reuse parsing, account snapshot and serialization with replaced context wrappers',t=>{
 const f=pollingSource({freshContext:true});t.after(()=>f.source.destroy());f.advance(60000);
 assert.equal(f.counters.catalogs,1);assert.equal(f.counters.accountReads,1);assert.equal(f.counters.serializations,1);assert.equal(f.ports[0].sent.filter(message=>message.kind==='catalog').length,1);
 f.frame.handlers.get('load')();assert.equal(f.ports[0].sent.filter(message=>message.kind==='catalog').length,2);assert.equal(f.counters.serializations,1);
 f.ports[0].drop();f.advance(1200);assert.equal(f.ports.length,2);assert.equal(f.ports[1].sent[0].kind,'catalog');assert.equal(f.counters.serializations,1);
});

test('cached source inputs notice nested edits and fresh assignment overrides expire when Canvas changes',async t=>{
 const f=pollingSource({mount:false,demo:false,client:{readAssignment:async()=>({id:'1',name:'Fresh lab',description:'Fresh instructions'})}});t.after(()=>f.source.destroy());
 assert.equal(f.source.summary().active.title,'Lab');await f.source.collect({ids:['assignment:10:1'],includeAssignmentPdfs:false});assert.equal(f.source.summary().active.title,'Fresh lab');
 f.ctx.items[0].name='Revised Canvas lab';f.ctx.items[0].description='Revised instructions';assert.equal(f.source.summary().active.title,'Revised Canvas lab');
 const cases=[
  [()=>{f.ctx.items[0].rubric[0].description='Revised rubric';},summary=>assert.equal(summary.active.title,'Revised Canvas lab')],
  [()=>{f.ctx.aiResources[0].pages[0].title='Revised guide';},summary=>assert.equal(summary.sources.find(source=>source.id==='page:10:guide').title,'Revised guide')],
  [()=>{f.ctx.aiResources[0].files[0].size=500;},summary=>assert.equal(summary.sources.find(source=>source.id==='file:10:24').size,500)],
  [()=>{f.ctx.aiUpdates[0].announcements[0].title='Revised news';},summary=>assert.equal(summary.sources.find(source=>source.id==='announcement:10:8').title,'Revised news')],
  [()=>{f.ctx.aiResources[0].files[0].hidden_for_user=true;},summary=>assert.equal(summary.sources.some(source=>source.id==='file:10:24'),false)]
 ];
 for(const [mutate,check]of cases){const before=f.counters.catalogs;mutate();check(f.source.summary());assert.equal(f.counters.catalogs,before+1);f.source.summary();assert.equal(f.counters.catalogs,before+1);}
});

test('selection and subscribed preferences invalidate metadata without rereading the account',async t=>{
 const f=pollingSource();t.after(()=>f.source.destroy());const first=f.catalog.scopeKey;
 f.ctx.aiSelectedIds.splice(0,1,'page:10:guide');f.source.update();assert.deepEqual(f.catalog.selectedIds,['page:10:guide']);assert.notEqual(f.catalog.scopeKey,first);
 f.ctx.aiAssignmentId=null;f.ctx.s.motion='off';f.ctx.s.theme='dark';f.source.update();assert.equal(f.catalog.active,null);assert.equal(f.catalog.motion,'off');assert.equal(f.catalog.theme,'light','retain the 3.2 Canvas metadata contract');
 await f.store.update(data=>{data.toolbox.aiAutoSend=true;});f.advance(1200);assert.equal(f.catalog.autoSend,true);assert.equal(f.counters.accountReads,1);
 const fallback=pollingSource({mount:false,subscribe:false});t.after(()=>fallback.source.destroy());assert.equal(fallback.source.summary().autoSend,false);fallback.account.toolbox.aiAutoSend=true;assert.equal(fallback.source.summary().autoSend,true);
});

test('PDF metadata reuses serialization while appearance changes still publish',t=>{
 const f=pollingSource({pdf:true});t.after(()=>f.source.destroy());f.advance(60000);assert.equal(f.counters.serializations,1);
 f.handoff.appearance.theme='dark';f.source.update();assert.equal(f.catalog.theme,'dark');assert.equal(f.counters.serializations,2);f.advance(1200);assert.equal(f.counters.serializations,2);
});

test('toolbox embedding marks its iframe without changing its URL or source metadata',t=>{
 const standalone=pollingSource(),embedded=pollingSource({embedded:true});t.after(()=>{standalone.source.destroy();embedded.source.destroy();});
 assert.equal(standalone.frame.name,undefined);assert.equal(embedded.frame.name,'ch-toolbox-ai');assert.equal(embedded.frame.src,'chrome-extension://test/ai-panel.html');assert.deepEqual(embedded.catalog,standalone.catalog);
});
