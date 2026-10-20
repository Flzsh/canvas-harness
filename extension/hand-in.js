/* Canvas Harness "To hand in": a Home module that lists, from the assignments Harness already loads, what Canvas marks
   missing and what has a dropbox (an online submission: a file, text, a link, a recording or an annotation) due this
   week or next and isn't handed in yet. Work done another way (in class, on paper, nothing to hand in, sorted out with
   the teacher) can be dismissed with that reason: it is marked done in Canvas Harness (the same "Mark done" the rest of
   the workspace uses) and kept under "N hidden" with Show again. Nothing here writes to Canvas. */
(function(root){
 'use strict';
 const DROPBOX=['online_upload','online_text_entry','online_url','media_recording','student_annotation'];
 const REASONS=[['class','Done in class'],['paper','Handed in on paper'],['none','No submission needed'],['teacher','Talked to the teacher']];
 const reasonText=k=>(REASONS.find(r=>r[0]===k)||[,'Done another way'])[1];
 const addDay=(key,n)=>{const t=new Date(key+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
 // The last day of this week and of next week (weeks end on Sunday), as day keys.
 function weekEnds(today){const dow=new Date(today+'T12:00:00Z').getUTCDay(),thisWeek=addDay(today,(7-dow)%7);return {thisWeek,nextWeek:addDay(thisWeek,7)};}
 const dropbox=item=>Array.isArray(item?.submissionTypes)&&item.submissionTypes.some(t=>DROPBOX.includes(t));

 // c: the workspace context (items, local, now, settings); dayOf: a time to its day key in the student's time zone;
 // complete: Canvas says the work is done (submitted, graded or excused).
 function lists(c,{dayOf,complete}){
  const today=dayOf(c.now),ends=weekEnds(today),missing=[],thisWeek=[],nextWeek=[],hidden=[];
  for(const item of c.items||[]){
   if(!item||item.personal||String(item.id).startsWith('local-'))continue;
   const mine=c.local?.[item.id]||{},due=Date.parse(item.dueAt||''),day=Number.isFinite(due)?dayOf(due):'';
   const isMissing=(item.missing===true||item.redoRequested===true)&&!complete(item);
   const ahead=dropbox(item)&&item.state==='unsubmitted'&&!complete(item)&&Number.isFinite(due)&&due>=c.now&&day<=ends.nextWeek;
   if(!isMissing&&!ahead)continue;
   if(mine.checkedOff){if(mine.doneReason)hidden.push({item,reason:mine.doneReason});continue;}
   if(isMissing)missing.push(item);else (day<=ends.thisWeek?thisWeek:nextWeek).push(item);
  }
  const byDue=(a,b)=>(Date.parse(a.dueAt||'')||0)-(Date.parse(b.dueAt||'')||0);
  missing.sort((a,b)=>byDue(b,a));thisWeek.sort(byDue);nextWeek.sort(byDue);
  return {missing,thisWeek,nextWeek,hidden,ends};
 }

 function render(c,h,{action}){
  const {E}=h,tz=c.s.timeZone,l=lists(c,{dayOf:v=>h.dayKey(v,tz),complete:h.complete});
  const course=item=>c.courseMap.get(String(item.courseId))||{};
  const when=item=>item.dueAt?h.formatDate(item.dueAt,tz,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'No due date';
  const row=(item,late)=>{const co=course(item);
   return `<li class="rd-handin-row" data-rd-key="handin-${E(item.id)}" style="--rd-course:${E(co.color||'#7c718d')}">${action('preview',`<strong>${E(item.name)}</strong><small>${E(co.shortName||co.name||'')} · ${late?'was due ':'due '}${E(when(item))}${item.points?` · ${E(item.points)} pts`:''}</small>`,`data-id="${E(item.id)}" aria-label="Open ${E(item.name)}"`,'rd-handin-open')}
<span class="rd-handin-actions">${item.url?`<a class="rd-text-button" href="${E(item.url)}" target="_blank" rel="noopener noreferrer">Canvas</a>`:''}<details class="rd-handin-menu"><summary>Done another way</summary><div role="group" aria-label="Why ${E(item.name)} needs nothing more">${REASONS.map(([k,t])=>action('handin-dismiss',E(t),`data-id="${E(item.id)}" data-value="${k}"`,'rd-handin-reason')).join('')}</div></details></span></li>`;};
  const group=(items,label,late=false,cls='')=>items.length?`<p class="rd-widget-label${cls}">${label} <span>${items.length}</span></p><ul class="rd-handin-list">${items.map(x=>row(x,late)).join('')}</ul>`:'';
  const open=l.missing.length+l.thisWeek.length+l.nextWeek.length;
  const hid=l.hidden.length?`<details class="rd-handin-hidden"><summary>${l.hidden.length} hidden</summary><ul>${l.hidden.map(({item,reason})=>`<li><span>${E(item.name)} <small>${E(reasonText(reason))}</small></span>${action('handin-undo','Show again',`data-id="${E(item.id)}"`,'rd-text-button')}</li>`).join('')}</ul></details>`:'';
  return (open?group(l.missing,'Missing in Canvas',true,' rd-handin-missing')+group(l.thisWeek,'Due this week')+group(l.nextWeek,'Due next week')
   :'<p class="rd-widget-empty">Nothing missing, and no dropbox due this week or next.</p>')+hid;
 }
 const cleanReason=v=>REASONS.some(r=>r[0]===v)?v:'';
 const api={DROPBOX,REASONS,weekEnds,lists,render,cleanReason,reasonText};
 root.ReserveHandIn=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
