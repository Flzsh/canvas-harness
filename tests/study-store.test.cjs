'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {storage,practice}=require('./study-fixture.cjs');
const UI=()=>require('../extension/study-ui.js'),scope='https://school.instructure.com|7|c1|a';
test('study saves replace the same kind/item, remove, and retain the newest 40 in one account map',async()=>{
 const local=storage(),s=UI().createStore({chrome:{storage:{local}}});
 for(let n=0;n<42;n++)await s.save(scope,{v:1,kind:'practice',itemId:String(n),courseId:'c1',title:'Set '+n,item:'Assignment',savedAt:n,data:practice(),progress:{}});
 let map=await s.list(scope);assert.equal(Object.keys(map).length,40);assert.equal(map['practice:0'],undefined);assert.equal(map['practice:1'],undefined);
 await s.save(scope,{...map['practice:2'],savedAt:100,title:'Replacement'});map=await s.list(scope);assert.equal(Object.keys(map).length,40);assert.equal(map['practice:2'].title,'Replacement');
 await s.remove(scope,'practice:2');assert.equal(Object.keys(await s.list(scope)).length,39);assert.equal(Object.keys(local.saved).length,1);assert.match(Object.keys(local.saved)[0],/^reserve:/);
 assert.deepEqual(await s.list('https://school.instructure.com|8|c1|a'),{});
});
test('title hashes are deterministic and progress persists without recreating removed aids',async()=>{
 const local=storage(),s=UI().createStore({chrome:{storage:{local}}}),record={v:1,kind:'practice',itemId:'',courseId:'',title:'PDF title',item:'',savedAt:1,data:practice(),progress:{}};
 const first=await s.save(scope,record),second=await s.save(scope,record);assert.equal(first.key,second.key);assert.match(first.key,/^practice:.+/);assert.equal(Object.keys(await s.list(scope)).length,1);
 await s.progress(scope,first.key,{checked:{'step:0':true}});assert.equal((await s.list(scope))[first.key].progress.checked['step:0'],true);
 await s.remove(scope,first.key);await s.progress(scope,first.key,{checked:{'step:0':false}});assert.deepEqual(await s.list(scope),{});
});
test('concurrent saves and progress patches from different panels preserve both aids',async()=>{
 const local=storage(),env={chrome:{storage:{local}}},a=UI().createStore(env),b=UI().createStore(env);
 await Promise.all([a.save(scope,{kind:'practice',itemId:'a',savedAt:1}),b.save(scope,{kind:'reading',itemId:'b',savedAt:2})]);
 assert.deepEqual(Object.keys(await a.list(scope)).sort(),['practice:a','reading:b']);
 await Promise.all([a.progress(scope,'practice:a',{practice:{at:1}}),b.progress(scope,'reading:b',{revealed:{0:true}})]);
 const map=await a.list(scope);assert.equal(map['practice:a'].progress.practice.at,1);assert.equal(map['reading:b'].progress.revealed[0],true);
});
test('storage failures reject and do not silently discard a pasted answer',async()=>{
 const s=UI().createStore({chrome:{storage:{local:{get:async()=>({}),set:async()=>{throw Error('Disk full');}}}}});
 await assert.rejects(s.save(scope,{kind:'practice',itemId:'a'}),/Disk full/);
});
