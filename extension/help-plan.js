/* Canvas Harness: a help card into the planner, and a check of the week (4.2).
   "Put it in my planner": a help card that holds a plan (a test's study sheet or practice test, a homework's steps, an
   outline's parts) becomes planner tasks the student sees first, checks, changes or removes, and only then adds. The days
   come before the due date, the lengths are sensible, and a day that is already full gets nothing more.
   "This week": the planner's own data, read by rules: too much on one day, a test with nothing planned for it, big work
   due soon with no day. Each finding has one action (move, add a session) and can be dismissed.
   The integrity line (owner): Help explains, plans, quizzes and checks; it never writes graded work. Here that means: a
   task is a short name, a day and a length. Its name is CH's own words around a few words of the card's plan (a topic, a
   step's action, a part's name), cleaned so that no answer, no worked solution, no quoted or drafted sentence and no maths
   can pass into it. Nothing here writes or submits work, fills in an answer, or sends anything anywhere: no DOM, no
   network, no messages. The only things it changes are the student's own planner tasks, and only when they press Add,
   Move or Add a session. Creator: Flzsh. */
(function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null);
 const Plan=()=>load('ReservePlanner','./planner-model.js');
 const DAY=/^\d{4}-\d{2}-\d{2}$/,ZONE='America/New_York';
 // The rules' numbers. A day has room while its open work stays at most 150 minutes and 4 things (an open thing with no
 // length counts 30 minutes); "too much" is past 180 minutes or 5 things, so a plan never makes a day too much.
 const LIMITS=Object.freeze({tasks:8,perDay:2,dayMinutes:150,dayItems:4,heavyMinutes:180,heavyItems:5,unknown:30,lateHour:20,earlyDue:6,shortest:10,longest:120,title:80,week:7,shown:3});
 const LENGTHS=Object.freeze([10,15,20,25,30,45,60,90,120]);
 const PLAN_KINDS=Object.freeze(['study','test','steps','outline']);
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{},array=v=>Array.isArray(v)?v:[];
 const validDay=v=>typeof v==='string'&&DAY.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const addDays=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const between=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
 const round5=n=>Math.round(n/5)*5,clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 const sessionLength=n=>clamp(round5(Number.isFinite(n)?n:30),LIMITS.shortest,LIMITS.longest);

 // ---- the student's calendar ------------------------------------------------------------------------------------------
 const clocks=new Map();
 function clockOf(zone){
  const key=String(zone||ZONE);if(clocks.has(key))return clocks.get(key);
  let f;
  try{
    f=new Intl.DateTimeFormat('en-US',{timeZone:key,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }catch{f=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
  const read=at=>{const p={};for(const x of f.formatToParts(at))p[x.type]=x.value;return {day:`${p.year}-${p.month}-${p.day}`,minute:(p.hour==='24'?0:+p.hour)*60+ +p.minute};};
  clocks.set(key,read);return read;
 }
 const stamp=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&v.trim()&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
 // The day a deadline belongs to: its calendar day in the student's zone, except that a deadline in the small hours
 // (before 6 AM) is the night before ("due 12:00 AM Friday" is Thursday night's work).
 function deadlineDay(dueAt,zone){const at=stamp(dueAt);if(at===null)return '';const c=clockOf(zone)(at);return c.minute<LIMITS.earlyDue*60?addDays(c.day,-1):c.day;}
 const WEEKDAY=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'UTC'}),
   SHORT=new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}),
   DATE=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
 const noon=day=>Date.parse(day+'T12:00:00Z');
 function dayWord(day,today,{short=false}={}){
   if(!validDay(day))return '';
   if(day===today)return 'today';
   if(day===addDays(today,1))return 'tomorrow';
   const gap=between(today,day);
   return gap>0&&gap<7?(short?SHORT:WEEKDAY).format(noon(day)):DATE.format(noon(day));
 }
 const dateLabel=day=>validDay(day)?DATE.format(noon(day)):'';
 function minutesLabel(n){n=Math.round(n||0);if(!n)return '';if(n<60)return n+' min';return n%60?Math.floor(n/60)+' h '+n%60+' min':n/60+' h';}

 // ---- the integrity filter --------------------------------------------------------------------------------------------
 // A task's name takes at most a few words of the card: a topic, a step's action or a part's name. Everything that could
 // carry graded work is taken out first (maths, code, quotations, links, brackets), then the text is cut at the first
 // place where an action would turn into content (a colon, a dash, "=", an arrow, the end of a sentence, "that",
 // "saying", "because" ...). What is left must be words, few of them; a step must start with an action word. Otherwise
 // the task gets a plain name ("Step 3") the student can change.
 const VERBS=new Set(('add analyse analyze annotate answer apply arrange ask attach attend bring build calculate check choose circle cite '+
  'clean collect colour color compare compile complete compute confirm convert copy correct count create cross decide define derive '+
  'describe design discuss do download draft draw edit email estimate explain export fill find finish fix format gather get go graph '+
  'group hand highlight identify label learn list listen look make map mark match measure meet memorise memorize message note number '+
  'open order organise organize outline pack paste pick plan plot post practice practise prepare present preview print proofread prove '+
  'quiz re-read reread read record redo refine rehearse reply research respond review revise rewrite run save scan schedule search select '+
  'send set share sketch skim solve sort start study submit summarise summarize take talk test time trace translate try turn type '+
  'underline update upload use verify watch work write').split(' '));
 const LEAD=/^(?:(?:first|then|next|finally|now|also|and|step\s*\d+\s*[:.)-]?)\s+)+/i;
 // (a dash with spaces round it is a break; "10-15" and "3\u20135" are ranges and stay)
 // ("is", "are", "means" turn a topic into a statement of it: "Percent yield is 85%" keeps "Percent yield")
 const CUT=/\s*(?::|;|\u2014|\s[\u2013-]\s|=|\u2192|->|=>|[.?!](?:\s|$)|,\s*(?:e\.g\.|i\.e\.|such as|for example|like)\b|\s(?:that|saying|arguing|stating|because|which|where|so that|e\.g\.|i\.e\.|such as|for example|like this|as follows|is|are|was|were|equals|means)\b)/i;
 const TAIL=/(?:\s+(?:and|or|to|the|a|an|of|with|for|in|on|by|at|from|as|into|your|my|its|their|this|these|those))+$/i;
 const ANSWERISH=/\b(?:answers?|solutions?|results?)\s+(?:is|are|was|were|equals?)\b|\bthe\s+answer\b|\bthesis\s+is\b|\d\s*[+*/^\u00d7\u00f7]\s*\d|\d+(?:\.\d+)?\s*(?:%|percent\b)/i;
 const SCRIPTS=[['latin',/\p{Script=Latin}/u],['cyrillic',/\p{Script=Cyrillic}/u],['greek',/\p{Script=Greek}/u],['han',/\p{Script=Han}/u],['kana',/[\p{Script=Hiragana}\p{Script=Katakana}]/u],['hangul',/\p{Script=Hangul}/u],['arabic',/\p{Script=Arabic}/u],['hebrew',/\p{Script=Hebrew}/u],['devanagari',/\p{Script=Devanagari}/u],['thai',/\p{Script=Thai}/u]];
 const scriptsOf=text=>{const out=new Set();for(const ch of String(text||''))if(/\p{L}/u.test(ch)){const s=SCRIPTS.find(([,re])=>re.test(ch));out.add(s?s[0]:'other');}return out;};
 function stripped(text){
  return String(text??'').slice(0,2000)
   .replace(/\$\$[\s\S]*?\$\$/g,' ').replace(/\\\[[\s\S]*?\\\]/g,' ').replace(/\\\([\s\S]*?\\\)/g,' ').replace(/\$[^$\n]*\$/g,' ').replace(/\$/g,' ')
   .replace(/```[\s\S]*?(?:```|$)/g,' ').replace(/`[^`]*`/g,' ')
   .replace(/https?:\/\/\S+|www\.\S+/gi,' ')
   .replace(/[\u201c"\u00ab\u201e][^\u201d"\u00bb\u201c\u201e]*(?:[\u201d"\u00bb\u201c]|$)/g,' ').replace(/(^|[\s(])['\u2018][^'\u2019]{2,}(?:['\u2019](?=[\s.,;:!?)]|$)|$)/g,'$1 ')
   .replace(/\([^)]*(?:\)|$)/g,' ').replace(/\[[^\]]*(?:\]|$)/g,' ').replace(/\{[^}]*(?:\}|$)/g,' ').replace(/<[^>]*>/g,' ')
   .replace(/\*\*|__|[*_~#>|]/g,' ').replace(/^\s*(?:rule|check|watch|tip)\s*:\s*/i,'')
   .replace(/\\[a-z]+/gi,' ').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g,' ')
   .replace(/\s+/g,' ').trim();
 }
 function words(text,max){return text.split(' ').filter(Boolean).slice(0,max).join(' ');}
 // A few words of the card for a task's name, or '' when what is there is not safe or not a name.
 function cleanPart(text,{max=6,verb=false,reference='',leak=null}={}){
  let s=stripped(text).replace(LEAD,'');const cut=CUT.exec(s);if(cut)s=s.slice(0,cut.index);
  s=words(s,max).replace(/[\s,;:.!?\-\u2013\u2014'"]+$/,'').replace(TAIL,'').trim();
  if(!/\p{L}{2}/u.test(s)||s.length<2)return '';
  if(ANSWERISH.test(s))return '';
  // the wrong language: letters in a script that the course and the item are not written in
  const own=scriptsOf(reference+' a');for(const sc of scriptsOf(s))if(!own.has(sc))return '';
  if(verb&&!VERBS.has(s.split(' ')[0].toLowerCase().replace(/[^a-z-]/g,'')))return '';
  if(leak&&leaks(s,leak))return '';
  return s.length>48?s.slice(0,48).replace(/\s+\S*$/,''):s;
 }
 // The card's own answers, worked solutions, examples and drafted sentences: no run of four of their words may become a
 // name. (Per kind: a practice question and its answer and working; a step's worked example and its "done" line; an
 // outline's thesis question and its evidence examples; any answer, body or quote a reply carries where it should not.)
 const words4=t=>String(t||'').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(Boolean);
 function shingles(d){
  const out=new Set(),add=t=>{
    if(typeof t!=='string')return;
    const w=words4(t);
    for(let i=0;i+4<=w.length;i++)out.add(w.slice(i,i+4).join(' '));
  },each=(list,...keys)=>{for(const x of array(list).slice(0,80))for(const k of keys){const v=object(x)[k];if(Array.isArray(v))v.slice(0,20).forEach(add);else add(v);}};
  if(d.kind==='study')each(d.practice,'q','answer','why');
  if(d.kind==='test')each(d.questions,'q','answer','steps','choices');
  if(d.kind==='steps')each(d.steps,'example');
  if(d.kind==='outline'){add(d.thesis);each(d.sections,'example','purpose');}
  for(const k of ['answer','body','thesis','quote','yours','problem'])add(d[k]);
  return out;
 }
 function leaks(text,set){const w=words4(text);for(let i=0;i+4<=w.length;i++)if(set.has(w.slice(i,i+4).join(' ')))return true;return false;}
 const shortItem=title=>{const s=stripped(title).replace(/\s+/g,' ').trim();return s.length<=32?s:s.slice(0,32).replace(/\s+\S*$/,'')+'\u2026';};

 // ---- what a card's plan is made of -----------------------------------------------------------------------------------
 function holds(data){const d=object(data);return PLAN_KINDS.includes(d.kind)&&rawParts(d).length>0;}
 // The parts as the card gives them, before names and days: at most 60 are read (a plan of 40 sessions is a fault of
 // the reply, and is made into at most eight sessions below).
 function rawParts(d){
  if(d.kind==='study'){
    const sheet=array(d.sheet).filter(s=>s&&typeof s==='object').slice(0,60),practice=array(d.practice).filter(q=>q&&typeof q==='object');
    return [...sheet.map((s,i)=>({type:'learn',text:s.heading,n:i+1})),...(practice.length?[{type:'practice',count:practice.length}]:[])];
  }
  // a practice test: its questions in sittings of about three, as even as they go (7 questions: 3, 2, 2)
  if(d.kind==='test'){
    const qs=array(d.questions).filter(q=>q&&typeof q==='object').slice(0,60),groups=Math.ceil(qs.length/3),out=[];
    let at=0;
    for(let g=0;g<groups;g++){const size=Math.floor(qs.length/groups)+(g<qs.length%groups?1:0);out.push({type:'questions',from:at+1,to:at+size});at+=size;}
    return out;
  }
  if(d.kind==='steps')return array(d.steps).filter(s=>s&&typeof s==='object').slice(0,60).map((s,i)=>({type:'step',text:s.text,minutes:Number(s.minutes),due:typeof s.due==='string'?s.due:'',n:i+1}));
  if(d.kind==='outline')return array(d.sections).filter(s=>s&&typeof s==='object').slice(0,60).map((s,i)=>({type:'draft',text:s.part,words:Number(s.words),n:i+1}));
  return [];
 }
 // Sessions: a name, a length, and for a step with its own checkpoint, the day it must be done by.
 function sessionsOf(d,{item='',reference='',today='',dueDay=''}){
  const parts=rawParts(d),leak=shingles(d),total=Number(d.minutes),given=Number.isFinite(total)&&total>=5&&total<=600,notes=new Set(),out=[];
  const name=(lead,text,fallback,opts)=>{const c=cleanPart(text,{...opts,reference,leak});if(!c&&String(text??'').trim())notes.add('renamed');return c?lead+c:fallback;};
  if(d.kind==='study'){const learn=parts.filter(p=>p.type==='learn'),practice=parts.find(p=>p.type==='practice'),share=given?total*(practice?0.6:1)/Math.max(1,learn.length):20;
   for(const p of learn)out.push({title:name('Study: ',p.text,'Study part '+p.n,{max:6}),minutes:share});
   if(practice)out.push({title:'Practice: '+practice.count+' question'+(practice.count===1?'':'s'),minutes:given?total*(learn.length?0.4:1):25});}
  if(d.kind==='test'){const count=parts.length?parts[parts.length-1].to:0,each=given?total/Math.max(1,count):8;
   // (named by CH alone, by their numbers: the card shows what each question practises)
   for(const p of parts)out.push({title:'Practice test: question'+(p.from===p.to?' '+p.from:'s '+p.from+'\u2013'+p.to),minutes:each*(p.to-p.from+1)});}
  if(d.kind==='steps')for(const p of parts){const s={title:name('',p.text,'Step '+p.n,{max:8,verb:true}),minutes:Number.isFinite(p.minutes)&&p.minutes>0?p.minutes:20};
   // A checkpoint the step names ("due": as the teacher wrote it) is read by the planner's own reader; one after the
   // item's due date, or already gone, is not kept.
   if(p.due.trim()&&validDay(today)){
     const r=Plan()?.parseQuick?.(p.due,today)||{};
     if(validDay(r.day)){if(dueDay&&r.day>=dueDay)notes.add('after-due');else if(r.day<today)notes.add('past-step');else s.latest=r.day;}
   }
   out.push(s);}
  if(d.kind==='outline')for(const p of parts)out.push({title:name('Draft: ',p.text,'Draft part '+p.n,{max:6}),minutes:Number.isFinite(p.words)&&p.words>0?p.words/8:30});
  const tail=item?' \u00b7 '+shortItem(item):'';
  // A session longer than two hours is cut into parts of at most 90 minutes.
  const long=[];
  for(const s of out){
    const m=Math.round(s.minutes);
    if(m>LIMITS.longest){const n=Math.ceil(m/90);for(let i=1;i<=n;i++)long.push({...s,title:s.title+' (part '+i+' of '+n+')',minutes:m/n});notes.add('split');}else long.push(s);
  }
  return {sessions:long.map(s=>({...s,minutes:sessionLength(s.minutes),title:(s.title+tail).slice(0,LIMITS.title)})),notes,kind:d.kind};
 }
 // More sessions than the days can hold: neighbours are joined (in order) until there are `n`.
 function group(sessions,n){
  if(sessions.length<=n)return {list:sessions,merged:false};
  const out=[],size=sessions.length/n;
  for(let g=0;g<n;g++){const part=sessions.slice(Math.round(g*size),Math.round((g+1)*size));if(!part.length)continue;const first=part[0];
   const latest=part.map(s=>s.latest).filter(Boolean).sort()[0];
   // its name: the first one's and how many more ("Study: Topic 1 and 4 more"); plain steps keep their numbers ("Steps 4-6")
   const tail=first.title.includes(' \u00b7 ')?first.title.slice(first.title.indexOf(' \u00b7 ')):'',
     lead=first.title.replace(/ \u00b7 .*$/,''),
     plain=part.every(s=>/^Step \d+(?: \u00b7 |$)/.test(s.title));
   const named=part.length===1?first.title:plain?'Steps '+lead.slice(5)+'\u2013'+part[part.length-1].title.replace(/ \u00b7 .*$/,'').slice(5)+tail:lead+' and '+(part.length-1)+' more'+tail;
   out.push({title:named.slice(0,LIMITS.title),minutes:sessionLength(part.reduce((a,s)=>a+s.minutes,0)),...(latest?{latest}:{}),joined:part.length});}
  return {list:out,merged:true};
 }

 // ---- what is already planned ------------------------------------------------------------------------------------------
 // How full each day is, as the Planner shows it (work carried to today, repeats' coming days): open things and minutes.
 function loads(list,today,keys){
  const P=Plan(),out=new Map();for(const k of keys)out.set(k,{open:0,minutes:0});if(!keys.length||!P?.range)return out;
  const view=P.range(array(list),today,keys[0],keys.length);
  for(const d of view.days){
    const open=d.all.filter(e=>!e.done);
    out.set(d.key,{open:open.length,minutes:open.reduce((n,e)=>n+(e.estimate>0?e.estimate:LIMITS.unknown),0)});
  }
  return out;
 }
 const fits=(l,minutes)=>l.minutes+minutes<=LIMITS.dayMinutes&&l.open+1<=LIMITS.dayItems;
 // Days for the sessions, in order: each on a day with room, near its share of the window (a test's sessions spread
 // to end the day before; a homework's start now and leave the last day free), never before the session ahead of it,
 // never after its own checkpoint. A session with no day that has room gets no day.
 function schedule(sessions,{days,load,spread='end'}){
  const m=days.length,n=sessions.length,out=[];if(!m)return sessions.map(()=>'');
  const latest=sessions.map(s=>s.latest?(s.latest<days[0]?-1:Math.min(m-1,days.indexOf(s.latest)>=0?days.indexOf(s.latest):m-1)):m-1);
  for(let i=n-2;i>=0;i--)latest[i]=Math.min(latest[i],latest[i+1]);
  // the shares are taken over the days that have room at all, so a full Monday does not push a session off the end
  const free=[];for(let d=0;d<m;d++)if(fits(load.get(days[d]),LIMITS.shortest))free.push(d);if(!free.length)return sessions.map(()=>'');
  const f=free.length,target=i=>free[spread==='end'?Math.max(0,Math.round((i+1)*f/n)-1):Math.min(f-1,Math.floor(i*f/n))];
  const used=new Map();let prev=0;
  for(let i=0;i<n;i++){
   const s=sessions[i],lo=prev,hi=latest[i];let pick=-1;
   for(const cap of n<=f?[1,LIMITS.perDay]:[LIMITS.perDay]){let best=-1,gap=Infinity;const aim=clamp(target(i),lo,Math.max(lo,hi));
    for(let d=lo;d<=hi;d++){if((used.get(d)||0)>=cap||!fits(load.get(days[d]),s.minutes))continue;const g=Math.abs(d-aim);if(g<gap){best=d;gap=g;}}
    if(best>=0){pick=best;break;}}
   if(pick<0){out.push('');continue;}
   out.push(days[pick]);used.set(pick,(used.get(pick)||0)+1);const l=load.get(days[pick]);l.minutes+=s.minutes;l.open+=1;prev=pick;
  }
  return out;
 }

 // ---- a card's plan, shown before anything is added ------------------------------------------------------------------
 const NOTE_TEXT={
  'no-due':()=>'No due date: spread over the next week.',
  past:()=>'The due date has passed: pick days yourself.',
  'no-days':()=>'No day is left before it is due: pick days yourself.',
  today:()=>'Due today: only today is left.',
  tonight:()=>'Due tomorrow: only tonight is left.',
  late:()=>'Starts tomorrow: it is late today.',
  merged:(p)=>p.parts+' parts made into '+p.tasks.length+' sessions.',
  split:()=>'A long part was split into shorter sessions.',
  full:(p)=>{
    const n=p.tasks.filter(t=>!t.day).length;
    return 'No room for '+n+' session'+(n===1?'':'s')+(p.dueDay?' before '+dayWord(p.dueDay,p.today):'')+': pick a day or leave '+(n===1?'it':'them')+' without one.';
  },
  'after-due':(p)=>'A date in the plan was after the due date: '+(p.dueDay?'it is kept before '+dayWord(p.dueDay,p.today)+'.':'it was left out.'),
  'past-step':()=>'A date in the plan has passed: it was left out.',
  renamed:()=>'Some names were not usable and became plain ones: rename them if you like.'
 };
 // entry: {aid, data, key}; context: {list, today?, now, zone, dueAt?, courses?}.
 function propose(entry,{list=[],now=Date.now(),zone=ZONE,dueAt,courses}={}){
  const aid=object(entry?.aid),data=object(entry?.data);if(!holds(data))return {ok:false,reason:'no-plan'};
  const clock=clockOf(zone)(now),today=clock.day,P=Plan();if(!P)return {ok:false,reason:'no-planner'};
  // The window: from today (tomorrow after 8 PM) to the day before the deadline's day; with no due date, a week.
  const due=stamp(dueAt)??stamp(aid.dueAt)??stamp(data.dueAt)??null,dueDay=due===null?'':deadlineDay(due,zone),notes=new Set();
  let first=clock.minute>=LIMITS.lateHour*60?addDays(today,1):today,last='';
  if(!dueDay){last=addDays(first,LIMITS.week-1);notes.add('no-due');}
  else if(due<=now)notes.add('past');
  else{last=addDays(dueDay,-1);
   if(last<first){if(dueDay===today&&due-now>=60*60000){first=last=today;notes.add('today');}else if(last===today){first=today;notes.add('tonight');}else{last='';notes.add('no-days');}}}
  if(first!==today&&last)notes.add('late');
  const days=[];if(last&&first<=last)for(let d=first;d<=last&&days.length<60;d=addDays(d,1))days.push(d);
  // the language the names may be in: the item's (from Canvas) and its course's, else the card's own title
  const course=array(courses).find(c=>String(c?.id)===String(aid.courseId));
  const item=String(aid.item||'').trim()||String(data.title||'').trim(),reference=[aid.item,course?.name].filter(Boolean).join(' ')||String(data.title||'');
  const made=sessionsOf(data,{item,reference,today,dueDay:dueDay&&due>now?dueDay:''});for(const n of made.notes)notes.add(n);
  // at most eight sessions, and two a day on the days that have room
  const load=loads(list,today,days),usable=days.filter(d=>fits(load.get(d),LIMITS.shortest)).length;
  const cap=Math.max(1,Math.min(LIMITS.tasks,usable?LIMITS.perDay*usable:LIMITS.tasks)),grouped=group(made.sessions,cap);if(grouped.merged)notes.add('merged');
  const picked=schedule(grouped.list,{days,load,spread:['steps','outline'].includes(data.kind)?'start':'end'});
  const tasks=grouped.list.map((s,i)=>({n:i+1,title:s.title,minutes:s.minutes,day:picked[i]||''}));
  if(days.length&&tasks.some(t=>!t.day))notes.add('full');
  const courseId=/^\d+$/.test(String(aid.courseId||''))&&(!Array.isArray(courses)||courses.some(c=>String(c?.id)===String(aid.courseId)))?String(aid.courseId):'personal';
  const before={};for(const [k,v]of loads(list,today,days))before[k]={open:v.open,minutes:v.minutes,room:fits(v,LIMITS.shortest)};
  const out={
    ok:true,
    key:String(entry?.key||''),
    kind:data.kind,
    item,
    itemId:String(aid.itemId||''),
    courseId,
    today,
    first,
    last,
    dueDay:due!==null?dueDay:'',
    days,
    parts:made.sessions.length,
    tasks,
    before
  };
  out.notes=[...notes].filter(k=>NOTE_TEXT[k]).map(code=>({code,text:NOTE_TEXT[code](out)}));
  return out;
 }
 // The rows the student kept, made safe: their own words for a name (short, plain text), a length from the list, a day
 // that is a real day (or none).
 function rowsFrom(rows){
  return array(rows).slice(0,LIMITS.tasks*2).map(r=>
    ({
      title:String(r?.title??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,LIMITS.title),
      minutes:clamp(Math.round(Number(r?.minutes)||0),5,240),
      day:validDay(r?.day)?r.day:''
    })).filter(r=>
    r.title);
 }
 // Adding: each row becomes one of the student's own tasks (as if typed in the Planner), and the card remembers which,
 // so Undo takes back exactly those and the card says they are in the planner. Returns {change, ids}.
 function commit(proposal,rows,{ids=[],nowISO=new Date().toISOString(),zone=ZONE}={}){
  const P=Plan(),list=rowsFrom(rows),key=String(proposal?.key||'').slice(0,200),courseId=/^\d+$/.test(String(proposal?.courseId||''))?String(proposal.courseId):'personal';
  if(!P||!list.length)return {change:null,ids:[]};
  const made=list.map((_,i)=>ids[i]).filter(id=>/^local-[\w-]+$/.test(id||''));if(made.length!==list.length)throw Error('Each task needs its own id.');
  const change=data=>{data.customTasks||=[];data.tasks||={};
   if(data.customTasks.length+list.length>1000)throw Error('The planner is full (1,000 tasks). Remove some first.');
   list.forEach((r,i)=>{P.addTask({name:r.title,day:r.day,estimate:r.minutes},{courseId,id:made[i],nowISO,zone})(data);});
   const hp=helpPlan(data);if(key)hp.cards[key]={ids:made,itemId:String(proposal?.itemId||'').slice(0,100),at:nowISO};trimCards(hp);};
  return {change,ids:made};
 }
 // Undo: the tasks this add made, still there and not done, are taken out; a task already ticked done stays (the work
 // was done). Anything the student changed since keeps its change. Returns {change, result:{removed, kept}}.
 function undo(receipt){
  const ids=array(receipt?.ids).filter(id=>/^local-[\w-]+$/.test(id||'')),key=String(receipt?.key||''),result={removed:0,kept:0};
  const change=data=>{result.removed=0;result.kept=0;data.customTasks||=[];data.tasks||={};const gone=new Set();
   for(const id of ids){
     if(!data.customTasks.some(t=>t?.id===id))continue;
     const r=data.tasks[id];
     if(r&&(r.checkedOff===true||r.progress==='done')){result.kept++;continue;}
     gone.add(id);
   }
   data.customTasks=data.customTasks.filter(t=>!gone.has(t?.id));for(const id of gone)delete data.tasks[id];result.removed=gone.size;
   const hp=data.toolbox?.helpPlan;
   if(key&&hp?.cards?.[key]){
     const left=array(hp.cards[key].ids).filter(id=>!gone.has(id)&&data.customTasks.some(t=>t?.id===id));
     if(left.length)hp.cards[key]={...hp.cards[key],ids:left};else delete hp.cards[key];
   }
  };
  return {change,result};
 }
 // Which of a card's added tasks are still in the planner.
 function placed(toolbox,personalTasks,key){
   const ids=array(object(object(object(toolbox).helpPlan).cards)[key]?.ids),have=new Set(array(personalTasks).map(t=>t?.id));
   return ids.filter(id=>have.has(id));
 }
 function helpPlan(data){
   data.toolbox={...object(data.toolbox)};
   const hp={v:1,...object(data.toolbox.helpPlan)};
   hp.cards={...object(hp.cards)};
   hp.dismissed={...object(hp.dismissed)};
   data.toolbox.helpPlan=hp;
   return hp;
 }
 function trimCards(hp){
   const keys=Object.keys(hp.cards);
   if(keys.length<=60)return;
   keys.sort((a,b)=>String(hp.cards[a]?.at||'').localeCompare(String(hp.cards[b]?.at||'')));
   for(const k of keys.slice(0,keys.length-60))delete hp.cards[k];
 }

 // ---- the check of the week ------------------------------------------------------------------------------------------
 // The least loaded day in [from, to] (its minutes, 20 a thing, 5 a day away from `prefer`), full or not: the one rule
 // "Your week" and the Planner's To plan column both choose a day by.
 function leastDay(load,keys,from,to,prefer){
   let best='',score=Infinity;
   for(const k of keys){const l=load.get(k);if(k<from||k>to||!l)continue;const s=l.minutes+l.open*20+(prefer?Math.abs(between(k,prefer))*5:0);if(s<score){best=k;score=s;}}
   return best;
 }
 // The day the Planner would choose for each piece of work with no day (4.2.12, To plan): the least loaded of the coming
 // seven days before its deadline (today when the deadline is today or gone), nearest today on a tie. Asked for several
 // (in the order given), each choice counts in the next one's load, so they spread instead of all landing on one day.
 // Returns {id: day}; work done, unknown or with no day possible has none.
 function suggest(list,{now=Date.now(),zone=ZONE,ids=[]}={}){
  const P=Plan();if(!P?.range)return {};
  const today=clockOf(zone)(now).day,keys=Array.from({length:LIMITS.week},(_,i)=>addDays(today,i)),view=P.range(array(list),today,today,LIMITS.week),load=new Map();
  for(const d of view.days){
    const open=d.all.filter(e=>!e.done);
    load.set(d.key,{open:open.length,minutes:open.reduce((n,e)=>n+(e.estimate>0?e.estimate:LIMITS.unknown),0)});
  }
  const byId=new Map(array(list).map(e=>[String(e?.id),e])),out={};
  for(const raw of array(ids)){const id=String(raw),e=byId.get(id);if(!e||e.done||out[id])continue;
   const due=e.dueDay?(deadlineDay(e.dueAt,zone)||e.dueDay):'';let to=keys[keys.length-1];if(due){const before=addDays(due,-1);to=before<today?today:before<to?before:to;}
   const day=leastDay(load,keys,today,to,today);if(!day)continue;out[id]=day;const l=load.get(day);l.open+=1;l.minutes+=e.estimate>0?e.estimate:LIMITS.unknown;}
  return out;
 }
 const TEST=/\b(?:tests?|quiz(?:zes)?|exams?|midterms?|finals?)\b/i,BIG=/\b(?:essays?|papers?|projects?|reports?|presentations?|portfolios?|research)\b/i,STUDY=/\b(?:stud(?:y|ying)|review|practi[cs]e|prep(?:are)?|revis(?:e|ion)|flash ?cards?|quiz yourself)\b/i;
 const isTest=(e,item)=>TEST.test(String(e.title||''))||array(item?.submissionTypes).some(t=>/quiz/i.test(String(t)));
 // list: the planner's entries; items: the Canvas items (for how each is handed in); dismissed: {key: day}.
 function weekCheck(list,{now=Date.now(),zone=ZONE,items=[],toolbox={}}={}){
  const P=Plan();if(!P?.range)return [];
  const today=clockOf(zone)(now).day,keys=Array.from({length:LIMITS.week},(_,i)=>addDays(today,i)),view=P.range(array(list),today,today,LIMITS.week);
  const byId=new Map(array(items).map(i=>[String(i?.id),i])),
    hp=object(object(toolbox).helpPlan),
    dismissed=object(hp.dismissed),
    cards=object(hp.cards),
    load=new Map();
  /* (4.2.13) overdue work is no longer poured into today (the Planner keeps it in its own folded list), so it is not today's load either */
  for(const d of view.days){
    const late=new Set(array(d.carried).map(e=>e.id)),open=d.all.filter(e=>!e.done&&!late.has(e.id));
    load.set(d.key,{open:open.length,minutes:open.reduce((n,e)=>n+(e.estimate>0?e.estimate:LIMITS.unknown),0),entries:open});
  }
  const roomy=(day,minutes,except)=>{const l=load.get(day);return !!l&&day!==except&&fits(l,minutes);};
  // the lightest day with room in [from, to]: near `prefer`; with `later`, a day after it before a day ahead of it (work
  // moved off a full day goes to a later day while its due date allows, to an earlier one only when it must)
  const lightest=(from,to,minutes,except,prefer,later=false)=>{
    let best='',score=Infinity;
    for(const k of keys){
      if(k<from||k>to||!roomy(k,minutes,except))continue;
      const l=load.get(k),s=l.minutes+l.open*20+(prefer?Math.abs(between(k,prefer))*5:0)+(later&&prefer&&k<prefer?400:0);
      if(s<score){best=k;score=s;}
    }
    return best;
  };
  // No day with room before a test or a due date: the least loaded day there all the same, marked full (owner, 2026-11-23: a
  // finding that offers only Dismiss helps nobody). If the day is then too much, "Too much ..." says so and offers what can
  // move off it. "Put it in my planner" is unchanged: a plan still puts nothing on a full day.
  const least=(from,to,prefer)=>leastDay(load,keys,from,to,prefer);
  const findings=[],word=d=>dayWord(d,today),on=d=>{const w=word(d);return w==='today'||w==='tomorrow'?w:'on '+w;},title=e=>shortItem(e.title||'');
  // 1. a test or quiz in the coming week with nothing planned for it before its day
  for(const e of list){
   if(e.done||e.personal||!e.dueDay||!isTest(e,byId.get(e.id)))continue;
   const day=deadlineDay(e.dueAt,zone)||e.dueDay;
   if(day<=today||day>keys[keys.length-1])continue;
   const tracked=new Set(Object.values(cards).filter(c=>String(c?.itemId)===String(e.id)).flatMap(c=>array(c.ids)));
   const words=String(e.title||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2&&!TEST.test(w));
   // studying counts when it is planned before the day (this past week included: carried or already done)
   const studied=e.planned&&e.planned<day||
     list.some(x=>
       x.personal&&
         x.planned&&
         x.planned>=addDays(today,-7)&&
         x.planned<day&&
         (tracked.has(x.id)||(String(x.courseId)===String(e.courseId)||words.some(w=>String(x.title||'').toLowerCase().includes(w)))&&STUDY.test(String(x.title||''))));
   if(studied)continue;
   const key='prep:'+e.id+':'+day;if(dismissed[key])continue;
   const room=lightest(today,addDays(day,-1),30,'',addDays(day,-1)),at=room||least(today,addDays(day,-1),addDays(day,-1));
   findings.push({
     key,
     kind:'prep',
     rank:0,
     day,
     itemId:e.id,
     text:'Nothing planned for '+title(e)+' '+on(day)+'.',
     action:at?
       {
         ...(room?{}:{full:true}),
         type:'add',
         label:'Add a session '+(at===today?'today':at===addDays(today,1)?'tomorrow':'on '+SHORT.format(noon(at))),
         day:at,
         title:('Study for '+String(e.title||'the test')).slice(0,LIMITS.title),
         minutes:30,
         courseId:/^\d+$/.test(String(e.courseId))?String(e.courseId):'personal'
       }:
       null
   });
  }
  // 2. a day with too much on it: one thing that can go to a lighter day before it is due
  // (a session CH added for a test or for due work goes no later than the day before it: studying moved to the test's
  // own day or past it would be no studying)
  const before=new Map();
  for(const c of Object.values(cards)){
    const it=c?.itemId!=null?list.find(x=>String(x.id)===String(c.itemId)):null,d=it&&(deadlineDay(it.dueAt,zone)||it.dueDay);
    if(d)for(const id of array(c.ids))before.set(String(id),addDays(d,-1));
  }
  for(const k of keys){const l=load.get(k);if(!(l.minutes>LIMITS.heavyMinutes||l.open>=LIMITS.heavyItems))continue;const key='heavy:'+k;if(dismissed[key])continue;
   let move=null;
   for(const e of [...l.entries].filter(x=>!x.echo&&!isTest(x,byId.get(x.id))).sort((a,b)=>
     (b.dueDay||'9999').localeCompare(a.dueDay||'9999')||(b.estimate||LIMITS.unknown)-(a.estimate||LIMITS.unknown))){
    const len=e.estimate>0?e.estimate:LIMITS.unknown,
      until=e.dueDay?(deadlineDay(e.dueAt,zone)||e.dueDay):(before.get(String(e.id))||keys[keys.length-1]),
      to=lightest(today,until<keys[keys.length-1]?until:keys[keys.length-1],len,k,k,true);
    if(to){move={type:'move',id:e.id,day:to,from:k,label:'Move '+title(e)+' to '+(to===today?'today':to===addDays(today,1)?'tomorrow':SHORT.format(noon(to)))};break;}}
   findings.push({key,kind:'heavy',rank:1,day:k,text:'Too much '+on(k)+': '+l.open+' thing'+(l.open===1?'':'s')+(l.minutes?', '+minutesLabel(l.minutes):'')+'.',action:move});
  }
  // 3. big work due in the next three days with no day to do it
  for(const e of list){
   if(e.done||e.personal||e.planned||!e.dueDay||isTest(e,byId.get(e.id)))continue;const day=deadlineDay(e.dueAt,zone)||e.dueDay;
   if(day<=today||between(today,day)>3||!(BIG.test(String(e.title||''))||Number(e.points)>=50))continue;const key='soon:'+e.id+':'+day;if(dismissed[key])continue;
   const len=e.estimate>0?e.estimate:60,room=lightest(today,addDays(day,-1),len,'',today),at=room||least(today,addDays(day,-1),today);
   findings.push({
     key,
     kind:'soon',
     rank:2,
     day,
     itemId:e.id,
     text:title(e)+' is due '+word(day)+' with no day to work on it.',
     action:at?{...(room?{}:{full:true}),type:'move',id:e.id,day:at,from:'',label:'Plan it for '+(at===today?'today':at===addDays(today,1)?'tomorrow':SHORT.format(noon(at)))}:null
   });
  }
  // what a done action says ("Moved Lab report to Tue.")
  for(const f of findings)if(f.action)f.action.done=f.action.label.replace(/^Add a session/,'Added a session').replace(/^Move /,'Moved ').replace(/^Plan it for /,'Planned for ')+'.';
  return findings.sort((a,b)=>a.day.localeCompare(b.day)||a.rank-b.rank);
 }
 // A finding's action as a change to the saved data, with its exact undo. Returns {change, undo, message}.
 function act(finding,{now=Date.now(),zone=ZONE,id}={}){
  const P=Plan(),a=object(finding?.action),today=clockOf(zone)(now).day;
  if(a.type==='move'&&typeof a.id==='string'&&validDay(a.day)){
   let before=null;
   const change=data=>{
     data.tasks||={};
     const r=data.tasks[a.id];
     before=r?{had:true,plannedDate:r.plannedDate||'',...(Object.hasOwn(r,'plannedTime')?{plannedTime:r.plannedTime}:{})}:{had:false};
     P.plan(a.id,a.day)(data);
   };
   const back=data=>{
     const r=data.tasks?.[a.id];
     if(!r||r.plannedDate!==a.day||!before)return;
     if(!before.had){delete data.tasks[a.id];return;}
     r.plannedDate=before.plannedDate;
     if(Object.hasOwn(before,'plannedTime'))r.plannedTime=before.plannedTime;else delete r.plannedTime;
   };
   return {change,undo:back,message:'Moved to '+dayWord(a.day,today)+'.'};
  }
  if(a.type==='add'&&validDay(a.day)&&/^local-[\w-]+$/.test(id||'')){
   const title=String(a.title||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,LIMITS.title)||'Study session',courseId=/^\d+$/.test(String(a.courseId))?String(a.courseId):'personal';
   const change=data=>{
     data.customTasks||=[];
     data.tasks||={};
     if(data.customTasks.length>=1000)throw Error('The planner is full (1,000 tasks).');
     P.addTask({name:title,day:a.day,estimate:clamp(Number(a.minutes)||30,10,120)},{courseId,id,nowISO:new Date(now).toISOString(),zone})(data);
     const hp=helpPlan(data);
     if(finding.itemId)hp.cards['week:'+finding.key]={ids:[id],itemId:String(finding.itemId),at:new Date(now).toISOString()};
     trimCards(hp);
   };
   return {change,undo:undo({ids:[id],key:'week:'+finding.key}).change,message:'Added for '+dayWord(a.day,today)+'.'};
  }
  return {change:null,undo:null,message:''};
 }
 // Dismiss: the finding stays away (for its day; a test or due work comes back if its date changes). Old marks go.
 function dismiss(finding,{now=Date.now(),zone=ZONE}={}){
  const key=String(finding?.key||'').slice(0,160),today=clockOf(zone)(now).day;if(!key)return {change:null,undo:null};
  const change=data=>{
    const hp=helpPlan(data);
    hp.dismissed[key]=today;
    for(const [k,v]of Object.entries(hp.dismissed))if(!validDay(v)||between(v,today)>21)delete hp.dismissed[k];
  };
  const back=data=>{const d=data.toolbox?.helpPlan?.dismissed;if(d&&d[key]){delete d[key];}};
  return {change,undo:back};
 }

 // ---- one object for a page that has the student's data: the dashboard gives it how to read and save ------------------
 // read(): {list, items, toolbox, customTasks, courses, now, zone}; save(change) -> Promise<boolean>; newId() -> 'local-\u2026'.
 function bridge({read,save,newId}){
  const ok=()=>typeof read==='function'&&typeof save==='function'&&!!Plan();
  const id=()=>{
    const v=typeof newId==='function'?newId():'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
    return /^local-[\w-]+$/.test(v)?v:'local-'+Math.random().toString(36).slice(2,12);
  };
  return {
   holds,
   placed(key){if(!ok())return [];const r=read();return placed(r.toolbox,r.customTasks,key);},
   propose(entry){if(!ok())return {ok:false,reason:'no-planner'};const r=read();return propose(entry,{list:r.list,now:r.now,zone:r.zone,courses:r.courses,dueAt:entry?.dueAt});},
   async add(proposal,rows){if(!ok())return {ok:false,message:'The planner is not on.'};const list=rowsFrom(rows);if(!list.length)return {ok:false,message:'Nothing to add.'};
    const {change,ids}=commit(proposal,list,{ids:list.map(()=>id()),nowISO:new Date().toISOString(),zone:read().zone});
    let saved=false;
    try{saved=await save(change);}catch(error){return {ok:false,message:String(error?.message||error)};}
    return saved===false?{ok:false,message:'Not saved. Try again.'}:{ok:true,ids,key:proposal.key,message:'Added '+ids.length+' to your planner.'};},
   async undo(receipt){
     if(!ok())return {ok:false};
     const u=undo(receipt);
     const saved=await save(u.change);
     return saved===false?{ok:false,message:'Not saved. Try again.'}:{ok:true,...u.result,message:u.result.kept?'Taken out; '+u.result.kept+' already done stayed.':'Taken out of your planner.'};
   },
   findings(){if(!ok())return [];const r=read();return weekCheck(r.list,{now:r.now,zone:r.zone,items:r.items,toolbox:r.toolbox});},
   async act(finding){
     if(!ok())return {ok:false};
     const r=read(),a=act(finding,{now:r.now,zone:r.zone,id:id()});
     if(!a.change)return {ok:false,message:'That cannot be done now.'};
     const saved=await save(a.change);
     return saved===false?{ok:false,message:'Not saved. Try again.'}:{ok:true,message:a.message,undo:async()=>save(a.undo)};
   },
   async dismiss(finding){
     if(!ok())return {ok:false};
     const r=read(),d=dismiss(finding,{now:r.now,zone:r.zone});
     if(!d.change)return {ok:false};
     const saved=await save(d.change);
     return saved===false?{ok:false}:{ok:true,undo:async()=>save(d.undo)};
   }
  };
 }
 const api={
   LIMITS,
   LENGTHS,
   PLAN_KINDS,
   holds,
   cleanPart,
   stripped,
   deadlineDay,
   dayWord,
   dateLabel,
   minutesLabel,
   sessionsOf,
   group,
   loads,
   schedule,
   propose,
   rowsFrom,
   commit,
   undo,
   placed,
   weekCheck,
   suggest,
   act,
   dismiss,
   bridge
 };
 root.ReserveHelpPlan=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
