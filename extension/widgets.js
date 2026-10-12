/* Canvas Harness Home modules. Beside the three original panels a student can add small modules: today's list, the
   week, a focus timer, a clock, notes, bookmarks, grades, messages and the pony's paddock. This file draws them and
   answers their buttons; where they sit is workspace-arrange.js. Nothing here writes to Canvas. Creator: Flzsh. */
(function(root){
 'use strict';
 const Arrange=()=>root.ReserveWorkspaceArrange,Plan=()=>root.ReservePlanner,Pets=()=>root.ReservePets;
 // One line each: what the module is for. Shown in the gallery, so it has to be enough to choose by.
 const INFO={
  context:{hint:'Announcements, messages and the teacher’s page for one course.'},
  today:{hint:'What you planned for today and what is due. Tick things off, add your own.'},
  week:{hint:'Seven days at a glance: how much is on each one.'},
  timer:{hint:'A 15 to 60 minute focus session. Your pony studies with you.'},
  clock:{hint:'The time, the date, and how long until the next thing is due.'},
  notes:{hint:'A scratchpad that saves as you type.'},
  bookmarks:{hint:'The assignments and materials you bookmarked.'},
  grades:{hint:'Current course grades. Follows the Show grades switch.'},
  messages:{hint:'How many messages are unread, and a way in.'},
  pet:{hint:'Home for your pony: treats, level, and where it rests.'}
 };
 const FRAMES=[['pen','Pen line','A hand-drawn line round each module.'],['stitch','Stitched','A row of stitches, like a strap.'],['card','Card','A soft card with a little shadow.'],['line','Thin rule','A plain hairline.'],['none','None','No outline: modules sit on the page.']];
 // Small drawings for the gallery and the module headings: one pen, 24 units, no fills that need a theme.
 const ART={
  context:'<path d="M4.5 5.2c5-.6 10-.5 15 .1l-.2 11.6c-4.9.6-9.9.5-14.7-.1z"/><path d="M8 9h8M8 12.4h5.4"/><path d="M9.4 17l-.6 3.4 4-3.2"/>',
  today:'<path d="M5.2 4.4c4.6-.5 9.2-.4 13.6.1l.2 15c-4.6.5-9.3.5-13.9 0z"/><path d="M8 9.4l1.4 1.5 2.4-2.9M8 14.6l1.4 1.5 2.4-2.9M14 9.8h3M14 15h3"/>',
  week:'<path d="M3.6 6.4c5.6-.5 11.2-.5 16.8 0l.1 12.4c-5.7.5-11.4.5-17 0z"/><path d="M3.8 10.2h16.4M8 3.6v4M16 3.6v4M7.4 13.4v2.8M12 13.4v2.8M16.6 13.4v2.8"/>',
  timer:'<path d="M12 6.4c4.2-.2 7.4 3 7.2 7.2-.2 4-3.2 7-7.4 6.8-4-.2-7-3.2-6.8-7.4.2-3.8 3-6.6 7-6.6"/><path d="M12 13.4V9.6M9.6 3.6h4.8M12 3.6v2.6M17.6 7.2l1.4-1.4"/>',
  clock:'<path d="M12 4c4.6-.2 8.2 3.4 8 8-.2 4.4-3.6 8-8.2 7.8C7.4 19.6 4 16.2 4.2 11.6 4.4 7.4 7.6 4 12 4"/><path d="M12 7.6v4.8l3.2 1.8"/>',
  notes:'<path d="M6 3.8c4-.4 8-.4 12 0l.2 16.4c-4.1.4-8.2.4-12.3 0z"/><path d="M9 8h6M9 11.4h6M9 14.8h3.6"/>',
  bookmarks:'<path d="M6.4 3.8c3.7-.5 7.4-.5 11.2 0V20.6l-5.6-3.8-5.6 3.8z"/><path d="M9.6 8h4.8"/>',
  grades:'<path d="M4 19.6h16"/><path d="M6.6 19.4v-6.2M11 19.4V8.6M15.4 19.4v-9M19 19.4V5"/>',
  messages:'<path d="M3.8 6c5.5-.5 10.9-.5 16.4 0l.1 12c-5.5.5-11.1.5-16.6 0z"/><path d="M4.2 6.6l7.8 6 7.8-6"/>',
  pet:'<path d="M5.4 12.6c2.6-1.4 6-1.4 8.6-.4 1.2-2.6 2.6-4.6 4.4-6l1.6 2.4c-1.4 1.4-2.2 3.4-2.6 5.8-.6 2-3.4 2.8-7.2 2.6-3-.2-5.6-1.6-4.8-4.4z"/><path d="M7 17v3.4M10 17.2v3.2M14 17.2v3.2M16.4 16.6v3.8M5.4 12.8c-1.4.4-2 2-1.8 4"/>'
 };
 const glyph=key=>`<svg class="rd-widget-glyph" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART[key]||ART.notes}</svg>`;
 // A circle drawn by hand, used by the timer (the same stroke as the hold circle).
 const RING='M61 9C90 7 112 31 111 61C110 90 87 112 59 111C31 110 8 88 9 59C10 32 32 9 60 9C65 9 70 10 75 12';
 const drafts={};   // text being typed in a module, kept across renders until it is saved

 const mmss=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 function focusState(focus,now){
  const f=focus||{},minutes=[15,25,45,60].includes(f.minutes)?f.minutes:25,total=minutes*60,running=!!f.endsAt;
  const left=running?Math.max(0,Math.ceil((f.endsAt-now)/1000)):Math.max(0,Math.min(total,Number.isFinite(f.remaining)?f.remaining:total));
  return {minutes,total,running,left:left||(!running?total:0),progress:1-(left||(!running?total:0))/total,sessions:f.sessions||0};
 }
 function howLong(ms){
  const m=Math.round(Math.abs(ms)/60000);
  if(m<1)return 'now';if(m<60)return `${m} min`;
  const h=Math.floor(m/60);if(h<24)return m%60&&h<6?`${h} h ${m%60} min`:`${h} h`;
  const d=Math.round(h/24);return `${d} day${d===1?'':'s'}`;
 }
 function plan(c,h){
  if(c.__plan)return c.__plan;
  const tz=c.s.timeZone,dayOf=value=>h.dayKey(value,tz),done=(item,mine)=>h.complete(item)||mine.checkedOff===true;
  const list=Plan().entries(c.items,c.local,{dayOf,isDone:done}),today=h.dayKey(c.now,tz);
  return c.__plan={list,today,board:Plan().board(list,today,0)};
 }
 // The next open thing with a due time, for the clock and the pony.
 function nextDue(c,h){
  const {list}=plan(c,h),open=list.filter(e=>!e.done&&e.dueAt).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
  const next=open.find(e=>Date.parse(e.dueAt)>=c.now)||null;
  return next?{...next,ms:Date.parse(next.dueAt)-c.now}:null;
 }

 function render(key,c,h){
  const {E}=h,A=Arrange(),label=A.LABELS[key],action=(name,text,extra='',cls='rd-button')=>`<button type="button" class="${cls}" data-rd-action="${name}" ${extra}>${text}</button>`;
  const time=(value,options)=>h.formatDate(value,c.s.timeZone,options);
  const mine=c.personal||{};
  const todo=(e,{showDue=true}={})=>{
   const canvasDone=e.done&&!(c.local[e.id]?.checkedOff),bits=[e.course&&!e.personal?E(e.course):e.personal?'Mine':'',showDue&&e.dueAt?E(time(e.dueAt,{hour:'numeric',minute:'2-digit'})):'',e.estimate?E(Plan().minutes(e.estimate)):'',e.steps?`${e.stepsDone}/${e.steps} steps`:''].filter(Boolean);
   return `<li class="rd-todo" data-rd-key="todo-${E(e.id)}" data-done="${e.done}" style="--rd-course:${E(e.color||'#7c718d')}">${canvasDone?`<span class="rd-todo-check" data-done="true" title="Completed in Canvas" aria-label="Completed in Canvas"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4.6 10.6l3.4 3.6 7.6-8.8"/></svg></span>`:action(e.done?'undo-check-off':'check-off','<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4.6 10.6l3.4 3.6 7.6-8.8"/></svg>',`data-id="${E(e.id)}" aria-pressed="${e.done}" aria-label="${e.done?'Put back':'Mark done'}: ${E(e.title)}" title="${e.done?'Put back in the list':'Mark done'}"`,'rd-todo-check')}${action('preview',`<strong>${E(e.title)}</strong>${bits.length?`<small>${bits.join(' · ')}</small>`:''}`,`data-id="${E(e.id)}" aria-label="Open ${E(e.title)}"`,'rd-todo-open')}</li>`;
  };
  let body='',extra='';
  if(key==='today'){
   const {board,today}=plan(c,h),d=board.days.find(x=>x.key===today)||{all:[],open:0,done:0,minutes:0},late=board.overdue.slice(0,3);
   const total=d.all.length,line=total?`${d.done} of ${total} done${d.minutes?` · ${E(Plan().minutes(d.minutes))} left`:''}`:'';
   body=`${total?`<div class="rd-progress" role="img" aria-label="${E(line)}"><i style="width:${Math.round(100*d.done/total)}%"></i></div><p class="rd-widget-note">${line}</p>`:''}
${late.length?`<p class="rd-widget-label">Still open from before</p><ul class="rd-todo-list">${late.map(e=>todo(e,{showDue:false})).join('')}</ul>${action('plan-carry','Move to today','','rd-text-button')}`:''}
${total?`<ul class="rd-todo-list">${d.all.map(e=>todo(e)).join('')}</ul>`:`<p class="rd-widget-empty">${late.length?'Nothing else for today.':'Nothing for today yet. Add a task below, or give something from Up next a day in the Planner.'}</p>`}
<form class="rd-quick-add" data-rd-form="plan-quick" data-day="${today}"><input type="text" data-rd-field="plan-quick" data-day="${today}" maxlength="200" autocomplete="off" aria-label="Add a task for today" placeholder="Add a task…  try “read ch. 3 45m”">${action('plan-quick-add','Add',`data-day="${today}"`,'rd-button rd-quick-add-button')}</form>`;
   extra=action('workspace','Planner','data-tab="plan"','rd-text-button rd-widget-link');
  }else if(key==='week'){
   const {board,today}=plan(c,h);
   body=`<div class="rd-wk" role="group" aria-label="This week">${board.days.map(d=>{
    const dt=new Date(d.key+'T12:00:00Z').getTime(),dots=d.all.slice(0,6).map(e=>`<i data-done="${e.done}" style="--rd-course:${E(e.color||'#7c718d')}"></i>`).join('')+(d.all.length>6?`<b>+${d.all.length-6}</b>`:'');
    return action('plan-open',`<span>${E(h.formatDate(dt,'UTC',{weekday:'short'}))}</span><strong>${new Date(dt).getUTCDate()}</strong><span class="rd-wk-dots">${dots}</span><small>${d.minutes?E(Plan().minutes(d.minutes)):d.open?`${d.open} to do`:d.done?'done':''}</small>`,`data-day="${d.key}" data-today="${d.key===today}" data-past="${d.key<today}" aria-label="${E(h.formatDate(dt,'UTC',{weekday:'long',month:'short',day:'numeric'}))}: ${d.open} to do, ${d.done} done${d.minutes?`, ${E(Plan().minutes(d.minutes))} planned`:''}"`,'rd-wk-day');}).join('')}</div>
${board.waiting.length||board.overdue.length?`<p class="rd-widget-note">${[board.overdue.length?`${board.overdue.length} still open from before`:'',board.waiting.length?`${board.waiting.length} due soon with no day yet`:''].filter(Boolean).join(' · ')}</p>`:''}`;
   extra=action('workspace','Planner','data-tab="plan"','rd-text-button rd-widget-link');
  }else if(key==='timer'){
   const f=focusState(mine.focus,c.now);
   body=`<div class="rd-timer" data-running="${f.running}" data-rd-timer><div class="rd-timer-dial"><svg viewBox="0 0 120 120" aria-hidden="true"><path class="rd-timer-track" d="${RING}"/><path class="rd-timer-arc" pathLength="1" d="${RING}" style="stroke-dashoffset:${(1-f.progress).toFixed(4)}"/></svg><output data-rd-timer-text aria-live="off">${mmss(f.left)}</output></div>
<div class="rd-timer-actions">${action('timer-toggle',f.running?'Pause':f.left<f.total&&f.left>0?'Resume':'Start','','rd-button rd-button-primary')}${action('timer-reset','Reset',f.running||f.left<f.total?'':'disabled','rd-text-button')}</div>
<div class="rd-timer-lengths" role="group" aria-label="Session length">${[15,25,45,60].map(n=>action('timer-minutes',`${n}`,`data-minutes="${n}" aria-pressed="${f.minutes===n}" aria-label="${n} minutes" ${f.running?'disabled':''}`,'rd-chip')).join('')}<span>min</span></div>
${f.sessions?`<p class="rd-widget-note">${f.sessions} session${f.sessions===1?'':'s'} finished</p>`:''}</div>`;
  }else if(key==='clock'){
   const next=nextDue(c,h);
   body=`<div class="rd-clock"><time class="rd-clock-time" data-rd-clock>${E(time(c.now,{hour:'numeric',minute:'2-digit'}))}</time><p class="rd-clock-date">${E(time(c.now,{weekday:'long',month:'long',day:'numeric'}))}</p>
${next?action('preview',`<small>Next due in <b data-rd-countdown data-due="${Date.parse(next.dueAt)}">${E(howLong(next.ms))}</b></small><strong>${E(next.title)}</strong>`,`data-id="${E(next.id)}" style="--rd-course:${E(next.color||'#7c718d')}"`,'rd-clock-next'):'<p class="rd-widget-note">Nothing due soon.</p>'}</div>`;
  }else if(key==='notes'){
   const value=drafts.notes??mine.toolbox?.scratchpad??'';
   body=`<label class="rd-notes"><span class="rd-sr-only">Notes</span><textarea data-rd-field="widget-notes" maxlength="30000" spellcheck="true" placeholder="Jot something down. It saves as you type.">${E(value)}</textarea></label><p class="rd-widget-note" data-rd-notes-status>${drafts.notes!==undefined?'Saving…':value?'Saved on this device.':''}</p>`;
  }else if(key==='bookmarks'){
   const items=(root.ReserveDashboardView?.bookmarkItems?.(c)||[]).slice(0,8);
   body=items.length?`<ul class="rd-link-list">${items.map(item=>{const course=c.courseMap.get(item.courseId),inner=`<strong>${E(item.title)}</strong><small>${E(course?.shortName||course?.name||'Personal')}</small>`;
    return `<li data-rd-key="wb-${E(item.kind+'-'+item.courseId+'-'+item.id)}" style="--rd-course:${E(course?.color||'#C96442')}">${item.kind==='assignment'?action('preview',inner,`data-id="${E(item.id)}"`,'rd-link-row'):`<a class="rd-link-row" href="${E(item.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`}</li>`;}).join('')}</ul>`:'<p class="rd-widget-empty">Nothing bookmarked yet. Use Bookmark on an assignment or a document to keep it here.</p>';
  }else if(key==='grades'){
   const rows=c.courses.filter(course=>Number.isFinite(course.score)||course.grade);
   body=c.s.showGrades!==true?`<p class="rd-widget-empty">Grades are hidden. Turn on <b>Show grades</b> at the top of the page to see them here.</p>`:rows.length?`<ul class="rd-grade-list">${rows.map(course=>`<li data-rd-key="wg-${E(course.id)}" style="--rd-course:${E(course.color)}"><span>${E(course.shortName||course.name)}</span><span class="rd-grade-bar" aria-hidden="true"><i style="width:${Math.max(4,Math.min(100,Math.round(course.score||0)))}%"></i></span><strong>${Number.isFinite(course.score)?`${Math.round(course.score*10)/10}%`:''}${course.grade?` <small>${E(course.grade)}</small>`:''}</strong></li>`).join('')}</ul>`:'<p class="rd-widget-empty">Canvas has not shared course grades yet.</p>';
   extra=action('workspace','All grades','data-tab="grades"','rd-text-button rd-widget-link');
  }else if(key==='messages'){
   const n=c.unread||0;
   body=`<div class="rd-messages"><p class="rd-messages-count"><strong>${n}</strong><span>unread message${n===1?'':'s'}</span></p>${action('workspace',n?'Read them':'Open Messages','data-tab="inbox"','rd-button')}</div>`;
  }else if(key==='pet'){
   const P=Pets(),pet=P?P.clean(mine.pet):null;
   body=pet?`<div class="rd-paddock" data-pet-ledge="inside" aria-hidden="true"><svg class="rd-paddock-art" viewBox="0 0 300 96" preserveAspectRatio="none"><path class="rd-paddock-sky" d="M0 0H300V96H0z"/><path class="rd-paddock-hill" d="M0 70C40 52 84 50 130 62C176 74 232 56 300 64V96H0z"/><path class="rd-paddock-rail" d="M6 60C80 57 200 59 294 56M6 72C90 69 210 71 294 68"/><path class="rd-paddock-post" d="M22 48v38M88 47v39M158 48v38M226 46v40M284 46v40"/><path class="rd-paddock-ground" d="M2 88C70 86 220 89 298 86"/></svg></div>
<div class="rd-pet-card"><p><strong>${E(pet.name)}</strong><span>Level ${P.level(pet.xp)}${pet.streak>1?` · ${pet.streak} days in a row`:''}</span></p><span class="rd-progress" aria-hidden="true"><i style="width:${Math.round(P.levelProgress(pet.xp)*100)}%"></i></span>
<div class="rd-pet-actions">${action('pet-feed',`Give a treat <b>${pet.treats}</b>`,pet.treats&&pet.enabled&&pet.roam!=='off'?'':'disabled','rd-button')}${action('pet-roam',pet.roam==='home'?'Let it roam':'Keep it here','','rd-text-button')}${action('pet-settings','Change','','rd-text-button')}</div></div>`:'';
  }
  return `<section class="rd-widget rd-widget-${key}" data-rd-key="widget-${key}" data-arrange-key="${key}" data-widget="${key}" aria-label="${E(label)}"><header class="rd-arrange-heading rd-widget-head" data-arrange-head="${key}">${glyph(key)}<h2>${E(label)}</h2>${extra}${A.controls(key)}</header><div class="rd-widget-body">${body}</div></section>`;
 }

 // The tray that opens with "Edit Home": every module with a drawing, one line about it and a switch; then the outline.
 function gallery(c,h){
  const {E}=h,A=Arrange(),on=new Set(A.snapshot(c.s).order),frame=c.s.panelFrame||'pen';
  const card=key=>{const shown=key==='context'?c.s.showCourseInformation!==false:on.has(key),fixed=!A.removable(key);
   return `<li class="rd-gallery-card" data-on="${shown}" data-rd-key="gallery-${key}">${glyph(key)}<div><strong>${E(A.LABELS[key])}</strong><p>${E(INFO[key]?.hint||'')}</p></div>${fixed?'<span class="rd-gallery-fixed">Always on</span>':`<button type="button" class="rd-switch" role="switch" data-rd-action="${shown?'widget-remove':'widget-add'}" data-widget="${key}" aria-checked="${shown}" aria-label="${shown?'Remove':'Add'} ${E(A.LABELS[key])}"><i></i></button>`}</li>`;};
  return `<section class="rd-gallery" data-rd-key="gallery" aria-label="Edit Home"><header><div><h2>Edit Home</h2><p>Switch modules on or off here. To move one, hold its heading until the circle closes, then drag it beside or below another.</p></div><button type="button" class="rd-button rd-button-primary" data-rd-action="board-edit">Done</button></header>
<ul class="rd-gallery-list">${['context',...A.EXTRA].map(card).join('')}</ul>
<div class="rd-gallery-frames" role="radiogroup" aria-label="Module outline"><span>Outline</span>${FRAMES.map(([value,name,hint])=>`<button type="button" class="rd-frame-choice" role="radio" data-rd-action="board-frame" data-value="${value}" aria-checked="${frame===value}" title="${E(hint)}"><i data-frame="${value}"></i>${E(name)}</button>`).join('')}</div></section>`;
 }

 function create({container,store,save,rerender,getContext,helpers,preview=()=>{},openSettings=()=>{},startTick=()=>{}}){
  let dead=false,editing=false,clockTimer=0,timerTick=0,notesTimer=0,pets=null,lastDone=null;
  const win=container.ownerDocument?.defaultView||root;
  const newId=()=>'local-'+(root.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const ctx=()=>getContext();
  function petInfo(){
   const c=ctx(),h=helpers(),next=nextDue(c,h),{board,today}=plan(c,h),d=board.days.find(x=>x.key===today);
   return {next:next?{id:next.id,title:next.title,course:next.course,when:`in ${howLong(next.ms)}`,urgent:next.ms<3*3600000}:null,todayOpen:d?.open||0,todayDone:d?.done||0};
  }
  function ensurePets(){
   const P=Pets();if(!P||!root.ReservePetArt||pets||dead)return;
   pets=P.create({container,getPet:()=>store.get().pet,savePet:pet=>save(data=>{data.pet=pet;}),info:petInfo,
    actions:{open:item=>preview(item.id),focus:()=>startFocus(),settings:()=>openSettings('pet')}});
  }
  function startFocus(){return save(data=>{const f=focusState(data.focus,Date.now());data.focus={...data.focus,minutes:f.minutes,remaining:f.left,endsAt:Date.now()+f.left*1000};}).then(()=>startTick());}
  // The dial and the clock move between renders without one.
  function tick(){
   if(dead)return;const now=Date.now(),data=store.get(),f=focusState(data.focus,now);
   for(const node of container.querySelectorAll('[data-rd-timer]')){
    const text=node.querySelector('[data-rd-timer-text]'),arc=node.querySelector('.rd-timer-arc');
    if(text&&text.textContent!==mmss(f.left))text.textContent=mmss(f.left);if(arc)arc.style.strokeDashoffset=(1-f.progress).toFixed(4);
   }
   pets?.setFocus(f.running);
   if(!f.running&&timerTick){clearInterval(timerTick);timerTick=0;}
  }
  function clock(){
   if(dead)return;const c=ctx(),h=helpers(),now=Date.now();
   for(const node of container.querySelectorAll('[data-rd-clock]')){const text=h.formatDate(now,c.s.timeZone,{hour:'numeric',minute:'2-digit'});if(node.textContent!==text)node.textContent=text;}
   for(const node of container.querySelectorAll('[data-rd-countdown]')){const text=howLong(Number(node.dataset.due)-now);if(node.textContent!==text)node.textContent=text;}
  }
  function sync(){
   if(dead)return;
   const data=store.get(),running=!!data.focus?.endsAt;
   if(running&&!timerTick)timerTick=setInterval(tick,1000);
   if(container.querySelector('[data-rd-clock]')){if(!clockTimer)clockTimer=setInterval(clock,15000);}else if(clockTimer){clearInterval(clockTimer);clockTimer=0;}
   ensurePets();pets?.sync();pets?.setFocus(running);
  }
  async function quickAdd(input){
   const text=input?.value||'',c=ctx(),h=helpers(),today=h.dayKey(c.now,c.s.timeZone),parsed=Plan().parseQuick(text,today);
   if(!parsed.name)return;
   if(!parsed.day)parsed.day=input.dataset.day||'';
   const course=Plan().matchCourse(parsed.course,c.courses);
   input.value='';
   const ok=await save(Plan().addTask(parsed,{courseId:course?course.id:'personal',id:newId(),nowISO:new Date().toISOString()}));
   if(ok){pets?.celebrate&&store.get().pet&&save(data=>{data.pet=Pets().reward(Pets().clean(data.pet),'plan').pet;});container.querySelector(`[data-rd-field="plan-quick"][data-day="${input.dataset.day||''}"]`)?.focus({preventScroll:true});}
   else input.value=text;
  }
  function click(event){
   const button=event.target.closest?.('[data-rd-action]');if(!button||dead)return false;
   const action=button.dataset.rdAction,key=button.dataset.widget,A=Arrange();
   if(action==='board-edit'){editing=!editing;rerender();if(!editing)container.querySelector('[data-rd-action="board-edit"]')?.focus({preventScroll:true});return true;}
   if(action==='board-frame'){save(data=>{data.settings.panelFrame=button.dataset.value;});return true;}
   if(action==='widget-add'&&(A.EXTRA.includes(key)||key==='context')){save(data=>{A.change(data.settings,key==='context'?{type:'restore-context'}:{type:'add',key});});return true;}
   if(action==='widget-remove'&&A.removable(key)){save(data=>{A.change(data.settings,key==='context'?{type:'hide-context'}:{type:'remove',key});});return true;}
   if(action==='timer-toggle'){
    const f=focusState(store.get().focus,Date.now());
    if(f.running)save(data=>{const g=focusState(data.focus,Date.now());data.focus={...data.focus,remaining:g.left,endsAt:null};});else startFocus();
    return true;
   }
   if(action==='timer-reset'){save(data=>{const g=focusState(data.focus,Date.now());data.focus={...data.focus,remaining:g.total,endsAt:null};});return true;}
   if(action==='timer-minutes'){const n=Number(button.dataset.minutes);if([15,25,45,60].includes(n))save(data=>{data.focus={...data.focus,minutes:n,remaining:n*60,endsAt:null};});return true;}
   if(action==='plan-quick-add'){quickAdd(button.closest('form')?.querySelector('[data-rd-field="plan-quick"]'));return true;}
   if(action==='plan-carry'){const c=ctx(),h=helpers(),{board,today}=plan(c,h);save(data=>{for(const e of board.overdue)Plan().plan(e.id,today)(data);});return true;}
   if(action==='pet-feed'){const pet=Pets().clean(store.get().pet);if(pet.treats)container.querySelector('.pet-layer .pet')?.click();return true;}
   if(action==='pet-roam'){save(data=>{const pet=Pets().clean(data.pet);data.pet={...pet,enabled:true,roam:pet.roam==='home'?'page':'home'};});return true;}
   if(action==='pet-settings'){openSettings('pet');return true;}
   return false;
  }
  function keydown(event){
   if(event.key==='Enter'&&event.target?.dataset?.rdField==='plan-quick'){event.preventDefault();quickAdd(event.target);return true;}
   return false;
  }
  function input(event){
   const field=event.target?.dataset?.rdField;
   if(field==='widget-notes'){
    drafts.notes=event.target.value.slice(0,30000);clearTimeout(notesTimer);
    const status=container.querySelector('[data-rd-notes-status]');if(status)status.textContent='Saving…';
    notesTimer=setTimeout(flushNotes,700);return true;
   }
   return field==='plan-quick';
  }
  function flushNotes(){
   clearTimeout(notesTimer);if(drafts.notes===undefined)return Promise.resolve();
   const value=drafts.notes;
   return save(data=>{data.toolbox={...data.toolbox,scratchpad:value};}).then(ok=>{if(ok&&drafts.notes===value)delete drafts.notes;const status=container.querySelector('[data-rd-notes-status]');if(status)status.textContent=ok?'Saved on this device.':'Not saved yet.';});
  }
  // Told by the workspace when a piece of work is ticked off or a focus session ends.
  function finished(kind,id){
   if(!Pets()||dead)return;
   if(kind==='done'&&lastDone===id)return;lastDone=kind==='done'?id:lastDone;
   ensurePets();const c=ctx(),h=helpers(),{board,today}=plan(c,h),d=board.days.find(x=>x.key===today);
   pets?.celebrate(kind,{today,left:d?d.open:undefined});
  }
  function destroy(){dead=true;clearInterval(clockTimer);clearInterval(timerTick);flushNotes();pets?.destroy();}
  return {click,keydown,input,sync,finished,destroy,editing:()=>editing,close(){if(editing){editing=false;rerender();}}};
 }
 const api={INFO,FRAMES,glyph,render,gallery,create,focusState,howLong,nextDue,plan};
 root.ReserveWidgets=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
