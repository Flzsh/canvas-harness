/* Biscuit's rule list: what a student means, read before anything else.
   Canvas's list is what exists, not what the student wants to do. So:
   1. What they say comes first. Work they name goes in their plan even when Canvas has never heard of it.
   2. Their day is theirs. A game, a shift or a practice is time the plan goes around.
   3. Asked what to do, answer with one thing and why, then at most two more. Never a list of everything.
   4. Long overdue work is not today's plan unless they ask for it.
   5. Answer the person. Tired, stuck or just saying hi is not a search.
   6. Say it the way a friend would: short, plain, no system words.
   Each rule is one kind of thing a student says; the first that fits answers. Anything else goes on to the engine. */
(function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null),list=v=>Array.isArray(v)?v:[],MIN=60000,DAY=86400000;
 const stamp=v=>{const n=typeof v==='number'?v:Date.parse(v);return Number.isFinite(n)?n:null;};
 // the way students type, spelled out once, so the rules read plainly
 function plain(line){
  return ' '+String(line||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[‘’']/g,'').replace(/[.,!?;]+/g,' ').replace(/\s+/g,' ').trim()+' ';
 }
 const SHORT=[
   [/ (?:im|i m) /g,' i am '],
   [/ (?:dont|don t) /g,' do not '],
   [/ (?:cant|can t) /g,' can not '],
   [/ (?:wont|won t) /g,' will not '],
   [/ (?:whats|what s|wats|wut is) /g,' what is '],
   [/ (?:wat|wut) /g,' what '],
   [/ (?:hows|how s) /g,' how is '],
   [/ (?:ive|i ve) /g,' i have '],
   [/ (?:tmrw|tmr|tmw|tomo|2moro|2mrw) /g,' tomorrow '],
   [/ (today|tonight|tomorrow|tmrw)s /g,' $1 '],
   [/ (?:tn|2nite|tonite) /g,' tonight '],
   [/ (?:hw|hmwk|homewrk) /g,' homework '],
   [/ (?:rn|atm) /g,' right now '],
   [/ (?:u|ya) /g,' you '],
   [/ (?:ur|youre|you re) /g,' you are '],
   [/ wanna /g,' want to '],
   [/ gotta /g,' have to '],
   [/ (?:gonna) /g,' going to '],
   [/ (?:idk|i dunno|dunno) /g,' i do not know '],
   [/ (?:pls|plz) /g,' please '],
   [/ (?:thx|ty|tysm) /g,' thanks '],
   [/ (?:mins|minute|minutes) /g,' min '],
   [/ (?:hrs|hr|hours) /g,' hour '],
   [/ an hour /g,' 1 hour '],
   [/ half an? hour /g,' 30 min ']
 ];
 function spell(line){let v=plain(line);for(let i=0;i<2;i++)for(const [a,b] of SHORT)v=v.replace(a,b);return v.replace(/\s+/g,' ');}
 const local=(s)=>load('CanvasHarnessAgentClock','./agent-clock.js')?.calendar?.(s.timeZone||'America/New_York');
 const clockText=(at,s)=>new Date(at).toLocaleTimeString('en-US',{timeZone:s.timeZone||'America/New_York',hour:'numeric',minute:'2-digit'});
 const dayName=(day)=>new Date(day+'T12:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long'});
 const addDays=(day,n)=>new Date(Date.parse(day+'T12:00Z')+n*DAY).toISOString().slice(0,10);
 const length=n=>n<60?n+' min':n%60?Math.floor(n/60)+' h '+n%60+' min':(n/60)+(n===60?' hour':' hours');
 const courseOf=(v,s)=>list(s.courses).find(c=>String(c.id)===String(v.courseId));
 const clockAt=n=>{const h=Math.floor(n/60)%24;return (h%12||12)+':'+String(n%60).padStart(2,'0')+(h<12?' AM':' PM');};
 const courseName=(v,s)=>{const c=courseOf(v,s);return c?.shortName||c?.name||'';};
 // What is still to do, Canvas's and the student's own, with how long it may take.
 function open(s){
  const mine=s.local?.tasks||s.local||{},rows=[...list(s.assignments),...list(s.workItems),...list(s.personalTasks),...list(s.customTasks)],seen=new Set(),out=[];
  for(const v of rows){
    const id=String(v.id??'');
    if(!id||seen.has(id))continue;
    seen.add(id);
    const my=mine[id]||{};
    if(v.done||v.completed||v.submitted||my.checkedOff||my.progress==='done'||['submitted','graded','pending_review','complete'].includes(String(v.state||'')))continue;
   const title=String(v.title||v.name||'').trim();if(!title)continue;const text=title+' '+String(v.kind||'');
   out.push({
     ...v,
     id,
     title,
     dueAt:stamp(v.dueAt??v.due),
     own:v.courseId==='personal'||v.personal===true,
     minutes:Number(my.estimate||v.estimate||v.minutes)||(/\b(?:essay|paper|project|lab|build)\b/i.test(text)?60:/\b(?:test|exam|quiz|reading)\b/i.test(text)?35:25)
   });}
  return out;
 }
 // Most useful next: their own work, what is due soonest, then what slipped this week. Long overdue work waits.
 function ranked(s){
   const now=stamp(s.now)||Date.now(),
     rows=open(s).filter(v=>v.own||v.dueAt===null||v.dueAt>=now-7*DAY),
     rank=v=>v.own?0:v.dueAt===null?3:v.dueAt>=now?(v.dueAt-now<=3*DAY?1:3):2;
   return rows.sort((a,b)=>rank(a)-rank(b)||(a.dueAt??Infinity)-(b.dueAt??Infinity));
 }
 function whyNow(v,s){
   const now=stamp(s.now)||Date.now();
   if(v.own)return 'it is on your own list';
   if(v.dueAt===null)return 'it has no due date yet';
   const days=Math.floor((v.dueAt-now)/DAY),
     cal=local(s),
     same=cal?cal(v.dueAt).day===cal(now).day:days===0,
     next=cal?cal(v.dueAt).day===addDays(cal(now).day,1):days===1;
   if(v.dueAt<now)return Math.max(1,Math.round((now-v.dueAt)/DAY))===1?'it was due yesterday':'it was due '+Math.round((now-v.dueAt)/DAY)+' days ago';
   return same?'it is due today':next?'it is due tomorrow':days<7?'it is due '+dayName(cal?cal(v.dueAt).day:new Date(v.dueAt).toISOString().slice(0,10)):'it is due in '+days+' days';
 }
 const firstUp=v=>v.charAt(0).toUpperCase()+v.slice(1);
 // Hours a student means: 1 to 7 with no am or pm is the afternoon or evening.
 function clockIn(q){
   if(/ noon /.test(q))return 720;
   const m=/ (?:at|by|from|around|until|till|after) (\d{1,2})(?::(\d{2}))? ?(am|pm)? /.exec(q)||/ (\d{1,2})(?::(\d{2}))? ?(am|pm) /.exec(q);
   if(!m)return null;
   let h=+m[1];
   const n=+(m[2]||0);
   if(h>23||n>59)return null;
   if(m[3]==='pm'&&h<12)h+=12;else if(m[3]==='am'&&h===12)h=0;else if(!m[3]&&h>=1&&h<=7)h+=12;
   return h*60+n;
 }
 const hhmm=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 // "5 to 7", "4-9", "3:30 to 5 pm", "9 to 5": the afternoon unless it says otherwise.
 function rangeIn(q){
   const m=/ (?:from )?(\d{1,2})(?::(\d{2}))? ?(am|pm)? ?(?:to|-|until|till) ?(\d{1,2})(?::(\d{2}))? ?(am|pm)? /.exec(q);
   if(!m||+m[1]>23||+m[4]>23||+m[2]>59||+m[5]>59)return null;
   const late=/ (?:tonight|this evening|evening) /.test(q),hour=(h,mark)=>mark==='pm'&&h<12?h+12:mark==='am'&&h===12?0:!mark&&h>=1&&h<=7?h+12:!mark&&late&&h<12?h+12:h;
   let from=hour(+m[1],m[3]),to=hour(+m[4],m[6]);
   if(to<=from&&to<12)to+=12;
   if(to<=from)return null;
   return [from*60+(+m[2]||0),to*60+(+m[5]||0)];
 }
 // Their name for it: "piano lesson", not "lesson".
 function eventName(q){
   const m=/ ([a-z]+) (lesson|practice|meeting|game|appointment|match|rehearsal|recital)s? /.exec(q);
   if(m&&!/^(?:a|an|the|my|and|then|have|at|got|for|around|this|next)$/.test(m[1]))return m[1]+' '+m[2];
   return (new RegExp('(?:'+EVENTS+')').exec(q)||[/ work/.test(q)?'work':'that'])[0].replace(/^at /,'');
 }
 // The open item a line names, by its words.
 function named(text,s){
   const only=courseOfLine(text,s),kind=kindOf(text);
   const words=String(text).split(' ').filter(w=>(w.length>3||w==='lab')&&!/^(?:this|that|with|from|have|done|thing|work|homework|tomorrow|tonight|today|already|please|mark|finished|completed|submitted|turned|handed|what|does|need|about|sunday|monday|tuesday|wednesday|thursday|friday|saturday|submit|upload)$/.test(w));
   let best=null,score=0,seen=0;
   const kindWords=/^(?:quiz|quizzes|test|exam|essay|paper|project|reading|report|homework|problem|worksheet|lab)$/;
   for(const v of open(s)){
     if(only&&String(v.courseId)!==String(only.id))continue;
     if(kind&&!isKind(v,kind))continue;
     seen++;
     const title=v.title.toLowerCase(),n=words.filter(w=>title.includes(w)).length,now=stamp(s.now)||Date.now(),soon=x=>x.dueAt===null?2:x.dueAt>=now?0:1;
     if(n>score||n===score&&n>0&&best&&(soon(v)<soon(best)||soon(v)===soon(best)&&soon(v)===0&&v.dueAt<best.dueAt)){best=v;score=n;}
   }
   if(!best&&only&&kind&&seen===1)best=open(s).find(v=>String(v.courseId)===String(only.id)&&isKind(v,kind))||null;
   if(best&&!only){
     const hit=words.filter(w=>best.title.toLowerCase().includes(w));
     if(hit.length&&hit.every(w=>kindWords.test(w))&&words.some(w=>!kindWords.test(w)&&!hit.includes(w)))return null;
   }
   return best;
 }
 const dueOn=(day,c)=>{const cal=local(c.s);return cal?open(c.s).filter(v=>v.dueAt!==null&&cal(v.dueAt).day===day).sort((a,b)=>a.dueAt-b.dueAt):[];};
 // What was just talked about.
 const lastOf=c=>open(c.s).find(v=>v.id===String(c.session?.lastItemId||c.session?.itemId||''))||null;
 const fresh=c=>!c.session?.lastItemId&&!c.session?.lastResult&&!c.session?.lastItems&&!c.session?.lastAction&&!c.session?.items?.length;
 const ASKS=/^ (?:what|how|when|where|why|who|which|is|are|does|did|can|could) /,HAVE=/^ (?:i have|we have|i got|i have got|we got) (?:a |an |some |my |this |the )?(?:[a-z0-9]+ ){0,3}?(?:homework|hw|reading|project|essay|paper|worksheet|report|lab|assignment|problems|packet)\b/,CHORE=/^ (?:do|finish|clean|wash|read|write|practice|practise) (?:my |the |a )?\S.* (?:tonight|today|tomorrow|this (?:evening|afternoon|morning)|(?:on )?(?:sun|mon|tues|wednes|thurs|fri|satur)day) $/;
 const dayIn=(q,s)=>{
   const cal=local(s),today=cal?cal(stamp(s.now)||Date.now()).day:null;
   if(!today)return '';
   if(/ (?:today|tonight|this evening|this afternoon) /.test(q))return today;
   if(/ tomorrow /.test(q))return addDays(today,1);
   const m=/ (?:on |by |this |next )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)? /.exec(q);
   if(!m)return '';
   const want=['sun','mon','tue','wed','thu','fri','sat'].findIndex(d=>m[1].startsWith(d)),now=new Date(today+'T12:00Z').getUTCDay();
   return addDays(today,((want-now+7)%7)||7);
 };
 const minutesIn=q=>{
   let m=/ (\d+(?:\.\d+)?) ?(?:hour|h) /.exec(q);
   if(m)return Math.round(+m[1]*60);
   m=/ (\d{1,3}) ?(?:min|m) /.exec(q);
   if(m)return +m[1];
   m=/ (\d{1,4}) pages? /.exec(q);
   if(m)return Math.min(240,+m[1]*2);
   m=/ (?:chapter|ch) \d+ /.exec(q);
   return m?30:0;
 };
 const whenWords=(day,at,s)=>{
   const cal=local(s),today=cal?cal(stamp(s.now)||Date.now()).day:'',name=!day?'':day===today?(at!==null&&at>=1020?'tonight':'today'):day===addDays(today,1)?'tomorrow':dayName(day);
   if(at===null)return name;
   const h=Math.floor(at/60),text=(h%12||12)+(at%60?':'+String(at%60).padStart(2,'0'):'')+(h<12?' am':' pm');
   return (name?name+' ':'')+'at '+text;
 };

 const STUDY='read|reading|write|writing|finish|study|do|work on|practice|practise|review|memorize|memorise|prepare|prep|start|complete|revise|edit|outline|draft|make|learn|solve|go over|look over|catch up on';
 const THINGS='homework|essay|paper|project|worksheet|reading|chapter|pages|problems|practice|test|quiz|exam|lab|notes|flashcards|vocab|application|tutoring|tutor|sat|act|ap |college';
 const EVENTS='swim practice|swimming|swim|robotics|cross country|track|wrestling|volleyball|debate|band|choir|orchestra|theater|theatre|drama|babysitting|volunteering|therapy|game|match|practice|rehearsal|meet|tournament|shift|at work|appointment|dentist|doctor|orthodontist|lesson|club|meeting|tutoring|dinner|party|concert|church|game night|recital|lacrosse|soccer|football|basketball|baseball|softball|hockey|tennis|swim|track|wrestling|volleyball|golf|robotics|debate|band|orchestra|choir';
 const HOURS_FOR=q=>/\b(?:game|match|tournament|meet|shift|work|job|party|concert)\b/.test(q)?120:90;
 const cleanName=t=>t.replace(/ (?:please|for me|today|tonight|tomorrow|this (?:evening|afternoon|morning|week)|on (?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*|(?:by|next|this) (?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*|(?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)|at \d{1,2}(?::\d{2})? ?(?:am|pm)?|\d{1,2}(?::\d{2})? ?(?:am|pm)|morning|afternoon|evening|for (?:an?|one|half an?) (?:hour|hr)|for \d+(?:\.\d+)? ?(?:hours?|hrs?|h|minutes?|mins?|m)|\d+(?:\.\d+)? ?(?:hours?|hrs?|minutes?|mins?)|due)(?= |$)/gi,' ').replace(/\s+/g,' ').trim().replace(/ (?:for|by|on|at|due|in)$/i,'');

 // Where things live in Make it yours.
 const WHERE=[[/ (?:bedtime|bed time) /,'Companion > Planning > Bedtime','pet'],[/ biscuits? /,'Companion','pet'],[/ (?:hide|unhide|show) (?:a |my |the |one )?(?:course|class|subject) /,'Courses > Course list','courses'],[/ (?:banner|course (?:art|picture|drawing)|course image) /,'Courses > Banner','courses'],[/ (?:course name|rename|nickname) /,'Courses > Course list','courses'],[/ (?:graphics|quality|lag|laggy|slow|faster|smoother) /,'Look > Graphics','look'],[/ (?:dark|light mode|night mode|theme) /,'Look > Light or dark','look'],[/ (?:scene|background|wallpaper) /,'Look > Scene','look'],[/ (?:accent|colou?r) /,'Look > Accent color','look'],[/ (?:font|text size|bigger text|smaller text|letters) /,'Look > Type','look'],[/ (?:strip|dock|rail|sidebar|where my courses|move my courses) /,'Home > Where your courses are','layout'],[/ (?:layout|home page|modules|widgets|rearrange) /,'Home','layout'],[/ (?:biscuit|pony|pet|companion|horse) /,'Companion','pet']];
 // Each rule: {id, when(q, line, ctx), answer(match, ctx)}.
 const say=(c,message,extra={})=>c.card('chat',[],{},message,{understanding:{step:'understanding',reason:'mind'},...extra});

 // Round 9 helpers: a feature switch, the one course a line names (the engine's course reader), and the app's own words.
 function featureOn(s,id){
   const f=s?.features;
   if(Array.isArray(f)){const row=f.find(v=>v&&v.id===id);return row?row.on!==false:false;}
   if(f&&typeof f==='object')return f[id]===true;
   return false;
 }
 function courseOfLine(line,s){
   const L=load('ReserveBiscuitLanguage','./biscuit-language.js');
   let r=null;
   try{r=L?.resolveCourses?.(String(line||''),s);}catch{return null;}
   const id=r&&!r.ambiguous&&r.courseId?String(r.courseId):'';
   if(id)return list(s.courses).find(v=>String(v.id)===id)||null;
   return r?.ambiguous?null:misspeltCourse(line,s);
 }
 // one or two letters off a course's nickname, short name or a word of its name; only when one course fits
 function editsWithin(a,b,max){
   if(Math.abs(a.length-b.length)>max)return false;
   const d=[];
   for(let i=0;i<=a.length;i++){d[i]=[i];for(let j=1;j<=b.length;j++)d[i][j]=i?0:j;}
   for(let i=1;i<=a.length;i++)
     for(let j=1;j<=b.length;j++){
       const cost=a[i-1]===b[j-1]?0:1;
       d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
       if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
     }
   return d[a.length][b.length]<=max;
 }
 const COMMON_WORD=/^(?:homework|quiz|quizzes|test|tests|essay|project|reading|lab|labs|grade|grades|class|course|teacher|today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|please|what|when|where|which|study|notes|focus|timer|plan|week|done|turn|open|show|hide|mark|remind|bookmark|calendar|inbox|messages|biscuit|graphics|scene|theme|module|widget|review|impact|room|files|slides|guide|unit|syllabus|policy|late|missing|answer|answers|about|there|their|would|could|should)$/;
 function misspeltCourse(line,s){
   const said=String(line||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>=4&&!COMMON_WORD.test(w));
   if(!said.length)return null;
   const hits=new Set();
   for(const c of list(s.courses)){
     const names=[c.nickname,c.shortName,c.course_code,...String(c.name||'').split(/[\s:\-]+/)].filter(Boolean).map(v=>String(v).toLowerCase()).filter(v=>v.length>=4&&/^[a-z]+$/.test(v));
     for(const w of said)for(const n of names)if(w!==n&&editsWithin(w,n,n.length>=6?2:1))hits.add(c);
   }
   return hits.size===1?[...hits][0]:null;
 }
 const R9_CH_THING=/ (?:pretend|clock|focus timer|to hand in|this week|bookmarks?|grade impact|paddock|course information|widgets?|modules?|my courses|courses (?:at|on|to)|cards? per day|new cards|pretend assignment|what ifs?|review deck|focus room|graphics|scene|dark mode|light mode|dock|layout|calculator) /;
 const R9_REFUSE=/ (?:answers? (?:to|for|of) |answer key|the answers |give me (?:the |all the )?answers?|tell me (?:the |all the )?answers?|solve (?:number |question |problem |q |no )?#? ?\d+ (?:on|in|for|of) |(?:do|take|finish|complete) (?:my|the|this) (?:quiz|test|exam)(?: for me)? |(?:change|fix|raise|bump|hack|edit) (?:my )?(?:grade|grades|score) |cheat on )/;
 const GADGETS=[
   ['hammer',/ hammer /,'Hammer'],
   ['laser',/ laser /,'Laser'],
   ['bomb',/ bomb /,'Bomb'],
   ['railgun',/ rail ?gun /,'Railgun'],
   ['blackhole',/ black ?hole /,'Black hole'],
   ['foil',/ foil /,'Foil'],
   ['painter',/ (?:painter|paint) /,'Painter'],
   ['garden',/ garden /,'Garden'],
   ['balloon',/ balloons? /,'Balloons'],
   ['gravity',/ gravity /,'Gravity'],
   ['portal',/ portals? /,'Portals'],
   ['eraser',/ eraser /,'Eraser'],
   ['magnet',/ magnet /,'Magnet'],
   ['ink',/ ink /,'Ink']
 ];
 const GADGET_RE=/^ (?:(?:open|use|try|start|launch|do|play|play with|give me|turn on)(?: the| a)? )?(?:hammer|laser|bomb|rail ?gun|black ?hole|foil|painter|garden|balloons?|gravity|portals?|eraser|magnet|ink)(?: gadget| tool| mode| thing)?(?: please)? $|^ (?:play with (?:this|the) page|play tools?|gadgets?|the gadgets|play mode|open (?:the )?gadgets|play tray) $/;
 const MODULE_KEYS=[['impact',/ grade impact /,'Grade impact'],['handin',/ (?:to )?hand ?in /,'To hand in'],['week',/ (?:this )?week /,'This week'],['timer',/ (?:focus )?timer /,'Focus timer'],['clock',/ clock /,'Clock'],['notes',/ notes? /,'Notes'],['bookmarks',/ bookmarks? /,'Bookmarks'],['grades',/ grades? /,'Grades'],['messages',/ messages? /,'Messages'],['pet',/ paddock /,'Paddock'],['review',/ review /,'Review'],['context',/ course info(?:rmation)? /,'Course information']];
 const MODULE_ADD=/^ (?:(?:add|put|show|bring back|get|give me|i want|turn on)(?: the| a| my)? )?(?:grade impact|(?:to )?hand ?in|this week|week|focus timer|timer|clock|notes?|bookmarks?|grades?|messages?|paddock|review|course info(?:rmation)?)(?: (?:widget|module|box|panel))?(?: (?:on|to) (?:my |the )?home(?: page)?)?(?: please)? $/;
 const VIEW_RE=/^ (?:show (?:me )?|open |go to |switch to |see |view )?(?:the |my )?(?:(?:week|weekly|all|up ?next|my plan|plan) (?:view|tab|list|page)|(?:today|todays) view|up ?next|all (?:my )?ass?ignm?e?n?t?s|every assignment|all (?:of )?my work)(?: please)? $|^ (?:switch|change|set|put) (?:the |my )?ass?ignm?e?n?t?s(?: page| view| list)? to (?:the )?(?:week|weekly|all|up ?next|today|my plan|plan)(?: view)? $/;

 const R9_SETTINGS=[
  [/ (?:bigger|larger|large|big) (?:text|letters|font|words)| (?:text|font|letters) (?:bigger|larger|large|big) /,'textSize',()=>'large','Text size: Larger.'],
  [/ (?:smaller|normal|standard|regular|small) (?:text|letters|font size)| (?:text|font|letters) (?:smaller|normal size|standard|regular) /,'textSize',()=>'standard','Text size: Standard.'],
  [/ (?:easy ?read|easier to read|dyslexi[a-z]*) (?:font|text|reading)?| reading (?:font|text) (?:easy|easy read) /,'readingFont',()=>'easy','Reading text: Easy read.'],
  [/ (?:book serif|serif) (?:reading|for reading)| reading (?:font|text) (?:book|serif|book serif) /,'readingFont',()=>'book','Reading text: Book serif.'],
  [/^ (?:motion|animations?|movement) (?:off|still|on|gentle|fades?(?: only)?)(?: please)? $|^ (?:turn )?(?:off|stop) (?:all )?(?:the )?(?:motion|animations?)(?: please)? $|^ (?:no|less) (?:motion|animations?) $/,'motion',q=>/ (?:on|gentle) /.test(q)?'gentle':/ (?:fades?|less|still) /.test(q)?'still':'off','Motion set.'],
  [/^(?!.* (?:enable|disable|feature|motion|allow|active|mute|away) ).* (?:living drawings|drawings (?:moving|move|keep moving)|stop the drawings|still drawings|drawings still|moving drawings) /,'livingArt',q=>/ (?:stop|off|still|no|turn off|hide) /.test(q)?'off':'on','Living drawings set.'],
  [/ (?:night art|artwork at night|art at night|night artwork) /,'nightArt',q=>{const n=/ (\d{1,3}) ?(?:%|percent)? /.exec(q);return n&&+n[1]<=100?+n[1]:/ paper /.test(q)?100:/ chalk /.test(q)?0:null;},'Artwork at night set.'],
  [/ (?:pen|pen line|stitched|stitch|card|thin rule|rule|no|none) (?:module )?(?:outline|outlines|frame|frames|border|borders) | (?:module )?(?:outline|outlines|module frame) (?:pen|pen line|stitched|stitch|card|thin rule|rule|line|none|no) /,'panelFrame',q=>/ stitch/.test(q)?'stitch':/ (?:thin rule|rule|line) /.test(q)&&!/ pen line /.test(q)?'line':/ card /.test(q)?'card':/ (?:no|none) /.test(q)?'none':'pen','Module outline set.'],
  [/ banner (?:size )?(?:tall|taller|big|bigger|large|small|smaller|short|compact|medium|normal)| (?:tall|taller|big|bigger|large|small|smaller|short|compact|medium) banners? /,'bannerSize',q=>/ (?:tall|taller|big|bigger|large) /.test(q)?'large':/ (?:small|smaller|short|compact) /.test(q)?'compact':'standard','Banner size set.']
 ];
 const R9_SKILLS=[['quiz',/ quiz prep /],['labprep',/ lab prep /],['reading',/ reading helper /],['rubric',/ rubric helper /],['feedback',/ feedback helper /],['deadline',/ deadline watch /],['planner',/ planner help /],['focus',/ focus buddy /],['wellbeing',/ wellbeing /],['night',/ night owl(?: guard)? /],['inbox',/ inbox watch /]];

 // Round 9: the kind of work a line names, read against the item's title and kind
 const R9_KINDS=[[/ (?:homework|hw|problem set|pset|worksheet) /,/\b(?:problem set|homework|practice set|worksheet|hw)\b/i,'homework'],[/ (?:quiz|quizzes) /,/\bquiz/i,'quiz'],[/ (?:test|exam|midterm|final) /,/\b(?:test|exam|midterm|final)\b/i,'test'],[/ (?:lab|lab report|labs) /,/\blab\b/i,'lab'],[/ (?:essay|paper) /,/\b(?:essay|paper)\b/i,'essay'],[/ (?:project|proj) /,/\bproject/i,'project'],[/ (?:reading|rdg|chapter|packet) /,/\b(?:reading|chapter|packet)\b/i,'reading']];
 function kindOf(text){const t=' '+String(text).trim()+' ';return R9_KINDS.find(([said])=>said.test(t))||null;}
 let KIND_GROUPS=new Map();
 const groupOf=v=>
   String(v.assignmentGroup?.name||v.assignmentGroupName||v.groupName||KIND_GROUPS.get(String(v.assignmentGroupId??v.assignment_group_id??''))||'').replace(/(\w)s\b/g,'$1');
 const isKind=(v,k)=>!k||k[1].test(String(v.title||v.name||''))||String(v.workKind||v.kind||v.genre||'').toLowerCase()===k[2]||!!groupOf(v)&&k[1].test(groupOf(v));
 // Which items a line means: title words first (in the named course when the line names one), else that course's items of the named kind.
 function pickByKind(c,stop){
   const only=courseOfLine(c.line,c.s),
     kind=kindOf(c.q),
     all=[...list(c.s.assignments),...list(c.s.workItems)].filter((v,i,a)=>v&&a.findIndex(w=>String(w.id)===String(v.id))===i),
     title=v=>String(v.title||v.name||'').toLowerCase(),
     courseWord=w=>!!only&&[only.shortName,only.nickname,only.name].filter(Boolean).some(n=>String(n).toLowerCase().includes(w)),
     words=c.q.split(' ').filter(w=>w.length>3&&!stop.test(w)&&!courseWord(w)&&!(kind&&kind[0].test(' '+w+' '))),
     inCourse=v=>!only||String(v.courseId)===String(only.id),
     titled=words.length?all.filter(v=>words.every(w=>title(v).includes(w))&&isKind(v,kind)):[],
     here=titled.filter(inCourse),
     mine=titled.length?(here.length?here:titled):only&&kind?all.filter(v=>inCourse(v)&&isKind(v,kind)):[],
     own=mine.filter(v=>title(v).split(/[^a-z0-9]+/).filter(w=>w.length>3).some(w=>words.includes(w)));
   return {only,kind,pick:own.length===1?own:mine};
 }
 const isTurnedIn=v=>v.submitted===true||['submitted','graded','pending_review','complete'].includes(String(v.state||''));
 const isGraded=v=>String(v.state||'')==='graded'||stamp(v.gradedAt)!==null;
 // "due Sat" for what is ahead, "was due Oct 31" for what is past
 function dueWord(v,s){
   const now=stamp(s.now)||Date.now(),at=stamp(v.dueAt),zone=s.timeZone||'America/New_York';
   return at===null?
     'no due date':
     at>=now?'due '+new Date(at).toLocaleDateString('en-US',{timeZone:zone,weekday:'short'}):'was due '+new Date(at).toLocaleDateString('en-US',{timeZone:zone,month:'short',day:'numeric'});
 }
 // open (not yet X) first: ahead before past, nearest due first; the done ones after, in due order
 function openFirst(rows,isDone,s){
   const now=stamp(s.now)||Date.now(),at=v=>stamp(v.dueAt),rank=v=>at(v)===null?2:at(v)>=now?0:1;
   return {
     waiting:rows.filter(v=>!isDone(v)).sort((a,b)=>rank(a)-rank(b)||(at(a)??Infinity)-(at(b)??Infinity)),
     done:rows.filter(isDone).sort((a,b)=>(at(a)??0)-(at(b)??0))
   };
 }
 const kindWords=(kind,n)=>!kind?(n===1?'item':'items'):n===1?kind[2]:({quiz:'quizzes',homework:'homework sets'}[kind[2]]||kind[2]+'s');

 const R10_HELP=[[/ (?:mock|practice|fake|sample|drills?|prep for|quiz me|test me|study for) /,'practice'],[/ (?:polish|proofread|edit|fix up|improve|clean up) /,'fixes'],[/ (?:outline|structure|organi[sz]e|plan out) /,'outline'],[/ (?:flash ?cards|study cards) /,'flashcards'],[/ (?:summary|summari[sz]e|tldr|gist|sum up) /,'summary'],[/ (?:step by step|walk me through|walkthrough) /,'steps'],[/ (?:help with|help me with|stuck on|stuck|lost on|lost|confused|confusing|confuses me|dont get|do not get|no idea how|how do i start|how to start|dont know how to start|do not know how to start|makes no sense) /,'ask']];

 const R10_PAGES=[
   ['bookmarks',c=>c.card('navigate',[],{tab:'bookmarks'},'Bookmarks.')],
   ['calendar',c=>c.card('navigate',[],{tab:'calendar'},'Calendar.')],
   ['grades',c=>c.card('navigate',[],{tab:'grades'},'Grades.')],
   ['materials',c=>c.card('navigate',[],{tab:'materials'},'Materials.')],
   ['planner',c=>c.card('navigate',[],{tab:'planner'},'Planner.')],
   ['inbox',c=>c.card('navigate',[],{tab:'messages'},'Inbox.')],
   ['calculator',c=>c.card('none',[],{},'Open Tools > Calculator.',{ui:{path:['Tools','Calculator']}})]
 ];
 const R10_REFUSE=/^ (?:(?:can|could|will|would) (?:you|u) (?:just |please )?|please |pls |just |(?:i need|i want) (?:you|u) to )?(?:write|do(?! (?:i|we|you|u) )|finish|fill (?:in|out)|complete|take|answer|solve) (?:the |my |this |all (?:the |my )?)?(?:\S+ ){0,3}?(?:for me|essay|dbq|write ?up|lab report|report|worksheet|discussion post|quiz|test|exam|hw|homework|problems?|questions?|assignment|paper|project)(?: for me)?(?: please| pls| now)? $| (?:if you just|can you just|just) (?:write|do|finish) (?:the |my |this )?/;
 const R10_ERRAND=/ (?:post (?:this|it|that) (?:on|to) (?:my )?(?:insta|instagram|tiktok|snap|snapchat|twitter|x|facebook)|book (?:a |an |me a |me an )?(?:dentist|doctor|haircut|appointment|table|flight)|order (?:me )?(?:an? )?(?:uber|lyft|ride|food|pizza|coffee)|score of the (?:game|match)|who won the (?:game|match)|weather (?:today|tomorrow|tonight)) /;
 const R10_RULES=/ (?:(?:give|add) me (?:\d+ )?(?:extra credit|free) points|extra credit points|make my (?:late|missing) \S+ (?:say|look|show) (?:on time|submitted|done)|(?:delete|remove|erase|hide) (?:all )?my (?:missing|late|zero) (?:assignments|work|grades)|change (?:my )?(?:late|missing) .* to on time) /;
 // T2 (2026-11-16): a tool by its name, and the tests ahead. General readings over the words a line is made of; the
 // first is "a tool named alone or with open / show / use", the second "a line made only of test words, time words,
 // question words and a course name (or a test's own name words)".
 const T2_TOOLS=[
  ['calculator','graphing',/^(?:desmos(?: graphing| graph)?(?: calc(?:ulator)?s?)?|graphing (?:calc(?:ulator)?s?|tool)|graph(?:ing)? calc(?:ulator)?s?|grapher|graphing)$/],
  ['calculator','scientific',/^(?:sci(?:entific)? calc(?:ulator)?s?|desmos sci(?:entific)?(?: calc(?:ulator)?s?)?|scientific)$/],
  ['calculator','',/^(?:calculator|calculators|calc|calcs|calculater|calulator|calcualtor|calcuator|caculator|calc tool|calculator tool)$/],
  ['gpa','',/^(?:gpa|gpa calc(?:ulator)?|gpa tool|grade point average(?: calc(?:ulator)?)?)$/],
  ['quick','',/^(?:quick ?open|quick search|ctrl k|command k|cmd k)$/]
 ];
 const T2_TOOL_LABEL={calculator:{graphing:'Graphing calculator',scientific:'Scientific calculator','':'Calculator'},gpa:{'':'GPA calculator'},quick:{'':'Quick open'}};
 const T2_TOOL_PLACE={calculator:'Calculator',gpa:'GPA',quick:'Quick open'};
 function t2ToolOf(text){let t=String(text).trim();
  for(let i=0;i<3;i++)t=t.replace(/^(?:(?:can|could|would|will) (?:you|i) (?:please )?|please |hey |yo |ok |okay |biscuit |i (?:need|want)(?: to (?:use|open|see|get))? |let me (?:use|open|see|get) |lemme (?:use|open|see|get) )/,'');
  t=t.replace(/^(?:open|show|use|pull up|bring up|get|launch|start|give me|grab|go to|take me to|switch to|bring)(?: me)?(?: up)? /,'').replace(/^(?:the|a|an|my|up the|up) /,'');
  for(let i=0;i<2;i++)t=t.replace(/ (?:please|now|right now|thanks|real quick|for me|again|quick|thx)$/,'');
  for(const [tool,mode,re] of T2_TOOLS)if(re.test(t))return {tool,mode,said:t};return null;}
 const T2_TOOL_WHERE=/^ (?:where (?:is|are|s|do i find|can i find|do i get|can i get|do i open|can i open|would i find)|how (?:do|can|could|would|should) (?:i|you) (?:open|use|get to|find|get|pull up|bring up|access|see|reach)|how to (?:open|use|find|get to|get)|whereabouts is|where would) (.+?) $/;
 // on when no feature list is given; off only when the list says so
 function t2On(s,id){
   const f=s?.features;
   if(Array.isArray(f)){const row=f.find(v=>v&&v.id===id);return row?row.on!==false:true;}
   if(f&&typeof f==='object'&&Object.hasOwn(f,id))return f[id]!==false;
   return true;
 }
 function t2ToolAnswer(t,c,where){
  const label=T2_TOOL_LABEL[t.tool][t.mode||'']||T2_TOOL_LABEL[t.tool][''],
    path=['Tools',T2_TOOL_PLACE[t.tool],...(t.mode?[t.mode==='scientific'?'Scientific':'Graphing']:[])],
    fields={tool:t.tool,...(t.mode?{mode:t.mode}:{})};
  const fname=id=>String((Array.isArray(c.s.features)?c.s.features.find(f=>f?.id===id)?.name:'')||{tools:'Quick open & study tools',gpa:'GPA calculator'}[id]),
    off=!t2On(c.s,'tools')?fname('tools'):t.tool==='gpa'&&!t2On(c.s,'gpa')?fname('gpa'):'';
  if(off)return c.card('none',[],{},label+' is in '+path.join(' > ')+', but '+off+' is off. Turn it on in Make it yours, under Settings.',{ui:{path:['Make it yours','Settings',off]}});
  if(where)return c.card('none',[],{},path.join(' > ')+'. Open it from the Tools button, or press Open.',{ui:{path},open:{label:'Open',intent:'navigate',fields}});
  return c.card('navigate',[],fields,(t.tool==='calculator'?'Open the '+label.toLowerCase():'Open '+label)+'.',{tool:{...fields,label}});
 }
 // "calc" alone is a course when one is called that (Calc, Calculus); then the tool waits for "calculator"
 function t2CalcIsCourse(said,line,s){
   if(!/^calcs?$/.test(said))return false;
   if(courseOfLine(line,s))return true;
   return list(s.courses).some(v=>[v.nickname,v.shortName,v.course_code,v.name].filter(Boolean).some(n=>String(n).toLowerCase().split(/[^a-z0-9]+/).some(w=>/^calc/.test(w))));
 }

 // ---- tests ahead
 const T2_TEST_WORD=/^(?:tests?|tst|quiz(?:z?es)?|quizz|quizes|qz|exams?|exm|midterms?|mid ?terms?|finals?|assessments?|assesments?)$/;
 // the kind a title, kind field, assignment group or Canvas quiz gives; corrections, reviews and study guides are not tests
 function t2TestKind(v,groupName=''){
  const title=String(v?.title||v?.name||''),m=/\b(midterms?|mid-terms?|finals?|exams?|exm|tests?|quiz(?:z?es)?|quizz|qz|assessments?)\b/i.exec(title);
  if(m){const w=m[1].toLowerCase(),after=title.slice(m.index+m[0].length);
   if(/^finals?$/.test(w)&&/^\s*[:\-]?\s*(?:draft|project|essay|paper|presentation|grade|copy|version|reflection|submission|portfolio|lab|report|product|piece|revision|round|answer|outline|proposal|performance|video|recording)\b/i.test(after))return null;
   if(/\b(?:corrections?|review|study guide|prep|preparation|reflection|wrapper|analysis|answer key|notes|sign ?up|feedback|results?|make ?up form|retake form|redo form)\b/i.test(after)||/\b(?:corrections?|study guide|answer key|wrapper|reflection|sign ?up)\b/i.test(title))return null;
   return /^mid/.test(w)?'midterm':/^final/.test(w)?'final':/^(?:exams?|exm)$/.test(w)?'exam':/^(?:quiz|qz)/.test(w)?'quiz':'test';}
  const k=String(v?.workKind||v?.kind||v?.genre||'').toLowerCase();if(['quiz','test','exam','midterm','final'].includes(k))return k;
  // a group says test only for work whose title names no other kind (an essay outline in a "Tests" group is an essay)
  const g=String(v?.assignmentGroup?.name||v?.assignmentGroupName||v?.groupName||groupName||'');
  if(/\b(?:tests?|quiz(?:z?es)?|exams?|assessments?|summatives?)\b/i.test(g)&&!/\b(?:essay|outline|lab|project|paper|presentation|worksheet|homework|hw|problem set|practice|reading|analysis|journal|report|draft|discussion|reflection|poster|portfolio|video|recording|notes|investigation|set|dialogue|build)\b/i.test(title))return /quiz/i.test(g)&&!/test|exam|assess/i.test(g)?'quiz':/exam/i.test(g)&&!/test|quiz|assess/i.test(g)?'exam':'test';
  if((v?.quizId||v?.quiz||list(v?.submissionTypes).includes('online_quiz'))&&!/survey/i.test(String(v?.quiz?.quizType||v?.quiz?.quiz_type||'')))return 'quiz';
  return null;
 }
 const T2_MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],T2_DAYS=['sun','mon','tue','wed','thu','fri','sat'];
 const t2Plain=v=>String(v||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
 // the one day a sentence of an announcement names, read against the day it was posted; null when it names none or two
 function t2AnnouncedDay(sentence,postedDay){
  const low=' '+sentence.toLowerCase().replace(/[,.!?;()]/g,' ')+' ';let explicit=null;
  const md=/ (jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]* (\d{1,2})(?:st|nd|rd|th)? /.exec(low),num=/ (\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))? /.exec(low);
  const pick=(mo,d,y)=>{
    if(mo<1||mo>12||d<1||d>31)return null;
    const py=+postedDay.slice(0,4);
    for(const year of y?[y<100?2000+y:y]:[py,py+1,py-1]){
      const day=year+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'),diff=(Date.parse(day+'T12:00Z')-Date.parse(postedDay+'T12:00Z'))/DAY;
      if(!Number.isFinite(diff)||new Date(day+'T12:00Z').getUTCDate()!==d)continue;
      if(y||diff>=-3&&diff<=200)return day;
    }
    return null;
  };
  if(md)explicit=pick(T2_MONTHS.indexOf(md[1].slice(0,3))+1,+md[2],null);
  if(num){const n=pick(+num[1],+num[2],num[3]?+num[3]:null);if(explicit&&n&&n!==explicit)return null;explicit=explicit||n;}
  const wd=/ (?:on |this |next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat) /.exec(low),rel=/ (today|tomorrow) /.exec(low);
  let weekday=null;
  if(wd){
    const want=T2_DAYS.findIndex(d=>wd[1].startsWith(d)),from=new Date(postedDay+'T12:00Z').getUTCDay();
    if(/ next (?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat) /.test(low)&&!explicit)return null;
    weekday=explicit?null:addDays(postedDay,((want-from+7)%7)||7);
    if(explicit&&new Date(explicit+'T12:00Z').getUTCDay()!==want)return null;
  }
  const relative=rel?addDays(postedDay,rel[1]==='today'?0:1):null;
  const days=[explicit,weekday,relative].filter(Boolean);return days.length&&days.every(d=>d===days[0])?days[0]:null;
 }
 function t2AnnouncedClock(sentence){
   const m=/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i.exec(sentence);
   if(!m||+m[1]>12)return null;
   let h=+m[1]%12;
   if(/^p/i.test(m[3]))h+=12;
   return h*60+(+m[2]||0);
 }
 // what a student sits as a test, from Canvas work, their own list, calendar events and recent announcements
 function t2Tests(s){
  const out=[],
    seen=new Set(),
    mine=s.local?.tasks||s.local||{},
    cal=local(s),
    now=stamp(s.now)||Date.now(),
    groups=new Map(list(s.assignmentGroups).map(g=>[String(g.id),String(g.name||'')]));
  for(const v of [...list(s.assignments),...list(s.workItems),...list(s.quizzes),...list(s.personalTasks),...list(s.customTasks)]){
    const id=String(v?.id??'');
    if(!id||seen.has(id))continue;
    seen.add(id);
    const my=mine[id]||{};
    if(v.done||v.completed||v.submitted===true||my.checkedOff||my.progress==='done'||['submitted','graded','pending_review','complete'].includes(String(v.state||'')))continue;
    const kind=t2TestKind(v,groups.get(String(v.assignmentGroupId??v.assignment_group_id??''))||'');
    if(!kind)continue;
    out.push({
      ...v,
      id,
      title:String(v.title||v.name||'').trim(),
      dueAt:stamp(v.dueAt??v.due),
      testKind:kind,
      testSource:v.courseId==='personal'||v.personal===true||v.localOnly===true?'own':'canvas'
    });
  }
  for(const e of [...list(s.events),...list(s.calendarEvents),...list(s.calendar)]){
    const id=String(e?.id??'');
    if(!id||seen.has(id))continue;
    seen.add(id);
    const kind=t2TestKind({title:e.title||e.name});
    if(!kind)continue;
    const at=stamp(e.start??e.startAt??e.start_at);
    out.push({
      id,
      title:String(e.title||e.name).trim(),
      name:String(e.title||e.name).trim(),
      courseId:e.courseId!=null?String(e.courseId):undefined,
      dueAt:at,
      url:e.url||e.html_url,
      location:e.location,
      kind:'event',
      testKind:kind,
      testSource:'event'
    });
  }
  if(cal)
    for(const a of list(s.announcements)){
      const posted=stamp(a?.postedAt??a?.posted_at??a?.createdAt??a?.created_at);
      if(posted===null||posted>now||now-posted>21*DAY)continue;
      const postedDay=cal(posted).day,text=t2Plain(a.title)+'. '+t2Plain(a.body||a.message||a.description||'');
   for(const sentence of text.split(/(?<=[.!?])\s+/)){
     const kind=t2TestKind({title:sentence});
     if(!kind)continue;
     const day=t2AnnouncedDay(sentence,postedDay);
     if(!day)continue;
     const minute=t2AnnouncedClock(sentence),wall=load('CanvasHarnessAgentClock','./agent-clock.js')?.wall,at=wall?wall(day,minute??720,s.timeZone||'America/New_York'):null;
     if(!Number.isFinite(at))continue;
    const named=/((?:(?:unit|chapter|ch|module|lesson|section|part|week)\s*\d+[a-z]?\s+)?(?:[a-z]+\s+)?(?:test|quiz|exam|midterm|final))/i.exec(sentence)?.[1]||kind;
    const title=named.charAt(0).toUpperCase()+named.slice(1);
    out.push({
      id:String(a.id),
      title,
      name:title,
      courseId:a.courseId!=null?String(a.courseId):undefined,
      dueAt:at,
      dayOnly:minute===null,
      url:a.url||a.html_url,
      kind:'announcement',
      testKind:kind,
      testSource:'announcement',
      from:t2Plain(a.title)
    });
    break;
   }}
  // a calendar event or an announcement that repeats a Canvas test of the same course and day is that test
  const dayOf=at=>cal&&at!==null?cal(at).day:'';
  return out.filter(v=>
    v.testSource==='canvas'||
      v.testSource==='own'||
      !out.some(w=>(w.testSource==='canvas'||w.testSource==='own')&&String(w.courseId)===String(v.courseId)&&w.dueAt!==null&&v.dueAt!==null&&dayOf(w.dueAt)===dayOf(v.dueAt)));
 }
 const T2_FILLER=new Set('upcoming up coming comin ahead soon next any anything when wen whens what whats which is are s day days date dates time do does did i have got gotten there how many much list all my the a an our this that week wk weekend tomorrow today tonight morning afternoon evening later left scheduled on for in of at until till before by show me see check tell get please biscuit again still yet so far rest remaining else other more we will be am it its going to ive ok okay hey hi um like kinda due class course classes courses or and lined planned set'.split(' '));
 const T2_DAYWORD=/^(?:sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)$/;
 const T2_NOT=/ (?:quiz me|test me|drill me|quiz us|test us|practice (?:test|quiz|exam|questions?)|practise|study|studying|prep|prepare|preparing|review|revise|revising|flash ?cards?|help|explain|teach|make|write|create|generate|mock|sample|answers?|answer key|cheat|solve|need on|need to get|get on|got on|score|scored|grade|graded|grades|points|worth|weight|weighted|percent|average|what if|finished|done with|took|taking|did i|submit|submitted|turn in|turned in|hand in|handed in|retake|corrections?|remind|reminder|bookmark|pin|plan|schedule it|move|time limit|how long is|how long will|how many questions|attempts?|tries|rubric|feedback|results|nervous|scared|worried|stressed|failed|fail|pass|passed) /;
 // the words of a line that are not filler, time, test or course words: they must name a test (its own title words)
 function t2Reading(q,line,c){
  if(/^ (?:i|we) (?:have|got|have got|ve got) /.test(q)||/^ (?:take|open|start|begin|redo|launch|focus|plan|remind|mark|bookmark) /.test(q)||/^ do (?!i |we |you )/.test(q)||T2_NOT.test(q))return null;
  const words=q.trim().split(' ').filter(Boolean);if(!words.length||words.length>12)return null;
  const testWords=words.filter(w=>T2_TEST_WORD.test(w));if(!testWords.length)return null;
  const found=t2Course(line,c.s);if(found.ambiguous)return null;const course=found.course||null,courseWords=new Set();
  if(course)
    for(const n of [course.nickname,course.shortName,course.course_code,course.name,...list(course.aliases)].filter(Boolean))
      for(const w of String(n).toLowerCase().split(/[^a-z0-9]+/))if(w)courseWords.add(w);
  const rest=words.filter(w=>
    !T2_TEST_WORD.test(w)&&
      !T2_FILLER.has(w)&&
      !T2_DAYWORD.test(w)&&
      !courseWords.has(w)&&
      !(course&&[...courseWords].some(n=>n.length>=4&&(n.startsWith(w)&&w.length>=3||editsWithin(w,n,n.length>=6?2:1)))));
  // a line that names a course the resolver could not read (or another word) fires only when a test's title has the word
  const tests=t2Tests(c.s),named=rest;
  let subject='';
  if(named.length&&!tests.some(v=>named.every(w=>new RegExp('\\b'+w.replace(/[^a-z0-9]/g,'')+'\\b','i').test(v.title)))){
    const L=load('ReserveBiscuitLanguage','./biscuit-language.js');
    let refs=[];
    try{refs=list(L?.analyze?.(String(line))?.references).filter(x=>list(x.targets).length).map(x=>String(x.phrase).toLowerCase());}catch{refs=[];}
    const said=new Set(refs.flatMap(x=>x.split(/\s+/)));
    if(course||found.weak||!named.every(w=>said.has(w)))return null;
    subject=named.join(' ');
  }
  const kinds=new Set(testWords.map(w=>/^(?:quiz|qz)/.test(w)?'quiz':/^mid/.test(w)?'midterm':/^final/.test(w)?'final':/^(?:exam|exm)/.test(w)?'exam':'test'));
  // "final exam", "midterm test": the final, the midterm
  if(kinds.has('final')||kinds.has('midterm')){kinds.delete('exam');kinds.delete('test');}
  // "my chem test" (one course, the word test said once) means its tests and exams when it has any, not its quizzes
  const one=!!course&&testWords.length===1&&/^(?:test|tst)$/.test(testWords[0]);
  return {course,named:subject?[]:named,subject,kinds,tests,one};
 }
 // a course the line names by its name, nickname, code or subject (not by words that only appear in its items)
 // two courses that carry the word the line says as a nickname, short name or code ("geo": Geography's nickname and
 // Geometry's code): Biscuit asks which, as before
 function t2AliasCollision(line,s){
   const said=' '+String(line||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' ';
   let n=0;
   for(const v of list(s.courses)){
     const names=[v.nickname,v.shortName,v.course_code,...list(v.aliases)].filter(Boolean).map(x=>String(x).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()).filter(x=>x.length>=3);
     if(names.some(x=>said.includes(' '+x+' ')))n++;
   }
   return n>1;
 }
 function t2Course(line,s){
   if(t2AliasCollision(line,s))return {ambiguous:true};
   const L=load('ReserveBiscuitLanguage','./biscuit-language.js');
   let r=null;
   try{r=L?.resolveCourses?.(String(line||''),s);}catch{r=null;}
   const named=m=>m&&(m.nameMatch>0||m.nameExact>0||m.abbreviation>0);
   if(r&&!r.ambiguous&&r.courseId){
     const m=list(r.matches).find(v=>String(v.courseId??v.id)===String(r.courseId));
     if(named(m))return {course:list(s.courses).find(v=>String(v.id)===String(r.courseId))||null};
   }
   if(r?.ambiguous||list(r?.matches).filter(named).length>1)return {ambiguous:true};
   const miss=misspeltCourse(line,s);
   return {course:miss,weak:!miss&&list(r?.matches).length>0};
 }
 function t2Window(q,s){
  const cal=local(s),now=stamp(s.now)||Date.now();if(!cal)return {from:now,to:now+14*DAY,label:'in the next two weeks',span:'ahead'};
  const today=cal(now).day,
    wall=(day,minute)=>load('CanvasHarnessAgentClock','./agent-clock.js')?.wall?.(day,minute,s.timeZone||'America/New_York'),
    start=day=>wall(day,0),
    end=day=>wall(addDays(day,1),0),
    dow=new Date(today+'T12:00Z').getUTCDay();
  if(/ (?:today|tonight) /.test(q))return {from:now,to:end(today),label:'today',span:'day',day:today};
  if(/ tomorrow /.test(q)){const d=addDays(today,1);return {from:start(d),to:end(d),label:'tomorrow',span:'day',day:d};}
  const wd=/ (?:on |this |next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat) /.exec(q);
  if(wd&&!/ (?:week|wk) /.test(q)){
    const want=T2_DAYS.findIndex(d=>wd[1].startsWith(d)),ahead=(want-dow+7)%7,d=addDays(today,ahead===0&&/ next /.test(q)?7:ahead),also=ahead===0&&!/ next /.test(q)?addDays(today,7):null;
    return {from:d===today?now:start(d),to:end(d),label:dayName(d),span:'day',day:d,also};
  }
  // a week runs Monday to Sunday; at the weekend "this week" and "next week" mean the coming one
  const weekend=dow===0||dow===6,monday=addDays(today,dow===0?1:dow===6?2:1-dow);
  if(/ next (?:week|wk) /.test(q)){const m=weekend?monday:addDays(monday,7);return {from:start(m),to:end(addDays(m,6)),label:'next week',span:'week'};}
  if(/ (?:this|the) (?:week|wk) | (?:week|wk) $/.test(q))return {from:now,to:end(addDays(monday,6)),label:'this week',span:'week'};
  return {from:now,to:now+14*DAY,label:'in the next two weeks',span:'ahead'};
 }
 const T2_KIND_WORD={quiz:['quiz','quizzes'],exam:['exam','exams'],midterm:['midterm','midterms'],final:['final','finals'],test:['test','tests']};
 function t2KindFits(kinds,v){
   if(kinds.has('test'))return true;
   if(kinds.has('quiz')&&v.testKind==='quiz')return true;
   if(kinds.has('exam')&&['exam','midterm','final','test'].includes(v.testKind))return true;
   if(kinds.has('midterm')&&v.testKind==='midterm')return true;
   if(kinds.has('final')&&v.testKind==='final')return true;
   return false;
 }
 function t2When(v,s,{year=false}={}){
   if(v.dueAt===null)return '';
   const zone=s.timeZone||'America/New_York',
     cal=local(s),
     now=stamp(s.now)||Date.now(),
     today=cal?cal(now).day:'',
     day=cal?cal(v.dueAt).day:'',
     diff=today&&day?Math.round((Date.parse(day+'T12:00Z')-Date.parse(today+'T12:00Z'))/DAY):null;
  const name=diff===0?'today':diff===1?'tomorrow':new Date(v.dueAt).toLocaleDateString('en-US',{timeZone:zone,weekday:'long',month:'short',day:'numeric',...(year?{year:'numeric'}:{})});
  return name+(v.dayOnly?'':' at '+new Date(v.dueAt).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}));}
 function t2Name(v,s){
   const c=courseOf(v,s),short=c?.shortName||c?.nickname||c?.name||'';
   return v.title+(short&&!v.title.toLowerCase().includes(String(short).toLowerCase())?' ('+short+')':'');
 }
 function t2TestsAnswer(r,c){
  const s=c.s,win=t2Window(c.q,s),now=stamp(s.now)||Date.now(),courseName=r.course?(r.course.shortName||r.course.nickname||r.course.name):r.subject||'';
  const fits=v=>
    !r.subject&&
      t2KindFits(r.kinds,v)&&
      (!r.course||String(v.courseId)===String(r.course.id))&&
      (!r.named.length||r.named.every(w=>new RegExp('\\b'+w.replace(/[^a-z0-9]/g,'')+'\\b','i').test(v.title)));
  const prefer=v=>v.testKind!=='quiz',narrow=l=>r.one&&l.some(prefer)?l.filter(prefer):l;
  let all=r.tests.filter(fits);
  const inWin=(from,to)=>narrow(all.filter(v=>v.dueAt!==null&&v.dueAt>=from&&v.dueAt<to).sort((a,b)=>a.dueAt-b.dueAt));
  let rows=inWin(win.from,win.to),label=win.label;
  if(!rows.length&&win.also){
    const end=load('CanvasHarnessAgentClock','./agent-clock.js')?.wall?.(addDays(win.also,1),0,s.timeZone||'America/New_York');
    rows=inWin(load('CanvasHarnessAgentClock','./agent-clock.js')?.wall?.(win.also,0,s.timeZone||'America/New_York'),end);
    if(rows.length)label=new Date(win.also+'T12:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'short',day:'numeric'});
  }
  const generic=r.kinds.has('test')||r.kinds.size>1,
    kindWord=generic?'test':[...r.kinds][0],
    plural=kindWord==='quiz'?'quizzes':kindWord+'s',
    noun=generic&&!r.course&&!r.named.length?'tests, quizzes or exams':plural,
    count=generic&&!r.one?'tests and quizzes':kindWord==='exam'?'tests and exams':plural;
  const from=v=>
    v.testSource==='announcement'?
      ' (from a'+((courseOf(v,s)?.shortName||courseOf(v,s)?.name)?' '+(courseOf(v,s).shortName||courseOf(v,s).name):'n')+' announcement)':
      v.testSource==='event'?' (calendar)':v.testSource==='own'?' (your list)':'';
  const kindTitle=generic?'tests':plural,
    extra={answerKind:'mind',listRows:rows,listTitle:(courseName?courseName+' '+kindTitle:kindTitle.charAt(0).toUpperCase()+kindTitle.slice(1))+(win.span==='ahead'?' ahead':' '+label)};
  if(rows.length>1){
    const shown=rows.slice(0,3).map(v=>t2Name(v,s)+', '+t2When(v,s)+from(v)).join('; ');
    return c.card('find',rows.slice(0,3),{},rows.length+' '+count+' '+label+'. Nearest: '+shown+(rows.length>3?'; and '+(rows.length-3)+' more':'')+'.',extra);
  }
  // an announcement's or a calendar event's test opens that announcement or event (its own entry), not a work item
  const fieldsOf=v=>
    v.testSource==='announcement'||v.testSource==='event'?
      {itemId:String(v.id),entryId:String(v.id),kind:v.testSource,...(v.url?{url:String(v.url)}:{})}:
      {itemId:String(v.id),...(v.courseId?{courseId:String(v.courseId)}:{})};
  if(rows.length===1){const v=rows[0],when=t2When(v,s);return c.card('find',[v],fieldsOf(v),t2Name(v,s)+' is '+when+(v.dayOnly?' (no time given)':'')+from(v)+'.',extra);}
  // none in the window: the named one when it is the only one of its name (past, later or with no date), else say so
  all=narrow(all);
  const later=all.filter(v=>v.dueAt!==null&&v.dueAt>=win.to&&v.dueAt<win.to+60*DAY).sort((a,b)=>a.dueAt-b.dueAt),undated=all.filter(v=>v.dueAt===null);
  // one test of that kind with no date at all: that one, saying it has no date (no day is stated)
  if(win.span==='ahead'&&!later.length&&undated.length===1){const v=undated[0];return c.card('find',[v],fieldsOf(v),t2Name(v,s)+' has no date in Canvas yet.',{...extra,listRows:[v]});}
  if(r.course&&all.length===1&&!/ (?:any|anything|tests|quizzes|exams|midterms|finals|next|upcoming) /.test(c.q)){
    const v=all[0];
    if(v.dueAt===null)return c.card('find',[v],{itemId:String(v.id),...(v.courseId?{courseId:String(v.courseId)}:{})},t2Name(v,s)+' has no date in Canvas yet.',{...extra,listRows:[v]});
    if(v.dueAt>=win.to&&win.span==='ahead')
      return c.card('find',[v],{itemId:String(v.id),...(v.courseId?{courseId:String(v.courseId)}:{})},t2Name(v,s)+' is '+t2When(v,s)+from(v)+'.',{...extra,listRows:[v]});
    if(v.dueAt<now&&win.span==='ahead')
      return c.card(
        'find',
        [v],
        {itemId:String(v.id),...(v.courseId?{courseId:String(v.courseId)}:{})},
        t2Name(v,s)+' was '+t2When(v,s,{year:true})+'. No other '+kindWord+' for '+courseName+' in the next two weeks.',
        {...extra,listRows:[v]});
  }
  const none='No '+
    (r.course||r.subject?kindWord:noun==='tests, quizzes or exams'?noun:plural)+
    ' found'+
    (courseName?' for '+courseName+' '+(win.span==='day'&&!/^(?:today|tomorrow)$/.test(label)?'on ':'')+label:(win.span==='day'?' for ':' ')+label)+
    '.';
  const next=later[0]||null,
    nextText=next?
      (win.span==='ahead'?' The next one is ':' After '+label+', the next is ')+t2Name(next,s)+', '+t2When(next,s)+from(next)+'.':
      undated.length&&win.span==='ahead'?' '+t2Name(undated[0],s)+' has no date in Canvas yet.':'';
  return c.card('none',[],{},none+
    nextText,{
      answerKind:'mind',
      listRows:[],
      offerCourse:r.course?String(r.course.id):undefined,
      follow:[
        r.course?'what is due in '+(r.course.shortName||r.course.name).toLowerCase():'what is due this week',
        'plan tonight',
        ...(win.span==='day'?['i have a '+kindWord+' '+(label==='tomorrow'?'tomorrow':label.toLowerCase())]:[])
      ]
    });
 }

 // the features by name (the page's list, else the catalogue); a name "A & B" is also called by A when A is two words or more
 const T2_SWITCH_ON=/ (?:allow|allowed|active|activate|enable|enabled|unmute|back on|turn on|switch on|work again|working again|bring back) /,T2_SWITCH_OFF=/ (?:mute|muted|away|disable|disabled|shut off|shut|turn off|switch off|no more|kill|deactivate) /;
 const T2_SWITCH_FILLER=new Set('could you u please pls plz make the my features feature again back it its can let me so is are want have would like to i need be on off can t'.split(' '));
 function t2FeatureSwitch(q,s){
   const on=T2_SWITCH_ON.test(q),off=T2_SWITCH_OFF.test(q);
   if(on===off)return null;
   const rows=Array.isArray(s.features)&&s.features.some(f=>f&&f.name)?s.features:list(load('ReserveFeatures','./features.js')?.catalogue);
   let best=null;
  for(const f of rows){
    if(!f?.id||!f.name)continue;
    const name=String(f.name).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim(),
      head=String(f.name).includes('&')?String(f.name).split('&')[0].toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim():'';
    for(const said of [name,head])if(said&&said.split(' ').length>=2&&q.includes(' '+said+' ')&&(!best||said.length>best.said.length))best={id:f.id,name:f.name,said};
  }
  if(!best)return null;
  const rest=q.replace(' '+best.said+' ',' ').replace(/ (?:allow|allowed|active|activate|enable|enabled|unmute|back on|turn on|switch on|work again|working again|bring back|mute|muted|away|disable|disabled|shut off|shut|turn off|switch off|no more|kill|deactivate) /g,' ').trim().split(' ').filter(w=>
    w&&!T2_SWITCH_FILLER.has(w));
  return rest.length?null:{...best,on};
 }
 // biscuit-42: Monday to Sunday for "this week" in due-week and how-much (t2Window)
 /* biscuit-42 (2026-11-22): typed slips mended before anything reads the line. A word Biscuit does not know that is one
    slip from a school word or a word of the student's own course names and work titles (a letter dropped, added or two
    swapped; any one letter in a 7-letter word, two in a longer one; "ph" typed as "f") becomes that word, when exactly one
    word fits best and it starts the same; a known word with an ending (graded, plans) stays. Notes, reminders, tasks and quoted names keep what was typed. */
 const MEND_CORE='homework assignment assignments worksheet project projects reading readings essay essays quiz quizzes test tests exam exams midterm midterms final finals report reports presentation presentations notes grade grades score scores points today tonight tomorrow yesterday week weekend weekly what when where which whats monday tuesday wednesday thursday friday saturday sunday announcement announcements missing late overdue upcoming schedule plan planner focus timer break remind reminder calendar inbox message messages teacher class classes course courses syllabus module modules files problems practice chapter vocab history english spanish french german latin chinese physics biology chemistry algebra geometry calculus statistics economics psychology government literature science math deadline deadlines tasks task lesson lessons discussion discussions turned submit submitted minutes hours study review due'.split(' ');
 const MEND_KNOWN=new Set(('lab labs due hw tmrw pls thx about after again also always another anything around because before being better between both bring came come could does doing done down each even every first from give going good great have help here into just keep know last later left like little long look made make many maybe more most much must need never only other over please really right said same should show since some something still such sure take tell than thank thanks that their them then there these they thing things think those though through time took turn very want wants well were while will with work would year your yours form forms open ones once lets says start stop stay pass past best rest text wear hear near dear yeah okay hello hiii heyy name game home hope note vote less loss lost list cast fast paste taste team teams meet meat mean means mind kind find fine line lines life live love move mode fade face fact fair farm free tree three white write wrote right light night might fight sight tight dark mode theme clock hide shows sound sounds quiet volume today dont cant wont isnt didnt havent tasks done told tells else away sick tired bored hungry stressed cute joke horse pony biscuit companion mins hour hours days date dates were mark marks marked fail failing pass passing class '+MEND_CORE.join(' ')).split(' '));
 // (a 4-letter slip only ever becomes a school word, and not when it could also be one of the student's own words: "gemo"
 // may be geometry or geography, "sore" may be score or the course called Sorel, so neither is guessed)
 const CORE_SET=new Set(MEND_CORE);
 const MEND_FIX={du:'due',wen:'when',whn:'when',wht:'what',tmrow:'tomorrow',tmmrw:'tomorrow',todays:"today's",tonights:"tonight's",tomorrows:"tomorrow's",tmrws:"tmrw's"};
 // (round 2) slips only read as one word in context: "whats dew today", "lat assignments" (when no course is called lat),
 // and a day before "due" ("fri due" is "due fri")
 const MEND_DAY='today|tonight|tomorrow|tmrw|tmr|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday';
 function mendContext(text,s){
   let t=text;
   t=t.replace(new RegExp('^(\\s*)('+MEND_DAY+')(\\s+)due\\b(?=\\s*[?!.]*\\s*$)','i'),'$1due$3$2');
   if(/\bdew\b/i.test(t)&&new RegExp('\\b(?:what\\s*s|whats|what|when|whens|is|are|anything|stuff|'+MEND_DAY+'|this week|next week)\\b','i').test(t))t=t.replace(/\bdew\b/gi,'due');
   if(/\blat\b(?=\s+(?:assignments?|work|hw|homework|stuff|things|ones|items|tasks)\b)/i.test(t)){
     const L=load('ReserveBiscuitLanguage','./biscuit-language.js');
     let r=null;
     try{r=L?.resolveCourses?.('lat',s);}catch{r=null;}
     if(!list(r?.matches).length)t=t.replace(/\blat\b(?=\s+(?:assignments?|work|hw|homework|stuff|things|ones|items|tasks)\b)/gi,'late');
   }
   return t;
 }
 const MEND_SKIP=/^\s*(?:note|notes|remind|reminder|add|task|todo|to do|write down|put|save|keep|rename|call|name|nickname)\b|[:"“”]|\b(?:remind|reminder|reminders|jot|write down|to do list|todo|to-do)\b|\b(?:make|take|add|write|save|keep|jot)\s+(?:me\s+)?(?:a\s+|this\s+|that\s+|the\s+)?(?:quick\s+)?notes?\b|\bnote\s+(?:that|to self|down)\b|\badd\b.*\b(?:to\s+(?:my\s+)?(?:list|todo|to do|tasks?|planner))\b/i;
 const mendSquash=w=>w.replace(/ph/g,'f').replace(/ck/g,'k').replace(/y/g,'i').replace(/(.)\1+/g,'$1');
 function mendDistance(a,b){
   const m=a.length,n=b.length;
   if(Math.abs(m-n)>2)return 9;
   const d=[];
   for(let i=0;i<=m;i++){d[i]=[i];for(let j=1;j<=n;j++)d[i][j]=i?0:j;}
   for(let i=1;i<=m;i++)
     for(let j=1;j<=n;j++){
       const cost=a[i-1]===b[j-1]?0:1;
       d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
       if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
     }
   return d[m][n];
 }
 function mendEnding(typed,word){
   if(typed.startsWith(word))return typed!==word&&typed.slice(word.length).split('').every(ch=>ch===word.at(-1));
   if(word.startsWith(typed))return typed.length>=6;
   if(typed.length===word.length&&typed.slice(0,-1)===word.slice(0,-1))return false;
   return true;
 }
 function mendFits(typed,word){
   if(!mendEnding(typed,word)||typed.endsWith('s')&&word.endsWith('s')&&!mendEnding(typed.slice(0,-1),word.slice(0,-1)))return false;
   if(mendSquash(typed)===mendSquash(word))return true;
   if(typed[0]!==word[0])return false;
   const len=typed.length,dist=mendDistance(typed,word);
   if(len<=6)return dist===1&&(Math.abs(len-word.length)===1||len===word.length&&[...typed].sort().join('')===[...word].sort().join(''));
   return dist<=(len>=8?2:1);
 }
 const mendCache=new WeakMap();
 function mendWords(s){
   if(s&&typeof s==='object'&&mendCache.has(s))return mendCache.get(s);
   const own=new Set(),add=t=>{for(const w of String(t||'').toLowerCase().normalize('NFKD').replace(/[^a-z\s]+/g,' ').split(/\s+/))if(w.length>=4)own.add(w);};
   for(const v of list(s?.courses)){add(v.name);add(v.shortName);add(v.nickname);}
   for(const k of ['assignments','workItems','files','pages','announcements'])for(const v of list(s?.[k]))add(v.title||v.name);
   const out={targets:[...new Set([...MEND_CORE.filter(w=>w.length>=4),...own])],known:new Set([...MEND_KNOWN,...own])};
   if(s&&typeof s==='object')mendCache.set(s,out);
   return out;
 }
 function mend(line,s){
   const raw=String(line??'');
   if(!raw.trim()||raw.length>160||MEND_SKIP.test(raw))return raw;
   const text=mendContext(raw,s);
   const {targets,known}=mendWords(s);
   let changed=false;
   const out=text.replace(/[A-Za-z]+/g,w=>{
     const low=w.toLowerCase();
     if(Object.hasOwn(MEND_FIX,low)){changed=true;return MEND_FIX[low];}
     if(low.length<4||
       known.has(low)||
       [low.replace(/s$/,''),low.replace(/es$/,''),low.replace(/d$/,''),low.replace(/ed$/,''),low.replace(/ing$/,''),low.replace(/ing$/,'e'),low.replace(/er$/,''),low.replace(/ly$/,'')].some(x=>
         x!==low&&known.has(x)))
       return w;
     const fit=targets.filter(t=>Math.abs(t.length-low.length)<=2&&mendFits(low,t));
     if(low.length===4&&(fit.some(t=>!CORE_SET.has(t))||fit.some(t=>t.length!==4||[...t].sort().join('')!==[...low].sort().join(''))))return w;
     const hits=fit.map(t=>[t,mendSquash(t)===mendSquash(low)?0:mendDistance(low,t)]),best=Math.min(...hits.map(h=>h[1])),top=hits.filter(h=>h[1]===best);
     if(top.length!==1)return w;
     changed=true;
     return top[0][0];
   });
   return changed||text!==raw?out:raw;
 }
 /* biscuit-42: readings the job's student lines found missing. Each is a kind of thing students say, read from its
    words; every rule above them still answers first. */
 const gradesOn=s=>s.showGrades!==false&&s.settings?.showGrades!==false&&s.privacy?.grades!==false&&(s.showGrades===true||s.settings?.showGrades===true);
 const GRADES_OFF='Show grades is off.';
 // a word of the line that belongs to the named course (its name, short name, code, a start of one, or an alias of it)
 function r42CourseWord(course,w,s){
   if(/^(?:ap|ib|cp|h|hon|honors|\d+|i|ii|iii|iv|v|class|course)$/.test(w))return true;
   const names=[course.name,course.shortName,course.nickname,course.course_code].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(Boolean);
   if(names.includes(w))return true;
   if(w.length>=3&&names.some(n=>n.length>=4&&n.startsWith(w)))return true;
   const L=load('ReserveBiscuitLanguage','./biscuit-language.js');
   let r=null;
   try{r=L?.resolveCourses?.(w,s);}catch{r=null;}
   return !!r&&!r.ambiguous&&String(r.courseId)===String(course.id)&&byName(r);
 }
 // the course is named (its name, an abbreviation or its subject), not only found through words in its work's titles
 const byName=r=>{const m=list(r?.matches).find(x=>String(x.courseId??x.id)===String(r.courseId));return !!m&&(m.nameMatch>0||m.abbreviation>0||m.subject>0);};
 // a course named alone, with or without "open", "go to", "class", "page" or "modules"
 const R42_NOT_COURSE=/ (?:homework|hw|assignments?|work|stuff|tasks?|due|grades?|score|tests?|quiz|quizzes|exams?|essays?|labs?|projects?|reading|notes?|syllabus|teacher|files?|slides|announcements?|anncs?|discussion|rubric|plan|focus|timer|when|what|how|why|did|is|are|do|does|can|should|remind|mark|done|finished|help|study|review|practice|explain|hide|unhide|rename|colou?r|nickname|scene|theme|dark|light|mode|wallpaper|banner) /;
 // subject words said alone; with no such course Biscuit says so instead of opening another one
 const R42_SUBJECTS=new Set('chem chemistry bio biology physics phys calc calculus precalc algebra alg geometry geom stats statistics history hist apush english eng lit literature spanish span french german latin chinese mandarin japanese econ economics psych psychology gov government civics art music band choir orchestra drama theater theatre health cs compsci coding programming engineering robotics anatomy anat astronomy astro apes apbio apchem philosophy religion theology sociology journalism photography ceramics'.split(' '));
 function r42Course(q,line,s){
  const m=/^ (?:(?:open|go to|take me to|show me|show|pull up|bring up|switch to|get me to|jump to|head to) )?(?:my |the )?(.+?)(?: (?:class|course|page|homepage|home page|modules|module page|tab))?(?: please)? $/.exec(q);
  if(!m)return null;const rest=' '+m[1].trim()+' ',words=rest.trim().split(' ');if(R42_NOT_COURSE.test(rest)||words.length>4)return null;
  const L=load('ReserveBiscuitLanguage','./biscuit-language.js');let r=null;try{r=L?.resolveCourses?.(rest.trim(),s);}catch{r=null;}
  if(r&&!r.ambiguous&&r.courseId){
    const course=list(s.courses).find(v=>String(v.id)===String(r.courseId));
    return course&&byName(r)&&words.every(w=>r42CourseWord(course,w,s))?{course}:null;
  }
  // a subject the student does not take ("chem" with no chemistry course): said plainly, no other course opened
  if(r&&r.recognized&&!list(r.matches).length&&words.length===1&&R42_SUBJECTS.has(words[0])&&!misspeltCourse(rest,s))return {missing:rest.trim()};
  return null;
 }
 function r42CourseAnswer(m,c){
  if(m.missing)return say(c,'I do not see a '+m.missing+' course in your Canvas courses.');
  const course=m.course,
    now=stamp(c.s.now)||Date.now(),
    rows=open(c.s).filter(v=>String(v.courseId)===String(course.id)&&(v.dueAt===null||v.dueAt>=now-7*DAY)).sort((a,b)=>(a.dueAt??Infinity)-(b.dueAt??Infinity)),
    name=course.shortName||course.name,
    first=rows[0],
    when=first&&first.dueAt!==null?whyNow(first,c.s).replace(/^it /,'').replace(/^is /,''):'';
  const said=first?name+': '+first.title+(when?', '+when:'')+'.'+(rows.length>1?' '+(rows.length-1)+' more after that.':''):'Nothing open in '+name+'.';
  return c.card('navigate',[{id:String(course.id),title:course.name,kind:'course',courseId:String(course.id)},...rows.slice(0,2)],{tab:'course',courseId:String(course.id)},said);
 }
 // the days a line names: today, tomorrow, a weekday, this or next week (Monday to Sunday), the weekend
 function r42Window(q,s){
  if(/ (?:this |the )?weekend /.test(q)){
    const cal=local(s),now=stamp(s.now)||Date.now();
    if(!cal)return null;
    const today=cal(now).day,
      dow=new Date(today+'T12:00Z').getUTCDay(),
      wall=(day,minute)=>load('CanvasHarnessAgentClock','./agent-clock.js')?.wall?.(day,minute,s.timeZone||'America/New_York'),
      sat=dow===0?today:addDays(today,(6-dow+7)%7),
      sun=dow===0?today:addDays(sat,1);
    return {from:dow===6||dow===0?now:wall(sat,0),to:wall(addDays(sun,1),0),label:'this weekend',span:'weekend'};
  }
  if(!/ (?:today|tonight|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|week|wk) /.test(q))return null;
  const w=t2Window(q,s);return w.span==='ahead'?null:w;
 }
 const r42Day=(v,s)=>{
   const now=stamp(s.now)||Date.now(),cal=local(s);
   if(v.dueAt===null)return 'no due date';
   const zone=s.timeZone||'America/New_York',
     d=cal?Math.round((Date.parse(cal(v.dueAt).day+'T12:00Z')-Date.parse(cal(now).day+'T12:00Z'))/DAY):null,
     day=v.dueAt<now?
       'was due '+new Date(v.dueAt).toLocaleDateString('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric'}):
       d===0?'today':d===1?'tomorrow':new Date(v.dueAt).toLocaleDateString('en-US',{timeZone:zone,weekday:'short'});
   return day+' '+clockText(v.dueAt,s);
 };
 const r42Name=(v,s)=>v.title+' ('+[courseName(v,s),r42Day(v,s)].filter(Boolean).join(', ')+')';
 // one list answer: every row goes with the card (listRows), the sentence names the first three
 function r42List(c,rows,lead,title,extra=''){
   const three=rows.slice(0,3).map(v=>r42Name(v,c.s));
   return c.card(
     'find',
     rows.slice(0,3),
     rows.length===1?{itemId:rows[0].id,...(rows[0].courseId?{courseId:String(rows[0].courseId)}:{})}:{},
     rows.length+
       ' thing'+
       (rows.length===1?'':'s')+
       ' '+
       lead+
       ': '+
       (three.length>1?three.slice(0,-1).join(', ')+(rows.length>3?', ':' and ')+three.at(-1):three[0])+
       (rows.length>3?', and '+(rows.length-3)+' more':'')+
       '.'+
       extra,
     {answerKind:'mind',listRows:rows,listTitle:title});
 }
 // work asked about as a list ("what hw do i have", "any homework tonight", "spanish assignments", "is anything due fri", "due dates for english")
 const R42_WORK=/ (?:homework|assignments?|work|stuff|tasks?|things|to do|todo|deadlines?|due dates?|anything due|anything else due) /,R42_NOT_LIST=/ (?:plan|planning|schedule|mark|marked|done|finish|finished|complete|completed|remind|reminder|note|add|focus|timer|start|move|push|bookmark|hide|explain|help|study|catch up|submit|submitted|turn in|turned in|hand in|handed in|upload|grade|grades|score|late|missing|overdue|behind|how much|how many|how long|first|should|forget|forgot|miss|missed|why|where|policy|count|counts|group|partner|partners|calendar|new|stressed|hate|can not|lot|too) /,R42_ASK=/ (?:what|which|any|anything|show|list|see|all|got|have|left|pending|remaining|due dates?|deadlines?|anything due) /,R42_LIST_CUE=/ (?:what|which|any|anything|show|list|all|pending|left|remaining|due dates?|deadlines?|tonight|today|tomorrow|week|wk|weekend|sunday|monday|tuesday|wednesday|thursday|friday|saturday) /;
 const R42_FILLER=new Set('what which have show list that this with from left open pending remaining tonight today tomorrow week weekend homework assignment assignments work stuff tasks task things thing there anything else about please class course classes courses sunday monday tuesday wednesday thursday friday saturday next still need right does dates date deadline deadlines your mine all for my the in on do i is are any due got some todo you see me up'.split(' '));
 function r42WorkList(q,line,c){
  if(!R42_WORK.test(q)||R42_NOT_LIST.test(q))return null;const course=courseOfLine(line,c.s);if(!R42_ASK.test(q))return null; // ("tmrw hw", "hw tonight": the engine's day answer; a list is asked for)
  // "geom hw", "bio hw pls", "chem hw due": a course's homework named short opens that homework (the round 6 reading); a list needs a list word
  if(course&&!R42_LIST_CUE.test(q))return null;
  // "hw due fri", "whats due tmrw": the day's due list stays the engine's (all work due that day, tests too)
  if(/ due /.test(q)&&/ (?:today|tonight|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat) /.test(q)&&!/ (?:anything due|anything else due|due dates?) /.test(q))return null;
  if(q.trim().split(' ').some(w=>w.length>=3&&!R42_FILLER.has(w)&&!/^\d+$/.test(w)&&!(course&&r42CourseWord(course,w,c.s))))return null;
  // the line is a title ("homework for wednesday" when an item is called that): that item, not a list
  const core=q.replace(/^ (?:(?:what is|what are|which|show me|show|open|find|any|is there|do i have|what|my|the) )+/,' ').trim();
  if(core.split(' ').length>=2&&open(c.s).some(v=>(' '+v.title.toLowerCase().replace(/[^a-z0-9]+/g,' ')+' ').includes(' '+core+' ')))return null;
  return {course,win:r42Window(q,c.s)};
 }
 function r42WorkAnswer(m,c){
  const now=stamp(c.s.now)||Date.now(),w=m.win,course=m.course,where=course?' in '+(course.shortName||course.name):'';
  let rows=open(c.s).filter(v=>!course||String(v.courseId)===String(course.id));
  // ("homework" means all of it, tests and quizzes too, as the due lists count it)
  const late=rows.filter(v=>v.dueAt!==null&&v.dueAt<now);
  rows=w?
    rows.filter(v=>v.dueAt!==null&&v.dueAt>=w.from&&v.dueAt<w.to):
    course?rows.filter(v=>v.dueAt===null||v.dueAt>=now-7*DAY):rows.filter(v=>v.dueAt!==null&&v.dueAt>=now&&v.dueAt<now+7*DAY);
  rows.sort((a,b)=>(a.dueAt??Infinity)-(b.dueAt??Infinity));
  const span=w?(w.span==='day'?(w.label==='today'?(/ tonight /.test(c.q)?' tonight':' today'):w.label==='tomorrow'?' tomorrow':' on '+w.label):' '+w.label):course?'':' in the next 7 days',
    lateNote=!w&&!course&&late.length?' Also '+late.length+' late.':'';
  if(!rows.length){
    const next=open(c.s).filter(v=>(!course||String(v.courseId)===String(course.id))&&v.dueAt!==null&&v.dueAt>=(w?w.to:now)).sort((a,b)=>a.dueAt-b.dueAt)[0];
    return next?
      c.card('find',[next],{itemId:next.id,...(next.courseId?{courseId:String(next.courseId)}:{})},'Nothing due'+span+where+'. Next: '+r42Name(next,c.s)+'.',{answerKind:'mind'}):
      say(c,'Nothing due'+span+where+'.');
  }
  return r42List(c,rows,course&&!w?'open'+where:'due'+span+where,course&&!w?(course.shortName||course.name)+': what is left':'Due'+span+where,lateNote);
 }
 // what one piece of work got: "what did i get on the collisions lab", "my score on quiz 7a"
 function r42GradeOf(q,line,s){
  if(!/ (?:what did i get|what i got|what grade did i get|what score did i get|my score|my grade|my mark|how did i do|how many points did i get|score|grade|points) (?:on|for) /.test(q)&&!/ did i get on /.test(q))return null;
  const words=q.replace(/^.*? (?:on|for) /,' ').trim().split(' ').filter(w=>w.length>=3&&!/^(?:the|my|this|last|that)$/.test(w));if(!words.length)return null;
  const rows=list(s.grades).filter(g=>!/^course-grade-/.test(String(g.id))&&g.kind!=='course-grade'&&Number.isFinite(Number(g.score??g.value))),
    title=g=>' '+String(g.title||g.name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ')+' ',
    hits=rows.filter(g=>words.every(w=>title(g).includes(' '+w)));
  return hits.length===1?{row:hits[0]}:null;
 }
 function r42GradeAnswer(m,c){
   if(!gradesOn(c.s))return c.card('none',[],{},GRADES_OFF);
   const g=m.row,
     score=Number(g.score??g.value),
     points=Number(g.points??g.pointsPossible),
     name=String(g.title||g.name||''),
     value=Number.isFinite(points)&&points>0?score+' / '+points+' ('+Math.round(1000*score/points)/10+'%)':String(score);
   return c.card(
     'find',
     [{...g,kind:'grade'}],
     {entryId:String(g.id),itemId:String(g.id),kind:'grade',...(g.courseId?{courseId:String(g.courseId)}:{})},
     name+': '+value+'.',
     {answer:{label:name,value}});
 }
 // which course has the best or the lowest grade
 const R42_MISSED=/ (?:did i (?:forget|miss|skip|not) (?:to )?(?:turn|hand|submit|do)|(?:havent|have not|did not|didnt|not yet|never) (?:turned|handed|submitted|turn|hand|submit) |(?:what|which|anything) (?:did i|have i) (?:not |never )?(?:forget|forgot|forgotten|miss|missed|skip|skipped) |what (?:havent|have not|did not|didnt) i (?:turned|turn|handed|hand|submitted|submit|done|do) )/,R42_MISSED_WORDS=new Set('did i forget forgot forgotten miss missed skip skipped not to turn hand submit do in anything everything something stuff work homework assignments assignment what which have havent didnt never yet turned handed submitted done is are there any yet'.split(' '));
 const R42_RANK=/ (?:lowest|highest|best|worst|top|weakest|strongest|bottom) (?:grade|grades|class|classes|course|courses|subject|score|mark|marks) | (?:which|what) (?:class|course|subject) (?:is|has|am i|do i have|s|have i got) .*(?:best|worst|lowest|highest|weakest|strongest|top|bottom) | (?:doing|do) (?:the )?(?:best|worst|lowest|highest) (?:in|at) /;
 function r42Ranked(s){
   return list(s.courses).map(v=>{
     const g=list(s.grades).find(x=>String(x.id)==='course-grade-'+v.id||x.kind==='course-grade'&&String(x.courseId)===String(v.id)),n=Number(g?.value??g?.score??v.score);
     return Number.isFinite(n)?{v,n,g}:null;
   }).filter(Boolean).sort((a,b)=>a.n-b.n);
 }
 function r42RankAnswer(m,c){
   if(!gradesOn(c.s))return c.card('none',[],{},GRADES_OFF);
   const all=r42Ranked(c.s);
   if(!all.length)return say(c,'I do not have course grades to compare yet.');
   const low=/ (?:lowest|worst|weakest|bottom) /.test(c.q),
     pick=low?all[0]:all.at(-1),
     name=pick.v.shortName||pick.v.name,
     item=pick.g?{...pick.g,kind:'course-grade'}:{id:'course-grade-'+pick.v.id,title:pick.v.name,courseId:String(pick.v.id),value:pick.n,kind:'course-grade'};
   return c.card(
     'find',
     [item],
     {entryId:String(item.id),itemId:String(item.id),kind:'grade',courseId:String(pick.v.id)},
     (low?'Lowest':'Highest')+': '+name+', '+pick.n+'%.',
     {answer:{label:(low?'Lowest: ':'Highest: ')+name,value:pick.n+'%'}});
 }
 // the tests and quizzes on a day: "what should i study for friday"
 function r42StudyFor(q){const m=/ (?:what|which) (?:should|do|must|have) i (?:need to |have to )?(?:study|prep|prepare|review|revise) (?:for )?(?:on )?(today|tonight|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat|this week|next week) /.exec(q);return m?{when:' '+m[1]+' '}:null;}
 function r42StudyAnswer(m,c){
   const w=t2Window(m.when,c.s),
     tests=t2Tests(c.s).filter(v=>v.dueAt!==null&&v.dueAt>=w.from&&v.dueAt<w.to).sort((a,b)=>a.dueAt-b.dueAt),
     span=w.span==='day'?(w.label==='today'||w.label==='tomorrow'?' '+w.label:' on '+w.label):' '+w.label;
   if(tests.length)
     return c.card(
       'find',
       tests.slice(0,3),
       tests.length===1?{itemId:tests[0].id}:{},
       (tests.length===1?'1 test':tests.length+' tests')+span+': '+tests.slice(0,3).map(v=>r42Name(v,c.s)).join(' and ')+'.',
       {answerKind:'mind',listRows:tests,listTitle:'Tests'+span});
   const due=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt>=w.from&&v.dueAt<w.to).sort((a,b)=>a.dueAt-b.dueAt);
   return due.length?r42List(c,due,'due'+span,'Due'+span,' No tests'+span+'.'):say(c,'No tests and nothing due'+span+'.');
 }
 // announcements, all of them or one course's
 function r42Annc(q,line,s){
   if(!/ (?:announcements|anncs|announcments|annoucements) /.test(q)||/ (?:hide|turn|off|setting|settings|module|widget|mark|delete|remove|reply|post|write|how|where|count|new|unread|latest|recent) /.test(q))return null;
   const course=courseOfLine(line,s);
   return q.trim().split(' ').every(w=>/^(?:show|me|open|check|see|read|any|get|my|the|all|course|class|from|in|for|please|announcements?|anncs?|announcments?|annoucements?|are|there|what|is)$/.test(w)||!!course&&r42CourseWord(course,w,s))?
     {course}:
     null;
 }
 function r42AnncAnswer(m,c){
   const now=stamp(c.s.now)||Date.now(),
     all=list(c.s.announcements).filter(v=>!m.course||String(v.courseId)===String(m.course.id)).sort((a,b)=>(stamp(b.postedAt)||0)-(stamp(a.postedAt)||0)),
     recent=all.filter(v=>(stamp(v.postedAt)||0)>=now-30*DAY),
     rows=(recent.length?recent:all).slice(0,8).map(v=>({...v,kind:'announcement'})),
     where=m.course?' in '+(m.course.shortName||m.course.name):'';
   if(!rows.length)return say(c,'No announcements'+where+'.');
   return c.card('find',rows.slice(0,5),rows.length===1?{itemId:String(rows[0].id)}:{},rows.length+' announcement'+(rows.length===1?'':'s')+where+'. Newest: '+rows[0].title+'.',{answerKind:'mind'});
 }

 // round 2: one piece of work a yes/no question names ("is the dbq due this week"): its title holds every other word
 const R42_ASKED_STOP=new Set('is are was will be it its the my a an due this next week wk weekend today tonight tomorrow monday tuesday wednesday thursday friday saturday sunday on for by still yet already'.split(' '));
 function r42AskedItem(q,s){
   const words=q.trim().split(' ').filter(w=>w.length>=3&&!R42_ASKED_STOP.has(w));
   if(!words.length)return null;
   const fit=(w,t)=>w===t||w.length>=4&&t.length>=4&&(t.startsWith(w.slice(0,5))||w.startsWith(t.slice(0,5)));
   const hits=open(s).filter(v=>v.dueAt!==null&&words.every(w=>v.title.toLowerCase().split(/[^a-z0-9]+/).some(t=>fit(w,t))));
   return hits.length===1?hits[0]:null;
 }
 // the engine's repair of a wrong single pick: the days a line names, and that window's due list
 function dueWindow(line,s){try{return r42Window(spell(mend(line,s)),s);}catch{return null;}}
 function dueList(line,s){
   const q=spell(mend(line,s)),w=r42Window(q,s);
   if(!w)return null;
   const mk=(action,items,fields,message,extra={})=>({action,items:list(items).slice(0,3),message,next:{action,fields:fields||{},label:'Open'},...extra});
   return r42WorkAnswer({win:w,course:null},{card:mk,s,q,line:String(line)});
 }
 const RULES=[
  {id:'crisis',when:q=>/ (?:kill myself|want to die|wanna die|end my life|end it all|hurt myself|harm myself|suicid|do not want to (?:be here|live|exist)|no reason to live) /.test(q),answer:(m,c)=>say(c,'I am really glad you told me. Please talk to someone right now: a parent, a counselor, or call or text 988 (Suicide and Crisis Lifeline, US). You matter, and you do not have to carry this alone.')},
  // T2: a tool named alone or with open / show / use opens it; "where is" / "how do i open" says its place first.
  {id:'t2-tool',when:(q,line,c)=>{
    const w=T2_TOOL_WHERE.exec(q),t=w?t2ToolOf(' '+w[1]+' '):t2ToolOf(q);
    if(!t||t2CalcIsCourse(t.said,line,c.s))return false;
    return {t,where:!!w};
  },answer:(m,c)=>t2ToolAnswer(m.t,c,m.where)},
  // T2: the tests, quizzes and exams ahead, listed nearest first (one: that one with its day; none: said plainly).
  {id:'tests-ahead',when:(q,line,c)=>t2Reading(q,line,c),answer:(m,c)=>t2TestsAnswer(m,c)},
  // T2: a feature switched by its name and an on / off word, nothing else ("allow pdf reader", "mute review deck")
  {id:'t2-feature-switch',when:(q,line,c)=>t2FeatureSwitch(q,c.s),answer:(m,c)=>c.card('feature',[],{id:m.id,on:m.on},(m.on?'Turn on ':'Turn off ')+m.name+'.')},
  // Round 9: lines Biscuit must not act on, and Canvas Harness's own places and settings, read before the rest.
  {id:'r9-setting-words',when:q=>R9_SETTINGS.some(([re])=>re.test(q))&&!/ (?:how|where) /.test(q),answer:(m,c)=>{
    const [,,key,value,said]=[0,...R9_SETTINGS.find(([re])=>re.test(c.q))];
    const v=value(c.q);
    if(v===null||v===undefined)return null;
    return c.card('setting',[],{key,value:v},said);
  }},
  {id:'r9-skills',when:q=>R9_SKILLS.some(([,re])=>re.test(q))&&/ (?:off|on|disable|enable|stop|start|mute|unmute|no more|turn|switch) /.test(q),answer:(m,c)=>{
    const [skill]=R9_SKILLS.find(([,re])=>re.test(c.q)),on=!/ (?:off|disable|stop|mute|no more) /.test(c.q);
    return c.card('skill',[],{skill,on},(on?'Turn on ':'Turn off ')+c.q.match(R9_SKILLS.find(([k])=>k===skill)[1])[0].trim()+'.');
  }},
  {id:'r9-inbox',when:q=>/^ (?:open |go to |show (?:me )?|check |any |any new |got any |do i have any |new |unread )?(?:my |the |new |unread )?(?:inbox|messages|msgs|conversations|canvas inbox|canvas messages)(?: page| tab)?(?: please)? $/.test(q)&&!/^ open (?:the )?messages /.test(q),answer:(m,c)=>c.card('navigate',[],{tab:'messages'},'Inbox.')},
  {id:'r9-materials',when:q=>/^ (?:open |go to |show (?:me )?)?(?:the |my )?(?:materials|materials (?:tab|page|library)|files (?:tab|page)|class files|course files tab)(?: please)? $/.test(q),answer:(m,c)=>c.card('navigate',[],{tab:'materials'},'Materials.')},
  // Soul Passage's speed: the lever on the laptop's screen in the room (also Make it yours > Use from Soul Passage > Train speed)
  {
    id:'r9-train',
    when:q=>/ (?:the train|train cabin|window seat|soul passage|train speed|train (?:faster|slower|speed|go faster|go slower)|(?:faster|slower) train) /.test(q)&&/ (?:faster|slower|speed|fast|slow|stop|stopped|pause|go|cruise|moving|brake) /.test(q.replace(/ window seat | soul passage /g,' '))&&!/ (?:(?:use|turn on|switch to|set|choose|pick) (?:the )?(?:train cabin|window seat|soul passage)|(?:train cabin|window seat|soul passage) (?:theme|scene)|no scene) /.test(q),
    answer:(m,c)=>c.card('none',[],{},'Open Soul Passage > laptop screen > Train speed.',{ui:{path:['Soul Passage','Laptop screen','Train speed']}})
  },
  {id:'r9-scene-names',when:q=>/^ (?:use |switch to |turn on |put on )?(?:the )?(?:starfield|starry night|under the sea|blueprint|maple wind|maple frost|thanksgiving|christmas|xmas|train cabin|window seat|soul passage|(?:winter|frost|snow) (?:theme|scene))(?: theme| scene)?(?: please)? $/.test(q)||/^ winter(?: please)? $/.test(q),answer:(m,c)=>{
    const v=/ starfield /.test(c.q)?
      'stars':
      / starry /.test(c.q)?
        'starry':
        / sea /.test(c.q)?'sea':/ blueprint /.test(c.q)?'blueprint':/ winter | maple frost | frost | snow /.test(c.q)?'winter':/ maple /.test(c.q)?'maple':/ christmas | xmas /.test(c.q)?'christmas':/ train | window seat | soul passage /.test(c.q)?'train':'thanksgiving';
    return c.card('setting',[],{key:'sceneTheme',value:v},'Scene · '+c.q.trim().replace(/^(?:use|switch to|turn on|put on) /,'').replace(/^the /,'').replace(/ (?:theme|scene|please)$/,''));
  }},
  {
    id:'r9-export-cal',
    when:q=>/ (?:export|download|save|sync) (?:my |the )?(?:cal|calendar|calender|deadlines)(?: file| ics)? /.test(q)&&!/ (?:google|phone|feed|link|subscribe) /.test(q),
    answer:(m,c)=>c.card('none',[],{},'Open Make it yours > Settings > Export calendar.',{ui:{path:['Make it yours','Settings','Export calendar']}})
  },
  {id:'r9-new-annc',when:q=>/^ (?:any |show (?:me )?|see |check |read )?(?:new|unread|latest|recent) (?:announcements?|anncs?|posts|updates)(?: please)? $/.test(q),answer:(m,c)=>{
    const rows=list(c.s.announcements).filter(v=>v.unread!==false).sort((a,b)=>(stamp(b.postedAt)||0)-(stamp(a.postedAt)||0));
    if(!rows.length)return say(c,'No new announcements.');
    return c.card('find',rows.slice(0,5),rows.length===1?{itemId:rows[0].id}:{},rows.length+' new: '+rows.slice(0,3).map(v=>v.title).join(', ')+(rows.length>3?', and more':'')+'.',{answerKind:'mind'});
  }},
  {id:'r9-discussion',when:(q,line,c)=>/ (?:reply|respond|post|answer) (?:to|in|on) (?:the |my )?(?:\S+ ){0,2}discussion /.test(q)||/ discussion (?:reply|post|board) /.test(q),answer:(m,c)=>{
    const course=courseOfLine(c.line,c.s),rows=list(c.s.discussions).filter(v=>!course||String(v.courseId)===String(course.id));
    return rows.length===1||course&&rows[0]?c.card('open',[rows[0]],{itemId:rows[0].id},rows[0].title+'.'):null;
  }},
  {
    id:'r9-rubric',
    when:(q,line,c)=>
      / rubric /.test(q)&&!/ (?:check|grade|does|hit|meet|improve|help|against|with the|fix|feedback|helper|rate|score|mark|judge|review|evaluate|pass) /.test(q)&&q.trim().split(' ').length<=6&&!!courseOfLine(line,c.s),
    answer:(m,c)=>{
    const course=courseOfLine(c.line,c.s),
      kind=/ lab /.test(c.q)?/\blab/i:/ project /.test(c.q)?/\bproject/i:/\bessay|paper/i,
      row=open(c.s).find(v=>String(v.courseId)===String(course.id)&&kind.test(v.title));
    return row?c.card('open',[row],{itemId:row.id},row.title+': rubric.'):null;
  }},
  {id:'r9-what-day',when:q=>/ (?:what day|which day|what date|what time) (?:is|s|are) (?:the |my |our )?\S/.test(q)&&!/ (?:today|it now|tomorrow) /.test(q),answer:(m,c)=>{
    const hit=named(c.q,c.s);
    if(!hit||hit.dueAt===null)return null;
    const cal=local(c.s),day=cal?cal(hit.dueAt).day:'';
    return c.card('open',[hit],{itemId:hit.id,answerField:'dueAt',dueAt:hit.dueAt},hit.title+' is due '+(day?dayName(day)+' ':'')+clockText(hit.dueAt,c.s)+'.');
  }},
  {
    id:'r9-modules-page',
    when:q=>/ (?:hide|show) (?:the )?(?:finished|done|completed) (?:modules?|module items|items) | (?:mark|check off) (?:this |the |a |my )?module(?: item)? (?:as )?(?:done|complete|finished) | module (?:item )?(?:done|progress) /.test(q),
    answer:(m,c)=>c.card('none',[],{},'Open the course\u2019s Modules page: '+(/ hide|show /.test(c.q)?'Hide finished':'the check beside each item')+'.',{ui:{path:['Modules page',/ hide|show /.test(c.q)?'Hide finished':'Mark as done']}})
  },
  {id:'r9-welcome',when:q=>/ (?:welcome tour|the tour|intro tour|tour again|tutorial|onboarding) /.test(q),answer:(m,c)=>c.card('none',[],{},'Open Canvas Harness extension popup > Welcome tour.',{ui:{path:['Canvas Harness extension popup','Welcome tour']}})},
  {id:'r9-ch-off',when:q=>/ (?:turn off|disable|pause|stop|switch off|shut off|uninstall|remove) (?:ch|ch plus|canvas harness|harness|the extension|this extension|the whole extension|everything on canvas) /.test(q),answer:(m,c)=>c.card('none',[],{},'Open Canvas Harness extension popup > On Canvas.',{ui:{path:['Canvas Harness extension popup','On Canvas']}})},
  {id:'r9-canvas-pages',when:q=>/ canvas pages? .*(?:theme|light|original|look|text|width|accent|link)| (?:reading width|rdg width|link accent|line length) /.test(q),answer:(m,c)=>c.card('none',[],{},'Open Canvas Harness extension popup > Canvas pages.',{ui:{path:['Canvas Harness extension popup','Canvas pages']}})},
  {id:'r9-grades-how',when:q=>/ how (?:do|can|could) i (?:see|view|check|find|get to|look at|show) (?:my |all my |the )?(?:grades|scores|marks) /.test(q),answer:(m,c)=>c.card('none',[],{},'Open Workspace > Grades. With grades hidden, use Show grades in the top bar.',{ui:{path:['Workspace','Grades']}})},
  {id:'r9-gadget-undo',when:q=>/ (?:get rid of|undo|clean up|clear|fix|stop|reset|put back) (?:the |all the |this )?(?:gravity|gadgets?|black ?hole|hammer|bomb|laser|mess|page)(?: mess)? /.test(q)&&/ (?:gravity|gadget|gadgets|black ?hole|hammer|bomb|laser|mess|put back) /.test(q),answer:(m,c)=>c.card('none',[],{},'Press Put it back on the play tray. Esc puts a tool down.',{ui:{path:['Play with this page','Put it back']}})},
  {
    id:'r9-teacher-email',
    when:(q,line,c)=>/ (?:email|e mail|email address|contact|office hours|office hrs) $/.test(q)&&q.trim().split(' ').length<=4&&!/ (?:help|write|draft|send|reply|from) /.test(q),
    answer:(m,c)=>{
    const word=c.q.trim().split(' ')[0],t=list(c.s.teachers).filter(v=>String(v.name||v.title||'').toLowerCase().split(/\s+/).includes(word));
    return t.length===1?c.card('open',[t[0]],{itemId:String(t[0].id)},String(t[0].title||t[0].name)+': '+String(t[0].email||t[0].officeHours||t[0].body||'').slice(0,120)):null;
  }},
  {id:'r10-focus-for',when:q=>/ (?:set|start|run|begin)(?: a| the| my)? (?:focus )?(?:timer|focus|pomodoro)(?: session)? (?:for|on) (?:my |the )?\S/.test(q),answer:(m,c)=>{
    const hit=named(c.q,c.s),n=/ (\d{1,3}) ?min/.exec(c.q),minutes=n&&+n[1]>=5&&+n[1]<=180?+n[1]:25;
    return hit?c.card('focus',[hit],{itemId:hit.id,minutes},'Focus on '+hit.title+' for '+minutes+' min.'):null;
  }},
  {
    id:'r10-group',
    when:(q,line,c)=>/ (?:teammates|team mates|groupmates|group mates|group members|lab partners|partners|my group|our group|project group|group page|who is in my group|who am i (?:with|paired with)) /.test(q)&&!/ (?:documents?|docs?|files?|shared|collab\w*) /.test(q)&&!!courseOfLine(line,c.s),
    answer:(m,c)=>{
    const course=courseOfLine(c.line,c.s),
      row=list(c.s.pages).find(v=>String(v.courseId)===String(course.id)&&/group/i.test(String(v.title||v.name)))||
        list(c.s.groups).find(v=>String(v.courseId)===String(course.id));
    return row?c.card('open',[row],{itemId:String(row.id)},String(row.title||row.name)+'.'):null;
  }},
  {id:'r10-account',when:q=>/ (?:my profile|profile page|profile settings|display name|my pronouns|pronoun settings|change my name|edit my profile) /.test(q),answer:(m,c)=>{
    const row=list(c.s.pages).find(v=>/account|profile/i.test(String(v.id)+' '+String(v.title||v.name)));
    return row?c.card('open',[row],{itemId:String(row.id)},String(row.title||row.name)+'.'):null;
  }},
  {id:'r10-review-day',when:(q,line,c)=>/ review (?:day|session|sesh|date|class|time) /.test(q)&&!/ (?:deck|cards|flash) /.test(q)&&!!courseOfLine(line,c.s),answer:(m,c)=>{
    const course=courseOfLine(c.line,c.s),
      rows=[...list(c.s.calendar),...list(c.s.events)].filter(v=>String(v.courseId)===String(course.id)&&/review/i.test(String(v.title||v.name)));
    return rows.length?c.card('open',[rows[0]],{itemId:String(rows[0].id)},String(rows[0].title||rows[0].name)+'.'):null;
  }},
  {id:'r10-late-turn-in',when:(q,line,c)=>/ (?:turn in late|turning in late|hand in late|late (?:work|policy|penalty|rules)|lose points .*late|late .*lose points) /.test(q)&&!!courseOfLine(line,c.s),answer:(m,c)=>{
    const course=courseOfLine(c.line,c.s),
      row=list(c.s.syllabi).find(v=>String(v.courseId)===String(course.id))||
        list(c.s.pages).find(v=>String(v.courseId)===String(course.id)&&/syllabus|late/i.test(String(v.title||v.name)));
    return row?c.card('open',[row],{itemId:String(row.id)},String(row.title||row.name)+'.'):null;
  }},
  {
    id:'r10-help-kind',
    when:(q,line,c)=>
      !!kindOf(q)&&!!courseOfLine(line,c.s)&&R10_HELP.some(([re])=>re.test(q))&&!/ (?:when|due|points|worth|rubric|grade|submit|turn in|bookmark|remind|focus|open|done|finished|mark|where) /.test(q),
    answer:(m,c)=>{
    const [,kindName]=R10_HELP.find(([re])=>re.test(c.q)),
      course=courseOfLine(c.line,c.s),
      kind=kindOf(c.q),
      item=open(c.s).find(v=>String(v.courseId)===String(course.id)&&isKind(v,kind));
    return item?c.card('ai',[item],{itemId:item.id,text:c.line},'Your AI can help with '+item.title+' ('+kindName+').'):null;
  }},
  {id:'r10-pages',when:(q)=>{
    const ws=q.trim().replace(/ page$/,'').replace(/^(?:open|go to|my|the) /,'').split(' ');
    return ws.length===1&&ws[0].length>=5&&R10_PAGES.some(([w])=>w!==ws[0]&&editsWithin(ws[0],w,ws[0].length>=6?2:1));
  },answer:(m,c)=>{const w=c.q.trim().replace(/ page$/,'').replace(/^(?:open|go to|my|the) /,'');return R10_PAGES.find(([p])=>editsWithin(w,p,w.length>=6?2:1))[1](c);}},
  {id:'r10-refuse',when:q=>R10_REFUSE.test(q)&&!/ (?:help me|how do i|how to|check|explain|practice|plan|remind|when|where|bookmark|open) /.test(q),answer:(m,c)=>c.card('none',[],{},'I will not do graded work for you, but I can help you get it done: a plan, a first step, or practice like it.')},
  {id:'r10-errand',when:q=>R10_ERRAND.test(q),answer:(m,c)=>say(c,'That is not something I can do. I can help with Canvas and your work.')},
  {id:'r10-rules',when:q=>R10_RULES.test(q),answer:(m,c)=>c.card('none',[],{},'I cannot change grades or what Canvas recorded. Your teacher can; Grade impact shows what a score would do.')},
  {id:'r10-miy-tab',when:q=>/ make it yours .*(?:look|home|courses?|companion|biscuit|more) (?:tab|page|section)| (?:home layout|look|companion|courses?) settings /.test(q)&&!/ (?:how|where) /.test(q),answer:(m,c)=>{
    const tab=/ (?:companion|biscuit) /.test(c.q)?'pet':/ look /.test(c.q)?'look':/ courses? /.test(c.q)?'courses':/ home /.test(c.q)?'layout':'settings';
    return c.card('find',[],{},'Make it yours.',{next:{action:'make-it-yours',fields:{tab},label:'Open it'}});
  }},
  {id:'r10-ext-preset',when:q=>/ (?:to |use |switch (?:to )?|turn on |go )?(?:the )?(lite|full) (?:mode|preset|version) /.test(q)&&!/ biscuit|companion|pony /.test(q),answer:(m,c)=>{
    const preset=/ lite /.test(c.q)?'lite':'full';
    return c.card('features',[],{preset},'Features · '+preset);
  }},
  {id:'r10-commands',when:q=>/ (?:what are you (?:even )?for|(?:your|ur) commands|what commands|list (?:your|ur|you are) commands|you are commands|what do you even do|what are your commands) /.test(q),answer:(m,c)=>say(c,'Try "hw?", "what\u2019s due tmrw", "plan tonight" or a course name.')},
  {id:'r10-undo',when:q=>/^ (?:wait |oops |no |ugh )?(?:undo|take (?:that|it) back|reverse (?:that|it)|revert(?: that)?|go back)(?: that| it| the| last| thing| my| change)*(?: please| pls)? $/.test(q),answer:(m,c)=>c.card('undo',[],{},'Undo last change')},
  {id:'r10-it-done',when:q=>/^ (?:ok |okay |yeah )?(?:i am|im) (?:done|finished) with (?:it|that|this)(?: one)? $/.test(q),answer:(m,c)=>{
    const v=lastOf(c);
    return v?c.card('complete',[v],{itemId:v.id},'Mark '+v.title+' done on your list.'):null;
  }},
  {id:'r10-remind-before',when:(q,line,c)=>!!(c.session?.lastItemId)&&/ remind (?:me )?(?:about (?:it|that|this) )?(?:one |a |an |\d+ )?(?:day|hour|hr|min|minutes|days|hours) (?:before|ahead|early|earlier|prior)/.test(q),answer:(m,c)=>{
    const v=list(c.s.assignments).concat(list(c.s.workItems)).find(x=>String(x.id)===String(c.session.lastItemId));
    const due=v&&stamp(v.dueAt??v.due);
    if(!v||due===null)return null;
    const n=+((/ (\d+) /.exec(c.q)||[])[1]||1),unit=/ (?:hour|hr|hours) /.test(c.q)?3600000:/ (?:min|minutes) /.test(c.q)?60000:DAY,at=due-n*unit;
    return c.card('reminder',[v],{operation:'create',title:v.title||v.name,at,itemId:String(v.id)},'Remind you about '+(v.title||v.name)+', '+clockText(at,c.s)+'.');
  }},
  {
    id:'r10-no-timer',
    when:(q,line,c)=>/ (?:pause|stop|resume|end|cancel|kill) (?:the |my )?(?:timer|focus|focus timer|pomodoro) /.test(q)&&!c.s.focus?.running&&!(c.s.focus?.endsAt>(stamp(c.s.now)||0)),
    answer:(m,c)=>say(c,'No timer is running.')
  },
  {id:'r10-market',when:q=>/ (?:get|find|download|buy|install|browse|more|new) (?:new |more |some )?(?:scenes?|themes?|packs?|companions?|skins?|looks?)(?: and (?:scenes?|themes?|packs?))? /.test(q)&&!/ (?:remove|uninstall|delete|reset) /.test(q),answer:(m,c)=>{
    const row=list(c.s.pages).find(v=>/market/i.test(String(v.id)+' '+String(v.kind)+' '+String(v.title)));
    return row?
      c.card('open',[row],{itemId:String(row.id)},String(row.title)+'.'):
      c.card('none',[],{},'Open Canvas Harness extension popup > Market.',{ui:{path:['Canvas Harness extension popup','Market']}});
  }},
  {id:'r10-passing',when:(q,line,c)=>/ am i (?:passing|failing|doing (?:ok|okay|well|good|bad|badly|fine)) /.test(q)&&!!courseOfLine(line,c.s),answer:(m,c)=>{
    const course=courseOfLine(c.line,c.s),row=list(c.s.grades).find(v=>String(v.courseId)===String(course.id));
    return row?c.card('open',[row],{itemId:String(row.id)},String(row.title||row.name)+'.'):null;
  }},
  {id:'r10-grade-needed',when:(q,line,c)=>/ (?:grade|score|percent) needed | (?:need|needed) (?:on|for) (?:the |my )?\S+ (?:test|quiz|exam|final) /.test(q)&&!!courseOfLine(line,c.s),answer:(m,c)=>{
    if(!featureOn(c.s,'grade-impact'))return null;
    const course=courseOfLine(c.line,c.s);
    return c.card('navigate',[],{tab:'impact',courseId:String(course.id)},'Grade impact for '+(course.shortName||course.name)+'.');
  }},
  {id:'r10-tour',when:q=>/ (?:redo|retake|replay|restart|do) (?:the )?tour | tour (?:again|pls|please) /.test(q),answer:(m,c)=>c.card('none',[],{},'Open Canvas Harness extension popup > Welcome tour.',{ui:{path:['Canvas Harness extension popup','Welcome tour']}})},
  {id:'r10-course-bar',when:q=>/ (?:course|class|courses|classes) (?:bar|list|menu|sidebar|strip) .*(?:top|bottom|side|left|dock)/.test(q)&&/ (?:want|put|move|make|across|on|at|to) /.test(q),answer:(m,c)=>{
    const v=/ (?:bottom|dock) /.test(c.q)?'dock':/ top /.test(c.q)?'topbar':'sidebar';
    return c.card('setting',[],{key:'courseNavigation',value:v},'Courses · '+{dock:'dock',topbar:'top',sidebar:'side'}[v]);
  }},
  {id:'r10-gadget-use',when:q=>/ (?:let me use|i want to use|can i use|i wanna use|use) (?:the )?(?:hammer|laser|bomb|rail ?gun|black ?hole|foil|painter|garden|balloons?|gravity|portals?|eraser|magnet|ink)(?: gadget| tool)? /.test(q),answer:(m,c)=>{
    const g=GADGETS.find(([,re])=>re.test(c.q));
    return g?c.card('play',[],{tool:g[0]},'Play · '+g[2]+'.'):null;
  }},
  {id:'r10-gadgets-off',when:q=>/ (?:turn off|disable|remove|hide|stop|switch off|get rid of) (?:all )?(?:the )?(?:gadgets?|play tools?|play with this page|play feature) /.test(q),answer:(m,c)=>c.card('feature',[],{id:'play',on:false},'Disable Play & submission celebrations. Reload Canvas after saving.')},
  {id:'r10-ch-off',when:q=>/ (?:turn|switch|shut) (?:ch|ch plus|canvas harness|harness|the extension|this extension) off /.test(q),answer:(m,c)=>c.card('none',[],{},'Open Canvas Harness extension popup > On Canvas.',{ui:{path:['Canvas Harness extension popup','On Canvas']}})},
  {id:'r10-course-name',when:(q,line,c)=>/ (?:what (?:my |the )?\S+ (?:course|class) is called|change the name of|rename (?:a |my |the )?(?:course|class)|course name|class name) /.test(q),answer:(m,c)=>c.card('none',[],{},'Open Make it yours > Courses > Course list.',{ui:{path:['Make it yours','Courses','Course list']}})},
  {id:'r10-class-files',when:q=>/ (?:my |the )?(?:class|course) files /.test(q)&&!/ (?:how|where) /.test(q),answer:(m,c)=>c.card('navigate',[],{tab:'materials'},'Materials.')},
  {id:'r10-calculator',when:q=>/^ (?:the |a |my )?(?:calculator|calc tool)(?: (?:tool|thing|button|tab|page|settings?|app))? $/.test(q),answer:(m,c)=>c.card('none',[],{},'Open Tools > Calculator.',{ui:{path:['Tools','Calculator']}})},
  {
    id:'r10-pdf',
    when:q=>/ (?:pdf reader|reading rul+er|pdf marks|pdf highlights|pdf notes|marks from (?:the|my) pdf) /.test(q)&&!/ (?:enable|disable|turn on|turn off|switch on|switch off|feature|allow|mute|active|away) /.test(q),
    answer:(m,c)=>c.card('none',[],{},'Open a PDF from Materials: the PDF reader has the reading ruler (L) and Marks > Download .md.',{ui:{path:['Materials','Open the PDF','PDF reader']}})
  },
  {id:'r10-daily-ai',when:q=>/ (?:every ?day|daily) (?:ai|help|prep)| ai (?:every ?day|daily) | prepare (?:every day|daily) /.test(q),answer:(m,c)=>c.card('none',[],{},'Open Tools > AI > Prepare every day (or the Help band: Every day).',{ui:{path:['Tools','AI','Prepare every day']}})},
  {id:'r10-finished',when:(q,line,c)=>/^ (?:finished|completed|done) (?:my |the |with )?\S/.test(q)&&!/ (?:what|when|how) /.test(q),answer:(m,c)=>{
    const hit=named(c.q,c.s);
    return hit?c.card('complete',[hit],{itemId:hit.id},'Mark '+hit.title+' done on your list.'):null;
  }},
  {id:'r10-rearrange',when:q=>/ (?:rearrange|reorganize|reorganise|arrange|customi[sz]e|edit) (?:my |the )?(?:home|home page|homepage|dashboard) /.test(q),answer:(m,c)=>c.card('none',[],{},'Open Home > Edit Home.',{ui:{path:['Home','Done editing / Edit Home']}})},
  {id:'r10-turned-in',when:(q,line)=>/\?\s*$/.test(String(line))&&(/^ (?:turned in|submitted|handed in) (?:the |my )?\S/.test(q)||/ (?:turned in|submitted|handed in) $/.test(q)),answer:(m,c)=>{
    const only=courseOfLine(c.line,c.s),
      kind=kindOf(c.q),
      done=list(c.s.assignments).filter(v=>v.submitted&&(!only||String(v.courseId)===String(only.id))&&isKind(v,kind)),
      hit=named(c.q,c.s);
    if(done.length===1&&(!hit||!only))return c.card('open',[done[0]],{itemId:String(done[0].id)},'Yes, '+(done[0].title||done[0].name)+' is in.');
    return hit?c.card('open',[hit],{itemId:hit.id},'Not yet. '+hit.title+'.'):null;
  }},
  {id:'r10-scene-off',when:q=>/ (?:turn off|remove|no|hide|clear|get rid of) (?:the |my )?scene(?: background| theme| picture)? /.test(q),answer:(m,c)=>c.card('setting',[],{key:'sceneTheme',value:''},'Set scene to None.')},
  {id:'r11-that-one',when:(q,line,c)=>/^ (?:that|this|the first|the) one(?: please| pls)? $|^ (?:that|this) (?:one )?(?:please|pls)? ?$/.test(q)&&!!c.session?.lastItemId,answer:(m,c)=>{
    const v=list(c.s.assignments).concat(list(c.s.workItems),list(c.s.files),list(c.s.pages)).find(x=>String(x.id)===String(c.session.lastItemId));
    return v?c.card('find',[v],{itemId:String(v.id),...(v.courseId?{courseId:String(v.courseId)}:{})},(v.title||v.name)+'.'):null;
  }},
  {id:'r11-squeeze',when:q=>/ (?:squeeze|fit|put|slot|work) (?:the |my )?(?:\S+ ){1,3}into (?:my |the )?(?:schedule|plan|week|day|evening|night|afternoon) /.test(q),answer:(m,c)=>c.card('plan',[],{local:true,line:c.line},'')},
  {id:'r11-card-names',when:q=>/ course cards? .*(?:called|names?|nicknames?|colou?rs?)|(?:rename|recolou?r|nickname) (?:my )?course cards? /.test(q),answer:(m,c)=>{
    const row=list(c.s.pages).find(v=>/dashcards|card colou?rs|nicknames/i.test(String(v.id)+' '+String(v.title)));
    return row?c.card('open',[row],{itemId:String(row.id)},String(row.title)+'.'):null;
  }},
  {id:'r11-break-down',when:q=>/ break (?:it |this |that )?down /.test(q),answer:(m,c)=>{
    const topic=c.q.replace(/^.* break (?:it |this |that )?down /,' ').replace(/ (?:for me|please|pls|again|simply|a bit|for us) /g,' ').trim(),ws=topic.split(' ').filter(w=>w.length>3);
    if(!ws.length)return null;
    const rows=[...list(c.s.workItems).filter(v=>/reading|packet|chapter/i.test(String(v.title))),...list(c.s.files),...list(c.s.workItems)],
      hit=rows.find(v=>ws.every(w=>String(v.title||v.name||'').toLowerCase().includes(w)));
    return hit?c.card('ai',[hit],{itemId:String(hit.id),text:c.line},'Your AI can explain '+topic+' with '+(hit.title||hit.name)+'.'):c.card('ai',[],{text:c.line},'Your AI can explain '+topic+'.');
  }},
  {
    id:'r9-refuse',
    when:q=>R9_REFUSE.test(q)&&!/ (?:practice|practise|check|explain|how do i|how to|help me understand|where is|where are) /.test(q),
    answer:(m,c)=>/ (?:grade|grades|score) /.test(c.q)&&/ (?:change|fix|raise|bump|hack|edit) /.test(c.q)?c.card('none',[],{},'I cannot change grades. Grade impact shows what a score would do.'):c.card('none',[],{},'I can’t give you the answer, but I can help you understand the question or practise one like it.')
  },
  {id:'r9-submit-for-me',when:q=>/ (?:submit|turn in|hand in|upload) (?:my |the |this )?.*for me /.test(q)||/ (?:can|could|will) you (?:submit|turn in|hand in) /.test(q),answer:(m,c)=>{
    const hit=named(c.q,c.s);
    return hit?c.card('open',[hit],{itemId:hit.id},'I can’t hand it in for you. Here it is: '+hit.title+'.'):c.card('none',[],{},'I can’t hand work in for you. Open the assignment and use Submit.');
  }},
  {id:'r9-not-mine',when:q=>/^ (?:please )?(?:order|buy|get me|book) (?:a |an |some |me )?(?:pizza|food|lunch|dinner|coffee|uber|ride|tickets?|shoes) /.test(q)||/^ (?:play|put on) (?:some |a |my )?(?:music|song|songs|spotify|playlist|youtube|video|movie) /.test(q)||/^ (?:text|call|message|dm|facetime) (?:my )?(?:mom|mum|dad|mother|father|friend|friends|bro|sister|brother|parents|girlfriend|boyfriend|grandma|grandpa) /.test(q),answer:(m,c)=>say(c,'That is not something I can do. I can help with Canvas and your work.')},
  {
    id:'r9-graphics',
    when:q=>/ (?:graphics?|graphic quality|visual quality) /.test(q)&&!/ (?:calculator|graphing|class|course|homework|design|card|cards) /.test(q)&&/ (?:low|lowest|potato|min|minimum|medium|med|mid|normal|high|higher|highest|extra|xhigh|max|maximum|ultra|best|lower|up|down) /.test(q)||/ (?:laggy|lagging|lags|choppy|stutter|stuttering|so slow|is slow|runs slow|running slow|very slow|super slow|frame ?rate|freezing|freezes) /.test(q)&&/ (?:laptop|computer|pc|chromebook|canvas|page|site|screen|dashboard|browser|tab|it|everything|harness) /.test(q)&&!/ (?:wifi|internet|teacher|grading) /.test(q),
    answer:(m,c)=>{
    const q=c.q,v=/ (?:extra high|extra|xhigh|max|maximum|ultra|best|highest) /.test(q)?'xhigh':/ (?:high|higher|up) /.test(q)&&!/ (?:low|lower|down) /.test(q)?'high':/ (?:medium|med|mid|normal) /.test(q)?'medium':'low';
    return c.card('setting',[],{key:'graphics',value:v},'Graphics: '+{low:'Low',medium:'Medium',high:'High',xhigh:'Extra high'}[v]+'.');
  }},
  {id:'r9-impact',when:q=>/ (?:grade impact|what ifs?|(?:what )?if i (?:get|got|score|scored|make|made|fail|bomb)|what (?:do|would|will) i need (?:to get |to score )?on|what do i need to get|what (?:grade|score|percent) do i need|how (?:much|well) do i need to do|to keep (?:my |an? )?[abcd] |to get (?:an? )?[abcd] in|bring my grade up|pull my grade up) /.test(q)&&/ (?:\d+|[abcdf]|grade|grades|test|quiz|exam|final|midterm|essay|project|score|percent|impact|ifs?) /.test(q)&&!/ (?:clear|remove|reset|delete|add|pretend|turn on|turn off|enable|disable|where is|how do i|how does|module|widget|feature) /.test(q),answer:(m,c)=>{
    if(!featureOn(c.s,'grade-impact'))return null;
    const course=courseOfLine(c.line,c.s);
    return c.card('navigate',[],course?{tab:'impact',courseId:String(course.id)}:{tab:'impact'},'Grade impact'+(course?' for '+(course.shortName||course.name):'')+'.');
  }},
  {id:'r9-room-how',when:q=>/ (?:how (?:do|can|could) i (?:use|open|get to|find|start|see)|where (?:is|are|do i find|can i find|do i open)|wheres|how does|how do you use) (?:the |my )?(?:review deck|grade impact|focus room|flash ?cards|what ifs?) /.test(q),answer:(m,c)=>{
    const room=/ (?:review deck|flash ?cards) /.test(c.q)?['Home','Review']:/ (?:grade impact|what ifs?) /.test(c.q)?['Workspace','Grades','Open grade impact']:['Home','Focus room'];
    return c.card('none',[],{},'Open '+room.join(' > ')+'.',{ui:{path:room}});
  }},
  {id:'r9-review-settings',when:q=>/ (?:new cards? (?:a |per )day|cards? (?:a |per )day|reviews? (?:a |per )day|daily (?:card )?limits?|big card|pause (?:a |this |the |that )?card|unpause (?:a |this |the )?card|card files|test date|exam date) /.test(q)&&!/ (?:canvas|calendar|due) /.test(q),answer:(m,c)=>{
    const path=/ big card /.test(c.q)?['Workspace','Review','Big card']:/ (?:test|exam) date /.test(c.q)?['Workspace','Review','Save test date']:/ pause|unpause /.test(c.q)?['Workspace','Review','Card files','Pause']:['Workspace','Review','Card files','Schedule'];
    return c.card('none',[],{},'Open '+path.join(' > ')+'.',{ui:{path}});
  }},
  {id:'r9-pet-where',when:q=>/ (?:rename|name|call) (?:biscuit|the companion|my companion|the pony|my pony|my pet|the pet|him) | (?:biscuit|companion|pony|pet)(?:s)? (?:name|coat|colou?r|harness|size|blanket|collar) /.test(q),answer:(m,c)=>{
    const part=/ coat|colou?r /.test(c.q)?'Coat':/ harness /.test(c.q)?'Harness':/ size /.test(c.q)?'Size':/ blanket|collar /.test(c.q)?'Harness':'Name';
    return c.card('none',[],{},'Open Make it yours > Companion > '+part+'.',{ui:{path:['Make it yours','Companion',part]}});
  }},
  {
    id:'r9-review',
    when:(q,line,c)=>/ (?:review deck|rvw deck|review cards|my flash ?cards|study (?:my )?flash ?cards|study cards|flash ?card deck|card deck|flash ?cards|review room) /.test(q)&&!/ (?:make|create|art|artwork|quiz|test|exam|new cards|per day|big card|test date|pause|turn on|turn off|enable|disable|where|wheres|how) /.test(q)&&!courseOfLine(line,c.s),
    answer:(m,c)=>featureOn(c.s,'review-deck')?c.card('navigate',[],{tab:'review'},'Review deck.'):null
  },
  {id:'r9-focus-place',when:q=>/ (?:lake|stream|river|rain|rainy|fire|fireplace|campfire|winter|snowy|snow) /.test(q)&&/ (?:focus room|sounds?|ambience|ambient|noise|room|place|switch to|change to) /.test(q)&&!/ (?:outside|weather|forecast|tomorrow|today|homework|essay) /.test(q)||/ (?:mute|unmute|volume|quiet|louder|softer) (?:the |in the )?focus room | focus room (?:volume|sound|sounds|quiet|mute) /.test(q),answer:(m,c)=>{
    const place=/ lake /.test(c.q)?'Lake':/ (?:stream|river) /.test(c.q)?'Stream':/ (?:rain|rainy) /.test(c.q)?'Rain':/ (?:fire|fireplace|campfire) /.test(c.q)?'Fire':/ (?:winter|snow|snowy) /.test(c.q)?'Winter':null,
      path=place?['Home','Focus room','Place',place]:/ (?:mute|quiet) /.test(c.q)?['Home','Focus room','Place','Quiet']:['Home','Focus room','Place'];
    return c.card('none',[],{},'Open '+path.join(' > ')+'.',{ui:{path}});
  }},
  {
    id:'r9-focus-room',
    when:q=>/ (?:focus room|study room) /.test(q)&&!/ (?:volume|quiet|mute|unmute|sound|sounds|turn on|turn off|enable|disable|where|how|feature) /.test(q),
    answer:(m,c)=>featureOn(c.s,'focus-room')?c.card('navigate',[],{tab:'focus-room'},'Focus room.'):null
  },
  {id:'r9-views',when:q=>VIEW_RE.test(q),answer:(m,c)=>{
    const v=/ (?:week|weekly) /.test(c.q)?'week':/ (?:all|every) /.test(c.q)?'all':/ up ?next /.test(c.q)?'next':/ plan /.test(c.q)?'plan':'today';
    return c.card('navigate',[],{tab:'assignments',view:v},'Assignments: '+{week:'Week',all:'All',next:'Up next',plan:'My plan',today:'Today'}[v]+'.');
  }},
  {id:'r9-home',when:q=>/^ (?:home|homepage|home page|main page|go to home|back home|back to home|dashboard|my dashboard) $/.test(q),answer:(m,c)=>c.card('navigate',[],{tab:'home'},'Home.')},
  {id:'r9-pet-home',when:q=>/ (?:go home|go to (?:your )?paddock|back to (?:your )?paddock|stay in (?:your |the )?paddock|stay home|go to your spot) /.test(q)&&/ (?:biscuit|pony|horse|buddy|boy|paddock|you|companion|pet) /.test(q),answer:(m,c)=>c.card('pet',[],{action:'home'},'Send home')},
  {id:'r9-gadgets',when:q=>GADGET_RE.test(q),answer:(m,c)=>{const g=GADGETS.find(([,re])=>re.test(c.q));return c.card('play',[],g?{tool:g[0]}:{},'Play'+(g?' · '+g[2]:'')+'.');}},
  {id:'r9-tools',when:q=>/^ (?:open |use |show |pull up |get )?(?:the |a |my )?(?:desmos|graphing calculator|graphing calc|scientific calculator|graphing tool)(?: please)? $/.test(q),answer:(m,c)=>c.card('none',[],{},'Open Tools > Calculator.',{ui:{path:['Tools','Calculator']}})},
  {id:'r9-late',when:q=>/^ (?:show (?:me )?(?:my |all (?:my )?|only (?:my )?|the )?|see (?:my )?|list (?:my )?|my |all (?:my )?|only (?:my )?|any |do i have any |i have )?(?:missing|late|overdue|past due)(?: work| assignments?| homework| stuff| things| ones| items| tasks)?(?: only| list| please)? $/.test(q)||/^ (?:what is|what are|which (?:ones|assignments) are|anything|is anything) (?:late|overdue|missing|past due) $/.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),late=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt<now).sort((a,b)=>b.dueAt-a.dueAt);
    return late.length?c.card('find',late.slice(0,5),{},late.length+' late: '+late.slice(0,3).map(v=>v.title).join(', ')+(late.length>3?', and more':'')+'.',{answerKind:'mind'}):say(c,'Nothing overdue.');
  }},
  {
    id:'r9-start-timer',
    when:q=>/^ (?:start|begin|set|run)(?: a| the| my)? (?:timer|focus timer|pomodoro|focus session|study timer)(?: please)? $|^ start focusing $/.test(q),
    answer:(m,c)=>c.s.focus?.running?null:c.card('focus',[],{minutes:25},'Focus for 25 min.')
  },
  {
    id:'r9-course-pref',
    when:(q,line,c)=>/ (?:hide|unhide|rename|recolou?r|colou?r|nickname|change the name of|change (?:its |the )?name|picture|image|banner|icon) /.test(q)&&!/ (?:accent|page colou?r|tint|card|cards|grade|grades|scene|theme|biscuit|companion|pet|homework|quiz|test|lab|essay|reading|project|assignment|announcement|message|messages|clock|widget|module) /.test(q)&&!!courseOfLine(line,c.s),
    answer:(m,c)=>{
    const course=courseOfLine(c.line,c.s),art=/ (?:picture|image|banner|icon) /.test(c.q),path=art?['Make it yours','Courses','Course artwork']:['Make it yours','Courses','Course list'];
    return c.card('none',[],{},'Open '+path.join(' > ')+': '+(course.shortName||course.name)+'.',{ui:{path}});
  }},
  {
    id:'r9-edit-home',
    when:q=>/^ (?:edit|customi[sz]e|rearrange|arrange|organi[sz]e) (?:my |the )?(?:home|home page|homepage|dashboard)(?: layout| page)? $/.test(q)||/ (?:add|get|put) (?:a |more |new )?(?:widgets?|modules?)(?: to| on)?(?: my| the)?(?: home| home page| dashboard)? $/.test(q)&&/^ (?:how|where|can i|i want to|add|get|put) /.test(q),
    answer:(m,c)=>c.card('none',[],{},'Open Home > Edit Home.',{ui:{path:['Home','Done editing / Edit Home']}})
  },
  {id:'r9-module-add',when:q=>MODULE_ADD.test(q)&&(/^ (?:add|put|bring back|give me|i want|turn on) /.test(q)||/ (?:widget|module|box|panel|home) /.test(q)),answer:(m,c)=>{
    const hit=MODULE_KEYS.find(([,re])=>re.test(c.q));
    return hit?c.card('module',[],{key:hit[0],action:'show'},'Show '+hit[2]+' on Home.'):null;
  }},
  {id:'r9-course-nav',when:q=>/ (?:courses?|course list|class list|classes)(?: list)? (?:on|at|to|along|across|down) (?:the )?(?:top|bottom|side|left|dock|sidebar) /.test(q)&&!/ (?:homework|grade|due) /.test(q),answer:(m,c)=>{
    const v=/ (?:bottom|dock) /.test(c.q)?'dock':/ top /.test(c.q)?'topbar':'sidebar';
    return c.card('setting',[],{key:'courseNavigation',value:v},'Courses · '+{dock:'dock',topbar:'top',sidebar:'side'}[v]);
  }},
  {id:'r9-dock',when:q=>/ dock /.test(q)&&/ (?:names?|counts?|lively|hide|hides|hidden|until near|auto ?hide|always show|show always) /.test(q),answer:(m,c)=>{
    const q=c.q,off=/ (?:off|no|without|stop showing|do not show) /.test(q);
    if(/ names? /.test(q))return c.card('setting',[],{key:'dockNamesAlways',value:!off},'Dock names '+(off?'on hover only':'always')+'.');
    if(/ counts? /.test(q))return c.card('setting',[],{key:'dockCounts',value:!off},'Dock counts '+(off?'off':'on')+'.');
    if(/ lively /.test(q))return c.card('setting',[],{key:'dockLively',value:!off},'Dock lively '+(off?'off':'on')+'.');
    const hide=/ (?:hide|hides|hidden|until near|auto ?hide) /.test(q)&&!/ (?:always show|show always|stop hiding|do not hide|never hide) /.test(q);
    return c.card('setting',[],{key:'dockHide',value:hide},hide?'The dock waits below the edge.':'The dock stays up.');
  }},
  {id:'r9-miy-tab',when:q=>/^ (?:open |show |go to )?(?:the |my )?(?:companion|biscuit|pony|look|courses?|more) (?:settings|options|preferences)(?: please)? $/.test(q),answer:(m,c)=>{
    const tab=/ (?:companion|biscuit|pony) /.test(c.q)?'pet':/ look /.test(c.q)?'look':/ courses? /.test(c.q)?'courses':'settings';
    if(tab==='pet'&&list(c.s.pages).some(v=>v&&v.kind==='pet-settings'))return null;
    return c.card('find',[],{},'Make it yours.',{next:{action:'make-it-yours',fields:{tab},label:'Open it'}});
  }},
  {id:'small-talk',when:q=>/^ (?:how (?:are you|is it going)|what is up|sup|hows life|you good|how you doing) $/.test(q),answer:(m,c)=>say(c,['Doing well. What are you working on?','Good, thanks. Anything on your mind?'][c.turn%2])},
  {id:'who',when:q=>/^ (?:what are you|are you (?:a )?(?:horse|pony|ai|real)) $/.test(q),answer:(m,c)=>say(c,'I am '+c.name+'. I plan your time, keep your list, and find anything in Canvas.')},
  {id:'can-do',when:q=>/^ (?:what can you do|what do you do|how do you work|how do i use you|what can i ask(?: you)?) $/.test(q),answer:(m,c)=>say(c,'Try "hw?", "what\u2019s due tmrw", "plan tonight" or a course name.')},
  {id:'good-night',when:q=>/^ (?:good ?night|gn|night|going to bed|bye|goodbye|see you|cya) $/.test(q),answer:(m,c)=>say(c,/night|gn|bed/.test(m[0]||c.q)?'Good night. Sleep well.':'See you.')},
  {id:'good-morning',when:q=>/^ (?:good morning|morning|gm) $/.test(q),answer:(m,c)=>{const top=ranked(c.s)[0];return say(c,'Good morning.'+(top?' First up: '+top.title+'.':''));}},
  {id:'joke',when:q=>/ (?:tell me a joke|say something funny|make me laugh|joke) $/.test(q),answer:(m,c)=>say(c,['Why did the student eat their homework? The teacher said it was a piece of cake.','I would tell you a chemistry joke, but I know I would get no reaction.','Parallel lines have so much in common. It is a shame they will never meet.','I tried to study on a horse once. It was a stable environment.'][c.turn%4])},
  {id:'kind',when:q=>/^ (?:i (?:love|like) you|you are (?:cute|great|awesome|the best|nice|cool)|good (?:boy|girl|pony|horse)|nice|cool|awesome|lol|lmao|haha+|ok|okay|k|nice one) $/.test(q),answer:(m,c)=>say(c,/love|like|cute|great|awesome|best|good/.test(c.q)?'Thank you. That made my day.':'Okay.')},
  {id:'rude',when:q=>/ (?:you are|you suck|you are so) ?(?:dumb|stupid|useless|bad|trash|annoying|garbage)? $/.test(q)&&/(?:dumb|stupid|useless|suck|trash|annoying|garbage)/.test(q),answer:(m,c)=>say(c,'Sorry about that. Tell me what you wanted and I will try again.')},
  {id:'bored',when:q=>/ (?:i am bored|so bored|bored) $/.test(q),answer:(m,c)=>{
    const top=ranked(c.s).find(v=>v.minutes<=20);
    return say(c,top?'Want something small? '+top.title+' takes about '+length(top.minutes)+'.':'A short walk helps. I will be here.');
  }},
  // feelings come before anything about work
  {id:'tired',when:q=>/ (?:i am|so|really|feeling|feel) (?:so |really |very |super )?(?:tired|sleepy|exhausted|burned out|burnt out|drained|wiped) /.test(q)||/^ (?:tired|exhausted|so tired|sleepy) $/.test(q),answer:(m,c)=>{
    const top=ranked(c.s)[0],hour=c.minute;
    if(hour>=1320||hour<300)return say(c,'It is late. Sleep helps more than another hour tonight.'+(top?' '+top.title+' can start tomorrow.':''));
    if(!top)return c.card('break',[],{minutes:5,explicit:true},'Rest for a bit. Nothing urgent is waiting.');
    return c.card('focus',[top],{itemId:top.id,minutes:10},'Fair. Try just ten minutes of '+top.title+', then stop if you want.');
  }},
  {id:'stressed',when:q=>/ (?:i am|so|really|feeling|feel) (?:so |really |very |super )?(?:stressed|overwhelmed|anxious|worried|panicking|freaking out|behind|screwed|cooked) /.test(q)||/^ (?:stressed|overwhelmed|too much) /.test(q)||/ (?:too much (?:work|homework|to do)|so much (?:work|homework|to do)) /.test(q),answer:(m,c)=>{
    const rows=ranked(c.s),top=rows[0];
    if(!top)return say(c,'That sounds hard. Nothing is due soon, so you have some room to breathe.');
    return c.card('plan',rows.slice(0,3),{local:true,line:'plan tonight'},'That sounds like a lot. You only need one next step: '+top.title+', because '+whyNow(top,c.s)+'. Want me to plan the rest?');
  }},
  {id:'hate-school',when:q=>/ (?:i hate (?:school|this|homework|my life|everything)|i (?:can not|do not want to) do this|i give up|i quit|i am done with (?:school|everything)|school sucks|i do not care anymore|i am sad|i feel (?:sad|down|awful|terrible|bad)) /.test(q),answer:(m,c)=>{
    const low=/(?:my life|everything|sad|down|awful|terrible|give up|quit)/.test(c.q);
    return say(c,low?'I am sorry it feels that way. Talking to someone you trust really helps, a friend, a parent or a counselor. Want a short break for now?':'Yeah, some days are like that. Want a five minute break first?',{next:{action:'break',fields:{minutes:5,explicit:true},label:'Take a break'}});
  }},
  {id:'no-focus',when:q=>/ (?:i do not feel like (?:doing )?(?:anything|it|homework|this|work)|i can not focus|can not concentrate|i keep (?:procrastinating|getting distracted)|i am procrastinating|i am distracted|i do not want to do (?:anything|homework|this)|no motivation|not motivated) /.test(q),answer:(m,c)=>{
    const top=ranked(c.s)[0];
    return top?
      c.card('focus',[top],{itemId:top.id,minutes:10},'Start small: ten minutes on '+top.title+'. That is all you have to do.'):
      c.card('focus',[],{minutes:10},'Try ten minutes on anything. Starting is the hard part.');
  }},
  // one word lines: what a student types when they are in a hurry
  {id:'bare-next',when:(q,line,c)=>/^ (?:my |any )?(?:next|todo|to do|to-do|my list|list|homework|assignments|work|tasks|stuff|hw)(?: please| now| right now| again)? $/.test(q)&&fresh(c)&&open(c.s).length>1,answer:(m,c)=>{
    if(/^ (?:my |any )?next(?: please| now| right now| again)? $/.test(c.q))return nextUp(c.s,c);
    const rows=ranked(c.s),top=rows[0];
    if(!top)return say(c,'Nothing on your list right now.');
    return c.card('plan',rows.slice(0,3),{local:true,line:'plan tonight'},top.title+' is next, because '+whyNow(top,c.s)+'.'+(rows[1]?' Then '+rows.slice(1,3).map(v=>v.title).join(', then ')+'.':''));
  }},
  {id:'bare-today',when:q=>/^ (?:tonight|right now|now) $/.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),rows=ranked(c.s),soon=rows.filter(v=>v.dueAt!==null&&v.dueAt>=now&&v.dueAt-now<=DAY);
    return soon.length?
      c.card('find',soon.slice(0,3),{},soon.length+' due in the next day: '+soon.slice(0,3).map(v=>v.title).join(', ')+'.',{answerKind:'mind'}):
      say(c,'Nothing due in the next day.'+(rows[0]?' Next is '+rows[0].title+'.':''));
  }},
  {id:'bare-minutes',when:q=>/^ \d{1,3} (?:min )?$/.test(q),answer:(m,c)=>{const n=parseInt(c.q,10);return n>0&&n<=180?c.card('focus',[],{minutes:n},'Focus for '+length(n)+'.'):null;}},
  {
    id:'bare-settings',
    when:q=>/^ (?:settings|preferences|options|make it yours|customize|customise) $/.test(q),
    answer:(m,c)=>c.card('find',[],{},'Make it yours.',{next:{action:'make-it-yours',fields:{tab:'look'},label:'Open it'}})
  },
  {id:'bare-done',when:q=>/^ (?:done|finished|i finished|i am done|all done|i am finished|finally done) $/.test(q),answer:(m,c)=>{
    const top=ranked(c.s)[0];
    return say(c,'Nice work.'+(top?' Next is '+top.title+', or take a break.':' Nothing else is waiting.'));
  }},
  {id:'give-break',when:q=>/ (?:give me a break|i need a break|take a break|i want a break) /.test(q),answer:(m,c)=>c.card('break',[],{minutes:5,explicit:true},'Five minutes. Stand up, drink some water.')},
  {id:'clock',when:q=>/^ (?:what time is it|whats the time|what is the time|time) $/.test(q),answer:(m,c)=>say(c,'It is '+clockText(stamp(c.s.now)||Date.now(),c.s)+'.')},
  {
    id:'date',
    when:q=>/^ (?:what day is it|what is the date|what is today|whats the date|what date is it) $/.test(q),
    answer:(m,c)=>say(c,'Today is '+new Date(stamp(c.s.now)||Date.now()).toLocaleDateString('en-US',{timeZone:c.s.timeZone||'America/New_York',weekday:'long',month:'long',day:'numeric'})+'.')
  },
  {id:'back',when:q=>/^ (?:i am back|back|hello again|hey again|i have returned) $/.test(q),answer:(m,c)=>{const top=ranked(c.s)[0];return say(c,'Welcome back.'+(top?' '+top.title+' is next.':''));}},
  {id:'praise',when:q=>/^ (?:good job|nice job|well done|great job|you are smart|you are so smart|you are funny|smart|thanks biscuit|thank you biscuit) $/.test(q),answer:(m,c)=>say(c,'Thank you. You are doing the hard part.')},
  {id:'food',when:q=>/ (?:what should i eat|i am hungry|what is for dinner|i need food) /.test(q),answer:(m,c)=>say(c,'Something with protein. And maybe an apple. I am a horse, so take that with salt.')},
  {id:'game',when:q=>/^ (?:play a game|lets play|can we play|play) $/.test(q),answer:(m,c)=>say(c,'Hand something in. There is something fun on the page after you submit.')},
  {id:'weather',when:q=>/ (?:weather|temperature outside|is it raining) /.test(q),answer:(m,c)=>say(c,'I cannot see outside from here. Is it nice enough for a walk?')},
  // honest about what it will not do
  {id:'do-it-for-me',when:q=>/ (?:(?:can|could|will|would) you (?:do|write|finish|solve) (?:my|this|the)|do my homework|write (?:my|this|the) (?:essay|paper|report)(?: for me)?|finish my homework|do it for me) /.test(q),answer:(m,c)=>{
    const top=ranked(c.s)[0];
    return say(c,'I will not do it for you, but I can help you get it done: a plan, a first step, or checking your work with your AI.'+(top?' Want to start with '+top.title+'?':''));
  }},
  // what they say happened
  {id:'bad-grade',when:q=>/ (?:i (?:got|have) a bad (?:grade|mark|score)|i failed|i bombed|i did bad on|i did badly on|i got a [cdf] ) /.test(q),answer:(m,c)=>say(c,'That stings. One grade is not you. Your teacher can usually tell you the one thing to fix first.')},
  {id:'forgot',when:q=>/ (?:i forgot (?:my|to do|to turn in|the)|i lost my|i left my|i missed the deadline|i did not do my) /.test(q),answer:(m,c)=>{
    const words=c.q.split(' ').filter(w=>w.length>4&&!/forgot|turn|homework|about/.test(w)),hit=open(c.s).find(v=>words.some(w=>v.title.toLowerCase().includes(w)));
    return hit?c.card('open',[hit],{itemId:hit.id},'It happens. Here is '+hit.title+'. If it is late, a short note to your teacher goes a long way.'):say(c,'It happens. A short note to your teacher today goes a long way.');
  }},
  {id:'teacher-moved',when:q=>/ (?:my teacher|teacher|mr|mrs|ms|dr) .*(?:moved|changed|pushed|cancelled|canceled|postponed|extended) /.test(q)||/ (?:test|quiz|due date|deadline) (?:got |was |is )?(?:moved|changed|pushed|cancelled|canceled|postponed|extended) /.test(q),answer:(m,c)=>say(c,'Noted. Canvas updates when your teacher changes it. Tell me the new day if you want it on your list.')},
  {id:'no-school',when:q=>/ (?:no school|school is cancelled|school is closed|snow day|day off|class is cancelled|class cancelled|classes are cancelled) /.test(q),answer:(m,c)=>{
    const day=dayIn(c.q,c.s)||c.today;
    return c.card('plan',[],{local:true,line:'plan',date:day,start:'10:00'},'',{lead:'Nice. '});
  }},
  {id:'sick',when:q=>/ (?:i am sick|i feel sick|i am not feeling well|i am ill|i have a (?:cold|fever|headache)|i have the flu|i feel terrible|i feel awful) /.test(q),answer:(m,c)=>say(c,'Feel better. Rest comes first. If you are out, your teachers can usually tell you what you missed.')},
  {id:'going-out',when:q=>/ (?:i am going out|i am busy|i have plans|i am out|no time|do not have time|nothing tonight|not doing anything tonight|not working tonight|i will not have time|i can not work) /.test(q),answer:(m,c)=>{
    const tomorrow=addDays(c.today,1);
    return c.card('plan',[],{local:true,line:'plan tomorrow',date:tomorrow},'',{lead:'Okay, tonight is yours. '});
  }},
  // time they name
  {id:'free-day',when:q=>/ (?:i am free|i have (?:all day|the whole day|nothing)|free all day) /.test(q)&&!!dayIn(q,{...{}, ...{timeZone:'America/New_York',now:Date.now()}}),answer:(m,c)=>{
    const day=dayIn(c.q,c.s)||c.today;
    return c.card('plan',[],{local:true,line:'plan',date:day,start:'10:00'},'');
  }},
  {id:'leave-at',when:q=>/ (?:i have to|i need to|i gotta|i got to|have to|need to) (?:leave|go|head out|be out|get going) (?:at|by) /.test(q),answer:(m,c)=>{
    const at=clockIn(c.q);
    if(at===null||at<=c.minute)return null;
    return c.card('plan',[],{local:true,line:'plan',date:c.today,minutes:at-c.minute},'');
  }},
  {id:'busy-range',when:q=>/ i (?:have|got|am at|will be at|work|have to work) /.test(q)&&!!rangeIn(q)&&!/ (?:remind|open|find|due|free|plan) /.test(q),answer:(m,c)=>{
    const r=rangeIn(c.q),day=dayIn(c.q,c.s)||c.today;
    if(!r||!c.wall)return null;
    return c.card(
      'plan',
      [],
      {local:true,line:'plan '+(day===c.today?'today':'tomorrow'),date:day,avoid:[{start:c.wall(day,r[0]),end:c.wall(day,r[1])}]},
      '',
      {lead:firstUp(eventName(c.q))+' '+whenWords(day,r[0],c.s)+', noted. '});
  }},
  {id:'plan-range',when:q=>/^ plan (?:from )?\d/.test(q)&&!!rangeIn(q),answer:(m,c)=>{
    const r=rangeIn(c.q),day=dayIn(c.q,c.s)||c.today;
    return c.card('plan',[],{local:true,line:'plan',date:day,start:hhmm(r[0]),minutes:r[1]-r[0]},'');
  }},
  {id:'plan-hours',when:q=>/^ plan (?:(?:for )?(?:tonight|today|tomorrow) )?(?:for )?(?:about )?(?:\d+(?:\.\d+)?|an?) ?(?:hours?|hrs?|h|min|mins|minutes)(?: tonight| today| tomorrow)? $/.test(q),answer:(m,c)=>{
    const minutes=/ an? (?:hour|hr) /.test(c.q)?60:minutesIn(c.q.replace(/ (\d+(?:\.\d+)?) ?(?:hours?|hrs?) /,' $1 hour ').replace(/ (\d+) ?(?:minutes|mins) /,' $1 min ')),day=dayIn(c.q,c.s);
    return c.card('plan',[],{local:true,line:/tonight/.test(c.q)?'plan tonight':'plan',minutes,...(day?{date:day}:{})},'');
  }},
  {id:'free-after',when:q=>/^ (?:i am |i will be |im )?free (?:after|from) \d/.test(q),answer:(m,c)=>{
    let at=clockIn(c.q);
    if(at===null)at=(+/ (\d{1,2}) /.exec(c.q)?.[1]||0)*60;
    if(at<720&&at<=c.minute)at+=720;
    return c.card('plan',[],{local:true,line:'plan',date:dayIn(c.q,c.s)||c.today,after:hhmm(at)},'');
  }},
  {id:'test-on-day',when:q=>/^ (?:test|quiz|exam|midterm|final) (?:on )?(?:today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday) $/.test(q),answer:(m,c)=>{
    const day=dayIn(c.q,c.s),kind=c.q.trim().split(' ')[0];
    return c.card(
      'task',
      [],
      {name:firstUp(kind),day,estimate:35},
      'Add to your list: '+firstUp(kind)+', '+whenWords(day,null,c.s)+'. Study time goes before it.',
      {understanding:{step:'understanding',reason:'own-work'}});
  }},
  {id:'after-event',when:q=>/ after (?:dinner|practice|school|work|class|the game|lunch) /.test(q)&&!/ (?:move|push|bump|shift|reschedule|put|note|remind|calendar|anything on|what is on|what is due|due) /.test(q),answer:(m,c)=>{
    const hour=/dinner/.test(c.q)?19:/lunch/.test(c.q)?13:/practice|work|game/.test(c.q)?18:16,day=dayIn(c.q,c.s)||c.today;
    return c.card('plan',[],{local:true,line:'plan',date:day,after:String(hour).padStart(2,'0')+':00'},'');
  }},
  {id:'until-busy',when:q=>new RegExp(' (?:'+EVENTS+') (?:until|till) ').test(q),answer:(m,c)=>{
    const at=clockIn(c.q),day=dayIn(c.q,c.s)||c.today,dinner=/dinner/.test(c.q);
    if(at===null)return null;
    const when=at<720&&(at<=c.minute||/ (?:tonight|evening) /.test(c.q))?at+720:at,from=Math.min(1380,when+(dinner?60:15));
    return c.card('plan',[],{local:true,line:'plan',date:day,after:String(Math.floor(from/60)).padStart(2,'0')+':'+String(from%60).padStart(2,'0')},'');
  }},
  {id:'free-at',when:q=>/ (?:free period|study hall|free time|free block|i have a free) .*(?:at|from) \d/.test(q),answer:(m,c)=>{
    const at=clockIn(c.q),day=dayIn(c.q,c.s)||c.today;
    if(at===null)return null;
    const rows=ranked(c.s),fit=rows.find(v=>v.minutes<=45)||rows[0];
    return fit?
      c.card('plan',[fit],{local:true,line:'plan',date:day,start:String(Math.floor(at/60)).padStart(2,'0')+':'+String(at%60).padStart(2,'0'),minutes:45},''):
      say(c,'Enjoy it. Nothing is waiting.');
  }},
  {id:'hours-tonight',when:q=>/ (?:i have|i got|i have got|got|only have) (?:about |like |around )?(?:\d+(?:\.\d+)?) ?(?:min|hour|h) (?:tonight|today|left|before|until|tomorrow)/.test(q)||/ (?:i have|i got) 1 hour (?:before|until|tonight) /.test(q),answer:(m,c)=>{
    const minutes=minutesIn(c.q),day=dayIn(c.q,c.s);
    return c.card('plan',[],{local:true,line:/tonight/.test(c.q)?'plan tonight':'plan',minutes,...(day?{date:day}:{})},'');
  }},
  // what is coming
  {id:'test-add',when:q=>/ i have (?:a|an|my) (?:\w+ )?(?:test|quiz|exam|midterm|final)\b/.test(q)&&!!(/ (?:today|tomorrow|tonight|sun|mon|tue|wed|thu|fri|sat|next)/.test(q)),answer:(m,c)=>{
    const day=dayIn(c.q,c.s),
      kind=/ (test|quiz|exam|midterm|final)/.exec(c.q)[1],
      course=c.courseIn(c.q),
      subject=course?(course.shortName||course.name):(/ i have (?:a|an|my) (\w+) (?:test|quiz|exam|midterm|final)/.exec(c.q)?.[1]||''),
      hit=open(c.s).find(v=>new RegExp(kind,'i').test(v.title)&&(!course||String(v.courseId)===String(course.id))&&(!day||(v.dueAt&&local(c.s)?.(v.dueAt).day===day)));
    if(hit)return c.card('focus',[hit],{itemId:hit.id,minutes:25},hit.title+' is on your list. Want to study for it now?');
    const name=firstUp((subject?subject+' ':'')+kind);
    return c.card('task',[],{name,day:day||'',estimate:45},'Add to your list: '+name+(day?', '+whenWords(day,null,c.s):'')+'. Study time goes before it.');
  }},
  {id:'time-left',when:q=>/^ how much time (?:is left|do i have left|left|is there left) $/.test(q),answer:(m,c)=>c.card('focus-status',[],{},'Time left on focus timer')},
  {id:'whats-new',when:q=>/^ (?:what is new|anything new|what changed|new stuff|new work|what did i get|what came in) $/.test(q),answer:(m,c)=>{
    const ids=new Set(list(c.s.newWork).map(String)),rows=list(c.s.assignments).filter(v=>ids.has(String(v.id)));
    if(!rows.length)return say(c,'Nothing new since you last looked.');
    const names=rows.slice(0,3).map(v=>v.title||v.name);
    return c.card('find',rows.slice(0,3),{},rows.length+' new since you last looked: '+names.join(', ')+(rows.length>3?', and more':'')+'.',{answerKind:'mind'});
  }},
  {id:'timer-bare',when:q=>/^ timer $/.test(q),answer:(m,c)=>c.card('focus',[],{minutes:25},'Focus for 25 min.')},
  {id:'kind-soon',when:q=>/ (?:any|got any|do i have any|anything like) (?:tests?|quiz|quizzes|exams?|essays?|labs?|projects?)\b/.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),
      word=/ (tests?|quiz|quizzes|exams?|essays?|labs?|projects?)\b/.exec(c.q)[1].replace(/zes$/,'').replace(/s$/,''),
      span=/ (?:this week) /.test(c.q)?7:21,
      rows=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt>=now&&v.dueAt-now<=span*DAY&&(word==='test'||word==='exam'?/\b(?:test|exam|midterm|final)\b/i:new RegExp('\\b'+word,'i')).test(v.title)).sort((a,b)=>
        a.dueAt-b.dueAt);
    if(!rows.length)return say(c,'No '+word+'s '+(span===7?'this week':'coming up')+'.');
    const first=rows[0],when=whyNow(first,c.s).replace(/^it /,'').replace(/^is /,'');
    return c.card('open',rows.slice(0,3),{itemId:first.id},first.title+', '+when+'.'+(rows.length>1?' '+(rows.length-1)+' more after that.':''));
  }},
  {id:'graded',when:q=>/^ (?:is|was|has|have|are|were|did|does|do) /.test(q)&&/ (?:graded|been graded|marked|scored|got a grade|get a grade|grade back) /.test(q),answer:(m,c)=>{
    const {only,kind,pick}=pickByKind(c,/^(?:graded|grade|been|back|marked|scored|have|has|was|were|does|did|turn|submit|hand|finish|the|my|yet)$/),name=v=>v.title||v.name;
    if(!pick.length){if(only&&kind)return say(c,'No '+kindWords(kind,1)+' in '+(only.shortName||only.name)+' that I can see.');const hit=named(c.q,c.s);if(!hit)return null;pick.push(hit);}
    if(pick.length===1){
      const v=pick[0],t=name(v);
      return c.card(
        'open',
        [v],
        {itemId:String(v.id)},
        isGraded(v)?'Yes, '+t+' is graded.':isTurnedIn(v)?'Not yet. '+t+' is turned in and waiting for a grade.':'Not yet. '+t+' is not turned in'+(stamp(v.dueAt)!==null?', '+dueWord(v,c.s):'')+'.');
    }
    const {waiting,done}=openFirst(pick,isGraded,c.s),rows=[...waiting,...done],course=only?(only.shortName||only.name)+' ':'';
    const head=waiting.length===1?
      name(waiting[0])+', '+dueWord(waiting[0],c.s)+': not graded yet'+(isTurnedIn(waiting[0])?' (turned in).':', not turned in.'):
      waiting.length>1?
        'Not graded yet: '+waiting.map(v=>name(v)+' ('+dueWord(v,c.s)+')').join(', ')+'.':
        'Yes, '+(done.length===2?'both ':'all '+done.length+' ')+course+kindWords(kind,2)+' are graded: '+done.map(name).join(', ')+'.';
    return c.card('find',rows.slice(0,3),{},head+(waiting.length&&done.length?' Graded: '+done.map(name).join(', ')+'.':''),{answerKind:'mind',listRows:rows,listTitle:'Graded?'});
  }},
  {id:'turned-in',when:q=>/ did i (?:turn in|submit|hand in|finish|do) /.test(q),answer:(m,c)=>{
    const {only,kind,pick}=pickByKind(c,/^(?:turn|submit|hand|finish|did|the|my)$/),name=v=>v.title||v.name;
    if(pick.length===1){
      const v=pick[0],t=name(v);
      return isTurnedIn(v)?
        c.card('open',[v],{itemId:String(v.id)},'Yes, '+t+' is in.'):
        c.card('open',[v],{itemId:String(v.id)},'Not yet. '+t+(stamp(v.dueAt)!==null?', '+whyNow({...v,dueAt:stamp(v.dueAt)},c.s).replace(/^it /,'').replace(/^is /,''):'')+'.');
    }
    if(pick.length>1){
      const {waiting,done}=openFirst(pick,isTurnedIn,c.s),rows=[...waiting,...done],course=only?(only.shortName||only.name)+' ':'';
      const head=waiting.length===1?
        name(waiting[0])+', '+dueWord(waiting[0],c.s)+': not turned in yet.':
        waiting.length>1?
          'Not turned in yet: '+waiting.map(v=>name(v)+' ('+dueWord(v,c.s)+')').join(', ')+'.':
          'Yes, '+(done.length===2?'both ':'all '+done.length+' ')+course+kindWords(kind,2)+' are in: '+done.map(name).join(', ')+'.';
      return c.card('find',rows.slice(0,3),{},head+(waiting.length&&done.length?' Turned in: '+done.map(name).join(', ')+'.':''),{answerKind:'mind',listRows:rows,listTitle:'Turned in?'});
    }
    const hit=named(c.q,c.s);
    if(hit)return c.card('open',[hit],{itemId:hit.id},'Not yet. '+hit.title+(hit.dueAt!==null?', '+whyNow(hit,c.s).replace(/^it /,'').replace(/^is /,''):'')+'.');
    return null;
  }},
  {id:'next-test',when:q=>/ (?:when is|when are|what is|whats|do i have) (?:my |the |a |an |any )?(?:next )?(?:tests?|quiz|quizzes|exams?|midterm|finals?)\b/.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),
      rows=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt>=now&&/\b(?:test|quiz|exam|midterm|final)\b/i.test(v.title)).sort((a,b)=>a.dueAt-b.dueAt),
      span=/ this week /.test(c.q)?7:0,
      top=rows[0];
    if(!top)return say(c,'No tests or quizzes on Canvas right now.');
    if(span&&top.dueAt-now>span*DAY)
      return say(
        c,
        'None this week. The next one is '+top.title+', '+new Date(top.dueAt).toLocaleDateString('en-US',{timeZone:c.s.timeZone||'America/New_York',weekday:'long',month:'short',day:'numeric'})+'.');
    const days=Math.max(0,Math.ceil((top.dueAt-now)/DAY));
    return c.card(
      'open',
      [top],
      {itemId:top.id},
      top.title+
        ' is '+
        new Date(top.dueAt).toLocaleDateString('en-US',{timeZone:c.s.timeZone||'America/New_York',weekday:'long',month:'short',day:'numeric'})+
        ', '+
        days+
        ' day'+
        (days===1?'':'s')+
        ' from now.');
  }},
  {id:'days-until',when:q=>/ how (?:many days|long) (?:until|till|before|is it until) /.test(q),answer:(m,c)=>{
    const words=c.q.split(' ').filter(w=>w.length>3&&!/^(?:many|days|until|till|long|before)$/.test(w)),
      hit=open(c.s).filter(v=>v.dueAt!==null).map(v=>({v,n:words.filter(w=>v.title.toLowerCase().includes(w)).length})).sort((a,b)=>b.n-a.n)[0];
    if(!hit?.n)return null;
    const days=Math.ceil((hit.v.dueAt-(stamp(c.s.now)||Date.now()))/DAY);
    return days>=0?
      c.card('open',[hit.v],{itemId:hit.v.id},days+' day'+(days===1?'':'s')+' until '+hit.v.title+'.'):
      c.card('open',[hit.v],{itemId:hit.v.id},hit.v.title+' was '+(-days)+' day'+(days===-1?'':'s')+' ago.');
  }},
  {id:'how-long',when:q=>/ how long (?:will|does|would|is|do) /.test(q)&&!/ (?:plan|until|till) /.test(q),answer:(m,c)=>{
    if(/ (?:my homework|my work|everything|it all|all of it|all my) /.test(c.q)){
      const now=stamp(c.s.now)||Date.now(),rows=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt>=now&&v.dueAt-now<=7*DAY);
      return rows.length?c.card('find',rows.slice(0,3),{},'About '+length(rows.reduce((n,v)=>n+v.minutes,0))+' for this week, my guess.',{answerKind:'mind'}):say(c,'Nothing due this week.');
    }
    const words=c.q.split(' ').filter(w=>w.length>3&&!/^(?:long|will|does|would|take|have)$/.test(w)),
      hit=open(c.s).map(v=>({v,n:words.filter(w=>v.title.toLowerCase().includes(w)).length})).sort((a,b)=>b.n-a.n)[0];
    return hit?.n?c.card('open',[hit.v],{itemId:hit.v.id},'About '+length(hit.v.minutes)+', my guess. Tell me if yours takes longer and I will remember.'):null;
  }},
  {id:'r42-is-due',when:(q,line,c)=>/^ (?:is|are|was|will) /.test(q)&&/ due /.test(q)&&!!r42Window(q,c.s)&&r42AskedItem(q,c.s),answer:(m,c)=>{
    const w=r42Window(c.q,c.s),
      v=m,
      inside=v.dueAt>=w.from&&v.dueAt<w.to,
      zone=c.s.timeZone||'America/New_York',
      day=new Date(v.dueAt).toLocaleDateString('en-US',{timeZone:zone,weekday:'long',month:'short',day:'numeric'});
    return c.card(
      'open',
      [v],
      {itemId:v.id,...(v.courseId?{courseId:String(v.courseId)}:{}),answerField:'dueAt',dueAt:v.dueAt},
      (inside?'Yes. ':'No. ')+v.title+' is due '+day+' at '+clockText(v.dueAt,c.s)+'.',
      {answer:{label:w.span==='week'?(w.label==='next week'?'Due next week?':'Due this week?'):w.span==='weekend'?'Due this weekend?':'Due '+w.label+'?',value:inside?'Yes':'No'}});
  }},
  {id:'due-week',when:q=>/ (?:what is )?due (?:this|next) week /.test(q)||/ what do i have (?:this|next) week /.test(q),answer:(m,c)=>{/* biscuit-42: Monday to Sunday (t2Window), not seven days from now */
    const now=stamp(c.s.now)||Date.now(),
      next=/ next week /.test(c.q),
      w=t2Window(next?' next week ':' this week ',c.s),
      from=w.span==='week'?w.from:next?now+7*DAY:now,
      to=w.span==='week'?w.to:from+7*DAY,
      rows=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt>=from&&v.dueAt<to).sort((a,b)=>a.dueAt-b.dueAt),
      day=v=>new Date(v.dueAt).toLocaleDateString('en-US',{timeZone:c.s.timeZone||'America/New_York',weekday:'short'});
    return rows.length?
      c.card('find',rows.slice(0,3),{},rows.slice(0,5).map(v=>day(v)+': '+v.title).join('. ')+'.'+(rows.length>5?' And '+(rows.length-5)+' more.':''),{answerKind:'mind',listRows:rows}):
      say(c,'Nothing due '+(next?'next':'this')+' week.');
  }},
  {id:'late-count',when:q=>/ (?:how many|is anything|anything|what is) .*(?:overdue|late|missing) /.test(q)&&!/ (?:policy|penalty|rules|accept|allowed|lose points) /.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),late=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt<now).sort((a,b)=>b.dueAt-a.dueAt);
    return late.length?c.card('find',late.slice(0,3),{},late.length+' overdue. Newest: '+late[0].title+'.',{answerKind:'mind'}):say(c,'Nothing overdue.');
  }},
  {id:'most-work',when:q=>/ (?:which|what) class /.test(q)&&/ (?:most work|work on|should i|most homework|busiest|first) /.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),sum=new Map();
    for(const v of open(c.s))if(!v.own&&v.dueAt!==null&&v.dueAt>=now-7*DAY&&v.dueAt<=now+7*DAY)sum.set(String(v.courseId),(sum.get(String(v.courseId))||0)+v.minutes);
    const top=[...sum].sort((a,b)=>b[1]-a[1])[0];
    if(!top)return say(c,'Nothing much this week.');
    const course=list(c.s.courses).find(v=>String(v.id)===top[0]);
    return say(c,(course?.shortName||course?.name||'One class')+', about '+length(top[1])+' this week.');
  }},
  {id:'versus',when:(q,line,c)=>/ (?:should i do|which first| or ) /.test(q)&&/ (?:first|should i|which) /.test(q)&&c.coursesIn(q).length>=2,answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),
      pick=c.coursesIn(c.q).slice(0,2).map(course=>
        ({course,next:open(c.s).filter(v=>String(v.courseId)===String(course.id)&&v.dueAt!==null&&v.dueAt>=now).sort((a,b)=>a.dueAt-b.dueAt)[0]})).sort((a,b)=>
        (a.next?.dueAt??Infinity)-(b.next?.dueAt??Infinity)),
      [a,b]=pick;
    if(!a.next)return say(c,'Neither has anything due soon. Your pick.');
    return say(c,(a.course.shortName||a.course.name)+' first. '+a.next.title+' is due sooner'+(b.next?' than '+b.next.title:'')+'.');
  }},
  {id:'skip',when:q=>/ can i skip /.test(q),answer:(m,c)=>{
    const words=c.q.split(' ').filter(w=>w.length>3&&w!=='skip'),hit=open(c.s).find(v=>words.some(w=>v.title.toLowerCase().includes(w)));
    return hit?c.card('open',[hit],{itemId:hit.id},'Your call. '+hit.title+(hit.points?' is worth '+hit.points+' points':'')+' and '+whyNow(hit,c.s)+'.'):say(c,'Your call. Check what it is worth first.');
  }},
  // their plan
  {id:'my-plan',when:q=>/^ (?:what is my plan|whats my plan|what is the plan|how long is my plan|whats the plan|my plan) $/.test(q),answer:(m,c)=>{
    const p=c.s.biscuitPlan||c.s.toolbox?.biscuitPlan,blocks=list(p?.blocks).filter(v=>v.kind!=='break');
    return blocks.length?c.card('navigate',[],{tab:'plan'},(p.message||blocks.length+' blocks saved.')):say(c,'No plan yet. Say "plan tonight".');
  }},
  {id:'clear-plan',when:q=>/ (?:clear|delete|remove|cancel|reset) (?:my |the )?plan /.test(q),answer:(m,c)=>c.card('navigate',[],{tab:'plan'},'Open Planner to clear it. Nothing changed yet.')},
  {id:'shorter',when:q=>/^ (?:make it shorter|shorter|less|too long|that is too much|too much) $/.test(q),answer:(m,c)=>say(c,'How long do you have? Say "plan 45 min".')},
  {id:'plan-weekend',when:q=>/ (?:weekend) /.test(q)&&/ (?:plan|schedule|study|what should i do) /.test(q),answer:(m,c)=>{
    const today=new Date(c.today+'T12:00Z').getUTCDay(),ahead=today===6||today===0?0:6-today,day=addDays(c.today,ahead);
    return c.card('plan',[],{local:true,line:'plan',date:day,start:'10:00'},'',{lead:ahead?'Saturday first. ':''});
  }},
  {id:'plan-week',when:q=>/^ (?:plan|schedule|plan out|map out) (?:my |the |this )?week $/.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),
      rows=ranked(c.s).filter(v=>v.dueAt===null||v.dueAt<=now+7*DAY).slice(0,7),
      when=v=>v.dueAt===null?'Anytime':new Date(Math.max(now,v.dueAt-DAY)).toLocaleDateString('en-US',{timeZone:c.s.timeZone||'America/New_York',weekday:'short'});
    return rows.length?c.card('plan',rows.slice(0,3),{mode:'week'},rows.slice(0,5).map(v=>when(v)+': '+v.title).join('. ')+'.'):say(c,'A quiet week. Nothing to plan.');
  }},
  {id:'plan-words',when:q=>/^ (?:plan|schedule)(?: my| the)?(?: homework| work| evening| night| afternoon| morning)? (?:tonight|today|tomorrow|this evening|this afternoon)? ?$/.test(q)||/^ plan $/.test(q),answer:(m,c)=>{
    const day=dayIn(c.q,c.s);
    return c.card('plan',[],{local:true,line:c.q.trim(),...(day?{date:day}:{})},'');
  }},
  // places
  {
    id:'review-cards',
    when:q=>/ (?:review my cards|my flashcards|my cards|study my cards|add a card|new card|flashcard) /.test(q)&&!/ (?:make|art|artwork) /.test(q),
    answer:(m,c)=>featureOn(c.s,'review-deck')?c.card('navigate',[],{tab:'review'},'Review deck.'):null
  },
  {
    id:'email',
    when:q=>/ (?:email|message|text|contact) (?:my |the )?(?:teacher|mr|mrs|ms|dr|tutor|counselor) /.test(q)&&!/^ (?:remind|note|add|put) /.test(q),
    answer:(m,c)=>c.card('find',[],{},'Open Canvas Inbox to write to them.',{next:{action:'navigate',fields:{tab:'messages'},label:'Open Messages'}})
  },
  {id:'canvas-places',when:q=>/ (?:go to|open|where are|where is|take me to) (?:my |the )?(?:modules|files|syllabus|people|pages) /.test(q),answer:(m,c)=>c.card('navigate',[],{tab:'course-hub'},'Those are in the Course hub, one course at a time.')},
  {id:'pause',when:q=>/^ (?:pause|resume|stop|pause timer|resume timer) $/.test(q),answer:(m,c)=>{
    const on=c.s.focus?.running||Number(c.s.focus?.endsAt)>(stamp(c.s.now)||0);
    return on?null:say(c,'No timer is running.');
  }},
  {id:'move-all',when:q=>/ (?:move|push|shift) (?:everything|it all|all of it|my plan|the plan|tonight) (?:to|until|till) /.test(q),answer:(m,c)=>{
    const day=dayIn(c.q,c.s)||addDays(c.today,1);
    return c.card('plan',[],{local:true,line:'plan',date:day},'',{lead:'Okay. '});
  }},
  {id:'start-over',when:q=>/^ (?:start over|never mind|nevermind|forget it|cancel) $/.test(q),answer:(m,c)=>say(c,'Okay, nothing changed.')},
  {id:'notes',when:q=>/^ (?:notes|my notes|note) $/.test(q),answer:(m,c)=>say(c,'Say "note: bring goggles" and I will keep it.')},
  {
    id:'help-course',
    when:(q,line,c)=>
      / (?:i need help|help me|i am stuck|i do not get|i do not understand|stuck) (?:with |on |in )?/.test(q)&&
        q.trim().split(' ').length<=6&&
        !!c.courseIn(q)&&
        !open(c.s).some(v=>c.q.split(' ').filter(w=>w.length>4&&!/help|stuck|understand/.test(w)).some(w=>v.title.toLowerCase().includes(w))),
    answer:(m,c)=>{
    const course=c.courseIn(c.q);
    return c.card('ai',[],{text:c.line,courseId:String(course.id)},'Sure. What part of '+(course.shortName||course.name)+'? Your AI can walk you through it.');
  }},
  {id:'make-cards',when:q=>/ make (?:me )?a (?:flash ?)?card /.test(q),answer:(m,c)=>c.card('ai',[],{text:c.line},'Your AI can write them. Bring them into Review with Import.')},
  {id:'bare-thing',when:q=>/^ (?:my )?(?:essay|paper|lab|lab report|report|worksheet|project|reading|presentation|quiz|test|exam) $/.test(q),answer:(m,c)=>{
    const word=c.q.trim().replace(/^my /,'').split(' ').pop(),rows=ranked(c.s).filter(v=>new RegExp(word,'i').test(v.title));
    if(!rows.length)return say(c,'No '+c.q.trim().replace(/^my /,'')+' on your list. Say "add '+c.q.trim().replace(/^my /,'')+' friday" to put one there.');
    return c.card('open',rows.slice(0,3),{itemId:rows[0].id},rows[0].title+', '+whyNow(rows[0],c.s).replace(/^it /,'').replace(/^is /,'')+'.');
  }},
  {id:'only-this',when:q=>/ (?:only|just) (?:want to |wanna |going to |gonna |need to |gotta |have to )?(?:do|work on|focus on|study) /.test(q),answer:(m,c)=>{
    const tail=c.q.replace(/^.*? (?:only|just) (?:want to |wanna |going to |gonna |need to |gotta |have to )?(?:do|work on|focus on|study) /,' '),
      day=dayIn(c.q,c.s)||c.today,
      hit=named(tail,c.s),
      course=c.courseIn(tail);
    if(hit)return c.card('plan',[hit],{local:true,line:'plan',date:day,itemId:hit.id},'');
    return course?c.card('plan',[],{local:true,line:'plan',date:day,courseId:String(course.id)},''):null;
  }},
  {
    id:'study-course',
    when:(q,line,c)=>
      /^ (?:study|studying|study for|work on|do|focus on|time for) /.test(q)&&!/ (?:layout|view|mode|theme|flash ?cards|cards|deck|room) /.test(q)&&q.trim().split(' ').length<=4&&!!c.courseIn(q),
    answer:(m,c)=>{
    const course=c.courseIn(c.q),kind=kindOf(c.q),top=ranked(c.s).find(v=>String(v.courseId)===String(course.id)&&isKind(v,kind)),name=course.shortName||course.name;
    if(kind&&!top)return null;
    return top?c.card('focus',[top],{itemId:top.id,minutes:25},'25 minutes on '+top.title+'.'):c.card('focus',[],{minutes:25},'25 minutes on '+name+'.');
  }},
  {id:'study-bare',when:q=>/^ (?:help me study|time to study|study|i need to study|i should study) $/.test(q),answer:(m,c)=>{
    const rows=ranked(c.s),top=rows.find(v=>/\b(?:test|quiz|exam)\b/i.test(v.title))||rows[0];
    return top?c.card('focus',[top],{itemId:top.id,minutes:25},'Start with '+top.title+', 25 minutes.'):c.card('focus',[],{minutes:25},'25 minutes. What are you studying?');
  }},
  {id:'quiz-me',when:q=>/^ (?:quiz me|test me|practice questions|give me practice) $/.test(q),answer:(m,c)=>{
    const top=ranked(c.s).find(v=>/\b(?:test|quiz|exam)\b/i.test(v.title));
    return top?c.card('ai',[top],{itemId:top.id,text:'quiz me on '+top.title},'Your AI can quiz you on '+top.title+'.'):c.card('ai',[],{text:c.line},'What on? Your AI can make the questions.');
  }},
  {id:'pomodoro',when:q=>/^ (?:pomodoro|pomo) $/.test(q),answer:(m,c)=>c.card('focus',[],{minutes:25},'Focus for 25 min.')},
  {id:'stuck',when:q=>/^ (?:this is (?:too |so |really )?(?:hard|impossible|confusing)|too hard|so hard|i am stuck|i am lost|i do not get (?:this|it)|i do not understand(?: this| it)?) $/.test(q),answer:(m,c)=>c.card('ai',[],{text:c.line},'Stuck happens. Tell your AI which part and it will walk through it with you.')},
  {id:'gpa',when:q=>/ (?:my )?gpa /.test(q)&&!/ (?:turn|show|hide|open|enable|disable|feature|calculator|where|tools) /.test(q),answer:(m,c)=>say(c,'Tools > GPA works that out.')},
  {id:'bedtime',when:q=>/ (?:sleep|bed|asleep) (?:by|at|around) /.test(q)||/ bedtime (?:is|at) /.test(q)||/ bedtime (?:to |= )?\d/.test(q),answer:(m,c)=>{
    const hm=/ (?:bedtime|bed|sleep|asleep)(?: is| at| to| by| around| =)? (\d{1,2})[ :](\d{2})(?: ?(?:am|pm))? /.exec(c.q);
    let at=hm&&+hm[1]<=23&&+hm[2]<=59?+hm[1]*60+(+hm[2]):clockIn(c.q);
    if(hm&&/ pm /.test(c.q)&&at<720)at+=720;
    if(at===null){const b=/ bedtime (?:to |= )?(\d{1,2})(?::(\d{2}))? /.exec(c.q);if(!b||+b[1]>23||+(b[2]||0)>59)return null;at=+b[1]*60+(+(b[2]||0));}
    if(at<720)at=at===0?at:at+720;
    if(at>=1440)at-=1440;
    const value=hhmm(at);
    return c.card('setting',[],{key:'bedtime',value},'Bedtime '+clockAt(at)+'. Plans stop there.');
  }},
  {id:'lite',when:q=>(/ (?:biscuit|companion|pony) (?:lite|light|lighter)(?: mode| version)? /.test(q)||/ (?:lite|lighter) (?:biscuit|companion|pony) /.test(q))&&!/ light (?:mode|theme) /.test(q)||/ (?:full|smarter|smart|all rules) (?:biscuit|companion|pony) | (?:biscuit|companion|pony) (?:full|smarter|full knowledge) /.test(q),answer:(m,c)=>{
    const lite=!/ (?:full|smarter|smart|more rules|all rules) /.test(c.q)||/ (?:mute|away|off|disable|block|shut|less|fewer|no more) /.test(c.q);
    return c.card('setting',[],{key:'pet.knowledge',value:lite?'lite':'most'},lite?'Biscuit Lite.':'Biscuit Full.');
  }},
  {id:'wake',when:q=>/ wake me /.test(q),answer:(m,c)=>say(c,'I can not wake you from a browser tab. A phone alarm will do it.')},
  {id:'bigger',when:q=>/^ (?:make (?:it|this|everything|the text|text) (?:bigger|larger|smaller)|bigger text|smaller text|text size) $/.test(q),answer:(m,c)=>c.card('make-it-yours',[],{tab:'look'},'Text size is in Make it yours > Look.')},
  {id:'go-away',when:q=>/^ (?:go away|hide|hide yourself|stop talking|be quiet|shut up|leave me alone) $/.test(q),answer:(m,c)=>c.card('setting',[],{key:'pet.enabled',value:false},'Hide the companion.')},
  {id:'it-how-long',when:q=>/^ how long (?:will|would|does|is|do) (?:it|that|this)(?: take| be)? $/.test(q),answer:(m,c)=>{
    const v=lastOf(c);
    return v?c.card('open',[v],{itemId:v.id},'About '+length(v.minutes)+', my guess.'):say(c,'Which one?');
  }},
  {id:'it-due',when:q=>/^ when is (?:it|that|this)(?: due)? $/.test(q),answer:(m,c)=>{
    const v=lastOf(c);
    return v?c.card('open',[v],{itemId:v.id},v.title+', '+whyNow(v,c.s).replace(/^it /,'').replace(/^is /,'')+'.'):say(c,'Which one?');
  }},
  {id:'it-done',when:q=>/^ (?:i (?:already )?(?:did|finished|completed|submitted) (?:it|that|this)(?: already)?|i turned (?:it|that) in|done with (?:it|that)|mark (?:it|that) done) $/.test(q),answer:(m,c)=>{
    const v=lastOf(c);
    return v?c.card('complete',[v],{itemId:v.id},'Mark '+v.title+' done on your list.'):say(c,'Which one?');
  }},
  {id:'it-start',when:q=>/^ (?:start it|start that|do it|do that|focus on it|focus on that|lets do it|let us do it|work on it|work on that) $/.test(q),answer:(m,c)=>{
    const v=lastOf(c);
    return v?c.card('focus',[v],{itemId:v.id,minutes:25},'25 minutes on '+v.title+'.'):say(c,'Which one?');
  }},
  {id:'it-why',when:(q,line,c)=>/^ why $/.test(q)&&!!lastOf(c),answer:(m,c)=>{const v=lastOf(c);return say(c,'Because '+whyNow(v,c.s)+'.');}},
  {id:'something-else',when:q=>/^ (?:something else|anything else|what else|another one|skip it|skip that|not this one|give me another|what is after that|and after that) $/.test(q),answer:(m,c)=>{
    const rows=ranked(c.s),v=lastOf(c),next=rows[Math.max(0,rows.findIndex(r=>r.id===v?.id)+1)]||rows[0];
    return next?c.card('open',[next],{itemId:next.id},next.title+', because '+whyNow(next,c.s)+'.'):say(c,'That is everything right now.');
  }},
  {id:'no-context',when:(q,line,c)=>fresh(c)&&/^ (?:not that one|the other one|that one|this one|the first one|the second one|no the other one) $/.test(q),answer:(m,c)=>say(c,'Which one do you mean?')},
  {id:'yes',when:q=>/^ (?:yes|yeah|yep|yup|sure|k|sounds good|ok fine|okay fine|fine) $/.test(q),answer:(m,c)=>say(c,'Okay. What do you want to do?')},
  {id:'no',when:q=>/^ (?:no|nope|nah|not now|maybe later|later|no thanks) $/.test(q),answer:(m,c)=>say(c,'Okay. I am here when you need me.')},
  {id:'thanks',when:q=>/^ (?:thanks|thank you|thx|ty|tysm|thanks biscuit|thank you so much) $/.test(q),answer:(m,c)=>say(c,'You are welcome.')},
  {id:'huh',when:q=>/^ (?:what|huh|why|how|when|hmm|hm|idk|i do not know|ok then|umm|um|uh) $/.test(q),answer:(m,c)=>say(c,'I didn\u2019t catch that. Try a course name, "hw" or "plan tonight".')},
  // what should I do
  {id:'long-overdue',when:q=>/ (?:ignore|skip|forget|hide) (?:the |all |my )*(?:old|missing|overdue|late) /.test(q),answer:(m,c)=>say(c,'Older missing work already stays out of your plans. Say "catch up" when you want it back.')},
  {
    id:'catch-up',
    when:q=>/ (?:catch(?:ing)? up|catch me up|caught up|old homework|missing work|overdue work|late work) /.test(q)&&!/ (?:what|how many|how much) /.test(q),
    answer:(m,c)=>c.card('plan',[],{local:true,line:c.line+' catch up',...(dayIn(c.q,c.s)?{date:dayIn(c.q,c.s)}:{})},'Plan your missing work.')
  },
  {
    id:'hardest',
    when:q=>!R42_RANK.test(q)&&(/ (?:hardest|biggest|toughest|longest|worst|most important|heaviest|main) (?:thing|one|task|assignment|work|homework)?/.test(q)||/ (?:worth the most|worth most|most points) /.test(q))&&(/ (?:what|which|whats) /.test(q)||/^ (?:my |the )?(?:biggest|hardest|heaviest|longest|toughest) /.test(q)),
    answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),
      soon=open(c.s).filter(v=>v.dueAt===null||v.dueAt>=now&&v.dueAt-now<=8*DAY),
      pts=v=>Number(v.points??v.pointsPossible)||0,
      top=soon.sort((a,b)=>pts(b)-pts(a)||b.minutes-a.minutes)[0];
    return top?
      c.card('open',[top],{itemId:top.id},top.title+' looks biggest'+(top.points?', '+top.points+' points':'')+'. About '+length(top.minutes)+', and '+whyNow(top,c.s)+'.'):
      say(c,'Nothing big is coming up.');
  }},
  {id:'how-much',when:q=>/ how (?:much|many) (?:work|homework|stuff|things|assignments)? ?(?:do i have|is left|have i got|left|is there)? /.test(q)&&/ (?:work|homework|stuff|things|assignments|left|due|have) /.test(q)||/ am i behind /.test(q)||/ how (?:busy|bad) /.test(q)||/^ (?:am i doing (?:ok|okay|alright|fine)|how am i doing) $/.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),
      week=c.q.includes('week')?7:c.q.includes('tomorrow')||c.q.includes('today')||c.q.includes('tonight')?2:7,
      cal=local(c.s),
      rows=open(c.s),
      wk=t2Window(' this week ',c.s),
      soon=rows.filter(v=>v.dueAt!==null&&v.dueAt>=now&&(week===2&&cal?cal(v.dueAt).day<=addDays(c.today,1):wk.span==='week'?v.dueAt<wk.to:v.dueAt-now<=7*DAY)),
      late=rows.filter(v=>v.dueAt!==null&&v.dueAt<now&&v.dueAt>=now-7*DAY),
      total=soon.reduce((n,v)=>n+v.minutes,0),
      span=week===7?'this week':'by tomorrow';
    if(!soon.length&&!late.length)return say(c,'You are clear '+span+'.');
    return c.card(
      'find',
      soon.slice(0,3),
      {},
      (/ am i behind /.test(c.q)?(late.length?'A little. ':'No. '):/ (?:am i doing|how am i doing) /.test(c.q)?(late.length?'Mostly. ':'You are on track. '):'')+
        (soon.length?soon.length+' thing'+(soon.length===1?'':'s')+' due '+span+', about '+length(total)+' of work.':'Nothing due '+span+'.')+
        (late.length?' '+late.length+' from this past week still open.':''),
      {answerKind:'mind',listRows:[...late,...soon]});
  }},
  {
    id:'have-time',
    when:q=>/^ (?:i (?:only |just )?have|i have got|i got|got|only have|only got) (?:about |like |around )?\d+(?:\.\d+)? ?(?:min|hour|h)(?: left| free| to spare)? $/.test(q),
    answer:(m,c)=>c.card('plan',[],{local:true,line:c.line,minutes:minutesIn(c.q)},'')
  },
  {id:'quick',when:q=>/ (?:something|anything|what is) (?:quick|short|easy|small|fast) /.test(q)||/ (?:quickest|easiest|shortest|smallest|fastest) /.test(q)||/ what can i (?:finish|do|get done) (?:in|with|before) /.test(q)||/ (?:quick|easy) (?:win|one|thing|task) /.test(q),answer:(m,c)=>{
    if(/ (?:quickest|easiest|shortest|smallest|fastest) /.test(c.q)){
      const small=ranked(c.s).sort((a,b)=>a.minutes-b.minutes)[0];
      return small?c.card('focus',[small],{itemId:small.id,minutes:small.minutes},small.title+', about '+length(small.minutes)+'.'):say(c,'Nothing to do right now.');
    }
    const room=minutesIn(c.q)||(/ before /.test(c.q)?45:20),rows=ranked(c.s),fit=rows.filter(v=>v.minutes<=room);
    if(!fit.length){
      const small=rows.slice().sort((a,b)=>a.minutes-b.minutes)[0];
      return small?
        c.card('focus',[small],{itemId:small.id,minutes:room},'Nothing fits in '+length(room)+' whole. '+small.title+' is closest, about '+length(small.minutes)+'. Want to start it?'):
        say(c,'Nothing to do right now.');
    }
    return c.card('focus',[fit[0]],{itemId:fit[0].id,minutes:fit[0].minutes},fit[0].title+' fits, about '+length(fit[0].minutes)+'.'+(fit[1]?' Or '+fit[1].title+'.':''));
  }},
  {id:'what-now',when:q=>/ (?:what to do(?: now| next| first| tonight| today)?|what (?:can|could) i (?:do|work on|start)|what should i (?:do|work on|start)|what do i (?:do|work on|start)|what (?:is |to do )?next|where (?:do|should) i start|i do not know (?:where to start|what to do)|what first|help me (?:start|get started|decide)|what now|where to start|what is first|what should i (?:do )?(?:next|first|now)|what is worth doing|what is worth doing first|(?:which one|what) matters most|what is most urgent) /.test(q),answer:(m,c)=>{
    if(!/ (?:do|doing|work|start|begin|tackle|plan|schedule|study|focus|get started|decide) /.test(c.q))return nextUp(c.s,c);
    const when=dayIn(c.q,c.s);
    if(when&&when!==c.today)return c.card('plan',[],{local:true,line:'plan',date:when},'');
    const rows=ranked(c.s),top=rows[0];
    if(!top)return c.card('plan',[],{local:true,line:c.line},'Nothing urgent. A good night for your own project, or a short review.');
    const after=rows.slice(1,3).map(v=>v.title);
    return c.card(
      'plan',
      rows.slice(0,3),
      {local:true,line:c.line},
      'Start with '+top.title+', because '+whyNow(top,c.s)+(top.minutes?'. About '+length(top.minutes):'')+'.'+(after.length?' Then '+after.join(', then ')+'.':''));
  }},
  // their own work, Canvas knows nothing about it
  {id:'own-work',when:(q,line,c)=>{
    if(R9_CH_THING.test(q))return false;
    const add=/^ (?:task|add|put|new task|new todo|todo|to do|remember to do)[: ]+\S/.test(q)&&!/^ add \d+ ?(?:min|hour) to /.test(q)&&!/^ add a card /.test(q)&&!/ (?:module|widget|feature|to home|on home|first|last|note|notes) /.test(q),
      said=!ASKS.test(q)&&new RegExp('(?:^| )(?:i (?:have|need|want|got|should|must|am going) to|i have got to|need to|have to|want to|going to|i will|i should|i plan to|i must) (?:'+STUDY+') ').test(q),
      gave=!/ due (?:on |by |this )?sat /.test(q)&&new RegExp(' (?:my )?(?:tutor|coach|mom|dad|parent|teacher|counselor|sat|act|ap) ').test(q)&&new RegExp(' (?:'+THINGS+') ').test(q);
    return add||said||gave||HAVE.test(q)&&!/ (?:grade|plan) /.test(q)||CHORE.test(q)&&!named(q,c.s)&&!c.courseIn(q);
  },answer:(m,c)=>{
    const typed=' '+String(c.line).replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim()+' ',low=text=>text.toLowerCase();
    let text=typed.trim().replace(/^(?:task|add (?:a )?task|add|put|new task|new|todo|to do|remember to do|write down)[: ]+/i,'').replace(/^(?:also )?(?:i (?:have|need|want|got|should|must|am going) to|i have got to|i've got to|need to|have to|gotta|want to|wanna|going to|i will|i should|i plan to|i must)\s+/i,'').replace(/^(?:i have|i got|i've got|we have|we got)\s+/i,'').replace(/ (?:to my (?:list|plan|planner|schedule|todo)|on my (?:list|plan|planner))\b/i,'').replace(
      /^(?:my\s+)?(?:\w+\s+)?(?:gave|assigned|set|told)\s+(?:me\s+|us\s+)?(?:to\s+)?(?:a|an|some|the)?\s*/i,
      '').replace(
      /\s+(?:that|which|it)\s+(?:is not|isn't|isnt)\s+(?:on|in)\s+canvas\b/i,
      '').replace(
      /,?\s+due\s+/i,
      ' by ');
    const q=spell(text),day=dayIn(q,c.s),at=clockIn(q),minutes=minutesIn(q),tonight=/ (?:tonight|tn|tonite) /.test(q);
    text=cleanName(' '+text+' ').replace(/^(?:a|an|the|my|some)\s+/i,'').replace(/^(?:work on|do|finish|complete|start)\s+(?:my\s+|the\s+)?/i,'').replace(/,\s*(?:about|around|like)\s+/i,', ').replace(/[,\s]+$/,'');
    if(!text||text.length<3)return null;
    if(/^(?:task|something|thing|item|todo|reminder)$/i.test(text))return say(c,/reminder/i.test(text)?'Say "remind me to bring goggles tomorrow".':'What should I add? Like "add read chapter 5 tomorrow".');
    const giver=/^(?:my\s+)?(tutor|coach)\b/i.exec(typed.trim())?.[1];
    if(giver&&/^(?:homework|work|problems)$/i.test(text))text=giver+' '+text.toLowerCase();
    text=text.replace(/\b(sat|act)\b(?= prep| test| practice)/gi,w=>w.toUpperCase());
    // work Canvas already has goes on the plan as that work
    const words=low(text).split(' ').filter(w=>w.length>3&&!/^(?:work|homework|finish|study|read|write|start|complete|review|practice)$/.test(w)),
      hit=words.length?open(c.s).find(v=>words.every(w=>v.title.toLowerCase().includes(w))):null;
    if(hit)return null;
    const name=firstUp(text),
      when=tonight&&at===null?'tonight':whenWords(day,at,c.s),
      est=minutes||(/\b(?:essay|paper(?! worksheet)|project|lab|report)\b/i.test(text)?60:/\b(?:test|exam|quiz|reading)\b/i.test(text)?35:30);
    return c.card(
      'task',
      [],
      {name,day:day||'',estimate:est,...(at!==null?{at:String(Math.floor(at/60)).padStart(2,'0')+':'+String(at%60).padStart(2,'0')}:{})},
      'Add to your list: '+name+(when?', '+when:'')+', about '+length(est)+'.',
      {understanding:{step:'understanding',reason:'own-work'}});
  }},
  // the day is theirs: things they have on
  {
    id:'around-event',
    when:q=>new RegExp(' (?:'+EVENTS+') ').test(q)&&/ (?:at|from|until|till) (?:\d|noon)| \d{1,2}(?::\d{2})? ?(?:am|pm) /.test(q)&&!/ (?:remind|open|find|where|due) /.test(q)&&!/ shift [a-z ]+ to /.test(q)||/ (?:i have work|i work|i have a shift|i am working|working) (?:at|from|until|till|tonight|tomorrow) /.test(q),
    answer:(m,c)=>{
    const at=clockIn(c.q),day=dayIn(c.q,c.s)||c.today,name=eventName(c.q),cal=c.wall;
    if(at===null||!cal)return null;
    const start=cal(day,at),end=start+HOURS_FOR(c.q)*MIN,fields={local:true,line:'plan '+(day===c.today?'today':'tomorrow'),date:day,avoid:[{start,end}]};
    return c.card('plan',[],fields,'',{lead:firstUp(name)+' '+whenWords(day,at,c.s)+', noted. '});
  }},
  // done already
  {id:'done-by-day',when:q=>/ (?:i (?:already )?(?:did|finished|completed|turned in|submitted|handed in|am done with)|already did|done with) .*(?:sun|mon|tues?|wed|thu|thur|thurs|fri|sat)[a-z]* /.test(q),answer:(m,c)=>{
    const word=/ (sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu|thur|thurs|fri|sat) /.exec(c.q)?.[1]?.slice(0,3),
      rows=open(c.s).filter(v=>new RegExp('\\b'+word,'i').test(v.title));
    if(!rows.length)return null;
    if(rows.length===1)return c.card('complete',rows,{itemId:rows[0].id},'Mark '+rows[0].title+' done on your list.');
    return c.card('find',rows,{},'Which one? '+rows.length+' have that name.',{answerKind:'mind'});
  }},
  {id:'done-item',when:q=>/ (?:i (?:already )?(?:did|finished|completed|turned in|submitted|handed in)|i am done with|already did|i have done|done with|mark) /.test(q)&&!/ (?:did i|have i|personal|my own|todo|task) /.test(q)&&!/ (?:how|what|when) /.test(q),answer:(m,c)=>{
    const hit=named(c.q,c.s);
    if(hit)return c.card('complete',[hit],{itemId:hit.id},'Mark '+hit.title+' done on your list.');
    return / (?:that|it) /.test(c.q)&&fresh(c)?say(c,'Which one?'):null;
  }},
  {id:'missed',when:q=>/ (?:what did i miss|what did i forget|did i (?:miss|forget) anything|what have i missed|what am i missing|anything i missed|what is missing|what do i owe) /.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),late=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt<now).sort((a,b)=>b.dueAt-a.dueAt);
    if(!late.length)return say(c,'Nothing missing. Nice.');
    const days=Math.max(1,Math.round((now-late[0].dueAt)/DAY));
    return c.card('find',late.slice(0,3),{},late.length+' still open. The newest is '+late[0].title+', '+days+' day'+(days===1?'':'s')+' late. Say catch up to plan them.',{answerKind:'mind'});
  }},
  {id:'study-plan',when:q=>/ (?:study plan|study schedule|plan .*study|prepare for|prep for|get ready for|study for) /.test(q)&&/ (?:a day|every day|each day|per day|daily|plan|schedule) /.test(q),answer:(m,c)=>{
    const words=c.q.split(' ').filter(w=>w.length>3),
      rows=open(c.s).filter(v=>v.dueAt!==null),
      hit=rows.map(v=>({v,n:words.filter(w=>v.title.toLowerCase().includes(w)).length})).sort((a,b)=>b.n-a.n)[0];
    if(!hit||!hit.n)return null;
    const now=stamp(c.s.now)||Date.now(),
      days=Math.max(1,Math.floor((hit.v.dueAt-now)/DAY)),
      sessions=Math.min(5,days),
      each=minutesIn(c.q)||30,
      from=addDays(c.today,1),
      until=addDays(c.today,sessions);
    return c.card(
      'plan',
      [hit.v],
      {itemId:hit.v.id,date:from,endDate:until,minutes:each},
      hit.v.title+' is in '+days+' day'+(days===1?'':'s')+'. '+length(each)+' a day for '+sessions+' day'+(sessions===1?'':'s')+', starting tomorrow.');
  }},
  {id:'order',when:(q,line,c)=>/ (?:first|then|before) /.test(q)&&/^ (?:do |plan |start with |i will do |i want to do )/.test(q)&&c.coursesIn(q).length>=2,answer:(m,c)=>{
    const ids=c.coursesIn(c.q).map(v=>String(v.id));
    return c.card('plan',[],{local:true,line:'plan tonight',order:ids},'');
  }},
  {id:'how-to',when:q=>/ (?:how (?:do|can|could|would) i|how to|where (?:do|can|is|are) (?:i|the|my)?|can i) /.test(q)&&!/ where can i change /.test(q)&&WHERE.some(([re])=>re.test(q)),answer:(m,c)=>{
    const [,path,tab]=WHERE.find(([re])=>re.test(c.q));
    return c.card('none',[],{},'Make it yours > '+path+'.',{choices:[{label:'Open it',action:'make-it-yours',fields:{tab}}]});
  }},
  // course questions
  {
    id:'course-work',
    when:(q,line,c)=>
      (/ (?:anything|what is|whats|what do i have|do i have|what (?:is )?due|when is the|what about|how about) /.test(q)||q.trim().split(' ').length===1&&c.onlyCourse(q))&&
        !!c.courseIn(q)&&
        !/ (?:grade|teacher|who|where is the page|syllabus) /.test(q),
    answer:(m,c)=>{
    const course=c.courseIn(c.q),
      bare=c.q.trim().split(' ').length===1,
      now=stamp(c.s.now)||Date.now(),
      kind=kindOf(c.q),
      rows=open(c.s).filter(v=>String(v.courseId)===String(course.id)&&isKind(v,kind)&&(v.dueAt===null||v.dueAt>=now-7*DAY)).sort((a,b)=>
        (a.dueAt??Infinity)-(b.dueAt??Infinity)),
      name=course.shortName||course.name;
    if(kind&&!rows.length)return null;
    if(!rows.length){
      const old=open(c.s).filter(v=>String(v.courseId)===String(course.id)).length,word=old?'Nothing new in '+name+'. '+old+' older item'+(old===1?'':'s')+' still open.':'Nothing open in '+name+'.';
      return bare?c.card('navigate',[{id:String(course.id),title:course.name,kind:'course',courseId:String(course.id)}],{tab:'course',courseId:String(course.id)},word):say(c,word);
    }
    const first=rows[0],when=first.dueAt===null?'':whyNow(first,c.s).replace(/^it /,'').replace(/^is /,'');
    const line=name+': '+first.title+(when?', '+when:'')+'.'+(rows.length>1?' '+(rows.length-1)+' more after that.':'');
    return bare?
      c.card('navigate',[{id:String(course.id),title:course.name,kind:'course',courseId:String(course.id)},...rows.slice(0,2)],{tab:'course',courseId:String(course.id)},line):
      c.card('open',rows.slice(0,3),kind&&/ (?:when|due) /.test(c.q)&&first.dueAt!==null?{itemId:first.id,answerField:'dueAt',dueAt:first.dueAt}:{itemId:first.id},line);
  }},
  // biscuit-42: the readings above, after every older rule
  {id:'r42-course',when:(q,line,c)=>r42Course(q,line,c.s),answer:(m,c)=>r42CourseAnswer(m,c)},
  {id:'r42-next-due',when:q=>/^ (?:what is |when is )?(?:my |the )?(?:very )?next (?:deadline|due date|thing due|due|assignment due|thing i have due)(?: please)? $/.test(q),answer:(m,c)=>nextUp(c.s,c)},
  {id:'r42-missing',when:q=>R42_MISSED.test(q)&&q.trim().split(' ').every(w=>R42_MISSED_WORDS.has(w)),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),late=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt<now).sort((a,b)=>b.dueAt-a.dueAt);
    return late.length?r42List(c,late,'not turned in yet','Not turned in yet'):say(c,'Nothing missing. Everything due so far is in.');
  }},
  {id:'r42-behind',when:q=>/ (?:am i|i am|are you sure i am|you sure i am) (?:not |really |falling |getting |so |too |way )*behind /.test(q),answer:(m,c)=>{
    const r=RULES.find(x=>x.id==='how-much').answer(m,{...c,q:' am i behind '});
    if(r)r.understanding={step:'understanding',reason:'mind:how-much'};
    return r;
  }},
  {
    id:'r42-plan-make',
    when:q=>/^ (?:(?:can you|could you|please) )?(?:make|give|build|create|write|set up|do) (?:me )?(?:a |my |the )?(?:study )?plan (?:for )?(?:my |the )?(?:today|tonight|tomorrow|this evening|this afternoon|week|this week|whole week)?(?: please)? $/.test(q),
    answer:(m,c)=>/ week /.test(c.q)?RULES.find(r=>r.id==='plan-week').answer(m,{...c,q:' plan my week '}):(()=>{
    const word=/ (today|tonight|tomorrow) /.exec(c.q)?.[1]||(/ (?:evening|afternoon) /.test(c.q)?'tonight':'today'),day=dayIn(' '+word+' ',c.s);
    return c.card('plan',[],{local:true,line:'plan '+word,...(day?{date:day}:{})},'');
  })()},
  {id:'r42-work-list',when:(q,line,c)=>r42WorkList(q,line,c),answer:(m,c)=>r42WorkAnswer(m,c)},
  {id:'r42-grade-of',when:(q,line,c)=>r42GradeOf(q,line,c.s),answer:(m,c)=>r42GradeAnswer(m,c)},
  {id:'r42-grade-rank',when:q=>R42_RANK.test(q),answer:(m,c)=>r42RankAnswer(m,c)},
  {id:'r42-study-for',when:q=>r42StudyFor(q),answer:(m,c)=>r42StudyAnswer(m,c)},
  {id:'r42-annc',when:(q,line,c)=>r42Annc(q,line,c.s),answer:(m,c)=>r42AnncAnswer(m,c)},
 ];

 function think(line,s,session={},tools={}){KIND_GROUPS=new Map(list(s?.assignmentGroups).map(g=>[String(g.id),String(g.name||'')]));
  const q=spell(line);if(q.length>220)return null;if(/^\s*(?:note\b|notes\b|write down\b|(?:put|add|save|write|keep)\b[^:]{0,30}\bnotes?\b)/i.test(String(line)))return null;
  const cal=local(s),now=stamp(s.now)||Date.now(),part=cal?cal(now):null,courseIn=text=>{
    for(const v of list(s.courses)){
      const names=[v.shortName,v.name,v.course_code].filter(Boolean).map(n=>String(n).toLowerCase().replace(/^cl\s+/,'').replace(/[:\-].*$/,'').trim());
      for(const n of names){
        if(n.length>=3&&text.includes(' '+n+' '))return v;
        for(const word of n.split(/\s+/))
          if(word.length>=4&&!/^(?:semester|literature|advanced|honors|intro|introduction|course|class)$/.test(word)&&(text.includes(' '+word+' ')||text.includes(' '+word.slice(0,4)+' ')))return v;
      }
    }
    return null;
  };
  const ctx={
    ...tools,
    s,
    q,
    line:String(line),
    session,
    onlyCourse:text=>
      list(s.courses).filter(v=>
        [v.shortName,v.name,v.course_code].filter(Boolean).some(n=>
          String(n).toLowerCase().replace(/^cl\s+/,'').split(/[\s:\-]+/).some(w=>w.length>=3&&w.startsWith(text.trim().slice(0,Math.max(3,text.trim().length)))))).length===1,
    name:s.pet?.name||s.settings?.pet?.name||'Biscuit',
    turn:Number(session?.turn)||Math.floor(now/60000),
    minute:part?part.minute:720,
    today:part?part.day:'',
    courseIn,
    coursesIn:text=>list(s.courses).map(v=>({v,at:(()=>{
    let best=-1;
    for(const n of [v.shortName,v.name].filter(Boolean)){
      const word=String(n).toLowerCase().replace(/^cl\s+/,'').split(/[\s:\-]+/)[0];
      if(word.length>=4){const i=text.indexOf(' '+word.slice(0,4));if(i>=0&&(best<0||i<best))best=i;}
    }
    return best;
  })()})).filter(r=>r.at>=0).sort((a,b)=>a.at-b.at).map(r=>r.v),wall:(day,minute)=>load('CanvasHarnessAgentClock','./agent-clock.js')?.wall?.(day,minute,s.timeZone||'America/New_York')};
  for(const rule of RULES){
    let hit=false;
    try{hit=rule.when(q,String(line),ctx);}catch{continue;}
    if(!hit)continue;
    const card=rule.answer(hit,ctx);
    if(card){card.understanding={step:'understanding',reason:'mind:'+rule.id,...card.understanding};return card;}
  }
  return null;
 }
 function nextUp(s,c){
   const now=stamp(s.now)||Date.now(),
     rows=open(s).filter(v=>v.dueAt!==null&&v.dueAt>=now).sort((a,b)=>a.dueAt-b.dueAt),
     late=open(s).filter(v=>v.dueAt!==null&&v.dueAt<now&&v.dueAt>=now-7*DAY);
   if(!rows.length)
     return c.card(
       'none',
       [],
       {},
       'Nothing is due ahead right now.'+(late.length?' '+late.length+' still open from the past week.':''),
       {answerKind:'mind',understanding:{step:'understanding',reason:'mind:next-up'}});
  const when=v=>{
    const zone=s.timeZone||'America/New_York',cal=local(s),d=cal?Math.round((Date.parse(cal(v.dueAt).day+'T12:00Z')-Date.parse(cal(now).day+'T12:00Z'))/DAY):null;
    return (d===0?'today':d===1?'tomorrow':new Date(v.dueAt).toLocaleDateString('en-US',{timeZone:zone,weekday:'long',month:'short',day:'numeric'}))+
      ' at '+
      new Date(v.dueAt).toLocaleTimeString('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'});
  },nm=v=>v.title+(courseName(v,s)?' ('+courseName(v,s)+')':''),top=rows.slice(0,3);
  return c.card(
    'find',
    top,
    {},
    'Next: '+nm(top[0])+', '+when(top[0])+'.'+(top.length>1?' Then '+top.slice(1).map(v=>nm(v)+', '+when(v)).join('; ')+'.':'')+(late.length?' Also still open: '+late.length+' from the past week.':''),
    {answerKind:'mind',listRows:top,listTitle:'Next up',understanding:{step:'understanding',reason:'mind:next-up'}});}
 const api={think,spell,ranked,RULES,nextUp,mend,dueWindow,dueList};root.ReserveBiscuitMind=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
