/* Shared sparse features for offline training and on-demand local inference. */
(function(root){
 'use strict';
 const words=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[\u2018\u2019]/g,"'").match(/[\p{L}\p{N}]+/gu)||[],
   stop=new Set('a an the my me i you your our is are was were be been of to for in on at by from with about and or as it that this these those please can could would will do does did have has get got some any just really need want'.split(' ')),
   numericWords=value=>{
   const raw=words(value),numbers=root.ReserveBiscuitValues?.numbers||(typeof module==='object'&&module.exports?require('./biscuit-values.js').numbers:{}),out=[];
   for(let i=0;i<raw.length;i++){
     const n=numbers[raw[i]],next=numbers[raw[i+1]];
     if(n!==undefined){if(n>=20&&n%10===0&&next>0&&next<10){out.push(String(n+next));i++;}else out.push(String(n));}else out.push(raw[i]);
   }
   return out;
 },content=value=>numericWords(value).filter(w=>!stop.has(w)),clip=n=>Math.min(1,Math.max(0,n)),id=v=>String(v??'');
 const optional=(name,file)=>{
   if(root[name])return root[name];
   if(typeof module!=='object'||!module.exports)return null;
   try{return require(file);}catch(error){if(error.code==='MODULE_NOT_FOUND'&&error.message.includes("'"+file+"'"))return null;throw error;}
 },language=()=>optional('ReserveBiscuitLanguage','./biscuit-language.js'),semantics=()=>optional('ReserveBiscuitSemantics','./biscuit-semantics.js');
 /* Internal request ownership is separate from the public stable-feature traversal flag. */
 const OWN=Symbol('biscuit-owned-request'),contexts=new WeakMap(),rankViews=new WeakMap();
 const sameRows=(saved,rows)=>saved.length===rows.length&&saved.every((row,i)=>row===rows[i]);
 const previousState=value=>Array.isArray(value)?value.map(row=>[row?.id,row?.itemId]):value;
 const environment=(s,session)=>
   JSON.stringify([
     s.now,
     s.selectedItemId,
     s.itemId,
     s.page?.itemId,
     s.activeCourseId,
     s.currentCourseId,
     s.courseId,
     s.page?.courseId,
     s.showGrades,
     s.teacherFeedback,
     s.settings?.showGrades,
     s.settings?.teacherFeedback,
     s.privacy?.grades,
     s.privacy?.feedback,
     s.privacy?.teacherFeedback,
     session.itemId,
     session.lastItemId,
     session.lastCourseId,
     session.courseId,
     session.lastAction?.fields?.courseId,
     session.lastResult?.next?.fields?.itemId,
     session.lastResult?.next?.fields?.courseId,
     session.lastResult?.items?.[0]?.id,
     session.lastResult?.items?.[0]?.courseId,
     previousState(session.items||session.lastItems||session.lastResult?.items||[])
   ]);
 function contextState(c){
   try{
     const p=c.language;
     return JSON.stringify([
       c.q,
       c.query,
       [...c.weights],
       c.total,
       c.page,
       c.last,
       c.course,
       c.named,
       c.positive,
       c.kindCues,
       c.kindStyle,
       c.text,
       c.deictic,
       c.ordinal,
       c.action,
       previousState(c.previous||[]),
       p?[p.input,p.unknownSingle,p.recognized,p.ambiguous,p.preferredCourseId,[...p.byCourse],[...p.rowEvidence]]:null
     ]);
   }catch{return null;}
 }
 function recordStamp(row){
   try{return Object.entries(row).filter(([key])=>key!=='rankScore').map(([key,value])=>[key,value,value&&typeof value==='object'?JSON.stringify(value):null]);}catch{return null;}
 }
 function recordMatches(row,stamp){
   if(!stamp)return false;
   try{
     const entries=Object.entries(row).filter(([key])=>key!=='rankScore');
     return entries.length===stamp.length&&
       entries.every(([key,value],i)=>key===stamp[i][0]&&value===stamp[i][1]&&(!value||typeof value!=='object'||JSON.stringify(value)===stamp[i][2]));
   }catch{return false;}
 }
 function rowKey(row){return JSON.stringify([String(row.kind),String(row.courseId??''),String(row.id)]);}
 function lexicalRecord(row,records){
  let result=records.get(row);
  if(result)return result;
  const key=String(row.kind)+':'+String(row.courseId)+':'+String(row.id),
    signature=[row.title,row.text||row.description||row.instructions,row.aliases,row.teacher||row.teacherName,row.course||row.courseName],
    previous=textCache.get(key);
  if(signature.every(value=>value===null||typeof value!=='object'&&typeof value!=='function')&&previous&&signature.every((value,i)=>value===previous.signature[i]))
    result={...previous.out,titleTokens:previous.out.titleTokens||content(signature[0])};
  else{
    const titleTokens=content(signature[0]);
    result={
      title:new Set(titleTokens),
      body:new Set(content(signature[1])),
      aliases:new Set(content(signature[2])),
      teacher:new Set(content(signature[3])),
      course:new Set(content(signature[4])),
      phrase:numericWords(signature[0]).join(' '),
      titleTokens
    };
    result.titleList=[...result.title];
  }
  if(textCache.size>=512&&!textCache.has(key))textCache.delete(textCache.keys().next().value);
  textCache.set(key,{signature,out:result});
  records.set(row,result);
  return result;
 }
 function prepareContext(input,s={},session={},rows=[]){return context(input,s,session,rows,OWN);}
 function queryKeys(c,kind,owned){
   let keys=owned.queryKeys.get(kind);
   if(!keys){
     keys={
       kinds:(c.kindCues||[]).map(cue=>['kindNoun:'+cue+'|'+kind,'kindNoun:'+cue+'|'+c.kindStyle+'|'+kind]),
       bigrams:c.query.slice(1).map((word,i)=>'qb:'+c.query[i]+' '+word+'|'+kind),
       words:c.q.map(word=>['q:'+word+'|'+kind,'t:'+word,'d:'+word])
     };
     owned.queryKeys.set(kind,keys);
   }
   return keys;
 }
 const actionNounCues=['timer','theme','pet','market','notes','reminder','plan','feedback','rubric'].map(name=>[name,new RegExp('\\b'+name+'s?\\b','i')]),
   helpCues=Object.entries({practice:/\b(?:quiz|test)\s+me\b|\b(?:practice|flashcards?|mock|self.check)\b/i,fixes:/\b(?:rewrite|rephrase|revise|improve|polish|feedback|draft|comments?|fix)\b/i,reading:/\b(?:explain|unpack|understand|simplify|summari[sz]e|summary)\b|plain\s+(?:language|english)/i,rubric:/\b(?:rubric|criteria|criterion|grid|markscheme)\b/i,lab:/\b(?:lab|experiment|apparatus|method)\b/i,notes:/\b(?:notes?|checklist|outline)\b|study\s+guide|key\s+points/i,new:/\b(?:invent|new|fresh|original)\b|make\s+up/i});
 /* Model-owned opt-in projection applies only to classifier features. Ranking/fields keep
    their original input. Literal note data is never projected or rewritten here.
    Ignore caller parseCues in this mode: training and serving must parse the same text. */
 function focusedRequest(rawText,config,scope){
  if(!Object.hasOwn(config,'requestFocus'))return null;
  const mode=config.requestFocus;
  if(mode===undefined||mode===false)return null;
  if(mode!==true)throw new TypeError('features.requestFocus must be a boolean');
  scope=scope||optional('ReserveBiscuitIntent','./biscuit-intent.js');if(scope?.literalNoteRequest?.(rawText))return {focused:false,text:rawText,goal:rawText,privateExcluded:false};
  rawText=rawText.slice(0,4096);
  const goal=scope?.requestSpan?.(rawText)??scope?.requestGoal?.(rawText)??rawText,
    text=scope?.withoutPrivateExclusions?.(goal)??goal,
    privateText=goal===rawText?text:(scope?.withoutPrivateExclusions?.(rawText)??rawText);
  return {focused:true,text,goal,privateExcluded:text!==goal||privateText!==rawText,changed:goal!==rawText};
 }
 function kindRequestConfig(config){
  if(!Object.hasOwn(config,'kindRequestFocus'))return config;const mode=config.kindRequestFocus;
  if(typeof mode!=='boolean')throw new TypeError('features.kindRequestFocus must be a boolean');if(!mode)return config;
  if(Object.hasOwn(config,'requestFocus')&&config.requestFocus!==undefined&&typeof config.requestFocus!=='boolean')throw new TypeError('features.requestFocus must be a boolean');
  return {...config,requestFocus:true};
 }

 /* Opt-in evidence is a projection, never a session mutation or prompt payload.
    Only prior user query and the actual assistant question envelope are inspected.
    Unknown names/privacy semantics deliberately fall back to current input. */
 function conversationEnabled(config={}){
  if(!Object.hasOwn(config,'conversationEvidence'))return false;const mode=config.conversationEvidence;
  if(typeof mode!=='boolean')throw new TypeError('features.conversationEvidence must be a boolean');return mode;
 }
 const historyPrivate=/\b(?:grades?|scores?|marks?|feedback|teacher comments?)\b/i;
 const historyReset=/\b(?:new topic|change (?:the )?(?:topic|subject)|switch (?:the )?(?:topic|subject)|start (?:over|again)|reset(?: (?:the )?(?:conversation|chat))?|forget (?:that|it|everything|the (?:previous|prior) (?:request|topic|source))|(?:new|another|different) (?:source|topic|subject|file|page|document|material))\b/i;
 function privateHistoryAllowed(s){
   return s.showGrades!==false&&
     s.settings?.showGrades!==false&&
     s.privacy?.grades!==false&&
     (s.showGrades===true||s.settings?.showGrades===true)&&
     s.teacherFeedback!==false&&
     s.settings?.teacherFeedback!==false&&
     s.privacy?.teacherFeedback!==false&&
     s.privacy?.feedback!==false;
 }
 function historyName(value){return words(value).join(' ');}
 function phraseIn(text,name){return (' '+text+' ').includes(' '+name+' ');}
 function conversationState(input,s={},session={},fullRows=[],config={}){
  if(!conversationEnabled(config))return null;
  const raw=String(input).slice(0,4096),text=raw.trim(),Intent=optional('ReserveBiscuitIntent','./biscuit-intent.js');
  if(!text||historyReset.test(text)||/^(?:(?:hi|hello|hey|thanks|thank you|bye|goodbye|ok|okay)(?: there| again| so much| for your help)?)[.!\s]*$/i.test(text)||Intent?.literalNoteRequest?.(raw))
    return null;
  const prior=typeof session.query==='string'?session.query.slice(0,2048).trim():'';
  if(!prior||prior===text||Intent?.literalNoteRequest?.(prior))return null;
  const priorWords=words(prior),currentWords=words(text);if(priorWords.length<6||content(prior).length<4||currentWords.length>32)return null;
  const priorName=historyName(prior),currentName=historyName(text),without=Intent?.withoutPrivateExclusions?.(raw)??raw;
  if(historyPrivate.test(prior)&&(!privateHistoryAllowed(s)||without!==raw))return null;
  /* An explicitly quoted/named or loaded new source owns the current request.
     Read titles only, never source bodies or metadata, and keep default APIs lazy. */
  const newPhrase=value=>{const name=historyName(value);return !!name&&!phraseIn(priorName,name);};
  for(const match of text.matchAll(/["\u201c]([^"\u201d]{2,256})["\u201d]/g))if(newPhrase(match[1]))return null;
  if(/\b(?:named|titled|called)\s+\S/i.test(text)&&!phraseIn(priorName,currentName))return null;
  const lists=[fullRows,...['assignments','workItems','files','pages','materials','quizzes','announcements','messages','discussions','rubrics'].map(key=>s[key])];
  for(const list of lists)
    if(Array.isArray(list))
      for(const row of list){
        if(!row||typeof row!=='object')continue;
        const name=historyName(row.title??row.name??'');
        if(!name)continue;
        const current=phraseIn(currentName,name),previous=phraseIn(priorName,name);
        if(current&&!previous&&(words(name).length>=2||currentName===name))return null;
        if(previous&&(row.gradeAccess===true||['grade','feedback','course-grade'].includes(row.kind))&&(!privateHistoryAllowed(s)||without!==raw))return null;
      }
  /* Unknown capitalized multiword names are also conservative topic boundaries. */
  for(const match of text.matchAll(/\b[\p{Lu}][\p{Ll}\p{N}]+(?:[ -][\p{Lu}][\p{Ll}\p{N}]+)+/gu))if(content(match[0]).length>=2&&newPhrase(match[0]))return null;
  const anaphoric=/\b(?:it|its|this|that|these|those|them|their|same|previous|earlier|above|continue)\b/i.test(text),
    last=session.lastResult,
    question=typeof last?.message==='string'?last.message.slice(-1024).trim():'',
    openQuestion=Array.isArray(last?.items)&&last.items.length===0&&/\?[\s"'\u201d\u2019]*$/.test(question),
    substantial=prior.length>=60&&priorWords.length>=12&&content(prior).length>=6;
  if(!anaphoric&&/^(?:(?:please|now)\s+)?(?:open|find|locate|download|navigate|go to|switch to|start|stop|set|save|delete|remove|mark|bookmark)\b/i.test(text))return null;
  if(!anaphoric&&!(openQuestion&&(currentWords.length<=12||substantial)))return null;
  const budget=Math.min(2048,4096-raw.length-2);if(budget<1)return null;const evidence=prior.slice(0,budget).trim();if(!evidence)return null;
  return {prior:evidence,openQuestion,featureInput:raw+'\n\n'+evidence};
 }
 function sourceInput(input,s={},session={},fullRows=[],config={}){
  if(!conversationEnabled(config))return input;
  return conversationState(input,s,session,fullRows,config)?.featureInput??String(input).slice(0,4096);
 }
 /* The fresh session intentionally prevents recursive inheritance of prior actions. */
 function inferredPriorAction(prior,s,predicted='none'){return optional('ReserveBiscuitIntent','./biscuit-intent.js')?.choose(prior,s,{},predicted,0);}
 function actionFeatures(input,s={},session={},config={}){
  const rawText=String(input).slice(0,4096),
    scope=optional('ReserveBiscuitIntent','./biscuit-intent.js'),
    request=focusedRequest(rawText,config,scope),
    text=request?request.text:scope?.literalNoteRequest?.(rawText)?rawText:(scope?.withoutPrivateExclusions?.(rawText)??rawText),
    tokens=words(text),
    out={bias:1},
    max=config.charMax??5;
  if(request?.focused){if(request.privateExcluded)out['cue:gradesExcluded']=1;out['cue:requestFocus']=1;if(request.changed)out['cue:requestFocusChanged']=1;}
  else if(text!==rawText)out['cue:gradesExcluded']=1;
  for(const w of tokens)out['w:'+w]=1;
  for(let i=1;i<tokens.length;i++)out['b:'+tokens[i-1]+' '+tokens[i]]=1;
  const goal=request?.focused?text:optional('ReserveBiscuitIntent','./biscuit-intent.js')?.requestSpan(text),headWords=typeof text==='string'&&(!goal||goal===text)?tokens:words(goal||text);
  for(let n=1;n<=Math.min(3,headWords.length);n++)out['cue:requestHead:'+headWords.slice(0,n).join(' ')]=1;
  if(goal&&goal.trim()!==text.trim()){
    const goalWords=typeof goal==='string'?headWords:words(goal);
    out['cue:requestClause']=1;
    for(const w of goalWords)out['w:goal:'+w]=1;
    for(let i=1;i<goalWords.length;i++)out['b:goal:'+goalWords[i-1]+' '+goalWords[i]]=1;
    const typed=semantics()?.abstractFeatures?.(goal,s)||{};
    for(const [k,v]of Object.entries(typed))out[k.replace(':',':goal:')]=v;
  }
  if(max>=3){const text=' '+tokens.join(' ')+' ';for(let n=3;n<=max;n++)for(let i=0;i<=text.length-n;i++)out['c'+n+':'+text.slice(i,i+n)]=.35;}
  const cue=(name,yes)=>{if(yes)out['cue:'+name]=1;};
  cue('number',/\d/.test(text));
  cue('duration',/\b(?:minutes?|mins?|hours?|hrs?)\b|\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter)\s*(?:more\s+)?(?:minutes?|mins?|hours?|hrs?|m|h)\b/i.test(text));
  cue('time',/\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*[ap]m\b/i.test(text));
  cue('question',/\?|^\s*(?:what|which|where|when|why|how|who|is|are|does|did|can i)\b/i.test(text));
  cue('negation',/\b(?:no|not|never|dont|don't|do not|without|except)\b/i.test(text.replace(/\u2019/g,"'")));
  cue('focusRunning',s.focus?.running||s.focus?.paused);
  cue('page',s.selectedItemId||s.itemId||s.page?.itemId);
  cue('followup',session.lastItemId||session.itemId||session.lastResult);
  cue('empty',![s.workItems,s.assignments,s.files,s.courses].some(a=>Array.isArray(a)&&a.length));
  cue('aiOff',s.ai===false);
  for(const [name,re]of actionNounCues)cue(name,re.test(text));
  for(const [key,value]of [['view',s.view||s.pageKind],['pageKind',s.page?.kind],['lastAction',session.lastAction?.action||session.lastAction?.type]])
    if(typeof value==='string')out['state:'+key+':'+value.slice(0,50)]=1;
  for(const [kind,re]of helpCues)cue('help:'+kind,re.test(text));
  const pageId=String(s.selectedItemId||s.itemId||s.page?.itemId||'');
  if(pageId)
    for(const field of ['workItems','assignments','quizzes','discussions','announcements','feedback','rubrics','pages','files','inbox']){
      const row=Array.isArray(s[field])?s[field].find(v=>String(v.id)===pageId):null;
      if(row){out['state:openKind:'+(row.workKind||row.kind||field)]=1;break;}
    }
  const parser=root.ReserveBiscuitParse||(typeof module==='object'&&module.exports?require('./biscuit-parse.js'):null),
    cues=request?
      {command:parser?.commands?.(text,s)?.[0],local:parser?.local?.(text,s)?.[0]}:
      config.parseCues||{command:parser?.commands?.(rawText,s)?.[0],local:parser?.local?.(rawText,s)?.[0]};
  for(const [key,v]of Object.entries(cues))
    if(v?.intent){out['cue:'+key+':'+v.intent]=2;if(v.fields?.action)out['cue:'+key+':'+v.intent+':'+v.fields.action]=2;if(v.fields?.key)out['cue:'+key+':key:'+v.fields.key]=1;}
  const intent=optional('ReserveBiscuitIntent','./biscuit-intent.js'),controlText=goal||text;
  if(!/^(?:what|which|where|when|who|why|how|if|unless|suppose|compare|contrast|explain|teach|write|draft|compose|generate|invent|summari[sz]e)\b/i.test(controlText)&&!intent?.scheduleRequest(controlText)){
    const control=optional('ReserveBiscuitControlRequest','./biscuit-control-request.js')?.resolve('setting',controlText,s,session),key=control?.next?.fields?.key;
    if(control&&typeof key==='string')out['cue:typedControl:'+control.action+':'+key]=1;
  }
  if(tokens.length<=12&&session.query&&typeof session.query==='string'){
    const values=optional('ReserveBiscuitValues','./biscuit-values.js'),
      rest=values?.normalize(text).replace(/\d+(?::\d+)?(?:\.\d+)?\s*(?:[ap]m)?/gi,'').replace(/\b(?:today|tomorrow|tonight|next|this|on|at|in|for|from|to|until|till|after|before|and|a|an|the|hours?|hrs?|minutes?|mins?|seconds?|secs?|m|h|s|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|please|pls)\b/gi,'').replace(/[\s:+\-.,?!]/g,'');
    if(rest===''){
      const prior=inferredPriorAction(session.query.slice(0,4096),s,session.lastAction?.action||'none');
      if(['reminder','plan','focus','focus-control'].includes(prior))out['cue:temporalFollowup:'+prior]=1;
    }
  }
  Object.assign(out,language()?.actionFeatures?.(text,s,session),semantics()?.actionFeatures?.(text,s,session));
  const history=conversationState(rawText,s,session,[],config);
  if(history?.openQuestion){out['state:previousOpenQuestion']=1;const priorAction=inferredPriorAction(history.prior,s);if(priorAction&&priorAction!=='none')out['priorAction:'+priorAction]=1;}
  return out;
 }
 const kindNouns=Object.entries({
   file:['file','files','manual','manuals','spreadsheet','spreadsheets','handout','handouts','slides','document','documents','attachment','attachments','printable','template','templates','pdf','csv'],
   work:['assignment','assignments','homework','task','tasks','worksheet','worksheets','project','projects','essay','essays','lab','labs','problem set'],
   grade:['grade','grades','mark','marks','score','scores','total','totals','average','percent','feedback'],
   announcement:['notice','notices','announcement','announcements','posted','update','correction'],
   page:['page','pages','guide','guides','syllabus','policy','reading'],
   quiz:['quiz','quizzes','exam','exams','test','tests','attempt','attempts','checkpoint'],
   teacher:['teacher','teachers','instructor','professor','contact','email','office hours'],
   message:['message','messages','conversation','conversations','inbox','reply'],
   event:['event','events','calendar','appointment','appointments','meeting','conference'],
   group:['group','groups','team','members','roster']
 });
 function context(input,s={},session={},rows=[],token){
  const records=token===OWN?new WeakMap():null,parts=row=>records?lexicalRecord(row,records):rowWords(row);
  const corrected=String(input).replace(/\b(?:then|after that|first and)\b.*$/i,'').replace(/^.*\bi mean\s+/i,'').replace(/\b(?:forget|ignore)\s+[^,;]+[,;]/gi,''),
    query=content(corrected),
    q=[...new Set(query)],
    page=id(s.selectedItemId||s.itemId||s.page?.itemId),
    last=id(session.itemId||session.lastItemId||session.lastResult?.next?.fields?.itemId||session.lastResult?.items?.[0]?.id),
    course=id(s.activeCourseId||s.courseId||s.page?.courseId||session.lastCourseId),
    freq=new Map();
  for(const row of rows){
    const r=parts(row);
    if(q.length<r.title.size+r.body.size){for(const w of q)if(r.title.has(w)||r.body.has(w))freq.set(w,(freq.get(w)||0)+1);}
    else{for(const w of r.title)freq.set(w,(freq.get(w)||0)+1);for(const w of r.body)if(!r.title.has(w))freq.set(w,(freq.get(w)||0)+1);}
  }
  const weights=new Map(q.map(w=>[w,1+Math.log(1+(rows.length||1)/(freq.get(w)||1))])),total=[...weights.values()].reduce((a,b)=>a+b,0)||1;
  let exact;
  rows.forEach(row=>{
    const candidate={id:row.id,courseId:row.courseId,hits:0};
    for(const w of (records?parts(row).titleTokens:content(row.title)))if(q.includes(w)&&w.length>2)candidate.hits++;
    if(!exact||candidate.hits>exact.hits)exact=candidate;
  });
  const named=exact?.hits>=2?exact.id:'';
  const positiveText=optional('ReserveBiscuitIntent','./biscuit-intent.js')?.targetText(input)||corrected,
    positiveWords=content(positiveText),
    positive={q:[...new Set(positiveWords)],text:numericWords(positiveText).join(' ')},
    text=numericWords(corrected).join(' '),
    positivePhrase=' '+positive.text+' ',
    kindCues=kindNouns.filter(([,terms])=>terms.some(v=>positivePhrase.includes(' '+v+' '))).map(([k])=>k),
    kindStyle=/\b(?:allowed|permitted|accept|accepts|formats?|types?|can i|may i|do we)\b/i.test(corrected)?'policy':/\b(?:open|find|fetch|retrieve|download|locate|bring|show)\b/i.test(corrected)?'retrieve':'mention';
  const Language=language(),
    view=token===OWN?Language?.prepareView?.(s,rows):undefined,
    out={
      q,
      query,
      weights,
      total,
      page,
      last,
      course,
      named,
      positive,
      kindCues,
      kindStyle,
      text,
      deictic:/\b(?:this|that|it|selected|open|current|same)\b/i.test(input),
      ordinal:/\b(first|second|third|last|middle)\b/i.exec(input)?.[1],
      previous:session.items||session.lastItems||session.lastResult?.items||[],
      language:Language?.prepare?.(corrected,s,session,rows,view)
    };
  if(token===OWN)
    contexts.set(out,{
      input:String(input),
      s,
      session,
      rows,
      records,
      queryKeys:new Map(),
      languageRequest:Language?.prepareItems?.(out.language,s,session,rows),
      semanticRequest:null
    });
  return out;
 }
 const rowCache=new WeakMap(),textCache=new Map(),gramCache=new Map(),grams=value=>{
   const cached=gramCache.get(value);
   if(cached)return cached;
   const out=new Set();
   for(let i=0;i<value.length-2;i++)out.add(value.slice(i,i+3));
   if(gramCache.size<16000)gramCache.set(value,out);
   return out;
 },dice=(a,b)=>{const x=grams(a),y=grams(b);let n=0;for(const g of x)if(y.has(g))n++;return 2*n/Math.max(1,x.size+y.size);};
 function rowWords(row){
   let out=rowCache.get(row);
   if(!out){
     const key=String(row.kind)+':'+String(row.courseId)+':'+String(row.id),
       signature=[row.title,row.text||row.description||row.instructions,row.aliases,row.teacher||row.teacherName,row.course||row.courseName],
       previous=textCache.get(key);
     if(previous&&signature.every((v,i)=>v===previous.signature[i])){rowCache.set(row,previous.out);return previous.out;}
     out={
       title:content(row.title),
       body:content(row.text||row.description||row.instructions),
       aliases:content(row.aliases),
       teacher:content(row.teacher||row.teacherName),
       course:content(row.course||row.courseName),
       phrase:numericWords(row.title).join(' ')
     };
     for(const key of ['title','body','aliases','teacher','course'])out[key]=new Set(out[key]);
     out.titleList=[...out.title];
     if(textCache.size>=512&&!textCache.has(key))textCache.delete(textCache.keys().next().value);
     textCache.set(key,{signature,out});
     rowCache.set(row,out);
   }
   return out;
 }
 const itemKindKeys=['title','body','alias','charTitle','page','last','relatedPage','relatedLast','relatedNamed','courseOpen','deicticPage','deicticLast','soon','overdue','noMatch'],kindKeyCache=new Map(),wantedKeys=['title','body','alias'];
 /* Cache only names derived from primitive kinds, never row, query, model or snapshot values. */
 function kindFeatureKeys(kind){
   if(typeof kind!=='string'||kind.length>128)return null;
   let keys=kindKeyCache.get(kind);
   if(!keys){keys=itemKindKeys.map(key=>key+':'+kind);if(kindKeyCache.size>=128)kindKeyCache.delete(kindKeyCache.keys().next().value);kindKeyCache.set(kind,keys);}
   return keys;
 }
 function titleSimilarity(w,r){let best=0;for(const t of r.titleList)if(t.length>=4&&w[0]===t[0]&&Math.abs(w.length-t.length)<=3)best=Math.max(best,dice(w,t));return best;}
 function itemLexical(c,r,out){
   let title=0,body=0,alias=0,teacher=0,course=0,coverage=0,titleHits=0,charTitle=0;
   for(const w of c.q){
     const t=r.title.has(w),b=r.body.has(w),a=r.aliases.has(w),weight=c.weights.get(w);
     title=title+(t?weight:0);
     body=body+(b?weight:0);
     alias=alias+(a?weight:0);
     teacher=teacher+(r.teacher.has(w)?weight:0);
     course=course+(r.course.has(w)?weight:0);
     coverage+=t||b||a?1:0;
     titleHits+=t?1:0;
     charTitle=charTitle+(w.length>=4?(t?1:titleSimilarity(w,r))*weight:0);
   }
   out.title=title/c.total;
   out.body=body/c.total;
   out.alias=alias/c.total;
   out.teacher=teacher/c.total;
   out.course=course/c.total;
   out.coverage=c.q.length?coverage/c.q.length:0;
   out.titleFraction=r.title.size?titleHits/r.title.size:0;
   out.charTitle=charTitle/c.total;
 }
 function matchFraction(q,set){let hits=0;for(const w of q)if(set.has(w))hits++;return hits/Math.max(1,q.length);}
 function wantedFraction(p,set,fast){return fast?matchFraction(p.q,set):p.q.filter(w=>set.has(w)).length/Math.max(1,p.q.length);}
 function matchesNumber(q,r){for(const w of q)if(/^\d+$/.test(w)&&(r.title.has(w)||r.aliases.has(w)))return 1;return 0;}
 function itemFeatures(input,row,s={},session={},rows=[],prepared,owned=false){
  const c=prepared||context(input,s,session,rows),
    ownedState=owned===true?contexts.get(c):null,
    r=ownedState?lexicalRecord(row,ownedState.records):rowWords(row),
    out={bias:1},
    kind=row.kind||'item',
    fast=owned===true||!prepared,
    rel=id(row.assignmentId||row.parentId||row.itemId),
    related=target=>!!target&&(rel===target||id(row.id)===target),
    page=c.page,
    last=c.last;
  if(fast)
    itemLexical(c,r,out);
  else{
    const score=set=>c.q.reduce((n,w)=>n+(set.has(w)?c.weights.get(w):0),0)/c.total;
    out.title=score(r.title);
    out.body=score(r.body);
    out.alias=score(r.aliases);
    out.teacher=score(r.teacher);
    out.course=score(r.course);
    out.coverage=c.q.length?c.q.filter(w=>r.title.has(w)||r.body.has(w)||r.aliases.has(w)).length/c.q.length:0;
    out.titleFraction=r.title.size?c.q.filter(w=>r.title.has(w)).length/r.title.size:0;
    out.charTitle=c.q.reduce(
      (n,w)=>n+(w.length>=4?(r.title.has(w)?1:Math.max(0,...r.titleList.map(t=>t.length>=4&&w[0]===t[0]&&Math.abs(w.length-t.length)<=3?dice(w,t):0)))*c.weights.get(w):0),
      0)/c.total;
  }
  out.phrase=r.phrase.length>2&&c.text.includes(r.phrase)?1:0;
  out.page=id(row.id)===page?1:0;
  out.last=id(row.id)===last?1:0;
  out.relatedPage=related(page)?1:0;
  out.relatedLast=related(last)?1:0;
  out.relatedNamed=related(c.named)?1:0;
  out.courseOpen=row.courseId&&id(row.courseId)===c.course?1:0;
  out.deicticPage=c.deictic*out.page;
  out.deicticLast=c.deictic*out.last;
  out.done=row.done||row.completed?1:0;
  out.kind='';
  delete out.kind;
  out['kind:'+kind]=1;
  const rawDue=row.dueAt??row.due_at??row.startAt??row.start,due=typeof rawDue==='number'?rawDue:Date.parse(rawDue),left=(due-Number(s.now))/86400000;
  out.soon=Number.isFinite(left)&&left>=0?1/(1+left):0;
  out.overdue=left<0&&!out.done?1:0;
  out.lexical=clip(out.title+out.body+out.alias);
  out.noMatch=out.coverage===0?1:0;
  const kindKeys=kindFeatureKeys(kind);for(let i=0;i<itemKindKeys.length;i++){const k=itemKindKeys[i];if(out[k])out[kindKeys?kindKeys[i]:k+':'+kind]=out[k];}
  if(c.positive){
    const p=c.positive;
    for(const key of wantedKeys){const value=wantedFraction(p,r[key==='alias'?'aliases':key],fast);if(value){out[key+':wanted']=value;out[key+':wanted:'+kind]=value;}}
    if(r.phrase.length>2&&p.text.includes(r.phrase)){out['sem:wantedNamed']=1;out['sem:wantedNamed|'+kind]=1;}
  }
  if(ownedState){
    const keys=queryKeys(c,kind,ownedState);
    for(const pair of keys.kinds){out[pair[0]]=1;out[pair[1]]=1;}
    for(const key of keys.bigrams)out[key]=1;
    for(let i=0;i<c.q.length;i++){
      const w=c.q[i],keysForWord=keys.words[i];
      out[keysForWord[0]]=1;
      if(r.title.has(w))out[keysForWord[1]]=1;
      if(r.body.has(w))out[keysForWord[2]]=1;
    }
  }
  else{
    for(const cue of c.kindCues||[]){out['kindNoun:'+cue+'|'+kind]=1;out['kindNoun:'+cue+'|'+c.kindStyle+'|'+kind]=1;}
    for(let i=1;i<c.query.length;i++)out['qb:'+c.query[i-1]+' '+c.query[i]+'|'+kind]=1;
    for(const w of c.q){out['q:'+w+'|'+kind]=1;if(r.title.has(w))out['t:'+w]=1;if(r.body.has(w))out['d:'+w]=1;}
  }
  if(c.ordinal){
    const n={first:0,second:1,third:2,middle:1,last:c.previous.length-1}[c.ordinal],wanted=c.previous[n];
    out.ordinal=id(wanted?.id||wanted?.itemId)===id(row.id)?1:0;
  }
  if(fast)out.numberMatch=matchesNumber(c.q,r);else{const numbers=c.q.filter(w=>/^\d+$/.test(w));out.numberMatch=numbers.some(w=>r.title.has(w)||r.aliases.has(w))?1:0;}
  const Semantics=semantics();
  if(ownedState&&!ownedState.semanticRequest)ownedState.semanticRequest=Semantics?.prepareItems?.(input,s,session,rows);
  Object.assign(
    out,
    language()?.itemFeatures?.(input,row,s,session,rows,c,ownedState?.languageRequest),
    Semantics?.itemFeatures?.(input,row,s,session,rows,ownedState?.semanticRequest||c));
  if(c.action)for(const k of itemKindKeys)if(out[k])out['role:'+c.action+'|'+k+'|'+kind]=out[k];
  return out;
 }
 /* Owned feature bags contain stable numeric values; external callers retain value-snapshot semantics. */
 function eachFeature(features,stable,visit){
   if(stable){for(const key in features)if(Object.hasOwn(features,key))visit(key,features[key]);}else for(const [key,value]of Object.entries(features))visit(key,value);
 }
 function classify(model,features,stable=false){
   if(!model)return [];
   const scores=model.labels.map((label,i)=>({label,score:0,index:i})),scale=model.scale||1;
   eachFeature(features,stable,(feature,value)=>{
     const weights=model.weights[feature];
     if(weights)for(let j=0;j<scores.length;j++)scores[j].score+=weights[j]*value/scale;
   });
   const max=Math.max(...scores.map(v=>v.score)),sum=scores.reduce((n,v)=>n+Math.exp(v.score-max),0);
   const linear=scores.map(v=>({...v,probability:Math.exp(v.score-max)/sum})).sort((a,b)=>b.score-a.score||a.index-b.index);
   return model.trees?optional('ReserveBiscuitTrees','./biscuit-trees.js').blend(model,features,linear):linear;
 }
 function score(model,features,stable=false){
   let sum=0;
   if(!model)return sum;
   eachFeature(features,stable,(key,value)=>{if(model.weights[key])sum+=model.weights[key][0]*value/(model.scale||1);});
   if(model.ranker)sum+=optional('ReserveBiscuitTrees','./biscuit-trees.js').rankResidual(model.ranker,features);
   return sum;
 }
 /* Snapshot exactly the spread's own enumerable values before any model read.
    Help names retain their original insertion positions. Numeric snapshots avoid
    rebuilding a large dictionary; residuals and external scorers still receive
    a complete ordinary bag. Digit-leading keys also materialize so arbitrary
    Proxy integer-key order receives the ordinary object ordering. No source
    bag is mutated or retained. */
 function scoreWithHelp(model,features,kind,row){
  const keys=[],values=[];let fallback=false;
  if(features!==null&&features!==undefined){
    const source=Object(features);
    for(const key of Reflect.ownKeys(source)){
      const property=Object.getOwnPropertyDescriptor(source,key);
      if(!property?.enumerable)continue;
      const value=source[key];
      keys.push(key);
      values.push(value);
      if(!Object.hasOwn(property,'value')||typeof value!=='number'||typeof key==='string'&&/^[0-9]/.test(key))fallback=true;
    }
  }
  const materialize=()=>{
    const bag={};
    for(let i=0;i<keys.length;i++)Object.defineProperty(bag,keys[i],{value:values[i],enumerable:true,writable:true,configurable:true});
    return bag;
  },invoke=bag=>{const owner=this||api;return owner.score(model,bag,true);};
  if(fallback){const bag=materialize();bag['help:'+kind]=1;bag['help:'+kind+'|'+row.kind]=1;return invoke(bag);}
  const help='help:'+kind;let at=keys.indexOf(help);
  /* A missing Help property can invoke an inherited setter or reject a write.
     Preserve ordinary assignment, including its order before row.kind is read. */
  if(at<0&&help in Object.prototype){const bag=materialize();bag[help]=1;bag['help:'+kind+'|'+row.kind]=1;return invoke(bag);}
  if(at<0){keys.push(help);values.push(1);}else values[at]=1;
  const typed='help:'+kind+'|'+row.kind;at=keys.indexOf(typed);
  if(at<0&&typed in Object.prototype){const bag=materialize();bag[typed]=1;return invoke(bag);}
  if(at<0){keys.push(typed);values.push(1);}else values[at]=1;
  const owner=this||api,scorer=owner.score;if(scorer!==score)return scorer.call(owner,model,materialize(),true);
  let sum=0;if(!model)return sum;
  for(let i=0;i<keys.length;i++){const key=keys[i];if(typeof key==='string'&&model.weights[key])sum+=model.weights[key][0]*values[i]/(model.scale||1);}
  if(model.ranker)sum+=optional('ReserveBiscuitTrees','./biscuit-trees.js').rankResidual(model.ranker,materialize());return sum;
 }
 /* Intentional R6 alignment: candidates may be filtered, feature context may not.
    Default callers retain rows as their universe. Inference explicitly supplies the full
    privacy-valid universe, matching fitting/mining; this normalization change needs CV/refit.
    Guarded public AI reuse still serializes the row universe and language evidence maps.
    The separate immediate-owned protocol below skips those guards within one call only. */
 function rank(model,input,rows,s={},session={},action='open/find',contextRows=rows){
  const c=prepareContext(input,s,session,contextRows);
  c.action=action;
  const bags=new WeakMap(),aliases=new WeakMap(),ranked=rows.map(row=>{
    const x=itemFeatures(input,row,s,session,contextRows,c,true),out={...row,rankScore:score(model,x,true)};
    if(action==='ai')bags.set(row,x);
    aliases.set(out,row);
    return out;
  }).sort((a,b)=>b.rankScore-a.rankScore||String(a.id).localeCompare(String(b.id)));
  Object.defineProperty(ranked,'prepared',{value:c});
  if(action==='ai'){
    const stamps=contextRows.map(recordStamp),recordStamps=new WeakMap(contextRows.map((row,i)=>[row,stamps[i]]));
    for(const row of rows)if(!recordStamps.has(row))recordStamps.set(row,recordStamp(row));
    rankViews.set(ranked,{
      input:String(input),
      s,
      session,
      action,
      c,
      contextRows,
      contextState:contextState(c),
      rows:contextRows.slice(),
      stamps,
      recordStamps,
      snapshotRefs:Object.entries(s),
      environment:environment(s,session),
      bags,
      aliases
    });
  }
  return ranked;
 }
 function retainRank(source,target){
  const state=rankViews.get(source);
  if(!state||!Array.isArray(target)||Object.hasOwn(target,'prepared')&&target.prepared!==state.c)return target;
  rankViews.set(target,state);
  if(!Object.hasOwn(target,'prepared')&&Object.isExtensible(target))Object.defineProperty(target,'prepared',{value:state.c});
  const unique=new Map();
  for(const row of source){const canonical=state.aliases.get(row)||row,key=rowKey(row);unique.set(key,unique.has(key)?null:canonical);}
  for(const row of target){
    const canonical=unique.get(rowKey(row));
    if(canonical&&recordMatches(row,state.recordStamps.get(canonical)))state.aliases.set(row,canonical);
  }
  return target;
 }
 function reuseRank(ranked,input,s,session,rows,action='ai'){
  const state=rankViews.get(ranked);
  if(!state||
    action!=='ai'||
    state.action!==action||
    state.input!==String(input)||
    state.s!==s||
    state.session!==session||
    state.environment!==environment(s,session)||
    state.c.action!==action||
    state.contextState===null||
    state.contextState!==contextState(state.c)||
    !sameRows(state.rows,rows)||
    !state.rows.every((row,i)=>recordMatches(row,state.stamps[i]))||
    state.snapshotRefs.length!==Object.keys(s).length||
    state.snapshotRefs.some(([key,value])=>s[key]!==value))
    return null;
  return {prepared:state.c,rows:state.contextRows,features(row){
    const canonical=state.aliases.get(row)||row,bag=state.bags.get(canonical);
    return bag&&recordMatches(row,state.recordStamps.get(canonical))?{...bag}:null;
  }};
 }
 /* Immediate synchronous inference borrows plain snapshots until beginInference exits.
    Public rank/retainRank/reuseRank stay guarded and never consult these private views.
    Built-in Selection only copies/reorders rows and changes rankScore. Accessors, foreign
    objects, changed copy fields, ambiguous identities and different source universes fall back.
    There is no universe/evidence serialization here, no await, and no cross-call cache. */
 function plainSnapshot(roots){
  const pending=roots.slice(),seen=new WeakSet();let count=0;
  try{
    while(pending.length){
      const value=pending.pop();
      if(value===null||typeof value!=='object')continue;
      if(seen.has(value))continue;
      if(++count>16384)return false;
      const prototype=Object.getPrototypeOf(value);
      if(!Array.isArray(value)&&prototype!==null&&Object.getPrototypeOf(prototype)!==null)return false;
      const descriptors=Object.getOwnPropertyDescriptors(value);
      for(const key of Reflect.ownKeys(descriptors)){
        if(typeof key!=='string')return false;
        const property=descriptors[key];
        if(!Object.hasOwn(property,'value'))return false;
        const child=property.value;
        if(typeof child==='function'||typeof child==='symbol')return false;
        if(child!==null&&typeof child==='object')pending.push(child);
      }
      seen.add(value);
    }
    return true;
  }catch{return false;}
 }
 function sameOwnedRow(row,canonical){
  if(!row||typeof row!=='object')return false;
  const descriptors=Object.getOwnPropertyDescriptors(row);
  if(Reflect.ownKeys(descriptors).some(key=>typeof key!=='string'||!Object.hasOwn(descriptors[key],'value')))return false;
  const a=Object.keys(row),b=Object.keys(canonical);
  let i=0,j=0;
  while(i<a.length||j<b.length){
    if(a[i]==='rankScore'){i++;continue;}
    if(b[j]==='rankScore'){j++;continue;}
    if(i===a.length||j===b.length||a[i]!==b[j]||!Object.is(descriptors[a[i]].value,canonical[b[j]]))return false;
    i++;
    j++;
  }
  return true;
 }
 function inferenceIdentity(index,row,put,value){
  const kind=String(row.kind),course=String(row.courseId??''),key=String(row.id);
  let courses=index.get(kind);
  if(!courses){if(!put)return;index.set(kind,courses=new Map());}
  let ids=courses.get(course);
  if(!ids){if(!put)return;courses.set(course,ids=new Map());}
  if(put){ids.set(key,ids.has(key)?null:value);return;}
  return ids.get(key);
 }
 function rankForInference(state,model,input,rows,s={},session={},action='open/find',contextRows=rows){
  if(!state.active||action!=='ai'||state.disabled)return api.rank(model,input,rows,s,session,action,contextRows);
  if(!Array.isArray(rows)||!Array.isArray(contextRows)||contextRows.some(row=>!row||typeof row!=='object')||!plainSnapshot([s,session,rows,contextRows])){
    state.disabled=true;
    return api.rank(model,input,rows,s,session,action,contextRows);
  }
  const universe=new WeakSet(contextRows);if(rows.some(row=>!universe.has(row))){state.disabled=true;return api.rank(model,input,rows,s,session,action,contextRows);}
  const c=prepareContext(input,s,session,contextRows);
  c.action=action;
  const bags=new WeakMap(),aliases=new WeakMap(),ranked=rows.map(row=>{
    const x=itemFeatures(input,row,s,session,contextRows,c,true),out={...row,rankScore:score(model,x,true)};
    bags.set(row,x);
    aliases.set(out,row);
    return out;
  }).sort((a,b)=>b.rankScore-a.rankScore||String(a.id).localeCompare(String(b.id)));
  Object.defineProperty(ranked,'prepared',{value:c});
  state.ranks.set(ranked,{input:String(input),s,session,action,c,contextRows,rows:contextRows.slice(),bags,aliases,valid:true});
  return ranked;
 }
 function retainInferenceRank(state,source,target){
  const view=state.active&&state.ranks.get(source);
  if(!view)return api.retainRank(source,target);
  if(!Array.isArray(target)||Object.hasOwn(target,'prepared')&&target.prepared!==view.c)return target;
  const identities=new Map();
  for(const row of source){
    const canonical=view.aliases.get(row);
    if(!canonical||!sameOwnedRow(row,canonical))view.valid=false;else inferenceIdentity(identities,row,true,canonical);
  }
  for(const row of target){
    const canonical=view.aliases.get(row)||inferenceIdentity(identities,row,false);
    if(!canonical||!sameOwnedRow(row,canonical)){view.valid=false;continue;}
    view.aliases.set(row,canonical);
  }
  state.ranks.set(target,view);if(!Object.hasOwn(target,'prepared')&&Object.isExtensible(target))Object.defineProperty(target,'prepared',{value:view.c});return target;
 }
 function reuseInferenceRank(state,ranked,input,s,session,rows,action='ai'){
  const view=state.active&&state.ranks.get(ranked);
  if(!view)return api.reuseRank(ranked,input,s,session,rows,action);
  if(!view.valid||
    action!=='ai'||
    view.action!==action||
    view.input!==String(input)||
    view.s!==s||
    view.session!==session||
    view.c.action!==action||
    !sameRows(view.rows,rows))
    return null;
  return {prepared:view.c,rows:view.contextRows,features(row){
    const current=state.active&&state.ranks.get(ranked),bag=current?.valid&&current.bags.get(current.aliases.get(row)||row);
    return bag?{...bag}:null;
  }};
 }
 function beginInference(run){
  const state={active:true,disabled:false,ranks:new WeakMap()},
    scope={rank:(...args)=>rankForInference(state,...args),retain:(...args)=>retainInferenceRank(state,...args),reuse:(...args)=>reuseInferenceRank(state,...args)};
  try{return run(scope);}finally{state.active=false;state.ranks=new WeakMap();}
 }
 const productCues=Object.entries({
  ask:/\b(?:why|explain|understand|reasoning|distinction|mean|causal|conclusion)\b/i,
  practice:/\b(?:quiz|test)\s+me\b|\b(?:practice|drill|mock|self.check)\b|let me (?:try|attempt|solve)|before (?:showing|giving).{0,25}answer|\b(?:practica|pratique)\b/i,
  reading:/\b(?:close[ -]?read|unpack|interpretations?|phrasing|wording)\b|read.{0,35}(?:slowly|closely)|(?:sentence|passage|line|word).{0,45}(?:implies|suggests|changes|support)|\b(?:lectura|lecture attentive)\b/i,
  lab:/\b(?:investigation|experiment|experimental|apparatus|uncertainty|falsifiable|controlled test|controls and measurements)\b|design.{0,45}(?:test|method|measure)|\b(?:experimento|experience controlee)\b/i,
  rubric:/\b(?:rubric|criteria|criterion|markscheme)\b|assess.{0,40}(?:work|argument|evidence)|meet.{0,25}(?:standard|descriptor)/i,
  fixes:/\b(?:revise|revision|rewrite|rephrase|repair|edit|polish|correct|fix)\b.{0,55}\b(?:my|our|draft|paragraph|sentence|claim|answer|explanation|existing)\b|\b(?:my|our|existing)\b.{0,35}\b(?:draft|paragraph)\b.{0,30}\b(?:improve|repair|edit)\b/i,
  notes:/\b(?:notes?|study guide|learning map|speaking cues)\b|\b(?:organise|organize|arrange)\b.{0,50}\b(?:ideas|concepts|evidence|learning)\b/i,
  steps:/\b(?:steps?|sequence|roadmap|milestones?|action plan|reasoning moves|repeatable method|decision process|pasos|paso a paso|etapes|\u00e9tapes)\b|\b(?:walk|guide|take)\b.{0,20}\b(?:me|us)\b.{0,15}\bthrough\b|one.{0,15}at a time|first.{0,30}then|\u6b65\u9aa4|\u987a\u5e8f|\u4e00\u6b65\u4e00\u6b65/i,
  outline:/\b(?:outline|argument map|argument skeleton|structure|thesis|scaffold|esquema)\b|plan.{0,40}(?:sections|report|essay)|\u63d0\u7eb2|\u8bba\u8bc1\u9aa8\u67b6/i,
  message:/\b(?:draft|compose|polite|email|message|reply|respond|wording|tone|followup|courriel|mensaje)\b|\b(?:write|send)\b.{0,35}\b(?:teacher|group|partner|classmate)\b|\u56de\u4fe1|\u90ae\u4ef6/i,
  summary:/\b(?:summari[sz]e|summary|recap|digest|condense|essential facts|main points|resumen|r\u00e9sum\u00e9)\b|boil.{0,25}down|where.{0,30}stands|\u6458\u8981|\u603b\u7ed3/i,
  flashcards:/\b(?:flash[ -]?cards?|retrieval cards?|spaced repetition|tarjetas|fiches)\b|front.{0,30}back|\u95ee\u7b54\u5361|\u8bb0\u5fc6\u5361/i
 });
 function kindFeatures(input,s={},session={},config={},base){
  /* Rebuild opt-in kind features: a public mutable base may contain raw action cues. */
  const kindConfig=kindRequestConfig(config),
    out={...(kindConfig===config&&base||actionFeatures(input,s,session,kindConfig))},
    raw=String(input),
    request=focusedRequest(raw,kindConfig),
    text=request?request.text:raw;
  if(Object.hasOwn(kindConfig,'kindRequestEvidence')){
    if(typeof kindConfig.kindRequestEvidence!=='boolean')throw new TypeError('features.kindRequestEvidence must be a boolean');
    if(kindConfig.kindRequestEvidence&&!optional('ReserveBiscuitIntent','./biscuit-intent.js')?.literalNoteRequest?.(raw)){
      const requested=null?.requestedHelp?.({typed:text});
      if(typeof requested==='string'&&productCues.some(([kind])=>kind===requested))out['requestHelp:'+requested]=1;
    }
  }
  for(const [kind,re]of productCues)if(re.test(text))out['product:'+kind]=1;
  const history=conversationState(raw,s,session,[],kindConfig);
  if(history){
    const StudyKind=null,priorHelp=StudyKind?.requestedHelp?.({typed:history.prior});
    if(priorHelp)out['history:requestedHelp:'+priorHelp]=1;
    for(const [kind,re]of productCues)if(re.test(history.prior))out['history:product:'+kind]=1;
  }
  return out;
 }
 const api={
   words,
   content,
   sourceInput,
   actionFeatures,
   kindFeatures,
   itemFeatures,
   context,
   prepareContext,
   classify,
   score,
   scoreWithHelp,
   rank,
   retainRank,
   reuseRank,
   beginInference
 };
 root.ReserveBiscuitLearn=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
