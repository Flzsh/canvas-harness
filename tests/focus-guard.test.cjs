'use strict';
// The focus room's distraction guard: the site list, the session record copied out of personal data, what a page on
// a listed site does, how the background adds the reminder only then, and how the switch asks Chrome for access.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const G=require('../extension/focus-guard-model.js'),M=require('../extension/focus-room-model.js');
const {createStore}=require('../extension/storage.js');
const ext=path.join(__dirname,'..','extension'),read=f=>fs.readFileSync(path.join(ext,f),'utf8');
const MIN=60000;
// Values made inside a vm have other prototypes, so compare them as JSON.
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const tick=async(n=30)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
function event(){const listeners=[];return {listeners,addListener:f=>listeners.push(f),removeListener:f=>{const i=listeners.indexOf(f);if(i>=0)listeners.splice(i,1);},emit:(...a)=>listeners.map(f=>f(...a))};}

test('the list takes plain host names from whatever a student types or pastes',()=>{
 for(const [input,host] of [['youtube.com','youtube.com'],['YouTube.COM ','youtube.com'],['https://www.youtube.com/watch?v=1','youtube.com'],['www.reddit.com','reddit.com'],
  ['m.youtube.com','m.youtube.com'],['*.tiktok.com','tiktok.com'],['instagram.com:443','instagram.com'],['http://news.ycombinator.com/item?id=1','news.ycombinator.com'],['bücher.de','xn--bcher-kva.de']])
  assert.equal(G.cleanHost(input),host,input);
 for(const bad of ['','youtube','localhost','10.0.0.5','https://[::1]/','javascript:alert(1)','file:///etc/hosts','ftp://example.com','a b.com','user@site.com','https://u:p@site.com','-bad-.com','x'.repeat(400)+'.com',42,null])
  assert.equal(G.cleanHost(bad),'',String(bad));
 // Canvas itself and the files it serves are never on the list
 for(const canvas of ['school.instructure.com','instructure.com','https://canvas.instructure.com/courses','abc.canvas-user-content.com'])assert.equal(G.cleanHost(canvas),'',canvas);
 const many=Array.from({length:70},(_,i)=>`site${i}.com`);
 assert.equal(G.cleanSites([...many,'youtube.com']).length,50,'at most 50 sites');
 same(G.cleanSites(['youtube.com','https://youtube.com/','www.youtube.com','bad','school.instructure.com']),['youtube.com'],'duplicates and junk are dropped');
});

test('adding a site explains what is wrong, and never takes Canvas or the school’s own Canvas site',()=>{
 assert.deepEqual(G.check('https://www.youtube.com/feed',[]),{host:'youtube.com',problem:''});
 assert.match(G.check('not a site',[]).problem,/such as youtube\.com/);
 assert.match(G.check('school.instructure.com',[]).problem,/never covered/);
 // the school's Canvas on its own address, and a parent domain that would cover it
 for(const v of ['canvas.school.edu','school.edu','https://canvas.school.edu/courses/1'])assert.match(G.check(v,[],['https://canvas.school.edu']).problem,/never covered/,v);
 assert.equal(G.check('library.school.edu',[],['https://canvas.school.edu']).host,'library.school.edu','other school pages may be listed');
 assert.match(G.check('youtube.com',['youtube.com']).problem,/already on the list/);
 assert.match(G.check('new.com',Array.from({length:50},(_,i)=>`s${i}.com`)).problem,/up to 50/);
});

test('the guard is part of the room’s choices: off by default, and kept clean',()=>{
 assert.deepEqual(M.cleanRoom({}).guard,{on:false,sites:[]});
 assert.deepEqual(M.cleanRoom({guard:{on:'yes',sites:'youtube.com'}}).guard,{on:false,sites:[]});
 assert.deepEqual(M.cleanRoom({guard:{on:true,sites:['YouTube.com','x','reddit.com']}}).guard,{on:true,sites:['youtube.com','reddit.com']});
});

test('the record holds only while focusing: not on a break, not paused, not with the guard off',()=>{
 const T=Date.parse('2026-10-19T15:00:00Z'),guard={on:true,sites:['youtube.com']};
 const timer={focusRoom:{guard},focus:{...M.start(M.setMinutes({},50),T),goal:'Problems 1-12'}};
 assert.deepEqual(G.record(timer),{until:T+50*MIN,goal:'Problems 1-12',sites:['youtube.com'],open:false});
 assert.equal(G.record({...timer,focus:M.pause(timer.focus,T+MIN)}).until,0,'paused');
 assert.equal(G.record({...timer,focusRoom:{guard:{...guard,on:false}}}).until,0,'switched off');
 assert.equal(G.record({...timer,focusRoom:{guard:{on:true,sites:[]}}}).until,0,'nothing listed');
 assert.equal(G.record({}).until,0);assert.equal(G.record(null).until,0);
 const brk={focusRoom:{guard},focus:{mode:'pomodoro',phase:'short',minutes:5,endsAt:T+5*MIN}};
 assert.equal(G.record(brk).until,0,'a break is free time');
 assert.equal(G.record({...brk,focus:{...brk.focus,phase:'focus'}}).until,T+5*MIN,'a Pomodoro round is guarded');
 const open={focusRoom:{guard},focus:M.start(M.setMode({},'open',{}),T)};
 assert.deepEqual(G.record(open),{until:T+G.OPEN_MAX,goal:'',sites:['youtube.com'],open:true},'an open session holds until it is stopped, a day at most');
 assert.deepEqual(G.cleanRecord({until:'soon',sites:['youtube.com']}),{until:0,goal:'',sites:[],open:false});
 assert.deepEqual(G.cleanRecord({until:T,goal:'a\u0000b',sites:['YouTube.com','x'],open:1}),{until:T,goal:'a b',sites:['youtube.com'],open:false});
});

test('a page is covered only on a listed site, over https, during the session, and not during a five-minute pass',()=>{
 const now=Date.parse('2026-10-19T15:00:00Z'),rec={until:now+20*MIN,goal:'',sites:['youtube.com','reddit.com'],open:false};
 assert.deepEqual(G.status(rec,'https://www.youtube.com/watch?v=1',{now}),{blocked:true,site:'youtube.com',wake:now+20*MIN});
 assert.equal(G.status(rec,'https://youtube.com/',{now}).blocked,true);
 assert.equal(G.status(rec,'https://old.reddit.com/r/x',{now}).site,'reddit.com');
 for(const url of ['https://notyoutube.com/','https://youtube.com.evil.example/','http://youtube.com/','chrome://newtab','not a url','https://school.instructure.com/courses/1'])
  assert.equal(G.status(rec,url,{now}).blocked,false,url);
 assert.equal(G.status(rec,'https://www.youtube.com/',{now:now+20*MIN}).blocked,false,'ends with the session');
 assert.equal(G.status({...rec,sites:['school.edu']},'https://canvas.school.edu/',{now,protect:['https://canvas.school.edu']}).blocked,false,'never the school’s Canvas');
 const passes=G.snooze({},'youtube.com',now);
 assert.equal(passes['youtube.com'],now+G.SNOOZE_MS);
 assert.deepEqual(G.status(rec,'https://www.youtube.com/',{now:now+MIN,snooze:passes}),{blocked:false,site:'youtube.com',wake:now+G.SNOOZE_MS});
 assert.equal(G.status(rec,'https://www.youtube.com/',{now:now+G.SNOOZE_MS,snooze:passes}).blocked,true,'back after five minutes');
 assert.equal(G.status(rec,'https://www.reddit.com/',{now:now+MIN,snooze:passes}).blocked,true,'a pass is for one site');
 // passes are short-lived and only for real sites
 assert.deepEqual(G.cleanSnooze({'youtube.com':now+MIN,'old.com':now-1,'far.com':now+60*MIN,'Bad Site':now+MIN,'school.instructure.com':now+MIN},now),{'youtube.com':now+MIN});
 same(G.matches(['youtube.com','reddit.com']),['https://*.youtube.com/*','https://*.reddit.com/*']);
});

test('personal data copies the session to its own key when a guarded session starts, pauses or ends, and only then',async()=>{
 const mem=new Map(),writes=[],adapter={read:async k=>structuredClone(mem.get(k)),write:async(k,v)=>{writes.push(k);mem.set(k,structuredClone(v));}};
 const store=createStore({accountId:'7',origin:'https://school.instructure.com',adapter});await store.load();
 const mirrored=()=>writes.filter(k=>k===G.KEY).length;
 await store.update(d=>{d.tasks['1']={notes:'x'};});
 assert.equal(mirrored(),0,'nothing to copy while the guard is off');
 await store.update(d=>{d.focusRoom={guard:{on:true,sites:['youtube.com']}};});
 assert.equal(mirrored(),0,'switching it on with no session running changes nothing outside');
 const t0=Date.now();
 await store.update(d=>{d.focus={...M.start(M.setMinutes(d.focus,25),t0),goal:'Essay intro'};});
 assert.deepEqual(mem.get(G.KEY),{until:t0+25*MIN,goal:'Essay intro',sites:['youtube.com'],open:false});
 await store.update(d=>{d.tasks['2']={notes:'y'};});
 assert.equal(mirrored(),1,'other saves leave it alone');
 await store.update(d=>{d.focusRoom.guard.sites.push('reddit.com');});
 same(mem.get(G.KEY).sites,['youtube.com','reddit.com'],'a site added mid-session counts at once');
 await store.update(d=>{d.focus=M.pause(d.focus,t0+MIN);});
 assert.equal(mem.get(G.KEY).until,0,'paused');
 // another account's tab saving its own things never switches this one off
 await store.update(d=>{d.focus=M.start(d.focus,Date.now());});
 const other=createStore({accountId:'8',origin:'https://school.instructure.com',adapter});await other.load();
 await other.update(d=>{d.tasks['3']={notes:'z'};});
 assert.ok(mem.get(G.KEY).until>Date.now());
 // the list survives a backup
 const restored=require('../extension/storage.js').validateBackup(store.exportBackup(),store.owner);
 assert.deepEqual(restored.focusRoom.guard,{on:true,sites:['youtube.com','reddit.com']});
});

function background({granted=true,schools=[],tabs=[]}={}){
 const store={'reserve:sites':schools},perms=new Set(granted?['https://*/*']:[]),registered=new Map(),injected=[];
 const onChanged=event(),runtime={id:'a'.repeat(32),onConnect:event(),onMessage:event(),onInstalled:event(),onStartup:event(),getURL:f=>'chrome-extension://x/'+f};
 const chrome={runtime,
  storage:{onChanged,local:{get:async k=>Object.fromEntries((Array.isArray(k)?k:[k]).map(x=>[x,structuredClone(store[x])])),
   set:async o=>{const changes={};for(const [k,v] of Object.entries(o)){changes[k]={oldValue:store[k],newValue:v};store[k]=structuredClone(v);}onChanged.emit(changes,'local');},remove:async k=>{delete store[k];}}},
  permissions:{contains:async q=>q.origins.every(o=>perms.has(o)||schools.some(s=>s+'/*'===o)),onAdded:event(),onRemoved:event()},
  scripting:{getRegisteredContentScripts:async()=>[...registered.values()],unregisterContentScripts:async({ids})=>ids.forEach(id=>registered.delete(id)),
   registerContentScripts:async list=>list.forEach(s=>{if(registered.has(s.id))throw Error('Duplicate script id');registered.set(s.id,s);}),executeScript:async d=>{injected.push(d);return [];}},
  tabs:{create:async()=>{},get:async id=>({id,url:'https://school.instructure.com/'}),query:async({url})=>tabs.filter(t=>url.some(p=>{const site=p.slice('https://*.'.length,-2),u=new URL(t.url);return u.protocol==='https:'&&G.covers(site,u.hostname);}))}};
 const fake={chrome,crypto:require('node:crypto').webcrypto,URL,Intl,setTimeout,clearTimeout,AbortSignal,TextEncoder,fetch:async()=>{throw Error('no network');}};
 fake.globalThis=fake;fake.importScripts=(...files)=>{for(const f of files)if(['site.js','focus-guard-model.js'].includes(f))vm.runInNewContext(read(f),fake);};
 vm.runInNewContext(read('background.js'),fake);
 return {store,perms,registered,injected,chrome,set:value=>chrome.storage.local.set({[G.KEY]:value})};
}

test('the background adds the reminder to the listed sites only while a session runs, and never to Canvas',async()=>{
 const h=background({schools:['https://canvas.school.edu'],tabs:[{id:1,url:'https://www.youtube.com/watch?v=1'},{id:2,url:'https://school.instructure.com/'},{id:3,url:'https://example.com/'}]});
 await tick();assert.equal(h.registered.size,0,'nothing at first');
 await h.set({until:Date.now()+20*MIN,goal:'',sites:['youtube.com','school.edu'],open:false});await tick();
 const s=h.registered.get('ch-focus-guard');assert.ok(s);
 same(s.matches,['https://*.youtube.com/*','https://*.school.edu/*']);
 same(s.excludeMatches,['https://*.instructure.com/*','https://canvas.school.edu/*']);
 same(s.js,['site.js','focus-guard-model.js','focus-guard-page.js']);assert.equal(s.runAt,'document_start');assert.equal(s.allFrames,false);assert.equal(s.persistAcrossSessions,false);
 same(h.injected.map(d=>d.target.tabId),[1],'a page already open on a listed site gets it too');
 // a new site mid-session re-registers; the same record again does not inject twice
 await h.set({until:Date.now()+20*MIN,goal:'',sites:['youtube.com'],open:false});await tick();
 same(h.registered.get('ch-focus-guard').matches,['https://*.youtube.com/*']);
 // paused or ended: gone
 await h.set({until:0,goal:'',sites:[],open:false});await tick();
 assert.equal(h.registered.size,0);
 await h.set({until:Date.now()-1,goal:'',sites:['youtube.com'],open:false});await tick();
 assert.equal(h.registered.size,0,'a session that already ended');
});

test('without Chrome’s permission for other websites the background adds nothing, and adds it once allowed',async()=>{
 const h=background({granted:false,tabs:[{id:1,url:'https://www.youtube.com/'}]});
 await h.set({until:Date.now()+20*MIN,goal:'',sites:['youtube.com'],open:false});await tick();
 assert.equal(h.registered.size,0);assert.equal(h.injected.length,0);
 h.perms.add('https://*/*');h.chrome.permissions.onAdded.emit({origins:['https://*/*']});await tick();
 assert.ok(h.registered.has('ch-focus-guard'));same(h.injected.map(d=>d.target.tabId),[1]);
 h.perms.clear();h.chrome.permissions.onRemoved.emit({origins:['https://*/*']});await tick();
 assert.equal(h.registered.size,0,'taking the access away removes it');
});

// A small page for the reminder: just enough DOM for focus-guard-page.js.
function page(url,{record,snooze}={}){
 const store={[G.KEY]:record,[G.SNOOZE_KEY]:snooze},onChanged=event(),timers=[];
 function el(tag){
  const e={tagName:tag.toUpperCase(),children:[],parentNode:null,attrs:{},hidden:false,textContent:'',className:'',id:'',listeners:{},open:false,
   style:{props:{},overflow:'',setProperty(k,v){this.props[k]=v;if(k==='overflow')this.overflow=v;}},
   setAttribute(k,v){this.attrs[k]=v;},append(...kids){for(const k of kids){k.parentNode=this;this.children.push(k);}},
   remove(){const p=this.parentNode;if(p){p.children.splice(p.children.indexOf(p.children.find(x=>x===this)),1);this.parentNode=null;}},
   get isConnected(){let n=this;while(n.parentNode)n=n.parentNode;return n===html;},
   attachShadow(opts){assert.equal(opts.mode,'closed');return this.shadow=el('#shadow');},
   addEventListener(t,f){(this.listeners[t]||=[]).push(f);},focus(){doc.focused=this;},
   showPopover(){this.open=true;},hidePopover(){this.open=false;},matches(){return this.open;}};
  return e;
 }
 const html=el('html'),video={paused:false,pause(){this.paused=true;}};
 const doc={documentElement:html,focused:null,listeners:{},createElement:el,querySelectorAll:()=>[video],addEventListener(t,f){(doc.listeners[t]||=[]).push(f);},removeEventListener(t,f){doc.listeners[t]=(doc.listeners[t]||[]).filter(x=>x!==f);}};
 const win={document:doc,location:new URL(url),addEventListener(){},removeEventListener(){},
  setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimeout(){},
  MutationObserver:class{observe(){}disconnect(){}},
  chrome:{storage:{onChanged,local:{get:async k=>Object.fromEntries((Array.isArray(k)?k:[k]).map(x=>[x,structuredClone(store[x])])),
   set:async o=>{const changes={};for(const [k,v] of Object.entries(o)){changes[k]={newValue:v};store[k]=structuredClone(v);}onChanged.emit(changes,'local');}}}},
  URL,Date,Object,Array,Math,Number,String,JSON,Promise,structuredClone};
 win.top=win;win.globalThis=win;
 for(const f of ['site.js','focus-guard-model.js','focus-guard-page.js'])vm.runInNewContext(read(f),win);
 const shown=()=>html.children.find(c=>c.tagName==='RESERVE-FOCUS-GUARD'&&c.open)||null;
 const texts=()=>{const out=[];const walk=n=>{if(n.textContent&&!n.hidden&&n.tagName!=='STYLE')out.push(n.textContent);(n.children||[]).forEach(walk);};const h=shown();if(h)walk(h.shadow);return out;};
 return {win,doc,html,store,video,timers,shown,texts,set:o=>win.chrome.storage.local.set(o),again:()=>vm.runInNewContext(read('focus-guard-page.js'),win)};
}

test('on a listed site the reminder covers the page, says until when and the goal, and lets the student continue for 5 minutes',async()=>{
 const until=Date.now()+20*MIN,p=page('https://www.youtube.com/watch?v=1',{record:{until,goal:'Finish the lab report',sites:['youtube.com'],open:false}});
 await tick();
 assert.ok(p.shown(),'covered');
 const t=p.texts(),time=new Date(until).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(/\s/g,'\u00a0');
 assert.ok(t.includes(`You’re focusing until ${time}`),t.join(' | '));
 assert.ok(t.includes('“Finish the lab report”'));
 assert.ok(t.includes('Continue anyway for 5 minutes'));
 assert.equal(p.video.paused,true,'its video stops');assert.equal(p.html.style.overflow,'hidden');
 assert.equal(p.doc.focused?.textContent,'Continue anyway for 5 minutes','the button has the keyboard');
 // a second copy (a page open when the session started) does not add a second reminder
 p.again();await tick();assert.equal(p.html.children.filter(c=>c.tagName==='RESERVE-FOCUS-GUARD').length,1);
 // continue anyway
 const button=p.shown().shadow.children[1].children[0].children.find(c=>c.tagName==='BUTTON');
 await button.listeners.click[0]();await tick();
 assert.equal(p.shown(),null,'the page is back');assert.equal(p.html.style.overflow,'');
 assert.ok(p.store[G.SNOOZE_KEY]['youtube.com']>Date.now()+4*MIN);
 assert.ok(p.timers.at(-1).ms<=G.SNOOZE_MS+1000,'and it looks again when the five minutes are up');
});

test('the reminder goes away when the session is paused, and stays away from other sites',async()=>{
 const p=page('https://youtube.com/',{record:{until:Date.now()+20*MIN,goal:'',sites:['youtube.com'],open:true}});
 await tick();assert.ok(p.texts().includes('You’re in an open focus session'));
 await p.set({[G.KEY]:{until:0,goal:'',sites:[],open:false}});await tick();
 assert.equal(p.shown(),null);
 const other=page('https://example.com/',{record:{until:Date.now()+20*MIN,goal:'',sites:['youtube.com'],open:false}});
 await tick();assert.equal(other.shown(),null);
 const canvas=page('https://canvas.school.edu/',{record:{until:Date.now()+20*MIN,goal:'',sites:['school.edu'],open:false}});
 canvas.store['reserve:sites']=['https://canvas.school.edu'];canvas.again();await tick();
 assert.equal(canvas.shown(),null,'never the school’s Canvas');
});

test('the switch asks Chrome only from the student’s click, for other websites, and never at install',()=>{
 const manifest=JSON.parse(read('manifest.json'));
 assert.ok(!manifest.host_permissions.includes('https://*/*'),'not granted at install');
 assert.ok(manifest.optional_host_permissions.includes('https://*/*'));assert.deepEqual(manifest.optional_permissions,['scripting']);
 assert.ok(!manifest.content_scripts.some(c=>c.matches.includes('https://*/*')||c.js.includes('focus-guard-page.js')),'the reminder is never a fixed content script');
 const main=manifest.content_scripts.find(c=>c.js.includes('dashboard.js')).js;
 assert.ok(main.indexOf('focus-room-model.js')<main.indexOf('focus-guard-model.js')&&main.indexOf('focus-guard-model.js')<main.indexOf('storage.js'));
 for(const w of manifest.web_accessible_resources)assert.ok(w.resources.includes('focus-guard.html'));
 assert.ok(!manifest.web_accessible_resources.some(w=>w.resources.includes('focus-guard-page.js')));
 const frame=read('focus-guard-frame.js'),html=read('focus-guard.html');
 assert.doesNotMatch(html,/<script>(?!<\/script>)|\son[a-z]+="/,'no inline script (extension CSP)');
 assert.match(html,/<script src="site\.js"><\/script>\s*<script src="focus-guard-frame\.js"><\/script>/);
 // the request is the first thing the click does, with nothing awaited before it
 assert.match(frame,/box\.addEventListener\('click',\(\)=>\{\n  if\(!box\.checked\)\{[^\n]*\}\n  if\(!perms\?\.request\)\{[^\n]*\}\n  \/\/ [^\n]*\n  perms\.request\(ALL_SITES\)/);
 assert.match(frame,/const ALL_SITES=\{permissions:\['scripting'\],origins:\['https:\/\/\*\/\*'\]\};/);
 assert.match(frame,/if\(event\.source!==window\.parent\|\|!allowed\(event\.origin\)\)return;/);
 assert.match(frame,/window\.parent\.postMessage\(\{type:'reserve-focus-guard',\.\.\.message\},parentOrigin\)/);
 const room=read('focus-room.js');
 assert.match(room,/if\(event\.origin!==new URL\(f\.src\)\.origin\)return true;/,'the room hears only its own switch');
 assert.match(room,/G\(\)\.check\(input\.value,r\.guard\.sites,\[win\.location\.origin\]\)/,'the Canvas site in use is never listed');
 const page=read('focus-guard-page.js');
 assert.match(page,/attachShadow\(\{mode:'closed'\}\)/);assert.doesNotMatch(page,/innerHTML|fetch\(|XMLHttpRequest|sendBeacon|sendMessage/,'nothing from the page is read or sent');
 const preview=fs.readFileSync(path.join(__dirname,'..','preview','index.html'),'utf8');
 assert.match(preview,/focus-room-model\.js"><\/script><script src="\.\.\/extension\/focus-guard-model\.js"><\/script><script src="\.\.\/extension\/storage\.js"/);
});
