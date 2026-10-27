'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture:dashboardFixture}=require('./dashboard-heading-fixture.cjs');
const load=(env,...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),env,{filename:file});};

function editor(){
 const work={previews:[],frames:0,archives:0},env=vm.createContext({console,TextEncoder});
 load(env,'workspace-arrange.js','customization-model.js','custom-art.js','course-art.js','pet-art.js','pony-brain.js','pets.js','quick-upload-ui.js','settings-dock.js','customize-ui.js');
 for(const [name,methods]of [['ReserveCourseArt',['scene','mini','frame','title']],['ReservePetArt',['svg']],['CanvasHarnessQuickUploadUI',['render']]]){
  const owner=env[name]={...env[name]};
  for(const method of methods){const original=owner[method];owner[method]=function(...args){work.previews.push(method);return original.apply(this,args);};}
 }
 env.ReserveWidgets={get FRAMES(){work.frames++;return [['pen','Pen','Drawn outline']];}};
 const courses=[{id:'10',name:'Chemistry',color:'#123456'},{id:'20',name:'History',color:'#654321'}];
 const coursePrefs=new Proxy({'999':{name:'Archived',iconArt:{name:'old.svg'}}},{ownKeys(target){work.archives++;return Reflect.ownKeys(target);}});
 const context={s:{theme:'light',accent:'clay',coursePrefs},allCourses:courses,courses,customizeCourseId:'10',customizeOpen:false,customizeTab:'look',personal:{pet:{}}};
 return {env,context,work,render:()=>env.ReserveCustomizeUI.render(context),reset(){work.previews.length=0;work.frames=work.archives=0;}};
}

test('closed appearance renders an inert constant-size shell without inspecting pane data',()=>{
 const f=editor(),reads=[];
 for(const key of ['s','allCourses','courses','customizeCourseId','customizeTab','personal','customKits','customizeDrafts']){
  Object.defineProperty(f.context,key,{get(){reads.push(key);throw Error('Closed pane read '+key);}});
 }
 const html=f.render();assert.match(html,/data-open="false"/);assert.match(html,/inert aria-hidden="true"/);
 assert.doesNotMatch(html,/<(?:input|select|textarea|button|svg|img)\b|class="cz-pane"/);
 assert.deepEqual(reads,[]);assert.deepEqual(f.work,{previews:[],frames:0,archives:0});assert.ok(Buffer.byteLength(html)<1000);
});

test('named appearance panes build only their own previews and collection-dependent controls',()=>{
 const f=editor();f.context.customizeOpen=true;
 for(const tab of ['look','layout','courses','pet','settings']){
  f.reset();f.context.customizeTab=tab;const html=f.render();
  assert.deepEqual([...html.matchAll(/class="cz-pane" data-pane="([^"]+)"/g)].map(match=>match[1]),[tab]);
  assert.equal(f.work.archives,tab==='courses'?1:0);assert.equal(f.work.frames,tab==='look'?1:0);
  assert.equal((html.match(/class="ch-art-slot"/g)||[]).length,tab==='courses'?4:0);
  assert.equal((html.match(/class="ch-course-setting"/g)||[]).length,tab==='courses'?2:0);
  assert.deepEqual(f.work.previews,tab==='courses'?['render','scene','mini','frame','title']:tab==='pet'?['svg']:[]);
  if(tab==='pet'){assert.equal((html.match(/class="pet cz-pony"/g)||[]).length,12);assert.equal((html.match(/data-rd-field="pet-skill"/g)||[]).length,7);assert.match(html,/class="cz-toggles cz-checks"/);}
 }
 for(const tab of [undefined,'all']){f.context.customizeTab=tab;assert.equal((f.render().match(/class="cz-pane"/g)||[]).length,1);}
 f.context.customizeTab='missing';assert.match(f.render(),/class="cz-pane" data-pane="look"/);
});

test('drawn settings label each section and align three named type rows',()=>{
 const f=editor();f.context.customizeOpen=true;const html=f.render(),type=html.match(/<section class="cz-group" data-art="Type">([\s\S]*?)<\/section>/)?.[1];
 assert.ok(type);assert.deepEqual([...type.matchAll(/<h4 class="cz-subhead">([^<]+)<\/h4>/g)].map(m=>m[1]),['Letters','Size','Reading text']);assert.equal((type.match(/--cz-cols:3/g)||[]).length,3);assert.match(type,/>Standard<\/strong>/);assert.match(type,/>Same as letters<\/strong>/);
 assert.equal((html.match(/<section class="cz-group">/g)||[]).length,0);
 f.context.customizeTab='layout';f.context.s.courseNavigation='dock';assert.match(f.render(),/data-art="Course dock"/);assert.doesNotMatch(f.render(),/data-art="Course size"/);
});

test('lazy appearance panes retain current course edits, SVG drafts and quick-pack controls',()=>{
 const f=editor();f.context.customizeOpen=true;f.context.customizeTab='art';
 f.context.customizeDrafts={'10:icon':'<svg>Current draft</svg>'};
 const first=f.render();assert.match(first,/Current draft/);assert.ok(f.work.previews.includes('render'),'the restored quick-pack renderer still runs for Artwork');
 f.context.customizeTab='look';f.render();f.context.s.coursePrefs['10']={name:'Renamed chemistry',color:'#abcdef'};f.context.allCourses[0]={...f.context.allCourses[0],name:'Renamed chemistry',color:'#abcdef'};
 f.context.customizeTab='courses';const courses=f.render();assert.match(courses,/value="Renamed chemistry"/);assert.match(courses,/value="#abcdef"/);
 f.context.customizeTab='art';assert.match(f.render(),/Current draft/);
});

test('appearance feature gates prevent disabled docks and hidden artwork or pony work',()=>{
 const f=editor();f.context.customizeOpen=true;f.context.customizeTab='art';
 f.env.ReserveFeatures={enabled:id=>!['course-art','pony'].includes(id)};f.reset();const html=f.render();
 assert.doesNotMatch(html,/data-pane="(?:art|pet)"|data-value="(?:art|pet)"/);assert.deepEqual(f.work.previews,[]);
 f.env.ReserveFeatures={enabled:()=>false};assert.equal(f.render(),'');assert.equal(f.env.ReserveCustomizeUI.createDock({}),null);assert.equal(f.env.ReserveSettingsDock.createDock({}),null);
});

function transitionDashboard({duration=340,reduced=false,motion='gentle'}={}){
 const mediaListeners=new Set();let reduce=reduced;
 const f=dashboardFixture({setup:({env,store})=>{
  store.get().settings.motion=motion;
  env.matchMedia=query=>({get matches(){return query.includes('prefers-reduced-motion')&&reduce;},addEventListener(type,fn){if(query.includes('prefers-reduced-motion'))mediaListeners.add(fn);},removeEventListener(type,fn){if(query.includes('prefers-reduced-motion'))mediaListeners.delete(fn);}});
  const computed=env.getComputedStyle;
  env.getComputedStyle=node=>node.classList.contains('ch-settings-dock')?{transitionProperty:'opacity, visibility',transitionDuration:duration/1000+'s, 0s',transitionDelay:'0ms, '+duration+'ms'}:computed(node);
  load(env,'workspace-arrange.js','customization-model.js','settings-dock.js','customize-ui.js');
 }});
 return {...f,dock:()=>f.container.querySelector('.ch-settings-dock'),mediaListeners,reduce(){reduce=true;for(const fn of [...mediaListeners])fn({matches:true});}};
}

const openHome=f=>{f.click('settings');f.container.querySelector('[data-rd-action="customize-tab"][data-value="layout"]').click();};

test('closing keeps the actual outgoing controls for the transition, then releases them',t=>{
 const f=transitionDashboard();t.after(()=>f.dashboard.destroy());
 assert.equal(f.container.querySelector('.cz-pane'),null);openHome(f);
 const section=f.dock().querySelector('.rd-customize'),control=section.querySelector('[data-setting="density"]');assert.ok(control);
 f.click('settings-close');assert.ok(f.dock().querySelector('.rd-customize')===section,'closing retains the outgoing controls');assert.equal(f.dock().inert,true);
 f.dashboard.setStatus('Background update');assert.ok(f.dock().querySelector('[data-setting="density"]')===control,'background updates retain the outgoing input');
 f.tick(339);assert.ok(control.isConnected);f.tick(1);assert.equal(control.isConnected,false);assert.equal(f.dock().querySelector('.cz-pane'),null);
});

for(const [name,options]of [['off',{motion:'off'}],['reduced',{reduced:true}],['zero duration',{duration:0}]])test(name+' clears closed appearance controls immediately',t=>{
 const f=transitionDashboard(options);t.after(()=>f.dashboard.destroy());openHome(f);
 const control=f.dock().querySelector('[data-setting="density"]');f.click('settings-close');assert.equal(control.isConnected,false);
});

test('rapid reopening cancels close cleanup and reduced motion and destroy release resources',t=>{
 const f=transitionDashboard();t.after(()=>f.dashboard.destroy());openHome(f);f.click('settings-close');f.tick(100);openHome(f);
 const control=f.dock().querySelector('[data-setting="density"]');f.tick(240);assert.ok(control.isConnected);
 f.click('settings-close');f.tick(100);f.reduce();assert.equal(control.isConnected,false);
 openHome(f);f.dashboard.destroy();assert.equal(f.mediaListeners.size,0);assert.equal([...f.timers.values()].filter(timer=>timer.delay===340).length,0);
});

test('disabling the motion feature clears outgoing settings immediately',t=>{
 const f=transitionDashboard();t.after(()=>f.dashboard.destroy());openHome(f);const control=f.dock().querySelector('[data-setting="density"]');
 f.env.ReserveFeatures={enabled:id=>id!=='motion'};f.click('settings-close');assert.equal(control.isConnected,false);assert.equal([...f.timers.values()].filter(timer=>timer.delay===340).length,0);
});
