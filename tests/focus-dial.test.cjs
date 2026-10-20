'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Dial=require('../extension/focus-dial.js'),M=require('../extension/focus-room-model.js');
const T=Date.parse('2026-10-20T02:00:00Z');
function fixture(focus){
 const events=new Map(),played=[],media={matches:false,addEventListener:(k,f)=>events.set('media:'+k,f),removeEventListener:k=>events.delete('media:'+k)};
 const doc={hidden:false,defaultView:{matchMedia:()=>media},addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)};
 const arc={ownerDocument:doc,style:{},animate(frames,options){const a={frames,options,currentTime:0,cancel(){this.cancelled=true;}};played.push(a);return a;}};
 let time=T,stored=focus;
 const dial=Dial.create(arc,{getFocus:()=>stored,now:()=>time});
 return {dial,arc,events,played,doc,media,setTime:t=>time=t,setFocus:f=>stored=f};
}
test('dial follows fractional timestamps rather than the rounded display second',()=>{
 const f=M.start({minutes:25},T),s=Dial.sample(f,T+6250);
 assert.equal(s.progress,6.25/1500);assert.equal(s.duration,1500000);
 assert.equal(Dial.sample(f,T+2000000).progress,1);
 assert.equal(Dial.sample({...f,endsAt:null,remaining:750},T).progress,.5);
 assert.equal(Dial.sample({minutes:25,remaining:0},T).progress,0,'finished timer is ready for its next session');
});
test('one native animation survives second ticks and unrelated saves; pause and reset cancel it',()=>{
 const focus=M.start({minutes:25},T),f=fixture(focus),first=f.played[0];
 assert.deepEqual(first.frames,[{strokeDashoffset:1},{strokeDashoffset:0}]);
 assert.equal(first.options.duration,1500000);assert.equal(first.currentTime,0);
 for(let n=1;n<=10;n++){f.setTime(T+n*1000);f.setFocus({...focus,goal:'Read'});f.dial.sync();}
 assert.equal(f.played.length,1,'no per-second animation restart');
 f.setFocus(M.pause(focus,T+10000));f.dial.sync();assert.equal(first.cancelled,true);
 assert.equal(Number(f.arc.style.strokeDashoffset),1-10/1500);
 f.setFocus(M.reset(focus));f.dial.sync();assert.equal(f.arc.style.opacity,'0','no round-cap blob at zero');
 f.arc.style={};f.dial.sync();assert.equal(f.arc.style.opacity,'0','workspace reconciliation cannot restore the zero-progress blob');
 f.dial.destroy();assert.equal(f.events.size,0);
});
test('hidden tabs cancel motion and resume from the current deadline without replaying elapsed time',()=>{
 const focus=M.start({minutes:25},T),f=fixture(focus);
 f.doc.hidden=true;f.events.get('visibilitychange')();assert.equal(f.played[0].cancelled,true);assert.equal(f.played.length,1);
 f.setTime(T+320500);f.doc.hidden=false;f.events.get('visibilitychange')();
 assert.equal(f.played.at(-1).currentTime,320500);assert.equal(f.played.length,2);
 f.media.matches=true;f.events.get('media:change')();assert.equal(f.played.at(-1).cancelled,true);
 f.setTime(T+330000);f.dial.sync();assert.equal(f.arc.style.strokeDashoffset,String(1-330/1500));
 f.dial.destroy();
});
test('an open session wraps hourly and freezes when paused',()=>{
 const focus=M.start(M.setMode({},'open',{}),T),f=fixture(focus);
 assert.equal(f.played[0].options.iterations,Infinity);
 assert.equal(Dial.sample(focus,T+3600250).progress,.25/3600);
 f.setFocus({...focus,startedAt:null,elapsed:3610});f.dial.sync();
 assert.equal(f.played[0].cancelled,true);assert.equal(Number(f.arc.style.strokeDashoffset),1-10/3600);
 f.dial.destroy();
});
