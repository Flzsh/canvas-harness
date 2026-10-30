/* Linear decisions select actions and source rows; exact parsers still own values and gates. */
(function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null),
   L=()=>load('ReserveBiscuitLearn','./biscuit-learn.js'),
   P=()=>load('ReserveBiscuitParse','./biscuit-parse.js'),
   list=v=>Array.isArray(v)?v:[],
   mutate=new Set(['complete','setting','feature','module','focus','focus-control','reminder','plan','note','bookmark']),
   canon=a=>
     ({
       open:'open/find',
       find:'open/find',
       pet:'setting',
       'focus-status':'focus-control',
       break:'focus-control',
       routine:'reminder',
       preset:'setting',
       quiet:'setting',
       skill:'feature',
       features:'feature',
       play:'navigate',
       help:'chat'
     })[a]||
       a;
 const card=(action,items,fields,message,extra={})=>({action,items:items.slice(0,3),message,next:{action,fields:fields||{},label:'Continue'},...extra}),
   time=(n,s)=>new Date(n).toLocaleString('en-US',{timeZone:s.timeZone||'America/New_York'}),
   grades=s=>s.showGrades!==false&&s.settings?.showGrades!==false&&s.privacy?.grades!==false&&(s.showGrades===true||s.settings?.showGrades===true);
 const vocabularyCache=new WeakMap();
 function groundedInput(input,pack,rows,s,session){
   let known=vocabularyCache.get(pack);
   if(!known){known=new Set(Object.keys(pack.models.action.weights).filter(v=>/^w:[\p{L}\p{N}]+$/u.test(v)).map(v=>v.slice(2)));vocabularyCache.set(pack,known);}
   const selected=rows.find(v=>String(v.id)===String(s.selectedItemId||s.itemId||s.page?.itemId||session.lastItemId||'')),Facts=load('ReserveBiscuitFacts','./biscuit-facts.js');
   if(selected&&Facts?.operators.some(op=>op.re.test(input)&&(!op.private||grades(s))&&op.keys.some(k=>selected[k]!==undefined&&selected[k]!==null)))return true;
   const words=L().words(input);
   if(words.some(w=>known.has(w)))return true;
   const query=new Set(words);
   if(rows.some(v=>L().words(v.title+' '+v.text+' '+v.aliases).some(w=>query.has(w))))return true;
   return !!load('ReserveBiscuitLanguage','./biscuit-language.js')?.prepare(input,s,session,rows)?.matches?.length;
 }
 function noteText(raw,s){
  const literal=load('ReserveBiscuitIntent','./biscuit-intent.js')?.literalNotePayload?.(raw,s);
  if(literal){
    const course=list(s.courses).find(v=>v.name&&raw.toLowerCase().includes(String(v.name).toLowerCase()));
    return {...literal,...(course?{courseId:String(course.id)}:{})};
  }
  const quoted=/["\u201c]([^"\u201d]+)["\u201d]/.exec(raw),named=/\b(?:titled|called|named)\s+([^:,.]+)(?=[:,.]|$)/i.exec(raw);let match,text;
  if(quoted&&/\b(?:exact|verbatim|preserve|sentence|note)\b/i.test(raw))text=quoted[1];
  else if((match=/\b(?:containing\s+exactly|saying|that\s+says|verbatim)\s*:?\s*(.+)$/i.exec(raw)))text=match[1];
  else if((match=/\b(?:jot|write|log|note|record|apunta)\s+(?:(?:this|these|it|down|esto|exact|words|in|into|my|own|a|new|notes?|for|me)\s+)*[:\u{1f4dd}]*\s*(.+)$/iu.exec(raw)))text=match[1];
  if(!text){const m=/^(?:\u8bb0\u7b14\u8bb0|\u7b14\u8bb0)[^:\uff1a]*[:\uff1a]\s*(.+)$/u.exec(raw);if(m)text=m[1];}
  if(!text)return null;
  text=text.replace(/\s+(?:Associate it with|for the course)\s+.+$/i,'').replace(/;\s*(?:don['\u2019]?t|do not)\s+(?:auto.correct|change|rewrite).*$/i,'').replace(/\s+i keep remembering.*$/i,'').trim();
  if(!text)return null;
  const course=list(s.courses).find(v=>raw.toLowerCase().includes(String(v.name||'').toLowerCase())&&v.name);
  return {text,...(named?{title:named[1].trim()}:{}),...(course?{courseId:String(course.id)}:{})};
 }
 function localTarget(kind,s,session,ranked,input=''){
   const values=kind==='reminder'?list(s.reminders||s.pet?.reminders):kind==='plan'?list(s.planner):kind==='note'?list(s.notes):list(s.bookmarks),
     id=String(s.selectedItemId||s.itemId||session.lastItemId||session.lastAction?.targetId||''),
     direct=values.find(v=>String(v.id)===id);
   if(values.length>1&&!direct&&/\b(?:one of|which one|not sure|unsure|forgot which|cannot choose|can't choose)\b/i.test(input)){
     const text=' '+L().words(input).join(' ')+' ',named=values.filter(v=>{const name=L().words(v.title||v.text).join(' ');return name&&text.includes(' '+name+' ');});
     if(named.length!==1)return null;
     return named[0];
   }
   return direct||ranked.map(v=>values.find(x=>String(x.id)===String(v.id))).find(Boolean)||(values.length===1?values[0]:null);
 }
 function safeRows(rows,s){
   return rows.filter(v=>!(['grade','feedback','course-grade'].includes(v.kind)||v.gradeAccess===true)||grades(s)).filter(v=>v.kind!=='feedback'||s.teacherFeedback!==false&&s.privacy?.feedback!==false);
 }
 /* Intentional feature-universe alignment is separate from exact request reuse.
    No candidate is removed here: the existing candidate filter is unchanged.
    The feature rows are the full safe rows used by fitting; parent must verify/refit.
    Private handoff filtering may produce a different universe, which must recompute. */
 function rankedItems(model,input,candidates,s,session,action,universe,owned,config={}){
  const Learn=L(),
    featureInput=config.conversationEvidence===true?Learn.sourceInput(input,s,session,universe,config):input,
    ranked=owned?owned.rank(model,featureInput,candidates,s,session,action,universe):Learn.rank(model,featureInput,candidates,s,session,action,universe),
    Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),
    ordered=Selection?.order(input,ranked,s,session,action);
  if(ordered){if(owned)owned.retain(ranked,ordered);else Learn.retainRank?.(ranked,ordered);return ordered;}return Learn.rank(model,featureInput,universe,s,session);
 }
 /* Opt-in packs reject malformed booleans before dispatch. Calibration uses this
    selector's actual admission/order/threshold implementation, never copied gates. */
 function learnedContext(pack){
   const value=pack?.features?.learnedContext;
   if(value===undefined||value===false)return false;
   if(value!==true)throw new TypeError('features.learnedContext must be a boolean');
   return true;
 }
 function uiSourceReference(pack){
   const features=pack?.features||{};
   if(!Object.hasOwn(features,'uiSourceReference'))return false;
   if(typeof features.uiSourceReference!=='boolean')throw new TypeError('features.uiSourceReference must be a boolean');
   if(features.uiSourceReference&&features.learnedContext!==true)throw new TypeError('UI source reference requires learned context');
   return features.uiSourceReference;
 }
 function referencedPage(input,row){
  if(!row)return null;
  const Learn=L(),Intent=load('ReserveBiscuitIntent','./biscuit-intent.js'),text=Intent?.sourceSpan?.(input)||Intent?.requestSpan?.(input)||String(input);
  if(/\b(?:this|that|these|those|it|its|selected|current|loaded)\b/i.test(text))return row;
  const query=[...new Set(Learn.content(text).filter(word=>word.length>=4&&!/^(?:explain|please|could|would|question|answer|understand|something|general|idea)$/.test(word)))],
    words=new Set(Learn.content(row.title+' '+(row.text||row.description||row.body||''))),
    hits=query.filter(word=>words.has(word)).length;
  return hits>=2?row:null;
 }
 function answer(input,row,s,rows){
  if(!row)return 'No matching item is loaded in this workspace.';const text=String(input),name=row.title,at=n=>Number.isFinite(Number(n))?time(Number(n),s):String(n),facts=[];
  if(/\b(?:attempts?|tries|retry|try again)\b/i.test(text))
    for(const key of ['attemptsLeft','attemptsRemaining','attemptsAllowed','attemptsUsed'])if(row[key]!==undefined)facts.push(key.replace(/([a-z])([A-Z])/g,'$1 $2')+': '+row[key]);
  if(/\b(?:points|worth|maximum|possible)\b/i.test(text)&&row.pointsPossible!==undefined)facts.push(row.pointsPossible+' points possible');
  if(/\b(?:reply|response)\b/i.test(text)&&row.replyDueAt)
    facts.push('Reply deadline: '+at(row.replyDueAt));
  else if(/\b(?:due|deadline|when|close|until|left)\b/i.test(text)&&row.dueAt)facts.push('Due: '+at(row.dueAt));
  if(/\b(?:close|available|availability|lock)\b/i.test(text)&&row.availableUntil)facts.push('Available until: '+at(row.availableUntil));
  if(/\b(?:grade|total|percent|average)\b/i.test(text)&&row.currentPercent!==undefined&&grades(s))facts.push('Current total: '+row.currentPercent+'%');
  if(/\b(?:submit|upload|extension|format|file type)\b/i.test(text)){
    if(row.submissionTypes)facts.push('Submission: '+list(row.submissionTypes).join(', '));
    if(row.allowedExtensions)facts.push('Allowed files: '+list(row.allowedExtensions).join(', '));
  }
  const raw=String(row.text||row.description||row.instructions||'').replace(/\s+/g,' ').trim();
  if(raw){
    const q=new Set(L().content(input)),
      sentences=raw.split(/(?<=[.!?;])\s+/),
      chosen=sentences.map((v,i)=>({v,i,h:L().content(v).filter(w=>q.has(w)).length})).sort((a,b)=>b.h-a.h||a.i-b.i).slice(
        0,
        raw.length<550?sentences.length:3).sort((a,b)=>
        a.i-b.i).map(v=>
        v.v).join(' ');
    facts.push(chosen.slice(0,1100));
  }
  let message=name+(facts.length?': '+[...new Set(facts)].join(' '):'.');
  if(/\b(?:submit|upload|send|reply|join|purchase|buy|install|uninstall)\b/i.test(text))message+=' Open the item in Canvas or Market to review and finish that step yourself.';
  return message;
 }
 /* Ownership ends on every return/throw. Public handoff calls keep guarded reuse.
    The aiPage branch never ranks or builds a private feature view just to fill a cache. */
 function evaluate(input,s,session,pack,allRows,legacy){
   learnedContext(pack);
   uiSourceReference(pack);
   const Learn=L();
   return Learn.beginInference?
     Learn.beginInference(owned=>evaluateImmediate(input,s,session,pack,allRows,legacy,owned)):
     evaluateImmediate(input,s,session,pack,allRows,legacy);
 }
 function evaluateImmediate(input,s,session,pack,allRows,legacy,owned){
  const Parse=P(),Lrn=L(),raw=String(input||'').trim().slice(0,4096);
  if(!raw)return null;
  if(/^(?:(?:what(?:'s| is)?|show(?: me)?|list|any)\s+)?(?:is\s+)?(?:due(?!\s+date\s+(?:for\s+|of\s+)?(?:the\s+|my\s+)?(?!today\b|tomorrow\b|tonight\b|this\b|next\b)[a-z])(?:\s+work)?|(?:work|assignments|homework|tasks)\s+(?:is\s+)?due)\b/i.test(raw)||/^what\s+(?:do|have|must)\b.*\bdue\b/i.test(raw)||/^(?:what|which)\s+(?:homework|hw|quiz|quizzes|tests?|exams?|assignments?)\s+(?:do\s+i\s+have|(?:is|are)\s+(?:due|there))\s+(?:today|tonight|tomorrow|tmrw|this\s+week|on\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*\??$/i.test(raw))return null;
  const installed=Parse.installed?.(raw,s),
    exact=Parse.commands(raw,s),
    local=Parse.local?.(raw,s),
    rows=safeRows(allRows,s),
    features=Lrn.actionFeatures(raw,s,session,{...pack.features,parseCues:{command:exact?.[0],local:local?.[0]}}),
    ranking=Lrn.classify(pack.models.action,features,true),
    lead=ranking[0];
  if(!lead)return null;
  const Intent=load('ReserveBiscuitIntent','./biscuit-intent.js');
  let action=Intent?.choose(raw,s,session,lead.label,lead.probability)||lead.label,detail={};
  const detailResult=Lrn.classify(
    pack.models['detail:'+action],
    pack.features?.conversationEvidence===true?Object.fromEntries(Object.entries(features).filter(([key])=>key!=='state:previousOpenQuestion'&&!key.startsWith('priorAction:'))):features,
    true)[0];
  if(detailResult)try{detail=JSON.parse(detailResult.label);}catch{}
  if(action==='plan'){const choice=load('ReserveBiscuitFacts','./biscuit-facts.js')?.chooseTask?.(raw,s,session,rows);if(choice)return choice;}
  if(action==='open/find'&&!groundedInput(raw,pack,rows,s,session))
    return card('none',[],{},'No matching words or item are loaded. Name a course, item or action.',{route:'local',routing:{route:'local',reason:'unsupported-input'}});
  const canvasKinds=new Set(['course','assignment','file','page','quiz','discussion','announcement','grade','feedback','course-grade','submission','teacher','person','group','canvas-module','rubric','syllabus','event','message']),
    hasCanvas=rows.some(v=>canvasKinds.has(v.kind)),
    ownLocal=/\b(?:leave myself|left myself|wrote|written|personal|installed|installation)\b|\b(?:my|saved|local)\s+(?:notes?|reminders?|bookmarks?|links?)\b|\b(?:note|reminder|bookmark)\b/i.test(raw);
  const sourceScope=Intent?.requestSpan(raw)||raw,
    sourceRequest=/\b(?:courses?|class|assignments?|tasks?|homework|quizzes|quiz|tests?|notices?|announcements?|threads?|discussions?|syllabus|teachers?|group page|rubric|absence|late|grace)\b/i.test(sourceScope)&&
      (/^(?:what|which|who|when|where|how many|how much|show|find|open|check|link me)\b/i.test(sourceScope)||Lrn.words(sourceScope).length<=6&&/\b(?:attachments?|topics?|rules?|policy|instructions|deadlines?|due|requirements?|cutoff)\b/i.test(sourceScope));
  if(!hasCanvas&&
    !ownLocal&&
    (['open/find','navigate'].includes(action)||
      action==='chat'&&sourceRequest||
      action==='plan'&&/\b(?:course|class|homework|assignment|school work|deadline|calendar|event|help hour|session)\b/i.test(sourceScope))&&
    !/\b(?:settings?|preferences?|companion|biscuit|pet|theme|market|toolbar|panel|timer)\b/i.test(raw))
    return card('none',[],{},'No courses or Canvas items are loaded. Open Canvas to load your course data.',{route:'local',routing:{route:'local',reason:'unavailable-source'}});
  if(/^(?:(?:that|this|the other|same|second|third)(?: one)?|it)[.!?\s]*$/i.test(raw)&&
    !rows.some(v=>String(v.id)===String(s.selectedItemId||s.itemId||session.lastItemId||session.itemId||''))&&
    !list(session.items||session.lastItems||session.lastResult?.items).length)
    return card('none',[],{},'Which loaded item do you mean?',{route:'local',routing:{route:'local',reason:'unavailable-reference'}});
  const explicit=/^(?:ask\s+ai\b|\?)/i.test(raw),negativeLegacy=/\b(?:do\s+not|don't|dont|never|not\s+to)\s+(?:(?:please|actually|just|want|need)\s+)*(?:mark|complete|delete|remove|save|bookmark|start|stop|end|cancel|freeze|unfreeze|pause|resume|change|switch|set|turn|enable|disable|activate|deactivate|plan|schedule|remind|write|draft|explain|generate|invent|compose|translate)\b/i.test(raw.replace(/\u2019/g,"'"));
  const negative=Intent?.negated(raw,action)??negativeLegacy,
    semanticAction=Intent?.choose(raw,s,session,'none',0),
    semanticWins=semanticAction&&semanticAction!=='none'&&semanticAction===action,
    exactCompatible=!semanticWins||canon(exact?.[0]?.intent)===action;
  if(exact?.length&&exactCompatible&&!negative&&(!Parse.readOnly?.(raw)||exact[0].intent==='focus-status')){
    const resolved=load('ReserveBiscuitDetails','./biscuit-details.js')?.resolve(canon(exact[0].intent),raw,s,session,rows,[],exact[0].fields||{});
    if(resolved)return resolved;
  }
  const infoOnly=/^\s*(?:if|unless|suppose|what if|how (?:do|can|could|would) i|why (?:would|should|do|did)|can i|could i|should i|may i)\b/i.test(raw)&&!Intent?.scheduleRequest(raw);
  if(infoOnly&&mutate.has(action))return card('none',[],{},'Your preferences are unchanged. Name the control to inspect it.',{route:'local',routing:{route:'local',reason:'negation'}});
  if(!negative&&!infoOnly&&['setting','feature','module'].includes(action)){
    const value=load('ReserveBiscuitControlRequest','./biscuit-control-request.js')?.resolve(action,raw,s,session,detail);
    if(value){value.understanding={learned:true,tier:pack.tier,reason:'control-value',actionProbability:lead.probability};return value;}
  }
  if(action==='note'&&Intent?.literalNoteRequest?.(raw)&&!negative&&!infoOnly){
    const payload=noteText(raw,s);
    if(payload)
      return card(
        'note',
        [],
        {operation:'create',...payload},
        'Save note: '+payload.text,
        {route:'local',routing:{route:'local',reason:'literal-note'},understanding:{learned:true,tier:pack.tier,reason:'literal-note'}});
  }
  const semanticAI=action==='ai'&&Intent?.choose(raw,s,session,'none',0)==='ai';
  if(installed?.length||exact?.length&&exact[0].intent!=='open'&&exact[0].intent!=='ai'&&!(semanticWins&&!exactCompatible))return null;
  if((Array.isArray(exact)&&!exact.length||Array.isArray(local)&&!local.length)&&mutate.has(action)&&!Intent?.positive(raw,action))
    return card('none',[],{},'Choose a valid command value.',{route:'local',routing:{route:'local',reason:'invalid-command'}});
  if(negative&&action==='ai')return card('none',[],{},'I left that request alone.',{route:'local',routing:{route:'local',reason:'negation'}});
  if(action==='focus-control'&&/\b(?:status|running or paused|time (?:is )?left|how (?:long|much).*left|how much.*remains)\b/i.test(raw)){
    const status=load('ReserveBiscuitDetails','./biscuit-details.js')?.resolve(action,raw,s,session,rows,[],{action:'status'});
    if(status)return status;
  }
  if((negative||
    Parse.readOnly?.(raw)&&
      /^\s*(?:what|why|how|where|when|who|which|whether|if|unless|suppose|is|are|does|did|should i|can i|could i|may i|will i)\b/i.test(raw)&&
      !Intent?.positive(raw,action)&&
      !Intent?.scheduleRequest(raw))&&
    mutate.has(action))
    return card('none',[],{},'I left that unchanged.',{route:'local',routing:{route:'local',reason:'negation'}});
  if(installed!==null&&installed!==undefined&&!installed.length&&/^(?:use|apply|switch\s+to)\b/i.test(raw))return null;
  if(explicit)action='ai';
  const completionOwner=action==='complete'&&Intent?.positive(raw,'complete')?load('ReserveBiscuitSelection','./biscuit-selection.js').reference(raw,rows,s,session,{actor:'complete'}):null,
    localCompletion=completionOwner?.explicit&&completionOwner.row?.kind==='assignment';
  if(!localCompletion&&
    !(action==='setting'&&detail.key==='showGrades')&&
    !grades(s)&&
    /\b(?:scores?|grades?|marks?|feedback|average|earned points|weighting|course totals?)\b/i.test(Intent?.withoutPrivateExclusions?.(raw)??raw)&&
    !/\b(?:public|rubric|criteria|policy|syllabus|contact|conversation|teacher|hidden right now|whether.*hidden|are.*hidden|privacy status|grade visibility|visibility setting|private marks remain hidden|controls.*hidden|published rule|scoring policy|no grade|without.*grades|hide|cover)\b/i.test(raw))
    return card('none',[],{},'Grade access is disabled. Open your private visibility settings to review it.',{route:'local',routing:{route:'local',reason:'privacy'}});
  const wrap=result=>{
    result.understanding={step:'understanding',reason:'linear-score',learned:true,tier:pack.tier,actionProbability:lead.probability};
    const route=result.action==='ai'?'ai':'local';
    result.route=route;
    result.routing={route,reason:result.understanding.reason};
    return result;
  };
  if(action==='open/find'){const fact=load('ReserveBiscuitFacts','./biscuit-facts.js')?.resolve(raw,s,session,rows);if(fact?.relation&&fact.relation!=='metadata-fact')return wrap(fact);}
  const candidateRows=rows.filter(v=>
    !['feature','setting','tab','home-module','action'].includes(v.kind)||action!=='ai'&&/\b(?:feature|setting|preference|module|widget|tab|control|button|panel)\b/i.test(raw));
  const aiPage=action==='ai'&&candidateRows.find(v=>v.id===String(s.selectedItemId||s.itemId||s.page?.itemId||'')&&!['course','setting','feature','tab','home-module','action'].includes(v.kind));
  const readOnly=Parse.readOnly?.(raw)&&/^\s*(?:what|which|where|when|why|how|who|is|are|does|did|can i|could i|should i|if|unless|suppose)\b/i.test(raw),
    sorted=!aiPage&&!(action==='ai'&&learnedContext(pack))&&['ai','open/find','navigate','focus','bookmark','complete','plan','reminder','note'].includes(action)?
      rankedItems(pack.models.item,raw,candidateRows,s,session,action,rows,owned,pack.features):
      [],
    wanted=action==='navigate'&&/\bcourse\b/i.test(raw)?sorted.filter(v=>v.kind==='course'):sorted,
    items=wanted.slice(0,3),
    top=items[0],
    slotText=raw.replace(/\b(?:more|extra|additional|less|fewer)\b/gi,' '),
    slots=action==='ai'?null:load('ReserveBiscuitValues','./biscuit-values.js').slots(slotText,s,pack.values),
    fields={...detail};
  for(const pattern of pack.patterns||[]){
    const hit=load('ReserveBiscuitRules','./biscuit-rules.js').matchPattern(pattern,raw.replace(/[.!?]+$/,''));
    if(hit){
      const f={};
      for(const [k,v]of Object.entries(pattern.fields||{}))f[k]=v&&typeof v==='object'&&v.slot?hit[v.slot]:v;
      if(pattern.action==='chat')return wrap(card('chat',[],{},'Hi! How is your day going?'));
      if(pattern.action==='focus-control'&&['pause','resume','stop'].includes(f.action))return wrap(card('focus-control',[],f,f.action+' the focus timer.'));
      if(pattern.action==='setting'&&f.key==='theme'&&['light','dark'].includes(f.value)&&!negative)return wrap(card('setting',[],f,'Set theme to '+f.value+'.'));
    }
  }
  const controlValue=load('ReserveBiscuitControlRequest','./biscuit-control-request.js')?.resolve(action,raw,s,session,detail);if(controlValue)return wrap(controlValue);
  if(action==='ai')return legacy(raw,s,session);
  const exactValues=load('ReserveBiscuitDetails','./biscuit-details.js')?.resolve(action,raw,s,session,rows,sorted,detail);if(exactValues)return wrap(exactValues);
  if(action==='open/find'){
    if(!top)return wrap(card('none',[],{},'No matching item is loaded. Open Canvas to load your course data.'));
    if(['feature','setting','tab','home-module','action'].includes(top.kind)&&!controlValue)return wrap(card('none',[],{},'No matching course item is loaded. Name a loaded item or open Canvas.'));
    const values={...top.fields,itemId:top.id,...detail};
    for(const key of ['dueAt','replyDueAt','availableUntil','pointsPossible','attemptsLeft','attemptsRemaining','currentPercent','submissionTypes','allowedExtensions','approvedDueAt','notesAllowed','calculatorAllowed','formulaSheetAllowed','scoringPolicy'])if(top[key]!==undefined)values[key]=top[key];
    return wrap(card('find',items,values,answer(raw,top,s,rows)));
  }
  if(action==='none')return wrap(card('none',[],{},/\b(?:grades?|scores?|feedback|average)\b/i.test(raw)&&!grades(s)?'Grade access is disabled. Open your private visibility settings to review it.':'I cannot safely choose that from the loaded workspace. Open Canvas or name the item and the change you want.'));
  if(action==='chat'){
    const op=detail.operation,
      message={
        thank:'You are welcome.',
        celebrate:'That sounds like a good step forward.',
        vent:'That sounds frustrating. Take a moment; we can choose one small next step.',
        reassurance:'We can take this one step at a time.',
        fatigue:'You sound tired. A short rest is an option.',
        greeting:'Hi! How is your day going?',
        'companion-check':(Parse.companionName?.(s)||'Biscuit')+' is here.',
        'playful-smalltalk':'I am keeping you company.',
        'close-conversation':'See you later.'
      }[op]||
        'I am here. We can take things one step at a time.';
    return wrap(card('chat',[],{},message));
  }
  if(action==='setting'){
    if(detail.operation==='quiet-reminders'){
      const minutes=slots.minutes;
      if(!Number.isFinite(minutes)||minutes<=0)return wrap(card('none',[],{},'How long should reminders stay quiet?'));
      return wrap(card(
        'setting',
        [],
        {key:'pet.quietUntil',value:s.now+minutes*60000,operation:'quiet-reminders',until:s.now+minutes*60000,preserveReminderIds:list(s.reminders||s.pet?.reminders).map(v=>v.id)},
        'Keep reminders quiet for '+minutes+' min; their saved times stay in place.'));
    }
    if(readOnly)return wrap(card('none',[],{},'Your preferences are unchanged. Open Companion or Appearance to inspect them.'));
    if(detail.operation==='undo')return wrap(card('undo',[],{},'Undo the last local change.'));
    if(!fields.key||fields.value===undefined)return null;
    return wrap(card('setting',[],fields,'Set '+fields.key+' to '+String(fields.value)+'.'));
  }
  if(action==='feature'||action==='module'){
    if(readOnly)return wrap(card('none',[],{},'Your preferences are unchanged.'));
    if(action==='feature'&&(!fields.id||typeof fields.on!=='boolean')||action==='module'&&(!fields.key||!fields.action))return null;
    return wrap(card(action,[],fields,(action==='feature'?(fields.on?'Enable ':'Disable '):fields.action+' ')+(fields.id||fields.key)+'.'));
  }
  if(action==='navigate'){
    const lang=load('ReserveBiscuitLanguage','./biscuit-language.js')?.prepare(raw,s,session,rows),
      namedCourse=lang?.matches?.find(v=>v.nameExact||v.nameMatch>=.9),
      chosenCourse=rows.find(v=>v.kind==='course'&&v.id===String(namedCourse?.id||'')),
      tabMatch=/\b(?:inbox|unread (?:messages|conversations)|messages non lus|messages?)\b/i.test(raw)?'inbox':/\b(?:bookmarks?|saved links|saved resources)\b/i.test(raw)?'bookmarks':/\b(?:people|roster|class list|classmates|names page)\b/i.test(raw)?'people':null;
    if(tabMatch){
      const page=rows.find(v=>v.id===String(s.selectedItemId||s.itemId||s.page?.itemId||'')),
        courseId=String(page?.courseId||s.activeCourseId||session.lastCourseId||''),
        target=tabMatch==='inbox'?sorted.find(v=>v.kind==='message'):tabMatch==='people'?rows.find(v=>v.kind==='course'&&v.id===courseId):null;
      return wrap(card(
        'navigate',
        target?[target]:[],
        {tab:tabMatch,...(courseId?{courseId}:{}),...(target?{itemId:target.id}:{}),...(/\bunread|non lus\b/i.test(raw)?{filter:'unread'}:{})},
        'Open '+tabMatch+'.'));
    }
    if(chosenCourse)return wrap(card('navigate',[chosenCourse],{tab:'course',courseId:chosenCourse.id},'Open '+chosenCourse.title+'.'));
    const page=rows.find(v=>v.id===String(s.selectedItemId||s.itemId||s.page?.itemId)),course=page?.kind==='course'?page.id:page?.courseId;
    if(/\bcourse\b/i.test(raw)&&course){
      const row=rows.find(v=>v.kind==='course'&&v.id===String(course));
      return wrap(card('navigate',row?[row]:[],{courseId:String(course)},'Open '+(row?.title||'the selected item\u2019s course')+'.'));
    }
    const destination=fields.tab||(/market|shop|store/i.test(raw)?'market':/inbox|messages/i.test(raw)?'messages':/pet|biscuit|companion/i.test(raw)?'pet':null);
    if(!destination)return null;
    if(destination==='market')
      return wrap(card('navigate',items,{...fields,tab:'market'},'Open Market'+(top?.kind==='market-item'?' for '+top.title:'')+'. Review the item and finish the selected control there.'));
    return wrap(card('navigate',items,{...fields,tab:destination},'Open '+destination+'.'));
  }
  if(action==='focus-control'){
    const control=fields.action||'status',minutes=slots.minutes??(slots.numbers?.length===1?slots.numbers[0]:undefined);
    if(control==='status')return null;
    if(['setRemaining','set-remaining','reset'].includes(control)){
      const value=slots.minutes??(slots.numbers?.length===1?slots.numbers[0]:undefined);
      if(!Number.isFinite(value)||value<=0||value>1440)return wrap(card('none',[],{},'How many minutes should remain?'));
      return wrap(card(
        'focus-control',
        [],
        {action:control==='reset'?'reset':'set-remaining',minutes:value,...(/\bbreak|rest\b/i.test(raw)?{mode:'break'}:{}),...(control==='reset'?{autostart:false}:{})},
        control==='reset'?'Reset the timer to '+value+' min and leave it stopped.':'Set '+value+' min remaining.'));
    }
    if(control==='break')return wrap(card('break',[],{minutes:minutes||5,explicit:true},'Take a '+(minutes||5)+' min break.'));
    if(control==='adjust'){
      if(!Number.isFinite(minutes)||minutes<=0||minutes>1440)return wrap(card('none',[],{},'How many minutes should I change the timer by?'));
      const signed=/\b(?:shorten|less|fewer|cut|reduce|subtract|remove|knock)\b|^\s*-|[\u2212-]\s*\d/i.test(raw)?-minutes:minutes;
      return wrap(card('focus-control',[],{action:'adjust',minutes:signed},(signed>0?'Add ':'Remove ')+minutes+' min '+(signed>0?'to':'from')+' the focus timer.'));
    }
    if(!['pause','resume','stop'].includes(control))return wrap(card('none',[],{},'Use pause, resume, stop, or a number of minutes.'));
    return wrap(card('focus-control',[],{action:control},control[0].toUpperCase()+control.slice(1)+' the focus timer.'));
  }
  if(action==='reminder'){
    if(['cancel','delete'].includes(fields.operation)&&!/^(?:cancel|delete|remove|retire|dismiss|forget|stop (?:reminding|pinging|nudging|notifying))\b/i.test(Intent?.requestSpan(raw)||raw))
      return wrap(card('none',[],{},'Which reminder and change do you mean?'));
    if(fields.operation&&fields.operation!=='create'){
      const target=localTarget('reminder',s,session,sorted,raw),previous=session.lastAction;
      if(fields.operation==='undo-cancel'&&previous?.before)
        return wrap(card('reminder',[],{operation:'undo-cancel',restore:previous.before},'Restore the cancelled reminder: '+(previous.before.title||previous.before.text)+'.'));
      if(!target)return wrap(card('none',[],{},'Which saved reminder do you mean?'));
      const request={
        ...fields,
        targetId:target.id,
        ...(slots.relative!==undefined?{at:s.now+slots.relative*60000}:{}),
        ...(slots.minute!==undefined?{at:slots.wall(slots.date||slots.local(s.now).date,slots.minute,slots.local,s.now)}:{})
      };
      return wrap(card('reminder',[],request,fields.operation+' reminder: '+(target.title||target.text)+'.'));
    }
    const direct=Parse.localReminder?.(raw,s),
      request=direct===null?'remind me '+raw:raw,
      found=local?.find(v=>v.intent==='reminder')||direct?.find(v=>v.intent==='reminder')||Parse.parse(request,s)?.find(v=>v.intent==='reminder');
    if(!found)return wrap(card('none',[],{},'What should I remind you about, and when?'));
    return wrap(card('reminder',[],found.fields,found.preview));
  }
  if(action==='note'){
    if(fields.operation&&fields.operation!=='create'){
      const target=localTarget('note',s,session,sorted,raw),previous=session.lastAction;
      if(fields.operation==='undo-delete'&&previous?.before)return wrap(card('note',[],{operation:'undo-delete',restore:previous.before},'Restore note: '+(previous.before.title||previous.before.text)+'.'));
      if(!target)return wrap(card('none',[],{},'Which saved note do you mean?'));
      return wrap(card('note',[],{...fields,targetId:target.id,...(noteText(raw,s)||{})},fields.operation+' note: '+(target.title||target.text)+'.'));
    }
    const found=local?.find(v=>v.intent==='note')||Parse.parse(raw,s)?.find(v=>v.intent==='note');
    if(found)return wrap(card('note',[],found.fields,found.preview));
    const payload=noteText(raw,s);
    if(payload)return wrap(card('note',[],{operation:'create',...payload},'Save note: '+payload.text));
    return wrap(card('none',[],{},'What exact text should I save? Use note: followed by your words.'));
  }
  if(action==='focus'){
    if(readOnly)return wrap(card('none',[],{},'The timer is unchanged.'));
    const target=sorted.find(v=>['assignment','course'].includes(v.kind)),minutes=slots.minutes||25;
    if(!target||slots.invalid||minutes<=0||minutes>1440)return wrap(card('none',[],{},'Choose a loaded assignment and a valid focus duration.'));
    return wrap(card(
      'focus',
      [target],
      {...(target.kind==='course'?{courseId:target.id}:{itemId:target.id,courseId:target.courseId}),minutes,cycles:1,breakMinutes:0},
      'Focus on '+target.title+' for '+minutes+' min.'));
  }
  if(action==='bookmark'||action==='complete'){
    const target=action==='complete'&&completionOwner?.explicit?
      (completionOwner.row?.kind==='assignment'?completionOwner.row:null):
      sorted.find(v=>action==='complete'?v.kind==='assignment':['assignment','file','page','discussion','message','link','quiz','event','rubric','syllabus','canvas-module','course'].includes(v.kind));
    if(!target||readOnly)return wrap(card('none',[],{},'Name the item you want to '+action+'.'));
    return wrap(card(action,[target],{...target.fields,itemId:target.id},(action==='complete'?'Mark done locally: ':'Bookmark: ')+target.title+'.'));
  }
  if(action==='plan'){
    if(fields.operation&&['move-block','resize-block','remove-block','undo'].includes(fields.operation)){
      const target=localTarget('plan',s,session,sorted,raw),previous=session.lastAction;
      if(!target)return wrap(card('none',[],{},'Which local study block do you mean?'));
      const request={
        ...fields,
        local:true,
        targetId:target.id,
        itemId:target.itemId,
        preserveAssignmentDeadline:true,
        ...(slots.minutes?{minutes:slots.minutes}:{}),
        ...(fields.operation==='remove-block'?{preserveAssignment:true}:{}),
        ...(slots.minute!==undefined?{startAt:slots.wall(slots.date||slots.local(s.now).date,slots.minute,slots.local,s.now)}:{}),
        ...(fields.operation==='undo'&&previous?.before?{restoreStartAt:previous.before.startAt,restoreEndAt:previous.before.endAt}:{})
      };
      if(request.startAt&&Number.isFinite(target.minutes))request.endAt=request.startAt+target.minutes*60000;
      return wrap(card('plan',[],request,fields.operation+' local study block: '+target.title+'.'));
    }
    if(readOnly&&!/^\s*(?:what|which|how)\b/i.test(raw))return wrap(card('none',[],{},'Your plan is unchanged.'));
    const old=legacy(raw,s,session);
    if(canon(old.action)==='plan'){
      const target=sorted.find(v=>v.kind==='assignment'&&!v.done&&!v.completed),f=old.next.fields;
      if(target&&(f.itemId||Lrn.itemFeatures(raw,target,s,session,rows).title>0)){
        f.itemId=target.id;
        old.items=[target,...sorted.filter(v=>v.id!==target.id)].slice(0,3);
      }
      return wrap(old);
    }
    const target=sorted.find(v=>v.kind==='assignment'&&!v.done&&!v.completed),
      specific=target&&Lrn.itemFeatures(raw,target,s,session,rows).title>0,
      bridge=load('ReserveBiscuitDetails','./biscuit-details.js').planSlots(slots,s,raw),
      planFields={
        local:true,
        line:raw,
        ...(specific?{itemId:target.id}:{}),
        ...(slots.date?{date:slots.date}:{}),
        ...(slots.minutes?{minutes:slots.minutes}:{}),
        ...(!bridge.invalid?bridge.fields:{})
      };
    if(slots.invalid)return wrap(card('none',[],{},'Choose a valid planning time.'));
    return wrap(card('plan',specific?[target]:[],planFields,'I will fit the loaded unfinished work into your available time.'));
  }
  return null;
 }
 const api={evaluate,answer,safeRows};
 Object.defineProperty(api,'contextCalibrationPolicy',{enumerable:true,get(){return load('ReserveBiscuitContextSelector','./biscuit-context-selector.js')?.policy;}});
 root.ReserveBiscuitInference=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
