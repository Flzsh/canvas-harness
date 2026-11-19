'use strict';
// Gemini's chat box (owner 2026-11-18: "check for AI daily's gemini, I think gemini might have a trouble for the script
// that needs some optimization"). Measured on the real page that day, signed out and signed in: the box keeps the first
// 32,000 characters typed into it and drops the rest without a word, and Send stays on. Daily AI help's "make the card"
// message can be about 45,000 characters, so on Gemini it was cut, the run stopped with "The editor did not keep the
// inserted text", and the cut-off draft left in the box blocked every later try. These tests hold the answer:
// one number for the box; a message is fitted to it before it is typed; a message that cannot fit is not typed at all
// and is said as that; a site that cuts a message without Canvas Harness knowing its box gets its box emptied again;
// Daily AI help's picks are read as a finished reply at once; a sent message gets longer to show on a slow page.
// Nothing here contacts a real site (the pages are tests/ai-sites-fixture.cjs).
const {test}=require('node:test'),assert=require('node:assert/strict');
const Inject=require('../extension/ai-inject.js'),Providers=require('../extension/ai-providers.js'),Guard=require('../extension/ai-guard.js');
const Web=require('../extension/ai-delivery-web.js'),Runner=require('../extension/ai-runner.js'),Study=require('../extension/study-prompts.js');
const {SITES,IDS,page}=require('./ai-sites-fixture.cjs');
const T0=Date.parse('2026-11-18T15:00:00Z'),scope='https://school.instructure.com|7',plain=v=>JSON.parse(JSON.stringify(v));
const memory=()=>{const data={};return {data,get:async k=>({[k]:structuredClone(data[k])}),set:async v=>{for(const [k,val]of Object.entries(v))data[k]=structuredClone(val);}};};
const words=n=>{let out='Sample notes (made up).';for(let i=1;out.length<n;i++)out+='\n- Line '+i+': the rate of a reaction depends on concentration, temperature and surface area.';return out.slice(0,n);};
const draft=(p,text,extra={})=>p.run(Inject.insertDraft,[text,{id:p.id,origin:new URL(p.url).origin,expectedURL:p.url,autoSend:false,...extra}]);

test('one number for Gemini\'s chat box: the provider list, the page code and the test page agree on 32,000',async()=>{
 assert.equal(Providers.get('gemini').box,32000);
 for(const p of Providers.list)if(p.id!=='gemini')assert.equal(p.box,undefined,p.id+': no box is recorded for a site that took a full message');
 assert.equal(SITES.gemini.box,32000,'the test page cuts where the real one does');
 // ai-inject.js is serialized into the page on its own, so it carries its own copy: read through what it does, on a
 // page that would itself keep any length
 const under=page('gemini',{box:1e9}),over=page('gemini',{box:1e9});
 assert.equal((await draft(under,words(31000))).status,'injected');
 assert.deepEqual(plain(await draft(over,words(32000))),{status:'no-editor',message:'This is longer than this AI website’s chat box holds (32,000 characters), so nothing was typed. Send less, or choose another AI.',tooLong:true,box:32000});
 assert.equal(over.typed(),'','nothing typed');
});

test('a message longer than Gemini\'s box is never typed, so no cut-off draft is left to block the next try',async()=>{
 const p=page('gemini'),long=await draft(p,words(45000),{turnId:'turn-box-1'});
 assert.equal(long.status,'no-editor');assert.equal(long.tooLong,true);assert.equal(p.typed(),'');
 // the next, shorter message goes in as usual: nothing of the long one is in the way
 const next=await draft(p,words(20000),{turnId:'turn-box-2'});
 assert.equal(next.status,'injected');assert.ok(p.typed().includes('[[Canvas Harness agent turn-box-2]]')&&p.typed().includes('[[End Canvas Harness context '));
 // every other site still takes a long message
 for(const id of IDS.filter(id=>id!=='gemini'))assert.equal((await draft(page(id),words(45000))).status,'injected',id);
});

test('a site that cuts a message without Canvas Harness knowing its box: what was typed is taken out again and said as that',async()=>{
 const p=page('kimi',{box:5000}),cut=plain(await draft(p,words(9000),{turnId:'turn-cut-1'}));
 assert.deepEqual(cut,{status:'no-editor',message:'This AI website kept only the start of the message: its chat box holds less than this. Nothing is left in the box. Send less, or choose another AI.',tooLong:true,cut:true});
 assert.equal(p.typed(),'','the box is empty again');
 // the student's own words in the box are never taken out with it
 const own=page('kimi',{box:5000});own.composer().textContent='my own half-written question';
 const kept=await draft(own,words(9000));
 assert.equal(kept.status,'no-editor');assert.notEqual(kept.cut,true);assert.ok(own.typed().startsWith('my own half-written question'));
});

test('Daily AI help\'s first reply, its picks, is read as finished at once; a reply in plain words still waits to settle',async()=>{
 const read=p=>p.run(Inject.readStudyBlock,[{id:'gemini',origin:'https://gemini.google.com',kind:'prepare',after:0,answerId:'a1'}]);
 const picks='{"picks":[{"ref":"A1","make":"test","focus":"rate laws","sources":[]}]}';
 const p=page('gemini',{url:SITES.gemini.chat});p.add(SITES.gemini.user('What should I prepare?'));p.reply('done','JSON\n'+picks);
 const got=await read(p);assert.equal(got.status,'answer');assert.equal(got.text,picks,'only the picks object is handed over');assert.equal(Study.parsePicks(got.text).ok,true);
 const prose=page('gemini',{url:SITES.gemini.chat});prose.add(SITES.gemini.user('What should I prepare?'));prose.reply('done','I could not decide today.');
 assert.equal((await read(prose)).status,'waiting');
 // while Gemini is still writing, nothing is taken
 const busy=page('gemini',{url:SITES.gemini.chat});busy.add(SITES.gemini.user('What should I prepare?'));busy.reply('streaming');
 assert.equal((await read(busy)).status,'generating');
});

test('a run fits each message to its AI website\'s box: Gemini 32,000 less the marker lines, any length elsewhere and with an API key',()=>{
 assert.equal(Runner.boxRoom({provider:'gemini',way:'web'}),31600);assert.equal(Runner.boxRoom({provider:'gemini'}),31600);
 assert.equal(Runner.boxRoom({provider:'gemini',way:'api'}),Infinity,'a run with the student\'s own API key types into no box');
 for(const id of IDS.filter(id=>id!=='gemini'))assert.equal(Runner.boxRoom({provider:id,way:'web'}),Infinity,id);
 // the deliverable's message: an assignment with a long reading
 const pages=Array.from({length:30},(_,i)=>'[Page '+(i+1)+']\n'+words(2000)).join('\n\n');
 const sources=[{label:'Assignment instructions',role:'instructions',text:words(5000)},{label:'Chapter 18.pdf',role:'file',text:pages,info:{totalPages:30}}],brief={label:'Canvas brief (dates, other work, teacher messages)',role:'brief',text:words(6000)};
 const build=list=>Study.buildDeliver('reading',{now:T0,timeZone:'America/New_York',level:'high school',item:'Sample History · Reading quiz',due:'Fri, Nov 20, 8:00 AM',focus:'railroads and trusts',sources:list,library:[],maxChars:42000,wishes:'',fix:'',avoid:''});
 const any=Runner.fitMessage({sources,brief,title:'Reading quiz',room:Infinity,build});
 assert.ok(any.content.length>32000,'as before, a full message is longer than Gemini\'s box ('+any.content.length+')');
 const gem=Runner.fitMessage({sources,brief,title:'Reading quiz',room:Runner.boxRoom({provider:'gemini'}),build});
 assert.ok(gem.content.length<=31600,'fitted to the box ('+gem.content.length+')');assert.ok(gem.content.length>24000,'and no smaller than it has to be ('+gem.content.length+')');
 assert.ok(gem.content.includes(sources[0].text),'the instructions are whole');
 const said=gem.list.find(s=>s.label==='Could not be read');assert.ok(said&&/Chapter 18\.pdf: pages .+ of 30 are here; the other pages are not in these materials\./.test(said.text),'what was cut is said to the AI');
 assert.equal(gem.list.at(-1).label,brief.label,'the brief still closes the materials');
 // with Canvas Harness's own marker lines around it, the message still fits the box
 assert.ok(gem.content.length+400<=Providers.get('gemini').box);
 // a short item is the same message on every site
 const short=[{label:'Assignment instructions',role:'instructions',text:words(1500)}];
 assert.equal(Runner.fitMessage({sources:short,brief,room:31600,build}).content,Runner.fitMessage({sources:short,brief,room:Infinity,build}).content);
});

test('a message written around the Canvas brief loses the brief\'s end, with the brief\'s own closing line, only when the box is too small',()=>{
 const brief=words(24000),ask=text=>Study.buildAsk({now:T0,timeZone:'America/New_York',level:'high school',question:'What should I study first?',focus:'',card:words(4000),brief:text,wishes:''});
 const whole=Runner.fitBrief(ask,brief,Infinity);assert.equal(whole,ask(brief));assert.ok(whole.length>31600,'a full question is longer than the box ('+whole.length+')');
 const fitted=Runner.fitBrief(ask,brief,31600);assert.ok(fitted.length<=31600,String(fitted.length));assert.ok(fitted.length>30000,'only what had to go is cut ('+fitted.length+')');assert.match(fitted,/\[brief cut short to fit\]/);
 const prepare=text=>Study.buildPrepare({now:T0,timeZone:'America/New_York',level:'high school',brief:text,wishes:''});
 assert.equal(Runner.fitBrief(prepare,brief,31600),prepare(brief),'Daily AI help\'s first message fits Gemini\'s box whole');
});

// The AI help road (ai-delivery-web.js) against Gemini's page, as the worker runs it.
function world(text){
 let clock=T0,next=40;const pages=new Map();
 const chrome={permissions:{contains:async()=>true},storage:{local:{get:async()=>({})},session:{get:async()=>({}),set:async()=>{}}},
  tabs:{get:async tid=>{if(tid===1)return {id:1,url:'https://school.instructure.com/courses/1',windowId:1,status:'complete'};const p=pages.get(tid);if(!p)throw Error('No tab with id: '+tid);return {id:tid,url:p.url,status:'complete',windowId:1};},
   create:async({url})=>{const tid=next++;pages.set(tid,page('gemini',{url}));return {id:tid,url,status:'complete',windowId:1};},update:async tid=>({id:tid,url:pages.get(tid).url,status:'complete',windowId:1})},
  windows:{get:async()=>({type:'normal'})},
  scripting:{executeScript:async({target,func,args})=>[{frameId:0,result:await pages.get(target.tabId).run(func,args)}]}};
 const web=Web.create({chrome,inject:Inject,providers:Providers,now:()=>clock,fetch:async()=>{throw Error('offline');},scriptTimeout:500,aiGuard:Guard.create({storage:memory(),now:()=>clock})});
 const turn={id:'turn-gemini-1',text,expectedKind:'prepare'},run={id:'run-gemini',provider:'gemini',kind:'prepare',scope,sourceTab:1,turnIndex:0,turns:[turn],lease:{epoch:1},settings:{}};
 return {turn,step:()=>web.deliver(turn,async r=>{turn.deliveryReceipt=r;},{run,guard:async()=>{},claimProvider:async()=>{}}),tab:()=>[...pages.values()][0],advance:ms=>{clock+=ms;}};
}

test('on the road: a message that cannot fit Gemini\'s box stops the run with plain words, nothing typed and nothing sent',async()=>{
 const w=world(words(40000)),r=await w.step();
 assert.equal(r.status,'needs-you');
 assert.deepEqual(plain(r.needsYou),{reason:'This is longer than Gemini\'s chat box holds (32,000 characters). Nothing was sent. Ask about less, or choose another AI in Your AI.',action:'Try again',manual:true});
 assert.equal(w.tab().typed(),'');assert.equal(w.tab().sendButton().clicks,0);
});

test('on the road: a page slow to show a sent message is waited for (45 s while it says nothing against it), and Send is never pressed twice',async()=>{
 const w=world('Make study notes for chapter 3.');
 let r=await w.step();assert.deepEqual([r.status,w.turn.deliveryReceipt.status],['waiting','staged']);
 // Gemini takes the click but shows nothing yet: the message is still in the box
 const button=w.tab().sendButton(),send=button.onclick;button.onclick=()=>{};
 r=await w.step();assert.equal(w.turn.deliveryReceipt.status,'send-intent');assert.equal(button.clicks,1);
 w.advance(16000);r=await w.step();assert.equal(r.status,'waiting','16 s on, the page still shows the staged message: not yet a failure');assert.equal(button.clicks,1);
 // the page catches up: the message is in the chat, and the run carries on to its reply
 send();r=await w.step();assert.deepEqual([r.status,w.turn.deliveryReceipt.status],['waiting','sent']);
 w.tab().reply('done','JSON\n{"picks":[]}');r=await w.step();assert.equal(r.status,'reply');assert.equal(r.reply,'{"picks":[]}');assert.equal(button.clicks,1);
 // a page that never shows it: said after 45 s, and nothing is sent again
 const never=world('Make study notes for chapter 3.');await never.step();never.tab().sendButton().onclick=()=>{};await never.step();
 never.advance(44000);assert.equal((await never.step()).status,'waiting');
 never.advance(2000);r=await never.step();assert.equal(r.status,'needs-you');assert.equal(r.needsYou.reason,'Send could not be confirmed. Review the chat');assert.equal(never.tab().sendButton().clicks,1);
});
