'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {panelFixture,tick,Study}=require('./study-fixture.cjs');
function sourceFixture(){
 const context={s:{},courseId:'10',aiAssignmentId:'1',aiSelectedIds:['assignment:10:1'],courses:[{id:'10',name:'Chemistry'},{id:'20',name:'English'}],items:[{id:'1',courseId:'10',name:'Quiz 1',description:'Quiz instructions'},{id:'2',courseId:'20',name:'Lab 2',description:'Lab instructions'},{id:'3',courseId:'20',name:'Read chapter 3',description:'Reading instructions'}]},messages=[],ports=[],pending=new Map();let seq=0,network=0;
 const frame={addEventListener(){},remove(){},focus(){}},runtime={id:'test',getURL:p=>'chrome-extension://test/'+p,connect(){const port={postMessage:m=>{messages.push(m);if(pending.has(m.id)){const reply=pending.get(m.id);pending.delete(m.id);m.ok?reply.resolve(m.result):reply.reject(Error(m.error));}},onMessage:{addListener:fn=>port.receive=fn},onDisconnect:{addListener:fn=>port.drop=fn},disconnect(){}};ports.push(port);return port;}};
 const env=vm.createContext({URL,Date,Intl,Map,Set,Promise,console,document:{createElement:()=>frame},chrome:{runtime},fetch(){network++;throw Error('Unexpected network');},setInterval:()=>1,clearInterval(){},removeEventListener(){}});
 for(const file of ['ai-context.js','ai-source.js'])vm.runInContext(fs.readFileSync('extension/'+file,'utf8'),env,{filename:file});
 const mounted=env.CanvasHarnessAISource.mount({container:{append(){}},getContext:()=>context,store:{owner:{origin:'https://school.instructure.com',accountId:'7'},get:()=>({})},demo:true});
 return {context,mounted,messages,ports,get catalog(){return messages.findLast(m=>m.kind==='catalog').data;},get network(){return network;},request(action,data={}){return new Promise((resolve,reject)=>{const id='test-'+(++seq);pending.set(id,{resolve,reject});ports.at(-1).receive({...data,kind:'source-request',id,action});});}};
}
for(const [kind,itemId] of [['practice','1'],['lab','2'],['reading','3']])test('pony '+kind+' handoff opens that mode with only its item and leaves Send/Copy to the student',async t=>{
 const source=sourceFixture();t.after(()=>source.mounted.destroy());assert.equal(source.mounted.setStudy({kind,itemId}),true);
 const catalog=source.catalog;assert.deepEqual(Array.from(catalog.selectedIds),['assignment:'+(itemId==='1'?'10':'20')+':'+itemId]);assert.equal(catalog.active.assignmentId,itemId);
 const f=panelFixture({catalog,collect:data=>source.request('collect',data)});t.after(()=>f.close());await tick();
 assert.ok(f.controller.state.context,f.controller.state.error);assert.equal(f.controller.state.mode,kind);assert.deepEqual([...f.controller.state.selected],Array.from(catalog.selectedIds));
 assert.equal(f.controller.state.catalog.active.assignmentId,itemId);assert.equal(f.get('ch-study-preview').textContent,Study.build(kind,{level:'high school',course:catalog.active.courseName,item:catalog.active.title,due:'',sources:f.controller.state.context.sources,toolContext:{courseId:catalog.active.courseId,itemId:catalog.active.assignmentId,sources:Array.from(catalog.sources).filter(s=>catalog.selectedIds.includes(s.id)).map(s=>({id:s.id,courseId:s.courseId,title:s.title})),aids:[]}}));
 assert.equal(f.requests.some(r=>r.action==='web'||r.action==='native'),false);assert.equal(f.copied.length,0);assert.equal(source.network,0);
 const reply=await source.request('catalog');assert.equal(reply.ponyStudy.kind,kind);assert.deepEqual(Array.from(reply.selectedIds),Array.from(catalog.selectedIds));
});
test('missing study item clears old sources, attachments and saved viewer while keeping the requested mode',async t=>{
 const source=sourceFixture(),f=panelFixture({catalog:source.catalog,collect:data=>source.request('collect',data)});t.after(()=>{f.close();source.mounted.destroy();});await tick();
 f.controller.state.pdfs.push({id:'old',title:'Old PDF',text:'Stale words'});f.controller.state.currentAid={kind:'practice'};
 assert.equal(source.mounted.setStudy({kind:'reading',itemId:'missing'}),true);f.controller.setCatalog(source.catalog);await tick();
 assert.equal(f.controller.state.mode,'reading');assert.equal(f.controller.state.selected.size,0);assert.equal(f.controller.state.catalog.active,null);assert.equal(f.controller.state.pdfs.length,0);assert.equal(f.controller.state.currentAid,null);assert.doesNotMatch(f.get('ch-study-preview').textContent,/Stale words|Quiz instructions/);assert.equal(f.requests.some(r=>r.action==='web'),false);
});
test('study metadata is applied once; new requests, Ask and Canvas selection changes remain usable',async t=>{
 const source=sourceFixture(),f=panelFixture({catalog:source.catalog,collect:data=>source.request('collect',data)});t.after(()=>{f.close();source.mounted.destroy();});await tick();
 source.mounted.setStudy({kind:'lab',itemId:2});f.controller.setCatalog(source.catalog);await tick();await f.controller.setMode('reading');f.controller.setCatalog(await source.request('catalog'));await tick();assert.equal(f.controller.state.mode,'reading');
 source.mounted.setStudy({kind:'lab',itemId:2});f.controller.setCatalog(source.catalog);await tick();assert.equal(f.controller.state.mode,'lab');
 source.mounted.setQuestion('Explain pressure');f.controller.setCatalog(source.catalog);await tick();assert.equal(f.controller.state.mode,'ask');assert.equal(f.controller.state.draft,'Explain pressure');assert.equal(source.catalog.ponyStudy,undefined);
 source.mounted.setStudy({kind:'practice',itemId:'1'});source.context.aiSelectedIds=['assignment:20:3'];source.context.aiAssignmentId=null;source.mounted.update();assert.equal(source.catalog.ponyStudy,undefined);assert.deepEqual(Array.from(source.catalog.selectedIds),['assignment:20:3']);
 assert.equal(source.network,0);assert.equal(f.requests.some(r=>r.action==='web'),false);
});
test('study prefill rejects unknown modes and malformed item IDs and stops after destroy',()=>{
 const source=sourceFixture();for(const value of [{kind:'ask',itemId:'1'},{kind:'lab',itemId:''},{kind:'lab',itemId:{}},{kind:'lab',itemId:NaN},{kind:'lab',itemId:'x\n'},{kind:'lab',itemId:'x'.repeat(257)}])assert.equal(source.mounted.setStudy(value),false);
 assert.equal(source.catalog.ponyStudy,undefined);source.mounted.destroy();assert.equal(source.mounted.setStudy({kind:'practice',itemId:'1'}),false);assert.equal(source.network,0);
});

test('saved aid handoff opens the viewer after account storage loads and refreshes an already open panel',async t=>{
 const {storage,reading}=require('./study-fixture.cjs'),UI=require('../extension/study-ui.js'),saved=storage(),source=sourceFixture();t.after(()=>source.mounted.destroy());
 const key='reading:1',storeKey=UI.storageKey(source.catalog.scopeKey);saved.saved[storeKey]={[key]:{kind:'reading',itemId:'1',courseId:'10',title:'Saved guide',data:reading(),progress:{}}};
 assert.equal(source.mounted.openAid(key),true);assert.equal(source.catalog.openAid.key,key);
 const f=panelFixture({catalog:source.catalog,storage:saved,collect:data=>source.request('collect',data)});t.after(()=>f.close());await tick();assert.equal(f.controller.state.currentAidKey,key);assert.equal(f.get('ch-study-viewer').hidden,false);assert.match(f.get('ch-study-viewer').textContent,/Saved guide/);
 f.controller.closeAid();f.controller.setCatalog(await source.request('catalog'));await tick();assert.equal(f.controller.state.currentAid,null,'the same catalog does not reopen a closed aid');
 saved.saved[storeKey][key].title='Updated guide';source.mounted.openAid(key);f.controller.setCatalog(source.catalog);await tick();assert.equal(f.controller.state.currentAid.title,'Updated guide');
 source.mounted.setQuestion('Ask again');assert.equal(source.catalog.openAid,undefined);source.mounted.openAid('reading:missing');f.controller.setCatalog(source.catalog);await tick();assert.match(f.controller.state.error,/no longer available/);
 assert.equal(f.requests.some(r=>r.action==='web'),false);assert.equal(f.copied.length,0);assert.equal(source.network,0);source.mounted.destroy();assert.equal(source.mounted.openAid(key),false);
});
