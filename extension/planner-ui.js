/* Canvas Harness Planner (4.2.13): a day's page and a calendar. At the left the chosen day as a plain tick list in time
   order, with "Add a task" right under it, the own tasks that have no date, and one folded line for the work that is
   overdue; at the right the calendar, Month (as many weeks as fit the window) or Week, every task a chip on its day. A
   task's sheet is one card over the page beside what was pressed. Drag a row or a chip to another day (or to No date), or
   move it from the keyboard (Shift + arrow); press it for its sheet. The add line reads what you type ("essay due fri 5pm
   45m") and shows how it read it before you press Enter; a word read wrong is taken back with one click. Outside the
   Planner the same day button and picker plan any assignment, Home's "My plan" is this day page for today, and a task can
   be added from the top bar on any tab. "Your week" (help-plan.js) waits behind one small button. The rules are
   planner-model.js; this file draws the page and answers it. Nothing here writes to Canvas. Creator: Flzsh. */
(function(root){
 'use strict';
 const enabled=id=>!root.ReserveFeatures||root.ReserveFeatures.enabled(id);
 const Plan=()=>root.ReservePlanner,Widgets=()=>root.ReserveWidgets;
 const LENGTHS=[15,30,45,60,90,120];
 const newId=()=>'local-'+(root.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);
 // The drawings are the extension's own: the calendar, hourglass and turning arrows of the drawn top bar
 // (dashboard-view.js TB) and the clock of the drawn Canvas menu bar (canvas-nav.js DRAWINGS.history), on the same
 // 40-unit grid and in the same hand. (The report lists the places that want a drawing of their own.)
 const ART={
  arrow:'<path class="k" d="M6.8 20.8c6-1 12.2-1.2 18.4-.6"/><path d="M22.4 13.2l9.6 7-10 6.4" fill="none" stroke="#A9522F" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  toplan:'<path d="M11.6 8.4l20 2.8-1.4 9.6-20-2.8z" fill="#B9CCDB" class="w"/><path class="k" d="M10.8 7.6c6.7.9 13.4 1.8 20 2.8-.4 3.3-.9 6.5-1.4 9.8"/><path d="M8.6 14.8h22.4v9.2H8.6z" fill="#ECC5A0" class="w"/><path class="k" d="M7.6 14c7.6-.3 15.2-.3 22.8 0 .3 3.2.3 6.4 0 9.6"/><path d="M9.8 22.4h22.6v10.4H9.8z" fill="#FFFDF6"/><path class="k" d="M8.8 21.6c7.6-.3 15.2-.3 22.8 0 .3 3.6.3 7.2 0 10.8-7.6.3-15.2.3-22.8 0-.3-3.6-.3-7.2 0-10.8z"/><circle cx="13.8" cy="27" r="2.2" fill="none" stroke="#A9522F" stroke-width="1.5"/><path class="h" d="M18.6 25.4h9.8M18.6 28.8h6.4"/>',
  planall:'<path d="M8.2 17h25v5.6H8.2z" fill="#DE9A7C"/><path d="M8.2 22.6h25v12H8.2z" fill="#FFFDF6"/><path class="k" d="M7 16c8.8-.3 17.4-.3 26 0 .3 6.3.3 12.6 0 18.8-8.6.3-17.4.3-26 0-.3-6.2-.3-12.5 0-18.8z"/><path class="k" d="M7.1 21.8c8.6-.2 17.2-.2 25.8 0"/><path class="h" d="M11.4 26.6h2.4M16.4 26.6h2.4M21.4 26.6h2.4M26.4 26.6h2.4M11.4 30.8h2.4M16.4 30.8h2.4"/><path d="M20 3.4v8.4M15.8 8.2l4.2 4.2 4.2-4.2" fill="none" stroke="#A9522F" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
  much:'<path d="M8.6 27h21.8v6.8H8.6z" fill="#ECC5A0" class="w"/><path class="k" d="M7.6 26.2c7.4-.3 14.8-.3 22.2 0 .2 2.4.2 4.8 0 7.2-7.4.3-14.8.3-22.2 0-.2-2.4-.2-4.8 0-7.2z"/><path d="M10.4 19.8h20.8v6H10.4z" fill="#FFFDF6"/><path class="k" d="M9.6 19.2c7-.4 14-.2 21 .4.1 2.1 0 4.2-.3 6.2"/><path d="M12.6 12.2l19.4 2.8-.9 6-19.4-2.8z" fill="#B9CCDB" class="w"/><path class="k" d="M11.8 11.4c6.5.9 13 1.8 19.6 2.8-.3 2.1-.6 4.1-.9 6.2"/><path d="M15.4 4.8l17-2 .7 5.8-17 2z" fill="#DE9A7C"/><path class="k" d="M14.6 4c5.7-.7 11.4-1.4 17.2-2 .3 2.1.5 4.1.7 6.2-5.7.7-11.4 1.4-17.2 2-.3-2.1-.5-4.1-.7-6.2z"/><path d="M34.4 11.6l2.2 1.6M34 15.8l2.8.6" fill="none" stroke="#A9522F" stroke-width="1.6" stroke-linecap="round"/>',
  allset:'<path d="M9.4 11.6h22.6v18.4H9.4z" fill="#ECC5A0" class="w"/><path class="k" d="M8.4 10.8c7.4-.3 15-.3 22.4 0 .3 6.2.3 12.4 0 18.6-7.4.3-15 .3-22.4 0-.3-6.2-.3-12.4 0-18.6z"/><path d="M14 20.6l4.4 4.6 8.6-9.8" fill="none" stroke="#A9522F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  date:'<path d="M8.2 10.6h25v6H8.2z" fill="#DE9A7C"/><path d="M8.2 16.6h25v18H8.2z" fill="#FFFDF6"/><path class="k" d="M7 9.6c8.8-.3 17.4-.3 26 0 .3 8.4.3 16.8 0 25.2-5.6.3-11.2.3-16.6.1-1.8 0-3.6-.1-5.4-.1L7 34.8c-.3-8.4-.3-16.8 0-25.2z"/><path class="k" d="M7.1 15.8c8.6-.2 17.2-.2 25.8 0"/><path class="h" d="M11 20h2.4M16 20h2.4M21 20h2.4M26 20h2.4M11 24.4h2.4M16 24.4h2.4M26 24.4h2.4M11 28.8h2.4M16 28.8h2.4M21 28.8h2.4"/><path class="x-circle" pathLength="1" d="M20.2 22.6c1.6-1.2 3.8-.6 4 1.2.2 1.8-1.8 2.8-3.4 2.2-1.4-.6-1.6-2.4-.2-3.4" fill="none" stroke="#A9522F" stroke-width="1.1" stroke-linecap="round"/><path class="k" d="M13 6.4c-1.4 0-1.6 3.2 0 4.2M27 6.4c-1.4 0-1.6 3.2 0 4.2"/>',
  time:'<circle cx="21" cy="23" r="11.4" fill="#E6C478"/><circle cx="20.6" cy="22.6" r="8.2" fill="#FFFDF6"/><path class="k" d="M8.6 22c0-6.8 5.2-11.8 11.6-11.8 6.6.1 11.4 5.3 11.2 12-.1 6.4-5.4 11.4-11.8 11.2-6.2-.2-11-5.2-11-11.4z"/><path class="k" d="M18.4 10.2V7.6h3.4v2.6M17 6.6c1.6-.4 4.6-.4 6.2 0"/><path class="h" d="M20 15.6v1.4M20 27.6v1.4M13.6 22.2H15M25.4 22.2h1.4"/><path class="k" d="M20 22.2v-5.4" style="stroke:#A9522F;stroke-width:1.6"/><path class="k" d="M20 22.2l3.6 2"/>',
  length:'<path d="M14 11.4h12c0 4.2-2.6 6.6-6 8.4-3.4-1.8-6-4.2-6-8.4z" fill="#FFFDF6"/><path d="M15.6 30.8c.8-3 2.4-4.8 4.4-5.6 2 .8 3.6 2.6 4.4 5.6z" fill="#E6C478"/><path class="k" d="M11 8.6c6-.3 12-.3 18 0M11 32.6c6 .3 12 .3 18 0M13.4 9c-.2 5.4 2.6 8.4 6.6 11-4 2.6-6.8 5.6-6.6 11.4M26.6 9c.2 5.4-2.6 8.4-6.6 11 4 2.6 6.8 5.6 6.6 11.4"/><path class="h" d="M20 20v4.4"/>',
  repeat:'<path class="k" d="M29.6 14.2c-2-3.6-5.6-5.8-9.8-5.6-6 .2-10.6 5.2-10.4 11.2"/><path d="M30.6 8.6l-.8 6.2-6-1.4" fill="none" stroke="#A9522F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path class="k" d="M10.4 25.8c2 3.6 5.6 5.8 9.8 5.6 6-.2 10.6-5.2 10.4-11.2"/><path d="M9.4 31.4l.8-6.2 6 1.4" fill="none" stroke="#A9522F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  steps:'<path d="M10.6 9.8h19.6v26H10.6z" fill="#ECC5A0" class="w"/><path class="k" d="M9.4 8.8c7.2-.3 14.4-.3 21.6 0 .3 9.2.3 18.4 0 27.6-7.2.3-14.4.3-21.6 0-.3-9.2-.3-18.4 0-27.6z"/><path d="M13.4 17.4l1.6 1.8 3-3.6M13.4 24.4l1.6 1.8 3-3.6" fill="none" stroke="#A9522F" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path class="h" d="M20.4 17.6h7M20.4 24.6h7M13.8 31h13.6"/>',
  // (4.2.12) the top bar's sliders (Show), its assignment sheet (Open, the reader) and its Materials pages (a task's note),
  // copied from dashboard-view.js TB as they are
  show:'<path class="k" d="M8 12.4h24M8 20h24M8 27.6h24"/><path d="M13.6 9.6h4.6v5.6h-4.6zM23 17.2h4.6v5.6H23zM16.4 24.8H21v5.6h-4.6z" fill="#E6C478" stroke="#2B2A27" stroke-width="1.2" stroke-linejoin="round"/>',
  open:'<path d="M10.6 9.8h19.6v26H10.6z" fill="#ECC5A0" class="w"/><path class="k" d="M9.4 8.8c7.2-.3 14.4-.3 21.6 0 .3 9.2.3 18.4 0 27.6-7.2.3-14.4.3-21.6 0-.3-9.2-.3-18.4 0-27.6z"/><path d="M15.4 6.2h9.6v5h-9.6z" fill="#9DB4C8" class="w"/><path class="k" d="M14.6 5.8c3.6-.2 7.2-.2 10.8 0 .2 1.8.2 3.6 0 5.4-3.6.2-7.2.2-10.8 0-.2-1.8-.2-3.6 0-5.4z"/><path d="M13.4 17.4l1.6 1.8 3-3.6M13.4 24.4l1.6 1.8 3-3.6" fill="none" stroke="#A9522F" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path class="h" d="M20.4 17.6h7M20.4 24.6h7M13.8 31h13.6"/>',
  note:'<path d="M12.6 11.4l17.4-2.6 3 21-17.4 2.6z" fill="#B9CCDB" class="w"/><path class="k" d="M11.2 11.2c5.8-1 11.6-1.8 17.4-2.6 1 7 2 14 3 21-5.8.9-11.6 1.8-17.4 2.6-1-7-2-14-3-21z"/><path d="M8.6 14.6h17.6v21H8.6z" fill="#FFFDF6"/><path class="k" d="M7.6 13.8c5.9-.2 11.8-.2 17.6 0 .2 7.1.2 14.1 0 21.2-5.9.2-11.8.2-17.6 0-.2-7.1-.2-14.1 0-21.2z"/><path d="M11 19.2h11M11 22.6h11M11 26h8M11 29.4h10" fill="none" stroke="#2B2A27" stroke-width=".8" stroke-linecap="round" opacity=".7"/><path d="M19.6 13.8v7.4l2.4-1.6 2.4 1.6v-7.4z" fill="#C96442" stroke="#2B2A27" stroke-width=".9" stroke-linejoin="round"/>',
  // a word balloon (the line was said, not planned), in the same hand
  say:'<path d="M10.4 11.8c6.6-.5 13.6-.5 20.4.2.7 4 .7 8.2 0 12.2-3.2.4-6.6.5-9.8.4l-6 5.2.7-5.4c-1.8 0-3.6-.1-5.3-.2-.7-4.1-.7-8.3 0-12.4z" fill="#FFFDF6"/><path class="k" d="M8.6 10.4c7.4-.6 15.4-.6 23 .2.8 4.6.8 9.2 0 13.6-3.6.4-7.4.5-11 .4l-6.6 5.8.6-5.9c-2.1 0-4.2-.1-6.1-.3-.8-4.6-.8-9.2.1-13.8z"/><path class="h" d="M13.8 15.8h12.6M13.8 19.8h8"/>'
 };
 // a pen "?" for a reading that is a guess (the other reading is one press away)
 const QMARK='<svg class="rd-plan-q" viewBox="0 0 12 16" aria-hidden="true" focusable="false"><path d="M3.3 5.4c-.2-2 1.3-3.4 3.1-3.3 1.8.1 3 1.3 2.9 2.9-.1 1.5-1.2 2.1-2.2 2.8-.8.5-1.2 1.2-1.1 2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5.8 13.5c.2-.2.4-.2.6 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>';
 const draw=(key,cls='')=>`<svg class="rd-plan-ic${cls?' '+cls:''}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${ART[key]}</svg>`;
 // a tick in the pen's hand: a loose ring (closed, overshooting its start), its wash set a little off the line, and a
 // tick that draws itself when the work is done
 const TICK='<svg class="rd-plan-tick-art" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="w" d="M13 4.4c4.6 0 8.2 3.6 8.1 8.3-.1 4.5-3.7 8.2-8.3 8.1-4.6-.1-8.1-3.7-8-8.3.1-4.5 3.6-8.1 8.2-8.1z"/><path class="o" d="M12 3.2c4.9-.1 8.9 3.8 8.8 8.9-.1 4.9-4 8.8-8.9 8.7-4.8-.1-8.7-4-8.6-8.9C3.4 7 7.2 3.3 12.4 3.4c.8 0 1.6.1 2.3.3"/><path class="t" pathLength="1" d="M7.4 12.6l3.2 3.3 6.4-7.6"/></svg>';
 // the reading tags' own pen cross (widgets.css .rd-plan-chip > i), for a close, a dismiss and a step taken out
 const CROSS='<svg class="rd-plan-x-art" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M1.6 1.8c2.2 2 4.3 4.1 6.6 6.4M8.3 1.6C6 3.9 3.9 6 1.7 8.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
 const ARROW=dir=>`<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${dir<0?'M12.4 4.6c-2.4 1.8-4.2 3.6-5.6 5.5 1.4 1.9 3.2 3.6 5.6 5.4':'M7.6 4.6c2.4 1.8 4.2 3.6 5.6 5.5-1.4 1.9-3.2 3.6-5.6 5.4'}"/></svg>`;
 const BLOB=color=>`<svg class="rd-plan-blob" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8.6 3.2c3 0 5 2.2 4.9 5.1-.1 2.9-2.3 4.9-5.2 4.8-2.8 0-4.8-2.2-4.7-5 .1-2.8 2.2-4.9 5-4.9z" fill="${color}" opacity=".9"/><path d="M8 2.4c3.2-.2 5.6 2.2 5.5 5.4.1 3.2-2.4 5.7-5.6 5.6C4.7 13.5 2.4 11 2.5 7.9 2.4 4.8 4.8 2.5 8.3 2.6c.6 0 1.2.1 1.7.3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
 const KINDS=['date','time','duration','course','repeat','priority','notask','move'];
 // a wall-clock time as the page writes times ("8:00 AM"), with no time zone in between
 const clock=v=>{const [h,m]=String(v||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?`${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`:'';};
 // A long word in a narrow day ("Microcontroller") gets soft hyphens between its syllables (vowel, consonants, vowel: the
 // consonants a syllable may start with go with the next one), so the browser breaks it there, with a hyphen, and only when
 // it cannot fit; no break closer than three letters to an end or to another.
 const ONSET=new Set(['bl','br','ch','cl','cr','dr','fl','fr','gl','gr','ph','pl','pr','qu','sc','sh','sk','sl','sm','sn','sp','st','sw','th','tr','tw','wh','wr','str','spr','scr','spl','thr','chr','sch','shr']),vowel=ch=>/[aeiouy]/i.test(ch);
 function syllables(word){
  if(word.length<11||!/^[A-Za-z]+$/.test(word))return word;const w=word.toLowerCase(),cuts=[];
  for(let i=1;i<w.length-2;){
    if(vowel(w[i-1])&&!vowel(w[i])){
      let j=i;
      while(j<w.length&&!vowel(w[j]))j++;
      if(j>=w.length)break;
      const run=w.slice(i,j);
      let k=run.length;
      while(k>1&&!ONSET.has(run.slice(run.length-k)))k--;
      const cut=run.length===1?i:j-k;
      if(cut>=3&&w.length-cut>=3&&(!cuts.length||cut-cuts[cuts.length-1]>=3))cuts.push(cut);
      i=j;
    }
    else i++;
  }
  let out='',at=0;for(const cut of cuts){out+=word.slice(at,cut)+'\u00ad';at=cut;}return out+word.slice(at);
 }
 const breakable=text=>String(text??'').replace(/[A-Za-z]{11,}/g,syllables);
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

 // "move math hw to sat": the one open task (or Canvas work) the words name: the same title, or every word of it, a course
 // word counting as its course. None, or more than one: no move (the line is read as a new task).
 const plainWords=v=>String(v||'').toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 function moveTarget(parsed,list,courses){
  if(!parsed?.move||!parsed.name||!Array.isArray(list))return null;
  const want=plainWords(parsed.name),open=list.filter(e=>e&&!e.done&&!e.echo&&e.title),same=open.filter(e=>plainWords(e.title)===want);
  if(same.length)return same.length===1?same[0]:null;
  const words=want.split(' ').filter(w=>w.length>1&&!['my','the','an','to','for','of','and'].includes(w)),course=parsed.courseId&&(courses||[]).find(c=>String(c.id)===parsed.courseId);
  const hits=open.filter(e=>{
    const t=new Set(plainWords(e.title).split(' ')),need=course&&String(e.courseId)===parsed.courseId?words.filter(w=>Plan().courseFor([w],[course])!==course):words;
    return need.length&&need.every(w=>t.has(w));
  });
  return hits.length===1?hits[0]:null;
 }
 // How the student's words were read, for the line under the quick add: the name it will get, then one paper tag per
 // thing understood. A tag pressed is taken back (its words go back into the name) and pressed again, read again.
 function reading(text,{today,now,courses,ignore=[],tz,formatDate,fieldDay='',list=null}){
  const P=Plan(),off=new Set(ignore),chips=[],read=more=>P.parseQuick(text,today,{courses,now,ignore:[...ignore,...more],day:fieldDay});let parsed=read([]);
  const items=()=>typeof list==='function'?list():list;
  // a move needs the task it names; with none (or several) the same words are read as a new task, "move" and all
  const target=parsed.move?moveTarget(parsed,items(),courses):null;if(parsed.move&&!target)parsed=read(['move']);
  if(parsed.notTask)return {parsed:{...parsed,day:''},chips:[{kind:'notask',art:draw('say'),text:'Not a task'}],day:''};
  const fmt=(key,o)=>formatDate(Date.parse(key+'T12:00:00Z'),'UTC',o);
  const say=key=>
    key===today?
      'Today':
      key===P.addDays(today,1)?'Tomorrow':key===P.addDays(today,-1)?'Yesterday':fmt(key,{weekday:'short',month:'short',day:'numeric',...(key.slice(0,4)!==today.slice(0,4)?{year:'numeric'}:{})});
  const has=k=>parsed.spans.some(s=>s.kind===k&&!s.soft);
  const day=parsed.day||fieldDay,guess=parsed.guess||{};
  // the line was taken as a task although it reads as a question or a greeting: that can be undone the same way
  if(off.has('notask')&&P.parseQuick(text,today,{courses,now,ignore:ignore.filter(k=>k!=='notask'),day:fieldDay}).notTask)chips.push({kind:'notask',art:draw('say'),text:'Not a task',off:true});
  if(target)chips.push({kind:'move',art:draw('date'),text:'Move '+(target.title.length>32?target.title.slice(0,31)+'…':target.title)});
  else if(off.has('move')&&moveTarget(P.parseQuick(text,today,{courses,now,ignore:ignore.filter(k=>k!=='move'),day:fieldDay}),items(),courses))
    chips.push({kind:'move',art:draw('date'),text:'Move',off:true});
  // a guess (see parseQuick): marked, with the other reading one press away (no other reading: the press takes it back)
  const guessed=k=>guess[k]===undefined?{}:{guess:true,alt:guess[k]?(k==='date'?say(guess[k]):clock(guess[k])):''};
  // a day read from the words can be taken back; a day that only follows from a time or a repeat (or the column the
  // words were typed in) is shown, quietly, so the student still sees where the task will land
  if(parsed.day&&(has('date')||has('due')))chips.push({kind:'date',art:draw('date'),text:(parsed.due?'Due ':'')+say(parsed.day),late:parsed.day<today,...guessed('date')});
  else if(off.has('date'))chips.push({kind:'date',art:draw('date'),text:'Date',off:true});
  else if(parsed.day)chips.push({kind:'date',art:draw('date'),text:(parsed.due?'Due ':'')+say(parsed.day),quiet:true});
  if(parsed.at)chips.push({kind:'time',art:draw('time'),text:clock(parsed.at),...guessed('time')});
  else if(off.has('time'))chips.push({kind:'time',art:draw('time'),text:'Time',off:true});
  if(parsed.estimate)chips.push({kind:'duration',art:draw('length'),text:P.minutes(parsed.estimate)});else if(off.has('duration'))chips.push({kind:'duration',art:draw('length'),text:'Length',off:true});
  if(parsed.courseId){
    const c=(courses||[]).find(x=>String(x.id)===parsed.courseId);
    let art='';
    try{art=c&&root.ReserveCourseArt?.mini?.(c,{place:'chip'})||'';}catch{}
    chips.push({kind:'course',art:art&&/^<svg/.test(art)?art:BLOB(esc(c?.color||'#9A8F7A')),text:c?.shortName||c?.name||'Course'});
  }
  else if(off.has('course'))chips.push({kind:'course',art:BLOB('#9A8F7A'),text:'Course',off:true});
  if(parsed.repeat)chips.push({kind:'repeat',art:draw('repeat'),text:P.repeatLabel(parsed.repeat)});else if(off.has('repeat'))chips.push({kind:'repeat',art:draw('repeat'),text:'Repeat',off:true});
  if(parsed.priority)
    chips.push({kind:'priority',art:'<b class="rd-plan-bang" aria-hidden="true">!</b>',text:'Important'});
  else if(off.has('priority'))chips.push({kind:'priority',art:'<b class="rd-plan-bang" aria-hidden="true">!</b>',text:'Important',off:true});
  if(!parsed.day&&fieldDay&&!off.has('date'))chips.unshift({kind:'date',art:draw('date'),text:say(fieldDay),quiet:true});
  // a move changes only the day (and the time): the task keeps its own course, length and repeat
  return {
    parsed:{...parsed,day:parsed.day||(off.has('date')?'':fieldDay),...(target?{moveId:String(target.id)}:{})},
    chips:target?chips.filter(c=>['move','date','time'].includes(c.kind)):chips,
    day
  };
 }
 const chipLabel=c=>c.kind==='notask'?(c.off?'Not a task: leave it out again':'Not a task: add it as a task'):c.kind==='move'?(c.off?'Move the task that is there':`${c.text}: add a new task instead`):c.off?`Read the ${c.kind==='duration'?'length':c.kind} again`:c.guess?`${c.text}, a guess: ${c.alt?`press for ${c.alt}`:'press to take it back'}`:`${c.text}: not what I meant`;
 const chipHTML=(c,fieldDay)=>c.quiet?`<span class="rd-plan-chip" data-kind="${c.kind}" data-quiet="true">${c.art}<span>${esc(c.text)}</span></span>`:`<button type="button" class="rd-plan-chip" data-rd-action="plan-chip" data-kind="${c.kind}" data-field-day="${esc(fieldDay)}"${c.off?' data-off="true"':''}${c.late?' data-late="true"':''}${c.guess?` data-guess="true"${c.alt?' data-alt="true"':''} title="${esc(c.alt?`Or ${c.alt}`:'A guess')}"`:''} aria-pressed="${!c.off}" aria-label="${esc(chipLabel(c))}">${c.art}<span>${esc(c.text)}</span>${c.guess?QMARK:''}<i aria-hidden="true"></i></button>`;

 // ---- the page (4.2.13) -------------------------------------------------------------------------------------------------
 // Month (the default) or Week. The views saved by 4.2.12 ("list") and 4.2 ("day") read as Month, with that day chosen when
 // one is given; "week" stays Week; anything else reads as Month.
 const viewOf=(ui,c)=>ui.mode==='week'?'week':['month','list','day'].includes(ui.mode)?'month':c?.personal?.toolbox?.planner?.view==='week'?'week':'month';
 // what the Show filter calls a piece of work's course: its course, or "mine" for an own task with none
 const courseKey=e=>e.personal&&String(e.courseId)==='personal'?'mine':String(e.courseId);
 const toMin=v=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(v||''));return m?+m[1]*60+ +m[2]:null;};
 const hhmm=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
 const short12=v=>{const m=toMin(v);if(m===null)return '';const h=Math.floor(m/60),mi=m%60;return `${h%12||12}${mi?':'+String(mi).padStart(2,'0'):''} ${h<12?'AM':'PM'}`;};
 const len=n=>!n?'':n<60?`${n}m`:n%60?`${Math.floor(n/60)} h ${n%60}m`:`${n/60} h`;
 const wall=(at,zone)=>{
   try{
     const p=new Intl.DateTimeFormat('en-US',{timeZone:zone||'America/New_York',hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(at)),v=k=>+(p.find(x=>x.type===k)?.value||0);
     return v('hour')*60+v('minute');
   }catch{return 0;}
 };
 function nowMinute(c){try{return wall(c.now||Date.now(),c.s?.timeZone);}catch{return null;}}
 // How the calendar fits the room it has (pure: the controller measures, the page draws). Month: as many week rows as fit
 // at no less than 128 px a row (2 to 6; 4 before anything is measured); Week: one tall row. Then how many chips a day's
 // cell holds before its "+n" (a one-line chip is 25 px with its gap in Month, a two-line one 46 px in Week).
 // (4.2.14) a grid too short for two rows of 104 px shows ONE week, so a short window still reads.
 const ROW_MIN=128,ROW_SHORT=104,CHIP_H={month:25,week:46};
 function fit({height=0,calHead=56,names=26,mode='month'}={}){
  const grid=Math.max(0,height-calHead-names),rows=mode==='week'?1:height?(grid<2*ROW_SHORT?1:Math.max(2,Math.min(6,Math.floor(grid/ROW_MIN)))):4;
  const cell=height?Math.floor(grid/rows):mode==='week'?420:136,chips=Math.max(1,Math.floor((cell-34)/CHIP_H[mode==='week'?'week':'month']));
  return {rows,cell,chips};
 }
 // "Add a task": the tick's own ring drawn dashed, a plus in it (the report lists it among the places that want a drawing)
 const RING_PLUS='<svg class="rd-plan-plus-art" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="o" d="M12 3.2c4.9-.1 8.9 3.8 8.8 8.9-.1 4.9-4 8.8-8.9 8.7-4.8-.1-8.7-4-8.6-8.9C3.4 7 7.2 3.3 12.4 3.4c.8 0 1.6.1 2.3.3"/><path class="p" d="M12 8.3v7.4M8.3 12h7.4"/></svg>';
 const DOT=color=>`<i class="rd-plan-dot" style="--rd-course:${color}" aria-hidden="true"></i>`;
 const HELP='Drag a task to another day, to No date, or press Shift and the left or right arrow on it. In the calendar the arrow keys choose a day, Home and End the ends of its week, Page Up and Page Down move by the rows shown; Enter adds a task on it. Press a task for its sheet. Canvas due dates do not change.';

 // ---- the day button and its picker: one pill and one small card everywhere a piece of work is shown -------------------
 // Planned: the calendar drawing and the short day ("Thu", "Today", "Dec 4"); not planned: the drawing and "Plan".
 function dayButton({id,planned='',title=''}={},{E=esc,today='',formatDate=null}={}){
  const P=Plan();if(!P||!id)return '';
  const fmt=(k,o)=>typeof formatDate==='function'?formatDate(Date.parse(k+'T12:00:00Z'),'UTC',o):k,day=P.validDay?.(planned)?planned:'';
  const n=day&&today?P.between(today,day):null,word=!day?'Plan':day===today?'Today':n>0&&n<7?fmt(day,{weekday:'short'}):fmt(day,{month:'short',day:'numeric'});
  const said=day?`${title}: planned for ${day===today?'today':fmt(day,{weekday:'long',month:'long',day:'numeric'})}. Change the day`:`Plan ${title}`;
  return `<button type="button" class="rd-plan-daybtn" data-rd-action="plan-pick" data-id="${E(id)}" data-day="${E(day)}" data-planned="${!!day}" aria-haspopup="dialog" aria-expanded="false" aria-label="${E(said)}">${draw('date')}<span>${E(word)}</span></button>`;
 }
 // The picker: quick days (Today, Tomorrow, the next days by their short names), None, and a small month (Monday first) to
 // pick any day; the day suggest() proposes carries a dot. The same markup stands in a task's sheet (its Day row).
 function pickerHTML({id,planned='',today,month='',suggested='',E=esc,formatDate,inline=false}){
  const P=Plan(),fmt=(k,o)=>formatDate(Date.parse(k+'T12:00:00Z'),'UTC',o),long=k=>fmt(k,{weekday:'long',month:'long',day:'numeric'});
  const quick=[0,1,2,3,4,5].map(n=>P.addDays(today,n)),word=k=>k===today?'Today':k===P.addDays(today,1)?'Tomorrow':fmt(k,{weekday:'short'});
  const pick=(k,text,cls,extra='')=>`<button type="button" class="${cls}" data-rd-action="plan-pick-day" data-id="${E(id)}" data-day="${k}" aria-pressed="${(planned||'')===k}"${k&&k===suggested?' data-suggest="true"':''} aria-label="${E(k?long(k)+(k===suggested?', suggested':''):'No day')}"${extra}>${text}</button>`;
  const m=/^\d{4}-\d{2}$/.test(month)?month:(planned||today).slice(0,7),first=m+'-01',from=P.mondayOf(first),after=P.addMonths(first,1),weeks=Math.ceil(P.between(from,after)/7);
  const home=planned&&planned.slice(0,7)===m?planned:today.slice(0,7)===m?today:first;
  let cells='';
  for(let i=0;i<weeks*7;i++){
    const k=P.addDays(from,i);
    cells+=pick(k,String(+k.slice(8)),'rd-plan-mday',`${k.slice(0,7)!==m?' data-out="true"':''}${k===today?' data-today="true"':''}${k<today?' data-past="true"':''} tabindex="${k===home?0:-1}"`);
  }
  const name=fmt(first,{month:'long',year:'numeric'}),arrow=(d,label)=>`<button type="button" class="rd-plan-x rd-plan-month-arrow" data-rd-action="plan-pick-month" data-id="${E(id)}" data-month="${m}" data-delta="${d}" aria-label="${label}">${ARROW(d)}</button>`;
  return `<div class="rd-plan-picker-body${inline?' rd-plan-picker-inline':''}" data-id="${E(id)}"><div class="rd-plan-quickdays" role="group" aria-label="Quick days">${quick.map(k=>pick(k,E(word(k)),'rd-plan-pick')).join('')}<button type="button" class="rd-plan-pick rd-plan-pick-none" data-rd-action="plan-pick-day" data-id="${E(id)}" data-day="" aria-pressed="${!planned}" aria-label="No day">None</button></div><div class="rd-plan-month" data-month="${m}"><div class="rd-plan-month-head">${arrow(-1,'Previous month')}<strong>${E(name)}</strong>${arrow(1,'Next month')}</div><div class="rd-plan-mnames" aria-hidden="true">${['M','T','W','T','F','S','S'].map(x=>`<span>${x}</span>`).join('')}</div><div class="rd-plan-mgrid" role="group" aria-label="${E(name)}">${cells}</div></div></div>`;
 }
 // The add line ("Add a task": it IS the field): what was typed, and under it how it was read, one paper tag each (only
 // while there is text). `at` names the place (the Planner's page, Home, the top bar's card); `day` is the day a task
 // lands on unless the words name another.
 function addLine(c,h,ui,{day='',at='',list=null,keys=true,label='Add a task'}={}){
  const {E}=h,
    d=ui.drafts?.[at]||{text:'',ignore:[]},
    read=d.text.trim()?
      reading(d.text,{
        today:h.dayKey?h.dayKey(c.now||Date.now(),c.s?.timeZone):day,
        now:nowMinute(c),
        courses:c.courses,
        ignore:d.ignore,
        tz:c.s?.timeZone,
        formatDate:h.formatDate,
        fieldDay:day,
        list:list||[]
      }):
      null;
  // (the tags carry the place in data-field-day: a press on one reads that place's words again)
  return `<form class="rd-quick-add rd-plan-add" data-rd-form="plan-quick" data-day="${day}" data-at="${at}">${RING_PLUS}<input type="text" data-rd-field="plan-quick" data-day="${day}" data-at="${at}" maxlength="200" autocomplete="off" aria-label="${E(label)}"${keys?' aria-keyshortcuts="n /"':''} placeholder="Add a task" value="${E(d.text)}"><button type="button" class="rd-button rd-quick-add-button rd-plan-add-go" data-rd-action="plan-quick-add" data-day="${day}" data-at="${at}" tabindex="-1">Add</button></form><div class="rd-plan-read" data-rd-key="read-${at||'page'}" data-for="${at}">${read?read.chips.map(z=>chipHTML(z,at)).join(''):''}</div>`;
 }

 // What the page shows, worked out once for the drawing and again for a press that acts on it (Tick all, All to today).
 function state(c,h,ui){
  const P=Plan(),{list:all,today}=Widgets().plan(c,h),tz=c.s?.timeZone,mode=viewOf(ui,c),valid=k=>typeof k==='string'&&!!P.validDay?.(k);
  const day=valid(ui.day)?ui.day:valid(ui.open)?ui.open:today;
  const F=fit({height:ui.height||0,calHead:ui.calHead||56,names:ui.names||26,mode});
  let start=P.mondayOf(valid(ui.start)?ui.start:today);
  if(!valid(ui.start)&&(day<start||day>P.addDays(start,F.rows*7-1)))start=P.mondayOf(day);
  const picked=Array.isArray(ui.show)&&ui.show.length?new Set(ui.show.map(String)):null,list=picked?all.filter(e=>picked.has(courseKey(e))):all;
  const fresh=e=>(ui.recent?.get?.(e.id)||0)>Date.now()-120000,shown=e=>!e.done||!!ui.showDone||fresh(e);
  const cal=P.span(list,today,start,F.rows*7),page=day>=start&&day<=cal.last?cal.days.find(d=>d.key===day):P.span(list,today,day,1).days[0];
  return {P,all,list,today,tz,mode,day,start,F,picked,cal,page,overdue:cal.overdue,nodate:cal.nodate,fresh,shown};
 }

 // The pieces, drawn from one state: the day's rows, the add line, No date, the folded Overdue line and its list, the
 // calendar's cells and chips, the sheet. render() puts them together on the Planner; dayPage() puts the rows and the add
 // line on Home.
 function kit(c,h,ui,S){
  const {E}=h,{P,today,tz,mode}=S;
  const action=(name,text,extra='',cls='rd-button')=>`<button type="button" class="${cls}" data-rd-action="${name}" ${extra}>${text}</button>`;
  const utc=key=>Date.parse(key+'T12:00:00Z'),fmt=(key,o)=>h.formatDate(utc(key),'UTC',o),long=key=>fmt(key,{weekday:'long',month:'long',day:'numeric'});
  const near=key=>{const n=P.between(today,key);return n>-7&&n<7?fmt(key,{weekday:'short'}):fmt(key,{month:'short',day:'numeric'});};
  const dueAt=e=>e.dueAt?h.formatDate(e.dueAt,tz,{hour:'numeric',minute:'2-digit'}):'';
  const courseName=e=>e.personal&&String(e.courseId)==='personal'?'Mine':c.courseMap?.get?.(String(e.courseId))?.shortName||e.course||'';
  const color=e=>E(e.color||'#7c718d');
  // the tick: a drawn ring; Canvas work done in Canvas shows the tick fixed; a repeat's coming day is not ticked yet
  const tickFor=(e,cls='rd-todo-check rd-plan-tick',focusable=true)=>{
   const canvasDone=e.done&&!e.personal&&!(c.local?.[e.id]?.checkedOff)&&!e.logged;
   const act=e.echo&&!e.logged?'':e.repeat?(e.logged?(e.log.at(-1)?.day===e.planned?'plan-repeat-undo':''):e.done?'undo-check-off':'plan-repeat-done'):(e.done?'undo-check-off':'check-off');
   if(canvasDone)return `<span class="${cls}" data-done="true" title="Completed in Canvas" aria-label="Completed in Canvas">${TICK}</span>`;
   if(!act)return `<span class="${cls}" data-done="${!!e.done}" data-still="true" aria-hidden="true">${TICK}</span>`;
   return action(act,TICK,`data-id="${E(e.id)}" aria-pressed="${!!e.done}" aria-label="${e.done?'Put back':'Mark done'}: ${E(e.title)}"${focusable?'':' tabindex="-1"'}`,cls);
  };
  // ---- a row of the day's page: the tick, the time when it has one, the title (its sheet; on Home, the reader), and at the
  // right one quiet line: the length, the deadline, steps, the course's dot and name
  const rowHTML=(e,dayKey,{place='page',overdue=false}={})=>{
   const key=e.echo?`pi-${e.id}@${e.planned}${e.logged?'d':''}`:`pi-${e.id}`,late=!e.done&&P.isOverdue(e,today),said='rd-pr-'+String(key).replace(/[^\w-]/g,'-')+(place==='page'?'':'-'+place);
   const due=!e.dueAt||!e.dueDay?'':overdue?`due ${e.dueDay<today?fmt(e.dueDay,{month:'short',day:'numeric'}):near(e.dueDay)}`:e.dueDay===dayKey?`due ${dueAt(e)}`:'';
   const meta=[e.estimate?`<span>${E(P.minutes(e.estimate))}</span>`:'',due?`<span${!e.done&&e.dueDay<today?' class="rd-plan-late"':''}>${E(due)}</span>`:''].filter(Boolean).join('');
   const home=place==='home',sheetOpen=!home&&ui.sheet===e.id&&!e.echo;
   // (a11y-42: the button keeps the task's name; the time and the quiet line are its description, the repeat said to screen
   // readers only)
   const open=action(home?'preview':'plan-sheet',`${e.priority?'<b class="rd-plan-bang" aria-hidden="true">!</b>':''}<span>${E(breakable(e.title))}</span>`,`data-id="${E(e.id)}" aria-label="${E(e.title)}${e.priority?', important':''}" aria-describedby="${e.plannedTime?said+'-at ':''}${said}"${home?'':` aria-haspopup="dialog" aria-expanded="${sheetOpen}"`}${e.echo||home?'':' aria-keyshortcuts="Shift+ArrowLeft Shift+ArrowRight"'}`,'rd-plan-title');
   return `<div class="rd-plan-item" role="listitem" data-rd-key="${E(key)}" data-plan-id="${E(e.id)}" data-done="${!!e.done}" data-late="${late}"${e.echo?' data-echo="true"':''}${e.priority?' data-priority="high"':''}${sheetOpen?' data-sheet="true"':''} style="--rd-course:${color(e)}">${tickFor(e)}<span class="rd-plan-at"${e.plannedTime?` id="${said}-at"`:''}>${e.plannedTime?E(clock(e.plannedTime)):''}</span>${open}<small class="rd-plan-meta" id="${said}">${meta}<span class="rd-plan-course">${DOT(color(e))}<span class="rd-plan-cname">${E(courseName(e))}</span></span>${e.repeat?`<span class="rd-sr-only">${E(P.repeatLabel(e.repeat))}</span>`:''}</small>${overdue?dayButton({id:e.id,planned:e.planned,title:e.title},{E,today,formatDate:h.formatDate}):''}</div>`;
  };
  // ---- Biscuit's local study plan: its blocks on their day are rows in the same time order (not tickable)
  const localPlan=c.personal?.toolbox?.biscuitPlan,records=localPlan?.records||{},work=new Set(S.all.filter(e=>{
    const owned=records[e.id]?.after;
    return owned&&e.planned===owned.plannedDate&&(e.plannedTime||'')===(owned.plannedTime||'')&&e.estimate===owned.estimate&&S.shown(e);
  }).map(e=>e.id)),blocks=(localPlan?.blocks||[]).filter(b=>b.kind==='break'||work.has(String(b.itemId)));
  const blocksOn=key=>typeof h.dayKey==='function'?blocks.filter(b=>h.dayKey(b.start,tz)===key).sort((a,b)=>a.start-b.start):[];
  const blockRow=b=>{
    const t=at=>h.formatDate(at,tz,{hour:'numeric',minute:'2-digit'}),brk=b.kind==='break';
    return `<div class="rd-plan-item" role="listitem" data-block="${brk?'break':'study'}" data-rd-key="pb-${E(String(b.start))}-${E(String(b.itemId||b.kind||''))}"${b.reason?` title="${E(b.reason)}"`:''}><span class="rd-plan-blockmark" aria-hidden="true"></span><span class="rd-plan-at">${E(t(b.start))}</span>${brk?`<span class="rd-plan-title rd-plan-title-still">${E(b.title)}</span>`:action('plan-view',`<span>${E(b.title)}</span>`,`data-id="${E(b.itemId)}" aria-label="${E(`${b.title}, study block, ${t(b.start)} to ${t(b.end)}`)}"`,'rd-plan-title')}<small class="rd-plan-meta"><span>until ${E(t(b.end))}</span><span class="rd-plan-course">${brk?'Break':'Study'}</span></small></div>`;
  };
  // a day's rows: timed work and Biscuit's blocks by their time, then the rest (important first), finished at the end
  const dayRows=(d,place)=>{
   const tasks=d.all.filter(e=>S.shown(e)||e.echo&&!e.done),timed=tasks.filter(e=>!e.done&&e.plannedTime),bl=blocksOn(d.key);
   const head=[...timed.map(e=>[toMin(e.plannedTime),0,rowHTML(e,d.key,{place})]),...bl.map(b=>[wall(b.start,tz),1,blockRow(b)])].sort((a,b)=>
     a[0]-b[0]||a[1]-b[1]).map(x=>
     x[2]);
   return {rows:[...head,...tasks.filter(e=>!timed.includes(e)).map(e=>rowHTML(e,d.key,{place}))],timed:head.length>0};
  };
  const nothing=key=>`<p class="rd-plan-nothing" role="listitem">${E(key===today?'Nothing today':'Nothing on '+fmt(key,{weekday:'long'}))}</p>`;
  // the line that says a bulk action or a finding's action was done, with its Undo (where the dashboard's change note
  // does not carry it), for its 90 seconds
  const doneLine=place=>{
    const r=ui.check;
    return r&&r.place===place&&Date.now()-r.at<90000?`<p class="rd-plan-advice" data-done="true" data-rd-key="adv-done"><span>${E(r.text)}</span>${r.undo?action('plan-check-undo','Undo','','rd-text-button'):''}</p>`:'';
  };
  // ---- No date, and Overdue folded to one line
  const nodateHTML=(crowded,room=3)=>{
   const items=S.nodate.filter(S.shown);
   if(!items.length)return '';
   const cap=crowded&&!ui.nodateMore?room:items.length,n=Math.min(cap,items.length),folded=crowded&&!ui.nodateMore&&n===0,opened=crowded&&!!ui.nodateMore;
   return `<section class="rd-plan-nodate" data-rd-key="plan-nodate" data-plan-drop="" aria-labelledby="rd-plan-nodate-h"${folded?' data-folded="true"':''}><h3 class="rd-plan-label" id="rd-plan-nodate-h">${folded||opened?action('plan-more',`<span>No date</span><b>${items.length}</b>${ARROW(1)}`,`data-tray="nodate" data-fold="${opened?'close':'open'}" aria-expanded="${opened}" aria-label="No date: ${items.length}"`,'rd-plan-fold'):`<span>No date</span><b>${items.length}</b>`}</h3>${folded?'':`<div class="rd-plan-rows" role="list" aria-labelledby="rd-plan-nodate-h">${items.slice(0,n).map(e=>rowHTML(e,'')).join('')}</div>`}${!folded&&items.length>n?action('plan-more',`${items.length-n} more`,'data-tray="nodate"','rd-text-button rd-plan-more-link'):''}</section>`;
  };
  const overdueLine=()=>{const n=S.overdue.length;return n?action('plan-overdue',`<span>Overdue</span><b>${n}</b>${ARROW(1)}`,`aria-expanded="false" aria-label="Overdue: ${n}"`,'rd-plan-overdue'):'';};
  const overduePage=()=>{const items=S.overdue;
   return `<section class="rd-plan-page" data-rd-key="plan-page-overdue" data-view="overdue" aria-labelledby="rd-plan-day-title"><header class="rd-plan-page-head">${action('plan-overdue-back',ARROW(-1),`aria-label="${E('Back to '+long(S.day))}"`,'rd-button rd-plan-arrow')}<h2 id="rd-plan-day-title" tabindex="-1">Overdue</h2><b class="rd-plan-count">${items.length}</b></header>${doneLine('overdue')}<div class="rd-plan-bulk">${action('plan-overdue-today',`${draw('date')}<span>All to today</span>`,'','rd-button')}${action('plan-overdue-tick',`${TICK}<span>Tick all</span>`,'','rd-button rd-plan-tickall')}</div><div class="rd-plan-rows rd-plan-day-rows" role="list" aria-labelledby="rd-plan-day-title" data-timed="false">${items.map(e=>rowHTML(e,e.planned||e.dueDay,{overdue:true})).join('')}</div></section>`;};
  // ---- the narrow page (under about 760 px): the chosen day's week as a strip of seven days over the page, Month behind
  // its own switch
  const stripHTML=()=>{
    const from=P.mondayOf(S.day);
    return `<div class="rd-plan-strip" role="group" aria-label="${E('Week of '+long(from))}">${Array.from({length:7},(_,i)=>{
      const k=P.addDays(from,i),d=P.day(S.list,k),dots=d.all.filter(e=>!e.done).slice(0,4).map(e=>DOT(color(e))).join('');
      return action('plan-choose',`<span>${E(fmt(k,{weekday:'short'}))}</span><strong>${+k.slice(8)}</strong><span class="rd-plan-sdots">${dots}</span>`,`data-day="${k}" data-plan-drop="${k}" aria-pressed="${k===S.day}" data-today="${k===today}" aria-label="${E(`${long(k)}: ${d.open} to do`)}"`,'rd-plan-sday');
    }).join('')}${action('plan-cal-open','Month',`aria-expanded="${!!ui.calOpen}"`,'rd-button rd-plan-cal-open')}</div>`;
  };
  // ---- the chosen day's page
  const pageHTML=()=>{
   if(ui.overdueOpen&&S.overdue.length)return overduePage();
   const d=S.page,isToday=d.key===today,{rows,timed}=dayRows(d,'page'),nod=S.nodate.filter(S.shown);
   const crowded=!!ui.listRoom&&(Math.max(1,rows.length)*44+(nod.length?40+nod.length*44:0))>ui.listRoom;
   // (4.2.14) today first: when the two lists do not both fit, the day's own rows keep the room and No date shows what
   // is left of it under them (its label 40 px, a row 44, its "n more" 26), down to its one line
   const nodRoom=crowded?Math.max(0,Math.floor((ui.listRoom-Math.max(1,rows.length)*44-40-26)/44)):nod.length;
   return `<section class="rd-plan-page" data-rd-key="plan-page" aria-labelledby="rd-plan-day-title"${d.key<today?' data-past="true"':''}${crowded?' data-crowded="true"':''}>${stripHTML()}<header class="rd-plan-page-head">${action('plan-step',ARROW(-1),'data-delta="-1" aria-label="Previous day"','rd-button rd-plan-arrow')}<h2 id="rd-plan-day-title" tabindex="-1" aria-label="${E(long(d.key)+(isToday?', today':''))}">${E(fmt(d.key,{weekday:'short',month:'short',day:'numeric'}))}</h2>${isToday?'<em class="rd-plan-today">Today</em>':''}${action('plan-step',ARROW(1),'data-delta="1" aria-label="Next day"','rd-button rd-plan-arrow')}</header><div class="rd-plan-rows rd-plan-day-rows" role="list" data-plan-drop="${d.key}" data-timed="${timed}" aria-labelledby="rd-plan-day-title">${rows.join('')||nothing(d.key)}</div>${addLine(c,h,ui,{day:d.key,at:'',list:S.all})}${nodateHTML(crowded,nodRoom)}${doneLine('overdue')}${overdueLine()}</section>`;
  };
  // ---- Home's "My plan": the same rows and the same add line, for today
  const homeHTML=()=>{const d=S.page,{rows,timed}=dayRows(d,'home');return `<div class="rd-plan-home" data-rd-key="plan-home"><div class="rd-plan-rows rd-plan-day-rows" role="list" aria-label="Today" data-timed="${timed}">${rows.join('')||nothing(d.key)}</div>${addLine(c,h,ui,{day:d.key,at:'home',list:S.all,keys:false})}</div>`;};
  // ---- the calendar: its heading, then the weeks as rows of seven days; a day's tasks are one-line chips (two lines in
  // Week, with their time), what does not fit is "+n"
  const entryHTML=(e,dayKey)=>{
   const kind=e.echo?(e.logged?'logged':'echo'):e.planned===dayKey?'planned':'due',key=`pe-${e.id}@${dayKey}`;
   const time=mode==='week'&&e.plannedTime?`<span class="rd-plan-etime">${E(short12(e.plannedTime))}</span>`:'';
   const said=`${e.title}${kind==='due'&&e.dueAt?', due '+dueAt(e):''}${e.plannedTime?', '+clock(e.plannedTime):''}${courseName(e)?', '+courseName(e):''}${e.done?', done':''}`;
   return `<div class="rd-plan-entry" data-kind="${kind}" data-rd-key="${E(key)}" data-plan-id="${E(e.id)}" data-done="${!!e.done}"${e.echo?' data-echo="true"':''}${ui.sheet===e.id&&!e.echo?' data-sheet="true"':''} style="--rd-course:${color(e)}">${kind==='echo'?'<span class="rd-plan-etick" data-still="true" aria-hidden="true"></span>':tickFor(e,'rd-plan-etick',false)}${action('plan-sheet',`${time}<span class="rd-plan-etitle">${E(e.title)}</span>`,`data-id="${E(e.id)}" data-from="chip" tabindex="-1" aria-label="${E(said)}" aria-haspopup="dialog"`,'rd-plan-eopen')}</div>`;
  };
  const markHTML=e=>action('plan-sheet',`<span class="rd-plan-due-word">due</span><span class="rd-plan-etitle">${E(e.title)}</span>`,`data-id="${E(e.id)}" data-from="mark" data-rd-key="pm-${E(e.id)}" tabindex="-1" aria-haspopup="dialog" aria-label="${E(`${e.title}: due ${dueAt(e)}, planned for ${long(e.planned)}`)}" style="--rd-course:${color(e)}"`,'rd-plan-entry rd-plan-mark');
  const cellHTML=(d,focusKey)=>{
   const isToday=d.key===today,chosen=d.key===S.day,heavy=d.key>=today&&(d.open>=3||d.minutes>=150);
   const chips=[...d.all.filter(e=>S.shown(e)||e.echo&&!e.done).map(e=>entryHTML(e,d.key)),...d.marks.map(markHTML)],
     n=chips.length>S.F.chips?Math.max(0,S.F.chips-1):chips.length;
   const label=d.key.slice(8)==='01'?fmt(d.key,{month:'short',day:'numeric'}):String(+d.key.slice(8));
   const said=`${long(d.key)}${isToday?', today':''}: ${d.open?`${d.open} to do`:'nothing to do'}${d.done?`, ${d.done} done`:''}${d.marks.length?`, ${d.marks.length} due`:''}${heavy?', a heavy day':''}`;
   return `<div class="rd-plan-cell" role="gridcell" data-rd-key="pc-${d.key}" data-day="${d.key}" data-plan-drop="${d.key}" tabindex="${d.key===focusKey?0:-1}" aria-selected="${chosen}" aria-label="${E(said)}" data-today="${isToday}" data-past="${d.key<today}" data-chosen="${chosen}"${heavy?' data-heavy="true"':''}><span class="rd-plan-num" aria-hidden="true">${E(label)}</span>${action('plan-add-on',RING_PLUS,`data-day="${d.key}" tabindex="-1" aria-label="${E('Add a task on '+long(d.key))}"`,'rd-plan-cell-add')}<div class="rd-plan-chips">${chips.slice(0,n).join('')}${chips.length>n?action('plan-choose',`+${chips.length-n}`,`data-day="${d.key}" tabindex="-1" aria-label="${E(`${chips.length-n} more on ${long(d.key)}`)}"`,'rd-plan-more'):''}</div></div>`;
  };
  // Show: the course filter and the Finished switch; Your week: its findings, each with its one action and its Dismiss
  const options=[...(c.courses||[]).map(z=>({key:String(z.id),name:z.shortName||z.name||'Course',color:z.color||'#9A8F7A',course:z})),{key:'mine',name:'Mine',color:'#7c718d'}];
  const mini=o=>{let art='';try{art=o.course&&root.ReserveCourseArt?.mini?.(o.course,{place:'chip'})||'';}catch{}return art&&/^<svg/.test(art)?art:BLOB(E(o.color));};
  const hiddenDone=[...S.cal.days,...(S.cal.days.includes(S.page)?[]:[S.page])].reduce((n,d)=>n+d.all.filter(e=>e.done&&!S.fresh(e)).length,0);
  const showHTML=()=>{const shownN=S.picked?options.filter(o=>S.picked.has(o.key)).length:options.length;
   return `<div class="rd-plan-show" data-rd-key="plan-show">${action('plan-show',`${draw('show')}<span>${S.picked?`Show ${shownN} of ${options.length}`:'Show'}</span>`,`aria-expanded="${!!ui.showOpen}" aria-haspopup="true"${ui.showOpen?' aria-controls="rd-plan-show-pop"':''}`,'rd-button rd-plan-tool rd-plan-show-btn')}${S.picked?action('plan-show-all',CROSS,'aria-label="Show everything" title="Show everything"','rd-plan-x'):''}${ui.showOpen?`<div class="rd-plan-pop" id="rd-plan-show-pop" role="group" aria-label="Show">${options.map(o=>action('plan-show-pick',`${mini(o)}<span>${E(o.name)}</span>`,`data-course="${E(o.key)}" aria-pressed="${!!S.picked&&S.picked.has(o.key)}" style="--rd-course:${E(o.color)}"`,'rd-plan-show-pick')).join('')}${action('plan-show-all','Everything',`aria-pressed="${!S.picked}"`,'rd-plan-show-every')}${action('plan-done',`${TICK}<span>Finished</span><span class="rd-n">${hiddenDone}</span>`,`aria-pressed="${!!ui.showDone}"`,'rd-plan-show-every rd-plan-done')}</div>`:''}</div>`;};
  const findings=()=>{
    const HP=root.ReserveHelpPlan;
    try{return HP?.weekCheck?HP.weekCheck(S.all,{now:c.now||Date.now(),zone:tz,items:c.items,toolbox:c.personal?.toolbox}):[];}catch{return [];}
  };
  const weekHTML=()=>{
    const list=findings().filter(f=>!(ui.check&&f.key===ui.check.key)),recent=ui.check&&ui.check.place==='week'&&Date.now()-ui.check.at<90000;
    if(!list.length&&!recent)return '';
   return `<div class="rd-plan-weekbox" data-rd-key="plan-weekbox">${action('plan-week-open',`${draw('steps')}<span>Your week</span><b>${list.length}</b>`,`aria-expanded="${!!ui.weekOpen}" aria-haspopup="true"${ui.weekOpen?' aria-controls="rd-plan-week-pop"':''}`,'rd-button rd-plan-tool rd-plan-week-btn')}${ui.weekOpen?`<div class="rd-plan-pop rd-plan-weekpop" id="rd-plan-week-pop" role="group" aria-label="Your week">${doneLine('week')}<ul class="rd-plan-findings">${list.map(f=>`<li class="rd-plan-finding" data-rd-key="adv-${E(f.key)}" data-advice-place="week"><p>${E(f.text)}</p><span class="rd-plan-advice">${f.action?action('plan-check-act',`${draw(f.action.type==='add'?'steps':'date')}<span>${E(f.action.label)}</span>`,`data-key="${E(f.key)}" aria-label="${E(f.text+' '+f.action.label)}"`,'rd-button rd-plan-check-act'):''}${action('plan-check-dismiss',CROSS,`data-key="${E(f.key)}" aria-label="${E('Dismiss: '+f.text)}" title="Dismiss"`,'rd-plan-x')}</span></li>`).join('')}</ul></div>`:''}</div>`;};
  const calHTML=()=>{
   const days=S.cal.days,first=days[0].key,last=days[days.length-1].key,y=today.slice(0,4);
   const mo=k=>fmt(k,{month:'long',...(k.slice(0,4)!==y||first.slice(0,4)!==last.slice(0,4)?{year:'numeric'}:{})});
   const months=first.slice(0,7)===last.slice(0,7)?mo(first):`${mo(first)} – ${mo(last)}`;
   // (4.2.14) two months have a short form for a narrower calendar ("Nov – Dec", "Dec – Jan ’27"): the title is never cut
   // and never pushes Week | Month off the page
   const ms=k=>fmt(k,{month:'short'})+(k.slice(0,4)!==y?' ’'+k.slice(2,4):''),monthsShort=first.slice(0,7)===last.slice(0,7)?months:`${ms(first)} – ${ms(last)}`;
   const focusKey=days.some(d=>d.key===S.day)?S.day:days.some(d=>d.key===today)?today:first;
   let weeks='';for(let r=0;r<S.F.rows;r++)weeks+=`<div class="rd-plan-wrow" role="row">${days.slice(r*7,r*7+7).map(d=>cellHTML(d,focusKey)).join('')}</div>`;
   const atToday=S.day===today&&S.start===P.mondayOf(today);
   // the days shown, in one quiet line: n of m done, x planned (4.0's line under the bar; "A clear week" when nothing is there)
   const tot=days.reduce((n,d)=>({open:n.open+d.open,done:n.done+d.done,minutes:n.minutes+d.minutes}),{open:0,done:0,minutes:0});
   const sub=tot.open+tot.done?`${tot.done} of ${tot.open+tot.done} done${tot.minutes?` · ${P.minutes(tot.minutes)} planned`:''}`:mode==='week'?'A clear week':'Clear weeks';
   return `<section class="rd-plan-cal" data-rd-key="plan-cal" aria-labelledby="rd-plan-cal-title"><header class="rd-plan-cal-head">${action('plan-cal-open',`${ARROW(-1)}<span>Day</span>`,`aria-label="${E('Back to '+long(S.day))}"`,'rd-button rd-plan-cal-back')}<h2 id="rd-plan-cal-title" class="rd-plan-months"${monthsShort!==months?` aria-label="${E(months)}"`:''}>${monthsShort!==months?`<span class="rd-plan-months-l">${E(months)}</span><span class="rd-plan-months-s" aria-hidden="true">${E(monthsShort)}</span>`:E(months)}</h2><div class="rd-plan-arrows" role="group" aria-label="Calendar">${action('plan-move',ARROW(-1),`data-delta="-1" aria-label="${mode==='week'?'Previous week':'Earlier weeks'}"`,'rd-button rd-plan-arrow')}${action('plan-today','Today',atToday?'aria-current="date"':'','rd-button rd-plan-now')}${action('plan-move',ARROW(1),`data-delta="1" aria-label="${mode==='week'?'Next week':'Later weeks'}"`,'rd-button rd-plan-arrow')}</div><p class="rd-plan-sub" data-rd-key="plan-sub"><i></i>${sub.split(' · ').flatMap((t,i)=>/ planned$/.test(t)?[(i?'· ':'')+t.slice(0,-8),'planned']:[(i?'· ':'')+t]).map(t=>`<span>${E(t)}</span>`).join(' ')}</p><div class="rd-plan-tools">${weekHTML()}${showHTML()}<div class="rd-plan-modes" role="radiogroup" aria-label="View" data-mode="${mode}">${action('plan-mode','Week',`role="radio" data-mode="week" aria-checked="${mode==='week'}"`,'rd-plan-mode')}${action('plan-mode','Month',`role="radio" data-mode="month" aria-checked="${mode==='month'}"`,'rd-plan-mode')}</div></div></header><div class="rd-plan-grid" role="grid" aria-labelledby="rd-plan-cal-title" aria-describedby="rd-plan-help" data-rows="${S.F.rows}" style="--rd-plan-rows:${S.F.rows}"><div class="rd-plan-names" role="row">${days.slice(0,7).map(d=>`<span role="columnheader" aria-label="${E(fmt(d.key,{weekday:'long'}))}">${E(fmt(d.key,{weekday:'short'}))}</span>`).join('')}</div>${weeks}</div></section>`;
  };
  // ---- the sheet: everything a task can have, one card over the page beside what was pressed
  const sheetHTML=e=>{
   const rec=c.local?.[e.id]||{},
     dr=ui.sheetDrafts?.[e.id]||{},
     own=!!e.personal&&/^local-[\w-]+$/.test(e.id),
     steps=(Array.isArray(rec.checklist)?rec.checklist:[]).filter(s=>s&&typeof s==='object'&&s.id),
     doneSteps=steps.filter(s=>s.done).length;
   const on=v=>` aria-pressed="${!!v}"`,CHIP='rd-chip rd-plan-pick';
   const row2=(label,body,cls='')=>`<div class="rd-plan-sheet-row${cls}"><span class="rd-plan-sheet-label">${label}</span>${body}</div>`;
   let sug='';try{sug=root.ReserveHelpPlan?.suggest?.(S.all,{now:c.now||Date.now(),zone:tz,ids:[e.id]})?.[e.id]||'';}catch{sug='';}
   const reps=[['','Once'],['day','Daily'],['weekdays','Weekdays'],['week','Weekly'],['month','Monthly']],
     wd=new Date(utc(e.planned||today)).getUTCDay(),
     repOn=k=>k===''?!e.repeat:k==='week'?e.repeat?.every==='week':e.repeat?.every===k;
   const dueTime=e.dueAt?hhmm(wall(e.dueAt,tz)):'';
   const due=own&&!e.repeat?row2('Due',`<div class="rd-plan-picks"><input type="date" class="rd-plan-field" data-rd-field="plan-sheet-due-day" data-id="${E(e.id)}" value="${E(e.dueDay||'')}" aria-label="Due day"><input type="time" class="rd-plan-field" data-rd-field="plan-sheet-due-time" data-id="${E(e.id)}" value="${E(dueTime)}" aria-label="Due time"${e.dueDay?'':' disabled'}></div>`):e.dueAt?row2('Due',`<p class="rd-plan-sheet-fixed${!e.done&&e.dueDay<today?' rd-plan-late':''}">${E(fmt(e.dueDay,{weekday:'short',month:'short',day:'numeric'})+' · '+dueAt(e))}</p>`):'';
   const course=own?row2('Goes with',`<select class="rd-plan-field" data-rd-field="plan-sheet-course" data-id="${E(e.id)}" aria-label="Goes with">${[['personal','Mine'],...(c.courses||[]).map(z=>[String(z.id),z.shortName||z.name||'Course'])].map(([v,l])=>`<option value="${E(v)}"${String(e.courseId)===v?' selected':''}>${E(l)}</option>`).join('')}</select>`):'';
   const marks=`${own?reps.map(([k,l])=>action('plan-repeat',l,`data-id="${E(e.id)}" data-every="${k}" data-wd="${wd}"${on(repOn(k))}`,CHIP)).join(''):''}${action('plan-priority','<b class="rd-plan-bang" aria-hidden="true">!</b> Important',`data-id="${E(e.id)}"${on(e.priority==='high')}`,CHIP)}${e.repeat?action('plan-repeat-skip','Skip this one',`data-id="${E(e.id)}"`,'rd-chip rd-plan-pick'):''}`;
   const stepRows=steps.map(s=>`<li class="rd-plan-step" data-rd-key="st-${E(s.id)}" data-done="${!!s.done}">${action('plan-step-toggle',TICK,`data-id="${E(e.id)}" data-step="${E(s.id)}" aria-pressed="${!!s.done}" aria-label="${E('Step done: '+s.text)}"`,'rd-plan-step-tick')}<input type="text" class="rd-plan-step-text" data-rd-field="plan-step-text" data-id="${E(e.id)}" data-step="${E(s.id)}" maxlength="300" value="${E(dr.steps?.[s.id]??s.text)}" aria-label="${E('Step: '+s.text)}">${action('plan-step-remove',CROSS,`data-id="${E(e.id)}" data-step="${E(s.id)}" aria-label="${E('Take out the step: '+s.text)}" title="${E('Take out the step: '+s.text)}"`,'rd-plan-x')}</li>`).join('');
   const pos=ui.sheetPos;
   return `<section class="rd-plan-sheet" id="rd-plan-sheet" role="dialog" data-rd-key="plan-sheet" data-id="${E(e.id)}" tabindex="-1" aria-label="${E(e.title)}"${pos?'':' data-placing="true"'} style="--rd-course:${color(e)}${pos?`;left:${pos.left}px;top:${pos.top}px;max-height:${pos.max}px`:''}">
<div class="rd-plan-sheet-top">${action('plan-view',`${draw('open')}<span>Open</span>`,`data-id="${E(e.id)}" aria-label="${E('Open '+e.title+' in the reader')}"`,'rd-text-button rd-plan-sheet-open')}${action('plan-sheet-close',CROSS,'aria-label="Close" title="Close"','rd-plan-x')}</div>
<div class="rd-plan-sheet-name-row">${own?`<input type="text" class="rd-plan-sheet-name" data-rd-field="plan-sheet-name" data-id="${E(e.id)}" maxlength="200" value="${E(dr.name??e.title)}" aria-label="Name">`:`<h2 class="rd-plan-sheet-title">${E(e.title)}</h2>`}</div>
${row2('Day',pickerHTML({id:e.id,planned:e.planned||'',today,month:ui.pickMonth?.[e.id]||'',suggested:sug,E,formatDate:h.formatDate,inline:true}))}
${row2('Time · Length',`<div class="rd-plan-picks"><input type="time" class="rd-plan-field" data-rd-field="plan-sheet-time" data-id="${E(e.id)}" value="${E(e.plannedTime||'')}" aria-label="Time"${e.planned?'':' disabled'}>${LENGTHS.map(n=>action('plan-estimate',E(len(n)),`data-id="${E(e.id)}" data-minutes="${e.estimate===n?0:n}" aria-label="${E(P.minutes(n))}"${on(e.estimate===n)}`,CHIP)).join('')}</div>`)}
${due}${course}${row2(own?'Repeats · Important':'Important',`<div class="rd-plan-picks">${marks}</div>`)}
${row2(`Steps${steps.length?` <b>${doneSteps}/${steps.length}</b>`:''}`,`<ul class="rd-plan-steps" aria-label="Steps">${stepRows}</ul>${steps.length<100?`<input type="text" class="rd-plan-step-new" data-rd-field="plan-step-new" data-id="${E(e.id)}" maxlength="300" placeholder="+ Add a step" aria-label="Add a step" value="${E(dr.newStep||'')}">`:''}`)}
${row2('Note',`<textarea class="rd-plan-field rd-plan-note" data-rd-field="plan-sheet-note" data-id="${E(e.id)}" maxlength="2000" rows="3" aria-label="Note">${E(dr.note??rec.notes??'')}</textarea>`)}
${own?`<div class="rd-plan-sheet-foot">${action('plan-delete','Delete',`data-id="${E(e.id)}" aria-label="${E('Delete '+e.title)}"`,'rd-text-button rd-plan-sheet-delete')}</div>`:''}</section>`;
  };
  return {pageHTML,calHTML,sheetHTML,homeHTML};
 }

 function render(c,h,ui={}){
  if(!enabled('planner')||!Plan()||!Widgets()?.plan)return '';
  const {E}=h,S=state(c,h,ui),K=kit(c,h,ui,S),sheetFor=ui.sheet?S.all.find(e=>e.id===ui.sheet)||null:null;
  return `<div class="rd-plan" data-rd-key="plan" data-mode="${S.mode}"${S.picked?' data-filtered="true"':''}${ui.calOpen?' data-cal="open"':''}>
<h1 class="rd-page-heading rd-plan-h1 rd-sr-only">Planner</h1><p class="rd-sr-only" id="rd-plan-help">${E(HELP)}</p><p class="rd-sr-only" aria-live="polite" data-rd-key="plan-say">${E(ui.say||'')}</p>
<div class="rd-plan-body" data-rd-key="plan-body">${K.pageHTML()}${K.calHTML()}</div>${sheetFor?K.sheetHTML(sheetFor):''}</div>`;
 }
 // Home's "My plan": the Planner's day page for today (its rows and its add line), the course chosen on Home kept
 function dayPage(c,h,ui={},{courseId=''}={}){
  if(!enabled('planner')||!Plan()||!Widgets()?.plan)return '';
  const scope={...ui,day:'',open:'',show:courseId&&courseId!=='all'?[String(courseId)]:null,height:0,listRoom:0,overdueOpen:false},S=state(c,h,scope);
  return kit(c,h,scope,S).homeHTML();
 }

 function create({container,store,save,rerender,getContext,helpers,view=()=>{},notePlan=null,noteDone=null,noteAdded=null}){
  if(!enabled('planner')||!Plan())return null;
  // Month or Week is remembered with the student's own data (toolbox.planner.view); saved data without it, or with 4.2.12's
  // "list" or 4.2's "day", opens on Month
  const ui={
    mode:store?.get?.()?.toolbox?.planner?.view==='week'?'week':'month',
    day:'',
    start:'',
    sheet:null,
    sheetPos:null,
    sheetFrom:'',
    overdueOpen:false,
    showOpen:false,
    weekOpen:false,
    calOpen:false,
    nodateMore:false,
    showDone:false,
    recent:new Map(),
    drafts:{},
    sheetDrafts:{},
    pickMonth:{},
    say:'',
    show:null,
    check:null,
    height:0,
    calHead:0,
    names:0,
    listRoom:0
  };
  let dead=false,drag=null,glide=null,readSay=0,picker=null,pop=null,observer=null,watched=null,measureFrame=0,lateMeasure=0;
  const keepPlanner=patch=>save(data=>{data.toolbox={...(data.toolbox||{}),planner:{...(data.toolbox?.planner||{}),...patch}};});
  const keepView=mode=>{const was=store?.get?.()?.toolbox?.planner?.view;if(was===mode)return;keepPlanner({view:mode});};
  const doc=container.ownerDocument||root.document,scope=()=>container.getRootNode?.()||doc,P=()=>Plan();
  const css=v=>root.CSS?.escape?root.CSS.escape(v):String(v).replace(/["\\]/g,'\\$&');
  const motion=()=>{
    const style=container?.dataset?.motionStyle;
    return !(style==='off'||style==='still'||container?.dataset?.featureMotion==='off'||root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  };
  const ease=()=>root.ReserveMotion?.easings?.settle||'cubic-bezier(.2,.8,.2,1)';
  const today=()=>{const c=getContext(),h=helpers();return h.dayKey(c.now||Date.now(),c.s.timeZone);};
  const say=text=>{ui.say=text;const n=container.querySelector('[data-rd-key="plan-say"]');if(n)n.textContent=text;};
  const cards=()=>[...container.querySelectorAll('.rd-plan .rd-plan-item[data-rd-key], .rd-plan .rd-plan-entry[data-rd-key], .rd-plan-home .rd-plan-item[data-rd-key]')];
  const stepId=()=>'step-'+(root.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`);
  const rows=()=>{const c=getContext();return fit({height:ui.height,calHead:ui.calHead||56,names:ui.names||26,mode:viewOf(ui,c)}).rows;};
  // ---- the Planner fills the window below its own top and never makes the page scroll: measured from the real layout on
  // every render, on a resize and when the heading above it changes size; the calendar's rows and the chips a day holds
  // follow from it (a new count redraws once; the same count never does)
  // (4.2.14) a short window. With FLOOR px or more under the heading (FLOOR_ONE where the page is one column) the Planner
  // is as tall as that room; it was never under 440, so a 1366 x 768 laptop scrolled. With less, it takes the whole
  // column instead and is brought into view once, when it opens or when the window gets that short: nobody has to
  // scroll to use it, and scrolling up shows the heading again.
  const FLOOR=340,FLOOR_ONE=440;let tuckFor=null,tucked=false,tuckAt=0;
  function measure(){
   if(dead)return;const plan=container.querySelector('.rd-plan'),body=plan?.querySelector?.(':scope > .rd-plan-body');if(!body||!plan.getClientRects?.().length)return;
   // (4.2.14) what scrolls the Planner: its own column, or, with the courses across the top, the shell round it (the
   // column does not scroll there; taken for the window, the Planner was sized past the shell's foot and scrolled a little)
   const scrolls=n=>/(auto|scroll)/.test(root.getComputedStyle?.(n)?.overflowY||'');
   const ws=plan.closest('.rd-workspace'),se=doc.scrollingElement||doc.documentElement,column=!!ws&&scrolls(ws);
   let box=column?ws:null;if(!box)for(let a=(ws||plan).parentElement;a;a=a.parentElement)if(scrolls(a)){box=a;break;}
   const own=!!box,scroller=own?box:se;if(!scroller)return;
   const br=body.getBoundingClientRect(),wr=own?box.getBoundingClientRect():null,docTop=se?.scrollTop||0;
   const top=br.top+(own?box.scrollTop:0)+docTop,bottom=own?wr.top+(box.clientTop||0)+box.clientHeight+docTop:(root.innerHeight||800);
   const host=column?ws:plan.parentElement,cs=root.getComputedStyle?.(host);
   let end=br.bottom;
   for(const n of host?.children||[]){
     if(n.matches?.('[data-rd-keep],.rd-sr-only,script,style'))continue;
     const r=n.getBoundingClientRect();
     if(!r.height&&!r.width)continue;
     const m=parseFloat(root.getComputedStyle?.(n)?.marginBottom)||0;
     end=Math.max(end,r.bottom+m);
   }
   // (what stands under the Planner's body: its own padding and margin, the rest of the column, the column's padding)
   const below=Math.max(0,end-br.bottom+(parseFloat(cs?.paddingBottom)||0)+(own?0:0));
   const set=v=>container.style?.setProperty?.('--rd-plan-h',v+'px');
   const floor=plan.getBoundingClientRect().width<760?FLOOR_ONE:FLOOR,roomH=Math.floor(bottom-top-below-4),tuck=roomH<floor;
   let H=tuck?Math.max(300,Math.floor((own?box.clientHeight:(root.innerHeight||800))-below-4)):roomH;set(H);
   const over=scroller.scrollHeight-scroller.clientHeight;if(!tuck&&over>0&&H>floor){H=Math.max(floor,H-over);set(H);}
   // (brought into view when it opens or the window gets that short, and again while the heading above it is still
   // finding its size, a scene's band loading; never once the student has scrolled away from where it was put)
   if(tuck){
     const now=own?box.scrollTop:docTop;
     if(tuckFor!==plan||!tucked||Math.abs(now-tuckAt)<2){
       const at=Math.max(0,Math.round(br.top-(own?wr.top+(box.clientTop||0):0)+now-2));
       try{if(own)box.scrollTop=at;else se.scrollTop=at;}catch{}
       tuckAt=own?box.scrollTop:(se.scrollTop||0);
     }
   }
   tuckFor=plan;tucked=tuck;
   const outer=n=>{
     if(!n)return 0;
     const s=root.getComputedStyle?.(n);
     return n.getBoundingClientRect().height+(parseFloat(s?.marginTop)||0)+(parseFloat(s?.marginBottom)||0);
   };
   const page=plan.querySelector('.rd-plan-page:not([data-view])');
   const before=JSON.stringify(key());ui.height=H;ui.calHead=Math.round(outer(plan.querySelector('.rd-plan-cal-head')))||56;ui.names=Math.round(outer(plan.querySelector('.rd-plan-names')))||26;
   // (4.2.14) the Overdue line counts by its own height: its top margin is "auto", the free room itself
   const od=page?.querySelector(':scope > .rd-plan-overdue');
   if(page)
     ui.listRoom=Math.max(
       0,
       Math.round(H-[':scope > .rd-plan-strip',':scope > .rd-plan-page-head',':scope > .rd-plan-add',':scope > .rd-plan-read'].reduce((n,s)=>n+outer(page.querySelector(s)),0)-(od?
         od.getBoundingClientRect().height:
         0)-28));
   if(JSON.stringify(key())!==before)rerender();
  }
  const key=()=>{
    const f=fit({height:ui.height,calHead:ui.calHead||56,names:ui.names||26,mode:viewOf(ui,getContext())});
    return [f.rows,f.chips,Math.floor((ui.listRoom||0)/44)];
  };
  const measureSoon=()=>{if(measureFrame||dead)return;measureFrame=(root.requestAnimationFrame||(f=>setTimeout(f,16)))(()=>{measureFrame=0;measure();});};
  function watch(plan){
   if(typeof root.ResizeObserver!=='function')return;const ws=plan.closest('.rd-workspace'),head=ws?.querySelector(':scope > .rd-workspace-heading')||container.querySelector('.rd-workspace-heading');
   if(watched&&watched[0]===ws&&watched[1]===head)return;
   observer?.disconnect();
   observer=new root.ResizeObserver(()=>measureSoon());
   for(const n of [ws,head])if(n)observer.observe(n);
   watched=[ws,head];
  }
  const onResize=()=>{measureSoon();if(picker)placeFloat(picker);if(pop)placeFloat(pop);};
  root.addEventListener?.('resize',onResize);
  // FLIP: where every row and chip stands before a change, then each glides from there to where the new render puts it
  // (transform only, the house settle, interruptible). A row that is new rises in place; with `from`, the dropped one
  // leaves from where the hand let it go.
  function flip({from=null,enter=''}={}){
   if(!motion()||typeof root.MutationObserver!=='function')return;
   const rects=new Map();for(const n of cards()){const r=n.getBoundingClientRect();if(r.width)rects.set(n.dataset.rdKey,r);}
   for(const a of glide||[])try{a.cancel();}catch{}glide=null;
   let done=false;const watchIt=new root.MutationObserver(()=>{if(done)return;done=true;watchIt.disconnect();const runs=[];
    for(const n of cards()){const k=n.dataset.rdKey,b=n.getBoundingClientRect();if(!b.width)continue;const a=k===from?.key?from.rect:rects.get(k);
     if(a){
       const dx=a.left-b.left,dy=a.top-b.top;
       if(Math.abs(dx)<.5&&Math.abs(dy)<.5)continue;
       if(Math.abs(dx)>900||Math.abs(dy)>700)continue;
       try{runs.push(n.animate([{transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`},{transform:'none'}],{duration:k===from?.key?260:220,easing:ease()}));}catch{}
     }
     else if(enter&&(k===enter||k.startsWith(enter+'@'))){try{runs.push(n.animate([{opacity:0,transform:'translateY(-5px)'},{opacity:1,transform:'none'}],{duration:240,easing:ease()}));}catch{}}}
    glide=runs;});
   watchIt.observe(container,{subtree:true,childList:true});root.setTimeout?.(()=>{done=true;watchIt.disconnect();},1500);
  }
  // the calendar slides by its rows; the day's list slides in from the side the day came from; a new view fades up
  function slide(dir){
    if(!motion())return;
    try{container.querySelector('.rd-plan-grid')?.animate([{opacity:.4,transform:`translateY(${dir*18}px)`},{opacity:1,transform:'none'}],{duration:240,easing:ease()});}catch{}
  }
  function turn(dir){
    if(!motion()||!dir)return;
    try{container.querySelector('.rd-plan-page .rd-plan-day-rows')?.animate([{opacity:.3,transform:`translateX(${dir*16}px)`},{opacity:1,transform:'none'}],{duration:220,easing:ease()});}catch{}
  }
  function fade(sel='.rd-plan-cal'){
    if(!motion())return;
    try{container.querySelector(sel)?.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:220,easing:ease()});}catch{}
  }
  const planList=()=>{const c=getContext(),h=helpers();return Widgets().plan({...c,__plan:null},h).list;},entry=id=>planList().find(e=>e.id===id);
  const dayWords=day=>{if(!day)return 'no day';const h=helpers();return day===today()?'today':h.formatDate(Date.parse(day+'T12:00:00Z'),'UTC',{weekday:'long',month:'short',day:'numeric'});};
  const focusAt=sel=>{const n=container.querySelector(sel);n?.focus?.({preventScroll:true});return !!n;};
  // the chosen day stays in the calendar: a day before its first row moves the calendar back to it, a day after its last
  // row moves it on so that day's week is the last row
  function keepInView(day){
    const M=P(),t=today(),n=rows(),start=ui.start&&M.validDay(ui.start)?M.mondayOf(ui.start):M.mondayOf(t),end=M.addDays(start,n*7-1);
    if(day<start)ui.start=M.mondayOf(day);else if(day>end)ui.start=M.addDays(M.mondayOf(day),-7*(n-1));else if(!ui.start)ui.start=start;
  }
  function choose(day,{focus=''}={}){
   const M=P();if(!M.validDay(day))return;const was=ui.day&&M.validDay(ui.day)?ui.day:today();
   ui.day=day;ui.overdueOpen=false;ui.nodateMore=false;ui.calOpen=false;keepInView(day);rerender();turn(day>was?1:day<was?-1:0);if(focus)focusAt(focus);
  }
  // moving a piece of work: to a day (or to no day), at a time when one is given, with the glide, said aloud, and written in
  // the dashboard's change note with its Undo (the time it had goes back with it)
  function move(id,day,{from=null,time,then=null}={}){
   const e=entry(id);if(!e)return;if((e.planned||'')===(day||'')&&(time===undefined||time===(e.plannedTime||''))){then?.();return;}
   const r=store?.get?.()?.tasks?.[id],previous={plannedDate:r?.plannedDate||'',...(r&&Object.hasOwn(r,'plannedTime')?{plannedTime:r.plannedTime}:{})};
   flip({from});
   save(P().plan(id,day||'',time||undefined)).then(ok=>{if(!ok||dead)return;say(`${e.title}: moved to ${dayWords(day)}${time?`, ${short12(time)}`:''}`);
    if(typeof notePlan==='function'){try{notePlan([{id,day:day||'',previous}]);}catch{}}then?.();});
  }
  const overdueNow=()=>{const c=getContext(),h=helpers();return state({...c,__plan:null},h,ui).overdue.filter(e=>!e.echo);};
  // several pieces of work given days at once (All to today): one save, said once, one Undo for all of it through the
  // dashboard's change note (in place, on the Overdue list, when there is no note)
  function planPairs(pairs,{then=null}={}){
   const data=store?.get?.()||{},before=pairs.map(([id,day])=>{
     const r=data.tasks?.[id];
     return {id,day,previous:{plannedDate:r?.plannedDate||'',...(r&&Object.hasOwn(r,'plannedTime')?{plannedTime:r.plannedTime}:{})}};
   }),first=entry(pairs[0]?.[0]);
   flip();save(P().planMany(pairs)).then(ok=>{if(!ok||dead)return;const n=pairs.length;
    say(n===1?`${first?.title||'Planned'}: planned for ${dayWords(pairs[0][1])}`:`Planned ${n}`);
    let noted=false;if(typeof notePlan==='function'){try{noted=notePlan(before)!==false;}catch{noted=false;}}
    if(!noted){
      ui.check={key:'plan:'+pairs.map(p=>p[0]).join(','),text:n===1?`Planned for ${dayWords(pairs[0][1])}.`:`Planned ${n}.`,undo:d=>{
        for(const x of before){
          const r=d.tasks?.[x.id];
          if(!r||r.plannedDate!==x.day)continue;
          r.plannedDate=x.previous.plannedDate;
          if(Object.hasOwn(x.previous,'plannedTime'))r.plannedTime=x.previous.plannedTime;else delete r.plannedTime;
        }
      },at:Date.now(),place:'overdue'};
      rerender();
    }
    then?.();});
  }
  // Tick all: every overdue thing marked done (as a tick does: checkedOff, never Canvas), one save, one note with its Undo
  // (a repeating task done as a whole goes on to its next day, as Archive on Home does it)
  function tickAll(){
   const ids=overdueNow().map(e=>e.id);
   if(!ids.length)return;
   const data=store?.get?.()||{},before=ids.map(id=>({id,had:Object.hasOwn(data.tasks?.[id]||{},'checkedOff'),previous:data.tasks?.[id]?.checkedOff}));
   flip();save(d=>{for(const id of ids)d.tasks[id]={...d.tasks[id],checkedOff:true};}).then(ok=>{if(!ok||dead)return;say(`${ids.length} marked done`);
    let noted=false;if(typeof noteDone==='function'){try{noted=noteDone(ids)!==false;}catch{noted=false;}}
    if(!noted){
      ui.check={key:'tick',text:`${ids.length} marked done.`,undo:d=>{
        for(const x of before){const r=d.tasks?.[x.id];if(!r)continue;if(x.had)r.checkedOff=x.previous;else delete r.checkedOff;}
      },at:Date.now(),place:'overdue'};
      rerender();
    }
    focusAt('#rd-plan-day-title');});
  }
  // ---- the sheet: one card over the page beside what was pressed; what is typed is kept as a draft (a redraw never loses
  // it) and saved when the field is left
  const draftOf=id=>ui.sheetDrafts[id]||(ui.sheetDrafts[id]={});
  function flushSheet(){
   const id=ui.sheet,d=id&&ui.sheetDrafts[id];if(!d)return null;delete ui.sheetDrafts[id];const e=entry(id),rec=store?.get?.()?.tasks?.[id]||{},M=P(),changes=[];
   if(d.name!==undefined&&e?.personal&&d.name.trim()&&d.name.trim()!==e.title)changes.push(M.rename(id,d.name));
   if(d.note!==undefined&&d.note!==(rec.notes||''))changes.push(M.setNote(id,d.note));
   for(const [sid,t] of Object.entries(d.steps||{}))if(String(t).trim())changes.push(M.setStep(id,sid,{text:t}));
   if(d.newStep&&d.newStep.trim())changes.push(M.addStep(id,d.newStep,stepId()));
   return changes.length?save(data=>{for(const ch of changes)ch(data);}):null;
  }
  // what was pressed, found again after a redraw: the row on the page, the chip on its day, or the due mark
  const anchorOf=()=>ui.sheetFrom?container.querySelector(ui.sheetFrom):null;
  const fromOf=button=>{
    const chip=button.closest?.('.rd-plan-entry[data-rd-key]'),row=button.closest?.('.rd-plan-item[data-rd-key]');
    return chip?`.rd-plan .rd-plan-entry[data-rd-key="${css(chip.dataset.rdKey)}"]`:row?`.rd-plan .rd-plan-item[data-rd-key="${css(row.dataset.rdKey)}"]`:button.dataset?.rdKey?`.rd-plan [data-rd-key="${css(button.dataset.rdKey)}"]`:'';
  };
  let sheetOutside=null;
  function watchSheet(on){
    if(on&&!sheetOutside){
      sheetOutside=event=>{
        if(!ui.sheet)return;
        const path=event.composedPath?.()||[];
        if(path.some(n=>n?.classList?.contains?.('rd-plan-sheet')||n?.dataset?.rdAction==='plan-sheet'&&n.dataset.id===ui.sheet||n?.classList?.contains?.('rd-note')))return;
        closeSheet({focus:false});
      };
      doc.addEventListener('pointerdown',sheetOutside,true);
    }
    else if(!on&&sheetOutside){doc.removeEventListener('pointerdown',sheetOutside,true);sheetOutside=null;}
  }
  function openSheet(id,button){
   if(ui.sheet&&ui.sheet!==id)flushSheet();
   watchSheet(true);
   const was=!!ui.sheet;
   ui.sheet=id;
   ui.sheetPos=null;
   ui.sheetFrom=button?fromOf(button):'';
   ui.showOpen=false;
   ui.weekOpen=false;
   rerender();
   placeSheet();
   const sheet=container.querySelector('#rd-plan-sheet');
   if(!was&&motion())try{sheet?.animate([{opacity:0,transform:'translateY(4px) scale(.985)'},{opacity:1,transform:'none'}],{duration:200,easing:ease()});}catch{}
   sheet?.focus?.({preventScroll:true});
  }
  function closeSheet({focus=true}={}){
   if(!ui.sheet)return false;const id=ui.sheet,from=ui.sheetFrom;flushSheet();ui.sheet=null;ui.sheetPos=null;watchSheet(false);rerender();
   if(focus){
     const a=from?container.querySelector(from):null;
     (a?.matches?.('[data-rd-action]')?a:a?.querySelector?.('.rd-plan-title, .rd-plan-eopen')||container.querySelector(`.rd-plan [data-plan-id="${css(id)}"] :is(.rd-plan-title,.rd-plan-eopen)`))?.focus?.({
       preventScroll:true
     });
   }
   return true;
  }
  // beside what was pressed (right of it when there is room, else left), never off the screen, its own scroll when the
  // window is short; placed once, so a redraw keeps it where it is
  function placeSheet(){
   const plan=container.querySelector('.rd-plan'),sheet=plan?.querySelector?.(':scope > .rd-plan-sheet');if(!sheet||ui.sheetPos&&!sheet.hasAttribute('data-placing'))return;
   const p=plan.getBoundingClientRect(),
     ws=plan.closest('.rd-workspace')?.getBoundingClientRect(),
     vw=root.innerWidth||1280,
     vh=root.innerHeight||800,
     a=anchorOf()?.getBoundingClientRect?.();
   const lo={top:Math.max(8,ws?ws.top+6:8),bottom:Math.min(vh-8,ws&&ws.bottom>200?ws.bottom-6:vh-8),left:8,right:vw-8},maxH=Math.max(200,Math.round(lo.bottom-lo.top));
   sheet.style.maxHeight=maxH+'px';const w=Math.min(sheet.offsetWidth||420,lo.right-lo.left),hgt=Math.min(sheet.offsetHeight||480,maxH);
   let x,y;if(a&&a.width){x=a.right+14+w<=lo.right?a.right+14:a.left-14-w>=lo.left?a.left-14-w:a.left+(a.width-w)/2;y=a.top-28;}else{x=p.left+(p.width-w)/2;y=lo.top+24;}
   x=Math.max(lo.left,Math.min(lo.right-w,x));y=Math.max(lo.top,Math.min(lo.bottom-hgt,y));
   ui.sheetPos={left:Math.round(x-p.left),top:Math.round(y-p.top),max:maxH};
   sheet.style.left=ui.sheetPos.left+'px';
   sheet.style.top=ui.sheetPos.top+'px';
   sheet.removeAttribute('data-placing');
  }
  function addStepFrom(field){const id=field.dataset.id,v=String(field.value||'').trim();if(!id||!v)return;const d=draftOf(id);d.newStep='';field.value='';
   save(P().addStep(id,v,stepId())).then(ok=>{if(dead)return;if(ok){say(`Step added: ${v}`);focusAt(`[data-rd-field="plan-step-new"][data-id="${css(id)}"]`);}else field.value=v;});}
  // ---- floating cards: the day picker beside a day button (anywhere on the dashboard) and the top bar's "Add a task".
  // Each is one node of its own over the page (kept across the dashboard's redraws), placed by what opened it.
  function float(cls,label){
    const n=doc.createElement('div');
    n.className=cls;
    n.setAttribute('data-rd-keep','');
    n.setAttribute('role','dialog');
    n.setAttribute('aria-label',label);
    container.append(n);
    return n;
  }
  function placeFloat(f){
   const n=f?.node;if(!n)return;const a=f.anchor?.()?.getBoundingClientRect?.(),vw=root.innerWidth||1280,vh=root.innerHeight||800,w=n.offsetWidth||300,hh=n.offsetHeight||300;
   if(f.anchorRequired&&!(a&&a.width)){f.close?.(false);return;}
   let x=a&&a.width?a.right-w:(vw-w)/2,y=a&&a.width?a.bottom+6:Math.max(64,vh*.14);if(a&&a.width&&y+hh>vh-8&&a.top-6-hh>=8)y=a.top-6-hh;
   n.style.left=Math.round(Math.max(8,Math.min(vw-w-8,x)))+'px';n.style.top=Math.round(Math.max(8,Math.min(vh-hh-8,y)))+'px';
  }
  const outsideOf=f=>event=>{if(!f.node||event.composedPath?.().some(x=>x===f.node||f.anchor?.()===x))return;f.close(false);};
  function openPicker(button){
   const id=button?.dataset?.id;if(!id)return;if(picker&&picker.id===id){closePicker(true);return;}closePicker(false);const e=entry(id);if(!e)return;
   const where=button.closest?.('[data-rd-key]')?.dataset?.rdKey||'',
     find=()=>(where&&container.querySelector(`[data-rd-key="${css(where)}"] [data-rd-action="plan-pick"][data-id="${css(id)}"]`))||container.querySelector(`[data-rd-action="plan-pick"][data-id="${css(id)}"]`);
   const node=float('rd-plan-picker',`Day for ${e.title}`);picker={node,id,month:'',anchor:find,anchorRequired:true,close:closePicker};paintPicker();
   button.setAttribute('aria-expanded','true');
   placeFloat(picker);
   if(motion())try{node.animate([{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'none'}],{duration:160,easing:ease()});}catch{}
   (node.querySelector('.rd-plan-pick[aria-pressed="true"]')||node.querySelector('.rd-plan-pick'))?.focus?.({preventScroll:true});
   picker.outside=outsideOf(picker);doc.addEventListener('pointerdown',picker.outside,true);
  }
  function paintPicker(){
    if(!picker)return;
    const c=getContext(),h=helpers(),e=entry(picker.id);
    if(!e){closePicker(false);return;}
    let sug='';
    try{sug=root.ReserveHelpPlan?.suggest?.(planList(),{now:c.now||Date.now(),zone:c.s?.timeZone,ids:[e.id]})?.[e.id]||'';}catch{}
   picker.node.innerHTML=`<p class="rd-plan-picker-title">${h.E(e.title)}</p>`+pickerHTML({id:e.id,planned:e.planned||'',today:today(),month:picker.month,suggested:sug,E:h.E,formatDate:h.formatDate});}
  function closePicker(focus=true){
    if(!picker)return;
    const p=picker;
    picker=null;
    doc.removeEventListener('pointerdown',p.outside,true);
    p.node.remove();
    const b=p.anchor?.();
    b?.setAttribute?.('aria-expanded','false');
    if(focus)b?.focus?.({preventScroll:true});
  }
  function openAdd(button=null){
   if(pop){closeAdd(true);return;}const c=getContext(),h=helpers(),t=today(),back=scope().activeElement||null;
   const node=float('rd-plan-addpop','Add a task');pop={node,anchor:()=>container.querySelector('[data-rd-action="plan-add-pop"]'),back,close:closeAdd};
   node.innerHTML=addLine(c,h,ui,{day:t,at:'pop',list:planList(),keys:false});placeFloat(pop);pop.anchor()?.setAttribute?.('aria-expanded','true');
   if(motion())try{node.animate([{opacity:0,transform:'translateY(-4px)'},{opacity:1,transform:'none'}],{duration:160,easing:ease()});}catch{}
   node.querySelector('input')?.focus?.({preventScroll:true});pop.outside=outsideOf(pop);doc.addEventListener('pointerdown',pop.outside,true);
  }
  function closeAdd(focus=true){
    if(!pop)return;
    const p=pop;
    pop=null;
    doc.removeEventListener('pointerdown',p.outside,true);
    p.node.remove();
    ui.drafts.pop={text:'',ignore:[]};
    const b=p.anchor?.();
    b?.setAttribute?.('aria-expanded','false');
    if(focus)(p.back?.isConnected?p.back:b)?.focus?.({preventScroll:true});
  }
  // ---- the add lines: what was typed, how it was read, and the words taken back (one draft a place)
  const draft=key=>ui.drafts[key]||(ui.drafts[key]={text:'',ignore:[]});
  function paintReading(field){
   const key=field.dataset.at||'',day=field.dataset.day||'',d=draft(key),c=getContext(),h=helpers(),line=container.querySelector(`.rd-plan-read[data-for="${key}"]`);if(!line)return;
   const r=d.text.trim()?
     reading(d.text,{today:today(),now:nowMinute(c),courses:c.courses,ignore:d.ignore,tz:c.s.timeZone,formatDate:h.formatDate,fieldDay:day,list:planList}):
     {chips:[]};
   // keyed by kind: a tag that stays is only updated, a new one pops in, so typing never makes the line flicker
   const have=new Map([...line.querySelectorAll('.rd-plan-chip')].map(n=>[n.dataset.kind+(n.dataset.quiet?'q':''),n])),tmp=doc.createElement('div');
   let prev=null;for(const chip of r.chips){const k=chip.kind+(chip.quiet?'q':'');tmp.innerHTML=chipHTML(chip,key);const next=tmp.firstElementChild,old=have.get(k);
    if(old){
      have.delete(k);
      if(old.outerHTML!==next.outerHTML){old.replaceWith(next);}
      else{if(prev?prev.nextElementSibling!==old:line.firstElementChild!==old)prev?prev.after(old):line.prepend(old);prev=old;continue;}
    }
    else next.dataset.pop='true';
    if(prev)prev.after(next);else line.prepend(next);prev=next;}
   for(const n of have.values())n.remove();
   clearTimeout(readSay);
   readSay=setTimeout(()=>{
     readSay=0;
     if(dead)return;
     const words=[...line.querySelectorAll('.rd-plan-chip:not([data-off]) > span')].map(n=>n.textContent.trim()).filter(Boolean).join(', ');
     if(words&&field.value.trim())say('Understood: '+words);
   },1000);/* (a11y-42) said once the typing pauses: the line is no live region any more */
   if(pop&&pop.node.contains(field))placeFloat(pop);
  }
  function input(event){
   const field=event.target,name=field?.dataset?.rdField;
   if(name==='plan-quick'){const d=draft(field.dataset.at||'');d.text=field.value.slice(0,200);if(!d.text.trim())d.ignore=[];paintReading(field);return true;}
   const id=field?.dataset?.id;if(!id||!String(name||'').startsWith('plan-'))return false;
   const d=draftOf(id);
   if(name==='plan-sheet-name')d.name=field.value.slice(0,200);
   else if(name==='plan-sheet-note')d.note=field.value.slice(0,Math.max(2000,String(store?.get?.()?.tasks?.[id]?.notes||'').length));
   else if(name==='plan-step-new')d.newStep=field.value.slice(0,300);
   else if(name==='plan-step-text')(d.steps||(d.steps={}))[field.dataset.step]=field.value.slice(0,300);
   return true;
  }
  // a sheet's field left (or Enter): saved; a time, a deadline or a course chosen: saved at once
  function change(event){
   const f=event.target,name=f?.dataset?.rdField;if(!String(name||'').startsWith('plan-')||name==='plan-quick')return false;const id=f.dataset.id;if(!id)return false;
   const M=P(),e=entry(id),d=ui.sheetDrafts[id],zone=getContext().s?.timeZone;
   if(name==='plan-sheet-name'){
     if(d)delete d.name;
     const v=String(f.value||'').replace(/\s+/g,' ').trim();
     if(!e)return true;
     if(!v||v===e.title){f.value=e.title;return true;}
     save(M.rename(id,v)).then(ok=>{if(ok&&!dead)say(`Renamed: ${v}`);});
     return true;
   }
   if(name==='plan-sheet-note'){
     if(d)delete d.note;
     if(String(f.value)===String(store?.get?.()?.tasks?.[id]?.notes||''))return true;
     save(M.setNote(id,f.value)).then(ok=>{if(ok&&!dead)say('Note saved');});
     return true;
   }
   if(name==='plan-step-text'){
     const sid=f.dataset.step;
     if(d?.steps)delete d.steps[sid];
     const v=String(f.value||'').trim();
     if(v)save(M.setStep(id,sid,{text:v}));else{const s=store?.get?.()?.tasks?.[id]?.checklist?.find?.(z=>z?.id===sid);if(s)f.value=s.text;}
     return true;
   }
   if(name==='plan-step-new')return true;
   if(name==='plan-sheet-time'){
     if(!e?.planned)return true;
     const v=/^([01]\d|2[0-3]):[0-5]\d$/.test(f.value||'')?f.value:'';
     save(M.plan(id,e.planned,v)).then(ok=>{if(ok&&!dead)say(v?`${e.title}: ${short12(v)}`:`${e.title}: no time`);});
     return true;
   }
   if(name==='plan-sheet-due-day'||name==='plan-sheet-due-time'){
     const sheet=f.closest?.('.rd-plan-sheet'),
       day=sheet?.querySelector?.('[data-rd-field="plan-sheet-due-day"]')?.value??(name==='plan-sheet-due-day'?f.value:e?.dueDay||''),
       time=sheet?.querySelector?.('[data-rd-field="plan-sheet-due-time"]')?.value??'';
    save(M.setDue(id,day,time,zone)).then(ok=>{if(ok&&!dead){say(day?`Due ${dayWords(day)}${time?', '+short12(time):''}`:'No due date');focusAt(`[data-rd-field="${name}"]`);}});return true;}
   if(name==='plan-sheet-course'){save(M.setCourse(id,f.value)).then(ok=>{if(ok&&!dead)focusAt('[data-rd-field="plan-sheet-course"]');});return true;}
   return false;
  }
  // The parse a quick add will save (Enter or Add): the typed words with the tags taken back left as words.
  function read(field){
   const key=field?.dataset?.at||'',d=draft(key),text=field?.value??d.text,c=getContext();
   if(!String(text||'').trim())return null;
   return reading(text,{
     today:today(),
     now:nowMinute(c),
     courses:c.courses,
     ignore:d.ignore,
     tz:c.s.timeZone,
     formatDate:helpers().formatDate,
     fieldDay:field?.dataset?.day||'',
     list:planList
   }).parsed;
  }
  function adding(field,id){
    clearTimeout(readSay);
    readSay=0;
    const key=field?.dataset?.at||'';
    ui.drafts[key]={text:'',ignore:[]};
    const line=container.querySelector(`.rd-plan-read[data-for="${key}"]`);
    if(line)line.textContent='';
    flip({enter:`pi-${id}`});
  }
  // (added from the top bar's card: the change note says where it went, with its Undo, and the card closes)
  function added(id,at=''){const e=entry(id);if(e)say(`Added: ${e.title}`);if(at!=='pop'||!pop)return true;
   if(e&&typeof noteAdded==='function'){try{noteAdded([{id,day:e.planned||''}]);}catch{}}closeAdd(true);return false;}
  function click(event){
   const target=event.target,button=target?.closest?.('[data-rd-action]');
   // a press anywhere else closes what is open: Show, Your week, the sheet
   if(ui.showOpen&&!target?.closest?.('.rd-plan-show')){ui.showOpen=false;rerender();}
   if(ui.weekOpen&&!target?.closest?.('.rd-plan-weekbox')){ui.weekOpen=false;rerender();}
   if(ui.sheet&&!target?.closest?.('.rd-plan-sheet')&&button?.dataset?.rdAction!=='plan-sheet')closeSheet({focus:false});
   if(dead)return false;
   if(!button){
    // the empty part of a day in the calendar chooses it
    const cell=target?.closest?.('.rd-plan-cell');if(cell&&container.contains(cell)){choose(cell.dataset.day);return true;}
    return false;
   }
   const action=button.dataset.rdAction,id=button.dataset.id,M=P();
   if(action==='plan-step'){
     const t=today(),base=ui.day&&M.validDay(ui.day)?ui.day:t,next=M.addDays(base,Number(button.dataset.delta)||0);
     if(Math.abs(M.between(t,next))<=366)choose(next,{focus:`[data-rd-action="plan-step"][data-delta="${button.dataset.delta}"]`});
     return true;
   }
   if(action==='plan-move'){
     const delta=Number(button.dataset.delta||0),
       t=today(),
       n=viewOf(ui,getContext())==='week'?7:28,
       start=ui.start&&M.validDay(ui.start)?M.mondayOf(ui.start):M.mondayOf(t),
       next=M.addDays(start,n*delta);
     if(Math.abs(M.between(t,next))<=7*60){ui.start=next;rerender();slide(delta);}
     return true;
   }
   if(action==='plan-today'){const t=today(),was=ui.day||t;ui.start='';ui.day=t;ui.overdueOpen=false;rerender();turn(t>was?1:t<was?-1:0);return true;}
   if(action==='plan-mode'){
     const mode=button.dataset.mode==='week'?'week':'month',now=viewOf(ui,getContext());
     if(now===mode&&ui.mode===mode)return true;
     ui.mode=mode;
     ui.start='';
     keepInView(ui.day||today());
     keepView(mode);
     rerender();
     fade('.rd-plan-grid');
     focusAt(`.rd-plan-mode[data-mode="${mode}"]`);
     return true;
   }
   if(action==='plan-choose'){
     const day=button.dataset.day;
     if(!M.validDay(day))return true;
     choose(day,{focus:button.classList.contains('rd-plan-sday')?`.rd-plan-sday[data-day="${day}"]`:'#rd-plan-day-title'});
     return true;
   }
   if(action==='plan-add-on'){const day=button.dataset.day;if(!M.validDay(day))return true;choose(day,{focus:'.rd-plan-page [data-rd-field="plan-quick"]'});return true;}
   if(action==='plan-cal-open'){ui.calOpen=!ui.calOpen;rerender();if(ui.calOpen){fade();focusAt('.rd-plan-cell[tabindex="0"]');}else focusAt('.rd-plan-cal-open');return true;}
   if(action==='plan-overdue'){ui.overdueOpen=true;flushSheet();ui.sheet=null;rerender();fade('.rd-plan-page');focusAt('#rd-plan-day-title');return true;}
   if(action==='plan-overdue-back'){ui.overdueOpen=false;rerender();fade('.rd-plan-page');focusAt('.rd-plan-overdue')||focusAt('#rd-plan-day-title');return true;}
   if(action==='plan-overdue-today'){const t=today(),pairs=overdueNow().map(e=>[e.id,t]);if(pairs.length)planPairs(pairs,{then:()=>focusAt('#rd-plan-day-title')});return true;}
   if(action==='plan-overdue-tick'){tickAll();return true;}
   if(action==='plan-more'){ui.nodateMore=button.dataset.fold!=='close';flip();rerender();return true;}
   if(action==='plan-done'){ui.showDone=!ui.showDone;flip();rerender();focusAt('.rd-plan-done');return true;}
   if(action==='plan-chip'){const key=button.dataset.fieldDay||'',d=draft(key),kind=button.dataset.kind;if(!KINDS.includes(kind))return true;
    // a guess goes to its other reading, the other reading is taken back, a word taken back is read again
    const alt='alt-'+kind;
    d.ignore=button.dataset.alt==='true'?
      [...d.ignore.filter(k=>k!==kind),alt]:
      d.ignore.includes(alt)?[...d.ignore.filter(k=>k!==alt),kind]:d.ignore.includes(kind)?d.ignore.filter(k=>k!==kind):[...d.ignore,kind];
    const field=container.querySelector(`[data-rd-field="plan-quick"][data-at="${key}"]`);if(field){paintReading(field);field.focus({preventScroll:true});}return true;}
   if(action==='check-off'||action==='undo-check-off'){const card=button.closest?.('[data-plan-id]');if(card){ui.recent.set(card.dataset.planId,Date.now());flip();}
    // a repeating task ticked anywhere on the page (Home's list too) moves on to its next day instead of ending
    const e=id&&entry(String(id));
    if(e?.repeat&&(action==='check-off'||!e.done)){ui.recent.set(e.id,Date.now());save(action==='check-off'?M.complete(e.id,today()):M.uncomplete(e.id));return true;}
    return false;
   }
   if(action==='plan-repeat-done'||action==='plan-repeat-undo'){
     ui.recent.set(id,Date.now());
     flip();
     const e=entry(id);
     save(action==='plan-repeat-done'?M.complete(id,today()):M.uncomplete(id)).then(ok=>{
       if(ok&&e)say(action==='plan-repeat-done'?`${e.title}: done for ${e.planned===today()?'today':'that day'}`:`${e.title}: put back`);
     });
     return true;
   }
   if(action==='plan-repeat-skip'){flip();save(M.complete(id,today(),{skip:true}));return true;}
   if(action==='plan-repeat'){
     const every=button.dataset.every,wd=Number(button.dataset.wd);
     save(M.setRepeat(id,every?{every,days:[Number.isInteger(wd)?wd:1]}:null,today()));
     return true;
   }
   if(action==='plan-priority'){const e=entry(id);save(M.priority(id,e?.priority==='high'?'':'high'));return true;}
   if(action==='plan-estimate'){save(M.estimate(id,Number(button.dataset.minutes)||0));return true;}
   if(action==='plan-delete'&&/^local-[\w-]+$/.test(id||'')){
     const e=entry(id);
     if(ui.sheet===id){delete ui.sheetDrafts[id];ui.sheet=null;ui.sheetPos=null;}
     flip();
     save(M.remove(id)).then(ok=>{if(!ok||dead)return;say(`Deleted: ${e?.title||'task'}`);focusAt('.rd-plan-page [data-rd-field="plan-quick"]');});
     return true;
   }
   if(action==='plan-view'){view(id);return true;}
   // the sheet: opened by pressing a task (or Enter on it), closed with its cross, Escape or a press outside it
   if(action==='plan-sheet'){if(!id)return true;if(ui.sheet===id&&fromOf(button)===ui.sheetFrom){closeSheet();return true;}openSheet(id,button);return true;}
   if(action==='plan-sheet-close'){closeSheet();return true;}
   if(action==='plan-step-toggle'){const pressed=button.getAttribute?.('aria-pressed')==='true';save(M.setStep(id,button.dataset.step,{done:!pressed}));return true;}
   if(action==='plan-step-remove'){
     const sid=button.dataset.step,d=ui.sheetDrafts[id];
     if(d?.steps)delete d.steps[sid];
     save(M.removeStep(id,sid)).then(ok=>{if(ok&&!dead)focusAt(`[data-rd-field="plan-step-new"][data-id="${css(id)}"]`);});
     return true;
   }
   // the day button anywhere, and the picker it opens (or the sheet's own Day row): a day, None, another month
   if(action==='plan-pick'){openPicker(button);return true;}
   if(action==='plan-pick-day'){
     const day=button.dataset.day||'';
     if(day&&!M.validDay(day)||!id)return true;
     const inSheet=!!button.closest?.('.rd-plan-sheet'),fromPicker=!!picker&&picker.node.contains(button);
    if(fromPicker)closePicker(false);
    move(id,day,{then:()=>{
      if(inSheet)
        focusAt(`.rd-plan-sheet [data-rd-action="plan-pick-day"][data-day="${day}"]`);
      else if(fromPicker){(container.querySelector(`[data-rd-action="plan-pick"][data-id="${css(id)}"]`))?.focus?.({preventScroll:true});}
    }});
    return true;
   }
   if(action==='plan-pick-month'){
     const m=String(button.dataset.month||''),delta=Number(button.dataset.delta)||0;
     if(!/^\d{4}-\d{2}$/.test(m)||!id)return true;
     const next=M.addMonths(m+'-01',delta).slice(0,7);
    if(picker&&picker.node.contains(button)){picker.month=next;paintPicker();placeFloat(picker);focusAt(`.rd-plan-picker [data-rd-action="plan-pick-month"][data-delta="${delta}"]`);}
    else{ui.pickMonth={...ui.pickMonth,[id]:next};rerender();focusAt(`.rd-plan-sheet [data-rd-action="plan-pick-month"][data-delta="${delta}"]`);}
    return true;
   }
   if(action==='plan-add-pop'){openAdd(button);return true;}
   // Show: the courses as toggles, Mine, Everything and Finished; not saved
   if(action==='plan-show'){
     ui.showOpen=!ui.showOpen;
     ui.weekOpen=false;
     rerender();
     if(ui.showOpen)focusAt('.rd-plan-show .rd-plan-pop [aria-pressed="true"], .rd-plan-show .rd-plan-pop button');
     return true;
   }
   if(action==='plan-show-pick'){
     const key=String(button.dataset.course||'');
     if(!key)return true;
     const set=new Set(ui.show||[]);
     if(set.has(key))set.delete(key);else set.add(key);
     ui.show=set.size?[...set]:null;
     ui.showOpen=true;
     flip();
     rerender();
     focusAt(`.rd-plan-show-pick[data-course="${css(key)}"]`);
     const n=set.size;
     say(n?`Showing ${n} of the courses`:'Showing everything');
     return true;
   }
   if(action==='plan-show-all'){const wasOpen=ui.showOpen;ui.show=null;flip();rerender();say('Showing everything');focusAt(wasOpen?'.rd-plan-show-every':'.rd-plan-show-btn');return true;}
   // Your week: behind its one button; a finding's action or Dismiss, worked out again from the data as it is now; Undo puts
   // back exactly that (on the page's own clock, c.now, the one the findings were drawn with)
   if(action==='plan-week-open'){ui.weekOpen=!ui.weekOpen;ui.showOpen=false;rerender();if(ui.weekOpen)focusAt('.rd-plan-weekpop button');return true;}
   if(action==='plan-check-act'||action==='plan-check-dismiss'){
    const HP=root.ReserveHelpPlan;
    if(!HP)return true;
    const c=getContext(),h=helpers(),zone=c.s.timeZone,now=c.now||Date.now(),{list}=Widgets().plan({...c,__plan:null},h);
    const f=HP.weekCheck(list,{now,zone,items:c.items,toolbox:store?.get?.()?.toolbox}).find(z=>z.key===button.dataset.key);if(!f){rerender();return true;}
    const doing=action==='plan-check-act',a=doing?HP.act(f,{now,zone,id:newId()}):HP.dismiss(f,{now,zone});if(!a.change)return true;if(doing)flip();
    save(a.change).then(ok=>{
      if(!ok||dead)return;
      ui.check={key:f.key,text:doing?f.action.done:'Dismissed.',undo:a.undo,at:Date.now(),place:'week'};
      ui.weekOpen=true;
      say(ui.check.text);
      rerender();
      focusAt('[data-rd-key="adv-done"] [data-rd-action="plan-check-undo"]');
    });
    return true;
   }
   if(action==='plan-check-undo'){
     const u=ui.check;
     ui.check=null;
     if(u?.undo){flip();save(u.undo).then(ok=>{if(ok&&!dead){say('Undone.');focusAt(u.place==='week'?'.rd-plan-week-btn':'#rd-plan-day-title');}});}else rerender();
     return true;
   }
   return false;
  }
  function keydown(event){
   const target=event.composedPath?.()[0]||event.target,
     typing=target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||''),
     field=target?.dataset?.rdField,
     plan=container.querySelector('.rd-plan');
   const bare=!event.ctrlKey&&!event.metaKey&&!event.altKey;
   if(event.key==='Escape'){
    if(picker){event.preventDefault();closePicker(true);return true;}
    if(ui.showOpen||ui.weekOpen){event.preventDefault();const which=ui.showOpen?'.rd-plan-show-btn':'.rd-plan-week-btn';ui.showOpen=false;ui.weekOpen=false;rerender();focusAt(which);return true;}
    if(typing&&field==='plan-quick'&&target.value){event.preventDefault();target.value='';const d=draft(target.dataset.at||'');d.text='';d.ignore=[];paintReading(target);return true;}
    if(pop){event.preventDefault();closeAdd(true);return true;}
    if(ui.sheet&&(!typing||target?.closest?.('.rd-plan-sheet'))){event.preventDefault();closeSheet();return true;}
    if(plan&&ui.calOpen&&!typing){event.preventDefault();ui.calOpen=false;rerender();focusAt('.rd-plan-cal-open');return true;}
    if(plan&&ui.overdueOpen&&!typing){event.preventDefault();ui.overdueOpen=false;rerender();focusAt('.rd-plan-overdue');return true;}
    return false;
   }
   // n (and / on the Planner): to the add line; n on any other tab opens the top bar's "Add a task" card
   if(!typing&&bare&&!event.shiftKey&&(event.key==='n'||event.key==='/'&&plan)){
    if(plan){
      const q=container.querySelector('.rd-plan-page:not([data-view]) [data-rd-field="plan-quick"]');
      if(ui.overdueOpen&&!q){ui.overdueOpen=false;rerender();}
      const f=container.querySelector('.rd-plan-page [data-rd-field="plan-quick"]');
      if(f){event.preventDefault();f.focus();f.select?.();return true;}
      return false;
    }
    if(container.dataset.chRoom||container.querySelector('.gi-room:not([data-gi-away]), [data-review-deck]')||target?.closest?.('[role="dialog"],[role="menu"]'))return false;
    event.preventDefault();openAdd();return true;
   }
   if(event.key==='Enter'&&typing&&field==='plan-step-new'){event.preventDefault();addStepFrom(target);return true;}
   if(event.key==='Enter'&&typing&&(field==='plan-sheet-name'||field==='plan-step-text')){event.preventDefault();change({target});return true;}
   // the picker's small month: the arrows walk its days
   const mday=target?.closest?.('.rd-plan-mday');
   if(mday&&bare&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
     const all=[...mday.parentElement.querySelectorAll('.rd-plan-mday')],i=all.indexOf(mday),n=all[i+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7})[event.key]];
     if(n){event.preventDefault();for(const b of all)b.tabIndex=b===n?0:-1;n.focus();}
     return true;
   }
   if(!plan)return false;
   // the calendar is a grid: the arrows choose the day before or after (a week up or down), Home and End the ends of its
   // week, Page Up and Page Down move by the rows shown; Enter (or Space) chooses it and puts the caret in "Add a task"
   if(target?.classList?.contains('rd-plan-cell')&&bare){
    const k=target.dataset.day,M=P(),step=viewOf(ui,getContext())==='week'?7:28;let next='';
    if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(k,{focus:'.rd-plan-page [data-rd-field="plan-quick"]'});return true;}
    next={
      ArrowLeft:M.addDays(k,-1),
      ArrowRight:M.addDays(k,1),
      ArrowUp:M.addDays(k,-7),
      ArrowDown:M.addDays(k,7),
      Home:M.mondayOf(k),
      End:M.addDays(M.mondayOf(k),6),
      PageUp:M.addDays(k,-step),
      PageDown:M.addDays(k,step)
    }[event.key]||
      '';
    if(next&&!event.shiftKey){
      event.preventDefault();
      if(event.key.startsWith('Page')){
        const start=ui.start&&M.validDay(ui.start)?M.mondayOf(ui.start):M.mondayOf(today());
        ui.start=M.addDays(start,event.key==='PageUp'?-step:step);
      }
      choose(next,{focus:`.rd-plan-cell[data-day="${next}"]`});
      return true;
    }
   }
   // a task: Shift + left / right moves it a day (on the page, the page goes with it); up and down walk the page's rows
   const open=target?.closest?.('.rd-plan-title, .rd-plan-eopen');if(!open||!bare)return false;
   const row=open.closest('.rd-plan-item, .rd-plan-entry'),id=row?.dataset?.planId;if(!id||row.dataset.echo)return false;
   if(event.shiftKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){
    event.preventDefault();
    const e=entry(id);
    if(!e)return true;
    const M=P(),
      onPage=!!row.closest('.rd-plan-page:not([data-view])'),
      base=e.planned||(onPage?ui.day||today():row.closest('[data-plan-drop]')?.dataset?.planDrop)||today(),
      next=M.addDays(base,event.key==='ArrowLeft'?-1:1);
    if(onPage){ui.day=next;keepInView(next);}
    move(id,next,{then:()=>{const sel=onPage?`.rd-plan-page .rd-plan-item[data-plan-id="${css(id)}"]:not([data-echo]) .rd-plan-title`:`.rd-plan-entry[data-rd-key="${css(`pe-${id}@${next}`)}"] .rd-plan-eopen`;if(!focusAt(sel))focusAt(`.rd-plan [data-plan-id="${css(id)}"] :is(.rd-plan-title,.rd-plan-eopen)`);}});
    return true;
   }
   if(!event.shiftKey&&(event.key==='ArrowDown'||event.key==='ArrowUp')&&open.closest('.rd-plan-page')){
     const all=[...container.querySelectorAll('.rd-plan-page .rd-plan-title')],i=all.indexOf(open),n=all[i+(event.key==='ArrowDown'?1:-1)];
     if(n){event.preventDefault();n.focus({preventScroll:false});return true;}
   }
   return false;
  }
  // ---- dragging a row or a chip to a day of the calendar, to the day's page, or to No date. Where it would land is found
  // from the boxes, measured once when the drag starts (asking the page what lies under the pointer on every move made the
  // browser restyle it each time: 4.2's round 2). The carried copy moves once per frame. (Smaller boxes first.)
  const measureDrops=()=>{
    const out=[];
    for(const el of container.querySelectorAll('.rd-plan [data-plan-drop]')){
      const r=el.getBoundingClientRect();
      if(r.width&&r.height)out.push({el,l:r.left,t:r.top,r:r.right,b:r.bottom,a:r.width*r.height});
    }
    return out.sort((a,b)=>a.a-b.a);
  };
  const dropAt=(x,y)=>{
    const list=drag?.drops;
    if(!list)return scope().elementFromPoint?.(x,y)?.closest?.('[data-plan-drop]')||null;
    for(const d of list)if(x>=d.l&&x<=d.r&&y>=d.t&&y<=d.b)return d.el;
    return null;
  };
  const overTo=over=>{if(over!==drag.over){drag.over?.removeAttribute('data-over');over?.setAttribute('data-over','true');drag.over=over;}};
  function paint(){if(!drag)return;drag.frame=0;drag.ghost.style.transform=`translate(${drag.lastX-drag.dx}px,${drag.lastY-drag.dy}px) rotate(-1.4deg)`;overTo(dropAt(drag.lastX,drag.lastY));}
  function down(event){
   if(dead||event.button>0||!event.isPrimary)return;
   const card=event.target.closest?.('.rd-plan-item[data-plan-id], .rd-plan-entry[data-plan-id]');
   if(!card||card.dataset.echo||!card.closest('.rd-plan')||!container.contains(card)||event.target.closest('button:not(.rd-plan-title):not(.rd-plan-eopen),input,a,select,textarea'))return;
   const rect=card.getBoundingClientRect();
   drag={
     id:card.dataset.planId,
     key:card.dataset.rdKey,
     card,
     x:event.clientX,
     y:event.clientY,
     lastX:event.clientX,
     lastY:event.clientY,
     dx:event.clientX-rect.left,
     dy:event.clientY-rect.top,
     w:rect.width,
     pointer:event.pointerId,
     moved:false,
     ghost:null,
     over:null
   };
   doc.addEventListener('pointermove',moveDrag,true);doc.addEventListener('pointerup',up,true);doc.addEventListener('pointercancel',cancel,true);
  }
  function moveDrag(event){
   if(!drag||event.pointerId!==drag.pointer)return;
   if(!drag.moved){
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;
    drag.moved=true;if(ui.showOpen||ui.weekOpen){ui.showOpen=false;ui.weekOpen=false;}
    const ghost=drag.card.cloneNode(true);
    ghost.classList.add('rd-plan-ghost');
    ghost.setAttribute('data-rd-keep','');
    ghost.setAttribute('aria-hidden','true');
    ghost.removeAttribute('data-rd-key');
    ghost.style.width=Math.min(drag.w,320)+'px';
    drag.drops=measureDrops();container.append(ghost);drag.ghost=ghost;drag.card.dataset.dragging='true';container.dataset.planDragging='true';
   }
   event.preventDefault();drag.lastX=event.clientX;drag.lastY=event.clientY;
   if(!drag.frame)drag.frame=requestAnimationFrame(paint);
  }
  function finish(){
   if(!drag)return null;const d=drag;if(d.frame)cancelAnimationFrame?.(d.frame);drag=null;
   doc.removeEventListener('pointermove',moveDrag,true);doc.removeEventListener('pointerup',up,true);doc.removeEventListener('pointercancel',cancel,true);
   const rect=d.ghost?.getBoundingClientRect();d.ghost?.remove();d.over?.removeAttribute('data-over');d.card.removeAttribute('data-dragging');delete container.dataset.planDragging;
   return {...d,rect};
  }
  // The click that follows a drag must not open the task.
  const swallowClick=()=>{
    const swallow=e=>{e.stopPropagation();e.preventDefault();};
    container.addEventListener('click',swallow,{capture:true,once:true});
    setTimeout(()=>container.removeEventListener('click',swallow,{capture:true}),60);
  };
  function up(event){
   if(!drag||event.pointerId!==drag.pointer)return;
   if(drag.moved&&drag.frame){cancelAnimationFrame?.(drag.frame);drag.lastX=event.clientX;drag.lastY=event.clientY;paint();}
   const over=drag.moved?dropAt(event.clientX,event.clientY):null,d=finish();
   if(!d.moved)return;swallowClick();
   if(over){const day=over.dataset.planDrop||'';move(d.id,day,{from:d.rect?{key:d.key,rect:d.rect}:null});}
  }
  function cancel(event){if(drag&&event.pointerId===drag.pointer)finish();}
  container.addEventListener('pointerdown',down);
  // after every dashboard render: the Planner measured and its sheet placed; a floating card follows what opened it (and
  // goes when that is gone)
  function sync(){
   if(dead)return;const plan=container.querySelector('.rd-plan');
   if(plan){watch(plan);measure();placeSheet();root.clearTimeout?.(lateMeasure);lateMeasure=root.setTimeout?.(()=>{if(!dead)measure();},380)||0;}
   else if(ui.sheet){flushSheet();ui.sheet=null;ui.sheetPos=null;}
   if(picker)placeFloat(picker);if(pop)placeFloat(pop);
  }
  return {ui,click,keydown,input,change,read,adding,added,sync,openAdd,moveTo(id,day,time){move(id,day,{time});},
   // Home's Week module and Biscuit open the Planner at a day: that day chosen, in the calendar
   goto(day){
     const t=today(),M=P();
     if(ui.sheet){flushSheet();ui.sheet=null;ui.sheetPos=null;}
     ui.overdueOpen=false;
     ui.calOpen=false;
     ui.day=day&&M.validDay(day)?day:t;
     keepInView(ui.day);
   },
   destroy(){
     flushSheet();
     dead=true;
     watchSheet(false);
     finish();
     closePicker(false);
     closeAdd(false);
     observer?.disconnect();
     root.clearTimeout?.(lateMeasure);
     container.removeEventListener('pointerdown',down);
     root.removeEventListener?.('resize',onResize);
   }};
 }
 const api={render,dayPage,dayButton,pickerHTML,fit,create,reading,LENGTHS,plus:RING_PLUS};
 root.ReservePlannerUI=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
