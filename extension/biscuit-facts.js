/* Attribute and relationship queries are resolved against owned, permission-filtered records. */
(function(root){
 'use strict';
 const load=(n,p)=>root[n]||(typeof module==='object'&&module.exports?require(p):null),
   list=v=>Array.isArray(v)?v:[],
   norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(),
   stamp=v=>typeof v==='number'?v:Date.parse(v),
   has=(v,k)=>v[k]!==undefined&&v[k]!==null,
   grades=s=>s.showGrades!==false&&s.settings?.showGrades!==false&&s.privacy?.grades!==false&&(s.showGrades===true||s.settings?.showGrades===true),
   MIN=60000;
 const operators=[
  {re:/\b(?:cost|price|fee)\b/i,keys:['price','cost','fee'],answer:'price',label:'Price'},
  {re:/\b(?:requirements?|prerequisites?)\b/i,keys:['requirements','prerequisites','prerequisite'],answer:'requirements',label:'Requirements'},
  {re:/\b(?:steps|procedure)\b/i,keys:['steps','procedure','instructions'],answer:'steps',label:'Steps'},
  {re:/\b(?:attempts?|tries|uploads? (?:left|allowed)|try again)\b/i,keys:['attemptsLeft','attemptsRemaining'],answer:'attemptsLeft',label:'Attempts left'},
  {re:/\b(?:quiz|exam|attempt)\b.*\b(?:minutes|time limit|how long)|\b(?:quiz minutes|time limit)\b/i,keys:['timeLimitMinutes','timeLimit','durationMinutes'],answer:'timeLimit',label:'Time limit'},
  {re:/\b(?:reply|response)\b.*\b(?:due|deadline|when)|\b(?:reply deadline|reply due)\b/i,keys:['replyDueAt'],answer:'replyDueAt',label:'Reply due',date:true},
  {re:/\b(?:initial|first|opening)\s+post\b.*\b(?:due|deadline|when|time)|\binitial post\b/i,keys:['initialPostDueAt','dueAt'],answer:'dueAt',label:'Initial post due',date:true},
  {re:/\b(?:due|deadline)\b/i,keys:['approvedDueAt','dueAt'],answer:'dueAt',label:'Due',date:true},
  {re:/\b(?:available until|availability|lock date|closes?|until when|how late.*submit)\b/i,keys:['availableUntil','lockAt'],answer:'availableUntil',label:'Available until',date:true},
  {re:/\b(?:points possible|points.*worth|how many points|maximum points|out of)\b/i,keys:['pointsPossible','possible'],answer:'pointsPossible',label:'Points possible'},
  {re:/\b(?:current|overall|course|total|average|percent|lowest)\b.*\b(?:grade|total|percent|average|class)|\b(?:grade|average|course total|overall %)\b/i,keys:['currentPercent','percent'],answer:'currentPercent',label:'Grade',private:true},
  {re:/\b(?:earned|my score|my mark|what.*scored|score out of)\b/i,keys:['score','value','grade'],answer:'score',label:'Score',private:true,kinds:['grade','feedback']},
  {re:/\b(?:teacher(?:s| s)?\s+(?:comments?|feedback)|original (?:words|note)|what.*(?:marked|commented)|returned (?:feedback|comments?))\b/i,keys:['teacherComments','feedback','comments'],answer:'teacherComments',label:'Teacher comments',private:true},
  {re:/\b(?:submitted|submission status|missing flag|late flag|handed in)\b/i,keys:['submissionStatus','status','submittedAt'],answer:'submissionStatus',label:'Submission status'},
  {re:/\b(?:file types?|allowed extensions?|submission types?|upload format|file format)\b/i,keys:['allowedExtensions','submissionTypes'],answer:'submissionTypes',label:'Submission'},
  {re:/\b(?:word count|how many words|minimum words|post length)\b/i,keys:['minimumWords','wordCount','requiredWords'],answer:'minimumWords',label:'Required words'},
  {re:/\b(?:how many|count|workload)\b.*\b(?:week|unfinished|assignments|tasks)|\b(?:week.*count|workload count)\b/i,keys:['count'],answer:'count',label:'Count'},
  {re:/\b(?:when|what time|does)\b.{0,35}\b(?:start|begin)|\b(?:start and end|start.*finish|clinic time|class time)\b/i,keys:['startAt','startsAt','start'],answer:'startAt',label:'Starts',date:true,kinds:['event']}
 ];
 function kindIn(Selection,row,kinds){return Selection?.matchesKind?Selection.matchesKind(row,kinds):kinds.includes(Selection?.kindOf(row)||row.kind);}
 function card(action,items,fields,message,answer){
   return {action,items:items.slice(0,3),message,next:{action,fields,label:action==='find'?'Open':'Continue'},route:'local',routing:{route:'local',reason:'loaded-fact'},...(answer?{answer}: {})};
 }
 function context(input,s,session,rows){
   const selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),
     positive=selection?.positiveText(input)||input,
     n=norm(positive),
     page=String(s.selectedItemId||s.itemId||s.page?.itemId||''),
     last=String(session.lastItemId||session.itemId||''),
     named=rows.filter(v=>norm(v.title).split(' ').length>1&&n.includes(norm(v.title))),
     course=String(s.activeCourseId||s.courseId||session.lastCourseId||''),
     language=load('ReserveBiscuitLanguage','./biscuit-language.js'),
     scope=selection?.sourceScope(input,rows,s,session),
     prepared=scope?.prepared||language?.prepare(positive,s,session,rows);
   return {n,page,last,named,course,prepared,scope,excluded:selection?.sourceExcluder?.(input,s)||(row=>selection?.sourceExcluded(input,row,s))};
 }
 function choose(candidates,c,keys=[]){
   return candidates.filter(v=>
     (!c.scope?.explicit||c.scope.ids.has(String(v.courseId||v.id)))&&!c.scope?.excluded.has(String(v.courseId||v.id))&&!c.excluded?.(v)).map((v,i)=>{
     let score=0;
     const name=c.named.some(x=>x.id===v.id);
     if(name)score+=30;
     if(v.id===c.page)score+=8;
     if(v.id===c.last)score+=5;
     if(String(v.assignmentId||v.parentId||v.itemId||'')===c.page)score+=7;
     if(v.courseId===c.course)score+=.25;
     const match=c.prepared?.byCourse?.get(String(v.courseId||v.id));
     if(match)score+=match.semantic*3;
     const q=c.n.split(' '),title=norm(v.title).split(' '),body=norm(v.text).split(' ');
     score+=q.filter(w=>w.length>2&&title.includes(w)).length*2+q.filter(w=>w.length>3&&body.includes(w)).length*.3;
     score+=keys.filter(k=>has(v,k)).length*.15;
     return {v,score,i};
   }).sort((a,b)=>b.score-a.score||a.i-b.i).map(v=>v.v);
 }
 function sourceTime(text,s){
   const pairs=[...String(text).matchAll(/\b(\d{4}-\d{2}-\d{2})\s*(?:(?:at|by|on|starting(?: at)?)\s*)?(\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?|\d{1,2}\s*[ap]\.?m\.?)\b/gi)].filter(v=>
     !/\b(?:not|instead of|rather than)\s*$/.test(text.slice(Math.max(0,v.index-30),v.index)));
   if(pairs.length!==1)return null;
   const pair=pairs[0],zone=/\b([A-Za-z]+(?:_[A-Za-z]+)*\/[A-Za-z_]+(?:\/[A-Za-z_]+)?|UTC)\b/.exec(text)?.[1]||s.timeZone||'America/New_York';
   try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(0);}catch{return null;}
   const V=load('ReserveBiscuitValues','./biscuit-values.js'),slots=V.slots(pair[1]+' at '+pair[2],{...s,timeZone:zone});
   if(slots.invalid||!slots.date||!Number.isFinite(slots.minute))return null;
   const at=slots.wall(slots.date,slots.minute,slots.local,Date.parse(slots.date+'T00:00:00Z')-172800000);
   return Number.isFinite(at)?{at,date:slots.date,timeZone:zone}:null;
 }
 function factRequest(raw){
  const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),
    positive=Selection?.positiveText(raw)||String(raw),
    text=norm(positive.replace(/([a-z])([A-Z])/g,'$1 $2')),
    cues=[...text.matchAll(/\b(?:please show|show|read|check|inspect|tell me|give me|bring up|i need|i want|asking about|what is|what are|what|when|where|which|who|how many|how much|how long)\b/g)],
    first=cues[0],
    last=cues.at(-1);
  return {text:first?text.slice(first.index).trim():text,focus:last?text.slice(last.index).trim():text};
 }
 function deferConceptual(raw,s,session){return norm(raw).split(' ').length>6&&load('ReserveBiscuitIntent','./biscuit-intent.js')?.choose(raw,s,session,'open/find',0)==='ai';}
 const opening=/\b(?:unlock(?:ing)?(?: time| date)?|opening(?!\s+post\b)(?: time| date| window)?|opens|available from)\b|\b(?:upload|submission|window|box)\b.{0,65}\b(?:first open|open|unlocks?)\b/,closing=/\b(?:lock(?:ing)?(?: time| date)?|closing(?: time| date)?|closes?|available until|until when|stop(?:s)? accepting)\b/;
 function prepareProjection(raw,s,session={}){
  const q=factRequest(raw),
    Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),
    Intent=load('ReserveBiscuitIntent','./biscuit-intent.js'),
    goal=Intent?.requestGoal(raw)||raw,
    groups=[],
    personal=/\b(?:approved|extension|personal|individual)\b/.test(q.text),
    wantsScore=/\b(?:score|earned|my mark|scored)\b/.test(q.text),
    minimumOnly=/\bminimum score\b/.test(q.text)&&!/\bearned\b/.test(q.text),
    blocked=/^\s*(?:start|begin|run|send|submit|upload|create|delete|remove|rename|edit|move|reschedule|install|uninstall)\b/i.test(goal),
    prepared={
      q,
      Selection,
      state:s,
      groups,
      personal,
      wantsScore,
      minimumOnly,
      blocked,
      deferred:deferConceptual(raw,s,session),
      grades:grades(s),
      feedbackAllowed:s.teacherFeedback!==false&&s.settings?.teacherFeedback!==false&&s.privacy?.feedback!==false&&s.privacy?.teacherFeedback!==false
    };
  if(blocked)return prepared;
  function add(re,keys,options={}){
    const match=re.exec(q.text);
    if(!match)return;
    const focus=re.exec(q.focus);
    groups.push({...options,keys,focus:!!focus,index:focus?.index??match.index,priority:options.priority||0});
  }
  add(opening,['unlockAt','availableFrom','opensAt'],{date:true});
  add(closing,['lockAt','availableUntil','closesAt'],{date:true});
  add(/\b(?:initial|first|opening)\s+post\b/,['initialPostDueAt','dueAt'],{answer:'dueAt',date:true,priority:3});
  add(/\b(?:reply|response)\b.{0,45}\b(?:due|deadline|when|cutoff)\b|\breply deadline\b/,['replyDueAt'],{date:true,priority:4});
  add(/\b(?:due|deadline|personal date|individual date)\b/,personal?['approvedDueAt']:['dueAt'],{date:true,approval:personal});
  add(/\b(?:start(?:s|ing)?|begin(?:s)?|meeting time|briefing time|workshop time)\b/,['startAt','startsAt','start','endAt','endsAt','end'],{date:true,primary:['startAt','startsAt','start']});
  if(!opening.test(q.text)&&!closing.test(q.text)&&!/\b(?:due|deadline)\b/.test(q.text))add(/\bwhen\b/,['startAt','startsAt','start'],{date:true});
  add(/\b(?:end(?:s|ing)?|finish(?:es)?|start and end)\b/,['endAt','endsAt','end'],{date:true});
  add(/\b(?:where|room|location|entrance|place|venue)\b/,['location','room','venue']);
  add(/\b(?:posted|sent|updated)\b/,['postedAt','sentAt','updatedAt'],{date:true});
  add(/\b(?:author|sender|from whom)\b|\bwho\b.{0,35}\b(?:sent|wrote|posted|authored)\b|\bwho\b.{0,20}\b(?:is|was)\b.{0,20}\bfrom\b/,['fromName','authorName','senderName'],{answer:'author',author:true});
  add(/\b(?:reply|replies|respond|comments?)\b.{0,35}\b(?:allowed|enabled|disabled|off)\b|\b(?:can|may)\b.{0,20}\b(?:reply|respond)\b/,['repliesAllowed']);
  const score=/\b(?:score|earned|my mark|scored)\b/,maximum=/\b(?:maximum|possible|out of|total points|points.*worth|how many points)\b/;
  add(score,['score','value','grade'],{private:true,answer:'score',score:true});
  add(maximum,['pointsPossible','possible'],{answer:'pointsPossible'});
  if(wantsScore&&maximum.test(q.text)){
    add(/\b(?:score|earned|my mark|scored|maximum|possible|out of|total points|points.*worth|how many points)\b/,['score','value','grade','pointsPossible','possible'],{private:true,answer:'scoreAndPossible',composite:true});
  }
  add(/\b(?:current|overall|course|average|percent|lowest)\b.{0,35}\b(?:grade|total|percent|average|class)\b|\b(?:grade|course total|average)\b/,['currentPercent','percent'],{private:true,answer:'currentPercent'});
  add(/\b(?:rubric|criterion|criteria|marking grid)\b/,['rubric','rubricText']);
  add(/\b(?:rubric|criterion|criteria|score|earned)\b/,['rubricScores','rubricAssessment'],{private:true,priority:5,assessment:true});
  const commentKeys=/\bteacher(?:s| s)? comments?\b/.test(q.text)?['teacherComments','feedback','comments','submissionComments']:['feedback','teacherComments','comments','submissionComments'];
  add(/\b(?:feedback|teacher(?:s| s)? comments?|original comment|returned comment|submission comment)\b/,commentKeys,{private:true,feedback:true});
  add(/\b(?:instructions?|rules?|word count|word limit|word range|how many words|minimum words|maximum words|source list|reference list|references count|quotations? count)\b/,['instructions','instructionText','wordCountMin','wordCountMax','minimumWords','requiredWords','wordCount','referencesCount','quotationsCount']);
  add(/\b(?:steps?|procedure)\b/,['steps','procedure','instructions']);
  add(/\b(?:submission|upload|file)\b.{0,45}\b(?:types?|tabs?|formats?|extensions?|choices?|options?|accepts?|allowed|provider)\b|\b(?:paste|text entry|cloud|drive choice)\b/,['submissionTypes','allowedExtensions','cloudProviders'],{answer:'submissionTypes'});
  const attempts=/\b(?:attempts?|tries|uploads?)\b.{0,45}\b(?:left|remain(?:ing)?|available)\b|\b(?:remaining|left)\b.{0,25}\b(?:attempts?|tries|uploads?)\b/;
  add(attempts,['attemptsLeft','attemptsRemaining'],{answer:'attemptsLeft',attempts:true});
  if(!/^(?:practice|drill|help|quiz me|test me)\b/i.test(goal))add(/\b(?:attempts|tries)(?:\s+(?:please|pls))?\s*[.!?]*$/,['attemptsLeft','attemptsRemaining'],{answer:'attemptsLeft',attempts:true});
  add(/\b(?:attempts?|tries)\b.{0,25}\b(?:allowed|total|maximum)\b/,['attemptsAllowed']);
  add(/\b(?:attempts?|tries)\b.{0,25}\b(?:used|submitted)\b/,['attemptsUsed']);
  add(/\b(?:time limit|quiz minutes|how long|duration)\b/,['timeLimitMinutes','timeLimit','durationMinutes'],{answer:'timeLimit'});
  add(/\b(?:notes?|calculator|formula sheet|materials? allowed|permitted materials?)\b/,['notesAllowed','calculatorAllowed','formulaSheetAllowed']);
  add(/\b(?:scoring policy|best attempt|latest attempt|highest attempt)\b/,['scoringPolicy']);
  add(/\b(?:submitted|submission status|missing flag|late flag|status|handed in)\b/,['submissionStatus','status','submittedAt','missing','late'],{answer:'submissionStatus'});
  add(/\b(?:requirements?|prerequisites?|prerequisite|minimum score|module steps?|module checklist|unlock conditions?)\b/,['requirements','prerequisites','prerequisite','minimumScore']);
  add(/\b(?:completion|complete|completed|progress|remaining)\b/,['completedCount','requirementCount','remainingCount','complete','completed','progress']);
  add(/\b(?:previous|prev|next|order|sequence)\b/,['items','currentItemId','previousItemId','nextItemId'],{module:true});
  add(/\b(?:captions?|caption tracks?)\b/,['captions','captionTracks','provider'],{primary:['captions','captionTracks']});
  add(/\btranscript\b/,['transcript','transcriptUrl']);
  add(/\b(?:duration|length|seconds?|minutes?)\b/,['durationSeconds']);
  add(/\b(?:provider|platform)\b/,['provider']);
  add(/\b(?:tabs?|home tabs)\b/,['tabs']);
  add(/\b(?:contrast|high contrast)\b/,['highContrast','contrast','device'],{primary:['highContrast','contrast']});
  add(/\bdevice\b/,['device']);
  add(/\b(?:staff|people roles|directory|teaching assistants?|section roles)\b/,['staff']);
  add(/\b(?:recipient|recipients|addressed to)\b/,['recipient','recipients','recipientGroupId']);
  add(/\b(?:approval|extension status|extension granted)\b/,['extensionGranted','extensionApproved']);
  add(/\b(?:controls?|current value|choices|available values|ui path|menu)\b/,['controls','uiPath','currentValue','availableValues','availableOperations']);
  add(/\b(?:theme|accent|density|font|text size)\b/,['theme','accent','density','font','textSize']);
  add(/\b(?:price|cost|fee)\b/,['price','cost','fee','currency'],{primary:['price','cost','fee'],answer:'price'});
  add(/\b(?:installed|installation|enabled|active state)\b/,['installed','enabled']);
  add(/\b(?:email|correo|contact address)\b/,['email','contactEmail'],{answer:'email'});
  add(/\b(?:body|message text|original message|original wording|exact wording|part about)\b|\bmessage\b.{0,25}\bagain\b/,['body','message','description','text']);
  add(/\b(?:workload|assignment count|task count|how many unfinished|count)\b|\bhow many\b.{0,45}\b(?:week|unfinished|assignments|tasks)\b/,['count']);
  groups.sort((a,b)=>Number(b.focus)-Number(a.focus)||a.index-b.index||Number(!!b.composite)-Number(!!a.composite)||b.priority-a.priority);return prepared;
 }
 function attemptCounts(row){
   return typeof row.attemptsAllowed==='number'&&
     Number.isFinite(row.attemptsAllowed)&&
     typeof row.attemptsUsed==='number'&&
     Number.isFinite(row.attemptsUsed)&&
     row.attemptsAllowed>=0&&
     row.attemptsUsed>=0;
 }
 function projectionKeys(group,row,prepared,kind,privateRow){
  if(group.author)return kind==='announcement'?['authorName','fromName','senderName','teacher']:kind==='message'?['fromName','senderName','authorName']:['page','file','material','note','discussion','media'].includes(kind)?['authorName']:null;
  if(group.module&&kind!=='canvas-module'&&!(Array.isArray(row.items)&&has(row,'currentItemId')))return null;
  if((group.score||group.assessment)&&kind==='canvas-module'&&prepared.minimumOnly)return null;
  if(group.assessment&&!privateRow&&has(row,'rubric')&&!prepared.wantsScore)return null;
  if(group.approval&&(!has(row,'approvedDueAt')||!prepared.Selection?.sourceApproval(row,prepared.state)))return null;
  if(group.attempts&&!has(row,'attemptsLeft')&&!has(row,'attemptsRemaining')&&!attemptCounts(row))return null;
  if(group.composite){
    const scoreKey=(privateRow?['score','value','grade']:['score']).find(key=>has(row,key)),maximumKey=['pointsPossible','possible'].find(key=>has(row,key));
    return scoreKey&&maximumKey?[scoreKey,maximumKey]:null;
  }
  return group.score&&!privateRow?['score']:group.keys;
 }
 function projection(row,prepared){
  if(prepared.blocked||!prepared.groups.length)return null;
  const kind=prepared.Selection?.kindOf(row)||row.kind,
    privateRow=['grade','feedback','course-grade'].includes(kind)||row.gradeAccess===true,
    fields={},
    label=key=>key.replace(/([a-z])([A-Z])/g,'$1 $2'),
    entry=v=>{
    if(v===null||typeof v!=='object')return String(v??'');
    const name=[v.description,v.title,v.name,v.label,v.text].find(x=>typeof x==='string'&&x.trim()),
      points=Number.isFinite(Number(v.points))&&v.points!==null&&v.points!==''?Number(v.points):null;
    if(name)return name.trim()+(points!==null?' ('+points+' pts)':'');
    return Object.entries(v).filter(([k,x])=>x!==null&&typeof x!=='object'&&!/^(?:id|_id|key)$/i.test(k)).slice(0,4).map(([k,x])=>label(k)+' '+x).join(', ');
  },when=v=>{
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)||!Number.isFinite(Date.parse(v)))return v;
    try{return new Date(v).toLocaleString('en-US',{timeZone:prepared.state?.timeZone||'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch{return v;}
  },
  display=value=>
    Array.isArray(value)?
      value.length?value.every(v=>v===null||typeof v!=='object')?value.map(when).join(', '):value.map(entry).filter(Boolean).join('; '):'none':
      typeof value==='object'&&value?entry(value):String(when(value));
  let denied='',primary;
  for(const group of prepared.groups){
    const keys=projectionKeys(group,row,prepared,kind,privateRow);
    if(!keys)continue;
    const derived=group.attempts&&!has(row,'attemptsLeft')&&!has(row,'attemptsRemaining'),
      present=derived?['attemptsLeft']:keys.filter(key=>has(row,key)&&(!group.date||Number.isFinite(stamp(row[key])))),
      answerKey=(group.primary||keys).find(key=>present.includes(key));
    if(!answerKey)continue;
    if(group.private&&!prepared.grades){denied='Show grades is off.';continue;}
    if(group.feedback&&!prepared.feedbackAllowed){denied='Teacher feedback sharing is off.';continue;}
    for(const key of present)fields[key]=derived?Math.max(0,row.attemptsAllowed-row.attemptsUsed):row[key];
    if(!primary)primary={answer:group.answer||answerKey,keys:present,composite:group.composite};
  }
  if(privateRow&&!prepared.grades&&primary)denied='Show grades is off.';if(denied)return {denied};if(!primary)return null;
  if(has(fields,'items')&&has(row,'currentItemId')){
    const items=list(row.items).map(value=>{
      const id=value?.contentId??value?.content_id??value?.pageId??value?.id??value;
      return ['string','number'].includes(typeof id)&&String(id).trim()?String(id):null;
    }),index=items.indexOf(String(row.currentItemId));
    if(index>=0){
      fields.currentItemId=row.currentItemId;
      if(!has(fields,'previousItemId')&&index>0&&items[index-1]!==null)fields.previousItemId=items[index-1];
      if(!has(fields,'nextItemId')&&index+1<items.length&&items[index+1]!==null)fields.nextItemId=items[index+1];
    }
  }
  fields.answerField=primary.answer;
  const value=primary.composite?String(fields[primary.keys[0]])+' out of '+String(fields[primary.keys[1]]):fields[primary.keys[0]],
    answer={label:label(primary.answer),value:typeof value==='boolean'?value?'Yes':'No':display(value)},
    summary=Object.entries(fields).filter(([key])=>key!=='answerField').map(([key,value])=>label(key)+': '+display(value).slice(0,650)).join('; ');
  return {fields,summary,answer};
 }
 function projectionCard(projected,row,items=[row],relation='selected-fact'){
  if(projected.denied)return card('none',[],{},projected.denied);
  const text=String(row.text||row.description||row.body||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),message=row.title+': '+projected.summary+'.'+(text?' '+text.slice(0,1400):'');
  return {...card('find',items,{...row.fields,itemId:row.id,...projected.fields},message,projected.answer),relation};
 }
 function typedRequest(text,prepared){
  if(/\b(?:rubric|criterion|criteria|marking grid)\b/i.test(text)&&/\b(?:open|find|where|actual|original|exact|row)\b/i.test(text))return {name:'rubric',kinds:['rubric','file']};
  if(/\b(?:roster|student list|classmates list|section labels)\b/i.test(text))return {name:'roster',kinds:['page']};
  if(/\b(?:peer review|assigned.*draft|whose draft|draft.*assigned)\b/i.test(text))return {name:'peer-review',kinds:['peer-review']};
  if(/\b(?:conference|meeting|session)\b.*\b(?:join|enter|entry|joining)|\bjoin.instructions\b/i.test(text))return {name:'join',kinds:['page'],test:row=>/\b(?:join|conference|meeting)\b/i.test(row.title+' '+row.text)};
  if(/\b(?:practice (?:page|link)|self.check|sandbox|ungraded|doesn.t count.*attempt)\b/i.test(text))
    return {name:'practice',kinds:['page','quiz'],test:row=>row.practice===true||/\b(?:practice|sandbox|self.check|ungraded)\b/i.test(row.title+' '+row.text)};
  if(/\b(?:attachment|attached|blank document|blank form)\b/i.test(text))return {name:'attachment',kinds:['file']};
  if(/\b(?:teacher profile|school contact|teacher contact|official contact|email|correo)\b/i.test(text))return {name:'teacher',kinds:['teacher','person']};
  if(/\b(?:syllabus|polic(?:y|ies)|marks off|penalty)\b/i.test(text)&&!prepared.groups.some(group=>group.keys.includes('scoringPolicy')||group.keys.includes('notesAllowed')))
    return {name:'policy',kinds:['syllabus','file','page'],test:row=>row.kind==='syllabus'||/\b(?:syllabus|polic(?:y|ies)|procedure)\b/i.test(row.title+' '+(row.pageType||''))};
  return null;
 }
 function admission(raw,s,session,rows,prepared){
  if(prepared.admission)return prepared.admission;
  const Selection=prepared.Selection,
    c=context(raw,s,session,rows),
    text=Selection?.positiveText(raw)||raw,
    scoped=rows.filter(row=>
      (!c.scope?.explicit||c.scope.ids.has(String(row.courseId||row.id)))&&!c.scope?.excluded.has(String(row.courseId||row.id))&&!c.excluded(row)),
    n=norm(text),
    named=scoped.filter(row=>norm(row.title).split(' ').length>1&&(' '+n+' ').includes(' '+norm(row.title)+' ')),
    role=Selection?.role(raw,rows,s,session,'open/find',{sources:null}),
    manual=role?.name==='manual-source'?role:null,
    typed=typedRequest(text,prepared),
    hint=!role&&!typed&&Selection?.hints.find(([re])=>re.test(text)),
    request=manual||(['assignment','work-state'].includes(role?.name)?typed||role:role||typed)||(hint?{name:'source-kind',kinds:hint[1]}:null),
    sources=Selection?.sourceOrder(raw,rows,s,session),
    intent=Selection?.sourceIntent(raw),
    useSources=sources!==undefined&&sources!==null&&!manual&&request?.name!=='control'&&(!!intent?.kind||!request),
    selected=String(s.selectedItemId||s.itemId||s.page?.itemId||''),
    accept=row=>
      !request||
        kindIn(Selection,row,request.kinds)&&(!request.test||request.test(row))||
        request.name==='rubric'&&row.kind==='assignment'&&(String(row.id)===selected||named.includes(row))&&(has(row,'rubric')||has(row,'rubricText'));
  return prepared.admission={c,scoped,named,manual,request,typed,sources,useSources,selected,accept};
 }
 function admittedRow(raw,s,session,rows,prepared){
  const a=admission(raw,s,session,rows,prepared);
  if(a.useSources)return a.sources[0]||null;
  if(a.named.length){
    const longest=Math.max(...a.named.map(row=>norm(row.title).length)),named=a.named.filter(row=>norm(row.title).length===longest);
    return named.length===1&&a.accept(named[0])?named[0]:null;
  }
  const selected=a.scoped.find(row=>String(row.id)===a.selected);
  if(selected&&a.accept(selected))return selected;
  return a.scoped.length===1&&a.accept(a.scoped[0])?a.scoped[0]:null;
 }
 function typedFact(raw,s,session,rows,prepared){
  if(prepared.blocked||prepared.deferred)return null;const a=admission(raw,s,session,rows,prepared),request=a.typed;if(!request||a.manual||a.useSources)return null;
  let candidates=a.scoped.filter(row=>
    (kindIn(prepared.Selection,row,request.kinds)&&(!request.test||request.test(row))||
      request.name==='rubric'&&row.kind==='assignment'&&(String(row.id)===a.selected||a.named.includes(row))&&(has(row,'rubric')||has(row,'rubricText')))&&
      a.accept(row));
  if(a.named.length){const named=admittedRow(raw,s,session,rows,prepared);if(!named||!candidates.includes(named))return null;candidates=[named];}
  /* "whats corvins email": a teacher named by surname, also with a possessive s, is that teacher */
  if(request.name==='teacher'&&candidates.length>1){
    const said=norm(raw).split(' '),
      surname=row=>norm(row.title||row.name||'').split(' ').pop()||'',
      hit=candidates.filter(row=>surname(row).length>2&&said.some(w=>w===surname(row)||w===surname(row)+'s'));
    if(hit.length===1)candidates=hit;
  }
  const ordered=choose(candidates,a.c),row=ordered[0];if(!row)return null;
  const relation=a.named.length?'named-fact':'typed-fact',projected=projection(row,prepared);
  if(projected)return projectionCard(projected,row,ordered,relation);
  const text=String(row.text||row.description||row.body||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  return {...card('find',ordered,{...row.fields,itemId:row.id},row.title+(text?': '+text.slice(0,900):'.')),relation};
 }
 function selectedFact(raw,s,session,rows,prepared){
  const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),
    positive=Selection?.positiveText(raw)||raw,
    selected=String(s.selectedItemId||s.itemId||s.page?.itemId||''),
    row=rows.find(value=>String(value.id)===selected);
  if(!row){if(selected&&!grades(s)&&/\b(?:score|grade|earned)\b/.test(norm(positive)))return card('none',[],{},'Show grades is off.');return null;}
  prepared=prepared||prepareProjection(raw,s,session);if(prepared.deferred)return null;
  const a=admission(raw,s,session,rows,prepared);if(!a.scoped.includes(row)||!a.accept(row))return null;
  if((['grade','feedback','course-grade'].includes(row.kind)||row.gradeAccess===true)&&!grades(s))return card('none',[],{},'Show grades is off.');
  if(a.named.length&&admittedRow(raw,s,session,rows,prepared)!==row||a.useSources&&String(a.sources[0]?.id)!==selected)return null;
  const projected=projection(row,prepared),attachments=projected&&(Selection?.sourceIntent(raw)?.attachment||a.manual)?Selection.linkedRows(row,rows):[];
  return projected?projectionCard(projected,row,[row,...attachments],a.named.length?'named-fact':'selected-fact'):null;
 }
 function metadataFact(raw,s,session,rows,c,prepared){
  prepared=prepared||prepareProjection(raw,s,session);
  if(prepared.blocked||prepared.deferred||!prepared.groups.length)return null;
  const row=admittedRow(raw,s,session,rows,prepared);
  if(!row)return null;
  const a=admission(raw,s,session,rows,prepared),projected=projection(row,prepared);
  return projected?projectionCard(projected,row,[row],!a.useSources&&a.named.includes(row)?'named-fact':'metadata-fact'):null;
 }
 function manualFact(raw,s,session,rows,prepared){
  prepared=prepared||prepareProjection(raw,s,session);if(prepared.deferred)return null;
  const Selection=prepared.Selection,a=admission(raw,s,session,rows,prepared),request=a.manual;if(!request)return null;
  const privateFeedback=/\b(?:teacher(?:s| s)?\s+(?:comments?|feedback)|exact teacher comment|original feedback)\b/i.test(raw);
  if(privateFeedback&&!grades(s))return card('none',[],{},'Show grades is off. Say \u201cshow grades\u201d to turn it on.');
  if(privateFeedback&&(s.teacherFeedback===false||s.settings?.teacherFeedback===false||s.privacy?.feedback===false||s.privacy?.teacherFeedback===false))
    return card('none',[],{},'Teacher feedback sharing is off.');
  const candidates=a.scoped.filter(row=>request.kinds.includes(Selection.kindOf(row))&&request.test(row)),
    ordered=choose(candidates,a.c),
    row=ordered.find(value=>request.ids.has(String(value.id)))||ordered[0];
  if(!row)return null;
  const text=String(row.text||row.description||row.body||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),
    attachments=Selection.linkedRows(row,rows),
    fields={...row.fields,itemId:row.id},
    projected=projection(row,prepared);
  if(projected)return projectionCard(projected,row,[row,...attachments],'source-page');
  return {...card('find',[row,...attachments],fields,row.title+(text?': '+text.slice(0,1600):'.')),relation:'source-page'};
 }
 function sourceFact(raw,s,session,rows,prepared){
  if(operators.some(v=>v.private&&v.re.test(raw)))return null;
  prepared=prepared||prepareProjection(raw,s,session);
  if(prepared.blocked||prepared.deferred)return null;
  const Selection=prepared.Selection,intent=Selection?.sourceIntent(raw),a=admission(raw,s,session,rows,prepared);
  if(!intent||!a.useSources)return null;
  const ordered=a.sources;
  if(ordered&&ordered.length===0&&intent.kind&&intent.explicit)
    return {...card('none',[],{},'No matching '+(intent.unread?'unread ':'')+(intent.kind==='message'?'conversation':'announcement')+' is loaded.'),relation:'source-fact'};
  const row=ordered?.[0];
  if(!row)return null;
  const text=String(row.text||row.description||row.body||row.message||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),
    fields={...row.fields,itemId:row.id},
    times=sourceTime(text,s),
    request=prepared.q,
    projected=projection(row,prepared);
  if(projected?.denied)return card('none',[],{},projected.denied);
  let answer;
  if(/\b(?:can|may|allowed|enabled|disabled|turned off)\b/i.test(raw)&&/\b(?:reply|replies|respond|comments?)\b/i.test(raw)&&typeof row.repliesAllowed==='boolean'){
    fields.repliesAllowed=row.repliesAllowed;
    fields.answerField='repliesAllowed';
    answer={label:'Replies allowed',value:row.repliesAllowed?'Yes':'No'};
  }
  if(/\b(?:where|room|location|entrance|place)\b/i.test(raw)){
    const rooms=[...new Set([...text.matchAll(/\broom\s+[\p{L}\p{N}]+(?:[-.][\p{L}\p{N}]+)*/giu)].map(v=>v[0]))],location=row.location||(rooms.length===1?rooms[0]:undefined);
    if(location!==undefined)fields.location=location;
  }
  if(times&&!opening.test(request.text)&&!closing.test(request.text)){
    fields.date=times.date;
    fields.timeZone=times.timeZone;
    const approved=Selection.sourceApproval(row,s);
    if(/\b(?:due|deadline|extension|approved|personal date|individual date)\b/i.test(request.text)&&(approved||/\b(?:due|deadline)\b/i.test(text)&&!/\b(?:extension|approved|personal date|individual date)\b/i.test(request.text))){
      const key=approved?'approvedDueAt':'dueAt';
      fields[key]=row[key]??times.at;
      fields.answerField=key;
    }
    else if(/\b(?:when|time|start|starts|begin|briefing|workshop|meeting)\b/i.test(request.text)){fields.startAt=row.startAt??row.startsAt??times.at;fields.answerField='startAt';}
  }
  if(prepared.groups.some(group=>group.author)){
    const author=row.fromName||row.authorName||row.senderName||row.author?.name||row.sender?.name||(Selection.kindOf(row)==='announcement'?row.teacher:undefined);
    if(typeof author==='string'&&author.trim()){fields.fromName=author;fields.answerField='author';answer={label:'From',value:author};}
  }
  if(projected){Object.assign(fields,projected.fields);answer=projected.answer||answer;}
  if(!text&&!answer&&Object.keys(fields).length<=2)return null;
  const items=[row,...(intent.attachment?Selection.linkedRows(row,rows):[])],
    message=(projected?projected.summary+'. ':answer?answer.label+': '+answer.value+'. ':'')+(text?(row.title+': '+text):row.title+'.');
  return {...card('find',items,fields,message,answer),relation:'source-fact'};
 }
 function deadlineWindow(raw,s,rows,c){
   if(!Number.isFinite(s.now))return null;
   if(!/^(?:what(?:s|'s| is)?|which)\b/i.test(raw)||
     !(/\b(?:due|deadline)\b/i.test(raw)||/\b(?:needs?|must|have to)\b.{0,25}\b(?:doing|done|finish|finished|submit|hand in|turn in)\b/i.test(raw))||
     !/\b(?:before|by|within|next)\b/i.test(raw)||
     /\b(?:overdue|missed|late|how many|count)\b/i.test(raw)||
     c.named.some(v=>v.kind==='assignment'))
     return null;
   const V=load('ReserveBiscuitValues','./biscuit-values.js'),
     D=load('ReserveBiscuitDetails','./biscuit-details.js'),
     Clock=load('CanvasHarnessAgentClock','./agent-clock.js'),
     n=V.normalize(raw),
     timing=D.temporal(n.replace(/\b(?:before|by|after)\s+(?=\d)/g,m=>'at'+' '.repeat(m.length-2)),s),
     today=Clock.calendar(s.timeZone)(s.now).day;
   let start=timing.date!==today?timing.wall(0,timing.date):s.now,end,strictStart=false;
   for(const clock of timing.clocks){
     if(clock.invalid||!Number.isFinite(clock.at))continue;
     const before=n.slice(Math.max(0,clock.index-25),clock.index);
     if(/\b(?:before|by)\s*$/.test(before))end=clock.at;else if(/\bafter\s*$/.test(before)){start=Math.max(start||s.now,clock.at);strictStart=true;}
   }
   if(!Number.isFinite(end)&&/\b(?:within|in)\s+(?:the\s+)?next\s+\d|\bwithin\s+\d|\bbefore\b.+\bin\s+\d/.test(n)){
     const minutes=timing.slots.relative??timing.slots.minutes;
     if(Number.isFinite(minutes)&&minutes>0)end=s.now+minutes*MIN;
   }
   if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||end<=s.now)return null;
   let pool=rows.filter(v=>
     v.kind==='assignment'&&!v.done&&!v.completed&&Number.isFinite(stamp(v.dueAt))&&(strictStart?stamp(v.dueAt)>start:stamp(v.dueAt)>=start)&&stamp(v.dueAt)<=end);
   if(c.prepared?.recognized){
     const matches=list(c.prepared.matches).filter(v=>v.nameExact||v.nameMatch>0||v.semantic>0||v.topic>0),ids=new Set(matches.map(v=>String(v.courseId||v.id||'')));
     if(!ids.size)return null;
     pool=pool.filter(v=>ids.has(String(v.courseId)));
   }
   if(!pool.length)return null;
   pool.sort((a,b)=>stamp(a.dueAt)-stamp(b.dueAt));
   const ordered=choose(pool,c,['dueAt']),row=ordered[0],display=new Date(stamp(row.dueAt)).toLocaleString('en-US',{timeZone:s.timeZone||'America/New_York'});
   return {
     ...card('find',ordered,{...row.fields,itemId:row.id,dueAt:row.dueAt,dueAfterAt:start,dueBeforeAt:end},row.title+' due: '+display+'.',{label:row.title+' due',value:display}),
     relation:'deadline-window'
   };
 }
 function eventOverlap(raw,s,session,rows,prepared){
  const Selection=prepared.Selection||load('ReserveBiscuitSelection','./biscuit-selection.js'),
    denied=()=>({...card('none',[],{},'Choose two unambiguous loaded calendar events with valid start and end times.'),relation:'event-overlap'});
  if(prepared.blocked||prepared.deferred||!Selection)return denied();
  const c=context(raw,s,session,rows),
    valid=row=>
      row.kind==='event'&&
        Number.isFinite(stamp(row.startAt??row.start))&&
        Number.isFinite(stamp(row.endAt??row.end))&&
        stamp(row.endAt??row.end)>=stamp(row.startAt??row.start),
    key=row=>String(row.kind)+'\0'+String(row.courseId||'')+'\0'+String(row.id),
    owned=Selection.reference(raw,rows,s,session,{actor:'open/find'});
  let events=choose(rows.filter(valid),c),anchors=[];
  const put=row=>{if(!row||!events.includes(row))return false;if(!anchors.includes(row))anchors.push(row);return true;};
  if(owned.owner==='ambiguous'){
    const view=Selection.referenceText(raw),current=/\bthis\s+(?:event|session|appointment|meeting)\b/i.test(view),prior=/\bthat\s+(?:event|session|appointment|meeting)\b/i.test(view);
    if(!current||!prior||!put(Selection.reference('open this event',rows,s,session,{actor:'open/find'}).row)||!put(Selection.reference('open that event',rows,s,session,{actor:'open/find'}).row))
      return denied();
  }
  else if(owned.explicit&&!owned.row&&owned.owner!=='named')return denied();
  if(owned.row?.kind==='course')events=events.filter(row=>String(row.courseId)===String(owned.row.id));else if(owned.row&&!put(owned.row))return denied();
  for(const row of owned.named||[])if(row.kind==='event'&&!put(row))return denied();
  if(anchors.length>2)return denied();
  if(anchors.length===2)events=events.filter(row=>anchors.includes(row));
  if(events.length!==2||new Set(events.map(key)).size!==2||anchors.some(row=>!events.includes(row)))return denied();
  const [a,b]=events,minutes=Math.max(0,(Math.min(stamp(a.endAt??a.end),stamp(b.endAt??b.end))-Math.max(stamp(a.startAt??a.start),stamp(b.startAt??b.start)))/MIN);
  return {
    ...card(
      'find',
      [a,b],
      {...a.fields,itemId:a.id,conflictingItemId:b.id,overlapMinutes:minutes},
      a.title+' and '+b.title+': '+(minutes?minutes+' min overlap.':'No overlap.'),
      {label:'Overlap',value:minutes+' min'}),
    relation:'event-overlap'
  };
 }

 function taskChoiceRequest(input){
  const I=load('ReserveBiscuitIntent','./biscuit-intent.js'),raw=String(input),goal=I?.requestSpan?.(raw)||raw,view=I?.workflowMask?.(goal)||goal;
  if(I?.literalNoteRequest?.(raw)||/^\s*(?:if|unless|suppose|what if|how|why|explain|teach|note\s*:|do not|don.t|dont|never)\b/i.test(raw)||/^\s*(?:plan|schedule|replan|reschedule|allocate|build|create)\b/i.test(view)||I?.negated?.(goal,'plan'))
    return false;
  const object=/\b(?:choose|pick|select)\s+([^,;.!?]{0,80}?)\b(?:tasks?|assignments?|jobs?|work|prep)\b/i.exec(view),choose=!!object&&!/\b(?:for|from|about|ideas?|topics?|examples?|criteria|methods?|strategies)\b/i.test(object[1]),question=/\bwhich\s+(?:school\s+)?(?:task|assignment|job|work)\b.{0,65}\b(?:first|earl(?:y|ier|iest)|fits?|possible|start)\b/i.test(view);
  return (choose||question)&&!/\b(?:ideas?|topics?|concepts?|examples?|arguments?|methods?|strategies)\s+(?:for|from|in)\b|\b(?:task|work|assignment)\s+(?:ideas?|topics?|examples?)\b/i.test(view);
 }
 function chooseTask(input,s={},session={},rows=[]){
  if(!taskChoiceRequest(input))return null;
  const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),
    V=load('ReserveBiscuitValues','./biscuit-values.js'),
    scope=Selection.sourceScope(input,rows,s,session),
    excluded=Selection.sourceExcluder(input,s),
    slots=V.slots(input,s),
    budget=slots.minutes,
    limited=Number.isFinite(budget)&&budget>0,
    course=row=>list(s.courses).find(c=>String(c.id)===String(row.courseId)),
    key=row=>String(row.courseId||'')+'\0'+String(row.id),
    conflicts=new Set(),
    seen=new Map();
  const values=row=>[row.dueAt??row.due_at,row.estimate??row.minutes,row.done??row.completed];
  for(const row of [...list(s.assignments),...list(s.workItems),...list(s.personalTasks)]){
    const k=key(row),before=seen.get(k),next=values(row);
    if(before&&next.some((v,i)=>v!==undefined&&v!==null&&before[i]!==undefined&&before[i]!==null&&v!==before[i]))conflicts.add(k);else seen.set(k,next);
  }
  let work=rows.filter(row=>
    row.kind==='assignment'&&
      !row.done&&
      !row.completed&&
      row.available!==false&&
      row.loaded!==false&&
      row.unavailable!==true&&
      !row.placeholder&&
      !course(row)?.archived&&
      course(row)?.active!==false&&
      (!scope.explicit||scope.ids.has(String(row.courseId)))&&
      !scope.excluded.has(String(row.courseId))&&
      !excluded(row)&&
      !conflicts.has(key(row)));
  const two=/\b(?:between|of)\s+(?:these|those|the)\s+two\b/i.test(input),previous=list(session.items||session.lastItems||session.results||session.lastResult?.items);
  if(two&&previous.length){
    const ids=previous.map(row=>String(row.id??row.itemId)),valid=ids.length===2&&new Set(ids).size===2&&ids.every(id=>work.filter(row=>String(row.id)===id).length===1);
    work=valid?work.filter(row=>ids.includes(String(row.id))):[];
  }
  if(slots.invalid||limited&&budget>1440)work=[];
  if(limited)
    work=work.filter(row=>Number.isFinite(Number(row.estimate??row.minutes))&&Number(row.estimate??row.minutes)>0&&Number(row.estimate??row.minutes)<=budget);
  const due=row=>Number.isFinite(stamp(row.dueAt))?stamp(row.dueAt):Infinity,
    estimate=row=>Number(row.estimate??row.minutes)>0?Number(row.estimate??row.minutes):Infinity;
  work.sort((a,b)=>due(a)-due(b)||estimate(a)-estimate(b));
  const fields={operation:'choose-next',basis:'earliest loaded unfinished deadline; estimates break ties',excludeGrades:true,...(limited?{availableMinutes:budget}:{})},first=work[0];
  if(!first)
    return {
      ...card('none',[],{...fields,answer:limited?'No loaded unfinished coursework fits that time':'No loaded coursework to compare',manualNextStep:'Open Canvas to load courses before comparing assignments.'},limited?'No loaded unfinished task has a known estimate that fits that time.':'No loaded coursework to compare. Open Canvas to load courses before comparing assignments.'),
      relation:'task-choice'
    };
  return {
    ...card(
      'find',
      work.slice(0,3),
      {...first.fields,itemId:first.id,...(first.courseId?{courseId:first.courseId}:{}),...fields},
      'Start with '+first.title+'. Its loaded deadline comes first; estimates break ties.'),
    relation:'task-choice'
  };
 }
 function resolve(input,s={},session={},rows=[]){
   const task=chooseTask(input,s,session,rows);
   if(task)return task;
   const raw=String(input),n=norm(raw),Intent=load('ReserveBiscuitIntent','./biscuit-intent.js');
   if(/^(?:(?:what(?:'s| is)?|show(?: me)?|list|any)\s+)?(?:is\s+)?(?:due(?:\s+work)?|(?:work|assignments|homework|tasks)\s+(?:is\s+)?due)\b/i.test(raw)||/^what\s+(?:do|have|must)\b.*\bdue\b/i.test(raw))return null;
   if(/\b(?:grade|score|percent|mark)\b/i.test(raw)&&/\b(?:if|hypothetical|pretend|what.if|predict|would|will.*be)\b/i.test(raw))return null;
   if(!raw||
     !rows.length||
     Intent?.literalNoteRequest?.(raw)||
     Intent?.scheduleRequest(raw)||
     /^\s*(?:remind|note\s*:|jot|focus|pause|resume|stop|set|hide|enable|disable|bookmark|save|mark|complete)\b/i.test(raw))
     return null;
   if(/\b(?:focus timer|focus clock|countdown|pomodoro|focus session)\b/i.test(raw))return null;
   if(/\b(?:what would|how would|what makes|what counts|how could|how can|why|useful|usable)\b/i.test(raw))return null;
   if(/\b(?:explain|rewrite|rephrase|invent|generate|teach|translate|brainstorm|summari[sz]e|why|help me understand|make.*(?:quiz|notes|checklist))\b/i.test(raw))return null;
   if(/\bhelp\b/i.test(raw)&&
     !/\b(?:find|open|locate|retrieve|read|inspect)\b/i.test(raw)&&
     !rows.some(row=>!['course','setting','feature','tab','home-module','action'].includes(row.kind)&&norm(row.title).length>2&&/\bhelp\b/i.test(row.title)&&(' '+n+' ').includes(' '+norm(row.title)+' ')))
     return null;
   const prepared=prepareProjection(raw,s,session);
   if(Intent?.eventOverlapRequest?.(raw,s,rows,session))return eventOverlap(raw,s,session,rows,prepared);
   const manual=manualFact(raw,s,session,rows,prepared);
   if(manual)return manual;
   const typed=typedFact(raw,s,session,rows,prepared);
   if(typed)return typed;
   const selected=selectedFact(raw,s,session,rows,prepared);
   if(selected)return selected;
   if(Intent?.choose(raw,s,session,'open/find',0)==='ai')return null;
   const c=admission(raw,s,session,rows,prepared).c,
     Language=load('ReserveBiscuitLanguage','./biscuit-language.js'),
     reference=n.replace(/^(?:my|the)\s+/,'').replace(/\s+(?:please|pls)$/,''),
     analysis=Language?.analyze(reference),
     pureReference=analysis?.references?.some(v=>v.phrase===reference)||
       analysis?.topicReferences?.some(v=>v.phrase===reference)||
       list(s.courses).some(v=>Language?.courseAliases(v).some(a=>norm(a)===reference));
   if(pureReference&&
     !rows.some(v=>!['course','setting','feature','tab','home-module','action'].includes(v.kind)&&norm(v.title)===reference)&&
     !/\?/.test(raw)&&
     n.split(' ').length<=3&&
     !/\b(?:ask|ai|show|hide|open|find|grade|score|due|deadline|notes|note|timer|focus|remind|module|card|tab|home|settings|feature|none|stop|start|pause|resume)\b/i.test(raw)&&
     c.prepared?.recognized&&
     c.prepared.matches?.length){
     const courses=c.prepared.matches.map(v=>rows.find(x=>x.kind==='course'&&x.id===v.courseId)).filter(Boolean);
     if(courses.length)return {...card('find',courses,courses[0].fields,courses[0].title+'.'),relation:'course-reference'};
   }
   const question=/\?|\b(?:what|which|when|where|who|how many|how much|does|did|is|are|show|find|open|read|retrieve|check|inspect|count|get|bring|next|previous|forward|back)\b/i.test(raw)||n.split(' ').length<=6;
   if(!question)return null;
   const window=deadlineWindow(raw,s,rows,c);
   if(window)return window;
   const source=sourceFact(raw,s,session,rows,prepared);
   if(source)return source;
  if(/\b(?:next|previous|before this|forward|back one)\b/i.test(raw)&&/\b(?:module|lesson|page|item)\b/i.test(raw)){
    const current=rows.find(v=>v.id===c.page),direction=/\b(?:previous|before this|back)\b/i.test(raw)?-1:1,explicit=current?.[direction>0?'nextItemId':'previousItemId'];
    let target=explicit&&rows.find(v=>v.id===String(explicit));
    if(!target)
      for(const module of [...list(s.canvasModules),...list(s.courseModules),...list(s.modules)]){
        const items=list(module.items),index=items.findIndex(v=>String(v.contentId||v.content_id||v.pageId||v.id)===c.page||String(v.id)===c.page);
        if(index>=0){
          const other=items[index+direction];
          target=other&&rows.find(v=>v.id===String(other.contentId||other.content_id||other.pageId||other.id));
          if(target)break;
        }
      }
    if(target)return {...card('find',[target],{...target.fields,itemId:target.id},'Open '+target.title+'.'),relation:'module-neighbour'};
  }
  if(/\b(?:how many.*days|calendar days|days.*(?:until|before)|cuantos dias)\b/i.test(n)){
    const events=choose(rows.filter(v=>v.kind==='event'&&Number.isFinite(stamp(v.startAt||v.start))),c),v=events[0];
    if(v){
      const Clock=load('CanvasHarnessAgentClock','./agent-clock.js'),
        local=Clock.calendar(s.timeZone),
        today=local(s.now).day,
        date=local(stamp(v.startAt||v.start)).day,
        days=Math.round((Date.parse(date+'T00:00Z')-Date.parse(today+'T00:00Z'))/86400000);
      return card('find',[v],{...v.fields,itemId:v.id,days,date},v.title+': '+days+' calendar days.',{label:'Days until '+v.title,value:String(days)});
    }
  }
  const projected=metadataFact(raw,s,session,rows,c,prepared);if(projected)return projected;
  const priorities={
    timeLimit:100,
    replyDueAt:95,
    count:90,
    teacherComments:85,
    score:80,
    availableUntil:75,
    minimumWords:70,
    submissionStatus:65,
    submissionTypes:60,
    attemptsLeft:55,
    dueAt:50,
    pointsPossible:40,
    currentPercent:35,
    startAt:30
  },
    op=operators.filter(v=>v.re.test(raw)).sort((a,b)=>(priorities[b.answer]||0)-(priorities[a.answer]||0))[0];
  if(!op)return null;
  if(op.private&&!grades(s))return card('none',[],{},'Show grades is off. Say “show grades” to turn it on.');
  if(op.answer==='teacherComments'&&(s.teacherFeedback===false||s.privacy?.feedback===false||s.privacy?.teacherFeedback===false))return card('none',[],{},'Teacher feedback sharing is off.');
  const admitted=admittedRow(raw,s,session,rows,prepared),
    pool=admitted?[admitted]:op.answer==='currentPercent'&&/\b(?:lowest|smaller|least|most attention|rank|compare)\b/i.test(raw)?rows.filter(row=>row.kind==='course-grade'):[];
  let candidates=pool.filter(v=>(!op.kinds||op.kinds.includes(v.kind))&&op.keys.some(k=>has(v,k)&&(!op.date||Number.isFinite(stamp(v[k])))));
  if(!candidates.length)return null;
  if(op.answer==='dueAt'&&/\b(?:approved|personal|extension|individual)\b/i.test(raw)&&candidates.some(v=>has(v,'approvedDueAt')))candidates=candidates.filter(v=>has(v,'approvedDueAt'));
  let ordered=choose(candidates,c,op.keys);
  if(op.answer==='currentPercent'&&/\b(?:lowest|smaller|least|most attention|rank|compare)\b/i.test(raw))
    ordered=ordered.sort((a,b)=>Number(a.currentPercent??a.percent)-Number(b.currentPercent??b.percent));
  const row=ordered[0];
  if(!row)return null;
  const key=op.keys.find(k=>has(row,k));
  let value=row[key];
  if(op.answer==='attemptsLeft')
    value=row.attemptsRemaining??(Number.isFinite(row.attemptsAllowed)&&Number.isFinite(row.attemptsUsed)?Math.max(0,row.attemptsAllowed-row.attemptsUsed):value);
  const display=op.date?new Date(stamp(value)).toLocaleString('en-US',{timeZone:s.timeZone||'America/New_York'}):Array.isArray(value)?value.join(', '):String(value),
    suffix=op.answer==='currentPercent'?'%':['timeLimit'].includes(op.answer)?' min':'',
    label=op.label,
    valueText=display+suffix;
  return card('find',ordered,{...row.fields,itemId:row.id,answerField:op.answer,[key]:value},label+': '+valueText+'.',{label,value:valueText});
 }
 /* Relations describe source admission, never permission to override caller action/route classification.
  Expanded lookup belongs after learned open/find. typed-fact uses a source-kind handler; named-fact uses a unique explicit name; selected-fact uses scoped selection.
  metadata-fact projects one admitted row and does not authorize skipping source ranking for an unrestricted pool. source-page/source-fact retain their container contracts. */
 const api={resolve,chooseTask,taskChoiceRequest,operators,sourceFact,sourceTime,selectedFact,manualFact};
 root.ReserveBiscuitFacts=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
