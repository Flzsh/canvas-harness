/* Canvas Harness focus room: a full-screen place to work, opened from the Home timer, an assignment's Focus button,
   the pony's menu or Shift+F. It runs the same session as the Home timer (focus-room-model.js has the rules), over
   a moving scene, a course's artwork, or the student's own photo or video (focus-scene.html, an extension page that
   also plays the room's sounds). The optional distraction guard (focus-guard-model.js) is set up in the Scene and
   sound panel: a switch, the student's sites and a line saying how it stands (from background.js); Chrome's access to
   other websites is asked for on its own small page (focus-guard.html), from the student's click there. Leaving the room keeps the timer running on Home. Nothing here writes to Canvas. */
(function(root){
 'use strict';
 const M=()=>root.ReserveFocusRoomModel,G=()=>root.ReserveFocusGuardModel;
 const RING=root.ReserveFocusDial?.PATH||'M60 9a51 51 0 1 1 0 102a51 51 0 1 1 0-102Z';
 const SCENE_NAMES={rain:'Rain on the window',night:'Night sky',ocean:'Ocean at dusk',lamp:'Lamp light',starry:'Painted stars',lilies:'Water lilies',ink:'Ink mountains',course:'Course art',photo:'Your photo',video:'Your video',plain:'Plain paper'};
 const DARK_SCENES=['rain','night','ocean','lamp','starry','photo','video'];
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
 function accentInk(color){
  const hex=/^#([\da-f]{6})$/i.exec(color||'');if(!hex)return '#fff';
  const rgb=hex[1].match(/../g).map(h=>{const n=parseInt(h,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#182228':'#fff';
 }
 // Capture the address while this content-script context is live. Harness's updater can reload the extension
 // before an active Canvas tab refreshes; calling runtime.getURL later would then throw and point at Canvas.
 const extensionBase=(()=>{try{
  // Canvas is explicitly listed in the manifest's fixed resources. Prefer that address for extension frames;
  // the broader custom-site rule also lists these files and Chrome may otherwise choose its temporary host.
  if(root.chrome?.runtime?.id&&/^https:\/\/[\w.-]+\.instructure\.com$/.test(root.location.origin))return `chrome-extension://${root.chrome.runtime.id}/`;
  const u=root.chrome?.runtime?.getURL?.('');if(u)return u;
 }catch{}return null;})();
 const pageURL=file=>new URL(file,extensionBase||new URL('../extension/',root.location.href)).href;
 const sceneURL=()=>pageURL('focus-scene.html');
 // Extension resources may use a temporary host; ready messages supply the verified frame's real origin.
 const frameOrigin=url=>{const u=new URL(url);return u.origin==='null'?`${u.protocol}//${u.host}`:u.origin;};
 function trustedFrameOrigin(origin,url){return origin===frameOrigin(url)||!!root.chrome?.runtime?.id&&origin===`chrome-extension://${root.chrome.runtime.id}`;}
 function loadFrame(frame,url){
  // A blank srcdoc takes precedence over src, including when the host adds it as a frame is attached.
  const unblank=()=>{if(frame.getAttribute('src')===url&&frame.hasAttribute('srcdoc'))frame.removeAttribute('srcdoc');};
  frame.addEventListener('load',unblank);frame.src=url;unblank();
 }

 // Reconcile controls in place so updates never replace a pressed button or a dragged slider.
 function patchRoom(current,next){
  const key=n=>n.nodeType===1?(n.getAttribute('data-rd-key')||n.id||(n.hasAttribute('data-fr-field')?'field:'+n.dataset.frField+':'+(n.dataset.step||''):n.hasAttribute('data-fr-action')?'action:'+n.dataset.frAction+':'+(n.dataset.value||'')+':'+(n.dataset.kind||''):'')):'';
  if(current.nodeType!==1){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
  for(const a of [...current.attributes])if(!next.hasAttribute(a.name))current.removeAttribute(a.name);
  for(const a of [...next.attributes])if(current.getAttribute(a.name)!==a.value)current.setAttribute(a.name,a.value);
  if(current.tagName==='INPUT'){if(current.value!==next.value)current.value=next.value;current.checked=next.checked;return;}
  const value=next.value,keyed=new Map([...current.childNodes].filter(key).map(n=>[key(n),n]));let cursor=current.firstChild;
  for(const desired of [...next.childNodes]){
   const existing=key(desired)?keyed.get(key(desired)):cursor;
   if(existing&&existing.nodeType===desired.nodeType&&existing.nodeName===desired.nodeName&&key(existing)===key(desired)){
    if(existing!==cursor)current.insertBefore(existing,cursor);
    patchRoom(existing,desired);cursor=existing.nextSibling;
   }else current.insertBefore(desired,cursor);
  }
  while(cursor){const rest=cursor.nextSibling;cursor.remove();cursor=rest;}
  if(current.tagName==='SELECT'&&current.value!==value)current.value=value;
 }

 function create({container,store,save,getContext,helpers,startTick=()=>{},onFinished=()=>{}}){
  const doc=container.ownerDocument,win=doc.defaultView||root;
  let node=null,ui=null,frame=null,scenery=null,dial=null,dialArc=null,ready=false,sceneOrigin='',panel='',status='',statusTimer=0,tick=0,returnTo=null,goalTimer=0,goalDraft=null,overflow=null,sent={},cheerUntil=0,dead=false,ac=null,guardDraft=null,pendingAllow=false;
  const data=()=>store.get()||{};
  const room=()=>M().cleanRoom(data().focusRoom);
  const reduced=()=>!!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const E=value=>helpers().E(value);

  function say(text,ms=5000){status=text;clearTimeout(statusTimer);if(ms)statusTimer=setTimeout(()=>{status='';paintStatus();},ms);paintStatus();}
  function paintStatus(){const el=node?.querySelector('[data-fr-status]');if(el&&el.textContent!==status)el.textContent=status;}
  function saveRoom(patch){return save(d=>{const r=M().cleanRoom(d.focusRoom);d.focusRoom=M().cleanRoom({...r,...patch,sound:{...r.sound,...(patch.sound||{})},media:{...r.media,...(patch.media||{})},guard:{...r.guard,...(patch.guard||{})}});});}
  function saveFocus(fn){return save(d=>{d.focus=fn(M().full(d.focus),d);});}

  /* ---- the backdrop frame ---- */
  // Loaded only when it has something to do: the student's own photo or video, sound, or a file being added. The
  // built-in scenes are painted in the room itself.
  let pendingStore=null;
  function ensureFrame(){
   if(frame||!node)return;
   frame=doc.createElement('iframe');frame.className='fr-scene';frame.title='Focus room backdrop';
   frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.setAttribute('allow','autoplay');
   node.insertBefore(frame,node.querySelector('.fr-dim'));ready=false;sceneOrigin='';sent={};loadFrame(frame,sceneURL());
  }
  function post(message){if(!frame||!ready||!sceneOrigin)return;try{frame.contentWindow.postMessage({type:'reserve-focus-room',...message},sceneOrigin);}catch{}}
  function sendLook(force){
   const r=room(),c=getContext(),look={scene:r.scene==='photo'||r.scene==='video'?r.scene:'plain',theme:c.theme==='dark'?'dark':'light',still:reduced()},sound={...r.sound,on:r.sound.on&&!!node};
   const a=JSON.stringify(look),b=JSON.stringify(sound);
   if(force||sent.look!==a){sent.look=a;post({op:'scene',...look});}
   if(force||sent.sound!==b){sent.sound=b;post({op:'sound',sound});}
  }
  function onMessage(event){
   if(!frame||event.source!==frame.contentWindow||!trustedFrameOrigin(event.origin,frame.src)||event.data?.type!=='reserve-focus-scene')return;
   const m=event.data,kind=m.kind;
   if(m.op==='ready'){ready=true;sceneOrigin=event.origin;node.dataset.sceneReady='true';sendLook(true);if(pendingStore){post({op:'store',...pendingStore});pendingStore=null;}return;}
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
   say(`Saving your ${MEDIA_NAMES[kind]}…`,0);
   if(!ready){pendingStore={kind,file};ensureFrame();return;}
   post({op:'store',kind,file});
  }

  /* ---- the distraction guard ---- */
  const tone=()=>node?.dataset.tone==='dark'?'dark':'light';
  // How the guard stands, from background.js: whether Chrome allows it, and whether it covers the sites right now. The
  // running session goes along so the stored copy is restored if it was ever missed.
  let guardState=null,guardAsked=0,guardWait=0;
  function askGuard(){
   const rt=root.chrome?.runtime;if(!rt?.id||!G())return;
   guardAsked=Date.now();
   try{rt.sendMessage({type:'ch-focus-guard',op:'status',record:G().record(data())},reply=>{void rt.lastError;if(dead||!reply?.ok)return;const was=JSON.stringify(guardState);guardState=reply;if(pendingAllow){pendingAllow=false;if(!reply.allowed&&room().guard.on)allowGuard();}if(JSON.stringify(guardState)!==was)render();});}catch{}
  }
  function allowGuard(){
   try{root.chrome.runtime.sendMessage({type:'ch-focus-guard',op:'allow'},()=>{void root.chrome.runtime.lastError;});}catch{say('Reload the page, then try again.');return;}
   say('Chrome will ask in the small window that opened. Click Allow there, then come back here.',9000);
   clearInterval(guardWait);let n=0;guardWait=setInterval(()=>{if(dead||!node||++n>60||guardState?.allowed){clearInterval(guardWait);guardWait=0;return;}askGuard();},2000);
  }
  function guardLine(r){
   if(!r.guard.on)return r.guard.sites.length?'Off: the sites below open as usual. Tick the switch to cover them while you focus.':'';
   if(!root.chrome?.runtime?.id)return 'In this preview the guard can’t reach other sites.';
   if(!guardState)return 'Checking…';
   if(!guardState.allowed)return 'needs-allow';
   if(!r.guard.sites.length)return 'Add a site for it to cover.';
   const s=M().state(data().focus,Date.now());
   if(!s.running||s.brk)return s.brk?'Resting during the break: your sites are open.':'Ready. Your sites wait as soon as a focus session runs.';
   if(!(guardState.until>Date.now()))return 'Starting…';
   const until=s.mode==='open'?'until you finish':`until ${helpers().formatDate(guardState.until,getContext().s.timeZone,{hour:'numeric',minute:'2-digit'})}`;
   return `On now: ${r.guard.sites.length===1?r.guard.sites[0]:r.guard.sites.length+' sites'} wait ${until}.`;
  }
  function addSite(input){
   const r=room(),{host,problem}=G().check(input.value,r.guard.sites,[win.location.origin]);
   if(problem){say(problem);return;}
   guardDraft=null;input.value='';
   // Adding a site means the student wants it covered, so the guard switches on (and Chrome's access is asked for).
   const was=r.guard.on;if(!was)pendingAllow=true;
   saveRoom({guard:{on:true,sites:[...r.guard.sites,host]}}).then(()=>{say(was?`${host} waits while you focus.`:`The distraction guard is on. ${host} waits while you focus.`);askGuard();});
  }
  function guardSection(r){
   if(!G())return '';
   const sites=r.guard.sites.map(h=>`<li><span>${E(h)}</span><button type="button" class="fr-link-button" data-fr-action="guard-remove" data-value="${E(h)}" aria-label="Remove ${E(h)}">Remove</button></li>`).join('');
   return `<h3 id="fr-guard">Distraction guard</h3>
<label class="fr-check"><input type="checkbox" data-fr-field="guard-on" ${r.guard.on?'checked':''}><span>Cover the sites below while you focus</span></label>
${(()=>{const line=guardLine(r);return line==='needs-allow'?`<p class="fr-guard-status" data-state="allow" role="status">Chrome hasn’t given the guard access to other sites yet. <button type="button" class="fr-link-button" data-fr-action="guard-allow">Allow in Chrome</button></p>`:line?`<p class="fr-guard-status" data-state="${guardState?.allowed&&/^On now/.test(line)?'on':'info'}" role="status">${E(line)}</p>`:'';})()}
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
   const task=`<aside class="fr-task fr-glass" data-rd-key="task" aria-label="What you are working on">
<label class="fr-task-pick"><span>Working on</span><select data-fr-field="item"><option value="">Nothing in particular</option>${options}</select></label>
${item?`${course?`<p class="fr-task-course" style="--fr-course:${E(course.color||'#C96442')}"><i></i>${E(course.shortName||course.name)}</p>`:''}<h2>${E(item.name)}</h2>
${item.dueAt?`<p class="fr-task-due">Due ${E(h.formatDate(item.dueAt,c.s.timeZone,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</p>`:''}
${steps.length?`<ul class="fr-steps">${steps.slice(0,12).map(st=>`<li><label><input type="checkbox" data-fr-field="step" data-id="${E(item.id)}" data-step="${E(st.id)}" ${st.done?'checked':''}><span>${E(st.text)}</span></label></li>`).join('')}</ul>`:''}
${local.notes?`<p class="fr-notes">${E(String(local.notes).slice(0,240))}${String(local.notes).length>240?'…':''}</p>`:''}
<div class="fr-task-actions">${link?`<a class="fr-button" href="${E(link)}" target="_blank" rel="noopener noreferrer">Open in Canvas</a>`:''}${done?'<span class="fr-done">Done</span>':`<button type="button" class="fr-button" data-rd-action="check-off" data-id="${E(item.id)}">Mark done</button>`}</div>`:'<p class="fr-task-empty">Pick an assignment to keep its steps and notes beside the timer.</p>'}</aside>`;
   return `<header class="fr-top" data-rd-key="top"><div class="fr-modes" role="radiogroup" aria-label="Kind of session">${modes}</div>
<div class="fr-tools">${tool('panel','scene','Scene and sound',`data-value="scene" aria-pressed="${panel==='scene'}"`)}${tool('panel','stats','Your focus',`data-value="stats" aria-pressed="${panel==='stats'}"`)}${doc.fullscreenEnabled!==false?tool('fullscreen',full?'shrink':'full',full?'Leave full screen':'Full screen'):''}${tool('close','close','Leave the room (Esc). The timer keeps running.')}</div></header>
<main class="fr-center" data-rd-key="timer" data-brk="${s.brk}" data-running="${s.running}"><p class="fr-phase">${E(phaseLine(s,r))}</p>
<div class="fr-dial" data-running="${s.running}"><svg viewBox="0 0 120 120" aria-hidden="true"><path class="fr-track" d="${RING}"/><path class="fr-arc" pathLength="1" d="${RING}" style="stroke-dashoffset:${(1-s.progress).toFixed(4)}"/></svg><output class="fr-time" data-fr-time aria-live="off">${M().clock(s.shown)}</output></div>
${s.brk&&s.running?'<p class="fr-breath" aria-hidden="true"><span>Breathe in</span><span>Breathe out</span><span>Breathe slowly</span></p>':''}
<label class="fr-goal"><span class="fr-sr">What will you finish?</span><input type="text" data-fr-field="goal" maxlength="140" autocomplete="off" placeholder="What will you finish?" value="${E(goalDraft??s.goal)}"></label>
<div class="fr-actions">${actions}</div>${lengths}<p class="fr-status" role="status" data-fr-status>${E(status)}</p></main>
${task}${pony(s)}${panel?`<section class="fr-panel fr-glass" data-rd-key="panel-${panel}" aria-label="${panel==='stats'?'Your focus':'Scene and sound'}">${panel==='stats'?statsPanel(c,h):scenePanel(r)}</section>`:''}`;
  }
  function pony(s){
   const P=root.ReservePets,A=root.ReservePetArt;if(!P||!A)return '';
   const pet=P.clean(data().pet);if(!pet.enabled||pet.roam==='off')return '';
   const c=A.COATS[pet.coat]||A.COATS.oat,pose=Date.now()<cheerUntil?'cheer':s.running&&!s.brk?'read':s.brk?'lie':'stand';
   return `<div class="fr-pony" data-rd-key="pony" aria-hidden="true"><div class="pet" data-pose="${pose}" data-face="left" data-gear="${E(pet.gear)}" data-still="${reduced()}" style="--pet-size:96px;--pet-coat:${c.coat};--pet-shade:${c.shade};--pet-mane:${c.mane};--pet-muzzle:${c.muzzle};--pet-harness:${A.HARNESS[pet.harness]||A.HARNESS.red}">${A.svg({title:pet.name})}</div></div>`;
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
   node.dataset.tone=dark?'dark':'light';node.dataset.scene=r.scene;node.dataset.panel=panel;
   scenery?.show({scene:r.scene,theme:c.theme,still:reduced()});
   {const s=M().state(data().focus,Date.now());scenery?.session?.({progress:s.progress,brk:s.brk,running:s.running});}
   if(r.scene==='photo'||r.scene==='video'||r.sound.on)ensureFrame();
   node.style.setProperty('--fr-dim',String(r.dim/100));node.style.setProperty('--fr-blur',r.blur+'px');
   node.style.setProperty('--fr-button-ink',accentInk(c.accent||'#C96442'));
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
    const next=doc.createElement('div');next.className='fr-ui';next.innerHTML=html;
    patchRoom(ui,next);ui.__html=html;
    if(key){const el=ui.querySelector(key);if(el&&el!==active){el.focus({preventScroll:true});if(Number.isInteger(caret)&&el.setSelectionRange&&el.type==='text')try{el.setSelectionRange(caret,caret);}catch{}}}}
   const arc=node.querySelector('.fr-arc');
   if(arc!==dialArc){dial?.destroy();dialArc=arc;dial=arc&&root.ReserveFocusDial?.create(arc,{getFocus:()=>data().focus});}
   dial?.sync();look();ticking();
   if(panel==='scene'&&room().guard.on&&Date.now()-guardAsked>5000)askGuard();
  }
  // Between renders only the clock and its ring move.
  function step(){
   if(!node||dead)return;const s=M().state(data().focus,Date.now());
   const t=node.querySelector('[data-fr-time]'),text=M().clock(s.shown);
   if(t&&t.textContent!==text)t.textContent=text;dial?.sync();
   scenery?.session?.({progress:s.progress,brk:s.brk,running:s.running});
   if(s.elapsed>=60&&!s.brk&&!node.querySelector('[data-fr-action="finish"]')){render();return;}
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
   node.innerHTML=`<div class="fr-art" aria-hidden="true" hidden></div><div class="fr-dim" aria-hidden="true"></div><div class="fr-ui"></div>
<input type="file" hidden data-fr-file="photo" accept="${M().MEDIA.photo.types.join(',')}"><input type="file" hidden data-fr-file="video" accept="${M().MEDIA.video.types.join(',')}"><input type="file" hidden data-fr-file="audio" accept="${M().MEDIA.audio.types.join(',')},.m4a,.mp3,.flac">`;
   ui=node.querySelector('.fr-ui');frame=null;ready=false;sceneOrigin='';sent={};
   const canvas=doc.createElement('canvas');canvas.className='fr-backdrop';canvas.setAttribute('aria-hidden','true');node.prepend(canvas);
   scenery=root.ReserveFocusSceneRenderer?.create(canvas)||null;
   win.addEventListener('message',onMessage);
   for(const input of node.querySelectorAll('[data-fr-file]'))input.addEventListener('change',()=>picked(input));
   container.append(node);
   overflow=doc.documentElement.style.overflow;doc.documentElement.style.overflow='hidden';
   doc.addEventListener('fullscreenchange',render);
   render();
   (node.querySelector('.fr-primary')||node).focus({preventScroll:true});
  }
  function close(){
   if(!node)return;
   post({op:'sound',sound:{on:false}});
   if(doc.fullscreenElement===node)doc.exitFullscreen?.().catch(()=>{});
   win.removeEventListener('message',onMessage);doc.removeEventListener('fullscreenchange',render);
   clearInterval(tick);tick=0;clearTimeout(goalTimer);flushGoal();
   scenery?.destroy();scenery=null;
   dial?.destroy();dial=null;dialArc=null;
   node.remove();node=null;ui=null;frame=null;ready=false;pendingStore=null;panel='';status='';guardDraft=null;
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
   if(button.disabled)return true;
   const action=button.dataset.frAction,value=button.dataset.value;
   if(action==='close'){close();return true;}
   if(action==='toggle'){toggle();return true;}
   if(action==='finish'){finish();return true;}
   if(action==='reset'){saveFocus(f=>M().reset(f));return true;}
   if(action==='mode'&&M().MODES.includes(value)){if(M().full(data().focus).mode!==value)saveFocus((f,d)=>M().setMode(f,value,d.focusRoom));return true;}
   if(action==='minutes'){const n=Number(value);saveFocus(f=>M().setMinutes(f,n));return true;}
   if(action==='panel'){panel=panel===value?'':value||'';render();if(button.dataset.section)node.querySelector('#fr-pomodoro')?.scrollIntoView({block:'start'});return true;}
   if(action==='fullscreen'){if(doc.fullscreenElement)doc.exitFullscreen?.().catch(()=>{});else node.requestFullscreen?.().catch(()=>say('Full screen is not available here.'));return true;}
   if(action==='scene'&&M().SCENES.includes(value)){saveRoom({scene:value});return true;}
   if(action==='pick'&&M().MEDIA[button.dataset.kind]){node.querySelector(`[data-fr-file="${button.dataset.kind}"]`)?.click();return true;}
   if(action==='guard-allow'){allowGuard();return true;}
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
   if(field==='guard-on'&&G()){const on=t.checked;pendingAllow=on;saveRoom({guard:{on}}).then(()=>{say(on?'The distraction guard is on.':'The distraction guard is off.');askGuard();});return true;}
   if(field==='item'){clearTimeout(goalTimer);goalDraft=null;saveFocus(f=>({...f,itemId:t.value||null,goal:''}));return true;}
   if(field==='step'){const id=t.dataset.id,stepId=t.dataset.step,checked=t.checked;save(d=>{const entry=d.tasks?.[id]?.checklist?.find(x=>x.id===stepId);if(entry)entry.done=checked;});return true;}
   if(field==='minutes'){if(Number.isFinite(num)&&num>0)saveFocus(f=>M().setMinutes(f,num));return true;}
   if(field==='dim'||field==='blur'){saveRoom({[field]:num});return true;}
   if(field==='sound-on'){saveRoom({sound:{on:t.checked}});return true;}
   if(field?.startsWith('sound-')){saveRoom({sound:{[field.slice(6)]:num/100}});return true;}
   if(field?.startsWith('room-')){const k=field.slice(5);if(Number.isFinite(num)&&t.value!=='')saveRoom({[k]:num}).then(()=>saveFocus((f,d)=>{const s=M().state(f,Date.now()),phaseKey={focus:'work',short:'short',long:'long'}[s.phase];return f.mode==='pomodoro'&&k===phaseKey&&!s.running&&s.left===s.total?{...f,minutes:d.focusRoom[k],remaining:d.focusRoom[k]*60}:f;}));return true;}
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
    const items=[...node.querySelectorAll('button:not([disabled]),a[href],input:not([type=hidden]):not([hidden]):not([disabled]),select')].filter(el=>el.getClientRects().length);
    if(items.length){const first=items[0],last=items[items.length-1],at=node.getRootNode().activeElement;
     if(event.shiftKey&&(at===first||!node.contains(at))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(at===last||!node.contains(at))){event.preventDefault();first.focus();}}
   }
   return true;   // the workspace's own shortcuts stay quiet while the room is open
  }
  function sync(){if(node)render();}
  function destroy(){dead=true;close();clearTimeout(statusTimer);clearInterval(guardWait);try{ac?.close?.();}catch{}}
  return {open,close,isOpen:()=>!!node,click,input,change,keydown,sync,ended,destroy};
 }
 const api={create,SCENE_NAMES,patchRoom,frameOrigin,trustedFrameOrigin,loadFrame,pageURL,accentInk};
 root.ReserveFocusRoom=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
