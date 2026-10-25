'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),ACTUAL=path.join(ROOT,'extension'),CHOSEN=ACTUAL,changed=new Set(),MIN=60000,NOW=Date.UTC(2032,5,14,12),plain=v=>JSON.parse(JSON.stringify(v));
function runtime(globals={}){
 const env=vm.createContext({Intl,URL,URLSearchParams,...globals}),cache=new Map();
 function source(name){
  assert.match(name,/^[a-z][a-z0-9/-]*\.(?:js|json)$/);assert.ok(!name.includes('..'));
  if(name.endsWith('.json')){assert.equal(name,'biscuit-rules/school-language.json');return JSON.parse(fs.readFileSync(path.join(ACTUAL,name),'utf8'));}
  if(cache.has(name))return cache.get(name).exports;const file=path.join(changed.has(name)?CHOSEN:ACTUAL,name),module={exports:{}};cache.set(name,module);
  new vm.Script('(function(module,exports,require){\n'+fs.readFileSync(file,'utf8')+'\n})',{filename:file}).runInContext(env)(module,module.exports,request=>{assert.ok(request.startsWith('./'));return source(request.slice(2));});return module.exports;
 }
 return {env,source,get P(){return source('biscuit-planner.js');},get D(){return source('biscuit-details.js');},get R(){return source('biscuit-registry.js');}};
}
const rows=()=>[{id:'101',title:'Prism Inquiry',name:'Prism Inquiry',kind:'assignment',courseId:'course-a',estimate:60,dueAt:NOW+5*86400000},{id:'102',title:'Archive Notebook',name:'Archive Notebook',kind:'assignment',courseId:'course-b',estimate:15,dueAt:NOW+6*86400000}];
const state=extra=>({now:NOW,timeZone:'UTC',settings:{bedtime:'22:30'},courses:[{id:'course-a',name:'Lantern Inquiry'},{id:'course-b',name:'River Archive'}],assignments:rows(),local:{},...extra});
const fields=result=>result?.next?.fields||{},work=plan=>plan.blocks.filter(block=>block.itemId),wire=plan=>({blocks:plan.blocks.map(({itemId,start,end})=>({itemId,start,end}))});
const saved=()=>({lastItemId:'101',lastPlan:{window:{start:NOW,end:NOW+90*MIN},itemIds:['101','102'],excludeIntervals:[],estimates:{'101':60,'102':15}}});
async function fixture(t){
 t.mock.timers.enable({apis:['Date'],now:NOW});const Core=require(path.join(ACTUAL,'core.js')),Storage=require(path.join(ACTUAL,'storage.js')),Model=require(path.join(ACTUAL,'planner-model.js'));let captured,controller,now=NOW,fail=false;const memory=new Map(),writes=[],adapter={read:async key=>memory.get(key),write:async(key,value)=>{if(fail)throw Error('disk unavailable');writes.push(key);memory.set(key,structuredClone(value));}},store=Storage.createStore({accountId:'staged-planner-compatibility',adapter});await store.load();
 const items=rows(),courses=state().courses,doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[],append(){}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const h=runtime({console,Date:Clock,Map,Set,Promise,structuredClone,ReserveCore:Core,ReservePlanner:Model,ReserveFeatures:{enabled:()=>true},ReservePetArt:{},ReservePets:{clean:structuredClone,create:options=>{captured=options;return {sync(){},setFocus(){},destroy(){}};}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
 for(const name of ['workspace-arrange.js','agent-clock.js','pony-ask.js','biscuit-registry.js','biscuit-engine.js','biscuit-planner.js','widgets.js'])h.source(name);
 const helpers={E:String,dayKey:Core.dayKey,complete:Core.isComplete,formatDate:(value,zone,options)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,...options}).format(new Date(value))},context=()=>{const data=store.get();return {s:data.settings,personal:data,items,courses,local:data.tasks,now,courseMap:new Map(courses.map(course=>[course.id,course]))};};
 await store.update(data=>{Object.assign(data.settings,{timeZone:'UTC',bedtime:'22:30',showGrades:false});data.tasks['101']={estimate:60,notes:'Keep prism notes'};data.tasks['102']={estimate:15,notes:'Keep archive notes'};});
 controller=h.env.ReserveWidgets.create({container,store,save:mutate=>store.update(mutate).then(()=>true),rerender(){},getContext:context,helpers:()=>helpers});controller.sync();t.after(()=>{controller.destroy();store.destroy();});
 const Remember=require(path.join(ACTUAL,'pets.js')).rememberAction;
 return {h,store,items,courses,Remember,get actions(){return captured.actions;},snapshot:()=>captured.info(),fail:value=>{fail=value;},writes:()=>plain(writes),saved:()=>plain([...memory])};
}
const ok=result=>assert.equal(result?.ok,true,result?.message),bad=result=>{assert.equal(result?.ok,false);assert.ok(result.message);};
async function unchanged(f,request){const before=plain(f.store.get()),persisted=f.saved(),writes=f.writes(),input=plain(request);bad(await f.actions.plan(request));assert.deepEqual(plain(f.store.get()),before);assert.deepEqual(f.saved(),persisted);assert.deepEqual(f.writes(),writes);assert.deepEqual(plain(request),input);}

test('a canonical named-item legacy request tolerates the real finite pet mode annotation',()=>{
 const h=runtime(),s=state(),request={local:true,line:'Plan Prism Inquiry for 19 minutes',itemId:'101',itemIds:['101'],minutes:19},before=plain(request),a=h.P.build(s,request),b=h.P.build(s,{...request,mode:'tonight'});assert.ok(a.blocks.length);assert.deepEqual(plain(b),plain(a));assert.deepEqual(request,before);
});
test('mode is a transport hint and never overrides canonical dates or exact windows',()=>{
 const h=runtime(),s=state(),request={local:true,operation:'build-plan',window:{start:NOW+MIN,end:NOW+61*MIN},itemId:'101',itemIds:['101']};for(const mode of ['tonight','tomorrow','week']){const normalized=h.P.normalizeRequest(s,{...request,mode});assert.equal(normalized.ok,true,mode);assert.equal(Object.hasOwn(normalized.request,'mode'),false);assert.deepEqual(plain(h.P.build(s,normalized.request).window),request.window);}
});
test('unknown or malformed mode does not weaken canonical rejection',()=>{
 const h=runtime(),s=state(),request={window:{start:NOW,end:NOW+60*MIN},itemIds:['101']};for(const mode of ['arbitrary',null,[],{},true,1])assert.equal(h.P.normalizeRequest(s,{...request,mode}).ok,false);assert.equal(h.P.normalizeRequest(s,{...request,mode:'tonight',unknownMetadata:1}).ok,false);
});
test('explicit ordered cross-course IDs allow only the first real item as course anchor',()=>{
 const h=runtime(),s=state({assignments:[...rows(),{id:'urgent',title:'Unrequested urgent work',courseId:'course-a',estimate:45,missing:true}]}),r={itemId:'101',itemIds:['101','102'],courseId:'course-a',minutes:90};assert.equal(h.P.normalizeRequest(s,r).ok,true);const p=h.P.build(s,r);assert.deepEqual(Array.from(p.items,x=>x.itemId),['101','102']);assert.deepEqual([...new Set(work(p).map(x=>x.itemId))],['101','102']);assert.equal(p.items.some(x=>x.itemId==='urgent'),false);
});
test('singular and unanchored course filters retain their scope',()=>{
 const h=runtime(),s=state();for(const r of [{itemId:'102',courseId:'course-a',minutes:30},{itemId:'101',itemIds:['101'],courseId:'course-b',minutes:30}])assert.equal(h.P.build(s,r).blocks.length,0);assert.equal(h.P.normalizeRequest(s,{window:{start:NOW,end:NOW+90*MIN},itemIds:['101','102'],courseId:'course-a'}).ok,false);
});
test('ordered selection never permits wrong anchors, missing, repeated, completed or conflicting IDs',()=>{
 const h=runtime(),s=state(),base={itemId:'101',itemIds:['101','102'],courseId:'course-a',minutes:90};for(const extra of [{itemId:'102'},{courseId:'course-b'},{itemIds:['101','missing']},{itemIds:['101','101']},{itemIds:[]},{itemIds:['101','constructor']},{courseId:{}}])assert.equal(h.P.normalizeRequest(s,{...base,...extra}).ok,false,JSON.stringify(extra));
 const completed=state();completed.assignments[1].completed=true;assert.equal(h.P.normalizeRequest(completed,base).ok,false);const ambiguous=state({workItems:[{...rows()[1],courseId:'course-a'}]});assert.equal(h.P.normalizeRequest(ambiguous,base).ok,false);
});
test('a finite first-person availability budget produces a fresh plan rather than an estimate correction',()=>{
 const h=runtime();for(const line of ['I have 27 minutes now.','Actually I only have 27 minutes left.','We have 27 minutes to spare.','I am free for 27 minutes.']){const s=state(),memory=saved(),before=plain(memory),r=h.D.ownedAllocation(line,s,memory);assert.equal(r?.action,'plan',line);assert.equal(fields(r).minutes,27,line);assert.equal(fields(r).estimateItemId,undefined);assert.equal(fields(r).estimates,undefined);assert.equal(fields(r).window,undefined);assert.equal(fields(r).windowStart,undefined);assert.equal(fields(r).windowEnd,undefined);assert.equal(typeof fields(r).line,'string');const p=h.P.build(s,fields(r));assert.equal(p.window.end-p.window.start,27*MIN);assert.equal(p.items.find(x=>x.itemId==='101').estimate,60);assert.deepEqual(memory,before);}
});
test('availability restarts its clock while explicit work estimates keep the saved window',()=>{
 const h=runtime(),s=state({now:NOW+10*MIN}),memory=saved(),availability=h.D.ownedAllocation('I have 32 minutes available.',s,memory),estimate=h.D.ownedAllocation('The Prism Inquiry needs 32 minutes; keep the window and the archive estimate.',s,memory);assert.equal(h.P.build(s,fields(availability)).window.start,NOW+10*MIN);assert.equal(fields(estimate).estimateItemId,'101');assert.deepEqual(plain(fields(estimate).estimates),{'101':32});assert.deepEqual(plain(fields(estimate).window),memory.lastPlan.window);assert.equal(fields(estimate).minutes,32);
});
test('availability and task-duration language do not classify a bare quantity as an estimate',()=>{
 const h=runtime();for(const line of ['27 minutes','I have 27 minutes of work left.','My teacher said "I have 27 minutes".','What if I have 27 minutes?','Do not change the estimate to 27 minutes.','Save a note: I have 27 minutes.','Remind me in 27 minutes.'])assert.equal(h.D.ownedAllocation(line,state(),saved()),null,line);
});
test('a new availability request preserves independent relative start and end constraints',()=>{
 const h=runtime(),s=state(),r=h.D.ownedAllocation('I have 26 minutes starting in 14 minutes.',s,saved());assert.equal(r?.action,'plan');assert.equal(fields(r).minutes,26);assert.equal(fields(r).estimateItemId,undefined);assert.equal(fields(r).startAt,undefined);assert.equal(fields(r).endAt,undefined);assert.match(fields(r).line,/starting in 14 minutes/);const p=h.P.build(s,fields(r));assert.equal(p.window.start,NOW+15*MIN);assert.equal(p.window.end,NOW+41*MIN);assert.equal(fields(r).window,undefined);
});
test('existing explicit estimate and excluded-break corrections retain exact scope',()=>{
 const h=runtime(),s=state(),memory=saved();memory.lastPlan.excludeIntervals=[{startAt:NOW+30*MIN,endAt:NOW+40*MIN}];const before=plain(memory),estimate=h.D.ownedAllocation('Set the Prism Inquiry estimate to 31.5 minutes.',s,memory);assert.equal(fields(estimate).estimateItemId,'101');assert.deepEqual(plain(fields(estimate).estimates),{'101':31.5});assert.deepEqual(plain(fields(estimate).excludeIntervals),memory.lastPlan.excludeIntervals);const rest=h.D.ownedAllocation('Make the free part finish at 12:45; keep that window and both tasks.',s,memory);assert.equal(fields(rest).excludeIntervals[0].endAt,NOW+45*MIN);assert.deepEqual(plain(fields(rest).window),memory.lastPlan.window);assert.deepEqual(memory,before);
});
test('text and line aliases must agree without rewriting canonical time or estimate fields',()=>{
 const h=runtime(),s=state(),base={window:{start:NOW,end:NOW+90*MIN},itemIds:['101'],text:'Plan the selected work.',line:'Plan the selected work.'};assert.equal(h.P.normalizeRequest(s,base).ok,true);assert.equal(h.P.normalizeRequest(s,{...base,line:'Use a different request.'}).ok,false);for(const text of [{},[],true,3])assert.equal(h.P.normalizeRequest(s,{...base,text}).ok,false);
});
test('strict windows, estimates, exclusions, timestamps and extra metadata remain canonical',()=>{
 const h=runtime(),s=state(),base={window:{start:NOW,end:NOW+90*MIN},itemId:'101',itemIds:['101','102'],courseId:'course-a',mode:'tonight'};
 for(const extra of [{startAt:NOW+MIN},{windowEnd:NOW+80*MIN},{window:{...base.window,extra:true}},{excludeIntervals:[{startAt:NOW-MIN,endAt:NOW+MIN}]},{minutes:31,estimateItemId:'101',estimates:{'101':30}},{estimateItemId:'102',estimates:{'101':30}},{estimates:{missing:30}},{availableMinutes:30},{dueAt:NOW},{deadline:NOW},{unknownMetadata:'ignored?'}])assert.equal(h.P.normalizeRequest(s,{...base,...extra}).ok,false,JSON.stringify(extra));
});
test('the real Widgets local consumer accepts the pet-added mode on a named-item proposal',async t=>{
 const f=await fixture(t),request={local:true,line:'Plan Prism Inquiry for 19 minutes',itemId:'101',itemIds:['101'],minutes:19,mode:'tonight'},before=plain(request),deadlines=plain(f.items);ok(await f.actions.plan(request));const p=f.store.get().toolbox.biscuitPlan;assert.ok(work(p).some(block=>block.itemId==='101'));assert.equal(p.window.end-p.window.start,19*MIN);assert.deepEqual(request,before);assert.deepEqual(f.items,deadlines);ok(await f.actions.plan({operation:'undo',mode:'tonight'}));assert.equal(f.store.get().toolbox.biscuitPlan,undefined);
});
test('the real saved pet receipt feeds a new availability plan and supports two independent Undos',async t=>{
 const f=await fixture(t),initial=plain(f.store.get()),memory={},firstFields={local:true,line:'I have 42 minutes',minutes:42},first=await f.actions.plan({...firstFields,mode:'tonight'});ok(first);assert.equal(f.Remember(memory,'plan',firstFields,first),true);const before=plain(f.store.get()),proposal=f.h.D.ownedAllocation('I have 27 minutes now',f.snapshot(),memory);assert.equal(proposal?.action,'plan');assert.equal(fields(proposal).estimateItemId,undefined);ok(await f.actions.plan({...fields(proposal),mode:'tonight'}));const second=f.store.get().toolbox.biscuitPlan;assert.notEqual(second.id,before.toolbox.biscuitPlan.id);assert.equal(second.window.end-second.window.start,27*MIN);assert.equal(f.store.get().tasks['101'].estimate,60);assert.equal(f.store.get().tasks['102'].estimate,15);ok(await f.actions.plan({operation:'undo',mode:'tonight'}));assert.deepEqual(plain(f.store.get()),before);ok(await f.actions.plan({operation:'undo',mode:'tonight'}));assert.deepEqual(plain(f.store.get()),initial);
});
test('Widgets building-only text alias reaches the real time parser and agrees with line',async t=>{
 const f=await fixture(t),request={operation:'replan',local:true,text:'I have 21 minutes starting in 10 minutes',mode:'tonight'};ok(await f.actions.plan(request));const p=f.store.get().toolbox.biscuitPlan;assert.equal(p.window.start,NOW+10*MIN);assert.equal(p.window.end,NOW+31*MIN);ok(await f.actions.plan({operation:'undo'}));
 ok(await f.actions.plan({...request,line:request.text}));await unchanged(f,{...request,line:'I have a different window.'});
});
test('a canonical real-consumer replan preserves the ordered cross-course item selection',async t=>{
 const f=await fixture(t),deadlines=plain(f.items),request={operation:'build-plan',local:true,window:{start:NOW,end:NOW+120*MIN},itemId:'101',itemIds:['101','102'],courseId:'course-a',mode:'tonight',preserveCanvasDeadline:true};ok(await f.actions.plan(request));const p=f.store.get().toolbox.biscuitPlan;assert.deepEqual(Array.from(p.items,x=>x.itemId),['101','102']);assert.deepEqual([...new Set(work(p).map(x=>x.itemId))],['101','102']);assert.deepEqual(f.items,deadlines);
});
test('known mode and text compatibility never permit arbitrary operation fields or protected writes',async t=>{
 const f=await fixture(t),base={operation:'build-plan',local:true,window:{start:NOW,end:NOW+90*MIN},itemId:'101',itemIds:['101'],mode:'tonight'};
 for(const extra of [{mode:'arbitrary'},{mode:{}},{unknownMetadata:1},{dueAt:NOW},{durationMinutes:15},{availableMinutes:30},{preserveCanvasDeadline:false},{preserveAssignmentDeadline:false},{respectExistingCommitments:false},{local:false},{text:{}},{text:'First request',line:'Other request'}])await unchanged(f,{...base,...extra});
});
test('text compatibility applies to building and cannot smuggle instructions into a block mutation',async t=>{
 const f=await fixture(t);ok(await f.actions.plan({operation:'build-plan',itemId:'101',minutes:40}));const block=work(f.store.get().toolbox.biscuitPlan)[0];for(const operation of ['move-block','resize-block','remove-block','undo'])await unchanged(f,{operation,blockId:block.id,text:'I have 20 minutes',mode:'tonight'});
});
test('real consumer retains malformed target and timestamp alias refusal after mode stripping',async t=>{
 const f=await fixture(t);ok(await f.actions.plan({operation:'build-plan',itemId:'101',minutes:40}));const block=work(f.store.get().toolbox.biscuitPlan)[0];for(const extra of [{targetId:'different'},{plannerId:'different'},{itemId:'missing'},{courseId:'course-b'},{start:NOW+MIN},{startAt:NOW+20*MIN,endAt:NOW+10*MIN}])await unchanged(f,{operation:'move-block',blockId:block.id,startAt:NOW+10*MIN,mode:'tonight',...extra});
});
test('replanning availability retains manual schedules, notes, saved estimates and all deadlines',async t=>{
 const f=await fixture(t);f.items.push({id:'local-manual',name:'Manual appointment',courseId:'course-a',dueAt:NOW+7*86400000});await f.store.update(data=>{data.tasks['local-manual']={plannedDate:'2032-06-14',plannedTime:'12:15',estimate:15,notes:'Keep this appointment'};});const before=plain(f.store.get()),deadlines=plain(f.items);ok(await f.actions.plan({local:true,line:'I have 43 minutes',minutes:43,mode:'tonight'}));const p=f.store.get().toolbox.biscuitPlan;assert.deepEqual(plain(f.store.get().tasks['local-manual']),before.tasks['local-manual']);assert.equal(f.store.get().tasks['101'].notes,'Keep prism notes');assert.equal(f.store.get().tasks['101'].estimate,60);assert.equal(f.store.get().tasks['102'].estimate,15);assert.deepEqual(f.items,deadlines);for(const block of p.blocks)assert.equal(block.start<NOW+30*MIN&&NOW+15*MIN<block.end,false);
});
test('build, validation and persistence retain real break and per-item conservation',()=>{
 const h=runtime(),s=state(),p=h.P.build(s,{itemId:'101',itemIds:['101'],minutes:90,mode:'tonight'});assert.ok(p.blocks.some(block=>block.kind==='break'));assert.equal(p.blocks[0].kind,'work');assert.notEqual(p.blocks.at(-1).kind,'break');assert.equal(p.workMinutes+p.remainingMinutes,60);assert.equal(h.P.validate(wire(p),p).ok,true);const damaged=wire(p);damaged.blocks[0].end+=MIN;assert.equal(h.P.validate(damaged,p).ok,false);
});
test('failed persistence keeps saved plans and Undo ownership',async t=>{
 const f=await fixture(t);ok(await f.actions.plan({local:true,line:'I have 41 minutes',minutes:41,mode:'tonight'}));const before=plain(f.store.get()),savedBytes=f.saved(),memory={};f.Remember(memory,'plan',{}, {ok:true,plan:{window:{...before.toolbox.biscuitPlan.window},itemIds:['101','102'],excludeIntervals:[],estimates:{'101':60,'102':15}}});const proposal=f.h.D.ownedAllocation('I have 29 minutes',f.snapshot(),memory);f.fail(true);bad(await f.actions.plan({...fields(proposal),mode:'tonight'}));assert.deepEqual(plain(f.store.get()),before);assert.deepEqual(f.saved(),savedBytes);f.fail(false);ok(await f.actions.plan({operation:'undo',mode:'tonight'}));assert.equal(f.store.get().toolbox.biscuitPlan,undefined);
});

test('availability prose with a relative start reaches Widgets without becoming an unsupported exact timestamp',async t=>{
 const f=await fixture(t);ok(await f.actions.plan({local:true,line:'I have 42 minutes',minutes:42,mode:'tonight'}));const memory={},p=f.store.get().toolbox.biscuitPlan;f.Remember(memory,'plan',{}, {ok:true,plan:{window:{...p.window},itemIds:['101','102'],excludeIntervals:[],estimates:{'101':60,'102':15}}});const proposal=f.h.D.ownedAllocation('I have 26 minutes starting in 14 minutes.',f.snapshot(),memory);assert.equal(proposal?.action,'plan');ok(await f.actions.plan({...fields(proposal),mode:'tonight'}));const next=f.store.get().toolbox.biscuitPlan;assert.equal(next.window.start,NOW+15*MIN);assert.equal(next.window.end,NOW+41*MIN);assert.equal(f.store.get().tasks['101'].estimate,60);
});

test('polar estimate questions cannot become saved-plan corrections',()=>{
 const h=runtime();for(const line of ['Does Prism Inquiry need 27 minutes?','Is the Prism Inquiry estimate 27 minutes?','Can I set the Prism Inquiry estimate to 27 minutes?','Would changing the Prism Inquiry estimate to 27 minutes help?'])assert.equal(h.D.ownedAllocation(line,state(),saved()),null,line);
});
test('a polite recipient-bearing estimate request remains a positive work-duration act',()=>{
 const h=runtime(),r=h.D.ownedAllocation('Could you set the Prism Inquiry estimate to 27 minutes?',state(),saved());assert.equal(r?.action,'plan');assert.equal(fields(r).estimateItemId,'101');assert.deepEqual(plain(fields(r).estimates),{'101':27});assert.deepEqual(plain(fields(r).window),saved().lastPlan.window);
});


test('bare global Undo remains with the real UI stack while typed block edits retain their consumer',async t=>{
 const f=await fixture(t);ok(await f.actions.plan({local:true,line:'I have 42 minutes',minutes:42,mode:'tonight'}));const block=f.store.get().toolbox.biscuitPlan.blocks.find(b=>b.itemId),session={lastItemId:block.id,lastAction:{action:'plan',fields:{blockId:block.id,targetId:block.id}}};assert.equal(f.h.D.ownedPlan('Remove that study block.',f.snapshot(),session)?.action,'plan');for(const line of ['Undo','Undo that','Undo the last change','Revert that','Roll that back'])assert.equal(f.h.D.ownedPlan(line,f.snapshot(),session),null,line);
});


test('bare Undo with a proven specific block mutation retains the typed receipt contract',async t=>{
 const f=await fixture(t);ok(await f.actions.plan({local:true,line:'I have 42 minutes',minutes:42}));const block=f.store.get().toolbox.biscuitPlan.blocks.find(b=>b.itemId),before={...plain(block),startAt:block.start,endAt:block.end},session={lastItemId:block.id,lastAction:{action:'plan',fields:{operation:'move-block',blockId:block.id,targetId:block.id},before,after:{...before,startAt:before.startAt+60000,endAt:before.endAt+60000}}},r=f.h.D.ownedPlan('Undo',f.snapshot(),session);assert.equal(r?.action,'plan');assert.equal(fields(r).operation,'undo');assert.equal(fields(r).targetId,block.id);assert.equal(fields(r).restoreStartAt,before.startAt);
});
