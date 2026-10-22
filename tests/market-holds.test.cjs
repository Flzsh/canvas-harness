'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{read,settle}=require('./market-fixture.cjs'),{webcrypto}=require('node:crypto');
const OWNER={origin:'https://school.instructure.com',accountId:'7'},SESSION='reserve:market-holds',OWNERS='reserve:market-hold-owners',POOL='reserve:market-media:'+JSON.stringify([OWNER.origin,OWNER.accountId])+':index';
function event(){const handlers=[];return {addListener:fn=>handlers.push(fn),emit:(...args)=>handlers.map(fn=>fn(...args))};}
function harness({data={},session={},live=new Set()}={}){
 const calls=[],tabs={onRemoved:event(),onUpdated:event(),async sendMessage(tab,message,options){calls.push(['probe',tab,options]);return {tokens:message.tokens.filter(t=>live.has(t))};}},runtime={id:'test'},storage=source=>({async get(key){calls.push(['get',key]);return structuredClone(Object.hasOwn(source,key)?{[key]:source[key]}:{});},async set(values){Object.assign(source,structuredClone(values));}});
 const env=vm.createContext({chrome:{runtime,tabs,storage:{local:storage(data),session:storage(session)}},ReserveMedia:{createPackStore:()=>({async reserve(ids,token){calls.push(['reserve',token]);data[POOL]??={media:[]};data[POOL].media[0]??={holds:[]};data[POOL].media[0].holds.push(token);},async release(token){calls.push(['release',token]);for(const row of data[POOL]?.media||[])row.holds=row.holds.filter(t=>t!==token);},close(){}})}});
 require('./market-fixture.cjs').loadMarketSite(env);
 vm.runInContext(read('market-holds.js'),env,{filename:'market-holds.js'});const sender={id:'test',frameId:0,tab:{id:4},documentId:'document-A',url:OWNER.origin+'/'};return {env,api:env.ReserveMarketHolds,data,session,live,calls,tabs,sender};
}
test('reservations persist their authenticated document and release after an account switch',async()=>{
 const h=harness(),token=webcrypto.randomUUID();await h.api.ready;await h.api.handle({op:'reserve',owner:OWNER,ids:[webcrypto.randomUUID()],token},h.sender);assert.equal(h.session[SESSION][token].documentId,'document-A');assert.deepEqual(h.data[OWNERS],[OWNER]);await h.api.handle({op:'release',owner:OWNER,token},h.sender);assert.equal(h.session[SESSION][token],undefined);assert.deepEqual(h.data[POOL].media[0].holds,[]);
});
test('another document cannot release a reservation or reuse its token',async()=>{
 const h=harness(),token=webcrypto.randomUUID();await h.api.ready;await h.api.handle({op:'reserve',owner:OWNER,ids:[],token},h.sender);for(const op of ['release','reserve'])await assert.rejects(h.api.handle({op,owner:OWNER,ids:[],token},{...h.sender,documentId:'other'}));assert.ok(h.data[POOL].media[0].holds.includes(token));
});
test('worker restart keeps live document holds and reclaims abandoned ones',async()=>{
 const h=harness(),live=webcrypto.randomUUID(),dead=webcrypto.randomUUID();await h.api.ready;for(const token of [live,dead])await h.api.handle({op:'reserve',owner:OWNER,ids:[],token},h.sender);h.live.add(live);const resumed=harness(h);await resumed.api.ready;assert.deepEqual(h.data[POOL].media[0].holds,[live]);assert.ok(resumed.session[SESSION][live]);assert.equal(resumed.session[SESSION][dead],undefined);assert.deepEqual(JSON.parse(JSON.stringify(resumed.calls.find(c=>c[0]==='probe').slice(1))),[4,{documentId:'document-A'}]);
});
test('browser-session restart clears orphaned persisted holds using the durable owner index',async()=>{
 const token=webcrypto.randomUUID(),data={[OWNERS]:[OWNER],[POOL]:{media:[{holds:[token]}]}},h=harness({data});await h.api.ready;assert.deepEqual(data[POOL].media[0].holds,[]);assert.deepEqual(h.calls.filter(c=>c[0]==='release'),[['release',token]]);
});
test('tab closure and navigation reclaim only dead document reservations',async()=>{
 const h=harness(),token=webcrypto.randomUUID();await h.api.ready;await h.api.handle({op:'reserve',owner:OWNER,ids:[],token},h.sender);h.live.add(token);h.tabs.onUpdated.emit(4,{status:'loading'});await settle();assert.ok(h.data[POOL].media[0].holds.includes(token));h.live.clear();h.tabs.onUpdated.emit(4,{url:OWNER.origin+'/new'});await settle();assert.deepEqual(h.data[POOL].media[0].holds,[]);const next=webcrypto.randomUUID();await h.api.handle({op:'reserve',owner:OWNER,ids:[],token:next},h.sender);h.live.add(next);h.tabs.onRemoved.emit(4);await settle();assert.deepEqual(h.data[POOL].media[0].holds,[]);
});

test('startup reconciliation reads the owner index without requesting legacy pools or keyed bytes',async()=>{const data={[OWNERS]:[OWNER],[POOL]:{version:2,media:[]}},h=harness({data});await h.api.ready;const keys=h.calls.filter(c=>c[0]==='get').map(c=>c[1]);assert.ok(keys.includes(POOL));assert.ok(keys.every(k=>[SESSION,OWNERS,POOL].includes(k)));});

test('startup defers legacy-pool cleanup to lazy migration even with abandoned document records',async()=>{const token=webcrypto.randomUUID(),legacy=POOL.slice(0,-6),data={[OWNERS]:[OWNER],[legacy]:{version:1,media:[{holds:[token],blob:{data:'legacy bytes'}}]}},session={[SESSION]:{[token]:{owner:OWNER,tabId:4,documentId:'gone',url:OWNER.origin+'/'}}},h=harness({data,session});await h.api.ready;assert.equal(session[SESSION][token],undefined);assert.ok(h.calls.filter(c=>c[0]==='get').every(c=>c[1]!==legacy));assert.equal(h.calls.some(c=>c[0]==='release'),false);assert.deepEqual(data[legacy].media[0].holds,[token],'migration will prune this hold using the updated session records');});
