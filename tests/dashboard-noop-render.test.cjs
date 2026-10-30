'use strict';
// A render that changes nothing writes nothing. A write of the same value still queues a MutationRecord in a browser,
// and the pony (pets.js), media and nav observers each wake for it: the pony re-measured the whole page after every
// such render. Every write a real DOM would report is counted here, with whether the value was already there.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./dashboard-heading-fixture.cjs');

function setup({nav='dock',theme='dark'}={}){
 const frames=new Map();let seq=0;
 const f=fixture({assignments:[{id:'1',course_id:'10',name:'Late lab',due_at:'2026-10-16T10:00:00Z'},{id:'2',course_id:'20',name:'Next reading',due_at:'2026-10-18T10:00:00Z'}],setup({env,store,snapshot}){
  env.ReserveCustomization={defaults:{courseNavigation:'sidebar',dockSize:'medium',dockStyle:'tiles',dockLively:true}};
  env.ReserveMotion={create:()=>({syncTabs(){},cancel(){},reveal(){},destroy(){}})};
  // settings-dock.js is not loaded here: a plain stand-in opens and closes Make it yours through the dashboard's own onChange.
  env.ReserveSettingsDock={render:()=>'',createDock:({onChange})=>{let open=false;const set=v=>{open=v;onChange(v);};return {toggle(){set(!open);},open(){set(true);},close(){if(open)set(false);},sync(){},handleKeydown(){return false;},destroy(){}};}};
  env.requestAnimationFrame=fn=>{const id=++seq;frames.set(id,fn);return id;};env.cancelAnimationFrame=id=>frames.delete(id);
  store.update(data=>{Object.assign(data.settings,{courseNavigation:nav,motion:'gentle',theme,nightArt:30});});
  snapshot.courses=[{id:'10',name:'Chemistry'},{id:'20',name:'History'},{id:'40',name:'Ethics'}];
  env.ReserveCourseArt.mini=(course,{place})=>`<svg class="rd-mini" data-place="${place}" data-course="${course.id}"></svg>`;
 }});
 const flush=()=>{for(let i=0;i<5&&frames.size;i++){const work=[...frames.values()];frames.clear();for(const fn of work)fn();}};
 flush();f.tick(0);flush();
 let on=false;const log=[];
 const proto=Object.getPrototypeOf(f.container),live=n=>!!n&&(n===f.container||f.container.contains(n));
 const name=n=>n?.nodeType===1?n.nodeName.toLowerCase()+(n.getAttribute('class')?'.'+n.getAttribute('class').split(/\s+/)[0]:''):String(n?.nodeName);
 const wrap=(method,fn)=>{const orig=proto[method];proto[method]=function(...args){if(on&&live(this))fn(this,args);return orig.apply(this,args);};};
 wrap('setAttribute',(el,[k,v])=>log.push(`${el.getAttribute(k)===String(v)?'same':'changed'} ${name(el)} ${k}`));
 wrap('removeAttribute',(el,[k])=>{if(el.hasAttribute(k))log.push(`changed ${name(el)} -${k}`);});
 // Building a template is not a mutation; an empty fragment inserts nothing.
 wrap('insertBefore',(el,[node])=>{if(!(node?.nodeType===11&&!node.childNodes.length))log.push(`childList ${name(el)} +${name(node)}`);});
 wrap('remove',el=>{if(el.parentNode)log.push(`childList ${name(el.parentNode)} -${name(el)}`);});
 const text=Object.getOwnPropertyDescriptor(proto,'textContent');
 Object.defineProperty(proto,'textContent',{get:text.get,set(v){if(on&&live(this))log.push(`${text.get.call(this)===String(v??'')?'same':'changed'} ${name(this)} text`);text.set.call(this,v);},configurable:true});
 // The fixture keeps these reflected properties as plain fields; in a browser each set writes the attribute.
 for(const prop of ['tabIndex','inert','open']){const key=Symbol(prop);Object.defineProperty(proto,prop,{get(){return this[key];},set(v){if(on&&live(this))log.push(`${this[key]===v?'same':'changed'} ${name(this)} ${prop}`);this[key]=v;},configurable:true});}
 for(const n of [f.container,...f.container.querySelectorAll('*')])for(const prop of ['tabIndex','inert','open'])if(Object.hasOwn(n,prop)){const v=n[prop];delete n[prop];n[prop]=v;}
 const style=f.container.style,set=style.setProperty,unset=style.removeProperty;
 style.setProperty=function(k,v){if(on)log.push(`${this.getPropertyValue(k)===String(v)?'same':'changed'} style ${k}`);return set.call(this,k,v);};
 style.removeProperty=function(k){if(on&&this.getPropertyValue(k))log.push(`changed style -${k}`);return unset.call(this,k);};
 const watch=fn=>{log.length=0;on=true;try{fn();flush();f.tick(0);flush();}finally{on=false;}return log.slice();};
 return {f,flush,watch};
}

for(const [nav,theme] of [['dock','dark'],['sidebar','light'],['topbar','dark']]){
 test(`a render that changes nothing writes nothing (${nav}, ${theme})`,t=>{
  const s=setup({nav,theme});t.after(()=>s.f.dashboard.destroy());
  const liveRegion=s.f.container.querySelector('[data-rd-list-live]');
  s.watch(()=>s.f.dashboard.updateSnapshot(s.f.snapshot));
  const writes=s.watch(()=>s.f.dashboard.updateSnapshot(s.f.snapshot));
  assert.deepEqual(writes,[]);
  // The polite live region is the same node, still in the dashboard, with the same words (node checks use assert.ok:
  // a failing assert.equal on two fixture nodes tries to print their whole cyclic tree).
  assert.ok(s.f.container.querySelector('[data-rd-list-live]')===liveRegion,'the live region was replaced');assert.match(liveRegion.textContent,/items? shown\./);
 });
}

test('a render that does change something still writes it: tabs, settings button, dock focus, night art, live region',async t=>{
 const s=setup({nav:'dock',theme:'dark'});t.after(()=>s.f.dashboard.destroy());const c=s.f.container;
 // The fixture does not reflect tabindex: the first render's markup carries the attribute, later renders the property.
 const index=el=>el.tabIndex??Number(el.getAttribute('tabindex'));
 const tabs=()=>Array.from(c.querySelectorAll('.t-tab')),selected=()=>tabs().filter(tab=>tab.getAttribute('aria-selected')==='true').map(tab=>tab.dataset.tab);
 assert.deepEqual(selected(),['work']);assert.equal(index(tabs().find(tab=>tab.dataset.tab==='work')),0);
 const changed=s.watch(()=>s.f.click('workspace',{tab:'grades'}));
 assert.deepEqual(selected(),['grades']);assert.deepEqual(tabs().filter(tab=>index(tab)===0).map(tab=>tab.dataset.tab),['grades']);
 assert.ok(changed.includes('changed button.rd-workspace-tab aria-selected'));assert.ok(!changed.some(line=>line.startsWith('same ')),changed.join('\n'));
 s.watch(()=>s.f.click('workspace',{tab:'work'}));assert.deepEqual(selected(),['work']);
 // One dock item stays reachable by Tab, and it follows the chosen course.
 const items=()=>Array.from(c.querySelectorAll('.rd-dock-it'));assert.deepEqual(items().filter(it=>index(it)===0).map(it=>it.dataset.id),['10']);
 s.watch(()=>s.f.click('course',{id:'20'}));assert.deepEqual(items().filter(it=>index(it)===0).map(it=>it.dataset.id),['20']);
 // The settings button mirrors the panel.
 const settings=c.querySelector('[data-rd-action="settings"]');assert.equal(settings.getAttribute('aria-expanded'),'false');
 s.watch(()=>s.f.click('settings'));assert.equal(settings.getAttribute('aria-expanded'),'true');assert.equal(c.querySelector('.rd-appearance').dataset.open,'true');assert.equal(c.querySelector('.t-acc-panel').inert,false);
 s.watch(()=>s.f.click('settings'));assert.equal(settings.getAttribute('aria-expanded'),'false');assert.equal(c.querySelector('.t-acc-panel').inert,true);assert.equal(c.querySelector('.t-acc-panel').getAttribute('aria-hidden'),'true');
 // Night art: chalk numbers in dark mode, none of them in light mode.
 assert.equal(c.dataset.night,'chalk');assert.notEqual(c.style.getPropertyValue('--rd-chalk'),'');
 await s.f.store.update(data=>{data.settings.theme='light';});s.flush();
 assert.equal(c.dataset.theme,'light');assert.equal(c.dataset.night,undefined);assert.equal(c.style.getPropertyValue('--rd-chalk'),'');assert.equal(c.style.getPropertyValue('--rd-night-wash'),'');
 await s.f.store.update(data=>{data.settings.theme='dark';data.settings.nightArt=80;});s.flush();
 assert.equal(c.dataset.night,'paper');assert.equal(c.style.getPropertyValue('--rd-chalk'),'#A89F8C');assert.notEqual(c.style.getPropertyValue('--rd-night-b'),'');
 // Motion off still reaches the container (motion.js and the pony read it there).
 await s.f.store.update(data=>{data.settings.motion='off';});s.flush();assert.equal(c.dataset.motionStyle,'off');
 // The live region keeps its node and its words follow the list.
 const region=c.querySelector('[data-rd-list-live]'),before=region.textContent;
 s.f.dashboard.updateSnapshot({...s.f.snapshot,assignments:s.f.snapshot.assignments.slice(0,1)});s.flush();s.f.tick(0);s.flush();
 assert.ok(c.querySelector('[data-rd-list-live]')===region,'the live region was replaced');assert.equal(c.querySelectorAll('[data-rd-list-live]').length,1);assert.notEqual(region.textContent,before);
});
