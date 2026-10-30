/* Canvas Harness Home modules. Beside the three original panels a student can add small modules: the
   week, a focus timer, a clock, notes, bookmarks, grades, messages and the pony's paddock. This file draws them and
   answers their buttons; where they sit is workspace-arrange.js. Nothing here writes to Canvas. Creator: Flzsh. */
(function(root){
 'use strict';
 const enabled=id=>!globalThis.ReserveFeatures||globalThis.ReserveFeatures.enabled(id);
 const available=key=>
   key!=='today'&&
     enabled('planner')&&
     (!['context','messages'].includes(key)||enabled('course-hub'))&&
     (key!=='grades'||enabled('grades'))&&
     (key!=='pet'||enabled('pony'))&&
     (key!=='review'||root.ReserveReviewDeck?.moduleAvailable?.()===true)&&
     (key!=='impact'||root.ReserveGradeImpact?.moduleAvailable?.()===true);
 const Arrange=()=>root.ReserveWorkspaceArrange,Plan=()=>root.ReservePlanner,Pets=()=>root.ReservePets;
 // One line each: what the module is for. Shown in the gallery, so it has to be enough to choose by.
 const INFO={
  context:{hint:'Announcements, messages and the teacher’s page for one course.'},
  handin:{},
  review:{},
  impact:{},
  week:{hint:'Seven days at a glance: how much is on each one.'},
  timer:{hint:'A focus session you can pause, stop or adjust. Your companion studies with you.'},
  clock:{hint:'The time, the date, and how long until the next thing is due.'},
  notes:{hint:'A scratchpad that saves as you type.'},
  bookmarks:{hint:'The assignments and materials you bookmarked.'},
  grades:{hint:'Current course grades. Follows the Show grades switch.'},
  messages:{hint:'How many messages are unread, and a way in.'},
  pet:{hint:'Home for your companion: treats, level, and where it rests.'}
 };
 const FRAMES=[['pen','Pen line','A hand-drawn line round each module.'],['stitch','Stitched','A row of stitches, like a strap.'],['card','Card','A soft card with a little shadow.'],['line','Thin rule','A plain hairline.'],['none','None','No outline: modules sit on the page.']];
 // Small drawings for the gallery and the module headings: one pen, 24 units, no fills that need a theme.
 const ART={
  help:'<path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  context:'<path d="M4.5 5.2c5-.6 10-.5 15 .1l-.2 11.6c-4.9.6-9.9.5-14.7-.1z"/><path d="M8 9h8M8 12.4h5.4"/><path d="M9.4 17l-.6 3.4 4-3.2"/>',handin:'<path d="M6.4 7.4L3.6 13.2l.6 6.1c5.2.6 10.4.6 15.6 0l.6-6.1-2.8-5.8"/><path d="M3.8 13.2h4.6c.4 1.8 1.7 2.8 3.6 2.8s3.2-1 3.6-2.8h4.6"/><path d="M12.1 3.4c-.1 2.7 0 5.3-.1 8M9 8.6l3 3.1 3-3.2"/>',
  week:'<path d="M3.6 6.4c5.6-.5 11.2-.5 16.8 0l.1 12.4c-5.7.5-11.4.5-17 0z"/><path d="M3.8 10.2h16.4M8 3.6v4M16 3.6v4M7.4 13.4v2.8M12 13.4v2.8M16.6 13.4v2.8"/>',
  timer:'<path d="M12 6.4c4.2-.2 7.4 3 7.2 7.2-.2 4-3.2 7-7.4 6.8-4-.2-7-3.2-6.8-7.4.2-3.8 3-6.6 7-6.6"/><path d="M12 13.4V9.6M9.6 3.6h4.8M12 3.6v2.6M17.6 7.2l1.4-1.4"/>',
  clock:'<path d="M12 4c4.6-.2 8.2 3.4 8 8-.2 4.4-3.6 8-8.2 7.8C7.4 19.6 4 16.2 4.2 11.6 4.4 7.4 7.6 4 12 4"/><path d="M12 7.6v4.8l3.2 1.8"/>',
  notes:'<path d="M6 3.8c4-.4 8-.4 12 0l.2 16.4c-4.1.4-8.2.4-12.3 0z"/><path d="M9 8h6M9 11.4h6M9 14.8h3.6"/>',
  bookmarks:'<path d="M6.4 3.8c3.7-.5 7.4-.5 11.2 0V20.6l-5.6-3.8-5.6 3.8z"/><path d="M9.6 8h4.8"/>',
  review:'<path d="M3.8 10.6c5.5-.5 10.9-.5 16.4 0l-.5 9c-5.1.5-10.3.5-15.4 0z"/><path d="M6.4 10.4V5.4c3.7-.5 7.4-.5 11.2 0v5"/><path d="M9.4 5.4v5M12.2 5.2v5.2M15 5.4v5M9.8 14.6h4.4"/>',
  grades:'<path d="M4 19.6h16"/><path d="M6.6 19.4v-6.2M11 19.4V8.6M15.4 19.4v-9M19 19.4V5"/>',
  messages:'<path d="M3.8 6c5.5-.5 10.9-.5 16.4 0l.1 12c-5.5.5-11.1.5-16.6 0z"/><path d="M4.2 6.6l7.8 6 7.8-6"/>',
  impact:'<path d="M3.4 7.8c5.8-.3 11.4-.2 17.2.1"/><path d="M4.6 5.8v4.2M19.4 5.8v4.2"/><path d="M14.2 5.6l3.6-.1.1 4.4-3.6.1z"/><path d="M8.4 8.2v3.4"/><path d="M6.4 13.4c1.4-.2 2.7-.2 4.1 0l1.3 5.8c-2.2.3-4.5.3-6.8 0z"/>',
  pet:'<path d="M5.4 12.6c2.6-1.4 6-1.4 8.6-.4 1.2-2.6 2.6-4.6 4.4-6l1.6 2.4c-1.4 1.4-2.2 3.4-2.6 5.8-.6 2-3.4 2.8-7.2 2.6-3-.2-5.6-1.6-4.8-4.4z"/><path d="M7 17v3.4M10 17.2v3.2M14 17.2v3.2M16.4 16.6v3.8M5.4 12.8c-1.4.4-2 2-1.8 4"/>'
 };
 const companion=c=>root.ReservePetArt?.identity?.({pet:c.personal?.pet,settings:c.s},c.makeOwn?.pet),
   companionDrawing=c=>root.ReservePetArt?.drawing?.({pet:c.personal?.pet,settings:c.s},c.makeOwn?.pet);
 const glyph=(key,c)=>key==='pet'&&c&&companionDrawing(c)?`<span class="rd-widget-glyph" aria-hidden="true" style="display:inline-block;width:22px;height:22px">${companionDrawing(c)}</span>`:`<svg class="rd-widget-glyph" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART[key]||ART.notes}</svg>`;
 // A circle drawn by hand, used by the timer (the same stroke as the hold circle).
 const RING='M61 9C90 7 112 31 111 61C110 90 87 112 59 111C31 110 8 88 9 59C10 32 32 9 60 9C65 9 70 10 75 12';
 const drafts={};   // text being typed in a module, kept across renders until it is saved

 const mmss=seconds=>{const n=Math.max(0,Math.ceil(seconds));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
 const duration=(value,fallback)=>value===undefined?fallback:Number.isFinite(value)&&value>0&&Number.isFinite(value*60000)?value:null;
 const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 function focusState(focus,now){
  if(root.ReserveCore?.focusState)return root.ReserveCore.focusState(focus,now);
  const f=focus||{},minutes=duration(f.minutes,25)||25,total=minutes*60,running=!!f.endsAt,remaining=Number.isFinite(f.remaining)?Math.max(0,f.remaining):total;
  const left=running?Math.max(0,(f.endsAt-now)/1000):remaining,
    elapsed=(Number.isFinite(f.elapsed)?Math.max(0,f.elapsed):Math.max(0,total-remaining))+(running?Math.max(0,remaining-left):0);
  const paused=!running&&!f.stoppedAt&&!f.completedAt&&left>0&&(!!f.pausedAt||elapsed>0||left<total);
  return {minutes,total,running,paused,active:running||paused,left,elapsed,progress:Math.max(0,Math.min(1,1-left/total)),sessions:f.sessions||0,phase:f.phase==='break'?'break':'focus'};
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

 // The paddock: a small drawn field at a fixed scale. Hills, fence and grass are tiles, so the picture is the same
 // drawing at any width and nothing is stretched. The ground the pony stands on is 9px above the bottom edge.
 function paddock(name,E){
  const w=name.length*6.6+20,sign=name&&name.length<=11?`<g class="rd-pad-sign" transform="translate(${92+(11-name.length)*1.5} 79)"><path class="rd-pad-wood" d="M1.6 2.2C22 .8 52 1.2 ${w-1} 1.8L${w-.2} 16.4C52 17.6 20 17.2 1 16.6z"/><text x="${w/2}" y="13.2" text-anchor="middle">${E(name)}</text></g>`:'';
  return `<div class="rd-paddock" data-pet-ledge="inside" aria-hidden="true"><svg class="rd-paddock-art" width="100%" height="132" focusable="false"><defs>
<pattern id="rd-pad-hill" width="420" height="64" patternUnits="userSpaceOnUse" y="46"><path class="rd-pad-far" d="M0 33C50 26 110 9 180 17C260 26 300 55 350 47C380 42 400 36 420 33V64H0z"/><path class="rd-pad-line" d="M0 30C50 23 110 6 180 14C260 23 300 52 350 44C380 39 400 33 420 30"/><path class="rd-pad-line rd-pad-faint" d="M196 22c10 3 18 8 24 14M96 22c-9 3-16 8-21 14"/></pattern>
<pattern id="rd-pad-field" width="300" height="44" patternUnits="userSpaceOnUse" y="92"><path class="rd-pad-near" d="M0 8C40 3 90 4 150 8C210 12 260 11 300 8V44H0z"/><path class="rd-pad-line rd-pad-faint" d="M0 6C40 1 90 2 150 6C210 10 260 9 300 6"/></pattern>
<pattern id="rd-pad-fence" width="62" height="46" patternUnits="userSpaceOnUse" y="72"><path class="rd-pad-rail-ink" d="M0 15C20 14 44 16 62 15M0 29C22 30 40 28 62 29"/><path class="rd-pad-rail" d="M0 15C20 14 44 16 62 15M0 29C22 30 40 28 62 29"/><path class="rd-pad-wood" d="M27.2 5.6C28.8 4.2 31.6 4.2 33 5.4L33.6 43.6L27.6 43.8z"/><path class="rd-pad-line rd-pad-faint" d="M30.4 12v9M30.8 27v10"/></pattern>
<pattern id="rd-pad-grass" width="118" height="22" patternUnits="userSpaceOnUse" y="110"><path class="rd-pad-line" d="M0 13.4C24 12.4 70 14.4 118 13.4"/><path class="rd-pad-blade" d="M12 13.5l-2.6-6.4M12.6 13.5l.8-8.6M13.4 13.5l3.4-5.6M49 13.8l-2-5.2M49.8 13.8l1.6-7M83 13.6l-3-6M83.8 13.6l.4-8.2M84.6 13.6l3.2-5M106 13.4l-1.4-4.6M106.8 13.4l2-5.4"/><path class="rd-pad-line rd-pad-faint" d="M24 18h9M62 19.4h13M94 18.2h7"/><circle class="rd-pad-bloom" cx="31" cy="9.6" r="1.7"/><path class="rd-pad-blade" d="M31 11.4v2.4"/><circle class="rd-pad-bloom rd-pad-bloom-2" cx="68" cy="8.8" r="1.5"/><path class="rd-pad-blade" d="M68 10.4v3.2"/></pattern></defs>
<rect class="rd-pad-sky" width="100%" height="132"/>
<svg x="100%" overflow="visible"><g transform="translate(-58 30)"><path class="rd-pad-sun-wash" d="M-11 1.6C-10.6-8.2 8.8-10.4 12.4-1.2C15.6 8.2 3.2 15 -5.6 11.2C-9.6 9.4 -11.2 5.6 -11 1.6z" transform="translate(2.4 2.2)"/><path class="rd-pad-line" d="M-11 1.6C-10.6-8.2 8.8-10.4 12.4-1.2C15.6 8.2 3.2 15 -5.6 11.2C-9.6 9.4 -11.2 5.6 -11 1.6"/><path class="rd-pad-line rd-pad-faint" d="M-17-4.4l-4.6-2M-10-14.6l-2.4-4.6M2-17.4l.6-5.2M13.4-12.6l3.6-4M19.4-1.4l5.2-.6M17 10.2l4.4 3"/></g></svg>
<svg x="38%" overflow="visible"><g transform="translate(0 24)"><path class="rd-pad-cloud" d="M2 13.4C-3.4 12.6-3 5.6 3.2 5.8C4.6-.6 14.4-1.6 17.4 3.8C22.4 1.6 28.2 5 27 9.4C31.6 9.8 31.6 14.2 27.4 14.2z"/><path class="rd-pad-line rd-pad-faint" d="M2 12.4C-3.4 11.6-3 4.6 3.2 4.8C4.6-1.6 14.4-2.6 17.4 2.8C22.4.6 28.2 4 27 8.4"/></g></svg>
<rect fill="url(#rd-pad-hill)" y="46" width="100%" height="64"/>
<rect fill="url(#rd-pad-field)" y="92" width="100%" height="40"/>
<g transform="translate(38 0)"><path class="rd-pad-wood" d="M-3.2 106C-2 92 -2.6 80 -1.6 66L3.4 66C3 80 4 94 5.4 106z"/><path class="rd-pad-line rd-pad-faint" d="M1 74c1.6 3 5 5 8.6 5.4M.4 84c-2 2-5 3.2-8 3.2"/><path class="rd-pad-leaf" d="M-21 52C-28 38 -18 22 -3 24C3 12 24 14 26 28C38 31 39 51 26 56C20 68 -2 70 -8 61C-15 63 -20 58 -21 52z" transform="translate(2.6 2.4)"/><path class="rd-pad-line" d="M-21 52C-28 38 -18 22 -3 24C3 12 24 14 26 28C38 31 39 51 26 56C20 68 -2 70 -8 61C-15 63 -20 58 -21 52"/><path class="rd-pad-line rd-pad-faint" d="M-9 38c3-4 8-5 12-3M9 47c4-2 9-1.6 12 1.6M-11 51c2.4 1.6 5 2 7.6 1.2"/></g>
<rect fill="url(#rd-pad-fence)" y="72" width="100%" height="46"/>
${sign}
<svg x="100%" overflow="visible"><g transform="translate(-96 100)"><path class="rd-pad-wood" d="M1 3.4L39 2.6L36.6 17.4L4 17.8z"/><path class="rd-pad-water" d="M3.4 5.2C12 4 28 3.8 36.6 4.8L36 8.2C26 9.2 12 9.2 4 8.6z"/><path class="rd-pad-line rd-pad-faint" d="M6 12.4h28M9 6.6c4-.8 8-.8 12 0"/><path class="rd-pad-line" d="M7.4 17.6l-1.6 4.6M33 17.4l1.4 4.8"/></g></svg>
<rect fill="url(#rd-pad-grass)" y="110" width="100%" height="22"/>
</svg></div>`;
 }
 function render(key,c,h){
  if(!available(key)||!Arrange()?.isKey(key))return '';
  const {E}=h,
    A=Arrange(),
    label=A.LABELS[key],
    action=(name,text,extra='',cls='rd-button')=>name==='pet-settings'&&!enabled('customization')?'':`<button type="button" class="${cls}" data-rd-action="${name}" ${extra}>${text}</button>`;
  const time=(value,options)=>h.formatDate(value,c.s.timeZone,options);
  const mine=c.personal||{};
  const Home=root.CanvasHarnessAgentHome;if(Home&&A.dynamic?.(key))return Home.renderModule(key,c,h,{controls:A.controls});
  let body='',extra='';
  if(key==='handin'){
   body=root.ReserveHandIn?.render(c,h,{action})||'';
  }else if(key==='review'){
   body=root.ReserveReviewDeck?.renderModule?.(c,h)||'';extra=root.ReserveReviewDeck?.moduleOpener?.(c,h)||'';
  }else if(key==='impact'){
   body=root.ReserveGradeImpact?.renderModule?.(c,h,c.gradeImpact)||'';
   extra=root.ReserveGradeImpact?.moduleOpener?.(c,h,c.gradeImpact)||'';
  }else if(key==='week'){
   const {board,today}=plan(c,h);
   body=`<div class="rd-wk" role="group" aria-label="This week">${board.days.map(d=>{
    const dt=new Date(d.key+'T12:00:00Z').getTime(),
      dots=d.all.slice(0,6).map(e=>`<i data-done="${e.done}" style="--rd-course:${E(e.color||'#7c718d')}"></i>`).join('')+(d.all.length>6?`<b>+${d.all.length-6}</b>`:'');
    return action('plan-open',`<span>${E(h.formatDate(dt,'UTC',{weekday:'short'}))}</span><strong>${new Date(dt).getUTCDate()}</strong><span class="rd-wk-dots">${dots}</span><small>${d.minutes?E(Plan().minutes(d.minutes)):d.open?`${d.open} to do`:d.done?'done':''}</small>`,`data-day="${d.key}" data-today="${d.key===today}" data-past="${d.key<today}" aria-label="${E(h.formatDate(dt,'UTC',{weekday:'long',month:'short',day:'numeric'}))}: ${d.open} to do, ${d.done} done${d.minutes?`, ${E(Plan().minutes(d.minutes))} planned`:''}"`,'rd-wk-day');}).join('')}</div>
${board.waiting.length||board.overdue.length?`<p class="rd-widget-note">${[board.overdue.length?`${board.overdue.length} still open from before`:'',board.waiting.length?`${board.waiting.length} due soon with no day yet`:''].filter(Boolean).join(' · ')}</p>`:''}`;
   extra=action('workspace','Planner','data-tab="plan"','rd-text-button rd-widget-link');
  }else if(key==='timer'&&enabled('focus-room')&&root.ReserveFocusRoom?.module){
   const R=root.ReserveFocusRoom;
   body=R.module({
     focus:mine.focus,
     now:c.now,
     size:c.s.moduleSize?.timer||'m',
     task:R.pickTask(mine.focus,plan(c,h).list,c.courses,v=>h.formatDate(v,c.s.timeZone,{weekday:'short',hour:'numeric',minute:'2-digit'}),c.now)
   });
   // like Review and Grade impact: a short title and the drawn corner arrows that grow the module into its room, so the
   // head never wraps on a narrow module
   extra=action('room-open','<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.2 4.4c2 .1 3.9 0 5.4.2.2 1.5.1 3.4.2 5.4M19.4 4.8l-5.6 5.4M9.8 19.6c-2-.1-3.9 0-5.4-.2-.2-1.5-.1-3.4-.2-5.4M4.6 19.2l5.6-5.4"/></svg>','aria-label="Focus room"','rd-text-button rd-widget-link fr-open');
  }else if(key==='timer'){
   const f=focusState(mine.focus,c.now);
   body=`<div class="rd-timer" data-running="${f.running}" data-rd-timer><span data-rd-timer-phase ${f.phase==='break'?'':'hidden'}>Break</span><div class="rd-timer-dial"><svg viewBox="0 0 120 120" aria-hidden="true"><path class="rd-timer-track" d="${RING}"/><path class="rd-timer-arc" pathLength="1" d="${RING}" style="stroke-dashoffset:${(1-f.progress).toFixed(4)}"/></svg><output data-rd-timer-text aria-live="off">${mmss(f.left)}</output></div>
<div class="rd-timer-actions biscuit-focus-controls">${action('timer-toggle',f.running?'Pause':f.paused?'Resume':'Start','','rd-button rd-button-primary biscuit-focus-control')}${[['stop','Stop'],['adjust','-5',-5],['adjust','+5',5]].map(([name,label,n])=>action('focus-control',label,`data-focus-action="${name}" ${n!==undefined?`data-minutes="${n}"`:''} ${f.active?'':'disabled'}`,'rd-text-button biscuit-focus-control')).join('')}${action('timer-reset','Reset',f.active||f.left!==f.total?'':'disabled','rd-text-button')}</div>
<div class="rd-timer-lengths" role="group" aria-label="Session length">${[15,25,45,60].map(n=>action('timer-minutes',`${n}`,`data-minutes="${n}" aria-pressed="${f.minutes===n}" aria-label="${n} minutes" ${f.running?'disabled':''}`,'rd-chip')).join('')}<span>min</span></div>
${f.sessions?`<p class="rd-widget-note">${f.sessions} session${f.sessions===1?'':'s'} finished</p>`:''}</div>`;
   if(enabled('focus-room'))extra=action('room-open','Focus room','','rd-text-button');
  }else if(key==='clock'){
   const next=nextDue(c,h);
   body=`<div class="rd-clock"><time class="rd-clock-time" data-rd-clock>${E(time(c.now,{hour:'numeric',minute:'2-digit'}))}</time><p class="rd-clock-date">${E(time(c.now,{weekday:'long',month:'long',day:'numeric'}))}</p>
${next?action('preview',`<small>Next due in <b data-rd-countdown data-due="${Date.parse(next.dueAt)}">${E(howLong(next.ms))}</b></small><strong>${E(next.title)}</strong>`,`data-id="${E(next.id)}" style="--rd-course:${E(next.color||'#7c718d')}"`,'rd-clock-next'):'<p class="rd-widget-note">Nothing due soon.</p>'}</div>`;
  }else if(key==='notes'){
   const value=drafts.notes??mine.toolbox?.scratchpad??'';
   body=`<label class="rd-notes"><span class="rd-sr-only">Notes</span><textarea data-rd-field="widget-notes" maxlength="30000" spellcheck="true" placeholder="Jot something down. It saves as you type.">${E(value)}</textarea></label>${enabled('ai')&&enabled('tools')?'<button type="button" class="rd-text-button" data-rd-action="notes-help">Help with this</button>':''}<p class="rd-widget-note" data-rd-notes-status>${drafts.notes!==undefined?'Saving…':value?'Saved on this device.':''}</p>`;
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
   const P=Pets(),pet=P?{...P.clean(mine.pet),name:companion(c)?.name||P.clean(mine.pet).name}:null;
   body=pet?`${paddock(pet.name,E)}
<div class="rd-pet-card"><p><strong>${E(pet.name)}</strong><span>Level ${P.level(pet.xp)}${pet.streak>1?` · ${pet.streak} days in a row`:''}</span></p><span class="rd-progress" aria-hidden="true"><i style="width:${Math.round(P.levelProgress(pet.xp)*100)}%"></i></span>
<div class="rd-pet-actions">${action('pet-feed',`Give a treat <b>${pet.treats}</b>`,pet.treats&&pet.enabled&&pet.roam!=='off'?'':'disabled','rd-button')}${action('pet-roam',pet.roam==='home'?'Let it roam':'Keep it here','','rd-text-button')}${action('pet-settings','Change','','rd-text-button')}</div></div>`:'';
  }
   const title=key==='timer'&&enabled('focus-room')&&root.ReserveFocusRoom?.module?'Focus':label;
   return `<section class="rd-widget rd-widget-${key}" data-rd-key="widget-${key}" data-arrange-key="${key}" data-widget="${key}" aria-label="${E(label)}"><header class="rd-arrange-heading rd-widget-head" data-arrange-head="${key}">${glyph(key,c)}<h2>${E(title)}</h2>${extra}${enabled('arrange')?A.controls(key):''}</header><div class="rd-widget-body">${body}</div></section>`;
 }

 // The tray that opens with "Edit Home": every module with a drawing, one line about it and a switch; then the outline.
 function gallery(c,h){
  if(!enabled('planner')||!Arrange())return '';
  const {E}=h,A=Arrange(),on=new Set(A.snapshot(c.s).order),frame=c.s.panelFrame||'pen';
  const help=enabled('ai')?`<li class="rd-gallery-card" data-on="${c.s.showHelp!==false}" data-rd-key="gallery-help">${glyph('help',c)}<div><strong>Help</strong></div><button type="button" class="rd-gswitch" role="switch" data-rd-action="help-toggle" aria-checked="${c.s.showHelp!==false}" aria-label="Help"><i></i></button></li>`:'';
  const card=key=>{const shown=key==='context'?c.s.showCourseInformation!==false:on.has(key),fixed=!A.removable(key);
    return `<li class="rd-gallery-card" data-on="${shown}" data-rd-key="gallery-${key}">${glyph(key,c)}<div><strong>${E(A.LABELS[key])}</strong>${INFO[key]?.hint?`<p>${E(INFO[key].hint)}</p>`:''}</div>${fixed?'<span class="rd-gallery-fixed">Always on</span>':`<button type="button" class="rd-gswitch" role="switch" data-rd-action="${shown?'widget-remove':'widget-add'}" data-widget="${key}" aria-checked="${shown}" aria-label="${shown?'Remove':'Add'} ${E(A.LABELS[key])}"><i></i></button>`}</li>`;};
  return `<section class="rd-gallery" data-rd-key="gallery" aria-label="Edit Home"><header><div><h2>Edit Home</h2><p>Switch modules on or off here. To move one, hold its heading until the circle closes, then drag it beside or below another.</p></div><button type="button" class="rd-button rd-button-primary" data-rd-action="board-edit">Done</button></header>
<ul class="rd-gallery-list">${help}${['context',...A.EXTRA].filter(available).map(card).join('')}</ul>
${enabled('customization')?`<div class="rd-gallery-frames" role="radiogroup" aria-label="Module outline"><span>Outline</span>${FRAMES.map(([value,name,hint])=>`<button type="button" class="rd-frame-choice" role="radio" data-rd-action="board-frame" data-value="${value}" aria-checked="${frame===value}" title="${E(hint)}"><i data-frame="${value}"></i>${E(name)}</button>`).join('')}</div>`:''}</section>`;
 }

  function create({
    container,
    store,
    previewSize=()=>false,
    getCustomPet=()=>null,
    getCatalogue=()=>[],
    installed=null,
    loadCatalogue=null,
    save,
    rerender,
    getContext,
    helpers,
    studyStore=null,
    studyScope='',
    openHelp=()=>false,
    openCourseFile=null,
    preview=()=>{},
    openSettings=()=>{},
    startTick=()=>{},
    go=()=>{},
    selectCourse=null,
    closeSettings=()=>{},
    getPractice=()=>null,
    practice=null,
    askAI=null,
    studyAI=null,
    helpWith=null,
    openAid=null,
    announcements=()=>false,
    appearance=null,
    layoutPreset=null,
    navigate=null,
    bookmark=null
  }){
  if(!enabled('planner')&&!(enabled('ai')&&enabled('tools'))||root.ReserveSite?.vanillaPage(root.location))return null;
  let dead=false,editing=false,settingsTab='layout',clockTimer=0,timerTick=0,notesTimer=0,pets=null,lastDone=null,focusSettlement=null;
  const win=container.ownerDocument?.defaultView||root;
  const newId=()=>'local-'+(root.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const ctx=()=>getContext();
  const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const persist=save,
    recordings=new WeakMap(),
    record=value=>value&&typeof value==='object'&&!Array.isArray(value),
    at=(data,path)=>path.reduce((value,key)=>value?.[key],data);
  let requestedFeatures=null,
    playTray=null,
    playBox=null,
    pendingCommand=null,
    recording=null,
    measuring=null,
    executorBusy=false,
    sourceExecution=null,
    executionValidation=null,
    unregisterExecutor=null;
  save=change=>persist(recording?recordChange(change,recording):change);
  const on=id=>enabled(id)&&(!requestedFeatures||requestedFeatures.includes(id)),unavailable=name=>({ok:false,message:name+' is off. Turn it on in Make it yours → Features.'});
   // A navigation answer: a promise settles to its own answer; false or a reply object stays as it is, anything else is done.
   function opened(result){return typeof result?.then==='function'?Promise.resolve(result).then(opened):result===false||record(result)?result:true;}
  // Companion schedule and offers need valid values and the Pony switch.
  function appearanceCommand(request){
    if(request.key==='showHelp'&&typeof request.value==='boolean'){if(!on('ai'))return unavailable('Your AI');return save(data=>{Arrange().change(data.settings,{type:'help',value:request.value});});}
    if(request.key==='pet.nudges'&&['helpful','quiet'].includes(request.value)||request.key==='pet.enabled'&&typeof request.value==='boolean')
      return save(data=>{data.pet={...Pets().clean(data.pet),[request.key.slice(4)]:request.value};});
    const feature={
      showGrades:'grades',
      sceneTheme:'scene-themes',
      motion:'motion',
      livingArt:'motion',
      nightArt:'course-art',
      bannerSize:'course-art',
      showCourseIcons:'course-art',
      courseCardStyle:'course-art',
      showCourseInformation:'course-hub',
      showRecentGrades:'grades',
      deskOrder:'arrange',
      dashboardLayout:'arrange',
      courseNavigation:'arrange',
      dockSize:'arrange'
    }[request.key];
    if(['bedtime','biscuitOffers'].includes(request.key)){
      if(request.key==='bedtime'&&(typeof request.value!=='string'||request.value.length!==5||!/^([01]\d|2[0-3]):[0-5]\d$/.test(request.value))||
        request.key==='biscuitOffers'&&typeof request.value!=='boolean')
        return clarify('Choose a valid value for '+request.key+'.');
      if(!on('customization'))return unavailable('Appearance editor');
      if(!on('pony'))return unavailable('Pony companion');
      return save(data=>{data.settings[request.key]=request.value;});
    }
    if(request.key!=='showGrades'&&!on('customization'))return unavailable('Appearance editor');
    if(feature&&!on(feature))return unavailable(root.ReserveFeatures?.catalogue.find(f=>f.id===feature)?.name||feature);
    return appearance?appearance(request):false;
  }
  function navigateCommand(request){
    const A=Arrange(),homeKey=A?.EXTRA?.includes(request.tab)&&!['grades','messages'].includes(request.tab)?request.tab:null;
    if(homeKey){if(Object.keys(request).some(key=>key!=='tab'))return clarify('Open this Home module without an additional course or destination.');return openHomeModule(homeKey);}
    const feature={planner:'planner',messages:'course-hub','course-hub':'course-hub',materials:'materials',grades:'grades'}[request.tab]||'dashboard';
    return on(feature)?navigate?opened(navigate(request)):false:unavailable(root.ReserveFeatures?.catalogue?.find(f=>f.id===feature)?.name||feature);
  }
  async function openHomeModule(key){
    const A=Arrange(),guidance='Open Home > '+(A?.LABELS?.[key]||key)+'.';
    if(!on('dashboard'))return unavailable('Dashboard');
    if(!on('planner')||!available(key))return unavailable('Planner');
    if(typeof navigate!=='function'||!A?.snapshot||!A?.isExtra(key))return clarify(guidance);
    const shown=A.snapshot(store.get().settings).order.includes(key);
    if(!shown&&!on('customization'))return unavailable('Appearance editor');
    if(!shown&&!on('arrange'))return unavailable('Arrange the workspace');
    let destination,restoreLayout=null;
    const undo=async()=>{
      if(restoreLayout){const restored=await restoreLayout();if(restored===false||restored?.ok===false)return restored;}
      return destination?.undo?destination.undo():true;
    };
   try{
     destination=await navigate({tab:'home'});
     if(destination===false||destination?.ok===false)return destination?.ok===false?destination:clarify(guidance);
     if(!shown){
       const journal={changes:[]},saved=await capture(journal,()=>moduleCommand({key,action:'show'}));
       restoreLayout=changed(journal);
       if(saved===false||saved?.ok===false){await undo();return saved?.ok===false?saved:clarify('The Home module could not save. '+guidance);}
     }
     rerender();
     const node=container.querySelector('[data-rd-key="widget-'+key+'"]'),
       visible=on('planner')&&available(key)&&A.snapshot(store.get().settings).order.includes(key)&&node&&!node.hidden&&(!node.getClientRects||node.getClientRects().length>0);
     if(!visible){const restored=await undo();return clarify((restored===false||restored?.ok===false?'Newer layout changes were kept. ':'')+guidance+' The requested module was not visible.');}
     node.scrollIntoView?.({behavior:'auto',block:'nearest'});
     if(node.focus){if(!node.hasAttribute?.('tabindex'))node.setAttribute?.('tabindex','-1');node.focus({preventScroll:true});}
     return {ok:true,message:'Opened '+A.LABELS[key]+' on Home.',undo};
   }catch{try{await undo();}catch{}return clarify('The Home module could not open. '+guidance);}
  }
  async function openHomeModule(key){
    const A=Arrange(),guidance='Open Home > '+(A?.label(key)||key)+'.';
    if(!on('dashboard'))return unavailable('Dashboard');
    if(!on('planner')||!available(key))return unavailable('Planner');
    if(typeof navigate!=='function'||!A?.snapshot||!A?.isExtra(key))return clarify(guidance);
    const shown=A.snapshot(store.get().settings).order.includes(key);
    if(!shown&&!on('customization'))return unavailable('Appearance editor');
    if(!shown&&!on('arrange'))return unavailable('Arrange the workspace');
    let destination,restoreLayout=null;
    const undo=async()=>{
      if(restoreLayout){const restored=await restoreLayout();if(restored===false||restored?.ok===false)return restored;}
      return destination?.undo?destination.undo():true;
    };
   try{
     destination=await navigate({tab:'home'});
     if(destination===false||destination?.ok===false)return destination?.ok===false?destination:clarify(guidance);
     if(!shown){
       const journal={changes:[]},saved=await capture(journal,()=>moduleCommand({key,action:'show'}));
       restoreLayout=changed(journal);
       if(saved===false||saved?.ok===false){await undo();return saved?.ok===false?saved:clarify('The Home module could not save. '+guidance);}
     }
     rerender();
     const node=container.querySelector('[data-rd-key="widget-'+key+'"]'),
       visible=on('planner')&&available(key)&&A.snapshot(store.get().settings).order.includes(key)&&node&&!node.hidden&&(!node.getClientRects||node.getClientRects().length>0);
     if(!visible){const restored=await undo();return clarify((restored===false||restored?.ok===false?'Newer layout changes were kept. ':'')+guidance+' The requested module was not visible.');}
     node.scrollIntoView?.({behavior:'auto',block:'nearest'});
     if(node.focus){if(!node.hasAttribute?.('tabindex'))node.setAttribute?.('tabindex','-1');node.focus({preventScroll:true});}
     return {ok:true,message:'Opened '+A.label(key)+' on Home.',undo};
   }catch{try{await undo();}catch{}return clarify('The Home module could not open. '+guidance);}
  }
  function checkpoint(intent){
    const begin=()=>pendingCommand={intent,changes:[]};
    return intent==='note'||intent==='batch'?flushNotes().then(ok=>{if(ok===false)throw Error('Notes could not save.');return begin();}):begin();
  }
  function recordChange(change,journal){
   if(recordings.get(change)?.journal===journal)return change;
   const batches=[],wrapped=data=>{
     journal.validate?.();
     if(measuring===journal)return change(data);
     const before=copy(data),previous=measuring;
     let result;
     measuring=journal;
     try{result=change(data);}finally{measuring=previous;}
     const patches=[],created=[],derived=[],walk=(a,b,path=[])=>{
       if(JSON.stringify(a)===JSON.stringify(b))return;
       if(record(b)&&(record(a)||a===undefined)){
         if(a===undefined)created.push(path);
         for(const key of new Set([...Object.keys(a||{}),...Object.keys(b)]))walk(a?.[key],b[key],[...path,key]);
       }
       else patches.push({path,value:copy(a),after:copy(b)});
     };
     walk(before,data);
     for(const [key,alias] of [['dashboardLayout','deskOrder'],['deskOrder','dashboardLayout']])
       if(before.settings?.[key]!==data.settings?.[key]&&before.settings?.[alias]===data.settings?.[alias])
         derived.push({path:['settings',alias],value:copy(before.settings?.[alias])});
     const batch={patches,created,derived};
     batches.push(batch);
     journal.changes.push(batch);
     return result;
   };
   recordings.set(wrapped,{journal,batches});
   return wrapped;
  }
  function committed(change,data){
   if(!record(data))return;
   for(const batch of recordings.get(change)?.batches||[]){
     batch.patches.push(...batch.derived);
     batch.derived=[];
     for(const patch of batch.patches)patch.after=copy(at(data,patch.path));
     batch.patches=batch.patches.filter(({value,after})=>JSON.stringify(value)!==JSON.stringify(after));
     batch.created=batch.created.filter(path=>record(at(data,path)));
   }
  }
  // Scope capture to synchronous command calls; queued mutators retain their own journal after the scope closes.
  function capture(journal,run){
   if(!journal||recording===journal)return run();const previous=recording,update=store.update;recording=journal;
   if(typeof update==='function')
     store.update=(change,...args)=>{
       const wrapped=recordChange(change,journal);
       return Promise.resolve(update.call(store,wrapped,...args)).then(data=>{committed(wrapped,data);return data;});
     };
   try{return run();}finally{recording=previous;if(typeof update==='function')store.update=update;}
  }
  function command(action){return(...args)=>{const journal=pendingCommand;pendingCommand=null;return capture(journal,()=>action(...args));};}
  function commandSave(){const journal=recording;return change=>capture(journal,()=>save(change));}
  function changed(journal){
   const batches=journal?.changes||[];
   return batches.some(({patches,created})=>patches.length||created.length)?async()=>{
     let conflict=false;
     const ok=await save(data=>{
       const next=copy(data);
       for(const {patches,created} of [...batches].reverse()){
         if(patches.some(({path,after})=>JSON.stringify(at(next,path))!==JSON.stringify(after))){conflict=true;return;}
         for(const {path,value} of patches){
           let parent=next;
           for(const key of path.slice(0,-1))parent=parent[key]??={};
           if(value===undefined)delete parent[path.at(-1)];else parent[path.at(-1)]=copy(value);
         }
         for(const path of [...created].reverse()){
           const parent=at(next,path.slice(0,-1)),value=parent?.[path.at(-1)];
           if(record(value)&&!Object.keys(value).length)delete parent[path.at(-1)];
         }
       }
       for(const key of Object.keys(data))if(!Object.hasOwn(next,key))delete data[key];
       Object.assign(data,next);
     });
     if(conflict)return {ok:false,message:'That has changed since then. Your newer edits are kept.'};
     if(ok){startTick();sync();tick();rerender();}
     return ok;
   }:null;
  }
  async function featureCommand(request){
   const validate=executionValidation;
   const F=root.ReserveFeatures,D=root.ReserveSettingsDock;if(!F||!D?.saveFeatures||!root.chrome?.storage?.local)return {ok:false,message:'Features are unavailable. Reload Canvas.'};
    if(request.id==='pony'&&!request.on)return {ok:false,message:'The Companion switch is in the extension popup → Companion.'};
   const saved=(await root.chrome.storage.local.get(F.KEY))[F.KEY],before=F.normalize(saved);
   let next=request.id?D.toggleFeatures(before,request.id,request.on):F.normalize({preset:request.preset});
   if(!F.resolve(next).enabled.includes('pony')){
     if(request.id)return {ok:false,message:'That also turns '+(root.ReservePetArt?.identity?.(store.get())?.name||'Biscuit')+' off. Use Make it yours → Features for that switch.'};
    next=F.normalize({preset:'custom',custom:[...F.resolve(next).enabled,'pony']});
   }
   validate?.();await D.saveFeatures(next);requestedFeatures=F.resolve(next).enabled;
    return {
      ok:true,
      message:request.preset==='lite'?'Lite mode, keeping '+(root.ReservePetArt?.identity?.(store.get())?.name||'Biscuit')+' on. Reload Canvas to apply.':'Saved. Reload Canvas to apply.',
      reload:true,
      undo:async()=>{
      const current=F.normalize((await root.chrome.storage.local.get(F.KEY))[F.KEY]);
      if(JSON.stringify(current)!==JSON.stringify(next))return {ok:false,message:'Features have changed since then. Your newer choices are kept.'};
      await D.saveFeatures(before);
      requestedFeatures=F.resolve(before).enabled;
      return {ok:true,message:'Undone. Reload Canvas to apply.',reload:true};
    }};
  }
  function moduleCommand({action,key}){
   if(key==='help'){
     if(!on('ai'))return unavailable('Your AI');
     if(!['show','hide'].includes(action))return {ok:false,message:'Help stays above the Home modules; use its switch in Edit Home.'};
     return Promise.resolve(save(data=>{Arrange().change(data.settings,{type:'help',value:action==='show'});})).then(async ok=>{
       if(ok===false)return false;
       return action==='show'?openHelp():true;
     });
   }
   const A=Arrange(),feature={context:'course-hub',messages:'course-hub',grades:'grades',pet:'pony'}[key]||'planner';
   if(!on('arrange'))return unavailable('Arrange the workspace');
   if(!on(feature)||!available(key)||!A?.ALL.includes(key))return unavailable(A?.LABELS[key]||'That module');
   if(!['show','hide','top','wide'].includes(action)||action==='hide'&&!A.removable(key))return false;
   return save(data=>{
     if(action==='hide')
       A.change(data.settings,key==='context'?{type:'hide-context'}:{type:'remove',key});
     else{
       if(key==='context')A.change(data.settings,{type:'restore-context'});else if(A.EXTRA.includes(key))A.change(data.settings,{type:'add',key});
       if(action==='top')A.change(data.settings,{type:'dock',key,target:A.ROOT,edge:'top'});
       if(action==='wide')data.settings.moduleSize={...data.settings.moduleSize,[key]:'l'};
     }
   });
  }
  const mutationReceipts=[],
    mutationId=value=>
      (typeof value==='string'||typeof value==='number'&&Number.isFinite(value))&&
        String(value).trim()&&
        String(value).length<=256&&
        !/[\u0000-\u001f\u007f]/.test(String(value))&&
        !['__proto__','prototype','constructor'].includes(String(value))?
        String(value):
        '',
    clarify=message=>({ok:false,message}),
    sameMutation=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  async function localMutation(kind,operation,change){
   const journal={changes:[],validate:executionValidation},rejected=Error('The local entry changed. Try again.');
   let result;
   try{result=change(copy(store.get()));}catch{return clarify('The local change could not be prepared. Your saved data is kept.');}
   if(result?.ok!==true)return result||clarify('Choose the local entry to change.');
   try{
     const saved=await capture(journal,()=>save(data=>{
       const next=copy(data);
       result=change(next);
       if(result?.ok!==true){rejected.message=result?.message||'Choose the local entry to change.';throw rejected;}
       Object.assign(data,next);
     }));
     if(result?.ok!==true)return result||clarify(rejected.message);
     if(saved===false)return clarify('The local change could not save. Try again.');
   }catch(error){return error===rejected?result||clarify(rejected.message):clarify('The local change could not save. Your saved data is kept.');}
   if(result?.ok!==true)return result||clarify('Choose the local entry to change.');const revert=changed(journal);if(!revert)return result;
   const receipt={kind,operation,targetId:result.targetId,courseId:result.courseId,before:copy(result.before??result.original),active:true},undo=async()=>{
     if(!receipt.active)return clarify('That change has already been undone.');
     let restored;
     try{restored=await revert();}catch{return clarify('Undo could not save. Try again.');}
     if(restored===false||restored?.ok===false)return restored||clarify('Undo could not save. Try again.');
     receipt.active=false;
     return {ok:true,message:'Undone.'};
   };
   receipt.undo=undo;
   mutationReceipts.push(receipt);
   return {...result,undo};
  }
  function undoMutation(kind,request,operations){
   const targetId=mutationId(request.targetId??request.restore?.id??request.restore?.reminder?.id),courseId=request.courseId??request.restore?.courseId;
   if(!targetId)return clarify('Which local entry should I restore?');
   const matches=mutationReceipts.filter(r=>
     r.active&&r.kind===kind&&r.targetId===targetId&&operations.includes(r.operation)&&(courseId===undefined||r.courseId===String(courseId)));
   if(new Set(matches.map(r=>r.courseId||'')).size>1)return clarify('Which course has the entry to restore?');
   return matches.at(-1)?.undo()||clarify('There is no saved Undo for that entry in this session.');
  }
  function localTask(data,id){if(!Object.hasOwn(data.tasks||{},id)){data.tasks||={};Plan().plan(id,'')(data);}return data.tasks[id];}
  function noteOperation(request){
   const {operation}=request;
   if(!['create','edit','delete','undo-delete','undo-edit'].includes(operation))return clarify('Choose create, edit, delete, or Undo for Notes.');
   if(operation.startsWith('undo-'))return undoMutation('note',request,[operation.slice(5)]);
   const targetId=mutationId(request.targetId??(operation==='create'?'scratchpad':''));
   if(!targetId)return clarify('Which note should I change?');
   if(request.title!==undefined)return clarify('Local notes have no separate title field. Choose the note ID and its text.');
   if(operation!=='delete'&&(typeof request.text!=='string'||!request.text.trim()))return clarify('What text should the note contain?');
   return localMutation('note',operation,data=>{
     const scratch=targetId==='scratchpad',
       id=targetId.startsWith('note-')?targetId.slice(5):'',
       exists=id&&Object.hasOwn(data.tasks||{},id),
       sources=ctx().items.filter(row=>String(row.id)===id),
       known=sources.length===1;
     if(!scratch&&(!mutationId(id)||!exists&&!known||sources.length>1||operation!=='create'&&!data.tasks?.[id]?.notes))return clarify('Choose an existing local note ID.');
     if(request.courseId!==undefined&&(scratch||!known||String(sources[0].courseId)!==String(request.courseId)))return clarify('Choose the task note in that course. The scratchpad has no course.');
     const original=scratch?data.toolbox?.scratchpad||'':data.tasks?.[id]?.notes||'',text=operation==='delete'?'':operation==='create'?original+(original?'\n':'')+request.text:request.text;
     if(text.length>(scratch?30000:20000))return clarify(scratch?'Notes has a 30,000 character limit.':'A task note has a 20,000 character limit.');
     if(scratch){data.toolbox||={};data.toolbox.scratchpad=text;}else localTask(data,id).notes=text;
     return {
       ok:true,
       targetId,
       ...(known?{courseId:String(sources[0].courseId)}:{}),
       original,
       before:{id:targetId,text:original,...(known?{courseId:String(sources[0].courseId)}:{})},
       after:{id:targetId,text,...(known?{courseId:String(sources[0].courseId)}:{})},
       message:operation==='delete'?'Deleted the selected local note.':'Saved the selected local note.'
     };
   });
  }
  async function noteCommand(request={}){
   if(request.operation!==undefined){
     if(!on('planner'))return unavailable('Notes');
     const journal=recording;
     let flushed;
     try{flushed=await flushNotes();}catch{return clarify('Notes could not save. Try again.');}
     if(flushed===false)return clarify('Notes could not save. Try again.');
     return capture(journal,()=>noteOperation(request));
   }
   let {text}=request;
   if(!on('planner'))return unavailable('Notes');text=String(text||'').trim();if(!text)return false;
   const write=commandSave();if(await Promise.resolve().then(flushNotes)===false)return false;
   const current=store.get().toolbox?.scratchpad||'';if(current.length+text.length+(current?1:0)>30000)return {ok:false,message:'Notes is full. Make room in Notes first.'};
   return write(data=>{
     const value=data.toolbox?.scratchpad||'';
     if(value.length+text.length+(value?1:0)>30000)throw Error('Notes is full.');
     data.toolbox={...data.toolbox,scratchpad:value+(value?'\n':'')+text};
   });
  }
  function skillCommand({skill,on:value}){
    const B=root.ReservePonyBrain;
    if(!on('pony'))return unavailable('Pony companion');
    if(!B||!Object.hasOwn(B.SKILLS,skill)||typeof value!=='boolean')return false;
    return saveSkill(skill,value);
  }
  // A module made wider or narrower moves the modules around it: each one glides from where it stood to where the new
  // layout puts it (FLIP: measured before the save and after the render, transform only, 240 ms on the house settle)
  // while its contents fade back in, so nothing jumps. Still, Off and reduced motion: the layout simply changes.
  function reflow(){
   const style=container?.dataset?.motionStyle;
   if(style==='off'||container?.dataset?.featureMotion==='off'||root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches||typeof root.MutationObserver!=='function')return null;
   // Still: nothing travels; the modules that moved or changed width fade their contents back in where they land
   const still=style==='still';
   // Where every module stands in the layout now. A glide still under way (a second change while the first plays) is
   // remembered with it, so the new glide starts from where that one has got to when the new layout lands (the save
   // takes a moment, and the old glide runs on meanwhile), never from where it was at the press, never with a snap.
   const nodes=[...(container.querySelectorAll?.('[data-arrange-key]')||[])],rects=new Map();
   const progress=a=>{try{const t=a?.effect?.getComputedTiming?.();return a.playState==='finished'||!t||t.progress==null?1:t.progress;}catch{return 1;}};
   for(const node of nodes){
     const r=node.getBoundingClientRect?.();
     if(!r?.width)continue;
     const a=(node.getAnimations?.()||[]).find(x=>x.id==='rd-reflow'&&x.playState!=='finished'),f=a?.flip;
    // the box without the glide's transform (origin top left): the rect read is the box moved and scaled by it
    let box={left:r.left,top:r.top,width:r.width,height:r.height};
    if(f){const k=1-progress(a);box={left:r.left-f[0]*k,top:r.top-f[1]*k,width:r.width/(1+(f[2]-1)*k),height:r.height/(1+(f[3]-1)*k)};}
    rects.set(node.dataset.arrangeKey,{box,anim:f?a:null});}
   if(!rects.size)return null;
   const seen=e=>{
     const f=e.anim?.flip;
     if(!f)return e.box;
     const k=1-progress(e.anim),b=e.box;
     return {left:b.left+f[0]*k,top:b.top+f[1]*k,width:b.width*(1+(f[2]-1)*k),height:b.height*(1+(f[3]-1)*k)};
   };
   return ()=>{let done=false;const watch=new root.MutationObserver(()=>{if(done)return;const moved=[],firsts=new Map();
     // where each one is seen right now (its old glide read at this moment), before the new layout is measured
     for(const [key,e] of rects)firsts.set(key,seen(e));
     for(const node of container.querySelectorAll('[data-arrange-key]')){
       const a=firsts.get(node.dataset.arrangeKey),b=node.getBoundingClientRect?.();
       if(!a||!b?.width)continue;
       const dx=a.left-b.left,dy=a.top-b.top,sx=a.width/b.width,sy=a.height/b.height;
       if(Math.abs(dx)>.5||Math.abs(dy)>.5||Math.abs(sx-1)>.004||Math.abs(sy-1)>.004)moved.push([node,dx,dy,sx,sy]);
     }
     for(const e of rects.values())try{e.anim?.cancel();}catch{}
     if(!moved.length)return;done=true;watch.disconnect();const ease=root.ReserveMotion?.easings?.settle||'cubic-bezier(.2,.8,.2,1)';
     if(still){for(const [node] of moved)try{node.querySelector(':scope > .rd-widget-body')?.animate?.([{opacity:0},{opacity:1}],{duration:160,easing:'linear',fill:'backwards'});}catch{}return;}
     for(const [node,dx,dy,sx,sy]of moved){
       try{
         for(const old of node.getAnimations?.()||[])if(old.id==='rd-reflow')old.cancel();
         const a=node.animate(
           [{transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${sx.toFixed(4)},${sy.toFixed(4)})`,transformOrigin:'0 0'},{transform:'none',transformOrigin:'0 0'}],
           {duration:240,easing:ease});
         if(a){a.id='rd-reflow';a.flip=[dx,dy,sx,sy];}
      // a module that changed size would stretch its drawings while it scales: its contents fade back in instead
      if(Math.abs(sx-1)>.004||Math.abs(sy-1)>.004)node.querySelector(':scope > .rd-widget-body')?.animate?.([{opacity:0},{opacity:1}],{duration:160,delay:60,easing:'linear',fill:'backwards'});}catch{}}});
    watch.observe(container,{subtree:true,childList:true,attributes:true});root.setTimeout?.(()=>{done=true;watch.disconnect();},2000);};
  }
  function saveSkill(key,value){
    return save(data=>{const B=root.ReservePonyBrain,p=Pets().clean(data.pet);data.pet={...p,skills:{...B.cleanSkills(p.skills),[key]:value}};});
  }
  async function playCommand({tool}){
   const c=ctx(),blocked=()=>ctx().quizTaking===true||/\/quizzes\/[^/]+\/(?:take|resume)(?:\/|$)/.test(root.location?.pathname||c.pathname||'');
   if(blocked())return {ok:false,message:'Play tools are unavailable while taking a quiz.'};
   if(!on('play'))return {...unavailable('Play tools'),suggestions:['turn on play tools']};
   if(!root.ReservePlay){
     const result=await root.chrome?.runtime?.sendMessage?.({target:'ch-play',op:'load'});
     if(!result?.ok)return {ok:false,message:'Play tools could not load. Reload Canvas and try again.',reload:true};
   }
   if(dead||blocked())return {ok:false,message:'Play tools are unavailable while taking a quiz.'};
   if(!playTray){
     playBox=container.ownerDocument.createElement('div');
     playBox.dataset.rdKeep='true';
     container.append(playBox);
     playTray=root.ReservePlay?.mount({
       box:playBox,
       all:true,
       root:()=>container.querySelector('.rd-workspace')||container,
       blocks:'.rd-main > *, .rd-workspace > *',
       ours:'.pet-layer,.chb-box',
       allowed:()=>!dead&&!blocked()&&on('play')
     });
   }
   if(!playTray?.TOOLS?.some(row=>row[0]===tool))return false;if(!container.contains(playBox))container.append(playBox);
   const previous=playTray.tool??null;if(previous!==tool)playTray.pick(tool);
   return {ok:true,undo:()=>{playTray.pick(null);if(previous)playTray.pick(previous);return true;}};
  }
  const agentHome=root.CanvasHarnessAgentHome?.create({
    container,
    store,
    save,
    rerender,
    getContext:()=>({...ctx(),personal:store.get()}),
    studyStore,
    studyScope,
    env:root
  });
  const livePlan=(data=store.get())=>plan({...ctx(),local:data.tasks||{},__plan:null},helpers()).list;
  const openWork=(request={},data=store.get())=>
    livePlan(data).filter(e=>!e.done&&(!request.itemId||e.id===String(request.itemId))&&(!request.courseId||e.courseId===String(request.courseId))).sort((a,b)=>
      (Date.parse(a.dueAt)||Infinity)-(Date.parse(b.dueAt)||Infinity));
  const planner=root.ReservePlannerUI?.create({container,store,save,rerender,getContext,helpers,view:id=>preview(id)})||null;
  const room=enabled('focus-room')?root.ReserveFocusRoom?.create({container,store,task:()=>{
    const c=ctx(),h=helpers();
    return root.ReserveFocusRoom.pickTask(store.get().focus,plan(c,h).list,c.courses,v=>h.formatDate(v,c.s.timeZone,{weekday:'short',hour:'numeric',minute:'2-digit'}),Date.now());
  }}):null;
  // Size and place: the menu behind a module's three dots. It is built on demand and floats over the page.
  let menu=null,menuKey='';
  function closeMenu(refocus=false){
   if(!menu)return;const key=menuKey;menu.remove();menu=null;menuKey='';
   for(const b of container.querySelectorAll('.rd-arrange-more[aria-expanded="true"]'))b.setAttribute('aria-expanded','false');
   if(refocus)container.querySelector(`.rd-arrange-more[data-widget="${key}"]`)?.focus({preventScroll:true});
  }
  function openMenu(button,key){
   const A=Arrange(),size=ctx().s.moduleSize?.[key]||'m',E=helpers().E,label=A.LABELS[key];closeMenu();
   const box=(x,y,w,h)=>`<svg viewBox="0 0 34 24" aria-hidden="true"><rect x="1.5" y="1.5" width="31" height="21" rx="3.5"/><rect class="on" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/></svg>`;
   const pick=(action,value,label,art,on)=>`<button type="button" class="rd-mm-pick" role="menuitemradio" aria-checked="${!!on}" data-rd-action="${action}" data-widget="${key}" data-value="${value}">${art}<span>${label}</span></button>`;
   menu=container.ownerDocument.createElement('div');
   menu.className='rd-module-menu';
   menu.dataset.rdKeep='true';
   menu.setAttribute('role','menu');
   menu.setAttribute('aria-label',`${label}: size and place`);
   menu.innerHTML=`<h3>${E(label)}</h3><p>Width</p><div class="rd-mm-row">${pick('module-size','s','Narrow',box(12,5,10,14),size==='s')}${pick('module-size','m','Normal',box(9,5,16,14),size==='m')}${pick('module-size','l','Wide',box(5,5,24,14),size==='l')}</div>
<p>Give it a whole row or column</p><div class="rd-mm-row" data-cols="4">${pick('module-dock','top','Top',box(4.5,4.5,25,5))}${pick('module-dock','bottom','Bottom',box(4.5,14.5,25,5))}${pick('module-dock','left','Left',box(4.5,4.5,7,15))}${pick('module-dock','right','Right',box(22.5,4.5,7,15))}</div>
${A.removable(key)?`<button type="button" class="rd-mm-remove" role="menuitem" data-rd-action="widget-remove" data-widget="${key}">Remove from Home</button>`:''}`;
   container.append(menu);menuKey=key;button.setAttribute('aria-expanded','true');
   const r=button.getBoundingClientRect(),w=menu.offsetWidth||252,h=menu.offsetHeight||240,below=r.bottom+6+h<=win.innerHeight-8;
   menu.style.left=Math.max(10,Math.min(win.innerWidth-w-10,r.right-w))+'px';menu.style.top=Math.max(10,below?r.bottom+6:r.top-h-6)+'px';
   (menu.querySelector('[aria-checked="true"]')||menu.querySelector('button'))?.focus({preventScroll:true});
  }
  const outside=event=>{if(menu&&!event.composedPath().some(node=>node===menu||node?.classList?.contains?.('rd-arrange-more')))closeMenu();};
  container.ownerDocument.addEventListener('pointerdown',outside,true);win.addEventListener('resize',closeMenu);
  function sanitizePet(value,visible,depth=0){
    if(depth>16)return undefined;
    if(Array.isArray(value))return value.map(v=>sanitizePet(v,visible,depth+1)).filter(v=>v!==undefined);
    if(!record(value))return value;
    if(!visible&&(value.gradeAccess===true||['grade','feedback','course-grade'].includes(value.kind)))return undefined;
    const clean={};
    for(const [key,v]of Object.entries(value)){
      if(['__proto__','prototype','constructor'].includes(key)||!visible&&/^(?:grades?|scores?|earnedGrade|earnedScore|currentPercent|percent|enteredScore|enteredGrade|currentScore|finalScore|feedback|teacherComments|comments|submission|submissionComments|rubricAssessment)$/i.test(key.replace(/[_ -]/g,'')))continue;
      const next=sanitizePet(v,visible,depth+1);
      if(next!==undefined)clean[key]=next;
    }
    return clean;
  }
  function petInfo(){
   const c=ctx(),
     h=helpers(),
     data=store.get(),
     extra=c.biscuitData||c.biscuitContext||{},
     next=nextDue(c,h),
     {board,today}=plan(c,h),
     d=board.days.find(x=>x.key===today),
     source=new Map((c.items||[]).map(x=>[String(x.id),x])),
     visible=c.s.showGrades===true,
     sanitize=v=>
       root.ReserveBiscuitRegistry?.sanitize?
         root.ReserveBiscuitRegistry.sanitize(v,{showGrades:visible,settings:{showGrades:visible},teacherFeedback:visible}):
         sanitizePet(v,visible);
   const entries=livePlan(data).map(e=>
     sanitize({
       ...source.get(e.id),
       ...e,
       description:source.get(e.id)?.description||'',
       course:source.get(e.id)?.courseName||(c.courses||[]).find(x=>String(x.id)===e.courseId)?.name||e.course||'',
       submissionTypes:source.get(e.id)?.submissionTypes||[]
     })).filter(Boolean),
     focus=data.focus||{},
     sources={};
   for(const field of ['files','materials','pages','modules','courseModules','canvasModules','announcements','messages','teachers','links','submissions','rubrics','quizzes','discussions','calendarEvents','events','peerReviews','people','inbox','groups','syllabi','courseGrades','courseTotals','busy','calendar','controls'])
     if(extra[field]!==undefined||c[field]!==undefined)sources[field]=sanitize(extra[field]??c[field]);
   const links=Object.entries(data.courseFiles||{}).flatMap(([courseId,v])=>
     (Array.isArray(v)?v:v.items||[]).map(x=>({...x,title:x.title||x.name||'Saved file',courseId,savedFile:x.kind==='file'}))),
     controls=Object.keys(root.ReserveBiscuitControls?.DEFAULTS||{}).map(key=>
       ({
         key,
         label:key.replace(/([a-z])([A-Z])/g,'$1 $2'),
         value:c.s[key]??root.ReserveBiscuitControls.DEFAULTS[key],
         availableOperations:['set'],
         availableValues:root.ReserveBiscuitControls.ENUMS?.[key]||(typeof root.ReserveBiscuitControls.DEFAULTS[key]==='boolean'?[false,true]:[])
       }));
   return {
     ...sources,
     biscuitPlan:data.toolbox?.biscuitPlan,
     companion:{name:root.ReservePetArt?.identity?.(store.get(),getCustomPet())?.name},
     catalogue:getCatalogue(),
     now:Date.now(),
     timeZone:c.s.timeZone,
     settings:{...c.s,showGrades:visible},
     showGrades:visible,
     teacherFeedback:visible,
     offerHistory:data.toolbox?.biscuitOffers,
     courses:(c.courses||[]).map(sanitize),
     local:data.tasks||{},
     pet:Pets()?.clean(data.pet)||data.pet,
     features:(root.ReserveFeatures?.catalogue||[]).filter(v=>v.id!=='ai').map(v=>({...v,on:on(v.id)})),
     homeModules:(Arrange()?.ALL||[]).filter(available).map(id=>({id,title:Arrange().LABELS[id],shows:INFO[id]?.hint||''})),
     tabs:['home','assignments',...(on('planner')?['planner']:[]),...(on('materials')?['materials']:[]),...(on('course-hub')?['messages','course-hub']:[]),...(on('grades')?['grades']:[])],
     controls:[...controls,...(Array.isArray(sources.controls)?sources.controls:[])],
     reminders:data.pet?.reminders||[],
     routines:data.pet?.routines||[],
     notes:[
       {id:'scratchpad',title:'Your notes',text:drafts.notes??data.toolbox?.scratchpad??''},
       ...Object.entries(data.tasks||{}).filter(([,v])=>v.notes).map(([id,v])=>
         ({id:'note-'+id,title:source.get(id)?.name||'Task notes',text:v.notes,itemId:id,...(source.has(id)?{courseId:String(source.get(id).courseId)}:{})}))
     ],
     bookmarks:[...(data.resourcePins||[]),...entries.filter(e=>data.tasks?.[e.id]?.pinned)],
     links:[...(Array.isArray(sources.links)?sources.links:[]),...links],
     grades:visible?
       [
         ...(extra.grades||c.grades||[]),
         ...(c.courses||[]).filter(x=>x.score!=null).map(x=>({id:'course-grade-'+x.id,title:x.name,courseId:String(x.id),kind:'course-grade',value:x.score,currentPercent:x.score})),
         ...entries.filter(e=>Number.isFinite(e.score)).map(e=>
           ({id:'grade-'+e.id,title:e.title,courseId:e.courseId,value:e.score,score:e.score,points:e.points,feedback:e.feedback||e.teacherComments||''}))
       ]:
       [],
     workItems:entries,
     assignments:entries,
     planner:entries,
     skills:data.pet?.skills,
     studyAids:enabled('ai')?c.studyAids||{}:{},
     unreadAnnouncements:enabled('course-hub')?c.unreadAnnouncements||0:0,
     pageKind:c.pageKind||'dashboard',
     courseId:c.courseId||c.selected?.courseId||'all',
     selected:c.selected?sanitize(c.selected):null,
     quizTaking:c.quizTaking===true,
     pathname:root.location?.pathname||c.pathname||'',
     dark:c.theme==='dark',
     focus:{...focus,running:!!focus.endsAt},
     next:next?{id:next.id,title:next.title,course:next.course,when:`in ${howLong(next.ms)}`,urgent:next.ms<3*3600000}:null,
     todayOpen:d?.open||0,
     todayDone:d?.done||0
   };
  }
  let customPet=null,customPetId='',customPetVersion=0;
  function hydratePet(){
   if(getCustomPet||dead)return;
   const id=store.get().settings?.makeYourOwn?.pet?.id||'';
   if(id===customPetId)return;
   customPetId=id;customPet=null;const version=++customPetVersion;
   if(!id||!root.ReservePacks?.readLocal)return;
   Promise.resolve(root.ReservePacks.readLocal(id,{store})).then(value=>{
     if(dead||version!==customPetVersion||store.get().settings?.makeYourOwn?.pet?.id!==id)return;
     customPet=value?.kind==='pet'?value.pack:null;
     pets?.sync();
   }).catch(()=>{});
  }
  const selectedPet=()=>getCustomPet?getCustomPet():customPet;
  let planUndo=null;
  function planReceipt(plan){
    if(plan?.source!=='biscuit'||!Number.isSafeInteger(plan.window?.start)||!Number.isSafeInteger(plan.window?.end)||plan.window.end<=plan.window.start)return null;
    const itemIds=[...new Set((plan.itemIds||plan.items?.map(v=>v.itemId)||[]).map(mutationId).filter(Boolean))];
    if(!itemIds.length)return null;
    const estimates=Object.fromEntries(itemIds.map(key=>[key,plan.records?.[key]?.after?.estimate]).filter(([,value])=>planMillis(value)!==null));
    return {window:{...plan.window},itemIds,excludeIntervals:copy(plan.excludeIntervals||[]),...(Object.keys(estimates).length?{estimates}:{})};
  }
  async function writeLocalPlan(next){
    const P=root.ReserveBiscuitPlanner;
    if(!P)return {ok:false,message:'Reload Canvas Harness to use the local planner.'};
    let receipt,committed;
    const ok=await save(data=>{receipt=P.apply(data,next);if(receipt?.ok)committed=planReceipt(data.toolbox?.biscuitPlan);});
    if(receipt?.ok===false)return {ok:false,message:receipt.message};
    if(ok===false)return {ok:false,message:'The plan could not save. Try again.'};
    const previous=planUndo,undo=async()=>{
      let result,restored;
      const saved=await save(data=>{result=receipt.undo(data);if(result?.ok)restored=planReceipt(data.toolbox?.biscuitPlan);});
      if(saved===false||result===false||result?.ok===false)return {ok:false,message:result?.message||'The plan has changed. Your newer edits are kept.'};
      if(planUndo===undo)planUndo=previous;
      rerender();
      return {ok:true,message:'Undone.',plan:restored};
    };
    undo.targetId=next.id;
    planUndo=undo;
    rerender();
    return {ok:true,message:next.message||'Your plan is ready.',undo,plan:committed};
  }
  const planTaskState=task=>({plannedDate:task?.plannedDate||'',plannedTime:task?.plannedTime||'',estimate:Number.isFinite(task?.estimate)?task.estimate:0}),
    ownedBlock=(plan,id,data)=>{
    const r=plan.records?.[id];
    return r?.after&&['plannedDate','plannedTime','estimate'].every(key=>typeof r.before?.[key]?.had==='boolean')&&sameMutation(planTaskState(data.tasks?.[id]),r.after);
  };
  const planMillis=minutes=>{
    if(typeof minutes!=='number'||!Number.isFinite(minutes)||minutes<=0||minutes>1440)return null;
    const scaled=minutes*60000,milliseconds=Math.round(scaled);
    return milliseconds>0&&Number.isSafeInteger(milliseconds)&&Math.abs(scaled-milliseconds)<=Number.EPSILON*Math.max(1,Math.abs(scaled))?milliseconds:null;
  };
  function planRequest(request){
   if(!request||typeof request!=='object'||Array.isArray(request))return clarify('Choose a supported local study plan request.');
   request={...request};
   if(Object.hasOwn(request,'mode')){if(!['tonight','tomorrow','week'].includes(request.mode))return clarify('Choose a supported legacy planning mode.');delete request.mode;}
   for(const key of ['text','line'])
     if(request[key]!==undefined&&(typeof request[key]!=='string'||request[key].length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(request[key])))
       return clarify('Use bounded planning text.');
   if(request.text!==undefined){
     if(!['build-plan','replan','schedule-study'].includes(request.operation))return clarify('Planning text belongs only to building or replanning a study plan.');
     if(request.line!==undefined&&request.line.trim()!==request.text.trim())return clarify('The planning text and line must agree.');
     request.line??=request.text;
     delete request.text;
   }
   const allowed=new Set('operation targetId blockId plannerId itemId courseId minutes date time startAt endAt start end local line preserveAssignmentDeadline preserveCanvasDeadline preserveAssignment preserveNotes respectExistingCommitments restoreStartAt restoreEndAt preserveManualIds reason window windowStart windowEnd itemIds excludeIntervals estimates estimateItemId'.split(' '));
   if(Object.keys(request).some(key=>!allowed.has(key)))return clarify('That plan field is not supported here. Use explicit work IDs, times, and per-item estimates.');
   const aliases={move:'move-block',resize:'resize-block',remove:'remove-block'},
     operation=Object.hasOwn(aliases,request.operation)?aliases[request.operation]:request.operation,
     keys=['targetId','blockId','plannerId'].filter(key=>request[key]!==undefined),
     ids=keys.map(key=>mutationId(request[key]));
   if(ids.some(id=>!id)||new Set(ids).size>1)return clarify('Choose one valid local target ID; targetId, blockId, and plannerId must agree.');
   if(['blockId','plannerId'].some(key=>request[key]!==undefined)&&!['move-block','resize-block','remove-block','undo','replan'].includes(operation))
     return clarify('Block IDs need move, resize, remove, Undo, or an explicitly scoped replan.');
   for(const key of ['itemId','courseId'])if(request[key]!==undefined&&!mutationId(request[key]))return clarify('Choose valid existing work item and course IDs.');
   const building=['build-plan','replan','schedule-study'].includes(operation),allocation=['window','windowStart','windowEnd','itemIds','excludeIntervals','estimates','estimateItemId'];
   if(!building&&allocation.some(key=>request[key]!==undefined)||operation!=='undo'&&['restoreStartAt','restoreEndAt'].some(key=>request[key]!==undefined))
     return clarify('Use allocation fields only for building a plan and restoration fields only for Undo.');
   if(request.local===false||
     request.preserveAssignmentDeadline===false||
     request.preserveCanvasDeadline===false||
     request.preserveNotes===false||
     request.respectExistingCommitments===false||
     operation==='remove-block'&&request.preserveAssignment===false)
     return clarify('Only local study blocks can change. Canvas assignments, notes, commitments, and deadlines are kept.');
   const next={...request,operation,...(ids.length?{targetId:ids[0]}:{})};
   if(request.window!==undefined){
     const window=request.window;
     if(!window||
       typeof window!=='object'||
       Array.isArray(window)||
       Object.keys(window).length!==2||
       !Number.isSafeInteger(window.start)||
       !Number.isSafeInteger(window.end)||
       window.start<=0||
       window.end<=window.start)
       return clarify('Choose one numeric start and end for the planning window.');
     for(const [key,value]of [['startAt',window.start],['start',window.start],['windowStart',window.start],['endAt',window.end],['end',window.end],['windowEnd',window.end]])
       if(request[key]!==undefined&&reminderStamp(request[key])!==value)return clarify('The planning window and timestamps must agree.');
     Object.assign(next,{window:{...window},startAt:window.start,endAt:window.end});
   }
   else if(request.windowStart!==undefined||request.windowEnd!==undefined)return clarify('Use an explicit window with matching start and end timestamps.');
   for(const [alias,key]of [['start','startAt'],['end','endAt']])
     if(next[alias]!==undefined&&(next[key]===undefined||reminderStamp(next[alias])===null||reminderStamp(next[alias])!==reminderStamp(next[key])))
       return clarify('Use matching startAt and endAt timestamps for this local block.');
   if(['remove-block','undo'].includes(operation)&&['startAt','endAt','minutes','date','time'].some(key=>next[key]!==undefined))
     return clarify('Remove and Undo do not accept new block times or durations.');
   return {ok:true,request:next};
  }
  async function planOperation(request){
   const normalized=planRequest(request);if(!normalized.ok)return normalized;request=normalized.request;
   if(!on('planner'))return unavailable('Planner');
   const P=root.ReserveBiscuitPlanner,C=root.CanvasHarnessAgentClock,{operation}=request;
   if(!P||!C)return clarify('Reload Canvas Harness to use the local planner.');
   if(!['schedule-study','build-plan','replan','move-block','resize-block','remove-block','undo'].includes(operation))return clarify('Choose a supported local study plan operation.');
   if(request.preserveAssignmentDeadline===false)return clarify('Only local study blocks can change. Canvas deadlines are kept.');
   if(operation==='undo'){
     if(request.targetId!==undefined&&(!mutationId(request.targetId)||![planUndo?.targetId,planUndo?.itemId].includes(String(request.targetId)))||
       request.itemId!==undefined&&planUndo?.itemId!==String(request.itemId))
       return clarify('There is no saved Undo for that selected block or plan.');
     for(const key of ['restoreStartAt','restoreEndAt'])
       if(request[key]!==undefined&&(reminderStamp(request[key])===null||reminderStamp(request[key])!==planUndo?.[key]))
         return clarify('Those restoration times do not match the saved Undo receipt. Your current plan is kept.');
     try{return await undoLocalPlan();}catch{return clarify('The plan Undo could not save. Try again.');}
   }
   const startAt=request.startAt===undefined?undefined:reminderStamp(request.startAt),endAt=request.endAt===undefined?undefined:reminderStamp(request.endAt);
   if(startAt===null||endAt===null||startAt!==undefined&&endAt!==undefined&&endAt<=startAt)return clarify('Choose valid numeric timestamps or dated times with a timezone offset.');
   if(request.minutes!==undefined&&planMillis(request.minutes)===null)return clarify('Choose positive minutes up to 1440 that resolve to whole milliseconds.');
   if(request.date!==undefined&&!validDay(request.date)||request.time!==undefined&&(typeof request.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(request.time)))
     return clarify('What valid date and time should this local block use?');
   if(['build-plan','replan','schedule-study'].includes(operation)){
    if(request.minutes!==undefined&&!Number.isInteger(request.minutes)&&!request.window)
      return clarify('This legacy plan builder requires whole minutes. Use an explicit window and a per-item estimate for an exact fractional duration.');
    const scoped=request.itemId??(operation==='schedule-study'?request.targetId:undefined),
      itemId=scoped===undefined?undefined:mutationId(scoped),
      snapshot=petInfo(),
      current=store.get().toolbox?.biscuitPlan;
    if(scoped!==undefined&&!itemId||operation==='schedule-study'&&!itemId)return clarify('Which existing work item should I schedule?');
    if(request.targetId!==undefined&&operation!=='schedule-study'&&!request.blockId&&!request.plannerId&&request.targetId!==current?.id)return clarify('Choose the current local Biscuit plan.');
    if(request.itemId!==undefined&&request.targetId!==undefined&&operation==='schedule-study'&&String(request.itemId)!==String(request.targetId))return clarify('Choose one work item ID to schedule.');
    let blockScope=null;
    if(operation==='replan'&&(request.blockId!==undefined||request.plannerId!==undefined)){
      const matches=(current?.blocks||[]).filter(v=>String(v.id)===String(request.targetId)),
        block=matches[0],
        same=block&&(current.blocks||[]).filter(v=>v.itemId===block.itemId&&v.kind!=='break'),
        item=block&&(current.items||[]).find(v=>v.itemId===block.itemId);
      if(!request.window||
        matches.length!==1||
        !block.itemId||
        same.length!==1||
        !ownedBlock(current,block.itemId,store.get())||
        (current.remaining||[]).some(v=>v.itemId===block.itemId)||
        planMillis(item?.estimate)!==block.end-block.start)
        return clarify('Block-scoped replan needs one fully planned owned work block and an explicit window. Use a full replan for split or unfinished work.');
      if(request.minutes!==undefined||
        request.estimates!==undefined||
        request.estimateItemId!==undefined||
        request.itemId!==undefined&&String(request.itemId)!==block.itemId||
        request.itemIds!==undefined&&(!Array.isArray(request.itemIds)||request.itemIds.length!==1||String(request.itemIds[0])!==block.itemId))
        return clarify('Replanning this block preserves its work item and duration.');
      blockScope={id:block.itemId,milliseconds:block.end-block.start};
    }
     if(request.courseId!==undefined&&!ctx().courses.some(row=>String(row.id)===String(request.courseId)))return clarify('Choose an existing course to plan.');
     if(itemId&&snapshot.assignments.filter(row=>row.id===itemId&&(request.courseId===undefined||row.courseId===String(request.courseId))&&!row.done).length!==1)
       return clarify('Choose one existing incomplete work item and its course.');
     if(operation==='schedule-study'&&current?.blocks?.some(block=>block.itemId&&block.itemId!==itemId))return clarify('Use replan to schedule another item alongside the existing local Biscuit plan.');
    if(operation==='schedule-study'&&request.itemIds!==undefined&&(!Array.isArray(request.itemIds)||request.itemIds.length!==1||String(request.itemIds[0])!==itemId))
      return clarify('Schedule-study needs one work item. Use build-plan for several selected items.');
    const options={
      ...(request.line!==undefined?{line:request.line}:{}),
      ...(request.date!==undefined?{date:request.date}:{}),
      ...(request.time!==undefined?{start:request.time}:{}),
      ...(startAt!==undefined?{start:startAt}:{}),
      ...(endAt!==undefined?{end:endAt}:{}),
      ...(itemId?{itemId}:{}),
      ...(request.courseId!==undefined?{courseId:request.courseId}:{}),
      ...(request.minutes!==undefined?{[operation==='schedule-study'?'durationMinutes':'minutes']:request.minutes}:{}),
      ...Object.fromEntries(['window','itemIds','excludeIntervals','estimates','estimateItemId'].filter(key=>request[key]!==undefined).map(key=>[key,request[key]]))
    };
    if(startAt!==undefined&&request.time!==undefined){
      const at=C.calendar(snapshot.timeZone)(startAt),want=request.time.split(':').map(Number);
      if(at.minute!==want[0]*60+want[1]||request.date!==undefined&&request.date!==at.day)return clarify('The date, time, and timestamp disagree. Which exact start should I use?');
    }
    if(operation==='schedule-study'&&request.minutes===undefined&&startAt!==undefined&&endAt!==undefined){
      const minutes=(endAt-startAt)/60000;
      if(!Number.isInteger(minutes)||minutes<=0||minutes>1440)return clarify('Choose a whole study duration from 1 to 1440 minutes.');
      options.durationMinutes=minutes;
    }
    if(blockScope){options.itemIds=[blockScope.id];delete options.itemId;}
    const normalized=P.normalizeRequest?.(snapshot,options);
    if(normalized?.ok===false)return clarify(normalized.message);
    if(!normalized&&['window','itemIds','estimates','excludeIntervals'].some(key=>request[key]!==undefined))return clarify('Reload Canvas Harness to use explicit planning windows and per-item estimates.');
    const next=P.build(snapshot,normalized?.request||options);
    if(next.window?.start===null||next.needsTime)return clarify(next.message||'Choose a valid local planning window.');
    if(request.window&&(next.window.start!==request.window.start||next.window.end!==request.window.end))return clarify('That exact planning window is unavailable. Choose another window.');
    if(startAt!==undefined&&(next.window.start!==startAt||operation==='schedule-study'&&next.blocks.find(block=>block.itemId===itemId)?.start!==startAt))
      return clarify('That exact start timestamp is unavailable. Choose another time.');
    if(request.time!==undefined){
      const local=C.calendar(snapshot.timeZone),
        day=request.date||local(snapshot.now).day,
        parts=request.time.split(':').map(Number),
        expected=C.wall(day,parts[0]*60+parts[1],snapshot.timeZone,snapshot.now-1)??C.wall(day,parts[0]*60+parts[1],snapshot.timeZone);
      if(expected===null||next.window.start!==expected||operation==='schedule-study'&&next.blocks.find(block=>block.itemId===itemId)?.start!==expected)
        return clarify('That exact time is unavailable. Choose another start time.');
    }
    if(blockScope&&
      (next.blocks.filter(v=>v.itemId===blockScope.id).reduce((n,v)=>n+v.end-v.start,0)!==blockScope.milliseconds||
        (next.remaining||[]).some(v=>v.itemId===blockScope.id)))
      return clarify('The complete selected block does not fit that window. Your saved plan is kept.');
    if(operation==='schedule-study'&&
      (!next.blocks.some(block=>block.itemId===itemId)||
        options.durationMinutes!==undefined&&next.blocks.filter(block=>block.itemId===itemId).reduce((n,block)=>n+block.minutes,0)!==options.durationMinutes||
        endAt!==undefined&&next.blocks.filter(block=>block.itemId===itemId).at(-1)?.end!==endAt))
      return clarify('That exact study duration does not fit. Choose another duration or time.');
    try{return await writeLocalPlan(next);}catch{return clarify('The local plan could not save. Your saved plan is kept.');}
   }
   const targetId=request.targetId===undefined?'':mutationId(request.targetId),itemId=request.itemId===undefined?'':mutationId(request.itemId);
   if(!targetId&&!itemId||request.targetId!==undefined&&!targetId||request.itemId!==undefined&&!itemId)return clarify('Which local Biscuit block should I change?');
   if(operation==='move-block'&&request.date===undefined&&request.time===undefined&&startAt===undefined&&endAt===undefined)return clarify('What date or time should the selected block move to?');
   if(operation==='resize-block'&&request.minutes===undefined&&endAt===undefined)return clarify('How many minutes should the selected block last?');
   const previous=planUndo;
   const result=await localMutation('plan',operation,data=>{
     const p=data.toolbox?.biscuitPlan;
     if(p?.source!=='biscuit'||p.version!==1||!Array.isArray(p.blocks))return clarify('Choose an existing local Biscuit study block.');
     let matches=p.blocks.filter(block=>(!targetId||String(block.id)===targetId)&&(!itemId||String(block.itemId)===itemId));
     if(!matches.length&&targetId&&(!itemId||itemId===targetId))matches=p.blocks.filter(block=>String(block.itemId)===targetId);
     if(matches.length!==1)return clarify('Choose one block ID; this item may have several study blocks.');
     const block=matches[0],id=block.itemId,original=copy(block);
     if(request.courseId!==undefined&&ctx().items.filter(row=>String(row.id)===String(id)&&String(row.courseId)===String(request.courseId)).length!==1)
       return clarify('Choose the study block in that work item course.');
     if(id&&!ownedBlock(p,id,data))return clarify('That block has a newer manual schedule. Your edits are kept.');
     if(id&&(data.tasks?.[id]?.checkedOff||data.tasks?.[id]?.progress==='done'))return clarify('That work is already complete. Choose an incomplete study block.');
     const local=C.calendar(p.timeZone||ctx().s.timeZone),oldSum=p.blocks.filter(v=>v.itemId===id&&id).reduce((n,v)=>n+v.end-v.start,0);
    const originalMillis=block.end-block.start;
    if(!Number.isSafeInteger(originalMillis)||planMillis(block.minutes)!==originalMillis)return clarify('That block has inconsistent stored timing. Replan before changing it.');
    if(operation==='move-block'&&request.minutes!==undefined&&planMillis(request.minutes)!==originalMillis)return clarify('Moving a block keeps its duration. Use resize to change its length.');
    if(operation==='resize-block'&&(request.date!==undefined||request.time!==undefined)){
      const at=local(block.start),parts=request.time?.split(':').map(Number);
      if(request.date!==undefined&&request.date!==at.day||parts&&at.minute!==parts[0]*60+parts[1])return clarify('Resizing keeps the start time. Use move-block to change it.');
    }
    if(operation==='move-block'&&startAt===undefined&&endAt===undefined){
      const current=local(block.start),
        day=request.date||current.day,
        time=request.time||String(Math.floor(current.minute/60)).padStart(2,'0')+':'+String(current.minute%60).padStart(2,'0'),
        parts=time.split(':').map(Number),
        remainder=request.time===undefined?(block.start%60000+60000)%60000:0,
        start=C.wall(day,parts[0]*60+parts[1],p.timeZone||ctx().s.timeZone,Date.now()-remainder-1)??C.wall(day,parts[0]*60+parts[1],p.timeZone||ctx().s.timeZone);
      if(start===null)return clarify('That local time does not exist. Choose another time.');
      block.start=start+remainder;
      block.end=block.start+originalMillis;
    }
    if(operation==='move-block'&&(startAt!==undefined||endAt!==undefined)){
      const start=startAt??endAt-originalMillis,end=endAt??start+originalMillis;
      if(end-start!==originalMillis)return clarify('Moving a block keeps its duration. Use resize to change its length.');
      if(request.date!==undefined||request.time!==undefined){
        const at=local(start),parts=request.time?.split(':').map(Number);
        if(request.date!==undefined&&at.day!==request.date||parts&&at.minute!==parts[0]*60+parts[1])return clarify('The date, time, and timestamp disagree. Choose one exact start.');
      }
      block.start=start;
      block.end=end;
    }
    if(operation==='resize-block'){
      if(startAt!==undefined&&startAt!==block.start)return clarify('Use move-block to change the block start time.');
      const milliseconds=request.minutes===undefined?endAt-block.start:planMillis(request.minutes),limit=planMillis(block.kind==='break'?15:p.focusMinutes||45);
      if(!Number.isSafeInteger(milliseconds)||
        milliseconds<=0||
        limit===null||
        milliseconds>limit||
        block.kind==='break'&&milliseconds<5*60000||
        endAt!==undefined&&endAt!==block.start+milliseconds)
        return clarify('That length needs a new plan with suitable focus breaks.');
      block.minutes=milliseconds/60000;
      block.end=block.start+milliseconds;
    }
    if(operation==='remove-block')p.blocks=p.blocks.filter(v=>v!==block);
    p.blocks.sort((a,b)=>a.start-b.start||a.end-b.end);
    if(p.blocks[0]?.kind==='break'||p.blocks.at(-1)?.kind==='break')return clarify('Removing that block would leave an isolated break. Replan this local schedule.');
    let effort=0,last=null;
    const focusLimit=planMillis(p.focusMinutes||45);
    if(focusLimit===null)return clarify('That plan has an invalid focus limit. Replan this local schedule.');
    for(const b of p.blocks){
      if(!Number.isSafeInteger(b.start)||
        !Number.isSafeInteger(b.end)||
        b.end<=b.start||
        planMillis(b.minutes)!==b.end-b.start||
        b===block&&operation!=='remove-block'&&b.start<Date.now()||
        b.start<p.window?.start||
        b.end>p.window?.end||
        last&&b.start<last.end)
        return clarify('That change falls outside the plan or overlaps another block. Choose another time.');
      if(last&&b.start-last.end>=5*60000||b.kind==='break')effort=0;
      if(b.kind!=='break'){effort+=b.end-b.start;if(effort>focusLimit)return clarify('That change removes a needed focus break. Replan this local schedule.');}
      last=b;
    }
    const selected=operation==='remove-block'?[]:[block],overlap=(a,b)=>a.start<b.end&&b.start<a.end,busy=[...(p.busy||[])];
    for(const [key,task]of Object.entries(data.tasks||{})){
      if(!task.plannedDate||!task.plannedTime||ownedBlock(p,key,data))continue;
      const parts=task.plannedTime.split(':').map(Number),start=C.wall(task.plannedDate,parts[0]*60+parts[1],p.timeZone||ctx().s.timeZone);
      if(start!==null)busy.push({start,end:start+(task.estimate||25)*60000});
    }
    for(const row of data.pet?.reminders||[])busy.push({start:row.at,end:row.at+5*60000});
    if(data.focus?.endsAt>Date.now())busy.push({start:Date.now(),end:data.focus.endsAt});
    if(selected.some(b=>busy.some(other=>overlap(b,other))))return clarify('That time overlaps a saved task, reminder, or focus session. Choose another time.');
    const work=id&&ctx().items.find(row=>String(row.id)===id),due=work?.dueAt?Date.parse(work.dueAt):null;
    if(selected.some(b=>Number.isFinite(due)&&due>Date.now()&&b.end>due))return clarify('That block would end after the existing deadline. Choose an earlier time.');
    if(id){
      const remaining=p.blocks.filter(v=>v.itemId===id),
        record=p.records[id],
        task=data.tasks[id],
        totalMillis=remaining.reduce((n,v)=>n+v.end-v.start,0),
        total=totalMillis/60000,
        item=(p.items||[]).find(v=>v.itemId===id);
      if(!remaining.length){
        for(const key of ['plannedDate','plannedTime','estimate'])if(record.before[key].had)task[key]=copy(record.before[key].value);else delete task[key];
        delete p.records[id];
        p.items=(p.items||[]).filter(v=>v.itemId!==id);
        p.remaining=(p.remaining||[]).filter(v=>v.itemId!==id);
      }
      else{
        const at=local(remaining[0].start),estimate=Math.max(total,((planMillis(item?.estimate??task.estimate)??(item?.estimate??task.estimate)*60000)+totalMillis-oldSum)/60000);
        if(estimate>1440)return clarify('That task would exceed the local duration limit.');
        Object.assign(task,{plannedDate:at.day,plannedTime:String(Math.floor(at.minute/60)).padStart(2,'0')+':'+String(at.minute%60).padStart(2,'0'),estimate});
        record.after=planTaskState(task);
        if(item){item.minutes=total;item.estimate=estimate;}
      }
    }
    p.workMinutes=p.blocks.filter(v=>v.kind!=='break').reduce((n,v)=>n+v.end-v.start,0)/60000;
    p.breakMinutes=p.blocks.filter(v=>v.kind==='break').reduce((n,v)=>n+v.end-v.start,0)/60000;
    p.totalMinutes=p.blocks.reduce((n,v)=>n+v.end-v.start,0)/60000;
    p.remainingMinutes=(p.remaining||[]).reduce((n,v)=>n+v.minutes,0);
    p.overloaded=p.remainingMinutes>0;
    p.message=operation==='remove-block'?'Removed the selected local study block.':operation==='move-block'?'Moved the selected local study block.':'Resized the selected local study block.';
    return {ok:true,targetId:String(block.id),original,after:operation==='remove-block'?null:{...copy(block),startAt:block.start,endAt:block.end},message:p.message};
   });
   if(result.ok&&result.undo){
     const revert=result.undo,undo=async()=>{
       const restored=await revert();
       if(restored?.ok){if(planUndo===undo)planUndo=previous;restored.plan=planReceipt(store.get().toolbox?.biscuitPlan);}
       return restored;
     };
     undo.targetId=result.targetId;
     undo.itemId=result.original?.itemId;
     undo.restoreStartAt=result.original?.start;
     undo.restoreEndAt=result.original?.end;
     result.before={...copy(result.original),startAt:result.original?.start,endAt:result.original?.end};
     result.undo=undo;
     planUndo=undo;
     rerender();
   }
   return result;
  }
  function addStudyBlock(request={}){
   if(!on('planner')||!Plan()?.addTask)return unavailable('Planner');const c=ctx(),day=request.day??request.date,today=helpers().dayKey(Date.now(),c.s.timeZone),title=request.title;
   if(typeof title!=='string'||
     !title.trim()||
     title.length>200||
     /[\u0000-\u001f\u007f]/.test(title)||
     !validDay(day)||
     day<today||
     !Number.isInteger(request.minutes)||
     request.minutes<1||
     request.minutes>1440||
     request.time!==undefined&&(typeof request.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(request.time)))
     return clarify('Choose a title, a current or future day, and 1 to 1440 whole minutes.');
   const targetId=newId();return localMutation('plan','add-block',data=>{
    const latest=ctx(),
      matches=request.itemId===undefined?
        []:
        latest.items.filter(row=>String(row.id)===String(request.itemId)&&(!request.courseId||String(row.courseId)===String(request.courseId))),
      linked=matches[0];
    if(request.itemId!==undefined&&(matches.length!==1||helpers().complete?.(linked)||data.tasks?.[String(linked.id)]?.checkedOff)||
      request.courseId!==undefined&&!latest.courses.some(row=>String(row.id)===String(request.courseId)))
      return clarify('Choose one current work item and its course.');
    if((data.customTasks||[]).length>=1000)return clarify('The planner is full. Remove a personal task first.');
    const courseId=linked?String(linked.courseId):request.courseId?String(request.courseId):'personal';
    data.customTasks||=[];
    data.tasks||={};
    Plan().addTask(
      {name:title.trim(),day,estimate:request.minutes,...(request.time!==undefined?{at:request.time}:{})},
      {courseId,id:targetId,nowISO:new Date().toISOString()})(data);
    if(linked){
      const task=data.customTasks.find(row=>row.id===targetId);
      task.sourceItemId=String(linked.id);
      const raw=linked.url||linked.html_url;
      if(raw)
        try{
          const url=new URL(raw,store.owner?.origin||root.location?.origin);
          if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)task.source={kind:'link',url:url.href,title:linked.name||linked.title||title.trim()};
        }catch{}
    }
    return {ok:true,targetId,courseId,after:{id:targetId,title:title.trim(),courseId,day,minutes:request.minutes},message:'Added the local study block.'};
   });
  }
  function localPlan(request={}){
    if(request.operation==='add-block')return addStudyBlock(request);
    if(request.operation!==undefined)return planOperation(request);
    const P=root.ReserveBiscuitPlanner;
    return P?writeLocalPlan(P.build(petInfo(),request)):Promise.resolve({ok:false,message:'Reload Canvas Harness to use the local planner.'});
  }
  async function undoLocalPlan(){return planUndo?planUndo():{ok:false,message:'There is no plan to undo.'};}
  function localEntry(request){
   // A tool's URL is resolved from its current source catalogue by the registry provider.
   // Model fields never supply this capability, and ordinary Biscuit requests keep their existing path.
   if(request.sourceId){
     if(!sourceExecution||sourceExecution.id!==request.sourceId||!root.location?.assign)return false;
     root.location.assign(sourceExecution.url);
     return true;
   }
   const row=root.ReserveBiscuitEngine?.prepare(petInfo()).find(v=>
     v.id===String(request.entryId)&&(!request.kind||v.kind===request.kind)&&(!request.courseId||v.courseId===String(request.courseId)));
   if(!row)return false;
   if(row.savedFile&&openCourseFile)return openCourseFile(row.courseId,row.id);
   if(row.kind==='note')return navigateCommand({tab:'home'});
   if(['setting','feature'].includes(row.kind)){openSettings(row.kind==='feature'?'settings':root.ReserveCustomizeUI?.tabFor?.(row.key)||'all');rerender();return true;}
   if(row.kind==='grade')return navigateCommand({tab:'grades',courseId:row.courseId});
   const raw=request.url||row.url;
   if(!raw)return row.courseId?openItem({courseId:row.courseId}):{ok:false,message:'Open its course to view this loaded item.'};
   try{
     const u=new URL(raw,root.location?.origin||globalThis.ReserveSite?.origin?.()||'https://school.instructure.com');
     if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return false;
     root.location?.assign?.(u.href);
     return true;
   }catch{return false;}
  }
  function bookmarkOperation(request){
   const {operation}=request;
   if(!['create','edit','delete','undo-delete','undo-edit'].includes(operation))return clarify('Choose create, edit, delete, or Undo for a bookmark.');
   if(operation.startsWith('undo-'))return undoMutation('bookmark',request,[operation.slice(5)]);
   const targetId=mutationId(request.targetId??request.entryId??request.itemId);
   if(!targetId)return clarify('Which existing item or bookmark should I use?');
   if(request.text!==undefined)return clarify('A bookmark stores a local title and its existing link. Which title should I use?');
   if(request.title!==undefined&&(typeof request.title!=='string'||!request.title.trim()||request.title.length>300))return clarify('Choose a bookmark title of 1 to 300 characters.');
   return localMutation('bookmark',operation,data=>{
     const course=request.courseId===undefined?null:mutationId(request.courseId),
       pins=(data.resourcePins||[]).map((row,index)=>({row,index})).filter(({row})=>String(row.id)===targetId&&(course===null||String(row.courseId)===course)),
       work=ctx().items.filter(row=>String(row.id)===targetId&&(course===null||String(row.courseId)===course)),
       tasks=work.filter(row=>data.tasks?.[String(row.id)]?.pinned);
    if(pins.length+tasks.length>1||work.length>1)return clarify('Which course and bookmark ID should I change?');
    if(operation!=='create'&&!pins.length&&!tasks.length)return clarify('Choose an existing saved bookmark ID.');
    if(pins.length){
      const {row,index}=pins[0];
      if(operation==='edit'){if(request.title===undefined)return clarify('What should the bookmark title be?');row.title=request.title;}else if(operation==='delete')data.resourcePins.splice(index,1);
      return {
        ok:true,
        targetId,
        courseId:String(row.courseId),
        message:operation==='delete'?'Removed the selected bookmark.':operation==='edit'?'Saved the local bookmark title.':'That item is already bookmarked.'
      };
    }
    if(work.length&&!request.entryId){
      if(request.title!==undefined)return clarify('Assignment bookmark titles follow the assignment. Its Canvas title is kept.');
      const row=work[0],task=localTask(data,targetId),original=copy(task);
      if(operation==='edit')return clarify('Assignment bookmarks have no separate editable title.');
      task.pinned=operation!=='delete';
      return {ok:true,targetId,courseId:String(row.courseId),original,message:operation==='delete'?'Removed the selected bookmark.':'Bookmarked the selected item locally.'};
    }
    if(operation!=='create')return clarify('Choose an existing saved bookmark ID.');
    const rows=(root.ReserveBiscuitEngine?.prepare(petInfo())||[]).filter(row=>
      row.id===targetId&&(course===null||row.courseId===course)&&(!request.kind||row.kind===request.kind)&&!['note','bookmark','action','setting','feature'].includes(row.kind));
    if(rows.length!==1)return clarify('Choose one loaded item and its course to bookmark.');
    const row=rows[0];
    if(row.savedFile)return clarify('That file is already saved in My links & files.');
    let url;
    try{url=new URL(row.url);}catch{return clarify('That loaded item has no valid link to bookmark.');}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!/^\d+$/.test(row.courseId)||row.id.length>180||(request.title??row.title).length>300)
      return clarify('Choose a loaded course item with a valid bookmark link and title.');
    if((data.resourcePins||[]).length>=300)return clarify('Bookmarks is full. Remove a shortcut first.');
    data.resourcePins||=[];
    data.resourcePins.push({id:row.id,courseId:row.courseId,title:request.title??row.title,url:url.href,category:row.kind,moduleName:row.moduleName||''});
    return {ok:true,targetId,courseId:row.courseId,message:'Bookmarked the selected item locally.'};
   });
  }
  function bookmarkCommand(request={}){
    if(request.operation!==undefined)return on('planner')?bookmarkOperation(request):unavailable('Bookmarks');
    if(!request.entryId)return bookmark?bookmark(request):false;
    const rows=(root.ReserveBiscuitEngine?.prepare(petInfo())||[]).filter(v=>
      v.id===String(request.entryId)&&(!request.kind||v.kind===request.kind)&&(!request.courseId||v.courseId===String(request.courseId)));
    if(rows.length!==1)return false;
    const row=rows[0];
    if(row.savedFile)return {ok:true,message:'Already saved in My links & files.'};
    let url;
    try{url=new URL(row.url,store.owner?.origin||root.location?.origin);}catch{return false;}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!/^\d+$/.test(row.courseId))return false;
    return save(data=>{
      data.resourcePins||=[];
      if(data.resourcePins.some(v=>v.id===row.id&&v.courseId===row.courseId))return;
      if(data.resourcePins.length>=300)throw Error('Bookmarks is full. Remove a shortcut first.');
      data.resourcePins.push({id:row.id,courseId:row.courseId,title:row.title,url:url.href,category:row.kind,moduleName:row.moduleName||''});
    });
  }
  async function changeLocalPlan(request,remove=false){
    const id=String(request.itemId),row=ctx().items.find(v=>String(v.id)===id);
    if(!row||!remove&&!validDay(request.date)||request.time!==undefined&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(request.time))return false;
    const ok=await save(data=>{
      data.tasks[id]||={};
      data.tasks[id].plannedDate=remove?'':request.date;
      if(remove)delete data.tasks[id].plannedTime;else if(request.time!==undefined)data.tasks[id].plannedTime=request.time;
      const plan=data.toolbox?.biscuitPlan;
      if(plan)plan.blocks=(plan.blocks||[]).filter(b=>String(b.itemId)!==id);
    });
    if(ok===false)return false;
    return {
      ok:true,
      message:remove?
        'Removed the local plan for '+(row.title||row.name)+'.':
        'Moved '+
          (row.title||row.name)+
          ' to '+
          new Date(request.date+'T12:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short'})+
          (request.time?' '+new Date(request.date+'T'+request.time+':00Z').toLocaleTimeString('en-US',{timeZone:'UTC',hour:'numeric',minute:'2-digit'}):'')+
          '.'
    };
  }
  async function completeLocal(request){
    const id=String(request.itemId),row=ctx().items.find(v=>String(v.id)===id);
    if(!row)return false;
    const ok=await save(data=>{data.tasks[id]||={};data.tasks[id].checkedOff=true;data.tasks[id].progress='done';});
    return ok===false?false:{ok:true,message:'Marked '+(row.title||row.name)+' done locally.'};
  }

  function installedCommand(request){
   if(request.action==='use'){
     if(!on('customization'))return unavailable('Appearance editor');
     const row=getCatalogue().find(row=>row.id===request.id),kind=row?.kind||request.kind,feature={scene:'scene-themes',pet:'pony',art:'course-art',kit:'course-art'}[kind];
     if(feature&&!on(feature))return unavailable(root.ReserveFeatures?.catalogue.find(f=>f.id===feature)?.name||feature);
   }
   return installed?installed(request):false;
  }
   const actions={
     installed:installedCommand,
     catalogue:()=>loadCatalogue?.(),
     setting:appearanceCommand,
     preset:request=>on('customization')&&on('arrange')?layoutPreset?layoutPreset(request):false:unavailable('Appearance editor or arrangement'),
     feature:featureCommand,
     features:featureCommand,
     module:moduleCommand,
     navigate:navigateCommand,
     skill:skillCommand,
     note:noteCommand,
     bookmark:request=>bookmarkCommand(request),
     play:playCommand,
     reload:()=>root.location?.reload(),
     open:request=>request.entryId?localEntry(request):openItem(request),
     find:request=>request.entryId?localEntry(request):openItem(request),
     focus:item=>startPonyFocus(item),
     'focus-control':request=>focusControl(request),
     'focus-status':()=>focusStatus(),
     reminder:request=>addReminder(request),
     due:request=>dueWork(request),
     study:request=>studyWork(request),
     plan:items=>items?.local||items?.operation!==undefined?localPlan(items):planTonight(items),
     move:request=>changeLocalPlan(request),
     remove:request=>changeLocalPlan(request,true),
     complete:request=>completeLocal(request),
     chat:()=>true,
     none:()=>true,
     break:request=>startBreak(request),
     stretch:()=>store.get().pet?.skills?.wellbeing!==false?startBreak({minutes:5,explicit:true,stretch:true}):false,
     review:item=>openReview(item),
     ready:item=>openReady(item),
     ai:request=>openAI(request),
     practice:item=>openStudy('practice',item),
     lab:item=>openStudy('lab',item),
     reading:item=>openStudy('reading',item),
     notes:item=>openStudy('notes',item),
     rubric:item=>openStudy('rubric',item),
     fixes:item=>openStudy('fixes',item),
     inbox:()=>enabled('course-hub')&&skillEnabled('inbox')?announcements():false,
     settings:()=>{
     if(!enabled('customization'))return false;
     settingsTab='pet';
     openSettings('pet');
     rerender();
     return true;
   }};
   actions.copy=async({text}={})=>{
     if(typeof text!=='string'||!text.trim()||text.length>12000||!root.navigator?.clipboard?.writeText)return {ok:false,message:'Copy is unavailable. Select the text and copy it.'};
     await root.navigator.clipboard.writeText(text);
     return {ok:true,message:'Copied.'};
   };
   actions.batch=async({steps})=>{
     const journal=recording,undos=[],messages=[],receipts=[];
     let completed=0,failure='';
     for(const step of steps||[]){
       if(step.manual===true||step.ui){failure=step.message||'Complete this step in '+(step.ui?.path||['the requested controls']).join(' > ')+'.';break;}
       const action=actions[step.action];
       if(!action||step.action==='batch'){failure='An action is unavailable.';break;}
       let result;
       const firstPatch=journal?.changes.length||0;
       try{
         result=await capture(journal,()=>action(step.action==='ai'?{question:step.fields.handoff?.wishes||step.fields.text,handoff:step.fields.handoff}:step.fields));
       }catch{failure='An action could not finish.';break;}
       if(result===false||result?.ok===false){failure=result?.message||'An action could not finish.';break;}
       completed++;
       messages.push(typeof result==='string'?result:result?.message||step.message||'Completed '+step.action+'.');
       if(['note','bookmark','reminder','plan'].includes(step.action)&&result?.ok===true)
         receipts.push({
           action:step.action,
           fields:Object.fromEntries(['operation','targetId','blockId','plannerId','itemId','courseId'].filter(key=>step.fields?.[key]!==undefined).map(key=>[key,step.fields[key]])),
           result:{ok:true,...Object.fromEntries(['before','after','targetId','plan'].filter(key=>Object.hasOwn(result,key)).map(key=>[key,copy(result[key])]))}
         });
       if(result?.undo){
         undos.push(result.undo);
         if(journal&&(step.action==='plan'||step.action==='navigate'||step.fields?.operation!==undefined&&['note','bookmark','reminder'].includes(step.action)))journal.changes.splice(firstPatch);
       }
     }
     const revert=changed(journal);
     return {
       ok:completed>0,
       complete:!failure,
       completed,
       total:(steps||[]).length,
       receipts,
       message:failure?(completed?'Completed '+completed+' step'+(completed===1?'':'s')+'. ':'')+failure:messages.join(' '),
       ...(undos.length||revert?{undo:async()=>{
       for(const undo of [...undos].reverse()){const r=await undo();if(r===false||r?.ok===false)return r;}
       const restored=revert?await revert():true;
       return restored===false||restored?.ok===false?
         restored:
         receipts.some(v=>v.action==='plan')?{ok:true,message:'Undone.',plan:planReceipt(store.get().toolbox?.biscuitPlan)}:restored;
     }}:{})};
   };
   for(const key of Object.keys(actions))actions[key]=command(actions[key]);
  async function executeBiscuit(action,fields={},options={}){
   if(dead||executorBusy||typeof action!=='string'||!Object.hasOwn(actions,action)||!record(fields))return {ok:false,message:'That action is unavailable in this workspace.'};
   if(!on('planner')&&['focus','focus-control','focus-status','break','stretch','plan','move','remove','reminder','note','bookmark','module'].includes(action))return unavailable('Planner');
   executorBusy=true;let journal;
   try{
    options.validate?.();
    const before=checkpoint(action);
    journal=before?.then?await before:before;
    options.validate?.();
    if(options.validate)journal.validate=options.validate;
    const previous=sourceExecution,previousValidation=executionValidation;let pending;sourceExecution=options.source||null;executionValidation=options.validate||null;
    try{pending=capture(journal,()=>actions[action](fields));}finally{sourceExecution=previous;executionValidation=previousValidation;}
    const result=await pending;if(result===false||result?.ok===false)return typeof result==='object'&&result?result:{ok:false,message:'That action is unavailable in this workspace.'};
    const undo=result?.undo||changed(journal);
    return {...(record(result)?result:{}),ok:true,message:typeof result?.message==='string'?result.message:typeof result==='string'?result:'Done.',...(undo?{undo}:{})};
   }catch(error){return {ok:false,message:String(error?.message||'The action could not finish.').slice(0,1000)};}
   finally{if(pendingCommand===journal)pendingCommand=null;executorBusy=false;}
  }
  function executorContext(){
   const c=ctx(),
     origin=store.owner?.origin||root.location?.origin,
     accountId=store.owner?.accountId||c.user?.id,
     biscuit=c.biscuitData||c.biscuitContext||{},
     sources=new Map((Array.isArray(c.sources)?c.sources:[]).map(source=>[source.id,source]));
   let hasSources=Array.isArray(c.sources);
   const add=(row,fallback)=>{
    if(!row||row.locked||row.locked_for_user||row.hidden_for_user||row.published===false)return;
    const courseId=String(row.courseId||row.course_id||''),
      rawKind=String(row.kind||row.type||fallback).toLowerCase(),
      kind={frontpage:'home',externalurl:'link',externaltool:'tool'}[rawKind]||rawKind;
    if(!/^\d+$/.test(courseId)||!['page','home','syllabus','file','link','material','module'].includes(kind))return;
    let url=row.html_url||row.url;
    if(kind==='page'&&(!url||!/^https?:|^\//i.test(url)))
      url=origin+'/courses/'+courseId+'/pages/'+encodeURIComponent(row.pageUrl||row.page_url||row.slug||url||row.id);
    else if(kind==='home'&&!url)
      url=origin+'/courses/'+courseId;
    else if(kind==='file'&&!url&&/^\d+$/.test(String(row.fileId||row.contentId||row.content_id||row.id)))
      url=origin+'/courses/'+courseId+'/files/'+(row.fileId||row.contentId||row.content_id||row.id);
    if(!url)return;
    let id=root.CanvasHarnessContext?.sourceId?.({...row,kind,url},courseId,origin);
    if(!id){
      try{
        const path=new URL(url,origin).pathname,match=path.match(/^\/courses\/\d+\/(pages|files)\/([^/]+)\/?$/);
        id=match?(match[1]==='pages'?'page:':'file:')+courseId+':'+decodeURIComponent(match[2]):kind==='home'?'home:'+courseId:String(row.id||'');
      }catch{return;}
    }
    if(id)sources.set(id,{...row,id,kind,courseId,url});
   };
   for(const [field,kind]of [['files','file'],['materials','material'],['pages','page'],['links','link']])if(Array.isArray(biscuit[field])){hasSources=true;for(const row of biscuit[field])add(row,kind);}
   if(root.CanvasHarnessContext?.catalog){
    const rows=value=>Array.isArray(value)?value:[],
      loaded=rows(c.courses).map(course=>
        ({
          courseId:String(course.id),
          modules:rows(biscuit.modules).filter(row=>String(row.courseId??row.course_id)===String(course.id)&&(!row.type||row.type==='Module')&&!row.locked&&!row.hidden_for_user),
          announcements:rows(biscuit.announcements).filter(row=>String(row.courseId??row.course_id)===String(course.id)&&!row.locked&&!row.hidden_for_user)
        }));
    hasSources=true;
    for(const source of root.CanvasHarnessContext.catalog(c,{origin,resources:[...rows(c.aiResources),...loaded],updates:[...rows(c.aiUpdates),...loaded]}).sources||
      [])
      if(!sources.has(source.id))sources.set(source.id,source);
   }
   return {
     ...c,
     owner:store.owner,
     origin,
     accountId,
     courseId:c.courseId||biscuit.courseId||'all',
     featureCatalogue:root.ReserveFeatures?.catalogue||[],
     ...(hasSources?{sources:[...sources.values()]}:{})
   };
  }
  function ensureExecutor(){
   if(unregisterExecutor||dead||!root.CanvasHarnessStudyTools?.registerExecutor||!root.ReserveBiscuitRegistry?.register)return;
   unregisterExecutor=root.CanvasHarnessStudyTools.registerExecutor({
     isCurrent:()=>!dead&&container.isConnected!==false,
     getContext:executorContext,
     executeBiscuit
   });
  }
  function ensurePets(){
   const P=Pets();if(!enabled('pony')||!P||!root.ReservePetArt||pets||dead)return;
   pets=P.create({container,getPet:()=>store.get().pet,getCustomPet,getData:()=>store.get(),store,savePet:(pet,patch,mutate)=>{
     const write=()=>save(data=>{data.pet=mutate?mutate(P.clean(data.pet)):{...data.pet,...(patch||pet)};});
     return pendingCommand&&['pet','routine','quiet'].includes(pendingCommand.intent)?command(write)():write();
   },info:petInfo,
    claimNudge:async(top,snapshot,state)=>{
      let claimed=null;
      const ok=await save(data=>{
        const B=root.ReservePonyBrain,p=P.clean(data.pet),snap={...snapshot,skills:p.skills,now:Date.now(),focus:{...snapshot.focus,running:!!data.focus?.endsAt}};
        if(!B||p.nudges!=='helpful'||!B.canNudge(top,snap,p.brain,state))return;
        claimed=B.markNudge(p.brain,top,snap);
        data.pet={...p,brain:claimed};
      });
      return ok?claimed:null;
    },
    claimEngineOffer:async(offer,snapshot,state)=>{
      let claimed=null;
      const ok=await save(data=>{
        const E=root.ReserveBiscuitEngine,B=root.ReservePonyBrain,p=P.clean(data.pet);
        if(dead||!E?.offer||!B?.cleanLearning)return;
        const brain=B.cleanLearning(p.brain),
          snap={
            ...snapshot,
            now:Date.now(),
            local:data.tasks,
            settings:{...ctx().s,showGrades:ctx().s.showGrades===true},
            pet:p,
            skills:p.skills,
            reminders:p.reminders,
            routines:p.routines,
            focus:{...data.focus,running:!!data.focus?.endsAt}
          },
          current=E.offer(snap,state,{...data.toolbox?.biscuitOffers,brain});
        if(!current||current.id!==offer.id||brain.nudges.items.includes('biscuit:'+offer.id))return;
        const day=helpers().dayKey(snap.now,snap.timeZone);
        if(brain.nudges.day!==day){brain.nudges.day=day;brain.nudges.count=0;}
        brain.nudges.count++;
        brain.nudges.items.push('biscuit:'+offer.id);
        data.toolbox||={};
        data.toolbox.biscuitOffers={lastOffer:snap.now};
        data.pet={...p,brain};
        claimed=data.pet;
      });
      return ok===false?null:claimed;
    },
    claimOffer:async(offer,snapshot,state)=>{
      const A=root.ReservePonyAsk;
      if(!A||dead)return null;
      return A.claimOffer(store,offer,{...snapshot,now:Date.now()},state);
    },actions:{checkpoint,changed,...actions}});
  }
  function openItem(request={}){
   if(request.itemId){
     const items=(ctx().items||[]).filter(v=>String(v.id)===String(request.itemId)&&(!request.courseId||String(v.courseId)===String(request.courseId)));
     if(items.length!==1)return localEntry({...request,entryId:request.itemId});
     if(!request.note&&livePlan().find(v=>v.id===String(items[0].id))?.done||typeof preview!=='function')return false;
     return opened(preview(items[0].id));
   }
   if(request.courseId&&navigate)return navigateCommand(request);
   const course=on('course-hub')&&(ctx().courses||[]).find(x=>String(x.id)===String(request.courseId));if(!course)return false;
   const button=[...container.querySelectorAll('[data-rd-action="course"]')].find(x=>String(x.dataset.id)===String(course.id));
   if(!selectCourse&&!button)return false;
   go('hub');
   if(selectCourse)selectCourse(String(course.id));else button.click();
   return true;
  }
  function dueWork(request={}){
   const c=ctx(),from=request.date||helpers().dayKey(Date.now(),c.s.timeZone),to=request.endDate||from;if(!validDay(from)||!validDay(to)||to<from)return false;
   const items=openWork(request).filter(e=>e.dueDay>=from&&e.dueDay<=to),
     label=items.length?`Due ${from}${to!==from?` to ${to}`:''}: ${items.slice(0,4).map(e=>`${e.title}${e.course?` (${e.course})`:''}`).join('; ')}${items.length>4?`; +${items.length-4} more`:''}.`:`Nothing due ${from}${to!==from?` to ${to}`:''}.`;
   pets?.say?.(label);planner?.goto(from);go('plan');return label;
  }
  function reminderStamp(value){
    if(typeof value==='number')return Number.isFinite(value)&&value>0&&value<=8640000000000000?value:null;
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)||!validDay(value.slice(0,10)))return null;
    const at=Date.parse(value);
    return Number.isFinite(at)&&at>0&&at<=8640000000000000?at:null;
  }
  function reminderOperation(request){
   const {operation}=request;
   if(!['create','edit','reschedule','delete','cancel','undo-cancel'].includes(operation))return clarify('Choose create, edit, reschedule, delete, cancel, or Undo for a reminder.');
   if(operation==='undo-cancel')return undoMutation('reminder',request,['cancel','delete']);
   const creating=operation==='create',targetId=creating?newId():mutationId(request.targetId);
   if(!targetId)return clarify('Which reminder should I change?');
   const title=request.title,hasTitle=title!==undefined,hasAt=request.at!==undefined,at=hasAt?reminderStamp(request.at):null;
   if(creating&&!hasTitle||hasTitle&&(typeof title!=='string'||!title.trim()||title.length>200||/[\u0000-\u001f\u007f]/.test(title)))return clarify('Choose a reminder title of 1 to 200 characters.');
   if((creating||operation==='reschedule')&&!hasAt||hasAt&&(at===null||at<=Date.now()))return clarify('What future date and time should the reminder use?');
   if(operation==='edit'&&!hasTitle&&!hasAt)return clarify('What reminder title or time should change?');
   if(request.courseId!==undefined&&!ctx().courses.some(row=>String(row.id)===String(request.courseId)))return clarify('Choose an existing course for this reminder.');
   return localMutation('reminder',operation,data=>{
     const rows=(data.pet?.reminders||[]).filter(row=>String(row.id)===targetId),tasks=(data.customTasks||[]).filter(row=>String(row.id)===targetId);
     if(!creating&&rows.length!==1||tasks.length>1)return clarify('Choose one existing reminder ID.');
     if(creating&&(rows.length||tasks.length))return clarify('That reminder ID is already in use. Try again.');
     if(hasAt&&at<=Date.now())return clarify('That reminder time has passed. Choose a future time.');
    if(creating){
      if((data.pet?.reminders||[]).length>=20||(data.customTasks||[]).length>=1000)return clarify('Reminders is full. Remove a reminder first.');
      const now=Date.now(),day=helpers().dayKey(at,ctx().s.timeZone);
      data.customTasks||=[];
      data.tasks||={};
      Plan().addTask({name:title,day},{courseId:request.courseId===undefined?'personal':String(request.courseId),id:targetId,nowISO:new Date(now).toISOString()})(data);
      data.customTasks.find(row=>row.id===targetId).dueAt=new Date(at).toISOString();
      data.pet={...data.pet,reminders:[...(data.pet?.reminders||[]),{id:targetId,text:title,at,createdAt:now}]};
      return {ok:true,targetId,after:copy(data.pet.reminders.find(v=>String(v.id)===targetId)),message:'Created the local reminder.'};
    }
    const row=rows[0],task=tasks[0],original={reminder:copy(row),task:copy(task),local:copy(data.tasks?.[targetId])};
    if(task&&Date.parse(task.createdAt)!==row.createdAt)return clarify('The linked personal task has changed. Open this reminder to review it first.');
    if(request.courseId!==undefined&&task&&String(task.courseId)!==String(request.courseId))return clarify('That reminder belongs to another course. Choose its current course.');
    if(['delete','cancel'].includes(operation)){
      if(operation==='delete'&&data.toolbox?.biscuitPlan?.blocks?.some(block=>block.itemId===targetId))return clarify('Remove this reminder task from its local study plan before deleting it.');
      data.pet.reminders=data.pet.reminders.filter(item=>item!==row);
      if(operation==='delete'&&task){data.customTasks=data.customTasks.filter(item=>item!==task);delete data.tasks[targetId];}
      return {ok:true,targetId,original,before:copy(original.reminder),message:operation==='cancel'?'Cancelled reminder delivery. Its personal task is kept.':'Deleted the selected local reminder.'};
    }
    if(hasTitle){row.text=title;if(task)task.name=title;}
    if(hasAt){
      row.at=at;
      delete row.delivered;
      if(task){
        task.dueAt=new Date(at).toISOString();
        const local=localTask(data,targetId);
        local.plannedDate=helpers().dayKey(at,ctx().s.timeZone);
        if(Object.hasOwn(local,'plannedTime')){
          const p=root.CanvasHarnessAgentClock?.calendar?.(ctx().s.timeZone)(at);
          if(!p)return clarify('The account clock is unavailable. Reload Canvas.');
          local.plannedTime=String(Math.floor(p.minute/60)).padStart(2,'0')+':'+String(p.minute%60).padStart(2,'0');
        }
      }
    }
    return {ok:true,targetId,original,before:copy(original.reminder),after:copy(row),message:operation==='reschedule'?'Rescheduled the selected reminder.':'Saved the selected reminder.'};
   });
  }
  function reminderStamp(value){
    if(typeof value==='number')return Number.isFinite(value)&&value>0&&value<=8640000000000000?value:null;
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)||!validDay(value.slice(0,10)))return null;
    const at=Date.parse(value);
    return Number.isFinite(at)&&at>0&&at<=8640000000000000?at:null;
  }
  function reminderOperation(request){
   const {operation}=request;
   if(!['create','edit','reschedule','delete','cancel','undo-cancel'].includes(operation))return clarify('Choose create, edit, reschedule, delete, cancel, or Undo for a reminder.');
   if(operation==='undo-cancel')return undoMutation('reminder',request,['cancel','delete']);
   const creating=operation==='create',targetId=creating?newId():mutationId(request.targetId);
   if(!targetId)return clarify('Which reminder should I change?');
   const title=request.title,hasTitle=title!==undefined,hasAt=request.at!==undefined,at=hasAt?reminderStamp(request.at):null;
   if(creating&&!hasTitle||hasTitle&&(typeof title!=='string'||!title.trim()||title.length>200||/[\u0000-\u001f\u007f]/.test(title)))return clarify('Choose a reminder title of 1 to 200 characters.');
   if((creating||operation==='reschedule')&&!hasAt||hasAt&&(at===null||at<=Date.now()))return clarify('What future date and time should the reminder use?');
   if(operation==='edit'&&!hasTitle&&!hasAt)return clarify('What reminder title or time should change?');
   if(request.courseId!==undefined&&!ctx().courses.some(row=>String(row.id)===String(request.courseId)))return clarify('Choose an existing course for this reminder.');
   return localMutation('reminder',operation,data=>{
     const rows=(data.pet?.reminders||[]).filter(row=>String(row.id)===targetId),tasks=(data.customTasks||[]).filter(row=>String(row.id)===targetId);
     if(!creating&&rows.length!==1||tasks.length>1)return clarify('Choose one existing reminder ID.');
     if(creating&&(rows.length||tasks.length))return clarify('That reminder ID is already in use. Try again.');
     if(hasAt&&at<=Date.now())return clarify('That reminder time has passed. Choose a future time.');
    if(creating){
      if((data.pet?.reminders||[]).length>=20||(data.customTasks||[]).length>=1000)return clarify('Reminders is full. Remove a reminder first.');
      const now=Date.now(),day=helpers().dayKey(at,ctx().s.timeZone);
      data.customTasks||=[];
      data.tasks||={};
      Plan().addTask({name:title,day},{courseId:request.courseId===undefined?'personal':String(request.courseId),id:targetId,nowISO:new Date(now).toISOString()})(data);
      data.customTasks.find(row=>row.id===targetId).dueAt=new Date(at).toISOString();
      data.pet={...data.pet,reminders:[...(data.pet?.reminders||[]),{id:targetId,text:title,at,createdAt:now}]};
      return {ok:true,targetId,after:copy(data.pet.reminders.find(v=>String(v.id)===targetId)),message:'Created the local reminder.'};
    }
    const row=rows[0],task=tasks[0],original={reminder:copy(row),task:copy(task),local:copy(data.tasks?.[targetId])};
    if(task&&Date.parse(task.createdAt)!==row.createdAt)return clarify('The linked personal task has changed. Open this reminder to review it first.');
    if(request.courseId!==undefined&&task&&String(task.courseId)!==String(request.courseId))return clarify('That reminder belongs to another course. Choose its current course.');
    if(['delete','cancel'].includes(operation)){
      if(operation==='delete'&&data.toolbox?.biscuitPlan?.blocks?.some(block=>block.itemId===targetId))return clarify('Remove this reminder task from its local study plan before deleting it.');
      data.pet.reminders=data.pet.reminders.filter(item=>item!==row);
      if(operation==='delete'&&task){data.customTasks=data.customTasks.filter(item=>item!==task);delete data.tasks[targetId];}
      return {ok:true,targetId,original,before:copy(original.reminder),message:operation==='cancel'?'Cancelled reminder delivery. Its personal task is kept.':'Deleted the selected local reminder.'};
    }
    if(hasTitle){row.text=title;if(task)task.name=title;}
    if(hasAt){
      row.at=at;
      delete row.delivered;
      if(task){
        task.dueAt=new Date(at).toISOString();
        const local=localTask(data,targetId);
        local.plannedDate=helpers().dayKey(at,ctx().s.timeZone);
        if(Object.hasOwn(local,'plannedTime')){
          const p=root.CanvasHarnessAgentClock?.calendar?.(ctx().s.timeZone)(at);
          if(!p)return clarify('The account clock is unavailable. Reload Canvas.');
          local.plannedTime=String(Math.floor(p.minute/60)).padStart(2,'0')+':'+String(p.minute%60).padStart(2,'0');
        }
      }
    }
    return {ok:true,targetId,original,before:copy(original.reminder),after:copy(row),message:operation==='reschedule'?'Rescheduled the selected reminder.':'Saved the selected reminder.'};
   });
  }
  function addReminder(request={}){
   if(request.operation!==undefined)return on('planner')?reminderOperation(request):unavailable('Reminders');
   const title=String(request.title||request.text||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,200),c=ctx(),now=Date.now();let at=request.at;
   if(at===undefined){
     const m=String(request.time||'').match(/^(\d{1,2}):(\d{2})$/);
     if(!validDay(request.date)||!m||Number(m[1])>23||Number(m[2])>59)return false;
     at=root.ReservePonyAsk?.wall(request.date,Number(m[1])*60+Number(m[2]),c.s.timeZone,now);
   }
   else if(typeof at==='string')at=reminderStamp(at);
   if(!title||!Number.isFinite(at)||at<=now||at>8640000000000000||request.courseId&&!c.courses.some(x=>String(x.id)===String(request.courseId)))return false;
   const id=newId(),day=helpers().dayKey(at,c.s.timeZone),dueAt=new Date(at).toISOString(),createdAt=new Date(now).toISOString();let added=false;
   return save(data=>{
     if((data.pet?.reminders||[]).length>=20||at<=Date.now())return;
     data.customTasks=data.customTasks||[];
     data.tasks=data.tasks||{};
     Plan().addTask({name:title,day},{courseId:request.courseId?String(request.courseId):'personal',id,nowISO:createdAt})(data);
     data.customTasks.find(x=>x.id===id).dueAt=dueAt;
     data.pet={...data.pet,reminders:[...(data.pet?.reminders||[]),{id,text:title,at,createdAt:now}]};
     added=true;
   }).then(ok=>ok&&added);
  }
  function openStudy(kind,item){
   // Recheck skills when an already displayed offer is used.
   if(!skillEnabled(kind))return false;
   if(kind==='notes'){
     const snapshot=petInfo(),
       row=snapshot.assignments.find(e=>e.id===String(item?.itemId)),
       dueAt=typeof row?.dueAt==='number'?row.dueAt:Date.parse(row?.dueAt),
       facts=root.CanvasHarnessStudyKind?.classify(row,snapshot);
     if(!enabled('ai')||
       !studyAI||
       store.get().pet?.skills?.quiz===false||
       !row||
       row.done||
       !facts?.notes||
       (!['quiz','test'].includes(facts.kind)&&facts.aid!=='practice')||
       !Number.isFinite(dueAt)||
       dueAt<snapshot.now||
       dueAt-snapshot.now>3*86400000)
       return false;
     return studyAI(kind,row.id);
   }
   if(kind==='fixes'){
     const B=root.ReservePonyBrain,snapshot=petInfo();
     if(!enabled('ai')||!studyAI||!B||!B.evaluate(snapshot,store.get().pet?.brain).suggestions.some(s=>s.kind==='fixes'&&s.data.itemId===String(item.itemId)))return false;
     return studyAI(kind,item.itemId);
   }
   if(!enabled('ai')||kind==='rubric'&&store.get().pet?.skills?.rubric===false||!plan(ctx(),helpers()).list.some(e=>e.id===String(item.itemId)&&!e.done))return false;
   if(kind==='rubric')return studyAI?studyAI(kind,item.itemId):false;
   const handoff=enabled('pdf')&&practice?getPractice():null;
   return handoff&&String(handoff.itemId)===String(item.itemId)?practice(handoff,kind):studyAI?studyAI(kind,item.itemId):false;
  }
  function skillEnabled(kind){return root.ReservePonyBrain?.skillEnabled?.(kind,store.get().pet?.skills)!==false;}
  function openReady(item){const aid=ctx().studyAids?.[item.aidKey];return enabled('ai')&&!!openAid&&!!aid&&skillEnabled(aid.kind)?openAid(item.aidKey):false;}
  function openAI(request){
    const handoff=request.handoff;
    return enabled('ai')&&askAI&&[handoff?.kind,...(handoff?.kinds||[])].filter(Boolean).every(skillEnabled)?askAI(request.question,handoff):false;
  }
  async function scheduleReview(request){
   if(!skillEnabled('review'))return false;
   const validate=executionValidation;
   if(!enabled('ai')||!studyStore?.scheduleReview||!studyStore?.list||!studyScope)return clarify('Reload Canvas Harness to schedule saved practice reviews.');
   const aidKey=mutationId(request.aidKey),at=reminderStamp(request.at);if(!aidKey||at===null||at<=Date.now())return clarify('Choose an existing practice set and a future review time.');
   const before=(await studyStore.list(studyScope))[aidKey],c=ctx();
   if(!before||
     before.kind!=='practice'||
     !c.courses.some(row=>String(row.id)===String(before.courseId))||
     request.courseId!==undefined&&String(request.courseId)!==String(before.courseId)||
     !Object.values(before.progress?.practice?.answers||{}).some(answer=>answer?.correct===false))
     return clarify('Choose a saved practice set with missed questions in this course.');
   if(!skillEnabled('review'))return false;
   const expected=copy(before.review),review={due:at,step:0};
   validate?.();
   await studyStore.scheduleReview(studyScope,aidKey,review,{expectedReview:expected,validate});
   return {ok:true,message:'Scheduled the practice review.',undo:async()=>{await studyStore.scheduleReview(studyScope,aidKey,expected,{expectedReview:review});return {ok:true,message:'Undone.'};}};
  }
  function openReview(item={}){
    if(item.operation==='schedule')return scheduleReview(item);
    if(!enabled('ai')||!openAid||store.get().pet?.skills?.quiz===false)return false;
    const aid=ctx().studyAids?.[item.aidKey];
    if(!aid||aid.kind!=='practice'||!aid.review||aid.review.due>Date.now()||aid.review.step>=3)return false;
    return openAid(item.aidKey,{missed:true});
  }
  const freshFocus=(focus,minutes,now)=>{
    if(root.ReserveCore?.resetFocus)return root.ReserveCore.resetFocus(focus,minutes,now);
    const next={...focus,minutes,remaining:minutes*60,elapsed:0,pausedAt:0,stoppedAt:0,endsAt:now+minutes*60000,completedAt:0,completedMinutes:0,breakUntil:0};
    for(const key of ['phase','focusMinutes','breakMinutes','cycles','cycle'])delete next[key];
    return next;
  };
  function afterFocus(ok){if(ok){startTick();sync();tick();}return ok;}
  function settleTimer(){
   if(focusSettlement)return focusSettlement;
   const f=store.get().focus,C=root.ReserveCore;
   if(!f?.endsAt||Date.now()<f.endsAt||!C?.settleFocus)return Promise.resolve(true);
   const write=commandSave();
   let completed=false,ended=0;
   focusSettlement=Promise.resolve().then(()=>write(data=>{ended=data.focus?.endsAt||0;completed=C.settleFocus(data,Date.now());})).then(ok=>{
     if(ok&&completed&&Date.now()-ended<60000)finished('focus');
     if(ok&&!dead){sync();tick();}
     return ok;
   }).finally(()=>{
     focusSettlement=null;
   });
   return focusSettlement;
  }
  function focusStatus(){
    return settleTimer().then(ok=>{
      if(!ok)return false;
      const f=focusState(store.get().focus,Date.now());
      return f.active?`${f.phase==='break'?'Break':'Focus'} timer${f.paused?' paused':''}: ${mmss(f.left)} remaining.`:'No active timer.';
    });
  }
  function startFocus(){
    if(focusState(store.get().focus,Date.now()).paused)return focusControl({action:'resume'});
    let started=false;
    return save(data=>{
      const f=focusState(data.focus,Date.now());
      if(f.running)return;
      data.focus={...freshFocus(data.focus,data.focus?.focusMinutes||f.minutes,Date.now()),fromPony:false};
      started=true;
    }).then(ok=>afterFocus(ok&&started));
  }
  function startPonyFocus(item={}){
   if(item.mode==='break')return startBreak(item);
   const minutes=duration(item.minutes,25),
     cycles=item.cycles===undefined?1:item.cycles,
     breakMinutes=item.breakMinutes===undefined?0:item.breakMinutes,
     blocked=f=>f?.endsAt&&!(f.phase==='break'&&!f.cycles),
     span=(minutes+breakMinutes)*cycles*60000;
   if(item.mode!==undefined&&!['focus','work'].includes(item.mode)||
     !minutes||
     !Number.isInteger(cycles)||
     cycles<1||
     cycles>1000||
     !Number.isFinite(breakMinutes)||
     breakMinutes<0||
     !Number.isFinite(span)||
     Date.now()+span>8640000000000000||
     blocked(store.get().focus))
     return false;
   let started=false;
   return save(data=>{
     const now=Date.now(),
       course=item.courseId&&ctx().courses.find(x=>String(x.id)===String(item.courseId)),
       work=item.itemId||item.courseId?openWork(item,data)[0]:null;
     if(blocked(data.focus)||now+span>8640000000000000||item.courseId&&!course||!work&&!(course&&!item.itemId||item.explicit&&!item.itemId&&!item.courseId))return;
     started=true;
     data.focus={
       ...freshFocus(data.focus,minutes,now),
       ...(cycles>1||breakMinutes>0?{phase:'focus',focusMinutes:minutes,breakMinutes,cycles,cycle:1}:{}),
       itemId:work?.id||null,
       courseId:work?.courseId||(course?String(course.id):null),
       fromPony:true
     };
   }).then(ok=>afterFocus(ok&&started));
  }
  async function focusOperation(request){
   const {action}=request;
   if(request.mode!==undefined&&!['break','focus','work'].includes(request.mode))return clarify('Choose the focus timer or break timer.');
   if(request.autostart!==undefined&&request.autostart!==false)return clarify('Use pause or resume to start or pause an existing timer.');
   if(action==='set-remaining'&&!duration(request.minutes)||action==='reset'&&request.minutes!==undefined&&!duration(request.minutes))return clarify('How many positive minutes should the timer use?');
   let changed=false,failure='';
   try{
     const saved=await save(data=>{
       const now=Date.now(),focus=data.focus||{},f=focusState(focus,now),phase=request.mode==='break'?'break':request.mode?'focus':f.phase;
       if(action==='set-remaining'&&f.active&&phase!==f.phase){failure='The active timer is '+(f.phase==='break'?'a break':'focus work')+'. Pause or stop it before changing phases.';return;}
       const minutes=action==='reset'?request.minutes??(phase==='break'?focus.breakMinutes||f.minutes:focus.focusMinutes||f.minutes):request.minutes,
         total=action==='reset'?minutes*60:(f.active?f.elapsed:0)+minutes*60;
       if(!Number.isFinite(total)||!Number.isFinite(now+total*1000)||now+total*1000>8640000000000000){failure='Choose a finite duration that the local timer can store.';return;}
    let next;
    if(action==='reset'){next={...freshFocus(focus,minutes,now),endsAt:null,pausedAt:0,stoppedAt:now,completedAt:0,completedMinutes:0,breakUntil:0};if(phase==='break')next.phase='break';}
    else{
      const running=f.running&&request.autostart!==false,base=f.active?focus:freshFocus(focus,minutes,now);
      next={
        ...base,
        minutes:total/60,
        remaining:minutes*60,
        elapsed:f.active?f.elapsed:0,
        endsAt:running?now+minutes*60000:null,
        pausedAt:running?0:now,
        stoppedAt:0,
        completedAt:0,
        completedMinutes:0,
        breakUntil:phase==='break'&&running?now+minutes*60000:0
      };
      if(phase==='break')next.phase='break';else if(focus.phase)next.phase='focus';
    }
    data.focus=next;
    changed=true;
     });
    if(saved===false)return clarify('The timer could not save. Try again.');
   }catch{return clarify('The timer could not save. Your saved timer is kept.');}
    if(!changed)return clarify(failure||'Choose an existing timer to change.');
    afterFocus(true);
    return {ok:true,message:action==='reset'?'Reset the timer. It is stopped and the work remains incomplete.':'Set the timer remaining time.'};
  }
  function focusControl(request={}){
   if(['set-remaining','reset'].includes(request.action))return focusOperation(request);
   if(!['pause','resume','stop','adjust','finish'].includes(request.action)||request.action==='adjust'&&!Number.isFinite(request.minutes))return false;
   let changed=false,completed=false,ended=0,early=false;
   return save(data=>{
     const now=Date.now();
     ended=data.focus?.endsAt||0;
     completed=root.ReserveCore?.settleFocus?.(data,now)===true;
     const f=focusState(data.focus,now);
     if(!f.active||f.left<=0||request.action==='pause'&&!f.running||request.action==='resume'&&!f.paused)return;
    const next={...data.focus,remaining:f.left,elapsed:f.elapsed};
    if(request.action==='pause'){next.endsAt=null;next.pausedAt=now;}
    if(request.action==='resume'){next.endsAt=now+f.left*1000;next.pausedAt=0;}
    if(request.action==='stop')Object.assign(next,{endsAt:null,pausedAt:0,stoppedAt:now,completedAt:0,completedMinutes:0,breakUntil:0});
    if(request.action==='finish'){
      if(f.phase==='break')
        Object.assign(next,{endsAt:null,pausedAt:0,stoppedAt:now,completedAt:0,completedMinutes:0,breakUntil:0});
      else{
        Object.assign(next,{
          endsAt:null,
          pausedAt:0,
          remaining:0,
          elapsed:f.elapsed,
          completedAt:now,
          completedMinutes:f.elapsed/60,
          sessions:(Number.isInteger(data.focus.sessions)?data.focus.sessions:0)+1,
          breakUntil:0
        });
        for(const key of ['phase','focusMinutes','breakMinutes','cycles','cycle'])delete next[key];
        early=true;
      }
    }
    if(request.action==='adjust'){
      const left=Math.max(60,f.left+request.minutes*60);
      if(!Number.isFinite(left)||now+left*1000>8640000000000000)return;
      Object.assign(next,{remaining:left,minutes:(f.elapsed+left)/60,endsAt:f.running?now+left*1000:null});
    }
    if(next.phase==='break')next.breakUntil=next.endsAt||0;
    data.focus=next;changed=true;
   }).then(ok=>{if(ok&&(completed&&Date.now()-ended<60000||early))finished('focus');afterFocus(ok&&(changed||completed));return ok&&changed;});
  }
  function startBreak(request={}){
    let started=false;
    const minutes=duration(request.minutes,5);
    if(request.mode!==undefined&&request.mode!=='break'||!minutes||Date.now()+minutes*60000>8640000000000000)return false;
    return save(data=>{
      const f=data.focus||{},now=Date.now(),completed=f.completedAt;
      if(focusState(f,now).active||
        f.breakUntil>now||
        request.stretch&&data.pet?.skills?.wellbeing===false||
        !request.explicit&&(request.sessionId!==completed||!Number.isFinite(completed)||completed<=0||completed>now||now-completed>3600000||(f.completedMinutes??f.minutes)<25))
        return;
      started=true;
      data.focus={...freshFocus(f,minutes,now),phase:'break',breakUntil:now+minutes*60000,fromPony:true};
    }).then(ok=>afterFocus(ok&&started));
  }
  function planRange(request,data){
   const start=request.date,
     end=request.endDate||start,
     count=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1,
     days=Array.from({length:count},(_,i)=>Plan().addDays(start,i)),
     entries=livePlan(data),
     loads=new Map(days.map(day=>[day,entries.filter(e=>!e.done&&e.planned===day).reduce((n,e)=>n+(e.estimate||25),0)])),
     chosen=request.items?new Set(request.items.map(e=>String(e.id))):null,
     items=[];
   for(const e of entries.filter(e=>
     !e.done&&
       !e.planned&&
       (!request.courseId||e.courseId===String(request.courseId))&&
       (!request.itemId||e.id===String(request.itemId))&&
       (!chosen||chosen.has(e.id))&&
       (!e.dueDay||e.dueDay>=start)).sort((a,b)=>
     (Date.parse(a.dueAt)||Infinity)-(Date.parse(b.dueAt)||Infinity))){
     const eligible=days.filter(day=>!e.dueDay||day<=e.dueDay).sort((a,b)=>loads.get(a)-loads.get(b)||a.localeCompare(b));
     if(!eligible.length)continue;
     const day=eligible[0],estimate=request.minutes??(e.estimate||25);
     items.push({id:e.id,day,estimate});
     loads.set(day,loads.get(day)+estimate);
   }
   return {day:start,items};
  }
  function planTonight(request={}){
   const c=ctx(),
     h=helpers(),
     {list,today}=plan(c,h),
     A=root.ReservePonyAsk,
     range=request.date!==undefined||request.endDate!==undefined,
     scoped=!!(request.courseId||request.itemId),
     mode=request.mode||(!request.day&&(scoped||request.minutes!==undefined)?'tonight':'');
   if(request.minutes!==undefined&&(!duration(request.minutes)||request.minutes>1440)||
     request.courseId&&!c.courses.some(x=>String(x.id)===String(request.courseId))||
     range&&
       (!validDay(request.date)||
         !validDay(request.endDate||request.date)||
         (request.endDate||request.date)<request.date||
         Date.parse(request.endDate||request.date)-Date.parse(request.date)>365*86400000)||
     !range&&(!mode&&request.day!==today||mode&&!['tonight','tomorrow','week'].includes(mode)))
     return false;
   if(request.at!==undefined&&(typeof request.at!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(request.at)))return false;
   const title=typeof request.title==='string'?request.title.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,200):'';
   if(!scoped&&title){
    const day=request.date||(mode==='tomorrow'?Plan().addDays(today,1):today),id=newId();let added=false;
    return save(data=>{
      if((data.customTasks||[]).length>=1000)return;
      data.customTasks??=[];
      data.tasks??={};
      Plan().addTask({name:title,day,estimate:request.minutes??25,...(request.at?{at:request.at}:{})},{id,nowISO:new Date().toISOString()})(data);
      added=true;
    }).then(ok=>{
      if(ok&&added){planner?.goto(day);go('plan');}
      return ok&&added;
    });
   }
   const matches=e=>(!request.courseId||e.courseId===String(request.courseId))&&(!request.itemId||e.id===String(request.itemId)),
     available=new Map(list.filter(e=>!e.done&&!e.planned&&matches(e)).map(e=>[e.id,e])),
     items=(request.items||[]).filter(e=>available.has(String(e.id)));
   if(!range&&!mode&&!items.length||scoped&&!available.size)return false;
   let planned=false,day=request.date||request.day;
   return save(data=>{
     const entries=livePlan(data),
       start=mode==='tomorrow'?Plan().addDays(today,1):today,
       fresh=range?
         planRange(request,data):
         mode&&scoped?
           planRange({...request,date:start,endDate:mode==='week'?Plan().addDays(start,6):start},data):
           mode&&A?
             A.buildPlan(mode,{
               now:Date.now(),
               timeZone:c.s.timeZone,
               assignments:entries.filter(matches).map(e=>request.minutes===undefined?e:{...e,estimate:request.minutes})
             }):
             {day:today,items};
     day=fresh.day;
     for(const item of fresh.items){
       const id=String(item.id);
       if(data.tasks[id]?.checkedOff||data.tasks[id]?.plannedDate||!entries.some(e=>e.id===id&&!e.done&&!e.planned&&matches(e)))continue;
       Plan().plan(id,item.day||day)(data);
       if(request.at)data.tasks[id].plannedTime=request.at;
       if(request.minutes!==undefined)
         data.tasks[id].estimate=request.minutes;
       else if(!data.tasks[id].estimate&&Number.isFinite(item.estimate))Plan().estimate(id,item.estimate)(data);
       planned=true;
     }
   }).then(ok=>{
     if(ok){planner?.goto(day);go('plan');}
     return ok&&(planned||!scoped&&(!!mode||range));
   });
  }
  function focusControls(){
   const f=focusState(store.get().focus,Date.now()),doc=container.ownerDocument;
   for(let node of container.querySelectorAll('[data-rd-focus-clock]')){
    if(node.tagName!=='BUTTON'&&doc?.createElement&&node.replaceWith){
      const button=doc.createElement('button');
      button.className='rd-focus-clock rd-text-button';
      button.type='button';
      button.dataset.rdFocusClock='';
      button.textContent=node.textContent;
      button.hidden=node.hidden;
      node.replaceWith(button);
      node=button;
    }
    const label=f.phase==='break'?'break':'focus';node.disabled=!f.active;node.setAttribute?.('aria-label',f.running?`Pause ${label} timer`:f.paused?`Resume ${label} timer`:'Focus timer');
    if(f.active){node.textContent=mmss(f.left);node.hidden=false;}else if(node.textContent!=='Done')node.hidden=true;
    node.parentElement?.setAttribute?.('aria-label',f.running?`Planner, ${label} session running`:f.paused?`Planner, ${label} session paused`:'Planner');
    let controls=node.parentElement?.querySelector?.('[data-rd-focus-controls]');
    if(!controls&&doc?.createElement&&node.after){
      controls=doc.createElement('small');
      controls.className='biscuit-focus-controls';
      controls.dataset.rdFocusControls='';
      for(const [action,text,minutes] of [['pause','Pause'],['stop','Stop'],['adjust','-5',-5],['adjust','+5',5]]){
        const button=doc.createElement('button');
        button.type='button';
        button.className='rd-text-button biscuit-focus-control';
        button.dataset.rdAction='focus-control';
        button.dataset.focusAction=action;
        if(minutes!==undefined)button.dataset.minutes=String(minutes);
        button.textContent=text;
        controls.append(button);
      }
      node.after(controls);
    }
    if(controls){
      controls.hidden=!f.active;
      for(const button of controls.querySelectorAll('[data-rd-action="focus-control"]')){
        if(['pause','resume'].includes(button.dataset.focusAction)){button.dataset.focusAction=f.running?'pause':'resume';button.textContent=f.running?'Pause':'Resume';}
        button.disabled=!f.active;
        button.setAttribute('aria-label',button.dataset.focusAction==='adjust'?`${Number(button.dataset.minutes)<0?'Remove':'Add'} 5 minutes`:`${button.textContent} ${label} timer`);
      }
    }
   }
  }
  function focusClick(event){
   const target=event.composedPath?.()[0]||event.target,clock=target?.closest?.('[data-rd-focus-clock]'),button=target?.closest?.('[data-rd-action]');
   if(clock?.dataset?.rdFocusClock===undefined&&button?.dataset?.rdAction!=='focus-control')return false;
   event.preventDefault?.();event.stopPropagation?.();if(dead||clock?.disabled||button?.disabled)return true;
   const request=clock?.dataset?.rdFocusClock!==undefined?
     {action:focusState(store.get().focus,Date.now()).running?'pause':'resume'}:
     {action:button.dataset.focusAction,minutes:Number(button.dataset.minutes)};
   focusControl(request);
   return true;
  }
  // The dial and the clock move between renders without one.
  function tick(){
   if(dead)return;const now=Date.now(),data=store.get(),f=focusState(data.focus,now);
   if(data.focus?.phase&&f.running&&f.left<=0)void settleTimer().catch(()=>{});
   for(const node of container.querySelectorAll('[data-rd-timer]')){
    const text=node.querySelector('[data-rd-timer-text]'),arc=node.querySelector('.rd-timer-arc'),phase=node.querySelector('[data-rd-timer-phase]');if(phase)phase.hidden=f.phase!=='break';
    if(text&&text.textContent!==mmss(f.left))text.textContent=mmss(f.left);if(arc)arc.style.strokeDashoffset=(1-f.progress).toFixed(4);
   }
   focusControls();room?.sync();pets?.setFocus(f.running,data.focus);
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
   // The countdown ticks here too: the dashboard no longer redraws Home every minute (dashboard.js updateFreshness).
   if(container.querySelector('[data-rd-clock],[data-rd-countdown]')){if(!clockTimer)clockTimer=setInterval(clock,15000);}else if(clockTimer){clearInterval(clockTimer);clockTimer=0;}
   room?.sync();agentHome?.sync();ensureExecutor();ensurePets();pets?.sync();pets?.setFocus(running,data.focus);focusControls();
   if(data.focus?.phase&&running&&Date.now()>=data.focus.endsAt)void settleTimer().catch(()=>{});
   // Dashboard syncFocus follows sync in the same render. Restore a paused clock after its running-only update.
   Promise.resolve().then(()=>{if(!dead)focusControls();});
  }
  async function quickAdd(input){
   const text=input?.value||'',c=ctx(),h=helpers(),today=h.dayKey(c.now,c.s.timeZone),parsed=Plan().parseQuick(text,today);
   if(!parsed.name)return;
   if(!parsed.day)parsed.day=input.dataset.day||'';
   const course=Plan().matchCourse(parsed.course,c.courses);
   input.value='';
   const ok=await save(Plan().addTask(parsed,{courseId:course?course.id:'personal',id:newId(),nowISO:new Date().toISOString()}));
   if(ok){
     pets?.celebrate&&store.get().pet&&save(data=>{data.pet=Pets().reward(Pets().clean(data.pet),'plan').pet;});
     container.querySelector(`[data-rd-field="plan-quick"][data-day="${input.dataset.day||''}"]`)?.focus({preventScroll:true});
   }
   else input.value=text;
  }
  function click(event){
   // "Open" beside Play in the features list: the tray of tools, with none in hand yet.
   if(event.target.closest?.('[data-rd-action]')?.dataset?.rdAction==='play-open'){void playCommand({tool:null});return true;}
   if(!enabled('planner'))return false;
   if(room?.click(event))return true;
   if(focusClick(event))return true;
   const candidate=event.target.closest?.('[data-rd-action]'),name=candidate?.dataset.rdAction;
   if(name?.startsWith('pet-')&&(!enabled('pony')||!Pets())||
     ['customize-tab','pet-settings','board-frame'].includes(name)&&!enabled('customization')||
     ['module-menu','module-size','module-dock'].includes(name)&&!enabled('arrange')||
     candidate?.dataset.widget&&!available(candidate.dataset.widget))
     return true;
   if(planner?.click(event))return true;
   const button=event.target.closest?.('[data-rd-action]');if(!button||dead)return false;
   const action=button.dataset.rdAction,key=button.dataset.widget,A=Arrange();
   if(action==='help-toggle'){save(data=>{A.change(data.settings,{type:'help',value:data.settings.showHelp===false});});return true;}
   if(action==='notes-help'){helpWith?.({page:'notes',selectedText:drafts.notes??store.get().toolbox?.scratchpad??''});return true;}
   if(action==='hidden-courses'){settingsTab='courses';return false;}
   if(action==='plan-open'){planner?.goto(button.dataset.day);go('plan');return true;}
    if(action==='customize-tab'){
      settingsTab=button.dataset.value==='art'?'courses':button.dataset.value==='all'?'look':button.dataset.value||'look';
      if(settingsTab==='pet'&&!enabled('pony'))settingsTab='look';
      rerender();
      container.querySelector('.cz-tab[aria-selected="true"]')?.focus({preventScroll:true});
      return true;
    }
   if(action==='board-edit'&&button.dataset.from==='settings'){editing=true;closeSettings();go('work');rerender();container.querySelector('.rd-gallery')?.scrollIntoView({block:'nearest'});return true;}
   if(action==='board-edit'){editing=!editing;rerender();if(!editing)container.querySelector('[data-rd-action="board-edit"]')?.focus({preventScroll:true});return true;}
   if(action==='board-frame'){save(data=>{data.settings.panelFrame=button.dataset.value;});return true;}
   if(action==='module-menu'){if(menu&&menuKey===key)closeMenu(true);else if(A.isKey(key))openMenu(button,key);return true;}
   if(action==='module-pin'&&A.isKey(key)){closeMenu(true);save(data=>{pinModule(data,key,!data.toolbox?.agentPins?.includes(key));});return true;}
   if(action==='module-size'&&A.isKey(key)&&Object.hasOwn(A.SIZES,button.dataset.value)){
    // measured, laid out at its new width in the same press (the glide starts at once), then saved
    const size=button.dataset.value;closeMenu(true);const flip=reflow();flip?.();previewSize(key,size);
    save(data=>{
      const sizes={...(data.settings.moduleSize||{})};
      if(size==='m')delete sizes[key];else sizes[key]=size;
      data.settings.moduleSize=sizes;
      pinModule(data,key);
    });
    return true;
   }
   if(action==='module-dock'&&A.ALL.includes(key)&&['top','bottom','left','right'].includes(button.dataset.value)){
     const edge=button.dataset.value;
     closeMenu(true);
     save(data=>{A.change(data.settings,{type:'dock',key,target:A.ROOT,edge});});
     return true;
   }
   if(action==='widget-remove')closeMenu();
   if(action==='handin-dismiss'||action==='handin-undo'){
    const id=String(button.dataset.id),why=root.ReserveHandIn?.cleanReason(button.dataset.value);
    if(/^\d+$/.test(id)&&ctx().items.some(item=>String(item.id)===id)&&(action==='handin-undo'||why))
      save(data=>{data.tasks[id]={...data.tasks[id],checkedOff:action==='handin-dismiss'};if(action==='handin-dismiss')data.tasks[id].doneReason=why;else delete data.tasks[id].doneReason;});
    return true;
   }
   if(action==='widget-add'&&(A.EXTRA.includes(key)||key==='context')){save(data=>{A.change(data.settings,key==='context'?{type:'restore-context'}:{type:'add',key});});return true;}
   if(action==='widget-remove'&&A.removable(key)){save(data=>{A.change(data.settings,key==='context'?{type:'hide-context'}:{type:'remove',key});});return true;}
   if(action==='timer-toggle'){
    const f=focusState(store.get().focus,Date.now());
    if(f.running)focusControl({action:'pause'});else startFocus();
    return true;
   }
   if(action==='timer-reset'){
     save(data=>{
       const g=focusState(data.focus,Date.now());
       data.focus={...freshFocus(data.focus,data.focus?.focusMinutes||g.minutes,Date.now()),endsAt:null};
     }).then(ok=>afterFocus(ok));
     return true;
   }
   if(action==='focus-back'){
     const n=duration(Number(button.dataset.minutes))||25;
     save(data=>{
       const f=data.focus||{},
         now=Date.now(),
         next=f.phase==='break'&&Number.isInteger(f.cycles)&&Number.isInteger(f.cycle)&&f.cycle<f.cycles&&f.focusMinutes>0&&Number.isFinite(now+f.focusMinutes*60000);
    // a break inside a run of pomodoros moves on to the run's next focus; otherwise a fresh session
    data.focus=next?
      {
        ...f,
        phase:'focus',
        minutes:f.focusMinutes,
        remaining:f.focusMinutes*60,
        elapsed:0,
        pausedAt:0,
        stoppedAt:0,
        completedAt:0,
        completedMinutes:0,
        breakUntil:0,
        endsAt:now+f.focusMinutes*60000,
        cycle:f.cycle+1
      }:
      {...freshFocus(f,n,now),fromPony:false};}).then(ok=>
      afterFocus(ok));
    return true;
   }
   if(action==='focus-break'){startBreak({minutes:Number(button.dataset.minutes)||5,explicit:true});return true;}
   if(action==='timer-minutes'){
     const n=duration(Number(button.dataset.minutes));
     if(n)save(data=>{if(data.focus?.endsAt)return;data.focus={...freshFocus(data.focus,n,Date.now()),endsAt:null};}).then(ok=>afterFocus(ok));
     return true;
   }
   if(action==='plan-quick-add'){quickAdd(button.closest('form')?.querySelector('[data-rd-field="plan-quick"]'));return true;}
   if(action==='plan-carry'){const c=ctx(),h=helpers(),{board,today}=plan(c,h);save(data=>{for(const e of board.overdue)Plan().plan(e.id,today)(data);});return true;}
   if(action==='pet-reset-learning'){
     if(enabled('pony'))save(data=>{const B=root.ReservePonyBrain,p=Pets().clean(data.pet);if(B)data.pet={...p,brain:{...B.cleanLearning(p.brain),kinds:{}}};});
     return true;
   }
   if(action==='pet-routine-remove'){if(enabled('pony'))save(data=>{const p=Pets().clean(data.pet);data.pet={...p,routines:p.routines.filter(r=>r.id!==button.dataset.id)};});return true;}
   if(action==='pet-feed'){pets?.treat();return true;}
   if(action==='pet-roam'){save(data=>{const pet=Pets().clean(data.pet);data.pet={...pet,enabled:true,roam:pet.roam==='home'?'page':'home'};});return true;}
   if(action==='pet-settings'){settingsTab='pet';openSettings('pet');rerender();return true;}
   return false;
  }
  function keydown(event){
   if(!enabled('planner'))return false;
   if(['Enter',' ','Spacebar'].includes(event.key)&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.repeat&&focusClick(event))return true;
   if(room?.keydown(event))return true;
   if(planner?.keydown(event))return true;
   if(event.key==='Escape'&&menu){event.preventDefault();closeMenu(true);return true;}
   // Keys are heard on the document, where a shadow root hides the real target.
   const target=event.composedPath?.()[0]||event.target;
   if(event.key==='Enter'&&target?.dataset?.rdField==='plan-quick'){event.preventDefault();quickAdd(target);return true;}
   return false;
  }
  function input(event){
   if(!enabled('planner'))return false;
   const field=event.target?.dataset?.rdField;
   if(field==='widget-notes'){
    drafts.notes=event.target.value.slice(0,30000);clearTimeout(notesTimer);
    const status=container.querySelector('[data-rd-notes-status]');if(status)status.textContent='Saving…';
    notesTimer=setTimeout(flushNotes,700);return true;
   }
   return field==='plan-quick';
  }
  // Switches and choices in "Make it yours" that this file owns: the pony, and the two on/off settings stored as words.
  function change(event){
   if(!enabled('planner'))return false;
   const target=event.target,field=target?.dataset?.rdField;
   if(field==='pet-skill'){const B=root.ReservePonyBrain,key=target.dataset.key;if(enabled('pony')&&B&&Object.hasOwn(B.SKILLS,key))saveSkill(key,target.checked===true);return true;}
   if(field==='pet'){
    if(!enabled('pony')||!enabled('customization')||!Pets())return true;
    const key=target.dataset.key,value=target.type==='checkbox'?target.checked:target.value;
    if(!Object.hasOwn(Pets().DEFAULTS,key)||['treats','fed','xp','streak','best','streakDay','told','brain','skills','reminders','routines'].includes(key))return true;
    if((key==='coat'||key==='harness')&&!Pets().unlocked(key,value,Pets().clean(store.get().pet).xp))return true;
    save(data=>{if(key==='enabled')data.pet.enabled=value;else data.pet={...Pets().clean(data.pet),[key]:value};});return true;
   }
   if(field==='setting'&&target.dataset.onoff==='true'){
     const key=target.dataset.setting;
     if(enabled('customization')&&(key!=='livingArt'||enabled('course-art')&&enabled('motion'))&&['greeting','livingArt','quickOpen'].includes(key))
       save(data=>{data.settings[key]=target.checked?'on':'off';});
     return true;
   }
   return false;
  }
  function flushNotes(){
   clearTimeout(notesTimer);if(drafts.notes===undefined)return Promise.resolve();
   const value=drafts.notes;
   return save(data=>{data.toolbox={...data.toolbox,scratchpad:value};}).then(ok=>{
     if(ok&&drafts.notes===value)delete drafts.notes;
     const status=container.querySelector('[data-rd-notes-status]');
     if(status)status.textContent=ok?'Saved on this device.':'Not saved yet.';
     return ok;
   });
  }
  // Told by the workspace when a piece of work is ticked off or a focus session ends.
  function finished(kind,id){
   if(!enabled('pony')||!Pets()||dead)return;
   if(kind==='done'&&lastDone===id)return;lastDone=kind==='done'?id:lastDone;
   ensurePets();const c=ctx(),h=helpers(),{board,today}=plan(c,h),d=board.days.find(x=>x.key===today);
   pets?.celebrate?.(kind,{today,left:d?d.open:undefined});const f=store.get().focus;if(kind==='focus'&&f?.phase)pets?.setFocus(!!f.endsAt,f);
  }
  function destroy(){
    dead=true;
    unregisterExecutor?.();
    unregisterExecutor=null;
    room?.destroy();
    playTray?.destroy?.();
    playBox?.remove();
    closeMenu();
    container.ownerDocument.removeEventListener('pointerdown',outside,true);
    win.removeEventListener('resize',closeMenu);
    clearInterval(clockTimer);
    clearInterval(timerTick);
    flushNotes();
    pets?.destroy();
    planner?.destroy();
  }
   ensureExecutor();
   // While the Focus room covers Home: only what the room needs (its timer, its sync); Home catches up when it folds away
   function syncRoom(){if(dead)return;const focus=store.get().focus,running=!!focus?.endsAt;if(running&&!timerTick)timerTick=setInterval(tick,1000);room?.sync();}
   return {
     click,
     keydown,
     input,
     change,
     sync,
     syncRoom,
     finished,
     destroy,
     executeBiscuit,
     askPet:()=>pets?.ask?.()??false,
     biscuitContext:petInfo,
     flush:flushNotes,
     settingsTab:()=>settingsTab,
     planUI:()=>planner?.ui||{},
     editing:()=>editing,
     close(){
     if(editing){editing=false;rerender();}
   }};
 }
 const api={INFO,FRAMES,glyph,render,gallery,create,focusState,howLong,nextDue,plan};
 root.ReserveWidgets=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
