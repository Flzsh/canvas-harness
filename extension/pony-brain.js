/* The pony's decisions are data in, suggestions out. Times and calendars come only from the snapshot. */
(function(root){
 'use strict';
 function defaultTimeZone(){
  const zones=[];try{zones.push(root.ReserveSite?.timeZone?.());}catch{}try{zones.push(Intl.DateTimeFormat().resolvedOptions().timeZone);}catch{}
  for(const zone of zones)if(typeof zone==='string'&&zone)try{new Intl.DateTimeFormat('en-US',{timeZone:zone});return zone;}catch{}
  return 'UTC';
 }
 const HOUR=3600000,DAY=86400000,MAX_COUNT=1000000,MAX_KINDS=64,DEFAULT_ZONE=defaultTimeZone(),OWN=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{},count=v=>typeof v==='number'&&Number.isFinite(v)?Math.min(MAX_COUNT,Math.max(0,Math.floor(v))):0;
 const kindName=v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{0,47}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
 const itemId=v=>(typeof v==='string'||typeof v==='number'&&Number.isFinite(v))&&String(v).trim()&&String(v).length<=256&&!/[\u0000-\u001f\u007f]/.test(String(v))?String(v):'';
 const ms=v=>{
  if(typeof v==='number')return Number.isFinite(v)&&Math.abs(v)<=8640000000000000?v:null;
  if(typeof v!=='string'||!v.trim())return null;
  const n=Date.parse(v);
  return Number.isFinite(n)?n:null;
 };
 const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const addDays=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
 const estimate=v=>typeof v==='number'&&Number.isFinite(v)&&v>0?Math.min(1440,Math.ceil(v)):25;
 const compare=(a,b)=>a<b?-1:a>b?1:0,byDue=(a,b)=>(a.dueAt??Infinity)-(b.dueAt??Infinity)||compare(a.id,b.id);
 const shortTitle=(v,limit=48)=>{
  const title=[v.title,v.name].find(x=>typeof x==='string'&&x.trim())||'Untitled item',text=title.replace(/\s+/g,' ').trim();
  return text.length>limit?text.slice(0,limit-3).trimEnd()+'...':text;
 };
 function calendar(zone){
  let formatter;
  const options={year:'numeric',month:'2-digit',day:'2-digit',weekday:'long',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'};
  try{
   formatter=new Intl.DateTimeFormat('en-US',{...options,timeZone:typeof zone==='string'&&zone?zone:DEFAULT_ZONE});
  }catch(_){formatter=new Intl.DateTimeFormat('en-US',{...options,timeZone:DEFAULT_ZONE});}
  return value=>{
   const p={};
   for(const part of formatter.formatToParts(value))if(part.type!=='literal')p[part.type]=part.value;
   return {day:`${p.year.padStart(4,'0')}-${p.month}-${p.day}`,weekday:p.weekday,hour:Number(p.hour),minute:Number(p.minute),second:Number(p.second),time:`${p.hour}:${p.minute}`};
  };
 }
 function entries(s,local){
  const rows=new Map(),fields=['title','name','dueAt','dueDay','done','planned','estimate','courseId'];
  for(const list of [s.assignments,s.planner])
   for(const value of Array.isArray(list)?list:[]){
    const v=object(value),id=itemId(v.id);
    if(!id)continue;
    const row=rows.get(id)||{id};
    for(const key of fields)if(v[key]!==undefined)row[key]=v[key];
    rows.set(id,row);
   }
  return [...rows.values()].map(v=>{
   const dueAt=ms(v.dueAt);
   return {
    id:v.id,
    courseId:itemId(v.courseId),
    title:typeof v.title==='string'?v.title:'',
    name:typeof v.name==='string'?v.name:'',
    dueAt,
    dueDay:dueAt!==null?local(dueAt).day:validDay(v.dueDay)?v.dueDay:'',
    done:v.done===true,
    planned:typeof v.planned==='string'?v.planned.trim():v.planned===true?'reserved':'',
    estimate:estimate(v.estimate)
   };
  });
 }
 function context(value){
  const s=object(value),
   now=ms(s.now)??0,
   local=calendar(s.timeZone),
   clock=local(now),
   today=clock.day,
   horizon=addDays(today,3),
   focus=object(s.focus),
   all=entries(s,local),
   open=all.filter(x=>!x.done),
   next=open.filter(x=>x.dueAt!==null&&x.dueAt>=now).sort(byDue)[0]||null,
   late=s.skills?.night!==false&&(clock.hour>=22||clock.hour<7),
   completedAt=ms(focus.completedAt),
   breakUntil=ms(focus.breakUntil),
   onBreak=breakUntil!==null&&breakUntil>now,
   completedMinutes=focus.completedMinutes??focus.minutes,
   completed=typeof completedMinutes==='number'&&completedMinutes>=25&&completedAt!==null&&completedAt<=now&&now-completedAt<=HOUR;
  // A local evening is 18:00-22:00. Existing open plans reserve their estimates; no item is split or replanned.
  const start=Math.max(18*60,Math.ceil(clock.hour*60+clock.minute+clock.second/60)),
   reserved=open.filter(x=>x.planned===today).reduce((n,x)=>n+x.estimate,0),
   available=Math.max(0,22*60-start-reserved),
   eligible=open.filter(x=>!x.planned&&x.dueDay>=today&&x.dueDay<=horizon&&(x.dueAt===null||x.dueAt>=now)).sort((a,b)=>
    compare(a.dueDay,b.dueDay)||(a.dueAt??Infinity)-(b.dueAt??Infinity)||a.estimate-b.estimate||compare(a.id,b.id)),
   plan=[];
  let remaining=available,cursor=start+reserved;
  for(const row of eligible){
   const due=row.dueAt!==null&&row.dueDay===today?local(row.dueAt):null;
   if(row.estimate>remaining||due&&cursor+row.estimate>due.hour*60+due.minute+due.second/60)continue;
   plan.push({id:row.id,estimate:row.estimate});
   remaining-=row.estimate;
   cursor+=row.estimate;
  }
  const groups=new Map();
  for(const row of open)if(row.dueDay>today&&row.dueDay<=horizon){if(!groups.has(row.dueDay))groups.set(row.dueDay,[]);groups.get(row.dueDay).push(row);}
  const crunchDays=[...groups.entries()].filter(([,rows])=>rows.length>=3).sort(([a],[b])=>compare(a,b));
  let crunch=null;
  for(const [day,rows] of crunchDays){
   const row=rows.filter(x=>!x.planned&&x.estimate<=available).sort((a,b)=>a.estimate-b.estimate||byDue(a,b))[0];
   if(row){crunch={day:today,items:[{id:row.id,estimate:row.estimate}],crunchDay:day,count:rows.length};break;}
  }
  const activity=object(s.activity);
  return {
   now,
   local,
   today,
   horizon,
   open,
   next,
   focus,
   skills:s.skills,
   late,
   completedAt,
   completed,
   onBreak,
   plan,
   crunch,
   crunchDays,
   activity,
   unread:count(s.unreadAnnouncements),
   urgent:!!next&&next.dueAt-now<=3*HOUR
  };
 }
 const deadlineLabel=(dueAt,c)=>{const d=c.local(dueAt);return `Due ${d.weekday} ${d.time}`;};
 const weekday=day=>new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 const dueSpeech=(s,c)=>{const due=ms(object(s.data).dueAt);return due===null?'':deadlineLabel(due,c)+'.';};
 const SKILLS={
  deadline:{label:'Deadline watch',kinds:['next','deadline','crunch']},
  focus:{label:'Focus buddy',kinds:['focus','break']},
  planner:{label:'Planner help',kinds:['plan']},
  wellbeing:{label:'Wellbeing',kinds:['stretch']},
  inbox:{label:'Inbox watch',kinds:['inbox']},
  reminders:{label:'Reminders',kinds:['reminder','routine']},
  night:{label:'Night owl guard',kinds:['deadline']}
 };
 const cleanSkills=value=>Object.fromEntries(Object.keys(SKILLS).map(k=>[k,!OWN(object(value),k)||object(value)[k]!==false]));
 const skillEnabled=(kind,skills)=>!Object.entries(SKILLS).some(([key,spec])=>spec.kinds.includes(kind)&&OWN(object(skills),key)&&object(skills)[key]===false);
 const KINDS={
  next:{action:'open',score:c=>c.urgent?1000:200,build:c=>!c.late&&c.next?{key:c.next.id,label:'Open next',data:{itemId:c.next.id,dueAt:c.next.dueAt}}:null,speech:dueSpeech},
  focus:{action:'focus',score:160,build:c=>c.next&&!c.focus.running&&!c.onBreak?{key:c.next.id,label:'Focus 25 minutes',data:{itemId:c.next.id,minutes:25}}:null},
  plan:{action:'plan',score:120,build:c=>c.plan.length?{key:c.today,label:'Plan tonight',data:{day:c.today,items:c.plan}}:null},
  stretch:{
   action:'stretch',
   score:230,
   build:c=>
    !c.late&&
     !c.focus.running&&
     !c.onBreak&&
     typeof c.activity.active==='number'&&
     Number.isFinite(c.activity.active)&&
     typeof c.activity.offered==='number'&&
     Number.isFinite(c.activity.offered)&&
     c.activity.active-c.activity.offered>=75*60000?
     {key:String(c.activity.session)+':'+c.activity.offered,label:'Stand up and stretch',data:{minutes:5}}:
     null
  },
  inbox:{action:'inbox',score:120,build:c=>c.unread?{key:String(c.unread),label:c.unread+' new announcement'+(c.unread===1?'':'s'),data:{count:c.unread}}:null},
  break:{action:'break',score:260,build:c=>c.completed&&!c.focus.running&&!c.onBreak?{key:String(c.completedAt),label:'Take five minutes',data:{minutes:5,sessionId:c.completedAt}}:null},
  crunch:{action:'plan',score:400,build:c=>c.crunch?{key:c.crunch.crunchDay,label:'Ease the crunch',data:c.crunch}:null,speech:s=>{
   const d=object(s.data);
   return validDay(d.crunchDay)?`${weekday(d.crunchDay)} has ${count(d.count)} things due.`:'';
  }},
  deadline:{
   action:'open',
   score:c=>c.urgent?1100:220,
   build:c=>c.late&&c.next?{key:c.next.id,label:deadlineLabel(c.next.dueAt,c),data:{itemId:c.next.id,dueAt:c.next.dueAt}}:null,
   speech:dueSpeech
  }
 };
 function cleanLearning(value){
  const v=object(value),kinds={},raw=object(v.kinds);
  for(const name of Object.keys(raw))
   if(kindName(name)&&Object.keys(kinds).length<MAX_KINDS){
    const k=object(raw[name]);
    kinds[name]={shown:count(k.shown),used:count(k.used),ignored:count(k.ignored),streak:count(k.streak)};
   }
  const nudges=object(v.nudges),seen=new Set(),items=[];
  for(const id of Array.isArray(nudges.items)?nudges.items:[]){const key=itemId(id);if(key&&!seen.has(key)){seen.add(key);items.push(key);if(items.length>=512)break;}}
  const time=key=>typeof v[key]==='number'&&Number.isFinite(v[key])?Math.max(0,Math.min(8640000000000000,v[key])):0;
  return {kinds,nudges:{day:validDay(nudges.day)?nudges.day:'',count:count(nudges.count),items},hiddenUntil:time('hiddenUntil'),quietUntil:time('quietUntil')};
 }
 function record(learning,kind,event){
  const l=cleanLearning(learning);
  if(!kindName(kind)||!['shown','used','ignored'].includes(event))return l;
  if(!OWN(l.kinds,kind)){if(Object.keys(l.kinds).length>=MAX_KINDS)delete l.kinds[Object.keys(l.kinds)[0]];l.kinds[kind]={shown:0,used:0,ignored:0,streak:0};}
  const k=l.kinds[kind];
  k[event]=Math.min(MAX_COUNT,k[event]+1);
  if(event==='used')k.streak=0;
  if(event==='ignored')k.streak=Math.min(MAX_COUNT,k.streak+1);
  return l;
 }
 const adjustment=k=>k?Math.min(40,k.used*8)-Math.min(120,k.streak*25+k.ignored*2):0;
 function suggestions(c,l){
  const result=[];
  for(const [kind,spec] of Object.entries(KINDS)){
   if(!kindName(kind)||!skillEnabled(kind,c.skills)||!spec||typeof spec.build!=='function')continue;
   const row=spec.build(c);
   if(!row)continue;
   const base=typeof spec.score==='function'?spec.score(c):spec.score;
   result.push({id:`${kind}:${row.key}`,kind,label:row.label,action:spec.action,data:row.data,score:base+adjustment(l.kinds[kind])});
  }
  return result.sort((a,b)=>b.score-a.score||compare(a.id,b.id)).slice(0,3);
 }
 function petSuggestions(snapshot,l){
  const p=object(snapshot.pet),
   name=typeof p.name==='string'&&p.name.trim()?p.name.trim():'Biscuit',
   rows=[['treat','Treat '+name,10],['home','Send '+name+' home',9],['hide','Hide for an hour',8],['settings','Pet settings',7],['quiet','Quiet',6]];
  return rows.filter(([kind])=>(kind!=='treat'||p.treats!==0)&&(kind!=='home'||p.roam!=='home')&&(kind!=='quiet'||p.nudges!=='quiet'&&p.nudges!=='off')).map(([kind,label,score])=>
   ({id:'pet:'+kind,kind,label,action:'pet',data:{action:kind,...(kind==='hide'?{minutes:60}:{})},score:score+adjustment(l.kinds[kind])})).sort((a,b)=>
   b.score-a.score||compare(a.id,b.id)).slice(
   0,
   3);
 }
 function evaluate(snapshot,learning={}){
  const s=object(snapshot),c=context(s),l=cleanLearning(learning),list=suggestions(c,l);
  return {
   mood:c.urgent||c.crunchDays.length?'alert':c.late?'sleepy':!c.open.length||c.completed?'happy':'calm',
   dueToday:c.open.filter(x=>x.dueDay===c.today).length,
   suggestions:list.length?list:s.pet?petSuggestions(s,l):[]
  };
 }
 const nudgeKeys=s=>{
  const d=object(object(s).data);
  return [...new Set([itemId(d.itemId),...(Array.isArray(d.items)?d.items.map(x=>itemId(object(x).id)):[]),validDay(d.crunchDay)?'crunch:'+d.crunchDay:''].filter(Boolean))];
 };
 function canNudge(suggestion,snapshot,learning,{typing=false,dragging=false,hidden=false}={}){
  const c=context(snapshot),l=cleanLearning(learning);
  if(!suggestion||c.focus.running||typing||dragging||hidden||(l.hiddenUntil>c.now||l.quietUntil>c.now))return false;
  const top=suggestions(c,l)[0];
  if(!top||top.id!==suggestion.id||top.kind!==suggestion.kind||l.kinds[top.kind]?.streak>=3)return false;
  const data=object(top.data),
   dueAt=ms(data.dueAt),
   due=dueAt!==null&&dueAt>=c.now&&dueAt-c.now<=3*HOUR,
   crunch=validDay(data.crunchDay)&&data.crunchDay>c.today&&data.crunchDay<=c.horizon;
  if(!(due||crunch||top.kind==='deadline'&&c.late)||c.late&&!due||l.nudges.day===c.today&&l.nudges.count>=3)return false;
  const keys=nudgeKeys(top);
  return !!keys.length&&!keys.some(key=>l.nudges.items.includes(key));
 }
 function markNudge(learning,suggestion,snapshot){
  const l=cleanLearning(learning),c=context(snapshot),keys=nudgeKeys(suggestion);
  if(l.nudges.day!==c.today){l.nudges.day=c.today;l.nudges.count=0;}
  if(keys.length&&!keys.some(key=>l.nudges.items.includes(key))){
   l.nudges.count=Math.min(MAX_COUNT,l.nudges.count+1);
   l.nudges.items.push(...keys);
   l.nudges.items=l.nudges.items.slice(-512);
  }
  return l;
 }
 function speech(suggestion,snapshot){
  const s=object(suggestion),spec=OWN(KINDS,s.kind)?KINDS[s.kind]:null;
  if(spec&&typeof spec.speech==='function')return spec.speech(s,context(snapshot));
  const label=typeof s.label==='string'?s.label.replace(/\s+/g,' ').trim().slice(0,120):'';
  return label?label+(/[.!?]$/.test(label)?'':'.'):'';
 }
 const api={KINDS,SKILLS,cleanSkills,skillEnabled,evaluate,cleanLearning,record,canNudge,markNudge,speech};
 root.ReservePonyBrain=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
