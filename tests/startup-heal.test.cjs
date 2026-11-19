'use strict';
// The Dashboard's start after a Microsoft sign-in (owner, 2026-11-14: "whenever I need to login to my canvas the dashboard
// could not load properly", only Canvas's cards until a manual reload). The real site.js, startup.js, session.js, api.js
// and content.js run here; only the browser DOM, the clock, extension storage, Canvas's answers and the dashboard's own
// drawing are stand-ins. Canvas's answers come from a script per address: 401 (Canvas's "not signed in"), 'html' (the
// sign-in page where data was asked for), 'redirect' (a 302 to the sign-in, which the API reads refuse), 'reset' (the
// network still waking), a 5xx, 'hang' (no answer: the 15 s read limit), then normal answers. Every case must end with
// the Canvas Harness dashboard on screen and no reload by hand; reloads by themselves are counted and must stay within one a visit.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const extension=path.join(__dirname,'../extension');
const BASE=Date.parse('2026-11-14T13:02:00Z');

function page(options={}){
 let now=0,nextTimer=0,reloads=0,mounts=0,renderFailures=0,writes=0;
 const timers=new Map(),events={},winEvents={},rafs=[],requests=[];
 const listen=(target,key,fn)=>{(target[key]??=[]).push(fn);};
 class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.hidden=false;this.style={};this.events={};this.attrs={};this.dataset={};this._queries={};const classes=new Set();this.classList={add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x)),contains:v=>classes.has(v),toggle:(v,on)=>{if(on??!classes.has(v)){classes.add(v);return true;}classes.delete(v);return false;}};}
  append(...items){for(const el of items){this.children.push(el);el.parentElement=this;if(el.tagName==='link'&&el.rel==='stylesheet')Promise.resolve().then(()=>options.styleFails?el.onerror?.():el.onload?.());}}
  attachShadow(){return this.shadowRoot=new Element('shadow');}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,fn){listen(this.events,k,fn);}removeEventListener(k,fn){this.events[k]=(this.events[k]||[]).filter(x=>x!==fn);}
  contains(el){return this===el||this.children.some(x=>x.contains(el));}
  querySelector(key){return this._queries[key]||this.children.map(x=>x.querySelector?.(key)).find(Boolean)||null;}
  querySelectorAll(){return [];}
  set innerHTML(value){this._html=value;for(const key of ['button','span','.dock-t','[data-native]','[data-rd-action="settings"]']){const el=new Element(key);this._queries[key]=el;el.parentElement=this;}}
  get innerHTML(){return this._html||'';}
  get isConnected(){let el=this;while(el.parentElement)el=el.parentElement;return el===html;}
  getBoundingClientRect(){return {height:0,width:0};}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
  scrollIntoView(){}
 }
 const html=new Element('html'),head=new Element('head'),body=new Element('body');html.append(head,body);
 const content=new Element();content.id='content';const native=new Element();native.id='dashboard';const sidebar=new Element();sidebar.id='right-side';content.append(native);
 const application=new Element();application.id='application';application.append(content,sidebar);body.append(application);
 const byId=(el,id)=>el.id===id?el:el.children.map(x=>byId(x,id)).find(Boolean);
 const observers=new Set();let login=false;
 const document={documentElement:html,head,body,visibilityState:options.hidden?'hidden':'visible',readyState:'loading',referrer:options.referrer||'',fonts:null,
  getElementById:id=>byId(html,id),createElement:tag=>new Element(tag),querySelector:()=>login?new Element('form'):null,
  addEventListener:(key,fn)=>listen(events,key,fn),removeEventListener:(key,fn)=>events[key]=(events[key]||[]).filter(x=>x!==fn)};
 const window={scrollY:0,scrollTo(){},innerWidth:1440,addEventListener:(key,fn)=>listen(winEvents,key,fn),removeEventListener:(key,fn)=>winEvents[key]=(winEvents[key]||[]).filter(x=>x!==fn)};window.top=window;
 const local=new Map(Object.entries({'reserve:enabled':true,...options.local}));const session=new Map(Object.entries(options.session||{}));
 const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 const chrome={storage:{local:{get:async keys=>{const list=keys==null?[...local.keys()]:[].concat(keys);return Object.fromEntries(list.filter(k=>local.has(k)).map(k=>[k,clone(local.get(k))]));},set:async values=>{writes++;for(const [k,v] of Object.entries(values))local.set(k,clone(v));},remove:async keys=>{for(const k of [].concat(keys))local.delete(k);}},onChanged:{addListener(){},removeListener(){}}},runtime:{id:'fixture',getURL:name=>'chrome-extension://fixture/'+name}};
 // Canvas: scripted answers, then normal ones (the profile of account 7, an empty course list)
 const script={profile:[...(options.profile||[])],courses:[...(options.courses||[])]};
 const respond=(status,text,type)=>({status,ok:status>=200&&status<300,redirected:false,type:'basic',headers:{get:name=>({'content-type':type,link:''})[String(name).toLowerCase()]??null},json:async()=>JSON.parse(text),text:async()=>text});
 function fetch(url,init){
  const p=new URL(url).pathname,kind=p==='/api/v1/users/self/profile'?'profile':p==='/api/v1/courses'?'courses':'other';requests.push(kind);
  const answer=script[kind]?.length?script[kind].shift():kind==='profile'?{id:'7',name:'Sample Student'}:[];
  if(answer&&typeof answer==='object'&&'delay' in answer)return new Promise(done=>context.setTimeout(done,answer.delay)).then(()=>{script[kind].unshift(answer.then);requests.pop();return fetch(url,init);});
  if(answer==='hang')return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'}))));
  if(answer==='redirect'||answer==='reset')return Promise.reject(new TypeError('Failed to fetch'));
  if(answer===401)return Promise.resolve(respond(401,'{"status":"unauthenticated","errors":[{"message":"user authorization required"}]}','application/json; charset=utf-8'));
  if(answer==='html')return Promise.resolve(respond(200,'<!doctype html><title>Log In to Canvas</title>','text/html; charset=utf-8'));
  if(typeof answer==='number')return Promise.resolve(respond(answer,'{"errors":[{"message":"An error occurred"}]}','application/json'));
  return Promise.resolve(respond(200,JSON.stringify(answer),'application/json; charset=utf-8'));
 }
 const store={load:async()=>{},readCache:async()=>options.cache?{origin:'https://school.instructure.com',user:{id:'7'},courses:[],assignments:[],fetchedAt:new Date(BASE-10*3600e3).toISOString()}:null,writeCache:async()=>{},get:()=>({settings:{}}),destroy(){}};
 const statuses=[];
 let lastMount=null;
 const dashboard={mount:(_area,opts)=>{mounts++;lastMount=opts;let ready=false;
  const view={destroy(){},getState:()=>({workspace:'work'}),updateSnapshot(){},setStatus:m=>statuses.push(m),isReady:()=>ready,closePersonalFiles(){},resumePersonalFiles(){}};
  rafs.push(()=>{if(renderFailures<(options.renderFails||0)){renderFailures++;opts.onRenderError(Error('first render failed'));return;}ready=true;opts.onReady();});
  return view;}};
 const loc={origin:'https://school.instructure.com',pathname:options.pathname||'/',search:options.search||'',hash:'',reload(){reloads++;}};loc.href=loc.origin+loc.pathname+loc.search;
 const context={window,document,location:loc,URL,URLSearchParams,AbortController,Event,TextEncoder,TextDecoder,console:{warn(){},log(){}},
  Date:class extends Date{constructor(...a){super(...(a.length?a:[BASE+now]));}static now(){return BASE+now;}},
  performance:{now:()=>now,getEntriesByType:()=>[{type:options.nav||'navigate'}],getEntriesByName:()=>[]},
  navigator:{onLine:options.offline?false:true},
  setTimeout:(fn,delay=0)=>{const id=++nextTimer;timers.set(id,{at:now+Math.max(0,delay),fn});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>{rafs.push(fn);return rafs.length;},cancelAnimationFrame(){},
  MutationObserver:class{constructor(fn){this.fn=fn;}observe(){observers.add(this);}disconnect(){observers.delete(this);}},ResizeObserver:undefined,
  getComputedStyle:()=>({getPropertyValue:()=>'1',animationName:''}),
  fetch,sessionStorage:{getItem:k=>session.has(k)?session.get(k):null,setItem:(k,v)=>session.set(k,String(v)),removeItem:k=>session.delete(k)},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},chrome,
  ReserveStorage:{createStore:()=>store},ReserveDashboard:dashboard};
 if(options.features)context.ReserveFeatureLoad=Promise.resolve(options.features);
 vm.createContext(context);
 const run=name=>vm.runInContext(fs.readFileSync(path.join(extension,name),'utf8'),context,{filename:name});
 for(const name of ['site.js','startup.js','api.js','session.js'])run(name);
 const dispatch=(list,event={})=>{for(const fn of [...(list||[])])fn(event);};
 const f={context,native,local,session,requests,statuses,
  start(){run('content.js');return this;},
  // one step of the page's life: due timers, then promises, then a painted frame while the tab can be seen
  async settle(){for(let i=0;i<6;i++)await new Promise(setImmediate);if(document.visibilityState==='visible')while(rafs.length){rafs.shift()(now);for(let i=0;i<3;i++)await new Promise(setImmediate);}},
  async wait(ms){const end=now+ms;await this.settle();for(;;){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!due){now=end;await this.settle();return;}now=Math.max(now,due[1].at);timers.delete(due[0]);due[1].fn();await this.settle();}},
  hide(){document.visibilityState='hidden';dispatch(events.visibilitychange);},
  show(){document.visibilityState='visible';dispatch(events.visibilitychange);},
  pagehide(persisted){dispatch(winEvents.pagehide,{persisted});},
  pageshow(persisted){dispatch(winEvents.pageshow,{persisted});},
  online(){context.navigator.onLine=true;dispatch(winEvents.online);},
  interact(){dispatch(events.pointerdown,{type:'pointerdown',target:native,composedPath:()=>[native,content,body,html]});},
  click(el){dispatch(el.events.click,{preventDefault(){}});},
  dock(){return byId(html,'reserve-companion-dock');},
  canvasAnswers(kind,list){script[kind].push(...list);},
  get host(){return byId(html,'reserve-companion-host');},
  get shown(){return !!this.host&&this.host.hidden===false&&native.hidden===true&&!this.cover;},
  get canvas(){return native.hidden===false&&!html.classList.contains('reserve-startup-active');},
  get cover(){return this.host?.shadowRoot?.children.find(el=>el.className==='reserve-resume')?.hidden===false;},
  get opening(){return html.classList.contains('reserve-startup-active');},
  get lastMount(){return lastMount;},get reloads(){return reloads;},get mounts(){return mounts;},get writes(){return writes;},get now(){return now;},
  get profiles(){return requests.filter(r=>r==='profile').length;},
  get record(){return (local.get('reserve:startup-record')||[]).at(-1)||null;}
 };
 return f;
}
const codes=f=>(f.record?.steps||[]).map(([,c])=>c);

test('a normal start opens with one account check, makes no extra request and saves its record once',async()=>{
 const f=page().start();await f.wait(3000);
 assert.equal(f.shown,true);assert.equal(f.profiles,1);assert.equal(f.reloads,0);
 assert.equal(f.writes,1,'one storage write: the start-up record, after the dashboard showed');
 assert.equal(f.record.outcome,'shown');assert.equal(f.record.nav,'navigate');assert.equal(f.record.order,'normal');
 assert.ok(!codes(f).some(c=>/retry|fail|reload/.test(c)));
});

// Cause 1: Canvas's first answer after the sign-in says "not signed in" (401) or sends the sign-in page (HTML where data
// was asked for). 4.0.164 read that as a refused account: Canvas's page for the rest of the visit.
for(const answer of [401,'html'])test(`right after a sign-in a "not signed in" answer (${answer}) is checked again and the dashboard opens by itself`,async()=>{
 const f=page({profile:[answer],search:'?login_success=1'}).start();await f.wait(4000);
 assert.equal(f.shown,true,'the Canvas Harness dashboard, not Canvas\'s cards');assert.equal(f.reloads,0,'no reload');assert.equal(f.profiles,2,'a second account check');
 assert.equal(f.record.outcome,'shown');assert.equal(f.record.via,'sign-in');assert.ok(codes(f).includes('fail signed-out')&&codes(f).includes('retry signed-out'));
});

// Cause 2: the network is still waking or Canvas has a passing error: 4.0.164 showed Canvas's page and tried again
// only after twenty seconds in view (or a reload by hand).
for(const [label,answers] of [['a 302 to the sign-in page',['redirect']],['two network failures',['reset','reset']],['a server error',[503]],['no answer (the 15 s read limit)',['hang']]])
 test(`${label} on the first account check is retried with growing waits and the dashboard opens`,async()=>{
  const f=page({profile:answers}).start();await f.wait(answers[0]==='hang'?17500:7000);
  assert.equal(f.shown,true);assert.equal(f.reloads,0);assert.equal(f.profiles,answers.length+1);
  assert.equal(f.record.outcome,'shown');
 });

test('the retries wait 1.5 s, then 4 s, then 10 s, and nothing is shown before Canvas confirms the account',async()=>{
 const f=page({profile:[401,401,401]}).start();
 await f.wait(1400);assert.equal(f.profiles,1);assert.equal(f.shown,false);assert.equal(f.opening,true,'the opening cover stays meanwhile');
 await f.wait(200);assert.equal(f.profiles,2);await f.wait(3800);assert.equal(f.profiles,2);await f.wait(200);assert.equal(f.profiles,3);
 await f.wait(9800);assert.equal(f.profiles,3);await f.wait(300);assert.equal(f.profiles,4);assert.equal(f.shown,true);
});

// Cause 3: a cached view opens first; the first data request after it is refused while the session settles. 4.0.164
// destroyed the open dashboard and showed Canvas for the visit.
test('a 401 on the first course list after the saved view opened keeps the place under the session cover and comes back',async()=>{
 const f=page({cache:true,courses:[{delay:300,then:401}]}).start();
 await f.wait(400);assert.equal(f.cover,true,'the place is kept under "Checking your Canvas session"');assert.equal(f.canvas,false,'Canvas\'s cards never show');
 await f.wait(3000);assert.equal(f.shown,true);assert.equal(f.reloads,0);
});

test('two reads refused together (the session and a module) take one retry step, not two',async()=>{
 const f=page({cache:true,courses:[{delay:300,then:401}]}).start();await f.wait(250);assert.equal(f.shown,true);
 const module=Object.assign(Error('Sign in to Canvas, then refresh Canvas Harness.'),{code:'auth',signedOut:true});
 await f.wait(100);f.lastMount.onAuthError(module);
 await f.wait(1500);assert.equal(f.profiles,2,'the first new try still comes 1.5 s after the first refusal');
 await f.wait(1500);assert.equal(f.shown,true);assert.equal(f.reloads,0);
});

test('a sign-out that lasts gives up after three tries, never reloads, and checks again when the student comes back to the tab',async()=>{
 const f=page({profile:[401,401,401,401]}).start();await f.wait(20000);
 assert.equal(f.canvas,true,'signed out: Canvas\'s own page');assert.equal(f.reloads,0,'never a reload for a sign-out');assert.equal(f.profiles,4);
 assert.equal(f.record.outcome,'canvas');
 f.hide();await f.settle();f.show();await f.wait(3000);
 assert.equal(f.shown,true,'signed in again elsewhere: the tab opens Canvas Harness when the student comes back');assert.equal(f.profiles,5);
});

// The record must say how a visit really went: a page that opened, lost its session, fell back to Canvas's page and came
// back keeps all of it; a plain return to the tab writes nothing; a page left while a try waits keeps its tries.
test('the record keeps a fall back to Canvas and the way back; a plain return to the tab writes nothing',async()=>{
 const lost=()=>Object.assign(Error('Sign in to Canvas, then refresh Canvas Harness.'),{code:'auth',signedOut:true});
 const ends=g=>codes(g).filter(c=>/^(shown|canvas|recheck online)$/.test(c));
 const f=page().start();await f.wait(3000);assert.equal(f.shown,true);
 f.canvasAnswers('profile',[401,401,401]);f.lastMount.onAuthError(lost());await f.wait(20000);assert.equal(f.canvas,true);
 assert.deepEqual(ends(f),['shown','canvas'],'the fall back to Canvas is saved');
 f.online();await f.wait(3000);assert.equal(f.shown,true);
 assert.deepEqual(ends(f),['shown','canvas','recheck online','shown'],'and so is the way back');assert.equal(f.record.outcome,'shown');
 const writes=f.writes;f.hide();await f.settle();f.show();await f.wait(2000);assert.equal(f.shown,true);assert.equal(f.writes,writes,'a plain return to the tab writes nothing');
 const g=page().start();await g.wait(3000);g.canvasAnswers('profile',[401]);g.lastMount.onAuthError(lost());await g.wait(500);
 g.pagehide(false);await g.settle();assert.ok(codes(g).includes('retry signed-out'),'a page left while a try waits keeps its tries: '+codes(g).join(','));
});

test('coming back checks at most three times a visit, ten seconds apart, and never after the student used Canvas\'s page',async()=>{
 const f=page({profile:Array(20).fill(401)}).start();await f.wait(20000);const base=f.profiles;
 for(let i=0;i<6;i++){f.hide();await f.settle();f.show();await f.wait(12000);}
 assert.ok(f.profiles-base<=6&&f.profiles-base>=3,'three checks, each with at most one retry');assert.equal(f.reloads,0);
 const g=page({profile:Array(8).fill(401)}).start();await g.wait(20000);const used=g.profiles;
 g.interact();g.hide();await g.settle();g.show();await g.wait(12000);
 assert.equal(g.profiles,used,'the student used Canvas\'s page after it showed: it stays');assert.equal(g.canvas,true);
});

test('an account that changed is not retried (a refusal, not a sign-in that lags)',async()=>{
 const f=page({profile:[{id:'7'}]}).start();await f.wait(3000);assert.equal(f.shown,true);
 f.canvasAnswers('profile',[{id:'8'}]);f.hide();await f.settle();f.show();await f.wait(20000);
 assert.equal(f.canvas,true);assert.equal(f.reloads,0);assert.equal(f.profiles,2,'no further checks');
});

test('a first drawing that fails is drawn again once; failing again, the page reloads once a visit',async()=>{
 const once=page({renderFails:1}).start();await once.wait(4000);
 assert.equal(once.shown,true);assert.equal(once.reloads,0);assert.equal(once.mounts,2);
 const twice=page({renderFails:5}).start();await twice.wait(6000);
 assert.equal(twice.reloads,1,'the last resort');assert.equal(twice.session.get('reserve:start-reload'),'1');assert.equal(twice.record.outcome,'reload');
 const after=page({renderFails:5,session:{'reserve:start-reload':'1'}}).start();await after.wait(6000);
 assert.equal(after.reloads,0,'one reload per visit: never a loop');assert.equal(after.canvas,true);
});

test('add-ons that could not load (the worker refused) get one reload a visit on the Dashboard',async()=>{
 const f=page({features:{ok:false,error:'refused'}}).start();await f.wait(1000);assert.equal(f.reloads,1);assert.equal(f.record.outcome,'reload');
 const g=page({features:{ok:false},session:{'reserve:start-reload':'1'}}).start();await g.wait(1000);assert.equal(g.reloads,0);
});

test('no reload while the tab is hidden or the network is down; back online, it checks again',async()=>{
 const f=page({profile:['reset','reset','reset','reset'],offline:true}).start();await f.wait(20000);
 assert.equal(f.reloads,0,'offline: a reload would only show the browser\'s offline page');assert.equal(f.canvas,true);
 f.online();await f.wait(3000);assert.equal(f.shown,true);assert.equal(f.reloads,0);
});

test('back online while a try waits: it tries at once instead of at the end of the wait',async()=>{
 const f=page({profile:['reset','reset','reset']}).start();await f.wait(6000);
 assert.equal(f.profiles,3,'tries at 0, 1.5 and 5.5 s; the next waits 10 s');assert.equal(f.shown,false);
 f.online();await f.wait(500);assert.equal(f.profiles,4);assert.equal(f.shown,true,'opened as soon as the network came back');assert.equal(f.reloads,0);
});

// Cause 4: the page went into the back-forward cache before Canvas Harness opened (a click on Canvas's menu while the cover showed,
// then Back): 4.0.164 took the cover's release on pagehide for the student's choice and never opened on return.
test('a start cut short by the back-forward cache opens when the page comes back',async()=>{
 const f=page({profile:['hang']}).start();await f.wait(500);assert.equal(f.opening,true);
 f.pagehide(true);f.context.document.visibilityState='hidden';await f.settle();
 f.canvasAnswers('profile',[{id:'7'}]);f.context.document.visibilityState='visible';f.pageshow(true);await f.wait(3000);
 assert.equal(f.shown,true);assert.equal(f.reloads,0);
});

// Cause 5: the tab was hidden for a moment before its start began (the cover not up yet): 4.0.164 read the cover's
// release as final and the page stayed on Canvas when shown again.
test('a tab hidden before its start began opens when it is shown',async()=>{
 const f=page();f.start();f.hide();await f.settle();
 assert.equal(f.shown,false);f.show();await f.wait(3000);
 assert.equal(f.shown,true);assert.equal(f.reloads,0);
});

test('addresses the sign-in can return to start the dashboard; other Canvas pages do not',async()=>{
 for(const [pathname,search] of [['/','?login_success=1'],['/',''],['/dashboard',''],['/dashboard/','?login_success=1']]){
  const f=page({pathname,search,profile:[401]}).start();await f.wait(4000);assert.equal(f.shown,true,pathname+search);
 }
 const other=page({pathname:'/login/saml'}).start();await other.wait(3000);assert.equal(other.host,undefined);assert.equal(other.record,null,'no record off the Dashboard');
});

test('the start-up record holds codes and times only: no name, address, course or account',async()=>{
 const f=page({profile:[401],referrer:'https://login.microsoftonline.com/'}).start();await f.wait(4000);
 const text=JSON.stringify(f.local.get('reserve:startup-record'));
 assert.ok(!/Sample|Student|instructure|microsoftonline|"7"/.test(text),text);
 assert.deepEqual(Object.keys(f.record).sort(),['at','id','nav','order','outcome','seen','steps','via']);
 assert.equal(f.record.via,'sign-in');assert.match(f.record.at,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
 assert.ok(f.record.steps.every(([t,c])=>Number.isInteger(t)&&/^[a-z][a-z0-9 -]{0,23}$/i.test(c)),JSON.stringify(f.record.steps));
 const h=page({local:{'reserve:startup-record':Array.from({length:12},(_,i)=>({id:'r'+i}))}}).start();await h.wait(3000);
 assert.equal(h.local.get('reserve:startup-record').length,8,'the last eight starts');
});

test('the student\'s choice still wins: no retry after "Canvas dashboard" or a click on Canvas\'s page',async()=>{
 const f=page({profile:[401,401]}).start();await f.wait(100);
 const escape=f.context.document.getElementById('reserve-startup-shell')?.children[0]?.children?.find?.(el=>el.tagName==='a');if(escape)f.click(escape);
 await f.wait(20000);assert.equal(f.reloads,0);assert.ok(f.profiles<=1,'no retry once the student chose Canvas');
});
