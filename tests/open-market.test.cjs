'use strict';
// "Get more" (Make it yours > More > Features): the worker answers open-market from the student's Canvas page the way the popup's
// "Open the market" opens the Market: a new tab at the Market's front page beside the Canvas tab, bound to that page's account.
// It ended in its error text before 4.2.0: no worker answered the message.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{read,settle,loadMarketSite}=require('./market-fixture.cjs');
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
function event(){const all=[];return {addListener:fn=>all.push(fn),emit:(...args)=>all.map(fn=>fn(...args))};}
const OWNER={origin:'https://school.instructure.com',accountId:'7'},CANVAS={id:'test',frameId:0,tab:{id:5,windowId:2},url:'https://school.instructure.com/courses/10'};
function harness({profile='7'}={}){
 const tabs=[],runtime={id:'test',getURL:file=>'chrome-extension://test/'+file,onMessage:event(),onInstalled:event(),onStartup:event()},permissions={onAdded:event(),onRemoved:event(),contains:async()=>true};
 const session=new Map(),env=vm.createContext({URL,AbortSignal,Headers,Response,console,chrome:{runtime,permissions,tabs:{query:async()=>[{url:'https://school.instructure.com/'}],create:async o=>{tabs.push(['create',clone(o)]);return {id:9};},update:async(id,o)=>{tabs.push(['update',id,clone(o)]);return {id};},onRemoved:event()},storage:{local:{get:async()=>({}),set:async()=>{}},session:{get:async keys=>Object.fromEntries([].concat(keys).filter(k=>session.has(k)).map(k=>[k,clone(session.get(k))])),set:async v=>{for(const [k,x]of Object.entries(v))session.set(k,clone(x));},remove:async keys=>{for(const k of [].concat(keys))session.delete(k);}}}},
  fetch:async()=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>({id:profile})}),ReserveMarket:{sync:async()=>{}},ReservePacks:{installed:async()=>[]},ReserveMedia:{createPackStore:()=>({close(){}})}});
 loadMarketSite(env);vm.runInContext(read('market-holds.js'),env,{filename:'market-holds.js'});vm.runInContext(read('market-worker.js'),env,{filename:'market-worker.js'});
 async function request(message,sender){let reply;runtime.onMessage.emit(message,sender,value=>{reply=value;});await settle();return reply&&clone(reply);}
 return {env,tabs,request};
}
test('"Get more" opens the Market beside the Canvas tab, bound to the student\'s account, as the popup\'s "Open the market" does',async()=>{
 const h=harness();assert.deepEqual(await h.request({type:'open-market',owner:OWNER},CANVAS),{ok:true});
 assert.deepEqual(h.tabs,[['create',{url:'about:blank',active:true,windowId:2,openerTabId:5}],['update',9,{url:'https://flzsh.github.io/canvas-harness-packs/'}]]);
 assert.deepEqual(clone(await h.env.ReserveMarketSite.bound(9)),OWNER,'the Market tab knows whose it is');
});
test('only the student\'s own Canvas page, for its own signed-in account, opens it',async()=>{
 for(const [message,sender] of [[{type:'open-market'},CANVAS],[{type:'open-market',owner:OWNER,url:'https://evil.test/'},CANVAS],[{type:'open-market',owner:{...OWNER,origin:'https://other.instructure.com'}},CANVAS],[{type:'open-market',owner:OWNER},{...CANVAS,frameId:1}],[{type:'open-market',owner:OWNER},{...CANVAS,url:'https://evil.test/'}],[{type:'open-market',owner:OWNER},{id:'test',url:'chrome-extension://test/popup.html'}]]){
  const h=harness();assert.equal((await h.request(message,sender)).ok,false,JSON.stringify([message,sender]));assert.deepEqual(h.tabs,[]);
 }
 const other=harness({profile:'8'});assert.equal((await other.request({type:'open-market',owner:OWNER},CANVAS)).ok,false,'another account signed in');assert.deepEqual(other.tabs,[]);
});
test('Make it yours sends the page\'s own account with "Get more"',()=>{
 assert.match(read('settings-dock.js').replace(/\n\s*/g,''),/sendMessage\(\{type:'open-market',owner:store\.owner\}\)/);
});
