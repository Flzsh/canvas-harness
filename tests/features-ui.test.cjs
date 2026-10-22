'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./dashboard-heading-fixture.cjs');
const source=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const load=(env,...files)=>{for(const file of files)vm.runInContext(source(file),env,{filename:file});return env;};
const environment=()=>vm.createContext({URL,URLSearchParams,console});
const features=(env,prefs)=>{load(env,'features.js');env.ReserveFeatures.apply(prefs);};
const custom=(...ids)=>({preset:'custom',custom:ids});
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

function setupDashboard(prefs,{widgets=false,workspace}={}){
 return ({env,store})=>{
  features(env,prefs);
  env.document.defaultView=env;
  load(env,'personal-work.js','workspace-arrange.js','customization-model.js');
  if(widgets)load(env,'planner-model.js','planner-ui.js','widgets.js');
  for(const [id,name]of [['motion','ReserveMotion'],['course-art','ReserveCourseArt'],['customization','ReserveCustomizeUI']]){
   if(!env.ReserveFeatures.enabled(id))delete env[name];
  }
  Object.assign(store.get(),{tasks:{},customTasks:[],focus:{minutes:25,remaining:1500,endsAt:null},toolbox:{scratchpad:'Keep my notes'},pet:{name:'Saved pony',xp:50}});
  if(workspace){
   const mount=env.ReserveDashboard.mount;
   env.ReserveDashboard.mount=(target,options)=>mount(target,{...options,initialState:{...options.initialState,workspace}});
  }
 };
}
function hiddenAction(f,action,data={}){
 const button=f.document.createElement('button');button.dataset.rdAction=action;Object.assign(button.dataset,data);
 f.container.events.get('click')({target:button,detail:0,preventDefault(){}});
}

test('Quick open retains Full defaults and filters disabled entries and stale recents',()=>{
 const env=load(environment(),'site.js','quick-open.js'),quick=env.ReserveQuickOpen,all=quick.entries();
 assert.ok(all.some(x=>x.id==='tool:ai'));assert.ok(all.some(x=>x.id==='workspace:materials'));
 features(env,'lite');
 const ids=quick.entries().map(x=>x.id);
 for(const id of ['workspace:work','workspace:grades','planner:week','tool:gpa','tool:calculator'])assert.ok(ids.includes(id),id);
 for(const id of ['workspace:hub','workspace:inbox','workspace:materials','tool:ai','canvas:conversations'])assert.ok(!ids.includes(id),id);
 assert.equal(quick.search(all,'AI').length,0);
 assert.ok(!quick.suggest(all,{recent:['tool:ai','workspace:materials']}).some(x=>['tool:ai','workspace:materials'].includes(x.id)));
 env.ReserveFeatures.apply(custom('dashboard'));assert.equal(quick.entries().length,0);assert.equal(quick.search(all,'').length,0);
});

test('Lite mounts with real Planner and Widgets and absent optional globals',async t=>{
 const f=fixture({setup:setupDashboard('lite',{widgets:true})});t.after(()=>f.dashboard.destroy());await flush();
 assert.deepEqual(Array.from(f.container.querySelectorAll('.rd-workspace-tab'),x=>x.dataset.tab),['work','assignments','plan','grades']);
 assert.equal(f.container.dataset.featureMotion,'off');assert.equal(f.container.dataset.motionStyle,'off');
 assert.equal(f.container.querySelector('[data-rd-action="settings"]'),null);
 assert.equal(f.container.querySelector('.rd-course-information'),null);
 assert.equal(f.counts.scenes,0);assert.equal(f.counts.titles,0);assert.equal(f.animations.length,0);
 f.click('workspace',{tab:'plan'});assert.equal(f.container.dataset.workspace,'plan');
 f.click('workspace',{tab:'grades'});f.click('workspace',{tab:'work'});
 const heading=f.container.querySelector('.rd-workspace-heading');
 await f.store.update(()=>{});assert.strictEqual(f.container.querySelector('.rd-workspace-heading'),heading);
});

test('unavailable saved workspace falls back while preserving destination and optional data',async t=>{
 const saved=new Map(),key='reserve:dashboard:https://school.instructure.com:1';
 const f=fixture({setup:args=>{
  setupDashboard('lite',{widgets:true,workspace:'materials'})(args);
  args.store.owner={origin:'https://school.instructure.com',accountId:'1'};
  args.env.sessionStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
  Object.assign(args.store.get().settings,{showGrades:true,motion:'gentle',workspaceOrder:['work','reader','context'],workspaceLayout:{axis:'x',children:['work','reader','context','pet','messages']},coursePrefs:{'10':{name:'My course',iconArt:{name:'keep.svg',svg:'<svg/>'}}}});
 }});t.after(()=>f.dashboard.destroy());await flush();
 const before=JSON.stringify(f.store.get());
 assert.equal(f.container.dataset.workspace,'work');assert.equal(f.dashboard.getState().workspace,'materials');
 assert.equal(JSON.parse(saved.get(key)).workspace,'materials');
 await f.store.update(()=>{});assert.equal(JSON.stringify(f.store.get()),before);
 assert.equal(JSON.parse(saved.get(key)).workspace,'materials');
 f.click('workspace',{tab:'grades'});assert.equal(JSON.parse(saved.get(key)).workspace,'grades');
});

test('custom dashboard rejects hidden actions and settings without starting optional controllers',async t=>{
 const f=fixture({setup:args=>{
  setupDashboard(custom('dashboard'),{workspace:'plan'})(args);
  delete args.env.ReservePlannerUI;delete args.env.ReserveGradesView;
  for(const name of ['ReserveMotion','ReserveToolbox','ReservePets'])args.env[name]=new Proxy({},{get(){throw Error('Disabled controller accessed');}});
  args.env.ReserveCourseArt=new Proxy({},{get(_,key){if(key==='kind')return ()=>'';throw Error('Disabled artwork accessed');}});
  args.store.get().settings.showGrades=true;args.store.get().focus.endsAt=1;
 }});t.after(()=>f.dashboard.destroy());await flush();
 assert.deepEqual(Array.from(f.container.querySelectorAll('.rd-workspace-tab'),x=>x.dataset.tab),['work','assignments']);
 assert.equal(f.container.dataset.workspace,'work');assert.equal(f.container.querySelector('[data-setting="showGrades"]'),null);
 const before=JSON.stringify(f.store.get());
 for(const [action,data]of [['workspace',{tab:'grades'}],['settings',{}],['selection-ai',{}],['art-remove',{id:'10',kind:'icon'}],['pet-roam',{}],['planner',{}],['timer-toggle',{}]])hiddenAction(f,action,data);
 f.container.events.get('change')({target:{dataset:{rdField:'setting',setting:'showGrades'},type:'checkbox',checked:false}});
 f.tick(2000);await flush();assert.equal(JSON.stringify(f.store.get()),before);
 assert.ok(!Array.from(f.timers.values()).some(timer=>timer.repeat&&timer.delay===1000));
});

test('enabled features with absent UI modules fall back without dead tabs',t=>{
 const f=fixture({setup:args=>{
  setupDashboard(custom('dashboard','planner','materials','course-hub','customization','tools'),{workspace:'materials'})(args);
  delete args.env.ReserveCustomizeUI;delete args.env.ReservePlannerUI;
 }});t.after(()=>f.dashboard.destroy());
 assert.equal(f.container.dataset.workspace,'work');
 assert.deepEqual(Array.from(f.container.querySelectorAll('.rd-workspace-tab'),x=>x.dataset.tab),['work','assignments']);
 assert.equal(f.container.querySelector('[data-rd-action="settings"]'),null);
 assert.equal(f.container.querySelector('[data-rd-action="toolbox"]'),null);
});

test('customization switches and tabs work when Planner and Widgets are absent',async t=>{
 const f=fixture({setup:args=>{
  setupDashboard(custom('dashboard','customization'))(args);
  load(args.env,'customize-ui.js','settings-dock.js');
 }});t.after(()=>f.dashboard.destroy());
 f.click('settings');
 const look=f.container.querySelector('[data-rd-action="customize-tab"][data-value="look"]');
 f.container.events.get('click')({target:look,detail:0,preventDefault(){}});
 assert.equal(f.container.querySelector('.cz-tab[aria-selected="true"]').dataset.value,'look');
 f.container.events.get('change')({target:{dataset:{rdField:'setting',setting:'greeting',onoff:'true'},type:'checkbox',checked:false}});
 await flush();assert.equal(f.store.get().settings.greeting,'off');
});

test('Widgets hides disabled cards while preserving the saved layout',()=>{
 const env=load(environment(),'workspace-arrange.js','widgets.js');features(env,'lite');
 const c={s:{workspaceLayout:{axis:'x',children:['work','reader','context','pet','messages','grades','today']}},personal:{},courses:[],courseMap:new Map(),items:[],local:{}};
 const before=JSON.stringify(c.s),h={E:String},html=env.ReserveWidgets.gallery(c,h);
 for(const key of ['pet','messages','context']){assert.equal(env.ReserveWidgets.render(key,c,h),'');assert.doesNotMatch(html,new RegExp('data-widget="'+key+'"'));}
 assert.match(html,/data-widget="grades"/);assert.doesNotMatch(html,/data-rd-action="board-frame"/);
 assert.equal(JSON.stringify(c.s),before);
 env.ReserveFeatures.apply(custom('dashboard'));assert.equal(env.ReserveWidgets.create({}),null);assert.equal(env.ReserveWidgets.render('today',c,h),'');
});

test('customization filters disabled settings and avoids all disabled art and pet calls',()=>{
 const env=load(environment(),'workspace-arrange.js','customization-model.js','customize-ui.js');features(env,custom('dashboard','customization'));
 for(const name of ['ReserveCourseArt','ReserveCustomArt','ReservePets','ReservePetArt'])env[name]=new Proxy({},{get(){throw Error('Disabled artwork accessed');}});
 const c={s:{theme:'dark',motion:'gentle',livingArt:'on',coursePrefs:{}},courses:[],allCourses:[],customizeOpen:true},before=JSON.stringify(c),ui=env.ReserveCustomizeUI,html=ui.render(c);
 assert.deepEqual(plain(ui.tabs()).map(x=>x[0]),['layout','look','courses']);
 assert.match(html,/data-rd-action="accent"/);
 assert.doesNotMatch(html,/data-value="(?:art|pet)"|data-setting="(?:motion|livingArt|nightArt|canvasNav|showRecentGrades|showCourseInformation)"|data-rd-action="board-edit"/);
 assert.equal(JSON.stringify(c),before);
 assert.match(ui.render({...c,customizeTab:'pet'}),/data-value="layout" aria-selected="true"/);
 env.ReserveFeatures.apply('lite');assert.equal(ui.render(c),'');assert.equal(ui.createDock({}),null);
});

test('Toolbox filters disabled or absent tools and exposes disabled motion',()=>{
 const env=load(environment(),'site.js','quick-open.js','toolbox.js');features(env,'lite');
 env.CanvasHarnessAISource={mount(){throw Error('AI disabled');}};env.CanvasHarnessGPAUI={create(){}};
 assert.deepEqual(plain(env.ReserveToolbox.sections()).map(x=>x[0]),['quick','calculator','gpa']);
 delete env.CanvasHarnessGPAUI;assert.deepEqual(plain(env.ReserveToolbox.sections()).map(x=>x[0]),['quick','calculator']);
 const container={dataset:{}},toolbox=env.ReserveToolbox.create({container,store:{get:()=>({}),subscribe:()=>()=>{}},getContext:()=>({})});
 assert.equal(container.dataset.featureMotion,'off');toolbox.destroy();
 env.ReserveFeatures.apply(custom('dashboard'));assert.equal(env.ReserveToolbox.create({}),null);
});

test('legacy app rejects disabled navigation and preserves a stopped Planner session',async t=>{
 const f=fixture({setup:args=>{
  setupDashboard(custom('dashboard','tools'))(args);
  Object.assign(args.store.get().settings,{courseOrder:[],hiddenCourses:[],shownCourses:[]});
  args.env.requestAnimationFrame=fn=>args.env.setTimeout(fn,0);
  load(args.env,'icons.js','views.js','app.js');
 }});t.after(()=>f.dashboard.destroy());
 const app=f.env.ReserveApp.mount(f.document.body,{snapshot:f.snapshot,store:f.store,demo:true,initialPage:'week'});t.after(()=>app.destroy());
 assert.equal(app.getState().page,'home');
 const shell=f.document.body.querySelector('.reserve-shell'),container=shell.parentElement;
 for(const page of ['week','grades','settings']){
  assert.equal(shell.querySelector('[data-page="'+page+'"]'),null);
  const button=f.document.createElement('button');button.dataset.action='navigate';button.dataset.page=page;
  await container.events.get('click')({target:button,preventDefault(){}});assert.equal(app.getState().page,'home');
 }
 assert.equal(f.env.ReserveViews.week({}),'');assert.equal(f.env.ReserveViews.grades({}),'');assert.equal(f.env.ReserveViews.settings({}),'');
 const before=JSON.stringify(f.store.get());f.tick(2000);await flush();assert.equal(JSON.stringify(f.store.get()),before);
});

test('disabled entry points return before touching missing modules',()=>{
 const env=environment();features(env,custom('dashboard'));
 load(env,'site.js','planner-ui.js','materials-ui.js','course-hub-ui.js','native-tools.js');
 assert.equal(env.ReservePlannerUI.render({},{}),'');assert.equal(env.ReservePlannerUI.create({}),null);
 assert.equal(env.ReserveMaterialsUI.create({}),null);assert.equal(env.ReserveCourseHubUI.create({}),null);
 assert.equal(env.ReserveNativeTools.create({}),null);
});


test('artwork-pack dashboard wiring follows the selected feature and cleans up its controller',async()=>{
 for(const prefs of ['full','lite',custom('quick-pack')]){
  const calls={create:0,review:[],apply:0,undo:0,destroy:0};
  const f=fixture({setup:args=>{
   setupDashboard(prefs)(args);
   args.env.CanvasHarnessQuickUpload={create(){
    calls.create++;
    return {state:{phase:'idle'},review:async text=>calls.review.push(text),
     apply:()=>calls.apply++,undo:()=>calls.undo++,reset(){},destroy:()=>calls.destroy++};
   }};
  }});
  try{
   const selected=prefs!=='lite';
   assert.equal(calls.create,selected?1:0);
   f.container.events.get('input')({target:{dataset:{rdField:'quick-pack-source'},value:'local artwork'}});
   hiddenAction(f,'quick-pack-review');await flush();
   hiddenAction(f,'quick-pack-apply');hiddenAction(f,'quick-pack-undo');
   assert.deepEqual(calls.review,selected?['local artwork']:[]);
   assert.equal(calls.apply,selected?1:0);assert.equal(calls.undo,selected?1:0);
  }finally{f.dashboard.destroy();}
  assert.equal(calls.destroy,prefs==='lite'?0:1);
  for(const event of ['dragover','dragleave','drop'])assert.equal(f.container.events.has(event),false);
 }
});
