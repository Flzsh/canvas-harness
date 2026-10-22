const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(pathname='/',search='',{deferDashboard=false,lateSite=false}={}){
 const nodes=new Map(),events={},winEvents={};
 class El{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.hidden=false;this.style={};this.events={};this.dataset={};this._query={};}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  append(...items){for(const el of items){this.children.push(el);el.parentElement=this;}}
  attachShadow(){return this.shadowRoot=new El('shadow');}
  addEventListener(name,fn){this.events[name]=fn;}
  setAttribute(name,value){this[name]=value;}
  contains(el){return this===el||this.children.some(child=>child.contains(el));}
  set innerHTML(value){this._html=value;for(const key of ['button','span','[data-dashboard]','[data-native]'])this._query[key]=new El(key);}
  querySelector(key){return this._query[key]||null;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);}
  scrollIntoView(){}
 }
 const body=new El('body'),head=new El('head'),html=new El('html'),classes=new Set();html.classList={add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),contains:name=>classes.has(name)};
 const content=new El();content.id='content';const native=new El();native.id='dashboard';const sidebar=new El();sidebar.id='right-side';content.append(native);const application=new El();application.id='application';application.append(content,sidebar);body.append(application);
 const document={body,head,documentElement:html,visibilityState:'visible',getElementById:id=>nodes.get(id),createElement:tag=>new El(tag),addEventListener:(key,fn)=>events[key]=fn};
 let callbacks,started=0,dashboardOptions,plannerOptions,scrollRestored,nativeToolsCreated=0,mounts=0,painted=!deferDashboard;const statuses=[];
 const window={scrollY:460,scrollTo:(options)=>scrollRestored=options.top,addEventListener:(key,fn)=>winEvents[key]=fn};window.top=window;
 const session={start(){started++;},refresh:async()=>null,verify:async()=>true,destroy(){}};
 const mockView=()=>({destroy(){},setStatus:message=>statuses.push(message),updateSnapshot(){},getState:()=>({query:'gas',mode:'tomorrow',courseId:'7',day:'',limit:60})});
 const context={document,window,requestAnimationFrame:fn=>fn(),setTimeout,location:{origin:'https://school.instructure.com',pathname,search},URL,URLSearchParams,Date,
  sessionStorage:{setItem(){},removeItem(){},getItem:()=>null},
  // This fixture isolates controller behavior; startup.test.cjs runs the real guard.
  ReserveStartup:{canReveal:()=>true,complete:()=>true,release(){},onNative(){}},
  chrome:{storage:{local:{get:async()=>({})}},runtime:{getURL:name=>'chrome-extension://fixture/'+name}},
  ReserveSession:{createSession:options=>{callbacks=options;return session;}},
  ReserveStorage:{createStore(){}},ReserveAPI:{createClient:()=>({})},ReserveDashboard:{mount:(_target,options)=>{dashboardOptions=options;mounts++;const view=mockView();if(deferDashboard)view.isReady=()=>painted;return view;}},ReserveApp:{mount:(_target,options)=>{plannerOptions=options;return mockView();}}};
 context.ReserveNativeTools={create:()=>{nativeToolsCreated++;return {destroy(){}};}};
 context.location.href=context.location.origin+pathname+search;
 if(!lateSite)vm.runInNewContext(fs.readFileSync(require.resolve('../extension/site.js'),'utf8'),context);
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/content.js'),'utf8'),context);
 if(lateSite)vm.runInNewContext(fs.readFileSync(require.resolve('../extension/site.js'),'utf8'),context);
 return {nodes,body,head,native,sidebar,events,statuses,classes,get mounts(){return mounts;},get nativeToolsCreated(){return nativeToolsCreated;},get dashboardOptions(){return dashboardOptions;},get plannerOptions(){return plannerOptions;},get scrollRestored(){return scrollRestored;},get started(){return started;},get callbacks(){return callbacks;},paintDashboard(){painted=true;dashboardOptions.onReady();},deliver(){callbacks.onSnapshot({courses:[],assignments:[]},{get:()=>({settings:{showGrades:false}})},{stale:false});},loadStyles(){for(const el of nodes.get('reserve-companion-host').shadowRoot.children)el.onload?.();}};
}
test('controller preloads hidden styles and waits for verified data before replacing Canvas',async()=>{
 const f=fixture();await new Promise(setImmediate);assert.equal(f.started,1);assert.equal(f.native.hidden,false);assert.equal(f.sidebar.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
 f.deliver();assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
 f.loadStyles();assert.equal(f.native.hidden,true);assert.equal(f.nodes.get('reserve-companion-host').hidden,false);assert.equal(f.body.style.overflow,undefined);assert.equal(f.body.inert,undefined);
});
test('Canvas dashboard button restores the native dashboard without deleting it',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();const root=f.nodes.get('reserve-companion-host').shadowRoot;
 const toolbar=root.children.find(el=>el.className==='reserve-toolbar');toolbar.querySelector('[data-native]').events.click();
 assert.equal(f.native.hidden,false);assert.equal(f.sidebar.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});
test('assignment and submission pages have no dock, tools, downloads or replacement content',async()=>{
 for(const pathname of ['/courses/7/assignments/12','/courses/7/assignments/12/submissions/42','/courses/7/assignments/12/submissions/new']){
  const f=fixture(pathname,'?module_item_id=25');await new Promise(setImmediate);assert.equal(f.started,0);assert.equal(f.nativeToolsCreated,0);assert.equal(f.native.hidden,false);assert.equal(f.sidebar.hidden,false);assert.equal(f.nodes.has('reserve-companion-host'),false);assert.equal(f.nodes.has('reserve-companion-dock'),false);assert.equal(f.head.children.length,0);assert.deepEqual(f.events,{});
 }
});
test('other native course pages keep their dock and tools',async()=>{
 for(const pathname of ['/courses/7','/courses/7/modules','/courses/7/pages/intro','/courses/7/files/12','/courses/7/assignments']){
  const f=fixture(pathname);await new Promise(setImmediate);assert.equal(f.started,0);assert.equal(f.nativeToolsCreated,1);assert.equal(f.nodes.has('reserve-companion-dock'),true);assert.equal(f.native.hidden,false);
 }
});
test('a native toolbox shortcut opens the requested workspace without an intermediate navigation step',async()=>{
 const f=fixture('/','?reserve=open&workspace=materials&course=7');await new Promise(setImmediate);f.deliver();assert.equal(f.dashboardOptions.initialState.workspace,'materials');assert.equal(f.dashboardOptions.initialState.courseId,'7');assert.equal(f.nativeToolsCreated,0);
});
test('a native personal-task shortcut opens its plan and retains hidden grades',async()=>{
 const f=fixture('/','?reserve=open&plan=assignments&item=local-cycle');await new Promise(setImmediate);f.deliver();assert.equal(f.plannerOptions.initialPage,'assignments');assert.equal(f.plannerOptions.initialId,'local-cycle');assert.equal(f.plannerOptions.hideGrades,true);
});
test('account failure removes the enhanced view and restores original Canvas',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();f.callbacks.onError(Error('Account changed'),{clear:true});assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});
test('starting to use native Canvas prevents a late dashboard swap',async()=>{
 const f=fixture();await new Promise(setImmediate);f.events.pointerdown({composedPath:()=>[f.native]});f.deliver();f.loadStyles();assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});

test('returning from optional planning restores dashboard filters and scroll position',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();
 f.dashboardOptions.onPlanner({page:'assignments',id:'17'});
 assert.equal(f.plannerOptions.initialId,'17');f.plannerOptions.onExit();
 assert.equal(f.dashboardOptions.initialState.query,'gas');assert.equal(f.dashboardOptions.initialState.mode,'tomorrow');assert.equal(f.scrollRestored,460);
});



test('Canvas stays usable if the final layout stylesheet has not loaded',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();const host=f.nodes.get('reserve-companion-host'),links=host.shadowRoot.children.filter(x=>x.tagName==='link');assert.equal(links.length,12);
 links.slice(0,-1).forEach(link=>link.onload());assert.equal(host.hidden,true);assert.equal(f.native.hidden,false);links.at(-1).onload();assert.equal(host.hidden,false);
});

test('while the dashboard shows, its own command row carries the Canvas dashboard switch and the host row folds away; the planner brings that row back with "Back to dashboard"',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();
 const root=f.nodes.get('reserve-companion-host').shadowRoot,toolbar=root.children.find(el=>el.className==='reserve-toolbar'),back=toolbar.querySelector('[data-dashboard]'),label=toolbar.querySelector('span');
 assert.equal(toolbar.hidden,true,'no mostly empty band above the command row');assert.equal(back.hidden,true);
 assert.equal(typeof f.dashboardOptions.onNative,'function','the dashboard renders the switch in its own row');
 // The status stays available: Canvas Harness's footer (its one live region) takes each message.
 f.callbacks.onStatus('Updated just now');assert.equal(f.statuses.at(-1),'Updated just now');assert.match(label.textContent,/^Canvas Harness \d/);
 // The planner has no command row of its own: the host row returns, and "Back to dashboard" redraws the dashboard.
 f.dashboardOptions.onPlanner({page:'week'});assert.equal(toolbar.hidden,false);assert.equal(back.hidden,false);
 f.callbacks.onStatus('Saved view');assert.equal(label.textContent,'Saved view','the row speaks for itself while it shows');
 const mounts=f.mounts;back.events.click();assert.equal(f.mounts,mounts+1);assert.equal(toolbar.hidden,true);assert.equal(back.hidden,true);
 // The dashboard's switch shows Canvas's own dashboard exactly as the host button does.
 f.dashboardOptions.onNative();assert.equal(f.native.hidden,false);assert.equal(f.sidebar.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});

test('a coalesced dashboard keeps Canvas visible until its complete first frame reports ready',async()=>{
 const f=fixture('/','',{deferDashboard:true});await new Promise(setImmediate);f.deliver();f.loadStyles();assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);f.paintDashboard();assert.equal(f.native.hidden,true);assert.equal(f.nodes.get('reserve-companion-host').hidden,false);
});

test('an initial coalesced render failure leaves Canvas usable and a later readiness callback cannot reveal it',async()=>{
 const f=fixture('/','',{deferDashboard:true});await new Promise(setImmediate);f.deliver();f.loadStyles();f.dashboardOptions.onRenderError(Error('initial render failed'));assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);f.paintDashboard();assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});

test('starts when Edge runs it before the manifest scripts (site.js only arrives after it)',async()=>{
 const f=fixture('/','',{lateSite:true});assert.equal(f.started,0);await new Promise(r=>setTimeout(r,20));await new Promise(setImmediate);
 assert.equal(f.started,1);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});


test('dashboard page style removes Canvas padding, body margin and the page scrollbar only while active',()=>{
 const code=fs.readFileSync(require.resolve('../extension/content.js'),'utf8');
 assert.match(code,/html\.reserve-inline-active #content\{[^}]*padding:0!important/);
 assert.ok(code.includes('html.reserve-inline-active body{margin:0!important}'));
 assert.ok(code.includes('html.reserve-inline-active{scrollbar-width:none}'));
 assert.ok(code.includes('html.reserve-inline-active::-webkit-scrollbar{display:none}'));
});

test('dashboard styles hide Canvas wrapper scrollbars and footer only while active',async()=>{
 const f=fixture();await new Promise(setImmediate);
 const css=f.head.children.find(node=>node.tagName==='style').textContent;
 assert.ok(css.includes('html.reserve-inline-active :is(body,#application,#wrapper,#main,#not_right_side,#content-wrapper){scrollbar-width:none}'));
 assert.ok(css.includes('html.reserve-inline-active :is(body,#application,#wrapper,#main,#not_right_side,#content-wrapper)::-webkit-scrollbar{display:none}'));
 assert.ok(css.includes('html.reserve-inline-active :is(#footer,.ic-app-footer,footer[role=contentinfo]){display:none!important}'));
 assert.ok(css.includes('html.reserve-inline-active.reserve-fit,html.reserve-inline-active.reserve-fit body{overflow-y:hidden!important}'));
 assert.equal(f.classes.has('reserve-inline-active'),false);
 f.deliver();f.loadStyles();assert.equal(f.classes.has('reserve-inline-active'),true);
 f.dashboardOptions.onNative();assert.equal(f.classes.has('reserve-inline-active'),false);
});

for(const reason of ['native','account error','stylesheet error'])test('restoring Canvas clears fitted page layout after '+reason,async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();f.classes.add('reserve-fit');
 if(reason==='native')f.dashboardOptions.onNative();
 else if(reason==='account error')f.callbacks.onError(Error('Account changed'),{clear:true});
 else f.nodes.get('reserve-companion-host').shadowRoot.children.find(node=>node.tagName==='link').onerror();
 assert.equal(f.classes.has('reserve-inline-active'),false);assert.equal(f.classes.has('reserve-fit'),false);
 assert.equal(f.native.hidden,false);assert.equal(f.sidebar.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});
