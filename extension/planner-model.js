/* Canvas Harness planner: the rules, with no drawing in them. A plan is a day chosen for a piece of work: Canvas
   assignments and the student's own tasks alike. Nothing here reads or changes Canvas, and nothing here asks any
   server: reading a quick add is local and the same words always read the same way. Creator: Flzsh. */
(function(root){
 'use strict';
 const DAY=/^\d{4}-\d{2}-\d{2}$/,TIME=/^([01]\d|2[0-3]):[0-5]\d$/,WEEKDAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const pad=n=>String(n).padStart(2,'0');
 const addDays=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const weekdayOf=day=>new Date(day+'T12:00:00Z').getUTCDay();
 const mondayOf=day=>addDays(day,-((weekdayOf(day)+6)%7));
 const week=(day,offset=0)=>{const start=addDays(mondayOf(day),offset*7);return Array.from({length:7},(_,i)=>addDays(start,i));};
 const between=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
 const minutes=n=>!n?'':n<60?`${n} min`:n%60?`${Math.floor(n/60)} h ${n%60} min`:`${n/60} h`;
 const validDay=v=>typeof v==='string'&&DAY.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const ymd=(y,m,d)=>{const k=`${String(y).padStart(4,'0')}-${pad(m)}-${pad(d)}`;return Number.isFinite(Date.parse(k+'T00:00:00Z'))&&new Date(k+'T00:00:00Z').toISOString().slice(0,10)===k?k:'';};
 const hhmm=n=>`${pad(Math.floor(n/60))}:${pad(n%60)}`;

 // ---- repeating tasks: {every:'day'|'week'|'weekdays'|'month', interval, days:[0-6]} (days only for 'week')
 function cleanRepeat(r){
  if(!r||typeof r!=='object'||Array.isArray(r)||!['day','week','weekdays','month'].includes(r.every))return null;
  const interval=Number.isInteger(r.interval)&&r.interval>=1&&r.interval<=12?r.interval:1;
  if(r.every!=='week')return {every:r.every,interval:r.every==='weekdays'?1:interval};
  const days=[...new Set((Array.isArray(r.days)?r.days:[]).filter(d=>Number.isInteger(d)&&d>=0&&d<=6))].sort((a,b)=>a-b);
  return days.length?{every:'week',interval,days}:null;
 }
 const repeatKey=r=>!r?'':r.every==='weekdays'?'weekdays':r.every+(r.interval>1?'/'+r.interval:'')+(r.every==='week'?':'+r.days.join(','):'');
 // Does `day` fall on the series that began at `anchor`?
 function onRepeat(r,anchor,day){
  if(!r||day<anchor)return false;const gap=between(anchor,day),wd=weekdayOf(day);
  if(r.every==='day')return gap%r.interval===0;
  if(r.every==='weekdays')return wd>0&&wd<6;
  if(r.every==='week')return r.days.includes(wd)&&Math.floor(between(mondayOf(anchor),day)/7)%r.interval===0;
  if(r.every==='month'){
    const a=+anchor.slice(8),d=+day.slice(8),last=+addDays(addDays(day.slice(0,8)+'01',32).slice(0,8)+'01',-1).slice(8);
    const months=(+day.slice(0,4)-+anchor.slice(0,4))*12+(+day.slice(5,7)-+anchor.slice(5,7));
    return months%r.interval===0&&(d===a||a>last&&d===last);
  }
  return false;
 }
 // The first day on or after `from` that the series lands on (the anchor is where it was counted from).
 function nextOn(r,from,anchor=from){if(!r)return '';for(let i=0,d=from<anchor?anchor:from;i<800;i++,d=addDays(d,1))if(onRepeat(r,anchor,d))return d;return '';}
 // Where a task's series counts from: the day it began (the record's repeatFrom), so a monthly task on the 31st keeps
 // the 31st through short months (Jan 31, Feb 28, Mar 31, Apr 30). It holds while the planned day is still one of its
 // days; a task moved off its series starts a new one where it was put. A series saved before repeatFrom was kept counts
 // from the earliest day of its log that the planned day still follows, else from the planned day, as it always did.
 // (Only a monthly series can tell these apart: any day of a daily or weekly series gives the same next days.)
 function anchorOf(r,rec,planned){
  if(!r||!DAY.test(planned||''))return planned||'';
  const fits=day=>validDay(day)&&day<=planned&&onRepeat(r,day,planned);
  if(rec?.repeatFrom!==undefined)return fits(rec.repeatFrom)?rec.repeatFrom:planned;
  const logged=(Array.isArray(rec?.repeatLog)?rec.repeatLog:[]).map(x=>x?.day).filter(fits).sort();
  return logged[0]||planned;
 }
 // `day` moved by whole months, on the last day of a shorter month (Jan 31 + 1 = Feb 28).
 function addMonths(day,n){
  const months=+day.slice(0,4)*12+(+day.slice(5,7)-1)+n,y=Math.floor(months/12),m=months-y*12+1;
  return ymd(y,m,Math.min(+day.slice(8,10),new Date(Date.UTC(y,m,0)).getUTCDate()));
 }
 const WD_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
 function repeatLabel(r){
  if(!r)return '';if(r.every==='weekdays')return 'Every weekday';
  if(r.every==='day')return r.interval===1?'Every day':r.interval===2?'Every other day':`Every ${r.interval} days`;
  if(r.every==='month')return r.interval===1?'Every month':`Every ${r.interval} months`;
  const days=r.days.join(',')==='0,6'?'weekend':r.days.join(',')==='1,2,3,4,5'?'weekday':r.days.map(d=>WD_SHORT[d]).join(', ');
  return (r.interval===1?'Every ':r.interval===2?'Every other ':`Every ${r.interval} weeks, `)+days;
 }

 // ---- reading a quick add ------------------------------------------------------------------------------------------
 // "essay due fri 5pm 45m #english" -> a name, a day, a time, a length, a course, whether the day is a deadline, a repeat
 // and a priority. Words that are not recognised stay in the name, so nothing the student typed is lost. Typos of the
 // date words are read as what they meant; a word that only looks like a date ("May" alone, "SAT", "sat prep", "2 pages")
 // is left alone. `spans` say which typed characters were read as what, for the "understood as" line.
 const ALIAS={
   tmr:'tomorrow',
   tmrw:'tomorrow',
   tmw:'tomorrow',
   tomo:'tomorrow',
   tmrrw:'tomorrow',
   tmmrw:'tomorrow',
   tomm:'tomorrow',
   '2morrow':'tomorrow',
   '2moro':'tomorrow',
   '2mrw':'tomorrow',
   '2morow':'tomorrow',
   tonite:'tonight',
   tnite:'tonight',
   '2nite':'tonight',
   tdy:'today',
   nxt:'next',
   wknd:'weekend',
   wkend:'weekend',
   tmrws:'tomorrow',
   '2day':'today',
   wk:'week',
   wks:'weeks',
   nite:'night',
   hr:'hour',
   hrs:'hours'
 };
 const FUZZ=[...WEEKDAYS,'tomorrow','tonight','today','weekend'],
   KNOWN=new Set([...FUZZ,...WEEKDAYS.map(w=>w+'s'),'weekends','weekday','weekdays',...MONTHS]),
   NO_FUZZ=new Set(['sundry','frida','toady','toddy','sundae','mondo','satay','monday']);
 function distance(a,b){
   if(Math.abs(a.length-b.length)>2)return 9;
   const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);
   for(let j=1;j<=b.length;j++)d[0][j]=j;
   for(let i=1;i<=a.length;i++)
     for(let j=1;j<=b.length;j++){
       const c=a[i-1]===b[j-1]?0:1;
       d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);
       if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
     }
   return d[a.length][b.length];
 }
 function canon(word){
  if(word==='SAT')return 'satexam';   // the exam, never Saturday
  let w=word.toLowerCase().replace(/[’]/g,"'");const base=w.replace(/'s$/,'');if(base!==w&&(KNOWN.has(base)||ALIAS[base]))w=base;
  if(ALIAS[w])return ALIAS[w];if(KNOWN.has(w)||w.length<5||/[^a-z]/.test(w)||NO_FUZZ.has(w))return w;
  let best='',score=9,tie=false;
  for(const t of FUZZ){
    if(t[0]!==w[0])continue;
    const n=distance(w,t),limit=Math.max(w.length,t.length)>=8?2:1;
    if(n>limit)continue;
    if(n<score){best=t;score=n;tie=false;}else if(n===score)tie=true;
  }
  return best&&!tie?best:w;
 }
 function normalize(src){
   let text='',start=[],end=[],at=0;
   for(const m of src.matchAll(/[\p{L}\p{N}]+(?:['’]\p{L}+)?/gu)){
     for(let i=at;i<m.index;i++){text+=src[i].toLowerCase();start.push(i);end.push(i+1);}
     const w=canon(m[0]);
     text+=w;
     for(let i=0;i<w.length;i++){start.push(m.index);end.push(m.index+m[0].length);}
     at=m.index+m[0].length;
   }
   for(let i=at;i<src.length;i++){text+=src[i].toLowerCase();start.push(i);end.push(i+1);}
   return {text,start,end};
 }
 const B='(?<![\\p{L}\\p{N}])',Z='(?![\\p{L}\\p{N}])',rx=s=>new RegExp(s.replace(/\\</g,B).replace(/\\>/g,Z),'giu');
 const WD='(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)',WDS='(sundays|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays)',MON='(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)',PART='(morning|afternoon|evening|night)';
 const NUMW={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,couple:2,'couple of':2,few:3};
 const PART_AT={morning:450,afternoon:900,evening:1140,night:1200,tonight:1200};   // the same hours Biscuit reads
 const wdIndex=w=>{w=w.toLowerCase();const i=WEEKDAYS.indexOf(w);return i>=0?i:WEEKDAYS.findIndex(x=>x.startsWith(w.slice(0,3)));};
 const monIndex=w=>MONTHS.findIndex(x=>x.startsWith(w.toLowerCase().slice(0,3)));
 const num=v=>/^\d/.test(v)?parseFloat(v):NUMW[String(v).toLowerCase().replace(/\s+/g,' ')]??NaN;
 const SUBJECTS=[
   ['math','maths','mathematics','calc','calculus','algebra','geometry','precalc','precalculus','trig','trigonometry','stats','statistics','multivariable'],
   ['chem','chemistry'],
   ['bio','biology','synbio','biotech'],
   ['phys','physics'],
   ['eng','english','lit','literature','writing','composition'],
   ['hist','history','apush','ush'],
   ['span','spanish','espanol'],
   ['french'],
   ['latin','lat'],
   ['chinese','mandarin'],
   ['cs','compsci','programming','coding'],
   ['econ','economics','macro','micro'],
   ['psych','psychology'],
   ['gov','government','civics'],
   ['art','arts','drawing','painting'],
   ['music','orchestra','choir'],
   ['engr','engineering'],
   ['ethics','philosophy','phil']
 ];
 const COURSE_STOP=new Set(['cl','ap','ib','honors','hon','sem','semester','section','sec','the','of','and','in','to','for','intro','introduction','advanced','adv','period','per','block','fall','spring','us','i','ii','iii','iv','a','b','c','h','level']);
 const plain=w=>String(w||'').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');   // "español" -> "espanol"
 const courseWords=c=>{
   const out=new Set();
   for(const v of [c.shortName,c.name,c.code,c.courseCode,c.course_code])for(const w of plain(v).split(/[^\p{L}\p{N}]+/u))if(w&&!COURSE_STOP.has(w)&&!/^\d{1,2}$/.test(w))out.add(w);
   return out;
 };
 // The course a word means, from the student's own list: a word of the course's name or code, then the same subject
 // ("calc" for Multivariable Calculus), then the start of a word. Two courses equally good: none (the student picks).
 function courseFor(words,courses){
  if(!Array.isArray(courses)||!courses.length)return null;let best=null,top=0,tie=false;words=words.map(plain);
  for(const c of courses){const own=courseWords(c);let score=0;for(const w of words){if(!w||w.length<2&&w!=='cs')continue;
   if(own.has(w))
     score=Math.max(score,3);
   else if(SUBJECTS.some(f=>f.includes(w)&&f.some(x=>own.has(x))))
     score=Math.max(score,2);
   else if(w.length>=4&&[...own].some(x=>x.length>=4&&x.startsWith(w)))score=Math.max(score,1);}
   if(score>top){best=c;top=score;tie=false;}else if(score&&score===top&&c!==best)tie=true;}
  return top&&!tie?best:null;
 }
 // Which course a "#hint" means.
 function matchCourse(hint,courses){if(!hint)return null;return courseFor([String(hint).toLowerCase()],courses||[]);}
 // Words that are not a plan: a greeting or thanks on its own, a question ("what's due", "is the test on fri", "do i have
 // anything tmrw?"), a request to be shown something. These are left alone (no task); the "Not a task" tag takes it back.
 const SOCIAL=new Set('hi hii hiii hey heyy heya hello helo yo sup wassup whatsup hiya howdy thanks thank thx ty tysm tyvm ok okay okk k kk cool nice great awesome lol lmao lmfao haha hahaha hehe bye goodbye cya gn gm hmm hmmm hm idk nvm yes yeah yea yep yup no nope nah help sorry oops wow'.split(' ')),SOCIAL_TOO=new Set('you u so much very there biscuit planner again all guys good morning night'.split(' '));
 const ASK=new Set(["what","what's","whats","when","when's","whens","where","where's","which","who","who's","whos","why","how","how's","hows"]),
   ASK_BE=new Set(['is','are','am','was','were','isnt',"isn't",'arent',"aren't"]),
   ASK_AUX=new Set(['do','does','did','can','could','should','would','will','shall','have','has','had','may','might','must','am']);
 function notPlan(src){
  const words=src.toLowerCase().replace(/[’]/g,"'").match(/[\p{L}\p{N}]+(?:'\p{L}+)?/gu)||[];
  if(!words.length)return true;                                   // "?", "...", an emoji alone
  if(words.every(w=>SOCIAL.has(w)||SOCIAL_TOO.has(w))&&words.some(w=>SOCIAL.has(w)||w==='good'))return true;
  const [a,b]=words;
  if(ASK.has(a)&&b!=='to'&&b!=='if')return true;                  // "how to …", "what if …" can be a title
  if(ASK_BE.has(a)&&words.length>1)return true;
  if(ASK_AUX.has(a)&&(b==='i'||b==='we'))return true;               // "do i have …", not "do my hw"
  if(/^(?:show|list|tell)\s+(?:me|my|all)\b/.test(words.join(' ')))return true;
  return false;
 }

 function parseQuick(text,today,opts={}){
  const src=String(text||'').replace(/\s+/g,' ').trim().slice(0,400),
    skip=new Set(Array.isArray(opts.ignore)?opts.ignore:[]),
    courses=Array.isArray(opts.courses)?opts.courses:null,
    now=Number.isFinite(opts.now)?opts.now:null,
    home=DAY.test(opts.day||'')?opts.day:'';
  const out={name:'',day:'',estimate:0,course:'',courseId:'',at:'',due:false,repeat:null,priority:'',spans:[]};
  if(!src)return out;
  if(!skip.has('notask')&&notPlan(src)){out.notTask=true;out.spans=[{kind:'notask',start:0,end:src.length}];return out;}
  const n=normalize(src);let s=n.text;const taken=[];
  const eat=(m,kind,from=0,to=m[0].length)=>{
    const a=m.index+from,b=m.index+to;
    if(b<=a)return;
    taken.push({kind,start:n.start[a],end:n.end[b-1]});
    s=s.slice(0,a)+' '.repeat(b-a)+s.slice(b);
  };
  const find=(re,fn)=>{re.lastIndex=0;let m;while((m=re.exec(s))){if(fn(m)!==false)return true;re.lastIndex=m.index+1;}return false;};
  const rest=m=>s.slice(m.index+m[0].length),before=m=>s.slice(0,m.index);
  let date=null,time=null,part='',due=false,bare=null;
  let dateText='',dateEnd=-1,dateWd=-1,repText='',repEnd=-1,eod=false,fromNow='',moveAt=null;const guess={};
  const dueWord=w=>/^(due|by|before|until|till)$/i.test(w||'');
  const setDate=(day,m,kind='date',{prefix='',from=0,partWord=''}={})=>{
    if(!day)return false;
    date={day};
    dateText=m[0];
    dateEnd=m.index+m[0].length;
    if(dueWord(prefix))due=true;
    if(partWord)part=partWord.toLowerCase();
    eat(m,kind,from);
    return true;
  };
  // "move math hw to sat", "push essay to sunday", "reschedule dentist for fri": a task already there, moved (the planner
  // finds it; when none matches it is read again as a new task, words and all). "from fri" is where it was, not the day.
  if(!skip.has('move'))
    find(rx(String.raw`^\s*(?:(?:pls|please)\s+)?(move|push|bump|shift|postpone|reschedule)(?:\s+back)?\s+(?!to\>)`),m=>{const after=rest(m),word=w=>new RegExp(`(?<![\\p{L}\\p{N}])(?:${w})(?![\\p{L}\\p{N}])`,'u').test(after);
   if(!word('to|until|till|til')&&!(/^(?:reschedule|postpone)$/.test(m[1])&&word('for')))return false;moveAt={index:m.index,0:m[0]};
   find(rx(String.raw`\<from\s+(?:today|tonight|tomorrow|yesterday|(?:this\s+|next\s+)?${WD}|${MON}\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2})\>(?=.*\<(?:to|until|till|til)\>)`),f=>{eat(f,'move');});});
  // 1. a course named with #, as before ("#chem"); a # before a number is a problem number, not a course
  if(!skip.has('course'))
    find(rx(String.raw`#(\p{L}[\p{L}\p{N}_-]*)`),m=>{if(courses){const c=matchCourse(m[1],courses);if(!c)return false;out.courseId=String(c.id);}out.course=m[1].toLowerCase();eat(m,'course');});
  // 2. priority: a "!" at the end of a word or alone, asap, "urgent:" / "important:" at the start, or the words at the end
  if(!skip.has('priority')){
   const hit=()=>{out.priority='high';};
   find(rx(String.raw`(?<=[\p{L}\p{N})])(!{1,3})(?=\s|$)`),m=>{hit();eat(m,'priority');});
   find(rx(String.raw`(?<=^|\s)(!{1,3})(?=\s|$)`),m=>{hit();eat(m,'priority');});
   find(rx(String.raw`\<asap\>`),m=>{hit();eat(m,'priority');});
   find(rx(String.raw`(?:[\u2757\u2755\u203C\u2049\u26A0]\uFE0F?)+`),m=>{hit();eat(m,'priority');});   // a red "!", a double "!!", a warning sign
   find(rx(String.raw`^\s*(?:urgent|important|high\s+priority|top\s+priority)\s*[:!\-–]+`),m=>{hit();eat(m,'priority');});
   find(rx(String.raw`\<(?:urgent|high\s+priority|top\s+priority|important)\s*$`),m=>{hit();eat(m,'priority');});
  }
  // 3. a repeat ("every mon", "daily", "mon/wed/fri", "fridays")
  let repeat=null;
  if(!skip.has('repeat')){
   const rep=(r,m,partWord='')=>{repeat=cleanRepeat(r);repText=m[0];repEnd=m.index+m[0].length;if(partWord)part=partWord.toLowerCase();eat(m,'repeat');};
   const list=t=>[...new Set([...t.matchAll(/[a-z]+/g)].map(x=>x[0].replace(/s$/,'')).filter(x=>wdIndex(x)>=0&&/^(sun|mon|tue|wed|thu|fri|sat)/.test(x)).map(wdIndex))];
   const todayWd=DAY.test(today||'')?weekdayOf(today):1;
   // a timetable's day letters: "mwf", "tth", "m/w/f", "t/th" (never "t/f", true or false, nor "w/ sam", with)
   const CODE={m:1,mo:1,t:2,tu:2,w:3,we:3,th:4,r:4,f:5,fr:5,sa:6,su:0},PACKED={mwf:[1,3,5],mw:[1,3],wf:[3,5],tth:[2,4],tuth:[2,4],mtwrf:[1,2,3,4,5],mtwthf:[1,2,3,4,5]};
   find(rx(String.raw`\<(?:every|each)\s+(?:other|second|2nd)\s+${WD}s?\>`),m=>rep({every:'week',interval:2,days:[wdIndex(m[1])]},m))||
   find(rx(String.raw`\<(?:on\s+)?(mwf|mw|wf|tth|tuth|mtwrf|mtwthf)\>`),m=>rep({every:'week',days:PACKED[m[1]]},m))||
   find(rx(String.raw`\<(?:on\s+)?((?:mo|tu|we|th|fr|sa|su|m|t|w|r|f)(?:[\/,](?:mo|tu|we|th|fr|sa|su|m|t|w|r|f))+)\>`),m=>{
     const p=m[1].split(/[\/,]/);
     if(/^(t\/f|f\/t)$/.test(m[1]))return false;
     rep({every:'week',days:[...new Set(p.map(x=>CODE[x]))]},m);
   })||
   find(rx(String.raw`\<(?:every|each)\s+other\s+(day|week|month)\>`),m=>rep({every:m[1],interval:2,days:[todayWd]},m))||
   find(rx(String.raw`\<(?:every|each)\s+(\d{1,2}|two|three|four|five|six)\s+(day|week|month)s?\>`),m=>{const k=num(m[1]);if(!(k>=1&&k<=12))return false;rep({every:m[2],interval:k,days:[todayWd]},m);})||
   find(rx(String.raw`\<(?:every|each)\s+(?:single\s+)?(?:week\s*day|school\s*day)s?\>`),m=>rep({every:'weekdays'},m))||
   find(rx(String.raw`\<(?:every|each)\s+weekends?\>`),m=>rep({every:'week',days:[0,6]},m))||
   find(rx(String.raw`\<(?:every|each)\s*(day|night|morning|evening|afternoon)\>`),m=>rep({every:'day'},m,m[1]==='day'?'':m[1]))||
   find(rx(String.raw`\<(?:every|each)\s+(week|month)\>`),m=>rep({every:m[1],days:[todayWd]},m))||
   find(rx(String.raw`\<(?:every|each)\s+${WD}(?:(?:\s*(?:,|and|&|\/|\+)\s*|\s+)${WD})*(?:\s+${PART})?\>`),m=>{
     const days=list(m[0]);
     if(!days.length)return false;
     const p=/(morning|afternoon|evening|night)$/.exec(m[0]);
     rep({every:'week',days},m,p?p[1]:'');
   })||
   find(rx(String.raw`\<(?:on\s+)?${WDS}(?:\s*(?:,|and|&|\/)\s*${WDS})*\>`),m=>rep({every:'week',days:list(m[0])},m))||
   find(rx(String.raw`\<(daily|every\s?day|nightly)\>`),m=>rep({every:'day'},m,m[1]==='nightly'?'night':''))||
   find(rx(String.raw`\<weekly\>`),m=>rep({every:'week',days:[todayWd]},m))||
   find(rx(String.raw`\<(?:bi-?weekly|fortnightly)\>`),m=>rep({every:'week',interval:2,days:[todayWd]},m))||
   find(rx(String.raw`\<monthly\>`),m=>rep({every:'month'},m))||
   find(rx(String.raw`\<(?:on\s+)?weekdays\>`),m=>rep({every:'weekdays'},m))||
   find(rx(String.raw`\<(?:on\s+)?weekends\>`),m=>rep({every:'week',days:[0,6]},m))||
   find(rx(String.raw`\<${WD}(?:\s*\/\s*${WD})+\>`),m=>rep({every:'week',days:list(m[0])},m))||
   find(rx(String.raw`\<${WD}(?:(?:\s*(?:,|&|\+|and)\s*|\s+)${WD})+\>`),m=>{const days=list(m[0]);if(days.length<2)return false;rep({every:'week',days},m);});
  }
  const T=DAY.test(today||'');
  // 4-7. the day
  if(T&&!skip.has('date')){
   const P=String.raw`(?:(on|by|due|before|until|till|for)\s+)?`;
   const upcoming=wd=>addDays(today,((wd-weekdayOf(today)+7)%7)||7),thisWeek=wd=>{
     const d=addDays(mondayOf(today),(wd+6)%7);
     return d>=today?d:upcoming(wd);
   },nextWeek=wd=>addDays(mondayOf(today),7+(wd+6)%7),lastWd=wd=>addDays(today,-(((weekdayOf(today)-wd+7)%7)||7));
   const satOf=offset=>{const wd=weekdayOf(today);return wd===6||wd===0?(offset?addDays(today,wd===6?7:6):today):addDays(today,6-wd+offset*7);};
   const pick=(m,d)=>{if(!d)return '';if(d>=today)return d;return between(d,today)<=30?d:'';};
   const yearFor=(mo,d,y)=>{
     if(y)return ymd(y<100?2000+y:y,mo+1,d);
     const here=ymd(+today.slice(0,4),mo+1,d);
     if(!here)return '';
     if(here>=today||between(here,today)<=30)return here;
     return ymd(+today.slice(0,4)+1,mo+1,d);
   };
   const ofMonth=d=>{for(let k=0;k<3;k++){const first=addDays(today.slice(0,8)+'01',k*31).slice(0,8)+'01',x=ymd(+first.slice(0,4),+first.slice(5,7),d);if(x&&x>=today)return x;}return '';};
   const endMonth=()=>addDays(addDays(today.slice(0,8)+'01',32).slice(0,8)+'01',-1),friday=()=>{const wd=weekdayOf(today);return wd>=1&&wd<=5?addDays(today,5-wd):today;};
   const tail=m=>rest(m);
   (find(rx(String.raw`\<${P}(?:the\s+)?day\s+after\s+tomorrow\>`),m=>setDate(addDays(today,2),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}(?:in|within)\s+a\s+couple(?:\s+of)?\s+(day|week)s?\>`),m=>setDate(addDays(today,m[2]==='day'?2:14),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}overmorrow\>`),m=>setDate(addDays(today,2),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}(?:in|within)\s+(\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten|couple(?:\s+of)?|few)\s+(day|week|month)s?\>`),m=>{
      const k=num(m[2]);
      if(!(k>=0&&k<=400))return false;
      const d=m[3]==='day'?addDays(today,k):m[3]==='week'?addDays(today,7*k):addMonths(today,k);
      return setDate(d,m,'date',{prefix:m[1]});
    })||
    find(rx(String.raw`\<${P}(?:(this|next|the)\s+)?week\s?ends?\>`),m=>setDate(satOf(m[2]==='next'?1:0),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}(?:the\s+)?end\s+of\s+(?:the\s+|this\s+)?(month|week)\>`),m=>setDate(m[2]==='month'?endMonth():friday(),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}(eom|eow)\>`),m=>setDate(m[2]==='eom'?endMonth():friday(),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}next\s+(week|month)\>`),m=>setDate(m[2]==='week'?addDays(mondayOf(today),7):addDays(endMonth(),1),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}(today|tonight|tomorrow|yesterday)(?:\s+${PART})?(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?(?!\s*(?:a\.?m|p\.?m|[ap]\b|min|mins|minutes?|m\b|h\b|hr|hrs|hours?|pages?|problems?|questions?|days?|weeks?|%|st\b|nd\b|rd\b|th\b|[:\/.\-]\d)))?\>`),m=>{
      if(m[4]!==undefined){const h=+m[4],mi=+(m[5]||0);if(h<1||h>12||mi>59)return false;bare={at:h*60+mi,ambiguous:true};}
      return setDate(addDays(today,{today:0,tonight:0,tomorrow:1,yesterday:-1}[m[2]]),m,'date',{prefix:m[1],partWord:m[3]||(m[2]==='tonight'?'tonight':'')});
    })||
    find(rx(String.raw`\<this\s+(morning|afternoon|evening)\>`),m=>setDate(today,m,'date',{partWord:m[1]}))||
    // a weekday: "fri", "on friday", "next wed", "by thursday", "this fri", "sat morning"; "sat"/"sun" only where they read as days
    find(rx(String.raw`\<${P}(?:(this|next|coming|last)\s+)?${WD}\.?(?:\s+${PART})?\>`),m=>{
     const word=m[3],full=word.length>4,ambiguous=/^(sat|sun)$/.test(word),after=tail(m),lead=m[1]||m[2];
     if(ambiguous&&!lead&&!m[4]&&!/^\s*(?:$|[!.,;:)\-–]|at\b|@|\d|morning|afternoon|evening|night|noon)/.test(after)&&!(/^\s*$/.test(before(m))&&/^\s*[:\-–]/.test(after)))return false;
     const wd=wdIndex(word),q=m[2];const d=q==='next'?nextWeek(wd):q==='this'?thisWeek(wd):q==='last'?lastWd(wd):upcoming(wd);
     return setDate(d,m,'date',{prefix:m[1],partWord:m[4]||''});})||
    find(
      rx(String.raw`\<${P}${MON}\.?\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\>(?!\s*(?::|am\b|pm\b|a\.m|p\.m|h\b|hr|hour|min))`),
      m=>setDate(yearFor(monIndex(m[2]),+m[3],m[4]?+m[4]:0),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MON}(?:,?\s+(\d{4}))?\>`),m=>setDate(yearFor(monIndex(m[3]),+m[2],m[4]?+m[4]:0),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}(\d{4})-(\d{1,2})-(\d{1,2})\>`),m=>setDate(ymd(+m[2],+m[3],+m[4]),m,'date',{prefix:m[1]}))||
    find(rx(String.raw`\<${P}(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\>(?![\/\d])`),m=>{
      if(/(?:(?<![\p{L}\p{N}])(?:ch|chap|chapter|pg|pp|p|page|pages|problems?|questions?|q|ex|exercises?|unit|lesson|section|sec)|#)\.?\s*$/iu.test(before(m)))return false;
      const mo=+m[2]-1,d=+m[3];
      if(mo<0||mo>11)return false;
      return setDate(yearFor(mo,d,m[4]?+m[4]:0),m,'date',{prefix:m[1]});
    })||
    find(rx(String.raw`\<${P}the\s+(\d{1,2})(?:st|nd|rd|th)\>`),m=>setDate(ofMonth(+m[2]),m,'date',{prefix:m[1]})));
  }
  // A day the student may not have meant ("fri" said on a Friday, "next fri" early in the week, "next week" with no day,
  // "tmrw" typed after midnight): it is still read the usual way, marked as a guess, and the other reading is one tap
  // away ('alt-date' in opts.ignore takes it; '' = no other day, the tap takes the day back).
  if(date&&T){const w=dateText.trim().replace(/^(?:on|by|due|before|until|till|for)\s+/,''),wm=new RegExp(`^(?:(this|next|coming|last)\\s+)?${WD}\\.?(?:\\s+${PART})?$`).exec(w);let alt;
   if(wm){
     const wd=wdIndex(wm[2]),up=addDays(today,((wd-weekdayOf(today)+7)%7)||7);
     dateWd=wd;
     if(!wm[1]&&wd===weekdayOf(today))alt=today;else if(wm[1]==='next'&&up<addDays(mondayOf(today),7))alt=up;
   }
   else if(/^next\s+(?:week|month)$/.test(w))alt='';
   else if(/week\s?ends?$/.test(w)&&weekdayOf(date.day)===6)alt=addDays(date.day,1);
   else if(/^tomorrow\b/.test(w)&&now!==null&&now<300)alt=today;
   if(alt!==undefined&&alt!==date.day){if(alt&&skip.has('alt-date'))date.day=alt;else guess.date=alt;}}
  // "every 2 weeks on sat", "weekly fri": the repeat falls on the weekday named, not on today's
  if(repeat&&repeat.every==='week'&&dateWd>=0&&repeat.days.length===1&&!/(?:sun|mon|tue|wed|thu|fri|sat)/.test(repText))repeat={...repeat,days:[dateWd]};
  // ...and a series starts on its first day from today ("every week on mon" said on a Monday: today, like "every mon")
  if(repeat&&repeat.every==='week'&&dateWd>=0&&repeat.days.includes(dateWd)&&!/^(?:this|next|coming|last)\s/.test(dateText.trim().replace(/^(?:on|by|due|before|until|till|for)\s+/,''))){
    date.day=nextOn(repeat,today)||date.day;
    delete guess.date;
  }
  // 8-9. the time: "5pm", "5:30 pm", "17:30", "at 7", "noon", "3-4pm" (a start and a length), "after school"
  let length=0;
  if(!skip.has('time')){
   const ap=v=>v?v[0].toLowerCase():'';
   const clock=(h,mi,a)=>{h=+h;mi=+(mi||0);if(mi>59)return null;if(a){if(h<1||h>12)return null;return (h%12+(a==='p'?12:0))*60+mi;}return h>23?null:h*60+mi;};
   const AMPM=String.raw`(a\.?m\.?|p\.?m\.?|a|p)`;
   find(rx(String.raw`\<(?:(from|at|by)\s+)?(\d{1,2})(?::(\d{2}))?\s*${AMPM}?\s*(?:-|–|to|till|until)\s*(\d{1,2})(?::(\d{2}))?\s*${AMPM}(?![\p{L}\p{N}])`),m=>{
    const e=ap(m[7]),a=ap(m[4])||e;
    let st=clock(m[2],m[3],a),en=clock(m[5],m[6],e);
    if(st===null||en===null)return false;
    if(en<=st&&!m[4]&&st+720>en)st=st-720>=0&&st-720<en?st-720:st;
    if(en<=st)return false;
    time={at:st,ambiguous:false};length=en-st;if(m[1]==='by')due=true;eat(m,'time');})||
   find(rx(String.raw`(?:\<(at|by|before|around|from|due)\s+|@\s*)?\<(\d{1,2}):(\d{2})\s*${AMPM}?(?![\p{L}\p{N}])`),m=>{
     const a=ap(m[4]),v=clock(m[2],m[3],a);
     if(v===null)return false;
     time={at:v,ambiguous:!a&&+m[2]>=1&&+m[2]<=12&&!/^0/.test(m[2])};
     if(dueWord(m[1]))due=true;
     eat(m,'time');
   })||
   find(rx(String.raw`(?:\<(at|by|before|around|from|due)\s+|@\s*)?\<(\d{1,2})\s*${AMPM}(?![\p{L}\p{N}])`),m=>{
     const v=clock(m[2],0,ap(m[3]));
     if(v===null)return false;
     time={at:v,ambiguous:false};
     if(dueWord(m[1]))due=true;
     eat(m,'time');
   })||
   find(rx(String.raw`(?:\<(at|by|around)\s+|@\s*)(\d{1,2})\>(?!\s*(?:min|mins|minutes?|m\b|h\b|hr|hrs|hours?|pages?|problems?|questions?|days?|weeks?|%|th\b|st\b|nd\b|rd\b))`),m=>{
     const h=+m[2];
     if(h<1||h>23)return false;
     time={at:h*60,ambiguous:h<=12&&!/^0/.test(m[2])};
     if(m[1]==='by')due=true;
     eat(m,'time');
   })||
   find(rx(String.raw`\<(?:(at|by|before|around|due)\s+)?(noon|midday|midnight)\>`),m=>{time={at:m[2]==='midnight'?1439:720,ambiguous:false};if(dueWord(m[1]))due=true;eat(m,'time');})||
   find(rx(String.raw`\<after\s+school\>`),m=>{time={at:930,ambiguous:false};eat(m,'time');});
   // an hour with no am/pm right after a day or a repeat ("tues 4-6", "every mon 6"), at the very end of a line that names
   // a day or a repeat ("every mon wed fri gym 6"), or with -ish ("4ish"): read like "at 4". A number after a counted
   // thing ("quiz 2", "ch 5", "unit 3") or before one ("fri 3 chapters") stays in the name.
   if(!time){
    const COUNTED=/(?:^|\s)(?:units?|ch|chap|chapters?|lessons?|period|per|block|problems?|probs?|q|questions?|pgs?|pages?|p|pp|sections?|sec|test|quiz|exam|sets?|lab|part|act|scene|round|grade|room|rm|level|lvl|step|game|hw|homework|ws|worksheet|packet|module|mod|weeks?|days?|number|no|num|vol|volume|book|slides?|essay|draft|paragraph|para|ex|exercises?|cards?|list|item|task|version|v|track|episode|ep|season|lecture|lec|assignment|project|proj|phase|stage|team|bus|route|row|seat|table|group|floor|figure|fig|eq|equation|stanza|lines?|verse|topic|case|hole|laps?|miles?|reps?|psalm|class|form|year|yr|top|[#\d])\s*$/;
    const NOUN=String.raw`(?:[\p{L}]+s\b|min\b|m\b|h\b|hour\b|pg\b|ch\b|mi\b|km\b|k\b|x\b|%|st\b|nd\b|rd\b|th\b|of\b|essay|chapter|page|problem|question|section|unit|lesson|slide|paragraph|word|card|set|lap|mile|rep|point|item|time|person|kid|student|dollar|\$)`;
    const bareAt=(text,start,h1,m1,h2,m2)=>{h1=+h1;m1=+(m1||0);if(h1<1||h1>12||m1>59)return false;let len=0;
     if(h2!==undefined){h2=+h2;m2=+(m2||0);if(h2<1||h2>12||m2>59)return false;len=((h2%12)*60+m2-((h1%12)*60+m1)+720)%720;if(!len||len>360)return false;}
     time={at:h1*60+m1,ambiguous:true};if(len)length=len;eat({index:start,0:text},'time');return true;};
    find(rx(String.raw`(?:\<(?:at|around)\s+)?\<(\d{1,2})(?::(\d{2}))?\s*-?\s*ish\>`),m=>bareAt(m[0],m.index,m[1],m[2]))||
    [dateEnd,repEnd].some(end=>{
      if(end<0)return false;
      const x=new RegExp(String.raw`^(\s*(?:at\s+|@\s*)?)(\d{1,2})(?::(\d{2}))?(?:\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?)?(?![\p{L}\p{N}:\/.])(?!\s*${NOUN})`,'u').exec(s.slice(end));
      return !!x&&bareAt(x[0].slice(x[1].length),end+x[1].length,x[2],x[3],x[4],x[5]);
    })||
    (date||repeat)&&(()=>{
      const y=/(?<![\p{L}\p{N}:\/.#\-–])(\d{1,2})(?:\s*(?:-|–)\s*(\d{1,2}))?(?=[\s!.?]*$)/u.exec(s);
      return !!y&&
        /^[\s!.?]*$/.test(n.text.slice(y.index+y[0].length))&&
        !COUNTED.test(s.slice(0,y.index))&&
        !/\d\s*(?:&|and|,|or|\+|\/)\s*$/.test(s.slice(0,y.index))&&
        bareAt(y[0],y.index,y[1],undefined,y[2]);
    })();
   }
   // "in 2 hours", "in 30 min": a time counted from now, not how long it takes
   if(!time&&now!==null&&T)
     find(rx(String.raw`\<(?:in|within)\s+(\d{1,3}(?:\.\d+)?|an?|one|two|three|four|five|six|half\s+an?)\s+(hours?|h|minutes?|mins?|m)\>`),m=>{
       const k=/^half/.test(m[1])?.5:num(m[1]);
       if(!(k>0))return false;
       const add=Math.round(/^h/.test(m[2])?k*60:k);
       if(add>720)return false;
       const t=now+add;
       fromNow=t>=1440?addDays(today,1):today;
       time={at:t%1440,ambiguous:false};
       eat(m,'time');
     });
  }
  // "eod", "by end of day": a deadline at the end of the day named (today when none is)
  // ("end of day reflection" is a name: the words count only at the end of the line or after by/before/at)
  if(!skip.has('date'))find(rx(String.raw`\<(?:(?:by|before|at)\s+(?:the\s+)?(?:eod|end\s+of\s+(?:the\s+)?day)|(?:the\s+)?eod|(?:the\s+)?end\s+of\s+(?:the\s+)?day(?=[\s!.,;]*$))\>`),m=>{eod=true;due=true;eat(m,'due');});
  if(!time&&bare&&!skip.has('time'))time=bare;
  // 10. how long: "45m", "1.5h", "1h30", "an hour", "half an hour", "for 20 minutes"
  if(!skip.has('duration')){
   const D=String.raw`(?:for\s+|about\s+|~\s*)?`,take=(m,v)=>{if(!(v>0&&v<=1440))return false;length=Math.round(v);eat(m,'duration');};
   if(!length&&!(find(rx(String.raw`\<${D}(?:an?|one)\s+hour\s+and\s+(?:a\s+)?half\>`),m=>take(m,90))||
    find(rx(String.raw`\<${D}(\d+)\s+and\s+(?:a\s+)?half\s+(?:hours?|hrs?)\>`),m=>take(m,+m[1]*60+30))||
    find(rx(String.raw`\<${D}(\d+(?:\.\d+)?)\s*-?\s*(?:h|hr|hrs|hour|hours)\s*(?:and\s+)?(\d{1,2})\s*(?:m|min|mins|minutes?)?\>`),m=>take(m,parseFloat(m[1])*60+ +m[2]))||
    find(rx(String.raw`\<${D}(\d+(?:\.\d+)?)\s*-?\s*(?:h|hr|hrs|hour|hours)\>`),m=>take(m,parseFloat(m[1])*60))||
    find(rx(String.raw`\<${D}(\d{1,4})\s*-?\s*(?:m|min|mins|minutes?)\>`),m=>take(m,+m[1]))||
    find(rx(String.raw`\<${D}(?:a\s+)?(?:half\s+an?\s+hour|half\s+hour|half-hour)\>`),m=>take(m,30))||
    find(rx(String.raw`\<${D}(?:a\s+)?quarter\s+(?:of\s+an?\s+)?hour\>`),m=>take(m,15))||
    find(rx(String.raw`\<${D}(?:an?|one)\s+hour\>`),m=>take(m,60))||
    find(rx(String.raw`\<${D}(two|three|four|five|six)\s+hours?\>`),m=>take(m,num(m[1])*60))||
    find(
      rx(String.raw`\<${D}(five|ten|fifteen|twenty|thirty|forty|forty-five|forty\s+five|sixty|ninety)\s+min(?:ute)?s?\>`),
      m=>take(m,{five:5,ten:10,fifteen:15,twenty:20,thirty:30,forty:40,'forty-five':45,'forty five':45,sixty:60,ninety:90}[m[1].replace(/\s+/,' ')]))));
  }
  // 11. a deadline: "due", "deadline" anywhere once there is a day or a time to be due at
  if((date||time)&&!skip.has('date'))find(rx(String.raw`\<(?:due|deadline)\>(?:\s+(?:on|by|at)\>)?`),m=>{due=true;eat(m,'due');});
  // what the pieces add up to
  if(date)out.day=date.day;
  if(repeat){out.repeat=repeat;if(!out.day&&T)out.day=nextOn(repeat,today);}
  if(!out.day&&fromNow)out.day=fromNow;
  if(time){let at=time.at;
   if(time.ambiguous){const h=Math.floor(at/60)%12,mi=at%60,am=h*60+mi,pm=am+720,p=part;
    if(h===11&&mi===59)at=pm;else if(p==='morning')at=am;else if(p==='afternoon'||p==='evening'||p==='night'||p==='tonight')at=pm;
    else if(!home&&(!out.day||out.day===today&&now!==null&&!repeat)){
      if(now!==null&&(!out.day||out.day===today)){const c=[am,pm].find(v=>v>now);if(c!==undefined){at=c;out.day||=today;}else{at=h>=8?am:pm;}}else at=h>=8||h===0?am:pm;
    }
    else at=h>=8||h===0?am:pm;
    if(h===0)at=720+mi;}
   out.at=hhmm(at);
   if(!out.day&&T)out.day=home||(now!==null&&at<=now&&!repeat?addDays(today,1):today);
   // 5 to 11 with no am/pm and no part of the day: either half could be meant (unless the other has already gone today);
   // the usual reading stands, marked as a guess, and 'alt-time' takes the other half
   if(time.ambiguous&&!part){
     const h=Math.floor(at/60)%12,mi=at%60,other=(at+720)%1440;
     if(h>=5&&h<=11&&!(h===11&&mi===59)&&!(out.day===today&&now!==null&&other<=now)){if(skip.has('alt-time'))out.at=hhmm(other);else guess.time=hhmm(other);}
   }
  }else if(part&&!skip.has('time')){out.at=hhmm(PART_AT[part]);if(!out.day&&T)out.day=home||today;}
  if(length)out.estimate=Math.max(0,Math.min(1440,length));
  if(eod&&!out.day&&T)out.day=home||today;
  out.due=!!(due&&(out.day||out.at));
  if(moveAt&&out.day){eat(moveAt,'move');out.move=true;}
  if(Object.keys(guess).length)out.guess=guess;
  // the name: what is left, without dangling little words or marks at either end
  const keep=src.split('');for(const t of taken)for(let i=t.start;i<t.end;i++)keep[i]='\u0000';
  let name=keep.join('').replace(/\u0000+/g,' ').replace(/\s+/g,' ').trim();
  const edge=/^(?:(?:on|at|by|for|in|every|from|until|till|of|starting|before|around|@|and|&)\s+|[\s:;,.\-–—|\/~]+)+|(?:\s+(?:on|at|by|for|in|every|from|until|till|til|to|of|starting|before|around|@|and|&)|[\s:;,\-–—|\/~]+)+$/i;
  for(let i=0;i<4;i++){const next=name.replace(edge,'').trim();if(next===name)break;name=next;}
  // words said to the planner, not part of the task: "remind me to", "don't forget (to)", "need to", "gotta", "todo:"
  {const said=name.replace(/^(?:(?:please|pls|plz)\s+)?(?:remind\s+me\s+to|(?:don['’]?t|do\s+not)\s+forget(?:\s+to)?|(?:i\s+)?(?:need|have|got)\s+to|(?:i\s+)?gotta|to-?\s?do\s*:|todo\s*:?|reminder\s*:)\s+/i,'').trim();if(/[\p{L}\p{N}]/u.test(said))name=said;}
  name=name.replace(/\s+([,;:])/g,'$1').replace(/\(\s*\)/g,'').replace(/\s+/g,' ').trim();
  out.name=name.slice(0,200);
  // a course written as a word ("chem lab", "calc hw"): it stays in the name and tags the task
  if(!out.courseId&&courses&&!skip.has('course')){
    const lower=name.toLowerCase(),words=[];
    for(const m of lower.matchAll(/[\p{L}\p{N}]+/gu)){if(/\btranslat\w*\b.*\b(?:to|into)\s+$/.test(lower.slice(0,m.index)))continue;words.push(m[0]);}
    const c=courseFor(words,courses);
    if(c){
      out.courseId=String(c.id);
      const w=words.find(x=>courseFor([x],[c])===c);
      if(w){
        const at=lower.search(new RegExp('(?<![\\p{L}\\p{N}])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}])','u'));
        const off=src.toLowerCase().indexOf(name.toLowerCase());
        if(at>=0&&off>=0)taken.push({kind:'course',start:off+at,end:off+at+w.length,soft:true});
      }
    }
  }
  out.spans=taken.sort((a,b)=>a.start-b.start);
  return out;
 }
 const DUE_DEFAULT='23:59';
 // A wall-clock day and time in a time zone, as an ISO instant (for a personal task's due time).
 function instant(day,time,zone){
  if(!DAY.test(day||''))return null;const [h,mi]=(TIME.test(time||'')?time:DUE_DEFAULT).split(':').map(Number),base=Date.parse(day+'T00:00:00Z')+(h*60+mi)*6e4;
  let f;
  try{
    f=new Intl.DateTimeFormat('en-US',{timeZone:zone||'America/New_York',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }catch{f=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
  const wall=t=>{const p={};for(const x of f.formatToParts(t))p[x.type]=x.value;return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour==='24'?'00':p.hour}:${p.minute}:00Z`);};
  let t=base-(wall(base)-base);t=base-(wall(t)-t);
  // a time the clocks skip (2:30 on the spring-forward night) is the same time after the jump, 3:30, never 1:30
  const off=base-wall(t);if(off>0)t+=off;
  return new Date(t).toISOString();
 }

 // ---- the plan ---------------------------------------------------------------------------------------------------------
 // One list of everything that can be planned. `items` are the workspace's normalised assignments and personal
 // tasks; `local` is the student's own record for each (planned day, done, length, steps, priority, repeat log).
 function entries(items,local={},{dayOf,isDone=()=>false,colorOf=()=>'',today=''}={}){
  return items.map(item=>{
   const mine=local[item.id]||{},steps=Array.isArray(mine.checklist)?mine.checklist:[],repeat=item.personal?cleanRepeat(item.repeat):null;
   let planned=DAY.test(mine.plannedDate||'')?mine.plannedDate:'',done=!!isDone(item,mine);
   // (where its series counts from: its next days and echoes are counted from there)
   const from=repeat?anchorOf(repeat,mine,planned):'';
   // a repeating task ticked as a whole somewhere else: the occurrence it stood on is done, the next one is open
   if(repeat&&done&&mine.progress!=='done'&&DAY.test(today)&&planned&&planned<today){planned=nextOn(repeat,today,from);done=false;}
   const time=planned&&typeof mine.plannedTime==='string'&&TIME.test(mine.plannedTime)?mine.plannedTime:'';
   return {
     id:String(item.id),
     title:item.name,
     courseId:String(item.courseId),
     course:item.courseName||'',
     color:item.courseColor||item.color||colorOf(item)||'',
     personal:!!item.personal,
     url:item.url||'',
    dueAt:item.dueAt||null,
    dueDay:item.dueAt&&dayOf?dayOf(item.dueAt):'',
    planned,
    estimate:Number.isFinite(mine.estimate)?mine.estimate:0,
    ...(time?{plannedTime:time}:{}),
    done,
    steps:steps.length,
    stepsDone:steps.filter(s=>s&&s.done).length,
    ...(typeof mine.notes==='string'&&mine.notes.trim()?{noted:true}:{}),
    pinned:mine.pinned===true,
    missing:!!item.missing,
    points:item.points??null,
    priority:mine.priority==='high'?'high':'',repeat,...(from?{from}:{}),log:Array.isArray(mine.repeatLog)?mine.repeatLog.filter(x=>x&&DAY.test(x.day||'')):[]};
  });
 }
 const byDue=(a,b)=>(a.dueAt?Date.parse(a.dueAt):Infinity)-(b.dueAt?Date.parse(b.dueAt):Infinity)||a.title.localeCompare(b.title);
 const byPlan=(a,b)=>a.done-b.done||(b.priority==='high')-(a.priority==='high')||(a.plannedTime||'99:99').localeCompare(b.plannedTime||'99:99')||byDue(a,b);
 // A day of the plan: what the student put there, then what is due that day and was not planned for another day.
 function day(list,key){
  const planned=list.filter(e=>e.planned===key).sort(byPlan);
  const due=list.filter(e=>!e.planned&&e.dueDay===key).sort((a,b)=>a.done-b.done||(b.priority==='high')-(a.priority==='high')||byDue(a,b));
  const all=[...planned,...due],open=all.filter(e=>!e.done);
  return {key,planned,due,all,open:open.length,done:all.length-open.length,minutes:open.reduce((n,e)=>n+e.estimate,0)};
 }
 // Past its day and not done: planned for a day already gone, or due on one with no day chosen.
 const isOverdue=(e,today)=>!e.done&&(e.planned?e.planned<today:!!e.dueDay&&e.dueDay<today);
 const since=(e)=>e.planned||e.dueDay||'';
 function board(list,today,offset=0){
  const days=week(today,offset).map(key=>day(list,key));
  // Waiting for a day: open work due within the next two weeks (or overdue) that has not been given one.
  const horizon=addDays(today,14),waiting=list.filter(e=>!e.done&&!e.planned&&e.dueDay&&e.dueDay<=horizon&&!days.some(d=>d.key===e.dueDay)).sort(byDue);
  const overdue=list.filter(e=>isOverdue(e,today)).sort(byDue);
  const someday=list.filter(e=>!e.done&&!e.planned&&!e.dueDay&&e.personal).sort((a,b)=>a.title.localeCompare(b.title));
  return {days,waiting:waiting.filter(e=>!overdue.includes(e)),overdue,someday,today};
 }
 // The Planner page's view: `count` days from `start`. Work past its day is carried to today, at the top, once; it is
 // never shown again on the day it was left on, so each open thing stands in exactly one place. A repeating task shows
 // its next occurrences too, as echoes (open on their own day, ticked when that day comes).
 function range(list,today,start,count=7){
  const keys=Array.from({length:count},(_,i)=>addDays(start,i)),last=keys[keys.length-1],shown=keys.includes(today);
  const overdue=list.filter(e=>isOverdue(e,today)).sort((a,b)=>since(a).localeCompare(since(b))||byDue(a,b));
  const days=keys.map(key=>{
   const d=day(list.filter(e=>!(isOverdue(e,today)&&key<today)),key);
   const echoes=key<=today?
     []:
     list.filter(e=>e.repeat&&e.planned&&e.planned<key&&onRepeat(e.repeat,e.from&&e.from<=e.planned?e.from:e.planned,key)).map(e=>
       ({...e,echo:true,planned:key,done:false})).sort(byPlan);
   // the days a repeating task was done on stay ticked on their day (the task itself has moved on)
   const logged=list.filter(e=>e.repeat&&e.planned!==key&&e.log.some(x=>x.day===key&&!x.skip)).map(e=>({...e,echo:true,logged:true,planned:key,done:true}));
   const carried=key===today?overdue:[];
   const all=[...carried,...d.all,...echoes,...logged],open=all.filter(e=>!e.done);
   return {...d,carried,echoes,logged,all,open:open.length,done:all.length-open.length,minutes:open.reduce((n,e)=>n+e.estimate,0)};
  });
  const horizon=addDays(today,14),inView=k=>k>=start&&k<=last;
  const waiting=list.filter(e=>!e.done&&!e.planned&&e.dueDay&&e.dueDay>=today&&e.dueDay<=(horizon>last?horizon:last)&&!inView(e.dueDay)).sort(byDue);
  const someday=list.filter(e=>!e.done&&!e.planned&&!e.dueDay&&e.personal).sort((a,b)=>(b.priority==='high')-(a.priority==='high')||a.title.localeCompare(b.title));
  return {days,start,last,today,overdue:shown?[]:overdue,carried:overdue,waiting,someday};
 }
 // (4.2.13) The calendar's days: `count` days from `start`, and nothing carried: work past its day stays on its own day and
 // is listed once more in `overdue` (it is never poured into today). A day holds what was planned for it and what is due
 // that day with no day chosen; a repeat's coming days are echoes; the days a repeat was done on stay ticked; work planned
 // for another day leaves a "due" mark on its due day. A day reads in time order: timed work by its time, then the rest,
 // important first; finished work last. `nodate` is the student's own work with no day and no deadline.
 const byDay=(a,b)=>
   a.done-b.done||(a.plannedTime?0:1)-(b.plannedTime?0:1)||(a.plannedTime||'').localeCompare(b.plannedTime||'')||(b.priority==='high')-(a.priority==='high')||byDue(a,b);
 function span(list,today,start,count=7){
  const keys=Array.from({length:Math.max(1,Math.min(84,count|0))},(_,i)=>addDays(start,i));
  const days=keys.map(key=>{
   const d=day(list,key);
   const echoes=key<=today?
     []:
     list.filter(e=>e.repeat&&e.planned&&e.planned<key&&onRepeat(e.repeat,e.from&&e.from<=e.planned?e.from:e.planned,key)).map(e=>
       ({...e,echo:true,planned:key,done:false}));
   const logged=list.filter(e=>e.repeat&&e.planned!==key&&e.log.some(x=>x.day===key&&!x.skip)).map(e=>({...e,echo:true,logged:true,planned:key,done:true}));
   const marks=list.filter(e=>e.planned&&e.dueDay===key&&e.planned!==key&&!e.done&&!e.repeat).sort(byDue);
   const all=[...d.all,...echoes,...logged].sort(byDay),open=all.filter(e=>!e.done);
   return {key,planned:d.planned,due:d.due,echoes,logged,marks,all,open:open.length,done:all.length-open.length,minutes:open.reduce((n,e)=>n+e.estimate,0)};
  });
  const overdue=list.filter(e=>isOverdue(e,today)).sort((a,b)=>since(a).localeCompare(since(b))||byDue(a,b));
  const nodate=list.filter(e=>!e.done&&!e.planned&&!e.dueDay&&e.personal).sort((a,b)=>(b.priority==='high')-(a.priority==='high')||a.title.localeCompare(b.title));
  return {days,start:keys[0],last:keys[keys.length-1],today,overdue,nodate};
 }
 // Changes, written as functions over the saved task record so the store can apply them in one transaction.
 const record=(tasks,id)=>tasks[id]||(tasks[id]={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:0,plannedDate:'',checklist:[]});
 const plan=(id,dayKey,time)=>data=>{
   if(dayKey&&!DAY.test(dayKey))return;
   const r=record(data.tasks,id);
   r.plannedDate=dayKey||'';
   if(time!==undefined){if(time&&TIME.test(time)&&dayKey)r.plannedTime=time;else delete r.plannedTime;}else if(!dayKey)delete r.plannedTime;
 };
 const estimate=(id,n)=>data=>{record(data.tasks,id).estimate=Math.max(0,Math.min(1440,Math.round(n)||0));};
 const carryOver=(today,ids)=>data=>{
   for(const id of ids){const r=data.tasks[id];if(r&&r.plannedDate&&r.plannedDate<today&&r.progress!=='done'&&!r.checkedOff)r.plannedDate=today;}
 };
 const priority=(id,value)=>data=>{const r=record(data.tasks,id);if(value==='high')r.priority='high';else delete r.priority;};
 const LOG=30;
 // A repeating task's occurrence is done: it is written in its log and the task moves on to the next occurrence (on or
 // after today: a missed daily task does not pile up). Undo takes the last log line back.
 // (A repeating task marked done as a whole elsewhere, e.g. Archive on Home, has checkedOff on its record: that is first
 // settled as the occurrence it stood on being done, so the log has that day and the series is open again.)
 // (each counts the next day from where the series began, and keeps that day with the record as repeatFrom)
 function settle(r,rec,today){
   if(rec.checkedOff!==true&&rec.progress!=='done')return;
   const at=DAY.test(rec.plannedDate||'')?rec.plannedDate:today;
   if(at>=today)return;
   const from=anchorOf(r,rec,at);
   rec.repeatLog=[...(Array.isArray(rec.repeatLog)?rec.repeatLog:[]),{day:at}].slice(-LOG);
   rec.plannedDate=nextOn(r,today,from)||'';
   rec.repeatFrom=from;
   rec.checkedOff=false;
   if(rec.progress==='done')rec.progress='not-started';
 }
 function complete(id,today,{skip=false}={}){return data=>{
  const task=(data.customTasks||[]).find(t=>t.id===id),r=cleanRepeat(task?.repeat);
  if(!r)return;
  const rec=record(data.tasks,id);
  settle(r,rec,today);
  const at=DAY.test(rec.plannedDate||'')?rec.plannedDate:today,from=anchorOf(r,rec,at);
  rec.repeatLog=[...(Array.isArray(rec.repeatLog)?rec.repeatLog:[]),{day:at,...(skip?{skip:true}:{})}].slice(-LOG);
  rec.plannedDate=nextOn(r,addDays(at,1)>today?addDays(at,1):today,from)||'';rec.repeatFrom=from;rec.checkedOff=false;if(rec.progress==='done')rec.progress='not-started';};}
 const uncomplete=id=>data=>{
   const rec=data.tasks?.[id];
   if(!rec||!Array.isArray(rec.repeatLog)||!rec.repeatLog.length)return;
   const last=rec.repeatLog[rec.repeatLog.length-1];
   rec.repeatLog=rec.repeatLog.slice(0,-1);
   rec.plannedDate=last.day;
   rec.checkedOff=false;
 };
 // (a new kind of repeat begins on the task's planned day; the same one chosen again keeps where its series began)
 const setRepeat=(id,repeat,today)=>data=>{
   const task=(data.customTasks||[]).find(t=>t.id===id);
   if(!task)return;
   const r=cleanRepeat(repeat),before=cleanRepeat(task.repeat);
  if(!r){delete task.repeat;if(data.tasks?.[id])delete data.tasks[id].repeatFrom;return;}
  task.repeat=r;const rec=record(data.tasks,id);if(!DAY.test(rec.plannedDate||'')&&DAY.test(today||''))rec.plannedDate=nextOn(r,today);
  const planned=DAY.test(rec.plannedDate||'')?rec.plannedDate:'';
  if(!planned)delete rec.repeatFrom;else rec.repeatFrom=repeatKey(before)===repeatKey(r)?anchorOf(r,rec,planned):planned;
 };
 const remove=id=>data=>{if(!/^local-[\w-]+$/.test(id||''))return;data.customTasks=(data.customTasks||[]).filter(task=>task.id!==id);delete data.tasks[id];};
 // ---- a task's sheet (4.2.12). Every change goes to a field the saved data already had, so a build from before reads it
 // unchanged: an own task's name, due time and course (customTasks), a note and steps (tasks[id].notes / .checklist, the
 // same list the reader's "Make a plan" keeps). Canvas work is never renamed, re-dated or moved to another course.
 const own=(data,id)=>/^local-[\w-]+$/.test(id||'')?(data.customTasks||[]).find(t=>t&&t.id===id)||null:null;
 const line=(v,max)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
 const NOTE_MAX=20000,STEPS_MAX=100;
 const rename=(id,name)=>data=>{const t=own(data,id),v=line(name,200);if(t&&v)t.name=v;};
 // a deadline for an own task: a day (and a time, 11:59 PM when none), in the student's zone; no day = no deadline
 const setDue=(id,day,time,zone)=>data=>{
   const t=own(data,id);
   if(!t)return;
   t.dueAt=DAY.test(day||'')&&validDay(day)?instant(day,TIME.test(time||'')?time:DUE_DEFAULT,zone):null;
 };
 const setCourse=(id,courseId)=>data=>{const t=own(data,id);if(t)t.courseId=/^\d+$/.test(String(courseId??''))?String(courseId):'personal';};
 const setNote=(id,text)=>data=>{record(data.tasks,id).notes=String(text??'').replace(/\u0000/g,'').slice(0,NOTE_MAX);};
 const addStep=(id,text,stepId)=>data=>{
   const r=record(data.tasks,id),v=line(text,300);
   if(!v)return;
   if(!Array.isArray(r.checklist))r.checklist=[];
   if(r.checklist.length>=STEPS_MAX)return;
   r.checklist.push({id:line(stepId,100)||'step-'+Date.now().toString(36)+'-'+r.checklist.length,text:v,done:false});
 };
 const setStep=(id,stepId,{done,text}={})=>data=>{
   const s=(Array.isArray(data.tasks?.[id]?.checklist)?data.tasks[id].checklist:[]).find(x=>x&&x.id===stepId);
   if(!s)return;
   if(done!==undefined)s.done=done===true;
   if(text!==undefined){const v=line(text,300);if(v)s.text=v;}
 };
 const removeStep=(id,stepId)=>data=>{const r=data.tasks?.[id];if(r&&Array.isArray(r.checklist))r.checklist=r.checklist.filter(x=>!x||x.id!==stepId);};
 // several plans at once (the To plan column's "Plan all"): [id, day] pairs, each as plan() would make it
 const planMany=pairs=>data=>{for(const [id,day] of Array.isArray(pairs)?pairs:[])plan(String(id),day)(data);};
 // A quick add, saved: a deadline becomes the task's due time (a planned day is the day to do it); a repeat and a priority
 // are kept with it. `zone` turns a due day and time into an instant.
 function addTask(parsed,{courseId='personal',id,nowISO,zone}){
  if(parsed.at!==undefined&&parsed.at!==''&&(typeof parsed.at!=='string'||!TIME.test(parsed.at)))throw Error('Invalid planned time.');
  return data=>{
   if(!parsed.name)return;data.customTasks||=[];data.tasks||={};
   const due=parsed.due&&DAY.test(parsed.day||'')?instant(parsed.day,parsed.at||DUE_DEFAULT,zone):null,repeat=cleanRepeat(parsed.repeat);
   data.customTasks.push({id,name:parsed.name,courseId,dueAt:repeat?null:due,createdAt:nowISO,...(repeat?{repeat}:{})});
   const r=record(data.tasks,id);
   r.plannedDate=due&&!repeat?'':parsed.day||'';
   r.estimate=parsed.estimate||0;
   if(repeat&&DAY.test(r.plannedDate))r.repeatFrom=r.plannedDate;
   if(parsed.at&&r.plannedDate)r.plannedTime=parsed.at;if(parsed.priority==='high')r.priority='high';
  };
 }
 // Saved planner data from any earlier build, made whole: unknown or broken planner fields are dropped, nothing a
 // student wrote is. (Every build before 4.2 saved only plannedDate, plannedTime and estimate; they read as they did.)
 function migrate(data){
  if(!data||typeof data!=='object')return data;
  if(!Array.isArray(data.customTasks))data.customTasks=[];
  if(!data.tasks||typeof data.tasks!=='object'||Array.isArray(data.tasks))data.tasks={};
  for(const task of data.customTasks){
    if(!task||typeof task!=='object')continue;
    if(task.repeat!==undefined){const r=cleanRepeat(task.repeat);if(r)task.repeat=r;else delete task.repeat;}
  }
  for(const rec of Object.values(data.tasks)){
    if(!rec||typeof rec!=='object')continue;
    if(rec.plannedDate&&!DAY.test(rec.plannedDate))rec.plannedDate='';
    if(rec.plannedTime!==undefined&&!(rec.plannedDate&&TIME.test(rec.plannedTime)))delete rec.plannedTime;
    if(rec.priority!==undefined&&rec.priority!=='high')delete rec.priority;
    if(rec.repeatFrom!==undefined&&!validDay(rec.repeatFrom))delete rec.repeatFrom;
    if(rec.repeatLog!==undefined){
      const log=Array.isArray(rec.repeatLog)?rec.repeatLog.filter(x=>x&&DAY.test(x.day||'')).map(x=>({day:x.day,...(x.skip===true?{skip:true}:{})})).slice(-LOG):[];
      if(log.length)rec.repeatLog=log;else delete rec.repeatLog;
    }
  }
  return data;
 }
 const api={
   addDays,
   addMonths,
   weekdayOf,
   mondayOf,
   week,
   between,
   minutes,
   parseQuick,
   matchCourse,
   courseFor,
   cleanRepeat,
   repeatKey,
   repeatLabel,
   onRepeat,
   nextOn,
   anchorOf,
   instant,
   entries,
   day,
   board,
   range,
   span,
   byDay,
   isOverdue,
   plan,
   estimate,
   carryOver,
   priority,
   complete,
   uncomplete,
   setRepeat,
   remove,
   addTask,
   migrate,
   validDay,
   rename,
   setDue,
   setCourse,
   setNote,
   addStep,
   setStep,
   removeStep,
   planMany,
   NOTE_MAX,
   STEPS_MAX
 };
 root.ReservePlanner=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);

(function(R){if(!R)return;R.source('planner','planner','planner');R.source('reminders','reminders','reminder');})(globalThis.ReserveBiscuitRegistry);
