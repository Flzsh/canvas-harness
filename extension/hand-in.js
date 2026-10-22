/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Adapted from Gary Wu's pull request #45 to Canvas Harness.
(function(root){
 'use strict';
 const Core=root.ReserveCore||(typeof module==='object'&&module.exports?require('./core.js'):null);
 const DROPBOX=['online_upload','online_text_entry','online_url','media_recording','student_annotation'];
 const REASONS=[['class','Done in class'],['paper','Handed in on paper'],['none','No submission needed'],['teacher','Talked to the teacher']];
 const cleanReason=value=>REASONS.some(([key])=>key===value)?value:'';
 const reasonText=value=>REASONS.find(([key])=>key===value)?.[1]||'Marked done';
 const addDay=(key,n)=>{const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10);};
 function weekEnds(today){const thisWeek=addDay(today,(7-new Date(today+'T12:00:00Z').getUTCDay())%7);return {thisWeek,nextWeek:addDay(thisWeek,7)};}
 function lists(c,{dayOf,complete=Core.isComplete}={}){
  dayOf=dayOf||(value=>Core.dayKey(value,c.s?.timeZone||'America/New_York'));
  const ends=weekEnds(dayOf(c.now)),missing=[],overdue=[],thisWeek=[],nextWeek=[],hidden=[],scope=String(c.state?.courseId||'all');
  for(const item of c.items||[]){
   if(!item||item.personal||String(item.id).startsWith('local-')||scope!=='all'&&String(item.courseId)!==scope)continue;
   const mine=c.local?.[item.id]||{},due=Date.parse(item.dueAt||''),day=Number.isFinite(due)?dayOf(due):'',done=complete(item);
   if(mine.checkedOff&&cleanReason(mine.doneReason)){hidden.push({item,reason:mine.doneReason});continue;}
   const isMissing=!done&&(item.missing===true||item.redoRequested===true),dropbox=!done&&Array.isArray(item.submissionTypes)&&item.submissionTypes.some(type=>DROPBOX.includes(type))&&!item.submissionTypes.some(type=>['online_quiz','discussion_topic'].includes(type))&&Number.isFinite(due)&&day<=ends.nextWeek;
   if(!isMissing&&!dropbox)continue;
   if(Core.isWorkComplete(item,mine)){if(mine.checkedOff)hidden.push({item,reason:cleanReason(mine.doneReason)});continue;}
   (isMissing?missing:due<c.now?overdue:day<=ends.thisWeek?thisWeek:nextWeek).push(item);
  }
  const byDue=(a,b)=>(Date.parse(a.dueAt||'')||0)-(Date.parse(b.dueAt||'')||0)||String(a.id).localeCompare(String(b.id));
  for(const list of [missing,overdue,thisWeek,nextWeek])list.sort(byDue);
  return {missing,overdue,thisWeek,nextWeek,hidden,ends};
 }
 function render(c,h,{action}){
  const {E}=h,l=lists(c,{dayOf:value=>h.dayKey(value,c.s.timeZone),complete:h.complete});
  const row=item=>{const course=c.courseMap?.get(String(item.courseId)),date=item.dueAt?h.formatDate(item.dueAt,c.s.timeZone,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'No due date';
   return `<li class="ch-handin-row" data-rd-key="handin-${E(item.id)}">${action('preview',`<strong>${E(item.name)}</strong><small>${E(course?.shortName||course?.name||'')} · ${E(date)}</small>`,`data-id="${E(item.id)}"`,'rd-text-button ch-handin-open')}<details class="ch-handin-menu"><summary>Done another way</summary>${REASONS.map(([key,label])=>action('handin-dismiss',E(label),`data-id="${E(item.id)}" data-value="${key}"`,'rd-text-button')).join('')}</details></li>`;};
  const group=(items,label)=>items.length?`<h3 class="ch-handin-label">${label} · ${items.length}</h3><ul class="ch-handin-list">${items.map(row).join('')}</ul>`:'';
  return group(l.missing,'Missing in Canvas')+group(l.overdue,'Overdue')+group(l.thisWeek,'Due this week')+group(l.nextWeek,'Due next week')+(!l.missing.length&&!l.overdue.length&&!l.thisWeek.length&&!l.nextWeek.length?'<p class="rd-widget-empty">Nothing to hand in</p>':'')+(l.hidden.length?`<details class="ch-handin-hidden"><summary>${l.hidden.length} done another way</summary><ul>${l.hidden.map(({item,reason})=>`<li class="ch-handin-row"><span>${E(item.name)} · ${E(reasonText(reason))}</span>${action('handin-undo','Undo',`data-id="${E(item.id)}"`,'rd-text-button')}</li>`).join('')}</ul></details>`:'');
 }
 const api={DROPBOX,REASONS,cleanReason,reasonText,weekEnds,lists,render};root.ReserveHandIn=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
