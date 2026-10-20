'use strict';
// The focus room: its session rules (timer, Pomodoro, open sessions), the log and numbers, the room's choices, how
// they are stored, and how the room and its backdrop page are wired into the extension.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const M=require('../extension/focus-room-model.js');
const Room=require('../extension/focus-room.js');
const Scenes=require('../extension/focus-scene-renderer.js');
const {createStore}=require('../extension/storage.js');
const ext=path.join(__dirname,'..','extension'),read=f=>fs.readFileSync(path.join(ext,f),'utf8');
const T0=Date.parse('2026-10-19T15:00:00Z'),MIN=60000;

test('primary controls use readable ink for both light and dark theme accents',()=>{
 assert.equal(Room.accentInk('#A9522F'),'#fff');
 assert.equal(Room.accentInk('#a3d4e5'),'#182228');
 assert.equal(Room.accentInk('#ffffff'),'#182228');
 assert.equal(Room.accentInk('#000000'),'#fff');
});

test('frame messages use a valid extension origin and reject other pages',()=>{
 const url='chrome-extension://temporary-resource-host/focus-scene.html';
 assert.equal(new URL(url).origin,'null','WHATWG URL does not recognize the extension scheme');
 assert.equal(Room.frameOrigin(url),'chrome-extension://temporary-resource-host');
 assert.equal(Room.trustedFrameOrigin('chrome-extension://temporary-resource-host',url),true);
 assert.equal(Room.trustedFrameOrigin('https://unrelated.example',url),false);
 assert.equal(Room.trustedFrameOrigin('null',url),false);
 assert.equal(Room.frameOrigin('http://localhost:8787/extension/focus-scene.html'),'http://localhost:8787');
});

test('an empty srcdoc never overrides the room frame, including one added during attachment',()=>{
 const attrs=new Map([['srcdoc','']]),events={},url='chrome-extension://harness/focus-scene.html';
 const frame={addEventListener:(k,fn)=>events[k]=fn,getAttribute:k=>attrs.get(k)??null,hasAttribute:k=>attrs.has(k),removeAttribute:k=>attrs.delete(k),set src(v){attrs.set('src',v);}};
 Room.loadFrame(frame,url);assert.equal(attrs.get('src'),url);assert.equal(attrs.has('srcdoc'),false);
 attrs.set('srcdoc','');events.load();assert.equal(attrs.has('srcdoc'),false);
 attrs.set('src','https://other.example');attrs.set('srcdoc','');events.load();assert.equal(attrs.has('srcdoc'),true,'only the room’s own expected frame is repaired');
});

test('room resources keep their extension address after an extension update invalidates runtime',()=>{
 const vm=require('node:vm'),runtime={id:'harness',getURL:()=>{throw Error('not needed for Canvas');}},env={URL,chrome:{runtime},location:{origin:'https://wra.instructure.com',href:'https://wra.instructure.com/'}};
 vm.runInNewContext(read('focus-room.js'),env);
 Object.defineProperty(runtime,'id',{get(){throw Error('Extension context invalidated');}});
 assert.equal(env.ReserveFocusRoom.pageURL('focus-scene.html'),'chrome-extension://harness/focus-scene.html');
 assert.equal(env.ReserveFocusRoom.pageURL('focus-guard.html'),'chrome-extension://harness/focus-guard.html');
});

test('every built-in scene paints immediately, animates when allowed, and releases its clock on close',()=>{
 const callbacks=new Map(),events=new Map(),calls=[];let id=0;
 const gradient={addColorStop(){}};
 const g=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(t,k)=>k in t?t[k]:(...args)=>calls.push([k,...args])});
 const win={innerWidth:1200,innerHeight:800,devicePixelRatio:2,requestAnimationFrame:fn=>{callbacks.set(++id,fn);return id;},cancelAnimationFrame:id=>callbacks.delete(id),addEventListener:(k,fn)=>events.set('win-'+k,fn),removeEventListener:k=>events.delete('win-'+k)};
 const doc={defaultView:win,hidden:false,createElement:()=>({getContext:()=>g}),addEventListener:(k,fn)=>events.set(k,fn),removeEventListener:k=>events.delete(k)};
 const canvas={ownerDocument:doc,getContext:()=>g},renderer=Scenes.create(canvas);
 for(const scene of ['rain','night','ocean','lamp','starry','lilies','ink','plain']){
  calls.length=0;renderer.show({scene,theme:'dark',still:false});
  assert.ok(calls.some(([k])=>k==='fillRect'),`${scene} paints without waiting for a frame message`);
  assert.equal(callbacks.size,scene==='plain'?0:1);
 }
 renderer.show({scene:'night',theme:'dark',still:true});assert.equal(callbacks.size,0,'reduced motion paints a still scene');
 renderer.show({scene:'rain',theme:'dark',still:false});assert.equal(callbacks.size,1);
 doc.hidden=true;events.get('visibilitychange')();assert.equal(callbacks.size,0,'hidden tabs stop drawing');
 doc.hidden=false;events.get('visibilitychange')();assert.equal(callbacks.size,1);
 renderer.destroy();assert.equal(callbacks.size,0);assert.equal(events.size,0);
});

// Minimal DOM boundary for checking identity across updates. Controls carry properties independently of attributes.
function roomElement(tag='div',attrs={},children=[]){
 const el={nodeType:1,nodeName:tag.toUpperCase(),tagName:tag.toUpperCase(),attrs:{...attrs},childNodes:[],value:'',checked:false,
  get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));},
  get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));},
  get id(){return this.attrs.id||'';},get firstChild(){return this.childNodes[0]||null;},
  get nextSibling(){return this.parent?.childNodes[this.parent.childNodes.indexOf(this)+1]||null;},
  getAttribute(k){return this.attrs[k]??null;},hasAttribute(k){return k in this.attrs;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},
  insertBefore(child,before){child.remove();const i=before?this.childNodes.indexOf(before):this.childNodes.length;this.childNodes.splice(i,0,child);child.parent=this;},
  remove(){if(this.parent)this.parent.childNodes.splice(this.parent.childNodes.indexOf(this),1);this.parent=null;}};
 for(const child of children)el.insertBefore(child,null);return el;
}

test('updating the clock preserves a pressed button, focused input and slider',()=>{
 const button=roomElement('button',{'data-fr-action':'toggle'}),goal=roomElement('input',{'data-fr-field':'goal'}),slider=roomElement('input',{'data-fr-field':'dim',type:'range'});
 goal.value='Read chapter 2';slider.value='35';
 const ui=roomElement('div',{class:'fr-ui'},[button,goal,slider]);
 const nextGoal=roomElement('input',{'data-fr-field':'goal'});nextGoal.value=goal.value;
 const nextSlider=roomElement('input',{'data-fr-field':'dim',type:'range'});nextSlider.value='50';
 const next=roomElement('div',{class:'fr-ui'},[roomElement('button',{'data-fr-action':'toggle'}),nextGoal,nextSlider]);
 Room.patchRoom(ui,next);
 assert.equal(ui.childNodes[0],button);assert.equal(ui.childNodes[1],goal);assert.equal(goal.value,'Read chapter 2');
 assert.equal(ui.childNodes[2],slider);assert.equal(slider.value,'50');
});

test('adding and removing a settings panel preserves the timer and task controls',()=>{
 const timer=roomElement('main',{'data-rd-key':'timer'}),task=roomElement('aside',{'data-rd-key':'task'});
 const ui=roomElement('div',{},[timer,task]);
 Room.patchRoom(ui,roomElement('div',{},[roomElement('main',{'data-rd-key':'timer'}),roomElement('aside',{'data-rd-key':'task'}),roomElement('section',{'data-rd-key':'panel-scene'})]));
 assert.equal(ui.childNodes[0],timer);assert.equal(ui.childNodes[1],task);assert.equal(ui.childNodes.length,3);
 Room.patchRoom(ui,roomElement('div',{},[roomElement('main',{'data-rd-key':'timer'}),roomElement('aside',{'data-rd-key':'task'})]));
 assert.deepEqual(ui.childNodes,[timer,task]);
});

test('a plain timer keeps exactly the five fields the Home timer always stored',()=>{
 assert.deepEqual(M.cleanFocus({minutes:45,remaining:1200,endsAt:null,itemId:'17',sessions:3}),{minutes:45,remaining:1200,endsAt:null,itemId:'17',sessions:3});
 assert.deepEqual(M.cleanFocus(undefined),{minutes:25,remaining:1500,endsAt:null,itemId:null,sessions:0});
 // the room's fields are kept only when they say something
 const f=M.cleanFocus({minutes:30,mode:'pomodoro',phase:'short',round:3,goal:'Problems 1-12',junk:'x'});
 assert.equal(f.mode,'pomodoro');assert.equal(f.phase,'short');assert.equal(f.round,3);assert.equal(f.goal,'Problems 1-12');assert.ok(!('junk' in f));
 // a break only exists in Pomodoro; lengths stay in range
 assert.ok(!('phase' in M.cleanFocus({mode:'timer',phase:'long'})));
 assert.equal(M.cleanFocus({minutes:500}).minutes,25);assert.equal(M.cleanFocus({remaining:99999}).remaining,7200);
 assert.equal(M.cleanFocus({goal:'a\u0000b'.repeat(80)}).goal.length,140);
});

test('the timer counts down, pauses where it was, and resets',()=>{
 let f=M.setMinutes({},50);assert.equal(f.minutes,50);assert.equal(f.mode,'timer');
 f=M.start(f,T0);assert.equal(f.endsAt,T0+50*MIN);
 const s=M.state(f,T0+10*MIN);assert.equal(s.running,true);assert.equal(s.left,40*60);assert.equal(s.elapsed,10*60);assert.ok(Math.abs(s.progress-.2)<1e-9);
 f=M.pause(f,T0+10*MIN);assert.equal(f.endsAt,null);assert.equal(f.remaining,40*60);
 assert.equal(M.state(f,T0+99*MIN).left,40*60,'a paused timer does not move');
 f=M.reset(f);assert.equal(f.remaining,50*60);
 assert.equal(M.setMinutes({},2).minutes,5);assert.equal(M.setMinutes({},500).minutes,120);
});

test('a finished timer session is counted and logged with its goal and assignment',()=>{
 const data={focus:M.start({...M.setMinutes({itemId:'402'},25),goal:'Finish 1-12'},T0)};
 assert.equal(M.settle(data,T0+24*MIN),false,'not before the end');
 assert.equal(M.settle(data,T0+25*MIN+2000),'focus');
 assert.equal(data.focus.sessions,1);assert.equal(data.focus.endsAt,null);
 assert.deepEqual(data.focusLog,[{at:T0+25*MIN,m:25,i:'402',g:'Finish 1-12'}]);
 assert.equal(M.settle(data,T0+30*MIN),false,'settles once');
});

test('Pomodoro: a break follows each round, a long one after the chosen number, and the next round waits unless asked',()=>{
 const room={work:25,short:5,long:15,every:2,auto:false};
 const data={focusRoom:room,focus:M.start(M.setMode({},'pomodoro',room),T0)};
 assert.equal(M.state(data.focus,T0).phase,'focus');
 // round 1 ends: a short break starts by itself
 assert.equal(M.settle(data,T0+25*MIN+1000),'focus');
 let s=M.state(data.focus,T0+25*MIN+1000);assert.equal(s.phase,'short');assert.equal(s.running,true);assert.equal(s.minutes,5);assert.equal(data.focus.endsAt,T0+30*MIN);
 // the break ends: round 2 is ready but waits
 assert.equal(M.settle(data,T0+30*MIN+1000),'break');
 s=M.state(data.focus,T0+30*MIN+1000);assert.equal(s.phase,'focus');assert.equal(s.round,2);assert.equal(s.running,false);assert.equal(s.minutes,25);
 // round 2 (the last before a long break) ends: a long break
 data.focus=M.start(data.focus,T0+31*MIN);
 assert.equal(M.settle(data,T0+56*MIN+500),'focus');assert.equal(M.state(data.focus,T0+56*MIN+500).phase,'long');assert.equal(data.focus.minutes,15);
 // after a long break the count starts again, and with auto on the next round starts by itself
 data.focusRoom={...room,auto:true};
 assert.equal(M.settle(data,T0+71*MIN+500),'break');
 s=M.state(data.focus,T0+71*MIN+500);assert.equal(s.round,1);assert.equal(s.running,true);
 assert.equal(data.focusLog.length,2);assert.equal(data.focus.sessions,2);
});

test('a phase that ended while the page was closed is recorded, but nothing new runs without the student',()=>{
 const room={work:25,short:5,long:15,every:4,auto:true};
 const data={focusRoom:room,focus:M.start(M.setMode({},'pomodoro',room),T0)};
 assert.equal(M.settle(data,T0+3*60*MIN),'focus');
 const s=M.state(data.focus,T0+3*60*MIN);assert.equal(s.phase,'short');assert.equal(s.running,false,'the break waits');
 assert.equal(data.focusLog[0].at,T0+25*MIN,'logged at the real end');
});

test('Finish now logs whole minutes worked; Skip break moves on; an open session counts up',()=>{
 const data={focus:M.start(M.setMinutes({},45),T0)};
 assert.equal(M.finish(data,T0+12*MIN+40000),'focus');assert.equal(data.focusLog[0].m,12);assert.equal(data.focus.sessions,1);assert.equal(data.focus.endsAt,null);
 const short={focus:M.start(M.setMinutes({},45),T0)};assert.equal(M.finish(short,T0+30000),false,'under a minute is not a session');assert.ok(!short.focusLog);
 const brk={focusRoom:{work:30},focus:{mode:'pomodoro',phase:'short',round:2,minutes:5,endsAt:T0+MIN}};
 assert.equal(M.finish(brk,T0),false);assert.equal(brk.focus.phase,'focus');assert.equal(brk.focus.round,3);assert.equal(brk.focus.minutes,30);
 let open=M.start(M.setMode({},'open',{}),T0);assert.equal(open.startedAt,T0);
 assert.equal(M.state(open,T0+90*MIN).shown,90*60,'counts past an hour');
 open=M.pause(open,T0+10*MIN);assert.equal(open.startedAt,null);assert.equal(open.elapsed,600);
 open=M.start(open,T0+20*MIN);assert.equal(M.state(open,T0+25*MIN).elapsed,900);
 const od={focus:open};assert.equal(M.finish(od,T0+25*MIN),'focus');assert.equal(od.focusLog[0].m,15);
 assert.equal(M.settle({focus:M.start(M.setMode({},'open',{}),T0)},T0+9e9),false,'an open session never ends by itself');
});

test('the numbers: today, days in a row, the last week by course, recent sessions',()=>{
 const day=t=>new Date(t).toISOString().slice(0,10),D=864e5;
 const log=[{at:T0-3*D,m:30,i:'1'},{at:T0-2*D,m:20,i:'2'},{at:T0-D,m:25,i:'1'},{at:T0-60000,m:25,i:'9'},{at:T0-30000,m:10,i:null},{at:T0-20*D,m:50,i:'1'}];
 const st=M.stats(log,{now:T0,dayOf:day,courseOf:id=>({1:'101',2:'202'})[id]??null});
 assert.equal(st.today,35);assert.equal(st.streak,4);assert.equal(st.weekTotal,110);
 assert.deepEqual(st.week,[{courseId:'101',minutes:55},{courseId:null,minutes:35},{courseId:'202',minutes:20}]);
 assert.equal(st.recent.length,5);assert.equal(st.recent[0].m,10);
 assert.equal(M.stats([{at:T0-D,m:5}],{now:T0,dayOf:day}).streak,1,'a streak still counts before today’s first session');
 assert.equal(M.stats([],{now:T0,dayOf:day}).streak,0);
 // the log keeps 400 sessions and 120 days at most, and drops junk
 const many=Array.from({length:450},(_,i)=>({at:T0-i*60000,m:1}));
 assert.equal(M.cleanLog(many,T0).length,400);assert.equal(M.cleanLog([{at:T0-200*D,m:5},{at:T0,m:0},{at:'x',m:5},null],T0).length,0);
});

test('room choices are clamped, and files are checked by kind and size',()=>{
 const r=M.cleanRoom({scene:'disco',dim:200,blur:-4,work:1,short:99,long:2,every:20,auto:'yes',chime:false,sound:{on:true,volume:4,rain:.5,brown:'x'},media:{photo:{name:'desk.jpg',type:'image/jpeg',size:1000},video:{name:''}}});
 assert.equal(r.scene,'rain');assert.equal(r.dim,85);assert.equal(r.blur,0);assert.equal(r.work,5);assert.equal(r.short,30);assert.equal(r.long,5);assert.equal(r.every,8);
 assert.equal(r.auto,false);assert.equal(r.chime,false);assert.equal(r.sound.volume,1);assert.equal(r.sound.rain,.5);assert.equal(r.sound.brown,.6);
 assert.deepEqual(r.media,{photo:{name:'desk.jpg',type:'image/jpeg',size:1000},video:null,audio:null});
 assert.equal(M.checkMedia('photo',{type:'image/png',size:1}),'');
 assert.equal(M.checkMedia('video',{type:'video/webm;codecs=vp8',size:1}),'','codec details are ignored');
 assert.match(M.checkMedia('photo',{type:'text/plain',size:1}),/JPG/);
 assert.match(M.checkMedia('video',{type:'video/mp4',size:101*1024*1024}),/100 MB/);
 assert.match(M.checkMedia('audio',{type:'audio/mpeg',size:0}),/empty/);
 assert.match(M.checkMedia('script',{type:'text/javascript',size:1}),/Choose/);
 assert.equal(M.clock(65),'01:05');assert.equal(M.clock(3725),'1:02:05');assert.equal(M.minutesText(95),'1 h 35 min');
});

test('the room’s session, log and choices are stored with personal data and survive a backup',async()=>{
 const mem=new Map(),adapter={read:async k=>mem.get(k),write:async(k,v)=>{mem.set(k,structuredClone(v));}};
 const store=createStore({accountId:'7',origin:'https://school.instructure.com',adapter});await store.load();
 await store.update(d=>{d.focus=M.start(M.setMode({goal:'Read ch. 3'},'pomodoro',{}),Date.now());d.focusRoom={scene:'night',dim:50,sound:{on:true,rain:.4}};d.focusLog=[{at:Date.now()-1000,m:25,i:'5',g:'x'}];});
 const saved=store.get();
 assert.equal(saved.focus.mode,'pomodoro');assert.equal(saved.focus.goal,'Read ch. 3');assert.equal(saved.focusRoom.scene,'night');assert.equal(saved.focusRoom.dim,50);assert.equal(saved.focusLog.length,1);
 const restored=require('../extension/storage.js').validateBackup(store.exportBackup(),store.owner);
 assert.equal(restored.focusRoom.sound.rain,.4);assert.equal(restored.focusLog[0].m,25);assert.equal(restored.focus.mode,'pomodoro');
});

test('wired in: content scripts in order, the stylesheet, and the backdrop page',()=>{
 const manifest=JSON.parse(read('manifest.json')),main=manifest.content_scripts.find(c=>c.js.includes('dashboard.js')).js;
 assert.ok(main.indexOf('focus-room-model.js')<main.indexOf('storage.js'),'the model loads before storage cleans data');
 assert.ok(main.indexOf('pets.js')<main.indexOf('focus-room.js')&&main.indexOf('focus-room.js')<main.indexOf('widgets.js'));
 assert.ok(main.indexOf('focus-scene-renderer.js')<main.indexOf('focus-room.js'));
 assert.ok(main.includes('focus-dial.js')&&main.indexOf('focus-dial.js')<main.indexOf('focus-room.js'),'shared ring controller loads before both timer views');
 for(const w of manifest.web_accessible_resources){assert.ok(w.resources.includes('focus-room.css'));assert.ok(w.resources.includes('focus-scene.html'));}
 for(const f of ['startup.js','content.js'])assert.match(read(f),/'pet\.css','focus-room\.css'/,f);
 assert.equal(manifest.content_security_policy.extension_pages.includes('wasm-unsafe-eval'),false);
 assert.ok(!manifest.permissions.includes('notifications')&&!manifest.permissions.includes('alarms'),'no new permissions');
 const preview=fs.readFileSync(path.join(__dirname,'..','preview','index.html'),'utf8');
 assert.match(preview,/<script src="\.\.\/extension\/focus-room-model\.js"><\/script><script src="\.\.\/extension\/focus-guard-model\.js"><\/script><script src="\.\.\/extension\/storage\.js"/);assert.match(preview,/pets\.js"><\/script><script src="\.\.\/extension\/focus-scene-renderer\.js"><\/script><script src="\.\.\/extension\/focus-dial\.js"><\/script><script src="\.\.\/extension\/focus-room\.js"/);
});

test('the backdrop page only listens to its own Canvas page, keeps files to itself, and runs no inline script',()=>{
 const html=read('focus-scene.html'),js=read('focus-scene.js');
 assert.doesNotMatch(html,/<script>(?!<\/script>)|\son[a-z]+="/,'no inline script or handlers (extension CSP)');
 assert.match(html,/<script src="site\.js"><\/script>\s*<script src="focus-room-model\.js"><\/script>\s*<script src="focus-scene-renderer\.js"><\/script>\s*<script src="focus-scene\.js"><\/script>/);
 assert.match(js,/if\(event\.source!==window\.parent\|\|!allowed\(event\.origin\)\)return;/);
 assert.match(js,/origin===parentOrigin&&\(globalThis\.ReserveSite\?\.supported\?\.\(origin\)/);
 assert.match(js,/const problem=Model\.checkMedia\(m\.kind,m\.file\)/,'files are checked again before they are kept');
 assert.match(js,/indexedDB\.open\(DB,1\)/);assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|sendBeacon/,'nothing is sent anywhere');
 assert.match(js,/window\.parent\.postMessage\(\{type:'reserve-focus-scene',\.\.\.message\},parentOrigin\)/,'answers go only to the page that framed it');
});

test('the room uses the shared session: the Home timer, the pony and the dashboard clock all agree',()=>{
 const widgets=read('widgets.js'),dash=read('dashboard.js'),view=read('dashboard-view.js'),room=read('focus-room.js');
 assert.match(widgets,/if\(Room\(\)\)return Room\(\)\.state\(focus,now\);/);
 assert.match(widgets,/focus:item=>room\?room\.open\(\{itemId:item\?\.id,start:true\}\):startFocus\(\)/,'the pony’s Focus opens the room');
 assert.match(widgets,/event\.key==='F'&&event\.shiftKey/,'Shift+F');
 assert.match(dash,/const settle=root\.ReserveFocusRoomModel\?\.settle\|\|C\.settleFocus;/);
 assert.match(view,/action\('focus-room',icon\('clock'\)\+'<span>Focus<\/span>'/,'an assignment’s Focus button');
 assert.match(room,/node\.dataset\.rdKeep='true'/,'the room survives workspace renders');
 assert.match(room,/loadFrame\(frame,sceneURL\(\)\)/);assert.match(room,/setAttribute\('allow','autoplay'\)/);
 assert.match(room,/return true;   \/\/ the workspace's own shortcuts stay quiet while the room is open/);
});

test('breaks breathe: a slow in-and-out cue under the dial, and one still line with reduced motion',()=>{
 const room=fs.readFileSync(path.join(__dirname,'..','extension','focus-room.js'),'utf8'),css=fs.readFileSync(path.join(__dirname,'..','extension','focus-room.css'),'utf8');
 assert.match(room,/s\.brk&&s\.running\?'<p class="fr-breath" aria-hidden="true"><span>Breathe in<\/span><span>Breathe out<\/span><span>Breathe slowly<\/span><\/p>'/);
 assert.match(css,/\.fr-breath span:nth-child\(1\)\{animation:fr-breath-in 10s/);assert.match(css,/@keyframes fr-breathe\{0%\{transform:scale\(\.8\)\}40%/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{\.fr-breath span:nth-child\(-n\+2\)\{display:none\}/);
 assert.match(room,/scenery\?\.session\?\.\(\{progress:s\.progress,brk:s\.brk,running:s\.running\}\)/,'the scene hears the session each second');
});
test('the media frame loads only for the student’s own photo, video or sound',()=>{
 const room=fs.readFileSync(path.join(__dirname,'..','extension','focus-room.js'),'utf8');
 assert.match(room,/if\(r\.scene==='photo'\|\|r\.scene==='video'\|\|r\.sound\.on\)ensureFrame\(\);/);
 assert.match(room,/if\(!ready\)\{pendingStore=\{kind,file\};ensureFrame\(\);return;\}/,'a file chosen first waits for the frame');
 assert.doesNotMatch(room,/loadFrame\(frame,sceneURL\(\)\);\n   for\(const input/,'not created when the room opens');
});
