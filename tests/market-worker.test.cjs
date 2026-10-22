'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{read,settle}=require('./market-fixture.cjs');
function event(){const all=[];return {addListener:fn=>all.push(fn),emit:(...args)=>all.map(fn=>fn(...args))};}
function harness(){
 const calls=[],runtime={id:'test',getURL:file=>'chrome-extension://test/'+file,onMessage:event(),onInstalled:event(),onStartup:event()},permissions={onAdded:event(),onRemoved:event(),contains:async()=>true};
 const receipts={},env=vm.createContext({URL,AbortSignal,chrome:{runtime,permissions,storage:{local:{get:async()=>({'reserve:packs:receipts':receipts}),set:async()=>{}}}},fetch:async()=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>({id:'7'})}),ReserveMarket:{sync:async()=>calls.push('sync')},ReserveMedia:{createPackStore:owner=>({listKits:async()=>calls.push(['migrate',owner]),reserve:async(ids,token)=>calls.push(['reserve',Array.from(ids),token]),release:async token=>calls.push(['release',token]),close(){}})},ReservePacks:{installed:async()=>[{id:'one'}],install:async(...args)=>calls.push(['install',...args]),remove:async id=>calls.push(['remove',id])}});
 require('./market-fixture.cjs').loadMarketSite(env);
 vm.runInContext(read('market-holds.js'),env,{filename:'market-holds.js'});vm.runInContext(read('market-worker.js'),env,{filename:'market-worker.js'});
 const sender={id:'test',frameId:0,tab:{id:4},url:'https://flzsh.github.io/canvas-harness-packs/'};
 async function request(message,source=sender){let reply;const result=runtime.onMessage.emit(message,source,value=>{reply=value;});await settle();return {reply:reply&&JSON.parse(JSON.stringify(reply)),handled:result.includes(true)};}
 return {env,calls,runtime,permissions,sender,request,receipts};
}
test('worker syncs on evaluation, startup, install and permission changes',async()=>{
 const h=harness();await settle();assert.deepEqual(h.calls,['sync']);for(const e of [h.runtime.onInstalled,h.runtime.onStartup,h.permissions.onAdded,h.permissions.onRemoved])e.emit({});await settle();assert.equal(h.calls.length,5);
});
test('worker accepts trusted market top-frame installs and reports only installed ids',async()=>{
 const h=harness();assert.deepEqual((await h.request({type:'market-installed'})).reply,{ok:true,installed:['one']});assert.deepEqual((await h.request({type:'market-install',entry:{id:'one'},bytes:'YQ=='})).reply,{ok:true});assert.deepEqual(JSON.parse(JSON.stringify(h.calls.at(-1))),['install',{id:'one'},'YQ==',{owner:{origin:'https://school.instructure.com',accountId:'7'}}]);
});
test('worker rejects foreign, navigated, subframe, traversal and revoked-permission senders',async()=>{
 const h=harness();for(const change of [{id:'other'},{frameId:1},{url:'https://evil.test/canvas-harness-packs/'},{url:'https://flzsh.github.io/other/'},{url:'https://flzsh.github.io/canvas-harness-packs/../other/'},{url:'https://flzsh.github.io/canvas-harness-packs/%2fother'},{url:'https://flzsh.github.io/canvas-harness-packs/?download=1'},{url:'https://user@flzsh.github.io/canvas-harness-packs/'},{tab:undefined}]){const reply=(await h.request({type:'market-install',entry:{},bytes:'YQ=='},{...h.sender,...change})).reply;assert.equal(reply?.ok,false);}
 h.permissions.contains=async()=>false;assert.equal((await h.request({type:'market-install'})).reply.ok,false);assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='install'),false);
});
test('only the popup can remove packs; malformed installs return failure',async()=>{
 const h=harness();assert.equal((await h.request({type:'market-remove',id:'one'})).reply.ok,false);assert.deepEqual((await h.request({type:'market-remove',id:'one'},{id:'test',url:'chrome-extension://test/popup.html'})).reply,{ok:true});assert.deepEqual(h.calls.at(-1),['remove','one']);
 h.env.ReservePacks.install=async()=>{throw Error('Tampered kit');};assert.deepEqual((await h.request({type:'market-install',entry:{},bytes:'bad'})).reply,{ok:false,reason:'Tampered kit'});
});
test('Canvas shared-kit removals and media holds verify the signed-in owner',async()=>{
 const h=harness(),owner={origin:'https://school.instructure.com',accountId:'7'},sender={id:'test',frameId:0,tab:{id:5},url:owner.origin+'/courses/10'},token='12345678-1234-4234-8234-123456789abc',kitId='12345678-1234-4234-8234-123456789def';h.receipts.one={kind:'kit',owner,kitId};
 assert.deepEqual((await h.request({type:'market-kit-remove',owner,kitId},sender)).reply,{ok:true});assert.deepEqual(h.calls.at(-1),['remove','one']);assert.deepEqual((await h.request({type:'market-media-hold',op:'reserve',owner,ids:[kitId],token},sender)).reply,{ok:true});assert.deepEqual(h.calls.at(-1),['reserve',[kitId],token]);const fetch=h.env.fetch;h.env.fetch=async()=>{throw Error('Account switched');};assert.deepEqual((await h.request({type:'market-media-hold',op:'release',owner,token},sender)).reply,{ok:true});assert.deepEqual(h.calls.at(-1),['release',token]);h.env.fetch=fetch;
 for(const message of [{type:'market-media-hold',op:'reserve',owner:{...owner,accountId:'8'},ids:[kitId],token},{type:'market-kit-remove',owner,kitId:'other'},{type:'market-media-hold',op:'delete',owner,token},{type:'market-media-hold',op:'reserve',owner,ids:'bad',token}])assert.equal((await h.request(message,sender)).reply.ok,false);assert.equal((await h.request({type:'market-media-hold',op:'release',owner,token})).reply.ok,false);
});

test('legacy migration is local, limited to own Canvas top-frame senders and validates its owner',async()=>{const h=harness(),owner={origin:'https://school.instructure.com',accountId:'7'},sender={id:'test',frameId:0,tab:{id:5},url:owner.origin+'/courses/10'};h.env.fetch=async()=>{throw Error('No network');};assert.deepEqual((await h.request({type:'market-media-migrate',owner},sender)).reply,{ok:true});assert.deepEqual(h.calls.at(-1),['migrate',owner]);for(const bad of [{...sender,frameId:1},{...sender,id:'foreign'},{...sender,url:'https://evil.test/'}])assert.equal((await h.request({type:'market-media-migrate',owner},bad)).reply.ok,false);for(const invalid of [{...owner,accountId:7},{...owner,accountId:'bad'},{...owner,origin:'https://evil.test'}])assert.equal((await h.request({type:'market-media-migrate',owner:invalid},sender)).reply.ok,false);});
