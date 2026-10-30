'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./dashboard-heading-fixture.cjs');
function setup({paint=true}={}){
 const state={renders:0,depth:0,max:0,notify:[],frames:new Map(),seq:0,armed:false,ready:'',deck:[]};
 state.f=fixture({setup({env}){
  env.requestAnimationFrame=fn=>{const id=++state.seq;state.frames.set(id,fn);return id;};env.cancelAnimationFrame=id=>state.frames.delete(id);
  const render=env.ReserveDashboardView.render;env.ReserveDashboardView.render=(...args)=>{state.renders++;state.depth++;state.max=Math.max(state.max,state.depth);try{if(state.armed){state.armed=false;state.notify.forEach(fn=>fn());}return render(...args);}finally{state.depth--;}};
  env.ReserveMaterialsUI={create({onChange}){state.notify.push(onChange);return {activate(){},renderRelated:()=>'',takeFocusRequest(){},destroy(){}};}};
  env.ReserveCourseHubUI={create({onChange}){state.notify.push(onChange);return {loadDeck(id){state.deck.push(id);state.ready=id;onChange();},renderDeck:course=>'<p data-ready="'+state.ready+'">Deck '+course.id+'</p>',renderDeckHeader:()=>'',takeFocusRequest(){},destroy(){}};}};
  env.CanvasHarnessQuickUpload={create({onChange}){state.notify.push(onChange);return {destroy(){}};}};
 }});
 state.paint=()=>{const jobs=[...state.frames.values()];state.frames.clear();jobs.forEach(fn=>fn(100));};if(paint)state.paint();return state;
}
// A click's pointerdown holds the drawings until the frame after the click's render (motion.js busy/answered). That
// frame releases the drawings and renders nothing, so these tests paint and count renders, not queued frames.
test('materials changes during markup never render nested and share one pre-paint follow-up',async()=>{
 const s=setup();await Promise.resolve();s.paint();const before=s.renders;s.armed=true;s.f.click('course',{id:'20'});assert.equal(s.renders,before+1);assert.equal(s.max,1);
 await Promise.resolve();s.notify.forEach(fn=>fn());await Promise.resolve().then(()=>s.notify[0]());assert.equal(s.renders,before+1);s.paint();assert.equal(s.renders,before+2,'one shared follow-up render');assert.equal(s.max,1);s.paint();assert.equal(s.renders,before+2);s.f.dashboard.destroy();
});
test('available synchronous deck state is read by the click render without a follow-up',async()=>{
 const s=setup();await Promise.resolve();s.paint();const before=s.renders;s.f.click('course',{id:'20'});assert.equal(s.renders,before+1);assert.equal(s.ready,'20');assert.ok(s.f.container.querySelector('[data-ready="20"]'));await Promise.resolve();s.paint();assert.equal(s.renders,before+1,'no follow-up render');assert.deepEqual(s.deck,['10','20']);s.f.dashboard.destroy();
});
test('an explicit render consumes queued source notifications and retains click focus',async()=>{
 const s=setup();await Promise.resolve();s.paint();const before=s.renders;s.notify[0]();const target=s.f.click('course',{id:'20'});assert.equal(s.renders,before+1);s.paint();assert.equal(s.renders,before+1,'the queued notification was consumed');assert.equal(s.f.document.activeElement,target);s.f.dashboard.destroy();
});
test('notifications spanning later microtasks still flush exactly once before paint',async()=>{
 const s=setup();await Promise.resolve();s.paint();const before=s.renders;s.notify[0]();await Promise.resolve().then(()=>s.notify[1]()).then(()=>s.notify[2]()).then(()=>{s.ready='cache-final';s.notify[0]();});assert.equal(s.renders,before);assert.equal(s.frames.size,1);s.paint();assert.equal(s.renders,before+1);assert.ok(s.f.container.querySelector('[data-ready="cache-final"]'));s.f.dashboard.destroy();
});
test('destroy cancels a pending source render',async()=>{
 const s=setup();await Promise.resolve();s.paint();s.notify[0]();const before=s.renders;s.f.dashboard.destroy();assert.equal(s.frames.size,0);s.notify[1]();s.paint();assert.equal(s.renders,before);
});

test('patching preserves controller-owned grid placement alongside changed view styles',()=>{
 const s=setup(),patch=s.f.env.ReserveDashboard.helpers.patchUI;
 function node(style,attrs={}){const values=new Map(Object.entries(style)),data={class:'rd-main rd-desk',...attrs};const n={nodeType:1,tagName:'DIV',childNodes:[],get firstChild(){return null;},classList:{contains:key=>data.class.split(' ').includes(key)},hasAttribute:key=>key==='style'?values.size>0:key in data,getAttribute:key=>key==='style'?[...values].map(([k,v])=>k+': '+v+';').join(' '):data[key]??null,setAttribute(key,value){if(key==='style'){values.clear();for(const part of value.split(';')){const i=part.indexOf(':');if(i>0)values.set(part.slice(0,i).trim(),part.slice(i+1).trim());}}else data[key]=value;},removeAttribute(key){if(key==='style')values.clear();else delete data[key];},get attributes(){return [...Object.entries(data),...(values.size?[['style',this.getAttribute('style')]]:[])].map(([name,value])=>({name,value}));},style:{getPropertyValue:key=>values.get(key)||'',setProperty:(key,value)=>values.set(key,value)}};return n;}
 const current=node({'--rd-layout-columns':'1fr 2fr','--rd-layout-rows':'none',color:'red'},{'data-rows':'measured'}),next=node({color:'blue'});patch(current,next);assert.equal(current.style.getPropertyValue('--rd-layout-columns'),'1fr 2fr');assert.equal(current.style.getPropertyValue('--rd-layout-rows'),'none');assert.equal(current.getAttribute('data-rows'),'measured');assert.equal(current.style.getPropertyValue('color'),'blue');s.f.dashboard.destroy();
});

test('status changes patch only the existing live region and refresh metadata, retaining focus and scroll',()=>{
 const s=setup(),f=s.f,line=f.container.querySelector('.rd-status [role="status"]'),footer=line.parentElement,button=f.container.querySelector('[data-rd-action="refresh"]'),column=f.container.querySelector('.rd-workspace'),heading=f.container.querySelector('.rd-workspace-heading');button.focus();column.scrollTop=173;const before=s.renders;
 f.dashboard.setStatus('Saved view ? Updating in the background?');assert.equal(s.renders,before);assert.equal(s.frames.size,0);assert.strictEqual(f.container.querySelector('.rd-status [role="status"]'),line);assert.strictEqual(line.parentElement,footer);assert.equal(line.textContent,'Saved view ? Updating in the background?');assert.equal(line.getAttribute('role'),'status');assert.equal(f.container.querySelectorAll('.rd-status [role="status"]').length,1);assert.equal(f.document.activeElement,button);assert.equal(column.scrollTop,173);assert.strictEqual(f.container.querySelector('.rd-workspace-heading'),heading);
 f.dashboard.setStatus('Refresh failed: offline');assert.equal(button.getAttribute('data-tone'),'danger');assert.equal(button.getAttribute('title'),'Refresh failed: offline ? click to try again');f.dashboard.setStatus('');assert.equal(line.textContent,'Update time unavailable');assert.equal(button.hasAttribute('data-tone'),false);assert.equal(s.renders,before);f.dashboard.destroy();
});

test('unchanged status is a complete no-op, including text nodes and scheduling',()=>{
 const s=setup(),f=s.f;f.dashboard.setStatus('Saved view');const line=f.container.querySelector('.rd-status [role="status"]'),text=line.firstChild,scheduled=f.counts.timers,before=s.renders;f.dashboard.setStatus('Saved view');assert.strictEqual(line.firstChild,text);assert.equal(f.counts.timers,scheduled);assert.equal(s.renders,before);assert.equal(s.frames.size,0);f.dashboard.destroy();f.dashboard.setStatus('Detached status');assert.equal(line.textContent,'Saved view');
});

test('cached/fresh snapshots and all source notifications in a microtask chain share one complete render',async()=>{
 const s=setup(),f=s.f;await Promise.resolve();s.paint();const before=s.renders;f.dashboard.updateSnapshot({...f.snapshot,courses:[{id:'10',name:'Cached title'}]});s.notify[0]();await Promise.resolve().then(()=>{f.dashboard.updateSnapshot({...f.snapshot,courses:[{id:'10',name:'Fresh title'}],fetchedAt:new Date().toISOString()});s.notify[1]();}).then(()=>{s.ready='all sources ready';s.notify[2]();f.dashboard.setStatus('');});assert.equal(s.renders,before);assert.equal(s.frames.size,1);s.paint();assert.equal(s.renders,before+1);assert.match(f.container.querySelector('h1').textContent,/Fresh title/);assert.ok(f.container.querySelector('[data-ready="all sources ready"]'));assert.equal(s.max,1);f.dashboard.destroy();
});

test('initial verified/cache snapshots, status and source microtasks produce one complete first visible frame',async()=>{
 const s=setup({paint:false}),f=s.f;assert.equal(s.renders,0);assert.equal(f.container.children.length,0);f.dashboard.updateSnapshot({...f.snapshot,courses:[{id:'10',name:'Verified cached course'}]});f.dashboard.setStatus('Saved view');s.notify[0]();await Promise.resolve().then(()=>{s.ready='source final';s.notify[1]();f.dashboard.updateSnapshot({...f.snapshot,courses:[{id:'10',name:'Fresh first frame'}]});}).then(()=>{s.ready='all ready';s.notify[2]();f.dashboard.setStatus('Latest status');});assert.equal(s.renders,0);assert.equal(s.frames.size,1);s.paint();assert.equal(s.renders,1);assert.match(f.container.querySelector('h1').textContent,/Fresh first frame/);assert.ok(f.container.querySelector('.rd-toolbar'));assert.ok(f.container.querySelector('.rd-course-rail'));assert.ok(f.container.querySelector('[data-ready="10"]'));assert.equal(f.container.querySelector('.rd-status [role="status"]').textContent,'Latest status');assert.equal(s.frames.size,0);f.dashboard.destroy();
});

test('destroy before the first paint cancels startup markup as well as later sources',()=>{
 const s=setup({paint:false});s.f.dashboard.updateSnapshot(s.f.snapshot);s.f.dashboard.destroy();s.paint();assert.equal(s.renders,0);assert.equal(s.frames.size,0);
});
