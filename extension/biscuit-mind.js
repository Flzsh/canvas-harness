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
   [/ (?:hows|how s) /g,' how is '],
   [/ (?:ive|i ve) /g,' i have '],
   [/ (?:tmrw|tmr|tmw|tomo|2moro|2mrw) /g,' tomorrow '],
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
    if(v.done||v.completed||v.submitted||my.checkedOff||my.progress==='done')continue;
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
   const words=String(text).split(' ').filter(w=>w.length>3&&!/^(?:this|that|with|from|have|done|thing|work|homework|tomorrow|tonight|today|already|please|mark|finished|completed|submitted|turned|handed|what|does|need|about|sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.test(w));
   let best=null,score=0;
   for(const v of open(s)){const title=v.title.toLowerCase(),n=words.filter(w=>title.includes(w)).length;if(n>score){best=v;score=n;}}
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
 const WHERE=[[/ (?:banner|course (?:art|picture|drawing)|course image) /,'Courses > Banner','courses'],[/ (?:course name|rename|nickname) /,'Courses > Course list','courses'],[/ (?:graphics|quality|lag|laggy|slow|faster|smoother) /,'Look > Graphics','look'],[/ (?:dark|light mode|night mode|theme) /,'Look > Light or dark','look'],[/ (?:scene|background|wallpaper) /,'Look > Scene','look'],[/ (?:accent|colou?r) /,'Look > Accent color','look'],[/ (?:font|text size|bigger text|smaller text|letters) /,'Look > Type','look'],[/ (?:strip|dock|rail|sidebar|where my courses|move my courses) /,'Home > Where your courses are','layout'],[/ (?:layout|home page|modules|widgets|rearrange) /,'Home','layout'],[/ (?:biscuit|pony|pet|companion|horse) /,'Companion','pet']];
 // Each rule: {id, when(q, line, ctx), answer(match, ctx)}.
 const say=(c,message,extra={})=>c.card('chat',[],{},message,{understanding:{step:'understanding',reason:'mind'},...extra});
 const RULES=[
  {id:'crisis',when:q=>/ (?:kill myself|want to die|wanna die|end my life|end it all|hurt myself|harm myself|suicid|do not want to (?:be here|live|exist)|no reason to live) /.test(q),answer:(m,c)=>say(c,'I am really glad you told me. Please talk to someone right now: a parent, a counselor, or call or text 988 (Suicide and Crisis Lifeline, US). You matter, and you do not have to carry this alone.')},
  {id:'small-talk',when:q=>/^ (?:how (?:are you|is it going)|what is up|sup|hows life|you good|how you doing) $/.test(q),answer:(m,c)=>say(c,['Doing well. What are you working on?','Good, thanks. Anything on your mind?'][c.turn%2])},
  {id:'who',when:q=>/^ (?:what are you|are you (?:a )?(?:horse|pony|ai|real)) $/.test(q),answer:(m,c)=>say(c,'I am '+c.name+'. I plan your time, keep your list, and find anything in Canvas.')},
  {id:'can-do',when:q=>/^ (?:what can you do|what do you do|how do you work|how do i use you|what can i ask(?: you)?) $/.test(q),answer:(m,c)=>say(c,'Try "plan tonight", "I have to read 30 pages tomorrow", "what should I do first", "soccer at 5 tomorrow, plan around it", or a course name.')},
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
  {id:'bare-next',when:(q,line,c)=>/^ (?:next|todo|to do|to-do|my list|list|homework|assignments|work|tasks|stuff|hw) $/.test(q)&&fresh(c)&&open(c.s).length>1,answer:(m,c)=>{
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
  {id:'plan-hours',when:q=>/^ plan (?:for )?(?:about )?(?:\d+(?:\.\d+)?|an?) ?(?:hours?|hrs?|h|min|mins|minutes)(?: tonight| today| tomorrow)? $/.test(q),answer:(m,c)=>{
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
  {id:'after-event',when:q=>/ after (?:dinner|practice|school|work|class|the game|lunch) /.test(q)&&!/ (?:move|push|bump|shift|reschedule|put|note|remind) /.test(q),answer:(m,c)=>{
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
  {id:'turned-in',when:q=>/ did i (?:turn in|submit|hand in|finish|do) /.test(q),answer:(m,c)=>{
    const hit=named(c.q,c.s);
    if(hit)return c.card('open',[hit],{itemId:hit.id},'Not yet. '+hit.title+(hit.dueAt!==null?', '+whyNow(hit,c.s).replace(/^it /,'').replace(/^is /,''):'')+'.');
    const words=c.q.split(' ').filter(w=>w.length>3&&!/^(?:turn|submit|hand|finish)$/.test(w)),
      gone=list(c.s.assignments).find(v=>v.submitted&&words.some(w=>String(v.title||v.name||'').toLowerCase().includes(w)));
    return gone?say(c,'Yes, '+(gone.title||gone.name)+' is in.'):null;
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
  {id:'due-week',when:q=>/ (?:what is )?due (?:this|next) week /.test(q)||/ what do i have (?:this|next) week /.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),
      next=/ next week /.test(c.q),
      from=next?now+7*DAY:now,
      to=from+7*DAY,
      rows=open(c.s).filter(v=>v.dueAt!==null&&v.dueAt>=from&&v.dueAt<to).sort((a,b)=>a.dueAt-b.dueAt),
      day=v=>new Date(v.dueAt).toLocaleDateString('en-US',{timeZone:c.s.timeZone||'America/New_York',weekday:'short'});
    return rows.length?
      c.card('find',rows.slice(0,3),{},rows.slice(0,5).map(v=>day(v)+': '+v.title).join('. ')+'.'+(rows.length>5?' And '+(rows.length-5)+' more.':''),{answerKind:'mind'}):
      say(c,'Nothing due '+(next?'next':'this')+' week.');
  }},
  {id:'late-count',when:q=>/ (?:how many|is anything|anything|what is) .*(?:overdue|late|missing) /.test(q),answer:(m,c)=>{
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
  {id:'review-cards',when:q=>/ (?:review my cards|my flashcards|my cards|study my cards|add a card|new card|flashcard) /.test(q)&&!/ (?:make|art|artwork) /.test(q),answer:(m,c)=>c.card('navigate',[],{tab:'review'},'Review deck.')},
  {
    id:'email',
    when:q=>/ (?:email|message|text|contact) (?:my |the )?(?:teacher|mr|mrs|ms|dr|tutor|counselor) /.test(q),
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
  {id:'study-course',when:(q,line,c)=>/^ (?:study|studying|study for|work on|do|focus on|time for) /.test(q)&&q.trim().split(' ').length<=4&&!!c.courseIn(q),answer:(m,c)=>{
    const course=c.courseIn(c.q),top=ranked(c.s).find(v=>String(v.courseId)===String(course.id)),name=course.shortName||course.name;
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
  {id:'bedtime',when:q=>/ (?:sleep|bed|asleep) (?:by|at|around) /.test(q)||/ bedtime (?:is|at) /.test(q),answer:(m,c)=>{
    let at=clockIn(c.q);
    if(at===null)return null;
    if(at<720)at=at===0?at:at+720;
    if(at>=1440)at-=1440;
    const value=hhmm(at);
    return c.card('setting',[],{key:'bedtime',value},'Bedtime '+clockAt(at)+'. Plans stop there.');
  }},
  {id:'lite',when:q=>/ (?:biscuit lite|lite biscuit|lighter biscuit) /.test(q),answer:(m,c)=>c.card('make-it-yours',[],{tab:'companion'},'Biscuit Lite is in Make it yours > Companion.')},
  {id:'wake',when:q=>/ wake me /.test(q),answer:(m,c)=>say(c,'I can not wake you from a browser tab. A phone alarm will do it.')},
  {id:'bigger',when:q=>/^ (?:make (?:it|this|everything|the text|text) (?:bigger|larger|smaller)|bigger text|smaller text|text size) $/.test(q),answer:(m,c)=>c.card('make-it-yours',[],{tab:'look'},'Text size is in Make it yours > Look.')},
  {id:'go-away',when:q=>/^ (?:go away|hide|hide yourself|stop talking|be quiet|shut up|leave me alone) $/.test(q),answer:(m,c)=>c.card('setting',[],{key:'pet.enabled',value:false},'Hide the companion. Treats and level are kept.')},
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
  {id:'huh',when:q=>/^ (?:what|huh|why|how|when|hmm|hm|idk|i do not know|ok then|umm|um|uh) $/.test(q),answer:(m,c)=>say(c,'Say a bit more? Try "plan tonight" or a course name.')},
  // what should I do
  {id:'long-overdue',when:q=>/ (?:ignore|skip|forget|hide) (?:the |all |my )*(?:old|missing|overdue|late) /.test(q),answer:(m,c)=>say(c,'Older missing work already stays out of your plans. Say "catch up" when you want it back.')},
  {
    id:'catch-up',
    when:q=>/ (?:catch(?:ing)? up|old homework|missing work|overdue work|late work) /.test(q)&&!/ (?:what|how many|how much) /.test(q),
    answer:(m,c)=>c.card('plan',[],{local:true,line:c.line+' catch up',...(dayIn(c.q,c.s)?{date:dayIn(c.q,c.s)}:{})},'Plan your missing work.')
  },
  {id:'hardest',when:q=>(/ (?:hardest|biggest|toughest|longest|worst|most important|heaviest|main) (?:thing|one|task|assignment|work|homework)?/.test(q)||/ (?:worth the most|worth most|most points) /.test(q))&&/ (?:what|which|whats) /.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),
      soon=open(c.s).filter(v=>v.dueAt===null||v.dueAt>=now&&v.dueAt-now<=8*DAY),
      top=soon.sort((a,b)=>(Number(b.points)||0)-(Number(a.points)||0)||b.minutes-a.minutes)[0];
    return top?
      c.card('open',[top],{itemId:top.id},top.title+' looks biggest'+(top.points?', '+top.points+' points':'')+'. About '+length(top.minutes)+', and '+whyNow(top,c.s)+'.'):
      say(c,'Nothing big is coming up.');
  }},
  {id:'how-much',when:q=>/ how (?:much|many) (?:work|homework|stuff|things|assignments)? ?(?:do i have|is left|have i got|left|is there)? /.test(q)&&/ (?:work|homework|stuff|things|assignments|left|due|have) /.test(q)||/ am i behind /.test(q)||/ how (?:busy|bad) /.test(q)||/^ (?:am i doing (?:ok|okay|alright|fine)|how am i doing) $/.test(q),answer:(m,c)=>{
    const now=stamp(c.s.now)||Date.now(),
      week=c.q.includes('week')?7:c.q.includes('tomorrow')||c.q.includes('today')||c.q.includes('tonight')?2:7,
      cal=local(c.s),
      rows=open(c.s),
      soon=rows.filter(v=>v.dueAt!==null&&v.dueAt>=now&&(week===2&&cal?cal(v.dueAt).day<=addDays(c.today,1):v.dueAt-now<=7*DAY)),
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
      {answerKind:'mind'});
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
  {id:'what-now',when:q=>/ (?:what should i (?:do|work on|start)|what do i (?:do|work on|start)|what (?:is|to do) next|where (?:do|should) i start|i do not know (?:where to start|what to do)|what first|help me (?:start|get started|decide)|what now|where to start|what is first|what should i (?:do )?(?:next|first|now)|what is worth doing|what is worth doing first|(?:which one|what) matters most|what is most urgent) /.test(q),answer:(m,c)=>{
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
    const add=/^ (?:add|put|new task|new|todo|to do|remember to do)[: ]+\S/.test(q)&&!/^ add \d+ ?(?:min|hour) to /.test(q)&&!/^ add a card /.test(q)&&!/ (?:module|widget|feature|to home|on home|first|last|note|notes) /.test(q),
      said=!ASKS.test(q)&&new RegExp('(?:^| )(?:i (?:have|need|want|got|should|must|am going) to|i have got to|need to|have to|want to|going to|i will|i should|i plan to|i must) (?:'+STUDY+') ').test(q),
      gave=new RegExp(' (?:my )?(?:tutor|coach|mom|dad|parent|teacher|counselor|sat|act|ap) ').test(q)&&new RegExp(' (?:'+THINGS+') ').test(q);
    return add||said||gave||HAVE.test(q)&&!/ (?:grade|plan) /.test(q)||CHORE.test(q)&&!named(q,c.s)&&!c.courseIn(q);
  },answer:(m,c)=>{
    const typed=' '+String(c.line).replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim()+' ',low=text=>text.toLowerCase();
    let text=typed.trim().replace(/^(?:add|put|new task|new|todo|to do|remember to do|write down)[: ]+/i,'').replace(/^(?:also )?(?:i (?:have|need|want|got|should|must|am going) to|i have got to|i've got to|need to|have to|gotta|want to|wanna|going to|i will|i should|i plan to|i must)\s+/i,'').replace(/^(?:i have|i got|i've got|we have|we got)\s+/i,'').replace(/ (?:to my (?:list|plan|planner|schedule|todo)|on my (?:list|plan|planner))\b/i,'').replace(
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
    return c.card('find',[],{},'Make it yours > '+path+'.',{next:{action:'make-it-yours',fields:{tab},label:'Open it'}});
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
      rows=open(c.s).filter(v=>String(v.courseId)===String(course.id)&&(v.dueAt===null||v.dueAt>=now-7*DAY)).sort((a,b)=>(a.dueAt??Infinity)-(b.dueAt??Infinity)),
      name=course.shortName||course.name;
    if(!rows.length){
      const old=open(c.s).filter(v=>String(v.courseId)===String(course.id)).length,word=old?'Nothing new in '+name+'. '+old+' older item'+(old===1?'':'s')+' still open.':'Nothing open in '+name+'.';
      return bare?c.card('navigate',[{id:String(course.id),title:course.name,kind:'course',courseId:String(course.id)}],{tab:'course',courseId:String(course.id)},word):say(c,word);
    }
    const first=rows[0],when=first.dueAt===null?'':whyNow(first,c.s).replace(/^it /,'').replace(/^is /,'');
    const line=name+': '+first.title+(when?', '+when:'')+'.'+(rows.length>1?' '+(rows.length-1)+' more after that.':'');
    return bare?
      c.card('navigate',[{id:String(course.id),title:course.name,kind:'course',courseId:String(course.id)},...rows.slice(0,2)],{tab:'course',courseId:String(course.id)},line):
      c.card('open',rows.slice(0,3),{itemId:first.id},line);
  }},
 ];

 function think(line,s,session={},tools={}){
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
 const api={think,spell,ranked,RULES};root.ReserveBiscuitMind=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
