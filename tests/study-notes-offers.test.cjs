'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Kind=require('../extension/study-kind.js'),B=require('../extension/pony-brain.js'),{fixture}=require('./pony-fixture.cjs');
const DAY=86400000,now=Date.parse('2026-10-21T16:00:00Z'),skills={deadline:false,focus:false,planner:false,reading:false,labprep:false,rubric:false,feedback:false,inbox:false,wellbeing:false};
const item=(extra={})=>({id:'work',title:'Open-note quiz',courseId:'10',dueAt:now+DAY,...extra}),snapshot=(extra={})=>({now,timeZone:'America/New_York',assignments:[item()],skills,...extra});
const offer=(extra={},learning)=>B.evaluate(snapshot(extra),learning).suggestions.find(s=>s.kind==='notes');

test('notes eligibility recognizes permission in assessment titles, names and descriptions',()=>{
 for(const kind of ['quiz','test'])for(const phrase of ['open note','open-note','OPEN NOTES','notes allowed','notes are allowed','note sheet','note-sheet'])for(const field of ['title','name','description'])assert.equal(Kind.classify({kind,title:'Unit 3',[field]:phrase}).notes,true,kind+' '+field+' '+phrase);
 for(const value of [{title:'Open-note final'},{title:'Midterm',description:'A note sheet is permitted'},{title:'Task',submissionTypes:['online_quiz'],description:'Notes allowed'},{title:'Task',workKind:'quiz',description:'Open note'},{title:'Quiz',description:'<p>Open <strong>note</strong> assessment</p>'},{title:'Quiz',description:'Notes&nbsp;allowed'}])assert.equal(Kind.classify(value).notes,true,JSON.stringify(value));
});
test('closed assessments and unrelated note wording do not become notes eligible',()=>{
 for(const value of [{title:'Quiz'},{title:'Closed-note quiz'},{title:'Quiz',description:'No notes allowed'},{title:'Quiz',description:'Notes are not allowed'},{title:'Not open-note quiz'},{title:'Quiz',description:'Without a note sheet'},{title:'Quiz',description:'Noteworthy results'},{title:'Write a note sheet'},{title:'Task',description:{text:'Open-note quiz'}},null,[]])assert.equal(Kind.classify(value).notes,false,JSON.stringify(value));
});
test('readings are eligible while default reading, quiz and feedback selection stays unchanged',()=>{
 for(const value of [{title:'Read chapter 3'},{name:'Article: climate'},{description:'Read pages 4-6'},{kind:'reading'},{kind:'assignment',workKind:'reading'}])assert.equal(Kind.classify(Object.freeze(value)).notes,true,JSON.stringify(value));
 assert.equal(Kind.classify({title:'Reading before a closed-note quiz',kind:'quiz'}).notes,false);
 assert.equal(Kind.forSelection([{title:'Open-note quiz'}]),'practice');assert.equal(Kind.forSelection([{title:'Read chapter 3'}]),'reading');assert.equal(Kind.forSelection([{title:'Open-note quiz'},{title:'Read chapter 3'}]),'ask');assert.equal(Kind.forSelection([{title:'Open-note quiz',hasTeacherComments:true,gradedAt:now}],{teacherFeedback:true}),'fixes');
});
test('notes classification respects taking-page metadata on the item or supplied page context',()=>{
 for(const page of [{quizTaking:true},{pageKind:'quiz-taking'},{pathname:'/courses/10/quizzes/20/take'},{url:'https://school.instructure.com/courses/10/quizzes/20/take?attempt=2'},{pathname:'/courses/10/quizzes/20/take/questions/1'}]){assert.equal(Kind.classify(item(page)).notes,false,JSON.stringify(page));assert.equal(Kind.classify(item(),page).notes,false,JSON.stringify(page));}
 assert.equal(Kind.classify(item(),{url:'https://school.instructure.com/courses/10/quizzes/20'}).notes,true);
});
test('Biscuit offers the notes label and selected item through its normal suggestion kind',()=>{
 assert.deepEqual(offer(),{id:'notes:work',kind:'notes',label:'Notes outline: Open-note quiz',action:'notes',data:{itemId:'work'},score:181});
 assert.ok(B.evaluate(snapshot({skills:B.cleanSkills()})).suggestions.slice(0,2).some(s=>s.kind==='notes'));
 assert.equal(offer({assignments:[item({title:'Read chapter 3'})]}),undefined);assert.equal(offer({assignments:[item({title:'Unit quiz',description:'Notes allowed'})]})?.data.itemId,'work');assert.equal(offer({assignments:[item({title:'Unit quiz'})]}),undefined);
 const long=offer({assignments:[item({title:' Open-note\n quiz '+ 'long title '.repeat(12)})]});assert.ok(long.label.length<=64);assert.ok(long.label.endsWith('...'));assert.doesNotMatch(long.label,/\n|  /);
});
test('Biscuit retains raw assessment work kinds and submission types without offering reading notes',()=>{
 for(const extra of [{kind:'assignment',workKind:'quiz'},{kind:'assignment',workKind:'test'},{kind:'other',submissionTypes:['online_quiz']}])assert.equal(offer({assignments:[item({title:'Unit 3',description:'Notes allowed',...extra})]})?.data.itemId,'work',JSON.stringify(extra));
 for(const extra of [{title:'Read chapter 3'},{title:'Unit 3',kind:'reading'},{title:'Unit 3',kind:'assignment',workKind:'reading'}]){const value=item({description:'Notes allowed',...extra});assert.equal(Kind.classify(value).notes,true);assert.equal(offer({assignments:[value]}),undefined);}
});
test('notes requires a future timestamp within exactly three elapsed days',()=>{
 for(const [dueAt,want] of [[now-1,false],[now,true],[now+3*DAY,true],[now+3*DAY+1,false],[null,false],['invalid',false],[Infinity,false]])assert.equal(!!offer({assignments:[item({dueAt,dueDay:'2026-10-22'})]}),want,String(dueAt));
 const dst=Date.parse('2026-10-31T16:00:00Z');assert.ok(offer({now:dst,assignments:[item({dueAt:dst+3*DAY})]}));assert.equal(offer({now:dst,assignments:[item({dueAt:'2026-11-04T04:30:00Z'})]}),undefined);
 const spring=Date.parse('2026-03-08T04:30:00Z');assert.ok(offer({now:spring,assignments:[item({dueAt:spring+3*DAY})]}));
});
test('notes chooses the earliest eligible open item with stable ties and planner metadata',()=>{
 const assignments=[item({id:'later',dueAt:now+2*DAY}),item({id:'b'}),item({id:'a',title:'Unit quiz',description:'Open note'}),item({id:'closed',title:'Closed-note quiz',dueAt:now}),item({id:'done',done:true,dueAt:now})];
 for(const rows of [assignments,[...assignments].reverse()])assert.equal(offer({assignments:rows,planner:[{id:'a',estimate:20}]})?.data.itemId,'a');
 assert.equal(offer({assignments,planner:[{id:'a',done:true}]})?.data.itemId,'b');assert.equal(offer({planner:[{id:'work',done:true}]}),undefined);
});
test('notes never offers on quiz-taking pages or with AI unavailable',()=>{
 for(const page of [{quizTaking:true},{pageKind:'quiz-taking'},{pathname:'/courses/10/quizzes/20/take'},{url:'https://school.instructure.com/courses/10/quizzes/20/take#questions'},{ai:false}])assert.equal(offer(page),undefined,JSON.stringify(page));
});
test('Quiz prep controls assessment notes while readings remain panel-only notes candidates',()=>{
 assert.ok(B.SKILLS.quiz.kinds.includes('notes'));assert.equal(B.skillEnabled('notes',{quiz:false}),false);assert.equal(B.skillEnabled('notes',{reading:false}),true);
 for(const title of ['Open-note quiz','Read chapter 3'])assert.equal(offer({assignments:[item({title})],skills:{...skills,quiz:false,reading:true}}),undefined);
 assert.ok(B.evaluate(snapshot({assignments:[item({title:'Read chapter 3'})],skills:{...skills,quiz:false,reading:true}})).suggestions.some(s=>s.kind==='reading'));
});
test('notes uses ordinary learning and does not expand the existing nudge rules',()=>{
 let learning=B.cleanLearning();for(let i=0;i<3;i++)learning=B.record(learning,'notes','ignored');assert.equal(offer({},learning).score,100);learning=B.record(learning,'notes','used');assert.equal(offer({},learning).score,183);
 const s=snapshot({assignments:[item({dueAt:now})]}),top=B.evaluate(s).suggestions[0];assert.equal(top.kind,'notes');assert.equal(B.canNudge(top,s,{}),false);assert.equal(B.canNudge(top,s,{nudges:{day:'2026-10-21',count:3,items:[]}}),false);
 const before=structuredClone(s);B.evaluate(s,learning);assert.deepEqual(s,before);
});
test('the normal pet controller dispatches notes and records usage',async t=>{
 let opened;const f=fixture({brain:B,epoch:now,initialPet:{skills},info:()=>snapshot(),actions:{notes:data=>{opened=data.itemId;return true;}}});t.after(()=>f.controller.destroy());f.advance(0);f.node.emit('click');const button=f.bubble?.children.find(x=>x.dataset.petSuggestion==='notes:work');assert.ok(button);f.bubble.emit('click',{target:button});for(let i=0;i<5;i++)await Promise.resolve();assert.equal(opened,'work');assert.equal(f.pet.brain.kinds.notes.used,1);
});

function widgets({study=true}={}){
 const data={settings:{timeZone:'America/New_York'},pet:{enabled:true,skills:B.cleanSkills()},tasks:{},focus:{minutes:25}},items=[{id:'work',courseId:'10',name:'Unit quiz',description:'Notes allowed',dueAt:new Date(now+DAY).toISOString()}],context={s:data.settings,items,courses:[{id:'10',name:'Science'}],local:data.tasks,now},calls=[],disabled=[];let options;
 class Clock extends Date{static now(){return now;}}
 const doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}},location={pathname:'/courses/10'},env=vm.createContext({Date:Clock,Intl,Map,Set,Promise,location,CanvasHarnessStudyKind:Kind,ReservePonyBrain:B,ReserveFeatures:{enabled:id=>!disabled.includes(id)},ReservePetArt:{},ReservePets:{clean:v=>v,create:o=>{options=o;return {sync(){},setFocus(){},destroy(){}};}},setInterval:()=>1,clearInterval(){},setTimeout(){},clearTimeout(){}});
 for(const name of ['planner-model.js','widgets.js'])vm.runInContext(fs.readFileSync('extension/'+name,'utf8'),env,{filename:name});
 const controller=env.ReserveWidgets.create({container:{ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]},store:{get:()=>data},getContext:()=>context,helpers:()=>({dayKey:value=>new Date(value).toISOString().slice(0,10),complete:v=>v.done===true}),save:async fn=>{fn(data);return true;},rerender(){},askAI:()=>true,studyAI:study?(...args)=>{calls.push(args);return true;}:null,getPractice:()=>({itemId:'work'}),practice:()=>assert.fail('Notes must select the Canvas item instead of a PDF handoff')});controller.sync();
 return {data,items,context,calls,disabled,location,controller,get options(){return options;}};
}
test('widgets preserve descriptions and route notes mode with only the offered item',t=>{
 const f=widgets();t.after(()=>f.controller.destroy());assert.equal(f.options.info().assignments[0].description,'Notes allowed');assert.equal(B.evaluate(f.options.info()).suggestions.find(s=>s.kind==='notes')?.data.itemId,'work');assert.equal(f.options.actions.notes({itemId:'work'}),true);assert.deepEqual(f.calls,[['notes','work']]);
});
test('notes actions recheck Quiz prep, eligibility, completion, removal and the due horizon',t=>{
 const f=widgets();t.after(()=>f.controller.destroy());const open=()=>f.options.actions.notes({itemId:'work'});
 f.data.pet.skills.quiz=false;assert.equal(open(),false);f.data.pet.skills.quiz=true;f.items[0].description='Closed note';assert.equal(open(),false);f.items[0].description='Notes allowed';f.data.tasks.work={checkedOff:true};assert.equal(open(),false);delete f.data.tasks.work;
 f.items[0].dueAt=new Date(now+3*DAY+1).toISOString();assert.equal(open(),false);f.items[0].dueAt=new Date(now-1).toISOString();assert.equal(open(),false);f.items[0].dueAt=new Date(now+DAY).toISOString();assert.equal(f.options.actions.notes({itemId:'missing'}),false);f.items.length=0;assert.equal(open(),false);assert.deepEqual(f.calls,[]);
});
test('notes actions preserve raw assessment metadata and reject reading-only items',t=>{
 const f=widgets();t.after(()=>f.controller.destroy());const open=()=>f.options.actions.notes({itemId:'work'}),row=f.items[0];row.name='Unit 3';row.kind='assignment';row.workKind='test';assert.equal(open(),true);assert.equal(f.options.info().assignments[0].workKind,'test');delete row.workKind;row.submissionTypes=['online_quiz'];assert.equal(open(),true);row.submissionTypes=[];row.kind='reading';row.name='Read chapter 3';assert.equal(open(),false);assert.deepEqual(f.calls,[['notes','work'],['notes','work']]);
});
test('notes actions recheck taking-page context and the native pathname',t=>{
 const f=widgets();t.after(()=>f.controller.destroy());const open=()=>f.options.actions.notes({itemId:'work'});
 f.context.quizTaking=true;assert.equal(open(),false);assert.equal(B.evaluate(f.options.info()).suggestions.some(s=>s.kind==='notes'),false);f.context.quizTaking=false;f.context.pageKind='quiz-taking';assert.equal(open(),false);f.context.pageKind='course';f.location.pathname='/courses/10/quizzes/20/take';assert.equal(open(),false);assert.equal(B.evaluate(f.options.info()).suggestions.some(s=>s.kind==='notes'),false);assert.deepEqual(f.calls,[]);
});
test('notes actions require AI and a study handoff even when a matching PDF exists',t=>{
 const f=widgets();t.after(()=>f.controller.destroy());f.disabled.push('ai');assert.equal(f.options.actions.notes({itemId:'work'}),false);assert.deepEqual(f.calls,[]);
 const missing=widgets({study:false});t.after(()=>missing.controller.destroy());assert.equal(missing.options.actions.notes({itemId:'work'}),false);assert.deepEqual(missing.calls,[]);
});
