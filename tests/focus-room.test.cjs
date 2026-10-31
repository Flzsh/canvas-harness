// Adapted from Gary Wu's pull request #43 to Canvas Harness.
// The Focus room: one focus session, two modes (the Home module and the full-screen room), driven by the planner's record.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createDOM}=require('./addons-fixture.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(setImmediate);};
const TASK={title:'Equilibrium worksheet',course:'Chemistry',due:'Fri 11:59 PM',color:'#9CCB8E'};
const running=(left,minutes=25,sessions=2)=>({minutes,remaining:minutes*60,elapsed:0,endsAt:Date.now()+left*1000,sessions});

function fixture({on=true,quiz=false,reject=false,reduce=false,motion='gentle',theme='light',kit='',market='',kitBg='#1F4F8F',focus=running(600),pony=true}={}){
 const document=createDOM(`<html><body><div class="rd" data-theme="${theme}" data-motion-style="${motion}"${kit?` data-theme-kit="${kit}"`:''}${market?` data-rd-data-theme="${market}"`:''}><main class="rd-shell"><section class="rd-widget"><header class="rd-widget-head"><h2>Focus</h2><button type="button" data-rd-action="room-open">Room ↗</button></header><div class="rd-widget-body" id="body"></div></section></main><div class="tk-starframes"></div></div></body></html>`);
 const Element=document.createElement('div').constructor;Object.defineProperty(Element.prototype,'ownerDocument',{configurable:true,get:()=>document});
 const docEvents={};document.fullscreenElement=null;document.visibilityState='visible';
 const addDoc=document.addEventListener,removeDoc=document.removeEventListener;
 document.addEventListener=(type,fn,o)=>{docEvents[type]=fn;addDoc(type,fn,o);};document.removeEventListener=(type,fn)=>{if(docEvents[type]===fn)delete docEvents[type];removeDoc(type,fn);};
 document.exitFullscreen=async()=>{document.fullscreenElement=null;docEvents.fullscreenchange?.();};
 const container=document.querySelector('.rd'),shell=document.querySelector('.rd-shell'),stars=document.querySelector('.tk-starframes');shell.inert=false;
 container.requestFullscreen=async()=>{if(reject)throw Error('Denied');document.fullscreenElement=container;docEvents.fullscreenchange?.();};
 const animations=[],winEvents={},data={focus};
 const env=vm.createContext({console,Date,Math,JSON,Promise,Map,Set,Array,Object,String,Number,
  ReserveFeatures:{enabled:id=>id==='pony'?pony:on},ReserveCore:require('../extension/core.js'),location:{pathname:quiz?'/courses/7/quizzes/8/take':'/'},
  matchMedia:q=>({matches:reduce&&/reduce/.test(q)}),innerWidth:1440,innerHeight:900,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms||0,5)),clearTimeout,setInterval:()=>0,clearInterval(){},
  addEventListener:(t,fn)=>winEvents[t]=fn,removeEventListener:t=>delete winEvents[t],getComputedStyle:()=>({getPropertyValue:()=>kit||market?kitBg:''})});
 env.globalThis=env;
 vm.runInContext(read('focus-room-art.js'),env,{filename:'focus-room-art.js'});vm.runInContext(read('focus-room.js'),env,{filename:'focus-room.js'});
 const orig=Element.prototype.animate;Element.prototype.animate=function(frames,options){animations.push({node:this,frames,options});return orig.call(this,frames,options);};
 const F=env.ReserveFocusRoom;F.prefs.place='lake';
 const store={owner:{accountId:'7'},get:()=>structuredClone(data)};
 const room=F.create({container,store,task:()=>TASK});
 const body=document.getElementById('body');
 const renderModule=(size='m')=>{body.innerHTML=F.module({focus:data.focus,now:Date.now(),task:TASK,size});return body.querySelector('[data-fr-mod]');};
 return {F,room,document,container,shell,stars,data,animations,body,renderModule,env,docEvents,Element,
  get panel(){return container.querySelector('.fr-room');},
  text:(scope,sel)=>scope.querySelector(sel)?.textContent,
  done:()=>{Element.prototype.animate=orig;room.destroy();}};
}

test('both modes render: the Home module (seal, +5, Finish, the task tag, the time, the light arc) and the drawn room',async()=>{
 const f=fixture();
 for(const size of ['s','m','l']){
  const mod=f.renderModule(size);
  assert.equal(mod.getAttribute('data-size'),size);
  assert.match(f.text(mod,'[data-fr-time]'),/^(09:5\d|10:00)$/);
  assert.equal(f.text(mod,'[data-fr-seal] [data-fr-seal-label]'),'Pause');
  assert.equal(mod.querySelector('[data-fr-plus]').hidden,false);assert.equal(mod.querySelector('[data-fr-finish]').hidden,false);
  assert.equal(mod.querySelector('[data-fr-finish]').getAttribute('data-focus-action'),'finish');
  assert.ok(mod.querySelector('.fr-mod-arc .fr-arc-line'),'the light arc');assert.ok(mod.querySelector('[data-fr-mod-sun]'),'the sun on the arc');
  assert.equal(f.text(mod,'[data-fr-task-title]'),'Equilibrium worksheet');assert.match(f.text(mod,'[data-fr-task-meta]'),/Chemistry · due Fri 11:59 PM/);
  assert.ok(mod.querySelector('.fr-mod-place[data-rd-action="room-open"][aria-label="Focus room"]'),'the place card opens the room');
  assert.equal(mod.querySelector('[data-fr-seal]').getAttribute('aria-label'),'Pause','the seal is named by what it does now');
  assert.doesNotMatch(mod.innerHTML,/<video|<iframe|<audio|<canvas|gradient|<filter/i);
 }
 f.renderModule('m');
 assert.equal(await f.room.open(f.container.querySelector('.rd-widget-head [data-rd-action="room-open"]')),true);
 const p=f.panel;assert.ok(p);assert.equal(p.getAttribute('role'),'dialog');assert.equal(p.getAttribute('aria-label'),'Focus room');
 for(const layer of ['fr-skyl','fr-far','fr-mid','fr-near','fr-front'])assert.ok(p.querySelector('.'+layer),'stage layer '+layer);
 for(const life of ['.fr-heron','.fr-lantern','.fr-biscuit','.fr-smoke','.fr-shimmer','.fr-cloud','.fr-sun'])assert.ok(p.querySelector(life),'lake life '+life);
 assert.equal(p.getAttribute('data-place'),'lake');assert.equal(p.getAttribute('data-night'),'false');assert.equal(p.getAttribute('data-pony'),'true');
 assert.equal(f.text(p,'.fr-time'),f.text(f.body,'[data-fr-time]'));assert.equal(f.text(p,'[data-fr-seal-label]'),'Pause');
 assert.ok(p.querySelector('[data-rd-action="room-close"][aria-label="Close"]'));assert.equal(f.text(p,'[data-fr-task-title]'),'Equilibrium worksheet');
 assert.equal(p.querySelectorAll('.fr-card').length,5);assert.ok(p.querySelector('.fr-knob[role="slider"][aria-label="Volume"]'));
 for(const id of f.F.PLACES)assert.match(p.querySelector(`.fr-card[data-place="${id}"]`).textContent,new RegExp(f.F.NAMES[id]),'a place card for every place, named by it');assert.ok(p.querySelector('[data-fr-act="quiet"][aria-pressed="false"]'));
 assert.doesNotMatch(p.innerHTML,/<video|<iframe|<audio|<canvas|<img|Gradient|<filter/);
 assert.equal(f.shell.style.opacity,'0','the dashboard is see-through under the room: it keeps its layout and stays painted');assert.equal(f.shell.style.visibility,undefined,'never hidden by visibility (bringing it back repainted the whole page)');assert.notEqual(f.shell.hidden,true);assert.equal(f.shell.getAttribute('aria-hidden'),'true','hidden from assistive technology');assert.equal(f.shell.inert,false,'never inert: inert restyles every element under it, on the way in and in the fold');assert.ok(!f.shell.style['pointer-events'],'nothing inherited is set on it');assert.equal(f.stars.hidden,false,'the scene theme sky stays');
 f.done();
});

test('the module grows into the room and folds back with the same session: one record, no writes, no timer of its own',async()=>{
 const f=fixture({focus:running(600)}),before=structuredClone(f.data.focus);
 const mod=f.renderModule('m');const t0=f.text(mod,'[data-fr-time]');
 await f.room.open(f.container.querySelector('.rd-widget-head [data-rd-action="room-open"]'));
 assert.equal(f.text(f.panel,'.fr-time'),t0,'the room shows the module\'s time');
 // the session runs on while the room is open: both modes read the same record
 f.data.focus={...f.data.focus,endsAt:f.data.focus.endsAt-120000};f.room.sync();
 assert.match(f.text(f.panel,'.fr-time'),/^0[78]:\d\d$/);assert.equal(f.text(f.panel,'.fr-time'),f.text(f.body,'[data-fr-time]'));
 // the sun stands at the same point of the light arc in both
 const shade=f.panel.querySelector('.fr-am');assert.ok(Number(shade.style['--fr-p'])>.5,'the light has moved on');assert.equal(f.panel.style['--fr-p'],undefined,'written on the shadow layers, never on the room');
 const sun=f.body.querySelector('[data-fr-mod-sun]').getAttribute('style');assert.match(sun,/translate\(/);
 // pausing in the module shows in the room (the planner answers the seal; the room only reads)
 f.data.focus={...f.data.focus,endsAt:null,remaining:420,elapsed:1080,pausedAt:Date.now()};f.room.sync();
 assert.equal(f.text(f.panel,'[data-fr-seal-label]'),'Resume');assert.equal(f.text(f.body,'[data-fr-seal-label]'),'Resume');assert.equal(f.panel.getAttribute('data-mode'),'paused');
 await f.room.close();assert.equal(f.panel,null);assert.equal(f.text(f.body,'[data-fr-time]'),'07:00','the module keeps the paused session');
 assert.equal(f.data.focus.remaining,420);assert.equal(before.sessions,f.data.focus.sessions);
 // the buttons are the planner's own actions: the room never writes the record itself
 const actions=new Set([...f.body.querySelectorAll('[data-rd-action]')].map(n=>n.getAttribute('data-rd-action')));
 for(const a of actions)assert.ok(['timer-toggle','focus-control','focus-back','focus-break','timer-minutes','room-open'].includes(a),a);
 f.done();
});

test('keyboard focus returns to "Room" on the module when the room closes (Esc, the close button, leaving full screen)',async()=>{
 const f=fixture();f.renderModule('m');const opener=f.container.querySelector('.rd-widget-head [data-rd-action="room-open"]');
 opener.focus();await f.room.open(opener);
 assert.equal(f.document.activeElement?.getAttribute('data-fr-seal'),'','the seal takes focus in the room');
 let prevented=false;assert.equal(f.room.keydown({key:'Escape',target:f.document.activeElement,preventDefault(){prevented=true;}}),true);assert.equal(prevented,true);
 await settle();assert.equal(f.room.isOpen(),false);assert.equal(f.document.activeElement,opener);
 // the module may have been redrawn while the room was open: focus finds the new "Room" button
 await f.room.open(opener);f.body.innerHTML='';f.renderModule('l');
 assert.equal(f.room.click({target:f.panel.querySelector('[data-rd-action="room-close"]')}),true);await settle();
 assert.equal(f.document.activeElement,f.container.querySelector('.rd-widget-head [data-rd-action="room-open"]'));
 await f.room.open(opener);await f.document.exitFullscreen();await settle();assert.equal(f.room.isOpen(),false);assert.equal(f.document.activeElement,opener);
 assert.equal(f.shell.style.visibility,undefined);assert.ok(!f.shell.style.opacity,'the dashboard is opaque again');assert.equal(f.shell.inert,false);assert.equal(f.shell.getAttribute('aria-hidden'),null,'and heard again');f.done();
});

// Leaving full screen lays the whole page out again: it comes first, and the fold waits for it, so the browser's relayout
// never lands inside the fold. The key still answers at once: the close mark goes down while the fold waits.
test('closing from full screen leaves full screen first and folds once the page is laid out again; the close mark answers at once',async()=>{
 const f=fixture();f.renderModule('m');const opener=f.container.querySelector('.rd-widget-head [data-rd-action="room-open"]');
 await f.room.open(opener);await settle();assert.equal(f.document.fullscreenElement,f.container,'the room is full screen');
 // the browser answers the request to leave full screen a while later
 let exits=0;f.document.exitFullscreen=()=>{exits++;return new Promise(()=>{});};
 const before=f.animations.length,moved=()=>f.animations.slice(before),panel=f.panel,folds=()=>moved().some(a=>a.node===panel||a.node.classList?.contains('fr-sheet'));
 assert.equal(f.room.keydown({key:'Escape',target:f.document.activeElement,preventDefault(){}}),true);await Promise.resolve();await Promise.resolve();
 assert.equal(exits,1,'full screen is left first');
 assert.ok(moved().some(a=>a.node.closest?.('.fr-close')),'the close mark goes down at once');
 assert.ok(!folds(),'nothing folds while full screen is being left');
 assert.ok(f.panel,'the room still covers everything');assert.equal(f.shell.getAttribute('aria-hidden'),'true','Home is still hidden under it');
 f.document.fullscreenElement=null;f.docEvents.fullscreenchange?.();await settle();
 assert.ok(folds(),'the fold plays once full screen is left');
 await settle();assert.equal(f.room.isOpen(),false);assert.equal(f.document.activeElement,opener);f.done();
});

test('focus returns to whichever control opened the room (the toolbar or Tools), and the task comes from the planner',async()=>{
 const f=fixture();f.renderModule('m');const tool=f.document.createElement('button');tool.setAttribute('data-rd-action','room-open');f.container.querySelector('main').append(tool);
 tool.focus();await f.room.open(tool);f.room.keydown({key:'Escape',target:f.panel,preventDefault(){}});await settle();assert.equal(f.document.activeElement,tool);
 const now=Date.parse('2026-10-28T12:00:00Z'),entries=[{id:'1',title:'Old lab',dueAt:'2026-10-20T12:00:00Z',courseId:'7',course:'Chemistry',done:true},{id:'2',title:'Gas laws',dueAt:'2026-10-30T12:00:00Z',courseId:'7',course:'Chemistry',color:'#5B8BD9'},{id:'3',title:'Essay',dueAt:'2026-11-02T12:00:00Z',courseId:'9'}];
 const next=f.F.pickTask({},entries,[],v=>'Fri',now);assert.deepEqual({...next},{title:'Gas laws',course:'Chemistry',due:'Fri',color:'#5B8BD9'});
 assert.equal(f.F.pickTask({itemId:'3'},entries,[{id:'9',shortName:'English'}],null,now).course,'English','the item the session is for wins');
 assert.equal(f.F.pickTask({},[],[],null,now),null);f.done();
});

test('reduced motion, Still and Motion off: nothing moves, and the end shows its rest at once',async()=>{
 for(const options of [{reduce:true},{motion:'off'}]){
  const f=fixture(options);f.renderModule();await f.room.open();
  assert.equal(f.panel.getAttribute('data-motion'),'off');
  assert.equal(f.animations.length,0,'no animation runs on open');
  f.data.focus={minutes:25,remaining:0,elapsed:1500,endsAt:null,sessions:3,completedAt:Date.now(),completedMinutes:25};f.room.sync();
  assert.equal(f.panel.getAttribute('data-fr-after'),'end');assert.equal(f.panel.hasAttribute('data-fr-moment'),false);
  assert.equal(f.text(f.panel,'.fr-time'),'00:00');assert.equal(f.text(f.panel,'[data-fr-seal-label]'),'Again');
  assert.equal(f.animations.length,0,'no animation for the end either');
  await f.room.close();f.done();
 }
 const still=fixture({motion:'still'});await still.room.open();assert.equal(still.panel.getAttribute('data-motion'),'still');
 still.room.click({target:still.panel.querySelector('[data-fr-seal]')});assert.equal(still.animations.filter(a=>a.node.classList.contains('fr-seal-art')).length,0,'Still: the seal does not bounce');still.done();
 const css=read('focus-room.css');
 assert.match(css,/@media \(prefers-reduced-motion:reduce\) \{ \.fr-room \*,\.fr-mod \* \{ animation:none!important;transition:none!important; \} \}/);
 assert.match(css,/\.fr-room:not\(\[data-motion="gentle"\]\) \*/);
 assert.match(css,/\.fr-room\[data-hidden="true"\] \* \{ animation-play-state:paused!important; \}/,'hidden pages pause everything');
 assert.doesNotMatch(css,/gradient|filter:|drop-shadow|blur\(|box-shadow/i,'house style: flat washes, no gradients, glows or filters');
});

test('Gentle motion: the end acts once (Biscuit, the lantern, the place\'s life, the seal) and then rests',async()=>{
 const f=fixture({motion:'gentle'});f.renderModule();await f.room.open();f.animations.length=0;
 f.data.focus={minutes:25,remaining:0,elapsed:1500,endsAt:null,sessions:3,completedAt:Date.now(),completedMinutes:25};f.room.sync();
 assert.equal(f.panel.getAttribute('data-fr-moment'),'end');
 const css=read('focus-room.css');
 for(const life of ['fr-b-cheer','fr-heron-fly','fr-kf-dive','fr-frog-hop','fr-owl-turn','fr-lightup','fr-jet'])assert.match(css,new RegExp('@keyframes '+life+' '),life);
 await new Promise(r=>setTimeout(r,30));assert.ok(f.animations.some(a=>a.node.classList.contains('fr-seal-art')),'the seal presses itself');
 // starting again wakes the place back up
 f.data.focus=running(1500,25,3);f.room.sync();assert.equal(f.panel.getAttribute('data-fr-moment'),'wake-start');assert.equal(f.panel.hasAttribute('data-fr-after'),false);
 f.done();
});

test('Open counts up, breaks offer "Back to it", and +5 shows only where it means something',()=>{
 const f=fixture(),V=f.F.view,now=Date.now();
 const open=V({minutes:180,remaining:10800,elapsed:0,endsAt:now+10800000-754000,sessions:0},now);
 assert.equal(open.open,true);assert.equal(open.time,'12:34');assert.equal(open.label,'Open');assert.equal(open.plus,false);assert.equal(open.adjust,true);
 const brk=V({minutes:5,remaining:300,elapsed:0,endsAt:now+200000,phase:'break',sessions:1},now);
 assert.equal(brk.mode,'break');assert.equal(brk.seal,'Back to it');assert.equal(brk.sealAction,'focus-back');assert.equal(brk.plus,false);assert.equal(brk.adjust,false);
 const done=V({minutes:25,remaining:0,elapsed:1500,endsAt:null,sessions:3,completedAt:now-1000,completedMinutes:25},now);
 assert.equal(done.mode,'done');assert.equal(done.offerBreak,true);assert.equal(done.lengths,true);assert.equal(done.seal,'Again');
 const ready=V({minutes:50,remaining:3000,endsAt:null,sessions:0},now);assert.equal(ready.mode,'ready');assert.equal(ready.time,'50:00');assert.equal(ready.pressed,'50');
 const mod=f.body;mod.innerHTML=f.F.module({focus:{minutes:5,remaining:300,elapsed:0,endsAt:now+200000,phase:'break',sessions:1},now,task:TASK});
 assert.equal(mod.querySelector('[data-fr-seal]').getAttribute('data-rd-action'),'focus-back');assert.equal(mod.querySelector('[data-fr-plus]').hidden,true);
 mod.innerHTML=f.F.module({focus:{minutes:25,remaining:0,elapsed:1500,endsAt:null,sessions:3,completedAt:now-1000,completedMinutes:25},now,task:TASK});
 assert.equal(mod.querySelector('[data-fr-break]').hidden,false);assert.equal(mod.querySelector('[data-fr-break]').getAttribute('data-rd-action'),'focus-break');
 assert.equal(mod.querySelector('[data-fr-lengths]').hidden,false);assert.equal(mod.querySelector('[data-open="true"]').getAttribute('data-minutes'),'180');
 // the seal's written-out name is always the word on it, whatever the session is doing
 const modes=[];for(const focus of [{minutes:50,remaining:3000,endsAt:null,sessions:0},running(600),{minutes:25,remaining:0,elapsed:1500,endsAt:null,sessions:3,completedAt:now-1000,completedMinutes:25},{minutes:5,remaining:300,elapsed:0,endsAt:now+200000,phase:'break',sessions:1}]){
  const v=V(focus,now);modes.push(v.mode);mod.innerHTML=f.F.module({focus,now,task:TASK});const seal=mod.querySelector('[data-fr-seal]');
  assert.equal(seal.getAttribute('aria-label'),v.seal,v.mode);assert.equal(f.text(seal,'[data-fr-seal-label]'),v.seal,v.mode);}
 assert.deepEqual(modes,['ready','running','done','break']);
 f.done();
});

test('the room follows the theme: dark and Fire are night (no white), a theme kit lends its colours, Biscuit only with the companion',async()=>{
 const dark=fixture({theme:'dark'});await dark.room.open();assert.equal(dark.panel.getAttribute('data-night'),'true');dark.done();
 const kit=fixture({kit:'blueprint'});await kit.room.open();assert.equal(kit.panel.getAttribute('data-kit'),'true');assert.equal(kit.panel.getAttribute('data-night'),'true','a dark kit is night');kit.done();
 const fire=fixture();fire.F.prefs.place='fire';await fire.room.open();assert.equal(fire.panel.getAttribute('data-night'),'true');assert.ok(fire.panel.querySelector('.fr-owl'));assert.ok(fire.panel.querySelector('.fr-firelight'));fire.done();
 const nopony=fixture({pony:false});await nopony.room.open();assert.equal(nopony.panel.getAttribute('data-pony'),'false');nopony.done();
 // every colour the drawings use has a day and a night value, and the night has no white
 const {DAY,NIGHT}=(()=>{const css=read('focus-room.css'),pick=sel=>{const m=css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}'));return Object.fromEntries(m[1].split(';').map(x=>x.split(':')).map(([k,v])=>[k.replace('--c-',''),v]));};return {DAY:pick('.fr-room,.fr-mod'),NIGHT:pick('.fr-room[data-night="true"],.rd[data-theme="dark"] .fr-mod,.rd:is([data-theme-kit="starry"],[data-theme-kit="stars"]) .fr-mod,.fr-mod[data-fr-night="true"],.fr-mod .fr-nightart')};})();
 const A=require('../extension/focus-room-art.js'),used=new Set();
 for(const place of A.PLACES)for(const night of [false,true])for(const m of A.stage(place,{night}).html.matchAll(/class="([^"]+)"/g))for(const c of m[1].split(' '))if(/^[fs]-/.test(c))used.add(c.slice(2));
 for(const token of used){assert.ok(DAY[token],'day colour for '+token);assert.ok(NIGHT[token],'night colour for '+token);}
 const white=hex=>{const n=parseInt(hex.slice(1),16),[r,g,b]=[n>>16,n>>8&255,n&255];return Math.min(r,g,b)>236;};
 for(const [token,value] of Object.entries(NIGHT))if(/^#/.test(value))assert.equal(white(value),false,'night '+token+' is not white');
});

test('places, volume and Quiet: the room washes into another place; the knob turns with keys; nothing leaves the device',async()=>{
 const f=fixture({motion:'off'});await f.room.open();
 const tag=f.panel.querySelector('[data-fr-act="places"]');f.room.click({target:tag});assert.equal(tag.getAttribute('aria-expanded'),'true');assert.equal(f.panel.querySelector('.fr-picker').hidden,false);
 f.room.click({target:f.panel.querySelector('[data-fr-act="place"][data-place="rain"]')});await settle();
 assert.equal(f.panel.getAttribute('data-place'),'rain');assert.ok(f.panel.querySelector('.fr-rain-near'));assert.equal(f.F.prefs.place,'rain');assert.equal(tag.getAttribute('aria-expanded'),'false');
 assert.equal(f.text(f.panel,'[data-fr-place-name]'),'Rain');
 // the tag keeps its name; the place on show is what describes it
 assert.equal(tag.getAttribute('aria-label'),'Place');assert.equal(f.text(f.panel,'#'+tag.getAttribute('aria-describedby')),'Rain');
 const knob=f.panel.querySelector('.fr-knob'),before=Number(knob.getAttribute('aria-valuenow'));
 assert.equal(f.room.keydown({key:'ArrowUp',target:knob,preventDefault(){}}),true);assert.equal(Number(knob.getAttribute('aria-valuenow')),before+5);
 f.room.keydown({key:'Home',target:knob,preventDefault(){}});assert.equal(knob.getAttribute('aria-valuenow'),'0');
 f.room.click({target:f.panel.querySelector('[data-fr-act="quiet"]')});assert.equal(f.panel.querySelector('[data-fr-act="quiet"]').getAttribute('aria-pressed'),'true');
 // the picker closes with Escape before the room does
 f.room.click({target:tag});assert.equal(f.room.keydown({key:'Escape',target:tag,preventDefault(){}}),true);assert.equal(f.room.isOpen(),true);assert.equal(f.panel.querySelector('.fr-picker').hidden,true);
 assert.doesNotMatch(read('focus-room.js'),/fetch\(|XMLHttpRequest|sendBeacon|new Audio\(|\.mp3|\.ogg/,'sounds are made in the browser; nothing is sent');
 f.room.F;f.F.prefs.place='lake';f.done();
});

test('the room stays shut while off and on quiz pages, closes when switched off, and reports full screen failure',async()=>{
 for(const options of [{on:false},{quiz:true}]){const f=fixture(options);assert.equal(await f.room.open(),false);assert.equal(f.panel,null);f.done();}
 const f=fixture();await f.room.open();f.env.ReserveFeatures.enabled=()=>false;f.room.sync();await settle();assert.equal(f.room.isOpen(),false);assert.equal(f.shell.style.visibility,undefined);assert.ok(!f.shell.style.opacity);f.done();
 const r=fixture({reject:true});await r.room.open();assert.equal(r.text(r.panel,'[role="status"]'),'Full screen unavailable');assert.equal(r.room.keydown({key:'Escape',target:r.panel,preventDefault(){}}),true);await settle();assert.equal(r.room.isOpen(),false);assert.equal(r.data.focus.remaining,1500);r.done();
});

test('a Market theme kit (data-rd-data-theme) lends the room its colours like a scene theme; a dark kit is night',async()=>{
 const light=fixture({market:'paper-pack',kitBg:'#F4EEDC'});await light.room.open();
 assert.equal(light.panel.getAttribute('data-kit'),'true');assert.equal(light.panel.getAttribute('data-night'),'false');assert.equal(light.panel.querySelector('.fr-skyl').style['--fr-sky0'],undefined,'a kit keeps its own sky');light.done();
 const dark=fixture({market:'ink-pack',kitBg:'#1C1A17'});await dark.room.open();assert.equal(dark.panel.getAttribute('data-kit'),'true');assert.equal(dark.panel.getAttribute('data-night'),'true');
 // removing the pack gives the room back its own look
 dark.container.removeAttribute('data-rd-data-theme');dark.room.sync();assert.equal(dark.panel.hasAttribute('data-kit'),false);assert.equal(dark.panel.getAttribute('data-night'),'false');dark.done();
});

test('the light follows the session: the day sky, sun and water change from dawn to dusk; Rain is grey under a veiled sun',async()=>{
 const f=fixture({focus:running(1500*.98)});await f.room.open();const sky=()=>f.panel.querySelector('.fr-skyl').style['--fr-sky1'],wet=()=>f.panel.querySelector('.fr-mid').style['--fr-water'],dawn=sky(),water=wet();assert.equal(f.panel.style['--fr-sky1'],undefined,'the light is written on the sky layer, not the room');
 f.data.focus={...f.data.focus,endsAt:Date.now()+30000};f.room.sync();
 assert.ok(dawn&&sky()&&dawn!==sky(),'the sky has moved on');assert.notEqual(water,wet());
 const css=read('focus-room.css');
 assert.match(css,/\.fr-room:not\(\[data-night="true"\]\):not\(\[data-kit="true"\]\) :is\(\.fr-skyl,\.fr-sun,\.fr-skyfade\)\{--c-sky0:var\(--fr-sky0,[^)]*\);[^}]*--c-sun:var\(--fr-sun,[^)]*\)\}/,'the sky reads the session\'s light');assert.match(css,/:is\(\.fr-mid,\.fr-mid2\)\{--c-water:var\(--fr-water,/,'the water too');
 const A=require('../extension/focus-room-art.js'),rain=A.stage('rain',{night:false}).html,sun=rain.match(/<div class="fr-sun"[\s\S]*?<\/div>/)[0];
 assert.match(rain,/f-raincloud/);assert.doesNotMatch(sun,/class="f-sun"/,'no bright sun with rays over the rain');assert.match(sun,/f-raincloud/,'the sun half hidden by cloud');
 f.done();
});

test('water lies under what stands in it: ripples, glints and falls draw before the boat, the bridge, the pier and the creatures',()=>{
 const A=require('../extension/focus-room-art.js'),order=(html,...marks)=>marks.map(m=>html.indexOf(m));
 const [shim,glint,mid2,near,heron,biscuit]=order(A.stage('lake',{night:false}).html,'fr-shimmer','fr-glint','fr-mid2','fr-near','fr-heron','fr-biscuit');
 assert.ok(shim>0&&shim<mid2&&glint<mid2&&mid2<near&&near<heron&&near<biscuit,'lake: the water, then the boat and ducks, then the pier, then Biscuit and the heron');
 const stream=A.stage('stream',{night:false}).html,[fall,foam,ripples,bridge]=order(stream,'fr-fall','fr-foam','fr-shimmer','fr-mid2');
 assert.ok(fall>0&&fall<bridge&&foam<bridge&&ripples<bridge,'stream: the fall and its foam are behind the footbridge');
 // every moving ripple of the stream lies between its banks
 const Lb=[[858,644],[800,684],[838,736],[712,796],[646,856],[600,900],[640,920]],Rb=[[990,644],[924,686],[968,740],[890,800],[870,860],[930,900],[1100,920]];
 const bank=(pts,y)=>{for(let i=0;i<pts.length-1;i++){const [ax,ay]=pts[i],[bx,by]=pts[i+1];if(y>=ay&&y<=by)return ax+(bx-ax)*(y-ay)/(by-ay);}return null;};
 const box=stream.match(/class="fr-a fr-shimmer s1" style="left:(\d+)px;top:(\d+)px[^>]*><svg[^>]*>([\s\S]*?)<\/svg>/),ox=+box[1],oy=+box[2];let n=0;
 for(const [,x,y] of box[3].matchAll(/M([\d.-]+) ([\d.-]+)q/g)){const gx=ox+ +x,gy=oy+ +y;assert.ok(gx>bank(Lb,gy)&&gx<bank(Rb,gy),`ripple at ${gx},${gy} is on the water`);n++;}
 assert.ok(n>40);
 const rain=A.stage('rain',{night:false}).html;assert.ok(rain.indexOf('fr-rings')<rain.indexOf('fr-near'),'rain: the puddle rings lie on the puddles, under the grass');
});

test('start and end life sit where they belong and face the way they go',()=>{
 const A=require('../extension/focus-room-art.js'),css=read('focus-room.css'),at=(html,cls)=>{const m=html.match(new RegExp('class="fr-a '+cls+'" style="left:([\\d.-]+)px;top:([\\d.-]+)px'));return m&&[+m[1],+m[2]];};
 assert.deepEqual(at(A.stage('lake').html,'fr-ring fr-start-life'),[600,676],'lake: open water east of the boat');
 assert.deepEqual(at(A.stage('stream').html,'fr-ring fr-start-life'),[812,652],'stream: open water between the pool and the footbridge');
 assert.deepEqual(at(A.stage('rain').html,'fr-ring fr-start-life'),[588,806],'rain: on the big puddle');
 assert.deepEqual(at(A.stage('stream').html,'fr-splash fr-end-splash'),[812,652],'the kingfisher goes into open water');
 // the heron faces into the lake and flies forward (to the left); the kingfisher dives bill first
 const heron=A.stage('lake').html.match(/<div class="fr-a fr-heron"[\s\S]*?<\/svg><\/div>/)[0];
 for(const pose of ['p-stand','p-crouch','p-fly1','p-fly2','p-fly3'])assert.match(heron,new RegExp('class="fr-pose '+pose+'"><g transform="translate\\(150 0\\) scale\\(-1 1\\)">'),pose);
 assert.match(css,/@keyframes fr-heron-fly \{[^\n]*translate\(-1000px,-460px\)/);for(const f of ['up','mid','down'])assert.match(css,new RegExp('@keyframes fr-h-'+f+' '),'wing frame '+f);
 assert.match(A.stage('stream').html,/<g class="fr-pose p-dive"><g transform="translate\(70 0\) scale\(-1 1\)">/);assert.match(css,/@keyframes fr-kf-dive \{[^\n]*translate\(-405px,94px\)/);
 // the fish rises nose up and falls back nose down, under a clip at the waterline, with a swirl before and a ring after
 assert.match(css,/@keyframes fr-fishjump \{ 0% \{ transform:translate\(-30px,16px\) rotate\(-40deg\); \}[^\n]*100% \{ transform:translate\(30px,16px\) rotate\(50deg\); \} \}/);
 assert.match(A.stage('lake').html,/<clipPath id="fr-fishclip-lake">[\s\S]*?fr-swirl|fr-swirl[\s\S]*?<clipPath id="fr-fishclip-lake">/);assert.match(A.stage('lake').html,/fr-ring2/);
});

test('the main things of each place never touch (Biscuit, the kettle by his nose, posts, lanterns, the props)',()=>{
 const A=require('../extension/focus-room-art.js'),hangs=[['lanternpost','lantern'],['pavilion-post','roof']];
 for(const [place,night] of [['lake',false],['lake',true],['stream',false],['stream',true],['rain',false],['rain',true],['fire',true],['winter',false],['winter',true]]){
  const boxes=A.stage(place,{night}).boxes;assert.ok(boxes.length>=8,place+': the main things are measured');
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const [a,...p]=boxes[i],[b,...q]=boxes[j];
   if(a.startsWith('biscuit')&&b.startsWith('biscuit'))continue;if(hangs.some(([x,y])=>a===x&&b===y||a===y&&b===x))continue;
   assert.ok(!(p[0]<q[2]&&q[0]<p[2]&&p[1]<q[3]&&q[1]<p[3]),place+': '+a+' touches '+b);}
  const head=boxes.find(b=>b[0]==='biscuit-head'),kettle=boxes.find(b=>b[0]==='kettle');
  if(place!=='fire'){const gap=kettle[1]-head[3];assert.ok(gap>=6&&gap<=30,place+': the kettle stands by his nose, not on it ('+gap+')');}
 }
});

test('the sun is in sight all session, rises at the start, travels its arc on big jumps and goes straight back on a reset',async()=>{
 const A=require('../extension/focus-room-art.js'),[,y0]=A.arc(0);assert.ok(y0+40<=A.HZ-60,'the arc ends clear of the ridge');
 const f=fixture({motion:'gentle',focus:{minutes:25,remaining:1500,endsAt:null,sessions:0}});await f.room.open();
 const sun=f.panel.querySelector('.fr-sun');assert.equal(sun.style.transform,'translate(240.0px,430.0px)','ready: on the ridge, in sight');
 f.animations.length=0;f.data.focus=running(1500,25,0);f.room.sync();
 const rise=f.animations.find(a=>a.node===sun);assert.ok(rise&&rise.frames.length>=8,'a sunrise along the arc');assert.equal(rise.frames[1].transform,'translate(240.0px,434.0px)','it dips before it rises');
 await settle();f.animations.length=0;
 f.data.focus={minutes:25,remaining:0,elapsed:1500,endsAt:null,sessions:1,completedAt:Date.now(),completedMinutes:25};f.room.sync();
 const go=f.animations.find(a=>a.node===sun);assert.ok(go&&go.frames.length>=10,'Finish: the sun travels its arc');
 const ys=go.frames.map(k=>+k.transform.match(/,([\d.-]+)px\)/)[1]);assert.ok(Math.min(...ys)<ys[0]-150,'over the top of the sky, not straight across');
 await settle();f.animations.length=0;
 f.data.focus={minutes:25,remaining:1500,endsAt:null,sessions:1};f.room.sync();
 assert.equal(f.animations.filter(a=>a.node===sun).length,0,'a reset goes straight back');assert.equal(sun.style.transform,'translate(240.0px,430.0px)');
 f.done();
});

test('the module grows into the room (a dip, a growing sheet, the grounds back to front) and folds back with a settle',async()=>{
 const f=fixture({motion:'gentle'});f.renderModule('m');const proto=f.Element.prototype,orig=proto.getBoundingClientRect;
 proto.getBoundingClientRect=function(){return {left:100,top:120,width:470,height:300,right:570,bottom:420};};
 try{
  await f.room.open(f.container.querySelector('.rd-widget-head [data-rd-action="room-open"]'));
  assert.equal(f.animations.some(a=>a.frames.some(k=>'clipPath' in k)),false,'no clip-path over the whole stage');
  const widget=f.container.querySelector('.rd-widget');assert.ok(f.animations.some(a=>a.node===widget&&a.frames.some(k=>k.transform==='scale(.975)')),'the module dips first');
  assert.ok(f.animations.some(a=>a.node.classList.contains('fr-sheet')),'a sheet of the room grows out of it');
  const depths=f.animations.filter(a=>a.node.classList.contains('fr-depth'));assert.deepEqual(depths.map(a=>a.options.delay),[120,142,164,186,208],'back to front, close behind the sheet');assert.ok(depths.every(a=>a.options.duration<=360),'each ground settles within 360 ms');
  assert.ok(depths[0].frames.some(k=>k.transform==='translateY(-2px)'),'each ground rises past its place and settles');
  const seal=f.panel.querySelector('[data-fr-seal]');assert.ok(f.animations.some(a=>a.node===seal&&a.frames.some(k=>k.transform==='scale(1.03)')),'the controls land with a settle');
  f.animations.length=0;await f.room.close();
  assert.ok(f.animations.some(a=>a.node===widget&&a.frames.some(k=>k.transform==='scaleY(1.02)')),'the module\'s frame settles once the room is back in it');
 }finally{proto.getBoundingClientRect=orig;f.done();}
});

test('changing place: the next place is built first, a wet stroke covers the swap and holds, the grounds settle in behind it',async()=>{
 const f=fixture({motion:'gentle'}),proto=f.Element.prototype;
 proto.insertBefore=function(node,ref){node.remove();const i=this.childNodes.indexOf(ref);node.parentNode=this;this.childNodes.splice(i<0?this.childNodes.length:i,0,node);return node;};
 try{
  await f.room.open();f.animations.length=0;
  f.room.click({target:f.panel.querySelector('[data-fr-act="place"][data-place="stream"]')});
  const washes=()=>f.animations.filter(a=>a.node.classList.contains('fr-washer')).length;
  for(let i=0;i<300&&washes()<2;i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(f.panel.querySelectorAll('[data-fr-stage]').length,1,'one place on show after the swap');
  assert.equal(f.panel.getAttribute('data-place'),'stream');assert.ok(f.panel.querySelector('.fr-fall'));
  const wash=f.animations.filter(a=>a.node.classList.contains('fr-washer'));assert.equal(wash.length,2,'the stroke comes in, then leaves');
  assert.equal(wash[0].frames.at(-1).transform,'translateX(-14%)');assert.equal(wash[1].frames[0].transform,'translateX(-14%)');
  assert.equal(f.animations.filter(a=>a.node.classList.contains('fr-stage')&&a.frames[0].translate==='0 8px').length,1,'the new place settles in behind the stroke as one layer');
  assert.equal(f.animations.filter(a=>a.node.classList.contains('fr-depth')&&a.options?.duration===700).length,0,'no ground moves on its own (only two full-screen layers move per frame)');
  const art=f.F&&require('../extension/focus-room-art.js').washArt();assert.match(art,/f-washedge/);
 }finally{delete proto.insertBefore;f.F.prefs.place='lake';f.done();}
});

test('a place chosen while the stroke is still on its way is the one it brings: one stroke in and out, no queue',async()=>{
 const f=fixture({motion:'gentle'}),proto=f.Element.prototype;
 proto.insertBefore=function(node,ref){node.remove();const i=this.childNodes.indexOf(ref);node.parentNode=this;this.childNodes.splice(i<0?this.childNodes.length:i,0,node);return node;};
 try{
  await f.room.open();f.animations.length=0;
  f.room.click({target:f.panel.querySelector('[data-fr-act="place"][data-place="stream"]')});
  f.room.click({target:f.panel.querySelector('[data-fr-act="place"][data-place="rain"]')});
  const washes=()=>f.animations.filter(a=>a.node.classList.contains('fr-washer'));
  for(let i=0;i<300&&washes().length<2;i++)await new Promise(r=>setTimeout(r,10));
  await new Promise(r=>setTimeout(r,80));
  assert.equal(washes().length,2,'the stroke comes in once and leaves once');
  assert.equal(f.panel.getAttribute('data-place'),'rain','the latest choice is the place on show');
  assert.equal(f.panel.querySelectorAll('[data-fr-stage]').length,1,'one place on show');assert.ok(f.panel.querySelector('.fr-rain'));
 }finally{delete proto.insertBefore;f.F.prefs.place='lake';f.done();}
});
test('a place chosen while the stroke holds over a place it has just brought: the stroke brings that one too',async()=>{
 const f=fixture({motion:'gentle'}),proto=f.Element.prototype;
 proto.insertBefore=function(node,ref){node.remove();const i=this.childNodes.indexOf(ref);node.parentNode=this;this.childNodes.splice(i<0?this.childNodes.length:i,0,node);return node;};
 try{
  await f.room.open();f.animations.length=0;
  f.room.click({target:f.panel.querySelector('[data-fr-act="place"][data-place="stream"]')});
  for(let i=0;i<300&&f.panel.getAttribute('data-place')!=='stream';i++)await new Promise(r=>setTimeout(r,1));
  f.room.click({target:f.panel.querySelector('[data-fr-act="place"][data-place="fire"]')});
  const washes=()=>f.animations.filter(a=>a.node.classList.contains('fr-washer'));
  for(let i=0;i<300&&washes().length<2;i++)await new Promise(r=>setTimeout(r,10));
  await new Promise(r=>setTimeout(r,80));
  assert.equal(f.panel.getAttribute('data-place'),'fire');assert.equal(f.panel.getAttribute('data-night'),'true');
  assert.equal(f.panel.querySelectorAll('[data-fr-stage]').length,1,'one place on show, the stroke gone');assert.ok(f.panel.querySelector('.fr-flames'));
 }finally{delete proto.insertBefore;f.F.prefs.place='lake';f.done();}
});
test('a run of pomodoros: the label shows where it is, and "Back to it" in a break moves on to the run\'s next focus',async()=>{
 const f=fixture(),V=f.F.view,now=Date.now();
 const brk={phase:'break',minutes:5,remaining:300,elapsed:0,endsAt:now+200000,breakUntil:now+200000,focusMinutes:25,breakMinutes:5,cycles:4,cycle:1,sessions:1,fromPony:true};
 const v=V(brk,now);assert.equal(v.label,'Break · 5 · 1 / 4');assert.equal(v.seal,'Back to it');assert.equal(v.back,25);
 assert.equal(V({...brk,phase:'focus',minutes:25,remaining:1500,endsAt:now+600000,breakUntil:0,cycle:2},now).label,'Focus · 25 · 2 / 4');
 f.body.innerHTML=f.F.module({focus:brk,now,task:TASK});assert.equal(f.body.querySelector('[data-fr-seal]').getAttribute('data-minutes'),'25');f.done();
 // the planner's answer to "Back to it" (widgets.js)
 const env={ReserveWorkspaceArrange:require('../extension/workspace-arrange.js'),ReserveCore:require('../extension/core.js'),ReserveFeatures:{enabled:id=>id!=='focus-room'},setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},addEventListener(){},removeEventListener(){}};
 vm.runInNewContext(read('widgets.js'),env);
 const back=async focus=>{const data={settings:{},tasks:{},focus:structuredClone(focus)},doc={addEventListener(){},removeEventListener(){},defaultView:env},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]};
  const view=env.ReserveWidgets.create({container,store:{get:()=>data},save:async fn=>{fn(data);return true;},rerender(){},getContext:()=>({personal:data,s:{timeZone:'UTC'},items:[],local:{},courses:[],courseMap:new Map(),now}),helpers:()=>({E:String,formatDate:()=>'',dayKey:()=>'2026-10-28',complete:()=>false})});
  assert.equal(view.click({target:{closest:sel=>sel==='[data-rd-action]'?{dataset:{rdAction:'focus-back',minutes:'25'}}:null}}),true);await settle();view.destroy?.();return data.focus;};
 const next=await back(brk);
 assert.equal(next.phase,'focus');assert.equal(next.cycle,2);assert.equal(next.cycles,4);assert.equal(next.minutes,25);assert.equal(next.focusMinutes,25);assert.equal(next.breakMinutes,5);assert.equal(next.fromPony,true);assert.ok(next.endsAt>now);
 const last=await back({...brk,cycle:4});assert.equal(last.phase,undefined,'after the run\'s last break: a fresh session');assert.equal(last.cycles,undefined);assert.equal(last.minutes,25);
});

test('a hidden page pauses the room',async()=>{
 const f=fixture();await f.room.open();f.document.visibilityState='hidden';f.docEvents.visibilitychange();assert.equal(f.panel.getAttribute('data-hidden'),'true');
 f.document.visibilityState='visible';f.docEvents.visibilitychange();assert.equal(f.panel.hasAttribute('data-hidden'),false);f.done();
});

test('round 3: the seal row keeps one height in every mode, the seal\'s word fits its ring, the column keeps above the ridge, the glitter keeps to open water',async()=>{
 const A=require('../extension/focus-room-art.js');
 for(const focus of [{minutes:25,remaining:1500,endsAt:null,sessions:0},running(600),{minutes:25,remaining:0,elapsed:1500,endsAt:null,sessions:1,completedAt:Date.now()-2000,completedMinutes:25}]){
  const f=fixture({focus});await f.room.open();const c=f.panel.querySelector('.fr-controls'),center=f.panel.querySelector('.fr-center');
  assert.deepEqual([...center.children].map(n=>n.className),['fr-time','fr-line','fr-controls'],'time, the label line, the seal row: nothing between them');
  assert.deepEqual([...c.children].map(n=>n.classList.contains('fr-lengths')?'lengths':n.classList.contains('fr-seal')?'seal':n.classList.contains('fr-side')?'side':'?'),['lengths','seal','side'],'the lengths beside the seal, the tags on its other side');
  assert.ok(f.panel.querySelector('.fr-line [data-fr-tally]'),'the tally sits on the label line');f.done();
 }
 const css=read('focus-room.css');assert.match(css,/\.fr-room \.fr-controls \{ display:grid;grid-template-columns:1fr auto 1fr;/);assert.match(css,/text-wrap:balance/);
 const f=fixture({focus:{phase:'break',minutes:5,remaining:300,elapsed:0,endsAt:Date.now()+290000,breakUntil:Date.now()+290000,sessions:1}});await f.room.open();
 assert.equal(f.panel.querySelector('[data-fr-seal-label]').getAttribute('data-len'),'words','"Back to it" is set as two balanced lines');f.done();
 for(const place of A.PLACES)assert.ok(A.stage(place,{night:place==='fire'}).ridge.length>=1,place+': the ridge line is kept with the place');
 const g=fixture();g.F.prefs.place='rain';await g.room.open();assert.ok(parseFloat(g.panel.style['--fr-lift'])>0,'on Rain at 1440 x 900 the column is lifted off the far peaks');g.done();
 // the lake's glitter: ten rows on the far water, none over the boat's hull, Biscuit or the lantern
 const lake=A.stage('lake',{night:true}),glint=lake.html.match(/<g class="fr-gl">/g);assert.equal(glint.length,10);
});
