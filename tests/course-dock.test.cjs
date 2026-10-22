'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./dashboard-heading-fixture.cjs');
function setup({motion='gentle',reduced=false,narrow=false,motionEnabled=true,arrangeEnabled=true,dockSize='medium'}={}){
 const frames=new Map(),listeners=new Map(),media=new Map();let seq=0,reads=0,widthReads=0;
 const f=fixture({assignments:[{id:'1',course_id:'10',name:'Late lab',due_at:'2026-10-16T10:00:00Z'},{id:'2',course_id:'20',name:'Next reading',due_at:'2026-10-18T10:00:00Z'},{id:'3',course_id:'30',name:'Hidden',due_at:'2026-10-16T10:00:00Z'}],setup({env,store,snapshot}){
  env.ReserveWorkspaceArrange={...require('../extension/workspace-arrange.js'),controls:()=>''};
  vm.runInContext(fs.readFileSync(require.resolve('../extension/dashboard.js'),'utf8'),env,{filename:'dashboard.js'});
  env.ReserveCustomization={defaults:{courseNavigation:'sidebar',dockSize:'medium'}};env.ReserveFeatures={enabled:id=>(id!=='motion'||motionEnabled)&&(id!=='arrange'||arrangeEnabled)};env.ReserveMotion={create:()=>({syncTabs(){},cancel(){},reveal(){},destroy(){}})};
  env.requestAnimationFrame=fn=>{const id=++seq;frames.set(id,fn);return id;};env.cancelAnimationFrame=id=>frames.delete(id);
  env.addEventListener=(name,fn)=>listeners.set(name,fn);env.removeEventListener=(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);};
  env.matchMedia=q=>{if(!media.has(q))media.set(q,{matches:/reduced-motion/.test(q)?reduced:narrow,events:new Map(),addEventListener(name,fn){this.events.set(name,fn);},removeEventListener(name){this.events.delete(name);}});return media.get(q);};
  env.innerWidth=narrow?390:1400;store.update(data=>{Object.assign(data.settings,{courseNavigation:'dock',dockSize,motion,courseOrder:['20','30','10','40'],hiddenCourses:['30']});});
  snapshot.courses=[{id:'10',name:'Chemistry studio'},{id:'20',name:'History seminar'},{id:'30',name:'Hidden course'},{id:'40',name:'Ethics seminar'}];
  env.ReserveCourseArt.mini=(course,{place})=>`<svg class="rd-mini" data-place="${place}" data-course="${course.id}"></svg>`;
 }});
 const flush=()=>{const work=[...frames.values()];frames.clear();for(const fn of work)fn();};flush();f.tick(0);
 const dock=()=>f.container.querySelector('.rd-dock'),items=()=>Array.from(dock().querySelectorAll('.rd-dock-it'));
 for(const [i,it] of items().entries()){Object.defineProperty(it,'offsetWidth',{get(){reads++;widthReads++;return 54;}});it.getBoundingClientRect=()=>{reads++;return {left:100+i*62,width:54,right:154+i*62};};}
 const event=(name,extra={})=>dock().events.get(name)?.({pointerType:'mouse',clientX:127,target:items()[0],...extra});
 const key=(it,key,extra={})=>{const ev={target:it,key,preventDefault(){this.prevented=true;},...extra};f.events.get('keydown')(ev);return ev;};
 return {f,frames,flush,dock,items,event,key,listeners,media,get reads(){return reads;},get widthReads(){return widthReads;},get requestedFrames(){return seq;}};
}
test('dock renders ordered visible courses with the same counts/tones, full names, short labels and selected dot',t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());assert.equal(s.f.container.dataset.courseNavigation,'dock');assert.equal(s.dock().tagName,'NAV');assert.equal(s.dock().getAttribute('aria-label'),'Courses');assert.equal(s.f.container.querySelector('.rd-course-rail'),null);
 assert.deepEqual(s.items().map(it=>it.dataset.id),['all','20','10','40']);assert.match(s.dock().getAttribute('style'),/--rd-dock-n:4/);assert.equal(s.dock().children[2].className,'rd-dock-sep');
 const [all,history,chemistry,ethics]=s.items();assert.equal(all.querySelector('.rd-dock-seal').textContent,'2');assert.equal(all.querySelector('.rd-dock-seal').dataset.tone,'danger');assert.equal(history.querySelector('.rd-dock-seal').dataset.tone,'neutral');assert.equal(chemistry.querySelector('.rd-dock-seal').dataset.tone,'danger');assert.equal(ethics.querySelector('.rd-dock-seal'),null);
 assert.match(chemistry.getAttribute('aria-label'),/Chemistry studio, 1 open, 1 overdue/);assert.equal(chemistry.querySelector('.rd-dock-name').textContent,'Chemistry studio');assert.equal(chemistry.querySelector('.rd-mini').dataset.place,'dock');assert.equal(chemistry.classList.contains('on'),true);assert.equal(s.items().filter(it=>it.tabIndex===0).length,1);
});
test('dock uses shared course selection and switches all three placements without duplicating navigation',async t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());const history=s.items()[1];s.f.click('course',{id:'20'});s.flush();assert.equal(s.f.dashboard.getState().courseId,'20');assert.equal(s.items()[1],history);assert.equal(history.getAttribute('aria-pressed'),'true');assert.equal(history.classList.contains('on'),true);
 for(const navigation of ['sidebar','topbar','dock']){await s.f.store.update(data=>{data.settings.courseNavigation=navigation;});s.flush();assert.equal(s.f.container.dataset.courseNavigation,navigation);assert.equal(s.f.container.querySelectorAll('.rd-course-rail,.rd-dock').length,1);assert.equal(!!s.dock(),navigation==='dock');assert.equal(s.f.dashboard.getState().courseId,'20');}
});
test('dock roves focus with arrows/Home/End; Enter and Space select; modified keys stay native',t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());let [all,history,chemistry,ethics]=s.items();chemistry.focus();assert.ok(s.key(chemistry,'ArrowRight').prevented);assert.equal(s.f.document.activeElement,ethics);assert.equal(s.f.dashboard.getState().courseId,'10');assert.equal(s.items().filter(it=>it.tabIndex===0).length,1);
 s.key(ethics,'ArrowRight');assert.equal(s.f.document.activeElement,all);s.key(all,'End');assert.equal(s.f.document.activeElement,ethics);s.key(ethics,'Home');assert.equal(s.f.document.activeElement,all);s.key(all,'ArrowLeft');assert.equal(s.f.document.activeElement,ethics);
 s.key(ethics,'Enter');assert.equal(s.f.dashboard.getState().courseId,'40');s.key(history,' ');assert.equal(s.f.dashboard.getState().courseId,'20');assert.equal(s.key(history,'ArrowRight',{altKey:true}).prevented,undefined);
});
test('dock keyboard navigation follows the composed target through the extension shadow host',t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());const chemistry=s.items()[2];s.key(chemistry,'End',{target:s.f.container,composedPath:()=>[chemistry,s.dock(),s.f.container]});assert.equal(s.f.document.activeElement,s.items()[3]);
});
test('pointer moves across the shelf and its edges never write styles, measure tiles or schedule frames',t=>{
 for(const options of [{},{reduced:true},{motion:'still'},{motion:'off'},{motionEnabled:false},{narrow:true}])for(const pointerType of ['mouse','touch','pen']){
  const s=setup(options);t.after(()=>s.f.dashboard.destroy());const writes=[],requested=s.requestedFrames;for(const el of [...s.items(),s.dock().querySelector('.rd-dock-sep'),s.dock()])el.style=new Proxy(el.style,{set(style,key,value){writes.push([el,key]);style[key]=value;return true;}});
  s.event('pointerenter',{pointerType});for(const clientX of [-1,0,100,127,189,480,1401])s.event('pointermove',{pointerType,clientX});s.event('pointerleave',{pointerType});assert.equal(s.requestedFrames,requested);assert.equal(s.frames.size,0);s.flush();assert.deepEqual(writes,[]);assert.equal(s.reads,0);assert.ok(s.items().every(it=>!it.style.transform));assert.ok(!s.dock().style.paddingInline);
 }
});
test('ordinary data refresh preserves the dock without tile measurements, transforms or padding',async t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());s.event('pointerenter');s.event('pointermove');s.flush();const reads=s.reads,dock=s.dock(),it=s.items()[0],transform=it.style.transform,padding=dock.style.paddingInline;s.f.dashboard.updateSnapshot(s.f.snapshot);s.flush();assert.equal(s.dock(),dock);assert.equal(s.items()[0],it);assert.equal(s.reads,reads);assert.equal(it.style.transform,transform);assert.equal(dock.style.paddingInline,padding);
});
test('course dock placement stays over the dashboard without changing the toolbox width token',t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());assert.equal(s.f.container.style.getPropertyValue('--rd-dock-width'),'');s.f.container.style.setProperty('--rd-dock-width','420px');s.listeners.get('resize')();assert.equal(s.f.container.style.getPropertyValue('--rd-dock-width'),'420px');assert.equal(s.f.container.style.getPropertyValue('--rd-dock-center'),'240px');assert.equal(s.f.container.style.getPropertyValue('--rd-dock-available'),'480px');
});
test('the same dock handles many courses and the empty course list with a single reachable All courses button',t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());s.f.dashboard.updateSnapshot({...s.f.snapshot,courses:Array.from({length:60},(_,i)=>({id:String(i+100),name:'Course '+i}))});s.flush();assert.equal(s.items().length,61);assert.match(s.dock().getAttribute('style'),/--rd-dock-n:61/);assert.equal(s.items().filter(it=>it.tabIndex===0).length,1);
 s.f.dashboard.updateSnapshot({...s.f.snapshot,courses:[]});s.flush();assert.deepEqual(s.items().map(it=>it.dataset.id),['all']);assert.equal(s.items()[0].tabIndex,0);assert.equal(s.items()[0].querySelector('.rd-dock-seal'),null);assert.equal(s.items()[0].getAttribute('aria-label'),'All courses, 0 open');
});
test('dock size changes reach the dashboard token selector without replacing the dock or selected course',async t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());const dock=s.dock(),it=s.items()[2];assert.equal(s.f.container.dataset.dockSize,'medium');for(const dockSize of ['small','medium','large']){await s.f.store.update(data=>{data.settings.dockSize=dockSize;});s.flush();assert.equal(s.f.container.dataset.dockSize,dockSize);assert.equal(s.dock(),dock);assert.equal(s.items()[2],it);assert.equal(s.f.dashboard.getState().courseId,'10');assert.equal(s.frames.size,0);}
});
test('the dock size radio change saves immediately and respects the Arrange feature gate',async t=>{
 for(const arrangeEnabled of [true,false]){const s=setup({arrangeEnabled});t.after(()=>s.f.dashboard.destroy());for(const value of ['small','large','medium']){s.f.container.events.get('change')({target:{dataset:{rdField:'setting',setting:'dockSize'},type:'radio',value}});for(let i=0;i<8;i++)await Promise.resolve();s.flush();assert.equal(s.f.store.get().settings.dockSize,arrangeEnabled?value:'medium');assert.equal(s.f.container.dataset.dockSize,arrangeEnabled?value:'medium');}}
});
test('layout presets and Reset layout choices restore medium dock size',async t=>{
 const s=setup({dockSize:'large'});t.after(()=>s.f.dashboard.destroy());const model=require('../extension/customization-model.js'),arrange=require('../extension/workspace-arrange.js');Object.assign(s.f.env.ReserveCustomization,model);Object.assign(s.f.env.ReserveWorkspaceArrange,{snapshot:arrange.snapshot,resetCore:arrange.resetCore});for(const action of ['layout-preset','layout-reset']){await s.f.store.update(data=>{data.settings.dockSize='large';});s.flush();const button=s.f.document.createElement('button');Object.assign(button.dataset,{rdAction:action,value:'studio'});s.f.container.events.get('click')({target:button,detail:0,preventDefault(){}});for(let i=0;i<8;i++)await Promise.resolve();s.flush();assert.equal(s.f.store.get().settings.dockSize,'medium');}
});
test('layout switches and destruction remove dock listeners without installing bounce listeners',async t=>{
 const s=setup();t.after(()=>s.f.dashboard.destroy());const dock=s.dock();assert.equal(dock.events.has('animationend'),false);await s.f.store.update(data=>{data.settings.courseNavigation='sidebar';});s.flush();assert.equal(s.dock(),null);assert.equal(dock.events.size,0);assert.equal(s.listeners.has('resize'),false);s.f.dashboard.destroy();assert.equal(s.frames.size,0);
});
test('course clicks only rove focus and never bounce or force tile width reads, including on phones',t=>{
 for(const options of [{},{reduced:true},{motion:'still'},{motion:'off'},{motionEnabled:false},{narrow:true}]){const s=setup(options);t.after(()=>s.f.dashboard.destroy());const it=s.items()[1];s.event('click',{target:it});assert.equal(it.tabIndex,0);assert.equal(s.items().filter(item=>item.tabIndex===0).length,1);assert.equal(s.reads,0);assert.ok(s.items().every(item=>!item.classList.contains('go')));s.f.click('course',{id:'20'});assert.equal(s.items()[1],it);assert.equal(it.getAttribute('aria-pressed'),'true');assert.equal(s.widthReads,0);assert.ok(s.items().every(item=>!item.classList.contains('go')));}
});
