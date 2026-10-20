'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const manifest=JSON.parse(read('manifest.json'));
const protectedRoutes=[
 '/courses/7/assignments/12','/courses/7/assignments/12/',
 '/courses/7/assignments/12?module_item_id=25','/courses/7/assignments/12/?module_item_id=25#assignment_show',
 '/courses/7/assignments/12?reserve=open&appearance=true',
 '/courses/7/assignments/12#submit_assignment',
 '/courses/7/assignments/12/submissions','/courses/7/assignments/12/submissions/',
 '/courses/7/assignments/12/submissions/42','/courses/7/assignments/12/submissions/42/',
 '/courses/7/assignments/12/submissions/42?preview=1#feedback',
 '/courses/7/assignments/12/submissions/42/feedback',
 '/courses/7/assignments/12/submissions/new','/courses/7/assignments/12/submissions/new?module_item_id=25',
 '/courses/7/assignments/12/submit','/courses/7/assignments/12/upload',
 '/courses/%37/assignments/%31%32/submissions/new'
];
const ordinaryRoutes=[
 '/','/dashboard','/dashboard/','/courses/7','/courses/7/',
 '/courses/7/modules','/courses/7/modules/items/25','/courses/7/pages','/courses/7/pages/intro',
 '/courses/7/files','/courses/7/files/12','/courses/7/assignments','/courses/7/assignments/',
 '/courses/7/assignments/syllabus','/courses/7/grades','/courses/7/assignments/12-other',
 '/courses/7/pages/assignments/12','/courses/7/modules?next=/courses/7/assignments/12',
 '/courses/7/files/12#submission','/dashboard?module_item_id=25'
];
function context(route){
 const attempts=[],allowedClicks=[],forbidden=label=>(...args)=>{attempts.push([label,...args]);throw Error('Unexpected page effect: '+label);};
 let executing='';
 const document=new Proxy({}, {get:(_target,key)=>{
  if(key==='addEventListener'&&executing==='pdf-host.js')return (type,handler,capture)=>{
   assert.equal(type,'click');assert.equal(typeof handler,'function');assert.equal(capture,true);
   assert.equal(allowedClicks.length,0,'Only one delegated PDF click handler may exist at rest');allowedClicks.push(handler);
  };
  return forbidden('document.'+String(key))();
 }});
 const env=vm.createContext({URL,URLSearchParams,Intl,Date,TextEncoder,TextDecoder,Uint8Array,structuredClone,AbortController,AbortSignal,
  location:new URL(route,'https://school.instructure.com'),document,navigator:{platform:'Win32'},
  addEventListener:forbidden('window.addEventListener'),removeEventListener:forbidden('window.removeEventListener'),
  setTimeout:forbidden('setTimeout'),setInterval:forbidden('setInterval'),clearTimeout:forbidden('clearTimeout'),clearInterval:forbidden('clearInterval'),
  matchMedia:forbidden('matchMedia'),fetch:forbidden('fetch'),open:forbidden('open'),
  MutationObserver:forbidden('MutationObserver'),ResizeObserver:forbidden('ResizeObserver'),
  sessionStorage:{getItem:forbidden('sessionStorage.getItem')},
  chrome:{runtime:{getURL:forbidden('runtime.getURL'),onMessage:{addListener:forbidden('runtime.addListener')}},storage:{local:{get:forbidden('storage.get'),set:forbidden('storage.set')},onChanged:{addListener:forbidden('storage.addListener')}}}});
 vm.runInContext('window=globalThis; top=globalThis;',env);
 vm.runInContext(read('site.js'),env,{filename:'site.js'});
 return {env,attempts,allowedClicks,run:file=>{executing=file;try{return vm.runInContext(read(file),env,{filename:file});}finally{executing='';}}};
}

test('vanillaPage recognizes assignment, feedback and submit/upload URLs independently of query/hash and host',()=>{
 for(const route of protectedRoutes){
  const h=context(route),S=h.env.ReserveSite;
  for(const value of [route,new URL(route,'https://canvas.school.edu'),{pathname:new URL(route,'https://school.instructure.com').pathname}])assert.equal(S.vanillaPage(value),true,route);
  assert.equal(S.vanillaPage(),true,route);
  assert.deepEqual(h.attempts,[]);
 }
 for(const route of ordinaryRoutes){const h=context(route);assert.equal(h.env.ReserveSite.vanillaPage(route),false,route);assert.equal(h.env.ReserveSite.vanillaPage(),false,route);}
 const {env}=context('/');for(const value of [null,undefined,{},'https://[bad','/courses/%XX/assignments/12'])assert.equal(env.ReserveSite.vanillaPage(value),false);
});

test('every content script except the allowed global menu loads on vanilla pages without any page effects',()=>{
 const scripts=manifest.content_scripts.flatMap(entry=>entry.js||[]).filter(file=>file!=='canvas-nav.js');
 for(const route of protectedRoutes){
  const h=context(route);
  for(const file of scripts)assert.doesNotThrow(()=>h.run(file),route+' '+file);
  assert.deepEqual(h.attempts,[],route);assert.equal(h.allowedClicks.length,1,'One dormant PDF capture click listener');
  assert.equal(h.env.ReserveContentStarted,undefined);assert.equal(h.env.ReserveStartup,undefined);
 }
});

test('native appearance/tools, toolbox, resize, settings, widgets and pony cannot mount directly on vanilla pages',()=>{
 for(const route of protectedRoutes){
  const h=context(route);
  for(const file of ['native-appearance.js','native-page.js','native-tools.js','toolbox.js','toolbox-resize.js','settings-dock.js','widgets.js','pets.js'])h.run(file);
  const E=h.env;
  // Empty options deliberately expose any access to a DOM container, API,
  // preferences, media or store before the shared route guard.
  for(const [feature,create] of [
   ['native appearance',()=>E.ReserveNativePage.create()],['native tools',()=>E.ReserveNativeTools.create()],
   ['page-wide tool layout',()=>E.ReserveNativeTools.pageDock({})],['toolbox',()=>E.ReserveToolbox.create({})],
   ['toolbox resizing',()=>E.ReserveToolboxResize.create({})],['settings',()=>E.ReserveSettingsDock.createDock({})],
   ['widgets',()=>E.ReserveWidgets.create({})],['pony',()=>E.ReservePets.create({})]
  ])assert.equal(create(),null,feature+' '+route);
  assert.deepEqual(h.attempts,[],route);
 }
});

test('the drawn menu remains an independent global chrome entry point',()=>{
 const h=context(protectedRoutes[0]),reads=[];
 h.env.chrome.storage.local.get=keys=>{reads.push(keys);return Promise.resolve({'reserve:enabled':false});};
 // The menu intentionally reads the root to prepare its controller, while all
 // page features above are prevented from even reaching the DOM.
 h.env.document={documentElement:{}};
 h.run('canvas-nav.js');
 assert.ok(h.env.ReserveCanvasNav);assert.equal(reads.length,1);assert.deepEqual(h.attempts,[]);
});
