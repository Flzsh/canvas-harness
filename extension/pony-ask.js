/* Local schedule parsing and injected account-store claims; no Canvas or provider access. */
(function(root){
 'use strict';
 const MIN=60000,DAY=86400000,FALLBACK='I can open, focus, plan, remind or take a break.',DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{},
  text=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240):'',
  id=v=>typeof v==='string'&&v.length<=80&&v.trim()&&!/[\u0000-\u001f\u007f]/.test(v)&&!['__proto__','prototype','constructor'].includes(v)?v:'',
  stamp=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=8640000000000000;
 const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const addDays=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*DAY).toISOString().slice(0,10),weekday=day=>new Date(day+'T12:00:00Z').getUTCDay();
 const Clock=root.CanvasHarnessAgentClock||(typeof module==='object'&&module.exports?require('./agent-clock.js'):null),calendar=Clock.calendar,wall=Clock.wall;
 function clockTime(value){
  const m=String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if(!m)return null;
  let h=Number(m[1]),minute=Number(m[2]||0);
  if(minute>59||m[3]&&(h<1||h>12)||!m[3]&&h>23)return null;
  if(m[3])h=h%12+(/pm/i.test(m[3])?12:0);
  return {minute:h*60+minute,bare:!m[2]&&!m[3]&&h>=1&&h<=12};
 }
 function time(input,snapshot){
  const s=object(snapshot),now=s.now;
  if(!stamp(now))return null;
  const v=text(input).toLowerCase(),local=calendar(s.timeZone),p=local(now),relative=v.match(/\bin\s+(?:(\d+)\s*(min(?:ute)?s?|h(?:ou)?rs?)|(an?|one)\s+hour)\b/);
  if(relative){const n=relative[3]?60:Number(relative[1])*(/^h/.test(relative[2])?60:1);return n>0&&n<=525600?now+n*MIN:null;}
  const name=DAYS.find(d=>new RegExp('\\b'+d+'\\b').test(v)),
   tomorrow=/\btomorrow\b/.test(v),
   tonight=/\btonight\b/.test(v),
   clock=v.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?![\w:])/i)||v.match(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i),
   c=clock?clockTime(clock[1]):null;
  if(clock&&!c||!clock&&!name&&!tomorrow&&!tonight)return null;
  let day=tomorrow?addDays(p.day,1):name?addDays(p.day,((DAYS.indexOf(name)-weekday(p.day)+7)%7)||7):p.day,minute=c?.minute??(tonight?1140:480);
  if(c?.bare){if(tonight||!tomorrow&&!name&&p.minute>=720&&c.minute<p.minute)minute=c.minute%720+720;else minute=c.minute;}
  let at=wall(day,minute,s.timeZone,now);
  if(at===null&&!tomorrow&&!name&&!tonight){day=addDays(day,1);if(c?.bare&&p.minute>=minute)minute=c.minute%720;at=wall(day,minute,s.timeZone,now);}
  return at;
 }
 const tokens=v=>text(v).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').split(' ').filter(w=>w&&!['the','a','an','my','on','for','please'].includes(w));
 function rows(snapshot){
  const map=new Map(),fields=['title','name','course','courseName','done','dueAt','dueDay','planned','estimate'];
  for(const list of [snapshot.assignments,snapshot.planner])
   for(const v of Array.isArray(list)?list:[]){
    if(!v||!(typeof v.id==='string'||typeof v.id==='number'&&Number.isFinite(v.id))||!String(v.id).trim()||String(v.id).length>256||/[\u0000-\u001f\u007f]/.test(String(v.id)))continue;
    const row=map.get(String(v.id))||{id:String(v.id)};
    for(const key of fields)if(v[key]!==undefined)row[key]=v[key];
    map.set(row.id,row);
   }
  return [...map.values()].filter(v=>v.done!==true);
 }
 function match(query,snapshot){
  const q=[...new Set(tokens(query))];
  if(!q.length)return [];
  return rows(snapshot).map(v=>{
   const words=tokens([v.title||v.name,v.course||v.courseName].filter(Boolean).join(' ')),
    overlap=q.filter(w=>words.some(t=>w===t||Math.min(w.length,t.length)>=3&&(w.startsWith(t)||t.startsWith(w)))).length;
   return {...v,score:overlap/q.length};
  }).filter(v=>v.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).filter((v,_i,all)=>v.score===all[0].score).slice(0,3);
 }
 const nearest=(n,allowed)=>allowed.reduce((best,v)=>Math.abs(v-n)<Math.abs(best-n)?v:best,allowed[0]);
 function duration(value,allowed,fallback){
  const v=value.toLowerCase(),m=v.match(/\b(\d+)\s*(h(?:ou)?rs?|min(?:ute)?s?)?\b/);
  return nearest(/\b(?:an?|one) hour\b/.test(v)?60:m?Number(m[1])*(/^h/.test(m[2]||'')?60:1):fallback,allowed);
 }
 function buildPlan(mode,snapshot){
  const s=object(snapshot);
  if(!stamp(s.now))return {mode,day:'',items:[]};
  const local=calendar(s.timeZone),
   p=local(s.now),
   start=mode==='tomorrow'?addDays(p.day,1):p.day,
   days=Array.from({length:mode==='week'?7:1},(_,i)=>addDays(start,i)),
   all=rows(s).map(v=>
    ({
     ...v,
     due:typeof v.dueAt==='number'?v.dueAt:Date.parse(v.dueAt),
     estimate:typeof v.estimate==='number'&&Number.isFinite(v.estimate)&&v.estimate>0?Math.min(1440,Math.ceil(v.estimate)):25
    })).map(v=>
    ({...v,dueDay:Number.isFinite(v.due)?local(v.due).day:validDay(v.dueDay)?v.dueDay:''})),
   loads=new Map(days.map(day=>[day,all.filter(v=>v.planned===day).reduce((n,v)=>n+v.estimate,0)])),
   begins=day=>day===p.day?Math.max(1080,p.minute+(p.second?1:0)):1080,
   horizon=mode==='week'?addDays(p.day,7):addDays(start,3),
   items=[];
  const eligible=all.filter(v=>!v.planned&&v.dueDay>=start&&v.dueDay<=horizon&&(!Number.isFinite(v.due)||v.due>=s.now)).sort((a,b)=>
   a.dueDay.localeCompare(b.dueDay)||(a.due||Infinity)-(b.due||Infinity)||a.estimate-b.estimate||a.id.localeCompare(b.id));
  for(const v of eligible){
   const candidates=days.filter(day=>
    day<=v.dueDay&&begins(day)+loads.get(day)+v.estimate<=Math.min(1320,day===v.dueDay&&Number.isFinite(v.due)?local(v.due).minute:1320)).sort((a,b)=>
    loads.get(a)-loads.get(b)||a.localeCompare(b)),
    day=candidates[0];
   if(!day)continue;
   items.push({id:v.id,estimate:v.estimate,day});
   loads.set(day,loads.get(day)+v.estimate);
  }
  return {mode,day:start,items};
 }
 function reminder(input,snapshot){
  const at=time(input,snapshot);
  if(at===null)return null;
  const message=text(input.replace(/^remind\s+me\s*/i,'').replace(/\bin\s+(?:\d+\s*(?:min(?:ute)?s?|h(?:ou)?rs?)|(?:an?|one)\s+hour)\b/ig,'').replace(/\b(?:tomorrow|tonight|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig,'').replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/ig,'').replace(
   /\b(?:\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm))\b/ig,
   '').replace(
   /^\s*to\s+/i,
   ''))||
   'Start';
  return {action:'remind',data:{text:message,at},label:message};
 }
 const INTENTS=[
  {name:'routine',patterns:[/^every\s+/i],action:(v,s)=>routine(v,s)},
  {name:'open',patterns:[/^(?:open|find)\b/i],action:(v,s)=>{
   const found=match(v.replace(/^(?:open|find)\s*/i,''),s);
   return found.length?
    {action:'open',data:{itemId:found[0].id},choices:found.map(x=>({action:'open',label:x.title||x.name||x.course||x.courseName||x.id,data:{itemId:x.id}}))}:
    null;
  }},
  {name:'focus',patterns:[/^(?:focus|study)\b/i],action:(v,s)=>{
   const query=v.replace(/^(?:focus|study)\s*/i,'').replace(/\b(?:for|on|an?|one|hour|hours|min|mins|minutes?)\b/ig,'').replace(/\d+/g,'').trim(),
    found=match(query,s),
    minutes=duration(v,[15,25,45,60],25);
   return {action:'focus',label:`Focus ${minutes} min`,data:{minutes,explicit:true,...(found[0]?{itemId:found[0].id}:{})}};
  }},
  {name:'break',patterns:[/^(?:take\s+(?:a\s+)?)?break\b/i],action:v=>{const minutes=duration(v,[5,10,15],5);return {action:'break',label:`Break ${minutes} min`,data:{minutes,explicit:true}};}},
  {name:'plan',patterns:[/^plan(?:\s+(?:(?:my|the)\s+)?(?:tonight|week|tomorrow))?\s*$/i],action:(v,s)=>{
   const mode=/week/i.test(v)?'week':/tomorrow/i.test(v)?'tomorrow':'tonight';
   return {action:'plan',label:`Plan ${mode==='week'?'my week':mode}`,data:buildPlan(mode,s)};
  }},
  {name:'remind',patterns:[/^remind\s+me\b/i],action:(v,s)=>reminder(v,s)}
 ];
 function parse(input,snapshot={}){
  snapshot=object(snapshot);
  const v=text(input);
  if(!v)return {action:'fallback',message:FALLBACK};
  const P=root.ReserveBiscuitParse,installed=P?.installed?.(v,snapshot);
  if(installed!==null&&installed!==undefined){
   const choices=installed.map(row=>({action:'installed',data:row.fields,label:row.preview}));
   return choices.length?{...choices[0],intent:'installed',...(choices.length>1?{choices}:{})}:{action:'fallback',message:'No matching installed choice. Check your installed packs.'};
  }
  for(const spec of INTENTS)if(spec.patterns.some(p=>p.test(v))){const result=spec.action(v,snapshot);if(result)return {...result,intent:spec.name};break;}
  return {action:'fallback',message:FALLBACK};
 }
 function routine(input,snapshot){
  const v=text(input),m=v.match(/^every\s+(weekday|day|night|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b\s*(.*)$/i);
  if(!m)return null;
  const period=m[1].toLowerCase(),rest=m[2],clock=rest.match(/^(?:at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)|\b(morning|afternoon|evening|night))\s*/i),c=clock?.[1]?clockTime(clock[1]):null;
  if(clock?.[1]&&!c)return null;
  const minute=c?c.bare&&period==='night'?c.minute%720+720:c.minute:({morning:480,afternoon:960,evening:1140,night:1320}[clock?.[2]?.toLowerCase()]??(period==='night'?1320:480)),
   actionText=rest.slice(clock?.[0]?.length||0),
   spec=INTENTS.find(i=>i.name!=='routine'&&i.patterns.some(p=>p.test(actionText)));
  if(!spec||!['focus','break','plan','remind'].includes(spec.name))return null;
  const parsed=spec.name==='remind'?{action:'remind',data:{text:text(actionText.replace(/^remind\s+me\s+(?:to\s+)?/i,''))}}:spec.action(actionText,snapshot);
  if(!parsed||parsed.action==='remind'&&!parsed.data.text)return null;
  const data=parsed.action==='plan'?{mode:parsed.data.mode}:parsed.action==='remind'?parsed.data:{minutes:parsed.data.minutes},
   days=period==='weekday'?[1,2,3,4,5]:['day','night'].includes(period)?[0,1,2,3,4,5,6]:[DAYS.indexOf(period)];
  return {action:'routine',label:v,data:{name:v,days,minute,action:parsed.action,data}};
 }
 function cleanReminders(value,now){
  const seen=new Set(),out=[];
  for(const raw of Array.isArray(value)?value:[]){
   const v=Object.fromEntries(Object.entries(object(raw)));
   if(out.length>=20)break;
   if(!id(v?.id)||seen.has(v.id)||!text(v.text)||!stamp(v.at)||!stamp(v.createdAt)||v.at<now-DAY)continue;
   seen.add(v.id);
   out.push({
    id:v.id,
    text:text(v.text),
    at:v.at,
    createdAt:v.createdAt,
    ...(typeof v.delivered==='string'&&stamp(Number(v.delivered))&&String(Number(v.delivered))===v.delivered?{delivered:v.delivered}:{})
   });
  }
  return out;
 }
 function cleanRoutines(value){
  const seen=new Set(),out=[];
  for(const raw of Array.isArray(value)?value:[]){
   const v=Object.fromEntries(Object.entries(object(raw)));
   if(out.length>=20)break;
   if(!id(v?.id)||seen.has(v.id)||!text(v.name)||!stamp(v.createdAt)||!Number.isInteger(v.minute)||v.minute<0||v.minute>=1440)continue;
   const days=[...new Set((Array.isArray(v.days)?v.days:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))],
    d=Object.fromEntries(Object.entries(object(v.data))),
    data={
     focus:()=>[15,25,45,60].includes(d.minutes)?{minutes:d.minutes}:null,
     break:()=>[5,10,15].includes(d.minutes)?{minutes:d.minutes}:null,
     plan:()=>['tonight','tomorrow','week'].includes(d.mode)?{mode:d.mode}:null,
     remind:()=>text(d.text)?{text:text(d.text)}:null
    };
   if(!days.length||!Object.hasOwn(data,v.action))continue;
   const clean=data[v.action]();
   if(!clean)continue;
   seen.add(v.id);
   out.push({id:v.id,name:text(v.name),days,minute:v.minute,action:v.action,data:clean,createdAt:v.createdAt,last:validDay(v.last)?v.last:''});
  }
  return out;
 }
 function due(pet,snapshot,state={}){
  const s=object(snapshot),p=object(pet),now=s.now,B=root.ReservePonyBrain,local=calendar(s.timeZone),clock=stamp(now)?local(now):null;
  if(!clock)return null;
  if(p.skills?.reminders===false||s.focus?.running||state.typing||state.dragging||state.hidden||(p.brain?.hiddenUntil>now||p.brain?.quietUntil>now))return null;
  const reminder=cleanReminders(p.reminders,now).filter(v=>
   v.at<=now&&v.delivered!==String(v.at)&&!(Array.isArray(state.seen)&&state.seen.includes(JSON.stringify(['reminder',v.id,String(v.at)])))).sort((a,b)=>
   a.at-b.at)[0];
  if(reminder)return {type:'reminder',id:reminder.id,occurrence:String(reminder.at),label:reminder.text,action:'remind',data:{text:reminder.text}};
  if(p.nudges!=='helpful')return null;
  for(const r of cleanRoutines(p.routines)){
   const at=wall(clock.day,r.minute,s.timeZone),isReminder=r.action==='remind',kind={focus:'focus',break:'break',plan:'plan',remind:'reminder'}[r.action];
   if(at===null||
    at>now||
    at<r.createdAt||
    !r.days.includes(weekday(clock.day))||
    r.last>=clock.day||
    !isReminder&&p.skills?.night!==false&&(clock.minute>=1320||clock.minute<420)||
    B?.skillEnabled&&!B.skillEnabled(kind,p.skills)||
    !isReminder&&p.brain?.nudges?.day===clock.day&&p.brain.nudges.count>=3)
    continue;
   return {
    type:'routine',
    id:r.id,
    occurrence:clock.day,
    label:r.name,
    action:r.action,
    data:r.action==='plan'?buildPlan(r.data.mode,s):{...r.data,...(!isReminder?{explicit:true}:{})}
   };
  }
  return null;
 }
 function markOffer(pet,offer,snapshot){
  const reminder=offer.type==='reminder'?cleanReminders(pet.reminders,0).find(r=>r.id===offer.id&&String(r.at)===offer.occurrence):null;
  if(offer.type==='reminder')
   return !reminder||reminder.delivered===offer.occurrence?
    pet:
    {...pet,reminders:cleanReminders(pet.reminders,0).map(r=>r.id===reminder.id?{...r,delivered:offer.occurrence}:r)};
  if(offer.type!=='routine'||!validDay(offer.occurrence)||!cleanRoutines(pet.routines).some(r=>r.id===offer.id&&r.last<offer.occurrence))return pet;
  const routines=cleanRoutines(pet.routines).map(r=>r.id===offer.id?{...r,last:offer.occurrence}:r),brain={...pet.brain,nudges:{...pet.brain?.nudges}};
  if(offer.action!=='remind'){
   if(brain.nudges.day!==offer.occurrence)brain.nudges={...brain.nudges,day:offer.occurrence,count:0};
   brain.nudges.count=Math.min(3,(brain.nudges.count||0)+1);
  }
  return {...pet,routines,brain};
 }
 async function claimOffer(store,offer,snapshot,state={}){
  let claimed=null;
  const saved=await store.update(data=>{
   claimed=null;
   const pet=object(data.pet),
    snap={...snapshot,focus:{...snapshot.focus,running:Boolean(data.focus?.endsAt)||snapshot.focus?.running===true}},
    current=due(pet,snap,state);
   if(!current||current.type!==offer.type||current.id!==offer.id||current.occurrence!==offer.occurrence)return;
   const next=markOffer(pet,current,snap);
   if(next===pet)return;
   data.pet=next;
   claimed=next;
  },{retry:false});
  return claimed?(saved?.pet||claimed):null;
 }
 const api={INTENTS,FALLBACK,parse,match,time,calendar,wall,buildPlan,cleanReminders,cleanRoutines,due,markOffer,claimOffer};
 root.ReservePonyAsk=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
