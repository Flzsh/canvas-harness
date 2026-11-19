'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../extension/ai-context.js'),{create}=require('../extension/ai-source.js');
const origin='https://school.instructure.com',now=Date.parse('2026-10-22T19:00:00Z');
function fixture({client={},data={},ctx={},demo=false}={}){
 const state={toolbox:{},tasks:{},...data},listeners=new Set(),calls=[];
 const context={courses:[{id:'10',name:'Chemistry'},{id:'20',name:'English'}],courseId:'10',aiAssignmentId:'1',now,s:{},items:[
  {id:'1',courseId:'10',courseName:'Chemistry',name:'Reaction rates lab',kind:'lab',description:'Compare reaction rates and record observations.',dueAt:'2026-10-23T19:00:00Z',url:origin+'/courses/10/assignments/1'},
  {id:'2',courseId:'10',courseName:'Chemistry',name:'Reaction rates practice',description:'Explain reaction rates.',dueAt:'2026-10-20T19:00:00Z'},
  {id:'3',courseId:'10',courseName:'Chemistry',name:'Atomic structure worksheet',description:'Describe electron shells.',dueAt:'2026-10-21T19:00:00Z'},
  {id:'4',courseId:'20',courseName:'English',name:'Reaction rates essay',description:'Other course private material.',dueAt:'2026-10-21T19:00:00Z'}],...ctx};
 const store={owner:{origin,accountId:'7'},get:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},async update(fn){fn(state);for(const listener of listeners)listener(state);}};
 const api={profile:async()=>{calls.push('profile');return {id:'7'};},...client};
 const source=create({getContext:()=>context,store,client:api,user:{id:'7'},demo});
 return {source,ctx:context,data:state,store,calls,client:api};
}

test('large assignment packs keep more than 100,000 characters and honor a bounded configurable budget',()=>{
 const source={id:'reading',title:'Reading',text:'x'.repeat(2100000)};
 const normal=C.bundle([source]),large=C.bundle([source],{maxChars:900000}),capped=C.bundle([source],{maxChars:9000000});
 assert.ok(normal.sources[0].text.length>400000);assert.ok(normal.characters<=500000);
 assert.ok(large.sources[0].text.length>800000);assert.ok(large.characters<=900000);
 assert.ok(capped.sources[0].text.length>1900000);assert.ok(capped.characters<=2000000);
 assert.equal(C.MAX_LIMIT,2000000);assert.equal(capped.included[0].truncated,true);
 assert.equal(C.bundle([source],{maxChars:1}).sources.length,0);
});

test('Help from returned feedback includes that item comments for review and keeps the saved preference unchanged',async()=>{
 const f=fixture({client:{readSubmissionFeedback:async()=>({submission_comments:[{author_id:'8',comment:'Label each graph axis. Score: 9/10'}]})}});f.ctx.items[0].submission={user_id:'7',graded_at:'2026-10-22T17:00Z',submission_comments:[{author_id:'8',comment:'Label each graph axis.'}]};
 assert.equal(f.source.summary().teacherFeedback,false);assert.equal(f.source.helpWith({itemId:'1',page:'feedback'}),true);const catalog=f.source.summary();assert.equal(catalog.helpContext.feedbackRequested,true);assert.equal(catalog.teacherFeedback,true);assert.ok(catalog.selectedIds.includes('feedback:10:1'));const context=await f.source.collect({ids:catalog.selectedIds});assert.match(context.text,/Label each graph axis/);assert.doesNotMatch(context.text,/9\/10/);assert.equal(f.data.toolbox.aiTeacherFeedback,undefined);f.source.clearHelp();assert.equal(f.source.summary().teacherFeedback,false);
});

test('assignment packs retain full rubric criteria, rating descriptions and available weights without earned scores',()=>{
 const detail='Use evidence in every section. '.repeat(150),rating='Explain each observation. '.repeat(150);
 const source=C.assignment({id:'1',courseId:'10',name:'Report',rubric:[{description:'Evidence',long_description:detail,points:25,ratings:[{id:'top',description:'Complete',long_description:rating,points:25,score:24}]}],score:24,grade:'A',submission:{body:'Never include this draft'}},origin);
 assert.ok(source.text.includes(detail.trim()));assert.ok(source.text.includes(rating.trim()));assert.match(source.text,/Complete/);assert.equal(source.hasRubric,true);assert.match(source.text,/Available points: 25/);
 assert.doesNotMatch(JSON.stringify(source),/Never include|"points"|"score"|"grade"|24/);
});

test('Help snapshot reads actual Biscuit fields and allowlists active and upcoming assessment metadata',()=>{
 const f=fixture({ctx:{biscuitContext:{now,courseId:'10',itemId:'1',pageKind:'assignment',selectedText:'Explain the collision model.',courses:[{id:'10',name:'Chemistry',score:91}],assignments:[
  {id:'1',courseId:'10',title:'Collision model reading',description:'Read about collisions.',workKind:'reading',rubric:[{description:'Evidence',ratings:[{description:'Complete'}]}],submission:{body:'Private draft'},score:91},
  {id:'5',courseId:'10',title:'Reaction rates quiz',dueAt:'2026-10-24T19:00:00Z',submissionTypes:['online_quiz'],grade:'A',score:91},
  {id:'6',courseId:'20',title:'English test',dueAt:'2026-10-23T19:00:00Z'}],grades:[{score:91}],messages:[{body:'Private message'}]}}});
 const summary=f.source.summary(),h=summary.helpContext;
 assert.equal(h.now,now);assert.equal(h.page.kind,'assignment');assert.equal(h.itemId,'1');assert.equal(h.courseId,'10');assert.equal(h.active.title,'Collision model reading');
 assert.equal(h.selectedText,'Explain the collision model.');assert.equal(h.nextAssessment.assignmentId,'5');assert.equal(h.active.hasRubric,true);
 assert.equal(summary.active.hasRubric,true);assert.equal(summary.active.workKind,'reading');assert.equal(summary.sources.find(s=>s.id==='assignment:10:1').hasRubric,true);
 assert.doesNotMatch(JSON.stringify(summary),/Private draft|Private message|"rubric"|"score"|"grade"|"grades"|91/);
});

test('direct context fallback gives Help the page, selected text and the actual chosen work',()=>{
 const f=fixture({ctx:{page:{kind:'assignment',itemId:'1',courseId:'10',url:origin+'/courses/10/assignments/1?token=secret'},selectedText:'Compare these trials.'}}),s=f.source.summary();
 assert.equal(s.helpContext.active.assignmentId,'1');assert.equal(s.helpContext.now,now);assert.equal(s.helpContext.page.kind,'assignment');assert.equal(s.helpContext.selectedText,'Compare these trials.');
 assert.equal(s.active.description,'Compare reaction rates and record observations.');assert.equal(s.active.hasRubric,false);assert.doesNotMatch(JSON.stringify(s.helpContext),/token=|secret/);
});

test('assignment pack labels relevant account notes, loaded announcements and recent related instructions',async()=>{
 const f=fixture({data:{tasks:{'1':{notes:'My collision observations.'},'4':{notes:'Other course private notes.'}},courseNotes:{'10':'Reaction rates course notebook.','20':'Other course notebook.'}},ctx:{biscuitData:{courseId:'10',itemId:'1',announcements:[
  {id:'8',courseId:'10',title:'Reaction rates clarification',message:'Use four trials.',posted_at:'2026-10-21T15:00:00Z'},
  {id:'9',courseId:'20',title:'Reaction rates',message:'Other teacher message.'},
  {id:'10',courseId:'10',title:'School picnic',message:'Bring lunch.'}],notes:[{id:'unit',courseId:'10',title:'Reaction rates notes',text:'The collision model.'}]}}});
 const result=await f.source.collect({ids:f.source.summary().selectedIds});
 for(const text of ['My collision observations.','Reaction rates course notebook.','The collision model.','Use four trials.','Explain reaction rates.'])assert.ok(result.text.includes(text),text);
 for(const text of ['Other course private','Other course notebook','Other teacher message','Bring lunch','electron shells'])assert.equal(result.text.includes(text),false,text);
 assert.ok(result.included.some(s=>s.kind==='note'));assert.ok(result.included.some(s=>s.kind==='announcement'));assert.match(result.text,/Recent related work/);
 const catalog=f.source.summary();assert.ok(catalog.selectedIds.includes('announcement:10:8'));assert.equal(catalog.selectedIds.includes('announcement:10:10'),false);
 assert.doesNotMatch(JSON.stringify(catalog),/My collision observations|course notebook|The collision model/);
});
test('course notes preserve scientific quantities only with Show grades on and always remove earned grades',async()=>{
 const f=fixture({ctx:{s:{showGrades:true}},data:{courseNotes:{'10':'Reaction rates: 20% change with a 1/2 dilution. Grade: B; compare both trials.'}}});const context=await f.source.collect({ids:f.source.summary().selectedIds});assert.match(context.text,/20% change with a 1\/2 dilution/);assert.match(context.text,/\[score removed\]/);assert.doesNotMatch(context.text,/Grade: B/);f.ctx.s.showGrades=false;const hidden=await f.source.collect({ids:f.source.summary().selectedIds});assert.match(hidden.text,/20% change with a 1\/2 dilution/);assert.doesNotMatch(hidden.text,/Grade: B/);
});
test('default assignment packs reject broad topic overlap but retain same-work history and explicit links',()=>{
 const source=(id,title,description,extra={})=>({id:'assignment:10:'+id,assignmentId:id,kind:'assignment',courseId:'10',title,description,due:new Date(now-86400000).toISOString(),...extra}),
  quiz=source('1','Chapter 9 quiz','Review memory and learning before attempting this psychology quiz.'),older=source('2','Chapter 7 concept check','Review memory and learning before attempting this psychology quiz.'),
  slides=source('3','Reconstruction presentation slides','Discuss Reconstruction rights and citizenship.'),notes=source('4','Reconstruction reading notes','Discuss Reconstruction rights and citizenship.'),
  lab=source('5','Reaction rates lab','Compare reaction rates and record observations.'),prep=source('6','Reaction rates practice','Explain reaction rates.');
 for(const [active,other]of [[quiz,older],[slides,notes]]){
  assert.deepEqual(C.contextSources([active,other],active,{now}).map(s=>s.id),[active.id]);
  const linked={...active,links:[{kind:'assignment',courseId:'10',sourceKey:other.assignmentId}]},pack=C.contextSources([linked,other],linked,{now});
  assert.deepEqual(pack.map(s=>s.id),[active.id,other.id]);assert.equal(pack[1].attachmentOf,active.id);
 }
 assert.deepEqual(C.contextSources([lab,prep],lab,{now}).map(s=>s.id),[lab.id,prep.id]);
 const numbered=source('7','Atomic structure unit 9','Compare atomic structure in this unit.'),different=source('8','Atomic structure unit 7','Compare atomic structure in this unit.');
 assert.deepEqual(C.contextSources([numbered,different],numbered,{now}).map(s=>s.id),[numbered.id]);
});

test('explicit reviewed selectedIds and an empty review never restore unchecked sources',async()=>{
 const f=fixture({data:{tasks:{'1':{notes:'Private removable note.'}},courseNotes:{'10':'Course removable note.'}},ctx:{aiUpdates:[{courseId:'10',announcements:[{id:'8',title:'Reaction rates',body:'Removable teacher note.'}]}]}});
 const catalog=f.source.summary(),note=catalog.sources.find(s=>s.kind==='note'&&s.assignmentId==='1');assert.ok(note);
 const reviewed=await f.source.collect({ids:['assignment:10:1'],selectedIds:['assignment:10:1',note.id]});
 assert.match(reviewed.text,/Private removable note/);assert.doesNotMatch(reviewed.text,/Course removable|Removable teacher|Explain reaction rates/);
 const ordinary=await f.source.collect({ids:['assignment:10:1',note.id]});assert.match(ordinary.text,/Private removable note/);assert.doesNotMatch(ordinary.text,/Course removable|Removable teacher|Explain reaction rates/);
 const empty=await f.source.collect({all:true,selectedIds:[]});assert.equal(empty.text,'');assert.deepEqual(empty.included,[]);
});

test('main-page explicit selections keep their original scope instead of adding a pack',async()=>{
 const f=fixture({data:{tasks:{'1':{notes:'Unselected note.'}}},ctx:{aiSelectedIds:['assignment:10:1']}});
 assert.deepEqual(f.source.summary().selectedIds,['assignment:10:1']);
 const result=await f.source.collect({ids:['assignment:10:1']});assert.deepEqual(result.included.map(s=>s.id),['assignment:10:1']);assert.doesNotMatch(result.text,/Unselected note|Explain reaction rates/);
 f.ctx.aiSelectedIds=[];assert.deepEqual(f.source.summary().selectedIds,[]);
});

test('default assignment traversal follows same-course linked pages and text documents',async()=>{
 const reads=[],f=fixture({client:{readCoursePage:async(course,slug)=>{reads.push(course+':'+slug);return '<p>Linked teacher reading.</p><a href="/courses/10/pages/second">Next</a>';}}});
 f.ctx.items[0].description='<a href="/courses/10/pages/guide">Guide</a><a href="/courses/20/pages/private">Other course</a>';f.source.helpWith({itemId:'1'});
 const catalog=await f.source.catalog();assert.deepEqual(reads,['10:guide','10:second']);
 assert.ok(catalog.selectedIds.includes('page:10:second'));assert.ok(catalog.sources.some(s=>s.id==='page:10:second'));
 const result=await f.source.collect({ids:catalog.selectedIds});
 assert.match(result.text,/Linked teacher reading/);assert.deepEqual(reads,['10:guide','10:second']);assert.ok(result.included.find(s=>s.id==='page:10:guide').attachmentOf==='assignment:10:1');
 const exact=await f.source.collect({ids:['assignment:10:1'],selectedIds:['assignment:10:1']});assert.doesNotMatch(exact.text,/Linked teacher reading/);assert.equal(reads.length,2);
 const disabled=await f.source.collect({ids:['assignment:10:1'],includeLinkedMaterials:false});assert.doesNotMatch(disabled.text,/Linked teacher reading/);assert.equal(reads.length,2);
});

test('linked options do not suppress an explicitly selected page',async()=>{
 const f=fixture({client:{readCoursePage:async()=>'<p>Explicit page instructions.</p>'}});
 f.ctx.items[0].description='<a href="/courses/10/pages/guide">Guide</a>';
 const result=await f.source.collect({ids:['page:10:guide'],selectedIds:['page:10:guide'],includeLinkedMaterials:false,includeAssignmentPdfs:false});
 assert.deepEqual(result.included.map(s=>s.id),['page:10:guide']);assert.match(result.text,/Explicit page instructions/);
});

test('collect forwards the configurable budget to the one shared bundle',async()=>{
 const f=fixture();f.ctx.items[0].description='Long instructions. '.repeat(50000);
 const result=await f.source.collect({ids:['assignment:10:1'],selectedIds:['assignment:10:1'],maxChars:700000});
 assert.ok(result.characters>600000);assert.ok(result.characters<=700000);assert.equal(result.included[0].truncated,true);
});

test('subscription note changes refresh the pack without parsing or republishing on idle clock ticks',async()=>{
 const f=fixture({data:{tasks:{'1':{notes:'First local note.'}}},ctx:{biscuitContext:{now,courseId:'10',itemId:'1',pageKind:'assignment'}}});
 const first=f.source.summary();f.ctx.biscuitContext.now+=1200;assert.equal(f.source.summary(),first);
 await f.store.update(data=>{data.tasks['1'].notes='Revised local note.';});const changed=f.source.summary();assert.notEqual(changed,first);assert.equal(f.source.summary(),changed);
 const result=await f.source.collect({ids:changed.selectedIds});assert.match(result.text,/Revised local note/);assert.doesNotMatch(result.text,/First local note/);
});

test('automatic sources reject foreign account caches and grade-derived local notes',async()=>{
 const f=fixture({data:{tasks:{'1':{notes:'Grade-derived private plan.'}},toolbox:{agent:{gradePlans:['1'],gradeNotes:true},scratchpad:'Reaction rates score: 99'}},ctx:{aiUpdates:[{origin,accountId:'8',courseId:'10',announcements:[{id:'9',title:'Reaction rates',body:'Foreign account announcement.'}]}],biscuitData:{origin,accountId:'8',notes:[{id:'foreign',courseId:'10',text:'Foreign account notes.'}],announcements:[{id:'10',courseId:'10',title:'Reaction rates',message:'Foreign engine announcement.'}]}}});
 const result=await f.source.collect({ids:['assignment:10:1']});assert.doesNotMatch(result.text,/Grade-derived|99|Foreign account|Foreign engine/);
 f.store.owner.accountId='8';assert.throws(()=>f.source.summary(),/account changed/i);await assert.rejects(f.source.collect({ids:['assignment:10:1']}),/account changed/i);
});

test('a view or account change during linked collection discards the full pack',async()=>{
 for(const change of ['page','account']){
  const f=fixture({client:{readCoursePage:async()=>{if(change==='page')f.ctx.aiAssignmentId='2';else f.store.owner.accountId='8';return '<p>Must not be returned.</p>';}}});
  f.ctx.items[0].description='<a href="/courses/10/pages/guide">Guide</a>';
  await assert.rejects(f.source.collect({ids:f.source.summary().selectedIds}),/view changed|account changed/i);
 }
});

test('mount Help prefill targets a picked assignment without running an agent or gathering sources',async()=>{
 const messages=[],ports=[],intervals=new Map();let profiles=0,agentRuns=0,clock=now;
 const f=fixture(),frame={addEventListener(){},focus(){},remove(){}},sandbox={URL,Date:{now:()=>clock},CanvasHarnessContext:C,document:{hidden:false,createElement:()=>frame},setInterval(fn){intervals.set(1,fn);return 1;},clearInterval:id=>intervals.delete(id),removeEventListener(){},CanvasHarnessAgentClient:{ensure:()=>({state:()=>({}),run:()=>{agentRuns++;return Promise.resolve();}})},chrome:{runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,connect(){const port={postMessage:m=>messages.push(m),onMessage:{addListener:fn=>port.receive=fn},onDisconnect:{addListener(){}},disconnect(){}};ports.push(port);return port;}}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/ai-source.js'),'utf8'),sandbox);
 const mounted=sandbox.CanvasHarnessAISource.mount({container:{append(){}},getContext:()=>f.ctx,store:f.store,client:{profile:async()=>{profiles++;return {id:'7'};}},user:{id:'7'}});
 const last=()=>messages.filter(m=>m.kind==='catalog').at(-1).data;
 assert.equal(mounted.helpWith({itemId:'2',page:{kind:'assignment',itemId:'2'},selectedText:'Explain this paragraph.'}),true);
 assert.equal(last().intent,'help');assert.equal(last().helpContext.requested,true);assert.equal(last().active.assignmentId,'2');assert.equal(last().helpContext.itemId,'2');assert.equal(last().helpContext.selectedText,'Explain this paragraph.');assert.ok(last().selectedIds.includes('assignment:10:2'));
 const firstId=last().helpContext.id;assert.equal(mounted.helpWith({itemId:'2'}),true);assert.notEqual(last().helpContext.id,firstId);assert.equal(last().helpContext.selectedText,'');
 clock+=1200;const catalogs=messages.filter(m=>m.kind==='catalog').length;intervals.get(1)();assert.equal(messages.filter(m=>m.kind==='catalog').length,catalogs);assert.equal(profiles,0);assert.equal(agentRuns,0);
 assert.equal(mounted.helpWith({itemId:'unknown'}),false);assert.equal(mounted.setStudy({kind:'reading',itemId:'1'}),true);assert.equal(last().ponyStudy.kind,'reading');assert.equal(last().intent,undefined);
 mounted.destroy();assert.equal(intervals.size,0);assert.equal(mounted.helpWith({itemId:'1'}),false);
});
