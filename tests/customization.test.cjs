'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const storage=require('../extension/storage.js');
function make(){const data={};return storage.createStore({accountId:'42',origin:'https://school.instructure.com',adapter:{read:async k=>structuredClone(data[k]),write:async(k,v)=>{data[k]=structuredClone(v);}}});}
test('workspace customization persists without losing notes, visibility or original preferences',async()=>{
 const store=make();await store.load();await store.update(d=>{Object.assign(d.settings,{courseNavigation:'topbar',deskOrder:'work-first',surfaceStyle:'clean',courseCardStyle:'rounded',bannerSize:'compact',showCourseIcons:false,showDeadlinePreview:false,showBookmarks:false,showCourseInformation:false});d.tasks['9']={notes:'Keep my work'};d.settings.courseOrder=['102','101'];d.settings.hiddenCourses=['103'];d.settings.coursePrefs['101']={name:'My class',color:'#123456',bannerFit:'contain',bannerPosition:'left'};});
 const result=await store.load();assert.equal(result.settings.courseNavigation,'topbar');assert.equal(result.settings.deskOrder,'work-first');assert.equal(result.settings.surfaceStyle,'clean');assert.equal(result.settings.courseCardStyle,'rounded');assert.equal(result.settings.bannerSize,'compact');assert.equal(result.settings.showCourseIcons,false);assert.equal(result.settings.showBookmarks,false);assert.equal(result.settings.coursePrefs['101'].bannerFit,'contain');assert.equal(result.tasks['9'].notes,'Keep my work');assert.deepEqual(result.settings.courseOrder,['102','101']);
 assert.deepEqual(storage.validateBackup(store.exportBackup(),store.owner),result);
});
test('unknown custom layout and invalid visibility values reject a backup atomically',async()=>{
 const store=make();await store.load();for(const [key,value] of [['courseNavigation','floating-script'],['deskOrder','oops'],['surfaceStyle','javascript:'],['courseCardStyle','anything'],['bannerSize','100000'],['showCourseInformation','yes']]){const backup=store.exportBackup();backup.data.settings[key]=value;assert.throws(()=>storage.validateBackup(backup,store.owner),/Invalid/);}
});
test('course banner placement rejects invalid values instead of preserving injected style strings',async()=>{
 const store=make();await store.load();const backup=store.exportBackup();backup.data.settings.coursePrefs['101']={bannerFit:'contain;position:fixed'};assert.throws(()=>storage.validateBackup(backup,store.owner),/Invalid/);
});
test('artwork stays with its course and overview through saves and same-account backups',async()=>{
 const art=require('../extension/custom-art.js'),store=make();await store.load();
 const banner=art.importSVG(art.template('banner'),'landscape.svg');
 await store.update(d=>{d.settings.overviewArt={iconArt:art.importSVG(art.template('icon'),'overview.svg')};d.settings.coursePrefs['101']={name:'Custom class',bannerArt:banner,bannerFit:'cover',bannerPosition:'left'};});
 const saved=await store.load();assert.equal(saved.settings.coursePrefs['101'].bannerArt.svg,banner.svg);assert.equal(saved.settings.coursePrefs['102'],undefined);assert.equal(saved.settings.overviewArt.bannerArt,undefined);
 assert.deepEqual(storage.validateBackup(store.exportBackup(),store.owner),saved);
 const bad=store.exportBackup();bad.data.settings.coursePrefs['101'].bannerArt.svg='<svg onload="alert(1)"/>';
 assert.throws(()=>storage.validateBackup(bad,store.owner));assert.deepEqual(store.get(),saved);
 await assert.rejects(store.update(d=>{d.settings.overviewArt.bannerArt={name:'bad.svg',svg:'<svg><script/></svg>'};}));
 assert.deepEqual(await store.load(),saved);
});
test('combined artwork budget rejects a save without dropping earlier preferences',async()=>{
 const model=require('../extension/customization-model.js');
 const asset={name:'large.svg',svg:'x'.repeat(250000)};
 assert.throws(()=>model.checkBudget({overviewArt:{bannerArt:asset},coursePrefs:Object.fromEntries(Array.from({length:8},(_,i)=>[String(i),{bannerArt:asset}]))}),/2 MiB/);
});
test('layout presets and course appearance resets leave task records available',async()=>{
 const model=require('../extension/customization-model.js'),store=make();await store.load();
 await store.update(d=>{d.tasks['401']={notes:'Keep this',pinned:true};d.settings.coursePrefs['101']={name:'Custom name'};Object.assign(d.settings,model.presets.focus);d.settings.density='compact';d.settings.showCourseStrip=false;d.settings.showRecentGrades=true;});
 assert.equal(store.get().settings.courseNavigation,'topbar');
 await store.update(d=>{delete d.settings.coursePrefs['101'];Object.assign(d.settings,model.defaults);});
 assert.equal(store.get().settings.courseNavigation,'sidebar');assert.equal(store.get().tasks['401'].pinned,true);assert.equal(store.get().tasks['401'].notes,'Keep this');
 assert.equal(store.get().settings.density,'comfortable');assert.equal(store.get().settings.showCourseStrip,true);assert.equal(store.get().settings.showRecentGrades,false);
});
test('editor exposes archived artwork removal and templates alongside existing uploads',async()=>{
 const art=require('../extension/custom-art.js'),ui=require('../extension/customize-ui.js'),store=make();await store.load();
 const icon=art.importSVG(art.template('icon'),'icon.svg');
 await store.update(d=>{d.settings.coursePrefs['101']={iconArt:icon};d.settings.coursePrefs['999']={name:'Archived <course>',iconArt:icon,color:'#123456'};});
 const course={id:'101',name:'Current course',color:'#123456'},html=ui.render({s:store.get().settings,allCourses:[course],courses:[course],customizeCourseId:'101',customizeOpen:true});
 assert.match(html,/Artwork from other courses \(1\)/);assert.match(html,/Archived &lt;course&gt;/);
 assert.match(html,/data-rd-action="art-remove" data-id="999" data-kind="icon"/);
 assert.equal((html.match(/data-rd-action="art-template"/g)||[]).length,3);
 assert.match(html,/Remove custom icon/);
});
