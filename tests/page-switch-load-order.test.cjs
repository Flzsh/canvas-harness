'use strict';
// fix-42 (review-42 findings 1, 5 and 8): "Canvas Harness on this page" switched off means nothing of Canvas Harness on the page in both orders
// Edge runs the content-script groups in (the drawn menu started before features.js is handed over as running, so the
// selection stops it), also when "On Canvas" changes while the page is open; switched back on, the page gets the
// student's own preset, never a made-up Full; and the switch waits a few seconds for its place when Canvas draws it late,
// following other tabs from the start. (The switch's own hidden node while "On Canvas" is off is the owner's decision
// and is not changed here.)
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const F=require('../extension/features.js');
const ORIGIN='https://school.instructure.com',KEY='reserve:page-off';
const MANIFEST=['site.js','features.js','canvas-nav.js'],EDGE=['site.js','canvas-nav.js','site.js','features.js'];
const tick=async(n=6)=>{for(let i=0;i<n;i++)await new Promise(setImmediate);};
function storage(initial=[]){const data=new Map(initial);return {data,getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};}
// A hand-in page with the drawn menu (as tests/page-switch.test.cjs), loaded in either order.
function handIn({off=false,everywhereOff=false,navEarly='drawer',hint=JSON.stringify({preset:'full'}),route='/courses/7/assignments/12',order=MANIFEST}={}){
 const classes=new Set(),windowListeners=new Set(),intervals=new Set(),nodes=[],boxClasses=new Set(),edges=new Set();
 const local=storage([...(hint?[['reserve:features-hint',hint]]:[]),...(navEarly?[['reserve:navEarly',navEarly]]:[]),...(off?[[KEY,JSON.stringify({'7/12':1})]]:[]),...(everywhereOff?[['reserve:off','1']]:[])]);
 let finish;const stored=new Promise(resolve=>{finish=resolve;});
 const html={classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},dataset:{},style:{props:new Map(),setProperty(k,v){this.props.set(k,v);},removeProperty(k){this.props.delete(k);}}};
 const insert=markup=>{const node={markup,remove(){nodes.splice(nodes.indexOf(node),1);}};nodes.push(node);};
 const box={classList:{add:name=>boxClasses.add(name),remove:name=>boxClasses.delete(name)},insertAdjacentHTML:(_p,markup)=>insert(markup)};
 const link={title:'',id:'global_nav_dashboard_link',removeAttribute(name){if(name==='title')this.title='';},querySelector:s=>s==='.menu-item-icon-container'?box:s==='.chn-ic'?nodes.find(n=>n.markup.includes('chn-ic')):s==='.menu-item__text'?{textContent:'Dashboard'}:null,querySelectorAll:s=>s==='.menu-item__badge'?[{textContent:'',dataset:{}}]:[],insertAdjacentHTML:(_p,markup)=>insert(markup)};
 const header={dataset:{},style:{props:new Map(),position:'',setProperty(k,v){this.props.set(k,v);},removeProperty(k){if(k==='position')this.position='';this.props.delete(k);}},addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:84,bottom:600,width:84,height:600}),
  querySelector:s=>s==='.ic-app-header__menu-list-link'?link:null,
  querySelectorAll:s=>s==='.ic-app-header__menu-list-link'?[link]:s==='.chn-ic, .chn-frames, .chn-logo-art'?[...nodes]:s==='.chn-drawn'&&boxClasses.has('chn-drawn')?[box]:[]};
 const env=vm.createContext({URL,Event,console,JSON,Date,Object,Number,location:new URL(route,ORIGIN),
  document:{documentElement:html,readyState:'loading',body:{append:x=>edges.add(x)},createElement:()=>{const e={dataset:{},style:{},setAttribute(){},addEventListener(){},removeEventListener(){},remove(){edges.delete(e);}};return e;},getElementById:id=>id==='header'?header:null,querySelector:()=>null,addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}},AbortController,setTimeout:()=>0,clearTimeout(){},
  localStorage:local,addEventListener:(_t,fn)=>windowListeners.add(fn),removeEventListener:(_t,fn)=>windowListeners.delete(fn),
  setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn),requestAnimationFrame:fn=>fn(),
  getComputedStyle:()=>({position:'static',backgroundColor:'white',getPropertyValue:()=>''}),ReserveCourseArt:{frame:()=>'<svg></svg>'},
  MutationObserver:class{observe(){}disconnect(){}},
  chrome:{storage:{local:{get:key=>typeof key==='string'||key.includes('reserve:features')?stored:Promise.resolve({'reserve:canvasNav':'drawn','reserve:enabled':!everywhereOff})},onChanged:{addListener(){},removeListener(){}}}}});
 env.window=env;env.top=env;
 for(const file of order)vm.runInContext(read(file),env,{filename:file});
 const left=()=>({htmlClasses:[...classes],htmlData:Object.keys(html.dataset),menuApi:!!env.ReserveCanvasNav,drawn:nodes.length,windowListeners:windowListeners.size,intervals:intervals.size});
 return {env,classes,nodes,local,left,finish:(prefs,extra={})=>finish({'reserve:features':prefs,...extra})};
}
const NOTHING={htmlClasses:[],htmlData:[],menuApi:false,drawn:0,windowListeners:0,intervals:0};

test('switched off here at load: nothing of the menu on the page in either order, with or without the first-frame hint',async()=>{
 for(const order of [MANIFEST,EDGE])for(const hint of [JSON.stringify({preset:'full'}),null]){
  const f=handIn({off:true,order,hint}),label=order.join(' ')+(hint?'':' (no hint)');
  if(order===EDGE)assert.deepEqual(f.left(),NOTHING,label+': not even before the saved choice is read');
  f.finish({preset:'full'});await tick();
  assert.equal(f.env.ReserveFeatures.current.off,true,label);assert.deepEqual(f.left(),NOTHING,label);
  assert.equal(f.env.ReserveCanvasNavLate,undefined,label+': handed over');assert.equal(f.local.data.get('reserve:navEarly'),'drawer',label+': every other page still opens with the drawer');
 }
});

test('Edge\'s order, switched off here: "On Canvas" off and on again keeps it off; back on here the menu comes, off again it goes',async()=>{
 const f=handIn({off:true,order:EDGE});f.finish({preset:'full'});await tick();
 f.env.ReserveFeatures.setSwitch(false);await tick();assert.deepEqual(f.left(),NOTHING,'On Canvas off');
 f.env.ReserveFeatures.setSwitch(true);await tick();assert.deepEqual(f.left(),NOTHING,'On Canvas on again: still off here');
 f.env.ReserveSite.setPageOff(false);f.env.ReserveFeatures.refresh();await tick();
 assert.ok(f.classes.has('chn-nav'),'on here: the drawn menu');assert.ok(f.env.ReserveCanvasNav);assert.equal(f.nodes.length,1);
 f.env.ReserveSite.setPageOff(true);f.env.ReserveFeatures.refresh();await tick();assert.deepEqual(f.left(),NOTHING,'off here again');
});

test('Edge\'s order, on here: the menu already started is not started twice, and "On Canvas" turned off live takes it off',async()=>{
 const f=handIn({order:EDGE});f.finish({preset:'full'});await tick();
 assert.ok(f.classes.has('chn-nav'));assert.equal(f.nodes.length,1,'one drawn menu');
 f.env.ReserveFeatures.setSwitch(false);await tick();assert.deepEqual(f.left(),NOTHING,'On Canvas off: nothing left');
 f.env.ReserveFeatures.setSwitch(true);await tick();assert.ok(f.classes.has('chn-nav'),'on again: back');assert.equal(f.nodes.length,1);
});

test('Edge\'s order with "On Canvas" off everywhere: the menu that started first is taken off as the selection arrives',async()=>{
 const f=handIn({everywhereOff:true,order:EDGE});
 assert.deepEqual(f.left(),NOTHING,'stopped as soon as features.js runs (its hint says off)');
 f.finish({preset:'full'},{'reserve:enabled':false});await tick();assert.deepEqual(f.left(),NOTHING);assert.equal(f.env.ReserveFeatures.current.off,true);
});

// The loader on a page switched off here (real site.js, features.js and feature-loader.js; nothing asked of the worker).
async function loader({saved={},route='/courses/7/assignments/12'}){
 const local=storage([[KEY,JSON.stringify({'7/12':1})],['reserve:features-hint',JSON.stringify({preset:'lite',enabled:['dashboard']})]]),sent=[];
 const ctx={URL,JSON,Date,Object,Number,Promise,Error,console:{warn(){},log(){}},Event,location:Object.assign(new URL(route,ORIGIN),{reload(){throw Error('reloaded');}}),
  localStorage:local,sessionStorage:storage(),setTimeout:fn=>{setImmediate(fn);return 1;},clearTimeout(){},
  document:{visibilityState:'visible',addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}},
  chrome:{runtime:{sendMessage:async m=>{sent.push(m);return {ok:true,preset:'full',enabled:[]};}},storage:{local:{get:async()=>structuredClone(saved)},onChanged:{addListener(){}}}}};
 ctx.window=ctx;ctx.top=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
 for(const file of ['site.js','features.js'])vm.runInContext(read(file),ctx,{filename:file});
 ctx.ReserveFeatures.early('pdf',()=>{},()=>{});
 vm.runInContext(read('feature-loader.js'),ctx,{filename:'feature-loader.js'});
 const reply=await ctx.ReserveFeatureLoad;await tick(8);
 const back=()=>{ctx.ReserveSite.setPageOff(false);ctx.ReserveFeatures.refresh();return ctx.ReserveFeatures.current;};
 return {ctx,sent,reply,back,local};
}
// what the worker selects from the same saved data (background.js canvasPrefs)
const worker=saved=>F.resolve(F.forSwitch(saved['reserve:features'],saved['reserve:enabled']===false?false:true));


// The switch itself on a page whose breadcrumb row and content Canvas draws after the page is ready.
function late({crumbs=false,content=false}={}){
 const placed=[],observers=[],timers=new Map(),local=storage(),winListeners={};let tid=0,rects=0,refreshed=0;
 const el=tag=>{const e={tagName:tag.toUpperCase(),attrs:{},hidden:false,setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},removeAttribute(k){delete this.attrs[k];},
  attachShadow(){const shadow={html:'',set innerHTML(v){this.html=v;},get innerHTML(){return this.html;},querySelector:s=>s==='.sw'?button:s==='.t'?{textContent:''}:null};return shadow;}};return e;};
 const button={attrs:{'aria-checked':'true'},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},addEventListener(){},querySelector:()=>({textContent:''})};
 const state={crumbs,content},row={append:x=>placed.push(['crumbs',x]),getClientRects:()=>{rects++;return [{}];}},box={prepend:x=>placed.push(['content',x])};
 const ctx={URL,JSON,Date,Object,Number,location:new URL('/courses/7/assignments/12/submissions/new',ORIGIN),localStorage:local,
  document:{readyState:'complete',body:{},documentElement:{},createElement:el,querySelector:s=>s==='.ic-app-nav-toggle-and-crumbs'&&state.crumbs?row:null,getElementById:id=>id==='content'&&state.content?box:null,addEventListener(){}},
  addEventListener:(t,fn)=>{winListeners[t]=fn;},setTimeout:(fn,ms)=>{timers.set(++tid,{fn,ms});return tid;},clearTimeout:id=>timers.delete(id),
  MutationObserver:class{constructor(fn){this.fn=fn;this.on=false;observers.push(this);}observe(){this.on=true;}disconnect(){this.on=false;}},chrome:{runtime:{getManifest:()=>({short_name:'Canvas Harness'})}}};
 ctx.window=ctx;ctx.top=ctx;
 vm.runInNewContext(read('site.js'),ctx,{filename:'site.js'});
 ctx.ReserveFeatures={OFFHINT:'reserve:off',chosen:{enabled:['canvas-nav','pdf','play']},refresh(){refreshed++;},onApply(){}};
 vm.runInNewContext(read('page-switch.js'),ctx,{filename:'page-switch.js'});
 return {ctx,placed,observers,timers,state,local,winListeners,get rects(){return rects;},get refreshed(){return refreshed;},changed(){for(const o of observers)if(o.on)o.fn([]);}};
}

test('the switch waits a few seconds for its place, cheaply, and follows another tab from the start',()=>{
 const p=late();assert.equal(p.placed.length,0);assert.equal(p.observers.length,1);assert.equal(p.observers[0].on,true,'watching for its place');
 assert.equal([...p.timers.values()][0]?.ms,8000,'for 8 s at most');
 // another tab switches this assignment off before the switch has its place: this page follows at once
 p.local.setItem(KEY,JSON.stringify({'7/12':5}));p.winListeners.storage({key:KEY});assert.equal(p.refreshed,1);
 p.changed();p.changed();assert.equal(p.placed.length,0);assert.equal(p.rects,0,'nothing measured while neither place is there');
 p.state.crumbs=true;p.changed();assert.deepEqual(p.placed.map(x=>x[0]),['crumbs']);assert.equal(p.observers[0].on,false,'placed: no more watching');assert.equal(p.timers.size,0);
 assert.equal(p.ctx.ReservePageSwitch.host.hidden,false,'shown in its place');
 // the content arriving instead of the row; and a page where neither ever comes: let go after the wait
 const q=late();q.state.content=true;q.changed();assert.deepEqual(q.placed.map(x=>x[0]),['content']);
 const r=late();[...r.timers.values()][0].fn();assert.equal(r.observers[0].on,false,'let go after 8 s');r.state.crumbs=true;r.changed();assert.equal(r.placed.length,0);
 assert.equal(typeof r.winListeners.storage,'function','still follows other tabs');
 // already there when the page is ready: placed at once, nothing watched
 const s=late({crumbs:true});assert.equal(s.placed.length,1);assert.equal(s.observers.length,0);assert.equal(s.timers.size,0);
});
