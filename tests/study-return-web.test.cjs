'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const Inject=require('../extension/ai-inject.js'),Study=require('../extension/study-prompts.js');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),tick=()=>new Promise(resolve=>setImmediate(resolve));
function event(){const listeners=new Set();return {listeners,addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn),emit(...args){for(const fn of [...listeners])fn(...args);}};}
function block(text,children=[]){return {reads:0,children,contains(node){return this.children.includes(node)||this.children.some(child=>child.contains(node));},get textContent(){this.reads++;return typeof text==='function'?text():text;}};}
function reader(nodes,guard={},url='https://chatgpt.com/c/study',extra={}){const self={},document=extra.document||{querySelectorAll(selector){return selector==='pre, code, code-block, .code-block__code, .code-block-content, .md-code-block'?nodes:[];},get textContent(){throw Error('Read whole page');},get body(){throw Error('Read chat text');}};const context={document,location:new URL(url),URL,self,top:self,__guard:{id:'chatgpt',origin:'https://chatgpt.com',kind:'practice',after:0,...guard},...extra};if(extra.settled){let time=0;context.Date=class extends Date{static now(){return time;}};vm.runInNewContext('('+Inject.readStudyBlock.toString()+')(__guard)',context);time=4000;}return vm.runInNewContext('('+Inject.readStudyBlock.toString()+')(__guard)',context);}
test('Help return captures only the Biscuit-offered study shapes for the shared parser',()=>{for(const kind of ['practice','reading','lab','rubric','fixes','notes'])assert.equal(reader([block(JSON.stringify({kind}))],{kind:'help',helpKinds:['practice','reading','lab','rubric','fixes','notes']}).status,'answer');for(const value of [{kind:'agent'},{kind:'summary'},{nested:{kind:'reading'}}])assert.equal(reader([block(JSON.stringify(value))],{kind:'help',helpKinds:['practice','reading','lab','rubric','fixes','notes']}).status,'waiting');});
test('serialized reader counts without reading old text and returns only the newest matching code block',()=>{
 const old=block(()=>{throw Error('Read older reply');}),wrong=block('{"kind":"reading","title":"Other"}'),nested=block('before {"kind":"practice","title":"Current"} after'),wrapper=block(()=>{throw Error('Read code toolbar');},[nested]);
 assert.equal(reader([old,wrong,wrapper,nested],{countOnly:true}).count,3);assert.equal(old.reads,0);assert.equal(wrong.reads,0);
 const result=reader([old,wrong,wrapper,nested],{after:1});assert.equal(result.status,'answer');assert.equal(result.text,'before {"kind":"practice","title":"Current"} after');assert.equal(result.index,2);assert.equal(old.reads,0);
 assert.equal(reader([old,wrong],{after:1}).status,'waiting');assert.equal(old.reads,0);
});
test('code reader follows study block extraction and rejects different, nested, or string kind markers',()=>{
 const samples=['```chstudy\n{"kind":"practice","title":"x"}\n```','```json\n{"kind":"practice","title":"x"}\n```','prefix {"kind":"practice","title":"x"} suffix'];
 for(const text of samples){assert.equal(JSON.parse(Study.block(text)).kind,'practice');assert.equal(reader([block(text)]).text,text);}
 for(const text of ['{"kind":"lab"}','{"answer":{"kind":"practice"}}','["kind","practice"]','{"text":"\\\"kind\\\":\\\"practice\\\""}','{"kind":"practice"','not JSON'])assert.equal(reader([block(text)]).status,'waiting',text);
 for(const id of ['chatgpt','claude','gemini','grok','deepseek','kimi','qwen','zai']){const provider=require('../extension/ai-providers.js').get(id),origin=new URL(provider.url).origin;assert.equal(reader([block('{"kind":"practice"}')],{id,origin},provider.url).status,'answer');}
});
test('serialized reader checks its own origin and top frame before touching the page',()=>{
 const secret=block(()=>{throw Error('Read at wrong origin');});
 for(const url of ['https://evil.test/','https://chatgpt.com.evil.test/','http://chatgpt.com/','https://u:p@chatgpt.com/'])assert.equal(reader([secret],{},url).status,'stopped');
 assert.equal(reader([secret],{},undefined,{top:{}}).status,'stopped');assert.equal(reader([secret],{id:'constructor'}).status,'stopped');assert.equal(secret.reads,0);
});
test('malformed code objects with the requested top-level kind reach the strict reader for errors',()=>{
 for(const text of ['{"kind":"practice",}','{"v":1,"kind":"practice","items": nope}','```chstudy\n{"kind":"practice","items":[\n```']){assert.equal(reader([block(text)],{},undefined,{settled:true}).text,text);assert.equal(Study.parse(text,'practice').ok,false);}
 for(const text of ['{"kind":"reading","nested":{"kind":"practice"},}','{"text":"kind","nested":{"kind":"practice"},}','{"kind":"practice-other",}'])assert.equal(reader([block(text)]).status,'waiting');
});
function harness(){
 let now=0,nextTimer=0,granted=true,holdTab=null,holdScript=null,autoSend=false;const timers=new Map(),scripts=[],session={},local={},sources=[],ext='a'.repeat(32),origin='https://school.instructure.com',scopeKey=origin+'|7|10|1';
 const nodes=[block('{"kind":"practice","title":"Old answer"}')],tabs=new Map([[1,{id:1,url:origin+'/',windowId:2}],[42,{id:42,url:'https://chatgpt.com/c/study',windowId:2}]]);
 session['ch-ai-web:v1:1:chatgpt']={sourceTab:1,provider:'chatgpt',tabId:42,origin:'https://chatgpt.com'};
 const runtime={id:ext,getURL:file=>'chrome-extension://'+ext+'/'+file,onConnect:event(),onMessage:event()},removed=event(),updated=event();
 const chrome={runtime,storage:{local:{async get(key){return structuredClone({[key]:local[key]});},async set(value){Object.assign(local,structuredClone(value));}},session:{async get(key){return key===null?session:{[key]:session[key]};},async set(value){Object.assign(session,value);},async remove(keys){for(const key of keys)delete session[key];}}},permissions:{async contains(details){assert.deepEqual(Array.from(details.origins),['https://chatgpt.com/*']);return granted;},request(){throw Error('Requested a new permission');}},tabs:{onRemoved:removed,onUpdated:updated,async get(id){if(holdTab&&id===42)await holdTab;if(!tabs.has(id))throw Error('Closed tab');return {...tabs.get(id)};},async update(id,details){assert.equal(id,42);Object.assign(tabs.get(id),details);return {...tabs.get(id)};},create(){throw Error('Opened another tab');}},windows:{async get(){return {type:'normal'};},async update(){}},scripting:{async executeScript(options){scripts.push(options);assert.equal(options.target.tabId,42);assert.deepEqual(Array.from(options.target.frameIds),[0]);assert.equal(options.world,'ISOLATED');if(holdScript)await holdScript;if(options.func.name==='insertDraft'){autoSend=options.args[1].autoSend;return [{frameId:0,result:{status:autoSend?'sent':'injected',message:'Ready'}}];}assert.equal(options.func.name,'readStudyBlock');return [{frameId:0,result:reader(nodes,options.args[0],tabs.get(42)?.url,{document:readerDocument,Date:ClockDate})}];}}};
 const readerDocument={querySelectorAll:selector=>selector==='pre, code, code-block, .code-block__code, .code-block-content, .md-code-block'?nodes:[]};
 class ClockDate extends Date {static now(){return now;}}
 const sandbox=vm.createContext({chrome,URL,crypto:webcrypto,AbortController,AbortSignal,TextEncoder,Date:ClockDate,setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,due:now+ms});return id;},clearTimeout:id=>timers.delete(id),fetch:async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})})});
 sandbox.importScripts=(...files)=>{for(const file of files)if(['features.js','site.js','ai-providers.js','ai-inject.js','ai-web.js'].includes(file))vm.runInContext(read(file),sandbox,{filename:file});};
 vm.runInContext(read('background.js'),sandbox);
 function port(name,url,frameId){return {name,sender:{id:ext,tab:{id:1},url,frameId},sent:[],onMessage:event(),onDisconnect:event(),postMessage(message){this.sent.push(message);},disconnect(){this.onDisconnect.emit();}};}
 const source=port('ch-ai-source',origin+'/',0);runtime.onConnect.emit(source);source.onMessage.emit({kind:'catalog',data:{scopeKey,sources:[],courses:[]}});const panel=port('ch-ai-panel',runtime.getURL('ai-panel.html'),1);runtime.onConnect.emit(panel);
 const send=(id,op,data={})=>panel.onMessage.emit({id,action:'web',op,provider:'chatgpt',scopeKey,studyKind:'practice',answerId:'send',...data});
 const result=id=>panel.sent.find(message=>message.id===id&&typeof message.ok==='boolean');
 return {chrome,scripts,nodes,timers,tabs,panel,source,removed,updated,session,local,scopeKey,result,send,get autoSend(){return autoSend;},grant:value=>{granted=value;},holdTab(value){holdTab=value;},holdScript(value){holdScript=value;},async inject(data={}){send('send','inject',{text:'Study message',bringAnswers:true,...data});await tick();assert.equal(result('send')?.result?.status,data.autoSend?'sent':'injected');},async watch(){send('watch','watch');await tick();},async advance(ms){const until=now+ms;while(true){const next=[...timers].filter(([,value])=>value.due<=until).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;now=next[1].due;timers.delete(next[0]);next[1].fn();await tick();}now=until;await tick();}};
}
for(const autoSend of [false,true])test('watch ignores old and other-kind blocks and waits 2.5 s after streamed JSON settles; autoSend='+autoSend,async()=>{
 const h=harness();await h.inject({autoSend});assert.equal(h.autoSend,autoSend);assert.equal(h.result('send').result.answerId,'send');assert.equal(h.scripts[0].args[0].countOnly,true);
 await h.watch();h.nodes.push(block('{"kind":"reading","title":"Wrong aid"}'));await h.advance(3000);assert.equal(h.result('watch'),undefined);
 let text='{"kind":"practice","title":"Draft"}';h.nodes.push(block(()=>text));await h.advance(500);await h.advance(2000);assert.equal(h.result('watch'),undefined);text='{"kind":"practice","title":"Final"}';await h.advance(500);await h.advance(2499);assert.equal(h.result('watch'),undefined);await h.advance(1);
 assert.equal(h.result('watch').result.text,text);const executions=h.scripts.length;await h.advance(10000);assert.equal(h.scripts.length,executions);assert.equal(JSON.stringify(h.session).includes('Final'),false);assert.deepEqual(h.local,{});assert.equal(h.updated.listeners.size,0);
});
test('an unreadable provider stops after sixty idle seconds and leaves no timers or tab listeners',async()=>{
 const h=harness();await h.inject();await h.watch();await h.advance(59999);assert.equal(h.result('watch'),undefined);await h.advance(1);assert.equal(h.result('watch').result.status,'unreadable');assert.equal(h.timers.size,0);assert.equal(h.updated.listeners.size,0);assert.equal(h.removed.listeners.size,1);
});
for(const stop of ['Stop','panel close','close action','tab close','navigation','pending navigation','source close','scope change'])test('watch stops on '+stop,async()=>{
 const h=harness();await h.inject();await h.watch();const count=h.scripts.length;
 if(stop==='Stop')h.panel.onMessage.emit({id:'cancel',action:'cancel',requestId:'watch'});
 if(stop==='panel close')h.panel.disconnect();
 if(stop==='close action')h.panel.onMessage.emit({id:'close',action:'close'});
 if(stop==='tab close'){h.tabs.delete(42);h.removed.emit(42);}
 if(stop==='navigation')h.updated.emit(42,{url:'https://evil.test/'},{url:'https://evil.test/'});
 if(stop==='pending navigation')h.updated.emit(42,{status:'loading'},{url:'https://chatgpt.com/',pendingUrl:'https://evil.test/'});
 if(stop==='source close')h.source.disconnect();
 if(stop==='scope change')h.source.onMessage.emit({kind:'catalog',data:{scopeKey:'https://school.instructure.com|7|other',sources:[],courses:[]}});
 await h.advance(1000);assert.equal(h.result('watch').result.status,'stopped');assert.equal(h.scripts.length,count);assert.equal(h.updated.listeners.size,0);
});
test('Stop during an in-flight tab check prevents any subsequent reader injection',async()=>{
 const h=harness();await h.inject();let release;h.holdTab(new Promise(resolve=>{release=resolve;}));await h.watch();const count=h.scripts.length;
 h.panel.onMessage.emit({id:'cancel',action:'cancel',requestId:'watch'});await tick();assert.equal(h.result('watch').result.status,'stopped');release();await h.advance(3000);assert.equal(h.scripts.length,count);
});
test('a stalled injected check still stops immediately and cannot deliver after Stop',async()=>{
 const h=harness();await h.inject();let release;h.holdScript(new Promise(resolve=>{release=resolve;}));await h.watch();h.panel.onMessage.emit({id:'cancel',action:'cancel',requestId:'watch'});await tick();assert.equal(h.result('watch').result.status,'stopped');const count=h.scripts.length;release();await h.advance(3000);assert.equal(h.scripts.length,count);assert.equal(h.updated.listeners.size,0);
});
test('a stalled injected check cannot extend the three-minute idle deadline',async()=>{
 const h=harness();await h.inject();let release;h.holdScript(new Promise(resolve=>{release=resolve;}));await h.watch();await h.advance(180000);assert.equal(h.result('watch').result.status,'timeout');release();await tick();assert.equal(h.timers.size,0);
});
test('closing during baseline capture prevents the pending draft insertion',async()=>{
 const h=harness();let release;h.holdScript(new Promise(resolve=>{release=resolve;}));h.send('send','inject',{text:'Study message',bringAnswers:true});await tick();assert.equal(h.scripts.length,1);h.panel.disconnect();release();await tick();assert.equal(h.scripts.length,1);assert.equal(h.result('send').result.answerId,undefined);
});
test('cancelling before background source validation finishes cannot start a late watch',async()=>{
 const h=harness();await h.inject();h.send('late','watch');h.panel.onMessage.emit({id:'cancel',action:'cancel',requestId:'late'});await tick();assert.equal(h.result('late').ok,false);assert.equal(h.scripts.length,2);assert.equal(h.updated.listeners.size,0);
});
test('one immediate read returns the newest matching block even after timeout or Stop',async()=>{
 const h=harness();await h.inject();await h.watch();h.panel.onMessage.emit({id:'cancel',action:'cancel',requestId:'watch'});await tick();h.nodes.push(block('{"kind":"practice","title":"New"}'),block('{"kind":"lab"}'));
 const count=h.scripts.length;h.send('read','read');await tick();assert.equal(h.scripts.length,count+1);assert.equal(h.result('read').result.text,'{"kind":"practice","title":"New"}');await h.advance(10000);assert.equal(h.scripts.length,count+1);
});
test('Bring it in never reads answers from before this send',async()=>{
 const h=harness();await h.inject();const old=h.nodes[0];await h.watch();assert.equal(old.reads,0);h.panel.onMessage.emit({id:'cancel',action:'cancel',requestId:'watch'});await tick();h.send('read','read');await tick();assert.equal(h.result('read').result.status,'waiting');assert.equal(old.reads,0);
});
test('Bring it in remains available after a three-minute idle watch timeout',async()=>{
 const h=harness();await h.inject();await h.watch();await h.advance(180000);h.nodes.push(block('{"kind":"practice","title":"Late"}'));const count=h.scripts.length;h.send('read','read');await tick();assert.equal(h.result('read').result.text,'{"kind":"practice","title":"Late"}',JSON.stringify(h.result('read')));assert.equal(h.scripts.length,count+1);
});
test('no permission, switched-off capture, or mismatched request permits answer injection',async()=>{
 for(const mode of ['permission','off','kind','provider','id','origin']){
  const h=harness();await h.inject({bringAnswers:mode!=='off'});if(mode==='permission')h.grant(false);if(mode==='origin')h.tabs.get(42).url='https://evil.test/';const count=h.scripts.length;
  h.send('read','read',{...(mode==='kind'?{studyKind:'lab'}:{}),...(mode==='provider'?{provider:'claude'}:{}),...(mode==='id'?{answerId:'another'}:{})});await tick();assert.notEqual(h.result('read')?.result?.status,'answer',mode);assert.equal(h.scripts.length,count,mode);
 }
});
test('a foreign tab event and same-origin route change do not stop the pinned tab watch',async()=>{
 const h=harness();await h.inject();await h.watch();h.updated.emit(123,{url:'https://evil.test/'},{});h.removed.emit(123);h.tabs.get(42).url='https://chatgpt.com/c/new';h.updated.emit(42,{url:h.tabs.get(42).url},h.tabs.get(42));h.nodes.push(block('{"kind":"practice"}'));await h.advance(3000);assert.equal(h.result('watch').result.status,'answer');
});
test('a navigation race between the tab guard and script execution reads no page text',async()=>{
 const h=harness();await h.inject();const execute=h.chrome.scripting.executeScript;h.chrome.scripting.executeScript=options=>{h.tabs.get(42).url='https://evil.test/';return execute(options);};await h.watch();assert.equal(h.result('watch').result.status,'stopped');assert.equal(h.nodes[0].reads,0);
});
test('only validated boolean panel preferences cross the background source boundary',async()=>{
 const h=harness();await tick();h.panel.onMessage.emit({id:'pref',action:'preference',bringAnswers:false});await tick();const pref=h.source.sent.at(-1);assert.equal(pref.bringAnswers,false);assert.equal(Object.hasOwn(pref,'autoSend'),false);
 for(const value of ['false',null,1]){const before=h.source.sent.length;h.panel.onMessage.emit({id:'bad'+String(value),action:'preference',bringAnswers:value});await tick();assert.equal(h.source.sent.length,before);}
 h.panel.disconnect();
});
async function mounted(t,kind){
 const h=harness(),Panel=require('../extension/ai-panel.js'),{dom}=require('./study-fixture.cjs'),d=dom(),events=new Map(),client={onMessage:event(),onDisconnect:event()};
 const catalog={scopeKey:h.scopeKey,selectedIds:['1'],courseId:'10',active:{id:'1',assignmentId:'1',title:'Study assignment',courseId:'10',courseName:'Biology'},sources:[{id:'1',kind:'assignment',title:'Instructions',courseId:'10'}],courses:[{id:'10',name:'Biology'}]};
 if(kind==='notes')catalog.sources[0].description='Reading chapter';
 const panelPost=h.panel.postMessage.bind(h.panel);h.panel.postMessage=message=>{panelPost(message);queueMicrotask(()=>client.onMessage.emit(message));};client.postMessage=message=>queueMicrotask(()=>h.panel.onMessage.emit(message));client.disconnect=()=>{h.panel.disconnect();client.onDisconnect.emit();};
 h.source.postMessage=message=>{if(message.kind!=='source-request')return;queueMicrotask(()=>h.source.onMessage.emit({id:message.id,ok:true,result:message.action==='catalog'?catalog:message.action==='collect'?{scopeKey:h.scopeKey,text:'Source words',included:[{id:'1',title:'Instructions'}],sources:[{id:'1',label:'Instructions',text:'Source words'}],omitted:[]}:{}}));};
 h.source.onMessage.emit({kind:'catalog',data:catalog});
 const controller=Panel.mount({document:d.document,crypto:webcrypto,setTimeout,clearTimeout,location:{origin:'chrome-extension://'+h.chrome.runtime.id},addEventListener:(key,fn)=>events.set(key,fn),navigator:{},chrome:{...h.chrome,runtime:{...h.chrome.runtime,connect:()=>client},permissions:{request(_request,callback){callback(true);}}}});
 t.after(()=>events.get('pagehide')());await tick();await controller.setMode(kind);assert.equal(await controller.inject(),true);await tick();return {...d,...h,controller};
}
for(const kind of ['practice','reading','lab','rubric','notes'])test('full mocked scripting/background/panel '+kind+' return saves and opens the aid',async t=>{
 const h=await mounted(t,kind),data=require('./study-fixture.cjs')[kind]();h.nodes.push(block(JSON.stringify(data)));await h.advance(3000);await tick();
 assert.equal(h.controller.state.currentAid?.kind,kind,JSON.stringify({error:h.controller.state.error,waiting:h.controller.state.waiting,scripts:h.scripts.map(s=>s.func.name)}));assert.equal(h.get('ch-study-viewer').hidden,false);const aids=Object.values(h.local).find(value=>value?.[kind+':1']);assert.ok(aids);assert.deepEqual(aids[kind+':1'].data,data);assert.equal(h.controller.state.studyErrors.length,0);
});
for(const badJSON of [false,true])test('full mocked return exposes '+(badJSON?'JSON':'schema')+' errors then Bring it in reads the fixed block once',async t=>{
 const h=await mounted(t,'practice'),{practice}=require('./study-fixture.cjs'),bad=badJSON?'{"kind":"practice",}':JSON.stringify({...practice(),items:[]});h.nodes.push(block(bad));await h.advance(badJSON?4500:3000);await tick();assert.equal(h.get('ch-study-answer').value,bad);assert.ok(h.controller.state.studyErrors.length);assert.deepEqual(h.local,{});
 const good=JSON.stringify(practice());h.nodes.push(block(good));const count=h.scripts.length;assert.equal(await h.controller.bringAnswer(),true);assert.equal(h.scripts.length,count+1);assert.equal(h.controller.state.currentAid.kind,'practice');assert.equal(h.get('ch-study-viewer').hidden,false);
});
