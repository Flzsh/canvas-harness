'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {panelFixture,tick}=require('./study-fixture.cjs');

test('rubric assignment handoff selects only the requested item and opens rubric mode without sending',async t=>{
 const messages=[],ports=[],context={s:{},courseId:'10',aiAssignmentId:'1',aiSelectedIds:['assignment:10:1'],courses:[{id:'10',name:'English'}],items:[{id:'1',courseId:'10',name:'Quiz',description:'Earlier quiz'},{id:'2',courseId:'10',name:'Essay',description:'Rubric assignment'}]},frame={addEventListener(){},remove(){},focus(){}};
 const env=vm.createContext({URL,Date,Intl,Map,Set,Promise,document:{createElement:()=>frame},chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,connect(){const port={postMessage:m=>messages.push(m),onMessage:{addListener:fn=>port.receive=fn},onDisconnect:{addListener(){}},disconnect(){}};ports.push(port);return port;}}},fetch(){assert.fail('No network');},setInterval:()=>1,clearInterval(){},removeEventListener(){}});
 for(const file of ['ai-context.js','ai-source.js'])vm.runInContext(fs.readFileSync('extension/'+file,'utf8'),env,{filename:file});
 const source=env.CanvasHarnessAISource.mount({container:{append(){}},getContext:()=>context,store:{owner:{origin:'https://school.instructure.com',accountId:'7'},get:()=>({})},demo:true});t.after(()=>source.destroy());assert.equal(source.setStudy({kind:'rubric',itemId:'2'}),true);
 const catalog=messages.findLast(m=>m.kind==='catalog').data;assert.deepEqual(Array.from(catalog.selectedIds),['assignment:10:2']);assert.equal(catalog.active.assignmentId,'2');assert.equal(catalog.ponyStudy.kind,'rubric');
 const f=panelFixture({catalog});t.after(()=>f.close());await tick();assert.equal(f.controller.state.mode,'rubric');assert.deepEqual([...f.controller.state.selected],['assignment:10:2']);assert.match(f.get('ch-study-preview').textContent,/"kind":"rubric"/);assert.equal(f.requests.some(r=>r.action==='web'),false);assert.equal(f.copied.length,0);
 await f.controller.setMode('lab');f.controller.setCatalog(catalog);await tick();assert.equal(f.controller.state.mode,'lab');source.setStudy({kind:'rubric',itemId:'2'});f.controller.setCatalog(messages.findLast(m=>m.kind==='catalog').data);await tick();assert.equal(f.controller.state.mode,'rubric');
});
