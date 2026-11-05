'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createDOM}=require('./addons-fixture.cjs');
const {fixture:dashboardFixture}=require('./dashboard-heading-fixture.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const load=(env,...files)=>{for(const file of files)vm.runInContext(read(file),env,{filename:file});};
const paneNames=['look','layout','courses','pet','settings'];
const documentFor=html=>createDOM('<html><body>'+html+'</body></html>');
const shownPanes=document=>document.querySelectorAll('.cz-pane').filter(node=>!node.hidden).map(node=>node.dataset.pane);

function editor(){
 const work={previews:[],posters:[],frames:0,archivedScans:0,features:0},env=vm.createContext({console,TextEncoder});
 env.chrome={runtime:{getURL(file){work.posters.push(file);return 'chrome-extension://fixture/'+file;}}};
 load(env,'workspace-arrange.js','customization-model.js','custom-art.js','course-art.js','study-kind.js','pony-brain.js','pet-art.js','pets.js','quick-upload-ui.js','settings-dock.js','customize-ui.js');
 for(const [name,methods]of [['ReserveCourseArt',['scene','mini','frame','title']],['ReserveCustomArt',['render']],['ReservePetArt',['svg','drawing']],['CanvasHarnessQuickUploadUI',['render']]]){
  const owner=env[name]={...env[name]};
  for(const method of methods){const original=owner[method];owner[method]=function(...args){work.previews.push(method);return original.apply(this,args);};}
 }
 const featuresPane=env.ReserveSettingsDock.featuresPane;
 env.ReserveSettingsDock.featuresPane=tab=>{work.features++;return featuresPane(tab);};
 env.ReserveWidgets={get FRAMES(){work.frames++;return [['pen','Pen','Drawn outline']];}};
 const courses=[{id:'10',name:'Chemistry',color:'#123456'},{id:'20',name:'History',color:'#654321'}];
 const coursePrefs=new Proxy({'999':{name:'Archived course',iconArt:{name:'old.svg'}}},{ownKeys(target){work.archivedScans++;return Reflect.ownKeys(target);}});
 const context={s:{theme:'light',accent:'clay',coursePrefs},allCourses:courses,courses,customizeCourseId:'10',customizeOpen:false,customizeTab:'look',personal:{pet:{name:'Biscuit'}}};
 const reset=()=>{work.previews.length=0;work.posters.length=0;work.frames=0;work.archivedScans=0;work.features=0;};
 return {env,context,work,reset,render:()=>env.ReserveCustomizeUI.render(context)};
}

test('closed customization renders only its inert shell without reading pane data or building controls',t=>{
 const f=editor(),reads=[];
 for(const key of ['s','allCourses','courses','customizeCourseId','customizeTab','personal','customKits','customizeDrafts']){
  const value=f.context[key];Object.defineProperty(f.context,key,{get(){reads.push(key);return value;},configurable:true});
 }
 const html=f.render(),document=documentFor(html),dock=document.querySelector('.rd-appearance'),panel=document.querySelector('#rd-appearance-panel');
 t.diagnostic(JSON.stringify({state:'closed',bytes:Buffer.byteLength(html),panes:document.querySelectorAll('.cz-pane').length,controls:document.querySelectorAll('input,select,textarea,button').length,courseRows:document.querySelectorAll('.ch-course-setting').length,previews:f.work.previews.length,posters:f.work.posters.length,archivedScans:f.work.archivedScans,frames:f.work.frames}));
 assert.equal(dock.dataset.open,'false');
 for(const node of [dock,panel]){assert.ok(node.hasAttribute('inert'));assert.equal(node.getAttribute('aria-hidden'),'true');}
 assert.equal(document.querySelectorAll('.cz-pane').length,0,'closed rendering must not build even hidden panes');
 assert.equal(document.querySelectorAll('input,select,textarea,button,svg,img,video,.ch-art-preview,.ch-course-setting').length,0);
 assert.deepEqual(reads,[],'closed rendering does not inspect settings, courses, drafts, kits or the selected tab');
 assert.deepEqual(f.work,{previews:[],posters:[],frames:0,archivedScans:0,features:0});
 assert.ok(Buffer.byteLength(html)<1000,'shell size stays independent of the course and artwork collections');
});

test('closed shell stays identical for every selected tab and large course and archive collections',()=>{
 const f=editor(),shell=f.render();
 f.context.allCourses=Array.from({length:500},(_,i)=>({id:String(i),name:'Course '+i,color:'#123456'}));
 f.context.courses=f.context.allCourses;
 f.context.s.coursePrefs=Object.fromEntries(Array.from({length:500},(_,i)=>['archived-'+i,{name:'Old '+i,iconArt:{name:'old.svg'}}]));
 for(const customizeTab of [undefined,'all','art','features',...paneNames,'unavailable']){
  f.context.customizeTab=customizeTab;
  assert.ok(f.render()===shell,'a closed '+customizeTab+' selection must not add collection-dependent markup');
 }
});

test('opening and switching named tabs builds only the selected content and its own previews',()=>{
 const f=editor();f.context.customizeOpen=true;
 for(const tab of paneNames){
  f.reset();f.context.customizeTab=tab;
  const document=documentFor(f.render());
  assert.deepEqual(shownPanes(document),tab==='settings'?['features','settings']:[tab]);
  assert.equal(document.querySelector('.cz-tab[aria-selected="true"]').dataset.value,tab);
  assert.deepEqual(document.querySelectorAll('.cz-tab').map(node=>[node.dataset.value,node.textContent]),[['look','Look'],['layout','Home'],['courses','Courses'],['pet','Companion'],['settings','More']]);
  assert.equal(document.querySelectorAll('.cz-pane').length,2,'only the selected pane and persistent Features anchor are built');
  assert.equal(document.querySelector('[data-pane="features"]').hidden,tab!=='settings');assert.equal(f.work.features,1);
  assert.equal(document.querySelectorAll('.ch-course-setting').length,tab==='courses'?2:0);
  assert.equal(document.querySelectorAll('.ch-art-slot').length,tab==='courses'?4:0);
  assert.equal(document.querySelectorAll('[data-rd-action="art-template"]').length,tab==='courses'?4:0);
  for(const key of ['bannerSize','courseCardStyle'])assert.equal(document.querySelectorAll('input[data-setting="'+key+'"]').length,tab==='courses'?3:0);
  assert.equal(document.querySelectorAll('[data-rd-field="pet"][data-key="name"]').length,tab==='pet'?1:0);
  if(tab==='pet'){const locked=document.querySelectorAll('.cz-choice[data-locked="true"]');assert.ok(locked.length);for(const choice of document.querySelectorAll('.cz-choice')){if(choice.dataset.locked==='true'){assert.equal(choice.querySelector('input').disabled,true);assert.match(choice.querySelector('small').textContent,/^Level \d+$/);}else assert.equal(choice.querySelector('small'),null);}assert.equal(document.querySelector('[data-pane="pet"]').querySelectorAll('h3').at(-1).textContent,'Saved routines');}
  assert.equal(f.work.archivedScans,tab==='courses'?1:0,'only Courses scans archived course preferences');
  assert.equal(f.work.frames,tab==='look'?1:0,'only Look builds module frame choices');
  assert.equal(f.work.posters.length,tab==='look'?4:0,'only Look resolves scene posters');
  assert.deepEqual(f.work.previews,tab==='courses'?['render','scene','mini','frame','title']:tab==='pet'?['drawing','drawing','svg']:[]);
 }
});

test('open defaults, legacy aliases and unavailable tabs select only their destination panes',()=>{
 const f=editor();f.context.customizeOpen=true;
 for(const tab of [undefined,'all']){
  f.context.customizeTab=tab;
  const document=documentFor(f.render());
  assert.deepEqual(shownPanes(document),['look']);
  assert.equal(document.querySelector('.cz-tab[aria-selected="true"]').dataset.value,'look');
  assert.equal(document.querySelectorAll('.ch-course-setting,.ch-art-slot').length,0);
 }
 for(const [legacy,tab]of [['art','courses'],['features','settings']]){f.context.customizeTab=legacy;const document=documentFor(f.render());assert.deepEqual(shownPanes(document),tab==='settings'?['features','settings']:[tab]);assert.equal(document.querySelector('.cz-tab[aria-selected="true"]').dataset.value,tab);}
 f.context.customizeTab='missing';
 assert.deepEqual(shownPanes(documentFor(f.render())),['look'],'unavailable named tabs fall back to Look');
});

test('switching and reopening use current course artwork, drafts, kit state and appearance without changing data',()=>{
 const f=editor(),asset=f.env.ReserveCustomArt.importSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M0 0L20 20"/></svg>','latest.svg');
 f.context.customizeOpen=true;f.context.customizeTab='courses';
 f.render();
 f.context.customizeOpen=false;f.render();
 f.context.customizeCourseId='20';f.context.customizeDrafts={'20:icon':'<svg>Current draft & text</svg>'};
 f.context.kitName='Current kit';f.context.customKits=[{id:'latest-kit',name:'Latest kit'}];
 f.context.s={theme:'dark',accent:'forest',nightArt:70,coursePrefs:{'20':{bannerArt:asset,bannerFit:'cover',bannerPosition:'left',titlePlacement:'banner'}}};
 f.context.customizeOpen=true;
 const before=JSON.stringify(f.context),document=documentFor(f.render());
 assert.equal(document.querySelector('[data-rd-field="customize-course"] option[selected]').value,'20');
 assert.equal(document.querySelector('[data-setting="bannerFit"] option[selected]').value,'cover');
 assert.equal(document.querySelector('[data-setting="bannerPosition"] option[selected]').value,'left');
 assert.equal(document.querySelector('[data-setting="titlePlacement"] option[selected]').value,'banner');
 assert.equal(document.querySelector('textarea[data-course="20"][data-kind="icon"]').textContent,'<svg>Current draft & text</svg>');
 assert.equal(document.querySelector('[data-rd-field="kit-name"]').value,'Current kit');
 assert.equal(document.querySelector('[data-rd-action="kit-use"]').dataset.kit,'latest-kit');
 assert.equal(document.querySelector('[data-rd-action="kit-use"]').dataset.id,'20');
 assert.equal(document.querySelector('[data-rd-action="art-remove"]').dataset.id,'20');
 assert.match(document.querySelector('.ch-art-caption').textContent,/latest.svg/);
 assert.equal(JSON.stringify(f.context),before);
 f.context.customizeTab='look';
 const look=documentFor(f.render());
 assert.equal(look.querySelector('input[data-setting="theme"][checked]').value,'dark');
 assert.equal(look.querySelector('[data-accent="forest"]').getAttribute('aria-pressed'),'true');
 assert.equal(look.querySelector('[data-setting="nightArt"]').value,'70');
 f.context.customizeTab='courses';
 f.context.allCourses=[{id:'20',name:'Renamed history',color:'#abcdef'},{id:'10',name:'Chemistry',color:'#123456'}];f.context.courses=[f.context.allCourses[0]];
 const courses=documentFor(f.render());
 assert.equal(courses.querySelector('[data-rd-field="course-name"]').value,'Renamed history');
 assert.equal(courses.querySelector('[data-rd-field="course-color"]').value,'#abcdef');
 assert.equal(courses.querySelector('[data-rd-field="course-visible"][data-id="20"]').checked,true);
 assert.equal(courses.querySelector('[data-rd-field="course-visible"][data-id="10"]').checked,false);
 assert.equal(courses.querySelector('[data-rd-action="course-up"][data-id="20"]').disabled,true);
});

test('real dashboard handlers rebuild selected panes and save current course edits across close and reopen',async t=>{
 const renders=[],f=dashboardFixture({setup:({env})=>{
  load(env,'workspace-arrange.js','customization-model.js','custom-art.js','settings-dock.js','customize-ui.js');
  const render=env.ReserveCustomizeUI.render;
  env.ReserveCustomizeUI.render=c=>{const html=render(c);renders.push({open:c.customizeOpen,tab:c.customizeTab,html});return html;};
 }});t.after(()=>f.dashboard.destroy());
 const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();f.tick(20);};
 const rendered=()=>documentFor(renders.at(-1).html);
 const tab=name=>{const button=f.container.querySelector('[data-rd-action="customize-tab"][data-value="'+name+'"]');assert.ok(button);button.click();};
 const change=(selector,value)=>{const target=f.container.querySelector(selector);assert.ok(target,'current pane has '+selector);target.value=value;f.container.events.get('change')({target});};
 assert.ok(!f.container.querySelector('.cz-pane'),'initially closed dashboard contains no customization panes');
 f.click('settings');tab('courses');
 change('[data-rd-field="course-name"][data-id="20"]','My current history');await settle();
 assert.equal(f.store.get().settings.coursePrefs['20'].name,'My current history');
 assert.equal(f.container.querySelector('[data-rd-field="course-name"][data-id="20"]').value,'My current history');
 tab('courses');change('[data-rd-field="customize-course"]','20');
 const draft=f.container.querySelector('textarea[data-kind="icon"]');draft.value='<svg>keep this draft</svg>';f.container.events.get('input')({target:draft});
 tab('look');
 change('[data-setting="theme"][value="dark"]','dark');await settle();
 assert.equal(f.store.get().settings.theme,'dark');
 tab('courses');
 // This DOM fixture does not initialize textarea.value from its parsed text;
 // inspect the real renderer's output for the draft supplied by the handler.
 assert.equal(rendered().querySelector('textarea[data-course="20"][data-kind="icon"]').textContent,'<svg>keep this draft</svg>');
 change('[data-setting="bannerPosition"]','left');await settle();
 assert.equal(f.store.get().settings.coursePrefs['20'].bannerPosition,'left');
 assert.equal(f.store.get().settings.coursePrefs['10'],undefined,'handlers keep changes on the current editor course');
 f.click('settings-close');f.dashboard.setStatus('Background refresh while settings are closed');
 assert.ok(!f.container.querySelector('.cz-pane'),'closing removes customization panes');
 assert.ok(!f.container.querySelector('[data-rd-field="course-name"]'),'closing removes course controls');
 f.click('settings');
 assert.deepEqual(shownPanes(f.container),['courses']);
 // Opening still targets the dashboard course, as the existing onOpen handler specifies.
 assert.ok(f.container.querySelector('textarea[data-course="10"][data-kind="icon"]'));
 change('[data-rd-field="customize-course"]','20');
 assert.equal(rendered().querySelector('textarea[data-course="20"][data-kind="icon"]').textContent,'<svg>keep this draft</svg>');
 for(const render of renders.filter(render=>!render.open)){
  assert.equal(documentFor(render.html).querySelectorAll('.cz-pane,input,select,textarea,button,svg,img').length,0);
 }
});

function transitionDashboard({duration=340,reduced=false,motion='gentle'}={}){
 const renders=[],mediaListeners=new Set();let reduce=reduced;
 const f=dashboardFixture({setup:({env,store})=>{
  store.get().settings.motion=motion;
  env.matchMedia=query=>({get matches(){return query.includes('prefers-reduced-motion')&&reduce;},addEventListener(type,fn){if(query.includes('prefers-reduced-motion'))mediaListeners.add(fn);},removeEventListener(type,fn){mediaListeners.delete(fn);}});
  const computed=env.getComputedStyle;
  env.getComputedStyle=node=>node.classList.contains('ch-settings-dock')?{transitionProperty:'opacity, visibility',transitionDuration:duration/1000+'s, 0s',transitionDelay:'0ms, '+duration+'ms'}:computed(node);
  load(env,'workspace-arrange.js','customization-model.js','settings-dock.js','customize-ui.js');
  const render=env.ReserveCustomizeUI.render;
  env.ReserveCustomizeUI.render=c=>{const html=render(c);renders.push({open:c.customizeOpen,html});return html;};
 }});
 const dock=()=>f.container.querySelector('.ch-settings-dock');
 return {...f,renders,dock,reduce(){reduce=true;for(const fn of [...mediaListeners])fn({matches:true});},mediaListeners};
}

const openHome=f=>{f.click('settings');f.container.querySelector('[data-rd-action="customize-tab"][data-value="layout"]').click();};

for(const [name,duration,motion]of [['desktop',340,'gentle'],['narrow',190,'gentle'],['still',180,'still']])test(name+' close keeps the live section through its CSS transition without constructing closed panes',t=>{
 const f=transitionDashboard({duration,motion});t.after(()=>f.dashboard.destroy());
 openHome(f);
 const section=f.dock().querySelector('.rd-customize'),control=section.querySelector('[data-setting="density"]'),features=section.querySelector('#features-panel');
 assert.ok(control,'Home builds the density control retained during close');
 assert.ok(features,'first open initializes the feature ownership subtree');
 f.click('settings-close');
 assert.strictEqual(f.dock().querySelector('.rd-customize'),section);
 assert.strictEqual(f.dock().querySelector('[data-setting="density"]'),control,'outgoing controls retain their actual nodes');
 assert.equal(f.dock().inert,true);
 f.dashboard.setStatus('Closed background update');
 assert.strictEqual(f.dock().querySelector('[data-setting="density"]'),control,'closed background renders retain outgoing content');
 f.tick(duration-1);assert.ok(control.isConnected,'content remains for the full existing transition');
 f.tick(1);assert.equal(control.isConnected,false,'content clears when the transition ends');
 assert.equal(f.dock().querySelectorAll('.cz-pane').length,0);
 assert.strictEqual(f.dock().querySelector('#features-panel'),features,'the Features controller keeps its ownership anchor');
 for(const render of f.renders.filter(render=>!render.open))assert.equal(documentFor(render.html).querySelectorAll('.cz-pane,input,select,textarea,button,svg,img').length,0);
});

for(const [name,options]of [['off',{motion:'off'}],['reduced',{reduced:true}],['zero-duration',{duration:0}]])test(name+' close clears outgoing controls immediately without a transition timer',t=>{
 const f=transitionDashboard(options);t.after(()=>f.dashboard.destroy());
 openHome(f);const control=f.dock().querySelector('[data-setting="density"]');f.click('settings-close');
 assert.equal(control.isConnected,false);
 assert.equal(f.dock().querySelectorAll('.cz-pane').length,0);
 assert.equal([...f.timers.values()].filter(timer=>timer.delay===340).length,0);
});

test('rapid reopen cancels cleanup and later close/destroy release their timers and outgoing nodes',t=>{
 const f=transitionDashboard();t.after(()=>f.dashboard.destroy());
 openHome(f);const features=f.dock().querySelector('#features-panel');f.click('settings-close');f.tick(100);
 openHome(f);const control=f.dock().querySelector('[data-setting="density"]');f.tick(240);
 assert.ok(control.isConnected,'the first close deadline cannot clear a reopened editor');
 assert.strictEqual(f.dock().querySelector('#features-panel'),features);
 f.click('settings-close');f.tick(100);assert.ok(control.isConnected);
 f.dashboard.destroy();
 assert.equal(control.isConnected,false);
 assert.equal([...f.timers.values()].filter(timer=>timer.delay===340).length,0);
 assert.equal(f.mediaListeners.size,0);
});

test('reduced motion enabled during a close clears retained content and cancels cleanup',t=>{
 const f=transitionDashboard();t.after(()=>f.dashboard.destroy());
 openHome(f);const control=f.dock().querySelector('[data-setting="density"]');f.click('settings-close');f.tick(100);f.reduce();
 assert.equal(control.isConnected,false);
 assert.equal([...f.timers.values()].filter(timer=>timer.delay===340).length,0);
});

test('keyboard close skips retention and transition events ignore children and early completion',t=>{
 const f=transitionDashboard();t.after(()=>f.dashboard.destroy());
 openHome(f);let control=f.dock().querySelector('[data-setting="density"]');
 f.container.dataset.input='keyboard';f.click('settings-close',{}, {pointer:false});
 assert.equal(control.isConnected,false,'keyboard styling has no close transition');
 f.container.dataset.input='pointer';openHome(f);control=f.dock().querySelector('[data-setting="density"]');f.click('settings-close');
 const dock=f.dock(),end=dock.events.get('transitionend'),stamp=f.env.performance.now();
 end({target:control,propertyName:'opacity'});assert.ok(control.isConnected);
 end({target:dock,propertyName:'opacity'});assert.ok(control.isConnected,'an early event cannot shorten the close');
 f.env.performance.now=()=>stamp+340;
 end({target:dock,propertyName:'opacity'});
 assert.equal(control.isConnected,false,'the completed dock transition releases its outgoing section');
 assert.equal([...f.timers.values()].filter(timer=>timer.delay===340).length,0);
 assert.equal(dock.events.has('transitionend'),false);assert.equal(dock.events.has('transitioncancel'),false);
});
