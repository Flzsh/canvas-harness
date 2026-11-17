'use strict';
// AI help on every AI website it offers, not only ChatGPT (owner 2026-11-16: "Not only Gemini, other AI too"; earlier:
// "I can not stop it from working", "it does not work if gpt is not logged in", "I triggered too much gpt and it
// constantly make me log out", a laptop asleep mid-run). Job S's fixes were written around ChatGPT; these tests hold
// them for ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen and Z.ai, on hand-written pages (ai-sites-fixture.cjs):
// a signed-out site is noticed before anything is typed and named, with a way back to it and to another AI; a usage
// limit is said as that, not left as a hang; the caps apply per site and in total; Stop closes what it opened; a
// sleeping tab sends nothing again. Nothing here contacts a real site.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Inject=require('../extension/ai-inject.js'),Providers=require('../extension/ai-providers.js'),Guard=require('../extension/ai-guard.js');
const Web=require('../extension/ai-delivery-web.js'),Store=require('../extension/ai-run-store.js'),Engine=require('../extension/ai-engine.js');
const {fakeIndexedDB}=require('./fake-indexeddb.cjs');
const {SITES,IDS,page}=require('./ai-sites-fixture.cjs');
const ext=path.join(__dirname,'..','extension'),source=f=>fs.readFileSync(path.join(ext,f),'utf8');
const pinned=/\^https:\\\/\\\/([a-z0-9-]+)\\\.instructure\\\.com\\\|/.exec(source('ai-engine.js'));
const scope='https://'+(pinned?pinned[1]:'school')+'.instructure.com|7',T0=Date.parse('2026-11-16T15:00:00Z');
const memory=()=>{const data={};return {data,get:async k=>({[k]:structuredClone(data[k])}),set:async v=>{for(const [k,val]of Object.entries(v))data[k]=structuredClone(val);}};};
const label=id=>Providers.get(id).label,plain=v=>JSON.parse(JSON.stringify(v));

test('the fixtures cover every AI website the product offers, and each site\'s start page is the one AI help opens',()=>{
 assert.deepEqual(IDS,Providers.list.map(p=>p.id),'one page set per provider in ai-providers.js');
 for(const p of Providers.list){const away={chatgpt:'?temporary-chat=true',claude:'?incognito'}[p.id]||'';assert.equal(SITES[p.id].start,p.url+away,p.id);}
});

test('the page reading is one piece of code: insertDraft and pageState carry the same siteSigns, word for word',()=>{
 const text=source('ai-inject.js'),copies=[...text.matchAll(/function siteSigns\(\)\{[\s\S]*?\n\s*return \{state:box\?'ready':'unknown'\};\n\s*\}/g)].map(m=>m[0].split('\n').map(l=>l.trim()).join('\n'));
 assert.equal(copies.length,2);assert.equal(copies[0],copies[1],'change one, change both');
});

test('every site: signed in, signed out and at its limit are told apart from the page alone',async()=>{
 const want={chatgpt:'control',claude:'address',gemini:'control',grok:'control',deepseek:'address',kimi:'control',qwen:'address',zai:'control'};
 for(const id of IDS){
  assert.deepEqual(plain(await page(id).run(Inject.pageState,[{id}])),{state:'ready'},id+' signed in');
  assert.deepEqual(plain(await page(id,{state:'out'}).run(Inject.pageState,[{id}])),{state:'signed-out',by:want[id]},id+' signed out');
  const limit=await page(id,{state:'limit'}).run(Inject.pageState,[{id}]);
  assert.equal(limit.state,'limit',id+' at its limit');assert.ok(limit.said.length>10&&limit.said.length<=300,id+': the site\'s own words come back');
  assert.ok(!/summit|HTTP 429|Send|Stop/.test(limit.said),id+': only the notice is quoted, not the side bar or the buttons');
 }
});

test('never a false alarm: a chat titled "Log in", an answer saying "too many requests" and a student\'s own words are not read',async()=>{
 for(const id of IDS){
  const p=page(id),s=SITES[id];
  p.add(s.user('You\'ve reached the end of my notes. Log in'));p.add(s.assistant('Log in to Canvas first. Too many requests means the server is busy; you have reached the limit of what I know.'));
  assert.deepEqual(plain(await p.run(Inject.pageState,[{id}])),{state:'ready'},id);
  // another site's page is never read as this one
  assert.deepEqual(plain(await page(id,{state:'out'}).run(Inject.pageState,[{id:id==='chatgpt'?'claude':'chatgpt'}])),{state:'unknown'},id+' wrong origin');
 }
});

// The AI help road (ai-delivery-web.js) against one site's page, as the worker runs it.
function world(id,{state='in',session='unknown',guard}={}){
 let clock=T0,next=40;const pages=new Map(),created=[],fetchLog=[];
 const g=guard===undefined?Guard.create({storage:memory(),now:()=>clock}):guard;
 // ChatGPT's and Claude's own sign-in read: 'out', 'in', or 'unknown' (cannot tell, so the page decides).
 const fetch=async url=>{fetchLog.push(String(url));if(session==='unknown')throw Error('offline');
  if(url.endsWith('/api/auth/session'))return {ok:true,status:200,json:async()=>session==='out'?{}:{accessToken:'t'}};
  if(url.endsWith('/api/organizations'))return session==='out'?{ok:false,status:401,json:async()=>({})}:{ok:true,status:200,json:async()=>[]};
  return {ok:false,status:404,json:async()=>null};};
 const tabInfo=tid=>{const p=pages.get(tid);if(!p)throw Error('No tab with id: '+tid);return {id:tid,url:p.url,status:'complete',windowId:1,...(p.frozen?{frozen:true}:{})};};
 const chrome={permissions:{contains:async()=>true},storage:{local:{get:async()=>({})},session:{get:async()=>({}),set:async()=>{}}},
  tabs:{get:async tid=>tid===1?{id:1,url:'https://school.instructure.com/courses/1',windowId:1,status:'complete'}:tabInfo(tid),
   create:async({url})=>{const tid=next++;pages.set(tid,page(id,{state,url}));created.push(url);return tabInfo(tid);},
   update:async(tid,{url})=>{if(url)pages.set(tid,page(id,{state,url}));return tabInfo(tid);},remove:async tid=>{pages.delete(tid);}},
  windows:{get:async()=>({type:'normal'})},
  scripting:{executeScript:async({target,func,args})=>{const p=pages.get(target.tabId);if(!p)throw Error('No tab');return [{frameId:0,result:await p.run(func,args)}];}}};
 const web=Web.create({chrome,inject:Inject,providers:Providers,now:()=>clock,fetch,scriptTimeout:500,aiGuard:g});
 const turn={id:'turn-'+id+'-1',text:'Make study notes for chapter 3.',expectedKind:'prepare'};
 const run={id:'run-'+id,provider:id,kind:'ask',scope,sourceTab:1,turnIndex:0,turns:[turn],lease:{epoch:1},settings:{}};
 const step=()=>web.deliver(turn,async r=>{turn.deliveryReceipt=r;},{run,guard:async()=>{},claimProvider:async()=>{}});
 const tab=()=>[...pages.values()][0];
 return {step,turn,run,guard:g,created,fetchLog,pages,tab,
  signIn(){for(const [tid]of pages)pages.set(tid,page(id,{state:'in'}));},
  clicks:()=>[...pages.values()].reduce((n,p)=>n+(p.sendButton()?.clicks||0),0),
  advance:ms=>{clock+=ms;},get clock(){return clock;}};
}

test('every site, signed in: the draft is typed, sent once, the streaming answer is waited for and the done one is read',async()=>{
 for(const id of IDS){
  const w=world(id,{session:'in'});
  let r=await w.step();assert.deepEqual([r.status,w.turn.deliveryReceipt.status],['waiting','staged'],id+' typed');
  assert.ok(w.tab().typed().includes(w.turn.text)&&w.tab().typed().includes('[[Canvas Harness agent '+w.turn.id+']]'),id+': the message is in the chat box');
  r=await w.step();assert.equal(w.turn.deliveryReceipt.status,'send-intent',id);assert.equal(w.clicks(),1,id+': Send pressed once');
  w.tab().reply('streaming');r=await w.step();assert.deepEqual([r.status,w.turn.deliveryReceipt.status],['waiting','sent'],id+' streaming');
  w.tab().reply('done');r=await w.step();assert.equal(r.status,'reply',id+' done');assert.match(r.reply,/"cards"/);
  assert.equal(w.clicks(),1,id+': never sent twice');
  assert.equal((await w.guard.takeAutoRun(id,{dry:true})).ok,true,id);
 }
});

test('every site, signed out: noticed before anything is typed, said with the site\'s name, a way back to it and to another AI',async()=>{
 for(const id of IDS){
  const w=world(id,{state:'out'});
  let r=await w.step();
  // A Log in button alone is looked at twice, a moment apart: a page that is only starting is not called signed out.
  if(r.status==='waiting'){assert.ok(w.turn.deliveryReceipt.outSeenAt,id);w.advance(2500);r=await w.step();}
  assert.equal(r.status,'needs-you',id);
  assert.equal(r.needsYou.reason,'You are signed out of '+label(id)+'. Sign in there in this browser, then come back: this carries on. Or choose another AI in Your AI.',id);
  assert.equal(r.needsYou.action,'Open chat',id+': the band\'s button opens that site');
  assert.equal(w.tab().typed(),'',id+': nothing typed');assert.equal(w.clicks(),0,id+': nothing sent');
  assert.equal(w.run.provider,id,id+': the student\'s AI is not switched for them');
  assert.equal((await w.guard.takeAutoRun(id,{dry:true})).reason,'signed-out',id+': automatic help waits for this site');
  const other=id==='gemini'?'chatgpt':'gemini';assert.equal((await w.guard.takeAutoRun(other,{dry:true})).ok,true,id+': other sites are not held back');
  // Signed in there, back to Canvas: the same chat carries on, and its time limits start over from the sign-in.
  w.advance(10*60e3);w.signIn();r=await w.step();
  assert.deepEqual([r.status,w.turn.deliveryReceipt.status],['waiting','staged'],id+' carries on after signing in');
  assert.ok(w.tab().typed().includes(w.turn.text),id);
  assert.equal((await w.guard.takeAutoRun(id,{dry:true})).ok,true,id+': automatic help may start again');
 }
});

test('ChatGPT and Claude keep their sign-in read before any tab: signed out there, no tab opens at all',async()=>{
 for(const id of ['chatgpt','claude']){
  const w=world(id,{state:'out',session:'out'}),r=await w.step();
  assert.equal(r.status,'needs-you');assert.match(r.needsYou.reason,new RegExp('signed out of '+label(id)+'\\. Sign in there.*choose another AI'));
  assert.deepEqual(w.created,[],id+': no tab');assert.equal(w.fetchLog.length,1,id+': one read');
 }
});

test('a site that sends the tab to Google\'s, OpenAI\'s or X\'s sign-in page is signed out, before anything is typed',async()=>{
 const w=world('gemini');await w.step();const [tid]=[...w.pages.keys()];
 w.turn.deliveryReceipt={...w.turn.deliveryReceipt,status:'target'};w.pages.set(tid,{...w.tab(),get url(){return 'https://accounts.google.com/ServiceLogin?continue=https://gemini.google.com/app';}});
 const r=await w.step();assert.equal(r.status,'needs-you');assert.match(r.needsYou.reason,/signed out of Gemini/);
});

test('every site at its usage limit: said as that, in the site\'s own words, nothing typed, nothing sent, no fresh chat',async()=>{
 for(const id of IDS){
  const w=world(id,{state:'limit'}),r=await w.step();
  assert.equal(r.status,'needs-you',id);assert.deepEqual([r.needsYou.limit,r.needsYou.manual,r.needsYou.action],[true,true,'Try again'],id);
  assert.ok(r.needsYou.reason.startsWith(label(id)+' says: '),id+': '+r.needsYou.reason);assert.match(r.needsYou.reason,/Nothing was sent\. Try again later, or choose another AI in Your AI\.$/);
  assert.ok(r.needsYou.said.length>10,id);assert.equal(w.tab().typed(),'',id);assert.equal(w.clicks(),0,id);
  assert.equal((await w.guard.state()).sends.length,0,id+': nothing counted as sent');
 }
});

test('every site: a limit shown instead of a reply, after the send, is said at once, not after 30 minutes',async()=>{
 for(const id of IDS){
  const w=world(id,{session:'in'});await w.step();await w.step();assert.equal(w.clicks(),1,id);
  w.tab().reply('limit');const r=await w.step();
  assert.equal(r.status,'needs-you',id);assert.equal(r.needsYou.limit,true,id);assert.match(r.needsYou.reason,new RegExp('^'+label(id).replace(/[.()]/g,'\\$&')+' says: .*Nothing more was sent\\.'),id);
  assert.equal(w.clicks(),1,id+': nothing sent again');
 }
});

test('the runner never turns a sign-out or a limit into an automatic fresh chat',async()=>{
 const Runner=require('../extension/ai-runner.js');let clock=T0;
 for(const needsYou of [{reason:'You are signed out of Kimi.',action:'Open chat'},{reason:'Qwen says: limit.',action:'Try again',manual:true,limit:true,said:'limit'}]){
  let delivered=0;const adapter={deliver:async()=>{delivered++;return {status:'needs-you',receipt:{status:'target'},needsYou};}};
  const r=Runner.create({canvas:{reader:()=>null},results:{},account:{get:()=>({})},adapter,now:()=>clock,uuid:()=>'u'+Math.random().toString(36).slice(2)});
  const run={id:'run-r',state:'awaiting-reply',mode:'ask',phase:'ask',provider:'kimi',turnIndex:0,turns:[{id:'turn-a',text:'Hi',expectedKind:'prepare'}],errors:[]};
  await r.step(run,{save:async()=>{},guard:async()=>{},signal:new AbortController().signal,claimProvider:async()=>{},limits:Guard.LIMITS});
  assert.equal(run.state,'needs-you');assert.equal(run.turns.length,1,'no fresh chat');assert.equal(delivered,1);
 }
});

test('the caps apply per site and in total; a sign-out is remembered per site; an older record still reads',async()=>{
 let clock=T0;const limits={...Guard.LIMITS,sendsPerHour:4,sendsPerSitePerHour:2,sendsPerSitePerDay:3};
 const g=Guard.create({storage:memory(),now:()=>clock,limits});
 assert.equal((await g.takeSend('gemini')).ok,true);assert.equal((await g.takeSend('gemini')).ok,true);
 const site=await g.takeSend('gemini');assert.deepEqual([site.ok,site.reason],[false,'site-hour']);
 assert.equal(site.message,'Canvas Harness sent Gemini as many messages as it may this hour. Try again later, or choose another AI in Your AI.');
 assert.equal((await g.takeSend('deepseek')).ok,true,'another site still may');assert.equal((await g.takeSend('zai')).ok,true);
 const total=await g.takeSend('kimi');assert.deepEqual([total.ok,total.reason],[false,'sends-hour'],'all sites together are capped too');
 clock+=3601e3;assert.equal((await g.takeSend('gemini')).ok,true);const day=await g.takeSend('gemini');assert.equal(day.reason,'site-day');assert.match(day.message,/Gemini as many messages as it may today/);
 // By default each site may use the whole total (the owner may lower the per-site numbers in LIMITS).
 assert.ok(Guard.LIMITS.sendsPerSitePerHour<=Guard.LIMITS.sendsPerHour&&Guard.LIMITS.sendsPerSitePerDay<=Guard.LIMITS.sendsPerDay);
 const h=Guard.create({storage:memory(),now:()=>clock});await h.signedOut('gemini');await h.signedOut('kimi');
 assert.equal((await h.takeAutoRun('gemini',{dry:true})).reason,'signed-out');assert.equal((await h.takeAutoRun('kimi',{dry:true})).reason,'signed-out');
 assert.equal((await h.takeAutoRun('chatgpt',{dry:true})).ok,true);await h.signedIn('gemini');
 assert.equal((await h.takeAutoRun('gemini',{dry:true})).ok,true);assert.equal((await h.takeAutoRun('kimi',{dry:true})).reason,'signed-out','one site signing in does not clear another');
 const old=memory();old.data[Guard.KEY]={v:1,sends:[clock-1000],autoRuns:[],pausedUntil:0,pauseReason:'',signedOut:{provider:'chatgpt',at:clock-1000}};
 const o=Guard.create({storage:old,now:()=>clock});assert.equal((await o.takeAutoRun('chatgpt',{dry:true})).reason,'signed-out');assert.equal((await o.state()).sends.length,1);
});

test('every site: past its own cap nothing is sent and the run says which site, with the way to another AI',async()=>{
 for(const id of IDS){
  let clock=T0;const g=Guard.create({storage:memory(),now:()=>clock,limits:{...Guard.LIMITS,sendsPerSitePerHour:1}});await g.takeSend(id);
  const w=world(id,{guard:g});await w.step();const r=await w.step();
  assert.equal(r.status,'needs-you',id);assert.equal(r.needsYou.limit,true);assert.ok(r.needsYou.reason.includes('sent '+label(id)+' as many messages'),id);
  assert.equal(w.clicks(),0,id+': Send not pressed');void clock;
 }
});

test('every site: a tab asleep after the send sends nothing again; it waits for the record or asks to open it',async()=>{
 for(const id of IDS){
  const w=world(id,{session:'in'});await w.step();await w.step();w.tab().reply('streaming');await w.step();
  w.tab().frozen=true;w.advance(60e3);const r=await w.step();
  assert.ok(r.status==='waiting'||r.status==='needs-you'&&r.needsYou.asleep===true&&r.needsYou.action==='Open chat',id+': '+JSON.stringify(r.needsYou||r.status));
  assert.equal(w.clicks(),1,id+': nothing sent again');
 }
});

// Stop (and Your AI off) close the chat tabs their runs opened, on every site (ai-prepare.js closeChats).
function closer(tabs){
 const removed=[],onMessage={addListener(){}},captured={};const env=vm.createContext({URL,console,structuredClone,indexedDB:{},Date,
  chrome:{runtime:{id:'x',onMessage,getURL:f=>'chrome-extension://x/'+f},alarms:{onAlarm:{addListener(){}},clear:async()=>{},create:async()=>{}},
   storage:{onChanged:{addListener(){}},local:{get:async()=>({})}},tabs:{get:async id=>tabs[id]?{id,url:tabs[id]}:Promise.reject(Error('No tab')),remove:async id=>{removed.push(id);}},permissions:{contains:async()=>true}}});
 env.globalThis=env;env.CanvasHarnessRunStore={create:()=>({all:async()=>[],get:async()=>null}),terminal:()=>false};
 env.CanvasHarnessAIEngine={create:o=>{Object.assign(captured,o);return {recover:async()=>{},cancel:async()=>({})};},settingsKey:()=>''};env.ReserveAccountWrites={run:(k,fn)=>fn()};
 vm.runInContext(source('ai-prepare.js'),env,{filename:'ai-prepare.js'});
 env.CanvasHarnessPrepare.serve({api:null,pdf:null,requireFeature:async()=>{},verifyAccount:async()=>{},canvasSender:()=>true});
 return {close:runs=>captured.onStopped(runs),removed};
}
test('every site: Stop closes the tab at its start page, at the run\'s chat, and at the new chat a send just made; a tab taken elsewhere stays',async()=>{
 for(const id of IDS){
  const s=SITES[id],origin=new URL(s.start).origin,chat=s.chat||origin+'/c/abcdef123456',elsewhere=chat.replace(/[\w-]{6}\/?$/,'zzzzzz');
  const tabs={1:s.start,2:chat,3:chat,4:elsewhere,5:'https://example.org/'};
  const rc=(tabId,status,conversationURL,extra={})=>({tabId,origin,status,conversationURL,...extra});
  const runs=[{turns:[{deliveryReceipt:rc(1,'target',s.start)},{deliveryReceipt:rc(2,'sent',chat,{sentAt:Date.now()-600e3})},
   {deliveryReceipt:rc(3,'send-intent',s.start,{intentAt:Date.now()})},{deliveryReceipt:rc(4,'sent',chat,{sentAt:Date.now()})},{deliveryReceipt:rc(5,'target',s.start)}]}];
  const c=closer(tabs);await c.close(runs);
  assert.deepEqual(c.removed.sort(),[1,2,3],id);
 }
});

test('every site\'s chat address is known to "Open chat" and to Stop; start pages and ChatGPT\'s temporary local chat are not chats',()=>{
 const text=source('ai-prepare.js'),chatPath=new RegExp(/const chatPath=\/(.*)\/;/.exec(text)[1]);
 for(const id of IDS){if(SITES[id].chat)assert.ok(chatPath.test(new URL(SITES[id].chat).pathname),id);assert.ok(!chatPath.test(new URL(SITES[id].start).pathname),id+' start');}
 assert.ok(chatPath.test('/c/abcdef123456'));assert.match(text,/real=chatPath\.test\(p\)&&!\/\^\\\/c\\\/local-\/\.test\(p\)/);
});

test('every site: sleep and Continue work the same; a late look sends nothing new',async()=>{
 for(const id of IDS){
  let clock=T0;const had=Object.hasOwn(globalThis,'ReserveSite');if(!had)globalThis.ReserveSite={supported:()=>true};
  const store=Store.create({indexedDB:fakeIndexedDB(),now:()=>clock}),pending=[];
  const engine=Engine.create({store,now:()=>clock,schedule:(fn,ms)=>pending.push([fn,ms]),notify:async()=>{},aiGuard:Guard.create({storage:memory(),now:()=>clock}),
   authorize:async()=>({settings:{on:true,wishes:'',everyDay:true,dailyCap:9,provider:id,way:'web'}}),runnerFor:async()=>({step:async()=>({waiting:true})})});
  try{
   const a=await engine.start({id:'run-s'+id,scope,day:'2026-11-16',sourceTab:1,triggerKey:'ask:'+id,kind:'ask',question:'Help'});
   assert.equal(a.provider,id);await engine.execute(a.id);clock+=Guard.LIMITS.sleepGap+60e3;await engine.execute(a.id);
   const r=await store.get(a.id);assert.deepEqual([r.state,r.needsYou.action,r.needsYou.slept],['needs-you','Continue',true],id);
  }finally{await engine.dispose();if(!had)delete globalThis.ReserveSite;}
 }
});

// Tools > AI (ai-web.js): the panel's Send on every site.
function panel(id,{state='in'}={}){
 let clock=T0,next=100;const pages=new Map(),stored={};
 const tabInfo=tid=>{const p=pages.get(tid);if(!p)throw Error('Tab closed');return {id:tid,url:p.url,status:'complete',windowId:5,incognito:false};};
 const chrome={runtime:{id:'extension-id',getURL:p=>'chrome-extension://extension-id/'+p},storage:{session:{async get(key){return {[key]:structuredClone(stored[key])};},async set(v){Object.assign(stored,structuredClone(v));},async remove(k){delete stored[k];}}},
  permissions:{async contains(){return true;}},
  tabs:{async get(tid){if(tid===12)return {id:12,windowId:5,index:2,incognito:false};return tabInfo(tid);},async create(d){const tid=next++;pages.set(tid,page(id,{state,url:SITES[id].start}));void d;return tabInfo(tid);},
   async update(tid,d){if(d.url)pages.set(tid,page(id,{state,url:d.url}));return tabInfo(tid);}},
  windows:{async get(){return {id:5,type:'normal',incognito:false};},async update(){return {};}},
  scripting:{async executeScript({target,func,args}){return [{frameId:0,result:await pages.get(target.tabId).run(func,args)}];}}};
 class Clock extends Date{static now(){return clock;}}
 const context=vm.createContext({chrome,URL,Date:Clock,setTimeout:(fn,ms)=>{clock+=ms;queueMicrotask(fn);return 1;},console});
 context.importScripts=(...files)=>{for(const f of files)vm.runInContext(source(f),context);};vm.runInContext(source('ai-web.js'),context);
 const send=text=>context.CanvasHarnessWeb.handle({type:'ch-ai-web',action:'inject',provider:id,text},{id:'extension-id',tab:{id:12},frameId:0});
 return {send,page:()=>[...pages.values()][0]};
}
test('Tools > AI on every site: signed out or at its limit is said with the site\'s name and nothing is typed; signed in it types',async()=>{
 for(const id of IDS){
  const out=panel(id,{state:'out'}),r=await out.send('My question');
  assert.deepEqual([r.status,r.message],['no-editor','You are signed out of '+label(id)+'. Sign in there in this browser, then click Send again. Or choose another AI.'],id);
  assert.equal(out.page().typed(),'',id+': nothing typed');
  const limit=panel(id,{state:'limit'}),l=await limit.send('My question');
  assert.equal(l.status,'no-editor',id);assert.ok(l.message.startsWith(label(id)+' says: ')&&l.message.endsWith('Nothing was typed. Try again later, or choose another AI.'),id+': '+l.message);
  assert.equal(limit.page().typed(),'',id);
  const ok=panel(id),i=await ok.send('My question');assert.equal(i.status,'injected',id+': '+i.message);assert.ok(ok.page().typed().includes('My question'),id);
 }
});
