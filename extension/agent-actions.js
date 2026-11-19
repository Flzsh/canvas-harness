/* Canvas Harness agent actions change account-local tools only. Every saved change carries its inverse. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAgentActions=api;
})(globalThis,function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null),
  Agent=load('CanvasHarnessAgent','./agent-prompts.js'),
  Study=load('CanvasHarnessStudy','./study-prompts.js'),
  UI=load('CanvasHarnessStudyUI','./study-ui.js'),
  Arrange=load('ReserveWorkspaceArrange','./workspace-arrange.js'),
  Clock=load('CanvasHarnessAgentClock','./agent-clock.js');
 const DAY=86400000,
  clone=v=>v===undefined?undefined:structuredClone(v),
  object=v=>v&&typeof v==='object'&&!Array.isArray(v),
  words=v=>String(v||'').trim().split(/\s+/).filter(Boolean).length;
 function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
 }
 // everyDay: Prepare may start on its own (first visit of the day, Canvas changes) only after the student chose Every day.
 const DEFAULTS={on:true,way:'web',grades:false,everyDay:false,dailyCap:3,wishes:''},quiz=url=>/\/quizzes\/[^/?#]+\/(?:take|resume)(?:[/?#]|$)|\/assessment_sessions\//i.test(String(url||''));
 function state(data){data.toolbox||={};return data.toolbox.agent||=( {settings:{...DEFAULTS},memory:[],runs:[]} );}
 function migrateSettings(data,{apiSettings,overnightSettings}={}){
  const s=state(data),saved=s.settings||{};
  if(s.wayMigrated===true){if(!['web','api','overnight'].includes(saved.way))throw Error('Choose an AI way.');}
  else if(!['api','overnight'].includes(saved.way)){
   if(!object(apiSettings)||!object(overnightSettings))throw Error('Your AI connection settings could not be loaded.');
   saved.way=overnightSettings.enabled===true?'overnight':apiSettings.way==='api'?'api':'web';
  }
  s.settings={...DEFAULTS,...saved};
  s.wayMigrated=true;
  return s.settings;
 }
 function day(now,zone){return Clock.calendar(zone)(now).day;}
 function validDay(value){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 }
 function expire(memory,today){
  return (Array.isArray(memory)?memory:[]).filter(m=>
   m&&typeof m.id==='string'&&typeof m.fact==='string'&&(!m.until||validDay(m.until)&&m.until>=today)).slice(-Agent.LIMITS.memories);
 }
 const FIELDS=Agent.FIELDS;
 function shape(a){
  if(!object(a)||!Object.hasOwn(FIELDS,a.tool))throw Error('Unknown tool; Canvas writes are forbidden.');
  if(Object.keys(a).some(k=>k!=='tool'&&!FIELDS[a.tool].includes(k)))throw Error('Unknown action field.');
  const actions=[a];
  if(a.tool==='module'&&a.show==='aid')actions.push({tool:'make_aid',kind:a.aid,itemId:a.itemId,why:a.why});
  const parsed=Agent.parse('```chagent\n'+JSON.stringify({v:1,actions})+'\n```');
  if(!parsed.ok||!parsed.actions.some(row=>row.tool===a.tool))throw Error(parsed.errors.join(' '));
  if(a.why&&words(a.why)>Agent.LIMITS.why)throw Error('Why exceeds 18 words.');
  if(a.tool==='today'&&a.items.some(i=>Object.keys(i).some(k=>!['itemId','title','why','next'].includes(k))||words(i.why)>Agent.LIMITS.why))throw Error('Invalid Today entry.');
  if(a.tool==='make_aid'&&words(a.focus)>30)throw Error('Aid focus exceeds 30 words.');
  if(a.tool==='module'&&((a.aid!=null&&a.show!=='aid')||(a.items!=null&&a.show!=='checklist')||(a.files!=null&&a.show!=='files')))throw Error('Invalid module content fields.');
  for(const k of ['day','until'])if(a[k]&&!validDay(a[k]))throw Error('Invalid date.');
  if(a.tool==='review'&&!validDay(a.at))throw Error('Invalid date.');
  return a;
 }
 const entities=value=>Array.isArray(value)&&value.every(row=>object(row)&&typeof row.id==='string')&&new Set(value.map(row=>row.id)).size===value.length;
 function diff(before,after,path=[]){
  const out=[];
  for(const k of new Set([...Object.keys(before),...Object.keys(after)])){
   const had=Object.hasOwn(before,k),has=Object.hasOwn(after,k),a=before[k],b=after[k];
   if(had===has&&same(a,b))continue;
   if(had&&has&&object(a)&&object(b))
    out.push(...diff(a,b,[...path,k]));
   else if(k==='modules'&&path.length===2&&path[0]==='toolbox'&&path[1]==='agent'&&(!had||entities(a))&&(!has||entities(b)))
    out.push({path:[...path,k],type:'modules',had,has,before:clone(a||[]),after:clone(b||[])});
   else if(had&&has&&entities(a)&&entities(b))
    out.push({path:[...path,k],type:'entities',before:clone(a),after:clone(b)});
   else out.push({path:[...path,k],had,has,...(had?{before:clone(a)}:{}),...(has?{after:clone(b)}:{})});
  }
  return out;
 }
 const moduleValue=row=>{if(!row)return row;const {open,ticks,aidKey,...value}=row;return value;};
 const aidValue=row=>{if(!row)return row;const {progress,review,...value}=row;return value;};
 function reverse(target,patches){
  for(const p of patches.slice().reverse()){
   let node=target;
   for(const k of p.path.slice(0,-1)){if(!object(node[k]))throw Error('This value changed since the AI action.');node=node[k];}
   const k=p.path.at(-1);
   if(p.type==='entities'||p.type==='modules'){
    if(!entities(node[k]))throw Error('This value changed since the AI action.');
    const rows=node[k],
     before=new Map(p.before.map(r=>[r.id,r])),
     after=new Map(p.after.map(r=>[r.id,r])),
     matches=p.type==='modules'?(a,b)=>same(moduleValue(a),moduleValue(b)):same;
    for(const row of p.after){
     const old=before.get(row.id),current=rows.find(r=>r.id===row.id);
     if(matches(old,row))continue;
     if(!current||!matches(current,row))throw Error('This value changed since the AI action.');
     if(old)rows.splice(rows.indexOf(current),1,clone(old));else rows.splice(rows.indexOf(current),1);
    }
    for(const [i,row]of p.before.entries())if(!after.has(row.id)){if(rows.some(r=>r.id===row.id))throw Error('This value changed since the AI action.');rows.splice(Math.min(i,rows.length),0,clone(row));}
    if(p.type==='modules'&&!p.had&&!rows.length)delete node[k];
    continue;
   }
   const matches=p.type==='aid'?(a,b)=>same(aidValue(a),aidValue(b)):same;
   if(Object.hasOwn(node,k)!==p.has||p.has&&!matches(node[k],p.after))throw Error('This value changed since the AI action.');
   if(p.had)node[k]=clone(p.before);else delete node[k];
  }
 }
 function create({
  store,
  index=new Map(),
  modules=[],
  reader={cache:new Map()},
  scope,
  external,
  now=()=>Date.now(),
  uuid=()=>root.crypto.randomUUID(),
  url=()=>root.location?.href||'',
  guard=()=>true,
  getLiveContext,
  aidKeys,
  aidIdentity=false
 }={}){
  const active=data=>{if(quiz(url()))throw Error('Your AI is unavailable on quiz-taking pages.');if(!guard(data))throw Error('The Canvas account or run changed.');};
  const runOf=(data,id)=>{const r=state(data).runs.find(r=>r.id===id);if(!r)throw Error('Run not found.');return r;};
  const known=(id,what,data=store.get())=>{
   const row=index.get(String(id));
   if(!row||row.locked||row.locked_for_user||what&&!(Array.isArray(what)?what:[what]).includes(row.what))throw Error('Unknown or forbidden id: '+String(id));
   const local=String(id).startsWith('local:')||row.what==='local';
   if(local&&!(data.customTasks||[]).some(i=>String(i.id)===canvasId(row)))throw Error('This local item was removed.');
   if(getLiveContext&&
    row.what==='assignment'&&
    !local&&
    !(getLiveContext()?.items||[]).some(i=>String(i.id)===canvasId(row)&&String(i.courseId)===String(row.courseId)&&!i.locked&&!i.locked_for_user))
    throw Error('This assignment is no longer available.');
   return row;
  };
  const canvasId=row=>String(row.canvasId??row.item?.id??row.assignmentId??row.fileId??row.id.split(':').at(-1));
  function future(value,days=7,dateOnly=false,data=store.get()){
   const zone=data.settings?.timeZone||'America/New_York',today=day(now(),zone);
   if(dateOnly){
    if(!validDay(value)||value<today||value>new Date(Date.parse(today+'T12:00:00Z')+days*DAY).toISOString().slice(0,10))throw Error('Date is outside the allowed range.');
    return Clock.wall(value,0,zone)??NaN;
   }
   if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||!validDay(value.slice(0,10)))throw Error('Invalid reminder time.');
   const h=Number(value.slice(11,13)),m=Number(value.slice(14));
   if(h>23||m>59)throw Error('Invalid reminder time.');
   const at=Clock.wall(value.slice(0,10),h*60+m,zone,now());
   if(at===null||at>now()+days*DAY)throw Error('Time is outside the next '+days+' days.');
   return at;
  }
  function check(a,data=store.get(),{runId,plannedAids=[]}={}){
   shape(a);
   if(a.itemId!=null)known(a.itemId,(a.tool==='make_aid'||a.tool==='plan'||a.tool==='module'&&['aid','countdown'].includes(a.show))?['assignment','local']:undefined,data);
   if(a.tool==='today')a.items.forEach(i=>{if(i.itemId!=null)known(i.itemId,undefined,data);});
   if(a.tool==='make_aid')(a.sources||[]).forEach(id=>known(id,undefined,data));
   if(a.tool==='home'||a.tool==='module'){
    const valid=new Map([...modules,...(state(data).modules||[])].map(m=>[m.id,m]));
    if(a.tool==='home'){
     for(const k of ['order','show','hide','wide']){
      if(a[k]&&new Set(a[k]).size!==a[k].length)throw Error('Duplicate Home module.');
      for(const id of a[k]||[])if(!valid.has(id))throw Error('Unknown Home module.');
     }
     for(const id of a.hide||[])if(valid.get(id).pinned||['work','reader'].includes(id))throw Error('Cannot hide a pinned or required Home module.');
     if((a.show||[]).some(id=>(a.hide||[]).includes(id)))throw Error('Home show and hide overlap.');
    }
    else{
     if(a.until<day(now(),data.settings?.timeZone))throw Error('Module has already expired.');
     if(a.place&&a.place!=='top'&&(!valid.has(a.place)||!Arrange.snapshot(data.settings).order.includes(a.place)))throw Error('Unknown or hidden Home module placement.');
     if(a.show==='countdown'){
      const row=known(a.itemId,['assignment','local'],data),value=row.item?.dueAt??row.dueAt,at=typeof value==='number'?value:Date.parse(value);
      if(!Number.isFinite(at)||at<=0)throw Error('This item has no known deadline.');
     }
     if(a.show==='files'){if(new Set(a.files.map(String)).size!==a.files.length)throw Error('Duplicate module file.');a.files.forEach(id=>known(id,['pdf','file','page'],data));}
     if(a.show==='aid'){
      const pending=runId?runOf(data,runId).actions.filter(e=>e.action?.tool==='make_aid'&&['pending','kept'].includes(e.outcome)).map(e=>e.action):[];
      if(![...pending,...plannedAids].some(row=>{
       if(String(row.itemId)!==String(a.itemId)||row.kind!==a.aid)return false;
       try{check(row,data);return true;}catch{return false;}
      }))
       throw Error('An aid module needs the same item and kind made in this run.');
     }
    }
   }
   if(a.tool==='plan')future(a.day,Agent.LIMITS.planDays,true,data);
   if(a.tool==='remind'||a.tool==='say'&&a.at)future(a.at,7,false,data);
   if(a.tool==='review'){if(aidKeys&&!aidKeys.includes(a.aidKey))throw Error('Unknown saved aid.');future(a.at,14,true,data);}
   if(a.tool==='remember'&&a.until&&a.until<day(now(),data.settings?.timeZone))throw Error('Memory has already expired.');
   if(a.tool==='pdf_mark'){
    known(a.fileId,['pdf','file'],data);
    if(a.page>10000||!reader.cache.get(a.fileId+'@'+a.page)?.includes(a.quote))throw Error('Quote was not found in the text read from that PDF page.');
   }
   return a;
  }
  async function logged(runId,entry){active();await store.update(data=>{active(data);runOf(data,runId).actions.push(entry);});return entry;}
  async function reject(runId,action,error){
   return logged(runId,{id:'a-'+uuid(),action:clone(action),why:action?.why||'',outcome:'rejected',error:String(error?.message||error).slice(0,300)});
  }
  const itemInfo=row=>
   ({
    id:row.id,
    canvasId:canvasId(row),
    title:row.title||row.item?.name||'',
    dueAt:row.item?.dueAt??row.dueAt??null,
    url:row.url||'',
    kind:row.item?.kind||row.kind||row.what,
    courseId:row.courseId||''
   });
  async function local(a,runId,plannedAids=[]){
   const entry={id:'a-'+uuid(),action:clone(a),why:a.why||'',outcome:'kept'};
   await store.update(data=>{
    active(data);
    check(a,data,{runId,plannedAids});
    const s=state(data);
    s.memory=expire(s.memory,day(now(),data.settings?.timeZone));
    const before=clone(data),gradeAccess=runOf(data,runId).grades===true;
   if(a.tool==='today'){
    s.today=clone(a.items);
    s.todayRunId=runId;
    s.todayRefs=Object.fromEntries(a.items.filter(i=>i.itemId!=null).map(i=>[String(i.itemId),itemInfo(known(i.itemId,undefined,data))]));
   }
   if(a.tool==='plan'){
    const id='local-agent-'+uuid(),linked=a.itemId?known(a.itemId,undefined,data):null;
    entry.createdId=id;
    if(gradeAccess)s.gradePlans=[...(s.gradePlans||[]),id];
    data.customTasks.push({
     id,
     name:a.title,
     courseId:linked?.courseId||'personal',
     dueAt:null,
     createdAt:new Date(now()).toISOString(),
     ...(linked&&linked.url?{source:{kind:'link',url:linked.url,title:linked.title||a.title}}:{})
    });
    data.tasks[id]={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:a.minutes,plannedDate:a.day,checklist:[]};
   }
   if(a.tool==='bookmark'){
    const row=known(a.itemId,undefined,data);
    if(['assignment','local'].includes(row.what)){
     const id=canvasId(row);
     data.tasks[id]={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:0,plannedDate:'',checklist:[],...data.tasks[id],pinned:true};
    }
    else{
     if(!row.url||!/^https:\/\//.test(row.url))throw Error('This material has no supported bookmark link.');
     if(!data.resourcePins.some(x=>x.id===row.id&&x.courseId===row.courseId))
      data.resourcePins.push({id:row.id,courseId:row.courseId,title:row.title,url:row.url,category:row.what,moduleName:''});
    }
   }
   if(a.tool==='note'){
    const value=data.toolbox.scratchpad||'';
    if(value.length+a.text.length+2>30000)throw Error('Notes are full.');
    data.toolbox.scratchpad=value+(value?'\n\n':'')+a.text;
    if(gradeAccess)s.gradeNotes=true;
   }
   if(a.tool==='remind'||a.tool==='say'){
    data.pet||={};
    const list=data.pet.reminders||=[];
    if(list.length>=20)throw Error('Reminder limit reached.');
    const text=a.text.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
    if(!text)throw Error('Reminder text is empty.');
    const at=a.at?future(a.at,7,false,data):now();
    list.push({id:'agent-'+uuid(),text,at,createdAt:now(),agent:true});
   }
   if(a.tool==='ask_user'){
    if(runOf(data,runId).actions.some(e=>e.action?.tool==='ask_user'&&e.outcome==='kept'))throw Error('Only one question per run.');
    s.questions||=[];
    s.questions.push({runId,actionId:entry.id,question:a.question,choices:clone(a.choices)});
    s.questions=s.questions.slice(-30);
   }
   if(a.tool==='remember'){
    if(s.memory.length>=Agent.LIMITS.memories)throw Error('Memory limit reached.');
    s.memory.push({id:'memory-'+uuid(),fact:a.fact,about:a.about,...(a.until?{until:a.until}:{}),...(gradeAccess?{gradeAccess:true}:{})});
   }
   if(a.tool==='forget'){if(!s.memory.some(m=>m.id===String(a.id)))throw Error('Unknown memory id.');s.memory=s.memory.filter(m=>m.id!==String(a.id));}
   if(a.tool==='home'){
    if((a.hide||[]).some(id=>(data.toolbox.agentPins||[]).includes(id)))throw Error('Cannot hide a pinned Home module.');
    for(const id of a.show||[])if(id==='context')data.settings.showCourseInformation=true;else Arrange.change(data.settings,{type:'add',key:id});
    for(const id of a.hide||[])if(id==='context')data.settings.showCourseInformation=false;else Arrange.change(data.settings,{type:'remove',key:id});
    for(const key of (a.order||[]).slice().reverse())Arrange.change(data.settings,{type:'dock',key,target:Arrange.ROOT,edge:'top'});
    if(a.wide)data.settings.moduleSize={...data.settings.moduleSize,...Object.fromEntries(a.wide.map(id=>[id,'l']))};
   }
   if(a.tool==='module'){
    if(runOf(data,runId).actions.filter(e=>e.action?.tool==='module'&&e.outcome!=='rejected').length>=Agent.LIMITS.modules)throw Error('Module limit reached for this run.');
    const id='ai-'+uuid(),row=a.itemId!=null?known(a.itemId,undefined,data):null;
    entry.createdId=id;
    s.modules||=[];
    if(!/^ai-[A-Za-z0-9_-]{1,36}$/.test(id)||s.modules.some(m=>m.id===id)||Object.hasOwn(data.settings.moduleSize||{},id)||Arrange.snapshot(data.settings).order.includes(id))
     throw Error('A unique module id could not be allocated.');
    s.modules.push({
     id,
     runId,
     actionId:entry.id,
     ...clone(a),
     createdAt:now(),
     open:a.open!==false,
     ticks:{},
     ...(row?{item:itemInfo(row)}:{}),
     ...(a.show==='files'?{files:a.files.map(fileId=>{
     const file=known(fileId,['pdf','file','page'],data);
     return {id:file.id,title:file.title||'',url:file.url||'',what:file.what,canvasId:canvasId(file),courseId:file.courseId||''};
    })}:{}),
    ...(a.show==='aid'?{aidKey:UI.aidKey({kind:a.aid,itemId:canvasId(row),...(aidIdentity?{answerId:'course-'+row.courseId}:{})})}:{}),
    ...(gradeAccess?{gradeAccess:true}:{})
    });
    while(s.modules.length>Agent.LIMITS.modules){
     const oldest=s.modules.filter(m=>m.id!==id).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))[0];
     s.modules.splice(s.modules.indexOf(oldest),1);
     if(Array.isArray(data.toolbox.agentPins))data.toolbox.agentPins=data.toolbox.agentPins.filter(key=>key!==oldest.id);
     Arrange.change(data.settings,{type:'remove',key:oldest.id});
     if(data.settings.moduleSize)delete data.settings.moduleSize[oldest.id];
    }
    Arrange.change(data.settings,{type:'add',key:id});
    Arrange.change(data.settings,{type:'dock',key:id,target:a.place&&a.place!=='top'?a.place:Arrange.ROOT,edge:'top'});
    if(a.size==='wide')data.settings.moduleSize={...data.settings.moduleSize,[id]:'l'};
   }
   entry.inverse=JSON.stringify(a.tool==='ask_user'?
    {
     target:'question',
     runId,
     actionId:entry.id,
     had:Object.hasOwn(before.toolbox.agent,'questions'),
     evicted:clone((before.toolbox.agent.questions||[]).slice(0,Math.max(0,(before.toolbox.agent.questions||[]).length+1-30))),
     patches:[]
    }:
    {target:a.tool==='module'?'module':'personal',...(a.tool==='module'?{moduleId:entry.createdId}:{}),patches:diff(before,data)});
   runOf(data,runId).actions.push(entry);
  });return entry;}
  async function externalChange(a,runId,key,change,entryId){
   if(!external)throw Error('Local storage is unavailable.');
   active();
   const before=await external.get(key);
   active();
   const after=await change(clone(before));
   active();
   const empty=a.tool==='pdf_mark'?{version:1,annotations:[]}:{};
   let patches=diff(before||empty,after||empty);
   if(a.tool==='make_aid'){
    const aidKey=UI.aidKey({kind:a.kind,itemId:canvasId(known(a.itemId)),...(aidIdentity?{answerId:'course-'+known(a.itemId).courseId}:{})}),
     had=before!==undefined&&Object.hasOwn(before,aidKey);
    patches=[{path:[aidKey],type:'aid',had,has:true,...(had?{before:clone(before[aidKey])}:{}),after:clone(after[aidKey])}];
   }
   const entry={id:entryId||'a-'+uuid(),action:clone(a),why:a.why||'',outcome:'pending',inverse:JSON.stringify({target:'external',key,had:before!==undefined,empty,patches})};
   if(aidIdentity&&key===UI.storageKey(scope)){
    const receipts=Object.entries(after.$engineReceipts||{}).slice(-127);
    after.$engineReceipts={...Object.fromEntries(receipts),[entry.id]:{runId,at:now()}};
   }
   await store.update(data=>{
    active(data);
    check(a,data);
    const run=runOf(data,runId),pending=run.actions.find(e=>e.id===entryId);
    if(entryId&&(!pending||pending.outcome!=='pending'||!same(pending.action,a)))throw Error('This aid action is no longer pending.');
    if(pending)Object.assign(pending,entry);else run.actions.push(entry);
   });
   try{
    active();
    await external.set(key,after,{expected:before,runId});
    active();
    await store.update(data=>{active(data);check(a,data);runOf(data,runId).actions.find(e=>e.id===entry.id).outcome='kept';});
    entry.outcome='kept';
   }catch(error){
    try{await external.set(key,before,{expected:after});}catch{}
    await store.update(data=>{
     active(data);
     const current=runOf(data,runId).actions.find(e=>e.id===entry.id);
     if(current){current.outcome='rejected';current.error=String(error.message||error).slice(0,300);}
    });
    error.agentLogged=true;
    throw error;
   }
   return entry;
  }
  async function apply(actions,runId){active();let selected=Array.isArray(actions)?actions:[];
   if(selected.length>Agent.LIMITS.actions){
    const valid=[],errors=[];
    selected.forEach((a,i)=>{try{shape(a);valid.push(a);}catch(error){errors.push('Action '+(i+1)+': '+String(error.message||error));}});
    selected=Agent.selectActions(valid);
    if(valid.length>selected.length)errors.push('Kept the '+Agent.LIMITS.actions+' highest-priority actions; skipped '+(valid.length-selected.length)+' extra actions.');
    if(errors.length)await store.update(data=>{active(data);runOf(data,runId).errors.push(...errors);});
   }
   const aids=[],counts={},plannedAids=[],used=runOf(store.get(),runId).actions.filter(e=>e.action?.tool==='make_aid'&&e.outcome!=='rejected').length;
   for(const a of selected)if(a?.tool==='make_aid'&&plannedAids.length<Agent.LIMITS.aids-used)try{check(a);plannedAids.push(a);}catch{}
   for(const a of selected){
    active();
    try{
     check(a,store.get(),{runId,plannedAids});
     counts[a.tool]=(counts[a.tool]||0)+1;
     if(['today','home','ask_user','say'].includes(a.tool)&&counts[a.tool]>1)throw Error('Only one '+a.tool+' action per run.');
     if(a.tool==='remind'&&
      runOf(store.get(),runId).actions.some(e=>
       e.outcome==='kept'&&
        e.action?.tool==='remind'&&
        e.action.at===a.at&&
        String(e.action.itemId??'')===String(a.itemId??'')&&
        e.action.text.replace(/\s+/g,' ').trim()===a.text.replace(/\s+/g,' ').trim()))
      throw Error('Only one reminder per timed event.');
     if(a.tool==='module'&&counts.module>Agent.LIMITS.modules)throw Error('Module limit reached for this run.');
     if(a.tool==='make_aid'){
      if(counts.make_aid+used>Agent.LIMITS.aids)throw Error('Aid limit reached.');
      const e={id:'a-'+uuid(),action:clone(a),why:a.why,outcome:'pending'};
      await store.update(data=>{active(data);check(a,data);runOf(data,runId).actions.push(e);});
      aids.push({action:a,entryId:e.id});
     }
    else if(a.tool==='pdf_mark'){
     const PDF=load('ReservePdfModel','./pdf-model.js');
     if(!PDF)throw Error('The PDF annotation model is unavailable.');
     const row=known(a.fileId),key=PDF.storageKey(store.owner.origin,store.owner.accountId,canvasId(row));
     await externalChange(a,runId,key,saved=>{
      const value=PDF.createAnnotations(saved).serialise();
      value.annotations.push({
       id:'agent-'+uuid(),
       type:'highlight',
       page:a.page-1,
       color:({yellow:'#F6DE7A',green:'#B7D69A',blue:'#A9D3F0',pink:'#F2B8D1'})[a.color||'yellow'],
       rects:[],
       points:[],
       point:null,
       quote:a.quote,
       text:a.note||''
      });
      return PDF.createAnnotations(value).serialise();
     });
    }
    else if(a.tool==='review'){
     const key=UI.storageKey(scope);
     await externalChange(a,runId,key,map=>{
      if(!map||!Object.hasOwn(map,a.aidKey)||!Object.values(map[a.aidKey].progress?.practice?.answers||{}).some(answer=>answer?.correct===false))throw Error('Unknown saved aid or no missed questions.');
      map[a.aidKey].review={due:future(a.at,14,true),step:0};
      return map;
     });
    }
    else await local(a,runId,plannedAids);
   }catch(error){if(!error.agentLogged)await reject(runId,a,error);}}return {aids};}
  async function saveAid(action,runId,entryId,text){
   active();
   try{
    check(action);
    const parsed=Study.parse(text,action.kind);
    if(!parsed.ok)throw Error(parsed.errors.join(' '));
    const current=store.get(),run=runOf(current,runId),pending=run.actions.find(e=>e.id===entryId);
    if(action.tool!=='make_aid'||!pending||pending.outcome!=='pending'||!same(pending.action,action))throw Error('This aid action is no longer pending.');
    const row=known(action.itemId,['assignment','local'],current),
     aid={
      v:1,
      kind:action.kind,
      itemId:canvasId(row),
      courseId:row.courseId,
      title:parsed.data.title,
      item:row.item?.name||row.title,
      savedAt:now(),
      data:parsed.data,
      progress:{},
      agent:true,
      runId,
      ...(aidIdentity?{answerId:'course-'+row.courseId,effectId:entryId}:{}),
      ...(run.grades?{gradeAccess:true}:{})
     };
    return await externalChange(action,runId,UI.storageKey(scope),map=>{
     map||={};
     const key=UI.aidKey(aid);
     if(!Object.hasOwn(map,key)&&Object.keys(map).filter(k=>k!=='$wishes').length>=40)throw Error('Saved aids are full.');
     map[key]=aid;
     return map;
    },entryId);
   }catch(error){
    await store.update(data=>{
     active(data);
     const entry=runOf(data,runId).actions.find(e=>e.id===entryId);
     if(entry&&entry.outcome==='pending'){entry.outcome='rejected';entry.error=String(error.message||error).slice(0,300);}
    });
    return null;
   }
  }
  function undoModule(data,inverse){
   const layout=inverse.patches.filter(p=>p.path[0]==='settings'),other=inverse.patches.filter(p=>p.path[0]!=='settings'),changed=layout.some(p=>{
    let node=data;
    for(const key of p.path.slice(0,-1))node=node?.[key];
    const key=p.path.at(-1);
    return !object(node)||Object.hasOwn(node,key)!==p.has||p.has&&!same(node[key],p.after);
   }),evicted=other.some(p=>p.type==='modules'&&p.before.some(row=>!p.after.some(next=>next.id===row.id)));
   if(changed&&evicted)throw Error('This module arrangement changed since the AI action.');
   reverse(data,other);
   if(Array.isArray(data.toolbox.agentPins))data.toolbox.agentPins=data.toolbox.agentPins.filter(key=>key!==inverse.moduleId);
   if((state(data).modules||[]).length>Agent.LIMITS.modules)throw Error('The module slots changed since the AI action.');
   if(!changed)
    reverse(data,layout);
   else{
    const had=Object.hasOwn(data.settings,'workspaceUndo'),previous=clone(data.settings.workspaceUndo);
    Arrange.change(data.settings,{type:'remove',key:inverse.moduleId});
    if(data.settings.moduleSize)delete data.settings.moduleSize[inverse.moduleId];
    if(previous?.layout){previous.layout=Arrange.prune(previous.layout,inverse.moduleId);previous.order=Arrange.leaves(previous.layout);}
    if(had)data.settings.workspaceUndo=previous;else delete data.settings.workspaceUndo;
   }
  }
  async function undo(runId,actionId){
   active();
   const entries=runOf(store.get(),runId).actions.filter(e=>(!actionId||e.id===actionId)&&['kept','done','dismissed'].includes(e.outcome)).slice().reverse();
   for(const entry of entries){
    active();
    const inverse=typeof entry.inverse==='string'?JSON.parse(entry.inverse):entry.inverse;
    if(!inverse)continue;
    if(!Array.isArray(inverse.patches)||inverse.patches.some(p=>!Array.isArray(p.path)||p.path.some(k=>typeof k!=='string'||['__proto__','constructor','prototype'].includes(k))))
     throw Error('Invalid Undo record.');
    if(inverse.target==='external'){
     if(inverse.key!==UI.storageKey(scope)&&!new RegExp('^reserve:pdf:'+store.owner.origin.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':'+store.owner.accountId+':\\d+$').test(inverse.key))
      throw Error('Undo belongs to another account.');
     await store.update(data=>{active(data);});
     const before=await external.get(inverse.key),current=clone(before||inverse.empty);
     reverse(current,inverse.patches);
     active();
     await external.set(inverse.key,!inverse.had&&same(current,inverse.empty)?undefined:current,{expected:before});
    }
    await store.update(data=>{
     active(data);
     const current=runOf(data,runId).actions.find(e=>e.id===entry.id);
     if(!['kept','done','dismissed'].includes(current?.outcome))return;
     if(inverse.target==='personal'){reverse(data,inverse.patches);if((state(data).memory||[]).length>Agent.LIMITS.memories)throw Error('The memory slots changed since the AI action.');}
     if(inverse.target==='module')undoModule(data,inverse);
     if(inverse.target==='question'){
      const s=state(data),rows=(s.questions||[]).filter(q=>q.runId!==runId||q.actionId!==entry.id),evicted=inverse.evicted||[];
      if(!Array.isArray(evicted)||rows.length+evicted.length>30||evicted.some(q=>!object(q)||rows.some(row=>row.runId===q.runId&&row.actionId===q.actionId)))
       throw Error('The question slots changed since the AI action.');
      s.questions=[...clone(evicted),...rows];
      if(!s.questions.length&&!inverse.had)delete s.questions;
      const run=runOf(data,runId);
      run.answers=(run.answers||[]).filter(a=>a.actionId!==entry.id);
     }
     runOf(data,runId).actions.find(e=>e.id===entry.id).outcome='undone';
    });
   }
   return true;
  }
  return {apply,undo,saveAid,reject,check};
 }
 return {create,DEFAULTS,state,migrateSettings,expire,day,validDay,quiz,diff,reverse};
});
