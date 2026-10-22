'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Site=require('../extension/site.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function event(){const listeners=[];return {addListener:f=>listeners.push(f),emit:(...a)=>listeners.forEach(f=>f(...a))};}
function port(name,sender){return {name,sender,sent:[],onMessage:event(),onDisconnect:event(),postMessage(m){this.sent.push(m);},disconnect(){this.disconnected=true;this.onDisconnect.emit();}};}
function harness(){
 const ext='a'.repeat(32),url='chrome-extension://'+ext+'/',origin='https://school.instructure.com';
 const native=port('native',{}),runtime={id:ext,onConnect:event(),onMessage:event(),getURL:f=>url+f,connectNative:()=>{runtime.connects++;return native;},connects:0};
 const web=[],fake={chrome:{runtime,storage:{local:{get:async()=>({})}},tabs:{get:async id=>({id,url:origin+'/'})}},ReserveSite:Site,ReserveFeatures:require('../extension/features.js'),CanvasHarnessWeb:{handle:async(m,s)=>{web.push({m,s});return {status:'injected'};}},importScripts:()=>{},crypto:crypto.webcrypto,TextEncoder,AbortSignal,URL,setTimeout,clearTimeout,fetch:async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/background.js'),'utf8'),fake);
 const source=port('ch-ai-source',{id:ext,frameId:0,tab:{id:1},url:origin+'/'});runtime.onConnect.emit(source);
 source.onMessage.emit({kind:'catalog',data:{scopeKey:origin+'|7|10|1',sources:[],courses:[]}});
 const panel=port('ch-ai-panel',{id:ext,frameId:1,tab:{id:1},url:url+'ai-panel.html'});runtime.onConnect.emit(panel);
 return {runtime,native,source,panel,web,fake,url,origin};
}
test('only the extension AI document in a Canvas tab can connect',()=>{
 const h=harness(),bad=port('ch-ai-panel',{id:h.runtime.id,frameId:1,tab:{id:1},url:'https://attacker.test/ai-panel.html'});
 h.runtime.onConnect.emit(bad);assert.equal(bad.disconnected,true);
});
test('context reply is routed to its originating panel and unknown replies are ignored',async()=>{
 const h=harness();h.panel.onMessage.emit({id:'pick-1',action:'collect',ids:['assignment:10:1']});await tick();
 const request=h.source.sent.at(-1);assert.equal(request.kind,'source-request');
 h.source.onMessage.emit({id:'unrelated',ok:true,result:'secret'});assert.ok(!h.panel.sent.some(m=>m.result==='secret'));
 h.source.onMessage.emit({id:request.id,ok:true,result:{text:'Selected instructions'}});
 assert.equal(h.panel.sent.at(-1).id,'pick-1');assert.equal(h.panel.sent.at(-1).result.text,'Selected instructions');h.panel.disconnect();
});

test('assignment PDF option crosses the runtime boundary only as a boolean',async()=>{
 const h=harness();
 for(const value of [true,false,'true']){
  h.panel.onMessage.emit({id:'pdf-'+String(value),action:'collect',ids:['assignment:10:1'],includeAssignmentPdfs:value});await tick();
  const request=h.source.sent.at(-1);assert.equal(request.includeAssignmentPdfs,value===true);
  h.source.onMessage.emit({id:request.id,ok:true,result:{text:''}});
 }
 h.panel.disconnect();
});
test('website insertion verifies current Canvas account before crossing origins',async()=>{
 const h=harness();h.fake.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'8'})});
 h.panel.onMessage.emit({id:'inject-1',action:'web',op:'inject',provider:'chatgpt',text:'Context',scopeKey:h.origin+'|7|10|1'});await tick();await tick();
 assert.equal(h.web.length,0);assert.match(h.panel.sent.at(-1).error,/account changed/);
 h.panel.disconnect();
});
test('a stale Canvas source disconnects AI panels and aborts their host work',async()=>{
 const h=harness();await tick();h.source.disconnect();assert.equal(h.panel.disconnected,true);
});
test('switching course during the final account check stops sharing stale context',async()=>{
 const h=harness();let finish;h.fake.fetch=()=>new Promise(resolve=>{finish=resolve;});
 h.panel.onMessage.emit({id:'inject-race',action:'web',op:'inject',provider:'chatgpt',text:'Old context',scopeKey:h.origin+'|7|10|1'});await tick();
 h.source.onMessage.emit({kind:'catalog',data:{scopeKey:h.origin+'|7|11|2',sources:[],courses:[]}});
 finish({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})});await tick();await tick();
 assert.equal(h.web.length,0);assert.match(h.panel.sent.at(-1).error,/view changed/);h.panel.disconnect();
});

test('removed native account actions are rejected without connecting a host',async()=>{
 const h=harness();h.panel.onMessage.emit({id:'old-native',action:'native',op:'authenticate'});await tick();
 assert.match(h.panel.sent.at(-1).error,/Unsupported AI action/);assert.equal(h.runtime.connects||0,0);h.panel.disconnect();
});
test('closing AI during the final account check prevents opening and sharing afterward',async()=>{
 const h=harness();let finish;h.fake.fetch=()=>new Promise(resolve=>{finish=resolve;});
 h.panel.onMessage.emit({id:'waiting-inject',action:'web',op:'inject',provider:'chatgpt',text:'Selected material',scopeKey:h.origin+'|7|10|1'});await tick();
 h.panel.onMessage.emit({id:'closing',action:'close'});await tick();
 finish({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})});await tick();await tick();
 assert.equal(h.web.length,0);assert.ok(h.panel.sent.some(x=>x.id==='waiting-inject'&&/closed/.test(x.error)));h.panel.disconnect();
});
test('closing AI while a provider loads revokes its handoff before insertion',async()=>{
 const h=harness();let guard,finish;h.fake.CanvasHarnessWeb.handle=(m,s,options)=>{guard=options.canShare;return new Promise(resolve=>{finish=resolve;});};
 h.panel.onMessage.emit({id:'web-wait',action:'web',op:'inject',provider:'chatgpt',text:'Selected material',scopeKey:h.origin+'|7|10|1'});await tick();await tick();assert.equal(guard(),true);
 h.panel.onMessage.emit({id:'closing',action:'close'});await tick();assert.equal(guard(),false);finish({status:'error',message:'Cancelled'});await tick();h.panel.disconnect();
});

test('optional send is forwarded only as an explicit boolean on the verified handoff',async()=>{
 const h=harness();h.panel.onMessage.emit({id:'send-option',action:'web',op:'inject',provider:'chatgpt',text:'Synthetic context',scopeKey:h.origin+'|7|10|1',autoSend:true});await tick();await tick();assert.equal(h.web[0].m.autoSend,true);h.panel.disconnect();
});

test('PDF reader context passes the existing account guard and an account change stops a later insertion',async()=>{
 const h=harness(),ai=require('../extension/ai-source.js');
 const handoff=ai.createPdfHandoff({origin:h.origin,accountId:'7',fileId:'42',name:'Geometry.pdf',page:0,text:'Exactly the selected line.'});
 const catalog=await handoff.catalog();h.source.onMessage.emit({kind:'catalog',data:catalog});
 const context=await handoff.collect({ids:catalog.selectedIds});
 const request={action:'web',op:'inject',provider:'chatgpt',text:context.text,scopeKey:catalog.scopeKey};
 h.panel.onMessage.emit({id:'pdf-insert',...request});await tick();await tick();assert.equal(h.web.length,1);assert.equal(h.web[0].m.text,context.text);assert.match(h.web[0].m.text,/Geometry\.pdf, page 1/);
 h.fake.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'8'})});
 h.panel.onMessage.emit({id:'pdf-account-switch',...request});await tick();await tick();assert.equal(h.web.length,1);assert.match(h.panel.sent.at(-1).error,/account changed/);handoff.destroy();h.panel.disconnect();
});

test('a pending draft reaches a late panel after its catalog and only a matching acknowledgement clears it',async()=>{
 const h=harness();await tick();h.panel.disconnect();h.fake.fetch=async()=>assert.fail('Draft handoff must not read Canvas or call a provider');const draft={id:'biscuit-draft',scopeKey:h.origin+'|7|10|1',text:'Explain π exactly\n  original spacing'};
 h.source.onMessage.emit({kind:'draft',draft});const later=port('ch-ai-panel',h.panel.sender);h.runtime.onConnect.emit(later);await tick();assert.deepEqual(later.sent.map(message=>message.kind),['catalog','draft']);assert.deepEqual(JSON.parse(JSON.stringify(later.sent[1].draft)),draft);
 later.onMessage.emit({kind:'draft-ack',id:draft.id,scopeKey:'wrong'});assert.equal(h.source.sent.some(message=>message.kind==='draft-ack'),false);
 later.onMessage.emit({kind:'draft-ack',id:draft.id,scopeKey:draft.scopeKey});assert.equal(h.source.sent.at(-1).kind,'draft-ack');later.disconnect();const after=port('ch-ai-panel',h.panel.sender);h.runtime.onConnect.emit(after);await tick();assert.deepEqual(after.sent.map(message=>message.kind),['catalog']);assert.equal(h.web.length,0);after.disconnect();h.source.disconnect();
});

test('draft protocol rejects account, scope, origin, size and stale source mismatches',async()=>{
 const h=harness();await tick();const draft={id:'valid-draft',scopeKey:h.origin+'|7|10|1',text:'Question'},before=h.panel.sent.length;
 for(const bad of [{...draft,scopeKey:h.origin+'|8|10|1'},{...draft,scopeKey:'https://other.instructure.com|7|10|1'},{...draft,scopeKey:h.origin+'|7|20|2'},{...draft,text:'x'.repeat(20001)},{...draft,text:'bad\u0000text'},{...draft,id:'not a valid id'}])h.source.onMessage.emit({kind:'draft',draft:bad});assert.equal(h.panel.sent.length,before);
 h.source.onMessage.emit({kind:'draft',draft});assert.equal(h.panel.sent.at(-1).kind,'draft');const newer={...draft,id:'newer-draft',text:'Newer question'};h.source.onMessage.emit({kind:'draft',draft:newer});h.panel.onMessage.emit({kind:'draft-ack',id:draft.id,scopeKey:draft.scopeKey});assert.equal(h.source.sent.some(message=>message.kind==='draft-ack'),false);
 h.source.onMessage.emit({kind:'catalog',data:{scopeKey:h.origin+'|7|20|2',sources:[],courses:[]}});h.panel.disconnect();const next=port('ch-ai-panel',h.panel.sender);h.runtime.onConnect.emit(next);await tick();assert.deepEqual(next.sent.map(message=>message.kind),['catalog']);
 const replacement=port('ch-ai-source',h.source.sender);h.runtime.onConnect.emit(replacement);await tick();replacement.onMessage.emit({kind:'catalog',data:{scopeKey:draft.scopeKey,sources:[],courses:[]}});h.source.onMessage.emit({kind:'draft',draft});const last=port('ch-ai-panel',h.panel.sender);h.runtime.onConnect.emit(last);await tick();assert.deepEqual(last.sent.map(message=>message.kind),['catalog']);assert.equal(h.web.length,0);last.disconnect();replacement.disconnect();
});

test('changing account drops a pending draft and disconnects the old panels',async()=>{
 const h=harness();await tick();const draft={id:'old-account',scopeKey:h.origin+'|7|10|1',text:'Old question'};h.source.onMessage.emit({kind:'draft',draft});h.source.onMessage.emit({kind:'catalog',data:{scopeKey:h.origin+'|8|all|',sources:[],courses:[]}});assert.equal(h.panel.disconnected,true);
 const next=port('ch-ai-panel',h.panel.sender);h.runtime.onConnect.emit(next);await tick();assert.equal(next.sent.some(message=>message.kind==='draft'),false);assert.equal(h.web.length,0);next.disconnect();h.source.disconnect();
});
