// Adapted from Gary Wu's pull request #47 to Canvas Harness.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(pathname='/',search='',{deferDashboard=false,lateSite=false,quickOpen=false,features,assignments=[]}={}){
 const nodes=new Map(),events={},winEvents={};
 class El{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.hidden=false;this.style={};this.events={};this.dataset={};this._query={};}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  append(...items){for(const el of items){this.children.push(el);el.parentElement=this;}}
  attachShadow(){return this.shadowRoot=new El('shadow');}
  addEventListener(name,fn){this.events[name]=fn;}
  setAttribute(name,value){this[name]=value;}
  contains(el){return this===el||this.children.some(child=>child.contains(el));}
  set innerHTML(value){this._html=value;for(const key of ['button','[data-native]'])this._query[key]=new El(key);}
  querySelector(key){return this._query[key]||null;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);}
  scrollIntoView(){}
 }
 const body=new El('body'),head=new El('head'),html=new El('html');html.classList={add(){},remove(){}};
 const content=new El();content.id='content';const native=new El();native.id='dashboard';const sidebar=new El();sidebar.id='right-side';content.append(native);const application=new El();application.id='application';body.append(content,sidebar,application);
 const document={body,head,documentElement:html,visibilityState:'visible',getElementById:id=>nodes.get(id),querySelector:()=>null,createElement:tag=>new El(tag),addEventListener:(key,fn)=>events[key]=fn};
 let callbacks,started=0,dashboardOptions,nativeToolsCreated=0,mounts=0,dashboardDestroys=0,fileCloses=0,fileResumes=0,settingsOpens=0,painted=!deferDashboard;const statuses=[],trail=[];
 const window={scrollY:460,scrollTo(){},addEventListener:(key,fn)=>winEvents[key]=fn};window.top=window;
 const verifiedStore={get:()=>({settings:{showGrades:false,quickOpen:quickOpen?'on':'off'}})};
 const session={start(){started++;},refresh:async()=>null,verify:async()=>true,suspend(){},destroy(){}};
 const mockView=()=>({destroy(){},closePersonalFiles(){fileCloses++;},resumePersonalFiles(){fileResumes++;trail.push('files');},setStatus:message=>statuses.push(message),updateSnapshot(next){const cover=nodes.get('reserve-companion-host')?.shadowRoot?.children.find(el=>el.className==='reserve-resume');trail.push('snapshot:'+(next?.courses?'data':'none')+':'+(cover&&!cover.hidden?'covered':'open'));},getState:()=>({query:'gas',mode:'tomorrow',courseId:'7',day:'',limit:60})});
 const context={document,window,requestAnimationFrame:fn=>fn(),location:{origin:'https://school.instructure.com',pathname,search,reload(){}},URLSearchParams,Date,
  // The controller's start watch waits twenty seconds; it must not outlive these short tests.
  setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref?.();return timer;},ReserveSite:lateSite?undefined:require('../extension/site.js'),
  sessionStorage:{setItem(){},removeItem(){},getItem:()=>null},
  // This fixture isolates controller behavior; startup.test.cjs runs the real guard.
  ReserveStartup:{canReveal:()=>true,complete:()=>true,release(){},onNative(){}},
  chrome:{storage:{local:{get:async()=>({})}},runtime:{getURL:name=>'chrome-extension://fixture/'+name}},
  ReserveSession:{createSession:options=>{callbacks=options;return session;}},
  ReserveStorage:{createStore(){}},ReserveAPI:{createClient:()=>({})},ReserveDashboard:{mount:(_target,options)=>{_target._query['[data-rd-action="settings"]']={click(){settingsOpens++;}};dashboardOptions=options;mounts++;const view=mockView();view.destroy=()=>dashboardDestroys++;if(deferDashboard)view.isReady=()=>painted;return view;}}};
 if(features)context.ReserveFeatures=features;
 context.ReserveNativeTools={create:()=>{nativeToolsCreated++;return {destroy(){}};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/content.js'),'utf8'),context);
 // Edge can inject the registered content.js before the manifest's site.js; site.js then runs in the same pass
 if(lateSite)context.ReserveSite=require('../extension/site.js');
 return {document,session,nodes,body,head,native,sidebar,events,winEvents,statuses,trail,get settingsOpens(){return settingsOpens;},get mounts(){return mounts;},get dashboardDestroys(){return dashboardDestroys;},get fileCloses(){return fileCloses;},get fileResumes(){return fileResumes;},get nativeToolsCreated(){return nativeToolsCreated;},get dashboardOptions(){return dashboardOptions;},get started(){return started;},get callbacks(){return callbacks;},paintDashboard(){painted=true;dashboardOptions.onReady();},deliver(meta={stale:false}){callbacks.onSnapshot({courses:[],assignments},verifiedStore,meta);},loadStyles(){for(const el of nodes.get('reserve-companion-host').shadowRoot.children)el.onload?.();}};
}
test('controller preloads hidden styles and waits for verified data before replacing Canvas',async()=>{
 const f=fixture();await new Promise(setImmediate);assert.equal(f.started,1);assert.equal(f.native.hidden,false);assert.equal(f.sidebar.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
 f.deliver();assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
 f.loadStyles();assert.equal(f.native.hidden,true);assert.equal(f.nodes.get('reserve-companion-host').hidden,false);assert.equal(f.body.style.overflow,undefined);assert.equal(f.body.inert,undefined);
});
test('Canvas dashboard button restores the native dashboard without deleting it',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();const root=f.nodes.get('reserve-companion-host').shadowRoot;
 const cover=root.children.find(el=>el.className==='reserve-resume');cover.querySelector('[data-native]').events.click();
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
test('an old personal-task shortcut opens the current assignment reader plan',async()=>{
 const f=fixture('/','?reserve=open&plan=assignments&item=local-cycle');await new Promise(setImmediate);f.deliver();
 const state=f.dashboardOptions.initialState;assert.equal(state.workspace,'assignments');assert.equal(state.selectedId,'local-cycle');assert.equal(state.readerTab,'plan');assert.equal(state.readerOpen,true);assert.equal(f.mounts,1);
 assert.equal(typeof f.dashboardOptions.onPlanner,'function');
});

test('old week, settings, grades and home URLs land on the current dashboard',async()=>{
 for(const [page,workspace] of [['week','plan'],['settings','work'],['grades','grades'],['home','work'],['unknown','work']]){
  const f=fixture('/','?reserve=open&plan='+page);await new Promise(setImmediate);f.deliver();f.loadStyles();
  assert.equal(f.dashboardOptions.initialState.workspace,workspace,page);assert.equal(f.mounts,1);assert.equal(f.nodes.get('reserve-companion-host').hidden,false);
 }
});

test('old numeric assignment URLs select the current reader and invalid IDs do not',async()=>{
 for(const id of ['17','local-reminder','bad/id','<script>','1'.repeat(31),'local-'+ 'x'.repeat(101),'']){
  const f=fixture('/','?plan=assignments&item='+encodeURIComponent(id));await new Promise(setImmediate);f.deliver();
  const state=f.dashboardOptions.initialState;assert.equal(state.workspace,'assignments');
  if(['17','local-reminder'].includes(id)){assert.equal(state.selectedId,id);assert.equal(state.readerTab,'plan');assert.equal(state.readerOpen,true);}
  else{assert.equal(state.selectedId,undefined);assert.equal(state.readerOpen,undefined);}
 }
});

test('current workspace URLs take precedence over old plan parameters',async()=>{
 const f=fixture('/','?reserve=open&workspace=materials&course=7&plan=assignments&item=17');await new Promise(setImmediate);f.deliver();
 assert.equal(f.dashboardOptions.initialState.workspace,'materials');assert.equal(f.dashboardOptions.initialState.courseId,'7');assert.equal(f.dashboardOptions.initialState.selectedId,undefined);
});

test('old planner URLs fall back when the Planner feature is disabled',async()=>{
 const features={enabled:id=>id==='dashboard',workspace:()=> 'work',filterFiles:files=>files},f=fixture('/','?reserve=open&plan=week',{features});await new Promise(setImmediate);f.deliver();
 assert.equal(f.dashboardOptions.initialState.workspace,'work');assert.equal(f.mounts,1);
});

test('account failure removes the enhanced view and restores original Canvas',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();f.callbacks.onError(Error('Account changed'),{clear:true});assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});

test('a source account failure destroys dashboard file viewers before returning to Canvas',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();assert.equal(f.dashboardDestroys,0);
 f.dashboardOptions.onAuthError(Error('Account changed'));assert.equal(f.dashboardDestroys,1);assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
 f.paintDashboard();assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});

test('tab suspension and switching to Canvas close personal file viewers before account revalidation',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();f.document.visibilityState='hidden';f.events.visibilitychange();assert.equal(f.fileCloses,1);assert.equal(f.dashboardDestroys,0);
 f.dashboardOptions.onNative();assert.equal(f.fileCloses,2);assert.equal(f.native.hidden,false);
});

test('unverified saved views keep personal links hidden until a verified snapshot arrives',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver({stale:true,unverified:true});f.loadStyles();assert.equal(f.dashboardOptions.personalVerified,false);assert.equal(f.fileCloses,1);assert.equal(f.fileResumes,0);
 f.deliver();assert.equal(f.fileResumes,1);assert.equal(f.mounts,1);
});

test('successful account revalidation releases personal links after a tab returns',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();const before=f.fileResumes;f.document.visibilityState='hidden';f.events.visibilitychange();assert.equal(f.fileResumes,before);
 f.document.visibilityState='visible';f.events.visibilitychange();await new Promise(setImmediate);assert.equal(f.fileResumes,before+1);
});
// Perf (leaks-3): the reopened files' render is the one redraw a return needs. Handing the dashboard the same snapshot
// again cleared its caches and ran a second AI visit; newer Canvas data still arrives through receive.
test('a returning tab redraws once through its reopened files and does not hand the same snapshot over again',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();f.document.visibilityState='hidden';f.events.visibilitychange();
 const cover=f.nodes.get('reserve-companion-host').shadowRoot.children.find(el=>el.className==='reserve-resume');assert.equal(cover.hidden,false,'the place is kept under the cover while hidden');
 const before=f.trail.length;f.document.visibilityState='visible';f.events.visibilitychange();await new Promise(setImmediate);await new Promise(done=>setTimeout(done,20));
 assert.deepEqual(f.trail.slice(before),['files']);assert.equal(cover.hidden,true);assert.equal(f.nodes.get('reserve-companion-host').hidden,false);
 // A stale snapshot refreshed by the check still reaches the open dashboard.
 f.deliver();assert.deepEqual(f.trail.slice(before),['files','snapshot:data:open','files']);assert.equal(f.mounts,1);
});
test('Open at once still shows the workspace as the tab returns and redraws once after the check',async()=>{
 const f=fixture('/','',{quickOpen:true});await new Promise(setImmediate);f.deliver();f.loadStyles();let finish;f.session.verify=()=>new Promise(done=>finish=done);
 const host=f.nodes.get('reserve-companion-host'),root=host.shadowRoot,area=root.children.find(el=>el.className==='reserve-workspace'),cover=root.children.find(el=>el.className==='reserve-resume');
 f.document.visibilityState='hidden';f.events.visibilitychange();const before=f.trail.length;
 f.document.visibilityState='visible';f.events.visibilitychange();
 assert.equal(cover.hidden,true,'shown before the check finishes');assert.equal(area.hidden,false);assert.equal(host.hidden,false);assert.deepEqual(f.trail.slice(before),[]);
 finish(true);await new Promise(setImmediate);await new Promise(done=>setTimeout(done,20));
 assert.deepEqual(f.trail.slice(before),['files']);assert.equal(cover.hidden,true);assert.equal(area.hidden,false);assert.equal(f.mounts,1);
});
test('a tab hidden again before its check finishes skips the refresh and stays covered',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();let release;f.session.verify=()=>new Promise(done=>release=done);
 f.document.visibilityState='hidden';f.events.visibilitychange();const before=f.trail.length;f.document.visibilityState='visible';f.events.visibilitychange();
 f.document.visibilityState='hidden';f.events.visibilitychange();release(true);await new Promise(setImmediate);await new Promise(done=>setTimeout(done,20));
 assert.deepEqual(f.trail.slice(before),[]);
});

test('old settings URLs keep personal access closed until account verification',async()=>{
 const f=fixture('/','?reserve=open&plan=settings');await new Promise(setImmediate);f.deliver({stale:true,unverified:true});f.loadStyles();
 assert.equal(f.dashboardOptions.personalVerified,false);assert.equal(f.dashboardOptions.initialState.workspace,'work');assert.equal(f.fileCloses,1);assert.equal(f.fileResumes,0);assert.equal(f.dashboardDestroys,0);
 f.deliver();assert.equal(f.fileResumes,1);assert.equal(f.mounts,1);
});

test('account revalidation covers the current dashboard until its session check completes',async()=>{
 const f=fixture('/','?reserve=open&plan=settings');await new Promise(setImmediate);f.deliver();f.loadStyles();const area=f.nodes.get('reserve-companion-host').shadowRoot.children.find(el=>el.className==='reserve-workspace');let finish;f.session.verify=()=>new Promise(resolve=>finish=resolve);
 f.document.visibilityState='hidden';f.events.visibilitychange();f.document.visibilityState='visible';f.events.visibilitychange();assert.equal(area.hidden,true);assert.equal(area.inert,true);
 finish(true);await new Promise(setImmediate);assert.equal(area.hidden,false);assert.equal(area.inert,false);assert.equal(f.mounts,1);
});

// Perf (startup-2): drawing the cover over a page that is being thrown away restyled the whole workspace on the
// critical path of the next Canvas page. A discarded page skips it; a page kept for Back still covers.
test('leaving the dashboard for another page takes it down without covering the discarded page',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();
 const host=f.nodes.get('reserve-companion-host'),root=host.shadowRoot,area=root.children.find(el=>el.className==='reserve-workspace'),cover=root.children.find(el=>el.className==='reserve-resume');
 assert.equal(area.hidden,false);assert.equal(cover.hidden,true);
 f.winEvents.pagehide({persisted:false});
 assert.equal(area.hidden,false);assert.equal(area.inert,false);assert.equal(cover.hidden,true);assert.notEqual(host['data-reserve-verifying'],'true');assert.equal(cover.style.minHeight,undefined);
 assert.equal(f.fileCloses,1,'personal files still close');assert.equal(f.dashboardDestroys,1,'the dashboard is still taken down and remembers its view');
 // The browser hides the page right after its last pagehide: nothing is paused or covered a second time.
 f.document.visibilityState='hidden';f.events.visibilitychange();
 assert.equal(area.hidden,false);assert.equal(cover.hidden,true);assert.equal(f.fileCloses,1);assert.equal(f.dashboardDestroys,1);
});
test('a page kept for Back still covers its workspace on pagehide and reopens after the account check',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();
 const host=f.nodes.get('reserve-companion-host'),root=host.shadowRoot,area=root.children.find(el=>el.className==='reserve-workspace'),cover=root.children.find(el=>el.className==='reserve-resume');
 f.winEvents.pagehide({persisted:true});
 assert.equal(area.hidden,true);assert.equal(area.inert,true);assert.equal(cover.hidden,false);assert.equal(host['data-reserve-verifying'],'true');assert.equal(f.dashboardDestroys,0);
 f.document.visibilityState='hidden';f.events.visibilitychange();assert.equal(area.hidden,true);assert.equal(cover.hidden,false);assert.equal(f.fileCloses,2,'a kept page still pauses on hide');
 f.document.visibilityState='visible';f.winEvents.pageshow({persisted:true});await new Promise(setImmediate);
 assert.equal(area.hidden,false);assert.equal(area.inert,false);assert.equal(cover.hidden,true);assert.equal(f.mounts,1);assert.equal(f.dashboardDestroys,0);
});
test('a tab hidden before the page is thrown away keeps its cover until then',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();
 const root=f.nodes.get('reserve-companion-host').shadowRoot,area=root.children.find(el=>el.className==='reserve-workspace'),cover=root.children.find(el=>el.className==='reserve-resume');
 f.document.visibilityState='hidden';f.events.visibilitychange();assert.equal(area.hidden,true);assert.equal(cover.hidden,false);
 f.winEvents.pagehide({persisted:false});assert.equal(area.hidden,true);assert.equal(cover.hidden,false);assert.equal(f.dashboardDestroys,1);
});

test('starting to use native Canvas prevents a late dashboard swap',async()=>{
 const f=fixture();await new Promise(setImmediate);f.events.pointerdown({composedPath:()=>[f.native]});f.deliver();f.loadStyles();assert.equal(f.native.hidden,false);assert.equal(f.nodes.get('reserve-companion-host').hidden,true);
});

test('a refreshed legacy assignment link keeps one current dashboard and its reader selection',async()=>{
 const f=fixture('/','?reserve=open&plan=assignments&item=17');await new Promise(setImmediate);f.deliver();f.loadStyles();
 assert.equal(f.dashboardOptions.initialState.selectedId,'17');const mounts=f.mounts;f.deliver();assert.equal(f.mounts,mounts);assert.equal(f.dashboardDestroys,0);
});

// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).
test('fallback dashboard waits for each framing stylesheet before replacing Canvas',async()=>{
 for(const file of ['media-frame.css','frame-editor.css']){
  const f=fixture();await new Promise(setImmediate);f.deliver();
  const host=f.nodes.get('reserve-companion-host'),links=host.shadowRoot.children.filter(node=>node.tagName==='link'),pending=links.filter(link=>link.href.endsWith('/'+file));
  assert.equal(pending.length,1,file+' must link once in the dashboard shadow root');
  for(const link of links)if(link!==pending[0])link.onload();
  assert.equal(host.hidden,true);assert.equal(f.native.hidden,false);
  pending[0].onload();assert.equal(host.hidden,false);assert.equal(f.native.hidden,true);
 }
});

test('the current dashboard owns its status and Canvas switch without an extra host toolbar',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();
 const root=f.nodes.get('reserve-companion-host').shadowRoot;
 assert.equal(root.children.find(el=>el.className==='reserve-toolbar'),undefined);assert.equal(typeof f.dashboardOptions.onNative,'function');
 f.callbacks.onStatus('Updated just now');assert.equal(f.statuses.at(-1),'Updated just now');
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

test('compatibility plan callbacks reuse current dashboard state and reader instead of a second app',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver();f.loadStyles();
 f.dashboardOptions.onPlanner({page:'assignments',id:'17',hideGrades:true});let state=f.dashboardOptions.initialState;
 assert.equal(f.mounts,2);assert.equal(f.dashboardDestroys,1);assert.equal(state.workspace,'assignments');assert.equal(state.selectedId,'17');assert.equal(state.readerTab,'plan');assert.equal(state.readerOpen,true);assert.equal(state.query,'');assert.equal(state.day,'');assert.equal(state.mode,'undated');assert.equal(state.gradeVisibilityOverride,false);
 f.dashboardOptions.onPlanner({page:'week'});state=f.dashboardOptions.initialState;assert.equal(state.workspace,'plan');assert.equal(state.query,'gas');assert.equal(f.mounts,3);
});

test('compatibility settings callbacks wait for account verification before remounting',async()=>{
 const f=fixture();await new Promise(setImmediate);f.deliver({stale:true,unverified:true});f.loadStyles();
 f.dashboardOptions.onPlanner({page:'settings'});assert.equal(f.mounts,1);assert.equal(f.dashboardDestroys,0);
 f.deliver();assert.equal(f.mounts,2);assert.equal(f.dashboardOptions.initialState.workspace,'work');assert.equal(f.dashboardOptions.personalVerified,true);
});

test('appearance deep links wait for verified personal data before opening the current dock',async()=>{
 const f=fixture('/','?reserve=open&appearance=true');await new Promise(setImmediate);f.deliver({stale:true,unverified:true});f.loadStyles();assert.equal(f.settingsOpens,0);
 f.deliver();assert.equal(f.settingsOpens,1);f.deliver();assert.equal(f.settingsOpens,1);
});

test('old completed, undated and dated assignment links select a filter that retains their target',async()=>{
 const Core=require('../extension/core.js'),Model=require('../extension/dashboard-model.js');
 for(const [due,submission,mode] of [['2020-01-01T12:00:00Z',{workflow_state:'unsubmitted'},'dated'],[null,{workflow_state:'unsubmitted'},'undated'],['2020-01-01T12:00:00Z',{workflow_state:'graded',score:10},'dated']]){
  const raw={id:'17',course_id:'7',name:'Old assignment',due_at:due,submission_types:['online_upload'],submission};
  const f=fixture('/','?reserve=open&plan=assignments&item=17',{assignments:[raw]});await new Promise(setImmediate);f.deliver();
  const state=f.dashboardOptions.initialState;assert.equal(state.mode,mode);assert.equal(state.query,'');assert.equal(state.day,'');
  const result=Model.filterAssignments([Core.normalizeAssignment(raw,{id:'7',name:'Chemistry'})],{...state,now:Date.now(),timeZone:'America/New_York',local:{}});
  assert.deepEqual(result.items.map(item=>item.id),['17']);
 }
});
