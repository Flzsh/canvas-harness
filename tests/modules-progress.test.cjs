// Adapted from Gary Wu's pull request #42 to Canvas Harness.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('../extension/modules-page.js'),{createClient}=require('../extension/api.js');
const ORIGIN='https://school.instructure.com',source=fs.readFileSync(require.resolve('../extension/modules-page.js'),'utf8');
const submitted=M.submissions([
 {id:1,submission:{submitted_at:'2026-10-10T12:00:00Z',workflow_state:'submitted'}},
 {id:2,submission:{workflow_state:'unsubmitted',missing:true}},
 {id:3,quiz_id:30,submission:{workflow_state:'graded',score:9}},
 {id:4,discussion_topic:{id:40},submission:{excused:true}}
]);
const modules=[{id:1,name:'Unit 1',items_count:4,items:[
 {id:11,type:'SubHeader',title:'Read'},
 {id:12,type:'Assignment',content_id:1,title:'Submitted',html_url:ORIGIN+'/courses/7/assignments/1'},
 {id:13,type:'File',content_id:5,title:'Reading',html_url:ORIGIN+'/courses/7/files/5'},
 {id:14,type:'Assignment',content_id:2,title:'Homework',html_url:ORIGIN+'/courses/7/assignments/2'}
]}];
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function disk(){
 const values={},reads=[],writes=[],stores=[],listeners=new Map(),control={fail:false};
 const key=({accountId,origin=ORIGIN})=>`reserve:v1:${origin}:${accountId}`;
 function createStore(owner){
  const name=key(owner);let current={},unsubscribe=()=>{};const store={owner,closed:false,
   async load(){reads.push(name);current=structuredClone(values[name]||{moduleProgress:{},tasks:{}});return structuredClone(current);},
   get:()=>structuredClone(current),
   async update(mutator){if(control.fail)throw Error('Storage is full.');const next=structuredClone(values[name]||{moduleProgress:{},tasks:{}});mutator(next);values[name]=structuredClone(next);writes.push(name);current=next;for(const fn of listeners.get(name)||[])fn(structuredClone(next));return structuredClone(next);},
   subscribe(fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);unsubscribe=()=>listeners.get(name).delete(fn);return unsubscribe;},
   destroy(){store.closed=true;unsubscribe();}
  };stores.push(store);return store;
 }
 return {values,reads,writes,stores,control,createStore,key};
}
function canvas({rows=modules,assignments=[{id:1,submission:{workflow_state:'submitted',user_id:'7'}}],user='7',failure=null}={}){
 const calls=[],control={user,failure,rows,assignments};
 const client={origin:ORIGIN,
  async profile(){calls.push('profile');return {id:control.user};},
  async list(path){calls.push(path);if(control.failure?.(path))throw control.failure(path);if(path.includes('/assignments?'))return structuredClone(control.assignments);const match=/\/modules\/(\d+)\/items\?/.exec(path);return structuredClone(match?control.rows.find(module=>String(module.id)===match[1]).items:control.rows);}
 };return {client,calls,control};
}
function progressFixture(options={}){
 const storage=options.storage||disk(),c=canvas(options),events=[];
 const tracker=M.createProgress({client:c.client,createStore:storage.createStore,courseId:options.courseId||'7',origin:options.origin||ORIGIN,onChange:state=>events.push(state)});
 return {...c,storage,events,tracker};
}
test('Canvas completion, submissions and personal marks retain the original completion rules',()=>{
 assert.equal(M.statusOf({type:'SubHeader'},submitted),null);
 assert.equal(M.statusOf({type:'Page',completion_requirement:{completed:true}},submitted).by,'canvas');
 assert.equal(M.statusOf({type:'Assignment',content_id:1},submitted).by,'submitted');
 assert.equal(M.statusOf({type:'Quiz',content_id:30},submitted).done,true);
 assert.equal(M.statusOf({type:'Discussion',content_id:40},submitted).done,true);
 assert.equal(M.statusOf({type:'Assignment',content_id:2},submitted,'opened').done,false);
 assert.equal(M.statusOf({type:'Assignment',content_id:2},submitted,'done').by,'you');
 assert.equal(M.statusOf({type:'File',content_id:9},submitted,'opened').by,'opened');
 assert.equal(M.statusOf({type:'File',content_id:9},submitted,'undone').done,false);
 assert.equal(M.statusOf({type:'Assignment',content_id:1},submitted,'undone').canToggle,false);
 assert.equal(M.statusOf({type:'File',completion_requirement:{completed:true}},submitted,'undone').canToggle,false);
});
test('missing assignment submission data never turns an opened task into completed work',()=>{
 for(const type of ['Assignment','Quiz','Discussion'])for(const subs of [new Map(),M.submissions([{id:2}]),M.submissions([{id:2,submission:null}])]){
  assert.deepEqual(M.statusOf({type,content_id:2},subs,'opened'),{done:false,by:'',canToggle:true});
  assert.equal(M.statusOf({type,content_id:2},subs,'done').done,true);
 }
 for(const type of ['Page','File','ExternalUrl','ExternalTool'])assert.equal(M.statusOf({type},new Map(),'opened').done,true);
 assert.equal(M.statusOf({type:'Page',completion_requirement:{completed:'false'}},new Map()).done,false);
});
test('submitted, graded, pending review and excused work count as done without online timestamps',()=>{
 for(const workflow_state of ['submitted','graded','pending_review'])assert.equal(M.submissions([{id:1,submission:{workflow_state}}]).get('Assignment:1').done,true);
 assert.equal(M.submissions([{id:1,submission:{excused:true}}]).get('Assignment:1').done,true);
 assert.equal(M.submissions([{id:1,submission:{workflow_state:'unsubmitted',missing:true,score:0}}]).get('Assignment:1').done,false);
 assert.throws(()=>M.submissions([{id:1,submission:{user_id:8,workflow_state:'graded'}}],'7'),/account changed/);
});
test('Core semantics keep graded missing and redo work actionable while excused takes precedence',()=>{
 const Core=require('../extension/core.js');
 const cases=[
  {workflow_state:'graded',missing:true,attempt:0,submitted_at:null,score:0},
  {workflow_state:'graded',redo_request:true,attempt:1,submitted_at:'2026-09-10T14:00:00Z',score:8},
  {workflow_state:'submitted',missing:true,submitted_at:'2026-09-10T14:00:00Z'},
  {workflow_state:'pending_review',redo_request:true},
  {workflow_state:'unsubmitted',submitted_at:'2026-09-10T14:00:00Z'},
  {excused:true,missing:true,redo_request:true},
  {graded_at:'2026-09-10T14:00:00Z'},
  {submitted_at:'2026-09-10T14:00:00Z'},
  {attempt:1},
  {submitted_at:'invalid',graded_at:'invalid'}
 ];
 for(const submission of cases){
  const assignment={id:1,quiz_id:30,discussion_topic:{id:40},submission},normalized=Core.normalizeAssignment(assignment,{id:7}),expected=Core.isComplete(normalized),map=M.submissions([assignment]);
  for(const [type,content_id]of [['Assignment',1],['Quiz',30],['Discussion',40]]){
   assert.equal(map.get(`${type}:${content_id}`).done,expected);assert.equal(M.statusOf({type,content_id},map,'opened').done,expected);
   if(normalized.state!=='excused'&&(normalized.missing||normalized.redoRequested))assert.equal(M.statusOf({type,content_id,completion_requirement:{completed:true}},map).done,false);
  }
 }
});
test('progress skips headers and Continue skips completed work, locked modules and locked items',()=>{
 const rows=[
  {id:1,state:'completed',items:[{id:11,type:'SubHeader'},{id:12,type:'Assignment',content_id:1},{id:13,type:'File',content_id:5}]},
  {id:2,state:'locked',items:[{id:21,type:'Page'}]},
  {id:3,state:'unlocked',items:[{id:31,type:'Page',content_details:{locked_for_user:true}},{id:32,type:'ExternalUrl'}]}
 ];
 assert.deepEqual(M.progress(rows[0].items,submitted,{}),{done:1,total:2});assert.equal(M.nextItem(rows,submitted,{}).id,13);
 assert.equal(M.nextItem(rows,submitted,{13:'opened'}).id,32);assert.equal(M.nextItem(rows,submitted,{13:'opened',32:'done'}),null);
 for(const lock of [{locked_for_user:true},{published:false},{content_details:{hidden_for_user:true}}])assert.equal(M.nextItem([{...lock,items:[{id:1,type:'Page'}]}],new Map()),null);
});
test('Continue preserves allowed Canvas links and never targets a quiz-taking page or another origin',()=>{
 const fallback=ORIGIN+'/courses/7/modules/items/13';
 assert.equal(M.itemURL({id:13,html_url:'/courses/7/pages/reading?module_item_id=13'},'7',ORIGIN),ORIGIN+'/courses/7/pages/reading?module_item_id=13');
 for(const html_url of ['https://example.com/courses/7/pages/reading','javascript:alert(1)','/courses/8/pages/reading','/courses/7/quizzes/2/take','/courses/7/quizzes/2/resume','/courses/7/quizzes/2/%74ake','/courses/7/quizzes/2/take%2F','https://name:secret@school.instructure.com/courses/7/pages/reading'])assert.equal(M.itemURL({id:13,html_url},'7',ORIGIN),fallback);
 assert.equal(M.itemURL({id:'bad',html_url:'/courses/7/pages/reading'},'7',ORIGIN),null);
});
test('module marks accept only supported values and numeric item keys',()=>{
 assert.deepEqual(M.courseProgress({marks:{1:'opened',2:'done',3:'undone',4:true,bad:'done'},hideFinished:'yes'}),{marks:{1:'opened',2:'done',3:'undone'},hideFinished:false});
 assert.deepEqual(M.courseProgress(null),{marks:{},hideFinished:false});
});
test('module-item landing marks verify the account and preserve manual undo and Hide finished',async()=>{
 const storage=disk(),c=canvas(),key=storage.key({accountId:'7'}),options={client:c.client,createStore:storage.createStore,courseId:'7',itemId:'13',origin:ORIGIN};
 storage.values[key]={moduleProgress:{7:{marks:{14:'undone'},hideFinished:true}},tasks:{123:{notes:'Keep'}}};await M.recordOpened(options);
 assert.deepEqual(storage.values[key],{moduleProgress:{7:{marks:{13:'opened',14:'undone'},hideFinished:true}},tasks:{123:{notes:'Keep'}}});assert.equal(storage.stores[0].closed,true);
 const writes=storage.writes.length;await M.recordOpened({...options,itemId:'14'});assert.equal(storage.writes.length,writes);assert.equal(storage.values[key].moduleProgress[7].marks[14],'undone');
 const other=canvas({user:'8',assignments:[]});await M.recordOpened({...options,client:other.client});assert.equal(storage.values[storage.key({accountId:'8'})].moduleProgress[7].marks[13],'opened');
 const changed=canvas();let reads=0;changed.client.profile=async()=>({id:++reads===1?'7':'8'});const before=structuredClone(storage.values);await assert.rejects(M.recordOpened({...options,client:changed.client,itemId:'15'}),/account changed/);assert.deepEqual(storage.values,before);
});
test('every module and item page loads through the GET client, including truncated embedded arrays and more than ten pages',async()=>{
 const calls=[];
 const client=createClient({fetchImpl:async(href,options)=>{
  const url=new URL(href),page=Number(url.searchParams.get('page')||1);calls.push({url,options});let rows,next='';
  if(url.pathname==='/api/v1/courses/7/modules'){
   rows=page===1?[{id:1,items_count:12,items:[{id:999,type:'File'}]}]:[{id:2,items_count:1,items:[{id:998,type:'Page'}]}];
   if(page===1)next=ORIGIN+url.pathname+'?page=2';
  }else if(url.pathname==='/api/v1/courses/7/modules/1/items'){
   rows=[{id:page,type:'File'}];if(page<12)next=ORIGIN+url.pathname+'?page='+(page+1);
  }else if(url.pathname==='/api/v1/courses/7/modules/2/items')rows=[{id:20,type:'Page'}];
  else if(url.pathname==='/api/v1/courses/7/assignments'){rows=[{id:page}];if(page===1)next=ORIGIN+url.pathname+'?page=2';}
  else assert.fail('Unexpected Canvas read: '+href);
  return {ok:true,status:200,headers:{get:key=>key==='content-type'?'application/json':key==='link'&&next?`<${next}>; rel="next"`:''},json:async()=>rows};
 }});
 const loaded=await M.loadCourse(client,'7');assert.deepEqual(loaded.modules[0].items.map(item=>item.id),Array.from({length:12},(_,i)=>i+1));
 assert.deepEqual(loaded.modules[1].items.map(item=>item.id),[20]);assert.equal(loaded.assignments.length,2);
 assert.deepEqual(M.progress(loaded.modules.flatMap(module=>module.items),new Map(),{}),{done:0,total:13});
 assert.equal(calls.filter(call=>call.url.pathname.endsWith('/modules')).length,2);assert.equal(calls.filter(call=>call.url.pathname.endsWith('/1/items')).length,12);
 for(const {url,options}of calls){assert.equal(url.origin,ORIGIN);assert.equal(options.method,'GET');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');assert.doesNotMatch(url.pathname,/\/quizzes\//);}
});
test('item endpoint failure and a count mismatch fail closed instead of publishing embedded partial progress',async()=>{
 for(const mode of ['short','duplicate','failed']){
  const c=canvas();c.client.list=async path=>{
   if(path.includes('/modules?'))return [{id:1,items_count:2,items:[{id:1,type:'File'}]}];
   if(path.includes('/items?')){if(mode==='failed')throw Error('Items unavailable.');return mode==='short'?[{id:1,type:'File'}]:[{id:1,type:'File'},{id:1,type:'File'}];}
   return [];
  };
  await assert.rejects(M.loadCourse(c.client,'7'),mode==='failed'?/Items unavailable/:/incomplete module items/);
 }
});
test('pagination failure does not report the pages loaded so far as a complete module',async()=>{
 const client=createClient({fetchImpl:async href=>{
  const url=new URL(href),rows=url.pathname.endsWith('/modules')?[{id:1}]:[{id:1,type:'File'}],next=url.pathname.endsWith('/items')?ORIGIN+url.pathname:'';
  return {ok:true,status:200,headers:{get:key=>key==='content-type'?'application/json':key==='link'&&next?`<${next}>; rel="next"`:''},json:async()=>rows};
 }});
 await assert.rejects(M.loadCourse(client,'7'),/incomplete set of pages/);
});
test('a failed submissions read leaves assignments unfinished and allows manual marks',async()=>{
 const f=progressFixture({failure:path=>path.includes('/assignments?')?Error('Unavailable.'):null});await f.tracker.refresh();
 assert.equal(f.tracker.get().ready,true);assert.match(f.tracker.get().warning,/submissions/);await f.tracker.opened(14);
 assert.equal(f.storage.writes.length,0);assert.equal(M.statusOf(modules[0].items[3],f.tracker.get().subs,'opened').done,false);
 await f.tracker.toggle(14);assert.equal(f.tracker.get().marks[14],'done');f.tracker.destroy();
});
test('marks and Hide finished persist separately for each verified account, site and course',async()=>{
 const storage=disk(),first=progressFixture({storage});await first.tracker.refresh();await first.tracker.opened(13);await first.tracker.hideFinished(true);first.tracker.destroy();
 const again=progressFixture({storage});await again.tracker.refresh();assert.equal(again.tracker.get().marks[13],'opened');assert.equal(again.tracker.get().hideFinished,true);again.tracker.destroy();
 for(const options of [{user:'8',assignments:[]},{courseId:'9'},{origin:'https://other.instructure.com'}]){
  const other=progressFixture({storage,...options});await other.tracker.refresh();assert.deepEqual(other.tracker.get().marks,{});assert.equal(other.tracker.get().hideFinished,false);
  await other.tracker.toggle(14);assert.equal(other.tracker.get().marks[14],'done');other.tracker.destroy();
 }
 assert.equal(storage.values[storage.key({accountId:'7'})].moduleProgress['7'].marks[13],'opened');
 assert.equal(storage.values[storage.key({accountId:'7'})].moduleProgress['7'].marks[14],undefined);
 assert.equal(storage.values[storage.key({accountId:'7'})].moduleProgress['9'].marks[14],'done');
});
test('an account switch during loading or before saving publishes no stale marks',async()=>{
 const f=progressFixture();f.client.profile=async()=>({id:f.calls.push('profile')===1?'7':'8'});await f.tracker.refresh();
 assert.equal(f.tracker.get().ready,false);assert.match(f.tracker.get().error,/account changed/);assert.equal(f.storage.stores[0].closed,true);assert.deepEqual(f.tracker.get().marks,{});f.tracker.destroy();
 const g=progressFixture();await g.tracker.refresh();g.control.user='8';await assert.rejects(g.tracker.toggle(13),/account changed/);
 assert.equal(g.tracker.get().ready,false);assert.deepEqual(g.tracker.get().marks,{});assert.deepEqual(g.storage.writes,[]);g.tracker.destroy();
});
test('an unverified profile or another student submission never opens personal storage',async()=>{
 for(const options of [{user:null},{assignments:[{id:1,submission:{user_id:'8',workflow_state:'graded'}}]}]){
  const f=progressFixture(options);await f.tracker.refresh();assert.equal(f.tracker.get().ready,false);assert.match(f.tracker.get().error,/account changed/);assert.equal(f.storage.stores.length,0);f.tracker.destroy();
 }
});
test('manual toggles, Mark all done and opened marks preserve Canvas-confirmed completion and undo',async()=>{
 const f=progressFixture();await f.tracker.refresh();await f.tracker.toggle(12);assert.equal(f.tracker.get().marks[12],undefined);
 await f.tracker.opened(13);assert.equal(f.tracker.get().marks[13],'opened');await f.tracker.toggle(13);assert.equal(f.tracker.get().marks[13],'undone');
 const writes=f.storage.writes.length;await f.tracker.opened(13);assert.equal(f.storage.writes.length,writes);assert.equal(f.tracker.get().marks[13],'undone');
 await f.tracker.markAll(1);const state=f.tracker.get();assert.deepEqual(state.marks,{13:'done',14:'done'});assert.deepEqual(M.progress(state.modules[0].items,state.subs,state.marks),{done:3,total:3});f.tracker.destroy();
});
test('storage failures keep the persisted state and report the failure',async()=>{
 const f=progressFixture();await f.tracker.refresh();f.storage.control.fail=true;await assert.rejects(f.tracker.toggle(13),/Storage is full/);
 assert.deepEqual(f.tracker.get().marks,{});assert.equal(f.tracker.get().busy,false);assert.match(f.tracker.get().error,/Storage is full/);assert.deepEqual(f.storage.writes,[]);f.tracker.destroy();
});
test('updates merge the latest course marks and preserve other courses and personal data',async()=>{
 const f=progressFixture();await f.tracker.refresh();const key=f.storage.key({accountId:'7'});
 f.storage.values[key]={tasks:{123:{notes:'Keep'}},moduleProgress:{7:{marks:{14:'done'},hideFinished:false},8:{marks:{81:'opened'},hideFinished:true}}};
 await Promise.all([f.tracker.toggle(13),f.tracker.hideFinished(true)]);
 assert.deepEqual(f.storage.values[key],{tasks:{123:{notes:'Keep'}},moduleProgress:{7:{marks:{13:'done',14:'done'},hideFinished:true},8:{marks:{81:'opened'},hideFinished:true}}});f.tracker.destroy();
});
test('idle controllers make no requests, publish storage updates synchronously, and destroy subscriptions',async()=>{
 const f=progressFixture();await f.tracker.refresh();const calls=f.calls.length,other=f.storage.createStore({accountId:'7',origin:ORIGIN});await other.load();
 await other.update(data=>{data.moduleProgress['7']={marks:{13:'done'},hideFinished:true};});assert.equal(f.tracker.get().marks[13],'done');assert.equal(f.events.at(-1).hideFinished,true);
 await Promise.resolve();assert.equal(f.calls.length,calls);f.tracker.destroy();const count=f.events.length;await other.update(data=>{data.moduleProgress['7'].marks[14]='done';});assert.equal(f.events.length,count);other.destroy();
 assert.doesNotMatch(source,/setInterval\s*\(|setTimeout\s*\(|requestAnimationFrame\s*\(|async function paint/);
});
test('a suspended back-forward page verifies its new account before displaying progress again',async()=>{
 const f=progressFixture();await f.tracker.refresh();await f.tracker.toggle(13);f.tracker.suspend();assert.equal(f.tracker.get().ready,false);assert.deepEqual(f.tracker.get().marks,{});
 f.control.user='8';f.control.assignments=[];await f.tracker.refresh();assert.equal(f.tracker.get().accountId,'8');assert.deepEqual(f.tracker.get().marks,{});f.tracker.destroy();
});
test('destroyed controllers never publish a pending course load or open account storage',async()=>{
 const f=progressFixture(),gate=deferred();f.client.list=()=>gate.promise;const pending=f.tracker.refresh();await Promise.resolve();f.tracker.destroy();const events=f.events.length;
 gate.resolve([]);await pending;assert.equal(f.events.length,events);assert.equal(f.storage.stores.length,0);
});
test('real account storage preserves module progress through reload and isolates another account',async()=>{
 const {createStore}=require('../extension/storage.js'),values={},listeners=new Map();
 const adapter={read:async key=>structuredClone(values[key]),write:async(key,value)=>{values[key]=structuredClone(value);for(const fn of listeners.get(key)||[])fn({newValue:structuredClone(value)});},subscribe(key,fn){if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);return()=>listeners.get(key).delete(fn);}};
 const make=user=>M.createProgress({client:canvas({user,assignments:[]}).client,createStore:owner=>createStore({...owner,adapter}),courseId:'7',origin:ORIGIN});
 const first=make('7');await first.refresh();await first.toggle(13);await first.hideFinished(true);first.destroy();
 const again=make('7');await again.refresh();assert.equal(again.get().marks[13],'done');assert.equal(again.get().hideFinished,true);again.destroy();
 const other=make('8');await other.refresh();assert.deepEqual(other.get().marks,{});assert.equal(other.get().hideFinished,false);other.destroy();
});
test('the existing Modules controller owns the feature and introduces no permissions, CSS or artwork',()=>{
 assert.doesNotMatch(source,/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]|localStorage|createElement\(['"]style['"]\)|<svg|\.style\./i);
 assert.match(source,/getElementById\('context_modules'\)/);assert.match(source,/enabled\('course-nav'\)/);
 assert.match(source,/ReserveModulesPage\.progress=tracker/);assert.match(source,/ReserveFeatureLoad\.then/);
 assert.match(source,/Art\.icons\[kind\]\|\|Art\.icons\.tool/);
});
