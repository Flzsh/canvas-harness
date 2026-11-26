'use strict';
// Roadmap item 8 (4.2): Multitask on an assignment's own pages. Another assignment open beside this one for reading (our
// reading view from Canvas's API: no form, no Submit), the Home focus timer and notes reachable from a drawn chip, a
// drawn divider, swap, close, kept on reload, stacked at narrow widths. Safety first: switched off on the page, nothing of
// it exists (no node, listener, timer, storage read or request); Canvas's Submit is never under the column.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const M=require('../extension/multitask.js'),F=require('../extension/features.js'),Core=require('../extension/core.js');
const ORIGIN='https://school.instructure.com';
const tick=async(n=6)=>{for(let i=0;i<n;i++)await new Promise(setImmediate);};
function storage(initial=[]){const data=new Map(initial),log=[];return {data,log,getItem:key=>{log.push(['get',key]);return data.has(key)?data.get(key):null;},setItem:(key,value)=>{log.push(['set',key]);data.set(key,String(value));},removeItem:key=>{log.push(['remove',key]);data.delete(key);}};}

// ---------------------------------------------------------------- the pure parts
test('its saved place is cleaned, kept per assignment, the 50 most recent, and junk or a throwing storage means none',()=>{
 const s=storage();
 assert.equal(M.writeState(s,'7/12',{t:'beside',b:'7/13',n:'Lab',r:.5,s:1,y:240,l:84}),true);
 assert.deepEqual(M.readState(s,'7/12'),{t:'beside',b:'7/13',n:'Lab',r:.5,s:1,y:240,l:84,at:M.readState(s,'7/12').at});
 assert.equal(M.readState(s,'7/13'),null);
 // out-of-range and foreign values come back clean
 M.writeState(s,'7/14',{t:'nope',b:'javascript:alert(1)',r:9,s:'yes',y:-3,l:9999,n:'x'.repeat(500)});
 const c=M.readState(s,'7/14');assert.equal(c.t,'beside');assert.equal(c.b,'');assert.equal(c.r,.8);assert.equal(c.s,0);assert.equal(c.y,0);assert.equal(c.l,0);assert.equal(c.n.length,160);
 assert.equal(M.writeState(s,'not-a-page',{t:'tools'}),false);assert.equal(M.writeState(s,'7/12',null),true);assert.equal(M.readState(s,'7/12'),null);
 for(let i=0;i<70;i++)M.writeState(s,'9/'+i,{t:'tools'},1000+i);
 const all=JSON.parse(s.data.get(M.KEY));assert.equal(Object.keys(all).length,50);assert.ok(!('9/0' in all)&&('9/69' in all));
 assert.ok(s.data.get(M.KEY).length<7500,s.data.get(M.KEY).length+' bytes');
 for(const junk of ['not json','[1]','"x"','{"7/12":"yes","bad":{}}'])assert.equal(M.readState(storage([[M.KEY,junk]]),'7/12'),null,junk);
 const broken={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');}};
 assert.equal(M.readState(broken,'7/12'),null);assert.equal(M.writeState(broken,'7/12',{t:'tools'}),false);
 // nothing the student typed is ever part of it
 assert.deepEqual(Object.keys(M.cleanState({t:'tools',query:'my essay',notes:'draft',text:'answer'})).sort(),['at','b','l','n','r','s','t','y']);
});

test('side by side at 1366 and at 1707 at 150 %, stacked when narrow, the column and Canvas\'s page never below their least',()=>{
 const wide=M.layout({vw:1366,vh:768,lead:84});assert.equal(wide.mode,'side');assert.equal(wide.edge,'right');assert.ok(wide.size>=M.MIN_PANE&&1366-84-wide.size>=M.MIN_PAGE,JSON.stringify(wide));
 const scaled=M.layout({vw:1138,vh:640,lead:84});assert.equal(scaled.mode,'side');assert.ok(scaled.size>=M.MIN_PANE&&1138-84-scaled.size>=M.MIN_PAGE,JSON.stringify(scaled));
 assert.equal(M.layout({vw:1366,vh:768,lead:84,swap:true}).edge,'left');
 for(const ratio of [.2,.5,.8]){const g=M.layout({vw:1366,vh:768,lead:84,ratio});assert.ok(g.size>=300&&1282-g.size>=520,ratio+' '+g.size);}
 const narrow=M.layout({vw:880,vh:700,lead:84});assert.equal(narrow.mode,'stack');assert.equal(narrow.edge,'top','stacked: above Canvas\'s page, in its flow');assert.ok(narrow.size>=180&&700-narrow.size>=200,JSON.stringify(narrow));
 assert.equal(M.layout({vw:700,vh:700,swap:true}).edge,'top');
 // a fixed bar of Canvas's at the bottom: the column ends above it
 const cleared=M.layout({vw:1366,vh:768,lead:84,clear:68});assert.match(M.hostCSS(cleared),/bottom:68px/);
 // the room taken from Canvas's page is added to its own padding, on the column's edge only
 assert.equal(M.pageCSS(wide,{right:'0px'}),'body{box-sizing:border-box!important;padding-right:calc(0px + '+wide.size+'px)!important}');
 assert.match(M.pageCSS(M.layout({vw:1366,vh:768,lead:84,swap:true}),{left:'4px'}),/padding-left:calc\(4px \+ \d+px\)/);
 assert.equal(M.pageCSS(narrow,{}),'','stacked, the block takes its own room in the flow');
 assert.match(M.hostCSS(narrow),/^position:relative;z-index:0;display:block;margin:0 0 0 84px;height:\d+px$/,'in the flow, never fixed over the page');
 assert.equal(M.layout({vw:1366,vh:768,lead:84,stack:true}).mode,'stack','Canvas needs the whole width: stacked');
 assert.equal(M.layout({vw:1366,vh:768,lead:84,cap:360}).size,360,'given width back');assert.equal(M.layout({vw:1366,vh:768,lead:84,cap:100}).size,300,'never under its least');
 assert.equal(M.ratioAt(narrow,10,200+narrow.size*0+350,880,700,200),.5,'stacked: the pointer below the block\'s top');
 // fixed at z-index 0: Canvas's positioned things (menus, dialogs, a footer with Submit) paint above the column
 assert.match(M.hostCSS(wide),/^position:fixed;z-index:0;/);
 // a pointer on the divider asks for the column's new share
 assert.equal(M.ratioAt(wide,1366-641,300,1366,768),.5);assert.equal(M.ratioAt(wide,10,300,1366,768),.8);assert.equal(M.ratioAt(wide,1360,300,1366,768),.2);
});

test('Submit is never under the column: a bar at the bottom pushes it up, anything else moves it, uncovered controls are left alone',()=>{
 const pane={left:900,right:1366,top:0,bottom:768},ours={},el={},vh=768;
 // Canvas paints its footer above ours (z-index 0, first child): nothing covered, but the column still ends above the bar
 const footer={el,rect:{left:1200,right:1340,top:716,bottom:752,width:140,height:36},bar:{left:84,right:1366,top:704,bottom:768}};
 let r=M.submitGuard({controls:[footer],pane,topAt:()=>el,ours,vh});assert.deepEqual(r.covered,[]);assert.equal(r.clear,68);assert.equal(r.move,false);
 // ours on top of it: covered, and the clearance fixes it
 r=M.submitGuard({controls:[footer],pane,topAt:()=>ours,ours,vh});assert.deepEqual(r.covered,[el]);assert.equal(r.clear,68);assert.equal(r.move,false);
 // a Submit in the page's flow under the column (overflow): move
 const inflow={el,rect:{left:1000,right:1100,top:300,bottom:336,width:100,height:36},bar:null};
 r=M.submitGuard({controls:[inflow],pane,topAt:()=>ours,ours,vh});assert.equal(r.move,true);assert.equal(r.clear,0);
 // not under the column at all
 r=M.submitGuard({controls:[{el,rect:{left:200,right:300,top:300,bottom:336,width:100,height:36},bar:null}],pane,topAt:()=>ours,ours,vh});assert.deepEqual(r.covered,[]);assert.equal(r.move,false);
 // the bar is asked for only when needed
 let asked=0;M.submitGuard({controls:[{el,rect:{left:1000,right:1100,top:300,bottom:336,width:100,height:36}}],pane,topAt:()=>el,ours,vh,barOf:()=>{asked++;return null;}});assert.equal(asked,1);
 // what counts as a Submit: Canvas's own (classic and newer page) and buttons that say so; not reading controls
 const button=(text,{matches=false}={})=>({textContent:text,matches:()=>matches});
 for(const text of ['Submit Assignment','Submit','Start Assignment','New Attempt','Try Again','Resubmit Assignment','Upload File','Cancel Attempt'])assert.ok(M.submitLike(button(text)),text);
 for(const text of ['Open in Canvas','Download','Rubric','Pick another','Submission Details'])assert.ok(!M.submitLike(button(text)),text);
 assert.ok(M.submitLike(button('',{matches:true})));
 for(const selector of ['#submit_assignment','.submit_assignment_link','#submit_file_button','[data-testid="submit-button"]','button[type="submit"]'])assert.ok(M.SUBMIT_SELECTOR.split(',').includes(selector),selector);
});

test('the timer here is the Home focus timer: the same record and the same changes',()=>{
 const now=Date.parse('2026-11-22T20:00:00Z'),data={};
 assert.equal(M.focusChange(data,'minutes',{now,minutes:45,Core}),true);assert.equal(data.focus.minutes,45);assert.equal(data.focus.endsAt,null);
 assert.equal(M.focusChange(data,'start',{now,Core}),true);assert.equal(data.focus.endsAt,now+45*60000);assert.equal(data.focus.fromPony,false);
 assert.equal(M.focusChange(data,'minutes',{now,minutes:15,Core}),false,'not while running');
 assert.equal(M.focusChange(data,'pause',{now:now+60000,Core}),true);assert.equal(data.focus.endsAt,null);assert.equal(Math.round(data.focus.remaining),44*60);
 assert.equal(Core.focusState(data.focus,now+120000).paused,true);
 assert.equal(M.focusChange(data,'start',{now:now+120000,Core}),true,'Start on a paused timer resumes it');assert.equal(data.focus.endsAt,now+120000+44*60000);
 assert.equal(M.focusChange(data,'adjust',{now:now+120000,minutes:5,Core}),true);assert.equal(data.focus.endsAt,now+120000+49*60000);
 assert.equal(M.focusChange(data,'adjust',{now:now+120000,minutes:-60,Core}),true);assert.equal(data.focus.endsAt,now+120000+60000,'never under one minute');
 assert.equal(M.focusChange(data,'stop',{now:now+130000,Core}),true);assert.equal(data.focus.stoppedAt,now+130000);assert.equal(Core.focusState(data.focus,now+130000).active,false);
 assert.equal(M.focusChange(data,'stop',{now:now+140000,Core}),false);
 assert.equal(M.focusChange(data,'reset',{now,Core}),true);assert.equal(data.focus.endsAt,null);assert.equal(data.focus.stoppedAt,0);
 // a finished session is settled first (one session counted), as on Home
 const done={focus:{minutes:25,remaining:1500,endsAt:now-1000}};assert.equal(M.focusChange(done,'pause',{now,Core}),false);assert.equal(done.focus.sessions,1);
});

test('the finder is Quick open\'s own list: assignments only, this one left out, this course first, then what is due soon',()=>{
 const Q=require('../extension/quick-open.js'),now=Date.parse('2026-11-22T12:00:00Z');
 const items=[['10100','7','Lab report',2],['10101','7','Worksheet',-1],['10102','7','Old quiz',-60],['20100','8','Essay draft',3],['20101','8','Far away',60]].map(([id,courseId,name,days])=>({id,courseId,name,url:`${ORIGIN}/courses/${courseId}/assignments/${id}`,dueAt:new Date(now+days*864e5).toISOString()}));
 const courses=[{id:'7',name:'CL Chemistry',shortName:'Chemistry'},{id:'8',name:'CL English',shortName:'English'}];
 const pool=Q.entries({courses,items});
 const rows=M.finderRows(pool,{courseId:'7',current:'7/10100',now,QuickOpen:Q});
 assert.deepEqual(rows.map(r=>[r.group,r.assignmentId]),[['This course','10101'],['This course','10102'],['Due soon','20100']]);
 assert.ok(rows.every(r=>r.kind==='Assignments'));
 const found=M.finderRows(pool,{query:'essay',courseId:'7',current:'7/10100',now,QuickOpen:Q});assert.deepEqual(found.map(r=>r.assignmentId),['20100']);
 assert.deepEqual(M.finderRows(pool,{query:'lab',courseId:'7',current:'7/10100',now,QuickOpen:Q}),[],'the page itself is never offered beside itself');
});

test('the reading view beside has no form, no file field and no Submit; teacher HTML only through the sanitizer; links open a new tab',()=>{
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const seen=[],rich=html=>{seen.push(html);return '<p>Read it.</p><p><a href="https://school.instructure.com/courses/7/files/9" target="_blank" rel="noopener noreferrer">Handout.pdf</a></p>';};
 const item=Core.normalizeAssignment({id:'13',name:'Lab <b>report</b>',description:'<p>Read it.</p><img src="x"><form><input type="file"><button type="submit">Submit</button></form><script>alert(1)</script>',due_at:'2026-11-24T04:59:00Z',points_possible:20,submission_types:['online_upload'],rubric:[{description:'Method',long_description:'Shown',points:10},{description:'Accuracy',points:10}],html_url:ORIGIN+'/courses/7/assignments/13'},{id:'7',name:'Chemistry'});
 const html=M.readingHTML(item,{E,rich,icon:name=>`<svg data-i="${name}"></svg>`,when:v=>'Mon',status:'Not submitted',course:'Chemistry'});
 assert.deepEqual(seen,[item.description],'the description goes through the sanitizer, once');
 for(const bad of [/<form/i,/type="file"/i,/<input/i,/type="submit"/i,/>\s*Submit\s*</i,/<script/i,/<iframe/i,/<img/i])assert.doesNotMatch(html,bad,String(bad));
 assert.match(html,/Lab &lt;b&gt;report&lt;\/b&gt;/,'the title is text');
 assert.match(html,/Grading rubric<\/span><small> · 2 criteria · 20 points/);assert.match(html,/Submitting a file upload/);assert.match(html,/Not submitted/);
 assert.match(html,/Pictures and media show in Canvas\./,'says what it leaves out');
 for(const m of html.matchAll(/<a [^>]*>/g))assert.match(m[0],/target="_blank" rel="noopener noreferrer"/,m[0]);
 assert.match(html,/href="https:\/\/school.instructure.com\/courses\/7\/assignments\/13"/);
 assert.match(html,/Linked materials <b>1<\/b>/);
});

test('wiring: part of Quick open & study tools, loaded before the PDF reader; the page switch shows for it; Biscuit leaves it out',()=>{
 const tools=F.catalogue.find(f=>f.id==='tools');assert.ok(tools.files.js.includes('multitask.js'));
 const js=F.resolve().js;assert.ok(js.includes('multitask.js'));assert.ok(js.indexOf('native-tools.js')<js.indexOf('multitask.js')&&js.indexOf('multitask.js')<js.indexOf('pdf-art.js'));
 assert.ok(F.resolve({preset:'lite'}).js.includes('multitask.js'),'Lite keeps Tools, and so this');
 assert.ok(!F.resolve({preset:'custom',custom:['dashboard']}).js.includes('multitask.js'),'off with Quick open & study tools');
 assert.match(read('page-switch.js'),/const PARTS=\['canvas-nav','pdf','play','tools'\]/);
 assert.match(read('../scripts/biscuit-control-inventory.cjs'),/f!=='multitask\.js'/);
 // no request but Canvas's own: no fetch of its own, no other site, no AI, no calculator frame
 const src=read('multitask.js');
 assert.doesNotMatch(src,/\bfetch\(|XMLHttpRequest|sendMessage|desmos|https?:\/\/(?!school.instructure.com|www\.w3\.org\/2000\/svg)[a-z]/i,'the only other address in it is the SVG namespace of a drawing');
 assert.doesNotMatch(src,/ReserveToolboxSession|CanvasHarnessAISource|AgentClient/,'the toolbox session\'s AI visit is not used');
});

// ---------------------------------------------------------------- on a page: a small DOM
class El{
 constructor(tag,doc){this.localName=String(tag).toLowerCase();this.tagName=this.localName.toUpperCase();this.ownerDocument=doc;this.children=[];this.parentNode=null;this.attrs=new Map();this.dataset={};this.style={cssText:'',setProperty(){}};this.listeners=[];this.textContent='';this.innerHTML='';this.hidden=false;this.shadowRoot=null;this.rect=null;this.disabled=false;}
 get parentElement(){return this.parentNode instanceof El?this.parentNode:null;}
 get firstChild(){return this.children[0]||null;}
 get isConnected(){let n=this;while(n.parentNode)n=n.parentNode;return n===this.ownerDocument.documentElement;}
 append(...nodes){for(const n of nodes){n.remove?.();n.parentNode=this;this.children.push(n);}}
 prepend(...nodes){for(const n of nodes.reverse()){n.remove?.();n.parentNode=this;this.children.unshift(n);}}
 insertBefore(n,ref){n.remove?.();const at=ref?this.children.indexOf(ref):-1;n.parentNode=this;if(at<0)this.children.push(n);else this.children.splice(at,0,n);return n;}
 remove(){const p=this.parentNode;if(p){p.children.splice(p.children.indexOf(this),1);this.parentNode=null;}}
 setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;}removeAttribute(k){this.attrs.delete(k);}hasAttribute(k){return this.attrs.has(k);}
 addEventListener(type,fn,options){this.listeners.push([type,fn,options]);}removeEventListener(type,fn){this.listeners=this.listeners.filter(l=>!(l[0]===type&&l[1]===fn));}
 attachShadow(){this.shadowRoot=new Shadow(this);return this.shadowRoot;}
 getClientRects(){return [1];}getBoundingClientRect(){return this.rect||{left:0,top:0,right:0,bottom:0,width:0,height:0};}
 closest(selector){const names=selector.split(',').map(s=>s.trim());for(let n=this;n;n=n.parentElement)if(names.includes(n.localName))return n;return null;}
 // (inside a shadow root's stand-in parts: one stand-in per selector, as the shadow root hands them out)
 matches(){return false;}querySelector(selector){this.parts??=new Map();if(!this.parts.has(selector))this.parts.set(selector,new El('part',this.ownerDocument));return this.parts.get(selector);}querySelectorAll(){return [];}focus(){}click(){}
 descendants(){return this.children.flatMap(c=>[c,...c.descendants()]);}
}
// A shadow root that keeps what was written into it and hands out one stand-in element per selector.
class Shadow{constructor(host){this.host=host;this.innerHTML='';this.listeners=[];this.parts=new Map();this.activeElement=null;}
 addEventListener(type,fn){this.listeners.push([type,fn]);}
 querySelector(selector){if(!this.parts.has(selector))this.parts.set(selector,new El('part',this.host.ownerDocument));return this.parts.get(selector);}
 querySelectorAll(){return [];}
 fire(type,event){for(const [t,fn] of this.listeners)if(t===type)fn(event);}
 press(mt,data={}){this.fire('click',{composedPath:()=>[{dataset:{mt,...data}}]});}}

function page({route='/courses/101/assignments/10100',off=false,saved=null,prefs={preset:'full'},hint=JSON.stringify({preset:'full'}),loading=true,snapshot=true,extra=[],stored={}}={}){
 const local=storage([['reserve:features-hint',hint],...(off?[['reserve:page-off',JSON.stringify({'101/10100':1})]]:[]),...(saved?[[M.KEY,JSON.stringify(saved)]]:[]),...extra]);
 const doc={readyState:loading?'loading':'complete',listeners:[],fonts:Object.assign([],{add(){},delete(){}})};
 doc.documentElement=new El('html',doc);doc.head=new El('head',doc);doc.body=new El('body',doc);doc.documentElement.append(doc.head,doc.body);
 const crumbs=new El('div',doc);crumbs.className='ic-app-nav-toggle-and-crumbs';const wrapper=new El('div',doc);wrapper.id='wrapper';const content=new El('div',doc);content.id='content';
 const canvasFirst=new El('header',doc);doc.body.append(canvasFirst,wrapper);wrapper.append(crumbs,content);
 const buttons=[];
 Object.assign(doc,{createElement:tag=>new El(tag,doc),getElementById:id=>id==='wrapper'?wrapper:id==='content'?content:null,
  querySelector:s=>s==='.ic-app-nav-toggle-and-crumbs'?crumbs:s==='reserve-page-switch'?doc.documentElement.descendants().find(n=>n.localName==='reserve-page-switch')||null:null,
  querySelectorAll:s=>s.startsWith('button')?buttons:[],elementFromPoint:()=>doc.topAt?.()??null,
  addEventListener:(type,fn,options)=>doc.listeners.push([type,fn,options]),removeEventListener:(type,fn)=>{doc.listeners=doc.listeners.filter(l=>!(l[0]===type&&l[1]===fn));}});
 const win={listeners:[]},timers=new Map(),frames=new Map(),requests=[],stores=[];let ids=0;
 const client={profile:async()=>{requests.push('profile');return {id:'7'};},createReadScope:()=>({}),endReadScope(){},
  readAssignment:async(cid,aid)=>{requests.push('assignment '+cid+'/'+aid);return {id:aid,course_id:cid,name:'Equilibrium worksheet',description:'<p>Balance each equation.</p>',due_at:'2026-11-24T04:59:00Z',points_possible:15,submission_types:['online_upload'],rubric:[{description:'Method',points:10}],html_url:`${ORIGIN}/courses/${cid}/assignments/${aid}`};},
  list:async path=>{requests.push('list '+path);return [];}};
 let data={settings:{timeZone:'America/New_York'},toolbox:{scratchpad:'old note'},tasks:{},focus:{}};
 const cache={origin:ORIGIN,user:{id:'7'},courses:[{id:'101',name:'CL Chemistry-Section A',course_code:'CHEM 101'}],assignments:[{id:'10100',course_id:'101',name:'Reaction rates',due_at:'2026-11-23T03:00:00Z'},{id:'10101',course_id:'101',name:'Equilibrium worksheet',due_at:'2026-11-24T04:59:00Z'}],fetchedAt:'2026-11-22T12:00:00Z'};
 const env=vm.createContext({URL,Intl,Date,JSON,Math,Object,Number,String,Array,Map,Set,Promise,Error,AbortController,console,structuredClone,
  location:new URL(route,ORIGIN),document:doc,localStorage:local,innerWidth:1366,innerHeight:768,
  addEventListener:(type,fn,options)=>win.listeners.push([type,fn,options]),removeEventListener:(type,fn)=>{win.listeners=win.listeners.filter(l=>!(l[0]===type&&l[1]===fn));},
  getComputedStyle:el=>({marginLeft:el===wrapper?'84px':'0px',paddingRight:'0px',paddingLeft:'0px',paddingTop:'0px',paddingBottom:'0px',position:el.fixed?'fixed':'static'}),
  setTimeout:(fn,ms)=>{const id=++ids;timers.set(id,{fn,ms,repeat:false});return id;},setInterval:(fn,ms)=>{const id=++ids;timers.set(id,{fn,ms,repeat:true});return id;},clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id),
  requestAnimationFrame:fn=>{const id=++ids;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  fetch:(...args)=>{requests.push(['fetch',...args]);throw Error('no fetch of its own');},MutationObserver:class{observe(){}disconnect(){}},FontFace:class{},
  chrome:{runtime:{getURL:p=>'chrome-extension://x/'+p,getManifest:()=>({short_name:'CH+'})},storage:{local:{get:async()=>({'reserve:features':prefs,...stored})},onChanged:{addListener(){}}}},
  ReserveAPI:{createClient:()=>client},
  ReserveStorage:{createStore:()=>{const listeners=new Set(),store={destroyed:false,updates:0,load:async()=>{},get:()=>structuredClone(data),readCache:async()=>snapshot?structuredClone(cache):null,subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},
   update:async change=>{store.updates++;const next=structuredClone(data);change(next);data=next;for(const fn of listeners)fn(structuredClone(data));return structuredClone(data);},destroy(){store.destroyed=true;listeners.clear();}};stores.push(store);return store;}},
  ReserveUI:{escapeHTML:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),safeRichHTML:html=>String(html).replace(/<(img|iframe|form|input|button|script)\b[\s\S]*?(?:>|$)/gi,'')}});
 env.window=env;env.top=env;env.globalThis=env;
 const run=file=>vm.runInContext(read(file),env,{filename:file});
 for(const file of ['site.js','features.js','core.js','icons.js','quick-open.js','native-tools.js','page-switch.js','multitask.js'])run(file);
 const fire=type=>{for(const [t,fn] of doc.listeners.filter(l=>l[0]===type))fn();doc.listeners=doc.listeners.filter(l=>!(l[0]===type&&l[2]?.once));};
 const ready=async()=>{await tick();doc.readyState='interactive';fire('DOMContentLoaded');await tick();};
 const runFrames=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn();}};
 const runTimers=async(ms=Infinity)=>{for(const [id,t] of [...timers])if(t.ms<=ms){if(!t.repeat)timers.delete(id);t.fn();}await tick();};
 const ours=()=>doc.documentElement.descendants().filter(n=>['reserve-multitask','reserve-beside'].includes(n.localName)||n.dataset.reserveBeside!==undefined);
 const chips=()=>doc.documentElement.descendants().find(n=>n.localName==='reserve-multitask');
 const column=()=>doc.documentElement.descendants().find(n=>n.localName==='reserve-beside');
 const myWindowListeners=()=>win.listeners.filter(([type])=>type!=='storage');// (the page switch listens for 'storage' itself)
 return {env,doc,local,win,timers,frames,requests,stores,crumbs,wrapper,content,buttons,canvasFirst,fire,ready,runFrames,runTimers,ours,chips,column,myWindowListeners,data:()=>data,M:()=>env.ReserveMultitask,
  switchOff:async(value=true)=>{env.ReserveSite.setPageOff(value);env.ReserveFeatures.refresh();await tick();}};
}

test('switched off on the page: nothing of it at all, not a node, listener, timer, storage read or request; the switch alone',async()=>{
 const p=page({off:true});await p.ready();p.runFrames();await p.runTimers();
 assert.deepEqual(p.ours(),[],'no chip, no column, no style');
 assert.equal(p.M().life,null);
 assert.equal(p.myWindowListeners().length,0);assert.equal(p.doc.listeners.length,0,'no wait left behind');assert.equal(p.timers.size,0);assert.equal(p.frames.size,0);
 assert.deepEqual(p.requests,[]);assert.ok(!p.local.log.some(([,key])=>key===M.KEY),'its saved place is not even read');
 assert.ok(p.crumbs.children.some(n=>n.localName==='reserve-page-switch'),'the switch is there, to turn it back on');
});

test('on, nothing open: two chips before the page switch, and nothing else (no listener, timer, request or style)',async()=>{
 const p=page();await p.ready();
 const names=p.crumbs.children.map(n=>n.localName);assert.deepEqual(names,['reserve-multitask','reserve-page-switch'],'Open beside and Tools, then the switch');
 const shadow=p.chips().shadowRoot;assert.match(shadow.innerHTML,/Open beside/);assert.match(shadow.innerHTML,/>Tools</);
 assert.doesNotMatch(shadow.innerHTML,/<p\b|description/i,'a drawing and a name each, no standing description');
 assert.equal(p.myWindowListeners().length,0);assert.equal(p.timers.size,0);assert.deepEqual(p.requests,[]);assert.equal(p.doc.head.children.length,0);
 assert.equal(p.doc.body.firstChild,p.canvasFirst,'nothing put in Canvas\'s page');
});

test('Open beside: the column takes its room, the finder lists this course, a pick reads that assignment; reload keeps its place',async()=>{
 const p=page();await p.ready();
 p.chips().shadowRoot.press('open-beside');await p.runTimers(100);p.runFrames();await p.runTimers(100);
 const col=p.column();assert.ok(col,'the column');assert.equal(p.doc.body.firstChild,col,'first child of body: Canvas paints above it');
 assert.match(col.style.cssText,/^position:fixed;z-index:0;margin:0;top:0;right:0;bottom:0px;width:538px/);
 const style=p.doc.head.children.find(n=>n.dataset.reserveBeside!==undefined);assert.equal(style.textContent,'body{box-sizing:border-box!important;padding-right:calc(0px + 538px)!important}');
 assert.deepEqual(p.requests,['profile'],'one request to the student\'s own Canvas; the list came from the saved dashboard');
 const rows=col.shadowRoot.querySelector('[data-mt-rows]').innerHTML;assert.match(rows,/data-key="101\/10101"/);assert.doesNotMatch(rows,/data-key="101\/10100"/,'not itself');
 assert.deepEqual(JSON.parse(p.local.data.get(M.KEY))['101/10100'].t,'beside');
 col.shadowRoot.press('choose',{key:'101/10101',name:'Equilibrium worksheet'});await p.runTimers(100);
 assert.deepEqual(p.requests,['profile','assignment 101/10101']);
 const body=col.shadowRoot.querySelector('[data-mt-body]').innerHTML;assert.match(body,/Equilibrium worksheet/);assert.match(body,/Balance each equation/);assert.match(body,/Grading rubric/);
 assert.doesNotMatch(body,/<form|<input|type="submit"|type="file"/i,'nothing to hand in from here');
 const saved=JSON.parse(p.local.data.get(M.KEY))['101/10100'];assert.equal(saved.b,'101/10101');assert.equal(saved.n,'Equilibrium worksheet');assert.equal(saved.l,84);
 // the divider by keyboard, swap and the chip state
 p.chips().shadowRoot.press('open-beside');// pressed again: closes
 assert.equal(p.column(),undefined);assert.equal(p.doc.head.children.length,0);assert.equal(p.myWindowListeners().length,0);assert.equal(p.timers.size,0);
 assert.equal(p.local.data.has(M.KEY),false,'closed: nothing kept');
 // a reload with it open: the room is taken before the first paint, the column comes back on the same assignment
 const q=page({saved:{'101/10100':{t:'beside',b:'101/10101',n:'Equilibrium worksheet',r:.5,s:1,y:120,l:84,at:1}}});
 await tick();assert.match(q.doc.head.children[0]?.textContent||'',/padding-left:calc\(0px \+ 641px\)/,'swapped, at its share, before the page is drawn');
 assert.ok(q.column(),'the column is back');assert.match(q.column().style.cssText,/left:84px;bottom:0px;width:641px/);
 assert.equal(q.column().shadowRoot.querySelector('.col').style.animation,'none','no entrance on a reload');
 await q.ready();await q.runTimers(100);assert.match(q.column().shadowRoot.querySelector('[data-mt-body]').innerHTML,/Equilibrium worksheet/);
 assert.equal(q.column().shadowRoot.querySelector('[data-mt-body]').scrollTop,120,'its reading place');
});

test('switched off with the column open: every node, style, listener, timer and the store go at once; back on, it returns',async()=>{
 const p=page({saved:{'101/10100':{t:'beside',b:'101/10101',n:'Equilibrium worksheet',r:.42,s:0,at:1}}});await p.ready();await p.runTimers(100);p.runFrames();
 assert.ok(p.column());assert.ok(p.chips());assert.ok(p.myWindowListeners().length>=3);assert.ok(p.timers.size>=1);
 const store=p.stores[0];
 await p.switchOff(true);
 assert.deepEqual(p.ours(),[],'no chip, column or style');assert.equal(p.doc.body.firstChild,p.canvasFirst);
 assert.equal(p.myWindowListeners().length,0);assert.equal(p.doc.listeners.length,0);assert.equal(p.timers.size,0);assert.equal(p.frames.size,0);
 assert.equal(store.destroyed,true,'the account store let go');assert.equal(p.M().life,null);
 const before=p.requests.length;await p.runTimers();p.runFrames();assert.equal(p.requests.length,before,'nothing asked afterwards');
 assert.ok(p.local.data.has(M.KEY),'its place is kept for when it is on again');
 await p.switchOff(false);await p.runTimers(100);p.runFrames();
 assert.ok(p.chips()&&p.column(),'back at once, where it was');assert.equal(p.doc.body.firstChild,p.column());
});

test('Tools: the Home timer and notes, closed until pressed; a typed note saves to the Home scratchpad; off stops the clock',async()=>{
 const p=page();await p.ready();
 assert.deepEqual(p.requests,[]);
 p.chips().shadowRoot.press('open-tools');await p.runTimers(100);
 const col=p.column(),r=col.shadowRoot;assert.match(r.querySelector('[data-mt-body]').innerHTML,/Focus timer/);assert.match(r.querySelector('[data-mt-body]').innerHTML,/Notes/);
 assert.equal(r.querySelector('[data-mt="notes"]').value,'old note');
 r.press('timer-start');await tick();assert.ok(p.data().focus.endsAt>Date.now(),'started, in the account\'s own record (Home sees it)');
 assert.ok([...p.timers.values()].some(t=>t.repeat&&t.ms===1000),'the clock ticks while it runs');
 r.fire('input',{composedPath:()=>[{dataset:{mt:'notes'},value:'formula: PV=nRT'}]});
 assert.equal(p.data().toolbox.scratchpad,'old note','saved after a pause, not on every key');
 await p.runTimers(700);assert.equal(p.data().toolbox.scratchpad,'formula: PV=nRT');
 r.fire('input',{composedPath:()=>[{dataset:{mt:'notes'},value:'formula: PV=nRT, R=8.314'}]});
 await p.switchOff(true);await tick();
 assert.equal(p.data().toolbox.scratchpad,'formula: PV=nRT, R=8.314','switched off mid-sentence: the note is kept');
 assert.equal(p.timers.size,0,'the clock stopped with it');assert.deepEqual(p.ours(),[]);
 assert.ok(p.requests.every(x=>typeof x==='string'),'no fetch of its own');
});

test('Canvas\'s Submit under the column: a fixed bar pushes the column up; otherwise it moves, then closes and says why',async()=>{
 const p=page();await p.ready();
 p.chips().shadowRoot.press('open-beside');await p.runTimers(100);
 const col=p.column();col.rect={left:828,right:1366,top:0,bottom:768,width:538,height:768};
 // a footer of Canvas's fixed along the bottom, its Submit at the right: the column ends above it
 const footer=new El('div',p.doc);footer.fixed=true;footer.rect={left:84,right:1366,top:704,bottom:768,width:1282,height:64};
 const submit=new El('button',p.doc);submit.textContent='Submit Assignment';submit.rect={left:1180,right:1340,top:716,bottom:752,width:160,height:36};footer.append(submit);p.doc.body.append(footer);p.buttons.push(submit);
 p.doc.topAt=()=>submit;p.runFrames();
 assert.match(col.style.cssText,/bottom:68px/,'above the bar');assert.ok(p.column(),'still open');
 // something in the page's flow under the column that the column paints over: it moves to the other side, then closes
 footer.remove();p.buttons.length=0;const inflow=new El('button',p.doc);inflow.textContent='Submit Assignment';inflow.rect={left:900,right:1000,top:300,bottom:336,width:100,height:36};p.doc.body.append(inflow);p.buttons.push(inflow);
 p.doc.topAt=()=>p.column();await p.runTimers(1500);
 assert.equal(p.column(),undefined,'closed: it would have covered Submit on either side');
 assert.match(p.chips().shadowRoot.querySelector('.note').textContent,/Submit was under it/);
 assert.equal(p.doc.head.children.length,0);
});

test('at narrow widths it stacks: a block in the page\'s own flow above Canvas\'s page, nothing of Canvas\'s under it, no Swap',async()=>{
 const p=page();p.env.innerWidth=860;p.env.innerHeight=700;await p.ready();
 p.chips().shadowRoot.press('open-beside');await p.runTimers(100);
 assert.match(p.column().style.cssText,/^position:relative;z-index:0;display:block;margin:0 0 0 84px;height:\d+px$/);
 assert.equal(p.doc.body.firstChild,p.column(),'above Canvas\'s page');assert.equal(p.doc.head.children.length,0,'no room taken from the page: it has its own in the flow');
 assert.equal(p.column().shadowRoot.querySelector('.col').querySelector('[data-mt="swap"]').hidden,true,'no other side to swap to');
 assert.equal(p.column().shadowRoot.querySelector('.col').dataset.mode,'stack');
});

test('"On Canvas" off, or Quick open & study tools off: nothing of it either; with the Planner off there is no Tools chip',async()=>{
 for(const options of [{extra:[['reserve:off','1']],stored:{'reserve:enabled':false}},{prefs:{preset:'custom',custom:['dashboard','pdf']},hint:JSON.stringify({preset:'custom',enabled:['dashboard','pdf']})}]){
  const p=page(options);await p.ready();p.runFrames();await p.runTimers();
  assert.deepEqual(p.ours(),[],JSON.stringify(options));assert.equal(p.M().life,null);assert.equal(p.myWindowListeners().length,0);assert.equal(p.timers.size,0);assert.deepEqual(p.requests,[]);
  assert.ok(!p.local.log.some(([,key])=>key===M.KEY));
 }
 const p=page({prefs:{preset:'custom',custom:['tools']},hint:JSON.stringify({preset:'custom',enabled:['tools']})});await p.ready();
 assert.ok(p.chips(),'Open beside is there');assert.equal(p.chips().shadowRoot.querySelector('[data-mt="open-tools"]').hidden,true,'Tools needs the Home timer and notes (Planner)');
 p.chips().shadowRoot.press('open-tools');await p.runTimers(100);assert.equal(p.column(),undefined,'and cannot be opened');
});

test('the divider by keyboard, a double press back to its first share, Swap, the tabs and Pick another',async()=>{
 const p=page();await p.ready();
 p.chips().shadowRoot.press('open-beside');await p.runTimers(100);
 const r=p.column().shadowRoot,key=k=>r.fire('keydown',{key:k,preventDefault(){},composedPath:()=>[{dataset:{mt:'rule'},getAttribute:()=>'separator'}]});
 const width=()=>Number(/width:(\d+)px/.exec(p.column().style.cssText)[1]);
 const first=width();key('ArrowLeft');assert.equal(width(),first+24,'Left widens the column on the right');key('ArrowRight');key('ArrowRight');assert.equal(width(),first-24);
 key('Home');assert.equal(width(),300,'never under its least');key('End');assert.equal(1366-84-width(),520,'Canvas\'s page never under its least');
 r.fire('dblclick',{composedPath:()=>[{dataset:{mt:'rule'}}]});assert.equal(width(),first,'back to its first share');
 assert.equal(JSON.parse(p.local.data.get(M.KEY))['101/10100'].r,M.RATIO);
 r.press('swap');assert.match(p.column().style.cssText,/top:0;left:84px/);assert.match(p.doc.head.children[0].textContent,/padding-left/);
 key('ArrowRight');assert.equal(width(),first+24,'on the left, Right widens it');
 r.press('swap');assert.match(p.column().style.cssText,/top:0;right:0/);
 r.press('tab-tools');await p.runTimers(100);assert.match(r.querySelector('[data-mt-body]').innerHTML,/Focus timer/);assert.equal(JSON.parse(p.local.data.get(M.KEY))['101/10100'].t,'tools');
 assert.equal(p.chips().shadowRoot.querySelector('[data-mt="open-tools"]').getAttribute('aria-pressed'),'true');
 r.press('tab-beside');await p.runTimers(100);assert.match(r.querySelector('[data-mt-body]').innerHTML,/Search assignments/);
 r.press('choose',{key:'101/10101',name:'Equilibrium worksheet'});await p.runTimers(100);assert.match(r.querySelector('[data-mt-body]').innerHTML,/Pick another/);
 r.press('pick');await p.runTimers(100);assert.match(r.querySelector('[data-mt-body]').innerHTML,/Search assignments/,'the finder again');
 r.press('choose',{key:'101/10100',name:'Itself'});assert.equal(JSON.parse(p.local.data.get(M.KEY))['101/10100'].b,'101/10101','the page itself is never put beside itself');
 r.press('close');assert.equal(p.column(),undefined);assert.equal(p.chips().shadowRoot.querySelector('[data-mt="open-beside"]').getAttribute('aria-pressed'),'false');
});

test('no saved dashboard yet: the finder reads this course\'s own list, once, from Canvas',async()=>{
 const p=page({snapshot:false});await p.ready();
 p.chips().shadowRoot.press('open-beside');await p.runTimers(100);
 assert.deepEqual(p.requests,['profile','list /api/v1/courses/101/assignments?include[]=submission&per_page=100']);
 assert.match(p.column().shadowRoot.querySelector('[data-mt-rows]').innerHTML,/No other assignments here yet/);
});

test('what is typed in its search or notes never reaches Canvas\'s page (its shortcuts, its scripts)',async()=>{
 const p=page();await p.ready();p.chips().shadowRoot.press('open-tools');await p.runTimers(100);
 const r=p.column().shadowRoot;
 for(const [tag,type] of [['TEXTAREA','keydown'],['TEXTAREA','input'],['INPUT','keyup'],['INPUT','paste'],['TEXTAREA','compositionend']]){
  let stopped=0;r.fire(type,{key:'a',composedPath:()=>[{tagName:tag,dataset:{}}],stopPropagation(){stopped++;},preventDefault(){}});assert.equal(stopped,1,tag+' '+type);
 }
 let stopped=0;r.fire('keydown',{key:'a',composedPath:()=>[{tagName:'BUTTON',dataset:{}}],stopPropagation(){stopped++;},preventDefault(){}});assert.equal(stopped,0,'a key on a button of ours goes on as usual');
});

test('a DOMRect (sides as getters) is read as well as a plain box: the bar along the bottom is found on the real page',()=>{
 class Rect{constructor(l,t,w,h){this._={l,t,w,h};}get left(){return this._.l;}get top(){return this._.t;}get width(){return this._.w;}get height(){return this._.h;}get right(){return this._.l+this._.w;}get bottom(){return this._.t+this._.h;}}
 const el={},ours={},r=M.submitGuard({controls:[{el,rect:new Rect(1194,717,148,39)}],pane:new Rect(792,0,574,768),topAt:()=>el,ours,vh:768,barOf:()=>new Rect(84,704,1282,64)});
 assert.equal(r.clear,68,'the column ends above the footer');
});

test('Canvas\'s own page painting over its Submit once narrowed is the column\'s doing: found, unless it was so before or it is a menu',()=>{
 const button={},sidebar={contains:()=>false},menu={contains:()=>false},ours={};
 const controls=[{el:button,rect:{left:300,right:400,top:100,bottom:140,width:100,height:40}}],base={controls,ours,vw:1366,vh:768};
 assert.deepEqual(M.squeezedBy({...base,topAt:()=>sidebar}),[button],'the sidebar of Canvas\'s page runs over it');
 assert.deepEqual(M.squeezedBy({...base,topAt:()=>button}),[]);assert.deepEqual(M.squeezedBy({...base,topAt:()=>ours}),[],'ours on top is the other guard\'s');
 assert.deepEqual(M.squeezedBy({...base,topAt:()=>menu,floating:el=>el===menu}),[],'a menu or dialog of Canvas\'s floats over it by design');
 assert.deepEqual(M.squeezedBy({...base,topAt:()=>sidebar,before:new Set([button])}),[],'already so before the column opened');
 assert.deepEqual(M.squeezedBy({...base,controls:[{el:button,rect:{left:300,right:400,top:900,bottom:940,width:100,height:40}}],topAt:()=>sidebar}),[],'out of the window: not judged');
});

test('narrowed, Canvas paints over its own Start Assignment: the column gives the width back, then stacks above the page',async()=>{
 const p=page();await p.ready();
 const start=new El('a',p.doc);start.textContent='Start Assignment';start.rect={left:300,right:420,top:100,bottom:140,width:120,height:40};p.doc.body.append(start);p.buttons.push(start);
 p.doc.topAt=()=>start;// before it opens: Start Assignment is on top
 p.chips().shadowRoot.press('open-beside');await p.runTimers(100);
 const sidebar=new El('div',p.doc);p.doc.body.append(sidebar);let widths=[];
 p.doc.topAt=()=>{widths.push(Number(/width:(\d+)px/.exec(p.column().style.cssText)?.[1]));return widths.length>3?start:sidebar;};
 p.runFrames();
 assert.ok(widths.length>3);assert.ok(widths[1]<widths[0]&&widths[2]<widths[1],'48 px at a time: '+widths.slice(0,4));
 assert.equal(p.column().shadowRoot.querySelector('.col').dataset.mode,'side','enough given back: still side by side');
 p.doc.topAt=()=>sidebar;await p.runTimers(1500);
 assert.equal(p.column().shadowRoot.querySelector('.col').dataset.mode,'stack','never enough: stacked above the page, full width for Canvas');
 assert.equal(p.doc.head.children.length,0);
});
