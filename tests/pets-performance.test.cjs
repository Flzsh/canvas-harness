'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,teardown}=require('./pets-fixture.cjs');

const drawn=f=>[...new Set(f.writes.filter(w=>w.el===f.node&&w.key==='transform').map(w=>w.t))];
const nearly=(actual,expected,tolerance,message)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} vs ${expected} (tolerance ${tolerance})`);
for(const hz of [60,144,240])test(`walk and trot draw at the 24fps film cadence on a ${hz}Hz display`,()=>{
 for(const trot of [false,true]){const f=fixture({hz});f.startWalk(trot);f.clear();f.advance(2000);const frames=drawn(f);assert.ok(frames.length>=46&&frames.length<=49,`${trot?'trot':'walk'} drew ${frames.length} frames in 2 s`);assert.ok(f.rafCalls<=49,'movement does not wake on every display frame');assert.equal(f.node.dataset.pose,trot?'trot':'walk');f.controller.destroy();}
});
test('walk/trot speeds follow elapsed seconds, including a delayed callback',()=>{
 for(const trot of [false,true]){const f=fixture(),start=f.startWalk(trot),v=trot?58:26;f.advance(1000);f.stall(240);f.advance(1760);nearly(f.node._x-start,v*3-v*v/(2*70),1.2,'distance after 3 real seconds');assert.ok(drawn(f).length<=73,'no burst of paints to catch up');f.controller.destroy();}
});
test('walks reuse cached geometry and collision checks between invalidations',()=>{
 const f=fixture();f.startWalk();f.clear();f.advance(1200);assert.deepEqual(f.reads,{rect:0,style:0,hit:0,range:0,offset:0});f.controller.destroy();
});
test('scroll, resize, ResizeObserver and layout mutations refresh geometry and follow the same ledge',()=>{
 const f=fixture();f.startWalk();for(const invalidate of [()=>f.win.emit('scroll'),()=>f.container.emit('scroll'),()=>f.win.emit('resize'),()=>f.doc.fonts.emit('loadingdone'),()=>f.resize(),()=>f.mutate([{type:'attributes',attributeName:'style',target:f.panels[0]}]),()=>f.mutate([{type:'childList',target:f.container,addedNodes:[],removedNodes:[]}])]){
  f.panels[0].rect.top+=13;f.panels[0].rect.bottom+=13;f.clear();invalidate();assert.equal(f.reads.rect,0);f.paint();assert.equal(f.reads.rect,0,'the click frame paints before measurement');f.advance(0);assert.equal(f.node._y,f.panels[0].rect.top+1,'the pony follows the changed ledge after paint');assert.ok(f.reads.rect>0,'invalidation measures geometry');f.clear();f.advance(150);assert.equal(f.reads.rect,0,'subsequent movement frames reuse the snapshot');
 }f.controller.destroy();
});
test('own rig/bubble events and mutations do not invalidate the page geometry cache',()=>{
 const f=fixture();f.startWalk();f.clear();f.container.emit('scroll',{target:f.node});f.mutate([{type:'attributes',attributeName:'style',target:f.node.children[0]},{type:'attributes',attributeName:'data-pose',target:f.node}]);f.advance(200);assert.equal(f.reads.rect,0);f.controller.destroy();
});
test('pose easing is painted on the film clock with the existing real-time rates',()=>{
 const f=fixture();f.controller.setFocus(true);f.advance(400);f.clear();f.advance(1000);const p=cls=>f.node.children.find(n=>n.className===cls);nearly(parseFloat(p('pet-head').style.transform.slice(7)),14*(1-Math.pow(1-5/60,60)),.08,'head easing');nearly(parseFloat(p('pet-up').style.transform.slice(11)),11.5*(1-Math.pow(1-4.2/60,60)),.15,'body easing');assert.ok(new Set(f.writes.filter(w=>w.el===p('pet-head')&&w.key==='transform').map(w=>w.t)).size<=25,'pose easing uses the film cadence');f.controller.destroy();
});
test('jump paths and duration are clocked in seconds without reading the target each frame',()=>{
 const f=fixture({extra:true});f.advance(1400);f.random(.22,...Array(9).fill(.5));f.advance(6000);const start={x:f.node._x,y:f.node._y};f.clear();f.advance(400);assert.equal(f.node.dataset.pose,'fall');assert.ok(f.node._y<start.y+400,'the jump is still in flight');assert.equal(f.reads.rect,0,'jump target is cached');assert.ok(drawn(f).length<=10,'jump is drawn at 24fps');f.advance(700);assert.equal(f.node._y,601,'the same destination is reached at the existing speed');f.controller.destroy();
});
test('an open bubble follows movement without offsetWidth/offsetHeight reads each frame',()=>{
 const f=fixture({extra:true});f.advance(1400);f.random(.22,...Array(9).fill(.5));f.advance(6000);f.controller.say('A synthetic reminder');f.clear();f.advance(500);assert.equal(f.reads.offset,0,'bubble size is cached');assert.equal(f.reads.rect,0,'movement stays layout-free');f.controller.destroy();
});
test('hidden tabs pause movement and resume without replaying hidden time',()=>{
 const f=fixture(),start=f.startWalk();f.advance(500);f.doc.hidden=true;f.doc.emit('visibilitychange');const x=f.node._x;f.clear();f.advance(5000);assert.equal(f.node._x,x);assert.equal(f.writes.length,0,'hidden movement and easing write nothing');f.doc.hidden=false;f.doc.emit('visibilitychange');f.advance(500);assert.ok(f.node._x>x&&f.node._x-x<16,'only visible elapsed time is simulated');assert.ok(f.node._x>start);f.controller.destroy();
});
test('unmount/destroy cancel movement, observers, geometry refreshes and held-pointer callbacks',()=>{
 const f=fixture();f.startWalk();f.resize();const old=f.node;old.emit('pointerdown',{button:0,pointerId:1,clientX:old._x,clientY:old._y});old.emit('pointermove',{pointerId:1,clientX:old._x+50,clientY:old._y});f.setPet({enabled:false});assert.equal(f.node,undefined);f.clear();f.advance(10000);assert.equal(f.writes.length,0);assert.equal(f.timers.size,0,'no callback survives unmount');assert.ok(f.resizes.every(o=>!o.nodes.size));assert.ok(f.mutations.every(o=>!o.target));f.setPet({enabled:true});const fresh=f.node,x=fresh._x;old.emit('pointermove',{pointerId:1,clientX:900,clientY:400});old.emit('pointerup',{pointerId:1,clientX:900,clientY:400});assert.equal(fresh._x,x,'detached pointer callbacks cannot move the new pony');f.controller.destroy();f.clear();f.advance(10000);assert.equal(f.timers.size,0);assert.equal(f.writes.length,0);
});

test('external invalidation promptly moves a resting pony off inserted controls or text, before any movement write',()=>{
 for(const kind of ['control','text']){const f=fixture();f.advance(1400);const x=f.node._x,y=f.node._y,used=new f.Element('used');used.rect=f.box(x-40,y-60,80,60);used.control=kind==='control';if(kind==='text')used.childNodes=[{nodeType:3,textContent:'Synthetic assignment title',rect:used.rect}];f.blockers.push(used);f.panels[0].append(used);f.random(...Array(9).fill(.8));f.clear();f.mutate([{type:'childList',target:f.panels[0],addedNodes:[used],removedNodes:[]}]);f.advance(150);assert.ok(f.reads.hit>0,'external layout invalidation rechecks occupancy');assert.ok(f.node._x>x+.1,'it leaves immediately, without waiting for the next decision');const firstWrite=f.trace.findIndex(t=>t.kind==='write'&&t.el===f.node&&t.key==='transform'),lastHit=f.trace.findLastIndex(t=>t.kind==='read'&&t.read==='hit');assert.ok(lastHit>=0&&firstWrite>lastHit,'collision reads precede movement writes');f.clear();f.advance(1000);assert.equal(f.reads.hit,0,'movement does not repeat collision hit tests');f.controller.destroy();}
});
test('reduced motion also clears a new obstruction promptly without starting a walk',()=>{
 const f=fixture();f.container.dataset.motionStyle='off';f.advance(1400);const x=f.node._x,used=new f.Element('control');used.control=true;used.rect=f.box(x-40,f.node._y-60,80,60);f.blockers.push(used);f.panels[0].append(used);f.random(...Array(9).fill(.8));f.mutate([{type:'childList',target:f.panels[0],addedNodes:[used],removedNodes:[]}]);f.postpaint();assert.ok(f.node._x>x+100,'the occupied spot is cleared immediately after paint');assert.notEqual(f.node.dataset.pose,'walk');f.controller.destroy();
});
test('a pony created in a hidden tab initializes safely and starts only after visibility returns',()=>{
 const f=fixture({hidden:true});f.clear();f.advance(3000);assert.equal(f.writes.length,0);f.doc.hidden=false;f.doc.emit('visibilitychange');f.advance(1000);assert.ok(Number.isFinite(f.node._x));assert.equal(f.node._y,301);f.controller.destroy();
});
test('geometry invalidation during a drag does not snap the released pony back before its drop',()=>{
 const f=fixture(),n=f.node;n.emit('pointerdown',{button:0,pointerId:7,clientX:n._x,clientY:n._y});n.emit('pointermove',{pointerId:7,clientX:1050,clientY:150});f.panels[0].rect.top+=50;f.panels[0].rect.bottom+=50;f.clear();f.win.emit('resize');n.emit('pointerup',{pointerId:7,clientX:1050,clientY:150});assert.equal(f.reads.rect,0,'drop selection uses the previous snapshot until paint');assert.equal(n._x,1050,'release starts at the held coordinates');f.advance(500);assert.equal(n._x,1050);assert.equal(n._y,351);f.controller.destroy();
});
test('the cached candidates retain framed modules, top/bottom rules, paddocks, and the viewport floor',()=>{
 for(const [options,y]of [[{},301],[{frame:'none'},995],[{frame:'none',rule:'top'},451],[{frame:'none',rule:'bottom'},490],[{frame:'none',rule:'transparent'},995],[{paddock:true,roam:'home'},823]]){const f=fixture(options);assert.equal(f.node._y,y,JSON.stringify(options));f.controller.destroy();}
});
test('cached ledges still reject destinations covering controls and text',()=>{
 for(const kind of ['control','text']){const f=fixture(),used=new f.Element('used');used.rect=f.box(950,235,100,80);used.control=kind==='control';if(kind==='text')used.childNodes=[{nodeType:3,textContent:'Synthetic assignment',rect:used.rect}];f.blockers.push(used);f.advance(1400);f.random(.1,.65,.8,...Array(7).fill(.65));f.advance(6000);f.advance(17000);nearly(f.node._x,1200.8,.01,'the blocked first destination is skipped');assert.ok(f.reads.hit>0);if(kind==='text')assert.ok(f.reads.range>0);f.controller.destroy();}
});
test('multiple external invalidations coalesce and an ancestor style change refreshes the same cache',()=>{
 const f=fixture();f.startWalk();f.panels[0].rect.top+=20;f.panels[0].rect.bottom+=20;f.clear();f.win.emit('scroll');f.win.emit('resize');f.resize();f.mutate([{type:'attributes',attributeName:'class',target:f.host}]);assert.equal(f.rafCalls,1,'one postpaint frame coalesces all invalidations');f.paint();f.resize();assert.equal(f.rafCalls,1,'invalidations between rAF and its task also coalesce');assert.equal(f.reads.rect,0);f.advance(0);assert.equal(f.reads.rect,1,'one rectangle measurement per changed element');assert.equal(f.node._y,321);f.clear();f.advance(250);assert.equal(f.reads.rect,0);f.controller.destroy();
});
test('detached initial event handlers and already queued observer deliveries cannot affect a remount',()=>{
 const f=fixture(),old=f.node,resize=f.resizes[0].fn,mutate=f.mutations[0].fn;f.setPet({enabled:false});assert.ok([...old.events.values()].every(s=>!s.size),'all detached pony handlers are removed');f.setPet({enabled:true});f.clear();resize([{target:f.panels[0]}]);mutate([{type:'attributes',target:f.panels[0]}]);f.advance(1);assert.equal(f.reads.rect,0,'old observer generations are ignored');f.controller.destroy();
});
test('idle CSS reels keep their existing 24/12/6 cadence and stop after two minutes',()=>{
 const f=fixture();let times=[],pauses=0;const loop={animationName:'pet-tail',playState:'running',effect:{getTiming:()=>({duration:3400,iterations:Infinity}),getKeyframes:()=>[{computedOffset:0,transform:'rotate(5deg)'},{computedOffset:1,transform:'rotate(-7deg)'}]},pause(){pauses++;this.playState='paused';},set currentTime(v){times.push({at:f.clock,time:v});},get currentTime(){return 0;}},finite={...loop,animationName:'pet-show',effect:{getTiming:()=>({duration:300,iterations:1})},pause(){throw Error('finite animation must remain native');}};f.animations.push(loop,finite);f.node.emit('animationstart');f.advance(1500);assert.equal(pauses,1);times=[];f.advance(1000);assert.ok(times.length>=23&&times.length<=25);f.advance(3501);times=[];f.advance(2000);assert.ok(times.length>=23&&times.length<=25,'quiet reel is 12fps');f.advance(18000);times=[];f.advance(2000);assert.ok(times.length>=11&&times.length<=13,'long-idle reel is 6fps');f.advance(93000);times=[];f.advance(2000);assert.equal(times.length,0,'two-minute idle reel is held');f.doc.emit('pointermove');assert.ok(times.length>0,'input restarts the existing reel');f.controller.destroy();
});

test('an initial floor obstruction cannot start an evacuation before home establishes the pony position',()=>{
 const f=fixture({initialBlocker:true}),x=f.node._x;assert.equal(f.node._y,301);f.advance(1200);assert.equal(f.node._x,x);assert.equal(f.node._y,301);assert.equal(f.node.dataset.pose,'stand');f.controller.destroy();
});
test('a jump revalidates an obstruction added mid-flight once at landing and moves off promptly',()=>{
 const f=fixture({extra:true});f.advance(1400);f.random(.22,...Array(9).fill(.5));f.advance(6000);f.advance(400);const used=new f.Element('target control');used.control=true;used.rect=f.box(760,541,80,60);f.blockers.push(used);f.panels[1].append(used);f.mutate([{type:'childList',target:f.panels[1],addedNodes:[used],removedNodes:[]}]);f.advance(1);f.random(...Array(9).fill(.8));f.clear();f.advance(150);assert.equal(f.reads.hit,0,'no per-frame collision tests during the flight');f.advance(750);assert.ok(f.reads.hit>0,'the landing is revalidated');assert.ok(f.node._x>800+1,'it does not rest on the newly occupied landing');f.clear();f.advance(200);assert.equal(f.reads.hit,0,'the evacuation walk has no per-frame hit tests');assert.equal(f.reads.rect,0);f.controller.destroy();assert.equal(f.timers.size,0,'landing recovery leaves no uncancelled clock');
});
test('appearing alpha and moving neck/legs retain their elapsed-time easing on the film clock',()=>{
 const f=fixture({extra:true});f.panels[0].rect.top=-200;f.panels[0].rect.bottom=150;f.win.emit('scroll');f.advance(1400);f.clear();f.advance(500);nearly(Number(f.node.style.opacity),1-Math.pow(1-3.2/60,30),.02,'appearance alpha');assert.ok(new Set(f.writes.filter(w=>w.el===f.node&&w.key==='opacity').map(w=>w.t)).size<=12);f.controller.destroy();
 const walk=fixture(),start=walk.startWalk();walk.advance(2000);const leg=walk.node.children.find(n=>n.className==='lf'),neck=walk.node.children.find(n=>n.className==='pet-neck'),angle=parseFloat(leg.style.transform.slice(7));nearly(angle,Math.sin((walk.node._x-start)*21.9/58)*21,.02,'feet keep their ground-distance phase');nearly(parseFloat(neck.style.transform.slice(7)),9+angle*.12,.02,'neck follows the same eased leg swing');walk.controller.destroy();
});

test('a walk endpoint rechecks a control added after the destination was selected',()=>{
 const f=fixture();f.startWalk();f.advance(1000);const used=new f.Element('destination control');used.control=true;used.rect=f.box(960,241,80,60);f.blockers.push(used);f.panels[0].append(used);f.mutate([{type:'childList',target:f.panels[0],addedNodes:[used],removedNodes:[]}]);f.advance(1);f.random(...Array(9).fill(.8));f.clear();f.advance(5000);assert.equal(f.reads.hit,0,'there is no per-frame destination polling');f.advance(3000);assert.ok(f.reads.hit>0,'arrival is revalidated');assert.ok(f.node._x>1001,'the pony moves off instead of resting on the new control');f.controller.destroy();assert.equal(f.timers.size,0,'recovery owns only one cancellable film clock');
});
test('decisions and input follow checks cannot force dirty geometry before the postpaint task',()=>{
 for(const [observers,at]of [[true,1399],[false,499]]){const f=fixture({observers});if(!observers)f.doc.emit('pointermove');f.advance(at);f.panels[0].rect.top+=20;f.panels[0].rect.bottom+=20;f.clear();f.win.emit('resize');f.advance(1);assert.equal(f.reads.rect,0,'pending decisions/following use cached places');f.paint();assert.equal(f.reads.rect,0,'rAF itself does not measure');f.advance(0);assert.equal(f.reads.rect,1);assert.equal(f.node._y,321);f.controller.destroy();}
});
test('hidden, unmounted and destroyed ponies cancel both stages of the geometry refresh',()=>{
 for(const stage of ['frame','task'])for(const action of ['hidden','unmount','destroy']){const f=fixture();f.win.emit('resize');if(stage==='task')f.paint();const queued=[...f.timers.values()].find(t=>stage==='frame'?t.kind==='raf':t.at===f.clock);assert.ok(queued,'the cancellable '+stage+' stage is queued');const stale=queued.fn;f.clear();if(action==='hidden'){f.doc.hidden=true;f.doc.emit('visibilitychange');}else if(action==='unmount')f.setPet({enabled:false});else f.controller.destroy();f.clear();f.advance(1000);assert.equal(f.reads.rect,0,stage+' '+action);if(action==='hidden'){stale();assert.equal(f.reads.rect,0);f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(f.reads.rect,0,'wake also yields until paint');f.postpaint();assert.equal(f.reads.rect,1);}else if(action==='unmount'){f.setPet({enabled:true});f.clear();stale();f.advance(1);assert.equal(f.reads.rect,0,'a stale refresh cannot measure the remounted pony');}f.controller.destroy();assert.equal(f.timers.size,0);}
});
test('roll caches animation enumeration while the pony and pose are unchanged',()=>{
 const f=fixture();let times=[],pauses=0;const loop={animationName:'pet-tail',playState:'running',effect:{getTiming:()=>({duration:3400,iterations:Infinity}),getKeyframes:()=>[{computedOffset:0,transform:'rotate(5deg)'},{computedOffset:1,transform:'rotate(-7deg)'}]},pause(){this.playState='paused';pauses++;},get currentTime(){return 17;},set currentTime(v){times.push(v);}};f.animations.push(loop);f.node.emit('animationstart');f.advance(1500);assert.equal(pauses,1);f.clear();times=[];f.advance(200);assert.equal(f.enumerations,0,'24fps ticks reuse the discovered loops');assert.equal(f.layoutEnumerations,0,'unchanged ticks do not enumerate ledge animations either');assert.ok(times.length>=4);nearly(times.at(-1)-times[0],(times.length-1)*1000/24,.001,'cached loops retain elapsed time');f.mutate([{type:'attributes',attributeName:'style',target:f.node.children[0]}]);f.advance(100);assert.equal(f.enumerations,0,'rig transform writes do not enumerate');f.controller.destroy();
});
test('roll rediscovers loops after pose, DOM, visibility, motion settings and remount changes',()=>{
 const f=fixture();let oldTimes=[],newTimes=[];const loop=times=>({animationName:'pet-tail',playState:'running',effect:{getTiming:()=>({duration:3400,iterations:Infinity}),getKeyframes:()=>[{computedOffset:0,transform:'rotate(5deg)'},{computedOffset:1,transform:'rotate(-7deg)'}]},pause(){this.playState='paused';},get currentTime(){return 0;},set currentTime(v){times.push(v);}});f.animations.push(loop(oldTimes));f.node.emit('animationstart');f.advance(1500);f.animations.splice(0,1,loop(newTimes));f.node.innerHTML='<svg></svg>';f.mutate([{type:'childList',target:f.node,addedNodes:f.node.children,removedNodes:[]}]);f.clear();const oldCount=oldTimes.length;f.advance(100);assert.equal(f.enumerations,1,'a replaced rig refreshes the animation list once');assert.equal(oldTimes.length,oldCount,'detached animations leave the reel');assert.ok(newTimes.length>0);f.controller.setFocus(true);f.clear();f.advance(500);assert.ok(f.enumerations>0,'a new pose discovers its loops');f.advance(3000);f.clear();f.advance(500);assert.equal(f.enumerations,0,'settled pose ticks stay cached');f.container.dataset.motionStyle='off';f.setPet({});f.clear();f.advance(100);assert.equal(f.enumerations,0,'reduced motion does not enumerate disabled loops');f.container.dataset.motionStyle='full';f.setPet({});f.doc.hidden=true;f.doc.emit('visibilitychange');f.clear();f.advance(1000);assert.equal(f.enumerations,0);f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(f.enumerations,1,'wake rediscovers rebuilt CSS animations');f.setPet({enabled:false});f.clear();f.setPet({enabled:true});assert.equal(f.enumerations,0,'remount queues the cache refresh');f.advance(0);assert.equal(f.enumerations,1,'remount starts a fresh animation cache');assert.equal(f.layoutEnumerations,3,'remount separately discovers finite ledge/ancestor animations');f.controller.destroy();
});

function layoutAnimation(el){
 let finish,cancel;const finished=new Promise((yes,no)=>{finish=yes;cancel=no;}),a={playState:'running',finished,effect:{target:el,getTiming:()=>({duration:260,iterations:1})},finish(){this.playState='finished';finish();},cancel(){this.playState='idle';cancel(Error('cancelled layout animation'));}};finished.catch(()=>{});el.layoutAnimations=[a];return a;
}
for(const ancestor of [false,true])for(const end of ['finish','cancel'])test('a moving ledge refreshes after its finite WAAPI animation settles: '+JSON.stringify({ancestor,end}),async()=>{
 const f=fixture();f.startWalk();const a=layoutAnimation(ancestor?f.host:f.panels[0]);f.panels[0].rect.top=340;f.panels[0].rect.bottom=690;f.mutate([{type:'attributes',attributeName:'style',target:ancestor?f.host:f.panels[0]}]);f.postpaint();assert.equal(f.node._y,341);f.clear();f.advance(150);assert.equal(f.reads.rect,0,'movement frames retain their snapshot');f.panels[0].rect.top=390;f.panels[0].rect.bottom=740;a[end]();await Promise.resolve();await Promise.resolve();assert.equal(f.reads.rect,0,'animation completion only schedules measurement');f.postpaint();assert.equal(f.node._y,391,'a walking pony follows the final ledge geometry');assert.equal(f.reads.rect,1);assert.equal(f.layoutEnumerations,3,'each ledge/ancestor is checked once per geometry refresh');f.clear();f.advance(200);assert.equal(f.reads.rect,0,'settled geometry is reused without polling');assert.equal(f.layoutEnumerations,0,'movement frames do not poll layout animations');f.controller.destroy();assert.equal(f.timers.size,0);
});
for(const event of ['transitionend','transitioncancel','animationend','animationcancel'])test('a moving ledge refreshes when its CSS motion settles: '+event,()=>{
 const f=fixture();f.startWalk();f.panels[0].rect.top+=70;f.panels[0].rect.bottom+=70;f.clear();f.container.emit(event,{target:f.panels[0]});assert.equal(f.reads.rect,0);f.postpaint();assert.equal(f.node._y,371);assert.equal(f.reads.rect,1);f.clear();f.advance(200);assert.equal(f.reads.rect,0);f.controller.destroy();
});
for(const jump of [false,true])test('each planned move rechecks current and destination ledges even without a resize or mutation: '+(jump?'jump':'walk'),()=>{
 const f=fixture({extra:jump});f.advance(7399);const ledge=f.panels[jump?1:0];ledge.rect.top+=jump?50:100;ledge.rect.bottom+=jump?50:100;f.random(jump?.22:.1,...Array(9).fill(jump?.5:.65));f.clear();f.advance(1001);assert.equal(f.node._y,jump?651:401,'the move uses the freshly measured ledge');assert.equal(f.reads.rect,jump?2:1,'geometry is rechecked once for the decision');f.clear();f.advance(200);assert.equal(f.reads.rect,0,'no movement frame measures layout');f.controller.destroy();
});
test('a planned move waits for dirty geometry to paint instead of starting from the stale ledge',()=>{
 const f=fixture({hz:1});f.advance(7399);f.panels[0].rect.top=410;f.panels[0].rect.bottom=760;f.random(.1,...Array(9).fill(.65));f.clear();f.win.emit('resize');f.advance(100);assert.equal(f.reads.rect,0);assert.notEqual(f.node.dataset.pose,'walk','the old snapshot cannot start a planned walk');assert.notEqual(f.node.dataset.pose,'trot');f.postpaint();assert.equal(f.node._y,411);f.clear();f.advance(100);assert.equal(f.node.dataset.pose,'walk','the postponed decision runs after refresh');assert.equal(f.reads.rect,0);f.controller.destroy();
});
test('settled animation callbacks from a previous mount cannot invalidate the replacement pony',async()=>{
 const f=fixture();const a=layoutAnimation(f.panels[0]);f.win.emit('resize');f.postpaint();f.setPet({enabled:false});f.panels[0].layoutAnimations=[];f.setPet({enabled:true});f.advance(100);f.clear();a.finish();await Promise.resolve();await Promise.resolve();f.advance(100);assert.equal(f.reads.rect,0,'the previous animation cannot schedule geometry work for the new mount');f.controller.destroy();
});

test('a jump launches from the current ledge after an unobserved source position change',()=>{
 const f=fixture({extra:true});f.advance(7399);f.panels[0].rect.top=400;f.panels[0].rect.bottom=750;f.random(.22,...Array(9).fill(.5));f.advance(1);assert.equal(f.node._y,401,'the source pose follows the ledge before takeoff');f.clear();f.advance(400);assert.equal(f.reads.rect,0,'takeoff does not remeasure layout');f.advance(700);assert.equal(f.node._y,601);f.controller.destroy();
});
test('finite animation completion cannot schedule geometry after destroy',async()=>{
 const f=fixture(),a=layoutAnimation(f.panels[0]);f.win.emit('resize');f.postpaint();f.controller.destroy();f.clear();a.finish();await Promise.resolve();await Promise.resolve();f.advance(100);assert.equal(f.reads.rect,0);assert.equal(f.timers.size,0);
});

test('cosmetic workspace metadata and focus-clock ticks do not rescan pony geometry',t=>{
 const f=fixture();t.after(()=>teardown(f));
 const row=new f.Element('rd-quick-row',{quickIndex:'0'}),clock=new f.Element('rd-focus-clock',{rdFocusClock:''});
 f.container.append(row);f.container.append(clock);f.clear();
 for(let i=0;i<20;i++){
  const text={nodeType:3,parentElement:clock,parentNode:clock,textContent:'24:59'};
  f.mutate([
   {type:'attributes',attributeName:'aria-selected',target:row},
   ...['aria-label','aria-activedescendant','title','tabindex'].map(attributeName=>({type:'attributes',attributeName,target:f.panels[0]})),
   {type:'characterData',target:text,oldValue:'25:00'},
   {type:'childList',target:clock,addedNodes:[text],removedNodes:[{nodeType:3,textContent:'25:00'}]}
  ]);
  f.advance(50);
 }
 assert.equal(f.scans,0);assert.equal(f.reads.rect,0);assert.equal(f.rafCalls,0);
});

test('geometry attributes, ordinary text, clock visibility and clock width changes still invalidate',t=>{
 const f=fixture();t.after(()=>teardown(f));
 const clock=new f.Element('rd-focus-clock',{rdFocusClock:''});f.container.append(clock);
 const cases=[
  ...['style','class','hidden','open','data-pet-ledge','data-arrange-key','aria-hidden','aria-expanded','aria-selected','role'].map(attributeName=>({type:'attributes',attributeName,target:f.panels[0]})),
  {type:'attributes',attributeName:'data-panel-frame',target:f.container},
  {type:'attributes',attributeName:'style',target:f.host},
  {type:'attributes',attributeName:'hidden',target:clock},
  {type:'characterData',oldValue:'Old title',target:{nodeType:3,parentElement:f.panels[0],parentNode:f.panels[0],textContent:'A longer title'}},
  {type:'characterData',oldValue:'99:59',target:{nodeType:3,parentElement:clock,parentNode:clock,textContent:'100:00'}},
  {type:'childList',target:clock,addedNodes:[{nodeType:3,textContent:'Done'}],removedNodes:[{nodeType:3,textContent:'00:00'}]}
 ];
 for(const record of cases){
  f.panels[0].rect.top++;f.panels[0].rect.bottom++;f.clear();f.mutate([record]);
  assert.equal(f.reads.rect,0);f.postpaint();
  assert.equal(f.scans,1,record.attributeName||record.type);
  assert.equal(f.node._y,f.panels[0].rect.top+1);
 }
});

for(const options of [{},{motion:'off'},{motion:'still'},{mediaReduced:true},{observers:false}])test('empty pony reels and ledge following stay asleep without input: '+JSON.stringify(options),t=>{
 const f=fixture(options);t.after(()=>teardown(f));f.clear();f.advance(1000);
 assert.equal(f.callbacks,0,'no empty reel or periodic follow callback');
 assert.equal(f.scans,0);assert.equal(f.reads.rect,0);
});

function reelAnimation(f,times){
 let time=0;
 return {animationName:'pet-tail',playState:'running',
  effect:{getTiming:()=>({duration:3400,iterations:Infinity}),getKeyframes:()=>[
   {computedOffset:0,transform:'rotate(5deg)'},{computedOffset:1,transform:'rotate(-7deg)'}
  ]},
  pause(){this.playState='paused';},get currentTime(){return time;},
  set currentTime(value){time=value;times.push({at:f.clock,time:value});}};
}

test('the first reel enumerates at 1500ms after mount and animation events do not restart the wait',t=>{
 const f=fixture(),times=[];t.after(()=>teardown(f));f.animations.push(reelAnimation(f,times));
 assert.equal(f.enumerations,0,'mount leaves the authored CSS animations running');
 f.advance(1000);f.node.emit('animationstart');f.advance(499);
 assert.equal(f.enumerations,0,'animation enumeration waits through 1499ms');assert.equal(times.length,0,'the film clock has not written animation time');
 f.advance(1);assert.equal(f.enumerations,1,'the first enumeration runs at 1500ms after mount');assert.deepEqual(times,[{at:1500,time:0}]);
 f.advance(42);assert.equal(f.enumerations,1,'the next frame uses the discovered animation cache');assert.equal(times.length,2);nearly(times[1].time,1000/24,.001,'the first active interval keeps the 24fps cadence');
});

test('an empty reel resumes on animationstart and stops when its last loop is cancelled or finishes',t=>{
 for(const state of ['idle','finished']){
  const f=fixture();t.after(()=>teardown(f));f.advance(1500);assert.equal(f.enumerations,1,'the initial empty reel has completed');
  const times=[],animation=reelAnimation(f,times);f.animations.push(animation);
  f.node.emit('animationstart');f.advance(100);
  assert.ok(times.length>=2,'a dormant reel discovers the new loop');
  animation.playState=state;f.node.emit(state==='idle'?'animationcancel':'animationend');f.advance(50);
  f.clear();const before=times.length;f.advance(100);
  assert.equal(times.length,before);assert.equal(f.callbacks,0,'a dead last loop leaves no ticking reel');
  f.animations.splice(0,1,reelAnimation(f,times));f.node.emit('animationstart');f.advance(50);
  assert.ok(times.length>before,'replacement loops wake the clock');
 }
});

test('reduced motion stops active reels and both workspace and OS motion changes resume them',t=>{
 for(const mode of ['off','still','media']){
  const f=fixture(),times=[];t.after(()=>teardown(f));
  f.animations.push(reelAnimation(f,times));f.node.emit('animationstart');f.advance(1500);assert.ok(times.length>0);
  if(mode==='media'){f.motionMedia.matches=true;f.motionMedia.emit('change');}
  else{f.container.dataset.motionStyle=mode;f.mutate([{type:'attributes',attributeName:'data-motion-style',target:f.container}]);}
  f.advance(50);f.clear();const before=times.length;f.advance(1000);
  assert.equal(times.length,before,mode+' writes no animation time');
  assert.equal(f.callbacks,0,mode+' leaves no periodic reel or follow timer');assert.equal(f.node.dataset.still,'true');
  if(mode==='media'){f.motionMedia.matches=false;f.motionMedia.emit('change');}
  else{f.container.dataset.motionStyle='full';f.mutate([{type:'attributes',attributeName:'data-motion-style',target:f.container}]);}
  f.advance(100);assert.ok(times.length>before,mode+' resumes animation');assert.equal(f.node.dataset.still,'false');
 }
});

for(const observers of [true,false])test('input wakes a single follow check and recovers unobserved ledge movement: '+observers,t=>{
 const f=fixture({observers});t.after(()=>teardown(f));
 f.panels[0].rect.top+=20;f.panels[0].rect.bottom+=20;f.clear();
 for(let i=0;i<100;i++)f.doc.emit('pointermove');f.doc.emit('input');f.advance(499);
 assert.equal(f.reads.rect,0,'input does not synchronously measure layout');f.advance(30);
 assert.equal(f.node._y,321);assert.equal(f.scans,1,'one postpaint scan serves the input burst');
 f.clear();f.advance(400);assert.equal(f.reads.rect,0,'no idle follow timer is rearmed');
});

test('hidden and unmounted ponies cancel input follow wakeups and dormant reel restarts',t=>{
 const f=fixture();t.after(()=>teardown(f));
 const staleMedia=[...f.motionMedia.events.get('change')||[]][0];
 f.doc.emit('pointermove');f.node.emit('animationstart');f.setPet({enabled:false});
 assert.equal(f.timers.size,0);assert.equal(f.listenerCount,0);
 f.setPet({enabled:true});f.clear();staleMedia?.({type:'change'});f.advance(1);
 assert.equal(f.reads.rect,0);assert.equal(f.enumerations,0,'a detached media listener cannot restart the replacement pony');
 f.doc.emit('pointermove');f.doc.hidden=true;f.doc.emit('visibilitychange');f.clear();f.advance(1000);
 assert.equal(f.callbacks,0);f.doc.hidden=false;f.doc.emit('visibilitychange');f.postpaint();assert.equal(f.node._y,301);
});

test('cancelled follow and reel callbacks cannot restart a hidden or replacement pony',t=>{
 for(const started of [false,true])for(const action of ['hide','remount']){
  const f=fixture();t.after(()=>teardown(f));if(started)f.advance(1500);
  f.doc.emit('pointermove');f.node.emit('animationstart');
  const follow=[...f.timers.values()].find(timer=>timer.at===f.clock+500)?.fn;
  const reel=[...f.timers.values()].find(timer=>timer.at===f.clock+(started?0:1500))?.fn;
  assert.ok(follow&&reel,'both one-shot callbacks are queued');
  if(action==='hide'){f.doc.hidden=true;f.doc.emit('visibilitychange');}
  else{f.setPet({enabled:false});f.setPet({enabled:true});if(started)f.advance(0);}
  const count=f.timers.size;f.clear();follow();reel();f.advance(1);
  assert.equal(f.scans,0);assert.equal(f.enumerations,0);assert.equal(f.timers.size,count);
  if(action==='hide'){f.advance(2000);assert.equal(f.enumerations,0);assert.equal(f.callbacks,0,'a hidden pony stays asleep beyond the cancelled deadline');assert.equal(f.timers.size,0);}
  else if(!started){f.advance(1498);assert.equal(f.enumerations,0,'the replacement keeps its own initial delay');reel();assert.equal(f.enumerations,0,'the cancelled callback cannot start the replacement');f.advance(1);assert.equal(f.enumerations,1,'the replacement starts only on its own 1500ms callback');}
  else{f.node.emit('animationstart');f.advance(0);assert.equal(f.enumerations,1,'a valid replacement callback still restarts immediately after the first reel');}
 }
});

test('a planned jump waits when every candidate on its destination is occupied',t=>{
 const f=fixture({extra:true});t.after(()=>teardown(f));f.advance(1400);
 const used=new f.Element('destination control');used.control=true;used.rect=f.box(0,535,1800,66);f.blockers.push(used);
 const start={x:f.node._x,y:f.node._y};f.random(.22,.5,...Array(9).fill(.5));f.clear();f.advance(7000);
 assert.equal(f.node._x,start.x);assert.equal(f.node._y,start.y);
 assert.equal(drawn(f).length,0,'an unsafe jump has no random fallback');assert.notEqual(f.node.dataset.pose,'fall');
});

test('evacuation waits when the current ledge, other ledges and viewport floor are all occupied',t=>{
 const f=fixture({extra:true});t.after(()=>teardown(f));f.advance(1400);
 for(const top of [235,535,930]){
  const used=new f.Element('occupied control');used.control=true;used.rect=f.box(0,top,1800,70);f.blockers.push(used);
 }
 const start={x:f.node._x,y:f.node._y};f.clear();f.win.emit('resize');f.advance(1000);
 assert.equal(f.node._x,start.x);assert.equal(f.node._y,start.y);
 assert.equal(drawn(f).length,0);assert.notEqual(f.node.dataset.pose,'fall');
});

test('evacuation uses the destination already checked instead of sampling it a second time',t=>{
 const f=fixture({extra:true});t.after(()=>teardown(f));f.advance(1400);
 for(const rect of [f.box(0,235,1800,66),f.box(0,535,950,66),f.box(1050,535,750,66)]){
  const used=new f.Element('occupied control');used.control=true;used.rect=rect;f.blockers.push(used);
 }
 f.random(...Array(9).fill(.5),...Array(9).fill(.65),...Array(10).fill(.1));
 f.win.emit('resize');f.advance(1300);
 nearly(f.node._x,1000.4,.01,'the previously checked destination is retained');assert.equal(f.node._y,601);
});

test('opening the existing menu pauses pet clocks and geometry work until it closes',t=>{
 const f=fixture(),times=[];t.after(()=>teardown(f));f.startWalk();f.advance(500);
 f.animations.push(reelAnimation(f,times));f.node.emit('animationstart');f.advance(50);
 f.doc.emit('pointermove');f.win.emit('resize');f.node.emit('click');
 const bubble=f.bubble,start={x:f.node._x,y:f.node._y},before=times.length;
 assert.equal(bubble.attrs.role,'menu','the public 3.2 menu keeps its existing semantics');
 assert.match(bubble.html,/data-pet-action="feed"/);assert.match(bubble.html,/data-pet-action="settings"/);
 assert.equal(f.node.attrs['aria-expanded'],'true');assert.equal(f.timers.size,0);
 f.clear();
 for(let i=0;i<10;i++){
  f.doc.emit('input');f.resize(f.container);
  f.mutate([{type:'attributes',attributeName:'style',target:f.panels[0]}]);f.advance(50);
 }
 assert.equal(f.callbacks,0);assert.equal(f.scans,0);assert.equal(f.reads.hit,0);assert.equal(times.length,before);
 assert.equal(f.node._x,start.x);assert.equal(f.node._y,start.y);
 f.node.emit('keydown',{key:'Escape',preventDefault(){}});assert.equal(f.bubble,undefined);
 assert.equal(bubble.events.get('click')?.size||0,0,'the detached menu has no event handler');
 f.clear();f.postpaint();f.advance(100);
 assert.equal(f.scans,1,'closing refreshes deferred geometry after paint');assert.ok(times.length>before,'CSS loops resume');
});

test('scroll and resize reposition an open menu once without collision checks or movement clocks',t=>{
 const f=fixture();t.after(()=>teardown(f));f.node.emit('click');
 for(const type of ['scroll','resize']){
  f.panels[0].rect.top+=20;f.panels[0].rect.bottom+=20;f.clear();f.win.emit(type);
  assert.equal(f.reads.rect,0);f.postpaint();assert.equal(f.node._y,f.panels[0].rect.top+1);
  assert.equal(f.scans,1);assert.equal(f.reads.hit,0);assert.equal(f.timers.size,0);
 }
});

test('menu visibility changes and teardown leave no pet timers or detached event listeners',t=>{
 for(const action of ['hide','unmount','destroy']){
  const f=fixture();t.after(()=>teardown(f));f.controller.say('A synthetic reminder');const oldBubble=f.bubble;
  f.node.emit('click');const oldNode=f.node,menu=f.bubble;
  assert.equal(oldBubble.events.get('click')?.size||0,0,'replacing a bubble detaches its listener');
  if(action==='hide'){
   f.doc.hidden=true;f.doc.emit('visibilitychange');f.doc.hidden=false;f.doc.emit('visibilitychange');
   f.clear();f.advance(3000);assert.equal(f.callbacks,0,'a visible menu remains paused after a tab wake');
  }else if(action==='unmount')f.setPet({enabled:false});
  else f.controller.destroy();
  teardown(f);assert.ok([...oldNode.events.values()].every(handlers=>!handlers.size));
  assert.ok([...menu.events.values()].every(handlers=>!handlers.size));
 }
});
