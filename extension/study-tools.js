/* Click-only study tools. Model output is data; the live Biscuit handlers own execution. */
(function(root){
 'use strict';
 // These are existing controls in docs/BISCUIT-R5-INVENTORY.json, not model-defined actions.
 const IDS=Object.freeze({
   focus:'button:widgets.js:timer-toggle:25180bd7',
   focusControl:'button:widgets.js:focus-control:6c0294b1',
   focusReset:'button:widgets.js:timer-reset:a3fd7f71',
   reminder:'button:dashboard-view.js:capture:f5f3cf73',
   plan:'button:toolbox.js:button:b4f63a52',
   planner:'workspace:plan',
   tomorrow:'button:dashboard-view.js:schedule:2caa8063',
   practice:'button:pets.js:suggestion:35986b6e',
   material:'button:materials-ui.js:material-read:6b195293',
   canvas:'button:dashboard-view.js:preview:f12a328a',
   copy:'button:study-ui.js:copy-message:154358af',
   inbox:'workspace:inbox'
 });
 const FEATURE_IDS=Object.freeze(['dashboard','planner','grades','materials','course-hub','course-files','math','gpa','tools','customization','scene-themes','arrange','course-art','quick-pack','pony','motion','canvas-nav','course-nav','native-appearance','pdf','ai','play','biscuit-more-rules','focus-room','review-deck','grade-impact']);
 const PROMPT=[
  'Tools: {id,args,label:1-4 words}, max 3. Exact IDs/args:',
  IDS.focus+' {action:"start"|"pause"|"resume",minutes?:1..240,courseId?,itemId?}',
  IDS.focusControl+' {action:"pause"|"resume"|"stop"|"adjust",minutes?:nonzero -240..240}',
  IDS.focusReset+' {}',
  IDS.reminder+' {title,at:future epoch-ms or ISO with zone,courseId?}',
  IDS.plan+' {title,day:"YYYY-MM-DD",minutes:integer 1..1440,itemId?,courseId?,time?:"HH:MM"}',
  IDS.planner+' {}',
  IDS.tomorrow+' {itemId,courseId?}',
  IDS.practice+' {action:"practice",itemId,courseId?} or {action:"review"|"review-tomorrow",aidKey,courseId?,at?:future epoch-ms or ISO}',
  IDS.material+' {sourceId,courseId?}',
  IDS.canvas+' {sourceId,courseId?} or {itemId,courseId?}',
  IDS.copy+' {text:1..12000 chars}',
  IDS.inbox+' {}',
  'feature:<'+FEATURE_IDS.join('|')+'> {on:boolean}'
 ].join('\n');
 const list=value=>Array.isArray(value)?value:[],
   own=(value,key)=>Object.hasOwn(value,key),
   plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.prototype.toString.call(value)==='[object Object]';
 const safeObject=value=>
   plain(value)&&
     Object.keys(value).length<=12&&
     Reflect.ownKeys(value).every(key=>
       typeof key==='string'&&
         !['__proto__','prototype','constructor'].includes(key)&&
         !!Object.getOwnPropertyDescriptor(value,key)?.enumerable&&
         !Object.getOwnPropertyDescriptor(value,key)?.get&&
         !Object.getOwnPropertyDescriptor(value,key)?.set);
 const stringId=value=>
   (typeof value==='string'||typeof value==='number'&&Number.isFinite(value))&&
     String(value).trim()&&
     String(value).length<=512&&
     !/[\u0000-\u001f\u007f|]/.test(String(value))&&
     !['__proto__','prototype','constructor'].includes(String(value))?
     String(value):
     '';
 const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
 const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 const identity=c=>({origin:c?.owner?.origin||c?.origin||'',accountId:stringId(c?.owner?.accountId??c?.accountId??c?.user?.id)});
 function scopeOwner(scopeKey){
   try{
     if(typeof scopeKey!=='string'||scopeKey.length>65536)return null;
     const [origin,accountId]=scopeKey.split('|'),u=new URL(origin);
     return u.protocol==='https:'&&u.origin===origin&&stringId(accountId)?{origin,accountId}:null;
   }catch{return null;}
 }
 function matchesOwner(c,owner,required=false){
   const id=identity(c);
   return !!owner&&(!required||!!id.origin&&!!id.accountId)&&(!id.origin||id.origin===owner.origin)&&(!id.accountId||id.accountId===owner.accountId);
 }
 function ownedRow(row,c){
   const expected=identity(c),actual=identity(row);
   return (!actual.origin||!expected.origin||actual.origin===expected.origin)&&
     (!actual.accountId||!expected.accountId||actual.accountId===expected.accountId)&&
     !row?.locked&&
     !row?.locked_for_user&&
     !row?.hidden_for_user&&
     !row?.gradeAccess;
 }
 function courses(c){return Array.isArray(c.courses)?c.courses:null;}
 function items(c){for(const key of ['items','assignments','workItems'])if(Array.isArray(c[key]))return c[key];return null;}
 function catalogue(c){for(const key of ['featureCatalogue','features'])if(Array.isArray(c[key]))return c[key];return null;}
 function stamp(value){
  if(typeof value==='number')return Number.isSafeInteger(value)&&value>0&&value<=8640000000000000?value:null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value))return null;
  const day=Date.parse(value.slice(0,10)+'T00:00:00Z'),at=Date.parse(value);
  return Number.isFinite(day)&&new Date(day).toISOString().slice(0,10)===value.slice(0,10)&&Number.isFinite(at)&&at>0?at:null;
 }
 function sourceURL(source,c){
  if(!source||!ownedRow(source,c)||!['page','home','syllabus','file','link','material','module','assignment','discussion','announcement'].includes(source.kind))return '';
  try{
   const origin=identity(c).origin,url=new URL(source.url||source.html_url,origin||undefined);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return '';
   if(origin&&url.origin===origin){
    const path=decodeURIComponent(url.pathname),course=path.match(/^\/courses\/([^/]+)(?:\/|$)/);
    if(course&&String(source.courseId)!==course[1]||/\/(?:edit|new|delete|destroy|submissions?|submit|take|resume)(?:\/|$)/i.test(path))return '';
    if(!/^\/courses\/\d+\/?$/.test(path)&&!/^\/courses\/\d+\/(?:assignments\/(?:\d+|syllabus)|pages\/[^/]+|files\/\d+(?:\/download|\/preview)?|modules(?:\/\d+)?|discussion_topics\/\d+|announcements\/\d+)\/?$/.test(path)&&!/^\/files\/\d+(?:\/download|\/preview)?\/?$/.test(path))return '';
   }else if(!['file','link','material'].includes(source.kind))return '';
   url.hash='';return url.href;
  }catch{return '';}
 }
 function courseAllowed(id,c,strict){
  if(!id)return !strict;const rows=courses(c),current=stringId(c.courseId);
  return (!current||current==='all'||current===id)&&(!rows?!strict:rows.some(row=>String(row.id)===id&&ownedRow(row,c)));
 }
 function findItem(args,c,strict){
  const rows=items(c);if(!rows)return !strict;
  const matches=rows.filter(row=>
    String(row.id??row.assignmentId)===args.itemId&&(!args.courseId||String(row.courseId??row.course_id)===args.courseId)&&ownedRow(row,c));
  if(matches.length!==1)return false;
  const id=stringId(matches[0].courseId??matches[0].course_id);
  if(!courseAllowed(id,c,strict))return false;
  args.courseId=id;
  return true;
 }
 function findAid(args,c,strict){
  if(!plain(c.studyAids))return !strict;if(!own(c.studyAids,args.aidKey))return false;
  const aid=c.studyAids[args.aidKey];if(!aid||aid.kind!=='practice'||!ownedRow(aid,c))return false;
  const courseId=stringId(aid.courseId);
  if(args.courseId&&courseId!==args.courseId||!courseAllowed(courseId,c,strict))return false;
  args.courseId=courseId;
  return true;
 }
 function validateTool(value,context={},strict=false){
  try{
   const c=plain(context)?context:{};
   if(!safeObject(value)||Object.keys(value).some(key=>!['id','args','label'].includes(key))||typeof value.id!=='string'||!safeObject(value.args===undefined?{}:value.args))return null;
   const id=value.id,input=value.args||{},args={},label=value.label===undefined?'Use tool':typeof value.label==='string'?value.label.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim():'';
   if(!label||label.split(' ').length>4)return null;
   const shortLabel=label.slice(0,80);
   let allowed=[];
   if(id===IDS.focus)allowed=['action','minutes','courseId','itemId'];
   else if(id===IDS.focusControl)allowed=['action','minutes'];
   else if(id===IDS.reminder)allowed=['title','at','courseId'];
   else if(id===IDS.plan)allowed=['title','day','date','time','minutes','courseId','itemId'];
   else if(id===IDS.tomorrow)allowed=['itemId','courseId'];
   else if(id===IDS.practice)allowed=['action','itemId','aidKey','courseId','at'];
   else if(id===IDS.material)allowed=['sourceId','courseId'];
   else if(id===IDS.canvas)allowed=['sourceId','itemId','courseId'];
   else if(id===IDS.copy)allowed=['text'];
   else if(id.startsWith('feature:')&&FEATURE_IDS.includes(id.slice(8)))allowed=['on'];
   else if(![IDS.focusReset,IDS.planner,IDS.inbox].includes(id))return null;
   if(Object.keys(input).some(key=>!allowed.includes(key)))return null;
   for(const key of ['courseId','itemId','sourceId','aidKey'])if(own(input,key)){const v=stringId(input[key]);if(!v)return null;args[key]=v;}
   if(id===IDS.focus){
     if(!['start','pause','resume'].includes(input.action)||input.minutes!==undefined&&!number(input.minutes,1,240)||input.action!=='start'&&(input.minutes!==undefined||args.itemId||args.courseId))
       return null;
     args.action=input.action;
     if(input.minutes!==undefined)args.minutes=input.minutes;
   }
   if(id===IDS.focusControl){
     if(!['pause','resume','stop','adjust'].includes(input.action)||input.action==='adjust'&&(!number(input.minutes,-240,240)||input.minutes===0)||input.action!=='adjust'&&input.minutes!==undefined)
       return null;
     args.action=input.action;
     if(input.minutes!==undefined)args.minutes=input.minutes;
   }
   if(id===IDS.plan){
     if(typeof input.title!=='string'||
       !input.title.trim()||
       input.title.length>200||
       /[\u0000-\u001f\u007f]/.test(input.title)||
       !validDay(input.day??input.date)||
       input.day!==undefined&&input.date!==undefined&&input.day!==input.date||
       !Number.isInteger(input.minutes)||
       !number(input.minutes,1,1440)||
       input.time!==undefined&&(typeof input.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)))
       return null;
     args.title=input.title.trim();
     args.day=input.day??input.date;
     args.minutes=input.minutes;
     if(input.time!==undefined)args.time=input.time;
   }
   if(id===IDS.reminder){
     const at=stamp(input.at),now=number(c.now,0,8640000000000000)?c.now:Date.now();
     if(typeof input.title!=='string'||!input.title.trim()||input.title.length>200||/[\u0000-\u001f\u007f]/.test(input.title)||at===null||at<=now)return null;
     args.title=input.title.trim();
     args.at=at;
   }
   if(id===IDS.copy){if(typeof input.text!=='string'||!input.text.trim()||input.text.length>12000||/[\u0000\u0008\u000b\u000c\u007f]/.test(input.text))return null;args.text=input.text;}
   if(id.startsWith('feature:')){
     if(typeof input.on!=='boolean')return null;
     const rows=catalogue(c);
     if(rows&&!rows.some(row=>(typeof row==='string'?row:row.id)===id.slice(8))||strict&&!rows)return null;
     args.on=input.on;
   }
   if(id===IDS.practice){
     if(!['practice','review','review-tomorrow'].includes(input.action)||
       input.action==='practice'&&(!args.itemId||args.aidKey)||
       input.action!=='practice'&&(!args.aidKey||args.itemId)||
       input.at!==undefined&&input.action!=='review-tomorrow')
       return null;
     args.action=input.action;
     if(input.at!==undefined){const at=stamp(input.at);if(at===null||at<=(c.now??Date.now()))return null;args.at=at;}
   }
   if(id===IDS.tomorrow&&!args.itemId||id===IDS.material&&!args.sourceId||id===IDS.canvas&&!!args.itemId===!!args.sourceId)return null;
   if(args.itemId&&!findItem(args,c,strict)||args.aidKey&&!findAid(args,c,strict)||args.courseId&&!courseAllowed(args.courseId,c,strict))return null;
   if(args.sourceId){
    if(Array.isArray(c.sources)){
     const matches=c.sources.filter(row=>row.id===args.sourceId&&(!args.courseId||String(row.courseId)===args.courseId)&&ownedRow(row,c));
     if(matches.length!==1)return null;
     const source=matches[0],courseId=stringId(source.courseId);
     if(!courseAllowed(courseId,c,strict)||!sourceURL(source,c)||id===IDS.material&&!['file','link','material','page','home','syllabus','module'].includes(source.kind))return null;args.courseId=courseId;
    }else if(strict)return null;
   }
   return {id,args,label:shortLabel};
  }catch{return null;}
 }
 function normalizeTools(values,context={}){
   if(!Array.isArray(values))return [];
   const result=[];
   for(const value of values){const clean=validateTool(value,context);if(clean)result.push(clean);if(result.length===3)break;}
   return result;
 }
 function tomorrow(c){
   try{
     const parts=new Intl.DateTimeFormat('en-US',{timeZone:c.s?.timeZone||c.settings?.timeZone||c.timeZone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(c.now??Date.now())),
       p=Object.fromEntries(parts.map(row=>[row.type,row.value]));
     return new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+1)).toISOString().slice(0,10);
   }catch{return '';}
 }
 function tomorrowAt(c){
  const day=tomorrow(c),target=Date.parse(day+'T09:00:00Z');let at=target;
  try{
    const formatter=new Intl.DateTimeFormat('en-US',{
      timeZone:c.s?.timeZone||c.settings?.timeZone||c.timeZone||'UTC',
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      hour:'2-digit',
      minute:'2-digit',
      hourCycle:'h23'
    });
    for(let i=0;i<4;i++){
      const p=Object.fromEntries(formatter.formatToParts(new Date(at)).map(row=>[row.type,row.value])),
        seen=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute));
      if(seen===target)return at;
      at+=target-seen;
    }
  }catch{}
  return null;
 }
 function mapTool(tool,c){
  const {id,args}=tool,fields={...args};delete fields.action;
  if(id===IDS.focus)return args.action==='start'?{action:'focus',fields:{...fields,minutes:args.minutes??25,explicit:true}}:{action:'focus-control',fields:{action:args.action}};
  if(id===IDS.focusControl)return {action:'focus-control',fields:{...args}};
  if(id===IDS.focusReset)return {action:'focus-control',fields:{action:'reset',autostart:false}};
  if(id===IDS.reminder)return {action:'reminder',fields};
  if(id===IDS.plan)return {action:'plan',fields:{...fields,operation:'add-block'}};
  if(id===IDS.planner)return {action:'navigate',fields:{tab:'planner'}};
  if(id===IDS.inbox)return {action:'navigate',fields:{tab:'messages'}};
  if(id===IDS.tomorrow)return {action:'move',fields:{...fields,date:tomorrow(c)}};
  if(id===IDS.practice)return args.action==='review-tomorrow'?{action:'review',fields:{...fields,operation:'schedule',at:args.at??tomorrowAt(c)}}:{action:args.action,fields};
  if(id===IDS.copy)return {action:'copy',fields};
  if(id.startsWith('feature:'))return {action:'feature',fields:{id:id.slice(8),on:args.on}};
  if(args.itemId)return {action:'open',fields};
  const source=c.sources.find(row=>row.id===args.sourceId&&String(row.courseId)===args.courseId);
  return {action:'open',fields:{entryId:args.sourceId,sourceId:args.sourceId,courseId:args.courseId},source:{id:source.id,url:sourceURL(source,c)}};
 }
 function resultData(result){
   return {
     ok:result!==false&&result!=null&&result?.ok!==false,
     message:typeof result?.message==='string'?result.message.slice(0,1000):typeof result==='string'?result.slice(0,1000):result===false||result==null?'That tool is unavailable in this workspace.':'Done.',
     ...(result?.reload===true?{reload:true}:{})
   };
 }
 let executorSequence=0;
 // Providers register/unregister with the existing registry, independent of the pet lifecycle.
 function registerExecutor(provider){
  const R=root.ReserveBiscuitRegistry;if(!R?.register||typeof provider?.getContext!=='function'||typeof provider?.executeBiscuit!=='function')return ()=>{};
  let dead=false;const getLive=request=>{
   if(dead||provider.isCurrent?.()===false)throw Error('This workspace is closed.');
   const current=provider.getContext(),context=request.getContext?.()||request.context,owner=scopeOwner(request.scopeKey);
   if(!matchesOwner(current,owner,true)||!matchesOwner(context,owner))throw Error('Your Canvas account changed. Reopen Canvas Harness.');
   const sources=request.getContext&&Array.isArray(context?.sources)?
     [...new Map([...context.sources,...list(current.sources)].map(row=>[row.id,row])).values()]:
     Array.isArray(current.sources)?current.sources:context?.sources;
   const live={...context,...current,origin:owner.origin,accountId:owner.accountId,sources,featureCatalogue:catalogue(current)||root.ReserveFeatures?.catalogue};
   // A source can narrow an all-course board; it cannot broaden its current selected course.
   if(current.courseId&&current.courseId!=='all'&&context?.courseId&&context.courseId!=='all'&&String(current.courseId)!==String(context.courseId))
     throw Error('The Canvas course changed. Review the current tools.');
   if((!current.courseId||current.courseId==='all')&&context?.courseId)live.courseId=context.courseId;
   return live;
  };
  const unregister=R.register('study-tools-executor-'+(++executorSequence),{actions:snapshot=>{
   if(!snapshot?.studyToolsRequest)return [];try{getLive(snapshot);}catch{return [];}
   return [{action:'study-tool',run:async(value,execution)=>{
    const request=execution.snapshot,live=getLive(request),clean=validateTool(value,live,true);if(!clean)return {ok:false,message:'That tool is unknown, unsafe, or no longer available in this course.'};
    const mapped=mapTool(clean,live),fingerprint=JSON.stringify(mapped),validate=()=>{
     if(execution.isCurrent?.()===false)throw Error('The Canvas view changed. Review the current tools.');const fresh=getLive(request),latest=validateTool(value,fresh,true);
     if(!latest||JSON.stringify(mapTool(latest,fresh))!==fingerprint)throw Error('The tool or its Canvas source changed. Review the current tools.');return true;
    };
    validate();return provider.executeBiscuit(mapped.action,mapped.fields,{validate,source:mapped.source});
   }}];
  }});
  return ()=>{dead=true;unregister();};
 }
 async function run(value,options={}){
  try{
   const context=options.getContext?.()||options.context||options.snapshot||{},owner=scopeOwner(options.scopeKey),clean=validateTool(value,context);
   if(!owner||!matchesOwner(context,owner)||!clean)return {ok:false,message:'That tool is unknown, unsafe, or belongs to an old Canvas scope.'};
   if(options.isCurrent?.()===false)return {ok:false,message:'The Canvas view changed. Review the current tools.'};
   const R=root.ReserveBiscuitRegistry;if(!R?.execute)return {ok:false,message:'Open the Canvas Harness workspace to use this tool.'};
   const result=await R.execute('study-tool',clean,{
     snapshot:{studyToolsRequest:true,scopeKey:options.scopeKey,context,aidKey:options.aidKey,getContext:options.getContext},
     isCurrent:options.isCurrent
   });
   return resultData(result);
  }catch(error){return {ok:false,message:String(error?.message||'The tool could not finish.').slice(0,1000)};}
 }
 const api={IDS,FEATURE_IDS,PROMPT,promptTools:()=>PROMPT,normalizeTools,validateTool,registerExecutor,run,execute:run};
 root.CanvasHarnessStudyTools=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
