// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const {worker,message}=require('./market-worker-fixture.cjs'),{read}=require('./market-fixture.cjs'),{bounded,indexedMemory}=require('./market-indexed-fixture.cjs');
const owner={origin:'https://school.instructure.com',accountId:'7'},key='reserve:v1:'+owner.origin+':7',sender={id:'test',frameId:0,tab:{id:9},url:owner.origin+'/dashboard'};
const plain=value=>JSON.parse(JSON.stringify(value)),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Zl8AAAAASUVORK5CYII=','base64');
function litePage(h,options={}){
 const env=vm.createContext({URL,Intl,Blob,Uint8Array,TextEncoder,TextDecoder,structuredClone,crypto:webcrypto,atob,btoa,chrome:{storage:h.chrome.storage,runtime:{id:'test',sendMessage:request=>h.request(request,sender)}}});
 for(const file of ['site.js','core.js','personal-work.js','custom-art.js','media-reference.js','backup-media.js','workspace-arrange.js','customization-model.js','gpa-model.js','page-preferences.js','storage.js'])vm.runInContext(read(file),env,{filename:file});
 return {env,store:env.ReserveStorage.createStore({...owner,...options})};
}
test('Lite exports complete media and account receipts offline, saves recovery, and restores through the worker',{timeout:15000},async()=>{
 const source=worker({indexedDB:indexedMemory()});source.env.ReservePackMedia={prepare:async()=>({asset:{mediaId:webcrypto.randomUUID(),name:'Pixel.png',type:'image/png',kind:'image',width:1,height:1,palette:[]},blob:new Blob([png],{type:'image/png'})})};
 const kit={version:1,name:'Portable kit',assets:{bannerArt:{name:'Pixel.png',type:'image/png',data:png.toString('base64'),sha256:createHash('sha256').update(png).digest('hex')}},accent:'clay',font:'system',bannerSize:'standard',bannerFit:'contain',bannerPosition:'right',titlePlacement:'separate'};
 assert.equal((await source.request(message('kit',kit,'portable-kit'))).ok,true);
 const page=litePage(source);assert.equal(page.env.ReservePacks,undefined);assert.equal(page.env.ReserveMedia,undefined);await page.store.load();await page.store.update(data=>{data.tasks['1']={notes:'Keep the note'};});
 source.env.fetch=async()=>{throw Error('Export must work offline.');};
 const backup=plain(await bounded(page.store.exportBackupWithPacks(),'Lite export'));assert.equal(backup.media.kits.length,1);assert.equal(backup.media.assets.length,1);assert.equal(backup.market.rows['portable-kit'].kind,'kit');
 await bounded(page.store.saveRecovery(),'Lite recovery');const recovery=plain(await page.store.readRecoveryBackup());assert.deepEqual(recovery.media,backup.media);assert.deepEqual(recovery.market,backup.market);
 const target=worker({indexedDB:indexedMemory(),saved:{'reserve:features':{preset:'lite',custom:['gpa']}}}),restored=litePage(target);await restored.store.load();await bounded(restored.store.importBackup(JSON.stringify(backup)),'Lite restore',5000);
 assert.equal(restored.store.get().tasks['1'].notes,'Keep the note');assert.equal(target.data[key].tasks['1'].notes,'Keep the note');assert.equal(target.data['reserve:features'].preset,'lite');
 const pool=target.env.ReserveMedia.createPackStore(owner),[savedKit]=await pool.listKits(),found=await pool.get(savedKit.appearance.bannerArt.mediaId);assert.deepEqual(Buffer.from(await found.blob.arrayBuffer()),png);pool.close();
 await bounded(target.client.remove('portable-kit'),'restored removal');assert.equal(target.media.kits.length,0);await bounded(restored.store.update(data=>{data.tasks['1'].notes='Saved after restore';}),'normal save after restore');assert.equal(target.data[key].tasks['1'].notes,'Saved after restore');
 page.store.destroy();restored.store.destroy();
});

for(const full of [false,true])for(const [place,kind,framed]of [['overviewArt','bannerArt',false],['overviewArt','cardArt',true],['themeArt','backgroundArt',true],['course','bannerArt',true]])test((full?'Full':'Lite')+' restore failure preserves original Canvas-only '+place+' '+kind+' and the previous account',{timeout:10000},async()=>{
 const oldAsset={mediaId:webcrypto.randomUUID(),name:'Original.png',type:'image/png',kind:'image',width:1,height:1,palette:[]},newAsset={...oldAsset,mediaId:webcrypto.randomUUID(),name:'Imported.png'},blob=new Blob([png],{type:'image/png'});
 const value=framed?{asset:oldAsset,focus:{x:.2,y:.8},zoom:2,fit:'cover',height:'tall'}:oldAsset,appearance={[kind]:value},settings={coursePrefs:{},overviewArt:{}};if(place==='course')settings.coursePrefs['10']=appearance;else settings[place]=appearance;
 const previous={version:1,settings,tasks:{'1':{notes:'Original note'}}},h=worker({indexedDB:indexedMemory(),saved:{[key]:previous}});
 const localStore={listKits:async()=>[],listAssets:async()=>[{asset:oldAsset,blob}],get:async id=>id===oldAsset.mediaId?{asset:oldAsset,blob}:null},page=litePage(h,{backupMediaStore:localStore});
 if(full)for(const file of ['market-site.js','packs.js'])vm.runInContext(read(file),page.env,{filename:file});
 await page.store.load();const pool=h.env.ReserveMedia.createPackStore(owner);assert.equal(await pool.get(oldAsset.mediaId),null,'the worker cannot initially read Canvas-origin bytes');
 const backup={format:'reserve-backup',version:1,owner,data:{settings:{theme:'dark',overviewArt:{bannerArt:newAsset}},tasks:{'1':{notes:'Imported note'}}},media:{version:1,assets:[{asset:newAsset,bytes:{type:'image/png',size:png.length,data:png.toString('base64'),sha256:createHash('sha256').update(png).digest('hex')}}],kits:[]}};
 const set=h.local.set;let failed=false;h.local.set=async values=>{await set(values);if(!failed&&values['reserve:appearance']?.theme==='dark'){failed=true;throw Error('Appearance publication interrupted');}};
 await assert.rejects(bounded(page.store.importBackup(backup),'rollback to original Canvas-only media',5000),/Appearance publication interrupted/);assert.ok(failed);await page.store.sync();
 assert.equal(page.store.get().tasks['1'].notes,'Original note');assert.deepEqual(plain((place==='course'?page.store.get().settings.coursePrefs['10']:page.store.get().settings[place])[kind]),value);assert.equal(page.store.get().settings.theme,'light');assert.equal(h.data[key].tasks['1'].notes,'Original note');
 assert.deepEqual(Buffer.from(await (await localStore.get(oldAsset.mediaId)).blob.arrayBuffer()),png);assert.equal(await pool.get(newAsset.mediaId),null);assert.ok(h.media.media.every(row=>!row.holds.length));
 await bounded(page.store.update(data=>{data.tasks['1'].notes='Saved after failure';}),'save after failed restore');assert.equal(h.data[key].tasks['1'].notes,'Saved after failure');pool.close();page.store.destroy();
});


test('portable backups keep course files alongside artwork, Market receipts and saved feature choices',async()=>{
 const {fakeIndexedDB}=require('./fake-indexeddb.cjs'),Files=require('../extension/course-files.js');
 const source=worker({indexedDB:indexedMemory()}),sourceDB=fakeIndexedDB(),page=litePage(source,{courseFilesIndexedDB:sourceDB});
 source.env.ReservePackMedia={prepare:async()=>({asset:{mediaId:webcrypto.randomUUID(),name:'Pixel.png',type:'image/png',kind:'image',width:1,height:1,palette:[]},blob:new Blob([png],{type:'image/png'})})};
 const kit={version:1,name:'Course kit',assets:{bannerArt:{name:'Pixel.png',type:'image/png',data:png.toString('base64'),sha256:createHash('sha256').update(png).digest('hex')}},accent:'clay',font:'system',bannerSize:'standard',bannerFit:'contain',bannerPosition:'right',titlePlacement:'separate'};
 assert.equal((await source.request(message('kit',kit,'course-kit'))).ok,true);await page.store.load();
 const files=Files.create({store:page.store,indexedDB:sourceDB}),[saved]=await files.addFiles('10',[Object.assign(new Blob(['Course notes']),{name:'notes.txt'})]);await files.addLink('10','https://docs.google.com/document/d/notes');
 vm.runInContext(read('course-files.js'),page.env);source.env.fetch=async()=>{throw Error('Export must be local');};
 const backup=plain(await page.store.exportBackupWithPacks());assert.equal(backup.courseFileBytes.length,1);assert.equal(backup.courseFilesOmitted,0);assert.equal(backup.media.assets.length,1);assert.ok(backup.market.rows['course-kit']);
 const target=worker({indexedDB:indexedMemory(),saved:{'reserve:features':{preset:'lite',custom:['gpa']}}}),targetDB=fakeIndexedDB(),restored=litePage(target,{courseFilesIndexedDB:targetDB});vm.runInContext(read('course-files.js'),restored.env);await restored.store.load();
 await bounded(restored.store.importBackup(backup),'combined course-file restore',5000);
 const targetFiles=Files.create({store:restored.store,indexedDB:targetDB});assert.equal(await (await targetFiles.getFile('10',saved.id)).text(),'Course notes');assert.equal(targetFiles.list('10').length,2);assert.equal(target.data['reserve:features'].preset,'lite');assert.equal(target.media.kits.length,1);
 files.destroy();targetFiles.destroy();page.store.destroy();restored.store.destroy();
});
