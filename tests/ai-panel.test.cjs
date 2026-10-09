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
test('model list never invents a slug or exposes hidden entries; both companion shapes work',()=>{
 const models=api().normalizeModels({models:[{slug:'gpt-real',display_name:'Real',visibility:'list'},{slug:'hidden',visibility:'hidden'},{id:'second',name:'Second'},{slug:'gpt-real'}, {slug:'bad slug'},{}]});
 assert.deepEqual(models,[{slug:'gpt-real',name:'Real'},{slug:'second',name:'Second'}]);assert.deepEqual(api().normalizeModels({}),[]);
 assert.equal(api().normalizeNative({connected:'true'}).connected,false);assert.equal(api().normalizeNative({connected:true}).connected,true);
});
test('connect requests nativeMessaging synchronously from the initiating gesture',async()=>{
 const {controller:c,permissions,calls}=fixture();let requested=false;permissions.request=(value)=>{requested=true;assert.deepEqual(value,{permissions:['nativeMessaging']});return Promise.resolve(true);};
 const task=c.connect();assert.equal(requested,true);await task;assert.equal(c.state.connected,true);assert.equal(c.state.model,'actual-model');assert.ok(calls.some(x=>x.action==='native'&&x.op==='authenticate'));
});
test('denied permission and missing companion never create a connected state',async()=>{
 const {controller:c,permissions,calls}=fixture();permissions.request=()=>Promise.resolve(false);await c.connect();assert.equal(c.state.connected,false);assert.equal(calls.length,0);assert.match(c.state.error,/permission/i);
 const missing=fixture({native:()=>{throw Error('Native companion not installed');}}).controller;await missing.connect();assert.equal(missing.state.connected,false);assert.match(missing.state.error,/not installed/);
});
test('fresh context is collected for each send and only user/assistant text is sent',async()=>{
 let count=0;const {controller:c,calls}=fixture({collect:data=>({scopeKey:'assignment-a',text:'Version '+(++count),included:data.ids.map(id=>({id,title:id})),omitted:[]})});
 await c.connect();c.setMode('connected');c.setDraft('Explain this');await c.preview();await c.send();
 const chat=calls.find(x=>x.op==='chat');assert.ok(chat);assert.match(chat.messages[0].content,/Explain this\n\n---\n\nVersion 2/);assert.equal(chat.model,'actual-model');assert.equal('tools' in chat,false);assert.deepEqual(Object.keys(chat.messages[0]).sort(),['content','role']);assert.equal(c.state.draft,'');
});
test('later turns do not resend removed source bundles through conversation history',async()=>{
 const {controller:c,calls}=fixture();await c.connect();c.setMode('connected');c.setDraft('First question');await c.send();
 assert.match(calls.find(x=>x.op==='chat').messages[0].content,/Selected reference/);
 c.setSelection('a',false);c.setDraft('Follow-up without that document');await c.send();
 const chats=calls.filter(x=>x.op==='chat');assert.equal(chats.length,2);
 assert.deepEqual(chats[1].messages.map(x=>x.content),['First question','A real result from the test transport','Follow-up without that document']);
});
test('identity-only authorization explicitly repeats consent for plan usage',async()=>{
 let authorized=false;const {controller:c,calls}=fixture({native:data=>{
  if(data.op==='authenticate'){authorized=true;return {connected:true};}
  if(data.op==='models')return {models:[{id:'actual-model',name:'Actual model'}]};
  return {connected:true,planUsageEnabled:authorized};
 }});await c.connect();assert.equal(c.state.connected,true);assert.equal(calls.find(x=>x.op==='authenticate').reauthorize,true);
});
test('omissions stop sharing until reviewed; changed omissions require another review',async()=>{
 let issue='Unreadable PDF';const {controller:c,calls}=fixture({collect:()=>({scopeKey:'assignment-a',text:'Available text',included:[{id:'a',title:'a'}],omitted:[{title:'Linked PDF',reason:issue}]})});
 await c.connect();c.setMode('connected');c.setDraft('Explain');await c.send();assert.equal(calls.filter(x=>x.op==='chat').length,0);assert.equal(c.state.draft,'Explain');assert.ok(c.state.context.issues.length);
 c.acceptIssues(true);issue='New unavailable source';await c.send();assert.equal(calls.filter(x=>x.op==='chat').length,0);
 c.acceptIssues(true);await c.send();assert.equal(calls.filter(x=>x.op==='chat').length,1);
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
 const {controller:c,calls}=fixture({web:()=>({status:'no-editor',message:'Open a conversation first'})});c.setDraft('Keep my question');await c.inject();assert.match(c.state.fallback,/Keep my question/);assert.match(c.state.fallback,/Selected reference/);assert.equal(c.state.draft,'Keep my question');assert.equal(calls.filter(x=>x.op==='chat').length,0);
});
test('empty home selection allows prompt-only chat without added hidden context',async()=>{
 const {controller:c,calls}=fixture({collect:()=>({scopeKey:'home',text:'',included:[],omitted:[]})});c.setCatalog(scope('home',null));await c.connect();c.setMode('connected');c.setDraft('Hello');await c.send();const chat=calls.find(x=>x.op==='chat');assert.equal(chat.messages[0].content,'Hello');
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
 const {controller:c,calls}=fixture();c.setCatalog({...scope(),demo:true});await c.connect();c.setDraft('Test');await c.send();await c.inject();assert.equal(c.state.connected,false);assert.equal(calls.filter(x=>x.action==='native'||x.action==='web').length,0);assert.match(c.state.error,/preview/i);
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
 const second=t.request('catalog');const rejected=assert.rejects(second,/disconnect/i);e.disconnects[0]();await rejected;assert.equal(e.sent.length,2);t.dispose();
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

test('unrequested sources returned by collect never reach a provider',async()=>{
 const {controller:c,calls}=fixture({collect:()=>({scopeKey:'assignment-a',text:'Hidden source',included:[{id:'a',title:'a'},{id:'secret',title:'secret'}],omitted:[]})});c.setDraft('Explain');await c.inject();assert.equal(calls.filter(x=>x.op==='inject').length,0);assert.match(c.state.error,/unselected|unexpected/i);
 const home=fixture({collect:()=>({scopeKey:'home',text:'Stale home context',included:[],omitted:[]})});home.controller.setCatalog(scope('home',null));home.controller.setDraft('Hello');await home.controller.inject();assert.equal(home.calls.filter(x=>x.op==='inject').length,0);
});
test('cancelled companion completion cannot turn a partial stream into a successful exchange',async()=>{
 const {controller:c}=fixture({native:(data,options)=>{
  if(data.op==='models')return {models:[{id:'real',name:'Real'}]};if(data.op==='chat'){options.onDelta('Partial answer');return {type:'done',reason:'cancelled'};}return {connected:true};
 }});await c.connect();c.setMode('connected');c.setDraft('Keep this');await c.send();assert.equal(c.state.draft,'Keep this');assert.equal(c.state.messages.length,0);assert.equal(c.state.history.at(-1).status,'error');
});
test('closing during context collection prevents later sharing and closes immediately',async()=>{
 const pending=deferred();const {controller:c,calls}=fixture({collect:()=>pending.promise});c.setDraft('Draft');const injecting=c.inject();await tick();await c.close();assert.ok(calls.some(x=>x.action==='close'));pending.resolve({scopeKey:'assignment-a',text:'context',included:[{id:'a',title:'a'}],omitted:[]});await injecting;assert.equal(calls.filter(x=>x.op==='inject').length,0);assert.equal(c.state.draft,'Draft');
});
test('cancel targets the active request and ignores late deltas or final results',async()=>{
 const pending=deferred();let stream;const {controller:c,calls}=fixture({native:(data,options)=>{
  if(data.op==='models')return {models:[{id:'real',name:'Real'}]};if(data.op==='chat'){stream=options.onDelta;return pending.promise;}return {connected:true};
 }});await c.connect();c.setMode('connected');c.setDraft('Question');const sending=c.send();await tick();stream('Partial');const id=c.state.activeChat.id;await c.cancel();stream(' late');pending.resolve({text:'Late final'});await sending;assert.equal(c.state.history.at(-1).content,'Partial');assert.equal(c.state.draft,'Question');assert.equal(c.state.messages.length,0);assert.ok(calls.some(x=>x.op==='cancel'&&x.requestId===id));
});

// Optional real Chromium checks use the runtime supplied by the harness. They
// exercise only localhost and test doubles, never credentials or live AI calls.
if(process.env.CH_AI_PANEL_BROWSER_TESTS){
 test('browser: isolated preview, safe text, context review, themes, responsive dock and keyboard composer',{timeout:60000},async()=>{
  const http=require('node:http');
  const {chromium}=require(process.env.CH_AI_PANEL_PLAYWRIGHT||'playwright');
  const extensionDir=path.resolve(__dirname,'../extension');
  const server=http.createServer((req,res)=>{
   if(req.url==='/'){
    res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><style>body{margin:24px;background:#eee;font:14px system-ui}iframe{width:400px;height:650px;border:1px solid #ccc;border-radius:12px}button{vertical-align:top;margin:16px}</style></head><body><iframe title="AI panel" src="/extension/ai-panel.html"></iframe><button id="outside" onclick="this.textContent='Canvas still works'">Canvas action</button><script>
     window.__requests=[];window.__catalog=${JSON.stringify({...scope(),demo:true})};
     addEventListener('message',event=>{const frame=document.querySelector('iframe');if(event.source!==frame.contentWindow||event.origin!==location.origin||event.data?.type!=='ch-ai-request')return;
      const r=event.data.request;window.__requests.push(r);let result;
      if(r.action==='catalog'||r.action==='load-course')result=window.__catalog;
      if(r.action==='collect')result={scopeKey:window.__catalog.scopeKey,text:r.ids.length?'Instructions: <img src=x onerror=alert(1)> is literal source text.':'',included:r.ids.filter(x=>x!=='b').map(id=>({id,title:'Assignment instructions'})),omitted:r.ids.includes('b')?[{title:'Reading B',reason:'PDF could not be read'}]:[]};
      if(r.action==='pdf')result={text:'Local PDF reference',pages:1,totalPages:2,truncated:true,warnings:['Second page omitted']};
      frame.contentWindow.postMessage({type:'ch-ai-reply',reply:{id:r.id,ok:true,result}},location.origin);
     });
    </script></body></html>`);return;
   }
   const basename=path.basename(new URL(req.url,'http://localhost').pathname);const relative=req.url.includes('/fonts/')?'fonts/'+basename:basename;
   if(!/^[a-zA-Z0-9_.\/-]+$/.test(relative)){res.writeHead(400);res.end();return;}
   const file=path.join(extensionDir,relative);fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'font/woff2');res.end(body);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
   browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:900,height:740}});
   await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/');const f=page.frameLocator('iframe');
   await f.locator('#scope-label').filter({hasText:'Assignment a'}).waitFor();
   assert.equal(await f.locator('#demo-label').isVisible(),true);assert.equal(await f.locator('#send').isDisabled(),true);
   await f.locator('#context-details summary').click();assert.equal(await f.locator('[data-source-id="a"]').isChecked(),true);
   await f.locator('#preview').click();await f.locator('#context-text').filter({hasText:'literal source text'}).waitFor();assert.equal(await f.locator('#context-text img').count(),0);
   await f.locator('[data-source-id="b"]').check();await f.locator('#preview').click();await f.locator('#context-issues').waitFor();assert.match(await f.locator('#issue-list').innerText(),/PDF could not be read/);
   await f.locator('#accept-issues').check();await f.locator('#all-linked').check();await f.locator('#preview').click();
   await page.waitForFunction(()=>window.__requests.some(x=>x.action==='collect'&&x.all===true));
   const all=await page.evaluate(()=>window.__requests.filter(x=>x.action==='collect').at(-1));assert.deepEqual(all.ids,['a']);assert.equal(all.all,true);
   await f.locator('#pdf-input').setInputFiles({name:'notes.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF- test fixture')});await f.locator('.pdf-item').waitFor();
   await f.locator('#prompt').fill('Preserved draft');
   await page.evaluate(catalog=>{window.__catalog=catalog;document.querySelector('iframe').contentWindow.postMessage({type:'ch-ai-reply',reply:{kind:'catalog',data:catalog}},location.origin);},{...scope('home',null),demo:true,theme:'dark',motion:'off'});
   await f.locator('#selection-summary').filter({hasText:'Nothing selected'}).waitFor();assert.equal(await f.locator('.pdf-item').count(),0);assert.equal(await f.locator('#prompt').inputValue(),'Preserved draft');
   assert.equal(await f.locator('html').getAttribute('data-theme'),'dark');assert.equal(await f.locator('html').getAttribute('data-motion'),'off');
   await f.locator('#context-details summary').click();await f.locator('#route-connected').click();assert.equal(await f.locator('#connect').isDisabled(),true);assert.equal(await f.locator('#connection-info a').getAttribute('href'),'https://github.com/Flzsh/canvas-harness/blob/main/companion/README.md');
   await page.locator('#outside').click();assert.equal(await page.locator('#outside').innerText(),'Canvas still works');
   for(const width of [400,320]){
    await page.locator('iframe').evaluate((el,width)=>{el.style.width=width+'px';},width);
    const layout=await f.locator('body').evaluate(body=>({width:body.clientWidth,scroll:body.scrollWidth,composer:document.getElementById('composer').getBoundingClientRect().bottom,height:innerHeight,bodyHeight:document.getElementById('scrollbox').clientHeight}));
    assert.ok(layout.scroll<=layout.width,JSON.stringify(layout));assert.ok(layout.composer<=layout.height,JSON.stringify(layout));assert.ok(layout.bodyHeight>70);
   }
   await page.locator('iframe').evaluate(el=>{el.style.width='400px';});
   if(process.env.CH_AI_PANEL_SCREENSHOT)await page.locator('iframe').screenshot({path:process.env.CH_AI_PANEL_SCREENSHOT});
   assert.deepEqual(errors,[]);
   await context.close();

   // An extension-port double verifies production UI controls and streaming.
   // It exists only in this test process; preview code cannot enable it.
   const production=await browser.newContext({viewport:{width:900,height:740}});
   await production.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   await production.addInitScript(catalog=>{
    if(!location.pathname.endsWith('/ai-panel.html'))return;
    const receive=[];let authorized=false;window.__requests=[];window.__permissionGestures=[];
    window.__emit=reply=>receive.forEach(fn=>fn(reply));
    window.__complete=()=>window.__emit({id:window.__chat.id,ok:true,result:{type:'done',reason:'completed',verified:true}});
    const port={onMessage:{addListener:fn=>receive.push(fn),removeListener(){}},onDisconnect:{addListener(){},removeListener(){}},disconnect(){},postMessage:r=>{
     window.__requests.push(r);queueMicrotask(()=>{
      let result={};if(r.action==='catalog')result=catalog;
      if(r.action==='collect')result={scopeKey:catalog.scopeKey,text:'Fresh selected context',included:r.ids.map(id=>({id,title:'Instructions'})),omitted:[]};
      if(r.action==='native'){
       if(r.op==='status')result={connected:authorized,account:{label:'Test account'}};
       if(r.op==='authenticate'){authorized=true;result={connected:true};}
       if(r.op==='models')result={models:[{slug:'account-test-model',display_name:'Account test model',visibility:'list'}]};
       if(r.op==='chat'){window.__chat=r;window.__emit({id:r.id,kind:'delta',text:'Plain <img src=x> answer'});return;}
       if(r.op==='cancel')result={type:'done',reason:'cancelled',cancelled:true};
       if(r.op==='signout'){authorized=false;result={connected:false};}
      }
      window.__emit({id:r.id,ok:true,result});
     });
    }};
    Object.defineProperty(window,'chrome',{configurable:true,value:{runtime:{id:'test-extension',connect:()=>port},permissions:{contains:(_value,cb)=>cb(false),request:(_value,cb)=>{window.__permissionGestures.push(navigator.userActivation.isActive);cb(true);}}}});
   },scope());
   const p=await production.newPage();const productionErrors=[];p.on('pageerror',error=>productionErrors.push(error.message));await p.goto('http://127.0.0.1:'+server.address().port+'/');const panel=p.frameLocator('iframe');
   await panel.locator('#scope-label').filter({hasText:'Assignment a'}).waitFor();await panel.locator('#route-connected').click();await panel.locator('#connect').click();
   await panel.locator('#account-label').filter({hasText:'Test account · Connected'}).waitFor();assert.equal(await panel.locator('#model').inputValue(),'account-test-model');
   assert.deepEqual(await panel.locator('body').evaluate(()=>window.__permissionGestures),[true]);
   await panel.locator('#prompt').fill('Explain');await panel.locator('#prompt').press('Shift+Enter');assert.equal(await panel.locator('#prompt').inputValue(),'Explain\n');
   await panel.locator('#prompt').press('Enter');await panel.locator('[data-status="streaming"]').waitFor();
   assert.equal(await panel.locator('#history img').count(),0);const sent=await panel.locator('body').evaluate(()=>window.__chat);assert.match(sent.messages.at(-1).content,/Explain\n\n---\n\nFresh selected context/);
   await panel.locator('body').evaluate(()=>window.__complete());await panel.locator('[data-status="complete"]').waitFor();assert.equal(await panel.locator('#prompt').inputValue(),'');
   await panel.locator('#prompt').fill('Keep my next draft');await panel.locator('#prompt').press('Enter');await panel.locator('[data-status="streaming"]').waitFor();await panel.locator('#stop').click();
   await panel.locator('#notice').filter({hasText:'Response stopped'}).waitFor();assert.equal(await panel.locator('#prompt').inputValue(),'Keep my next draft');
   const cancelled=await panel.locator('body').evaluate(()=>window.__requests.filter(x=>x.op==='cancel').at(-1));assert.ok(cancelled.requestId);
   await panel.locator('body').evaluate(()=>{window.__emit({id:window.__chat.id,kind:'delta',text:' UNWANTED LATE TEXT'});window.__complete();});assert.doesNotMatch(await panel.locator('#history').innerText(),/UNWANTED/);
   await panel.locator('#signout').click();await panel.locator('#account-label').filter({hasText:'not connected'}).waitFor();assert.equal(await panel.locator('#history article').count(),0);assert.equal(await panel.locator('#prompt').inputValue(),'Keep my next draft');
   assert.deepEqual(productionErrors,[]);await production.close();
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
 });
}
