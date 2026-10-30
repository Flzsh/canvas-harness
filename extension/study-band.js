/* Fixed-height Help pages. Content stays in the existing study viewers. */
(function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null);
 // Card sizes are quarters of the band (owner, 2026-10-28): s, m, l and xl take 1/4, 2/4, 3/4 and 4/4 of it. Cards
 // written in quarters carry grid:4; older cards counted thirds and take the next size up, so none is narrower than it
 // was (s to m, m to l, l to xl).
 const sizes={s:1,m:2,l:3,xl:4},SIZE_NAMES=['s','m','l','xl'],UP={s:'m',m:'l',l:'xl'},record=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const bigger=(a,b)=>(sizes[b]||0)>(sizes[a]||0)?b:a;
 function quarterKind(data={}){
   const kind=data.kind||data.tool;
   if(['ask','message','say','remind'].includes(kind))return 's';
   if(['study','translate','today','plan','day-plan'].includes(kind)||kind==='outline'&&data.sections?.length>=4)return 'xl';
   if(['example','examples','test','reading','outline'].includes(kind))return 'l';
   return 'm';
 }
 function thirdsKind(data={}){
   if(['ask','message','remind'].includes(data.kind))return 's';
   if(['today','plan'].includes(data.kind)||data.kind==='outline'&&data.sections?.length>=4)return 'l';
   return 'm';
 }
 function fallbackSize(data={}){
   if(data.grid===4)return sizes[data.size]?data.size:quarterKind(data);
   if(data.size==='xl')return 'xl';
   return UP[['s','m','l'].includes(data.size)?data.size:thirdsKind(data)];
 }
 const time=value=>{
   if(typeof value==='number'&&Number.isFinite(value))return value;
   const at=typeof value==='string'&&value.trim()?Date.parse(value):NaN;
   return Number.isFinite(at)?at:Infinity;
 };
 const HOUR=36e5,DAY=864e5,DELIVER=new Set(['test','examples','reading','translate']),validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
 // Each card's day is the student's calendar day it was made on: the calendar Daily AI help stamps its runs with.
 const calendars=new Map();
 function dayKey(at,zone){
   if(!Number.isFinite(at))return '';
   const Clock=load('CanvasHarnessAgentClock','./agent-clock.js');
   if(!Clock?.calendar)return new Date(at).toISOString().slice(0,10);
   const k=String(zone||'');
   if(!calendars.has(k))calendars.set(k,Clock.calendar(zone||undefined));
   return calendars.get(k)(at).day;
 }
 function dayName(day,today){
   if(day===today)return 'Today';
   const a=Date.parse(day+'T12:00:00Z'),b=Date.parse(today+'T12:00:00Z');
   if(Math.round((b-a)/DAY)===1)return 'Yesterday';
   try{return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(a);}catch{return day;}
 }
 // What CH knows about a card's item: live Canvas items when the page has them (newest due date, hand-in state),
 // else what was saved with the card. Scores are never read.
 const lookups=new WeakMap();
 function factsLookup(source){
   let list=null;
   try{list=typeof source==='function'?source():source;}catch{list=null;}
   if(!Array.isArray(list))return null;
   let map=lookups.get(list);
   if(!map){
     map=new Map();
     for(const it of list){if(!it||it.id==null||it.personal)continue;map.set(String(it.courseId??'')+':'+it.id,it);if(!map.has(':'+it.id))map.set(':'+it.id,it);}
     lookups.set(list,map);
   }
   return (courseId,id)=>id?map.get(String(courseId||'')+':'+id)||map.get(':'+id)||null:null;
 }
 // Tests, quizzes, exams and projects (0) before homework (1) before reading (2): the item's own kind, read from its
 // name and how it is handed in; a practice-test card always counts as test preparation.
 const BIG=/\b(?:tests?|quiz(?:zes)?|exams?|midterms?|finals?|projects?|essays?|papers?|presentations?)\b/i,READ=/\b(?:read(?:ing)?|chapters?|pages|articles?)\b|\bpp\./i;
 function workClass(item,title,saved,cardKind){
  let c=null;const Kind=load('CanvasHarnessStudyKind','./study-kind.js'),name=String(item?item.name||'':title||'');
  if(!item&&saved)c=['quiz','test','essay','project'].includes(saved)?0:saved==='reading'?2:1;
  else if(item||name){
    const f=Kind?.classify?Kind.classify({name,submissionTypes:Array.isArray(item?.submissionTypes)?item.submissionTypes:[]}):null;
    c=f?(['quiz','test','essay'].includes(f.kind)||f.rubric?0:f.reading?2:1):BIG.test(name)?0:READ.test(name)?2:1;
  }
  return cardKind==='test'?0:c??(cardKind==='reading'?2:1);}
 // The ranking facts of one card. tier: 0 missing, 1 due within 36 hours, 2 this week, 3 later, 4 no date (or past
 // without a hand-in), 5 handed in. The Now / This week tag follows the tier; with no due date it keeps the AI's word,
 // unless the card is about an assignment the live Canvas data no longer lists.
 function rankOf(entry,now,live){
  const {aid,data}=entry,
    item=live?live(aid.courseId,aid.itemId):null,
    saved=record(aid.facts),
    due=time(item?item.dueAt??undefined:data.dueAt??data.due??aid.dueAt??aid.due??saved.dueAt);
  // Done is Canvas's hand-in state or the student's own mark in CH (checked off, or progress set to done: work on paper,
  // in class, or with no submission), as Core.isWorkComplete counts it.
  const own=!!item&&(item.checkedOff===true||item.progress==='done'),
    done=item?own||!item.missing&&!item.redoRequested&&['submitted','graded','excused'].includes(item.state):saved.done===true,
    missing=item?.missing===true&&!own,
    known=Number.isFinite(due);
  const tier=missing?0:done?5:!known||due<now?4:due-now<36*HOUR?1:due-now<7*DAY?2:3,said=[1,2,3].includes(data.importance)?data.importance:2;
  // A grade group's weight counts only in a course that weights its groups (Canvas sends group_weight either way).
  const group=item?.assignmentGroup,
    points=Number.isFinite(item?.points)?item.points:Number.isFinite(saved.points)?saved.points:0,
    weight=Number(item?(group?.weighted===true?group.weight??group.groupWeight:0):saved.weight);
  // The AI's own order: its pick order for Daily AI help, else the importance it gave an answer card.
  const ai=(DELIVER.has(data.kind)?0:(said-1)*100)+(Number.isInteger(aid.rank)&&aid.rank>0?aid.rank:entry.legacyRank||50);
  return {
    tier,
    cls:workClass(item,aid.item,saved.kind,data.kind),
    points,
    weight:Number.isFinite(weight)&&weight>0?weight:0,
    due,
    ai,
    importance:tier<=1?1:tier===2?2:tier===4&&!known&&!(live&&aid.itemId)?said:3
  };}
 // One card per assignment on each day: when several answers that day are about the same item, the newest shows (and
 // the newest ticked one stays findable in the day's done pile).
 function newestPerItem(list){
   const newest=new Map(),id=e=>e.aid?.itemId?String(e.day||'')+'|'+(e.done?'done':'')+'|'+String(e.aid.itemId):'';
   for(const e of list){const k=id(e);if(k&&(newest.get(k)??-1)<e.created)newest.set(k,e.created);}
   return list.filter(e=>{const k=id(e);return !k||e.created===newest.get(k);});
 }
 // An answer to a question asked on a card sits inside that card (its "answers"), not beside it; when that card is gone
 // the answer shows on its own.
 // options: done (ticked cards too, marked done), now, zone (the student's time zone), facts (live Canvas items).
 function cardsFrom(aids,options={}){
   const all=entriesFrom(aids,options),
     asked=e=>typeof e.aid.about==='string'&&e.aid.about!==e.key,
     main=newestPerItem(all.filter(e=>!asked(e))),
     keys=new Set(main.map(e=>e.key));
  for(const e of main){const mine=e.index===0?all.filter(a=>asked(a)&&!a.done&&a.aid.about===e.key).sort((a,b)=>a.created-b.created):[];if(mine.length)e.answers=mine;}
  return [...main,...all.filter(e=>asked(e)&&!keys.has(e.aid.about))];}
 function entriesFrom(aids,{done=false,now,zone,facts,live}={}){
  const list=Object.entries(record(aids)),first=new Map(),at=Number.isFinite(now)?now:Date.now(),lookup=live||(facts?factsLookup(facts):null);
  // Cards saved before ranks were kept: a run's cards were saved one millisecond apart, in the AI's order.
  for(const [,aid] of list)
    if(aid?.prepare===true&&!aid.ask&&aid.runId&&Number.isFinite(aid.savedAt))first.set(aid.runId,Math.min(first.get(aid.runId)??Infinity,aid.savedAt));
  return list.flatMap(([key,aid])=>{
   if(!aid||!aid.data)return [];
   const cards=Array.isArray(aid.data.cards)&&aid.data.cards.some(c=>c?.kind)?aid.data.cards:[aid.data],
     created=time(aid.savedAt)===Infinity?0:time(aid.savedAt),
     day=validDay(aid.day)?aid.day:dayKey(created,zone);
   return cards.slice(0,3).map((data,index)=>{
     const entry={key,aid,data,index,size:fallbackSize(data),created,day};
     entry.done=archived(entry);
     if(entry.done&&!done)return null;
     if(first.has(aid.runId)){const n=created-first.get(aid.runId)+1;if(n>=1&&n<=20)entry.legacyRank=n;}
     return Object.assign(entry,rankOf(entry,at,lookup));
   }).filter(Boolean);
  });}
 // A ticked card is archived: single-card aids keep the flag on their progress, multi-card aids per card.
 function archived(entry){
   return entry.aid.data===entry.data?record(entry.aid.progress).archived===true:record(record(entry.aid.progress).cards)[entry.index]?.archived===true;
 }
 // Lapped stacks (owner, 2026-10-28: "lap these cards together and let the user swap the card, leaving just the
 // title"). A card that needs a big size (l or xl) and holds several questions or problems laps them: one part in
 // front, the others behind it showing only their titles, in order. Big cards of the same kind for the same course (or
 // from the same answer) lap the same way, most important in front. Small and medium cards sit side by side. Ticked
 // cards make one done pile at the end of their day. A stack takes the place of its most important card and the size of
 // its largest; raised (a map of card to size) holds the sizes the band raised so the content fits.
 const PART_FIELDS={test:'questions',examples:'problems'},cardId=c=>String(c.key)+'#'+c.index;
 function partViews(data){
   const field=PART_FIELDS[data?.kind],list=field&&Array.isArray(data[field])?data[field]:null;
   if(!list||list.length<2)return null;
   const Study=load('CanvasHarnessStudy','./study-prompts.js');
  return typeof Study?.partCards==='function'?
    Study.partCards(data):
    list.map((part,i)=>
      ({...data,[field]:[part],title:String(part?.title||part?.type||'').trim()||(data.kind==='test'?'Question ':'Problem ')+(i+1),cardTitle:data.title||'',partIndex:i,partCount:list.length}));}
 function stacksFrom(cards,{raised}={}){const groups=new Map(),add=(group,card)=>{if(!groups.has(group))groups.set(group,[]);groups.get(group).push(card);};
  for(const card of cards.slice().sort(compare)){const up=raised?.get?.(cardId(card));if(up)card.size=bigger(card.size,typeof up==='string'?up:up.size);
   // Big cards lap when they are the same kind about one item (its Canvas item, or the ref the AI gave it), or come from
   // the same answer; cards about different items of one course stay apart.
   const kind=card.data.kind||'ask',item=String(card.aid?.itemId||''),ref=String(card.data.ref||''),run=String(card.aid?.runId||''),big=sizes[card.size]>=3;
   if(card.done)
     add('done',card);
   else if(big&&partViews(card.data))
     add('parts:'+cardId(card),card);
   else if(big&&(item||run))add('lap:'+kind+':'+(item?'i'+String(card.aid?.courseId||'')+':'+item:ref?'f'+run+':'+ref:'r'+run),card);else add('one:'+cardId(card),card);}
  return [...groups.entries()].map(([group,list])=>{
    const top=list[0],
      kind=top.data.kind||'ask',
      parts=group.startsWith('parts:'),
      members=parts?partViews(top.data).map((view,part,all)=>({...top,view,part,partCount:all.length})):list;
    let size=list.map(c=>c.size).reduce(bigger,'s');
    if(group==='done'&&list.length>1)size=bigger(size,'m');
   return {
     kind,
     key:'stack:'+group,
     cards:members,
     size,
     lapped:members.length>1,
     parts,
     data:{size,kind,grid:4},
     importance:top.importance,
     due:top.due,
     created:top.created,
     index:top.index,
     tier:top.tier,
     cls:top.cls,
     points:top.points,
     weight:top.weight,
     ai:top.ai,
     done:top.done===true,
     day:top.day
   };});}
 // The text of a card, for a question about it: its questions, problems and their steps, lines, points and terms.
 function cardText(data){
   const out=[data.headline,data.key,data.title].filter(Boolean),
     fields=['text','q','answer','term','means','part','purpose','thesis','next','done','why','type','problem','check','note','quote'],
     lists=['steps','choices'];
  (function walk(v,depth){
    if(depth>3||!v||typeof v!=='object')return;
    if(Array.isArray(v)){for(const x of v)walk(x,depth+1);return;}
    for(const [k,x]of Object.entries(v)){
      if(['tools','src','v','kind','size','importance','unread','gaps'].includes(k))continue;
      if(typeof x==='string'&&fields.includes(k)&&x.trim())
        out.push(x.trim());
      else if(Array.isArray(x)&&lists.includes(k)&&x.every(s=>typeof s==='string'))
        out.push(...x.filter(s=>typeof s==='string'&&s.trim()).map(s=>s.trim()));
      else if(typeof x==='object')walk(x,depth+1);
    }
  })(data,0);
  return [...new Set(out)].join('\n').slice(0,6000);}
 // Most important first (owner, 2026-10-28): missing work and what is due soonest, then tests, quizzes, exams and
 // projects before homework before reading, then more points (or a heavier grade group), then the AI's own order;
 // ties keep the newest answer first, then the saved order (the sort is stable). Done cards follow the rest.
 // One total order (so the same cards always sort the same way): the weighted group's weight (0 when the course does
 // not weight its groups), then points.
 function worth(a,b){return (Number(b.weight)||0)-(Number(a.weight)||0)||(Number(b.points)||0)-(Number(a.points)||0);}
 function compare(a,b){const n=(v,d)=>Number.isFinite(v)?v:d,due=(x,y)=>x===y?0:!Number.isFinite(x)?(Number.isFinite(y)?1:0):!Number.isFinite(y)?-1:x-y;
  return (a.done===true)-(b.done===true)||
    n(a.tier,4)-n(b.tier,4)||
    n(a.cls,1)-n(b.cls,1)||
    worth(a,b)||
    due(a.due,b.due)||
    n(a.ai,50)-n(b.ai,50)||
    n(b.created,0)-n(a.created,0)||
    n(a.index,0)-n(b.index,0);}
 function agentAids(agent={}){
   const out={};
   for(const run of agent.runs||[]){
     if(['expired','error','failed','stopped','cancelled'].includes(run.status))continue;
     const entries=(run.actions||[]).filter(e=>['kept','done','card'].includes(e.outcome)&&!String(e.id).startsWith('expired-')),
       sayAction=entries.find(e=>e.action?.tool==='say')?.action,
       say=sayAction?.text;
     let first=true;
  for(const [i,e]of entries.entries())
    if(e.outcome==='card'&&!['say','today','plan','remind'].includes(e.action?.tool)){
      const a=e.action,title=a.title||a.question||'Prepare suggestion',text=a.text||a.fact||a.why||'Review this suggestion';
      out['agent:'+run.id+':suggestion:'+i]={kind:'ask',title,savedAt:run.at,data:{kind:'ask',title,headline:title,size:'s',grid:4,importance:2,points:[{text,src:''}],next:'',gaps:[]},progress:{}};
    }
  for(const [i,entry]of entries.entries()){
    const action=entry.action;
    if(!['today','plan','remind'].includes(action?.tool))continue;
    const kind=action.tool,headline=action.headline||(first&&say?String(say).split(/\s+/).slice(0,8).join(' '):kind==='today'?'Today':action.title||action.text||'Reminder');
    out['agent:'+run.id+':'+i]={
      kind,
      title:headline,
      savedAt:run.at,
      data:{
        ...action,
        kind,
        headline,
        size:kind==='remind'?'s':SIZE_NAMES.includes(action.size)?action.size:quarterKind({kind}),
        grid:4,
        importance:action.importance||1,
        gaps:[],
        dueAt:action.at||action.day
      },
      progress:{}
    };
    first=false;
  }
  if(first&&say){
    const words=String(say).split(/\s+/),headline=sayAction.headline||words.slice(0,8).join(' '),rest=sayAction.headline?say:words.slice(8).join(' ');
    out['agent:'+run.id+':say']={
      kind:'ask',
      title:headline,
      savedAt:run.at,
      data:{
        kind:'ask',
        title:headline,
        headline,
        key:sayAction.key,
        size:SIZE_NAMES.includes(sayAction.size)?sayAction.size:'s',
        grid:4,
        importance:sayAction.importance||1,
        points:rest?[{text:rest,src:''}]:[],
        next:'',
        gaps:[]
      },
      progress:{}
    };
  }
 }return out;}
 // The ink the last band read (tone()): a band made while a room's move plays starts with it.
 let lastInk='';
 // Pages of four quarters, most important first. When the next card does not fit the room a page has left, a card
 // further on may fill it only if it ranks the same (same tier and kind of work): a less important card never moves
 // ahead of a more important one. narrow: a quarter is too narrow to read (under 280 px), so small cards take half.
 function pack(cards,{narrow=false}={}){
   const remaining=cards.map((c,i)=>{
     let size=(Array.isArray(c.cards)||c.aid)&&sizes[c.size]?c.size:fallbackSize(c.data||c);
     if(narrow&&size==='s')size='m';
     return {...c,_position:i,size};
   }).sort(compare),pages=[];
  while(remaining.length){
    const page=[];
    let room=4;
    while(room&&remaining.length){
      const head=remaining[0],index=sizes[head.size]<=room?0:remaining.findIndex(c=>sizes[c.size]<=room&&c.tier===head.tier&&c.cls===head.cls&&c.done===head.done);
      if(index<0)break;
      const card=remaining.splice(index,1)[0];
      page.push(card);
      room-=sizes[card.size];
    }
    pages.push(page);
  }
  return pages;
 }
 function renderBand(container,aids,{
   env=root,
   scope='',
   store,
   onAsk,
   onPrepare,
   helpItems,
   onDocsAccess,
   onPrepareSettings,
   onPrepareReply,
   prepareChoice,
   onPrepareChoice,
   onProgress=()=>{},
   onTool=()=>{
   throw Error('That control is unavailable.');
 },onError=()=>{},selectedKey='',missed=false,expanded=false,timeZone,itemFacts,now:clock}={}){
  const UI=load('CanvasHarnessStudyUI','./study-ui.js'),d=env.document;
  // stackAt: the card in front of each lapped stack. raised: sizes the band raised so a card's content fits, each with
  // the band width it was measured at (a much wider band measures again).
  const stackAt=new Map(),raised=new Map(),lapsOf=new WeakMap();
  let checks=new WeakMap();
  const zoneNow=()=>{
    try{return typeof timeZone==='function'?timeZone():timeZone;}catch{return undefined;}
  },timeNow=()=>{const v=typeof clock==='function'?Number(clock()):NaN;return Number.isFinite(v)?v:Date.now();};
  // Each day's help (owner, 2026-10-28: "I should be able to know each day's AI content"): every saved day, newest
  // first; a day's pages ranked most important first, with its ticked cards in one done pile at the end.
  const readFacts=()=>{try{return typeof itemFacts==='function'?itemFacts():itemFacts;}catch{return null;}};let builtPrint='',narrow=false;
  // The facts a card's rank reads, as one string: a new list with the same facts (Home builds one on every store write)
  // ranks nothing again.
  function factsPrint(list){
    if(!Array.isArray(list))return '';
    let out='';
    for(const it of list){
      if(!it||it.id==null||it.personal)continue;
      const g=it.assignmentGroup;
      out+=[
        it.courseId,
        it.id,
        it.dueAt,
        it.state,
        it.missing===true,
        it.redoRequested===true,
        it.points,
        g?.weighted===true?g.weight??g.groupWeight:'',
        it.checkedOff===true,
        it.progress==='done'
      ].join('|')+
        '\n';
    }
    return out;
  }
  function build(values){
    const zone=zoneNow(),at=timeNow(),byDay=new Map(),facts=readFacts();
    builtPrint=factsPrint(facts);
    for(const c of cardsFrom(values,{done:true,now:at,zone,facts})){if(!byDay.has(c.day))byDay.set(c.day,[]);byDay.get(c.day).push(c);}
    const days=[...byDay.keys()].sort((a,b)=>a<b?1:a>b?-1:0);
    return {days,pages:days.map(day=>pack(stacksFrom(byDay.get(day),{raised}),{narrow}))};
  }
  function settle(){dayAt=Math.max(0,Math.min(dayAt,model.days.length-1));pages=model.pages[dayAt]||[];}
  // A day the student turned to stays while it has cards; otherwise the band follows the newest day.
  const rebuild=()=>{const day=model.days[dayAt];model=build(current);const i=following?0:model.days.indexOf(day);if(i<0)following=true;dayAt=Math.max(0,i);settle();};
  const observer=typeof env.ResizeObserver==='function'?new env.ResizeObserver(()=>measure()):null,parts=new WeakMap(),opened=new Set();
  let current=aids,
    model=build(aids),
    dayAt=0,
    following=true,
    homePage=0,
    pages=model.pages[0]||[],
    page=0,
    lastArchived=null,
    open=true,
    ready=false,
    disposed=false,
    interacted=false,
    pending=Promise.resolve(),
    askStatus='',
    asking=false;
  const make=(tag,text,cls)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn,cls)=>{const n=make('button',text,cls);n.type='button';n.addEventListener('click',fn);return n;};
  // The stage holds the page shown (and, while it slides away, the picture of the page leaving). Its one grid row is
  // what a change of height animates: from the old height to the new one, measured, never by tweening height itself.
  let viewport=make('div',undefined,'ch-band-page');const stage=make('div',undefined,'ch-band-stage');stage.append(viewport);
  const band=make('section',undefined,'ch-help-band'),
    panel=make('div',undefined,'ch-band-panel'),
    toolbar=make('div',undefined,'ch-band-toolbar'),
    dots=make('nav',undefined,'ch-band-dots'),
    status=make('span','','ch-band-status');
  band.setAttribute('aria-label','Help answers');
  band.tabIndex=0;
  viewport.setAttribute('aria-label','Help cards');
  dots.setAttribute('aria-label','Help pages');
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  const tab=button('Push Help up',()=>setOpen(!open),'ch-band-tab'),prev=button('Previous page',()=>flip(page-1),'ch-band-prev'),next=button('Next page',()=>flip(page+1),'ch-band-next');
  toolbar.append(make('span','Help','ch-band-title'));
  // The day shown: its name on a paper tag between drawn arrows to the day before and the day after ("Today" on
  // today). Days with no help are not in the list, so every step lands on help.
  const dayBox=make('div',undefined,'ch-band-day'),
    dayLabel=make('time','','ch-band-day-label'),
    dayPrev=button('Previous day',()=>stepDay(1),'ch-band-day-prev'),
    dayNext=button('Next day',()=>stepDay(-1),'ch-band-day-next');
  dayBox.setAttribute('role','group');
  dayBox.setAttribute('aria-label','Help day');
  dayLabel.setAttribute('aria-live','polite');
  dayBox.append(dayPrev,dayLabel,dayNext);
  dayBox.hidden=true;
  toolbar.append(dayBox);
  const prepareLine=make('div',undefined,'ch-prepare-status'),prepareText=make('span'),prepareButton=button('Open chat',async()=>{
    if(!prepareRun?.id)return;
    try{
      if(prepareRun.needsYou?.action==='Read reply'){await env.chrome.runtime.sendMessage({target:'ch-ai-engine',op:'resume',scopeKey:ownerScope,runId:prepareRun.id});return;}
      if(prepareRun.needsYou?.action==='Try again'){await env.chrome.runtime.sendMessage({target:'ch-ai-engine',op:'retry',scopeKey:ownerScope,runId:prepareRun.id});return;}
      if(prepareRun.needsYou?.action==='Review settings'&&onPrepareSettings){onPrepareSettings();return;}
      await env.chrome.runtime.sendMessage({target:'ch-ai-engine',op:'open',scopeKey:ownerScope,runId:prepareRun.id});
    }catch(error){onError(error);}
  },'ch-prepare-action');
  let prepareRun=null,pendingAsk='';
  const cardRuns=new Set(),ownerScope=scope.split('|').slice(0,2).join('|');
  prepareLine.setAttribute('role','status');
  prepareLine.setAttribute('aria-live','polite');
  prepareLine.append(prepareText,prepareButton);
  prepareLine.hidden=true;
  // Daily AI help's progress (the ink track): it fills as the run goes from Canvas to your AI to the help to Ready; each
  // stage's drawing sits on the track and is colored and moving while its stage runs. Drawn as SVG elements.
  const NS='http://www.w3.org/2000/svg',svg=typeof d.createElementNS==='function'?(tag,attrs={},...kids)=>{
    const n=d.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
    for(const kid of kids)n.append(kid);
    return n;
  }:null;
  let track=null,trackFill=null,trackStage=-1,creep=0,creepTimer=0;const trackSteps=[],trackLabels=[];
  if(svg){
   const at=[64,238,412,590],y=20.5,ink=(dd,w=1.5)=>svg('path',{d:dd,class:'ch-progress-ink',fill:'none','stroke-width':w,'stroke-linecap':'round','stroke-linejoin':'round'});
   const icon=[
    x=>
      [
        svg(
          'g',
          {class:'mv'},
          svg('circle',{class:'wash',cx:x-1.6,cy:y-1.6,r:4.6,fill:'#BFDDEA'}),
          ink('M'+(x-1.6)+' '+(y-6.6)+'c-2.9 0-5.1 2.3-5.1 5.1 0 2.9 2.3 5.1 5.1 5 2.8 0 5-2.3 5-5.1 0-2.7-2.2-5-5-5M'+(x+2.3)+' '+(y+2.4)+'l3.9 3.9',1.6))
      ],
    x=>
      [
        svg('path',{class:'wash',d:'M'+(x-6.2)+' '+(y-5.4)+'c4.6-.5 9.6-.4 12.2.3.6 2.3.5 5.4-.2 7.4-2.5.4-5 .3-6.9.3l-3.4 3 .4-3.1c-1-.1-1.8-.4-2.4-.8-.4-2-.3-5 .3-7.1z',fill:'#F6DE9A',transform:'translate(.8 .9)'}),
        ink('M'+(x-6.6)+' '+(y-6.2)+'c4.6-.5 9.6-.4 12.2.3.6 2.3.5 5.4-.2 7.4-2.5.4-5 .3-6.9.3l-3.4 3 .4-3.1c-1-.1-1.8-.4-2.4-.8-.4-2-.3-5 .3-7.1z'),
        ...[-3.4,0,3.4].map((dx,i)=>svg('circle',{class:'dot d'+(i+1),cx:x-.4+dx,cy:y-2.3,r:.95,fill:'currentColor'}))
      ],
    x=>
      [
        svg('path',{class:'trail',d:'M'+(x-7)+' '+(y+7.4)+'c3-1.8 5.4 1.2 8.4-.6s5.4-1.8 8.4 0',fill:'none','stroke-width':1.3,'stroke-linecap':'round'}),
        svg(
          'g',
          {class:'mv'},
          svg('path',{class:'wash',d:'M'+(x-4.4)+' '+(y+4.6)+'l2-6 8-8.2c1.1-1.1 2.8-1 3.7.1 1 1.1.8 2.6-.1 3.6l-8.2 8z',fill:'#E6C478',transform:'translate(.7 .7)'}),
          ink('M'+(x-5.1)+' '+(y+4)+'l2-6 8-8.2c1.1-1.1 2.8-1 3.7.1 1 1.1.8 2.6-.1 3.6l-8.2 8zM'+(x-3.1)+' '+(y-2)+'l4.1 3.8'))
      ],
    x=>
      [svg('circle',{class:'wash',cx:x,cy:y,r:7.6,fill:'#B7CBA5'}),svg('path',{class:'tick',d:'M'+(x-5)+' '+(y+.4)+'l3.6 3.8 7.2-8.6',fill:'none','stroke-width':2.2,'stroke-linecap':'round','stroke-linejoin':'round'})]];
   trackFill=svg('rect',{class:'ch-progress-fill',x:11,y:16.9,width:618,height:7.2,rx:2.4});
   track=svg('svg',{class:'ch-progress',viewBox:'0 0 640 50','aria-hidden':'true',focusable:'false'},svg('path',{class:'ch-progress-rail',d:'M8 15.6C40 13.8 140 14.4 240 14.9C340 13.9 450 15.2 560 14.5C600 14.2 622 14.6 630.4 14.8C633 17 633.4 23.6 630.2 26.4C560 27.6 450 26.2 330 27C220 27.7 110 26.4 40 26.9C20 27.1 11 26.6 8 25C6.6 21.6 7 17.8 9.4 15.2'}),trackFill);
   at.forEach((x,i)=>{
     const step=svg('g',{class:'ch-progress-step','data-step':i,'data-state':'wait'},svg('circle',{class:'ch-progress-disc',cx:x,cy:y,r:11.6}),...icon[i](x));
     trackSteps.push(step);
     const label=svg('text',{class:'ch-progress-label',x,y:46,'text-anchor':'middle','data-state':'wait'});
     label.textContent=['Reading Canvas','Asking your AI','Making help','Ready'][i];
     trackLabels.push(label);
     track.append(step,label);
   });
   track.toggleAttribute?.('hidden',true);
  }
  // Drawn icons for the Help controls: ink over an offset color wash, like the progress track; each moves on hover.
  const ICONS={
   ask:[['wash','M4.6 5.2c4.8-.6 10.4-.5 13.4.3.7 2.6.6 6-.2 8.2-2.8.4-5.6.3-7.6.3l-3.8 3.4.5-3.4c-1.2-.1-2-.5-2.7-.9-.4-2.2-.3-5.6.4-7.9z','#F6DE9A'],['ink','M4.6 5.2c4.8-.6 10.4-.5 13.4.3.7 2.6.6 6-.2 8.2-2.8.4-5.6.3-7.6.3l-3.8 3.4.5-3.4c-1.2-.1-2-.5-2.7-.9-.4-2.2-.3-5.6.4-7.9z'],['dot d1','M8.1 9.6h.01',2.4],['dot d2','M11.2 9.6h.01',2.4],['dot d3','M14.3 9.6h.01',2.4]],
   more:[['wash','M7 3.6h12v14H7z','#BFDDEA'],['ink back','M4.6 6.6c-.3 4.4-.2 9.4.1 13.8 3.4.3 7.4.3 10.8 0'],['ink','M7.4 3.8c3.6-.3 8-.3 11.3.1.4 4.4.4 9.4 0 13.6-3.6.3-7.6.2-11.2 0-.4-4.4-.4-9.2-.1-13.7z'],['ink acc blue','M13 7.4v6.4M9.8 10.6h6.4',1.8]],
   check:[['wash','M5 3.8c4-.3 8.2-.3 11.6 0 .4 5 .4 11 0 16-3.8.3-7.8.3-11.6 0-.4-5-.4-11 0-16z','#B7CBA5'],['ink','M5 3.8c4-.3 8.2-.3 11.6 0 .4 5 .4 11 0 16-3.8.3-7.8.3-11.6 0-.4-5-.4-11 0-16z'],['ink faint','M7.6 8h6.4M7.6 11h4',1.1],['ink acc green tick','M8 15.2l2.4 2.6 6.6-7.6',2]],
   pin:[['wash','M9.2 3.6l7.2 7.2-2.4.8-3.6 3.6.2 3.2-1.4 1.4-8.4-8.4 1.4-1.4 3.2.2 3.6-3.6z','#E8B4A0'],['ink head','M9.2 3.6l7.2 7.2-2.4.8-3.6 3.6.2 3.2-1.4 1.4-8.4-8.4 1.4-1.4 3.2.2 3.6-3.6z'],['ink','M6.8 15.2l-4 4.2']],
   done:[['wash','M11 3.4a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2z','#B7CBA5'],['ink','M11.2 3.4c4.4-.1 7.8 3.4 7.6 7.8-.2 4.2-3.6 7.6-7.8 7.5-4.2 0-7.6-3.6-7.4-7.8.2-4 3.4-7.4 7.6-7.5z'],['ink acc green tick','M7.4 11.4l2.6 2.8 5-6',2]],
   list:[['wash','M4.4 3.6h13.4v15.6H4.4z','#BFDDEA'],['ink','M4.4 3.6c4.6-.3 9.4-.3 13.4 0 .4 5 .4 10.6 0 15.6-4.4.3-9 .3-13.4 0-.4-5-.4-10.6 0-15.6z'],['ink acc blue tick','M6.8 7.6l1.2 1.3 2-2.4M6.8 12.4l1.2 1.3 2-2.4',1.5],['ink faint','M11.6 8h3.8M11.6 12.8h3.8M7.2 16.6h8',1.2]],
   paste:[['wash','M5.4 5h11.2v14H5.4z','#F6DE9A'],['ink','M7.6 4.4H5.4c-.5 4.8-.4 9.8 0 14.6 3.8.3 7.6.3 11.2 0 .4-4.8.4-9.8 0-14.6h-2.2'],['ink','M8 3.2h6v2.6H8z'],['ink faint','M8 10h6M8 13h4.4',1.1]],
   send:[['ink','M5 11h11M11.6 6.4L16.2 11l-4.6 4.6',2]],
   back:[['wash','M11 4.4c3.7-.1 6.7 2.9 6.6 6.6 0 3.7-3 6.6-6.7 6.6-3.6-.1-6.5-3-6.5-6.7.1-3.6 3-6.5 6.6-6.5z','#F6DE9A'],['ink','M13 6.1c-1.5 1.6-3 3.2-4.5 4.8 1.5 1.6 3.1 3.2 4.6 4.9',1.7]],
   fwd:[['wash','M11 4.4c3.7-.1 6.7 2.9 6.6 6.6 0 3.7-3 6.6-6.7 6.6-3.6-.1-6.5-3-6.5-6.7.1-3.6 3-6.5 6.6-6.5z','#F6DE9A'],['ink','M9 6.1c1.5 1.6 3 3.2 4.5 4.8-1.5 1.6-3.1 3.2-4.6 4.9',1.7]],
   top:[['wash','M5.6 4.2c3.2-1.2 5.6 1.4 9-.1-.6 2.4-.5 4.5.3 6.5-3.4 1.3-5.8-1.3-9 .1z','#DE9A7C'],['ink','M5 19.2c.2-5 .1-10.2-.3-15.2M5.2 4.4c3.2-1.3 5.7 1.3 9.1-.2-.6 2.4-.5 4.6.3 6.6-3.4 1.4-5.8-1.3-9.1 0',1.5]],
   sun:[['wash','M11 5.4a5.4 5.4 0 1 1 0 10.8 5.4 5.4 0 0 1 0-10.8z','#F6C94A'],['ink','M11 6.6c2.5-.1 4.5 2 4.4 4.5-.1 2.4-2.1 4.4-4.5 4.3-2.4 0-4.3-2-4.3-4.4.1-2.4 2-4.3 4.4-4.4z'],['ink rays','M11 1.8v2.3M11.1 17.9v2.3M1.8 11h2.3M17.9 11.1h2.3M4.5 4.6l1.6 1.6M15.9 15.9l1.6 1.6M4.6 17.5l1.6-1.6M15.9 6.1l1.6-1.6']]};
  function icon(name){
   if(!svg)return make('span','','ch-band-ico');const g=svg('svg',{class:'ch-band-ico ch-band-ico-'+name,viewBox:'0 0 22 22','aria-hidden':'true',focusable:'false'});
   for(const [kind,dd,extra] of ICONS[name]||[])
     g.append(kind==='wash'?
       svg('path',{class:'wash',d:dd,fill:extra,transform:'translate(1 1)'}):
       svg('path',{class:kind,d:dd,fill:'none','stroke-width':extra||1.5,'stroke-linecap':'round','stroke-linejoin':'round'}));
   return g;}
  // A control is its drawing and its name.
  function drawn(b,name){b.dataset.act=name;b.replaceChildren(icon(name),make('span',b.textContent,'ch-band-act-label'));return b;}
  for(const [b,name] of [[dayPrev,'back'],[dayNext,'fwd']])b.replaceChildren(icon(name),make('span',b.textContent,'ch-sr-only'));
  // The most important card of the day carries a small drawn pennant, named for screen readers; nothing else says so.
  function topMark(){const m=make('span',undefined,'ch-band-top');m.setAttribute('role','img');m.setAttribute('aria-label','Most important');m.append(icon('top'));return m;}
  // A chip or a sheet's small button: its words set after it is made.
  function plain(text,cls){const b=make('button');b.className=cls;b.textContent=text;return b;}
  // Typing in a drawer stays in the drawer: Home's keys and the companion never see it.
  const keep=field=>{for(const type of ['keyup','keypress','input','beforeinput','compositionstart','compositionend'])field.addEventListener(type,event=>event.stopPropagation());};
  const KIND_NAMES={test:'practice tests',examples:'worked examples',reading:'reading breakdowns',translate:'translation help'};
  let drawerFor=null,notes=[],sheetKind='';
  const stageOf=run=>run.state==='cards-ready'?[3,1,1]:['queued','scanning'].includes(run.state)||!run.phase?[0,.08,.26]:run.phase==='deliver'?(()=>{
    const step=Array.isArray(run.step)?run.step:[0,1],n=Math.max(1,Number(step[1])||1),i=Math.min(n-1,Math.max(0,Number(step[0])||0));
    return run.state==='publishing'?[2,.96,.98]:[2,.5+.44*i/n,.5+.44*(i+1)/n-.02];
  })():[1,.32,.46];
  function setTrack(run){
   if(!track)return;const [stage,base,cap]=stageOf(run);if(stage!==trackStage){trackStage=stage;creep=Math.max(creep,base);}else creep=Math.max(creep,base);
   const show=()=>{trackFill.style.transform='scaleX('+Math.min(1,creep).toFixed(3)+')';};show();
   trackSteps.forEach((g,i)=>g.setAttribute('data-state',stage===3||i<stage?'done':i===stage?'on':'wait'));
   trackLabels.forEach((t,i)=>t.setAttribute('data-state',stage===3||i<stage?'done':i===stage?'on':'wait'));
   trackLabels[2].textContent=stage===2?String(run.progress||'Making help').slice(0,44):'Making help';trackLabels[3].textContent=stage===3?String(run.progress||'Ready').slice(0,32):'Ready';
   env.clearInterval?.(creepTimer);creepTimer=0;
   // A long wait still moves: the fill creeps toward the next stage without reaching it.
   if(stage<3&&typeof env.setInterval==='function')
     creepTimer=env.setInterval(()=>{if(disposed){env.clearInterval?.(creepTimer);return;}creep=Math.min(cap,creep+(cap-creep)*.06);show();},1500);
  }
  function prepare(value){
    if(disposed||!value||prepareRun?.id===value.id&&prepareRun.revision>value.revision)return;
    const finished=['cards-ready','cancelled','failed','unchanged','expired','needs-you'],wasBusy=!!prepareRun&&!finished.includes(prepareRun.state);
    prepareRun=value;
    if(pendingAsk&&askStatus===pendingAsk){askStatus=pendingAsk='';status.textContent=pages.length?`${page+1} / ${pages.length}`:'No answers yet';}
    prepareLine.hidden=value.state==='cards-ready'||value.state==='unchanged'&&value.entry==='visit';
    prepareText.textContent=value.needsYou?.reason||value.progress||'Checking Canvas';
    prepareButton.hidden=value.state!=='needs-you';
    prepareButton.textContent=value.needsYou?.action||'Open chat';
   // While help is being made (and as it finishes) the track shows the stage; a stop or a question shows its words.
   if(track){
     const live=!finished.includes(value.state)||value.state==='cards-ready';
     track.toggleAttribute?.('hidden',!live);
     if(live){
       if(track.parentNode!==prepareLine||prepareLine.children?.[0]!==track)prepareLine.insertBefore?.(track,prepareText)??prepareLine.append(track);
       setTrack(value);
     }
     else{env.clearInterval?.(creepTimer);creepTimer=0;trackStage=-1;creep=0;}
     prepareText.classList?.toggle('ch-sr-only',live);
   }
   if(daily){const busy=!finished.includes(value.state);daily.disabled=busy;if(dailyLabel)dailyLabel.textContent=busy?'Preparing…':'Daily AI help';}
   // A run this band watched finish says so for a moment and turns to the first page, where the new help sits. A run
   // started from a card (Ask or Check my work on it, More) lands in that card, on its own day: the band stays there.
   if(wasBusy&&value.state==='cards-ready'){
     prepareLine.hidden=false;
     prepareText.textContent=value.progress||'Ready';
     env.clearTimeout?.(readyTimer);
     readyTimer=env.setTimeout?.(()=>{if(!disposed&&prepareRun===value)prepareLine.hidden=true;},10000);
     if(cardRuns.has(value.id)){cardRuns.delete(value.id);return;}
     following=true;
     if(dayAt!==0)stepDay(-dayAt);else if(pages.length)flip(0);
   }}
  const receive=(message,sender)=>{if(message?.target==='ch-ai-run'&&message.scope===ownerScope&&(!sender?.id||sender.id===env.chrome?.runtime?.id))prepare(message.run);};
  env.chrome?.runtime?.onMessage?.addListener(receive);
  if(env.chrome?.runtime?.sendMessage&&UI.storageKey(ownerScope))
    Promise.resolve(env.chrome.runtime.sendMessage({target:'ch-ai-engine',op:'subscribe',scopeKey:ownerScope})).then(r=>{if(r?.ok)prepare(r.result);}).catch(()=>{});
  // Daily AI help: Prepare runs now, through the same AI way as the automatic daily run.
  let daily=null,dailyLabel=null,readyTimer=0;
  if(typeof onPrepare==='function'){
    daily=button('Daily AI help',async()=>{
      if(disposed||daily.disabled)return;
      daily.disabled=true;
      if(dailyLabel)dailyLabel.textContent='Preparing…';
      prepareLine.hidden=false;
      prepareText.textContent='Checking Canvas';
      prepareButton.hidden=true;
      try{
        const run=await onPrepare();
        if(!disposed&&run?.id)prepare(run);else if(!disposed)daily.disabled=false;
      }catch(error){if(!disposed){daily.disabled=false;if(dailyLabel)dailyLabel.textContent='Daily AI help';prepareText.textContent=String(error.message||error);onError(error);}}
    },'ch-band-daily');
    dailyLabel=make('span','Daily AI help','ch-band-daily-label');
    daily.replaceChildren(icon('sun'),dailyLabel);
    toolbar.append(daily);
  }
  // Once, where the student first meets Your AI: may Daily AI help run on its own? One sentence and two drawn choices;
  // it stays changeable in Tools → AI (Prepare every day). Until the student picks, Prepare runs only on a press.
  const choice=make('div',undefined,'ch-band-choice'),choiceText=make('span');
  choice.hidden=true;
  if(typeof prepareChoice==='function'&&typeof onPrepareChoice==='function'){
    const pick=everyDay=>async()=>{
      if(disposed||choice.dataset.busy)return;
      choice.dataset.busy='true';
      try{await onPrepareChoice(everyDay);if(!disposed)choice.hidden=true;}catch(error){if(!disposed)onError(error);}finally{delete choice.dataset.busy;}
    };
    const choose=(label,everyDay,drawing)=>{
      const b=drawn(button(label,pick(everyDay),'ch-band-act ch-band-bar-act'),drawing);
      b.dataset.act=everyDay?'every-day':'when-asked';
      return b;
    };
    choice.append(choiceText,choose('Every day',true,'sun'),choose('Only when I ask',false,'ask'));
  }
  function showChoice(){
    if(disposed||typeof prepareChoice!=='function'||typeof onPrepareChoice!=='function'||choice.dataset.busy)return;
    let value=null;
    try{value=prepareChoice();}catch{}
    const cap=Number(value?.cap),times=Number.isInteger(cap)&&cap>1?'up to '+cap+' times a day':'once a day';
    choiceText.textContent='Daily AI help can run on its own: it sends your AI a summary of your Canvas work (courses, due work, announcements, teacher messages) when you open Canvas and when that work changes, '+times+'.';
    choice.hidden=value?.show!==true;
  }
  // The bar: Help with… (pick items and the kind of help) and Remembered (every note), each opening a sheet under it.
  const sheet=make('div',undefined,'ch-band-sheet');sheet.hidden=true;let helpWith=null,remembered=null;
  if(typeof onAsk==='function'&&typeof helpItems==='function'){
    helpWith=drawn(button('Help with…',()=>openSheet(sheetKind==='help'?'':'help'),'ch-band-act ch-band-bar-act'),'list');
    toolbar.append(helpWith);
  }
  if(store?.getNotes){
    remembered=drawn(button('Remembered',()=>openSheet(sheetKind==='notes'?'':'notes'),'ch-band-act ch-band-bar-act'),'pin');
    toolbar.append(remembered);
    Promise.resolve(store.getNotes(scope)).then(list=>{notes=Array.isArray(list)?list:[];showNotesCount();}).catch(()=>{});
  }
  const undo=button('Undo',restore,'ch-band-undo');
  undo.hidden=true;
  toolbar.append(status,undo,dots,prev,next);
  panel.append(toolbar,choice,sheet,prepareLine,stage);
  showChoice();
  band.append(panel,tab);
  container.replaceChildren(band);
  // The band's washes follow the ink, not the theme's name: a scene or Market kit with light ink on a dark ground gets
  // the dark washes even when it is not marked dark. Read from the day tag, whose text is the theme's ink.
  // The read is a style read of the whole page. While a room's move plays (data-ch-moving on the dashboard: Home drawn
  // again under a fold, or swapped out for a room) it waits until the move has landed and the browser is idle; a band
  // made meanwhile starts with the ink the last band read (the look does not change in a move). Read in the render
  // that swapped the page, it was a quarter of a second of the fold's long frame at 4x CPU.
  let toneWait=0;
  function tone(){
   const until=Number(band.closest?.('.rd')?.dataset?.chMoving||0)-Date.now();
   if(until>0&&typeof env.setTimeout==='function'){
     if(!band.dataset.ink&&lastInk)band.dataset.ink=lastInk;
     if(!toneWait)
       toneWait=env.setTimeout(()=>{
         const go=()=>{toneWait=0;if(!disposed)tone();};
         if(typeof env.requestIdleCallback==='function')env.requestIdleCallback(go,{timeout:800});else go();
       },until+40)||0;
     return;
   }
   toneNow();
  }
  function toneNow(){
    try{
      const c=String(env.getComputedStyle?.(dayLabel)?.color||''),n=(c.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
      if(n.length<3)return;
      const k=n.every(v=>v<=1)&&/color\(/.test(c)?1:255,l=n.map(v=>{v/=k;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;}),L=.2126*l[0]+.7152*l[1]+.0722*l[2],ink=L>.5?'light':'dark';
      lastInk=ink;
      if(band.dataset.ink!==ink)band.dataset.ink=ink;
    }catch{}
  }
  tone();
  const themeHost=band.closest?.('.rd')||d.documentElement,themeWatch=typeof env.MutationObserver==='function'&&themeHost?new env.MutationObserver(()=>tone()):null;
  themeWatch?.observe(themeHost,{attributes:true,attributeFilter:['data-theme','data-theme-kit','class','style']});
  function showNotesCount(){
    if(!remembered)return;
    const label=remembered.querySelector?.('.ch-band-act-label')||remembered.children?.[1];
    if(label)label.textContent=notes.length?'Remembered · '+notes.length:'Remembered';
  }
  function openSheet(kind){
    sheetKind=kind;
    for(const b of [helpWith,remembered])b?.setAttribute('aria-expanded',String(!!b&&(b===helpWith?kind==='help':kind==='notes')));
    sheet.replaceChildren();
    sheet.hidden=!kind;
    sheet.dataset.kind=kind||'';
    if(kind==='help')sheet.append(...helpSheet());
    if(kind==='notes')sheet.append(...notesSheet());
    measure();
  }
  // Help with…: up to three items, the kind of help (or the AI picks), and anything to add.
  function helpSheet(){
   const list=(helpItems()||[]).filter(i=>i&&i.id).slice(0,14),
     picked=new Set(),
     kinds=[['auto','Your AI picks'],['test','Practice test'],['examples','Worked examples'],['reading','Reading'],['translate','Translation']];
   let make_='auto';
   const left=make('div',undefined,'ch-band-sheet-col'),
     right=make('div',undefined,'ch-band-sheet-col'),
     line=make('input',undefined,'ch-band-drawer-input'),
     note=make('span','','ch-band-drawer-status'),
     go=make('button');
   left.append(make('h3','Pick items','ch-band-sheet-title'));if(!list.length)left.append(make('p','Nothing coming up.','ch-band-sheet-empty'));
   for(const item of list){
     const row=make('button');
     row.type='button';
     row.className='ch-band-pick';
     row.setAttribute('aria-pressed','false');
     row.append(make('span','','ch-band-box'),make('span',String(item.title||'Item'),'ch-band-pick-title'),make('span',String(item.when||''),'ch-band-pick-when'));
     if(item.course)row.dataset.course=String(item.course);
    row.addEventListener('click',()=>{
      if(picked.has(item))picked.delete(item);else if(picked.size<3)picked.add(item);
      row.setAttribute('aria-pressed',String(picked.has(item)));
      go.disabled=!picked.size;
    });
    left.append(row);
   }
   right.append(make('h3','Help','ch-band-sheet-title'));const chips=make('div',undefined,'ch-band-chips');
   for(const [value,label] of kinds){
     const chip=plain(label,'ch-band-chip');
     chip.type='button';
     chip.setAttribute('aria-pressed',String(value===make_));
     chip.addEventListener('click',()=>{make_=value;for(const c of chips.children)c.setAttribute('aria-pressed',String(c===chip));});
     chips.append(chip);
   }
   line.type='text';
   line.maxLength=240;
   line.placeholder='Anything to add';
   keep(line);
   go.type='button';
   go.className='ch-band-go';
   go.disabled=true;
   go.setAttribute('aria-label','Make help');
   go.append(icon('send'));
   const run=async()=>{
     if(!picked.size||asking)return;
     asking=true;
     go.disabled=true;
     note.textContent='Asking your AI…';
     try{
       const items=[...picked].map(i=>({itemId:String(i.id),courseId:String(i.courseId||''),itemTitle:String(i.title||'')})),
         result=await onAsk(line.value.trim()||'Make the help for these items.',{itemId:items[0].itemId,courseId:items[0].courseId,itemTitle:items[0].itemTitle,items,make:make_});
       if(disposed)return;
       if(result!==true&&result?.ok!==true){note.textContent=result?.message||'Help is unavailable here.';return;}
       if(result?.run)prepare(result.run);
       openSheet('');
     }catch(error){note.textContent=String(error.message||error);onError(error);}finally{asking=false;go.disabled=!picked.size;}
   };
   go.addEventListener('click',run);line.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'&&!event.isComposing){event.preventDefault();void run();}});
   const row=make('div',undefined,'ch-band-drawer-row');row.append(line,go);right.append(chips,row,note);return [left,right];}
  // Remembered: every note, where it applies, each removable.
  function notesSheet(){
   const box=make('div',undefined,'ch-band-sheet-col ch-band-notes');
   box.append(make('h3','Remembered','ch-band-sheet-title'));
   if(!notes.length)box.append(make('p','Nothing remembered yet.','ch-band-sheet-empty'));
   for(const n of notes){
     const row=make('div',undefined,'ch-band-note'),
       where=n.scope==='all'?'All cards':n.scope==='kind'?'All '+(KIND_NAMES[n.kind]||'cards'):'This card'+(n.title?' · '+n.title:''),
       remove=button('Remove',()=>{},'ch-band-note-remove');
     remove.type='button';
    remove.addEventListener('click',async()=>{
      try{await store.removeNote(scope,n.id);notes=notes.filter(x=>x.id!==n.id);showNotesCount();openSheet('notes');}catch(error){onError(error);}
    });
    row.append(make('span',where,'ch-band-note-where'),make('span',n.text,'ch-band-note-text'),remove);
    box.append(row);
   }
   return [box];}
  // One drawer at a time, inside its card; opening one unfolds it like a notecard.
  function toggleDrawer(id,kind){
    drawerFor=drawerFor?.id===id&&drawerFor.kind===kind?null:{id,kind,text:''};
    redraw();
    if(drawerFor)viewport.querySelector?.('.ch-band-drawer input, .ch-band-drawer textarea')?.focus?.({preventScroll:true});
  }
  function drawerNode(entry,kind){
   const {data,aid,key}=entry,
     box=make('div',undefined,'ch-band-drawer'),
     note=make('span','','ch-band-drawer-status'),
     row=make('div',undefined,'ch-band-drawer-row'),
     long=kind==='paste',
     field=make(long?'textarea':'input',undefined,'ch-band-drawer-input'),
     go=make('button');
   box.dataset.kind=kind;
   if(!long)field.type='text';
   field.maxLength=long?30000:2000;
   field.value=drawerFor?.text||'';
   note.textContent=drawerFor?.note||'';
   if(drawerFor){drawerFor.field=field;drawerFor.noteNode=note;}
   field.placeholder={ask:'Ask about this card',check:'Your answer',remember:'What your AI should do',paste:'Paste the Doc here'}[kind]||'';
   field.addEventListener('input',()=>{if(drawerFor)drawerFor.text=field.value;});
   keep(field);
   go.type='button';go.className='ch-band-go';go.setAttribute('aria-label',{ask:'Ask',check:'Check',remember:'Save',paste:'Use it'}[kind]||'Send');go.append(icon('send'));
   // A part of a lapped stack is asked about on its own, and is checked as its number in the whole set.
   const view=entry.view||data,part=Number.isInteger(entry.part)?entry.part:-1;
   const about={card:{key,headline:data.headline||data.title||'',text:cardText(view)},itemId:aid.itemId||'',courseId:aid.courseId||'',itemTitle:aid.item||''};
   let number=part>=0?part+1:0,scopeOf='card';
   if(kind==='check'&&part<0){
     const n=Math.min(12,(data.questions||data.problems||data.lines||data.points||[]).length);
     if(n){
       const chips=make('div',undefined,'ch-band-chips ch-band-numbers');
       for(let i=1;i<=n;i++){
         const chip=plain(String(i),'ch-band-chip');
         chip.type='button';
         chip.setAttribute('aria-pressed','false');
         chip.addEventListener('click',()=>{number=number===i?0:i;for(const c of chips.children)c.setAttribute('aria-pressed',String(c===chip&&number===i));});
         chips.append(chip);
       }
       box.append(chips);
     }
   }
   if(kind==='remember'){
     const chips=make('div',undefined,'ch-band-chips');
     for(const [value,label] of [['card','This card'],['kind','All '+(KIND_NAMES[data.kind]||'cards like this')],['all','All cards']]){
       const chip=plain(label,'ch-band-chip');
       chip.type='button';
       chip.setAttribute('aria-pressed',String(value===scopeOf));
       chip.addEventListener('click',()=>{scopeOf=value;for(const c of chips.children)c.setAttribute('aria-pressed',String(c===chip));});
       chips.append(chip);
     }
     box.append(chips);
   }
   // The band may redraw while a question is on its way: the line shown is the current drawer's.
   const say=t=>{note.textContent=t;if(drawerFor){drawerFor.note=t;if(drawerFor.noteNode)drawerFor.noteNode.textContent=t;}};
   const send=async redo=>{const text=field.value.trim();if(!text||asking)return;asking=true;go.disabled=true;say(kind==='remember'?'Saving…':'Asking your AI…');
    try{let result;
     if(kind==='remember'){
       const saved=await store.addNote(scope,{scope:scopeOf==='kind'&&!KIND_NAMES[data.kind]?'all':scopeOf,kind:data.kind,itemId:aid.itemId||'',title:aid.item||data.title||'',text});
       notes=[...notes,saved].slice(-40);
       showNotesCount();
       remembered?.classList?.add('is-new');
       env.setTimeout?.(()=>remembered?.classList?.remove('is-new'),1200);
       if(!redo){note.textContent='Saved';drawerFor=null;env.setTimeout?.(()=>{if(!disposed)redraw();},700);return;}
       result=await onAsk('Make this help again, following my notes.',{...about,make:KIND_NAMES[data.kind]?data.kind:'auto'});
     }
     else if(kind==='paste'){
       const doc=(data.unread||[])[0]||{};
       result=await onAsk('Make this help again with the text I pasted.',{itemId:about.itemId,courseId:about.courseId,itemTitle:about.itemTitle,make:'auto',pasted:text,pastedTitle:String(doc.title||'')});
     }
     else result=await onAsk(kind==='check'?'Check my work'+(number?' on number '+number:'')+': '+text+'\nSay whether it is right. If it is not, show the first step that goes wrong and how to fix it.':text,about);
     if(disposed)return;if(result!==true&&result?.ok!==true){say(result?.message||'Help is unavailable here.');return;}
     drawerFor=null;if(result?.run){if(kind==='ask'||kind==='check')cardRuns.add(result.run.id);prepare(result.run);}redraw();}
    catch(error){say(String(error.message||error));onError(error);}finally{asking=false;go.disabled=false;}};
   go.addEventListener('click',()=>send(false));
   field.addEventListener('keydown',event=>{
     event.stopPropagation();
     if(event.isComposing||event.keyCode===229)return;
     if(event.key==='Escape'){event.preventDefault();drawerFor=null;redraw();}else if(event.key==='Enter'&&!long&&!event.shiftKey){event.preventDefault();void send(false);}
   });
   row.append(icon(kind==='paste'?'paste':kind==='remember'?'pin':kind==='check'?'check':'ask'),field,go);box.append(row);
   if(kind==='remember'){const redo=button('Save and redo',()=>{},'ch-band-chip ch-band-redo');redo.type='button';redo.addEventListener('click',()=>send(true));box.append(redo);}
   box.append(note);return box;}
  // More: new questions or problems like the card's, added to the same card.
  async function more(entry,acts){if(asking)return;asking=true;const {data,aid,key}=entry;acts.dataset.busy='true';
   try{
     const result=await onAsk('Make more like this card.',{
       card:{key,headline:data.headline||data.title||'',text:cardText(data)},
       itemId:aid.itemId||'',
       courseId:aid.courseId||'',
       itemTitle:aid.item||'',
       make:data.kind,
       more:true
     });
     if(disposed)return;
     if(result!==true&&result?.ok!==true){status.textContent=askStatus=result?.message||'Help is unavailable here.';return;}
     if(result?.run){cardRuns.add(result.run.id);prepare(result.run);}
   }
   catch(error){status.textContent=askStatus=String(error.message||error);onError(error);}finally{asking=false;delete acts.dataset.busy;}}

  function persist(){
    if(!ready||!store?.setBandState)return;
    const value={open,page:dayAt===0?page:homePage};
    pending=pending.catch(()=>{}).then(()=>store.setBandState(scope,value)).catch(onError);
  }
  function setOpen(value,save=true){
    open=value===true;
    panel.hidden=pages.length>0&&!open;
    if(open)toolbar.append(tab);else band.append(tab);
    tab.textContent=open?'Push Help up':'Pull Help down';
    tab.setAttribute('aria-expanded',String(open));
    if(open)measure();
    if(save){interacted=true;persist();}
    return open;
  }
  function reduced(){
    return env.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true||
      env.document?.documentElement?.dataset?.motion==='reduced'||
      ['off','still'].includes(band.closest?.('[data-motion-style]')?.dataset?.motionStyle);
  }
  // Motion (owner: "extremely fluent and transitions well"): transform and opacity only, the band's one easing with a
  // little anticipation and settle, 190-300 ms. Every read comes before every write, and a new input starts from where
  // things are. Nothing moves while the band is off screen or the tab is hidden, or when motion is reduced or off.
  const EASE='cubic-bezier(.34,-.08,.22,1.14)',SETTLE='cubic-bezier(.22,1,.36,1)',AWAY='cubic-bezier(.55,0,.75,.25)',gone=node=>()=>node.remove();
  let onScreen=true;
  const seen=typeof env.IntersectionObserver==='function'?new env.IntersectionObserver(rows=>{for(const r of rows)onScreen=r.isIntersecting;}):null;
  seen?.observe(band);
  function still(){
    return reduced()||env.document?.hidden===true||!onScreen||panel.hidden||band.isConnected!==true||typeof viewport.animate!=='function'||typeof env.getComputedStyle!=='function';
  }
  function settleIn(cards,delay=0){
    cards.forEach((card,i)=>card.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:240,delay:delay+i*45,easing:SETTLE,fill:'backwards'}));
  }
  // A layer leaving moves away on the ease-in while its opacity drops fast on the ease-out (110 ms), and what arrives
  // waits about 70 ms before it shows: text is never printed over text for more than a frame or two.
  function away(node,frames,from=1,duration=200){
    const move=node.animate(frames,{duration,easing:AWAY,fill:'forwards'}),
      dim=node.animate([{opacity:Number.isFinite(from)?from:1},{opacity:0}],{duration:110,easing:SETTLE,fill:'forwards'});
    return Promise.all([move.finished,dim.finished]);
  }
  // Height: the stage's one grid row goes from the height it had to the one it has now (a measured reveal), so the band
  // and everything under it move smoothly; height itself is never tweened. holdHeight reads the height now (mid-change
  // too) and lets go of a change still running, so a new input starts from where things are.
  let stageAnim=null;
  function holdHeight(){
    const h=Number(stage.getBoundingClientRect?.().height)||0;
    if(stageAnim){stageAnim.cancel();stageAnim=null;delete stage.dataset.resizing;}
    return h;
  }
  function easeHeight(h0){if(still()||typeof stage.animate!=='function'||!(h0>0))return;const h1=Number(stage.getBoundingClientRect().height)||0;if(!(Math.abs(h1-h0)>1))return;
   stage.dataset.resizing='true';const a=stage.animate([{gridTemplateRows:h0+'px'},{gridTemplateRows:h1+'px'}],{duration:300,easing:SETTLE});stageAnim=a;
   a.finished.then(()=>{if(stageAnim===a){stageAnim=null;delete stage.dataset.resizing;}},()=>{});}
  // Redraw in place (a drawer opening or closing): the height change eases.
  function redraw(){const h0=holdHeight();draw();easeHeight(h0);}
  // The page shown becomes a still picture of itself where it stands (its cards keep their layout; nothing is moved or
  // rebuilt) and a new, empty page takes its place in the band for the change to draw into.
  function detach(){const old=viewport,top=old.offsetTop,left=old.offsetLeft,width=old.offsetWidth,height=old.offsetHeight;
   viewport=make('div',undefined,'ch-band-page');viewport.setAttribute('aria-label','Help cards');stage.insertBefore(viewport,old);
   old.classList.add('ch-band-leaving');
   old.removeAttribute('aria-label');
   old.setAttribute('aria-hidden','true');
   old.inert=true;
   old.style.cssText='top:'+top+'px;left:'+left+'px;width:'+width+'px;height:'+height+'px';
   return old;}
  // A page or a day changes: the cards there slide out the way the student goes while the next ones slide in, and the
  // band's height eases from the old page's to the new one's.
  function slide(dir,change,label=false){
   if(still()||viewport.hidden||!viewport.children.length){holdHeight();change();return;}
   const h0=holdHeight(),cs=env.getComputedStyle(viewport),from=cs.transform,fade=Number(cs.opacity),dx=Math.round(Math.max(22,Math.min(44,viewport.offsetWidth*.035)))*dir;
   for(const a of viewport.getAnimations?.()||[])a.cancel();
   const old=detach();sliding=true;try{change();}finally{sliding=false;}
   easeHeight(h0);
   away(old,[{transform:from&&from!=='none'?from:'translateX(0)'},{transform:'translateX('+(-dx)+'px)'}],fade,190).then(gone(old),gone(old));
   viewport.animate([{transform:'translateX('+dx+'px)'},{transform:'translateX(0)'}],{duration:300,easing:EASE});
   settleIn(Array.from(viewport.children),70);
   if(label)dayLabel.animate([{transform:'translateX('+Math.round(dx*.3)+'px)',opacity:0},{transform:'none',opacity:1}],{duration:240,delay:40,easing:EASE,fill:'backwards'});
  }
  // Which cards a slot shows: its card, or for a lapped stack the card in front (front) or all of them.
  function idsOf(node,frontOnly){
    const s=lapsOf.get(node),list=s?frontOnly?[s.panels[frontOf(s.stack)]]:s.panels:[node];
    return list.filter(Boolean).map(c=>(c.dataset.aidKey||'')+'|'+(c.dataset.kind||'')+'|'+(c.dataset.part||''));
  }
  // Cards change in place (a tick, an answer arriving): those that stay glide from where they were, also a card that
  // moved into another slot (ticked into the day's done pile); one that left the page fades where it stood (in the old
  // page's picture) before anything glides over its place; a new one settles in.
  function reflow(change){
   if(still()||viewport.hidden){holdHeight();change();return;}
   const h0=holdHeight(),before=new Map();
   for(const c of Array.from(viewport.children))
     before.set(c.dataset.slot,{node:c,box:c.getBoundingClientRect(),fade:Number(env.getComputedStyle(c).opacity),ids:idsOf(c,true)});
   const old=before.size?detach():null;change();
   const after=Array.from(viewport.children).map(c=>[c,c.getBoundingClientRect()]),pairs=new Map(),used=new Set(),fresh=[],leaving=[];
   for(const [c] of after){const w=before.get(c.dataset.slot);if(w&&!used.has(w)){pairs.set(c,w);used.add(w);}}
   for(const [c] of after){
     if(pairs.has(c))continue;
     const mine=new Set(idsOf(c,false));
     for(const w of before.values())if(!used.has(w)&&w.ids.some(id=>mine.has(id))){pairs.set(c,w);used.add(w);break;}
   }
   const departing=[...before.values()].some(w=>!used.has(w));easeHeight(h0);
   for(const [c,box] of after){
     const w=pairs.get(c);
     if(!w){fresh.push(c);continue;}
     const dx=w.box.left-box.left,dy=w.box.top-box.top;
     if(Math.abs(dx)>.5||Math.abs(dy)>.5)c.animate([{transform:'translate('+dx+'px,'+dy+'px)'},{transform:'none'}],{duration:300,delay:departing?60:0,easing:EASE,fill:'backwards'});
   }
   for(const w of before.values()){
     if(used.has(w)){w.node.style.visibility='hidden';continue;}
     leaving.push(w.node.animate(
       [{opacity:Number.isFinite(w.fade)?w.fade:1,transform:'none'},{opacity:0,transform:'translateY(-6px) scale(.97)'}],
       {duration:120,easing:SETTLE,fill:'forwards'}).finished.catch(()=>{}));
   }
   if(old){if(leaving.length)Promise.all(leaving).then(gone(old));else old.remove();}
   if(fresh.length)settleIn(fresh,before.size?90:0);
  }
  let drawing=0;
  function draw(){drawing++;try{drawNow();}finally{drawing--;}tone();}
  function drawNow(){
   // An open drawer keeps what is typed in it, however the band redraws.
   if(drawerFor?.field)drawerFor.text=drawerFor.field.value;
   const focusedDot=Array.from(dots.children).indexOf(d.activeElement),focusedTab=String(d.activeElement?.dataset?.lapTab||'');
   const empty=pages.length===0;band.dataset.empty=String(empty);prev.hidden=next.hidden=dots.hidden=viewport.hidden=tab.hidden=empty;panel.hidden=!empty&&!open;
   band.dataset.reducedMotion=String(reduced());page=Math.max(0,Math.min(Math.max(0,pages.length-1),page));
   const today=dayKey(timeNow(),zoneNow()),day=model.days[dayAt]||'';
   dayBox.hidden=!day;
   dayLabel.textContent=day?dayName(day,today):'';
   dayLabel.setAttribute('datetime',day);
   dayPrev.hidden=dayNext.hidden=model.days.length<2;
   dayPrev.disabled=dayAt>=model.days.length-1;
   dayNext.disabled=dayAt===0;
   band.dataset.day=!day?'':day===today?'today':'earlier';
   const active=pages.flat().filter(s=>!s.done),first=page===0&&active.length>1?active[0]:null;
   prev.disabled=page===0;
   next.disabled=page>=pages.length-1;
   status.textContent=askStatus||(pages.length?`${page+1} / ${pages.length}`:'No answers yet');
   if(!askStatus&&typeof undo!=='undefined')undo.hidden=true;
   band.dataset.grown='false';observer?.disconnect();viewport.replaceChildren();dots.replaceChildren();
   let last=null,used=0;
   for(const stack of pages[page]||[]){
    const node=stack.lapped?lapNode(stack,stack===first):cardNode(stack,stack.cards[0],stack===first);
    node.dataset.size=stack.size;node.dataset.slot=stack.key;viewport.append(node);last=node;used+=sizes[stack.size]||1;
   }
   // A page with room left over lets its last card widen by one size at most (a small card to half, never a one-line card
   // across the band); any room past that stays quiet paper.
   if(last&&used<4){const own=sizes[last.dataset.size]||1;last.dataset.fill=String(Math.min(own+1,own+4-used));}
   for(let i=0;i<pages.length;i++){
     const dot=button('•',()=>flip(i),'ch-band-dot');
     dot.setAttribute('aria-label','Help page '+(i+1));
     dot.setAttribute('aria-current',i===page?'page':'false');
     dots.append(dot);
   }
   if(focusedDot>=0)dots.children[focusedDot]?.focus({preventScroll:true});
   if(focusedTab)for(const slot of Array.from(viewport.children))lapsOf.get(slot)?.tabs.find(t=>t.dataset.lapTab===focusedTab)?.focus?.({preventScroll:true});
   // Nothing opens on its own; a card the student opened stays open.
   // A card with a drawer open grows to show it with its rows.
   const shown=visibleCards(),full=shown.find(c=>c.dataset.drawer)||shown.find(c=>opened.has(c.dataset.aidKey+'#'+c.dataset.kind))||(expanded?shown[0]:null);
   if(full)grow(full,true);else measure();
   prefetch();
  }
  // The cards a slot holds (a lapped stack holds several) and the one of each that shows.
  function allCards(){return Array.from(viewport.children).flatMap(slot=>lapsOf.get(slot)?.panels||[slot]);}
  function visibleCards(){return Array.from(viewport.children).map(slot=>{const s=lapsOf.get(slot);return s?s.panels[frontOf(s.stack)]:slot;});}
  // One card: its title strip (pennant, Now tag, title, the line under it, actions), its drawer, its content and tools.
  // A part of a lapped stack shows its one question or problem; what it reveals is kept under its place in the set.
  function cardNode(stack,entry,first){
   const {data,aid,key,index}=entry,part=Number.isInteger(entry.part)?entry.part:-1,card=make('article',undefined,'ch-band-card');
   card.dataset.size=stack.size;
   card.dataset.kind=data.kind;
   card.dataset.importance=String(entry.importance);
   card.dataset.aidKey=key;
   if(entry.done)card.dataset.done='true';
   if(part>=0)card.dataset.part=String(part);
   const head=make('div',undefined,'ch-band-head'),slot=make('div',undefined,'ch-band-slot');
   card.append(head,slot);
   if(first)head.append(topMark());
   if(!entry.done&&(entry.importance===1||entry.importance===2))head.append(make('span',entry.importance===1?'Now':'This week','ch-band-when'));
   // The title joins the card's title line, and so does the line under it (the count and what is missing).
   const shown=viewFor(entry),scroll=shown.scroll;shown.owner.card=card;if(shown.title)head.append(shown.title);if(shown.lead)head.append(shown.lead);
   card.append(body(card,scroll));observer?.observe(scroll);if(scroll.firstElementChild)observer?.observe(scroll.firstElementChild);
   const Tools=load('CanvasHarnessStudyTools','./study-tools.js'),tools=Tools?.normalizeTools?Tools.normalizeTools(data.tools):[];
   if(tools.length){
     const chips=make('div',undefined,'ch-band-tools'),feedback=make('span','','ch-band-tool-status');
     feedback.setAttribute('role','status');
     for(const tool of tools){
       const chip=button(tool.label,async()=>{
         chip.disabled=true;
         feedback.textContent='';
         try{
           const practice=Tools?.IDS&&tool.id===Tools.IDS.practice&&aid.prepare&&typeof onAsk==='function',
             result=practice?await onAsk('Make a practice set for '+(aid.item||data.title||'this'),{itemId:aid.itemId||'',courseId:aid.courseId||'',itemTitle:aid.item||''}):await onTool(tool,{key,aid});
           if(result===false||result?.ok===false)throw Error(result?.message||'That control is unavailable.');
           feedback.textContent=result?.message||'Done.';
         }catch(error){feedback.textContent=String(error.message||error);onError(error);}finally{chip.disabled=false;}
       },'ch-band-tool');
       chip.dataset.controlId=tool.id;
       chips.append(chip);
     }
     chips.append(feedback);
     card.append(chips);
   }
   // The card's actions: Ask, More (tests and worked examples), Check my work (the four kinds of help), Remember, Done.
   const id=key+'#'+index+(part>=0?'#'+part:''),acts=make('div',undefined,'ch-band-acts'),help=['test','examples','reading','translate'].includes(data.kind);
   if(typeof onAsk==='function'){
     acts.append(drawn(button('Ask',()=>toggleDrawer(id,'ask'),'ch-band-act'),'ask'));
     if(['test','examples'].includes(data.kind)&&aid.itemId)acts.append(drawn(button('More',()=>more(entry,acts),'ch-band-act'),'more'));
     if(help)acts.append(drawn(button('Check my work',()=>toggleDrawer(id,'check'),'ch-band-act'),'check'));
   }
   if(store?.addNote)acts.append(drawn(button('Remember',()=>toggleDrawer(id,'remember'),'ch-band-act'),'pin'));
   const done=button('Done',()=>archive(entry),'ch-band-act ch-band-done');
   done.dataset.act='done';
   done.setAttribute('aria-pressed',String(entry.done===true));
   done.replaceChildren(icon('done'),make('span','Done','ch-band-act-label'));
   acts.append(done);
   if(drawerFor?.id===id)slot.append(drawerNode(entry,drawerFor.kind));
   head.append(acts);if(drawerFor?.id===id)card.dataset.drawer=drawerFor.kind;
   return card;
  }
  // A card's content (its viewer), kept while the card, its data and what the student revealed stay the same: a page
  // flip, a day change, a tick or a drawer opening puts the same content back instead of building it again (the maths
  // is the slow part, power run 2026-10-28: 283 ms frames at 4x CPU). Questions asked on the card and a Doc CH could not
  // read sit at its top. build:false only says whether a kept one is ready.
  const views=new WeakMap();let sliding=false;
  function viewFor(entry,{build=true}={}){
   const {data,aid,key,index}=entry,view=entry.view||data,part=Number.isInteger(entry.part)?entry.part:-1,id=key+'#'+index+(part>=0?'#'+part:'');
   const own=()=>aid.data===data?record(aid.progress):record(record(record(aid.progress).cards)[index]),keep=progress=>{
     if(aid.data===data)aid.progress=progress;else aid.progress={...record(aid.progress),cards:{...record(aid.progress?.cards),[index]:progress}};
     onProgress(key,aid.progress);
   };
   const field=part>=0&&data.kind==='test'?'question:':'',progressShown=()=>{
     const p=own();
     return field?{...p,revealed:record(p.revealed)[field+part]===true?{[field+0]:true}:{}}:p;
   },signature=()=>JSON.stringify([progressShown(),missed&&key===selectedKey,(entry.answers||[]).map(a=>a.key+'@'+a.created)]);
   let kept=views.get(aid);if(!kept){kept=new Map();views.set(aid,kept);}const at=index+'#'+part,hit=kept.get(at),sig=signature();
   // Kept content still shown in the picture of a page sliding away is cloned for that picture (much cheaper than building
   // it again); a picture already gone (detached, though it keeps its class) takes nothing.
   if(hit&&hit.data===data&&hit.sig===sig){
     if(sliding&&hit.scroll.isConnected&&hit.scroll.closest?.('.ch-band-leaving')&&typeof hit.scroll.cloneNode==='function'){
       const g=hit.scroll.cloneNode(true);
       g.querySelectorAll?.('[id]').forEach(n=>n.removeAttribute('id'));
       hit.scroll.replaceWith(g);
     }
     return hit;
   }
   if(!build)return null;
   const scroll=make('div',undefined,'ch-band-scroll'),owner={card:null},rec={data,sig,scroll,owner,title:null,lead:null};
   scroll.tabIndex=0;
   scroll.setAttribute('aria-label',(data.headline||data.title||'Help')+(part>=0?' · '+view.title:'')+' content');
   // A row opening inside a folded card: its body unfolds over the next 280 ms, so its height (extra) is added to what the
   // card holds now to tell whether the card must grow to show it.
   const opening=(open,extra=0)=>{
     const card=owner.card,sc=card&&parts.get(card)?.scroll;
     if(card&&sc&&open&&card.dataset.open!=='true'&&Number(sc.scrollHeight)+(Number(extra)||0)>Number(sc.clientHeight)+2){opened.add(key+'#'+data.kind);grow(card,true);return;}
     measure();
   };
   const cardAid={...aid,kind:data.kind,title:aid.data===data?aid.title:data.title||aid.title,data:view,progress:progressShown()};let ok=true;
   try{
     UI.renderViewer(scroll,cardAid,{env,embedded:true,missed:missed&&key===selectedKey,onRow:opening,onProgress:progress=>{
       if(!field)
         keep(progress);
       else{const p=own(),revealed={...record(p.revealed)};if(record(progress.revealed)[field+0]===true)revealed[field+part]=true;keep({...p,revealed});}
       rec.sig=signature();
     },onError});
   }catch(error){ok=false;scroll.replaceChildren(make('p','This answer can\x27t be shown here.','ch-band-broken'));onError(error);}
   const has=(n,c)=>String(n?.className||'').split(' ').includes(c),aidNode=scroll.children?.[0],title=aidNode?.children?.[0];if(has(title,'ch-band-headline'))rec.title=title;
   const content=Array.from(aidNode?.children||[]).find(n=>has(n,'ch-study-content')),lead=content?.children?.[0];if(has(lead,'ch-study-meta'))rec.lead=lead;
   if(entry.answers?.length){
     const qa=answersBlock(entry.answers,opening);
     if(scroll.firstChild&&typeof scroll.insertBefore==='function')scroll.insertBefore(qa,scroll.firstChild);else scroll.append(qa);
   }
   // A Google Doc the item links that CH could not read: Read (where this install may) and Paste.
   const unread=Array.isArray(data.unread)?data.unread.filter(u=>u&&u.title):[];
   if(unread.length&&typeof onAsk==='function'){
     const note=make('div',undefined,'ch-band-unread');
     note.append(icon('paste'),make('span','Not read: '+unread.map(u=>u.title).join(', '),'ch-band-unread-text'));
     if(unread.some(u=>u.reason==='permission')&&typeof onDocsAccess==='function')note.append(drawn(button('Read',()=>onDocsAccess(),'ch-band-act ch-band-chip'),'list'));
     note.append(drawn(button('Paste',()=>toggleDrawer(id,'paste'),'ch-band-act ch-band-chip'),'paste'));
     if(scroll.firstChild&&typeof scroll.insertBefore==='function')scroll.insertBefore(note,scroll.firstChild);else scroll.append(note);
   }
   if(ok)kept.set(at,rec);return rec;}
  // The pages beside the one shown, and the page each neighbouring day opens on, are built ahead while the browser is
  // idle (after any slide has settled), so turning to them moves content that is already there.
  let ahead=0,aheadRun=0;
  function prefetch(){const run=++aheadRun;if(disposed||typeof env.setTimeout!=='function')return;env.clearTimeout?.(ahead);
   const idle=fn=>typeof env.requestIdleCallback==='function'?env.requestIdleCallback(fn,{timeout:2500}):env.setTimeout(()=>fn(null),160);
   const near=()=>
     [
       ...[page+1,page-1].flatMap(i=>(pages[i]||[]).flatMap(s=>s.cards)),
       ...[dayAt-1,dayAt+1].flatMap(i=>(model.pages[i]?.[i===0?Math.min(homePage,Math.max(0,(model.pages[0]||[]).length-1)):0]||[]).flatMap(s=>s.cards))
     ];
   const work=deadline=>{
     if(disposed||run!==aheadRun||env.document?.hidden)return;
     for(const entry of near()){
       if(viewFor(entry,{build:false}))continue;
       if(deadline&&deadline.timeRemaining()<10){idle(work);return;}
       viewFor(entry);
       if(!deadline){idle(work);return;}
     }
   };
   ahead=env.setTimeout(()=>idle(work),450);}
  // ---- Lapped stacks (owner, 2026-10-28: "lap these cards together and let the user swap the card, leaving just the
  // title so the user knows the information in the card"). The front card shows in full; the cards behind it peek out as
  // index-card tabs, number and title, in order, never over the front card's text. A tab, a swipe or drag, the arrow
  // keys on the tabs, or Previous card / Next card bring a card to the front with a short slide (instant when motion is
  // reduced or off). For assistive tech it is a tablist of the titles with the front card as its tabpanel. ----
  let lapCount=0,raising=0;
  function frontOf(stack){return Math.max(0,Math.min(Number(stackAt.get(stack.key))||0,stack.cards.length-1));}
  function lapName(stack){
    if(stack.done)return 'Done';
    if(stack.parts){const top=stack.cards[0];return String(top.data.headline||top.data.title||top.aid?.title||'Help');}
    return {test:'Practice tests',examples:'Worked examples',reading:'Reading breakdowns',translate:'Translation help'}[stack.kind]||'Help cards';
  }
  // A tab is the part's own title; for cards lapped together, the short "title" the AI wrote for each (when the cards'
  // titles differ), else the headline.
  function tabTitle(stack,entry){
    const clean=v=>String(v||'').replace(/\s+/g,' ').trim(),
      own=clean(entry.data.title),
      distinct=!stack.parts&&own&&new Set(stack.cards.map(c=>clean(c.data.title))).size===stack.cards.length;
    return clean(stack.parts?entry.view?.title:distinct?own:entry.data.headline||entry.data.title||entry.aid?.title)||'Help';
  }
  function lapNode(stack,first){
   const n=stack.cards.length,
     uid='ch-lap-'+(++lapCount),
     lap=make('div',undefined,'ch-band-lap'),
     bar=make('div',undefined,'ch-band-lap-bar'),
     list=make('div',undefined,'ch-band-tabs'),
     deck=make('div',undefined,'ch-band-deck'),
     steps=make('div',undefined,'ch-band-lap-step'),
     state={stack,tabs:[],panels:[],list,deck,rows:1,width:0,need:0,last:-1e9};
   lap.dataset.lapped=String(n);if(stack.parts)lap.dataset.parts='true';if(stack.done)lap.dataset.done='true';list.setAttribute('role','tablist');list.setAttribute('aria-label',lapName(stack));
   stack.cards.forEach((entry,i)=>{
     const title=tabTitle(stack,entry),tab=make('button',title,'ch-band-lap-tab'),panel=cardNode(stack,entry,first);
     tab.type='button';
     tab.id=uid+'-tab-'+i;
     panel.id=uid+'-card-'+i;
     tab.dataset.lapTab=stack.key+'|'+i;
    tab.setAttribute('role','tab');
    tab.setAttribute('aria-controls',panel.id);
    tab.setAttribute('aria-label',(i+1)+'. '+title);
    tab.replaceChildren(make('span',String(i+1),'ch-band-lap-n'),make('span',title,'ch-band-lap-t'));
    panel.setAttribute('role','tabpanel');
    panel.setAttribute('aria-labelledby',tab.id);
    tab.addEventListener('click',event=>{if(Number(event?.timeStamp)-state.last<400)return;turn(lap,i,{dir:Math.sign(i-frontOf(stack))||1});});
    tab.addEventListener('keydown',event=>{
      const k=event.key,at=frontOf(stack),to=k==='ArrowRight'?at+1:k==='ArrowLeft'?at-1:k==='Home'?0:k==='End'?n-1:null;
      if(to===null||event.altKey||event.ctrlKey||event.metaKey)return;
      event.preventDefault?.();
      event.stopPropagation?.();
      turn(lap,to,{dir:k==='ArrowLeft'||k==='Home'?-1:1,focus:true});
    });
    state.tabs.push(tab);state.panels.push(panel);list.append(tab);deck.append(panel);});
   const back=button('Previous card',()=>turn(lap,frontOf(stack)-1,{dir:-1}),'ch-band-lap-prev'),fwd=button('Next card',()=>turn(lap,frontOf(stack)+1,{dir:1}),'ch-band-lap-next');
   for(const [b,name] of [[back,'back'],[fwd,'fwd']])b.replaceChildren(icon(name),make('span',b.textContent,'ch-sr-only'));
   steps.append(back,fwd);
   bar.append(list,steps);lap.append(bar,deck);lapsOf.set(lap,state);front(lap,frontOf(stack));gestures(lap,state);return lap;}
  function front(lap,at){const s=lapsOf.get(lap);s.tabs.forEach((t,k)=>{const on=k===at;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;t.dataset.front=String(on);});
   s.panels.forEach((p,k)=>{
     const on=k===at;
     p.dataset.front=String(on);
     p.inert=!on;
     if(!on)p.setAttribute('aria-hidden','true');else if(typeof p.removeAttribute==='function')p.removeAttribute('aria-hidden');else p.setAttribute('aria-hidden','false');
   });
   lap.dataset.front=String(at+1);
  }
  // What moves when a card comes to the front: the whole card, or for the parts of one card only its content (the
  // title strip they share stays where it is).
  function mover(s,panel){return s.stack.parts?parts.get(panel)?.box||panel:panel;}
  function turn(lap,to,{dir=1,focus=false}={}){
   const s=lapsOf.get(lap);if(!s||disposed)return;const {stack,panels,tabs}=s,n=panels.length,from=frontOf(stack);to=((to%n)+n)%n;
   if(to===from){if(focus)tabs[to].focus?.({preventScroll:true});return;}
   interacted=true;const old=panels[from],neu=panels[to],motion=!still();
   // Every read first: where the two cards are now (mid-slide or mid-drag too) and where the tabs stand.
   const now=motion?[old,neu].map(p=>{
     const node=mover(s,p),cs=env.getComputedStyle(node);
     return {
       node,
       transform:cs.transform&&cs.transform!=='none'?cs.transform:'none',
       opacity:Number(cs.opacity),
       moving:(node.getAnimations?.()||[]).length>0||!!node.style?.transform
     };
   }):null;
   const dx=motion?Math.round(Math.max(18,Math.min(40,(Number(lap.offsetWidth)||0)*.035)))*dir:0,wasOpen=old.dataset.open==='true';
   // Then the writes. Only the two cards trading places are retargeted: a card still leaving from an earlier swap
   // finishes its own way out (its own end puts it away).
   stackAt.set(stack.key,to);
   for(const p of [old,neu]){
     const node=mover(s,p);
     for(const a of node.getAnimations?.()||[])a.cancel();
     if(node.style?.transform)node.style.transform='';
     if(node.style?.willChange)node.style.willChange='';
     p.classList?.toggle('is-leaving',false);
   }
   front(lap,to);
   if(motion){
    // The card in front moves off on the first frame and is nearly clear within 70 ms; the new one slides in at once and
    // shows from 60 ms, settling with a little overshoot.
    const [a,b]=now;old.classList.toggle('is-leaving',true);
    away(a.node,[{transform:a.transform},{transform:'translate('+(-dx)+'px,4px) scale(.985)'}],a.opacity).then(()=>{
      old.classList.toggle('is-leaving',false);
      for(const x of a.node.getAnimations?.()||[])x.cancel();
    },()=>{});
    b.node.animate([{transform:b.moving?b.transform:'translate('+dx+'px,-3px)'},{transform:'none'}],{duration:300,easing:EASE});
    b.node.animate([{opacity:b.moving?b.opacity:0},{opacity:1}],{duration:220,delay:b.moving?0:60,easing:SETTLE,fill:'backwards'});
   }
   if(focus)tabs[to].focus?.({preventScroll:true});
   // A swap changes no size or width: only the new front card is read, for its Show all, after the slide has begun.
   if(wasOpen)grow(neu,true);else fitSoon(neu);}
  // The tabs keep their order (1, 2, 3 … left to right, then the next row): a title first wraps to two lines inside its
  // tab, and only titles that still cannot share one row wrap onto another, in order; no title is ever cut and clicking
  // a tab never moves it. rowsFor counts the rows that wrapping makes, from each tab's measured width. When any title
  // takes two lines, every tab of the stack keeps room for two (data-tall), so the tabs match across rows too; a title's
  // lines depend only on its words, and a stack whose cards change is built again, so this is set once.
  function rowsFor(n,w,need){
    if(!(w>0)||!need.length)return 1;
    const gap=4;
    let rows=1,line=0;
    for(const v of need){const wide=Math.min(v,w);if(line&&line+gap+wide>w){rows++;line=wide;}else line+=(line?gap:0)+wide;}
    return rows;
  }
  function placeTabs(lap,width,widths,tall){
    const s=lapsOf.get(lap);
    if(!s)return;
    if(tall&&s.list.dataset.tall!=='true')s.list.dataset.tall='true';
    if(width>0)s.width=width;
    if(Array.isArray(widths)&&widths.some(v=>v>34))s.widths=widths;
    const w=s.width,need=s.widths||[];
    if(!(w>0)||!need.length)return;
   const rows=rowsFor(s.tabs.length,w,need);if(rows===s.rows)return;s.rows=rows;if(rows>1)s.list.dataset.rows=String(rows);else delete s.list.dataset.rows;}
  // Swipe or drag the stack sideways (touch anywhere on it; a mouse on its tabs or title strip, so text stays
  // selectable), or swipe sideways on a touchpad: the next card comes to the front. A short drag settles back.
  function gestures(lap,s){
   let drag=null,wheel=0,wheelAt=-1e9,locked=false;const {stack}=s;
   lap.addEventListener('pointerdown',event=>{
     const el=event.target;
     if(!event.isPrimary||event.button>0||typeof el?.closest!=='function')return;
     if(el.closest('input,textarea,select,a,[contenteditable="true"],.ch-math-block,.ch-band-drawer,.ch-band-lap-step')||el.closest('button')&&!el.closest('.ch-band-lap-tab'))return;
     if(event.pointerType==='mouse'&&!el.closest('.ch-band-lap-bar,.ch-band-head'))return;
     drag={id:event.pointerId,x:event.clientX,y:event.clientY,t:event.timeStamp,on:false,node:null};
   });
   lap.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const x=event.clientX-drag.x,y=event.clientY-drag.y;
    if(!drag.on){
      if(Math.abs(y)>14&&Math.abs(y)>Math.abs(x)){drag=null;return;}
      if(Math.abs(x)<8||Math.abs(x)<Math.abs(y)*1.3)return;
      drag.on=true;
      drag.node=mover(s,s.panels[frontOf(stack)]);
      for(const a of drag.node.getAnimations?.()||[])a.cancel();
      if(drag.node.style&&!still())drag.node.style.willChange='transform';
      try{lap.setPointerCapture(event.pointerId);}catch{}
      lap.dataset.dragging='true';
      env.getSelection?.()?.removeAllRanges?.();
    }
    if(still())return;const move=Math.round(x*.85);drag.node.style.transform='translateX('+move+'px) rotate('+(move/110).toFixed(2)+'deg)';});
   const end=event=>{
     if(!drag||event.pointerId!==drag.id)return;
     const g=drag;
     drag=null;
     if(!g.on)return;
     delete lap.dataset.dragging;
     s.last=Number(event.timeStamp)||0;
     const x=event.clientX-g.x,speed=x/Math.max(1,event.timeStamp-g.t);
    if(event.type!=='pointercancel'&&(Math.abs(x)>64||Math.abs(x)>24&&Math.abs(speed)>.5)){turn(lap,frontOf(stack)+(x<0?1:-1),{dir:x<0?1:-1});return;}
    const node=g.node;
    if(node.style)node.style.willChange='';
    if(!node.style?.transform)return;
    if(still()){node.style.transform='';return;}
    const at=env.getComputedStyle(node).transform;
    node.style.transform='';
    node.animate([{transform:at},{transform:'none'}],{duration:260,easing:SETTLE});
   };
   lap.addEventListener('pointerup',end);lap.addEventListener('pointercancel',end);
   lap.addEventListener('wheel',event=>{
     const x=Number(event.deltaX)||0;
     if(Math.abs(x)<=Math.abs(Number(event.deltaY)||0)||event.ctrlKey||event.target?.closest?.('.ch-math-block,textarea,input,pre,table'))return;
     event.preventDefault?.();
     const t=Number(event.timeStamp)||0,gap=t-wheelAt;
     wheelAt=t;
    // One card per swipe: after a turn the rest of that swipe (its momentum too) is let go.
    if(locked){if(gap<220)return;locked=false;}
    if(gap>220)wheel=0;
    wheel+=x;
    if(Math.abs(wheel)>=60){const step=wheel>0?1:-1;wheel=0;locked=true;turn(lap,frontOf(stack)+step,{dir:step});}
   },{passive:false});}
  // Questions asked on this card, folded like its rows: the question shows; tapping it opens your AI's answer.
  function answersBlock(list,onOpen){
    const box=make('section',undefined,'ch-band-answers'),line=make('div',undefined,'ch-study-meta'),items=[];
    line.append(make('span','Your questions · '+list.length,'ch-study-count'));
    box.append(line);
   for(const a of list){
     const item=make('div',undefined,'ch-band-answer'),toggle=make('button'),more=make('div',undefined,'ch-study-row-body'),me={item,toggle,more},set=(x,open)=>{
       x.more.hidden=!open;
       x.toggle.setAttribute('aria-expanded',String(open));
       x.item.dataset.open=String(open);
     };
     toggle.className='ch-study-row';
     toggle.type='button';
     toggle.append(make('span',String(a.aid.question||a.data.headline||'Question'),'ch-band-answer-q'));
     items.push(me);
    toggle.addEventListener('click',()=>{
      const open=more.hidden;
      for(const x of items)set(x,x===me&&open);
      if(open){more.dataset.opening='';more.addEventListener?.('animationend',()=>delete more.dataset.opening,{once:true});}
      if(open&&!more.firstChild){
        try{
          UI.renderViewer(more,{...a.aid,kind:a.data.kind,data:a.data,progress:record(a.aid.progress)},{env,embedded:true,onError});
        }catch(error){more.append(make('p','This answer can\x27t be shown here.','ch-band-broken'));onError(error);}
      }
      onOpen(open);
    });
    set(me,false);item.append(toggle,more);box.append(item);}
   return box;}
  // Done ticks a card into its day's done pile; on a card already there it brings the card back.
  function archive(entry){
    if(entry.done)return unarchive(entry);
    const {key,aid,data,index}=entry,before=JSON.parse(JSON.stringify(record(aid.progress)));
    if(aid.data===data)
      aid.progress={...record(aid.progress),archived:true};
    else aid.progress={
      ...record(aid.progress),
      cards:{...record(record(aid.progress).cards),[index]:{...record(record(record(aid.progress).cards)[index]),archived:true}}
    };
   lastArchived={entry,before};
   if(drawerFor?.id===key+'#'+index)drawerFor=null;
   onProgress(key,aid.progress);
   reflow(()=>{rebuild();draw();});
   status.textContent=askStatus='Archived';
   undo.hidden=false;
  }
  function restore(){
    if(!lastArchived)return;
    const {entry,before}=lastArchived;
    lastArchived=null;
    entry.aid.progress=before;
    onProgress(entry.key,before);
    askStatus='';
    undo.hidden=true;
    reflow(()=>{rebuild();draw();});
  }
  // Done on a ticked card (in the day's done pile) brings it back among the day's help.
  function unarchive(entry){
    const {key,aid,data,index}=entry;
    if(aid.data===data){const p={...record(aid.progress)};delete p.archived;aid.progress=p;}
    else{
      const cards={...record(record(aid.progress).cards)},one={...record(cards[index])};
      delete one.archived;
      cards[index]=one;
      aid.progress={...record(aid.progress),cards};
    }
    if(lastArchived?.entry.key===key&&lastArchived.entry.index===index){lastArchived=null;undo.hidden=true;}
    onProgress(key,aid.progress);
    askStatus='';
    reflow(()=>{rebuild();draw();});
  }
  // A widget taller than its third fades and offers Show all; opening it lets the band grow to fit, nothing re-renders.
  function body(card,scroll){
    const box=make('div',undefined,'ch-band-body'),more=button('Show all',()=>{
      const opening=card.dataset.open!=='true',id=card.dataset.aidKey+'#'+card.dataset.kind;
      if(opening)opened.add(id);else opened.delete(id);
      grow(card,opening);
    },'ch-band-more');
    more.hidden=true;
    more.setAttribute('aria-expanded','false');
    box.append(scroll,more);
    parts.set(card,{scroll,more,box});
    return box;
  }
  // Every card is read before any is written, and unchanged values are not written again: a write between two reads
  // laid the page out again for each card, on every resize while Make it yours slid open (power run 2026-10-27).
  // A card whose content does not fit its size takes the next size up, never smaller text, up to the whole band; past
  // that it keeps Show all. Each raise packs the day's pages again (pages before it keep their cards). A raise holds
  // while the band is about as wide as when it was measured.
  function flag({card,more,isOpen,over}){
    const text=isOpen?'Show less':'Show all';
    if(card.dataset.overflow!==String(over))card.dataset.overflow=String(over);
    if(more.hidden!==!over)more.hidden=!over;
    if(more.textContent!==text)more.textContent=text;
    if(more.getAttribute('aria-expanded')!==String(isOpen))more.setAttribute('aria-expanded',String(isOpen));
  }
  // One card, read alone (the card a swap just brought to the front): whether it needs Show all. Nothing else is read.
  function fitOne(card){
    if(disposed||!card)return;
    const {scroll,more}=parts.get(card)||{};
    if(!scroll||!more)return;
    const isOpen=card.dataset.open==='true',h=Number(scroll.scrollHeight),c=Number(scroll.clientHeight);
    flag({card,more,isOpen,over:isOpen||Number.isFinite(h)&&Number.isFinite(c)&&c>0&&h>c+2});
  }
  function fitSoon(card){if(typeof env.requestAnimationFrame==='function')env.requestAnimationFrame(()=>fitOne(card));else fitOne(card);}
  function measure(){if(disposed)return;const rows=[],tabRows=[],short=[],width=Number(viewport.clientWidth);
   for(const slot of Array.from(viewport.children)){const s=lapsOf.get(slot);let over=false;
    // A stack is read whole the first time it is fitted at its size and band width; after that only the card in front
    // (and an opened one), which is all that shows.
    const stack=s?(pages[page]||[]).find(st=>st.key===slot.dataset.slot):null,
      seenAt=stack?checks.get(stack.cards[0].data)?.get(stack.size):undefined,
      whole=!s||seenAt===undefined||Math.abs(seenAt-width)>80,
      front=s?s.panels[frontOf(s.stack)]:null;
    let amount=0;
    for(const card of s?s.panels:[slot]){
      if(!whole&&card!==front&&card.dataset.open!=='true')continue;
      const {scroll,more}=parts.get(card)||{};
      if(!scroll||!more)continue;
      const isOpen=card.dataset.open==='true',h=Number(scroll.scrollHeight),c=Number(scroll.clientHeight),o=isOpen||Number.isFinite(h)&&Number.isFinite(c)&&c>0&&h>c+2;
      rows.push({card,more,isOpen,over:o});
      if(o&&!isOpen&&!card.dataset.drawer){over=true;amount=Math.max(amount,h-c);}
    }
    // A stack whose titles need more than one row of tabs counts each extra row against its room, so a large stack
    // takes the whole band when that keeps its titles to fewer rows.
    if(s){
      const w=Number(s.list.clientWidth),
        need=s.tabs.map(t=>(Number(t.children?.[0]?.scrollWidth)+Number(t.children?.[1]?.scrollWidth)||0)+34),
        extra=need.some(v=>v>34)?rowsFor(s.tabs.length,w,need)-1:0,
        tall=s.tabs.some(t=>{
        const n=Number(t.children?.[0]?.offsetHeight),h=Number(t.children?.[1]?.offsetHeight);
        return n>0&&h>n*1.5;
      });
      tabRows.push([slot,w,need,tall]);
      if(extra>0){over=true;amount+=extra*25;}
    }
    if(over&&band.dataset.grown!=='true')short.push([slot,amount]);}
   for(const row of rows)flag(row);
   for(const [slot,w,need,tall] of tabRows)placeTabs(slot,w,need,tall);
   if(!(Number.isFinite(width)&&width>0)||raising>=6)return;let changed=false;for(const [id,r] of raised)if(width>r.width+80){raised.delete(id);changed=true;}
   // A quarter under 280 px is too narrow to read (its title strip would take most of it): small cards then take half
   // the band (a band under about 1150 px).
   const tight=(width-3*12)/4<280;if(tight!==narrow){narrow=tight;changed=true;}
   // Each card is fitted once for each size and band width, as it arrives: what the student opens inside it later never
   // moves the page. A raise that did not make it fit any better (a list of short lines is as tall at any width) is taken
   // back: the card keeps its size and its Show all.
   const overBy=new Map(short);
   for(const slot of Array.from(viewport.children)){
     const stack=(pages[page]||[]).find(st=>st.key===slot.dataset.slot);
     if(!stack)continue;
     const data=stack.cards[0].data;
     let seen=checks.get(data);
     if(!seen){seen=new Map();checks.set(data,seen);}
     const at=seen.get(stack.size);
     if(at!==undefined&&Math.abs(at-width)<=80)continue;
     seen.set(stack.size,width);
    if(!overBy.has(slot))continue;const amount=overBy.get(slot),was=raised.get(cardId(stack.cards[0]));
    if(was&&!was.stop&&was.from&&was.size===stack.size&&amount>=was.over*.85-4){
      for(const c of stack.cards)raised.set(cardId(c),{size:was.from,width,stop:true});
      changed=true;
      continue;
    }
    // The next size up from the width it shows at, and only into the room this page has: a raise never pushes this card
    // or the ones after it to another page (past that it keeps its Show all). A widened last card is not a raise.
    if(was?.stop||(sizes[stack.size]||4)>=4)continue;
    const others=(pages[page]||[]).reduce((n,st)=>n+(st===stack?0:sizes[st.size]||1),0),
      shown=Math.max(sizes[stack.size]||1,Number(slot.dataset.fill)||0),
      next=Math.min(4,shown+1);
    if(next>4-others)continue;
    const to=SIZE_NAMES[next-1];
    for(const c of stack.cards)raised.set(cardId(c),{size:bigger(raised.get(cardId(c))?.size||'s',to),width,over:amount,from:stack.size});changed=true;}
   // Inside a draw the page is being built anyway; otherwise (fonts arrived, the band was resized) the cards glide to
   // their new places and sizes.
   if(!changed)return;raising++;try{if(drawing)rebuild(),draw();else reflow(()=>{rebuild();draw();});}finally{raising--;}}
  // Show all / Show less, a row or drawer that needs room: the band's height eases to the new one (measured).
  function grow(card,value){
    const h0=drawing?0:holdHeight();
    for(const c of allCards())c.dataset.open=String(!!value&&c===card);
    for(const slot of Array.from(viewport.children)){const s=lapsOf.get(slot);if(s)slot.dataset.open=String(!!value&&s.panels.includes(card));}
    band.dataset.grown=String(!!value&&!!card);
    measure();
    if(h0)easeHeight(h0);
    return band.dataset.grown==='true';
  }
  function flip(value){
    interacted=true;
    const to=Math.max(0,Math.min(Math.max(0,pages.length-1),Number.isInteger(value)?value:0)),go=()=>{page=to;if(dayAt===0)homePage=page;draw();};
    if(to!==page)slide(to>page?1:-1,go);else go();
    persist();
    return page;
  }
  // Days: step 1 is the day before, -1 the day after; the newest day opens on the page it was left on.
  function stepDay(step){
    const to=Math.max(0,Math.min(model.days.length-1,dayAt+(Number(step)||0)));
    if(to===dayAt)return dayAt;
    interacted=true;
    following=to===0;
    slide(to>dayAt?-1:1,()=>{dayAt=to;settle();page=to===0?Math.min(homePage,Math.max(0,pages.length-1)):0;draw();},true);
    if(d.activeElement?.disabled)(dayPrev.disabled?dayNext:dayPrev).focus?.({preventScroll:true});
    return dayAt;
  }
  band.addEventListener('keydown',event=>{
    const target=event.target;
    if(event.altKey||event.ctrlKey||event.metaKey||event.isComposing||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)||target?.isContentEditable)return;
    if(event.key==='Escape'&&band.dataset.grown==='true'){
      event.preventDefault();
      const card=visibleCards().find(c=>c.dataset.open==='true');
      grow(card,false);
      (card&&parts.get(card)?.more)?.focus?.({preventScroll:true});
      return;
    }
    if(['ch-band-day-prev','ch-band-day-next'].includes(target?.className)){if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();stepDay(event.key==='ArrowLeft'?1:-1);}return;}
    if(target!==band&&!['ch-band-prev','ch-band-next','ch-band-dot'].includes(target?.className))return;
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();
      flip(event.key==='Home'?0:event.key==='End'?pages.length-1:page+(event.key==='ArrowLeft'?-1:1));
      if(target!==band&&target?.className!=='ch-band-dot')band.focus();
    }
  });
  // The entrance plays once, on the cards that stay: the saved state (open, page, the card asked for) may draw again, so
  // the first cards wait unseen until it is read.
  draw();setOpen(true,false);const entrance=!still();if(entrance&&stage.style)stage.style.opacity='0';
  const release=()=>{if(stage.style)stage.style.opacity='';if(entrance&&!disposed&&!still())settleIn(Array.from(viewport.children));};
  // Once the fonts are in, every card is fitted again.
  Promise.resolve(env.document?.fonts?.ready).then(()=>{checks=new WeakMap();measure();},()=>{});
  const loaded=Promise.resolve(store?.getBandState?.(scope)).then(value=>{
    if(disposed)return;
    let changed=false;
    if(!interacted){
      const was=[open,page,dayAt];
      open=value?.open!==false;
      page=homePage=Number.isInteger(value?.page)?value.page:0;
      if(selectedKey)
        for(let i=0;i<model.days.length;i++){
          const found=model.pages[i].findIndex(rows=>rows.some(stack=>stack.cards.some(row=>row.key===selectedKey)));
          if(found>=0){
            dayAt=i;
            following=i===0;
            settle();
            page=found;
            const st=model.pages[i][found].find(stack=>stack.cards.some(row=>row.key===selectedKey));
            if(st?.lapped)stackAt.set(st.key,st.cards.findIndex(row=>row.key===selectedKey));
            changed=true;
            break;
          }
        }
      changed=changed||open!==was[0]||Math.max(0,Math.min(Math.max(0,pages.length-1),page))!==was[1]||dayAt!==was[2];
    }
    ready=true;
    if(changed)draw();
    setOpen(open,false);
    if(interacted)persist();
    release();
  }).catch(error=>{
    ready=true;
    release();
    onError(error);
  });
  return {element:band,loaded,setOpen,flip,prepare,get state(){
    return {open,page,pages:pages.length,reducedMotion:reduced(),day:model.days[dayAt]||'',days:model.days.slice()};
  },get pages(){
    return pages;
  },stepDay,update(values){
    showChoice();
    const wasEmpty=!model.days.length;
    observer?.disconnect();
    current=values;
    askStatus='';
    reflow(()=>{rebuild();if(wasEmpty&&model.days.length){open=true;interacted=true;}draw();});
  },
   // New Canvas data (a due date moved, work handed in) ranks the cards again; the same data costs nothing.
   refresh(){
     showChoice();
     if(disposed||factsPrint(readFacts())===builtPrint)return false;
     reflow(()=>{rebuild();draw();});
     return true;
   },measure,grow:(key,value=true)=>grow(visibleCards().find(c=>c.dataset.aidKey===key),value),destroy(){
     disposed=true;
     env.clearTimeout?.(ahead);
     env.clearTimeout?.(toneWait);
     seen?.disconnect();
     themeWatch?.disconnect();
     stageAnim?.cancel();
     env.clearInterval?.(creepTimer);
     env.chrome?.runtime?.onMessage?.removeListener(receive);
     observer?.disconnect();
     container.replaceChildren();
   }};
 }
 const api={sizes,SIZE_NAMES,fallbackSize,cardsFrom,agentAids,compare,pack,stacksFrom,cardText,renderBand,dayKey,dayName};
 root.CanvasHarnessStudyBand=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
