'use strict';
// Audit B4 (2026-11-14): Biscuit's typed lines and taps reach the right thing, and what he says he did is what he did.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Engine=require('../extension/biscuit-engine.js'),P=require('../extension/biscuit-parse.js'),B=require('../extension/pony-brain.js'),A=require('../extension/pony-ask.js'),C=require('../extension/core.js'),S=require('../extension/storage.js'),Plan=require('../extension/planner-model.js'),{fixture}=require('./pony-fixture.cjs');
const now=Date.parse('2026-11-04T19:30:00Z'),day=864e5,iso=d=>new Date(now+d*day).toISOString();
const courses=[{id:'10',name:'Chemistry 11-Birch',shortName:'Chemistry'},{id:'20',name:'Engineering Design-Stone',shortName:'Engineering'}];
const assignments=[['5','Cardboard Bridge','20',-2,1],['7','Solar Car Build','20',2],['10','Equilibrium Worksheet','10',1],['11','Kinetics Test','10',8]].map(([id,title,courseId,d,missing])=>({id,title,courseId,dueAt:iso(d),points:10,kind:'assignment',missing:!!missing,submitted:false}));
const snapshot={now,timeZone:'America/New_York',ai:true,settings:{showGrades:false,bedtime:'22:30'},courses,assignments,workItems:[],personalTasks:[],files:[],pageKind:'dashboard'};
const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function pony(t,actions,{knowledge='lite'}={}){const f=fixture({brain:B,ask:A,parser:P,engine:{create:()=>Engine.create()},epoch:now,info:()=>snapshot,initialPet:{nudges:'off',knowledge},actions});t.after(()=>f.controller.destroy());return f;}
function type(f,line,{enter=false}={}){if(f.bubble?.attrs.role!=='dialog')f.node.emit('click');const input=new f.Element(),preview=new f.Element(),suggestions=new f.Element();input.value=line;input.setAttribute('data-pet-question','');input.parentNode=f.bubble;f.bubble.slots={'[data-pet-question]':input,'[data-pet-preview]':preview,'[data-pet-suggestions]':suggestions};f.bubble.emit('input',{target:input});f.advance(30);if(enter)f.bubble.emit('keydown',{target:input,key:'Enter',preventDefault(){},stopPropagation(){}});return preview;}
function tap(f,action,choice){const b=new f.Element('pet-item',{petAction:action,petChoice:String(choice)});b.parentNode=f.bubble;f.bubble.emit('click',{target:b});}

test('B4-1: a tapped row under a course answer opens that row, not "Unavailable"',async t=>{
 const calls=[],record=name=>request=>{calls.push([name,request]);return true;};
 const f=pony(t,{open:record('open'),find:record('find'),navigate:record('navigate')});
 type(f,'chem');tap(f,'engine-row',1);await settle();
 const open=calls.find(c=>c[0]==='open');assert.ok(open,'the row tap reaches open: '+JSON.stringify(calls));assert.equal(String(open[1]?.itemId),'10');
 type(f,'chem');tap(f,'engine-row',0);await settle();
 const course=calls.filter(c=>c[0]==='open').at(-1);assert.equal(String(course[1]?.courseId),'10','the course row opens its course');
 assert.doesNotMatch(f.bubble?.html||'',/Unavailable/);
});

test('B4-2a: "Turn Biscuit\'s nudges off" saves Reminders = None',async t=>{
 let options;const memory=new Map(),store=S.createStore({accountId:'b4-nudges',adapter:{read:async k=>memory.get(k),write:async(k,v)=>memory.set(k,structuredClone(v))}});await store.load();t.after(()=>store.destroy());
 const doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]};
 const env=vm.createContext({console,Date,Intl,Promise,Map,Set,ReserveCore:C,ReservePlanner:Plan,ReservePonyBrain:B,ReservePonyAsk:A,ReservePetArt:{},ReservePets:{...require('../extension/pets.js'),create:o=>{options=o;return {sync(){},setFocus(){},say(){},destroy(){}};}},setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(fs.readFileSync(require.resolve('../extension/widgets.js'),'utf8'),env);
 const save=fn=>store.update(fn).then(()=>true);
 // the dashboard's own appearance path for a key it does not know: a plain settings write (dashboard.js saveAppearance)
 const widgets=env.ReserveWidgets.create({container,store,save,rerender(){},getContext:()=>({s:store.get().settings,items:[],courses:[],local:{},now}),helpers:()=>({dayKey:C.dayKey,complete:C.isComplete}),appearance:({key,value})=>save(data=>{data.settings[key]=value;})});
 t.after(()=>widgets.destroy());widgets.sync();
 const engineChoice=Engine.evaluate('biscuit off',{...snapshot,pet:{knowledge:'lite'}},{}).choices.find(c=>c.fields?.key==='pet.nudges');
 assert.deepEqual({...engineChoice.fields},{key:'pet.nudges',value:'off'});
 const result=await options.actions.setting(engineChoice.fields);
 assert.notEqual(result,false);assert.equal(store.get().pet.nudges,'off','Reminders = None is saved');
});

test('B4-2b: "mute reminders for 30 minutes" keeps him quiet instead of writing a setting nothing reads',async t=>{
 const calls=[];const f=pony(t,{setting:request=>{calls.push(request);return true;}},{knowledge:'most'});
 const preview=type(f,'mute reminders for 30 minutes',{enter:true});assert.match(preview.textContent,/quiet for 30 min/i);await settle();
 f.controller.say('Something is due soon.');
 assert.doesNotMatch(f.bubble?.html||'',/Something is due soon/,'he stays quiet after being muted');
 f.advance(31*60000);f.controller.say('Something is due soon.');assert.match(f.bubble?.html||'',/Something is due soon/,'and speaks again after the time');
});

// The snapshot his page gives him (widgets.js petInfo) lists the same open work three times: workItems, assignments, planner.
const live=(extra={})=>{const work=assignments.map(v=>({...v,name:v.title,description:'Build the box from the template. Bring it to class.'}));return {...snapshot,pet:{knowledge:'most'},showGrades:false,workItems:work,assignments:work,planner:work,local:{},grades:[],notes:[],bookmarks:[],links:[],reminders:[],tabs:['home','assignments','planner','materials','messages','grades'],features:[],homeModules:[],...extra};};
test('B4-3: "what do i have tmrw" lists tomorrow\'s work, as "what do i have tomorrow" does',()=>{
 for(const line of ['what do i have tmrw','what do i have tmr','what do i have on tmrw']){const r=Engine.evaluate(line,live(),{});assert.match(r.message,/due tomorrow: Equilibrium Worksheet/,line+': '+r.message);assert.doesNotMatch(r.message,/Cardboard Bridge/,line);}
});
test('B4-4: an item listed in workItems, assignments and planner is described once, not three times',()=>{
 const R=require('../extension/biscuit-registry.js'),row=R.entries(live()).find(v=>v.id==='5');
 assert.equal(row.text.split('Bring it to class.').length-1,1,row.text);
 const r=Engine.evaluate('cardboard',live(),{});assert.equal((r.message.match(/Nov 2/g)||[]).length<=1,true,r.message);
});
const dueWorld=()=>{const at=d=>new Date(Date.parse('2026-11-04T19:30:00Z')+d*day).toISOString(),rows=[['1','Homework for Tuesday','10',-12,1],['6','Quiz II','20',2],['7','Car Build','20',2],['9','Cycle Sheet','10',3],['12','Problem Set 7','20',0.15]].map(([id,title,courseId,d,missing])=>({id,title,courseId,dueAt:at(d),points:10,kind:'assignment',missing:!!missing,submitted:false}));return live({assignments:rows,workItems:rows,planner:rows});};
test('B4-5: "whats due fri", "hw due friday", "what do i have fri" list Friday\'s work, not an old item due on a Friday',()=>{
 for(const line of ['whats due fri','whats due friday','hw due friday','homework due fri','what do i have fri']){const r=Engine.evaluate(line,dueWorld(),{});assert.match(r.message,/2 things due Fri: Quiz II/,line+': '+r.message);assert.doesNotMatch(r.message,/Homework for Tuesday/,line);}
});
test('B4-6: "due sat" and "whats due sat" answer, they do not add a task named "Sat" or "Whats"',()=>{
 for(const line of ['due sat','whats due sat','anything due sat']){const r=Engine.evaluate(line,dueWorld(),{});assert.notEqual(r.action,'task',line+': '+r.message);assert.match(r.message,/due Sat: Cycle Sheet/,line);}
 assert.equal(Engine.evaluate('sat prep',dueWorld(),{}).action,'task','SAT prep is still the student\'s own work');
});
test('B4-7: on a Wednesday, "due wed" does not answer "Nothing due Wed. Next up: ... on Wed."',()=>{
 const r=Engine.evaluate('due wed',dueWorld(),{});assert.doesNotMatch(r.message,/Nothing due Wed\. Next up: .* on Wed\./,r.message);
});
test('B4-8: "calc hw" offers the course\'s open work when no title says "homework", instead of "No matching homework"',()=>{
 const s=live({courses:[...courses,{id:'40',name:'AP Calculus BC-Hart',shortName:'Calculus'}],assignments:[{id:'12',title:'Problem Set 7',courseId:'40',dueAt:new Date(now+3600000).toISOString(),points:10,kind:'assignment'},{id:'13',title:'Unit 3 Quiz',courseId:'40',dueAt:new Date(now+day).toISOString(),points:10,kind:'assignment'}]});s.workItems=s.planner=s.assignments;
 for(const line of ['calc hw','calc homework']){const r=Engine.evaluate(line,s,{});assert.doesNotMatch(r.message,/No matching homework/,line);assert.deepEqual((r.choices||r.items).map(v=>v.title),['Problem Set 7','Unit 3 Quiz'],line);}
});
test('B4-9: the Home Timer module\'s seconds do not make him measure the whole page every second',t=>{
 const run=tick=>{const f=fixture({epoch:now});t.after(()=>f.controller.destroy());
  const dial=new f.Element('rd-timer-text',{rdTimerText:''});dial.closest=sel=>sel.split(',').map(s=>s.trim()).includes('[data-rd-timer-text]')?dial:null;f.container.append(dial);
  f.advance(2000);f.clear();
  for(let i=0;i<20;i++){const seconds=String(59-i).padStart(2,'0'),text={nodeType:3,parentElement:dial,parentNode:dial,textContent:'24:'+seconds};if(tick)f.mutate([{type:'childList',target:dial,addedNodes:[text],removedNodes:[{nodeType:3,textContent:'24:'+String(60-i).padStart(2,'0')}]}]);f.advance(1000);}
  return {frames:f.rafCalls,rects:f.reads.rect};};
 const quiet=run(false),ticking=run(true);
 assert.deepEqual(ticking,quiet,'a ticking timer adds no geometry frames or rectangle reads');
});
// A fuller student (five courses with grades, ten pieces of work, a saved note): the snapshot the trained pack misread.
const fuller=()=>{const cs=[['10','Chemistry 11-Birch','Chemistry',91.2],['20','Engineering Design-Stone','Engineering',84.5],['30','English: Modern Fiction','Modern Fiction',97.26],['40','AP Calculus BC-Hart','Calculus',78.1],['50','Latin Reading','Latin',88]].map(([id,name,shortName,score])=>({id,name,shortName,score})),rows=[['1','Homework for Tuesday, 10/20','50',-12,1],['5','Cardboard Bridge','20',-2,1],['6','Aeneid Quiz II','50',2],['7','Solar Car Build','20',2],['9','Cycle Sheet','30',3],['10','Equilibrium Worksheet','10',1],['11','Kinetics Test','10',8],['12','Problem Set 7','40',0.15],['13','Unit 3 Quiz','40',1.2],['14','Gatsby Essay Draft','30',5]].map(([id,title,courseId,d,missing])=>({id,title,name:title,courseId,course:cs.find(c=>c.id===courseId).name,dueAt:new Date(now+d*day).toISOString(),points:10,kind:/quiz|test/i.test(title)?'quiz':'assignment',missing:!!missing,submitted:false,description:''}));
 return {now,timeZone:'America/New_York',ai:true,pet:{knowledge:'most'},settings:{showGrades:true,bedtime:'22:30',timeZone:'America/New_York'},showGrades:true,courses:cs,assignments:rows,workItems:rows,planner:rows,local:{},grades:cs.map(x=>({id:'course-grade-'+x.id,title:x.name,courseId:x.id,value:x.score,text:String(x.score)})),notes:[{id:'scratchpad',title:'Your notes',text:'bring goggles friday'}],bookmarks:[],links:[],reminders:[],tabs:['home','assignments','planner','materials','messages','grades'],features:[],homeModules:[],files:[],announcements:[],pageKind:'dashboard',focus:{running:false}};};
test('B4-10: plain lines ("focus", "paddock", "move it to friday") do not change the Home layout',()=>{
 for(const line of ['move it to friday','move it to fri'])for(const world of [fuller,live]){const session={},first=Engine.evaluate('cardboard bridge',world(),session);session.items=first.items;session.query='cardboard bridge';session.itemId=first.next?.fields?.itemId;session.courseId=first.next?.fields?.courseId;
  const r=Engine.evaluate(line,world(),session);assert.notEqual(r.action,'module',line+': '+r.message);if(world===fuller){assert.equal(r.action,'move',line+': '+r.message);assert.equal(String(r.next.fields.itemId),'5',line);}}
 for(const line of ['focus','paddock']){const r=Engine.evaluate(line,fuller(),{});assert.notEqual(r.action,'module',line+': '+r.message);}assert.equal(Engine.evaluate('focus',fuller(),{}).action,'focus','"focus" starts a focus session');
 for(const [line,key,what] of [['move notes to the top','notes','top'],['make timer wide','timer','wide'],['hide paddock','pet','hide'],['clock','clock','show']]){const r=Engine.evaluate(line,fuller(),{});assert.equal(r.action,'module',line);assert.deepEqual([r.next.fields.key,r.next.fields.action],[key,what],line);}
});
test('B4-11: a reminder\'s title is the thing to do, not the time words typed before it',()=>{
 for(const [line,title] of [['remind me tmrw 8pm call mom','call mom'],['remind me fri 7am study chem','study chem'],['remind me to call mom tmrw 8pm','call mom'],['remind me friday at 7am to study chem','study chem'],['remind me tonight 9pm finish essay','finish essay'],['remind me at 7 to study','study']]){const r=Engine.evaluate(line,live(),{});assert.equal(r.action,'reminder',line);assert.equal(r.next.fields.title,title,line);}
});
test('B4-12: "plan tonight 2 hrs" plans the student\'s work, as "plan 2 hrs tonight" does',()=>{
 const r=Engine.evaluate('plan tonight 2 hrs',live(),{});assert.equal(r.action,'plan');assert.doesNotMatch(r.message,/personal time/,r.message);assert.match(r.message,/^Tonight /,r.message);
});
test('B4-13: with one answer in the ask box, Tab leaves the box (keyboard users can reach the result rows)',t=>{
 const f=pony(t,{});type(f,'chem');const input=f.bubble.slots['[data-pet-question]'];let held=false;
 f.bubble.emit('keydown',{target:input,key:'Tab',shiftKey:false,isComposing:false,preventDefault(){held=true;},stopPropagation(){}});
 assert.equal(held,false,'Tab is not swallowed by the single answer');
});
