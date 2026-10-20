'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../extension/pdf-model.js');

test('reader width uses 52vw by default, clamps to 380px and 75vw, and obeys narrow cap',()=>{
 assert.equal(M.clampWidth(undefined,1200),624);
 assert.equal(M.clampWidth(120,1200),380);
 assert.equal(M.clampWidth(1500,1200),900);
 assert.equal(M.clampWidth(500,400),300);
 assert.equal(M.clampWidth(undefined,320),240);
});

test('render window includes adjacent pages; evict only pages over 3 away from every visible page',()=>{
 assert.deepEqual(M.renderWindow([3,4],10,[0,1,3,4,6,8,9]),{render:[2,3,4,5],free:[8,9]});
 assert.deepEqual(M.renderWindow([0,9],10,[0,3,4,6,9]),{render:[0,1,8,9],free:[4]});
 assert.deepEqual(M.renderWindow([],4,[0,1,2,3]),{render:[],free:[0,1,2,3]});
});

test('annotations partition by origin, verified account and file; theme defaults light unless explicit dark',()=>{
 assert.notEqual(M.storageKey('https://one.instructure.com','7','12'),M.storageKey('https://two.instructure.com','7','12'));
 assert.notEqual(M.storageKey('https://one.instructure.com','7','12'),M.storageKey('https://one.instructure.com','7','13'));
 assert.equal(M.theme({theme:'dark'}),'dark');
 for(const value of [null,{},'system',{theme:'system'},{theme:'DARK'},{theme:'original'}])assert.equal(M.theme(value),'light');
});

test('PDF.js coordinates round-trip for rotations and rects normalize the corners',()=>{
 const vp={convertToPdfPoint:(x,y)=>[y+11,500-x],convertToViewportPoint:(x,y)=>[500-y,x-11]};
 assert.deepEqual(M.viewportToPdf(vp,[40,70]),[81,460]);
 assert.deepEqual(M.pdfToViewport(vp,[81,460]),[40,70]);
 assert.deepEqual(M.rectToPdf(vp,[40,70,140,20]),[31,360,81,460]);
 assert.throws(()=>M.viewportToPdf(vp,[Infinity,1]),/finite/);
});

test('annotation add/update/erase/undo and reload preserve records, including note edits',()=>{
 const store=M.createAnnotations();
 const note=store.add({type:'note',page:2,color:'#f5b3c2',point:[12,34],text:'Start'});
 const pen=store.add({type:'pen',page:0,color:'#000000',points:[[0,1],[3,4]]});
 assert.equal(store.annotations.length,2);assert.ok(note.id&&note.id!==pen.id);
 assert.equal(store.update(note.id,{text:'Edited'}),true);assert.equal(store.annotations[0].text,'Edited');
 assert.equal(store.erase(pen.id),true);assert.equal(store.undo(),true);assert.equal(store.annotations.length,2);
 assert.equal(store.undo(),true);assert.equal(store.annotations[0].text,'Start');
 assert.equal(store.undo(),true);assert.equal(store.annotations.length,1);
 assert.deepEqual(M.createAnnotations(store.serialise()).serialise(),store.serialise());
 assert.equal(store.erase('unknown'),false);
});

test('invalid coordinates, malicious records, text budget, and serialized byte budget fail clearly',()=>{
 const store=M.createAnnotations();
 assert.throws(()=>store.add({type:'highlight',page:0,rects:[[0,0,NaN,6]]}),/finite/);
 assert.throws(()=>store.add({type:'pen',page:-1,points:[[1,2]]}),/page/);
 assert.throws(()=>store.add({type:'note',page:0,point:[1,2],text:'a'.repeat(10001)}),/text/i);
 assert.throws(()=>M.createAnnotations({version:9,annotations:[]}),/version/i);
 const big=M.createAnnotations();
 let count=0;
 for(;count<200;count++){
  try{big.add({type:'note',page:0,color:'#000000',point:[1,2],text:'a'.repeat(9800)});}
  catch(error){assert.match(error.message,/1 MiB|quota/);break;}
 }
 assert.ok(count>=90&&count<200,'a UTF-8 quota exception occurs close to 1 MiB');
 assert.equal(big.annotations.length,count,'quota exception does not insert an unsaved record');
});

test('an eraser drag takes several marks as one change and one undo restores them in place',()=>{
 const store=M.createAnnotations();
 const a=store.add({type:'highlight',page:0,color:'#f6de7a',rects:[[0,0,10,10]],text:'a'});
 const b=store.add({type:'pen',page:0,color:'#000000',points:[[0,1],[3,4]]});
 const c=store.add({type:'underline',page:1,color:'#a9d3f0',rects:[[5,5,20,9]],text:'c'});
 const before=store.serialise();
 assert.equal(store.eraseMany([c.id,a.id,a.id,'missing']),2,'duplicates and unknown ids are ignored');
 assert.deepEqual(store.annotations.map(x=>x.id),[b.id]);
 assert.equal(store.undo(),true);assert.deepEqual(store.serialise(),before,'one undo restores both, in their places');
 assert.equal(store.eraseMany([]),0);assert.equal(store.eraseMany(['missing']),0);
 assert.equal(store.undo(),true);assert.equal(store.annotations.length,2,'an empty drag left no undo step; the earlier add is undone');
});


test('annotation keys require a verified account and isolate equal files across accounts',()=>{
 assert.notEqual(M.storageKey('https://school.instructure.com','7','42'),M.storageKey('https://school.instructure.com','8','42'));
 for(const id of [undefined,null,'','NaN','7|8'])assert.throws(()=>M.storageKey('https://school.instructure.com',id,'42'),/verified/);
 assert.throws(()=>M.storageKey('https://school.instructure.com','7'),/file ID/);assert.equal(M.legacyStorageKey('https://school.instructure.com','42'),'reserve:pdf:https://school.instructure.com:42');
});

test('mutation merging preserves unrelated additions, remote deletion and concurrent fields',()=>{
 const base=M.createAnnotations(),note=base.add({type:'note',page:0,point:[2,3],text:'before'}),before=base.serialise();base.update(note.id,{text:'edited'});const after=base.serialise(),remote=M.createAnnotations(before);remote.update(note.id,{color:'#abc'});remote.add({type:'pen',page:0,points:[[1,2],[3,4]]});
 const merged=M.mergeAnnotations(remote.serialise(),before,after);assert.equal(merged.annotations.length,2);assert.equal(merged.annotations[0].text,'edited');assert.equal(merged.annotations[0].color,'#abc');
 remote.erase(note.id);assert.equal(M.mergeAnnotations(remote.serialise(),before,after).annotations.length,1,'editing cannot resurrect a remotely erased mark');
});

test('undo tracks mark identity after storage reconciliation changes the list order',()=>{
 const model=M.createAnnotations(),note=model.add({type:'note',page:0,point:[2,3],text:'before'});model.update(note.id,{text:'edited'});const saved=model.serialise();saved.annotations.unshift({...note,id:'other',text:'remote'});model.replace(saved);model.undo();assert.deepEqual(model.annotations.map(a=>a.text),['remote','before']);
});


test('undoing a note edit preserves another tab colour change to that note',()=>{
 const model=M.createAnnotations(),note=model.add({type:'note',page:0,point:[2,3],text:'before',color:'#fff'});model.update(note.id,{text:'edited'});const saved=model.serialise();saved.annotations[0].color='#abc';model.replace(saved);model.undo();assert.equal(model.annotations[0].text,'before');assert.equal(model.annotations[0].color,'#abc');
});


test('undo quota rejection restores the exact record and retains its undo action for recovery',()=>{
 const saved={version:1,annotations:Array.from({length:103},(_,i)=>({id:'full-'+i,type:'note',page:0,point:[2,3],text:'x'.repeat(10000)}))},model=M.createAnnotations(saved),removed=model.annotations[0];model.erase(removed.id);const remote=model.serialise();remote.annotations.push({...removed,id:'new-remote'});model.replace(remote);const before=model.serialise();assert.throws(()=>model.undo(),/1 MiB/);assert.deepEqual(model.serialise(),before);remote.annotations.pop();model.replace(remote);assert.equal(model.undo(),true);assert.equal(model.annotations.length,103);assert.ok(model.annotations.some(a=>a.id===removed.id));
});
