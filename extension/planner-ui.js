/* Canvas Harness Planner: a week you can arrange. Every piece of work is a card; a card sits on the day you mean to
   do it. Drag a card to another day, or use its menu. Work with no day waits in a tray above the week. The rules are
   planner-model.js; this file draws the page and answers it. Nothing here writes to Canvas. Creator: Flzsh. */
(function(root){
 'use strict';
 const enabled=id=>!root.ReserveFeatures||root.ReserveFeatures.enabled(id);
 const Plan=()=>root.ReservePlanner,Widgets=()=>root.ReserveWidgets;
 const LENGTHS=[15,30,45,60,90,120];
 const TICK='<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4.6 10.6l3.4 3.6 7.6-8.8"/></svg>';
 const DOTS='<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="4.4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="15.6" cy="10" r="1.6"/></svg>';

 function render(c,h,ui={}){
  if(!enabled('planner')||!Plan()||!Widgets()?.plan)return '';
  const {E}=h,P=Plan(),{list,today}=Widgets().plan(c,h),offset=ui.offset||0,board=P.board(list,today,offset),tz=c.s.timeZone;
  const action=(name,text,extra='',cls='rd-button')=>`<button type="button" class="${cls}" data-rd-action="${name}" ${extra}>${text}</button>`;
  const utc=key=>new Date(key+'T12:00:00Z').getTime(),fmt=(key,options)=>h.formatDate(utc(key),'UTC',options);
  const dueLabel=(e,dayKey)=>{
   if(!e.dueAt)return '';
   const time=h.formatDate(e.dueAt,tz,{hour:'numeric',minute:'2-digit'});
   if(e.dueDay===dayKey)return `due ${time}`;
   return `${e.dueDay<today&&!e.done?'was due':'due'} ${fmt(e.dueDay,{weekday:'short',month:'short',day:'numeric'})}`;
  };
  const menu=e=>{
   const days=[[today,'Today'],[P.addDays(today,1),'Tomorrow'],...board.days.filter(d=>d.key>P.addDays(today,1)||d.key<today).map(d=>[d.key,fmt(d.key,{weekday:'long',month:'short',day:'numeric'})])];
   return `<div class="rd-plan-menu" role="menu" aria-label="Plan ${E(e.title)}" data-rd-key="pm-${E(e.id)}"><p>Do it on</p><div class="rd-plan-menu-days">${days.map(([key,label])=>action('plan-move',E(label),`role="menuitemradio" aria-checked="${e.planned===key}" data-id="${E(e.id)}" data-day="${key}"`,'rd-plan-menu-item')).join('')}${e.planned?action('plan-move','No day','role="menuitem" data-id="'+E(e.id)+'" data-day=""','rd-plan-menu-item'):''}</div>
<p>It will take about</p><div class="rd-plan-menu-lengths">${LENGTHS.map(n=>action('plan-estimate',E(P.minutes(n)),`role="menuitemradio" aria-checked="${e.estimate===n}" data-id="${E(e.id)}" data-minutes="${e.estimate===n?0:n}"`,'rd-chip')).join('')}</div>
${e.personal?action('plan-delete','Delete this task',`role="menuitem" data-id="${E(e.id)}"`,'rd-plan-menu-item rd-plan-menu-danger'):''}</div>`;
  };
  const card=(e,dayKey)=>{
   const canvasDone=e.done&&!(c.local[e.id]?.checkedOff),late=!e.done&&e.dueDay&&e.dueDay<today,bits=[e.personal&&e.courseId==='personal'?'Mine':E(e.course),E(dueLabel(e,dayKey)),e.estimate?E(P.minutes(e.estimate)):'',e.steps?`${e.stepsDone}/${e.steps} steps`:''].filter(Boolean),open=ui.menu===e.id;
   return `<article class="rd-plan-card" data-rd-key="pc-${E(e.id)}" data-plan-id="${E(e.id)}" data-done="${e.done}" data-late="${!!late}" data-menu="${open}" style="--rd-course:${E(e.color||'#7c718d')}">${canvasDone?`<span class="rd-todo-check" data-done="true" title="Completed in Canvas" aria-label="Completed in Canvas">${TICK}</span>`:action(e.done?'undo-check-off':'check-off',TICK,`data-id="${E(e.id)}" aria-pressed="${e.done}" aria-label="${e.done?'Put back':'Mark done'}: ${E(e.title)}"`,'rd-todo-check')}${action('plan-view',`<strong>${E(e.title)}</strong><small>${bits.join(' · ')}</small>`,`data-id="${E(e.id)}" aria-label="Open ${E(e.title)}"`,'rd-plan-open')}${action('plan-menu',DOTS,`data-id="${E(e.id)}" aria-haspopup="menu" aria-expanded="${open}" aria-label="Plan ${E(e.title)}: choose a day or a length" title="Choose a day or a length"`,'rd-plan-more')}${open?menu(e):''}</article>`;
  };
  // Finished work (ticked off, archived, or completed in Canvas) is kept out of the week unless asked for. What was
  // ticked in the last two minutes stays, so a slip can be undone.
  const fresh=e=>(ui.recent?.get(e.id)||0)>Date.now()-120000,shown=e=>!e.done||ui.showDone||fresh(e),hiddenDone=board.days.reduce((n,d)=>n+d.all.filter(e=>e.done&&!fresh(e)).length,0);
  const column=d=>{
   const dt=utc(d.key),isToday=d.key===today,summary=[d.open?`${d.open} to do`:d.done?'all done':'',d.minutes?P.minutes(d.minutes):''].filter(Boolean).join(' · ');
   return `<section class="rd-plan-day" data-rd-key="pd-${d.key}" data-plan-drop="${d.key}" data-today="${isToday}" data-past="${d.key<today}" aria-label="${E(h.formatDate(dt,'UTC',{weekday:'long',month:'long',day:'numeric'}))}${summary?': '+E(summary):''}"><header><span>${E(h.formatDate(dt,'UTC',{weekday:'short'}))}</span><strong>${new Date(dt).getUTCDate()}</strong>${isToday?'<em>Today</em>':''}<small>${E(summary)}</small></header>
<div class="rd-plan-cards">${d.all.filter(shown).map(e=>card(e,d.key)).join('')||'<p class="rd-plan-empty" aria-hidden="true"></p>'}</div>
<form class="rd-quick-add rd-plan-add" data-rd-form="plan-quick" data-day="${d.key}"><input type="text" data-rd-field="plan-quick" data-day="${d.key}" maxlength="200" autocomplete="off" aria-label="Add a task for ${E(h.formatDate(dt,'UTC',{weekday:'long'}))}" placeholder="+ Add"></form></section>`;
  };
  const tray=(title,hint,items,extra='')=>items.length?`<section class="rd-plan-tray" data-plan-drop="" aria-label="${E(title)}"><header><h2>${E(title)} <span>${items.length}</span></h2><p>${E(hint)}</p>${extra}</header><div class="rd-plan-cards">${items.slice(0,ui.more?200:8).map(e=>card(e,'')).join('')}</div>${items.length>8&&!ui.more?action('plan-more',`Show ${items.length-8} more`,'','rd-text-button'):''}</section>`:'';
  const first=board.days[0].key,last=board.days[6].key,range=`${fmt(first,{month:'long',day:'numeric'})} – ${fmt(last,first.slice(0,7)===last.slice(0,7)?{day:'numeric'}:{month:'long',day:'numeric'})}`;
  const week=board.days.reduce((n,d)=>({open:n.open+d.open,done:n.done+d.done,minutes:n.minutes+d.minutes}),{open:0,done:0,minutes:0});
  return `<div class="rd-plan" data-rd-key="plan">
<header class="rd-plan-head rd-page-heading"><div><h1>Planner</h1><p>${E(range)}${week.open+week.done?` · ${week.done} of ${week.open+week.done} done${week.minutes?` · ${E(P.minutes(week.minutes))} planned`:''}`:''}</p></div>
<div class="rd-plan-nav" role="group" aria-label="Week">${action('plan-week','‹','data-delta="-1" aria-label="Previous week"','rd-icon-button')}${action('plan-week-now',offset===0?'This week':offset===1?'Next week':offset===-1?'Last week':'Back to this week',`${offset===0?'aria-current="true"':''}`,'rd-button')}${action('plan-week','›','data-delta="1" aria-label="Next week"','rd-icon-button')}${hiddenDone||ui.showDone?action('plan-done',ui.showDone?'Hide finished':`Show finished <span class="rd-n">${hiddenDone}</span>`,`aria-pressed="${!!ui.showDone}"`,'rd-text-button rd-plan-done'):''}</div></header>
<form class="rd-quick-add rd-plan-quick" data-rd-form="plan-quick" data-day=""><input type="text" data-rd-field="plan-quick" data-day="" maxlength="200" autocomplete="off" aria-label="Add a task" placeholder="Add a task…  “essay outline fri 45m #english” puts it on Friday, 45 minutes, in English">${action('plan-quick-add','Add','data-day=""','rd-button rd-button-primary rd-quick-add-button')}</form>
<p class="rd-plan-tip" id="rd-plan-help">Drag a card to the day you will do it, or use its ⋯ button. Canvas due dates do not change.</p>
<div class="rd-plan-trays">${tray('Still open from before','Past its day and not done. Give it a new one.',board.overdue,action('plan-carry','Move all to today','','rd-text-button'))}${tray('Due soon, no day yet','Due within two weeks, outside this week.',board.waiting)}${tray('Whenever','Your own tasks without a day.',board.someday)}</div>
<div class="rd-plan-week" role="group" aria-describedby="rd-plan-help">${board.days.map(column).join('')}</div></div>`;
 }

 function create({container,store,save,rerender,getContext,helpers,view=()=>{},quickAdd=()=>{}}){
  if(!enabled('planner')||!Plan())return null;
  const ui={offset:0,menu:null,more:false,showDone:false,recent:new Map()};let dead=false,drag=null;
  const doc=container.ownerDocument||root.document,scope=()=>container.getRootNode?.()||doc;
  const closeMenu=()=>{if(ui.menu){const id=ui.menu;ui.menu=null;rerender();container.querySelector(`[data-rd-action="plan-menu"][data-id="${root.CSS?.escape?root.CSS.escape(id):id}"]`)?.focus({preventScroll:true});return true;}return false;};
  function click(event){
   const button=event.target.closest?.('[data-rd-action]');
   if(ui.menu&&!event.target.closest?.('.rd-plan-menu')&&button?.dataset.rdAction!=='plan-menu'){ui.menu=null;rerender();}
   if(!button||dead)return false;
   const action=button.dataset.rdAction,id=button.dataset.id,P=Plan();
   if(action==='plan-week'){ui.offset=Math.max(-26,Math.min(52,ui.offset+Number(button.dataset.delta||0)));ui.menu=null;rerender();return true;}
   if(action==='plan-week-now'){ui.offset=0;ui.menu=null;rerender();return true;}
   if(action==='plan-more'){ui.more=true;rerender();return true;}
   if(action==='plan-done'){ui.showDone=!ui.showDone;rerender();return true;}
   if(action==='check-off'||action==='undo-check-off'){const card=button.closest('[data-plan-id]');if(card)ui.recent.set(card.dataset.planId,Date.now());return false;}
   if(action==='plan-menu'){ui.menu=ui.menu===id?null:id;rerender();if(ui.menu)container.querySelector('.rd-plan-menu [aria-checked="true"],.rd-plan-menu button')?.focus({preventScroll:true});return true;}
   if(action==='plan-move'){ui.menu=null;save(P.plan(id,button.dataset.day||''));return true;}
   if(action==='plan-estimate'){save(P.estimate(id,Number(button.dataset.minutes)||0));return true;}
   if(action==='plan-delete'&&/^local-[\w-]+$/.test(id||'')){ui.menu=null;save(data=>{data.customTasks=data.customTasks.filter(task=>task.id!==id);delete data.tasks[id];});return true;}
   if(action==='plan-view'){view(id);return true;}
   return false;
  }
  function keydown(event){
   if(event.key==='Escape'&&ui.menu){event.preventDefault();closeMenu();return true;}
   const target=event.composedPath?.()[0]||event.target;
   if(ui.menu&&['ArrowDown','ArrowUp'].includes(event.key)&&target.closest?.('.rd-plan-menu')){
    const items=[...container.querySelectorAll('.rd-plan-menu button')],at=items.indexOf(target);event.preventDefault();
    items[(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();return true;
   }
   return false;
  }
  // ---- dragging a card to a day
  const dropAt=(x,y)=>scope().elementFromPoint?.(x,y)?.closest?.('[data-plan-drop]')||null;
  function down(event){
   if(dead||event.button>0||!event.isPrimary)return;
   const card=event.target.closest?.('.rd-plan-card');
   if(!card||!container.contains(card)||event.target.closest('button:not(.rd-plan-open),input,a,.rd-plan-menu'))return;
   const rect=card.getBoundingClientRect();
   drag={id:card.dataset.planId,card,x:event.clientX,y:event.clientY,dx:event.clientX-rect.left,dy:event.clientY-rect.top,w:rect.width,pointer:event.pointerId,moved:false,ghost:null,over:null};
   doc.addEventListener('pointermove',move,true);doc.addEventListener('pointerup',up,true);doc.addEventListener('pointercancel',cancel,true);
  }
  function move(event){
   if(!drag||event.pointerId!==drag.pointer)return;
   if(!drag.moved){
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;
    drag.moved=true;ui.menu=null;
    const ghost=drag.card.cloneNode(true);ghost.classList.add('rd-plan-ghost');ghost.setAttribute('data-rd-keep','');ghost.setAttribute('aria-hidden','true');ghost.removeAttribute('data-rd-key');ghost.style.width=drag.w+'px';
    container.append(ghost);drag.ghost=ghost;drag.card.dataset.dragging='true';container.dataset.planDragging='true';
   }
   event.preventDefault();
   drag.ghost.style.transform=`translate(${event.clientX-drag.dx}px,${event.clientY-drag.dy}px) rotate(-1.6deg)`;
   const over=dropAt(event.clientX,event.clientY);
   if(over!==drag.over){drag.over?.removeAttribute('data-over');over?.setAttribute('data-over','true');drag.over=over;}
  }
  function finish(){
   if(!drag)return null;const d=drag;drag=null;
   doc.removeEventListener('pointermove',move,true);doc.removeEventListener('pointerup',up,true);doc.removeEventListener('pointercancel',cancel,true);
   d.ghost?.remove();d.over?.removeAttribute('data-over');d.card.removeAttribute('data-dragging');delete container.dataset.planDragging;
   return d;
  }
  function up(event){
   if(!drag||event.pointerId!==drag.pointer)return;
   const over=drag.moved?dropAt(event.clientX,event.clientY):null,d=finish();
   if(!d.moved)return;
   // The click that follows a drag must not open the card.
   const swallow=e=>{e.stopPropagation();e.preventDefault();};container.addEventListener('click',swallow,{capture:true,once:true});setTimeout(()=>container.removeEventListener('click',swallow,{capture:true}),60);
   if(over)save(Plan().plan(d.id,over.dataset.planDrop||''));
  }
  function cancel(event){if(drag&&event.pointerId===drag.pointer)finish();}
  container.addEventListener('pointerdown',down);
  return {ui,click,keydown,goto(day){const c=getContext(),h=helpers(),today=h.dayKey(c.now,c.s.timeZone),P=Plan();if(day){ui.offset=Math.round((Date.parse(P.mondayOf(day)+'T12:00:00Z')-Date.parse(P.mondayOf(today)+'T12:00:00Z'))/604800000);}else ui.offset=0;},
   destroy(){dead=true;finish();container.removeEventListener('pointerdown',down);}};
 }
 const api={render,create,LENGTHS};
 root.ReservePlannerUI=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
