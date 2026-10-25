'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),ACTUAL=path.join(ROOT,'extension'),SOURCE=ACTUAL,changed=new Set();
function load(){
 const env=vm.createContext({Intl,URL,URLSearchParams}),cache=new Map();
 function source(name){
  assert.match(name,/^[a-z][a-z0-9/-]*\.(?:js|json)$/);assert.ok(!name.includes('..'));
  if(name.endsWith('.json')){assert.equal(name,'biscuit-rules/school-language.json','Only the real packaged language dictionary is permitted');return JSON.parse(fs.readFileSync(path.join(ACTUAL,name),'utf8'));}
  if(cache.has(name))return cache.get(name).exports;
  const file=path.join(changed.has(name)?SOURCE:ACTUAL,name),module={exports:{}};cache.set(name,module);
  const fn=new vm.Script('(function(module,exports,require){\n'+fs.readFileSync(file,'utf8')+'\n})',{filename:file}).runInContext(env);
  fn(module,module.exports,request=>{assert.ok(request.startsWith('./'),'Only runtime relative dependencies');return source(request.slice(2));});return module.exports;
 }
 return {source,get C(){return source('biscuit-control-request.js');},get S(){return source('biscuit-selection.js');},get R(){return source('biscuit-registry.js');},get F(){return source('biscuit-facts.js');},get E(){return source('biscuit-engine.js');}};
}
const plain=value=>JSON.parse(JSON.stringify(value)),fields=r=>r?.next?.fields||{},ids=r=>Array.from(r||[],x=>x.id),courses=[{id:'A',name:'Lantern Inquiry'},{id:'B',name:'River Archive'}];
const state=extra=>({now:Date.UTC(2031,3,7,12),timeZone:'UTC',courses:plain(courses),settings:{},features:[],...extra});
const row=(id,kind,title,extra={})=>({id,kind,title,courseId:'A',text:'Loaded material.',fields:{itemId:id},...extra});
const control=(id,title,text,extra={})=>row(id,'page',title,{text,pageType:'control',...extra});
function fact(h,line,s,session={}){return h.F.resolve(line,s,session,h.R.entries(s));}
function noMutation(r,line){assert.ok(!['setting','feature','module'].includes(r?.action),line);}
function attachmentScene(extra={}){
 const f=row('paper-a','file','Copper Fold Chart.pdf',{filename:'Copper Fold Chart.pdf'}),other=row('paper-b','file','Linen Drift Table.csv');
 const m=row('mail-a','message','Workshop reply',{attachmentIds:[f.id],unread:true});
 return state({selectedItemId:m.id,messages:[m],files:[f,other],...extra});
}
const tinyPack=label=>({schemaVersion:1,tier:'basic',features:{charMax:0},patterns:[],models:{action:{labels:[label],scale:1,weights:{bias:[4]}},item:{labels:['yes'],scale:1,weights:{bias:[0],title:[1]}}}});


const choiceScene=()=>state({assignments:[row('later','assignment','Quartz Investigation',{dueAt:Date.UTC(2031,3,9,12),estimate:10}),row('early','assignment','Lantern Response',{dueAt:Date.UTC(2031,3,8,12),estimate:30}),row('tie','assignment','Canal Sketch',{dueAt:Date.UTC(2031,3,8,12),estimate:15,courseId:'B'})]});
test('a comparison of loaded work returns one read-only choice ordered by deadline then estimate',()=>{
 for(const line of ['Pick one school task for right now, shortest only if deadlines tie.','Choose which of these two tasks I should start.','Compare due dates and pick my first job.','Which task should I do first?']){const h=load(),s=choiceScene(),before=JSON.stringify(s),r=fact(h,line,s);assert.equal(r?.action,'find',line);assert.equal(fields(r).itemId,'tie');assert.equal(fields(r).operation,'choose-next');assert.equal(JSON.stringify(s),before);}
});
test('available minutes are a feasibility constraint before deadline order',()=>{
 const h=load(),s=choiceScene();for(const line of ['Pick a task I can finish in twelve minutes.','I have twelve minutes. Which task fits and is earlier due?']){const r=fact(h,line,s);assert.equal(fields(r).itemId,'later',line);assert.equal(fields(r).availableMinutes,12);}
});
test('unknown estimates cannot be asserted to fit a finite budget',()=>{
 const h=load(),s=choiceScene();delete s.assignments[0].estimate;assert.equal(fact(h,'Which task fits in twelve minutes?',s)?.action,'none');
});
test('completed, unavailable and archived-course work cannot win the next task comparison',()=>{
 const h=load(),s=choiceScene();s.assignments[2].done=true;s.assignments[1].available=false;assert.equal(fields(fact(h,'Pick my next task.',s)).itemId,'later');s.courses[0].archived=true;assert.equal(fact(h,'Pick my next task.',s)?.action,'none');
});
test('explicit academic scope and source exclusions constrain comparison while active-page context is soft',()=>{
 const h=load(),s=choiceScene();s.selectedItemId='later';s.activeCourseId='A';assert.equal(fields(fact(h,'Pick my next task.',s)).itemId,'tie');assert.equal(fields(fact(h,'Pick my next task in Lantern Inquiry.',s)).itemId,'early');assert.equal(fields(fact(h,'Pick my next task without River Archive.',s)).itemId,'early');assert.equal(fact(h,'Pick my next Physics task.',s)?.action,'none');
});
test('an explicit two-result comparison uses its actual result IDs and stale IDs fail closed',()=>{
 const h=load(),s=choiceScene(),session={items:[{id:'early'},{id:'later'}]};assert.equal(fields(fact(h,'Between these two, which task is first due?',s,session)).itemId,'early');session.items[0].id='gone';assert.equal(fact(h,'Between these two, which task is first due?',s,session)?.action,'none');
});
test('empty coursework and infeasible loaded work return an honest local absence',()=>{
 const h=load();for(const s of [state(),choiceScene()]){const r=fact(h,'Pick my next task for a five minute work window.',s);assert.equal(r?.action,'none');assert.equal(r.route,'local');assert.deepEqual(ids(r.items),[]);assert.equal(fields(r).operation,'choose-next');}
});
test('comparison never uses hidden grades or feedback',()=>{
 const h=load(),s=choiceScene();s.grades=[row('private','grade','Best score',{value:99})];s.showGrades=false;const r=fact(h,'No grade peeking; pick my next task using due times and estimates.',s);assert.equal(fields(r).itemId,'tie');assert.equal(fields(r).excludeGrades,true);assert.ok(!JSON.stringify(r).includes('Best score'));
});
test('ideas, hypothetical advice, explicit scheduling and literal text retain their own speech acts',()=>{
 const h=load(),s=choiceScene();for(const line of ['Choose ideas for my assignment.','How do I choose my first task?','If I pick my next task, will I feel better?','Note: pick my next task tomorrow.','Plan my evening and pick a task for each block.','Explain why this task is earlier due.','Do not pick my next task.'])assert.equal(h.F.chooseTask?.(line,s,{},h.R.entries(s)),null,line);
});
test('the learned plan actor still produces a read-only next-task proposal through the real dispatcher',()=>{
 const h=load(),s=choiceScene(),r=h.E.create({pack:tinyPack('plan')}).evaluate('Pick my next task using deadlines and estimates.',s,{});assert.equal(r.action,'find');assert.equal(fields(r).itemId,'tie');assert.equal(fields(r).operation,'choose-next');
});
test('conflicting same-ID records cannot be asserted as one selected task',()=>{
 const h=load(),s=choiceScene();s.assignments.push({...s.assignments[2],estimate:2});assert.equal(fields(fact(h,'Pick my next task.',s)).itemId,'early');
});


test('an elliptical planning comparison retains its existing selected-work advisory contract',()=>{
 const h=load(),s=choiceScene(),line='Which should I do first: the selected work or the other course item? I have half an hour.';assert.equal(h.F.chooseTask(line,s,{},h.R.entries(s)),null);assert.equal(h.source('biscuit-intent.js').choose(line,s,{},'plan',.99),'plan');
});
