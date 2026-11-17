/* Biscuit's answers as data (2026-11-14). The engine still decides what a line means and says it in one sentence; this
   turns that card and the loaded workspace into one answer object that biscuit-view.js draws:
     {v, kind, title, summary, value, rows, groups, more, notes, acts, follow, text, source}
   A row is one thing the student can recognise and open: its name, course, due time, planned time, length (and where the
   length came from), state, points, link, and the details already loaded (start of the instructions, links, how it is
   handed in). Nothing here reads the network, writes the store or changes what Biscuit understood; the sentence stays as
   the fallback (`text`). */
(function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null);
 // the student's own Canvas address (site.js); the made-up one only where there is no page (tests)
 const SITE=()=>{try{return root.ReserveSite?.origin?.()||'https://school.instructure.com';}catch{return 'https://school.instructure.com';}};
 const Clock=()=>load('CanvasHarnessAgentClock','./agent-clock.js'),
   Planner=()=>load('ReserveBiscuitPlanner','./biscuit-planner.js'),
   Core=()=>root.ReserveCore||(typeof module==='object'&&module.exports?require('./core.js'):null),
   Ask=()=>load('ReservePonyAsk','./pony-ask.js');
 const MIN=60000,HOUR=3600000,DAY=86400000,ZONE='America/New_York';
 const list=v=>Array.isArray(v)?v:[],obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{},str=v=>typeof v==='string'?v:v==null?'':String(v);
 const stamp=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
 const clean=v=>str(v).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
 const cap=(v,n)=>{v=clean(v);return v.length>n?v.slice(0,n-1).replace(/\s+\S*$/,'')+'…':v;};
 const ENTITY={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',hellip:'…'};
 const decode=v=>
   str(v).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,e)=>e[0]==='#'?String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):Number(e.slice(1))):ENTITY[e.toLowerCase()]??all);
 // Plain text of loaded HTML (instructions, announcements, pages): block ends become breaks, tags go, entities decode.
 function plain(html){
   return decode(str(html).replace(/<(script|style)[\s\S]*?<\/\1>/gi,' ').replace(/<li[^>]*>/gi,'\n• ').replace(/<\/(p|div|h\d|li|tr|ol|ul|blockquote)>|<br\s*\/?>/gi,'\n').replace(/<\/?(a|span|strong|em|b|i|u|code|sub|sup|mark|small|font)\b[^>]*>/gi,'').replace(
     /<[^>]+>/g,
     ' ')).replace(
     /[ \t ]+/g,
     ' ').replace(
     / +([.,;:!?])/g,
     '$1').replace(
     /\s*\n\s*/g,
     '\n').replace(
     /\n{2,}/g,
     '\n').trim();
 }
 // the start of a text, whole lines kept (lists stay lists), cut at a word near n characters
 function lead(text,n){
   let out='';
   for(const line of str(text).split('\n')){const next=out?out+'\n'+line:line;if(next.length>n){if(!out)return cap(line,n);return out+'\n…';}out=next;}
   return out;
 }
 // The links a description carries: Canvas files, pages and outside links, labelled by their own text.
 function links(html,origin=SITE()){
   const out=[],seen=new Set();
   for(const m of str(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
     let url;
     try{url=new URL(decode(m[1]),origin);}catch{continue;}
     if(!['https:','http:'].includes(url.protocol)||url.username||url.password)continue;
     const href=url.href;
     if(seen.has(href))continue;
     seen.add(href);
     const label=cap(plain(m[2]),60)||url.hostname,
       kind=/\/files\/\d+/.test(url.pathname)?
         'file':
         /\/pages\//.test(url.pathname)?'page':/\/(assignments|quizzes|discussion_topics)\//.test(url.pathname)?'canvas':url.hostname.endsWith('instructure.com')?'canvas':'link';
     out.push({label,url:href,kind,host:url.hostname});
     if(out.length>=8)break;
   }
   return out;
 }
 function zoneOf(s){let z=clean(s.timeZone||s.settings?.timeZone)||ZONE;try{new Intl.DateTimeFormat('en-US',{timeZone:z});}catch{z=ZONE;}return z;}
 // one set of formatters per zone: a list of forty rows formats a few hundred times on every keystroke
 const FORMATS=new Map();
 function formats(zone){
   let f=FORMATS.get(zone);
   if(!f){
     const make=o=>new Intl.DateTimeFormat('en-US',{timeZone:zone,...o});
     f={clock:make({hour:'numeric',minute:'2-digit'}),weekday:make({weekday:'short'}),weekdayLong:make({weekday:'long'}),date:make({month:'short',day:'numeric'})};
     FORMATS.set(zone,f);
   }
   return f;
 }
 // ---- time words a student reads at a glance
 function timeKit(s){
  const zone=zoneOf(s),now=stamp(s.now)??Date.now(),C=Clock(),local=C?C.calendar(zone):at=>{
    const d=new Date(at);
    return {day:d.toISOString().slice(0,10),minute:d.getUTCHours()*60+d.getUTCMinutes()};
  },today=local(now).day;
  const addDays=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
  const F=formats(zone),clock=at=>F.clock.format(at);
  const span=(a,b)=>{const x=clock(a),y=clock(b),am=s=>s.slice(-2);return am(x)===am(y)?x.slice(0,-3)+' – '+y:x+' – '+y;};
  const dayDiff=at=>Math.round((Date.parse(local(at).day+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/DAY);
  const weekday=(at,long=false)=>(long?F.weekdayLong:F.weekday).format(at);
  const date=at=>F.date.format(at);
  const dayWord=(at,{long=false}={})=>{const d=dayDiff(at);return d===0?'Today':d===1?'Tomorrow':d===-1?'Yesterday':d>1&&d<7?weekday(at,long):weekday(at)+', '+date(at);};
  const length=n=>{n=Math.round(n);return n<60?n+' min':n%60?Math.floor(n/60)+' h '+n%60+' min':n/60+' h';};
  // "Due today 11:59 PM", "Due Wed 8:00 AM", "Was due Mon · 5 days late"
  function due(at,{done=false}={}){
    if(at===null)return {at:null,text:'No due date',short:'No date',rel:'none'};
    const d=dayDiff(at),late=!done&&at<now,days=Math.max(1,Math.round((now-at)/DAY));
    if(late){
      const lateText=at>now-HOUR*20&&d===0?'late':days===1?'1 day late':days+' days late';
      return {
        at,
        text:'Was due '+dayWord(at)+(Math.abs(d)<7?' '+clock(at):'')+' · '+lateText,
        long:'Was due '+weekday(at,true)+', '+date(at)+' · '+clock(at)+' · '+lateText,
        short:lateText,
        rel:'late',
        lateDays:days
      };
    }
    const rel=d===0?'today':d===1?'tomorrow':d<7?'week':'later';
    return {
      at,
      text:(done?'Was due ':'Due ')+(d===0?'today':d===1?'tomorrow':dayWord(at))+(d<7?' '+clock(at):''),
      long:(done?'Was due ':'Due ')+(d===0?'today':d===1?'tomorrow':weekday(at,true))+', '+date(at)+' · '+clock(at),
      short:d===0?clock(at):d===1?'Tmrw '+clock(at):d<7?weekday(at)+' '+clock(at):date(at),
      rel
    };
  }
  return {zone,now,local,today,addDays,clock,span,dayDiff,weekday,date,dayWord,length,due};
 }
 // ---- the student's courses and work, one row shape for every kind
 function courseOf(s,id){
   const c=list(s.courses).find(v=>str(v?.id)===str(id));
   if(!c)return null;
   const label=Core()?.courseLabel?.(c.name||''),L=load('ReserveBiscuitLanguage','./biscuit-language.js');
   let named='';
   try{named=clean(L?.shortName?.(c));}catch{}
   const short=clean(c.nickname||c.shortName||named||label?.title||c.name).replace(/^(?:CL|CP|AP|IB)\s+/,'').split(/\s*:\s+/).pop();
   return {id:str(c.id),name:clean(c.name)||short,short:cap(short,28),color:clean(c.color||c.courseColor)};
 }
 function stateOf(v,t,mine={}){
   const done=v.done===true||v.completed===true||mine.checkedOff===true||mine.progress==='done',sub=v.submitted===true||['submitted','graded','pending_review'].includes(str(v.state));
   if(str(v.state)==='graded'||Number.isFinite(v.score)&&sub)return 'graded';
   if(sub)return 'submitted';
   if(done)return 'done';
   const at=stamp(v.dueAt??v.due);
   if(v.missing===true||at!==null&&at<t.now)return 'late';
   if(mine.plannedDate||v.planned)return 'planned';
   return 'open';
 }
 const STATE_WORD={late:'Late',missing:'Missing',open:'Not submitted',planned:'Planned',submitted:'Submitted',graded:'Graded',done:'Done on your list'};
 function workRow(v,s,t,extra={}){
  const mine=obj(obj(s.local?.tasks||s.local)[v.id]),
    course=courseOf(s,v.courseId),
    at=stamp(v.dueAt??v.due),
    state=stateOf(v,t,mine),
    points=Number.isFinite(Number(v.points))&&v.points!==null&&v.points!==''?Number(v.points):null,
    desc=str(v.description||v.instructions||v.body||v.message);
  const saved=Number(mine.estimate||v.estimate)||0,
    row={
      id:str(v.id),
      type:v.kind==='file'?'file':['page','syllabus'].includes(v.kind)?'page':'work',
      name:cleanTitle(v,course),
      rawName:clean(v.title||v.name),
      course,
      due:t.due(at,{done:['submitted','graded','done'].includes(state)}),
      state,
      stateText:STATE_WORD[state]||'',
      points,
      url:safeUrl(v.url||v.htmlUrl),
      kind:clean(v.workKind||v.kind)||'assignment',
      personal:v.personal===true||v.courseId==='personal'||v.localOnly===true,
      pinned:mine.pinned===true||v.pinned===true,
      planned:mine.plannedDate?{day:mine.plannedDate,time:mine.plannedTime||''}:null,
      minutes:saved||null,
      minutesFrom:saved?'saved':null,
      ...extra
    };
  if(desc||points!==null||list(v.submissionTypes).length)row.detail=detailOf(v,desc);
  return row;
 }
 // A title that is only a date ("Monday, November 9, 2026", "Homework for 11/9") says nothing alone: it keeps its words,
 // and the row carries the course beside it so the student can tell which homework it is.
 const DATEISH=/^(?:(?:home ?work|hw|classwork|assignment|reading|due)\s*(?:for|due)?\s*)?(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day,?\s*)?(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)?\s*$/i;
 function cleanTitle(v,course){const raw=clean(v.title||v.name)||'Untitled';return raw;}
 function dateOnlyTitle(name){return DATEISH.test(clean(name))&&/\d/.test(name);}
 function safeUrl(u){u=str(u);if(!u)return '';try{const x=new URL(u,SITE());return ['https:','http:'].includes(x.protocol)&&!x.username&&!x.password?x.href:'';}catch{return '';}}
 const SUBMIT={
   online_upload:'File upload',
   online_text_entry:'Text entry',
   online_url:'Website link',
   media_recording:'Media recording',
   online_quiz:'Quiz in Canvas',
   discussion_topic:'Discussion post',
   external_tool:'Outside tool',
   on_paper:'On paper',
   none:'Nothing to hand in',
   student_annotation:'Annotate a document'
 };
 function detailOf(v,desc){
   const text=plain(desc),
     start=lead(text,320),
     out={text:start,full:text.length>start.length,links:links(desc),submit:list(v.submissionTypes).map(k=>SUBMIT[k]||clean(k).replace(/_/g,' ')).filter(Boolean).slice(0,3)};
   const types=list(v.allowedExtensions).map(x=>clean(x).replace(/^\./,'').toLowerCase()).filter(x=>/^[a-z0-9]{1,8}$/.test(x)).slice(0,6);
   if(types.length)out.types=types;
   if(Number.isFinite(v.allowedAttempts)&&v.allowedAttempts>0)out.attempts=v.allowedAttempts;
   if(v.groupWork)out.group=true;
   if(v.hasComments)out.comments=true;
   if(Number.isFinite(v.quiz?.timeLimit))out.timeLimit=v.quiz.timeLimit;
   if(v.locked)out.locked=true;
   return out;
 }
 // every loaded thing, once, by id: work first, then files, pages, announcements and messages
 function index(s){
   const map=new Map();
   for(const l of [s.assignments,s.workItems,s.planner,s.personalTasks])for(const v of list(l)){const k=str(v?.id);if(k&&!map.has(k))map.set(k,{...v,kind:v.kind||'assignment'});}
   for(const [kind,l] of [['file',s.files],['page',s.pages],['announcement',s.announcements],['message',s.messages]])
     for(const v of list(l)){const k=str(v?.id);if(k&&!map.has(k))map.set(k,{...v,kind:v.kind||kind});}
   return map;
 }
 // ---- the acts: each is an existing CH intent with its fields, labelled in 1-3 words
 const act=(id,label,intent,fields={},extra={})=>({id,label,intent,fields,...extra});
 function rowActs(row){
   const acts=[],key=str(row.itemId||row.id),name=row.rawName||row.name,cid=row.course?.id;
   row={...row,id:key};
   if(row.type==='work'&&!row.personal){
     acts.push(act('details:'+row.id,'Details','details',{itemId:row.id},{local:true}));
     if(row.url)acts.push(act('canvas:'+row.id,'Open in Canvas','link',{url:row.url},{link:row.url}));
     acts.push(act('open:'+row.id,'Open','open',{itemId:row.id,courseId:row.course?.id}));
     if(!['submitted','graded','done'].includes(row.state)){
       acts.push(act('plan:'+row.id,'Plan it','plan',{local:true,itemId:row.id,line:'plan '+row.rawName}));
       acts.push(act('focus:'+row.id,'Focus','focus',{operation:'start',mode:'focus',minutes:25,cycles:1,breakMinutes:0,itemId:row.id,courseId:row.course?.id}));
       acts.push(act('done:'+row.id,'Mark done','complete',{itemId:row.id},{change:true}));
     }
     acts.push(act('pin:'+row.id,row.pinned?'Bookmarked':'Bookmark','bookmark',{itemId:row.id,courseId:row.course?.id},{change:true,disabled:row.pinned}));
     acts.push(act('remind:'+row.id,'Remind me','follow',{line:'remind me about '+row.rawName+' tomorrow'}));
     if(!row.noAI)
       acts.push(act('help:'+
         row.id,'Help with this','ai',{
           question:'help with '+name,
           handoff:{
             contextIds:[key],
             sources:[{id:key,label:name,text:'',kind:'assignment',courseId:cid}],
             kind:'ask',
             kinds:[],
             mode:'ask',
             wishes:'help with '+name,
             prompt:'help with '+name,
             course:row.course?.name||'',
             item:name,
             itemId:key,
             courseId:cid
           }
         }));
   }
   else if(['file','page','announcement','message'].includes(row.type)){
     if(row.url)acts.push(act('canvas:'+row.id,'Open in Canvas','link',{url:row.url},{link:row.url}));
     acts.push(act('open:'+row.id,'Open','open',{entryId:row.id,itemId:row.id,kind:row.type,url:row.url}));
     if(row.type!=='message')acts.push(act('pin:'+row.id,'Bookmark','bookmark',{entryId:row.id,kind:row.type,courseId:row.course?.id,url:row.url},{change:true}));
   }
   return acts;
 }
 // ---- kinds
 function build(card,snapshot={},session={},options={}){
  const s=obj(snapshot),
    t=timeKit(s),
    c=obj(card),
    line=clean(options.line||''),
    reason=str(c.understanding?.reason||c.routing?.reason),
    action=str(c.action),
    base={v:1,kind:'chat',title:'',summary:'',rows:[],notes:[],acts:[],follow:[],text:str(c.message),source:{action,reason,line}};
  try{
    const thread=threadOn(c,s,t,line,options.previous);
    if(thread)return finish(thread,s,t);
    const kind=classify(c,s,line,reason);
    const out=(BUILD[kind]||BUILD.chat)(c,s,t,{...options,line,reason,base:{...base,kind}});
    return finish(out,s,t);
  }catch(error){return {...base,kind:'chat',failed:String(error?.message||error)};}
 }
 // A short follow-up works on the answer already on screen: "only chem" narrows it, "show more" widens it, and "which one"
 // (or "the second one") picks from its rows. Anything else is a new answer.
 function threadOn(c,s,t,line,prev){
  if(!prev||!list(prev.rows).length)return null;const low=line.toLowerCase().trim(),work=list(prev.rows).filter(r=>r.type==='work'&&r.course);
  const only=/^(?:only|just)\s+(?:my\s+|the\s+)?([a-z][a-z ]{1,30}?)(?:\s+(?:ones?|stuff|work|homework|hw))?\??$/.exec(low);
  if(only&&work.length){
    const w=only[1].trim(),
      match=work.find(r=>
        [r.course.short,r.course.name].some(n=>n.toLowerCase().replace(/^(?:cl|cp|ap|ib)\s+/,'').split(/[\s:\-]+/).some(x=>x.length>=3&&(x.startsWith(w.slice(0,4))||w.startsWith(x.slice(0,4))))));
    if(match){
      const id=match.course.id;
      if(prev.kind==='plan'&&prev.plan){
        const order=[...new Set([...list(prev.before),...work].filter(r=>r.course?.id===id).map(r=>str(r.itemId||r.id)))];
        const card={action:'plan',next:{action:'plan',fields:{...prev.plan.fields,itemIds:order}},message:prev.text,understanding:{reason:prev.source?.reason||''}};
        const out=build(card,s,{},{line:prev.source?.line||''});
        out.narrowed=id;
        return out;
      }
      return {...prev,narrowed:id,source:{...prev.source,thread:line}};
    }
  }
  if(/^(?:show |see )?(?:more|all|the rest|everything)\b/.test(low)&&(prev.kind==='list'||prev.kind==='plan'))return {...prev,widened:true,source:{...prev.source,thread:line}};
  const nth=/^(?:the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|last)(?:\s+one)?$/.exec(low),pickable=list(prev.rows).filter(r=>r.type==='work'||r.type==='file'||r.type==='page');
  if(nth&&pickable.length){
    const i={first:0,'1st':0,second:1,'2nd':1,third:2,'3rd':2,fourth:3,'4th':3,fifth:4,'5th':4}[nth[1]]??pickable.length-1,row=pickable[Math.min(i,pickable.length-1)];
    return {
      v:1,
      kind:'item',
      title:row.name,
      summary:[row.course?.short,row.due?.text].filter(Boolean).join(' \u00b7 '),
      rows:[{...row,open:true}],
      notes:[],
      acts:rowActs(row).filter(x=>x.intent!=='details'),
      follow:[],
      text:row.name+'.',
      source:{action:'open',reason:'thread',line}
    };
  }
  if(/^Which one/.test(str(c.message))&&!list(c.items).length&&pickable.length>1)
    return {
      v:1,
      kind:'choose',
      title:'Which one?',
      question:'Which one?',
      rows:pickable.slice(0,9).map((r,i)=>({...r,choice:i+1,pick:{intent:'open',fields:{itemId:str(r.itemId||r.id),courseId:r.course?.id}}})),
      notes:[],
      acts:[],
      follow:[],
      text:str(c.message),
      source:{action:'none',reason:'thread',line}
    };
  return null;
 }
 function finish(a,s,t){
   a.rows=list(a.rows);
   a.acts=list(a.acts).filter(Boolean);
   if(s?.ai===false){a.acts=a.acts.filter(x=>x.intent!=='ai');for(const r of [...a.rows,...list(a.also),...list(a.before),...list(a.left)])if(r&&typeof r==='object')r.noAI=true;}
   const seen=new Set();
   a.follow=list(a.follow).filter(v=>{const k=typeof v==='string'?v:v?.line;if(!k||seen.has(k))return false;seen.add(k);return true;}).slice(0,4);
   a.notes=list(a.notes).filter(Boolean);
   if(!a.title&&!a.rows.length&&!a.value)a.title=a.text;
   return a;
 }
 function classify(c,s,line,reason){
  const action=str(c.action),items=list(c.items),first=items[0]||{},kinds=new Set(items.map(v=>v.kind));
  if(list(c.requests).length>1||action==='batch'||c.next?.action==='batch')return 'steps';
  if(reason==='privacy'||/^Show grades is off/.test(str(c.message)))return 'blocked';
  if(reason==='mind:tests-ahead'){const n=list(c.listRows).length;return n>1?'list':n===1&&items.length?'fact':'none';}
  const counted=/^\d+ (?:things?|still|due|new|overdue)/.test(str(c.message));
  if(counted&&items.length&&items.every(v=>!v.kind||v.kind==='assignment'))return 'list';
  if(c.clarify||list(c.choices).length&&action==='none')return list(c.choices).length||items.length>1?'choose':'unknown';
  if(c.ui?.path)return 'feature';
  if(action==='make-it-yours'||c.next?.action==='make-it-yours')return 'feature';
  if(action==='plan'){if(c.next?.fields?.mode==='week')return 'week';if(/^mind:(?:what-now|stressed)$/.test(reason))return 'next';return 'plan';}
  if(['focus','break','focus-control','focus-status'].includes(action))return 'timer';
  if(['complete','bookmark','reminder','note','move','remove','task','routine','setting','module','feature','preset','skill','installed','undo'].includes(action))return 'change';
  if(action==='ai')return 'ai';
  if(['find','open','none','navigate'].includes(action)&&['grade','course-grade'].includes(first.kind))return 'grades';
  if(action==='navigate')return items.length&&first.kind==='course'?'place':'place';
  if(['find','open','none'].includes(action)&&items.length){
   if([...kinds].every(k=>['grade','course-grade'].includes(k)))return 'grades';
   if([...kinds].every(k=>['announcement','message','conversation'].includes(k)))return 'messages';
   if([...kinds].every(k=>['file','page','syllabus','link','module','module-item'].includes(k)))return 'files';
   if(first.kind==='course')return 'place';
   if(counted||c.answerKind==='due'||/^mind:/.test(reason)&&LIST_SCOPE[reason.slice(5)]&&(c.answerKind==='mind'||items.length>1))return 'list';
   if(['file','page','syllabus'].includes(first.kind))return 'files';
   if(c.answer?.value||/^(?:Not yet|Yes)\b/.test(str(c.message)))return 'fact';
   if(stamp(first.dueAt)!==null&&/\b(?:when(?:'?s)?|what time|what day|due date)\b/i.test(line))return 'fact';
   return 'item';
  }
  if(/^(?:I am not sure|Say a bit more|I do not know that one)/.test(str(c.message)))return 'unknown';
  if(['find','none'].includes(action)&&/^(?:Nothing|No )/.test(str(c.message)))return 'none';
  if(action==='none'&&reason==='answer-request')return 'chat';
  return 'chat';
 }
 // Which full list a short list answer was cut from (the rule's own window), so the answer can show all of it.
 const LIST_SCOPE={
  'due-week':(s,t,c,line)=>{const next=/\bnext week\b/i.test(line),from=next?t.now+7*DAY:t.now;return open(s,t).filter(v=>v.at!==null&&v.at>=from&&v.at<from+7*DAY);},
  'missed':(s,t)=>open(s,t).filter(v=>v.at!==null&&v.at<t.now),
  'overdue':(s,t)=>open(s,t).filter(v=>v.at!==null&&v.at<t.now),
  'how-much':(s,t)=>open(s,t).filter(v=>v.at!==null&&v.at>=t.now-7*DAY&&v.at<t.now+7*DAY),
  'how-long':(s,t)=>open(s,t).filter(v=>v.at!==null&&v.at>=t.now&&v.at<t.now+7*DAY),
  'course-work':(s,t,c)=>{const id=str(list(c.items)[0]?.courseId);return id?open(s,t).filter(v=>str(v.raw.courseId)===id):[];},
  'due-soon':(s,t)=>open(s,t).filter(v=>v.at!==null&&v.at>=t.now&&v.at<t.now+DAY),
  'short-offer':(s,t,c)=>byDay(s,t,c),
  'workspace-action':(s,t,c)=>byDay(s,t,c),
  'tests-ahead':(s,t,c)=>list(c.listRows).map(v=>({raw:v,at:stamp(v.dueAt)})),
  'next-up':(s,t,c)=>list(c.listRows).map(v=>({raw:v,at:stamp(v.dueAt)})),
  'turned-in':(s,t,c)=>list(c.listRows).length>1?list(c.listRows).map(v=>({raw:v,at:stamp(v.dueAt)})):null,
  'graded':(s,t,c)=>list(c.listRows).length>1?list(c.listRows).map(v=>({raw:v,at:stamp(v.dueAt)})):null
 };
 function open(s,t){
   const mine=obj(s.local?.tasks||s.local),out=[];
   for(const v of index(s).values()){
     if(!['assignment','quiz','discussion','task',''].includes(str(v.kind))&&v.kind!==undefined)continue;
     const m=obj(mine[v.id]);
     if(v.done||v.completed||v.submitted||m.checkedOff||m.progress==='done')continue;
     out.push({raw:v,at:stamp(v.dueAt??v.due)});
   }
   return out.sort((a,b)=>(a.at??Infinity)-(b.at??Infinity));
 }
 function byDay(s,t,c){
   const items=list(c.items).filter(v=>stamp(v.dueAt)!==null);
   if(!items.length)return null;
   const days=new Set(items.map(v=>t.local(stamp(v.dueAt)).day));
   if(days.size!==1)return null;
   const day=[...days][0];
   return open(s,t).filter(v=>v.at!==null&&t.local(v.at).day===day);
 }
 function groupRows(rows,t,by='due'){
  if(by==='course'){
    const map=new Map();
    for(const r of rows){const k=r.course?.id||'mine';if(!map.has(k))map.set(k,{key:k,label:r.course?.short||'Your own',rows:[]});map.get(k).rows.push(r.id);}
    return [...map.values()];
  }
  const order=[['late','Late'],['today','Today'],['tomorrow','Tomorrow'],['week','This week'],['later','Later'],['none','No due date']],map=new Map(order.map(([k,label])=>[k,{key:k,label,rows:[]}]));
  for(const r of rows)map.get(map.has(r.due?.rel)?r.due.rel:'none').rows.push(r.id);
  return [...map.values()].filter(g=>g.rows.length);
 }

 function testRow(v,s,t){
   const at=stamp(v.dueAt),
     base=t.due(at),
     d=at===null?null:t.dayDiff(at),
     day=at===null?'':d===0?'Today':d===1?'Tomorrow':d>1&&d<7?t.weekday(at,true):t.weekday(at)+', '+t.date(at),
     clock=at===null||v.dayOnly===true?'':' '+t.clock(at);
  const src=v.testSource==='announcement'?' · from an announcement':v.testSource==='event'?' · calendar':v.testSource==='own'?' · your list':'',
    due=at===null?
      {...base,text:base.text+src}:
      {
        ...base,
        text:day+clock+(v.dayOnly===true?' · time not given':'')+src,
        long:t.weekday(at,true)+', '+t.date(at)+(v.dayOnly===true?'':' · '+t.clock(at)),
        short:d===0?'Today'+clock:d===1?'Tmrw'+clock:t.weekday(at)+clock
      };
  const extra={due,dayOnly:v.dayOnly===true,source:clean(v.testSource||'')};if(v.testSource==='announcement'||v.testSource==='event'){extra.type='announcement';extra.kind=v.testSource;}
  return workRow(v,s,t,extra);}
 const BUILD={};
 BUILD.list=(c,s,t,o)=>{
  const a=o.base,
    key=o.reason.replace(/^mind:/,''),
    scoped=LIST_SCOPE[key]?.(s,t,c,o.line),
    idx=index(s),
    base=scoped&&scoped.length?scoped.map(v=>v.raw):list(c.items).map(v=>idx.get(str(v.id))||v);
  const rows=base.map(v=>key==='tests-ahead'?testRow(v,s,t):workRow(v,s,t));if(key!=='turned-in'&&key!=='graded')rows.sort((x,y)=>(x.due.at??Infinity)-(y.due.at??Infinity));a.rows=rows;
  const late=rows.filter(r=>r.state==='late').length,
    mins=rows.reduce((n,r)=>n+(r.minutes||estimateOf(r)),0),
    courses=[...new Map(rows.filter(r=>r.course).map(r=>[r.course.id,r.course])).values()];
  const handed=key==='turned-in'||key==='graded',isDone=r=>key==='graded'?r.state==='graded':['submitted','graded','done'].includes(r.state),waiting=rows.filter(r=>!isDone(r)),done=rows.filter(isDone);
  a.title=listTitle(key,c,rows,o.line,t);
  a.summary=handed?
    [waiting.length?waiting.length+(key==='graded'?' not graded yet':' not turned in'):'',done.length?done.length+(key==='graded'?' graded':' turned in'):''].filter(Boolean).join(' · '):
    key==='tests-ahead'?
      [rows.length+(rows.length===1?' test':' tests'),courses.length>1?courses.length+' courses':courses[0]?.short||''].filter(Boolean).join(' · '):
      [rows.length+(rows.length===1?' thing':' things'),late?late+' late':'',mins?'about '+t.length(mins):''].filter(Boolean).join(' · ');
  a.groups=handed?
    [{key:'waiting',label:key==='graded'?'Not graded yet':'Not turned in yet',rows:waiting.map(r=>r.id)},{key:'done',label:key==='graded'?'Graded':'Turned in',rows:done.map(r=>r.id)}].filter(g=>
      g.rows.length):
    key==='course-work'?groupRows(rows,t,'due'):groupRows(rows,t,courses.length>1&&key==='how-much'?'due':'due');
  if(courses.length>1)a.filters=courses.map(v=>({id:v.id,label:v.short,color:v.color}));
  const open=rows.filter(r=>!['submitted','graded','done'].includes(r.state));
  if(open.length)a.acts.push(act('plan-these','Plan these','plan',{local:true,line:o.line||'plan',itemIds:open.slice(0,12).map(r=>r.id)},{primary:true}));
  if(rows.length>1)a.acts.push(act('step','One by one','step',{},{local:true}));
  if(open.length>1)a.acts.push(act('done-these','Mark done','complete',{},{hidden:true,change:true,picked:true}),act('pin-these','Bookmark','bookmark',{},{hidden:true,change:true,picked:true}));
  if(open.length>1)a.acts.find(x=>x.id==='plan-these').picked=true;
  a.follow=key==='tests-ahead'?['what is due this week']:late&&key!=='missed'?['plan catch up']:['what should i do first'];
  if(/Say catch up/.test(a.text))a.follow.unshift('plan catch up');
  return a;
 };
 function listTitle(key,c,rows,line,t){
   const msg=str(c.message);
   if(key==='tests-ahead')return cap(str(c.listTitle),60)||'Tests ahead';
   if(key==='next-up')return 'Next up';
   if(key==='turned-in'||key==='graded')return cap(str(c.message).split(/(?<=\.)\s/)[0],90)||(key==='graded'?'Graded?':'Turned in?');
   if(key==='due-week')return /next week/i.test(line)?'Due next week':'Due this week';
   if(key==='missed'||key==='overdue')return 'Still open from before';
   if(key==='how-much')return /^A little/.test(msg)?'A little behind':/^No\./.test(msg)?'Not behind':'Where you stand';
   if(key==='how-long')return 'This week’s work';
   if(key==='course-work')return (rows[0]?.course?.short||'Course')+': what is left';
   const m=/^(\d+) things? due (today|tomorrow|[A-Z][a-z]+)/.exec(msg);
   if(m)return 'Due '+m[2].toLowerCase().replace(/^([a-z])/,x=>m[2]==='today'||m[2]==='tomorrow'?x:x.toUpperCase());
   if(/new since/.test(msg))return 'New since you looked';
   return cap(msg.split(/[.:]/)[0],60)||'Your work';
 }
 function estimateOf(r){
   if(r.minutes)return r.minutes;
   const text=r.rawName+' '+r.kind;
   return /\b(?:essay|paper|project|lab|build|research)\b/i.test(text)?60:/\b(?:test|exam|quiz|reading|review)\b/i.test(text)?35:25;
 }
 BUILD.item=(c,s,t,o)=>{
   const a=o.base,
     idx=index(s),
     first=list(c.items)[0]||{},
     own=o.reason==='mind:tests-ahead'&&list(c.listRows).length===1?list(c.listRows)[0]:null,
     raw=own||idx.get(str(first.id))||first,
     row=own?{...testRow(own,s,t),open:true}:workRow(raw,s,t,{open:true});
   a.rows=[row];
   a.title=row.course&&dateOnlyTitle(row.name)?row.course.short+' · '+row.name:row.name;
   a.summary=[row.course?.short,row.due.text].filter(Boolean).join(' · ');
   a.focus=row.id;
   const more=list(c.items).slice(1).map(v=>idx.get(str(v.id))||v).filter(v=>v&&v.id);
   if(more.length)a.also=more.map(v=>workRow(v,s,t));
   a.acts=rowActs(row).filter(x=>x.intent!=='details');
   a.text=[row.name,row.course?.short,row.due.at!==null?row.due.text.toLowerCase():''].filter(Boolean).join(', ')+'.';
   a.follow=row.type==='work'&&!['submitted','graded','done'].includes(row.state)?
     [{label:'plan it',line:'plan '+row.rawName},{label:'how long will it take',line:'how long will '+row.rawName+' take'}]:
     [];
   return a;
 };
 BUILD.fact=(c,s,t,o)=>{
   const a=BUILD.item(c,s,t,o),row=a.rows[0],msg=str(c.message);
   delete a.focus;
   let label=c.answer?.label||'',value=c.answer?.value||'';
   if(/^Not yet/.test(msg)){label='Turned in?';value='Not yet';}else if(/^Yes\b/.test(msg)){label='Turned in?';value='Yes';}
   if(row&&(/ due$/.test(label)||!value)&&row.due.at!==null){
     label='Due';
     const dd=t.dayDiff(row.due.at);
     value=(dd===0?'Today':dd===1?'Tomorrow':dd===-1?'Yesterday':t.weekday(row.due.at,true))+', '+t.date(row.due.at)+(row.dayOnly?'':' · '+t.clock(row.due.at));
     a.value={label,text:value,sub:row.due.rel==='late'?row.due.short:relIn(row.due.at,t)};
   }
   else a.value={label:label.replace(new RegExp('^'+escapeRe(row?.rawName||'')+'\\s*'),'')||'Answer',text:value||msg};
   a.kind='fact';
   a.title=row?.name||a.value.label;
   return a;
 };
 const escapeRe=v=>str(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function relIn(at,t){const ms=at-t.now;if(ms<0)return '';const h=Math.round(ms/HOUR);return h<1?'in '+Math.max(1,Math.round(ms/MIN))+' min':h<36?'in '+h+' h':'in '+Math.round(ms/DAY)+' days';}
 BUILD.plan=(c,s,t,o)=>{
  const a=o.base,P=Planner(),fields={...obj(c.next?.fields)},plan=P?.build(s,fields);a.plan={fields};if(!plan){a.kind='chat';return a;}
  const said=/^(.{2,40}?)\s+(?:today|tomorrow|tonight|on\s+\w+|(?:mon|tues|wednes|thurs|fri|satur|sun)day)?\s*at\s+[^,]+,\s*noted\./i.exec(str(c.message))?.[1];
  if(said)fields.avoid=list(fields.avoid).map(v=>({...v,label:v.label||said}));
  const idx=index(s),rows=[],items=new Map(list(plan.items).map(v=>[v.itemId,v]));
  // busy time inside the window: their own events, reminders, focus, and what the line named ("swim 5 to 7")
  for(const b of list(plan.busy)){
    if(b.end<=plan.window.start||b.start>=plan.window.end)continue;
    rows.push({
      id:'busy-'+b.start,
      type:'busy',
      name:b.label||(b.kind==='excluded'?busyName(fields,b)||'Busy':b.kind==='reminder'?'Reminder':b.kind==='focus'?'Focus running':b.kind==='planner'?(idx.get(str(b.itemId))?.title||'Planned'):'Busy'),
      start:b.start,
      end:b.end,
      minutes:Math.round((b.end-b.start)/MIN)
    });
  }
  const seen=new Map();
  for(const b of list(plan.blocks)){
    if(b.kind==='break'){rows.push({id:b.id||'break-'+b.start,type:'break',name:'Break',start:b.start,end:b.end,minutes:b.minutes});continue;}
    const raw=idx.get(str(b.itemId))||{id:b.itemId,title:b.title,courseId:b.courseId},n=(seen.get(b.itemId)||0)+1;
    seen.set(b.itemId,n);
    const item=items.get(b.itemId),parts=list(plan.blocks).filter(x=>x.itemId===b.itemId).length;
    rows.push({
      ...workRow(raw,s,t),
      id:b.id||('block-'+b.itemId+'-'+n),
      itemId:str(b.itemId),
      type:'work',
      block:{part:n,parts},
      start:b.start,
      end:b.end,
      minutes:b.minutes,
      total:item?.estimate||b.minutes,
      minutesFrom:minutesSource(raw,s),
      why:b.reason
    });
  }
  rows.sort((x,y)=>x.start-y.start||x.end-y.end);
  // gaps the student keeps free
  const timed=rows.filter(r=>r.type!=='busy');
  for(let i=1;i<timed.length;i++){
    const gap=timed[i].start-timed[i-1].end;
    if(gap>=10*MIN&&!rows.some(r=>r.type==='busy'&&r.start<timed[i].start&&r.end>timed[i-1].end))
      rows.push({id:'gap-'+timed[i-1].end,type:'gap',name:'Free',start:timed[i-1].end,end:timed[i].start,minutes:Math.round(gap/MIN)});
  }
  rows.sort((x,y)=>x.start-y.start||x.end-y.end);a.rows=rows;
  // work still on time now but due before the first slot (the planner leaves it out of the plan): shown on top, never dropped
  const early=list(plan.before).map(v=>
    workRow(
      idx.get(str(v.itemId))||{id:v.itemId,title:v.title,courseId:v.courseId,dueAt:v.dueAt},
      s,
      t,
      {minutes:v.estimate||null,minutesFrom:minutesSource(idx.get(str(v.itemId))||{id:v.itemId},s)}));
  if(early.length)a.before=early;
  const work=rows.filter(r=>r.type==='work'),things=new Set(work.map(r=>r.itemId)).size,breaks=rows.filter(r=>r.type==='break').length;
  if(work.length){
    const first=work[0].start,last=Math.max(...rows.filter(r=>r.type!=='busy'&&r.type!=='gap').map(r=>r.end));
    a.title=t.dayWord(first,{long:true})+', '+t.span(first,last);
    a.summary=[things+(things===1?' thing':' things'),t.length(plan.workMinutes)+' of work',breaks?breaks+(breaks===1?' break':' breaks'):''].filter(Boolean).join(' · ');
    a.window={start:first,end:last};
  }
  else{a.title=a.before?'Nothing else to plan':plan.message||a.text;a.kind='none';}
  const late=work.filter(r=>r.state==='late');
  if(late.length)a.notes.push({key:'late',text:new Set(late.map(r=>r.itemId)).size+' of these '+(new Set(late.map(r=>r.itemId)).size===1?'is':'are')+' late'});
  for(const r of list(plan.remaining))a.notes.push({key:'more',text:cap(r.title,40)+' needs '+t.length(r.minutes)+' more',itemId:r.itemId});
  const left=leftOut(plan,s,t,fields,idx);if(left.rows.length){a.left=left.rows;a.notes.push({key:'later',text:left.rows.length+(left.rows.length===1?' more can wait':' more can wait')});}
  if(plan.oldOut)a.notes.push({key:'old',text:plan.oldOut+' older '+(plan.oldOut===1?'one':'ones')+' left out',follow:'plan catch up'});
  if(plan.reviewSuggestion){
    const r=plan.reviewSuggestion;
    a.rows.push({id:'review',type:'work',name:r.title,start:r.start,end:r.end,minutes:r.minutes,why:r.reason,course:courseOf(s,r.courseId),state:'open',due:t.due(null)});
    a.title=t.dayWord(r.start,{long:true})+', '+t.span(r.start,r.end);
    a.summary='Nothing due needs time';
    a.kind='plan';
  }
  if(plan.message&&!work.length&&!plan.reviewSuggestion&&!a.before)a.title=plan.message;
  a.planId=plan.id;a.night=!!plan.night;
  if(work.length||plan.reviewSuggestion)a.acts.push(act('use-plan','Use this plan','plan',fields,{primary:true,change:true}));
  if(work.length)
    a.acts.push(act('start-first','Start first','focus',{operation:'start',mode:'focus',minutes:Math.min(45,work[0].minutes),cycles:1,breakMinutes:0,itemId:work[0].itemId,courseId:work[0].course?.id}));
  a.follow=followForPlan(fields,o.line,work,s);
  return a;
 };
 function busyName(fields,b){const v=list(fields.avoid).find(x=>stamp(x?.start)===b.start);return clean(v?.label||v?.title||v?.name);}
 function minutesSource(raw,s){const mine=obj(obj(s.local?.tasks||s.local)[raw.id]);return Number(mine.estimate||raw.estimate)>0?'saved':'guess';}
 function leftOut(plan,s,t,fields,idx){
   const used=new Set([...list(plan.items),...list(plan.before)].map(v=>str(v.itemId))),line=clean(fields.line||fields.text);
   if(!plan.later)return {rows:[]};
   const rows=open(s,t).filter(v=>!used.has(str(v.raw.id))&&(v.at===null||v.at>=t.now-7*DAY)).slice(0,plan.later).map(v=>workRow(v.raw,s,t));
   return {rows};
 }
 function edit(a,snapshot,{op,itemId}={}){
  if(!a||!a.plan||a.kind!=='plan'&&!(op==='now'&&list(a.before).length))return null;
  const s=obj(snapshot),order=[...new Set(list(a.rows).filter(r=>r.type==='work'&&r.itemId).map(r=>str(r.itemId)))],early=list(a.before).map(r=>str(r.itemId||r.id));
  if(op==='now'){
    let sum=list(a.before).reduce((n,r)=>n+(r.minutes||0),0);
    const ids=[...early];
    for(const id of order){const n=Math.max(0,...list(a.rows).filter(r=>str(r.itemId)===id).map(r=>r.total||r.minutes||0));if(sum+n>180)break;ids.push(id);sum+=n;}
   // the early work first, then the plan's own work up to the planner's three hours, starting now
   const fields={...a.plan.fields,itemIds:[...new Set(ids)],start:timeKit(s).now};
   for(const k of ['itemId','mode','date','time','text','line','courseId','after','startAt'])delete fields[k];
   const out=rebuild(a,s,fields);
   out.fromNow=true;
   return out;
  }
  const i=order.indexOf(str(itemId));if(i<0)return null;
  if(op==='drop')
    order.splice(i,1);
  else if(op==='earlier'&&i>0)[order[i-1],order[i]]=[order[i],order[i-1]];else if(op==='later'&&i<order.length-1)[order[i+1],order[i]]=[order[i],order[i+1]];else return a;
  const fields={...a.plan.fields,itemIds:[...new Set([...early,...order])]};
  delete fields.itemId;
  delete fields.mode;
  if(!order.length){const t=timeKit(s);return finish({...a,kind:'none',title:'Nothing left in this plan',summary:'',rows:[],notes:[],acts:[],plan:{fields},follow:['plan my day']},s,t);}
  return rebuild(a,s,fields);
 }
 function rebuild(a,s,fields){
   const card={action:'plan',next:{action:'plan',fields},message:a.text,understanding:{reason:a.source?.reason||''}};
   const out=build(card,s,{},{line:a.source?.line||''});
   out.edited=(a.edited||0)+1;
   return out;
 }
 function followForPlan(fields,line,work,s){
   const out=[];
   if(!/\b(?:to|until|till)\b/.test(line))out.push('only 1 hour');
   out.push(/tomorrow/.test(line)?'plan tonight':'plan tomorrow');
   const courses=[...new Set(work.map(r=>r.course?.short).filter(Boolean))];
   if(courses.length>1)out.push('only '+courses[0]);
   return out;
 }
 BUILD.week=(c,s,t,o)=>{
  const a=o.base,A=Ask(),idx=index(s),wk=A?.buildPlan?.('week',{now:t.now,timeZone:t.zone,assignments:open(s,t).map(v=>({...v.raw,title:v.raw.title||v.raw.name}))});
  const days=new Map();
  for(const it of list(wk?.items)){
    const raw=idx.get(str(it.id));
    if(!raw)continue;
    const day=it.day||wk.day;
    if(!days.has(day))days.set(day,[]);
    days.get(day).push({...workRow(raw,s,t),id:'w-'+raw.id,itemId:str(raw.id),minutes:it.estimate||estimateOf(workRow(raw,s,t)),minutesFrom:minutesSource(raw,s),day});
  }
  a.rows=[...days.values()].flat();
  a.groups=[...days.entries()].sort().map(([day,rows])=>
    ({key:day,label:t.dayWord(Date.parse(day+'T17:00:00Z'),{long:true}),sub:t.length(rows.reduce((n,r)=>n+(r.minutes||0),0)),rows:rows.map(r=>r.id)}));
  if(!a.rows.length){a.kind='none';a.title='A quiet week';return a;}
  a.title='Your week';
  a.summary=a.rows.length+' things · '+a.groups.length+' days · '+t.length(a.rows.reduce((n,r)=>n+(r.minutes||0),0));
  a.acts.push(act('use-week','Use this plan','plan',obj(c.next?.fields),{primary:true,change:true}));a.follow=['plan tonight','what is due this week'];return a;
 };
 BUILD.next=(c,s,t,o)=>{
   const a=BUILD.list({...c,understanding:{reason:'what-now'}},s,t,{...o,reason:'what-now'});
   const ranked=rankNext(s,t);
   if(ranked.length)
     a.rows=ranked.map((v,i)=>({...workRow(v,s,t),rank:i+1}));
   else{a.rows=[];a.kind='none';a.title='Nothing waiting';a.summary='';a.acts=[];a.groups=null;a.filters=null;a.follow=['plan tomorrow','what is due this week'];return a;}
   a.groups=null;
   a.kind='next';
   a.title=a.rows.length?'Start with '+a.rows[0].name:'Nothing waiting';
   a.summary=a.rows[0]?whyText(a.rows[0],t):'';
   a.lead=/^That sounds like a lot/.test(a.text)?'One step at a time.':'';
   a.acts=[act('use-plan','Plan these','plan',obj(c.next?.fields),{primary:true,change:true})];
   if(a.rows[0])
     a.acts.push(act('start-first','Start first','focus',{
       operation:'start',
       mode:'focus',
       minutes:Math.min(45,estimateOf(a.rows[0])),
       cycles:1,
       breakMinutes:0,
       itemId:a.rows[0].id,
       courseId:a.rows[0].course?.id
     }));
   a.follow=['plan tonight','what is due this week'];
   return a;
 };
 function rankNext(s,t,courseId){
   const rows=open(s,t).filter(v=>(v.at===null||v.at>=t.now-7*DAY)&&(!courseId||str(v.raw.courseId)===str(courseId))),
     rank=v=>v.raw.personal?0:v.at===null?3:v.at>=t.now?(v.at-t.now<=3*DAY?1:3):2;
   return rows.sort((a,b)=>rank(a)-rank(b)||(a.at??Infinity)-(b.at??Infinity)).slice(0,5).map(v=>v.raw);
 }
 function whyText(r,t){return r.state==='late'?'It is '+r.due.short:r.due.rel==='today'?'Due today, '+t.clock(r.due.at):r.due.rel==='tomorrow'?'Due tomorrow':r.due.text;}
 BUILD.grades=(c,s,t,o)=>{
   const a=o.base,idx=index(s);
   a.rows=list(c.items).filter(v=>['grade','course-grade'].includes(v.kind)).map(v=>{
     const g=list(s.grades).find(x=>str(x.id)===str(v.id))||v,course=courseOf(s,g.courseId),pct=Number(g.value??g.score);
     return {
       id:str(g.id),
       type:'grade',
       name:g.kind==='course-grade'||/^course-grade-/.test(str(g.id))?(course?.short||g.title):clean(g.title),
       course,
       value:Number.isFinite(pct)?(g.points?pct+' / '+g.points:pct+'%'):str(g.text||g.value),
       url:''
     };
   });
   a.title=a.rows.length===1?a.rows[0].name:'Grades';
   if(c.answer?.value){a.value={label:c.answer.label,text:c.answer.value};a.title=c.answer.label;a.rows=a.rows.slice(1);}
   a.acts.push(act('grades','Open grades','navigate',{tab:'grades'},{primary:true}));
   a.follow=['what counts most','my grades'];
   return a;
 };
 BUILD.messages=(c,s,t,o)=>{
   const a=o.base,idx=index(s),ids=list(c.items).map(v=>str(v.id)),all=[...list(s.announcements).map(v=>({...v,kind:'announcement'})),...list(s.messages).map(v=>({...v,kind:'message'}))];
   const pick=all.filter(v=>ids.includes(str(v.id)));
   const rest=all.filter(v=>!ids.includes(str(v.id))).sort((x,y)=>(stamp(y.postedAt||y.at)||0)-(stamp(x.postedAt||x.at)||0));
   a.rows=[...pick,...(ids.length===1&&o.reason==='loaded-fact'?rest.slice(0,4):[])].map(v=>{
     const at=stamp(v.postedAt||v.at||v.lastMessageAt),text=plain(v.message||v.body||v.lastMessage||'');
     return {
       id:str(v.id),
       type:v.kind,
       name:clean(v.title||v.subject)||'(no subject)',
       course:courseOf(s,v.courseId),
       from:list(v.participants).join(', ')||clean(v.author?.display_name||v.authorName),
       when:at?t.dayWord(at)+' '+t.clock(at):'',
       unread:v.unread===true||v.workflowState==='unread'||v.workflow_state==='unread',
       excerpt:cap(text,140),
       detail:{text:cap(text,900),full:text.length>900,links:links(v.message||v.body)},
       url:safeUrl(v.url||v.htmlUrl)
     };
   });
   const unread=a.rows.filter(r=>r.unread).length;
   a.title=a.rows.every(r=>r.type==='message')?'Messages':'Announcements';
   a.summary=[a.rows.length+(a.rows.length===1?' post':' posts'),unread?unread+' new':''].filter(Boolean).join(' · ');
   a.acts.push(act('inbox',a.title==='Messages'?'Open Inbox':'Open all','navigate',{tab:'messages'},{primary:true}));
   return a;
 };
 BUILD.files=(c,s,t,o)=>{
   const a=o.base,idx=index(s),found=list(c.items),fileish=v=>['file','page','syllabus','link','module','module-item'].includes((idx.get(str(v.id))||v).kind);
   a.also=found.filter(v=>!fileish(v)).map(v=>workRow(idx.get(str(v.id))||v,s,t));
   a.rows=found.filter(fileish).map(v=>{
     const raw=idx.get(str(v.id))||v,
       course=courseOf(s,raw.courseId),
       kind=['page','syllabus'].includes(raw.kind)||/^syllabus:/.test(str(raw.id))?'page':raw.kind==='module'||raw.kind==='module-item'?'module':'file',
       name=clean(raw.title||raw.name||raw.display_name),
       ext=(/\.([a-z0-9]{2,5})$/i.exec(name)||[])[1],
       updated=stamp(raw.updatedAt||raw.updated_at||raw.modifiedAt),
       text=plain(raw.body||raw.description||'');
     return {
       id:str(raw.id),
       type:kind,
       name,
       course,
       format:ext?ext.toUpperCase():kind==='page'?'Page':kind==='module'?'Module':'File',
       size:Number(raw.size)>0?sizeText(Number(raw.size)):'',
       when:updated?t.dayWord(updated)+'':'',
       excerpt:cap(text,160),
       detail:text?{text:cap(text,900),full:text.length>900,links:links(raw.body||raw.description)}:null,
       url:safeUrl(raw.url||raw.htmlUrl||raw.html_url)
     };
   });
   a.title=a.rows.length===1?a.rows[0].name:'Found '+a.rows.length;
   a.summary=a.rows.length===1?[a.rows[0].format,a.rows[0].course?.short].filter(Boolean).join(' · '):'';
   if(a.rows.length===1)a.acts=rowActs({...a.rows[0],type:a.rows[0].type==='module'?'page':a.rows[0].type});
   a.follow=a.rows[0]?[{label:'explain it',line:'explain '+a.rows[0].name.replace(/\.[a-z0-9]+$/i,'')}]:[];
   return a;
 };
 function sizeText(n){return n<1e6?Math.max(1,Math.round(n/1e3))+' KB':(n/1e6).toFixed(1).replace(/\.0$/,'')+' MB';}
 const TOOL_TITLE={calculator:{graphing:'Graphing calculator',scientific:'Scientific calculator','':'Calculator'},gpa:{'':'GPA calculator'},quick:{'':'Quick open'}};
 BUILD.place=(c,s,t,o)=>{
   const a=o.base,f=obj(c.next?.fields);
   if(f.tool&&TOOL_TITLE[f.tool]){
     a.title=TOOL_TITLE[f.tool][f.mode||'']||TOOL_TITLE[f.tool][''];
     a.summary='In Tools';
     a.place={tool:f.tool,label:a.title};
     a.acts.push(act('go','Open','navigate',f,{primary:true}));
     return a;
   }
   return placeOf(c,s,t,o);
 };
 function placeOf(c,s,t,o){
   const a=o.base,
     f=obj(c.next?.fields),
     course=courseOf(s,f.courseId||list(c.items)[0]?.courseId||list(c.items)[0]?.id),
     TAB={grades:'Grades',planner:'Planner',messages:'Messages',materials:'Materials',assignments:'Assignments',home:'Home',course:'Course'};
   a.place={tab:clean(f.tab),label:course&&(!f.tab||f.tab==='course')?course.short:TAB[f.tab]||cap(str(c.message).replace(/^Open (the )?/i,'').replace(/\.$/,''),30)};
   a.title=course?course.short:a.place.label;
   if(course){
     const work=open(s,t).filter(v=>str(v.raw.courseId)===course.id);
     a.rows=work.slice(0,4).map(v=>workRow(v.raw,s,t));
     a.summary=work.length?[work.length+' open',work[0]?.at!=null?'next '+t.due(work[0].at).short:''].filter(Boolean).join(' · '):'Nothing open';
     a.more=Math.max(0,work.length-4);
   }
   a.acts.push(act('go','Open '+a.title,c.next?.action||'navigate',f,{primary:true}));
   return a;
 }
 BUILD.choose=(c,s,t,o)=>{
   const a=o.base,idx=index(s),choices=list(c.choices).length?list(c.choices):list(c.items);
   a.title=/^Which course do you mean/.test(str(c.message))||/have that name/.test(str(c.message))?'Which one?':cap(str(c.message).replace(/\s*Which one do you want.*$/,''),90)||'Which one?';
   a.question=/Which/.test(a.text)?a.text.match(/Which[^.?]*\?/)?.[0]||'Which one?':'Which one?';
   a.rows=choices.slice(0,9).map((v,i)=>{
     const raw=idx.get(str(v.id));
     if(raw)return {...workRow(raw,s,t),choice:i+1,pick:{intent:'open',fields:{itemId:str(raw.id),courseId:str(raw.courseId)}}};
     return {id:'choice-'+i,type:'choice',choice:i+1,name:clean(v.label||v.title||v.name),pick:{intent:v.action||'none',fields:obj(v.fields)}};
   });
   a.kind='choose';
   return a;
 };
 BUILD.steps=(c,s,t,o)=>{
   const a=o.base,steps=list(c.requests).length?list(c.requests):list(c.next?.fields?.steps);
   a.rows=steps.map((v,i)=>
     ({id:'step-'+i,type:'step',step:i+1,name:clean(v.message||v.label)||('Step '+(i+1)),state:'waiting',intent:v.next?.action||v.action,fields:obj(v.next?.fields||v.fields)}));
   a.title=a.rows.length+' steps';
   a.summary='';
   a.acts.push(act('run-all','Do all '+a.rows.length,'batch',obj(c.next?.fields),{primary:true,change:true}),act('run-one','One at a time','step',{},{local:true}));
   return a;
 };
 const SETTING_NAMES={theme:'Light or dark',sceneTheme:'Scene',motion:'Motion',showGrades:'Show grades',bedtime:'Bedtime',fontSize:'Text size',density:'Density'};
 BUILD.change=(c,s,t,o)=>{
  const a=o.base,f=obj(c.next?.fields),action=str(c.action),idx=index(s),items=list(c.items);a.change={intent:action,fields:f};
  const target=idx.get(str(f.itemId))||items[0];
  const row=target&&target.id?workRow(target,s,t):null;
  const say=(name,from,to,extra={})=>({id:'c-'+a.rows.length,type:'change',name,from,to,...extra});
  if(action==='complete'&&row){a.title='Mark done';a.rows=[{...row,change:{from:row.stateText||'Open',to:'Done on your list'}}];a.note='Canvas is not changed';}
  else if(action==='bookmark'&&row){a.title='Bookmark';a.rows=[{...row,change:{from:'',to:'Bookmarks'}}];}
  else if(action==='move'&&row){
    a.title='Move';
    a.rows=[
      {
        ...row,
        change:{from:row.planned?t.dayWord(Date.parse(row.planned.day+'T17:00:00Z')):'Not planned',to:f.date?t.dayWord(Date.parse(f.date+'T17:00:00Z'),{long:true})+(f.time?' '+f.time:''):'Another day'}
      }
    ];
  }
  else if(action==='remove'&&row){a.title='Take off the plan';a.rows=[{...row,change:{from:row.planned?'Planned':'In the plan',to:'Not planned'}}];}
  else if(action==='reminder'){const at=stamp(f.at);a.title='Reminder';a.rows=[say(cap(f.title||f.text||'Reminder',80),'',at?t.dayWord(at,{long:true})+', '+t.clock(at):'',{when:at})];}
  else if(action==='note'){a.title='Note';a.rows=[say(cap(f.text||'',160),'','Your notes')];}
  else if(action==='task'){
    a.title='Add to your list';
    a.rows=[say(cap(f.name||'',90),'',[f.day?t.dayWord(Date.parse(f.day+'T17:00:00Z')):'',f.estimate?'about '+t.length(f.estimate)+' (a guess)':''].filter(Boolean).join(' · ')||'Your list')];
  }
  else if(action==='setting'){
    const now=obj(s.settings)[f.key];
    a.title=SETTING_NAMES[f.key]||cap(str(c.message).replace(/^Set |\.$/g,''),40);
    a.rows=[say(SETTING_NAMES[f.key]||f.key,valueText(now),valueText(f.value))];
  }
  else if(action==='module'){
    a.title=cap(str(c.message).replace(/\.$/,''),50);
    a.rows=[say(cap(str(f.key).replace(/^./,x=>x.toUpperCase()),40)+' on Home',f.action==='hide'?'Shown':'Hidden',f.action==='hide'?'Hidden':'Shown')];
  }
  else if(action==='feature'){
    a.title=cap(str(c.message).split('.')[0],60);
    a.rows=[say(cap(str(c.message).replace(/^(Enable|Disable|Turn (on|off)) /i,'').split('.')[0],50),/^(Disable|Turn off)/i.test(c.message)?'On':'Off',/^(Disable|Turn off)/i.test(c.message)?'Off':'On')];
    if(/Reload/.test(c.message))a.note='Canvas reloads after';
  }
  else if(action==='undo'){a.title='Undo';a.rows=[];a.undo=true;}
  else {a.title=cap(str(c.message).replace(/\.$/,''),70);}
  a.acts.push(act('apply',action==='undo'?'Undo':a.rows.length>1?'Apply '+a.rows.length:applyWord(action),action,f,{primary:true,change:true}));
  return a;
 };
 const applyWord=action=>
   ({
     complete:'Mark done',
     bookmark:'Bookmark',
     reminder:'Set reminder',
     note:'Save note',
     task:'Add it',
     move:'Move it',
     remove:'Take it off',
     setting:'Change it',
     module:'Change it',
     feature:'Change it',
     routine:'Save it'
   }[action]||
     'Do it');
 const valueText=v=>v===true?'On':v===false?'Off':v===undefined||v===null||v===''?'Default':cap(str(v).replace(/^./,x=>x.toUpperCase()),24);
 BUILD.timer=(c,s,t,o)=>{
   const a=o.base,
     f=obj(c.next?.fields),
     idx=index(s),
     raw=idx.get(str(f.itemId)),
     minutes=Number(f.minutes)||(str(c.action)==='break'?5:25),
     focus=obj(s.focus),
     running=focus.running||stamp(focus.endsAt)>t.now;
   a.timer={
     mode:str(c.action)==='break'||f.mode==='break'?'break':'focus',
     minutes,
     until:t.now+minutes*MIN,
     running,
     left:running&&stamp(focus.endsAt)?Math.max(0,stamp(focus.endsAt)-t.now):null
   };
   a.title=(a.timer.mode==='break'?'Break ':'Focus ')+t.length(minutes);
   a.summary='Until '+t.clock(a.timer.until);
   if(raw)a.rows=[workRow(raw,s,t)];
   a.acts.push(act('start','Start','focus'===str(c.action)?'focus':str(c.action),f,{primary:true}));
   a.follow=a.timer.mode==='focus'?['take a break','plan tonight']:[];
   return a;
 };
 BUILD.feature=(c,s,t,o)=>{
   const a=o.base,
     path=list(c.ui?.path).length?
       list(c.ui.path):
       [
         'Make it yours',
         ...(c.next?.fields?.tab?[cap(str(c.next.fields.tab).replace(/^./,x=>x.toUpperCase()),20)]:[]),
         ...str(c.message).replace(/^Make it yours\s*>\s*/,'').replace(/\.$/,'').split(/\s*>\s*/).slice(1)
       ];
   a.path=path.map(v=>cap(v,24));
   a.title=a.path.at(-1)||'Make it yours';
   a.off=/first\.?$|is off|Turn on/i.test(str(c.message));
   a.summary=a.off?'Off right now':'';
   const tab=(a.path[1]||'').toLowerCase(),
     tool=a.path[0]==='Tools'?{Calculator:'calculator',GPA:'gpa','Quick open':'quick'}[a.path[1]]:null,
     mode=tool==='calculator'?{Graphing:'graphing',Scientific:'scientific'}[a.path[2]]:null;
   if(tool)a.title=({calculator:{graphing:'Graphing calculator',scientific:'Scientific calculator'}}[tool]||{})[mode]||a.path[1];
   if(c.open?.fields||tool)
     a.acts.push(act('open',c.open?.label||'Open',c.open?.intent||'navigate',c.open?.fields||{tool,...(mode?{mode}:{})},{primary:true}));
   else if(a.path[0]!=='Tools')
     a.acts.push(act('show','Show me','point',{path:a.path,tab:['look','layout','courses','pet','settings','features','more'].includes(tab)?(tab==='features'?'settings':tab):'look'},{primary:true}));
   if(a.off)a.acts.push(act('turn-on','Turn on','follow',{line:'turn on '+a.title}));
   a.choices=list(c.choices).map((v,i)=>({id:'choice-'+i,label:v.label,intent:v.action,fields:v.fields}));
   return a;
 };
 BUILD.ai=(c,s,t,o)=>{
   const a=o.base,f=obj(c.next?.fields),h=obj(f.handoff),idx=index(s);
   a.title='Ask your AI';
   a.summary=cap(h.wishes||o.line,80);
   a.rows=list(h.sources).map(v=>{
     const raw=idx.get(str(v.id))||v;
     return {id:str(v.id),type:raw.kind==='file'?'file':'work',name:clean(v.label||raw.title||raw.name),course:courseOf(s,v.courseId||raw.courseId),format:'Sent'};
   });
   if(!a.rows.length&&list(c.items)[0]){const raw=idx.get(str(c.items[0].id))||c.items[0];a.rows=[{...workRow(raw,s,t),format:'Sent'}];}
   a.acts.push(act('ask','Ask AI','ai',{question:h.wishes||f.text,handoff:f.handoff},{primary:true}));
   return a;
 };
 BUILD.blocked=(c,s,t,o)=>{
   const a=o.base;
   a.title=/grades/i.test(a.text)?'Grades are hidden':cap(a.text,60);
   a.acts.push(act('show-grades','Show grades','setting',{key:'showGrades',value:true},{primary:true,change:true}));
   return a;
 };
 BUILD.none=(c,s,t,o)=>{
   const a=o.base,msg=str(c.message),m=/^(.*?)(?:\.\s*)?Next(?: up)?(?: is)?:?\s*(.+?)(?: on (\w+))?\.?$/.exec(msg);
   a.title=cap((m?m[1]:msg).replace(/\.$/,''),70);
   const next=/^No (?:matching|courses or Canvas items|loaded)\b/i.test(msg)?null:c.offerCourse?rankNext(s,t,c.offerCourse)[0]:rankNext(s,t)[0];
   if(next){a.rows=[workRow(next,s,t)];a.nextLabel=c.offerCourse?'Due next in '+(courseOf(s,c.offerCourse)?.short||'that course'):'Next up';}
   a.follow=list(c.follow).length?list(c.follow):['what is due this week','plan tonight'];
   return a;
 };
 BUILD.unknown=(c,s,t,o)=>{const a=o.base;a.title='I don’t know that one yet';a.near=nearest(o.line,s,t,c);a.rows=a.near.rows;a.follow=a.near.lines;return a;};
 const FILLER=new Set(['the','and','for','you','your','what','whats','wat','with','this','that','about','please','pls','can','how','are','not','any','all','get','got','have','from','just','want','need','show','tell','give','make','some','biscuit']);
 function nearest(line,s,t,c){
   const words=clean(line).toLowerCase().split(/\s+/).map(w=>w.replace(/[^a-z0-9]+/g,'')).filter(w=>w.length>=3&&!FILLER.has(w)),rows=[],lines=[];
   if(words.length){
     for(const v of open(s,t)){
       const n=clean(v.raw.title||v.raw.name).toLowerCase();
       if(words.some(w=>n.includes(w.slice(0,5))))rows.push(workRow(v.raw,s,t));
       if(rows.length>=3)break;
     }
     for(const co of list(s.courses)){
       const cs=courseOf(s,co.id);
       if(cs&&words.some(w=>cs.short.toLowerCase().startsWith(w.slice(0,4))))lines.push('whats left for '+cs.short.toLowerCase());
     }
   }
   lines.push('what should i do','plan tonight','what is due this week');
   return {rows,lines:[...new Set(lines)].slice(0,4)};
 }
 BUILD.chat=(c,s,t,o)=>{
   const a=o.base;
   a.title=a.text;
   if(/^Try /.test(a.text)){a.title='Things to try';a.follow=[...a.text.matchAll(/"([^"]+)"/g)].map(m=>m[1]).slice(0,4);}
   else if(o.reason==='answer-request'){a.follow=['explain the question','make me a practice question'];}
   else if(/^Okay, nothing changed/.test(a.text)){a.follow=[];}else a.follow=['what should i do','plan tonight'];
   return a;
 };
 // The engine's sentence about one loaded item ends with that item's search fields joined by ";" ("due Wed, Nov 25,
 // 11:59 PM; attempts used: ; late: false; submission types: online_upload; allowed extensions:"). Said as a person would:
 // a field that is empty, false or null goes; "Late" only when it is late; how it is handed in and file types in plain words.
 const FIELD_NAMES='reply due at|available from|available until|start at|end at|location|room|status|attempts allowed|attempts used|attempts remaining|attempt|points possible|possible|current percent|percent|missing|late|submission types|allowed extensions|notes allowed|calculator allowed|formula sheet allowed|scoring policy|email|price|installed|enabled|members|group name|meeting time|approved due at|weekdays',
   FIELD_RE=new RegExp('^('+FIELD_NAMES+'):\\s*(.*)$','i'),
   FIELD_TAIL=new RegExp('^(.*?[.!?:])\\s+((?:'+FIELD_NAMES+'):.*)$','i');
 const FIELD_WORD={'reply due at':'Reply due','available from':'Opens','available until':'Closes','start at':'Starts','end at':'Ends','attempts remaining':'Attempts left','points possible':'Points',possible:'Points','current percent':'Grade',percent:'Grade','approved due at':'Due','group name':'Group','meeting time':'Meets','scoring policy':'Scoring'};
 const WHEN='(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*,\\s[^;]*?\\d{1,2}:\\d{2}\\s*[ap]m',DUE_FIELD=new RegExp('^(due|submitted)\\s+('+WHEN+')$','i'),DUE_TAIL=new RegExp('^(.*\\S)\\s+((?:due|submitted)\\s+'+WHEN+')$','i');
 function field(seg){
   let m=DUE_FIELD.exec(seg);
   if(m)return m[1][0].toUpperCase()+m[1].slice(1).toLowerCase()+' '+m[2];
   m=FIELD_RE.exec(seg);
   if(!m)return null;
   const key=m[1].toLowerCase(),v=m[2].trim(),word=(FIELD_WORD[key]||key).replace(/^./,x=>x.toUpperCase());
   if(!v||/^(?:false|null|undefined|none)$/i.test(v))return '';
   if(key==='submission types'){const w=v.split(/,\s*/).map(k=>SUBMIT[k.trim()]).filter(Boolean);return w.length?'Hand in: '+w.join(', ').toLowerCase():'';}
   if(key==='allowed extensions'){
     const e=v.split(/,\s*/).map(x=>x.trim().replace(/^\./,'').toLowerCase()).filter(x=>/^[a-z0-9]{1,8}$/.test(x));
     return e.length?'File types: '+e.map(x=>'.'+x).join(', '):'';
   }
   return /^true$/i.test(v)?word:word+': '+v;
 }
 function tidy(text){
  const all=clean(text),out=[];
  for(const part of all.split(/;\s*/)){
    const seg=part.trim(),tail=out.length?null:DUE_TAIL.exec(seg)||FIELD_TAIL.exec(seg),f=field(tail?tail[2]:seg);
    if(tail&&f!==null)out.push({text:tail[1]},{text:f,field:true});else if(f!==null&&!tail)out.push({text:f,field:true});else out.push({text:seg});
  }
  if(!out.some(x=>x.field))return all;
  let said='',lastField=false;
  for(const x of out){
    if(!x.text)continue;
    if(!said)said=x.text;else if(x.field||lastField)said=said.replace(/[\s;,]+$/,'')+(/[.!?:]$/.test(said)?' ':'. ')+x.text;else said+='; '+x.text;
    lastField=!!x.field;
  }
  return lastField&&!/[.!?]$/.test(said)?said+'.':said;
 }
 // what the engine said about a found item beyond what its details already show (instructions, due, how it is handed in)
 function itemExtra(text,item,s){
   const flat=v=>str(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),
     raw=index(s).get(str(item.itemId||item.id))||{},
     known=' '+flat(plain(raw.description||raw.instructions||raw.body||'')+' '+(item.detail?.text||''))+' ';
   return cap(clean(text).split(/(?<=[.!?])\s+/).filter(x=>{
     const k=flat(x);
     return k&&!known.includes(' '+k+' ')&&!/^(?:due|hand in|file types|late|missing)\b/.test(k)&&!(item.points!=null&&/^points\b/.test(k));
   }).join(' '),140);
 }
 // ---- after an action ran: what changed, and how to put it back
 function result(intent,fields,res,snapshot={},previous=null){
   const s=obj(snapshot),t=timeKit(s),ok=res!==false&&res?.ok!==false,msg=tidy(res?.message||(typeof res==='string'?res:''));
   const a={v:1,kind:ok?'done':'error',title:ok?(msg||'Done.'):(msg||'That did not work.'),summary:'',rows:[],notes:[],acts:[],follow:[],text:msg,source:{action:intent}};
   if(previous&&ok){
     a.rows=list(previous.rows).filter(r=>r.type==='work'||r.type==='change').slice(0,6).map(r=>
       intent==='complete'?{...r,state:'done',stateText:'Done on your list',due:r.due?.at!=null?t.due(r.due.at,{done:true}):r.due}:r);
     if(previous.kind==='plan'){
       a.rows=list(previous.rows);
       a.kind='plan';
       a.applied=true;
       a.title=previous.title;
       a.summary=previous.summary;
       a.notes=list(previous.notes).filter(n=>n.key!=='later');
       a.acts=list(previous.acts).filter(x=>x.id==='start-first');
       if(previous.before){a.before=previous.before;a.plan=previous.plan;}
     }
     const item=['item','fact'].includes(previous.kind)?list(previous.rows).find(r=>r.type==='work'):null,name=clean(item?.rawName||item?.name).toLowerCase();
     if(item&&name&&msg.toLowerCase().startsWith(name+':')){
       a.title=previous.title||item.name;
       a.summary=[previous.summary,itemExtra(msg.slice(name.length+1),item,s)].filter(Boolean).join(' \u00b7 ');
       a.rows=[{...item}];
       a.focus=item.id;
     }
     a.rows=a.rows.filter(r=>r.type!=='change'||!clean(r.name)||!msg.toLowerCase().includes(clean(r.name).toLowerCase()));
   }
   if(!ok)a.acts.push(act('retry','Try again','retry',{},{primary:true}));
   return a;
 }
 function progress(label){return {v:1,kind:'progress',title:clean(label)||'Working',rows:[],notes:[],acts:[],follow:[],text:''};}
 function offline(snapshot){
   const s=obj(snapshot),t=timeKit(s),at=stamp(s.loadedAt||s.syncedAt);
   return {
     v:1,
     kind:'error',
     offline:true,
     title:'Offline',
     summary:at?'Showing what loaded '+t.dayWord(at)+' '+t.clock(at):'Showing what was loaded',
     rows:[],
     notes:[],
     acts:[act('retry','Try again','retry',{},{primary:true})],
     follow:[],
     text:''
   };
 }
 const api={build,edit,result,progress,offline,plain,links,tidy,timeKit,classify,rowActs,workRow:(v,s)=>workRow(v,obj(s),timeKit(obj(s))),dateOnlyTitle};
 root.ReserveBiscuitAnswer=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
