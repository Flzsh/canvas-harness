// PDF mark-up tools adapted from HarryX081125's work, issue #53.
// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../extension/pdf-model.js');

test('local PDF identities remain account scoped and cannot enter legacy Canvas migration',()=>{
 assert.equal(M.storageKey('https://canvas.school.edu','7','cf-private-notes'),'reserve:pdf:https://canvas.school.edu:7:cf-private-notes');
 assert.notEqual(M.storageKey('https://canvas.school.edu','7','cf-private-notes'),M.storageKey('https://canvas.school.edu','8','cf-private-notes'));
 assert.notEqual(M.storageKey('https://canvas.school.edu','7','cf-private-notes'),M.storageKey('https://other.school.edu','7','cf-private-notes'));
 assert.notEqual(M.storageKey('https://canvas.school.edu','7','cf-0042'),M.storageKey('https://canvas.school.edu','7','42'));
 assert.throws(()=>M.legacyStorageKey('https://canvas.school.edu','cf-private-notes'),/numeric/i);
 for(const id of ['cf-a','cf-../../private','https://school.edu/notes','private-notes'])assert.throws(()=>M.storageKey('https://canvas.school.edu','7',id));
 assert.throws(()=>M.storageKey('http://canvas.school.edu','7','cf-private-notes'));
 assert.throws(()=>M.storageKey('https://canvas.school.edu','other','cf-private-notes'));
});

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

test('remote PDF identities accept only lowercase SHA-256 digests and remain account scoped',()=>{
 const origin='https://tenant.instructure.com',id='remote-'+'a0'.repeat(32),key=M.storageKey(origin,'7',id);
 assert.equal(key,'reserve:pdf:'+origin+':7:'+id);
 assert.notEqual(key,M.storageKey(origin,'8',id));assert.notEqual(key,M.storageKey('https://other.instructure.com','7',id));
 assert.notEqual(key,M.storageKey(origin,'7','cf-'+'a0'.repeat(20)));
 assert.throws(()=>M.legacyStorageKey(origin,id),/numeric/i);
 for(const bad of ['remote-','remote-'+'a'.repeat(63),'remote-'+'a'.repeat(65),'remote-'+'A'.repeat(64),'remote-'+'g'.repeat(64),'remote-'+('a'.repeat(63))+'/','ext-'+'a'.repeat(64)])assert.throws(()=>M.storageKey(origin,'7',bad));
 assert.throws(()=>M.storageKey('http://tenant.instructure.com','7',id));assert.throws(()=>M.storageKey(origin,'',id),/verified/i);
});

test('drawing dimensions require finite numbers and validation leaves both history stacks intact',()=>{
 const model=M.createAnnotations(),pen=model.add({type:'pen',page:0,points:[[1,2],[3,4]]});model.undo();
 for(const [field,values]of Object.entries({width:[NaN,Infinity,-Infinity,0,-1,.199,60.001,'2',true,{},[]],opacity:[NaN,Infinity,0,.049,1.001,'0.4',false,{}],size:[NaN,Infinity,0,3.999,96.001,'12',true,{}]}))for(const value of values){
  const record={id:'invalid',type:'pen',page:0,points:[[1,2],[3,4]],[field]:value};
  assert.throws(()=>model.add(record),/Invalid/);assert.throws(()=>M.createAnnotations({version:1,annotations:[record]}),/Invalid/);
  assert.equal(model.canUndo,false);assert.equal(model.canRedo,true);assert.deepEqual(model.annotations,[]);
 }
 assert.equal(model.redo(),true);assert.equal(model.annotations[0].id,pen.id);
 const before=model.serialise();assert.throws(()=>model.update(pen.id,{width:'3'}),/width/i);assert.deepEqual(model.serialise(),before);
 assert.equal(model.canUndo,true);assert.equal(model.canRedo,false);
 for(const details of [{width:.2,opacity:.05,size:4},{width:60,opacity:1,size:96}]){
  const store=M.createAnnotations(),mark=store.add({type:'pen',page:0,points:[[1,2],[3,4]],...details});
  for(const [field,value]of Object.entries(details))assert.equal(mark[field],value);
  assert.deepEqual(M.createAnnotations(store.serialise()).serialise(),store.serialise());
 }
});

test('sparse annotation lists and coordinates fail before a damaged record can enter storage',()=>{
 const sparsePair=new Array(2),sparseRect=new Array(4),sparsePoints=new Array(2),sparseRects=new Array(1);sparsePair[0]=1;sparseRect[0]=1;sparsePoints[0]=[1,2];
 for(const record of [{type:'note',point:sparsePair},{type:'highlight',rects:[sparseRect]},{type:'strike',rects:sparseRects},{type:'pen',points:sparsePoints},{type:'shape',shape:'rect',points:[[0,0],sparsePair]}])assert.throws(()=>M.createAnnotations().add({...record,page:0}),/finite/);
 assert.throws(()=>M.createAnnotations({version:1,annotations:new Array(1)}),/annotation/i);
});

test('redo patches only the changed fields after reconciliation and is itself undoable',()=>{
 const model=M.createAnnotations(),note=model.add({type:'text',page:0,point:[20,30],text:'before',size:12,color:'#112233'});
 model.update(note.id,{text:'after',size:18});assert.equal(model.undo(),true);
 const saved=model.serialise();saved.annotations[0].color='#abcdef';saved.annotations.unshift({...note,id:'remote-mark',text:'remote'});model.replace(saved);
 assert.equal(model.redo(),true);assert.deepEqual(model.annotations.map(a=>a.text),['remote','after']);
 assert.equal(model.annotations[1].color,'#abcdef');assert.equal(model.annotations[1].size,18);
 assert.equal(model.undo(),true);assert.deepEqual(model.annotations.map(a=>a.text),['remote','before']);
 assert.equal(model.annotations[1].color,'#abcdef');assert.equal(model.annotations[1].size,12);
});

test('redo of an edit cannot resurrect a remotely erased record',()=>{
 const model=M.createAnnotations(),note=model.add({type:'note',page:0,point:[20,30],text:'before'});
 model.update(note.id,{text:'after'});model.undo();model.replace({version:1,annotations:[]});
 assert.equal(model.redo(),true);assert.deepEqual(model.annotations,[]);assert.equal(model.undo(),true);assert.deepEqual(model.annotations,[]);
});

test('redo of an add preserves remote additions and keeps the original record identity',()=>{
 const model=M.createAnnotations(),mark=model.add({type:'pen',page:0,points:[[1,2],[3,4]],width:12,opacity:.42});model.undo();
 const remote={id:'remote-mark',type:'note',page:1,point:[20,30],text:'remote'};model.replace({version:1,annotations:[remote]});
 assert.equal(model.redo(),true);assert.equal(model.annotations.find(a=>a.id===mark.id).width,12);assert.equal(model.annotations.find(a=>a.id===mark.id).opacity,.42);
 assert.equal(model.annotations.find(a=>a.id==='remote-mark').text,'remote');
 assert.equal(model.undo(),true);assert.deepEqual(model.annotations.map(a=>a.id),['remote-mark']);
});

test('batched erase redo preserves ordering, remote marks and the latest fields for the next undo',()=>{
 const model=M.createAnnotations(),a=model.add({type:'note',page:0,point:[1,2],text:'a'}),b=model.add({type:'note',page:0,point:[3,4],text:'b'}),c=model.add({type:'note',page:0,point:[5,6],text:'c'});
 assert.equal(model.eraseMany([c.id,a.id,a.id]),2);model.undo();
 const remote=model.serialise();remote.annotations[0].text='remote edit';remote.annotations[2].color='#123456';remote.annotations.splice(1,0,{...b,id:'remote-mark',text:'remote addition'});model.replace(remote);const before=model.serialise();
 assert.equal(model.redo(),true);assert.deepEqual(model.annotations.map(a=>a.id),['remote-mark',b.id]);
 assert.equal(model.undo(),true);assert.deepEqual(model.serialise(),before);
 assert.equal(model.redo(),true);assert.equal(model.undo(),true);assert.deepEqual(model.serialise(),before);
});

test('undo and redo restore absent optional fields without discarding concurrent drawing details',()=>{
 const model=M.createAnnotations(),mark=model.add({type:'pen',page:0,points:[[1,2],[3,4]]});model.update(mark.id,{width:12,opacity:.42});
 model.undo();assert.equal('width'in model.annotations[0],false);assert.equal('opacity'in model.annotations[0],false);
 const saved=model.serialise();saved.annotations[0].color='#123456';model.replace(saved);model.redo();
 assert.equal(model.annotations[0].width,12);assert.equal(model.annotations[0].opacity,.42);assert.equal(model.annotations[0].color,'#123456');
 model.undo();assert.equal('width'in model.annotations[0],false);assert.equal(model.annotations[0].color,'#123456');
});

test('redo quota rejection is atomic and retains the action until storage has room',()=>{
 const saved={version:1,annotations:Array.from({length:102},(_,i)=>({id:'full-'+i,type:'note',page:0,point:[2,3],text:'x'.repeat(10000)}))},model=M.createAnnotations(saved);
 const local=model.add({type:'note',page:0,point:[2,3],text:'y'.repeat(10000)});model.undo();const remote=model.serialise();remote.annotations.push({...remote.annotations[0],id:'remote-add'});model.replace(remote);
 const before=model.serialise();assert.throws(()=>model.redo(),/1 MiB/);assert.deepEqual(model.serialise(),before);assert.equal(model.canRedo,true);assert.equal(model.canUndo,false);
 remote.annotations.pop();model.replace(remote);assert.equal(model.redo(),true);assert.ok(model.annotations.some(a=>a.id===local.id));assert.equal(model.canRedo,false);assert.equal(model.canUndo,true);
});

test('only successful new mutations clear redo and history stays bounded across undo and redo',()=>{
 const model=M.createAnnotations(),mark=model.add({type:'note',page:0,point:[1,2],text:'a'});model.undo();
 assert.equal(model.erase('missing'),false);assert.equal(model.eraseMany(['missing']),0);assert.equal(model.update('missing',{text:'x'}),false);assert.equal(model.canRedo,true);
 model.redo();model.update(mark.id,{text:'b'});model.undo();assert.equal(model.canRedo,true);model.update(mark.id,{text:'c'});assert.equal(model.canRedo,false);assert.equal(model.redo(),false);
 const many=M.createAnnotations();for(let i=0;i<70;i++)many.add({type:'note',page:0,point:[1,2],text:String(i)});
 for(let i=0;i<64;i++)assert.equal(many.undo(),true);assert.equal(many.undo(),false);assert.equal(many.annotations.length,6);
 for(let i=0;i<64;i++)assert.equal(many.redo(),true);assert.equal(many.redo(),false);assert.equal(many.annotations.length,70);
 const restored=M.createAnnotations(many.serialise());assert.equal(restored.canUndo,false);assert.equal(restored.canRedo,false);
});

test('merge persists undo removal of optional drawing fields and preserves unrelated remote edits',()=>{
 const local=M.createAnnotations(),pen=local.add({type:'pen',page:0,points:[[1,2],[3,4]],width:3}),before=local.serialise();
 local.update(pen.id,{width:12,opacity:.42});const after=local.serialise(),remote=M.createAnnotations(before);remote.update(pen.id,{color:'#abcdef'});remote.add({type:'note',page:1,point:[1,2],text:'remote'});
 const merged=M.mergeAnnotations(remote.serialise(),before,after);assert.equal(merged.annotations[0].width,12);assert.equal(merged.annotations[0].opacity,.42);
 local.undo();const undone=M.mergeAnnotations(merged,after,local.serialise());assert.equal(undone.annotations[0].width,3);assert.equal('opacity'in undone.annotations[0],false);assert.equal(undone.annotations[0].color,'#abcdef');assert.equal(undone.annotations.length,2);
 const beforeRedo=local.serialise();local.redo();const redone=M.mergeAnnotations(undone,beforeRedo,local.serialise());assert.equal(redone.annotations[0].width,12);assert.equal(redone.annotations[0].opacity,.42);assert.equal(redone.annotations[0].color,'#abcdef');assert.equal(redone.annotations.length,2);
});
