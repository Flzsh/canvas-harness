const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSession}=require('../extension/session.js');
const user={id:'7'};
const snapshot=(age=0)=>({user,origin:'https://school.instructure.com',courses:[],assignments:[],fetchedAt:new Date(Date.now()-age).toISOString()});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('suspending a session prevents an old refresh from rendering or committing cached coursework',async()=>{
 const later=deferred();let shown=0,writes=0;
 const session=createSession({client:{profile:async()=>user,loadSnapshot:()=>later.promise},createStore:()=>({load:async()=>{},readCache:async()=>snapshot(),writeCache:async()=>writes++,destroy(){}}),onSnapshot:()=>shown++});
 await session.start();const pending=session.refresh();session.suspend();later.resolve(snapshot());await pending;
 assert.equal(shown,1);assert.equal(writes,0);session.destroy();
});

test('a suspended session can revalidate the same account without losing its preference store',async()=>{
 let profiles=0,loads=0,destroyed=0;
 const session=createSession({client:{profile:async()=>{profiles++;return user;},loadSnapshot:()=>{throw Error('fresh cache');}},createStore:()=>({load:async()=>loads++,readCache:async()=>snapshot(),destroy:()=>destroyed++}),onSnapshot:()=>{}});
 await session.start();session.suspend();assert.equal(await session.verify(),true);
 assert.equal(profiles,2);assert.equal(loads,2);assert.equal(destroyed,0);session.destroy();
});

test('a resume verification invalidated by another suspension cannot authorize the old view',async()=>{
 const check=deferred();let profiles=0,loads=0;
 const session=createSession({client:{profile:()=>++profiles===1?Promise.resolve(user):check.promise,loadSnapshot:()=>{throw Error('fresh cache');}},createStore:()=>({load:async()=>loads++,readCache:async()=>snapshot(),destroy(){}}),onSnapshot:()=>{}});
 await session.start();session.suspend();const resume=session.verify();session.suspend();check.resolve(user);
 assert.notEqual(await resume,true);assert.equal(loads,1);session.destroy();
});

test('returning to a suspended stale view restarts its interrupted refresh without waiting to reopen',async()=>{
 const first=deferred(),second=deferred();let fetches=0,shown=0,writes=0;
 const session=createSession({client:{profile:async()=>user,loadSnapshot:()=>++fetches===1?first.promise:second.promise},createStore:()=>({load:async()=>{},readCache:async()=>snapshot(600000),writeCache:async()=>writes++,destroy(){}}),onSnapshot:()=>shown++});
 const start=session.start();await new Promise(setImmediate);session.suspend();first.resolve(snapshot());await start;
 assert.equal(shown,1);assert.equal(writes,0);
 assert.equal(await session.verify(),true,'the fresh identity permits reopening before the course refresh returns');
 assert.equal(fetches,2,'the aborted refresh must not leave coursework permanently stale');
 second.resolve(snapshot());await new Promise(setImmediate);assert.equal(shown,2);assert.equal(writes,1);session.destroy();
});
function fixture(cached,network){const events=[];let reads=0,writes=0,destroyed=0;const store={load:async()=>{},readCache:async()=>{reads++;return cached;},writeCache:async()=>{writes++;},destroy:()=>destroyed++};const client={profile:async()=>user,loadSnapshot:network};const session=createSession({client,createStore:()=>store,onSnapshot:(value,s,meta)=>events.push({value,s,meta}),onStatus:()=>{},onError:()=>{}});return {session,events,client,get reads(){return reads;},get writes(){return writes;},get destroyed(){return destroyed;}};}
test('fresh account-verified cache renders without downloading every course again',async()=>{let fetches=0;const f=fixture(snapshot(),async()=>{fetches++;return snapshot();});await f.session.start();assert.equal(f.events.length,1);assert.equal(f.events[0].meta.stale,false);assert.equal(fetches,0);assert.equal(f.reads,1);f.session.destroy();});

test('local startup diagnostics cannot disrupt authenticated cached rendering',async()=>{
 let shown=0,observed=0;
 const session=createSession({client:{profile:async()=>user,loadSnapshot:()=>{throw Error('Fresh cache should not download');}},createStore:()=>({load:async()=>{},readCache:async()=>snapshot(),destroy(){}}),
  onTiming:()=>{observed++;throw Error('diagnostics unavailable');},onSnapshot:()=>shown++,onError:error=>{throw error;}});
 await session.start();assert.ok(observed>0);assert.equal(shown,1);session.destroy();
});
test('stale cache is shown before a slow background refresh completes',async()=>{const network=deferred(),f=fixture(snapshot(600000),()=>network.promise);const task=f.session.start();await new Promise(setImmediate);assert.equal(f.events.length,1);assert.equal(f.events[0].meta.stale,true);network.resolve(snapshot());await task;assert.equal(f.events.length,2);assert.equal(f.events[1].meta.stale,false);assert.equal(f.writes,1);f.session.destroy();});
test('identity must succeed before personal data or cached courses are read',async()=>{const f=fixture(snapshot(),async()=>snapshot());f.client.profile=async()=>{const e=Error('Signed out');e.code='auth';throw e;};await f.session.start();assert.equal(f.reads,0);assert.equal(f.events.length,0);f.session.destroy();});
test('account change during refresh clears displayed personal content',async()=>{const f=fixture(snapshot(),async()=>({...snapshot(),user:{id:'8'}}));let cleared=0;f.session.destroy();const session=createSession({client:f.client,createStore:()=>({load:async()=>{},readCache:async()=>snapshot(),writeCache:async()=>{throw Error('wrong account must not be cached');},destroy:()=>{}}),onSnapshot:()=>{},onStatus:()=>{},onError:(_e,{clear})=>{if(clear)cleared++;}});await session.start();await session.refresh();assert.equal(cleared,1);session.destroy();});
test('closing the page during refresh cannot render late data',async()=>{const network=deferred(),f=fixture(null,()=>network.promise);const task=f.session.start();await new Promise(setImmediate);f.session.destroy();network.resolve(snapshot());await task;assert.equal(f.events.length,0);assert.equal(f.writes,0);assert.equal(f.destroyed,1);});
test('overlapping refresh actions share one network refresh',async()=>{const network=deferred();let fetches=0;const f=fixture(snapshot(),()=>{fetches++;return network.promise;});await f.session.start();const first=f.session.refresh(),second=f.session.refresh();network.resolve(snapshot());await Promise.all([first,second]);assert.equal(fetches,1);f.session.destroy();});

test('prefetched identity overlaps account-scoped cache loading with a fresh verification, but cannot publish early',async()=>{
 const verifying=deferred(),events=[];let checks=0,loaded=0,reads=0,account;
 const session=createSession({prefetchedProfile:Promise.resolve({id:'7'}),client:{profile:()=>{checks++;return verifying.promise;},loadSnapshot:()=>{throw Error('Fresh cache should not download');}},createStore:({accountId})=>{account=accountId;return {load:async()=>{loaded++;},readCache:async()=>{reads++;return snapshot();},destroy(){}};},onSnapshot:(value)=>events.push(value),onError:error=>{throw error;}});
 const start=session.start();await new Promise(setImmediate);
 assert.equal(checks,1,'fresh profile verification begins when the session starts');
 assert.equal(account,'7');assert.equal(loaded,1);assert.equal(reads,1,'cache can load while verification is in flight');
 assert.equal(events.length,0,'private data cannot display from the early identity alone');
 verifying.resolve({id:'7'});await start;assert.equal(events.length,1);session.destroy();
});

test('account-scoped preferences and cached courses load concurrently, but both must finish before display',async()=>{
 const {createStore}=require('../extension/storage.js');
 const preferences=deferred(),cached=deferred(),verification=deferred(),reads=[],shown=[];
 const session=createSession({prefetchedProfile:Promise.resolve(user),client:{profile:()=>verification.promise,loadSnapshot:()=>{throw Error('Fresh cache should not download');}},
  createStore:({accountId})=>createStore({accountId,adapter:{read:key=>{reads.push(key);return key.endsWith(':cache')?cached.promise:preferences.promise;},write:async()=>{}}}),
  onSnapshot:(value,store)=>shown.push({value,settings:store.get().settings}),onError:error=>{throw error;}});
 const start=session.start();
 try{
  await new Promise(setImmediate);
  assert.deepEqual(reads,['reserve:v1:https://school.instructure.com:7','reserve:v1:https://school.instructure.com:7:cache'],'a slow preference read must not delay starting the cache read');
  cached.resolve(snapshot());verification.resolve(user);await new Promise(setImmediate);assert.equal(shown.length,0,'verified courses must not appear with unloaded preferences');
  preferences.resolve({settings:{showGrades:true}});await start;
  assert.equal(shown.length,1);assert.equal(shown[0].settings.showGrades,true);
 }finally{session.destroy();preferences.resolve(null);cached.resolve(null);verification.resolve(user);}
});

test('account switch after an early profile cannot reveal the earlier account cache',async()=>{
 const verifying=deferred();let reads=0,shown=0,cleared=0;
 const session=createSession({prefetchedProfile:Promise.resolve({id:'7'}),client:{profile:()=>verifying.promise,loadSnapshot:()=>{throw Error('Must not fetch');}},createStore:({accountId})=>{assert.equal(accountId,'7');return {load:async()=>{},readCache:async()=>{reads++;return snapshot();},destroy(){}};},onSnapshot:()=>shown++,onError:(_error,{clear})=>{if(clear)cleared++;}});
 const start=session.start();await new Promise(setImmediate);assert.equal(reads,1);assert.equal(shown,0);
 verifying.resolve({id:'8'});await start;assert.equal(shown,0);assert.equal(cleared,1);session.destroy();
});

test('a failed early profile falls back to the current account check',async()=>{
 let calls=0,shown=0;
 const session=createSession({prefetchedProfile:Promise.reject(Error('Prepaint network unavailable')),client:{profile:async()=>{calls++;return user;},loadSnapshot:()=>{throw Error('Fresh cache should not download');}},createStore:()=>({load:async()=>{},readCache:async()=>snapshot(),destroy(){}}),onSnapshot:()=>shown++,onError:error=>{throw error;}});
 await session.start();assert.equal(calls,1);assert.equal(shown,1);session.destroy();
});

test('a slow prepaint request cannot delay a faster current profile or replace its account',async()=>{
 const early=deferred();let shown=0,account;
 const session=createSession({prefetchedProfile:early.promise,client:{profile:async()=>({id:'8'}),loadSnapshot:()=>{throw Error('Fresh cache should not download');}},createStore:({accountId})=>{account=accountId;return {load:async()=>{},readCache:async()=>({...snapshot(),user:{id:'8'}}),destroy(){}};},onSnapshot:()=>shown++,onError:error=>{throw error;}});
 await session.start();assert.equal(account,'8');assert.equal(shown,1);
 early.resolve({id:'7'});await new Promise(setImmediate);assert.equal(shown,1);session.destroy();
});

test('a recent partial snapshot is not refetched on every visit or tab return',async()=>{
 let fetches=0;const partial={...snapshot(10000),partial:true};
 const session=createSession({client:{profile:async()=>user,loadSnapshot:async()=>{fetches++;return snapshot();}},createStore:()=>({load:async()=>{},readCache:async()=>partial,writeCache:async()=>{},destroy(){}}),onSnapshot:()=>{}});
 await session.start();session.suspend();assert.equal(await session.verify(),true);await new Promise(setImmediate);
 assert.equal(fetches,0,'a course that keeps failing must not reload every course within the partial window');session.destroy();
});
test('an older partial snapshot still refreshes so failed courses are retried',async()=>{
 let fetches=0;const partial={...snapshot(120000),partial:true};
 const session=createSession({client:{profile:async()=>user,loadSnapshot:async()=>{fetches++;return snapshot();}},createStore:()=>({load:async()=>{},readCache:async()=>partial,writeCache:async()=>{},destroy(){}}),onSnapshot:()=>{}});
 await session.start();assert.equal(fetches,1);session.destroy();
});
