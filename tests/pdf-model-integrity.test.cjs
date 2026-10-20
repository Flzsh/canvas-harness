'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../extension/pdf-model.js');
test('annotation storage uses the exact owner-defined namespace and width never exceeds 75vw',()=>{
 assert.equal(M.storageKey('https://school.instructure.com','7','42'),'reserve:pdf:https://school.instructure.com:7:42');
 for(const viewport of [301,501,1201,1603])assert.ok(M.clampWidth(99999,viewport)<=viewport*.75);
});
test('restored notes, text marks and strokes require their geometry before reaching the renderer',()=>{
 for(const record of [{type:'note',point:null},{type:'highlight',rects:[]},{type:'underline',rects:[]},{type:'pen',points:[]}]){
  assert.throws(()=>M.createAnnotations({version:1,annotations:[{id:'saved',page:0,...record}]}),/point|rectangle|stroke|geometry/i);
 }
 const model=M.createAnnotations();assert.throws(()=>model.add({type:'note',page:0,point:[10,20],color:'#abcde'}),/color/i);
});


test('restoring an erased mark cannot replace a newer saved record with the same ID',()=>{
 const base=M.createAnnotations({version:1,annotations:[{id:'note',type:'note',page:0,point:[2,3],text:'original'}]}),before=base.serialise();
 base.erase('note');const erased=base.serialise();base.undo();
 const remote=M.createAnnotations(before);remote.update('note',{text:'newer from B',color:'#abc',point:[8,9]});
 assert.deepEqual(M.mergeAnnotations(remote.serialise(),erased,base.serialise()),remote.serialise());
});

for(const many of [false,true])test('queued '+(many?'eraseMany':'erase')+' and undo preserve a concurrent saved edit',()=>{
 const base=M.createAnnotations({version:1,annotations:[{id:'note',type:'note',page:0,point:[2,3],text:'original'},{id:'other',type:'note',page:0,point:[4,5],text:'other'}]}),before=base.serialise();
 if(many)base.eraseMany(['other','note']);else base.erase('note');
 const erased=base.serialise();base.undo();const restored=base.serialise();
 const remote=M.createAnnotations(before);remote.update('note',{text:'newer from B',color:'#abc',point:[8,9]});remote.add({type:'pen',page:1,points:[[1,2],[3,4]]});
 const merged=M.mergeAnnotations(remote.serialise(),[[before,erased],[erased,restored]]);
 assert.deepEqual(merged.annotations.find(a=>a.id==='note'),remote.annotations.find(a=>a.id==='note'));
 assert.deepEqual([...merged.annotations].sort((a,b)=>a.id.localeCompare(b.id)),[...remote.annotations].sort((a,b)=>a.id.localeCompare(b.id)));
 assert.equal(base.undo(),false,'the erase undo step is consumed');
});

test('undo after reconciliation preserves an existing newer note and consumes the erased step',()=>{
 const base=M.createAnnotations({version:1,annotations:[{id:'note',type:'note',page:0,point:[2,3],text:'original'}]}),remote=M.createAnnotations(base.serialise());
 base.erase('note');remote.update('note',{text:'newer from B'});base.replace(remote.serialise());
 assert.equal(base.undo(),true);assert.deepEqual(base.serialise(),remote.serialise());assert.equal(base.undo(),false);
});

test('queued edit, erase and undo retain local edits and concurrent unrelated fields',()=>{
 const base=M.createAnnotations({version:1,annotations:[{id:'note',type:'note',page:0,point:[2,3],text:'original',color:'#fff'}]}),before=base.serialise();
 base.update('note',{text:'local edit'});const edited=base.serialise();base.erase('note');const erased=base.serialise();base.undo();const restored=base.serialise();
 const remote=M.createAnnotations(before);remote.update('note',{color:'#abc'});
 const merged=M.mergeAnnotations(remote.serialise(),[[before,edited],[edited,erased],[erased,restored]]);
 assert.equal(merged.annotations[0].text,'local edit');assert.equal(merged.annotations[0].color,'#abc');
});

test('an erase without undo still removes the mark and an ordinary saved erase can be undone',()=>{
 const base=M.createAnnotations({version:1,annotations:[{id:'note',type:'note',page:0,point:[2,3],text:'original'}]}),before=base.serialise();
 base.erase('note');const erased=base.serialise(),remote=M.createAnnotations(before);remote.update('note',{text:'newer from B'});
 assert.deepEqual(M.mergeAnnotations(remote.serialise(),[[before,erased]]),erased);
 base.undo();assert.deepEqual(M.mergeAnnotations(erased,erased,base.serialise()),before);
});
