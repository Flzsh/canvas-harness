'use strict';
// What the pony costs a dashboard render and a moving pointer: no style flush per reel tick, no geometry rescan for the
// drawn frames' own stroke loops, one context build per sync, and one engine index while the thought is unchanged.
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./pony-fixture.cjs');
const B=require('../extension/pony-brain.js');

function loop(){
 const seen={stateReads:0,writes:[],cancelled:false};let time=0,state='running';
 const a={animationName:'pet-tail',get playState(){seen.stateReads++;return seen.cancelled?'idle':state;},effect:{getTiming:()=>({duration:3400,iterations:Infinity}),getKeyframes:()=>[{computedOffset:0,transform:'rotate(5deg)'},{computedOffset:1,transform:'rotate(-7deg)'}]},pause(){state='paused';},get currentTime(){return seen.cancelled?null:time;},set currentTime(v){time=v;seen.writes.push(v);}};
 return {a,seen};
}

test('steady reel ticks read no style-flushing playState; a loop cancelled by style leaves the reel without another write',t=>{
 const f=fixture();t.after(()=>f.controller.destroy());const {a,seen}=loop();f.animations.push(a);f.node.emit('animationstart');f.advance(2000);
 assert.ok(seen.writes.length>=10,'the loop is driven (the first reel waits 1.5 s)');
 seen.stateReads=0;seen.writes.length=0;f.advance(1000);
 assert.ok(seen.writes.length>=23&&seen.writes.length<=25,'24 fps while in use: '+seen.writes.length);
 assert.equal(seen.stateReads,0,'cached ticks never read playState');
 seen.cancelled=true;const before=seen.writes.length;f.advance(1000);
 assert.equal(seen.writes.length,before,'a cancelled loop gets no current time written');
 seen.cancelled=false;f.node.emit('animationstart');f.advance(200);assert.ok(seen.writes.length>before,'a restarted loop is found again');
});

test('drawn-frame stroke loops ending or cancelling under the pointer do not re-measure places; a card\'s own motion still does',t=>{
 const f=fixture();t.after(()=>f.controller.destroy());f.advance(2000);
 const frame=new f.Element('rd-frame'),part=new f.Element('o-move'),nav=new f.Element('chn-frames'),navPart=new f.Element('rd-frame-x');
 frame.matches=sel=>sel.split(',').some(s=>s.trim()==='.rd-frame');nav.matches=sel=>sel.split(',').some(s=>s.trim()==='.chn-frames');
 frame.append(part);f.panels[0].append(frame);nav.append(navPart);f.container.append(nav);
 f.clear();
 for(let i=0;i<40;i++)for(const type of ['animationend','animationcancel','transitionrun','transitionend','transitioncancel'])for(const target of [part,frame,navPart])f.container.emit(type,{target});
 assert.equal(f.rafCalls,0,'no geometry refresh is scheduled');f.advance(200);assert.equal(f.reads.hit,0,'no hit tests');
 f.panels[0].rect.top+=70;f.panels[0].rect.bottom+=70;f.container.emit('animationend',{target:f.panels[0]});assert.equal(f.rafCalls,1,'a ledge\'s own animation still refreshes');
 f.postpaint();assert.ok(f.reads.rect>0,'and re-measures');
});

test('one workspace sync builds the pet context once; reads outside a sync stay fresh',t=>{
 let calls=0;const data={features:[{id:'biscuit-more-rules',on:false}],assignments:[]};
 const f=fixture({brain:B,info:()=>{calls++;return data;}});t.after(()=>f.controller.destroy());f.advance(1000);
 calls=0;f.controller.sync();assert.equal(calls,1,'knowledge tier and brain share one build');
 calls=0;f.controller.sync();f.controller.sync();f.controller.sync();assert.equal(calls,3,'each sync builds its own');
 data.features[0].on=true;calls=0;f.controller.sync();assert.equal(calls,1);
});

test('engine offers reuse one indexed snapshot while the thought is unchanged, with the current time and values',t=>{
 const real=require('../extension/biscuit-engine.js'),Registry=require('../extension/biscuit-registry.js');let indexed=0;
 const unregister=Registry.register('test-render-cost',s=>{indexed++;return [];});t.after(unregister);
 const offers=[],engine={create:()=>{const e=real.create();return {...e,offer:(s,state,memory)=>{offers.push({s,now:s.now,activity:s.activity});return e.offer(s,state,memory);}};}};
 const data={courses:[{id:'1',name:'Chemistry'}],assignments:[],features:[]};
 const f=fixture({brain:B,engine,info:()=>JSON.parse(JSON.stringify(data))});t.after(()=>f.controller.destroy());f.advance(1000);
 f.controller.sync();const first=offers.length,builds=indexed;assert.ok(first>0,'the engine was asked for an offer');
 for(let i=0;i<5;i++){f.advance(7);f.controller.sync();}
 assert.equal(offers.length,first+5,'every sync still asks for an offer');
 assert.equal(indexed,builds,'an unchanged thought does not rebuild the engine index');
 assert.equal(offers.at(-1).s,offers[first-1].s,'one snapshot object while the thought is unchanged');
 assert.equal(offers.at(-1).now,f.epoch+f.clock,'offers see the current time');
 data.courses.push({id:'2',name:'Engineering'});f.controller.sync();
 assert.equal(indexed,builds+1,'changed data rebuilds the index once');assert.notEqual(offers.at(-1).s,offers[first-1].s);
 assert.deepEqual(offers.at(-1).s.courses.map(c=>c.id),['1','2'],'the offer sees the new data');
 const after=indexed;f.advance(61000);f.controller.sync();assert.ok(indexed>after,'the brain\'s minute refresh rebuilds it too');
});
