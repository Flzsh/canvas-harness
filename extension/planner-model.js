/* Canvas Harness planner: the rules, with no drawing in them. A plan is a day chosen for a piece of work: Canvas
   assignments and the student's own tasks alike. Nothing here reads or changes Canvas. Creator: Flzsh. */
(function(root){
 'use strict';
 const DAY=/^\d{4}-\d{2}-\d{2}$/,WEEKDAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const pad=n=>String(n).padStart(2,'0');
 const addDays=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const weekdayOf=day=>new Date(day+'T12:00:00Z').getUTCDay();
 const mondayOf=day=>addDays(day,-((weekdayOf(day)+6)%7));
 const week=(day,offset=0)=>{const start=addDays(mondayOf(day),offset*7);return Array.from({length:7},(_,i)=>addDays(start,i));};
 const minutes=n=>!n?'':n<60?`${n} min`:n%60?`${Math.floor(n/60)} h ${n%60} min`:`${n/60} h`;

 // "Read chapter 3 fri 45m #chem" -> a name, a day, a length and a course hint. Words that are not recognised stay in the name.
 function parseQuick(text,today){
  const out={name:'',day:'',estimate:0,course:''};let s=' '+String(text||'').replace(/\s+/g,' ').trim()+' ';
  const take=(re,fn)=>{const m=re.exec(s);if(!m)return false;if(fn(m)===false)return false;s=s.slice(0,m.index)+' '+s.slice(m.index+m[0].length);return true;};
  take(/\s#([\p{L}\p{N}][\p{L}\p{N}_-]*)(?=\s)/u,m=>{out.course=m[1].toLowerCase();});
  take(/\s(\d+(?:\.\d+)?)\s?(h|hr|hrs|hour|hours)(?:\s?(\d{1,2})\s?(?:m|min|mins))?(?=\s)/i,m=>{out.estimate=Math.round(parseFloat(m[1])*60)+(m[3]?parseInt(m[3],10):0);})||
  take(/\s(\d{1,3})\s?(m|min|mins|minutes)(?=\s)/i,m=>{out.estimate=parseInt(m[1],10);});
  out.estimate=Math.max(0,Math.min(1440,out.estimate||0));
  if(DAY.test(today||'')){
   take(/\s(today|tonight)(?=\s)/i,()=>{out.day=today;})||
   take(/\s(tomorrow|tmr|tmrw)(?=\s)/i,()=>{out.day=addDays(today,1);})||
   // A weekday is only a date when it ends the text or follows on/by/this/next ("a sun hat" stays a sun hat).
   (()=>{const re=/\s(?:(on|by|this|next)\s)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?(?=\s)/gi;let m;
    while((m=re.exec(s))){
     if(!m[1]&&s.slice(m.index+m[0].length).trim()){re.lastIndex=m.index+1;continue;}
     const want=WEEKDAYS.findIndex(w=>w.startsWith(m[2].toLowerCase().slice(0,3)));
     let ahead=(want-weekdayOf(today)+7)%7;if(ahead===0||/^next$/i.test(m[1]||''))ahead+=7;
     out.day=addDays(today,ahead);s=s.slice(0,m.index)+' '+s.slice(m.index+m[0].length);return true;}
    return false;})()||
   take(/\s(?:on\s)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i,m=>{
    const mo=MONTHS.findIndex(x=>x.startsWith(m[1].toLowerCase().slice(0,3))),d=parseInt(m[2],10);return setMonthDay(out,today,mo,d);})||
   take(/\s(?:on\s)?(\d{1,2})\/(\d{1,2})(?=\s)/,m=>setMonthDay(out,today,parseInt(m[1],10)-1,parseInt(m[2],10)));
  }
  out.name=s.replace(/\s+/g,' ').trim().slice(0,200);
  return out;
 }
 function setMonthDay(out,today,month,day){
  if(month<0||month>11||day<1||day>31)return false;
  let year=parseInt(today.slice(0,4),10),key=`${year}-${pad(month+1)}-${pad(day)}`;
  if(new Date(key+'T00:00:00Z').toISOString().slice(0,10)!==key)return false;
  if(key<today)key=`${year+1}-${pad(month+1)}-${pad(day)}`;   // a date already past means next year's
  out.day=key;return true;
 }
 // Which course a "#hint" means: a whole word of the name or code first, then the start of a word.
 function matchCourse(hint,courses){
  if(!hint)return null;const h=hint.toLowerCase(),norm=v=>String(v||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(' ').filter(Boolean);
  const words=c=>[...norm(c.shortName),...norm(c.name),...norm(c.code)];
  return courses.find(c=>words(c).includes(h))||courses.find(c=>words(c).some(w=>w.startsWith(h)))||courses.find(c=>words(c).join('').includes(h))||null;
 }

 // One list of everything that can be planned. `items` are the workspace's normalised assignments and personal
 // tasks; `local` is the student's own record for each (planned day, done, length, steps).
 function entries(items,local={},{dayOf,isDone=()=>false}={}){
  return items.map(item=>{
   const mine=local[item.id]||{},steps=Array.isArray(mine.checklist)?mine.checklist:[];
   return {id:String(item.id),title:item.name,courseId:String(item.courseId),course:item.courseName||'',color:item.courseColor||item.color||'',personal:!!item.personal,url:item.url||'',
    dueAt:item.dueAt||null,dueDay:item.dueAt&&dayOf?dayOf(item.dueAt):'',planned:DAY.test(mine.plannedDate||'')?mine.plannedDate:'',estimate:Number.isFinite(mine.estimate)?mine.estimate:0,
    done:!!isDone(item,mine),steps:steps.length,stepsDone:steps.filter(s=>s.done).length,pinned:mine.pinned===true,missing:!!item.missing,points:item.points??null};
  });
 }
 const byDue=(a,b)=>(a.dueAt?Date.parse(a.dueAt):Infinity)-(b.dueAt?Date.parse(b.dueAt):Infinity)||a.title.localeCompare(b.title);
 // A day of the plan: what the student put there, then what is due that day and was not planned for another day.
 function day(list,key){
  const planned=list.filter(e=>e.planned===key).sort((a,b)=>a.done-b.done||byDue(a,b));
  const due=list.filter(e=>!e.planned&&e.dueDay===key).sort((a,b)=>a.done-b.done||byDue(a,b));
  const all=[...planned,...due],open=all.filter(e=>!e.done);
  return {key,planned,due,all,open:open.length,done:all.length-open.length,minutes:open.reduce((n,e)=>n+e.estimate,0)};
 }
 function board(list,today,offset=0){
  const days=week(today,offset).map(key=>day(list,key));
  // Waiting for a day: open work due within the next two weeks (or overdue) that has not been given one.
  const horizon=addDays(today,14),waiting=list.filter(e=>!e.done&&!e.planned&&e.dueDay&&e.dueDay<=horizon&&!days.some(d=>d.key===e.dueDay)).sort(byDue);
  const overdue=list.filter(e=>!e.done&&(e.planned&&e.planned<today||!e.planned&&e.dueDay&&e.dueDay<today)).sort(byDue);
  const someday=list.filter(e=>!e.done&&!e.planned&&!e.dueDay&&e.personal).sort((a,b)=>a.title.localeCompare(b.title));
  return {days,waiting:waiting.filter(e=>!overdue.includes(e)),overdue,someday,today};
 }
 // Changes, written as functions over the saved task record so the store can apply them in one transaction.
 const record=(tasks,id)=>tasks[id]||(tasks[id]={pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:0,plannedDate:'',checklist:[]});
 const plan=(id,dayKey)=>data=>{if(dayKey&&!DAY.test(dayKey))return;record(data.tasks,id).plannedDate=dayKey||'';};
 const estimate=(id,n)=>data=>{record(data.tasks,id).estimate=Math.max(0,Math.min(1440,Math.round(n)||0));};
 const carryOver=(today,ids)=>data=>{for(const id of ids){const r=data.tasks[id];if(r&&r.plannedDate&&r.plannedDate<today&&r.progress!=='done'&&!r.checkedOff)r.plannedDate=today;}};
 function addTask(parsed,{courseId='personal',id,nowISO}){
  return data=>{
   if(!parsed.name)return;
   data.customTasks.push({id,name:parsed.name,courseId,dueAt:null,createdAt:nowISO});
   const r=record(data.tasks,id);r.plannedDate=parsed.day||'';r.estimate=parsed.estimate||0;
  };
 }
 const api={addDays,weekdayOf,mondayOf,week,minutes,parseQuick,matchCourse,entries,day,board,plan,estimate,carryOver,addTask};
 root.ReservePlanner=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
