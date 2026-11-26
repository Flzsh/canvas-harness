/*! Canvas Harness: Multitask on an assignment's own pages (roadmap item 8, 4.2): another assignment open beside this one
   for reading, and the small tools that help while working (the Home focus timer and the Home notes). */
// What it is, and what it may never do:
// - Two drawn chips in Canvas's breadcrumb row, before the page switch ("Canvas Harness on this page"): Open beside and Tools. In the
//   page's own flow at the top, never fixed, never near Submit. Nothing opens by itself (Tools is closed until pressed).
// - The second assignment is OUR reading view built from Canvas's API (one GET of that assignment), not a frame of
//   Canvas's page: there is no form, no file field and no Submit in it, so nothing can be handed in from the side. Teacher
//   HTML goes through the dashboard's own sanitizer (ui-utils.js safeRichHTML: no images, frames, forms or scripts), so the
//   side reaches no site but Canvas; its links open in a new tab.
// - The side column is a fixed sheet that takes room from the page (body padding on its edge, as the Tools dock does on
//   Canvas's other pages), is the FIRST child of body at z-index 0, so every positioned thing of Canvas's (its menus,
//   dialogs, a fixed footer with Submit) paints above it; and a guard (submitGuard) checks that no Submit-like control of
//   Canvas's is ever under it: a fixed bar at the bottom pushes the column up, anything else moves the column to the other
//   side, and if both would cover it, the column closes.
// - Switched off on this page (the page switch, site.js pageOff), or "On Canvas" off, or Quick open & study tools off:
//   start() never runs, so nothing of ours exists here: no node, class, listener, timer or request (ReserveFeatures.early).
// - Requests: only the student's own Canvas (the profile, that assignment, and this course's list when there is no saved
//   dashboard data). Nothing typed into Canvas is read or kept. The search text is not kept. Notes are the Home scratchpad
//   itself (saved on this device as on Home).
// - Kept per assignment in Canvas's own site storage (reserve:beside, the 50 most recent, about 7 KB): which assignment is
//   beside, the column's size and side, the tab, the reading place. So a reload finds it where it was.
(function(root){
 'use strict';
 const KEY='reserve:beside',CAP=50,RATIO=.42,MIN_PANE=300,MIN_PAGE=520,MIN_STACK=180,PAGE=/^\d+\/\d+$/;
 const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
 // ---- saved place (pure) ----
 function cleanState(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const ratio=Number.isFinite(value.r)?clamp(value.r,.2,.8):RATIO;
  return {t:value.t==='tools'?'tools':'beside',b:typeof value.b==='string'&&PAGE.test(value.b)?value.b:'',n:typeof value.n==='string'?value.n.slice(0,160):'',
   r:Math.round(ratio*1000)/1000,s:value.s===1?1:0,y:Number.isFinite(value.y)&&value.y>0?Math.min(Math.round(value.y),1e6):0,
   l:Number.isFinite(value.l)&&value.l>=0&&value.l<=400?Math.round(value.l):0,at:Number.isFinite(value.at)?value.at:0};
 }
 function readAll(storage){
  try{const raw=JSON.parse(storage?.getItem(KEY)||'null');if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
   const out={};for(const [key,value] of Object.entries(raw)){if(!PAGE.test(key))continue;const clean=cleanState(value);if(clean)out[key]=clean;}return out;
  }catch{return {};}
 }
 const readState=(storage,key)=>key&&PAGE.test(key)?readAll(storage)[key]||null:null;
 function writeState(storage,key,state,now=Date.now()){
  if(!key||!PAGE.test(key))return false;
  const all=readAll(storage);if(state){const clean=cleanState({...state,at:now});if(!clean)return false;all[key]=clean;}else delete all[key];
  const keys=Object.keys(all).sort((a,b)=>all[a].at-all[b].at);while(keys.length>CAP)delete all[keys.shift()];
  try{if(Object.keys(all).length)storage.setItem(KEY,JSON.stringify(all));else storage.removeItem(KEY);}catch{return false;}
  return true;
 }
 // ---- where the column goes (pure) ----
 // Side by side while Canvas's page keeps MIN_PAGE and the column MIN_PANE beside Canvas's own menu column (lead): a fixed
 // column on the right (or the left, swapped) that takes its room from the page. clear: a fixed bar of Canvas's at the
 // bottom (the column ends above it); cap: the most it may take while Canvas's own page needs the width (see squeezedBy).
 // Below that, or when Canvas needs the whole width (stack), it STACKS: a block in the page's own flow at the top, above
 // Canvas's page, so nothing of Canvas's ever scrolls under it.
 function layout({vw,vh,lead=0,ratio=RATIO,swap=false,clear=0,cap=0,stack=false}){
  const avail=Math.max(0,vw-lead),bar=Math.max(0,Math.round(clear||0));
  if(!stack&&avail-MIN_PAGE>=MIN_PANE){
    let size=Math.round(clamp(ratio*avail,MIN_PANE,avail-MIN_PAGE));
    if(cap>0)size=Math.max(MIN_PANE,Math.min(size,Math.round(cap)));
    return {mode:'side',edge:swap?'left':'right',size,lead,clear:bar,avail};
  }
  const low=Math.min(MIN_STACK,Math.round(vh/2));
  return {mode:'stack',edge:'top',size:Math.round(clamp(ratio*vh,low,Math.max(low,vh-200))),lead,clear:0,avail:vh};
 }
 // the ratio a pointer at (x, y) asks for (top: where the stacked block starts in the window now)
 function ratioAt(g,x,y,vw,vh,top=0){
  const size=g.edge==='right'?vw-x:g.edge==='left'?x-g.lead:y-top;
  return g.avail>0?clamp(size/g.avail,.2,.8):RATIO;
 }
 function hostCSS(g){
  const s=g.size+'px';
  if(g.mode==='stack')return `position:relative;z-index:0;display:block;margin:0 0 0 ${g.lead}px;height:${s}`;
  return 'position:fixed;z-index:0;margin:0;'+(g.edge==='right'?`top:0;right:0;bottom:${g.clear}px;width:${s}`:`top:0;left:${g.lead}px;bottom:${g.clear}px;width:${s}`);
 }
 // The room the column takes from Canvas's page, on top of the page's own padding (base, CSS lengths). Stacked, the
 // block takes its own room in the flow: nothing to add.
 function pageCSS(g,base={}){
  if(g.mode==='stack')return '';
  const side=g.edge==='left'?'left':'right';
  return `body{box-sizing:border-box!important;padding-${side}:calc(${base[side]||'0px'} + ${g.size}px)!important}`;
 }
 // ---- Canvas's Submit (pure where it can be) ----
 const SUBMIT_SELECTOR='#submit_assignment,.submit_assignment_link,#submit_file_button,[data-testid="submit-button"],button[type="submit"],input[type="submit"]';
 const SUBMIT_TEXT=/^(?:submit(?: assignment)?|start assignment|new attempt|try again|re-?submit(?: assignment)?|turn (?:it )?in|upload(?: a)? file|upload|cancel attempt|mark as done)!?$/i;
 const submitLike=el=>{try{return el.matches?.(SUBMIT_SELECTOR)||SUBMIT_TEXT.test(String(el.textContent||el.value||'').replace(/\s+/g,' ').trim());}catch{return false;}};
 const meets=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
 // controls: [{el,rect,bar}] (bar: the rect of a fixed or sticky ancestor, when there is one, or barOf(el) asks for it);
 // pane: our column's rect; topAt(x,y): the element painted on top there. Covered = at a point inside the control, ours
 // is on top. A Submit in a bar along the bottom that reaches the column asks for clearance (the column ends above the
 // bar, so the two never meet, whichever paints on top); any other covered control asks the column to move.
 function submitGuard({controls,pane,topAt,ours,vh,barOf=()=>null}){
  let clear=0,move=false;const covered=[];
  for(const control of controls){
   const {el,rect}=control;
   if(!rect||rect.width<1||rect.height<1)continue;
   // (a DOMRect's sides are getters, not own properties: read one by one, never spread)
   const bar=control.bar!==undefined?control.bar:meets(rect,{left:pane.left,right:pane.right,top:pane.top,bottom:Math.max(pane.bottom,vh)})?barOf(el):null;
   const bottom=!!bar&&bar.bottom>=vh-2&&bar.top>vh*.45;
   if(bottom&&bar.left<pane.right&&pane.left<bar.right&&pane.bottom>bar.top)clear=Math.max(clear,Math.ceil(vh-bar.top)+4);
   if(!meets(rect,pane))continue;
   const box={left:Math.max(rect.left,pane.left),right:Math.min(rect.right,pane.right),top:Math.max(rect.top,pane.top),bottom:Math.min(rect.bottom,pane.bottom)};
   const points=[[(box.left+box.right)/2,(box.top+box.bottom)/2],[box.left+1,box.top+1],[box.right-1,box.top+1],[box.left+1,box.bottom-1],[box.right-1,box.bottom-1]];
   if(!points.some(([x,y])=>topAt(x,y)===ours))continue;
   covered.push(el);if(!bottom)move=true;
  }
  return {clear,move,covered};
 }
 // Canvas's own Submit painted over by Canvas's own page: what narrowing a page laid out for a wider window does (its
 // sidebar runs over its buttons). At the centre of a Submit in the window, something of Canvas's in the page's own flow
 // (not a menu, dialog or bar: floating(el) says) is on top. before: the ones already so before the column opened.
 function squeezedBy({controls,topAt,ours,vw,vh,floating=()=>false,before=new Set()}){
  const out=[];
  for(const {el,rect} of controls){
   if(!rect||rect.width<1||rect.height<1||before.has(el))continue;
   const x=(rect.left+rect.right)/2,y=(rect.top+rect.bottom)/2;if(x<0||y<0||x>=vw||y>=vh)continue;
   const top=topAt(x,y);if(!top||top===el||top===ours||el.contains?.(top)||top.contains?.(el)||floating(top))continue;
   out.push(el);
  }
  return out;
 }
 // ---- the Home focus timer's own changes (pure): the same `focus` record the Home module writes (widgets.js startFocus,
 // focusControl, timer-minutes, timer-reset), so the timer here and the one on Home are one timer. ----
 function focusChange(data,action,{now=Date.now(),minutes,Core=root.ReserveCore}={}){
  if(!Core?.focusState||!Core.resetFocus)return false;
  const focus=data.focus||{},f=Core.focusState(focus,now);
  if(action==='start'){
   if(f.paused)return focusChange(data,'resume',{now,Core});
   if(f.running)return false;const next=Core.resetFocus(focus,focus.focusMinutes||f.minutes,now);if(!next)return false;data.focus={...next,fromPony:false};return true;
  }
  if(action==='minutes'){if(focus.endsAt)return false;const next=Core.resetFocus(focus,minutes,now);if(!next)return false;data.focus={...next,endsAt:null};return true;}
  if(action==='reset'){const next=Core.resetFocus(focus,focus.focusMinutes||f.minutes,now);if(!next)return false;data.focus={...next,endsAt:null};return true;}
  if(!['pause','resume','stop','adjust'].includes(action)||action==='adjust'&&!Number.isFinite(minutes))return false;
  Core.settleFocus?.(data,now);const g=Core.focusState(data.focus,now);
  if(!g.active||g.left<=0||action==='pause'&&!g.running||action==='resume'&&!g.paused)return false;
  const next={...data.focus,remaining:g.left,elapsed:g.elapsed};
  if(action==='pause'){next.endsAt=null;next.pausedAt=now;}
  if(action==='resume'){next.endsAt=now+g.left*1000;next.pausedAt=0;}
  if(action==='stop')Object.assign(next,{endsAt:null,pausedAt:0,stoppedAt:now,completedAt:0,completedMinutes:0,breakUntil:0});
  if(action==='adjust'){
    const left=Math.max(60,g.left+minutes*60);
    if(!Number.isFinite(left)||now+left*1000>8640000000000000)return false;
    Object.assign(next,{remaining:left,minutes:(g.elapsed+left)/60,endsAt:g.running?now+left*1000:null});
  }
  if(next.phase==='break')next.breakUntil=next.endsAt||0;
  data.focus=next;return true;
 }
 // ---- the finder: Quick open's own entries and ranking (quick-open.js), assignments only, this one left out ----
 function finderRows(pool,{query='',courseId='',current='',now=Date.now(),QuickOpen=root.ReserveQuickOpen,limit=40}={}){
  const own=pool.filter(entry=>entry.kind==='Assignments'&&entry.assignmentId&&`${entry.courseId}/${entry.assignmentId}`!==current);
  if(String(query).trim())return (QuickOpen?.search?QuickOpen.search(own,query,{limit,courseId:courseId||'all'}):own).map(row=>({...row,group:''}));
  const due=row=>{const ms=Date.parse(row.dueAt);return Number.isFinite(ms)?ms:Infinity;},soon=row=>!row.done&&due(row)>=now-7*864e5&&due(row)<=now+21*864e5;
  const here=own.filter(row=>row.courseId===String(courseId)).sort((a,b)=>(soon(b)-soon(a))||due(a)-due(b)||String(a.label).localeCompare(String(b.label)));
  const other=own.filter(row=>row.courseId!==String(courseId)&&soon(row)).sort((a,b)=>due(a)-due(b));
  return [...here.map(row=>({...row,group:'This course'})),...other.map(row=>({...row,group:'Due soon'}))].slice(0,limit);
 }
 const TYPES={
   online_upload:'a file upload',
   online_text_entry:'a text entry',
   online_url:'a website address',
   media_recording:'a recording',
   online_quiz:'a quiz',
   discussion_topic:'a discussion',
   external_tool:'an outside tool',
   student_annotation:'notes on a document',
   on_paper:'on paper',
   none:'nothing online'
 };
 // The reading view of the assignment beside: the dashboard reader's parts (its sanitizer, its sections), no form at all.
 function readingHTML(item,{E,rich,icon,when,status='',course=''}){
  const types=(item.submissionTypes||[]).map(type=>TYPES[type]).filter(Boolean),points=(item.rubric||[]).reduce((sum,row)=>sum+(Number(row?.points)||0),0);
  const html=rich(item.description||''),dropped=/<(?:img|iframe|video|audio|object|embed)\b/i.test(item.description||'');
  const links=[],seen=new Set();
  for(const m of html.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)){if(seen.has(m[1])||links.length>=12)continue;seen.add(m[1]);links.push([m[1],m[2].replace(/<[^>]*>/g,'').trim()]);}
  const facts=[item.dueAt?`<span data-tone="due">Due ${E(when(item.dueAt))}</span>`:'<span>No due date</span>',Number.isFinite(item.points)?`<span>${E(item.points)} points</span>`:'',types.length?`<span>Submitting ${E(types.join(', '))}</span>`:'',
   item.unlockAt&&Date.parse(item.unlockAt)>Date.now()?`<span>Opens ${E(when(item.unlockAt))}</span>`:'',
   item.lockAt?`<span>${Date.parse(item.lockAt)>Date.now()?'Closes':'Closed'} ${E(when(item.lockAt))}</span>`:'',
   status?`<span data-tone="state">${E(status)}</span>`:''
  ].filter(Boolean).join('');
  return `<article class="read" aria-labelledby="mt-title"><p class="course">${E(course)}</p><h2 id="mt-title" tabindex="-1">${E(item.name)}</h2><p class="facts">${facts}</p>
<div class="acts-row"><a class="btn" href="${E(item.url)}" target="_blank" rel="noopener noreferrer">${icon('external')}<span>Open in Canvas</span></a><button type="button" class="btn" data-mt="pick">${icon('search')}<span>Pick another</span></button></div>
${links.length?`<section class="links"><h3>Linked materials <b>${links.length}</b></h3>${links.map(([url,label])=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${icon('folder')}<span>${label||url}</span></a>`).join('')}</section>`:''}
<section class="text" aria-label="Instructions"><h3>Instructions</h3><div class="rich">${html.trim()||'<p>No instructions were included.</p>'}</div>${dropped?'<p class="quiet">Pictures and media show in Canvas.</p>':''}</section>
${item.rubric?.length?`<details class="rubric"><summary>${icon('chevron')}<span>Grading rubric</span><small> · ${item.rubric.length} criteri${item.rubric.length===1?'on':'a'}${points?` · ${E(points)} points`:''}</small></summary>${item.rubric.map(row=>`<div><strong>${E(row?.description||'')}</strong><span>${E(row?.points??'—')} pts</span>${row?.long_description?`<p>${E(row.long_description)}</p>`:''}</div>`).join('')}</details>`:''}</article>`;
 }
 const pure={
   KEY,
   CAP,
   RATIO,
   MIN_PANE,
   MIN_PAGE,
   cleanState,
   readAll,
   readState,
   writeState,
   layout,
   ratioAt,
   hostCSS,
   pageCSS,
   SUBMIT_SELECTOR,
   submitLike,
   submitGuard,
   squeezedBy,
   focusChange,
   finderRows,
   readingHTML
 };
 if(typeof module==='object'&&module.exports){module.exports=pure;return;}

 // ---- on the page ----
 // (an assignment's own pages, as site.js vanillaPage says; checked here without the page-start models, which are looked
 // up when used: Edge can run a registered file before them, startup-order.test.cjs)
 const doc=root.document,handIn=()=>{
   try{return root.ReserveSite?.supported?.(root.location.href)===true&&/^\/courses\/\d+\/assignments\/\d+(?:\/|$)/.test(decodeURIComponent(root.location.pathname));}catch{return false;}
 };
 if(root.top!==root||!doc||root.ReserveMultitask||!handIn())return;
 const site={
   pageKey:value=>root.ReserveSite?.pageKey?.(value)||'',
   origin:()=>root.ReserveSite?.origin?.()||'https://school.instructure.com',
   timeZone:()=>root.ReserveSite?.timeZone?.()||'America/New_York'
 };
 const F=()=>root.ReserveFeatures,on=id=>F()?.enabled?.(id)!==false;
 const E=value=>root.ReserveUI?.escapeHTML?.(value)??String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon=name=>root.ReserveIcon?.(name,'ic')||'';
 // Drawings (none new): the two pages side by side are Make it yours's own diagram (customize-ui.js artDiagrams, "still");
 // the line is the pencil track (customize-ui.js MP_ART.lineTrack), turned upright; the grip is the module grip
 // (workspace-arrange.js); the ring is the Home timer's (widgets.js RING); the rest are ReserveIcon's (icons.js).
 const TWO='<svg class="two" viewBox="6 6 60 36" aria-hidden="true" focusable="false"><rect class="soft" x="10" y="10" width="22" height="28" rx="2.5"/><rect class="fill" x="40" y="10" width="22" height="28" rx="2.5"/></svg>';
 const LINE_V='<svg class="line" viewBox="0 0 8 100" preserveAspectRatio="none" aria-hidden="true"><path d="M4.7 1.8 Q3.6 18.1 4.2 26.1 Q4.8 34.1 4.3 42.1 Q3.9 50.1 4.5 58.1 Q5.1 66.2 4.4 74.2 Q3.6 82.2 4.0 90.0 L4.3 97.9"/></svg>';
 const LINE_H='<svg class="line" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><path d="M1.8 4.7 Q18.1 3.6 26.1 4.2 Q34.1 4.8 42.1 4.3 Q50.1 3.9 58.1 4.5 Q66.2 5.1 74.2 4.4 Q82.2 3.6 90.0 4.0 L97.9 4.3"/></svg>';
 const GRIP='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.4"/><circle cx="15" cy="5.5" r="1.4"/><circle cx="8.5" cy="12" r="1.4"/><circle cx="15.5" cy="12" r="1.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="18.5" r="1.4"/></svg>';
 const RING='M61 9C90 7 112 31 111 61C110 90 87 112 59 111C31 110 8 88 9 59C10 32 32 9 60 9C65 9 70 10 75 12';
 // the dock button's pen frame (content.js), as the page switch has it
 const PEN='url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2790%27 height=%2790%27 viewBox=%270 0 90 90%27%3E%3Cpath fill=%27none%27 stroke=%27%23000%27 stroke-width=%273%27 stroke-linecap=%27round%27 d=%27M24 6.2C34 5.4 56 6.6 66 5.8C77 5.6 84.6 12 84.4 24C85 36 83.8 54 84.6 66C84.8 77.6 78 84.6 66 84.4C54 85 36 83.8 24 84.6C12.4 84.8 5.4 78 5.6 66C5 54 6.2 36 5.4 24C5.2 12.6 11.6 6 21.4 6.4C24 6.3 27 5.6 29.6 4.8%27/%3E%3C/svg%3E") 30 30 30 30 stretch';
 const ACCENT='var(--chn-accent,#C96442)',READ='Literata,Georgia,"Palatino Linotype",serif',UI='"Segoe UI",Lato,system-ui,sans-serif';
 const CHIP_CSS=':host{all:initial;display:flex;align-items:center;gap:2px;flex:0 0 auto;margin:0 0 0 auto;padding:6px 0 6px 10px;color:#141413;font:13px/1.3 '+UI+'}:host([data-place=content]){margin:0 0 8px;padding:0;justify-content:flex-end}'
  +'.chip{position:relative;flex:none;display:inline-flex;align-items:center;gap:7px;margin:4px;padding:5px 11px 5px 8px;border:0;border-radius:12px;background:#FAF9F5;color:inherit;font:600 13px/1.2 '+READ+';white-space:nowrap;cursor:pointer;box-shadow:2px 3px 0 #E3D9C6;transition:transform 120ms cubic-bezier(.25,.1,.25,1),box-shadow 120ms cubic-bezier(.25,.1,.25,1),background-color 140ms}'
  +'.chip::after{content:"";position:absolute;inset:-4px;border:13px solid transparent;pointer-events:none;background:color-mix(in srgb,#A9522F 70%,#141413);-webkit-mask-box-image:'+PEN+'}'
  +'.chip:hover{transform:translateY(-1px);background:#FFFDF8;box-shadow:2px 4px 0 #E3D9C6}.chip:active{transform:translateY(1px);background:#F1ECE0;box-shadow:0 1px 0 #E3D9C6}.chip:focus-visible{outline:3px solid #C96442;outline-offset:5px}'
  +'.chip[aria-pressed=true]{background:#EBDBBC;box-shadow:1px 2px 0 #D4A27F}.chip[hidden]{display:none}'
  +'.two{width:26px;height:16px;flex:none;overflow:visible}.two rect{stroke:#2B2A27;stroke-width:2.2;stroke-linejoin:round}.two .soft{fill:#F0EEE6}.two .fill{fill:color-mix(in srgb,'+ACCENT+' 30%,#FAF9F5);stroke:'+ACCENT+'}'
  +'.ic{width:17px;height:17px;flex:none}.note{max-width:30ch;margin:0 6px;color:#5E5D59;font-size:12px}.note[hidden]{display:none}@media(prefers-reduced-motion:reduce){*{transition:none!important}}';
 const COL_CSS=':host{all:initial;display:block;color:#141413;font:14px/1.5 '+UI+';contain:layout paint style}'
  +'.col{position:absolute;inset:0;display:flex;background:#FAF9F5;animation:mt-in 220ms cubic-bezier(.22,.8,.24,1)}'
  +'.col[data-edge=left]{flex-direction:row-reverse}.col[data-edge=bottom]{flex-direction:column}.col[data-edge=top]{flex-direction:column-reverse}'
  +'@keyframes mt-in{from{opacity:0;transform:translateX(var(--mt-from,18px))}}.col[data-edge=left]{--mt-from:-18px}.col[data-mode=stack]{animation-name:mt-up}@keyframes mt-up{from{opacity:0;transform:translateY(14px)}}'
  +'.rule{position:relative;flex:none;width:16px;display:grid;place-items:center;cursor:col-resize;touch-action:none;background:#F3F1EA;outline:none}.col[data-mode=stack] .rule{width:auto;height:16px;cursor:row-resize}'
  +'.rule .line{position:absolute;inset:0 6px;width:4px;height:100%;overflow:visible}.col[data-mode=stack] .rule .line{inset:6px 0;width:100%;height:4px}.rule .line path{fill:none;stroke:#141413;stroke-opacity:.55;stroke-width:1.6;stroke-linecap:round;vector-effect:non-scaling-stroke}'
  +'.grip{position:relative;display:grid;place-items:center;width:16px;height:40px;border:1.3px solid #141413;border-radius:9px 7px 10px 6px/7px 10px 6px 9px;background:#FFFDF8;color:#2B2A27;box-shadow:1.5px 2px 0 rgb(20 20 19/.16);transition:transform 120ms,background-color 140ms}.col[data-mode=stack] .grip{width:40px;height:16px}.col[data-mode=stack] .grip svg{transform:rotate(90deg)}'
  +'.grip svg{width:14px;height:14px}.rule:hover .grip,.rule:focus-visible .grip,.col[data-dragging] .grip{background:#EBDBBC;transform:scale(1.06)}.rule:focus-visible .grip{outline:3px solid #C96442;outline-offset:3px}'
  +'.col[data-dragging]{user-select:none;animation:none}.col[data-dragging] .sheet{pointer-events:none}'
  +'.sheet{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}'
  +'.head{flex:none;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:10px 14px 0 12px;border-bottom:1.3px solid #141413;background:#F3F1EA}'
  +'.tabs,.acts{display:flex;align-items:flex-end;gap:6px;min-width:0}.acts{align-self:center;padding-bottom:8px}'
  +'.tab{position:relative;top:1.3px;display:inline-flex;align-items:center;gap:6px;min-width:0;padding:6px 12px 7px 8px;border:1.3px solid #141413;border-bottom:0;border-radius:9px 7px 0 0/7px 10px 0 0;background:#EBDBBC;color:#2B2A27;font:600 13px/1.2 '+READ+';cursor:pointer;opacity:.82;transition:opacity 140ms,background-color 140ms}'
  +'.tab[hidden],.act[hidden]{display:none}.tab[aria-selected=true]{background:#FAF9F5;opacity:1;padding-bottom:8.3px}.tab:hover{opacity:1}.tab:focus-visible{outline:3px solid #C96442;outline-offset:2px}.tab span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +'.act,.btn{display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 7px;border:1.3px solid #141413;border-radius:9px 7px 10px 6px/7px 10px 6px 9px;background:#FFFDF8;color:#141413;font:600 12.5px/1.2 '+UI+';text-decoration:none;cursor:pointer;box-shadow:1.5px 2px 0 rgb(20 20 19/.16);transition:transform 120ms,background-color 140ms}'
  +'.act:hover,.btn:hover{transform:translateY(-1px);background:#FFF8EC}.act:active,.btn:active{transform:translateY(1px);box-shadow:0 1px 0 rgb(20 20 19/.16)}.act:focus-visible,.btn:focus-visible{outline:3px solid #C96442;outline-offset:2px}'
  +'.ic{width:16px;height:16px;flex:none}.two{width:24px;height:15px;flex:none;overflow:visible}.two rect{stroke:#2B2A27;stroke-width:2.2;stroke-linejoin:round}.two .soft{fill:#F0EEE6}.two .fill{fill:color-mix(in srgb,'+ACCENT+' 30%,#FAF9F5);stroke:'+ACCENT+'}'
  +'.body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:16px 22px 32px;scrollbar-width:thin}'
  +'@container (max-width:380px){.act span{display:none}}.sheet{container-type:inline-size}'
  +'.read .course{margin:0 0 4px;color:#5E5D59;font-size:12.5px;letter-spacing:.02em}.read h2{margin:0 0 10px;font:600 22px/1.25 '+READ+';outline:none}'
  +'.facts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.facts span{padding:2px 9px;border:1px solid #E3D9C6;border-radius:999px;background:#FFFDF8;color:#2B2A27;font-size:12.5px}.facts [data-tone=due]{border-color:color-mix(in srgb,'+ACCENT+' 45%,#E3D9C6)}.facts [data-tone=state]{background:#F0EEE6}'
  +'.acts-row{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}'
  +'.read h3{margin:18px 0 8px;font:600 15px/1.3 '+READ+'}.read h3 b{margin-left:4px;color:#5E5D59;font-weight:600;font-size:12px}'
  +'.links{display:grid;gap:6px}.links a{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #E3D9C6;border-radius:9px;background:#FFFDF8;color:#141413;text-decoration:none}.links a:hover{border-color:#141413}'
  +'.rich{font:15px/1.75 '+READ+';color:#1F1E1B;overflow-wrap:anywhere}.rich>:first-child{margin-top:0}.rich p{margin:0 0 .85em}.rich ul,.rich ol{margin:.25em 0 1em;padding-left:1.35em}.rich li{margin:.3em 0}'
  +'.rich a{color:#A9522F;text-decoration:underline;text-underline-offset:3px}.rich h1,.rich h2,.rich h3,.rich h4{margin:1.3em 0 .5em;font:600 1.05em/1.3 '+READ+'}.rich table{border-collapse:collapse;max-width:100%;display:block;overflow:auto}.rich td,.rich th{border:1px solid #E3D9C6;padding:4px 8px}'
  +'.rich blockquote{margin:1em 0;padding:.6em 1em;border-left:3px solid #D4A27F;background:#F3F1EA}.rich code,.rich pre{font-family:ui-monospace,Consolas,monospace;font-size:.9em}.rich pre{white-space:pre-wrap}.quiet{color:#5E5D59;font-size:12.5px}'
  +'.rubric{margin-top:18px;border:1px solid #E3D9C6;border-radius:10px;background:#FFFDF8}.rubric summary{display:flex;align-items:center;gap:6px;padding:9px 12px;cursor:pointer;font:600 14px/1.3 '+READ+';list-style:none}.rubric summary::-webkit-details-marker{display:none}.rubric summary .ic{transition:transform 160ms}.rubric[open] summary .ic{transform:rotate(90deg)}.rubric small{color:#5E5D59;font:500 12px '+UI+'}'
  +'.rubric div{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:9px 12px;border-top:1px solid #E3D9C6}.rubric div span{color:#5E5D59;font-size:12.5px}.rubric div p{grid-column:1/-1;margin:0;color:#3D3C38;font-size:13px}'
  +'.find label{display:flex;align-items:center;gap:8px;padding:7px 11px;border:1.3px solid #141413;border-radius:10px 8px 11px 7px/8px 11px 7px 10px;background:#FFFDF8}.find input{flex:1;min-width:0;border:0;background:none;font:15px/1.3 '+UI+';color:#141413;outline:none}.find label:focus-within{outline:3px solid #C96442;outline-offset:2px}'
  +'.find h3{margin:16px 0 6px;color:#5E5D59;font:600 12px/1.3 '+UI+';letter-spacing:.04em;text-transform:uppercase}.rows{display:grid;gap:5px}'
  +'.row{display:grid;gap:1px;width:100%;padding:8px 11px;border:1px solid #E3D9C6;border-radius:9px;background:#FFFDF8;color:#141413;text-align:left;cursor:pointer;transition:border-color 120ms,transform 120ms}.row:hover,.row:focus-visible{border-color:#141413;transform:translateX(2px);outline:none}'
  +'.row strong{font:600 14px/1.3 '+READ+'}.row small{color:#5E5D59;font-size:12px}.state{margin:24px 4px;color:#5E5D59}.skel{height:12px;margin:10px 0;border-radius:6px;background:linear-gradient(90deg,#F0EEE6,#F7F4EC,#F0EEE6);background-size:200% 100%;animation:mt-sk 1.2s linear infinite}@keyframes mt-sk{to{background-position:-200% 0}}'
  +'.tools{display:grid;gap:22px}.tool h3{display:flex;align-items:center;gap:7px;margin:0 0 10px;font:600 15px/1.3 '+READ+'}.tool h3 svg{width:20px;height:20px;flex:none}'
  +'.dial{position:relative;width:132px;height:132px;margin:2px auto 10px}.dial svg{width:100%;height:100%}.dial path{fill:none;stroke-linecap:round}.dial .track{stroke:#E3D9C6;stroke-width:7}.dial .arc{stroke:'+ACCENT+';stroke-width:7;stroke-dasharray:1;stroke-dashoffset:var(--mt-left,1);transition:stroke-dashoffset 900ms linear}'
  +'.dial output{position:absolute;inset:0;display:grid;place-items:center;font:600 26px/1 '+READ+';font-variant-numeric:tabular-nums}.phase{display:block;text-align:center;color:#5E5D59;font-size:12px}.phase[hidden]{display:none}'
  +'.row-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:0 0 8px}.btn[disabled],.chipm[disabled]{opacity:.45;cursor:default;transform:none}.btn.primary{background:#EBDBBC}'
  +'.lens{display:flex;justify-content:center;align-items:center;gap:5px;color:#5E5D59;font-size:12px}.chipm{min-width:34px;padding:3px 8px;border:1px solid #E3D9C6;border-radius:999px;background:#FFFDF8;color:#141413;font:600 12px '+UI+';cursor:pointer}.chipm[aria-pressed=true]{border-color:#141413;background:#EBDBBC}'
  +'.notes textarea{box-sizing:border-box;width:100%;min-height:150px;resize:vertical;padding:10px 12px;border:1.3px solid #141413;border-radius:10px 8px 11px 7px/8px 11px 7px 10px;background:#FFFDF8 repeating-linear-gradient(#FFFDF8 0 26px,#EFE8DA 26px 27px);color:#141413;font:15px/27px '+READ+'}.notes textarea:focus{outline:3px solid #C96442;outline-offset:2px}.notes p{margin:6px 2px 0;color:#5E5D59;font-size:12px}'
  +'@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}';

 let started=false,life=null;
 // One life per start(): stop() ends it, and everything it made goes with it.
 function start(){
  if(started)return;started=true;
  const key=site.pageKey?.(root.location)||'';if(!key){started=false;return;}
  const L=life={key,state:readState(root.localStorage,key),dead:false,abort:new AbortController(),listeners:[],timers:new Set(),frames:new Set(),fonts:[],
   chips:null,
   host:null,
   shadow:null,
   sheet:null,
   store:null,
   storeReady:null,
   snapshot:null,
   pool:null,
   items:new Map(),
   item:null,
   itemError:'',
   finding:false,
   query:'',
   note:'',
   noteTimer:0,
   draft:undefined,
   base:null,
   geometry:null,
   tried:false,
   observer:null
  };
  const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);L.listeners.push([target,type,fn,options]);};
  L.listen=listen;
  // A column left open here before: its room is taken before the first paint, the column itself as soon as body exists.
  if(L.state){reserve(L);whenBody(L,()=>mountColumn(L));}
  if(doc.readyState==='loading')listen(doc,'DOMContentLoaded',()=>{if(!L.dead)mountChips(L);},{once:true});else mountChips(L);
 }
 function stop(){
  if(!started)return;started=false;const L=life;life=null;if(!L)return;L.dead=true;
  flushNotes(L,true);
  L.abort.abort();for(const [target,type,fn,options] of L.listeners)try{target.removeEventListener(type,fn,options);}catch{}L.listeners=[];
  for(const t of L.timers){clearTimeout(t);clearInterval(t);}L.timers.clear();for(const f of L.frames)root.cancelAnimationFrame?.(f);L.frames.clear();
  L.observer?.disconnect();L.observer=null;L.unsubscribe?.();
  L.host?.remove();L.chips?.remove();L.sheet?.remove();L.host=L.chips=L.sheet=null;
  for(const face of L.fonts)try{doc.fonts?.delete(face);}catch{}
  try{L.store?.destroy?.();}catch{}L.store=null;
 }
 function whenBody(L,fn){
  if(doc.body){fn();return;}
  const Observer=root.MutationObserver;if(!Observer){L.listen(doc,'DOMContentLoaded',fn,{once:true});return;}
  L.observer=new Observer(()=>{if(doc.body){L.observer.disconnect();L.observer=null;if(!L.dead)fn();}});L.observer.observe(doc.documentElement,{childList:true});
 }
 const timer=(L,fn,ms,repeat=false)=>{const t=(repeat?setInterval:setTimeout)(()=>{if(!repeat)L.timers.delete(t);fn();},ms);L.timers.add(t);return t;};
 const frame=(L,fn)=>{const id=root.requestAnimationFrame(()=>{L.frames.delete(id);if(!L.dead)fn();});L.frames.add(id);return id;};
 function save(L){if(L.dead)return;writeState(root.localStorage,L.key,L.state);}

 // ---- the chips ----
 function placeChips(L){
  const host=L.chips,crumbs=doc.querySelector('.ic-app-nav-toggle-and-crumbs'),sw=doc.querySelector('reserve-page-switch');
  if(crumbs&&crumbs.getClientRects?.().length){host.removeAttribute('data-place');if(sw?.parentNode===crumbs)crumbs.insertBefore(host,sw);else crumbs.append(host);return true;}
  const content=doc.getElementById('content');
  if(content){host.setAttribute('data-place','content');if(sw?.parentNode===content)content.insertBefore(host,sw);else content.prepend(host);return true;}
  return false;
 }
 function mountChips(L){
  if(L.dead||L.chips)return;
  const host=doc.createElement('reserve-multitask'),shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML='<style>'+CHIP_CSS+'</style><button type="button" class="chip" data-mt="open-beside" aria-pressed="false">'+TWO+'<span>Open beside</span></button><button type="button" class="chip" data-mt="open-tools" aria-pressed="false" hidden>'+icon('toolbox')+'<span>Tools</span></button><span class="note" role="status" hidden></span>';
  L.chips=host;L.chipRoot=shadow;
  shadow.addEventListener('click',event=>act(L,event));
  if(!placeChips(L)){L.chips=null;return;}
  syncChips(L);
 }
 const toolsOffered=()=>on('planner')&&!!root.ReserveCore?.focusState;
 function syncChips(L){
  const r=L.chipRoot;if(!r)return;const s=L.state;
  const b=r.querySelector('[data-mt="open-beside"]'),t=r.querySelector('[data-mt="open-tools"]');
  b?.setAttribute('aria-pressed',String(!!s&&s.t==='beside'));if(t){t.hidden=!toolsOffered();t.setAttribute('aria-pressed',String(!!s&&s.t==='tools'));}
  const note=r.querySelector('.note');if(note){note.textContent=L.note;note.hidden=!L.note;}
 }
 function tell(L,text){L.note=text;syncChips(L);if(text)timer(L,()=>{if(L.note===text){L.note='';syncChips(L);}},7000);}

 // ---- the column ----
 function measure(L){
  const vw=root.innerWidth||doc.documentElement.clientWidth||1280,vh=root.innerHeight||doc.documentElement.clientHeight||800;
  // Canvas's own menu column is the margin before its page (#wrapper); before the page exists, the one seen last time
  let lead=L.state.l||0,found=false;const wrapper=doc.getElementById?.('wrapper');
  if(wrapper&&root.getComputedStyle){
    const m=parseFloat(root.getComputedStyle(wrapper).marginLeft);
    if(Number.isFinite(m)&&m>=0&&m<=400){lead=Math.round(m);found=true;}
  }
  return {vw,vh,lead,found};
 }
 function reserve(L){
  const {vw,vh,lead,found}=measure(L),g=L.geometry=layout({vw,vh,lead,ratio:L.state.r,swap:L.state.s===1,clear:L.clear||0,cap:L.cap||0,stack:!!L.stack});
  if(found)L.state.l=lead;
  if(!L.base&&doc.body&&root.getComputedStyle){
    if(L.sheet)L.sheet.disabled=true;
    const cs=root.getComputedStyle(doc.body);
    L.base={right:cs.paddingRight,left:cs.paddingLeft};
    if(L.sheet)L.sheet.disabled=false;
  }
  const text=pageCSS(g,L.base||{});
  if(!text){L.sheet?.remove();L.sheet=null;}
  else{
    if(!L.sheet){L.sheet=doc.createElement('style');L.sheet.dataset.reserveBeside='';(doc.head||doc.documentElement).append(L.sheet);}
    if(L.sheet.textContent!==text)L.sheet.textContent=text;
  }
  if(L.host){
    L.host.style.cssText=hostCSS(g);
    const col=L.shadow?.querySelector('.col');
    if(col&&(col.dataset.edge!==g.edge||col.dataset.mode!==g.mode))paintFrame(L);
    syncRule(L);
  }
  return g;
 }
 function syncRule(L){
  const rule=L.shadow?.querySelector('.rule'),g=L.geometry;if(!rule||!g)return;
  rule.setAttribute('aria-orientation',g.mode==='side'?'vertical':'horizontal');rule.setAttribute('aria-valuenow',String(Math.round(g.size/Math.max(1,g.avail)*100)));
 }
 function paintFrame(L){
  const g=L.geometry,s=L.state,col=L.shadow.querySelector('.col');
  col.dataset.edge=g.edge;col.dataset.mode=g.mode;
  col.querySelector('.rule').innerHTML=(g.mode==='side'?LINE_V:LINE_H)+'<span class="grip">'+GRIP+'</span>';
  const tabs=col.querySelectorAll('.tab');for(const tab of tabs){const mine=tab.dataset.mt==='tab-'+s.t;tab.setAttribute('aria-selected',String(mine));tab.tabIndex=mine?0:-1;}
  const tools=col.querySelector('[data-mt="tab-tools"]');if(tools)tools.hidden=!toolsOffered();
  // (stacked, the block sits above Canvas's page in its flow: there is no other side to swap to)
  const swap=col.querySelector('[data-mt="swap"]');if(swap)swap.hidden=g.mode==='stack';
 }
 function mountColumn(L,fresh=false){
  if(L.dead||L.host||!L.state||!doc.body)return;
  registerFont(L);
  const host=doc.createElement('reserve-beside'),shadow=host.attachShadow({mode:'open'});
  host.setAttribute('role','complementary');host.setAttribute('aria-label','Beside this page');
  shadow.innerHTML='<style>'+COL_CSS+'</style><div class="col"><div class="rule" data-mt="rule" role="separator" tabindex="0" aria-label="Divider" aria-valuemin="20" aria-valuemax="80"></div><section class="sheet"><header class="head"><div class="tabs" role="tablist" aria-label="Beside this page"><button type="button" role="tab" class="tab" data-mt="tab-beside" aria-controls="mt-body">'+TWO+'<span>Beside</span></button><button type="button" role="tab" class="tab" data-mt="tab-tools" aria-controls="mt-body">'+icon('toolbox')+'<span>Tools</span></button></div><div class="acts"><button type="button" class="act" data-mt="swap">'+icon('refresh')+'<span>Swap</span></button><button type="button" class="act" data-mt="close">'+icon('close')+'<span>Close</span></button></div></header><div class="body" id="mt-body" role="tabpanel" data-mt-body></div></section></div>';
  L.host=host;L.shadow=shadow;
  // (back where it was after a reload: no entrance, it was already there)
  if(!fresh)shadow.querySelector('.col').style.animation='none';
  // first child of body: every positioned thing of Canvas's paints above the column (see the head of this file)
  doc.body.insertBefore(host,doc.body.firstChild);
  reserve(L);paintFrame(L);syncRule(L);
  shadow.addEventListener('click',event=>act(L,event));
  shadow.addEventListener('input',event=>typed(L,event));
  shadow.addEventListener('keydown',event=>keyed(L,event));
  shadow.addEventListener('pointerdown',event=>drag(L,event));
  shadow.addEventListener('dblclick',event=>{if(pathHas(event,'rule')){L.state.r=RATIO;reserve(L);save(L);guardSoon(L);}});
  // What is typed in our search or notes stays ours: Canvas's page never hears those keys (its shortcuts would take them,
  // and nothing of Canvas's should see that text).
  for(const type of ['keydown','keypress','keyup','beforeinput','input','paste','cut','copy','compositionstart','compositionupdate','compositionend'])
   shadow.addEventListener(type,event=>{const at=event.composedPath?.()[0];if(at&&/^(INPUT|TEXTAREA)$/.test(at.tagName||''))event.stopPropagation();});
  const body=shadow.querySelector('[data-mt-body]');
  body?.addEventListener('scroll',()=>{
    if(L.state?.t!=='beside'||L.finding)return;
    clearTimeout(L.scrollTimer);
    L.timers.delete(L.scrollTimer);
    L.scrollTimer=timer(L,()=>{if(L.state){L.state.y=Math.round(body.scrollTop);save(L);}},400);
  },{passive:true});
  L.listen(root,'resize',()=>{if(!L.resizeFrame)L.resizeFrame=frame(L,()=>{L.resizeFrame=0;L.clear=0;L.tried=false;L.cap=0;L.stack=false;reserve(L);guard(L);});});
  // (a sticky bar of Canvas's can move under the column as the page scrolls: looked at, at most five times a second)
  L.listen(root,'scroll',()=>{if(!L.scrollWait)L.scrollWait=timer(L,()=>{L.scrollWait=0;guard(L);},200);},{passive:true,capture:true});
  L.listen(root,'pagehide',()=>flushNotes(L,true));
  // Canvas may draw a footer or a dialog later (its newer assignment page is React): look again now and then while open.
  timer(L,()=>{if(L.host&&!L.host.isConnected&&doc.body)doc.body.insertBefore(L.host,doc.body.firstChild);guard(L);},1500,true);
  render(L);syncChips(L);guardSoon(L);
 }
 function closeColumn(L){
  const focused=!!L.host?.matches?.(':focus-within');
  flushNotes(L,true);
  L.state=null;save(L);
  for(const [target,type,fn,options] of L.listeners.filter(([target])=>target===root))target.removeEventListener(type,fn,options);
  L.listeners=L.listeners.filter(([target])=>target!==root);
  for(const t of L.timers){clearTimeout(t);clearInterval(t);}L.timers.clear();for(const f of L.frames)root.cancelAnimationFrame?.(f);L.frames.clear();
  L.tick=L.scrollWait=L.resizeFrame=0;
  L.host?.remove();
  L.sheet?.remove();
  L.host=L.shadow=L.sheet=null;
  L.base=null;
  L.geometry=null;
  L.clear=0;
  L.tried=false;
  L.finding=false;
  L.cap=0;
  L.stack=false;
  L.before=null;
  syncChips(L);
  if(focused)L.chipRoot?.querySelector('.chip')?.focus?.();
 }
 function openColumn(L,tab){
  if(!L.state)L.state=cleanState({t:tab});else L.state.t=tab;
  if(tab==='beside'&&!L.state.b){L.finding=true;L.focusFind=true;}
  save(L);
  // (what of Canvas's Submit its own page already paints over, before the column takes any width: not the column's doing)
  if(!L.host){try{L.before=new Set(squeezedNow(L,null));}catch{L.before=new Set();}reserve(L);mountColumn(L,true);}else{paintFrame(L);render(L);}
  syncChips(L);
 }
 const pathHas=(event,name)=>(event.composedPath?.()||[]).some(node=>node?.dataset?.mt===name);
 const actionOf=event=>{for(const node of event.composedPath?.()||[]){const name=node?.dataset?.mt;if(name)return {name,node};}return null;};
 function act(L,event){
  const found=actionOf(event);if(!found||L.dead)return;const {name,node}=found;
  if(name==='open-beside'){if(L.state?.t==='beside'&&L.host)closeColumn(L);else openColumn(L,'beside');return;}
  if(name==='open-tools'){if(!toolsOffered())return;if(L.state?.t==='tools'&&L.host)closeColumn(L);else openColumn(L,'tools');return;}
  if(!L.state)return;
  if(name==='close'){closeColumn(L);return;}
  if(name==='swap'){if(L.geometry?.mode==='stack')return;L.state.s=L.state.s?0:1;L.clear=0;L.tried=false;L.cap=0;reserve(L);save(L);guardSoon(L);return;}
  if(name==='tab-beside'||name==='tab-tools'){
    const tab=name.slice(4);
    if(tab==='tools'&&!toolsOffered())return;
    if(L.state.t!==tab){flushNotes(L);L.state.t=tab;save(L);paintFrame(L);render(L);syncChips(L);}
    return;
  }
  if(name==='pick'){L.finding=true;L.focusFind=true;render(L);return;}
  if(name==='choose'){
    const value=node.dataset.key;
    if(PAGE.test(value||'')&&value!==L.key){L.state.b=value;L.state.n=node.dataset.name||'';L.state.y=0;L.finding=false;L.query='';save(L);render(L);}
    return;
  }
  if(name==='retry'){L.itemError='';L.storeReady=null;render(L);return;}
  if(name.startsWith('timer-'))timerAct(L,name.slice(6),Number(node.dataset.minutes));
 }
 function keyed(L,event){
  const target=event.composedPath?.()[0];
  if(target?.dataset?.mt==='rule'){
   const g=L.geometry;
   if(!g)return;
   const step=24,grow={right:'ArrowLeft',left:'ArrowRight',bottom:'ArrowUp',top:'ArrowDown'}[g.edge],shrink={right:'ArrowRight',left:'ArrowLeft',bottom:'ArrowDown',top:'ArrowUp'}[g.edge];
   let size=null;if(event.key===grow)size=g.size+step;else if(event.key===shrink)size=g.size-step;else if(event.key==='Home')size=0;else if(event.key==='End')size=g.avail;
   if(size===null)return;event.preventDefault();L.state.r=clamp(size/Math.max(1,g.avail),.2,.8);reserve(L);save(L);guardSoon(L);return;
  }
  if(target?.dataset?.mt==='find'&&event.key==='Enter'){event.preventDefault();L.shadow?.querySelector('[data-mt="choose"]')?.click();}
  if(target?.getAttribute?.('role')==='tab'&&['ArrowLeft','ArrowRight'].includes(event.key)){
    const tabs=[...L.shadow.querySelectorAll('.tab:not([hidden])')],at=tabs.indexOf(target),next=tabs[(at+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
    if(next){event.preventDefault();next.focus();next.click();}
  }
 }
 // the divider: dragged, the column follows each frame (one write of the room it takes, then Canvas lays itself out once)
 function drag(L,event){
  const rule=event.composedPath?.().find(node=>node?.dataset?.mt==='rule');if(!rule||event.button!==0||!L.geometry)return;
  event.preventDefault();const col=L.shadow.querySelector('.col');col.dataset.dragging='';
  try{rule.setPointerCapture(event.pointerId);}catch{}
  let x=event.clientX,y=event.clientY,pending=0;
  const apply=()=>{
    pending=0;
    if(L.dead||!L.state)return;
    const {vw,vh}=measure(L),top=L.geometry.mode==='stack'?L.host.getBoundingClientRect().top:0;
    L.state.r=ratioAt(L.geometry,x,y,vw,vh,top);
    L.cap=0;
    reserve(L);
  };
  const move=e=>{x=e.clientX;y=e.clientY;if(!pending)pending=frame(L,apply);};
  const end=()=>{
    rule.removeEventListener('pointermove',move);
    rule.removeEventListener('pointerup',end);
    rule.removeEventListener('pointercancel',end);
    if(pending){root.cancelAnimationFrame(pending);L.frames.delete(pending);apply();}
    delete col.dataset.dragging;
    save(L);
    guardSoon(L);
  };
  rule.addEventListener('pointermove',move);rule.addEventListener('pointerup',end);rule.addEventListener('pointercancel',end);
 }

 // ---- Canvas's Submit is never under the column ----
 function controls(){
  const seen=new Set(),out=[];
  // (only what a student can see: hidden or see-through controls are not judged)
  const add=el=>{
    if(seen.has(el)||el.closest?.('reserve-beside,reserve-multitask,reserve-page-switch'))return;
    seen.add(el);
    if(el.checkVisibility?.({opacityProperty:true,visibilityProperty:true})===false)return;
    const rect=el.getBoundingClientRect?.();
    if(!rect||rect.width<1||rect.height<1)return;
    out.push({el,rect});
  };
  for(const el of doc.querySelectorAll(SUBMIT_SELECTOR))add(el);
  for(const el of doc.querySelectorAll('button,[role="button"],a.btn,a.Button,input[type="button"]'))if(submitLike(el))add(el);
  return out;
 }
 function barOf(el){
  for(let node=el,depth=0;node&&node!==doc.body&&depth<12;node=node.parentElement,depth++){
    const position=root.getComputedStyle?.(node).position;
    if(position==='fixed'||position==='sticky')return node.getBoundingClientRect();
  }
  return null;
 }
 // a menu, dialog, tooltip or bar of Canvas's (it floats over the page by design), not the page's own flow
 function floating(el){
  for(let node=el,depth=0;node&&node!==doc.body&&depth<10;node=node.parentElement,depth++){
    const position=root.getComputedStyle?.(node).position;
    if(position==='fixed'||position==='sticky'||position==='absolute')return true;
  }
  return false;
 }
 const topAt=(x,y)=>doc.elementFromPoint(x,y);
 const squeezedNow=(L,ours=L.host)=>squeezedBy({controls:controls(),topAt,ours,vw:root.innerWidth||1280,vh:root.innerHeight||800,floating,before:L.before||new Set()});
 function guardSoon(L){frame(L,()=>guard(L));}
 // After every layout, on resize, while scrolling and every 1.5 s while open.
 // 1. Side by side, Canvas's page is narrower: if that makes Canvas's own page paint over its Submit (squeezedBy), the
 //    column gives the width back, 48 px at a time, down to its least; if that is not enough, it stacks above the page.
 // 2. A Submit-like control of Canvas's that the column would paint over: a bar at the bottom pushes the column up;
 //    otherwise the column goes to the other side once; if it still would, it closes and says so on its chip.
 // Stacked, the block is in the page's own flow: nothing of Canvas's can be under it.
 function guard(L){
  if(L.dead||!L.host||!L.geometry||!doc.elementFromPoint)return;
  if(L.geometry.mode==='side'){
   for(let round=0;round<16&&squeezedNow(L).length;round++){
    const next=L.geometry.size-48;
    if(next<MIN_PANE){L.stack=true;L.cap=0;L.clear=0;reserve(L);return;}
    L.cap=next;reserve(L);
   }
  }
  if(L.geometry.mode!=='side')return;
  const vh=root.innerHeight||800,check=()=>{
    const r=L.host.getBoundingClientRect();
    return submitGuard({controls:controls(),pane:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},topAt,ours:L.host,vh,barOf});
  };
  // a bar that pushed the column up has gone: the column comes back down, and is looked at again below
  if(L.clear&&!controls().some(({el,rect})=>rect.top>=vh-L.clear-8&&barOf(el))){L.clear=0;reserve(L);}
  let result=check();
  if(result.clear>(L.clear||0)){L.clear=result.clear;reserve(L);result=check();}
  if(!result.covered.length)return;
  if(!L.tried){
   L.tried=true;L.state.s=L.state.s?0:1;L.clear=0;reserve(L);save(L);result=check();
   if(result.clear>0){L.clear=result.clear;reserve(L);result=check();}
   if(!result.covered.length)return;
  }
  closeColumn(L);tell(L,'Closed: Canvas’s Submit was under it.');
 }

 // ---- what the column shows ----
 function registerFont(L){
  try{if(!doc.fonts||[...doc.fonts].some(face=>face.family.replace(/["']/g,'')==='Literata'))return;
   for(const [file,style] of [['fonts/literata-latin.woff2','normal'],['fonts/literata-latin-italic.woff2','italic']]){
     const face=new FontFace('Literata',`url(${root.chrome.runtime.getURL(file)}) format('woff2')`,{weight:'200 900',style,display:'swap'});
     doc.fonts.add(face);
     L.fonts.push(face);
   }
  }catch{}
 }
 const bodyOf=L=>L.shadow?.querySelector('[data-mt-body]');
 function render(L){
  const body=bodyOf(L);if(!body||!L.state)return;
  clearInterval(L.tick);L.timers.delete(L.tick);L.tick=0;
  if(L.state.t==='tools'&&!toolsOffered()){L.state.t='beside';paintFrame(L);}
  if(L.state.t==='tools'){renderTools(L,body);return;}
  if(L.finding||!L.state.b){renderFinder(L,body);return;}
  renderReading(L,body);
 }
 // The account's own store, as Tools opens it on Canvas's other pages (toolbox-session.js), without its AI visit.
 function account(L){
  if(L.storeReady)return L.storeReady;
  const signal=L.abort.signal;
  L.storeReady=(async()=>{
   const client=root.ReserveAPI.createClient(),user=await client.profile({signal});
   if(L.dead)throw Error('closed');
   const store=L.store||root.ReserveStorage.createStore({accountId:String(user.id),origin:site.origin?.()||'https://school.instructure.com'});L.store=store;
   await store.load();if(L.dead)throw Error('closed');
   try{L.zone=store.get().settings?.timeZone||'';}catch{}
   L.unsubscribe?.();L.unsubscribe=store.subscribe(()=>{if(!L.dead&&L.state?.t==='tools')syncTools(L);});
   return {client,user,store};
  })();
  L.storeReady.catch(()=>{L.storeReady=null;});
  return L.storeReady;
 }
 const zone=L=>L.zone||site.timeZone?.()||'America/New_York';
 const formats=new Map();
 const when=(L,value)=>{
   try{
     const z=zone(L);
     if(!formats.has(z))formats.set(z,new Intl.DateTimeFormat('en-US',{timeZone:z,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}));
     return formats.get(z).format(new Date(value));
   }catch{return String(value);}
 };
 const failed=(L,body,text)=>{body.innerHTML=`<p class="state" role="status">${E(text)}</p><button type="button" class="btn" data-mt="retry">${icon('refresh')}<span>Try again</span></button>`;};
 // the course's own label as the dashboard shows it, from the saved dashboard data only (no request for it)
 async function courseOf(L,a,cid){
  if(!L.courses){let snapshot=null;try{snapshot=await a.store.readCache();}catch{}
   if(snapshot&&root.ReserveNativeTools?.context){L.snapshot=snapshot;L.courses=root.ReserveNativeTools.context(snapshot,a.store.get(),'/courses/'+cid).courses;}}
  return (L.courses||[]).find(c=>String(c.id)===cid)||{id:cid,name:''};
 }
 async function finderPool(L,a){
  if(L.pool)return L.pool;
  const [cid]=L.key.split('/'),N=root.ReserveNativeTools,Q=root.ReserveQuickOpen;
  let snapshot=null;try{snapshot=await a.store.readCache();}catch{}
  if(snapshot&&N?.context&&Q?.entries){
    L.snapshot=snapshot;
    const c=N.context(snapshot,a.store.get(),'/courses/'+cid);
    L.courses=c.courses;
    L.pool=Q.entries({courses:c.courses,items:c.items.map(item=>({...item,done:root.ReserveCore?.isWorkComplete?.(item,a.store.get().tasks?.[item.id])===true}))});
    return L.pool;
  }
  // no saved dashboard yet: this course's own assignments, read once
  const rows=await a.client.list(`/api/v1/courses/${cid}/assignments?include[]=submission&per_page=100`,{signal:L.abort.signal});
  const course={id:cid,name:'This course',shortName:'This course'};L.courses=[course];
  const items=rows.filter(row=>row&&row.published!==false).map(row=>root.ReserveCore.normalizeAssignment(row,course));
  L.pool=Q?.entries?
    Q.entries({courses:[course],items}):
    items.map(item=>({id:'assignment:'+item.id,label:item.name,detail:'This course',kind:'Assignments',courseId:cid,assignmentId:item.id,dueAt:item.dueAt,url:item.url}));
  return L.pool;
 }
 function renderFinder(L,body){
  body.innerHTML=`<div class="find"><label>${icon('search')}<input type="search" data-mt="find" aria-label="Search assignments" placeholder="Search assignments" autocomplete="off" spellcheck="false"></label><div data-mt-rows><div class="skel"></div><div class="skel"></div><div class="skel"></div></div></div>`;
  // (focus moves to the search only when the student asked for it, never by itself on a reload)
  const input=body.querySelector('[data-mt="find"]');if(input){input.value=L.query;if(L.focusFind){L.focusFind=false;timer(L,()=>input.focus({preventScroll:true}),30);}}
  account(L).then(a=>finderPool(L,a)).then(()=>{if(!L.dead&&(L.finding||!L.state?.b)&&L.state?.t==='beside')listRows(L);}).catch(error=>{
    if(!L.dead&&error?.message!=='closed')failed(L,body,error?.code==='auth'?'Sign in to Canvas again, then try again.':'Canvas did not answer. Try again.');
  });
 }
 function listRows(L){
  const box=L.shadow?.querySelector('[data-mt-rows]');if(!box||!L.pool)return;
  const [cid]=L.key.split('/'),rows=finderRows(L.pool,{query:L.query,courseId:cid,current:L.key});
  if(!rows.length){box.innerHTML=`<p class="state">${L.query?'No assignment matches.':'No other assignments here yet.'}</p>`;return;}
  let group=null,html='';
  for(const row of rows){if(row.group!==group){if(group!==null)html+='</div>';group=row.group;html+=(group?`<h3>${E(group)}</h3>`:'')+'<div class="rows">';}
   const due=row.dueAt?`Due ${when(L,row.dueAt)}`:'No due date';
   html+=`<button type="button" class="row" data-mt="choose" data-key="${E(row.courseId+'/'+row.assignmentId)}" data-name="${E(row.label)}"><strong>${E(row.label)}</strong><small>${E([row.detail,due].filter(Boolean).join(' · '))}</small></button>`;}
  box.innerHTML=html+'</div>';
 }
 function typed(L,event){
  const target=event.composedPath?.()[0];
  if(target?.dataset?.mt==='find'){L.query=String(target.value||'').slice(0,120);listRows(L);return;}
  if(target?.dataset?.mt==='notes'){
   L.draft=String(target.value||'').slice(0,30000);const status=L.shadow?.querySelector('[data-mt-notes-status]');if(status)status.textContent='Saving…';
   clearTimeout(L.noteTimer);L.timers.delete(L.noteTimer);L.noteTimer=timer(L,()=>flushNotes(L),700);
  }
 }
 async function renderReading(L,body){
  const [cid,aid]=L.state.b.split('/'),want=L.state.b;
  const cached=L.items.get(want);
  if(!cached)body.innerHTML=`<div class="read"><p class="course">&nbsp;</p><h2>${E(L.state.n||'')}</h2><div class="skel"></div><div class="skel"></div><div class="skel" style="width:70%"></div></div>`;
  try{
   const a=await account(L);let item=cached;
   if(!item){
     const scope=a.client.createReadScope?.(a.user,L.abort.signal),raw=await a.client.readAssignment(cid,aid,{user:a.user,signal:L.abort.signal,authScope:scope});
     a.client.endReadScope?.(scope);
    if(L.dead||L.state?.b!==want)return;
    const course=await courseOf(L,a,cid);item=root.ReserveCore.normalizeAssignment(raw,course);item.courseLabel=course.shortName||course.name||'';
    const known=(L.snapshot?.assignments||[]).find(row=>String(row.id)===aid&&String(row.course_id??row.courseId)===cid);
    if(known)item.cachedState=root.ReserveCore.normalizeAssignment(known,course).state;
    L.items.set(want,item);if(L.items.size>8)L.items.delete(L.items.keys().next().value);
   }
   if(L.dead||L.state?.b!==want||L.state.t!=='beside'||L.finding)return;
   const status={submitted:'Submitted',graded:'Graded',excused:'Excused',unsubmitted:'Not submitted'}[item.cachedState]||'';
   body.innerHTML=readingHTML(item,{E,rich:html=>root.ReserveUI.safeRichHTML(html),icon,when:value=>when(L,value),status,course:item.courseLabel});
   if(L.state.n!==item.name){L.state.n=item.name;save(L);}
   if(L.state.y)body.scrollTop=L.state.y;
  }catch(error){
    if(!L.dead&&error?.message!=='closed'&&L.state?.b===want)
      failed(L,body,error?.code==='403'||error?.code==='404'?'This assignment is not open to you.':error?.code==='auth'?'Sign in to Canvas again, then try again.':'Canvas did not answer. Try again.');
  }
 }

 // ---- Tools: the Home focus timer and the Home notes, nothing else (see the report: AI, the calculator and Quick open stay
 // off this page: the first two reach other sites, the last leaves it) ----
 const mmss=seconds=>{const n=Math.max(0,Math.ceil(seconds));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
 function renderTools(L,body){
  const glyph=key=>root.ReserveWidgets?.glyph?.(key)||icon(key==='notes'?'note':'clock');
  body.innerHTML=`<div class="tools"><section class="tool" aria-label="Focus timer"><h3>${glyph('timer')}<span>Focus timer</span></h3><span class="phase" data-mt-phase hidden>Break</span><div class="dial"><svg viewBox="0 0 120 120" aria-hidden="true"><path class="track" d="${RING}"/><path class="arc" pathLength="1" d="${RING}"/></svg><output data-mt-clock aria-live="off">--:--</output></div>
<div class="row-btns"><button type="button" class="btn primary" data-mt="timer-start">Start</button><button type="button" class="btn" data-mt="timer-stop">Stop</button><button type="button" class="btn" data-mt="timer-adjust" data-minutes="-5" aria-label="Remove 5 minutes">−5</button><button type="button" class="btn" data-mt="timer-adjust" data-minutes="5" aria-label="Add 5 minutes">+5</button><button type="button" class="btn" data-mt="timer-reset">Reset</button></div>
<div class="lens" role="group" aria-label="Session length">${[15,25,45,60].map(n=>`<button type="button" class="chipm" data-mt="timer-minutes" data-minutes="${n}" aria-label="${n} minutes">${n}</button>`).join('')}<span>min</span></div></section>
<section class="tool notes" aria-label="Notes"><h3>${glyph('notes')}<span>Notes</span></h3><label><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Notes</span><textarea data-mt="notes" maxlength="30000" spellcheck="true" placeholder="Jot something down."></textarea></label><p data-mt-notes-status></p></section></div>`;
  for(const el of body.querySelectorAll('button,textarea'))el.disabled=true;
  account(L).then(()=>{
    if(L.dead||L.state?.t!=='tools')return;
    for(const el of body.querySelectorAll('button,textarea'))el.disabled=false;
    const notes=body.querySelector('[data-mt="notes"]');
    if(notes)notes.value=L.draft??L.store.get().toolbox?.scratchpad??'';
    syncTools(L);
  })
   .catch(error=>{if(!L.dead&&error?.message!=='closed')failed(L,body,error?.code==='auth'?'Sign in to Canvas again, then try again.':'Canvas did not answer. Try again.');});
 }
 function syncTools(L){
  const r=L.shadow,store=L.store,Core=root.ReserveCore;if(!r||!store||!Core?.focusState)return;
  const data=store.get(),f=Core.focusState(data.focus,Date.now());
  const clock=r.querySelector('[data-mt-clock]');if(clock&&clock.textContent!==mmss(f.left))clock.textContent=mmss(f.left);
  const arc=r.querySelector('.dial');if(arc)arc.style.setProperty('--mt-left',(1-f.progress).toFixed(4));
  const phase=r.querySelector('[data-mt-phase]');if(phase)phase.hidden=f.phase!=='break';
  const startBtn=r.querySelector('[data-mt="timer-start"]');if(startBtn){startBtn.textContent=f.running?'Pause':f.paused?'Resume':'Start';startBtn.dataset.mt=f.running?'timer-pause':'timer-start';}
  else{const pause=r.querySelector('[data-mt="timer-pause"]');if(pause){pause.textContent=f.running?'Pause':f.paused?'Resume':'Start';pause.dataset.mt=f.running?'timer-pause':'timer-start';}}
  for(const el of r.querySelectorAll('[data-mt="timer-stop"],[data-mt="timer-adjust"]'))el.disabled=!f.active;
  const reset=r.querySelector('[data-mt="timer-reset"]');if(reset)reset.disabled=!(f.active||f.left!==f.total);
  for(const el of r.querySelectorAll('[data-mt="timer-minutes"]')){el.setAttribute('aria-pressed',String(f.minutes===Number(el.dataset.minutes)));el.disabled=f.running;}
  const notes=r.querySelector('[data-mt="notes"]');
  if(notes&&L.draft===undefined&&r.activeElement!==notes){const value=data.toolbox?.scratchpad??'';if(notes.value!==value)notes.value=value;}
  const status=r.querySelector('[data-mt-notes-status]');if(status&&L.draft===undefined)status.textContent=(data.toolbox?.scratchpad?'Saved on this device.':'');
  if(f.running&&!L.tick){L.tick=timer(L,()=>{const g=Core.focusState(L.store?.get().focus,Date.now());if(g.running&&g.left<=0)settle(L);syncTools(L);},1000,true);}
  else if(!f.running&&L.tick){clearInterval(L.tick);L.timers.delete(L.tick);L.tick=0;}
 }
 function settle(L){
   if(L.settling)return;
   L.settling=L.store.update(data=>{root.ReserveCore.settleFocus(data,Date.now());}).catch(()=>{}).finally(()=>{L.settling=null;if(!L.dead)syncTools(L);});
 }
 function timerAct(L,name,minutes){
  if(!L.store)return;const action=name==='pause'?'pause':name==='start'?'start':name;
  L.store.update(data=>{focusChange(data,action,{now:Date.now(),minutes});}).then(()=>{if(!L.dead)syncTools(L);}).catch(()=>{});
 }
 function flushNotes(L,final=false){
  clearTimeout(L.noteTimer);L.timers?.delete(L.noteTimer);L.noteTimer=0;
  if(L.draft===undefined||!L.store)return Promise.resolve();
  const value=L.draft,store=L.store;
  return store.update(data=>{data.toolbox={...data.toolbox,scratchpad:value};}).then(()=>{
    if(L.draft===value)L.draft=undefined;
    if(!final&&!L.dead){const status=L.shadow?.querySelector('[data-mt-notes-status]');if(status)status.textContent='Saved on this device.';}
  }).catch(()=>{
    if(!L.dead){const status=L.shadow?.querySelector('[data-mt-notes-status]');if(status)status.textContent='Not saved yet.';}
  });
 }

 root.ReserveMultitask={start,stop,get life(){return life;},open:tab=>life&&openColumn(life,tab),close:()=>life&&closeColumn(life),...pure};
 // On with Quick open & study tools; off with it, with "On Canvas" and with the page switch (features.js resolves this
 // document's selection to nothing while its page is off), so start() never runs there. (Edge ran this file before
 // features.js: it joins once the page is parsed, when features.js has run.)
 const join=()=>{const features=F();if(!features?.early)return false;features.early('tools',start,stop);return true;};
 if(!join()&&doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',join,{once:true});
})(globalThis);
