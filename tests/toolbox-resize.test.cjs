'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createStore,validateBackup}=require('../extension/storage.js');
const sourcePath=path.join(__dirname,'../extension/toolbox-resize.js');
function api(){assert.ok(fs.existsSync(sourcePath),'The resize helper must exist');return require(sourcePath);}
const plain=value=>JSON.parse(JSON.stringify(value)),tick=()=>new Promise(setImmediate);

// DOM boundary fixture: listeners, pointer capture, style, and node identity.
// The controller and account store are real; browser rendering belongs to the parent.
function surface(width=1400,height=900){
 class Target{
  constructor(){this.events=new Map();}
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);}
  removeEventListener(type,fn){this.events.get(type)?.delete(fn);}
  dispatch(type,props={}){const event={type,target:this,button:0,isPrimary:true,pointerId:1,clientX:800,clientY:200,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...props};for(const fn of [...this.events.get(type)||[]])fn(event);return event;}
  listenerCount(){return [...this.events.values()].reduce((n,set)=>n+set.size,0);}
 }
 const window=new Target(),document=new Target(),timers=new Map();let nextTimer=0;
 Object.assign(window,{innerWidth:width,innerHeight:height,setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 document.defaultView=window;document.hidden=false;
 class Element extends Target{
  constructor(tag){super();this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.dataset={};this.attrs={};this.hidden=false;this.open=true;this.captures=new Set();const props=new Map();this.style={setProperty:(k,v)=>props.set(k,v),getPropertyValue:k=>props.get(k)||'',getPropertyPriority:()=>'',removeProperty:k=>props.delete(k)};}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
  append(...nodes){for(const node of nodes)this.insertBefore(node,null);}
  insertBefore(node,before){node.remove();const index=before?this.children.indexOf(before):this.children.length;assert.ok(index>=0);this.children.splice(index,0,node);node.parentNode=this;}
  remove(){if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  querySelectorAll(selector){const matches=node=>selector.startsWith('.')?node.className===selector.slice(1):selector==='[data-ui-action="collapse"]'?node.dataset.uiAction==='collapse':selector==='option'?node.tagName==='OPTION':false;return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
  setPointerCapture(id){if(this.captureFails)throw Error('Capture unavailable');this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);this.dispatch('lostpointercapture',{pointerId:id});}
 }
 document.createElement=tag=>new Element(tag);
 const container=new Element('main'),dialog=new Element('dialog'),actions=new Element('div'),collapse=new Element('button');
 actions.className='rd-utility-heading-actions';collapse.dataset.uiAction='collapse';actions.append(collapse);dialog.append(actions);container.append(dialog);dialog.dataset.collapsed='false';
 return {window,document,container,dialog,actions,collapse,timers,runTimers(){const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();}};
}
function memory(){const values=new Map(),writes=[];return {values,writes,fail:false,async read(key){return structuredClone(values.get(key));},async write(key,value){if(this.fail)throw Error('Disk full');values.set(key,structuredClone(value));writes.push(structuredClone(value));}};}
async function fixture(t,{width=1400,height=900,dockSize,accountId='1',adapter=memory(),store}={}){
 const f=surface(width,height);store??=createStore({accountId,adapter});await store.load();if(dockSize)await store.update(data=>{data.toolbox.dockSize=dockSize;});adapter.writes.length=0;
 assert.ok(fs.existsSync(sourcePath),'The resize helper must exist');const root={...f.window};Object.assign(root,{setTimeout:f.window.setTimeout,clearTimeout:f.window.clearTimeout});
 vm.runInNewContext(fs.readFileSync(sourcePath,'utf8'),root,{filename:'toolbox-resize.js'});
 const sizes=[],helper=root.ReserveToolboxResize.create({dialog:f.dialog,container:f.container,store,onSize:value=>sizes.push(plain(value))});
 const handles=Object.fromEntries(f.dialog.querySelectorAll('.rd-dock-resize').map(node=>[node.dataset.resize,node])),select=f.actions.querySelector('.rd-dock-size');
 t.after(()=>{helper.destroy();store.destroy();});return {...f,store,adapter,sizes,helper,handles,select,size:()=>plain(helper.getSize())};
}

test('desktop defaults and explicit sizes reserve space for the Canvas rail, main page and dock clearance',()=>{
 const {resolveSize}=api();
 assert.deepEqual(resolveSize({}, {width:1400,height:900}),{width:406,height:868});
 assert.deepEqual(resolveSize({}, {width:1000,height:700}),{width:360,height:668});
 assert.deepEqual(resolveSize({}, {width:2000,height:1000}),{width:460,height:968});
 assert.deepEqual(resolveSize({width:9999,height:9999},{width:1000,height:700}),{width:440,height:668});
 assert.deepEqual(resolveSize({width:1,height:1},{width:1400,height:900}),{width:320,height:320});
 assert.deepEqual(resolveSize({width:NaN,height:-1},{width:1400,height:900}),{width:406,height:868});
});
test('narrow viewports force width and cap stale heights including very short screens',()=>{
 const {resolveSize}=api();
 assert.deepEqual(resolveSize({}, {width:900,height:800}),{width:876,height:368});
 assert.deepEqual(resolveSize({width:9000,height:9000},{width:390,height:800}),{width:366,height:600});
 assert.deepEqual(resolveSize({width:800,height:1},{width:390,height:800}),{width:366,height:240});
 assert.deepEqual(resolveSize({width:800,height:9000},{width:390,height:200}),{width:366,height:150});
 assert.deepEqual(resolveSize({}, {width:1000,height:250}),{width:360,height:218});
});
test('handles expose effective accessible limits and presets precede collapse',async t=>{
 const f=await fixture(t);assert.deepEqual(f.size(),{width:406,height:868});assert.deepEqual(f.sizes,[{width:406,height:868}]);
 assert.equal(f.container.style.getPropertyValue('--rd-dock-width'),'406px');assert.equal(f.container.style.getPropertyValue('--rd-dock-height'),'868px');
 for(const [axis,orientation,name,min,max,now] of [['width','vertical','Toolbox width','320','840','406'],['height','horizontal','Toolbox height','320','868','868']]){
  const h=f.handles[axis];assert.equal(h.getAttribute('role'),'separator');assert.equal(h.getAttribute('aria-orientation'),orientation);assert.equal(h.getAttribute('aria-label'),name);assert.equal(h.getAttribute('aria-valuemin'),min);assert.equal(h.getAttribute('aria-valuemax'),max);assert.equal(h.getAttribute('aria-valuenow'),now);assert.equal(h.tabIndex,0);
 }
 assert.equal(f.handles.both.title,'Resize toolbox');assert.equal(f.select.getAttribute('aria-label'),'Toolbox size');assert.equal(f.actions.children.indexOf(f.select),f.actions.children.indexOf(f.collapse)-1);
 assert.deepEqual(f.select.children.map(n=>n.textContent),['Auto','Wide','Tall','Compact','Custom']);assert.equal(f.select.children.at(-1).disabled,true);assert.equal(f.select.value,'auto');
 f.helper.refresh();assert.equal(f.sizes.length,1);const copy=f.helper.getSize();copy.width=1;assert.equal(f.size().width,406);assert.equal(f.adapter.writes.length,0);
});
test('left/top corner drag captures the pointer, changes both axes, and writes once on release',async t=>{
 const f=await fixture(t),h=f.handles.both;f.container.dataset.input='keyboard';const e=h.dispatch('pointerdown');assert.equal(f.container.dataset.input,'pointer');assert.equal(e.defaultPrevented,true);assert.equal(h.hasPointerCapture(1),true);assert.equal(f.dialog.dataset.resizing,'true');assert.equal(f.container.dataset.resizing,'true');
 f.window.dispatch('pointermove',{clientX:700,clientY:150});assert.deepEqual(f.size(),{width:506,height:868});
 f.window.dispatch('pointermove',{pointerId:2,clientX:0,clientY:0});assert.equal(f.size().width,506);
 f.window.dispatch('pointermove',{clientX:650,clientY:100});assert.deepEqual(f.size(),{width:556,height:868});assert.equal(f.adapter.writes.length,0);
 f.window.dispatch('pointerup',{clientX:640,clientY:90});await tick();assert.deepEqual(plain(f.store.get().toolbox.dockSize),{width:566,height:0});assert.equal(f.adapter.writes.length,1);assert.equal(h.hasPointerCapture(1),false);assert.equal(f.dialog.dataset.resizing,undefined);assert.equal(f.container.dataset.resizing,undefined);assert.equal(f.select.value,'custom');
});
test('axis handles resize independently and a simple click never pins an automatic size',async t=>{
 const f=await fixture(t);f.handles.width.dispatch('pointerdown');f.window.dispatch('pointerup');await tick();assert.equal(f.adapter.writes.length,0);
 f.handles.width.dispatch('pointerdown');f.window.dispatch('pointermove',{clientX:750,clientY:0});f.window.dispatch('pointerup',{clientX:750,clientY:0});await tick();assert.deepEqual(plain(f.store.get().toolbox.dockSize),{width:456,height:0});
 f.handles.height.dispatch('pointerdown');f.window.dispatch('pointerup',{clientX:0,clientY:300});await tick();assert.deepEqual(plain(f.store.get().toolbox.dockSize),{width:456,height:768});
});
test('dragging edges beyond zero clamps at the minimum instead of jumping to automatic size',async t=>{
 const f=await fixture(t);f.handles.both.dispatch('pointerdown');f.window.dispatch('pointermove',{clientX:3000,clientY:3000});assert.deepEqual(f.size(),{width:320,height:320});
 f.window.dispatch('pointermove',{clientX:-3000,clientY:-3000});assert.deepEqual(f.size(),{width:840,height:868});assert.equal(f.adapter.writes.length,0);
 f.window.dispatch('pointerup',{clientX:3000,clientY:3000});await tick();assert.deepEqual(plain(f.store.get().toolbox.dockSize),{width:320,height:320});
});
test('returning to the starting point does not pin automatic dimensions or save a no-op drag',async t=>{
 const f=await fixture(t);f.handles.both.dispatch('pointerdown');f.window.dispatch('pointermove',{clientX:700,clientY:150});f.window.dispatch('pointerup');await tick();
 assert.deepEqual(f.size(),{width:406,height:868});assert.equal(f.adapter.writes.length,0);assert.equal(f.select.value,'auto');
});
test('keyboard resize follows anchored edges, debounces, and Home restores automatic sizing per axis',async t=>{
 const f=await fixture(t);f.container.dataset.input='pointer';assert.equal(f.handles.width.dispatch('keydown',{key:'ArrowLeft'}).defaultPrevented,true);assert.equal(f.container.dataset.input,'keyboard');assert.equal(f.size().width,422);
 f.handles.width.dispatch('keydown',{key:'ArrowLeft',shiftKey:true});assert.equal(f.size().width,470);f.handles.width.dispatch('keydown',{key:'ArrowRight'});assert.equal(f.size().width,454);
 f.handles.height.dispatch('keydown',{key:'ArrowDown',shiftKey:true});assert.equal(f.size().height,820);assert.equal(f.adapter.writes.length,0);assert.equal(f.timers.size,1);
 f.runTimers();await tick();assert.equal(f.adapter.writes.length,1);assert.deepEqual(plain(f.store.get().toolbox.dockSize),{width:454,height:820});
 f.handles.width.dispatch('keydown',{key:'Home'});f.handles.height.dispatch('keydown',{key:'Home'});assert.deepEqual(f.size(),{width:406,height:868});f.runTimers();await tick();assert.deepEqual(plain(f.store.get().toolbox.dockSize),{width:0,height:0});assert.equal(f.select.value,'auto');
 assert.equal(f.handles.width.dispatch('keydown',{key:'ArrowUp'}).defaultPrevented,false);assert.equal(f.handles.height.dispatch('keydown',{key:'ArrowUp',ctrlKey:true}).defaultPrevented,false);
});
test('responsive changes clamp without overwriting desktop preferences or collapsed state',async t=>{
 const f=await fixture(t,{dockSize:{width:850,height:840}});f.dialog.dataset.collapsed='true';f.window.innerWidth=390;f.window.innerHeight=800;f.window.dispatch('resize');
 assert.deepEqual(f.size(),{width:366,height:600});assert.equal(f.dialog.dataset.collapsed,'true');assert.equal(f.handles.width.hidden,true);assert.equal(f.handles.both.hidden,true);assert.equal(f.handles.height.hidden,true);
 f.dialog.dataset.collapsed='false';f.helper.refresh();assert.equal(f.handles.height.hidden,false);f.handles.width.dispatch('keydown',{key:'ArrowLeft'});assert.equal(f.size().width,366);
 f.handles.width.dispatch('pointerdown');assert.equal(f.container.dataset.resizing,undefined);f.window.innerWidth=1400;f.window.innerHeight=900;f.window.dispatch('resize');assert.deepEqual(f.size(),{width:840,height:840});assert.equal(f.handles.width.hidden,false);assert.equal(f.adapter.writes.length,0);
});
test('narrow mode permits only height resizing and retains an explicit desktop width',async t=>{
 const f=await fixture(t,{width:390,height:800,dockSize:{width:850,height:0}});f.handles.both.dispatch('pointerdown');assert.equal(f.dialog.dataset.resizing,undefined);
 f.handles.height.dispatch('pointerdown');f.window.dispatch('pointerup',{clientY:100});await tick();assert.deepEqual(f.size(),{width:366,height:468});assert.deepEqual(plain(f.store.get().toolbox.dockSize),{width:850,height:468});
 f.handles.height.dispatch('keydown',{key:'ArrowUp',shiftKey:true});f.runTimers();await tick();assert.equal(f.size().height,516);
});
for(const reason of ['pointercancel','lostpointercapture','blur','Escape','visibilitychange','close','collapse','resize'])test(`drag ${reason} restores starting size and cleans up without saving`,async t=>{
 const f=await fixture(t);f.handles.both.dispatch('pointerdown');f.window.dispatch('pointermove',{clientX:600,clientY:400});
 if(reason==='lostpointercapture')f.handles.both.dispatch(reason);
 else if(reason==='Escape')f.window.dispatch('keydown',{key:'Escape'});
 else if(reason==='visibilitychange'){f.document.hidden=true;f.document.dispatch(reason);}
 else if(reason==='close'){f.dialog.open=false;f.dialog.dispatch(reason);}
 else if(reason==='collapse'){f.dialog.dataset.collapsed='true';f.helper.refresh();}
 else f.window.dispatch(reason);
 await tick();assert.deepEqual(f.size(),{width:406,height:868});assert.equal(f.adapter.writes.length,0);assert.equal(f.handles.both.hasPointerCapture(1),false);assert.equal(f.container.dataset.resizing,undefined);assert.equal(f.dialog.dataset.resizing,undefined);
 f.window.dispatch('pointerup',{clientX:0});await tick();assert.equal(f.adapter.writes.length,0);
});
test('secondary pointers, capture failure, and missing pointer buttons leave no drag behind',async t=>{
 const f=await fixture(t);for(const props of [{button:2},{isPrimary:false}]){f.handles.width.dispatch('pointerdown',props);assert.equal(f.dialog.dataset.resizing,undefined);}
 f.handles.width.captureFails=true;f.handles.width.dispatch('pointerdown');assert.equal(f.dialog.dataset.resizing,undefined);f.handles.width.captureFails=false;
 f.handles.width.dispatch('pointerdown');f.window.dispatch('pointermove',{clientX:500,buttons:0});assert.equal(f.dialog.dataset.resizing,undefined);assert.equal(f.size().width,406);assert.equal(f.adapter.writes.length,0);
});
test('presets save bounded sizes immediately and Auto clears explicit preferences',async t=>{
 const f=await fixture(t);for(const [preset,want] of [['wide',{width:640,height:868}],['tall',{width:406,height:868}],['compact',{width:360,height:420}],['auto',{width:406,height:868}]]){
  f.select.value=preset;f.select.dispatch('change');await tick();assert.deepEqual(f.size(),want);assert.equal(f.select.value,preset);
 }
 assert.equal(f.adapter.writes.length,4);assert.deepEqual(plain(f.store.get().toolbox.dockSize),{width:0,height:0});
 f.select.value='custom';f.select.dispatch('change');await tick();assert.equal(f.adapter.writes.length,4);
});
test('account reload restores size; resize and notes merge and failures preserve drafts',async t=>{
 const adapter=memory(),f=await fixture(t,{adapter});await f.store.update(d=>{d.toolbox.scratchpad='Retain this draft';d.toolbox.recent=['course:7'];d.toolbox.future={enabled:true};d.tasks['7']={notes:'Keep notes'};});adapter.writes.length=0;
 f.handles.width.dispatch('keydown',{key:'ArrowLeft'});f.runTimers();await f.store.update(d=>{d.toolbox.scratchpad='Newer draft';});await tick();
 const saved=f.store.get();assert.equal(saved.toolbox.dockSize.width,422);assert.equal(saved.toolbox.scratchpad,'Newer draft');assert.deepEqual(saved.toolbox.future,{enabled:true});assert.equal(saved.tasks['7'].notes,'Keep notes');
 const restored=await fixture(t,{adapter}),other=await fixture(t,{adapter,accountId:'2'});assert.equal(restored.size().width,422);assert.equal(other.size().width,406);
 adapter.fail=true;f.handles.height.dispatch('keydown',{key:'ArrowDown'});f.runTimers();await tick();assert.equal(f.store.get().toolbox.scratchpad,'Newer draft');assert.equal(f.store.get().toolbox.dockSize.height,0);assert.equal(f.size().height,852);assert.match(f.select.title,/could not be saved/i);
});
test('external updates refresh dimensions but cannot reset an active resize or pending keyboard edit',async t=>{
 const f=await fixture(t);await f.store.update(d=>{d.toolbox.dockSize={width:500,height:500};});assert.deepEqual(f.size(),{width:500,height:500});
 f.handles.width.dispatch('keydown',{key:'ArrowLeft'});await f.store.update(d=>{d.toolbox.scratchpad='Background note';});assert.equal(f.size().width,516);
 f.handles.width.dispatch('pointerdown');f.runTimers();await tick();assert.equal(f.store.get().toolbox.dockSize.width,500,'no delayed keyboard save during a drag');
 f.window.dispatch('pointermove',{clientX:700});await f.store.update(d=>{d.toolbox.scratchpad='Another note';});assert.equal(f.size().width,616);
 f.window.dispatch('pointerup',{clientX:700});await tick();assert.equal(f.store.get().toolbox.dockSize.width,616);assert.equal(f.store.get().toolbox.scratchpad,'Another note');
});
test('destroy removes listeners, timers, controls, capture and owned styles without later writes',async t=>{
 const f=await fixture(t);f.container.style.setProperty('--other','retain');f.handles.height.dispatch('keydown',{key:'ArrowDown'});f.handles.width.dispatch('pointerdown');f.window.dispatch('pointermove',{clientX:700});const calls=f.sizes.length;
 f.helper.destroy();f.helper.destroy();f.helper.refresh();f.runTimers();f.window.dispatch('resize');f.window.dispatch('pointerup');await f.store.update(d=>{d.toolbox.dockSize={width:800,height:800};});await tick();
 assert.equal(f.sizes.length,calls);assert.equal(f.window.listenerCount(),0);assert.equal(f.document.listenerCount(),0);assert.equal(f.dialog.listenerCount(),0);for(const h of Object.values(f.handles)){assert.equal(h.listenerCount(),0);assert.equal(h.hasPointerCapture(1),false);}
 assert.equal(f.timers.size,0);assert.equal(f.dialog.querySelectorAll('.rd-dock-resize').length,0);assert.equal(f.actions.querySelector('.rd-dock-size'),null);assert.equal(f.container.dataset.resizing,undefined);assert.equal(f.container.style.getPropertyValue('--rd-dock-width'),'');assert.equal(f.container.style.getPropertyValue('--other'),'retain');assert.equal(f.adapter.writes.length,1,'only the explicit external update was saved');
});

test('storage upgrades old backups and preserves safe unknown toolbox fields on edits and restore',async()=>{
 const backup={format:'reserve-backup',version:1,data:{toolbox:{scratchpad:'Existing draft',recent:['a'],future:{layout:'future'}}}};
 const clean=validateBackup(backup);assert.deepEqual(clean.toolbox.dockSize,{width:0,height:0});assert.deepEqual(clean.toolbox.future,{layout:'future'});
 const adapter=memory(),store=createStore({accountId:'123',adapter});await store.load();await store.replace({...clean,toolbox:{...clean.toolbox,dockSize:{width:800,height:1600,future:'keep'}}});
 await store.update(d=>{d.toolbox.scratchpad='Edited draft';});const imported=validateBackup(store.exportBackup(),store.owner);assert.deepEqual(imported.toolbox.dockSize,{width:800,height:1600,future:'keep'});assert.deepEqual(imported.toolbox.future,{layout:'future'});assert.deepEqual(imported.toolbox.recent,['a']);assert.equal(imported.toolbox.scratchpad,'Edited draft');store.destroy();
});
test('malformed dock backups reject atomically without losing notes',async()=>{
 const adapter=memory(),store=createStore({accountId:'321',adapter});await store.load();await store.update(d=>{d.toolbox.scratchpad='Safe';d.tasks['1']={notes:'Safe note'};});
 for(const dockSize of [null,[],false,1,'wide',{width:-1},{height:Infinity},{width:NaN},{width:'500'},{height:10001}]){
  assert.throws(()=>validateBackup({format:'reserve-backup',version:1,data:{toolbox:{dockSize}}}),/dock|size/i);
  await assert.rejects(store.update(d=>{d.toolbox.dockSize=dockSize;d.toolbox.scratchpad='Should not replace';}),/dock|size/i);
 }
 assert.equal(store.get().toolbox.scratchpad,'Safe');assert.equal(store.get().tasks['1'].notes,'Safe note');assert.deepEqual(store.get().toolbox.dockSize,{width:0,height:0});store.destroy();
});
