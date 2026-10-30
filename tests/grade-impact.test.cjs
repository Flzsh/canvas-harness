// Adapted from Gary Wu's pull request #46 to Canvas Harness.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// The drawings load first, as in the extension (features.js lists grade-impact-art.js before grade-impact.js).
const Art=require('../extension/grade-impact-art.js'),G=require('../extension/grade-impact.js'),Grades=require('../extension/grades-view.js'),{createClient}=require('../extension/api.js');
const ORIGIN='https://school.instructure.com',NOW=Date.parse('2026-10-20T15:00:00Z'),user={id:'9'};
const day=n=>new Date(NOW+n*864e5).toISOString(),tick=()=>new Promise(resolve=>setImmediate(resolve));
const clone=value=>structuredClone(value),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ~= ${b}`);
const graded=(id,score,points,extra={})=>({id,name:'Done '+id,course_id:'5',grading_type:'points',points_possible:points,submission:{assignment_id:id,user_id:'9',score,workflow_state:'graded',submitted_at:day(-5),posted_at:day(-4)},...extra});
const coming=(id,points,due,extra={})=>({id,name:'Coming '+id,course_id:'5',grading_type:'points',points_possible:points,due_at:due,html_url:'javascript:alert(1)',submission:{assignment_id:id,user_id:'9',score:null,workflow_state:'unsubmitted',submitted_at:null},...extra});
const group=(id,weight,assignments,rules={})=>({id,group_weight:weight,rules,assignments});
function envelope(groups,weighted=true,score=85,extra={}){const rows=clone(groups);return {origin:ORIGIN,accountId:'9',courseId:'5',course:{id:'5',hide_final_grades:false,multiple_grading_periods_enabled:false,apply_assignment_group_weights:weighted,enrollments:[{type:'student',user_id:'9',computed_current_score:score}],...extra},groups:rows.map(({assignments,...meta})=>meta),assignments:rows.flatMap(g=>g.assignments.map(a=>({...a,assignment_group_id:g.id})))};}
const groups=[group('1',50,[graded('1',40,50),coming('2',50,day(3),{name:'Unit <3> test'})]),group('2',50,[graded('3',9,10)])];
const base=()=>envelope(groups),model=data=>G.model(data,{showGrades:true});
const course={id:'5',name:'Chemistry',shortName:'Chem',score:85,scoreScope:'overall',hideFinalGrades:false,gradingPeriodId:null,color:'#3366aa'};
const context=(showGrades=true,extra={})=>({s:{showGrades,timeZone:'America/New_York'},state:{courseId:'all'},workspace:'grades',user,courses:[{...course}],items:[],now:NOW,gradeImpactRevision:'snapshot-1',...extra});
const helpers={E:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),formatDate:value=>value.slice(5,10),icon:()=>'',scoreText:c=>c.score+'%',gradePeriodLabel:()=> 'Overall grade',assignmentLink:item=>`${ORIGIN}/courses/${item.courseId}/assignments/${item.id}`};
const ready=data=>({owner:'9',get:()=>({state:'ready',model:model(data)})});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function response(body,{status=200,link=''}={}){return {ok:status>=200&&status<300,status,headers:{get:name=>name==='link'?link:name==='content-type'?'application/json':null},json:async()=>body};}

test('ported weighted arithmetic: current grade and one upcoming assignment at 0/70/85/100 percent',()=>{
 const m=model(base());assert.equal(m.supported,true);close(m.current,85);
 const imp=m.impact(m.upcoming[0]);close(imp.at(0),65);close(imp.at(1),90);close(imp.at(.85),86.25);close(imp.at(.7),82.5);close(imp.swing,25);
 assert.equal(imp.at(null),null);assert.equal(imp.at(-1),null);assert.equal(imp.at(Infinity),null);assert.equal(imp.at(1.1),null);
 assert.equal(m.impact({...m.upcoming[0]}),null);assert.equal(m.upcoming[0].url,ORIGIN+'/courses/5/assignments/2');
});
test('fixture envelopes isolate nested submissions and category rules between cases',()=>{
 const first=base();first.assignments[0].submission.score=null;first.groups[0].rules.drop_lowest=1;assert.equal(base().assignments[0].submission.score,40);assert.deepEqual(base().groups[0].rules,{});assert.equal(model(base()).supported,true);
});
test('ported points arithmetic ignores category weights and preserves a valid zero baseline',()=>{
 const m=model(envelope([group('1',0,[graded('1',40,50),coming('2',10,day(3))]),group('2',0,[graded('3',9,10)])],false,81.67));
 assert.equal(m.supported,true);close(m.current,49/60*100);const imp=m.impact(m.upcoming[0]);close(imp.at(0),49/70*100);close(imp.at(1),59/70*100);
 const zero=model(envelope([group('1',100,[graded('1',0,10),coming('2',10,day(3))])],false,0));assert.equal(zero.supported,true);close(zero.current,0);close(zero.impact(zero.upcoming[0]).at(1),50);
});
test('ported exclusions: omitted, zero-point, excused, submitted and unpublished work do not become candidates',()=>{
 const m=model(envelope([group('1',100,[graded('1',8,10),coming('2',10,day(2),{omit_from_final_grade:true}),coming('3',0,day(2)),coming('4',10,day(2),{submission:{excused:true}}),coming('5',10,day(2),{submission:{workflow_state:'submitted',submitted_at:day(-1)}}),coming('6',10,day(2)),coming('8',10,day(2),{published:false}),coming('9',10,day(2),{grading_type:'not_graded'})]),group('2',0,[graded('7',0,10),coming('10',100,day(2))])],true,80));
 assert.equal(m.supported,true);assert.deepEqual(m.upcoming.map(row=>row.id),['6']);close(m.current,80);
});
test('ported due window includes a day late, excludes undated/far-future work, and ranks by verified swing',()=>{
 const m=model(envelope([group('1',100,[graded('1',45,50),coming('2',10,day(4)),coming('3',50,day(10)),coming('4',50,day(30)),coming('5',50,''),coming('6',50,day(-3)),coming('7',5,day(-.5))])],true,90));
 assert.deepEqual(G.rows(m,{now:NOW}).map(row=>row.id),['3','2','7']);assert.deepEqual(G.rows(m,{now:NaN}),[]);
});
test('effective per-student cached due dates take precedence, including an explicit no-due-date override',()=>{
 const data=base();data.assignments[1].submission.cached_due_date=day(30);assert.deepEqual(G.rows(model(data),{now:NOW}),[]);
 data.assignments[1].submission.cached_due_date=day(2);assert.equal(G.rows(model(data),{now:NOW})[0].due,day(2));
 data.assignments[1].submission.cached_due_date=null;assert.deepEqual(G.rows(model(data),{now:NOW}),[]);
});
test('null, absent, non-finite, blank and mismatched Canvas baselines refuse every estimate, including swing',()=>{
 for(const score of [null,undefined,'',NaN,Infinity,88,85.4]){const data=base();data.course.enrollments[0].computed_current_score=score;const m=model(data);assert.equal(m.supported,false,String(score));assert.equal(m.current,null);assert.deepEqual(m.upcoming,[]);assert.deepEqual(G.rows(m,{now:NOW}),[]);}
 const m=model(base());assert.equal(G.trusted(m,null),false);assert.equal(G.trusted(m,''),false);assert.equal(G.trusted(m,85.4),false);assert.equal(G.trusted(m,85.005),true);
 const data=base();data.assignments=data.assignments.filter(a=>a.submission.workflow_state!=='graded');assert.equal(model(data).supported,false);
});
test('model requires explicit grade reveal and refuses all hidden-final-grade sources',()=>{
 assert.equal(G.model(base()).supported,false);assert.equal(G.model(base(),{showGrades:false}).current,null);
 for(const change of [{hide_final_grades:true},{hideFinalGrades:true},{scoreScope:'hidden'},{restrict_quantitative_data:true}]){const m=model(envelope(groups,true,85,change));assert.equal(m.reason,'hidden');assert.equal(m.current,null);assert.deepEqual(m.upcoming,[]);}
});
test('course, enrollment and assignment grading periods refuse calculations rather than mixing scopes',()=>{
 for(const change of [{multiple_grading_periods_enabled:true},{current_grading_period_id:'7'},{grading_period_set_id:'7'},{grading_periods_enabled:true},{has_grading_periods:true},{grading_periods_weighted:true},{grading_periods:[{id:'7'}]},{scoreScope:'current-period'},{gradingPeriodId:'7'}])assert.equal(model(envelope(groups,true,85,change)).reason,'period');
 const data=base();data.course.enrollments[0].current_grading_period_id='7';assert.equal(model(data).reason,'period');delete data.course.enrollments[0].current_grading_period_id;
 data.assignments[0].grading_period_id='7';assert.equal(model(data).reason,'period');delete data.assignments[0].grading_period_id;data.assignments[0].in_closed_grading_period=true;assert.equal(model(data).reason,'period');
});
test('missing course settings, ambiguous enrollment and foreign account metadata are not inferred',()=>{
 for(const field of ['hide_final_grades','multiple_grading_periods_enabled','apply_assignment_group_weights']){const data=base();delete data.course[field];assert.equal(model(data).supported,false,field);}
 const data=base();data.course.enrollments.push(clone(data.course.enrollments[0]));assert.equal(model(data).supported,false);
 data.course.enrollments=[{type:'teacher',computed_current_score:85}];assert.equal(model(data).supported,false);
 data.course.enrollments=[{type:'student',user_id:'10',computed_current_score:85}];assert.equal(model(data).supported,false);
 for(const change of [{origin:'https://other.instructure.com'},{accountId:null},{courseId:'6'}])assert.equal(model({...base(),...change}).supported,false);
});
test('drop rules, unknown rules, grade overrides, invalid weights and extra credit refuse every calculation',()=>{
 for(const rules of [{drop_lowest:1},{drop_highest:1},{never_drop:['1']},{future_rule:true},{drop_lowest:-1}]){const data=base();data.groups[0].rules=rules;assert.equal(model(data).reason,'rules');}
 const zeros=base();zeros.groups[0].rules={drop_lowest:0,drop_highest:0,never_drop:[]};assert.equal(model(zeros).supported,true);
 const override=base();override.course.enrollments[0].override_score=85;assert.equal(model(override).supported,false);
 for(const weight of [null,-1,101,45]){const data=base();data.groups[0].group_weight=weight;assert.equal(model(data).supported,false);}
 const extra=base();extra.assignments[0].submission.score=51;assert.equal(model(extra).reason,'extra');
 const zero=base();zero.assignments[0].points_possible=0;assert.equal(model(zero).reason,'extra');
});
test('unposted, earlier-attempt, hidden, incomplete and unsupported submission grades are refused',()=>{
 for(const change of [{posted_at:null},{grade_matches_current_submission:false},{hidden:true},{score:null},{score:'not a number'},{score:-1},{workflow_state:'pending_review'}]){const data=base();Object.assign(data.assignments[0].submission,change);assert.equal(model(data).supported,false,JSON.stringify(change));}
 for(const change of [{submission:null},{points_possible:null},{grading_type:'pass_fail'},{anonymous_grading:true},{moderated_grading:true}]){const data=base();Object.assign(data.assignments[0],change);assert.equal(model(data).supported,false,JSON.stringify(change));}
 const foreign=base();foreign.assignments[0].submission.user_id='10';assert.equal(model(foreign).supported,false);
 const assignment=base();assignment.assignments[0].submission.assignment_id='88';assert.equal(model(assignment).supported,false);
});
test('duplicate or orphan records and malformed lists fail closed',()=>{
 const duplicate=base();duplicate.assignments.push(clone(duplicate.assignments[0]));assert.equal(model(duplicate).reason,'data');
 const orphan=base();orphan.assignments[0].assignment_group_id='88';assert.equal(model(orphan).reason,'data');
 const duplicateGroup=base();duplicateGroup.groups.push(clone(duplicateGroup.groups[0]));assert.equal(model(duplicateGroup).reason,'data');
 for(const change of [{groups:null},{assignments:null}])assert.equal(model({...base(),...change}).reason,'data');
});
test('empty weighted categories use Canvas active-category normalization when their first assignment is scored',()=>{
 const m=model(envelope([group('1',50,[graded('1',8,10)]),group('2',50,[coming('2',10,day(3))])],true,80));
 assert.equal(m.supported,true);close(m.current,80);close(m.impact(m.upcoming[0]).at(0),40);close(m.impact(m.upcoming[0]).at(1),90);
});

test('the Grades list shows each course as a compact strip: escaped names, swings, honest projections, links and no script URLs',()=>{
 const html=G.render(context(),helpers,ready(base()));assert.match(html,/Coming up/);assert.match(html,/rd-grade-sheet ch-impact/);assert.match(html,/Unit &lt;3&gt; test/);assert.match(html,/moves 25\.0/);
 assert.match(html,/0% gives 65\.0, 100% gives 90\.0/);assert.match(html,/class="gi gi-strip"/);assert.match(html,/data-gi-open="5"/);assert.doesNotMatch(html,/javascript:|\/quizzes\/|<script|on[a-z]+=/i);
 assert.match(html,/href="https:\/\/school.instructure.com\/courses\/5\/assignments\/2"/);
});
test('hidden grades, another workspace, a disabled feature and a foreign owner produce no section at all',()=>{
 const loader=ready(base());assert.equal(G.render(context(false),helpers,loader),'');assert.equal(G.render(context(true,{workspace:'work'}),helpers,loader),'');assert.equal(G.render(context(true,{gradeImpactEnabled:false}),helpers,loader),'');assert.equal(G.render(context(true,{user:{id:'10'}}),helpers,loader),'');
 const previous=global.ReserveFeatures;try{global.ReserveFeatures={enabled:()=>false};assert.equal(G.render(context(),helpers,loader),'');}finally{if(previous===undefined)delete global.ReserveFeatures;else global.ReserveFeatures=previous;}
});
test('course privacy/period/baseline changes remove stale blurbs, including every swing',()=>{
 for(const change of [{hideFinalGrades:true},{hide_final_grades:true},{scoreScope:'current-period'},{gradingPeriodId:'7'},{score:null},{score:70}]){const html=G.render(context(true,{courses:[{...course,...change}]}),helpers,ready(base()));assert.doesNotMatch(html,/ch-impact-row|ch-impact-scores|25\.0|100% →/);assert.match(html,/ch-impact-status/);}
 assert.equal(G.render(context(true,{state:{courseId:'6'}}),helpers,ready(base())).includes('Unit &lt;3&gt;'),false);
});
test('loading, errors and unsupported calculations are explicit and never become an empty-success message',()=>{
 for(const entry of [{state:'loading'},{state:'error',error:'Canvas could not load groups (403). <retry>'},{state:'unavailable',reason:'rules'}]){const html=G.render(context(),helpers,{owner:'9',get:()=>entry});assert.match(html,/ch-impact-status/);assert.doesNotMatch(html,/No upcoming graded work|ch-impact-row/);if(entry.state==='error')assert.match(html,/403\)\. &lt;retry&gt;/);}
 const html=G.render(context(),helpers,{owner:'9',get:()=>({state:'ready',model:model(envelope([group('1',100,[graded('1',8,10)])],true,80))})});assert.match(html,/Canvas grade does not match/);
});
// 4.0: the 4.0 design replaces the 3.x behaviour this case pinned (see the ported 4.0 tests for the new behaviour).

test('ported loader is lazy, deduplicates active requests, and retains a stamp across idle time and renders',async()=>{
 const calls=[];let changes=0;const loader=G.create({user,client:{loadGradeImpact:async(id,options)=>{calls.push({id,options});return base();}},onChange:()=>changes++});
 assert.equal(calls.length,0);loader.ensure(context(false));loader.ensure(context(true,{workspace:'work'}));assert.equal(calls.length,0);
 const c=context();loader.ensure(c);loader.ensure(c);assert.equal(calls.length,1);await tick();assert.equal(loader.get('5',c).state,'ready');assert.equal(changes,1);assert.equal(calls[0].options.user.id,'9');
 const realNow=Date.now;try{Date.now=()=>NOW+365*864e5;for(let i=0;i<20;i++)loader.ensure({...c,now:Date.now()+i*60000});assert.equal(calls.length,1);assert.equal(loader.get('5',c).state,'ready');}finally{Date.now=realNow;}
 const next={...c,gradeImpactRevision:'snapshot-2'};assert.equal(loader.get('5',next),null);loader.ensure(next);assert.equal(calls.length,2);await tick();assert.equal(loader.get('5',next).state,'ready');
 loader.invalidate();assert.equal(loader.get('5',next),null);loader.ensure(next);assert.equal(calls.length,3);await tick();assert.equal(loader.get('5',next).state,'ready');
 const source=fs.readFileSync(path.join(__dirname,'../extension/grade-impact.js'),'utf8');assert.doesNotMatch(source,/setInterval|setTimeout|requestAnimationFrame|TTL/);loader.destroy();assert.equal(loader.get('5',c),null);loader.ensure(c);assert.equal(calls.length,3);
});
test('errors remain cached across idle time and renders until explicit invalidation or a new snapshot stamp',async()=>{
 let calls=0;const loader=G.create({user,client:{loadGradeImpact:async()=>{calls++;throw Error('Still unavailable');}}}),c=context();loader.ensure(c);await tick();assert.equal(loader.get('5',c).state,'error');
 const realNow=Date.now;try{Date.now=()=>NOW+365*864e5;loader.ensure({...c,now:Date.now()});assert.equal(loader.get('5',c).state,'error');assert.equal(calls,1);}finally{Date.now=realNow;}
 loader.invalidate();loader.ensure(c);await tick();assert.equal(calls,2);loader.ensure({...c,gradeImpactRevision:'snapshot-2'});await tick();assert.equal(calls,3);loader.destroy();
});
test('hiding grades, leaving Grades, changing course, changing account and destroying abort pending work and discard late results',async()=>{
 for(const change of [context(false),context(true,{workspace:'work'}),context(true,{state:{courseId:'6'}}),context(true,{user:{id:'10'}}),null]){
  const pending=deferred();let signal,changes=0;const loader=G.create({user,client:{loadGradeImpact:(id,options)=>{signal=options.signal;return pending.promise;}},onChange:()=>changes++});const c=context();loader.ensure(c);
  if(change)loader.ensure(change);else loader.destroy();assert.equal(signal.aborted,true);pending.resolve(base());await tick();assert.equal(loader.get('5',change||c),null);assert.equal(G.render(change||c,helpers,loader).includes('ch-impact-row'),false);if(!change||change.s.showGrades===false||change.workspace!=='grades'||change.user.id!=='9')assert.equal(changes,0);
 }
});
test('snapshot and submission state changes remove old blurbs immediately and redraw only verified current results',async()=>{
 const calls=[];const loader=G.create({user,client:{loadGradeImpact:(id,options)=>{const wait=deferred();calls.push({...wait,signal:options.signal});return wait.promise;}}});
 const c=context();loader.ensure(c);calls[0].resolve(base());await tick();assert.match(G.render(c,helpers,loader),/100% gives 90\.0/);
 const next=context(true,{gradeImpactRevision:'snapshot-2',courses:[{...course,score:90}],items:[{id:'3',courseId:'5',score:10,state:'graded'}]});loader.ensure(next);assert.doesNotMatch(G.render(next,helpers,loader),/ch-impact-row/);
 const data=base();data.course.enrollments[0].computed_current_score=90;data.assignments[2].submission.score=10;calls[1].resolve(data);await tick();assert.match(G.render(next,helpers,loader),/100% gives 95\.0/);
 const handedIn={...next,items:[...next.items,{id:'2',courseId:'5',state:'submitted',submittedAt:day(0)}]};loader.ensure(handedIn);assert.doesNotMatch(G.render(handedIn,helpers,loader),/ch-impact-row/);data.assignments[1].submission.workflow_state='submitted';data.assignments[1].submission.submitted_at=day(0);calls[2].resolve(data);await tick();assert.match(G.render(handedIn,helpers,loader),/No upcoming graded work/);assert.doesNotMatch(G.render(handedIn,helpers,loader),/ch-impact-row/);loader.destroy();
});
test('older in-flight generations cannot overwrite refreshed state even when transport ignores abort',async()=>{
 const waits=[];const loader=G.create({user,client:{loadGradeImpact:()=>{const wait=deferred();waits.push(wait);return wait.promise;}}});const c=context();loader.ensure(c);const next={...c,gradeImpactRevision:'new'};loader.ensure(next);
 waits[1].resolve(base());await tick();assert.equal(loader.get('5',next).state,'ready');const bad=base();bad.course.hide_final_grades=true;waits[0].resolve(bad);await tick();assert.equal(loader.get('5',next).state,'ready');loader.destroy();
});
test('known hidden/period/null-baseline courses and disabled features do not request grade data',()=>{
 let calls=0;const loader=G.create({user,client:{loadGradeImpact:async()=>{calls++;return base();}}});
 for(const change of [{hideFinalGrades:true},{scoreScope:'current-period'},{gradingPeriodId:'7'},{score:null}])loader.ensure(context(true,{courses:[{...course,...change}]}));
 loader.ensure(context(true,{gradeImpactEnabled:false}));assert.equal(calls,0);loader.destroy();
});
test('quiz routes cannot request or render grade impact even with a forged Grades context',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../extension/grade-impact.js'),'utf8');
 for(const pathname of ['/courses/5/quizzes/2/take','/courses/5/quizzes/2','/courses/5/quizzes/2/history']){
  const sandbox={location:{pathname},module:{exports:{}}};vm.runInNewContext(source,sandbox);const Q=sandbox.module.exports;let calls=0;const loader=Q.create({user,client:{loadGradeImpact:async()=>{calls++;return base();}}});loader.ensure(context());assert.equal(calls,0);assert.equal(Q.render(context(),helpers,loader),'');loader.destroy();
 }
});
test('loader exposes request errors and missing clients, and account failures clear every cached estimate',async()=>{
 const c=context();let auth=0;const failing=G.create({user,client:{loadGradeImpact:async()=>{throw Error('Canvas refused categories (403).');}}});failing.ensure(c);await tick();assert.match(G.render(c,helpers,failing),/Canvas refused categories \(403\)/);assert.doesNotMatch(G.render(c,helpers,failing),/No upcoming graded work/);failing.destroy();
 const missing=G.create({user});missing.ensure(c);assert.match(G.render(c,helpers,missing),/Canvas grade impact unavailable/);missing.destroy();
 const foreign=G.create({user,onAuthError:()=>auth++,client:{loadGradeImpact:async()=>({...base(),accountId:'10'})}});foreign.ensure(c);await tick();assert.equal(auth,1);assert.equal(foreign.get('5',c).state,'error');assert.doesNotMatch(G.render(c,helpers,foreign),/ch-impact-row/);foreign.destroy();
});
test('loader bounds concurrent course reads and only schedules queued work while Grades remains visible',async()=>{
 const waits=[],calls=[];const loader=G.create({user,client:{loadGradeImpact:(id,options)=>{const wait=deferred();waits.push(wait);calls.push({id,signal:options.signal});return wait.promise;}}});const c=context(true,{courses:['5','6','7'].map(id=>({...course,id}))});loader.ensure(c);assert.equal(calls.length,2);
 waits[0].resolve(base());await tick();assert.equal(calls.length,3);loader.ensure(context(false));assert.equal(calls[1].signal.aborted,true);assert.equal(calls[2].signal.aborted,true);waits[1].resolve(base());waits[2].resolve(base());await tick();assert.equal(loader.get('5',c),null);loader.destroy();
});

test('assignment_groups allowlist accepts only the course collection, follows safe pagination, and always fetches GET',async()=>{
 const calls=[];const client=createClient({fetchImpl:async(url,options)=>{calls.push({url,options});return response([{id:'1'}]);}});
 await client.list('/api/v1/courses/5/assignment_groups',{method:'POST',body:'ignored'});assert.equal(calls[0].options.method,'GET');assert.equal(Object.hasOwn(calls[0].options,'body'),false);
 for(const endpoint of ['/api/v1/courses/5/assignment_groups/1','/api/v1/courses/no/assignment_groups','/courses/5/quizzes/1/take','/api/v1/courses/5/quizzes/1/questions','/api/v1/courses/5/assignment_groups%2f1'])await assert.rejects(client.list(endpoint),error=>error.code==='endpoint');
 assert.equal(calls.length,1);
 const paged=createClient({fetchImpl:async()=>response([],{link:'<https://evil.example/api/v1/courses/5/assignment_groups?page=2>; rel="next"'})});await assert.rejects(paged.list('/api/v1/courses/5/assignment_groups'),error=>error.code==='origin');
});
test('grade impact API reads current course settings, paginates all groups and assignments, and verifies identity on both ends',async()=>{
 const data=base(),calls=[];let profiles=0;const client=createClient({fetchImpl:async(url,options)=>{
  calls.push({url,options});const u=new URL(url);
  if(u.pathname.endsWith('/profile')){profiles++;return response(user);}
  if(u.pathname==='/api/v1/courses/5'){assert.deepEqual(u.searchParams.getAll('include[]'),['total_scores','current_grading_period_scores']);return response(data.course);}
  if(u.pathname.endsWith('/assignment_groups'))return u.searchParams.get('page')==='2'?response(data.groups.slice(1)):response(data.groups.slice(0,1),{link:`<${ORIGIN}/api/v1/courses/5/assignment_groups?per_page=100&page=2>; rel="next"`});
  if(u.pathname.endsWith('/assignments')){assert.equal(u.searchParams.get('include[]'),'submission');return u.searchParams.get('page')==='2'?response(data.assignments.slice(1)):response(data.assignments.slice(0,1),{link:`<${ORIGIN}/api/v1/courses/5/assignments?include[]=submission&per_page=100&page=2>; rel="next"`});}
  throw Error('Unexpected endpoint '+url);
 }});
 const result=await client.loadGradeImpact('5',{user});assert.equal(profiles,2);assert.equal(result.origin,ORIGIN);assert.equal(result.accountId,'9');assert.equal(result.courseId,'5');assert.deepEqual(result.groups,data.groups);assert.deepEqual(result.assignments,data.assignments);assert.equal(model(result).supported,true);
 assert.ok(calls.every(call=>call.options.method==='GET'&&call.options.credentials==='same-origin'&&call.options.redirect==='error'));assert.ok(calls.filter(call=>call.url.includes('/profile')).every(call=>call.options.cache==='no-store'));
});
test('grade impact API skips all assignment requests when current Canvas metadata hides grades or uses periods',async()=>{
 for(const change of [{hide_final_grades:true},{multiple_grading_periods_enabled:true},{current_grading_period_id:'7'},{grading_period_set_id:'7'},{restrict_quantitative_data:true},{apply_assignment_group_weights:undefined}]){
  const calls=[],data=base();Object.assign(data.course,change);const client=createClient({fetchImpl:async url=>{calls.push(url);return response(url.includes('/profile')?user:data.course);}});const result=await client.loadGradeImpact('5',{user});assert.equal(calls.length,3);assert.deepEqual(result.groups,[]);assert.deepEqual(result.assignments,[]);assert.equal(model(result).supported,false);
 }
});
test('grade impact API refuses invalid identities and ids before requests, and rejects an account change before publishing',async()=>{
 let calls=0,profiles=0;const data=base();const client=createClient({fetchImpl:async url=>{calls++;if(url.includes('/profile'))return response({id:++profiles===1?'9':'10'});if(url.includes('/assignment_groups'))return response(data.groups);if(url.includes('/assignments'))return response(data.assignments);return response(data.course);}});
 await assert.rejects(client.loadGradeImpact('5'),error=>error.code==='auth');await assert.rejects(client.loadGradeImpact('../5',{user}),error=>error.code==='endpoint');assert.equal(calls,0);
 await assert.rejects(client.loadGradeImpact('5',{user}),error=>error.code==='auth');assert.equal(profiles,2);
});
test('grade impact API preserves request and incomplete-pagination failures instead of publishing partial arithmetic',async()=>{
 for(const failure of ['groups','assignments','pagination']){
  const data=base();const client=createClient({fetchImpl:async url=>{if(url.includes('/profile'))return response(user);if(url.includes('/assignment_groups'))return failure==='groups'?response({}, {status:403}):response(data.groups);if(url.includes('/assignments'))return failure==='assignments'?response({}, {status:500}):response(data.assignments,{link:`<${url}>; rel="next"`});return response(data.course);}});
  await assert.rejects(client.loadGradeImpact('5',{user}),error=>error.code===({groups:'403',assignments:'500',pagination:'pagination'}[failure]));
 }
});

// ---------------------------------------------------------------- the weighing room and its Home module
// Two coming items (Unit <3> test, 50 pts in tests; Lab quiz, 10 pts in labs), so what-ifs can stack.
const twoGroups=[group('1',50,[graded('1',40,50),coming('2',50,day(3),{name:'Unit <3> test'})]),group('2',50,[graded('3',9,10),coming('4',10,day(5),{name:'Lab quiz'})])];
const two=()=>envelope(twoGroups);
const homeItems=[{id:'2',courseId:'5',name:'Unit <3> test',points:50,dueAt:day(3),state:'unsubmitted'},{id:'4',courseId:'5',name:'Lab quiz',points:10,dueAt:day(5),state:'unsubmitted'}];
const home=(showGrades=true,extra={})=>context(showGrades,{workspace:'work',workPage:'home',items:homeItems,...extra});
const roomOf=(showGrades=true,extra={})=>context(showGrades,{state:{courseId:'5'},items:homeItems,...extra});
async function live(data=two(),extra={}){const navigations=[];const loader=G.create({user,client:{loadGradeImpact:async()=>clone(data)},navigate:request=>{navigations.push(request);return true;},...extra});loader.ensure(roomOf(true,extra.context||{}));await tick();return {loader,navigations};}
function placed(run){const previous=global.ReserveWorkspaceArrange;global.ReserveWorkspaceArrange={snapshot:()=>({order:['impact']})};try{return run();}finally{if(previous===undefined)delete global.ReserveWorkspaceArrange;else global.ReserveWorkspaceArrange=previous;}}
// The words a student can see or hear: text, plus accessible names and values (never ids in URLs or geometry).
const visibleText=html=>html.replace(/<(?:path|circle|rect)\b[^>]*>/g,'').replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi,(m,tag,attrs)=>' '+[...attrs.matchAll(/(aria-label|aria-valuetext|title)="([^"]*)"/g)].map(a=>a[2]).join(' ')+' ').replace(/<\/[a-z][a-z0-9]*>/gi,' ');

test('both modes render: the room is the whole drawn room, the Home module puts the answer first in three sizes',async()=>{
 const {loader}=await live();loader.control.measure('room',1440,900);
 const room=G.render(roomOf(),helpers,loader);
 for(const part of ['class="gi gi-room"','gi-l-far','gi-l-shaft','gi-l-near','gi-view-day','gi-view-night','gi-view-sea','gi-view-starry','gi-view-stars','gi-view-blue','id="gi-room-title"','data-gi-action="fold"','role="slider"','data-gi-band="80"','As Canvas reports it','gi-ledger-link','href="https://school.instructure.com/courses/5/grades"'])assert.ok(room.includes(part),part);
 assert.match(room,/aria-label="Unit &lt;3&gt; test what-if"/);assert.match(room,/aria-valuetext="0% gives 65\.0, 100% gives 90\.0"/);
 placed(()=>{
  for(const size of ['s','m','l']){const c=home(true,{s:{showGrades:true,timeZone:'America/New_York',moduleSize:{impact:size}}});loader.ensure(c);const html=G.renderModule(c,helpers,loader);
   assert.match(html,new RegExp(`class="gi gi-mod" data-rd-key="gi-mod" data-gi-size="${size}"`));assert.doesNotMatch(html,/gi-l-far|gi-l-near|gi-view|gi-lamp/,'no environment in the module');
   // head, the answer, the ruler with its band tabs, a row per coming assignment with its slider, Add assignment
   const order=['gi-mod-top','class="gi-ans"','class="gi-band gi-tab" data-gi-band="80"','class="gi-row"','data-gi-action="add"'].map(part=>html.indexOf(part));
   assert.ok(order.every((at,i)=>at>0&&(!i||at>order[i-1])),`${size}: ${order}`);
   assert.equal((html.match(/class="gi-row[ "]/g)||[]).length,2,'both coming assignments have a row');assert.equal((html.match(/role="slider"/g)||[]).length,2);assert.doesNotMatch(html,/class="gi-wt[ "]/,'no weights on Home');}
  // the corner control has a name of its own; the course it opens is read out from the module's course line
  const opener=G.moduleOpener(home(),helpers,loader);assert.match(opener,/data-gi-action="open" data-gi-open="5"/);assert.match(opener,/aria-label="Open grade impact" aria-describedby="gi-mod-course"/);
  assert.match(G.renderModule(home(),helpers,loader),/<span class="gi-mod-course" id="gi-mod-course">Chem<\/span>/);
 });
 loader.destroy();
});
test('a what-if made in the module carries into the room and back; what-ifs stack and clear with one button',async()=>{
 const {loader,navigations}=await live();loader.control.measure('room',1440,900);const m=model(two()),one=v=>(Math.round(v*10)/10).toFixed(1);
 placed(()=>{
  const h=home();loader.ensure(h);assert.equal(loader.control.preview('5','2',.7),m.project([['2',.7]]));assert.equal(loader.whatIfs('5').size,0,'a preview is not a what-if');
  assert.equal(loader.control.setWhatIf('5','2',.7),true);let mod=G.renderModule(h,helpers,loader);assert.ok(mod.includes('With this score: 35/50 (70%) → <b class="gi-ans-n">82.5</b> · still a B'),mod.match(/gi-ans-t">[^<]*/)?.[0]);assert.match(mod,/class="gi-ghost" data-gi-on="1"/);
  assert.equal(loader.control.open('5',{left:10,top:20,width:300,height:200},'module'),true);assert.deepEqual(navigations.at(-1),{to:'room',courseId:'5'});
  const r=roomOf();loader.ensure(r);let room=G.render(r,helpers,loader);
  assert.match(room,/data-gi-weight="2" data-gi-pts="50" data-gi-live="1" data-gi-k="1" data-gi-f="0.7" data-gi-dial="1"/);assert.match(room,/data-gi-slip="gi-slip-5"/);assert.match(room,/1 what-if/);assert.ok(room.includes(`85.0 → ${one(m.project([['2',.7]]))}`));
  loader.control.setWhatIf('5','4',1);room=G.render(r,helpers,loader);assert.match(room,/2 what-ifs/);assert.match(room,/data-gi-weight="4" data-gi-pts="10" data-gi-live="1" data-gi-k="1" data-gi-f="1"/);
  assert.ok(room.includes(`85.0 → ${one(m.project([['2',.7],['4',1]]))}`));
  assert.equal(loader.control.fold(),true);assert.deepEqual(navigations.at(-1),{to:'home',courseId:'all'});
  mod=G.renderModule(h,helpers,loader);assert.match(mod,/With these scores: 35\/50, 10\/10 → /
);assert.match(mod,/data-gi-action="clear" data-gi-course="5"[^>]*>[\s\S]*?Clear<\/span>/);
  loader.control.clear('5');mod=G.renderModule(h,helpers,loader);assert.doesNotMatch(mod,/With th|data-gi-action="clear"/);assert.match(mod,/class="gi-ghost" data-gi-on="0"/);assert.match(mod,/To keep your B: /);
  assert.equal(loader.control.setWhatIf('5','99',.5),false,'only coming work takes a what-if');assert.equal(loader.control.setWhatIf('5','2',1.5),false);
 });
 loader.destroy();
});
test('opening puts focus on the room\'s Fold control; folding returns it to the control that opened the room',async()=>{
 const {loader,navigations}=await live();
 placed(()=>{
  const h=home();loader.ensure(h);loader.control.open('5',null,'module');assert.equal(loader.control.takeFocus(),'.gi-room [data-gi-action="fold"]');
  assert.match(G.render(roomOf(),helpers,loader),/<section class="gi gi-room"[\s\S]*data-gi-action="fold"/);assert.equal(loader.control.takeFocus(),'','focus is handed over once');
  loader.control.fold();assert.equal(loader.control.takeFocus(),'[data-gi-open="5"]');assert.match(G.moduleOpener(h,helpers,loader),/data-gi-open="5"/);
  // From the Grades list the room folds back to the list, onto that course's strip.
  loader.control.open('5',null,'strip');loader.control.takeFocus();loader.control.fold();assert.deepEqual(navigations.at(-1),{to:'grades',courseId:'all'});assert.equal(loader.control.takeFocus(),'[data-gi-open="5"]');
  const list=context(true,{items:homeItems});loader.ensure(list);assert.match(G.render(list,helpers,loader),/data-gi-open="5"/);
  // A course's row in the Grades table opens the room too; it folds back to Grades, into that row, and the Home module
  // keeps the course it showed.
  const shown=loader.moduleCourse(h)?.id;loader.control.open('9',{left:0,top:300,width:900,height:40},'row');assert.deepEqual(navigations.at(-1),{to:'room',courseId:'9'});
  assert.deepEqual(loader.control.foldTarget(),{left:0,top:300,width:900,height:40},'the room folds into the row it grew from');
  loader.control.fold();assert.deepEqual(navigations.at(-1),{to:'grades',courseId:'all'});assert.equal(loader.control.takeFocus(),'[data-gi-open="9"]');assert.equal(loader.moduleCourse(h)?.id,shown);
 });
 const blocked=G.create({user,client:{loadGradeImpact:async()=>two()}});assert.equal(blocked.control.open('5',null,'module'),false,'no navigation, no room');assert.equal(blocked.control.takeFocus(),'');blocked.destroy();
 loader.destroy();
});
// A small stand-in DOM: every query answers with an element whose animate() is counted.
function fakeDom({reduce=false}={}){
 const animations=[],listeners={},rd={dataset:{}};
 const make=sel=>({sel,dataset:{},style:{},isConnected:true,classList:{contains:()=>false},textContent:'',animate(frames,options){const a={frames,options,finished:Promise.resolve(),cancel(){}};animations.push(a);return a;},
  querySelector:s=>make(s),querySelectorAll:s=>[make(s)],closest:s=>s==='.rd'?rd:make(s),getBoundingClientRect:()=>({left:0,top:0,width:900,height:700}),getAttribute:()=>null,setAttribute(){},removeAttribute(){},hasAttribute:()=>false,toggleAttribute(){},focus(){},contains:()=>true,dispatchEvent(){}});
 const win={matchMedia:()=>({matches:reduce}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},performance:{now:()=>0},innerHeight:900};
 // (the room's Escape is heard on the document, so a key aimed at the page body after a click on the wall still folds it)
 const doc={defaultView:win,visibilityState:'visible',body:{},addEventListener:(type,fn)=>{if(type==='keydown')listeners.keydown=fn;},removeEventListener(){}};
 const container={...make('container'),ownerDocument:doc,addEventListener:(type,fn)=>{listeners[type]=fn;},removeEventListener(){}};
 return {container,animations,listeners,rd};
}
test('reduced motion and Motion off: every state lands at once and the stage starts no animation; with motion the room arrives',async()=>{
 for(const [setup,expect]of [[{reduce:true},0],[{motion:'off'},0],[{feature:'off'},0],[{},1]]){
  const dom=fakeDom({reduce:!!setup.reduce});if(setup.motion)dom.rd.dataset.motionStyle=setup.motion;if(setup.feature)dom.rd.dataset.featureMotion=setup.feature;
  const navigations=[];const loader=G.create({user,container:dom.container,client:{loadGradeImpact:async()=>two()},navigate:r=>{navigations.push(r);return true;}});
  loader.control.open('5',{left:0,top:0,width:300,height:200},'module');loader.ensure(roomOf());await tick();
  if(expect)assert.ok(dom.animations.length>10,'the room washes in, the weights drop, the poise slides');else assert.equal(dom.animations.length,0);
  // Esc folds the room (its leaving motion is skipped when motion is off) and the way back still happens.
  dom.listeners.keydown({key:'Escape',target:{closest:()=>null},defaultPrevented:false,preventDefault(){},stopPropagation(){}});await tick();await tick();
  // (with motion the room starts folding at once and Home is drawn under it after the fold's first frame, or after a
  // short timer when no frame comes, as here)
  if(expect)await new Promise(r=>setTimeout(r,120));
  assert.deepEqual(navigations.at(-1),{to:'home',courseId:'all'});
  loader.destroy();
 }
 const css=fs.readFileSync(path.join(__dirname,'../extension/grade-impact.css'),'utf8');
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{\.rd \.gi \.gi-loop\{animation:none!important\}/);assert.match(css,/\[data-motion-style=off\],\[data-feature-motion=off\],\[data-living-art=off\]\) \.gi \.gi-loop\{animation:none!important\}/,'Motion off, the feature motion off and Living drawings off stop every loop');
 assert.match(css,/\.gi\[data-gi-paused\] \.gi-loop/,'everything that never stops pauses when the room is hidden or off screen');
});
test('grades hidden: the room and the module show names and days only, request nothing, and draw no number at all',async()=>{
 let calls=0;const loader=G.create({user,client:{loadGradeImpact:async()=>{calls++;return two();}},navigate:()=>true});const quiet={...helpers,formatDate:()=>'Fri'};
 const r=roomOf(false);loader.ensure(r);await tick();assert.equal(calls,0);loader.control.measure('room',1440,900);
 const html=G.render(r,quiet,loader);assert.match(html,/data-gi-hidden="1"/);assert.match(html,/Grades are hidden/);assert.match(html,/data-rd-action="grades-visibility"[^>]*>[\s\S]*Show grades/);assert.match(html,/gi-poise-rest/);
 assert.doesNotMatch(html,/role="slider"|data-gi-band|class="gi-ts gi-fig"|gi-ghost|moves|gives|need|%/);
 const words=visibleText(html.replace(/Unit &lt;3&gt; test/g,'Unit test'));assert.doesNotMatch(words,/\d/,words.match(/.{0,40}\d.{0,40}/)?.[0]);
 placed(()=>{const h=home(false,{s:{showGrades:false,timeZone:'America/New_York',moduleSize:{impact:'m'}}});loader.ensure(h);const mod=G.renderModule(h,quiet,loader);assert.equal(calls,0);
  assert.match(mod,/Show grades/);assert.doesNotMatch(visibleText(mod.replace(/Unit &lt;3&gt; test/g,'Unit test')),/\d/);assert.doesNotMatch(mod,/data-gi-band|role="slider"|gi-ghost|class="gi-ans"|data-gi-action="add"|gi-addrow/);});
 assert.equal(G.render(context(false,{items:homeItems}),helpers,loader),'','the Grades list keeps no strips while hidden');assert.equal(G.door(context(false),{id:'2',courseId:'5'},helpers,loader),'');
 loader.destroy();
});
test('tapping a band shows what the heaviest coming item needs, any score, or out of reach with the best possible',async()=>{
 const {loader}=await live();loader.control.measure('room',1440,900);const r=roomOf();
 loader.control.setNeed('5',80);let html=G.render(r,helpers,loader);assert.match(html,/data-gi-band="80" role="button" tabindex="0" aria-pressed="true"/);assert.match(html,/need 30\/50/);assert.match(html,/For 80\+ you need/);assert.match(html,/For 80 and up you need 30\/50\s\(60%\) on Unit &lt;3&gt; test/);assert.match(html,/class="gi-thread/);
 loader.control.setNeed('5',60);html=G.render(r,helpers,loader);assert.match(html,/any score/);
 loader.control.setNeed('5',60);html=G.render(r,helpers,loader);assert.doesNotMatch(html,/aria-pressed="true"/,'tapping the chosen band again lets it go');
 loader.control.setNeed('5',75);assert.equal(loader.need('5'),null,'only real bands');
 loader.destroy();
 const low=envelope([group('1',50,[graded('1',20,50),coming('2',50,day(3),{name:'Unit <3> test'})]),group('2',50,[graded('3',9,10)])],true,65);
 const c=roomOf(true,{courses:[{...course,score:65}]});const out=await live(low,{context:{courses:[{...course,score:65}]}});out.loader.control.measure('room',1440,900);out.loader.ensure(c);await tick();
 out.loader.control.setNeed('5',90);html=G.render(c,helpers,out.loader);assert.match(html,/best 80\.0/);assert.match(html,/90\+ is out of reach/);assert.match(html,/90 and up is out of reach\. The best possible is 80\.0/);
 out.loader.destroy();
});
// Labels, figures, the chosen band's outline, the need thread, the weights (with their shadows), tags, the slip, the
// note on the bench's front, the ledge and the props: no two of them may share a pixel, at any size the room takes.
const overlap=(a,b)=>a.x0<b.x1-.5&&b.x0<a.x1-.5&&a.y0<b.y1-.5&&b.y0<a.y1-.5;
function clearOf(boxes,label){for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(a.key&&a.key===b.key||a.kind==='prop'&&b.kind==='prop'||[a.kind,b.kind].sort().join()==='body,edge')continue;assert.ok(!overlap(a,b),`${label}: ${a.kind} ${a.key||''} overlaps ${b.kind} ${b.key||''}`);}}
const oRow=(i,wd)=>({key:'k'+i,name:'Item '+i,meta:'Fri',url:'#',linkLabel:'x',wd,stamp:'10',line:'moves 2.0',f:i===0?.5:null,dialTo:'80.0',aria:'x',valueText:'x'});
const oView=(current,ghostAt,low)=>({kind:'room',course:{id:'5'},hidden:false,state:'ready',bands:G.BANDS,lo:60,hi:100,current,currentText:current.toFixed(1),letter:'B',ghost:ghostAt==null?null:{value:ghostAt,label:ghostAt.toFixed(1)},title:'Chem',grade:'B · 85.0%',roomLabel:'Chem',gradebook:'#',gradebookLabel:'x',ledgerText:'As Canvas reports it',hour:16,
 whatIf:ghostAt==null?null:{count:1,title:'1 what-if',change:`${current.toFixed(1)} → ${ghostAt.toFixed(1)}`,clearLabel:'Clear what-ifs'},need:low==null?null:{low,title:`For ${low}+ you need`,text:'97% on Item 0',say:'x'}});
// current, ghost, chosen band: the plain case, a label that has to flip left, one that has to go up beside the ghost's
// figure, and the chosen band right under the poise.
const oCases=[[85,82,90],[88.8,86,90],[89.4,91.5,90],[86.5,null,80],[71,64,70]];
test('nothing overlaps: every weight keeps its lane; the "+N more" tag, the bench slip, the note, the resting poise, the bench props, the thread, the labels and the figures stay clear, at any size',()=>{
 for(const W of [640,800,1024,1170,1280,1440,1920])for(const H of [780,800,860,1000])for(const n of [1,3,6])for(const hidden of [false,true])for(const [current,g,low]of hidden?[[85,82,90]]:oCases){
  const rows=Array.from({length:n},(_,i)=>oRow(i,30+12*Math.sqrt([25,16,9,4,2,1][i])*(i?1:2.4)));
  const view=oView(current,g,low);if(g==null)rows[0].f=null;
  const {boxes,L}=Art.room({...view,hidden,state:hidden?'hidden':'ready',rows,W,H,maxWd:200});
  for(const b of boxes)assert.ok(b.x0>=0&&b.x1<=L.W&&b.y1<=L.H,`${W}x${H} ${b.kind} inside the room`);
  clearOf(boxes,`${W}x${H} n=${n}${hidden?' hidden':` ${current}/${g}/${low}`}`);
  if(!hidden&&low!=null&&n>0)assert.ok(boxes.some(b=>b.kind==='thread'),'the need thread is planned');
  // what you need is always somewhere a student can see it: on the slip or on the note on the bench's front
  if(!hidden&&low!=null)assert.ok(boxes.some(b=>b.kind==='slip'||b.kind==='note'),'what you need has a place');
 }
});
test('the Grades list keeps its strips: letters sit in their bands\' corners, clear of the poise, the ghost and the figures, and the labels never touch the chosen band\'s outline',()=>{
 for(const W of [300,360,420,520,640,760])for(const size of ['m','l'])for(const [current,g,low]of oCases){
  const view=oView(current,g,low),out=[];const svg=Art.strip({...view,kind:'strip',size,W,rows:[oRow(0,70),oRow(1,50),oRow(2,40)],maxWd:70,box:{title:'For 90+ you need',text:'97% on Item 0'}},out);
  clearOf(out,`strip ${size} ${W} ${current}/${g}/${low}`);assert.ok(out.some(b=>b.kind==='plabel'));
  // a letter is drawn exactly when its box is planned, and it stays inside its band, 2 px clear of the bar
  assert.equal((svg.match(/gi-band-letter/g)||[]).length,out.filter(b=>b.kind==='letter').length);
  assert.match(svg,/data-gi-band="90"/);
 }
});
// The answer-first module's ruler and rows: the figures, the band tabs, the pins and their numbers, each row's name,
// category tag, ×, day and points and slider; nothing touches anything else and nothing leaves the module, at any width
// (one-line rows from 500 px), with the pins anywhere (both near an edge included) and pretend rows among the others.
const mRow=(i,extra={})=>({key:'k'+i,name:n=>'Assignment number '+i,url:'#',linkLabel:'x',day:'Tue',pts:'100 pts',cat:'Participation and homework · 15%',catName:'Participation and homework',f:i===1?.72:null,rest:i===0?.85:.5,restLabel:i===0?'85%':'',named:i===0,pretend:i===2,removeLabel:'Remove',aria:'x',valueText:'x',...extra});
test('the module\'s ruler and rows: nothing overlaps and nothing is cut off, at every width, with the pins anywhere',()=>{
 const pinCases=[...oCases,[99.4,98.1,null],[60.6,61.2,null],[99.8,null,90],[62,100,null],[100,60.2,80]];
 for(const W of [220,260,300,316,360,420,437,500,538,640,760,980])for(const [current,g,low]of pinCases)for(const n of [0,2,6]){
  const view=oView(current,g,low),out=[],rows=Array.from({length:n},(_,i)=>mRow(i));
  const svg=Art.module({...view,kind:'module',size:'m',W,rows},out);
  const pairs=out.filter(b=>b.kind!=='pin');clearOf(pairs,`module ${W} ${current}/${g}/${low} n=${n}`);
  for(const b of out)assert.ok(b.x0>=0&&b.x1<=W,`${W} ${current}/${g}: ${b.kind} ${b.key} inside (${Math.round(b.x0)}..${Math.round(b.x1)})`);
  for(const pin of out.filter(b=>b.kind==='pin'))for(const lab of out.filter(b=>/label$/.test(b.kind)))assert.ok(!overlap(pin,lab)||(pin.key==='pnow')===(lab.kind==='plabel'),`${W} ${current}/${g}: a number over the other pin`);
  assert.equal((svg.match(/role="slider"/g)||[]).length,n);assert.equal((svg.match(/class="gi-x"/g)||[]).length,n>2?1:0,'one pretend row, one ×');
  assert.ok(new Set([...svg.matchAll(/data-gi-a="([\d.]+)" data-gi-b="([\d.]+)"/g)].map(m=>m[1]+','+m[2])).size<=1,`${W}: every track on one 0-100 scale`);
  assert.match(svg,/data-gi-band="90" role="button" tabindex="0" aria-pressed="(true|false)"/);
 }
});
// The words a student can actually see in a drawing: text outside the tag faces that a dial covers, outside sr-only.
function seen(html){
 const parts=html.split('<g class="gi-wt').map((part,i)=>i&&/^[^>]*data-gi-dial="1"/.test(part)?part.replace(/<g class="gi-face">[\s\S]*?<\/g>/,''):part).join('<g class="gi-wt');
 return [...parts.replace(/<p class="rd-sr-only"[\s\S]*?<\/p>/g,'').matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m=>m[1].replace(/<[^>]+>/g,'')).join(' | ');
}
// The review's chemistry course: five coming items, the Unit 3 Test the heaviest.
const chemGroups=[group('1',50,[graded('11',85,100),graded('12',78,100),coming('21',100,day(3),{name:'Unit 3 Test'})]),group('2',30,[graded('13',36,40),graded('14',38,40),coming('22',40,day(7),{name:'Lab report'}),coming('25',40,day(16),{name:'Titration lab'})]),group('3',20,[graded('15',18,20),graded('16',19,20),graded('17',20,20),coming('23',20,day(9),{name:'Equilibrium set'}),coming('24',10,day(13),{name:'Reading quiz'})])];
const chemData=()=>envelope(chemGroups,true,87.5),chemCourse={...course,score:87.5,grade:'B+'};
const chemItems=[['21','Unit 3 Test',100,3],['22','Lab report',40,7],['25','Titration lab',40,16],['23','Equilibrium set',20,9],['24','Reading quiz',10,13]].map(([id,name,points,d])=>({id,courseId:'5',name,points,dueAt:day(d),state:'unsubmitted'}));
test('what you need stays on screen when the heaviest weight carries a what-if: the room at 1170 x 780, and the module box',async()=>{
 const extra={courses:[chemCourse],items:chemItems};const {loader}=await live(chemData(),{context:extra});const r=roomOf(true,extra);loader.ensure(r);await tick();
 loader.control.setWhatIf('5','21',.72);loader.control.setNeed('5',90);loader.control.measure('room',1170,780);
 const m=model(chemData()),list=G.rows(m,{now:NOW}),need=G.needFor(m,list,new Map([['21',.72]]),90),pct=`${Math.round(need.f*list[0].points*100)/100}/${list[0].points}`;assert.equal(need.reach,true);
 const html=G.render(r,helpers,loader),words=seen(html);
 assert.match(html,/data-gi-weight="21"[^>]*data-gi-dial="1"/,'the heaviest weight shows its dial');
 assert.ok(words.includes('For 90+ you need'),words);const pts=pct.replace(/ \(.*/,'');assert.ok(words.includes(`${pct} on Unit 3`)||words.includes(`${pts} on Unit 3`),`${pts} is visible: ${words}`);
 assert.match(html,/class="gi-thread gi-kc"/);
 placed(()=>{const h=home(true,{...extra,s:{showGrades:true,timeZone:'America/New_York',moduleSize:{impact:'m'}}});loader.ensure(h);let mod=G.renderModule(h,helpers,loader);
  // the module's answer is the result once a score is set; with the score let go it is what the chosen band needs
  const ans=html=>html.match(/<span class="gi-ans-t">([\s\S]*?)<\/span><\/p>/)?.[1].replace(/<[^>]+>/g,'').replace(/ /g,' ')||'';
  assert.match(ans(mod),/^With this score: 72\/100 → [\d.]+ · /,'out of 100, the points say the per cent already');
  loader.control.removeWhatIf('5','21');const need0=G.needFor(m,list,new Map(),90);mod=G.renderModule(h,helpers,loader);
  assert.equal(ans(mod),need0.reach?`To reach an A: ${Math.round(need0.f*list[0].points*100)/100}/${list[0].points} on Unit 3 Test · ${day(3).slice(5,10)}`:`A is out of reach · best ${need0.best.toFixed(1)}`);
  assert.match(mod,/class="gi-row gi-row-named" data-rd-key="gi-row-21"/,'the row the answer names is marked');
  const l={...h,s:{...h.s,moduleSize:{impact:'l'}}};loader.ensure(l);assert.equal(ans(G.renderModule(l,helpers,loader)),ans(mod),'the same answer at every size');});
 loader.destroy();
});
test('a course Canvas cannot be weighed for keeps the Grades page: its grade, its period and its scored work',async()=>{
 const items=[...homeItems,{id:'3',courseId:'5',name:'Lab one',score:9,points:10,state:'graded',gradedAt:day(-2)}];
 for(const change of [{gradingPeriodId:'7'},{hideFinalGrades:true},{score:null}]){
  const c=roomOf(true,{courses:[{...course,...change}],items});const loader=G.create({user,client:{loadGradeImpact:async()=>two()},navigate:()=>true});loader.ensure(c);await tick();
  assert.equal(G.render(c,helpers,loader),'',JSON.stringify(change));
  const page=Grades.render({...c,gradeImpact:loader},{...helpers,number:v=>String(v)});assert.match(page,/Course grades/);assert.match(page,/Scored work/);assert.doesNotMatch(page,/gi-room/);loader.destroy();
 }
 const failing=G.create({user,client:{loadGradeImpact:async()=>{throw Error('Canvas refused (403).');}},navigate:()=>true}),c=roomOf();failing.ensure(c);assert.match(G.render(c,helpers,failing),/class="gi gi-room"/,'loading is still the room');await tick();assert.equal(G.render(c,helpers,failing),'','a failed read falls back too');failing.destroy();
 const {loader}=await live();assert.match(G.render(roomOf(),helpers,loader),/class="gi gi-room"/);assert.match(G.render(roomOf(false),helpers,loader),/class="gi gi-room"[^>]*data-gi-hidden="1"/,'hidden grades keep the room');loader.destroy();
});
test('the room hands focus over itself: navigation renders without restoring the opener\'s old focus',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../extension/dashboard.js'),'utf8'),fn=source.slice(source.indexOf('function gradeImpactNavigate'),source.indexOf('function bookmarkItem'));
 assert.match(fn,/render\(\{[^}]*preserveFocus:false[^}]*\}\)/);
});
test('the light follows the clock: one timer while the room is shown, none once it is gone; the sun is moved, never redrawn',async()=>{
 const dom=fakeDom(),timers=[];Object.assign(dom.container.ownerDocument.defaultView,{setTimeout:(fn,ms)=>{timers.push({fn,ms,live:true});return timers.length;},clearTimeout:i=>{if(timers[i-1])timers[i-1].live=false;}});
 const loader=G.create({user,container:dom.container,client:{loadGradeImpact:async()=>two()},navigate:()=>true});loader.ensure(roomOf());await tick();
 assert.equal(timers.filter(t=>t.live).length,1,'one timeout');assert.ok(timers[0].ms>0&&timers[0].ms<=18e5+1000);
 loader.ensure(roomOf());assert.equal(timers.filter(t=>t.live).length,1,'never a second');loader.destroy();assert.equal(timers.filter(t=>t.live).length,0,'cleared when the room is destroyed');
 const {loader:l2}=await live();l2.control.measure('room',1170,780);const day16=G.render(roomOf(),helpers,l2),day17=G.render(roomOf(true,{now:NOW+3600e3}),helpers,l2);
 const far=html=>html.match(/<g class="gi-env gi-l-far"[\s\S]*?<g class="gi-env gi-l-shaft"/)[0];assert.equal(far(day16),far(day17),'the far layer is the same at every hour');
 assert.notEqual(day16.match(/--gi-sx:[\d.]+px/)[0],day17.match(/--gi-sx:[\d.]+px/)[0],'the sun stands somewhere else');l2.destroy();
 const css=fs.readFileSync(path.join(__dirname,'../extension/grade-impact.css'),'utf8');
 assert.match(css,/\.rd:not\(\[data-theme=dark\]\) \.gi-svg\[data-gi-night="1"\] \.gi-dusk\{display:inline\}/);assert.match(css,/\.gi-sun-g\{transform:translate\(var\(--gi-sx/);assert.doesNotMatch(css,/pool2|sunhalo|moonhalo/);
});
test('the drawings are the same on every render, take their colours from classes, and use no gradients, filters or glows',async()=>{
 const {loader}=await live();loader.control.measure('room',1280,860);const a=G.render(roomOf(),helpers,loader),b=G.render(roomOf(),helpers,loader);assert.equal(a,b,'no line boil: the same pen draws the same line');
 assert.doesNotMatch(a,/Gradient|<filter|filter=|drop-shadow|fill="#|stroke="#/);
 const css=fs.readFileSync(path.join(__dirname,'../extension/grade-impact.css'),'utf8');assert.doesNotMatch(css,/gradient\(|box-shadow|drop-shadow|filter:(?!none)/);
 for(const theme of ['data-theme=dark','data-theme-kit=sea','data-theme-kit=starry','data-theme-kit=stars','data-theme-kit=blueprint','.rd[data-theme-kit] .gi{'])assert.ok(css.includes(theme),theme);
 loader.destroy();
});

test('one name, one function in the room\'s motion: the sheet that grows over Home is lifted off the drawn room, and its CSS fixes it over the page',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../extension/grade-impact-art.js'),'utf8'),body=src.slice(src.indexOf(' function stage({container,api}){'));
 const names=[...body.matchAll(/\n  (?:async )?function ([A-Za-z0-9_]+)\(/g)].map(m=>m[1]),dup=names.filter((n,i)=>names.indexOf(n)!==i);
 assert.deepEqual(dup,[],'a second declaration silently replaces the first (the sheet lift was replaced by the weight lift)');
 assert.match(body,/sheet=liftSheet\(roomEl\)/,'the room\'s arrival lifts the sheet');
 const css=fs.readFileSync(path.join(__dirname,'../extension/grade-impact.css'),'utf8');
 assert.match(css,/\.rd \.gi-flylayer\{position:fixed;inset:0;[^}]*pointer-events:none/);assert.match(css,/\.gi-flysheet\{position:fixed;transform-origin:0 0;background:var\(--gi-wall\)/,'the sheet is the wall\'s wash, never a white box');
});

test('round 3: Escape folds the room from the page body (heard on the document), never while the Focus room is open over it',async()=>{
 const dom=fakeDom();const navigations=[];const loader=G.create({user,container:dom.container,client:{loadGradeImpact:async()=>two()},navigate:r=>{navigations.push(r);return true;}});
 loader.control.open('5',{left:0,top:0,width:300,height:200},'module');loader.ensure(roomOf());await tick();assert.equal(typeof dom.listeners.keydown,'function');
 dom.rd.dataset.chRoom='open';const before=navigations.length;
 dom.listeners.keydown({key:'Escape',target:{},composedPath:()=>[{}],defaultPrevented:false,preventDefault(){},stopPropagation(){}});await tick();await tick();await new Promise(r=>setTimeout(r,200));
 assert.equal(navigations.length,before,'the Focus room owns Escape while it is open');
});
