/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Adapted from Gary Wu's pull request #46 to Canvas Harness.
(function(root){
 'use strict';
 const DAYS=21,MAX_ROWS=6;
 const Site=root.ReserveSite||(typeof module==='object'&&module.exports&&typeof require==='function'?require('./site.js'):null);
 const validOrigin=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value&&!u.username&&!u.password&&Site?.supported(value);}catch{return false;}};
 const REASONS={
   hidden:'Hidden by Canvas',
   period:'Grading periods unsupported',
   baseline:'Canvas grade unavailable',
   metadata:'Canvas grading settings unavailable',
   data:'Incomplete grading data',
   rules:'Assignment group rules unsupported',
   extra:'Extra credit unsupported',
   submission:'Submission grading unsupported',
   mismatch:'Canvas grade does not match'
 };
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const id=value=>typeof value==='string'&&/^\d+$/.test(value)||typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?String(value):null;
 function number(value){
   if(typeof value==='number')return Number.isFinite(value)?value:null;
   if(typeof value!=='string'||!value.trim()||!/^\d+(?:\.\d+)?$/.test(value.trim()))return null;
   const n=Number(value);
   return Number.isFinite(n)?n:null;
 }
 function period(course){
   return course.multiple_grading_periods_enabled===true||
     course.grading_periods_enabled===true||
     course.has_grading_periods===true||
     course.grading_periods_weighted===true||
     course.current_grading_period_id!=null||
     course.grading_period_set_id!=null||
     course.gradingPeriodId!=null||
     course.scoreScope==='current-period'||
     Array.isArray(course.grading_periods)&&course.grading_periods.length>0||
     (Array.isArray(course.enrollments)?course.enrollments:[]).some(row=>
       row?.current_grading_period_id!=null||row?.grading_period_id!=null||row?.multiple_grading_periods_enabled===true);
 }
 function snapshotReason(course){
   if(course.hideFinalGrades===true||course.hide_final_grades===true||course.scoreScope==='hidden'||course.restrict_quantitative_data===true)return 'hidden';
   if(period(course))return 'period';
   if(course.scoreScope!=='overall')return 'metadata';
   const score=number(course.score);
   return score===null||score<0||score>100?'baseline':null;
 }
 function empty(reason){return {supported:false,reason,current:null,upcoming:[],impact:()=>null};}
 function trusted(m,score){
   const baseline=number(score);
   return m?.supported===true&&Number.isFinite(m.current)&&baseline!==null&&baseline>=0&&baseline<=100&&Math.abs(m.current-baseline)<=.0100001;
 }
 function model(data,{showGrades=false,origin=Site?.origin()}={}){
  if(showGrades!==true)return empty('hidden');
  const course=data?.course,accountId=id(data?.accountId),courseId=id(data?.courseId);
  if(!record(course)||(!validOrigin(data.origin)||data.origin!==origin)||!accountId||!courseId||id(course.id)!==courseId)return empty('metadata');
  if(course.hide_final_grades===true||course.hideFinalGrades===true||course.scoreScope==='hidden'||course.restrict_quantitative_data===true)return empty('hidden');
  if(!Array.isArray(course.enrollments))return empty('metadata');
  if(period(course))return empty('period');
  if(course.hide_final_grades!==false||course.multiple_grading_periods_enabled!==false||typeof course.apply_assignment_group_weights!=='boolean')return empty('metadata');
  const enrollments=course.enrollments.filter(row=>record(row)&&['StudentEnrollment','student'].includes(row.type)&&(row.user_id==null||id(row.user_id)===accountId));
  if(enrollments.length!==1)return empty('baseline');
  const enrollment=enrollments[0],baseline=number(enrollment.computed_current_score);
  if(baseline===null||baseline<0||baseline>100)return empty('baseline');
  if(enrollment.override_score!=null||enrollment.override_grade!=null)return empty('metadata');
  if(!Array.isArray(data.groups)||!Array.isArray(data.assignments))return empty('data');
  const weighted=course.apply_assignment_group_weights,groups=[],byGroup=new Map(),seen=new Set(),upcoming=[];
  for(const raw of data.groups){
   const groupId=id(raw?.id),weight=number(raw?.group_weight);
   if(!groupId||byGroup.has(groupId)||!record(raw.rules))return empty('data');
   for(const [key,value]of Object.entries(raw.rules))
     if(!['drop_lowest','drop_highest','never_drop'].includes(key)||(key==='never_drop'?(!Array.isArray(value)||value.length>0):number(value)!==0))return empty('rules');
   if(weighted&&(weight===null||weight<0||weight>100))return empty('metadata');
   const group={weight:weighted?weight:0,earned:0,possible:0};byGroup.set(groupId,groups.length);groups.push(group);
  }
  if(weighted&&Math.abs(groups.reduce((sum,group)=>sum+group.weight,0)-100)>.000001)return empty('metadata');
  for(const a of data.assignments){
   if(!record(a))return empty('data');
   const assignmentId=id(a.id),groupId=id(a.assignment_group_id),index=byGroup.get(groupId);
   if(!assignmentId||seen.has(assignmentId)||a.course_id!=null&&id(a.course_id)!==courseId||index===undefined)return empty('data');
   seen.add(assignmentId);
   if(a.published===false||a.workflow_state==='deleted'||a.omit_from_final_grade===true||a.grading_type==='not_graded')continue;
   if(a.grading_period_id!=null||a.in_closed_grading_period===true)return empty('period');
   const group=groups[index];if(weighted&&group.weight===0)continue;
   const s=a.submission,points=number(a.points_possible);
   if(!record(s)||points===null||points<0||s.user_id!=null&&id(s.user_id)!==accountId||s.assignment_id!=null&&id(s.assignment_id)!==assignmentId)return empty('data');
   if(s.excused===true)continue;
   if(!['points','percent'].includes(a.grading_type)||a.anonymous_grading===true||a.moderated_grading===true||s.hidden===true||s.grade_matches_current_submission===false)
     return empty('submission');
   const score=number(s.score);
   if(s.score!=null||s.workflow_state==='graded'){
    if(score===null||score<0||s.workflow_state!=='graded'||s.posted_at===null)return empty('submission');
    if(score>points)return empty('extra');
    group.earned+=score;group.possible+=points;continue;
   }
   if(!['unsubmitted','submitted','pending_review'].includes(s.workflow_state))return empty('submission');
   if(points===0||s.submitted_at||s.workflow_state!=='unsubmitted')continue;
   const due=own(s,'cached_due_date')?s.cached_due_date:a.due_at;
   upcoming.push({
     id:assignmentId,
     name:typeof a.name==='string'?a.name.slice(0,300):'Assignment',
     due:typeof due==='string'?due:'',
     points,
     group:index,
     url:`${data.origin}/courses/${courseId}/assignments/${assignmentId}`
   });
  }
  function grade(over){
    let num=0,den=0;
    for(let i=0;i<groups.length;i++){
      const group=groups[i],earned=group.earned+(over?.group===i?over.earned:0),possible=group.possible+(over?.group===i?over.possible:0);
      if(possible<=0)continue;
      if(weighted){if(group.weight<=0)continue;num+=group.weight*earned/possible;den+=group.weight;}else{num+=earned;den+=possible;}
    }
    return den>0&&Number.isFinite(num)&&Number.isFinite(den)?100*num/den:null;
  }
  const current=grade(),m={supported:true,reason:null,accountId,courseId,current,upcoming,impact};
  if(current===null)return empty('baseline');
  if(!trusted(m,baseline))return empty('mismatch');
  function impact(u){
   if(!upcoming.includes(u))return null;
   const at=f=>typeof f==='number'&&Number.isFinite(f)&&f>=0&&f<=1?grade({group:u.group,earned:u.points*f,possible:u.points}):null;
   const lo=at(0),hi=at(1);return lo===null||hi===null||!Number.isFinite(hi-lo)?null:{swing:hi-lo,at};
  }
  return m;
 }
 function rows(m,{now=Date.now(),days=DAYS}={}){
   if(!m?.supported||!Number.isFinite(now)||!Number.isFinite(days)||days<0||days>DAYS)return [];
   const end=now+days*864e5;
   return m.upcoming.filter(u=>{
     const due=Date.parse(u.due);
     return Number.isFinite(due)&&due>=now-864e5&&due<=end;
   }).map(u=>({...u,imp:m.impact(u)})).filter(u=>u.imp&&u.imp.swing>=.05).sort((a,b)=>
     b.imp.swing-a.imp.swing||Date.parse(a.due)-Date.parse(b.due)||a.id.localeCompare(b.id));
 }
 function active(c){
   return c?.workspace==='grades'&&
     c.s?.showGrades===true&&
     !!id(c.user?.id)&&
     c.gradeImpactEnabled!==false&&
     (!root.ReserveFeatures||root.ReserveFeatures.enabled('grade-impact'))&&
     !/^\/courses\/\d+\/quizzes(?:\/|$)/.test(root.location?.pathname||'');
 }
 function courses(c){
   return (Array.isArray(c.courses)?c.courses:[]).filter(course=>id(course?.id)&&(c.state?.courseId==='all'||String(course.id)===String(c.state?.courseId)));
 }
 function stamp(c,course){
   return JSON.stringify([
     c.gradeImpactRevision??null,
     c.user?.id,
     course.id,
     course.score,
     course.scoreScope,
     course.hideFinalGrades,
     course.hide_final_grades,
     course.gradingPeriodId,
     course.apply_assignment_group_weights,
     course.multiple_grading_periods_enabled,
     snapshotReason(course),
     (c.items||[]).filter(item=>String(item.courseId)===String(course.id)).map(item=>
       [
         item.id,
         item.score,
         item.grade,
         item.points,
         item.state,
         item.submittedAt,
         item.dueAt,
         item.updatedAt,
         item.gradedAt,
         item.gradeMatchesCurrentSubmission,
         item.missing,
         item.redoRequested
       ])
   ]);
 }
 function create({client,user,onChange=()=>{},onAuthError=()=>{}}={}){
  const owner=id(user?.id),origin=client?.origin||Site?.origin(),cache=new Map();let context=null,dead=false,running=0,authError='';
  function clear(){for(const entry of cache.values())entry.controller?.abort();cache.clear();}
  function current(entry){
    const course=context&&courses(context).find(course=>String(course.id)===entry.id);
    return !dead&&active(context)&&id(context.user.id)===owner&&course&&cache.get(entry.id)===entry&&entry.stamp===stamp(context,course)&&!snapshotReason(course);
  }
  function notify(){if(!dead)onChange();}
  async function load(entry){
   try{
    const data=await client.loadGradeImpact(entry.id,{user:{id:owner},signal:entry.controller.signal});
    if(!current(entry))return;
    if(id(data?.accountId)!==owner||id(data?.courseId)!==entry.id||data?.origin!==origin)throw Object.assign(Error('Your Canvas account changed. Reopen Canvas Harness.'),{code:'auth'});
    const result=model(data,{showGrades:true,origin});
    if(!current(entry))return;
    Object.assign(entry,{state:result.supported?'ready':'unavailable',model:result.supported?result:null,reason:result.reason});
   }catch(error){
    if(!current(entry))return;
    const message=String(error?.message||'Canvas could not load grade impact.').slice(0,300);
    if(error?.code==='auth'){authError=message;clear();onAuthError(error);}
    else Object.assign(entry,{state:'error',error:message});
   }finally{running--;if(!dead&&active(context)&&id(context.user.id)===owner){notify();pump();}}
  }
  function pump(){
    if(dead||authError||!active(context)||id(context.user.id)!==owner)return;
    for(const entry of cache.values()){if(running>=2)break;if(entry.state!=='queued'||!current(entry))continue;entry.state='loading';running++;void load(entry);}
  }
  function ensure(c){
   context=c;
   if(dead||!owner||!active(c)||id(c.user.id)!==owner){clear();return;}
   if(authError)return;
   const selected=courses(c),wanted=new Set(selected.map(course=>String(course.id)));
   for(const [key,entry]of cache)if(!wanted.has(key)){entry.controller?.abort();cache.delete(key);}
   for(const course of selected){
    const key=String(course.id),signature=stamp(c,course),reason=snapshotReason(course),hit=cache.get(key);
    if(hit&&hit.stamp===signature)continue;
    hit?.controller?.abort();
    const entry={id:key,stamp:signature,state:reason?'unavailable':'queued',reason,controller:new AbortController()};
    if(!reason&&typeof client?.loadGradeImpact!=='function')Object.assign(entry,{state:'error',error:'Canvas grade impact unavailable'});
    cache.set(key,entry);
   }
   pump();
  }
  function get(value,c=context){
   if(dead||!owner||!active(c)||id(c.user.id)!==owner)return null;
   if(authError)return {state:'error',error:authError};
   const course=courses(c).find(course=>String(course.id)===String(value)),entry=cache.get(String(value));
   if(!course||!entry||entry.stamp!==stamp(c,course))return null;
   return entry;
  }
  return {owner,ensure,get,invalidate(){clear();},destroy(){dead=true;context=null;clear();}};
 }
 function render(c,h,loader){
  if(!active(c)||typeof loader?.get!=='function'||loader.owner!==id(c.user.id))return '';
  const {E,formatDate}=h,all=[],statuses=[],now=Number.isFinite(c.now)?c.now:Date.now();
  for(const course of courses(c)){
   const blocked=snapshotReason(course),entry=loader.get(course.id,c);let message=blocked?REASONS[blocked]:'';
   if(!message){
    if(!entry||['queued','loading'].includes(entry.state))message='Loading grade impact…';
    else if(entry.state==='error')message=entry.error||'Canvas could not load grade impact.';
    else if(entry.state!=='ready')message=REASONS[entry.reason]||'Grade impact unavailable';
    else if(entry.model?.accountId!==id(c.user.id)||entry.model?.courseId!==String(course.id)||!trusted(entry.model,course.score))message=REASONS.mismatch;
    else for(const row of rows(entry.model,{now}))all.push({...row,course});
   }
   if(message)statuses.push(`<p class="rd-grade-note ch-impact-status" role="status">${E(course.shortName||course.name)} · ${E(message)}</p>`);
  }
  const pct=n=>`${n.toFixed(1)}%`;
  all.sort((a,b)=>b.imp.swing-a.imp.swing||Date.parse(a.due)-Date.parse(b.due)||a.id.localeCompare(b.id));
  const list=all.slice(0,MAX_ROWS).map(row=>`<a class="rd-scored-row ch-impact-row" href="${E(row.url)}"><span><strong>${E(row.name)}</strong><small>${E(row.course.shortName||row.course.name)} · ${E(formatDate(row.due,c.s.timeZone,{weekday:'short',month:'short',day:'numeric'}))} · ${E(row.points)} pts</small><small class="ch-impact-scores">100% → ${pct(row.imp.at(1))} · 85% → ${pct(row.imp.at(.85))} · 70% → ${pct(row.imp.at(.7))}</small></span><span class="rd-scored-value ch-impact-swing">0–100%<small>${E(row.imp.swing.toFixed(1))} percentage points</small></span></a>`).join('');
  return `<section class="rd-grade-sheet ch-impact" aria-labelledby="ch-grade-impact"><div class="rd-sheet-heading"><h2 id="ch-grade-impact">Coming up</h2><span>next ${DAYS} days</span></div><div class="rd-scored-list ch-impact-list">${list}</div>${statuses.join('')}${!list&&!statuses.length?'<p class="rd-grade-note ch-impact-status">No upcoming graded work</p>':''}</section>`;
 }
 const api={DAYS,REASONS,model,rows,trusted,create,render};root.ReserveGradeImpact=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
