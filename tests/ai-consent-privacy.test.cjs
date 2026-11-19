'use strict';
// Your AI sends nothing on its own until the student chooses Every day; the Canvas brief names only Inbox messages from
// teachers and TAs; teacher comments follow the Teacher feedback switch on every path and are never the student's own;
// the ChatGPT record read opens only the chat Canvas Harness started; the permission page says what really happens.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Actions=require('../extension/agent-actions.js'),Data=require('../extension/agent-data.js'),Client=require('../extension/agent-client.js'),Canvas=require('../extension/ai-canvas.js'),Web=require('../extension/ai-delivery-web.js'),Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js'),{createStore}=require('../extension/storage.js');
const {dom,storage,tick,descendants,button,panelFixture}=require('./study-fixture.cjs');
// The tree's own test school address, as its engine fixture names it.
const origin=/const origin='(https:\/\/[\w.-]+)'/.exec(fs.readFileSync(path.join(__dirname,'ai-engine-fixture.cjs'),'utf8'))[1],scope=origin+'|7';
const now=Date.parse('2026-10-21T16:00:00Z'),DAY=86400000,read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8'),answer='```chagent\n{"v":1,"actions":[]}\n```';

async function account(settings={}){
 const saved=new Map(),store=createStore({origin,accountId:'7',adapter:{read:async k=>structuredClone(saved.get(k)),write:async(k,v)=>saved.set(k,structuredClone(v))}});
 await store.load();
 await store.update(d=>{Actions.migrateSettings(d,{apiSettings:{},overnightSettings:{}});Object.assign(d.toolbox.agent.settings,settings);});
 return store;
}
function client(store,extra={}){
 const sent=[];let n=0;
 const c=Client.create({store,user:{id:'7'},engine:true,getContext:()=>({courses:[{id:'1',name:'Science'}],items:[]}),client:{},now:()=>now,url:()=>origin+'/',uuid:()=>'u'+(++n),
  external:{get:async()=>undefined,set:async()=>{}},
  request:async m=>{sent.push(m);return {ok:true,result:m.target==='ch-ai-engine'?{id:'run-'+n,state:'queued'}:m.op==='turn'?{status:'answer',text:answer}:{}};},...extra});
 return {c,sent};
}
const starts=sent=>sent.filter(m=>m.target==='ch-ai-engine'&&m.op==='start');

test('Prepare every day starts off, and settings saved before it existed come out off',()=>{
 assert.equal(Actions.state({}).settings.everyDay,false);
 const saved={toolbox:{agent:{settings:{on:true,way:'web',grades:false,dailyCap:3,wishes:'Short notes'},wayMigrated:true,runs:[]}}},s=Actions.migrateSettings(saved,{});
 assert.equal(s.everyDay,false);assert.equal(s.on,true);assert.equal(s.wishes,'Short notes');assert.equal(saved.toolbox.agent.everyDayChosen,undefined,'no choice is recorded for the student');
 assert.equal(Actions.migrateSettings({toolbox:{agent:{settings:{on:true,dailyCap:5}}}},{apiSettings:{way:'web'},overnightSettings:{enabled:true}}).everyDay,false,'an older Overnight account too');
 assert.equal(Actions.migrateSettings({toolbox:{agent:{settings:{on:true,way:'web',everyDay:true},wayMigrated:true,everyDayChosen:true}}},{}).everyDay,true,'a student who chose Every day keeps it');
});

test('a Canvas visit sends nothing until the student chooses Every day; Daily AI help still runs on a press',async t=>{
 const store=await account(),{c,sent}=client(store);t.after(()=>{c.destroy();store.destroy();});
 await c.visit();await c.visit();
 assert.equal(starts(sent).length,0,'no Prepare start before the choice');
 await c.prepareNow();
 assert.equal(starts(sent).length,1);assert.equal(starts(sent)[0].entry,'manual');
 await c.settings({everyDay:false});
 assert.equal(store.get().toolbox.agent.everyDayChosen,true,'Only when I ask is a choice too');assert.equal(store.get().toolbox.agent.settings.everyDay,false);
 await c.visit();
 assert.equal(starts(sent).length,1,'Only when I ask: a visit still sends nothing');
 await c.settings({everyDay:true});await c.visit();
 assert.equal(starts(sent).length,2,'Every day: a visit starts Prepare');assert.equal(starts(sent)[1].entry,undefined);
});

test('with the Overnight way a Canvas visit begins no automatic run until Every day',async t=>{
 const store=await account({way:'overnight'}),{c,sent}=client(store,{engine:false});t.after(()=>{c.destroy();store.destroy();});
 await c.visit();
 assert.equal(sent.filter(m=>['begin','turn'].includes(m.op)).length,0);
 await c.settings({everyDay:true});await c.visit();
 assert.ok(sent.some(m=>m.op==='begin'&&m.automatic===true),'after the choice the automatic run begins');
});

test('the agent runtime refuses an automatic run the student did not choose, and still answers a question',async()=>{
 const Runtime=require('../extension/agent-runtime.js');
 let data={settings:{timeZone:'America/New_York'},toolbox:{agent:{settings:{on:true,dailyCap:3},runs:[],memory:[]}}},n=0;
 const store={get:()=>structuredClone(data),update:async fn=>{const d=structuredClone(data);fn(d);data=d;}},calls=[];
 const runtime=Runtime.create({store,scope,now:()=>now,uuid:()=>String(++n),url:()=>'/courses/1',buildSnapshot:async()=>({text:'{}',snapshot:{},index:new Map(),baseline:{}}),
  createReader:()=>({cache:new Map(),read:async r=>r}),createExecutor:()=>({apply:async()=>({aids:[]}),saveAid:async()=>{}}),
  transport:async request=>{calls.push(request.runId);return {status:'answer',text:answer};}});
 assert.deepEqual(await runtime.run({automatic:true,changeKey:'2026-10-21:a'}),{skipped:'not-chosen'});
 assert.equal(calls.length,0);
 await runtime.run({question:'What first?'});
 assert.equal(calls.length,1,'a question the student asked runs');
 data.toolbox.agent.settings.everyDay=true;
 await runtime.run({automatic:true,changeKey:'2026-10-21:b'});
 assert.equal(calls.length,2,'after Every day the automatic run goes');
});

test('the Prepare worker refuses a run started by a Canvas visit until Every day; a press always starts one',async()=>{
 const Engine=require('../extension/ai-engine.js'),had=Object.hasOwn(globalThis,'ReserveSite');
 if(!had)globalThis.ReserveSite=require('../extension/site.js');
 try{
  let settings={on:true,way:'web',grades:false,everyDay:false,dailyCap:3,wishes:''},n=0;const accepted=[],authorized=[];
  const engine=Engine.create({store:{all:async()=>[],get:async()=>null,acquire:async()=>null,start:async input=>{accepted.push(input.entry);return {...structuredClone(input),state:'queued',lease:{epoch:1,expiresAt:0}};}},
   authorize:async run=>{authorized.push(run.entry||'visit');return {settings:structuredClone(settings)};},runnerFor:async()=>{throw Error('No runner in this test.');},uuid:()=>'u'+(++n)});
  const start=extra=>engine.start({id:'run-test-'+(++n),scope,day:'2026-10-21',sourceTab:1,triggerKey:'2026-10-21:visit',...extra});
  assert.deepEqual(await start(),{skipped:'not-chosen'});
  assert.deepEqual(accepted,[],'a visit before the choice starts nothing');
  const press=await start({entry:'manual',triggerKey:'2026-10-21:manual:1'});
  assert.equal(press.skipped,undefined);assert.deepEqual(accepted,['manual'],'Daily AI help starts a run');
  settings={...settings,everyDay:true};
  await start({triggerKey:'2026-10-21:visit:2'});
  assert.deepEqual(accepted,['manual','visit'],'after Every day a visit starts one');
  engine.dispose?.();
 }finally{if(!had)delete globalThis.ReserveSite;}
});

test('the Help band asks once: one sentence on what is sent and how often, then Every day or Only when I ask',async()=>{
 const band=(choice)=>{
  const d=dom(),host=new d.Element('div'),picks=[],env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:false})};let show=choice.show;
  const view=Band.renderBand(host,{},{env,scope,store:UI.createStore(env),onPrepare:async()=>({}),prepareChoice:()=>({show,cap:choice.cap}),onPrepareChoice:async everyDay=>{picks.push(everyDay);show=false;}});
  return {host,view,picks,line:descendants(host).find(n=>String(n.className).split(' ').includes('ch-band-choice'))};
 };
 const a=band({show:true,cap:3});await a.view.loaded;
 assert.equal(a.line.hidden,false);
 assert.equal(a.line.children.length,3,'one sentence and two choices, nothing else');
 assert.equal(a.line.children[0].textContent,'Daily AI help can run on its own: it sends your AI a summary of your Canvas work (courses, due work, announcements, teacher messages) when you open Canvas and when that work changes, up to 3 times a day.');
 const every=button(a.line,'Every day'),ask=button(a.line,'Only when I ask');
 for(const b of [every,ask]){
  assert.deepEqual(String(b.className).split(' '),['ch-band-act','ch-band-bar-act'],'the band bar\'s own drawn buttons');
  assert.ok(descendants(b).some(n=>String(n.className).split(' ').includes('ch-band-ico')),'each choice carries a drawing');
 }
 assert.notEqual(ask.dataset.act,'ask','a card\'s Ask keeps its own marker');
 await every.fire('click');await tick();
 assert.deepEqual(a.picks,[true]);assert.equal(a.line.hidden,true);
 a.view.update({});assert.equal(a.line.hidden,true,'asked once');a.view.destroy();
 const b=band({show:true,cap:1});await b.view.loaded;
 assert.match(b.line.children[0].textContent,/changes, once a day\.$/);
 await button(b.line,'Only when I ask').fire('click');await tick();
 assert.deepEqual(b.picks,[false]);assert.equal(b.line.hidden,true);b.view.destroy();
 const c=band({show:false,cap:3});await c.view.loaded;
 assert.equal(c.line.hidden,true,'no question once the student has chosen');c.view.destroy();
});

test('Home passes the one-time choice to the Help band and saves it as Prepare every day',()=>{
 const src=read('extension/dashboard.js').replace(/\s+/g,'');
 assert.match(src,/prepareChoice:\(\)=>\{consta=personal\?\.toolbox\?\.agent;return\{show:!!agentController&&!demo&&a\?\.settings\?\.on!==false&&a\?\.everyDayChosen!==true,cap:a\?\.settings\?\.dailyCap\?\?3\};\}/);
 assert.match(src,/onPrepareChoice:everyDay=>\{[^}]*returnagentController\.settings\(\{everyDay\}\);\}/);
});

test('Tools → AI keeps the choice changeable as Prepare every day',async t=>{
 const agent={settings:{on:true,way:'web',grades:false,dailyCap:3,wishes:''},status:'',snapshot:'',runs:[],memory:[],today:[],questions:[]};
 const catalog={scopeKey:scope+'|c1|a',active:{id:'a',title:'Assignment A',courseId:'c1',courseName:'Science',due:'2026-10-21'},courseId:'c1',courses:[{id:'c1',name:'Science'}],sources:[{id:'a',title:'Instructions A',kind:'assignment',courseId:'c1'}],agent};
 const f=panelFixture({catalog,agent:async r=>({...agent,settings:{...agent.settings,...r.settings}})});t.after(()=>f.close());await tick();
 assert.equal(f.get('ch-agent-everyday').checked,false);
 f.get('ch-agent-everyday').checked=true;await f.get('ch-agent-everyday').fire('change');await tick();
 assert.deepEqual(f.requests.filter(r=>r.action==='agent'&&r.op==='settings').map(r=>r.settings),[{everyDay:true}]);
 assert.match(read('extension/ai-panel.html'),/<input id="ch-agent-everyday" class="ch-agent-input" type="checkbox">Prepare every day<\/label>/);
});

// One account with one teacher (4), the student (7) and a classmate (11) in a course, as the worker's scan sees it.
function scan({feedback=false,conversations=[],messages={},comments=[]}={}){
 const teachers=[{id:'4'}],data={settings:{timeZone:'America/New_York',showGrades:false},toolbox:{aiTeacherFeedback:feedback,agent:{settings:{on:true,grades:false,dailyCap:3,wishes:''},runs:[],memory:[]}},customTasks:[],tasks:{}};
 const people=[{id:'4',name:'Teacher Four'},{id:'7',name:'Student Seven'},{id:'11',name:'Avery Classmate'}];
 const client={
  profile:async()=>({id:'7'}),
  loadSnapshot:async()=>({partial:false,courses:[{id:'1',name:'Science',teachers}],assignments:[{id:'2',course_id:'1',name:'Lab report',description:'<p>Write it up.</p>',due_at:new Date(now+2*DAY).toISOString(),submission_types:['online_upload'],submission:{user_id:'7',submission_comments:structuredClone(comments)}}]}),
  loadCourseResources:async id=>({courseId:String(id)}),
  loadCourseUpdates:async id=>({courseId:String(id),announcements:[]}),
  list:async url=>url.includes('include[]=teachers')?[{id:'1',teachers}]:[],
  listInbox:async()=>({conversations:structuredClone(conversations).map(c=>({participants:people,...c}))}),
  readConversation:async id=>({conversation:{id,participants:people,messages:structuredClone(messages[id]||[])}}),
  sourceErrors:()=>[]
 };
 return Canvas.create({client,scope,store:{sync:async()=>{},get:()=>structuredClone(data)},run:{day:'2026-10-21'},local:{get:async()=>({})},fetchImpl:async()=>{throw Error('No network in this test.');},now:()=>now}).scan({day:'2026-10-21'});
}
const at=days=>new Date(now-days*DAY).toISOString();

test('the Canvas brief names an Inbox conversation only when its newest message is by a teacher, with classmates unnamed',async()=>{
 const conversations=[
  {id:31,context_code:'course_1',subject:'Lab moved, ask Avery Classmate',last_message_at:at(1),last_message:'Lab moved to Friday.',workflow_state:'unread'},
  {id:32,context_code:'course_1',subject:'Group slides',last_message_at:at(1),last_message:'CLASSMATE_LATEST send me your notes'},
  {id:33,context_code:'course_1',subject:'Extension',last_message_at:at(1),last_message:'MY_OWN_REPLY thanks'},
  {id:34,context_code:'course_1',subject:'PEER_ONLY_SUBJECT',last_message_at:at(1),last_message:'PEER_ONLY_MESSAGE',participants:[{id:'7',name:'Student Seven'},{id:'12',name:'Riley Peer'}]}
 ],messages={
  31:[{id:1,author_id:11,created_at:at(2),body:'CLASSMATE_QUESTION can we move the lab?'},{id:2,author_id:4,created_at:at(1),body:'Lab moved to Friday. Avery Classmate brings the goggles.'}],
  32:[{id:3,author_id:4,created_at:at(3),body:'Group slides are due Monday.'},{id:4,author_id:11,created_at:at(1),body:'CLASSMATE_LATEST send me your notes'}],
  33:[{id:5,author_id:4,created_at:at(3),body:'TEACHER_IN_MY_THREAD extension approved.'},{id:6,author_id:7,created_at:at(1),body:'MY_OWN_REPLY thanks'}]
 };
 const {brief}=await scan({conversations,messages});
 assert.match(brief.text,/Messages from teachers, last 7 days:\n- Lab moved, ask \[classmate\] \([^)]*\): Lab moved to Friday\. \[classmate\] brings the goggles\./);
 for(const secret of ['Avery','CLASSMATE_LATEST','CLASSMATE_QUESTION','MY_OWN_REPLY','TEACHER_IN_MY_THREAD','Group slides','PEER_ONLY','Riley'])
  assert.equal(brief.text.includes(secret),false,secret);
 const none=await scan({conversations:conversations.slice(1),messages});
 assert.doesNotMatch(none.brief.text,/Messages from teachers/,'no teacher-written newest message, no Inbox lines');
});

test('teacher comments follow the Teacher feedback switch in the brief and the scan snapshot, and are never the student\'s own',async()=>{
 const comments=[{id:1,author_id:'4',comment:'TEACHER_FEEDBACK use units',created_at:at(2)},{id:2,author_id:'11',comment:'PEER_REVIEW_COMMENT',created_at:at(1.5)},{id:3,author_id:'7',comment:'MY_OWN_COMMENT',created_at:at(1)}];
 const off=await scan({comments}),on=await scan({comments,feedback:true});
 for(const secret of ['TEACHER_FEEDBACK','PEER_REVIEW_COMMENT','MY_OWN_COMMENT']){assert.equal(off.brief.text.includes(secret),false,secret);assert.equal(off.text.includes(secret),false,secret);}
 assert.doesNotMatch(off.brief.text,/Teacher feedback/);
 assert.match(on.brief.text,/Teacher feedback from the last 2 weeks:\n- [^\n]*Lab report: TEACHER_FEEDBACK use units/,'the latest comment by a teacher, not the student\'s later one');
 assert.match(on.text,/TEACHER_FEEDBACK use units/);
 for(const secret of ['PEER_REVIEW_COMMENT','MY_OWN_COMMENT']){assert.equal(on.brief.text.includes(secret),false,secret);assert.equal(on.text.includes(secret),false,secret);}
});

test('Ask your AI and the Overnight file carry teacher comments only with Teacher feedback on, never the student\'s own',async()=>{
 for(const [way,feedback] of [['web',false],['overnight',false],['web',true],['overnight',true]]){
  const store=await account({way});await store.update(d=>{d.toolbox.aiTeacherFeedback=feedback;});
  const context={courses:[{id:'1',name:'Science',teachers:[{id:'4'}]}],items:[{id:'2',courseId:'1',name:'Lab report',dueAt:new Date(now+2*DAY).toISOString()}],
   agentAssignments:[{id:'2',course_id:'1',submission:{user_id:'7',submission_comments:[{id:1,author_id:'4',comment:'TEACHER_FEEDBACK use units'},{id:3,author_id:'7',comment:'MY_OWN_COMMENT'}]}}]};
  const {c,sent}=client(store,{engine:false,getContext:()=>context});
  try{
   await c.run('What first?');
   const turn=sent.find(m=>m.op==='turn');assert.ok(turn,way);const text=JSON.stringify(turn);
   assert.equal(text.includes('TEACHER_FEEDBACK use units'),feedback,way+' feedback '+feedback);
   assert.equal(text.includes('MY_OWN_COMMENT'),false,way);
  }finally{c.destroy();store.destroy();}
 }
});

test('every agent snapshot drops teacher comments, their changes and their attached files while Teacher feedback is off',()=>{
 const context={user:{id:'7'},courses:[{id:'1',name:'Science',teachers:[{id:'4'}]}],items:[{id:'2',courseId:'1',name:'Lab report',dueAt:new Date(now+2*DAY).toISOString(),
  submission:{user_id:'7',submission_comments:[{id:1,author_id:'4',comment:'TEACHER_FEEDBACK use units',attachments:[{id:55,display_name:'MARKED_UP.pdf'}]},{id:3,author_id:'7',comment:'MY_OWN_COMMENT'}]}}]};
 const off=Data.build({now,context,data:{settings:{timeZone:'America/New_York'},toolbox:{}}}),on=Data.build({now,context,data:{settings:{timeZone:'America/New_York'},toolbox:{aiTeacherFeedback:true}}});
 for(const secret of ['TEACHER_FEEDBACK','MARKED_UP','teacher_comment','file:1:55'])assert.equal(off.text.includes(secret),false,secret);
 assert.match(on.text,/TEACHER_FEEDBACK use units/);assert.equal(on.text.includes('MY_OWN_COMMENT'),false);
});

test('the ChatGPT record read opens only the chat created when Canvas Harness sent, never the student\'s other chats',async()=>{
 const turnId='turn-5b1c2d3e-aaaa',sent=now,urls=[];
 const mapping={u:{message:{author:{role:'user'},content:{content_type:'text',parts:['[[Canvas Harness agent '+turnId+']]\nprompt']}},children:['r']},r:{message:{author:{role:'assistant'},content:{content_type:'text',parts:['{"cards":[]}']},status:'finished_successfully',end_turn:true},children:[]}};
 const list=[{id:'older-chat-1111',title:'My essay',create_time:'2026-10-01T00:00:00Z',update_time:(sent+4000)/1000},{id:'mine-chat-2222',title:'Canvas help',create_time:(sent+1500)/1000,update_time:(sent+9000)/1000},{id:'newer-chat-3333',title:'Weekend plans',create_time:(sent+300000)/1000,update_time:(sent+300000)/1000}];
 const fetch=async url=>{urls.push(url);const json=url.endsWith('/api/auth/session')?{accessToken:'tok'}:url.includes('/backend-api/conversations?')?{items:list}:url.endsWith('/conversation/mine-chat-2222')?{mapping}:{mapping:{}};return {ok:true,json:async()=>json};};
 const opened=u=>urls.filter(x=>x.includes('/backend-api/conversation/'));
 assert.equal(await Web.chatRecord({fetch,conversationURL:'https://chatgpt.com/c/local-abc12345',turnId,since:sent,opened:sent}),'{"cards":[]}');
 assert.deepEqual(opened(),['https://chatgpt.com/backend-api/conversation/mine-chat-2222'],'an older chat updated since and a newer chat stay unopened');
 urls.length=0;
 assert.equal(await Web.chatRecord({fetch,conversationURL:'https://chatgpt.com/c/local-abc12345',turnId,since:sent,opened:sent+3600e3}),'');
 assert.deepEqual(opened(),[],'with no chat created at the send, no chat is opened');
 urls.length=0;
 await Web.chatRecord({fetch,conversationURL:'https://chatgpt.com/c/mine-chat-2222',turnId,since:sent});
 assert.deepEqual(urls,['https://chatgpt.com/api/auth/session','https://chatgpt.com/backend-api/conversation/mine-chat-2222'],'a known chat is read without listing any');
});

test('the permission page says what is sent, when, and which chats are read',()=>{
 const text=read('extension/ai-permission.html').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 for(const untrue of [/Nothing is sent automatically/,/does not read your passwords, cookies, or chat history/,/only when you explicitly click Send/])assert.doesNotMatch(text,untrue);
 assert.match(text,/Daily AI help, Help with this, Ask your AI and the questions you ask on a Help card start a chat, send their message and read the reply\./);
 assert.match(text,/Nothing is sent on its own unless you chose Every day for Daily AI help\./);
 assert.match(text,/On ChatGPT it may list your six newest chats \(their names and times\) to find that chat, and reads only the one created when it sent\./);
 assert.match(text,/On Claude it looks up your account's organizations to reach that chat\./);
 assert.match(text,/keeps only the reply to its own message, and does not open your other chats\./);
});
