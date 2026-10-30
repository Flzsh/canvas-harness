/* Exact values come from the current line and owned records, never model labels. */
(function(root){
 'use strict';
 const load=(n,p)=>root[n]||(typeof module==='object'&&module.exports?require(p):null),
   list=v=>Array.isArray(v)?v:[],
   stamp=v=>typeof v==='number'?v:Date.parse(v),
   norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(),
   card=(action,items,fields,message)=>({action,items:list(items).slice(0,3),message,next:{action,fields,label:'Continue'},route:'local',routing:{route:'local',reason:'exact-values'}});
 const finite=v=>typeof v==='number'&&Number.isFinite(v),
   nextDay=(date,n=1)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),
   rejected=(text,index)=>/\b(?:instead of|rather than|not(?:\s+at)?)\s*$/.test(text.slice(Math.max(0,index-40),index)),
   masked=v=>String(v).replace(/"[^"\n]*"|\u201c[^\u201d\n]*\u201d/g,m=>' '.repeat(m.length));
 function temporal(input,s,clockMode=true){
   const V=load('ReserveBiscuitValues','./biscuit-values.js'),
     text=V.normalize(masked(input)).replace(/[\u2010-\u2015\u2212]/g,'-').replace(/(\d)([hms])(?=\d)/g,'$1$2 ').replace(
       /\b(?:not|instead of|rather than)\s+(?:on\s+)?(?:today|tonight|tomorrow|\d{4}-\d{2}-\d{2})\b/g,
       m=>' '.repeat(m.length)),
     slots=V.slots(text,s),
     today=slots.local(s.now).date,
     date=slots.date||today,
     wall=(minute,day=date,after=s.now)=>slots.wall(day,minute,slots.local,after),
     days=[...text.matchAll(/\b(today|tonight|tomorrow)\b/g)],
     parts=[...text.matchAll(/\b(morning|afternoon|evening|tonight|after dinner|after school)\b/g)],
     clocks=[];
  if(clockMode)
    for(const m of text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?(?![\p{L}\p{N}:])/giu)){
      const h=Number(m[1]),part=Number(m[2]||0),index=m.index,end=index+m[0].length,before=text.slice(Math.max(0,index-28),index),tail=text.slice(end);
      if(/^(?:\.\d+)?\s*-?\s*(?:minutes?|mins?|m|hours?|hrs?|h|seconds?|secs?|s|days?)\b/.test(tail)||!m[2]&&!m[3]&&!/\b(?:at|by|from|until|till|to|between|and|around|a las)\s*$/.test(before))continue;
      const invalid=h>23||part>59||!!m[3]&&(h<1||h>12),
        near=days.slice().sort((a,b)=>Math.abs(a.index-index)-Math.abs(b.index-index))[0],
        hint=parts.slice().sort((a,b)=>Math.abs(a.index-index)-Math.abs(b.index-index))[0],
        ambiguous=!m[3]&&h>0&&h<12&&!/^0\d/.test(m[1]),
        day=near?nextDay(today,near[1]==='tomorrow'?1:0):date;
      let minute=(m[3]?h%12+(/p/i.test(m[3])?12:0):ambiguous&&hint?h%12+(/morning/.test(hint[1])?0:12):h)*60+part,at=invalid?null:wall(minute,day),chosenDay=day;
      if(!finite(at)&&ambiguous&&!hint){const later=wall(minute+720,day);if(finite(later)){minute+=720;at=later;}}
      if(!invalid&&!finite(at)&&!slots.date&&!days.length){chosenDay=nextDay(day);at=wall(minute,chosenDay);}
      clocks.push({index,end,minute,part,at,date:chosenDay,invalid});
    }
  if(clockMode&&!clocks.length&&slots.minute!==undefined&&!/\d{1,2}:\d{2}/.test(text))
    clocks.push({index:0,end:text.length,minute:slots.minute,at:wall(slots.minute),date,invalid:slots.invalid===true});
  return {text,slots,date,wall,clocks};
 }
 function destination(t){return t.clocks.filter(v=>finite(v.at)&&!v.invalid&&!rejected(t.text,v.index)).at(-1);}
 function duration(t){
   const corrected=t.text.replace(/^.*\b(?:actually|instead(?!\s+of)|change it to|make it|set it to)\s+/i,''),V=load('ReserveBiscuitValues','./biscuit-values.js');
   return V.fieldQuantity?.(corrected,'duration')?.minutes??V.quantities(corrected).at(-1)?.minutes??t.slots.minutes;
 }
 function mutationScope(input){
   const text=String(input),view=masked(text),m=/(?:;\s*(?:(?:and|then|also)\s+)*|[, ]+\b(?:and|then|also|with|plus)\s+)(?=(?:a\s+|an\s+)?(?:remind(?:er)?\b|warn(?:ing)?\b|(?:start|run|begin|set)\s+(?:(?:a|an|the)\s+)?(?:\d+[ -]+(?:minute\s+)?)?(?:focus|timer|countdown|break)\b|(?:show|open|find|read|save|note|send|submit)\b))/i.exec(view);
   return m?text.slice(0,m.index).trim():text;
 }
 function sourceBlocks(s){
   const visible=new Set([...list(s.assignments),...list(s.workItems),...list(s.personalTasks)].map(v=>String(v.id))),
     saved=s.biscuitPlan?.source==='biscuit'&&s.biscuitPlan.version===1?
       list(s.biscuitPlan.blocks).filter(v=>v.itemId&&visible.has(String(v.itemId))).map(v=>({...v,startAt:v.start,endAt:v.end,generated:true})):
       [];
   return [
     ...new Map([...list(s.planner).filter(v=>v&&(v.startAt!==undefined||v.start!==undefined||v.generated!==undefined)),...saved].map(v=>[String(v.id),v])).values()
   ];
 }
 function blockState(block,session){
   const previous=session.lastAction;
   if(previous?.action!=='plan')return block;
   const fields=previous.fields||{},target=String(fields.blockId||fields.plannerId||fields.targetId||previous.blockId||''),after=previous.after;
   if(target!==String(block.id)&&String(after?.id||'')!==String(block.id))return block;
   const state={...block};
   if(after&&String(after.id)===String(block.id))for(const key of ['startAt','start','endAt','end','minutes'])if(after[key]!==undefined)state[key]=after[key];
   if(target===String(block.id)){
     const start=fields.startAt??fields.start;
     if(start!==undefined){state.startAt=start;state.start=start;}
     if(finite(fields.minutes))state.minutes=fields.minutes;
     if(fields.endAt!==undefined)
       state.endAt=fields.endAt;
     else if(start!==undefined&&finite(stamp(start))&&finite(state.minutes))state.endAt=stamp(start)+state.minutes*60000;
   }
   return state;
 }
 function planAllocation(input){
  const source=String(input??'').slice(0,4096),
    view=masked(source),
    clauses=[],
    allocations=[],
    separator=/;\s*|[!?]\s*|\.(?=\s+[a-z])\s*|,\s*(?:and(?:\s+then)?|then|also|plus|but)\s+|\s+(?:and\s+then|then|also|plus)\s+|\s+and\s+(?=(?:(?:please|can you|could you)\s+)?(?:plan|schedule|reserve|allocate|budget|protect|book|fit|show|find|open|read|check|inspect|tell|remind|save|note|start|set\s+aside|block\s+out|i\s+(?:have|am)|a\s+\d))/gi;
  let start=0;
  const add=end=>{
    const part=source.slice(start,end),leading=part.length-part.trimStart().length,text=part.trim().replace(/^(?:(?:and|then|also|plus|but)\s+)+/i,'');
    if(text)clauses.push({scope:text,start:start+leading,end});
  };
  for(const m of view.matchAll(separator)){if(clauses.length>=31)break;add(m.index);start=m.index+m[0].length;}add(source.length);
  let pending='',active=null;
  for(const clause of clauses){
    const visible=masked(clause.scope).trim(),head=visible.replace(/^(?:please\s+|(?:can|could|would)\s+you\s+)+/i,'').replace(/^(?:(?:today|tomorrow|tonight|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:[ap]m)?)?\s*[, :]?\s*)/i,'');
   const lookup=/^(?:what|when|which|where|who|how|show|find|open|read|check|inspect|list|tell|look)\b/i.test(head),
     allocation=!lookup&&(/\b(?:plan|schedule|reserve|allocate|budget|protect|book|fit|free|available|set\s+aside|block\s+out|carve\s+out|make\s+time)\b/i.test(head)||/\b(?:i|we)\s+(?:only\s+)?have\b[^;.!?]{0,100}\b(?:minutes?|mins?|hours?|hrs?|seconds?|secs?|time)\b/i.test(head)||/^(?:a|an|the)\s+\d+(?:\.\d+)?[ -]+minute\b.*\b(?:block|session)\b/i.test(head));
   if(allocation){active={scope:(pending?pending+' ':'')+clause.scope,start:clause.start,end:clause.end};allocations.push(active);pending='';continue;}
   if(lookup||/^(?:remind|save|note|start|pause|stop|turn|enable|disable|send|submit|post)\b/i.test(head)){active=null;pending='';continue;}
   if(visible&&timing(visible)){if(active){active.scope+='; '+clause.scope;active.end=clause.end;}else pending=(pending?pending+' ':'')+clause.scope;continue;}
   if(active&&/^(?:without|excluding|except|not|do not|don't|never|keep|preserve|leave|respect|avoid|using|with|before|after|until|from|for|on|in|at)\b/i.test(visible)){active.scope+='; '+clause.scope;active.end=clause.end;}
   pending='';
  }
  return {scope:allocations[0]?.scope||source,allocations,clauses};
 }
 function planSlots(slots,s={},scope=''){
  const visible=masked(scope);
  if(slots&&
    finite(slots.relative)&&
    slots.endRelative===slots.relative&&
    !finite(slots.startRelative)&&
    /\b(?:start(?:ing)?|begin(?:ning)?)\s+in\b/i.test(visible)&&
    !/\b(?:leave|leaving|depart(?:ing|ure)?|bus|train|flight|pickup)\b[^;.!?]{0,60}\bin\b/i.test(visible))
    slots={...slots,startRelative:slots.relative,endRelative:undefined};
  const bad=reason=>({invalid:true,reason,fields:{},roles:{start:null,end:null,duration:null},window:false}),
    own=key=>Object.hasOwn(slots||{},key),
    has=key=>own(key)&&slots[key]!==undefined;
  if(!slots||slots.invalid||slots.unresolvedEvent||!finite(s.now)||typeof slots.local!=='function'||typeof slots.wall!=='function')return bad('invalid-slots');
  for(const key of ['startMinute','endMinute'])if(has(key)&&(!Number.isInteger(slots[key])||slots[key]<0||slots[key]>=1440))return bad('invalid-clock');
  for(const key of ['startRelative','endRelative','afterAt','budgetMinutes'])if(has(key)&&!finite(slots[key]))return bad('invalid-number');
  const minutes=has('budgetMinutes')?slots.budgetMinutes:undefined;if(finite(minutes)&&(minutes<=0||minutes>1440))return bad('invalid-budget');
  if(has('startRelative')&&slots.startRelative<0||has('endRelative')&&slots.endRelative<=0)return bad('invalid-relative-boundary');
  const date=slots.date||slots.local(s.now).date,
    roles={start:null,end:null,duration:finite(minutes)?'budget':null},
    fields={...(slots.date?{date:slots.date}:{}),...(finite(minutes)?{minutes}:{})};
  let startAt,endAt;
  if(has('startRelative')){startAt=s.now+slots.startRelative*60000;roles.start='relative';}
  else if(has('startMinute')){startAt=slots.wall(date,slots.startMinute,slots.local,s.now-1);roles.start='clock';}else if(has('afterAt')){startAt=slots.afterAt;roles.start='event';}
  if(roles.start&&(!finite(startAt)||startAt<s.now)||has('afterAt')&&roles.start&&startAt<slots.afterAt)return bad('invalid-start');
  if(has('endRelative')){endAt=s.now+slots.endRelative*60000;roles.end='relative';}
  else if(has('endMinute')){
    let endDate=slots.boundaryDate||slots.endDate||date;
    if(!slots.boundaryDate&&!slots.endDate&&has('startMinute')&&slots.endMinute<=slots.startMinute)endDate=nextDay(date);
    endAt=slots.wall(endDate,slots.endMinute,slots.local,finite(startAt)?startAt:s.now-1);
    roles.end='clock';
  }
  if(roles.end&&(!finite(endAt)||endAt<=s.now||finite(startAt)&&endAt<=startAt))return bad('invalid-end');
  const window=!!roles.start&&!!roles.end;if(!roles.end&&finite(startAt)&&finite(minutes)){endAt=startAt+minutes*60000;roles.end='duration';}
  if(finite(startAt))fields.startAt=startAt;
  if(finite(endAt))fields.endAt=endAt;
  if(window)Object.assign(fields,{windowStart:startAt,windowEnd:endAt,window:{start:startAt,end:endAt}});
  return {invalid:false,fields,roles,window};
 }
 function oldFields(session){return {...session.lastResult?.fields,...session.lastResult?.next?.fields,...session.lastAction?.fields,...session.lastAction};}
 function reference(raw,s,session,rows,options={}){
   const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),
     prior=options.domain?
       (session.lastAction?.action===options.domain?session.lastAction:session.lastResult?.action===options.domain?session.lastResult.next||session.lastResult:null):
       null,
     fields={...prior?.fields,...prior},
     ids=options.domain==='plan'?[fields.blockId,fields.plannerId,fields.targetId]:options.domain==='reminder'?[fields.reminderId,fields.targetId]:null;
   return Selection.reference(raw,rows,s,session,{
     ...options,
     ...(ids?{priorIds:[...ids,session.lastItemId,session.itemId,fields.itemId,...(options.domain==='reminder'?[prior?.before?.id]:[])]}:{})
   });
 }
 function restoreCandidates(raw,session,blocks){
   const last=session.lastAction,before=last?.before,fields=last?.fields||{};
   if(!/\b(?:undo|restore|put.*back|back where it was)\b/i.test(masked(raw))||
     last?.action!=='plan'||
     last.after!==null||
     !['remove','remove-block'].includes(fields.operation)||
     !before||
     !['string','number'].includes(typeof before.id))
     return blocks;
   const id=String(before.id),
     targets=[fields.blockId,fields.targetId,fields.plannerId].filter(v=>v!==undefined&&v!==null&&v!=='').map(String),
     start=stamp(before.startAt??before.start),
     end=stamp(before.endAt??before.end);
   if(!id||
     ['__proto__','prototype','constructor'].includes(id)||
     !targets.length||
     targets.some(value=>value!==id)||
     !finite(start)||
     !finite(end)||
     end<=start||
     blocks.some(block=>String(block.id)===id))
     return blocks;
   return [...blocks,{...before,kind:'plan-block'}];
 }
function planReference(raw,s,session,blocks,named=[]){
  blocks=restoreCandidates(raw,session,blocks);
  const owned=reference(raw,s,session,blocks,{domain:'plan',implicit:'prior',linked:true,singleton:true}),
    Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),
    linked=blocks.filter(block=>!Selection.sourceExcluded(raw,block,s)&&named.some(row=>String(row.id)===String(block.itemId||block.assignmentId||'')));
  if(named.length>1&&named.every(row=>norm(row.title)===norm(named[0].title)))return null;
  const block=owned.owner==='named'?owned.row:named.length?(linked.length===1?linked[0]:null):owned.row,
    work=block?[...list(s.assignments),...list(s.workItems),...list(s.personalTasks)].filter(row=>String(row.id)===String(block.itemId||block.assignmentId||'')):[];
  const found=new Set(work.map(row=>String(row.courseId||'')+'\0'+norm(row.title||row.name))).size>1?null:block;
  if(found||named.length||!/\b(?:block|slot|session)\b/i.test(raw))return found;
 /* "move spanish block to 8pm": a block named by its course, when that course has exactly one block */
 if(!blocks.some(b=>b.courseId!=null))return null;
 let said;
 try{
   const Language=load('ReserveBiscuitLanguage','./biscuit-language.js'),Registry=load('ReserveBiscuitRegistry','./biscuit-registry.js');
   said=Language?.resolveCourses?.(raw,s,session,Registry?.entries?Registry.entries(s):[]);
 }catch{return null;}
 const chosen=list(said?.matches).find(m=>String(m.id??m.courseId)===String(said?.courseId));
 if(!said?.recognized||
   said.ambiguous||
   !chosen||
   chosen.topic&&!(chosen.nameExact||chosen.abbreviation)||
   !(chosen.nameExact||chosen.abbreviation||chosen.nameMatch>=.5||chosen.subject))
   return null;
 const mine=blocks.filter(b=>b.courseId!=null&&String(b.courseId)===String(said.courseId));
 return mine.length===1?mine[0]:null;
}
 function timing(input){
   return !load('ReserveBiscuitValues','./biscuit-values.js').normalize(input).replace(/\b(?:at|by|for|in|on|around|from|now|later|to|the|and|a|an|half|quarter|past|today|tonight|tomorrow|next|this|morning|afternoon|evening|noon|midnight|am|pm|minutes?|mins?|m|hours?|hrs?|h|seconds?|secs?|s|days?|school|weekday|weekdays|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/g,'').replace(/[\d\s:.,;!?+\-\/]/g,'').trim();
 }
 function reminderTitle(raw,session){
   const named=/\b(?:titled|named|called|with (?:the )?(?:exact )?words)\s*[:,-]?\s*(.+)$/i.exec(raw),cue=/\b(?:remind(?:er)?(?:\s+me)?|ping(?:\s+me)?|nudge(?:\s+me)?|notify(?:\s+me)?|notification|alert|warning|rappel(?:le-moi)?|av[i\u00ed]same|recuerdame)(?![\p{L}\p{N}])(?:\s+(?:please|pls|me))?\s*[:,-]?\s*/iu.exec(raw)||/\u63d0\u9192\u6211[\uff1a:]?\s*/u.exec(raw),chosen=/\bI chose\s+(.+?)\.\s*What time/i.exec(session.query||'');
   let body=named?.[1]??(cue?raw.slice(cue.index+cue[0].length):'');
   body=body.replace(/^\s*(?:to|about)\b\s*/i,'');/* "reminder 45m upload the english homework", "remind me in 20 min to do geo hw": a leading delay is the time, not the title */
   {
     const lead=/^\s*(?:in\s+)?\d+\s*(?:m|min|mins|minutes?|h|hr|hrs|hours?)\b(?!\s+(?:before|after|early|earlier|ahead|prior|later)\b)\s*(?:from\s+now\b\s*)?[,:-]?\s*(?:(?:to|about)\b\s*)?/i.exec(body);
     if(lead&&/[a-z]/i.test(body.slice(lead[0].length)))body=body.slice(lead[0].length);
   }
   const quote=/^\s*(?:"([^"\n]*)"|\u201c([^\u201d\n]*)\u201d)/.exec(body);
   if(quote)return {title:quote[1]??quote[2],literal:true};
   body=body.replace(/\s+(?:using the time zone|which should|so (?:that|i)|because|followed by|after that|before i|when i|i only need)\b.*$/i,'');
   for(const m of body.matchAll(/\bto\s+/gi))if(timing(body.slice(0,m.index))){body=body.slice(m.index+m[0].length);break;}
   for(const m of body.matchAll(/\s+(?=(?:at|for|in|on|by|today|tonight|tomorrow|tmrw|tmr|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\d{1,2}:\d{2}\b)/gi))
     if(timing(body.slice(m.index).replace(/\s+(?:please|pls)\b.*$/i,''))){body=body.slice(0,m.index);break;}
   if(timing(body))body='';
   const previous=session.lastResult?.next?.fields?.title??session.lastResult?.fields?.title??session.lastAction?.fields?.title,
     retained=!cue&&!named&&typeof previous==='string'&&previous.trim()&&previous.length<=200?previous:'';
   return {title:body.replace(/\s+(?:please|pls|porfa)\s*[.!?]*$/i,'').replace(/^[\s:;,]+|[\s;,.!?]+$/g,'').trim()||retained||chosen?.[1]||'',literal:!!named,owned:!!cue||!!named};
 }
 function baseResolve(action,input,s,session={},rows=[],ranked=[],detail={}){
   if(!['focus','focus-control','reminder','plan'].includes(action))return null;
   const raw=String(input);
   if(/^\s*(?:(?:please|pls)\s+)?(?:do not|don.t|dont|never)\b/i.test(masked(raw)))return card('none',[],{},'No change requested.');
   const planText=action==='plan'?mutationScope(raw):raw,
     scope=action==='plan'?
       [...planText.matchAll(/(?:;|\b(?:plus|also)\b)\s*(.+)$/gi)].map(m=>m[1]).find(v=>/\b(?:study|subject|course|class|book|protect|reserve|minutes?|mins?)\b/i.test(v)&&/\b(?:at|from|until|till)\b/i.test(v))||planText:
       ['focus','focus-control'].includes(action)?load('ReserveBiscuitIntent','./biscuit-intent.js')?.requestSpan?.(raw)||raw:raw,
     t=temporal(scope,s,!['focus','focus-control'].includes(action)||/\b(?:until|till|end at)\b/i.test(raw)),
     slots=t.slots,
     owned=reference(action==='plan'?scope:raw,s,session,rows,{actor:action,implicit:'prior'}),
     namedWork=action==='plan'&&owned.owner==='named'&&!owned.row?owned.named.filter(v=>v.kind==='assignment'&&!sourceBlocks(s).some(block=>String(block.id)===String(v.id))):[],
     linkedWork=namedWork.length===1&&
       new Set(rows.filter(v=>v.kind==='assignment'&&String(v.courseId||'')===String(namedWork[0].courseId||'')&&String(v.id)===String(namedWork[0].id))).size===1&&
       owned.named.every(v=>
         v===namedWork[0]||
           String(v.itemId||v.assignmentId||'')===String(namedWork[0].id)||
           !['assignment','course'].includes(v.kind)&&String(v.courseId||'')===String(namedWork[0].courseId||'')&&norm(v.title)===norm(namedWork[0].title))?
       namedWork[0]:
       null,
     current=owned.row||linkedWork,
     n=norm(owned.text),
     exact=owned.named.slice().sort((a,b)=>norm(b.title).length-norm(a.title).length),
     minutes=duration(t),
     lastClock=t.clocks.filter(v=>!rejected(t.text,v.index)).at(-1);
  if(['plan','reminder'].includes(action)&&(lastClock?.invalid||lastClock&&!finite(lastClock.at)&&action==='reminder'))return card('none',[],{},'Choose a valid future clock time.');
  if(['focus','plan'].includes(action)&&finite(minutes)&&(minutes<=0||minutes>1440))return card('none',[],{},'Choose a positive duration up to 1440 minutes.');
  if(action==='focus'){
    const bare=!t.clocks.length&&/^\s*(?:start\s+)?(?:focus|timer)\s+(?:for\s+)?([+\-]?\d+(?:\.\d+)?)\s*[.!?]*$/i.exec(raw),value=minutes??(bare?Number(bare[1]):undefined);
    if(!finite(value))return null;
    if(value<=0||value>1440)return card('none',[],{},'Choose a positive duration up to 1440 minutes.');
    const focusRef=reference(raw,s,session,rows.filter(v=>['assignment','course'].includes(v.kind))),target=focusRef.explicit?focusRef.row:null;
    if(focusRef.explicit&&!target)return card('none',[],{},'Choose one loaded assignment or course for focus.');
    const modeText=exact.reduce((text,v)=>text.replace(norm(v.title),''),norm(masked(load('ReserveBiscuitIntent','./biscuit-intent.js')?.targetText(raw)||raw))),
      breaking=/\b(?:break|rest|breather|descanso)\b/i.test(modeText),
      personal=/\b(?:personal|clean|clear|tidy|organize|organise|stretch|meditate|exercise|walk|laundry|dishes|desk|room)\b/i.test(raw),
      genericWords=new Set(['not','start','begin','set','run','make','give','me','my','a','an','the','for','of','and','to','please','pls','focus','timer','countdown','session','interval','round','minute','minutes','min','mins','m','hour','hours','hr','hrs','h','second','seconds','sec','secs','s','half','quarter','personal','break','rest','breather','descanso']),
      remainingWords=norm(t.text).split(' ').filter(w=>w&&!/^\d+$/.test(w)&&!genericWords.has(w)),
      generic=remainingWords.length===0,
      academic=rows.some(v=>['assignment','course'].includes(v.kind)&&norm([v.title,v.name,v.aliases].filter(Boolean).join(' ')).split(' ').some(w=>w.length>2&&remainingWords.includes(w)));
    if(!target&&(academic||!generic&&!personal&&!breaking))return owned.explicit?card('none',[],{},'Choose one loaded assignment or course for focus.'):null;
    const fields={
      operation:'start',
      mode:breaking?'break':'focus',
      minutes:value,
      cycles:1,
      breakMinutes:0,
      ...(target?(target.kind==='course'?{courseId:target.id}:{itemId:target.id,courseId:target.courseId}):{local:true})
    };
    return card(breaking?'break':'focus',target?[target]:[],fields,(breaking?'Break':target?'Focus on '+target.title:'Focus timer')+': '+value+' min.');
  }
  if(action==='focus-control'){
    if(/\b(?:break|rest|for)\s+[-\u2212]\s*\d/i.test(raw)&&!/\b(?:shorten|subtract|reduce|cut|remove)\b/i.test(raw))return card('none',[],{},'Choose a positive duration.');
    const positive=pattern=>[...t.text.matchAll(new RegExp('\\b(?:'+pattern+')\\b','gi'))].some(m=>!rejected(t.text,m.index));
    let control=detail.action;
    if(positive('set|make|leave|exactly')&&/\b(?:left|remain|restant|quedan|from now)\b/i.test(raw))
      control='set-remaining';
    else if(positive('add|extend|shorten|subtract|reduce|cut'))
      control='adjust';
    else if(/\b(?:status|running or paused|is it running|how much time|time (?:is )?left|timer left)\b/i.test(raw))
      control='status';
    else if(/\b(?:remaining|restant|quedan)\b/i.test(raw))
      control='set-remaining';
    else if(/\b(?:add|extend|extra|shorten|subtract|reduce|cut|more|less)\b|[+\-\u2212]\s*\d/i.test(raw))
      control='adjust';
    else if(/\b(?:break|rest|descanso)\b/i.test(raw))
      control='break';
    else if(/\b(?:pause|park|freeze|pausa)\b/i.test(raw))
      control='pause';
    else if(/\b(?:resume|continue|carry on|unfreeze)\b/i.test(raw))control='resume';else if(/\b(?:stop|end|cancel|finished)\b/i.test(raw))control='stop';
   const f=s.focus||{},
     end=stamp(f.endsAt),
     left=f.running&&!f.paused&&finite(end)?Math.max(0,(end-s.now)/60000):f.remainingMinutes,
     mode=f.mode||session.lastAction?.mode||session.lastAction?.fields?.mode||session.lastResult?.fields?.mode,
     breakMode=mode==='break'?{mode:'break'}:{};
   if(positive('reset|restart'))
     control='reset';
   else if(positive('resume|continue|carry on|unfreeze|unpause'))
     control='resume';
   else if(/\b(?:brb)\b|\u23f8/i.test(raw))
     control='pause';
   else if(/\bquit\b/i.test(raw))control='stop';else if(/\bcountdown\s+to\b/i.test(raw))control='set-remaining';else if(/\bbreather\b/i.test(raw))control='break';
   if(control==='status')
     return card(
       'focus-status',
       [],
       {action:'status',...(finite(left)?{remainingMinutes:left}:{})},
       'Focus timer: '+(f.paused?'paused':f.running?'running':'stopped')+(finite(left??f.minutes)?', '+Math.ceil(left??f.minutes)+' min left.':'.'));
   if(['pause','resume','stop'].includes(control))
     return card(
       'focus-control',
       [],
       {
         action:control,
         ...breakMode,
         ...(control==='pause'&&finite(left)?{preserveRemainingMinutes:left}:{}),
         ...(control==='resume'&&finite(left)?{remainingMinutes:left}:{}),
         ...(control==='stop'?{discardRemaining:true,markAssignmentComplete:false}:{})
       },
       control+' the focus timer.');
   let value=load('ReserveBiscuitValues','./biscuit-values.js')?.fieldQuantity?.(raw.split(/\b(?:rather than|instead of|without)\b/i)[0],'timer')?.minutes??
     minutes??
     (!/\b(?:until|till|end at)\b/i.test(raw)&&slots.numbers?.length===1?slots.numbers[0]:undefined);
   if(value===undefined&&destination(t)&&/\b(?:until|till|end at)\b/i.test(raw)){value=(destination(t).at-s.now)/60000;control='set-remaining';}
   if(finite(value)&&(value===0||Math.abs(value)>1440||value<0&&control!=='adjust'))return card('none',[],{},'Choose a positive duration up to 1440 minutes.');
   if(finite(value)){
     if(control==='break')return card('break',[],{action:'break',mode:'break',minutes:value,explicit:true},'Break: '+value+' min.');
     if(control==='adjust'){
       const change=/\b(?:shorten|less|fewer|cut|reduce|subtract|remove|knock|decrease)\b|[\u2212-]\s*\d/i.test(raw)?-Math.abs(value):value;
       return card('focus-control',[],{action:'adjust',minutes:change,...breakMode,...(finite(left)?{remainingMinutes:Math.max(0,left+change)}:{})},'Change the timer by '+change+' min.');
     }
     if(['setRemaining','set-remaining','reset'].includes(control))
       return card('focus-control',[],{action:control==='reset'?'reset':'set-remaining',minutes:value,...breakMode,...(control==='reset'?{autostart:false}:{})},'Time remaining: '+value+' min.');
   }
   return null;
  }
  if(action==='reminder'){
    const saved=[...list(s.reminders),...list(s.pet?.reminders)].filter(v=>v&&v.id!==undefined),
      target=reference(raw,s,session,saved,{domain:'reminder',implicit:'prior',singleton:true}).row,
      payload=reminderTitle(raw,session),
      clock=destination(t),
      previous=session.lastAction,
      restoring=/\b(?:undo|restore|bring back)\b/i.test(raw);
    if(restoring){
      if(previous?.action!=='reminder'||!previous.before?.id)return card('none',[],{},'Choose the reminder cancellation to undo.');
      const before=previous.before,restore=reference(raw,s,session,[...saved.filter(v=>String(v.id)!==String(before.id)),before],{domain:'reminder',implicit:'prior'}).row;
      if(!restore||String(restore.id)!==String(before.id))return card('none',[],{},'Choose the reminder cancellation to undo.');
      return card('reminder',[],{operation:'undo-cancel',restore:before},'Restore reminder: '+(before.title||before.text)+'.');
    }
   const creating=/\b(?:new|another)\s+(?:reminder|alert)|\b(?:create|schedule|set|make|add)\s+(?:me\s+)?(?:a|an|new)\s+(?:reminder|alert)\b|\b(?:remind|ping|nudge|notify)\s+me\b/i.test(raw),reminderRef=/\b(?:same|that|this|it|reminder|alert)\b/i.test(raw);
   let operation;
   if(target&&!creating){
     if(/\b(?:delete|remove|cancel|retire|dismiss)\b/i.test(masked(raw))&&!restoring)
       operation=/\bdelete\b/i.test(masked(raw))?'delete':'cancel';
     else if((/\b(?:reschedule|move|shift|change|make|same|needs?)\b|\u2192/i.test(masked(raw))&&reminderRef||!payload.title&&session.lastResult?.action==='reminder')&&
       (clock||slots.relative!==undefined||slots.date))
       operation='reschedule';
     else if(/\b(?:rename|retitle|edit|include|append)\b/i.test(masked(raw))&&reminderRef)operation='edit';
   }
   if(operation){
     const fields={operation,targetId:String(target.id),reminderId:String(target.id)};
     if(operation==='reschedule'){
       const old=stamp(target.at),
         day=!slots.date&&finite(old)&&old>s.now?slots.local(old).date:clock?.date||slots.date||t.date,
         at=slots.relative!==undefined?s.now+slots.relative*60000:clock?t.wall(clock.minute,day):slots.date&&finite(old)?t.wall(slots.local(old).minute,slots.date):null;
       if(!finite(at)||at<=s.now)return card('none',[],{},'Choose a valid future reminder time.');
       fields.at=at;
     }
     if(operation==='edit'){
       const addition=/\b(?:include|append|add)\s+(.+?)(?:\s+(?:too|as well)\b|[;.!?]|$)/i.exec(raw);
       if(addition)fields.title=String(target.title||target.text||'').replace(/[.!?]+$/,'')+' and '+addition[1];else if(payload.title)fields.title=payload.title;else return null;
     }
     return card('reminder',[],fields,operation+' reminder: '+(fields.title||target.title||target.text)+'.');
   }
   if(!target&&/\b(?:delete|remove|cancel|retire|dismiss|reschedule|move|shift|rename|retitle|edit|append)\b/i.test(masked(raw))&&!creating)return card('none',[],{},'Choose one saved reminder to change.');
   const safe=rows.filter(v=>!['reminder','grade','feedback','course-grade','course','setting','feature','tab','home-module'].includes(v.kind)),
     ref=reference(raw,s,session,safe),
     deictic=ref.explicit,
     source=deictic?ref.row:null;
   if(deictic&&!source)return card('none',[],{},'Choose one loaded source for the reminder.');
   {/* "remind me 2 hrs before" right after looking at something: before that item's due time or start, the event an announcement
       is about, or the new due date a message gives for a piece of work */
    const lead=(!deictic||source&&String(source.id)===String(session.lastItemId))&&/\bbefore\b/i.test(t.text)&&session.lastItemId!=null&&!payload.literal?
      safe.find(v=>String(v.id)===String(session.lastItemId)):
      null,
      rest=String(payload.title||'').replace(/\b(?:remind(?:er)?|me|about|set|a|an|before|it|its|it's|that|this|is|due|starts?|begins?|the|date|deadline|one|two|three|day|days|hours?|hrs?|h|minutes?|mins?|min|m|\d+[a-z]*)\b/gi,'').trim();
    const leadMinutes=lead&&!rest?(finite(minutes)&&minutes>0?minutes:/\bday\b/i.test(t.text)?1440:/\bhour\b/i.test(t.text)?60:null):null;
    if(leadMinutes){let when=null,named=lead;const begins=stamp(lead.startAt||lead.start||lead.startsAt),due=stamp(lead.dueAt);
     if(finite(begins))
       when=begins;
     else if(finite(due))
       when=due;
     else{
       const text=norm(String(lead.title||'')+' '+String(lead.text||lead.description||'')),
         inside=v=>norm(v.title||'').length>4&&String(v.courseId)===String(lead.courseId)&&text.includes(norm(v.title)),
         event=safe.find(v=>inside(v)&&finite(stamp(v.startAt||v.start||v.startsAt)));
      if(event){named=event;when=stamp(event.startAt||event.start||event.startsAt);}
      else{const work=safe.filter(v=>v.kind==='assignment'&&inside(v)).sort((a,b)=>norm(b.title).length-norm(a.title).length)[0];if(work){named=work;when=stamp(work.dueAt);
       const said=/\b(?:due\s+date|deadline)\b[^.]*?\bis\s+(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s+)?([a-z]{3,})\s+(\d{1,2})(?:\s*(?:at|@)\s*(\d{1,2})[:.](\d{2}))?/i.exec(String(lead.text||lead.description||'')),
         month=said?['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(said[1].toLowerCase().slice(0,3)):-1;
       if(month>=0){
         const year=Number(String(slots.local(s.now).date).slice(0,4));
         for(const y of [year,year+1]){
           const at=t.wall(said[3]!=null?Number(said[3])*60+Number(said[4]):23*60+59,y+'-'+String(month+1).padStart(2,'0')+'-'+String(said[2]).padStart(2,'0'));
           if(finite(at)&&at>s.now){when=at;break;}
         }
       }}}}
     if(finite(when)&&when-leadMinutes*60000>s.now)
       return card(
         'reminder',
         [named],
         {operation:'create',title:named.title||named.name,at:when-leadMinutes*60000,itemId:String(named.id),leadMinutes,...(s.timeZone?{timeZone:s.timeZone}:{})},
         'Reminder: '+(named.title||named.name)+' at '+new Date(when-leadMinutes*60000).toLocaleString('en-US',{timeZone:s.timeZone||'America/New_York'})+'.');}}
   const event=source&&finite(stamp(source.startAt||source.start||source.startsAt))?source:null,before=/\b(?:before|ahead of|antes|warning)\b/i.test(t.text)&&finite(minutes)&&minutes>=0;
   let title=payload.title,at,anchor,timeOnly='';/* a title that is only a time ("remind me 5pm") names nothing to be reminded about; the question repeats the time as typed */
   if(title&&!/[a-z]/i.test(String(title).toLowerCase().replace(/\b(?:\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?|noon|midnight|today|tonight|tomorrow|tmrw|tmr|morning|afternoon|evening|night|at|on|by|around|this|next|(?:mon|tues|wednes|thurs|fri|satur|sun)day|mon|tue|wed|thu|fri|sat|sun)\b/g,' '))){
     timeOnly=String(title).trim();
     title='';
   }
   if(event&&before){anchor=event;at=stamp(event.startAt||event.start||event.startsAt)-minutes*60000;if(!payload.literal)title=event.title||event.name;}
   else if(source&&before&&/\b(?:due|deadline)\b/i.test(raw)&&finite(stamp(source.dueAt))){anchor=source;at=stamp(source.dueAt)-minutes*60000;if(!title)title=source.title;}
   else{
     if(slots.relative!==undefined)at=s.now+slots.relative*60000;else if(clock)at=clock.at;else if(slots.minute!==undefined)at=t.wall(slots.minute);
     if(source&&deictic)anchor=source;
   }
   if(anchor&&(!title||/^(?:(?:about|to)\s+)?(?:this|that|it|same|second one|third one)$/i.test(title)))title=anchor.title||anchor.name;
   if(!title&&!anchor){
     if(!payload.owned||/\b(?:this|that|it|same)\b/i.test(masked(raw)))return null;
     return card('none',[],{},timeOnly?'What should I remind you about ('+timeOnly+')?':'What should I remind you about, and when?');
   }
   if(at===undefined&&slots.date){
     const parsed=load('ReserveBiscuitParse','./biscuit-parse.js')?.localReminder?.(raw,s)?.find(value=>value.intent==='reminder');/* Preserve the existing parser's date-only 09:00 default even for literal quotes. */
     const requested=parsed?.fields?.at??t.wall(9*60,slots.date);
     if(finite(requested)&&requested>s.now)at=requested;
   }
    if(title&&finite(at)&&at>s.now){
      const fields={
        operation:'create',
        title,
        at,
        ...(anchor?{itemId:String(anchor.id)}:{}),
        ...(event&&anchor===event&&before?{eventId:String(event.id),leadMinutes:minutes}:{}),
        ...(slots.relative!==undefined?{minutes:slots.relative}:{}),
        ...(s.timeZone?{timeZone:s.timeZone}:{})
      };
      return card('reminder',anchor?[anchor]:[],fields,'Reminder: '+title+' at '+new Date(at).toLocaleString('en-US',{timeZone:s.timeZone||'America/New_York'})+'.');
    }
    if(slots.relative!==undefined&&slots.relative<=0)return card('none',[],{},'Choose a positive reminder delay.');
    return null;
  }
  if(action==='plan'){
    if(owned.owner==='named'&&!current&&(new Set(exact.map(v=>String(v.id))).size<2||exact.every(v=>norm(v.title)===norm(exact[0].title))))
      return card('none',[],{},'Choose one unambiguous loaded source for the plan.');
    const clock=destination(t),
      moving=/\b(?:move|shift|reschedule|relocate|bump|slide|push|place)\b/i.test(planText)||!!clock&&/\bput\b.*\b(?:at|to)\b|\u2192/i.test(planText),
      blocks=sourceBlocks(s),
      selectedBlock=planReference(raw,s,session,blocks,exact),
      chosen=selectedBlock&&blockState(selectedBlock,session),
      followup=session.lastAction?.action==='plan'&&/\b(?:that|same|it|actually|instead)\b/i.test(planText),
      operation=/\b(?:undo|put.*back|back where it was|restore.*block)\b/i.test(planText)?
        'undo':
        /\b(?:remove|delete|drop|cancel|erase|scratch|unslot|take.*off)\b/i.test(planText)?
          'remove':
          /\b(?:replan|rebuild|redo|recalculate)\b|\b(?:generated|automatic|automatique|automatico|autom[a\u00e1]tico)\b.*\b(?:past|passed|missed|pas[o\u00f3])\b/i.test(planText)?
            'replan':
            moving||followup&&!!clock?
              'move':
              /\b(?:resize|longer|shorter|shorten|lengthen|same start)\b|\b(?:make|set|change|adjust|reduce|cut)\b.*\b(?:length|duration|minutes?|mins?)\b/i.test(planText)||chosen&&finite(minutes)&&(/\bblock\b/i.test(planText)||followup)?
                'resize':
                load('ReserveBiscuitIntent','./biscuit-intent.js')?.scheduleRequest?.(scope)||planAllocation(scope).allocations.length?undefined:detail.operation?.replace(/-block$/,'');
   if(operation==='replan'&&owned.explicit&&!chosen)return card('none',[],{},'Choose one loaded study block to replan.');
   if(operation==='replan'){
     const preserveManualIds=blocks.filter(v=>v.manual||v.manualEdited||v.generated===false).map(v=>String(v.id)),
       fields={
         operation:'replan',
         local:true,
         preserveManualIds,
         reason:'availability changed',
         ...(chosen&&!preserveManualIds.includes(String(chosen.id))?{blockId:String(chosen.id),targetId:String(chosen.id)}:{})
       },
       clocks=t.clocks.filter(v=>!v.invalid&&finite(v.at)&&!rejected(t.text,v.index)),
       block=rows.find(v=>v.id===String(fields.blockId||''));
     if(clocks.length>=2&&clocks[1].at>clocks[0].at){
       fields.window={start:clocks[0].at,end:clocks[1].at};
       fields.excludeIntervals=[];
       for(let i=2;i+1<clocks.length;i+=2){
         if(clocks[i+1].at<=clocks[i].at||clocks[i].at<fields.window.start||clocks[i+1].at>fields.window.end)return card('none',[],{},'Keep the excluded interval inside the replan window.');
         fields.excludeIntervals.push({startAt:clocks[i].at,endAt:clocks[i+1].at});
       }
     }
     return card('plan',block?[block]:[],fields,'Replan generated study blocks using saved availability.');
   }
   if(!chosen&&(['undo','remove','resize'].includes(operation)||operation==='move'&&/\b(?:block|slot)\b/i.test(planText)))return card('none',[],{},'Choose one loaded study block to change.');
   if(chosen&&['undo','remove','resize','move'].includes(operation)){
     const fields={
       operation:detail.operation===operation+'-block'?detail.operation:operation,
       blockId:String(chosen.id),
       plannerId:String(chosen.id),
       targetId:String(chosen.id),
       local:true,
       preserveAssignmentDeadline:true,
       preserveCanvasDeadline:true,
       ...(operation==='remove'?{preserveAssignment:true}:{})
     },
       linked=rows.find(v=>v.kind==='assignment'&&v.id===String(chosen.itemId||chosen.assignmentId||'')),
       refId=String(current?.id||session.lastItemId||s.selectedItemId||oldFields(session).itemId||''),
       block=rows.find(v=>v.id===String(chosen.id)),
       ref=rows.find(v=>v.id===refId&&(v.id===String(chosen.id)||v===linked)),
       items=[block||ref||linked,...(linked&&block&&linked!==block?[linked]:[])].filter(Boolean);
    if(operation==='undo'){
      const b=session.lastAction?.before;
      if(!b||String(b.id||chosen.id)!==String(chosen.id))return card('none',[],{},'Choose the study-block change to undo.');
      fields.restoreStartAt=b.startAt??b.start;
      fields.restoreEndAt=b.endAt??b.end;
      if(fields.restoreEndAt===undefined&&finite(stamp(fields.restoreStartAt))&&finite(b.minutes))fields.restoreEndAt=stamp(fields.restoreStartAt)+b.minutes*60000;
    }
    else if(operation==='move'||operation==='resize'){
      const start=stamp(chosen.startAt??chosen.start),
        end=stamp(chosen.endAt??chosen.end),
        oldMinutes=chosen.minutes??(finite(start)&&finite(end)?(end-start)/60000:undefined),
        relativeMove=operation==='move'&&finite(minutes)&&/\b(?:later|earlier|forward|back(?:ward)?|ahead|delay)\b/i.test(planText)&&!clock,
        relativeSize=operation==='resize'&&finite(minutes)&&(/\b(?:by|longer|shorter)\b/i.test(planText)&&/\b(?:shorten|lengthen|extend|reduce|cut|add|longer|shorter)\b/i.test(planText)),
        change=/\b(?:earlier|back(?:ward)?|shorten|shorter|reduce|cut)\b/i.test(planText)?-Math.abs(minutes):Math.abs(minutes),
        length=relativeSize?oldMinutes+change:relativeMove?oldMinutes:minutes??oldMinutes;
     if(!finite(length)||length<=0||length>1440)return card('none',[],{},'Choose a positive study-block duration.');fields.minutes=length;
     if(operation==='move'){
       let destinationAt;
       if(relativeMove&&finite(start))
         destinationAt=start+change*60000;
       else if(clock){const day=!slots.date&&finite(start)?slots.local(start).date:clock.date;destinationAt=t.wall(clock.minute,day);}
       else if(slots.date&&finite(start))
         destinationAt=t.wall(slots.local(start).minute,slots.date);
       else if(finite(slots.relative))destinationAt=s.now+slots.relative*60000;else return null;
       if(!finite(destinationAt)||destinationAt<s.now)return card('none',[],{},'Choose a valid future study-block time.');
       fields.startAt=destinationAt;
       fields.start=destinationAt;
     }
     else if(finite(start))fields.startAt=start;
     if(finite(fields.startAt))fields.endAt=fields.startAt+length*60000;
     fields.preserveNotes=true;
    }return card('plan',items,fields,operation+' study block: '+(chosen.title||chosen.name||linked?.title||'selected block')+'.');}
   const assignments=rows.filter(v=>v.kind==='assignment'&&!blocks.some(b=>String(b.id)===v.id)&&!load('ReserveBiscuitSelection','./biscuit-selection.js').sourceExcluded(raw,v,s)),
     anchor=rows.find(v=>v.id===String(current?.id||'')),
     linked=anchor?
       (assignments.find(v=>v.id===String(anchor.assignmentId||anchor.itemId||''))||
         (anchor.kind==='assignment'?anchor:null)||
         assignments.filter(v=>v.courseId===anchor.courseId&&norm(v.title).length>2&&norm(anchor.title).includes(norm(v.title))).sort((a,b)=>
           b.title.length-a.title.length)[0]):
       null,
     items=exact.filter(v=>assignments.includes(v)),
     unique=items.filter((v,i)=>items.findIndex(x=>x.id===v.id)===i),
     unfinished=assignments.filter(v=>!v.done&&!v.completed&&!list(s.courses).some(c=>String(c.id)===String(v.courseId)&&(c.archived||c.active===false)));
   if(/\b(?:choose|pick)\b.*\b(?:one|between|task|first)\b|\bwhich\b.*\b(?:first|start|fits?)\b|\bthis\s+vs\b/i.test(raw)){
     const budget=finite(minutes)&&minutes>0?minutes:undefined,
       pool=unfinished.filter(v=>!budget||!finite(Number(v.minutes??v.estimate))||Number(v.minutes??v.estimate)<=budget).sort((a,b)=>
         (finite(stamp(a.dueAt))?stamp(a.dueAt):Infinity)-(finite(stamp(b.dueAt))?stamp(b.dueAt):Infinity)||
           (Number(a.minutes||a.estimate)||Infinity)-(Number(b.minutes||b.estimate)||Infinity)),
       selected=pool[0],
       other=pool.find(v=>v.id!==linked?.id),
       candidates=unique.length>1?unique:linked&&other?[linked,other]:pool;
     if(selected)
       return card(
         'plan',
         [selected,...candidates.filter(v=>v.id!==selected.id)],
         {local:true,itemId:selected.id,selectedItemId:selected.id,candidateIds:candidates.map(v=>v.id),prioritize:'earliest deadline then fit',...(budget?{availableMinutes:budget}:{})},
         'Start with '+selected.title+'.');
   }
   const deictic=owned.explicit||/\b(?:subject|course|class|existing|block)\b/i.test(raw);
   if(!unique.length&&linked&&deictic)unique.push(linked);
   const anchorCourse=anchor?.kind==='course'?anchor.id:anchor?.courseId;
   if(!unique.length&&deictic&&anchorCourse){const same=unfinished.filter(v=>v.courseId===anchorCourse);if(same.length===1)unique.push(same[0]);}
   if(!unique.length){
     const words=new Set(n.split(' ')),
       stop=new Set(['the','a','an','and','of','for','to','my','this','that','study','work','assignment','task','project','block','minutes','minute']),
       matches=unfinished.map(v=>{
       const title=norm(v.title).split(' ').filter(w=>!stop.has(w)),hits=title.filter(w=>words.has(w)).length;
       return {row:v,hits,ratio:hits/Math.max(1,title.length)};
     }).filter(v=>v.hits>=2&&v.ratio>=.5).sort((a,b)=>b.ratio-a.ratio||b.hits-a.hits);
     if(matches.length===1||matches[0]&&matches[0].ratio>matches[1]?.ratio)unique.push(matches[0].row);
   }
   if(unique.length>1&&unique.every(v=>norm(v.title)===norm(unique[0].title)))return card('none',[],{},'Choose one loaded assignment for the plan.');
   unique.sort((a,b)=>stamp(a.dueAt)-stamp(b.dueAt)||n.indexOf(norm(a.title))-n.indexOf(norm(b.title)));
   if(owned.explicit&&!current&&!exact.length&&!unique.length)return card('none',[],{},'Choose one loaded source for the plan.');
   const clocks=t.clocks.filter(v=>!v.invalid&&!rejected(t.text,v.index)),
     pair=!moving?
       clocks.slice(0,-1).map((v,i)=>[v,clocks[i+1]]).find(([a,b])=>/^\s*(?:to|until|till|through|and|[-\u2192])\s*$/.test(t.text.slice(a.end,b.index).replace(/\b(?:today|tonight|tomorrow)\b/g,''))):
       null,
     itemIds=unique.map(v=>v.id),
     fields={local:true,line:raw,...(itemIds.length?{itemId:itemIds[0],itemIds}:{}),...(finite(minutes)?{minutes}:{}),...(slots.date?{date:slots.date}:{})};
   if(pair&&finite(pair[0].at)){
     const [first,second]=pair,end=finite(second.at)&&second.at>first.at?second.at:t.wall(second.minute,nextDay(first.date),first.at);
     if(!finite(end)||end<=first.at)return card('none',[],{},'Choose a valid planning window.');
     Object.assign(fields,{
       operation:unique.length===1&&finite(minutes)?'schedule-study':'build-plan',
       startAt:first.at,
       endAt:end,
       window:{start:first.at,end},
       windowStart:first.at,
       windowEnd:end,
       preserveAssignmentDeadline:true,
       preserveCanvasDeadline:true,
       respectExistingCommitments:true
     });
     const rest=clocks.slice(clocks.indexOf(second)+1);
     for(let i=0;i+1<rest.length;i+=2)
       if(finite(rest[i].at)&&finite(rest[i+1].at)&&rest[i+1].at>rest[i].at)(fields.excludeIntervals||=[]).push({startAt:rest[i].at,endAt:rest[i+1].at});
     for(const event of [...list(s.events),...list(s.calendarEvents)]){
       const startAt=stamp(event.startAt||event.start||event.startsAt),endAt=stamp(event.endAt||event.end||event.endsAt);
       if(finite(startAt)&&
         finite(endAt)&&
         startAt<end&&
         endAt>first.at&&
         !(fields.excludeIntervals||[]).some(v=>v.startAt===startAt&&v.endAt===endAt))(fields.excludeIntervals||=[]).push({eventId:String(event.id),startAt,endAt});
     }
     return card('plan',unique,fields,'Plan: '+(unique.length?unique.map(v=>v.title).join(', '):'personal study window')+'.');
   }
   if(unique.length||finite(minutes)){
     if(clock){
       Object.assign(fields,{
         startAt:clock.at,
         start:clock.at,
         date:clock.date,
         preserveAssignmentDeadline:true,
         preserveCanvasDeadline:true,
         respectExistingCommitments:true
       });
       if(finite(minutes))fields.endAt=clock.at+minutes*60000;
       if(unique.length===1)fields.operation='schedule-study';
     }
     return card('plan',unique,fields,'Plan: '+(unique.length?unique.map(v=>v.title).join(', '):'personal time')+(finite(minutes)?' for '+minutes+' min':'')+'.');
   }
   return null;
  }return null;
 }
 function resolve(action,input,s,session={},rows=[],ranked=[],detail={}){
   const result=baseResolve(action,input,s,session,rows,ranked,detail);
   if(action!=='plan'||result?.action!=='plan'||['move','resize','remove','replan','move-block','resize-block','remove-block','undo'].includes(result.next.fields.operation))return result;
   const allocation=planAllocation(input);
   if(!allocation.allocations.length)return result;
   const V=load('ReserveBiscuitValues','./biscuit-values.js'),scope=allocation.scope,bridge=planSlots(V.slots(masked(scope),s),s,scope);
   if(bridge.invalid)return result;
   const fields=result.next.fields;
   Object.assign(fields,bridge.fields,{line:scope});
   if(bridge.fields.minutes===undefined)delete fields.minutes;
   const selected=reference(scope,s,session,rows).row;
   if(selected?.kind==='course'&&!fields.itemId&&/\b(?:this|that|selected|same|current|earlier|previous)\s+(?:selected\s+)?(?:course|class|subject)\b/i.test(scope)){
     fields.courseId=selected.id;
     result.items=[selected];
   }
   return result;
 }
 function allocationRows(values,s){
   const Registry=load('ReserveBiscuitRegistry','./biscuit-registry.js');
   return values.map(value=>Registry.normalize({...value,title:value.title||value.name,kind:'assignment'},s)).filter(Boolean);
 }
function availabilityQuantity(text,V){
  const q=V.quantities(text)[0];
  if(!q)return null;
  const prefix=text.slice(0,q.index).trim(),tail=text.slice(q.end).trim();
  if(!/^(?:(?:actually|instead|now|only|just)[, ]+)*(?:(?:i|we)\s+(?:(?:only|just|now)\s+)*(?:have(?:\s+got)?|can\s+spare)(?:\s+(?:only|just|now))*|(?:i\s+am|i['\u2019]m|we\s+are|we['\u2019]re)\s+(?:free|available)(?:\s+for)?)$/i.test(prefix)||/^of\b/i.test(tail))return null;
  return q;
}
 function ownedAllocation(input,s={},session={}){
  const sources=[...list(s.assignments),...list(s.workItems),...list(s.personalTasks)],
    allocationVerb=/\b(?:plan|fit|schedule|allocate|organize|organise|organiza|organizar|planifica|planificar)\b/i.test(String(input)),
    owned=reference(input,s,session,sources,{implicit:'prior'}),
    prior=session.lastPlan||(session.lastAction?.action==='plan'&&session.lastAction.fields?.window?session.lastAction.fields:null),
    anchor=String(owned.row?.id||'');
  if(owned.explicit&&!owned.row&&!owned.named.length)return null;
  if(!prior&&(s.view!=='planner'&&!allocationVerb||!owned.named.length&&!sources.some(v=>String(v.id)===anchor)))return null;
  const raw=String(input),
    V=load('ReserveBiscuitValues','./biscuit-values.js'),
    text=V.normalize(masked(raw)),
    Intent=load('ReserveBiscuitIntent','./biscuit-intent.js'),
    goal=Intent?.requestGoal?.(text)||text;
  if(Intent?.literalNoteRequest?.(raw)||/^(?:what|which|when|where|who|how|if|unless|suppose|is|are|was|were|do|does|did|can|could|would|should|may|might|will|has|have|remind|warn|ping|focus|concentrate|don.t|dont|never)\b/i.test(goal)||/\b(?:why|explain|hypothetical)\b/i.test(goal))return null;
  const items=[
    ...new Map([...list(s.assignments),...list(s.workItems),...list(s.personalTasks)].filter(v=>v&&v.id&&!['__proto__','prototype','constructor'].includes(String(v.id))).map(v=>
      [String(v.id),v])).values()
  ],
    byId=new Map(items.map(v=>[String(v.id),v])),
    previous=session.lastPlan||(session.lastAction?.action==='plan'&&session.lastAction.fields?.window?session.lastAction.fields:null),
    valid=previous&&
      finite(previous.window?.start)&&
      finite(previous.window?.end)&&
      previous.window.end>previous.window.start&&
      Array.isArray(previous.itemIds)&&
      previous.itemIds.length&&
      previous.itemIds.every(id=>byId.has(String(id))),
    t=temporal(text,s),
    clocks=t.clocks.filter(v=>!v.invalid&&finite(v.at)&&!rejected(t.text,v.index));
  const availability=availabilityQuantity(text,V);
  if(availability){
    const scope=planAllocation(raw).scope,bridge=planSlots(V.slots(masked(scope),s),s,scope),minutes=availability.minutes;
    if(!finite(minutes)||minutes<=0||minutes>1440||bridge.invalid||bridge.fields.minutes!==undefined&&bridge.fields.minutes!==minutes)
      return card('none',[],{},'Choose one valid availability budget and its start or end constraints.');
    const target=owned.explicit&&owned.row&&byId.get(String(owned.row.id)),
      fields={
        local:true,
        operation:'replan',
        line:scope,
        minutes,
        ...(bridge.fields.date?{date:bridge.fields.date}:{}),
        ...(target?{itemId:String(target.id),itemIds:[String(target.id)],...(target.courseId?{courseId:String(target.courseId)}:{})}:{}),
        preserveAssignmentDeadline:true,
        preserveCanvasDeadline:true,
        respectExistingCommitments:true
      };
    return card('plan',target?allocationRows([target],s):[],fields,'Replan the current availability budget; keep the saved work estimates.');
  }
  if(valid){
    const fields={
      local:true,
      operation:'build-plan',
      window:{...previous.window},
      startAt:previous.window.start,
      endAt:previous.window.end,
      windowStart:previous.window.start,
      windowEnd:previous.window.end,
      preserveCanvasDeadline:true,
      respectExistingCommitments:true,
      itemIds:[...previous.itemIds],
      excludeIntervals:list(previous.excludeIntervals).map(v=>({...v})),
      preserveAssignmentDeadline:true
    },
      breakChange=/\b(?:dinner|lunch|meal|break|free part|free time|gap|exclude|cena|diner|pause|libre)\b|\u665a\u996d|\u665a\u9910|\u4f11\u606f/i.test(text)&&clocks.length,
      change=text.split(/\b(?:keep|retain|preserve|without|leave|sans|sin|conserva|mantener)\b|\u4ecd\u7136|\u4fdd\u6301/i)[0],
      estimateQuantity=V.fieldQuantity?.(change,'duration'),
      estimateRequest=!!estimateQuantity||!/^(?:i|we)\b/i.test(change.trim())&&/\b(?:takes?|needs?|requires?|lasts?)\b/i.test(change),
      duration=estimateQuantity?.minutes??V.quantities(change).at(-1)?.minutes;
   if(breakChange){
     if(fields.excludeIntervals.length!==1)return null;
     const last=clocks.at(-1),date=t.slots.local(fields.window.start).date,end=t.slots.wall(date,last.minute,t.slots.local,s.now),interval=fields.excludeIntervals[0];
     if(!finite(end)||!finite(interval.startAt)||end<=interval.startAt||interval.startAt<fields.window.start||end>fields.window.end)
       return card('none',[],{},'Keep the excluded interval inside the saved planning window.');
     interval.endAt=end;
   }
   else if(estimateRequest&&finite(duration)&&duration>0&&duration<=1440&&!/\b(?:reminder|focus|timer|deadline|due)\b/i.test(change)){
     const q=new Set(norm(change).split(' ').filter(v=>v.length>3&&!/^(?:minutes|estimate|needs|takes|length|duration|working|change|revise|only)$/.test(v))),ranked=fields.itemIds.map(id=>{
       const row=byId.get(String(id));
       return {row,score:norm(row.title||row.name).split(' ').filter(v=>q.has(v)).length};
     }).sort((a,b)=>b.score-a.score),
     last=owned.row&&byId.get(String(owned.row.id)),
     target=owned.explicit?
       (last&&fields.itemIds.includes(String(last.id))?last:null):
       ranked[0]?.score>0&&ranked[0].score>(ranked[1]?.score||0)?ranked[0].row:last&&fields.itemIds.includes(String(last.id))?last:null;
     if(!target)return null;
     fields.minutes=duration;
     fields.estimateItemId=String(target.id);
     fields.estimates=Object.fromEntries([[String(target.id),duration]]);
   }
   else return null;return card('plan',allocationRows(fields.itemIds.map(id=>byId.get(String(id))),s),fields,'Update the saved local planning window and keep its selected work.');
  }
  if(clocks.length<2||clocks[1].at<=clocks[0].at||!(allocationVerb||s.view==='planner'))return null;
  const names=[...new Map(owned.named.map(row=>[String(row.id),row])).values()],explicit=names.map(row=>reference(row.title||row.name,s,{},sources).row);
  if(names.length&&explicit.some(row=>!row))return null;
  const fullyNamed=explicit.filter(Boolean),remembered=owned.row&&byId.get(String(owned.row.id))||fullyNamed[0];
  if(!remembered)return null;
  const course=String(remembered.courseId||session.lastCourseId||''),
    q=new Set(norm(owned.text).split(' ')),
    candidates=items.filter(v=>String(v.courseId||'')===course&&!v.done&&!v.completed&&!load('ReserveBiscuitSelection','./biscuit-selection.js').sourceExcluded(raw,v,s)).map(v=>
      ({row:v,hits:norm(v.title||v.name).split(' ').filter(w=>w.length>3&&q.has(w)).length})),
    named=candidates.filter(v=>v.hits>0).sort((a,b)=>{
    const position=v=>Math.min(...norm(v.row.title||v.row.name).split(' ').filter(w=>w.length>3&&q.has(w)).map(w=>norm(text).indexOf(w)));
    return position(a)-position(b);
  }).map(v=>v.row),selected=fullyNamed.length>1?fullyNamed:named.length?named:[remembered];
  if(!selected.some(v=>String(v.id)===String(remembered.id))&&/\b(?:this|that|its|same|both)\b/i.test(text))selected.unshift(remembered);
  const window={start:clocks[0].at,end:clocks[1].at},excludeIntervals=[];
  for(let i=2;i+1<clocks.length;i+=2){
    const startAt=clocks[i].at,endAt=clocks[i+1].at;
    if(endAt<=startAt||startAt<window.start||endAt>window.end)return null;
    excludeIntervals.push({startAt,endAt});
  }
  return card(
    'plan',
    allocationRows(selected,s),
    {
      local:true,
      operation:'build-plan',
      window,
      startAt:window.start,
      endAt:window.end,
      windowStart:window.start,
      windowEnd:window.end,
      excludeIntervals,
      itemIds:selected.map(v=>String(v.id)),
      preserveAssignmentDeadline:true,
      preserveCanvasDeadline:true,
      respectExistingCommitments:true
    },
    'Plan the selected work in the requested local window.');
 }
 function ownedPlan(input,s={},session={}){
  const prior=session.lastAction,
    fields=prior?.fields||{},
    operation=fields.operation||prior?.operation,
    targets=[fields.blockId,fields.plannerId,fields.targetId,prior?.blockId,prior?.targetId].filter(value=>value!==undefined&&value!==null&&value!==''),
    receiptId=String(prior?.before?.id||''),
    typedUndo=prior?.action==='plan'&&
      ['move','resize','remove','move-block','resize-block','remove-block'].includes(operation)&&
      receiptId&&
      (targets.length?targets:[session.lastItemId||session.itemId]).every(value=>String(value||'')===receiptId);
  if(/^(?:undo|revert)(?:\s+(?:that|it|(?:(?:that|the|my)\s+)?(?:last|previous)(?:\s+(?:change|action|edit|setting))?))?[.!?]*$|^(?:take|roll)\s+(?:that|it)\s+back[.!?]*$/i.test(String(input).trim())&&!typedUndo)return null;
  const blocks=sourceBlocks(s),
    named=reference(input,s,session,[...list(s.assignments),...list(s.workItems),...list(s.personalTasks)]).named,
    block=planReference(input,s,session,blocks,named);
  if(!block)return null;
  const raw=String(input),
    V=load('ReserveBiscuitValues','./biscuit-values.js'),
    Intent=load('ReserveBiscuitIntent','./biscuit-intent.js'),
    text=V.normalize(masked(raw)),
    goal=Intent?.requestGoal?.(text)||text;
  if(/^(?:if|unless|suppose|what|which|when|where|who|how|is|does|can i|could i|should i)\b/i.test(goal)||/\b(?:why|explain|reasoning|teach|hypothetical)\b/i.test(goal)||/\b(?:do not|don.t|dont|never|not to)\s+(?:move|shift|reschedule|change|resize|shorten|extend|remove|delete|drop|put)\b/i.test(goal))return null;
  const reminder=/\b(?:remind(?:er)?|warn(?:ing)?|alert|ping|rappel|aviso)\b|提醒/i.exec(text),
    focus=/\b(?:focus|concentration|concentrate)\b|专注/i.exec(text),
    quantities=V.quantities(text),
    near=m=>m?(V.fieldQuantity?.(text,m===reminder?'reminder':'focus')||null):null,
    clock=temporal(text,s),
    hasClock=clock.clocks.some(v=>!v.invalid&&finite(v.at)),
    fieldRequest=/\b(?:block|slot|length|duration|start|working|unslot|comienzo|bloque|bloc|creneau|commencement|debut|duree)\b|学习块|开始|长度/i.test(text)||session.lastAction?.action==='plan';
  if(!fieldRequest||!hasClock&&!quantities.length&&!V.fieldQuantity?.(text,'duration')&&!/\b(?:undo|remove|delete|drop|unslot|scratch|take.*off)\b/i.test(text))return null;
  if(reminder||focus){
    const prefix=text.slice(0,Math.min(...[reminder?.index,focus?.index,text.length].filter(v=>typeof v==='number'))),
      prefixClock=temporal(prefix,s).clocks.some(v=>!v.invalid&&finite(v.at));
    if(!prefixClock&&!/\b(?:move|shift|reschedule|relocate|resize|length|duration|shorten|extend|longer|shorter)\b/i.test(prefix))return null;
  }
  const linked=[...list(s.assignments),...list(s.workItems),...list(s.personalTasks)].find(v=>String(v.id)===String(block.itemId||block.assignmentId||'')),
    Registry=load('ReserveBiscuitRegistry','./biscuit-registry.js'),
    rows=[Registry?.normalize?.(block,s)||block,linked&&(Registry?.normalize?.(linked,s)||linked)].filter(Boolean),
    headEnd=Math.min(...[reminder?.index,focus?.index,reminder&&near(reminder)?.index,focus&&near(focus)?.index,text.length].filter(v=>typeof v==='number')),
    head=text.slice(0,headEnd).replace(/[,;\s]+$/,''),
    detail={operation:/\b(?:unslot|remove|delete|drop|scratch|take.*off)\b/i.test(head)?'remove':/\bundo\b/i.test(head)?'undo':hasClock?'move':'resize'},
    plan=baseResolve('plan',reminder||focus?head:text,s,session,rows,[],detail);
  if(!plan||plan.action!=='plan')return plan;if(!reminder&&!focus)return plan;
  const before=reminder&&near(reminder),
    duration=focus&&near(focus),
    compact=focus&&/\bfocus\s*(?:(?:for|de)\s*)?(\d+(?:\.\d+)?)\b|\b(?:start|begin|run)\s*(\d+(?:\.\d+)?)\s*focus\b/i.exec(text),
    focusMinutes=compact?Number(compact[1]||compact[2]):duration?.minutes,
    offset=before?.minutes,
    start=plan.next.fields.startAt;
  if(!linked||!finite(start)||reminder&&(!finite(offset)||offset<=0)||focus&&(!finite(focusMinutes)||focusMinutes<=0||focusMinutes>1440))
    return card('none',[],{},'Give each requested reminder or focus its own positive duration.');
  const following=[];
  if(reminder){
    const at=start-offset*60000;
    if(at<s.now)return card('none',[],{},'Choose a reminder time after now.');
    following.push({
      index:reminder.index,
      value:card('reminder',[],{operation:'create',title:'Start '+(linked.title||linked.name||block.title||'the planned task'),at},'Remind you '+offset+' min before '+(linked.title||linked.name)+'.')
    });
  }
  if(focus)
    following.push({
      index:focus.index,
      value:card('focus',[rows[1]],{itemId:String(linked.id),courseId:String(linked.courseId||''),minutes:focusMinutes,cycles:1,breakMinutes:0},'Focus for '+focusMinutes+' min.')
    });
  const requests=[plan,...following.sort((a,b)=>a.index-b.index).map(v=>v.value)];
  return {
    ...plan,
    requests,
    message:requests.map(v=>v.message).join(' '),
    next:{...plan.next,action:'batch',fields:{...plan.next.fields,steps:requests.map(v=>({...v.next,message:v.message}))},label:'Review steps'}
  };
 }
 const api={resolve,temporal,planAllocation,planSlots,ownedPlan,ownedAllocation};
 root.ReserveBiscuitDetails=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
