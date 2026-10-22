'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{webcrypto,createHash}=require('node:crypto'),{worker,message}=require('./market-worker-fixture.cjs'),{indexedMemory,bounded}=require('./market-indexed-fixture.cjs'),{settle}=require('./market-fixture.cjs');
const owner={origin:'https://school.instructure.com',accountId:'7'},key='reserve:v1:'+owner.origin+':7',sender={id:'test',frameId:0,tab:{id:4},url:owner.origin+'/dashboard'},PACKS='reserve:packs',RECEIPTS=PACKS+':receipts',FEATURES='reserve:features',scope=JSON.stringify([owner.origin,owner.accountId]),base='reserve:market-media:'+scope;
const plain=value=>JSON.parse(JSON.stringify(value)),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Zl8AAAAASUVORK5CYII=','base64');
const theme={format:'chtheme',version:1,name:'Garden',colors:{light:{bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#444444',line:'#cccccc',accent:'#0055aa'}}};
function open(h){return h.env.ReserveStorage.createStore({...owner,adapter:{read:async name=>(await h.local.get(name))[name],write:(name,value)=>h.local.set({[name]:value})}});}
async function sourceBackup(){
 const h=worker({indexedDB:indexedMemory(),saved:{'reserve:appearance':{theme:'dark',motion:'still',nightArt:11,pet:false,sceneTheme:'sea'}}});h.env.ReservePackMedia={prepare:async(blob,slot,name)=>({asset:{mediaId:webcrypto.randomUUID(),name,type:'image/png',kind:'image',width:1,height:1,palette:[]},blob:new Blob([png],{type:'image/png'})})};
 const asset={name:'Pixel.png',type:'image/png',data:png.toString('base64'),sha256:createHash('sha256').update(png).digest('hex')},kit={version:1,name:'Checked kit',assets:{bannerArt:asset,titleArt:asset},accent:'clay',font:'system',bannerSize:'standard',bannerFit:'contain',bannerPosition:'right',titlePlacement:'separate'};
 assert.deepEqual(await h.request(message('kit',kit,'checked-kit')),{ok:true});const pool=h.env.ReserveMedia.createPackStore(owner),[savedKit]=await pool.listKits();pool.close();
 const store=open(h);await store.load();await store.update(data=>{data.settings.overviewArt.bannerArt=savedKit.appearance.bannerArt;data.tasks['1']={notes:'Portable note'};});
 assert.deepEqual(await h.request(message('course-art','<?ch-pack version="1"?><?ch-art place="overview" slot="banner"?><svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg><?ch-end parts="1"?>','checked-art')),{ok:true});
 assert.deepEqual(await h.request(message('feature',{feature:'scene-themes',sceneTheme:'starry'},'checked-scene')),{ok:true});assert.deepEqual(await h.request(message('feature',{feature:'math'},'global-math')),{ok:true});
 assert.deepEqual(await h.request(message('theme',theme,'checked-theme')),{ok:true});await store.sync();
 h.env.fetch=async()=>{throw Error('Offline backup must not fetch.');};const backup=plain(await store.exportBackupWithPacks());store.destroy();return {h,backup,savedKit:plain(savedKit)};
}
test('account Market backup is offline, filters other accounts and never exports device feature choices',async()=>{
 const {h,backup}=await sourceBackup();assert.ok(backup.media.assets.length===2);assert.deepEqual(Object.keys(backup.market.rows),['checked-kit','checked-art','checked-scene']);assert.equal(backup.market.receipts['checked-scene'].devicePreferences,false);assert.equal(backup.market.receipts['checked-scene'].preferences,undefined);assert.equal(backup.market.receipts['checked-scene'].previous,undefined);assert.ok(!JSON.stringify(backup.market).includes('global-math'));
 const other={origin:owner.origin,accountId:'8'},id='other-kit';h.data[PACKS][id]={id,name:'Other kit',kind:'kit',installedAt:1};h.data[RECEIPTS][id]={kind:'kit',order:99,owner:other,kitId:webcrypto.randomUUID(),mediaIds:[]};
 const direct=plain(await h.env.ReservePacks.exportAccountBackup({owner}));assert.deepEqual(direct,backup.market);const reply=await bounded(h.request({type:'market-local',op:'backup',owner},sender),'offline registry export');assert.equal(reply.ok,true);assert.deepEqual(reply.market,backup.market);
 const rejected=await h.request({type:'market-local',op:'backup',owner},{...sender,url:'https://unregistered.test/'});assert.equal(rejected.ok,false);
});
test('fresh worker restores checked kit bytes and exact account receipts with working Remove and Undo',{timeout:15000},async()=>{
 const {backup,savedKit}=await sourceBackup(),choice={preset:'lite',custom:['gpa']},h=worker({indexedDB:indexedMemory(),saved:{[FEATURES]:choice}});await settle();
 const reply=await bounded(h.request({type:'market-local',op:'restore',backup,owner},sender),'fresh-device restore',5000);assert.equal(reply.ok,true,reply.reason);assert.deepEqual(h.data[FEATURES],choice);assert.deepEqual(h.data[RECEIPTS],backup.market.receipts);assert.deepEqual(h.data[PACKS],backup.market.rows);assert.equal(h.data[key].tasks['1'].notes,'Portable note');
 const pool=h.env.ReserveMedia.createPackStore(owner),kits=await pool.listKits();assert.equal(kits.length,1);assert.deepEqual(plain(kits[0]),savedKit);for(const row of backup.media.assets){const found=await pool.get(row.asset.mediaId);assert.deepEqual(Buffer.from(await found.blob.arrayBuffer()),png);}assert.ok(h.media.media.every(row=>row.holds.length===0));pool.close();
 await bounded(h.client.remove('checked-art'),'restored artwork Undo');assert.equal(h.data[key].settings.overviewArt.bannerArt.mediaId,savedKit.appearance.bannerArt.mediaId);assert.deepEqual(h.data[FEATURES],choice);
 await bounded(h.client.remove('checked-scene'),'restored scene Undo');assert.deepEqual(h.data[FEATURES],choice);await bounded(h.client.remove('checked-kit'),'restored kit removal');assert.equal(h.media.kits.length,0);assert.ok(h.media.media.some(row=>row.asset.mediaId===savedKit.appearance.bannerArt.mediaId),'the restored applied asset survives kit removal');
 const store=open(h);await store.load();await bounded(store.update(data=>{data.tasks['1'].notes='Still saves';}),'save after restored removal');assert.equal(h.data[key].tasks['1'].notes,'Still saves');store.destroy();
});
test('restore remaps colliding media, kits and global registry IDs without modifying originals',{timeout:15000},async()=>{
 const {backup,savedKit}=await sourceBackup(),h=worker({indexedDB:indexedMemory()}),pool=h.env.ReserveMedia.createPackStore(owner),original=backup.media.assets[0],old={asset:{...original.asset,name:'Existing local pixels'},blob:new Blob([png],{type:'image/png'})},localKit={...savedKit,name:'Existing local kit',appearance:{bannerArt:old.asset}};
 await pool.putMany([old],{kit:localKit});h.data[PACKS]={'checked-kit':{id:'checked-kit',name:'Independent device switch',kind:'feature',installedAt:2}};h.data[RECEIPTS]={'checked-kit':{kind:'feature',order:10,feature:'math',previous:true}};const preservedRows=structuredClone(h.data[PACKS]),preservedReceipts=structuredClone(h.data[RECEIPTS]);
 const reply=await bounded(h.request({type:'market-local',op:'restore',backup,owner},sender),'collision restore',5000);assert.equal(reply.ok,true,reply.reason);assert.deepEqual(h.data[PACKS]['checked-kit'],preservedRows['checked-kit']);assert.deepEqual(h.data[RECEIPTS]['checked-kit'],preservedReceipts['checked-kit']);
 const restored=Object.entries(h.data[RECEIPTS]).find(([,receipt])=>receipt.kind==='kit'),[id,receipt]=restored;assert.notEqual(id,'checked-kit');assert.equal(h.data[PACKS][id].catalogueId,'checked-kit');assert.notEqual(receipt.kitId,savedKit.id);assert.ok(!receipt.mediaIds.includes(original.asset.mediaId));assert.equal((await pool.get(original.asset.mediaId)).asset.name,'Existing local pixels');assert.equal((await pool.listKits()).find(kit=>kit.id===savedKit.id).name,'Existing local kit');
 const art=h.data[RECEIPTS]['checked-art'].changes.find(change=>change.key==='bannerArt');assert.equal(art.before.mediaId,receipt.mediaIds[0]);await h.client.remove('checked-art');assert.equal(h.data[key].settings.overviewArt.bannerArt.mediaId,receipt.mediaIds[0]);
 const status=await h.request({type:'market-installed'});assert.ok(status.installed.includes('checked-kit'));assert.ok(!status.installed.includes(id),'restored local UUID never reaches the Market website');await h.client.remove(id);assert.ok((await pool.listKits()).some(kit=>kit.id===savedKit.id));pool.close();
});
for(const point of ['asset','documents','account','appearance','registry','release'])test('failed backup restore rolls back staged media, documents and exact receipts at '+point,{timeout:15000},async()=>{
 const {backup}=await sourceBackup(),h=worker({indexedDB:indexedMemory()});await settle();const baseline=open(h);await baseline.load();baseline.destroy();const initial=structuredClone(h.data),set=h.local.set;let failed=false;
 h.local.set=async values=>{const names=Object.keys(values),hit=point==='asset'?names.some(name=>name.startsWith(base+':asset:')):point==='documents'?names.includes(base+':packs'):point==='account'?names.includes(key):point==='appearance'?names.includes('reserve:appearance'):point==='registry'?names.includes(RECEIPTS):names.includes(base+':index')&&values[base+':index'].kits.length&&values[base+':index'].media.every(row=>!row.holds.length);
  await set(values);if(!failed&&hit){failed=true;throw Error('Injected '+point+' publication failure');}
 };
 const reply=await bounded(h.request({type:'market-local',op:'restore',backup,owner},sender),'failed restore cleanup',6000);assert.ok(failed,'failure gate was reached');assert.equal(reply.ok,false);assert.match(reply.reason,/Injected/);assert.deepEqual(h.data,initial,'all owned side effects must be removed, including unindexed byte records');
 const store=open(h);await store.load();await bounded(store.update(data=>{data.tasks['2']={notes:'Queue recovered'};}),'post-failure save');assert.equal(h.data[key].tasks['2'].notes,'Queue recovered');store.destroy();
});
for(const mutation of ['digest','source','undo','owner','device-preferences','incomplete-kit'])test('backup rejects '+mutation+' before publishing side effects',{timeout:10000},async()=>{
 const {backup}=await sourceBackup(),h=worker({indexedDB:indexedMemory()});await settle();
 if(mutation==='digest')backup.media.assets[0].bytes.sha256='0'.repeat(64);
 if(mutation==='source')backup.packs[0].source=JSON.stringify({...theme,name:'Edited source'});
 if(mutation==='undo')backup.market.receipts['checked-art'].changes[0].path=['coursePrefs','__proto__'];
 if(mutation==='owner')backup.market.receipts['checked-kit'].owner.accountId='8';
 if(mutation==='device-preferences')backup.market.receipts['checked-scene'].preferences={before:{preset:'full'},after:{preset:'lite'}};
 if(mutation==='incomplete-kit')backup.market.receipts['checked-kit'].kitId=webcrypto.randomUUID();
 const baseline=open(h);await baseline.load();baseline.destroy();const before=structuredClone(h.data),reply=await bounded(h.request({type:'market-local',op:'restore',backup,owner},sender),'invalid backup rejection',5000);assert.equal(reply.ok,false);assert.deepEqual(h.data,before);
});

test('public first account load seeds device appearance before backup publication',async()=>{
 const h=worker({indexedDB:indexedMemory()});assert.equal(h.data['reserve:appearance'],undefined);const store=open(h);await store.load();assert.deepEqual(h.data['reserve:appearance'],{theme:'light',motion:'gentle',nightArt:0,pet:true,sceneTheme:''});assert.deepEqual(h.data[key],{version:1,settings:{coursePrefs:{},overviewArt:{}}});store.destroy();
});

async function canvasDestination(h,mode){
 const vm=require('node:vm'),{read,loadMarketSite}=require('./market-fixture.cjs'),{event}=require('./market-worker-fixture.cjs'),indexedDB=indexedMemory();
 const runtime={id:'test',getURL:file=>'chrome-extension://test/'+file,onMessage:event(),sendMessage:message=>h.request(message,sender)},page=vm.createContext({URL,Blob,ArrayBuffer,Uint8Array,TextEncoder,TextDecoder,structuredClone,crypto:webcrypto,atob,btoa,setTimeout,clearTimeout,AbortSignal,indexedDB,location:new URL(sender.url),chrome:{runtime,storage:h.chrome.storage}});loadMarketSite(page);
 for(const file of ['features.js','core.js','personal-work.js','custom-art.js','workspace-arrange.js','customization-model.js','backup-media.js','gpa-model.js','page-preferences.js','media-store.js','storage.js'])vm.runInContext(read(file),page,{filename:file});
 const original={asset:{mediaId:webcrypto.randomUUID(),name:'Canvas-only original.png',type:'image/png',kind:'image',width:1,height:1,palette:[]},blob:new Blob([png],{type:'image/png'})},local=page.ReserveMedia.createStore(owner,{shared:false}),hydration=page.ReserveMedia.createStore(owner);await local.putMany([original]);
 const store=page.ReserveStorage.createStore(owner);await store.load();await store.update(data=>{data.settings.overviewArt.bannerArt=original.asset;data.tasks['9']={notes:'Destination note'};});
 if(mode==='Full')vm.runInContext(read('packs.js'),page,{filename:'packs.js'});else{delete page.ReserveMedia;assert.equal(page.ReserveMedia,undefined);assert.equal(page.ReservePacks,undefined);}
 const workerPool=h.env.ReserveMedia.createPackStore(owner);assert.equal(await workerPool.get(original.asset.mediaId),null,'worker cannot read Canvas-origin IndexedDB');workerPool.close();
 return {page,store,local,hydration,original,close(){store.destroy();local.close();hydration.close();}};
}
for(const mode of ['Full','Lite'])for(const failure of ['registry','second-release'])test(mode+' failed restore preserves a Canvas-only destination through '+failure,{timeout:15000},async()=>{
 const {backup}=await sourceBackup(),h=worker({indexedDB:indexedMemory(),saved:{[FEATURES]:{preset:mode.toLowerCase(),custom:['math']}}}),destination=await canvasDestination(h,mode),before=structuredClone(h.data[key]),set=h.local.set;let failed=false;
 try{
  h.local.set=async values=>{await set(values);const index=values[base+':index'],hit=failure==='registry'?Object.hasOwn(values,RECEIPTS):index?.media.some(row=>row.asset.mediaId===destination.original.asset.mediaId)&&index.media.every(row=>!row.holds.length)&&h.data[PACKS]?.['checked-art'];
   if(!failed&&hit){failed=true;await destination.local.removeKit(webcrypto.randomUUID(),{mediaIds:[destination.original.asset.mediaId]});throw Error('Injected destination '+failure+' failure');}
  };
  await assert.rejects(bounded(destination.store.importBackup(backup),'cross-origin rollback',7000),/Injected destination/);assert.ok(failed,'restore reached the chosen post-publication failure');await destination.store.sync();assert.deepEqual(h.data[key],before,'exact original account must be restored');
  assert.equal(await destination.local.get(destination.original.asset.mediaId),null,'independent Canvas-local collection actually removed the private copy');const restored=await destination.hydration.get(destination.original.asset.mediaId);assert.deepEqual(plain(restored.asset),destination.original.asset);assert.deepEqual(Buffer.from(await restored.blob.arrayBuffer()),png,'checked destination bytes remain readable through the shared fallback');
  assert.equal(h.data[PACKS],undefined);assert.equal(h.data[RECEIPTS],undefined);assert.ok(h.media.media.every(row=>row.asset.mediaId===destination.original.asset.mediaId&&row.holds.length===0));assert.equal(h.media.kits.length,0);
  await bounded(destination.store.update(data=>{data.tasks['9'].notes='After rollback';}),'later destination note save');assert.equal(h.data[key].tasks['9'].notes,'After rollback');
 }finally{destination.close();}
});
function withoutKit(backup){delete backup.market.rows['checked-kit'];delete backup.market.receipts['checked-kit'];backup.media.kits=[];return backup;}
test('restored undo-only media survives shared collection and Remove restores its checked bytes',{timeout:15000},async()=>{
 const {backup}=await sourceBackup();withoutKit(backup);const undo=backup.market.receipts['checked-art'].changes.find(change=>change.key==='bannerArt').before,unused=backup.media.assets.find(row=>row.asset.mediaId!==undo.mediaId).asset,h=worker({indexedDB:indexedMemory()});
 assert.ok(!h.env.ReserveMedia.referenced(backup.data.settings).has(undo.mediaId));assert.deepEqual(await bounded(h.request({type:'market-local',op:'restore',backup,owner},sender),'undo-only restore',5000),{ok:true,data:plain(h.env.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data:backup.data}))});
 // A receipt for another account must not retain this account's unused bytes.
 h.data[RECEIPTS].foreign={kind:'course-art',order:99,key:'reserve:v1:'+owner.origin+':8',changes:[{path:['overviewArt'],key:'bannerArt',beforeOwn:true,before:unused,after:{name:'SVG',svg:'<svg viewBox="0 0 1 1"/>'}}],containers:[]};
 const pool=h.env.ReserveMedia.createPackStore(owner);try{await bounded(pool.release(webcrypto.randomUUID()),'shared collection');assert.ok(await pool.get(undo.mediaId),'an owner-bound before reference is a live media root');assert.equal(await pool.get(unused.mediaId),null,'a different account receipt is not a live root here');await bounded(h.client.remove('checked-art'),'restored artwork Remove');assert.deepEqual(h.data[key].settings.overviewArt.bannerArt,undo);const restored=await pool.get(undo.mediaId);assert.deepEqual(Buffer.from(await restored.blob.arrayBuffer()),png);}finally{pool.close();}
});
test('backup omitting an undo-only asset rejects before any restore publication',{timeout:15000},async()=>{
 const {backup}=await sourceBackup();withoutKit(backup);const undo=backup.market.receipts['checked-art'].changes.find(change=>change.key==='bannerArt').before;backup.media.assets=backup.media.assets.filter(row=>row.asset.mediaId!==undo.mediaId);const h=worker({indexedDB:indexedMemory()}),baseline=open(h);await baseline.load();baseline.destroy();await settle();const before=structuredClone(h.data),reply=await bounded(h.request({type:'market-local',op:'restore',backup,owner},sender),'missing undo-only media rejection',5000);assert.equal(reply.ok,false);assert.match(reply.reason,/undo media is missing/i);assert.deepEqual(h.data,before);
});
