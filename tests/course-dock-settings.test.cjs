'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const customization=require('../extension/customization-model.js'),Arrange=require('../extension/workspace-arrange.js'),storage=require('../extension/storage.js');
const {createDOM}=require('./contributor-fixture.cjs');
function account(){
 const raw=new Map(),adapter={read:async key=>structuredClone(raw.get(key)),write:async(key,value)=>raw.set(key,structuredClone(value))};
 return {accountId:'37',origin:'https://school.instructure.com',adapter};
}
async function saveDock(store,dockSize='medium'){
 await store.load();await store.update(data=>{
  Object.assign(data.settings,{courseNavigation:'dock',dockSize,accent:'rose',courseOrder:['102','101'],hiddenCourses:['103'],moduleSize:{reader:'l'}});
  data.settings.coursePrefs['101']={name:'My class',color:'#123456',bannerFit:'contain',bannerPosition:'left'};
  data.tasks['12']={notes:'Keep my draft',pinned:true,checklist:[{id:'step-1',text:'Check the source',done:false}]};
  data.toolbox.scratchpad='Keep my scratchpad';Arrange.change(data.settings,{type:'hide-context'});
 });return store.get();
}
function editor(settings={},enabled=()=>true,tab='layout'){
 const env=vm.createContext({ReserveFeatures:{enabled}});
 for(const file of ['workspace-arrange.js','customization-model.js','customize-ui.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),env,{filename:file});
 const context={s:settings,allCourses:[],courses:[],customizeOpen:true,customizeTab:tab},before=structuredClone(settings);
 const document=createDOM('<html><body>'+env.ReserveCustomizeUI.render(context)+'</body></html>');assert.deepEqual(settings,before,'rendering does not change saved settings');return document;
}

test('course dock settings cleaning keeps dock in the current choice and undo snapshot',()=>{
 const settings={courseNavigation:'dock',workspaceUndo:{order:['work','reader','context'],mode:'stacked',courseNavigation:'dock',showCourseInformation:false,showCourseStrip:true,courseOrder:['102','101']}},before=structuredClone(settings),clean=customization.cleanSettings(settings);
 assert.equal(clean.courseNavigation,'dock');assert.equal(clean.workspaceUndo.courseNavigation,'dock');
 assert.deepEqual(clean.workspaceUndo.order,['work','reader','context']);assert.deepEqual(clean.workspaceUndo.courseOrder,['102','101']);assert.equal(clean.workspaceUndo.showCourseInformation,false);
 assert.deepEqual(settings,before,'validation leaves its input unchanged');
});

test('course dock navigation supports selection, no-ops, undo and layout reset',()=>{
 for(const original of ['sidebar','topbar']){
  const settings={...structuredClone(customization.defaults),courseNavigation:original};
  assert.equal(Arrange.change(settings,{type:'navigation',value:'dock'}),true);assert.equal(settings.courseNavigation,'dock');assert.equal(settings.workspaceUndo.courseNavigation,original);
  const selected=structuredClone(settings);assert.equal(Arrange.change(settings,{type:'navigation',value:'dock'}),false);assert.equal(Arrange.change(settings,{type:'navigation',value:'bottom'}),false);assert.deepEqual(settings,selected);
  assert.equal(Arrange.change(settings,{type:'undo'}),true);assert.equal(settings.courseNavigation,original);assert.equal(settings.workspaceUndo,null);
  Arrange.change(settings,{type:'navigation',value:'dock'});Arrange.change(settings,{type:'mode',value:'stacked'});
  assert.equal(customization.cleanSettings(settings).workspaceUndo.courseNavigation,'dock');assert.equal(Arrange.change(settings,{type:'undo'}),true);assert.equal(settings.courseNavigation,'dock');assert.equal(settings.workspaceMode,'side-by-side');
  assert.equal(Arrange.change(settings,{type:'reset'}),true);assert.equal(settings.courseNavigation,'sidebar');assert.equal(Arrange.change(settings,{type:'undo'}),true);assert.equal(settings.courseNavigation,'dock');
 }
});

test('course dock save and fresh-account-store load preserve personal data and undo',async t=>{
 const options=account(),first=storage.createStore(options),next=storage.createStore(options);t.after(()=>{first.destroy();next.destroy();});
 const saved=await saveDock(first),loaded=await next.load();assert.deepEqual(loaded,saved);
 assert.equal(loaded.settings.courseNavigation,'dock');assert.equal(loaded.settings.workspaceUndo.courseNavigation,'dock');assert.equal(loaded.settings.showCourseInformation,false);
 assert.equal(loaded.tasks['12'].notes,'Keep my draft');assert.deepEqual(loaded.tasks['12'].checklist,[{id:'step-1',text:'Check the source',done:false}]);assert.equal(loaded.tasks['12'].pinned,true);
 assert.equal(loaded.settings.coursePrefs['101'].name,'My class');assert.equal(loaded.settings.coursePrefs['101'].color,'#123456');assert.deepEqual(loaded.settings.courseOrder,['102','101']);assert.deepEqual(loaded.settings.hiddenCourses,['103']);assert.deepEqual(loaded.settings.moduleSize,{reader:'l'});assert.equal(loaded.toolbox.scratchpad,'Keep my scratchpad');
 await next.update(data=>Arrange.change(data.settings,{type:'undo'}));const undone=await first.load();assert.equal(undone.settings.courseNavigation,'dock');assert.equal(undone.settings.showCourseInformation,true);assert.equal(undone.settings.workspaceUndo,null);assert.deepEqual(undone.tasks,saved.tasks);
});

test('course dock JSON backup and recovery roundtrip through public validation and replace APIs',async t=>{
 const store=storage.createStore(account());t.after(()=>store.destroy());const saved=await saveDock(store),backup=JSON.stringify(store.exportBackup());
 const restored=storage.validateBackup(backup,store.owner);assert.deepEqual(restored,saved);assert.equal(restored.settings.courseNavigation,'dock');assert.equal(restored.settings.workspaceUndo.courseNavigation,'dock');
 await store.saveRecovery();await store.update(data=>{Arrange.change(data.settings,{type:'navigation',value:'topbar'});data.tasks['12'].notes='Later draft';});
 await store.replace(restored);assert.deepEqual(await store.load(),saved);
 await store.update(data=>{data.settings.courseNavigation='sidebar';data.toolbox.scratchpad='Later scratchpad';});const recovery=await store.readRecovery();assert.deepEqual(recovery,saved);
 await store.replace(recovery);assert.deepEqual(await store.load(),saved);await store.update(data=>Arrange.change(data.settings,{type:'undo'}));assert.equal(store.get().settings.courseNavigation,'dock');assert.equal(store.get().settings.showCourseInformation,true);
 assert.throws(()=>storage.validateBackup(backup,{...store.owner,accountId:'38'}),/different Canvas account/);
});

test('course dock validation rejects unknown current and undo choices atomically',async t=>{
 const store=storage.createStore(account());t.after(()=>store.destroy());const saved=await saveDock(store);
 for(const value of ['floating-script','Dock','bottom','',null,false,0,{},['dock']]){
  const backup=store.exportBackup();backup.data.settings.courseNavigation=value;assert.throws(()=>storage.validateBackup(backup,store.owner),/Invalid courseNavigation/);
  await assert.rejects(store.update(data=>{data.settings.courseNavigation=value;}),/Invalid courseNavigation/);assert.deepEqual(await store.load(),saved);
  const undoBackup=store.exportBackup();undoBackup.data.settings.workspaceUndo.courseNavigation=value;assert.throws(()=>storage.validateBackup(undoBackup,store.owner),/Invalid workspaceUndo/);
  await assert.rejects(store.update(data=>{data.settings.workspaceUndo.courseNavigation=value;}),/Invalid workspaceUndo/);assert.deepEqual(await store.load(),saved);
 }
});

test('course dock leaves older backup defaults and all layout preset navigation unchanged',async t=>{
 const store=storage.createStore(account());t.after(()=>store.destroy());await store.load();const legacy=store.exportBackup();delete legacy.data.settings.courseNavigation;
 assert.equal(storage.validateBackup(legacy,store.owner).settings.courseNavigation,'sidebar');assert.equal(Arrange.snapshot({}).courseNavigation,'sidebar');
 for(const [name,want] of [['studio','sidebar'],['study','sidebar'],['focus','topbar']]){await store.update(data=>Object.assign(data.settings,structuredClone(customization.presets[name])));assert.equal((await store.load()).settings.courseNavigation,want);}
});

test('course dock Home choice is a named native radio with its own dock artwork and no descriptions',()=>{
 for(const courseNavigation of ['sidebar','topbar','dock']){
  const document=editor({courseNavigation}),group=document.querySelector('[role="radiogroup"][aria-label="Course navigation"]');assert.ok(group);
  const radios=group.querySelectorAll('input');assert.deepEqual(radios.map(input=>input.value),['sidebar','topbar','dock']);assert.deepEqual(radios.map(input=>input.closest('label').querySelector('strong').textContent),['Down the side','Across the top','Along the bottom']);
  assert.deepEqual(radios.filter(input=>input.checked).map(input=>input.value),[courseNavigation]);
  for(const input of radios){assert.equal(input.type,'radio');assert.equal(input.getAttribute('name'),'cz-courseNavigation');assert.equal(input.dataset.rdField,'setting');assert.equal(input.dataset.setting,'courseNavigation');assert.equal(input.disabled,false);assert.equal(input.hasAttribute('tabindex'),false);}
  const dock=radios[2].closest('label');assert.equal(dock.querySelector('small'),null);assert.notEqual(dock.querySelector('svg').outerHTML,radios[1].closest('label').querySelector('svg').outerHTML);assert.ok(dock.querySelector('svg rect.cz-fill[y="38"]'));
 }
 assert.deepEqual(editor().querySelector('[aria-label="Course navigation"]').querySelectorAll('input').filter(input=>input.checked).map(input=>input.value),['sidebar']);
});

test('course dock choice respects the existing Arrange feature gate',()=>{
 const document=editor({courseNavigation:'dock'},id=>id!=='arrange');assert.equal(document.querySelector('[aria-label="Course navigation"]'),null);
});

test('Home keeps its section order and only the shared-computer switch warning',()=>{
 const document=editor({courseNavigation:'dock'}),groups=document.querySelectorAll('[data-pane="layout"] .cz-group h3').map(node=>node.textContent);assert.deepEqual(groups,['Start from a layout','Modules on Home','Order of the three panels','Where your courses are','Course dock','Spacing','What shows','Canvas\u2019s menu bar','Saved layouts & plans']);assert.equal(document.querySelectorAll('[data-pane="layout"] .cz-group > .cz-hint').length,0);assert.equal(document.querySelectorAll('[data-pane="layout"] .cz-choice small').length,0);const warnings=document.querySelectorAll('[data-pane="layout"] .cz-toggle small').map(node=>node.textContent);assert.deepEqual(warnings,['Leave this off on a shared computer.']);assert.equal(document.querySelector('[data-rd-action="layout-reset"]'),null);
});

test('Courses always keeps the course list while its banner, card, and artwork controls obey the course-art gate',()=>{
 const shown=editor({},()=>true,'courses'),gated=editor({},id=>id!=='course-art','courses');assert.ok(shown.querySelector('[data-pane="courses"] .ch-course-settings'));assert.ok(shown.querySelector('[data-setting="bannerSize"]'));assert.ok(shown.querySelector('[data-setting="courseCardStyle"]'));assert.ok(shown.querySelector('.ch-art-controls'));assert.ok(gated.querySelector('[data-pane="courses"] .ch-course-settings'));assert.equal(gated.querySelector('[data-setting="bannerSize"]'),null);assert.equal(gated.querySelector('[data-setting="courseCardStyle"]'),null);assert.equal(gated.querySelector('.ch-art-controls'),null);
});

test('dock size cleaning preserves each current choice independently of the undo choice',()=>{
 for(const dockSize of ['small','medium','large'])for(const undoSize of ['small','medium','large']){
  const settings={courseNavigation:'dock',dockSize,workspaceUndo:{order:['work','reader','context'],mode:'stacked',courseNavigation:'dock',dockSize:undoSize,showCourseInformation:false,showCourseStrip:true}},before=structuredClone(settings),clean=customization.cleanSettings(settings);
  assert.equal(clean.dockSize,dockSize);assert.equal(clean.workspaceUndo.dockSize,undoSize);assert.equal(Arrange.snapshot(clean).dockSize,dockSize);assert.deepEqual(settings,before);
 }
});

test('dock size is part of complete workspace undo and reversible layout reset',()=>{
 for(const dockSize of ['small','medium','large']){
  const settings={...structuredClone(customization.defaults),courseNavigation:'dock',dockSize,accent:'rose'};
  Arrange.change(settings,{type:'mode',value:'stacked'});assert.equal(settings.workspaceUndo.dockSize,dockSize);
  assert.equal(Arrange.change(settings,{type:'reset'}),true);assert.equal(settings.dockSize,'medium');assert.equal(settings.courseNavigation,'sidebar');assert.equal(settings.workspaceUndo.dockSize,dockSize);assert.equal(settings.accent,'rose');
  assert.equal(Arrange.change(settings,{type:'undo'}),true);assert.equal(settings.dockSize,dockSize);assert.equal(settings.courseNavigation,'dock');assert.equal(settings.workspaceMode,'stacked');assert.equal(settings.workspaceUndo,null);
  const before=Arrange.snapshot(settings);settings.dockSize=dockSize==='small'?'large':'small';settings.workspaceUndo=before;
  assert.equal(Arrange.change(settings,{type:'undo'}),true);assert.equal(settings.dockSize,dockSize);assert.equal(settings.workspaceUndo,null);
 }
});

for(const dockSize of ['small','medium','large'])test(`dock size ${dockSize} survives save, fresh load, JSON backup, recovery and undo`,async t=>{
 const options=account(),first=storage.createStore(options),next=storage.createStore(options);t.after(()=>{first.destroy();next.destroy();});
 const saved=await saveDock(first,dockSize),loaded=await next.load();assert.equal(loaded.settings.dockSize,dockSize);assert.equal(loaded.settings.workspaceUndo.dockSize,dockSize);assert.deepEqual(loaded,saved);assert.deepEqual(loaded.toolbox.dockSize,{width:0,height:0});
 const backup=JSON.stringify(next.exportBackup()),restored=storage.validateBackup(backup,next.owner);assert.equal(restored.settings.dockSize,dockSize);assert.equal(restored.settings.workspaceUndo.dockSize,dockSize);assert.deepEqual(restored,saved);
 await next.saveRecovery();await next.update(data=>{data.settings.dockSize=dockSize==='small'?'large':'small';data.tasks['12'].notes='Later draft';});
 const recovery=await next.readRecovery();assert.deepEqual(recovery,saved);await next.replace(restored);assert.deepEqual(await first.load(),saved);
 await next.update(data=>{data.settings.dockSize='medium';data.toolbox.scratchpad='Later scratchpad';});await next.replace(recovery);assert.deepEqual(await first.load(),saved);
 await next.update(data=>Arrange.change(data.settings,{type:'undo'}));assert.equal(next.get().settings.dockSize,dockSize);assert.equal(next.get().settings.showCourseInformation,true);assert.deepEqual(next.get().tasks,saved.tasks);
});

test('invalid dock size settings and undo snapshots reject atomically across validation, saves and restore',async t=>{
 const options=account(),store=storage.createStore(options);t.after(()=>store.destroy());const saved=await saveDock(store,'large'),key=`reserve:v1:${options.origin}:${options.accountId}`,rawBefore=await options.adapter.read(key);
 let notifications=0;store.subscribe(()=>notifications++);
 for(const value of ['floating-script','Medium','xl','',null,false,0,54,{},['small']])for(const undo of [false,true]){
  const backup=store.exportBackup(),target=undo?backup.data.settings.workspaceUndo:backup.data.settings,error=undo?/Invalid workspaceUndo/:/Invalid dockSize/;target.dockSize=value;
  assert.throws(()=>storage.validateBackup(backup,store.owner),error);
  await assert.rejects(store.update(data=>{(undo?data.settings.workspaceUndo:data.settings).dockSize=value;data.tasks['12'].notes='Must not save';}),error);
  await assert.rejects(store.replace(backup.data),error);assert.deepEqual(store.get(),saved);assert.deepEqual(await store.load(),saved);assert.deepEqual(await options.adapter.read(key),rawBefore);
 }
 const corrupt={...structuredClone(saved.settings),workspaceUndo:{...saved.settings.workspaceUndo,dockSize:'xl'}},before=structuredClone(corrupt);
 assert.throws(()=>Arrange.change(corrupt,{type:'undo'}),/Invalid workspaceUndo/);assert.deepEqual(corrupt,before);assert.equal(notifications,0);
});

test('legacy saved settings, backups, recovery, undo and presets default dock size to medium',async t=>{
 assert.equal(customization.cleanSettings({}).dockSize,'medium');assert.equal(Arrange.DEFAULT.dockSize,'medium');assert.equal(Arrange.snapshot({}).dockSize,'medium');
 const options=account(),first=storage.createStore(options),next=storage.createStore(options);t.after(()=>{first.destroy();next.destroy();});await saveDock(first,'large');
 const backup=first.exportBackup();delete backup.data.settings.dockSize;delete backup.data.settings.workspaceUndo.dockSize;
 const key=`reserve:v1:${options.origin}:${options.accountId}`;await options.adapter.write(key,backup.data);await options.adapter.write(`${key}:recovery`,backup);
 for(const data of [await next.load(),storage.validateBackup(JSON.stringify(backup),next.owner),await next.readRecovery()]){assert.equal(data.settings.dockSize,'medium');assert.equal(data.settings.workspaceUndo.dockSize,'medium');}
 await next.update(data=>{data.settings.dockSize='small';Arrange.change(data.settings,{type:'undo'});});assert.equal(next.get().settings.dockSize,'medium');
 for(const name of ['studio','study','focus']){await next.update(data=>{data.settings.dockSize='large';Object.assign(data.settings,structuredClone(customization.presets[name]));});assert.equal((await next.load()).settings.dockSize,'medium');}
});

// 3.7 (owner, 2026-10-27): the dock's own controls replace Small/Medium/Large: a size slider, the shelf, the look and
// four switches, the same as the dock's right-click card.
test('dock controls follow course location: a size slider, shelf and look choices and its switches',()=>{
 for(const dockScale of [.8,1,1.4]){
  const document=editor({courseNavigation:'dock',dockScale}),section=document.querySelectorAll('[data-pane="layout"] .cz-group').find(g=>g.querySelector('h3')?.textContent==='Course dock');assert.ok(section);
  const sections=section.parentElement.children,index=sections.indexOf(section);assert.equal(sections[index-1].querySelector('h3').textContent,'Where your courses are');assert.equal(sections[index+1].querySelector('h3').textContent,'Spacing');
  const range=section.querySelector('input[type="range"]');assert.equal(range.dataset.setting,'dockScale');assert.equal(range.dataset.rdField,'setting');assert.equal(Number(range.getAttribute('value')),dockScale);
  for(const [key,values] of [['dockShelf',['kraft','paper','none']],['dockStyle',['tiles','cards']]]){const group=section.querySelectorAll('input').filter(i=>i.dataset.setting===key);assert.deepEqual(group.map(i=>i.value),values);assert.ok(group.every(i=>i.type==='radio'&&i.getAttribute('name')==='cz-'+key));}
  assert.deepEqual(section.querySelectorAll('input[type="checkbox"]').map(i=>i.dataset.setting),['dockNamesAlways','dockCounts','dockLively','dockHide']);
 }
 const find=doc=>doc.querySelectorAll('.cz-group').some(group=>group.querySelector('h3')?.textContent==='Course dock');
 for(const settings of [{},{courseNavigation:'sidebar'},{courseNavigation:'topbar'}])assert.equal(find(editor(settings)),false);
 assert.equal(find(editor({courseNavigation:'dock'},id=>id!=='arrange')),false);
 assert.ok(find(editor({courseNavigation:'dock'},id=>id!=='course-art')),'dock controls depend on Arrange, independently of course artwork');
});
