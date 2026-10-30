'use strict';
// Each store notice is one full dashboard render, so an update that leaves the data as it was must not notify.
const test=require('node:test'),assert=require('node:assert/strict'),{createStore}=require('../extension/storage.js');
function memory(){const state={};return {read:async k=>structuredClone(state[k]),write:async(k,v)=>{state[k]=structuredClone(v);}};}

test('an update that changes nothing wakes no listener; a real change still notifies once',async()=>{
 const store=createStore({accountId:'7',adapter:memory()});await store.load();let notices=0;store.subscribe(()=>notices++);
 // The first save on an empty account fills in cleaned defaults, which is a real change.
 await store.update(()=>{});assert.equal(notices,1);
 const result=await store.update(()=>{});assert.equal(notices,1,'a no-op update is silent');assert.deepEqual(result,store.get(),'it still resolves with the saved data');
 await store.update(data=>{data.tasks['1']={notes:'Read'};});assert.equal(notices,2);assert.equal(store.get().tasks['1'].notes,'Read');
 await store.update(data=>{data.tasks['1']={notes:'Read'};});assert.equal(notices,2,'writing the same value again is silent');
 await store.update(data=>{delete data.tasks['1'];});assert.equal(notices,3);assert.equal(store.get().tasks['1'],undefined);
 await store.update(data=>{data.settings.theme=data.settings.theme==='dark'?'light':'dark';});assert.equal(notices,4,'device appearance changes still notify');
 store.destroy();
});

test('load tells listeners about data saved elsewhere and stays quiet when nothing changed',async()=>{
 // No change events: the other tab's write is only seen when this tab loads again.
 const adapter=memory(),store=createStore({accountId:'1',adapter});await store.load();const seen=[];store.subscribe(data=>seen.push(data.tasks['2']?.notes));
 await store.load();assert.deepEqual(seen,[],'a load that finds the same data is not a redraw');
 const other=createStore({accountId:'1',adapter});await other.load();await other.update(s=>{s.tasks['2']={notes:'Other tab'};});
 assert.equal((await store.load()).tasks['2'].notes,'Other tab');assert.deepEqual(seen,['Other tab']);
 await store.update(()=>{});await store.load();assert.deepEqual(seen,['Other tab']);store.destroy();other.destroy();
});
