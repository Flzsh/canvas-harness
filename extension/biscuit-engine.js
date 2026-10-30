/* One local search and judgment path for the Ask line, offers and planning. */
(function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null),
   Registry=load('ReserveBiscuitRegistry','./biscuit-registry.js'),
   Parse=()=>load('ReserveBiscuitParse','./biscuit-parse.js'),
   Clock=()=>load('CanvasHarnessAgentClock','./agent-clock.js');
 const MIN=60000,
   DAY=86400000,
   list=v=>Array.isArray(v)?v:[],
   norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}:]+/gu,' ').trim(),
   stamp=v=>typeof v==='number'?v:Date.parse(v),
   SYN={
     rpt:'report',
     proj:'project',
     assign:'assignment',
     ch:'chapter',
     chap:'chapter',
     qz:'quiz',
     rev:'revision',
     hist:'history',
     econ:'economics',
     psych:'psychology',
     chem:'chemistry',
     bio:'biology',
     calc:'calculus',
     phys:'physics',
     lit:'literature',
     eng:'english',
     apush:'american history',
     hw:'homework',
     tmrw:'tomorrow',
     tmr:'tomorrow',
     pls:'please',
     msg:'message',
     msgs:'messages',
     notif:'notifications',
     notifs:'notifications',
     prefs:'preferences',
     pref:'preferences',
     acct:'account',
     tz:'time zone',
     annc:'announcement',
     anncs:'announcements',
     syllabi:'syllabus',
     instructor:'teacher',
     professor:'teacher',
     scores:'grades',
     score:'grade',
     marks:'grades',
     enable:'on',
     disable:'off',
     launch:'open',
     locate:'find',
     lookup:'find',
     search:'find',
     revise:'review',
     bk:'book',
     foucs:'focus',
     fren:'french',
     pdf:'file',
     docx:'file',
     png:'image',
     csv:'spreadsheet',
     one:'1',
     two:'2',
     three:'3',
     four:'4',
     five:'5',
     six:'6',
     seven:'7',
     eight:'8',
     nine:'9',
     ten:'10',
     animations:'motion',
     animation:'motion'
   };
 const STOP=new Set('a an the my me i you your our please can could would will is are was were be been of to for in on at by from with about some any this these those it that and also then do does did have has need want get give tell show find open know where when what how much doing am as now should all which asks ask actually actual need needs bring up pull too still currently exactly really task work assignment course class file instructions ugh pls plz lol okay ok just kinda like dr mr mrs ms professor prof '.split(' '));
 const tokens=v=>norm(v).split(/\s+/).flatMap(w=>(SYN[w]||w).split(' ')).filter(Boolean),
   content=v=>tokens(v).filter(w=>!STOP.has(w)),
   MUTATE=new Set(['setting','feature','module','note','bookmark','reminder','plan','focus','focus-control','break','move','remove','complete']);
 function distance(a,b){
   if(a===b)return 0;
   if(Math.abs(a.length-b.length)>2)return 3;
   let prev=Array.from({length:b.length+1},(_,i)=>i),before;
   for(let i=1;i<=a.length;i++){
     const row=[i];
     for(let j=1;j<=b.length;j++){
       row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]!==b[j-1]));
       if(before&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],before[j-2]+1);
     }
     before=prev;
     prev=row;
   }
   return prev[b.length];
 }
 const similar=(a,b)=>a===b?1:/\d/.test(a+b)?0:a.length>=3&&b.startsWith(a)?0.8:Math.min(a.length,b.length)>=4&&distance(a,b)<=(Math.max(a.length,b.length)>=8?2:1)?0.7:0;
 function language(input){
   let v=String(input||'').trim();
   for(let i=0;i<3;i++)v=v.replace(/^(?:ugh|pls|plz|please|lol|okay|ok|hey biscuit)[,!: ]+/i,'').replace(/^(?:(?:can|could|would|will)\s+(?:you|u)\s+(?:please\s+)?|(?:i\s+(?:need|want)\s+(?:you\s+)?to\s+)|(?:let's|lets)\s+)/i,'');
   if(!/^(?:note\b|write\s+down\b|(?:add|make|save)\s+(?:a\s+)?note\b)/i.test(v))v=v.replace(/[, ]+(?:pls|plz|please|lol)[.!?]*$/i,'');
   v=v.replace(/^(?:take me to|bring me to|pull up|bring up|look up|look for|locate|fetch)\b/i,'open').replace(/^(?:bump|push|shift|reschedule|postpone|delay)\b/i,'move').replace(/^(?:begin|go|kick off)\b(?!\s+(?:to|home)\b)/i,'start').replace(/^(?:work on)\b/i,'focus on').replace(/^(?:remnd|rember|rember me|reminder)\s*:?\s*/i,'remind ').replace(/^(?:ping|nudge)\s+me\b/i,'remind me').replace(
     /^don['\u2019]t let me forget\b/i,
     'remind me').replace(
     /^do not let me forget\b/i,
     'remind me');
   const pull=/\b(?:pull\s+up|bring\s+up)\s+/i.exec(v);
   if(pull)v='open '+v.slice(pull.index+pull[0].length);
   return v;
 }
 function timeSlots(input,s){
   const t=Parse()?.slots?.(input,s)||{};
   if(Number.isFinite(t.afterAt)){const p=Clock().calendar(s.timeZone)(t.afterAt);t.date=p.day;t.minute=p.minute;t.start=t.afterAt;}
   const m=/\bafter\s+(?:(?:my|the)\s+)?([a-z][a-z -]*?)(?=\s+(?:today|tomorrow|tmrw|at|for|and)\b|[,;.!?]|$)/i.exec(input);
   if(m&&!t.start&&!t.afterAt&&!t.afterEvent&&!/^(?:noon|midnight|\d)/i.test(m[1])){
     const q=content(m[1]),
       event=[...list(s.busy),...list(s.events),...list(s.calendar),...list(s.planner)].filter(v=>
         Number.isFinite(stamp(v.end||v.endsAt))&&stamp(v.end||v.endsAt)>s.now&&(!t.date||Clock().calendar(s.timeZone)(stamp(v.end||v.endsAt)).day===t.date)).find(v=>
         q.length&&q.every(w=>tokens(v.title||v.name||v.label).some(a=>similar(w,a)>0)));
     if(event){const end=stamp(event.end||event.endsAt),p=Clock().calendar(s.timeZone)(end);t.date=p.day;t.minute=p.minute;t.start=end;}else t.unresolvedEvent=m[1];
   }
   return t;
 }
 const timeText=(at,s)=>new Date(at).toLocaleTimeString('en-US',{timeZone:s.timeZone||'America/New_York',hour:'numeric',minute:'2-digit'}),
   dayText=day=>new Date(day+'T12:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short'});
 function create({parse,tier,pack}={}){
  let cached=null,revision=-1,index=[],matchCache=new Map(),learnedSnapshot=null,learnedRevision=-1,learnedRows=[];
  function modelFor(s){
    const selected=s.pet?.knowledge||s.settings?.pet?.knowledge,
      flags=[s.biscuitMoreRules,Array.isArray(s.features)?s.features.find(row=>row?.id==='biscuit-more-rules')?.on:s.features?.['biscuit-more-rules']].filter(value=>typeof value==='boolean'),
      on=flags.includes(true)&&!flags.includes(false),
      choice=tier||(selected?(on?selected:'basic'):null);
    return pack||(choice?load('ReserveBiscuitRules','./biscuit-rules.js')?.get(choice):null);
  }
  function prepareLearned(s){
    if(learnedSnapshot!==s||learnedRevision!==Registry.revision){learnedSnapshot=s;learnedRevision=Registry.revision;learnedRows=Registry.entries(s);}
    return learnedRows;
  }
  function prepare(s){
    if(cached===s&&revision===Registry.revision)return index;
    cached=s;
    revision=Registry.revision;
    matchCache=new Map();
    index=Registry.entries(s).map(v=>{
      const words=content(v.title),initials=words.length>1?words.map(w=>w[0]).join(''):'';
      return {
        ...v,
        ...(v.kind==='grade'?{value:v.score??v.value??v.grade}:{}),
        _title:tokens(v.title),
        _body:tokens(v.text),
        _aliases:tokens(v.aliases+' '+initials),
        _phrase:norm(v.title)
      };
    });
    return index;
  }
  function lexical(word,words){
    const key=word+'|'+words.join(' ');
    if(matchCache.has(key))return matchCache.get(key);
    let value=0;
    for(const w of words){value=Math.max(value,similar(word,w));if(value===1)break;}
    if(matchCache.size<6000)matchCache.set(key,value);
    return value;
  }
  function search(query,s,session={},intent=query,rankingActor='open/find'){
    const model=modelFor(s);
    if(model){
      const Learn=load('ReserveBiscuitLearn','./biscuit-learn.js'),
        Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),
        rows=prepareLearned(s),
        scope=Selection?.positiveText?.(intent)!==String(intent).trim()?Selection?.sourceScope?.(intent,rows,s,session):null,
        excluded=Selection?.sourceExcluder?.(intent,s)||(()=>false),
        candidates=rows.filter(row=>!excluded(row)&&!scope?.excluded?.has(String(row.kind==='course'?row.id:row.courseId))),
        actor=['ai','open/find','navigate','focus','bookmark','complete','plan','reminder','note'].includes(rankingActor)?rankingActor:'open/find',
        featureInput=Learn.sourceInput?.(query,s,session,rows,model.features)||query,
        ranked=Learn.rank(model.models.item,featureInput,candidates,s,session,actor,rows),
        ordered=Selection?.order?.(intent,ranked,s,session,actor)||ranked,
        context=ranked.prepared||Learn.context(featureInput,s,session,rows);
      return ordered.slice(0,3).map(v=>({...v,coverage:Learn.itemFeatures(featureInput,v,s,session,rows,context).coverage}));
    }
    const q=[...new Set(content(query))],
      rows=prepare(s),
      now=stamp(s.now)||Date.now(),
      courseId=String(s.courseId??s.currentCourseId??session.courseId??session.lastCourseId??s.activeCourseId??s.page?.courseId??''),
      pageItem=String(s.itemId??s.selectedItemId??s.page?.itemId??s.lastAction?.itemId??'');
    if(!q.length)return [];
   return rows.map(row=>{
     let score=0,hits=0;
     for(const word of q){
       const title=lexical(word,row._title),body=lexical(word,row._body),alias=lexical(word,row._aliases),best=Math.max(title,body,alias);
       if(best)hits++;
       score+=title*5+body*2+alias*1.4;
     }
     if(!hits)return null;
     score=score*hits/q.length+6*hits/q.length;
     const types={
       file:['file','pdf','reference','spreadsheet','chart','outline','manual','key','rubric','grid','contract','diagram','form','sheet','packet'],
       announcement:['announcement','moved','change','changed','rescheduled'],
       teacher:['teacher','office','hours','teaches','email','contact'],
       grade:['feedback','comment','mark','wrong','grade','grades'],
       note:['notes','questions','saved'],
       assignment:['task','assignment','story','work','homework','project','lab']
     },
       hint=tokens(intent);
     if((types[row.kind]||[]).some(w=>hint.includes(w)))score+=4;
     if(row.kind==='teacher'&&(hint.some(w=>['teacher','teaches','office','available','email','contact'].includes(w))||hint.includes('when')&&hint.some(w=>['ask','meet'].includes(w))))score+=10;
     if(row.kind==='grade'&&/\b(?:marked|mark|say|said|change|feedback|comments?|wrong)\b/i.test(intent))score+=5;
     if(row.kind==='announcement'&&/\b(?:now|changed|moved|actually|holding)\b/i.test(intent))score+=4;
     if(row.kind==='file'&&/\b(?:grid|checklist|chart|template|reference|pdf|spreadsheet)\b/i.test(intent))score+=5;
     if(row.kind==='assignment'&&/\b(?:my task|my assignment|homework|to get)\b/i.test(intent))score+=8;
     if(row.kind==='assignment'&&hint.includes('story'))score+=4;
     if(row.kind==='assignment'&&/\b(?:asks?|homework)\b/i.test(intent))score+=8;
     if(row.kind==='assignment'&&/\b(?:reading|read)\b/i.test(intent)&&/reading|read|chapter/.test(row.workKind+' '+row.title))score+=5;
     if(row.kind==='announcement'&&/\b(?:notice|spares|comes?\s+out)\b/i.test(intent))score+=9;
     if(row.kind==='assignment'&&/\b(?:actual\s+homework|finished|completed)\b/i.test(intent))score+=9;
     if(row.kind==='file'){const ext=/\b(csv|pdf|txt|xlsx|docx|png)\b/i.exec(intent);if(ext&&row.title.toLowerCase().endsWith('.'+ext[1].toLowerCase()))score+=8;}
     if(row.kind==='file'&&/\b(?:pic|picture|labelled|labeled|drying|supply|wires)\b/i.test(intent))score+=7;
     if(row.kind==='note'&&/\b(?:leave\s+myself|wrote|write\s+down|my\s+notes?)\b/i.test(intent))score+=9;
     if(row._phrase===norm(query))score+=10;
     if(row.kind==='course'&&q.every(w=>Math.max(lexical(w,row._title),lexical(w,row._aliases))>=0.7))score+=10;
     for(const w of q)if(/\d/.test(w)&&[...row._title,...row._aliases].includes(w))score+=5;
     if(row.courseId&&row.courseId===courseId)score+=1.7;
     if(row.id===pageItem)score+=1.4;
     if(row.id===String(session.itemId||''))score+=0.5;
     if(row.kind==='course'&&/\b(?:course|class)\b/i.test(intent))score+=5;
     if(row.kind==='assignment'&&/^(?:move|focus|bookmark|save|complete|finished|done)\b/i.test(intent)&&!/\b(?:file|pdf|announcement|message|page)\b/i.test(intent))score+=4;
     const due=stamp(row.dueAt||row.due_at),left=(due-now)/DAY;
     if(!row.done&&Number.isFinite(left)&&left<7)score+=left<0||row.missing?1.5:left<1?1.2:0.4;
     if(row.done||row.completed)score-=1;
     if(tokens(query).includes('homework')&&row.kind==='assignment')score+=2;
     return {...row,score,coverage:hits/q.length};
   }).filter(Boolean).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).filter(v=>v.score>=1.5).slice(0,3).map(({_title,_body,_aliases,_phrase,...v})=>v);
  }
  function card(action,items,fields,message,extra={}){
    return {action,items:items.slice(0,3),message,next:{action,fields:fields||{},label:action==='plan'?'Plan today':action==='ai'?'Ask AI':action==='find'?'Open':'Continue'},...extra};
  }
  function reference(line,s,session={},options={}){
   const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),rows=prepareLearned(s);
   let owned=Selection.reference(line,rows,s,session,options);
   if(!owned.explicit){
     const normalized=language(line).replace(/^(?:done\s+with|finished(?:\s+with)?)\s+(?=(?:it|this|that|same)\b)/i,'open ').replace(/^handed\s+(it|this|that)\s+in\b/i,'open $1');
     if(normalized!==line)owned=Selection.reference(normalized,rows,s,session,options);
   }
   // Preserve legacy pronominal questions through the shared ownership/identity checks.
   if(!owned.explicit){
     const view=load('ReserveBiscuitIntent','./biscuit-intent.js')?.workflowMask?.(owned.text)||owned.text,
       word=/^(?:(?:please|pls)\s+)?(?:what|where|when|how|which|who|is|are|was|were|does|do|did|can|could|would|will|has|have)\b/i.test(view)?/(?:\b(?:is|are|was|were|does|do|did|can|could|would|will|has|have)\s+(?:the\s+)?|\b(?:what|where|when|how)(?:'s|\u2019s)\s+)(it|that|this|same)\b/i.exec(view):null;
     if(word)owned={...Selection.reference('open '+word[1]+'; '+line,rows,s,session,options),explicit:true,text:owned.text};
   }
   const found=owned.explicit?owned.row:null;return {...owned,row:found&&/\b(?:actual|now\s+the).*\b(?:homework|assignment|task)\b/i.test(owned.text)&&found.kind!=='assignment'?null:found};
  }
  function named(line,s,kinds){
    const q=content(line),rows=prepare(s).filter(v=>!kinds||kinds.includes(v.kind));
    return rows.map(v=>{
      const title=v._title.filter(w=>!STOP.has(w)),hits=title.filter(w=>q.some(a=>similar(a,w)>=.7)).length,phrase=norm(line).includes(v._phrase);
      return {row:v,score:phrase?100+title.length:hits>=2?hits*5+hits/Math.max(1,title.length):hits===1&&title.length===1?5:0};
    }).filter(v=>v.score>0).sort((a,b)=>b.score-a.score)[0]?.row;
  }
  function planOrder(line,s,session){
    if(!/\b(?:then|before|and|both)\b/i.test(line))return [];
    const parts=line.split(/\b(?:then|before|and|or)\b/i).slice(0,6),ids=[];
    for(const part of parts){
      const query=part.replace(/\b(?:today|tonight|tomorrow|but|give|can|could|leave|please)\b.*$/i,'').trim();
      if(!content(query).some(w=>!/^\d+$/.test(w)))continue;
      const rows=search(query,s,session),
        course=rows.find(v=>v.kind==='course'&&v.coverage>=.75),
        work=named(query,s,['assignment'])||
          rows.find(v=>
            v.kind==='assignment'&&
              content(query).some(w=>!['plan','study','work','school','minutes','mins','hour','hours','time','order','block','slot','homework','prep'].includes(w)&&tokens(v.title).some(a=>similar(w,a)>=.7)));
      const chosen=work?
        [work]:
        course?prepare(s).filter(v=>v.kind==='assignment'&&v.courseId===course.id&&!v.done&&!v.completed).sort((a,b)=>(stamp(a.dueAt)||Infinity)-(stamp(b.dueAt)||Infinity)):[];
      for(const row of chosen)if(!ids.includes(row.id))ids.push(row.id);
    }
    return ids.length>1?ids:[];
  }
  const planAsk=line=>!/["\u201c\u201d]|^\s*(?:where|how do i (?:find|get to|open))\b/i.test(String(line))&&PLAN_ASK.test(String(line)),PLAN_ASK=/^(?:sched|schd)\b|\b(?:study plan|to my (?:study )?(?:plan|schedule|planner))\b|\b(?:make|find|block|set aside|carve out|save|get)\s+(?:me\s+)?(?:some\s+)?(?:out\s+|off\s+)?(?:study\s+)?time\b|\bwhen (?:should|can|could) i (?:work on|do|start|study|finish|fit)\b|\bfit\b.*\binto my (?:day|week|schedule|evening|weekend)\b|\b(?:plan|schedule)\s+(?:out\s+)?(?:when|time|study time|my study)\b|\bhelp me (?:plan|schedule)\b/i;/* plain asks for study time: "sched calc hw", "add the lab to my study plan", "make time for", "when should i work on" */
  function planning(line){
    return planAsk(line)||
      /(?:^(?:plan|schedule|replan|reschedule)\b|\b(?:make|create|build|need|help|one)\b.*\bplan\b)/i.test(line)&&!/\b(?:feature|setting|widget|module|disable|enable|show|hide)\b/i.test(line)||
      /\b(?:rebuild|reorganize|reorganise|organize|organise|prioriti[sz]e|map\s+out|line\s+up|work\s+backwards)\b/i.test(line)||
      /\b(?:fit|squeeze|split|spread|divide|allocate)\b.*\b(?:work|homework|school|prep|study|tonight|evening|weekend|minutes?|mins?|hour|bits|blocks?|time)\b/i.test(line)||
      /\b(?:study|prep|work|reading)\s+(?:blocks?|slots?|time|order)\b.*\b(?:give|put|move|bump|slide|can|could|need|sort|find|to|from|go|before|after)\b/i.test(line)||
      /\b(?:give|find|put|sort|choose|make)\b.*\b(?:slots?|blocks?|order|catchup\s+evening)\b/i.test(line)||
      /\b(?:have|got|free|available)\b.*\b(?:minutes?|mins?|hours?|\d+m)\b/i.test(line)||
      /\b(?:half\s+on|two\s+(?:goes|small\s+study\s+slots)|both\s+need\s+time|make.*manageable)\b/i.test(line)||
      /\bbreak\b.*\binto\b|\bsqueeze\b.*\bin\b|\b(?:study|edit)\b.*\b(?:bump|block)\b|\b(?:move|bump|shift|slide|push)\b.*\b(?:study|work|reading|edit)\b|\b(?:tonight|evening)\b.*\bsort\b/i.test(line);
  }
  function helpKinds(line,target){
    if(/\b(?:quiz|test)\s+me\b|\bask\s+me\s+(?:some\s+)?questions\b|\b(?:practice\s+(?:questions?|problems?|quiz))\b/i.test(line))return ['practice'];
    if(/\b(?:reading\s+guide|summari[sz]e\s+(?:this|the|my)\s+(?:reading|chapter|text))\b/i.test(line))return ['reading'];
    if(/\b(?:lab|experiment)\s+checklist\b/i.test(line))return ['lab'];
    if(/\b(?:rubric|criteria)\s+(?:checklist|check)|\bcheck\b.*\brubric\b/i.test(line))return ['rubric'];
    if(/\b(?:fix\s+list|teacher.s?\s+(?:feedback|comments?).*(?:apply|improve)|(?:apply|use|act\s+on).*feedback)\b/i.test(line))return ['fixes'];
    if(/\bnotes?\s+(?:outline|structure)\b/i.test(line))return ['notes'];
    if(!/\b(?:help\s+me\s+(?:with|study|understand|prepare)|help\s+(?:with|on)|study\s+help)\b/i.test(line))return [];
    if(target?.kind==='grade')return ['fixes','practice'];
    const kind=target?.workKind||target?.workType||target?.type||'',title=target?.title||'';
    if(/lab|experiment/i.test(kind+' '+title))return ['lab','practice'];
    if(/essay|project|poster|report/i.test(kind+' '+title))return ['rubric','practice'];
    if(/reading|chapter|text/i.test(kind+' '+title))return ['reading','practice'];
    return ['practice','reading'];
  }
  function aiIntent(line){
    const local=/\b(?:what|where|which|when|does|did|do|is|are|can)\b.*\b(?:say|said|asks?|requires?|instructions?|directions?|due|worth|points|teaches|office\s+hours|assigned|allowed|supposed)\b|\b(?:pull\s+up|open|find|show)\b.*\b(?:my|the|saved|marked|feedback|instructions?|files?)\b/i.test(line),novel=/\b(?:invent|made[ -]up|make\s+up|rewrite|rephrase|translate|compose|brainstorm|write|generate|summari[sz]e)\b|\b(?:test|quiz)\s+me\b|\b(?:walk\s+me\s+(?:through|thru)|fresh\s+ideas|new\s+(?:example|question)|explain|why\s+(?:isn.?t|would|can|does|do)|how\s+(?:can|could|would|do)\s+(?:i|we|u|you))\b/i.test(line),explicit=/^\s*(?:\?|ask\s+(?:the\s+)?ai\b)/i.test(line);
    return /^(?:critique|review\s+my\s+draft)\b/i.test(line)||
      /\b(?:teach\s+me|ask\s+me\s+(?:some\s+)?questions|boil\s+(?:this|it|the\s+reading)\s+down|break\s+(?:this|it)\s+down|(?:can.?t|cannot|don.?t)\s+(?:understand|get)|(?:give|want|need)\b.*\bfeedback\s+on|look\s+over\s+my\s+draft)\b/i.test(line)||
      /\b(?:make|generate|create|prepare|build|give|turn)\b.*\b(?:lab\s+checklist|reading\s+guide|rubric\s+checklist|fix\s+list|notes?\s+outline|practice\s+questions?)\b/i.test(line)||
      explicit||
      novel&&!local||
      /^(?:draft|compose)\b/i.test(line)||
      /\b(?:give\s+me|make)\b.*\bpractice\s+(?:paragraph|chat|question|problem)\b|\b(?:how\s+(?:would|could)\s+(?:i|u|you)|como\s+digo)\b|\b(?:help\s+me\s+(?:invent|understand)|tell\s+me\s+how\s+to\s+fix)\b|\bmake\s+(?:this|my)\b.*\b(?:clearer|shorter|less\s+rude|more\s+polite|better)\b/i.test(line);
  }
  function handoff(line,s,session={},suggested,forced,forcedKinds){
    const rows=prepare(s),
      ownText=/\b(?:rewrite|rephrase|translate|make)\s+(?:this|my)\s+(?:caption|sentence|paragraph|counterargument)\b/i.test(line),
      owned=ownText?null:reference(line,s,session),
      anchor=owned?.row,
      canInfer=!ownText&&!owned?.explicit,
      explicit=canInfer?named(line,s,['assignment','file','page','grade','note']):null,
      dataRef=/\b(?:my|our)\s+(?:assignment|lab|trial|draft|reading|feedback|rubric|notes)|\b(?:this|that|open|loaded|assigned)\s+(?:assignment|lab|reading|file|feedback|rubric|material)|\b(?:based\s+on|from\s+(?:the|my))\b/i.test(line),
      novel=/\b(?:new|invent|invented|made[ -]up|fresh|write|draft|compose|rewrite|translate)\b|\bmake\s+up\b|\b(?:like|as\s+if|using)\b|\bgive\s+me\b.*\b(?:possible|ideas|hypotheses|examples|alternatives)\b|\bpractice\s+(?:paragraph|chat)\b|\b\d+\s*(?:percent|%)\b/i.test(line),
      ongoing=/\b(?:my|our|still|keeps|drifts|changed|isn['?]?t\s+working|doesn['?]?t\s+work)\b/i.test(line),
      sources=[];
    let target=forced||(owned?.owner!=='named'||!novel||dataRef?anchor:null)||(canInfer&&(!novel||dataRef)?explicit:null),kinds=helpKinds(line,target||suggested);
   if(!target&&canInfer&&ongoing){
     const q=content(line).filter(w=>w.length>=4&&!['help','explain','understand','example','practice','question','write','simple','tiny','sense','still','zero','makes','there','their'].includes(w)),
       courseId=String(s.activeCourseId||s.courseId||session.lastCourseId||''),
       choices=rows.filter(v=>['assignment','file','page','grade'].includes(v.kind)&&(!courseId||v.courseId===courseId)).map(v=>({row:v,hits:v._title.filter(w=>q.includes(w)).length})).filter(v=>
         v.hits).sort((a,b)=>
         b.hits-a.hits);
     if(choices.length&&(choices.length===1||choices[0].hits>choices[1].hits))target=choices[0].row;
   }
   if(!target&&canInfer&&kinds.includes('fixes')){
     const last=String(session.itemId||session.lastItemId||session.lastResult?.next?.fields?.itemId||''),
       previous=rows.find(v=>v.id===last),
       feedback=previous?.kind==='grade'?previous:rows.find(v=>v.kind==='grade'&&String(v.assignmentId||'')===last);
     if(feedback)
       target=feedback;
     else if(/\b(?:latest|last|returned|came\s+back|just\s+got)\b/i.test(line))
       target=rows.filter(v=>v.kind==='grade'&&(!s.activeCourseId||v.courseId===String(s.activeCourseId))).sort((a,b)=>(stamp(b.gradedAt)||0)-(stamp(a.gradedAt)||0))[0];
   }
   if(!target&&canInfer&&kinds.length&&(s.selectedItemId||s.itemId))target=rows.find(v=>v.id===String(s.selectedItemId||s.itemId));
   kinds=Array.isArray(forcedKinds)?forcedKinds:helpKinds(line,target||suggested);
   if(!target&&canInfer&&kinds.length&&/\b(?:course|class|assigned)\b.*\breading\b|\breading\b.*\b(?:course|class)\b/i.test(line)){
     const course=named(line,s,['course']),courseId=course?.id||s.activeCourseId;
     const readings=rows.filter(v=>v.kind==='assignment'&&v.courseId===String(courseId)&&/reading/.test(v.workKind||v.type||'')&&!v.done);
     if(readings.length===1)target=readings[0];
   }
   if(target){
     let chosen=target;
     if(kinds.includes('fixes')&&target.kind!=='grade'){const feedback=rows.find(v=>v.kind==='grade'&&(v.itemId===target.id||v.assignmentId===target.id));if(feedback)chosen=feedback;}
     const text=chosen.kind==='grade'?
       load('CanvasHarnessContext','./ai-context.js').withoutScores(String(chosen.feedback||chosen.teacherComments||chosen.comments||'')):
       String(chosen.aiText??chosen.text??'');
     sources.push({id:chosen.id,label:chosen.title,text,kind:chosen.kind,courseId:chosen.courseId});
     if(kinds.includes('rubric'))
       for(const v of rows)
         if(v.id!==chosen.id&&String(v.assignmentId||v.parentId||'')===target.id&&/rubric|criteria/i.test(v.title+' '+v.kind))
           sources.push({id:v.id,label:v.title,text:String(v.aiText??v.text??''),kind:v.kind,courseId:v.courseId});
   }
   const Study=load('CanvasHarnessStudy','./study-prompts.js');
   let left=kinds.length?Study.LIMITS.material:100000;
   for(let i=0;i<sources.length;i++){
     const budget=Math.ceil(left/(sources.length-i));
     if(sources[i].text.length>budget){sources[i].text=sources[i].text.slice(0,budget);sources[i].truncated=true;}
     left-=sources[i].text.length;
   }
   const course=list(s.courses).find(v=>String(v.id)===target?.courseId),
     ctx={
       ...(s.now!=null?{now:s.now}:{}),
       ...(s.timeZone?{timeZone:s.timeZone}:{}),
       level:s.level||s.settings?.aiLevel||'high school',
       course:course?.name||'',
       item:target?.title||'',
       wishes:String(line),
       sources
     },
     kind=kinds.length===1?kinds[0]:kinds.length?null:'ask',
     mode=kinds.length===1?'build':kinds.length?'choice':'ask',
     prompt=mode==='build'?Study.build(kind,ctx):mode==='choice'?Study.buildChoice(kinds,ctx):[String(line),...sources.map(v=>'<<<SOURCE: '+v.label+'>>>\n'+v.text+'\n<<<END SOURCE>>>')].join('\n\n');
   return {
     contextIds:sources.map(v=>v.id),
     sources,
     kind,
     kinds,
     mode,
     wishes:String(line),
     prompt,
     course:ctx.course,
     item:ctx.item,
     itemId:target?.assignmentId||target?.id||'',
     courseId:target?.courseId||''
   };
  }
  function understand(input,s,session){
    if(/^(?:open|find|show|set|turn|start|stop|move|bookmark|save|pin|focus|remind)\b/i.test(language(input))&&
      /\s+(?:and(?:\s+then)?|then)\s+(?=(?:open|find|show|set|turn|remind|note|bookmark|plan|start|stop|move)\b)/i.test(input)&&
      Parse()?.local?.(String(input),s)?.[0]?.intent!=='note')
      return null;
    const raw=String(input||'').trim(),
      line=language(raw),
      local=Parse()?.local?.(raw,s)??(/^(?:open|find|show)\b/i.test(line)?null:Parse()?.commands?.(line,s)),
      focusRequest=!local&&!/^every\b/i.test(line)&&/\bfocus\b/i.test(line)&&!/^\s*(?:what|which|how|why|when|where|does|is|are|can\s+i|could\s+i)\b/i.test(line)&&Parse()?.slots?.(line,s)?.minutes>0?
        (Parse()?.parse?.(line,s)||[]).find(v=>v.intent==='focus'):
        null,
      candidate=local?.[0]||focusRequest,
      owned=reference(line,s,session,{actor:candidate?.intent||(planning(line)?'plan':'open/find')}),
      anchor=owned.row;
    if(Array.isArray(local)&&!local.length&&!/\b(?:what|which|where|when|who|does|did)\b/i.test(line))return card('none',[],{},'Choose a valid command value.');
    if(candidate&&candidate.intent!=='note'&&/\b(?:do\s+not|don't|never|not)\s+(?:want\s+to\s+)?(?:move|complete|turn|set|enable|disable|delete|remove|start|stop|plan)\b/i.test(raw))return card('none',[],{},'Your settings are unchanged.');
    if(!candidate&&load('ReserveBiscuitIntent','./biscuit-intent.js')?.choose(raw,s,session,'none',0)==='complete')
      return anchor?.kind==='assignment'?
        card('complete',[anchor],{...anchor.fields,itemId:anchor.id},'Mark '+anchor.title+' done locally.'):
        card('none',[],{},'Choose one loaded work item to mark done locally.');
    if(candidate){
      let fields={...candidate.fields},items=[];
      if(candidate.intent==='focus')
        return load('ReserveBiscuitDetails','./biscuit-details.js').resolve('focus',raw,s,session,prepareLearned(s))||card('none',[],{},'Choose one loaded assignment or course for focus.');
      if(candidate.intent==='bookmark'){
        if(owned.explicit&&(!anchor||!['assignment','file','page'].includes(anchor.kind)))return card('none',[],{},'Choose one loaded assignment, file or page to bookmark.');
        const found=anchor||search(line,s,session,line,candidate.intent).find(v=>['assignment','file','page'].includes(v.kind))||named(line,s,['assignment','file','page']);
        if(found){items=[found];fields={...fields,...found.fields,itemId:found.id};}
      }
      return card(candidate.intent,items,fields,candidate.preview,{candidate,understanding:{step:'understanding',reason:'local-command'}});
    }
   if(/^where\s+(?:is\s+)?(?:biscuit|pet|pony|companion|doggo)\b/i.test(line)&&/\b(?:show|bring\s+back)\b/i.test(line))return card('setting',[],{key:'pet.enabled',value:true},'Show Biscuit on the page.');
   if(/^every\s+/i.test(line)){
     const repeat=line.replace(/^every\s+weekdays\b/i,'every weekday').replace(/^(every\s+\w+)\s+(\d{1,2}:\d{2})/i,'$1 at $2').replace(/,\s*(?=(?:remind|ping|nudge)\b)/i,' ').replace(/\b(?:ping|nudge)\s+(?:me\s+)?/i,'remind me ').replace(/[.;]\s*(?:recurring|repeat)\b.*$/i,''),
       routine=load('ReservePonyAsk','./pony-ask.js')?.parse(repeat,s);
     if(routine?.action==='routine')
       return card(
         'routine',
         [],
         routine.data,
         'Repeat '+
           (routine.data.action==='remind'?routine.data.data.text:routine.data.action==='focus'?'focus for '+routine.data.data.minutes+' min':routine.data.action)+
           ' at '+
           String(Math.floor(routine.data.minute/60)).padStart(2,'0')+
           ':'+
           String(routine.data.minute%60).padStart(2,'0')+
           '.');
   }
   const document=owned.explicit?
     (anchor&&['file','page'].includes(anchor.kind)&&norm(line)===norm(anchor.title)?anchor:null):
     prepare(s).find(v=>['file','page'].includes(v.kind)&&norm(line)===v._phrase);
   if(document)return card('open',[document],document.fields,'Here is '+document.title+'.');
   if(/^(?:enable|disable|activate|deactivate)\b/i.test(line)&&!candidate)return card('none',[],{},'I could not find that feature in this workspace.');
   if(/\b(?:did\s+i\s+leave\s+myself|what\s+did\s+i\s+(?:write|note))\b/i.test(line)){
     const notes=prepare(s).filter(v=>v.kind==='note');
     if(notes.length)return card('open',notes,notes[0].fields,notes[0].title+': '+notes[0].text);
   }
   if((planning(line)||Parse()?.planIntent?.(line,s))&&!/^\s*(?:open|find|show)\b/i.test(line)&&!/(?:take|need)\s+a\s+break\b/i.test(line)){
     if(owned.explicit&&anchor?.kind!=='course')
       return load('ReserveBiscuitDetails','./biscuit-details.js').resolve('plan',raw,s,session,prepareLearned(s))||card('none',[],{},'Choose one loaded source for the plan.');
     const scope=line.replace(/(?:,?\s+not\s+|\brather\s+than\s+|\binstead\s+of\s+).+$/i,''),
       slots=timeSlots(line,s),
       scopedCourse=named(scope,s,['course']),
       firstClause=scope.split(/\b(?:before|then)\b/i)[0],
       priority=/\bfirst\s+(?:sort|plan|schedule|do)\s+(.+)$/i.exec(scope),
       firstTarget=named(firstClause,s,['assignment'])||(priority?search(priority[1],s,session).find(v=>v.kind==='assignment'):null),
       target=anchor||firstTarget||named(scope,{...s,
  workItems:list(s.workItems).filter(v=>!v.done&&!v.completed),assignments:list(s.assignments).filter(v=>!v.done&&!v.completed)},['assignment'])||
  (scopedCourse?
    null:
    search(scope,s,session).find(v=>
      v.kind==='assignment'&&
        !v.done&&
        !v.completed&&
        content(scope).some(w=>
          !['plan','schedule','study','evening','tonight','today','tomorrow','school','work','homework','first','before','after','time','available','minutes','mins','hour','hours','order','stuff','unfinished','early','late','morning','afternoon','packed'].includes(w)&&
            [...tokens(v.title),...tokens(v.aliases).filter(a=>/\d/.test(a)),...tokens(v.text).filter(a=>/\d/.test(a)&&/[a-z]/i.test(a))].some(a=>similar(w,a)>=.7))));
  if(slots.invalid)return card('none',[],{},'Choose a valid planning time.');
  if(slots.unresolvedEvent)return card('none',[],{},'What time does '+slots.unresolvedEvent+' end?');
  const ordered=anchor?[]:planOrder(scope,s,session),
    namedCourse=!target?scopedCourse:null,
    budget=slots.budgetMinutes??(slots.relative===undefined?slots.minutes:undefined),
    fields={
      local:true,
      line,
      ...(ordered.length?{itemId:ordered[0],itemIds:ordered}:target?(target.kind==='course'?{courseId:target.id}:{itemId:target.id}):namedCourse?{courseId:namedCourse.id}:{}),
      ...(slots.date?{date:slots.date}:{}),
      ...(budget?{minutes:budget,...(target&&target.kind!=='course'&&!/\b(?:have|got|free|available|budget|within|up to)\b/i.test(line)?{durationMinutes:budget}: {})}:{}),
      ...(slots.start?{start:slots.start}:{}),
      ...(slots.end?{end:slots.end}:{})
    };
  return card('plan',[],fields,'I will fit the unfinished work into your time.',{understanding:{step:'understanding',reason:'time-allocation'}});
   }
   if(/^(?:open|find|show)\b/i.test(line)&&!/^show\s+(?:me\s+)?(?:why|how)\b/i.test(line))return null;
   if(/^(?:do not|don't|never)\s+(?:invent|write|generate|draft|make|explain)\b/i.test(line))return card('none',[],{},'I will leave that alone.');
   if((s.teacherFeedback===false||s.privacy?.teacherFeedback===false)&&
     (/\b(?:fix\s+list|teacher.s?\s+(?:feedback|comments?))\b/i.test(line)||anchor?.kind==='grade'&&/\b(?:feedback|comments?|fix|improve|explain)\b/i.test(line)))
     return card('none',[],{},'Teacher feedback sharing is off. Turn it on in the AI panel to use those comments.');
   if(aiIntent(line)||/\b(?:apply|use|act\s+on|turn)\b.*\b(?:teacher.s?\s+)?(?:feedback|comments?)\b.*\b(?:fix|steps|improve|change)\b|\b(?:check|review|compare)\b.*\b(?:my|this)\s+draft\b.*\b(?:rubric|criteria)\b/i.test(line)){
     const relevant=search(line,s,session),navigation=relevant.filter(v=>['feature','setting'].includes(v.kind));
     if(navigation.length&&/\b(?:how|what)\b/i.test(line))return card('find',navigation,navigation[0].fields,'Here is '+navigation[0].title+'.',{ai:s.ai===false?null:{action:'ai',fields:{text:raw}}});
     if(/^explain\s+/i.test(line)&&!/\b(?:why|how|difference|versus|using|like|example|invent|simple)\b/i.test(line)&&relevant[0]?.coverage>=.65)
       return card('find',relevant,relevant[0].fields,'These local sources may help.',{ai:s.ai===false?null:{action:'ai',fields:{text:raw}}});
     if(s.ai===false)return card('none',[],{},'Your AI is off.');
     return card('ai',[],{text:raw},'This needs explanation, feedback or new practice.',{understanding:{step:'routing',reason:'generative-help'}});
   }
   const help=/\b(?:help\s+(?:me\s+)?(?:with|understand)|study\s+help)\b/i.test(line);
   if(help&&(anchor||named(line,s,['assignment','file','grade']))&&s.ai!==false)
     return card('ai',[],{text:raw},'Choose the help that fits this material.',{understanding:{step:'routing',reason:'contextual-help'}});
   if(anchor&&!/^(?:move|push|bump|shift|bookmark|save|start|focus|remove|delete|complete)\b/i.test(line)&&(/\b(?:second|middle|third|top|first|last)\s+(?:one|card|result)\b|^(?:the\s+)?(?:first|second|third)\b/i.test(line)||/\b(?:what|which|does|did|say|asks?|instructions?|include|require)\b/i.test(line)&&/\b(?:it|that|this)\b/i.test(line)))
     return card('open',[anchor],anchor.fields,'Here is '+anchor.title+'.');
   const request=/\b(?:open|find|show|set|turn|switch|enable|disable|start|stop|pause|resume|remind|note|bookmark|plan|fit|split|give|make|write|explain|why|what|where|when|which|how|need|want|pull\s+up)\b/i.test(line);
   if(!request&&/^(?:yo\b|buenas\b|kia\s+ora\b|morning+\b|merci\b|aight\b|ngl\b|lol\b|ok\s+legend\b|just\s+needed\s+to\s+complain\b)|\b(?:tiny\s+homework\s+dog|thank\s+you|thanks|cheers|running\s+on.*vibes)\b/i.test(raw))return card('chat',[],{},/\b(?:complain|vibes|tired|toast)\b/i.test(raw)?'That sounds like a long day. I am here when you need a hand.':/\b(?:merci|thanks|legend)\b/i.test(raw)?'You are welcome.':'Hi. I am here.');
   return null;
  }
  function routed(result,input,s,session){
    const route=result.action==='ai'?'ai':'local';
    result.route=route;
    result.routing={
      route,
      score:result.understanding?.reason==='generative-help'?.98:result.action==='none'?.5:.95,
      reason:result.understanding?.reason||(route==='ai'?'generative-help':'workspace-action')
    };
    if(route==='ai'){
      const named=result.understanding?.reason==='named-source',
        data=handoff(String(input),s,session,result.items[0],named?result.items[0]:null,named?result.understanding.helpKinds:null);
      result.handoff=data;
      result.next.fields={...result.next.fields,text:data.prompt,handoff:data};
      result.message=(data.sources.length?data.sources.map(v=>v.label).join(' and ')+': ':'')+
        (data.mode==='build'?'Prepare '+data.kind+' help.':data.mode==='choice'?'Choose between '+data.kinds.join(' and ')+'.':'Ask your question with the selected material.')+
        ' Review what is sent in the AI panel.';
    }
    else if(result.ai){const data=handoff(String(input),s,session,result.items[0]);result.ai.fields={text:data.prompt,handoff:data};}
    return result;
  }
  function evaluateRules(input,s={},session={}){
    const r=understand(input,s,session)||judge(input,s,session);
    if(r.requests)return routed(r,input,s,session);
    const f=r.next.fields,top=r.items[0],q=language(input),zone=s.timeZone||'America/New_York';
    if(r.action==='plan'){const plan=load('ReserveBiscuitPlanner','./biscuit-planner.js')?.build(s,f);if(plan)r.message=plan.message;}
    else if(['find','open','ready','settings'].includes(r.action)&&top){
      const names=r.items.map(v=>v.title),facts=String(top.text||'').replace(/\s+/g,' ').trim(),teacher=/\b(?:who|teacher|teaches|office hours|available)\b/i.test(q);
      if(r.answerKind!=='due'&&!/\bis (?:due|worth|taught by)\b/.test(r.message)&&top.kind!=='setting'){
        if(teacher&&(top.teacher||top.teachers?.length))
          r.message=top.title+' is taught by '+[top.teacher,...list(top.teachers).map(v=>typeof v==='string'?v:v.name)].filter(Boolean).join(', ')+'.';
        else if((top.kind==='grade'||/\?|\boffice\s+hours\b|\b(?:what|which|how|why|when|where|who|is|are|do|does|did|has|have|can|could|see|look|explain|describe|summarize|compare)\b/i.test(q))&&facts){
          const sentences=[...new Set(facts.split(/(?<=[.!?])\s+(?=[A-Z0-9])/u))],
            words=content(q),
            chosen=facts.length<=450?
              facts:
              sentences.map((text,i)=>({text,i,score:words.reduce((n,w)=>n+(content(text).some(a=>similar(w,a)>0)?1:0),0)})).sort((a,b)=>b.score-a.score||a.i-b.i).slice(
                0,
                2).sort((a,b)=>
                a.i-b.i).map(v=>
                v.text).join(' ')||
                facts,
            fact=chosen.length<=450?chosen:chosen.slice(0,447)+'?';
          r.message=top.title+': '+fact.replace(/[.!?]$/,'')+'.';
        }
        else r.message=names.join(' and ')+'.';
      }
    }
    if(top?.kind==='grade'&&/\b(?:what.*get|grade|score|points)\b/i.test(q)&&!/\b(?:feedback|comment|say|said|wrong|change)\b/i.test(q)){
      const value=top.value??top.score??top.grade;
      if(value!==undefined)r.message=top.title+': '+value+((top.possible??top.pointsPossible??top.points)!==undefined?' out of '+(top.possible??top.pointsPossible??top.points):'')+'.';
    }
    if(r.action==='move'&&top)r.message='Move '+top.title+' to '+dayText(f.date)+(f.time?' '+timeText(Clock().wall(f.date,Number(f.time.slice(0,2))*60+Number(f.time.slice(3)),zone),s):'')+'.';
    if(r.action==='reminder')r.message='Remind you '+(f.title||f.text||'to start')+' on '+dayText(f.date)+' at '+timeText(f.at,s)+'.';
    if(r.action==='focus')r.message='Focus'+(top?' on '+top.title:'')+' for '+f.minutes+' min'+(f.breakMinutes?', then break '+f.breakMinutes+' min':'')+'.';
    if(top?.kind==='teacher'&&/\b(?:email|contact)\b/i.test(q)&&top.email)r.message=top.title+': '+top.email+(top.officeHours?'; '+top.officeHours:'')+'.';
    if(top?.kind==='assignment'&&/\bdate\b/i.test(q)&&Number.isFinite(stamp(top.dueAt)))r.message+=' Due '+new Date(stamp(top.dueAt)).toLocaleString('en-US',{timeZone:zone})+'.';
    if(['focus-status','focus-control'].includes(r.action)){
      const focus=s.focus||{},
        left=Number.isFinite(stamp(focus.endsAt))&&stamp(focus.endsAt)>s.now?(stamp(focus.endsAt)-s.now)/MIN:Number.isFinite(focus.remaining)?focus.remaining/60:null;
      if(left!==null)
        r.message=(r.action==='focus-status'?'Focus timer: ':f.action==='adjust'?(f.minutes>0?'Add ':'Remove ')+Math.abs(f.minutes)+' min; ':f.action[0].toUpperCase()+f.action.slice(1)+' focus; ')+
          Math.ceil(left)+
          ' min remaining'+
          (Number.isFinite(stamp(focus.endsAt))?' (ends '+timeText(stamp(focus.endsAt),s)+')':'')+
          '.';
    }
    if(r.action==='bookmark'&&top)r.message='Bookmark '+top.title+'.';
    return routed(r,input,s,session);
  }
  function judge(input,s={},session={}){
   let line=language(String(input||'').trim().slice(0,4096));
   const head=line.split(/\b(?:note|remind|remember|write\s+down)\b/i)[0].replace(/[\u2019\u2018]/g,"'"),
     deny=/\b(?:do\s+not|don't|never|not\s+(?:to\s+)?)(?:\s+(?:want\s+to|let\s+you))?\s*(?:move|complete|turn|set|enable|disable|delete|remove|start|stop|plan)\b/i.test(head)&&!/\b(?:don't|do not)\s+let\s+me\s+forget\b/i.test(line),
     contextClause=/[;.]\s*(?=(?:open|find|show|set|turn|remind|note|bookmark|plan|start|stop|move|push|bump|shift|reschedule)\b)/i.exec(line);
   if(contextClause){
     const left=line.slice(0,contextClause.index),right=line.slice(contextClause.index+contextClause[0].length);
     if(deny||!/^\s*(?:open|find|show|set|turn|remind|note|bookmark|plan|start|stop|move|push|bump|shift|reschedule)\b/i.test(left)){
       const positive=left.replace(/,\s*not\s+.+$/i,''),hint=deny?null:search(positive,s,session)[0],courseId=hint?.kind==='course'?hint.id:hint?.courseId;
       return evaluate(right,courseId?{...s,courseId,activeCourseId:courseId}:s,session);
     }
   }
   if(deny)return card('none',[],{},'Your settings are unchanged.');
   if(/^(?:open|find|show|set|turn|start|stop|move|remove|delete)\b/i.test(line)&&line.includes(';')&&!/;\s*(?:open|find|show|set|turn|remind|note|bookmark|plan|start|stop|move|push|bump|shift)\b/i.test(line))line=line.split(';')[0].trim();
   const negative=/(?:,\s*not\s+|\b(?:rather than|instead of)\s+)(.+)$/i.exec(line);
   if(negative)line=line.slice(0,negative.index).replace(/[,;]\s*$/,'').trim();
   const t=tokens(line),
     set=new Set(t),
     has=(...a)=>a.some(w=>set.has(w)),
     first=t[0],
     slots=timeSlots(line,s),
     previous=list(session.items||session.lastItems||session.results||session.lastResult?.items),
     owned=reference(String(input),s,session),
     pronoun=owned.explicit,
     remembered=owned.row;
   if(!line)return card('none',[],{},'Ask about anything in your workspace.');
   let clauses=/^(?:note\s*:|write down\b|(?:add|make|save)\s+(?:a\s+)?note\b)/i.test(line)?[line]:line.split(/\s*;\s*(?=(?:open|find|show|set|turn|remind|note|bookmark|plan|start|stop|move|push|bump|shift|reschedule)\b)|\s+(?:and then|then)\s+|\s+and\s+(?=(?:open|find|show|set|turn|remind|note|bookmark|plan|start|stop|move|push|bump|shift|reschedule)\b)/i);
   if(clauses.length===1&&/^(?:open|find|show)\s+/i.test(line)&&/\s+and\s+/i.test(line)&&!prepare(s).some(v=>/\band\b/.test(v._phrase)&&norm(line).includes(v._phrase))){
     const head=/^(open|find|show)\s+/i.exec(line),parts=line.slice(head[0].length).split(/\s+and\s+/i);
     if(parts.length===2&&parts.every(v=>content(v).length))clauses=parts.map(v=>head[1]+' '+v.replace(/\b(?:first|after(?:wards)?)\s*$/i,'').trim());
   }
   if(clauses.length>1&&clauses.length<=3){
     const memory={...session},results=[];
     for(const clause of clauses){
       const result=evaluate(clause,s,memory);
       results.push(...(result.requests||[result]));
       if(result.items.length){memory.items=result.items;memory.itemId=result.next.fields.itemId||result.items[0].id;memory.query=clause;}
     }
     return {
       ...results[0],
       message:results.map(v=>v.message).join(' '),
       next:{...results[0].next,action:'batch',fields:{...results[0].next.fields,steps:results.map(v=>({...v.next,message:v.message}))},label:'Do both'},
       requests:results
     };
   }
   if((/^(?:good\s+(?:morning|afternoon|evening|night)|goodbye|see you|what can you do)\b/i.test(line)||['hi','hello','hey','thanks','thank','bye','goodnight'].includes(first)||has('thanks','thank')||has('biscuit')&&has('there'))&&
     (t.length<8||/^what can you do\b/i.test(line)))
     return card('chat',[],{},/^what can you do\b/i.test(line)?'I can find work, plan your time, start focus, save notes, and set reminders.':first==='thanks'||first==='thank'?'You’re welcome.':'Hi. What would help?');
   if(owned.explicit&&!remembered&&!(owned.owner==='named'&&owned.named.length>1&&owned.named.every(row=>norm(row.title)===norm(line))))return card('none',[],{},'Choose one unambiguous loaded source.');
   const indexed=['open','find'].includes(first)&&search(line,s,session).some(v=>['assignment','file','page','announcement','course','note','bookmark'].includes(v.kind)),
     key=indexed?null:Parse()?.commands?.(line,s),
     legacyGoal=has('focus','timer','pomodoro','pomodoros','remind','reminder','remember','ping','forget','plan','schedule')||
       ['study','break','rest'].includes(first)||
       first==='take'&&has('break')||
       ['start','stop','pause','resume','continue','subtract','cut','work','add','extend','reduce','move','put','make','turn','show','hide','set','enable','disable','in','every'].includes(first)||
       /^\d+\s*(?:min|minute|minutes|m|hour|h)\b/i.test(line)||
       has('left')&&has('time','long'),
     legacy=indexed?[]:key??(legacyGoal?(parse||Parse()?.parse)?.(line,s)||[]:[]),
     firstResult=legacy[0],
     precise=firstResult?.intent==='ai'&&has('panel','widget','module')?((parse||Parse()?.parse)?.(line.replace(/\b(?:panel|widget|module)\b/gi,''),s)||[])[0]:firstResult,
     planGoal=has('plan','schedule')&&(['plan','schedule'].includes(t.find(w=>!['please','can','could','would','you','i','want','to','help','me'].includes(w)))||has('make','create','build'))||
       first==='put'&&!!slots.date||
       has('minutes','minute','hour','hours')&&has('have','available')||
       has('free','available')&&has('after')||
       has('what')&&has('do')&&has('now','next'),
     aiNeed=/^\?/.test(line)||
       has('how')&&has('can','could','would')&&!has('time','due','points','grades')||
       /^(?:(?:please|can you|could you|would you)\s+)?(?:explain|write|draft|compose|summarize|translate|describe|compare|generate|brainstorm|suggest|give me\s+(?:\w+\s+)?(?:possible|ideas|hypotheses|examples))\b/i.test(line)||
       has('tell')&&has('about')||
       first==='why'||
       has('ask')&&has('ai');
   if(slots.unresolvedEvent&&(planGoal||first==='move'))return card('none',[],{},'What time does '+slots.unresolvedEvent+' end?');
   if(planGoal){
     const preciseTarget=pronoun?(remembered?.id||session.lastItemId):null,
       query=content(line).filter(w=>
         !['plan','schedule','put','make','day','evening','afternoon','today','tonight','tomorrow','week','weekend','minute','minutes','hour','hours','free','available','after',...['monday','tuesday','wednesday','thursday','friday','saturday','sunday']].includes(w)&&!/^\d+$/.test(w)).join(' '),
       ranked=query?search(query,s,session):[],
       found=preciseTarget?prepare(s).find(v=>v.id===String(preciseTarget)):ranked[0]?.kind==='course'?ranked[0]:ranked.find(v=>v.kind==='assignment'),
       fields={
         local:true,
         line,
         ...(found?found.kind==='course'?{courseId:found.id}:{itemId:found.id}:{}),
         ...(slots.minutes?{minutes:slots.minutes}:{}),
         ...(slots.start?{start:slots.start}:{}),
         ...(slots.date?{date:slots.date}:{})
       };
     return card('plan',[],fields,'I’ll fit a plan into the time you have.');
   }
   const readOnly=/^(?:how|why|when|where|who|what|which)\b/i.test(line);
   if(has('bedtime')&&!readOnly){
     const raw=t.slice(t.indexOf('bedtime')+1).filter(w=>!['to','at','is','set','my'].includes(w)).join(''),m=/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(raw);
     if(m){
       let hour=Number(m[1]),minute=Number(m[2]||0);
       if(minute<60&&hour<24&&(!m[3]||hour>=1&&hour<=12)){
         if(m[3])hour=hour%12+(m[3]==='pm'?12:0);else if(hour<12&&hour>5)hour+=12;
         const value=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
         return card('setting',[],{key:'bedtime',value},'Bedtime '+value+'.');
       }
     }
     return card('none',[],{},'Choose a bedtime, such as bedtime 22:30.');
   }
   if(has('grades')&&has('hide'))return card('setting',[],{key:'showGrades',value:false},'Grades hidden.');
   if(has('feedback','grade','grades','marks','score')&&!/\b(?:no|without|not)\s+grades\b/i.test(line)&&(s.settings?.showGrades===false||s.privacy?.grades===false))
     return card('none',[],{},'Show grades in settings to use them here.');
   if(has('offers')&&has('on','off'))return card('setting',[],{key:'biscuitOffers',value:has('on')},'Biscuit offers '+(has('on')?'on.':'off.'));
   const commandHead=t.find(w=>!['please','pls'].includes(w)),
     preciseHead=['focus','study','concentrate','timer','pomodoro','start','stop','pause','resume','continue','break','rest','remind','reminder','remember','ping','note','subtract','cut','work','add','extend','reduce'].includes(commandHead)||
       /^(?:don't|do not)\s+let\s+me\s+forget\b/i.test(line)||
       has('pomodoro','pomodoros')||
       has('left')&&has('time','long')||
       first==='take'&&has('break')||
       slots.relative!==undefined&&first==='in'||
       /^\d+\s*(?:min|minute|minutes|m|hour|h)\b/i.test(line),
     fast=precise&&
       !['ai','open','due','plan'].includes(precise.intent)&&
       (!['focus','reminder','focus-control','focus-status','bookmark'].includes(precise.intent)||preciseHead&&!pronoun||has('timer')&&has('left')); 
   if(precise?.intent==='reminder'&&slots.invalid)return card('none',[],{},'Choose a valid reminder time.');
   if(preciseHead&&slots.invalid||preciseHead&&slots.minutes!==undefined&&slots.minutes<=0)return card('none',[],{},'Choose a positive duration and a valid time.');
   if(first==='every'){const routine=load('ReservePonyAsk','./pony-ask.js')?.parse(line,s);if(routine?.action==='routine')return card('routine',[],routine.data,routine.label);}
   if(preciseHead&&!precise&&!['move','bookmark'].includes(first))return card('none',[],{},'Choose a valid duration or reminder time.');
   if(fast&&
     !(readOnly&&MUTATE.has(precise.intent))&&
     !(precise.intent==='focus-control'&&
       !has('focus','timer')&&
       content(line).some(w=>!['stop','pause','resume','continue','end','cancel','subtract','cut','add','extend','reduce','minute','minutes','min','mins'].includes(w)&&!/^\d+$/.test(w))))
     return card(precise.intent,[],precise.fields,precise.preview,{candidate:precise});
   const pureReference=pronoun&&
     content(line).filter(w=>
       ![
         'first',
         'second',
         'third',
         '1',
         '2',
         '3',
         'one',
         'card',
         'result',
         'item',
         'page',
         'source',
         'material',
         'document',
         'current',
         'selected',
         'previous',
         'earlier',
         'same',
         'top',
         'middle',
         'last',
         'move',
         'bookmark',
         'save',
         'remove',
         'delete',
         'plan',
         'focus',
         'minutes',
         'minute',
         'min',
         'hour',
         'hours',
         'after',
         'practice',
         'start',
         'done',
         'finished',
         'complete',
         'later',
         'back',
         ...['today','tonight','tomorrow','tmrw','tmr','tn','tonite','monday','tuesday','wednesday','thursday','friday','saturday','sunday','mon','tue','wed','thu','fri','sat','sun']
       ].includes(w)&&
         !/^\d+(?::\d+)?(?:am|pm)?$/.test(w)).length===0;
   let query=line;
   if(pureReference&&remembered)query=remembered.title;
   if(['and','same'].includes(first)&&has('for')&&session.query){
     const oldCourse=prepare(s).find(v=>v.kind==='course'&&v.id===String(previous[0]?.courseId||session.courseId||'')),
       oldWords=new Set(oldCourse?[...oldCourse._title,...oldCourse._aliases]:prepare(s).filter(v=>v.kind==='course').flatMap(v=>v._title)),
       remaining=tokens(session.query).filter(w=>!oldWords.has(w));
     query=remaining.join(' ')+' '+line;
   }
   const queryWords=t.filter(w=>
     !['due','tomorrow','tmrw','tmr','tn','tonite','mon','tue','wed','thu','fri','sat','sun','today','tonight','week','missing','late','homework','teacher','file','files','assignment','assignments','instructions','grades','grade','remind','move','push','shift','bump','reschedule','later','minutes','minute','min','pm','am','remove','delete','bookmark','save','set','turn','on','off','to','friday','monday','tuesday','wednesday','thursday','saturday','sunday'].includes(w)&&
       !STOP.has(w)&&
       !/^\d{1,2}(?::\d{2})?(?:am|pm)$/.test(w)),
     searchLine=query===line?(readOnly?line:queryWords.join(' ')||line):query;
   let items=search(searchLine,s,session,line);
   if(pureReference&&remembered)items=[remembered,...items.filter(v=>v.id!==remembered.id)].slice(0,3);
   const course=prepare(s).filter(v=>v.kind==='course').find(v=>content(line).some(w=>v._title.some(a=>similar(w,a)>0)));
   if((has('due','late')||has('missing')&&/\b(?:missing\s+(?:work|assignments?|homework)|what.*missing|missing$)\b/i.test(line)||has('what','which')&&has('have')&&slots.date)&&
     !aiNeed&&
     !(has('when')&&items[0]?.kind==='assignment'&&queryWords.length)){
     let rows=prepare(s).filter(v=>v.kind==='assignment'&&!v.done&&!v.completed&&(!course||v.courseId===course.id)),
       date=slots.date||(Clock()?.calendar(s.timeZone)(s.now||Date.now()).day);
     if(has('missing','late'))
       rows=rows.filter(v=>v.missing||stamp(v.dueAt)<s.now);
     else if(date)
       rows=rows.filter(v=>{
         const at=stamp(v.dueAt||v.due_at);
         return Number.isFinite(at)&&Clock().calendar(s.timeZone)(at).day>=date&&Clock().calendar(s.timeZone)(at).day<=(slots.endDate||date);
       });
     {/* "what homework is due tomorrow", "which quiz do i have tomorrow": a kind word narrows the list when that kind is there */
       const kindOf=v=>norm((v.workKind||'')+' '+(v.title||'')),
         want=/\b(?:homework|hw|worksheets?)\b/i.test(line)?v=>/homework|\bhw\b|worksheet|problem set|practice/.test(kindOf(v)):/\b(?:quiz|quizzes|tests?|exams?)\b/i.test(line)?v=>/quiz|test|exam/.test(kindOf(v)):null,
         narrowed=want?rows.filter(want):[];
       if(narrowed.length)rows=narrowed;
     }
     rows.sort((a,b)=>stamp(a.dueAt)-stamp(b.dueAt));
     items=rows.slice(0,3);
     const today=Clock().calendar(s.timeZone)(s.now).day,
       when=has('missing','late')?'overdue':date===today?'today':date===new Date(Date.parse(today+'T12:00Z')+DAY).toISOString().slice(0,10)?'tomorrow':dayText(date),
       describe=v=>{
       const c=list(s.courses).find(c=>String(c.id)===v.courseId),at=stamp(v.dueAt||v.due_at);
       return v.title+((c?.name||Number.isFinite(at))?' ('+[c?.name,Number.isFinite(at)?timeText(at,s):''].filter(Boolean).join(', ')+')':'');
     },
     next=prepare(s).filter(v=>v.kind==='assignment'&&!v.done&&!v.completed&&stamp(v.dueAt)>s.now&&(!course||v.courseId===course.id)).sort((a,b)=>
       stamp(a.dueAt)-stamp(b.dueAt))[0],
     message=items.length?
       rows.length+
         ' thing'+
         (rows.length===1?'':'s')+
         ' '+
         (has('missing','late')?'overdue':'due '+when)+
         ': '+
         items.map(describe).join(' and ')+
         (rows.length>items.length?' and '+(rows.length-items.length)+' more':'')+
         '.':
       'Nothing due '+when+'.'+(next?' Next up: '+next.title+' on '+dayText(Clock().calendar(s.timeZone)(stamp(next.dueAt)).day)+'.':'');
     return card('find',items,items[0]?.fields,message,{answerKind:'due',total:rows.length});
   }
   if((has('grade','grades')&&!/\b(?:no|without|not)\s+grades\b/i.test(line)&&!has('feedback','comment','comments','mark','wrong'))||has('how')&&has('doing')){
     if(!(s.showGrades===true||s.settings?.showGrades===true))return card('none',[],{},'Show grades in settings to use them here.');
     const grades=prepare(s).filter(v=>v.kind==='grade'&&(!course||v.courseId===course.id)).slice(0,3);
     if(grades.length)return card('find',grades,grades[0].fields,grades.map(v=>v.title+': '+(v.value??v.grade??v.score??v.text)).join('; '));
   }
   if(preciseHead&&precise?.intent==='focus'){
     const selected=prepare(s).find(v=>v.id===String(precise.fields.itemId||''))||items.find(v=>v.kind==='assignment');
     return card('focus',selected?[selected]:[],{...precise.fields,...(selected?{itemId:selected.id}: {})},precise.preview);
   }
   const target=items[0];
   if(!readOnly&&target?.kind==='setting'&&has('set','on','off')){
     const at=t.lastIndexOf('to'),
       raw=at>=0?t.slice(at+1).join(' '):t.at(-1),
       value=typeof target.value==='boolean'?has('on','true')?true:has('off','false')?false:undefined:typeof target.value==='number'?Number(raw):raw;
     if(value!==undefined&&(!target.values||target.values.includes(value))&&(typeof value!=='number'||Number.isFinite(value)))
       return card('setting',items,{key:target.key||target.id,value},'Set '+target.title+'.');
   }
   const featureTarget=items.find(v=>v.kind==='feature');
   if(!readOnly&&!indexed&&featureTarget&&has('on','off','stop'))return card('feature',items,{id:featureTarget.id,on:has('on')},'Turn '+featureTarget.title+' '+(has('on')?'on.':'off.'));
   if(!readOnly&&items[0]?.kind==='assignment'&&!/\b(?:not|never)\s+(?:done|finished|completed|submitted)\b/i.test(line)&&/^(?:i(?:'m| am| have)?\s+)?(?:done|finished|completed|handed\s+in|submitted)\b|\b(?:is|are)\s+(?:done|finished|complete)\b/i.test(line))
     return card('complete',items,{itemId:items[0].id},'Mark '+items[0].title+' done locally.');
   if(first==='move'&&items[0]&&(slots.date||slots.relative!==undefined||slots.minute!==undefined))
     return card(
       'move',
       items,
       {
         itemId:items[0].id,
         date:slots.date||Clock().calendar(s.timeZone)(slots.relative!==undefined?s.now+slots.relative*MIN:s.now).day,
         ...(slots.minute!==undefined||slots.relative!==undefined?{time:(()=>{
       const m=slots.relative!==undefined?Clock().calendar(s.timeZone)(s.now+slots.relative*MIN).minute:slots.minute;
       return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
     })()}: {})},'Move '+items[0].title+' to '+slots.date+'.');
   if(['remove','delete'].includes(first)&&items[0])return card('remove',items,{itemId:items[0].id},'Remove the local plan for '+items[0].title+'.');
   if(['bookmark','save'].includes(first)&&items[0])return card('bookmark',items,{...items[0].fields,itemId:items[0].itemId||items[0].id},'Bookmark '+items[0].title+'.');
   if(precise?.intent==='reminder'&&(first==='remind'||has('reminder')||slots.relative!==undefined&&first==='in'))return card('reminder',items,precise.fields,precise.preview);
   if(first==='start'&&items.some(v=>v.kind==='assignment')&&!readOnly){
     const work=items.find(v=>v.kind==='assignment');
     return card('focus',[work],{itemId:work.id,minutes:slots.minutes||25,cycles:1,breakMinutes:0},'Focus on '+work.title+'.');
   }
   if(first==='move'&&items[0]&&!slots.date&&slots.relative===undefined&&slots.minute===undefined)return card('none',items,{},'When should I move '+items[0].title+'?');
   if(pronoun&&precise&&preciseHead&&['focus','focus-control'].includes(precise.intent)){
     const work=items.find(v=>v.kind==='assignment');
     return card(precise.intent,work?[work,...items.filter(v=>v!==work)].slice(0,3):items,{...precise.fields,...(work?{itemId:work.id}: {})},precise.preview);
   }
   if(aiNeed){
     const relevant=items.filter(v=>v.coverage>=0.65||['feature','setting'].includes(v.kind)),
       explicit=/^\?/.test(line)||has('ask')&&has('ai'),
       writing=/^(?:write|draft|compose|translate|compare|generate|brainstorm|suggest|give me)\b/i.test(line),
       needsAI=explicit||writing||!relevant.length;
     return card(
       needsAI?(s.ai===false?'none':'ai'):'find',
       needsAI?items:relevant,
       needsAI?{text:line}:relevant[0]?.fields,
       needsAI?(s.ai===false?'Your AI is off.':'This needs writing or explaining.'):'These local sources may help.',
       {ai:s.ai!==false?{action:'ai',fields:{text:line},label:'Ask AI'}:null});
   }
   if(has('on','off')&&!preciseHead&&items[0]?.kind==='course')return card('none',[],{},'Name the feature or setting to change.');
   if(items.length){
     const top=items[0];
     return card(
       top.kind==='feature'?'find':top.action==='open'?'open':top.action,
       items,
       top.fields,
       has('who','teacher','teaches')&&top.kind==='course'&&(top.teacher||list(top.teachers).length)?
         top.title+' is taught by '+[top.teacher,...list(top.teachers).map(v=>typeof v==='string'?v:v.name)].filter(Boolean).join(', ')+'.':
         top.kind==='setting'?
           top.title+' is '+String(top.value)+'.':
           has('when')&&top.dueAt?
             top.title+' is due '+new Date(stamp(top.dueAt)).toLocaleString('en-US',{timeZone:s.timeZone||'America/New_York'})+'.':
             has('points')&&top.points!==undefined?top.title+' is worth '+top.points+' points.':'Here’s '+top.title+'.');
   }
   if(precise&&!['ai','open','focus','reminder','focus-control','focus-status','break'].includes(precise.intent))return card(precise.intent,[],precise.fields,precise.preview);
   return card('none',[],{},'I couldn’t find that in the loaded workspace. Try a course or item name.');
  }
  /* This retrieval-only gate precedes facts/model fallback: a course-alias tie
     must never be broken by active/last course, a title score or a lone file.
     Workflow/payload/control guards run first; explicit source references retain
     their existing owner and resolver. All returned rows come from the registry. */
  function shortCourseRetrieval(input,original,s,session){
   const Language=load('ReserveBiscuitLanguage','./biscuit-language.js');if(!Language?.courseAliasRequest)return null;
   if(!Language.courseAliasRequest(original,s))return null;const rows=prepareLearned(s),scope=Language.courseAliasRequest(original,s,rows);
   const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),owned=Selection?.reference?.(input,rows,s,session,{actor:'open/find'});
   if(owned?.explicit&&(owned.owner!=='named'||owned.named.some(row=>row.kind!=='course'&&norm(row.title)!==norm(scope.noun))))return null;
   const stop=message=>routed(card('none',[],{},message,{understanding:{reason:'course-alias-scope'},courseAlias:scope}),input,s,session);
   const at=stamp(s.now)||Date.now(),due=row=>stamp(row.dueAt||row.due_at),rank=row=>{
     const d=due(row);
     return [row.done||row.completed?1:0,Number.isFinite(d)?(d>=at?0:1):2,Number.isFinite(d)?Math.abs(d-at):0];
   },likeliest=list=>[...list].sort((a,b)=>{const x=rank(a),y=rank(b);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];});
   /* "social studies lab" fits several courses: still no pick, but each course's likeliest match is offered to tap */
   if(scope.status==='ambiguous'){const per=scope.courseIds.map(courseId=>likeliest(Language.courseAliasCandidates({...scope,courseId},rows))[0]).filter(Boolean);
    if(per.length>=2&&per.length<=3)
      return routed(
        card('none',[],{},'Which course do you mean: '+scope.alternatives.map(value=>value.name).join(' or ')+'?',{clarify:true,choices:per,understanding:{reason:'course-alias-scope'},courseAlias:scope}),
        input,
        s,
        session);}
   if(scope.status==='ambiguous')return stop('Which course do you mean: '+scope.alternatives.map(value=>value.name).join(' or ')+'?');
   if(scope.status==='unknown')return stop('Which loaded course do you mean? Name its course or code.');
   let candidates=Language.courseAliasCandidates(scope,rows);
   if(scope.status==='relationship'){
    const targets=new Set(scope.relationshipEvidence.filter(proof=>proof.kind==='work').map(proof=>proof.targetKey));
    if(targets.size)candidates=candidates.filter(row=>targets.has(JSON.stringify([String(row.courseId),row.kind,String(row.id)])));
    /* The existing source/subject/topic owner keeps its input and decision. */
    if(candidates.length===1)return null;
    if(candidates.length>=2&&candidates.length<=3)
      return routed(card('none',candidates,{},'Which '+scope.noun+' in that course do you mean?',{clarify:true,understanding:{reason:'course-alias-scope'},courseAlias:scope}),input,s,session);
   }
   // Several matches ("calc hw") still abstain (no item is picked for the student), but the question comes with the
   // likeliest three to tap: open work first, then the next due, then the latest overdue.
   if(candidates.length>=2){
    const choices=likeliest(candidates).slice(0,3);
    return routed(card('none',[],{},'Which '+scope.noun+' in that course do you mean?',{clarify:true,choices,understanding:{reason:'course-alias-scope'},courseAlias:scope}),input,s,session);
   }
   if(candidates.length!==1)return stop('No matching '+scope.noun+' is loaded for that course.');
   if(scope.status==='exact')return null;
   const row=candidates[0];
   return routed(card('find',[row],{...row.fields,itemId:row.id,courseId:scope.courseId},'Here is '+row.title+'.',{understanding:{reason:'course-alias-scope'},courseAlias:scope}),input,s,session);
  }
  /* Ask, don't guess (round 8). A short line that names no single thing offers its readings as 2 or 3 choices:
     a nickname two loaded courses share ("geo hw" with Geometry and Geography), "quiz?" with several quizzes coming up,
     two things due tomorrow, a bare course or teacher name, "msg from <teacher>" with two threads, a topic that is both
     the homework and the reading. The choices ride in `choices` (the panel lists them when no item is picked); nothing
     is opened or run. A line with one clear reading is left to the usual owners. */
  const OFFER_FILLER=new Set(['pls','please','plz','rn','now','the','my','a','an','any','stuff','things','thing','again','ok','okay','hey','um','uh','lol','pl','thx','thanks','real','quick']),
   OFFER_ASKWORDS=new Set(['open','show','pull','up','get','need','find','see','where','whats','what','is','s','for','in','of','from']),
   OFFER_TITLES=new Set(['mr','mrs','ms','mx','miss','dr','prof','professor','teacher','sr','sra','srta','mme','mlle','m','herr','frau']),
   OFFER_NOUNS=[[/^(?:hw|homework|asgn|assignment|assignments|work|tarea|tareas|devoirs)$/,'homework'],[/^(?:quiz|quizzes|quizes|test|tests|exam|exams|examen)$/,'quiz'],[/^(?:reading|readings|rdg|packet|notes|chapter|handout|reader|lectura)$/,'reading'],[/^(?:syllabus|syl|syllabi)$/,'syllabus'],[/^(?:lab|labs|project|projects|proj|essay|essays|presentation|performance|portfolio|piece|report)$/,'major'],[/^(?:grade|grades|score|scores|mark|marks)$/,'grade'],[/^teacher$/,'teacher'],[/^(?:announcement|announcements|annc|anncs|news)$/,'announcement'],[/^rubric$/,'rubric'],[/^(?:msg|msgs|message|messages|inbox|reply|replies|email|emails|dm|dms)$/,'message'],[/^(?:due|deadline|deadlines|due date|when due)$/,'due']],
   OFFER_DAY=new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'});
  function offerDay(ms,timeZone){
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:timeZone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));}catch{return OFFER_DAY.format(new Date(ms));}
  }
  function shortOffer(original,s,session){
   const raw=String(original).trim();if(!raw||/["'‘’“”`;:]/u.test(raw.replace(/(?<=\w)'(?=\w)/g,'')))return null;
   let words=norm(raw).split(' ').filter(Boolean);if(!words.length||words.length>5)return null;
   const go=/^(?:go|take me|switch|jump|head|bring me)\s+(?:back\s+)?(?:to|into)\s+/i.test(raw);if(go)words=norm(raw.replace(/^(?:go|take me|switch|jump|head|bring me)\s+(?:back\s+)?(?:to|into)\s+/i,'')).split(' ').filter(Boolean);
   words=words.filter(w=>!OFFER_FILLER.has(w));if(!words.length||words.length>4)return null;
   if(session?.lastItemId&&words.some(w=>['it','that','this','its','one'].includes(w)))return null;
   const rows=prepareLearned(s),courses=list(s.courses),Language=load('ReserveBiscuitLanguage','./biscuit-language.js');if(!courses.length||!Language?.courseAliasRequest)return null;
   const now=stamp(s.now)||Date.now(),
     due=row=>stamp(row.dueAt??row.due_at),
     open=row=>row.kind==='assignment'&&Number.isFinite(due(row))&&!row.done&&!row.completed&&!row.submitted,
     soon=(a,b)=>due(a)-due(b);
   const work=row=>norm(row.workKind||row.genre||''),title=row=>' '+norm(row.title||row.name)+' ';
   const nounOf=w=>OFFER_NOUNS.find(([re])=>re.test(w))?.[1]||null;
   const course=id=>courses.find(c=>String(c.id)===String(id)),
     nav=c=>({id:String(c.id),title:'Go to '+(c.name||c.title||'the course'),kind:'tab',action:'navigate',fields:{tab:'course',courseId:String(c.id)}}),
     pick=row=>
       row&&
         ({
           ...row,
           id:String(row.id),
           title:row.title||row.name,
           kind:row.kind,
           action:'open',
           fields:{itemId:String(row.id),...(row.courseId!=null?{courseId:String(row.courseId)}:{})}
         });
   const offer=(choices,message,listed=true)=>{
     const seen=new Set(),list2=choices.filter(Boolean).filter(c=>{
       const k=c.action+':'+(c.fields?.itemId||JSON.stringify(c.fields));
       if(seen.has(k))return false;
       seen.add(k);
       return true;
     }).slice(0,3);
     return list2.length>=2?card('none',listed?list2:[],{},message||'Which one do you mean?',{clarify:true,choices:list2,understanding:{reason:'short-offer'}}):null;
   };
   /* the course a word or two names: the existing alias resolver, kept only when every course it names has the word in its own name */
   const ownName=(c,phrase)=>{
     const n=norm(c.name||c.title||'').split(' '),a=norm(phrase).split(' ');
     return a.every(w=>n.some(v=>v.startsWith(w)&&w.length>=3||v===w))||norm(c.name||'').replace(/ /g,'').startsWith(norm(phrase).replace(/ /g,''));
   },named=phrase=>{const req=Language.courseAliasRequest(phrase+' homework',s,rows);if(!req)return [];const own=c=>ownName(c,phrase);
    if(req.status==='ambiguous'){
      const alts=list(req.alternatives).map(a=>courses.find(c=>String(c.id)===String(a.id??a.courseId))||courses.find(c=>(c.name||c.title)===a.name)).filter(Boolean);
      return alts.length>=2&&alts.every(own)?alts:[];
    }
    const c=req.courseId&&course(req.courseId);return c?[c]:[];};
   const byKind=(c,noun,word='')=>{
     const mine=rows.filter(r=>String(r.courseId)===String(c.id)),typed=list=>{
       const hit=word&&list.filter(r=>work(r)===word||work(r)===word.replace(/s$/,'')||title(r).includes(' '+word+' '));
       return hit&&hit.length?hit:list;
     };
    if(noun==='homework')return mine.filter(r=>r.kind==='assignment'&&/homework|hw/.test(work(r))&&Number.isFinite(due(r))).sort(soon)[0]||mine.filter(open).sort(soon)[0];
    if(noun==='quiz')return typed(mine.filter(r=>(r.kind==='quiz'||r.kind==='assignment'&&/quiz|test|exam/.test(work(r)))&&Number.isFinite(due(r)))).sort(soon)[0];
    if(noun==='reading')
      return mine.find(r=>r.kind==='assignment'&&/reading/.test(work(r)))||
        mine.find(r=>r.kind==='file'&&!/rubric/.test(title(r))&&/ (?:reading|readings|packet|notes|chapter|handout|article|anthology|reader) /.test(title(r)))||
        mine.find(r=>r.kind==='file'&&!/rubric/.test(title(r)));
    if(noun==='syllabus')return mine.find(r=>r.kind==='syllabus');
    if(noun==='major')return typed(mine.filter(r=>r.kind==='assignment'&&Number.isFinite(due(r))&&!/homework|hw|quiz|test|exam/.test(work(r)))).sort(soon)[0];
    if(noun==='grade')return mine.find(r=>r.kind==='grade'&&/grade/.test(title(r)))||mine.find(r=>r.kind==='grade');
    if(noun==='teacher')return mine.find(r=>r.kind==='teacher');
    if(noun==='announcement')return mine.filter(r=>r.kind==='announcement').sort((a,b)=>(stamp(b.postedAt)||0)-(stamp(a.postedAt)||0))[0];
    if(noun==='rubric')return mine.find(r=>r.kind==='file'&&/rubric/.test(title(r)));
    if(noun==='message')return mine.find(r=>r.kind==='message');
    return null;};
   if(words.some(w=>['due','deadline','deadlines'].includes(w)))words=words.filter(w=>!['when','whens','is','date','dates','whats','what','s'].includes(w));
   const nouns=words.map(nounOf),firstNoun=nouns.findIndex(Boolean),rest=words.filter((w,i)=>!nouns[i]),noun=firstNoun>=0?nouns[firstNoun]:null;
   /* due tomorrow: two or three things */
   if(/^(?:(?:what|whats|what's|anything|is anything|stuff|que hay|qué hay)\s+)?(?:due\s+)?(?:tmrw|tmr|tomorrow|tomorow|tmw|para manana|para mañana)(?:\s+due)?$/.test(norm(raw).replace(/\s+(?:pls|please)$/,''))||/^(?:due|whats due|what s due|anything due)\s+(?:tmrw|tmr|tomorrow|tomorow|tmw)$/.test(words.join(' '))||/^(?:tmrw|tomorrow) due$/.test(words.join(' '))){
    const day=offerDay(now+DAY,s.timeZone),list3=rows.filter(r=>open(r)&&offerDay(due(r),s.timeZone)===day).sort(soon);if(list3.length<2||list3.length>3)return null;
    const describe=r=>{
      const c=course(r.courseId);
      return (r.title||r.name)+' ('+[c?.name||c?.title,timeText(due(r),s)].filter(Boolean).join(', ')+')';
    },asked=offer(list3.map(pick),list3.length+' things due tomorrow: '+list3.map(describe).join(' and ')+'. Which one do you want to open?');
    return asked&&{...asked,answerKind:'due',total:list3.length};
   }
   /* teacher name, alone or with a message word */
   const people=words.filter(w=>!OFFER_TITLES.has(w)&&!['from','to','with'].includes(w));if(people.length&&people.length<=2&&!go){
    const msgWord=people.length===2&&nounOf(people[1])==='message'?people[1]:people.length===2&&nounOf(people[0])==='message'?people[0]:null,
      nameWords=msgWord?people.filter(w=>w!==msgWord):people;
    if(msgWord&&msgWord===words[0]&&!words.includes('from'))return null;
    const teachers=courses.filter(c=>{
      const t=norm(c.teacher||c.teacherName||'').split(' ').filter(w=>!OFFER_TITLES.has(w));
      return nameWords.length&&t.length&&(nameWords.length===1?t[t.length-1]===nameWords[0]:nameWords.join(' ')===t.slice(-nameWords.length).join(' '));
    });
    if(teachers.length===1&&(nameWords.length===people.length||msgWord)){const c=teachers[0],mine=rows.filter(r=>String(r.courseId)===String(c.id));
     if(msgWord||words.some(w=>['from','reply','msg','message'].includes(w)))return offer(mine.filter(r=>r.kind==='message').map(pick),'Which message from '+(c.teacher||c.teacherName)+'?');
     return offer([nav(c),pick(mine.find(r=>r.kind==='teacher')),pick(mine.find(r=>r.kind==='message'))],'What about '+(c.teacher||c.teacherName)+'?');}
   }
   /* a kind word alone: several quizzes, several extension requests */
   if(words.length<=2&&!go&&(words.every(w=>nounOf(w)||['which','what','whats','next','upcoming','update','reply','request','requests','extension','extensions','ext'].includes(w)))){
    if(words.some(w=>/^(?:extension|extensions|ext)$/.test(w))){
      const ext=rows.filter(r=>/\bextension\b/.test(title(r))&&r.kind==='message');
      return ext.length>=2&&ext.length<=3?offer(ext.map(pick),'Which extension request?'):null;
    }
    const kindWord=words.find(w=>nounOf(w)==='major');
    if(kindWord&&words.length===1){
      const hits=rows.filter(r=>r.kind==='assignment'&&Number.isFinite(due(r))&&!r.done&&(work(r)===kindWord||title(r).includes(' '+kindWord+' ')));
      return hits.length>=2&&hits.length<=3&&new Set(hits.map(r=>String(r.courseId))).size===hits.length?offer(hits.map(pick),'Which '+kindWord+'?'):null;
    }
    if(noun==='quiz'&&words.length<=2){
      const qs=rows.filter(r=>(r.kind==='quiz'||r.kind==='assignment'&&/quiz/.test(work(r)))&&open(r)&&due(r)>=now).sort(soon);
      return qs.length>=2?offer(qs.map(pick),'Which quiz?'):null;
    }
    return null;}
   /* a course: the longest leading or trailing run of words that names one or more courses */
   let courseWords=null,cs=[],bestRank=-1;
   const runs=[];
   for(let n=Math.min(3,rest.length);n>=1;n--)
     for(const part of [rest.slice(0,n),rest.slice(rest.length-n)]){
       const found=named(part.join(' '));
       if(!found.length)continue;
       runs.push({part,found});
       const rank=(found.every(c=>ownName(c,part.join(' ')))?10:0)+n;
       if(rank>bestRank){bestRank=rank;cs=found;courseWords=part;}
     }
   /* a topic and a course ("integrals calculus", "color theory art"): any split whose topic is in the titles of two or three of the course's items */
   if(!noun&&!go&&rest.length>=2){
     for(const {part,found} of runs){
       if(found.length!==1)continue;
       const c=found[0],aliases=new Set((Language.courseAliases?.(c)||[]).map(norm)),topic=rest.filter(w=>!part.includes(w)&&!aliases.has(w)&&!ownName(c,w));
       if(!topic.length||topic.length>2)continue;
       const has=r=>topic.every(w=>title(r).includes(' '+w+' ')||title(r).includes(' '+w+'s ')),
         hits=rows.filter(r=>String(r.courseId)===String(c.id)&&['assignment','file','page'].includes(r.kind)&&!/rubric/.test(title(r))&&has(r)&&!(r.startAt&&!r.dueAt));
       if(hits.length>=2&&hits.length<=3)return offer(hits.map(pick),'Which '+topic.join(' ')+' item?');
     }
   }
   if(!cs.length){
    if(/^(?:turn\s+)?(?:biscuit|companion|pet)\s+off$/.test(words.join(' ')))
      return offer(
        [
          {id:'setting:pet.enabled:false',title:'Turn the Companion off',kind:'setting',action:'setting',fields:{key:'pet.enabled',value:false}},
          {id:'setting:pet.nudges:off',title:'Turn Biscuit\'s nudges off',kind:'setting',action:'setting',fields:{key:'pet.nudges',value:'off'}}
        ],
        'Turn the Companion off, or only its nudges?');
    if(!noun&&!go&&rest.length&&rest.length<=2){
      const has=r=>rest.every(w=>title(r).includes(' '+w+' ')||work(r)===w),hits=rows.filter(r=>r.kind==='assignment'&&Number.isFinite(due(r))&&has(r));
      if(hits.some(r=>title(r).trim()===rest.join(' ')))return null;
      const inCourses=new Set(hits.map(r=>String(r.courseId)));
      return hits.length>=2&&hits.length<=3&&inCourses.size===hits.length?offer(hits.map(pick),'Which '+rest.join(' ')+'?'):null;
    }
    return null;}
   const topic=rest.filter(w=>!courseWords.includes(w));
   if(cs.length>=2){/* "geo hw", "go to bio": the same thing in each course */
    /* unless the words are one course's plain name ("biology" for Biology 10 beside Marine Biology) */
    const plainName=c=>norm(c.name||c.title||'').split(' ').filter(w=>w&&!/^\d+[a-z]?$/.test(w)&&!['i','ii','iii','iv','honors','hon','h'].includes(w)).join(' ');
    if(noun&&cs.filter(c=>plainName(c)===courseWords.join(' ')).length===1)return null;
    if(topic.some(w=>!OFFER_ASKWORDS.has(w))||topic.length&&!noun)return null;
    if(!noun)return go||words.length===courseWords.length?offer(cs.map(nav),'Which course: '+cs.map(c=>c.name).join(' or ')+'?',false):null;
    if(noun==='due')return null;return offer(cs.map(c=>pick(byKind(c,noun,words[firstNoun]))),'Which course: '+cs.map(c=>c.name).join(' or ')+'?',false);}
   const c=cs[0],mine=rows.filter(r=>String(r.courseId)===String(c.id));
   if(noun==='due'&&!topic.length){const list4=mine.filter(r=>open(r)&&due(r)>=now).sort(soon);return list4.length>=2?offer(list4.map(pick),'Which '+(c.name||'course')+' deadline?'):null;}
   if(noun==='homework'&&!go&&topic.length&&topic.every(w=>OFFER_ASKWORDS.has(w))){
     const hws=mine.filter(r=>open(r)&&/homework|\bhw\b/.test(work(r))).sort(soon);
     if(hws.length>=2&&hws.length<=3)return offer(hws.map(pick),'Which '+(c.name||'course')+' homework?');
   }
   if(!noun&&!topic.length&&!go&&words.length===courseWords.length)return offer([nav(c),pick(byKind(c,'homework'))],'Go to '+(c.name||'the course')+' or open its homework?');
   return null;
  }
  function shortReadingChoice(original,s,session){
   const raw=String(original).trim(),short=raw.split(/\s+/).length<=4;if(!short||/["'\u2018\u2019\u201c\u201d`;:]/u.test(raw))return null;
   const n=norm(raw),note=(session?.lastItemId?/^(?:open|show) (?:my )?notes(?: please| pls)?$/:/^(?:(?:open|show|see|view|check) )?(?:my )?notes(?: please| pls| plz)?$/).test(n),steps=/^(?:show )?steps(?: |$)/.test(n);
   if(!note&&!steps)return null;
   const rows=prepareLearned(s),ask=message=>card('none',[],{},message,{clarify:true,understanding:{reason:'short-reading-choice'}});
   if(note&&rows.some(row=>row.kind==='note'))
     return {
       ...ask('Open a saved note or show the Notes module?'),
       choices:[
         {id:'navigate:notes',title:'Open Notes',kind:'tab',action:'navigate',fields:{tab:'notes'}},
         {id:'module:notes:show',title:'Show the Notes module',kind:'home-module',action:'module',fields:{key:'notes',action:'show'}}
       ]
     };
   if(s.ai===false||!steps)return null;
   const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),scope=Selection?.reference?.(raw,rows,s,session,{actor:'open/find'});let source=scope?.row;
   if(scope?.explicit&&scope.owner==='named')return null;
   if(!source){
     const rest=raw.replace(/^(?:show\s+)?steps\s*/i,'').replace(/\s*(?:pls|please)[.!?]*$/i,''),
       Language=load('ReserveBiscuitLanguage','./biscuit-language.js'),
       course=Language?.courseAliasRequest?.(rest,s,rows),
       candidates=course?.courseId?Language.courseAliasCandidates(course,rows):[];
     if(candidates.length===1)source=candidates[0];
   }
   if(source&&typeof source.instructions==='string'&&source.instructions.trim())return ask('Read the posted instructions or get help working through the steps?');return null;
  }
  function dispatch(input,s={},session={},original=input){
    const Intent=load('ReserveBiscuitIntent','./biscuit-intent.js'),
      Details=load('ReserveBiscuitDetails','./biscuit-details.js'),
      Workflow=load('ReserveBiscuitWorkflow','./biscuit-workflow.js'),
      layout=Workflow.layout(original,s,session),
      guarded=layout.guarded;
    if(layout.result)return layout.reason==='literal-note'?routed(layout.result,input,s,session):layout.result;
    if(layout.mode==='split'){
      const memory={...session},requests=[];
      for(const part of layout.work){const result=evaluate(part.text,s,memory);requests.push(...(result.requests||[result]));Workflow.advance(memory,result);}
      return {
        ...requests[0],
        requests,
        message:requests.map(v=>v.message).join(' '),
        next:{
          ...requests[0].next,
          action:'batch',
          fields:{
            ...requests[0].next.fields,
            steps:requests.map(v=>({...v.next,message:v.message,...(v.ui||v.clarify||v.next?.action==='none'?{manual:true,...(v.ui?{ui:v.ui}:{})}:{})}))
          },
          label:'Review steps'
        }
      };
    }
   const timer=!guarded&&Intent?.timerRequest?.(original,s,session);
   if(timer){const result=Details?.resolve?.(timer.action,timer.text,s,session,prepareLearned(s));if(result)return result;}
   if(!guarded){const choice=shortReadingChoice(original,s,session);if(choice)return routed(choice,input,s,session);}
   if(!guarded){const offered=shortOffer(original,s,session);if(offered)return routed(offered,input,s,session);}
   if(!guarded&&/^\s*(?:(?:open|show|read)\s+)?(?:the\s+)?(?:next|previous|prev)(?:\s+(?:one|result|item|card))?\s*[.!?]*$/i.test(original)){
     const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js'),ref=Selection?.reference?.(original,prepareLearned(s),s,session,{actor:'open/find'});
     if(ref?.owner==='relative'){
       const row=ref.row;
       return routed(
         row?
           card('find',[row],{...row.fields,itemId:row.id,...(row.courseId?{courseId:row.courseId}:{})},'Open '+row.title+'.'):
           card('none',[],{},'Which displayed result should I continue from? There is no proven neighbour in the current list.',{clarify:true}),
         input,
         s,
         session);
     }
   }
   if(!guarded&&String(original).trim().split(/\s+/).length<=6&&/^(?:(?:please|pls)\s+)?(?:remind(?:er)?|ping|nudge)\b/i.test(original)){
     const reminder=Details?.resolve?.('reminder',original,s,session,prepareLearned(s));
     return routed(reminder||card('none',[],{},'What should I remind you about, and when?',{clarify:true}),input,s,session);
   }
   const prefix=Workflow.controlPrefix(original,s,session,guarded);if(prefix)return prefix;const goal=Intent?.requestGoal?.(original)||String(original);
 const knownWord=/^[\p{L}\p{N}-]+[?!.]?$/u.test(String(original).trim())&&prepareLearned(s).some(v=>{
   const words=tokens(v.title+' '+v.text+' '+v.aliases),query=tokens(input);
   return query.length&&query.every(w=>words.includes(w));
 })?norm(original):'';
 const control=load('ReserveBiscuitControls','./biscuit-controls.js')?.propose(original,s,session,{knownCommands:['unfreeze','freeze','continue','break','rest','note','undo','cancel',knownWord]});
 if(control&&!(control.clarify&&(/\u63d0\u9192|\u8bb0\u7b14\u8bb0/u.test(input)||/[;.]\s*(?:please )?(?:open|find|show|plan|save|bookmark|focus)\b/i.test(input))))return control;
 if(!guarded&&!control&&!GREETING_ONLY.test(String(original))){
   const matched=controlMatch(original,s,session);
   if((matched?.strong||matched?.full&&!loadedWord(original,s))&&
     !matched.ambiguous&&
     !titledItem(original,s)&&
     !(session?.lastItemId&&matched.result?.action==='none')&&
     !(matched.result?.action==='module'&&TIMER_VERB.test(norm(original))))
     return matched.result;
 }
 if(!guarded){const scoped=shortCourseRetrieval(input,original,s,session);if(scoped)return scoped;}
 const factScope=!guarded&&
   !/^(?:if|unless|suppose|what if|how do|how can|can i|could i|should i|do not|don.t|dont|never)\b/i.test(goal)&&
   !Intent?.literalNoteRequest?.(original)&&
   !Intent?.negated?.(goal,'setting'),
   fact=factScope&&
     (tokens(input).length<=3||
       /\b(?:next|previous|before this|forward|back one)\b/i.test(input)&&/\b(?:module|lesson|page|item)\b/i.test(input)||
       /\b(?:due|deadline|needs?|must|have to)\b/i.test(input)&&/\b(?:before|by|within|next)\b/i.test(input))&&
     Intent?.choose?.(original,s,session,'open/find',0)!=='ai'?
     load('ReserveBiscuitFacts','./biscuit-facts.js')?.resolve(input,s,session,prepareLearned(s)):
     null;
 if(fact?.relation)return fact;
 if(s.catalogue||s.companion?.name||s.settings?.makeYourOwn){
   const parser=Parse(),catalogue=parser.installed?.(String(input),s),pet=parser.namedPet?.(String(input),s),selected=catalogue?.[0]||pet?.[0];
   if(selected)return routed(card(selected.intent,[],selected.fields,selected.preview),input,s,session);
   if(catalogue!==null&&catalogue!==undefined&&!catalogue.length&&/^(?:use|apply|switch\s+to)\b/i.test(input)&&!parser.commands(String(input),s)?.length)
     return routed(card('none',[],{},'That installed choice is not available. Open Market to inspect your installed items.'),input,s,session);
 }
 const model=modelFor(s);
 if(model){const result=load('ReserveBiscuitInference','./biscuit-inference.js')?.evaluate(input,s,session,model,prepareLearned(s),evaluateRules);if(result)return result;}
 return evaluateRules(input,s,session);
  }
  // shorthand for schoolwork ("calculus hw", "calc ws", "eng proj") reads as the work it names so it matches item titles;
  // chat shorthand (rn, pls, tmrw) is left to the parser, plain English words ("assign", "discuss") stay as typed, and
  // times and punctuation are untouched
  const WORK_WORDS=new Set(['homework','assignment','assignments','project','presentation','quiz','reading','chapter','practice','worksheet','exam','review','syllabus','problem set','problem','problems','lab report']),PLAIN_WORDS=new Set(['assign','discuss','prob']);
  let shorthand={language:null,words:new Map()};
  // "focus 25", "timer 25", "pomodoro 25": a bare count after a timer word is always minutes, never a search for "25".
  const BARE_TIMER=/^\s*(start\s+(?:a\s+)?)?(?:focus|timer|pomodoro|countdown)\s+(?:for\s+)?(\d{1,4})\s*[.!?]*$/i,FOCUS_ON=/^\s*(start\s+(?:a\s+)?)?focus\s+(?:for\s+)?(\d{1,3})\s+(?!(?:min|mins|minutes?|m|h|hr|hrs|hours?|sec|secs|seconds?|x|times|cycles?|rounds?|pomodoros?|blocks?|sessions?|pm|am|percent)\b|[%:.])(\S.*)$/i;
  // "tmrw", "whats due tomorrow", "tmrw hw", "hw due tmrw" all mean the list "due tmrw" gives (they picked one
  // unrelated item before). Bare "today" keeps its own meaning; only "due today" phrasings join it.
  const DUE_TOMORROW=/^\s*(?:(?:what(?:'?s|\s+is)|anything|any)\s+)?(?:(?:hw|homework|assignments?|work)\s+)?(?:due\s+)?(?:for\s+)?(?:tomorrow|tmrw|tmr|tmw|2moro|2morrow)(?:'?s)?(?:\s+(?:hw|homework|assignments?|work))?(?:\s+due)?\s*[.!?]*$/i;
  const FOCUS_WORK=/^\s*(?:(?:i\s+(?:want|need)\s+to|let\s+me|lets|let's)\s+)?(?:start\s+(?:a\s+)?)?focus(?:ing)?\s+(?:on\s+|time\s+(?:for\s+|on\s+)?)?(?:the\s+|my\s+)?((?:[a-z&]+\s+){1,3}(?:hw|homework|lab|essay|quiz|test|exam|project|reading|paper|worksheet|report))(?:\s+(?:now|pls|please|rn))?\s*[.!]*$/i,DUE_TODAY=/^\s*(?:(?:what(?:'?s|\s+is)|anything|any)\s+)?(?:(?:hw|homework|assignments?|work)\s+)?due\s+(?:for\s+)?(?:today|tdy|tonight)\s*[.!?]*$/i;
  function everyday(input){
    if(BARE_TIMER.test(String(input)))return String(input).replace(BARE_TIMER,(m,start,n)=>(start||'')+'focus '+n+' min');
    {/* "focus 25 anatomy hw": a bare number right after focus is minutes */const m=FOCUS_ON.exec(String(input));if(m&&Number(m[2])>=5&&Number(m[2])<=180)input=(m[1]||'')+'focus '+m[2]+' min '+m[3];}
    {const m=FOCUS_WORK.exec(String(input));if(m&&!/\d/.test(m[1]))input='focus 25 min '+m[1];}
    if(DUE_TOMORROW.test(String(input)))return 'due tmrw';
    if(DUE_TODAY.test(String(input)))return 'due today';
    if(load('ReserveBiscuitIntent','./biscuit-intent.js')?.literalNoteRequest(input))return String(input);
    const L=load('ReserveBiscuitLanguage','./biscuit-language.js');
    if(typeof L?.everydayTokens!=='function'||typeof L?.words!=='function')return input;
    if(shorthand.language!==L)shorthand={language:L,words:new Map()};
    return String(input).replace(/"[^"\n]*"|'[^'\n]*'|\u201c[^\u201d\n]*\u201d|\u2018[^\u2019\n]*\u2019|[A-Za-z][A-Za-z0-9/]*(?:[+#]+)?/g,w=>{
      if(!/^[A-Za-z][A-Za-z0-9/]*$/.test(w))return w;
      const low=w.toLowerCase();
      if(low.length>6||PLAIN_WORDS.has(low))return w;
      let out=shorthand.words.get(low);
      if(out===undefined){
        const own=L.words(w),full=own.length===1&&own[0]===low?L.everydayTokens(w).join(' '):'';
        out=full&&full!==low&&WORK_WORDS.has(full)?full:'';
        if(shorthand.words.size<5000)shorthand.words.set(low,out);
      }
      return out||w;
    });
  }
  // Short control wordings ("tint sky", "clock widget off") that the exact templates miss: a strong catalogue match
  // answers early; a weaker one only replaces a reply that did nothing (no action, no question, plain chat).
  /* the loaded control handoff page (a page with a controls list) that lists a UI place; a label slot ("preset: {name}") matches the filled-in label ("preset: Moss Ledger") */
  function handoffPage(path,s){
    if(!Array.isArray(path)||!path.length)return null;
    const fits=(a,b)=>{
      const x=String(a??''),y=norm(b);
      if(norm(x)===y)return true;
      if(!/\{[^}]*\}/.test(x))return false;
      const parts=x.split(/\{[^}]*\}/).map(v=>norm(v));
      let at=0;
      return parts.every((v,i)=>{
        if(!v)return true;
        const k=i===0?(y.startsWith(v)?0:-1):y.indexOf(v,at);
        if(k<0||i===parts.length-1&&v&&!y.endsWith(v))return false;
        at=k+v.length;
        return true;
      })&&y.length>parts.join('').length;
    },same=(a,b)=>Array.isArray(a)&&a.length<=b.length&&a.every((v,i)=>fits(v,b[i])||fits(b[i],v));
    return prepare(s).find(v=>Array.isArray(v.controls)&&v.controls.some(c=>same(c.path,path)||same(path,c.path||[])))||null;
  }
  /* A line that names an installed item ("use Harbor Fog", "Kettle Hum off") or asks to rename, recolour or hide a course opens
     the loaded control handoff page for that control. */
  function uiHandoff(line,s,result){
   if(result?.requests||!['find','open','none','chat'].includes(result?.action)||result?.understanding?.reason==='control-handoff')return null;
   const pages=prepare(s).filter(v=>Array.isArray(v.controls));if(!pages.length)return null;
   const lower=norm(line),has=id=>pages.find(p=>p.controls.some(c=>c.inventoryId===id))||null;
   const owned=list(s.installedItems).filter(v=>v&&v.name&&v.installed!==false).find(v=>(' '+lower+' ').includes(' '+norm(v.name)+' '));
   if(owned){
     const op=/\b(?:remove|uninstall|delete|get rid)\b/.test(lower)?'remove':/\b(?:off|disable|stop using)\b/.test(lower)?'off':/\breset\b/.test(lower)?'reset':/\b(?:use|switch|apply|wear|put on|turn on|enable|try)\b/.test(lower)?'use':null,
       page=op&&has('market:'+String(owned.type).toLowerCase()+':'+op);
     if(page)return page;
   }
   /* a guessed answer yields to a loaded control whose name (two words or more, before any "= value") is all in the line */
   if(['linear-score',undefined].includes(result.understanding?.reason)||result.action==='none'){
     const said=new Set(tokens(line)),named=pages.filter(p=>p.controls.some(c=>{
       const words=tokens(String(c.label||'').split('=')[0]).filter(w=>!STOP.has(w));
       return words.length>=2&&words.every(w=>said.has(w));
     }));
     if(named.length===1)return named[0];
   }
   const field=/\brename\b/.test(lower)?'course-name':/\b(?:colou?r|colou?rs)\b/.test(lower)?'course-color':/\b(?:hide|unhide)\b/.test(lower)?'course-visible':null;
   if(!field||!has('pane-field:'+field))return null;
   const Language=load('ReserveBiscuitLanguage','./biscuit-language.js'),course=Language?.resolveCourses?.(line,s,{},prepare(s));
   return course?.recognized&&course.courseId&&!course.ambiguous?has('pane-field:'+field):null;
  }
  function handoffCard(page,line,s,session){
    return routed(
      card('find',[page],{...(page.fields||{}),itemId:page.id,...(page.courseId?{courseId:page.courseId}:{})},'Open '+page.title+'.',{understanding:{step:'understanding',reason:'control-handoff'}}),
      line,
      s,
      session);
  }
  function controlMatch(line,s,session){
    const Controls=load('ReserveBiscuitControls','./biscuit-controls.js');
    if(typeof Controls?.match!=='function')return null;
    let matched;
    try{matched=Controls.match(line,s,session);}catch{return null;}
   // a loaded control handoff page that lists the matched place is opened instead of naming the path
   const page=handoffPage(matched?.result?.ui?.path,s);if(page)matched={...matched,result:handoffCard(page,line,s,session)};
   return matched;}
  // token sets of loaded rows are computed once per row object (rows are rebuilt when the workspace changes)
  const TITLE_WORDS=new WeakMap(),ROW_WORDS=new WeakMap();
  function titleWords(row){let v=TITLE_WORDS.get(row);if(!v){v=new Set(tokens(row.title));TITLE_WORDS.set(row,v);}return v;}
  function rowWords(row){
    let v=ROW_WORDS.get(row);
    if(!v){v=new Set([...tokens(row.title+' '+row.text+' '+(row.aliases||'')),...norm(row.title+' '+row.text+' '+(row.aliases||'')).split(' ')]);ROW_WORDS.set(row,v);}
    return v;
  }
  function titledItem(line,s){
    const query=content(line).filter(w=>!/^(?:button|btn|setting|settings|widget|tab|on|off)$/.test(w));
    return query.length>0&&prepare(s).some(v=>!['setting','feature','module','course'].includes(v.kind)&&(()=>{const title=titleWords(v);return query.every(w=>title.has(w));})());
  }
  /* a control named in full whose words appear in no loaded record ("gemini", "where claude") is that control */function loadedWord(line,s){
    const words=content(line);
    return !words.length||/^\s*(?:what|whats|what's|when|who|which|is|are|does|do|did|how\s+(?:much|many|long))\b/i.test(String(line))||prepare(s).some(v=>words.some(w=>rowWords(v).has(w)));
  }
  function didNothing(result){return !result||result.action==='chat'||result.action==='none'&&!result.clarify&&!result.ui&&!result.next?.fields?.tab;}
  // Kind words in short requests ("bio grade", "inbox econ", "calloway office hrs") name the record kind; the course
  // comes from its nickname, code or teacher surname. Only a reply that opened a different kind, or did nothing, changes.
  const CUE_KINDS=[['grade',/\b(?:grades?|graded|feedback|scores?|scored|marks|comments?|returned)\b|\bhow am i doing\b|\bhow did i do\b|\bwhat (?:did|do) i get\b|\blo(?:se|st|sing) (?:\w+ ){0,2}points?\b|\bpoints? (?:off|taken)\b/],['message',/\b(?:inbox|msgs?|messages?|messaged|dms?|convo)\b/],['teacher',/\boffice\s+(?:hours?|hrs?)\b/],['announcement',/\b(?:announcements?|anns?|anncs?|announced|news)\b/],['discussion',/\b(?:discussions?|forum|disc|threads?)\b|\b(?:reply|replies|respond|responding)\b(?:\s+\w+){0,3}\s+(?:classmates?|peers?|posts?|others|everyone)\b|\bclassmates?\W*s? posts?\b/],['syllabus',/\b(?:syllabus|late\s+(?:work|policy|penalty|penalties)|late\s+work\s+policy)\b/],['event',/\b(?:review\s+(?:session|sesh|time)s?|study\s+sessions?|events?)\b|\breview\??$/],['file',/\b(?:slides?|ppt|pptx|deck|handouts?|guide)\b/],['announcement',/\b(?:post|posted|posts|update|updates|updated)\b|\b(?:anything|whats|what's) new\b/,'one-course-no-work'],['page',/\bgroups?\b/,'one-course'],['assignment',/\b(?:thing|things|assignments?|asgmt)\b/,'one-course']];
  const FILE_WORDS={ppt:'slides',pptx:'slides',deck:'slides',slide:'slides',lecture:'slides',handouts:'handout'};
  function mentionedCourses(words,s,namesOnly){
    const found=new Map();
    for(const c of list(s.courses)){
      const names=[c.nickname,c.shortName,c.course_code,c.code].filter(Boolean).map(v=>norm(v).split(' ').filter(Boolean)),
        surname=norm(String(c.teacher||c.teacherName||'').split(/\s+/).slice(1).join(' '));
    for(const n of names){
      if(n.length&&n.every(w=>words.includes(w))){found.set(c.id,n);break;}
      const joined=n.join('');
      if(n.length>1&&words.includes(joined)){found.set(c.id,[joined]);break;}
    }
    if(!namesOnly&&!found.has(c.id)&&surname&&surname.length>2){const hit=words.find(w=>w===surname||w===surname+'s');if(hit)found.set(c.id,[hit]);}}
   return found;}
  function kindCue(line,input,s,session,result){
   const words=norm(line).split(' ').filter(Boolean);
   if(!words.length||words.length>10)return null;
   const joined=words.join(' '),cue=CUE_KINDS.find(([,re,need])=>re.test(joined)&&(need!=='one-course-no-work'||!GENRES.some(([g])=>g.test(joined))));
   if(!cue)return null;
   const [kind,re,need]=cue;
   /* "grade my pe essay with the rubric", "give me feedback on my essay": a request to check the student's own work, not their grade */
   if(kind==='grade'&&/^(?:(?:pls|please|can you|could you|can u|help me)\s+)?(?:grade|check|review|mark|score|proofread|edit|look over|go over|give me feedback on|feedback on)\s+(?:my|this|the)\b/.test(joined))return null;
   const top=result?.items?.[0],courses=mentionedCourses(words,s);
   if(['find','open'].includes(result?.action)&&top?.kind===kind&&(!courses.size||courses.has(top.courseId))||
     result?.action&&
       !['find','open','none','chat'].includes(result.action)&&
       !(result.action==='navigate'&&(!result.next?.fields?.tab||result.next.fields.tab==='course'))&&
       !(result.action==='ai'&&kind==='grade'&&!words.some(w=>STUDY_WORDS.has(w)||w==='ai'))||
     result?.action==='none'&&result.clarify&&result.understanding?.reason!=='course-alias-scope')
     return null;
   const keep=kind==='file'||kind==='page';
   if(courses.size>1||(keep||need)&&courses.size!==1)return null;
   const used=new Set([...courses.values()].flat()),
     rest=words.map(w=>kind==='file'?FILE_WORDS[w]||w:w).filter(w=>
       !used.has(w)&&(keep||!re.test(w))&&!STOP.has(w)&&!['office','hours','hrs','hour','left','leave','did','got','new','latest','last'].includes(w));
   const rows=prepare(s).filter(v=>v.kind===kind&&(!courses.size||courses.has(v.courseId)));if(!rows.length||!courses.size&&!rest.length)return null;
   const scored=rows.map((row,i)=>{
     const have=rowWords(row);
     return {row,i,score:rest.filter(w=>have.has(w)).length};
   }).filter(v=>courses.size||v.score>0).sort((a,b)=>b.score-a.score||Number(!!b.row.unread)-Number(!!a.row.unread)||a.i-b.i);
   if(!scored.length||keep&&(!scored[0].score||scored[1]?.score===scored[0].score)||kind==='assignment'&&!scored[0].score)return null;
   const best=scored[0].row;
   return routed(
     card(
       'find',
       scored.slice(0,3).map(v=>v.row),
       {...(best.fields||{}),itemId:best.id,...(best.courseId?{courseId:best.courseId}:{})},
       'Open '+best.title+'.',
       {understanding:{step:'understanding',reason:'kind-cue'}}),
     input,
     s,
     session);
  }
  // A work-type word ("bio test", "calc lab") must agree with the item opened; a test falls back to the course's quiz.
  const GENRES=[[/\b(?:tests?|exams?|midterms?)\b/,/\b(?:test|exam|midterm)\b/i,/\bquiz\b/i],[/\b(?:quiz|quizzes|qz)\b/,/\bquiz\b/i],[/\b(?:labs?|lab\s+(?:report|rpt|writeup))\b/,/\blab\b/i],[/\b(?:essays?|papers?)\b/,/\b(?:essay|paper)\b/i],[/\b(?:projects?|proj)\b/,/\bproject\b/i],[/\b(?:hw|homework|problem\s+set|pset|worksheets?)\b/,/\b(?:problem set|homework|worksheet)\b/i],[/\b(?:reading|rdg|chapter)\b/,/\b(?:reading|chapter)\b/i],[/\b(?:vocab|vocabulary)\b/,/\bvocabulary\b/i]];
  function genreCue(line,input,s,session,result){
   const top=result?.items?.[0];
   if(!['find','open'].includes(result?.action)||!top)return null;
   const text=norm(line),words=text.split(' ').filter(Boolean);
   if(words.length>8)return null;
   const genre=GENRES.find(([re])=>re.test(text));
   if(!genre||top.kind==='assignment'&&genre[1].test(String(top.title||'')))return null;
   const courses=mentionedCourses(words,s),course=courses.size===1?[...courses.keys()][0]:top.kind==='assignment'?top.courseId:null;if(!course||courses.size>1)return null;
   /* a record whose title has the work type and another typed word ("calc project group" -> the group page) stays */
   const named=new Set([...courses.values()].flat()),others=words.filter(w=>!named.has(w)&&!genre[0].test(w)&&!STOP.has(w)&&!WORK_FILLER.has(w)&&!/^\W*$/.test(w));
   if(others.length&&genre[1].test(String(top.title||''))&&others.some(w=>titleWords(top).has(w)))return null;
   const work=prepare(s).filter(v=>v.kind==='assignment'&&v.courseId===course);
   const pick=[genre[1],genre[2]].filter(Boolean).map(re=>work.filter(v=>re.test(String(v.title||''))&&!/\b(?:extra|practice set)\b/i.test(String(v.title||'')))).find(v=>v.length===1)?.[0];
   if(!pick)return null;
   return routed(
     card(
       'find',
       [pick,...list(result.items).filter(v=>v.id!==pick.id)],
       {...(pick.fields||{}),itemId:pick.id,courseId:pick.courseId},
       'Open '+pick.title+'.',
       {understanding:{step:'understanding',reason:'genre-cue'}}),
     input,
     s,
     session);
  }
  // A short line that names one loaded course and one work type ("chem lab", "ush proj rn") opens that course's only
  // item of the type when nothing else answered; with two or three such items it asks which one and offers them, even
  // over a learned pick ("calc hw" with two calc homeworks). An item's own work kind is used when the workspace has it.
  const WORK_FILLER=new Set([
    'report',
    'rpt',
    'writeup',
    'problem',
    'set',
    'unit',
    'open',
    'show',
    'pull',
    'up',
    'find',
    'get',
    'see',
    'my',
    'the',
    'a',
    'pls',
    'please',
    'plz',
    'rn',
    'now',
    'tdy',
    'today',
    'link',
    'where',
    'wheres',
    'is',
    'assignment',
    'asgmt',
    'page',
    'for',
    'in',
    'of',
    'me',
    'again',
    'current',
    'next',
    'new',
    'thing',
    'due',
    'when',
    'whens',
    'worth',
    'pts',
    'points',
    'point',
    'value',
    'tries',
    'attempts',
    'attempt',
    'retakes',
    'retake',
    'left',
    'deadline',
    'date',
    'time',
    'how',
    'many',
    'much',
    'out'
  ]);
  const GENERIC_WORK=/^(?:stuff|things|work|assignments?|asgns?|tasks|todo)$/;
  const GENRE_KINDS=[['test','exam','midterm'],['quiz'],['lab'],['essay','paper'],['project','proj'],['homework','hw','problem set','pset','worksheet'],['reading','rdg','chapter'],['vocabulary','vocab']];
  function courseWork(line,input,s,session,result){
   /* a bare course and work type with no help word ("my calc essay") is a lookup even when the reply went to AI */
   const nothing=didNothing(result),
     text=norm(line),
     words=text.split(' ').filter(Boolean),
     fromAI=result?.action==='ai'&&!session?.lastItemId&&!words.some(w=>STUDY_WORDS.has(w)||w==='ai');
   if(!nothing&&!fromAI&&!(['find','open'].includes(result?.action)&&!result.clarify))return null;
   if(!words.length||words.length>(nothing?6:4))return null;/* "quiz me phys" asks to be quizzed, not for the quiz */
   if(fromAI&&/\b(?:quiz|test|drill|grill)\s+me\b/.test(text))return null;
   const g=GENRES.findIndex(([re])=>re.test(text)),generic=g<0&&words.some(w=>GENERIC_WORK.test(w));
   if(g<0&&!generic)return null;
   const genre=g<0?[GENERIC_WORK]:GENRES[g];
   const courses=mentionedCourses(words,s,true);
   if(courses.size!==1)return null;
   const [course,alias]=[...courses.entries()][0],used=new Set(alias),raw=String(line).toLowerCase().split(/[^\p{L}\p{N}]+/u);
   /* the course must be named exactly as typed (no accent folding, no teacher name), as for other course aliases */
   if(!alias.every(w=>raw.includes(w))||words.some(w=>!used.has(w)&&!genre[0].test(w)&&!WORK_FILLER.has(w)&&!/^\W*$/.test(w)))return null;
   const work=prepare(s).filter(v=>v.kind==='assignment'&&String(v.courseId)===String(course)&&!v.local&&!(v.itemId&&String(v.itemId)!==String(v.id)));
   const typed=(v,k)=>{
     const own=[v.workKind,v.genre].filter(Boolean).map(x=>norm(x));
     return own.length?own.some(x=>GENRE_KINDS[k].includes(x)):(k===g?genre[1]:genre[2])?.test(String(v.title||''));
   };
   /* a generic word ("bio stuff") means any open work of the course */
   const found=generic?
     work.filter(v=>!v.done&&!v.completed&&!v.submitted):
     [g,g===0?1:-1].filter(k=>k>=0).map(k=>work.filter(v=>typed(v,k)&&(k===g||!/\b(?:extra|practice set)\b/i.test(String(v.title||''))))).find(v=>v.length);
   if(!found?.length)return null;
   if(found.length===1){
     if(!nothing&&!fromAI)return null;
     const pick=found[0];
     return routed(card('find',[pick],{...(pick.fields||{}),itemId:pick.id,courseId:pick.courseId},'Open '+pick.title+'.',{understanding:{step:'understanding',reason:'course-work'}}),input,s,session);
   }
   if(found.length>3&&!generic)return null;
   const at=stamp(s.now)||Date.now(),due=v=>stamp(v.dueAt||v.due_at),rank=v=>{
     const d=due(v);
     return [v.done||v.completed?1:0,Number.isFinite(d)?(d>=at?0:1):2,Number.isFinite(d)?Math.abs(d-at):0];
   };
   const choices=[...found].sort((a,b)=>{const x=rank(a),y=rank(b);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];}).slice(0,3);
   return routed(card('none',choices,{},'Which one in that course do you mean?',{clarify:true,choices,understanding:{step:'understanding',reason:'course-work'}}),input,s,session);
  }
  // A reply that found nothing gets one more local look: a loaded page or item whose title holds every word of the
  // request (plural or singular), when exactly one item does ("change pronouns", "notifs", "cloud files").
  const LOOK_VERBS=new Set(['change','edit','update','set','open','where','see','show','go','fix','turn','off','on','link','page','settings','setting','option','options']);
  // A lookup whose first item's title misses some of those words also yields to the one loaded title that has them all.
  function lookup(line,input,s,session,result){
   const stem=w=>w.length>4&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w,query=[...new Set(content(line).filter(w=>!LOOK_VERBS.has(w)).map(stem))];
   if(!query.length||query.length>4)return null;
   /* words naming the course of the item found count as found; a reply chosen by a kind, work-type or plan cue stays */
   const named=mentionedCourses(norm(line).split(' ').filter(Boolean),s),
     top=result?.items?.[0],
     ofCourse=new Set(top&&named.has(top.courseId)?[...named.get(top.courseId),...content(named.get(top.courseId).join(' '))].map(stem):[]);
   const looked=['find','open'].includes(result?.action)&&
     !result.clarify&&
     !result.ui&&
     top&&
     !['setting','feature','module','tab','home-module','action'].includes(top.kind)&&
     !['course-work','genre-cue','kind-cue','plan-cue'].includes(result.understanding?.reason)&&
     !query.every(w=>ofCourse.has(w)||new Set([...titleWords(top)].map(stem)).has(w));
   if(!result||!looked&&(result.action!=='none'&&result.action!=='chat'||result.ui||list(result.items).length||result.clarify&&result.understanding?.reason!=='control-proposal'))return null;
   const text=norm(line);
   if(/\b(?:this|that|these|those|it)\b/.test(text))return null;
   const hits=prepare(s).filter(v=>!['setting','feature','module','course','tab','home-module','action'].includes(v.kind)).map(v=>{
     const title=new Set([...titleWords(v)].map(stem));
     return {v,all:query.every(w=>title.has(w)),title:query.filter(w=>title.has(w)).length};
   }).filter(h=>h.all).sort((a,b)=>b.title-a.title);
   if(!hits.length||hits.length>1&&hits[1].title===hits[0].title)return null;const row=hits[0].v;
   return routed(
     card('find',[row],{...(row.fields||{}),itemId:row.id,...(row.courseId?{courseId:row.courseId}:{})},'Open '+row.title+'.',{understanding:{step:'understanding',reason:'loaded-title-lookup'}}),
     input,
     s,
     session);
  }
  // Feelings, concept questions and "<item> help" are AI asks grounded on the item the rest of the line names
  // ("stressed calc test" -> the calc test; "explain gene expression" -> work about gene expression).
  const AFFECT=/^(?:i\s*(?:'?m|am)\s+)?(?:so\s+|really\s+|kinda\s+|super\s+)?(?:(?:stressed|stressing|anxious|nervous|worried|scared|panicking|freaking\s+out|overwhelmed|dreading)(?:\s+(?:about|for|over|on))?|(?:i\s+)?feel(?:ing)?\s+(?:so\s+)?(?:lost|stressed|anxious|nervous|worried|scared|overwhelmed|bad)(?:\s+(?:about|for|on|in|with))?)\s+(.+)$|^(.+?)\s+(?:anxiety|stress|panic)$/i;
  const CONCEPT=/^(?:(?:(?:can\s+you\s+)?explain(?:\s+to\s+me)?|(?:i\s+)?(?:still\s+)?(?:dont|don't|do\s+not)\s+(?:get|understand)|confused\s+(?:about|by))\s+(?:the\s+)?(.+?)(?:\s+at\s+all)?|what\s+does\s+(?:the\s+)?(.+?)\s+(?:even\s+)?mean(?:\s+(?:for|in)\s+(.+?))?)\s*[?.!]*$/i;
  const HELPED=/^(?:(?:pls|please)\s+)?(?:help\s+(?:me\s+)?(?:with\s+|understand\s+|write\s+up\s+|read\s+)?|confused\s+(?:about\s+|on\s+)?)?(?:the\s+|my\s+)?(.+?)\s+help\s*[?.!]*$|^(?:(?:pls|please|can\s+you)\s+)?help\s+(?:me\s+)?(?:with\s+|understand\s+|write\s+up\s+|read(?:ing)?\s+|on\s+)(?:the\s+|my\s+)?(.+?)\s*[?.!]*$/i;
  const GROUNDS=new Set(['assignment','file','page','announcement','message','discussion','grade','syllabus','canvas-module']);
  // Study-help verbs ("fix my lit essay", "outline stats essay", "notes span rdg", "help me write a message to ravel")
  // ask AI about the work item the rest of the line names; without a work-type or message word they change nothing.
  const STUDY_WORDS=new Set(['help','fix','outline','summarize','summarise','summary','sum','flashcards','flashcard','practice','notes','steps','step','walk','draft','proofread','explain','understand','confused','stuck']),
    STUDY_FRAME=new Set(['me','my','the','a','an','some','problems','questions','into','through','against','up','by','can','you','could','give','make','turn','of','for','to','what','should','i','in','on','with','write','pls','please','check','go','over','am','im','about','is','and','bit','little','dont','get','do','not','still','at','all','even','really','so','quiz','question','set']);
  /* "just tell me the answer to number 4", "can you just tell me which one it is" (mid-quiz): Biscuit does not hand over answers to graded work */
  const ANSWER_ASK=/\b(?:tell|give|send|show)\s+me\s+(?:the\s+|all\s+the\s+)?(?:answers?|solutions?)\s+(?:to|for|on|of)\b|\b(?:tell|give)\s+me\s+which\s+(?:one|answer|option|choice|letter)(?:\s+it\s+is|\s+is\s+(?:right|correct))?\b|\bwhat(?:'s|s|\s+is)\s+the\s+answer\s+(?:to|for|on)\b|\b(?:do|finish|take)\s+(?:my|the)\s+(?:quiz|test|exam)\s+for\s+me\b/i,
   namedCourse=(line,s,session)=>{
     const said=load('ReserveBiscuitLanguage','./biscuit-language.js')?.resolveCourses?.(line,s,session,prepare(s)),chosen=list(said?.matches).find(m=>String(m.id??m.courseId)===String(said?.courseId));
     return !!(said?.recognized&&chosen&&(chosen.nameExact||chosen.abbreviation||chosen.nameMatch>=.5||chosen.subject));
   },
   answerAsk=line=>ANSWER_ASK.test(line)&&/\b(?:quiz|test|exam|number|question|q\d+|problem|homework|hw|worksheet)\b|#\s*\d/i.test(line)&&!/\b(?:practice|study\s+guide|review|key|example|sample)\b/i.test(line);
  /* "this week sucks", "i feel nervous for test tomorrow": a feeling with no course named and no request is small talk; a feeling about a
     named course's test ("nervous about the econ test") keeps its study help */
  const FEELING=/\b(?:i\s+feel|i'?m\s+feeling|feeling\s+(?:so\s+|really\s+)?(?:stressed|overwhelmed|anxious|nervous|down|sad|lost|tired|behind)|i(?:'m|\s+am|m)\s+(?:so\s+|really\s+|honestly\s+|kinda\s+|super\s+|just\s+)*(?:stressed|overwhelmed|anxious|nervous|tired|exhausted|sad|burn(?:ed|t)\s+out|scared|worried|freaking\s+out|done\s+with\s+(?:today|this\s+week))|(?:this|today|my)\s+(?:week|day|semester|term|morning|night)\s+(?:sucks|is\s+(?:awful|terrible|rough|bad|the\s+worst|so\s+bad))|so\s+much\s+stress)\b/i,
   FEELING_ASK=/\b(?:help|plan|make|quiz|study|explain|open|show|find|remind|focus|start|timer|what|when|where|which|how\s+(?:do|can|should)|can\s+you|could\s+you|tell\s+me)\b/i;
  /* While a focus timer runs: "kill the timer" stops it, "put 5 minutes more in timer" adds time, and "ok im back keep going" resumes a paused one */
  function timerCue(line,s,result){
   const f=s.focus;
   if(!f||!f.running||f.completed||result?.requests||result?.action==='focus-control')return null;
   const l=norm(line),
     timer=/\b(?:timer|focus|pomodoro|clock)\b/.test(l),
     mins=/\b(\d{1,3})\s*(?:more\s+)?(?:min|mins|minutes?)\b/.exec(l),
     fc=(fields,message)=>routed(card('focus-control',[],fields,message,{understanding:{step:'understanding',reason:'timer-cue'}}),line,s,{});
   if(/\b(?:dont|don t|do not|never|not)\b/.test(l))return null;
   if(timer&&/\b(?:kill|stop|end|cancel|quit|scrap|ditch|shut off|turn off)\b/.test(l))return fc({action:'stop',discardRemaining:true,markAssignmentComplete:false},'Stop the focus timer.');
   if(mins&&/\b(?:more|extra|add|another)\b/.test(l)&&(timer||/\bmore\b/.test(l))&&!/\b(?:less|fewer|subtract|remove|shorten|cut)\b/.test(l))
     return fc({action:'adjust',minutes:Number(mins[1]),...(Number.isFinite(f.remainingMinutes)?{remainingMinutes:f.remainingMinutes+Number(mins[1])}:{})},'Add '+mins[1]+' min to the focus timer.');
   if(f.paused&&/\b(?:i m back|im back|back now|keep going|continue|resume|carry on|unpause|lets go|let s go|ready again)\b/.test(l))
     return fc({action:'resume',...(Number.isFinite(f.remainingMinutes)?{remainingMinutes:f.remainingMinutes}:{})},'Resume the focus timer.');
   return null;
  }
  const NEVER_MIND=/^\s*(?:ok(?:ay)?\s+)?(?:never\s*mind|nvm|forget\s+(?:it|that)|cancel\s+that|scratch\s+that|ignore\s+that)[\s.!]*$/i;
  const GREETING_ONLY=/^\s*(?:hey+|hi+|hello|hiya|heya|yo|sup|howdy|good\s+(?:morning|afternoon|evening))(?:\s+(?:there|biscuit|buddy|friend|pal))?\s*[!.?]*\s*$/i;
  const TIMER_VERB=/\b(?:start|stop|pause|resume|unpause|end|kill|quit|cancel|skip|restart)\b.*\b(?:timer|focus|pomodoro|pomo)\b|\b(?:timer|focus|pomodoro|pomo)\b.*\b(?:start|stop|pause|resume|unpause|end|kill|quit|cancel|skip|restart)\b/;
  const WORK_WORD=/\b(?:hw|homework|essay|essays|lab|labs|quiz|test|exam|reading|rdg|project|proj|problem set|worksheet|msg|message|email)\b/;
  // The work a help request names, resolved from the loaded rows without a second full pass: a course (nickname, code
  // or teacher surname) with a work-type or message word, or topic words that appear in work titles.
  function groundedItems(rest,s){
   const words=norm(rest).split(' ').filter(Boolean),
     courses=mentionedCourses(words,s),
     used=new Set([...courses.values()].flat()),
     text=words.join(' '),
     genre=GENRES.find(([re])=>re.test(text)),
     rows=prepare(s),
     own=v=>!courses.size||courses.has(v.courseId),
     extra=v=>/\b(?:extra|practice set)\b/i.test(String(v.title||''));
   if(courses.size>1)return [];
   if(/\b(?:msg|message|messages|email|dm)\b/.test(text)&&courses.size){
     const msgs=rows.filter(v=>v.kind==='message'&&own(v)).sort((a,b)=>Number(!!b.unread)-Number(!!a.unread));
     if(msgs.length)return msgs.slice(0,3);
   }
   const topic=words.filter(w=>!used.has(w)&&!STOP.has(w)&&!GENRES.some(([re])=>re.test(w))&&!/^(?:hw|homework|work|stuff|help|notes?|class)$/.test(w)),
     work=rows.filter(v=>v.kind==='assignment'&&own(v)&&!extra(v)&&(!topic.length||topic.every(w=>tokens(w).every(x=>titleWords(v).has(x)))));
   if(!courses.size&&!topic.length)return [];
   if(genre){
     for(const re of [genre[1],genre[2]].filter(Boolean)){
       const hit=work.filter(v=>re.test(String(v.title||'')));
       if(hit.length===1||hit.length&&topic.length)return hit.slice(0,3);
       if(hit.length>1)return [];
     }
     if(courses.size&&/reading|rdg|chapter/.test(text)){const read=rows.filter(v=>v.kind==='file'&&own(v)&&/reading|chapter/i.test(String(v.title||'')));if(read.length===1)return read;}
     return [];
   }
   return topic.length?work.slice(0,3):[];
  }
  function aiGround(line,input,s,session,result){
   if(result?.clarify||result?.action&&!['find','open','none','chat','ai'].includes(result.action))return null;
   const text=String(line).trim(),lower=norm(text),affect=AFFECT.exec(text);
   let concept=!affect&&CONCEPT.exec(text);
   const tokensOf=norm(text).split(' ').filter(Boolean),
     studied=!affect&&(tokensOf.some(w=>STUDY_WORDS.has(w))||/\bquiz\s+me\b|\bwrite\s+up\b|\bwrite\s+(?:a\s+)?(?:message|msg|email)\b|\bcheck\b.*\b(?:against|with)\s+(?:the\s+)?rubric\b|\brubric\s+check\b/.test(lower));
   let rest;
   if(affect)rest=affect[1]||affect[2];
   else if(studied&&WORK_WORD.test(lower)){concept=null;rest=tokensOf.filter(w=>!STUDY_WORDS.has(w)&&!STUDY_FRAME.has(w)&&w!=='rubric'&&w!=='against'||/^(?:quiz|msg|message)$/.test(w)).join(' ');}
   else if(concept)rest=[concept[1]||concept[2],concept[3]].filter(Boolean).join(' ');
   else{const helped=HELPED.exec(text);if(!helped)return null;rest=helped[1]||helped[2];}
   rest=String(rest||'').replace(/\b(?:even|for|in|about|the|my|class|to\s+me)\b/gi,' ').replace(/\s+/g,' ').trim();
   const top=result?.items?.[0],grounded=top&&GROUNDS.has(top.kind)&&!/help$|harness|appointments|syllabus/i.test(String(top.id)+' '+top.kind);
   if(concept&&['find','open'].includes(result?.action)&&grounded&&top.kind==='assignment')return null;
   if(!rest||/\b(?:this|that|these|those|it|here)\b/i.test(rest)||!content(rest).some(w=>!/^(?:help|biscuit|open|show|get|turn|need|want|everything|school|stuff|tab|band|page|menu|settings?)$/.test(w))||rest.split(' ').length>6)
     return null;
   const items=groundedItems(rest,s);if(!items.length)return null;
   const named=mentionedCourses(norm(rest).split(' ').filter(Boolean),s),
     namedWords=new Set([...named.values()].flat()),
     topicWords=norm(rest).split(' ').filter(w=>w&&!STOP.has(w)&&!namedWords.has(w)&&!/^(?:hw|homework|work|stuff)$/.test(w)),
     aboutTopic=concept&&topicWords.length?prepare(s).filter(v=>v.kind==='assignment'&&(!named.size||named.has(v.courseId))&&(()=>{
     const title=titleWords(v);
     return topicWords.every(w=>tokens(w).every(x=>title.has(x)));
   })()):[];
   const target=concept?aboutTopic[0]||items.find(v=>v.kind==='assignment')||items[0]:items[0];
   // every word of the named part must belong to the item, its course or a work-type word; an unknown word stays with AI
   const words=norm(rest).split(' ').filter(Boolean),course=mentionedCourses(words,s),known=new Set([...rowWords(target),...[...course.values()].flat()]);
   if(words.filter(w=>!STOP.has(w)).some(w=>
     !known.has(w)&&!tokens(w).every(x=>known.has(x)||STOP.has(x))&&!GENRES.some(([re])=>re.test(w))&&!/^(?:homework|rdg|hw|help|work|stuff|notes?|msg|messages?|email|teacher)$/.test(w)))
     return null;
   if(!concept&&result?.action==='ai'&&(top?.id===target.id||grounded&&!WORK_WORD.test(lower.replace(/\b(?:msg|message|email)\b/g,' '))))return null;
   // a concept question shows the loaded source first and keeps AI as the optional next step
   if(concept)
     return routed(
       card(
         'find',
         [target,...items.filter(v=>v.id!==target.id)],
         {...(target.fields||{}),itemId:target.id,...(target.courseId?{courseId:target.courseId}:{})},
         'These local sources may help.',
         {ai:s.ai===false?null:{action:'ai',fields:{text:String(line)}},understanding:{step:'understanding',reason:'concept-grounded'}}),
       input,
       s,
       session);
   return routed(
     card('ai',[target],{itemId:target.id,...(target.courseId?{courseId:target.courseId}:{})},'',{understanding:{step:'understanding',reason:affect?'feeling-grounded':'help-grounded'}}),
     input,
     s,
     session);
  }

  /* An AI request that names a kind of work ("the chem lab", "calc packet", "the spanish quiz", "reply to <teacher>", "my draft")
     is sent with that course's item of that kind; with no course named, a follow-up uses the item the student is on. A plain
     concept question ("what is molar mass", "i dont get the narrator") goes to AI as well, with the loaded item whose title holds
     the topic when there is one. The learned source picker often lands on a neighbour (the draft or the group page). */
  const SOURCE_CUES=[['extension',/\b(?:extension|extra time|more time)\b/],['draft',/\b(?:(?:my|the|this|that|our|rough|first)\s+(?:[\w&]+\s+){0,3}draft|draft\s+(?:vs|versus|against|with)|rubric\s+check|check\b.*\b(?:against|with|vs|versus)\b.*\brubric|grade\s+my|lose\s+points|rubric\s+level)\b/],['message',/\b(?:reply|respond|msg|message|email|e mail|dm)\b/],['announcement',/\b(?:annc|anncs|announcement|announcements)\b/],['feedback',/\b(?:comment|comments|feedback|check in|checkin)\b/],['quiz',/\b(?:quiz|quizzes|test|exam)\b/],['homework',/\b(?:hw|homework|tarea|worksheet|problem set)\b/],['major',/\b(?:project|proj|essay|lab|presentation|performance|portfolio|experiment|hypothesis|variables|report|paper|speech|oral|recital)\b/],['reading',/\b(?:reading|readings|rdg|packet|chapter|handout|article|notes|pdf|lectura|anthology)\b/]],
   CONCEPT_LOCAL=/\b(?:day|days|date|announce|announced|said|latest|newest|recent|update|updates|news|post|posted|office|hours|hrs|email|emails|contact|group|groups|partners?|teammates?|members|slides|files?|guide|link|website|due|deadline|grade[sd]?|score|points|room|time|when|where|link|submit|submitted|turned|my|mine|i|me|password|settings?|tab|button|biscuit|pet|theme|focus|timer|reminders?|notifications?|account|profile|canvas|app|panel|page|zoom|meeting|schedule|today|tonight|tomorrow|tmrw|week|calendar|inbox|left|next|up|new|happening|plan|wrong|this|that|it|you|your|we|us|our)\b/,
   CONCEPT_WORK=/\b(?:hw|homework|quiz|test|exam|lab|project|essay|reading|assignment|class|course|teacher|announcement|message|grade|rubric|draft|syllabus|policy|policies|late|rules?|instructions|requirements?|format|length|word count|allowed|submission|attempts?)\b/,
   SOURCE_FILLER=new Set([
     'important',
     'matter',
     'matters',
     'work',
     'works',
     'mean',
     'means',
     'meaning',
     'used',
     'use',
     'happen',
     'happens',
     'exist',
     'exists',
     'called',
     'difference',
     'between',
     'example',
     'examples',
     'simple',
     'simply',
     'basically',
     'really',
     'even',
     'again',
     'thing',
     'things',
     'stuff',
     'part',
     'parts',
     'idea',
     'ideas',
     'concept',
     'hard',
     'confusing',
     'key',
     'terms',
     'term',
     'organized',
     'organised',
     'structured',
     'cornell',
     'sentences',
     'sentence',
     'few',
     'short',
     'summary',
     'summarize',
     'summarise',
     'tldr',
     'sum',
     'recap',
     'notes',
     'study',
     'flashcards',
     'flashcard',
     'cards',
     'annotate',
     'close',
     'read',
     'reading',
     'guide',
     'produce',
     'turn',
     'into',
     'from',
     'make',
     'give',
     'help',
     'explain',
     'explicame',
     'explica',
     'understand',
     'get',
     'dont',
     'still',
     'why',
     'how',
     'what',
     'whats',
     'is',
     'are',
     'was',
     'does',
     'do',
     'quiz',
     'questions',
     'question',
     'practice',
     'steps',
     'outline',
     'break',
     'down',
     'start',
     'write',
     'paragraph',
     'line',
     'through',
     'go',
     'walk',
     'tell',
     'show',
     'with',
     'me',
     'please',
     'pls',
     'could',
     'can',
     'you',
     'would'
   ]);
  function conceptTopic(line){
   const t=String(line).trim().replace(/[?.!]+$/,'').replace(/^(?:(?:pls|please|ok|okay|so|hey|um|wait)\s+)+/i,'').replace(/(?:\s+(?:pls|please|plz|to\s+me|for\s+me|exactly|again|actually|though|anyway|simply|in\s+simple\s+(?:words|terms)))+$/i,'');
   const ask=/^(?:(?:can|could|would)\s+you\s+)?(?:explain|explicame|explícame|explica|define|teach\s+me(?:\s+about)?)(?:\s+to\s+me)?\s+(?:what\s+)?(?:(?:is|are)\s+)?(.+)$/i.exec(t)||/^(?:i\s+)?(?:still\s+)?(?:dont|don't|do\s+not|cant|can't|cannot)\s+(?:get|understand)\s+(?:what\s+)?(.+)$/i.exec(t)||/^confused\s+(?:about|by|on)\s+(.+)$/i.exec(t)||/^(.+?)\s+explained$/i.exec(t)||/^(?:the\s+)?meaning\s+of\s+(.+)$/i.exec(t)||/^(.+?)\s+meaning$/i.exec(t),
    what=!ask&&(/^what\s+(?:does|do)\s+(.+?)\s+(?:even\s+)?mean(?:\s+(?:for|in)\s+.+)?$/i.exec(t)||/^(?:what|whats|what's)\s+(?:exactly\s+)?(?:(?:is|are)\s+)?(?:exactly\s+)?(.+)$/i.exec(t)||/^why\s+(?:is|are|do|does|did)\s+(.+)$/i.exec(t)||/^how\s+(?:do|does)\s+(.+?)\s+work$/i.exec(t)),m=ask||what;
   if(!m)return null;
   const topic=norm(m[1]).replace(/^(?:the|a|an)\s+/,'');
   if(what&&/^(?:did|does|do|was|were|will|would|should|can|could|has|have|had)\b/.test(topic)&&!/\bmean\b/.test(topic))return null;
   return !topic||CONCEPT_LOCAL.test(topic)||what&&CONCEPT_WORK.test(topic)?null:topic;}
  /* Going somewhere: a course named alone after a "take me to" verb (or "the <course> course page") opens that course; a list of
     students opens People for the named course; the calendar, announcements, planner and home are tabs. A loaded entry that is
     itself the page asked for (a People help card) keeps its answer. */
  const NAV_VERB='(?:(?:i (?:want|need) to|i wanna|lets|let s) (?:go|head|get|jump) (?:back )?(?:over )?to|take me (?:back )?to|go (?:back )?to|switch (?:over |back )?to|switch the workspace to|jump to|head to|bring me (?:back )?to|back to|open|show me|pull up|i want (?:to )?see|let me see)',
   NAV_TABS={
     home:'home',
     dashboard:'home',
     'home page':'home',
     homepage:'home',
     planner:'planner',
     'my planner':'planner',
     calendar:'calendar',
     'my calendar':'calendar',
     'calendar page':'calendar',
     announcements:'announcements',
     'announcements page':'announcements',
     'announcement page':'announcements',
     grades:'grades',
     'grades page':'grades'
   };
  function navCue(line,s,session,result){
   if(!result||result.requests||result.action==='navigate'||result.clarify&&list(result.choices).length)return null;
   const lower=norm(line).replace(/^(?:(?:pls|please|ok|okay|hey|can you|could you)\s+)+/,'').replace(/\s+(?:pls|please|now|again|rn)$/,''),
     rows=prepareLearned(s),
     Language=load('ReserveBiscuitLanguage','./biscuit-language.js');
   const course=phrase=>{
     const req=Language?.courseAliasRequest?.(phrase+' homework',s,rows);
     return req&&req.status!=='ambiguous'&&req.courseId&&list(s.courses).some(c=>String(c.id)===String(req.courseId))?String(req.courseId):null;
   };
   const go=(fields,message)=>
     routed(
       card('navigate',fields.courseId?rows.filter(v=>v.kind==='course'&&String(v.id)===String(fields.courseId)).slice(0,1):[],fields,message,{understanding:{step:'understanding',reason:'navigate-cue'}}),
       line,
       s,
       session);
   const tab=new RegExp('^(?:'+NAV_VERB+'\\s+)?(?:the\\s+|my\\s+)?(.+?)(?:\\s+(?:tab|view|workspace))?$').exec(lower),named=tab&&NAV_TABS[tab[1]];
   if(named&&(tab[0]!==tab[1]||['calendar','announcements page','grades page','home page','homepage'].includes(tab[1])))return go({tab:named},'Open '+named+'.');
   /* "show me every class grade", "all my grades" (a bare "all grades" is the Home button of that name): the grades page, unless a course is named or a change is asked for */
   if(/\b(?:every\s+(?:(?:class|course|subject)(?:es|s)?\s+)?grades?|all\s+(?:of\s+)?my\s+(?:(?:class|course|subject)(?:es|s)?\s+)?grades|all\s+(?:my\s+)?(?:class|course|subject)(?:es|s)?\s+grades?)\b|\bgrades?\s+(?:for|in|across)\s+(?:every|all)\s+(?:of\s+)?(?:my\s+)?(?:class|course|subject)(?:es|s)?\b/.test(lower)&&!/\b(?:hide|remove|move|off|on|top|bottom|add|delete|turn|card|module|widget)\b/.test(lower)&&!mentionedCourses(lower.split(' '),s).size)
     return go({tab:'grades'},'Open grades.');
   const whole=new RegExp('^'+NAV_VERB+'\\s+(?:the\\s+|my\\s+)?(.+?)(?:\\s+(?:course|class))?(?:\\s+(?:page|home ?page|home|site))?$').exec(lower),
     inside=new RegExp('\\b'+NAV_VERB+'\\s+(?:the\\s+|my\\s+)?([a-z0-9& ]{2,30}?)\\s+(?:course|class)\\s+(?:page|home ?page|home)\\b').exec(lower);
   const bare=/^(?:the\s+|my\s+)?([a-z0-9& ]{2,30}?)\s+(?:course|class)\s+(?:page|home ?page|homepage|site)$/.exec(lower);
   for(const m of [whole,inside,bare]){const id=m&&course(m[1]);if(id)return go({tab:'course',courseId:id},'Open the course.');}
   if(/\b(?:list of (?:the )?(?:students|classmates|people)|class ?list|who is in|whos in|people (?:tab|page|list))\b/.test(lower)&&!/\b(?:who is in|whos in)\b.*\b(?:group|team|crew|squad|pod)\b/.test(lower)){
     const top=result.items?.[0];
     if(top&&/people|roster|class list/i.test(String(top.title||'')+' '+String(top.id||'')))return null;
     const said=Language?.resolveCourses?.(line,s,session,rows);
     if(said?.recognized&&said.courseId&&!said.ambiguous)return go({tab:'people',courseId:String(said.courseId)},'Open People.');
   }
   return null;}
  /* A short detail question right after looking at something ("due when?", "and the due date", "room?") is about that item. */
  const FOLLOW_UP=/^(?:(?:and|so|ok|okay|um|wait|what about)\s+)*(?:the\s+|its\s+|it'?s\s+|whats\s+the\s+|what'?s\s+the\s+|what\s+is\s+the\s+)?(?:new\s+)?(?:due(?:\s+date)?|deadline|due\s+when|when(?:'?s|\s+is)?(?:\s+(?:it|that))?(?:\s+due)?|room|which\s+room|what\s+room|where(?:'?s|\s+is)?(?:\s+(?:it|that))?|link|points?|how\s+many\s+points|attempts?|what\s+time(?:\s+is\s+(?:it|that))?(?:\s+due)?|location|time)(?:\s+(?:pls|please|again|now))?\s*[?.!]*$/i;
  function followUp(line,s,session,result){
   if(!result||result.requests||session?.lastItemId==null||!FOLLOW_UP.test(String(line).trim()))return null;
   const last=prepare(s).find(v=>String(v.id)===String(session.lastItemId));if(!last||['course','setting','feature','tab','home-module'].includes(last.kind))return null;
   if(['find','open'].includes(result.action)&&String(result.items?.[0]?.id)===String(last.id))return null;
   return routed(
     card(
       'find',
       [last],
       {...(last.fields||{}),itemId:String(last.id),...(last.courseId!=null?{courseId:String(last.courseId)}:{})},
       'Here is '+last.title+'.',
       {understanding:{step:'understanding',reason:'follow-up'}}),
     line,
     s,
     session);}
  /* "marine bio lab rubric", "where is the spanish reading": a course and a rubric or reading, nothing else, opens that course's file */
  const LOOKUP_FILLER=new Set([
    'the',
    'my',
    'our',
    'a',
    'an',
    'pls',
    'please',
    'plz',
    'open',
    'pull',
    'up',
    'show',
    'me',
    'find',
    'where',
    'is',
    's',
    'whats',
    'get',
    'bring',
    'need',
    'i',
    'for',
    'of',
    'in',
    'from',
    'class',
    'course',
    'can',
    'you',
    'could',
    'lab',
    'labs',
    'project',
    'proj',
    'essay',
    'presentation',
    'report',
    'paper',
    'performance',
    'portfolio',
    'rubric',
    'reading',
    'readings',
    'rdg',
    'packet',
    'chapter',
    'handout',
    'to',
    'see',
    'want',
    'go',
    'again',
    'now',
    'rn',
    'link',
    'file',
    'pdf',
    'one',
    'that',
    'this',
    'grading'
  ]);
  function kindLookup(line,s,session,result){
   if(!result||result.requests||!['find','open','none'].includes(result.action)||list(result.choices).length)return null;
   const lower=norm(line),kind=/\brubric\b/.test(lower)?'rubric':/\b(?:reading|readings|rdg|packet|chapter|handout)\b/.test(lower)?'reading':null;if(!kind||lower.split(' ').length>9)return null;
   const rows=prepare(s),
     Language=load('ReserveBiscuitLanguage','./biscuit-language.js'),
     said=Language?.resolveCourses?.(line,s,session,rows),
     chosen=list(said?.matches).find(m=>String(m.id??m.courseId)===String(said?.courseId));
   if(!said?.recognized||said.ambiguous||!chosen||!(chosen.nameExact||chosen.nameMatch>=.5||chosen.abbreviation||chosen.subject))return null;
   const courseId=String(said.courseId),
     course=list(s.courses).find(c=>String(c.id)===courseId),
     known=new Set([
       ...LOOKUP_FILLER,
       ...(Language.courseAliases?Language.courseAliases(course||{}):[]).flatMap(v=>norm(v).split(' ')),
       ...list(chosen.evidence).flatMap(v=>norm(v.phrase||'').split(' '))
     ]);
   if(lower.split(' ').some(w=>w&&!known.has(w)))return null;
   const mine=rows.filter(r=>String(r.courseId)===courseId),
     file=r=>r.kind==='file',
     isRubric=r=>file(r)&&/rubric/.test(norm(r.title)),
     target=kind==='rubric'?
       mine.filter(isRubric)[0]:
       mine.find(r=>r.kind==='assignment'&&/reading/.test(norm(r.workKind||'')))||
         mine.find(r=>file(r)&&!isRubric(r)&&/\b(?:reading|readings|packet|notes|chapter|handout|article|anthology|reader)\b/.test(norm(r.title)))||
         mine.find(r=>file(r)&&!isRubric(r));
   if(!target||['find','open'].includes(result.action)&&String(result.items?.[0]?.id)===String(target.id))return null;
   return routed(card('find',[target],{...(target.fields||{}),itemId:String(target.id),courseId},'Here is '+target.title+'.',{understanding:{step:'understanding',reason:'kind-lookup'}}),line,s,session);}
  /* "focus 25 creative writing hw": focus on that course's homework, not the whole course */
  function focusItem(line,s,session,result){
   const f=result?.next?.fields;
   if(result?.action!=='focus'||!f?.courseId||f.itemId)return null;
   const lower=norm(line),cue=SOURCE_CUES.find(([,re])=>re.test(lower))?.[0];
   if(!['homework','quiz','major','reading'].includes(cue))return null;
   const work=r=>norm(r.workKind||r.title||''),
     test=cue==='homework'?
       r=>/homework|\bhw\b|worksheet|problem/.test(work(r)):
       cue==='quiz'?r=>/quiz|test|exam/.test(work(r)):cue==='reading'?r=>/reading/.test(work(r)):r=>!/homework|\bhw\b|worksheet|problem|quiz|test|exam|reading|discussion/.test(work(r));
   const named=/\b(lab|essay|project|presentation|report|paper|test|exam|quiz)\b/.exec(lower)?.[1],
     pool=prepare(s).filter(r=>
       r.kind==='assignment'&&String(r.courseId)===String(f.courseId)&&(r.itemId==null||String(r.itemId)===String(r.id))&&!r.done&&!r.completed&&test(r)),
     typed=named?pool.filter(r=>work(r).includes(named)||norm(r.title||'').split(' ').includes(named)):[];
   const hit=(typed.length?typed:pool).sort((a,b)=>(stamp(a.dueAt)??Infinity)-(stamp(b.dueAt)??Infinity))[0];if(!hit)return null;
   const {operation,...rest}=f;
   return routed(
     card(
       'focus',
       [hit],
       {...rest,itemId:String(hit.id),courseId:String(f.courseId)},
       'Focus on '+hit.title+(f.minutes?' for '+f.minutes+' min':'')+'.',
       {understanding:{step:'understanding',reason:'focus-item'}}),
     line,
     s,
     session);
  }
  function aiSource(line,input,s,session,result){
   if(!result||result.requests||result.clarify||s.ai===false||result.understanding?.reason==='named-source')return null;
   const lower=norm(line),isAI=result.action==='ai',local=['find','open','none'].includes(result.action);let cue=SOURCE_CUES.find(([,re])=>re.test(lower))?.[0]||null;
   /* besides AI answers: a concept question, a request to grade or check a draft, a message to a teacher, and help planning a lab's procedure */
   let topic=isAI||!local?null:conceptTopic(line);
   const review=local&&cue==='draft'&&/\b(?:grade|check|review|score|mark|look at|proofread|rubric level|lose points)\b/.test(lower),
     compose=local&&/^(?:(?:pls|please|can you|could you|help me)\s+)?(?:email|e mail|msg|message|dm|write(?:\s+to)?|reply\s+to|respond\s+to)\s+(?!from\b|me\b)/.test(lower),
     planned=result.action==='plan'&&cue==='major'&&/^(?:(?:pls|please|can you|could you)\s+)?(?:help\s+(?:me\s+)?plan|plan(?:\s+out)?\s+(?:my|the))\s+/.test(lower)&&!/\b(?:tonight|today|tomorrow|tmrw|tmr|week|weekend|time|hours?|hrs?|minutes?|mins?|blocks?|schedule|calendar|when|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night|\d+)\b/.test(lower);
   if(!isAI&&!topic&&!review&&!compose&&!planned)return null;
   const words=lower.split(' ').filter(Boolean),
     rows=prepare(s).filter(r=>r.kind!=='assignment'||r.itemId==null||String(r.itemId)===String(r.id)),
     byId=id=>rows.find(r=>String(r.id)===String(id));
   if(cue==='message'&&/\b(?:group|groupmates?|team|teammates?|partners?|peers?|classmates?)\b/.test(lower))cue='peer';
   /* the course: one the line names (the course resolver, then a teacher's surname), else the item the student is on */
   const Language=load('ReserveBiscuitLanguage','./biscuit-language.js'),
     said=Language?.resolveCourses?.(line,s,session,rows),
     chosen=list(said?.matches).find(m=>String(m.id??m.courseId)===String(said?.courseId));
   const surname=r=>norm(r.title||r.name||'').split(' ').pop()||'';
   const taught=[
     ...new Set(rows.filter(r=>r.kind==='teacher'&&r.courseId!=null&&surname(r).length>2&&words.some(w=>w===surname(r)||w===surname(r)+'s')).map(r=>String(r.courseId)))
   ];
   let courseId=taught.length===1?
     taught[0]:
     said?.recognized&&said.courseId&&!said.ambiguous&&chosen&&(chosen.nameExact||chosen.nameMatch>=.5||chosen.abbreviation||chosen.subject||chosen.topic)?
       String(said.courseId):
       '';
   if(compose&&!isAI&&!taught.length&&!/\bteacher\b/.test(lower))return null;
   if(!courseId){const m=mentionedCourses(words,s);if(m.size===1)courseId=String([...m.keys()][0]);}
   /* "what are the office hours for soc": a plain what-question naming a course or its teacher asks about that course's items */
   /* (named by its name, nickname or teacher: a course found only through the topic's own words, "what is memory retrieval", is still a concept question) */
   if(topic&&
     (taught.length||chosen&&!chosen.topic&&(chosen.nameExact||chosen.abbreviation||chosen.nameMatch>=.5&&!chosen.subject))&&
     /^\s*(?:(?:pls|please|ok|okay|so|hey|um|wait)\s+)*(?:what|whats|what's)\b/i.test(line)&&
     !/\bmean\b/i.test(line)){
     topic=null;
     if(!isAI&&!review&&!compose&&!planned)return null;
   }
   const last=session?.lastItemId!=null?byId(session.lastItemId):null,
     pronoun=/\b(?:it|this|that|these|those|them|its)\b/.test(lower),
     pageRef=/\b(?:on|in)\s+(?:this|the)\s+(?:page|screen|tab)\b|\bthis\s+(?:page|screen)\b/.test(lower)&&s.selectedItemId!=null,
     onLast=!courseId&&!!last&&!pageRef&&(!!cue||pronoun);
   if(onLast)courseId=String(last.courseId??'');
   const work=r=>norm(r.workKind||r.genre||r.title||''),dueOf=r=>stamp(r.dueAt??r.due_at)??Infinity,said2=new Set(words.filter(w=>!STOP.has(w)).flatMap(w=>tokens(w)));
   const overlap=r=>[...titleWords(r)].filter(w=>said2.has(w)).length,best=list=>list.slice().sort((a,b)=>overlap(b)-overlap(a)||dueOf(a)-dueOf(b))[0]||null;
   const teacherWord=id=>{
     const t=rows.find(r=>r.kind==='teacher'&&String(r.courseId)===String(id));
     return t?surname(t):'';
   },fromTeacher=r=>{const name=teacherWord(r.courseId);return !!name&&norm(String(r.text||r.description||r.body||'')).split(' ').slice(0,5).includes(name);};
   const homework=r=>r.kind==='assignment'&&/homework|\bhw\b|worksheet|problem|exercises/.test(work(r)),
     quiz=r=>r.kind==='quiz'||r.kind==='assignment'&&/quiz|test|exam/.test(work(r)),
     readingWork=r=>r.kind==='assignment'&&/reading/.test(norm(r.workKind||'')),
     otherFile=r=>r.kind==='file'&&!/rubric/.test(norm(r.title)),
     readingFile=r=>otherFile(r)&&/\b(?:reading|readings|packet|notes|chapter|handout|article|anthology|reader)\b/.test(norm(r.title)),
     reading=r=>readingWork(r)||otherFile(r),
     major=r=>r.kind==='assignment'&&!homework(r)&&!quiz(r)&&!/reading|discussion/.test(work(r));
   const mine=courseId?rows.filter(r=>String(r.courseId)===courseId):[];
   const pick={
     homework:()=>best(mine.filter(homework)),
     quiz:()=>best(mine.filter(quiz)),
     reading:()=>best(mine.filter(readingWork))||best(mine.filter(readingFile))||best(mine.filter(otherFile)),
     draft:()=>best(mine.filter(r=>r.kind==='submission')),
     announcement:()=>mine.filter(r=>r.kind==='announcement').sort((a,b)=>(stamp(b.postedAt??b.posted_at)||0)-(stamp(a.postedAt??a.posted_at)||0))[0]||null,
     feedback:()=>best(mine.filter(r=>r.kind==='grade'&&!/current grade/.test(norm(r.title)))),
    major:()=>{
      const all=mine.filter(major),
        want=/\b(?:lab|experiment|hypothesis|variables)\b/.test(lower)?/lab|experiment/:/\b(?:essay|paper)\b/.test(lower)?/essay|paper/:/\b(?:presentation|speech|oral)\b/.test(lower)?/oral|presentation|speech/:/\b(?:performance|recital)\b/.test(lower)?/performance|recital|concert/:/\bportfolio\b/.test(lower)?/portfolio/:null,
        typed=want?all.filter(r=>want.test(work(r)+' '+norm(r.title))):[];
      return best(typed.length?typed:all);
    },
    message:()=>
      best(mine.filter(r=>r.kind==='message'&&fromTeacher(r)&&!/\bextension\b/.test(norm(r.title))))||best(mine.filter(r=>r.kind==='message'&&fromTeacher(r)))||best(mine.filter(r=>r.kind==='message')),
    peer:()=>best(mine.filter(r=>r.kind==='message'&&!fromTeacher(r)))||best(mine.filter(r=>r.kind==='group'))};
   pick.extension=pick.major;
   const fits=(r,c)=>
     c==='homework'?
       homework(r):
       c==='quiz'?
         quiz(r):
         c==='major'||c==='extension'?
           major(r):
           c==='reading'?
             reading(r):
             c==='draft'?
               r.kind==='submission':
               c==='message'?r.kind==='message'&&fromTeacher(r):c==='peer'?r.kind==='message'&&!fromTeacher(r):c==='announcement'?r.kind==='announcement':c==='feedback'?r.kind==='grade':false;
   const top=result.items?.[0],
     phrases=m=>new Set(list(m?.evidence).filter(v=>v.phrase).map(v=>norm(v.phrase))),
     topMatch=top&&list(said?.matches).find(m=>String(m.id??m.courseId)===String(top.courseId));
   /* an AI answer already on the kind asked for stays when the course it chose is named as well as the resolver's (the same word, no weaker) */
   if(isAI&&
     cue&&
     top&&
     fits(top,cue)&&
     (!courseId||
       String(top.courseId)===courseId||
       topMatch&&chosen&&(topMatch.nameMatch||0)>=(chosen.nameMatch||0)&&[...phrases(chosen)].every(v=>phrases(topMatch).has(v))))
     return null;
   /* a message cue names a thread only with a teacher, a reply, the group or the item the student is on */
   if(cue==='message'&&!onLast&&!taught.length&&!/\b(?:teacher|reply|respond)\b/.test(lower))return null;
   let target=null;
   const cueAt=cue?SOURCE_CUES.find(([name])=>name===(cue==='peer'?'message':cue))[1].exec(lower):null,
     determined=cue==='draft'||!!cueAt&&/\b(?:my|the|our|this|that|his|her|their)\s+(?:[\w&]+\s+){0,2}$/.test(lower.slice(0,cueAt.index));
   if(onLast)target=!cue||fits(last,cue)||!determined?last:pick[cue]();
   else if(courseId&&cue)target=last&&String(last.courseId)===courseId&&fits(last,cue)?last:pick[cue]();
   else if(!cue){/* no kind named: the one loaded item whose title holds every topic word */
    const courseWords=new Set(courseId?
      norm([list(s.courses).find(c=>String(c.id)===courseId)?.name,...(said?.matches||[]).map(m=>m.shortName||m.name)].filter(Boolean).join(' ')).split(' '):
      []),
      topicWords=[...new Set((topic?norm(topic).split(' '):words).filter(w=>w.length>2&&!STOP.has(w)&&!SOURCE_FILLER.has(w)&&!courseWords.has(w)))];
    if(topicWords.length&&topicWords.length<=4){
      const pool=rows.filter(r=>['file','assignment','page','announcement'].includes(r.kind)&&!/rubric/.test(norm(r.title))&&(!courseId||String(r.courseId)===courseId)),
        hits=pool.filter(r=>topicWords.every(w=>tokens(w).every(x=>titleWords(r).has(x))));
     const order=/\b(?:flash ?cards?|quiz me|practice)\b/.test(lower)?
       [quiz,readingWork,readingFile,otherFile,homework,major]:
       /\b(?:outline|steps|break|plan|start)\b/.test(lower)?[major,homework,readingWork,readingFile]:[readingWork,readingFile,otherFile,homework,quiz,major,r=>r.kind==='page',r=>r.kind==='announcement'];
     for(const test of order){const found=hits.filter(test);if(found.length===1){target=found[0];break;}if(found.length>1)break;}}}
   /* R6 puts a loaded source first: a concept question whose local search already found a source about the topic (in its
      text, not only its title) hands that source to the AI */
   if(!target&&topic&&!cue&&top&&['file','assignment','page'].includes(top.kind)){
     const text=' '+norm([top.title,top.text,top.description,top.body,top.instructions].filter(v=>typeof v==='string').join(' '))+' ',
       need=norm(topic).split(' ').filter(w=>w.length>2&&!STOP.has(w)&&!SOURCE_FILLER.has(w));
     if(need.length&&need.every(w=>text.includes(' '+w)))target=top;
   }
   if(isAI){if(!target||String(target.id)===String(result.items?.[0]?.id))return null;}
   else if(!target&&(cue||!topic))return null;
   const raw=String(line);if(!target)return routed(card('ai',[],{text:raw},'This needs explanation.',{understanding:{step:'understanding',reason:'concept-question'}}),input,s,session);
   const was=result.next?.fields?.handoff,helpKinds=isAI&&was?(was.mode==='choice'&&Array.isArray(was.kinds)?was.kinds:was.mode==='build'&&was.kind?[was.kind]:[]):undefined;
   return routed(
     card('ai',[target],{itemId:target.id,...(target.courseId!=null?{courseId:target.courseId}:{})},'',{understanding:{step:'understanding',reason:'named-source',...(helpKinds?{helpKinds}:{})}}),
     input,
     s,
     session);
  }

  // A plain request for study time that came back as a lookup or nothing goes to the planner.
  function planCue(line,input,s,session,result){
   if(!result||result.clarify||!['find','open','none','chat','ai'].includes(result.action)||!planAsk(line))return null;
   if(result.action==='ai'&&norm(line).split(' ').some(w=>w!=='help'&&STUDY_WORDS.has(w)||w==='ai'))return null;
   const planned=evaluateRules(input,s,session);if(planned?.action==='plan')return planned;
   // otherwise a study block for the work the reply found (when the line names it) or a general plan
   const top=result.items?.[0],named=top?.kind==='assignment'&&!top.local&&GENRES.some(([re,title])=>re.test(norm(line))&&title.test(String(top.title||'')));
   return routed(
     card(
       'plan',
       named?[top]:[],
       {local:true,line:String(line),...(named?{itemId:top.id}:{})},
       named?'Plan study time for '+top.title+'.':'Plan your study time.',
       {understanding:{step:'understanding',reason:'plan-cue'}}),
     input,
     s,
     session);
  }
  function evaluate(input,s={},session={}){let original=input;input=everyday(input);
   // A date question rewritten to "due tmrw"/"due today" is routed as that line, not by its original words.
   if(input!==original&&(input==='due tmrw'||input==='due today'||FOCUS_ON.test(String(original))))original=input;
   let result=dispatch(input,s,session,original);
   if(!result?.requests){
     const grounded=aiGround(original,input,s,session,result)||
       kindCue(original,input,s,session,result)||
       genreCue(original,input,s,session,result)||
       courseWork(original,input,s,session,result)||
       planCue(original,input,s,session,result);
     if(grounded)result=grounded;
   }
   if(GREETING_ONLY.test(String(original))&&(didNothing(result)||['control-proposal','control-match'].includes(result?.understanding?.reason))){
     result=routed(card('chat',[],{},'Hi. I am here.'),input,s,session);
   }
   else if(didNothing(result)&&!result?.requests){const matched=controlMatch(original,s,session);if(matched)result=matched.result;}
   else if(result?.action==='ai'&&
     !result.requests&&
     (!session?.lastItemId||Array.isArray(prepare(s).find(v=>String(v.id)===String(session.lastItemId))?.controls))&&
     !norm(original).split(' ').some(w=>STUDY_WORDS.has(w))){/* a question about a place in the app that the reply sent to AI is answered with that place when the control is named in full; "ai" or "biscuit" in the line must name the panel the control sits in ("the copy button in the ai panel") */
     const matched=controlMatch(original,s,session),said=norm(original).split(' '),where=list(matched?.result?.ui?.path).map(norm);
     if((matched?.strong||matched?.full||matched?.names>=2)&&
       !matched.ambiguous&&
       !titledItem(original,s)&&
       (!said.includes('ai')||where.includes('ai'))&&
       (!said.includes('biscuit')||where.some(v=>/companion|biscuit/.test(v))))
       result=matched.result;
   }
   else if(result?.clarify&&
     result.understanding?.reason==='control-proposal'&&
     !result.ui&&
     !list(result.items).length&&
     !result?.requests){/* the generic "what would you like to change" question yields to a control named in full */
     const matched=controlMatch(original,s,session);
     if(matched?.full&&!matched.ambiguous&&!loadedWord(original,s))result=matched.result;
   }
   else if(['find','open'].includes(result?.action)&&
     result.understanding?.reason==='linear-score'&&
     result.items?.[0]&&
     !result.requests&&
     !session?.lastItemId){/* a request that names an app button ("refresh this course", "capture message add") and shares no word with the title of the record the ranking found is that button */
     const top=result.items[0],named=new Set([...titleWords(top),...tokens(top.aliases||'')]);
     if(!content(original).some(w=>named.has(w))){
       const matched=controlMatch(original,s,session);
       if(matched&&!matched.ambiguous&&(matched.names>=2||matched.strong||matched.full)&&!titledItem(original,s))result=matched.result;
     }
   }
   if(Array.isArray(result?.ui?.path)&&!result.requests){/* a UI place named by any step opens the loaded handoff page that lists it */
     const page=handoffPage(result.ui.path,s);
     if(page)result=handoffCard(page,original,s,session);
   }
   if(!result?.requests){const found=lookup(original,input,s,session,result);if(found)result=found;}
   {const page=uiHandoff(original,s,result);if(page)result=handoffCard(page,original,s,session);}
   {const nav=navCue(original,s,session,result);if(nav)result=nav;}
   {const next=followUp(original,s,session,result)||kindLookup(original,s,session,result)||focusItem(original,s,session,result);if(next)result=next;}
   {const sourced=aiSource(original,input,s,session,result);if(sourced)result=sourced;}
   if(['find','open'].includes(result.action)&&result.items?.[0]){
     const fact=load('ReserveBiscuitFacts','./biscuit-facts.js')?.resolve(input,s,session,[result.items[0]]);
     if(fact?.action==='find'&&fact.items?.[0]?.id===result.items[0].id&&!result.answerKind){
       result.message=fact.message;
       result.answer=fact.answer;
       result.next.fields={...result.next.fields,...fact.next.fields};
     }
   }
   if(!result.requests&&
     result.action!=='chat'&&
     FEELING.test(String(original))&&
     !FEELING_ASK.test(String(original))&&
     !mentionedCourses(norm(original).split(' ').filter(Boolean),s).size&&
     !namedCourse(original,s,session))
     result=routed(card('chat',[],{},'That sounds like a lot. I am here. If it helps, I can show what is due next or start a short break.',{understanding:{step:'understanding',reason:'feeling'}}),input,s,session);
  {const timed=timerCue(original,s,result);if(timed)result=timed;}
  if(!result.requests&&NEVER_MIND.test(String(original)))result=routed(card('none',[],{},'Okay, nothing changed.',{understanding:{step:'understanding',reason:'never-mind'}}),input,s,session);
  if(!result.requests&&answerAsk(String(original)))
    result=routed(card('none',[],{},'I can\u2019t give you the answer, but I can help you understand the question or practise one like it.',{understanding:{step:'understanding',reason:'answer-request'}}),input,s,session);
  const stage=result.understanding?.learned?'learned':['negation','privacy','invalid-command'].includes(result.routing?.reason)?'guard':'rules';
  result.execution={
    stage,
    fallback:stage==='rules'&&!!(tier||pack||s.pet?.knowledge||s.settings?.pet?.knowledge),
    reason:result.routing?.reason||result.understanding?.reason||'exact-or-fallback'
  };
  return readableTimes(Registry.sanitize(load('ReserveBiscuitReplies','./biscuit-replies.js')?.decorate(result,input,s)||result,s),s);
  }
  // Replies are read by students: raw ISO timestamps in the message become local, readable times.
  function readableTimes(result,s){
    if(!result||typeof result.message!=='string')return result;
    const zone=s.timeZone||'America/New_York';
    result.message=result.message.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b/g,iso=>{
      const at=Date.parse(iso);
      if(!Number.isFinite(at))return iso;
      try{return new Date(at).toLocaleString('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch{return iso;}
    });
    return result;
  }
  function offer(s={},state={},memory={}){
    const now=stamp(s.now)||Date.now(),
      pet=s.pet||{},
      skills={...s.skills,...pet.skills},
      can=kind=>load('ReservePonyBrain','./pony-brain.js')?.skillEnabled?.(kind,skills)!==false,
      brain=memory.brain||s.brain||{},
      ledger=brain.nudges||{},
      local=Clock().calendar(s.timeZone)(now),
      bedtime=s.settings?.bedtime||'22:30',
      bed=Number(bedtime.slice(0,2))*60+Number(bedtime.slice(3)),
      ignored=memory.ignored??Math.max(brain.kinds?.plan?.streak||0,brain.kinds?.next?.streak||0),
      last=memory.lastOffer??s.offerHistory?.lastOffer??ledger.at??0;
   if(pet.enabled===false||
     pet.roam==='off'||
     s.focus?.running||
     s.focus?.endsAt>now||
     s.focus?.breakUntil>now||
     s.quizTaking||
     /\/quizzes\/[^/]+\/(?:take|attempt)/i.test(s.pathname||'')||
     state.typing||
     state.dragging||
     state.hidden||
     state.busy||
     state.editing||
     state.modalOpen||
     state.offerOpen||
     state.activeOffer||
     brain.hiddenUntil>now||
     brain.quietUntil>now)
     return null;
   const result=(id,kind,label,action,data,score)=>({id,kind,label,action,data,fields:data,items:[],next:{action,fields:data},score}),
     reminders=list(s.reminders||pet.reminders).filter(v=>
       stamp(v.at)<=now&&stamp(v.at)>now-10*MIN&&!v.delivered&&!list(state.seen).includes(JSON.stringify(['reminder',v.id,String(v.at)]))).sort((a,b)=>
       stamp(a.at)-stamp(b.at));
   if(can('reminder')&&reminders[0])return result('reminder-'+reminders[0].id,'reminder',reminders[0].text||reminders[0].title,'reminder',{...reminders[0],itemId:reminders[0].id},100);
   const routine=list(s.routines||pet.routines).find(v=>
     can('routine')&&
       can(v.action==='remind'?'reminder':v.action)&&
       list(v.days).includes(new Date(local.day+'T12:00Z').getUTCDay())&&
       Number.isInteger(v.minute)&&
       v.minute<=local.minute&&
       v.last!==local.day&&
       !v.disabled&&
       !list(state.seen).includes(JSON.stringify(['routine',v.id,local.day])));
   if(routine&&['focus','remind','break','plan'].includes(routine.action))
     return result('routine-'+routine.id,'routine',routine.name||'Scheduled routine',routine.action==='remind'?'reminder':routine.action,{...routine.data,itemId:routine.id},100);
   if(s.settings?.biscuitOffers===false||
     s.offers===false||
     pet.nudges&&pet.nudges!=='helpful'||
     ignored>=3||
     now-last<Math.min(24*60,30*2**ignored)*MIN||
     ledger.day===local.day&&ledger.count>=3)
     return null;
   // Early bedtimes belong to the evening before; night ends at 06:00.
   const rows=prepare(s).filter(v=>
     v.kind==='assignment'&&!v.done&&!v.completed&&!v.planned&&!v.plannedDate&&!s.local?.[v.id]?.plannedDate&&!s.local?.[v.id]?.checkedOff&&s.local?.[v.id]?.progress!=='done'),
     soon=rows.filter(v=>{
     const due=stamp(v.dueAt);
     return due>now&&due-now<=2*DAY;
   }).sort((a,b)=>stamp(a.dueAt)-stamp(b.dueAt)),
   urgent=soon.find(v=>stamp(v.dueAt)-now<=3*60*MIN&&!list(ledger.items).includes(v.id)&&!list(ledger.items).includes('biscuit:next-'+v.id)),
   page=s.pageKind||s.view||s.page?.kind||'dashboard',
   current=String(s.itemId||s.selectedItemId||s.page?.itemId||''),
   evening=local.minute+(local.minute<360?1440:0),
   bedEnd=bed+(bed<360?1440:0),
   night=skills.night!==false&&(bed<360?local.minute>=bed&&local.minute<360:local.minute<360||local.minute>=bed);
   if(!night&&
     can('break')&&
     skills.wellbeing!==false&&
     (state.pendingBreak||now-s.focus?.completedAt<5*MIN&&s.focus?.completedAt<=now&&(s.focus?.completedMinutes||s.focus?.minutes)>=25))
     return result('after-focus-'+s.focus?.completedAt,'break','Want a short break?','break',{minutes:5,explicit:true},95);
   if(!night&&can('stretch')&&state.stretchDue&&(s.activity?.active||0)>=45*MIN)return result('stretch-'+local.day,'stretch','Want to stretch for a few minutes?','break',{minutes:5,explicit:true},90);
   if(!night&&urgent&&can('next'))return result('next-'+urgent.id,'next','Want to open '+urgent.title+'?','open',{itemId:urgent.id,courseId:urgent.courseId},90);
   const ready=Object.entries(s.studyAids||{}).find(([key,v])=>
     v&&can(v.kind)&&v.overnight&&!v.gradeAccess&&v.savedAt<=now&&now-v.savedAt<DAY&&!list(ledger.items).includes('biscuit:ready-'+key));
   if(!night&&ready&&s.ai!==false)return result('ready-'+ready[0],'ready','Your saved study aid is ready.','ready',{aidKey:ready[0],itemId:ready[1].itemId},88);
   if(night)return null;
   if(can('plan')&&(s.lastAction?.type==='submission'||s.lastAction==='submission'))return result('after-submission','plan','Submitted. Want to see what fits next?','plan',{local:true},85);
   if(can('plan')&&page==='assignment'&&soon.some(v=>v.id===current)){
     const row=soon.find(v=>v.id===current);
     return result('plan-'+row.id,'plan','Want to give '+row.title+' a time?','plan',{local:true,itemId:row.id},85);
   }
   if(can('plan')&&['dashboard','home'].includes(page)&&evening>=1020&&evening<bedEnd&&soon.length)
     return result('plan-evening-'+local.day,'plan','Want a plan for the time before bed?','plan',{local:true},80);
   // The announcement handoff already exists; include it in the active offer path.
   const unread=s.unreadAnnouncements,id='inbox-'+local.day+'-'+unread;
   if(can('inbox')&&Number.isInteger(unread)&&unread>0&&!list(ledger.items).includes('biscuit:'+id))
     return result(id,'inbox',unread+' new announcement'+(unread===1?'':'s')+'. Want to read?','inbox',{count:unread},70);
   return null;
  }

  return {register:Registry.register,prepare,search,evaluate,offer,normalizeInput:everyday};
 }
 Parse();Clock();
 const shared=create(),
   api={
     create,
     register:Registry.register,
     prepare:shared.prepare,
     search:shared.search,
     evaluate:shared.evaluate,
     offer:shared.offer,
     normalizeInput:shared.normalizeInput,
     distance,
     workflow:load('ReserveBiscuitWorkflow','./biscuit-workflow.js')
   };
 root.ReserveBiscuitEngine=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
