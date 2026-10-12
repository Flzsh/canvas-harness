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
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
    scrollIntoView(){}
  }
  const html=new Element('html'),head=new Element('head'),body=new Element('body');html.append(head,body);
  const content=new Element();content.id='content';const native=new Element();native.id='dashboard';const sidebar=new Element();sidebar.id='right-side';content.append(native);body.append(content,sidebar);
  const byId=(el,id)=>el.id===id?el:el.children.map(x=>byId(x,id)).find(Boolean);
  let login=!!options.login;const observers=new Set();
  if(options.emptyDocument){head.remove();body.remove();}
  const document={documentElement:html,head:options.emptyDocument?null:head,body:options.emptyDocument?null:body,visibilityState:'visible',readyState:'loading',getElementById:id=>byId(html,id),createElement:tag=>new Element(tag),querySelector:()=>login?new Element('form'):null,
    addEventListener:(key,fn)=>listen(events,key,fn),removeEventListener:(key,fn)=>events[key]=(events[key]||[]).filter(x=>x!==fn)};
  const window={scrollY:0,scrollTo(){},addEventListener:(key,fn)=>listen(winEvents,key,fn),removeEventListener:(key,fn)=>winEvents[key]=(winEvents[key]||[]).filter(x=>x!==fn)};window.top=options.frame?{}:window;
  const storage=options.storage||Promise.resolve({'reserve:enabled':options.enabled!==false});
  const profile=options.profile||deferred(),network=options.network||deferred(),preflight=options.preflight||deferred(),profiles=[profile];let profileCalls=0,preflightCalls=0,preflightAborted=false,cacheReads=0,mounts=0,storeAccount,aborted=false,preflightRequest;
  const mountedUsers=[];
  const store={load:async()=>{},readCache:async()=>{cacheReads++;return String(options.cache?.user?.id)===String(storeAccount)?options.cache:null;},writeCache:async()=>{},get:()=>({settings:{showGrades:false}}),destroy(){}};
  const loc={origin:options.origin||'https://school.instructure.com',pathname:options.pathname||'/',search:options.search||''};
  loc.href=loc.origin+loc.pathname+loc.search;
  const context={window,document,location:loc,URL,URLSearchParams,AbortController,Date:class extends Date{static now(){return now;}},performance:{now:()=>now},
    setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{at:now+delay,fn});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),
    MutationObserver:class{constructor(fn){this.fn=fn;}observe(){observers.add(this);}disconnect(){observers.delete(this);}},
    getComputedStyle:()=>({getPropertyValue:()=>options.css===false?'':'1'}),
    fetch:(url,init)=>{preflightCalls++;preflightRequest={url,init};init.signal.addEventListener('abort',()=>preflightAborted=true);return preflight.promise;},
    sessionStorage:{getItem:key=>{if(options.sessionError)throw Error('storage denied');return sessionData.get(key)||null;},setItem:(key,value)=>{if(options.sessionError)throw Error('storage denied');sessionData.set(key,value);},removeItem:key=>{if(options.sessionError)throw Error('storage denied');sessionData.delete(key);}},
    chrome:{storage:{local:{get:key=>{reads.push(key);return storage;}}},runtime:{getURL:name=>'chrome-extension://fixture/'+name}},
    ReserveAPI:{createClient:()=>({profile:({signal})=>{const check=profiles[profileCalls++]||profile;signal.addEventListener('abort',()=>aborted=true);return check.promise;},loadSnapshot:()=>network.promise})},
    ReserveStorage:{createStore:({accountId})=>{storeAccount=accountId;return store;}},
    ReserveDashboard:{mount:(_area,{snapshot})=>{if(options.mountError)throw Error('render failed');mounts++;mountedUsers.push(String(snapshot.user.id));return {destroy(){},getState:()=>({}),updateSnapshot(){},setStatus(){}};}}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(extension,'site.js'),'utf8'),context);
  function run(name,optional=false){const file=path.join(extension,name);if(optional&&!fs.existsSync(file))return;vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:name});}
  if(!options.skipStartup)run('startup.js',true);
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
    interact(key='pointerdown'){dispatch(events[key],{key:'Enter',target:native,composedPath:()=>[native,content,body,html]});},
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
  assert.equal(startup.run_at,'document_start');assert.deepEqual(startup.js,['site.js','startup.js']);assert.deepEqual(startup.css,['startup.css']);assert.equal(startup.all_frames,false);
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
 const f=fixture({pathname:'/courses/7/assignments/12'});f.content();await flush();
 assert.equal(f.document.getElementById('reserve-companion-dock'),undefined);assert.equal(f.profileCalls,0);
 f.parsed();await flush();assert.ok(f.document.getElementById('reserve-companion-dock'));assert.equal(f.profileCalls,0);assert.equal(f.host,undefined);
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
 const f=fixture({emptyDocument:true});f.content();await flush();f.tick(2500);f.parserAddsContainers();f.parsed();await flush();
 assert.equal(f.profileCalls,0);assert.equal(f.host,undefined);assert.equal(f.native.hidden,false);
});
test('opted-in dashboard gets a generic prepaint shell without reading cached data or making a competing request',async()=>{
  const f=fixture();await flush();assert.equal(f.active,true);assert.ok(f.shell);assert.deepEqual(f.reads,['reserve:enabled']);assert.equal(f.preflightCalls,0);assert.equal(f.profileCalls,0);assert.equal(f.cacheReads,0);assert.equal(f.native.hidden,false);
  assert.equal(f.preloads.length,12,'local styles begin fetching before the main controller');
  assert.ok(f.preloads.every(link=>link.as==='style'&&link.href.startsWith('chrome-extension://fixture/')));
});
for(const pathname of ['/','/dashboard','/dashboard/'])test('exact dashboard route activates: '+pathname,async()=>{const f=fixture({pathname});await flush();assert.equal(f.active,true);});
for(const opts of [{enabled:false},{search:'?reserve=native'},{native:true},{sessionError:true},{pathname:'/login/canvas'},{pathname:'/courses/7'},{pathname:'/dashboard/archive'},{pathname:'/dashboard//'}, {pathname:'/Dashboard'},{frame:true},{origin:'https://not-canvas.example'},{login:true}]){
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
 f.tick(2500);assert.equal(f.active,false);
});

test('the controller remains the sole authoritative account check',async()=>{
 const f=fixture();await flush();assert.equal(f.preflightCalls,0);
 f.content();await flush();assert.equal(f.profileCalls,1);f.profile.resolve({id:'7'});f.snapshot();await flush();f.loadStyles();
 assert.equal(f.mounts,1);assert.equal(f.native.hidden,true);
});
test('explicit reserve=open overrides a readable session native preference',async()=>{const f=fixture({native:true,search:'?reserve=open'});await flush();assert.equal(f.active,true);});
test('storage still pending never hides Canvas; a late preference cannot activate after the deadline',async()=>{const saved=deferred(),f=fixture({storage:saved.promise});await flush();assert.equal(f.active,false);f.tick(2500);saved.resolve({'reserve:enabled':true});await flush();assert.equal(f.active,false);assert.equal(f.preflightCalls,0);assert.equal(f.context.ReserveStartup?.canReveal(),false);});
test('storage rejection fails open and is handled',async()=>{const saved=deferred(),f=fixture({storage:saved.promise});saved.reject(Error('storage unavailable'));await flush();assert.equal(f.active,false);assert.equal(f.context.ReserveStartup?.canReveal(),false);});
test('missing bootstrap CSS cannot hide Canvas',async()=>{const f=fixture({css:false});await flush();assert.equal(f.active,false);assert.equal(f.shell,undefined);assert.equal(f.context.ReserveStartup?.canReveal(),false);});
test('missing main script releases the shell at 2.5 seconds and cannot reopen automatically',async()=>{const f=fixture();await flush();assert.equal(f.active,true);f.tick(2499);assert.equal(f.active,true);f.tick(1);assert.equal(f.active,false);assert.equal(f.preflightCalls,0);assert.equal(f.shell,undefined);assert.equal(f.context.ReserveStartup?.canReveal(),false);});
test('expired wall clock forbids reveal even when a throttled timer has not fired',async()=>{const f=fixture();await flush();f.elapse(2501);assert.equal(f.context.ReserveStartup?.complete(),false);assert.equal(f.active,false);});
test('native escape dismisses immediately and stores this tab preference',async()=>{const f=fixture();await flush();assert.ok(f.shell);f.nativeChoice();assert.equal(f.active,false);assert.equal(f.preflightCalls,0);assert.equal(f.preloads.length,0);assert.equal(f.sessionData.get('reserve:native'),'true');assert.equal(f.context.ReserveStartup?.complete(),false);});
test('new login markup and persisted pagehide each release pending startup',async()=>{for(const action of ['login','pagehide']){const f=fixture();await flush();assert.equal(f.active,true);f[action]();assert.equal(f.active,false);assert.equal(f.context.ReserveStartup?.complete(),false);}});
for(const key of ['pointerdown','keydown'])test(key+' on Canvas while preference is pending prevents a later swap',async()=>{const saved=deferred(),f=fixture({storage:saved.promise});f.interact(key);saved.resolve({'reserve:enabled':true});await flush();assert.equal(f.active,false);assert.equal(f.context.ReserveStartup?.complete(),false);});
test('styles preload during identity verification; only verified data plus all styles complete startup',async()=>{
  const f=fixture();f.content();await flush();assert.ok(f.host,'styles should start before profile resolves');assert.equal(f.host.hidden,true);assert.equal(f.cacheReads,0);
  f.loadStyles();assert.equal(f.host.hidden,true);assert.equal(f.active,true);f.profile.resolve({id:'7'});await flush();assert.equal(f.storeAccount,'7');assert.equal(f.cacheReads,1);assert.equal(f.mounts,0);
  f.snapshot();await flush();assert.equal(f.mounts,1);assert.equal(f.host.hidden,false);assert.equal(f.active,false);assert.equal(f.native.hidden,true);f.tick(3000);assert.equal(f.host.hidden,false);
});
test('verified data still waits for the last stylesheet behind the startup shell',async()=>{const f=fixture();f.content();await flush();f.profile.resolve({id:'7'});f.snapshot();await flush();assert.equal(f.mounts,1);assert.equal(f.active,true);assert.equal(f.host.hidden,true);const links=f.host.shadowRoot.children.filter(x=>x.tagName==='link');assert.equal(links.length,12);links.slice(0,-1).forEach(link=>link.onload());assert.equal(f.active,true);links.at(-1).onload();assert.equal(f.active,false);assert.equal(f.host.hidden,false);});
test('timeout restores native and aborts startup; late account/network/styles cannot surprise-swap',async()=>{const f=fixture();f.content();await flush();f.tick(2500);assert.equal(f.active,false);assert.equal(f.aborted,true);f.profile.resolve({id:'7'});f.snapshot();f.loadStyles();await flush();assert.equal(f.cacheReads,0);assert.equal(f.mounts,0);assert.equal(f.native.hidden,false);assert.equal(f.host.hidden,true);});
test('native escape during account verification prevents late data from rendering',async()=>{const f=fixture();f.content();await flush();assert.ok(f.shell);f.nativeChoice();f.profile.resolve({id:'7'});f.snapshot();f.loadStyles();await flush();assert.equal(f.mounts,0);assert.equal(f.native.hidden,false);assert.equal(f.host.hidden,true);});
test('authentication rejection releases the shell without reading any account cache',async()=>{const f=fixture();f.content();await flush();const error=Error('Signed out');error.code='auth';f.profile.reject(error);await flush();assert.equal(f.active,false);assert.equal(f.cacheReads,0);assert.equal(f.native.hidden,false);});
test('initial API failure releases the shell immediately, not at its deadline',async()=>{const f=fixture();f.content();await flush();f.profile.resolve({id:'7'});await flush();f.network.reject(Error('offline'));await flush();assert.equal(f.active,false);assert.equal(f.native.hidden,false);});
test('stylesheet error releases the shell and prevents late activation',async()=>{const f=fixture();f.content();await flush();assert.ok(f.host);f.failStyle();assert.equal(f.active,false);f.profile.resolve({id:'7'});f.snapshot();f.loadStyles();await flush();assert.equal(f.native.hidden,false);assert.equal(f.host.hidden,true);});
test('dashboard render exception releases the shell immediately',async()=>{const f=fixture({mountError:true});f.content();await flush();f.profile.resolve({id:'7'});f.snapshot();await flush();assert.equal(f.active,false);assert.equal(f.native.hidden,false);});
test('explicit Reserve button can retry after timeout while automatic late reveal is blocked',async()=>{const f=fixture();f.content();await flush();f.tick(2500);f.dockClick();f.profile.resolve({id:'7'});f.snapshot();await flush();f.loadStyles();assert.equal(f.host.hidden,false);assert.equal(f.mounts,1);});
test('content remains native when sessionStorage reads throw',async()=>{const f=fixture({sessionError:true});f.content();await flush();assert.equal(f.profileCalls,0);assert.equal(f.native.hidden,false);assert.equal(f.active,false);});
test('missing bootstrap fails open; only an explicit Reserve click starts the dashboard',async()=>{const f=fixture({skipStartup:true});f.content();await flush();assert.equal(f.profileCalls,0);assert.equal(f.native.hidden,false);f.dockClick();assert.equal(f.profileCalls,1);f.profile.resolve({id:'7'});f.snapshot();await flush();f.loadStyles();assert.equal(f.host.hidden,false);});
test('late loads from a failed host cannot make its replacement appear without styles',async()=>{const f=fixture();f.content();await flush();assert.ok(f.host);const oldLinks=f.host.shadowRoot.children.filter(x=>x.tagName==='link');f.failStyle();f.dockClick();f.profile.resolve({id:'7'});f.snapshot();await flush();for(const link of oldLinks)link.onload();assert.equal(f.host.hidden,true);f.loadStyles();assert.equal(f.host.hidden,false);});
test('retry after data arrived but styles timed out builds a new styled host and freshly verifies the saved view',async()=>{const f=fixture();f.content();await flush();f.profile.resolve({id:'7'});f.snapshot();await flush();assert.equal(f.mounts,1);const oldHost=f.host,check=f.queueProfile();f.tick(2500);f.dockClick();assert.ok(f.host);assert.notEqual(f.host,oldHost);f.loadStyles();assert.equal(f.host.hidden,true);check.resolve({id:'7'});await flush();assert.equal(f.host.hidden,false);assert.equal(f.native.hidden,true);});
