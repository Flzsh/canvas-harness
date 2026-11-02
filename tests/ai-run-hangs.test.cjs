'use strict';
// AI plan step 6: no run hangs and every stop button works. A sleeping AI tab is waited for only while the AI's own record
// can still answer; a closed tab splits by what was sent; nothing is sent twice on its own; a usage limit ends Help with
// what is made; Canvas signed out or silent asks for Canvas; coming back from the AI's tab looks once.
const {test}=require('node:test'),assert=require('node:assert/strict');
const Delivery=require('../extension/ai-delivery-web.js'),Runner=require('../extension/ai-runner.js'),turnId='turn-5c0a1b2d-e3f4';
const URLS={chatgpt:'https://chatgpt.com/',gemini:'https://gemini.google.com/app'},CHAT='https://chatgpt.com/c/6adff4f1-c5cc-83ea';
const inspectTurn=()=>{},readStudyBlock=()=>{};
async function deliver({tab,receipt,provider='chatgpt',now=100000,exec}={}){
 const calls=[],chrome={permissions:{contains:async()=>true},storage:{session:{get:async()=>({}),set:async()=>{}},local:{get:async()=>({})}},tabs:{get:async id=>{if(!tab)throw Error('No tab with id: '+id);return {id,status:'complete',...tab};},update:async()=>({})},scripting:{executeScript:async o=>{calls.push(o.func===readStudyBlock?'read':o.args?.[0]?.mode||'inspect');return exec?exec(o):[{result:{status:'ready'}}];}}};
 const url=URLS[provider],d=Delivery.create({chrome,fetch:async()=>({ok:false}),inject:{inspectTurn,readStudyBlock},providers:{get:()=>({url,origins:[new URL(url).origin+'/*']})},now:()=>now,scriptTimeout:20});
 const saved=[],run={provider,kind:'ask',scope:'s',sourceTab:1,turns:[{id:turnId,text:'x',expectedKind:'prepare',deliveryReceipt:receipt}],turnIndex:0,lease:{epoch:1}};
 const result=await d.deliver(run.turns[0],async r=>{saved.push(r);},{run,guard:async()=>{},claimProvider:async()=>{}});return {result,calls,saved};
}
const at=(status,extra={})=>({v:1,tabId:5,origin:'https://chatgpt.com',conversationURL:CHAT,status,at:1000,...extra});

test('a frozen tab with no record CH can read stops at once, without running a page script',async()=>{
 const {result,calls}=await deliver({provider:'gemini',tab:{url:URLS.gemini,frozen:true},receipt:{v:1,tabId:5,origin:'https://gemini.google.com',conversationURL:URLS.gemini,status:'staged',at:99000}});
 assert.equal(result.status,'needs-you');assert.equal(result.needsYou.action,'Open chat');assert.equal(result.needsYou.asleep,true);assert.match(result.needsYou.reason,/asleep/);assert.deepEqual(calls,[]);
});

test('a frozen ChatGPT tab after the send keeps waiting for the chat record, then asks to read the reply after 30 minutes',async()=>{
 const sent=at('sent',{sentAt:50000});
 assert.equal((await deliver({tab:{url:CHAT,frozen:true},receipt:sent,now:200000})).result.status,'waiting');
 const late=await deliver({tab:{url:CHAT,frozen:true},receipt:sent,now:50000+31*60000});assert.equal(late.result.needsYou.action,'Read reply');
});

test('a page that never answers is waited for 60 s before the send, then the student is asked to open it',async()=>{
 const never=()=>new Promise(()=>{}),first=await deliver({tab:{url:URLS.chatgpt},receipt:at('target',{conversationURL:URLS.chatgpt,at:99000}),exec:never});
 assert.equal(first.result.status,'waiting');const since=first.saved.at(-1).asleepSince;assert.equal(since,100000);
 const later=await deliver({tab:{url:URLS.chatgpt},receipt:{...first.saved.at(-1)},exec:never,now:100000+61000});
 assert.equal(later.result.needsYou?.asleep,true);
 const awake=await deliver({tab:{url:URLS.chatgpt},receipt:at('staged',{conversationURL:URLS.chatgpt,asleepSince:5000,at:1000}),now:300000});
 assert.equal(awake.saved[0].asleepSince,0);assert.equal(awake.saved[0].at,300000,'awake again: the composer limits start over');assert.ok(awake.calls.includes('click'),'and the draft is sent');
});

test('a closed chat tab: before the send it is tried once more; after it the record is waited for a while; otherwise the student decides',async()=>{
 const before=await deliver({tab:null,receipt:at('target',{conversationURL:URLS.chatgpt})});assert.equal(before.result.needsYou.action,'Try again');assert.notEqual(before.result.needsYou.manual,true);
 assert.equal((await deliver({tab:null,receipt:at('sent',{sentAt:50000}),now:50000+4*60000})).result.status,'waiting');
 const quiet=await deliver({tab:null,receipt:at('sent',{sentAt:50000}),now:50000+6*60000});assert.deepEqual([quiet.result.needsYou.reason,quiet.result.needsYou.action,quiet.result.needsYou.manual],['The AI tab was closed','Try again',true]);
 assert.equal((await deliver({tab:null,receipt:at('sent',{sentAt:50000,begunAt:60000}),now:50000+20*60000})).result.status,'waiting','the AI had begun');
 assert.equal((await deliver({tab:null,receipt:at('send-intent',{intentAt:99000})})).result.needsYou.manual,true,'unsure whether it was sent: never resent on its own');
});

test('the AI site\'s words: a passing fault gets the fresh try, a usage limit stops with the AI\'s own sentence',async()=>{
 const said=reply=>o=>o.func===readStudyBlock?[{result:reply}]:[{result:{status:'sent'}}];
 const fault=await deliver({tab:{url:CHAT},receipt:at('sent',{sentAt:99000}),exec:said({status:'provider-error',message:'Something went wrong'})});
 assert.equal(fault.result.needsYou.action,'Try again');assert.notEqual(fault.result.needsYou.manual,true);
 const limit=await deliver({tab:{url:CHAT},receipt:at('sent',{sentAt:99000}),exec:said({status:'provider-error',message:'You\'ve reached',limit:true,text:'You\'ve reached your limit. Try again after 5:00 PM.'})});
 assert.deepEqual([limit.result.needsYou.limit,limit.result.needsYou.manual,limit.result.needsYou.said],[true,true,'You\'ve reached your limit. Try again after 5:00 PM.']);
});

function runner(needsYou,{made=[]}={}){
 const r=Runner.create({canvas:{reader:()=>({cache:new Map(),read:async x=>({id:x.id,text:'x'})}),validate:async()=>{}},results:{saveCards:async(run,cards)=>cards.length},account:{get:()=>({settings:{timeZone:'UTC'},toolbox:{}}),sync:async()=>{}},adapter:{deliver:async()=>({status:'needs-you',receipt:{status:'sent'},needsYou})},now:()=>0,uuid:()=>'u'});
 const run={id:'run-h',kind:'ask',provider:'chatgpt',mode:'prepare',phase:'deliver',state:'awaiting-reply',picks:[{ref:'A1',make:'auto'},{ref:'A2',make:'auto'}],pickIndex:made.length,made,retries:0,refs:{A1:{id:'1',courseId:'2',title:'Essay'},A2:{id:'3',courseId:'2',title:'Lab report'}},snapshot:{index:[],brief:{text:''}},turns:[{id:'t1',text:'p',messages:[]}],turnIndex:0,messages:[{role:'user',content:'p'}],errors:[],settings:{}};
 return {r,run,ctx:{save:async x=>x,guard:async()=>{},signal:new AbortController().signal}};
}

test('a closed tab never sends again on its own: the pick is left out with its reason and the next one is made',async()=>{
 const f=runner({reason:'The AI tab was closed',action:'Try again',manual:true});await f.r.step(f.run,f.ctx);
 assert.equal(f.run.turns.length,1,'no automatic fresh chat');assert.equal(f.run.pickIndex,1);assert.deepEqual(f.run.notMade,[{title:'Essay',reason:'The AI tab was closed.'}]);
});

test('a usage limit ends Help with the cards made and says why in the AI\'s words; with nothing made the student decides',async()=>{
 const limit={reason:'You\'ve reached',action:'Try again',manual:true,limit:true,said:'You\'ve reached your limit.'};
 const some=runner(limit,{made:[{card:{kind:'outline'},pick:{ref:'A1'}}]});await some.r.step(some.run,some.ctx);
 assert.equal(some.run.stopNote,'ChatGPT stopped: You\'ve reached your limit.'.replace('ChatGPT',(globalThis.CanvasHarnessProviders?.get?.('chatgpt')?.label)||'Your AI'));assert.equal(some.run.pickIndex,2);
 await some.r.step(some.run,some.ctx);assert.equal(some.run.state,'publishing');assert.equal(some.run.cardCount,1);
 const none=runner(limit);await none.r.step(none.run,none.ctx);assert.equal(none.run.state,'needs-you');assert.equal(none.run.needsYou.action,'Try again');assert.equal(none.run.turns.length,1);
});

test('Canvas silent for 2 minutes, or signed out, asks the student to refresh Canvas, and the run can go on from there',async()=>{
 const Store=require('../extension/ai-run-store.js'),Engine=require('../extension/ai-engine.js'),{fakeIndexedDB}=require('./fake-indexeddb.cjs');let clock=Date.parse('2026-11-02T16:00:00Z'),code='canvas-page-unavailable';
 const store=Store.create({indexedDB:fakeIndexedDB(),now:()=>clock}),engine=Engine.create({store,authorize:async()=>{throw Object.assign(Error('Canvas is not answering.'),{code});},runnerFor:async()=>({step:async()=>({waiting:true})}),now:()=>clock,schedule:()=>{},notify:async()=>{}});
 const start=id=>store.start({scope:'https://canvas.example|7',day:'2026-11-02',sourceTab:1,settings:{dailyCap:3},id,triggerKey:'ask:'+id.slice(-6),kind:'ask',question:'Help'});
 const a=await start('run-wait1');await engine.execute(a.id);let r=await store.get(a.id);assert.equal(r.progress,'Waiting for Canvas');assert.equal(r.state,'queued');
 clock+=3*60e3;await engine.execute(a.id);r=await store.get(a.id);assert.deepEqual([r.state,r.needsYou.action,r.needsYou.canvas],['needs-you','Refresh Canvas',true]);
 code='canvas-signed-out';const b=await start('run-wait2');await engine.execute(b.id);r=await store.get(b.id);assert.deepEqual([r.state,r.progress,r.needsYou.action],['needs-you','Canvas signed you out','Refresh Canvas']);
});

test('after Open chat, coming back to Canvas looks at the chat once; a click the worker cannot act on says why',async()=>{
 const Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js'),{dom,storage,descendants}=require('./study-fixture.cjs');
 const d=dom(),host=new d.Element('div'),sent=[],doc=d.document,heard=new Map();doc.addEventListener=(name,fn)=>heard.set(name,fn);doc.removeEventListener=()=>{};let reply={ok:true};const env={document:doc,chrome:{runtime:{sendMessage:async m=>{if(m.op!=='subscribe')sent.push(m);return reply;},onMessage:{addListener(){},removeListener(){}}},storage:{local:storage()}},matchMedia:()=>({matches:false})};
 const view=Band.renderBand(host,{},{env,scope:'https://canvas.test|7',store:UI.createStore(env),timeZone:'UTC',now:()=>0,onProgress:()=>{},onPrepare:async()=>null});await view.loaded;
 const button=descendants(host).find(n=>String(n.className||'').includes('ch-prepare-action'));
 view.prepare({id:'run-1',state:'needs-you',revision:1,entry:'band',needsYou:{reason:'Review the chat composer',action:'Review draft',at:Date.now()}});
 button.fire('click');await new Promise(r=>setImmediate(r));assert.deepEqual(sent.map(m=>m.op),['open']);
 doc.visibilityState='visible';const back=()=>heard.get('visibilitychange')();back();await new Promise(r=>setImmediate(r));
 assert.deepEqual(sent.map(m=>[m.op,m.look===true]),[['open',false],['resume',true]],'one look on return');
 back();await new Promise(r=>setImmediate(r));assert.equal(sent.length,2,'once per click');
 reply={ok:false,error:'Open the chat from your AI\'s site.'};button.fire('click');await new Promise(r=>setImmediate(r));
 assert.match(descendants(host).find(n=>String(n.className||'').includes('ch-prepare-status')).textContent,/Open the chat from your AI's site\./);
});
