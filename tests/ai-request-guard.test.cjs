'use strict';
// AI help request limits, Stop, sign-out and sleep (extension/ai-guard.js and its hooks in the engine, runner,
// web delivery, worker and Help band). Owner reports 2026-11-14: Stop did not stop it, it did not work signed out of
// ChatGPT, so many requests that ChatGPT kept signing the owner out, and a laptop asleep mid-run ruined the run.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Guard=require('../extension/ai-guard.js'),Store=require('../extension/ai-run-store.js'),Engine=require('../extension/ai-engine.js');
const Web=require('../extension/ai-delivery-web.js'),Providers=require('../extension/ai-providers.js');
const {fakeIndexedDB}=require('./fake-indexeddb.cjs');
// A build pinned to one school's Canvas (its engine names the address) is tested on that address.
const pinned=/\^https:\\\/\\\/([a-z0-9-]+)\\\.instructure\\\.com\\\|/.exec(fs.readFileSync(path.join(__dirname,'..','extension','ai-engine.js'),'utf8'));
const scope='https://'+(pinned?pinned[1]:'school')+'.instructure.com|7',T0=Date.parse('2026-11-14T15:00:00Z');
const memory=()=>{const data={};return {data,get:async k=>({[k]:structuredClone(data[k])}),set:async v=>{for(const [k,val]of Object.entries(v))data[k]=structuredClone(val);}};};
const tick=()=>new Promise(r=>setImmediate(r));

test('the limits sit in one place and every one is a plain number or switch',()=>{
 for(const [k,v]of Object.entries(Guard.LIMITS))assert.ok(typeof v==='number'&&v>=0||typeof v==='boolean',k);
 assert.ok(Object.isFrozen(Guard.LIMITS));
 assert.ok(Guard.LIMITS.maxAutoRetries<=1&&Guard.LIMITS.autoRunsPerHour<=2&&Guard.LIMITS.recordReadEvery>=15000);
});

test('automatic runs: counted per hour and per day; a dry look counts nothing; a sign-out and pauses keep them off',async()=>{
 let clock=T0;const storage=memory(),g=Guard.create({storage,now:()=>clock});
 assert.equal((await g.takeAutoRun('chatgpt',{dry:true})).ok,true);
 assert.equal((await g.takeAutoRun('chatgpt',{dry:true})).ok,true,'a dry look takes nothing');
 assert.equal((await g.takeAutoRun('chatgpt')).ok,true);
 assert.deepEqual((await g.takeAutoRun('chatgpt')).reason,'hour');
 for(let i=0;i<Guard.LIMITS.autoRunsPerDay-1;i++){clock+=3601e3;assert.equal((await g.takeAutoRun('chatgpt')).ok,true);}
 clock+=3601e3;assert.equal((await g.takeAutoRun('chatgpt')).reason,'day');
 clock+=25*3600e3;assert.equal((await g.takeAutoRun('chatgpt',{dry:true})).ok,true,'a new day starts over');
 await g.signedOut('chatgpt');
 const out=await g.takeAutoRun('chatgpt',{dry:true});assert.equal(out.reason,'signed-out');assert.match(out.message,/signed out/i);
 assert.equal((await g.takeAutoRun('claude',{dry:true})).ok,true,'another AI site is not affected');
 await g.signedIn('chatgpt');assert.equal((await g.takeAutoRun('chatgpt',{dry:true})).ok,true);
 await g.pause('problem');assert.equal((await g.takeAutoRun('chatgpt',{dry:true})).reason,'paused');
 clock+=Guard.LIMITS.pauseAfterProblem+1;assert.equal((await g.takeAutoRun('chatgpt',{dry:true})).ok,true);
 await g.pause('stopped');const stopped=await g.takeAutoRun('chatgpt',{dry:true});assert.equal(stopped.reason,'paused');assert.match(stopped.message,/stopped for today/);
 clock=Guard.endOfDay(clock)+1;assert.equal((await g.takeAutoRun('chatgpt',{dry:true})).ok,true,'Stop lasts until the next day');
 assert.ok(storage.data[Guard.KEY],'kept in extension storage, so a restarted worker keeps the counts');
});

test('messages into the AI website are capped per hour and per day across every run',async()=>{
 let clock=T0;const g=Guard.create({storage:memory(),now:()=>clock});
 for(let i=0;i<Guard.LIMITS.sendsPerHour;i++)assert.equal((await g.takeSend()).ok,true);
 const hour=await g.takeSend();assert.equal(hour.ok,false);assert.match(hour.message,/this hour/);
 clock+=3601e3;let ok=0;while((await g.takeSend()).ok)ok++;
 assert.equal(ok+Guard.LIMITS.sendsPerHour,Guard.LIMITS.sendsPerDay>Guard.LIMITS.sendsPerHour*2?Guard.LIMITS.sendsPerHour*2:Guard.LIMITS.sendsPerDay);
 assert.equal(Guard.create({storage:memory(),now:()=>clock}).retryWait(2),Guard.LIMITS.retryWait*2,'each retry waits twice as long');
});

function engineWith({step,guard,onStopped=async()=>{},notify=async()=>{}}={}){
 let clock=T0;const had=Object.hasOwn(globalThis,'ReserveSite');if(!had)globalThis.ReserveSite={supported:()=>true};
 const store=Store.create({indexedDB:fakeIndexedDB(),now:()=>clock}),pending=[],aiGuard=guard===false?null:guard||Guard.create({storage:memory(),now:()=>clock});
 const settings={on:true,wishes:'',everyDay:true,dailyCap:9,provider:'chatgpt',way:'web'};
 const engine=Engine.create({store,now:()=>clock,schedule:(fn,ms)=>pending.push([fn,ms]),notify,onStopped,aiGuard,
  authorize:async()=>({settings}),runnerFor:async()=>({step:step||(async()=>({waiting:true}))})});
 let n=0;
 const visit=(extra={})=>engine.start({id:'run-v'+(++n),scope,day:'2026-11-14',sourceTab:1,triggerKey:'2026-11-14:'+n,...extra});
 const ask=(extra={})=>engine.start({id:'run-a'+(++n),scope,day:'2026-11-14',sourceTab:1,triggerKey:'ask:'+n,kind:'ask',question:'Help',...extra});
 return {engine,store,pending,aiGuard,visit,ask,get clock(){return clock;},advance:ms=>{clock+=ms;},restore(){if(!had)delete globalThis.ReserveSite;}};
}

test('an automatic run that fails pauses the next automatic one; a click still runs; a second automatic run in the hour is not started',async()=>{
 const e=engineWith({step:async()=>{throw Error('The AI site did not answer.');}});
 try{
  const a=await e.visit();await tick();await e.engine.execute(a.id);
  assert.equal((await e.store.get(a.id)).state,'failed');
  const next=await e.visit();assert.equal(next.skipped,'paused','a failed automatic run does not start again on the next Canvas visit');
  assert.equal((await e.store.all()).length,1,'no run is even made');
  const manual=await e.visit({entry:'manual'});assert.ok(manual.id,'the student\'s click is not paused');
 }finally{await e.engine.dispose();e.restore();}
 const f=engineWith({step:async(run,{save})=>{run.state='unchanged';await save(run);}});
 try{
  const a=await f.visit();await f.engine.execute(a.id);assert.equal((await f.store.get(a.id)).state,'unchanged');
  assert.equal((await f.visit()).skipped,'hour');
  f.advance(3601e3);assert.ok((await f.visit()).id);
 }finally{await f.engine.dispose();f.restore();}
});

test('one run at a time across Canvas tabs: a question waits for one at work, automatic help skips',async()=>{
 const e=engineWith();
 try{
  const a=await e.ask();assert.ok(a.id);await e.engine.execute(a.id);
  await assert.rejects(e.ask(),/still working on the last request/);
  assert.equal((await e.visit()).skipped,'busy');
  await assert.rejects(e.visit({entry:'manual'}),/still working/);
  assert.equal((await e.ask({id:a.id,triggerKey:a.triggerKey})).id,a.id,'the same request asked twice is the same run');
  // Two tabs asking at the same moment: the starts are taken one at a time.
  const both=await Promise.allSettled([e.ask(),e.ask()]);
  assert.equal(both.filter(r=>r.status==='fulfilled').length,0,'the first question is still at work');
  await e.engine.cancel(a.id);
  const [x,y]=await Promise.allSettled([e.ask(),e.ask()]);
  assert.deepEqual([x.status,y.status].sort(),['fulfilled','rejected']);
 }finally{await e.engine.dispose();e.restore();}
});

test('Stop ends every run of the account, closes their chats, clears the alarm and keeps automatic help off today',async()=>{
 const stopped=[],alarms=[];
 const e=engineWith({onStopped:async runs=>stopped.push(...runs.map(r=>r.id))});
 try{
  const a=await e.ask();await e.engine.execute(a.id);
  assert.ok(e.pending.length,'a look was set for later');
  const r=await e.engine.cancel(a.id,{pause:true,close:true});
  assert.equal(r.state,'cancelled');assert.deepEqual(stopped,[a.id]);
  for(const [fn]of e.pending.splice(0))await fn();
  await tick();
  assert.equal((await e.store.get(a.id)).state,'cancelled','a look set before Stop does nothing after it');
  assert.equal((await e.visit()).skipped,'paused','Daily AI help does not start on its own again today');
  assert.ok((await e.ask()).id,'the student can still ask');
 }finally{await e.engine.dispose();e.restore();}
 void alarms;
});

test('a look that comes long after it was due (the computer slept) sends nothing new: it stops with Continue, or only reads a reply already sent for',async()=>{
 const e=engineWith();
 try{
  const a=await e.ask();await e.engine.execute(a.id);
  let r=await e.store.get(a.id);assert.ok(r.nextLookAt,'the next look is written down');
  e.advance(Guard.LIMITS.sleepGap+60e3);await e.engine.execute(a.id);
  r=await e.store.get(a.id);
  assert.deepEqual([r.state,r.needsYou.action,r.needsYou.slept],['needs-you','Continue',true]);assert.match(r.needsYou.reason,/went to sleep/);
  assert.equal(r.retries,Guard.LIMITS.maxAutoRetries,'no automatic retry after waking');
 }finally{await e.engine.dispose();e.restore();}
 const f=engineWith({step:async(run,{save})=>{
  if(!run.turns.length){run.turns.push({id:'turn-1',text:'x',expectedKind:'prepare',deliveryReceipt:{status:'sent',sentAt:T0}});run.state='awaiting-reply';await save(run);}
  return {waiting:true};
 }});
 try{
  const a=await f.ask();await f.engine.execute(a.id);
  f.advance(Guard.LIMITS.sleepGap+60e3);await f.engine.execute(a.id);
  const r=await f.store.get(a.id);
  assert.equal(r.state,'awaiting-reply','a reply already asked for is still read');assert.ok(r.sleptAt);assert.equal(r.retries,Guard.LIMITS.maxAutoRetries);
 }finally{await f.engine.dispose();f.restore();}
 let slow;
 const g=engineWith({step:async(run,{save})=>{run.progress='Reading';slow();await save(run);return {waiting:true};}});
 try{
  slow=()=>g.advance(Guard.LIMITS.sleepGap+1);
  const a=await g.ask();await g.engine.execute(a.id);
  const r=await g.store.get(a.id);
  assert.deepEqual([r.state,r.needsYou.action],['needs-you','Continue'],'asleep in the middle of a step: it stops before going on');
 }finally{await g.engine.dispose();g.restore();}
});

test('without ai-guard.js the engine behaves as before (tests and older callers)',async()=>{
 const e=engineWith({guard:false});
 try{
  const a=await e.ask();await e.engine.execute(a.id);const b=await e.ask();assert.ok(b.id,'two questions at once, as before');
  assert.equal((await e.store.get(a.id)).nextLookAt,undefined);
 }finally{await e.engine.dispose();e.restore();}
});

test('the connection test looks every 1.5 s only in its first minute',async()=>{
 const e=engineWith();
 try{
  const a=await e.ask({check:true});await e.engine.execute(a.id);assert.equal(e.pending.at(-1)[1],1500);
  e.advance(61e3);e.pending.length=0;await e.engine.execute(a.id);assert.notEqual(e.pending.at(-1)[1],1500);
 }finally{await e.engine.dispose();e.restore();}
});

function delivery({session={accessToken:'t'},sessionStatus=200,tab,guard,fetchLog=[],page=null}={}){
 let clock=T0;const created=[];
 const fetch=async url=>{fetchLog.push(String(url));if(url.endsWith('/api/auth/session'))return {ok:sessionStatus===200,status:sessionStatus,json:async()=>session};return {ok:true,status:200,json:async()=>({})};};
 const chrome={permissions:{contains:async()=>true},storage:{local:{get:async()=>({})},session:{get:async()=>({}),set:async()=>{}}},
  tabs:{get:async id=>id===1?{id:1,url:'https://school.instructure.com/',windowId:1}:tab&&id===tab.id?tab:Promise.reject(Error('No tab')),create:async o=>{created.push(o);return {id:43,...o};},update:async(id,o)=>({id,...o})},
  windows:{get:async()=>({type:'normal'})},
  scripting:{executeScript:async({func,args})=>[{result:func(args[0])}]}};
 const clicks=[],inject={inspectTurn:a=>{if(a.mode==='click'){clicks.push(a);return {status:'waiting'};}return {status:'ready'};},insertDraft:()=>({status:'injected'}),readStudyBlock:()=>({status:'waiting'}),setEffort:()=>({ok:false})};
 const web=Web.create({chrome,inject:page||inject,providers:Providers,now:()=>clock,fetch,scriptTimeout:50,aiGuard:guard});
 return {web,created,clicks,fetchLog,advance:ms=>{clock+=ms;},get clock(){return clock;}};
}
const ctx={guard:async()=>{},claimProvider:async()=>{}};

test('signed out of ChatGPT: one plain message at once, no chat tab opened, nothing sent, automatic help waits',async()=>{
 let clock=T0;const g=Guard.create({storage:memory(),now:()=>clock}),d=delivery({session:{},guard:g});
 const run={id:'run-x',provider:'chatgpt',kind:'ask',scope,sourceTab:1,turnIndex:0,turns:[{id:'turn-1',text:'Hi',expectedKind:'prepare'}],consent:{}};
 const out=await d.web.deliver(run.turns[0],async()=>{},{run,...ctx});
 assert.equal(out.status,'needs-you');assert.match(out.needsYou.reason,/signed out of ChatGPT\. Sign in there/);assert.equal(out.needsYou.action,'Open chat');
 assert.deepEqual(d.created,[],'no tab opened');assert.deepEqual(d.fetchLog,['https://chatgpt.com/api/auth/session'],'one read only');
 assert.equal((await g.takeAutoRun('chatgpt',{dry:true})).reason,'signed-out');
 // Signed in again: the next try clears it and opens the chat.
 const back=delivery({guard:g});const run2={...run,turns:[{id:'turn-2',text:'Hi',expectedKind:'prepare'}]};
 await back.web.deliver(run2.turns[0],async()=>{},{run:run2,...ctx});
 assert.equal(back.created.length,1);assert.equal((await g.takeAutoRun('chatgpt',{dry:true})).ok,true);
 // A session read that cannot tell (Cloudflare, offline) changes nothing and the run goes on as before.
 const odd=delivery({session:[],guard:g});await odd.web.deliver({id:'turn-4',text:'Hi',expectedKind:'prepare'},async()=>{},{run:{...run,turns:[{id:'turn-4'}]},...ctx});
 assert.equal(odd.created.length,1,'an answer that is not the ChatGPT session is not read as signed out');
 const unsure=delivery({sessionStatus:403,guard:g});await unsure.web.deliver({id:'turn-3',text:'Hi',expectedKind:'prepare'},async()=>{},{run:{...run,turns:[{id:'turn-3'}]},...ctx});
 assert.equal(unsure.created.length,1);
 void clock;
});

test('the chat record is read at most once every 30 s for a message, not on every look',async()=>{
 const g=Guard.create({storage:memory()}),tab={id:42,url:'https://chatgpt.com/c/abcdef123456',frozen:true},d=delivery({tab,guard:g});
 const receipt={v:1,tabId:42,origin:'https://chatgpt.com',conversationURL:tab.url,status:'sent',sentAt:T0-20000},turn={id:'turn-9',text:'Hi',expectedKind:'prepare',deliveryReceipt:receipt};
 const run={id:'run-y',provider:'chatgpt',kind:'ask',scope,turnIndex:0,turns:[turn]},sessions=()=>d.fetchLog.filter(u=>u.endsWith('/api/auth/session')).length;
 assert.equal((await d.web.deliver(turn,async()=>{},{run,...ctx})).status,'waiting');assert.equal(sessions(),1);
 d.advance(10e3);await d.web.deliver(turn,async()=>{},{run,...ctx});assert.equal(sessions(),1,'not read again after 10 s');
 d.advance(Guard.LIMITS.recordReadEvery);await d.web.deliver(turn,async()=>{},{run,...ctx});assert.equal(sessions(),2);
 const old=delivery({tab}),before=old.fetchLog.length;await old.web.deliver({...turn,id:'turn-10'},async()=>{},{run,...ctx});await old.web.deliver({...turn,id:'turn-10'},async()=>{},{run,...ctx});
 assert.equal(old.fetchLog.slice(before).filter(u=>u.endsWith('/api/auth/session')).length,2,'without the guard it read on every look (the old behaviour)');
});

test('past the message cap nothing is typed or sent and the run stops with a plain reason',async()=>{
 const g=Guard.create({storage:memory()});for(let i=0;i<Guard.LIMITS.sendsPerHour;i++)await g.takeSend();
 const tab={id:42,url:'https://chatgpt.com/?temporary-chat=true',status:'complete'},d=delivery({tab,guard:g});
 const receipt={v:1,tabId:42,origin:'https://chatgpt.com',conversationURL:tab.url,status:'staged',at:T0},turn={id:'turn-5',text:'Hi',expectedKind:'prepare',deliveryReceipt:receipt};
 const run={id:'run-z',provider:'chatgpt',kind:'ask',scope,turnIndex:0,turns:[turn],lease:{epoch:1}};
 const out=await d.web.deliver(turn,async()=>{},{run,...ctx});
 assert.equal(out.status,'needs-you');assert.equal(out.needsYou.limit,true);assert.equal(out.needsYou.manual,true);assert.match(out.needsYou.reason,/as many messages as it may this hour/);
 assert.deepEqual(d.clicks,[],'Send was not clicked');
});

test('"Too many requests" from the AI website is a limit: nothing is sent again by itself',async()=>{
 const tab={id:42,url:'https://chatgpt.com/c/abcdef123456',status:'complete'},page={inspectTurn:()=>({status:'sent'}),readStudyBlock:()=>({status:'provider-error',message:'Too many requests'}),setEffort:()=>({ok:false})};
 const turn={id:'turn-7',text:'Hi',expectedKind:'prepare',deliveryReceipt:{v:1,tabId:42,origin:'https://chatgpt.com',conversationURL:tab.url,status:'sent',sentAt:T0}};
 const run={id:'run-t',provider:'chatgpt',kind:'ask',scope,turnIndex:0,turns:[turn]};
 const on=await delivery({tab,page,guard:Guard.create({storage:memory()})}).web.deliver(turn,async()=>{},{run,...ctx});
 assert.deepEqual([on.status,on.needsYou.manual,on.needsYou.limit],['needs-you',true,true]);
 const off=await delivery({tab,page}).web.deliver(turn,async()=>{},{run,...ctx});
 assert.equal(off.needsYou.manual,undefined,'without the guard: the old one automatic fresh chat');
});

test('the one automatic retry in a fresh chat waits first, longer each time',async()=>{
 const Runner=require('../extension/ai-runner.js');let clock=T0,delivered=0;
 const adapter={deliver:async()=>{delivered++;return {status:'needs-you',receipt:{status:'target'},needsYou:{reason:'Something went wrong',action:'Try again'}};}};
 const r=Runner.create({canvas:{reader:()=>null},results:{},account:{get:()=>({})},adapter,now:()=>clock,uuid:()=>'u'+Math.random().toString(36).slice(2)});
 const run={id:'run-r',state:'awaiting-reply',mode:'ask',phase:'ask',turnIndex:0,turns:[{id:'turn-a',text:'Hi',expectedKind:'prepare'}],errors:[]};
 const opts={save:async()=>{},guard:async()=>{},signal:new AbortController().signal,claimProvider:async()=>{},limits:Guard.LIMITS};
 await r.step(run,opts);assert.equal(run.turns.length,2);assert.equal(run.holdUntil,T0+Guard.LIMITS.retryWait);
 assert.deepEqual(await r.step(run,opts),{waiting:true});assert.equal(delivered,1,'nothing is sent while it waits');
 clock+=Guard.LIMITS.retryWait;await r.step(run,opts);assert.equal(delivered,2);
 assert.equal(run.state,'needs-you','after the one retry the student decides');
});

test('Help band: while help is being made its button is Stop and ends the run; after sleep it is Continue',async()=>{
 const Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js'),{dom,storage,descendants}=require('./study-fixture.cjs');
 const d=dom(),host=new d.Element('div'),sent=[],doc=d.document;doc.addEventListener=()=>{};doc.removeEventListener=()=>{};
 const env={document:doc,chrome:{runtime:{sendMessage:async m=>{if(m.op!=='subscribe')sent.push(m);return {ok:true};},onMessage:{addListener(){},removeListener(){}}},storage:{local:storage()}},matchMedia:()=>({matches:false})};
 const view=Band.renderBand(host,{},{env,scope,store:UI.createStore(env),timeZone:'UTC',now:()=>0,onProgress:()=>{},onPrepare:async()=>null});await view.loaded;
 const button=descendants(host).find(n=>String(n.className||'').includes('ch-prepare-action'));
 view.prepare({id:'run-1',state:'awaiting-reply',revision:1,entry:'band',phase:'ask',progress:'Asking your AI'});
 assert.equal(button.hidden,false);assert.equal(button.textContent,'Stop');
 button.fire('click');await tick();assert.deepEqual(sent.map(m=>[m.op,m.runId]),[['cancel','run-1']]);
 view.prepare({id:'run-1',state:'cancelled',revision:2,entry:'band',progress:'Stopped'});assert.equal(button.hidden,true,'nothing left running on the page');
 view.prepare({id:'run-2',state:'needs-you',revision:1,entry:'band',needsYou:{reason:'Your computer went to sleep',action:'Continue',at:Date.now()}});
 assert.equal(button.textContent,'Continue');button.fire('click');await tick();assert.deepEqual(sent.at(-1).op,'resume');
});

test('the worker loads the limits and uses them for every run, Stop and the off switch',()=>{
 const read=f=>fs.readFileSync(path.join(__dirname,'..','extension',f),'utf8');
 const bg=read('background.js'),imports=/importScripts\(([\s\S]*?)\);/.exec(bg)[1];
 assert.ok(imports.indexOf("'ai-guard.js'")>0&&imports.indexOf("'ai-guard.js'")<imports.indexOf("'ai-delivery-web.js'"),'ai-guard.js loads before the delivery and the engine');
 const prepare=read('ai-prepare.js');
 assert.match(prepare,/CanvasHarnessAIGuard\?\.create\(/);
 assert.match(prepare,/CanvasHarnessDeliveryWeb\.create\(\{aiGuard\}\)/);
 assert.match(prepare,/aiGuard,onStopped:closeChats/);
 assert.match(prepare,/engine\.cancel\(run\.id,\{pause:true,close:true\}\)/);
});
