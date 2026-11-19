/* Synchronous Home markup and account-local interaction for the agent's modules. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAgentHome=api;
})(globalThis,function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null),
  arrange=()=>load('ReserveWorkspaceArrange','./workspace-arrange.js'),
  study=()=>load('CanvasHarnessStudyUI','./study-ui.js'),
  array=v=>Array.isArray(v)?v:[],
  DAY=86400000;
 const blocked=(c={})=>c.quizTaking===true||/\/quizzes\/[^/?#]+\/(?:take|resume)(?:[/?#]|$)|\/assessment_sessions\//i.test(c.pathname||root.location?.href||'');
 const state=c=>c.personal?.toolbox?.agent||{},day=(at,zone)=>{
  try{return new Intl.DateTimeFormat('en-CA',{timeZone:zone||'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));}catch{return '';}
 };
 const distance=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/DAY),safeURL=value=>{
  if(!value)return '';
  try{const u=new URL(value,(globalThis.ReserveSite?.origin?.()||'https://school.instructure.com'));return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
 };
 function resolve(id,c){
  const text=String(id??''),ref=state(c).todayRefs?.[text],match=text.match(/^assignment:([^:]+):(.+)$/);
  return array(c.items).find(i=>match?String(i.courseId)===match[1]&&String(i.id)===match[2]:text.startsWith('local:')?String(i.id)===text.slice(6):String(i.id)===text)||
   (ref?{...ref,id:ref.canvasId??ref.id}:null);
 }
 function aidLabel(aid){
  const ui=study();
  if(aid?.kind==='reading'){
   const checks=array(aid.data?.check);
   return (ui?.LABELS?.reading||'Reading guide')+' '+checks.filter((_,i)=>aid.progress?.revealed?.['check:'+i]===true).length+'/'+checks.length;
  }
  return ui?.tagLabel?.(aid)||'Study aid';
 }
 function meta(module,c,aid){
  const item=resolve(module.itemId,c)||module.item||{},date=item.dueAt,zone=c.s?.timeZone;
  let due='';
  if(date){
   const n=distance(day(date,zone),day(c.now,zone)),weekday=new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:zone}).format(new Date(date));
   due=(item.workKind||item.kind||'Due')+' '+weekday+' · '+(n===0?'today':n===1?'1 day':n+' days');
  }
  return [due,aid?aidLabel(aid):''].filter(Boolean).join(' · ');
 }
 function renderModule(key,c,{E},{controls=arrange().controls}={}){
  if(blocked(c))return '';
  const s=state(c),m=array(s.modules).find(m=>m.id===key);
  if(!m||m.removed||m.until<day(c.now,c.s?.timeZone))return '';
  const open=m.open!==false,
   aid=c.studyAids?.[m.aidKey],
   validAid=aid&&aid.runId===m.runId,
   body=m.show==='aid'?validAid?`<div data-rd-key="viewer-${E(key)}" data-agent-viewer="${E(m.aidKey)}" data-aid-key="${E(m.aidKey)}" data-module-id="${E(key)}"></div>`:'<p>The study aid is not available.</p>':m.show==='checklist'?`<ul class="ch-agent-checklist">${array(m.items).slice(0,8).map((line,i)=>`<li><label><input type="checkbox" data-rd-field="agent-module-tick" data-module-id="${E(key)}" data-index="${i}"${m.ticks?.[i]===true?' checked':''}><span>${E(line)}</span></label></li>`).join('')}</ul>`:m.show==='files'?`<ul class="ch-agent-files">${array(m.files).slice(0,6).filter(f=>safeURL(f.url)).map(f=>`<li><a href="${E(safeURL(f.url))}"${f.what==='pdf'?` data-pdf-file-id="${E(f.canvasId)}" data-pdf-course-id="${E(f.courseId)}" data-pdf-name="${E(f.title)}"`:''}>${E(f.title)}</a></li>`).join('')}</ul>`:(()=>{
   const item=resolve(m.itemId,c)||m.item||{},
    n=item.dueAt?Math.max(0,distance(day(item.dueAt,c.s?.timeZone),day(c.now,c.s?.timeZone))):null,
    next=array(s.today).find(t=>String(t.itemId)===String(m.itemId))?.next||'';
   return `<p class="ch-agent-days"><b>${n===null?'—':n}</b> days left</p>${next?`<p class="ch-agent-next">${E(next)}</p>`:''}`;
  })();
  return `<section class="rd-widget" data-rd-key="widget-${E(key)}" data-arrange-key="${E(key)}" data-widget="${E(key)}" aria-label="${E(m.title)}"><header class="rd-arrange-heading rd-widget-head" data-arrange-head="${E(key)}"><h2>${E(m.title)}</h2>${controls(key,m.title)}</header><div class="rd-widget-body"><div class="ch-agent-module" data-show="${E(m.show)}" data-open="${open}"><p class="ch-agent-module-meta"><span class="ch-agent-time">${E(meta(m,c,validAid?aid:null))}</span></p><p class="ch-agent-module-lead">${E(m.why)}</p><button type="button" class="ch-agent-start" data-rd-action="agent-module-open" data-module-id="${E(key)}"${open?' hidden':''}>Start</button><button type="button" class="ch-agent-fold" data-rd-action="agent-module-open" data-module-id="${E(key)}" aria-expanded="${open}">${open?'Fold':'Open'}</button><div class="ch-agent-module-body"${open?'':' hidden'}>${open?body:''}</div></div></div></section>`;
 }
 function expire(data,today){
  const s=data.toolbox?.agent;
  if(!s)return;
  const expired=array(s.modules).filter(m=>m.until<today);
  for(const m of expired){
   arrange().change(data.settings,{type:'remove',key:m.id});
   const previous=data.settings.workspaceUndo;
   if(previous?.layout){previous.layout=arrange().prune(previous.layout,m.id);previous.order=arrange().leaves(previous.layout);}
   if(data.settings.moduleSize)delete data.settings.moduleSize[m.id];
   if(data.toolbox.agentPins)data.toolbox.agentPins=data.toolbox.agentPins.filter(id=>id!==m.id);
  }
  s.modules=array(s.modules).filter(m=>m.until>=today);
 }
 function create({container,store,save,rerender=()=>{},getContext,studyStore,studyScope,env=root}){
  const c=()=>getContext(),mutate=(id,fn)=>save(data=>{const m=array(data.toolbox?.agent?.modules).find(m=>m.id===id);if(m&&!m.removed)fn(m);});
  function fold(host){return mutate(host.dataset.moduleId,m=>{m.open=false;});}
  function sync(){
   if(blocked(c()))return;
   for(const host of container.querySelectorAll('[data-agent-viewer]')){
    const aid=c().studyAids?.[host.dataset.aidKey];
    if(!aid)continue;
    const signature=JSON.stringify(aid);
    if(host._agentSignature===signature&&(host.childNodes?.length||host.children?.length))continue;
    const viewer=study();
    if(!viewer?.renderViewer)continue;
    host._agentSignature=signature;
    viewer.renderViewer(host,aid,{env,onClose:()=>fold(host),onProgress:async progress=>{
     if(!studyStore||!studyScope)throw Error('Study storage is unavailable.');
     const saved=await studyStore.progress(studyScope,host.dataset.aidKey,progress);
     if(saved){c().studyAids[host.dataset.aidKey]=saved;host._agentSignature=JSON.stringify(saved);rerender();}
    },onError:error=>{host.setAttribute('aria-label',String(error.message||error));}});
   }
  }
  function click(event){
   if(blocked(c()))return false;
   const b=event.target.closest?.('[data-rd-action]');
   if(b?.dataset.rdAction==='agent-module-open'){void mutate(b.dataset.moduleId,m=>{m.open=m.open===false;});return true;}
   return false;
  }
  function change(event){
   if(blocked(c()))return false;
   const t=event.target;
   if(t?.dataset?.rdField!=='agent-module-tick')return false;
   const i=Number(t.dataset.index);
   if(Number.isInteger(i)&&i>=0&&i<8)void mutate(t.dataset.moduleId,m=>{if(i<array(m.items).length){m.ticks||=[];m.ticks[i]=t.checked===true;}});
   return true;
  }
  return {sync,click,change};
 }
 return {resolve,renderModule,expire,create};
});
