// Adapted from Gary Wu's pull request #46 to Canvas Harness.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const G=require('../extension/grade-impact.js'),Grades=require('../extension/grades-view.js'),{createClient}=require('../extension/api.js');
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

test('ported section shows escaped upcoming work and 100/85/70 projections within existing frames',()=>{
 const html=G.render(context(),helpers,ready(base()));assert.match(html,/Coming up/);assert.match(html,/rd-grade-sheet ch-impact/);assert.match(html,/Unit &lt;3&gt; test/);assert.match(html,/25\.0 percentage points/);assert.match(html,/100% → 90\.0% · 85% → 86\.3% · 70% → 82\.5%/);assert.doesNotMatch(html,/javascript:|\/quizzes\/|style=|<svg|title=/);
 assert.match(html,/href="https:\/\/school\.instructure\.com\/courses\/5\/assignments\/2"/);
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
test('dashboard integrates the guarded Grade impact controller and discards hidden or stale output',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../extension/dashboard-view.js'),'utf8');assert.match(source,/ReserveGradeImpact\?\.render\(c,h,c\.gradeImpact\)/);
 const loader=ready(base()),c=context(true,{gradeImpact:loader});assert.match(G.render(c,helpers,loader),/id="ch-grade-impact"/);
 assert.doesNotMatch(G.render({...c,s:{...c.s,showGrades:false}},helpers,loader),/ch-impact|Unit &lt;3&gt; test|25\.0/);
 assert.equal(G.render(c,helpers,'<div>stale projection</div>'),'');
});

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
 const c=context();loader.ensure(c);calls[0].resolve(base());await tick();assert.match(G.render(c,helpers,loader),/100% → 90\.0%/);
 const next=context(true,{gradeImpactRevision:'snapshot-2',courses:[{...course,score:90}],items:[{id:'3',courseId:'5',score:10,state:'graded'}]});loader.ensure(next);assert.doesNotMatch(G.render(next,helpers,loader),/ch-impact-row/);
 const data=base();data.course.enrollments[0].computed_current_score=90;data.assignments[2].submission.score=10;calls[1].resolve(data);await tick();assert.match(G.render(next,helpers,loader),/100% → 95\.0%/);
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
 for(const endpoint of ['/api/v1/courses/5/assignment_groups/1','/api/v1/courses/no/assignment_groups','/courses/5/quizzes/1/take','/api/v1/courses/5/quizzes','/api/v1/courses/5/assignment_groups%2f1'])await assert.rejects(client.list(endpoint),error=>error.code==='endpoint');
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
