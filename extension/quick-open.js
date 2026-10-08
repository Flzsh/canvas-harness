/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root){
 'use strict';
 const origin=(globalThis.ReserveSite.origin());
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 function safeLink(value,native=false){try{const u=new URL(value,origin);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&(!native||u.origin===origin)?u.href:'';}catch{return '';}}
 // Rows use the page's short course label (normalizeData's shortName; native pages derive
 // the same title). The full Canvas name, code and teacher stay searchable.
 function courseNames(course){
  if(!course)return {short:'',option:'',search:''};
  const split=course.shortName?{title:course.shortName,subject:course.subject,teacher:course.teacher,sub:course.sub}:root.ReserveCore?.courseLabel?.(course.name)||{};
  const short=split.title||course.name||'';
  return {short,option:[short,[split.subject,split.teacher,split.sub].filter(Boolean).join(' · ')].filter(Boolean).join(' — '),search:[...new Set([course.name,course.originalName,course.courseSearch,course.code].filter(Boolean))].join(' ')};
 }
 function entries({courses=[],items=[],pins=[],materials=[]}={}){
  const result=[],seen=new Set(),courseMap=new Map(courses.map(c=>[String(c.id),c])),names=new Map(courses.map(c=>[String(c.id),courseNames(c)]));
  const add=item=>{if(seen.has(item.id))return;seen.add(item.id);result.push(item);};
  for(const [id,label,icon] of [['work','Home','list'],['hub','Course home & updates','home'],['materials','Browse course materials','folder'],['inbox','Messages from class','mail'],['grades','Grades','grades']])add({id:'workspace:'+id,label,detail:'Canvas Harness workspace',kind:'Navigation',icon,action:'workspace',value:id});
  add({id:'planner:week',label:'Planner',detail:'Your week, notes, settings and backups',kind:'Navigation',icon:'calendar',action:'planner',value:'week'});
  for(const [id,label,detail,icon] of [['plan','Plan a reminder','Capture a task with a work date and source link','calendar'],['calculator','Calculator','Desmos graphing and scientific, or offline','calculator']])add({id:'tool:'+id,label,detail,kind:'Tools',icon,action:'tool',value:id});
  for(const [id,label,icon] of [['calendar','Canvas calendar','calendar'],['conversations','Canvas Inbox','mail'],['grades','Canvas gradebooks','grades']])add({id:'canvas:'+id,label,detail:'Open original Canvas',kind:'Navigation',icon,url:origin+'/'+id});
  for(const course of courses){const id=String(course.id);if(!/^\d+$/.test(id))continue;
   for(const [route,label,icon] of [['','Course home','home'],['modules','Modules','book'],['assignments','Assignments','list'],['grades','Gradebook','grades']])add({id:'course:'+id+':'+route,label:names.get(id).short+(route?' · '+label:''),detail:route?'Canvas course '+label.toLowerCase():'Canvas course home',searchText:names.get(id).search,kind:'Courses',courseId:id,icon,url:origin+'/courses/'+id+(route?'/'+route:'')});
  }
  for(const item of items){const courseId=String(item.courseId),course=courseMap.get(courseId);
   if(item.personal&&/^local-[\w-]+$/.test(item.id)&&(course||courseId==='personal')){add({id:'personal:'+item.id,label:item.name,detail:names.get(courseId)?.short||'Personal task',searchText:[item.source?.title,names.get(courseId)?.search].filter(Boolean).join(' '),kind:'Personal tasks',icon:'note',action:'plan',value:item.id,courseId,dueAt:item.dueAt,done:!!item.done});continue;}
   if(!course)continue;
   const url=safeLink(item.url||origin+'/courses/'+courseId+'/assignments/'+item.id,true);if(!url)continue;
   add({id:'assignment:'+item.id,label:item.name,detail:names.get(courseId).short,searchText:names.get(courseId).search,kind:'Assignments',courseId,icon:'list',url,assignmentId:String(item.id),dueAt:item.dueAt,done:!!item.done});
  }
  for(const item of [...pins.map(p=>({...p,saved:true})),...materials]){
   const courseId=String(item.courseId),course=courseMap.get(courseId);if(!course)continue;
   const module=String(item.id).match(/^module:\d+:(\d+)$/);
   const url=safeLink(module?origin+'/courses/'+courseId+'/modules/items/'+module[1]:item.url);if(!url)continue;
   // Teacher materials read by their clean title (material-model.js displayTitle); the file name stays searchable.
   const label=root.ReserveMaterials?.displayTitle?.(item.title)||item.title;
   add({id:'resource:'+courseId+':'+item.id,label,detail:names.get(courseId).short+' · '+(item.category||'Material')+(item.locked?' · Locked in Canvas':''),searchText:names.get(courseId).search+(label!==item.title?' '+item.title:''),kind:item.saved?'Saved links':'Materials',courseId,icon:'folder',url,saved:!!item.saved});
  }
  return result;
 }
 function search(pool,query,{limit=40,courseId='all',recent=[]}={}){
  const q=normalize(String(query).slice(0,240)),words=q.split(' ').filter(Boolean),recents=new Map(recent.map((id,i)=>[id,i]));
  const matches=[];
  for(const entry of pool){const title=normalize(entry.label),text=title+' '+normalize(entry.detail+' '+entry.kind+' '+(entry.searchText||''));if(!words.every(word=>text.includes(word)))continue;
   let score=q?(title===q?1000:title.startsWith(q)?500:0)+words.filter(w=>title.includes(w)).length*40:0;
   if(courseId!=='all'&&entry.courseId===String(courseId))score+=20;if(entry.saved)score+=12;
   if(recents.has(entry.id))score+=q?Math.max(0,8-recents.get(entry.id)):200-recents.get(entry.id);
   matches.push({...entry,score});
  }
  return matches.sort((a,b)=>b.score-a.score||String(a.label).localeCompare(String(b.label))).slice(0,Math.max(1,Math.min(100,limit)));
 }
 const SCHEDULE=/schedule|cycle sheet|daily syllabus/i;
 // An empty query leads with what a student returns to, then general navigation.
 function suggest(pool,{recent=[],courseId='all',now=Date.now(),limit=50}={}){
  const out=[],seen=new Set(),byId=new Map(pool.map(x=>[x.id,x])),here=x=>courseId!=='all'&&x.courseId===String(courseId)?0:1,due=x=>Date.parse(x.dueAt);
  const take=(group,rows,max)=>{for(const entry of rows){if(out.length>=limit||max<=0)return;if(seen.has(entry.id))continue;seen.add(entry.id);out.push({...entry,group});max--;}};
  take('Saved',pool.filter(x=>x.saved).sort((a,b)=>here(a)-here(b)),12);
  take('Schedules',pool.filter(x=>x.kind==='Materials'&&SCHEDULE.test(x.label+' '+x.detail)).sort((a,b)=>here(a)-here(b)),8);
  take('Recent',recent.map(id=>byId.get(id)).filter(Boolean),6);
  take('Due soon',pool.filter(x=>x.dueAt&&!x.done&&due(x)>=now-7*864e5&&due(x)<=now+14*864e5).sort((a,b)=>due(a)-due(b)),8);
  // Canvas Harness places, then the current course, then original Canvas pages; tools are already tabs.
  take('Go to',pool.filter(x=>x.kind==='Navigation'||x.kind==='Courses'&&x.courseId===String(courseId)).sort((a,b)=>(a.action?0:a.courseId?1:2)-(b.action?0:b.courseId?1:2)),20);
  return out;
 }
 root.ReserveQuickOpen={entries,search,suggest,safeLink,courseNames};if(typeof module!=='undefined'&&module.exports)module.exports=root.ReserveQuickOpen;
})(globalThis);
