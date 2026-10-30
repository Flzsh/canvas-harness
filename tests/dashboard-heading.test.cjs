'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./dashboard-heading-fixture.cjs');
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('all seven workspace tabs retain heading, SVGs, title and date without regenerating or restarting motion',async t=>{
 const f=fixture();t.after(()=>f.dashboard.destroy());await flush();
 const heading=f.container.querySelector('.rd-workspace-heading'),svg=heading.querySelector('.rd-art'),title=heading.querySelector('h1'),date=heading.querySelector('.rd-heading-date'),column=heading.parentNode;
 const films=f.animations.filter(a=>heading.contains(a.node));assert.ok(films.some(a=>a.options.id==='rd-art-loop'),'the real film controller starts living loops');
 f.tick(5000);const loops=films.filter(a=>a.options.id==='rd-art-loop'),observerCount=f.observers.length,timerCount=f.timers.size;
 // motion.js holds the drawings from a press until the frame after the render that answers it has painted, and for
 // ART_BUSY_MS at most (3.8 decisions); then they go on from the frame they held.
 const ART_BUSY_MS=300;
 const pony=f.document.createElement('aside');pony.className='pet-layer';f.container.append(pony);
 for(const tab of ['assignments','plan','hub','materials','inbox','grades','work']){
  column.scrollTop=350;const times=loops.map(a=>a.currentTime);
  const button=f.click('workspace',{tab});await flush();f.tick(100);
  assert.strictEqual(f.container.querySelector('.rd-workspace-heading'),heading,tab);
  assert.strictEqual(heading.querySelector('.rd-art'),svg,tab);assert.strictEqual(heading.querySelector('h1'),title,tab);assert.strictEqual(heading.querySelector('.rd-heading-date'),date,tab);
  assert.strictEqual(heading.parentNode,column);assert.strictEqual(column.firstElementChild,heading);assert.equal(heading.isConnected,true);
  assert.strictEqual(f.document.activeElement,button,'tab focus survives');assert.equal(button.getAttribute('aria-selected'),'true');assert.equal(column.getAttribute('aria-labelledby'),'rd-tab-'+tab);
  assert.equal(column.scrollTop,0,'the existing tab scroll-to-top behavior survives');
  assert.strictEqual(f.container.querySelector('.pet-layer'),pony,'the companion layer survives');
  assert.deepEqual(f.animations.filter(a=>heading.contains(a.node)),films,'no replacement film, draw-in or heading fade');
  assert.ok(loops.every(a=>!a.cancelled),'the interaction pause keeps every existing loop');
  assert.deepEqual(loops.map(a=>a.currentTime),times,'existing loops hold their frame during tab interaction');
  f.tick(ART_BUSY_MS-100+1);assert.deepEqual(loops.map(a=>a.currentTime),times,'release, by the busy cap at the latest, preserves the held frame and film origin');
  // tick runs each due timer once; the film clock created at release needs a separate turn.
  f.tick(100);assert.deepEqual(loops.map(a=>a.currentTime),times.map(time=>time+100),'the same loops resume from their held frame');
  assert.deepEqual(f.animations.filter(a=>heading.contains(a.node)),films,'resuming does not replace or restart a film');assert.ok(loops.every(a=>!a.cancelled));
  assert.equal(f.observers.length,observerCount,'no observer is added per tab');
  assert.ok(f.timers.size<=timerCount,'tab switching does not accumulate timers');
 }
 assert.equal(f.counts.scenes,1,'the banner is generated once');assert.equal(f.counts.titles,1,'the title artwork is generated once');
 column.scrollTop=275;f.dashboard.setStatus('Still connected');assert.equal(column.scrollTop,275,'ordinary renders retain workspace scroll');
 await f.store.update(data=>{data.settings.workspaceOrder=['reader','work','context'];data.settings.workspaceMode='stacked';});
 assert.strictEqual(f.container.querySelector('.rd-workspace-heading'),heading,'arrangement edits do not redraw the heading');
});

test('keyboard tab navigation preserves an unfinished drawing and its film origin',async t=>{
 const f=fixture();t.after(()=>f.dashboard.destroy());await flush();
 const heading=f.container.querySelector('.rd-workspace-heading'),films=f.animations.filter(a=>heading.contains(a.node));
 assert.ok(films.some(a=>a.options.id==='rd-art'),'initial draw-in is running');
 const home=f.container.querySelector('.rd-workspace-tab[data-tab="work"]');
 f.events.get('keydown')({key:'ArrowRight',target:home,preventDefault(){}});await flush();
 assert.strictEqual(f.container.querySelector('.rd-workspace-heading'),heading);assert.equal(f.container.dataset.workPage,'assignments');
 assert.deepEqual(f.animations.filter(a=>heading.contains(a.node)),films);
 assert.ok(films.every(a=>!a.cancelled),'keyboard navigation does not settle/restart the art');
 assert.equal(f.document.activeElement.dataset.tab,'assignments');
});

test('course, theme, artwork and heading data changes replace the shared heading',async t=>{
 const f=fixture();t.after(()=>f.dashboard.destroy());await flush();
 let heading=f.container.querySelector('.rd-workspace-heading');
 const replaced=()=>{f.tick(0);const next=f.container.querySelector('.rd-workspace-heading');assert.notStrictEqual(next,heading);assert.equal(heading.isConnected,false);heading=next;};
 f.click('course',{id:'20'});replaced();await flush();
 await f.store.update(data=>{data.settings.theme='dark';});replaced();
 await f.store.update(data=>{data.settings.coursePrefs['20']={titlePlacement:'banner',bannerArt:{svg:'synthetic changed art'}};});replaced();
 f.dashboard.updateSnapshot({...f.snapshot,courses:[f.snapshot.courses[0],{id:'20',name:'New course title'}]});f.tick(0);replaced();
 assert.match(heading.querySelector('h1').textContent,/New course title/);
 const prior=f.animations.filter(a=>a.options.id==='rd-art-loop'&&!a.node.isConnected);await flush();assert.ok(prior.every(a=>a.cancelled),'removed films are released');
});

test('All courses keeps its heading across tabs and refreshes the greeting and date when they change',async t=>{
 const f=fixture({courseId:'all'});t.after(()=>f.dashboard.destroy());await flush();
 const original=f.container.querySelector('.rd-workspace-heading');
 for(const tab of ['assignments','plan','inbox','grades','work']){f.click('workspace',{tab});assert.strictEqual(f.container.querySelector('.rd-workspace-heading'),original);}
 f.tick(3*3600000);f.dashboard.setStatus('New greeting');
 const afternoon=f.container.querySelector('.rd-workspace-heading');assert.notStrictEqual(afternoon,original);assert.match(afternoon.querySelector('h1').textContent,/Good afternoon/);
 f.tick(86400000);f.dashboard.setStatus('New date');
 const tomorrow=f.container.querySelector('.rd-workspace-heading');assert.notStrictEqual(tomorrow,afternoon);assert.notEqual(tomorrow.querySelector('.rd-heading-date').textContent,afternoon.querySelector('.rd-heading-date').textContent);
});

test('Hub and Materials keep their tools while the shared heading owns all course artwork',t=>{
 const f=fixture();t.after(()=>f.dashboard.destroy());
 for(const file of ['material-model.js','course-hub-model.js','materials-ui.js','course-hub-ui.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),f.env,{filename:file});
 const materials=f.env.ReserveMaterialsUI.create({store:f.store,user:{id:'1'}}),hub=f.env.ReserveCourseHubUI.create({store:f.store,user:{id:'1'},materials});
 t.after(()=>{materials.destroy();hub.destroy();});
 const course={id:'10',name:'Chemistry',color:'#123456'},before={...f.counts};
 const library=materials.renderLibrary(course,{sharedHeading:true}),content=hub.renderHub(course,{sharedHeading:true});
 assert.doesNotMatch(library+content,/rd-banner-art|rd-title-art|class="rd-art"/);
 assert.match(library,/Materials<\/h2>/);assert.match(library,/data-rd-action="material-refresh"/);assert.match(library,/data-rd-field="material-query"/);
 assert.match(content,/<h2>Course hub<\/h2>/);assert.match(content,/data-rd-action="hub-refresh"/);assert.match(content,/Teacher.*home page/);
 assert.equal(f.counts.scenes,before.scenes);assert.equal(f.counts.titles,before.titles);
 assert.match(materials.renderLibrary(course),/rd-banner-art/,'standalone render still has its banner');assert.match(hub.renderHub(course),/rd-banner-art/);
});

test('shared heading CSS does not depend on the active tab',()=>{
 for(const file of ['workspace.css','refresh.css','customize.css','responsive-layout.css']){
  const source=fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
  assert.doesNotMatch(source,/\.rd\[data-workspace=work\][^\n{]*\.rd-(?:workspace-heading|course-heading)/,file);
 }
 const workspace=fs.readFileSync(path.join(__dirname,'../extension/workspace.css'),'utf8');
 assert.match(workspace,/@media\(max-width:900px\)\{[^}]*\}[^}]*\}\s*\.rd\[data-workspace\] \.rd-course-select\{display:block\}/,'the visible replacement for the tablet title applies on every tab');
 assert.doesNotMatch(workspace,/\[data-workspace=work\][^\n]*\.rd-course-select/);
});

test('the shared heading summary opens the chosen assignment filter from every other workspace',async t=>{
 const f=fixture({assignments:[{id:'1',course_id:'10',name:'Synthetic overdue lab',description:'',due_at:'2026-10-16T10:00:00Z',submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}}]});
 t.after(()=>f.dashboard.destroy());await flush();
 for(const tab of ['plan','hub','materials','inbox','grades']){
  f.click('workspace',{tab});f.click('glance');
  assert.equal(f.container.dataset.workspace,'work',tab);assert.equal(f.container.dataset.workPage,'assignments',tab);
  assert.equal(f.dashboard.getState().mode,'overdue','returning from another tab selects the requested filter instead of toggling it off');
  assert.match(f.container.querySelector('.rd-work').textContent,/Synthetic overdue lab/);
 }
});

test('typing a search keeps the heading art running while the field updates in place',async t=>{
 const f=fixture();t.after(()=>f.dashboard.destroy());await flush();
 const heading=f.container.querySelector('.rd-workspace-heading'),svg=heading.querySelector('.rd-art'),films=f.animations.filter(a=>heading.contains(a.node));
 const input=heading.querySelector('input[data-rd-field="query"]');assert.ok(input,'the heading owns the work search');
 f.document.activeElement=input;
 for(const text of ['b','bi','bio']){input.value=text;f.container.events.get('input')({target:input,preventDefault(){}});f.tick(400);await flush();}
 assert.strictEqual(f.container.querySelector('.rd-workspace-heading'),heading,'search does not replace the heading');
 assert.strictEqual(heading.querySelector('.rd-art'),svg);assert.strictEqual(heading.querySelector('input[data-rd-field="query"]'),input,'the field keeps focus and caret');
 assert.equal(input.value,'bio');assert.ok(films.every(a=>!a.cancelled),'typing does not restart the drawing');
 assert.deepEqual(f.animations.filter(a=>heading.contains(a.node)),films,'no new film starts');
 input.value='';f.container.events.get('input')({target:input,preventDefault(){}});f.tick(400);await flush();
 assert.strictEqual(f.container.querySelector('.rd-workspace-heading'),heading);assert.equal(input.value,'');
});
