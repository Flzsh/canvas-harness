'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const UI=require('../extension/study-ui.js');
const {practice,storage,panelFixture,dom,button,tick}=require('./study-fixture.cjs');
const scope='https://school.instructure.com|7|c1|a',key='practice:a';
const order=()=>practice().items.map((_,i)=>i);
const completed=()=>({practice:{order:order(),at:10,answers:Object.fromEntries(order().map(i=>[i,{correct:![0,5,8].includes(i),choice:i<5?0:true}]))}});
const aid=(progress={})=>({v:1,kind:'practice',itemId:'a',courseId:'c1',title:'Saved practice',savedAt:1,data:practice(),progress});
function clock(value){let now=Number(value);return {Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},set:value=>{now=Number(value);}};}
async function mounted(t,{record=aid(),saved=storage(),catalog,now=new Date(2026,9,20,10),timer=clock(now)}={}){
 const store=UI.createStore({chrome:{storage:{local:saved}},Date:timer.Date});
 if(record)await store.save(catalog?.scopeKey||scope,record);
 const f=panelFixture({storage:saved,...(catalog?{catalog}:{})});f.env.Date=timer.Date;t.after(()=>f.close());await tick();
 return {...f,store,timer,host:f.get('ch-study-viewer'),read:async()=>((await store.list(catalog?.scopeKey||scope))[key])};
}
function answer(host,index,correct){
 if(index>=5&&index<8){button(host,'Show answer').fire('click');button(host,correct?'I had it':'Not yet').fire('click');}
 else button(host,index<5?(correct?'b':'a'):(correct?'False':'True')).fire('click');
}
async function finish(f,indices=order(),wrong=[]){for(const i of indices){answer(f.host,i,!wrong.includes(i));button(f.host,'Next').fire('click');}await tick();}
for(const [label,now,due]of [
 ['early morning',new Date(2026,9,20,2),new Date(2026,9,21,0)],
 ['late night',new Date(2026,9,20,23,30),new Date(2026,9,21,19,30)]
])test('completed misses persist the first review on the next local day and at least 20 h later: '+label,async t=>{
 const f=await mounted(t,{now});f.controller.openAid(key);
 for(let i=0;i<10;i++){answer(f.host,i,i!==0);if(i<9)button(f.host,'Next').fire('click');}
 await tick();assert.equal((await f.read()).review,undefined,'grading the last answer alone is not completion');
 button(f.host,'Next').fire('click');await tick();assert.deepEqual((await f.read()).review,{due:Number(due),step:0});
 f.timer.set(new Date(2026,9,24,12));f.controller.closeAid();f.controller.openAid(key);await tick();assert.deepEqual((await f.read()).review,{due:Number(due),step:0},'opening a completed viewer never moves its due date');
 await f.controller.saveProgress((await f.read()).progress);assert.deepEqual((await f.read()).review,{due:Number(due),step:0},'saving unchanged completion is idempotent');
 assert.equal(Object.keys(f.storage.saved).length,1);assert.equal(Object.keys(f.storage.saved[UI.storageKey(scope)]).length,1);
});
for(const [label,index]of [['multiple choice',0],['true/false',8],['short Not yet',5]])test(label+' misses schedule review',async t=>{
 const f=await mounted(t);f.controller.openAid(key);await finish(f,order(),[index]);assert.equal((await f.read()).review?.step,0);
});
test('a perfect initial set has no review, and correcting all misses clears an existing review',async t=>{
 const f=await mounted(t);f.controller.openAid(key);await finish(f);assert.equal((await f.read()).review,undefined);
 const record=aid(completed());record.review={due:Number(new Date(2026,9,20,9)),step:0};const g=await mounted(t,{record});
 g.controller.openAid(key,{missed:true});await tick();assert.deepEqual((await g.read()).progress.practice.order,[0,5,8]);
 await finish(g,[0,5,8]);assert.equal((await g.read()).review,undefined);
});
for(const step of [1,2])test('an all-correct scheduled round clears review at step '+step,async t=>{
 const record=aid(completed());record.review={due:Number(new Date(2026,9,20,9)),step};const f=await mounted(t,{record});f.controller.openAid(key,{missed:true});await finish(f,[0,5,8]);assert.equal((await f.read()).review,undefined);
});
test('three scheduled missed rounds advance by 3 then 7 local days and stop after the third',async t=>{
 const record=aid(completed());record.review={due:Number(new Date(2026,2,6,14)),step:0};
 const f=await mounted(t,{record,now:new Date(2026,2,6,14)});
 for(const [now,due,step]of [[new Date(2026,2,6,14),new Date(2026,2,9,14),1],[new Date(2026,2,9,14),new Date(2026,2,16,14),2],[new Date(2026,2,16,14),null,null]]){
  f.timer.set(now);f.controller.closeAid();assert.equal(f.controller.openAid(key,{missed:true}),true);await tick();
  assert.deepEqual((await f.read()).progress.practice.order,[0,5,8]);await finish(f,[0,5,8],[0,5,8]);
  assert.deepEqual((await f.read()).review,due?{due:Number(due),step}:{due:0,step:3});
 }
});
test('an exhausted third review stays exhausted after a failed manual retry or replayed missed handoff',async t=>{
 const record=aid(completed());record.review={due:Number(new Date(2026,9,20,9)),step:2};const f=await mounted(t,{record});
 f.controller.openAid(key,{missed:true});await finish(f,[0,5,8],[0,5,8]);assert.deepEqual((await f.read()).review,{due:0,step:3});
 const stopped=(await f.read()).progress;f.controller.closeAid();f.controller.openAid(key,{missed:true});await tick();assert.match(f.host.textContent,/Score: 0 \/ 3/);assert.deepEqual((await f.read()).progress,stopped,'the replay never re-marks or restarts the exhausted round');
 button(f.host,'Missed ones again').fire('click');await finish(f,[0,5,8],[0,5,8]);assert.deepEqual((await f.read()).review,{due:0,step:3});
 const progress=(await f.read()).progress,g=await mounted(t,{record:null,saved:f.storage,timer:f.timer});g.controller.openAid(key,{missed:true});await tick();assert.match(g.host.textContent,/Score: 0 \/ 3/);assert.deepEqual((await g.read()).progress,progress,'an exhausted manual retry also stays completed');
 button(g.host,'Missed ones again').fire('click');await finish(g,[0,5,8]);assert.equal((await g.read()).review,undefined,'an all-correct manual retry can clear exhaustion');
});
test('a manual missed retry clears review when correct without advancing a still-missed scheduled step',async t=>{
 const record=aid(completed());record.review={due:Number(new Date(2026,9,21,12)),step:1};const f=await mounted(t,{record});
 f.controller.openAid(key);button(f.host,'Missed ones again').fire('click');await finish(f,[0,5,8],[0]);
 assert.deepEqual((await f.read()).review,record.review);button(f.host,'Missed ones again').fire('click');await finish(f,[0]);assert.equal((await f.read()).review,undefined);
});

test('replayed missed handoffs cannot consume a future review after a failed manual retry',async t=>{
 const record=aid(completed());record.review={due:Number(new Date(2026,9,20,9)),step:0};const f=await mounted(t,{record});f.controller.openAid(key,{missed:true});await finish(f,[0,5,8],[0,5,8]);
 const due=Number(new Date(2026,9,23,10));assert.deepEqual((await f.read()).review,{due,step:1});button(f.host,'Missed ones again').fire('click');await finish(f,[0,5,8],[0,5,8]);
 f.controller.closeAid();f.controller.openAid(key,{missed:true});await tick();assert.match(f.host.textContent,/Score: 0 \/ 3/);assert.deepEqual((await f.read()).review,{due,step:1});
 const g=await mounted(t,{record:null,saved:f.storage,timer:f.timer});g.controller.openAid(key,{missed:true});await tick();assert.match(g.host.textContent,/Score: 0 \/ 3/);assert.deepEqual((await g.read()).review,{due,step:1});
 g.timer.set(due);g.controller.closeAid();g.controller.openAid(key,{missed:true});await tick();assert.match(g.host.textContent,/1 \/ 3/);await finish(g,[0,5,8],[0,5,8]);assert.deepEqual((await g.read()).review,{due:Number(new Date(2026,9,30,10)),step:2});
});

test('a persisted future review marker cannot advance the review before its due date',async()=>{
 const local=storage(),timer=clock(new Date(2026,9,20,10)),store=UI.createStore({chrome:{storage:{local}},Date:timer.Date}),record=aid(),due=Number(new Date(2026,9,23,10));record.review={due,step:1};await store.save(scope,record);const progress=completed();progress.practice.reviewRound={due,step:1};await store.progress(scope,key,progress);assert.deepEqual((await store.list(scope))[key].review,{due,step:1});
});
test('old completed aids open without scheduling and removed aids cannot be recreated by late progress',async t=>{
 const f=await mounted(t,{record:aid(completed())});const writes=f.storage.writes.length;f.controller.openAid(key);await tick();
 assert.match(f.host.textContent,/Score: 7 \/ 10/);assert.equal((await f.read()).review,undefined);assert.equal(f.storage.writes.length,writes);
 button(f.host,'Missed ones again').fire('click');await finish(f,[0,5,8],[0]);assert.equal((await f.read()).review.step,0);
 const progress=(await f.read()).progress;await f.controller.removeAid(key);await f.store.progress(scope,key,progress);assert.deepEqual(await f.store.list(scope),{});
});
test('an unfinished review resumes its exact order, answer and short draft after panel reload',async t=>{
 const record=aid(completed());record.review={due:Number(new Date(2026,9,20,9)),step:0};const f=await mounted(t,{record});
 f.controller.openAid(key,{missed:true});answer(f.host,0,false);button(f.host,'Next').fire('click');
 const input=f.nodes.findLast(n=>n.tagName==='TEXTAREA');assert.ok(input);input.value='Keep this draft';input.fire('input');await tick();
 const g=await mounted(t,{record:null,saved:f.storage,timer:f.timer});g.controller.openAid(key,{missed:true});await tick();
 const resumed=await g.read();assert.deepEqual(resumed.progress.practice.order,[0,5,8]);assert.equal(resumed.progress.practice.at,1);assert.equal(resumed.progress.practice.answers[0].correct,false);assert.equal(g.nodes.findLast(n=>n.tagName==='TEXTAREA').value,'Keep this draft');
 await finish(g,[5,8],[5,8]);assert.deepEqual((await g.read()).review,{due:Number(new Date(2026,9,23,10)),step:1});
});
test('ordinary Saved Open resumes the review marker, and missed-only requests preserve unfinished practice',async t=>{
 const record=aid(completed());record.review={due:Number(new Date(2026,9,20,9)),step:1};const f=await mounted(t,{record});f.controller.openAid(key,{missed:true});answer(f.host,0,false);button(f.host,'Next').fire('click');await tick();
 const g=await mounted(t,{record:null,saved:f.storage,timer:f.timer});g.controller.openAid(key);await finish(g,[5,8],[5,8]);assert.deepEqual((await g.read()).review,{due:Number(new Date(2026,9,27,10)),step:2});
 const h=await mounted(t);h.controller.openAid(key);answer(h.host,0,false);button(h.host,'Next').fire('click');await tick();h.controller.closeAid();h.controller.openAid(key,{missed:true});await tick();assert.match(h.host.textContent,/2 \/ 10/);assert.equal((await h.read()).progress.practice.answers[0].correct,false);assert.equal((await h.read()).review,undefined);
});
test('a completion with ungraded answers never invents misses or schedules review',async()=>{
 const local=storage(),store=UI.createStore({chrome:{storage:{local}}}),record=aid();await store.save(scope,record);
 await store.progress(scope,key,{practice:{order:order(),at:10,answers:{0:{draft:'Unmarked'}}}});assert.equal((await store.list(scope))[key].review,undefined);
});
function sourceFixture(){
 const context={s:{},courseId:'c1',aiAssignmentId:'a',courses:[{id:'c1',name:'Biology'}],items:[{id:'a',courseId:'c1',name:'Assignment A',description:'Instructions'}]},messages=[];
 const frame={addEventListener(){},remove(){},focus(){}};
 const env=vm.createContext({URL,Date,Intl,Map,Set,Promise,document:{createElement:()=>frame},chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,connect:()=>({postMessage:m=>messages.push(m),onMessage:{addListener(){}},onDisconnect:{addListener(){}},disconnect(){}})}},setInterval:()=>1,clearInterval(){},removeEventListener(){}});
 for(const file of ['ai-context.js','ai-source.js'])vm.runInContext(fs.readFileSync('extension/'+file,'utf8'),env,{filename:file});
 const source=env.CanvasHarnessAISource.mount({container:{append(){}},getContext:()=>context,store:{owner:{origin:'https://school.instructure.com',accountId:'7'},get:()=>({})},demo:true});
 return {source,get catalog(){return messages.findLast(m=>m.kind==='catalog').data;}};
}
test('source catalog hands missed-only options to the mounted panel once across catalog refresh and reload',async t=>{
 const source=sourceFixture();t.after(()=>source.source.destroy());source.source.openAid(key);assert.equal(Object.hasOwn(source.catalog.openAid,'missed'),false);
 source.source.openAid(key,{missed:true});assert.equal(source.catalog.openAid.missed,true);
 const record=aid(completed());record.review={due:Number(new Date(2026,9,20,9)),step:0};const f=await mounted(t,{record,catalog:source.catalog});
 assert.equal(f.controller.state.currentAidKey,key);assert.match(f.host.textContent,/1 \/ 3/);assert.deepEqual((await f.read()).progress.practice.order,[0,5,8]);
 f.controller.setCatalog(source.catalog);await tick();await finish(f,[0,5,8],[0,5,8]);const review=(await f.read()).review;assert.deepEqual(review,{due:Number(new Date(2026,9,23,10)),step:1});
 const g=await mounted(t,{record:null,saved:f.storage,catalog:source.catalog,timer:f.timer});assert.match(g.host.textContent,/Score: 0 \/ 3/);assert.deepEqual((await g.read()).review,review,'replayed handoff does not restart or consume the completed review');
 source.source.openAid(key,{missed:true});f.timer.set(new Date(2026,9,23,10));g.controller.setCatalog(source.catalog);await tick();assert.match(g.host.textContent,/1 \/ 3/);await finish(g,[0,5,8],[0,5,8]);assert.deepEqual((await g.read()).review,{due:Number(new Date(2026,9,30,10)),step:2});
 source.source.openAid(key,{missed:true});f.timer.set(new Date(2026,9,30,10));g.controller.setCatalog(source.catalog);await tick();await finish(g,[0,5,8],[0,5,8]);assert.deepEqual((await g.read()).review,{due:0,step:3});
 const h=await mounted(t,{record:null,saved:f.storage,catalog:source.catalog,timer:f.timer});assert.match(h.host.textContent,/Score: 0 \/ 3/);assert.deepEqual((await h.read()).review,{due:0,step:3});assert.equal(h.requests.some(r=>r.action==='web'||r.action==='native'),false);assert.equal(h.copied.length,0);
});
test('viewer progress callbacks persist completion scheduling through the store without panel-specific hooks',async()=>{
 const local=storage(),timer=clock(new Date(2026,9,20,10)),env={...dom(),Date:timer.Date,chrome:{storage:{local}}},store=UI.createStore(env),record=aid(),host=env.document.createElement('div');
 await store.save(scope,record);UI.renderViewer(host,record,{env,onProgress:progress=>store.progress(scope,key,progress)});
 const f={host};await finish(f,order(),[0]);assert.deepEqual((await store.list(scope))[key].review,{due:Number(new Date(2026,9,21,6)),step:0});
});
