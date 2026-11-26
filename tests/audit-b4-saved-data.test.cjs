'use strict';
// Audit B4 (2026-11-14): old or partly missing saved companion fields, and backups from older versions, never break a tab.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const ODD=[undefined,null,{},{xp:'180',treats:-5,streak:'3',best:null,coat:'unicorn',harness:7,gear:'saddle',size:'huge',roam:'moon',nudges:'loud',knowledge:'basic',skills:null,reminders:'x',routines:[{nope:true}],brain:[],name:42},{xp:1e12,treats:1e9,fed:-1,streakDay:'yesterday',told:{a:1},enabled:'yes',brain:{kinds:{treat:{shown:'a'}},hiddenUntil:'soon',nudges:{items:'x'}}}];
test('the Companion tab draws with missing, old or wrongly typed companion fields',()=>{
 const env=vm.createContext({console,TextEncoder});env.chrome={runtime:{getURL:file=>'chrome-extension://fixture/'+file}};
 for(const file of ['workspace-arrange.js','customization-model.js','custom-art.js','course-art.js','study-kind.js','pony-brain.js','agent-clock.js','pony-ask.js','pet-art.js','pets.js','quick-upload-ui.js','settings-dock.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});
 env.ReserveWidgets={FRAMES:[['pen','Pen','Drawn outline']]};
 for(const pet of ODD){const html=env.ReserveCustomizeUI.render({s:{theme:'light',accent:'clay',coursePrefs:{}},allCourses:[],courses:[],customizeOpen:true,customizeTab:'pet',personal:pet===undefined?undefined:{pet}});assert.match(html,/data-rd-field="pet" data-key="name"/,JSON.stringify(pet));assert.doesNotMatch(html,/Level \d|\btreats?\b|days in a row|data-locked/,'the old game is not drawn: '+JSON.stringify(pet));}
});
test('the same odd fields clean to a companion whose old game fields, where kept, are clean ones',()=>{
 const Pets=require('../extension/pets.js');
 for(const pet of ODD){const clean=Pets.clean(pet);for(const key of ['xp','treats','fed','streak','streakDay','best','told'])if(Object.hasOwn(clean,key))assert.ok(key==='streakDay'?clean[key]===''||/^\d{4}-\d{2}-\d{2}$/.test(clean[key]):key==='told'?typeof clean[key]==='string':Number.isInteger(clean[key])&&clean[key]>=0,key);assert.ok(Array.isArray(clean.reminders)&&Array.isArray(clean.routines));}
 for(const name of ['level','levelProgress','unlocked','reward','feed','LEVEL_XP','UNLOCKS'])assert.equal(Pets[name],undefined,name);
});
test('a backup carrying the old companion fields (and an old knowledge tier) restores, and the old fields are kept as saved (4.2.0)',()=>{
 const S=require('../extension/storage.js'),Pets=require('../extension/pets.js');
 const owner={origin:'https://school.instructure.com',accountId:'4242'};
 const backup={format:'reserve-backup',version:1,owner,exportedAt:'2026-10-12T00:00:00Z',data:{version:1,settings:{theme:'system',accent:'forest',motion:'still',dashboardLayout:'list',appearanceVersion:1},tasks:{'123':{plannedDate:'2026-10-02',estimate:40,progress:'in-progress',notes:'n',checklist:[{id:'a',text:'s',done:true}]}},customTasks:[{id:'local-abc',name:'Old task',courseId:'personal',dueAt:'2026-10-03T12:00:00Z'}],pet:{enabled:true,name:'Maple',coat:'sage',knowledge:'basic',treats:5,fed:3,xp:180,streak:3,streakDay:'2026-10-01',best:4,told:'hi',brain:{kinds:{treat:{shown:1,used:1,ignored:0,streak:0}}}}}};
 const data=S.validateBackup(JSON.stringify(backup),owner),pet=Pets.clean(data.pet);
 assert.equal(pet.knowledge,'most');assert.equal(pet.coat,'sage');assert.equal(pet.name,'Maple');
 for(const key of ['xp','treats','fed','streak','streakDay','best','told']){assert.equal(data.pet[key],{xp:180,treats:5,fed:3,streak:3,streakDay:'2026-10-01',best:4,told:'hi'}[key],'backup '+key+' kept (4.2.0)');assert.equal(pet[key],{xp:180,treats:5,fed:3,streak:3,streakDay:'2026-10-01',best:4,told:'hi'}[key],'clean '+key+' kept (4.2.0)');}
 assert.equal(Object.hasOwn(data.pet.brain?.kinds||{},'treat'),false,'the old Treat row counters');
 assert.equal(data.settings.accent,'clay','a version-1 Forest accent still moves to Clay once');
});
