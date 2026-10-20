'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const extension=path.join(__dirname,'../extension');
const flush=()=>new Promise(setImmediate);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

// Only browser DOM, clock, extension storage, and Canvas network boundaries are fake.
// The bootstrap, content controller, and account-verifying session all run unmodified.
function fixture(options={}){
  let now=0,nextTimer=0;
  const timers=new Map(),events={},winEvents={},reads=[],sessionData=new Map(options.native?[['reserve:native','true']]:[]);
  function listen(target,key,fn){(target[key]??=[]).push(fn);}
  class Element{
    constructor(tag='div'){this.tagName=tag;this.children=[];this.hidden=false;this.style={};this.events={};this.attrs={};this._queries={};const classes=new Set();this.classList={add:(v)=>classes.add(v),remove:(v)=>classes.delete(v),contains:(v)=>classes.has(v)};}
    append(...items){for(const el of items){this.children.push(el);el.parentElement=this;}}
    attachShadow(){return this.shadowRoot=new Element('shadow');}
    setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
    addEventListener(k,fn){listen(this.events,k,fn);}
    removeEventListener(k,fn){this.events[k]=(this.events[k]||[]).filter(x=>x!==fn);}
    contains(el){return this===el||this.children.some(x=>x.contains(el));}
    querySelector(key){return this._queries[key]||this.children.map(x=>x.querySelector(key)).find(Boolean)||null;}
    set innerHTML(value){this._html=value;for(const key of ['button','span','[data-dashboard]','[data-native]']){const el=new Element(key);this._queries[key]=el;el.parentElement=this;}}
    get innerHTML(){return this._html||'';}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
    scrollIntoView(){}
  }
  const html=new Element('html'),head=new Element('head'),body=new Element('body');html.append(head,body);
  const content=new Element();content.id='content';const native=new Element();native.id='dashboard';const sidebar=new Element();sidebar.id='right-side';content.append(native);const application=new Element();application.id='application';application.append(content,sidebar);if(!options.notCanvas)body.append(application);else body.append(content,sidebar);
  const byId=(el,id)=>el.id===id?el:el.children.map(x=>byId(x,id)).find(Boolean);
  let login=!!options.login;const observers=new Set();
  if(options.emptyDocument){head.remove();body.remove();}
  const document={documentElement:html,head:options.emptyDocument?null:head,body:options.emptyDocument?null:body,visibilityState:'visible',readyState:'loading',getElementById:id=>byId(html,id),createElement:tag=>new Element(tag),querySelector:()=>login?new Element('form'):null,
    addEventListener:(key,fn)=>listen(events,key,fn),removeEventListener:(key,fn)=>events[key]=(events[key]||[]).filter(x=>x!==fn)};
  const window={scrollY:0,scrollTo(){},addEventListener:(key,fn)=>listen(winEvents,key,fn),removeEventListener:(key,fn)=>winEvents[key]=(winEvents[key]||[]).filter(x=>x!==fn)};window.top=options.frame?{}:window;
  const storage=options.storage||Promise.resolve({'reserve:enabled':options.enabled!==false});
  const profile=options.profile||deferred(),network=options.network||deferred(),preflight=options.preflight||deferred(),profiles=[profile];let profileCalls=0,preflightCalls=0,preflightAborted=false,cacheReads=0,mounts=0,storeAccount,aborted=false,preflightRequest;
  const mountedUsers=[];
  const store={load:async()=>{},readCache:async()=>{cacheReads++;return String(options.cache?.user?.id)===String(storeAccount)?options.cache:null;},writeCache:async()=>{},get:()=>({settings:{showGrades:false,...options.settings}}),destroy(){}};
  const loc={origin:options.origin||'https://school.instructure.com',pathname:options.pathname||'/',search:options.search||''};
  loc.href=loc.origin+loc.pathname+loc.search;
  const hintValues=new Map();
  const context={window,document,location:loc,URL,URLSearchParams,AbortController,localStorage:{getItem:key=>hintValues.get(key)??null,setItem:(key,value)=>hintValues.set(key,value),removeItem:key=>hintValues.delete(key)},Date:class extends Date{static now(){return now;}},performance:{now:()=>now},
    setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{at:now+delay,fn});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),
    MutationObserver:class{constructor(fn){this.fn=fn;}observe(){observers.add(this);}disconnect(){observers.delete(this);}},
    getComputedStyle:()=>({getPropertyValue:()=>options.css===false?'':'1'}),
    fetch:(url,init)=>{preflightCalls++;preflightRequest={url,init};init.signal.addEventListener('abort',()=>preflightAborted=true);return preflight.promise;},
    sessionStorage:{getItem:key=>{if(options.sessionError)throw Error('storage denied');return sessionData.get(key)||null;},setItem:(key,value)=>{if(options.sessionError)throw Error('storage denied');sessionData.set(key,value);},removeItem:key=>{if(options.sessionError)throw Error('storage denied');sessionData.delete(key);}},
    chrome:{storage:{local:{set:async()=>{},remove:async()=>{},get:key=>{reads.push(key);if(options.hint&&typeof key==='string'&&key.startsWith('reserve:lastAccount:'))return Promise.resolve({[key]:options.hint});return storage;}}},runtime:{getURL:name=>'chrome-extension://fixture/'+name}},
    ReserveAPI:{createClient:()=>({profile:({signal})=>{const check=profiles[profileCalls++]||profile;signal.addEventListener('abort',()=>aborted=true);return check.promise;},loadSnapshot:()=>network.promise})},
    ReserveStorage:{createStore:({accountId})=>{storeAccount=accountId;return store;}},
    ReserveDashboard:{mount:(_area,{snapshot})=>{if(options.mountError)throw Error('render failed');mounts++;mountedUsers.push(String(snapshot.user.id));return {destroy(){},getState:()=>({}),updateSnapshot(){},setStatus(){}};}}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(extension,'site.js'),'utf8'),context);
  function run(name,optional=false){const file=path.join(extension,name);if(optional&&!fs.existsSync(file))return;vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:name});}
  if(!options.skipStartup){if(!options.missingArt)run('startup-art.js');run('startup.js',true);}
  function dispatch(list,event={}){for(const fn of [...(list||[])])fn(event);}
  return {context,html,native,sidebar,profile,network,preflight,reads,sessionData,document,mountedUsers,
    get active(){return html.classList.contains('reserve-startup-active');},get shell(){return document.getElementById('reserve-startup-shell');},get host(){return document.getElementById('reserve-companion-host');},
    get privateArea(){return this.host?.shadowRoot.children.find(el=>el.className==='reserve-workspace')||this.host?.shadowRoot.children.at(-1);},
    get resumeCover(){return this.host?.shadowRoot.children.find(el=>el.className==='reserve-resume');},
    get profileCalls(){return profileCalls;},get preflightCalls(){return preflightCalls;},get preflightRequest(){return preflightRequest;},get preflightAborted(){return preflightAborted;},get preloads(){return head.children.filter(el=>el.rel==='preload');},get cacheReads(){return cacheReads;},get mounts(){return mounts;},get storeAccount(){return storeAccount;},get aborted(){return aborted;},
    content(){run('session.js');run('content.js');},
    manifestStart(){const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));if(manifest.content_scripts.find(x=>x.js.includes('content.js')).run_at==='document_start')this.content();},
    parserAddsContainers(){if(!document.head){document.head=head;html.append(head);}if(!document.body){document.body=body;html.append(body);}for(const observer of [...observers])observer.fn();},
    parserMutation(){for(const observer of [...observers])observer.fn();},
    parsed(){document.readyState='interactive';dispatch(events.DOMContentLoaded);},
    tick(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}},
    elapse(ms){now+=ms;},
    loadStyles(){for(const link of this.host?.shadowRoot.children||[])link.onload?.();},
    failStyle(){this.host.shadowRoot.children.find(x=>x.tagName==='link').onerror();},
    click(el){dispatch(el.events.click,{preventDefault(){}});},
    nativeChoice(){const find=el=>el.tagName==='a'?el:el.children.map(find).find(Boolean);this.click(find(this.shell));},
    dockClick(){this.click(document.getElementById('reserve-companion-dock').shadowRoot.querySelector('button'));},
    interact(key='pointerdown',target=native){dispatch(events[key],{type:key,key:'Enter',target,composedPath:()=>[target,content,body,html]});},
    login(){login=true;for(const observer of [...observers])observer.fn();},
    pagehide(){dispatch(winEvents.pagehide,{persisted:true});},
    pageshow(){dispatch(winEvents.pageshow,{persisted:true});},
    queueProfile(check=deferred()){profiles.push(check);return check;},
    hide(){document.visibilityState='hidden';dispatch(events.visibilitychange);},
    show(){document.visibilityState='visible';dispatch(events.visibilitychange);},
    snapshot(id='7'){network.resolve({user:{id},courses:[],assignments:[],fetchedAt:new Date().toISOString()});},
    preflightOk(id='7'){preflight.resolve({ok:true,redirected:false,headers:{get:()=> 'application/json'},json:async()=>({id})});},
  };
}

test('the prepaint guard does not send a competing identity request',async()=>{
 const f=fixture();f.content();await flush();
 assert.equal(f.preflightCalls,0,'one current server verification must be the only startup identity request');
 assert.equal(f.profileCalls,1);assert.equal(f.cacheReads,0);
 f.profile.resolve({id:'7'});f.snapshot();await flush();f.loadStyles();assert.equal(f.host.hidden,false);
});


test('returning to an idle workspace keeps native Canvas concealed behind a nonprivate Canvas Harness cover',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();f.profile.resolve({id:'7'});await flush();f.loadStyles();
 const area=f.privateArea,mounts=f.mounts,check=f.queueProfile();f.hide();f.show();await flush();
 assert.equal(f.native.hidden,true,'native cards must never flash during account revalidation');
 assert.equal(f.host.hidden,false,'a neutral Canvas Harness cover keeps the enhanced workspace present');
 assert.equal(area.hidden,true,'retained coursework must remain concealed until fresh account verification');
 assert.equal(area.inert,true,'concealed coursework cannot receive focus or clicks');
 assert.equal(f.resumeCover.hidden,false);assert.equal(f.host.getAttribute('data-reserve-verifying'),'true');
 check.resolve({id:'7'});await flush();
 assert.equal(f.privateArea,area,'resume retains the same workspace, scroll and themed art nodes');
 assert.equal(f.mounts,mounts,'a successful return must not remount the whole dashboard');
 assert.equal(area.hidden,false);assert.equal(area.inert,false);assert.equal(f.resumeCover.hidden,true);
 assert.equal(f.native.hidden,true);assert.equal(f.host.getAttribute('data-reserve-verifying'),'false');
});

test('an offline return releases the neutral cover and never exposes unverified saved coursework',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();f.profile.resolve({id:'7'});await flush();f.loadStyles();
 const check=f.queueProfile();f.hide();f.show();await flush();check.reject(Error('offline'));await flush();
 assert.equal(f.host.hidden,true);assert.equal(f.native.hidden,false,'verification failure must leave original Canvas usable');
 assert.equal(f.resumeCover?.hidden,true,'no permanent waiting cover on failure');
});

test('native escape from the resume cover cancels a delayed account result',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();f.profile.resolve({id:'7'});await flush();f.loadStyles();
 const check=f.queueProfile();f.hide();f.show();await flush();
 assert.ok(f.resumeCover,'the waiting view must offer a working native escape');
 f.click(f.resumeCover.querySelector('[data-native]'));check.resolve({id:'7'});await flush();
 assert.equal(f.host.hidden,true);assert.equal(f.native.hidden,false);assert.equal(f.resumeCover.hidden,true);
});

test('a second suspension invalidates the first return without exposing cached coursework',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();f.profile.resolve({id:'7'});await flush();f.loadStyles();
 const old=f.queueProfile();f.hide();f.show();await flush();
 const current=f.queueProfile();f.hide();f.show();await flush();old.resolve({id:'7'});await flush();
 assert.equal(f.privateArea.hidden,true,'an obsolete successful check cannot uncover the retained workspace');
 assert.equal(f.native.hidden,true);assert.equal(f.resumeCover.hidden,false);
 current.resolve({id:'7'});await flush();assert.equal(f.privateArea.hidden,false);assert.equal(f.resumeCover.hidden,true);
});

test('a returning visible tab always rechecks its account, even within thirty seconds',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();f.profile.resolve({id:'7'});await flush();f.loadStyles();assert.equal(f.host.hidden,false);
 const check=f.queueProfile();f.hide();f.show();await flush();
 assert.equal(f.profileCalls,2);assert.equal(f.privateArea.hidden,true,'old coursework stays hidden while the account is checked');
 check.resolve({id:'7'});await flush();assert.equal(f.host.hidden,false);
 const switched=f.queueProfile();f.hide();f.show();await flush();
 assert.equal(f.profileCalls,3,'a recent successful return must not bypass the next check');assert.equal(f.privateArea.hidden,true);
 switched.resolve({id:'8'});await flush();assert.equal(f.host.hidden,true);assert.equal(f.native.hidden,false);
});

// A tab opened in the background (or left while it loads) has nobody looking at it: it must not run out the
// opening cover's eight seconds, and clicking the tab must open the workspace at once instead of Canvas's dashboard.
test('a dashboard loading in a background tab waits there and opens at once when its tab is shown',async()=>{
 const f=fixture();f.document.visibilityState='hidden';f.content();await flush();f.loadStyles();
 f.profile.resolve({id:'7'});f.snapshot();await flush();
 assert.equal(f.mounts,1);assert.equal(f.host.hidden,true,'nothing is revealed in a hidden tab');assert.equal(f.active,true);
 f.tick(20000);assert.equal(f.active,true,'unseen time does not run out the cover');assert.equal(f.native.hidden,false,'Canvas itself is not hidden by the controller yet');
 f.show();await flush();
 assert.equal(f.host.hidden,false);assert.equal(f.active,false,'the cover lifts with the reveal');assert.equal(f.native.hidden,true);
 assert.equal(f.profileCalls,1,'a check that finished moments ago is not repeated');
});
test('a background tab shown long after its check verifies the account again before revealing',async()=>{
 const f=fixture();f.document.visibilityState='hidden';f.content();await flush();f.loadStyles();
 f.profile.resolve({id:'7'});f.snapshot();await flush();f.tick(31000);
 const check=f.queueProfile();f.show();await flush();
 assert.equal(f.profileCalls,2);assert.equal(f.host.hidden,true,'old coursework stays hidden while the account is checked');assert.equal(f.active,true);
 check.resolve({id:'7'});await flush();
 assert.equal(f.host.hidden,false);assert.equal(f.active,false,'the cover lifts with the reveal, not at its deadline');assert.equal(f.native.hidden,true);
 f.tick(9000);assert.equal(f.host.hidden,false,'the old deadline cannot hand the page back to Canvas afterwards');
});
test('a background tab whose account changed meanwhile shows Canvas, not the old workspace',async()=>{
 const f=fixture();f.document.visibilityState='hidden';f.content();await flush();f.loadStyles();
 f.profile.resolve({id:'7'});f.snapshot();await flush();f.tick(31000);
 const check=f.queueProfile();f.show();await flush();check.resolve({id:'8'});await flush();
 assert.equal(f.host.hidden,true);assert.equal(f.native.hidden,false);assert.equal(f.active,false);
});
test('a first load still running when its tab is shown carries on without a second check',async()=>{
 const f=fixture();f.document.visibilityState='hidden';f.content();await flush();f.loadStyles();
 f.show();await flush();assert.equal(f.profileCalls,1,'the running check is kept');assert.equal(f.active,true);
 f.profile.resolve({id:'7'});f.snapshot();await flush();
 assert.equal(f.host.hidden,false);assert.equal(f.active,false);assert.equal(f.profileCalls,1);assert.equal(f.mounts,1);
});
test('the opening cover gets its eight seconds while the page can be seen',async()=>{
 const f=fixture();await flush();assert.equal(f.active,true);
 f.document.visibilityState='hidden';f.tick(9000);assert.equal(f.active,true,'no release while nobody can see the page');
 assert.equal(f.context.ReserveStartup.canReveal(),true,'a hidden page past the old deadline may still reveal later');
 f.show();f.tick(7999);assert.equal(f.active,true);f.tick(1);assert.equal(f.active,false,'eight seconds after it is shown, Canvas returns');
});
test('with Open at once, a background tab clicked before Canvas answers shows the saved view and keeps its first check',async()=>{
 const f=fixture({hint:'7',settings:{quickOpen:'on'},cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.document.visibilityState='hidden';f.content();await flush();f.loadStyles();await flush();
 assert.equal(f.host.hidden,true,'nothing shows in the hidden tab');
 f.show();await flush();
 assert.equal(f.host.hidden,false,'the saved view opens when the tab is clicked');assert.equal(f.native.hidden,true);assert.equal(f.profileCalls,1);
 f.profile.resolve({id:'7'});f.snapshot();await flush();
 assert.equal(f.host.hidden,false,'the first check confirms it');assert.equal(f.native.hidden,true);assert.equal(f.profileCalls,1);assert.equal(f.active,false);
});
test('leaving a tab while its first load runs keeps that load behind the cover',async()=>{
 const f=fixture();f.content();await flush();f.loadStyles();assert.equal(f.active,true);
 f.hide();assert.equal(f.active,true,'the cover waits, unseen');
 f.tick(20000);f.show();await flush();assert.equal(f.active,true);assert.equal(f.profileCalls,1,'no second load');
 f.profile.resolve({id:'7'});f.snapshot();await flush();
 assert.equal(f.host.hidden,false);assert.equal(f.active,false);assert.equal(f.native.hidden,true);assert.equal(f.profileCalls,1);
});
test('a never-shown tab rechecks its account when the wall clock says the check is old (the computer slept)',async()=>{
 const f=fixture();f.document.visibilityState='hidden';f.content();await flush();f.loadStyles();
 f.profile.resolve({id:'7'});f.snapshot();await flush();
 const wake=Date.now()+6*3600000;f.context.Date.now=()=>wake;f.tick(1000);
 const check=f.queueProfile();f.show();await flush();
 assert.equal(f.profileCalls,2,'performance.now() stood still during sleep; Date.now() did not');assert.equal(f.host.hidden,true);
 check.resolve({id:'7'});await flush();assert.equal(f.host.hidden,false);
});
test('BFCache restoration checks the current account before showing retained coursework',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();f.profile.resolve({id:'7'});await flush();f.loadStyles();
 const check=f.queueProfile();f.pagehide();assert.equal(f.privateArea.hidden,true);f.pageshow();await flush();
 assert.equal(f.profileCalls,2);assert.equal(f.privateArea.hidden,true);assert.equal(f.native.hidden,true);
 check.resolve({id:'8'});await flush();assert.equal(f.host.hidden,true);assert.equal(f.native.hidden,false);
});

test('manually reopening a saved workspace never reveals it before a fresh account check',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();f.profile.resolve({id:'7'});await flush();f.loadStyles();
 const check=f.queueProfile();f.click(f.host.shadowRoot.querySelector('[data-native]'));f.dockClick();await flush();
 assert.equal(f.profileCalls,2);assert.equal(f.host.hidden,true);
 check.resolve({id:'7'});await flush();assert.equal(f.host.hidden,false);
});

test('a delayed resume check cannot reveal after the student chooses native Canvas',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();f.profile.resolve({id:'7'});await flush();f.loadStyles();
 const check=f.queueProfile();f.hide();f.show();await flush();f.click(f.host.shadowRoot.querySelector('[data-native]'));
 check.resolve({id:'7'});await flush();assert.equal(f.host.hidden,true);assert.equal(f.native.hidden,false);
});

test('manifest starts the small guard before the early controller with optional AI permissions and multi-school Canvas access',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));
  const startup=manifest.content_scripts.find(x=>x.js.includes('startup.js'));
  assert.ok(startup,'a document_start bootstrap must be registered');
  assert.equal(manifest.content_scripts[0],startup);assert.equal(startup.run_at,'document_start');assert.deepEqual(startup.js,['site.js','startup-art.js','startup.js']);assert.deepEqual(startup.css,['startup.css','startup-art.css','canvas-nav.css','course-nav.css']);assert.equal(startup.all_frames,false);
 assert.equal(manifest.content_scripts.find(x=>x.js.includes('content.js')).run_at,'document_start');assert.ok(manifest.content_scripts.indexOf(startup)<manifest.content_scripts.findIndex(x=>x.js.includes('content.js')));assert.deepEqual(manifest.permissions,['storage','unlimitedStorage','offscreen']);
});

test('warm dashboard is revealed while Canvas is still parsing, without waiting for DOMContentLoaded',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.manifestStart();await flush();
 assert.equal(f.document.readyState,'loading');assert.equal(f.profileCalls,1,'verification overlaps Canvas parsing');
 f.profile.resolve({id:'7'});await flush();f.loadStyles();
 assert.equal(f.host.hidden,false);assert.equal(f.mounts,1);assert.equal(f.native.hidden,true);
});

test('early controller waits for page containers, then starts once before parsing finishes',async()=>{
 const f=fixture({emptyDocument:true,cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();assert.equal(f.profileCalls,0);assert.equal(f.host,undefined);
 f.parserAddsContainers();await flush();assert.equal(f.profileCalls,1);assert.ok(f.host);
 f.parserMutation();f.parsed();await flush();assert.equal(f.profileCalls,1,'DOM notifications cannot duplicate the session');
 f.profile.resolve({id:'7'});await flush();f.loadStyles();assert.equal(f.host.hidden,false);
});

test('native course tools wait for completed markup when the controller is registered early',async()=>{
 const f=fixture({pathname:'/courses/7/modules'});f.content();await flush();
 assert.equal(f.document.getElementById('reserve-companion-dock'),undefined);assert.equal(f.profileCalls,0);
 f.parsed();await flush();assert.ok(f.document.getElementById('reserve-companion-dock'));assert.equal(f.profileCalls,0);assert.equal(f.host,undefined);
});

test('parsing an assignment or submission never starts the native launcher',async()=>{
 for(const pathname of ['/courses/7/assignments/12','/courses/7/assignments/12/submissions/42','/courses/7/assignments/12/submissions/new']){
  const f=fixture({pathname,search:'?module_item_id=25'});f.content();await flush();f.parsed();await flush();
  assert.equal(f.document.getElementById('reserve-companion-dock'),undefined);assert.equal(f.profileCalls,0);assert.equal(f.host,undefined);assert.equal(f.active,false);
 }
});

test('duplicate controller delivery cannot create another pending launcher or session',async()=>{
 const f=fixture({emptyDocument:true});f.content();f.content();await flush();f.parserAddsContainers();await flush();
 assert.equal(f.profileCalls,1);assert.equal(f.document.body.children.filter(el=>el.id==='reserve-companion-dock').length,1);
});

test('a parser-delivered container initialization error releases the opening shell',async()=>{
 const f=fixture({emptyDocument:true});f.content();await flush();
 f.context.ReserveNativePage={create(){throw Error('appearance failed');}};
 assert.doesNotThrow(()=>f.parserAddsContainers());await flush();assert.equal(f.active,false);assert.equal(f.profileCalls,0);assert.equal(f.native.hidden,false);
});

test('closing a page before its containers appear cancels the pending controller',async()=>{
 const f=fixture({emptyDocument:true});f.content();await flush();f.pagehide();f.parserAddsContainers();f.parsed();await flush();
 assert.equal(f.profileCalls,0);assert.equal(f.host,undefined);assert.equal(f.cacheReads,0);
});

test('login detected before page containers appear cannot open the cached workspace',async()=>{
 const f=fixture({emptyDocument:true,cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.content();await flush();f.login();f.parserAddsContainers();f.parsed();await flush();
 assert.equal(f.profileCalls,0);assert.equal(f.cacheReads,0);assert.equal(f.host,undefined);assert.equal(f.active,false);
});

test('startup timeout before page containers appear cannot cause a late automatic swap',async()=>{
 const f=fixture({emptyDocument:true});f.content();await flush();f.tick(8000);f.parserAddsContainers();f.parsed();await flush();
 assert.equal(f.profileCalls,0);assert.equal(f.host,undefined);assert.equal(f.native.hidden,false);
});
test('opted-in dashboard gets a generic prepaint shell without reading cached data or making a competing request',async()=>{
  const f=fixture();await flush();assert.equal(f.active,true);assert.ok(f.shell);assert.deepEqual(JSON.parse(JSON.stringify(f.reads.filter(key=>key!=='reserve:appearance'))),['reserve:enabled'],'only the enable preference and device theme are read');assert.equal(f.preflightCalls,0);assert.equal(f.profileCalls,0);assert.equal(f.cacheReads,0);assert.equal(f.native.hidden,false);
  assert.equal(f.preloads.length,14,'local styles begin fetching before the main controller');
  assert.ok(f.preloads.every(link=>link.as==='style'&&link.href.startsWith('chrome-extension://fixture/')));
});



test('a first-visit shell contains its forge on its first append, before any plain-cover paint',async()=>{
 const f=fixture(),pictures=[],append=f.html.append.bind(f.html);
 f.html.append=(...items)=>{for(const item of items)if(item.id==='reserve-startup-shell')pictures.push(item.children[1].innerHTML);append(...items);};
 await flush();assert.equal(pictures.length,1);assert.match(pictures[0],/^<svg class="rsa"/);
});
test('opening shell shows the bundled picture between its header and status without placeholder bars',async()=>{
 const f=fixture();await flush();
 const [header,art,message]=f.shell.children;
 assert.deepEqual(f.shell.children.map(el=>el.tagName),['header','div','p']);
 assert.equal(header.children[0].textContent,'Canvas Harness');assert.equal(header.children[1].textContent,'Canvas dashboard');assert.equal(header.children[1].href,'/?reserve=native');
 assert.equal(art.className,'reserve-startup-art');assert.equal(art.getAttribute('aria-hidden'),'true');
 assert.equal(art.innerHTML,f.context.ReserveStartupArt);assert.match(art.innerHTML,/^<svg\b/);assert.doesNotMatch(art.innerHTML,/<i(?:\s|>)/);
 const descendants=el=>el.children.flatMap(child=>[child,...descendants(child)]);
 assert.ok(descendants(f.shell).every(el=>el.tagName!=='i'&&el.className!=='reserve-startup-layout'));
 assert.equal(message.textContent,'Syncing Canvas…');assert.equal(message.getAttribute('role'),'status');
});
test('a missing artwork global leaves an empty picture area and still completes startup',async()=>{
 const f=fixture({missingArt:true});f.content();await flush();
 assert.equal(f.context.ReserveStartupArt,undefined);assert.equal(f.active,true);assert.equal(f.shell.children[1].innerHTML,'');
 f.profile.resolve({id:'7'});f.snapshot();await flush();f.loadStyles();
 assert.equal(f.host.hidden,false);assert.equal(f.active,false);assert.equal(f.shell,undefined);
});
for(const action of ['timeout','nativeChoice','login','pagehide'])test('missing artwork preserves the startup release path: '+action,async()=>{
 const f=fixture({missingArt:true});await flush();assert.equal(f.active,true);
 if(action==='timeout'){f.tick(7999);assert.equal(f.active,true);f.tick(1);}else f[action]();
 assert.equal(f.active,false);assert.equal(f.shell,undefined);assert.equal(f.preloads.length,0);assert.equal(f.native.hidden,false);assert.equal(f.context.ReserveStartup.canReveal(),false);
});
test('startup CSS retains the paper background and independent eight-second native release switches',()=>{
 const css=fs.readFileSync(path.join(extension,'startup.css'),'utf8');
 assert.match(css,/background:#FAF9F5/);assert.match(css,/animation:reserve-startup-release 0s 8s forwards/);
 assert.match(css,/html\.reserve-startup-active #content,html\.reserve-startup-active #right-side,html\.reserve-startup-active #right-side-wrapper\{animation:reserve-startup-native 8s step-end forwards\}/);
 assert.match(css,/@keyframes reserve-startup-native\{from\{visibility:hidden\}to\{visibility:visible\}\}/);
 assert.match(css,/@keyframes reserve-startup-release\{to\{visibility:hidden;pointer-events:none\}\}/);
 assert.doesNotMatch(css,/reserve-startup-(?:layout|rail|reader|work|information)|#reserve-startup-shell i\b/);
});
for(const pathname of ['/','/dashboard','/dashboard/'])test('exact dashboard route activates: '+pathname,async()=>{const f=fixture({pathname});await flush();assert.equal(f.active,true);});
for(const opts of [{enabled:false},{search:'?reserve=native'},{pathname:'/login/canvas'},{pathname:'/courses/7'},{pathname:'/dashboard/archive'},{pathname:'/dashboard//'}, {pathname:'/Dashboard'},{frame:true},{origin:'https://not-canvas.example'},{login:true}]){
  test('native remains untouched for '+JSON.stringify(opts),async()=>{const f=fixture(opts);await flush();assert.equal(f.active,false);assert.equal(f.shell,undefined);assert.equal(f.native.hidden,false);assert.equal(f.profileCalls,0);assert.equal(f.preflightCalls,0);assert.equal(f.preloads.length,0);});
}

test('page identity cannot unlock cache while the current server check is pending',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.context.ENV={current_user_id:'7'};
 f.content();await flush();assert.equal(f.profileCalls,1);assert.equal(f.storeAccount,undefined);assert.equal(f.cacheReads,0);assert.equal(f.mounts,0);
 f.loadStyles();assert.equal(f.native.hidden,false);
 f.profile.resolve({id:'7'});await flush();assert.equal(f.mounts,1);assert.equal(f.native.hidden,true);
});

test('a different server account selects only its own cache and never displays the page-hinted owner',async()=>{
 const f=fixture({cache:{user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(0).toISOString()}});
 f.context.ENV={current_user_id:'7'};f.content();await flush();assert.equal(f.cacheReads,0);assert.equal(f.mounts,0);
 f.profile.resolve({id:'8'});f.loadStyles();await flush();assert.equal(f.storeAccount,'8');assert.equal(f.mounts,0);
 f.snapshot('8');await flush();assert.deepEqual(f.mountedUsers,['8']);assert.equal(f.host.hidden,false);
});

test('a missing controller performs no identity or cache work behind the prepaint shell',async()=>{
 const f=fixture();await flush();
 assert.equal(f.active,true);assert.equal(f.cacheReads,0);assert.equal(f.profileCalls,0);
 f.tick(8000);assert.equal(f.active,false);
});

test('the controller remains the sole authoritative account check',async()=>{
 const f=fixture();await flush();assert.equal(f.preflightCalls,0);
 f.content();await flush();assert.equal(f.profileCalls,1);f.profile.resolve({id:'7'});f.snapshot();await flush();f.loadStyles();
 assert.equal(f.mounts,1);assert.equal(f.native.hidden,true);
});
test('explicit reserve=open overrides a readable session native preference',async()=>{const f=fixture({native:true,search:'?reserve=open'});await flush();assert.equal(f.active,true);});
test('storage still pending never hides Canvas; a late preference cannot activate after the deadline',async()=>{const saved=deferred(),f=fixture({storage:saved.promise});await flush();assert.equal(f.active,false);f.tick(8000);saved.resolve({'reserve:enabled':true});await flush();assert.equal(f.active,false);assert.equal(f.preflightCalls,0);assert.equal(f.context.ReserveStartup?.canReveal(),false);});
test('storage rejection fails open and is handled',async()=>{const saved=deferred(),f=fixture({storage:saved.promise});saved.reject(Error('storage unavailable'));await flush();assert.equal(f.active,false);assert.equal(f.context.ReserveStartup?.canReveal(),false);});
test('missing bootstrap CSS cannot hide Canvas',async()=>{const f=fixture({css:false});await flush();assert.equal(f.active,false);assert.equal(f.shell,undefined);assert.equal(f.context.ReserveStartup?.canReveal(),false);});
test('missing main script releases the shell at 8 seconds and cannot reopen automatically',async()=>{const f=fixture();await flush();assert.equal(f.active,true);f.tick(7999);assert.equal(f.active,true);f.tick(1);assert.equal(f.active,false);assert.equal(f.preflightCalls,0);assert.equal(f.shell,undefined);assert.equal(f.context.ReserveStartup?.canReveal(),false);});
test('expired wall clock forbids reveal even when a throttled timer has not fired',async()=>{const f=fixture();await flush();f.elapse(8001);assert.equal(f.context.ReserveStartup?.complete(),false);assert.equal(f.active,false);});
test('native escape dismisses immediately, for this visit only',async()=>{const f=fixture();await flush();assert.ok(f.shell);f.nativeChoice();assert.equal(f.active,false);assert.equal(f.preflightCalls,0);assert.equal(f.preloads.length,0);assert.equal(f.sessionData.get('reserve:native'),undefined,'the next visit opens the workspace again');assert.equal(f.context.ReserveStartup?.complete(),false);});
test('new login markup and persisted pagehide each release pending startup',async()=>{for(const action of ['login','pagehide']){const f=fixture();await flush();assert.equal(f.active,true);f[action]();assert.equal(f.active,false);assert.equal(f.context.ReserveStartup?.complete(),false);}});
for(const [key,target] of [['pointerdown'],['keydown',{tagName:'INPUT'}]])test(key+' on Canvas while preference is pending prevents a later swap',async()=>{const saved=deferred(),f=fixture({storage:saved.promise});f.interact(key,target);saved.resolve({'reserve:enabled':true});await flush();assert.equal(f.active,false);assert.equal(f.context.ReserveStartup?.complete(),false);});
test('styles preload during identity verification; only verified data plus all styles complete startup',async()=>{
  const f=fixture();f.content();await flush();assert.ok(f.host,'styles should start before profile resolves');assert.equal(f.host.hidden,true);assert.equal(f.cacheReads,0);
  f.loadStyles();assert.equal(f.host.hidden,true);assert.equal(f.active,true);f.profile.resolve({id:'7'});await flush();assert.equal(f.storeAccount,'7');assert.equal(f.cacheReads,1);assert.equal(f.mounts,0);
  f.snapshot();await flush();assert.equal(f.mounts,1);assert.equal(f.host.hidden,false);assert.equal(f.active,false);assert.equal(f.native.hidden,true);f.tick(3000);assert.equal(f.host.hidden,false);
});
test('verified data still waits for the last stylesheet behind the startup shell',async()=>{const f=fixture();f.content();await flush();f.profile.resolve({id:'7'});f.snapshot();await flush();assert.equal(f.mounts,1);assert.equal(f.active,true);assert.equal(f.host.hidden,true);const links=f.host.shadowRoot.children.filter(x=>x.tagName==='link');assert.equal(links.length,14);links.slice(0,-1).forEach(link=>link.onload());assert.equal(f.active,true);links.at(-1).onload();assert.equal(f.active,false);assert.equal(f.host.hidden,false);});
test('timeout restores native and aborts startup; late account/network/styles cannot surprise-swap',async()=>{const f=fixture();f.content();await flush();f.tick(8000);assert.equal(f.active,false);assert.equal(f.aborted,true);f.profile.resolve({id:'7'});f.snapshot();f.loadStyles();await flush();assert.equal(f.cacheReads,0);assert.equal(f.mounts,0);assert.equal(f.native.hidden,false);assert.equal(f.host.hidden,true);});
test('native escape during account verification prevents late data from rendering',async()=>{const f=fixture();f.content();await flush();assert.ok(f.shell);f.nativeChoice();f.profile.resolve({id:'7'});f.snapshot();f.loadStyles();await flush();assert.equal(f.mounts,0);assert.equal(f.native.hidden,false);assert.equal(f.host.hidden,true);});
test('authentication rejection releases the shell without reading any account cache',async()=>{const f=fixture();f.content();await flush();const error=Error('Signed out');error.code='auth';f.profile.reject(error);await flush();assert.equal(f.active,false);assert.equal(f.cacheReads,0);assert.equal(f.native.hidden,false);});
test('initial API failure releases the shell immediately, not at its deadline',async()=>{const f=fixture();f.content();await flush();f.profile.resolve({id:'7'});await flush();f.network.reject(Error('offline'));await flush();assert.equal(f.active,false);assert.equal(f.native.hidden,false);});
test('stylesheet error releases the shell and prevents late activation',async()=>{const f=fixture();f.content();await flush();assert.ok(f.host);f.failStyle();assert.equal(f.active,false);f.profile.resolve({id:'7'});f.snapshot();f.loadStyles();await flush();assert.equal(f.native.hidden,false);assert.equal(f.host.hidden,true);});
test('dashboard render exception releases the shell immediately',async()=>{const f=fixture({mountError:true});f.content();await flush();f.profile.resolve({id:'7'});f.snapshot();await flush();assert.equal(f.active,false);assert.equal(f.native.hidden,false);});
test('explicit Reserve button can retry after timeout while automatic late reveal is blocked',async()=>{const f=fixture();f.content();await flush();f.tick(8000);f.dockClick();f.profile.resolve({id:'7'});f.snapshot();await flush();f.loadStyles();assert.equal(f.host.hidden,false);assert.equal(f.mounts,1);});
test('sessionStorage errors no longer keep Canvas native: the workspace starts its account check as usual',async()=>{const f=fixture({sessionError:true});f.content();await flush();assert.equal(f.profileCalls,1);assert.equal(f.active,true);});
test('missing bootstrap fails open; only an explicit Reserve click starts the dashboard',async()=>{const f=fixture({skipStartup:true});f.content();await flush();assert.equal(f.profileCalls,0);assert.equal(f.native.hidden,false);f.dockClick();assert.equal(f.profileCalls,1);f.profile.resolve({id:'7'});f.snapshot();await flush();f.loadStyles();assert.equal(f.host.hidden,false);});
test('late loads from a failed host cannot make its replacement appear without styles',async()=>{const f=fixture();f.content();await flush();assert.ok(f.host);const oldLinks=f.host.shadowRoot.children.filter(x=>x.tagName==='link');f.failStyle();f.dockClick();f.profile.resolve({id:'7'});f.snapshot();await flush();for(const link of oldLinks)link.onload();assert.equal(f.host.hidden,true);f.loadStyles();assert.equal(f.host.hidden,false);});
test('retry after data arrived but styles timed out builds a new styled host and freshly verifies the saved view',async()=>{const f=fixture();f.content();await flush();f.profile.resolve({id:'7'});f.snapshot();await flush();assert.equal(f.mounts,1);const oldHost=f.host,check=f.queueProfile();f.tick(8000);f.dockClick();assert.ok(f.host);assert.notEqual(f.host,oldHost);f.loadStyles();assert.equal(f.host.hidden,true);check.resolve({id:'7'});await flush();assert.equal(f.host.hidden,false);assert.equal(f.native.hidden,true);});

test('Instructure websites on the shared domain are not treated as Canvas schools',()=>{
 const site=require('../extension/site.js');
 for(const host of ['www','community','status','developerdocs','docs','support','info'])assert.equal(site.supported(`https://${host}.instructure.com/`),false,host);
 for(const host of ['school','canvas','my-school.beta'])assert.equal(site.supported(`https://${host}.instructure.com/`),true,host);
 assert.equal(site.canvasPage({getElementById:id=>id==='application'?{}:null,querySelector:()=>null}),true);
 assert.equal(site.canvasPage({getElementById:()=>null,querySelector:selector=>selector.includes('#login_form')?{}:null}),true);
 assert.equal(site.canvasPage({getElementById:()=>null,querySelector:()=>null}),false);
});
test('a dashboard-path page without a Canvas layout releases the cover and never starts the workspace',async()=>{
 const f=fixture({notCanvas:true});f.content();await flush();
 assert.equal(f.shell,undefined,'the start-up cover is released as soon as the page shows it is not Canvas');assert.equal(f.active,false);
 f.parsed();await flush();assert.equal(f.profileCalls,0);assert.equal(f.host,undefined);
});
test('a course page without a Canvas layout gets no Tools button',async()=>{
 const f=fixture({notCanvas:true,pathname:'/courses/7'});f.content();await flush();f.parsed();await flush();
 assert.equal(f.document.getElementById('reserve-companion-dock'),undefined);assert.equal(f.profileCalls,0);
});
// The user (2026-10-15): the dashboard should open Canvas Harness by default; choosing Canvas's own dashboard is for that
// visit only. An older tab-long choice is forgotten, and sessionStorage is no longer needed to decide.
for(const opts of [{native:true},{sessionError:true}])test(`the dashboard opens the cover by default for ${JSON.stringify(opts)}`,async()=>{
 const f=fixture(opts);await flush();assert.equal(f.active,true);assert.ok(f.shell);assert.equal(f.sessionData.get('reserve:native'),undefined);
});
test('clicking Canvas’s menu bar or pressing a key while the cover waits keeps it; using Canvas’s page or a field hands over',async()=>{
 const ctx=f=>f.context.ReserveStartup;
 {const f=fixture();await flush();f.interact('keydown');assert.equal(f.active,true,'Enter or Tab on the page is not using Canvas');}
 {const f=fixture();await flush();f.interact('keydown',{tagName:'TEXTAREA'});assert.equal(f.active,false,'typing into a field is');}
 {const f=fixture();await flush();f.interact('pointerdown');assert.equal(f.active,false,'a click on Canvas’s page hands it over');assert.equal(ctx(f)?.complete(),false);}
});

