'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,theme,preset,file,owner,key,plain}=require('./market-pack-fixture.cjs');
const appearanceAdapter=h=>({read:async name=>(await h.local.get(name))[name],write:(name,value)=>h.local.set({[name]:value})});
const planner={format:'chpreset',version:1,name:'Week',kind:'planner',data:{days:{mon:[{title:'My plan',minutes:30}]}}};

for(const field of ['notes','checklist','progress','plannedDate','estimate'])test('removing a planner preset preserves both card branches after only '+field+' is edited',async()=>{
 const h=harness();await h.store.load();const row=await h.api.installLocal(file(planner),{store:h.store,week:'2026-10-21'}),card=h.store.get().customTasks[0];
 const values={notes:'Keep my notes',checklist:[{id:'check-1',text:'My checklist',done:true}],progress:'in-progress',plannedDate:'2026-10-23',estimate:55};
 await h.store.update(data=>{data.tasks[card.id][field]=values[field];});const before=h.store.get();await h.api.removeLocal(row.id,{store:h.store});
 assert.deepEqual(plain(h.store.get().customTasks.find(value=>value.id===card.id)),plain(before.customTasks[0]));assert.deepEqual(plain(h.store.get().tasks[card.id]),plain(before.tasks[card.id]));
});
test('removing a planner preset preserves unchanged metadata when only its logical card title changed',async()=>{
 const h=harness();await h.store.load();const row=await h.api.installLocal(file(planner),{store:h.store,week:'2026-10-21'}),id=h.store.get().customTasks[0].id;
 await h.store.update(data=>{data.customTasks[0].name='A title I wrote';});const before=h.store.get().tasks[id];await h.api.removeLocal(row.id,{store:h.store});assert.equal(h.store.get().customTasks[0].name,'A title I wrote');assert.deepEqual(plain(h.store.get().tasks[id]),plain(before));
});
test('an unchanged planner preset still removes both card branches exactly',async()=>{
 const h=harness();await h.store.load();const before=h.store.get(),row=await h.api.installLocal(file(planner),{store:h.store,week:'2026-10-21'});await h.api.removeLocal(row.id,{store:h.store});assert.deepEqual(plain(h.store.get().customTasks),plain(before.customTasks));assert.deepEqual(plain(h.store.get().tasks),plain(before.tasks));
});

test('a theme publishes only intended appearance deltas when a popup choice races its document write',async()=>{
 const h=harness({'reserve:appearance':{theme:'light',motion:'gentle',nightArt:43,pet:true,sceneTheme:'sea'}});await h.store.load();const set=h.local.set;let raced=false;
 h.local.set=async values=>{if(!raced&&Object.keys(values).some(name=>name.endsWith(':packs'))){raced=true;await h.env.ReservePagePreferences.write(appearanceAdapter(h),{theme:'dark',motion:'off'});}return set(values);};
 const row=await h.api.installLocal(file(theme('Garden')),{store:h.store});assert.equal(raced,true);assert.equal(h.store.get().settings.theme,'dark');assert.equal(h.store.get().settings.motion,'off');assert.equal(h.store.get().settings.nightArt,0);
 await h.api.removeLocal(row.id,{store:h.store});assert.equal(h.store.get().settings.theme,'dark');assert.equal(h.store.get().settings.motion,'off');assert.equal(h.store.get().settings.nightArt,43);assert.equal(h.store.get().settings.sceneTheme,'sea');
});
for(const sameField of [false,true])test('failed publication rolls back only owned account and appearance values'+(sameField?' after a same-field choice':''),async()=>{
 const h=harness({'reserve:appearance':{theme:'light',motion:'gentle',nightArt:43,pet:true,sceneTheme:'sea'}});await h.store.load();const sync=h.store.sync;let count=0;
 h.store.sync=async()=>{if(++count===2){await h.env.ReservePagePreferences.write(appearanceAdapter(h),{theme:'dark',motion:'off',...(sameField?{nightArt:77}:{})});const account=structuredClone(h.data[key]);account.tasks['99']={notes:'A later unrelated note'};await h.local.set({[key]:account});throw Error('Publication interrupted');}return sync();};
 await assert.rejects(h.api.installLocal(file(theme('Garden')),{store:h.store}),/Publication interrupted/);await h.store.sync();
 assert.equal(h.store.get().settings.theme,'dark');assert.equal(h.store.get().settings.motion,'off');assert.equal(h.store.get().settings.nightArt,sameField?77:43);assert.equal(h.store.get().settings.sceneTheme,'sea');assert.equal(h.store.get().tasks['99'].notes,'A later unrelated note');assert.deepEqual(plain(h.store.get().settings.makeYourOwn.installed),{});assert.deepEqual(plain(await h.api.installed({store:h.store})),[]);
});

test('local install/use/remove/restore refuse a stale same-site account before mutation',async()=>{
 const h=harness();await h.store.load();const row=await h.api.installLocal(file(theme('Garden')),{store:h.store}),backup=await h.store.exportBackupWithPacks(),before=structuredClone(h.data);h.profile='8';
 for(const action of [()=>h.api.installLocal(file(preset('New','rose')),{store:h.store}),()=>h.api.useLocal(row.id,{store:h.store}),()=>h.api.removeLocal(row.id,{store:h.store}),()=>h.api.restoreBackup(backup,{store:h.store})]){await assert.rejects(action(),/account changed/i);assert.deepEqual(h.data,before);}
 assert.ok(h.fetches.every(call=>call.url===owner.origin+'/api/v1/users/self/profile'));
});
test('the account is rechecked inside the account queue immediately before publication',async()=>{
 const h=harness();await h.store.load();const before=structuredClone(h.data),set=h.local.set;let switched=false;
 h.local.set=async values=>{const result=await set(values);if(!switched&&Object.keys(values).some(name=>name.endsWith(':packs'))){switched=true;h.profile='8';}return result;};
 await assert.rejects(h.api.installLocal(file(theme('Garden')),{store:h.store}),/account changed/i);assert.equal(switched,true);assert.deepEqual(h.data,before);assert.deepEqual(plain(h.store.get().settings.makeYourOwn.installed),{});
});

test('document rollback restores the original index order without reverting independent documents',async()=>{
 const h=harness(),pool=h.env.ReserveMedia.createPackStore(owner),doc=(id,name)=>({id,name,kind:'theme',installedAt:1,source:JSON.stringify(theme(name)),receipt:{kind:'theme',applications:[]}}),older=doc('older','Older'),newer=doc('newer','Newer'),independent=doc('independent','Independent');
 try{
  await pool.updatePacks({put:[older,newer]});await pool.updatePacks({remove:['older']});const edited={...newer,name:'A later independent edit'};await pool.updatePacks({put:[edited,independent]});const start=h.writes.length;
  await pool.updatePacks({put:[older],order:['older','newer']});assert.deepEqual(plain(await pool.listPacks()).map(row=>row.id),['older','newer','independent']);assert.deepEqual(plain(await pool.getPack('newer')),edited);assert.deepEqual(plain(await pool.getPack('independent')),independent);
  assert.ok(h.writes.slice(start).every(value=>!Object.keys(value).some(key=>key.endsWith(':pack:newer')||key.endsWith(':pack:independent'))));
 }finally{pool.close();}
});
