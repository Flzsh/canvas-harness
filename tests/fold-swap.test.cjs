'use strict';
// Room folds and opens (fold-freeze fix, 2026-10-28): the render that swaps a room's page for Home (or Home for a room)
// was one long task, 1.4-2.7 s at 4x CPU. These pin the parts of the fix that need no browser: the page swap hides the
// outgoing page at once and removes it later, with every other render unchanged.
const {test}=require('node:test'),assert=require('node:assert/strict');

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

// ---- speed (2026-11-05): pointer mode before the click
test('the first real mouse movement puts the page in pointer mode while it is idle, before any click',()=>{
 const f=dashboard({courseId:'all'});f.container.dataset.input='keyboard';
 const move=(x,y)=>f.container.events.get('pointermove')({pointerType:'mouse',clientX:x,clientY:y,target:f.container,composedPath:()=>[f.container]});
 move(100,100);move(110,104);f.tick(2000);assert.equal(f.container.dataset.input,'keyboard','a few pixels of movement change nothing');
 move(140,120);f.tick(2000);f.tick(2000);assert.equal(f.container.dataset.input,'pointer','a real movement switches, in idle time');
});
test('a pen or touch movement leaves the input mode to the press',()=>{
 const f=dashboard({courseId:'all'});f.container.dataset.input='keyboard';
 const move=(x,y)=>f.container.events.get('pointermove')({pointerType:'touch',clientX:x,clientY:y,target:f.container,composedPath:()=>[f.container]});
 move(100,100);move(200,200);f.tick(2000);f.tick(2000);assert.equal(f.container.dataset.input,'keyboard');
});
