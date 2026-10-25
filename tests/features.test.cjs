// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ext=path.join(__dirname,'../extension'),read=file=>fs.readFileSync(path.join(ext,file),'utf8');
const F=require('../extension/features.js'),original=require('./fixtures/addons-original-manifest.json');
const json=value=>JSON.parse(JSON.stringify(value));
const liteEnabled=['dashboard','planner','grades','math','gpa','tools','arrange','native-appearance'];
test('media banners use the Appearance selection and Lite retains only pure backup validation',()=>{
 const full=F.resolve({preset:'full'}),lite=F.resolve({preset:'lite'}),custom=F.resolve({preset:'custom',custom:['customization','course-art']});
 for(const file of ['media-store.js','media-frame.js','frame-editor.js']){
  assert.ok(full.js.includes(file),file);assert.ok(custom.js.includes(file),file);assert.ok(!lite.js.includes(file),file);
 }
 for(const file of ['media-frame.css','frame-editor.css']){
  assert.ok(full.css.includes(file),file);assert.ok(custom.css.includes(file),file);assert.ok(!lite.css.includes(file),file);
  assert.ok(read('startup.js').includes("'"+file+"'"));assert.ok(read('content.js').includes("'"+file+"'"));
  for(const entry of JSON.parse(read('manifest.json')).web_accessible_resources)assert.ok(entry.resources.includes(file));
 }
 for(const file of ['media-reference.js','backup-media.js'])assert.ok(lite.js.includes(file),file);
 const f=catalogue();f.apply({preset:'lite'});assert.ok(!f.filterFiles(F.dashboardCSS).some(file=>/^(?:media-frame|frame-editor)\./.test(file)));
});
function catalogue(){const env=vm.createContext({TextEncoder,TextDecoder,structuredClone,});vm.runInContext(read('features.js'),env);return env.ReserveFeatures;}
test('Full preserves the complete original main declaration and defaults to Full',()=>{
 for(const [before,after]of [['deadline-model.js','deadline-changes.js'],['deadline-changes.js','session.js']])assert.ok(F.resolve().js.indexOf(before)<F.resolve().js.indexOf(after));
 assert.deepEqual(F.resolve().js.filter(file=>original.content_scripts[1].js.includes(file)),original.content_scripts[1].js);
 for(const file of F.resolve().js)assert.ok(fs.existsSync(path.join(ext,file)),file);
 assert.deepEqual(F.resolve({preset:'full'}).enabled,F.presets.full);
 for(const id of ['focus-room','review-deck','grade-impact'])assert.ok(!F.presets.full.includes(id)&&!F.presets.lite.includes(id));
 assert.deepEqual(F.startupCSS,original.content_scripts[0].css);
});
test('every original manifest resource belongs to exactly one feature or core',()=>{
 for(const type of ['js','css'])for(const file of new Set(original.content_scripts.flatMap(entry=>entry[type]||[]))){
  const owners=[F.core,...F.catalogue.map(f=>f.files)].filter(files=>files[type].includes(file));
  assert.equal(owners.length,1,file);
 }
 const manifest=JSON.parse(read('manifest.json'));
 for(const type of ['js','css'])for(const file of new Set(manifest.content_scripts.flatMap(entry=>entry[type]||[])))assert.equal([F.core,...F.catalogue.map(f=>f.files)].filter(files=>files[type].includes(file)).length,1,file);
});
test('Lite is the documented study core; dependency closure is ordered and unique',()=>{
 assert.deepEqual(new Set(F.resolve({preset:'lite'}).enabled),new Set(F.presets.lite));
 const custom=F.resolve({preset:'custom',enabled:['pony','unknown','pony']});
 assert.deepEqual(new Set(custom.enabled),new Set(['dashboard','planner','pony']));
 assert.equal(new Set(custom.js).size,custom.js.length);
 assert.ok(custom.js.indexOf('custom-art.js')<custom.js.indexOf('pets.js'));
 assert.ok(custom.js.indexOf('gpa-model.js')<custom.js.indexOf('storage.js'));
 assert.ok(custom.js.indexOf('dashboard-view.js')<custom.js.indexOf('dashboard.js'));
 const planner=F.resolve({preset:'custom',custom:['planner']});for(const file of ['planner-model.js','planner-ui.js','widgets.js'])assert.ok(planner.js.includes(file));
});
test('course hub requires Materials and loads its UI before course hub modules',()=>{
 const hub=F.resolve({preset:'custom',custom:['course-hub']});
 assert.deepEqual(hub.enabled,['dashboard','materials','course-hub']);
 for(const file of ['material-model.js','materials-ui.js','course-hub-model.js','course-hub-ui.js'])assert.ok(hub.js.includes(file),file);
 assert.ok(hub.js.indexOf('material-model.js')<hub.js.indexOf('materials-ui.js'));
 assert.ok(hub.js.indexOf('materials-ui.js')<hub.js.indexOf('course-hub-model.js'));
 assert.ok(hub.js.indexOf('course-hub-model.js')<hub.js.indexOf('course-hub-ui.js'));
 assert.ok(!F.resolve({preset:'custom',custom:['dashboard']}).js.includes('materials-ui.js'),'unrelated selections remain lean');
});
test('filtered styles and restored workspace names honor the page selection',()=>{
 const f=catalogue();f.apply({preset:'lite'});
 for(const file of ['subject-art.css','pet.css','startup-art.css'])assert.ok(!f.filterFiles(f.dashboardCSS.concat(f.startupCSS)).includes(file));
 assert.equal(f.workspace('materials'),'work');assert.equal(f.workspace('plan'),'plan');
 f.apply({preset:'custom',custom:[]});assert.equal(f.workspace('grades'),null);
 // widgets.css also styles the editor, grade marks and card styles, so it stays whatever is chosen
 assert.deepEqual(json(f.filterFiles(['pet.css','subject-art.css','widgets.css','gpa.css'])),['widgets.css']);
});
function worker(prefs,session=null){
 const executions=[],styles=[],imports=[],listeners=[];
 const event=()=>({addListener(){}}),runtime={id:'test-extension',getURL:file=>'chrome-extension://test-extension/'+file,onMessage:{addListener:fn=>listeners.push(fn)},onConnect:event()};
 const env=vm.createContext({TextEncoder,TextDecoder,structuredClone,URL,console,setTimeout,clearTimeout,chrome:{runtime,storage:{local:{get:async key=>({[key]:prefs})},...(session?{session:{get:async key=>session.has(key)?{[key]:session.get(key)}:{},set:async values=>{for(const [key,value]of Object.entries(values))session.set(key,json(value));}}}:{})},
  scripting:{executeScript:async options=>executions.push(options),insertCSS:async options=>styles.push(options)}}});
 env.importScripts=(...files)=>{imports.push(...files);for(const file of files)vm.runInContext(read(file),env,{filename:file});};
 vm.runInContext(read('background.js'),env,{filename:'background.js'});
 const sender={id:runtime.id,tab:{id:12},frameId:0,documentId:'document-one',url:'https://school.instructure.com/dashboard'};
 return {executions,styles,imports,env,sender,setPrefs:value=>{prefs=value;},request:(message={target:'ch-features',op:'load'},who=sender)=>new Promise(resolve=>{for(const listener of listeners)listener(message,who,resolve);})};
}
test('Lite worker injects no PDF, AI, pony, artwork files, including styles',async()=>{
 const w=worker({preset:'lite'}),reply=await w.request();assert.equal(reply.ok,true);
 const injected=w.executions.flatMap(call=>call.files||[]).concat(w.styles.flatMap(call=>call.files));
 assert.ok(injected.includes('dashboard.js'));assert.ok(injected.includes('planner-ui.js'));
 assert.ok(!injected.some(file=>/^(?:pdf-|ai-|pets?\.|pet-|subject-|generic-art|course-art|course-nav|canvas-nav|startup-art|quick-(?:pack|upload))/.test(file)),injected.join(','));
 assert.ok(w.env.CanvasHarnessWeb,'the worker registers helpers at install time, even in Lite');
 for(const call of w.executions.filter(call=>call.files||call.args))assert.deepEqual(json(call.target),{tabId:12,documentIds:['document-one']});
 const before=w.executions.length;await w.request();assert.equal(w.executions.length,before,'duplicate load messages reuse document injection');
});
test('Full worker excludes early-paint files and preserves the remaining original order exactly once',async()=>{
 const w=worker(),reply=await w.request();assert.equal(reply.ok,true);
 const manifest=JSON.parse(read('manifest.json')),main=manifest.content_scripts[1];
 const early=['canvas-nav.js','course-nav-art.js','course-nav.js'];
 assert.equal(main.run_at,'document_start');
 assert.deepEqual(main.js.filter(file=>early.includes(file)),early);
 const loaded=w.executions.flatMap(call=>call.files||[]);
 const injected=loaded.concat(w.styles.flatMap(call=>call.files));
 for(const file of ['startup-art.js',...early,...original.content_scripts[0].css])assert.ok(!injected.includes(file),file+' must stay static');
 const staticMain=main.js.filter(file=>original.content_scripts[1].js.includes(file));
 assert.deepEqual(staticMain,original.content_scripts[1].js.filter(file=>staticMain.includes(file)));
 assert.deepEqual(loaded,F.resolve().js.filter(file=>!staticMain.includes(file)));
 assert.deepEqual(loaded.filter(file=>original.content_scripts[1].js.includes(file)),original.content_scripts[1].js.filter(file=>!staticMain.includes(file)));
 const full=[...staticMain,...loaded];
 assert.equal(new Set(full).size,full.length);assert.deepEqual(full.slice().sort(),F.resolve().js.slice().sort());
 assert.equal(manifest.content_scripts.flatMap(entry=>entry.js).filter(file=>file==='features.js').length,1,'the shared early-selection state is not reset by the main entry');
});

const earlyScripts=['canvas-nav.js','course-nav-art.js','course-nav.js','startup-art.js'];
function earlyPage(hint,{denied=false}={}){
 const classes=new Set(),listeners=[],storageListeners=[],reads=[],values=new Map(hint===undefined?[]:[['reserve:features-hint',hint]]);
 let finish;
 const stored=new Promise(resolve=>{finish=resolve;});
 const html={classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},dataset:{},style:{setProperty(){},removeProperty(){}}};
 const env=vm.createContext({TextEncoder,TextDecoder,structuredClone,URL,Event,console,location:new URL('https://school.instructure.com/courses/7/modules'),
  document:{documentElement:html,readyState:'loading',getElementById:()=>null,querySelector:()=>null,addEventListener:(...args)=>listeners.push(args),removeEventListener:(type,fn)=>{const at=listeners.findIndex(entry=>entry[0]===type&&entry[1]===fn);if(at>=0)listeners.splice(at,1);},dispatchEvent:event=>{
   for(const entry of [...listeners])if(entry[0]===event.type){if(entry[2]?.once)listeners.splice(listeners.indexOf(entry),1);entry[1](event);}return true;
  }},
  localStorage:{getItem:key=>{if(denied)throw Error('denied');return values.get(key)??null;},setItem:(key,value)=>values.set(key,value)},
  addEventListener(){},removeEventListener(){},
  MutationObserver:class{observe(){}disconnect(){}},chrome:{storage:{local:{get:key=>{reads.push(key);return stored;}},onChanged:{addListener:fn=>storageListeners.push(fn),removeListener:fn=>{const at=storageListeners.indexOf(fn);if(at>=0)storageListeners.splice(at,1);}}}}});
 env.window=env;env.top=env;
 const run=file=>vm.runInContext(read(file),env,{filename:file});
 run('features.js');run('site.js');
 return {env,classes,listeners,reads,values,run,finish:prefs=>finish({'reserve:features':prefs}),change:(changes,area='local')=>{for(const fn of storageListeners)fn(changes,area);}};
}
test('off hints skip synchronous effects while still confirming the page selection',async()=>{
 for(const [feature,files] of [['canvas-nav',['canvas-nav.js']],['course-nav',['course-nav-art.js','course-nav.js']],['motion',['startup-art.js']]]){
  const f=earlyPage(JSON.stringify({preset:'custom',custom:F.presets.full.filter(id=>id!==feature)}));
  // Supply the art dependency so the course script cannot pass just because art is missing.
  if(feature==='course-nav')f.env.ReserveCourseNavArt={map:{}};
  const before=f.env.ReserveCourseNavArt;
  for(const file of files)f.run(file);
  await Promise.resolve();
  assert.equal(f.classes.size,0,feature);assert.equal(f.listeners.filter(([type])=>type!=='reserve:features-ready').length,0,feature);assert.deepEqual(f.reads,['reserve:features'],feature);
  assert.equal(f.env.ReserveCanvasNav,undefined);assert.equal(f.env.ReserveCourseNav,undefined);assert.equal(f.env.ReserveStartupArt,undefined);
  assert.equal(f.env.ReserveCourseNavArt,before,'disabled art does not replace its global');
 }
});

test('a stale Lite hint starts every static drawing once after Full is confirmed',async()=>{
 const f=earlyPage(JSON.stringify({preset:'lite'}));
 for(const file of earlyScripts)f.run(file);
 assert.equal(f.classes.size,0);assert.equal(f.env.ReserveCanvasNav,undefined);
 f.finish({preset:'full'});await new Promise(setImmediate);
 assert.ok(f.env.ReserveCanvasNav);assert.ok(f.env.ReserveCourseNavArt);assert.ok(f.env.ReserveStartupArt);
 assert.ok(f.classes.has('reserve-course-nav'));assert.ok(f.classes.has('chn-nav'));
 assert.equal(f.reads.filter(key=>key==='reserve:features').length,1,'one shared confirmation for all static scripts');
 const nav=f.env.ReserveCanvasNav,art=f.env.ReserveCourseNavArt,listeners=f.listeners.length;
 await f.env.ReserveFeatures.earlyReady;await new Promise(setImmediate);
 assert.equal(f.env.ReserveCanvasNav,nav);assert.equal(f.env.ReserveCourseNavArt,art);assert.equal(f.listeners.length,listeners);
 const hint=JSON.parse(f.values.get('reserve:features-hint'));
 assert.equal(hint.preset,'full');for(const id of ['canvas-nav','course-nav','motion'])assert.ok(hint.enabled.includes(id));
});

test('a stale Full hint removes early effects after Lite is confirmed and cannot start at DOMContentLoaded',async()=>{
 const f=earlyPage(JSON.stringify({preset:'full'}));
 for(const file of earlyScripts)f.run(file);
 assert.ok(f.env.ReserveCanvasNav);assert.ok(f.env.ReserveCourseNavArt);assert.ok(f.env.ReserveStartupArt);
 assert.ok(f.classes.has('reserve-course-nav'));
 f.finish({preset:'lite'});await new Promise(setImmediate);
 assert.equal(f.classes.size,0);assert.equal(f.env.ReserveCourseNavArt,undefined);assert.equal(f.env.ReserveStartupArt,undefined);
 f.env.document.readyState='interactive';f.env.document.dispatchEvent(new Event('DOMContentLoaded'));await new Promise(setImmediate);
 assert.equal(f.classes.size,0);assert.equal(f.env.ReserveCourseNav,undefined);
 assert.deepEqual(JSON.parse(f.values.get('reserve:features-hint')),{preset:'lite',enabled:liteEnabled});
});

function canvasPage(hint,{lateLayout=false}={}){
 const f=earlyPage(JSON.stringify({preset:hint})),nodes=[],boxClasses=new Set(),intervals=new Set(),windowListeners=new Set();
 const insert=markup=>{const node={markup,remove(){nodes.splice(nodes.indexOf(node),1);}};nodes.push(node);};
 const box={classList:{add:name=>boxClasses.add(name),remove:name=>boxClasses.delete(name)},insertAdjacentHTML:(_position,markup)=>insert(markup)};
 const badge={textContent:'',dataset:{}};
 const link={id:'global_nav_dashboard_link',querySelector:selector=>selector==='.menu-item-icon-container'?box:selector==='.chn-ic'?nodes.find(node=>node.markup.includes('chn-ic')):selector===':scope > .chn-frames'?nodes.find(node=>node.markup.includes('chn-frames')):null,
  querySelectorAll:selector=>selector==='.menu-item__badge'?[badge]:[],insertAdjacentHTML:(_position,markup)=>insert(markup)};
 const header={dataset:{},style:{setProperty(){}},querySelector:selector=>selector==='.ic-app-header__menu-list-link'?link:null,
  querySelectorAll:selector=>selector==='.ic-app-header__menu-list-link'?[link]:selector==='.chn-ic, .chn-frames, .chn-logo-art'?[...nodes]:selector==='.chn-drawn'&&boxClasses.has('chn-drawn')?[box]:selector==='[data-chn-empty]'&&'chnEmpty' in badge.dataset?[badge]:[]};
 f.env.document.getElementById=id=>id==='header'?header:null;
 Object.assign(f.env,{addEventListener:(_type,fn)=>windowListeners.add(fn),removeEventListener:(_type,fn)=>windowListeners.delete(fn),
  setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn),requestAnimationFrame:fn=>fn(),
  getComputedStyle:()=>({position:'fixed',backgroundColor:'white',getPropertyValue:()=>''}),ReserveCourseArt:{frame:()=>'<svg></svg>'}});
 const get=f.env.chrome.storage.local.get;let layout;
 f.env.chrome.storage.local.get=key=>typeof key==='string'?get(key):lateLayout?new Promise(resolve=>{layout=resolve;}):Promise.resolve({'reserve:canvasNav':'shown'});
 return {...f,nodes,boxClasses,badge,header,intervals,windowListeners,layout:()=>layout?.({'reserve:canvasNav':'shown'})};
}
function drawingPage(hint){
 const page=canvasPage(hint),menu={querySelectorAll:()=>[],contains:()=>false};
 page.env.document.readyState='interactive';
 page.env.document.querySelector=selector=>selector.includes('#section-tabs')?menu:null;
 page.env.document.createElement=tag=>({tag,remove(){},setAttribute(){}});
 page.env.document.head={append(){}};
 page.env.chrome.runtime={getURL:file=>'chrome-extension://test/'+file};
 return page;
}
async function workerSelection(page,selection){
 page.env.chrome.runtime.sendMessage=async()=>({ok:true,preset:selection.preset,enabled:selection.enabled});
 page.run('feature-loader.js');
 const reply=await page.env.ReserveFeatureLoad;await new Promise(setImmediate);
 assert.equal(reply.ok,true);
}
test('worker Lite overrides an already-confirmed Full hint and removes every early effect',async()=>{
 const f=drawingPage('full');for(const file of earlyScripts)f.run(file);
 f.finish({preset:'full'});await new Promise(setImmediate);
 assert.ok(f.classes.has('chn-nav'));assert.ok(f.classes.has('reserve-course-nav'));
 assert.ok(f.env.ReserveCourseNavArt);assert.ok(f.env.ReserveStartupArt);assert.ok(f.env.ReserveCanvasNav);
 await workerSelection(f,F.resolve('lite'));
 assert.equal(f.env.ReserveFeatures.current.preset,'lite');
 assert.equal(f.classes.has('chn-nav'),false);assert.equal(f.classes.has('reserve-course-nav'),false);
 assert.equal(f.env.ReserveCourseNavArt,undefined);assert.equal(f.env.ReserveCanvasNav,undefined);assert.equal(f.env.ReserveStartupArt,undefined);
 assert.equal('cnMotion' in f.env.document.documentElement.dataset,false);
 assert.equal('chnMotion' in f.env.document.documentElement.dataset,false);
});
test('worker Full starts all early effects after Lite was already confirmed and does so once',async()=>{
 const f=drawingPage('lite');for(const file of earlyScripts)f.run(file);
 f.finish({preset:'lite'});await new Promise(setImmediate);
 assert.equal(f.classes.size,0);assert.equal(f.env.ReserveCourseNavArt,undefined);
 await workerSelection(f,F.resolve('full'));
 assert.ok(f.classes.has('chn-nav'));assert.ok(f.classes.has('reserve-course-nav'));
 assert.ok(f.env.ReserveCourseNavArt);assert.ok(f.env.ReserveStartupArt);assert.ok(f.env.ReserveCanvasNav);
 assert.equal(f.env.document.documentElement.dataset.cnMotion,'on');
 assert.equal(f.env.document.documentElement.dataset.chnMotion,'on');
 const art=f.env.ReserveCourseNavArt,nav=f.env.ReserveCanvasNav;
 f.env.document.dispatchEvent(new Event('reserve:features-ready'));await new Promise(setImmediate);
 assert.equal(f.env.ReserveCourseNavArt,art);assert.equal(f.env.ReserveCanvasNav,nav);
});
test('worker disabling only the course menu preserves the canvas bar and startup art',async()=>{
 const f=drawingPage('full');for(const file of earlyScripts)f.run(file);
 f.finish({preset:'full'});await new Promise(setImmediate);
 const nav=f.env.ReserveCanvasNav,art=f.env.ReserveStartupArt;
 await workerSelection(f,F.resolve({preset:'custom',custom:['canvas-nav','motion']}));
 assert.equal(f.classes.has('reserve-course-nav'),false);
 assert.equal(f.env.ReserveCourseNavArt,undefined);
 assert.equal(f.env.ReserveCourseNav,undefined);
 assert.ok(f.classes.has('chn-nav'));
 assert.strictEqual(f.env.ReserveCanvasNav,nav);
 assert.strictEqual(f.env.ReserveStartupArt,art);
});
test('worker turns Motion off while keeping both navigation features and their motion flags off',async()=>{
 const f=drawingPage('full');for(const file of earlyScripts)f.run(file);
 f.finish({preset:'full'});await new Promise(setImmediate);
 assert.equal(f.env.document.documentElement.dataset.cnMotion,'on');
 assert.equal(f.env.document.documentElement.dataset.chnMotion,'on');
 const nav=F.resolve({preset:'custom',custom:['canvas-nav','course-nav']});
 await workerSelection(f,nav);
 assert.ok(f.classes.has('chn-nav'));assert.ok(f.classes.has('reserve-course-nav'));
 assert.ok(f.env.ReserveCourseNavArt);assert.ok(f.env.ReserveCanvasNav);
 assert.equal(f.env.ReserveStartupArt,undefined);
 assert.equal(f.env.document.documentElement.dataset.cnMotion,'off');
 assert.equal(f.env.document.documentElement.dataset.chnMotion,'off');
 assert.deepEqual(json(f.env.ReserveFeatures.current.enabled.slice().sort()),nav.enabled.slice().sort());
});
test('worker can restore Motion while navigation stays on, honoring explicit still appearance',async()=>{
 for(const still of [false,true]){
  const f=drawingPage('full'),get=f.env.chrome.storage.local.get;
  if(still)f.env.chrome.storage.local.get=key=>key==='reserve:appearance'?Promise.resolve({'reserve:appearance':{motion:'off'}}):
   Array.isArray(key)?Promise.resolve({'reserve:canvasNav':'shown','reserve:navPalette':{motion:'still'}}):get(key);
  for(const file of earlyScripts)f.run(file);
  f.finish({preset:'custom',custom:['canvas-nav','course-nav']});await new Promise(setImmediate);
  assert.equal(f.env.document.documentElement.dataset.cnMotion,'off');
  assert.equal(f.env.document.documentElement.dataset.chnMotion,'off');
  assert.equal(f.env.ReserveStartupArt,undefined);
  await workerSelection(f,F.resolve('full'));
  assert.equal(f.env.document.documentElement.dataset.cnMotion,still?'off':'on');
  assert.equal(f.env.document.documentElement.dataset.chnMotion,still?'off':'on');
  assert.ok(f.env.ReserveStartupArt);
 }
});
test('equivalent worker replies leave already-confirmed early objects intact',async()=>{
 const f=drawingPage('full');for(const file of earlyScripts)f.run(file);
 f.finish({preset:'full'});await new Promise(setImmediate);
 const canvas=f.env.ReserveCanvasNav,course=f.env.ReserveCourseNavArt,startup=f.env.ReserveStartupArt;
 await workerSelection(f,F.resolve('full'));
 assert.strictEqual(f.env.ReserveCanvasNav,canvas);
 assert.strictEqual(f.env.ReserveCourseNavArt,course);
 assert.strictEqual(f.env.ReserveStartupArt,startup);
});

test('stale Canvas bar hints reconcile actual decorations, including a late layout reply',async()=>{
 for(const [hint,truth,lateLayout] of [['lite','full',false],['full','lite',false],['full','lite',true]]){
  const f=canvasPage(hint,{lateLayout});f.run('canvas-nav.js');await new Promise(setImmediate);
  assert.equal(f.nodes.length,hint==='full'&&!lateLayout?2:0,'frames and icon follow the first guess');
  f.finish({preset:truth});await new Promise(setImmediate);f.layout();await new Promise(setImmediate);
  assert.equal(f.classes.has('chn-nav'),truth==='full');assert.equal(f.nodes.length,truth==='full'?2:0);
  assert.equal(f.boxClasses.has('chn-drawn'),truth==='full');assert.equal('chnEmpty' in f.badge.dataset,truth==='full');
  if(truth==='lite'){
   assert.equal(f.env.ReserveCanvasNav,undefined);assert.deepEqual(Object.keys(f.header.dataset),[]);
   assert.deepEqual(Object.keys(f.env.document.documentElement.dataset),[]);assert.equal(f.intervals.size,0);assert.equal(f.windowListeners.size,0);
   f.change({'reserve:canvasNav':{newValue:'shown'}});f.env.document.dispatchEvent(new Event('reserve:features-ready'));await new Promise(setImmediate);
   assert.equal(f.classes.size,0);assert.equal(f.nodes.length,0);
  }
 }
});
test('a Full hint installs course navigation and startup art synchronously without a worker',()=>{
 const f=earlyPage(JSON.stringify({preset:'full'}));
 for(const file of earlyScripts)f.run(file);
 assert.ok(f.env.ReserveCanvasNav);assert.ok(f.env.ReserveCourseNavArt);assert.ok(f.env.ReserveStartupArt);
 assert.ok(f.classes.has('reserve-course-nav'));
 assert.equal(f.reads.length,1,'only the Canvas bar reads its own layout settings');
});
test('first visits wait for extension selection and keep the course art dependency in order',async()=>{
 for(const prefs of [{preset:'lite'},undefined]){
  const f=earlyPage();for(const file of earlyScripts)f.run(file);
  assert.equal(f.classes.size,0);assert.equal(f.env.ReserveStartupArt,undefined);assert.equal(f.env.ReserveCanvasNav,undefined);
  f.finish(prefs);await new Promise(setImmediate);
  const full=prefs===undefined;
  assert.equal(f.classes.has('reserve-course-nav'),full);assert.equal(!!f.env.ReserveCourseNavArt,full);
  assert.equal(!!f.env.ReserveStartupArt,full);assert.equal(!!f.env.ReserveCanvasNav,full);
 }
});
test('invalid or unavailable page hints fall back to extension storage',async()=>{
 for(const [hint,options] of [['{broken',{}],[JSON.stringify({preset:'full'}),{denied:true}]]){
  const f=earlyPage(hint,options);for(const file of earlyScripts)f.run(file);
  assert.equal(f.classes.size,0);f.finish({preset:'lite'});await new Promise(setImmediate);
  assert.equal(f.classes.size,0);assert.equal(f.env.ReserveStartupArt,undefined);assert.equal(f.env.ReserveCourseNavArt,undefined);
 }
});
test('content loader mirrors the received selection in page localStorage on every document load',async()=>{
 for(const selection of [{preset:'lite',enabled:F.presets.lite},{preset:'custom',enabled:['motion','canvas-nav']}]){
  const f=earlyPage(JSON.stringify({preset:'full'}));
  f.env.chrome.runtime={sendMessage:async()=>({ok:true,...selection})};
  f.run('feature-loader.js');await f.env.ReserveFeatureLoad;
  assert.deepEqual(F.resolve(JSON.parse(f.values.get('reserve:features-hint'))).enabled,F.resolve({preset:selection.preset,enabled:selection.enabled}).enabled);
 }
});

test('Full adds frames to every menu link when course art arrives after static Canvas navigation',async()=>{
 for(const choice of ['shown','original']){
  const f=earlyPage(JSON.stringify({preset:'full'})),links=Array.from({length:5},(_,index)=>({
   id:'canvas-link-'+index,markup:[],
   querySelector(selector){return selector===':scope > .chn-frames'&&this.markup.length?this.markup[0]:null;},
   querySelectorAll:()=>[],insertAdjacentHTML(position,markup){assert.equal(position,'afterbegin');this.markup.push(markup);}
  }));
  const header={dataset:{},style:{setProperty(){}},querySelector:selector=>selector==='.ic-app-header__menu-list-link'?links[0]:null,querySelectorAll:selector=>{
   assert.equal(selector,'.ic-app-header__menu-list-link');return links;
  }};
  f.env.document.getElementById=id=>id==='header'?header:null;
  Object.assign(f.env,{addEventListener(){},setInterval(){},requestAnimationFrame:fn=>fn(),getComputedStyle:()=>({position:'fixed',backgroundColor:'rgb(255, 255, 255)',getPropertyValue:()=>''})});
  f.env.chrome.storage.local.get=async()=>({'reserve:canvasNav':choice});
  f.run('canvas-nav.js');await new Promise(setImmediate);
  assert.ok(f.env.ReserveCanvasNav);assert.equal(f.env.ReserveCourseArt,undefined);
  assert.ok(links.every(link=>link.markup.length===0));
  let inject,ready=0;
  f.env.document.addEventListener('reserve:features-ready',()=>{ready++;assert.ok(f.env.ReserveCourseArt);});
  f.env.chrome.runtime={sendMessage:()=>new Promise(resolve=>{inject=()=>{
   for(const file of ['subject-art-data.js','subject-art.js','generic-art.js','course-art.js'])f.run(file);
   resolve({ok:true,preset:'full',enabled:F.presets.full});
  };})};
  f.run('feature-loader.js');await new Promise(setImmediate);assert.equal(ready,0);
  inject();await f.env.ReserveFeatureLoad;
  const counts=()=>links.map(link=>(link.markup.join('').match(/class="(?:[^"]*\s)?rd-frame(?:\s|")/g)||[]).length);
  assert.deepEqual(counts(),choice==='shown'?[2,2,2,2,2]:[0,0,0,0,0]);
  assert.equal(ready,1,'completion is announced after deferred scripts finish');
  f.run('feature-loader.js');await f.env.ReserveFeatureLoad;assert.equal(ready,1,'bootstrap announces once');
  f.env.document.dispatchEvent(new Event('reserve:features-ready'));
  assert.deepEqual(counts(),choice==='shown'?[2,2,2,2,2]:[0,0,0,0,0],'no duplicate frames or activation of the original bar');
 }
});

test('feature storage changes immediately resolve the hint for the very next static document',async()=>{
 const f=earlyPage(JSON.stringify({preset:'full'}));
 f.env.chrome.runtime={sendMessage:async()=>({ok:true,preset:'full',enabled:F.presets.full})};
 f.run('feature-loader.js');await f.env.ReserveFeatureLoad;
 const initial=f.values.get('reserve:features-hint');
 f.change({'reserve:features':{newValue:{preset:'lite'}}},'sync');
 f.change({'reserve:unrelated':{newValue:{preset:'lite'}}});
 assert.equal(f.values.get('reserve:features-hint'),initial);
 for(const [prefs,preset,enabled]of [[{preset:'lite'},'lite',liteEnabled],[{preset:'custom',custom:['pony']},'custom',['dashboard','planner','pony']],[undefined,'full',F.presets.full]]){
  f.change({'reserve:features':{newValue:prefs}});
  const hint=f.values.get('reserve:features-hint');assert.deepEqual(JSON.parse(hint),{preset,enabled});
  assert.equal(f.env.ReserveFeatures.current.preset,'full','active document keeps its feature snapshot');
  const next=earlyPage(hint);for(const file of earlyScripts)next.run(file);
  assert.equal(!!next.env.ReserveCanvasNav,preset==='full');
  assert.equal(!!next.env.ReserveCourseNavArt,preset==='full');
  assert.equal(!!next.env.ReserveStartupArt,preset==='full');
 }
});

test('a pending loader reply cannot overwrite a newer feature hint',async()=>{
 const f=earlyPage(JSON.stringify({preset:'full'}));let reply;
 f.env.chrome.runtime={sendMessage:()=>new Promise(resolve=>{reply=resolve;})};
 f.run('feature-loader.js');await new Promise(setImmediate);
 f.change({'reserve:features':{newValue:{preset:'lite'}}});
 reply({ok:true,preset:'full',enabled:F.presets.full});await f.env.ReserveFeatureLoad;
 assert.deepEqual(JSON.parse(f.values.get('reserve:features-hint')),{preset:'lite',enabled:liteEnabled});
});

test('a pending early confirmation cannot overwrite a newer storage-change hint',async()=>{
 const f=earlyPage(JSON.stringify({preset:'full'}));let beforeWorker;
 for(const file of earlyScripts)f.run(file);
 f.env.chrome.runtime={sendMessage:async()=>{
  beforeWorker=JSON.parse(f.values.get('reserve:features-hint'));
  return {ok:true,preset:'lite',enabled:liteEnabled};
 }};
 f.run('feature-loader.js');await new Promise(setImmediate);
 f.change({'reserve:features':{newValue:{preset:'lite'}}});
 f.finish({preset:'full'});const reply=await f.env.ReserveFeatureLoad;
 assert.equal(reply.ok,true);assert.deepEqual(beforeWorker,{preset:'lite',enabled:liteEnabled},'the early read must preserve the newer hint before worker injection');
});
test('first-visit loader waits for static course art before requesting modules from the worker',async()=>{
 const f=earlyPage();let calls=0;
 for(const file of earlyScripts)f.run(file);
 f.env.chrome.runtime={sendMessage:async()=>{calls++;assert.ok(f.env.ReserveCourseNavArt);return {ok:true,preset:'full',enabled:F.presets.full};}};
 f.run('feature-loader.js');await new Promise(setImmediate);
 assert.equal(calls,0,'the worker must not inject modules-page.js before its static art dependency is ready');
 f.finish();await f.env.ReserveFeatureLoad;assert.equal(calls,1);
});
test('document selection survives worker restarts; reload reads current preferences',async()=>{
 const session=new Map(),first=worker({preset:'full'},session);assert.equal((await first.request()).preset,'full');
 first.setPrefs({preset:'lite'});assert.equal((await first.request()).preset,'full');
 const restarted=worker({preset:'lite'},session);assert.equal((await restarted.request()).preset,'full');
 const reloaded={...restarted.sender,documentId:'reloaded'};assert.equal((await restarted.request(undefined,reloaded)).preset,'lite');
 assert.equal((await restarted.request()).preset,'full');
});
test('feature loader rejects untrusted and non-top frames',async()=>{
 const w=worker({preset:'lite'});
 for(const patch of [{id:'foreign'},{frameId:1},{url:'https://example.org/'},{tab:null}]){
  const reply=await w.request(undefined,{...w.sender,...patch});assert.equal(reply.ok,false);
 }
 assert.equal(w.executions.length,0);
});

test('a navigation during the worker read rejects injection into a different document',async()=>{
 const w=worker();w.env.chrome.scripting.executeScript=async()=>[{documentId:'new-document'}];
 const reply=await w.request();assert.equal(reply.ok,false);assert.match(reply.error,/document changed/);
 assert.equal(w.executions.length,0);
});

test('loader failure releases the opening cover and leaves a newer hint intact',async()=>{
 const f=earlyPage(JSON.stringify({preset:'lite'}));let released=0;
 f.env.ReserveStartup={release:()=>released++};f.env.console={warn(){}};
 f.env.chrome.runtime={sendMessage:async()=>{throw Error('Worker unavailable');}};
 f.run('feature-loader.js');const reply=await f.env.ReserveFeatureLoad;
 assert.equal(reply.ok,false);assert.equal(released,1);assert.equal(JSON.parse(f.values.get('reserve:features-hint')).preset,'lite');
});

test('CommonJS catalogue imports do not change the shared test process globals',()=>{
 const env=vm.createContext({TextEncoder,TextDecoder,structuredClone,module:{exports:{}}});vm.runInContext(read('features.js'),env);
 assert.ok(env.module.exports.resolve);assert.equal(env.ReserveFeatures,undefined);
});

test('an unrelated Lite save preserves disabled feature preferences and custom SVGs',async()=>{
 const values={};const adapter={read:async key=>structuredClone(values[key]),write:async(key,value)=>{values[key]=structuredClone(value);}};
 const env=vm.createContext({TextEncoder,TextDecoder,structuredClone,URL,Intl,TextEncoder,TextDecoder,structuredClone,location:new URL('https://school.instructure.com/')});
 for(const file of ['features.js',...F.core.js.filter(file=>!['features.js','content.js','startup.js','feature-loader.js'].includes(file))])vm.runInContext(read(file),env,{filename:file});
 const store=env.ReserveStorage.createStore({accountId:'7',origin:'https://school.instructure.com',adapter});await store.load();
 const art=env.ReserveCustomArt.importSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><path d="M1 1H99" stroke="#123456"/></svg>','saved.svg');
 await store.update(data=>{data.pet={enabled:true,name:'Saved pony'};data.toolbox.aiAutoSend=true;data.toolbox.scratchpad='Keep my draft';data.gpa.weighted=true;data.settings.overviewArt={bannerArt:art};data.tasks['9']={notes:'Before',plannedDate:'2026-10-18'};});
 const before=store.get();env.ReserveFeatures.apply({preset:'lite'});
 await store.update(data=>{data.tasks['9'].notes='After';});
 const reload=env.ReserveStorage.createStore({accountId:'7',origin:'https://school.instructure.com',adapter}),saved=await reload.load();
 for(const name of ['pet','toolbox','gpa'])assert.deepEqual(json(saved[name]),json(before[name]),name);
 assert.deepEqual(json(saved.settings.overviewArt),json(before.settings.overviewArt));assert.equal(saved.tasks['9'].plannedDate,'2026-10-18');assert.equal(saved.tasks['9'].notes,'After');
 store.destroy();reload.destroy();
});

test('native Tools filters GPA styling and completes explicitly with no stylesheets',async()=>{
 for(const empty of [false,true]){
  const links=[],opened=[];
  class Element{
   constructor(tag){this.tag=tag;this.dataset={};this.style={setProperty(){}};this.textContent='';this.children=[];}
   setAttribute(){}addEventListener(){}removeEventListener(){}remove(){}
   append(child){this.children.push(child);if(child.tag==='link'){links.push(child);queueMicrotask(()=>child.onload?.());}}
  }
  const document={head:new Element('head'),body:new Element('body'),createElement:tag=>new Element(tag),addEventListener(){},removeEventListener(){}};
  const store={get:()=>({settings:{},focus:{}}),subscribe:()=>()=>{}};
  const env=vm.createContext({TextEncoder,TextDecoder,structuredClone,URL,Intl,document,setTimeout,clearTimeout,location:new URL('https://school.instructure.com/courses/7/pages/intro'),
   ReserveToolboxSession:{create:()=>({open:async()=>({store,user:{id:'7'},snapshot:{courses:[],assignments:[]}}),destroy(){}})},
   ReserveToolbox:{create:()=>({open:next=>opened.push(next),destroy(){},update(){},isOpen:()=>false})}});
  for(const file of ['features.js','site.js','core.js','native-tools.js'])vm.runInContext(read(file),env,{filename:file});
  env.ReserveFeatures.apply({preset:'custom',custom:['tools']});if(empty)env.ReserveFeatures.filterFiles=()=>[];
  const tools=env.ReserveNativeTools.create({button:new Element('button'),dockRoot:new Element('shadow'),client:{},createStore:()=>store,styleURL:file=>'extension://'+file});
  await tools.open('quick');assert.deepEqual(opened,['quick']);
  assert.equal(links.length,empty?0:4);assert.ok(!links.some(link=>link.href.endsWith('gpa.css')));
  assert.equal(new URL(env.ReserveNativeTools.dashboardURL({workspace:'grades',page:'week',appearance:true})).searchParams.has('workspace'),false);
  tools.destroy();
 }
});

test('local artwork packs default on and share the artwork editor dependencies',()=>{
 for(const prefs of [undefined,{preset:'full'},{preset:'custom'}]){
  const selection=F.resolve(prefs);assert.ok(selection.enabled.includes('quick-pack'));
  for(const file of ['quick-pack.js','quick-upload.js','quick-upload-ui.js'])assert.ok(selection.js.includes(file));
 }
 const selection=F.resolve({preset:'custom',custom:['quick-pack']});
 assert.deepEqual(selection.enabled,['dashboard','customization','course-art','quick-pack']);
 const entry=F.catalogue.find(f=>f.id==='quick-pack');assert.equal(entry.group,'Drawings');
 assert.deepEqual(entry.needs,['customization','course-art']);
 assert.equal(F.catalogue[F.catalogue.indexOf(entry)-1].id,'course-art');
 for(const file of ['custom-art.js','customization-model.js','storage.js'])
  assert.ok(selection.js.indexOf(file)<selection.js.indexOf('quick-pack.js'),file+' must precede the importer');
 for(const [before,after] of [['quick-pack.js','quick-upload.js'],['quick-upload.js','quick-upload-ui.js'],['quick-upload-ui.js','customize-ui.js']])
  assert.ok(selection.js.indexOf(before)<selection.js.indexOf(after),before+' must precede '+after);
 for(const prefs of [{preset:'lite'},{preset:'custom',custom:['customization','course-art']}])
  assert.ok(!F.resolve(prefs).js.some(file=>/^quick-(?:pack|upload)/.test(file)));
});


test('course file codecs load only for an explicit backup request in a trusted top document',async()=>{
 const w=worker({preset:'lite'});assert.equal((await w.request()).ok,true);
 assert.ok(!w.imports.includes('course-files.js'));assert.ok(!w.executions.some(call=>call.files?.includes('course-files.js')));
 w.env.fetch=async()=>{throw Error('Local backup must not fetch');};
 assert.equal((await w.request({target:'ch-course-files',op:'load'})).ok,true);
 const call=w.executions.at(-1);assert.deepEqual(json(call.files),['course-files.js']);assert.equal(call.world,'ISOLATED');assert.deepEqual(json(call.target),{tabId:12,documentIds:['document-one']});
 const before=w.executions.length;
 for(const bad of [{...w.sender,id:'other'},{...w.sender,frameId:1},{...w.sender,url:'https://attacker.test/'},{...w.sender,tab:undefined}])assert.equal((await w.request({target:'ch-course-files',op:'load'},bad)).ok,false);
 assert.equal((await w.request({target:'ch-course-files',op:'other'})).ok,false);assert.equal(w.executions.length,before);
});
