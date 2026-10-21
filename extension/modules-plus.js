/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// A better Modules page on Canvas. On a course's Modules page (or a course home that shows modules) it adds
//  - a done circle on every item: filled when Canvas says it's done (a completion requirement met, or the assignment,
//    quiz or graded discussion submitted, graded or excused); for readings, pages, files and links it fills when you
//    open them, and you can tick or untick any of those yourself;
//  - a progress count and bar on each module header ("5 of 8 done");
//  - a "Continue" button to the first item not done yet, and a "Hide finished" switch (remembered).
// Canvas's own list, links and order stay exactly as they are; nothing is sent to Canvas (only reads). Marks you set
// are kept in this browser (the Canvas page's localStorage), per course. Opening an item from anywhere with Canvas's
// module_item_id in its address (Canvas adds it to links from modules) also counts as opened.
// Many schools' teachers set no completion requirements, so Canvas's own module progress stays empty; submissions and
// "opened" marks are what make the circles useful there. Off while Canvas Harness is switched off.
(function(root){
 'use strict';
 const KEY='reserve:moduleProgress',PREF='reserve:modulesHideDone';
 const GRADABLE=new Set(['Assignment','Quiz','Discussion']),SKIP=new Set(['SubHeader']);

 // ---- the rules, without the page (tests use these) ----
 // item: Canvas module item (type, content_id, completion_requirement); subs: Map content key -> submission info;
 // mark: this browser's mark ('done' | 'opened' | 'undone' | undefined). Returns {done, by, canToggle}.
 function statusOf(item,subs,mark){
  if(SKIP.has(item.type))return null;
  const req=item.completion_requirement;
  if(req?.completed)return {done:true,by:'canvas',canToggle:false};
  const sub=subs.get(`${item.type}:${item.content_id}`);
  if(sub?.done)return {done:true,by:'submitted',canToggle:false};
  if(GRADABLE.has(item.type)&&sub)return {done:mark==='done',by:mark==='done'?'you':'',canToggle:true};// opening a task isn't finishing it
  if(mark==='done')return {done:true,by:'you',canToggle:true};
  if(mark==='opened')return {done:true,by:'opened',canToggle:true};
  return {done:false,by:'',canToggle:true};
 }
 function progress(items,subs,marks){
  let done=0,total=0;
  for(const it of items){const s=statusOf(it,subs,marks[it.id]);if(!s)continue;total++;if(s.done)done++;}
  return {done,total};
 }
 function nextItem(modules,subs,marks){
  for(const m of modules){if(m.state==='locked')continue;
   for(const it of m.items||[]){const s=statusOf(it,subs,marks[it.id]);if(s&&!s.done&&!it.content_details?.locked_for_user)return it;}}
  return null;
 }
 // assignments (with submission) -> who is done, keyed the way module items point at them
 function submissions(assignments){
  const map=new Map();
  for(const a of assignments||[]){
   // done = handed in, excused, or graded (a teacher may grade work done in class or on paper)
   const s=a.submission||{},done=!!(s.submitted_at||s.excused||s.workflow_state==='graded'||s.workflow_state==='pending_review');
   const info={done,missing:!!s.missing,due:a.due_at};
   map.set(`Assignment:${a.id}`,info);
   if(a.quiz_id)map.set(`Quiz:${a.quiz_id}`,info);
   if(a.discussion_topic?.id)map.set(`Discussion:${a.discussion_topic.id}`,info);
  }
  return map;
 }
 if(typeof module==='object'&&module.exports){module.exports={statusOf,progress,nextItem,submissions};return;}
 if(root.top!==root||root.ReserveModulesProgress||!root.ReserveSite?.supported?.(root.location?.href))return;
 root.ReserveModulesProgress=true;

 // ---- this browser's marks ----
 const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{return {};}};
 const saveMark=(course,item,value)=>{const all=load();all[course]=all[course]||{};if(value)all[course][item]=value;else delete all[course][item];try{localStorage.setItem(KEY,JSON.stringify(all));}catch{}};
 const course=()=>(/^\/courses\/(\d+)/.exec(location.pathname)||[])[1];
 // opened from anywhere with Canvas's module_item_id (links from Modules carry it)
 {const c=course(),mi=new URLSearchParams(location.search).get('module_item_id');if(c&&/^\d+$/.test(mi||'')){const m=load()[c]?.[mi];if(!m)saveMark(c,mi,'opened');}}

 const CSS=`
 .reserve-mods-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 14px;padding:10px 14px;border-radius:12px;
  background:var(--chn-sidebar,#F5F4ED);border:1px solid color-mix(in srgb,var(--chn-accent,#A9522F) 22%,#E8E6DC);font:450 14px/1.3 var(--chn-font,"Segoe UI",system-ui,sans-serif);color:var(--chn-ink2,#3D3D3A)}
 .reserve-mods-bar .reserve-mods-sum{font-weight:650;color:var(--chn-ink,#141413)}
 .reserve-mods-bar .reserve-mods-meter{flex:0 0 120px;height:6px;border-radius:3px;background:color-mix(in srgb,var(--chn-ink2,#3D3D3A) 14%,transparent);overflow:hidden}
 .reserve-mods-bar .reserve-mods-meter i{display:block;height:100%;background:var(--chn-accent,#A9522F);border-radius:3px}
 .reserve-mods-go{margin-left:auto;display:inline-flex;align-items:center;gap:6px;max-width:min(420px,60vw);padding:7px 12px;border-radius:9px;background:var(--chn-accent,#A9522F);color:#fff!important;font-weight:650;text-decoration:none!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .reserve-mods-go:hover{filter:brightness(1.08)}
 .reserve-mods-go small{font-weight:450;opacity:.85}
 .reserve-mods-hide{display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
 .reserve-mods-hide input{accent-color:var(--chn-accent,#A9522F);width:16px;height:16px;margin:0}
 .reserve-mod-prog{display:inline-flex;align-items:center;gap:8px;margin-left:12px;font:600 12px/1 var(--chn-font,"Segoe UI",system-ui,sans-serif);color:var(--chn-ink2,#3D3D3A);white-space:nowrap}
 .reserve-mod-prog i{display:inline-block;width:64px;height:5px;border-radius:3px;background:color-mix(in srgb,var(--chn-ink2,#3D3D3A) 14%,transparent);overflow:hidden;vertical-align:middle}
 .reserve-mod-prog i b{display:block;height:100%;background:var(--chn-accent,#A9522F)}
 .reserve-mod-all{margin-left:4px;padding:2px 8px;border-radius:7px;border:1px solid color-mix(in srgb,var(--chn-ink2,#3D3D3A) 30%,transparent);background:#fff;color:var(--chn-ink2,#3D3D3A);font:600 11px/16px var(--chn-font,"Segoe UI",system-ui,sans-serif);cursor:pointer}
 .reserve-mod-all:hover{border-color:var(--chn-accent,#A9522F);color:var(--chn-accent,#A9522F)}
 .reserve-mod-prog.is-done{color:#3f7a37}.reserve-mod-prog.is-done i b{background:#3f7a37}
 .reserve-mod-check{flex:none;align-self:center;width:20px;height:20px;margin:0 10px 0 4px;padding:0;border-radius:50%;cursor:pointer;
  border:1.6px solid color-mix(in srgb,var(--chn-ink2,#3D3D3A) 45%,transparent);background:#fff;display:inline-grid;place-items:center;color:#fff}
 .reserve-mod-check svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;opacity:0}
 .reserve-mod-check.is-done{background:var(--chn-accent,#A9522F);border-color:var(--chn-accent,#A9522F)}
 .reserve-mod-check.is-done svg{opacity:1}
 .reserve-mod-check.by-canvas,.reserve-mod-check.by-submitted{background:#3f7a37;border-color:#3f7a37;cursor:default}
 .reserve-mod-check.by-opened{background:color-mix(in srgb,var(--chn-accent,#A9522F) 55%,#fff);border-color:color-mix(in srgb,var(--chn-accent,#A9522F) 55%,#fff)}
 .reserve-mod-check:focus-visible{outline:2px solid var(--chn-accent,#A9522F);outline-offset:2px}
 li.context_module_item.reserve-mod-next > .ig-row{box-shadow:inset 3px 0 0 var(--chn-accent,#A9522F);background:color-mix(in srgb,var(--chn-accent,#A9522F) 6%,#fff)}
 li.context_module_item.reserve-mod-next .item_name::after{content:"Up next";margin-left:8px;padding:1px 7px;border-radius:7px;font:650 11px/16px var(--chn-font,"Segoe UI",system-ui,sans-serif);color:#fff;background:var(--chn-accent,#A9522F);vertical-align:1px}
 html.reserve-mods-hide-done li.context_module_item.reserve-mod-done{display:none!important}
 html.reserve-mods-hide-done .context_module.reserve-mod-all-done .content{display:none}`;
 const CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
 const api=path=>fetch(path,{headers:{Accept:'application/json'},credentials:'same-origin'}).then(r=>r.ok?r.json():null).catch(()=>null);
 async function all(path){const out=[];let url=path;for(let i=0;i<10&&url;i++){const r=await fetch(url,{headers:{Accept:'application/json'},credentials:'same-origin'}).catch(()=>null);if(!r?.ok)break;const page=await r.json();if(!Array.isArray(page))break;out.push(...page);const next=/<([^>]+)>;\s*rel="next"/.exec(r.headers.get('link')||'');url=next?next[1]:null;}return out;}

 let state=null;
 async function start(){
  const list=document.getElementById('context_modules');const c=course();if(!list||!c||list.dataset.reserveMods)return;
  list.dataset.reserveMods='1';
  const [modules,assignments]=await Promise.all([all(`/api/v1/courses/${c}/modules?include[]=items&include[]=content_details&per_page=50`),all(`/api/v1/courses/${c}/assignments?include[]=submission&per_page=100`)]);
  if(!modules.length)return;
  for(const m of modules)if(!Array.isArray(m.items))m.items=await all(`/api/v1/courses/${c}/modules/${m.id}/items?include[]=content_details&per_page=100`);
  state={c,modules,subs:submissions(assignments)};
  if(!document.getElementById('reserve-mods-style')){const st=document.createElement('style');st.id='reserve-mods-style';st.textContent=CSS;(document.head||document.documentElement).append(st);}
  let hide=false;try{hide=localStorage.getItem(PREF)==='1';}catch{}
  document.documentElement.classList.toggle('reserve-mods-hide-done',hide);
  const bar=document.createElement('div');bar.className='reserve-mods-bar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Your progress in this course');
  list.before(bar);
  bar.addEventListener('change',e=>{if(e.target.matches('.reserve-mods-hide input')){const on=e.target.checked;try{localStorage.setItem(PREF,on?'1':'0');}catch{}document.documentElement.classList.toggle('reserve-mods-hide-done',on);}});
  // opening an item from this page counts as opened (the mark is set before Canvas navigates)
  list.addEventListener('click',e=>{const a=e.target.closest('a.ig-title');const li=a?.closest('li.context_module_item');const id=li?.id.replace('context_module_item_','');
   if(id&&!load()[c]?.[id])saveMark(c,id,'opened');},true);
  // catching up: everything in a module you can tick yourself becomes done (Canvas-confirmed items are already done)
  list.addEventListener('click',e=>{const b=e.target.closest('.reserve-mod-all');if(!b)return;e.preventDefault();e.stopPropagation();
   const m=state.modules.find(x=>String(x.id)===b.dataset.module),marks=load()[c]||{};
   for(const it of m?.items||[]){const s=statusOf(it,state.subs,marks[it.id]);if(s&&!s.done&&s.canToggle)saveMark(c,String(it.id),'done');}paint();},true);
  list.addEventListener('click',e=>{const b=e.target.closest('.reserve-mod-check');if(!b)return;e.preventDefault();e.stopPropagation();
   if(b.disabled)return;const id=b.dataset.item,cur=load()[c]?.[id],item=findItem(id),s=statusOf(item,state.subs,cur);
   saveMark(c,id,s.done?'undone':'done');paint();});
  paint();
 }
 const findItem=id=>{for(const m of state.modules)for(const it of m.items||[])if(String(it.id)===String(id))return it;return null;};
 function paint(){
  const {c,modules,subs}=state,marks=load()[c]||{},list=document.getElementById('context_modules');
  let done=0,total=0;
  const next=nextItem(modules,subs,marks);
  for(const m of modules){
   const box=list.querySelector(`.context_module[data-module-id="${m.id}"]`);if(!box)continue;
   const p=progress(m.items||[],subs,marks);done+=p.done;total+=p.total;
   box.classList.toggle('reserve-mod-all-done',p.total>0&&p.done===p.total);
   const head=box.querySelector('.ig-header .collapse_module_link')?.parentElement||box.querySelector('.ig-header');
   let tag=box.querySelector('.reserve-mod-prog');
   if(p.total){if(!tag){tag=document.createElement('span');tag.className='reserve-mod-prog';(box.querySelector('.ig-header .module_header_items')||head).before(tag);}
    tag.classList.toggle('is-done',p.done===p.total);tag.innerHTML=`${p.done===p.total?'✓ ':''}${p.done} of ${p.total} done <i aria-hidden="true"><b style="width:${Math.round(100*p.done/p.total)}%"></b></i>`+
     (p.done<p.total?`<button type="button" class="reserve-mod-all" data-module="${m.id}">Mark all done</button>`:'');}
   else tag?.remove();
   for(const it of m.items||[]){
    const li=box.querySelector(`#context_module_item_${it.id}`);if(!li)continue;
    const s=statusOf(it,subs,marks[it.id]);li.classList.toggle('reserve-mod-next',next?.id===it.id);
    if(!s){li.classList.remove('reserve-mod-done');continue;}
    li.classList.toggle('reserve-mod-done',s.done);
    let b=li.querySelector('.reserve-mod-check');
    if(!b){b=document.createElement('button');b.type='button';b.className='reserve-mod-check';b.dataset.item=it.id;b.innerHTML=CHECK;const row=li.querySelector('.ig-row');(row?.querySelector('.type_icon')||row?.firstChild)?.before?.(b);if(!b.isConnected)row?.prepend(b);}
    b.className=`reserve-mod-check${s.done?' is-done':''}${s.by?' by-'+s.by:''}`;b.disabled=!s.canToggle;
    const label={canvas:'Done on Canvas',submitted:'Submitted on Canvas',opened:'Opened (click to mark not done)',you:'Marked done (click to undo)'}[s.by]||'Mark as done';
    b.title=label;b.setAttribute('aria-label',`${label}: ${it.title}`);b.setAttribute('aria-pressed',String(s.done));
   }
  }
  const bar=document.querySelector('.reserve-mods-bar');
  const pct=total?Math.round(100*done/total):0;
  bar.innerHTML=`<span class="reserve-mods-sum">${done} of ${total} done</span><span class="reserve-mods-meter" aria-hidden="true"><i style="width:${pct}%"></i></span>`+
   `<label class="reserve-mods-hide"><input type="checkbox"${document.documentElement.classList.contains('reserve-mods-hide-done')?' checked':''}> Hide finished</label>`;
  if(next?.html_url){const a=document.createElement('a');a.className='reserve-mods-go';a.href=next.html_url;a.innerHTML='Continue: ';const t=document.createElement('span');t.textContent=next.title;a.append(t,' →');
   a.addEventListener('click',()=>{if(!load()[c]?.[next.id])saveMark(c,String(next.id),'opened');});bar.append(a);}
  else if(total){const s=document.createElement('span');s.className='reserve-mods-go';s.style.background='#3f7a37';s.textContent='All caught up ✓';bar.append(s);}
 }
 // the page may come back from the back/forward cache with marks changed elsewhere
 window.addEventListener('pageshow',e=>{if(e.persisted&&state)paint();});
 // only while Canvas Harness is on (the popup's switch)
 const go=()=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();};
 try{root.chrome.storage.local.get('reserve:enabled').then(v=>{if(v['reserve:enabled']!==false)go();}).catch(go);}catch{go();}
})(globalThis);
