const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore}=require('../extension/storage.js');
test('a Chrome-style self notification does not rerender and erase an undo toast',async()=>{
 const state={},callbacks=new Set();const adapter={read:async k=>structuredClone(state[k]),write:async(k,v)=>{state[k]=structuredClone(v);for(const fn of callbacks)fn();},subscribe:(k,fn)=>{callbacks.add(fn);return()=>callbacks.delete(fn);}};
 const store=createStore({accountId:'1',adapter});await store.load();let notifications=0;store.subscribe(()=>notifications++);
 await store.update(s=>{s.tasks['1']={notes:'Saved'};});await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(notifications,1);
 const other=createStore({accountId:'1',adapter});await other.load();await other.update(s=>{s.tasks['2']={notes:'Other tab'};});await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(store.get().tasks['2'].notes,'Other tab');assert.equal(notifications,2);store.destroy();other.destroy();
});
test('an update that changes nothing wakes no listener, a real change still does',async()=>{
 const state={},adapter={read:async k=>structuredClone(state[k]),write:async(k,v)=>{state[k]=structuredClone(v);}};
 const store=createStore({accountId:'1',adapter});await store.load();await store.update(s=>{s.tasks['1']={notes:'Saved'};});let notifications=0;store.subscribe(()=>notifications++);
 const before=await store.update(()=>{});assert.equal(notifications,0,'a no-op update (the AI helper tidy-up, a settle) is not a redraw');assert.deepEqual(before,store.get());
 await store.update(s=>{s.tasks['1']={notes:'Saved'};});assert.equal(notifications,0,'writing the stored value again changes nothing');
 await store.update(s=>{s.tasks['1']={notes:'Changed'};});assert.equal(notifications,1);assert.equal(store.get().tasks['1'].notes,'Changed');
 await store.update(s=>{s.settings.theme=s.settings.theme==='dark'?'light':'dark';});assert.equal(notifications,2,'device appearance changes still notify');store.destroy();
});
test('load tells listeners about data saved elsewhere and stays quiet when nothing changed',async()=>{
 // No change events: the other tab's write is only seen when this tab loads again (as session.verify does on return).
 const state={},adapter={read:async k=>structuredClone(state[k]),write:async(k,v)=>{state[k]=structuredClone(v);}};
 const store=createStore({accountId:'1',adapter});await store.load();const seen=[];store.subscribe(data=>seen.push(data.tasks['2']?.notes));
 await store.load();assert.deepEqual(seen,[],'a load that finds the same data is not a redraw');
 const other=createStore({accountId:'1',adapter});await other.load();await other.update(s=>{s.tasks['2']={notes:'Other tab'};});
 assert.equal((await store.load()).tasks['2'].notes,'Other tab');assert.deepEqual(seen,['Other tab']);
 await store.update(()=>{});await store.load();assert.deepEqual(seen,['Other tab']);store.destroy();other.destroy();
});
