'use strict';
// Audit B4 (2026-11-14): old or partly missing saved companion fields, and backups from older versions, never break a tab.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const ODD=[undefined,null,{},{xp:'180',treats:-5,streak:'3',best:null,coat:'unicorn',harness:7,gear:'saddle',size:'huge',roam:'moon',nudges:'loud',knowledge:'basic',skills:null,reminders:'x',routines:[{nope:true}],brain:[],name:42},{xp:1e12,treats:1e9,fed:-1,streakDay:'yesterday',told:{a:1},enabled:'yes',brain:{kinds:{treat:{shown:'a'}},hiddenUntil:'soon',nudges:{items:'x'}}}];
test('the Companion tab draws with missing, old or wrongly typed companion fields',()=>{
 const env=vm.createContext({console,TextEncoder});env.chrome={runtime:{getURL:file=>'chrome-extension://fixture/'+file}};
 for(const file of ['workspace-arrange.js','customization-model.js','custom-art.js','course-art.js','study-kind.js','pony-brain.js','agent-clock.js','pony-ask.js','pet-art.js','pets.js','quick-upload-ui.js','settings-dock.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});
 env.ReserveWidgets={FRAMES:[['pen','Pen','Drawn outline']]};
 for(const pet of ODD){const html=env.ReserveCustomizeUI.render({s:{theme:'light',accent:'clay',coursePrefs:{}},allCourses:[],courses:[],customizeOpen:true,customizeTab:'pet',personal:pet===undefined?undefined:{pet}});assert.match(html,/data-rd-field="pet" data-key="name"/,JSON.stringify(pet));assert.match(html,/Level \d+ · \d+ treats?/,JSON.stringify(pet));}
});
test('the Paddock module and the level helpers accept the same odd fields',()=>{
 const Pets=require('../extension/pets.js');
 for(const pet of ODD){const clean=Pets.clean(pet);assert.ok(Number.isInteger(Pets.level(clean.xp)));const p=Pets.levelProgress(clean.xp);assert.ok(p>=0&&p<=1);assert.equal(typeof Pets.unlocked('coat',clean.coat,clean.xp),'boolean');assert.equal(typeof Pets.unlocked('harness','iris',clean.xp),'boolean');assert.ok(Array.isArray(clean.reminders)&&Array.isArray(clean.routines));}
});
test('a backup carrying the old companion fields (and an old knowledge tier) restores, and the fields stay harmless',()=>{
 const S=require('../extension/storage.js'),Pets=require('../extension/pets.js');
 const owner={origin:'https://school.instructure.com',accountId:'4242'};
 const backup={format:'reserve-backup',version:1,owner,exportedAt:'2026-10-12T00:00:00Z',data:{version:1,settings:{theme:'system',accent:'forest',motion:'still',dashboardLayout:'list',appearanceVersion:1},tasks:{'123':{plannedDate:'2026-10-02',estimate:40,progress:'in-progress',notes:'n',checklist:[{id:'a',text:'s',done:true}]}},customTasks:[{id:'local-abc',name:'Old task',courseId:'personal',dueAt:'2026-10-03T12:00:00Z'}],pet:{enabled:true,name:'Maple',coat:'sage',knowledge:'basic',treats:5,fed:3,xp:180,streak:3,streakDay:'2026-10-01',best:4,told:'hi',brain:{kinds:{treat:{shown:1,used:1,ignored:0,streak:0}}}}}};
 const data=S.validateBackup(JSON.stringify(backup),owner),pet=Pets.clean(data.pet);
 assert.equal(pet.knowledge,'most');assert.equal(pet.coat,'sage');assert.equal(pet.xp,180);assert.equal(pet.treats,5);
 assert.equal(data.settings.accent,'clay','a version-1 Forest accent still moves to Clay once');
});
