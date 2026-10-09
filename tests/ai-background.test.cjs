'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Site=require('../extension/site.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function event(){const listeners=[];return {addListener:f=>listeners.push(f),emit:(...a)=>listeners.forEach(f=>f(...a))};}
function port(name,sender){return {name,sender,sent:[],onMessage:event(),onDisconnect:event(),postMessage(m){this.sent.push(m);},disconnect(){this.disconnected=true;this.onDisconnect.emit();}};}
function harness(){
 const ext='a'.repeat(32),url='chrome-extension://'+ext+'/',origin='https://school.instructure.com';
 const native=port('native',{}),runtime={id:ext,onConnect:event(),onMessage:event(),getURL:f=>url+f,connectNative:()=>{runtime.connects++;return native;},connects:0};
 const web=[],fake={chrome:{runtime,tabs:{get:async id=>({id,url:origin+'/'})}},ReserveSite:Site,CanvasHarnessWeb:{handle:async(m,s)=>{web.push({m,s});return {status:'injected'};}},importScripts:()=>{},crypto:crypto.webcrypto,TextEncoder,AbortSignal,URL,setTimeout,clearTimeout,fetch:async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})})};
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
test('website insertion verifies current Canvas account before crossing origins',async()=>{
 const h=harness();h.fake.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'8'})});
 h.panel.onMessage.emit({id:'inject-1',action:'web',op:'inject',provider:'chatgpt',text:'Context',scopeKey:h.origin+'|7|10|1'});await tick();await tick();
 assert.equal(h.web.length,0);assert.match(h.panel.sent.at(-1).error,/account changed/);
 h.panel.disconnect();
});
test('native authorization progress is not mistaken for a completed connection',async()=>{
 const h=harness();h.panel.onMessage.emit({id:'auth-1',action:'native',op:'authenticate'});await tick();
 h.native.onMessage.emit({id:'auth-1',type:'auth',state:'opening_browser'});
 assert.ok(!h.panel.sent.some(m=>m.id==='auth-1'));
 h.native.onMessage.emit({id:'auth-1',type:'auth',state:'authorized',authorized:true,verified:false});
 assert.equal(h.panel.sent.at(-1).result.connected,true);assert.equal(h.panel.sent.at(-1).result.verified,false);h.panel.disconnect();
});
test('one native host is shared, with targeted stream routing and no arbitrary request fields',async()=>{
 const h=harness();h.panel.onMessage.emit({id:'status-1',action:'native',op:'status',token:'must-not-forward'});await tick();
 assert.deepEqual(JSON.parse(JSON.stringify(h.native.sent.at(-1))),{id:'status-1',op:'status'});
 const second=port('ch-ai-panel',{...h.panel.sender,frameId:2});h.runtime.onConnect.emit(second);
 second.onMessage.emit({id:'status-2',action:'native',op:'status'});await tick();assert.equal(h.runtime.connects,1);
 h.native.onMessage.emit({id:'status-1',type:'status',authorized:false});assert.ok(!second.sent.some(m=>m.id==='status-1'));
 h.panel.disconnect();second.disconnect();
});
test('a stale Canvas source disconnects AI panels and aborts their host work',()=>{
 const h=harness();h.source.disconnect();assert.equal(h.panel.disconnected,true);
});
test('switching course during the final account check stops sharing stale context',async()=>{
 const h=harness();let finish;h.fake.fetch=()=>new Promise(resolve=>{finish=resolve;});
 h.panel.onMessage.emit({id:'inject-race',action:'web',op:'inject',provider:'chatgpt',text:'Old context',scopeKey:h.origin+'|7|10|1'});await tick();
 h.source.onMessage.emit({kind:'catalog',data:{scopeKey:h.origin+'|7|11|2',sources:[],courses:[]}});
 finish({ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'7'})});await tick();await tick();
 assert.equal(h.web.length,0);assert.match(h.panel.sent.at(-1).error,/view changed/);h.panel.disconnect();
});
test('renewed consent is forwarded explicitly and duplicate IDs cannot steal a pending reply',async()=>{
 const h=harness();h.panel.onMessage.emit({id:'auth-1',action:'native',op:'authenticate',reauthorize:true,scope:'extra'});await tick();
 assert.deepEqual(JSON.parse(JSON.stringify(h.native.sent.at(-1))),{id:'auth-1',op:'authenticate',reauthorize:true});
 const second=port('ch-ai-panel',{...h.panel.sender,frameId:2});h.runtime.onConnect.emit(second);
 second.onMessage.emit({id:'auth-1',action:'native',op:'status'});await tick();
 assert.match(second.sent.at(-1).error,/already active/);
 h.native.onMessage.emit({id:'auth-1',type:'auth',state:'authorized',authorized:true});
 assert.equal(h.panel.sent.at(-1).result.connected,true);assert.ok(!second.sent.some(m=>m.result?.connected));h.panel.disconnect();second.disconnect();
});
