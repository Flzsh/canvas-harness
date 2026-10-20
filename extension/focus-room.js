/* Canvas Harness focus room: a full-screen place to work, opened from the Home timer, an assignment's Focus button,
   the pony's menu or Shift+F. It runs the same session as the Home timer (focus-room-model.js has the rules), over
   a moving scene, a course's artwork, or the student's own photo or video (focus-scene.html, an extension page that
   also plays the room's sounds). The optional distraction guard (focus-guard-model.js) is set up in the Scene and
   sound panel; its switch is a small extension page (focus-guard.html) because only an extension page can ask Chrome
   for access to other websites. Leaving the room keeps the timer running on Home. Nothing here writes to Canvas. */
(function(root){
 'use strict';
 const M=()=>root.ReserveFocusRoomModel,G=()=>root.ReserveFocusGuardModel;
 // The hand-drawn circle of the Home timer, so the two dials match.
 const RING='M61 9C90 7 112 31 111 61C110 90 87 112 59 111C31 110 8 88 9 59C10 32 32 9 60 9C65 9 70 10 75 12';
 const SCENE_NAMES={rain:'Rain on the window',night:'Night sky',ocean:'Ocean at dusk',lamp:'Lamp light',course:'Course art',photo:'Your photo',video:'Your video',plain:'Plain paper'};
 const DARK_SCENES=['rain','night','ocean','lamp','photo','video'];
 const SOUND_NAMES={white:'White noise',pink:'Pink noise',brown:'Brown noise',rain:'Rain',own:'Your sound'};
 const MEDIA_NAMES={photo:'photo',video:'video',audio:'sound'};
 const ICON={
  scene:'<path d="M4 17.5l4.6-5.2 3.4 3.6 2.6-2.8 5.4 5.4"/><path d="M4.4 5.2c5.1-.5 10.1-.5 15.2 0l.2 13.6c-5.2.5-10.3.5-15.5 0z"/><circle cx="15.6" cy="8.8" r="1.6"/>',
  stats:'<path d="M4 19.6h16"/><path d="M6.6 19.4v-6.2M11 19.4V8.6M15.4 19.4v-9M19 19.4V5"/>',
  full:'<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/>',
  shrink:'<path d="M9 4.5V9H4.5M19.5 9H15V4.5M15 19.5V15h4.5M4.5 15H9v4.5"/>',
  close:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'
 };
 const svg=k=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
 const sizeText=n=>n>=1048576?`${(n/1048576).toFixed(n>=10485760?0:1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;
 const pageURL=file=>{try{const u=root.chrome?.runtime?.getURL?.(file);if(u)return u;}catch{}return new URL('../extension/'+file,root.location.href).href;};
 const sceneURL=()=>pageURL('focus-scene.html');

 function create({container,store,save,getContext,helpers,startTick=()=>{},onFinished=()=>{}}){
  const doc=container.ownerDocument,win=doc.defaultView||root;
  let node=null,ui=null,frame=null,ready=false,panel='',status='',statusTimer=0,tick=0,returnTo=null,goalTimer=0,goalDraft=null,overflow=null,sent={},cheerUntil=0,dead=false,ac=null,guardDraft=null,guardGranted=null;
  const data=()=>store.get()||{};
  const room=()=>M().cleanRoom(data().focusRoom);
  const reduced=()=>!!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const E=value=>helpers().E(value);

  function say(text,ms=5000){status=text;clearTimeout(statusTimer);if(ms)statusTimer=setTimeout(()=>{status='';paintStatus();},ms);paintStatus();}
  function paintStatus(){const el=node?.querySelector('[data-fr-status]');if(el&&el.textContent!==status)el.textContent=status;}
  function saveRoom(patch){return save(d=>{const r=M().cleanRoom(d.focusRoom);d.focusRoom=M().cleanRoom({...r,...patch,sound:{...r.sound,...(patch.sound||{})},media:{...r.media,...(patch.media||{})},guard:{...r.guard,...(patch.guard||{})}});});}
  function saveFocus(fn){return save(d=>{d.focus=fn(M().full(d.focus),d);});}

  /* ---- the backdrop frame ---- */
  function post(message){if(!frame||!ready)return;try{frame.contentWindow.postMessage({type:'reserve-focus-room',...message},new URL(frame.src).origin);}catch{}}
  function sendLook(force){
   const r=room(),c=getContext(),look={scene:r.scene,theme:c.theme==='dark'?'dark':'light',still:reduced()},sound={...r.sound,on:r.sound.on&&!!node};
   const a=JSON.stringify(look),b=JSON.stringify(sound);
   if(force||sent.look!==a){sent.look=a;post({op:'scene',...look});}
   if(force||sent.sound!==b){sent.sound=b;post({op:'sound',sound});}
  }
  function onMessage(event){
   if(guardMessage(event))return;
   if(!frame||event.source!==frame.contentWindow||event.data?.type!=='reserve-focus-scene')return;
   const m=event.data,kind=m.kind;
   if(m.op==='ready'){ready=true;sendLook(true);return;}
   if(m.op==='stored'&&M().MEDIA[kind]){
    const patch={media:{[kind]:m.meta}};
    if(kind==='audio'){const s=room().sound;patch.sound={on:true,own:s.own||.8};}else patch.scene=kind;
    saveRoom(patch).then(()=>say(`Your ${MEDIA_NAMES[kind]} is saved on this device.`));return;
   }
   if(m.op==='error'){say(m.message||'That file could not be used.');return;}
   if(m.op==='missing'&&M().MEDIA[kind]&&room().media[kind]){
    saveRoom({media:{[kind]:null},...(room().scene===kind?{scene:'rain'}:{})});say(`Your ${MEDIA_NAMES[kind]} is no longer on this device. Choose it again to use it.`,8000);
   }
  }
  // A student's own file: checked here, then handed to the backdrop page, which keeps it.
  function picked(input){
   const kind=input.dataset.frFile,file=input.files?.[0];input.value='';
   if(!file||!M().MEDIA[kind])return;
   const problem=M().checkMedia(kind,file);if(problem){say(problem);return;}
   if(!ready){say('The room is still opening. Try again in a moment.');return;}
   say(`Saving your ${MEDIA_NAMES[kind]}…`,0);post({op:'store',kind,file});
  }

  /* ---- the distraction guard ---- */
  const guardFrame=()=>ui?.querySelector('iframe[data-fr-guard]')||null;
  const tone=()=>node?.dataset.tone==='dark'?'dark':'light';
  const guardURL=()=>`${pageURL('focus-guard.html')}?tone=${tone()}&on=${room().guard.on?1:0}`;
  function postGuard(){const f=guardFrame();if(!f?.src)return;try{f.contentWindow.postMessage({type:'reserve-focus-room',op:'guard',on:room().guard.on,tone:tone()},new URL(f.src).origin);}catch{}}
  // The switch tells the room what the student chose and whether Chrome allowed it.
  function guardMessage(event){
   const f=guardFrame();if(!f||event.source!==f.contentWindow||event.data?.type!=='reserve-focus-guard')return false;
   try{if(event.origin!==new URL(f.src).origin)return true;}catch{return true;}
   const m=event.data,known=guardGranted;if(typeof m.granted==='boolean')guardGranted=m.granted;
   if(m.op==='ready'){postGuard();if(known!==guardGranted)render();}
   else if(m.op==='set'){const on=m.on===true;saveRoom({guard:{on}}).then(()=>say(!on?'The distraction guard is off.':room().guard.sites.length?'The distraction guard is on. Sites on your list wait while you focus.':'The distraction guard is on. Add a site for it to cover.'));}
   else if(m.op==='denied'){saveRoom({guard:{on:false}}).then(()=>say('Chrome did not allow it, so the distraction guard stays off.'));}
   return true;
  }
  function addSite(input){
   const r=room(),{host,problem}=G().check(input.value,r.guard.sites,[win.location.origin]);
   if(problem){say(problem);return;}
   guardDraft=null;input.value='';
   saveRoom({guard:{sites:[...r.guard.sites,host]}}).then(()=>say(`${host} waits while you focus.`));
  }
  function guardSection(r){
   if(!G())return '';
   const sites=r.guard.sites.map(h=>`<li><span>${E(h)}</span><button type="button" class="fr-link-button" data-fr-action="guard-remove" data-value="${E(h)}" aria-label="Remove ${E(h)}">Remove</button></li>`).join('');
   return `<h3 id="fr-guard">Distraction guard</h3>
<iframe class="fr-guard-switch" data-fr-guard title="Distraction guard switch"></iframe>
${r.guard.on&&guardGranted===false?'<p class="fr-fine fr-guard-lost">Chrome no longer lets the guard work on other sites. Switch it on again to allow it.</p>':''}
<div class="fr-guard-add"><label class="fr-sr" for="fr-guard-site">Add a site</label><input type="text" id="fr-guard-site" data-fr-field="guard-site" maxlength="300" autocomplete="off" spellcheck="false" placeholder="youtube.com" value="${E(guardDraft??'')}" ${r.guard.sites.length>=G().MAX_SITES?'disabled':''}><button type="button" class="fr-button" data-fr-action="guard-add">Add</button></div>
${sites?`<ul class="fr-guard-sites" aria-label="Sites the guard covers">${sites}</ul>`:''}
<p class="fr-fine">During a focus session (not on breaks or while paused), these sites show a short reminder instead of the page, with a way to continue for 5 minutes. Canvas and your school’s sites are never covered. Switching the guard on asks Chrome for access to other websites; Canvas Harness uses it only on the sites in this list, only during a session.</p>`;
  }

  /* ---- what is on screen ---- */
  function chosenItem(c,f){return f.itemId?c.items.find(x=>String(x.id)===String(f.itemId))||null:null;}
  function courseOf(c,item){return item?c.courseMap.get(String(item.courseId))||null:null;}
  function phaseLine(s,r){
   if(s.mode==='open')return s.running?'Open session':'Open session · counts up';
   if(s.mode==='timer')return s.running?'Focus':'Focus timer';
   return s.phase==='focus'?`Focus · round ${s.round} of ${r.every}`:s.phase==='long'?'Long break':'Short break';
  }
  function view(){
   const c=getContext(),h=helpers(),d=data(),r=room(),s=M().state(d.focus,Date.now()),item=chosenItem(c,s),course=courseOf(c,item);
   const button=(action,label,extra='',cls='fr-button')=>`<button type="button" class="${cls}" data-fr-action="${action}" ${extra}>${label}</button>`;
   const tool=(action,icon,label,extra='')=>`<button type="button" class="fr-icon" data-fr-action="${action}" aria-label="${E(label)}" title="${E(label)}" ${extra}>${svg(icon)}</button>`;
   const full=!!doc.fullscreenElement;
   const modes=[['timer','Timer'],['pomodoro','Pomodoro'],['open','Open']].map(([m,label])=>`<button type="button" class="fr-mode" role="radio" data-fr-action="mode" data-value="${m}" aria-checked="${s.mode===m}" ${s.running&&s.mode!==m?'disabled':''}>${label}</button>`).join('');
   const started=s.mode==='open'?s.elapsed>0:s.left<s.total;
   const primary=s.running?'Pause':started?'Resume':s.brk?'Start break':s.mode==='pomodoro'&&s.round>1?`Start round ${s.round}`:'Start';
   const actions=[button('toggle',primary,'','fr-button fr-primary'),
    s.brk?button('finish','Skip break'):(started&&s.elapsed>=60?button('finish','Finish now','title="End here and log the minutes so far"'):''),
    !s.running&&started&&!s.brk?button('reset','Reset','','fr-button fr-quiet'):''].join('');
   const lengths=s.mode==='timer'?`<div class="fr-lengths" role="group" aria-label="Session length">${[15,25,45,60].map(n=>button('minutes',String(n),`data-value="${n}" aria-pressed="${s.minutes===n}" aria-label="${n} minutes" ${s.running?'disabled':''}`,'fr-chip')).join('')}<label class="fr-custom"><span class="fr-sr">Custom length in minutes</span><input type="number" data-fr-field="minutes" min="5" max="120" step="5" value="${[15,25,45,60].includes(s.minutes)?'':s.minutes}" placeholder="Other" ${s.running?'disabled':''}></label><span>min</span></div>`
    :s.mode==='pomodoro'?`<p class="fr-plan">${r.work} min focus · ${r.short} min break · ${r.long} min break after ${r.every} rounds ${button('panel','Change','data-value="scene" data-section="pomodoro"','fr-link-button')}</p>`
    :'<p class="fr-plan">Counts up until you finish. Good for reading or open-ended work.</p>';
   const open=c.items.filter(x=>!h.complete(x)&&!(c.local[x.id]?.checkedOff)).sort((a,b)=>(Date.parse(a.dueAt||'')||9e15)-(Date.parse(b.dueAt||'')||9e15)).slice(0,40);
   if(item&&!open.includes(item))open.unshift(item);
   const options=open.map(x=>{const co=courseOf(c,x);return `<option value="${E(x.id)}" ${item===x?'selected':''}>${E(x.name)}${co?` · ${E(co.shortName||co.name)}`:''}</option>`;}).join('');
   const local=item?c.local[item.id]||{}:{},steps=local.checklist||[],done=item&&(h.complete(item)||local.checkedOff===true);
   const link=item&&!String(item.id).startsWith('local-')?h.assignmentLink(item):'';
   const task=`<aside class="fr-task fr-glass" aria-label="What you are working on">
<label class="fr-task-pick"><span>Working on</span><select data-fr-field="item"><option value="">Nothing in particular</option>${options}</select></label>
${item?`${course?`<p class="fr-task-course" style="--fr-course:${E(course.color||'#C96442')}"><i></i>${E(course.shortName||course.name)}</p>`:''}<h2>${E(item.name)}</h2>
${item.dueAt?`<p class="fr-task-due">Due ${E(h.formatDate(item.dueAt,c.s.timeZone,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</p>`:''}
${steps.length?`<ul class="fr-steps">${steps.slice(0,12).map(st=>`<li><label><input type="checkbox" data-fr-field="step" data-id="${E(item.id)}" data-step="${E(st.id)}" ${st.done?'checked':''}><span>${E(st.text)}</span></label></li>`).join('')}</ul>`:''}
${local.notes?`<p class="fr-notes">${E(String(local.notes).slice(0,240))}${String(local.notes).length>240?'…':''}</p>`:''}
<div class="fr-task-actions">${link?`<a class="fr-button" href="${E(link)}" target="_blank" rel="noopener noreferrer">Open in Canvas</a>`:''}${done?'<span class="fr-done">Done</span>':`<button type="button" class="fr-button" data-rd-action="check-off" data-id="${E(item.id)}">Mark done</button>`}</div>`:'<p class="fr-task-empty">Pick an assignment to keep its steps and notes beside the timer.</p>'}</aside>`;
   return `<header class="fr-top"><div class="fr-modes" role="radiogroup" aria-label="Kind of session">${modes}</div>
<div class="fr-tools">${tool('panel','scene','Scene and sound',`data-value="scene" aria-pressed="${panel==='scene'}"`)}${tool('panel','stats','Your focus',`data-value="stats" aria-pressed="${panel==='stats'}"`)}${doc.fullscreenEnabled!==false?tool('fullscreen',full?'shrink':'full',full?'Leave full screen':'Full screen'):''}${tool('close','close','Leave the room (Esc). The timer keeps running.')}</div></header>
<main class="fr-center" data-brk="${s.brk}"><p class="fr-phase">${E(phaseLine(s,r))}</p>
<div class="fr-dial" data-running="${s.running}"><svg viewBox="0 0 120 120" aria-hidden="true"><path class="fr-track" d="${RING}"/><path class="fr-arc" pathLength="1" d="${RING}" style="stroke-dashoffset:${(1-s.progress).toFixed(4)}"/></svg><output class="fr-time" data-fr-time aria-live="off">${M().clock(s.shown)}</output></div>
<label class="fr-goal"><span class="fr-sr">What will you finish?</span><input type="text" data-fr-field="goal" maxlength="140" autocomplete="off" placeholder="What will you finish?" value="${E(goalDraft??s.goal)}"></label>
<div class="fr-actions">${actions}</div>${lengths}<p class="fr-status" role="status" data-fr-status>${E(status)}</p></main>
${task}${pony(s)}${panel?`<section class="fr-panel fr-glass" aria-label="${panel==='stats'?'Your focus':'Scene and sound'}">${panel==='stats'?statsPanel(c,h):scenePanel(r)}</section>`:''}`;
  }
  function pony(s){
   const P=root.ReservePets,A=root.ReservePetArt;if(!P||!A)return '';
   const pet=P.clean(data().pet);if(!pet.enabled||pet.roam==='off')return '';
   const c=A.COATS[pet.coat]||A.COATS.oat,pose=Date.now()<cheerUntil?'cheer':s.running&&!s.brk?'read':s.brk?'lie':'stand';
   return `<div class="fr-pony" aria-hidden="true"><div class="pet" data-pose="${pose}" data-face="left" data-gear="${E(pet.gear)}" data-still="${reduced()}" style="--pet-size:96px;--pet-coat:${c.coat};--pet-shade:${c.shade};--pet-mane:${c.mane};--pet-muzzle:${c.muzzle};--pet-harness:${A.HARNESS[pet.harness]||A.HARNESS.red}">${A.svg({title:pet.name})}</div></div>`;
  }
  function range(field,label,value,min,max,extra=''){return `<label class="fr-range"><span>${E(label)}</span><input type="range" data-fr-field="${field}" min="${min}" max="${max}" value="${value}" ${extra}><output>${value}</output></label>`;}
  function scenePanel(r){
   const mediaRow=kind=>{const m=r.media[kind];return `<div class="fr-media"><span>${m?`${E(m.name)} <small>${sizeText(m.size)}</small>`:`No ${MEDIA_NAMES[kind]} yet`}</span><button type="button" class="fr-link-button" data-fr-action="pick" data-kind="${kind}">${m?'Change':`Choose a ${MEDIA_NAMES[kind]}`}</button>${m?`<button type="button" class="fr-link-button" data-fr-action="remove-media" data-kind="${kind}">Remove</button>`:''}</div>`;};
   const scenes=M().SCENES.map(k=>{const missing=(k==='photo'||k==='video')&&!r.media[k];return `<button type="button" class="fr-scene-pick" role="radio" data-fr-action="${missing?'pick':'scene'}" data-value="${k}" data-kind="${k}" aria-checked="${r.scene===k}"><i data-scene="${k}"></i><span>${E(SCENE_NAMES[k])}</span>${missing?'<small>Choose…</small>':''}</button>`;}).join('');
   const sounds=M().SOUNDS.filter(k=>k!=='own'||r.media.audio).map(k=>range('sound-'+k,SOUND_NAMES[k],Math.round(r.sound[k]*100),0,100)).join('');
   return `<header><h2>Scene and sound</h2><button type="button" class="fr-icon" data-fr-action="panel" data-value="" aria-label="Close">${svg('close')}</button></header>
<h3>Backdrop</h3><div class="fr-scenes" role="radiogroup" aria-label="Backdrop">${scenes}</div>${mediaRow('photo')}${mediaRow('video')}
${range('dim','Dim the backdrop',r.dim,0,85)}${range('blur','Soften (blur)',r.blur,0,24)}
<h3>Sound</h3><label class="fr-check"><input type="checkbox" data-fr-field="sound-on" ${r.sound.on?'checked':''}><span>Play sound in the room</span></label>
${range('sound-volume','Volume',Math.round(r.sound.volume*100),0,100)}${sounds}${mediaRow('audio')}
<h3 id="fr-pomodoro">Pomodoro</h3><div class="fr-numbers">${[['work','Focus',5,120],['short','Short break',1,30],['long','Long break',5,60],['every','Long break after rounds',2,8]].map(([k,label,lo,hi])=>`<label><span>${label}</span><input type="number" data-fr-field="room-${k}" min="${lo}" max="${hi}" value="${r[k]}"></label>`).join('')}</div>
<label class="fr-check"><input type="checkbox" data-fr-field="auto" ${r.auto?'checked':''}><span>Start the next round by itself after a break</span></label>
<label class="fr-check"><input type="checkbox" data-fr-field="chime" ${r.chime?'checked':''}><span>A soft chime when a session or break ends</span></label>
${guardSection(r)}
<p class="fr-fine">Your photo, video and sound stay in Canvas Harness on this device. They are not uploaded anywhere.</p>`;
  }
  function statsPanel(c,h){
   const d=data(),st=M().stats(d.focusLog,{now:Date.now(),dayOf:t=>h.dayKey(t,c.s.timeZone),courseOf:id=>c.items.find(x=>String(x.id)===String(id))?.courseId??null});
   const max=Math.max(1,...st.week.map(x=>x.minutes));
   const bars=st.week.map(x=>{const co=x.courseId?c.courseMap.get(String(x.courseId)):null;return `<li style="--fr-course:${E(co?.color||'#8a8577')}"><span>${E(co?co.shortName||co.name:'Other')}</span><i style="width:${Math.max(4,Math.round(x.minutes/max*100))}%"></i><b>${E(M().minutesText(x.minutes))}</b></li>`;}).join('');
   const recent=st.recent.map(e=>{const it=e.i?c.items.find(x=>String(x.id)===String(e.i)):null;return `<li><span>${E(h.formatDate(e.at,c.s.timeZone,{weekday:'short',hour:'numeric',minute:'2-digit'}))}</span><b>${E(M().minutesText(e.m))}</b><small>${E(e.g||it?.name||'')}</small></li>`;}).join('');
   return `<header><h2>Your focus</h2><button type="button" class="fr-icon" data-fr-action="panel" data-value="" aria-label="Close">${svg('close')}</button></header>
<div class="fr-stat-row"><p><strong>${E(M().minutesText(st.today))}</strong><span>today</span></p><p><strong>${st.streak}</strong><span>day${st.streak===1?'':'s'} in a row</span></p><p><strong>${E(M().minutesText(st.weekTotal))}</strong><span>last 7 days</span></p></div>
<h3>Last 7 days by course</h3>${bars?`<ul class="fr-bars">${bars}</ul>`:'<p class="fr-fine">Finish a session to start the count.</p>'}
<h3>Recent sessions</h3>${recent?`<ul class="fr-recent">${recent}</ul>`:'<p class="fr-fine">Nothing yet.</p>'}
<p class="fr-fine">Kept on this device with your other Canvas Harness data, and in its backups.</p>`;
  }
  function look(){
   if(!node)return;const r=room(),c=getContext(),dark=DARK_SCENES.includes(r.scene)||r.scene==='plain'&&c.theme==='dark';
   node.dataset.tone=dark?'dark':'light';node.dataset.scene=r.scene;
   node.style.setProperty('--fr-dim',String(r.dim/100));node.style.setProperty('--fr-blur',r.blur+'px');
   const art=node.querySelector('.fr-art');
   if(r.scene==='course'){
    const f=M().full(data().focus),item=chosenItem(c,f),course=courseOf(c,item)||c.courses?.[0],key=course?String(course.id):'';
    if(art.dataset.course!==key){art.dataset.course=key;art.innerHTML=course?root.ReserveCourseArt?.scene?.(course,{crop:'heading'})||'':'';}
    art.hidden=false;
   }else{art.hidden=true;}
   sendLook();
  }
  function render(){
   if(!node||dead)return;
   const active=node.getRootNode()?.activeElement,key=active&&ui.contains(active)?(active.dataset.frField?`[data-fr-field="${active.dataset.frField}"]${active.dataset.step?`[data-step="${active.dataset.step}"]`:''}`:active.dataset.frAction?`[data-fr-action="${active.dataset.frAction}"]${active.dataset.value!==undefined?`[data-value="${active.dataset.value}"]`:''}`:''):'';
   const caret=active?.selectionStart,html=view();
   if(ui.__html!==html){
    // The guard's switch is a frame: moved aside and back (where the browser can) so a redraw does not reload it.
    const kept=guardFrame(),scroll=ui.__panel===panel?ui.querySelector('.fr-panel')?.scrollTop||0:0;let parked=false;
    if(kept&&typeof node.moveBefore==='function')try{node.moveBefore(kept,null);parked=true;}catch{}
    ui.innerHTML=html;ui.__html=html;
    const slot=guardFrame();let moved=false;
    if(slot&&parked)try{slot.parentNode.moveBefore(kept,slot);slot.remove();moved=true;}catch{}
    if(!moved){if(parked)kept.remove();if(slot)slot.src=guardURL();}
    const side=ui.querySelector('.fr-panel');if(side&&scroll)side.scrollTop=scroll;ui.__panel=panel;   // the panel stays where the student was
    if(key){const el=ui.querySelector(key);if(el){el.focus({preventScroll:true});if(Number.isInteger(caret)&&el.setSelectionRange&&el.type==='text')try{el.setSelectionRange(caret,caret);}catch{}}}}
   look();postGuard();ticking();
  }
  // Between renders only the clock and its ring move.
  function step(){
   if(!node||dead)return;const s=M().state(data().focus,Date.now());
   const t=node.querySelector('[data-fr-time]'),arc=node.querySelector('.fr-arc'),text=M().clock(s.shown);
   if(t&&t.textContent!==text)t.textContent=text;if(arc)arc.style.strokeDashoffset=(1-s.progress).toFixed(4);
   if(cheerUntil&&Date.now()>=cheerUntil){cheerUntil=0;render();return;}
   if(!s.running)ticking();
  }
  function ticking(){const run=!!node&&(M().state(data().focus,Date.now()).running||cheerUntil>0);if(run&&!tick)tick=setInterval(step,1000);else if(!run&&tick){clearInterval(tick);tick=0;}}

  /* ---- open and close ---- */
  function open({itemId,start=false}={}){
   if(dead||!M())return;
   const begin=()=>{if(start)toggle(true);};
   // A different assignment starts with a fresh goal.
   if(itemId!=null)saveFocus(f=>String(f.itemId)===String(itemId)?f:{...f,itemId:String(itemId),goal:''}).then(begin);else begin();
   if(node){render();return;}
   returnTo=container.getRootNode?.()?.activeElement||null;
   node=doc.createElement('div');node.className='fr-room';node.dataset.rdKeep='true';node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-label','Focus room');node.tabIndex=-1;
   node.innerHTML=`<div class="fr-art" aria-hidden="true" hidden></div><iframe class="fr-scene" title="Focus room backdrop" aria-hidden="true" tabindex="-1" allow="autoplay"></iframe><div class="fr-dim" aria-hidden="true"></div><div class="fr-ui"></div>
<input type="file" hidden data-fr-file="photo" accept="${M().MEDIA.photo.types.join(',')}"><input type="file" hidden data-fr-file="video" accept="${M().MEDIA.video.types.join(',')}"><input type="file" hidden data-fr-file="audio" accept="${M().MEDIA.audio.types.join(',')},.m4a,.mp3,.flac">`;
   ui=node.querySelector('.fr-ui');frame=node.querySelector('iframe');ready=false;sent={};frame.src=sceneURL();
   for(const input of node.querySelectorAll('[data-fr-file]'))input.addEventListener('change',()=>picked(input));
   container.append(node);
   overflow=doc.documentElement.style.overflow;doc.documentElement.style.overflow='hidden';
   win.addEventListener('message',onMessage);doc.addEventListener('fullscreenchange',render);
   render();
   (node.querySelector('.fr-primary')||node).focus({preventScroll:true});
  }
  function close(){
   if(!node)return;
   post({op:'sound',sound:{on:false}});
   if(doc.fullscreenElement===node)doc.exitFullscreen?.().catch(()=>{});
   win.removeEventListener('message',onMessage);doc.removeEventListener('fullscreenchange',render);
   clearInterval(tick);tick=0;clearTimeout(goalTimer);flushGoal();
   node.remove();node=null;ui=null;frame=null;ready=false;panel='';status='';guardDraft=null;
   doc.documentElement.style.overflow=overflow||'';overflow=null;
   if(returnTo?.isConnected)returnTo.focus?.({preventScroll:true});returnTo=null;
  }

  /* ---- the session ---- */
  function toggle(forceStart=false){
   const s=M().state(data().focus,Date.now());
   if(s.running&&!forceStart)return saveFocus(f=>M().pause(f,Date.now()));
   return saveFocus(f=>M().start(f,Date.now())).then(()=>{startTick();ticking();});
  }
  function finish(){
   let result=false;
   return save(d=>{result=M().finish(d,Date.now());}).then(()=>{if(result==='focus')onFinished('focus');});
  }
  function flushGoal(){if(goalDraft==null)return;const value=goalDraft;goalDraft=null;saveFocus(f=>({...f,goal:value}));}
  function chime(){
   try{
    const AC=win.AudioContext||win.webkitAudioContext;if(!AC)return;ac=ac||new AC();ac.resume?.();
    const now=ac.currentTime;
    for(const [freq,at] of [[659.25,0],[880,.22]]){const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0,now+at);g.gain.linearRampToValueAtTime(.12,now+at+.02);g.gain.exponentialRampToValueAtTime(.0001,now+at+1.6);o.connect(g);g.connect(ac.destination);o.start(now+at);o.stop(now+at+1.7);}
   }catch{}
  }
  // Told when a session or break ends (by the Home timer's clock or by Finish now).
  function ended(kind){
   if(dead)return;
   if(room().chime)chime();
   if(kind==='focus'&&node){cheerUntil=Date.now()+4000;say('Session done. A treat for both of you.');}
   else if(kind==='break'&&node)say(room().auto?'Break over. The next round has started.':'Break over. Ready for the next round?');
   render();
  }

  /* ---- events (heard on the workspace and passed here first) ---- */
  function click(event){
   if(!node||!node.contains(event.target))return false;
   const button=event.target.closest?.('[data-fr-action]');if(!button)return !event.target.closest?.('[data-rd-action],a');
   const action=button.dataset.frAction,value=button.dataset.value;
   if(action==='close'){close();return true;}
   if(action==='toggle'){toggle();return true;}
   if(action==='finish'){finish();return true;}
   if(action==='reset'){saveFocus(f=>M().reset(f));return true;}
   if(action==='mode'&&M().MODES.includes(value)){saveFocus((f,d)=>M().setMode(f,value,d.focusRoom));return true;}
   if(action==='minutes'){const n=Number(value);saveFocus(f=>M().setMinutes(f,n));return true;}
   if(action==='panel'){panel=panel===value?'':value||'';render();if(button.dataset.section)node.querySelector('#fr-pomodoro')?.scrollIntoView({block:'start'});return true;}
   if(action==='fullscreen'){if(doc.fullscreenElement)doc.exitFullscreen?.().catch(()=>{});else node.requestFullscreen?.().catch(()=>say('Full screen is not available here.'));return true;}
   if(action==='scene'&&M().SCENES.includes(value)){saveRoom({scene:value});return true;}
   if(action==='pick'&&M().MEDIA[button.dataset.kind]){node.querySelector(`[data-fr-file="${button.dataset.kind}"]`)?.click();return true;}
   if(action==='guard-add'&&G()){const field=node.querySelector('[data-fr-field="guard-site"]');if(field)addSite(field);return true;}
   if(action==='guard-remove'&&G()){const r=room();saveRoom({guard:{sites:r.guard.sites.filter(h=>h!==value)}}).then(()=>say(`${value} is off the list.`));return true;}
   if(action==='remove-media'&&M().MEDIA[button.dataset.kind]){const kind=button.dataset.kind;post({op:'remove',kind});const r=room();saveRoom({media:{[kind]:null},...(r.scene===kind?{scene:'rain'}:{}),...(kind==='audio'?{sound:{own:0}}:{})});say(`Your ${MEDIA_NAMES[kind]} was removed from this device.`);return true;}
   return true;
  }
  function input(event){
   if(!node||!node.contains(event.target))return false;
   const t=event.target,field=t.dataset.frField;
   if(field==='goal'){goalDraft=t.value.slice(0,140);clearTimeout(goalTimer);goalTimer=setTimeout(flushGoal,600);return true;}
   if(field==='guard-site'){guardDraft=t.value.slice(0,300);return true;}
   if(t.type==='range'){const out=t.parentElement?.querySelector('output');if(out)out.textContent=t.value;
    // Seen at once; saved when the slider is let go (change).
    if(field==='dim')node.style.setProperty('--fr-dim',String(t.value/100));
    if(field==='blur')node.style.setProperty('--fr-blur',t.value+'px');
    if(field.startsWith('sound-')){const r=room(),k=field.slice(6),sound={...r.sound,on:r.sound.on&&!!node,[k]:Number(t.value)/100};post({op:'sound',sound});}
   }
   return true;
  }
  function change(event){
   if(!node||!node.contains(event.target))return false;
   const t=event.target,field=t.dataset.frField,num=Number(t.value);
   if(field==='item'){goalDraft=null;saveFocus(f=>({...f,itemId:t.value||null,goal:''}));return true;}
   if(field==='step'){const id=t.dataset.id,stepId=t.dataset.step,checked=t.checked;save(d=>{const entry=d.tasks?.[id]?.checklist?.find(x=>x.id===stepId);if(entry)entry.done=checked;});return true;}
   if(field==='minutes'){if(Number.isFinite(num)&&num>0)saveFocus(f=>M().setMinutes(f,num));return true;}
   if(field==='dim'||field==='blur'){saveRoom({[field]:num});return true;}
   if(field==='sound-on'){saveRoom({sound:{on:t.checked}});return true;}
   if(field?.startsWith('sound-')){saveRoom({sound:{[field.slice(6)]:num/100}});return true;}
   if(field?.startsWith('room-')){const k=field.slice(5);if(Number.isFinite(num))saveRoom({[k]:num}).then(()=>{if(k==='work')saveFocus((f,d)=>{const s=M().state(f,Date.now());return f.mode==='pomodoro'&&f.phase==='focus'&&!s.running&&s.left===s.total?M().setMode(f,'pomodoro',d.focusRoom):f;});});return true;}
   if(field==='auto'||field==='chime'){saveRoom({[field]:t.checked});return true;}
   return true;
  }
  function keydown(event){
   if(!node)return false;
   const target=event.composedPath?.()[0]||event.target,typing=/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||'')||target?.isContentEditable;
   if(event.key==='Escape'){event.preventDefault();if(panel){panel='';render();node.querySelector('[data-fr-action="panel"]')?.focus({preventScroll:true});}else close();return true;}
   if(event.key==='Enter'&&target?.dataset?.frField==='guard-site'&&G()){event.preventDefault();addSite(target);return true;}
   if(event.key===' '&&!typing&&!target?.closest?.('button,a')){event.preventDefault();toggle();return true;}
   if(event.key==='Tab'){
    // Keep the keyboard inside the room.
    const items=[...node.querySelectorAll('button:not([disabled]),a[href],input:not([type=hidden]):not([hidden]):not([disabled]),select,iframe[data-fr-guard]')].filter(el=>el.getClientRects().length);
    if(items.length){const first=items[0],last=items[items.length-1],at=node.getRootNode().activeElement;
     if(event.shiftKey&&(at===first||!node.contains(at))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(at===last||!node.contains(at))){event.preventDefault();first.focus();}}
   }
   return true;   // the workspace's own shortcuts stay quiet while the room is open
  }
  function sync(){if(node)render();}
  function destroy(){dead=true;close();clearTimeout(statusTimer);try{ac?.close?.();}catch{}}
  return {open,close,isOpen:()=>!!node,click,input,change,keydown,sync,ended,destroy};
 }
 const api={create,SCENE_NAMES};
 root.ReserveFocusRoom=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
