/* Canvas Harness agent: bounded account-local snapshots and read-only source access. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAgentData=api;
})(globalThis,function(root){
 'use strict';
 // Google Docs, Slides and Sheets the source links, for Help to read or ask the student to paste.
 const googleLinks=html=>{const G=root.CanvasHarnessGoogleDocs||(typeof require==='function'?require('./google-docs.js'):null);return G?G.links(html):[];};
 const LIMIT=60000,
   READ_LIMIT=12000,
   TEXT_READ_LIMIT=40000,
   TEXT_BODY_LIMIT=36000,
   MAX_BYTES=2*1024*1024,
   school={origin:''},
   ORIGIN=()=>school.origin||(globalThis.ReserveSite?.origin?.()||'https://school.instructure.com'),
   knownOrigin=o=>{if(typeof o==='string'&&globalThis.ReserveSite?.supported?.(o)){school.origin=new URL(o).origin;return true;}return false;},
   ID=/^[\w:.-]{1,80}$/,
   KINDS=root.CanvasHarnessStudyKind||(typeof require==='function'?require('./study-kind.js'):null);
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{},
   array=v=>Array.isArray(v)?v:[],
   str=(v,n=240)=>typeof v==='string'?v.slice(0,n).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,''):'',
   num=v=>typeof v==='number'&&Number.isFinite(v)?v:null,
   own=(v,k)=>Object.hasOwn(object(v),k);
 // equations, image descriptions, embedded videos or documents and table cells keep their meaning as text
 function meaning(html){
   const attr=(tag,name)=>{
     const m=new RegExp('\\b'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')','i').exec(tag);
     return m?(m[1]??m[2]??'').trim():'';
   },url=v=>{try{const u=new URL(v.replace(/&amp;/g,'&'),'https://invalid.invalid');return u.protocol==='https:'&&u.hostname!=='invalid.invalid'?u.origin+u.pathname:'';}catch{return '';}};
   return String(html).replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi,(tag,body)=>{
     const href=url(attr(tag.slice(0,tag.indexOf('>')+1),'href'));
     return body+(href?' ('+href+')':'');
   }).replace(/<img\b[^>]*>/gi,tag=>{
     const eq=attr(tag,'data-equation-content')||(/\bequation_image\b/.test(attr(tag,'class'))?attr(tag,'alt').replace(/^LaTeX:\s*/i,''):'');
     if(eq)return ' \\('+eq+'\\) ';
     const alt=attr(tag,'alt');
     return alt?' [Image: '+alt+'] ':'';
   }).replace(/<iframe\b[^>]*>/gi,tag=>{
     const src=url(attr(tag,'src')),title=attr(tag,'title');
     return src?' [Embedded: '+(title?title+' ':'')+src+'] ':'';
   }).replace(/<\/t[dh]>\s*(?=<t[dh]\b)/gi,' | ');
 }
 function plain(v,n=60000){
   return contextText().sanitizeURLs(meaning(str(v,600000)).replace(/<(script|style|iframe|object|form)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<\/?(?:p|div|li|h[1-6]|br|tr|section)\b[^>]*>/gi,'\n').replace(
     /<[^>]*>/g,
     '').replace(
     /&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x([0-9a-f]{1,6})|(\d{1,7}));/gi,
     (m,h,d)=>{
     if(h||d){const c=parseInt(h||d,h?16:10);return c>0&&c<=0x10ffff&&!(c>=0xd800&&c<=0xdfff)?String.fromCodePoint(c):'';}
     return {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[m.toLowerCase()]||m;
   }).replace(/[\t ]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim().slice(0,n));
 }
 const contextText=()=>root.CanvasHarnessContext||(typeof require==='function'?require('./ai-context.js'):null),
   ungraded=v=>contextText().withoutScores(plain(v)).replace(/\[score removed\][.!?;]?/g,'').replace(/\s+/g,' ').trim();
 const canvasId=v=>typeof v==='string'||typeof v==='number'?(/^\d+$/.test(String(v))?String(v):''):'',inCourse=(v,cid)=>{
   const o=object(v);
   return (o.course_id==null||String(o.course_id)===cid)&&(o.courseId==null||String(o.courseId)===cid)&&(!o.context_code||o.context_code==='course_'+cid);
 },staffRole=v=>/^(?:TeacherEnrollment|TaEnrollment|teacher|ta|teaching_assistant)$/i.test(String(v||''));
 function authorId(value){
   const v=object(value),ids=[v.author_id,v.user_id,v.author?.id,v.user?.id].filter(v=>v!=null).map(canvasId);
   return ids.length&&ids.every(id=>id&&id===ids[0])?ids[0]:'';
 }
 function enrollmentStaff(value,cid){
   const v=object(value),state=String(v.enrollment_state||v.workflow_state||'');
   return inCourse(v,cid)&&!blocked(v)&&!/^(?:deleted|inactive|rejected|invited|creation_pending)$/i.test(state)&&staffRole(v.type||v.role);
 }
 function courseStaff(context,cid){
   const ids=new Set();
   for(const c of [...array(context?.courses),...array(context?.agentCourses)])
     if(String(c?.id)===cid){
       for(const t of array(c?.teachers)){const id=canvasId(t?.id);if(id&&inCourse(t,cid)&&!blocked(t))ids.add(id);}
       for(const e of array(c?.enrollments)){const id=canvasId(e?.user_id??e?.user?.id);if(id&&enrollmentStaff(e,cid))ids.add(id);}
     }
   for(const row of array(context?.agentCourseStaff))if(String(row?.courseId)===cid)for(const id of array(row.teacherIds).map(canvasId))if(id)ids.add(id);
   return ids;
 }
 function teacher(value,cid,ids){
   const v=object(value),id=authorId(v),author=object(v.author);
   if(!id||!inCourse(v,cid)||!inCourse(author,cid)||v.author_is_student===true||[author.role,author.type,v.author_role].some(v=>/^(?:student|StudentEnrollment)$/i.test(String(v||''))))return false;
   if(ids.has(id))return true;
   return array(author.enrollments).some(e=>(e?.course_id!=null||e?.courseId!=null)&&enrollmentStaff(e,cid)&&(e?.user_id==null||String(e.user_id)===id));
 }
 async function loadCourseStaff({client,user,courses=[],signal}={}){
   const allowed=new Set(array(courses).map(c=>canvasId(c?.id)).filter(Boolean)),account=canvasId(user?.id);
   if(signal?.aborted)throw Object.assign(Error('Read cancelled.'),{code:'cancelled'});
   if(!allowed.size||!account||typeof client?.list!=='function'||typeof client?.profile!=='function')return [];
   if(client.origin&&!knownOrigin(client.origin))throw Error('forbidden');
   async function verify(){
     if(signal?.aborted)throw Object.assign(Error('Read cancelled.'),{code:'cancelled'});
     const current=await client.profile({signal});
     if(signal?.aborted)throw Object.assign(Error('Read cancelled.'),{code:'cancelled'});
     if(canvasId(current?.id)!==account)throw Object.assign(Error('Your Canvas account changed.'),{code:'account'});
   }
   await verify();
   let rows=[];
   try{
     rows=await client.list('/api/v1/courses?enrollment_state=active&enrollment_type=student&include[]=teachers&per_page=100',{signal});
   }catch(error){if(signal?.aborted||/^(?:auth|account|aborted|cancelled)$/.test(String(error?.code||error?.message||'')))throw error;}
   await verify();
   return array(rows).filter(c=>allowed.has(canvasId(c?.id))).map(c=>
     ({courseId:String(c.id),teacherIds:[...courseStaff({courses:[c]},String(c.id))].sort()})).sort((a,b)=>
     a.courseId.localeCompare(b.courseId));
 }
 function hash(v){
   let a=2166136261,b=3339675911;
   for(const c of String(v)){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),2246822519);}
   return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
 }
 const part=v=>/^[\w.-]{1,28}$/.test(String(v))?String(v):'h-'+hash(v),sourceId=(what,course,id)=>what+':'+part(course)+':'+part(id),blocked=v=>{
   const o=object(v);
   return o.locked===true||
     o.locked_for_user===true||
     o.hidden===true||
     o.hidden_for_user===true||
     o.published===false||
     o.user_can_see_posts===false&&o.require_initial_post!==true||
     o.workflow_state==='deleted'||
     o.workflow_state==='unpublished';
 },
   // Hidden in Files but not locked: a student can still open it from a link the teacher put in an assignment.
   softHidden=v=>{
     const o=object(v);
     return (o.hidden===true||o.hidden_for_user===true)&&o.locked!==true&&o.locked_for_user!==true&&o.published!==false&&!['deleted','unpublished'].includes(o.workflow_state);
   };
 const ms=v=>v==null||v===''?NaN:typeof v==='number'?v:Date.parse(v),date=v=>Number.isFinite(ms(v))?new Date(ms(v)).toISOString():null,addDays=(v,n)=>{
   const d=new Date(v+'T12:00:00Z');
   d.setUTCDate(d.getUTCDate()+n);
   return d.toISOString().slice(0,10);
 };
 function calendar(timeZone){
   let formatter;
   try{
     formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
   }catch{timeZone='America/New_York';formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});}
   return {timeZone,parts(value){
     if(!Number.isFinite(ms(value)))return null;
     const p=Object.fromEntries(formatter.formatToParts(ms(value)).map(x=>[x.type,x.value]));
     return {day:p.year+'-'+p.month+'-'+p.day,hour:Number(p.hour)};
   }};
 }
 function pageSelection(value){
   if(value==null)return null;
   let pages;
   if(typeof value==='string'&&/^\d{1,9}(?:-\d{1,9})?$/.test(value)){
     const [a,b=a]=value.split('-').map(Number);
     if(a<1||b<a||b-a>=20)throw Error('Choose 1-20 valid PDF pages.');
     pages=Array.from({length:b-a+1},(_,i)=>a+i);
   }
   else if(Array.isArray(value)&&value.length&&value.length<=20)pages=value.slice();else throw Error('Choose 1-20 valid PDF pages.');
   if(pages.some(p=>!Number.isSafeInteger(p)||p<1)||new Set(pages).size!==pages.length)throw Error('Choose 1-20 valid PDF pages.');
   return pages.sort((a,b)=>a-b);
 }
 function rubric(value,max=100){
   return array(value).slice(0,max).map(r=>
     ({
       title:plain(r?.description||r?.title,160),
       description:plain(r?.long_description,400),
       points:num(r?.points),
       ...(r?.learning_outcome_id!=null?{learningOutcomeId:r.learning_outcome_id}:{}),
       ...(r?.learning_outcome?.title||r?.outcome?.title?{outcomeName:plain(r.learning_outcome?.title||r.outcome?.title,180)}:{}),
       ...(num(r?.mastery_points??r?.learning_outcome?.mastery_points)!=null?{masteryPoints:num(r.mastery_points??r.learning_outcome?.mastery_points)}:{}),
       levels:array(r?.ratings).slice(0,6).map(x=>({text:plain(x?.description||x?.long_description,180),points:num(x?.points)}))
     }));
 }
 function comments(item,self,grades,ids){
   const s=object(item?.submission),account=canvasId(self),cid=String(item?.courseId??'');
   if(!account||s.user_id!=null&&String(s.user_id)!==account)return [];
   return array(s.submission_comments).filter(c=>authorId(c)!==account&&teacher(c,cid,ids)).map(c=>{
     const text=(grades?plain(c.comment):ungraded(c.comment)).slice(0,1200),
       createdAt=date(c.created_at),
       attachment=array(c.attachments).length>0||!!c.media_comment,
       key=String(c.id??hash([authorId(c),createdAt,text,attachment].join('|')));
     return {key,text,createdAt,attachment};
   }).filter(c=>c.text||c.attachment);
 }
 function focusSummary(data,clock,today,now){
   const f=object(data.focus),
     pet=object(data.pet),
     agent=object(data.toolbox?.agent),
     records=[
       ...array(data.activity),
       ...array(f.activity),
       ...array(f.records),
       ...array(f.history),
       ...array(pet.activity),
       ...array(pet.brain?.activity),
       ...array(agent.focusHistory)
     ],
     weekday=new Date(today+'T12:00:00Z').getUTCDay(),
     weekStart=addDays(today,-((weekday+6)%7)),
     histStart=addDays(today,-35),
     seen=new Set(),
     hours=new Map();
   let weeklyMinutes=0,known=false,activityKnown=false;
  if(Number.isFinite(f.completedAt)&&Number.isFinite(f.completedMinutes)&&!records.some(r=>ms(r?.at??r?.completedAt??r?.endedAt)===f.completedAt))
    records.push({kind:'focus',at:f.completedAt,minutes:f.completedMinutes});
  for(const r of records){
    if(!r||typeof r!=='object'||r.kind&&r.kind!=='focus'||r.type&&r.type!=='focus')continue;
    const at=ms(r.at??r.completedAt??r.endedAt??r.startedAt??r.date),
      minutes=num(r.minutes)??(num(r.durationMs)!=null?r.durationMs/60000:num(r.seconds)!=null?r.seconds/60:null),
      p=clock.parts(at),
      key=String(r.id??[at,minutes,r.itemId??''].join('|'));
    if(!p||at>now||minutes==null||minutes<=0||minutes>1440||seen.has(key))continue;
    seen.add(key);
    known=true;
    if(p.day>=weekStart&&p.day<=today)weeklyMinutes+=minutes;
    if(p.day>=histStart&&p.day<=today)hours.set(p.hour,(hours.get(p.hour)||0)+minutes);
  }
  const visits=new Set();
  for(const value of array(agent.activity)){
    const at=ms(typeof value==='number'?value:value?.at),p=clock.parts(at);
    if(!p||at>now||p.day<histStart||p.day>today||visits.has(at))continue;
    visits.add(at);
    activityKnown=true;
    hours.set(p.hour,(hours.get(p.hour)||0)+1);
  }
  return {
    weeklyMinutes:known?Math.round(weeklyMinutes*10)/10:null,
    weekStart,
    usualHours:[...hours].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4).map(x=>x[0]),
    activityKnown:known||activityKnown,
    running:!!f.endsAt&&f.endsAt>now,
    minutes:num(f.minutes),
    sessions:Number.isSafeInteger(f.sessions)?Math.max(0,f.sessions):0
  };
 }
 function actionSummary(value){
   const a=object(value),out={};
   for(const [key,max]of Object.entries({
     tool:32,
     itemId:80,
     title:160,
     text:400,
     kind:24,
     focus:240,
     why:240,
     at:32,
     day:10,
     fileId:80,
     quote:300,
     color:16,
     note:200,
     aidKey:200,
     question:240,
     fact:140,
     about:80,
     until:10
   }))
     if(typeof a[key]==='string')out[key]=str(a[key],max);
   for(const key of ['minutes','page'])if(Number.isFinite(a[key]))out[key]=a[key];
   for(const key of ['sources','order','show','hide','wide','choices'])
     if(Array.isArray(a[key]))out[key]=a[key].filter(v=>typeof v==='string').slice(0,key==='choices'?3:12).map(v=>str(v,key==='choices'?120:80));
   if(Array.isArray(a.items))
     out.items=a.items.slice(0,5).map(i=>({...(typeof i?.itemId==='string'?{itemId:str(i.itemId,80)}:{}),title:str(i?.title,160),why:str(i?.why,160),next:str(i?.next,160)}));
   return out;
 }
 function lastRun(runs){
   const r=array(runs).map((v,i)=>({v,i,at:ms(v?.at??v?.startedAt??v?.createdAt)})).sort((a,b)=>
     (Number.isFinite(b.at)?b.at:0)-(Number.isFinite(a.at)?a.at:0)||a.i-b.i)[0]?.v;
   if(!r)return null;
   const rows=array(r.actions).length?r.actions:array(r.results),
     answers=Array.isArray(r.answers)?r.answers:Object.entries(object(r.answers)).map(([question,answer])=>({question,answer}));
   return {
     id:str(r.id,80),
     at:date(r.at??r.startedAt??r.createdAt),
     actions:rows.slice(-40).map(row=>
       ({
         id:str(row?.id,80),
         action:actionSummary(row?.action||row),
         why:str(row?.why||row?.action?.why,240),
         outcome:str(row?.outcome||row?.status,80),
         ...(typeof row?.error==='string'?{error:str(row.error,160)}:{})
       })),
     answers:answers.slice(-12).map(a=>({actionId:str(a?.actionId,80),question:str(a?.question||a?.text,240),answer:str(a?.answer||a?.response,500)}))
   };
 }
 // long instructions keep their ending too: requirements (citation style, length, how to hand in) often come last
 const NEEDS={must_view:'view it',must_submit:'hand it in',must_contribute:'take part',must_mark_done:'mark it done'},needsOf=rule=>{
   const r=rule&&typeof rule==='object'?rule:{};
   return r.type==='min_score'?'score at least '+String(r.min_score).slice(0,8):NEEDS[r.type]||'';
 };
 const headTail=(text,max)=>(root.ReserveCore||(typeof require==='function'?require('./core.js'):null)).smartCut(text,max);
 // how the work is handed in, only the facts that are present
 function handIn(item,date){
   const o=object(item),out={};/* Effective assignment dates already include student overrides. */
   if(o.quiz)for(const [key,value]of Object.entries(o.quiz))if(!['dueAt','unlockAt','lockAt','opensAt','closesAt'].includes(key))out[key]=value;
   if(o.gradingType)out.gradingType=o.gradingType;
   if(o.assignmentGroupId)out.assignmentGroupId=o.assignmentGroupId;
   if(o.assignmentGroup)out.assignmentGroup={...o.assignmentGroup};
   if(o.optionalForGrade)out.optionalForGrade=true;
   if(Number.isInteger(o.replyToEntryRequiredCount))out.replyToEntryRequiredCount=o.replyToEntryRequiredCount;
   if(typeof o.requireInitialPost==='boolean')out.requireInitialPost=o.requireInitialPost;
   if(typeof o.userCanSeePosts==='boolean')out.userCanSeePosts=o.userCanSeePosts;
   if(array(o.checkpoints).length)out.checkpoints=o.checkpoints.map(c=>({...c}));
   if(o.unlockAt)out.opensAt=date(o.unlockAt);
   if(o.lockAt)out.closesAt=date(o.lockAt);
   if(Number.isInteger(o.allowedAttempts))out.attempts=o.allowedAttempts;
   if(Number.isInteger(o.attemptsUsed)&&o.attemptsUsed>0)out.attemptsUsed=o.attemptsUsed;
   if(o.groupWork===true)out.group=true;
   if(o.groupCategoryId)out.groupCategoryId=o.groupCategoryId;
   if(o.groupWork)out.gradeGroupStudentsIndividually=o.gradeGroupStudentsIndividually===true;
   if(o.myGroup)out.myGroup={...o.myGroup};
   if(o.peerReviews===true){out.peerReviews=true;if(o.peerReviewsAt)out.peerReviewsAt=date(o.peerReviewsAt);}
   if(array(o.allowedExtensions).length)out.fileTypes=array(o.allowedExtensions).slice(0,12).map(x=>String(x).slice(0,12));
   if(typeof o.externalTool==='string'&&o.externalTool)out.tool=o.externalTool.slice(0,80);
   if(o.missing===true)out.missing=true;
   if(o.late===true)out.late=true;
   if(o.redoRequested===true)out.resubmit=true;
   if(o.optional===true)out.optional=true;
   if(o.unlockAt&&o.lockAt&&ms(o.unlockAt)>ms(o.lockAt)||o.unlockAt&&o.dueAt&&ms(o.unlockAt)>ms(o.dueAt)||o.lockAt&&o.dueAt&&ms(o.lockAt)<ms(o.dueAt))
     out.availabilityNote='Availability conflict: opening, due and closing times disagree; confirm with the teacher.';
   if(o.locked===true&&o.lockExplanation)out.lockedBecause=String(o.lockExplanation).slice(0,300);
   return out;
 }
 function build({context={},data={},aids={},memory=[],runs=[],baseline={},modules=[],now=Date.now(),grades=false,question=''}={}){
  context=object(context);
  data=object(data);
  baseline=object(baseline);
  now=Number.isFinite(ms(now))?ms(now):Date.now();
  grades=grades===true&&context.s?.showGrades!==false&&context.showGrades!==false&&data.settings?.showGrades!==false;
  // Teacher comments (and files attached to them) reach the AI only while the Teacher feedback switch is on.
  const feedbackOn=object(data.toolbox).aiTeacherFeedback===true;
  const privacy=contextText().privacyContext(context),
    clock=calendar(data.settings?.timeZone||context.s?.timeZone||'America/New_York'),
    today=clock.parts(now).day,
    until=addDays(today,14),
    catalog=new Map(),
    resources=new Map(),
    pageIds=new Map(),
    staff=new Map(),
    staffFor=cid=>{
    if(!staff.has(cid))staff.set(cid,courseStaff(context,cid));
    return staff.get(cid);
  },tasks=object(data.tasks),byOriginal=new Map(),incoming={v:1,assignments:{},announcements:{},files:{}},changes=[];
  function put(what,cid,canvasId,raw={},item=null,slug=null,expose=true){
    cid=String(cid??'');
    canvasId=String(canvasId??'');
    if(!/^\d+$/.test(cid)||!canvasId)return null;
    const prefix=what==='pdf'?'file':what,key=what==='page'&&slug&&!/^\d+$/.test(canvasId)?'s-'+hash(slug):canvasId,id=sourceId(prefix,cid,key);
    if(what==='page'&&slug&&pageIds.has(cid+'|'+slug))return catalog.get(pageIds.get(cid+'|'+slug));
    let meta=catalog.get(id);
    if(!meta){
      const title=plain(raw.title||raw.name||raw.display_name||raw.filename||item?.name||what,180),
        url=ORIGIN()+
          '/courses/'+
          cid+
          '/'+
          ({assignment:'assignments',pdf:'files',page:'pages',discussion:'discussion_topics',announcement:'discussion_topics',module:'modules'}[what])+
          '/'+
          encodeURIComponent(what==='page'?slug||canvasId:canvasId);
      meta={
        id,
        what,
        courseId:cid,
        canvasId,
        title,
        url,
        raw,
        teacherIds:[...staffFor(cid)],
        gradeAccess:grades,
        privacy,
        timeZone:clock.timeZone,
        ...(item?{item}:{}),
        ...(slug?{slug}:{}),
        ...(blocked(raw)||blocked(item)?{locked:true,...(softHidden(raw)&&!blocked(item)?{hiddenOnly:true}:{})}:{})
      };
      catalog.set(id,meta);
    }
    else if(blocked(raw)||blocked(item)){
      const soft=(meta.locked?meta.hiddenOnly===true:true)&&softHidden(raw)&&!blocked(item);
      if(soft)meta.hiddenOnly=true;else delete meta.hiddenOnly;
      meta.locked=true;
      const row=resources.get(id);
      if(row){row.locked=true;delete row.text;delete row.items;}
    }
    {
      const better=plain(raw.title||raw.display_name||raw.filename||'',180);
      if(meta.title==='Linked document'&&better&&better!=='Linked document'){meta.title=better;const row=resources.get(id);if(row)row.title=better;}
    }
    if(what==='page'&&slug)pageIds.set(cid+'|'+slug,id);
    if(expose&&!resources.has(id)){
      const row={
        id,
        what,
        title:meta.title,
        courseId:cid,
        ...(date(raw.posted_at||raw.created_at)?{postedAt:date(raw.posted_at||raw.created_at)}:{}),
        ...(date(raw.updated_at)?{updatedAt:date(raw.updated_at)}:{}),
        ...(meta.locked?{locked:true}:{}),
        ...(what==='pdf'?{mime:str(raw.content_type||raw['content-type'],100),size:num(raw.size)}:{})
      },
        body=raw.body||raw.message;
      if(body&&!meta.locked)row.text=(grades||!['discussion','announcement'].includes(what)?plain(body):ungraded(body)).slice(0,1200);
      resources.set(id,row);
    }
    return meta;
  }
  function file(cid,raw){
    const m=put('pdf',cid,raw?.id,raw);
    const row=m&&resources.get(m.id);
    if(row){if(raw?.folder_id!=null)row.folderId=String(raw.folder_id);if(raw?.folderPath)row.folderPath=plain(raw.folderPath,300);}
    if(m&&!m.locked){
      incoming.files[m.id]=hash(JSON.stringify([m.title,raw?.size??null,raw?.updated_at||raw?.modified_at||'',raw?.content_type||raw?.['content-type']||'',raw?.md5||'']));
      const previous=object(baseline.files);
      if(previous[m.id]!==incoming.files[m.id])changes.push({kind:own(previous,m.id)?'file_changed':'file_new',id:m.id,title:m.title,courseId:m.courseId});
    }
    return m;
  }
  for(const group of array(context.aiResources)){
    const cid=String(group?.courseId??'');
    for(const f of array(group?.files))file(cid,f);
    for(const p of [...array(group?.pages),...(group?.frontPage?[group.frontPage]:[])]){
      const meta=put('page',cid,p?.page_id??p?.id??p?.url,p,null,typeof p?.url==='string'?p.url:String(p?.page_id??p?.id??''));
      if(meta&&(p===group.frontPage||p?.front_page===true))meta.home=true;
    }
    if(typeof group?.syllabusBody==='string'&&group.syllabusBody.trim())
      put('page',cid,'syllabus',{title:'Course syllabus'},{name:'Course syllabus',description:group.syllabusBody,syllabus:true},'syllabus');
    for(const m of array(group?.modules)){
      const meta=put('module',cid,m?.id,m);
      if(!meta||meta.locked)continue;
      const rows=[];
      for(const child of array(m?.items)){
        if(blocked(child))continue;
        const type=String(child?.type||'').toLowerCase();
        let source=null;
        if(type==='file')source=put('pdf',cid,child.content_id,{id:child.content_id,title:child.title});
        if(type==='page'&&child.page_url)source=put('page',cid,child.content_id||child.page_url,{title:child.title},null,String(child.page_url));
        if(type==='discussion')source=put('discussion',cid,child.content_id,{title:child.title});
        const rule=object(child?.completion_requirement),needs=needsOf(rule);
        rows.push({
          title:plain(child?.title,120),
          type:str(child?.type,40),
          ...(needs?{needs}:{}),
          ...(rule.completed===true?{completed:true}:{}),
          ...(source?{id:source.id}:{})
        });
      }
      const entry=resources.get(meta.id);
      if(rows.length)entry.items=rows.slice(0,60);
      if(m?.unlock_at)entry.opensAt=str(m.unlock_at,40);
      if(m?.require_sequential_progress===true)entry.inOrder=true;
      if(array(m?.prerequisite_module_ids).length)entry.after=array(m.prerequisite_module_ids).slice(0,8).map(x=>str(String(x),20));
      if(typeof m?.state==='string')entry.state=str(m.state,20);
    }
  }
  for(const group of array(context.aiUpdates)){
    const cid=String(group?.courseId??'');
    for(const a of array(group?.announcements)){
      if(!teacher(a,cid,staffFor(cid)))continue;
      const m=put('announcement',cid,a?.id,{...object(a),title:(grades?plain(a?.title):ungraded(a?.title))||'Course announcement'});
      if(!m||m.locked)continue;
      const fingerprint=hash(JSON.stringify([m.title,grades?plain(a.message||a.body):ungraded(a.message||a.body),a.posted_at||a.created_at||'',a.updated_at||'']));
      incoming.announcements[m.id]=fingerprint;
      if(object(baseline.announcements)[m.id]!==fingerprint)
        changes.push({
          kind:'announcement',
          id:m.id,
          title:m.title,
          courseId:cid,
          postedAt:date(a.posted_at||a.created_at),
          updatedAt:date(a.updated_at),
          text:(grades?plain(a.message||a.body):ungraded(a.message||a.body)).slice(0,900)
        });
    }
    for(const d of array(group?.discussions)){
      const allowed=teacher(d,cid,staffFor(cid));
      put('discussion',cid,d?.id,allowed?{...object(d),title:(grades?plain(d?.title):ungraded(d?.title))||'Course discussion'}:{...object(d),title:'Course discussion',body:'',message:''});
    }
  }
  const feedbackRaw=new Map(array(context.agentAssignments).map(a=>[String(a.course_id??a.courseId)+':'+a.id,a])),instructionItems=array(context.items).map(item=>{
    const raw=feedbackRaw.get(String(item.courseId)+':'+item.id);
    return raw?{...item,submission:{user_id:raw.submission?.user_id,submission_comments:raw.submission?.submission_comments||[]}}:item;
  });
  const all=[],seen=new Set();
  for(const item of [...instructionItems,...array(data.customTasks).map(x=>({...object(x),personal:true}))]){
    if(!item||item.id==null)continue;
    const local=item.personal===true||String(item.id).startsWith('local-'),
      cid=String(item.courseId??(local?'personal':'')),
      original=String(item.id),
      id=local?'local:'+part(original):sourceId('assignment',cid,original);
    if(!ID.test(id)||seen.has(id)||!local&&!/^\d+$/.test(cid))continue;
    seen.add(id);
    const mine=object(tasks[id]||tasks[original]),
      title=plain(item.name||item.title,180),
      done=mine.checkedOff===true||mine.progress==='done'||item.done===true||item.state==='done'||item.state==='excused'||!item.missing&&!item.redoRequested&&['submitted','graded'].includes(item.state),
      dueAt=date(item.dueAt),
      facts=KINDS?.classify(item),
      kind=facts?.reading?'reading':facts?.kind==='other'&&facts?.rubric?'project':facts?.kind||str(item.kind,24)||'other';
    let meta;
    if(local){meta={id,what:'assignment',courseId:cid,canvasId:original,item,title,url:'',...(blocked(item)?{locked:true}:{})};catalog.set(id,meta);}
    else meta=put('assignment',cid,original,{title,locked:blocked(item)},item,null,false);
    if(!meta)continue;
    byOriginal.set(cid+':'+original,id);
    const feedback=meta.locked||!feedbackOn?[]:comments(item,context.user?.id,grades,staffFor(cid)),commentHashes={};
    for(const c of feedback){
      commentHashes[part(c.key)]=hash(JSON.stringify([c.text,c.createdAt,c.attachment]));
      if(object(object(baseline.assignments)[id]?.comments)[part(c.key)]!==commentHashes[part(c.key)])
        changes.push({kind:'teacher_comment',id,title,courseId:cid,text:c.text,createdAt:c.createdAt,...(c.attachment?{attachment:true}:{})});
    }
    if(!local){
      incoming.assignments[id]={dueAt,comments:commentHashes};
      const old=object(baseline.assignments)[id];
      if(old&&old.dueAt!==dueAt)changes.push({kind:'due_date',id,title,courseId:cid,from:old.dueAt??null,to:dueAt});
    }
    const row={
      id,
      title,
      courseId:cid,
      dueAt,
      kind,
      points:num(item.points),
      submissionTypes:array(item.submissionTypes).filter(x=>typeof x==='string').slice(0,12).map(x=>str(x,60)),
      instructions:meta.locked?'':headTail(plain(item.description,600000),2000),
      files:[],
      rubric:meta.locked?[]:rubric(item.rubric),
      done,
      ...handIn(item,date),
      ...(meta.locked?{locked:true}:{})
    };
    if(feedback.length)row.teacherComments=feedback.slice(-8).map(c=>({text:c.text,createdAt:c.createdAt,...(c.attachment?{attachment:true}:{})}));
    all.push({row,item,mine,meta});
  }
  function linked(cid,value,title='Linked document'){
    let url;
    try{url=new URL(value,ORIGIN());if(url.origin!==ORIGIN()||url.username||url.password)return null;}catch{return null;}
    let match;
    const work=url.pathname.match(/^\/courses\/(\d+)\/(assignments|discussion_topics|modules)\/(\d+)\/?$/);
    if(work&&work[1]===cid){const what={assignments:'assignment',discussion_topics:'discussion',modules:'module'}[work[2]];return put(what,cid,work[3],{title},null,null,what!=='assignment');}
    if((match=url.pathname.match(/^\/(?:courses\/(\d+)\/)?files\/(\d+)(?:\/(?:download|preview))?\/?$/))&&(!match[1]||match[1]===cid))return put('pdf',cid,match[2],{title});
    if((match=url.pathname.match(/^\/courses\/(\d+)\/pages\/([^/]+)\/?$/))&&match[1]===cid){try{const slug=decodeURIComponent(match[2]);return put('page',cid,slug,{title},null,slug);}catch{}}
    return null;
  }
  for(const a of all)
    if(!a.meta.locked){
      const links=[];
      for(const match of str(a.item.description,600000).matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]{0,600}?)<\/a>|\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
        if(links.length>=30)break;
        const href=match[1]||match[2]||match[4]||match[5]||'',text=match[3]?plain(match[3],180):'',m=linked(a.meta.courseId,href.replace(/&amp;/g,'&'),text||undefined);
        if(m)links.push(m);
      }
      for(const f of [
        ...array(a.item.attachments),
        ...array(a.item.attachedFiles),
        ...array(feedbackOn&&(a.item.submission?.user_id==null||String(a.item.submission.user_id)===String(context.user?.id))?
          a.item.submission?.submission_comments:
          []).filter(c=>
          teacher(c,a.meta.courseId,staffFor(a.meta.courseId))).flatMap(c=>
          array(c.attachments))
      ]){
        const m=f?.id!=null?put('pdf',a.meta.courseId,f.id,{title:f.display_name||f.filename||f.title}):linked(a.meta.courseId,f?.url,f?.title);
        if(m)links.push(m);
      }
      if(a.item.annotatableAttachmentId){const m=put('pdf',a.meta.courseId,a.item.annotatableAttachmentId,{title:'Document to annotate'});if(m)links.push(m);}
      for(const m of links)if(m.what==='pdf')m.linked=true;
      a.row.files=[...new Set(links.filter(m=>m.what==='pdf').map(m=>m.id))].slice(0,30);
      const pages=[...new Set(links.filter(m=>m.what==='page').map(m=>m.id))];
      if(pages.length)a.row.pages=pages;
      a.meta.files=a.row.files;
      if(pages.length)a.meta.pages=pages;
      const other=links.filter(m=>!['pdf','page'].includes(m.what)).map(m=>m.id);
      if(other.length)a.row.links=[...new Set(other)];
    }
  // missing or resubmission work that can still be handed in, and a few undated items, are part of what to prepare
  // beyond the fortnight: peer reviews still to give, and big work (a project, paper or exam) up to five weeks out
  let undated=0,ahead=0;
  const big=a=>Number(a.item.points)>=50||/\b(?:projects?|papers?|essays?|presentations?|portfolios?|research|exams?|midterms?|finals?)\b/i.test(a.row.title||''),
    open=a=>!a.row.done&&!a.meta.locked&&!(a.item.lockAt&&ms(a.item.lockAt)<now),
    due=v=>Number.isFinite(ms(v))?ms(v):8.64e15;
  const inWindow=a=>{
    const c=array(context.courses).find(c=>String(c.id)===a.meta.courseId);
    if(c&&(c.workflowState==='completed'||c.workflow_state==='completed'||c.enrollmentState==='completed'))
      return false;/* Canvas lists only active enrollments; an ended term alone is not concluded, because course or section dates can keep the course open. */
    if(open(a)&&array(a.item.checkpoints).some(c=>!c.done&&(!c.lockAt||ms(c.lockAt)>=now)&&ms(c.dueAt)<ms(until)))return true;
    const day=typeof a.item.dueAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(a.item.dueAt)?a.item.dueAt:clock.parts(a.row.dueAt)?.day;
    if(open(a)&&(a.item.missing===true||a.item.redoRequested===true))return true;
    if(!day)return open(a)&&!a.row.id.startsWith('local:')&&undated++<8;
    if(day>=today&&day<until)return true;
    const reviews=a.item.peerReviews===true&&a.item.peerReviewsAt?clock.parts(a.item.peerReviewsAt)?.day:'';
    if(reviews&&reviews>=addDays(today,-7)&&reviews<until)return true;
    return open(a)&&day>=until&&day<addDays(today,35)&&big(a);
  },
  items=all.filter(inWindow).sort((a,b)=>due(a.row.dueAt)-due(b.row.dueAt)||a.row.id.localeCompare(b.row.id)).map(a=>a.row),
  upcoming=new Set(items.map(x=>x.id)),
  needed=new Set(),
  resourcePriority=new Map(),
  resourceOwners=new Map(),
  globalNeeded=new Set();
  function expose(id,protect=false,rank=2,owners){
    const meta=catalog.get(id);
    if(!meta)return null;
    if(!upcoming.has(id)&&!resources.has(id))resources.set(id,{id,what:meta.what,title:meta.title,courseId:meta.courseId,...(meta.locked?{locked:true}:{})});
    if(protect){
      if(owners){let own=resourceOwners.get(id);if(!own){own=new Set();resourceOwners.set(id,own);}for(const owner of typeof owners==='string'?[owners]:owners)own.add(owner);}
      else globalNeeded.add(id);
      needed.add(id);
      resourcePriority.set(id,Math.min(resourcePriority.get(id)??Infinity,rank));
    }
    return meta;
  }
  const planner=[],finished=[],bookmarks=[];
  for(const a of all){
    const {row,mine}=a;
    if(mine.plannedDate||mine.estimate||mine.progress==='in-progress'){
      expose(row.id);
      planner.push({
        itemId:row.id,
        title:row.title,
        day:str(mine.plannedDate,10),
        minutes:num(mine.estimate)||0,
        done:row.done,
        notes:plain(mine.notes,800),
        steps:array(mine.checklist).slice(0,15).map(s=>({text:plain(s?.text,180),done:s?.done===true}))
      });
    }
    if(row.done){expose(row.id);finished.push({id:row.id,title:row.title,courseId:row.courseId});}
    if(mine.pinned){expose(row.id);bookmarks.push({id:row.id,title:row.title,courseId:row.courseId});}
  }
  for(const pin of array(data.resourcePins)){
    const cid=String(pin?.courseId??''),meta=catalog.get(pin?.id)||linked(cid,pin?.url,pin?.title);
    if(meta){expose(meta.id);if(!bookmarks.some(x=>x.id===meta.id))bookmarks.push({id:meta.id,title:meta.title,courseId:meta.courseId});}
  }
  for(const c of changes)expose(c.id);for(const i of items)for(const id of [...array(i.files),...array(i.pages),...array(i.links)])expose(id,true,0,i.id);
  // A readable dependency remains in the catalog even when its own due date is distant.
  const nearGroups=new Set(all.filter(a=>upcoming.has(a.row.id)&&a.item.assignmentGroupId).map(a=>a.meta.courseId+':'+a.item.assignmentGroupId));
  for(const a of all)
    if(a.item.missing||a.item.redoRequested||a.item.assignmentGroupId&&nearGroups.has(a.meta.courseId+':'+a.item.assignmentGroupId))expose(a.row.id,true);
  for(const m of catalog.values()){
    const recent=ms(m.raw?.updated_at||m.raw?.posted_at||m.raw?.created_at)>=now-14*86400000,
      consequential=/\b(?:bring|must|required|due|deadline|moved|changed|correction|cancel|room|venue|calculator|extension|accommodation)\b/i.test(m.raw?.message||m.raw?.body||'');
    if(m.item?.syllabus||m.what==='module'||m.raw?.require_initial_post||m.what==='announcement'&&recent&&consequential)expose(m.id,true,m.what==='module'?5:m.what==='announcement'?3:1);
  }
  let frontier=[...needed,...items.map(i=>i.id)];
  for(let depth=0;depth<3;depth++){
    const next=[];
    for(const id of frontier){
      const m=catalog.get(id);
      if(!m||m.locked)continue;
      const html=m.item?.description||m.raw?.body||m.raw?.message||'';
      for(const match of str(html,600000).matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
        const target=linked(m.courseId,(match[1]||match[2]).replace(/&amp;/g,'&'));
        if(target){expose(target.id,true,(resourcePriority.get(id)??0)+1,globalNeeded.has(id)?undefined:resourceOwners.get(id)||new Set([id]));next.push(target.id);}
      }
      for(const child of array(resources.get(id)?.items))
        if(child.id){expose(child.id,true,(resourcePriority.get(id)??0)+1,globalNeeded.has(id)?undefined:resourceOwners.get(id)||new Set([id]));next.push(child.id);}
    }
    frontier=next;
  }
  // The student's own aids first (the newest 40: practice sets with their misses and reviews), then the newest few Help
  // cards in any room left; Help cards are the AI's own output and are kept for 30 days, so they never crowd these out.
  const helpCard=([key,a])=>a.prepare===true||a.ask===true||/^(?:ask|prepare):/.test(key),at=([,a])=>Number(a.savedAt)||Date.parse(a.savedAt)||0,newest=(x,y)=>at(y)-at(x);
  const eligible=Object.entries(object(aids)).filter(([key,a])=>key!=='$wishes'&&key.length<=200&&a&&typeof a==='object'&&(grades||!a.gradeAccess)),
    ownAids=eligible.filter(e=>!helpCard(e)).sort(newest).slice(0,40),
    helpAids=eligible.filter(helpCard).sort(newest).slice(0,Math.min(8,40-ownAids.length));
  const saved=[...ownAids,...helpAids].sort(([a],[b])=>a.localeCompare(b)).map(([key,a])=>{
    const id=catalog.has(a.itemId)?a.itemId:byOriginal.get(String(a.courseId)+':'+String(a.itemId)),
      answers=object(a.progress?.practice?.answers),
      misses=Object.entries(answers).filter(([,v])=>v?.correct===false).slice(0,12).map(([n,v])=>{
      const q=array(a.data?.items)[Number(n)];
      return {n:Number(n),question:plain(q?.q||q?.question||q?.prompt,240),why:plain(array(q?.miss)[v?.choice]||q?.why,240)};
    });
    if(id)expose(id);
    return {
      key,
      kind:str(a.kind,30),
      title:plain(a.title,160),
      ...(id?{itemId:id}:{}),
      misses,
      missCount:Object.values(answers).filter(v=>v?.correct===false).length,
      ...(num(a.review?.due)!=null?{reviewAt:a.review.due}:{})
    };
  });
  const validMemory=m=>
    (grades||!m?.gradeAccess)&&
      typeof m?.id==='string'&&
      ID.test(m.id)&&
      typeof m.fact==='string'&&
      (!m.until||typeof m.until==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(m.until)&&date(m.until)?.slice(0,10)===m.until&&m.until>=today),
    previousRun=lastRun(runs);
  if(previousRun)
    for(const entry of previousRun.actions){
      const a=entry.action;
      for(const id of [a.itemId,a.fileId,...array(a.sources),...array(a.items).map(i=>i.itemId)])if(id)expose(id);
    }
  // tests, trips and labs that exist only on a course calendar, inside the planning window
  const courseIds=new Set(array(context.courses).map(c=>canvasId(c?.id)).filter(Boolean)),
    events=array(context.calendarEvents).filter(e=>
      e&&typeof e==='object'&&e.workflow_state!=='deleted'&&/^course_\d+$/.test(String(e.context_code||''))&&courseIds.has(String(e.context_code).slice(7))).map(e=>
      ({e,day:clock.parts(e.start_at)?.day})).filter(x=>
      x.day&&x.day>=today&&x.day<until).sort((a,b)=>
      Number(!!b.e.all_day||
        /away|bus|travel|trip|exam|test|quiz|deadline|concert|break|closure|no.school|revised|moved/i.test(b.e.title))-Number(!!a.e.all_day||/away|bus|travel|trip|exam|test|quiz|deadline|concert|break|closure|no.school|revised|moved/i.test(a.e.title))||
        String(a.e.start_at).localeCompare(String(b.e.start_at))).slice(
      0,
      30).map(({e})=>
      ({
        title:plain(e.title,140),
        courseId:String(e.context_code).slice(7),
        start:str(e.start_at,40),
        ...(e.end_at?{end:str(e.end_at,40)}:{}),
        ...(e.all_day===true?{allDay:true}:{}),
        ...(e.location_name?{where:plain(e.location_name,80)}:{}),
        ...(e.description?{about:headTail(plain(e.description,4000),300)}:{})
      }));
  // Only messages shown to be by the course's teachers or TAs are kept (owner, 4.0 privacy): a classmate's message never
  // reaches the AI, not even with the name taken out.
  const messages=array(context.conversations).filter(c=>c&&c.workflow_state!=='archived').flatMap(c=>{
   const cid=/^course_(\d+)$/.exec(String(c.context_code||''))?.[1];if(!courseIds.has(cid))return [];
   const recent=m=>Number.isFinite(ms(m.created_at))&&now-ms(m.created_at)<=14*86400000,
     project=(m,from)=>
       ({
         subject:plain(m.subject,140),
         courseId:cid,
         from,
         at:str(m.created_at,40),
         postedAt:date(m.created_at),
         ...(c.workflow_state==='unread'?{unread:true}:{}),
         text:headTail(grades?plain(m.message,600000):ungraded(m.message),600)
       }),
     rows=inboxMessages(c,context,cid).filter(recent).map(m=>project(m,'teacher'));
   const latest=own(c,'latestMessage')?c.latestMessage:{created_at:c.last_message_at,message:c.last_message||c.message||c.body};
   return rows;
  }).sort((a,b)=>(a.from==='teacher'?0:1)-(b.from==='teacher'?0:1)||inboxPriority(b)-inboxPriority(a)||ms(b.postedAt)-ms(a.postedAt)).slice(0,15);
  const errors=[
    ...array(context.sourceErrors),
    ...array(context.errors),
    ...array(context.aiResources).flatMap(r=>array(r.errors).map(e=>({...e,courseId:r.courseId}))),
    ...array(context.aiUpdates).flatMap(r=>array(r.errors).map(e=>({...e,courseId:r.courseId})))
  ],
    availability=[
      ...new Map(errors.map(e=>
        [
          String(e.courseId||'')+'|'+e.source,
          {courseId:String(e.courseId||''),source:str(e.source||'assignments',80),status:'unavailable / incomplete',reason:str(e.message||'This source could not be read.',200)}
        ])).values()
    ],
    peerReviews=array(context.aiResources).flatMap(r=>
      array(r.peerReviews).filter(p=>String(p.assessor_id)===String(context.user?.id)&&/^\d+$/.test(String(p.asset_id))).map(p=>
        ({courseId:String(r.courseId),assetId:String(p.asset_id),assetType:str(p.asset_type,40),state:str(p.workflow_state,40)}))).slice(
      0,
      128);
  const snapshot={
    v:1,
    ...(availability.length?{availability}:{}),
    ...(peerReviews.length?{peerReviews}:{}),
    today,
    until,
    timeZone:clock.timeZone,
    ...(question?{question:str(question,1200)}:{}),
    courses:array(context.courses).map(c=>
      ({
        id:str(String(c?.id??''),80),
        title:plain(c?.shortName||c?.name,100),
        ...(c.nickname?{nickname:plain(c.nickname,100)}:{}),
        ...(c.timeZone?{timeZone:c.timeZone}:{}),
        ...(c.termName?{termName:plain(c.termName,140)}:{}),
        ...(c.termStartAt?{termStartAt:c.termStartAt}:{}),
        ...(c.termEndAt?{termEndAt:c.termEndAt}:{}),
        ...(c.workflowState?{workflowState:c.workflowState}:{}),
        ...(c.enrollmentState?{enrollmentState:c.enrollmentState}:{}),
        ...(c.courseSectionId?{courseSectionId:c.courseSectionId}:{}),
        ...(array(c.courseSectionIds).length?{courseSectionIds:c.courseSectionIds}:{}),
        ...(array(c.myGroups).length?{myGroups:c.myGroups.map(g=>({...g}))}:{}),
        ...(c.latePolicy?{latePolicy:{...c.latePolicy},latePolicyText:(root.ReserveCore||(typeof require==='function'?require('./core.js'):null))?.latePolicyText(c.latePolicy)}:{} )
      })),
    items,
    ...(events.length?{events}:{}),
    ...(messages.length?{messages}:{}),
    changes,
    planner,
    finished,
    bookmarks,
    scratchpad:str(data.toolbox?.scratchpad,6000),
    focus:focusSummary(data,clock,today,now),
    home:array(modules).filter(m=>typeof m?.id==='string'&&m.id.length<=40).map(m=>
      ({
        id:m.id,
        title:str(m.title,180),
        shows:Array.isArray(m.shows)?m.shows.filter(x=>typeof x==='string').map(x=>str(x,160)):str(m.shows,500),
        visible:m.visible===true,
        pinned:m.pinned===true
      })),
    memory:array(memory).filter(validMemory).slice(-30).map(m=>({id:m.id,fact:str(m.fact,140),about:str(m.about,80),...(m.until?{until:m.until}:{})})),
    aids:saved,
    lastRun:previousRun,
    resources:[...resources.values()].filter(r=>!upcoming.has(r.id))
  };
  if(grades)
    snapshot.grades=array(context.courses).filter(c=>c?.hideFinalGrades!==true).map(c=>
      ({courseId:String(c?.id??''),score:num(c?.score),grade:str(c?.grade,40),scope:str(c?.scoreScope,40)}));
  snapshot.answers=array(runs).filter(r=>ms(r?.at)>=now-14*86400000).flatMap(r=>
    array(r.answers).map(a=>({runId:str(r.id,80),actionId:str(a?.actionId,80),question:str(a?.question,120),answer:str(a?.answer,120)}))).slice(
    0,
    12);
  const prose=new Set(['title','instructions','text','subject','about','where','notes','scratchpad','fact','question','answer','why','next','description','outcomeName','name','tool','lockedBecause','label','quote','error','outcome','nickname','termName','folderPath','shows','latePolicyText','courseName','source','reason','availabilityNote']);
  function clean(v,key){
    if(typeof v==='string')return contextText().privateText(v,{showGrades:grades||!prose.has(key),privacy,personalOnly:true,field:key});
    if(Array.isArray(v))return v.map(x=>clean(x,key));
    if(v&&typeof v==='object')for(const k of Object.keys(v))v[k]=clean(v[k],k);
    return v;
  }
  clean(snapshot);
  const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
  incoming.fingerprint=hash(JSON.stringify(stable(incoming)));
  let text=JSON.stringify(snapshot);
  const degraded=[];
  function stage(name,fn){if(text.length<=LIMIT)return;fn();degraded.push(name);snapshot.truncated=degraded.slice();text=JSON.stringify(snapshot);}
  // A first-visit file inventory is not more important than an exam or its methods.
  stage('change_details',()=>{
    snapshot.changes=snapshot.changes.filter(c=>c.kind!=='file_new'||Object.keys(object(baseline.files)).length).sort((a,b)=>
      (a.kind==='due_date'||a.kind==='teacher_comment'?0:1)-(b.kind==='due_date'||b.kind==='teacher_comment'?0:1)||ms(b.updatedAt||b.postedAt)-ms(a.updatedAt||a.postedAt)).slice(
      0,
      40).map(c=>{
      const row={...c};
      if(row.kind==='file_new'||row.kind==='file_changed')delete row.title;
      if(row.text)row.text=headTail(row.text,240);
      return row;
    });
  });
  stage('history',()=>{
    if(snapshot.lastRun){snapshot.lastRun.actions=snapshot.lastRun.actions.slice(-12);snapshot.lastRun.answers=snapshot.lastRun.answers.slice(-4);}
    for(const a of saved)a.misses=a.misses.slice(0,3);
  });
  stage('notes',()=>{snapshot.scratchpad=snapshot.scratchpad.slice(0,400);for(const p of planner){p.notes=p.notes.slice(0,80);p.steps=p.steps.slice(0,6);}});
  stage('resource_text',()=>{
    for(const m of snapshot.messages||[])m.text=headTail(m.text,240);
    for(const c of changes)if(c.kind==='file_new'||c.kind==='file_changed')delete c.title;
    for(const r of snapshot.resources){
      delete r.text;
      if(r.items)r.items=r.items.slice(0,8).map(x=>({title:x.title.slice(0,60),type:x.type,...(x.needs?{needs:x.needs}:{}),...(x.id?{id:x.id}:{})}));
    }
    for(const c of changes)if(c.text)c.text=c.text.slice(0,320);
  });
  stage('instructions',()=>{
    for(const i of items){
      i.instructions=headTail(i.instructions,300);
      i.rubric=i.rubric.slice(0,4).map(r=>
        ({
          title:r.title.slice(0,60),
          description:r.description.slice(0,100),
          points:r.points,
          ...(r.learningOutcomeId!=null?{learningOutcomeId:r.learningOutcomeId}:{}),
          ...(r.outcomeName?{outcomeName:r.outcomeName}:{}),
          ...(r.masteryPoints!=null?{masteryPoints:r.masteryPoints}:{})
        }));
      if(i.teacherComments)i.teacherComments=i.teacherComments.slice(-3).map(c=>({...c,text:c.text.slice(0,240)}));
    }
  });
  function trimResources(protect){
    let excess=text.length-LIMIT+300;
    const remove=new Set();
    for(let n=snapshot.resources.length-1;n>=0&&excess>0;n--){
      const r=snapshot.resources[n];
      if(needed.has(r.id))continue;
      remove.add(r.id);
      excess-=JSON.stringify(r).length+1;
    }
    snapshot.resources=snapshot.resources.filter(r=>!remove.has(r.id));
  }
  stage('past_work',()=>{
    snapshot.finished=finished.slice(-12);
    snapshot.planner=planner.slice(0,30);
    snapshot.bookmarks=bookmarks.slice(0,24);
    if(snapshot.lastRun)snapshot.lastRun.actions=snapshot.lastRun.actions.slice(-6);
    for(const a of snapshot.aids)a.misses=[];
    for(const m of snapshot.memory)m.fact=m.fact.slice(0,100);
  });
  stage('resource_catalog',()=>trimResources(true));
  stage('item_details',()=>{
    for(const i of snapshot.items){
      i.instructions=headTail(i.instructions,100);
      i.rubric=i.rubric.slice(0,2).map(r=>
        ({
          title:r.title.slice(0,40),
          points:r.points,
          ...(r.learningOutcomeId!=null?{learningOutcomeId:r.learningOutcomeId}:{}),
          ...(r.outcomeName?{outcomeName:r.outcomeName}:{}),
          ...(r.masteryPoints!=null?{masteryPoints:r.masteryPoints}:{})
        }));
      if(!i.resubmit)delete i.teacherComments;
      i.title=i.title.slice(0,80);
    }
    for(const r of snapshot.resources){delete r.items;r.title=r.title.slice(0,80);}
    for(const c of snapshot.changes)if(c.text)c.text=c.text.slice(0,160);
  });
  stage('remaining_resources',()=>trimResources(false));
  stage('compact',()=>{
    snapshot.planner=snapshot.planner.slice(0,10).map(p=>({itemId:p.itemId,day:p.day,minutes:p.minutes,done:p.done}));
    snapshot.finished=[];
    snapshot.bookmarks=snapshot.bookmarks.slice(0,10);
    snapshot.scratchpad='';
    snapshot.lastRun=null;
    snapshot.home=snapshot.home.filter(m=>m.pinned);
    snapshot.messages=(snapshot.messages||[]).filter(m=>/\b(?:bring|required|must|due|deadline|moved|changed|correction|cancel|approved|accommodation|cannot|can not|minutes)\b/i.test(m.text||''));
    const eventCourses=new Set();
    snapshot.events=(snapshot.events||[]).filter(e=>{
      if(e.allDay||/\b(?:away|bus|travel|trip|exam|test|quiz|deadline|concert|break|closure|no.school|revised|moved)\b/i.test(e.title))return true;
      if(eventCourses.has(e.courseId))return false;
      eventCourses.add(e.courseId);
      return true;
    }).map(e=>({...e,...(e.about?{about:headTail(e.about,120)}:{})}));
    snapshot.aids=snapshot.aids.map(a=>({key:a.key,missCount:a.missCount}));
    snapshot.courses=snapshot.courses.map(c=>({...c,title:c.title.slice(0,50)}));
    for(const i of snapshot.items){
      delete i.instructions;
      delete i.rubric;
      if(i.gradingType==='points')delete i.gradingType;
      if(!array(i.submissionTypes).length)delete i.submissionTypes;
      if(!array(i.files).length)delete i.files;
    }
  });
  stage('essentials',()=>{
    snapshot.changes=snapshot.changes.slice(0,15).map(c=>({kind:c.kind,id:c.id,...(c.kind==='due_date'?{from:c.from,to:c.to}:{})}));
    for(const i of snapshot.items){delete i.instructions;delete i.rubric;}
    snapshot.resources=snapshot.resources.map(r=>
      ({
        id:r.id,
        what:r.what,
        title:r.title.slice(0,100),
        courseId:r.courseId,
        ...(r.locked?{locked:true}:{}),
        ...(r.postedAt?{postedAt:r.postedAt}:{}),
        ...(r.updatedAt?{updatedAt:r.updatedAt}:{})
      }));
  });
  // Keep accepted makeup work and its dependencies before ordinary catalog rows.
  stage('overflow',()=>{
    snapshot.memory=snapshot.memory.slice(0,8);
    snapshot.home=snapshot.home.filter(m=>m.pinned);
    const counts=new Map();
    for(const i of snapshot.items)counts.set(i.courseId,(counts.get(i.courseId)||0)+1);
    const priority=i=>
      (resourcePriority.get(i.id)??100)<=1||array(catalog.get(i.id)?.item?.rubric).length||/href\s*=/i.test(catalog.get(i.id)?.item?.description||'')||i.missing&&i.closesAt?
        3:
        i.missing||i.resubmit||i.peerReviews||array(i.checkpoints).length||array(i.files).length||array(i.pages).length?2:i.points>=50?1:0,
      remove=new Set(),
      candidates=snapshot.items.slice().sort((a,b)=>priority(a)-priority(b)||(b.done?1:0)-(a.done?1:0)||due(b.dueAt)-due(a.dueAt));
    let size=JSON.stringify(snapshot).length;
    for(const i of candidates){
      if(size<=LIMIT)break;
      if(priority(i)>=3||counts.get(i.courseId)<=1)continue;
      remove.add(i.id);
      counts.set(i.courseId,counts.get(i.courseId)-1);
      size-=JSON.stringify(i).length+1;
    }
    snapshot.items=snapshot.items.filter(i=>!remove.has(i.id));
    const retained=new Set(snapshot.items.map(i=>i.id));
    snapshot.resources=snapshot.resources.filter(r=>globalNeeded.has(r.id)||!resourceOwners.has(r.id)||[...resourceOwners.get(r.id)].some(id=>retained.has(id)));
    if(remove.size){snapshot.omittedItems=items.length-snapshot.items.length;snapshot.workLimit='Lower-priority work omitted; Canvas has the complete backlog.';}
    pruneReferences();
    text=JSON.stringify(snapshot);
    if(text.length>LIMIT){
      snapshot.resources.sort((a,b)=>(resourcePriority.get(a.id)??100)-(resourcePriority.get(b.id)??100));
      while(text.length>LIMIT&&snapshot.resources.length){
        snapshot.resources.pop();
        snapshot.omittedResources=(snapshot.omittedResources||0)+1;
        pruneReferences();
        text=JSON.stringify(snapshot);
      }
    }
  });

  function pruneReferences(){
    const exposed=new Set([...snapshot.items,...snapshot.resources].map(x=>x.id));
    for(const i of snapshot.items){if(i.files)i.files=i.files.filter(id=>exposed.has(id));if(i.pages)i.pages=i.pages.filter(id=>exposed.has(id));}
    for(const r of snapshot.resources)if(r.items)for(const item of r.items)if(item.id&&!exposed.has(item.id))delete item.id;
    snapshot.changes=snapshot.changes.filter(c=>exposed.has(c.id));
    for(const name of ['planner','finished','bookmarks'])snapshot[name]=snapshot[name].filter(r=>exposed.has(r.itemId||r.id));
    for(const a of snapshot.aids)if(a.itemId&&!exposed.has(a.itemId))delete a.itemId;
    if(snapshot.lastRun)
      for(const entry of snapshot.lastRun.actions){
        const a=entry.action;
        for(const key of ['itemId','fileId'])if(a[key]&&!exposed.has(a[key]))delete a[key];
        if(a.sources)a.sources=a.sources.filter(id=>exposed.has(id));
        for(const i of array(a.items))if(i.itemId&&!exposed.has(i.itemId))delete i.itemId;
      }
  }
  pruneReferences();
  text=JSON.stringify(snapshot);
  while(text.length>LIMIT){
    if(snapshot.resources.length){
      snapshot.resources.sort((a,b)=>(resourcePriority.get(a.id)??100)-(resourcePriority.get(b.id)??100));
      let excess=text.length-LIMIT+1000;
      while(snapshot.resources.length&&excess>0){excess-=JSON.stringify(snapshot.resources.pop()).length+1;snapshot.omittedResources=(snapshot.omittedResources||0)+1;}
    }
    else if(snapshot.items.length){snapshot.items.pop();snapshot.omittedItems=(snapshot.omittedItems||0)+1;}
    else if(snapshot.courses.length)
      snapshot.courses.pop();
    else if(snapshot.home.length)
      snapshot.home.pop();
    else if(snapshot.memory.length)
      snapshot.memory.pop();
    else if(snapshot.aids.length)snapshot.aids.pop();else if(array(snapshot.grades).length)snapshot.grades.pop();else break;
    text=JSON.stringify(snapshot);
  }
  pruneReferences();
  text=JSON.stringify(snapshot);
  const finalIds=new Set([...snapshot.items,...snapshot.resources].map(x=>x.id)),index=new Map([...catalog].filter(([id])=>finalIds.has(id)));
  return {text,snapshot,baseline:incoming,index,catalog};
 }
 function createReader({index,client,user,parsePDF,fetchImpl=root.fetch?.bind(root),origin=client?.origin||ORIGIN(),signal,onStatus}={}){
  let verifiedScope=null;
  const cache=new Map(),known=index instanceof Map?index:new Map(),status=text=>{
    try{onStatus?.(text);}catch{}
  },fail=(what,id,error)=>{
    const meta=known.get(id),title=meta?contextText().privateText(str(meta.title,80),{showGrades:meta.gradeAccess===true,privacy:meta.privacy,field:'title'}):'';
    return {what,id,error:(title?title+': ':'')+error};
  };
   function posts(meta,value,what){
     const cid=String(meta.courseId),
       ids=new Set(array(meta.teacherIds).map(canvasId).filter(Boolean)),
       account=canvasId(user?.id),
       allowed=v=>teacher(v,cid,ids)||what==='discussion'&&!!account&&authorId(v)===account&&inCourse(v,cid)&&inCourse(v?.author,cid),
       body=v=>(meta.gradeAccess===true?plain(v):ungraded(v)).slice(0,READ_LIMIT),
       starter=teacher(value,cid,ids);
     if(what==='announcement'&&!starter)throw Error('forbidden');
     const parts=starter?
       [
         value.require_initial_post?"Post before you can see classmates' posts.":'',
         body(value?.title||meta.title).slice(0,180),
         date(value.posted_at||value.created_at)?'Posted: '+date(value.posted_at||value.created_at):'',
         date(value.updated_at)?'Updated: '+date(value.updated_at):'',
         body(value?.message||value?.body)
       ].filter(Boolean):
       [],
       queue=(value?.user_can_see_posts===false?[]:array(value?.view||value?.entries)).map(value=>({value,depth:0})).sort((a,b)=>
         (ms(b.value?.updated_at||b.value?.created_at)||0)-(ms(a.value?.updated_at||a.value?.created_at)||0));
     let count=0,length=parts.join('\n\n').length;
     while(queue.length&&count++<100&&length<READ_LIMIT){
       const next=queue.shift(),entry=next.value;
       if(blocked(entry)||entry?.deleted)continue;
       if(allowed(entry)){const text=body(entry?.message||entry?.body).slice(0,Math.max(0,READ_LIMIT-length-2));if(text){parts.push(text);length+=text.length+2;}}
       if(next.depth<5)for(const reply of array(entry?.replies))queue.push({value:reply,depth:next.depth+1});
     }
     return parts.join('\n\n');
   }
   function fileTarget(value,base=origin){
     let target;
     try{if(typeof value!=='string'||!value)throw Error();target=new URL(value,base);}catch{throw Error('forbidden');}
     if(/^\/(?:login|logout|saml|oauth|login_sessions)(?:\/|$)/i.test(target.pathname))throw Object.assign(Error('Sign in to Canvas.'),{code:'auth'});
     if(target.origin!==origin||!knownOrigin(origin)||target.protocol!=='https:'||target.username||target.password)throw Error('forbidden');
     return target;
   }
   async function fetchFile(meta,signal){
     let target=fileTarget('/files/'+meta.canvasId+'/download');
     for(let hop=0;hop<5;hop++){
       if(signal.aborted)throw Error('aborted');
       client?.reserveRead?.();
       const response=await fetchImpl(target.href,{method:'GET',credentials:'same-origin',redirect:'manual',referrerPolicy:'no-referrer',signal});
       if(signal.aborted)throw Error('aborted');
       if(!response||response.type==='opaque'||response.type==='opaqueredirect')throw Error('forbidden');
       fileTarget(response.url);
       if([301,302,303,307,308].includes(response.status)){target=fileTarget(response.headers?.get('location'),target.href);continue;}
       if(response.status===401)throw Object.assign(Error('Sign in to Canvas.'),{code:'auth'});
       if(!response.ok)throw Error('forbidden');
       return response;
     }
     throw Error('forbidden');
   }
  async function download(meta,file,pages){
    return contextText().memoRead(
      client,
      JSON.stringify(['pdf',String(user?.id),String(meta.courseId),String(meta.canvasId),pages??null,file.size,file.updated_at||'']),
      signal,
      ()=>downloadFresh(meta,file,pages));
  }
    // Word files (.docx) are zip archives with the text in word/document.xml. The platform's own inflate reads it; the
  // unpacked XML is capped so a crafted archive cannot exhaust memory.
  async function docxText(bytes){
   const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u16=at=>view.getUint16(at,true),u32=at=>view.getUint32(at,true);let end=-1;
   for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(i)===0x06054b50){end=i;break;}
   if(end<0)throw Error('format');
   let at=u32(end+16);
   for(let n=0,count=u16(end+10);n<count&&at+46<=bytes.length;n++){
    if(u32(at)!==0x02014b50)break;
    const method=u16(at+10),size=u32(at+20),nameLength=u16(at+28),skip=u16(at+30)+u16(at+32),local=u32(at+42),name=new TextDecoder().decode(bytes.subarray(at+46,at+46+nameLength));
    if(name==='word/document.xml'){
     if(local+30>bytes.length)throw Error('format');
     const start=local+30+u16(local+26)+u16(local+28),data=bytes.subarray(start,start+size);let xml='';
     if(method===0)xml=new TextDecoder().decode(data);
     else if(method===8&&typeof DecompressionStream==='function'){
      const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),decoder=new TextDecoder();let total=0;
      try{
        for(;;){const next=await reader.read();if(next.done)break;total+=next.value.length;if(total>8*1024*1024)throw Error('oversize');xml+=decoder.decode(next.value,{stream:true});}
      }finally{await reader.cancel?.().catch(()=>{});}
      xml+=decoder.decode();
     }else throw Error('format');
     const text=xml.replace(/<w:tab\/>/g,'\t').replace(/<w:br\/>|<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(
       /&amp;/g,
       '&').replace(
       /[ \t]+\n/g,
       '\n').replace(
       /\n{3,}/g,
       '\n\n').trim();
     if(!text)throw Error('empty');return text.slice(0,READ_LIMIT);
    }
    at+=46+nameLength+skip;
   }
   throw Error('format');
  }
  async function downloadFresh(meta,file,pages){
    if(!knownOrigin(origin)||
      !/^\d+$/.test(String(meta.canvasId))||
      file.id!=null&&String(file.id)!==String(meta.canvasId)||
      file.course_id!=null&&String(file.course_id)!==String(meta.courseId)||
      blocked(file)&&!(meta.linked===true&&softHidden(file)&&!(meta.locked===true&&meta.hiddenOnly!==true)))
      throw Error('forbidden');
    if(Number(file.size)>MAX_BYTES)throw Error('oversize');
    if(typeof fetchImpl!=='function')throw Error('unavailable');
    const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,15000);
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
    let reader;
   try{
     const response=await fetchFile(meta,controller.signal);
     if(Number(response.headers?.get('content-length'))>MAX_BYTES)throw Error('oversize');
     reader=response.body?.getReader();
     if(!reader)throw Error('unavailable');
     const chunks=[];
     let length=0;
     while(true){
       if(controller.signal.aborted)throw Error('aborted');
       const {done,value}=await reader.read();
       if(done)break;
       if(!(value instanceof Uint8Array))throw Error('unavailable');
       length+=value.byteLength;
       if(length>MAX_BYTES)throw Error('oversize');
       chunks.push(value);
     }
     const bytes=new Uint8Array(length);
     let offset=0;
     for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
     let result;
     if(bytes.length>=5&&String.fromCharCode(...bytes.subarray(0,5))==='%PDF-'){
       if(typeof parsePDF!=='function')throw Error('unavailable');
       result=await parsePDF(bytes,{...(pages!=null?{pages}:{}),signal:controller.signal});
     }
     else if(/^text\/plain(?:;|$)/i.test(response.headers?.get('content-type')||'')&&pages==null)
       result={text:new TextDecoder().decode(bytes).slice(0,READ_LIMIT)};
     else if(bytes.length>=4&&
       bytes[0]===0x50&&
       bytes[1]===0x4b&&
       pages==null&&
       (/wordprocessingml/i.test(String(file.content_type||file['content-type']||response.headers?.get('content-type')||''))||/\.docx$/i.test(String(file.display_name||file.filename||meta.title||''))))
       result={text:await docxText(bytes)};
     else throw Error('format');
     if(controller.signal.aborted)throw Error('aborted');
     if(typeof client?.profile==='function'&&!verifiedScope){
       const current=await client.profile({signal:controller.signal});
       if(String(current?.id)!==String(user?.id))throw Error('account');
     }
     return result;
   }catch(error){try{await reader?.cancel();}catch{}if(controller.signal.aborted)throw Error('aborted');throw error;}finally{
     try{reader?.releaseLock();}catch{}
     clearTimeout(timer);
     signal?.removeEventListener('abort',abort);
   }
  }
  async function readFresh(request={}){
    let what=str(request?.what,30),id=str(request?.id,80);
    try{
      if(!request||typeof request!=='object'||typeof request.id!=='string'||request.id!==id||!ID.test(id)||!known.has(id))return fail(what,id,'Unknown source.');
      const meta=known.get(id);
      if(meta?.what==='assignment'&&what==='discussion')what='assignment';
      if(!meta||meta.what!==what)return fail(what,id,'Source type does not match.');
      if((blocked(meta)||blocked(meta.item))&&!(what==='pdf'&&meta.linked===true&&meta.hiddenOnly===true&&!blocked(meta.item)))return fail(what,id,'This source is locked or unavailable.');
      if(signal?.aborted)return fail(what,id,'Read cancelled.');
      if(request.pages!=null&&what!=='pdf')return fail(what,id,'Pages can only be selected for a PDF.');
      const selected=what==='pdf'?pageSelection(request.pages):null;
      status('Reading '+str(meta.title,100));
      let value,text='',google=[];
      const options={user,signal,authScope:verifiedScope};
      if(what==='assignment'&&id.startsWith('local:'))
        text=plain(meta.item?.description||meta.title,READ_LIMIT);
      else if(what==='assignment'&&String(meta.canvasId).startsWith('quiz-'))
        text=[meta.title,plain(meta.item?.description),JSON.stringify(meta.item?.quiz||{})].join('\n\n');
      else if(what==='assignment'){
        if(typeof client?.readAssignment!=='function')throw Error('unavailable');
        value=await client.readAssignment(meta.courseId,meta.canvasId,options);
        if(blocked(value))throw Error('forbidden');
        google=googleLinks(value?.description);
        text=[
          plain(value?.name||meta.title,180),
          headTail(plain(value?.description,600000),TEXT_BODY_LIMIT),
          ...contextText().sourceWarnings(value?.description,origin).map(w=>'Source not available: '+w),
          ...rubric(value?.rubric).map(r=>[r.title,r.description,r.points==null?'':String(r.points)+' possible points',...r.levels.map(l=>l.text)].filter(Boolean).join('\n'))
        ].filter(Boolean).join('\n\n');
      }
      else if(what==='page'&&meta.item?.syllabus)
        text=headTail(plain(meta.item.description,600000),TEXT_BODY_LIMIT);
      else if(what==='page'){
        if(typeof client?.readCoursePage!=='function')throw Error('unavailable');
        value=await client.readCoursePage(meta.courseId,meta.slug||meta.canvasId,options);
        if(blocked(value))throw Error('forbidden');
        google=googleLinks(typeof value==='string'?value:value?.body);
        text=headTail(plain(typeof value==='string'?value:value?.body,600000),TEXT_BODY_LIMIT);
      }
      else if(what==='discussion'||what==='announcement'){
        const method=what==='discussion'?'readDiscussion':'readAnnouncement';
        if(typeof client?.[method]!=='function')throw Error('unavailable');
        value=await client[method](meta.courseId,meta.canvasId,options);
        if(blocked(value))throw Error('forbidden');
        text=posts(meta,value,what);
      }
      else if(what==='module'){
        if(typeof client?.readModule!=='function')throw Error('unavailable');
        value=await client.readModule(meta.courseId,meta.canvasId,options);
        if(blocked(value))throw Error('forbidden');
        text=[
          plain(value?.name||meta.title,180),
          contextText().moduleInfo(value,meta.timeZone),
          ...array(value?.items).filter(v=>!blocked(v)).slice(0,200).map(v=>
            plain(v.title,160)+(v.type?' ('+str(v.type,40)+')':'')+(needsOf(v.completion_requirement)?' - needs: '+needsOf(v.completion_requirement):''))
        ].join('\n');
      }
      else if(what==='pdf'){
        if(typeof client?.readFile!=='function')throw Error('unavailable');
        value=await client.readFile(meta.courseId,meta.canvasId,{...options,linked:meta.linked===true});
        const result=await download(meta,object(value),request.pages);
        if(signal?.aborted)throw Error('aborted');
        const pageTexts=array(result?.pageTexts),pending=new Map();
        if(pageTexts.length&&!pageTexts.some(p=>typeof p?.text==='string'&&p.text.trim()))throw Error('empty');
        if(pageTexts.length){
          let remaining=READ_LIMIT;
          const chunks=[];
          for(const p of pageTexts){
            if(!Number.isSafeInteger(p?.page)||p.page<1||selected&&!selected.includes(p.page)||typeof p.text!=='string')continue;
            const header='[Page '+p.page+']\n',separator=chunks.length?'\n\n':'',available=remaining-header.length-separator.length;
            if(available<=0)break;
            let exact=contextText().privateText(p.text,{showGrades:meta.gradeAccess===true,privacy:meta.privacy,personalOnly:true}).slice(0,available);
            if(/[\uD800-\uDBFF]$/.test(exact))exact=exact.slice(0,-1);
            chunks.push(separator+header+exact);
            pending.set(id+'@'+p.page,exact);
            remaining-=separator.length+header.length+exact.length;
            if(exact.length<p.text.length)break;
          }
          text=chunks.join('');
        }
        else {
          if(selected)throw Error('pages');
          text=contextText().privateText(str(result?.text,READ_LIMIT),{showGrades:meta.gradeAccess===true,privacy:meta.privacy,personalOnly:true});
        }
        if(!text.trim())throw Error('empty');
        for(const [key,value]of pending)cache.set(key,value);
        return {what,id,...(request.pages!=null?{pages:request.pages}:{}),text:text.slice(0,READ_LIMIT)};
      }
      else return fail(what,id,'Unsupported source type.');
      if(signal?.aborted)throw Error('aborted');
      text=contextText().privateText(text,{showGrades:meta.gradeAccess===true,privacy:meta.privacy,personalOnly:true});
      text=headTail(text,what==='assignment'||what==='page'?TEXT_READ_LIMIT:READ_LIMIT);
      return text.trim()?{what,id,text,...(google.length?{google}:{})}:fail(what,id,'No readable text is available.');
    }catch(error){
      const code=String(error?.code||error?.message||''),
        message=signal?.aborted||/^(aborted|cancelled)$/.test(code)?
          'Read cancelled.':
          /^(403|401|forbidden)$/.test(code)?
            'This source is locked or unavailable.':
            /^(auth|account)$/.test(code)?'Your Canvas account changed. Reopen Canvas Harness.':code==='oversize'?'This file exceeds the 2 MiB limit.':code==='format'?'Only text PDFs and plain-text files can be read.':code==='pages'||error?.code==='options'?'These PDF pages could not be read.':code==='empty'?'No readable text is available.':/^Choose /.test(code)?'Choose 1-20 valid PDF pages.':'This source could not be read.';
      if(/^(auth|account|aborted|cancelled)$/.test(code)||signal?.aborted)cache.clear();
      return {...fail(what,id,message),...(/^(auth|account|401)$/.test(code)?{code:code==='401'?'auth':code,fatal:true}:{})};
    }
  }
  // Consecutive reads reuse their verified start; each result gets a fresh end check.
  const reads=new Map();
  async function read(request={}){
    const key=JSON.stringify([request.what,request.id,request.pages??null,known.get(request.id)?.gradeAccess===true]),scoped=typeof client?.createReadScope==='function';
    try{
      if(scoped&&!verifiedScope){
        const found=await client.profile({signal});
        if(String(found.id)!==String(user?.id))throw Object.assign(Error('Your Canvas account changed.'),{code:'account'});
        verifiedScope=client.createReadScope(found,signal);
      }
      const meta=known.get(request.id),result=reads.has(key)&&!blocked(meta)&&!blocked(meta?.item)?reads.get(key):await readFresh(request);
      if(result.fatal)throw Object.assign(Error(result.error),{code:result.code});
      if(scoped){
        const found=await client.profile({signal});
        if(String(found.id)!==String(user?.id))throw Object.assign(Error('Your Canvas account changed.'),{code:'account'});
        client.endReadScope(verifiedScope);
        verifiedScope=client.createReadScope(found,signal);
      }
      if(!result.error)reads.set(key,result);
      return result;
    }catch(error){
      const code=error.code||'';
      if(/^(?:auth|account)$/.test(code)){
        cache.clear();
        reads.clear();
        contextText().clearMemo(client);
        client?.invalidateSources?.();
        client?.endReadScope?.(verifiedScope);
        verifiedScope=null;
        return {...fail(request.what,request.id,'Your Canvas account changed. Sign in and reopen Canvas Harness.'),code,fatal:true};
      }
      return fail(request.what,request.id,'This source could not be read.');
    }
  }

  return {read,cache};
 }
 // class events teachers put on the course calendars (tests, trips, labs, presentations) for the planning window
 async function loadCalendarEvents({client,user,courses=[],now=Date.now(),signal}={}){
   const ids=[...new Set(array(courses).map(c=>canvasId(c?.id)).filter(Boolean))],account=canvasId(user?.id);
   if(signal?.aborted)throw Object.assign(Error('Read cancelled.'),{code:'cancelled'});
   if(!ids.length||!account||typeof client?.list!=='function'||typeof client?.profile!=='function')return [];
   if(client.origin&&!knownOrigin(client.origin))throw Error('forbidden');
   const current=await client.profile({signal});
   if(canvasId(current?.id)!==account)throw Object.assign(Error('Your Canvas account changed.'),{code:'account'});
   const start=new Date(now-86400000).toISOString().slice(0,10),end=new Date(now+16*86400000).toISOString().slice(0,10),rows=[];
   for(let i=0;i<ids.length;i+=10){
     try{
       rows.push(...array(await client.list(
         '/api/v1/calendar_events?type=event&start_date='+start+'&end_date='+end+'&per_page=100'+ids.slice(i,i+10).map(id=>'&context_codes[]=course_'+id).join(''),
         {signal})));
     }catch(error){if(signal?.aborted||/^(?:auth|account|aborted|cancelled)$/.test(String(error?.code||error?.message||'')))throw error;}
   }
   const seen=new Set();
   return rows.filter(e=>e&&typeof e==='object'&&e.workflow_state!=='deleted'&&ids.includes(String(e.context_code||'').replace(/^course_/,''))&&!seen.has(String(e.id))&&seen.add(String(e.id)));
 }
 // the student's Inbox summaries through the same read the Inbox tab uses (nothing is marked read)
 // Verify consequential threads first without increasing the read allowance.
 const inboxReads=new WeakMap(),
   inboxPriority=row=>
     /\b(?:accommodation|approved|extension|deadline|due|moved|changed|correction|cancelled|canceled|required|must|bring|minutes)\b/i.test([
       row?.subject,
       row?.text,
       row?.message,
       row?.last_message
     ].filter(Boolean).join(' '))?
       1:
       0;
 async function loadInbox({client,user,courses=[],staff=[],now=Date.now(),signal}={}){
  if(signal?.aborted)throw Object.assign(Error('Read cancelled.'),{code:'cancelled'});
  if(!canvasId(user?.id)||typeof client?.listInbox!=='function')return [];
  if(client.origin&&!knownOrigin(client.origin))throw Error('forbidden');
  let rows;
  try{
    rows=array((await client.listInbox({user,signal}))?.conversations).slice(0,100).sort((a,b)=>
      inboxPriority(b)-inboxPriority(a)||ms(b.last_message_at)-ms(a.last_message_at));
  }catch(error){if(signal?.aborted||/^(?:auth|account|aborted|cancelled)$/.test(String(error?.code||error?.message||'')))throw error;return [];}
  if(!courses.length||typeof client.readConversation!=='function')return rows;
  const context={courses,agentCourseStaff:staff},allowed=new Set(courses.map(c=>String(c.id)));
  let reads=0,cache=inboxReads.get(client);
  if(!cache){cache=new Map();inboxReads.set(client,cache);}
  for(let i=0;i<rows.length&&reads<20;i++){
   const row=rows[i],cid=/^course_(\d+)$/.exec(String(row?.context_code||''))?.[1],ids=courseStaff(context,cid);
   if(!cid||!allowed.has(cid)||now-ms(row.last_message_at)>14*86400000||!array(row.participants).some(p=>ids.has(canvasId(p?.id))))continue;
   const key=String(user.id)+'|'+cid+'|'+row.id+'|'+row.last_message_at,old=cache.get(key);reads++;
   try{
    let entry=old&&Date.now()-old.at<300000?old:null;
    if(!entry){
     const result=await client.readConversation(row.id,{user,signal}),conversation=result?.conversation||result;if(String(conversation?.id)!==String(row.id))continue;
     const bodies=array(conversation.messages),
       project=m=>({author_id:authorId(m),created_at:m.created_at,message:typeof m.body==='string'?m.body:typeof m.message==='string'?m.message:''}),
       messages=bodies.filter(m=>teacher(m,cid,ids)).map(project);
     // Without message dates the latest author cannot be established safely.
     const latest=bodies.length&&bodies.every(m=>Number.isFinite(ms(m.created_at)))?bodies.reduce((a,b)=>ms(b.created_at)>ms(a.created_at)?b:a):null;
     entry={
       at:Date.now(),
       messages,
       participants:array(conversation.participants),
       latestMessage:latest?{...project(latest),verifiedStaff:teacher(latest,cid,ids)}:null
     };
     cache.set(key,entry);
    }
    rows[i]={...row,instructionMessages:entry.messages,latestMessage:entry.latestMessage,participants:[...array(row.participants),...array(entry.participants)]};
   }
   catch(error){if(signal?.aborted||/^(?:auth|account|aborted|cancelled)$/.test(String(error?.code||error?.message||'')))throw error;}
  }
  return rows;
 }
 // A submission comment the AI may see while Teacher feedback is on: by a teacher or TA of that course, never by the
 // student (the student's own comments and a classmate's peer-review comments stay out).
 function staffComment(comment,cid,context){
   const id=authorId(comment);
   return !!id&&id!==canvasId(context?.user?.id)&&teacher(comment,String(cid??''),courseStaff(context,String(cid??'')));
 }
 // Inbox conversations the Canvas brief may name: only those whose newest message is shown to be by a teacher or TA of
 // one of the student's courses; any other participant's name in the subject or text becomes [classmate].
 function teacherInbox(rows,context){
   const courses=new Set([...array(context?.courses),...array(context?.agentCourses)].map(c=>canvasId(c?.id)).filter(Boolean));
   return array(rows).flatMap(row=>{
     const cid=/^course_(\d+)$/.exec(String(row?.context_code||''))?.[1],latest=own(row,'latestMessage')?object(row.latestMessage):{};
     if(!cid||!courses.has(cid)||latest.verifiedStaff!==true||!teacher(latest,cid,courseStaff(context,cid)))return [];
     const scrub=inboxScrubber(row,context,cid);
     return [{courseId:cid,subject:scrub(row.subject||''),at:String(latest.created_at||''),text:scrub(latest.message||'')}];
   });
 }
 function inboxScrubber(row,context,cid){
   const ids=courseStaff(context,cid),
     peers=array(row.participants).filter(p=>canvasId(p?.id)!==canvasId(context.user?.id)&&!ids.has(canvasId(p?.id))),
     names=peers.flatMap(p=>[p.name,p.short_name,p.display_name]).filter(v=>typeof v==='string'&&v.trim()).sort((a,b)=>b.length-a.length),
     peerIds=[...new Set(peers.map(p=>canvasId(p.id)).filter(Boolean))];
   return v=>peerIds.reduce((text,id)=>text.replace(new RegExp('\\b'+id+'\\b','g'),'[classmate]'),names.reduce((text,name)=>text.split(name).join('[classmate]'),String(v||'')));
 }
 function inboxMessages(row,context,cid){
   const ids=courseStaff(context,cid),scrub=inboxScrubber(row,context,cid);
   return array(row.instructionMessages).filter(m=>teacher(m,cid,ids)).map(m=>({...m,subject:scrub(m.subject||'Teacher Inbox instruction'),message:scrub(m.message||m.body)}));
 }
 function staffText(value,context,cid,grades=false,html=false){
  const ids=courseStaff(context,String(cid)),parts=[],queue=[value],seen=new Set();let count=0;
  while(queue.length&&count++<200){
    const row=queue.shift();
    if(!row||blocked(row)||seen.has(row))continue;
    seen.add(row);
    if(teacher(row,String(cid),ids)){
      const body=row.message||row.body||row.text;
      if(body){
        const text=html?String(body):(grades?plain(body):ungraded(body)),posted=date(row.posted_at||row.created_at||row.last_message_at);
        if(text.trim())parts.push((!html&&posted?'Posted: '+posted+'\n':'')+text);
      }
    }
    for(const child of row.user_can_see_posts===false?[]:[...array(row.view),...array(row.replies),...array(row.instructionMessages)])queue.push(child);
  }
  return parts.join('\n\n');
 }
 return Object.freeze({build,createReader,loadCourseStaff,loadCalendarEvents,loadInbox,inboxMessages,staffText,courseStaff,staffComment,teacherInbox,plain,hash});
});
