'use strict';

// The public settings editor renders one pane and keeps local file review available.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const extension=path.resolve(__dirname,'../extension'),read=file=>fs.readFileSync(path.join(extension,file),'utf8');
const headings=html=>[...html.matchAll(/<section class="cz-group"><h3>([^<]+)<\/h3>/g)].map(match=>match[1].replaceAll('&amp;','&'));
const pane=html=>[...html.matchAll(/class="cz-pane" data-pane="([^"]+)"/g)].map(match=>match[1]);

function editor(){
 const env=vm.createContext({console,TextEncoder});
 env.ReservePonyAsk={cleanRoutines:routines=>routines||[],cleanReminders:reminders=>reminders||[]};
 for(const file of ['workspace-arrange.js','customization-model.js','custom-art.js','course-art.js','pet-art.js','pets.js','quick-upload-ui.js','make-your-own.js','settings-dock.js','customize-ui.js']){
  vm.runInContext(read(file),env,{filename:file});
 }
 env.ReserveWidgets={FRAMES:[['pen','Pen','Outline'],['stitch','Stitch','Outline']]};
 const allCourses=[{id:'10',name:'Biology',color:'#123456'},{id:'20',name:'History',color:'#abcdef'}];
 const s={...env.ReserveCustomization.defaults,theme:'light',accent:'clay',makeYourOwn:{theme:null,pet:null,installed:{}},coursePrefs:{}};
 const c={s,allCourses,courses:allCourses,customizeOpen:true,customizeCourseId:'10',customizeTab:'look',personal:{pet:{}},makeOwn:{busy:false,status:'',draft:null,week:'',presetKinds:{}},customKits:[]};
 const render=tab=>{c.customizeTab=tab;return env.ReserveCustomizeUI.render(c);};
 return {env,c,s,render};
}

// Adapted from customize-performance.test.cjs and personal-settings-dock.test.cjs.
test('closed dock is inert, constant sized and reads no protected settings',()=>{
 const f=editor(),readKeys=[];
 f.c.customizeOpen=false;
 for(const key of ['s','allCourses','courses','makeOwn','customizeDrafts']){
  Object.defineProperty(f.c,key,{get(){readKeys.push(key);throw Error('Read while closed: '+key);}});
 }
 const html=f.render('courses');
 assert.match(html,/data-open="false"/);
 assert.match(html,/inert aria-hidden="true"/);
 assert.doesNotMatch(html,/<(?:input|select|textarea|button|svg|img)\b|class="cz-pane"/);
 assert.deepEqual(readKeys,[]);
 assert.ok(Buffer.byteLength(html)<1000);
});

// Adapted from customize-performance.test.cjs and installed-controls.test.cjs.
test('five public tabs build only the requested pane, with legacy aliases',()=>{
 const f=editor();
 assert.deepEqual(Array.from(f.env.ReserveCustomizeUI.tabs(),entry=>Array.from(entry)),[
  ['look','Look'],['layout','Home'],['courses','Courses'],['pet','Pony'],['settings','More']
 ]);
 for(const tab of ['look','layout','courses','pet','settings']){
  const html=f.render(tab);
  assert.deepEqual(pane(html),[tab]);
  assert.match(html,new RegExp('data-value="'+tab+'" aria-selected="true"'));
 }
 for(const [from,to] of [[undefined,'look'],['all','look'],['art','courses'],['missing','look']]){
  assert.deepEqual(pane(f.render(from)),[to]);
 }
 assert.doesNotMatch(f.render('settings'),/data-pane="(?:features|preferences|all|art)"/);
});

// Adapted from course-dock-settings.test.cjs.
test('Home has the intended group order, dock size and only one switch caution',()=>{
 const f=editor();
 f.s.courseNavigation='dock';
 const html=f.render('layout');
 assert.deepEqual(headings(html),[
  'Start from a layout','Modules on Home','Order of the three panels',
  'Where your courses are','Course size','Spacing','What shows',
  'Canvas’s menu bar','Saved layouts & plans'
 ]);
 assert.match(html,/data-setting="dockSize"/);
 assert.match(html,/data-setting="quickOpen"/);
 assert.equal((html.match(/<small>/g)||[]).length,1);
 assert.match(html,/Leave this off on a shared computer/);
 assert.doesNotMatch(html,/class="cz-hint"|To move a module|<small>Course news/);
 assert.doesNotMatch(html,/data-rd-action="layout-reset"/);
 f.s.courseNavigation='sidebar';
 assert.doesNotMatch(f.render('layout'),/data-setting="dockSize"/);
});

// Adapted from cleanup-look.test.cjs.
test('Look ends with saved looks; unlocked descriptions and old course-frame controls are absent',()=>{
 const f=editor(),look=f.render('look');
 assert.deepEqual(headings(look).slice(-2),['Motion','Saved looks']);
 assert.doesNotMatch(look,/data-setting="courseCardStyle"|class="cz-hint"/);
 assert.match(look,/data-setting="livingArt"/);
 assert.doesNotMatch(look,/<small>/);
 f.s.sceneTheme='stars';
 assert.doesNotMatch(f.render('look'),/<small>/,'locked scene themes have no non-level explanatory hints');
});

// Adapted from customization.test.cjs and media-banners-panel.test.cjs.
test('Courses keeps the list, size, card frames and the former Artwork controls together',()=>{
 const f=editor();
 f.c.customizeDrafts={'10:icon':'<svg>Editable draft</svg>'};
 f.c.s.coursePrefs['10']={bannerFit:'cover',bannerPosition:'left'};
 const html=f.render('courses');
 const groups=headings(html);
 assert.deepEqual(groups.slice(0,3),['Course list','Banner','Course cards']);
 assert.match(html,/id="ch-art-title">Course artwork/);
 assert.equal((html.match(/class="ch-course-setting"/g)||[]).length,2);
 assert.equal((html.match(/class="ch-art-slot"/g)||[]).length,4);
 assert.match(html,/data-setting="bannerSize"/);
 assert.match(html,/data-setting="courseCardStyle"/);
 assert.match(html,/value="cover" selected/);
 assert.match(html,/value="left" selected/);
 assert.match(html,/Editable draft/);
 assert.match(html,/>Artwork skill<\/a>/);
 assert.doesNotMatch(html,/No pack yet\?|One pack for banners|Give your AI/);
 f.c.allCourses[0]={...f.c.allCourses[0],name:'Renamed Biology',color:'#987654'};
 assert.match(f.render('courses'),/value="Renamed Biology"/);
 assert.match(f.render('courses'),/value="#987654"/);
});

// Adapted from course-dock-settings.test.cjs feature-gate checks.
test('disabled course artwork still leaves the course list editable',()=>{
 const f=editor();
 f.env.ReserveFeatures={enabled:feature=>feature!=='course-art'};
 const html=f.render('courses');
 assert.deepEqual(pane(html),['courses']);
 assert.match(html,/Course list/);
 assert.equal((html.match(/class="ch-course-setting"/g)||[]).length,2);
 assert.doesNotMatch(html,/data-setting="bannerSize"|class="ch-art-slot"/);
 f.env.ReserveFeatures={enabled:()=>false};
 assert.equal(f.render('courses'),'');
});

// Adapted from installed-controls.test.cjs.
test('saved looks, layouts and routines are grouped by their validated preset kind',()=>{
 const f=editor();
 const variants={paint:'settings',page:'layout',week:'planner',habits:'routines'};
 f.s.makeYourOwn.installed={...Object.fromEntries(Object.keys(variants).map(id=>[id,{id,name:id,kind:'preset'}])),
  paintedTheme:{id:'paintedTheme',name:'Theme pack',kind:'theme'},
  chosenPet:{id:'chosenPet',name:'Companion pack',kind:'pet'}};
 f.c.makeOwn.presetKinds=variants;
 for(const [tab,allowed]of [
  ['look',['paint','paintedTheme']],['layout',['page','week']],['pet',['habits','chosenPet']]
 ]){
  const html=f.render(tab);
  for(const name of Object.keys(f.s.makeYourOwn.installed)){
   const contains=html.includes('data-id="'+name+'"');
   assert.equal(contains,allowed.includes(name),tab+' includes '+name);
  }
 }
 f.c.personal.pet={routines:[{id:'routine-7',name:'Morning review',createdAt:1,minute:480,days:[1,2,3,4,5],action:'plan',data:{mode:'tonight'}}]};
 const pet=f.render('pet');
 assert.equal(headings(pet).at(-1),'Saved routines');
 assert.match(pet,/data-rd-action="pet-routine-remove"/);
 assert.match(pet,/Morning review/);
 assert.match(pet,/Level \d+/);
 assert.doesNotMatch(pet,/class="cz-hint"/);
});

// Adapted from personal-settings-dock.test.cjs and installed-controls.test.cjs.
test('More owns file import and Start over; pending local review follows tab switches',()=>{
 const f=editor();
 const more=f.render('settings');
 assert.match(more,/data-rd-field="make-file"/);
 assert.match(more,/Add from a file/);
 assert.match(more,/data-rd-action="layout-reset"/);
 assert.deepEqual(headings(more),['Start over']);
 for(const tab of ['look','layout','courses','pet'])assert.doesNotMatch(f.render(tab),/data-rd-field="make-file"/);
 f.c.makeOwn.draft={pack:{format:'chpreset',kind:'settings',name:'Saved preview'}};
 assert.match(f.render('look'),/Saved preview/);
 assert.match(f.render('courses'),/data-rd-action="make-cancel"/);
 assert.match(f.render('settings'),/Saved preview/);
 assert.doesNotMatch(more,/features-pane|preferencesPane|data-pane="features"/);
});

// Adapted from installed-controls.test.cjs: local saved-pack metadata is loaded
// through the public pack reader, without copying private catalogue controls.
test('saved preset categories resolve from the public pack reader',async()=>{
 const f=editor();
 const installed={themeA:{id:'themeA',name:'Theme',kind:'theme'},lookA:{id:'lookA',name:'Saved look',kind:'preset'}};
 const store={get:()=>({settings:{makeYourOwn:{theme:installed.themeA,pet:null,installed}}}),subscribe:()=>()=>{}};
 f.env.ReservePacks={readLocal:async id=>({pack:{kind:id==='lookA'?'settings':'theme',name:id}})};
 const state=f.env.ReserveMakeYourOwn.create({store,onChange(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(state.state.presetKinds.lookA,'settings');
 assert.equal(state.state.theme.kind,'theme');
 state.destroy();
});

test('a missing saved preset does not prevent an active theme from loading',async()=>{
 const f=editor();
 const installed={missing:{id:'missing',name:'Missing saved look',kind:'preset'}};
 const store={get:()=>({settings:{makeYourOwn:{theme:{id:'themeA'},pet:null,installed}}}),subscribe:()=>()=>{}};
 f.env.ReservePacks={readLocal:async id=>{
  if(id==='missing')throw Error('File no longer exists');
  return {pack:{kind:'theme',name:'Working theme'}};
 }};
 const state=f.env.ReserveMakeYourOwn.create({store,onChange(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(state.state.theme.name,'Working theme');
 assert.deepEqual(Object.keys(state.state.presetKinds),[]);
 state.destroy();
});

// Adapted from personal-settings-dock.test.cjs.
test('public setting keys route to the pane that owns their controls',()=>{
 const {env}=editor(),tabFor=env.ReserveCustomizeUI.tabFor;
 for(const [key,want]of [
  ['density','layout'],['dockSize','layout'],['canvasNav','layout'],['bannerSize','courses'],
  ['courseCardStyle','courses'],['pet.nudges','pet'],['pet.enabled','pet'],['theme','look'],['readingFont','look'],['unrecognized','look']
 ])assert.equal(tabFor(key),want,key);
});

test('settings title leaves no default heading margin',()=>{assert.match(read('settings-dock.css'),/\.rd \.ch-settings-dock \.rd-section-heading h2 \{ font-size:23px; margin:0; \}/);});

test('More resets appearance without changing notes or course artwork',async t=>{
 const {fixture}=require('./dashboard-heading-fixture.cjs'),h=fixture();t.after(()=>h.dashboard.destroy());const data=h.store.get();data.tasks={'42':{notes:'Keep this note'}};data.settings.coursePrefs={'10':{name:'Keep this course',iconArt:{name:'Keep art'}}};Object.assign(data.settings,{theme:'dark',accent:'ocean',density:'compact',font:'serif'});
 const button=h.document.createElement('button');button.setAttribute('data-rd-action','reset-appearance');h.container.append(button);h.click('reset-appearance');await Promise.resolve();h.tick(25);
 assert.equal(data.settings.theme,'light');assert.equal(data.settings.accent,'clay');assert.equal(data.settings.density,'comfortable');assert.equal(data.settings.font,'system');assert.equal(data.tasks['42'].notes,'Keep this note');assert.equal(data.settings.coursePrefs['10'].iconArt.name,'Keep art');
});

test('the dashboard opens Look first and reopens its last selected settings tab',t=>{
 const {fixture}=require('./dashboard-heading-fixture.cjs'),h=fixture({setup({env}){for(const file of ['workspace-arrange.js','customization-model.js','settings-dock.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});}});t.after(()=>h.dashboard.destroy());
 h.click('settings');assert.equal(h.container.querySelector('.cz-pane').dataset.pane,'look');h.container.querySelector('[data-rd-action="customize-tab"][data-value="settings"]').click();assert.equal(h.container.querySelector('.cz-pane').dataset.pane,'settings');assert.ok(h.container.querySelector('[data-rd-action="reset-appearance"]'));h.click('settings-close');h.click('settings');assert.equal(h.container.querySelector('.cz-pane').dataset.pane,'settings');
});

test('a pack picked from More opens Courses with its review or read error visible',async t=>{
 let own;const {fixture}=require('./dashboard-heading-fixture.cjs'),h=fixture({setup({env}){for(const file of ['workspace-arrange.js','customization-model.js','custom-art.js','quick-upload-ui.js','make-your-own.js','settings-dock.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});env.CanvasHarnessQuickUpload={create:()=>({state:{},destroy(){}})};const create=env.ReserveMakeYourOwn.create;env.ReserveMakeYourOwn.create=options=>(own=create(options));}});t.after(()=>h.dashboard.destroy());
 h.click('settings');h.container.querySelector('[data-rd-action="customize-tab"][data-value="settings"]').click();await own.choose({name:'Picked.chpack',size:10,text:async()=>{throw Error('Unreadable picked pack');}});
 assert.equal(h.container.querySelector('.cz-pane').dataset.pane,'courses');assert.match(h.container.textContent,/Picked.chpack/);assert.match(h.container.textContent,/Unreadable picked pack/);
});
