'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Home=require('../extension/agent-home.js'),Client=require('../extension/agent-client.js'),Prompts=require('../extension/agent-prompts.js'),Planner=require('../extension/biscuit-planner.js'),Inject=require('../extension/ai-inject.js'),E=require('../extension/ui-utils.js').escapeHTML;
const origin='https://school.instructure.com',now=Date.parse('2026-10-22T16:00:00Z'),MIN=60000,clone=value=>structuredClone(value);
const items=()=>[{id:'2',name:'Chemistry lab',title:'Chemistry lab',courseId:'1',estimate:20,dueAt:'2026-10-23T16:00:00Z'},{id:'3',name:'Review definitions',title:'Review definitions',courseId:'1',kind:'review',estimate:20,dueAt:'2026-10-23T18:00:00Z'}];
function initial(){return {settings:{timeZone:'America/New_York',bedtime:'22:30'},tasks:{'2':{estimate:20,plannedDate:''},'3':{estimate:20,plannedDate:''}},customTasks:[],resourcePins:[],focus:{},toolbox:{agent:{settings:{on:true,way:'web',provider:'chatgpt',grades:false,dailyCap:3,wishes:''},runs:[],memory:[]}}};}
function storeFixture(value=initial()){
 let data=clone(value),updates=0;const listeners=new Set(),store={owner:{origin,accountId:'7'},get:()=>clone(data),sync:async()=>{},subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},async update(fn){const draft=clone(data);fn(draft);data=draft;updates++;for(const fn of listeners)fn(store.get());}};
 return {store,updates:()=>updates};
}
function makePlan(data=initial()){
 return Planner.build({now,timeZone:data.settings.timeZone,settings:data.settings,assignments:items(),local:data.tasks,courses:[{id:'1',name:'Chemistry'}],focus:data.focus,busy:[{start:now+50*MIN,end:now+55*MIN}]},{minutes:60});
}
const blocks=plan=>plan.blocks.map(({itemId,start,end})=>({itemId,start,end}));
const envelope=reply=>'```chagent\n'+JSON.stringify({v:1,actions:[],...reply})+'\n```';
async function settle(){for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));}
async function until(check){for(let i=0;i<50&&!check();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(check(),'the mocked provider was reached');}

function clientFixture(t,options={}){
 const data=initial(),plan=makePlan(data);data.toolbox.biscuitPlan=clone(plan);const f=storeFixture(data),trace=[],reads=[],context={now,courses:[{id:'1',name:'Chemistry',score:98,grade:'A'}],items:items(),studyAids:{}};
 const client=Client.create({store:f.store,user:{id:'7'},now:()=>now,url:()=>origin+'/',getContext:()=>context,planner:Planner,client:{async list(){reads.push('list');throw Error('Unexpected Canvas GET');},async profile(){reads.push('profile');throw Error('Unexpected Canvas GET');}},external:{async get(){reads.push('external');throw Error('Unexpected storage read');}},request:async message=>{trace.push(clone(message));return {ok:true,result:message.op==='turn'?{status:'answer',text:envelope({blocks:blocks(plan)})}:{}};},...options});
 t.after(()=>client.destroy());return {...f,client,trace,reads,context,plan};
}
function event(){const listeners=new Set();return {addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn),emit(...args){for(const fn of [...listeners])fn(...args);}};}
function backgroundFixture(store,answer){
 const accountKey='reserve:v1:'+origin+':7',trace=[],runtime={id:'test',getURL:file=>'chrome-extension://test/'+file,onConnect:event(),onMessage:event()},sender={id:'test',frameId:0,documentId:'plan-document',tab:{id:1},url:origin+'/'};
 const env={chrome:{runtime,storage:{onChanged:event(),local:{get:async key=>({[key]:key===accountKey?store.get():undefined})}},permissions:{contains:async()=>true},tabs:{get:async id=>({id,url:origin+'/'}),onRemoved:event(),onUpdated:event()}},ReserveFeatures:require('../extension/features.js'),ReserveSite:require('../extension/site.js'),CanvasHarnessProviders:require('../extension/ai-providers.js'),CanvasHarnessWeb:{forget(){},async handle(message,from,options){trace.push(clone(message));await options.beforeSend?.();if(message.action==='inject')return {status:'sent'};const self={},location=new URL('https://chatgpt.com/c/offline-plan'),assistant={textContent:answer,querySelectorAll:()=>[],contains:()=>false},document={querySelectorAll:selector=>{if(selector.startsWith('button[')||selector.startsWith('[role="alert"]'))return [];assert.equal(selector,'[data-turn="assistant"], [data-conversation-role="assistant"], [data-message-author-role="assistant"]');return [assistant];}};return vm.runInNewContext('('+Inject.readStudyBlock.toString()+')(guard)',{document,location,URL,self,top:self,guard:{id:message.provider,origin:location.origin,kind:message.studyKind,after:0}});}},importScripts(){},fetch:async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})}),URL,AbortController,AbortSignal,TextEncoder,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/background.js'),'utf8'),env);
 return {trace,request:message=>new Promise(resolve=>runtime.onMessage.emit(message,sender,resolve))};
}

test('local planning remains available without AI and Undo restores task fields',()=>{
 const data=initial();data.toolbox.agent.settings.on=false;const before=clone(data.tasks),result=Planner.apply(data,makePlan(data));assert.equal(result.ok,true);assert.ok(data.toolbox.biscuitPlan.blocks.length);assert.ok(data.tasks['2'].plannedDate);result.undo(data);assert.deepEqual(data.tasks,before);assert.equal(data.toolbox.biscuitPlan,undefined);
});

test('retired Home Today renderer and its planning callbacks are absent',()=>{
 assert.equal(Home.renderToday,undefined);const source=fs.readFileSync(require.resolve('../extension/agent-home.js'),'utf8');assert.doesNotMatch(source,/agent-plan|agent-improve-plan|agent-undo-plan|biscuit-today/);
});

test('strict plan parser unwraps transport JSON and rejects all tool actions and extra fields',()=>{
 const reply={blocks:blocks(makePlan())};assert.deepEqual(Prompts.parsePlan(envelope(reply)),{ok:true,reply});assert.deepEqual(Prompts.parsePlan(JSON.stringify(reply)),{ok:true,reply});
 for(const value of [envelope({...reply,actions:[{tool:'note',text:'Never apply'}]}),envelope({...reply,read:[]}),JSON.stringify({...reply,tool:'today'}),'I cannot help with that.',envelope({blocks:[{...reply.blocks[0],title:'injected'}]}),envelope({blocks:[{...reply.blocks[0],start:'2026-10-22T16:00:00Z'}]})])assert.equal(Prompts.parsePlan(value).ok,false,value);
});

test('client routes loaded context through begin/turn/finish and returns a validated plan without applying it',async t=>{
 const f=clientFixture(t),before=f.store.get(),result=await f.client.improvePlan(f.plan);await settle();
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.plan.improved,true);assert.deepEqual(blocks(result.plan),blocks(f.plan));assert.deepEqual(f.reads,[]);assert.deepEqual(f.store.get(),before);assert.equal(f.updates(),0);
 assert.deepEqual(f.trace.map(m=>m.op),['begin','turn','finish']);assert.equal(new Set(f.trace.map(m=>m.runId)).size,1);
 const turn=f.trace.find(m=>m.op==='turn');assert.equal(turn.kind,'agent');assert.equal(turn.automatic,false);assert.equal(turn.settings.provider,'chatgpt');assert.match(turn.text,/Chemistry lab/);assert.match(turn.text,/LOADED CONTEXT/);assert.match(turn.text,/"actions":\[\]/);assert.doesNotMatch(turn.text,/"grades"\s*:|"score"\s*:/);assert.equal(turn.messages[0].content,turn.text);
});

test('compatibility envelope survives the background route and the actual assistant selector offline',async t=>{
 const f=clientFixture(t),before=f.store.get(),background=backgroundFixture(f.store,envelope({blocks:blocks(f.plan)}));f.client.update({request:background.request});
 const result=await f.client.improvePlan(f.plan);await settle();assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.plan.improved,true);assert.deepEqual(blocks(result.plan),blocks(f.plan));assert.deepEqual(background.trace.map(m=>m.action),['inject','watch']);assert.ok(background.trace.every(m=>m.studyKind==='agent'&&m.provider==='chatgpt'));assert.deepEqual(f.reads,[]);assert.deepEqual(f.store.get(),before);assert.equal(f.updates(),0);
});

test('client respects the selected API connection without changing routes or preferences',async t=>{
 const f=clientFixture(t);await f.store.update(d=>{d.toolbox.agent.settings.way='api';});const before=f.store.get();assert.equal((await f.client.improvePlan(f.plan)).ok,true);assert.equal(f.trace.find(m=>m.op==='begin').settings.way,'api');assert.equal(f.trace.find(m=>m.op==='turn').settings.way,'api');assert.deepEqual(f.store.get(),before);
});

test('client retains grade opt-out and sends no local persistence records',async t=>{
 const f=clientFixture(t),secret='PRIVATE_GRADE_DERIVED_98_PERCENT';
 await f.store.update(d=>{d.toolbox.agent.gradeNotes=true;d.toolbox.scratchpad=secret;d.toolbox.agent.memory=[{id:'private-memory',fact:secret,about:'student',gradeAccess:true}];});
 f.context.studyAids={'notes:2':{kind:'notes',title:secret,itemId:'2',courseId:'1',gradeAccess:true}};f.plan.records={private:secret};
 assert.equal((await f.client.improvePlan(f.plan)).ok,true);const text=f.trace.find(m=>m.op==='turn').text;assert.doesNotMatch(text,/PRIVATE_GRADE_DERIVED_98_PERCENT|"records"\s*:/);assert.deepEqual(f.reads,[]);
});

test('plan snapshots require both AI grade consent and current grade visibility',async t=>{
 const f=clientFixture(t),secret='HIDDEN_GRADE_DERIVED_CONTENT';
 await f.store.update(d=>{d.settings.showGrades=false;const a=d.toolbox.agent;a.settings.grades=true;a.gradeNotes=true;d.toolbox.scratchpad=secret;a.memory=[{id:'grade-memory',fact:secret,about:'student',gradeAccess:true}];a.modules=[{id:'ai-grade-private',title:secret,why:secret,gradeAccess:true}];});
 f.context.studyAids={'notes:2':{kind:'notes',title:secret,itemId:'2',courseId:'1',gradeAccess:true}};const before=f.store.get();
 assert.equal((await f.client.improvePlan(f.plan)).ok,true);let text=f.trace.findLast(m=>m.op==='turn').text;assert.doesNotMatch(text,/HIDDEN_GRADE_DERIVED_CONTENT|"grades"\s*:|"score"\s*:/);assert.deepEqual(f.store.get(),before);
 await f.store.update(d=>{d.settings.showGrades=true;});f.context.s={showGrades:false};assert.equal((await f.client.improvePlan(f.plan)).ok,true);text=f.trace.findLast(m=>m.op==='turn').text;assert.doesNotMatch(text,/HIDDEN_GRADE_DERIVED_CONTENT|"grades"\s*:|"score"\s*:/);
 f.context.s.showGrades=true;f.context.showGrades=false;assert.equal((await f.client.improvePlan(f.plan)).ok,true);text=f.trace.findLast(m=>m.op==='turn').text;assert.doesNotMatch(text,/HIDDEN_GRADE_DERIVED_CONTENT|"grades"\s*:|"score"\s*:/);delete f.context.showGrades;
 assert.equal((await f.client.improvePlan(f.plan)).ok,true);text=f.trace.findLast(m=>m.op==='turn').text;assert.match(text,/"grades":\[\{"courseId":"1","score":98/);assert.match(text,/HIDDEN_GRADE_DERIVED_CONTENT/);assert.deepEqual(f.reads,[]);
});

test('grade-derived work cannot be sent while grade display is hidden',async t=>{
 const f=clientFixture(t);await f.store.update(d=>{d.settings.showGrades=false;d.toolbox.agent.settings.grades=true;d.toolbox.agent.gradePlans=[f.plan.blocks.find(b=>b.itemId).itemId];});const before=f.store.get(),result=await f.client.improvePlan(f.plan);
 assert.equal(result.ok,false);assert.match(result.error,/grade/);assert.equal(f.trace.length,0);assert.deepEqual(f.store.get(),before);assert.deepEqual(f.reads,[]);
});

test('client rejects invented IDs, busy overlaps, changed minutes and action payloads without side effects',async t=>{
 const f=clientFixture(t),before=f.store.get();
 const invalid=[{blocks:blocks(f.plan).map((b,i)=>i===0?{...b,itemId:'invented'}:b)},{blocks:blocks(f.plan).map((b,i)=>i===0?{...b,start:now+40*MIN,end:now+60*MIN}:b)},{blocks:blocks(f.plan).map((b,i)=>i===0?{...b,end:b.end+MIN}:b)},{actions:[{tool:'note',text:'Untrusted'}],blocks:blocks(f.plan)}];
 for(const value of invalid){f.client.update({request:async message=>{f.trace.push(message);return {ok:true,result:message.op==='turn'?{status:'answer',text:envelope(value)}:{}};}});const result=await f.client.improvePlan(f.plan);assert.equal(result.ok,false);assert.match(result.error,/invalid plan/);assert.deepEqual(f.store.get(),before);}
 assert.equal(f.updates(),0);
});

test('client AI off and an existing pending run return actionable errors without provider requests',async t=>{
 const f=clientFixture(t);await f.store.update(d=>{d.toolbox.agent.settings.on=false;});let before=f.store.get(),result=await f.client.improvePlan(f.plan);assert.equal(result.ok,false);assert.match(result.error,/Turn on Your AI/);assert.equal(f.trace.length,0);assert.deepEqual(f.store.get(),before);
 await f.store.update(d=>{d.toolbox.agent.settings.on=true;d.toolbox.agent.pending={runId:'previous',payload:'saved'};});before=f.store.get();result=await f.client.improvePlan(f.plan);assert.equal(result.ok,false);assert.match(result.error,/Finish or stop the pending/);assert.equal(f.trace.length,0);assert.deepEqual(f.store.get(),before);
});

test('client turns folder-pending, missing-tab, sign-in and refusal states into errors',async t=>{
 const f=clientFixture(t),before=f.store.get();
 for(const [answer,expected] of [[{pending:true},/folder reply/],[{pending:true,needsAllow:true},/Allow the prep folder/],[{status:'error',message:'No answer tab'},/Open your chosen AI website and sign in/],[{status:'no-editor'},/sign in/],[{status:'no-editor',message:'The chat is not ready. Finish signing in.'},/sign in/],[{status:'answer',text:'I cannot provide this plan.'},/invalid plan/]]){
  f.client.update({request:async message=>({ok:true,result:message.op==='turn'?answer:{}})});const result=await f.client.improvePlan(f.plan);assert.equal(result.ok,false);assert.match(result.error,expected);assert.deepEqual(f.store.get(),before);assert.equal(f.store.get().toolbox.agent.pending,undefined);
 }
});

test('client rejects an already replaced plan before acquiring the provider',async t=>{
 const f=clientFixture(t);await f.store.update(d=>{d.toolbox.biscuitPlan.id='newer-plan';});const before=f.store.get(),result=await f.client.improvePlan(f.plan);
 assert.equal(result.ok,false);assert.match(result.error,/plan changed/);assert.equal(f.trace.length,0);assert.deepEqual(f.store.get(),before);
});

test('plan synchronization cannot replace an absent saved plan or switch the loaded account unnoticed',async t=>{
 for(const change of ['saved-plan','account']){
  const f=clientFixture(t);if(change==='saved-plan')await f.store.update(d=>{delete d.toolbox.biscuitPlan;});let changed=false;
  f.store.sync=async()=>{if(changed)return;changed=true;if(change==='saved-plan')await f.store.update(d=>{d.toolbox.biscuitPlan={...clone(f.plan),id:'newly-saved-plan'};});else f.context.user={id:'8'};};
  const result=await f.client.improvePlan(f.plan);assert.equal(result.ok,false,change);assert.match(result.error,change==='account'?/original account/:/plan changed/);assert.equal(f.trace.length,0);assert.equal(f.updates(),change==='saved-plan'?2:0);
 }
});

test('freshness is checked again after the transport synchronization and before sending',async t=>{
 for(const change of ['plan','day','time-zone','grade-visibility','account']){
  const f=clientFixture(t);let began=false,syncs=0,changed=false;
  f.client.update({request:async message=>{f.trace.push(clone(message));if(message.op==='begin')began=true;return {ok:true,result:message.op==='turn'?{status:'answer',text:envelope({blocks:blocks(f.plan)})}:{}};}});
  f.store.sync=async()=>{if(!began||++syncs!==2)return;changed=true;if(change==='plan')await f.store.update(d=>{d.toolbox.biscuitPlan.id='changed-during-transport-sync';});else if(change==='day')f.client.update({now:()=>now+86400000});else if(change==='time-zone')await f.store.update(d=>{d.settings.timeZone='UTC';});else if(change==='grade-visibility')f.context.s={showGrades:true};else f.context.user={id:'8'};};
  const result=await f.client.improvePlan(f.plan);await settle();assert.equal(changed,true,change);assert.equal(result.ok,false,change);assert.equal(f.trace.some(m=>m.op==='turn'),false,change);assert.ok(f.trace.some(m=>m.op==='finish'),change);assert.deepEqual(f.reads,[]);
 }
});

test('planning settings, task changes and the loaded account invalidate late replies',async t=>{
 for(const change of ['bedtime','time-zone','grade-visibility','task','account','day']){
  const f=clientFixture(t,{planTimeoutMs:1000});let finish;
  f.client.update({request:async message=>({ok:true,result:message.op==='turn'?await new Promise(resolve=>{finish=resolve;}):{}})});const pending=f.client.improvePlan(f.plan);await until(()=>finish);
  if(change==='account')f.context.user={id:'8'};else if(change==='day')f.client.update({now:()=>now+86400000});else await f.store.update(d=>{if(change==='bedtime')d.settings.bedtime='21:00';else if(change==='time-zone')d.settings.timeZone='UTC';else if(change==='grade-visibility')d.settings.showGrades=true;else d.tasks['2'].estimate=35;});
  const before=f.store.get();finish({status:'answer',text:envelope({blocks:blocks(f.plan)})});const result=await pending;assert.equal(result.ok,false,change);assert.match(result.error,/settings changed|plan changed|original account/,change);assert.deepEqual(f.store.get(),before);
 }
});

test('client bounds an unresponsive provider, requests stop and allows the next improvement', {timeout:3000},async t=>{
 const f=clientFixture(t,{planTimeoutMs:15}),before=f.store.get();f.client.update({request:async message=>{f.trace.push(message);return message.op==='turn'?new Promise(()=>{}):{ok:true,result:{}};}});
 const result=await f.client.improvePlan(f.plan);await settle();assert.equal(result.ok,false);assert.match(result.error,/timed out/);assert.ok(f.trace.some(m=>m.op==='stop'));assert.ok(f.trace.some(m=>m.op==='finish'));assert.deepEqual(f.store.get(),before);
 f.client.update({planTimeoutMs:1000,request:async message=>({ok:true,result:message.op==='turn'?{status:'answer',text:envelope({blocks:blocks(f.plan)})}:{}})});assert.equal((await f.client.improvePlan(f.plan)).ok,true);
});

test('client deadline covers begin and storage synchronization; finish cannot hold the result open', {timeout:3000},async t=>{
 const f=clientFixture(t,{planTimeoutMs:15}),before=f.store.get();
 f.client.update({request:async message=>{f.trace.push(message);return message.op==='begin'?new Promise(()=>{}):{ok:true,result:{}};}});assert.match((await f.client.improvePlan(f.plan)).error,/timed out/);
 f.store.sync=()=>new Promise(()=>{});assert.match((await f.client.improvePlan(f.plan)).error,/timed out/);f.store.sync=async()=>{};
 f.client.update({planTimeoutMs:1000,request:async message=>{f.trace.push(message);return message.op==='finish'?new Promise(()=>{}):{ok:true,result:message.op==='turn'?{status:'answer',text:envelope({blocks:blocks(f.plan)})}:{}};}});assert.equal((await f.client.improvePlan(f.plan)).ok,true);assert.deepEqual(f.store.get(),before);
});

test('settings revocation and duplicate improvements stop late results without changing Today', {timeout:3000},async t=>{
 const f=clientFixture(t,{planTimeoutMs:1000});let finish;
 f.client.update({request:async message=>({ok:true,result:message.op==='turn'?await new Promise(resolve=>{finish=resolve;}):{}})});
 const pending=f.client.improvePlan(f.plan);await until(()=>finish);const duplicate=await f.client.improvePlan(f.plan);assert.equal(duplicate.ok,false);assert.match(duplicate.error,/Finish or stop the current/);
 await f.store.update(d=>{d.toolbox.agent.settings.on=false;});const expected=f.store.get();const result=await pending;assert.equal(result.ok,false);assert.match(result.error,/settings changed/);finish({status:'answer',text:envelope({blocks:blocks(f.plan)})});await settle();assert.deepEqual(f.store.get(),expected);
});

test('client refuses quiz pages, owner changes, stale plans and plans replaced while waiting',async t=>{
 const f=clientFixture(t);f.client.update({url:()=>origin+'/courses/1/quizzes/3/take'});assert.match((await f.client.improvePlan(f.plan)).error,/outside the quiz/);assert.equal(f.trace.length,0);
 f.client.update({url:()=>origin+'/'});f.store.owner.accountId='8';assert.match((await f.client.improvePlan(f.plan)).error,/original account/);assert.equal(f.trace.length,0);f.store.owner.accountId='7';
 const old=clone(f.plan);old.window.start-=86400000;assert.match((await f.client.improvePlan(old)).error,/fresh plan/);assert.equal(f.trace.length,0);
 let finish;f.client.update({request:async message=>({ok:true,result:message.op==='turn'?await new Promise(resolve=>{finish=resolve;}):{}})});const pending=f.client.improvePlan(f.plan);await until(()=>finish);await f.store.update(d=>{d.toolbox.biscuitPlan.id='newer-local-plan';});const expected=f.store.get();finish({status:'answer',text:envelope({blocks:blocks(f.plan)})});assert.match((await pending).error,/plan changed/);assert.deepEqual(f.store.get(),expected);
});
