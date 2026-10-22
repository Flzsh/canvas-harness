/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
// Adapted from Gary Wu's pull request #42 to Canvas Harness.
(function(root){
 'use strict';
 const Core=root.ReserveCore||(typeof module==='object'&&module.exports?require('./core.js'):null);
 const OPENABLE=new Set(['Page','File','ExternalUrl','ExternalTool']),MARKS=new Set(['done','opened','undone']);
 const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value),id=value=>/^\d+$/.test(String(value??''))?String(value):'';
 const auth=()=>Object.assign(Error('Your Canvas account changed. Reopen Modules.'),{code:'auth'});
 function account(profile){const value=id(profile?.id);if(!value)throw auth();return value;}
 function courseProgress(value){
  const marks={};
  if(record(value?.marks))for(const [key,mark]of Object.entries(value.marks))if(id(key)&&MARKS.has(mark))marks[key]=mark;
  return {marks,hideFinished:value?.hideFinished===true};
 }
 function statusOf(item,subs=new Map(),mark){
  if(!item||item.type==='SubHeader')return null;
  const sub=subs.get(`${item.type}:${item.content_id}`);
  if(item.completion_requirement?.completed===true&&!sub?.needsWork)return {done:true,by:'canvas',canToggle:false};
  if(sub?.done===true)return {done:true,by:'submitted',canToggle:false};
  if(mark==='done')return {done:true,by:'you',canToggle:true};
  if(mark==='opened'&&OPENABLE.has(item.type))return {done:true,by:'opened',canToggle:true};
  return {done:false,by:'',canToggle:true};
 }
 function progress(items,subs,marks={}){
  let done=0,total=0;
  for(const item of items||[]){const status=statusOf(item,subs,marks[item.id]);if(!status)continue;total++;if(status.done)done++;}
  return {done,total};
 }
 function locked(value){return value?.state==='locked'||value?.locked_for_user===true||value?.published===false||value?.content_details?.locked_for_user===true||value?.content_details?.hidden_for_user===true;}
 function nextItem(modules,subs,marks={}){
  for(const module of modules||[]){if(locked(module))continue;for(const item of module.items||[]){const status=statusOf(item,subs,marks[item.id]);if(status&&!status.done&&!locked(item))return item;}}
  return null;
 }
 function submissions(assignments,accountId){
  const map=new Map();
  for(const assignment of assignments||[]){
   if(!id(assignment?.id))continue;
   const sub=assignment.submission;
   if(sub?.user_id!=null&&accountId!=null&&String(sub.user_id)!==String(accountId))throw auth();
   const normalized=Core.normalizeAssignment(assignment,{id:assignment.course_id}),info={done:Core.isComplete(normalized),needsWork:normalized.state!=='excused'&&(normalized.missing||normalized.redoRequested)};
   map.set(`Assignment:${assignment.id}`,info);
   if(id(assignment.quiz_id))map.set(`Quiz:${assignment.quiz_id}`,info);
   if(id(assignment.discussion_topic?.id))map.set(`Discussion:${assignment.discussion_topic.id}`,info);
  }
  return map;
 }
 async function loadCourse(client,courseId,{signal}={}){
  const c=id(courseId);if(!c)throw Error('Invalid Canvas course.');
  const modules=await client.list(`/api/v1/courses/${c}/modules?include[]=items&include[]=content_details&per_page=100`,{signal});
  if(!Array.isArray(modules))throw Error('Canvas returned incomplete modules.');
  const seenModules=new Set(),seenItems=new Set(),complete=[];
  for(const module of modules){
   const moduleId=id(module?.id);if(!moduleId||seenModules.has(moduleId))throw Error('Canvas returned incomplete modules.');seenModules.add(moduleId);
   const items=await client.list(`/api/v1/courses/${c}/modules/${moduleId}/items?include[]=content_details&per_page=100`,{signal});
   if(!Array.isArray(items)||module.items_count!=null&&(!Number.isInteger(Number(module.items_count))||Number(module.items_count)<0||items.length<Number(module.items_count)))throw Error('Canvas returned incomplete module items.');
   for(const item of items){const itemId=id(item?.id);if(!itemId||seenItems.has(itemId)||item.module_id!=null&&String(item.module_id)!==moduleId||typeof item.type!=='string')throw Error('Canvas returned incomplete module items.');seenItems.add(itemId);}
   complete.push({...module,items});
  }
  let assignments=[],warning='';
  try{assignments=await client.list(`/api/v1/courses/${c}/assignments?include[]=submission&per_page=100`,{signal});if(!Array.isArray(assignments))throw Error('Canvas returned incomplete submissions.');}
  catch(error){if(error?.code==='auth'||error?.code==='cancelled')throw error;assignments=[];warning='Canvas submissions could not be loaded.';}
  return {modules:complete,assignments,warning};
 }
 function itemURL(item,courseId,origin){
  if(!id(item?.id)||!id(courseId))return null;
  try{const url=new URL(item.html_url,origin),path=decodeURIComponent(url.pathname);if(url.origin===origin&&!url.username&&!url.password&&path.startsWith(`/courses/${courseId}/`)&&!/%2f|%5c|%2e/i.test(url.pathname)&&!/\/quizzes\/[^/]+\/(?:take|resume)(?:\/|$)/i.test(path))return url.href;}catch{}
  return `${origin}/courses/${courseId}/modules/items/${item.id}`;
 }
 async function recordOpened({client,createStore,courseId,itemId,origin=root.ReserveSite?.origin()||client?.origin,signal,canUse=()=>true}={}){
  const c=id(courseId),item=id(itemId);if(!c||!item)throw Error('Invalid Canvas module item.');
  const check=()=>{if(signal?.aborted||!canUse())throw Object.assign(Error('Modules closed.'),{code:'cancelled'});};
  check();const accountId=account(await client.profile({signal}));check();const store=createStore({accountId,origin});
  try{
   const data=await store.load();check();if(account(await client.profile({signal}))!==accountId)throw auth();check();
   if(courseProgress(data?.moduleProgress?.[c]).marks[item])return;
   await store.update(data=>{check();data.moduleProgress??={};const course=courseProgress(data.moduleProgress[c]);if(!course.marks[item])course.marks[item]='opened';data.moduleProgress[c]=course;});
  }finally{store.destroy();}
 }
 function createProgress({client,createStore,courseId,origin=root.ReserveSite?.origin()||client?.origin,onChange=()=>{},canUse=()=>true}={}){
  const c=id(courseId);if(!c)throw Error('Invalid Canvas course.');
  let abort=new AbortController(),dead=false,version=0,store=null,unsubscribe=null,loading=null,queue=Promise.resolve();
  let state={ready:false,busy:false,accountId:null,modules:[],subs:new Map(),marks:{},hideFinished:false,error:'',warning:''};
  const get=()=>({...state,marks:{...state.marks}}),emit=()=>{if(!dead)onChange(get());};
  function alive(turn){if(dead||turn!==version||!canUse())throw Object.assign(Error('Modules closed.'),{code:'cancelled'});}
  function discard(){unsubscribe?.();unsubscribe=null;store?.destroy();store=null;}
  function clear(){state={...state,ready:false,accountId:null,modules:[],subs:new Map(),marks:{},hideFinished:false,warning:''};}
  const saved=data=>courseProgress(data?.moduleProgress?.[c]);
  async function verify(expected,turn){alive(turn);const found=account(await client.profile({signal:abort.signal}));alive(turn);if(expected&&found!==expected)throw auth();return found;}
  function refresh(){
   if(dead)return Promise.resolve();if(loading)return loading;
   const turn=++version;abort.abort();abort=new AbortController();discard();clear();state.busy=true;state.error='';emit();
   const operation=(async()=>{
    try{
     const accountId=await verify(null,turn),loaded=await loadCourse(client,c,{signal:abort.signal});alive(turn);
     const subs=submissions(loaded.assignments,accountId);store=createStore({accountId,origin});
     const data=await store.load();await verify(accountId,turn);
     state={...state,...saved(data),accountId,modules:loaded.modules,subs,warning:loaded.warning,ready:true};
     unsubscribe=store.subscribe(data=>{if(!dead&&turn===version&&state.ready){state={...state,...saved(data)};emit();}});
    }catch(error){if(turn===version&&!dead){discard();clear();state.error=String(error?.message||'Canvas modules could not be loaded.');}}
    finally{if(turn===version&&!dead){state.busy=false;emit();}}
   })();
   loading=operation;operation.finally(()=>{if(loading===operation)loading=null;});return operation;
  }
  function change(mutator){
   const turn=version;
   const operation=queue.catch(()=>{}).then(async()=>{
    alive(turn);if(!state.ready||!store)throw Error('Canvas modules are not ready.');
    state.busy=true;state.error='';emit();
    try{
     await verify(state.accountId,turn);const active=store;
     const data=await active.update(data=>{alive(turn);data.moduleProgress??={};const course=saved(data);mutator(course);data.moduleProgress[c]=course;});
     alive(turn);state={...state,...saved(data)};
    }catch(error){if(!dead&&turn===version){if(error?.code==='auth'){discard();clear();}state.error=String(error?.message||'Module progress could not be saved.');}throw error;}
    finally{if(!dead&&turn===version){state.busy=false;emit();}}
   });
   queue=operation;return operation;
  }
  const find=itemId=>state.modules.flatMap(module=>module.items).find(item=>String(item.id)===String(itemId));
  function toggle(itemId){return change(course=>{const item=find(itemId),status=statusOf(item,state.subs,course.marks[itemId]);if(status?.canToggle)course.marks[itemId]=status.done?'undone':'done';});}
  function opened(itemId){
   const item=find(itemId);if(!item||!OPENABLE.has(item.type)||state.marks[itemId]||statusOf(item,state.subs)?.done)return Promise.resolve();
   return change(course=>{if(!course.marks[itemId])course.marks[itemId]='opened';});
  }
  function markAll(moduleId){return change(course=>{const module=state.modules.find(module=>String(module.id)===String(moduleId));for(const item of module?.items||[]){const status=statusOf(item,state.subs,course.marks[item.id]);if(status?.canToggle&&!status.done)course.marks[item.id]='done';}});}
  return {get,refresh,toggle,opened,markAll,hideFinished:value=>change(course=>{course.hideFinished=value===true;}),suspend(){if(dead)return;version++;abort.abort();loading=null;discard();clear();state.busy=false;state.error='';emit();},destroy(){if(dead)return;dead=true;version++;abort.abort();discard();}};
 }
 const api={statusOf,progress,nextItem,submissions,loadCourse,itemURL,courseProgress,recordOpened,createProgress};
 if(typeof module==='object'&&module.exports){module.exports=api;return;}
 function initialize(){
 const Art=root.ReserveCourseNavArt,KEY='reserve:appearance';
 // the Modules page, or a course home that shows the modules
 const route=()=>/^\/courses\/[^/]+(?:\/modules)?\/?$/.test(root.location?.pathname||'');
 const allowed=()=>root.top===root&&root.ReserveSite?.supported(root.location?.href)&&!root.ReserveSite.vanillaPage(root.location)&&root.ReserveFeatures?.enabled('course-nav')!==false;
 const eligible=()=>allowed()&&route();
 if(!eligible()){
  const match=/^\/courses\/(\d+)\/(?:pages\/[^/]+|files\/\d+)\/?$/.exec(root.location?.pathname||''),visitHref=root.location?.href,itemId=new URL(visitHref||root.ReserveSite.origin()+'/').searchParams.get('module_item_id');
  if(!allowed()||!match||!id(itemId)||root.ReserveModulesPage||!root.ReserveAPI?.createClient||!root.ReserveStorage?.createStore)return;
  const controller=new AbortController();root.addEventListener?.('pagehide',()=>controller.abort(),{once:true});
  root.ReserveModulesPage={visit:(async()=>{try{await recordOpened({client:root.ReserveAPI.createClient({origin:root.location.origin}),createStore:root.ReserveStorage.createStore,courseId:match[1],itemId,origin:root.location.origin,signal:controller.signal,canUse:()=>allowed()&&root.location.href===visitHref});}catch{}})()};return;
 }
 if(!Art)return;
 const KINDS={assignment:'assignments',quiz:'quizzes','lti-quiz':'quizzes',discussion_topic:'discussions',wiki_page:'pages',attachment:'files',context_module_sub_header:'',external_url:'tool',context_external_tool:'tool'};
 function kindOf(item){for(const name of item.classList)if(Object.prototype.hasOwnProperty.call(KINDS,name))return KINDS[name];return 'tool';}
 let doc,list=null,observer=null,tracker=null,bar=null;
 const hidden=new Map();
 const text=(node,value)=>{if(node.textContent!==String(value))node.textContent=String(value);};
 function attr(node,name,value){if(node.getAttribute(name)!==String(value))node.setAttribute(name,String(value));}
 function node(tag,classes,parent){const element=doc.createElement(tag);element.className=classes;parent?.append(element);return element;}
 function conceal(element,on){
  if(!element)return;
  if(on){if(!hidden.has(element))hidden.set(element,{hidden:element.hidden,utility:element.classList.contains('hidden')});element.hidden=true;element.classList.add('hidden');}
  else if(hidden.has(element)){const before=hidden.get(element);element.hidden=before.hidden;if(!before.utility)element.classList.remove('hidden');hidden.delete(element);}
 }
 function paint(state=tracker?.get()){
  if(!state||!bar)return;
  const summary=bar.querySelector('.ch-modprog-summary'),meter=bar.querySelector('progress'),hide=bar.querySelector('.ch-modprog-hide'),go=bar.querySelector('.ch-modprog-continue'),message=bar.querySelector('.ch-modprog-message'),retry=bar.querySelector('.ch-modprog-retry');
  let done=0,total=0;const next=state.ready?nextItem(state.modules,state.subs,state.marks):null;
  for(const module of state.modules){
   const count=progress(module.items,state.subs,state.marks);done+=count.done;total+=count.total;
   const box=list.querySelector(`.context_module[data-module-id="${module.id}"]`)||list.querySelector(`#context_module_${module.id}`);
   const head=box?.querySelector('.ig-header');
   if(head){
    let tag=head.querySelector('.ch-modprog-module-progress');
    if(!tag){tag=node('span','requirements_message ch-modprog-module-progress',head);const line=node('li','',node('ul','',tag));node('span','ch-modprog-count',line);const value=node('progress','ch-modprog-meter',line);attr(value,'aria-label',`Module progress: ${module.name||module.id}`);const all=node('button','btn btn-mini ch-modprog-all',line);all.type='button';all.dataset.module=module.id;text(all,'Mark all done');}
    text(tag.querySelector('.ch-modprog-count'),`${count.done} of ${count.total} done `);
    const value=tag.querySelector('progress');attr(value,'max',count.total||1);attr(value,'value',count.done);
    const all=tag.querySelector('.ch-modprog-all');all.disabled=state.busy||count.done===count.total;all.hidden=count.total===0;tag.hidden=count.total===0;
    conceal(box.querySelector('.content'),state.hideFinished&&count.total>0&&count.done===count.total);
   }
   for(const item of module.items){
    const li=list.querySelector(`#context_module_item_${item.id}`);if(!li)continue;
    const status=statusOf(item,state.subs,state.marks[item.id]);if(!status)continue;
    const row=li.querySelector(':scope>.ig-row');if(!row)continue;
    let button=li.querySelector('.ch-modprog-check');
    if(!button){button=node('button','btn btn-mini module-item-status-icon ch-modprog-check');button.type='button';button.dataset.item=item.id;const icon=node('i','',button);attr(icon,'aria-hidden','true');row.prepend(button);}
    const label={canvas:'Done on Canvas',submitted:'Done on Canvas',opened:'Opened; mark not done',you:'Marked done; undo'}[status.by]||'Mark as done';
    attr(button,'aria-label',`${label}: ${item.title||''}`);attr(button,'aria-pressed',status.done);button.disabled=state.busy||!status.canToggle;
    const icon=button.querySelector('i'),kind=status.done?'icon-check':'icon-unpublished';if(icon.className!==kind)icon.className=kind;
    let slip=li.querySelector('.ch-modprog-next');if(!slip&&String(next?.id)===String(item.id)){const details=li.querySelector('.ig-details')||node('div','ig-details ch-modprog-details',row);slip=node('span','due_date_display ch-modprog-next',details);text(slip,'Up next');}
    if(slip)slip.hidden=String(next?.id)!==String(item.id);
    conceal(li,state.hideFinished&&status.done);
   }
  }
  if(!state.ready){for(const element of list.querySelectorAll('.ch-modprog-module-progress,.ch-modprog-check,.ch-modprog-next,.ch-modprog-details'))element.remove();for(const element of [...hidden.keys()])conceal(element,false);}
  text(summary,state.ready?`${done} of ${total} done`:state.busy?'Loading modules…':'');attr(meter,'max',total||1);attr(meter,'value',done);meter.hidden=!state.ready;
  hide.disabled=!state.ready||state.busy;attr(hide,'aria-pressed',state.hideFinished);
  const href=next?itemURL(next,course(),root.location.origin):null;go.hidden=!href||state.busy;if(href)attr(go,'href',href);else go.removeAttribute('href');text(go,next?`Continue: ${next.title||''}`:'Continue');
  text(message,state.error||state.warning||(state.ready&&total>0&&done===total?'All caught up':''));retry.hidden=state.busy||!state.error;retry.disabled=state.busy;
 }
 const course=()=>id(/^\/courses\/(\d+)/.exec(root.location?.pathname||'')?.[1]);
 const action=operation=>{Promise.resolve(operation).catch(()=>{});};
 function startProgress(){
  if(!course()||!Core||!root.ReserveAPI?.createClient||!root.ReserveStorage?.createStore)return;
  bar=node('div','header-bar ch-modprog-progress');attr(bar,'role','region');attr(bar,'aria-label','Module progress');list.parentNode.insertBefore(bar,list);
  node('span','ch-modprog-summary',bar);const meter=node('progress','ch-modprog-meter',bar);attr(meter,'aria-label','Course module progress');
  const hide=node('button','btn btn-small ch-modprog-hide',bar);hide.type='button';text(hide,'Hide finished');node('a','btn btn-small ch-modprog-continue',bar);
  const message=node('span','ch-modprog-message',bar);attr(message,'role','status');const retry=node('button','btn btn-small ch-modprog-retry',bar);retry.type='button';text(retry,'Retry');
  tracker=createProgress({client:root.ReserveAPI.createClient({origin:root.location.origin}),createStore:root.ReserveStorage.createStore,courseId:course(),origin:root.location.origin,onChange:paint,canUse:eligible});
  root.ReserveModulesPage.progress=tracker;root.ReserveModulesPage.refresh=tracker.refresh;
  bar.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button===hide)action(tracker.hideFinished(!tracker.get().hideFinished));else if(button===retry)action(tracker.refresh());});
  const open=event=>{
   if(event.type==='auxclick'&&event.button!==1||event.type==='click'&&event.button!=null&&event.button!==0||event.defaultPrevented)return;
   const link=event.target.closest('a.ig-title,.ch-modprog-continue');if(!link)return;
   const itemId=link===bar.querySelector('.ch-modprog-continue')?nextItem(tracker.get().modules,tracker.get().subs,tracker.get().marks)?.id:link.closest('li.context_module_item')?.id.replace('context_module_item_','');
   if(!itemId)return;
   const state=tracker.get(),item=state.modules.flatMap(module=>module.items).find(item=>String(item.id)===String(itemId));
   const href=link.href,previous=root.location.href,target=link.getAttribute('target');
   let local=false;try{const url=new URL(href,previous);local=url.origin===root.location.origin&&/^\/courses\/\d+\/(?:pages\/[^/]+|files\/\d+|modules\/items\/\d+)\/?$/.test(url.pathname);}catch{}
   if(event.type==='click'&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&(!target||target==='_self')&&!link.hasAttribute('download')&&local&&OPENABLE.has(item?.type)&&!state.marks[itemId]&&!statusOf(item,state.subs)?.done&&root.location.assign){
    event.preventDefault();action(tracker.opened(itemId).catch(()=>{}).then(()=>{if(root.location.href===previous)root.location.assign(href);}));
   }else action(tracker.opened(itemId));
  };
  list.addEventListener('click',event=>{const button=event.target.closest('.ch-modprog-check,.ch-modprog-all');if(!button)return;event.preventDefault();event.stopPropagation();if(button.disabled)return;action(button.classList.contains('ch-modprog-check')?tracker.toggle(button.dataset.item):tracker.markAll(button.dataset.module));},true);
  list.addEventListener('click',open,true);list.addEventListener('auxclick',open,true);bar.addEventListener('click',open,true);bar.addEventListener('auxclick',open,true);
  root.addEventListener?.('pageshow',event=>{if(event.persisted&&eligible())action(tracker.refresh());});
  root.addEventListener?.('pagehide',event=>{if(event.persisted)tracker.suspend();else tracker.destroy();for(const element of [...hidden.keys()])conceal(element,false);});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)tracker.suspend();else if(eligible())action(tracker.refresh());});
  action(tracker.refresh());
 }
 function decorate(item){
  for(const due of item.querySelectorAll('.due_date_display'))due.classList.toggle('md-empty',!due.textContent.trim());
  if(item.dataset.mdIcon!==undefined)return;
  const kind=kindOf(item),host=item.querySelector('.ig-type-icon');
  item.dataset.mdIcon=kind;
  if(!kind||!host||host.querySelector('.md-icon'))return;
  const span=doc.createElement('span');span.className='md-icon';span.setAttribute('aria-hidden','true');span.innerHTML=Art.icons[kind]||Art.icons.tool;
  host.append(span);
  // the row is the icon's host: hovering it plays the icon's action once (course-nav-art.css)
  item.querySelector(':scope>.ig-row')?.classList.add('cn-i');
 }
 function decorateAll(){for(const item of list.querySelectorAll('li.context_module_item'))decorate(item);}
 function motion(value){doc.documentElement.dataset.mdMotion=root.ReserveFeatures?.enabled('motion')===false||['still','off'].includes(value?.motion)?'off':'on';}
 function sheet(file){
  const href=root.chrome.runtime.getURL(file);
  if([...doc.querySelectorAll('link[rel="stylesheet"]')].some(link=>link.href===href))return;
  const link=doc.createElement('link');link.rel='stylesheet';link.href=href;(doc.head||doc.documentElement).append(link);
 }
 async function start(){
  doc=root.document;list=doc.getElementById('context_modules');
  if(!list||!eligible()||root.ReserveModulesPage)return;
  if(!eligible()||root.ReserveModulesPage||doc.getElementById('context_modules')!==list)return;
  root.ReserveModulesPage={kindOf};
  sheet('course-nav-art.css');sheet('modules-page.css');
  doc.documentElement.classList.add('reserve-modules');
  decorateAll();
  // Canvas also updates due dates in existing rows, by replacing children or editing their text.
  observer=new root.MutationObserver(records=>{if(records.some(r=>r.type==='characterData'||r.addedNodes.length||r.removedNodes.length)){decorateAll();paint();}});
  observer.observe(list,{childList:true,characterData:true,subtree:true});
  motion();
  try{motion((await root.chrome.storage.local.get(KEY))[KEY]);}catch{}
  root.chrome?.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes[KEY])motion(changes[KEY].newValue);});
  startProgress();
 }
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>void start(),{once:true});
 else void start();
 }
 // Registered files evaluate before asynchronous static-art confirmation.
 if(root.ReserveFeatureLoad)root.ReserveFeatureLoad.then(reply=>{if(reply?.ok)initialize();});else initialize();
})(globalThis);
