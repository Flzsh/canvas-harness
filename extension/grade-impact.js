/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Adapted from Gary Wu's pull request #46 to Canvas Harness.
// The model and its refusals are Gary's arithmetic, unchanged in meaning: every estimate must reproduce Canvas's own
// current score first, and anything Canvas does that this cannot copy (periods, drop rules, overrides, extra credit,
// hidden or unposted grades) refuses instead of guessing. What is new is the weighing room (a course opened on the
// Grades page) and its Home module; their drawings and motion live in grade-impact-art.js.
(function(root){
 'use strict';
 const ORIGIN=(globalThis.ReserveSite?.origin?.()||'https://school.instructure.com'),DAYS=21,MAX_ROWS=6;
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
 // The bar's letter bands. Canvas's own letter for the course is shown as Canvas reports it; these are only the scale.
 const BANDS=[{lo:90,hi:100,letter:'A'},{lo:80,hi:90,letter:'B'},{lo:70,hi:80,letter:'C'},{lo:60,hi:70,letter:'D'},{lo:0,hi:60,letter:'F'}];
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
 function empty(reason){return {supported:false,reason,current:null,upcoming:[],impact:()=>null,project:()=>null};}
 function trusted(m,score){
   const baseline=number(score);
   return m?.supported===true&&Number.isFinite(m.current)&&baseline!==null&&baseline>=0&&baseline<=100&&Math.abs(m.current-baseline)<=.0100001;
 }
 function model(data,{showGrades=false}={}){
  if(showGrades!==true)return empty('hidden');
  const course=data?.course,accountId=id(data?.accountId),courseId=id(data?.courseId);
  if(!record(course)||data.origin!==ORIGIN||!accountId||!courseId||id(course.id)!==courseId)return empty('metadata');
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
   // (the id and name are only carried for pretend assignments, which are filed under a category; the maths never reads them)
   const group={id:groupId,name:typeof raw.name==='string'?raw.name.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,60):'',weight:weighted?weight:0,earned:0,possible:0};
   byGroup.set(groupId,groups.length);
   groups.push(group);
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
     url:`${ORIGIN}/courses/${courseId}/assignments/${assignmentId}`
   });
  }
  // One or more hypothetical scores at once (what-ifs stack); each override adds that item's points to its group.
  function grade(overs){
    const list=Array.isArray(overs)?overs:overs?[overs]:[];
    let num=0,den=0;
    for(let i=0;i<groups.length;i++){
      const group=groups[i];
      let earned=group.earned,possible=group.possible;
      for(const o of list)if(o.group===i){earned+=o.earned;possible+=o.possible;}
      if(possible<=0)continue;
      if(weighted){if(group.weight<=0)continue;num+=group.weight*earned/possible;den+=group.weight;}else{num+=earned;den+=possible;}
    }
    return den>0&&Number.isFinite(num)&&Number.isFinite(den)?100*num/den:null;
  }
  // The categories a pretend assignment can go in: every group of a points course, the weighted groups that count of a
  // weighted one (a group of weight 0 never moves the grade, so nothing pretend is filed there).
  const categories=groups.map((g,index)=>({id:g.id,name:g.name||`Group ${index+1}`,weight:g.weight,index})).filter(g=>!weighted||g.weight>0);
  const current=grade(),m={supported:true,reason:null,accountId,courseId,current,upcoming,impact,project,weighted,groups:categories};
  if(current===null)return empty('baseline');
  if(!trusted(m,baseline))return empty('mismatch');
  function impact(u){
   if(!upcoming.includes(u))return null;
   const at=f=>typeof f==='number'&&Number.isFinite(f)&&f>=0&&f<=1?grade({group:u.group,earned:u.points*f,possible:u.points}):null;
   const lo=at(0),hi=at(1);return lo===null||hi===null||!Number.isFinite(hi-lo)?null:{swing:hi-lo,at};
  }
  // entries: [assignmentId, fraction 0..1] pairs for coming work only; anything else refuses the whole projection.
  // extra: pretend assignments with a score, {group: a category's index, points, f}; each goes into its category's sums
  // like any scored item (an unscored pretend assignment is left out, as Canvas leaves out work with no score).
  function project(entries,extra){
   const overs=[];
   for(const [key,f]of entries||[]){
     const u=upcoming.find(row=>row.id===String(key));
     if(!u||typeof f!=='number'||!Number.isFinite(f)||f<0||f>1)return null;
     overs.push({group:u.group,earned:u.points*f,possible:u.points});
   }
   for(const x of extra||[]){
     if(!record(x)||
       !Number.isInteger(x.group)||
       !categories.some(g=>g.index===x.group)||
       typeof x.points!=='number'||
       !Number.isFinite(x.points)||
       x.points<=0||
       x.points>100000||
       typeof x.f!=='number'||
       !Number.isFinite(x.f)||
       x.f<0||
       x.f>1)
       return null;
     overs.push({group:x.group,earned:x.points*x.f,possible:x.points});
   }
   return grade(overs);
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

 // ---------------------------------------------------------------- pretend assignments
 // A pretend assignment is the student's own: a test the teacher has not posted yet, filed under one of the course's
 // categories with its points, and a score once the student sets one. It lives on this device only (storage.js keeps it
 // per account and course, cleaned the same way as here) and is never sent to Canvas.
 const PRETEND_MAX=8,PRETEND_NAME=60,PRETEND_POINTS=10000;
 const pretendText=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim().slice(0,PRETEND_NAME):'';
 function cleanPretend(list){
  const out=[],seen=new Set();
  for(const x of Array.isArray(list)?list:[]){
   if(out.length>=PRETEND_MAX)break;if(!record(x))continue;
   const pid=typeof x.id==='string'&&/^gp-[a-z0-9]{4,24}$/.test(x.id)?x.id:null,
     group=id(x.group),
     points=typeof x.points==='number'&&Number.isFinite(x.points)&&x.points>0&&x.points<=PRETEND_POINTS?Math.round(x.points*100)/100:null;
   if(!pid||seen.has(pid)||!group||!points)continue;seen.add(pid);
   const score=typeof x.score==='number'&&Number.isFinite(x.score)&&x.score>=0&&x.score<=1?Math.round(x.score*1e4)/1e4:null;
   out.push({id:pid,group,points,name:pretendText(x.name),score});
  }
  return out;
 }
 // "Tests" gives "Test", "Quizzes" "Quiz", "Activities" "Activity"; a name already taken gets a number.
 function singular(name){
   const n=String(name||'').trim();
   if(n.length<4||!/s$/i.test(n)||/ss$/i.test(n))return n;
   if(/zzes$/i.test(n))return n.slice(0,-2);
   if(/ies$/i.test(n))return n.slice(0,-3)+'y';
   if(/(?:ches|shes|xes|sses)$/i.test(n))return n.slice(0,-2);
   return n.slice(0,-1);
 }
 function pretendName(category,taken){
   const base=singular(category)||'Assignment';
   if(!taken.includes(base))return base;
   for(let i=2;i<99;i++)if(!taken.includes(`${base} ${i}`))return `${base} ${i}`;
   return base;
 }
 // One course's projection with its pretend assignments: P(state) takes a Map of id → fraction for Canvas's coming work
 // and the pretend ones alike. Pretend assignments whose category is gone (or does not count) are left out.
 function scene(m,pretend){
  const pm=new Map();for(const p of pretend||[]){const g=m.groups.find(g=>g.id===p.group);if(g)pm.set(p.id,{...p,gi:g.index,category:g});}
  const P=state=>{
    const real=[],extra=[];
    for(const [k,f]of state||[]){const p=pm.get(k);if(p)extra.push({group:p.gi,points:p.points,f});else real.push([k,f]);}
    return m.project(real,extra);
  };
  return {pm,P};
 }
 const article=letter=>/^[AEF]/.test(letter)?'an':'a';

 // Where the feature shows: the Grades workspace (a course there is the room), and Home when the module is placed.
 const quiz=()=>/^\/courses\/\d+\/quizzes(?:\/|$)/.test(root.location?.pathname||'');
 function featureOn(c){return c?.gradeImpactEnabled!==false&&(!root.ReserveFeatures||root.ReserveFeatures.enabled('grade-impact'))&&!quiz();}
 function placed(c){try{const A=root.ReserveWorkspaceArrange;return !!A?.snapshot&&A.snapshot(c.s).order.includes('impact');}catch{return false;}}
 function surface(c){if(c?.workspace==='grades')return 'grades';if(c?.workspace==='work'&&c.workPage!=='assignments'&&placed(c))return 'module';return '';}
 function active(c){return !!surface(c)&&c.s?.showGrades===true&&!!id(c.user?.id)&&featureOn(c);}
 function visible(c){return (Array.isArray(c?.courses)?c.courses:[]).filter(course=>id(course?.id));}
 // Coming graded work from the dashboard's own list (no grade data): used to pick the module's first course and for
 // the hidden room, where the weights are sized by points possible and nothing shows a grade.
 function coming(c,courseId,now){
   const end=now+DAYS*864e5;
   return (Array.isArray(c?.items)?c.items:[]).filter(item=>
     String(item?.courseId)===String(courseId)&&
       !item.personal&&
       Number.isFinite(item.points)&&
       item.points>0&&
       !item.hasSubmission&&
       !['submitted','graded','excused','pending_review'].includes(item.state)&&
       item.gradingType!=='not_graded'&&
       item.optionalForGrade!==true&&
       (due=>Number.isFinite(due)&&due>=now-864e5&&due<=end)(Date.parse(item.dueAt||'')));
 }
 function nowOf(c){return Number.isFinite(c?.now)?c.now:Date.now();}
 function moduleCourse(c,ui){
   const list=visible(c);
   if(!list.length)return null;
   const chosen=list.find(course=>String(course.id)===ui.moduleCourse);
   if(chosen)return chosen;
   const now=nowOf(c);
   let best=list[0],most=-1;
   for(const course of list){const pts=coming(c,course.id,now).reduce((sum,item)=>sum+item.points,0);if(pts>most){most=pts;best=course;}}
   return best;
 }
 function courses(c,ui){
   if(surface(c)==='module'){const course=moduleCourse(c,ui);return course?[course]:[];}
   return visible(c).filter(course=>c.state?.courseId==='all'||String(course.id)===String(c.state?.courseId));
 }
 // what is read ahead: on Home the courses either side of the module's (the pager's next turn in both directions)
 function wanted(c,ui){
   const shown=courses(c,ui);
   if(surface(c)!=='module'||!shown.length)return shown;
   const list=visible(c);
   if(list.length<2)return shown;
   const i=list.findIndex(course=>String(course.id)===String(shown[0].id));
   return [...new Set([shown[0],list[(i+1)%list.length],list[(i-1+list.length)%list.length]])];
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

 // The loader (lazy, deduplicated, at most two course reads at once) plus the room's own state: what-ifs per course
 // (kept across the module and the room until "Clear"), the band chosen for "what you need", the module's course.
 // No timers here: the stage in grade-impact-art.js owns frames, and it only runs with a container.
 // store and saved (the dashboard's): pretend assignments are written with store.update and read back through saved(),
 // the account's gradeImpact record as the dashboard last received it. Without them they last for the session.
 function create({client,user,container=null,navigate=null,onChange=()=>{},onAuthError=()=>{},store=null,saved=null}={}){
  const owner=id(user?.id),
    cache=new Map(),
    ui={
      whatIf:new Map(),
      need:new Map(),
      moduleCourse:'',
      from:null,
      events:[],
      drag:null,
      room:{w:0,h:0},
      module:{w:0},
      moduleBySize:{},
      focus:'',
      pretend:new Map(),
      adding:'',
      draft:{group:'',points:'100',name:''}
    };
  let context=null,dead=false,running=0,authError='',stage=null;
  function clear(){for(const entry of cache.values())entry.controller?.abort();cache.clear();}
  function forget(){ui.whatIf.clear();ui.need.clear();ui.drag=null;ui.adding='';}
  // ---- pretend assignments: kept here for drawing at once, written to the account's storage behind the drawing (a write
  // the module or room draws itself asks the dashboard, once, not to redraw the page for it: takeQuietSave). One write is
  // under way at a time; what changes meanwhile (a run of arrow presses) is written once, as it then stands, after it.
  let savedRec,writing=0,quiet=false;const again=new Set();
  function readSaved(){try{return typeof saved==='function'?saved():undefined;}catch{return undefined;}}
  function syncSaved(){
   if(writing||typeof saved!=='function')return;const rec=readSaved();if(rec===savedRec)return;savedRec=rec;
   const all=record(rec)&&record(rec.pretend)?rec.pretend:{};ui.pretend=new Map();
   for(const [key,list]of Object.entries(all))if(id(key)){const rows=cleanPretend(list);if(rows.length)ui.pretend.set(key,rows);}
  }
  function write(courseId){
   const key=String(courseId);if(dead||typeof store?.update!=='function')return;if(writing){again.add(key);return;}writing++;quiet=true;
   Promise.resolve().then(()=>store.update(data=>{
     const rows=cleanPretend(ui.pretend.get(key)||[]),gi=record(data.gradeImpact)?data.gradeImpact:{},pretend=record(gi.pretend)?gi.pretend:{};
     if(rows.length)pretend[key]=rows;else delete pretend[key];
     data.gradeImpact={...gi,pretend};
   }))
    .catch(()=>{}).finally(()=>{quiet=false;writing--;const next=[...again];again.clear();for(const k of next)write(k);});
  }

  const pretendOf=courseId=>ui.pretend.get(String(courseId))||[];
  function setPretend(courseId,rows){const key=String(courseId),clean=cleanPretend(rows);if(clean.length)ui.pretend.set(key,clean);else ui.pretend.delete(key);}
  // the course's state: its Canvas what-ifs and its pretend scores, as one map of id → fraction
  // Where a key goes after an add-row change: the room when it is up (it floats over Home, whose module draws the same
  // row under it), else the module.
  const scope=()=>container?.querySelector?.('.gi-room:not([data-gi-away])')?'.gi-room ':'.rd-widget[data-widget="impact"] ';
  function stateOf(courseId){
    const key=String(courseId),map=new Map(ui.whatIf.get(key)||[]);
    for(const p of pretendOf(key))if(p.score!=null)map.set(p.id,p.score);
    return map;
  }
  function current(entry){
    const course=context&&wanted(context,ui).find(course=>String(course.id)===entry.id);
    return !dead&&active(context)&&id(context.user.id)===owner&&course&&cache.get(entry.id)===entry&&entry.stamp===stamp(context,course)&&!snapshotReason(course);
  }
  function notify(){if(!dead)onChange();}
  async function load(entry){
   try{
    const data=await client.loadGradeImpact(entry.id,{user:{id:owner},signal:entry.controller.signal});
    if(!current(entry))return;
    if(id(data?.accountId)!==owner||id(data?.courseId)!==entry.id||data?.origin!==ORIGIN)throw Object.assign(Error('Your Canvas account changed. Reopen Canvas Harness.'),{code:'auth'});
    const result=model(data,{showGrades:true});
    if(!current(entry))return;
    Object.assign(entry,{state:result.supported?'ready':'unavailable',model:result.supported?result:null,reason:result.reason});
   }catch(error){
    if(!current(entry))return;
    const message=String(error?.message||'Canvas could not load grade impact.').slice(0,300);
    if(error?.code==='auth'){authError=message;clear();forget();onAuthError(error);}
    else Object.assign(entry,{state:'error',error:message});
   }finally{running--;if(!dead&&active(context)&&id(context.user.id)===owner){if(courses(context,ui).some(course=>String(course.id)===entry.id))refresh();pump();}}
  }
  function pump(){
    if(dead||authError||!active(context)||id(context.user.id)!==owner)return;
    for(const entry of cache.values()){if(running>=2)break;if(entry.state!=='queued'||!current(entry))continue;entry.state='loading';running++;void load(entry);}
  }
  function ensureData(c){
   context=c;syncSaved();
   // Another workspace (Review, Planner…) is not a reason to forget: the finished reads stay, so coming back to Home
   // shows the module at once instead of "Loading grade impact…" and two more whole-page renders.
   if(!dead&&owner&&c?.s?.showGrades===true&&id(c?.user?.id)===owner&&featureOn(c)&&!surface(c)){
     for(const [key,entry]of cache)if(['queued','loading'].includes(entry.state)){entry.controller?.abort();cache.delete(key);}
     return;
   }
   if(dead||!owner||!active(c)||id(c.user.id)!==owner){clear();if(c?.s?.showGrades!==true||!c?.user||id(c.user.id)!==owner)forget();return;}
   if(authError)return;
   const selected=wanted(c,ui),wanted_=new Set(selected.map(course=>String(course.id)));
   // Finished reads for other courses stay (the module's pager comes back to them); unfinished ones stop.
   for(const [key,entry]of cache)if(!wanted_.has(key)&&['queued','loading'].includes(entry.state)){entry.controller?.abort();cache.delete(key);}
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
  function ensure(c){
   ensureData(c);
   if(!dead&&container&&!stage&&typeof root.ReserveGradeImpactArt?.stage==='function')stage=root.ReserveGradeImpactArt.stage({container,api:control});
   stage?.sync();
  }
  function get(value,c=context){
   if(dead||!owner||!active(c)||id(c.user.id)!==owner)return null;
   if(authError)return {state:'error',error:authError};
   const course=courses(c,ui).find(course=>String(course.id)===String(value)),entry=cache.get(String(value));
   if(!course||!entry||entry.stamp!==stamp(c,course))return null;
   return entry;
  }
  // A finished, verified model for a course, wherever the student is (Up next's small weights use it); never loads.
  function peek(value,c=context){
   if(dead||!owner||authError||c?.s?.showGrades!==true||id(c?.user?.id)!==owner||!featureOn(c))return null;
   const course=visible(c).find(course=>String(course.id)===String(value)),entry=cache.get(String(value));
   return course&&entry?.state==='ready'&&entry.stamp===stamp(c,course)&&!snapshotReason(course)&&trusted(entry.model,course.score)?entry.model:null;
  }
  const pointsIn=(courseId,m,k)=>m.upcoming.find(u=>u.id===k)?.points??pretendOf(courseId).find(p=>p.id===k)?.points??0;
  function liveModel(courseId){const entry=cache.get(String(courseId));return context&&active(context)&&entry?.state==='ready'?entry.model:null;}
  const control={
   preview(courseId,aid,f){
     const m=liveModel(courseId);
     if(!m||!(f>=0&&f<=1))return null;
     const map=stateOf(courseId);
     map.set(String(aid),f);
     return scene(m,pretendOf(courseId)).P(map);
   },
   // The answer line while a knob is held: what the grade would be, and whether the band holds.
   sayIf(courseId,aid,f){
     const m=liveModel(courseId);
     if(!m||!(f>=0&&f<=1))return '';
     const map=stateOf(courseId);
     map.set(String(aid),f);
     const v=scene(m,pretendOf(courseId)).P(map);
     return v==null?'':resultLine(m.current,v,[...map].map(([k,x])=>[x,pointsIn(courseId,m,k)])).say;
   },
   setWhatIf(courseId,aid,f){const m=liveModel(courseId),key=String(courseId),pid=String(aid);ui.drag=null;
    if(m&&f>=0&&f<=1&&pid.startsWith('gp-')){
      const rows=pretendOf(key);
      if(!rows.some(p=>p.id===pid)){notify();return false;}
      setPretend(key,rows.map(p=>p.id===pid?{...p,score:fine(f)}:p));
      write(key);
      refresh();
      return true;
    }
    if(!m||!(f>=0&&f<=1)||!m.upcoming.some(u=>u.id===pid)){notify();return false;}
    const map=new Map(ui.whatIf.get(key)||[]);
    map.set(pid,fine(f));
    ui.whatIf.set(key,map);
    refresh();
    return true;
   },
   removeWhatIf(courseId,aid){const key=String(courseId),pid=String(aid);
    if(pid.startsWith('gp-')){
      const rows=pretendOf(key);
      if(rows.some(p=>p.id===pid&&p.score!=null)){setPretend(key,rows.map(p=>p.id===pid?{...p,score:null}:p));write(key);refresh();}
      return;
    }
    const map=ui.whatIf.get(key);if(map?.delete(pid)){if(!map.size)ui.whatIf.delete(key);refresh();}},
   // Clear forgets the what-ifs and the pretend scores; the pretend assignments stay (each has its own ×).
   clear(courseId,focus=''){ui.drag=null;const key=String(courseId),rows=pretendOf(key),scored=rows.some(p=>p.score!=null);let changed=ui.whatIf.delete(key);
    if(scored){setPretend(key,rows.map(p=>({...p,score:null})));write(key);changed=true;}
    if(changed){ui.focus=focus||'';refresh();}},
   // Add assignment: the inline row opens with the first category chosen, 100 points and no name.
   addOpen(courseId){const m=liveModel(courseId),key=String(courseId);if(!m||!m.groups.length||pretendOf(key).length>=PRETEND_MAX)return false;
    ui.adding=key;ui.draft={group:m.groups[0].id,points:'100',name:''};ui.focus=`${scope()}[data-gi-add-form="${key}"] [data-gi-draft="points"]`;refresh();return true;},
   addCancel(){if(!ui.adding)return;const key=ui.adding;ui.adding='';ui.focus=`${scope()}[data-gi-action="add"][data-gi-course="${key}"]`;refresh();},
   // a typed draft is only kept (no redraw under the caret); a category press redraws its tags
   // (a category pressed with the pointer hands the caret to the points; the arrows stay on the tags)
   addDraft(field,value,via){
     if(!ui.adding)return;
     if(field==='group'){
       const m=liveModel(ui.adding);
       if(m?.groups.some(g=>g.id===String(value))){
         ui.draft={...ui.draft,group:String(value)};
         ui.focus=`${scope()}[data-gi-add-form="${ui.adding}"] .gi-cat[data-gi-group="${String(value).replace(/[^\d]/g,'')}"]`;
         if(via==='press')ui.focus=`${scope()}[data-gi-add-form="${ui.adding}"] [data-gi-draft="points"]`;
         refresh();
       }
       return;
     }
    if(field==='points')ui.draft={...ui.draft,points:String(value??'').slice(0,12)};else if(field==='name')ui.draft={...ui.draft,name:String(value??'').slice(0,PRETEND_NAME)};},
   addConfirm(courseId=ui.adding){const key=String(courseId),m=liveModel(key),rows=pretendOf(key);if(!m||ui.adding!==key)return null;
    const g=m.groups.find(g=>g.id===ui.draft.group),raw=String(ui.draft.points).trim(),points=/^\d{1,5}(?:\.\d{1,2})?$/.test(raw)?Number(raw):NaN;
    if(!g||!(points>0&&points<=PRETEND_POINTS)||rows.length>=PRETEND_MAX){
      ui.focus=`${scope()}[data-gi-add-form="${key}"] ${g?'[data-gi-draft="points"]':'.gi-cat'}`;
      ui.events.push({type:'add-refused',course:key});
      refresh();
      return null;
    }
    const pid='gp-'+Math.random().toString(36).slice(2,10).padEnd(8,'0'),name=pretendText(ui.draft.name)||pretendName(g.name,rows.filter(p=>p.group===g.id).map(p=>p.name));
    setPretend(key,[...rows,{id:pid,group:g.id,points,name,score:null}]);ui.adding='';ui.events.push({type:'pretend-add',course:key,id:pid});
    ui.focus=scope()==='.gi-room '?`.gi-room [data-gi-weight="${pid}"] .gi-handle`:`[data-gi-row="${pid}"] .gi-slide`;write(key);refresh();return pid;},
   removePretend(courseId,pid){const key=String(courseId),rows=pretendOf(key);if(!rows.some(p=>p.id===String(pid)))return false;
    setPretend(key,rows.filter(p=>p.id!==String(pid)));ui.focus=`${scope()}[data-gi-action="add"][data-gi-course="${key}"]||${scope()}.gi-slide||${scope()}.gi-handle`;write(key);refresh();return true;},
   setNeed(courseId,low){
     const key=String(courseId);
     if(!BANDS.some(b=>b.lo===low))return;
     if(ui.need.get(key)===low)ui.need.delete(key);else{ui.need.set(key,low);ui.events.push({type:'need',course:key});}
     refresh();
   },
   setDrag(courseId,aid,f){ui.drag=courseId==null?null:{course:String(courseId),id:String(aid),f};},
   touch(){notify();},
   page(step){
     const list=context?visible(context):[];
     if(list.length<2)return;
     const cur=moduleCourse(context,ui);
     let i=list.findIndex(course=>String(course.id)===String(cur?.id));
     i=(i+(step<0?-1:1)+list.length)%list.length;
     ui.moduleCourse=String(list[i].id);
     ui.events.push({type:'page',dir:step<0?-1:1});
    // the pager redrawn under the key keeps it (a second Next course goes on from there)
    ui.focus=`.rd-widget[data-widget="impact"] .gi-pg[data-gi-step="${step<0?-1:1}"]`;ensureData(context);refresh();},
   canNavigate(){return typeof navigate==='function';},
   open(courseId,rect,origin='module'){
    if(typeof navigate!=='function'||!id(courseId))return false;const key=String(courseId);
    ui.from={origin,course:key,rect:rect||null,state:String(context?.state?.courseId??'all')};if(origin==='module')ui.moduleCourse=key;
    ui.events.push({type:'open',course:key,rect:rect||null});ui.focus='.gi-room [data-gi-action="fold"]';
    if(navigate({to:'room',courseId:key})===false){ui.events=ui.events.filter(e=>e.type!=='open');ui.from=null;ui.focus='';return false;}
    return true;
   },
   foldTarget(){return ui.from?.rect||null;},
   // the element the room has just folded into, once the page it is on has been drawn: the module, or the course's strip
   foldHome(){const h=ui.home;ui.home=null;if(!h||!container?.querySelector)return null;const course=String(h.course).replace(/[^\d]/g,'');
    return h.origin==='module'?
      container.querySelector('.rd-widget[data-widget="impact"]'):
      h.origin==='row'?
        container.querySelector(`.rd-grade-table [data-gi-open="${course}"]`)?.closest?.('tr')||null:
        container.querySelector(`.gi-strip[data-rd-key="gi-strip-${course}"]`)||container.querySelector(`[data-gi-open="${course}"]`)?.closest?.('.gi-strip')||null;},
   fold(){
    if(typeof navigate!=='function')return false;
    const from=ui.from,course=from?.course||String(context?.state?.courseId||'');
    ui.from=null;
    ui.events.push({type:'arrive',course});
    ui.home={origin:from?.origin||'grades',course};
    ui.focus=id(course)?`[data-gi-open="${course}"]`:'';
    if(from?.origin==='module'){ui.moduleCourse=course;return navigate({to:'home',courseId:from.state||'all'})!==false;}
    return navigate({to:'grades',courseId:'all'})!==false;
   },
   // the module's width is kept per size (Narrow, Normal, Wide): a size change then draws the module at its new width in
   // the render that moves it, instead of a second redraw a frame later that snapped its height under the glide
   measure(kind,w,h,size){
    if(kind==='room'){
      const W=Math.round(w/8)*8;
      let changed=false;
      if(W>0&&Math.abs(W-ui.room.w)>=8){ui.room.w=W;changed=true;}
      if(h>0&&(!ui.room.h||Math.abs(h-ui.room.h)>=40)){ui.room.h=h;changed=true;}
      if(changed)refresh();
    }
    else if(kind==='module'){const W=Math.round(w/4)*4;if(W>0&&['s','m','l'].includes(size))ui.moduleBySize[size]=W;if(W>0&&Math.abs(W-ui.module.w)>=4){ui.module.w=W;refresh();}}
   },
   takeEvents(){const list=ui.events;ui.events=[];return list;},
   takeFocus(){const value=ui.focus;ui.focus='';return value;}
  };
  // A what-if, a band or Clear in the weighing room changes only the room: it is redrawn where it stands (the same
  // markup the next render would make, patched by the dashboard's rules) instead of a whole-dashboard render in the
  // first frame of the slide. The module on Home, and anything else, goes through the dashboard as before.
  let shown=null,shownMod=null;
  function remember(c,h,course){shown={c,h,course:String(course.id)};}
  function rememberModule(c,h){shownMod={c,h};}
  const keyOf=n=>n.nodeType===1?(n.getAttribute('data-rd-key')||n.id||''):'';
  function patch(now,next){
   if(now.nodeType!==1){if(now.nodeValue!==next.nodeValue)now.nodeValue=next.nodeValue;return;}
   for(const a of [...now.attributes])if(!next.hasAttribute(a.name)&&a.name!=='data-motion'&&a.name!=='style'&&a.name!=='data-gi-paused')now.removeAttribute(a.name);
   for(const a of [...next.attributes])if(now.getAttribute(a.name)!==a.value)now.setAttribute(a.name,a.value);
   const keyed=new Map([...now.childNodes].filter(keyOf).map(n=>[keyOf(n),n]));let cursor=now.firstChild;
   for(const want of [...next.childNodes]){const have=keyOf(want)?keyed.get(keyOf(want)):cursor;
    if(have&&have.nodeType===want.nodeType&&have.nodeName===want.nodeName&&keyOf(have)===keyOf(want)){
      if(have!==cursor)now.insertBefore(have,cursor);
      patch(have,want);
      cursor=have.nextSibling;
    }
    else now.insertBefore(want,cursor);}
   while(cursor){const rest=cursor.nextSibling;cursor.remove();cursor=rest;}
  }
  // (a room that floats over its page, dashboard.js, is redrawn by itself, with the page under it left as it is; one
  // built ahead of time or folding away, data-gi-away, is no room here)
  function refresh(){
   try{
    const doc=container?.ownerDocument,
      roomEl=container?.querySelector?.('.gi-room:not([data-gi-away])'),
      mods=[...(container?.querySelectorAll?.('.gi-mod')||[])],
      t=doc?.createElement?.('template'),
      over=!!roomEl?.closest?.('.rd-roomlayer');
    if(dead||!t||!('content' in t)||!over&&(container.querySelector('.gi-strip')||roomEl&&mods.length))return notify();
    if(roomEl){
     if(!shown||roomEl.getAttribute('data-gi-room')!==shown.course)return notify();
     const course=visible(shown.c).find(x=>String(x.id)===shown.course);if(!course)return notify();
     t.innerHTML=renderRoom(shown.c,shown.h,self,course);const next=t.content.querySelector('.gi-room');if(!next||keyOf(next)!==keyOf(roomEl))return notify();
     patch(roomEl,next);stage?.sync();return;
    }
    // the Home module (paging, Clear): the module and its corner control, which opens the course on show
    if(mods.length!==1||!shownMod)return notify();
    t.innerHTML=renderModule(shownMod.c,shownMod.h,self)+moduleOpener(shownMod.c,shownMod.h,self);
    const next=t.content.querySelector('.gi-mod');
    if(!next||keyOf(next)!==keyOf(mods[0]))return notify();
    const opener=mods[0].closest?.('.rd-widget')?.querySelector?.('.gi-open'),nextOpener=t.content.querySelector('.gi-open');
    patch(mods[0],next);if(opener&&nextOpener)patch(opener,nextOpener);stage?.sync();
   }catch{notify();}
  }
  const self={owner,ensure,get,peek,control,remember,rememberModule,
   whatIfs:courseId=>new Map(ui.whatIf.get(String(courseId))||[]),need:courseId=>ui.need.get(String(courseId))??null,
   pretend:courseId=>pretendOf(courseId).map(p=>({...p})),adding:courseId=>ui.adding!==''&&ui.adding===String(courseId)?{...ui.draft}:null,
   takeQuietSave(){const q=quiet;quiet=false;return q;},
   dragFor:courseId=>ui.drag&&ui.drag.course===String(courseId)?{...ui.drag}:null,
   moduleCourse:c=>moduleCourse(c||context,ui),size:(kind,sz)=>kind==='room'?{...ui.room}:{w:ui.moduleBySize[sz]||ui.module.w},
   redraw(){refresh();},
   // the room's size known before it is drawn (a room built ahead of time, out of sight): the same steps as measure(),
   // without a redraw
   presize(w,h){const W=Math.round(w/8)*8;if(W>0&&Math.abs(W-ui.room.w)>=8)ui.room.w=W;if(h>0&&(!ui.room.h||Math.abs(h-ui.room.h)>=40))ui.room.h=Math.round(h);},
   invalidate(){clear();},destroy(){dead=true;context=null;clear();forget();stage?.destroy?.();stage=null;}};
  return self;
 }

 // ---------------------------------------------------------------- the view each drawing is built from
 const fmt=n=>(Math.round(n*10)/10).toFixed(1);
 // A score is shown in points as well, the way it is marked, with a teacher's decimals kept: 45/50 (90%), 43.5/50 (87%).
 const num=n=>String(Math.round(n*100)/100);
 // (the per cent to a tenth, as the points may be: 43.7/50 is 87.4%; out of 100 the points say it already; the two are
 // kept on one line)
 const pctOf=f=>`${Math.round(f*1000)/10}%`;
 const ptsOf=(f,pts)=>pts>0?`${num(f*pts)}/${num(pts)}`:pctOf(f);
 const pctAlso=(f,pts)=>pts>0&&pts!==100?` (${pctOf(f)})`:'';
 const scoreOf=(f,pts)=>pts>0?`${ptsOf(f,pts)}${pctAlso(f,pts)}`:pctOf(f);
 // a dragged score's step in points (grade-impact-art.js moves in the same steps): tenths under 10 points, halves to 200
 const unitOf=pts=>pts<10?.1:pts<=200?.5:1;
 const fine=f=>Math.round(f*1e4)/1e4;
 // A title cut to fit n average letters: narrow letters (i, l, t, spaces) count for about half, capitals and m/w for
 // more, so 'Unit 3 Test' is kept whole where it fits; a long one is cut at a word, never inside it, and loses its
 // trailing punctuation: 'Reaction rates…', not 'Reaction rates: l…'.
 const span=c=>/[ilj.,:;'’|!1Itfr()\[\] ·-]/.test(c)?.55:/[mwMW@%]/.test(c)?1.45:/[A-Z0-9]/.test(c)?1.1:1;
 const width=t=>{let w=0;for(const c of t)w+=span(c);return w;};
 const cut=(text,n)=>{text=String(text??'');if(width(text)<=n)return text;
  const words=text.split(/(\s+)/);
  let best='';
  for(let i=0,acc='';i<words.length;i++){acc+=words[i];if(i%2)continue;const kept=acc.replace(/[\s:;,.·–—-]+$/,'');if(kept&&width(kept)+1<=n)best=kept;else break;}
  if(best&&width(best)>=n*.4)return best+'…';
  let out='';for(const c of text){if(width(out+c)+1>n)break;out+=c;}return (out.trimEnd()||text.slice(0,1))+'…';};
 const short=course=>course?.shortName||course?.name||'Course';
 const bandOf=v=>BANDS.find(b=>v>=b.lo)||BANDS[BANDS.length-1];
 function hourOf(c){
   try{const n=Number(new Intl.DateTimeFormat('en-US',{hour:'numeric',hourCycle:'h23',timeZone:c?.s?.timeZone||undefined}).format(nowOf(c)));return Number.isFinite(n)?n%24:16;}catch{return 16;}
 }
 function dayText(h,c,value){try{return h.formatDate(value,c.s?.timeZone,{weekday:'short',month:'short',day:'numeric'});}catch{return '';}}
 // The answer to "what do I need for this band", on the heaviest coming item, with every other what-if kept. P projects a
 // state (a Map of id → fraction, Canvas's coming work and pretend assignments alike).
 function needWith(P,heavy,state,low){
  if(!heavy)return null;const k=heavy.id,others=[...state].filter(([key])=>key!==k),a0=P(new Map([...others,[k,0]])),a1=P(new Map([...others,[k,1]]));
  if(a0===null||a1===null)return null;
  if(a1<low)return {low,item:heavy,reach:false,best:a1};
  if(a0>=low)return {low,item:heavy,reach:true,any:true,f:0};
  // (the least score that does it, rounded up to the slider's step: 31/50 rather than 30.6/50)
  const raw=(low-a0)/(a1-a0),pts=heavy.points>0?heavy.points:0,u=unitOf(pts);
  return {low,item:heavy,reach:true,f:pts?Math.min(1,fine(Math.ceil(raw*pts/u-1e-9)*u/pts)):Math.min(1,Math.ceil(raw*100)/100)};
 }
 function needFor(m,list,whatIfs,low){return m?needWith(state=>m.project([...state]),list[0],whatIfs,low):null;}
 // The answer line, in parts: [words, the figure (drawn bold), words]. say is the same sentence for the live region.
 // (es: [the fraction, the assignment's points] for each score set)
 function resultLine(current,value,es){
  const was=bandOf(current),now=bandOf(value),n=es.length,scores=n===1?scoreOf(es[0][0],es[0][1]):es.slice(0,3).map(([f,p])=>ptsOf(f,p)).join(', ')+(n>3?` +${n-3}`:'');
  const head=n===1?'With this score':'With these scores',tail=now.letter===was.letter?`still ${article(now.letter)} ${now.letter}`:`${article(now.letter)} ${now.letter}`;
  return {kind:'if',parts:[`${head}: ${scores} → `,fmt(value),` · ${tail}`],say:`${head}: ${scores} → ${fmt(value)} · ${tail}`};
 }
 function needLine(res,target,cur,name,day){
  const L=target.letter,mine=L===cur.letter,above=target.lo>cur.lo,d=day?` · ${day}`:'';
  if(!res.reach)return {kind:'out',parts:[`${L} is out of reach · best `,fmt(res.best),''],say:`${L} is out of reach. The best possible is ${fmt(res.best)}`};
  if(res.any){const t=mine?`Your ${L} holds whatever you get on ${name}`:`${L} or better holds whatever you get on ${name}`;return {kind:'holds',parts:[t,'',''],say:t};}
  const p=res.item?.points>0?res.item.points:0,pct=ptsOf(res.f,p),more=pctAlso(res.f,p),lead=mine?`To keep your ${L}: `:above?`To reach ${article(L)} ${L}: `:`To keep ${article(L)} ${L}: `;
  return {kind:above?'reach':'keep',parts:[lead,pct,`${more} on ${name}${d}`],say:`${lead}${pct}${more} on ${name}${d}`};
 }
 const ROWS={s:2,m:4,l:6};
 function weekday(h,c,value){try{return h.formatDate(value,c.s?.timeZone,{weekday:'short'});}catch{return '';}}
 function view(c,h,loader,course,kind,size='m'){
  const {E}=h,now=nowOf(c),shown=c.s?.showGrades===true,name=short(course),key=String(course.id);
  const vm={
    kind,
    size,
    course:{id:E(key)},
    hidden:!shown,
    state:'status',
    status:'',
    rows:[],
    bands:BANDS,
    lo:60,
    hi:100,
    current:null,
    currentText:'',
    letter:'',
    ghost:null,
    whatIf:null,
    need:null,
    answer:null,
    add:null,
    canAdd:false,
    clear:false,
    maxWd:44,
    empty:'',
   roomLabel:E(`${name}: grade impact`),
   gradebook:E(`${ORIGIN}/courses/${key}/grades`),
   gradebookLabel:E(`${name} gradebook in Canvas`),
   ledgerText:'As Canvas reports it',
   hour:hourOf(c),
   dark:c?.theme==='dark',
   title:E(name),
   grade:''
  };
  const tag=(text,max)=>n=>E(cut(text,Math.min(max,n)));
  if(!shown){
   // Hidden: names, due days and categories only. No grade, swing, projection, need or score figure is computed or drawn;
   // the weights are sized by points possible so the heaviest still looks heaviest, but no number says so.
   const items=coming(c,key,now).sort((a,b)=>b.points-a.points||Date.parse(a.dueAt)-Date.parse(b.dueAt)||String(a.id).localeCompare(String(b.id))),
     most=Math.max(1,...items.map(item=>item.points));
   vm.rows=items.slice(0,kind==='module'?ROWS[size]||4:MAX_ROWS).map(item=>
     ({
       key:E(item.id),
       name:tag(item.name,40),
       meta:E(dayText(h,c,item.dueAt)),
       day:E(weekday(h,c,item.dueAt)),
       cat:E(pretendText(item.assignmentGroup?.name||'')),
       url:E(`${ORIGIN}/courses/${key}/assignments/${encodeURIComponent(item.id)}`),
       linkLabel:E(`${item.name}, due ${dayText(h,c,item.dueAt)}`),
       wd:34+40*Math.sqrt(item.points/most),
       stamp:'',
       line:'',
       f:null
     }));
   vm.state='hidden';vm.maxWd=Math.max(44,...vm.rows.map(r=>r.wd));vm.empty=vm.rows.length?'':'Nothing graded coming up';return vm;
  }
  const blocked=snapshotReason(course),entry=loader?.get?.(key,c);let message=blocked?REASONS[blocked]:'';
  if(!message){
   if(!entry||['queued','loading'].includes(entry.state)){message='Loading grade impact…';vm.state='loading';}
   else if(entry.state==='error')message=entry.error||'Canvas could not load grade impact.';
   else if(entry.state!=='ready')message=REASONS[entry.reason]||'Grade impact unavailable';
   else if(entry.model?.accountId!==id(c.user?.id)||entry.model?.courseId!==key||!trusted(entry.model,course.score))message=REASONS.mismatch;
  }
  if(message){vm.status=E(message);return vm;}
  // Canvas's coming work and the student's pretend assignments, one list, most impact first. (The Grades list's strips
  // stay with Canvas's own work.)
  const m=entry.model,stored=kind==='strip'?[]:loader.pretend?.(key)||[],{pm,P}=scene(m,stored);
  const pretend=[...pm.values()].map(p=>{
    const at=f=>P(new Map([[p.id,f]]));
    const lo=at(0),hi=at(1);
    return {
      id:p.id,
      name:p.name||singular(p.category.name)||'Pretend',
      points:p.points,
      group:p.gi,
      category:p.category,
      score:p.score,
      pretend:true,
      due:'',
      url:'',
      imp:{swing:hi-lo,at}
    };
  }).filter(r=>Number.isFinite(r.imp.swing));
  const list=[...rows(m,{now}),...pretend].sort((a,b)=>
    b.imp.swing-a.imp.swing||(a.pretend?1:0)-(b.pretend?1:0)||Date.parse(a.due)-Date.parse(b.due)||a.id.localeCompare(b.id)),
    ids=new Set(list.map(row=>row.id)),
    ptsBy=new Map(list.map(row=>[row.id,row.points]));
  const kept=new Map([...(loader.whatIfs?.(key)||[])].filter(([k])=>ids.has(k)&&!k.startsWith('gp-')));for(const p of pretend)if(p.score!=null)kept.set(p.id,p.score);
  const drag=loader.dragFor?.(key),all=new Map(kept);if(drag&&ids.has(drag.id))all.set(drag.id,drag.f);
  const projected=all.size?P(all):null,committed=kept.size?P(kept):null;
  const values=[m.current,...list.map(r=>r.imp.at(0)),...(projected!=null?[projected]:[])].filter(Number.isFinite);
  vm.lo=Math.max(0,Math.min(60,Math.floor((Math.min(...values)-1)/10)*10));vm.hi=100;vm.bands=BANDS.filter(b=>b.hi>vm.lo);
  vm.state='ready';vm.current=m.current;vm.currentText=fmt(m.current);vm.letter=course.grade?E(cut(course.grade,3)):'';
  vm.grade=E(`${course.grade?course.grade+' · ':''}${fmt(m.current)}%`);
  // The module shows its size's rows, most impact first; every pretend assignment is among them while there is room.
  let shownList=list.slice(0,MAX_ROWS);
  if(kind==='module'){
    const cap=ROWS[size]||4,mine=list.filter(r=>r.pretend).slice(0,cap),theirs=list.filter(r=>!r.pretend).slice(0,cap-mine.length);
    shownList=list.filter(r=>mine.includes(r)||theirs.includes(r));
  }
  const low=loader.need?.(key),need=low!=null?needWith(P,list[0],all,low):null;
  // The answer (the module's line): the result once a score is set; else what the heaviest row on show needs to keep the
  // band you are in (or the band chosen on the ruler); a band that cannot be kept gives the next band that can be reached.
  const heavy=shownList[0],cur=bandOf(m.current);let named=null,rest=null;
  if(kind==='module'){
   if(committed!=null)vm.answer=resultLine(m.current,committed,[...kept].map(([k,f])=>[f,ptsBy.get(k)||0]));
   else if(heavy){
    let target=null,res=null;const none=new Map();
    if(low!=null){target=BANDS.find(b=>b.lo===low)||null;res=target?needWith(P,heavy,none,low):null;}
    else if(cur.lo>0){
      target=cur;
      res=needWith(P,heavy,none,cur.lo);
      if(res&&!res.reach)for(const b of BANDS.filter(b=>b.lo>0&&b.lo<cur.lo)){const r=needWith(P,heavy,none,b.lo);if(r?.reach){target=b;res=r;break;}}
    }
    else{target=BANDS.filter(b=>b.lo>0).pop();res=needWith(P,heavy,none,target.lo);}
    if(res&&target){vm.answer=needLine(res,target,cur,cut(heavy.name,30),heavy.pretend?'':weekday(h,c,heavy.due));named=heavy.id;if(res.reach&&!res.any)rest=res.f;}
   }
   else vm.answer={kind:'none',parts:['No upcoming graded work','',''],say:'No upcoming graded work'};
   if(vm.answer)vm.answer={kind:vm.answer.kind,html:`${E(vm.answer.parts[0])}${vm.answer.parts[1]?`<b class="gi-ans-n">${E(vm.answer.parts[1])}</b>`:''}${E(vm.answer.parts[2])}`,say:E(vm.answer.say)};
  }
  vm.rows=shownList.map((r,i)=>{
   const f=all.has(r.id)?all.get(r.id):null,others=[...all].filter(([k])=>k!==r.id),at=x=>P(new Map([...others,[r.id,x]])),at0=at(0),at1=at(1),proj=f!=null?at(f):null;
   const due=r.pretend?'':dayText(h,c,r.due),
     day=r.pretend?'':weekday(h,c,r.due),
     pts=Number(r.points.toFixed(2)),
     cat=r.pretend?r.category:m.groups.find(g=>g.index===r.group)||null;
   const catText=cat?m.weighted?`${cat.name} · ${Number(cat.weight.toFixed(2))}%`:cat.name:'';
   const needLine_=kind!=='module'&&i===0&&need?need.reach?need.any?'any score':`need ${ptsOf(need.f,need.item.points)}`:`best ${fmt(need.best)}`:'';
   const restF=r.id===named&&rest!=null?rest:.5;
   return {
     key:E(r.id),
     name:tag(r.name,40),
     meta:E(r.pretend?`${catText?cut(cat.name,14)+' · ':''}${pts} pts`:`${due} · ${pts} pts`),
     url:r.url?E(r.url):'',
     linkLabel:E(r.pretend?r.name:`${r.name}, due ${due}`),
    wd:30+12*Math.sqrt(r.imp.swing),stamp:E(String(Number(r.points.toFixed(1)))),line:E(needLine_||`moves ${fmt(r.imp.swing)}`),need:!!needLine_,f,dialTo:proj!=null?fmt(proj):'',
    pretend:!!r.pretend,
    day:E(day),
    pts:E(f!=null?`${num(f*pts)}/${pts} pts`:`${pts} pts`),
    ptsMax:E(`${pts}/${pts} pts`),
    points:pts,
    cat:E(catText),
    catName:E(cat?.name||''),
    named:r.id===named,
    rest:restF,
    restLabel:r.id===named&&rest!=null?pctOf(rest):'',
    removeLabel:E(`Remove ${r.name}`),aria:E(`${r.name} what-if`),valueText:E(f!=null?`${scoreOf(f,pts)} gives ${fmt(proj)}`:`0% gives ${fmt(at0)}, 100% gives ${fmt(at1)}`)};
  });
  vm.maxWd=Math.max(44,...vm.rows.map(r=>r.wd));vm.empty=list.length?'':'No upcoming graded work';
  if(projected!=null)vm.ghost={value:projected,label:fmt(projected)};
  if(committed!=null)vm.whatIf={count:kept.size,title:E(`${kept.size} what-if${kept.size===1?'':'s'}`),change:E(`${fmt(m.current)} → ${fmt(committed)}`),clearLabel:'Clear what-ifs'};
  vm.clear=kept.size>0;
  // (on a narrow slip the per cent goes before the assignment's name does: 96.5/100 on Unit 3 Test)
  if(need){const heads=need.reach?need.any?['any score on ']:[`${scoreOf(need.f,need.item.points)} on `,`${ptsOf(need.f,need.item.points)} on `]:[''],head=heads.at(-1);
   vm.need={low:need.low,title:need.reach?n=>E(n>=16?`For ${need.low}+ you need`:`For ${need.low}+`):n=>E(n>=19?`${need.low}+ is out of reach`:'Out of reach'),text:need.reach?n=>{
     const h=heads.find(h=>n>=h.length+6);
     return E(h?h+cut(need.item.name,Math.min(24,n-h.length)):head.replace(/ on $/,''));
   }:E(`best ${fmt(need.best)}`),
    say:E(need.reach?`For ${need.low} and up you need ${need.any?'any score':scoreOf(need.f,need.item.points)} on ${need.item.name}`:`${need.low} and up is out of reach. The best possible is ${fmt(need.best)}`)};}
  // Add assignment: offered where the course can be weighed and has a category, up to the cap of pretend assignments.
  vm.canAdd=kind!=='strip'&&m.groups.length>0&&stored.length<PRETEND_MAX;
  const draft=vm.canAdd?loader.adding?.(key):null;
  if(draft){const g=m.groups.find(x=>x.id===draft.group)||m.groups[0];
   vm.add={
     groups:m.groups.map(x=>
       ({id:E(x.id),name:E(cut(x.name,22)),weight:m.weighted?E(`${Number(x.weight.toFixed(2))}%`):'',on:x.id===g.id,label:E(m.weighted?`${x.name}, ${Number(x.weight.toFixed(2))}%`:x.name)})),
     points:E(draft.points),
     name:E(draft.name),
     placeholder:E(pretendName(g.name,stored.filter(p=>p.group===g.id).map(p=>p.name)))
   };}
  return vm;
 }

 // ---------------------------------------------------------------- the three places it is drawn
 const EXPAND='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.2 4.4c2 .1 3.9 0 5.4.2.2 1.5.1 3.4.2 5.4M19.4 4.8l-5.6 5.4M9.8 19.6c-2-.1-3.9 0-5.4-.2-.2-1.5-.1-3.4-.2-5.4M4.6 19.2l5.6-5.4"/></svg>';
 function art(){return root.ReserveGradeImpactArt;}
 const chip=seed=>art()?.chip?.(seed)||'';
 const icon=name=>art()?.icon?.(name)||'';
 // Add assignment, opened: the course's categories as paper tags (one is always chosen), the points, an optional name, then
 // Add and ×. The module and the room draw the same row. Nothing here is sent anywhere: it is kept on this device.
 function addRow(vm,where){
  const a=vm.add;if(!a)return '';const course=vm.course.id;
  const tags=a.groups.map((g,i)=>`<button type="button" class="gi-cat" role="radio" aria-checked="${g.on}" tabindex="${g.on?0:-1}" data-gi-action="add-cat" data-gi-course="${course}" data-gi-group="${g.id}" aria-label="${g.label}" style="--gi-tilt:${[-1.2,.8,-.6,1.1,-1,.5][i%6]}deg">${chip(10+i%4)}<span aria-hidden="true">${g.name}${g.weight?` <small>${g.weight}</small>`:''}</span></button>`).join('');
  return `<div class="gi-addrow" data-rd-key="gi-addrow-${where}" data-gi-add-form="${course}" role="group" aria-label="Add assignment"><div class="gi-cats" role="radiogroup" aria-label="Category">${tags}</div>`+
   `<label class="gi-field gi-field-pts"><input type="text" inputmode="decimal" data-gi-draft="points" value="${a.points}" maxlength="8" aria-label="Points" autocomplete="off" spellcheck="false">${icon('line')}<span aria-hidden="true">pts</span></label>`+
   `<label class="gi-field gi-field-name"><input type="text" data-gi-draft="name" value="${a.name}" placeholder="${a.placeholder}" maxlength="60" aria-label="Name" autocomplete="off">${icon('line')}</label>`+
   `<button type="button" class="gi-act gi-add-ok" data-gi-action="add-ok" data-gi-course="${course}">${icon('tick')}<span>Add</span></button><button type="button" class="gi-act gi-add-x" data-gi-action="add-cancel" data-gi-course="${course}" aria-label="Cancel">${icon('cross')}</button></div>`;
 }
 const addButton=(vm,cls='')=>vm.canAdd&&!vm.add?`<button type="button" class="gi-act gi-add${cls}" data-rd-key="gi-add-btn" data-gi-action="add" data-gi-course="${vm.course.id}">${icon('add')}<span>Add assignment</span></button>`:'';
 function usable(c,loader){return featureOn(c)&&typeof loader?.get==='function'&&loader.owner===id(c?.user?.id);}
 // The Grades page: one course opened there is the weighing room; all courses is a compact list of bars.
 function render(c,h,loader){
  if(!usable(c,loader)||c.workspace!=='grades')return '';
  // A course Canvas's numbers cannot be weighed for (grading periods, hidden by Canvas, no Canvas grade, a mismatch, a
  // failed read) is not a room: '' lets the Grades page show that course's grade, period and scored work as before.
  if(c.state?.courseId!=='all'){const course=visible(c).find(course=>String(course.id)===String(c.state?.courseId));if(!course)return '';
   if(c.s?.showGrades===true){const vm=view(c,h,loader,course,'room');if(vm.status&&vm.state!=='loading')return '';}
   loader.remember?.(c,h,course);return renderRoom(c,h,loader,course);}
  if(c.s?.showGrades!==true||!active(c))return '';
  return compact(c,h,loader);
 }
 function renderRoom(c,h,loader,course){
  const {E}=h,A=art(),vm=view(c,h,loader,course,'room'),size=loader.size?.('room')||{};
  vm.W=size.w||1200;vm.H=size.h||820;
  // Add assignment stands with the room's other paper controls, on the wall beside Fold; opened, its row is a slip pinned
  // under them (the drawing under it is left as it is).
  const tools=`${vm.hidden?`<button type="button" class="gi-show" data-rd-action="grades-visibility">${chip(2)}Show grades</button>`:''}${vm.state==='ready'?addButton(vm,' gi-add-room'):''}<button type="button" class="gi-fold" data-rd-key="gi-fold" data-gi-action="fold" data-rd-action="course" data-id="all">${chip(3)}Fold<span aria-hidden="true"> ↙</span></button>`;
  const head=`<header class="gi-head" data-rd-key="gi-head"><button type="button" class="gi-back" data-rd-action="course" data-id="all"><span aria-hidden="true">‹ </span>All courses</button><h1 id="gi-room-title" tabindex="-1">${vm.title}</h1><p class="gi-grade">${vm.hidden?'Grades are hidden':vm.grade}</p><div class="gi-head-tools">${tools}</div>${vm.add?`<div class="gi-room-add" data-rd-key="gi-room-add">${chip(14)}${addRow(vm,'room')}</div>`:''}</header>`;
  const status=vm.status||(!vm.hidden&&vm.state==='ready'&&!vm.rows.length?vm.empty:'');
  const drawing=A?.room?A.room(vm).svg:'';
  // the head comes before the drawing so Tab runs as the eye does: All courses, the title, Fold, then the bands, each
  // weight and its tag (the head is drawn over the wall by position, so the order changes nothing on screen)
  return `<section class="gi gi-room" data-rd-key="gi-room" data-gi-room="${vm.course.id}" data-gi-hidden="${vm.hidden?1:0}" data-gi-revision="${E(String(c.gradeImpactRevision??''))}" aria-labelledby="gi-room-title">${head}${drawing}${status?`<p class="gi-status ch-impact-status" role="status">${chip(4)}${status}</p>`:''}<p class="rd-sr-only" role="status" data-rd-key="gi-say">${vm.need?.say||''}</p></section>`;
 }
 function compact(c,h,loader){
  const {E}=h,A=art(),strips=[],statuses=[],W=620;
  for(const course of visible(c).filter(course=>c.state?.courseId==='all'||String(course.id)===String(c.state?.courseId))){
   const vm=view(c,h,loader,course,'strip');
   if(vm.status){statuses.push(`<p class="rd-grade-note ch-impact-status" role="status">${E(short(course))} · ${vm.status}</p>`);continue;}
   if(!vm.rows.length)continue;
   vm.W=W;vm.size='l';
   // Controls carry a name of their own; the course they are for is read out as a description (the course rail's way).
   strips.push(`<article class="gi gi-strip" data-rd-key="gi-strip-${vm.course.id}"><header class="gi-strip-head"><button type="button" class="gi-strip-open" data-gi-action="open" data-gi-open="${vm.course.id}" data-rd-action="course" data-id="${vm.course.id}" aria-label="Open grade impact" aria-describedby="gi-strip-name-${vm.course.id}"><span id="gi-strip-name-${vm.course.id}" aria-hidden="true">${vm.title}</span>${EXPAND}</button><span class="gi-strip-grade">${vm.grade}</span>${vm.whatIf?`<button type="button" class="gi-pill" data-gi-action="clear" data-gi-course="${vm.course.id}" aria-label="Clear what-ifs">${chip(5)}<span aria-hidden="true">${vm.whatIf.count} what-if${vm.whatIf.count===1?'':'s'} </span><span aria-hidden="true">×</span></button>`:''}</header>${A?.strip?A.strip(vm):''}</article>`);
  }
  return `<section class="rd-grade-sheet ch-impact" aria-labelledby="ch-grade-impact"><div class="rd-sheet-heading"><h2 id="ch-grade-impact">Coming up</h2><span>next ${DAYS} days</span></div><div class="gi-strips ch-impact-list">${strips.join('')}</div>${statuses.join('')}${!strips.length&&!statuses.length?'<p class="rd-grade-note ch-impact-status">No upcoming graded work</p>':''}</section>`;
 }
 // The Home module, answer first: the course and its grade; one sentence, the most useful for the course now; the ruler
 // with its bands and pins; a row per coming graded assignment with its slider (2, 4 or 6 by size); Add assignment and
 // Clear. Hidden grades: names, days and categories only.
 function renderModule(c,h,loader){
  const {E}=h;if(!featureOn(c))return '';
  if(typeof loader?.get!=='function'||loader.owner!==id(c?.user?.id))return '<p class="rd-widget-empty">Grade impact is unavailable here.</p>';
  const list=visible(c),course=loader.moduleCourse?.(c);if(!course)return '<p class="rd-widget-empty">No courses to weigh.</p>';
  const size=['s','m','l'].includes(c.s?.moduleSize?.impact)?c.s.moduleSize.impact:'m',
    vm=view(c,h,loader,course,'module',size),
    index=list.findIndex(x=>String(x.id)===String(course.id));
  loader.rememberModule?.(c,h);vm.W=loader.size?.('module',size)?.w||({s:260,m:420,l:640}[size]);
  const pager=list.length>1?`<span class="gi-pager"><button type="button" class="gi-pg" data-gi-action="page" data-gi-step="-1" aria-label="Previous course">‹</button><span>${index+1} / ${list.length}</span><button type="button" class="gi-pg" data-gi-action="page" data-gi-step="1" aria-label="Next course">›</button></span>`:'';
  const top=`<div class="gi-mod-top"><span class="gi-mod-course" id="gi-mod-course">${vm.title}</span>${vm.hidden?'':vm.grade?`<span class="gi-mod-grade">${vm.grade}</span>`:''}${pager}</div>`;
  const answer=vm.answer?`<p class="gi-ans" data-rd-key="gi-ans" data-gi-ans="${vm.answer.kind}"><span class="gi-ans-t">${vm.answer.html}</span></p>`:'';
  const drawing=vm.state==='ready'||vm.hidden?art()?.module?.(vm)||'':'';
  const acts=vm.state==='ready'?`${addButton(vm)}${vm.clear?`<button type="button" class="gi-act gi-clear" data-rd-key="gi-clear-btn" data-gi-action="clear" data-gi-course="${vm.course.id}">${icon('eraser')}<span>Clear</span></button>`:''}`:'';
  const foot=`${acts}${vm.hidden?`<button type="button" class="gi-show" data-rd-action="grades-visibility">${chip(2)}Show grades</button>`:''}${vm.status?`<p class="gi-mod-status ch-impact-status" role="status">${chip(4)}${vm.status}</p>`:''}`;
  return `<div class="gi gi-mod" data-rd-key="gi-mod" data-gi-size="${size}" data-gi-course="${vm.course.id}">${top}${answer}${drawing}${vm.add?addRow(vm,'mod'):''}${foot?`<div class="gi-mod-foot">${foot}</div>`:''}<p class="rd-sr-only" role="status" data-rd-key="gi-say">${vm.answer?.say||''}</p></div>`;
 }
 // The module's corner control: it grows the module into the room for its course.
 function moduleOpener(c,h,loader){
  if(!featureOn(c)||typeof loader?.moduleCourse!=='function')return '';const course=loader.moduleCourse(c);if(!course)return '';
  return `<button type="button" class="rd-text-button gi-open" data-gi-action="open" data-gi-open="${h.E(String(course.id))}" data-rd-action="workspace" data-tab="grades" aria-label="Open grade impact" aria-describedby="gi-mod-course">${EXPAND}</button>`;
 }
 // Up next and the reader: a small weight in its own lane, only once a verified model for that course is at hand.
 function door(c,item,h,loader=c?.gradeImpact){
  if(!item||typeof loader?.peek!=='function')return '';const m=loader.peek(item.courseId,c);if(!m)return '';
  const u=m.upcoming.find(row=>row.id===String(item.id)),imp=u&&m.impact(u);if(!imp||imp.swing<.05)return '';
  const course=visible(c).find(course=>String(course.id)===String(item.courseId));
  return `<span class="gi gi-door" role="img" aria-label="${h.E(`Moves ${short(course)} ${fmt(imp.swing)}`)}">${art()?.mini?.(30+12*Math.sqrt(imp.swing))||''}</span>`;
 }
 const moduleAvailable=()=>!root.ReserveFeatures||root.ReserveFeatures.enabled('grade-impact')&&root.ReserveFeatures.enabled('grades');
 const api={DAYS,REASONS,BANDS,PRETEND_MAX,model,rows,trusted,create,render,renderModule,moduleOpener,door,needFor,cleanPretend,moduleAvailable};
 root.ReserveGradeImpact=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
