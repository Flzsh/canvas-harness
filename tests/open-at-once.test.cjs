const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSession}=require('../extension/session.js');
const user={id:'7'};
const snapshot=()=>({user,origin:'https://canvas.example.edu',courses:[],assignments:[],fetchedAt:new Date().toISOString()});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const store=settings=>()=>({load:async()=>{},readCache:async()=>snapshot(),get:()=>({settings}),writeCache:async()=>{},destroy(){}});
const quickOpen=settings=>settings?.quickOpen==='on';

test('"Open at once" is off by default: a remembered account opens nothing before Canvas confirms it',async()=>{
 const check=deferred(),shown=[];
 const session=createSession({client:{profile:()=>check.promise,loadSnapshot:()=>{throw Error('fresh cache');}},createStore:store({quickOpen:'off'}),prefetchedProfile:{id:'7'},quickOpen,onSnapshot:(next,s,meta)=>shown.push(meta)});
 const started=session.start();await tick();
 assert.equal(shown.length,0,'nothing saved is shown while the account check is pending');
 check.resolve(user);await started;
 assert.equal(shown.length,1);assert.notEqual(shown[0].unverified,true);session.destroy();
});

test('with "Open at once" on, the saved view shows first and is confirmed when Canvas answers',async()=>{
 const check=deferred(),shown=[];
 const session=createSession({client:{profile:()=>check.promise,loadSnapshot:()=>{throw Error('fresh cache');}},createStore:store({quickOpen:'on'}),prefetchedProfile:{id:'7'},quickOpen,onSnapshot:(next,s,meta)=>shown.push(meta)});
 const started=session.start();await tick();
 assert.equal(shown.length,1);assert.equal(shown[0].unverified,true,'marked as not yet confirmed');
 check.resolve(user);await started;
 assert.equal(shown.length,2);assert.notEqual(shown[1].unverified,true);session.destroy();
});

test('an early view closes when Canvas names another account',async()=>{
 const check=deferred(),shown=[],errors=[];
 const session=createSession({client:{profile:()=>check.promise,loadSnapshot:()=>{throw Error('fresh cache');}},createStore:store({quickOpen:'on'}),prefetchedProfile:{id:'7'},quickOpen,onSnapshot:(next,s,meta)=>shown.push(meta),onError:(error,meta)=>errors.push(meta)});
 const started=session.start();await tick();assert.equal(shown.length,1);
 check.resolve({id:'8'});await started;
 assert.equal(shown.length,1,'the view is never confirmed for the other account');
 assert.deepEqual(errors,[{clear:true}]);assert.equal(session.getSnapshot(),null);session.destroy();
});

test('an early view closes when the account check cannot be made',async()=>{
 const check=deferred(),errors=[];
 const session=createSession({client:{profile:()=>check.promise,loadSnapshot:()=>{throw Error('fresh cache');}},createStore:store({quickOpen:'on'}),prefetchedProfile:{id:'7'},quickOpen,onSnapshot:()=>{},onError:(error,meta)=>errors.push(meta)});
 const started=session.start();await tick();
 check.reject(Error('offline'));await started;
 assert.deepEqual(errors,[{clear:true}],'an unconfirmed view is not left open');assert.equal(session.getSnapshot(),null);session.destroy();
});
