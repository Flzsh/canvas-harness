'use strict';
// The pony on the art film's ticks (pets.js onFilm, motion.js ReserveMotion.onFilmTick). On a clock of its own each pony
// frame was a whole-page frame of its own (Home idle: 47-48 main frames a second, 11-14 of them the pony's alone). While
// the film's clock runs, a reel or a walk step that falls due before the next tick is drawn on this one: the same frames
// at the same rates, one page frame for both. Deterministic fake DOM and clock (pony-fixture.cjs); no browser.
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./pony-fixture.cjs');

// A stand-in for motion.js's side: the listeners of ReserveMotion.onFilmTick.
function bus(){const subs=new Set();return {subs,api:{onFilmTick:fn=>{subs.add(fn);return ()=>{subs.delete(fn);};}}};}
// A film clock as Chrome runs setInterval(tick,1000/fps): every whole floor(1000/fps) ms (41 at 24, 83 at 12).
const clock=(fps,phase)=>({fps,every:Math.floor(1000/fps),phase,at:null});
// Plays ms of the fixture's time with the given clocks ticking (each keeps its phase across calls); returns the tick times.
function play(f,b,ms,clocks){
 const end=f.clock+ms,ticks=[];for(const c of clocks)if(c.at==null)c.at=f.clock+(c.phase??c.every);
 for(;;){const c=clocks.reduce((x,y)=>y.at<x.at?y:x);if(c.at>end)break;f.advance(c.at-f.clock);ticks.push(f.clock);for(const fn of [...b.subs])fn(f.clock,c.fps);c.at+=c.every;}
 f.advance(end-f.clock);return ticks;
}
// An endless CSS loop on the pony (its tail), as the reel finds it.
function loop(f,times){let time=0;return {animationName:'pet-tail',playState:'running',effect:{getTiming:()=>({duration:3400,iterations:Infinity}),getKeyframes:()=>[{computedOffset:0,transform:'rotate(5deg)'},{computedOffset:1,transform:'rotate(-7deg)'}]},pause(){this.playState='paused';},get currentTime(){return time;},set currentTime(v){time=v;times.push({at:f.clock,time:v});}};}
// The reel's writes over ms after warm ms; frames = the distinct moments the page draws (film ticks and pony writes).
// The first reel waits FIRST_REEL_MS (1.5 s) after the pony mounts, so every run warms up for 2 s first.
function reels({shared,clocks=[clock(24)],warm=2000,ms=2000}){
 const b=bus(),f=fixture(shared?{film:b.api}:{}),times=[];f.animations.push(loop(f,times));f.node.emit('animationstart');
 play(f,b,warm,clocks);times.length=0;const ticks=play(f,b,ms,clocks),on=new Set(ticks);
 const out={writes:times.length,onTicks:times.filter(w=>on.has(w.at)).length,frames:new Set([...ticks,...times.map(w=>w.at)]).size,subs:b.subs.size,times:[...times]};
 f.controller.destroy();out.left=b.subs.size;return out;
}
// (the reel's clock is the fixture's epoch + ms, a 13-digit number: equal to a thousandth of a millisecond)
const realTime=times=>times.every((w,i)=>!i||Math.abs((w.time-times[i-1].time)-(w.at-times[i-1].at))<1e-3);

test('reels draw on the film\'s ticks at the same 24 a second, so the page draws one frame for both instead of two',()=>{
 const alone=reels({shared:false}),shared=reels({shared:true});
 assert.ok(alone.writes>=46&&alone.writes<=50,`its own clock: ${alone.writes} reel frames in 2 s`);
 assert.ok(alone.frames>=85,`two clocks: ${alone.frames} page frames in 2 s`);
 assert.ok(shared.writes>=46&&shared.writes<=50,`on the film: still ${shared.writes} reel frames in 2 s`);
 assert.ok(shared.writes-shared.onTicks<=1,`${shared.writes-shared.onTicks} reel frames off the film's ticks`);
 assert.ok(shared.frames<=51,`one clock: ${shared.frames} page frames in 2 s`);
 assert.ok(realTime(shared.times),'each frame still shows the loop at the real time it is drawn');
 assert.deepEqual([shared.subs,shared.left],[1,0],'listening while mounted, not after destroy');
});

test('a film on twos keeps the pony\'s own rates: 24 a second while used (half on the film\'s ticks), 12 when quiet (all on them)',()=>{
 const used=reels({shared:true,clocks:[clock(12)]});
 assert.ok(used.writes>=46&&used.writes<=50,`${used.writes} reel frames in 2 s`);assert.ok(used.onTicks>=20,`${used.onTicks} of them on the film's ticks`);
 // no input for 7 s: the reel is at 12 (and the film on twos)
 const quiet=reels({shared:true,clocks:[clock(12)],warm:7000});
 assert.ok(quiet.writes>=23&&quiet.writes<=26,`${quiet.writes} quiet reel frames in 2 s`);assert.ok(quiet.writes-quiet.onTicks<=1,'all on the film\'s ticks');
 assert.ok(realTime(used.times)&&realTime(quiet.times));
});

test('a second clock ticking cannot make the pony draw faster than its own rate',()=>{
 for(const phase of [10,20,21,31]){
  const two=reels({shared:true,clocks:[clock(24),clock(24,phase)]});
  assert.ok(two.writes>=46&&two.writes<=51,`second clock ${phase} ms after the first: ${two.writes} reel frames in 2 s`);
 }
});

test('a walk draws at the same 24 a second, mostly on the film\'s ticks, covering the same ground',()=>{
 const run=shared=>{
  const b=bus(),f=fixture(shared?{film:b.api}:{}),c=[clock(24)],start=f.startWalk();f.clear();
  const ticks=play(f,b,2000,c),on=new Set(ticks),drawn=[...new Set(f.writes.filter(w=>w.el===f.node&&w.key==='transform').map(w=>w.t))];
  const out={drawn:drawn.length,onTicks:drawn.filter(t=>on.has(t)).length,moved:f.node._x-start,pose:f.node.dataset.pose};f.controller.destroy();return out;
 };
 const alone=run(false),shared=run(true);
 assert.ok(shared.drawn>=46&&shared.drawn<=49,`${shared.drawn} walk frames in 2 s`);assert.equal(shared.pose,'walk');
 assert.ok(shared.onTicks>=.75*shared.drawn,`${shared.onTicks} of ${shared.drawn} on the film's ticks`);
 assert.ok(Math.abs(shared.moved-alone.moved)<1.5,`the same distance in the same time: ${shared.moved.toFixed(2)} vs ${alone.moved.toFixed(2)} px`);
});

// Frame counts alone missed this: on a film on twos the walk took a tick early and kept its old grid, so it drew pairs
// 4-16 ms apart and then held 67-79 ms (12 visible frames a second at some phases). Every gap must be one whole frame.
test('a walk keeps an even 24 a second on a film at 24 or on twos, at any phase of the film\'s ticks',()=>{
 for(const fps of [24,12])for(const phase of [3,17,29,40]){
  const b=bus(),f=fixture({film:b.api}),start=f.startWalk();f.clear();play(f,b,2000,[clock(fps,phase)]);
  const drawn=[...new Set(f.writes.filter(w=>w.el===f.node&&w.key==='transform').map(w=>w.t))].sort((x,y)=>x-y),gaps=drawn.slice(1).map((t,i)=>t-drawn[i]);
  const label=`film ${fps} phase ${phase}: ${drawn.length} frames, gaps ${Math.min(...gaps).toFixed(1)}-${Math.max(...gaps).toFixed(1)} ms`;
  assert.ok(drawn.length>=46&&drawn.length<=49,label);assert.ok(Math.min(...gaps)>=40&&Math.max(...gaps)<=42.5,label);
  assert.ok(f.node._x-start>45,label+`, moved ${(f.node._x-start).toFixed(1)} px`);f.controller.destroy();
 }
});

test('hidden, Still and an unmounted pony take no film ticks; mounting again listens again',()=>{
 for(const setup of ['hidden','still']){
  const b=bus(),f=fixture({film:b.api}),times=[],c=[clock(24)];f.animations.push(loop(f,times));f.node.emit('animationstart');play(f,b,2000,c);assert.ok(times.length>10);
  if(setup==='hidden'){f.doc.hidden=true;f.doc.emit('visibilitychange');}
  else{f.container.dataset.motionStyle='still';f.mutate([{type:'attributes',attributeName:'data-motion-style',target:f.container}]);}
  f.advance(50);f.clear();times.length=0;play(f,b,1000,c);
  assert.equal(times.length,0,setup+': no reel frames on the film\'s ticks');assert.equal(f.writes.filter(w=>w.el===f.node&&w.key==='transform').length,0,setup+': no walk frames');
  f.controller.destroy();
 }
 const b=bus(),f=fixture({film:b.api});assert.equal(b.subs.size,1);
 f.setPet({enabled:false});assert.equal(b.subs.size,0,'unmounted: not listening');
 f.setPet({enabled:true});assert.equal(b.subs.size,1,'mounted again: one listener');
 f.controller.destroy();assert.equal(b.subs.size,0);
});

test('without the film (Living drawings off: motion.js not loaded) the pony keeps its own clock',()=>{
 const f=fixture(),times=[];f.animations.push(loop(f,times));f.node.emit('animationstart');f.advance(2000);times.length=0;f.advance(2000);
 assert.ok(times.length>=46&&times.length<=50,`${times.length} reel frames in 2 s`);f.controller.destroy();
});

// A reel is drawn at most half a film tick early. At 6 a second (no input for half a minute) on a film at 24, a reel
// allowed a whole tick early drew some frames 125-130 ms apart instead of about 167: a visible hitch in a slow loop.
test('a slow reel on a fast film lands at most half a tick early, at any phase of the film\'s ticks',()=>{
 for(const phase of [3,17,29,40]){
  const b=bus(),f=fixture({film:b.api}),times=[],c=[clock(24,phase)];f.animations.push(loop(f,times));f.node.emit('animationstart');
  play(f,b,30000,c);times.length=0;play(f,b,3000,c);
  const gaps=times.slice(1).map((w,i)=>w.at-times[i].at),label=`phase ${phase}: ${times.length} reel frames, gaps ${Math.min(...gaps)}-${Math.max(...gaps)} ms`;
  assert.ok(times.length>=16&&times.length<=19,label);
  assert.ok(Math.min(...gaps)>=1000/6-1000/24/2-1,label);assert.ok(Math.max(...gaps)<=1000/6+1000/24+1,label);
  f.controller.destroy();
 }
});

test('a reel keeps an even 24 a second on a film at 24 or on twos, at any phase of the film\'s ticks',()=>{
 for(const fps of [24,12])for(const phase of [3,17,29,40]){
  const b=bus(),f=fixture({film:b.api}),times=[],c=[clock(fps,phase)];f.animations.push(loop(f,times));f.node.emit('animationstart');
  play(f,b,2000,c);times.length=0;const ticks=new Set(play(f,b,2000,c));
  const gaps=times.slice(1).map((w,i)=>w.at-times[i].at),on=times.filter(w=>ticks.has(w.at)).length,label=`film ${fps} phase ${phase}: ${times.length} reel frames (${on} on ticks), gaps ${Math.min(...gaps).toFixed(1)}-${Math.max(...gaps).toFixed(1)} ms`;
  assert.ok(times.length>=46&&times.length<=50,label);assert.ok(Math.min(...gaps)>=1000/24-1000/48-.5&&Math.max(...gaps)<=1000/24+1000/48+.5,label);
  // On a film at 24 every reel frame is one of its ticks; on twos the reel is the faster clock and keeps its own even grid.
  if(fps===24)assert.ok(on>=times.length-1,label);
  f.controller.destroy();
 }
});
