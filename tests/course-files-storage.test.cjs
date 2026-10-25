// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../extension/storage.js'),F=require('../extension/course-files.js'),{fakeIndexedDB}=require('./fake-indexeddb.cjs');
const ORIGIN='https://school.instructure.com',owner={origin:ORIGIN,accountId:'7'};
function memory(){const values=new Map(),control={fail:false};return {values,control,read:async key=>structuredClone(values.get(key)),write:async(key,value)=>{if(control.fail)throw Error('Disk full');values.set(key,structuredClone(value));}};}
function file(name,value='notes',type='text/plain'){return Object.assign(new Blob([value],{type}),{name});}
async function fixture({accountId='7',origin=ORIGIN,adapter=memory(),indexedDB=fakeIndexedDB()}={}){const store=S.createStore({accountId,origin,adapter,courseFilesIndexedDB:indexedDB});await store.load();return {store,adapter,indexedDB,files:F.create({store,indexedDB})};}
const blobs=db=>[...db.databases.values()].flatMap(stores=>[...stores.values()].flatMap(rows=>[...rows.values()].filter(row=>row?.blob instanceof Blob)));
const item=(id,extra={})=>({id,kind:'link',title:'Notes',url:'https://docs.google.com/document/d/notes',...extra});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function appearanceFault(adapter,mode){
 const control={armed:false,committed:false},read=adapter.read,write=adapter.write;
 adapter.read=async key=>{if(control.armed&&control.committed&&mode==='read'&&key==='reserve:appearance')throw Error('Synthetic appearance read failed');return read(key);};
 adapter.write=async(key,value)=>{if(control.armed&&control.committed&&mode==='write'&&key==='reserve:appearance')throw Error('Synthetic appearance write failed');await write(key,value);if(control.armed&&key==='reserve:v1:'+ORIGIN+':7')control.committed=true;};return control;
}
function closingIndexedDB(){
 const factory=fakeIndexedDB(),open=factory.open.bind(factory);factory.closed=0;
 factory.open=(...args)=>{const inner=open(...args),request={};inner.onupgradeneeded=()=>{request.result=inner.result;request.onupgradeneeded?.();};inner.onerror=()=>request.onerror?.();inner.onsuccess=()=>{const db=inner.result,transaction=db.transaction.bind(db);let closed=false;db.close=()=>{if(!closed){closed=true;factory.closed++;}};db.transaction=(...args)=>{if(closed)throw Error('Database connection is closed');return transaction(...args);};request.result=db;request.onsuccess?.();};return request;};return factory;
}

test('link validation rejects active URLs, credentials, control characters and unbounded settings values',()=>{
 assert.equal(F.cleanLink(' docs.google.com/document/d/notes '),'https://docs.google.com/document/d/notes');
 for(const value of ['javascript:alert(1)','data:text/html,bad','file:///tmp/a','https://user:secret@example.com','https://example.com/\nscript','not-a-host','https://example.com/'+ 'x'.repeat(2048)])assert.equal(F.cleanLink(value),'',value);
 assert.equal(F.linkTitle('https://docs.google.com/spreadsheets/d/a',''),'Google Sheet');
 assert.equal(F.linkTitle('https://example.com/','  Unit 2 notes  '),'Unit 2 notes');
});

test('file validation uses the 25 MB SI boundary and only supported document or image names',()=>{
 assert.equal(F.checkFile({name:'Lab.pdf',size:25000000}),'');
 assert.match(F.checkFile({name:'Lab.pdf',size:25000001}),/25 MB/);
 for(const name of ['Essay.docx','Slides.pptx','Budget.xlsx','notes.md','photo.avif'])assert.equal(F.checkFile({name,size:1}),'');
 for(const name of ['program.exe','program.__proto__','program.constructor'])assert.match(F.checkFile({name,size:1}),/PDF.*Word.*PowerPoint.*Excel.*text.*image/i);
 assert.match(F.checkFile({name:'empty.txt',size:0}),/empty/);
 assert.match(F.checkFile({name:'bad.txt',size:NaN}),/size|empty/i);
 assert.match(F.checkFile({name:'bad.txt',size:1.5}),/size/i);
});

test('metadata schemas discard unsafe rows and duplicate IDs without requiring the feature at account load',async()=>{
 const source={5:[item('cf-notes1'),item('cf-notes1'),item('cf-unsafe',{url:'javascript:x'}),item('cf-doc123',{kind:'file',name:'notes.txt',type:'text/html',size:4})],bad:[item('cf-course1')]};
 const clean=F.cleanCourses(source);assert.equal(clean[5].length,2);assert.equal(clean[5][1].type,'text/plain');assert.equal(clean.bad,undefined);
 const env=vm.createContext({Date,Intl,URL,structuredClone,TextEncoder});Object.defineProperty(env,'ReserveCourseFiles',{get(){throw Error('Feature loaded eagerly');}});
 for(const name of ['site.js','gpa-model.js','workspace-arrange.js','customization-model.js','page-preferences.js','storage.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',name),'utf8'),env,{filename:name});
 const backup={format:'reserve-backup',version:1,data:{courseFiles:source}},data=env.ReserveStorage.validateBackup(backup);
 assert.deepEqual(JSON.parse(JSON.stringify(data.courseFiles)),clean);
});

test('links persist through normal backup and remain isolated by account, Canvas origin and course',async()=>{
 const h=await fixture(),a=h.files;
 const added=await a.addLink('5','https://docs.google.com/document/d/notes','Unit notes');
 assert.equal(a.list('5')[0].id,added.id);assert.deepEqual(a.list('6'),[]);
 const snapshot=a.list('5');snapshot[0].title='Changed outside the store';assert.equal(a.list('5')[0].title,'Unit notes');
 const restored=await fixture({adapter:h.adapter,indexedDB:h.indexedDB});assert.equal(restored.files.list('5')[0].title,'Unit notes');
 const other=await fixture({adapter:h.adapter,indexedDB:h.indexedDB,accountId:'8'}),site=await fixture({adapter:h.adapter,indexedDB:h.indexedDB,origin:'https://other.instructure.com'});
 assert.deepEqual(other.files.list('5'),[]);assert.deepEqual(site.files.list('5'),[]);
 assert.equal(S.validateBackup(h.store.exportBackup(),owner).courseFiles[5][0].title,'Unit notes');
 await a.rename('5',added.id,'Renamed');assert.equal(a.list('5')[0].title,'Renamed');
 await a.remove('5',added.id);assert.deepEqual(a.list('5'),[]);assert.equal(h.indexedDB.operations.length,0,'links never open the file database');
 for(const f of [h,restored,other,site]){f.files.destroy();f.store.destroy();}
});

test('file reads require matching account, Canvas origin, course and current metadata',async()=>{
 const h=await fixture(),[saved]=await h.files.addFiles('5',[file('notes.txt','private notes','text/html')]);
 const blob=await h.files.getFile('5',saved.id);assert.equal(await blob.text(),'private notes');assert.equal(blob.type,'text/plain');
 await assert.rejects(h.files.getFile('6',saved.id),/not.*course|not.*saved|missing/i);
 const other=await fixture({adapter:h.adapter,indexedDB:h.indexedDB,accountId:'8'});await other.store.update(d=>{d.courseFiles={5:[saved]};});
 await assert.rejects(other.files.getFile('5',saved.id),/not.*saved|missing/i);
 const site=await fixture({adapter:h.adapter,indexedDB:h.indexedDB,origin:'https://other.instructure.com'});await site.store.update(d=>{d.courseFiles={5:[saved]};});
 await assert.rejects(site.files.getFile('5',saved.id),/not.*saved|missing/i);
 h.store.owner.accountId='8';assert.deepEqual(h.files.list('5'),[]);await assert.rejects(h.files.getFile('5',saved.id),/account.*changed/i);h.store.owner.accountId='7';
 await h.files.remove('5',saved.id);assert.equal(blobs(h.indexedDB).length,0);assert.deepEqual(h.files.list('5'),[]);
 for(const f of [h,other,site]){f.files.destroy();f.store.destroy();}
});

test('failed IndexedDB commit never publishes file metadata',async()=>{
 const h=await fixture();h.indexedDB.failCommit=true;
 await assert.rejects(h.files.addFiles('5',[file('notes.txt')]),/save|storage|abort/i);
 assert.deepEqual(h.files.list('5'),[]);assert.equal(blobs(h.indexedDB).length,0);h.files.destroy();h.store.destroy();
});

test('failed settings publication rolls back uploaded bytes and a failed removal preserves the file',async()=>{
 const h=await fixture();h.adapter.control.fail=true;
 await assert.rejects(h.files.addFiles('5',[file('notes.txt')]),/Disk full/);assert.equal(blobs(h.indexedDB).length,0);assert.deepEqual(h.files.list('5'),[]);
 h.adapter.control.fail=false;const [saved]=await h.files.addFiles('5',[file('notes.txt','keep me')]);h.adapter.control.fail=true;
 await assert.rejects(h.files.remove('5',saved.id),/Disk full/);assert.equal(await (await h.files.getFile('5',saved.id)).text(),'keep me');assert.equal(blobs(h.indexedDB).length,1);
 h.files.destroy();h.store.destroy();
});

test('post-commit appearance reads cannot delete a published upload or resurrect a removed file',async()=>{
 const h=await fixture(),fault=appearanceFault(h.adapter,'read');fault.armed=true;
 await assert.rejects(h.files.addFiles('5',[file('notes.txt','committed bytes')]),error=>error.accountCommitted===true&&/appearance read failed/.test(error.message));
 const [saved]=h.files.list('5');assert.ok(saved);assert.equal(blobs(h.indexedDB).length,1);assert.equal(await (await h.files.getFile('5',saved.id)).text(),'committed bytes');
 fault.armed=false;fault.committed=false;await h.store.sync();fault.armed=true;
 await assert.rejects(h.files.remove('5',saved.id),error=>error.accountCommitted===true&&/appearance read failed/.test(error.message));
 assert.deepEqual(h.files.list('5'),[]);assert.equal(blobs(h.indexedDB).length,0);h.files.destroy();h.store.destroy();
});

test('post-commit appearance writes cannot roll restored bytes back behind published metadata',async()=>{
 const h=await fixture(),[old]=await h.files.addFiles('5',[file('old.txt','before')]),source=await fixture(),[added]=await source.files.addFiles('5',[file('new.txt','after')]);
 const backup=await source.store.exportBackupWithPacks();backup.data.settings.theme='dark';const fault=appearanceFault(h.adapter,'write');fault.armed=true;
 await assert.rejects(h.store.importBackup(backup),error=>error.accountCommitted===true&&/appearance write failed/.test(error.message));
 assert.equal(h.files.list('5')[0].id,added.id);assert.equal(await (await h.files.getFile('5',added.id)).text(),'after');assert.equal(blobs(h.indexedDB).length,1);await assert.rejects(h.files.getFile('5',old.id),/not.*saved|missing/i);
 for(const f of [h,source]){f.files.destroy();f.store.destroy();}
});

test('destroy waits for pending upload rollback before closing its IndexedDB connection',async()=>{
 const indexedDB=closingIndexedDB(),h=await fixture({indexedDB}),entered=deferred(),release=deferred(),write=h.adapter.write;
 h.adapter.write=async(key,value)=>{if(key==='reserve:v1:'+ORIGIN+':7'){entered.resolve();await release.promise;throw Error('Disk full');}return write(key,value);};
 const uploading=h.files.addFiles('5',[file('pending.txt')]);await entered.promise;h.files.destroy();assert.equal(indexedDB.closed,0);assert.deepEqual(h.files.list('5'),[]);release.resolve();
 await assert.rejects(uploading,/Disk full/);assert.equal(blobs(indexedDB).length,0);assert.equal(indexedDB.closed,1);h.store.destroy();
});

test('an account read failure before publication preserves original bytes during removal and restore',async()=>{
 const h=await fixture(),[old]=await h.files.addFiles('5',[file('old.txt','keep original')]),source=await fixture();await source.files.addFiles('5',[file('new.txt','replacement')]);const backup=await source.store.exportBackupWithPacks(),read=h.adapter.read;
 h.adapter.read=async key=>{if(key==='reserve:v1:'+ORIGIN+':7')throw Error('Synthetic account read failed');return read(key);};
 await assert.rejects(h.files.remove('5',old.id),/account read failed/);assert.equal(await (await h.files.getFile('5',old.id)).text(),'keep original');
 await assert.rejects(h.store.importBackup(backup),/account read failed/);assert.equal(await (await h.files.getFile('5',old.id)).text(),'keep original');assert.equal(blobs(h.indexedDB).length,1);
 for(const f of [h,source]){f.files.destroy();f.store.destroy();}
});

test('the 250 MB quota spans courses and deletion frees the actual file budget',async()=>{
 const h=await fixture(),unit=new Blob([new Uint8Array(25000000)]),files=Array.from({length:10},(_,i)=>file('notes-'+i+'.txt',unit));
 const added=await h.files.addFiles('5',files);assert.equal(added.length,10);
 await assert.rejects(h.files.addFiles('6',[file('over.txt','x')]),/250 MB/);assert.deepEqual(h.files.list('6'),[]);
 await h.files.remove('5',added[0].id);await h.files.addFiles('6',[file('next.txt',unit)]);assert.equal(h.files.list('6').length,1);
 h.files.destroy();h.store.destroy();
});

test('asynchronous backups include file bytes and restore them under the verified account',async()=>{
 const h=await fixture();await h.files.addLink('5','https://example.com/notes','Website');const [saved]=await h.files.addFiles('5',[file('notes.txt','original bytes')]);
 const backup=await h.store.exportBackupWithPacks();assert.equal(backup.courseFilesOmitted,0);assert.equal(backup.courseFileBytes.length,1);assert.equal(backup.courseFileBytes[0].base64,'b3JpZ2luYWwgYnl0ZXM=');
 const target=await fixture();await target.store.importBackup(JSON.stringify(backup));assert.equal(target.files.list('5').length,2);assert.equal(await (await target.files.getFile('5',saved.id)).text(),'original bytes');
 const foreign=await fixture({accountId:'8'});await assert.rejects(foreign.store.importBackup(backup),/different Canvas account/);assert.equal(blobs(foreign.indexedDB).length,0);
 for(const f of [h,target,foreign]){f.files.destroy();f.store.destroy();}
});

test('backup omission is explicit and respects the remaining serialized byte budget',async()=>{
 const h=await fixture();await h.files.addFiles('5',[file('small.txt','yes'),file('large.txt','x'.repeat(2000))]);const sync=h.store.exportBackup();
 assert.equal(sync.courseFilesOmitted,2);assert.match(sync.courseFilesNotice,/file/i);
 const limit=Buffer.byteLength(JSON.stringify(sync))+1000,backup=await F.exportFiles(sync,{store:h.store,indexedDB:h.indexedDB,maxBytes:limit});
 assert.equal(backup.courseFileBytes.length,1);assert.equal(backup.courseFilesOmitted,1);assert.match(backup.courseFilesNotice,/omitted|not included|left out/i);assert.ok(Buffer.byteLength(JSON.stringify(backup))<=limit);
 h.files.destroy();h.store.destroy();
});

test('file restore validates bytes before publication and rolls back a failed settings write',async()=>{
 const h=await fixture(),[old]=await h.files.addFiles('5',[file('old.txt','old bytes')]),source=await fixture();await source.files.addFiles('5',[file('new.txt','new bytes')]);const backup=await source.store.exportBackupWithPacks();
 const invalid=structuredClone(backup);invalid.courseFileBytes[0].base64='bad!';await assert.rejects(h.store.importBackup(invalid),/file|base64|bytes/i);assert.equal(await (await h.files.getFile('5',old.id)).text(),'old bytes');
 h.adapter.control.fail=true;await assert.rejects(h.store.importBackup(backup),/Disk full/);assert.equal(await (await h.files.getFile('5',old.id)).text(),'old bytes');assert.equal(blobs(h.indexedDB).length,1);
 h.adapter.control.fail=false;await h.store.importBackup(backup);assert.equal(blobs(h.indexedDB).length,1);await assert.rejects(h.files.getFile('5',old.id),/not.*saved|missing/i);
 for(const f of [h,source]){f.files.destroy();f.store.destroy();}
});

test('recovery snapshots retain uploaded bytes for Undo after a replacement deletes the old file',async()=>{
 const h=await fixture(),[saved]=await h.files.addFiles('5',[file('notes.txt','before restore')]);await h.store.saveRecovery();
 const replacement={format:'reserve-backup',version:1,owner,data:{courseFiles:{}}};await h.store.importBackup(replacement);assert.equal(blobs(h.indexedDB).length,0);
 const recovery=await h.store.readRecoveryBackup();assert.equal(recovery.courseFileBytes.length,1);await h.store.importBackup(recovery);
 assert.equal(await (await h.files.getFile('5',saved.id)).text(),'before restore');h.files.destroy();h.store.destroy();
});

test('restore recovery rejects omitted uploads before changing a cache or recovery snapshot',async()=>{
 const h=await fixture(),unit=new Blob([new Uint8Array(15000000)]);await h.files.addFiles('5',Array.from({length:4},(_,i)=>file('notes-'+i+'.txt',unit)));
 await h.store.writeCache({origin:ORIGIN,user:{id:'7'},courses:[],assignments:[]});const before=h.store.get(),cache=await h.store.readCache();
 await assert.rejects(h.store.saveRecovery(),/cannot.*restore|restore.*cannot/i);
 assert.deepEqual(h.store.get(),before);assert.deepEqual(await h.store.readCache(),cache);assert.equal(await h.store.readRecoveryBackup(),null);assert.equal(blobs(h.indexedDB).length,4);
 h.files.destroy();h.store.destroy();
});

test('malformed file payload references and totals cannot enter a backup',()=>{
 const data={courseFiles:{5:[item('cf-file01',{kind:'file',name:'notes.txt',type:'text/plain',size:4})]}},base={format:'reserve-backup',version:1,data,courseFileBytes:[{course:'5',id:'cf-file01',base64:'dGVzdA=='}]};
 assert.equal(S.validateBackup(base).courseFiles[5][0].size,4);
 for(const row of [{course:'6',id:'cf-file01',base64:'dGVzdA=='},{course:'5',id:'cf-file01',base64:'eA=='},{course:'5',id:'cf-file01',base64:'bad!'}])assert.throws(()=>S.validateBackup({...base,courseFileBytes:[row]}),/file|bytes|base64/i);
 assert.throws(()=>S.validateBackup({...base,courseFileBytes:[base.courseFileBytes[0],base.courseFileBytes[0]]}),/duplicate|file/i);
 assert.throws(()=>S.validateBackup({...base,courseFilesOmitted:1}),/file.*notice/i);
});


test('a disabled feature loads its backup codec only on demand in the same Canvas storage context',async()=>{
 const indexedDB=fakeIndexedDB(),adapter=memory();let env,loads=0;
 env=vm.createContext({Date,Intl,URL,Blob,Uint8Array,structuredClone,TextEncoder,indexedDB,atob,btoa,chrome:{runtime:{sendMessage:async request=>{assert.deepEqual(JSON.parse(JSON.stringify(request)),{target:'ch-course-files',op:'load'});loads++;vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/course-files.js'),'utf8'),env);return {ok:true};}}}});
 for(const name of ['site.js','core.js','personal-work.js','custom-art.js','media-reference.js','backup-media.js','gpa-model.js','workspace-arrange.js','customization-model.js','page-preferences.js','storage.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',name),'utf8'),env,{filename:name});
 const store=env.ReserveStorage.createStore({...owner,adapter,courseFilesIndexedDB:indexedDB,backupMediaStore:{listAssets:async()=>[],listKits:async()=>[],get:async()=>null}});await store.load();assert.equal(env.ReserveCourseFiles,undefined);
 const files=F.create({store,indexedDB}),[added]=await files.addFiles('5',[file('notes.txt','Local only')]);assert.equal(loads,0);
 const backup=await store.exportBackupWithPacks();assert.equal(loads,1);assert.equal(backup.courseFilesOmitted,0);assert.equal(backup.courseFileBytes.length,1);
 await store.exportBackupWithPacks();assert.equal(loads,1);assert.equal(await (await files.getFile('5',added.id)).text(),'Local only');files.destroy();store.destroy();
});


test('recovery and an overlapping upload cannot deadlock account and file locks',async()=>{
 const h=await fixture({accountId:'57'});await h.files.addFiles('5',[file('saved.txt','before')]);
 const read=h.adapter.read,entered=deferred(),release=deferred();let paused=false;
 h.adapter.read=async key=>{if(!paused&&key==='reserve:v1:'+ORIGIN+':57'){paused=true;entered.resolve();await release.promise;}return read(key);};
 const recovery=h.store.saveRecovery();await entered.promise;
 const uploading=h.files.addFiles('5',[file('concurrent.txt','after')]);
 for(let i=0;i<30&&blobs(h.indexedDB).length<2;i++)await new Promise(setImmediate);assert.equal(blobs(h.indexedDB).length,2,'the upload has written bytes before recovery resumes');release.resolve();
 let timer;try{await Promise.race([Promise.all([recovery,uploading]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Recovery and upload deadlocked')),1500);})]);}finally{clearTimeout(timer);h.files.destroy();h.store.destroy();}
 assert.equal(h.store.get().courseFiles['5'].length,2);
});


test('recovery retries when an upload completes after the recovery metadata was captured',async()=>{
 const h=await fixture();await h.files.addFiles('5',[file('before.txt','before')]);const read=h.adapter.read,entered=deferred(),release=deferred();let paused=false;
 h.adapter.read=async key=>{if(!paused&&key==='reserve:packs:receipts'){paused=true;entered.resolve();await release.promise;}return read(key);};
 const saving=h.store.saveRecovery();await entered.promise;const [added]=await h.files.addFiles('5',[file('during.txt','during')]);release.resolve();await saving;
 const backup=await h.store.readRecoveryBackup();assert.equal(backup.data.courseFiles['5'].length,2);assert.ok(backup.courseFileBytes.some(row=>row.id===added.id));h.files.destroy();h.store.destroy();
});

test('a file added after recovery blocks replacement before its bytes can be removed',async()=>{
 const h=await fixture();await h.files.addFiles('5',[file('before.txt','before')]);await h.store.saveRecovery();const [added]=await h.files.addFiles('5',[file('new.txt','do not lose')]);
 await assert.rejects(h.store.importBackup({format:'reserve-backup',version:1,owner:h.store.owner,data:{}}),/changed.*recovery|recovery.*changed/i);
 assert.equal(await (await h.files.getFile('5',added.id)).text(),'do not lose');assert.equal(blobs(h.indexedDB).length,2);h.files.destroy();h.store.destroy();
});


test('recovery of a workspace with no files still protects a later upload',async()=>{
 const h=await fixture();await h.store.saveRecovery();const [added]=await h.files.addFiles('5',[file('later.txt','keep')]);
 await assert.rejects(h.store.importBackup({format:'reserve-backup',version:1,owner:h.store.owner,data:{}}),/changed.*recovery|recovery.*changed/i);assert.equal(await (await h.files.getFile('5',added.id)).text(),'keep');h.files.destroy();h.store.destroy();
});
