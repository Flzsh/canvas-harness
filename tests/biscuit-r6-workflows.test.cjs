'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../extension/biscuit-engine.js'),I=require('../extension/biscuit-intent.js'),D=require('../extension/biscuit-details.js'),V=require('../extension/biscuit-values.js'),Pets=require('../extension/pets.js'),Core=require('../extension/core.js'),Storage=require('../extension/storage.js'),Plan=require('../extension/planner-model.js'),Facts=require('../extension/biscuit-facts.js'),Inference=require('../extension/biscuit-inference.js');
const MIN=60000,NOW=Date.parse('2027-02-03T12:00:00Z'),copy=v=>structuredClone(v),state=extra=>({now:NOW,timeZone:'UTC',courses:[{id:'course',name:'Inquiry Studio'}],...extra}),steps=r=>r.next.action==='batch'?r.next.fields.steps:[r.next];
function flatBatch(result,actions){assert.equal(result.next.action,'batch');assert.ok(Array.isArray(result.requests));assert.deepEqual(result.requests.map(v=>v.action),actions);assert.ok(result.requests.every(v=>v.next.action!=='batch'&&!v.requests));assert.deepEqual(result.next.fields.steps.map(v=>({action:v.action,fields:v.fields})),result.requests.map(v=>({action:v.next.action,fields:v.next.fields})));}
test('shared clauses protect quoted note punctuation and preserve an unquoted literal payload',()=>{
 const raw='First save a personal note exactly "Blue clip; then move it, and check it", then bookmark this assignment';assert.deepEqual(I.workflowParts(raw).map(v=>v.text),['First save a personal note exactly "Blue clip; then move it, and check it"','bookmark this assignment']);assert.equal(I.workflowParts('Note: start the timer; then turn the page').length,1);
});
test('natural apostrophes inside normal and curly quoted notes never expose embedded commands',()=>{
 for(const [open,close,text] of [["'","'","don't change theme; then start timer"],['‘','’','don’t change thème; then start timer']]){const raw='Save a personal note exactly '+open+text+close+', then bookmark this assignment',parts=I.workflowParts(raw);assert.equal(parts.length,2);assert.equal(I.literalNotePayload(parts[0].text).text,text);assert.equal(parts[1].text,'bookmark this assignment');}
});
test('shared clauses retain numeric and same-control elliptical continuations',()=>{
 assert.equal(I.workflowParts('Set night art at 25, then 0 for the plain view and 100 for the comparison').length,3);assert.equal(I.workflowParts('Pause; seven-left; resume.').length,3);assert.equal(I.workflowParts('show the notes card then make that same card wide').length,2);
});
test('hypothetical and negated control sequences cannot turn elliptical tails into commands',()=>{
 for(const raw of ['If I set motion still, then off for recording','Do not set motion gentle, then off'])assert.equal(I.workflowParts(raw).length,1);
});
test('engine composes exact note creation and the following bookmark without including command text in the note',()=>{
 const s=state({activeCourseId:'course',selectedItemId:'work',assignments:[{id:'work',title:'Light journal',courseId:'course',kind:'assignment'}]}),r=E.create().evaluate('First save a personal note exactly "Blue clip; spare in pocket", then bookmark this assignment',s),a=steps(r);assert.equal(a.length,2);assert.equal(a[0].action,'note');assert.equal(a[0].fields.text,'Blue clip; spare in pocket');assert.equal(a[0].fields.courseId,undefined);assert.equal(a[1].action,'bookmark');assert.equal(a[1].fields.itemId,'work');
});
test('long selected metadata reads preserve learned routing and skip source ranking after renaming',t=>{
 const Learn=require('../extension/biscuit-learn.js'),pack={tier:'basic',features:{charMax:0},patterns:[],models:{action:{labels:['open/find'],weights:{}},item:{weights:{}}}};let classified=0;const original=Inference.evaluate;t.mock.method(Inference,'evaluate',(...args)=>{classified++;return original(...args);});t.mock.method(Learn,'beginInference',fn=>fn({rank:()=>assert.fail('Resolved selected fields must not rank every source.')}));
 for(const [id,title,course] of [['notebook-a','Tidal observations','Coastal Inquiry'],['archive-z','Gesture catalogue','Performance Studio']]){
  const work={id,title,courseId:course,dueAt:NOW+15*MIN,unlockAt:NOW+MIN,lockAt:NOW+90*MIN,submissionTypes:['online_upload'],allowedExtensions:['odt','pdf']},s=state({courses:[{id:course,name:course}],selectedItemId:id,assignments:[work,{id:'distractor',title:'Submission types and closing time',courseId:course,lockAt:NOW+120*MIN,submissionTypes:['online_text_entry'],allowedExtensions:[]}]});
  const closing=E.create({pack}).evaluate('Please show the closing time when the selected assignment stops accepting uploads.',s);assert.equal(closing.relation,'selected-fact');assert.equal(closing.items[0].id,id);assert.equal(closing.next.fields.answerField,'lockAt');assert.equal(closing.next.fields.lockAt,work.lockAt);assert.equal(closing.next.fields.dueAt,undefined);
  for(const verb of ['show','find','open','retrieve','inspect']){const r=E.create({pack}).evaluate('Could you please '+verb+' the actual submission types and allowed file extensions for the selected assignment?',s);assert.equal(r.relation,'selected-fact',verb);assert.equal(r.items[0].id,id);assert.deepEqual(r.next.fields.submissionTypes,work.submissionTypes);assert.deepEqual(r.next.fields.allowedExtensions,work.allowedExtensions);assert.equal(r.next.fields.operation,undefined);}
 }
 assert.ok(classified>0,'Learned action owns expanded fact lookup.');
});
test('long named cross-course facts retain routing and inspect the full inventory before source ranking',t=>{
 const Learn=require('../extension/biscuit-learn.js'),pack={tier:'basic',features:{charMax:0},patterns:[],models:{action:{labels:['open/find'],weights:{}},item:{weights:{}}}};let classified=0;const original=Inference.evaluate;t.mock.method(Inference,'evaluate',(...args)=>{classified++;return original(...args);});t.mock.method(Learn,'beginInference',fn=>fn({rank:()=>assert.fail('A uniquely named admitted fact must not rank every source.')}));
 for(const [name,title,id] of [['Landscape Studies','River transect log','river-record'],['Acoustic Design','Resonance fieldbook','sound-record']]){
  const s=state({courses:[{id:'active',name:'Archive Seminar'},{id:'remote',name}],activeCourseId:'active',selectedItemId:'selected',assignments:[{id:'selected',title:'Remaining attempts for the selected assignment',courseId:'active',attemptsLeft:6},{id,title,courseId:'remote',attemptsLeft:0}]});
  const r=E.create({pack}).evaluate('How many attempts remain for the '+name+' assignment named '+title+' in the loaded course source?',s);assert.equal(r.relation,'named-fact');assert.equal(r.items[0].id,id);assert.equal(r.next.fields.itemId,id);assert.equal(r.next.fields.answerField,'attemptsLeft');assert.equal(r.next.fields.attemptsLeft,0);assert.equal(r.next.fields.operation,undefined);
 }
 assert.ok(classified>0,'Learned action owns expanded fact lookup.');
});
test('conceptual and composition goals use a local source fallback without inventing source facts',()=>{
 const model=label=>({labels:[label],weights:{bias:[10]},scale:1}),pack={tier:'basic',features:{charMax:0},patterns:[],models:{action:model('ai'),item:model('yes')}};
 const s=state({selectedItemId:'recording',pages:[{id:'recording',title:'Two investigation approaches',provider:'Campus Studio',captions:['English'],durationSeconds:120,transcript:'The two teams used distinct assumptions.'}]});
 const before=JSON.stringify(s);for(const line of ['Show me which assumptions support the argument in the selected recording.','How can I rewrite the captions in this recording to make the explanation more persuasive?','Explain the caption choices in the selected recording using two new examples.','Compare the approaches in the selected recording and assess their assumptions.','Generate a new transcript for the selected recording with a clearer conclusion.']){const r=E.create({pack}).evaluate(line,s);assert.equal(r.route,'local',line);assert.equal(r.ai,undefined);assert.equal(r.handoff,undefined);for(const request of r.requests||[r]){assert.ok(['find','open','none'].includes(request.action),line);assert.equal(request.route,'local');assert.equal(request.ai,undefined);assert.equal(request.handoff,undefined);}if(r.items.length)assert.equal(r.items[0].id,'recording',line);assert.ok(!r.next.fields.help&&!r.next.fields.helpWith);}assert.equal(JSON.stringify(s),before);
});
test('literal notes and hypothetical or negated mutations never enter early Facts through field wording',t=>{
 t.mock.method(Facts,'resolve',()=>assert.fail('A literal or guarded mutation is not a factual-read goal.'));t.mock.method(Inference,'evaluate',()=>{throw Error('learned-boundary');});
 const s=state({selectedItemId:'work',assignments:[{id:'work',title:'Observation journal',courseId:'course',lockAt:NOW+90*MIN}]}),text='What is the closing time? Show all submission types.',note=E.create({pack:{}}).evaluate('Please save a personal note exactly "'+text+'"',s);assert.equal(note.next.action,'note');assert.equal(note.next.fields.text,text);
 for(const line of ['If I open this assignment, what closing time would I see?','Do not move this assignment before its deadline tomorrow.','Please do not show or edit the selected assignment upload window.']){try{E.create({pack:{}}).evaluate(line,s);}catch(error){assert.match(error.message,/learned-boundary/,line);}}
});
test('an ordinary Facts answer without an explicit relation cannot bypass learned dispatch',t=>{
 let projected;const resolve=Facts.resolve;t.mock.method(Facts,'resolve',(...args)=>{projected=resolve(...args);return projected;});t.mock.method(Inference,'evaluate',()=>{throw Error('learned-boundary');});
 const s=state({calendarEvents:[{id:'earlier',title:'Morning studio',startAt:NOW+30*MIN,endAt:NOW+90*MIN},{id:'later',title:'Group review',startAt:NOW+60*MIN,endAt:NOW+120*MIN}]});
 const line='Calendar days?';projected=resolve(line,s,{},E.prepare(s));assert.throws(()=>E.create({pack:{}}).evaluate(line,s),/learned-boundary/);assert.equal(projected.action,'find');assert.equal(projected.relation,undefined);assert.equal(projected.next.fields.days,0);
});
test('loaded control sequences retain all finite values while preserving the real motion key',()=>{
 const controls=[{key:'motion',label:'motion',availableOperations:['set'],availableValues:['gentle','still','off']}],s=state({selectedItemId:'controls',pages:[{id:'controls',title:'Appearance controls',kind:'page',controls}]}),r=E.create().evaluate('Set motion still for reading, then gentle for comparison and off for recording',s),a=steps(r);flatBatch(r,['setting','setting','setting']);assert.deepEqual(a.map(v=>v.fields.value),['still','gentle','off']);assert.ok(a.every(v=>v.fields.key==='motion'));assert.ok(a.every(v=>v.fields.key!=='motionStyle'));
});
test('loaded finite continuations retain flat public requests and steps across rejected values and explanation',()=>{
 const controls=[{key:'accent',label:'Accent',availableValues:['ocean','forest'],availableOperations:['inspect','reset']}],s=state({selectedItemId:'palette',pages:[{id:'palette',title:'Palette controls',controls}]}),lines=['Apply ocean accent first, then forest for the second view','Accent not forest, ocean first, the proof sheet is for review; then forest for the second view'];
 for(const line of lines){const r=E.create().evaluate(line,s);flatBatch(r,['setting','setting']);assert.deepEqual(r.requests.map(v=>v.next.fields.value),['ocean','forest']);assert.ok(r.requests.every(v=>v.next.fields.key==='accent'));}
 const read=E.create().evaluate('Show both ocean and forest so I can compare before choosing',s);assert.equal(read.action,'find');assert.equal(read.next.fields.itemId,'palette');assert.equal(read.next.fields.value,undefined);
});
test('manual control handoffs remain visible between executable steps',()=>{
 const controls=[{key:'nudges',inventoryId:'pet:nudges',label:'companion nudges',availableOperations:['set'],availableValues:['quiet','helpful','off']}],s=state({selectedItemId:'controls',pages:[{id:'controls',title:'Companion controls',kind:'page',controls}]}),a=steps(E.create().evaluate('Set companion nudges quiet, then off, then helpful',s));assert.equal(a.length,3);assert.equal(a[0].fields.value,'quiet');assert.equal(a[1].manual,true);assert.ok(a[1].ui.path.length);assert.equal(a[2].fields.value,'helpful');
});
test('number normalization distinguishes English once from an eleven-minute Spanish quantity',()=>{
 assert.match(V.normalize('a 29-minute focus once you have moved it'),/focus once/);assert.deepEqual(V.quantities('once minutos').map(v=>v.minutes),[11]);assert.deepEqual(V.quantities('focus once the alarm sounds').map(v=>v.minutes),[]);
});
test('a timer delta keeps its own amount despite a rejected replacement amount',()=>{
 const r=D.resolve('focus-control','Add six minutes to the countdown remaining, rather than set nine minutes left',state({focus:{running:true,endsAt:NOW+14*MIN}}));assert.equal(r.next.fields.action,'adjust');assert.equal(r.next.fields.minutes,6);
});
function blockState(){const block={id:'block',title:'Light journal block',itemId:'work',courseId:'course',start:NOW+DAY,end:NOW+DAY+30*MIN,minutes:30},work={id:'work',title:'Light journal',kind:'assignment',courseId:'course'};return {block,s:state({selectedItemId:'block',planner:[block],assignments:[work]}),session:{lastItemId:'block'}};}
const DAY=86400000;
test('owned workflow binds clock reminder and focus quantities by their fields',()=>{
 const {s,session}=blockState(),r=D.ownedPlan('Move the block tomorrow at 15:15, a reminder 9 minutes before, and a 29-minute focus once you have moved it',s,session),a=steps(r);assert.equal(a.length,3);assert.equal(a[0].fields.minutes,30);assert.equal(a[2].fields.minutes,29);assert.equal(a[1].fields.at,a[0].fields.startAt-9*MIN);
});
test('a following concentration quantity wins over the earlier reminder quantity',()=>{
 const {s,session}=blockState(),a=steps(D.ownedPlan('Bloc demain13:40, rappel 12 minutes avant, puis concentration17 minutes',s,session));assert.equal(a.length,3);assert.equal(a[2].fields.minutes,17);assert.equal(a[1].fields.at,a[0].fields.startAt-12*MIN);
});
test('an owned workflow retains a lone reminder and independent note step without nested batches',()=>{
 const {s,session}=blockState(),r=E.create().evaluate('Move the block tomorrow at 15:15, remind me 9 minutes before, then save a note exactly "Done; keep this"',s,session),a=steps(r);flatBatch(r,['plan','reminder','note']);assert.deepEqual(a.map(v=>v.action),['plan','reminder','note']);assert.equal(a[1].fields.at,a[0].fields.startAt-9*MIN);assert.equal(a[2].fields.text,'Done; keep this');
});
test('an early warning quantity stays with its reminder and exposes both public batch shapes',()=>{
 const {s,session}=blockState(),r=D.ownedPlan('Relocate the existing block tomorrow at16:10, keep a 13.5-minute early warning, and launch a 22-minute focus interval',s,session);flatBatch(r,['plan','reminder','focus']);assert.equal(r.requests[0].next.fields.minutes,30);assert.equal(r.requests[1].next.fields.at,r.requests[0].next.fields.startAt-13.5*MIN);assert.equal(r.requests[2].next.fields.minutes,22);
});
test('estimate corrections preserve the saved window scope exclusions and another item estimate',()=>{
 const window={start:NOW+180*MIN,end:NOW+360*MIN},excludeIntervals=[{startAt:NOW+240*MIN,endAt:NOW+255*MIN}],session={lastItemId:'work',lastPlan:{window,itemIds:['work','checkpoint'],excludeIntervals,estimates:{checkpoint:20}}},s=state({assignments:[{id:'work',title:'Light journal',courseId:'course'},{id:'checkpoint',title:'Light checkpoint',courseId:'course'}]}),r=D.ownedAllocation('The journal now needs 53 minutes; leave the checkpoint at 20 minutes',s,session);assert.deepEqual(r.next.fields.window,window);assert.deepEqual(r.next.fields.itemIds,['work','checkpoint']);assert.deepEqual(r.next.fields.excludeIntervals,excludeIntervals);assert.equal(r.next.fields.minutes,53);assert.equal(r.next.fields.estimateItemId,'work');assert.deepEqual(r.next.fields.estimates,{work:53});assert.deepEqual(session.lastPlan.estimates,{checkpoint:20});
});
test('owned replan supplies the selected block window and manual exclusion',()=>{
 const {s,session}=blockState(),r=D.ownedPlan('Replan only that block tomorrow 16:00-18:00 around my manual 16:30-17:00 call',s,session),f=r.next.fields;assert.equal(f.operation,'replan');assert.equal(f.blockId,'block');assert.deepEqual(f.window,{start:Date.parse('2027-02-04T16:00Z'),end:Date.parse('2027-02-04T18:00Z')});assert.deepEqual(f.excludeIntervals,[{startAt:Date.parse('2027-02-04T16:30Z'),endAt:Date.parse('2027-02-04T17:00Z')}]);
});
async function fixture(t,options={}){
 const epoch=Date.parse('2026-10-22T20:00:00Z');t.mock.timers.enable({apis:['Date'],now:epoch});let now=epoch,captured,controller,fail=false;const memory=new Map(),writes=[],adapter={read:async key=>memory.get(key),write:async(key,value)=>{writes.push(key);if(fail)throw Error('Disk unavailable');memory.set(key,copy(value));}},store=Storage.createStore({accountId:'r6-workflows',adapter});await store.load();await store.update(()=>{});
 const navigation=[],view={home:false},moduleNode={hidden:false,focused:false,scrolled:false,getClientRects:()=>[{}],hasAttribute:()=>false,setAttribute(){},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}},courses=[{id:'2',name:'Chemistry'},{id:'3',name:'History'}],items=[{id:'1',name:'Optics journal',courseId:'2',dueAt:'2026-10-24T23:00:00Z'},{id:'2',name:'Archive review',courseId:'3',dueAt:'2026-10-24T23:30:00Z'}],doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}},container={ownerDocument:doc,querySelector:selector=>options.homeNavigation&&options.showNode!==false&&view.home&&selector==='[data-rd-key="widget-bookmarks"]'?moduleNode:null,querySelectorAll:()=>[],append(){}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const env=vm.createContext({console,Date:Clock,Map,Set,Promise,Intl,URL,ReserveCore:Core,ReservePlanner:Plan,ReserveFeatures:{enabled:id=>!(options.disabled||[]).includes(id)},ReservePetArt:{},ReservePets:{clean:copy,create:options=>{captured=options;return {sync(){},setFocus(){},destroy(){}};}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
 for(const name of ['workspace-arrange.js','agent-clock.js','pony-ask.js','biscuit-registry.js','biscuit-engine.js','biscuit-planner.js','widgets.js'])vm.runInContext(fs.readFileSync('extension/'+name,'utf8'),env);
 const helpers={E:String,dayKey:Core.dayKey,complete:Core.isComplete,formatDate:(value,zone,options)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,...options}).format(new Date(value))},context=()=>{const d=store.get();return {s:d.settings,personal:d,items:[...items,...d.customTasks.map(row=>({...row,personal:true}))],courses,local:d.tasks,now,courseMap:new Map(courses.map(course=>[course.id,course]))};},save=fn=>store.update(fn).then(()=>true),navigate=options.homeNavigation?request=>{navigation.push(copy(request));if(options.navigateFails)return false;const before=view.home;view.home=true;return {ok:true,undo:()=>{view.home=before;return true;}};}:null;controller=env.ReserveWidgets.create({container,store,save,rerender(){},getContext:context,helpers:()=>helpers,navigate});controller.sync();t.after(()=>{controller.destroy();store.destroy();});return {store,items,navigation,view,moduleNode,arrange:env.ReserveWorkspaceArrange,get actions(){return captured.actions;},get now(){return now;},advance:ms=>{now+=ms;t.mock.timers.setTime(now);},fail:value=>{fail=value;},writes:()=>copy(writes)};
}
const ok=r=>assert.equal(r?.ok,true,r?.message),bad=r=>{assert.equal(r?.ok,false);assert.ok(r.message);};

test('uncommitted failed receipts cannot invent plan history or replace a real previous action',()=>{
 const session={lastAction:{action:'note',after:{id:'saved',text:'Keep'}}},before=copy(session);Pets.rememberAction(session,'plan',{window:{start:1,end:2},itemIds:['invented']},{ok:false,plan:{window:{start:1,end:2},itemIds:['invented'],excludeIntervals:[]}});assert.deepEqual(session,before);
});

// private-build batch execution and Undo integration require unavailable public actions.batch and related architecture.

test('round 8 course, calendar and announcements navigations open the course, Planner and Course hub of this build',async t=>{
 const f=await fixture(t,{homeNavigation:true});
 ok(await f.actions.navigate({tab:'course',courseId:'2'}));ok(await f.actions.navigate({tab:'calendar'}));ok(await f.actions.navigate({tab:'announcements'}));
 assert.deepEqual(f.navigation,[{courseId:'2'},{tab:'planner'},{tab:'course-hub'}]);
 assert.equal(await f.actions.navigate({tab:'course'}),false);assert.equal(await f.actions.navigate({tab:'course',courseId:'missing'}),false);assert.equal(f.navigation.length,3);
});
