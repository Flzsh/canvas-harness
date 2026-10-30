const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createClient}=require('../extension/api.js');
const {createStore,validateBackup}=require('../extension/storage.js');
const response=data=>({ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':null},json:async()=>data});
const memory=()=>{const data={};return {read:async k=>structuredClone(data[k]),write:async(k,v)=>{await new Promise(r=>setTimeout(r,2));data[k]=structuredClone(v);}};};
test('separate stores serialize fresh reads so independent tab edits survive',async()=>{
 const adapter=memory(),a=createStore({accountId:'1',adapter}),b=createStore({accountId:'1',adapter});await Promise.all([a.load(),b.load()]);
 await Promise.all([a.update(s=>{s.tasks['1']={notes:'first tab'};}),b.update(s=>{s.tasks['2']={notes:'second tab'};})]);
 const saved=await createStore({accountId:'1',adapter}).load();assert.equal(saved.tasks['1'].notes,'first tab');assert.equal(saved.tasks['2'].notes,'second tab');
});
test('aborting a snapshot rejects it and schedules no additional courses',async()=>{
 const ac=new AbortController();let calls=0;
 const client=createClient({fetchImpl:async(url,opts)=>{
  if(url.includes('/profile'))return response({id:'1'});
  if(url.includes('/courses?'))return response(Array.from({length:8},(_,i)=>({id:i+1})));
  calls++;if(calls===1)queueMicrotask(()=>ac.abort());
  return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));if(opts.signal.aborted)abort();else opts.signal.addEventListener('abort',abort,{once:true});});
 }});
 await assert.rejects(client.loadSnapshot({signal:ac.signal}),e=>e.code==='cancelled');assert.ok(calls<=3);
});
test('all Canvas requests explicitly ask for string identifiers',async()=>{
 const client=createClient({fetchImpl:async(url,opts)=>{assert.equal(opts.headers.Accept,'application/json+canvas-string-ids');return response({id:'9007199254740993'});}});
 assert.equal((await client.profile()).id,'9007199254740993');
});
test('snapshot ownership is verified even if a cached profile is supplied',async()=>{
 let profileCalls=0;
 const client=createClient({fetchImpl:async url=>url.includes('/profile')?(profileCalls++,response({id:'2'})):response([])});
 await assert.rejects(client.loadSnapshot({user:{id:'1'}}),e=>e.code==='auth');assert.ok(profileCalls>0);
});
test('account switch during a refresh cannot produce a mixed snapshot',async()=>{
 let profileCalls=0;const client=createClient({fetchImpl:async url=>url.includes('/profile')?response({id:String(++profileCalls)}):response([])});
 await assert.rejects(client.loadSnapshot(),e=>e.code==='auth');
});
test('cache rejects another account or origin',async()=>{
 const store=createStore({accountId:'1',adapter:memory()});await store.load();
 await assert.rejects(store.writeCache({user:{id:'2'},origin:'https://school.instructure.com'}),/account|owner/i);
 await assert.rejects(store.writeCache({user:{id:'1'},origin:'https://other.example'}),/origin|owner/i);
});
test('backups carry their owner and reject a different account',async()=>{
 const store=createStore({accountId:'1',adapter:memory()});await store.load();const backup=store.exportBackup();
 assert.equal(backup.owner.accountId,'1');assert.throws(()=>validateBackup(backup,{accountId:'2',origin:'https://school.instructure.com'}),/account/i);
});
test('backups reject duplicate tasks and overflowing lists without truncating',()=>{
 const item={id:'local-x',name:'Task',dueAt:null};const backup={format:'reserve-backup',version:1,data:{customTasks:[item,item]}};
 assert.throws(()=>validateBackup(backup),/duplicate/i);
 backup.data.customTasks=Array.from({length:1001},(_,i)=>({...item,id:`local-${i}`}));assert.throws(()=>validateBackup(backup),/many/i);
});
test('invalid planned dates and timezone-free stored instants are rejected',()=>{
 const b={format:'reserve-backup',version:1,data:{tasks:{'1':{plannedDate:'2026-02-30'}}}};
 assert.throws(()=>validateBackup(b),/date/i);
 b.data={customTasks:[{id:'local-x',name:'Task',dueAt:'2026-09-11T15:00'}]};assert.throws(()=>validateBackup(b),/date|offset|timezone/i);
});
test('oversized saves fail atomically before producing an unrestorable backup',async()=>{
 const store=createStore({accountId:'1',adapter:memory()});await store.load();
 await assert.rejects(store.update(s=>{for(let i=0;i<400;i++)s.tasks[String(i)]={notes:'字'.repeat(20000)};}),/large|size|limit/i);
 assert.equal(Object.keys(store.get().tasks).length,0);
});
