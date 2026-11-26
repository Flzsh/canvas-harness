'use strict';
// Roadmap item 8, its safety part (4.2): on an assignment's own pages (instructions, submitting, submission details,
// feedback) a switch turns Canvas Harness off there. Off means off on that page: nothing of ours drawn but the switch itself, nothing
// asked of the worker, nothing reloads; back on, it comes back at once. Kept per assignment in Canvas's own site storage.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const Site=require('../extension/site.js'),F=require('../extension/features.js');
const ORIGIN='https://school.instructure.com',KEY='reserve:page-off';
const tick=async(n=4)=>{for(let i=0;i<n;i++)await new Promise(setImmediate);};
function storage(initial=[]){const data=new Map(initial);return {data,getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};}
function site(route,local=storage()){const ctx=vm.createContext({URL,location:new URL(route,ORIGIN),localStorage:local,Date,Object,JSON,Number});vm.runInContext('globalThis.window=globalThis;',ctx);vm.runInContext(read('site.js'),ctx,{filename:'site.js'});return {S:ctx.ReserveSite,local};}

test('one key per assignment for every hand-in page, the query and hash ignored; every other page has none',()=>{
 const S=Site;
 for(const route of ['/courses/7/assignments/12','/courses/7/assignments/12/','/courses/7/assignments/12?module_item_id=25#x','/courses/7/assignments/12/submissions/42/feedback',
  '/courses/7/assignments/12/submissions/new','/courses/7/assignments/12/submit','/courses/7/assignments/12/upload','/courses/%37/assignments/%31%32/submissions/new'])
  assert.equal(S.pageKey(new URL(route,ORIGIN)),'7/12',route);
 for(const route of ['/','/courses/7','/courses/7/assignments','/courses/7/assignments/syllabus','/courses/7/assignments/12-other','/courses/7/pages/assignments/12','/courses/7/quizzes/3/take','/courses/7/discussion_topics/4','/courses/%XX/assignments/12'])
  assert.equal(S.pageKey(new URL(route,ORIGIN)),'',route);
 assert.equal(S.pageKey(null),'');assert.equal(S.pageKey({}),'');
});

test('off and on again per assignment, until switched back; storage that throws or holds anything else means on',()=>{
 const {S,local}=site('/courses/7/assignments/12/submissions/new');
 assert.equal(S.pageOff(),false);assert.equal(S.setPageOff(true),true);assert.equal(S.pageOff(),true);
 assert.equal(S.pageOff(new URL('/courses/7/assignments/12',ORIGIN)),true,'the same assignment\'s other pages');
 assert.equal(S.pageOff(new URL('/courses/7/assignments/13',ORIGIN)),false);assert.equal(S.pageOff(new URL('/courses/7/modules',ORIGIN)),false);
 assert.deepEqual(Object.keys(JSON.parse(local.data.get(KEY))),['7/12']);
 assert.equal(S.setPageOff(false),true);assert.equal(S.pageOff(),false);assert.equal(local.data.has(KEY),false,'nothing left behind when every page is back on');
 assert.equal(S.setPageOff(true,new URL('/courses/7/modules',ORIGIN)),false,'an ordinary page cannot be switched off');assert.equal(local.data.has(KEY),false);
 for(const junk of ['not json','[1,2]','"7/12"','null','{"7/12":"yes","x":1}']){const {S}=site('/courses/7/assignments/12',storage([[KEY,junk]]));assert.equal(S.pageOff(),false,junk);assert.equal(S.setPageOff(true),true,junk);assert.equal(S.pageOff(),true);}
 const broken={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');}};
 const b=site('/courses/7/assignments/12',broken);assert.equal(b.S.pageOff(),false);assert.equal(b.S.setPageOff(true),false);
});

test('the 100 most recent are kept, oldest out first, in about 2.5 KB',()=>{
 const {S,local}=site('/courses/7/assignments/1');
 for(let i=1;i<=130;i++)S.setPageOff(true,new URL('/courses/7/assignments/'+i,ORIGIN),1000+i);
 const kept=JSON.parse(local.data.get(KEY));assert.equal(Object.keys(kept).length,100);
 assert.equal(S.pageOff(new URL('/courses/7/assignments/30',ORIGIN)),false);assert.equal(S.pageOff(new URL('/courses/7/assignments/31',ORIGIN)),true);assert.equal(S.pageOff(new URL('/courses/7/assignments/130',ORIGIN)),true);
 assert.ok(local.data.get(KEY).length<3000,local.data.get(KEY).length+' bytes');
});

// A hand-in page with the drawn menu: site.js, features.js and canvas-nav.js as the manifest loads them.
function handIn({off=false,navEarly='drawer',hint=JSON.stringify({preset:'full'}),route='/courses/7/assignments/12'}={}){
 const classes=new Set(),storageListeners=[],windowListeners=new Set(),intervals=new Set(),nodes=[],boxClasses=new Set(),edges=new Set();
 const local=storage([['reserve:features-hint',hint],...(navEarly?[['reserve:navEarly',navEarly]]:[]),...(off?[[KEY,JSON.stringify({'7/12':1})]]:[])]);
 let finish;const stored=new Promise(resolve=>{finish=resolve;});
 const html={classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},dataset:{},style:{props:new Map(),setProperty(k,v){this.props.set(k,v);},removeProperty(k){this.props.delete(k);}}};
 const insert=markup=>{const node={markup,remove(){nodes.splice(nodes.indexOf(node),1);}};nodes.push(node);};
 const box={classList:{add:name=>boxClasses.add(name),remove:name=>boxClasses.delete(name)},insertAdjacentHTML:(_p,markup)=>insert(markup)};
 const badge={textContent:'',dataset:{}};
 const link={title:'',id:'global_nav_dashboard_link',removeAttribute(name){if(name==='title')this.title='';},querySelector:s=>s==='.menu-item-icon-container'?box:s==='.chn-ic'?nodes.find(n=>n.markup.includes('chn-ic')):s==='.menu-item__text'?{textContent:'Dashboard'}:null,querySelectorAll:s=>s==='.menu-item__badge'?[badge]:[],insertAdjacentHTML:(_p,markup)=>insert(markup)};
 const header={dataset:{},style:{props:new Map(),position:'',setProperty(k,v){this.props.set(k,v);},removeProperty(k){if(k==='position')this.position='';this.props.delete(k);}},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:84,bottom:600,width:84,height:600}),
  querySelector:s=>s==='.ic-app-header__menu-list-link'?link:null,
  querySelectorAll:s=>s==='.ic-app-header__menu-list-link'?[link]:s==='.chn-ic, .chn-frames, .chn-logo-art'?[...nodes]:s==='.chn-drawn'&&boxClasses.has('chn-drawn')?[box]:[]};
 const env=vm.createContext({URL,Event,console,JSON,Date,Object,Number,location:new URL(route,ORIGIN),
  document:{documentElement:html,readyState:'loading',body:{append:x=>edges.add(x)},createElement:()=>{const e={dataset:{},style:{},setAttribute(){},addEventListener(){},removeEventListener(){},remove(){edges.delete(e);}};return e;},getElementById:id=>id==='header'?header:null,querySelector:()=>null,addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}},AbortController,setTimeout:()=>0,clearTimeout(){},
  localStorage:local,addEventListener:(_t,fn)=>windowListeners.add(fn),removeEventListener:(_t,fn)=>windowListeners.delete(fn),
  setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn),requestAnimationFrame:fn=>fn(),
  getComputedStyle:()=>({position:'static',backgroundColor:'white',getPropertyValue:()=>''}),ReserveCourseArt:{frame:()=>'<svg></svg>'},
  MutationObserver:class{observe(){}disconnect(){}},
  chrome:{storage:{local:{get:key=>typeof key==='string'||key.includes('reserve:features')?stored:Promise.resolve({'reserve:canvasNav':'drawn'})},onChanged:{addListener:fn=>storageListeners.push(fn),removeListener:fn=>{const at=storageListeners.indexOf(fn);if(at>=0)storageListeners.splice(at,1);}}}}});
 env.window=env;env.top=env;
 const run=file=>vm.runInContext(read(file),env,{filename:file});
 for(const file of ['site.js','features.js','canvas-nav.js'])run(file);
 return {env,classes,html,header,link,nodes,edges,local,windowListeners,intervals,run,finish:prefs=>finish({'reserve:features':prefs})};
}

test('switched off at load: the menu never starts, not even its first-frame layout, and its hint for other pages stays',async()=>{
 const f=handIn({off:true});f.finish({preset:'full'});await tick();
 assert.equal(f.classes.size,0,'no html class at all');assert.deepEqual(Object.keys(f.html.dataset),[]);assert.equal(f.nodes.length,0);
 assert.equal(f.env.ReserveCanvasNav,undefined);assert.equal(f.windowListeners.size,0);assert.equal(f.intervals.size,0);
 assert.equal(f.local.data.get('reserve:navEarly'),'drawer','every other page still opens with the drawer');
 assert.equal(f.env.ReserveFeatures.current.off,true);assert.ok(f.env.ReserveFeatures.chosen.enabled.includes('canvas-nav'));
});

test('switched off live, the menu comes off at once and leaves Canvas\'s bar as it was; on again, it is back',async()=>{
 const f=handIn();f.finish({preset:'full'});await tick();
 assert.ok(f.classes.has('chn-nav'));assert.ok(f.env.ReserveCanvasNav);assert.equal(f.nodes.length,1);assert.equal(f.header.style.position,'relative');
 let told=0;f.env.ReserveFeatures.onApply(()=>told++);
 assert.equal(f.env.ReserveSite.setPageOff(true),true);f.env.ReserveFeatures.refresh();await tick();
 assert.equal(f.classes.size,0);assert.deepEqual(Object.keys(f.html.dataset),[]);assert.equal(f.nodes.length,0);assert.equal(f.env.ReserveCanvasNav,undefined);
 assert.equal(f.header.style.position,'','the position Canvas Harness gave the bar comes off');assert.equal(f.link.title,'','and the titles it gave its links');assert.deepEqual([...f.header.style.props.keys()].filter(k=>k.startsWith('--chn-')),[]);
 assert.equal(f.windowListeners.size,0);assert.equal(f.intervals.size,0);assert.equal(f.edges.size,0,'the drawer\'s edge is gone');
 assert.equal(f.local.data.get('reserve:navEarly'),'drawer','the first-frame hint for every other page is kept');
 assert.equal(told,1,'the page switch is told');
 f.env.ReserveSite.setPageOff(false);f.env.ReserveFeatures.refresh();await tick();
 assert.ok(f.classes.has('chn-nav'),'back on: the drawn menu again');assert.ok(f.env.ReserveCanvasNav);assert.equal(f.nodes.length,1);
});

test('"On Canvas" switched back on while the page is off here keeps it off here; off here and back on restores On Canvas\'s choice',async()=>{
 const f=handIn({off:true});f.finish({preset:'full'});await tick();
 f.env.ReserveFeatures.setSwitch(false);f.env.ReserveFeatures.setSwitch(true);await tick();
 assert.equal(f.classes.size,0,'still off here');
 f.env.ReserveSite.setPageOff(false);f.env.ReserveFeatures.refresh();await tick();assert.ok(f.classes.has('chn-nav'));
 f.env.ReserveFeatures.setSwitch(false);await tick();assert.equal(f.classes.size,0,'On Canvas off: off');
 f.env.ReserveFeatures.refresh();await tick();assert.equal(f.classes.size,0,'and refreshing does not undo On Canvas');
});

test('Edge running the menu before features.js: it is handed to the selection, so the switch still stops it live',async()=>{
 const f=handIn();
 // (rebuilt in the swapped order: canvas-nav first, then features.js)
 const g=vm.createContext({...f.env});g.window=g;g.top=g;delete g.ReserveFeatures;delete g.ReserveCanvasNav;
 for(const file of ['site.js','canvas-nav.js'])vm.runInContext(read(file),g,{filename:file});
 assert.ok(g.ReserveCanvasNavLate,'waiting for the selection');
 vm.runInContext(read('features.js'),g,{filename:'features.js'});assert.equal(g.ReserveCanvasNavLate,undefined);
 f.finish({preset:'full'});await tick();assert.ok(g.ReserveCanvasNav);
 g.ReserveSite.setPageOff(true);g.ReserveFeatures.refresh();await tick();assert.equal(g.ReserveCanvasNav,undefined);
});

function loader({route='/courses/7/assignments/12/submissions/new',off=false,ran=true}={}){
 const listeners=[],docListeners=new Map(),local=storage(off?[[KEY,JSON.stringify({'7/12':1})]]:[]),calls={reload:0,setSwitch:[],sent:[]},timers=[];
 const sandbox={console,URL,JSON,Date,Object,Number,setTimeout:(fn,ms)=>{timers.push({fn,ms,live:true});return timers.length;},clearTimeout(id){if(timers[id-1])timers[id-1].live=false;},
  location:Object.assign(new URL(route,ORIGIN),{reload(){calls.reload++;}}),localStorage:local,
  sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  document:{visibilityState:'visible',addEventListener:(type,fn)=>docListeners.set(type,fn),removeEventListener(){},dispatchEvent(){calls.events=(calls.events||0)+1;}},
  chrome:{runtime:{sendMessage:async message=>{calls.sent.push(message);return {ok:true,preset:'full',enabled:[]};}},storage:{onChanged:{addListener:fn=>listeners.push(fn)}}}};
 sandbox.window=sandbox;sandbox.top=sandbox;sandbox.globalThis=sandbox;
 const context=vm.createContext(sandbox);vm.runInContext(read('site.js'),context,{filename:'site.js'});
 context.ReserveFeatures={REGISTERED:'reserve:features:registered',ON:'reserve:enabled',earlyReady:Promise.resolve(),read:async()=>({'reserve:features:registered':{ok:true,preset:'full',enabled:['pdf']}}),
  apply(prefs){calls.applied=prefs;},resolve:()=>({preset:'full',enabled:['pdf']}),forDev30:prefs=>prefs,setSwitch:on=>calls.setSwitch.push(on),here:()=>context.ReserveSite.pageOff()};
 if(ran)context.ReserveFeatureScriptsRan=true;
 vm.runInContext(read('feature-loader.js'),context,{filename:'feature-loader.js'});
 return {calls,timers,docListeners,context,change:(newValue,oldValue)=>listeners.forEach(fn=>fn({'reserve:enabled':{newValue,oldValue}},'local')),registered:value=>listeners.forEach(fn=>fn({'reserve:features:registered':{newValue:value}},'local'))};
}

test('an assignment or submission page is never reloaded by Canvas Harness: not for "On Canvas", not for a silent worker',async()=>{
 let p=loader();await p.context.ReserveFeatureLoad;
 assert.equal(p.docListeners.has('input'),false,'nothing watches the typing there');
 assert.equal(p.timers.filter(t=>t.ms===25000).length,0,'no 25 s stall reload armed');
 p.change(false,true);p.change(true,false);p.registered({ok:true,preset:'full',enabled:['pdf']});p.timers.forEach(t=>t.live&&t.fn());
 assert.equal(p.calls.reload,0);assert.deepEqual(p.calls.setSwitch,[false,true],'what Canvas Harness draws there follows the switch at once instead');
 assert.equal(p.calls.events||0,0,'no page event either');
 // an ordinary course page still reloads as before
 const q=loader({route:'/courses/7/grades'});q.change(false,true);assert.equal(q.calls.reload,1);assert.equal(q.docListeners.has('input'),true);
});



// The selection as features.js gives it, small enough to drive one add-on: early(id,start,stop) and enabled(id).
function selection(on=true){const effects=[];let enabled=on;return {early(id,start,stop){let started=false;const r=()=>{if(enabled&&!started){started=true;start();}else if(!enabled&&started){started=false;stop();}};effects.push(r);r();},enabled:()=>enabled,set(value){enabled=value;effects.forEach(r=>r());}};}



test('the PDF reader follows the selection on the page: off closes it and gives every click back, on starts it afresh',async()=>{
 const doc={readyState:'complete',body:{},head:{},addEventListener(type,fn,capture){(this.l??=[]).push([type,fn,capture]);},removeEventListener(type,fn,capture){this.l=this.l.filter(x=>!(x[0]===type&&x[1]===fn&&x[2]===capture));},getElementById:()=>null,createElement:()=>({style:{},setAttribute(){},append(){},remove(){}})};
 const F=selection(true);
 const ctx={document:doc,location:Object.assign(new URL('/courses/7/assignments/12',ORIGIN)),ReserveSite:Site,ReserveFeatures:F,ReservePdfModel:require('../extension/pdf-model.js'),URL,
  chrome:{runtime:{id:'x',getURL:f=>f},storage:{local:{get:async()=>({})}}},setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},sessionStorage:storage()};
 ctx.window=ctx;ctx.globalThis=ctx;
 vm.runInNewContext(read('pdf-host.js'),ctx,{filename:'pdf-host.js'});await tick();
 const first=ctx.ReservePdfHostController;assert.ok(first);assert.equal(doc.l.filter(x=>x[0]==='click').length,1,'one click listener');
 F.set(false);assert.equal(ctx.ReservePdfHostController,null);assert.equal(doc.l.filter(x=>x[0]==='click').length,0,'no listener left');
 F.set(true);await tick();assert.ok(ctx.ReservePdfHostController&&ctx.ReservePdfHostController!==first,'a fresh reader');assert.equal(doc.l.filter(x=>x[0]==='click').length,1);
});

// The switch itself, in a small stand-in for Canvas's page.
function page({route='/courses/7/assignments/12',crumbs=true,local=storage(),features,frame=false}={}){
 const placed=[];let refreshed=0;
 const el=tag=>{const e={tagName:tag.toUpperCase(),attrs:{},hidden:false,setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];},
  attachShadow(){const shadow={html:'',set innerHTML(v){this.html=v;},get innerHTML(){return this.html;},querySelector:s=>s==='.sw'?button:s==='.t'?title:null};e.shadow=shadow;return shadow;}};return e;};
 const button={attrs:{'aria-checked':'true'},listeners:{},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},addEventListener(t,fn){this.listeners[t]=fn;},querySelector:s=>s==='.t'?title:null};
 const title={textContent:''};
 const row={append:x=>placed.push(['crumbs',x]),getClientRects:()=>crumbs?[{}]:[]},content={prepend:x=>placed.push(['content',x])};
 const winListeners={};
 const ctx={URL,JSON,Date,Object,Number,location:new URL(route,ORIGIN),localStorage:local,
  document:{readyState:'complete',body:{},createElement:el,querySelector:s=>s==='.ic-app-nav-toggle-and-crumbs'?row:null,getElementById:id=>id==='content'?content:null,addEventListener(){}},
  addEventListener:(t,fn)=>{winListeners[t]=fn;},chrome:{runtime:{getManifest:()=>({short_name:'Canvas Harness'})}}};
 ctx.window=ctx;ctx.top=frame?{}:ctx;
 vm.runInNewContext(read('site.js'),ctx,{filename:'site.js'});
 if(features!==false)ctx.ReserveFeatures=features||{OFFHINT:'reserve:off',chosen:{enabled:['canvas-nav','pdf','play']},refresh(){refreshed++;},onApply(fn){ctx.told=fn;}};
 vm.runInNewContext(read('page-switch.js'),ctx,{filename:'page-switch.js'});
 return {ctx,placed,button,title,local,winListeners,get refreshed(){return refreshed;},host:()=>ctx.ReservePageSwitch?.host};
}

test('the switch sits at the end of Canvas\'s breadcrumb row, in the page\'s flow, a drawing and a name, role switch',()=>{
 const p=page();assert.equal(p.placed.length,1);assert.equal(p.placed[0][0],'crumbs');
 const host=p.host(),html=host.shadow.html;
 assert.equal(host.hidden,false);assert.equal(p.button.getAttribute('aria-checked'),'true');assert.equal(p.title.textContent,'Canvas Harness on this page');
 assert.match(html,/role="switch"/);assert.match(html,/<svg class="ic"/,'the Canvas Harness drawing (the dock button\'s books)');assert.match(html,/<svg class="kn"/,'the drawn knob');
 assert.doesNotMatch(html,/position:\s*(fixed|sticky|absolute)[^;]*;[^}]*}\s*\.sw\{/,'');assert.doesNotMatch(html.replace(/\.sw::after\{[^}]*\}/,''),/position:\s*(fixed|sticky)/,'never fixed or sticky: it cannot cover Submit');
 const note=html.match(/<span class="note"[^>]*>([^<]*)</)[1];assert.ok(note.length<=60,note);assert.match(note,/Submitting/);
 // a window without the breadcrumb row: the top of the page's content
 const q=page({crumbs:false});assert.equal(q.placed[0][0],'content');assert.equal(q.host().getAttribute('data-place'),'content');
});

test('pressing it switches this assignment off and the page follows at once; pressing again brings it back',()=>{
 const p=page();p.button.listeners.click();
 assert.equal(p.ctx.ReserveSite.pageOff(),true);assert.equal(p.refreshed,1);assert.equal(p.button.getAttribute('aria-checked'),'false');assert.equal(p.host().hidden,false,'still there to turn it back on');
 p.button.listeners.click();assert.equal(p.ctx.ReserveSite.pageOff(),false);assert.equal(p.refreshed,2);assert.equal(p.button.getAttribute('aria-checked'),'true');
 // another tab switched it: this one follows
 p.local.setItem(KEY,JSON.stringify({'7/12':5}));p.winListeners.storage({key:KEY});assert.equal(p.button.getAttribute('aria-checked'),'false');assert.equal(p.refreshed,3);
});

test('not shown while "On Canvas" is off everywhere, or where Canvas Harness has nothing of its own on the page; never off a hand-in page or in a frame',()=>{
 const off=page({local:storage([['reserve:off','1']])});assert.equal(off.host(),null,'On Canvas off: nothing of Canvas Harness on the page, not even the switch hidden (4.1.0: off leaves Canvas pages alone)');
 const lite=page({features:{OFFHINT:'reserve:off',chosen:{enabled:['dashboard','planner']},refresh(){},onApply(){}}});assert.equal(lite.host().hidden,true);
 const offHere=page({local:storage([[KEY,JSON.stringify({'7/12':1})]]),features:{OFFHINT:'reserve:off',chosen:{enabled:['dashboard']},refresh(){},onApply(){}}});assert.equal(offHere.host().hidden,false,'while off here it is always the way back');assert.equal(offHere.button.getAttribute('aria-checked'),'false');
 const broken=page({features:false});assert.equal(broken.host().hidden,false,'with the selection missing (something broke) the switch still works');
 broken.button.listeners.click();assert.equal(broken.ctx.ReserveSite.pageOff(),true);
 for(const route of ['/','/courses/7/modules','/courses/7/quizzes/3/take','/courses/7/discussion_topics/4']){const q=page({route});assert.equal(q.placed.length,0,route);assert.equal(q.ctx.ReservePageSwitch,undefined,route);}
 const framed=page({frame:true});assert.equal(framed.placed.length,0);
 // On Canvas switched on again while the page is open: the selection tells the switch
 const p=page({local:storage([['reserve:off','1']])});assert.equal(p.host(),null);p.local.removeItem('reserve:off');p.ctx.told();assert.equal(p.host()?.hidden,false,'mounted and shown once the page is on again');
});

test('the manifest loads the switch with the page-start group, in the top frame only, and site.js before the selection',()=>{
 const manifest=JSON.parse(read('manifest.json')),group=manifest.content_scripts.find(g=>g.js.includes('page-switch.js'));
 assert.deepEqual(group.js,['site.js','features.js','startup-art.js','startup.js','page-switch.js']);assert.equal(group.all_frames,false);assert.equal(group.run_at,'document_start');
 assert.ok(F.core.js.includes('page-switch.js'));assert.ok(!F.resolve().js.includes('page-switch.js'),'never registered as an add-on');
});
