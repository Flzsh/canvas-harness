'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const tick=()=>new Promise(setImmediate);
function event(){const listeners=[];return {addListener:fn=>listeners.push(fn),removeListener:fn=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);},emit:(...args)=>listeners.map(fn=>fn(...args))};}
function port(name,sender){return {name,sender,sent:[],onMessage:event(),onDisconnect:event(),postMessage(value){this.sent.push(value);},disconnect(){this.disconnected=true;this.onDisconnect.emit();}};}
function worker(){
 const imports=[],runtime={id:'extension-id',getURL:file=>'chrome-extension://extension-id/'+file,onConnect:event(),onMessage:event()};let installing=true;
 const chrome={runtime,storage:{local:{get:async()=>({})}},tabs:{get:async id=>({id,url:'https://school.instructure.com/'})}};
 const env=vm.createContext({TextEncoder,TextDecoder,structuredClone,chrome,URL,setTimeout,clearTimeout});
 env.importScripts=(...files)=>{if(!installing)throw Error('MV3 prohibits late importScripts');imports.push(...files);for(const file of files)vm.runInContext(read(file),env,{filename:file});};
 vm.runInContext(read('background.js'),env,{filename:'background.js'});installing=false;
 return {env,runtime,imports,sender:{id:runtime.id,tab:{id:4},frameId:0,url:'https://school.instructure.com/courses/7/assignments/12'}};
}

test('AI helpers are ready at worker evaluation and early source and panel messages survive initialization',async()=>{
 const w=worker();for(const file of ['ai-providers.js','ai-inject.js','ai-web.js'])assert.ok(w.imports.includes(file),file+' must be imported at worker start');
 let calls=0;w.env.CanvasHarnessWeb={handle:async()=>{calls++;return {status:'ready'};}};
 const source=port('ch-ai-source',w.sender);w.runtime.onConnect.emit(source);
 source.onMessage.emit({kind:'catalog',data:{scopeKey:'https://school.instructure.com|7|10|1',sources:[]}});
 const panel=port('ch-ai-panel',{id:w.runtime.id,tab:{id:4},frameId:1,url:w.runtime.getURL('ai-panel.html')});w.runtime.onConnect.emit(panel);
 panel.onMessage.emit({id:'status',action:'web',op:'status',provider:'chatgpt'});await tick();await tick();
 assert.equal(calls,1);assert.equal(panel.sent.at(-1)?.ok,true);panel.disconnect();source.disconnect();
});

test('an early port that disconnects while trusted sites load never reconnects',async()=>{
 const w=worker(),source=port('ch-ai-source',w.sender);w.runtime.onConnect.emit(source);source.disconnect();await tick();
 assert.equal(source.disconnected,true);assert.equal(source.sent.length,0);assert.equal(source.onMessage.emit({kind:'catalog',data:{scopeKey:'unused'}}).length,0);
});

test('real worker retains an early draft for a late panel and acknowledges without a context or provider request',async()=>{
 const w=worker(),scopeKey='https://school.instructure.com|7|all|',draft={id:'real-worker-draft',scopeKey,text:'An original Biscuit line'};w.env.fetch=async()=>assert.fail('Draft handoff must not read account or provider data');let providerCalls=0;w.env.CanvasHarnessWeb={handle:async()=>{providerCalls++;throw Error('No explicit Send');}};
 const source=port('ch-ai-source',w.sender);w.runtime.onConnect.emit(source);source.onMessage.emit({kind:'catalog',data:{scopeKey,sources:[],courses:[]}});source.onMessage.emit({kind:'draft',draft});await tick();
 const panel=port('ch-ai-panel',{id:w.runtime.id,tab:{id:4},frameId:1,url:w.runtime.getURL('ai-panel.html')});w.runtime.onConnect.emit(panel);await tick();assert.deepEqual(panel.sent.map(message=>message.kind),['catalog','draft']);assert.deepEqual(JSON.parse(JSON.stringify(panel.sent[1].draft)),draft);
 panel.onMessage.emit({kind:'draft-ack',id:draft.id,scopeKey});assert.equal(source.sent.at(-1).kind,'draft-ack');assert.equal(source.sent.some(message=>message.kind==='source-request'),false);assert.equal(providerCalls,0);panel.disconnect();source.disconnect();
});

test('real worker refuses draft ports when the public AI feature is disabled',async()=>{
 const w=worker();w.env.chrome.storage.local.get=async()=>({'reserve:features':{preset:'lite'}});const source=port('ch-ai-source',w.sender),panel=port('ch-ai-panel',{id:w.runtime.id,tab:{id:4},frameId:1,url:w.runtime.getURL('ai-panel.html')});w.runtime.onConnect.emit(source);source.onMessage.emit({kind:'catalog',data:{scopeKey:'https://school.instructure.com|7|all|',sources:[]}});source.onMessage.emit({kind:'draft',draft:{id:'disabled',scopeKey:'https://school.instructure.com|7|all|',text:'Disabled question'}});w.runtime.onConnect.emit(panel);await tick();assert.equal(source.disconnected,true);assert.equal(panel.disconnected,true);assert.deepEqual(panel.sent,[]);
});
