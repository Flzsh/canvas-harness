'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../extension/ai-context.js'),{create}=require('../extension/ai-source.js');
const origin='https://school.instructure.com',user={id:'7'},now=Date.parse('2026-10-22T19:00:00Z'),tick=()=>new Promise(resolve=>setImmediate(resolve));
const assignment=()=>({id:'91',course_id:'10',name:'Synthetic diffusion lab',description:'Compare diffusion across the membrane.',submission_types:['online_upload'],rubric:[{id:'evidence',description:'Explain each observation.'}],submission:{user_id:'7',graded_at:'2026-10-22T17:00:00Z',submission_comments:[{author_id:'8',comment:'Explain the membrane evidence.'}]}});
const intent=()=>({itemId:'91',page:{kind:'feedback',courseId:'10',itemId:'91',url:origin+'/courses/10/assignments/91/submissions/7'},selectedText:'  Compare this membrane evidence.  '});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function state({ctx={},client={},data={}}={}){
 const context={courses:[{id:'10',name:'Synthetic science'},{id:'20',name:'Synthetic language'}],courseId:'10',aiAssignmentId:'91',pathname:'/courses/10/assignments/91',pageKind:'assignment',selectedText:'Ambient selection must not replace the click.',now,s:{},items:[],...ctx},saved={toolbox:{aiTeacherFeedback:false,aiAutoSend:false,aiBringAnswers:false,aiLevel:'college'},...data},calls=[];
 const store={owner:{origin,accountId:'7'},get:()=>saved,async update(fn){fn(saved);return saved;}},api={origin,async profile(){calls.push({op:'profile'});return user;},async readAssignment(courseId,id,options){calls.push({op:'assignment',courseId,id,user:options.user,signal:options.signal});return assignment();},...client};
 return {ctx:context,data:saved,store,client:api,calls};
}
function fixture(t,options){const f=state(options);f.source=create({getContext:()=>f.ctx,store:f.store,client:f.client,user});t.after(()=>f.source.destroy());return f;}
function mountedFixture(t,options){
 const f=state(options),messages=[],replies=new Map(),intervals=new Map(),frame={addEventListener(){},remove(){},focus(){}},port={postMessage(message){const copy=JSON.parse(JSON.stringify(message));messages.push(copy);if(replies.has(copy.id)){replies.get(copy.id)(copy);replies.delete(copy.id);}},onMessage:{addListener(fn){port.receive=fn;}},onDisconnect:{addListener(){}},disconnect(){}},env={URL,Date,AbortController,CanvasHarnessContext:C,location:{origin,href:origin+f.ctx.pathname},document:{hidden:false,createElement:()=>frame},setInterval(fn){intervals.set(1,fn);return 1;},clearInterval:id=>intervals.delete(id),removeEventListener(){},chrome:{runtime:{id:'synthetic-review',getURL:file=>'chrome-extension://synthetic-review/'+file,connect:()=>port}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/ai-source.js'),'utf8'),env);
 const mounted=env.CanvasHarnessAISource.mount({container:{append(){}},getContext:()=>f.ctx,store:f.store,client:f.client,user});let seq=0,destroyed=false;
 const destroy=()=>{if(!destroyed){destroyed=true;mounted.destroy();}};t.after(destroy);
 return {...f,mounted,env,messages,intervals,destroy,last:()=>messages.findLast(m=>m.kind==='catalog')?.data,request(action='catalog'){const id='review-'+(++seq),response=new Promise(resolve=>replies.set(id,resolve));port.receive({kind:'source-request',id,action});return response;}};
}
function assertIntent(catalog,selectedText='Compare this membrane evidence.',page='feedback'){
 assert.equal(catalog.intent,'help');assert.equal(catalog.helpContext.requested,true);assert.equal(catalog.active.assignmentId,'91');assert.equal(catalog.active.courseId,'10');assert.equal(catalog.active.hasRubric,true);
 assert.equal(catalog.helpContext.itemId,'91');assert.equal(catalog.helpContext.courseId,'10');assert.equal(catalog.helpContext.page.kind,page);assert.equal(catalog.helpContext.page.itemId,'91');assert.equal(catalog.helpContext.selectedText,selectedText);assert.equal(catalog.helpContext.feedbackRequested,page==='feedback');assert.equal(catalog.teacherFeedback,page==='feedback');
 assert.ok(catalog.selectedIds.includes('assignment:10:91'));assert.equal(catalog.selectedIds.includes('feedback:10:91'),page==='feedback');assert.equal(catalog.autoSend,false);assert.equal(catalog.bringAnswers,false);assert.equal(catalog.level,'college');assert.ok(catalog.helpContext.id);
}
function assertNoFetchedIntent(source){const catalog=source.summary();assert.equal(catalog.intent,undefined);assert.equal(catalog.helpContext.requested,false);assert.equal(catalog.sources.some(s=>s.id==='assignment:10:91'),false);}

test('review 8: the first uncached Help click survives catalog loading with the same page, selection and feedback flags',async t=>{
 const f=fixture(t),options=intent();assert.equal(f.source.summary().active,null);assert.equal(f.source.helpWith(options),true);
 const catalog=await f.source.catalog();assertIntent(catalog);assert.equal(catalog.helpContext.page.url,options.page.url);assert.deepEqual(f.calls.filter(c=>c.op==='assignment').map(({courseId,id,user})=>({courseId,id,user})),[{courseId:'10',id:'91',user:{id:'7'}}]);
 assert.equal(f.data.toolbox.aiTeacherFeedback,false);assert.doesNotMatch(JSON.stringify(catalog),/Explain the membrane evidence/);f.source.clearHelp();assert.equal(f.source.summary().teacherFeedback,false);
});
test('review 8: a delayed missing-assignment fetch keeps a detached copy of the accepted Help intent',async t=>{
 const gate=deferred(),f=fixture(t,{client:{readAssignment:()=>gate.promise}});t.after(()=>gate.resolve(assignment()));const options=intent();assert.equal(f.source.helpWith(options),true);const loading=f.source.catalog();await tick();
 options.itemId='92';options.selectedText='Mutated caller selection.';options.page.kind='notes';options.page.url=origin+'/courses/20/assignments/92';f.ctx.selectedText='Changed ambient selection.';gate.resolve(assignment());assertIntent(await loading);
});
test('review 8: Help arriving during the initial catalog fetch continues without requiring a second click',async t=>{
 const gate=deferred(),f=fixture(t,{client:{readAssignment:()=>gate.promise}});t.after(()=>gate.resolve(assignment()));const loading=f.source.catalog();loading.catch(()=>{});await tick();assert.equal(f.source.helpWith(intent()),true);gate.resolve(assignment());assertIntent(await loading);
});
test('review 8: a newer Help click supersedes the pending selection and page without losing its assignment',async t=>{
 const gate=deferred(),f=fixture(t,{client:{readAssignment:()=>gate.promise}});t.after(()=>gate.resolve(assignment()));assert.equal(f.source.helpWith(intent()),true);const loading=f.source.catalog();await tick();assert.equal(f.source.helpWith({itemId:'91',page:'assignment',selectedText:'Use the newer selection.'}),true);gate.resolve(assignment());assertIntent(await loading,'Use the newer selection.','assignment');
});
test('review 8: a cold ordinary assignment Help click does not acquire feedback opt-in',async t=>{
 const f=fixture(t);assert.equal(f.source.helpWith({itemId:'91',page:'assignment',selectedText:'Explain the membrane.'}),true);assertIntent(await f.source.catalog(),'Explain the membrane.','assignment');assert.equal(f.data.toolbox.aiTeacherFeedback,false);
});
test('review 8: an omitted itemId keeps the current uncached assignment as the first Help target',async t=>{
 const f=fixture(t);assert.equal(f.source.helpWith({page:'feedback',selectedText:'Compare this membrane evidence.'}),true);assertIntent(await f.source.catalog());
});
test('review 8: failed catalog loading reports the async error and permits a fresh Help retry',async t=>{
 let fail=true;const f=fixture(t,{client:{readAssignment:async()=>{if(fail)throw Error('Synthetic assignment unavailable.');return assignment();}}});assert.equal(f.source.helpWith(intent()),true);await assert.rejects(f.source.catalog(),/Synthetic assignment unavailable/);assertNoFetchedIntent(f.source);
 fail=false;assert.equal(f.source.helpWith(intent()),true);assertIntent(await f.source.catalog());
});
for(const change of ['assignment','course','pathname','selection','owner'])test('review 8: a '+change+' scope change during the missing-assignment fetch discards Help and its fetched cache',async t=>{
 const gate=deferred(),f=fixture(t,{client:{readAssignment:()=>gate.promise}});t.after(()=>gate.resolve(assignment()));assert.equal(f.source.helpWith(intent()),true);const loading=f.source.catalog(),rejected=assert.rejects(loading,/view changed|account changed/i);await tick();
 if(change==='assignment')f.ctx.aiAssignmentId='92';if(change==='course')f.ctx.courseId='20';if(change==='pathname')f.ctx.pathname='/courses/10/assignments/91/submissions/7';if(change==='selection')f.ctx.aiSelectedIds=[];if(change==='owner')f.store.owner.accountId='8';gate.resolve(assignment());await rejected;
 f.ctx.aiAssignmentId='91';f.ctx.courseId='10';f.ctx.pathname='/courses/10/assignments/91';delete f.ctx.aiSelectedIds;f.store.owner.accountId='7';assertNoFetchedIntent(f.source);
});
test('review 8: the fetched assignment is discarded when a post-fetch profile check finds another account',async t=>{
 const gate=deferred();let account='7',profiles=0;const f=fixture(t,{client:{profile:async()=>{profiles++;return {id:account};},readAssignment:()=>gate.promise}});t.after(()=>gate.resolve(assignment()));assert.equal(f.source.helpWith(intent()),true);const loading=f.source.catalog(),rejected=assert.rejects(loading,/account changed/i);await tick();account='8';gate.resolve(assignment());await rejected;assert.ok(profiles>=2);account='7';assertNoFetchedIntent(f.source);
});
for(const mismatch of [{id:'92'},{course_id:'20'},{origin:'https://foreign.instructure.com'},{accountId:'8'},{user:{id:'8'}}])test('review 8: missing-cache Help rejects mismatched fetched ownership '+JSON.stringify(mismatch),async t=>{
 const f=fixture(t,{client:{readAssignment:async()=>({...assignment(),...mismatch})}});assert.equal(f.source.helpWith(intent()),true);await assert.rejects(f.source.catalog(),/assignment|course|account|session/i);assertNoFetchedIntent(f.source);
});
test('review 8: an aborted missing-assignment catalog never commits the Help intent or fetched assignment',async t=>{
 const gate=deferred(),controller=new AbortController(),f=fixture(t,{client:{readAssignment:()=>gate.promise}});t.after(()=>gate.resolve(assignment()));assert.equal(f.source.helpWith(intent()),true);const loading=f.source.catalog({signal:controller.signal}),rejected=assert.rejects(loading,/cancel|abort/i);await tick();controller.abort();gate.resolve(assignment());await rejected;assertNoFetchedIntent(f.source);
});
test('review 8: clearing Help before the uncached fetch finishes prevents a late intent from resurfacing',async t=>{
 const gate=deferred(),f=fixture(t,{client:{readAssignment:()=>gate.promise}});t.after(()=>gate.resolve(assignment()));assert.equal(f.source.helpWith(intent()),true);const loading=f.source.catalog();await tick();f.source.clearHelp();gate.resolve(assignment());const catalog=await loading;assert.equal(catalog.intent,undefined);assert.equal(catalog.helpContext.requested,false);assert.equal(catalog.teacherFeedback,false);
});
test('review 8: invalid or unrelated missing Help targets never trigger a fetch',async t=>{
 const f=fixture(t);for(const options of [{itemId:'92'},{itemId:'../91'},{itemId:NaN},{itemId:'91',page:[]},{itemId:'91',selectedText:{}},{itemId:'91',selectedText:'x'.repeat(C.MAX_LIMIT+1)}])assert.equal(f.source.helpWith(options),false);
 assert.equal(f.calls.length,0);assertNoFetchedIntent(f.source);
});
test('review 8: warm Help remains synchronous and does not fetch or verify the account',t=>{
 const f=fixture(t,{ctx:{items:[{...assignment(),id:'91',courseId:'10',description:'Cached synthetic instructions.',hasRubric:true,hasComments:true,hasTeacherComments:true}]}});assert.equal(f.source.helpWith(intent()),true);assertIntent(f.source.summary());assert.equal(f.calls.length,0);
});

test('review 8: mounted first-click Help keeps its boolean caller contract and publishes the fetched intent',async t=>{
 let reads=0;const gate=deferred(),f=mountedFixture(t,{client:{readAssignment:()=>{reads++;return gate.promise;}}});t.after(()=>gate.resolve(assignment()));assert.equal(f.last().active,null);assert.equal(f.mounted.helpWith(intent()),true);await tick();assert.equal(reads,1);assert.equal(f.last().intent,undefined);gate.resolve(assignment());await tick();assertIntent(f.last());assert.equal(f.data.toolbox.aiTeacherFeedback,false);
 const count=f.messages.filter(m=>m.kind==='catalog').length;f.mounted.update();assert.equal(f.messages.filter(m=>m.kind==='catalog').length,count);
});
test('review 8: mounted Help accepted during a panel catalog request is retained in the reply and published catalog',async t=>{
 const gate=deferred(),f=mountedFixture(t,{client:{readAssignment:()=>gate.promise}});t.after(()=>gate.resolve(assignment()));const response=f.request();await tick();assert.equal(f.mounted.helpWith(intent()),true);gate.resolve(assignment());const reply=await response;await tick();assert.equal(reply.ok,true);assertIntent(reply.result);assertIntent(f.last());
});
test('review 8: mounted async fetch errors are contained and exposed by the existing catalog request',async t=>{
 let fail=true;const gate=deferred(),f=mountedFixture(t,{client:{readAssignment:()=>fail?gate.promise:Promise.resolve(assignment())}});t.after(()=>gate.resolve(assignment()));assert.equal(f.mounted.helpWith(intent()),true);const response=f.request();await tick();gate.reject(Error('Synthetic assignment denied.'));const reply=await response;await tick();assert.equal(reply.ok,false);assert.match(reply.error,/Synthetic assignment denied/);assert.equal(f.last().intent,undefined);
 fail=false;assert.equal(f.mounted.helpWith(intent()),true);await tick();assertIntent(f.last());
});
for(const change of ['question','study','aid','destroy','quiz'])test('review 8: a pending mounted Help cannot overwrite a later '+change+' action',async t=>{
 const gate=deferred(),f=mountedFixture(t,{client:{readAssignment:()=>gate.promise}});t.after(()=>gate.resolve(assignment()));assert.equal(f.mounted.helpWith(intent()),true);await tick();
 if(change==='question')assert.equal(f.mounted.setQuestion('Use this newer question.'),true);if(change==='study')assert.equal(f.mounted.setStudy({kind:'reading',itemId:'91'}),true);if(change==='aid')assert.equal(f.mounted.openAid('reading:91'),true);if(change==='destroy')f.destroy();if(change==='quiz')f.env.location.href=origin+'/courses/10/quizzes/5/take';const count=f.messages.length;
 gate.resolve(assignment());await tick();assert.equal(f.messages.slice(count).some(m=>m.kind==='catalog'&&m.data.intent==='help'),false);if(change==='question')assert.equal(f.last().ponyQuestion.text,'Use this newer question.');if(change==='study')assert.equal(f.last().ponyStudy.kind,'reading');if(change==='aid')assert.equal(f.last().openAid.key,'reading:91');if(change==='destroy')assert.equal(f.messages.length,count);
});
