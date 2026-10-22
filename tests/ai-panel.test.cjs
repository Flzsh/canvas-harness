'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const panelFile=path.join(__dirname,'../extension/ai-panel.js');
const api=()=>require(panelFile);
const scope=(key='assignment-a',active='a')=>({scopeKey:key,active:active?{id:active,title:'Assignment '+active,courseId:'c1'}:null,courseId:'c1',courses:[{id:'c1',name:'Biology'}],sources:[{id:'a',title:'Instructions A',kind:'assignment',courseId:'c1',loaded:true},{id:'b',title:'Reading B',kind:'page',courseId:'c1',loaded:false}],demo:false,theme:'light',motion:'standard'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function mountedPanel({embedded=false,clipboardFail=false,collect}={}){
 const nodes=[],ids=new Map(),events=new Map(),requests=[];let receive;
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.events=new Map();this.dataset={};this.attrs={};this.value='';this.writes=0;this.replacements=0;nodes.push(this);}
  get textContent(){return (this.text||'')+this.children.map(node=>node.textContent).join('');}
  set textContent(value){this.writes++;this.text=String(value);this.children=[];}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.replacements++;this.children=children;this.text='';}
  setAttribute(key,value){this.attrs[key]=String(value);}
  addEventListener(type,fn){this.events.set(type,fn);}
  fire(type){this.events.get(type)?.({target:this,preventDefault(){}});}
  focus(){document.activeElement=this;}
  select(){this.selected=true;}
 }
 const get=id=>{if(!ids.has(id))ids.set(id,new Element('div'));return ids.get(id);};
 const document={documentElement:{dataset:{}},activeElement:null,getElementById:get,createElement:tag=>new Element(tag),querySelectorAll:()=>[]};
 const catalog={...scope(),selectedIds:['a']};
 const port={postMessage(request){requests.push(request);queueMicrotask(()=>{
  let result={};if(request.action==='catalog')result=catalog;
  else if(request.action==='collect')result=collect?collect(request):{scopeKey:catalog.scopeKey,text:'Selected instructions',included:request.ids.map(id=>({id,title:id})),omitted:[{title:'Reading',reason:'Unavailable'}]};
  else if(request.action==='pdf')result={text:'Attached PDF text',pages:1,totalPages:1,warnings:[]};
  receive({id:request.id,ok:true,result});
 });},onMessage:{addListener(fn){receive=fn;},removeListener(){}},onDisconnect:{addListener(){},removeListener(){}},disconnect(){}};
 const env={document,name:embedded?'ch-toolbox-ai':'',location:{origin:'chrome-extension://test'},crypto:{randomUUID},setTimeout,clearTimeout,
  addEventListener:(type,fn)=>events.set(type,fn),removeEventListener:type=>events.delete(type),
  btoa:value=>Buffer.from(value,'binary').toString('base64'),navigator:{clipboard:{async writeText(){if(clipboardFail)throw Error('Clipboard unavailable');}}},
  chrome:{runtime:{id:'test',connect:()=>port},permissions:{contains(_value,reply){reply(true);},request(_value,reply){reply(true);}}}};
 const controller=api().mount(env);
 return {controller,env,document,catalog,get,nodes,requests,receive:message=>receive(message),close:()=>events.get('pagehide')?.()};
}

test('typing updates only the composer and keeps reviewed context and list nodes',async t=>{
 const f=mountedPanel();t.after(f.close);await tick();await f.controller.preview();f.controller.acceptIssues(true);
 const selected=f.get('selected-items').children[0],issue=f.get('issue-list').children[0],context=f.controller.state.context;
 const counts=()=>['selected-items','pdf-list','issue-list'].map(id=>f.get(id).replacements).concat(f.get('context-text').writes,f.get('context-count').writes);
 const before=counts(),nodeCount=f.nodes.length,requests=f.requests.length;
 f.get('prompt').focus();f.get('context-text').scrollTop=123;
 for(let i=1;i<=100;i++){f.get('prompt').value='x'.repeat(i);f.get('prompt').fire('input');}
 assert.deepEqual(counts(),before);assert.equal(f.nodes.length,nodeCount);assert.equal(f.requests.length,requests);
 assert.strictEqual(f.get('selected-items').children[0],selected);assert.strictEqual(f.get('issue-list').children[0],issue);
 assert.strictEqual(f.controller.state.context,context);assert.equal(f.get('accept-issues').checked,true);assert.equal(f.get('context-text').scrollTop,123);
 assert.strictEqual(f.document.activeElement,f.get('prompt'));assert.equal(f.get('prompt-count').textContent,'100 / 20,000');assert.equal(f.get('send').disabled,false);
 f.controller.setCatalog({...f.catalog,active:null,selectedIds:[]});f.controller.setDraft(' ');assert.equal(f.get('send').disabled,true);
 f.controller.setDraft('Question');assert.equal(f.get('send').disabled,false);
});

test('unrelated panel changes preserve rendered lists, while changed context and titles render',async t=>{
 let text='First context',reason='First issue';const f=mountedPanel({collect:data=>({scopeKey:'assignment-a',text,included:data.ids.map(id=>({id,title:id})),omitted:[{title:'Reading',reason}]})});t.after(f.close);await tick();await f.controller.preview();
 const selected=f.get('selected-items').children[0],issue=f.get('issue-list').children[0],writes=f.get('context-text').writes,replacements=f.get('selected-items').replacements;
 f.controller.setAutoSend(true);f.controller.setProvider('claude');await tick();
 assert.strictEqual(f.get('selected-items').children[0],selected);assert.equal(f.get('selected-items').replacements,replacements);assert.equal(f.get('context-text').writes,writes);
 text='Updated context';reason='Updated issue';await f.controller.preview();assert.equal(f.get('context-text').textContent,text);assert.match(f.get('issue-list').textContent,/Updated issue/);assert.notStrictEqual(f.get('issue-list').children[0],issue);
 f.catalog.sources[0].title='Revised instructions';f.receive({kind:'catalog',data:f.catalog});assert.match(f.get('selected-items').textContent,/Revised instructions/);assert.equal(f.get('context-preview').hidden,true);
});

test('typing dismisses a manual copy fallback without rerendering the context',async t=>{
 const f=mountedPanel({clipboardFail:true});t.after(f.close);await tick();f.controller.setDraft('First question');await f.controller.copy();assert.equal(f.get('fallback').hidden,false);
 const writes=f.get('context-text').writes;f.get('prompt').focus();f.get('prompt').value='Edited question';f.get('prompt').fire('input');
 assert.equal(f.get('fallback').hidden,true);assert.equal(f.get('fallback-text').value,'');assert.equal(f.controller.state.manualCopy,false);assert.strictEqual(f.document.activeElement,f.get('prompt'));assert.equal(f.get('context-text').writes,writes);
});

test('a Biscuit draft appends to unsent text once and only acknowledges without collecting or sharing',async t=>{
 const f=mountedPanel();t.after(f.close);await tick();f.controller.setDraft('My unsent question');const before=f.requests.length,draft={id:'biscuit-1',scopeKey:f.catalog.scopeKey,text:'Explain π\n  preserve spacing'};
 f.receive({kind:'catalog',data:f.catalog});f.receive({kind:'draft',draft});assert.equal(f.controller.state.draft,'My unsent question\n\n'+draft.text);assert.equal(f.get('prompt').value,f.controller.state.draft);
 f.receive({kind:'draft',draft});assert.equal(f.controller.state.draft,'My unsent question\n\n'+draft.text);const added=f.requests.slice(before);assert.deepEqual(added.map(message=>message.kind),['draft-ack','draft-ack']);assert.ok(added.every(message=>message.id===draft.id&&message.scopeKey===draft.scopeKey));
 assert.equal(f.controller.state.context,null);assert.equal(f.controller.state.autoSend,false);assert.equal(f.requests.some(message=>message.action==='collect'||message.action==='web'),false);
});

test('Biscuit draft validation rejects foreign scope and waits for space without losing the unsent question',async t=>{
 const f=mountedPanel();t.after(f.close);await tick();f.receive({kind:'catalog',data:f.catalog});const before=f.requests.length;
 for(const draft of [{id:'wrong',scopeKey:'foreign',text:'Foreign question'},{id:'long',scopeKey:f.catalog.scopeKey,text:'x'.repeat(20001)},{id:'nul',scopeKey:f.catalog.scopeKey,text:'bad\u0000text'}])f.receive({kind:'draft',draft});assert.equal(f.controller.state.draft,'');assert.equal(f.requests.length,before);
 f.controller.setDraft('x'.repeat(19999));const draft={id:'wait-for-room',scopeKey:f.catalog.scopeKey,text:'Biscuit question'};f.receive({kind:'draft',draft});assert.equal(f.controller.state.draft,'x'.repeat(19999));assert.equal(f.requests.length,before);
 f.get('prompt').value='Short question';f.get('prompt').fire('input');assert.equal(f.controller.state.draft,'Short question\n\nBiscuit question');assert.equal(f.requests.at(-1).kind,'draft-ack');
});

test('PDF rows retain identity across typing and busy changes, and Remove remains current',async t=>{
 const f=mountedPanel();t.after(f.close);await tick();
 await f.controller.attach({name:'Notes.pdf',size:5,arrayBuffer:async()=>Buffer.from('%PDF-')});
 const row=f.get('pdf-list').children[0],remove=row.children[1];assert.match(row.textContent,/Notes.pdf/);
 f.controller.setDraft('Question');assert.strictEqual(f.get('pdf-list').children[0],row);
 const work=f.controller.preview();assert.equal(remove.disabled,true);await work;assert.strictEqual(f.get('pdf-list').children[0],row);assert.equal(remove.disabled,false);
 remove.fire('click');assert.equal(f.get('pdf-list').children.length,0);assert.equal(f.controller.state.pdfs.length,0);
});

for(const embedded of [false,true])test((embedded?'toolbox':'standalone')+' AI panel exposes the appropriate close control',async t=>{
 const f=mountedPanel({embedded});t.after(f.close);await tick();assert.equal(f.get('close').hidden,embedded);
 if(!embedded){f.get('close').fire('click');await tick();assert.equal(f.requests.filter(request=>request.action==='close').length,1);}
});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(overrides={}){
 const calls=[];let connected=false;
 const transport={available:true,preview:false,abort(){},request(action,data={},options={}){
  const id=options.id||randomUUID();calls.push({action,...data,id});
  const promise=Promise.resolve().then(()=>{
   if(overrides[action])return overrides[action](data,options,id);
   if(action==='collect')return {scopeKey:'assignment-a',text:data.ids.length?'Selected reference':'',included:data.ids.map(id=>({id,title:id})),omitted:[]};
   if(action==='native'){
    if(data.op==='authenticate')connected=true;
    if(data.op==='signout')connected=false;
    if(data.op==='models')return {models:[{slug:'actual-model',display_name:'Actual model',visibility:'list'}]};
    if(data.op==='chat')return {text:'A real result from the test transport'};
    return {connected};
   }
   if(action==='web')return {status:data.op==='inject'?'injected':'opened',message:'Ready'};
   if(action==='catalog')return scope();
  });promise.id=id;return promise;
 }};
 const permissions={request:()=>Promise.resolve(true),contains:()=>Promise.resolve(true)};
 const controller=api().createController({transport,permissions,clipboard:{writeText:async()=>{}},onChange(){},env:{crypto:{randomUUID},btoa:value=>Buffer.from(value,'binary').toString('base64')}});
 controller.setCatalog(scope());return {controller,calls,transport,permissions};
}

test('a metadata-only catalog refresh during the first collection does not cancel Send',async()=>{
 const pending=deferred();const {controller:c,calls}=fixture({collect:()=>pending.promise});
 c.setDraft('Explain the reading');const first=c.inject();await tick();
 const refreshed=scope();refreshed.sources[0].title='Fresh assignment title';refreshed.sources[0].loaded=true;
 c.setCatalog(refreshed);
 pending.resolve({scopeKey:'assignment-a',text:'Fresh instructions',included:[{id:'a',title:'Fresh assignment title'}],omitted:[]});
 assert.equal(await first,true);assert.equal(calls.filter(x=>x.op==='inject').length,1);assert.equal(c.state.busy,'');
});

test('selection changes within a catalog scope still cancel pending Send',async()=>{
 const pending=deferred();const {controller:c,calls}=fixture({collect:()=>pending.promise});c.setDraft('Question');
 const first=c.inject();await tick();c.setCatalog({...scope(),selectedIds:['b']});
 pending.resolve({scopeKey:'assignment-a',text:'Old selection',included:[{id:'a',title:'a'}],omitted:[]});
 assert.equal(await first,false);assert.equal(calls.filter(x=>x.op==='inject').length,0);
});

test('assignment PDF inclusion is on by default, scoped to its selected parent, and can be disabled',async()=>{
 const {controller:c,calls}=fixture({collect:()=>({scopeKey:'assignment-a',text:'Instructions and PDF text',included:[{id:'a',title:'a'},{id:'file:c1:9',title:'Reading.pdf',kind:'file',courseId:'c1',attachmentOf:'a',mime:'application/pdf'}],omitted:[]})});
 c.setDraft('Explain');assert.equal(await c.inject(),true);assert.equal(calls.find(x=>x.action==='collect').includeAssignmentPdfs,true);
 c.setAssignmentPdfs(false);await c.inject();assert.equal(calls.filter(x=>x.action==='collect').at(-1).includeAssignmentPdfs,false);
 assert.equal(calls.filter(x=>x.op==='inject').length,1);assert.match(c.state.error,/unselected|unexpected/i);
});

test('PDF attachment provenance cannot admit a file from another course or a non-assignment parent',async()=>{
 for(const source of [{kind:'file',courseId:'c2',attachmentOf:'a',mime:'application/pdf'},{kind:'page',courseId:'c1',attachmentOf:'a',mime:'application/pdf'},{kind:'file',courseId:'c1',attachmentOf:'b',mime:'application/pdf'}]){
  const {controller:c,calls}=fixture({collect:()=>({scopeKey:'assignment-a',text:'Unexpected text',included:[{id:'a'},{id:'foreign',...source}],omitted:[]})});
  c.setDraft('Question');await c.inject();assert.equal(calls.filter(x=>x.op==='inject').length,0);
 }
});

test('Enter sends, Shift+Enter adds a line, and composition or repeated keys never send',()=>{
 const shouldSend=api().shouldSendKey;
 assert.equal(shouldSend({key:'Enter'}),true);assert.equal(shouldSend({key:'Enter',ctrlKey:true}),true);
 for(const event of [{key:'Enter',shiftKey:true},{key:'Enter',isComposing:true},{key:'Enter',keyCode:229},{key:'Enter',repeat:true},{key:'x'}])assert.equal(shouldSend(event),false);
});

test('panel ships as an external-script extension page with no persistence or HTML sinks',()=>{
 const js=fs.readFileSync(panelFile,'utf8');const html=fs.readFileSync(path.join(__dirname,'../extension/ai-panel.html'),'utf8');
 assert.match(html,/src="ai-panel\.js"/);assert.match(html,/src="ai-providers\.js"/);
 assert.doesNotMatch(js,/\.(?:innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB)\b|chrome\.storage|eval\(/);
 assert.doesNotMatch(html,/<script[^>]*>\s*[^\s<]|\son\w+=/i);
});
test('only explicitly opened assignment is preselected; same scope preserves choices',()=>{
 const {controller:c}=fixture();assert.deepEqual([...c.state.selected],['a']);
 c.setSelection('a',false);c.setSelection('b',true);c.setCatalog(scope());assert.deepEqual([...c.state.selected],['b']);
 c.setCatalog(scope('home',null));assert.equal(c.state.selected.size,0);
});
test('scope changes erase former conversation and attachments while preserving an unsent draft',()=>{
 const {controller:c}=fixture();c.setDraft('My draft');c.state.history.push({role:'assistant',content:'Old assignment'});c.state.messages.push({role:'user',content:'old context'});c.state.pdfs.push({id:'p',text:'private',courseId:'c1'});
 c.setCatalog(scope('assignment-b','b'));assert.deepEqual([...c.state.selected],['b']);assert.equal(c.state.history.length,0);assert.equal(c.state.messages.length,0);assert.equal(c.state.pdfs.length,0);assert.equal(c.state.draft,'My draft');assert.equal(c.state.context,null);
});
test('omissions stop sharing until reviewed; changed omissions require another review',async()=>{
 let issue='Unreadable PDF';const {controller:c,calls}=fixture({collect:()=>({scopeKey:'assignment-a',text:'Available text',included:[{id:'a',title:'a'}],omitted:[{title:'Linked PDF',reason:issue}]})});
 c.setDraft('Explain');await c.inject();assert.equal(calls.filter(x=>x.op==='inject').length,0);assert.equal(c.state.draft,'Explain');assert.ok(c.state.context.issues.length);
 c.acceptIssues(true);issue='New unavailable source';await c.inject();assert.equal(calls.filter(x=>x.op==='inject').length,0);
 c.acceptIssues(true);await c.inject();assert.equal(calls.filter(x=>x.op==='inject').length,1);
});
test('a scope switch while collect is pending prevents injection and sending',async()=>{
 const pending=deferred();const {controller:c,calls}=fixture({collect:()=>pending.promise});c.setDraft('Draft');const work=c.inject();await tick();c.setCatalog(scope('other','b'));pending.resolve({scopeKey:'assignment-a',text:'Old context',included:[],omitted:[]});await work;
 assert.equal(calls.filter(x=>x.op==='inject').length,0);assert.equal(c.state.context,null);assert.equal(c.state.draft,'Draft');
});
test('collect returning another scope fails closed',async()=>{
 const {controller:c,calls}=fixture({collect:()=>({scopeKey:'wrong',text:'Wrong account',included:[],omitted:[]})});c.setDraft('Question');await c.inject();assert.equal(calls.filter(x=>x.op==='inject').length,0);assert.match(c.state.error,/changed|scope/i);
});
test('inject all is limited to the active assignment and its direct links',async()=>{
 const {controller:c,calls}=fixture();c.setSelection('b',true);c.setAll(true);await c.inject();const collect=calls.find(x=>x.action==='collect');assert.equal(collect.all,true);assert.deepEqual(collect.ids,['a']);
 c.setCatalog(scope('home',null));c.setAll(true);assert.equal(c.state.all,false);
});
test('failed injection preserves the composed text and draft for explicit copy/open fallback',async()=>{
 const {controller:c,calls}=fixture({web:()=>({status:'no-editor',message:'Open a conversation first'})});c.setDraft('Keep my question');await c.inject();assert.match(c.state.fallback,/Keep my question/);assert.match(c.state.fallback,/Selected reference/);assert.equal(c.state.draft,'Keep my question');assert.equal(calls.filter(x=>x.op==='inject').length,1);assert.equal(calls.some(x=>x.action==='native'),false);
});
test('empty home selection allows prompt-only chat without added hidden context',async()=>{
 const {controller:c,calls}=fixture({collect:()=>({scopeKey:'home',text:'',included:[],omitted:[]})});c.setCatalog(scope('home',null));c.setDraft('Hello');await c.inject();const chat=calls.find(x=>x.op==='inject');assert.equal(chat.text,'Hello');
});
test('PDF size is checked before reading bytes; warnings and text stay in memory',async()=>{
 const {controller:c,calls}=fixture({pdf:()=>({text:'Local PDF text',pages:1,totalPages:3,truncated:true,warnings:['Two pages omitted']})});let reads=0;
 await c.attach({name:'large.pdf',size:2*1024*1024+1,arrayBuffer(){reads++;throw Error('Must not read');}});assert.equal(reads,0);assert.equal(calls.filter(x=>x.action==='pdf').length,0);assert.match(c.state.error,/2 MiB/);
 await c.attach({name:'notes.pdf',size:5,arrayBuffer:async()=>Buffer.from('%PDF-')});assert.equal(c.state.pdfs.length,1);await c.preview();assert.match(c.state.context.text,/Local PDF text/);assert.ok(c.state.context.issues.some(x=>/pages|truncat/i.test(x.reason)));
});
test('oversized context is explicitly truncated and must be reviewed; oversized prompt is rejected',async()=>{
 const {controller:c,calls}=fixture({collect:()=>({scopeKey:'assignment-a',text:'x'.repeat(100100),included:[{id:'a',title:'a'}],omitted:[]})});await c.preview();assert.ok(c.state.context.text.length<=100000);assert.ok(c.state.context.issues.some(x=>/truncat|limit/i.test(x.reason)));
 c.setDraft('x'.repeat(20001));await c.inject();assert.equal(calls.filter(x=>x.op==='inject').length,0);assert.match(c.state.error,/20,000|20000/);
});
test('artificial preview cannot authenticate, inject or fabricate an answer',async()=>{
 const {controller:c,calls}=fixture();c.setCatalog({...scope(),demo:true});c.setDraft('Test');await c.inject();assert.equal(calls.filter(x=>x.action==='native'||x.action==='web').length,0);assert.match(c.state.error,/preview/i);
});

function transportEnv({extension=true,host='localhost'}={}){
 const listeners=new Map(),sent=[],messages=[],disconnects=[];const parent={postMessage:(...args)=>sent.push(args)};
 const port={postMessage:request=>sent.push(request),onMessage:{addListener:cb=>messages.push(cb),removeListener(){}},onDisconnect:{addListener:cb=>disconnects.push(cb),removeListener(){}},disconnect(){}};
 const env={location:{origin:`http://${host}:5173`,hostname:host,protocol:'http:'},parent,crypto:{randomUUID},setTimeout,clearTimeout,addEventListener:(name,cb)=>listeners.set(name,cb),removeEventListener:(name)=>listeners.delete(name)};
 if(extension)env.chrome={runtime:{id:'extension-id',connect:options=>{assert.equal(options.name,'ch-ai-panel');return port;}}};
 return {env,sent,listeners,messages,disconnects};
}
test('production uses only runtime port, handles deltas, and rejects all pending work on disconnect',async()=>{
 const e=transportEnv();const deltas=[];const t=api().createTransport(e.env);assert.equal(e.listeners.has('message'),false);const request=t.request('native',{op:'chat'},{onDelta:text=>deltas.push(text)});const id=e.sent[0].id;
 e.messages[0]({id,kind:'delta',text:'hello'});e.messages[0]({id,ok:true,result:{text:'hello'}});assert.deepEqual(await request,{text:'hello'});assert.deepEqual(deltas,['hello']);
 const second=t.request('catalog');const rejected=assert.rejects(second,/Reconnect/i);e.disconnects[0]();await rejected;assert.equal(e.sent.length,2);t.dispose();
});
test('localhost preview rejects another origin and non-parent messages',async()=>{
 const e=transportEnv({extension:false});const t=api().createTransport(e.env);const p=t.request('catalog');const request=e.sent[0][0].request;const receive=e.listeners.get('message');let resolved=false;p.then(()=>{resolved=true;});
 receive({source:{},origin:e.env.location.origin,data:{type:'ch-ai-reply',reply:{id:request.id,ok:true,result:'evil'}}});
 receive({source:e.env.parent,origin:'https://evil.test',data:{type:'ch-ai-reply',reply:{id:request.id,ok:true,result:'evil'}}});await tick();assert.equal(resolved,false);
 receive({source:e.env.parent,origin:e.env.location.origin,data:{type:'ch-ai-reply',reply:{id:request.id,ok:true,result:'safe'}}});assert.equal(await p,'safe');assert.equal(e.sent[0][1],e.env.location.origin);t.dispose();
});
test('ordinary websites cannot use the preview transport',async()=>{
 const e=transportEnv({extension:false,host:'example.com'});const t=api().createTransport(e.env);assert.equal(t.available,false);await assert.rejects(t.request('catalog'),/unavailable|extension/i);assert.equal(e.listeners.has('message'),false);t.dispose();
});

test('draft transport deduplicates reconnect delivery and rejects stale scopes without sending requests',()=>{
 const e=transportEnv(),timers=new Map();let timerId=0;const received=[];e.env.setTimeout=fn=>{const id=++timerId;timers.set(id,fn);return id;};e.env.clearTimeout=id=>timers.delete(id);
 const t=api().createTransport(e.env,{draft:draft=>{received.push(draft.text);return true;}}),draft={id:'once',scopeKey:'assignment-a',text:'Original question'};
 e.messages.at(-1)({kind:'draft',draft});assert.deepEqual(received,[]);e.messages.at(-1)({kind:'catalog',data:scope()});assert.deepEqual(received,['Original question']);assert.equal(e.sent.at(-1).kind,'draft-ack');
 e.disconnects.at(-1)();const reconnect=[...timers.values()][0];timers.clear();reconnect();e.messages.at(-1)({kind:'catalog',data:scope()});e.messages.at(-1)({kind:'draft',draft});assert.deepEqual(received,['Original question']);assert.equal(e.sent.filter(message=>message.kind==='draft-ack').length,2);
 e.messages.at(-1)({kind:'catalog',data:scope('assignment-b','b')});e.messages.at(-1)({kind:'draft',draft:{...draft,id:'stale'}});assert.deepEqual(received,['Original question']);assert.ok(e.sent.every(message=>message.kind==='draft-ack'));
 t.dispose();e.messages.at(-1)({kind:'draft',draft:{...draft,id:'closed',scopeKey:'assignment-b'}});assert.deepEqual(received,['Original question']);assert.equal(timers.size,0);
});

test('unrequested sources returned by collect never reach a provider',async()=>{
 const {controller:c,calls}=fixture({collect:()=>({scopeKey:'assignment-a',text:'Hidden source',included:[{id:'a',title:'a'},{id:'secret',title:'secret'}],omitted:[]})});c.setDraft('Explain');await c.inject();assert.equal(calls.filter(x=>x.op==='inject').length,0);assert.match(c.state.error,/unselected|unexpected/i);
 const home=fixture({collect:()=>({scopeKey:'home',text:'Stale home context',included:[],omitted:[]})});home.controller.setCatalog(scope('home',null));home.controller.setDraft('Hello');await home.controller.inject();assert.equal(home.calls.filter(x=>x.op==='inject').length,0);
});
test('closing during context collection prevents later sharing and closes immediately',async()=>{
 const pending=deferred();const {controller:c,calls}=fixture({collect:()=>pending.promise});c.setDraft('Draft');const injecting=c.inject();await tick();await c.close();assert.ok(calls.some(x=>x.action==='close'));pending.resolve({scopeKey:'assignment-a',text:'context',included:[{id:'a',title:'a'}],omitted:[]});await injecting;assert.equal(calls.filter(x=>x.op==='inject').length,0);assert.equal(c.state.draft,'Draft');
});

test('Inject requests only the chosen website permission directly from the click, then collects and opens',async()=>{
 const {controller:c,calls,permissions}=fixture();let permission;
 permissions.request=value=>{permission=value;assert.equal(calls.length,0);return Promise.resolve(true);};
 c.setProvider('claude');calls.length=0;c.setDraft('Explain this');const promise=c.inject();
 assert.deepEqual(permission,{permissions:['scripting'],origins:['https://claude.ai/*']});
 await promise;const request=calls.find(x=>x.op==='inject');assert.equal(request.provider,'claude');assert.ok(request.text.startsWith('Explain this'));assert.ok(request.text.includes('Selected reference'));
 assert.equal(calls.some(x=>x.action==='native'),false);
});
test('denied website permission preserves question and does not collect or open any tab',async()=>{
 const {controller:c,calls,permissions}=fixture();permissions.request=()=>Promise.resolve(false);c.setDraft('Keep my question');
 assert.equal(await c.inject(),false);assert.equal(c.state.draft,'Keep my question');assert.equal(calls.length,0);
});
test('main Canvas selection is authoritative and the panel has no source picker or connected account route',()=>{
 const {controller:c}=fixture();c.setCatalog({...scope(),selectedIds:['b']});assert.deepEqual([...c.state.selected],['b']);
 c.setCatalog({...scope(),selectedIds:[]});assert.equal(c.state.selected.size,0);
 const html=fs.readFileSync(path.join(__dirname,'../extension/ai-panel.html'),'utf8');
 assert.doesNotMatch(html,/id="(?:sources|source-fieldset|course|route-connected|connection-info)"/);
 assert.equal(c.connect,undefined);assert.equal(c.send,undefined);
});

test('a recovered catalog unlocks repeated injection and retains question and selection',async()=>{
 const {controller:c,calls}=fixture();c.setDraft('First question');await c.inject();assert.equal(c.state.busy,'');
 c.disconnected('Reconnecting');assert.equal(c.state.online,false);c.setCatalog(scope());assert.equal(c.state.online,true);
 assert.equal(c.state.draft,'First question');assert.deepEqual([...c.state.selected],['a']);assert.equal(c.state.error,'');
 c.setDraft('Second question');await c.inject();assert.equal(calls.filter(x=>x.op==='inject').length,2);assert.equal(c.state.busy,'');
 c.setProvider('claude');await c.inject();assert.equal(calls.filter(x=>x.op==='inject').at(-1).provider,'claude');
});
test('automatic send is optional and follows only the explicit injection click',async()=>{
 const {controller:c,calls}=fixture();c.setDraft('Question');await c.inject();assert.equal(calls.find(x=>x.op==='inject').autoSend,false);
 c.setAutoSend(true);assert.equal(calls.filter(x=>x.op==='inject').length,1);await c.inject();assert.equal(calls.filter(x=>x.op==='inject').at(-1).autoSend,true);
 c.setAutoSend(false);await c.inject();assert.equal(calls.filter(x=>x.op==='inject').at(-1).autoSend,false);
});
test('transport reconnects after a dropped port without replaying the interrupted request',async()=>{
 const e=transportEnv(),timers=new Map();let next=0,connects=0;
 e.env.setTimeout=f=>{const id=++next;timers.set(id,f);return id;};e.env.clearTimeout=id=>timers.delete(id);
 const original=e.env.chrome.runtime.connect;e.env.chrome.runtime.connect=o=>{connects++;return original(o);};
 let recovered=0;const t=api().createTransport(e.env,{connect:()=>recovered++});
 const request=t.request('web',{op:'inject',text:'Never replay'});const rejected=assert.rejects(request,/Reconnect/i);
 e.disconnects[0]();await rejected;assert.equal(t.available,false);assert.equal(e.sent.length,1);
 const retry=[...timers.values()][0];timers.clear();retry();assert.equal(t.available,true);assert.equal(connects,2);assert.equal(recovered,2);assert.equal(e.sent.length,1);
 const fresh=t.request('catalog');e.messages.at(-1)({id:e.sent.at(-1).id,ok:true,result:scope()});assert.equal((await fresh).scopeKey,'assignment-a');
 t.dispose();assert.equal(timers.size,0);
});

test('saved automatic-send preference is restored without storing any draft text',async()=>{
 const {controller:c,calls}=fixture();c.setCatalog({...scope(),autoSend:true});assert.equal(c.state.autoSend,true);
 c.setAutoSend(false);const pref=calls.find(x=>x.action==='preference');assert.equal(pref.autoSend,false);assert.equal(pref.text,undefined);
 c.setCatalog({...scope(),autoSend:true});assert.equal(c.state.autoSend,false,'late metadata cannot undo a newer choice');
});

const pdfSelection={origin:'https://school.instructure.com',accountId:'7',fileId:'42',name:'Chemistry.pdf',text:'Compare the rates of diffusion.',page:1,endPage:3};
function pdfPanelFixture(settings={},metadata={}){
 const {createPdfHandoff}=require('../extension/ai-source.js'),handoff=createPdfHandoff({...pdfSelection,...settings}),catalog={...handoff.summary(),...metadata};
 const f=fixture({collect:data=>handoff.collect(data),catalog:async()=>({...await handoff.catalog(),...metadata})});
 f.controller.setCatalog(catalog);return {...f,handoff,catalog};
}
test('receiving a plain PDF handoff leaves the question empty and never contacts a provider',async()=>{
 const {controller:c,calls,catalog}=pdfPanelFixture();assert.equal(c.state.draft,'');assert.equal(c.state.context,null);
 assert.deepEqual([...c.state.selected],catalog.selectedIds);assert.equal(c.state.autoSend,false);await tick();assert.deepEqual(calls,[]);
});
test('PDF handoff preserves student edits across metadata refresh, reconnect and catalog reload',async()=>{
 const {controller:c,calls,catalog}=pdfPanelFixture(),edited='Explain the diffusion example.';c.setDraft(edited);
 const refreshed={...catalog,theme:'dark',sources:catalog.sources.map(source=>({...source,title:'Updated PDF title',loaded:true}))};
 c.setCatalog(refreshed);c.setCatalog({...refreshed});c.setCatalog(catalog);assert.equal(c.state.draft,edited);
 c.disconnected('Reconnecting');assert.equal(c.state.online,false);c.setCatalog({...refreshed});
 assert.equal(c.state.online,true);assert.equal(c.state.draft,edited);await c.initialize();assert.equal(c.state.draft,edited);
 assert.deepEqual(calls.map(call=>call.action),['catalog']);
});
test('clearing a PDF question remains a student edit across refresh and reconnect',async()=>{
 const {controller:c,calls,catalog}=pdfPanelFixture();c.setDraft('My question');c.setDraft('');c.setCatalog({...catalog});
 c.disconnected('Reconnecting');await c.initialize();c.setCatalog(catalog);
 assert.equal(c.state.draft,'');assert.deepEqual(calls.map(call=>call.action),['catalog']);
});
for(const autoSend of [false,true])test('PDF handoff waits for explicit injection and honors saved automatic sending '+autoSend,async()=>{
 const {controller:c,calls,catalog,handoff}=pdfPanelFixture({},{autoSend}),question='Explain these pages.';c.setDraft(question);
 assert.equal(c.state.autoSend,autoSend);c.setCatalog({...catalog});c.disconnected('Reconnecting');await c.initialize();await tick();
 assert.equal(c.state.draft,question);assert.deepEqual(calls.map(call=>call.action),['catalog']);assert.equal(await c.inject(),true);
 assert.deepEqual(calls.map(call=>call.action),['catalog','collect','web']);
 const collected=calls.find(call=>call.action==='collect');assert.deepEqual(collected.ids,catalog.selectedIds);assert.equal(collected.all,false);
 const injected=calls.find(call=>call.op==='inject'),context=await handoff.collect({ids:catalog.selectedIds});
 assert.equal(injected.autoSend,autoSend);assert.equal(injected.provider,'chatgpt');assert.equal(injected.scopeKey,catalog.scopeKey);
 assert.ok(injected.text.startsWith(question+'\n'));assert.ok(injected.text.includes(context.text));assert.equal(c.state.draft,question);
});
test('PDF explicit injection defaults automatic sending off and follows only later preference changes',async()=>{
 const {controller:c,calls,catalog}=pdfPanelFixture();c.setDraft('Explain these pages.');assert.equal(c.state.autoSend,false);await tick();assert.deepEqual(calls,[]);
 assert.equal(await c.inject(),true);assert.equal(calls.filter(call=>call.op==='inject').at(-1).autoSend,false);
 c.setAutoSend(true);c.setCatalog({...catalog,autoSend:false});await tick();assert.equal(calls.filter(call=>call.op==='inject').length,1);
 assert.equal(c.state.autoSend,true);assert.equal(await c.inject(),true);assert.equal(calls.filter(call=>call.op==='inject').at(-1).autoSend,true);
 c.setAutoSend(false);c.setCatalog({...catalog,autoSend:true});await tick();assert.equal(calls.filter(call=>call.op==='inject').length,2);
 assert.equal(await c.inject(),true);assert.equal(calls.filter(call=>call.op==='inject').at(-1).autoSend,false);
 assert.deepEqual(calls.filter(call=>call.action==='preference').map(call=>call.autoSend),[true,false]);
});
