'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),P=require('../extension/pets.js'),{fixture}=require('./pony-fixture.cjs');
const MIN=60000,NOW=Date.UTC(2026,9,20,16),KEY='canvas-harness:activity';
function storage(raw=null){let value=raw;const writes=[],reads=[];return {writes,reads,getItem(key){reads.push(key);assert.equal(key,KEY);return value;},setItem(key,next){assert.equal(key,KEY);assert.equal(typeof next,'string');value=next;writes.push(JSON.parse(next));},get value(){return value;},get saved(){return JSON.parse(value);}};}
function activity({at=NOW,store=storage(),hidden=false,api=P}={}){let clock=at,invisible=hidden;const a=api.createActivity({now:()=>clock,storage:()=>store,hidden:()=>invisible});return {a,store,at:t=>clock=t,hide:v=>invisible=v};}
const valid=extra=>({active:2*MIN,last:NOW-5000,hiddenAt:null,offered:MIN,session:7,savedAt:NOW-2000,...extra});
const fresh=a=>{const s=a.snapshot(NOW);assert.equal(s.active,0);assert.equal(s.offered,0);assert.match(s.session,/^\d+$/);assert.ok(Number.isSafeInteger(Number(s.session)));};

test('reloads preserve active use, offered use and session without counting the unloaded gap',()=>{
 const store=storage(),f=activity({store});f.a.input(NOW);f.at(NOW+5*MIN);f.a.input(NOW+5*MIN);f.a.shown(NOW+5*MIN);f.at(NOW+6*MIN);f.a.flush(NOW+6*MIN);
 const before=f.a.snapshot(NOW+6*MIN),saved=store.saved;assert.deepEqual(before,{active:6*MIN,offered:5*MIN,session:'0'});assert.deepEqual(Object.keys(saved).sort(),['active','hiddenAt','last','offered','savedAt','session']);assert.equal(saved.savedAt,NOW+6*MIN);assert.equal(typeof saved.session,'number');assert.equal(saved.last,NOW+5*MIN);assert.equal(saved.hiddenAt,null);
 const resumed=activity({at:NOW+8*MIN,store});assert.deepEqual(resumed.a.snapshot(NOW+8*MIN),before);resumed.at(NOW+9*MIN);resumed.a.input(NOW+9*MIN);assert.deepEqual(resumed.a.snapshot(NOW+9*MIN),{...before,active:7*MIN});resumed.a.flush(NOW+9*MIN);
 const again=activity({at:NOW+10*MIN,store});assert.deepEqual(again.a.snapshot(NOW+10*MIN),{...before,active:7*MIN});again.at(NOW+11*MIN);assert.equal(again.a.snapshot(NOW+11*MIN).active,8*MIN);
});
test('an offer inside the checkpoint window survives a forced pagehide checkpoint',()=>{
 const f=activity();f.a.input(NOW);f.a.flush(NOW);const count=f.store.writes.length;f.at(NOW+1000);f.a.shown(NOW+1000);assert.equal(f.a.snapshot(NOW+1000).offered,1000);f.a.flush(NOW+1000);assert.equal(f.store.writes.length,count+1);assert.equal(f.store.saved.offered,1000);const resumed=activity({at:NOW+2000,store:f.store});assert.equal(resumed.a.snapshot(NOW+2000).offered,1000);
});
test('a nonzero session created by inactivity survives subsequent reloads',()=>{
 const f=activity();f.a.input(NOW);f.at(NOW+10*MIN);const reset=f.a.snapshot(NOW+10*MIN);assert.notEqual(reset.session,'0');f.a.input(NOW+10*MIN);f.at(NOW+11*MIN);f.a.shown(NOW+11*MIN);f.a.flush(NOW+11*MIN);const resumed=activity({at:NOW+12*MIN,store:f.store});assert.deepEqual(resumed.a.snapshot(NOW+12*MIN),{active:MIN,offered:MIN,session:reset.session});
});
for(const gap of [10*MIN-1,10*MIN,10*MIN+1])test('restoration uses the exact ten-minute last-input boundary: '+gap,()=>{
 const f=activity({store:storage(JSON.stringify(valid({last:NOW-gap,savedAt:NOW-1})))}),s=f.a.snapshot(NOW);if(gap<10*MIN)assert.deepEqual(s,{active:2*MIN,offered:MIN,session:'7'});else{assert.equal(s.active,0);assert.equal(s.offered,0);}
});
const badFields=[
 ['negative active',{active:-1}],['active exceeds savedAt',{active:NOW}],['negative offered',{offered:-1}],['offered exceeds active',{offered:3*MIN}],['string active',{active:'120000'}],['string offered',{offered:'60000'}],['null active',{active:null}],['null offered',{offered:null}],
 ['negative last',{last:-1}],['string last',{last:String(NOW-5000)}],['future last',{last:NOW+1,savedAt:NOW+1}],['last after checkpoint',{last:NOW-1000}],['negative checkpoint',{savedAt:-1}],['future checkpoint',{savedAt:NOW+1}],['string checkpoint',{savedAt:String(NOW-2000)}],['null checkpoint',{savedAt:null}],
 ['negative hiddenAt',{hiddenAt:-1}],['future hiddenAt',{hiddenAt:NOW+1}],['hiddenAt after checkpoint',{hiddenAt:NOW-1000}],['hiddenAt before last',{hiddenAt:NOW-6000}],['string hiddenAt',{hiddenAt:String(NOW-3000)}],
 ['negative session',{session:-1}],['fractional session',{session:1.5}],['unsafe session',{session:Number.MAX_SAFE_INTEGER+1}],['string session',{session:'7'}],['null session',{session:null}]
];
for(const [name,patch]of badFields)test('restoration rejects '+name,()=>{fresh(activity({store:storage(JSON.stringify(valid(patch)))}).a);});
for(const field of ['active','last','hiddenAt','offered','session','savedAt'])for(const value of ['1e999','-1e999'])test('restoration rejects nonfinite '+field+' '+value,()=>{const raw=JSON.stringify(valid({[field]:'NONFINITE'})).replace('"NONFINITE"',value);fresh(activity({store:storage(raw)}).a);});
for(const field of ['active','last','hiddenAt','offered','session','savedAt'])test('restoration rejects a missing '+field,()=>{const row=valid();delete row[field];fresh(activity({store:storage(JSON.stringify(row))}).a);});
for(const raw of ['{','null','[]','true','42','"text"','{}'])test('restoration tolerates malformed or unrelated JSON '+raw,()=>{fresh(activity({store:storage(raw)}).a);});
test('a checkpoint without a last input starts a fresh idle session',()=>{const f=activity({store:storage(JSON.stringify(valid({active:0,last:null,offered:0,session:4})))});assert.deepEqual(f.a.snapshot(NOW),{active:0,offered:0,session:'0'});f.at(NOW+MIN);assert.equal(f.a.snapshot(NOW+MIN).active,0);f.a.input(NOW+MIN);f.at(NOW+2*MIN);assert.equal(f.a.snapshot(NOW+2*MIN).active,MIN);});
test('an exhausted session counter starts over before its next reset could overflow',()=>{fresh(activity({store:storage(JSON.stringify(valid({session:Number.MAX_SAFE_INTEGER})))}).a);});

test('all regular checkpoint paths share a 30000 ms budget and flush forces an extra write',()=>{
 const f=activity();f.a.input(NOW);f.a.flush(NOW);let count=f.store.writes.length;
 for(const dt of [1,1000,29999]){f.at(NOW+dt);f.a.input(NOW+dt);f.a.snapshot(NOW+dt);f.a.shown(NOW+dt);f.a.visibility(NOW+dt,false);}assert.equal(f.store.writes.length,count);
 f.at(NOW+30000);f.a.snapshot(NOW+30000);assert.equal(f.store.writes.length,++count);assert.equal(f.store.saved.active,30000);f.a.input(NOW+30000);f.a.shown(NOW+30000);assert.equal(f.store.writes.length,count);f.a.flush(NOW+30000);assert.equal(f.store.writes.length,++count);assert.equal(f.store.saved.offered,30000);
 f.at(NOW+59999);f.a.snapshot(NOW+59999);assert.equal(f.store.writes.length,count);f.at(NOW+60000);f.a.snapshot(NOW+60000);assert.equal(f.store.writes.length,count+1);
});
for(const method of ['snapshot','input','shown','visible return'])test(method+' checkpoints after the shared throttle expires',()=>{
 const f=activity();f.a.input(NOW);f.a.flush(NOW);const count=f.store.writes.length;if(method==='visible return'){f.at(NOW+1000);f.a.visibility(NOW+1000,true);}f.at(NOW+30000);if(method==='visible return')f.a.visibility(NOW+30000,false);else f.a[method](NOW+30000);assert.equal(f.store.writes.length,count+1);assert.equal(f.store.saved.savedAt,NOW+30000);
});
test('the persisted savedAt carries the write throttle across a reload',()=>{
 const f=activity();f.a.input(NOW);f.a.flush(NOW);const count=f.store.writes.length,r=activity({at:NOW+10000,store:f.store});r.a.snapshot(NOW+10000);r.a.input(NOW+10000);r.a.shown(NOW+10000);r.at(NOW+29999);r.a.snapshot(NOW+29999);assert.equal(f.store.writes.length,count);r.at(NOW+30000);r.a.snapshot(NOW+30000);assert.equal(f.store.writes.length,count+1);assert.equal(f.store.saved.active,20000);
});
test('the hidden callback blocks every write including flush before visibilitychange arrives',()=>{
 const f=activity();f.a.input(NOW);f.a.flush(NOW);const count=f.store.writes.length;f.hide(true);f.at(NOW+MIN);f.a.snapshot(NOW+MIN);f.a.input(NOW+MIN);f.a.shown(NOW+MIN);f.a.visibility(NOW+MIN,false);f.a.flush(NOW+MIN);assert.equal(f.store.writes.length,count);
});
test('in-memory hiddenAt blocks writes even when the hidden callback still says visible',()=>{
 const f=activity();f.a.input(NOW);f.a.flush(NOW);const count=f.store.writes.length;f.at(NOW+MIN);f.a.visibility(NOW+MIN,true);f.at(NOW+2*MIN);f.a.input(NOW+2*MIN);f.a.shown(NOW+2*MIN);f.a.snapshot(NOW+2*MIN);f.a.flush(NOW+2*MIN);assert.equal(f.store.writes.length,count);assert.equal(f.a.snapshot(NOW+2*MIN).active,MIN);
});
test('short hides pause active time and the original input gap without resetting',()=>{
 const f=activity();f.a.input(NOW);f.at(NOW+5*MIN);f.a.input(NOW+5*MIN);f.at(NOW+9*MIN);f.a.visibility(NOW+9*MIN,true);const before=f.a.snapshot(NOW+9*MIN);f.at(NOW+15*MIN);f.a.visibility(NOW+15*MIN,false);assert.deepEqual(f.a.snapshot(NOW+15*MIN),before);f.at(NOW+20*MIN);assert.deepEqual(f.a.snapshot(NOW+20*MIN),{...before,active:14*MIN});f.at(NOW+21*MIN);assert.equal(f.a.snapshot(NOW+21*MIN).active,0);
});
for(const gap of [10*MIN-1,10*MIN,10*MIN+1])test('hidden restoration checks its own exact ten-minute boundary: '+gap,()=>{
 const hiddenAt=NOW-gap,last=hiddenAt,store=storage(JSON.stringify(valid({last,hiddenAt,savedAt:hiddenAt}))),f=activity({store,hidden:true}),s=f.a.snapshot(NOW);if(gap<10*MIN)assert.deepEqual(s,{active:2*MIN,offered:MIN,session:'7'});else{assert.equal(s.active,0);assert.equal(s.offered,0);}assert.equal(store.writes.length,0);f.hide(false);f.a.visibility(NOW,false);const resumed=f.a.snapshot(NOW);assert.equal(resumed.active,s.active);assert.equal(resumed.offered,s.offered);
});
test('a restored hidden interval cannot resume when its original last input is already stale',()=>{fresh(activity({hidden:true,store:storage(JSON.stringify(valid({last:NOW-10*MIN,hiddenAt:NOW-MIN,savedAt:NOW-MIN})))}).a);});
test('a ten-minute in-memory hide resets active and offered use on visible return',()=>{const f=activity();f.a.input(NOW);f.at(NOW+MIN);f.a.shown(NOW+MIN);f.a.visibility(NOW+MIN,true);f.at(NOW+11*MIN);f.a.visibility(NOW+11*MIN,false);const s=f.a.snapshot(NOW+11*MIN);assert.equal(s.active,0);assert.equal(s.offered,0);assert.notEqual(s.session,'0');});

for(const kind of ['callback','getItem','setItem','getItem getter','setItem getter','unavailable'])test('storage '+kind+' failure preserves usable in-memory activity',()=>{
 const fail=()=>{throw Error('Storage denied');},store=kind==='unavailable'?undefined:{getItem:()=>null,setItem(){}};if(kind==='getItem'||kind==='setItem')store[kind]=fail;if(kind.endsWith(' getter'))Object.defineProperty(store,kind.split(' ')[0],{get:fail});let at=NOW;const a=P.createActivity({now:()=>at,storage:kind==='callback'?fail:()=>store,hidden:()=>false});a.input(at);at+=MIN;a.input(at);a.shown(at);a.flush(at);at+=MIN;assert.deepEqual(a.snapshot(at),{active:2*MIN,offered:MIN,session:'0'});a.visibility(at,true);at+=MIN;a.visibility(at,false);assert.equal(a.snapshot(at).active,2*MIN);
});
test('storage acquisition that starts throwing at checkpoint time is contained',()=>{let at=NOW,denied=false;const store=storage(),a=P.createActivity({now:()=>at,storage:()=>{if(denied)throw Error('Storage getter denied');return store;}});a.input(at);denied=true;at+=MIN;a.flush(at);a.shown(at);at+=MIN;assert.deepEqual(a.snapshot(at),{active:2*MIN,offered:MIN,session:'0'});});
test('activity persistence schedules no timers',()=>{const fail=()=>{throw Error('Unexpected timer');},env={setTimeout:fail,setInterval:fail};vm.runInNewContext(fs.readFileSync(require.resolve('../extension/pets.js'),'utf8'),env);const f=activity({api:env.ReservePets});f.a.input(NOW);f.at(NOW+MIN);f.a.snapshot(NOW+MIN);f.a.shown(NOW+MIN);f.a.flush(NOW+MIN);assert.equal(f.store.saved.active,MIN);});

test('controller pagehide flushes injected sessionStorage and reload excludes the page gap',()=>{
 const store=storage(),f=fixture({sessionStorage:store,epoch:NOW});try{assert.equal(f.win.events.get('pagehide')?.size,1);f.doc.emit('keydown');f.stall(2*MIN);f.doc.emit('pointermove');f.win.emit('pagehide');assert.equal(store.saved.active,2*MIN);assert.equal(store.saved.savedAt,NOW+2*MIN);const session=store.saved.session;f.controller.destroy();assert.equal(f.win.events.get('pagehide')?.size,0);const r=fixture({sessionStorage:store,epoch:NOW+4*MIN});try{r.win.emit('pagehide');assert.equal(store.saved.active,2*MIN);assert.equal(store.saved.session,session);r.stall(MIN);r.win.emit('pagehide');assert.equal(store.saved.active,3*MIN);}finally{r.controller.destroy();}}finally{f.controller.destroy();}
});

test('75 active minutes across three page loads produce the stretch offer',()=>{
 const brain=require('../extension/pony-brain.js'),store=storage();let epoch=NOW;
 for(let page=0;page<3;page++){
  const f=fixture({brain,sessionStorage:store,epoch});
  try{f.doc.emit('keydown');for(let i=0;i<5;i++){f.stall(5*MIN);f.doc.emit('pointermove');}if(page===2)assert.match(f.bubble?.html||'',/Stand up and stretch/);else assert.doesNotMatch(f.bubble?.html||'',/Stand up and stretch/);f.win.emit('pagehide');assert.equal(store.saved.active,(page+1)*25*MIN);epoch+=25*MIN+1000;}finally{f.controller.destroy();}
 }
 assert.equal(store.saved.offered,75*MIN);
});
test('controller hidden state suppresses pagehide writes and resumes only visible accumulation',()=>{
 const store=storage(),f=fixture({sessionStorage:store,epoch:NOW});try{f.doc.emit('keydown');f.win.emit('pagehide');const count=store.writes.length;f.stall(MIN);f.doc.hidden=true;f.win.emit('pagehide');assert.equal(store.writes.length,count);f.doc.emit('visibilitychange');f.stall(2*MIN);f.doc.emit('keydown');f.win.emit('pagehide');assert.equal(store.writes.length,count);f.doc.hidden=false;f.doc.emit('visibilitychange');f.win.emit('pagehide');assert.equal(store.saved.active,MIN);f.stall(MIN);f.win.emit('pagehide');assert.equal(store.saved.active,2*MIN);}finally{f.controller.destroy();}
});
test('controller pagehide tolerates a sessionStorage getter becoming unavailable',()=>{const store=storage(),f=fixture({sessionStorage:store,epoch:NOW});try{f.doc.emit('keydown');Object.defineProperty(f.win,'sessionStorage',{get(){throw Error('Storage getter denied');}});f.stall(MIN);assert.doesNotThrow(()=>f.win.emit('pagehide'));f.doc.emit('pointermove');assert.doesNotThrow(()=>f.controller.sync());}finally{f.controller.destroy();}});
test('controller pagehide listener follows activity mount and unmount without duplicates',()=>{
 const store=storage(),f=fixture({sessionStorage:store,epoch:NOW});try{assert.equal(f.win.events.get('pagehide')?.size,1);f.setPet({enabled:false});assert.equal(f.win.events.get('pagehide')?.size,0);const count=store.writes.length;f.win.emit('pagehide');assert.equal(store.writes.length,count);f.setPet({enabled:true});f.controller.sync();f.controller.sync();assert.equal(f.win.events.get('pagehide')?.size,1);f.controller.destroy();assert.equal(f.win.events.get('pagehide')?.size,0);f.win.emit('pagehide');assert.equal(store.writes.length,count);}finally{f.controller.destroy();}
});
