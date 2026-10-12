const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(pathname='/',search=''){
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
 const body=new El('body'),head=new El('head'),html=new El('html');html.classList={add(){},remove(){}};
 const content=new El();content.id='content';const native=new El();native.id='dashboard';const sidebar=new El();sidebar.id='right-side';content.append(native);body.append(content,sidebar);
 const document={body,head,documentElement:html,visibilityState:'visible',getElementById:id=>nodes.get(id),createElement:tag=>new El(tag),addEventListener:(key,fn)=>events[key]=fn};
 let callbacks,started=0,dashboardOptions,plannerOptions,scrollRestored,nativeToolsCreated=0,mounts=0;const statuses=[];
 const window={scrollY:460,scrollTo:(options)=>scrollRestored=options.top,addEventListener:(key,fn)=>winEvents[key]=fn};window.top=window;
 const session={start(){started++;},refresh:async()=>null,verify:async()=>true,destroy(){}};
 const mockView=()=>({destroy(){},setStatus:message=>statuses.push(message),updateSnapshot(){},getState:()=>({query:'gas',mode:'tomorrow',courseId:'7',day:'',limit:60})});
 const context={document,window,requestAnimationFrame:fn=>fn(),location:{origin:'https://school.instructure.com',pathname,search},URL,URLSearchParams,Date,
  sessionStorage:{setItem(){},removeItem(){},getItem:()=>null},
  // This fixture isolates controller behavior; startup.test.cjs runs the real guard.
  ReserveStartup:{canReveal:()=>true,complete:()=>true,release(){},onNative(){}},
  chrome:{storage:{local:{get:async()=>({})}},runtime:{getURL:name=>'chrome-extension://fixture/'+name}},
  ReserveSession:{createSession:options=>{callbacks=options;return session;}},
  ReserveStorage:{createStore(){}},ReserveAPI:{createClient:()=>({})},ReserveDashboard:{mount:(_target,options)=>{dashboardOptions=options;mounts++;return mockView();}},ReserveApp:{mount:(_target,options)=>{plannerOptions=options;return mockView();}}};
 context.ReserveNativeTools={create:()=>{nativeToolsCreated++;return {destroy(){}};}};
 context.location.href=context.location.origin+pathname+search;
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/site.js'),'utf8'),context);
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/content.js'),'utf8'),context);
 return {nodes,body,head,native,sidebar,events,statuses,get mounts(){return mounts;},get nativeToolsCreated(){return nativeToolsCreated;},get dashboardOptions(){return dashboardOptions;},get plannerOptions(){return plannerOptions;},get scrollRestored(){return scrollRestored;},get started(){return started;},get callbacks(){return callbacks;},deliver(){callbacks.onSnapshot({courses:[],assignments:[]},{get:()=>({settings:{showGrades:false}})},{stale:false});},loadStyles(){for(const el of nodes.get('reserve-companion-host').shadowRoot.children)el.onload?.();}};
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
test('course and submission pages do not start course downloads or replace native content',async()=>{
 const f=fixture('/courses/7/assignments/12');await new Promise(setImmediate);assert.equal(f.started,0);assert.equal(f.nativeToolsCreated,1);assert.equal(f.native.hidden,false);assert.equal(f.nodes.has('reserve-companion-host'),false);
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
