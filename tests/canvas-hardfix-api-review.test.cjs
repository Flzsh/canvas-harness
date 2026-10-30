'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),API=require('../extension/api.js');
const origin='https://school.instructure.com',user={id:'9'},settle=()=>new Promise(setImmediate),link=slug=>`<a href="/courses/7/pages/${slug}">${slug}</a>`;
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function waitFor(gate,signal){return new Promise((resolve,reject)=>{const abort=()=>{signal.removeEventListener('abort',abort);reject(Object.assign(Error('Cancelled'),{name:'AbortError'}));};signal.addEventListener('abort',abort,{once:true});gate.promise.then(()=>{signal.removeEventListener('abort',abort);resolve();});if(signal.aborted)abort();});}
function fixture(){
 const f={revision:1,account:'9',calls:[],assignments:[{id:'1',course_id:'7',name:'Task',description:link('required')}],syllabus:'',before:null};
 f.fetch=async(url,options)=>{
  assert.equal(options.method,'GET');const u=new URL(url),p=u.pathname,revision=f.revision;f.calls.push(p);await f.before?.(u,options,revision);let data;
  if(p.endsWith('/profile'))data={id:f.account};else if(p==='/api/v1/courses')data=[{id:'7',name:'Course'}];
  else if(p.endsWith('/course_nicknames')||p.endsWith('/groups')||p.endsWith('/modules'))data=[];
  else if(p.endsWith('/assignments'))data=f.assignments;
  else if(p.endsWith('/quizzes'))data=[{id:'41',assignment_id:'1',time_limit:revision*10}];
  else if(p.endsWith('/assignment_groups'))data=[{id:'51',group_weight:revision*10}];
  else if(p.endsWith('/late_policy'))data={late_policy:{late_submission_deduction:revision}};
  else if(p.endsWith('/folders'))data=[{id:'21',name:'Unit '+revision}];
  else if(p.endsWith('/files'))data=[{id:'11',folder_id:'21',display_name:'Guide '+revision+'.pdf'}];
  else if(p.endsWith('/pages'))data=[{page_id:'31',url:'required',title:'Reference'},{page_id:'35',url:'locked',locked_for_user:true},{page_id:'36',url:'unpublished',published:false}];
  else if(p.endsWith('/front_page'))data={page_id:'30',url:'home',title:'Home',body:''};
  else if(p==='/api/v1/courses/7')data={id:'7',syllabus_body:f.syllabus};
  else if(p.includes('/pages/')){const slug=p.split('/').at(-1);data={page_id:slug==='required'?'31':slug==='second'?'32':'33',course_id:'7',url:slug,title:slug,body:'Version '+revision+' '+(slug==='required'?link('second'):slug==='second'?link('third'):slug==='third'?link('fourth'):'End')};}
  else throw Error('Unexpected offline GET '+url);
  return {ok:true,status:200,headers:{get:k=>k==='content-type'?'application/json':null},json:async()=>structuredClone(data)};
 };
 f.client=API.createClient({fetchImpl:f.fetch});f.count=suffix=>f.calls.filter(p=>p.endsWith(suffix)).length;return f;
}
function materials(f,extra={}){
 const env={URL,Date,Map,Set,AbortController,ReserveMaterials:require('../extension/material-model.js'),ReserveUI:require('../extension/ui-utils.js')};
 vm.runInNewContext(fs.readFileSync(require.resolve('../extension/materials-ui.js'),'utf8'),env);
 const store={owner:{origin,accountId:'9'},get:()=>({resourcePins:[],settings:{}}),readResourceCache:async()=>null,writeResourceCache:async()=>{}};
 return env.ReserveMaterialsUI.create({store,user,client:f.client,...extra});
}

test('a fresh resource client hydrates current snapshot assignment links through three hops',async()=>{
 const f=fixture(),snapshot=await API.createClient({fetchImpl:f.fetch}).loadSnapshot();
 const raw=await f.client.loadCourseResources('7',{user,assignments:snapshot.assignments});
 for(const slug of ['required','second','third'])assert.match(raw.pages.find(p=>p.url===slug)?.body||'',/Version 1/);
 assert.equal(f.count('/pages/fourth'),0);
});

test('assignment hydration rejects other courses, unavailable work and distant due dates',async()=>{
 const f=fixture(),assignments=[{course_id:'8',description:link('foreign')},{courseId:'8',description:link('normalized-foreign')},{course_id:'7',published:false,description:link('draft')},{course_id:'7',locked_for_user:true,description:link('private')},{course_id:'7',due_at:new Date(Date.now()+60*86400000).toISOString(),description:link('future')},{course_id:'7',description:link('locked')+link('unpublished')}];
 await f.client.loadCourseResources('7',{user,assignments});assert.equal(f.calls.filter(p=>p.includes('/pages/')).length,0);
});

test('new assignment descriptions extend a completed resource cache without force',async()=>{
 const f=fixture();await f.client.loadCourseResources('7',{user,assignments:[]});
 const raw=await f.client.loadCourseResources('7',{user,assignments:[{id:'2',courseId:'7',description:link('new-reading')}]});
 assert.match(raw.pages.find(p=>p.url==='new-reading')?.body||'',/Version 1/);
});

test('dashboard Materials uses the latest snapshot assignments with its separate resource client',async t=>{
 const f=fixture();let ui;
 const dom=require('./dashboard-heading-fixture.cjs').fixture({courseId:'7',setup:({env,store,snapshot})=>{
  store.owner={origin,accountId:'9'};snapshot.user=user;snapshot.courses=[{id:'7',name:'Course'}];snapshot.assignments=f.assignments;
  env.ReserveMaterials=require('../extension/material-model.js');vm.runInContext(fs.readFileSync(require.resolve('../extension/materials-ui.js'),'utf8'),env);
  const create=env.ReserveMaterialsUI.create;env.ReserveMaterialsUI.create=options=>(ui=create({...options,client:f.client}));
 }});t.after(()=>dom.dashboard.destroy());
 await ui.load('7');assert.match(ui.getCourse('7').raw.pages.find(p=>p.url==='required')?.body||'',/Version 1/);
 dom.dashboard.updateSnapshot({...dom.snapshot,assignments:[{id:'2',course_id:'7',name:'Next task',description:link('new-reading')}]});
 await ui.load('7',{force:true});assert.match(ui.getCourse('7').raw.pages.find(p=>p.url==='new-reading')?.body||'',/Version 1/);
});

test('forced resource refresh reloads the catalog and its instructional metadata and page bodies',async()=>{
 const f=fixture();f.syllabus=link('required');const before=await f.client.loadCourseResources('7',{user});f.revision=2;
 const cached=await f.client.loadCourseResources('7',{user,signal:new AbortController().signal});assert.equal(cached,before);assert.equal(f.count('/quizzes'),1);
 const after=await f.client.loadCourseResources('7',{user,force:true});
 assert.equal(after.quizzes[0].time_limit,20);assert.equal(after.assignmentGroups[0].group_weight,20);assert.equal(after.latePolicy.late_submission_deduction,2);assert.equal(after.files[0].folderPath,'Unit 2');assert.match(after.pages.find(p=>p.url==='required').body,/Version 2/);
 for(const suffix of ['/quizzes','/assignment_groups','/late_policy','/folders','/pages/required'])assert.equal(f.count(suffix),2,suffix);
});

test('Materials refresh reaches the real API despite its five-minute result cache',async t=>{
 const f=fixture(),ui=materials(f);t.after(()=>ui.destroy());await ui.load('7');f.revision=2;
 ui.handle('material-refresh',{course:'7'});await ui.load('7');assert.equal(ui.getCourse('7').raw.files[0].display_name,'Guide 2.pdf');assert.equal(ui.getCourse('7').raw.quizzes[0].time_limit,20);
});

for(const firstSignal of [true,false])test('resource consumers isolate '+(firstSignal?'the first':'a later')+' caller cancellation',async()=>{
 const f=fixture(),gate=deferred(),started=deferred(),cancelled=new AbortController(),live=new AbortController();
 f.before=async(u,options)=>{if(u.pathname.endsWith('/folders')){started.resolve();await waitFor(gate,options.signal);}};
 const first=f.client.loadCourseResources('7',{user,...(firstSignal?{signal:cancelled.signal}:{})});await started.promise;
 const second=f.client.loadCourseResources('7',{user,signal:firstSignal?live.signal:cancelled.signal}),results=Promise.allSettled([first,second]);await settle();cancelled.abort();gate.resolve();
 const out=await results,failed=out[firstSignal?0:1],passed=out[firstSignal?1:0];assert.equal(failed.status,'rejected');assert.equal(failed.reason.code,'cancelled');assert.equal(passed.status,'fulfilled');assert.equal(passed.value.courseId,'7');
 const count=f.count('/modules');await f.client.loadCourseResources('7',{user,signal:new AbortController().signal});assert.equal(f.count('/modules'),count,'completed resources are shared across cancellation scopes');
});

test('snapshot and resource readers isolate pending instructional reads by signal',async()=>{
 const f=fixture(),gate=deferred(),started=deferred(),first=new AbortController(),second=new AbortController();
 f.before=async(u,options)=>{if(u.pathname.endsWith('/quizzes')){started.resolve();await waitFor(gate,options.signal);}};
 const snapshot=f.client.loadSnapshot({signal:first.signal});await started.promise;
 const resources=f.client.loadCourseResources('7',{user,signal:second.signal}),results=Promise.allSettled([snapshot,resources]);await settle();first.abort();gate.resolve();
 const out=await results;assert.equal(out[0].status,'rejected');assert.equal(out[0].reason.code,'cancelled');assert.equal(out[1].status,'fulfilled');assert.equal(out[1].value.quizzes[0].time_limit,10);
});

test('failed old cancellation scope cannot delete a live pending scope or its completed result',async()=>{
 const f=fixture(),gate=deferred(),started=deferred(),first=new AbortController(),second=new AbortController();
 f.before=async(u,options)=>{if(u.pathname.endsWith('/folders')){started.resolve();await waitFor(gate,options.signal);}};
 const old=f.client.loadCourseResources('7',{user,signal:first.signal}),rejected=assert.rejects(old,e=>e.code==='cancelled');await started.promise;
 const live=f.client.loadCourseResources('7',{user,signal:second.signal}),liveResult=Promise.allSettled([live]);await settle();first.abort();await rejected;
 const shared=f.client.loadCourseResources('7',{user,signal:second.signal}),sharedResult=Promise.allSettled([shared]);await settle();gate.resolve();
 const a=(await liveResult)[0],b=(await sharedResult)[0];assert.equal(a.status,'fulfilled');assert.equal(b.status,'fulfilled');assert.equal(a.value,b.value);assert.equal(f.count('/folders'),2);
 const count=f.count('/modules');await f.client.loadCourseResources('7',{user});assert.equal(f.count('/modules'),count);
});

test('force refresh detaches older pending results so they cannot repopulate either cache',async()=>{
 const f=fixture(),gate=deferred(),started=deferred(),signal=new AbortController().signal;
 f.assignments[0].quiz_id='41';
 f.before=async(u,options,revision)=>{if(u.pathname.endsWith('/quizzes')&&revision===1){started.resolve();await waitFor(gate,options.signal);}};
 const old=f.client.loadCourseResources('7',{user,signal});await started.promise;f.revision=2;
 const fresh=f.client.loadCourseResources('7',{user,signal,force:true});await settle();gate.resolve();const [before,after]=await Promise.all([old,fresh]);
 assert.equal(before.quizzes[0].time_limit,10);assert.equal(after.quizzes[0].time_limit,20);assert.equal((await f.client.loadCourseResources('7',{user})).quizzes[0].time_limit,20);
 assert.equal((await f.client.loadSnapshot()).assignments[0].quiz.time_limit,20);
 assert.equal(f.count('/quizzes'),2);
});

test('completed cache hits still reject changed accounts and already cancelled consumers',async()=>{
 const f=fixture();await f.client.loadCourseResources('7',{user});const controller=new AbortController();controller.abort();
 await assert.rejects(f.client.loadCourseResources('7',{user,signal:controller.signal}),e=>e.code==='cancelled');
 f.account='10';await assert.rejects(f.client.loadCourseResources('7',{user}),e=>e.code==='auth');f.account='9';f.revision=2;
 assert.equal((await f.client.loadCourseResources('7',{user})).quizzes[0].time_limit,20);
});
