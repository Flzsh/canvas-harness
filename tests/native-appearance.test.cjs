const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const modelPath=path.join(__dirname,'../extension/native-appearance.js');
const Appearance=fs.existsSync(modelPath)?require(modelPath):{};
// Reserve 2.15: Clay is the default link accent on Canvas pages, like the dashboard.
const BASE={theme:'original',readingWidth:'comfortable',textSize:'standard',accent:'clay'};
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
const tick=()=>new Promise(setImmediate);
function fixture({initial=null,read,write,dark=false}={}){
  let incoming,mediaListener;
  const calls={reads:0,subscriptions:0,unsubscribes:0,mediaAdds:0,mediaRemoves:0,writes:[],applied:[],errors:[]};
  const adapter={
    read(){calls.reads++;return read?read():Promise.resolve(initial);},
    write(prefs){calls.writes.push({...prefs});return write?write(prefs):Promise.resolve();},
    subscribe(fn){calls.subscriptions++;incoming=fn;return ()=>{calls.unsubscribes++;};},
  };
  const media={matches:dark,
    addEventListener(name,fn){assert.equal(name,'change');calls.mediaAdds++;mediaListener=fn;},
    removeEventListener(name,fn){assert.equal(name,'change');assert.equal(fn,mediaListener);calls.mediaRemoves++;},
  };
  const controller=Appearance.create({adapter,media,apply:(prefs,theme)=>calls.applied.push({prefs,theme}),onError:error=>calls.errors.push(error)});
  return {controller,calls,adapter,media,emit:prefs=>incoming(prefs),changeMedia(matches){media.matches=matches;mediaListener?.({matches});}};
}

test('native appearance defaults and normalized outputs never share mutable preferences',()=>{
  assert.deepEqual(Appearance.defaults(),BASE);
  const first=Appearance.defaults();first.theme='dark';
  assert.equal(Appearance.defaults().theme,'original');
  const input={theme:'light',textSize:'large'};
  const normalized=Appearance.normalize(input);input.theme='dark';
  assert.deepEqual(normalized,{...BASE,theme:'light',textSize:'large'});
  assert.deepEqual(Appearance.normalize(null),BASE);
  assert.deepEqual(Appearance.normalize(),BASE);
});

test('native appearance rejects unknown enum values, fields, coercions and prototype records',()=>{
  for(const [key,values] of Object.entries({theme:['original','light','dark','system'],readingWidth:['comfortable','full'],textSize:['standard','large'],accent:['clay','forest','indigo','ocean','rose','amber']})){
    for(const value of values)assert.equal(Appearance.normalize({[key]:value})[key],value);
    for(const bad of ['unknown','toString','constructor','',true,7,null,undefined]){
      assert.throws(()=>Appearance.normalize({[key]:bad}),error=>error.constructor===Error&&error.message.includes(key));
    }
  }
  for(const value of [[],true,3,'dark',new Date(),Object.create({theme:'dark'}),{accountId:'7'},JSON.parse('{"__proto__":{}}')]){
    assert.throws(()=>Appearance.normalize(value),error=>error.constructor===Error);
  }
  let getterCalls=0;
  assert.throws(()=>Appearance.normalize({get theme(){getterCalls++;return 'dark';}}));
  assert.equal(getterCalls,0,'validation must not invoke accessors');
});

test('native appearance moves an untouched Forest to Clay exactly once, and a later Forest sticks',()=>{
  assert.equal(Appearance.VERSION,2);
  // Before 2.15 every saved preference held Forest (the old default), with no version.
  const moved=Appearance.migrate({theme:'dark',accent:'forest'},undefined);
  assert.deepEqual(moved,{value:{theme:'dark',accent:'clay'},version:2,changed:true});
  assert.deepEqual(Appearance.migrate({accent:'ocean'},undefined),{value:{accent:'ocean'},version:2,changed:false},'another chosen accent is kept');
  assert.deepEqual(Appearance.migrate(null,1),{value:null,version:2,changed:false},'nothing saved: only the version is recorded');
  assert.deepEqual(Appearance.migrate({accent:'forest'},2),{value:{accent:'forest'},version:2,changed:false},'Forest chosen again after the move sticks');
  assert.deepEqual(Appearance.migrate({accent:'forest'},7),{value:{accent:'forest'},version:7,changed:false},'a newer version is never lowered');
  const input={accent:'forest'};Appearance.migrate(input);assert.equal(input.accent,'forest','the stored value is not mutated');
});

test('native appearance keeps Original and renders legacy Dark or System in light',()=>{
  for(const dark of [false,true]){
    assert.equal(Appearance.resolveTheme(BASE,dark),'original');
    assert.equal(Appearance.resolveTheme({theme:'light'},dark),'light');
    assert.equal(Appearance.resolveTheme({theme:'dark'},dark),'light');
  }
  assert.equal(Appearance.resolveTheme({theme:'system'},false),'light');
  assert.equal(Appearance.resolveTheme({theme:'system'},true),'light');
});

test('native appearance start is lazy and single-flight and applies only after its one read settles',async()=>{
  const read=deferred(),f=fixture({read:()=>read.promise});
  assert.equal(f.calls.reads,0);assert.equal(f.calls.subscriptions,0);assert.equal(f.calls.applied.length,0);
  const first=f.controller.start(),second=f.controller.start();
  assert.equal(first,second);
  await tick();
  assert.equal(f.calls.reads,1);assert.equal(f.calls.subscriptions,1);assert.equal(f.calls.applied.length,0);
  read.resolve({theme:'dark',accent:'ocean'});
  await first;
  assert.deepEqual(f.calls.applied,[{prefs:{...BASE,theme:'dark',accent:'ocean'},theme:'light'}]);
  await f.controller.start();
  assert.equal(f.calls.reads,1);assert.equal(f.calls.subscriptions,1);assert.equal(f.calls.mediaAdds,1);assert.equal(f.calls.applied.length,1);
  f.controller.destroy();
});

test('native appearance missing, invalid and failed reads fail closed without writing data',async()=>{
  for(const [value,errorExpected] of [[null,false],[{theme:'neon'},true],[[],true],[{grade:90},true],[Error('read unavailable'),true]]){
    const f=fixture({read:()=>value instanceof Error?Promise.reject(value):Promise.resolve(value)});
    await f.controller.start();
    assert.deepEqual(f.controller.get(),BASE);assert.equal(f.calls.writes.length,0);
    assert.deepEqual(f.calls.applied,[{prefs:BASE,theme:'original'}]);
    assert.equal(f.calls.errors.length,errorExpected?1:0);
    f.controller.destroy();
  }
});

test('native appearance newer external preferences win over an initial stale or rejected read',async()=>{
  for(const rejectRead of [false,true]){
    const read=deferred(),f=fixture({read:()=>read.promise}),started=f.controller.start();
    await tick();
    f.emit({theme:'dark',accent:'rose'});f.emit({theme:'light',textSize:'large'});
    assert.equal(f.calls.applied.length,0);
    if(rejectRead)read.reject(Error('old read failed'));else read.resolve({theme:'dark',accent:'amber'});
    await started;
    assert.deepEqual(f.controller.get(),{...BASE,theme:'light',textSize:'large'});
    assert.deepEqual(f.calls.applied,[{prefs:{...BASE,theme:'light',textSize:'large'},theme:'light'}]);
    assert.equal(f.calls.writes.length,0);f.controller.destroy();
  }
});

test('native appearance subscribes before reading, including synchronous subscribe notifications',async()=>{
  const events=[],f=fixture();
  const adapter={
    subscribe(fn){events.push('subscribe');fn({theme:'dark'});return ()=>{};},
    read(){events.push('read');return Promise.resolve(BASE);},write:async()=>{},
  };
  const controller=Appearance.create({adapter,media:f.media,apply:(prefs,theme)=>events.push(theme)});
  await controller.start();
  assert.deepEqual(events,['subscribe','read','light']);
  controller.destroy();f.controller.destroy();
});

test('native appearance external changes notify once, suppress duplicates, and reset safely on invalid or removed data',async()=>{
  const f=fixture(),notifications=[];
  const unsubscribe=f.controller.subscribe((prefs,theme)=>notifications.push({prefs,theme}));
  await f.controller.start();
  f.emit({theme:'dark'});f.emit({...BASE,theme:'dark'});
  assert.equal(notifications.length,2);assert.equal(f.calls.applied.length,2);
  f.emit({theme:'unknown'});
  assert.deepEqual(f.controller.get(),BASE);assert.equal(f.calls.errors.length,1);
  f.emit(null);assert.equal(notifications.length,3);
  unsubscribe();f.emit({accent:'amber'});
  assert.equal(notifications.length,3);assert.equal(f.calls.writes.length,0);
  f.controller.destroy();
});

test('native appearance queued patches wait for start and merge with each saved predecessor',async()=>{
  const read=deferred(),write=deferred();
  const f=fixture({read:()=>read.promise,write:()=>f.calls.writes.length===1?write.promise:Promise.resolve()});
  const patch={theme:'dark'},a=f.controller.set(patch),b=f.controller.set({textSize:'large'});patch.theme='light';
  await tick();assert.equal(f.calls.reads,1);assert.equal(f.calls.writes.length,0);
  read.resolve({accent:'ocean'});await tick();
  assert.deepEqual(f.calls.writes,[{...BASE,accent:'ocean',theme:'dark'}]);
  assert.deepEqual(f.controller.get(),{...BASE,accent:'ocean'});
  assert.equal(f.calls.applied.length,1);
  write.resolve();await Promise.all([a,b]);
  assert.deepEqual(f.calls.writes[1],{...BASE,accent:'ocean',theme:'dark',textSize:'large'});
  assert.deepEqual(f.controller.get(),{...BASE,accent:'ocean',theme:'dark',textSize:'large'});
  f.controller.destroy();
});

test('native appearance failed writes leave saved state intact and a queued update still succeeds',async()=>{
  const failure=Error('disk full'),first=deferred();
  const f=fixture({initial:{theme:'light'},write:()=>f.calls.writes.length===1?first.promise:Promise.resolve()});
  await f.controller.start();
  const rejected=assert.rejects(f.controller.set({theme:'dark'}),error=>error===failure);
  const recovery=f.controller.set({accent:'indigo'});
  await tick();first.reject(failure);await rejected;await recovery;
  assert.deepEqual(f.calls.writes[1],{...BASE,theme:'light',accent:'indigo'});
  assert.equal(f.calls.applied.some(x=>x.theme==='dark'),false);
  assert.deepEqual(f.controller.get(),{...BASE,theme:'light',accent:'indigo'});
  assert.equal(f.calls.errors.includes(failure),true);f.controller.destroy();
});

test('native appearance rejects bad patches atomically and does not write no-op patches',async()=>{
  const f=fixture({initial:{theme:'dark'}});await f.controller.start();
  for(const patch of [{theme:'neon'},null,[],{textSize:'large',accent:'bad'},{extra:'data'}]){
    await assert.rejects(f.controller.set(patch),error=>error.constructor===Error);
  }
  await f.controller.set({theme:'dark'});await f.controller.set({});
  assert.equal(f.calls.writes.length,0);assert.deepEqual(f.controller.get(),{...BASE,theme:'dark'});
  f.controller.destroy();
});

test('native appearance external updates during a write are not overwritten by late local completion',async()=>{
  const write=deferred(),f=fixture({write:()=>f.calls.writes.length===1?write.promise:Promise.resolve()});
  await f.controller.start();
  const a=f.controller.set({theme:'dark'});await tick();
  f.emit({theme:'light',accent:'rose'});
  const b=f.controller.set({textSize:'large'});write.resolve();await Promise.all([a,b]);
  assert.deepEqual(f.calls.writes[1],{...BASE,theme:'light',accent:'rose',textSize:'large'});
  assert.equal(f.calls.applied.some(x=>x.theme==='dark'),false);
  assert.deepEqual(f.controller.get(),{...BASE,theme:'light',accent:'rose',textSize:'large'});
  f.controller.destroy();
});

test('native appearance a self echo waits for write success and never publishes twice',async()=>{
  const write=deferred();
  const f=fixture({write:prefs=>{f.emit(prefs);return write.promise;}});
  await f.controller.start();
  const pending=f.controller.set({theme:'dark'});await tick();
  assert.deepEqual(f.controller.get(),BASE);assert.equal(f.calls.applied.length,1);
  write.resolve();await pending;
  f.emit({...BASE,theme:'dark'});
  assert.equal(f.calls.applied.length,2);f.controller.destroy();
});

test('device color changes never recolor drawings or rewrite legacy preferences',async()=>{
  const f=fixture({dark:false}),notified=[];f.controller.subscribe((prefs,theme)=>notified.push(theme));
  await f.controller.start();f.changeMedia(true);
  assert.equal(f.calls.applied.length,1);
  await f.controller.set({theme:'system'});
  assert.equal(f.calls.applied.at(-1).theme,'light');
  f.changeMedia(false);f.changeMedia(false);
  assert.equal(f.calls.applied.length,2);assert.equal(f.calls.applied.at(-1).theme,'light');
  assert.equal(f.controller.get().theme,'system');
  await f.controller.set({theme:'dark'});f.changeMedia(true);f.changeMedia(false);
  assert.equal(f.calls.applied.length,3);assert.equal(f.calls.writes.length,2);
  assert.deepEqual(notified,['original','light','light']);f.controller.destroy();
});

test('native appearance copies get, applied values, subscriber values and adapter write arguments',async()=>{
  const f=fixture({initial:{theme:'light'},write:prefs=>{prefs.theme='dark';return Promise.resolve();}});
  let second;
  f.controller.subscribe(prefs=>{prefs.accent='amber';});
  f.controller.subscribe(prefs=>{second=prefs;});
  await f.controller.start();
  const copy=f.controller.get();copy.theme='dark';f.calls.applied[0].prefs.theme='system';
  assert.deepEqual(f.controller.get(),{...BASE,theme:'light'});
  assert.equal(second.accent,BASE.accent,'one subscriber cannot change what the next receives');
  await f.controller.set({textSize:'large'});
  assert.deepEqual(f.controller.get(),{...BASE,theme:'light',textSize:'large'});
  f.controller.destroy();
});

test('native appearance destroy during initial read removes listeners and prevents late apply',async()=>{
  const read=deferred(),f=fixture({read:()=>read.promise});
  let notifications=0;f.controller.subscribe(()=>notifications++);
  const pending=f.controller.start(),rejected=assert.rejects(pending,error=>error.constructor===Error&&error.code==='cancelled');
  await tick();f.controller.destroy();f.controller.destroy();
  read.resolve({theme:'dark'});f.emit({theme:'light'});f.changeMedia(true);
  await rejected;
  assert.equal(f.calls.applied.length,0);assert.equal(notifications,0);
  assert.equal(f.calls.unsubscribes,1);assert.equal(f.calls.mediaRemoves,1);
  await assert.rejects(f.controller.start(),error=>error.code==='cancelled');
  await assert.rejects(f.controller.set({theme:'dark'}),error=>error.code==='cancelled');
  assert.equal(f.calls.writes.length,0);
});

test('native appearance destroy during write prevents late publish and queued writes',async()=>{
  const write=deferred(),f=fixture({write:()=>write.promise});await f.controller.start();
  const a=assert.rejects(f.controller.set({theme:'dark'}),error=>error.code==='cancelled');
  const b=assert.rejects(f.controller.set({accent:'rose'}),error=>error.code==='cancelled');
  await tick();f.controller.destroy();write.resolve();await Promise.all([a,b]);
  assert.equal(f.calls.writes.length,1);assert.equal(f.calls.applied.length,1);
  assert.deepEqual(f.controller.get(),BASE);
});

test('native appearance loads as a classic script with only injected environment services',async()=>{
  const context={};vm.runInNewContext(fs.readFileSync(modelPath,'utf8'),context,{filename:'native-appearance.js'});
  assert.equal(typeof context.ReserveNativeAppearance.create,'function');
  const calls=[];
  context.saved={calls};
  vm.runInNewContext(`globalThis.controller=ReserveNativeAppearance.create({adapter:{read:async()=>({theme:'system'}),write:async()=>{},subscribe:()=>()=>{}},media:{matches:true,addEventListener(){},removeEventListener(){}},apply:(prefs,theme)=>saved.calls.push(theme)});`,context);
  await context.controller.start();assert.deepEqual(calls,['light']);context.controller.destroy();
});
