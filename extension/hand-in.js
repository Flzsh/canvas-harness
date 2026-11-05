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
   const isMissing=!done&&(item.missing===true||item.redoRequested===true),
    dropbox=!done&&
     Array.isArray(item.submissionTypes)&&
     item.submissionTypes.some(type=>DROPBOX.includes(type))&&
     !item.submissionTypes.some(type=>['online_quiz','discussion_topic'].includes(type))&&
     Number.isFinite(due)&&
     day<=ends.nextWeek;
   if(!isMissing&&!dropbox)continue;
   if(Core.isWorkComplete(item,mine)){if(mine.checkedOff)hidden.push({item,reason:cleanReason(mine.doneReason)});continue;}
   (isMissing?missing:due<c.now?overdue:day<=ends.thisWeek?thisWeek:nextWeek).push(item);
  }
  const byDue=(a,b)=>(Date.parse(a.dueAt||'')||0)-(Date.parse(b.dueAt||'')||0)||String(a.id).localeCompare(String(b.id));
  for(const list of [missing,overdue,thisWeek,nextWeek])list.sort(byDue);
  return {missing,overdue,thisWeek,nextWeek,hidden,ends};
 }
 // Drawn in the house hand (owner, 2026-10-27: "the UI and aesthetic is so bad now"). A row reads like an Up next row:
 // the course drawing in the course colour, the name, course · due time, and a late / today chip. The four other ways
 // sit behind one small drawn word and open as a row of paper tags. Nothing to hand in is a drawing, not a sentence.
 // Styles: widgets.css, "To hand in".
 const GROUPS=[['missing','Missing in Canvas'],['overdue','Overdue'],['thisWeek','Due this week'],['nextWeek','Due next week']];
 // When a course has no drawing (course art off): a course-colour wash under a hand-drawn ring.
 const DOT='<svg class="ch-handin-dot" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path class="w" d="M7.3 2.9c2.4-.1 4.1 1.8 4 4.2-.1 2.4-1.9 4.1-4.3 4C4.6 11 2.9 9.2 3 6.8c.1-2.3 1.9-3.9 4.3-3.9z"/><path class="k" d="M6.9 2.3c2.6-.1 4.6 1.9 4.5 4.5-.1 2.6-2.1 4.5-4.7 4.4C4.1 11.1 2.2 9.1 2.3 6.5 2.4 4.1 4.4 2.3 6.9 2.3c.9 0 1.7.3 2.3.7"/></svg>';
 // Nothing to hand in: an empty kraft tray with its paper label, and a clay tick over it.
 const EMPTY='<svg class="ch-handin-empty-art" viewBox="0 0 112 64" aria-hidden="true" focusable="false"><path class="s" d="M17 57.2C40 55.6 72 55.4 96 56.8C95 59.4 88 60.4 80 60.6C62 61.2 42 61.1 28 60.4C22 60 17.8 59 17 57.2z"/><path class="in" d="M25 27.6C45 26.4 66 26.5 87.6 27.8L97.6 36.4C70 35.6 42 35.6 14.6 36.6z" transform="translate(1.1 1.2)"/><path class="w" d="M14.6 36.6C42 35.6 70 35.6 97.6 36.4L94 54C69 55.2 43 55.1 18.4 54.2z" transform="translate(1.3 1.5)"/><path class="k" d="M14.4 36.6L24.8 27.6C45 26.3 66 26.4 87.8 27.7L97.8 36.4"/><path class="k" d="M14.4 36.6C42 35.4 70 35.5 97.8 36.4L94.2 54.2C69 55.3 43 55.2 18.2 54.3L14.3 37.1C16.6 36.8 19.4 36.6 22 36.5"/><path class="p" d="M48.8 41.4c4.8-.4 9.6-.4 14.4 0l-.3 5.6c-4.6.4-9.2.4-13.8 0z"/><path class="h" d="M52 44.2h8.2M82 51.6l3.2-3.4M85.8 51.6l3.2-3.4M89.6 51.4l2.6-2.8M39.4 11.2l-3.2-1.4M41.6 5.6l-1.6-2.8M71 11.6l3.2-.6M70.2 17.2l2.8 1.4"/><path class="t" d="M46.2 14.8c2.2 1.6 4.2 3.8 5.6 6.4C55.4 14.6 60 9.4 66 5.6"/></svg>';
 const courseArt=course=>{
  const art=root.ReserveCourseArt,on=!root.ReserveFeatures||root.ReserveFeatures.enabled('course-art');
  return course?.id&&on&&typeof art?.mini==='function'?art.mini(course,{place:'row'}):'';
 };
 // The due words: the meta line carries the day and time, the chip the one thing that must stand out.
 function due(item,group,c,h){
  const tz=c.s.timeZone,at=Date.parse(item.dueAt||''),today=h.dayKey(c.now,tz),missing=group==='missing'?(item.missing===true?'Missing':'Redo'):'';
  if(!Number.isFinite(at))return {when:'No due date',chip:missing,tone:'danger'};
  const days=Math.round((Date.parse(h.dayKey(item.dueAt,tz)+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/864e5),time=h.formatDate(item.dueAt,tz,{hour:'numeric',minute:'2-digit'});
  const when=Math.abs(days)<=6&&days!==0&&days!==1?
   h.formatDate(item.dueAt,tz,{weekday:'short',hour:'numeric',minute:'2-digit'}):
   days===0||days===1?time:h.formatDate(item.dueAt,tz,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  if(at<c.now)return {when:days===0?'Today · '+time:when,chip:days<0?`${-days} day${days===-1?'':'s'} late`:'Late',tone:'danger'};
  if(missing)return {when:days===0?'Today · '+time:days===1?'Tomorrow · '+time:when,chip:missing,tone:'danger'};
  return days===0?{when,chip:'Today',tone:'warn'}:days===1?{when,chip:'Tomorrow',tone:'info'}:{when,chip:'',tone:''};
 }
 function render(c,h,{action}){
  const {E}=h,l=lists(c,{dayOf:value=>h.dayKey(value,c.s.timeZone),complete:h.complete});
  const row=(item,group)=>{
   const course=c.courseMap?.get(String(item.courseId)),
    color=course?.color||'#69758b',
    ink=Core?.courseInk?.(color)||color,
    d=due(item,group,c,h),
    name=course?.shortName||course?.name||'';
   return `<li class="ch-handin-row" data-rd-key="handin-${E(item.id)}" style="--rd-course:${E(color)};--rd-course-ink:${E(ink)}">${action('preview',`${courseArt(course)||DOT}<strong>${E(item.name)}</strong><small>${name?`<span>${E(name)}</span>`:''}<span>${E(d.when)}</span></small>${d.chip?`<span class="ch-handin-chip" data-tone="${d.tone}">${E(d.chip)}</span>`:''}`,`data-id="${E(item.id)}"`,'ch-handin-open')}<details class="ch-handin-menu"><summary>Done another way</summary><div class="ch-handin-reasons" role="group" aria-label="Done another way">${REASONS.map(([key,label])=>action('handin-dismiss',`<span class="ch-handin-glyph" aria-hidden="true"></span>${E(label)}`,`data-id="${E(item.id)}" data-value="${key}"`,'ch-handin-reason')).join('')}</div></details></li>`;};
  const group=(key,label)=>l[key].length?`<section class="ch-handin-group" data-group="${key}" data-rd-key="handin-group-${key}"><h3 class="ch-handin-label"><span>${label}</span> <b>${l[key].length}</b></h3><ul class="ch-handin-list">${l[key].map(item=>row(item,key)).join('')}</ul></section>`:'';
  const open=GROUPS.map(([key,label])=>group(key,label)).join('');
  return `<div class="ch-handin">${open||'<div class="ch-handin-empty" role="img" aria-label="Nothing to hand in">'+EMPTY+'</div>'}${l.hidden.length?`<details class="ch-handin-hidden"><summary>${l.hidden.length} done another way</summary><ul class="ch-handin-done-list">${l.hidden.map(({item,reason})=>`<li class="ch-handin-done" data-rd-key="handin-done-${E(item.id)}"><span class="ch-handin-done-mark" aria-hidden="true"></span><span class="ch-handin-done-text"><strong>${E(item.name)}</strong><small>${E(reasonText(reason))}</small></span>${action('handin-undo','Undo',`data-id="${E(item.id)}"`,'rd-text-button ch-handin-undo')}</li>`).join('')}</ul></details>`:''}</div>`;
 }
 const api={DROPBOX,REASONS,cleanReason,reasonText,weekEnds,lists,render};root.ReserveHandIn=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
