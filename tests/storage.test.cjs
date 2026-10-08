const {test}=require('node:test');const assert=require('node:assert/strict');
const {createStore,validateBackup}=require('../extension/storage.js');
function memory(){const data={};return {read:async k=>structuredClone(data[k]),write:async(k,v)=>{data[k]=structuredClone(v);}};}
test('preferences and assignment notes remain isolated across Canvas accounts',async()=>{
 const adapter=memory(),a=createStore({accountId:'1',adapter}),b=createStore({accountId:'2',adapter});await a.load();await b.load();
 await a.update(s=>{s.settings.theme='dark';s.tasks['7']={notes:'Only account one'};});
 const ar=await createStore({accountId:'1',adapter}).load(),br=await createStore({accountId:'2',adapter}).load();
 assert.equal(ar.settings.theme,'dark');assert.equal(ar.tasks['7'].notes,'Only account one');assert.equal(br.tasks['7'],undefined);assert.equal(br.settings.theme,'system');
});
test('queued independent edits survive a slow storage write',async()=>{
 const adapter=memory(),store=createStore({accountId:'1',adapter});await store.load();
 await Promise.all([store.update(s=>{s.tasks['1']={notes:'first'};}),store.update(s=>{s.tasks['2']={notes:'second'};})]);
 const saved=await createStore({accountId:'1',adapter}).load();assert.equal(saved.tasks['1'].notes,'first');assert.equal(saved.tasks['2'].notes,'second');
});
test('backup rejects foreign schemas, hostile keys, and invalid data structures',()=>{
 assert.throws(()=>validateBackup({format:'other',version:1,data:{}}),/backup|format/i);
 assert.throws(()=>validateBackup(JSON.parse('{"format":"reserve-backup","version":1,"data":{"settings":{},"tasks":{"__proto__":{"bad":true}}}}')),/key|unsafe/i);
 assert.throws(()=>validateBackup({format:'reserve-backup',version:1,data:{settings:{theme:'oops'},tasks:{},customTasks:[]}}),/theme/i);
});
test('valid backup roundtrip preserves notes and does not transfer a Canvas cache',async()=>{
 const store=createStore({accountId:'1',adapter:memory()});await store.load();await store.update(s=>{s.tasks['4']={notes:'Read twice',estimate:25,pinned:true};});
 const clean=validateBackup(store.exportBackup());assert.equal(clean.tasks['4'].estimate,25);assert.equal(clean.snapshot,undefined);
});
test('failed save is reported and does not masquerade as persisted data',async()=>{
 const store=createStore({accountId:'1',adapter:{read:async()=>null,write:async()=>{throw Error('Disk full');}}});await store.load();
 await assert.rejects(store.update(s=>{s.settings.theme='dark';}),/Disk full/);assert.equal(store.get().settings.theme,'system');
});
test('restore recovery preserves the previous personal workspace without its Canvas cache',async()=>{
 const store=createStore({accountId:'1',adapter:memory()});await store.load();await store.update(s=>{s.tasks['7']={notes:'Before restore'};});
 await store.writeCache({origin:'https://school.instructure.com',user:{id:'1'},courses:[],assignments:[]});await store.saveRecovery();
 await store.replace({settings:{theme:'dark'},tasks:{'8':{notes:'Imported'}}});
 assert.equal(await store.readCache(),null);const recovery=await store.readRecovery();assert.equal(recovery.tasks['7'].notes,'Before restore');await store.replace(recovery);assert.equal(store.get().tasks['8'],undefined);assert.equal(store.get().settings.theme,'system');
});
test('dashboard customizations survive reload and backup without resetting prior notes',async()=>{
 const adapter=memory(),store=createStore({accountId:'1',adapter});await store.load();
 await store.update(s=>{Object.assign(s.settings,{dashboardLayout:'list',textSize:'large',showCourseStrip:false,showRecentGrades:false});s.tasks['7']={notes:'Keep this note'};});
 const loaded=await createStore({accountId:'1',adapter}).load();assert.equal(loaded.settings.dashboardLayout,'list');assert.equal(loaded.settings.textSize,'large');assert.equal(loaded.settings.showCourseStrip,false);
 const backup=validateBackup(store.exportBackup());assert.equal(backup.settings.showRecentGrades,false);assert.equal(backup.tasks['7'].notes,'Keep this note');
 assert.throws(()=>validateBackup({format:'reserve-backup',version:1,data:{settings:{showCourseStrip:'false'}}}),/showCourseStrip/);
});


test('grade visibility defaults off, persists per account, and round-trips in backups',async()=>{
 const adapter=memory(),store=createStore({accountId:'1',adapter});await store.load();assert.equal(store.get().settings.showGrades,false);
 await store.update(s=>{s.settings.showGrades=true;});assert.equal((await createStore({accountId:'1',adapter}).load()).settings.showGrades,true);
 assert.equal((await createStore({accountId:'2',adapter}).load()).settings.showGrades,false);
 assert.equal(validateBackup(store.exportBackup()).settings.showGrades,true);
 assert.throws(()=>validateBackup({format:'reserve-backup',version:1,data:{settings:{showGrades:'yes'}}}),/showGrades/);
});


test('scratchpad and recents persist with the account and round-trip without dropping plans',async()=>{
 const adapter=memory(),a=createStore({accountId:'1',adapter}),b=createStore({accountId:'2',adapter});await a.load();await b.load();
 await a.update(s=>{s.toolbox.scratchpad='My draft 漢字';s.toolbox.recent=['course:7:modules','course:7:modules'];s.tasks['7']={notes:'Keep this'};});
 const reload=createStore({accountId:'1',adapter});await reload.load();assert.equal(reload.get().toolbox.scratchpad,'My draft 漢字');assert.equal(b.get().toolbox.scratchpad,'');
 const clean=validateBackup(a.exportBackup());assert.equal(clean.tasks['7'].notes,'Keep this');assert.equal(clean.toolbox.recent.length,1);
 await assert.rejects(a.update(s=>{s.toolbox.scratchpad='x'.repeat(30001);}),/30,000/);assert.equal(a.get().toolbox.scratchpad,'My draft 漢字');
 assert.equal(validateBackup({format:'reserve-backup',version:1,data:{settings:{}}}).toolbox.scratchpad,'');
});

test('personal task sources survive update, reload, recovery, and same-account backup without dropping task notes',async()=>{
 const adapter=memory(),store=createStore({accountId:'1',adapter});await store.load();
 await store.update(s=>{
  s.customTasks.push({id:'local-source',name:'Read teacher note',courseId:'7',dueAt:null,createdAt:'2026-09-14T08:00:00Z',source:{kind:'message',title:'Teacher note',url:'/conversations/42'}});
  s.tasks['local-source']={progress:'in-progress',notes:'Keep my note',checklist:[{id:'step-1',text:'Reply after reading',done:false}]};
 });
 const reloaded=createStore({accountId:'1',adapter});const data=await reloaded.load();
 assert.deepEqual(data.customTasks[0].source,{kind:'message',title:'Teacher note',url:'https://school.instructure.com/conversations/42'});
 assert.equal(data.tasks['local-source'].notes,'Keep my note');
 assert.equal(data.tasks['local-source'].checklist[0].text,'Reply after reading');
 const clean=validateBackup(reloaded.exportBackup(),reloaded.owner);
 assert.deepEqual(clean.customTasks[0].source,data.customTasks[0].source);
 await reloaded.saveRecovery();await reloaded.replace({settings:{theme:'dark'}});
 const recovery=await reloaded.readRecovery();
 assert.deepEqual(recovery.customTasks[0].source,data.customTasks[0].source);
 assert.equal(recovery.tasks['local-source'].notes,'Keep my note');
});

test('invalid personal task sources reject backup and updates atomically while missing or null sources remain optional',async()=>{
 const adapter=memory(),store=createStore({accountId:'1',adapter});await store.load();
 await store.update(s=>{s.customTasks.push({id:'local-safe',name:'Safe',courseId:'personal',source:null});});
 assert.equal(store.get().customTasks[0].source,undefined);
 await assert.rejects(store.update(s=>{s.customTasks[0].source={kind:'link',title:'Unsafe',url:'javascript:alert(1)'};}),/source|link/i);
 assert.equal(store.get().customTasks[0].source,undefined,'failed validation must not partially update current state');
 const bad={format:'reserve-backup',version:1,data:{customTasks:[{id:'local-x',name:'X',courseId:'personal',source:{kind:'foreign',title:'X',url:'https://example.com/'}}]}};
 assert.throws(()=>validateBackup(bad),/source|kind/i);
 const credentialed={format:'reserve-backup',version:1,data:{customTasks:[{id:'local-x',name:'X',courseId:'personal',source:{kind:'link',title:'X',url:'https://user:pass@example.com/'}}]}};
 assert.throws(()=>validateBackup(credentialed),/source|link/i);
});

test('Reserve 2.15 defaults: Clay accent, Gentle motion, book-serif reading text and the greeting on',async()=>{
 const store=createStore({accountId:'1',adapter:memory()});const s=(await store.load()).settings;
 assert.deepEqual([s.accent,s.appearanceVersion,s.motion,s.readingFont,s.greeting,s.theme],['clay',2,'gentle','book','on','system'],'light until Dark is chosen (system resolves to light)');
 const blank=validateBackup({format:'reserve-backup',version:1,data:{settings:{}}}).settings;
 assert.deepEqual([blank.accent,blank.motion,blank.readingFont,blank.greeting],['clay','gentle','book','on']);assert.equal(s.livingArt,'on','Living drawings default on');assert.equal(blank.livingArt,'on');const off=validateBackup({format:'reserve-backup',version:1,data:{settings:{livingArt:'off'}}}).settings;assert.equal(off.livingArt,'off','a chosen Off is kept');assert.throws(()=>validateBackup({format:'reserve-backup',version:1,data:{settings:{livingArt:'dancing'}}}),/Invalid livingArt setting/);
});

test('an untouched Forest moves to Clay once; a Forest chosen afterwards sticks',async()=>{
 // Every profile saved before 2.15 holds accent forest (the old default was written back) and no version.
 const adapter=memory();await adapter.write('reserve:v1:https://school.instructure.com:1',{version:1,settings:{accent:'forest',theme:'dark'},tasks:{'7':{notes:'Keep me'}}});
 const store=createStore({accountId:'1',adapter});let data=await store.load();
 assert.equal(data.settings.accent,'clay');assert.equal(data.settings.appearanceVersion,2);assert.equal(data.settings.theme,'dark');assert.equal(data.tasks['7'].notes,'Keep me');
 await store.update(x=>{x.settings.accent='forest';});
 data=await createStore({accountId:'1',adapter}).load();assert.equal(data.settings.accent,'forest','a Forest chosen after the move is kept');assert.equal(data.settings.appearanceVersion,2);
 // Another accent chosen before 2.15 is never moved.
 assert.equal(validateBackup({format:'reserve-backup',version:1,data:{settings:{accent:'ocean'}}}).settings.accent,'ocean');
 assert.equal(validateBackup({format:'reserve-backup',version:1,data:{settings:{accent:'forest',appearanceVersion:2}}}).settings.accent,'forest');
 assert.throws(()=>validateBackup({format:'reserve-backup',version:1,data:{settings:{appearanceVersion:'2'}}}),/appearanceVersion/);
});

test('motion, reading text and greeting settings persist, round-trip and reject unknown values',async()=>{
 const adapter=memory(),store=createStore({accountId:'1',adapter});await store.load();
 await store.update(s=>{Object.assign(s.settings,{motion:'still',readingFont:'interface',greeting:'off'});});
 const loaded=(await createStore({accountId:'1',adapter}).load()).settings;
 assert.deepEqual([loaded.motion,loaded.readingFont,loaded.greeting],['still','interface','off']);
 const backup=validateBackup(store.exportBackup(),store.owner).settings;assert.deepEqual([backup.motion,backup.readingFont,backup.greeting],['still','interface','off']);
 for(const [key,bad] of [['motion','fast'],['motion','bounce'],['readingFont','comic'],['readingFont','serif'],['greeting','yes'],['greeting',true]]){
  assert.throws(()=>validateBackup({format:'reserve-backup',version:1,data:{settings:{[key]:bad}}}),new RegExp(key),`${key}: ${bad}`);
  await assert.rejects(store.update(s=>{s.settings[key]=bad;}),new RegExp(key));
 }
 assert.equal(store.get().settings.readingFont,'interface','a rejected update changes nothing');
});

test('data from retired toolbox tabs still validates and round-trips in backups',async()=>{
 const adapter=memory(),store=createStore({accountId:'1',adapter});await store.load();
 const focus={minutes:45,remaining:1200,endsAt:null,itemId:'17',sessions:3};
 await store.update(s=>{s.toolbox.scratchpad='Old writing desk text';s.toolbox.recent=['tool:writing','tool:links','course:7:modules'];s.toolbox.dockSize={width:520,height:640};s.focus=focus;});
 const reload=createStore({accountId:'1',adapter});await reload.load();const clean=validateBackup(reload.exportBackup(),reload.owner);
 assert.equal(clean.toolbox.scratchpad,'Old writing desk text');assert.deepEqual(clean.toolbox.recent,['tool:writing','tool:links','course:7:modules']);
 assert.deepEqual(clean.toolbox.dockSize,{width:520,height:640});assert.deepEqual(clean.focus,focus);
 store.destroy();reload.destroy();
});
