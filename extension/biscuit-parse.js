// Adapted from Gary Wu's pull request #47 to Canvas Harness.
/* Pure local command candidates. All dates and times come from the supplied context. */
(function(root){
 'use strict';
 function defaultTimeZone(){
  const zones=[];try{zones.push(root.ReserveSite?.timeZone?.());}catch{}try{zones.push(Intl.DateTimeFormat().resolvedOptions().timeZone);}catch{}
  for(const zone of zones)if(typeof zone==='string'&&zone)try{new Intl.DateTimeFormat('en-US',{timeZone:zone});return zone;}catch{}
  return 'UTC';
 }
 const MIN=60000,
   DAY=86400000,
   ZONE=defaultTimeZone(),
   DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],
   MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'],
   SHORT_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{},
   clean=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim():'',
   id=v=>(typeof v==='string'||typeof v==='number'&&Number.isFinite(v))&&String(v).trim()&&!/[\u0000-\u001f\u007f]/.test(String(v))?String(v):'',
   stamp=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<8640000000000000?v:typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null,
   words=v=>clean(v).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[],
   pad=v=>String(v).padStart(2,'0'),
   short=v=>v.length>60?v.slice(0,57).trimEnd()+'...':v;
 const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,
   addDays=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*DAY).toISOString().slice(0,10),
   weekday=day=>new Date(day+'T12:00:00Z').getUTCDay(),
   dateOf=(y,m,d)=>{
   const v=String(y).padStart(4,'0')+'-'+pad(m)+'-'+pad(d);
   return validDay(v)?v:null;
 };
 const letters=new Map();
 function signature(w){
   if(letters.has(w))return letters.get(w);
   const value=w.split('').sort().join('');
   if(letters.size>=512)letters.clear();
   letters.set(w,value);
   return value;
 }
 function different(a,b,limit){
   const x=signature(a),y=signature(b);
   let i=0,j=0,n=0;
   while(i<x.length&&j<y.length){if(x[i]===y[j]){i++;j++;}else{if(x[i]<y[j])i++;else j++;if(++n>limit)return true;}}
   return n+x.length-i+y.length-j>limit;
 }
 function distance(a,b,limit=2){
   if(a===b)return 0;
   if(Math.abs(a.length-b.length)>limit||Math.max(a.length,b.length)>64||different(a,b,limit*2))return 3;
   const max=a.length+b.length,d=Array.from({length:a.length+2},()=>Array(b.length+2).fill(0)),seen=new Map();
   d[0][0]=max;
   for(let i=0;i<=a.length;i++){d[i+1][0]=max;d[i+1][1]=i;}
   for(let j=0;j<=b.length;j++){d[0][j+1]=max;d[1][j+1]=j;}
   for(let i=1;i<=a.length;i++){
     let last=0;
     for(let j=1;j<=b.length;j++){
       const row=seen.get(b[j-1])||0,col=last,cost=a[i-1]===b[j-1]?0:1;
       if(!cost)last=j;
       d[i+1][j+1]=Math.min(d[i][j]+cost,d[i+1][j]+1,d[i][j+1]+1,d[row][col]+i-row+j-col-1);
     }
     seen.set(a[i-1],i);
   }
   return d[a.length+1][b.length+1];
 }
 const threshold=(a,b)=>Math.min(a.length,b.length)<=3?0:Math.max(a.length,b.length)>=7?2:1,similar=(a,b)=>{
   if(a===b)return 1;
   const limit=threshold(a,b);
   return limit&&distance(a,b,limit)<=limit?0.7:0;
 };
 const ALIASES={
   stp:'stop',
   opn:'open',
   wats:'whats',
   tn:'tonight',
   tnt:'tonight',
   tonite:'tonight',
   tnite:'tonight',
   tmr:'tomorrow',
   tmrw:'tomorrow',
   tmw:'tomorrow',
   tomo:'tomorrow',
   manana:'tomorrow',
   sun:'sunday',
   mon:'monday',
   tue:'tuesday',
   tues:'tuesday',
   wed:'wednesday',
   weds:'wednesday',
   thu:'thursday',
   thur:'thursday',
   thurs:'thursday',
   fri:'friday',
   sat:'saturday',
   jan:'january',
   feb:'february',
   mar:'march',
   apr:'april',
   jun:'june',
   jul:'july',
   aug:'august',
   sep:'september',
   sept:'september',
   oct:'october',
   nov:'november',
   dec:'december'
 },
   KEYWORDS=[...DAYS,...MONTHS,'remind','reminder','remember','note','focus','study','work','stop','end','cancel','pause','resume','break','open','find','show','plan','due','what','whats','quiz','practice','checklist','reading','guide','rubric','treat','home','hide','settings','quiet','today','tonight','tomorrow','morning','afternoon','evening','noon','midnight'];
 const NUMBERS={
   zero:0,
   one:1,
   two:2,
   three:3,
   four:4,
   five:5,
   six:6,
   seven:7,
   eight:8,
   nine:9,
   ten:10,
   eleven:11,
   twelve:12,
   thirteen:13,
   fourteen:14,
   fifteen:15,
   sixteen:16,
   seventeen:17,
   eighteen:18,
   nineteen:19,
   twenty:20,
   thirty:30,
   forty:40,
   fifty:50,
   sixty:60,
   seventy:70,
   eighty:80,
   ninety:90,
   hundred:100,
   a:1,
   an:1
 },
   NUMBER_RE=/(?<![\w.])(?:for\s*)?(-?\d+(?:\.\d+)?)(?![\w.])/g,
   DURATION_RE=/(?<![\w.])(?:for\s*)?(-?\d+(?:\.\d+)?)\s*-?\s*(minutes?|mins?|m|hours?|hrs?|h)\b/g,
   canonicalCache=new Map(),
   calendars=new Map();
 KEYWORDS.push('studying','concentrate','timer','pomodoro','pomodoros','round','rounds','rest','ping','schedule','put','done','continue','hold','keep','going','add','more','extend','cut','less','subtract','remove','reduce','until','till','school','left');
 const EXACT=new Set([
   ...KEYWORDS,
   ...Object.keys(NUMBERS),
   'minute',
   'minutes',
   'min',
   'mins',
   'hour',
   'hours',
   'hr',
   'hrs',
   'half',
   'quarter',
   'past',
   'breaks',
   'please',
   'pls',
   'then',
   'with',
   'after',
   'before',
   'forget',
   'need',
   'want',
   'lets',
   'help',
   'long',
   'short',
   'quick',
   'session',
   'let',
   'give',
   'time',
   'unpause',
   'nudge',
   'dinner',
   'bus',
   'extra',
   'additional',
   'tack',
   'knock',
   'shorten',
   'rebuild'
 ]);
 function deletions(word){
   const out=new Set([word]);
   for(let i=0;i<word.length;i++){const once=word.slice(0,i)+word.slice(i+1);out.add(once);for(let j=i;j<once.length;j++)out.add(once.slice(0,j)+once.slice(j+1));}
   return out;
 }
 const keywordIndex=new Map(),maxKeyword=Math.max(...KEYWORDS.map(w=>w.length));
 for(let i=0;i<KEYWORDS.length;i++)for(const key of deletions(KEYWORDS[i])){if(!keywordIndex.has(key))keywordIndex.set(key,[]);keywordIndex.get(key).push(i);}
 function canonical(word){
   const w=word.toLowerCase();
   if(Object.hasOwn(ALIASES,w))return ALIASES[w];
   if(w.length<=3||w.length>maxKeyword+2||EXACT.has(w)||/^more(?:min(?:ute)?s?|m)$/.test(w))return w;
   if(canonicalCache.has(w))return canonicalCache.get(w);
   const choices=new Set();
   for(const key of deletions(w))for(const i of keywordIndex.get(key)||[])choices.add(i);
   let best=w,score=3,order=Infinity;
   for(const i of choices){
     const k=KEYWORDS[i],limit=threshold(w,k);
     if(!limit||Math.abs(w.length-k.length)>limit)continue;
     const n=distance(w,k,limit);
     if(n<=limit&&(n<score||n===score&&i<order)){best=k;score=n;order=i;}
   }
   if(canonicalCache.size>=512)canonicalCache.clear();
   canonicalCache.set(w,best);
   return best;
 }
 function normalize(input,convert=canonical){
   let text='',starts=[],ends=[],cursor=0;
   for(const m of input.matchAll(/[a-z]+/gi)){
     for(let i=cursor;i<m.index;i++){text+=input[i].toLowerCase().replace('’',"'");starts.push(i);ends.push(i+1);}
     const w=convert(m[0]);
     text+=w;
     for(let i=0;i<w.length;i++){starts.push(m.index);ends.push(m.index+m[0].length);}
     cursor=m.index+m[0].length;
   }
   for(let i=cursor;i<input.length;i++){text+=input[i].toLowerCase().replace('’',"'");starts.push(i);ends.push(i+1);}
   return {text,starts,ends};
 }
 function calendar(zone){
   const key=typeof zone==='string'&&zone?zone:ZONE;
   if(calendars.has(key))return calendars.get(key);
   let f;
   const options={year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'};
   try{f=new Intl.DateTimeFormat('en-US',{...options,timeZone:key});}catch{f=new Intl.DateTimeFormat('en-US',{...options,timeZone:ZONE});}
   const local=at=>{
     const p={};
     for(const v of f.formatToParts(at))p[v.type]=v.value;
     return {date:p.year+'-'+p.month+'-'+p.day,minute:Number(p.hour)*60+Number(p.minute),second:Number(p.second)};
   };
   if(calendars.size>=8)calendars.clear();
   calendars.set(key,local);
   return local;
 }
 function wall(day,minute,local,after=-Infinity){
   if(!validDay(day)||!Number.isInteger(minute)||minute<0||minute>=1440)return null;
   const base=Date.parse(day+'T00:00:00Z')+minute*MIN,offsets=new Set();
   for(const delta of [-2*DAY,-DAY,0,DAY,2*DAY]){const at=base+delta,p=local(at);offsets.add(Date.parse(p.date+'T00:00:00Z')+p.minute*MIN+p.second*1000-at);}
   const matches=[...offsets].map(o=>base-o).filter(at=>{const p=local(at);return at>after&&p.date===day&&p.minute===minute;}).sort((a,b)=>a-b);
   return matches[0]??null;
 }
 const span=m=>[m.index,m.index+m[0].length],dated=(m,date,endDate)=>({date,...(endDate?{endDate}:{}),spans:[span(m)],invalid:!date,explicit:true});
 function absolute(month,day,year,today){
   if(!today||month<1||month>12||day<1||day>31)return null;
   if(year)return dateOf(year,month,day);
   const start=Number(today.slice(0,4));
   for(let y=start;y<=start+8;y++){const d=dateOf(y,month,day);if(d&&d>=today)return d;}
   return null;
 }
 function monthDay(day,today){
   if(!today||day<1||day>31)return null;
   const y=Number(today.slice(0,4)),m=Number(today.slice(5,7));
   for(let n=0;n<14;n++){const d=dateOf(y+Math.floor((m-1+n)/12),(m-1+n)%12+1,day);if(d&&d>=today)return d;}
   return null;
 }
 function readDate(text,today){
   let m;
   if((m=/\bin\s*(\d+)\s*days?\b/.exec(text))){const n=Number(m[1]);return dated(m,today&&n<=36600?addDays(today,n):null);}
   if((m=/\b(next\s*week|this\s*weekend|(?:this|my)\s*week)\b/.exec(text))){
     if(!today)return dated(m,null);
     const d=(weekday(today)+6)%7,v=m[1].replace(/\s/g,'');
     if(v==='nextweek'){const date=addDays(today,7-d);return dated(m,date,addDays(date,6));}
     if(v==='thisweekend'){const date=addDays(today,Math.max(0,5-d));return dated(m,date,addDays(today,6-d));}
     return dated(m,today,addDays(today,6-d));
   }
   if((m=/\b(today|tonight|tomorrow)\b/.exec(text)))return dated(m,today?addDays(today,m[1]==='tomorrow'?1:0):null);
   if((m=new RegExp('\\b(?:(this|next)\\s+)?('+DAYS.join('|')+')\\b').exec(text))){
     const target=DAYS.indexOf(m[2]),delta=today?(target-weekday(today)+7)%7:0;
     return dated(m,today?addDays(today,m[1]==='this'?(target+6)%7-(weekday(today)+6)%7:delta||7):null);
   }
   if((m=/\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text)))return dated(m,dateOf(Number(m[1]),Number(m[2]),Number(m[3])));
   if((m=/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/.exec(text)))return dated(m,absolute(Number(m[1]),Number(m[2]),m[3]?Number(m[3])+(m[3].length===2?2000:0):0,today));
   if((m=new RegExp('\\b(?:the\\s*)?(\\d{1,2})(?:st|nd|rd|th)?\\s*('+MONTHS.join('|')+')(?:\\s*,?\\s*(\\d{4}))?\\b').exec(text)))
     return dated(m,absolute(MONTHS.indexOf(m[2])+1,Number(m[1]),Number(m[3]||0),today));
   if((m=new RegExp('\\b('+MONTHS.join('|')+')\\s*(?:the\\s*)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?\\b').exec(text)))
     return dated(m,absolute(MONTHS.indexOf(m[1])+1,Number(m[2]),Number(m[3]||0),today));
   if((m=/\b(?:the\s*)?(\d{1,2})(?:st|nd|rd|th)\b/.exec(text)))return dated(m,monthDay(Number(m[1]),today));
   return {spans:[],invalid:false,explicit:false};
 }
 function number(text){if(/^-?\d/.test(text))return Number(text);let total=0;for(const w of text.split(/[ -]+/))if(w==='hundred')total*=100;else total+=NUMBERS[w]??0;return total;}
 function durations(text,bare=false){
  const out=[],loose=[],add=(m,minutes)=>{const range=span(m);if(!out.some(v=>range[0]<v.spans[0][1]&&range[1]>v.spans[0][0]))out.push({minutes,spans:[range]});};
  for(const m of text.matchAll(/\b(?:(?:an?|one)\s+hour\s+and\s+(?:a\s+)?half|half\s+(?:an?\s+)?hour|(?:a\s+)?quarter\s+(?:of\s+an?\s+)?hour)\b/g))add(m,/and/.test(m[0])?90:/quarter/.test(m[0])?15:30);
  for(const m of text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:and\s*)?(\d{1,2})(?:\s*(?:minutes?|mins?|m))?\b/g))add(m,Number(m[1])*60+Number(m[2]));
  for(const m of text.matchAll(DURATION_RE))add(m,Number(m[1])*(/^h/.test(m[2])?60:1));
  const tokens=[...text.matchAll(/[a-z]+/g)];
  for(let i=0;i<tokens.length;i++){
    const first=tokens[i];
    if(!Object.hasOwn(NUMBERS,first[0]))continue;
    let j=i+1;
    while(j<tokens.length&&j<i+4&&Object.hasOwn(NUMBERS,tokens[j][0])&&/^[ -]+$/.test(text.slice(tokens[j-1].index+tokens[j-1][0].length,tokens[j].index)))j++;
    const end=tokens[j-1].index+tokens[j-1][0].length,amount=text.slice(first.index,end),next=tokens[j],minutes=number(amount);
    if(next&&/^(?:minutes?|mins?|m|hours?|hrs?|h)$/.test(next[0])&&/^[ -]*$/.test(text.slice(end,next.index))){
      const m=[text.slice(first.index,next.index+next[0].length)];
      m.index=first.index;
      add(m,minutes*(/^h/.test(next[0])?60:1));
    }
    else if(!/^(?:a|an)$/.test(amount))loose.push({minutes,spans:[[first.index,end]]});
    i=j-1;
  }
  if(!out.length&&bare){for(const m of text.matchAll(NUMBER_RE)){if(/\b(?:chapter|unit|page|problem|lesson|math|chem)\s*$/i.test(text.slice(0,m.index)))continue;add(m,Number(m[1]));}out.push(...loose);}
  return out.sort((a,b)=>a.spans[0][0]-b.spans[0][0]);
 }
 function readCycle(text){
   const numeric=/(-?\d+(?:\.\d+)?)\s*(?:pomodoros?|rounds?)\b/.exec(text);
   if(numeric)return numeric;
   const m=/\b(?:pomodoros?|rounds?)\b/.exec(text);
   if(!m)return null;
   const tokens=[...text.slice(0,m.index).matchAll(/[a-z]+/g)];
   let i=tokens.length-1,end=i>=0?tokens[i].index+tokens[i][0].length:0;
   if(i<0||!/^[ -]*$/.test(text.slice(end,m.index))||!Object.hasOwn(NUMBERS,tokens[i][0]))return null;
   let start=tokens[i].index;
   while(i>0&&Object.hasOwn(NUMBERS,tokens[i-1][0])&&/^[ -]+$/.test(text.slice(tokens[i-1].index+tokens[i-1][0].length,start))){i--;start=tokens[i].index;}
   const found=[text.slice(start,m.index+m[0].length),text.slice(start,end)];
   found.index=start;
   return found;
 }
 const validMinutes=n=>Number.isFinite(n)&&n>0&&n<=1440;
 function targetDurations(text,s){
   const explicit=durations(text);
   if(explicit.length)return explicit;
   const out=durations(text,true);
   if(!out.length)return out;
   const ranges=[],lists=[s.courses,s.workItems,s.assignments,s.planner];
   for(const list of lists)
     for(const raw of Array.isArray(list)?list:[]){
       const v=object(raw);
       for(const name of [v.name,v.title,v.shortName,v.course_code]){
         const tokens=words(name);
         if(!tokens.some(w=>/^\d+$/.test(w)))continue;
         for(const m of text.matchAll(new RegExp('\\b'+tokens.join('\\s+')+'\\b','g')))ranges.push(span(m));
       }
     }
   return out.filter(d=>!ranges.some(([a,b])=>d.spans[0][0]>=a&&d.spans[0][1]<=b));
 }
 function readClock(text){
  const spans=[];
  for(const m of text.matchAll(/\bin\s*/g)){
    const d=durations(text.slice(m.index+m[0].length))[0];
    if(d&&d.spans[0][0]===0)return {relative:d.minutes,spans:[[m.index,m.index+m[0].length+d.spans[0][1]]],invalid:d.minutes<=0||d.minutes>525600};
  }
  for(const d of durations(text)){
    const [a,b]=d.spans[0],tail=/^\s*(?:from\s+now\b|later\b|then\s+(?:remind|ping|nudge)\b)/.exec(text.slice(b));
    if(tail)return {relative:d.minutes,spans:[[a,b+tail[0].length-(tail[0].match(/(?:remind|ping|nudge)$/)?.[0].length||0)]],invalid:d.minutes<=0||d.minutes>525600};
  }
  const m=/\b(?:at|until|till|before|by)\s*(half\s+past\s+)?(\d{1,2})(?::(\d{1,2}))?\s*([ap]\.?m|(?<=\d)[ap])?\b\.?|\b(\d{1,2})(?::(\d{1,2}))?\s*([ap]\.?m|(?<=\d)[ap])\b\.?|\b(\d{1,2}):(\d{1,2})\b/.exec(text);
  let minute,ambiguous=false,invalid=false;
  if(m){
    spans.push(span(m));
    let h=Number(m[2]??m[5]??m[8]),n=Number(m[3]??m[6]??m[9]??(m[1]?30:0));
    const suffix=m[4]??m[7],digits=m[3]??m[6]??m[9];
    invalid=n>59||digits!==undefined&&digits.length!==2||!!suffix&&(h<1||h>12)||!suffix&&h>23;
    ambiguous=!suffix&&h>=1&&h<=12&&!/^0\d/.test(m[2]??m[5]??m[8]);
    if(suffix)h=h%12+(suffix[0]==='p'?12:0);
    minute=h*60+n;
  }
  const slots={noon:720,midnight:0,morning:450,afternoon:900,evening:1140,tonight:1200,'after school':930};
  for(const word of text.matchAll(/\b(noon|midnight|morning|afternoon|evening|tonight|after school)\b/g)){
    spans.push(span(word));
    if(minute===undefined)minute=slots[word[1]];else if(ambiguous){minute=minute%720+(slots[word[1]]>=720?720:0);ambiguous=false;}
  }
  return {minute,ambiguous,spans,invalid};
 }
 function temporal(text,s){
   const now=stamp(s.now),
     local=calendar(s.timeZone),
     today=now===null?null:local(now).date,
     date=readDate(text,today),
     clock=readClock(without(text,date.spans.filter(([a,b])=>text.slice(a,b)!=='tonight')));
   return {
     ...date,
     ...clock,
     date:date.date,
     endDate:date.endDate,
     explicit:date.explicit,
     spans:[...date.spans,...clock.spans],
     invalid:date.invalid||clock.invalid,
     now,
     local,
     today
   };
 }
 function nextClock(t){
   let date=t.date||t.today,minute=t.minute??540;
   if(t.ambiguous){
     if(t.explicit&&date!==t.today)
       minute=minute<480?minute+720:minute;
     else{
       const choices=[minute%720,minute%720+720].sort((a,b)=>a-b);
       for(const offset of t.explicit?[0]:[0,1])
         for(const choice of choices){const day=addDays(date,offset),at=wall(day,choice,t.local,t.now);if(at!==null)return {at,date:day,minute:choice};}
     }
   }
   let at=wall(date,minute,t.local,t.now);
   if(at===null&&!t.explicit&&wall(date,minute,t.local)!==null){date=addDays(date,1);at=wall(date,minute,t.local,t.now);}
   return {at,date,minute};
 }
 function without(text,spans){
   const mask=new Uint8Array(text.length);
   for(const [a,b] of spans)for(let i=Math.max(0,a);i<Math.min(b,text.length);i++)mask[i]=1;
   let out='';
   for(let i=0;i<text.length;i++)out+=mask[i]?' ':text[i];
   return out;
 }
 const REMIND=/\b(?:remind(?:er)?|remember|note|ping|nudge)\b\s*(?:(?:me|please|pls)\b\s*)*(?:to\b\s*)?|\b(?:don't|do\s+not)\s+let\s+me\s+forget\b\s*/g;
 function titleOf(input,n,t,commands=REMIND){
   const ranges=[...t.spans];
   for(const m of n.text.matchAll(commands)){ranges.push(span(m));if(commands===REMIND)break;}
   const original=ranges.map(([a,b])=>{const p=n.text.slice(0,a).match(/\b(?:on|at|by|for|until|till)\s*$/);if(p)a=p.index;return [n.starts[a]??input.length,n.ends[b-1]??input.length];});
   const polite=/^please\s+/i.exec(input);
   if(polite)original.push(span(polite));
   return clean(without(input,original)).replace(/^[\s:;,.-]*(?:(?:to|on|at)\b\s*)?/i,'').replace(/[\s:;,.-]+$/,'').trim();
 }
 function duration(text,fallback){const minutes=durations(text,true)[0]?.minutes??fallback;return validMinutes(minutes)?minutes:null;}
 const COURSE_WORDS={calc:'calculus',chem:'chemistry',bio:'biology',lit:'literature',eng:'english',hist:'history',span:'spanish',phys:'physics',econ:'economics',psych:'psychology'},
   STOP=new Set(['a','an','the','my','on','for','to','please','start','me','with','of','at','more','minute','minutes','min','mins','m','h','hr','hrs','hour','hours','one']);
 function coursesOf(s){
   return (Array.isArray(s.courses)?s.courses:[]).map(object).filter(c=>id(c.id)).map(c=>{
     const name=clean(c.name)||clean(c.shortName)||clean(c.course_code)||id(c.id),
       tokens=words([name,c.shortName,c.course_code].filter(x=>typeof x==='string').join(' ')),
       aliases=Object.entries(COURSE_WORDS).filter(([,full])=>tokens.includes(full)).map(([alias])=>alias);
     return {id:id(c.id),name,tokens:[...new Set([...tokens,...aliases])],phrase:words(name).join(' ')};
   });
 }
 function rowsOf(s,courses,includeCompleted=false){
   const rows=new Map(),lists=Array.isArray(s.workItems)?[s.workItems]:[s.assignments,s.planner];
   for(const list of lists)
     for(const raw of Array.isArray(list)?list:[]){const v=object(raw),key=id(v.id);if(!key)continue;const row={...rows.get(key),...v,id:key};rows.set(key,row);}
   return [...rows.values()].filter(v=>includeCompleted||v.done!==true&&v.completed!==true).map(v=>{
     const course=typeof v.course==='string'?v.course:clean(object(v.course).name),
       courseId=id(v.courseId)||id(object(v.course).id)||courses.find(c=>c.phrase===words(course).join(' '))?.id||'',
       c=courses.find(c=>c.id===courseId),
       title=clean(v.title)||clean(v.name)||'Untitled item';
     return {
       ...v,
       courseId,
       title,
       titleWords:words(title),
       courseWords:c?.tokens||words(course).flatMap(w=>[w,...Object.entries(COURSE_WORDS).filter(([,full])=>full===w).map(([alias])=>alias)])
     };
   });
 }
 const overlap=(query,target)=>query.reduce((sum,w)=>sum+Math.max(0,...target.map(t=>similar(w,t))),0),
   byScore=(a,b)=>b.score-a.score||String(a.fields.itemId??a.fields.courseId??'').localeCompare(String(b.fields.itemId??b.fields.courseId??''));
 function entities(query,s,action){
   const courses=coursesOf(s),rows=rowsOf(s,courses,action==='fix'),q=[...new Set(words(query).filter(w=>!STOP.has(w)))];
   if(!q.length)return [{fields:{},label:'',score:0}];
   const matches=[];
   for(const c of courses){const n=overlap(q,c.tokens);if(n)matches.push({fields:{courseId:c.id},label:c.name,score:100*n/q.length+(q.join(' ')===c.phrase?10:0)});}
   for(const v of rows){
     const title=overlap(q,v.titleWords),course=overlap(q,v.courseWords),known=courses.some(c=>c.id===v.courseId);
     if(title||course&&!known)
       matches.push({fields:{...(v.courseId?{courseId:v.courseId}:{}),itemId:v.id},label:v.title,score:200*(title+course)/q.length+(q.join(' ')===v.titleWords.join(' ')?20:0)});
   }
   matches.sort(byScore);
   if(action)
     for(const c of matches){
       if(c.fields.itemId||!c.fields.courseId)continue;
       const fits=rows.filter(v=>
         v.courseId===c.fields.courseId&&
           ({
             lab:/\blab\b/i.test(v.kind+' '+v.title),
             reading:/\b(?:reading|chapter|pages|article)\b/i.test(v.kind+' '+v.title),
             quiz:/\b(?:quiz|test|exam)\b/i.test(v.kind+' '+v.title),
             rubric:/\b(?:essay|project|report|presentation)\b/i.test(v.kind+' '+v.title),
             fix:v.done===true||v.completed===true||stamp(v.gradedAt)!==null||/\bfix\b/i.test(v.kind)
           }[action]));
       if(fits.length){
         const row=fits.sort((a,b)=>
           (action==='fix'?(stamp(b.gradedAt)??-Infinity)-(stamp(a.gradedAt)??-Infinity):0)||
             (stamp(a.dueAt??a.due)??Infinity)-(stamp(b.dueAt??b.due)??Infinity)||
             a.id.localeCompare(b.id))[0];
         c.fields={...c.fields,itemId:row.id};
         c.label=row.title;
       }
     }
   return matches.length?matches.slice(0,3):[{fields:{},label:'',score:0}];
 }
 const dateLabel=day=>{
   const d=new Date(day+'T12:00:00Z');
   return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]+' '+d.getUTCDate()+' '+SHORT_MONTHS[d.getUTCMonth()];
 },
 timeLabel=minute=>(Math.floor(minute/60)%12||12)+':'+pad(minute%60)+' '+(minute>=720?'PM':'AM'),
 candidate=(intent,fields,preview)=>({intent,fields,preview:short(clean(preview))}),
 ai=()=>[],
 rangeFields=t=>({...t.date?{date:t.date}:{},...t.endDate?{endDate:t.endDate}:{}}),
 rangeLabel=t=>t.date?' · '+dateLabel(t.date)+(t.endDate?' – '+dateLabel(t.endDate):''):'';
 function reminder(input,n,t,explicit){
   if(t.invalid||t.now===null)return [];
   const title=titleOf(input,n,t);
   if(!title)return [];
   let at,date=t.date,minute=t.minute;
   if(t.relative!==undefined){at=t.now+t.relative*MIN;const p=t.local(at);date=p.date;minute=p.minute;}
   else{if(!date&&minute===undefined&&!explicit)return [];({at,date,minute}=nextClock(t));if(at===null)return [];}
   return [candidate('reminder',{title,date,time:pad(Math.floor(minute/60))+':'+pad(minute%60),at},'Reminder · '+dateLabel(date)+' · '+timeLabel(minute)+' · '+title)];
 }
 function queryOf(text,prefix,t){return clean(without(text,[...t.spans,...durations(text).flatMap(d=>d.spans)]).replace(prefix,''));}
 function adjust(text){
   text=text.replace(/\b(add|subtract|remove|reduce)(?=\d)/g,'$1 ');
   text=text.replace(/(\d)\s*more\s*(min(?:ute)?s?|m)\b/g,'$1 more $2');
   const signed=/^(?:focus\s*)?([+-])\s*(\d+(?:\.\d+)?)(?:\s*(minutes?|mins?|m|hours?|hrs?|h))?\s*$/.exec(text);
   if(signed){const minutes=Number(signed[2])*(/^h/.test(signed[3]||'')?60:1);return validMinutes(minutes)?minutes*(signed[1]==='-'?-1:1):0;}
   const verb=/\b(add|subtract|remove|reduce|extend|cut|less|more)\b|\b(add|subtract|remove|reduce)(?=\d)/.exec(text);
   if(!verb)return null;
   const amounts=durations(text.replace(/(\d)\s*more\s*(min(?:ute)?s?|m)\b/g,'$1 $2'),true),minutes=amounts[0]?.minutes;
   if(minutes===undefined)return null;
   return validMinutes(minutes)?minutes*(/^(?:subtract|remove|reduce|cut|less)$/.test(verb[1]||verb[2])?-1:1):0;
 }
 const FOCUS=/\b(?:focus|study|studying|work|concentrate|timer|pomodoros?|rounds?)\b/,FOCUS_WORDS=/\b(?:focus|study|studying|deep\s+work|work|concentrate|timer|session|pomodoros?|rounds?|of|on|for|please|pls|quick|start|set|a|an|lets|let's|i\s+(?:need|want)\s+to|help\s+me|then|with)\b/g,PLAN_WORDS=/\b(?:plan|schedule|put|of|on|for|please)\b/g;
 function focus(input,n,s,t){
   const text=n.text,
     cycle=/\bx\s*(\d+)\b/.exec(text)||readCycle(text),
     cycles=cycle?number(cycle[1]):1,
     breakWord=/\b(?:break|rest)\b/.exec(text),
     breakStart=breakWord?text.slice(0,breakWord.index).search(/\b(?:then|with)\b/):-1,
     breakText=breakWord?(breakStart>=0?text.slice(breakStart):text.slice(text.lastIndexOf(' ',breakWord.index-1)+1)):'';
   let breakMinutes=breakWord?duration(breakText,5):/\bpomodoros?\b/.test(text)||cycles>1?5:0;
   const ranges=[...t.spans,...(cycle?[span(cycle)]:[]),...(breakStart>=0?[[breakStart,text.length]]:[])],
     body=without(text,ranges),
     amounts=targetDurations(body,s),
     minutes=amounts[0]?.minutes??25;
   if(!Number.isInteger(cycles)||cycles<1||cycles>100||breakMinutes===null)return [];
   let length=minutes;
   if(/\b(?:until|till)\b/.test(text)){if(t.invalid||t.now===null||t.minute===undefined)return [];const end=nextClock(t);if(end.at===null)return [];length=(end.at-t.now)/MIN;}
   if(!validMinutes(length))return [];
   const spans=[...ranges,...amounts.flatMap(d=>d.spans)],query=without(text,spans).replace(FOCUS_WORDS,''),title=titleOf(input,n,{spans},FOCUS_WORDS);
   return entities(query,s).map(e=>
     candidate(
       'focus',
       {minutes:length,cycles,breakMinutes,...e.fields,...(title?{title}:{})},
       'Focus'+(e.label?' · '+e.label:'')+' · '+(cycles>1?cycles+' × ':'')+length+' min'+(breakMinutes?' · '+breakMinutes+' min break':'')));
 }
 const names=entries=>new Map(entries.flatMap(([key,aliases])=>aliases.split('|').map(name=>[name,key]))),bare=text=>text.trim().replace(/^(?:(?:the|my|a|an)\s+)+/,'').trim();
 const FEATURE_NAMES=names([
  ['dashboard','dashboard|dashboard and assignments'],
  ['planner','planner|home widgets|planner and home widgets'],
  ['grades','grades'],
  ['materials','materials|materials library'],
  ['course-hub','course-hub|course hub|course hub and inbox'],
  ['course-files','course-files|my links and files|my links & files'],
  ['math','math|math tools'],
  ['gpa','gpa|gpa calculator'],
  ['tools','tools|study tools|quick open|quick open and study tools'],
  ['customization','customization|appearance editor'],
  ['scene-themes','scene-themes|scene themes'],
  ['arrange','arrange|workspace arrangement|arrange the workspace'],
  ['course-art','course-art|course art|course artwork'],
  ['quick-pack','quick-pack|quick upload|local artwork packs|artwork packs|artwork packs and quick upload'],
  ['pony','pony|biscuit|pet|pony companion|companion'],
  ['biscuit-more-rules','biscuit-more-rules|biscuit more rules|more rules'],
  ['motion','motion|animations|living drawings|living drawings and motion'],
  ['canvas-nav','canvas-nav|canvas navigation|drawn canvas navigation'],
  ['course-nav','course-nav|course menu|course navigation|drawn course menu|drawn course menu and modules'],
  ['native-appearance','native-appearance|native appearance|native page appearance'],
  ['pdf','pdf|pdf reader'],
  ['play','play|play tools|celebrations|submission celebrations|play and submission celebrations'],
  ['focus-room','focus-room|focus room'],
  ['review-deck','review-deck|review deck'],
  ['grade-impact','grade-impact|grade impact'],
  ['deadline-changes','deadline-changes|deadline changes|due date changes|changed deadlines']
 ]);
 const SKILL_NAMES=names([
  ['deadline','deadline|deadline watch|deadline reminders'],['focus','focus buddy|focus help'],['planner','planner help|planner helper'],['quiz','quiz prep|quiz preparation'],['wellbeing','wellbeing|well-being|well being|wellness|stretch reminders'],['labprep','labprep|lab prep|lab preparation'],['reading','reading helper|reading help'],['rubric','rubric helper|rubric help'],['feedback','feedback helper|feedback help'],['inbox','inbox watch'],['reminders','reminders|reminder skill'],['night','night|night owl|night owl guard']
 ]);
 const MODULE_NAMES=names([
  ['context','context|course information|course info'],['work','work|up next|upcoming work|assignment list'],['reader','reader|assignment details'],['today','today'],['handin','handin|to hand in|hand in'],['week','week|this week|planner'],['timer','timer|focus timer'],['clock','clock'],['notes','notes|note|quick notes'],['bookmarks','bookmarks|saved items'],['grades','grades|recent grades'],['messages','messages|inbox'],['pet','pet|paddock|pony|biscuit']
 ]),
 MODULE_LABELS={
   context:'Course information',
   work:'Up next',
   reader:'Assignment details',
   help:'Help',
   handin:'To hand in',
   week:'Planner',
   timer:'Focus timer',
   clock:'Clock',
   notes:'Notes',
   bookmarks:'Bookmarks',
   grades:'Grades',
   messages:'Messages',
   pet:'Paddock'
 };
 const TAB_NAMES=names([['home','home|dashboard'],['planner','planner|plan'],['messages','messages|inbox'],['assignments','assignments|assignment list'],['course-hub','course-hub|course hub|hub'],['materials','materials|materials library'],['grades','grades']]);
 const PLAY_NAMES=names([
   ['hammer','hammer|hammer time'],
   ['laser','laser'],
   ['bomb','bomb'],
   ['railgun','railgun|rail gun'],
   ['blackhole','blackhole|black hole'],
   ['foil','foil'],
   ['painter','painter|paint|painting'],
   ['garden','garden'],
   ['balloon','balloon|balloons'],
   ['gravity','gravity'],
   ['portal','portal|portals'],
   ['eraser','eraser|erase'],
   ['magnet','magnet'],
   ['ink','ink']
 ]);
 const SETTING_ENUMS={
   theme:['dark','light'],
   sceneTheme:['','starry','sea','stars','blueprint'],
   pageTint:['paper','accent','sky','sage','lilac','blush','sand','snow'],
   courseNavigation:['sidebar','topbar','dock'],
   dockSize:['small','medium','large'],
   dockShelf:['kraft','paper','none'],
   dockStyle:['tiles','cards'],
   deskOrder:['context-first','work-first','stacked'],
   surfaceStyle:['paper','clean','contrast'],
   courseCardStyle:['sketch','rounded','minimal'],
   bannerSize:['compact','standard','large'],
   panelFrame:['pen','stitch','card','line','none'],
   density:['comfortable','compact']
 };
 const VISIBILITY_NAMES=names([['showGrades','grades'],['showBookmarks','bookmarks'],['showCourseIcons','course icons'],['showDeadlinePreview','deadline preview|deadline previews'],['showCourseInformation','course information|course info'],['showCourseStrip','course strip|courses'],['showRecentGrades','recent grades']]),
   BOOLEAN_KEYS=new Set([...VISIBILITY_NAMES.values(),'biscuitOffers','dockNamesAlways','dockCounts','dockLively','dockHide']);
 const SETTING_NAMES=names([...Object.keys(SETTING_ENUMS),...BOOLEAN_KEYS,'nightArt'].map(key=>[key,key.toLowerCase()+'|'+key.replace(/[A-Z]/g,w=>' '+w.toLowerCase()).toLowerCase()])),
   SETTING_RE=new RegExp('^('+[...SETTING_NAMES.keys()].sort((a,b)=>b.length-a.length).join('|')+')(?:\\s+(?:to\\s+)?|\\s*[:=]\\s*)(.+)$');
 const setting=(key,value,label)=>[candidate('setting',{key,value},label||key+' · '+String(value))];
 const SIZE_NAMES=names([['small','tiny|mini|little|small|smaller|smallest|compact'],['medium','medium|normal|regular|standard|default'],['large','large|larger|largest|big|bigger|biggest|huge']]),
   SIZE_WORDS=[...SIZE_NAMES.keys()].join('|'),
   SIZE_AMOUNT='(?:(?:a\\s+)?(?:bit|little)\\s+|(?:much|slightly|even)\\s+)?('+SIZE_WORDS+')(?:\\s+size)?',
   SIZE_RE=new RegExp('^'+SIZE_AMOUNT+'\\s+(?:course\\s+)?(dock|banner)$|^(?:course\\s+)?(dock|banner)(?:\\s+size)?\\s+(?:(?:to|as|be)\\s+)?'+SIZE_AMOUNT+'$');
 const HOME_AT=/\s+(?:on|from|to)\s+(?:(?:the|my)\s+)?(?:home(?:\s+(?:page|screen|dashboard))?|homepage|dashboard)$/,
   MODULE_QUALIFIER=/\b(?:module|widget|panel)\b/,
   moduleName=text=>bare(bare(text.replace(HOME_AT,'')).replace(/^(?:home\s+)?(?:module|widget|panel)\s+(?:for\s+)?|\s+(?:module|widget|panel)$/g,'').replace(/^home\s+/,'')),
   tabName=text=>bare(bare(text).replace(/\s+(?:page|screen|tab|view)$/,''));
 const APPEARANCE_NAMES=names([['sceneTheme','scene'],['dockSize','course dock|dock'],['bannerSize','course banner|banner'],['surfaceStyle','surface|look|style'],['pageTint','page tint|background|page|tint'],['courseCardStyle','course cards|course card|cards|card'],['panelFrame','panel frames|panel frame|frames|frame'],['density','density|spacing'],['deskOrder','desk|desk layout']]);
 const KEY_WORDS=[
   ...new Set([
     ...FEATURE_NAMES.keys(),
     ...SKILL_NAMES.keys(),
     ...MODULE_NAMES.keys(),
     ...TAB_NAMES.keys(),
     ...PLAY_NAMES.keys(),
     ...SETTING_NAMES.keys(),
     ...APPEARANCE_NAMES.keys(),
     ...Object.values(SETTING_ENUMS).flat(),
     ...SIZE_NAMES.keys(),
     ...'dark light mode theme scene starfield starry night under sea match computer courses navigation menu bar strip along bottom across top side left bigger smaller large small compact banner clean look high contrast background page screen tab view homepage rounded minimal stitched frames turn switch enable disable stop start show hide move put bring first position spot make wide wider widen width full go navigate open bookmark save later undo revert previous last change action edit take roll send back help quiet until write down add note self plant garden let paint reset restore layout preset study focus studio full lite everything on off use apply set clear remove no module widget panel to as be it the my a an me of for is bit little much slightly even'.split(' ')
   ].flatMap(value=>
     value.match(/[a-z]+/g)||[]))
 ],
   KEY_EXACT=new Set([...KEY_WORDS,...EXACT]),
   KEY_INDEX=new Map(),
   keyCache=new Map();
 for(const word of KEY_WORDS){EXACT.add(word);for(const part of deletions(word)){if(!KEY_INDEX.has(part))KEY_INDEX.set(part,[]);KEY_INDEX.get(part).push(word);}}
 function keyWord(word){
   if(word.length<=3||word.length>24||KEY_EXACT.has(word))return word;
   if(keyCache.has(word))return keyCache.get(word);
   const options=new Set();
   for(const part of deletions(word))for(const value of KEY_INDEX.get(part)||[])options.add(value);
   let result=word,best=3;
   for(const value of options){const limit=threshold(word,value),score=distance(word,value,limit);if(limit&&score<=limit&&score<best){result=value;best=score;}}
   if(keyCache.size>=512)keyCache.clear();
   keyCache.set(word,result);
   return result;
 }
 function tolerantKey(value,s){
   let count=0,limit=8;
   const leading=keyWord(value.match(/^[a-z]+/i)?.[0].toLowerCase()||'');
   if(leading==='note')limit=1;else if(leading==='write')limit=2;else if(leading==='add')limit=3;
   const fixed=value.replace(/[a-z]+/gi,word=>++count<=limit?keyWord(word.toLowerCase()):word);
   return fixed.toLowerCase()===value.toLowerCase()?null:keyCommand(fixed,s);
 }
 function noteCommand(input,loose=false){
  let count=0;
  const n=normalize(input,word=>++count<=3?keyWord(word.toLowerCase()):word.toLowerCase()),
    m=/^(?:(?:before\s+i\s+forget\s*[,;:]\s*|(?:apunta|anota)\s+(?:esto\s+)?))?(?:note\s*:\s*|note\s+to\s+self\b[\s:,-]*|write\s+down\b[\s:]*|(?:jot|write)\s+(?:this|that|it)\s+(?:down|in(?:to)?\s+(?:(?:the|my)\s+)?notes)\b[\s:]*|(?:jot|write)\s+(?:(?:a|the|my)\s+)?note\b[\s:]*|(?:add|make|save|create)\s+(?:(?:a|an|the|my)\s+)?note\b\s*(?:(?:titled|called)\b\s*)?[\s:]*|(?:save|put|keep|add)\s+(?:this|that|the)\s+(?:sentence|text|thought|observation)\s+in(?:to)?\s+(?:(?:the|my)\s+)?notes\b\s*(?:verbatim\b\s*)?[\s:]*)/.exec(n.text),
    plain=loose&&!m?/^(?:(?:apunta|anota)\s+(?:esto\s+)?)?note\b[\s:]+/.exec(n.text):null,
    found=m||plain;
  if(!found||!/:/.test(found[0])&&/^(?:module|widget|panel)\b/.test(n.text.slice(found[0].length)))return null;
  const content=input.slice(n.ends[found[0].length-1]??input.length).trim();
  return content?[candidate('note',{text:content},'Note · '+content)]:[];
 }
 function settingValue(key,raw){
   const value=bare(raw);
   if(key==='dockSize'||key==='bannerSize'){
     const size=SIZE_NAMES.get(value.replace(/^(?:(?:a\s+)?(?:bit|little)|much|slightly|even)\s+/,'').replace(/\s+size$/,''));
     return size?(key==='bannerSize'?{small:'compact',medium:'standard',large:'large'}[size]:size):value;
   }
   if(key==='sceneTheme'){
     const scene=bare(value.replace(/\s+(?:scene(?:\s+theme)?|theme)$/,''));
     return /^(?:none|no|off|default)$/.test(scene)?'':/^(?:under\s+(?:the\s+)?)?sea$/.test(scene)?'sea':/^(?:starfield|stars)$/.test(scene)?'stars':/^starry(?:\s+night)?$/.test(scene)?'starry':scene;
   }
   if(key==='courseNavigation')return {bottom:'dock',top:'topbar',side:'sidebar',left:'sidebar','top bar':'topbar','side bar':'sidebar'}[value]||value;
   if(key==='panelFrame')return {stitched:'stitch',no:'none'}[value]||value;
   if(key==='courseCardStyle'&&value==='sketched')return 'sketch';
   if(key==='surfaceStyle'&&value==='high contrast')return 'contrast';
   if(key==='deskOrder')return value.replace(' ','-');
   return value;
 }
 function appearance(text){
  let m=SETTING_RE.exec(bare(text.replace(/^(?:set|change|make)\s+/,'')));
  if(m){
    const key=SETTING_NAMES.get(m[1]),value=settingValue(key,m[2].trim());
    if(BOOLEAN_KEYS.has(key))return /^(?:true|on|yes|visible|false|off|no|hidden)$/.test(value)?setting(key,/^(?:true|on|yes|visible)$/.test(value)):[];
    if(key==='nightArt'){
      const amount=/^\d+(?:\.\d+)?%?$/.test(value)?Number(value.replace('%','')):NaN;
      return Number.isFinite(amount)&&amount>=0&&amount<=100?setting(key,Math.round(amount),'Night art · '+Math.round(amount)+'%'):[];
    }
    return SETTING_ENUMS[key].includes(value)?setting(key,value):[];
  }
  const style=bare(text.replace(/^(?:(?:switch|change)\s+(?:to\s+)?|(?:use|apply|set|make|move|put|bring)\s+|turn\s+on\s+)/,'').replace(/^it\s+/,''));
  if((m=/^(dark|light)(?:\s+(?:mode|theme))?$/.exec(style)))return setting('theme',m[1],m[1]==='dark'?'Dark mode':'Light mode');
  if(/^(?:system(?:\s+(?:mode|theme))?|match\s+(?:(?:my|the)\s+)?(?:computer|system|device))$/.test(style))return setting('theme','system');
  if(/^(?:no\s+scene(?:\s+theme)?|(?:remove|clear)\s+(?:the\s+)?scene(?:\s+theme)?)$/.test(style))return setting('sceneTheme','','No scene theme');
  if((m=/^(starfield|stars|starry(?:\s+night)?|(?:under\s+(?:the\s+)?)?sea|blueprint)(?:\s+(?:scene(?:\s+theme)?|theme))?$/.exec(style)))return setting('sceneTheme',settingValue('sceneTheme',m[1]),'Scene · '+m[1]);
  if((m=/^(?:courses?|course\s+(?:navigation|menu|bar|strip|dock))\s+(?:(?:along|across|on|at|to)\s+)?(?:the\s+)?(bottom|top|side|left)(?:\s+of\s+(?:the\s+)?(?:page|screen))?$/.exec(style)))return setting('courseNavigation',settingValue('courseNavigation',m[1]),'Courses · '+m[1]);
  if((m=/^(?:course\s+)?(dock|topbar|top bar|sidebar|side bar)$/.exec(style)))return setting('courseNavigation',m[1].replace(/ /g,''),'Courses · '+m[1]);
  if((m=SIZE_RE.exec(style))){const key=(m[2]||m[3])+'Size',value=settingValue(key,m[1]||m[4]);return setting(key,value,(key==='dockSize'?'Dock':'Banner')+' · '+value);}
  if((m=/^(paper|clean|(?:high\s+)?contrast)(?:\s+(?:look|style|surface))?$/.exec(style)))return setting('surfaceStyle',m[1].endsWith('contrast')?'contrast':m[1],'Surface · '+m[1]);
  if((m=/^(paper|accent|sky|sage|lilac|blush|sand|snow)\s+(?:background|page|page tint|tint)$|^(?:background|page tint|tint)\s+(paper|accent|sky|sage|lilac|blush|sand|snow)$/.exec(style)))return setting('pageTint',m[1]||m[2],'Background · '+(m[1]||m[2]));
  if((m=/^(sketch|sketched|rounded|minimal)\s+(?:course\s+)?cards?$/.exec(style)))return setting('courseCardStyle',m[1]==='sketched'?'sketch':m[1],'Course cards · '+m[1]);
  if((m=/^(pen|stitched|stitch|card|line|none|no)\s+frames?$/.exec(style)))return setting('panelFrame',m[1]==='stitched'?'stitch':m[1]==='no'?'none':m[1],'Frames · '+m[1]);
  if((m=/^(context[ -]first|work[ -]first|stacked)(?:\s+(?:layout|desk))?$/.exec(style)))return setting('deskOrder',m[1].replace(' ','-'),'Desk · '+m[1]);
  if((m=/^(compact|comfortable)(?:\s+(?:density|spacing))$/.exec(style)))return setting('density',m[1],'Spacing · '+m[1]);
  for(const [name,key] of APPEARANCE_NAMES){
    const raw=style.startsWith(name+' ')?style.slice(name.length+1).replace(/^(?:to|as|be)\s+/,''):style.endsWith(' '+name)?style.slice(0,-name.length-1):null;
    if(raw!==null){const value=settingValue(key,raw);if(SETTING_ENUMS[key].includes(value))return setting(key,value);}
  }
  return null;
 }
 function keyCommand(input,s){
  const original=input.replace(/^please\s+/i,''),
    raw=original.toLowerCase().replace(/[.!?]+$/,'').trim(),
    head=/^[a-z]+/.exec(raw),
    verb=head?canonical(head[0]):'',
    text=head&&/^(?:open|find|show|hide|put|quiet|stop|help|focus|study|add|remove)$/.test(verb)?verb+raw.slice(head[0].length):raw;
  let m;
  const note=noteCommand(original);if(note!==null)return note;
  if(/^(?:undo|revert)(?:\s+(?:that|it|(?:(?:that|the|my)\s+)?(?:last|previous)(?:\s+(?:change|action|edit|setting))?))?$|^(?:take|roll)\s+(?:that|it)\s+back$/.test(text))return [candidate('undo',{},'Undo last change')];
  if(text==='home'||
    text==='sendhome'||
    (m=/^(?:send|take|bring|put)\s+(.+?)\s+(?:back\s+)?home$|^(?:send|take|bring|put)\s+(?:back\s+)?home(?:\s+(.+))?$/.exec(text))&&(!(m[1]||m[2])||FEATURE_NAMES.get(bare(m[1]||m[2]))==='pony'))
    return [candidate('pet',{action:'home'},'Send home')];
  if(/^(?:help|what\s+can\s+you\s+do|show\s+(?:me\s+)?(?:your\s+)?commands)$/.test(text))return [candidate('help',{},'What '+companionName(s)+' can do')];
  // Today is retired from Home; its lines, and lines that name Help as a place, open the Help band.
  if(/^(?:be\s+)?quiet\s+(?:for|until|till)\b/.test(text)){
    let minutes;
    if(/\b(?:until|till)\b/.test(text)){
      const t=temporal(normalize(text).text,s);
      if(t.invalid||t.now===null||t.minute===undefined)return [];
      const end=nextClock(t);
      minutes=end.at===null?null:(end.at-t.now)/MIN;
    }
    else minutes=duration(text,null);
    return validMinutes(minutes)?[candidate('quiet',{minutes},'Quiet · '+minutes+' min')]:[];
  }
  if(text==='be quiet')return [candidate('pet',{action:'quiet'},'Quiet mode')];
  if((m=/^bookmark\b[\s:]+(.+)$|^save\s+(.+?)\s+for\s+later$/.exec(text))){
    const query=m[1]||m[2];
    return entities(query,s).filter(e=>e.fields.itemId).map(e=>candidate('bookmark',e.fields,'Bookmark · '+e.label));
  }
  const style=bare(text.replace(/^(?:(?:switch|change)\s+to\s+|(?:use|apply)\s+)/,''));
  if((m=/^(studio|study|focus)\s+(?:layout|preset|workspace)$|^(?:layout|preset)\s+(studio|study|focus)$/.exec(style))||/^(?:reset|restore)\s+(?:(?:the|my)\s+)?(?:layout|appearance)$/.test(text))
    return [candidate('preset',{preset:m?.[1]||m?.[2]||'studio'},'Layout · '+(m?.[1]||m?.[2]||'studio'))];
  if((m=/^(full|lite)(?:\s+(?:mode|features|version|preset))?$/.exec(style))||/^(?:turn\s+(?:everything|all\s+features)\s+on|enable\s+(?:everything|all\s+features)|all\s+features\s+on)$/.test(text))
    return [candidate('features',{preset:m?.[1]||'full'},'Features · '+(m?.[1]||'full'))];
  const look=/\b(?:module|widget)\b|\bpanel\b(?!\s+frames?\b)/.test(text)?null:appearance(text);if(look!==null)return look;
  const moduleText=text.replace(HOME_AT,'');
  if((m=/^(?:put|move|bring|make)\s+(.+?)\s+(?:(?:to|on)\s+)?(?:the\s+)?(?:top|first)(?:\s+(?:position|spot))?$|^(.+?)\s+(?:on\s+(?:the\s+)?top|first)$/.exec(moduleText))){
    const key=MODULE_NAMES.get(moduleName(m[1]||m[2]));
    if(key)return [candidate('module',{action:'top',key},'Move to top · '+MODULE_LABELS[key])];
  }
  if((m=/^(?:(?:make|set)\s+)?(.+?)\s+(?:(?:to|be)\s+)?(?:wide|wider|full[ -]width)$|^(?:widen\s+|(?:(?:make|set)\s+)?(?:wide|wider|full[ -]width)\s+)(.+)$/.exec(moduleText))){
    const key=MODULE_NAMES.get(moduleName(m[1]||m[2]));
    if(key)return [candidate('module',{action:'wide',key},'Make wide · '+MODULE_LABELS[key])];
  }
  if((m=/^(show|hide|add|remove)\s+(?:me\s+)?(.+)$/.exec(text))){
    const explicit=HOME_AT.test(text)||MODULE_QUALIFIER.test(text),
      name=moduleName(m[2]),
      key=MODULE_NAMES.get(name),
      visible=VISIBILITY_NAMES.get(name),
      on=m[1]==='show'||m[1]==='add';
    if(visible&&!explicit&&(!key||!['context','grades'].includes(key)||name==='grades'))return setting(visible,on,(on?'Show ':'Hide ')+name);
    if(key)return [candidate('module',{action:on?'show':'hide',key},(on?'Show ':'Hide ')+MODULE_LABELS[key])];
  }
  const destination=/^(?:open|find|show|go\s+to|navigate\s+to)\s+(?:me\s+)?(.+)$|^go\s+(home)$/.exec(text);
  if(destination){const name=tabName(destination[1]||destination[2]),tab=TAB_NAMES.get(name);if(tab)return [candidate('navigate',{tab},'Go to · '+name)];}
  const prefix=/^(?:turn|switch)\s+(on|off)\s+(.+)$/.exec(text),
    toggle=/^(enable|disable|stop|start|show|hide)\s+(.+)$/.exec(text),
    suffix=/^(?:(?:turn|switch)\s+)?(.+?)\s+(on|off)$/.exec(text),
    negative=/^no\s+(.+)$/.exec(text);
  if(prefix||toggle||suffix||negative){
    const name=bare(prefix?.[2]||toggle?.[2]||suffix?.[1]||negative?.[1]),
      on=prefix?prefix[1]==='on':toggle?/^(?:enable|start|show)$/.test(toggle[1]):suffix?suffix[2]==='on':false,
      module=MODULE_NAMES.get(moduleName(name));
    if(module&&(HOME_AT.test(name)||MODULE_QUALIFIER.test(name)))return [candidate('module',{action:on?'show':'hide',key:module},(on?'Show ':'Hide ')+MODULE_LABELS[module])];
    const skill=SKILL_NAMES.get(name),feature=FEATURE_NAMES.get(name);
    if(skill)return [candidate('skill',{skill,on},(on?'Enable ':'Disable ')+name)];
    if(feature==='pony')return [candidate('pet',{action:on?'settings':'off'},on?'Companion settings':'Companion · settings')];
    if(feature)return [candidate('feature',{id:feature,on},(on?'Enable ':'Disable ')+name)];
    const key=VISIBILITY_NAMES.get(name);
    if(key)return setting(key,on,(on?'Show ':'Hide ')+name);
    if(module&&(!toggle||!['stop','start'].includes(toggle[1])))return [candidate('module',{action:on?'show':'hide',key:module},(on?'Show ':'Hide ')+MODULE_LABELS[module])];
  }
  const explicitCourse=/^(?:navigate\s+to|(?:open|show|go\s+to)\s+(?:the\s+)?course)\s+(.+)$/.exec(text),shortCourse=/^go\s+to\s+(?:the\s+)?([a-z]+)$/.exec(text);
  if(explicitCourse||shortCourse&&Object.hasOwn(COURSE_WORDS,shortCourse[1]))
    return entities(explicitCourse?.[1]||shortCourse[1],{courses:s.courses,workItems:[]}).filter(e=>e.fields.courseId).map(e=>
      candidate('navigate',{courseId:e.fields.courseId},'Go to · '+e.label));
  const toolName=bare(text.replace(/^(?:(?:open|launch|use|play|start)\s+|let\s+me\s+|plant\s+(?:a\s+)?)/,'').replace(/\s+(?:the\s+page|tool)$/,'')),tool=PLAY_NAMES.get(toolName);
  if(tool)return [candidate('play',{tool},'Play · '+toolName)];
  return null;
 }
 const CATALOGUE_KINDS=new Map([
   ['feature','feature'],
   ['features','feature'],
   ['scene','scene'],
   ['scenes','scene'],
   ['theme','theme'],
   ['themes','theme'],
   ['chtheme','theme'],
   ['art','art'],
   ['artwork','art'],
   ['chpack','art'],
   ['kit','kit'],
   ['kits','kit'],
   ['chkit','kit'],
   ['pet','pet'],
   ['pets','pet'],
   ['companion','pet'],
   ['companions','pet'],
   ['chpet','pet'],
   ['preset','preset'],
   ['presets','preset'],
   ['chpreset','preset'],
   ['media','media']
 ]),
   CATALOGUE_TYPES=new Set(CATALOGUE_KINDS.values()),
   catalogueWords=value=>words(value).join(' ');
 function companionName(s){
   const own=object(object(s.settings).makeYourOwn),
     active=object(own.pet),
     row=Object.hasOwn(object(own.installed),active.id)?object(own.installed[active.id]):{},
     name=active.id?row.kind==='pet'&&row.id===active.id?row.name:'Biscuit':object(s.companion).name||object(s.pet).name;
   return clean(name).slice(0,120)||'Biscuit';
 }
 function namedPet(input,s){
   const q=catalogueWords(input.replace(/^please\s+/i,'')),names=new Set(['biscuit','pony','companion',catalogueWords(companionName(s))]);
   let m;
   if((m=/^give (.+?) (?:a )?treat$/.exec(q))&&names.has(m[1]))return [candidate('pet',{action:'treat'},'Treat '+companionName(s))];
   if((m=/^send (.+?) home$/.exec(q))&&names.has(m[1]))return [candidate('pet',{action:'home'},'Send '+companionName(s)+' home')];
   return null;
 }
 function installed(input,context={}){
  const s=object(context),
    raw=clean(input).slice(0,4096).replace(/^please\s+/i,'').toLowerCase().replace(/[’]/g,"'").replace(/\bwhat's\b/g,'what is').replace(/[.!?]+$/,'').trim(),
    q=catalogueWords(raw);
  let m;
  if(/^(?:who are you|what is your name|what are you called)$/.test(q))return [candidate('installed',{action:'name',kind:'pet'},'Companion name')];
  if((m=/^(?:what|which) (?:is|are) (?:my|the|your|this) (.+?)(?: name| called)?$/.exec(q))||(m=/^(?:what|which) (.+?) (?:am i using|is active|is this)$/.exec(q))){
    const kind=CATALOGUE_KINDS.get(m[1]);
    if(kind)return [candidate('installed',{action:'name',kind},'Current '+kind)];
  }
  if(/^(?:what do i have installed|what is installed|list (?:my |all |the )?(?:installed )?(?:packs|add ons|choices)|show (?:my |all |the )?installed(?: packs| add ons| choices)?)$/.test(q))return [candidate('installed',{action:'list'},'Installed choices')];
  if((m=/^(?:(?:list|show) (?:(?:my|all|the|available|installed) )*|installed )(.+)$/.exec(q))){
    const kind=CATALOGUE_KINDS.get(m[1]);
    if(kind)return [candidate('installed',{action:'list',kind},'Installed '+kind)];
  }
  const set=/^(?:set|change|switch)\s+(?:(?:my|the)\s+)?(.+?)\s+to\s+(.+)$/.exec(raw),
    verb=/^(?:use|apply|switch(?:\s+to)?|change\s+to|enable)\s+(.+)$/.exec(raw),
    target=catalogueWords(set?set[1]+' '+set[2]:verb?verb[1]:raw),
    parts=target.split(' '),
    first=CATALOGUE_KINDS.get(parts[0]),
    last=CATALOGUE_KINDS.get(parts.at(-1)),
    kind=first||last,
    query=parts.slice(first?1:0,last?-1:undefined).join(' '),
    explicit=!!set||!!verb;
  if(!explicit&&!kind)return null;if(!query)return explicit?[]:null;
  const seen=new Set(),rows=[];
  for(const item of Array.isArray(s.catalogue)?s.catalogue.slice(0,512):[]){
    const row=object(item),key=id(row.id),name=clean(row.name).slice(0,120);
    if(!key||key.length>300||['__proto__','constructor','prototype'].includes(key)||!name||!CATALOGUE_TYPES.has(row.kind)||kind&&row.kind!==kind&&!(kind==='theme'&&row.kind==='scene'))continue;
    const unique=row.kind+'|'+key;
    if(seen.has(unique))continue;
    seen.add(unique);
    const aliases=[name,...(Array.isArray(row.aliases)?row.aliases.slice(0,12):[])].filter(v=>typeof v==='string').map(v=>catalogueWords(v.slice(0,160))),
      need=query.split(' '),
      score=Math.max(0,...aliases.map(alias=>alias===target||alias===query?100:need.every(w=>alias.split(' ').includes(w))?50:0));
    if(score)rows.push({id:key,name,kind:row.kind,score});
  }
  rows.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));const best=rows[0]?.score;
  if(rows.length)return rows.filter(row=>row.score===best).slice(0,3).map(row=>candidate('installed',{action:'use',id:row.id,kind:row.kind},'Use · '+row.name+' · '+row.kind));
  return explicit&&Array.isArray(s.catalogue)||kind&&explicit?[]:null;
 }
 const literal=input=>clean(input).toLowerCase().replace(/\u2019/g,"'"),
   unquoted=text=>text.replace(/"(?:\\.|[^"\\])*"|“[^”]*”|‘[^’]*’|(?<![\p{L}\p{N}])'[^'\n]+'(?![\p{L}\p{N}])/gu,m=>' '.repeat(m.length)),
   requestText=text=>text.replace(/^(?:(?:please|pls|plz|hey(?:\s+biscuit)?|biscuit|okay|ok)\b[\s,:!]*|(?:can|could|would|will)\s+(?:you|u)\s+(?:please\s+)?|i\s+(?:need|want)\s+you\s+to\s+)/g,'').replace(/[\s,]*\b(?:(?:please|pls|plz|biscuit|again|back|now|completely)|just\s+for\s+me)[\s.!]*$/g,'').trim();
 function readOnly(input){
  const text=unquoted(literal(input)),request=requestText(text);
  if(/^do\s+(?:\d+(?:\.\d+)?|half|a\s+quarter)\s*(?:minutes?|mins?|m|hours?|hrs?|h)\b/.test(text))return false;
  if(/^(?:don't|do\s+not)\s+let\s+me\s+forget\b/.test(text))return false;
  if(/^(?:what|why|how|when|where|which|who|whether|if|unless|suppose)\b|^(?:can|could|would|should|may|do|does|did|is|are|was|were|will|has|have)\s+(?!you\b|u\b)/.test(text)||/\b(?:tell|show|explain|check)\s+(?:me\s+)?(?:if|whether|how|what|when)\b|\bi\s+(?:wonder|wondered)\b|\b(?:what\s+if|suppose|hypothetically)\b/.test(text))return true;
  if(/\?\s*$/.test(text)&&request===text)return true;return /\b(?:don't|dont|do\s+not|never|not\s+to|shouldn't|should\s+not|wouldn't|would\s+not|can't|cannot)\s+(?:(?:please|ever|actually|just)\s+)*(?:(?:want|wish|mean|intend|need)\s+(?:you\s+)?to\s+)?(?:pause|unpause|resume|continue|stop|end|cancel|hold|add|extend|cut|remove|reduce|shorten|set|change|switch|turn|enable|disable|show|hide|save|bookmark|pin|note|write|jot|plan|schedule|rebuild|start|focus|remind|ping|nudge)\b|^(?:no|not)\s+(?:pause|resume|stop|change|switch|save|bookmark|note|plan|focus)\b/.test(text);
 }
 function activeFocus(s){
   const f=object(s.focus),now=stamp(s.now),end=stamp(f.endsAt);
   return f.running===true||
     f.paused===true||
     f.pausedAt!==undefined&&f.pausedAt!==null&&f.pausedAt!==false||
     f.status==='paused'||
     f.state==='paused'||
     f.running!==false&&end!==null&&now!==null&&end>now;
 }
 function localFocus(input,s){
  const text=unquoted(literal(input)),body=requestText(text).replace(/^give\s+me\s+/,'').replace(/[.!?]+$/,'').trim(),current=activeFocus(s),named=/\b(?:focus|timer|countdown|pomodoro)\b/.test(text);
  if((named||current&&/\b(?:timer|countdown|focus|end|ends|finish|finishes|left|remaining)\b/.test(text))&&/\b(?:how\s+long|how\s+much\s+time|time\s+(?:is\s+)?left|(?:tell|show|check)\s+(?:me\s+)?(?:if|whether|when)|(?:is|does|will)\s+(?:it|that|my|the|this|current))\b/.test(text))return [candidate('focus-status',{},'Time left on focus timer')];
  if(!current&&!named||readOnly(input))return null;
  const verb=/\b(pause|hold|unpause|resume|continue|stop|end|cancel)\s+(?:(?:my|this|that|the|current|existing|active)\s+)*(?:focus(?!\s+(?:room|buddy|help|layout|preset|workspace|module|widget|feature|mode)\b)(?:\s+(?:timer|countdown|session))?|(?:study\s+)?timer|countdown|session)\b/.exec(text)||/^(?:i(?:'m| am)\s+)?(pause|hold(?:\s+on)?|unpause|resume|continue|keep\s+going|stop|end|cancel|done)(?:\s+(?:it|that|this))?$/.exec(body);
  if(verb){
    const action=/^(?:stop|end|cancel|done)$/.test(verb[1])?'stop':/^(?:pause|hold)/.test(verb[1])?'pause':'resume';
    return [candidate('focus-control',{action},action[0].toUpperCase()+action.slice(1)+' focus')];
  }
  const change=/\b(add|extend|increase|tack|subtract|remove|reduce|shorten|cut|knock)\b/.exec(text),shortForm=/^(?:focus\s*)?[+-]\s*\d+(?:\.\d+)?(?:\s*(?:minutes?|mins?|m|hours?|hrs?|h))?$/.test(body)||/^(?:(?:add|extend|subtract|remove|reduce|shorten|cut)\s*)?(?:-?\d+(?:\.\d+)?|[a-z]+(?:[ -][a-z]+){0,3})\s*(?:more|extra|additional|less|fewer)\s*(?:minutes?|mins?|m|hours?|hrs?|h)$/.test(body)||/^(?:add|subtract|remove|reduce|extend|cut)\s*(?:by\s+)?(?:\d+(?:\.\d+)?|[a-z]+(?:[ -][a-z]+){0,3})\s*(?:minutes?|mins?|m|hours?|hrs?|h)?$/.test(body);
  if(!shortForm&&!/^\d+(?:\.\d+)?\s*(?:minutes?|mins?|m|hours?|hrs?|h)\s+(?:less|fewer|more|extra)$/.test(body)&&!(named&&change))return null;
  const fragment=change?text.slice(change.index):body,amounts=durations(fragment.replace(/\b(?:more|extra|additional|less|fewer)\b/g,' '),true),amount=amounts[0]?.minutes,signed=adjust(body);
  let minutes=amount===undefined?signed:Math.abs(amount)*(/^(?:subtract|remove|reduce|shorten|cut|knock)$/.test(change?.[1]||'')||/\b(?:less|fewer)\b/.test(body)||/^(?:focus\s*)?-/.test(body)?-1:1);
  if(minutes===null||minutes===undefined)return null;
  if(!validMinutes(Math.abs(minutes)))return [];
  return [candidate('focus-control',{action:'adjust',minutes},(minutes>0?'Add ':'Remove ')+Math.abs(minutes)+' min '+(minutes>0?'to':'from')+' focus')];
 }
 function localReminder(input,s){
  const value=clean(input),
    n=normalize(value),
    text=unquoted(n.text),
    cue=/\b(?:remind(?:er)?|ping|nudge|remember|note)\b\s*(?:(?:me|please|pls)\b\s*)*(?:to\b\s*)?|\b(?:don't|do\s+not)\s+let\s+me\s+forget\b\s*/.exec(text);
  if(!cue||readOnly(input)||/\b(?:every|recurring|recurrence|repeat|weekdays|daily)\b/.test(unquoted(literal(input))))return null;
  const t=temporal(text,s),ranges=[...t.spans],prefix=without(text.slice(0,cue.index),t.spans.map(([a,b])=>[a,Math.min(b,cue.index)]));
  if(/^\s*(?:(?:first|please|pls|set|create|add|give|me|a|an|the|for|at|on|hey|oye|biscuit)\b[\s,:-]*)*$/.test(prefix)||/^\s*i\s+(?:need|want)\s+to\s*$/.test(prefix))
    ranges.push([0,cue.index+cue[0].length]);
  else if(!/^(?:remind|ping|nudge|remember|note)\b|\b(?:need|want)\s+to\s+remember\b|\b(?:don't|do\s+not)\s+let\s+me\s+forget\b/.test(text))return null;
  const next=/;\s*(?:after\s+that|then)\s*,?\s*(?:open|show|start|save|bookmark)\b/.exec(text);if(next)ranges.push([next.index,text.length]);return reminder(value,n,{...t,spans:ranges},true);
 }
 function localBookmark(input,s){
  const text=unquoted(literal(input));
  if(readOnly(input))return null;
  let m,query;
  const direct=/\bbookmark\s+(.+?)(?=[,;.!?]|$)/.exec(text),prefix=direct?text.slice(0,direct.index).trim():'';
  if(direct&&(!prefix||/[,;.!?]$|\b(?:please|pls|then|first|to)$|^(?:can|could|would|will)\s+(?:you|u)$/.test(prefix)))
    query=direct[1];
  else if((m=/\b(?:save|keep|pin|add|put)\s+(.+?)\s+(?:in(?:to)?|to|as)\s+(?:(?:a|the|my)\s+)?bookmarks?\b/.exec(text)))
    query=m[1];
  else if((m=/\b(?:save|make|add|create)\s+(?:a\s+)?bookmark\s+(?:for|of|to)\s+(.+?)(?=[,;.!?]|$)/.exec(text)))
    query=m[1];
  else if((m=/^(.+?)\s+(?:needs?|could\s+use)\s+(?:a\s+)?bookmark\b/.exec(text)))
    query=m[1];
  else if((m=/\b(?:need|want)\s+(?:a\s+)?saved\s+shortcut\s+to\s+(.+?)(?:\s+for\b|[,;]|$)/.exec(text)))query=m[1];else return null;
  query=clean(query).replace(/^(?:for|of|to)\s+/,'').replace(/\s+(?:and|then)\s+.*$/,'').replace(/\s+(?:on\s+this\s+page|before\s+i|right\s+now|rn)\b.*$/,'');
  const deictic=/^(?:(?:the|my)\s+)?(?:this|that|it|first|second|third|middle|last)\b|^(?:the\s+)?(?:assignment|file|card)\s+(?:on\s+)?this\s+page\b/.test(query),
    extra=[
      ...(Array.isArray(s.workItems)?s.workItems:[...(Array.isArray(s.assignments)?s.assignments:[]),...(Array.isArray(s.planner)?s.planner:[])]),
      ...(Array.isArray(s.files)?s.files:[]),
      ...(Array.isArray(s.materials)?s.materials:[])
    ],
    found=deictic?[]:entities(query,{...s,workItems:extra}).filter(e=>e.fields.itemId);
  return found.length?found.map(e=>candidate('bookmark',e.fields,'Bookmark · '+e.label)):[candidate('bookmark',{},'Bookmark · '+(query||'this item'))];
 }
 function looseKeys(input,s){
  const text=unquoted(literal(input)),body=requestText(text).replace(/[.!?]+$/,'').trim(),exact=keyCommand(body,s)??tolerantKey(body,s);
  if(exact?.length)return exact.some(c=>c.intent==='note')?null:exact;
  let m;
  const moduleEntries=/\b(?:module|widget|panel|card)\b/.test(text)?[...MODULE_NAMES].sort((a,b)=>b[0].length-a[0].length):[];
  for(const [name,key] of moduleEntries){
    const entity=name.replace(/[ -]+/g,'[ -]+')+'\\s+(?:module|widget|panel|card)',ref=new RegExp('\\b'+entity+'\\b').exec(text);
    if(!ref)continue;
    const target='(?:(?:the|my)\\s+)?'+entity;
    if((m=new RegExp('\\b(show|unhide|hide|add|remove)\\s+'+target+'\\b').exec(text)))
      return [candidate('module',{action:/^(?:show|unhide|add)$/.test(m[1])?'show':'hide',key},(/^(?:show|unhide|add)$/.test(m[1])?'Show ':'Hide ')+MODULE_LABELS[key])];
    if(new RegExp('\\b'+entity+'\\s+(?:first|on\\s+top)\\b|\\b(?:move|put|bring)\\s+'+target+'\\s+(?:to\\s+)?(?:the\\s+)?(?:top|first)\\b').test(text))
      return [candidate('module',{action:'top',key},'Move to top · '+MODULE_LABELS[key])];
    if(new RegExp('\\b(?:make|set|widen)\\s+(?:'+target+'|(?:that|this|the)\\s+(?:module|widget|panel|card))\\s+(?:(?:to|be)\\s+)?(?:full[ -]width|wide|wider)\\b').test(text))
      return [candidate('module',{action:'wide',key},'Make wide · '+MODULE_LABELS[key])];
  }
  const featureEntries=/\b(?:disable|deactivate|enable|activate|turn|switch|feature|on|off)\b/.test(text)?[...FEATURE_NAMES].sort((a,b)=>b[0].length-a[0].length):[];
  for(const [name,feature] of featureEntries){
    const namePattern=name.replace(/[ -]+/g,'[ -]+'),
      target='(?:(?:the|my|interface)\\s+)?'+namePattern+'(?:\\s+feature)?',
      prefix=new RegExp('\\b(disable|deactivate|enable|activate|re[ -]enable|turn\\s+(?:on|off)|switch\\s+(?:on|off))\\s+'+target+'\\b').exec(text),
      suffix=new RegExp('\\b'+target+'\\s+(?:(?:back|again)\\s+)?(on|off)\\b').exec(text),
      reference=new RegExp('\\b'+namePattern+'\\b').test(text)?/\b(activate|enable|disable|deactivate|turn\s+(?:on|off)|switch\s+(?:on|off))\s+(?:that|this|the)\s+feature\b/.exec(text):null,
      action=prefix?.[1]||suffix?.[1]||reference?.[1];
    if(!action)continue;
    const on=!/^(?:disable|deactivate|off)$|\boff$/.test(action);
    return feature==='pony'?[candidate('pet',{action:on?'settings':'off'},on?'Pony settings':'Pony companion · settings')]:[candidate('feature',{id:feature,on},(on?'Enable ':'Disable ')+name)];
  }
  if((m=/^(?:(?:make|set)\s+(?:it|this|that|(?:the|my)\s+(?:page|screen|interface|app))\s+)?(?:a\s+bit\s+|slightly\s+)?(less\s+bright|dimmer|darker|more\s+bright|brighter|lighter)$/.exec(body)))return setting('theme',/^(?:less|dimmer|darker)/.test(m[1])?'dark':'light');
  if((m=/\b(dark|light|system)\s+(?:mode|theme)\s+(?:please|pls|plz)\b/.exec(text)))return setting('theme',m[1]);
  if((m=/\b(?:set|change|put|switch)\s+(?:the\s+)?(?:row\s+)?density\s+(?:on|to|back\s+to)\s+(comfortable|compact)\b/.exec(text)))return setting('density',m[1]);
  if((m=/\b(?:set|change|put|switch)\s+(?:the\s+)?course\s+navigation\s+(?:to|on)\s+(?:the\s+)?(?:(?:left\s+)?sidebar|side\s+bar|left|topbar|top\s+bar|top|bottom|dock)\b/.exec(text))){
    const value=m[0].match(/\b(?:to|on)\s+(?:the\s+)?(.+)$/)?.[1],key=value?.replace(/^left\s+sidebar$/,'sidebar');
    return setting('courseNavigation',settingValue('courseNavigation',key||''));
  }
  if((m=/\b(?:switch|turn|set)\s+(?:(on|off)\s+)?(?:the\s+)?(bookmark|grade|recent[ -]grade)s?\s+(?:visibility|display)(?:\s+setting)?\s*(?:(?:back|again)\s+)?(on|off)?\b/.exec(text))&&(m[1]||m[3]))
    return setting(m[2].startsWith('recent')?'showRecentGrades':m[2]==='bookmark'?'showBookmarks':'showGrades',(m[1]||m[3])==='on');
  if((m=/\b(helpful|quiet)\s+nudges\s+(?:(?:back|again)\s+)?(?:on|off)\b/.exec(text)))return setting('pet.nudges',/\boff\b/.test(m[0])?'quiet':m[1]);
  if((m=/\b(?:show|hide|enable|disable)\s+(?:the\s+)?(?:biscuit|pet|pony|companion)\b/.exec(text)))return setting('pet.enabled',/^(?:show|enable)/.test(m[0]));
  const starts=[...text.matchAll(/\b(?:turn|switch|enable|disable|show|hide|move|put|bring|make|use|set|change|apply|reset|restore|remove|add)\b/g)];
  for(const start of starts.slice(0,16)){
    let phrase=text.slice(start.index).split(/[,;.!?]/,1)[0].split(/\s+(?:while|because|since|so|though|when|i|we)\b/,1)[0].replace(/\brecent-grades\b/g,'recent grades').replace(
      /\b(?:display|visibility)\s+setting\b/g,
      '').trim();
    for(let n=0;n<3;n++)phrase=requestText(phrase);
    const result=keyCommand(phrase,s)??tolerantKey(phrase,s);
    if(result?.length&&result.every(c=>['setting','feature','features','module','skill','preset','pet','quiet'].includes(c.intent)))return result;
  }
  return exact;
 }
 function local(input,context={}){
  if(typeof input!=='string'||!input.trim()||/^(?:ask\s+ai\b|\?)/i.test(input.trim()))return null;
  const raw=input.trim().slice(0,4096),
    value=clean(raw),
    s=object(context),
    noteRaw=raw.replace(/^(?:(?:please|pls|plz|hey(?:\s+biscuit)?|biscuit|okay|ok)\b[\s,:!]*|(?:can|could|would|will)\s+(?:you|u)\s+(?:please\s+)?)+/i,''),
    plain=/^note\s+[^:]/i.test(noteRaw)&&!/^note\s+to\s+self\b/i.test(noteRaw),
    timed=plain&&(()=>{
    const t=temporal(unquoted(normalize(clean(noteRaw)).text),s);
    return t.explicit||t.relative!==undefined||t.minute!==undefined;
  })(),note=noteCommand(noteRaw,!timed);
  if(note!==null)return note;
  if(/^(?:open|find|show|go\s+to)\b.*\b(?:and|then)\s+(?:bookmark|save|pin|note|focus|start)\b/i.test(value))return null;
  const bookmark=localBookmark(value,s);
  if(bookmark!==null)return bookmark;
  const reminder=localReminder(value,s);
  if(reminder!==null)return reminder;
  const timer=localFocus(value,s);
  if(timer!==null)return timer;
  if(readOnly(value))return null;
  return looseKeys(value,s);
 }
 function planIntent(input,context={}){
  const text=unquoted(literal(input));
  if(!text||readOnly(input)||/^(?:ask\s+ai\b|\?)/.test(text)||local(input,context)!==null)return false;
  return /\b(?:plan|replan|rebuild|schedule|reschedule)\b|\b(?:fit|split|spread|divide|allocate|organise|organize|map\s+out|line\s+up|work\s+backwards)\b.*\b(?:work|study|homework|prep|tonight|evening|week|weekend|slot|block|time)\b|\b(?:study|prep|work|reading)\s+(?:slots?|blocks?|order)\b|\b(?:study|work)\b.*\b(?:order|gap)\b|\b(?:gap|free|available)\b.*\b(?:fit|plan|study|work)\b/.test(text);
 }
 const generativeProduct=input=>/^(?:quiz(?:\s+me)?|test\s+me|practice|lab\s*checklist|reading\s*guide|rubric(?:\s+checklist)?|fix\s*list|notes?\s+outline|flashcards?)\b/i.test(clean(input).replace(/^(?:(?:please|pls|plz|hey(?:\s+biscuit)?)\b[\s,:!]*|(?:can|could|would|will)\s+(?:you|u)\s+(?:please\s+)?)+/i,''));
 function parse(input,context={}){
  const value=clean(input).slice(0,4096);
  if(!value||generativeProduct(value))return [];
  const explicitAI=/^(?:ask\s+ai\b\s*|\?\s*)/i.exec(value);
  if(explicitAI)return ai(value.slice(explicitAI[0].length));
  const s=object(context),catalogue=installed(value,s),petCommand=namedPet(value,s);
  if(catalogue?.length)return catalogue;
  if(petCommand!==null)return petCommand;
  const legacyNote=/^note\s+[^:]/i.test(value)&&!/^note\s+to\s+self\b/i.test(value),loose=legacyNote?null:local(input,s);
  if(loose!==null)return loose;
  const read=readOnly(value),key=keyCommand(value,s)??tolerantKey(value,s);
  if(key!==null&&(!read||key.every(c=>['help','open','navigate','focus-status'].includes(c.intent))))return key;
  if(catalogue!==null)return catalogue;
  const n=normalize(value),polite=/^please\s+/.exec(n.text);
  if(polite){n.text=n.text.slice(polite[0].length);n.starts=n.starts.slice(polite[0].length);n.ends=n.ends.slice(polite[0].length);}
  const text=n.text,empty={spans:[]},tags=new Set(text.match(/[a-z]+/g)||[]),has=(...names)=>names.some(w=>tags.has(w));
  if(has('explain','describe','write','draft','compose','summarize','translate','tell')&&/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:explain|describe|write|draft|compose|summarize|translate|tell\s+me\s+about)\b/.test(text))return ai(value);
  if(!read&&has('remind','reminder','remember','note','ping','forget')&&/\b(?:remind(?:er)?|remember|note|ping)\b|\bdon't\s+let\s+me\s+forget\b/.test(text))return reminder(value,n,temporal(text,s),true);
  if(has('how','time')&&/\b(?:how\s+long|time\s+(?:is\s+)?left|how\s+much\s+time)\b/.test(text))return [candidate('focus-status',{},'Time left on focus timer')];
  if((has('due','what')||text.includes('due'))&&/\b(?:what(?:'s|s|\s+is)?\s*)?due\b|\bwhat\s+do\s+i\s+have\b/.test(text)){
    const t=temporal(text,s);
    return t.invalid?[]:[candidate('due',rangeFields(t),'Due'+rangeLabel(t))];
  }
  if(read)return ai(value);
  if(has('explain','why','what','how')&&/^(?:explain\b|why\b|what\s+(?:is|are|does)\b|how\s+(?:do|does|can|should)\b)/.test(text))return ai(value);
  if(has('plan','schedule','put')&&/\b(?:plan|schedule|put)\b/.test(text)){
    const t=temporal(text,s),
      amounts=targetDurations(without(text,t.spans),s),
      minutes=amounts[0]?.minutes,
      spans=[...t.spans,...amounts.flatMap(d=>d.spans)],
      query=without(text,spans).replace(PLAN_WORDS,''),
      title=titleOf(value,n,{spans},PLAN_WORDS);
    if(t.invalid||minutes!==undefined&&!validMinutes(minutes))return [];
    return entities(query,s).map(e=>
      candidate(
        'plan',
        {...rangeFields(t),...(minutes!==undefined?{minutes}:{}),...e.fields,...(title?{title}:{})},
        'Plan'+(e.label?' · '+e.label:'')+rangeLabel(t)+(minutes?' · '+minutes+' min':'')));
  }
  const pet=has('treat','home','hide','settings','quiet','sendhome')&&/^(?:give\s+(?:(?:biscuit|pony|me)\s+)?(?:a\s+)?)?treat\b/.test(text)?'treat':/^(?:home|send\s*(?:(?:biscuit|pony)\s+)?home)\b/.test(text)?'home':/^(hide|settings|quiet)\b/.exec(text)?.[1];
  if(pet){
    const minutes=pet==='hide'?duration(text.replace(/^hide\b/,''),60):null;
    if(pet==='hide'&&minutes===null)return [];
    return [
      candidate('pet',{action:pet,...(pet==='hide'?{minutes}:{})},{treat:'Treat '+companionName(s),home:'Send home',hide:'Hide · '+minutes+' min',settings:'Companion settings',quiet:'Quiet mode'}[pet])
    ];
  }
  const open=has('open','find','show','go')&&/^(?:open|find|show|go\s+to)\b/.exec(text);
  if(open)return entities(queryOf(text,new RegExp('^'+open[0]),empty),s).map(e=>candidate('open',e.fields,'Open'+(e.label?' · '+e.label:'')));
  const control=localFocus(text,s);
  if(control!==null)return control;
  if(/^(?:pause|unpause|resume|continue|stop|end|cancel|hold|done|keep\s+going)\b|^(?:focus\s*)?[+-]|^\d+\s*more\s*(?:min(?:ute)?s?|m)\b/.test(text))return ai(value);
  if(FOCUS.test(text))return focus(value,n,s,/\b(?:until|till)\b/.test(text)?temporal(text,s):empty);
  if(/\b(?:break|rest)\b/.test(text)){const minutes=duration(text,/\blong\b/.test(text)?15:5);return minutes===null?[]:[candidate('break',{minutes},'Break · '+minutes+' min')];}
  const amounts=targetDurations(text,s);
  if(amounts.length){
    const query=clean(without(text,amounts.flatMap(d=>d.spans))).replace(/\b(?:do|of|for|a|an|please|pls)\b/g,'').trim();
    if(!query||entities(query,s).some(e=>e.fields.courseId||e.fields.itemId))return focus(value,n,s,empty);
  }
  const t=temporal(text,s);if(t.explicit||t.minute!==undefined||t.relative!==undefined)return reminder(value,n,t,false);return ai(value);
 }
 for(const [pattern,sample] of [[NUMBER_RE,'1'],[DURATION_RE,'1 minute']]){pattern.test(sample);pattern.lastIndex=0;}calendar(ZONE)(0);
 const CLOCK_TOKEN='(?:half\\s+past\\s+)?(?:\\d{1,2}(?::\\d{1,2})?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s*(?:[ap]\\.?m\\.?|[ap](?![a-z]))?|noon|midnight';
 function eventAt(value,t){
   const v=object(value),raw=v.dateTime??v.date??value;
   if(typeof raw==='string'){
     const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(raw);
     if(m){
       const minute=Number(m[2])*60+Number(m[3]),at=Number(m[3])<60&&Number(m[4]||0)<60?wall(m[1],minute,t.local):null;
       return at===null?null:at+Number(m[4]||0)*1000+Number((m[5]||'').slice(0,3).padEnd(3,'0'));
     }
     if(validDay(raw))return wall(raw,0,t.local);
   }
   return stamp(raw);
 }
 function namedEnd(name,s,t){
  const wanted=words(name).filter(w=>!['the','my','our','a','an'].includes(w)),
    cal=object(s.calendar),
    values=[s.busy,s.events,Array.isArray(s.calendar)?s.calendar:cal.events,cal.items,s.assignments,s.workItems,s.planner],
    found=[];
  if(!wanted.length)return null;
  for(const list of values)
    for(const raw of (Array.isArray(list)?list:[]).slice(0,1000)){
      const v=object(raw),tokens=words(clean(v.title)||clean(v.name)||clean(v.summary)||clean(v.label));
      if(!wanted.every(w=>tokens.includes(w))||v.cancelled===true||v.status==='cancelled')continue;
      const end=eventAt(v.end??v.endsAt??v.endAt,t),start=eventAt(v.start??v.startsAt??v.startAt,t);
      if(end===null||start!==null&&end<=start||!t.today)continue;
      const day=t.date||t.today;
      if(t.local(end).date!==day&&!(start!==null&&t.local(start).date===day))continue;
      found.push({end,extra:tokens.length-wanted.length});
    }
  found.sort((a,b)=>Number(b.end>t.now)-Number(a.end>t.now)||a.extra-b.extra||(a.end>t.now?a.end-b.end:b.end-a.end));
  return found[0]?.end??null;
 }
 function planningSlots(input,s,t){
  let text=unquoted(literal(input)).replace(/\b(?:tonights|tonight's)\b/g,'tonight');
  const out={},moveCues=[...text.matchAll(/\b(?:move|bump|shift|push|reschedule|postpone|delay)\b/g)],cue=moveCues.at(-1)||/\b(?:rebuild|replan|line\s+up|put\s+together|map\s+out|fit|schedule|plan)\b/.exec(text);
  if(cue){
    const target=text.slice(cue.index),time=temporal(normalize(target).text,s);
    out.date=time.date;
    if(moveCues.length){text=target;t=time;out.minute=time.minute;out.relative=time.relative;}else t={...t,date:time.date};
    if(time.invalid)out.invalid=true;
  }
  const used=[],
    localMinute=t.now===null?0:t.local(t.now).minute,
    part=/\b(morning|afternoon|evening|tonight)\b/.exec(text)?.[1],
    evening=part==='evening'||part==='tonight',
    moving=moveCues.length>0||/\binstead\b/.test(text),
    clockToken='('+CLOCK_TOKEN+')',
    clockAt=(value,end=false,after=false)=>{
    let v=value.trim().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,w=>String(NUMBERS[w]));
    if(v==='noon')return {minute:720};
    if(v==='midnight')return {minute:0};
    const c=readClock('at '+v);
    if(c.ambiguous){const base=c.minute%720;c.minute=part==='morning'?base:evening||after?base+720:end?(base>localMinute?base:base+720):c.minute;}
    return c;
  },putClock=(m,key,value,end=false,after=false)=>{
    const c=clockAt(value,end,after);
    if(c.invalid||c.minute===undefined)out.invalid=true;else out[key]=c.minute;
    used.push(span(m));
  };
  let m;
  const range=new RegExp('\\b(?:from|between|(?:only\\s+)?free(?:\\s+from)?)\\s+'+clockToken+'\\s*(?:to|until|till|through|and|-)\\s*'+clockToken+'(?![\\w:])','g');
  if((m=range.exec(text))){
    if(moving)
      putClock(m,'startMinute',m[2],false,true);
    else{
      putClock(m,'startMinute',m[1],false,evening);
      putClock(m,'endMinute',m[2],true,evening);
      if(out.endMinute<=out.startMinute&&out.endMinute+720>out.startMinute&&out.endMinute<720&&!/\b(?:am|a\.m)\b/.test(m[2]))out.endMinute+=720;
    }
  }
  const ends=new RegExp('\\b(?:before|until|till|by|no\\s+later\\s+than|ending\\s+at)\\s+(?:(today|tonight|tomorrow)\\s+(?:at\\s+)?)?'+clockToken+'(?![\\w:])','g');
  for(const end of text.matchAll(ends)){
    if(used.some(([a,b])=>end.index>=a&&end.index<b))continue;
    putClock(end,'endMinute',end[2],true);
    if(end[1]){const d=readDate(end[1],t.today);out.boundaryDate=d.date;if(t.date===d.date&&!new RegExp('\\b'+end[1]+'\\b').test(without(text,[span(end)])))out.date=undefined;}
  }
  for(const end of text.matchAll(/\b(?:before|until|till|by)\s+(?:(today|tonight|tomorrow)\s+)?(morning|afternoon|evening|noon|midnight|bedtime)(?:\s+(today|tonight|tomorrow))?\b/g)){
    if(used.some(([a,b])=>end.index>=a&&end.index<b))continue;
    out.endMinute={morning:480,afternoon:780,evening:1080,noon:720,midnight:0,bedtime:readClock('at '+(s.settings?.bedtime||'22:30')).minute}[end[2]];
    used.push(span(end));
    const dateWord=end[1]||end[3];
    if(dateWord){out.boundaryDate=readDate(dateWord,t.today).date;if(!new RegExp('\\b'+dateWord+'\\b').test(without(text,[span(end)])))out.date=undefined;}
  }
  if(out.endMinute===undefined){
    const boundary=/\b(?:before|until|till|by)\s+(.+)$/.exec(text);
    if(boundary){
      const date=readDate(normalize(boundary[1]).text,t.today);
      if(date.explicit&&date.date){
        out.boundaryDate=date.date;
        out.endMinute=0;
        const before=readDate(normalize(text.slice(0,boundary.index)).text,t.today);
        if(!before.explicit)out.date=undefined;
      }
    }
  }
  const starts=new RegExp('\\b(?:free\\s+)?(after|starting(?:\\s+at)?|start(?:\\s+at)?|from|at|to)\\s+'+clockToken+'(?![\\w:])','g');
  for(const start of text.matchAll(starts)){
    if(start[1]==='to'&&!moving||used.some(([a,b])=>start.index>=a&&start.index<b))continue;
    if(start[1]==='at'&&/\b(?:leave|keep|reserve|save)\b.*\b(?:dinner|lunch|breakfast|meal|meeting|appointment|break)\s*$/.test(text.slice(Math.max(0,start.index-100),start.index))){
      putClock(start,'endMinute',start[2],true);
      continue;
    }
    putClock(start,'startMinute',start[2],false,start[1]==='after'&&!/\bmorning\b/.test(text));
    if(!moving)break;
  }
  const after=/\b(?:free\s+)?after\s+([a-z][a-z0-9]*(?:[ -]+[a-z][a-z0-9]*){0,7})/.exec(text);
  if(after&&!used.some(([a,b])=>after.index>=a&&after.index<b)){
    const name=after[1].split(/\s+(?:and|for|before|until|till|but|so|to|then|can|could|please|pls|choose|make|plan|sort|fit|today|tonight|tomorrow|at)\b/)[0].trim();
    if(name&&!/^(?:that|this|it|today|tonight|tomorrow|school)\b/.test(name)){out.afterEvent=name;const at=namedEnd(name,s,t);if(at===null)out.unresolvedEvent=name;else out.afterAt=at;}
  }
  const amounts=durations(text),relative=t.relative;
  if(relative!==undefined){
    const relativeSpan=t.spans.find(([a,b])=>/^\s*in\b/.test(text.slice(a,b)))||t.spans[0],
      prefix=relativeSpan?text.slice(0,relativeSpan[0]):'',
      departing=/\b(?:bus|train|ride|flight|class|meeting|appointment|practice|shift|work|leave|leaving|departure|pickup|bedtime)\b[^.;,]*$/.test(prefix)&&!/\b(?:start|begin|free|available)\b[^.;,]*$/.test(prefix);
    out[departing?'endRelative':'startRelative']=relative;
    const budget=amounts.find(d=>!t.spans.some(([a,b])=>d.spans[0][0]>=a&&d.spans[0][1]<=b));
    if(budget)out.budgetMinutes=budget.minutes;
  }
  else if(amounts.length)out.budgetMinutes=amounts[0].minutes;
  if(part)out.daypart=part;return out;
 }
 function slots(input,context={}){
   const value=clean(input).slice(0,4096),text=normalize(value).text,s=object(context),t=temporal(text,s),amounts=durations(text),p=planningSlots(value,s,t);
   return {
     date:t.date,
     endDate:t.endDate,
     minute:t.minute,
     relative:t.relative,
     minutes:amounts[0]?.minutes,
     numbers:[...text.matchAll(NUMBER_RE)].map(m=>Number(m[1])),
     local:t.local,
     wall,
     ...p,
     invalid:t.invalid||p.invalid===true
   };
 }
 const commands=(input,context={})=>{
   const value=clean(input).slice(0,4096),s=object(context),key=keyCommand(value,s)??tolerantKey(value,s);
   return readOnly(value)&&key?.some(c=>!['help','open','navigate','focus-status','note'].includes(c.intent))?null:key;
 };
 /* canonicalWord(input) canonicalizes one command/calendar word, including shorthand; retain original input for payloads. */
 const canonicalWord=input=>{const value=clean(input).toLowerCase();return /^[a-z]+$/.test(value)?keyWord(canonical(value)):value;};
 const api={parse,slots,commands,local,planIntent,readOnly,localFocus,localReminder,localBookmark,looseKeys,canonicalWord,installed,companionName,namedPet};
 root.ReserveBiscuitParse=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
