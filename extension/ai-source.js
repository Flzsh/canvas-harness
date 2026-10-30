/* Canvas Harness: explicitly selected course context. No AI credentials or chat history here. */
(function(root){
 'use strict';
 const MAX_BYTES=2*1024*1024;
 const levelValue=value=>['middle school','high school','college'].includes(value)?value:'high school';
 const quizTaking=()=>/\/quizzes\/[^/?#]+\/(?:take|resume)(?:[/?#]|$)/i.test(root.location?.href||root.location?.pathname||'');
 const C=()=>root.CanvasHarnessContext;
 // Context providers can replace wrappers or mutate nested Canvas records. Keep
 // a detached snapshot so neither case requires parsing unchanged instructions.
 function sameData(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);
 if(Array.isArray(a)&&a.length!==b.length||keys.length!==Object.keys(b).length)return false;
 for(const key of keys)if(!Object.hasOwn(b,key)||!sameData(a[key],b[key]))return false;
 return true;
 }
 function snapshot(value){
   return !value||typeof value!=='object'?value:Array.isArray(value)?value.map(snapshot):Object.fromEntries(Object.keys(value).map(key=>[key,snapshot(value[key])]));
 }
 function create({getContext,store,client,user,demo=false,parsePDF,fetchImpl=root.fetch?.bind(root)}){
  const origin=store.owner?.origin||client?.origin||root.location?.origin,accountId=String(user?.id||store.owner?.accountId||'');
  const readScopes=new Map(),
    materialCache=new Map(),
    resources=new Map(),
    updates=new Map(),
    freshAssignments=new Map(),
    freshInputs=new Map(),
    linkedMaterials=new Map(),
    auxiliary={};
  let preparedCatalog=null,preparingCatalog=null,inventoryInputs,cachedInventory,inventoryVersion=0;
  let dead=false,
    catalogInputs,
    cachedCatalog,
    cachedSummary,
    summarySources,
    summaryActive,
    selectionSnapshot,
    selectionJSON,
    help=null,
    pendingHelp=null,
    helpError=null,
    catalogLoad=null,
    helpSeq=0,
    helpInputs,
    cachedHelp,
    handoff=null,
    handoffSeq=0;
  const list=value=>Array.isArray(value)?value:[],stamp=value=>typeof value==='number'?value:typeof value==='string'&&typeof Date.parse==='function'?Date.parse(value):NaN;
  const owned=value=>
    (!value?.origin||value.origin===origin)&&(!value?.accountId||String(value.accountId)===accountId)&&(!value?.user?.id||String(value.user.id)===accountId);
  const assertOwner=()=>{if(store.owner&&!owned(store.owner))throw Error('Your Canvas account changed. Reopen Canvas Harness before sharing context.');};
  const subscribed=typeof store.subscribe==='function';assertOwner();let accountData=subscribed?store.get?.():null;
  const initialToolbox=accountData?.toolbox;
  let autoSend=initialToolbox?.aiAutoSend===true,
    bringAnswers=initialToolbox?.aiBringAnswers!==false,
    teacherFeedback=initialToolbox?.aiTeacherFeedback===true,
    level=levelValue(initialToolbox?.aiLevel);
  const unsubscribe=subscribed?store.subscribe(data=>{
    assertOwner();
    accountData=data||store.get?.();
    const toolbox=accountData?.toolbox;
    autoSend=toolbox?.aiAutoSend===true;
    bringAnswers=toolbox?.aiBringAnswers!==false;
    teacherFeedback=toolbox?.aiTeacherFeedback===true;
    level=levelValue(toolbox?.aiLevel);
  }):null;
  const viewKey=ctx=>{
   const selected=ctx.aiSelectedIds||[];
   if(selectionJSON===undefined||!sameData(selected,selectionSnapshot)){selectionSnapshot=snapshot(selected);selectionJSON=JSON.stringify(selected);}
   const biscuit=world(ctx);
   return [
     origin,
     accountId,
     ctx.courseId||biscuit.courseId||'all',
     ctx.aiAssignmentId||ctx.active?.assignmentId||ctx.active?.id||biscuit.itemId||biscuit.selectedItemId||'',
     selectionJSON,
     Array.isArray(ctx.aiSelectedIds)?'selected':'auto',
     ctx.pageKind||ctx.page?.kind||biscuit.pageKind||biscuit.page?.kind||'',
     ctx.pathname||''
   ].join('|');
  };
  const scopeKey=(ctx=getContext())=>{
    assertOwner();
    const key=viewKey(ctx);
    if(help&&help.viewKey!==key)help=null;
    if(pendingHelp&&pendingHelp.viewKey!==key)pendingHelp=null;
    if(helpError&&helpError.viewKey!==key)helpError=null;
    return key+(handoff?'|biscuit:'+handoff.id:help?'|help:'+help.id+':'+help.itemId:'');
  };
  function assertScope(key){assertOwner();if(dead||key!==scopeKey())throw Error('The Canvas view changed. Review the sources for the new page.');}
  async function verify(signal){
   assertOwner();if(dead)throw Error('This Canvas context is closed.');
   if(demo)return;
   if(!client?.profile||!accountId)throw Error('Reopen Canvas Harness to verify your Canvas account.');
   const found=await client.profile({signal});
   if(String(found.id)!==accountId)throw Object.assign(Error('Your Canvas account changed. Reopen Canvas Harness before sharing context.'),{code:'account'});return found;
  }
  function world(ctx){const supplied=ctx.biscuitContext||ctx.biscuitData;return supplied&&typeof supplied==='object'&&owned(supplied)?supplied:{};}
  function gradesShown(ctx){
    const flags=[ctx.s?.showGrades,ctx.showGrades,(subscribed?accountData:store.get?.())?.settings?.showGrades].filter(value=>typeof value==='boolean');
    return flags.includes(true)&&!flags.includes(false);
  }
  const helpFeedback=()=>!!help&&(typeof help.page==='string'?help.page:help.page?.kind)==='feedback',feedbackEnabled=()=>teacherFeedback||helpFeedback();
  function inventory(ctx){
   const biscuit=world(ctx),courses=list(ctx.courses).length?ctx.courses:list(biscuit.courses),byId=new Map();
   let key=null;
   try{key=JSON.stringify([ctx.courses,biscuit.courses,ctx.items,biscuit.items||biscuit.assignments||biscuit.workItems]);}catch{}
   // Content detects in-place edits; the version avoids rescanning the same projection.
   if(key!==null&&key===inventoryInputs&&cachedInventory)return {...cachedInventory,biscuit};
   for(const raw of [...list(ctx.items),...list(biscuit.items||biscuit.assignments||biscuit.workItems)]){
    if(!raw||raw.gradeAccess||raw.kind==='grade'||!owned(raw))continue;
    const id=String(raw.assignmentId||raw.id||''),courseId=String(raw.courseId||raw.course_id||'');if(!id||!courseId)continue;
    const key=courseId+':'+id,merged={...byId.get(key),...raw},due=merged.dueAt??merged.due_at??merged.due,info=C().feedbackInfo(merged,accountId);
    byId.set(key,{
      ...merged,
      id,
      courseId,
      name:raw.name||raw.title||merged.name||merged.title||'',
      description:merged.description||merged.instructions||merged.instructionText||'',
      dueAt:typeof due==='number'&&Number.isFinite(due)&&Math.abs(due)<=8640000000000000?new Date(due).toISOString():due||'',
      submissionTypes:merged.submissionTypes||merged.submission_types||[],
      kind:typeof merged.kind==='string'?merged.kind:'',
      workKind:typeof merged.workKind==='string'?merged.workKind:'',
      rubric:merged.rubric,
      hasRubric:merged.hasRubric===true,
      locked:merged.locked===true||merged.locked_for_user===true,
      personal:merged.personal===true,
      done:merged.done===true||merged.completed===true||merged.submitted===true,
      courseName:merged.courseName||merged.course||'',
      url:merged.url||merged.html_url,
      ...info
    });
   }
   inventoryInputs=key;cachedInventory={courses,items:[...byId.values()],version:++inventoryVersion};return {...cachedInventory,biscuit};
  }
  function notesFor(items,courses,biscuit){
   if(!store.owner||!owned(store.owner))return [];
   const data=accountData||{},
     blocked=new Set(list(data.toolbox?.agent?.gradePlans).map(String)),
     notes=[],
     available=items.filter(item=>!item.locked&&!item.personal&&!item.gradeAccess),
     byId=new Map(available.map(item=>[item.id,item])),
     allowed=new Set(courses.map(c=>String(c.id)));
   const add=(note,id,courseId,assignmentId)=>{
     if(!note||!owned(note)||note.gradeAccess||blocked.has(String(assignmentId||''))||!allowed.has(String(courseId)))return;
     const text=typeof note==='string'?note:note.text||note.notes||note.body;
     if(typeof text==='string'&&text.trim())
       notes.push({
         id:String(id),
         courseId:String(courseId),
         ...(assignmentId?{assignmentId:String(assignmentId)}:{}),
         ...(typeof note==='object'&&note.sourceId?{sourceId:String(note.sourceId)}:{}),
         title:typeof note==='object'&&note.title|| (assignmentId?'Your assignment notes':'Your course notes'),
         text
       });
   };
   for(const [id,task]of Object.entries(data.tasks||{})){const item=byId.get(id);if(item&&task?.notes)add({text:task.notes,title:'Your notes: '+item.name},'assignment-'+id,item.courseId,id);}
   for(const [courseId,value]of Object.entries(data.courseNotes||data.toolbox?.courseNotes||{})){
     const rows=Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[value];
     rows.forEach((note,i)=>add(note,'course-'+(note?.id||i),courseId,note?.itemId||note?.assignmentId));
   }
   for(const note of list(biscuit.notes)){
     const assignmentId=String(note?.itemId||note?.assignmentId||''),item=byId.get(assignmentId),courseId=note?.courseId||item?.courseId;
     if(assignmentId&&!item||note?.id==='scratchpad')continue;
     add(note,'biscuit-'+String(note?.id||notes.length),courseId,assignmentId);
   }
   return notes;
  }
  function genericHandoffSources(value,native){
   const raw=getContext(),
     biscuit=world(raw),
     data=accountData||{},
     kind=value.kind,
     common=['description','instructions','instructionText','text'],
     fields={
       quiz:[...common,'attemptsAllowed','attemptsUsed','attemptsRemaining','notesAllowed','calculatorAllowed','formulaSheetAllowed','pointsPossible','submissionTypes','allowedExtensions','scoringPolicy'],
       discussion:[...common,'message','body','replyDueAt','dueAt'],
       module:common,
       'canvas-module':common,
       event:[...common,'startAt','endAt','location','room'],
       teacher:['officeHours','email','room'],
       person:['officeHours','email','room'],
       message:[...common,'message','body'],
       bookmark:['description','text'],
       link:['description','text'],
       reminder:['text','message','dueAt','weekdays'],
       course:['description','teacher','officeHours','email'],
       group:['description','groupName','meetingTime'],
       'peer-review':['description','instructions','dueAt','status'],
       'market-item':['description','price','installed','enabled'],
       aid:['description','summary','outline'],
       setting:['key','value'],
       feature:['description','enabled','on'],
       'home-module':['description','text','shows'],
       tab:['description','text'],
       action:['description','text']
     },
     families={
       quizzes:'quiz',
       discussions:'discussion',
       modules:'module',
       canvasModules:'canvas-module',
       calendarEvents:'event',
       teachers:'teacher',
       people:'person',
       messages:'message',
       inbox:'message',
       bookmarks:'bookmark',
       links:'link',
       reminders:'reminder',
       courses:'course',
       groups:'group',
       peerReviews:'peer-review',
       marketItems:'market-item',
       homeModules:'home-module',
       tabs:'tab',
       actions:'action'
     },
     records=[],
     matches=[];
   if(!fields[kind]||!store.owner||!owned(store.owner)||!owned(raw)||!owned(data))return matches;
   const add=(rows,family)=>list(rows).forEach((v,i)=>{
     if(typeof v==='string'&&kind==='tab')v={id:v,title:v};
     if(v&&typeof v==='object'&&!Array.isArray(v))records.push({...v,id:String(v.id??family+'-'+i)});
   });
   for(const [family,type]of Object.entries(families))if(type===kind){add(biscuit[family],family);add(raw[family],family);}
   if(kind==='bookmark')add(data.resourcePins,'bookmarks');if(kind==='reminder')add(data.pet?.reminders,'reminders');
   if(kind==='link')
     for(const [courseId,group]of Object.entries(data.courseFiles||{}))
       add(list(Array.isArray(group)?group:group?.items).map(v=>({...v,courseId:v.courseId||courseId})),'links');
   if(kind==='setting')
     for(const settings of [biscuit.settings,raw.s,data.settings])
       for(const [key,value]of Object.entries(settings||{}))if(['string','number','boolean'].includes(typeof value))records.push({id:key,title:key.replace(/([a-z])([A-Z])/g,'$1 $2'),key,value});
   if(kind==='feature')
     for(const features of [biscuit.features,raw.features])add(Array.isArray(features)?features:Object.entries(features||{}).map(([id,on])=>({id,name:id,on})),'features');
   if(kind==='aid')
     for(const aids of [biscuit.studyAids,raw.studyAids])
       for(const [id,v]of Object.entries(aids||{}))if(v&&typeof v==='object')records.push({...v,id,title:v.title||String(v.kind||'Saved')+' study aid'});
   const scalar=v=>
     typeof v==='string'?
       C().plain(v):
       typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)?
         String(v):
         Array.isArray(v)?v.slice(0,100).filter(x=>['string','boolean','number'].includes(typeof x)).map(x=>C().plain(String(x))).join(', '):'';
   for(const row of records){
    if(row.id!==value.id||
      !owned(row)||
      row.gradeAccess||
      ['submission','grade','course-grade','feedback','note'].includes(row.kind)||
      row.locked||
      row.locked_for_user||
      row.hidden_for_user||
      row.published===false)
      continue;
    let courseId=String(row.courseId??row.course_id??''),
      url=typeof(row.url||row.html_url)==='string'&&(row.url||row.html_url).trim()?C().safeURL(row.url||row.html_url,origin):'',
      urlCourse='';
    if(url){
      const parsed=new URL(url);
      urlCourse=parsed.pathname.match(/^\/courses\/([^/]+)(?:\/|$)/)?.[1]||'';
      if(!['bookmark','link','reminder','market-item'].includes(kind)&&(parsed.origin!==origin||courseId&&urlCourse&&courseId!==urlCourse))continue;
    }
    if(value.courseId&&courseId!==value.courseId)continue;
    if(!courseId&&kind==='course')courseId=row.id;if(!courseId&&urlCourse)courseId=urlCourse;
    const course=native.ctx.courses.find(c=>String(c.id)===courseId&&owned(c));if(courseId&&courseId!=='all'&&!course)continue;
    const title=scalar(row.title||row.name||row.label||row.subject||row.filename||row.key).slice(0,500);if(!title)continue;
    const parts=[title];for(const key of fields[kind]){const text=scalar(row[key]);if(text)parts.push(key.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase()+': '+text);}
    const source={
      id:'biscuit:'+encodeURIComponent(kind)+':'+encodeURIComponent(courseId||'all')+':'+encodeURIComponent(row.id),
      kind,
      courseId:courseId||'all',
      courseName:scalar(course?.shortName||course?.name),
      title,
      text:C().withoutScores(parts.join('\n\n').slice(0,C().MAX_LIMIT),false),
      description:C().withoutScores(scalar(row.description||row.instructions||row.instructionText),false),
      url,
      links:[]
    },
      input=snapshot(source);
    if(!matches.some(v=>sameData(v.input,input)))matches.push({input,source:C().filterSource(source,{showGrades:native.ctx.s.showGrades===true})});
   }
   return matches;
  }
  function handoffSource(value,native,courseId,generic){
   const raw=getContext(),
     biscuit=world(raw),
     kind=value.kind==='material'?'file':value.kind,
     id=value.id,
     course=String(value.courseId??courseId??''),
     courses=native.ctx.courses.filter(owned),
     available=native.sources.filter(s=>(!course||s.courseId===course)&&courses.some(c=>String(c.id)===s.courseId)),
     matches=new Map(),
     add=s=>{
     if(s&&available.includes(s))matches.set(s.id,s);
   },
   recordId=v=>String(v?.id??v?.page_id??v?.pageId??v?.url??''),
   allowed=v=>
     v&&
       owned(v)&&
       !v.gradeAccess&&
       !v.locked&&
       !v.locked_for_user&&
       !v.hidden_for_user&&
       v.published!==false&&
       (!v.courseId&&!v.course_id||!course||String(v.courseId||v.course_id)===course),
   rows=values=>list(values).filter(v=>recordId(v)===id&&allowed(v)),
   find=(sourceKind,sourceId)=>available.find(s=>s.kind===sourceKind&&s.id===sourceId);
   if(['submission','course-grade'].includes(kind))throw Error('The selected Biscuit source cannot be shared.');
   if(!['assignment','file','page','home','syllabus','announcement','note','rubric','feedback','grade'].includes(kind)){
    const request={id,kind,courseId:course},found=genericHandoffSources(request,native);
    if(found.length!==1)throw Error('The selected Biscuit source is unavailable or ambiguous.');
    const selected=found[0];
    generic.set(selected.source.id,{request,input:selected.input});
    return selected.source;
   }
   if(['feedback','grade'].includes(kind)&&!teacherFeedback)throw Error('Teacher feedback is turned off.');
   if(kind==='note'){
    if(id==='scratchpad')return null;
    for(const s of available)if(s.kind==='note'&&s.id===id)add(s);
    if(!matches.size)
      for(const note of rows(biscuit.notes)){
        const assignmentId=String(note.assignmentId||note.itemId||''),
          matching=available.filter(s=>
            s.kind==='note'&&(!assignmentId||s.assignmentId===assignmentId)&&(!note.courseId&&!note.course_id||s.courseId===String(note.courseId||note.course_id))),
          task=matching.filter(s=>s.id==='note:'+s.courseId+':assignment-'+assignmentId);
        for(const s of task.length?task:matching.filter(s=>s.id==='note:'+s.courseId+':biscuit-'+id))add(s);
      }
    if(!matches.size)for(const s of available)if(s.kind==='note'&&['note:'+s.courseId+':'+id,'note:'+s.courseId+':course-'+id].includes(s.id))add(s);
    if(!matches.size)return null;
   }else if(kind==='rubric'){
    for(const s of available)if(s.kind==='assignment'&&s.hasRubric&&s.id===id)add(s);
    for(const row of rows(biscuit.rubrics)){
      const assignmentId=String(row.assignmentId||row.assignment_id||row.parentId||row.itemId||'');
      for(const s of available)
        if(s.kind==='assignment'&&s.hasRubric&&s.assignmentId===assignmentId&&(!row.courseId&&!row.course_id||s.courseId===String(row.courseId||row.course_id)))add(s);
    }
   }else if(['feedback','grade'].includes(kind)){
    for(const s of available)if(s.kind==='feedback'&&s.id===id)add(s);
    for(const row of rows([...list(biscuit.grades),...list(biscuit.feedback)])){
      const assignmentId=String(row.assignmentId||row.assignment_id||row.itemId||(/^grade-(.+)$/.exec(recordId(row))?.[1])||'');
      for(const s of available)if(s.kind==='feedback'&&s.assignmentId===assignmentId&&(!row.courseId&&!row.course_id||s.courseId===String(row.courseId||row.course_id)))add(s);
    }
   }else{
    for(const s of available)
      if(s.kind===kind&&
        (s.id===id||
          kind==='assignment'&&s.assignmentId===id||
          kind==='file'&&s.fileId===id||
          kind==='page'&&s.slug===id||
          kind==='announcement'&&s.id==='announcement:'+s.courseId+':'+id||
          ['home','syllabus'].includes(kind)&&id===kind))
        add(s);
    if(['page','file'].includes(kind)){
     const backing=[...list(biscuit[kind==='page'?'pages':'files']),...(kind==='file'?list(biscuit.materials):[])];
     for(const group of [...list(raw.aiResources),...resources.values()].filter(owned))
       for(const row of list(group[kind==='page'?'pages':'files']))
         if((!row.courseId||String(row.courseId)===String(group.courseId))&&(!row.course_id||String(row.course_id)===String(group.courseId)))
           backing.push({...row,courseId:String(group.courseId)});
     for(const row of rows(backing)){
      const owner=String(row.courseId||row.course_id||course),
        pageURL=typeof row.url==='string'&&!/[/:?#]/.test(row.url)?row.url:undefined,
        sourceId=C().sourceId({...row,url:row.html_url||row.url,pageUrl:row.pageUrl||row.page_url||pageURL},owner,origin);
      add(find(kind,sourceId));
      if(kind==='page'&&recordId(row)==='front:'+owner)add(find('home','home:'+owner));if(kind==='page'&&recordId(row)==='syllabus:'+owner)add(find('syllabus','syllabus:'+owner));
     }
    }
   }
   if(matches.size!==1)throw Error('The selected Biscuit source is unavailable or ambiguous.');return [...matches.values()][0];
  }
  function handoffNoteIds(selected,available,ctx){
    const at=stamp(world(ctx).now??ctx.now),sources=[...new Map([...available,...selected].map(s=>[s.id,s])).values()],ids=new Set();
    for(const target of selected.filter(s=>s.kind!=='note'))
      for(const source of C().contextSources(sources,target,{now:Number.isFinite(at)?at:Date.now()}))if(source.kind==='note')ids.add(source.id);
    return ids;
  }
  function setHandoff(value){
   try{
    if(dead||
      quizTaking()||
      !value||
      typeof value!=='object'||
      Array.isArray(value)||
      !owned(value)||
      !owned(getContext())||
      typeof value.wishes!=='string'||
      !value.wishes.trim()||
      value.wishes.length>4096||
      !Array.isArray(value.sources)||
      value.sources.length>20)
      return false;
    const shapes=['practice','reading','lab','rubric','fixes','notes','steps','outline','message','summary','flashcards'],kinds=value.kinds===undefined?value.mode==='build'?[value.kind]:[]:value.kinds;
    if(!Array.isArray(kinds)||
      new Set(kinds).size!==kinds.length||
      kinds.some(k=>!['ask',...shapes].includes(k))||
      !['ask','build','choice'].includes(value.mode)||
      value.mode==='ask'&&(value.kind!=='ask'||kinds.length)||
      value.mode==='build'&&(!shapes.includes(value.kind)||kinds.length!==1||kinds[0]!==value.kind)||
      value.mode==='choice'&&(value.kind!==null||kinds.length<2))
      return false;
    const ids=new Set();
    for(const source of value.sources){
      if(!source||
        typeof source!=='object'||
        Array.isArray(source)||
        !owned(source)||
        typeof source.id!=='string'||
        !source.id.trim()||
        source.id.length>512||
        /[\u0000-\u001f\u007f]/.test(source.id)||
        typeof source.kind!=='string'||
        typeof source.label!=='string'||
        source.label.length>2000||
        typeof source.text!=='string'||
        source.text.length>C().MAX_LIMIT||
        source.courseId!=null&&(!['string','number'].includes(typeof source.courseId)||String(source.courseId).length>256))
        return false;
      const key=JSON.stringify([source.kind,String(source.courseId||value.courseId||''),source.id]);
      if(ids.has(key))return false;
      ids.add(key);
    }
    if(value.contextIds!==undefined&&
      (!Array.isArray(value.contextIds)||
        value.contextIds.length!==value.sources.length||
        value.contextIds.some(id=>typeof id!=='string')||
        [...value.contextIds].sort().some((id,i)=>id!==value.sources.map(s=>s.id).sort()[i])))
      return false;
    const native=current(true),
      generic=new Map(),
      selected=[...new Map(value.sources.map(source=>handoffSource(source,native,value.courseId,generic)).filter(Boolean).map(source=>[source.id,source])).values()],
      noteIds=handoffNoteIds(selected,native.sources,native.ctx),
      sources=selected.filter(s=>s.kind!=='note'||noteIds.has(s.id)),
      assignments=sources.filter(s=>s.kind==='assignment'),
      active=assignments.find(s=>s.assignmentId===String(value.itemId)&&(!value.courseId||s.courseId===String(value.courseId)))||
        (assignments.length===1?assignments[0]:null),
      target=active||sources[0],
      metadata={
        mode:value.mode,
        kind:value.kind,
        kinds:[...kinds],
        course:target?.courseName||native.ctx.courses.find(c=>String(c.id)===target?.courseId)?.name||'',
        item:target?.title||'',
        itemId:target?.assignmentId||target?.id||'',
        courseId:target?.courseId||'',
        wishes:value.wishes.trim()
      };
    help=pendingHelp=helpError=null;
    handoff={
      id:String(++handoffSeq),
      viewKey:viewKey(getContext()),
      refs:sources.map(s=>({id:s.id,kind:s.kind,courseId:s.courseId})),
      generic,
      activeId:active?.id||'',
      metadata
    };
    cachedHelp=null;
    return snapshot(metadata);
   }catch{return false;}
  }
  function current(native=false){
   assertOwner();const raw=getContext();scopeKey(raw);
   if(!subscribed){
     accountData=store.get?.();
     const toolbox=accountData?.toolbox;
     autoSend=toolbox?.aiAutoSend===true;
     bringAnswers=toolbox?.aiBringAnswers!==false;
     teacherFeedback=toolbox?.aiTeacherFeedback===true;
     level=levelValue(toolbox?.aiLevel);
   }
   const {biscuit,courses,items:baseItems,version}=inventory(raw),
     ctx={
       ...raw,
       ...auxiliary,
       sourceErrors:client?.sourceErrors?.()||raw.sourceErrors||[],
       user:{id:accountId},
       courses,
       s:{...raw.s,showGrades:gradesShown(raw)},
       biscuitContext:biscuit,
       courseId:raw.courseId&&raw.courseId!=='all'?raw.courseId:biscuit.courseId||raw.courseId||'all',
       aiAssignmentId:raw.aiAssignmentId||raw.active?.assignmentId||raw.active?.id||biscuit.itemId||biscuit.selectedItemId||biscuit.page?.itemId||null,
       ...(help?{aiAssignmentId:help.itemId,courseId:help.courseId,aiSelectedIds:undefined,page:help.page,selectedText:help.selectedText}:{})
     },
     extra=list(ctx.aiResources).filter(owned),
     news=list(ctx.aiUpdates).filter(owned),
     grouped=new Map();
   for(const a of list(biscuit.announcements))
     if(owned(a)){
       const id=String(a.courseId||a.course_id||'');
       if(!grouped.has(id))grouped.set(id,{courseId:id,announcements:[]});
       grouped.get(id).announcements.push(a);
     }
   const loadedNews=[...[...updates.values()].filter(owned),...news,...grouped.values()],notes=notesFor(baseItems,courses,biscuit);
   if(freshInputs.size){
     const items=new Map(baseItems.map(item=>[String(item.courseId)+':'+String(item.id),item]));
     for(const [key,value]of freshInputs)if(!sameData(items.get(key),value)){freshAssignments.delete(key);freshInputs.delete(key);}
   }
   const inputs=[
     version,
     extra,
     loadedNews,
     ctx.aiAssignmentId,
     [...resources.values()],
     [...freshAssignments.values()],
     [...linkedMaterials.values()],
     feedbackEnabled(),
     notes,
     ctx.s.showGrades,
     ctx.calendarEvents,
     ctx.conversations,
     ctx.agentCourseStaff,
     ctx.sourceErrors
   ];
   let content;try{content=JSON.stringify(inputs);}catch{}
   if(!cachedCatalog||(content!==undefined?content!==catalogInputs:!sameData(inputs,catalogInputs))){
    const items=baseItems.map(x=>freshAssignments.get(String(x.courseId)+':'+String(x.id))||x);
    for(const item of freshAssignments.values())if(!items.some(x=>String(x.id)===String(item.id)&&String(x.courseId)===String(item.courseId)))items.push(item);
    // The panel filters the catalog by course. Explicitly choosing a different
    // course must not lose its selected sources when another list is loaded.
    cachedCatalog=C().catalog({
      ...ctx,
      items,
      courseId:'all'
    },{origin,resources:[...new Map([...extra,...resources.values()].filter(owned).map(r=>[String(r.courseId),r])).values()],updates:loadedNews,notes});
    for(const source of linkedMaterials.values())if(courses.some(c=>String(c.id)===source.courseId)){
     const found=cachedCatalog.sources.find(s=>s.id===source.id);
     if(found)Object.assign(found,{links:source.links||[]});else cachedCatalog.sources.push({...source,text:null});
    }
    const byId=new Map(items.map(item=>['assignment:'+item.courseId+':'+item.id,item]));
    for(const source of cachedCatalog.sources){const item=byId.get(source.id);if(item)Object.assign(source,C().feedbackInfo(item,accountId));}
    if(feedbackEnabled())
      for(const item of items)
        if(C().feedbackInfo(item,accountId).hasComments&&cachedCatalog.sources.some(s=>s.id==='assignment:'+item.courseId+':'+item.id)){
          const source=C().feedback(item,{},accountId,origin);
          cachedCatalog.sources.push({...source,text:null});
        }
    catalogInputs=content===undefined?snapshot(inputs):content;
   }
   if(native||!handoff)return {ctx,...cachedCatalog};
   const h=handoff,key=viewKey(raw),extraSources=[];let genericValid=true;
   for(const [id,record]of h.generic){
     const found=genericHandoffSources(record.request,{ctx,...cachedCatalog});
     if(found.length!==1||found[0].source.id!==id||!sameData(found[0].input,record.input))genericValid=false;else extraSources.push(found[0].source);
   }
   if(h.catalog!==cachedCatalog||h.currentView!==key||h.genericValid!==genericValid||!sameData(h.genericInputs,extraSources)){
    const byId=new Map([...cachedCatalog.sources,...extraSources].map(s=>[s.id,s])),
      selected=h.refs.map(ref=>byId.get(ref.id)),
      available=genericValid&&
        selected.every((s,i)=>
          s&&
            s.kind===h.refs[i].kind&&
            s.courseId===h.refs[i].courseId&&
            (h.generic.has(s.id)||courses.some(c=>String(c.id)===s.courseId&&owned(c)))&&
            (s.kind!=='feedback'||teacherFeedback)),
      noteIds=available?handoffNoteIds(selected,cachedCatalog.sources,ctx):new Set(),
      valid=h.viewKey===key&&available&&selected.every(s=>s.kind!=='note'||noteIds.has(s.id)),
      ids=new Set(selected.filter(Boolean).map(s=>s.id));
    h.sources=valid?[...selected,...(selected.length?cachedCatalog.sources.filter(s=>s.kind==='note'&&!ids.has(s.id)):[])]:[];
    h.active=valid?selected.find(s=>s.id===h.activeId)||null:null;
    h.invalid=!valid;
    h.catalog=cachedCatalog;
    h.currentView=key;
    h.selectedIds=valid?selected.map(s=>s.id):[];
    h.genericValid=genericValid;
    h.genericInputs=snapshot(extraSources);
   }
   const active=h.active,first=active||h.sources[0],courseId=first?.courseId||'all',pageKind=active?'assignment':first?.kind==='note'?'notes':first?.kind||'dashboard';
   return {
     ctx:{
       ...ctx,
       active:null,
       item:null,
       itemId:active?.assignmentId||'',
       aiAssignmentId:active?.assignmentId||null,
       aiSelectedIds:h.selectedIds,
       courseId,
       page:{kind:pageKind,courseId,itemId:active?.assignmentId||''},
       pageKind,
       selectedText:'',
       draft:undefined,
       nextAssessment:undefined,
       biscuitContext:{now:biscuit.now,timeZone:biscuit.timeZone,maxChars:biscuit.maxChars},
       biscuitData:undefined
     },
     sources:h.sources,
     active,
     biscuitInvalid:h.invalid
   };
  }
  function summary(){
   const {ctx,sources,active,biscuitInvalid}=current();
   const key=scopeKey(),
     courseId=ctx.courseId||'all',
     theme=ctx.s?.theme==='dark'||ctx.s?.theme==='system'&&root.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light',
     motion=ctx.s?.motion||'gentle',
     taking=quizTaking(),
     biscuit=world(ctx),
     contextBudget=Math.max(1,Math.min(C().MAX_LIMIT,Math.floor(Number(ctx.maxChars??ctx.contextBudget??biscuit.maxChars)||C().LIMIT))),
     momentInputs=[
       ctx.page,
       ctx.pageKind,
       ctx.selectedText,
       biscuit.page,
       biscuit.pageKind,
       biscuit.selectedText,
       courseId,
       ctx.s?.timeZone||biscuit.timeZone||ctx.timeZone,
       help?.id,
       handoff?.id,
       biscuitInvalid,
       level,
       contextBudget
     ];
   if(!cachedHelp||summarySources!==sources||summaryActive!==active||!sameData(momentInputs,helpInputs)){
     const at=stamp(biscuit.now??ctx.now);
     cachedHelp={
       ...C().helpContext(ctx,{sources,active,now:Number.isFinite(at)?at:Date.now(),origin}),
       level,
       maxChars:contextBudget,
       requested:!!help||!!handoff,
       feedbackRequested:helpFeedback(),
       ...(help?{id:help.id}:handoff?{id:'biscuit-'+handoff.id}:{})
     };
     helpInputs=snapshot(momentInputs);
   }
   if(cachedSummary&&
     summarySources===sources&&
     summaryActive===active&&
     cachedSummary.helpContext===cachedHelp&&
     cachedSummary.scopeKey===key&&
     cachedSummary.courseId===courseId&&
     cachedSummary.autoSend===autoSend&&
     cachedSummary.bringAnswers===bringAnswers&&
     cachedSummary.teacherFeedback===feedbackEnabled()&&
     cachedSummary.showGrades===ctx.s.showGrades&&
     cachedSummary.level===level&&
     cachedSummary.theme===theme&&
     cachedSummary.motion===motion&&
     cachedSummary.quizTaking===taking)
     return cachedSummary;
   const courseNames=new Map((ctx.courses||[]).map(c=>[String(c.id),c.shortName||c.name])),
     pack=[
       ...C().contextSources(sources,active,{now:cachedHelp.now}),
       ...(helpFeedback()?sources.filter(s=>s.kind==='feedback'&&s.assignmentId===active?.assignmentId&&s.courseId===active?.courseId):[])
     ],
     provenance=new Map(pack.map(source=>
       [
         source.id,
         {
           ...(source.contextOf?{contextOf:source.contextOf}:{}),
           ...(source.attachmentOf?{attachmentOf:source.attachmentOf}:{}),
           ...(source.relationship?{relationship:source.relationship}:{})
         }
       ]));
   summarySources=sources;summaryActive=active;
   return cachedSummary={
     selectedIds:Array.isArray(ctx.aiSelectedIds)?ctx.aiSelectedIds.filter(id=>handoff||!String(id).startsWith('feedback:')):pack.slice(0,C().MAX_SOURCES).map(s=>s.id),
     scopeKey:key,
     courseId,
     contextBudget,
     active:active?{...C().inferenceItem(active),courseName:active.courseName||courseNames.get(active.courseId)||''}:null,
     helpContext:cachedHelp,
     ...(help||handoff?{intent:'help'}:{}),
     ...(handoff?{biscuitInvalid:!!biscuitInvalid}:{}),
    courses:(ctx.courses||[]).map(c=>({id:String(c.id),name:c.shortName||c.name})),
    sources:[
      ...new Map([...sources,...pack].map(s=>[s.id,s])).values()
    ].map(({id,title,kind,courseName,courseId,url,text,size,assignmentId,due,description,workKind,submissionTypes,gradedAt,hasTeacherComments,hasRubric})=>
      ({
        id,
        title,
        kind,
        courseName:courseName||courseNames.get(courseId)||'',
        courseId,
        url,
        ...provenance.get(id),
        ...(kind==='assignment'||kind==='feedback'?{assignmentId,due}:kind==='note'&&assignmentId?{assignmentId}:{}),
        ...(kind==='assignment'?{description,workKind,submissionTypes,gradedAt,hasTeacherComments,hasRubric:hasRubric===true}:{}),
        loaded:typeof text==='string',
        size
      })),
    demo,autoSend,bringAnswers,teacherFeedback:feedbackEnabled(),showGrades:ctx.s.showGrades,level,theme,motion,quizTaking:taking};
  }
  function helpWith({itemId,page,selectedText=''}={}){
   if(dead||quizTaking()||typeof selectedText!=='string'||selectedText.length>C().MAX_LIMIT)return false;
   if(itemId!==undefined&&
     (!['string','number'].includes(typeof itemId)||typeof itemId==='number'&&!Number.isFinite(itemId)||!String(itemId).trim()||String(itemId).length>256||/[\u0000-\u001f\u007f]/.test(String(itemId))))
     return false;
   if(page!==undefined&&typeof page!=='string'&&(!page||typeof page!=='object'||Array.isArray(page)))return false;
   const raw=getContext(),
     key=viewKey(raw),
     {sources,active,ctx}=current(true),
     chosen=itemId===undefined?active:sources.find(s=>s.kind==='assignment'&&s.assignmentId===String(itemId)),
     biscuit=world(raw),
     nativeId=String(raw.aiAssignmentId||raw.active?.assignmentId||raw.active?.id||biscuit.itemId||biscuit.selectedItemId||biscuit.page?.itemId||''),
     id=chosen?.assignmentId||String(itemId??nativeId),
     courseId=chosen?.courseId||String(raw.courseId&&raw.courseId!=='all'?raw.courseId:biscuit.courseId||raw.courseId||'all'),
     missing=!chosen&&!!id;
   if(missing&&
     (!client?.readAssignment||
       id!==nativeId||
       !/^\d+$/.test(id)||
       !/^\d+$/.test(courseId)||
       !ctx.courses.some(c=>String(c.id)===courseId&&owned(c))||
       inventory(raw).items.some(item=>item.id===id&&item.courseId===courseId&&(item.locked||item.personal))))
     return false;
   const next={
     id:String(++helpSeq),
     viewKey:key,
     itemId:id,
     courseId,
     page:snapshot(page??raw.page??{kind:raw.pageKind||biscuit.pageKind||(chosen||missing?'assignment':'dashboard')}),
     selectedText:selectedText.trim()
   };
   handoff=null;helpError=null;pendingHelp=missing?next:null;help=missing?null:next;cachedHelp=null;return true;
  }
  function clearHelp(){handoff=help=pendingHelp=helpError=null;cachedHelp=null;}
  async function readAssignment(courseId,id,signal,stage=false){
   const requestScope=handoff&&!stage?scopeKey():null,data=await client.readAssignment(courseId,id,{user:{id:accountId},signal,authScope:readScopes.get(signal)});
   if(String(data?.id)!==String(id)||data.course_id!=null&&String(data.course_id)!==String(courseId)||!owned(data))
     throw Error('The assignment does not match the selected course. Review the sources again.');
   const inventoryNow=inventory(getContext()),course=inventoryNow.courses.find(c=>String(c.id)===String(courseId));
   // Select instructional fields only; keep topic facts absent from a partial assignment read.
   const core=root.ReserveCore||(typeof require==='function'?require('./core.js'):null),
     loaded=resources.get(String(courseId))||list(getContext().aiResources).find(r=>String(r.courseId)===String(courseId)),
     quiz=loaded?.quizzes?.find(q=>String(q.id)===String(data.quiz_id)),
     group=loaded?.assignmentGroups?.find(g=>String(g.id)===String(data.assignment_group_id)),
     facts=core?.normalizeAssignment({...data,submission:undefined,quiz,assignment_group:group},course||{id:courseId});
   const previous=inventoryNow.items.find(x=>String(x.id)===String(id)&&String(x.courseId)===String(courseId)),
     item={
       ...previous,
       ...facts,
       requireInitialPost:facts?.requireInitialPost??previous?.requireInitialPost,
       userCanSeePosts:facts?.userCanSeePosts??previous?.userCanSeePosts,
       replyToEntryRequiredCount:facts?.replyToEntryRequiredCount??previous?.replyToEntryRequiredCount,
       checkpoints:Array.isArray(data.sub_assignments)||Array.isArray(data.checkpoints)||Array.isArray(data.discussion_topic?.checkpoints)?
         facts?.checkpoints:
         previous?.checkpoints||facts?.checkpoints,
       quiz:facts?.quiz||previous?.quiz,
       assignmentGroup:facts?.assignmentGroup||previous?.assignmentGroup,
       id:String(data.id),
       courseId:String(courseId),
       name:data.name,
       description:data.description,
       rubric:data.rubric??previous?.rubric,
       hasRubric:data.hasRubric===true||!Array.isArray(data.rubric)&&previous?.hasRubric===true,
       kind:typeof data.kind==='string'?data.kind:previous?.kind,
       workKind:data.workKind||previous?.workKind,
       submissionTypes:data.submission_types||data.submissionTypes||previous?.submissionTypes,
       dueAt:Object.hasOwn(data,'due_at')?data.due_at:data.dueAt??previous?.dueAt,
       done:previous?.done===true,
       courseName:course?.shortName||course?.name||'',
       url:origin+'/courses/'+courseId+'/assignments/'+id,
       ...C().feedbackInfo({...previous,...data},accountId)
     };
   const key=String(courseId)+':'+String(id),input=snapshot(previous);if(stage)return {key,item,input};
   if(requestScope)assertScope(requestScope);freshAssignments.set(key,item);freshInputs.set(key,input);return C().assignment(item,origin);
  }
  function finishCatalog(){
   if(pendingHelp){
     const next=pendingHelp,{sources}=current();
     if(pendingHelp===next){
       if(dead||quizTaking())
         pendingHelp=null;
       else if(sources.some(s=>s.kind==='assignment'&&s.assignmentId===next.itemId&&s.courseId===next.courseId)){help=next;pendingHelp=null;cachedHelp=null;}
       else throw Error('The assignment is unavailable. Review the sources again.');
     }
   }
   return summary();
  }
  function assertCatalogScope(key,signal){
    assertScope(key);
    if(signal?.aborted)throw Error('Context gathering cancelled.');
    if(quizTaking())throw Error('The Canvas view changed. Review the sources for the new page.');
  }
  async function catalog({signal}={}){
   const key=scopeKey(),{ctx,active}=current();if(helpError)throw helpError.error;
   // Native assignment routes need not have a dashboard cache yet.
   if(ctx.aiAssignmentId&&!active&&client?.readAssignment&&/^\d+$/.test(String(ctx.courseId))){
    let load=catalogLoad;
    if(!load||load.key!==key||load.signal!==signal){
     const courseId=String(ctx.courseId),id=String(ctx.aiAssignmentId),view=viewKey(getContext());load={key,signal};catalogLoad=load;
     load.promise=(async()=>{
      try{
       assertCatalogScope(key,signal);await verify(signal);assertCatalogScope(key,signal);
       const fetched=await readAssignment(courseId,id,signal,true);await verify(signal);assertCatalogScope(key,signal);
       if(!inventory(getContext()).courses.some(c=>String(c.id)===courseId&&owned(c)))throw Error('Choose an available course.');
       freshAssignments.set(fetched.key,fetched.item);freshInputs.set(fetched.key,fetched.input);finishCatalog();return prepareCatalog({signal,refreshed:true});
      }catch(error){
        if(pendingHelp?.viewKey===view&&pendingHelp.itemId===id&&pendingHelp.courseId===courseId){pendingHelp=null;helpError={viewKey:view,error};}
        throw error;
      }
      finally{if(catalogLoad===load)catalogLoad=null;}
     })();
    }
    return load.promise;
   }
   finishCatalog();return prepareCatalog({signal});
  }
  async function loadAuxiliary(key,signal){
   if(auxiliary.loaded||typeof client?.list!=='function')return;
   const ctx=getContext(),
     data=root.CanvasHarnessAgentData||(typeof require==='function'?require('./agent-data.js'):null),
     courses=inventory(ctx).courses,
     moment=stamp(ctx.now),
     now=Number.isFinite(moment)?moment:Date.now();
   const staff=await data.loadCourseStaff({client,user:{id:accountId},courses,signal});assertCatalogScope(key,signal);
   const [
     calendarEvents,
     conversations
   ]=await Promise.all([
     data.loadCalendarEvents({client,user:{id:accountId},courses,now,signal}),
     data.loadInbox({client,user:{id:accountId},courses,staff,now,signal})
   ]);
   assertCatalogScope(key,signal);
   Object.assign(auxiliary,{agentCourseStaff:staff,calendarEvents,conversations,loaded:true});
  }
  // Discover the same bounded Help chain before publishing review rows. Files
  // can remain pending: their IDs are known, and they cannot introduce links.
  function rememberLinked(source){
   // Discovery and collection share one metadata projection. Context-only fields
   // (text, attachmentOf, warnings, MIME) must not invalidate the source roster.
   const {id,kind,courseId,courseName,title,url,slug,fileId,sourceKey,size,links=[]}=source;
   linkedMaterials.set(id,{id,kind,courseId,courseName,title,url,slug,fileId,sourceKey,size,links});
  }
  async function prepareCatalog({signal,refreshed=false}={}){
   const key=scopeKey(),view=current();
   if(!help||handoff||!view.active)return summary();
   if(preparedCatalog?.key===key&&preparedCatalog.sources===view.sources)return summary();
   if(preparingCatalog?.key===key&&preparingCatalog.signal===signal)return preparingCatalog.promise;
   const load={key,signal};preparingCatalog=load;
   load.promise=(async()=>{
    try{
     await verify(signal);assertCatalogScope(key,signal);await loadAuxiliary(key,signal);
     const cid=view.active.courseId;
     if(client?.loadCourseResources&&!resources.has(cid)&&!list(current().ctx.aiResources).some(r=>String(r.courseId)===cid))await loadCourse(cid,{signal});
     assertCatalogScope(key,signal);
     if(!refreshed)await material(current().active,signal);
     assertCatalogScope(key,signal);
     const fresh=current(),
       at=stamp(world(fresh.ctx).now??fresh.ctx.now),
       pack=C().contextSources(fresh.sources,fresh.active,{now:Number.isFinite(at)?at:Date.now()}),
       byId=new Map(fresh.sources.map(s=>[s.id,s])),
       queue=pack.map(source=>({source,depth:source.linkDepth??0})),
       seen=new Set();
     while(queue.length&&seen.size<C().MAX_SOURCES){
      assertCatalogScope(key,signal);const {source,depth}=queue.shift();if(seen.has(source.id))continue;seen.add(source.id);
      let read=source;
      if(source.id!==fresh.active.id&&['page','module','discussion','assignment'].includes(source.kind)){
       try{read=await material(source,signal);}catch(error){if(signal?.aborted||/^(?:auth|account|aborted|cancelled)$/.test(error.code||''))throw error;}
      }
      assertCatalogScope(key,signal);
      if(['page','file','module','discussion'].includes(read.kind))rememberLinked(read);
      byId.set(read.id,read);
      if(depth<3)for(const link of read.links||[]){
       const id=C().linkId(link),
         target=byId.get(id)||
           {
             ...link,
             id,
             title:link.title||(link.kind==='page'?link.slug.replace(/-/g,' '):'Linked document '+(link.fileId||link.sourceKey||link.assignmentId)),
             courseName:read.courseName,
             text:null,
             links:[]
           };
       if(!seen.has(id))queue.push({source:target,depth:depth+1});
      }
     }
     await verify(signal);assertCatalogScope(key,signal);preparedCatalog={key,sources:current().sources};return summary();
    }finally{if(preparingCatalog===load)preparingCatalog=null;}
   })();
   return load.promise;
  }
   async function loadCourse(courseId,{signal,force=false}={}){
   const key=scopeKey(),id=String(courseId);
   if(!inventory(getContext()).courses.some(c=>String(c.id)===id))throw Error('Choose an available course.');
   await verify(signal);
   if(!client?.loadCourseResources)throw Error('Course materials are unavailable on this page.');
    const raw=await client.loadCourseResources(id,{user:{id:accountId},signal,force,assignments:inventory(getContext()).items});assertScope(key);
   if(!demo&&(raw.origin!==origin||String(raw.accountId)!==accountId))throw Error('The course materials belong to another Canvas session.');
   resources.set(id,raw);
   if(client.loadCourseUpdates){
     const news=await client.loadCourseUpdates(id,{user:{id:accountId},signal,authScope:readScopes.get(signal)});
     assertScope(key);
     if(!owned(news)||news?.courseId!=null&&String(news.courseId)!==id)throw Error('The course updates belong to another Canvas session.');
     updates.set(id,news);
   }
   await verify(signal);assertScope(key);return summary();
  }
  async function download(file,{signal,fileId,courseId}={}){
    return C().memoRead(
      client,
      JSON.stringify(['pdf',accountId,String(courseId||file.course_id||''),String(fileId),null,file.size,file.updated_at||'']),
      signal,
      ()=>downloadFresh(file,{signal,fileId}));
  }
  async function downloadFresh(file,{signal,fileId}={}){
   if(Number(file.size)>MAX_BYTES)throw Error('Larger than 2 MiB. Choose a smaller document.');
   // Metadata commonly points straight to a signed storage host. Start at
   // Canvas using the selected link's ID so its normal authorization applies;
   // never trust or copy that arbitrary, short-lived metadata download URL.
   if(!/^\d+$/.test(String(fileId||''))||file.id!=null&&String(file.id)!==String(fileId))throw Error('The metadata does not match the selected file. Refresh Canvas and try again.');
   const url=new URL('/files/'+fileId+'/download',origin);
   const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,15000);
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   try{
    // Only a verified Canvas file endpoint starts the download. Canvas may
    // redirect to its signed file host; no Canvas cookies or referrer go there.
    // The browser still enforces CORS. Never put the signed URL into context.
    client?.reserveRead?.();const response=await fetchImpl(url.href,{method:'GET',credentials:'same-origin',redirect:'follow',referrerPolicy:'no-referrer',signal:controller.signal});
    if(response.url&&/^\/(?:login|logout|saml|oauth|login_sessions)(?:\/|$)/i.test(new URL(response.url).pathname))throw Object.assign(Error('Sign in to Canvas.'),{code:'auth'});
    if(response.status===401)throw Object.assign(Error('Sign in to Canvas.'),{code:'auth'});
    if(!response.ok||response.type==='opaqueredirect'||response.url&&new URL(response.url).protocol!=='https:')throw Error('Canvas did not allow a secure file read.');
    if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('Larger than 2 MiB. Choose a smaller document.');
    const reader=response.body?.getReader();if(!reader)throw Error('This browser cannot read the file safely.');
    const chunks=[];let length=0;
    try{
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        length+=value.length;
        if(length>MAX_BYTES){await reader.cancel();throw Error('Larger than 2 MiB. Choose a smaller document.');}
        chunks.push(value);
      }
    }finally{reader.releaseLock();}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const type=response.headers.get('content-type')||'';
    if(bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-'){
     if(!parsePDF)throw Error('PDF reading is unavailable. Reload the extension.');
     return await parsePDF(bytes,{signal:controller.signal});
    }
    if(/^text\/plain(?:;|$)/i.test(type)){const text=new TextDecoder().decode(bytes);return {text:text.slice(0,C().MAX_LIMIT),truncated:text.length>C().MAX_LIMIT,warnings:[]};}
    throw Error('Only text PDFs and plain-text files can be included. Open other documents in Canvas.');
   }catch(error){
    if(controller.signal.aborted)throw Error('File reading was cancelled or took too long.');
    if(error instanceof TypeError)throw Error('Canvas redirected or blocked this download. Download it in Canvas and attach the small PDF here.');
    throw error;
   }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  // Reopening Help shares verified material, not another download of the same source.
  async function material(source,signal,options={}){
   const ctx=getContext(),
     match=i=>String(i.courseId||i.course_id)===source.courseId&&String(i.assignmentId||i.id)===source.assignmentId,
     biscuit=world(ctx),
     input=source.kind==='assignment'?[list(ctx.items).find(match),list(biscuit.items||biscuit.assignments||biscuit.workItems).find(match)]:null,
     reader=client?.[({assignment:'readAssignment',feedback:'readSubmissionFeedback',page:'readCoursePage',file:'readFile',module:'readModule',discussion:'readDiscussion'})[source.kind]],
     key=JSON.stringify([
       source.id,
       gradesShown(ctx),
       options.pdfOnly===true,
       options.includeAssignmentPdfs!==false,
       input||(reader?[source.updatedAt||source.updated_at||'',source.slug||source.fileId||'']:source.text)
     ]),
     old=materialCache.get(key);
   // A replaced reader or changed source invalidates the dependency, even within the TTL.
   if(source.kind!=='feedback'&&old&&old.reader===reader&&Date.now()-old.at<300000&&(old.complete||old.signal===signal)){
     const value=await old.promise;
     return value?{...value,contextOf:source.contextOf,attachmentOf:source.attachmentOf,relationship:source.relationship}:value;
   }
   const entry={at:Date.now(),signal,reader,promise:uncachedMaterial(source,signal,options)};
   materialCache.set(key,entry);
   if(materialCache.size>128)materialCache.delete(materialCache.keys().next().value);
   try{
     const value=await entry.promise;
     entry.complete=true;
     return value;
   }catch(error){materialCache.delete(key);if(/^(?:auth|account|cancelled)$/.test(error.code||''))materialCache.clear();throw error;}
  }
  async function uncachedMaterial(source,signal,{pdfOnly=false,includeAssignmentPdfs=true}={}){
    if(source.kind==='module'&&client?.readModule){
     const raw=await client.readModule(source.courseId,source.sourceKey,{user:{id:accountId},signal,authScope:readScopes.get(signal)});
     if(raw.locked_for_user||raw.published===false)throw Error('This module is locked or unavailable.');
     // Module members can be absent from every standalone library listing.
     const children=list(raw.items).filter(i=>!i.locked_for_user&&!i.hidden_for_user&&!i.locked&&i.published!==false),links=[];
     for(const i of children){
       const type={Page:'page',File:'file',Assignment:'assignment',Discussion:'discussion',Module:'module'}[i.type],key=type==='page'?i.page_url:i.content_id;
       if(!type||!key)continue;
       const path={page:'pages',file:'files',assignment:'assignments',discussion:'discussion_topics',module:'modules'}[type];
       links.push(...C().links('<a href="/courses/'+source.courseId+'/'+path+'/'+encodeURIComponent(key)+'">Material</a>',origin,source.courseId));
     }
     return {
       ...source,
       title:C().plain(raw.name||source.title),
       text:[C().plain(raw.name||source.title),C().moduleInfo(raw,current().ctx.s?.timeZone||current().ctx.timeZone),...children.map(i=>C().plain(i.title))].join('\n'),
       links
     };
    }
   if(source.kind==='discussion'&&client?.readDiscussion){
     const raw=await client.readDiscussion(source.courseId,source.sourceKey,{user:{id:accountId},signal,authScope:readScopes.get(signal)}),
       data=root.CanvasHarnessAgentData||(typeof require==='function'?require('./agent-data.js'):null),
       text=data.staffText(raw,current().ctx,source.courseId,gradesShown(getContext()));
     return {
       ...source,
       text:[raw.require_initial_post?'Post before viewing other replies.':'',text].filter(Boolean).join('\n\n'),
       links:C().links(data.staffText(raw,current().ctx,source.courseId,true,true),origin,source.courseId)
     };
   }
   if(source.kind==='feedback'){
    if(!current().sources.some(s=>s.id===source.id)||!feedbackEnabled())throw Error('Teacher feedback is turned off.');
    if(!client?.readSubmissionFeedback)throw Error('Teacher feedback is unavailable on this page.');
    const submission=await client.readSubmissionFeedback(source.courseId,source.assignmentId,{user:{id:accountId},signal,authScope:readScopes.get(signal)}),
      ctx=getContext(),
      item=freshAssignments.get(source.courseId+':'+source.assignmentId)||
        (ctx.items||[]).find(x=>String(x.courseId)===source.courseId&&String(x.id)===source.assignmentId);
    if(!item)throw Error('The assignment changed. Review the sources again.');
    const data=root.CanvasHarnessAgentData||(typeof require==='function'?require('./agent-data.js'):null);
    let staff=data.courseStaff(current().ctx,source.courseId);
    if(!staff.size&&typeof client?.list==='function'){
      auxiliary.agentCourseStaff=await data.loadCourseStaff({client,user:{id:accountId},courses:inventory(getContext()).courses,signal});
      staff=data.courseStaff(current().ctx,source.courseId);
    }
    return C().feedback(item,submission,accountId,origin,staff);
   }
   if(source.kind==='assignment'&&!source.assignmentId.startsWith('quiz-')&&client?.readAssignment&&!demo&&source.relationship!=='Recent related work')
     return readAssignment(source.courseId,source.assignmentId,signal);
   if(source.kind==='page'&&client?.readCoursePage){
    const html=await client.readCoursePage(source.courseId,source.slug,{user:{id:accountId},signal,authScope:readScopes.get(signal)});
    return {...source,text:C().plain(html),links:C().links(html,origin,source.courseId)};
   }
   if(source.kind==='file'){
    if(!client?.readFile)throw Error(demo?'PDF download is not available in this artificial preview.':'File reading is unavailable.');
    const file=await client.readFile(source.courseId,source.fileId,{user:{id:accountId},signal,authScope:readScopes.get(signal)});
    const title=file.display_name||file.filename||source.title,isPDF=/^application\/pdf(?:;|$)/i.test(file['content-type']||file.content_type||'')||/\.pdf$/i.test(title);
    if(pdfOnly&&!isPDF||source.attachmentOf&&isPDF&&!includeAssignmentPdfs)return null;
    try{
     const result=await download(file,{signal,fileId:source.fileId,courseId:source.courseId});
     return {...source,title,mime:isPDF?'application/pdf':file['content-type'],text:result.text,truncated:result.truncated,warnings:result.warnings||[]};
    }catch(error){error.sourceTitle=title;throw error;}
   }
   return source;
  }
  async function collect(options={}){
    const found=await verify(options.signal),scope=client?.createReadScope?.(found,options.signal),before=readScopes.get(options.signal);
    if(scope)readScopes.set(options.signal,scope);
    try{
      return await collectBody(options);
    }catch(error){if(/^(?:auth|account)$/.test(error.code||'')){materialCache.clear();client?.invalidateSources?.();C().clearMemo?.(client);}throw error;}finally{
      client?.endReadScope?.(scope);
      if(readScopes.get(options.signal)===scope){if(before)readScopes.set(options.signal,before);else readScopes.delete(options.signal);}
    }
  }
  async function collectBody({
    ids=[],
    selectedIds,
    all=false,
    includeAssignmentPdfs=true,
    includeLinkedMaterials=true,
    includeLinked=includeLinkedMaterials,
    maxChars=C().LIMIT,
    signal
  }={}){
   const key=scopeKey();assertScope(key);
   if(all)await loadAuxiliary(key,signal);
   if((all||help)&&client?.loadCourseResources){
     const currentView=current(),cid=currentView.active?.courseId;
     if(cid&&!resources.has(cid)&&!list(currentView.ctx.aiResources).some(r=>String(r.courseId)===cid))await loadCourse(cid,{signal});
   }
   assertScope(key);
   const {sources,active,ctx,biscuitInvalid}=current(),
     at=stamp(world(ctx).now??ctx.now),
     now=Number.isFinite(at)?at:Date.now(),
     byId=new Map([...C().contextSources(sources,active,{now}),...sources].map(s=>[s.id,s]));
   if(biscuitInvalid)throw Error('The Biscuit context changed. Review the sources again.');
   for(const values of [ids,...(selectedIds===undefined?[]:[selectedIds])])
     if(!Array.isArray(values)||values.length>C().MAX_SOURCES||values.some(id=>typeof id!=='string'||!byId.has(id)))throw Error('The source selection changed. Review it before sharing.');
   if(all&&!active)throw Error('Open an assignment to gather all of its linked materials.');
   // Resolve generated sources from the same bounded pack the review displayed.
   const review=selectedIds===undefined?ids:selectedIds,
     assignments=review.map(id=>byId.get(id)).filter(source=>source.kind==='assignment'),
     chosen=all?[active]:active&&review.includes(active.id)?[active]:assignments.slice(0,1),
     packs=chosen.flatMap(source=>
       [
         ...C().contextSources(sources,source,{now}),
         ...(helpFeedback()?sources.filter(s=>s.kind==='feedback'&&s.assignmentId===source.assignmentId&&s.courseId===source.courseId):[])
       ]),
     packById=new Map(packs.map(source=>[source.id,source])),
     automatic=all&&selectedIds===undefined,
     allowed=new Set(review),
     roots=new Set((all?[active]:assignments).map(s=>s.id));
   const seed=automatic?packs:review.map(id=>packById.get(id)||byId.get(id)),
     queue=seed.filter(source=>includeLinked!==false||!source.attachmentOf).map(source=>({source,depth:source.linkDepth??0})),
     seen=new Set(),
     resolved=[];
   while(queue.length&&resolved.length<C().MAX_SOURCES){
    if(signal?.aborted)throw Error('Context gathering cancelled.');assertScope(key);
    const {source,depth,pdfOnly}=queue.shift();if(seen.has(source.id))continue;seen.add(source.id);
    let read;try{read=await material(source,signal,{pdfOnly,includeAssignmentPdfs});}catch(error){
     if(signal?.aborted||/^(?:auth|account|aborted|cancelled)$/.test(error.code||''))throw error;
     read={...source,title:error.sourceTitle||source.title,text:'',error:String(error.message||'This source could not be read.')};
    }
    if(!read)continue;
    assertScope(key);resolved.push(read);
    if(['page','file','module','discussion'].includes(read.kind))rememberLinked(read);
    if(includeLinked!==false&&depth<3&&(automatic||roots.has(read.id)||source.attachmentOf))for(const link of read.links||[]){
     const id=C().linkId(link);
     const directPdf=!help&&!handoff&&includeAssignmentPdfs&&read.kind==='assignment'&&depth===0&&link.kind==='file'&&selectedIds===undefined;
     if(!automatic&&!allowed.has(id)&&!directPdf)continue;
     if(!seen.has(id))
       queue.push({
         source:{
           ...(byId.get(id)||{...link,id,title:link.title||(link.kind==='page'?link.slug.replace(/-/g,' '):'Linked document '+link.fileId),courseName:source.courseName,text:null}),
           attachmentOf:source.attachmentOf||source.id
         },
         depth:depth+1,
         pdfOnly:!automatic&&!allowed.has(id)
       });
    }
   }
   await verify(signal);assertScope(key);if(signal?.aborted)throw Error('Context gathering cancelled.');
   const latest=current();if(latest.biscuitInvalid)throw Error('The Biscuit context changed. Review the sources again.');
   if(resolved.some(s=>s.kind==='feedback'&&!latest.sources.some(available=>available.id===s.id)))throw Error('Teacher feedback changed or was turned off. Review the sources again.');
    // One synchronous publication uses one roster, including every omission notice.
    // Collect the selected sources at their actual budget. The panel knows the chosen
    // shape and can measure its real frame; reserving every kind's schema here cut
    // a needed PDF to one line even in a 14.7K-character single-kind message.
    const showGrades=gradesShown(getContext()),privacy=C().privacyContext(current().ctx),result=C().bundle(resolved,{maxChars,showGrades,privacy});
    if(queue.length)
      for(const {source}of queue)if(!result.included.some(s=>s.id===source.id))result.omitted.push({title:source.title,reason:'Not available in this context: the 30-source limit was reached.'});
   for(const s of resolved)for(const warning of s.warnings||[])result.omitted.push({title:s.title,reason:warning});
   result.omitted=result.omitted.map(row=>{
     const clean=C().filterSource({title:row.title,text:row.reason},{showGrades,privacy});
     return {title:clean.title,reason:clean.text};
   });
   return {...result,scopeKey:key};
  }
  function catalogReady(){
    return !help||
      !!handoff||
      !current().active||
      ![client?.list,client?.readAssignment,client?.readCoursePage,client?.readModule,client?.readDiscussion].some(fn=>typeof fn==='function')||
      preparedCatalog?.key===scopeKey()&&preparedCatalog.sources===current().sources;
  }
  async function studyTool({scopeKey:key,tool}={}){
   const isCurrent=()=>{
     assertScope(key);
     if(quizTaking()||!owned(getContext())||root.ReserveFeatures&&!root.ReserveFeatures.enabled('ai'))throw Error('Study tools are unavailable in the current Canvas view.');
     return true;
   };
   isCurrent();const Tools=root.CanvasHarnessStudyTools;if(!Tools?.run)throw Error('Reload Canvas Harness to use study tools.');
   const toolContext=()=>{isCurrent();const {ctx,sources,biscuitInvalid}=current();if(biscuitInvalid)throw Error('The Biscuit context changed. Review the current tools.');
    const available=inventory(ctx);
    return {
      ...ctx,
      origin,
      accountId,
      owner:store.owner||{origin,accountId},
      items:available.items,
      courses:available.courses,
      sources,
      studyAids:ctx.studyAids||available.biscuit.studyAids||{},
      featureCatalogue:root.ReserveFeatures?.catalogue||[],
      now:Date.now()
    };
   };
   // No text gathering, profile request, or model response triggers this method. Only a tool tap does.
   return Tools.run(tool,{scopeKey:key,getContext:toolContext,isCurrent});
  }
  return {summary,catalog,catalogReady,loadCourse,collect,verify,helpWith,clearHelp,setHandoff,studyTool,destroy(){
    dead=true;
    unsubscribe?.();
    materialCache.clear();
    resources.clear();
    updates.clear();
    freshAssignments.clear();
    freshInputs.clear();
    linkedMaterials.clear();
    preparedCatalog=preparingCatalog=null;
    handoff=help=pendingHelp=helpError=catalogLoad=null;
    catalogInputs=cachedCatalog=cachedSummary=summarySources=summaryActive=selectionSnapshot=helpInputs=cachedHelp=null;
  }};
 }
 // An already-open PDF reader can hand one explicit text selection to the same
 // AI panel and provider setup as the Canvas toolbox. No PDF URL, background
 // scraping, new AI endpoint or automatic network sharing is needed.
 function createPdfHandoff({origin,accountId,fileId,name,text,page,endPage=page,appearance,intent}={}){
  let school;try{school=new URL(origin);}catch{throw Error('Invalid PDF selection origin.');}
  if(school.protocol!=='https:'||school.origin!==origin||!/^\d+$/.test(String(fileId))||!/^\d+$/.test(String(accountId)))
    throw Error('The PDF selection must belong to a verified Canvas account and file.');
  if(!Number.isSafeInteger(page)||page<0||!Number.isSafeInteger(endPage)||endPage<page||typeof text!=='string'||!text.trim()||text.length>100000)
    throw Error('Choose up to 100,000 characters from pages of one PDF.');
  const study=['practice','reading','lab','notes'].includes(intent);
  const title=String(name||'Canvas PDF').slice(0,240),pages=endPage===page?'page '+(page+1):'pages '+(page+1)+'–'+(endPage+1),id='pdf-page:'+fileId+':'+page+(endPage===page?'':'-'+endPage);
  // Background's existing verifyAccount() expects origin|accountId at the
  // front of every source scope; the actual account is verified twice there.
  const scopeKey=[origin,String(accountId),'pdf-page',String(fileId),String(page)+(endPage===page?'':'-'+endPage),String(text.length)].join('|');
  const source={id,title:title+' · '+pages,kind:'file',courseId:'all',loaded:true};
  const selected='[PDF text: '+title+', '+pages+']\n'+text.trim();
  let dead=false,metadata;
  function ensure(){if(dead)throw Error('This PDF selection is closed and its context is unavailable.');}
  function summary(){
    ensure();
    const theme=appearance?.theme==='dark'?'dark':'light';
    if(!metadata||metadata.theme!==theme)metadata={scopeKey,selectedIds:[id],courseId:'all',active:null,courses:[],sources:[source],demo:false,
   autoSend:false,
   theme,
   motion:'gentle',
   ...(study?{intent,page,endPage}:{helpContext:{requested:true,page:{kind:'pdf',itemId:id},item:{id,title,type:'file',instructions:text},now:Date.now()}})
    };
   return metadata;
  }
  return {summary,catalog:async()=>summary(),loadCourse:async()=>{throw Error('Choose the PDF selection already shown.');},
   async collect({ids=[],all=false}={}){
    ensure();if(all||!Array.isArray(ids)||ids.length!==1||ids[0]!==id)throw Error('The selected PDF text changed. Review the selection again.');
    return {scopeKey,text:selected,included:[{id,title:source.title,kind:'file',courseId:'all'}],omitted:[],sources:[{id,label:title,text:text.trim()}]};
   },destroy(){dead=true;}};
 }
 function base64(bytes){let value='';for(let i=0;i<bytes.length;i+=16384)value+=String.fromCharCode(...bytes.subarray(i,i+16384));return root.btoa(value);}
 async function overnightRequest(scopeKey,op,data={}){
   const reply=await root.chrome.runtime.sendMessage({target:'ch-overnight',scopeKey,op,...data});
   if(!reply?.ok)throw Error(reply?.error||'Prep folder is unavailable.');
   return reply.result;
 }
 async function prepare(source,force=false,canPrepare=true){
   const catalog=source.summary(),scope=catalog.scopeKey;
   let result=await overnightRequest(scope,'visit',{force,canPrepare});
   if(result.needPrepare){
     const wishes=await root.CanvasHarnessStudyUI.createStore(root).getWishes(scope),
       items=await root.CanvasHarnessOvernight.buildItems({catalog,wishes,collect:request=>source.collect(request)});
     if(source.summary().scopeKey!==scope)throw Error('The Canvas view changed.');
     result=await overnightRequest(scope,'write',{items,force});
   }
   if(result.allow&&root.document?.body&&!root.document.querySelector('.ch-overnight-allow')){
     const button=root.document.createElement('button');
     button.className='ch-overnight-allow';
     button.textContent='Allow the prep folder';
     button.type='button';
     button.addEventListener('click',()=>{void overnightRequest(scope,'folder').then(()=>button.remove(),error=>{button.textContent=error.message;});});
     root.document.body.append(button);
   }
   return result;
 }
 async function visit({snapshot,store,client,user=snapshot?.user,canPrepare=false}={}){
   if(!root.chrome?.runtime?.id||root.ReserveFeatures&&!root.ReserveFeatures.enabled('ai')||!snapshot||!user||quizTaking())return;
  if(root.CanvasHarnessAgentClient&&store.update){
    try{
      const courses=(snapshot.courses||[]).map(c=>root.ReserveCore?.normalizeCourse?.(c)||c),
        byId=new Map(courses.map(c=>[String(c.id),c])),
        items=(snapshot.assignments||[]).map(a=>a.courseId?a:root.ReserveCore?.normalizeAssignment?.(a,byId.get(String(a.course_id)))||a),
        resources=[];
      if(store.readResourceCache)for(const course of courses){const cached=await store.readResourceCache(course.id);if(cached)resources.push(cached);}
      const agent=root.CanvasHarnessAgentClient.ensure({
        getContext:()=>({items,courses,agentAssignments:snapshot.assignments,agentCourses:snapshot.courses,courseId:'all',aiResources:resources}),
        store,
        client,
        user
      });
      return await agent.visit();
    }catch(error){
      await store.update(data=>{data.toolbox||={};data.toolbox.agent||={};data.toolbox.agent.status=String(error.message||error).slice(0,300);}).catch(()=>{});
      return;
    }
  }
  if(!root.CanvasHarnessOvernight)return;
  const source=create({getContext:()=>({items:snapshot.assignments||[],courses:snapshot.courses||[],courseId:'all'}),store,client,user,parsePDF:async bytes=>{
    return overnightRequest(source.summary().scopeKey,'pdf',{base64:base64(bytes)});
  }});
  try{
    return await prepare(source,false,canPrepare&&store?.get?.()?.toolbox?.agent?.settings?.everyDay===true);
  }catch(error){
    if(root.document?.body&&!root.document.querySelector('.ch-overnight-error')){
      const label=root.document.createElement('p');
      label.className='ch-overnight-error';
      label.textContent=error.message;
      root.document.body.append(label);
    }
  }finally{
    source.destroy();
  }
 }
  function mount({container,getContext,store,client,user,demo=false,pdfHandoff=null,onClose=()=>{}}){
   let frame,port,dead=false,lastSignature='',lastHeartbeat=0,question=null,questionSeq=0,study=null,studySeq=0,aid=null,aidSeq=0,agentLogSeq=0,recovery=null,recoverySeq=0;
   let prefillInput,
     prefillQuestion,
     prefillStudy,
     prefillAid,
     prefillBringAnswers,
     prefillLevel,
     prefillData,
     lastData,
     lastSerialized='',
     prefillAgent='',
     prefillRecovery=null;
   const agent=pdfHandoff?null:root.CanvasHarnessAgentClient?.ensure({getContext,store,client,user,demo});
   let engineHelp=null,prefillEngine=null,engineHelpSeq=0;
   const withPrefill=data=>{
    if(study&&study.scopeKey!==data.scopeKey)study=null;
    if(aid&&aid.scopeKey!==data.scopeKey)aid=null;
    const bringAnswers=pdfHandoff?store.get?.()?.toolbox?.aiBringAnswers!==false:data.bringAnswers;
     const level=pdfHandoff?levelValue(store.get?.()?.toolbox?.aiLevel):data.level;
    const agentState=agent?.state(),agentSignature=agentState?JSON.stringify(agentState):'';
    if(data===prefillInput&&
      recovery===prefillRecovery&&
      question===prefillQuestion&&
      study===prefillStudy&&
      aid===prefillAid&&
      bringAnswers===prefillBringAnswers&&
      level===prefillLevel&&
      agentSignature===prefillAgent&&
      engineHelp===prefillEngine)
      return prefillData;
    prefillEngine=engineHelp;
    prefillInput=data;
    prefillRecovery=recovery;
    prefillQuestion=question;
    prefillStudy=study;
    prefillAid=aid;
    prefillBringAnswers=bringAnswers;
    prefillLevel=level;
    prefillAgent=agentSignature;
    if(agentState)data={...data,agent:agentState};
     if(pdfHandoff)data={...data,bringAnswers,level};
    if(study){
      const active=data.sources.find(s=>s.kind==='assignment'&&String(s.assignmentId)===study.itemId)||null;
      data={...data,active,selectedIds:active?[active.id]:[],ponyStudy:{id:study.id,kind:study.kind,itemId:study.itemId}};
    }
    if(recovery&&recovery.scope===data.scopeKey.split('|').slice(0,2).join('|'))data={...data,prepareReply:recovery};
    if(agentLogSeq)data={...data,agentLog:{id:String(agentLogSeq)}};
    if(aid)data={...data,openAid:{id:aid.id,key:aid.key,...(aid.missed?{missed:true}:{})}};
    if(engineHelp)data={...data,engineHelp:{id:engineHelp.id,status:engineHelp.status}};
    if(question?.fromBand&&(!data.helpContext?.requested||question.scopeKey!==data.scopeKey))return prefillData=data;
    if(question?.handoff){
     const h=question.handoff,
       invalid=data.biscuitInvalid||question.scopeKey!==data.scopeKey,
       selected=data.sources.filter(s=>data.selectedIds.includes(s.id)),
       target=selected.find(s=>s.id===data.active?.id)||selected[0],
       labels=C().filterSource({title:invalid?'':target?.title||'',courseName:invalid?'':target?.courseName||''},{showGrades:data.showGrades===true}),
       metadata={
         mode:h.mode,
         kind:h.kind,
         kinds:[...h.kinds],
         course:labels.courseName,
         item:labels.title,
         itemId:invalid?'':target?.assignmentId||target?.id||'',
         courseId:invalid?'':target?.courseId||'',
         wishes:question.text
       };
     return prefillData={...data,agent:null,...(invalid?{biscuitInvalid:true}:{}),ponyQuestion:{id:question.id,text:question.text,handoff:metadata}};
    }
    return prefillData=question?{...data,ponyQuestion:question}:data;
   };
  const runtime=root.chrome?.runtime,preview=demo&&!runtime?.id&&/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(root.location?.origin||'');
  async function parsePDF(bytes){
   if(!runtime?.id)throw Error('Install the extension to read PDFs locally.');
   const response=await runtime.sendMessage({type:'ch-ai-pdf',base64:base64(bytes)});if(!response?.ok)throw Error(response?.error||'PDF text could not be read.');return response.result;
  }
  const source=pdfHandoff?createPdfHandoff(pdfHandoff):create({getContext,store,client,user,demo,parsePDF});
  const send=message=>{
    if(dead)return;
    if(preview)frame?.contentWindow?.postMessage({type:'ch-ai-reply',reply:message},root.location.origin);else try{port?.postMessage(message);}catch{}
  };
  async function request(message){
   const {id,action}=message||{};if(typeof id!=='string'||id.length>100)return;
   if(action==='close'){onClose();send({id,ok:true,result:{}});return;}
   try{
     let result;if(action==='catalog')result=withPrefill(await source.catalog());
     else if(action==='overnight')result=await prepare(source,true);
     else if(action==='load-course')result=withPrefill(await source.loadCourse(message.courseId));
    else if(action==='collect')result=await source.collect(message);
    else if(action==='study-tool'){
     if(preview||pdfHandoff||!source.studyTool)throw Error('Study tools need an open Canvas Harness workspace.');
     result=await source.studyTool({scopeKey:message.scopeKey,tool:message.tool});
    }
    else if(action==='agent'){
      if(!agent||quizTaking())throw Error('Your AI is unavailable on this page.');
      if(['importReply','resume'].includes(message.op)){
        const reply=await runtime.sendMessage({
          target:'ch-ai-engine',
          op:message.op,
          scopeKey:source.summary().scopeKey.split('|').slice(0,2).join('|'),
          runId:message.runId,
          turnId:message.turnId,
          text:message.question
        });
        if(!reply?.ok)throw Error(reply?.error||'Prepare could not read the reply.');
        result=reply.result;
        recovery=null;
        prefillInput=null;
        lastData=null;
        update();
      }
      else if(message.op==='run'){
        if(typeof(message.question??'')!=='string'||(message.question||'').length>4000)throw Error('Ask a shorter question.');
        void agent.run(message.question||'',message.provider).then(()=>{lastData=null;update();}).catch(error=>{
          void store.update(data=>{data.toolbox.agent.status=String(error.message||error).slice(0,300);}).then(()=>{lastData=null;update();}).catch(()=>{});
        });
        result=agent.state();
      }
      else if(message.op==='stop')
        result=await agent.stop();
      else if(message.op==='undo')
        result=await agent.undo(message.runId,message.actionId);
      else if(message.op==='answer')
        result=await agent.answer(message.runId,message.actionId,message.value);
      else if(message.op==='dismiss')
        result=await agent.dismiss(message.runId,message.actionId);
      else if(message.op==='forget')result=await agent.forget(message.memoryId);else if(message.op==='settings')result=await agent.settings(message.settings);else throw Error('Unknown agent operation.');
    }
    else if(action==='preference'){
      const keys=['autoSend','bringAnswers','teacherFeedback','level'].filter(key=>Object.hasOwn(message,key)),
        names={autoSend:'aiAutoSend',bringAnswers:'aiBringAnswers',teacherFeedback:'aiTeacherFeedback',level:'aiLevel'};
      if(!keys.length||keys.some(key=>key!=='level'&&typeof message[key]!=='boolean'))throw Error('Choose a panel option.');
      await store.update(data=>{data.toolbox||={};for(const key of keys)data.toolbox[names[key]]=key==='level'?levelValue(message[key]):message[key];});result={saved:true};
    }
    else if(preview)throw Error('This artificial preview cannot connect accounts or open AI chats. Install Canvas Harness to use this feature.');
    else return;
    send({id,ok:true,result});
   }catch(error){send({id,ok:false,error:String(error.message||'Context could not be loaded.')});}
  }
  function onPreview(event){if(preview&&event.origin===root.location.origin&&event.source===frame.contentWindow&&event.data?.type==='ch-ai-request')request(event.data.request);}
  frame=document.createElement('iframe');frame.className='rd-ai-frame';frame.title='AI study workspace';frame.referrerPolicy='no-referrer';
  frame.src=runtime?.id?runtime.getURL('ai-panel.html'):new URL('../extension/ai-panel.html?preview=1',root.location.href).href;
  if(preview)root.addEventListener('message',onPreview);
  function connect(){
   if(dead||port||!runtime?.id)return;
   try{
    const next=runtime.connect({name:'ch-ai-source'});port=next;lastSignature='';lastHeartbeat=Date.now();
    next.onMessage.addListener(message=>{if(port===next&&message.kind==='source-request')request(message);});
    next.onDisconnect.addListener(()=>{if(port===next){port=null;lastSignature='';}});
   }catch{port=null;}
  }
  container.append(frame);
  let timer=0,reviewLoad=null;
  const visible=()=>
    !dead&&
      !root.document.hidden&&
      container.isConnected!==false&&
      !frame.hidden&&
      !container.closest?.('[hidden],dialog:not([open])')&&
      (frame.checkVisibility?frame.checkVisibility({checkVisibilityCSS:true,visibilityProperty:true}):!frame.getClientRects||frame.getClientRects().length>0);
  const stopPolling=()=>{root.clearInterval(timer);timer=0;};
  function update(){
   if(!visible()){stopPolling();return;}
   if(!timer)timer=root.setInterval(update,1200);
   try{
    if(!preview)connect();
    // Warm Help also has asynchronous sources. Publish its catalog only after
    // discovery; an old mounted panel must not receive a partial default pack.
    if(source.catalogReady?.()===false){
     if(!reviewLoad)reviewLoad=source.catalog().then(()=>{reviewLoad=null;update();},()=>{reviewLoad=null;});
     return;
    }
     const data=withPrefill(source.summary());
     if(data!==lastData){lastSerialized=JSON.stringify(data);lastData=data;}
     const signature=lastSerialized;
    if(signature!==lastSignature){lastSignature=signature;send({kind:'catalog',data});}
    // Keep this open tool connected without republishing a catalog that would
    // invalidate in-progress context. Reconnect and resend metadata after sleep.
    if(port&&Date.now()-lastHeartbeat>=20000){port.postMessage({kind:'ping'});lastHeartbeat=Date.now();}
   }catch{}
  }
  frame.addEventListener('load',()=>{lastSignature='';update();});
  // Metadata only. Requests fetch text explicitly; no chat or credentials cross into this document.
  const visibility=()=>{if(!visible())stopPolling();else if(!timer)update();};
  root.document.addEventListener?.('visibilitychange',visibility);
  // Toolbox panels stay mounted when switched, collapsed or closed. Observe
  // just this ancestry (including shadow hosts), without watching page content.
  const observer=root.MutationObserver?new root.MutationObserver(visibility):null;
  for(let node=frame;observer&&node;node=node.parentElement||node.getRootNode?.()?.host)
    observer.observe(node,{attributes:true,attributeFilter:['hidden','open','style','class','data-collapsed','data-leaving']});
  // Help with one assignment: the engine reads its materials and makes one deliverable; the panel opens it when ready.
  const engineScope=()=>source.summary().scopeKey.split('|').slice(0,2).join('|');
  function onEngineRun(message,sender){
    const run=message?.target==='ch-ai-run'&&(!sender?.id||sender.id===runtime?.id)?message.run:null;
    if(dead||!engineHelp?.runId||!run||run.id!==engineHelp.runId)return;
   if(run.state==='cards-ready'){engineHelp=null;aid={id:String(++aidSeq),key:'ask:'+run.id+':0',scopeKey:source.summary().scopeKey};}
   else engineHelp={...engineHelp,status:run.needsYou?.reason||run.progress||'Working'};update();}
  runtime?.onMessage?.addListener?.(onEngineRun);
  function helpItem(options={}){
   const itemId=String(options.itemId||'');if(dead||pdfHandoff||quizTaking()||!runtime?.sendMessage||!/^[\w:.-]{1,60}$/.test(itemId))return false;
   let day;
   try{
     day=new Intl.DateTimeFormat('en-CA',{timeZone:store.get?.()?.settings?.timeZone||undefined,year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now());
   }catch{day=new Date().toISOString().slice(0,10);}
   source.clearHelp?.();question=null;study=null;aid=null;const id=String(++engineHelpSeq);engineHelp={id,status:'Checking Canvas'};update();
   Promise.resolve(runtime.sendMessage({
     target:'ch-ai-engine',
     op:'ask',
     scopeKey:engineScope(),
     requestId:'help-'+(root.crypto?.randomUUID?.()||Date.now()).toString().replace(/[^\w-]/g,''),
     day,
     question:'Make the help for this item.',
     itemId,
     ...(options.courseId?{courseId:String(options.courseId)}:{}),
     make:'auto'
   })).then(
     reply=>{
     if(dead||engineHelp?.id!==id)return;
     engineHelp=reply?.ok?{id,runId:reply.result?.id,status:reply.result?.progress||'Checking Canvas'}:{id,status:reply?.error||'Help is unavailable here.'};
     update();
   },error=>{if(!dead&&engineHelp?.id===id){engineHelp={id,status:String(error?.message||error)};update();}});
   return true;
  }
  function helpWith(options={}){
   const text=options.text;
   if(text!==undefined&&(typeof text!=='string'||!text.trim()||text.length>20000))return false;
   if(dead||pdfHandoff||quizTaking()||!source.helpWith(options))return false;aid=null;question=null;study=null;
   const pending=!source.summary().helpContext?.requested;
   // Use the same typed-question delivery as Biscuit, retaining native Help's scope and review.
   if(text!==undefined)question={id:String(++questionSeq),text:text.trim(),fromBand:true,scopeKey:source.summary().scopeKey};
   const request=question;
   update();
   if(pending)
     void source.catalog().then(data=>{
       if(question===request&&request?.fromBand&&data.helpContext?.requested)question={...request,scopeKey:data.scopeKey};
       update();
     },()=>update());
   return true;
  }
  visibility();
   return {update,helpWith,helpItem,async openPrepareReply(run){
     if(dead||pdfHandoff||quizTaking())return false;
     const reply=await runtime.sendMessage({target:'ch-ai-engine',op:'review',scopeKey:source.summary().scopeKey.split('|').slice(0,2).join('|'),runId:run.id});
     if(!reply?.ok)throw Error(reply?.error||'Prepare reply is unavailable.');
     if(dead)return false;
     recovery={...reply.result,id:String(++recoverySeq)};
     prefillInput=null;
     lastData=null;
     update();
     return true;
   },openAgentLog(){
     if(dead||pdfHandoff||quizTaking())return false;
     agentLogSeq++;
     prefillInput=null;
     lastData=null;
     update();
     return true;
   },setQuestion(value,handoff){
     if(dead||quizTaking()||typeof value!=='string'||!value.trim()||handoff!=null&&pdfHandoff)return false;
     const h=handoff==null?null:source.setHandoff(handoff);
     if(handoff!=null&&!h)return false;
     if(!h)source.clearHelp?.();
     aid=null;
     study=null;
     question={id:String(++questionSeq),text:(h?h.wishes:value.trim().slice(0,240)),...(h?{handoff:h,scopeKey:source.summary().scopeKey}:{})};
     if(agent&&!h)void agent.run(question.text).then(()=>{lastData=null;update();}).catch(()=>{});
     update();
     return true;
   },setStudy({kind,itemId}={}){
     if(dead||
       pdfHandoff||
       kind==='notes'&&quizTaking()||
       !['practice','reading','lab','rubric','fixes','notes','steps','outline','message','summary','flashcards'].includes(kind)||
       !['string','number'].includes(typeof itemId)||
       typeof itemId==='number'&&!Number.isFinite(itemId)||
       !String(itemId).trim()||
       String(itemId).length>256||
       /[\u0000-\u001f\u007f]/.test(String(itemId)))
       return false;
     source.clearHelp();
     aid=null;
     question=null;
     study={id:String(++studySeq),kind,itemId:String(itemId),scopeKey:source.summary().scopeKey};
     update();
     return true;
   },openAid(key,options){
     if(dead||pdfHandoff||typeof key!=='string'||!key||key.length>512)return false;
     source.clearHelp();
     question=null;
     study=null;
     aid={id:String(++aidSeq),key,scopeKey:source.summary().scopeKey,...(options?.missed===true?{missed:true}:{})};
     update();
     return true;
   },focus(){
     frame.focus();
   },destroy(){
     dead=true;
     runtime?.onMessage?.removeListener?.(onEngineRun);
     stopPolling();
     observer?.disconnect();
     root.document.removeEventListener?.('visibilitychange',visibility);
     root.removeEventListener('message',onPreview);
     source.destroy();
     port?.disconnect();
     frame.remove();
   }};
 }
 root.CanvasHarnessAISource={create,createPdfHandoff,mount,base64,visit,prepare,MAX_BYTES};
 if(typeof module==='object'&&module.exports)module.exports=root.CanvasHarnessAISource;
})(globalThis);
