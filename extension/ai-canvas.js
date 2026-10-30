/* Worker-owned, GET-only whole-Canvas scan and immutable source manifest. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAICanvas=api;
})(globalThis,function(root){
 'use strict';
 const load=(n,p)=>root[n]||(typeof require==='function'?require(p):null),
  Data=load('CanvasHarnessAgentData','./agent-data.js'),
  Actions=load('CanvasHarnessAgentActions','./agent-actions.js'),
  Core=load('ReserveCore','./core.js'),
  Client=load('ReserveAPI','./api.js'),
  Bridge=load('CanvasHarnessCanvasBridge','./ai-canvas-bridge.js'),
  Brief=load('CanvasHarnessPrepareBrief','./prepare-brief.js');
 // Canvas rows -> the brief's plain item shape. Scores never enter it.
 const submissionOf=a=>a&&typeof a.submission==='object'&&a.submission?a.submission:{};
 function briefInput({raw,assignments,aiUpdates,calendarEvents,conversations,data,now,index,staff=[],user}){
  const courseOf=code=>String(code||'').replace(/^course_/,''),
    teacherFeedback=data.toolbox?.aiTeacherFeedback===true,
    people={courses:raw.courses||[],agentCourseStaff:staff,user};
  return {now,timeZone:data.settings?.timeZone,teacherFeedback,
   courses:(raw.courses||[]).map(c=>({id:c.id,name:c.name||c.course_code||''})),
   items:(assignments||[]).map(a=>{
    const sub=submissionOf(a),state=String(sub.workflow_state||'');
    return {
     id:a.id,
     courseId:a.course_id,
     title:a.name||a.title||'',
     due:a.due_at||null,
     points:a.points_possible,
     submissionTypes:Array.isArray(a.submission_types)?a.submission_types:[],
     submitted:!!sub.submitted_at||['submitted','pending_review','graded'].includes(state),
     graded:state==='graded',
     missing:sub.missing===true,
     late:sub.late===true,
     excused:sub.excused===true,
     instructions:a.description||'',
     feedback:teacherFeedback?
       (Array.isArray(sub.submission_comments)?sub.submission_comments:[]).filter(c=>c?.comment&&Data.staffComment(c,a.course_id,people)).map(c=>
         c.comment).slice(-1)[0]||
         '':
       ''
    };
   }),
   announcements:(aiUpdates||[]).flatMap(u=>
    (Array.isArray(u?.announcements)?u.announcements:[]).map(x=>
     ({courseId:u.courseId??courseOf(x.context_code),title:x.title||'',at:x.posted_at||x.created_at||'',text:x.message||''}))),
   events:(calendarEvents||[]).map(e=>({title:e.title||'',at:e.start_at||e.at||e.startAt||'',courseId:e.courseId||courseOf(e.context_code)})),
   messages:Data.teacherInbox(conversations,people).map(m=>({subject:m.subject,at:m.at,text:m.text})),
   // Files and pages Canvas Harness can open for the AI (worksheets, readings, notes), newest first per course.
   resources:[...(index||new Map())].filter(([,r])=>['pdf','page'].includes(r?.what)&&(!r.locked||r.linked===true&&r.hiddenOnly===true)).map(([id,r])=>
    ({id,courseId:r.courseId,title:r.title||'',what:r.what,at:r.updatedAt||r.raw?.updated_at||r.raw?.created_at||''}))};
 }
 function create({
  client,
  store,
  scope,
  run,
  chrome=root.chrome,
  parsePDF,
  local=root.chrome?.storage?.local,
  fetchImpl=root.fetch?.bind(root),
  modules=()=>[],
  now=()=>Date.now()
 }={}){
  const [origin,accountId]=scope.split('|'),user={id:accountId};
  if(!client&&chrome?.tabs)fetchImpl=Bridge.createFetch({chrome,run:run||{scope},fetchImpl});
  client||=Client.createClient({origin,fetchImpl});
  async function verify(signal){const p=await client.profile({signal});if(String(p.id)!==accountId)throw Error('Your Canvas account changed.');}
  async function scan(run,signal){
   await verify(signal);await store.sync();const data=store.get(),s=Actions.state(data),scanStartedAt=now(),raw=await client.loadSnapshot({user,signal});
   if(fetchImpl.unavailable)throw fetchImpl.unavailable;if(raw.partial)throw Error('Canvas is incomplete. Refresh Canvas before preparing.');
   const courses=raw.courses.map(Core.normalizeCourse),
    byId=new Map(courses.map(c=>[c.id,c])),
    assignments=raw.assignments.map(a=>data.toolbox?.aiTeacherFeedback===true?a:{...a,submission:a.submission?{...a.submission,submission_comments:[]}:undefined}),
    items=assignments.map(a=>Core.normalizeAssignment(a,byId.get(String(a.course_id)))),
    aiResources=[],
    aiUpdates=[];
   // Keep this serial: this machine also runs training, and each API helper already bounds its own requests.
   for(const course of courses){
    aiResources.push(await client.loadCourseResources(course.id,{user,signal,assignments}));
    aiUpdates.push(await client.loadCourseUpdates(course.id,{user,signal}));
   }
   const staff=await Data.loadCourseStaff({client,user,courses,signal}),
    conversations=await Data.loadInbox({client,user,courses,staff,now:now(),signal}),
    calendarEvents=await Data.loadCalendarEvents({client,user,courses,now:now(),signal});
   const saved=(await local.get('reserve:study:'+origin+':'+accountId))['reserve:study:'+origin+':'+accountId]||{},
    grades=s.settings.grades===true&&data.settings.showGrades===true,
    hidden=new Set(grades?[]:s.gradePlans||[]);
   if(!grades){
    if(s.gradeNotes)data.toolbox.scratchpad='';
    data.customTasks=data.customTasks.filter(i=>!hidden.has(i.id));
    for(const [k,a]of Object.entries(saved))if(a?.gradeAccess)delete saved[k];
   }
   // Help cards are kept by day now; the agent snapshot still sees only the newest fifteen, as many as it saw before.
   for(const [k] of Object.entries(saved).filter(([,a])=>a?.prepare===true||a?.ask===true).sort((x,y)=>(Number(y[1].savedAt)||0)-(Number(x[1].savedAt)||0)).slice(15))
    delete saved[k];
   const context={
    user,
    courses,
    agentCourses:raw.courses,
    agentAssignments:assignments,
    items:items.filter(i=>!hidden.has(i.id)),
    aiResources,
    aiUpdates,
    agentCourseStaff:staff,
    conversations,
    calendarEvents,
    sourceErrors:client.sourceErrors(),
    s:data.settings
   },
    runs=(s.runs||[]).filter(r=>grades||!r.grades);
   const built=Data.build({
    context,
    data,
    aids:saved,
    memory:Actions.expire(s.memory,run.day).filter(m=>grades||!m.gradeAccess),
    runs,
    baseline:s.baseline||{},
    modules:modules(data),
    grades,
    now:now()
   });
   // Hash every exposed version/body, including modules, calendar, Inbox and instructions.
   const hash=Data.hash||fingerprint,version=r=>hash(JSON.stringify(r,(k,v)=>['fetchedAt','verifiedAt'].includes(k)?undefined:v));
   built.baseline.fingerprint=hash(JSON.stringify([
    built.snapshot.items,
    built.snapshot.resources,
    built.snapshot.events,
    built.snapshot.messages,
    assignments.map(a=>[a.course_id,a.id,a.updated_at,a.description,a.rubric]),
    aiResources.map(version),
    aiUpdates.map(version)
   ]));
   const entryOf=([id,row])=>{
    const {raw,item,...meta}=row;
    return [
     id,
     {
      ...meta,
      version:raw?.updated_at||
       raw?.modified_at||
       raw?.updatedAt||
       assignments.find(a=>String(a.course_id)===String(row.courseId)&&String(a.id)===String(row.canvasId))?.updated_at||
       '',
      ...(item?
       {
        item:{
         id:item.id,
         courseId:item.courseId,
         name:item.name,
         courseName:item.courseName,
         dueAt:item.dueAt,
         ...(id.startsWith('local:')||item.syllabus||String(row.canvasId).startsWith('quiz-')?{description:Data.plain(item.description||''),quiz:item.quiz,syllabus:item.syllabus}:{})
        }
       }:
       {})
     }
    ];
   },manifest=[...built.index].map(entryOf);
   if(fetchImpl.unavailable)throw fetchImpl.unavailable;
   await verify(signal);
   const brief=Brief?Brief.build(briefInput({raw,assignments,aiUpdates,calendarEvents,conversations,data,now:now(),index:built.index,staff,user})):{text:'',refs:{}};
   // Items the brief lists stay readable even when the agent snapshot trimmed them for size.
   // The item asked about with Help with this is added the same way, found by its id even when the brief left it out.
   const picked=run?.kind!=='ask'?[]:Array.isArray(run.items)&&run.items.length?run.items:run.itemId?[{itemId:run.itemId,courseId:run.courseId}]:[],
    asked=picked.map(it=>
     [...(built.catalog||[])].find(([,m])=>
      m?.what==='assignment'&&String(m.canvasId)===String(it.itemId)&&(!it.courseId||String(m.courseId)===String(it.courseId)))).filter(Boolean);
   const wanted=[...Object.values(brief.refs||{}).filter(r=>!r.source),...asked.map(a=>({id:a[1].canvasId,courseId:a[1].courseId}))];
   const indexed=new Set(manifest.map(([id])=>id));
   for(const ref of wanted){
    const id='assignment:'+ref.courseId+':'+ref.id,meta=built.catalog?.get(id);
    if(!meta||indexed.has(id))continue;
    manifest.push(entryOf([id,meta]));
    indexed.add(id);
    for(const sub of [...(meta.files||[]),...(meta.pages||[])]){
     const m=built.catalog.get(sub);
     if(m&&!indexed.has(sub)){manifest.push(entryOf([sub,m]));indexed.add(sub);}
    }
   }
   const helped=new Set(wanted.map(r=>String(r.courseId)));
   for(const [id,m] of built.catalog||[])
    if(m?.what==='page'&&(m.home===true||m.item?.syllabus)&&helped.has(String(m.courseId))&&!indexed.has(id)){manifest.push(entryOf([id,m]));indexed.add(id);}
   // Those courses' files and pages, newest first, so the AI can ask for one an item does not attach.
   const shelf=new Map();
   for(const [id,m] of built.catalog||[])
    if(['pdf','file','page'].includes(m?.what)&&!m.locked&&m.home!==true&&!m.item?.syllabus&&helped.has(String(m.courseId))&&!indexed.has(id))
     shelf.set(m.courseId,[...(shelf.get(m.courseId)||[]),[id,m]]);
   for(const list of shelf.values())
    for(const e of list.sort((a,b)=>String(b[1].raw?.updated_at||'').localeCompare(String(a[1].raw?.updated_at||''))).slice(0,40)){manifest.push(entryOf(e));indexed.add(e[0]);}
   return {
    ...built,
    brief,
    index:manifest,
    hash:hash(built.text),
    scanStartedAt,
    scanFinishedAt:now(),
    omissions:{items:built.snapshot.omittedItems||0,resources:built.snapshot.omittedResources||0,availability:built.snapshot.availability||[]}
   };
  }
  function changed(row,value){
   return value?.locked||value?.locked_for_user||value?.published===false||row.version&&value?.updated_at&&row.version!==value.updated_at;
  }
  async function validate(run,ids,signal){
   client.invalidateSources?.();
   for(const id of new Set(ids.filter(Boolean))){
    const row=new Map(run.snapshot.index).get(id);
    if(!row||row.locked)throw Error('This source is unavailable. Refresh Canvas.');
    if(id.startsWith('local:')){if(!store.get().customTasks.some(i=>String(i.id)===String(row.canvasId)))throw Error('This local source was removed.');continue;}
    if(String(row.canvasId).startsWith('quiz-')||row.item?.syllabus)continue;
    const method={assignment:'readAssignment',page:'readCoursePage',pdf:'readFile',file:'readFile',module:'readModule',discussion:'readDiscussion',announcement:'readAnnouncement'}[row.what];
    if(method&&client[method]){
     const current=await client[method](row.courseId,row.slug||row.canvasId,{user,signal,linked:row.linked===true});
     if(changed(row,current))throw Error('Canvas instructions changed. Refresh Canvas and start a new Prepare run.');
    }
   }
  }
  const reader=(run,signal)=>{
   let sourceChanged=false;
   const wrapped={...client};
   for(const method of ['readAssignment','readCoursePage','readFile','readModule','readDiscussion','readAnnouncement'])
    if(client[method])
     wrapped[method]=async(cid,id,options)=>{
      const value=await client[method](cid,id,options),
       row=run.snapshot.index.map(([,r])=>r).find(r=>String(r.courseId)===String(cid)&&String(r.slug||r.canvasId)===String(id));
      if(row&&changed(row,value)){sourceChanged=true;throw Error('forbidden');}
      return value;
     };
   const r=Data.createReader({index:new Map(run.snapshot.index),client:wrapped,user,origin,signal,parsePDF,fetchImpl});
   for(const [k,v]of run.cache||[])r.cache.set(k,v);
   return {cache:r.cache,async read(request){
    const result=await r.read(request);
    if(fetchImpl.unavailable)throw fetchImpl.unavailable;
    return sourceChanged?{...result,fatal:true,code:'source-changed',error:'Canvas instructions changed. Refresh Canvas and start a new Prepare run.'}:result;
   }};
  };
  return {scan,reader,verify,validate,client,hash:fingerprint};
 }
 function fingerprint(v){let n=2166136261;for(const c of String(v))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16);}
 return {create,fingerprint,createFetch:Bridge.createFetch};
});
