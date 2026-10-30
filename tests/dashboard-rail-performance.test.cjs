'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./dashboard-heading-fixture.cjs');
function setup({display='flex',visible=true,observers=true}={}){
 const s={events:[],display,visible,top:20,overflow:'auto',height:40,notify:null,mutations:[],listeners:new Map(),renders:0};
 s.f=fixture({setup({env}){
  env.ReserveMotion={create:()=>({syncTabs(){},destroy(){}})};const view=env.ReserveDashboardView.render;env.ReserveDashboardView.render=(...args)=>{s.renders++;return view(...args);};
  env.ReserveMaterialsUI={create({onChange}){s.notify=onChange;return {renderRelated:()=>'',takeFocusRequest(){},destroy(){}};}};
  const proto=Object.getPrototypeOf(env.document.body),rect=proto.getBoundingClientRect,rects=proto.getClientRects;
  const inRail=n=>n.matches?.('.rd-course-rail,.rd-shell')||!!n.closest?.('.rd-course-rail');
  proto.getBoundingClientRect=function(){if(inRail(this))s.events.push('read:box');return {...rect.call(this),top:s.top};};
  proto.getClientRects=function(){if(inRail(this)){s.events.push('read:rects');if(!s.visible)return [];}return rects.call(this);};
  Object.defineProperty(proto,'offsetHeight',{get(){if(inRail(this))s.events.push('read:height');return s.height;}});
  env.getComputedStyle=node=>{s.events.push('read:style');return {display:node.classList.contains('rd-course-rail')?s.display:'block',overflowY:s.overflow,position:node.classList.contains('rd-status')?'absolute':'static',boxSizing:'border-box',getPropertyValue:()=>''};};
  const create=env.document.createElement;env.document.createElement=function(name){const node=create.call(this,name),put=node.style.setProperty;node.style.setProperty=function(k,v){if(k.startsWith('--rd-rail-')||k==='--rd-status-h')s.events.push('write:'+k);put.call(this,k,v);};return node;};
  const toggle=env.document.documentElement.classList.toggle;env.document.documentElement.classList.toggle=(...args)=>{s.events.push('write:html');return toggle(...args);};
  env.document.fonts={addEventListener:(key,fn)=>s.listeners.set('fonts:'+key,fn),removeEventListener:key=>s.listeners.delete('fonts:'+key)};
  env.addEventListener=(key,fn)=>s.listeners.set(key,fn);env.removeEventListener=key=>s.listeners.delete(key);
  env.MutationObserver=class{constructor(fn){this.fn=fn;s.mutations.push(this);}observe(){}disconnect(){this.dead=true;}};
  if(!observers)env.ResizeObserver=undefined;
 }});
 s.resize=(node=s.f.container)=>{for(const o of s.f.observers)if(o.nodes.has(node))o.fn([{target:node,contentRect:{width:480,height:s.height}}]);};
 s.clear=()=>{s.events=[];};return s;
}

test('rail measurement batches all style/box reads before any geometry or document-class write',t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());const first=s.events.findIndex(e=>e.startsWith('write:'));assert.ok(first>0);assert.ok(s.events.slice(0,first).some(e=>e==='read:height'));assert.equal(s.events.slice(first).some(e=>e.startsWith('read:')),false);assert.equal(s.f.container.style.getPropertyValue('--rd-rail-top'),'20px');assert.equal(s.f.container.style.getPropertyValue('--rd-rail-row-h'),'40px');assert.equal(s.events.filter(e=>e==='write:html').length,1);
});

test('unchanged source renders perform no rail reads, writes, selection sync or duplicate settling pass',t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());const footer=s.f.container.querySelector('.rd-status'),observed=s.f.observers.map(o=>[...o.nodes]);s.clear();for(let i=0;i<3;i++){s.notify();s.f.tick(0);}assert.strictEqual(s.f.container.querySelector('.rd-status'),footer);assert.deepEqual(s.f.observers.map(o=>[...o.nodes]),observed);assert.deepEqual(s.events,[]);s.f.tick(99);assert.deepEqual(s.events,[]);
});

test('only changed observer sizes invalidate the rail and same-size deliveries settle without layout work',t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());s.resize();s.f.tick(0);s.clear();s.resize();s.f.tick(0);assert.deepEqual(s.events,[]);s.height=55;s.resize();s.f.tick(0);assert.ok(s.events.includes('read:height'));assert.equal(s.f.container.style.getPropertyValue('--rd-rail-row-h'),'55px');assert.equal(s.events.includes('write:html'),false);
});

test('viewport, late fonts/ancestor style, offsets, row text and overflow changes invalidate cached inputs',async t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());s.top=83;s.overflow='visible';s.clear();s.listeners.get('resize')();s.f.tick(0);assert.equal(s.f.container.style.getPropertyValue('--rd-rail-top'),'83px');assert.equal(s.f.document.documentElement.classList.contains('reserve-fit'),false);assert.equal(s.events.filter(e=>e==='write:html').length,1);
 s.clear();s.listeners.get('fonts:loadingdone')();s.f.tick(0);assert.ok(s.events.includes('read:height'));s.clear();s.mutations[0].fn([{attributeName:'style',target:s.f.document.body}]);s.f.tick(0);assert.ok(s.events.includes('read:rects'));s.clear();s.f.dashboard.updateSnapshot({...s.f.snapshot,courses:[{id:'10',name:'A changed wrapping course title'}]});s.f.tick(0);assert.ok(s.events.includes('read:height'));
});

test('hidden/loading retries survive unchanged renders without repeated work and stop after reveal/destroy',t=>{
 const s=setup({display:'block',visible:false});t.after(()=>s.f.dashboard.destroy());s.clear();for(let i=0;i<3;i++){s.notify();s.f.tick(0);}assert.deepEqual(s.events,[]);s.f.tick(99);assert.deepEqual(s.events,[]);s.display='flex';s.visible=true;s.f.tick(1);assert.ok(s.events.includes('read:height'));assert.equal(s.f.container.style.getPropertyValue('--rd-rail-top'),'20px');s.clear();s.f.tick(100);assert.deepEqual(s.events,[]);s.listeners.get('resize')();s.f.dashboard.destroy();s.clear();s.f.tick(1000);assert.deepEqual(s.events,[]);assert.equal(s.listeners.has('resize'),false);assert.ok(s.mutations.every(o=>o.dead));
});

test('a display:none rail does not retry until an external invalidation reveals it',t=>{
 const s=setup({display:'none'});t.after(()=>s.f.dashboard.destroy());s.clear();s.notify();s.f.tick(100);assert.deepEqual(s.events,[]);s.display='flex';s.listeners.get('resize')();s.f.tick(0);assert.ok(s.events.includes('read:height'));
});

test('rail input changes still invalidate without ResizeObserver',async t=>{
 const s=setup({observers:false});t.after(()=>s.f.dashboard.destroy());s.clear();await s.f.store.update(data=>{data.settings.font='serif';});s.f.tick(0);assert.ok(s.events.includes('read:height'));s.clear();await s.f.store.update(()=>{});s.f.tick(0);assert.deepEqual(s.events,[]);
});

test('changing the visually hidden status or the owned html class does not invalidate rail geometry',t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());s.clear();s.f.dashboard.setStatus('Saved view');s.f.tick(0);assert.deepEqual(s.events,[]);s.mutations[0].fn([{attributeName:'class',oldValue:'',target:s.f.document.documentElement}]);s.f.tick(0);assert.deepEqual(s.events,[]);
});
