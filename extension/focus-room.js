/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Adapted from Gary Wu's pull request #43 to Canvas Harness.
/* Canvas Harness Plus: the Focus room. One focus session, two modes. On Home it is a small module (the seal, +5,
   Finish, the task tag, the time and the light arc); "Room" grows the module into a whole drawn place that fills the
   screen (Lake, Stream, Rain or Fire), where the sky is the session: dawn at the start, dusk at the end. The timer is
   the planner's one focus record, so a running session keeps counting while the module grows and folds back. This
   file never writes the record itself: its buttons are the planner's own actions (timer-toggle, focus-control,
   timer-minutes), answered by widgets.js. Sounds are made in the browser; no files, nothing sent anywhere. */
(function(root){
 'use strict';
 const enabled=()=>root.ReserveFeatures?.enabled('focus-room')===true;
 const blocked=()=>/\/quizzes\/[^/]+\/(?:take|resume)(?:\/|$)|\/assessment_sessions\//.test(root.location?.pathname||'');
 const Art=()=>root.ReserveFocusRoomArt;
 const PLACES=['lake','stream','rain','fire','winter'],NAMES={lake:'Lake',stream:'Stream',rain:'Rain',fire:'Fire',winter:'Winter'};
 const OPEN_MINUTES=180,BREAK_MINUTES=5;
  // The house curves (motion.js / refresh.css): settle for what arrives, letgo for what leaves, fade for opacity, pen for
  // a travel or a stroke. Nothing overshoots more than a few per cent, and only a physical swing does.
  const EZ=()=>root.ReserveMotion?.easings||{},
    SETTLE=()=>EZ().settle||'cubic-bezier(.2,.8,.2,1)',
    LETGO=()=>EZ().letgo||'cubic-bezier(.2,0,.4,1)',
    FADE=()=>EZ().fade||'cubic-bezier(.2,.65,.3,1)',
    PEN=()=>EZ().pen||'cubic-bezier(.45,.05,.25,1)';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const clock=(seconds,up=false)=>{const n=Math.max(0,up?Math.floor(seconds):Math.ceil(seconds));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
 // Per-viewer conveniences only (the place, the volume, Quiet, today's tally); the session lives in the planner record.
 const shared={prefs:{place:'lake',volume:.4,quiet:false,length:25,day:'',base:0}};
 const prefsKey=store=>'reserve:focus-room:'+String(store?.owner?.accountId||'me').replace(/[^\w-]/g,'').slice(0,40);
 function loadPrefs(store){
  try{const raw=JSON.parse(root.localStorage?.getItem(prefsKey(store))||'null');if(raw&&typeof raw==='object'){const p=shared.prefs;
   if(PLACES.includes(raw.place))p.place=raw.place;if(Number.isFinite(raw.volume))p.volume=Math.max(0,Math.min(1,raw.volume));p.quiet=raw.quiet===true;
   if([25,50].includes(raw.length))p.length=raw.length;if(typeof raw.day==='string')p.day=raw.day.slice(0,40);if(Number.isInteger(raw.base)&&raw.base>=0)p.base=raw.base;}}catch{}
 }
 function savePrefs(store){try{root.localStorage?.setItem(prefsKey(store),JSON.stringify(shared.prefs));}catch{}}
 // Sessions finished today, counted from the planner's running total.
 function tally(focus,now){
  const p=shared.prefs,day=new Date(now).toDateString(),sessions=Number.isInteger(focus?.sessions)?focus.sessions:0;
  if(p.day!==day){p.day=day;p.base=Math.max(0,sessions-(focus?.completedAt&&new Date(focus.completedAt).toDateString()===day?1:0));}
  if(sessions<p.base)p.base=sessions;
  return sessions-p.base;
 }
 // What the session looks like right now, for both modes.
 function view(focus,now){
  const C=root.ReserveCore,f=focus&&typeof focus==='object'?focus:{};
  const st=C?.focusState?C.focusState(f,now):{minutes:25,total:1500,running:false,paused:false,active:false,left:1500,elapsed:0,progress:0,sessions:0,phase:'focus'};
  const rest=st.phase==='break',minutes=Math.round(st.minutes),open=!rest&&(f.open===true||minutes===OPEN_MINUTES);
  let mode='ready';
  if(st.running)mode=rest?'break':'running';
  else if(st.paused)mode=rest?'break-paused':'paused';
  else if(rest&&!f.stoppedAt)mode='break-over';
  else if(f.completedAt&&!f.stoppedAt&&now-f.completedAt<3600000&&st.left<=0)mode='done';
  const active=st.running||st.paused;
  const progress=mode==='ready'?0:mode==='done'||rest?1:open?Math.min(1,st.elapsed/(OPEN_MINUTES*60)):st.progress;
  const time=mode==='done'?'00:00':open?clock(mode==='ready'?0:st.elapsed,true):clock(mode==='ready'?st.total:st.left);
  const seal={ready:'Start',running:'Pause',paused:'Resume',done:'Again',break:'Back to it','break-paused':'Resume','break-over':'Back to it'}[mode];
  // a run of pomodoros (Biscuit's "4 pomodoros") shows where it is: "Focus · 25 · 2 / 4", "Break · 5 · 2 / 4"
  const seq=Number.isInteger(f.cycles)&&f.cycles>1&&Number.isInteger(f.cycle)&&f.cycle>0,cyc=seq?` · ${Math.min(f.cycle,f.cycles)} / ${f.cycles}`:'';
  const label=mode==='running'||mode==='paused'?open?'Open':`Focus · ${minutes}${cyc}`:rest&&active?`Break · ${minutes}${cyc}`:mode==='break-over'?'Break over':mode==='done'?'Done':'';
  const back=seq&&Number(f.focusMinutes)>0?Math.round(Number(f.focusMinutes)):0;
  return {mode,active,rest,open,minutes,progress,time,seal,label,back,sealAction:mode==='break'||mode==='break-over'?'focus-back':'timer-toggle',
   lengths:['ready','done','break-over'].includes(mode),adjust:active&&!rest,plus:active&&!rest&&!open,offerBreak:mode==='done'&&(Number(f.completedMinutes)||minutes)>=20,
   pressed:open?'open':minutes===50?'50':minutes===25?'25':'',sessions:st.sessions,completedAt:f.completedAt||0,running:st.running,elapsed:st.elapsed,total:st.total};
 }
 // The work the session is for: the planner's item, otherwise the next thing due.
 function pickTask(focus,entries,courses,format,now=Date.now()){
  const list=Array.isArray(entries)?entries.filter(e=>e&&e.title):[],open=list.filter(e=>!e.done);
  const dated=open.filter(e=>Number.isFinite(Date.parse(e.dueAt))).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
  const item=(focus?.itemId!=null&&list.find(e=>String(e.id)===String(focus.itemId)))||dated.find(e=>Date.parse(e.dueAt)>=now)||dated[0]||open[0];
  if(!item)return null;
  const course=(courses||[]).find(c=>String(c.id)===String(item.courseId));
  let due='';try{due=item.dueAt&&format?format(Date.parse(item.dueAt)):'';}catch{}
  return {
    title:String(item.title).slice(0,140),
    course:course?String(course.shortName||course.name||'').slice(0,80):item.course?String(item.course).slice(0,80):item.courseId==='personal'||item.personal?'Personal':'',
    due:String(due||'').slice(0,60),
    color:/^#[0-9a-f]{3,8}$/i.test(item.color||course?.color||'')?(item.color||course.color):''
  };
 }
 // Every control below is written out whole, its action and its name in the button itself: Biscuit's list of controls
 // (scripts/biscuit-control-inventory.cjs) reads them from this source. Drawings come through art(), never words.
 const art=(name,...args)=>{try{const fn=Art()?.[name];return typeof fn==='function'?fn(...args)||'':'';}catch{return '';}};
 // the seal's word is set by its length: up to five letters at full size, "Resume" a little smaller, two words smaller
 // still on two balanced lines, always inside the seal's inner ring (focus-room.css)
 const sealLen=t=>/\s/.test(String(t||'').trim())?'words':String(t||'').length>5?'long':'short';
 function controls(v,{small=false,side=false}={}){
  const size=small?' fr-small':'';
  // The seal is the planner's timer-toggle (Start, Pause, Resume, Again) or, after a break, focus-back ("Back to it").
  // Its words follow view().seal, which apply() keeps current while the session runs.
  const seal=v.sealAction==='focus-back'
   ?`<button type="button" class="fr-seal${size}" data-rd-action="focus-back" data-fr-seal data-minutes="${v.back||shared.prefs.length}" aria-label="Back to it">${art('seal',100)}<span data-fr-seal-label data-len="words">Back to it</span></button>`
   :`<button type="button" class="fr-seal${size}" data-rd-action="timer-toggle" data-fr-seal aria-label="${v.mode==='ready'?'Start':v.mode==='running'?'Pause':v.mode==='done'?'Again':'Resume'}">${art('seal',100)}<span data-fr-seal-label data-len="${sealLen(v.seal)}">${esc(v.seal)}</span></button>`;
  const plus=`<button type="button" class="fr-tagbtn${size}" data-rd-action="focus-control" data-fr-plus data-focus-action="adjust" data-minutes="5" aria-label="Add 5 minutes"${v.plus?'':' hidden'}>${art('tagArt',70,44)}<span>+5</span></button>`;
  const finish=`<button type="button" class="fr-tagbtn${size}" data-rd-action="focus-control" data-fr-finish data-focus-action="finish"${v.adjust?'':' hidden'}>${art('tagArt',92,44)}<span>Finish</span></button>`;
  const rest=`<button type="button" class="fr-tagbtn${size}" data-rd-action="focus-break" data-fr-break data-minutes="${BREAK_MINUTES}" aria-label="Break, 5 minutes"${v.offerBreak?'':' hidden'}>${art('tagArt',88,44)}<span>Break</span></button>`;
  // in the room the seal keeps the middle and its tags hang on its right (the lengths on its left), so it never moves
  return side?seal+`<span class="fr-side">${plus+finish+rest}</span>`:seal+plus+finish+rest;
 }
 function lengths(v){
  const on=value=>`aria-pressed="${v.pressed===value}"`;
  return `<div class="fr-lengths" role="group" aria-label="Session length" data-fr-lengths ${v.lengths?'':'hidden'}><button type="button" class="fr-tagbtn fr-chip" data-rd-action="timer-minutes" data-minutes="25" aria-label="25 minutes" ${on('25')}>${art('tagArt',58,44)}<span>25</span></button><button type="button" class="fr-tagbtn fr-chip" data-rd-action="timer-minutes" data-minutes="50" aria-label="50 minutes" ${on('50')}>${art('tagArt',58,44)}<span>50</span></button><button type="button" class="fr-tagbtn fr-chip" data-rd-action="timer-minutes" data-minutes="${OPEN_MINUTES}" data-open="true" aria-label="Open-ended" ${on('open')}>${art('tagArt',78,44)}<span aria-hidden="true">Open</span></button></div>`;
 }
 const tallyMarkup=n=>`<span class="fr-tally" data-fr-tally data-n="${n}" ${n?'':'hidden'} aria-label="${n} today">${Art()?.tallyArt(n)||''}<span aria-hidden="true">today</span></span>`;
 // The room's task tag: drawn at the width it is shown at. It keeps left of the sun's arc for the whole session (the
 // sun never passes behind it): layout() works out the widest tag that stays clear at the window's shape.
 const TAG={w:300,h:136};
 function tagWidth(w,h,s,k){
  const A=Art();if(!A?.arc)return 300;const L=.045*w,T=.095*h+30*k,B=T+TAG.h*k,r=26*s+10;
  const pts=[];for(let t=0;t<=.6;t+=.01){const [x,y]=A.arc(t);pts.push([w/2+(x+40-720)*s,h/2+(y+40-450)*s]);}
  for(let tw=316;tw>=232;tw-=4){const R=L+tw*k;if(pts.every(([x,y])=>Math.hypot(Math.max(L-x,0,x-R),Math.max(T-y,0,y-B))>=r))return tw;}
  return 232;
 }
 function taskMarkup(task,{big=true}={}){
  const meta=task?[task.course,task.due?`due ${task.due}`:''].filter(Boolean).map(esc).map(part=>`<span>${part}</span>`).join(' · '):'';
  return `${big?Art()?.bigTag(TAG.w,TAG.h)||'':Art()?.bigTag(300,104)||''}<span class="fr-task-text"><strong data-fr-task-title>${esc(task?.title||'Free study')}</strong><small data-fr-task-meta>${meta}</small></span>`;
 }
 // Where the sun stands on its arc: on the ridge before a session starts, then from just above it (3%) to just above
 // the other end (97%), so it is in sight the whole time. Both modes use the same point.
 const sunT=(mode,p)=>mode==='ready'?0:.03+.94*Math.max(0,Math.min(1,p));
 function sunPoint(v){return Art()?.miniPoint(sunT(v.mode,v.progress))||[80,0];}
 // The Home module: the room without its place. The only picture is the room's light arc with its sun.
 function moduleBody({focus,now=Date.now(),task=null,size='m'}={}){
  const A=Art(),v=view(focus,now),[sx,sy]=sunPoint(v),place=shared.prefs.place,n=tally(focus,now);
  return `<div class="fr-mod" data-fr-mod data-mode="${v.mode}" data-place="${place}"${shared.modNight?' data-fr-night="true"':''} data-size="${['s','m','l'].includes(size)?size:'m'}" style="--fr-course:${esc(task?.color||'')}"><div class="fr-mod-in">
<div class="fr-mod-tag">${taskMarkup(task,{big:false})}</div>
<div class="fr-mod-clock"><svg class="fr-mod-arc" viewBox="0 -24 160 80" aria-hidden="true" focusable="false">${A?.miniArc()||''}<g class="fr-mod-sun" data-fr-mod-sun data-fr-t="${+sunT(v.mode,v.progress).toFixed(4)}" style="transform:translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)"><circle class="fr-mod-sun-wash" cx="1.4" cy="1.6" r="7"/><circle class="fr-mod-sun-line" r="7"/></g></svg>
<output class="fr-mod-time" data-fr-time aria-live="off">${v.time}</output><span class="fr-mod-sub" data-fr-sub>${esc(task?.title||'')}</span><span class="fr-mod-label" data-fr-label>${esc(v.label)}</span>${tallyMarkup(n)}</div>
<div class="fr-mod-controls">${controls(v,{small:true})}${lengths(v)}</div>
<button type="button" class="fr-mod-place" data-rd-action="room-open" aria-label="Focus room" aria-describedby="fr-mod-place-name"><span class="fr-mod-thumb">${art('cardArt',place)}</span><span id="fr-mod-place-name" aria-hidden="true">${NAMES[place]}</span></button>
</div></div>`;
 }
 // Day light by session progress: dawn rose and peach, a pale clear day, amber and lilac at dusk. Flat colours only.
 const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),toHex=a=>'#'+a.map(n=>Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0')).join('');
 const mix=(a,b,t)=>toHex(hex(a).map((n,i)=>n+(hex(b)[i]-n)*t));
 const DAWN=['#F6E4D6','#F2D6C4','#EFC9B2','#EBBFA4'],NOON=['#EEF2EE','#E7EFEC','#E2ECE6','#DCE8E2'],DUSK=['#E9DCE6','#F1D5BE','#F2C08E','#EEAA74'],GREY=['#E3E5E3','#D9DDDD','#CED5D6','#C6CED0'],COLD=['#D9E1E8','#CFDAE3','#C5D3DE','#BCCCD9'];
 function daylight(p,place){
  const u=Math.max(0,Math.min(1,p)),band=i=>{
    const clear=u<.5?mix(DAWN[i],NOON[i],u*2):mix(NOON[i],DUSK[i],(u-.5)*2);
    return place==='rain'?mix(GREY[i],clear,.28):place==='winter'?mix(COLD[i],clear,.36):clear;
  };
  const sun=u<.12?mix('#F3B57A','#F2C14E',u/.12):u>.82?mix('#F2C14E','#EDA25C',(u-.82)/.18):'#F2C14E';
  return {
    '--fr-sky0':band(0),
    '--fr-sky1':band(1),
    '--fr-sky2':band(2),
    '--fr-sky3':band(3),
    '--fr-sun':sun,
    '--fr-tint':u<.5?'#F2B8A0':'#E9A060',
    '--fr-tint-o':String(+(u<.5?.09*(1-u*2):.11*(u-.5)*2).toFixed(3)),
    '--fr-water':mix('#C3DCE4',band(2),.3)
  };
 }
 // ---------------------------------------------------------------- the sounds of the four places
 function Sound(win){
  const AC=win?.AudioContext||win?.webkitAudioContext;let ctx=null,master=null,current=null,timer=0,level=.4,quiet=false;
  const buffers={};
  function noise(kind){
   if(buffers[kind])return buffers[kind];const len=ctx.sampleRate*4,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);let b0=0,b1=0,b2=0,last=0;
   for(let i=0;i<len;i++){
     const w=Math.random()*2-1;
     if(kind==='white')d[i]=w;else if(kind==='pink'){b0=.99765*b0+w*.099;b1=.963*b1+w*.2965;b2=.57*b2+w*1.0526;d[i]=(b0+b1+b2+w*.1848)*.2;}else{last=(last+.02*w)/1.02;d[i]=last*3.2;}
   }
   return buffers[kind]=buf;
  }
  function bed(out,kind,type,freq,q,gain,lfo=0,depth=0){
   const src=ctx.createBufferSource();src.buffer=noise(kind);src.loop=true;src.loopStart=Math.random()*2;
   const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const g=ctx.createGain();g.gain.value=gain;
   src.connect(f).connect(g).connect(out);src.start(ctx.currentTime,Math.random()*3);const nodes=[src];
   if(lfo){const o=ctx.createOscillator(),og=ctx.createGain();o.frequency.value=lfo;og.gain.value=gain*depth;o.connect(og).connect(g.gain);o.start();nodes.push(o);}
   return nodes;
  }
  function burst(out,t,{freq=2000,q=1,dur=.02,gain=.2,type='bandpass',kind='white',attack=.002}){
   const src=ctx.createBufferSource();src.buffer=noise(kind);const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const g=ctx.createGain();
   g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+attack+dur);
   src.connect(f).connect(g).connect(out);src.start(t,Math.random()*3,attack+dur+.05);
  }
  function chirp(out,t,f0,f1,dur,gain){
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.setValueAtTime(f0,t);
    o.frequency.exponentialRampToValueAtTime(f1,t+dur);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(gain,t+dur*.2);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t+dur+.02);
  }
  // Each place: a continuous bed and events scheduled a little ahead (laps, bubbles, drops, crackles).
  const PLACE={
   lake:out=>({nodes:[...bed(out,'brown','lowpass',520,.4,.5,.11,.35),...bed(out,'pink','bandpass',1100,.7,.05,.23,.6)],next:0,tick(t){
     if(t>=this.next){burst(out,t,{freq:R(500,900),q:.8,dur:R(.9,1.6),gain:R(.05,.1),attack:R(.25,.45),kind:'pink'});this.next=t+R(1.6,4.2);}
   }}),
   stream:out=>({nodes:[...bed(out,'pink','bandpass',1500,.55,.32,.4,.25),...bed(out,'white','highpass',3200,.5,.035)],next:0,tick(t){
     while(this.next<t+.25){const at=Math.max(t,this.next),f0=R(320,900);chirp(out,at,f0,f0*R(1.8,2.6),R(.025,.06),R(.012,.04));this.next=at+R(.02,.11);}
   }}),
   rain:out=>({nodes:[...bed(out,'white','bandpass',4200,.35,.22),...bed(out,'brown','lowpass',320,.5,.22,.07,.3)],next:0,thin:1,tick(t){
     while(this.next<t+.25){const at=Math.max(t,this.next);burst(out,at,{freq:R(2200,6400),q:R(1,3),dur:R(.004,.012),gain:R(.03,.11)*this.thin});this.next=at+R(.01,.06)/this.thin;}
   }}),
   fire:out=>({nodes:[...bed(out,'brown','lowpass',190,.6,.42,.08,.4),...bed(out,'pink','bandpass',600,.8,.04,.13,.5)],next:0,cricket:0,tick(t){
     while(this.next<t+.25){
       const at=Math.max(t,this.next),cluster=Math.random()<.3?RI(2,4):1;
       for(let i=0;i<cluster;i++)burst(out,at+i*R(.008,.03),{freq:R(1400,4800),q:R(1.5,4),dur:R(.003,.014),gain:R(.12,.45)});
       if(Math.random()<.05)burst(out,at,{freq:R(500,800),q:1.2,dur:.03,gain:.35});
       this.next=at+R(.04,.32);
     }
    if(t>=this.cricket){for(let k=0;k<3;k++)chirp(out,t+k*.07,4400,4500,.03,.008);this.cricket=t+R(1.1,2.4);}}})
   ,winter:out=>({nodes:[...bed(out,'pink','bandpass',420,.5,.2,.09,.3),...bed(out,'brown','lowpass',260,.4,.16,.05,.5)],next:0,tick(t){
     if(t>=this.next){burst(out,t,{freq:R(300,700),q:.6,dur:R(2.2,4.2),gain:R(.05,.11),attack:R(.8,1.6),kind:'pink'});this.next=t+R(3.5,8);}
   }})
  };
  function R(a,b){return a+Math.random()*(b-a);}
  function RI(a,b){return Math.floor(R(a,b+1));}
  function ensure(){
   if(!AC)return null;
   try{
     if(!ctx){ctx=new AC();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);}
     if(ctx.state==='suspended')ctx.resume()?.catch?.(()=>{});
   }catch{ctx=null;}
   return ctx;
  }
  const target=()=>quiet?0:level*level*.9;
  function loop(){if(!ctx||!current)return;const t=ctx.currentTime;try{current.tick(t);}catch{}}
  function play(place){
   if(!ensure())return;const t=ctx.currentTime,out=ctx.createGain();out.gain.setValueAtTime(0,t);out.gain.linearRampToValueAtTime(1,t+1.5);out.connect(master);
   if(current){
     const old=current;
     old.out.gain.cancelScheduledValues(t);
     old.out.gain.setValueAtTime(old.out.gain.value,t);
     old.out.gain.linearRampToValueAtTime(0,t+1.5);
     win.setTimeout(()=>{for(const n of old.nodes)try{n.stop();}catch{}try{old.out.disconnect();}catch{}},1700);
   }
   current={...PLACE[place](out),out,place};
   master.gain.cancelScheduledValues(t);master.gain.setValueAtTime(master.gain.value,t);master.gain.linearRampToValueAtTime(target(),t+1.5);
   if(!timer)timer=win.setInterval(loop,90);loop();
  }
  function stop(){
   if(!ctx)return;const t=ctx.currentTime,old=current;current=null;win.clearInterval(timer);timer=0;
   master.gain.cancelScheduledValues(t);master.gain.setValueAtTime(master.gain.value,t);master.gain.linearRampToValueAtTime(0,t+.5);
   win.setTimeout(()=>{if(old){for(const n of old.nodes)try{n.stop();}catch{}try{old.out.disconnect();}catch{}}if(!current)ctx?.suspend?.()?.catch?.(()=>{});},650);
  }
  function setLevel(v,q){
    level=v;
    quiet=q;
    if(!ctx||!current)return;
    const t=ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value,t);
    master.gain.linearRampToValueAtTime(target(),t+.35);
  }
  function chime(){
    if(!ctx||!current||quiet)return;
    const t=ctx.currentTime+.05;
    [[660,.2],[660*2.76,.06],[660*5.4,.025],[990,.07]].forEach(([f,g],i)=>{
      const o=ctx.createOscillator(),e=ctx.createGain();
      o.frequency.value=f;
      e.gain.setValueAtTime(0,t+i*.004);
      e.gain.linearRampToValueAtTime(g,t+.01+i*.004);
      e.gain.exponentialRampToValueAtTime(.0001,t+2.8-i*.4);
      o.connect(e).connect(master);
      o.start(t);
      o.stop(t+3);
    });
  }
  function whistle(){
    if(!ctx||!current||quiet)return;
    const t=ctx.currentTime+.05,o=ctx.createOscillator(),v=ctx.createOscillator(),vg=ctx.createGain(),e=ctx.createGain();
    o.frequency.value=1850;
    v.frequency.value=6;
    vg.gain.value=18;
    v.connect(vg).connect(o.frequency);
    e.gain.setValueAtTime(0,t);
    e.gain.linearRampToValueAtTime(.045,t+1.1);
    e.gain.setValueAtTime(.045,t+1.9);
    e.gain.linearRampToValueAtTime(0,t+2.5);
    o.connect(e).connect(master);
    o.start(t);
    v.start(t);
    o.stop(t+2.6);
    v.stop(t+2.6);
  }
  function thin(){if(current?.place==='rain'){current.thin=.35;const t=ctx.currentTime;current.out.gain.linearRampToValueAtTime(.55,t+2.5);}}
  // Making the audio context is slow (it held up the room's first frame); it is made ahead, while a hand rests on Room
  // or Room has the keyboard focus. Made before a click it stays suspended until the room's own click resumes it.
  // Only once the page has had a press or a key: made before that, the browser will not start it and logs "The
  // AudioContext was not allowed to start" (the owner's extension error page, 2026-10-29). The press on Room itself
  // (pointerdown, which counts as one) still makes it ahead of the click.
  function warm(){if(!ctx&&AC&&win?.navigator?.userActivation?.hasBeenActive!==false)try{ensure();}catch{}}
  return {play,stop,setLevel,chime,whistle,thin,warm,get playing(){return !!current;},get place(){return current?.place||'';}};
 }
 // ---------------------------------------------------------------- one room per dashboard
 function create({container,store,task:getTask=()=>null}){
  const doc=container.ownerDocument,win=doc.defaultView||root,hidden=new Map();
  let lastSessions=null,
    panel=null,
    opener=null,
    dead=false,
    opening=0,
    settled=false,
    closing=null,
    last=null,
    moment=0,
    afterEnd=false,
    night=null,
    kit=null,
    builtKey='',
    sunAt='',
    lastMinute=-1,
    pickerOpen=false,
    themeKey='',
    theme={kit:false,dark:false};
  // the stage on show, the sky colours last written, the sun's last point on its arc, whether the next move is a sunrise
  let stageEl=null,skyKey='',sunT0=null,rise=false,swapping=Promise.resolve();
  const moving=new WeakMap();
  const sound=Sound(win);loadPrefs(store);
  const full=()=>doc.fullscreenElement===container||container.getRootNode?.()?.fullscreenElement===container;
  const host=()=>{const r=container.getRootNode?.();return r&&r!==doc?r.host:null;};
  const active=()=>{const r=container.getRootNode?.();return (r&&r.activeElement)||doc.activeElement;};
  const reduce=()=>!!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  function motion(){const style=container.dataset?.motionStyle;if(style==='off'||reduce())return 'off';return style==='still'?'still':'gentle';}
  const wait=ms=>new Promise(resolve=>win.setTimeout?win.setTimeout(resolve,ms):resolve());
  const q=sel=>panel?.querySelector(sel);
  function animate(node,frames,options){if(!node||typeof node.animate!=='function'||motion()==='off')return null;try{return node.animate(frames,options);}catch{return null;}}
  const done=anim=>anim?.finished?anim.finished.catch(()=>{}):Promise.resolve();
  // Under the room the dashboard is see-through (opacity 0) and hidden from assistive technology (aria-hidden), on a layer
  // of its own, never display:none or visibility:hidden: it keeps its layout (a desk at width 0 would be laid out again as
  // one column) and stays painted, so bringing it back as the room folds is a change of opacity the compositor makes
  // alone, not a repaint of the whole page in the first frames of the fold. Its layer is let go once the browser is idle
  // after the fold. Nothing inherited is set on it: inert and pointer-events pass down to every element, and toggling
  // them restyled the whole dashboard (measured at 4x CPU: inert 0.48 s on and 0.23 s off, pointer-events 0.19 s and
  // 0.11 s, against 6 and 2 ms for the opacity), the off half in the middle of the fold. The room covers the page and
  // takes every press (it is a modal dialog), and its own Tab keeps the keys inside it.
  const HIDE=[['opacity','0'],['will-change','opacity']];
  let layerTimer=0,layerIdle=0;
  function restore(){
   for(const [node,value]of hidden){
     if(value.aria===null)node.removeAttribute?.('aria-hidden');else node.setAttribute?.('aria-hidden',value.aria);
     for(const [prop,[was,priority]] of value.props)if(prop!=='will-change'){if(was)node.style?.setProperty?.(prop,was,priority);else node.style?.removeProperty?.(prop);}
   }
   const back=[...hidden];hidden.clear();
   const free=()=>{
     layerIdle=0;
     for(const [node,value] of back){
       if(hidden.has(node))continue;
       const [was,priority]=value.props.get('will-change')||['',''];
       if(was)node.style?.setProperty?.('will-change',was,priority);else node.style?.removeProperty?.('will-change');
     }
   };
   win.clearTimeout?.(layerTimer);if(layerIdle)win.cancelIdleCallback?.(layerIdle);layerIdle=0;
   if(typeof win.requestIdleCallback==='function')layerTimer=win.setTimeout(()=>{layerTimer=0;layerIdle=win.requestIdleCallback(free,{timeout:2000});},900);else free();
  }
  function hideSiblings(){
   for(const node of Array.from(container.children||[])){
    if(node===panel||node.classList?.contains('tk-starframes'))continue;
    if(!hidden.has(node))
      hidden.set(node,{
        aria:node.getAttribute?.('aria-hidden')??null,
        props:new Map(HIDE.map(([prop])=>[prop,[node.style?.getPropertyValue?.(prop)||'',node.style?.getPropertyPriority?.(prop)||'']]))
      });
    if(node.getAttribute?.('aria-hidden')!=='true')node.setAttribute?.('aria-hidden','true');
    for(const [prop,value] of HIDE)if(node.style?.getPropertyValue?.(prop)!==value)node.style?.setProperty?.(prop,value,'important');
   }
  }
  // Theme: dark theme and the Fire place are night; a theme kit lends the room its own colours. Scene themes (sea,
  // starry, stars, blueprint) mark the dashboard with data-theme-kit; Market theme kits with data-rd-data-theme.
  function themeOf(){
   const scene=container.getAttribute?.('data-theme-kit')||'',market=container.getAttribute?.('data-rd-data-theme')||'';
   const kitOn=!!container.hasAttribute?.('data-theme-kit')||!!market,key=scene+'|'+market+'|'+(container.dataset?.theme||'')+'|'+(container.dataset?.night||'');
   if(key===themeKey)return theme;themeKey=key;let dark=container.dataset?.theme==='dark';
   if(kitOn){
     try{
       const value=win.getComputedStyle?.(container)?.getPropertyValue('--rd-bg')?.trim()||'';
       const m=value.match(/^#([0-9a-f]{6})$/i)||null,rgb=m?[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)):(value.match(/\d+(\.\d+)?/g)||[]).slice(0,3).map(Number);
       if(rgb.length===3)dark=(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])/255<.42;
     }catch{}
   }
   return theme={kit:kitOn,dark};
  }
  // A kit marks the room, and whether its page is dark: a dark kit's night is mixed from its own page; a light kit's
  // night (the Fire place) keeps the night palette with only a hint of its accent, so no night sky is ever pale.
  function markKit(){
    if(!panel)return;
    if(kit){panel.dataset.kit='true';panel.dataset.kitDark=String(!!theme.dark);}else{panel.removeAttribute?.('data-kit');panel.removeAttribute?.('data-kit-dark');}
  }
  function markup(v,task){
   const A=Art(),place=shared.prefs.place,p=shared.prefs;
   return `<div class="fr-sheet" aria-hidden="true">${A?.sheetArt?.()||''}</div><div class="fr-world"><div class="fr-stage" data-fr-stage></div><div class="fr-tint" aria-hidden="true"></div><div class="fr-washer" aria-hidden="true">${A?.washArt()||''}</div></div>
<div class="fr-ui">
<button type="button" class="fr-close" data-rd-action="room-close" aria-label="Close">${art('closeArt')}<span class="fr-esc" aria-hidden="true">Esc</span></button>
<div class="fr-task" data-fr-task style="--fr-course:${esc(task?.color||'')}">${taskMarkup(task)}<span class="fr-paused" aria-hidden="true"><span class="fr-paused-word">paused</span><span class="fr-pencil">${A?.pencilArt()||''}</span></span></div>
<div class="fr-center">
<span class="fr-time" data-fr-time role="timer" aria-live="off">${v.time}</span>
<span class="fr-line"><span class="fr-label" data-fr-label>${esc(v.label)}</span>${tallyMarkup(tally(store.get().focus,Date.now()))}</span>
<div class="fr-controls">${lengths(v)}${controls(v,{side:true})}</div>
</div>
<div class="fr-place">
<div class="fr-picker" role="group" aria-label="Place" id="fr-picker" hidden>
<span class="fr-picker-ground" aria-hidden="true">${A?.pickerArt?.()||''}</span>
<button type="button" class="fr-card" data-fr-act="place" data-place="lake" aria-pressed="${place==='lake'}">${art('cardArt','lake')}<span>Lake</span></button>
<button type="button" class="fr-card" data-fr-act="place" data-place="stream" aria-pressed="${place==='stream'}">${art('cardArt','stream')}<span>Stream</span></button>
<button type="button" class="fr-card" data-fr-act="place" data-place="rain" aria-pressed="${place==='rain'}">${art('cardArt','rain')}<span>Rain</span></button>
<button type="button" class="fr-card" data-fr-act="place" data-place="fire" aria-pressed="${place==='fire'}">${art('cardArt','fire')}<span>Fire</span></button>
<button type="button" class="fr-card" data-fr-act="place" data-place="winter" aria-pressed="${place==='winter'}">${art('cardArt','winter')}<span>Winter</span></button>
<div class="fr-picker-tools"><div class="fr-knob" role="slider" tabindex="0" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.volume*100)}" style="--fr-vol:${p.volume}">${A?.knobArt()||''}</div>
<button type="button" class="fr-tagbtn fr-quiet" data-fr-act="quiet" aria-pressed="${p.quiet}">${art('tagArt',84,44)}<span>Quiet</span></button></div>
</div>
<button type="button" class="fr-tagbtn fr-placetag" data-fr-act="places" aria-expanded="false" aria-controls="fr-picker" aria-label="Place" aria-describedby="fr-place-now">${art('tagArt',104,44)}<span data-fr-place-name id="fr-place-now" aria-hidden="true">${NAMES[place]}</span><i aria-hidden="true">▴</i></button>
</div>
<p class="fr-sr" role="status" data-fr-status></p>
</div>`;
  }
  // Build (or rebuild) the place on the stage. The heavy drawing is cached per place and night.
  function buildStage(force=false,stepwise=false){
   if(!panel)return;const A=Art(),place=shared.prefs.place,isNight=night||place==='fire',key=place+(isNight?':n':':d');
   panel.dataset.place=place;panel.dataset.night=String(!!isNight);panel.dataset.pony=String(root.ReserveFeatures?.enabled?.('pony')!==false);
   if(!force&&key===builtKey)return;builtKey=key;
   stageEl=stageEl||q('[data-fr-stage]');
   if(stageEl&&A){
     filling?.cancel();
     filling=null;
     const html=A.stage(place,{night:isNight}).html;
     if(stepwise){filling=fillStage(stageEl,html);filling.done.then(()=>{if(panel&&filling?.target===stageEl){sunAt='';sync();}});}else stageEl.innerHTML=html;
   }
   shown();layout();
  }
  // A place is some two thousand drawn shapes. Put in all at once, the browser lays out and paints all of it in one
  // frame: the longest frame of the room's entrance and of a change of place. Here it goes in back to front, a share of
  // the drawing per frame; the biggest drawn layers go in as stacked parts in their own order (the same picture); the
  // sky ground (the sun, the clouds) goes in at once; and each ground says when it is all in, so its entrance (or the
  // swap under the wash) waits for it on a slow machine and never shows a half-drawn ground.
  let filling=null;
  const SPLIT=/\bfr-(?:far|mid|mid2|near|front|skyl)\b/,BUDGET=26000;
  function weigh(node){
    if(node.nodeType!==1)return 1;
    let w=60;
    const d=node.getAttribute?.('d');
    if(d)w+=d.length;
    for(const c of node.querySelectorAll?.('[d]')||[])w+=c.getAttribute('d').length+60;
    return w;
  }
  function fillStage(target,html){
   const parts=String(html).split(/(?=<div class="fr-depth )/).filter(Boolean),make=()=>doc.createElement('template');
   if(!win.requestAnimationFrame||!('content' in make())){
     target.innerHTML=html;
     const all=Promise.resolve();
     return {target,sync:true,ready:parts.map(()=>all),done:all,cancel(){}};
   }
   const shells=parts.map(part=>{
     const t=make();
     t.innerHTML=part.slice(0,part.indexOf('>')+1)+'</div>';
     const shell=t.content.firstElementChild;
     shell?.setAttribute('data-fr-filling','');
     return shell;
   });
   target.replaceChildren(...shells);
   let cancelled=false,at=0,parsed=0;const queue=[],marks=[],ready=shells.map(()=>new Promise(r=>marks.push(r)));
   function expand(i){
    const t=make();t.innerHTML=parts[i];const ground=t.content.firstElementChild;
    for(const child of [...(ground?.childNodes||[])]){
     const cls=child.nodeType===1?child.getAttribute('class')||'':'',w=weigh(child);
     if(child.nodeType===1&&child.tagName.toLowerCase()==='svg'&&SPLIT.test(cls)&&w>BUDGET){
      let part=null,sum=0;
      for(const g of [...child.childNodes]){
        const gw=weigh(g);
        if(!part||sum+gw>BUDGET&&sum>0){part=child.cloneNode(false);queue.push({i,node:part,w:0});sum=0;}
        part.append(g);
        sum+=gw;
        queue[queue.length-1].w=sum;
      }
     }else queue.push({i,node:child,w});
    }
    queue.push({i,end:true});
   }
   function put(limit){
    let spent=0;
    while(spent<limit){
     if(at>=queue.length){if(parsed>=parts.length)return false;expand(parsed++);spent+=parts[parsed-1].length/6;continue;}
     const item=queue[at++];if(item.end){shells[item.i]?.removeAttribute('data-fr-filling');marks[item.i]();if(item.i===0&&limit===Infinity)return true;continue;}
     shells[item.i].append(item.node);spent+=item.w;
    }
    return true;
   }
   // a stop (a rebuild, the room closing) lets everyone waiting on a ground go on
   const stop=()=>{if(cancelled)return;cancelled=true;for(const shell of shells)shell?.removeAttribute('data-fr-filling');for(const mark of marks)mark();};
   // the share follows the machine: a slow frame halves the next share, a quick one lets it grow back
   let share=BUDGET,last=0;
   const step=t=>{
     if(cancelled)return;
     if(!target.isConnected){stop();return;}
     const gap=last?t-last:16;
     last=t;
     share=gap>34?Math.max(BUDGET/4,share/2):gap<20?Math.min(BUDGET*1.5,share*1.25):share;
     if(put(share))win.requestAnimationFrame(step);
   };
   put(Infinity);win.requestAnimationFrame(step);
   return {target,ready,done:Promise.all(ready),cancel:stop};
  }
  // A new place is on show: the sun and the sky are placed afresh (no slide from where the old place had them).
  function shown(){
   sunAt='';sunT0=null;lastMinute=-1;skyKey='';rise=false;
  }
  // The place's scale is set on the stage itself and the controls' size on the room only when they change: a value set on
  // the room restyles every drawing in it (entering full screen, a resize).
  // (the room fills the window: its size is the window's, read without asking the browser to lay out the room first)
  let scaleNow='',sizeNow='',tagNow=0;
  function layout(){
   if(!panel)return;let w=win.innerWidth,h=win.innerHeight;
   if(!(w>0&&h>0)){const rect=panel.clientWidth?null:panel.getBoundingClientRect?.();w=panel.clientWidth||rect?.width||1440;h=panel.clientHeight||rect?.height||900;}
   const sv=Math.max(w/1440,h/900),kv=Math.max(.62,Math.min(1.5,Math.min(w/1440,h/900))),s=String(+sv.toFixed(4)),k=String(+kv.toFixed(4));
   for(const st of panel.querySelectorAll?.('[data-fr-stage]')||[])if(st.style?.getPropertyValue?.('--fr-s')!==s)st.style?.setProperty('--fr-s',s);scaleNow=s;
   if(sizeNow!==k){sizeNow=k;panel.style?.setProperty('--fr-k',k);}
   // the task tag keeps clear of the sun's arc: as wide as it can be at this shape of window, redrawn at that width
   const tw=tagWidth(w,h,sv,kv);if(tw!==tagNow){tagNow=tw;panel.style?.setProperty('--fr-tagw',String(tw));
    if(TAG.w!==tw){
      TAG.w=tw;
      const art=q('[data-fr-task] > .fr-bigtag-art'),html=Art()?.bigTag(TAG.w,TAG.h);
      if(art&&html){const t=doc.createElement('template');t.innerHTML=html;if(t.content?.firstElementChild)art.replaceWith(t.content.firstElementChild);}
    }}
   const lift=liftFor(w,h,sv,kv);if(lift!==liftNow){liftNow=lift;panel.style?.setProperty('--fr-lift',lift+'px');}
  }
  // The seal row never comes down onto the mountains: its bottom (worked out from the sizes in focus-room.css, the
  // column at 17% of the window) is set against the place's ridge line under the row's width, and the column is lifted
  // by what it would cross, plus a margin. Read from the drawing's numbers, never from the page's layout.
  let liftNow=0;
  function liftFor(w,h,s,k){
   const A=Art(),place=panel?.dataset?.place||shared.prefs.place,ridge=A?.stage?.(place,{night:night||place==='fire'})?.ridge;
   if(!Array.isArray(ridge)||!ridge.length)return 0;
   const bottom=.17*h+276*k,half=290*k,x0=720+(-half-8)/s,x1=720+(half+8)/s;let top=Infinity;
   for(const line of ridge)for(let i=0;i<line.length-1;i++){const [ax,ay]=line[i],[bx,by]=line[i+1];if(bx<x0||ax>x1)continue;
    for(const x of [Math.max(ax,x0),Math.min(bx,x1)])top=Math.min(top,ay+(by-ay)*(x-ax)/((bx-ax)||1));}
   if(!Number.isFinite(top))return 0;const ridgeAt=h/2+(top-450)*s;
   return Math.round(Math.max(0,Math.min(.17*h-24,bottom+12*k-ridgeAt)));
  }
  // The sky, the sun and the shadows follow the session.
  function light(v){
   if(!panel)return;const place=panel.dataset.place||shared.prefs.place,isNight=night||place==='fire',minute=Math.floor(v.elapsed/60);
   let p=v.progress;if(motion()!=='gentle'&&v.running&&v.mode!=='done'){p=v.open?Math.min(1,minute/OPEN_MINUTES):Math.min(1,minute*60/Math.max(60,v.total));}
   // the sky's colours and the shadows' lengths move on in sixtieths of the session, and each value is written only on
   // the few elements that read it (the sky layer and the sun, the water layers, the tint, the two shadow layers):
   // written on the room, every step restyled all two thousand drawn shapes in it
   const step=Math.round(p*60)/60,key=!isNight&&!kit?place+':'+step:'',shade=String(+step.toFixed(4));
   for(const layer of stageEl?.querySelectorAll?.('.fr-am,.fr-pm')||[])if(layer.style?.getPropertyValue?.('--fr-p')!==shade)layer.style?.setProperty('--fr-p',shade);
   if(key!==skyKey){const from=skyKey;skyKey=key;fadeSky(from,key);const vars=key?daylight(step,place):null;
    const put=(nodes,names)=>{
      for(const node of nodes)if(node)for(const name of names){if(vars)node.style?.setProperty(name,vars[name]);else node.style?.removeProperty(name);}
    };
    put(stageEl?.querySelectorAll?.('.fr-skyl,.fr-sun')||[],['--fr-sky0','--fr-sky1','--fr-sky2','--fr-sky3','--fr-sun']);
    put(stageEl?.querySelectorAll?.('.fr-mid,.fr-mid2')||[],['--fr-water']);put([q('.fr-tint')],['--fr-tint','--fr-tint-o']);}
   placeSun(sunT(v.mode,p));
  }
  // A big change of light (+5, Finish, a break) is not a jump of the whole sky: a copy of the sky as it was stays on
  // top in its old colours and fades away while the sun travels (opacity only, on the sky layer alone). The small
  // sixtieth-of-a-session steps change in place.
  function fadeSky(from,to){
   if(!from||!to||motion()!=='gentle')return;const a=from.split(':'),b=to.split(':');if(a[0]!==b[0]||Math.abs(Number(a[1])-Number(b[1]))<=2/60+1e-9)return;
   const sky=stageEl?.querySelector?.('.fr-skyl');if(!sky?.cloneNode||!win.getComputedStyle)return;
   // (a fade still running stays on top and runs out: two big changes in a row blend, no copy is cut short)
   let cs=null;try{cs=win.getComputedStyle(sky);}catch{}if(!cs)return;
   const ghost=sky.cloneNode(true);
   ghost.classList.add('fr-skyfade');
   for(const name of ['--c-sky0','--c-sky1','--c-sky2','--c-sky3','--c-sun']){const value=cs.getPropertyValue(name);if(value)ghost.style.setProperty(name,value.trim());}
   sky.after(ghost);const fade=animate(ghost,[{opacity:1},{opacity:1,offset:.12},{opacity:0}],{duration:1500,easing:PEN(),fill:'forwards'});
   if(fade)done(fade).then(()=>ghost.remove());else ghost.remove();
  }
  const at2=([x,y],dy=0)=>`translate(${x.toFixed(1)}px,${(y+dy).toFixed(1)}px)`;
  // Put a sun straight at a point with no slide (first placement, a reset to the start, Still and Motion off).
  function jumpTo(node,at){
    moving.get(node)?.cancel?.();
    moving.delete(node);
    node.classList?.add('fr-sun-jump');
    node.style.transform=at;
    void node.getBoundingClientRect?.();
    node.classList?.remove('fr-sun-jump');
  }
  // Carry a sun along its arc through sampled points (a big jump: Finish, +5, a new session), overshoot a hair, settle.
  function travel(node,from,to,point,at){
   moving.get(node)?.cancel?.();const ease=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2,os=(to>from?1:-1)*.0025,n=10,frames=[];
   for(let i=0;i<=n;i++)frames.push({transform:at2(point(from+(to+os-from)*ease(i/n))),offset:+(i/n*.84).toFixed(4)});
   frames[n].easing=PEN();frames.push({transform:at,offset:1});
   node.classList?.add('fr-sun-jump');node.style.transform=at;
   const a=animate(node,frames,{duration:Math.round(Math.min(1500,520+900*Math.sqrt(Math.abs(to-from)))),easing:'linear'});
   if(!a){node.classList?.remove('fr-sun-jump');return;}
   routes.set(a,{from,to,end:to+os,n,ease});
   moving.set(node,a);done(a).then(()=>{if(moving.get(node)===a){moving.delete(node);a.cancel?.();node.classList?.remove('fr-sun-jump');}});
  }
  // Where a travelling sun is on its arc right now (its keyframes are points sampled along the arc, linear between).
  const routes=new WeakMap();
  function along(a){
   const r=routes.get(a);if(!r)return null;let k=0;try{k=(Number(a.currentTime)||0)/(Number(a.effect?.getTiming?.().duration)||1);}catch{}
   if(k>=.84)return r.to;const f=Math.max(0,k/.84)*r.n,j=Math.min(r.n-1,Math.floor(f)),e=r.ease(j/r.n)+(r.ease((j+1)/r.n)-r.ease(j/r.n))*(f-j);return r.from+(r.end-r.from)*e;
  }
  // A new big change while the sun is still travelling (+5 twice): it turns from where it is, not from where it was
  // going, and never jumps there when the first trip ends.
  function retravel(node,t,point,at){
   const a=moving.get(node),r=a&&routes.get(a);if(!r||motion()!=='gentle'||Math.abs(t-r.to)<=.02)return false;
   const u=along(a);if(u===null)return false;travel(node,u,t,point,at);return true;
  }
  // A new session: from the ridge the sun dips, then rises along its arc and settles; if it was up (after the end, or a
  // break) it first sets at the far end, and rises again from below the near ridge.
  function sunrise(node,prev,t,at){
   const A=Art(),P=u=>A.arc(u),frames=[];let base;
   if(prev>.01){const n=5;frames.push({transform:at2(P(prev)),offset:0,easing:'ease-out'},{transform:at2(P(prev),-3),offset:.05,easing:'cubic-bezier(.5,0,.9,.6)'});
    for(let i=1;i<=n;i++)frames.push({transform:at2(P(prev+(1.06-prev)*i/n)),offset:+(.05+.27*i/n).toFixed(4)});
    frames.push({transform:at2(P(-.06)),offset:.3201},{transform:at2(P(-.06)),offset:.42,easing:'ease-in'});base=.42;}
   else{frames.push({transform:at2(P(0)),offset:0,easing:'ease-in'},{transform:at2(P(0),4),offset:.14,easing:'ease-out'});base=.14;}
   const from=prev>.01?-.06:0,n=6;for(let i=1;i<=n;i++){const u=i/n,e=1-Math.pow(1-u,2.2);frames.push({transform:at2(P(from+(t+.0025-from)*e)),offset:+(base+(.86-base)*u).toFixed(4)});}
   frames[frames.length-1].easing=PEN();frames.push({transform:at,offset:1});
   moving.get(node)?.cancel?.();node.classList?.add('fr-sun-jump');node.style.transform=at;
   const a=animate(node,frames,{duration:prev>.01?2800:1500,easing:'linear'});
   if(!a){node.classList?.remove('fr-sun-jump');return;}
   moving.set(node,a);done(a).then(()=>{if(moving.get(node)===a){moving.delete(node);a.cancel?.();node.classList?.remove('fr-sun-jump');}});
  }
  // The glitter keeps to open water: under the sun's column, the rows from the top of whatever stands on the lake there
  // (the boat, Biscuit and his 'z z', the kettle, the lantern; the drawing's own boxes) down are put out, and come back
  // when the sun has passed it.
  function cutGlint(glint,cx){
   const A=Art(),
     place=panel?.dataset?.place||shared.prefs.place,
     boxes=A?.stage?.(place,{night:night||place==='fire'})?.boxes||[],
     rows=glint.querySelectorAll('.fr-gl'),
     y0=(A?.HZ||560)+24;
   // (the boat's box reaches up to its rod's tip; the glitter stops at its hull, 36 px lower)
   let top=Infinity;for(const [name,bx0,by0,bx1,by1] of boxes){if(bx1<cx-34||bx0>cx+34||by1<y0||by0>y0+120)continue;top=Math.min(top,name==='boat'?by0+36:by0);}
   let k=0;for(let i=0;i<rows.length;i++){if(y0+10*i+4<top-8)k=i+1;else break;}
   if(glint.dataset.cut===String(k))return;glint.dataset.cut=String(k);rows.forEach((row,i)=>{row.style.opacity=i<k?'':'0';});
  }
  function placeSun(t){
   const A=Art(),sun=stageEl?.querySelector('.fr-sun');if(!sun||!A)return;
   const [x,y]=A.arc(t),at=at2([x,y]),prev=sunT0,lvl=motion();sunT0=t;
   const glint=stageEl.querySelector('.fr-glint');if(glint){const g=`translateX(${(x-40).toFixed(1)}px)`;if(glint.style.transform!==g)glint.style.transform=g;cutGlint(glint,x+40);}
   if(rise){rise=false;if(lvl==='gentle'&&prev!==null){sunAt=at;sunrise(sun,prev,t,at);return;}}
   if(at===sunAt)return;sunAt=at;
   if(moving.has(sun)){if(!retravel(sun,t,A.arc,at))sun.style.transform=at;return;}
   if(prev===null||lvl!=='gentle'||t<prev-.02&&t<=.031){jumpTo(sun,at);return;}
   if(Math.abs(t-prev)>.02){travel(sun,prev,t,A.arc,at);return;}
   sun.style.transform=at;
  }
  function setText(node,text){if(node&&node.textContent!==text)node.textContent=text;}
  function setHidden(node,hide){if(node&&node.hidden!==hide)node.hidden=hide;}
  function apply(scope,v,n){
   if(!scope)return;const where=scope.getRootNode?.(),had=where&&where.activeElement||doc.activeElement;
   if(scope.dataset.mode!==v.mode)scope.dataset.mode=v.mode;
   for(const node of scope.querySelectorAll('[data-fr-time]'))setText(node,v.time);
   for(const node of scope.querySelectorAll('[data-fr-label]'))setText(node,v.label);
   for(const seal of scope.querySelectorAll('[data-fr-seal]')){
     const word=seal.querySelector('[data-fr-seal-label]');
     setText(word,v.seal);
     if(word&&word.dataset.len!==sealLen(v.seal))word.dataset.len=sealLen(v.seal);
     if(seal.dataset.rdAction!==v.sealAction)seal.dataset.rdAction=v.sealAction;
     if(v.sealAction==='focus-back')seal.dataset.minutes=String(v.back||shared.prefs.length);else seal.removeAttribute?.('data-minutes');
     if(seal.getAttribute('aria-label')!==v.seal)seal.setAttribute('aria-label',v.seal);
   }
   for(const node of scope.querySelectorAll('[data-fr-plus]'))setHidden(node,!v.plus);for(const node of scope.querySelectorAll('[data-fr-finish]'))setHidden(node,!v.adjust);
   for(const node of scope.querySelectorAll('[data-fr-break]'))setHidden(node,!v.offerBreak);
   // the control that had the keyboard has just hidden itself (Finish, Break): the seal in the same place takes it
   if(had&&had!==scope&&scope.contains?.(had)&&(had.hidden||had.closest?.('[hidden]')))scope.querySelector('[data-fr-seal]')?.focus?.({preventScroll:true});
   for(const node of scope.querySelectorAll('[data-fr-lengths]')){
     setHidden(node,!v.lengths);
     for(const b of node.querySelectorAll('[data-rd-action="timer-minutes"]')){const value=b.dataset.open==='true'?'open':b.dataset.minutes;b.setAttribute('aria-pressed',String(v.pressed===value));}
   }
   for(const node of scope.querySelectorAll('[data-fr-tally]'))
     if(node.dataset.n!==String(n)){
       const grew=Number(node.dataset.n)<n;
       node.dataset.n=String(n);
       node.innerHTML=`${Art()?.tallyArt(n)||''}<span aria-hidden="true">today</span>`;
       node.setAttribute('aria-label',`${n} today`);
       node.hidden=!n;
       if(grew&&motion()!=='off')node.classList?.add('fr-tally-new');
     }
   // the module's sun keeps to its little arc too: big jumps travel it, a reset to the start goes straight back
   for(const sun of scope.querySelectorAll('[data-fr-mod-sun]')){const t=sunT(v.mode,v.progress),[x,y]=sunPoint(v),at=at2([x,y]);if(sun.style.transform===at)continue;
    const prev=Number(sun.getAttribute('data-fr-t'));sun.setAttribute('data-fr-t',String(+t.toFixed(4)));
    if(moving.has(sun)){if(!retravel(sun,t,u=>Art()?.miniPoint(u)||[80,0],at))sun.style.transform=at;}
    else if(!Number.isFinite(prev)||motion()!=='gentle'||t<prev-.02&&t<=.031)
      jumpTo(sun,at);
    else if(Math.abs(t-prev)>.02)travel(sun,prev,t,u=>Art()?.miniPoint(u)||[80,0],at);else sun.style.transform=at;}
  }
  // When the session changes mode (Start, Finish, a break, back to it) the room's middle column changes its controls:
  // the lengths go and +5 and Finish come, the tally arrives. Nothing jumps: what stays glides to its new place and
  // settles, what arrives rises in with a small overshoot, what leaves fades down where it was (a copy, the control
  // itself is already gone). Transforms and opacity only; the glides add to a press that is still swinging.
  const SHELF=['[data-fr-time]','[data-fr-label]','[data-fr-lengths]','[data-fr-tally]','[data-fr-seal]','[data-fr-plus]','[data-fr-finish]','[data-fr-break]'];
  function shelf(){
   const center=q('.fr-center');if(!center?.getBoundingClientRect)return null;
   return SHELF.map(sel=>{
     const node=center.querySelector(sel);
     const r=node&&!node.hidden?node.getBoundingClientRect():null;
     return {node,rect:r&&r.width?r:null};
   }).filter(x=>x.node);
  }
  function ghostOf(node,r){
   const g=node.cloneNode(true);
   for(const el of [g,...g.querySelectorAll('*')]){for(const a of [...el.attributes])if(/^(data-fr-|data-rd-|id$|aria-describedby|aria-controls)/.test(a.name))el.removeAttribute(a.name);}
   g.hidden=false;g.inert=true;g.setAttribute('aria-hidden','true');g.style.cssText+=`;position:absolute;left:${r.left.toFixed(1)}px;top:${r.top.toFixed(1)}px;width:${r.width.toFixed(1)}px;height:${r.height.toFixed(1)}px;margin:0;pointer-events:none`;return g;
  }
  function restack(list){
   const ui=q('.fr-ui');
   for(const {node,rect:r0} of list){
    const r1=!node.hidden&&node.isConnected?node.getBoundingClientRect():null,shown=!!r1?.width;
    if(r0&&shown){
      const dx=r0.left-r1.left,dy=r0.top-r1.top;
      if(Math.abs(dx)>.5||Math.abs(dy)>.5)
        animate(
          node,
          [{transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`},{transform:`translate(${(-dx*.03).toFixed(1)}px,${(-dy*.03).toFixed(1)}px)`,offset:.8},{transform:'translate(0px,0px)'}],
          {duration:340,easing:SETTLE(),composite:'add'});
    }
    else if(!r0&&shown)
      animate(
        node,
        [
          {opacity:0,transform:'translateY(9px) scale(.94)'},
          {opacity:0,transform:'translateY(9px) scale(.94)',offset:.22},
          {opacity:1,transform:'translateY(-1.5px) scale(1.02)',offset:.78},
          {opacity:1,transform:'none'}
        ],
        {duration:400,easing:SETTLE()});
    else if(r0&&!shown&&ui){
      const g=ghostOf(node,r0);
      ui.append(g);
      const a=animate(g,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(6px) scale(.95)'}],{duration:200,easing:LETGO(),fill:'forwards'});
      if(a)done(a).then(()=>g.remove());else g.remove();
    }
   }
  }
  // On Home the dashboard redraws the module's controls for a new mode; the ones that have just come (+5 and Finish at
  // Start, the lengths at the end, Break) rise in with a small overshoot instead of appearing.
  const seenMods=new WeakMap();
  function riseIn(mod,v){
   const vis=SHELF.map(sel=>{const node=mod.querySelector(sel);return !!node&&!node.hidden;}),was=seenMods.get(mod);seenMods.set(mod,{mode:v.mode,vis});
   if(!was||was.mode===v.mode||motion()!=='gentle')return;
   SHELF.forEach((sel,i)=>{
     if(vis[i]&&!was.vis[i])
       animate(
         mod.querySelector(sel),
         [{opacity:0,transform:'translateY(6px) scale(.94)'},{opacity:1,transform:'translateY(-1px) scale(1.02)',offset:.75},{opacity:1,transform:'none'}],
         {duration:340,easing:SETTLE()});
   });
  }
  function syncTask(){
   if(!panel)return;let task=null;try{task=getTask();}catch{}
   const box=q('[data-fr-task]');if(!box)return;setText(box.querySelector('[data-fr-task-title]'),task?.title||'Free study');
   {
     const m=box.querySelector('[data-fr-task-meta]'),parts=task?[task.course,task.due?`due ${task.due}`:''].filter(Boolean):[],html=parts.map(esc).map(part=>`<span>${part}</span>`).join(' · ');
     if(m&&typeof m.innerHTML==='string'){if(m.innerHTML!==html)m.innerHTML=html;}else setText(m,parts.join(' · '));
   }
   box.style?.setProperty('--fr-course',task?.color||'');
  }
  function stamp(seal){
   if(!seal||motion()!=='gentle')return;
   animate(
     seal.querySelector?.('.fr-seal-art')||seal,
     [
       {transform:'none'},
       {transform:'translateY(-12px) rotate(-7deg) scale(1.1)',offset:.32},
       {transform:'translateY(3px) rotate(0deg) scale(1.08,.84)',offset:.5},
       {transform:'translateY(-2px) scale(.97,1.04)',offset:.66},
       {transform:'translateY(0) scale(1.01,.99)',offset:.82},
       {transform:'none'}
     ],
     {duration:980,easing:SETTLE()});
  }
  // Small life tied to what just happened. The end: dusk, the lantern, Biscuit wakes and cheers, the tally, a chime.
  function play(kind){
   if(!panel)return;const lvl=motion(),id=++moment;
   if(kind==='end'){
    afterEnd=true;
    if(lvl==='off'){panel.dataset.frAfter='end';panel.removeAttribute?.('data-fr-moment');sound.chime();return;}
    panel.dataset.frMoment='end';panel.removeAttribute?.('data-fr-after');sound.chime();win.setTimeout(()=>{if(id===moment&&panel)stamp(q('[data-fr-seal]'));},350);
    if(shared.prefs.place==='rain')win.setTimeout(()=>{if(id===moment)sound.thin();},900);
    if(shared.prefs.place==='fire')win.setTimeout(()=>{if(id===moment)sound.whistle();},2200);
    win.setTimeout(()=>{if(id===moment&&panel){panel.dataset.frAfter='end';panel.removeAttribute?.('data-fr-moment');}},lvl==='gentle'?5200:900);
    return;
   }
   if(kind==='start'){
    const from=afterEnd;afterEnd=false;panel.removeAttribute?.('data-fr-after');
    if(lvl==='off'){panel.removeAttribute?.('data-fr-moment');return;}
    panel.dataset.frMoment=from?'wake-start':'start';
    // the sun rises (light() carries it once the new session's point is known)
    rise=true;
    win.setTimeout(()=>{if(id===moment&&panel)panel.removeAttribute?.('data-fr-moment');},2400);
    return;
   }
   if(kind==='pause'||kind==='resume'){
    const word=q('.fr-paused');if(!word)return;word.classList.remove('fr-write','fr-rub');
    if(lvl==='off')return;void word.offsetWidth;word.classList.add(kind==='pause'?'fr-write':'fr-rub');
    return;
   }
   // "more" (+5) needs nothing of its own: the sun travels back along its arc in light()
  }
  function transitions(v){
   const prev=last;last={mode:v.mode,sessions:v.sessions,minutes:v.minutes,active:v.active};
   if(!prev||!panel)return;
   if(v.sessions>prev.sessions)return play('end');
   if((prev.mode==='ready'||prev.mode==='done'||prev.mode==='break-over'||prev.mode==='break')&&v.mode==='running')return play('start');
   if(prev.mode==='running'&&v.mode==='paused')return play('pause');
   if(prev.mode==='paused'&&v.mode==='running')return play('resume');
   if(v.active&&prev.active&&v.minutes>prev.minutes)return play('more');
  }
  function sync(){
   if(dead)return;const focus=store.get()?.focus,now=Date.now(),v=view(focus,now),n=tally(focus,now);
   if(v.mode==='running'&&!v.rest&&!v.open&&[25,50].includes(v.minutes)&&shared.prefs.length!==v.minutes){shared.prefs.length=v.minutes;savePrefs(store);}
   const grew=lastSessions!==null&&v.sessions>lastSessions;lastSessions=v.sessions;
   // on a dark page (the dark theme, a dark scene or kit) the module's drawing takes the night palette, as the room does
   const darkPage=!!themeOf().dark;shared.modNight=darkPage;
   for(const mod of container.querySelectorAll?.('[data-fr-mod]')||[]){
     if((mod.dataset.frNight==='true')!==darkPage){if(darkPage)mod.dataset.frNight='true';else mod.removeAttribute?.('data-fr-night');}
     apply(mod,v,n);
     if(grew&&!panel)stamp(mod.querySelector('[data-fr-seal]'));
     if(!panel)riseIn(mod,v);
   }
   if(!panel)return;
   if(!enabled()||blocked()){close();return;}
   if(panel.parentNode!==container)container.append(panel);
   if(settled)hideSiblings();
   // day turning to night (or back) while the room is open: the stroke washes the place over to its other light
   const look=themeOf();if(look.dark!==night||look.kit!==kit){night=look.dark;kit=look.kit;markKit();const place=shared.prefs.place,key=place+(night||place==='fire'?':n':':d');
    if(settled&&motion()==='gentle'&&key!==builtKey){
      if(washing)
        swapping=swapping.then(()=>{if(panel&&builtKey!==place+(night||place==='fire'?':n':':d'))return washTo(shared.prefs.place);}).catch(()=>{});
      else swapping=washTo(place).catch(()=>{});
    }
    else buildStage();}
   panel.dataset.motion=motion();
   const turn=settled&&motion()==='gentle'&&panel.dataset.mode&&panel.dataset.mode!==v.mode?shelf():null;
   apply(panel,v,n);if(turn)restack(turn);transitions(v);light(v);
  }
  // the room's moves stamp the dashboard with when they end, so the companion keeps still meanwhile (pets.js)
  const busyFor=ms=>{try{const t=Date.now()+ms;if(!(Number(container.dataset.chMoving)>=t))container.dataset.chMoving=String(t);}catch{}};
  const moduleFrame=()=>{const mod=container.querySelector('[data-fr-mod]');return mod?.closest?.('.rd-widget')||mod||null;};
  // Growing and folding back. In: the module dips (anticipation), a sheet of the room's sky grows out of its frame,
  // the place comes in one ground at a time from the back (each rises past its place and settles), and the controls
  // glide from the module to the room and land. Out: the grounds fold away front first, the sheet shrinks back into
  // the module's frame, and the frame gives a small settle. Only transforms and opacity are animated.
  // A move that starts while the other is still playing (Esc while the room is still growing, Room again while it is
  // folding) takes over from where every piece is at that moment: no jump back to the start, no waiting in a queue.
  let morphId=0,flight=[],openedFrom=null;
  function takeOver(){
   const now=new Map();if(!flight.length)return now;
   for(const a of flight){
     const el=a?.effect?.target;
     if(!el||now.has(el))continue;
     try{const cs=win.getComputedStyle(el);now.set(el,{transform:cs.transform||'none',opacity:cs.opacity===''?'1':cs.opacity});}catch{}
   }
   for(const a of flight)a?.cancel?.();flight=[];return now;
  }
  async function morph(direction,rect){
   const lvl=motion(),now=takeOver(),id=++morphId;
   if(lvl==='off'||!panel)return;
   const vw=win.innerWidth||1440,vh=win.innerHeight||900,into=direction==='in',caught=now.size>0;
   // the first frame of a move is where it is now when it took over from another
   const at=(el,frame)=>now.has(el)?{...frame,...now.get(el)}:frame;
   const go=(el,frames,options)=>{if(!el)return null;frames[0]=at(el,frames[0]);const a=animate(el,frames,options);if(a)flight.push(a);return a;};
   const anims=[];
   if(lvl==='still'||!rect||!rect.width){
     anims.push(go(panel,into?[{opacity:0},{opacity:1}]:[{opacity:1},{opacity:0}],{duration:into?320:260,easing:'linear',fill:'forwards'}));
     await Promise.all(anims.map(done));
     if(id===morphId){flight=[];if(into)for(const a of anims)a?.cancel?.();}
     return;
   }
   const sheet=q('.fr-sheet'),depths=[...(stageEl?.children||[])].filter(n=>n.classList?.contains('fr-depth')),frame=moduleFrame();
   const there=`translate(${rect.left.toFixed(1)}px,${rect.top.toFixed(1)}px) scale(${(rect.width/vw).toFixed(4)},${(rect.height/vh).toFixed(4)})`;
   // every box is read before anything is written (the sheet's size, the morphing class): a read after a write made the
   // key press lay out the whole page and the room before the first frame of the move
   const mod=container.querySelector('[data-fr-mod]'),pairs=[];
   for(const sel of ['[data-fr-time]','[data-fr-seal]','[data-fr-plus]','[data-fr-finish]']){
    const a=q(sel),b=mod?.querySelector(sel);
    if(!a||!b||a.hidden||b.hidden)continue;
    const ra=a.getBoundingClientRect?.(),rb=b.getBoundingClientRect?.();
    if(!ra?.width||!rb?.width)continue;
    pairs.push([a,ra,rb]);
   }
   // (the close counts its module's settle, which plays after the fold lands)
   busyFor(into?900:820);
   // the sheet is sized in pixels for the whole move: leaving full screen resizes the room under it, and a sheet sized
   // in per cent would land short of the module
   if(sheet?.style){sheet.style.width=vw+'px';sheet.style.height=vh+'px';}
   panel.classList?.add('fr-morphing');
   if(into){
    if(!caught)anims.push(go(frame,[{transform:'none'},{transform:'scale(.975)'}],{duration:70,easing:PEN(),fill:'forwards'}));
    anims.push(go(
      sheet,
      caught?
        [{transform:there,opacity:1},{transform:'none',opacity:1}]:
        [{transform:there,opacity:0},{transform:there,opacity:0,offset:.134},{transform:there,opacity:1,offset:.135,easing:SETTLE()},{transform:'none',opacity:1}],
      {duration:caught?380:520,easing:caught?SETTLE():'linear',fill:'both'}));
    // a ground that is still going in waits, unseen, and comes in once it is all there (at once on a quick machine)
    const clock=()=>win.performance?.now?.()??Date.now(),t0=clock(),wait=filling&&!filling.sync&&filling.target===stageEl?filling.ready:null;
    depths.forEach((d,i)=>{
     const enter=(waited=false)=>
       go(
         d,
         [{opacity:0,transform:'translateY(12px)',easing:SETTLE()},{opacity:1,transform:'translateY(-2px)',offset:.7,easing:PEN()},{opacity:1,transform:'none'}],
         {duration:360,delay:waited?Math.max(0,(caught?0:120)+i*22-(clock()-t0)):(caught?0:120)+i*22,fill:'both'});
     if(!wait?.[i]){anims.push(enter());return;}
     const hold=go(d,[{opacity:0},{opacity:0}],{duration:6e4,fill:'both'});
     anims.push(wait[i].then(()=>{if(id!==morphId)return null;hold?.cancel?.();flight=flight.filter(a=>a!==hold);return enter(true);}));
    });
   }else{
    depths.slice().reverse().forEach((d,i)=>anims.push(go(d,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(10px)'}],{duration:180,delay:i*20,easing:LETGO(),fill:'forwards'})));
    // the sheet lands on the module and melts into it: never cut from the sheet to the module in one frame
    anims.push(go(sheet,[{transform:'none',opacity:1,easing:SETTLE()},{transform:there,opacity:1,offset:.76,easing:'linear'},{transform:there,opacity:0}],{duration:430,easing:'linear',fill:'both'}));
   }
   // The controls glide between their places in the module and in the room, and land with a small settle.
   for(const [a,ra,rb] of pairs){
    // a glide that is under way is measured where it would rest (its box does not move with its transform)
    const k=rb.height/ra.height,dx=rb.left+rb.width/2-(ra.left+ra.width/2),dy=rb.top+rb.height/2-(ra.top+ra.height/2),from=`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${k.toFixed(3)})`;
    anims.push(go(
      a,
      into?
        (now.has(a)?
          [{transform:from,opacity:1},{transform:'scale(1.03)',offset:.8,easing:FADE()},{transform:'none',opacity:1}]:
          [
            {transform:from,opacity:0},
            {transform:from,opacity:0,offset:.155},
            {transform:from,opacity:1,offset:.156,easing:SETTLE()},
            {transform:'scale(1.03)',offset:.84,easing:FADE()},
            {transform:'none',opacity:1}
          ]):
        [{transform:'none',opacity:1},{transform:from,opacity:1}],
      {duration:into?(now.has(a)?380:450):300,easing:into?(now.has(a)?SETTLE():'linear'):SETTLE(),fill:'both'}));
   }
   for(const sel of ['[data-fr-task]','.fr-place','.fr-close','[data-fr-label]','[data-fr-lengths]','[data-fr-tally]'])
     anims.push(go(
       q(sel),
       into?[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(-1.5px)',offset:.8},{opacity:1,transform:'none'}]:[{opacity:1},{opacity:0}],
       {duration:into?300:160,delay:into&&!caught?220:0,easing:into?SETTLE():LETGO(),fill:into?'both':'forwards'}));
   const all=await Promise.all(anims.map(a=>Promise.resolve(a)));await Promise.all(all.map(done));
   // a move that was taken over leaves the panel to the one that took over
   if(id!==morphId)return;
   flight=[];
   if(into){for(const a of all)a?.cancel?.();panel?.classList?.remove('fr-morphing');}
  }
  // The module's frame lands after the room has folded back into it.
  function settleFrame(){
    if(motion()!=='gentle')return;
    const o='50% 100%';
    animate(
      moduleFrame(),
      [{transform:'none',transformOrigin:o},{transform:'scaleY(1.02)',transformOrigin:o,offset:.3},{transform:'scaleY(.99)',transformOrigin:o,offset:.65},{transform:'none',transformOrigin:o}],
      {duration:240,easing:SETTLE()});
  }
  function sourceRect(from){
   const mod=container.querySelector('[data-fr-mod]'),frame=mod?.closest?.('.rd-widget')||mod;
   const r=frame?.getBoundingClientRect?.();if(r&&r.width&&r.bottom>0&&r.top<(win.innerHeight||900))return r;
   const o=from?.getBoundingClientRect?.();return o&&o.width?o:null;
  }
  // The place's sound starts once the room has grown: making the audio context takes a long moment, and in the click
  // it held up the first frame of the move (the click has already allowed the page to play sound).
  function startSound(version){
    if(panel&&version===opening&&!sound.playing){sound.play(shared.prefs.place);sound.setLevel(shared.prefs.volume,shared.prefs.quiet);}
  }
  async function open(from){
   if(dead||!enabled()||blocked())return false;
   // Room again while the room is still folding back: it grows again from where it has got to.
   if(panel&&closing){
    const version=++opening;closing=null;letThrough(panel,false);win.addEventListener?.('resize',layout);doc.addEventListener?.('visibilitychange',visibility);
    const back=sourceRect(from);if(back)openedFrom={node:moduleFrame(),rect:back};
    await morph('in',back);
    if(version!==opening||!panel)return false;
    settled=true;live();hideSiblings();(q('[data-fr-seal]')||q('[data-rd-action="room-close"]'))?.focus?.({preventScroll:true});startSound(version);
    try{if(!full()&&container.requestFullscreen){await container.requestFullscreen();await holdKeys();}}catch{}
    layout();return !!panel&&version===opening;
   }
   if(panel||closing)return false;
   opener=from||active();
   themeKey='';
   const version=++opening,rect=sourceRect(from),look=themeOf(),v=view(store.get()?.focus,Date.now());
   openedFrom=rect?{node:moduleFrame(),rect}:null;
   night=look.dark;kit=look.kit;settled=false;afterEnd=v.mode==='done';last=null;builtKey='';pickerOpen=false;
   const place=shared.prefs.place,key=place+(night||place==='fire'?':n':':d'),ready=spare&&spare.key===key&&spare.kit===kit&&spare.dark===night&&spare.p.isConnected?spare:null;
   if(ready){spare=null;win.clearTimeout?.(spareTimer);panel=ready.p;}else{dropSpare();panel=makePanel(v);}
   panel.dataset.motion=motion();markKit();if(afterEnd)panel.dataset.frAfter='end';
   stageEl=q('[data-fr-stage]');skyKey='';scaleNow='';sizeNow='';tagNow=0;swapping=Promise.resolve();
   container.dataset.chRoom='open';host()?.setAttribute?.('data-ch-room','');
   // a room built while the pointer rested on the way in is only shown (its place went in over those idle frames)
   if(ready){builtKey=ready.key;filling=ready.fill;buildStage();shown();layout();syncTask();panel.style?.removeProperty?.('visibility');
    const fill=filling;fill?.done?.then?.(()=>{if(panel&&filling===fill&&fill.target===stageEl){sunAt='';sync();}});}
   else{container.append(panel);buildStage(true,motion()==='gentle'&&!!rect?.width);}
   sync();
   const knob=q('.fr-knob');knob?.addEventListener?.('pointerdown',knobDown);
   win.addEventListener?.('resize',layout);doc.addEventListener?.('visibilitychange',visibility);visibility();
   if(motion()!=='gentle')startSound(version);
   await morph('in',rect);
   if(version!==opening||!panel)return false;
   // the hand-off: the focus moves first; Home goes out of sight a frame later and the never-ending loops start a frame
   // after that, so the three invalidations never share a frame
   settled=true;(q('[data-fr-seal]')||q('[data-rd-action="room-close"]'))?.focus?.({preventScroll:true});
   // then full screen, once the browser is idle: going full screen lays the whole dashboard out again, and doing it in the
   // frame the room landed in was the hitch of the landing; then the never-ending loops and the sound
   const next=fn=>{
     if(!win.requestAnimationFrame||!win.setTimeout){fn();return;}
     win.requestAnimationFrame(()=>win.setTimeout(()=>{if(version===opening&&panel&&!closing)fn();},0));
   };
   const idle=()=>new Promise(res=>{if(typeof win.requestIdleCallback==='function')win.requestIdleCallback(()=>res(),{timeout:180});else res();});
   await new Promise(res=>next(()=>{hideSiblings();res();}));await idle();
   if(version!==opening||!panel||closing)return false;
   try{
     if(!container.requestFullscreen)throw Error('Full screen unavailable');
     await container.requestFullscreen();
     if(version!==opening){if(full())await doc.exitFullscreen?.();return false;}
     await holdKeys();
   }
   catch{if(panel&&version===opening){const s=q('[data-fr-status]');if(s)s.textContent='Full screen unavailable';}}
   layout();next(()=>{live();startSound(version);});
   return !!panel;
  }
  function makePanel(v){
   const p=doc.createElement('section');p.className='fr-room';p.dataset.rdKeep='true';p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');p.setAttribute('aria-label','Focus room');
   let task=null;try{task=getTask();}catch{}p.innerHTML=markup(v,task);return p;
  }
  // Built on the way in: when the pointer rests on (or the keyboard reaches) a way into the room, the room is made at
  // once, out of sight (visibility:hidden: laid out, never painted, not focusable, not heard), and its place goes in a
  // share per frame while nothing else is happening. The press then only shows it and starts the grow, so the drawing no
  // longer fills in during the grow. A spare not used within half a minute is let go.
  let spare=null,spareTimer=0;
  function dropSpare(){if(!spare)return;win.clearTimeout?.(spareTimer);spare.fill?.cancel?.();spare.p.remove?.();spare=null;}
  function prebuild(){
   if(dead||panel||closing||spare||!enabled()||blocked()||motion()!=='gentle'||!win.requestAnimationFrame)return;
   const look=themeOf(),place=shared.prefs.place,dark=!!look.dark,isNight=dark||place==='fire',A=Art();if(!A?.stage)return;
   const p=makePanel(view(store.get()?.focus,Date.now()));p.style?.setProperty?.('visibility','hidden','important');
   p.dataset.place=place;p.dataset.night=String(isNight);p.dataset.pony=String(root.ReserveFeatures?.enabled?.('pony')!==false);
   if(look.kit){p.dataset.kit='true';p.dataset.kitDark=String(dark);}
   container.append(p);const st=p.querySelector('[data-fr-stage]');if(!st){p.remove();return;}
   spare={p,key:place+(isNight?':n':':d'),kit:!!look.kit,dark,fill:fillStage(st,A.stage(place,{night:isNight}).html)};
   spareTimer=win.setTimeout?.(dropSpare,30000)||0;
  }
  // The things that never stop (water, rain, fire, smoke, drifting cloud) start once the room has come in, so the
  // entrance never shares its frames with thirty loops (focus-room.css gates them on data-fr-live).
  function live(){if(panel&&!panel.hasAttribute?.('data-fr-live'))panel.setAttribute('data-fr-live','');}
  // In full screen the browser takes Escape to leave it, and the page never sees the key: the room asks for it, so a
  // short press closes the place picker first and then the room (pressing and holding Esc still leaves full screen).
  async function holdKeys(){try{await win.navigator?.keyboard?.lock?.(['Escape']);}catch{}}
  function freeKeys(){try{win.navigator?.keyboard?.unlock?.();}catch{}}
  // Focus goes back to the opener; if it was redrawn while the room was open, to "Room" on the module.
  let returning=false;
  function focusBack(){
   const live=node=>node&&node.isConnected!==false&&!node.hidden&&!node.disabled;
   const target=[
     opener,
     container.querySelector('.rd-widget-head [data-rd-action="room-open"]'),
     container.querySelector('[data-fr-mod] [data-rd-action="room-open"]'),
     container.querySelector('[data-rd-action="room-open"]')
   ].find(live);
   // (focus put back by the room is no student reaching for the room: it builds no spare room, which went in a share per
   // frame through the frames right after the fold)
   returning=true;try{target?.focus?.({preventScroll:true});}finally{returning=false;}
  }
  function close(exit=true){
   if(!panel)return Promise.resolve();if(closing)return closing;
   const p=panel,version=++opening;dropPrepared();
   // folding back, the room lets presses through: Room again lands on the module and takes the fold over (set on the
   // room and its few top-level controls only: a rule on every drawn shape restyled the whole room in the key press)
   letThrough(p,true);
   sound.stop();win.removeEventListener?.('resize',layout);doc.removeEventListener?.('visibilitychange',visibility);
   // the room's two thousand drawn shapes leave the page when the browser is idle: removed at once, they were the
   // long frame of the landing (it is out of sight already)
   const drop=()=>{p.style?.setProperty?.('display','none','important');if(win.requestIdleCallback)win.requestIdleCallback(()=>p.remove(),{timeout:1500});else p.remove();};
   const finish=()=>{
     if(panel!==p||version!==opening)return;
     restore();
     drop();
     panel=null;
     stageEl=null;
     closing=null;
     settled=false;
     container.removeAttribute?.('data-ch-room');
     host()?.removeAttribute?.('data-ch-room');
     focusBack();
     opener=null;
   };
   // no longer settled before full screen is left, so leaving it is not read as a second close
   settled=false;freeKeys();
   // The order out of full screen: full screen is left first, and the fold waits for the browser to have laid the page
   // out again at its window size (fullscreenchange, then that frame), with the room still covering everything and Home
   // see-through under it. Leaving full screen lays the whole page out again; inside the fold it was the fold's long
   // frames. The key still answers at once: the close mark goes down while the fold waits.
   const screen=exit&&full();
   if(screen){pressClose(p);Promise.resolve(doc.exitFullscreen?.()).catch(()=>{});}
   // The dashboard under the room kept its layout (see-through, still painted), so the module is measured at once and the
   // fold starts toward the module the room grew from. Home itself comes back a frame later: repainting the whole
   // dashboard is the one long frame of the close, and it runs while the sheet is already shrinking on the compositor.
   const fold=()=>{
    if(motion()==='off'||!win.requestAnimationFrame){restore();if(motion()==='off'){finish();return Promise.resolve();}}
    else win.requestAnimationFrame(()=>win.setTimeout(()=>{if(version===opening)restore();},0));
    // (an open that takes over while this is folding bumps the version: then nothing here touches the room)
    return (async()=>{const node=moduleFrame(),rect=node&&openedFrom?.node===node&&node.isConnected!==false?openedFrom.rect:sourceRect(null);
     await morph('out',rect);if(version!==opening)return;finish();if(rect)settleFrame();})();
   };
   if(!screen){const going=fold();if(panel===p&&version===opening)closing=going;return going;}
   closing=(async()=>{const t0=win.performance?.now?.()??Date.now();await screenBack();if(version!==opening||panel!==p)return;
    lastPause=Math.round((win.performance?.now?.()??Date.now())-t0);await fold();})();
   return closing;
  }
  // Leaving full screen: done once the browser says so (fullscreenchange) and the frame that lays the page out again at its
  // window size has gone by (a full screen that never answers is not waited for past 900 ms).
  // (the room's own fullscreenchange listener hears it: changed() below)
  let lastPause=0,screenWait=null;
  function screenBack(){
    return new Promise(res=>{
      let over=false;
      const go=()=>{
        if(over)return;
        over=true;
        if(screenWait===go)screenWait=null;
        win.clearTimeout?.(guard);
        if(win.requestAnimationFrame)win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>res()));else res();
      };
   const guard=win.setTimeout?.(go,900);if(!full())go();else screenWait=go;});}
  // the close mark goes down when the key or the press is heard, and stays down until the room folds away
  function pressClose(p){
    const mark=p?.querySelector?.('.fr-close svg')||p?.querySelector?.('.fr-close');
    if(mark)animate(mark,[{transform:'none'},{transform:'scale(.86) rotate(-4deg)'}],{duration:90,easing:SETTLE(),fill:'forwards'});
  }
  function letThrough(p,on){
    for(const n of [p,...(p?.querySelectorAll?.('.fr-ui > *')||[])]){if(on)n.style?.setProperty?.('pointer-events','none','important');else n.style?.removeProperty?.('pointer-events');}
  }
  function visibility(){if(panel){if(doc.visibilityState==='hidden')panel.dataset.hidden='true';else panel.removeAttribute?.('data-hidden');}}
  // The place picker: four cards flip up from the tag, with the volume knob and Quiet.
  let pickerFold=null;
  function togglePicker(on=!pickerOpen,focus=true){
   const picker=q('.fr-picker'),tag=q('[data-fr-act="places"]');if(!picker||!tag)return;pickerOpen=on;tag.setAttribute('aria-expanded',String(on));
   // opened again while it is still folding away: the fold lets go and the cards come up from where they are
   pickerFold?.cancel?.();pickerFold=null;
   if(on){
     picker.hidden=false;
     const gentle=motion()==='gentle',ground=picker.querySelector('.fr-picker-ground'),cards=gentle?[...picker.children].filter(c=>c!==ground):[];
     if(gentle&&ground)animate(ground,[{transform:'translateY(18px) scaleY(.35)',opacity:0},{transform:'none',opacity:1}],{duration:260,easing:SETTLE(),fill:'backwards'});
     cards.forEach((card,i)=>
       animate(
         card,
         [
           {transform:'perspective(700px) rotateX(-88deg)',opacity:0},
           {transform:'perspective(700px) rotateX(-88deg)',opacity:0,offset:.01},
           {transform:'perspective(700px) rotateX(4deg)',opacity:1,offset:.7},
           {transform:'none',opacity:1}
         ],
         {duration:320,delay:i*30,easing:SETTLE(),fill:'backwards'}));
     if(focus)picker.querySelector('[aria-pressed="true"]')?.focus?.({preventScroll:true});
   }
   else{
     dropPrepared();
     const fold=pickerFold=animate(picker,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(14px)'}],{duration:180,easing:'ease-in'});
     done(fold).then(()=>{if(pickerFold===fold)pickerFold=null;if(!pickerOpen&&picker)picker.hidden=true;});
     if(!fold)picker.hidden=true;
     if(focus)tag.focus?.({preventScroll:true});
   }
  }
  function choosePlace(id){
   if(!panel||!PLACES.includes(id)||id===shared.prefs.place)return swapping;
   shared.prefs.place=id;savePrefs(store);
   busyFor(1800);
   for(const card of panel.querySelectorAll('[data-fr-act="place"]'))card.setAttribute('aria-pressed',String(card.dataset.place===id));
   setText(q('[data-fr-place-name]'),NAMES[id]);
   sound.play(id);
   for(const mod of container.querySelectorAll?.('[data-fr-mod]')||[])mod.dataset.place=id;
   // A place chosen while the stroke is already on its way is the one it brings: the stroke never washes twice in a
   // row, and when it is already leaving it turns back from where it is and covers again.
   if(washing){washing.want=id;washing.kick?.();return swapping;}
   swapping=motion()==='gentle'?washTo(id).catch(()=>{}):swapping.then(()=>washTo(id)).catch(()=>{});
   return swapping;
  }
  const frames=n=>new Promise(resolve=>{
    const step=k=>{if(!k)return resolve();if(win.requestAnimationFrame)win.requestAnimationFrame(()=>step(k-1));else win.setTimeout(()=>step(k-1),16);};
    step(n);
  });
  // The room washes into another place. The next place is built first, under the one on show, and given two frames to
  // paint; then one wet stroke sweeps across, the places change under it while it covers the screen, it holds, and it
  // leaves while the new place's far, middle and near grounds settle in behind it.
  let washing=null;
  async function washTo(id){
   busyFor(1700);
   if(!panel||id!==shared.prefs.place)return;
   const washer=q('.fr-washer'),lvl=motion(),A=Art();
   if(lvl==='gentle'&&washer&&A&&stageEl?.parentNode?.insertBefore){
    const w={want:id,kick:null};washing=w;
    // the next place: the one already built while the pointer rested on its card, or built now, under the one on show a
    // share at a time (fillStage) while the stroke comes
    const build=place=>takePrepared(place)||buildNext(place);
    const drop=b=>{b.fill.cancel();b.next.remove();};
    // a ground is far enough in for the stroke to leave once the sky, the far and the middle grounds are in: the near
    // ones come in under the stroke as it goes (they are a share of a frame each by then)
    const enough=b=>Promise.all(b.fill.ready.slice(0,3));
    const swap=b=>{
      const old=stageEl;
      stageEl=b.next;
      b.next.classList?.remove('fr-stage-next');
      old?.remove?.();
      builtKey=b.place+(b.isNight?':n':':d');
      panel.dataset.place=b.place;
      panel.dataset.night=String(!!b.isNight);
      shown();
      layout();
      sync();
    };
    let from=null,cover=null;
    try{
     for(;;){
      let b=build(w.want);await frames(b.fill.sync?2:1);
      if(!panel){drop(b);return;}
      cover?.cancel?.();cover=animate(washer,[{transform:from||'translateX(-100%)'},{transform:'translateX(-14%)'}],{duration:from?380:460,easing:PEN(),fill:'forwards'});
      // the stroke covers the screen and holds there until the next place is all in
      await Promise.all([done(cover),enough(b)]);
      if(!panel){drop(b);return;}
      // chosen again while the stroke came or while it holds: the latest is built under it and goes on show instead
      for(;;){
       // (a place already swapped in stays until the next one is all in under it; one not yet on show is dropped)
       if(b.place!==w.want){const c=build(w.want);await enough(c);await frames(1);if(!panel){drop(c);return;}if(stageEl!==b.next)drop(b);b=c;}
       if(stageEl!==b.next)swap(b);
       await wait(220);if(!panel){cover?.cancel?.();return;}
       if(b.place===w.want)break;
      }
      // the new place settles behind the leaving stroke as one layer (the stage, by its own translate: its transform is
      // its scale), so only two full-screen layers move in any frame: the stroke and the place
      animate(b.next,[{translate:'0 8px'},{translate:'0 -2px',offset:.6},{translate:'0 0'}],{duration:700,delay:80,easing:SETTLE(),fill:'backwards'});
      const leave=animate(washer,[{transform:'translateX(-14%)'},{transform:'translateX(62.5%)'}],{duration:640,easing:PEN(),fill:'forwards'});
      const again=leave?await new Promise(res=>{w.kick=()=>res(true);done(leave).then(()=>res(false));}):false;
      w.kick=null;
      if(!again||!panel){cover?.cancel?.();leave?.cancel?.();return;}
      // chosen again while the stroke was leaving: it turns back from where it has got to and covers once more
      try{from=win.getComputedStyle(washer).transform;}catch{from=null;}if(!from||from==='none')from='translateX(-14%)';
      leave.cancel();cover?.cancel?.();cover=animate(washer,[{transform:from},{transform:from}],{duration:1,fill:'forwards'});
     }
    }finally{if(washing===w)washing=null;}
   }
   else if(lvl==='still'){
     const world=q('.fr-world');
     const a=animate(world,[{opacity:1},{opacity:0}],{duration:220,fill:'forwards'});
     await done(a);
     buildStage();
     sync();
     const b=animate(world,[{opacity:0},{opacity:1}],{duration:320});
     a?.cancel?.();
     await done(b);
   }
   else{buildStage();sync();}
  }
  // The next place built ahead: when the pointer rests on a place's card (or the keyboard reaches it), that place goes in
  // under the one on show, a share per frame, so choosing it finds it already built and the stroke never waits on it.
  let prepared=null;
  function buildNext(place){
    const A=Art(),isNight=night||place==='fire',next=doc.createElement('div');
    next.className='fr-stage fr-stage-next';
    next.setAttribute('data-fr-stage','');
    if(scaleNow)next.style?.setProperty('--fr-s',scaleNow);
    stageEl.parentNode.insertBefore(next,stageEl);
    return {place,next,isNight,fill:fillStage(next,A.stage(place,{night:isNight}).html)};
  }
  function dropPrepared(){if(!prepared)return;prepared.fill.cancel();prepared.next.remove?.();prepared=null;}
  function takePrepared(place){
    const b=prepared;
    if(!b||b.place!==place||b.isNight!==(night||place==='fire')||!b.next.isConnected){dropPrepared();return null;}
    prepared=null;
    return b;
  }
  function prepare(place){
   if(!panel||closing||washing||motion()!=='gentle'||!PLACES.includes(place)||place===shared.prefs.place||!stageEl?.parentNode?.insertBefore||!Art()?.stage)return;
   if(prepared?.place===place&&prepared.isNight===(night||place==='fire'))return;dropPrepared();prepared=buildNext(place);
  }
  function setVolume(v,quiet=shared.prefs.quiet){
   const p=shared.prefs;p.volume=Math.max(0,Math.min(1,Math.round(v*100)/100));p.quiet=quiet;savePrefs(store);sound.setLevel(p.volume,p.quiet);
   const knob=q('.fr-knob');if(knob){knob.setAttribute('aria-valuenow',String(Math.round(p.volume*100)));knob.style?.setProperty('--fr-vol',String(p.volume));}
   q('[data-fr-act="quiet"]')?.setAttribute('aria-pressed',String(p.quiet));
  }
  function knobDown(event){
   const knob=event.currentTarget;
   if(!knob)return;
   event.preventDefault?.();
   knob.setPointerCapture?.(event.pointerId);
   const startY=event.clientY,start=shared.prefs.volume;
   const move=e=>setVolume(start+(startY-e.clientY)/160,false),up=()=>{
     knob.removeEventListener('pointermove',move);
     knob.removeEventListener('pointerup',up);
     knob.removeEventListener('pointercancel',up);
   };
   knob.addEventListener('pointermove',move);knob.addEventListener('pointerup',up);knob.addEventListener('pointercancel',up);
  }
  // Presses: the seal sinks and springs back; a tag tips on its string and swings to rest.
  function press(target){
   if(motion()!=='gentle')return;
   const seal=target.closest?.('[data-fr-seal]'),tag=!seal&&target.closest?.('.fr-tagbtn');
   if(seal)
     animate(seal.querySelector('.fr-seal-art')||seal,[{transform:'scale(1)'},{transform:'scale(.93)',offset:.3},{transform:'scale(1.02)',offset:.7},{transform:'scale(1)'}],{duration:220,easing:SETTLE()});
   if(tag)animate(tag,[{transform:'rotate(0deg)'},{transform:'rotate(6deg) translateY(2px)',offset:.25},{transform:'rotate(-2deg)',offset:.6},{transform:'rotate(0deg)'}],{duration:240,easing:SETTLE()});
  }
  function click(event){
   const target=event.composedPath?.()[0]||event.target,node=target?.closest?.('[data-rd-action],[data-fr-act]'),action=node?.dataset?.rdAction;
   if(action==='room-open'){void open(node);return true;}
   if(action==='room-close'){if(panel)void close();return true;}
   if(node&&(panel?.contains?.(node)||node.closest?.('[data-fr-mod]')))press(node);
   if(!panel||!node?.dataset?.frAct||!panel.contains?.(node))return false;
   const act=node.dataset.frAct;
   if(act==='places'){togglePicker();return true;}
   if(act==='place'){
     void choosePlace(node.dataset.place);
     togglePicker(false,false);
     const tag=q('[data-fr-act="places"]');
     if(win.requestAnimationFrame&&win.setTimeout)
       win.requestAnimationFrame(()=>win.setTimeout(()=>{if(panel&&!closing)tag?.focus?.({preventScroll:true});},0));
     else tag?.focus?.({preventScroll:true});
     return true;
   }
   if(act==='quiet'){setVolume(shared.prefs.volume,!shared.prefs.quiet);return true;}
   return false;
  }
  function keydown(event){
   if(!panel)return false;const target=event.composedPath?.()[0]||event.target;
   if(target?.classList?.contains?.('fr-knob')){
     const step={ArrowUp:.05,ArrowRight:.05,ArrowDown:-.05,ArrowLeft:-.05,PageUp:.2,PageDown:-.2}[event.key];
     if(step!==undefined||event.key==='Home'||event.key==='End'){event.preventDefault?.();setVolume(event.key==='Home'?0:event.key==='End'?1:shared.prefs.volume+step,false);return true;}
   }
   if(event.key==='Tab'&&!closing){const list=[...panel.querySelectorAll('button,[tabindex="0"]')].filter(n=>!n.disabled&&!n.hidden&&!n.closest?.('[hidden],[inert]'));
    if(list.length){
      const first=list[0],end=list[list.length-1],inside=panel.contains?.(target)&&list.includes(target);
      if(!inside||(event.shiftKey?target===first:target===end)){event.preventDefault?.();(event.shiftKey?end:first).focus?.({preventScroll:true});return true;}
    }
    return false;
   }
   if(event.key==='Escape'){event.preventDefault?.();if(pickerOpen){togglePicker(false);return true;}void close();return true;}
   return false;
  }
  function changed(){
    if(screenWait&&!full()){const go=screenWait;screenWait=null;if(panel)layout();go();return;}
    if(panel&&!closing&&settled&&!full())void close(false);else if(panel)layout();
  }
  doc.addEventListener?.('fullscreenchange',changed);
  const ready=event=>{if(dead)return;const t=event.composedPath?.()[0]||event.target;
   if(!panel){if(!returning&&t?.closest?.('[data-rd-action="room-open"]')){sound.warm();prebuild();}return;}
   const card=!closing&&pickerOpen?t?.closest?.('[data-fr-act="place"]'):null;if(card&&panel.contains?.(card))prepare(card.dataset.place);};
  const pressed=event=>{if(dead||panel)return;const t=event.composedPath?.()[0]||event.target;if(t?.closest?.('[data-rd-action="room-open"]'))sound.warm();};
  container.addEventListener?.('pointerover',ready,{passive:true});container.addEventListener?.('focusin',ready);container.addEventListener?.('pointerdown',pressed,{passive:true});
  return {open,close,sync,click,keydown,isOpen:()=>!!panel&&!closing,lastPause:()=>lastPause,
   destroy(){
     dead=true;
     filling?.cancel();
     dropSpare();
     freeKeys();
     if(panel){
       const p=panel;
       restore();
       sound.stop();
       p.remove();
       panel=null;
       container.removeAttribute?.('data-ch-room');
       host()?.removeAttribute?.('data-ch-room');
       if(full())Promise.resolve(doc.exitFullscreen?.()).catch(()=>{});
     }
     doc.removeEventListener?.('fullscreenchange',changed);
     container.removeEventListener?.('pointerover',ready);
     container.removeEventListener?.('focusin',ready);
     container.removeEventListener?.('pointerdown',pressed);
     win.removeEventListener?.('resize',layout);
     doc.removeEventListener?.('visibilitychange',visibility);
   }};
 }
 const api={create,module:moduleBody,view,pickTask,tally,PLACES,NAMES,OPEN_MINUTES,prefs:shared.prefs};
 root.ReserveFocusRoom=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
