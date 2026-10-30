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
test('the private Canvas Harness defaults and explicit layout choices survive loading older backups',async()=>{
 const store=make();await store.load();
 const base=store.get().settings;
 assert.equal(base.theme,'light');assert.equal(base.accent,'clay');assert.equal(base.motion,'gentle');
 assert.equal(base.readingFont,'book');assert.equal(base.showGrades,false);
 assert.equal(base.courseNavigation,'sidebar');assert.equal(base.deskOrder,'context-first');
 assert.equal(base.courseCardStyle,'sketch');assert.equal(base.bannerSize,'standard');
 const backup=store.exportBackup();delete backup.data.settings.deskOrder;backup.data.settings.dashboardLayout='list';
 assert.equal(storage.validateBackup(backup,store.owner).settings.deskOrder,'stacked');
 backup.data.settings.deskOrder='context-first';
 const restored=storage.validateBackup(backup,store.owner).settings;
 assert.equal(restored.deskOrder,'context-first');assert.equal(restored.dashboardLayout,'split');
});
test('title, banner, icon, and frame artwork roundtrip with course names, colors and images',async()=>{
 const art=require('../extension/custom-art.js'),courseArt=require('../extension/course-art.js'),store=make();await store.load();
 const banner=art.importSVG(art.template('banner'),'banner.svg');
 const icon=art.importSVG(art.template('icon'),'icon.svg');
 const border=art.importSVG(art.template('border'),'frame.svg');
 const title=art.importSVG(art.template('title'),'title.svg');
 const image='data:image/png;base64,AAAA';
 await store.update(data=>{
  data.settings.coursePrefs['101']={name:'My own biology',color:'#123456',image,bannerArt:banner,iconArt:icon,borderArt:border,titleArt:title,bannerFit:'cover',bannerPosition:'left'};
  data.settings.overviewArt={titleArt:title};
  data.tasks['88']={notes:'Do not lose this'};
 });
 const prefs=(await store.load()).settings.coursePrefs['101'];
 for(const key of ['bannerArt','iconArt','borderArt','titleArt'])assert.equal(prefs[key].svg,{bannerArt:banner,iconArt:icon,borderArt:border,titleArt:title}[key].svg);
 assert.equal(prefs.name,'My own biology');assert.equal(prefs.color,'#123456');assert.equal(prefs.image,image);
 assert.deepEqual(storage.validateBackup(store.exportBackup(),store.owner),store.get());
 const decorated={id:'101',name:prefs.name,originalName:'CL Synthetic Biology',shortName:prefs.name,artPrefs:prefs,artMotion:true};
 assert.match(courseArt.scene(decorated),/ch-custom-banner/);
 assert.match(courseArt.mini(decorated),/ch-custom-icon/);
 assert.match(courseArt.frame('biology','101',decorated),/ch-custom-border/);
 assert.match(courseArt.titleFrame(decorated),/ch-custom-title/);
 assert.match(courseArt.titleStyle(decorated),/--rd-name-w:560/);
 const existingTitle={id:'102',name:'CL Physics-Novak-Ortiz',originalName:'CL Physics-Novak-Ortiz',shortName:'Physics',artPrefs:{bannerArt:banner},artMotion:true};
 assert.match(courseArt.titleFrame(existingTitle),/data-crop="title"/,'uploading a banner preserves the original illustrated course title');
 await store.update(data=>{const pref=data.settings.coursePrefs['101'];for(const key of [...require('../extension/customization-model.js').artKeys,'bannerFit','bannerPosition'])delete pref[key];});
 const cleared=store.get();assert.equal(cleared.settings.coursePrefs['101'].name,'My own biology');
 assert.equal(cleared.settings.coursePrefs['101'].color,'#123456');assert.equal(cleared.settings.coursePrefs['101'].image,image);
 assert.equal(cleared.tasks['88'].notes,'Do not lose this');assert.equal(cleared.settings.overviewArt.titleArt.svg,title.svg);
 const fallback={...decorated,artPrefs:cleared.settings.coursePrefs['101']};
 // A renamed biology course has a theme, so clearing the upload restores its subject’s drawn title (2.23.1).
 assert.equal(courseArt.titled(fallback).kind,'biology');assert.notEqual(courseArt.titled(fallback).generic,true);assert.match(courseArt.titleFrame(fallback),/data-art="biology" data-crop="title"/);
 assert.doesNotMatch(courseArt.titleFrame(fallback),/ch-custom-title/,'clearing the upload restores the themed title for the retained display name');
});
test('malformed or unsafe title artwork rejects imported backups and does not change saved data',async()=>{
 const art=require('../extension/custom-art.js'),store=make();await store.load();
 await store.update(data=>{data.settings.coursePrefs['101']={titleArt:art.importSVG(art.template('title'),'safe.svg'),name:'Personal name'};});
 const before=store.get(),backup=store.exportBackup();
 backup.data.settings.coursePrefs['101'].titleArt={name:'bad.svg',svg:'<svg><foreignObject><iframe/></foreignObject></svg>'};
 assert.throws(()=>storage.validateBackup(backup,store.owner),/SVG|unsafe/i);
 assert.deepEqual(store.get(),before);
 await assert.rejects(store.update(data=>{data.settings.coursePrefs['101'].titleArt={name:'bad.svg',svg:'<svg><image href="https://example.org/secret"/></svg>'};}));
 assert.deepEqual(await store.load(),before);
});
test('editor exposes archived artwork removal and templates alongside existing uploads',async()=>{
 const art=require('../extension/custom-art.js'),ui=require('../extension/customize-ui.js'),store=make();await store.load();
 const icon=art.importSVG(art.template('icon'),'icon.svg');
 await store.update(d=>{d.settings.coursePrefs['101']={iconArt:icon};d.settings.coursePrefs['999']={name:'Archived <course>',iconArt:icon,color:'#123456'};});
 const course={id:'101',name:'Current course',color:'#123456'},html=ui.render({s:store.get().settings,allCourses:[course],courses:[course],customizeCourseId:'101',customizeOpen:true,customizeTab:'courses'});
 assert.match(html,/data-pane="courses"/);assert.doesNotMatch(html,/data-pane="look"/);assert.match(html,/data-setting="bannerSize"/);assert.match(html,/data-setting="courseCardStyle"/);
 assert.match(html,/Artwork from other courses \(1\)/);assert.match(html,/Archived &lt;course&gt;/);
 assert.match(html,/data-rd-action="art-remove" data-id="999" data-kind="icon"/);
 assert.equal((html.match(/data-rd-action="art-template"/g)||[]).length,4);
 assert.match(html,/data-kind="title"/);
 assert.match(html,/data-rd-field="art-upload" data-kind="title"/);
 assert.match(html,/Remove custom icon/);
});
