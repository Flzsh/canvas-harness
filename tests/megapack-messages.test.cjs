'use strict';
// The megapack messages in the worker (market-worker.js): megapack-get from the student's Canvas page (for its account,
// checked as every Canvas request is; opens the Market at the card's page beside the asking tab, bound to that account as
// the popup's "Open the market" binds its tab), from the Market bridge with a checked row (for the account its tab was
// opened for), megapack-state, megapack-remove; the sender checks; and market-installed naming a megapack only when all its
// files are here (the local record).
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{read,settle,loadMarketSite}=require('./market-fixture.cjs');
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
function event(){const all=[];return {addListener:fn=>all.push(fn),emit:(...args)=>all.map(fn=>fn(...args))};}
const ID='soul-passage',OWNER={origin:'https://school.instructure.com',accountId:'7'};
const CANVAS={id:'test',frameId:0,tab:{id:5,windowId:2},url:'https://school.instructure.com/courses/10'},MARKET={id:'test',frameId:0,tab:{id:4},url:'https://flzsh.github.io/canvas-harness-packs/megapack.html'},POPUP={id:'test',url:'chrome-extension://test/popup.html'};
const ROW={id:ID,name:'Soul Passage',kind:'megapack',file:'megapacks/soul-passage/1.json',size:44020,sha256:'6'.repeat(64),bytes:33695184,scene:'train',engine:1,needs:'4.2.0'};
function harness({real=false,profile='7'}={}){
 const calls=[],tabs=[],runtime={id:'test',getURL:file=>'chrome-extension://test/'+file,onMessage:event(),onInstalled:event(),onStartup:event()},permissions={onAdded:event(),onRemoved:event(),contains:async()=>true};
 const saved=new Map(),local={get:async keys=>Object.fromEntries([].concat(keys??[...saved.keys()]).filter(k=>saved.has(k)).map(k=>[k,clone(saved.get(k))])),set:async v=>{for(const [k,x]of Object.entries(v))saved.set(k,clone(x));},remove:async keys=>{for(const k of [].concat(keys))saved.delete(k);}};
 const session=new Map(),sessionArea={get:async keys=>Object.fromEntries([].concat(keys).filter(k=>session.has(k)).map(k=>[k,clone(session.get(k))])),set:async v=>{for(const [k,x]of Object.entries(v))session.set(k,clone(x));},remove:async keys=>{for(const k of [].concat(keys))session.delete(k);}};
 const fake={next:{state:'getting',started:true},here:false,gettingIds:[],known:id=>id===ID,get:async(id,o)=>{calls.push(['get',id,clone(o)]);return fake.next;},state:async id=>{calls.push(['state',id]);return {state:'getting',done:5,total:10,at:1};},remove:async id=>{calls.push(['remove',id]);return {state:'none'};},installed:async()=>fake.here?[ID]:[],getting:async()=>fake.gettingIds};
 const env=vm.createContext({URL,AbortSignal,Headers,Response,console,chrome:{runtime,permissions,tabs:{query:async()=>[{url:'https://school.instructure.com/'}],create:async o=>{tabs.push(['create',clone(o)]);return {id:9};},update:async(id,o)=>{tabs.push(['update',id,clone(o)]);return {id};},onRemoved:event()},storage:{local,session:sessionArea}},
  fetch:async url=>{if(String(url).startsWith('chrome-extension://'))return new Response('',{status:404});return {ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>({id:profile})};},
  ReserveMarket:{sync:async()=>{}},ReservePacks:{installed:async()=>[{id:'one'}]},ReserveMedia:{createPackStore:()=>({close(){}})}});
 loadMarketSite(env);
 if(real)vm.runInContext(read('megapack.js'),env,{filename:'megapack.js'});else env.ReserveMegapack=fake;
 vm.runInContext(read('market-holds.js'),env,{filename:'market-holds.js'});vm.runInContext(read('market-worker.js'),env,{filename:'market-worker.js'});
 async function request(message,sender){let reply;const result=runtime.onMessage.emit(message,sender,value=>{reply=value;});await settle();return {reply:reply&&clone(reply),handled:result.includes(true)};}
 return {env,calls,tabs,fake,permissions,request,saved,session};
}
test('from Canvas: megapack-get starts the download for the student\'s own account and opens the Market at the card page beside the tab, bound to that account',async()=>{
 const h=harness();assert.deepEqual((await h.request({type:'megapack-get',id:ID,owner:OWNER},CANVAS)).reply,{ok:true,state:'getting'});
 assert.deepEqual(h.calls,[['get',ID,{account:OWNER}]]);
 assert.deepEqual(h.tabs,[['create',{url:'about:blank',active:true,windowId:2,openerTabId:5}],['update',9,{url:'https://flzsh.github.io/canvas-harness-packs/megapack.html'}]]);
 assert.deepEqual(clone(await h.env.ReserveMarketSite.bound(9)),OWNER,'the Market tab knows whose it is, as one the popup opens');
 // another account signed in on that Canvas, or no account named: nothing starts, nothing opens
 const other=harness({profile:'8'});assert.equal((await other.request({type:'megapack-get',id:ID,owner:OWNER},CANVAS)).reply.ok,false);assert.deepEqual(other.calls,[]);assert.deepEqual(other.tabs,[]);
 const none=harness();assert.equal((await none.request({type:'megapack-get',id:ID},CANVAS)).reply.ok,false);assert.deepEqual(none.calls,[]);
 // an account of another school than the page's
 const elsewhere=harness();assert.equal((await elsewhere.request({type:'megapack-get',id:ID,owner:{origin:'https://other.instructure.com',accountId:'7'}},CANVAS)).reply.ok,false);assert.deepEqual(elsewhere.calls,[]);
 // joining a running download or asking when it is here opens nothing more
 for(const next of [{state:'getting',joined:true},{state:'here'}]){const j=harness();j.fake.next=next;assert.deepEqual((await j.request({type:'megapack-get',id:ID,owner:OWNER},CANVAS)).reply,{ok:true,state:next.state});assert.deepEqual(j.tabs,[]);}
});
test('from the Market bridge: megapack-get carries the checked row, is for the account the tab was opened for, needs the Market access, opens no tab; remove is not the page\'s to send',async()=>{
 const h=harness(),bridge={...MARKET};assert.deepEqual((await h.request({type:'megapack-get',id:ID,entry:ROW},bridge)).reply,{ok:true,state:'getting'});
 assert.deepEqual(h.calls,[['get',ID,{entry:ROW,account:OWNER}]]);assert.deepEqual(h.tabs,[]);
 assert.deepEqual((await h.request({type:'megapack-state',id:ID},bridge)).reply,{ok:true,state:'getting',done:5,total:10,at:1});
 for(const message of [{type:'megapack-get',id:ID},{type:'megapack-remove',id:ID},{type:'megapack-get',id:ID,entry:ROW,owner:OWNER}])assert.equal((await h.request(message,bridge)).reply.ok,false,JSON.stringify(message));
 // a Market tab the popup did not open has no account: no download is asked for there
 assert.equal((await h.request({type:'megapack-get',id:ID,entry:ROW},{...bridge,tab:{id:6}})).reply.ok,false);
 h.permissions.contains=async()=>false;for(const type of ['megapack-get','megapack-state'])assert.equal((await h.request({type,id:ID,...(type==='megapack-get'?{entry:ROW}:{})},bridge)).reply.ok,false);
 assert.equal(h.calls.filter(c=>c[0]==='get').length,1);
});
test('senders, ids and keys are checked like the other market messages',async()=>{
 const h=harness();
 for(const sender of [{...CANVAS,frameId:1},{...CANVAS,id:'other'},{...CANVAS,url:'https://evil.test/'},{...CANVAS,tab:undefined},{...MARKET,url:'https://flzsh.github.io/elsewhere/'},{...MARKET,url:'https://flzsh.github.io/canvas-harness-packs/?x=1'},{id:'test',url:'chrome-extension://test/other.html'}])
  for(const type of ['megapack-get','megapack-state','megapack-remove'])assert.equal((await h.request({type,id:ID,...(type==='megapack-get'?{owner:OWNER}:{})},sender)).reply.ok,false,type+' '+JSON.stringify(sender));
 for(const message of [{type:'megapack-get',id:'other',owner:OWNER},{type:'megapack-state',id:'__proto__'},{type:'megapack-get',id:ID,entry:ROW,owner:OWNER},{type:'megapack-get',id:ID,owner:OWNER,extra:1},{type:'megapack-remove',id:ID,owner:{...OWNER,accountId:7}},{type:'megapack-state'}])assert.equal((await h.request(message,CANVAS)).reply.ok,false,JSON.stringify(message));
 assert.equal((await h.request({type:'megapack-state',id:ID,owner:OWNER},POPUP)).reply.ok,false,'the popup sends no owner');
 assert.deepEqual(h.calls,[]);assert.deepEqual(h.tabs,[]);
 assert.deepEqual((await h.request({type:'megapack-state',id:ID},POPUP)).reply,{ok:true,state:'getting',done:5,total:10,at:1});
 assert.deepEqual((await h.request({type:'megapack-state',id:ID},CANVAS)).reply,{ok:true,state:'getting',done:5,total:10,at:1},'the picker asks without its account');
 assert.deepEqual((await h.request({type:'megapack-remove',id:ID},POPUP)).reply,{ok:true});assert.deepEqual((await h.request({type:'megapack-remove',id:ID,owner:OWNER},CANVAS)).reply,{ok:true});assert.deepEqual((await h.request({type:'megapack-remove',id:ID},CANVAS)).reply,{ok:true});
 assert.deepEqual(h.calls,[['state',ID],['state',ID],['remove',ID],['remove',ID],['remove',ID]]);
});
test('market-installed names a megapack once all its files are here, and one coming down in "getting"',async()=>{
 const h=harness();assert.deepEqual((await h.request({type:'market-installed'},MARKET)).reply,{ok:true,installed:['one']});
 h.fake.here=true;h.fake.gettingIds=[ID];assert.deepEqual((await h.request({type:'market-installed'},MARKET)).reply,{ok:true,installed:['one',ID],getting:[ID]});
 // with the real module: the local record decides, nothing else
 const r=harness({real:true});assert.deepEqual((await r.request({type:'market-installed'},MARKET)).reply,{ok:true,installed:['one']});
 r.session.set('megapack:'+ID,{state:'getting',done:1,total:2,at:1});assert.deepEqual((await r.request({type:'market-installed'},MARKET)).reply,{ok:true,installed:['one'],getting:[ID]});
 r.session.delete('megapack:'+ID);r.saved.set('megapack:'+ID,{version:1,engine:1,bytes:2,count:1,manifest:'6'.repeat(64),names:{'under.webp':'a.webp'},at:1});
 assert.deepEqual((await r.request({type:'market-installed'},MARKET)).reply,{ok:true,installed:['one',ID]});
 assert.deepEqual((await r.request({type:'megapack-state',id:ID},CANVAS)).reply,{ok:true,state:'here'});
});
