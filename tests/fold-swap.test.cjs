'use strict';
// Room folds and opens (fold-freeze fix, 2026-10-28): the render that swaps a room's page for Home (or Home for a room)
// was one long task, 1.4-2.7 s at 4x CPU. These pin the parts of the fix that need no browser: the Help band's ink read
// waits while a room's move plays, a desk drawn again starts from the last desk's sizes, and the page swap hides the
// outgoing page at once and removes it later, with every other render unchanged.
const {test}=require('node:test'),assert=require('node:assert/strict');
const Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js');
const {dom,storage}=require('./study-fixture.cjs');
const scope='https://school.instructure.com|7';
const ask=headline=>({kind:'ask',title:headline,data:{v:1,kind:'ask',title:headline,headline,size:'s',grid:4,importance:1,points:[{text:headline+' first.',src:'Canvas'}],next:'Open it.',gaps:[]},savedAt:100,progress:{}});

function bandIn({moving=0,color='rgb(20, 20, 20)'}={}){
 const d=dom(),rd=new d.Element('div'),host=new d.Element('div');rd.className='rd';if(moving)rd.dataset.chMoving=String(Date.now()+moving);rd.append(host);
 // a browser's closest(): the band asks its dashboard (.rd) whether a room's move is playing
 if(!d.Element.prototype.closest)d.Element.prototype.closest=function(sel){for(let n=this;n;n=n.parentNode)if(sel==='.rd'&&String(n.className).split(' ').includes('rd'))return n;return null;};
 const reads=[],timers=[],idles=[];
 const env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:false}),getComputedStyle:el=>{reads.push(el);return {color,transform:'none',opacity:'1'};},
  setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].fn=null;},requestIdleCallback:fn=>{idles.push(fn);return idles.length;}};
 const view=Band.renderBand(host,{'a:1':ask('Lab report')},{env,scope,store:UI.createStore(env)});
 const band=host.children[0];
 return {view,band,reads,timers,idles,rd};
}
const inkReads=b=>b.reads.length;

test('the Help band reads its ink at once when no room is moving',()=>{
 const b=bandIn({color:'rgb(240, 240, 240)'});
 assert.ok(inkReads(b)>0,'the day tag colour is read in the render');assert.equal(b.band.dataset.ink,'light');b.view.destroy();
});

test('while a room\'s move plays the Help band waits to read its ink, starts with the last band\'s, and reads it after',()=>{
 // a band drawn earlier read light ink (the last band's ink is what a band made in a move starts with)
 const first=bandIn({color:'rgb(240, 240, 240)'});assert.equal(first.band.dataset.ink,'light');first.view.destroy();
 const b=bandIn({moving:600,color:'rgb(20, 20, 20)'});
 assert.equal(inkReads(b),0,'no style read in the render that swapped the page');
 assert.equal(b.band.dataset.ink,'light','the last ink is kept meanwhile (no flash of the other washes)');
 const wait=b.timers.find(t=>t.fn&&t.ms>=600&&t.ms<=700);assert.ok(wait,'one timer waits for the move to land');
 assert.equal(b.timers.filter(t=>t.fn&&t.ms>=600&&t.ms<=700).length,1);
 // the move has landed: the read goes to the browser's idle time
 b.rd.dataset.chMoving=String(Date.now()-1);wait.fn();assert.equal(inkReads(b),0,'still not read until the browser is idle');
 assert.equal(b.idles.length,1);b.idles[0]();
 assert.ok(inkReads(b)>0,'read once idle');assert.equal(b.band.dataset.ink,'dark','and the ink follows the page');
 b.view.destroy();
});

test('a band destroyed while its ink read waits never reads it',()=>{
 const b=bandIn({moving:500});const wait=b.timers.find(t=>t.fn&&t.ms>=500&&t.ms<=600);b.view.destroy();
 assert.equal(wait.fn,null,'the timer is cleared with the band');assert.equal(inkReads(b),0);
});

// ---- the desk drawn again (workspace-gestures.js applyLayout)
const {fixture}=require('./gesture-fixture.cjs'),M=require('../extension/workspace-arrange.js'),G=require('../extension/workspace-gestures.js');
function desks(){
 const f=fixture();f.controller.destroy();const observers=[],reads={width:0,height:0},writes=[];
 const win=f.container.ownerDocument.defaultView;
 win.ResizeObserver=class{constructor(fn){this.fn=fn;this.nodes=new Set();observers.push(this);}observe(n){this.nodes.add(n);}unobserve(n){this.nodes.delete(n);}disconnect(){this.nodes.clear();}};
 const count=(desk,panels)=>{Object.defineProperty(desk,'clientWidth',{configurable:true,get(){reads.width++;return desk.rect.width;}});for(const node of panels)Object.defineProperty(node,'offsetHeight',{configurable:true,get(){reads.height++;return node.rect.height;}});
  for(const node of [desk,...panels]){node.style.getPropertyValue=k=>node.style[k]||'';const put=node.style.setProperty;node.style.setProperty=(k,v)=>{writes.push([node,k,v]);put(k,v);};}};
 const desk=f.container.querySelector('.rd-main');count(desk,Object.values(f.panels));
 const controller=G.create({container:f.container,getSettings:()=>f.settings,onChange:c=>{M.change(f.settings,c);return true;}},M);
 const sizes=()=>{for(const o of observers){const entries=[...o.nodes].map(target=>({target,contentRect:{width:target.rect.width,height:target.rect.height},borderBoxSize:[{inlineSize:target.rect.width,blockSize:target.rect.height}]}));if(entries.length)o.fn(entries);}};
 // Home drawn again: a new desk with new modules under the same keys (what the dashboard inserts when a room folds back)
 const redraw=()=>{const old=f.container.querySelector('.rd-main'),next=old.cloneNode();const panels=next.children;count(next,panels);old.parentNode.insertBefore(next,old);old.remove();return {desk:next,panels:Object.fromEntries(panels.map(n=>[n.dataset.arrangeKey,n]))};};
 return {f,controller,reads,writes,sizes,redraw,desk};
}
test('a desk drawn again starts from the last desk\'s sizes: no layout read in the render, the same placement',()=>{
 const t=desks();t.controller.sync();t.sizes();
 const placed=Object.fromEntries(Object.entries(t.f.panels).map(([k,n])=>[k,[n.style['--rd-panel-column'],n.style['--rd-panel-row'],n.style['--rd-panel-grow']]])),columns=t.desk.style['--rd-layout-columns'];
 const before={...t.reads},again=t.redraw();t.controller.sync();
 assert.deepEqual(t.reads,before,'neither the desk width nor a module height is read in the render that draws Home again');
 assert.equal(again.desk.style['--rd-layout-columns'],columns);
 for(const [k,n] of Object.entries(again.panels))assert.deepEqual([n.style['--rd-panel-column'],n.style['--rd-panel-row'],n.style['--rd-panel-grow']],placed[k],k+' keeps its place');
 // the frame's own layout then reports the real sizes: the same ones write nothing
 const written=t.writes.length;t.sizes();assert.equal(t.writes.length,written,'unchanged sizes lay nothing out again');
 t.controller.destroy();
});
test('a desk drawn again whose modules changed size is corrected by the observer in the same frame',()=>{
 const t=desks();t.controller.sync();t.sizes();const again=t.redraw();t.controller.sync();
 const row=again.panels.work.style['--rd-panel-row'];again.panels.work.rect.height=820;t.sizes();
 assert.notEqual(again.panels.work.style['--rd-panel-row'],row,'the taller module moves the rows');t.controller.destroy();
});
test('the first desk of all is still measured in the render',()=>{
 const t=desks();t.controller.sync();assert.ok(t.reads.width>0||t.reads.height>0);t.controller.destroy();
});

// ---- the page swap (dashboard.js renderNow): focus on the outgoing page is let go, and the column's scroll reset,
// before the new page goes in; every other render is untouched
const {fixture:dashboard}=require('./dashboard-heading-fixture.cjs');
function swapWatch(f){
 const column=f.container.querySelector('.rd-shell > .rd-workspace'),log=[];
 const proto=Object.getPrototypeOf(column),insert=proto.insertBefore;
 proto.insertBefore=function(node,before){if(column.contains(this)||this===column)log.push('insert');return insert.call(this,node,before);};
 let top=0;Object.defineProperty(column,'scrollTop',{configurable:true,get(){return top;},set(v){log.push('scroll '+v);top=v;}});
 const restore=()=>{proto.insertBefore=insert;};
 return {column,log,restore,setTop:v=>{top=v;}};
}
const focusIn=(f,node)=>{node.blur=()=>{f.document.activeElement=null;f.log?.push('blur');};node.focus();};
const tidy=html=>html.replace(/ data-motion="[^"]*"/g,'');
// (the first render after mounting adds the panel's own attributes: pages are compared from the second on)

test('a page swap lets go of focus on the outgoing page and resets the scroll before the new page goes in',()=>{
 const f=dashboard({courseId:'all'}),w=swapWatch(f);
 try{
  const inside=[...w.column.querySelectorAll('button,[data-rd-action]')].find(n=>!n.closest('.rd-workspace-heading'));assert.ok(inside,'a control on Home');
  f.log=w.log;focusIn(f,inside);w.setTop(240);w.log.length=0;
  // what a room's own control does: a click on the workspace action that leaves focus where it was (the review deck's
  // hidden hook under its Fold, Grade impact's Fold)
  const tab=f.container.querySelector('[data-rd-action="workspace"][data-tab="grades"]');f.container.events.get('click')({detail:0,target:tab,preventDefault(){}});
  assert.equal(f.container.dataset.workspace,'grades');
  const first=w.log.indexOf('insert');assert.ok(first>0,'the new page went in');
  assert.ok(w.log.indexOf('blur')>=0&&w.log.indexOf('blur')<first,'focus left the old page first: '+w.log.slice(0,4).join(', '));
  assert.ok(w.log.indexOf('scroll 0')>=0&&w.log.indexOf('scroll 0')<first,'the scroll was reset while the old page was laid out');
  assert.equal(w.log.filter(x=>x==='scroll 0').length,1,'and only once');
 }finally{w.restore();}
});

test('an ordinary render (no page change) keeps focus and scroll where they are and draws the same page',()=>{
 const f=dashboard({courseId:'all'}),w=swapWatch(f);
 try{
  const inside=[...w.column.querySelectorAll('button,[data-rd-action]')].find(n=>!n.closest('.rd-workspace-heading'));
  f.store.update(()=>{});f.tick(0);
  f.log=w.log;focusIn(f,inside);w.setTop(240);const before=tidy(f.container.outerHTML);w.log.length=0;
  f.store.update(()=>{});f.tick(0);
  assert.equal(w.log.includes('blur'),false,'focus is not touched');assert.equal(w.log.some(x=>x.startsWith('scroll')),false,'nor the scroll');
  assert.equal(f.document.activeElement,inside);assert.equal(tidy(f.container.outerHTML),before,'byte for byte the same page');
 }finally{w.restore();}
});

test('the swapped page is drawn exactly as the same page drawn fresh',()=>{
 const a=dashboard({courseId:'all'});a.store.update(()=>{});a.tick(0);a.click('workspace',{tab:'grades'});
 const b=dashboard({courseId:'all',initialState:{workspace:'grades'}});b.store.update(()=>{});b.tick(0);
 const page=f=>tidy(f.container.querySelector('.rd-shell > .rd-workspace').outerHTML);
 assert.equal(page(a),page(b));
});

test('Escape with a room up never marks keyboard use; Tab still does, a moment later',()=>{
 const f=dashboard({courseId:'all'});f.container.dataset.input='pointer';f.container.dataset.chRoom='open';
 const key=k=>f.events.get('keydown')({key:k,target:f.container,composedPath:()=>[f.container],preventDefault(){}});
 key('Escape');f.tick(2000);f.tick(2000);assert.equal(f.container.dataset.input,'pointer','Escape closes the room and leaves the look as it was');
 key('Tab');f.tick(2000);assert.equal(f.container.dataset.input,'pointer','not while the room is open');
 delete f.container.dataset.chRoom;for(let i=0;i<8;i++)f.tick(500);assert.equal(f.container.dataset.input,'keyboard','Tab marks it once the room is gone');
});

// ---- motion.js: a resize while a room's move plays is measured once the move has landed
test('a resize during a room\'s move waits to move the tab pill until the move has landed and the browser is idle',()=>{
 const Motion=require('../extension/motion.js'),timers=[],idles=[];const saved={setTimeout:globalThis.setTimeout,ric:globalThis.requestIdleCallback};
 globalThis.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};globalThis.requestIdleCallback=fn=>{idles.push(fn);return idles.length;};
 try{
  const style=()=>{const s={setProperty(k,v){s[k]=v;},getPropertyValue(k){return s[k]||'';}};return s;};
  const pill={style:style(),offsetWidth:100},tab={dataset:{tab:'work'},offsetLeft:40,offsetWidth:90},bar={clientWidth:800,scrollLeft:0,querySelector:s=>s==='.t-tabs-pill'?pill:s.startsWith('.t-tab[')?tab:null};
  const container={dataset:{input:'pointer',chMoving:String(Date.now()+500)},style:style(),querySelector:s=>s==='.t-tabs'?bar:null,querySelectorAll:()=>[],closest:()=>null,addEventListener(){},removeEventListener(){}};
  let resize;class Observer{constructor(fn){resize=fn;}observe(){}unobserve(){}disconnect(){}}
  const m=Motion.create(container,{media:{matches:false,addEventListener(){},removeEventListener(){}},ResizeObserverImpl:Observer,IntersectionObserverImpl:null});
  m.syncTabs(false);assert.equal(pill.style.transform,'translateX(40px)');
  tab.offsetLeft=300;resize();resize();
  assert.equal(pill.style.transform,'translateX(40px)','not measured in the frame of the swap');
  const waits=timers.filter(t=>t.ms>=500&&t.ms<=560);assert.equal(waits.length,1,'one wait, however many resizes');
  container.dataset.chMoving=String(Date.now()-1);waits[0].fn();assert.equal(pill.style.transform,'translateX(40px)','still waits for idle');
  idles.at(-1)();assert.equal(pill.style.transform,'translateX(300px)','measured once the move has landed');
  container.dataset.chMoving='';resize();assert.equal(pill.style.transform,'translateX(300px)');tab.offsetLeft=10;resize();assert.equal(pill.style.transform,'translateX(10px)','with no move playing a resize measures at once');
  m.destroy();
 }finally{globalThis.setTimeout=saved.setTimeout;if(saved.ric)globalThis.requestIdleCallback=saved.ric;else delete globalThis.requestIdleCallback;}
});

test('a page swapped back and forth at once (a room reopened while it folds) ends on the page as drawn fresh, focus and scroll included',()=>{
 const a=dashboard({courseId:'all'}),w=swapWatch(a);
 try{
  a.store.update(()=>{});a.tick(0);
  const go=tab=>a.container.events.get('click')({detail:0,target:a.container.querySelector(`[data-rd-action="workspace"][data-tab="${tab}"]`),preventDefault(){}});
  w.setTop(120);go('grades');go('work');w.setTop(80);go('grades');a.tick(0);
  assert.equal(a.container.dataset.workspace,'grades');assert.equal(w.column.scrollTop,0);
  const b=dashboard({courseId:'all',initialState:{workspace:'grades'}});b.store.update(()=>{});b.tick(0);
  const page=f=>tidy(f.container.querySelector('.rd-shell > .rd-workspace').outerHTML);assert.equal(page(a),page(b));
 }finally{w.restore();}
});

test('Escape while a room grows (its sheet taken back) never marks keyboard use either; with nothing moving it still does',()=>{
 const f=dashboard({courseId:'all'});f.container.dataset.input='pointer';
 const key=k=>f.events.get('keydown')({key:k,target:f.container,composedPath:()=>[f.container],preventDefault(){}});
 f.container.dataset.chMoving=String(f.env.Date.now()+700);key('Escape');for(let i=0;i<8;i++)f.tick(500);
 assert.equal(f.container.dataset.input,'pointer','the grow taken back leaves the look as it was');
 key('Escape');assert.equal(f.container.dataset.input,'keyboard','an Escape with no room and no move marks it at once, as before');
});


// ---- the companion (pets.js): its upkeep in a render waits while a room's move plays
test('while a room\'s move plays, the companion\'s upkeep in a render waits for the move to land, then runs once',t=>{
 const {fixture:pony}=require('./pony-fixture.cjs');let calls=0;
 const f=pony({info:()=>{calls++;return {};}});t.after(()=>f.controller.destroy());f.advance(2000);
 f.controller.sync();assert.ok(calls>0,'an ordinary render keeps it up to date at once');
 calls=0;f.container.dataset.chMoving=String(Date.now()+600);
 f.controller.sync();f.controller.sync();assert.equal(calls,0,'not in the renders of the move');
 f.container.dataset.chMoving='';f.advance(700);assert.ok(calls>0,'caught up once the move has landed');
 const after=calls;f.advance(2000);f.controller.sync();assert.ok(calls>after,'and at once again after');
});
