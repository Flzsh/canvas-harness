'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createDOM,read,deferred}=require('./contributor-fixture.cjs'),Storage=require('../extension/storage.js');
const owner={origin:'https://school.instructure.com',accountId:'7'},plain=value=>JSON.parse(JSON.stringify(value));
const envelope=data=>({format:'reserve-backup',version:1,owner:{...owner},exportedAt:'2026-10-21T12:00:00.000Z',data});
function workspace(notes='Current notes'){
 return Storage.validateBackup(envelope({tasks:{'17':{notes}},customTasks:[{id:'local-backup',name:'Review Latin',courseId:'personal',dueAt:null,createdAt:'2026-10-21T12:00:00.000Z'}]}),owner);
}
function packedBackup(notes='Restored notes'){
 const data=workspace(notes),row={id:'garden',name:'Garden',kind:'theme'};data.settings.makeYourOwn={theme:row,pet:null,installed:{garden:row}};
 return {...envelope(data),packs:[{...row,installedAt:1792584000000,source:JSON.stringify({format:'chtheme',version:1,name:'Garden',by:'A "quoted" author',colors:{light:{bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#444444',line:'#cccccc',accent:'#0055aa'}}}),receipt:{applications:[{order:1,changes:[{path:['settings','sceneTheme'],before:'sea',after:''}]}]}}]};
}
function fixture(t,{legacy=false,recovery=null,data=workspace()}={}){
 const document=createDOM('<html><body><div id="app"></div></body></html>'),target=document.getElementById('app'),downloads=[],blobs=new Map(),timers=new Map(),calls=[];let current=structuredClone(data),listener,sequence=0;
 const create=document.createElement;document.createElement=tag=>{const el=create(tag);el.ownerDocument=document;el.getRootNode=()=>document;if(tag==='a')el.click=()=>downloads.push({name:el.download,url:el.href});return el;};target.getRootNode=()=>document;
 const store={owner,get:()=>structuredClone(current),subscribe(fn){listener=fn;return()=>{listener=null;};},
  async update(fn){calls.push({type:'update'});const next=structuredClone(current);fn(next);current=next;listener?.();return this.get();},
  exportBackup(){calls.push({type:'export-sync'});return envelope(this.get());},
  async exportBackupWithPacks(){calls.push({type:'export-async'});return envelope(this.get());},
  async importBackup(backup){calls.push({type:'import',backup});current=Storage.validateBackup(backup,owner);listener?.();},
  async replace(data){calls.push({type:'replace',data});current=structuredClone(data);listener?.();},
  async saveRecovery(){calls.push({type:'save-recovery'});},async readRecovery(){calls.push({type:'read-recovery'});return recovery;},
  async readRecoveryBackup(){calls.push({type:'read-recovery-backup'});return recovery;}};
 if(legacy){delete store.exportBackupWithPacks;delete store.importBackup;delete store.readRecoveryBackup;}
 const env=vm.createContext({ReserveSite:require('../extension/site.js'),document,Blob,Date,Intl,Map,Set,structuredClone,TextEncoder,TextDecoder,
  ReserveCore:require('../extension/core.js'),ReserveUI:require('../extension/ui-utils.js'),ReserveStorage:Storage,ReservePersonalWork:require('../extension/personal-work.js'),ReserveIcon:()=>'',ReserveFeatures:{enabled:id=>id!=='planner'},
  FormData:class{constructor(form){this.form=form;}get(key){return key==='backup'?this.form.file:null;}},
  URL:{createObjectURL(blob){const url='blob:backup-'+(++sequence);blobs.set(url,blob);return url;},revokeObjectURL(url){blobs.delete(url);}},
  setTimeout(fn,ms){const id=++sequence;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval(){throw Error('Planner timer is disabled in this backup fixture');},clearInterval(){},requestAnimationFrame:()=>1,matchMedia:()=>({matches:false})});
 vm.runInContext(read('views.js'),env,{filename:'views.js'});vm.runInContext(read('app.js'),env,{filename:'app.js'});
 const app=env.ReserveApp.mount(target,{snapshot:{origin:owner.origin,user:{id:'7',name:'Student'},courses:[],assignments:[]},store,initialPage:'settings'}),container=target.children[0];t.after(()=>app.destroy());
 const handler=type=>container.events.get(type)[0].callback;
 const click=async action=>{const button=container.querySelector('[data-action="'+action+'"]');assert.ok(button,'real control exists: '+action);await handler('click')({target:button,preventDefault(){}});};
 const submit=async file=>{const form=container.querySelector('form[data-form="import"]');assert.ok(form,'real backup form exists');form.file=file;await handler('submit')({target:form,preventDefault(){}});};
 const upload=async(backup,options={})=>{await click('import-backup');const source=typeof backup==='string'?backup:JSON.stringify(backup);let reads=0;await submit({name:'workspace.json',size:options.size??Buffer.byteLength(source),async text(){reads++;return source;}});return reads;};
 return {app,container,store,env,downloads,blobs,timers,calls,click,submit,upload,notes(value){handler('input')({target:{dataset:{field:'notes',id:'17'},value}});},toast:()=>container.querySelector('.toast-area')?.textContent||''};
}

test('real Export waits for the async pack payload before preparing the downloaded file',async t=>{
 const h=fixture(t),gate=deferred(),started=deferred(),backup=packedBackup();h.store.exportBackup=()=>{throw Error('Must not use a stale synchronous pack cache');};h.store.exportBackupWithPacks=async()=>{h.calls.push({type:'export-async'});started.resolve();return gate.promise;};
 const click=h.click('export-backup');await started.promise;assert.equal(h.downloads.length,0);gate.resolve(backup);await click;
 assert.equal(h.downloads.length,1);assert.match(h.downloads[0].name,/^Canvas Harness-backup-\d{4}-\d{2}-\d{2}\.json$/);assert.equal(h.blobs.get(h.downloads[0].url).type,'application/json');assert.deepEqual(JSON.parse(await h.blobs.get(h.downloads[0].url).text()),backup);assert.equal(h.calls[0].type,'update');
});
test('legacy Export still downloads the synchronous envelope',async t=>{
 const h=fixture(t,{legacy:true});await h.click('export-backup');assert.equal(h.downloads.length,1);const backup=JSON.parse(await h.blobs.get(h.downloads[0].url).text());assert.equal(backup.data.tasks['17'].notes,'Current notes');assert.equal(h.calls.filter(c=>c.type==='export-sync').length,1);
});
test('pending note edits settle before a backup is exported',async t=>{
 const h=fixture(t);h.notes('Latest unsaved note');await h.click('export-backup');const backup=JSON.parse(await h.blobs.get(h.downloads[0].url).text());assert.equal(backup.data.tasks['17'].notes,'Latest unsaved note');assert.equal(h.calls.filter(c=>c.type==='update').length,2);
});
test('failed async Export shows its error without a download or a synchronous fallback',async t=>{
 const h=fixture(t);h.store.exportBackupWithPacks=async()=>{throw Error('Saved pack is missing');};await h.click('export-backup');assert.equal(h.downloads.length,0);assert.match(h.toast(),/Saved pack is missing/);assert.equal(h.calls.filter(c=>c.type==='export-sync').length,0);
});
test('Import review keeps the complete original envelope until the student confirms',async t=>{
 const h=fixture(t),backup=packedBackup(),source=JSON.stringify(backup,null,2);await h.upload(source);assert.equal(h.app.getState().modal,'confirm-import');assert.deepEqual(plain(h.app.getState().importSummary),{tasks:1,notes:1});assert.equal(h.calls.filter(c=>c.type==='import'||c.type==='replace'||c.type==='save-recovery').length,0);
 await h.click('confirm-import');const call=h.calls.find(c=>c.type==='import');assert.ok(call);assert.deepEqual(typeof call.backup==='string'?JSON.parse(call.backup):plain(call.backup),backup);assert.equal(h.calls.filter(c=>c.type==='replace').length,0);assert.ok(h.calls.findIndex(c=>c.type==='save-recovery')<h.calls.findIndex(c=>c.type==='import'));assert.equal(h.app.getState().modal,null);assert.equal(h.store.get().settings.makeYourOwn.theme.id,'garden');
});
test('legacy stores receive validated data rather than a backup envelope',async t=>{
 const h=fixture(t,{legacy:true}),backup=envelope(workspace('Legacy restore'));await h.upload(backup);await h.click('confirm-import');const replaced=h.calls.find(c=>c.type==='replace');assert.ok(replaced);assert.equal(replaced.data.format,undefined);assert.equal(replaced.data.tasks['17'].notes,'Legacy restore');assert.equal(h.calls.filter(c=>c.type==='import').length,0);
});
test('a legacy store without the pack importer cannot silently discard installed pack payloads',async t=>{
 const h=fixture(t,{legacy:true});await h.upload(packedBackup());assert.equal(h.app.getState().modal,'import');assert.match(h.toast(),/pack.*restore.*unavailable/i);assert.equal(h.calls.filter(c=>c.type==='replace'||c.type==='save-recovery').length,0);
});
test('invalid JSON, another account and invalid personal data never reach confirmation',async t=>{
 const h=fixture(t);for(const bad of ['{bad',JSON.stringify({...packedBackup(),owner:{...owner,accountId:'8'}}),JSON.stringify({...envelope(workspace()),data:{tasks:[]}})]){await h.upload(bad);assert.equal(h.app.getState().modal,'import');assert.equal(h.calls.filter(c=>c.type==='import'||c.type==='replace'||c.type==='save-recovery').length,0);assert.ok(h.toast());}
});
test('the file gate accepts the pack pool plus workspace allowance without doubling JSON escaping',async t=>{
 const h=fixture(t);for(const size of [6500001,64000000,66500000]){const reads=await h.upload(packedBackup(),{size});assert.equal(reads,1);assert.equal(h.app.getState().modal,'confirm-import');await h.click('close-overlay');}
 const reads=await h.upload(packedBackup(),{size:66500001});assert.equal(reads,0);assert.equal(h.app.getState().modal,'import');assert.match(h.toast(),/too large/i);
});
test('a failed recovery snapshot prevents import and leaves the review available to retry',async t=>{
 const h=fixture(t);await h.upload(packedBackup());h.store.saveRecovery=async()=>{throw Error('Recovery disk full');};await h.click('confirm-import');assert.equal(h.calls.filter(c=>c.type==='import'||c.type==='replace').length,0);assert.equal(h.app.getState().modal,'confirm-import');assert.match(h.toast(),/Recovery disk full/);
});
test('a rejected pack import remains reviewable and never falls back to data-only replace',async t=>{
 const h=fixture(t);await h.upload(packedBackup());h.store.importBackup=async()=>{throw Error('Pack restore failed');};await h.click('confirm-import');assert.equal(h.app.getState().modal,'confirm-import');assert.equal(h.calls.filter(c=>c.type==='replace').length,0);assert.match(h.toast(),/Pack restore failed/);
});
test('repeated confirmation clicks cannot create overlapping recovery and restore operations',async t=>{
 const h=fixture(t),gate=deferred(),started=deferred();await h.upload(packedBackup());h.store.saveRecovery=async()=>{h.calls.push({type:'save-recovery'});started.resolve();await gate.promise;};const first=h.click('confirm-import');await started.promise;await h.click('confirm-import');assert.equal(h.calls.filter(c=>c.type==='save-recovery').length,1);gate.resolve();await first;assert.equal(h.calls.filter(c=>c.type==='import').length,1);
});
test('Undo restore prefers the full recovery envelope and retains its pack sources and receipts',async t=>{
 const backup=packedBackup('Recovery notes'),h=fixture(t,{recovery:backup});h.store.readRecovery=()=>{throw Error('Do not strip the recovery envelope');};await h.click('recover-backup');assert.equal(h.app.getState().modal,'confirm-import');assert.deepEqual(plain(h.app.getState().importSummary),{tasks:1,notes:1});await h.click('confirm-import');const restored=h.calls.find(c=>c.type==='import').backup;assert.deepEqual(plain(restored),backup);assert.equal(h.store.get().tasks['17'].notes,'Recovery notes');
});
test('data-only legacy recovery is wrapped with the verified owner for the modern importer',async t=>{
 const previous=workspace('Older recovery'),h=fixture(t,{recovery:previous});delete h.store.readRecoveryBackup;await h.click('recover-backup');await h.click('confirm-import');const restored=h.calls.find(c=>c.type==='import').backup;assert.equal(restored.format,'reserve-backup');assert.equal(restored.version,1);assert.deepEqual(plain(restored.owner),owner);assert.deepEqual(plain(restored.data),previous);
});
test('an envelope returned through the legacy recovery method keeps its payloads intact',async t=>{
 const previous=packedBackup('Preserve envelopes'),h=fixture(t,{recovery:previous});delete h.store.readRecoveryBackup;await h.click('recover-backup');await h.click('confirm-import');assert.deepEqual(plain(h.calls.find(c=>c.type==='import').backup),previous);
});
test('legacy recovery still restores data through replace when the pack importer is absent',async t=>{
 const h=fixture(t,{legacy:true,recovery:workspace('Legacy undo')});await h.click('recover-backup');assert.equal(h.app.getState().modal,'confirm-import');await h.click('confirm-import');assert.equal(h.store.get().tasks['17'].notes,'Legacy undo');assert.equal(h.calls.filter(c=>c.type==='replace').length,1);
});
test('missing and failed recovery reads leave the current workspace untouched',async t=>{
 const h=fixture(t);await h.click('recover-backup');assert.equal(h.app.getState().modal,null);assert.match(h.toast(),/no previous restore/i);h.store.readRecoveryBackup=async()=>{throw Error('Recovery cannot be read');};await h.click('recover-backup');assert.equal(h.app.getState().modal,null);assert.match(h.toast(),/Recovery cannot be read/);assert.equal(h.calls.filter(c=>c.type==='save-recovery'||c.type==='import'||c.type==='replace').length,0);
});
test('cancelling a pending file read cannot reopen its confirmation later',async t=>{
 const h=fixture(t),gate=deferred(),started=deferred();await h.click('import-backup');const submission=h.submit({size:100,text:async()=>{started.resolve();return gate.promise;}});await started.promise;await h.click('close-overlay');gate.resolve(JSON.stringify(packedBackup()));await submission;assert.equal(h.app.getState().modal,null);assert.equal(h.calls.filter(c=>c.type==='import'||c.type==='replace').length,0);
});
test('an Export that finishes after app teardown cannot trigger a download',async t=>{
 const h=fixture(t),gate=deferred(),started=deferred();h.store.exportBackupWithPacks=async()=>{started.resolve();return gate.promise;};const click=h.click('export-backup');await started.promise;h.app.destroy();gate.resolve(packedBackup());await click;assert.equal(h.downloads.length,0);
});
