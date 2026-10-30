/* Canvas Harness companion: where the pony goes and what it does. It walks along the tops of the panels and the
   bottom of the window, rests, can be picked up and set down, and helps with the day: it tells you what is next,
   studies beside a running timer, and is pleased when work is finished. It never scolds and nothing is lost by
   ignoring it. Only the student's own preferences and counters are stored. Creator: Flzsh. */
(function(root){
 'use strict';
 const DEFAULTS={
   enabled:true,
   name:'Biscuit',
   knowledge:'basic',
   coat:'oat',
   harness:'red',
   gear:'full',
   roam:'page',
   size:'medium',
   nudges:'helpful',
   treats:1,
   fed:0,
   xp:0,
   streakDay:'',
   streak:0,
   best:0,
   told:'',
   brain:null,
   skills:{},
   reminders:[],
   routines:[]
 };
 const Brain=()=>root.ReservePonyBrain,Ask=()=>root.ReservePonyAsk,Parse=()=>root.ReserveBiscuitParse;
 const SIZES={small:46,medium:58,large:74};
 // What a level needs, and what it opens. Levels only go up.
 const ROAM=['page','home','off'],NUDGES=['helpful','quiet','off'],GEAR=['full','collar','none'],KNOWLEDGE=['basic','more','most'];
 const LEVEL_XP=[0,30,80,150,250,380,540,740,980,1260];
 const UNLOCKS={coat:{oat:1,chestnut:1,dapple:2,sage:4,rose:6,ink:8},harness:{red:1,clay:1,gold:3,forest:3,ocean:5,iris:7}};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const level=xp=>{let n=1;while(n<LEVEL_XP.length&&xp>=LEVEL_XP[n])n++;return n;};
 const levelProgress=xp=>{const n=level(xp),from=LEVEL_XP[n-1],to=LEVEL_XP[n];return to===undefined?1:(xp-from)/(to-from);};
 const unlocked=(kind,key,xp)=>(UNLOCKS[kind]?.[key]||1)<=level(xp);
 function clean(value){
  const v=value&&typeof value==='object'&&!Array.isArray(value)?value:{},art=root.ReservePetArt||(typeof module==='object'&&module.exports?require('./pet-art.js'):null);
  const out={...DEFAULTS},int=(n,max)=>Number.isInteger(n)?clamp(n,0,max):0;
  if(typeof v.enabled==='boolean')out.enabled=v.enabled;
  if(Object.hasOwn(v,'knowledge')&&KNOWLEDGE.includes(v.knowledge))out.knowledge=v.knowledge;
  if(typeof v.name==='string'&&v.name.trim())out.name=v.name.trim().slice(0,24);
  if(Object.hasOwn(v,'knowledge')&&KNOWLEDGE.includes(v.knowledge))out.knowledge=v.knowledge;
  if(art?.COATS[v.coat])out.coat=v.coat;if(art?.HARNESS[v.harness])out.harness=v.harness;
  if(GEAR.includes(v.gear))out.gear=v.gear;
  if(ROAM.includes(v.roam))out.roam=v.roam;
  if(SIZES[v.size])out.size=v.size;
  if(NUDGES.includes(v.nudges))out.nudges=v.nudges;
  out.treats=v.treats===undefined?DEFAULTS.treats:int(v.treats,99);
  out.fed=int(v.fed,1e6);
  out.xp=int(v.xp,1e6);
  out.streak=int(v.streak,10000);
  out.best=Math.max(out.streak,int(v.best,10000));
  if(typeof v.streakDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.streakDay))out.streakDay=v.streakDay;
  if(typeof v.told==='string')out.told=v.told.slice(0,140);
  out.brain=Brain()?.cleanLearning(v.brain)||(v.brain&&typeof v.brain==='object'?v.brain:null);
  out.skills=Brain()?.cleanSkills?.(v.skills)||{};out.reminders=Ask()?.cleanReminders(v.reminders,0)||[];out.routines=Ask()?.cleanRoutines(v.routines)||[];
  return out;
 }
 // Finishing a piece of work: a treat, some experience, and the day counts toward the run of days.
 function reward(pet,kind,today){
  const next={...pet},gain={done:10,focus:6,plan:2}[kind]||0;
  next.xp=clamp(next.xp+gain,0,1e6);
  if(kind==='done'||kind==='focus')next.treats=clamp(next.treats+1,0,99);
  if((kind==='done'||kind==='focus')&&today&&next.streakDay!==today){
   const y=new Date(today+'T12:00:00Z');y.setUTCDate(y.getUTCDate()-1);
   next.streak=next.streakDay===y.toISOString().slice(0,10)?next.streak+1:1;next.streakDay=today;next.best=Math.max(next.best,next.streak);
  }
  return {pet:next,leveled:level(next.xp)>level(pet.xp)};
 }
 function feed(pet){return pet.treats>0?{...pet,treats:pet.treats-1,fed:pet.fed+1,xp:clamp(pet.xp+1,0,1e6)}:pet;}
 function createActivity({now=()=>Date.now(),storage=()=>root.sessionStorage,hidden=()=>false}={}){
  const key='canvas-harness:activity',gap=600000;let last=null,visibleAt=null,hiddenAt=null,active=0,offered=0,session=0,written=-Infinity,available=true,saved=null;
  const reset=()=>{
    last=visibleAt=null;
    active=offered=0;
    session++;
  },snapshot=at=>{
    const inputAt=hiddenAt??at;
    if(last!==null&&(inputAt-last>=gap||inputAt<last||hiddenAt!==null&&at-hiddenAt>=gap))reset();
    return {active:active+(visibleAt!==null&&hiddenAt===null?at-visibleAt:0),offered,session:String(session)};
  };
  try{saved=storage()?.getItem(key);}catch{available=false;}
  try{
   const v=JSON.parse(saved),at=now(),number=n=>Number.isFinite(n)&&n>=0;
   if(v&&
     number(v.active)&&
     number(v.last)&&
     number(v.offered)&&
     number(v.savedAt)&&
     Number.isSafeInteger(v.session)&&
     v.session>=0&&
     v.session<Number.MAX_SAFE_INTEGER&&
     v.offered<=v.active&&
     v.active<=v.savedAt&&
     v.last<=v.savedAt&&
     v.savedAt<=at&&
     at-v.last<gap&&
     (v.hiddenAt===null||number(v.hiddenAt)&&v.hiddenAt>=v.last&&v.hiddenAt<=v.savedAt&&at-v.hiddenAt<gap)){
    active=v.active;last=v.last;hiddenAt=v.hiddenAt;offered=v.offered;session=v.session;written=v.savedAt;visibleAt=hiddenAt===null?at:null;
   }
  }catch{}
  function persist(at,force=false){
   if(!available||hiddenAt!==null||hidden()||!force&&(last===null||at-written<30000))return;
   const value=snapshot(at);if(!force&&last===null)return;written=at;
   try{storage()?.setItem(key,JSON.stringify({active:value.active,last,hiddenAt,offered,session,savedAt:at}));}catch{available=false;}
  }
  function visibility(at,isHidden){
   if(isHidden===(hiddenAt!==null))return;
   if(isHidden){snapshot(at);if(visibleAt!==null)active+=at-visibleAt;visibleAt=null;hiddenAt=at;}
   else{const pause=at-hiddenAt;if(pause>=gap||pause<0)reset();else if(last!==null)last+=pause;hiddenAt=null;snapshot(at);if(last!==null)visibleAt=at;persist(at);}
  }
  visibility(now(),hidden());
  return {snapshot(at){
    const value=snapshot(at);
    persist(at);
    return value;
  },input(at){
    if(hiddenAt!==null||hidden())return;
    snapshot(at);
    if(last===null)visibleAt=at;
    last=at;
    persist(at);
  },visibility,shown(at){offered=snapshot(at).active;persist(at);},flush(at){persist(at,true);}};
 }

 // How the pony moves. Everything that changes over time is a number eased every frame, so there is no cut between
 // resting and walking: speed builds and falls away, the legs' swing grows with the speed, the body sinks when it
 // lies down and rises before it walks, and the neck swings to wherever the pose wants it.
 const POSE={
   stand:{down:0,neck:9,head:0},
   flag:{down:0,neck:6,head:-2},
   lie:{down:11.5,neck:10,head:0},
   sleep:{down:11.5,neck:44,head:18},
   read:{down:11.5,neck:29,head:14},
   eat:{down:0,neck:60,head:22}
 };
 const PetArt=()=>root.ReservePetArt||(typeof module==='object'&&module.exports?require('./pet-art.js'):null),
   customPose=(...args)=>PetArt().customPose(...args),
   customDrawing=(...args)=>PetArt().customDrawing(...args);
 function create({
   container,
   getPet,
   getCustomPet=()=>null,
   getData=()=>null,
   store=null,
   savePet,
   claimNudge,
   claimOffer,
   claimEngineOffer,
   info=()=>({}),
   actions={},
   now=()=>Date.now()
 }){
  if(root.ReserveSite?.vanillaPage(root.location))return null;
  const doc=container.ownerDocument||root.document,
    win=doc.defaultView||root,
    art=root.ReservePetArt,
    E=value=>root.ReserveUI?.escapeHTML?root.ReserveUI.escapeHTML(value):String(value).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
  let pet=clean(getPet()),layer=null,node=null,bubble=null,dead=false,film=0,timer=0,last=0,next=0,debt=0,stepping=false,pose='stand',face='right';
  let custom=null,
    customMotion='gentle',
    drawingNode=null,
    customImage=null,
    customSource='',
    personal=getData(),
    hydratedPet=null,
    hydrationKey='',
    hydrationPending='',
    hydrationAt=-Infinity,
    hydrationRevision=0;
  const companion=()=>art.identity(personal||pet,custom),companionName=()=>companion().name;
  function hydrateCustom(){
   const selected=art.identity(personal),key=selected.id?selected.id+'|'+selected.sourceName:'';
   if(key!==hydrationKey){hydrationRevision++;hydrationKey=key;hydrationPending='';hydratedPet=null;hydrationAt=-Infinity;if(!key)art.clearHydration(store);}
   if(!key||art.identity(personal,getCustomPet()).pack||hydratedPet||hydrationPending===key||now()-hydrationAt<5000||!store?.owner)return;
   const turn=++hydrationRevision;
   hydrationPending=key;
   hydrationAt=now();
   Promise.resolve(art.hydrate(personal,{store})).then(pack=>{
     if(dead||turn!==hydrationRevision)return;
     hydratedPet=pack;
     if(node){dress();invalidate();}
   }).catch(()=>{}).finally(()=>{
     if(turn===hydrationRevision)hydrationPending='';
   });
  }
  let spot={ledge:null,u:160},grab=null,releaseGrab=null,menuOpen=false,focusing=false,quietUntil=0,lastInput=now(),sayTimer=0,unseen=0;
  let thought={mood:'calm',dueToday:0,suggestions:[]},
    snapshot={},
    thoughtKey='',
    thoughtVersion=0,
    nudgeCheck='',
    thoughtAt=-Infinity,
    brainTick=0,
    hideTimer=0,
    typingUntil=0,
    composing=false,
    dragging=false,
    nudgeOpen=false,
    claiming=false,
    exposed=[],
    focusDetails={},
    pendingBreak=false;
  let askChoices=[],askSelected=0,askText='',bubbleVersion=0,scheduled=null,scheduleClaiming=false,commandBusy=false;
  const undoChanges=[];
  const offered=new Set(),newId=()=>`pony-${now()}-${root.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`;
  const engine=root.ReserveBiscuitEngine?.create(),engineMemory={items:[],lastOffer:0},engineSession={};let engineCard=null,previewTimer=0;
  let catalogueRows=null,catalogueLoad=null,catalogueTurn=0,submitTurn=0,knowledgeTier='',knowledgeLoad=null,knowledgeTurn=0;
  // One sync reads the workspace's context once: choosing the knowledge tier and refreshing the brain each built all of
  // it on every dashboard render. The store only changes asynchronously, so both readers see the same data.
  const hostInfo=info;let syncInfo=null;info=()=>syncInfo?syncInfo.data||(syncInfo.data=hostInfo()):hostInfo();
  // The engine indexes a snapshot once (prepare() keeps the last one by identity). Offers reuse one object while the
  // brain's thought is unchanged, refreshed with the current values, so a render does not rebuild the whole index.
  let offerSnap=null,offerVersion=-1;
  const offerSnapshot=()=>{
    if(!offerSnap||offerVersion!==thoughtVersion||!Brain()){offerVersion=thoughtVersion;offerSnap={};}
    return Object.assign(offerSnap,snapshot,{now:now()});
  };
  const moreRules=data=>Array.isArray(data.features)?data.features.find(row=>row?.id==='biscuit-more-rules')?.on===true:data.features?.['biscuit-more-rules']===true,
    knowledgeChoice=()=>moreRules(info())?pet.knowledge:'basic';
  function loadKnowledge(){
   if(dead||!pet.enabled){if(knowledgeTier||knowledgeLoad){knowledgeTurn++;knowledgeTier='';knowledgeLoad=null;}return null;}
   const tier=knowledgeChoice();if(typeof root.ReserveBiscuitRules?.load!=='function'||knowledgeTier===tier)return knowledgeLoad;
   const turn=++knowledgeTurn;knowledgeTier=tier;
   knowledgeLoad=Promise.resolve().then(()=>{
     if(!dead&&turn===knowledgeTurn&&pet.enabled&&knowledgeChoice()===tier)
       return Promise.all([root.ReserveBiscuitRules.load(tier),root.ReserveBiscuitLanguage?.load?.()]);
   }).then(()=>{
     if(dead||turn!==knowledgeTurn||!pet.enabled||knowledgeChoice()!==tier)return;
     refreshBrain(true);
     const input=bubble?.querySelector('[data-pet-question]');
     if(input?.value?.trim())previewAsk({target:input,flush:true});
   }).catch(()=>{
     if(!dead&&turn===knowledgeTurn)knowledgeTier='';
   }).finally(()=>{
     if(turn===knowledgeTurn)knowledgeLoad=null;
   });
   return knowledgeLoad;
  }
  function loadCatalogue(force=false){
   if(typeof actions.catalogue!=='function')return null;
   if(catalogueLoad)return catalogueLoad;
   if(catalogueRows&&!force)return Promise.resolve(catalogueRows);
   catalogueRows=null;
   const turn=++catalogueTurn;
   catalogueLoad=Promise.resolve().then(()=>actions.catalogue()).then(value=>{
     if(!dead&&turn===catalogueTurn)
       catalogueRows=(Array.isArray(info().catalogue)?info().catalogue:Array.isArray(value)?value:Array.isArray(value?.catalogue)?value.catalogue:[]).slice(
         0,
         512).map(row=>
         ({
           id:row.id,
           name:row.name,
           kind:row.kind,
           ...(Array.isArray(row.aliases)?{aliases:row.aliases.slice(0,12)}:{}),
           ...(row.builtin?{builtin:true}:{}),
           active:row.active===true||row.current===true
         }));
   }).catch(()=>{
     if(!dead&&turn===catalogueTurn)catalogueRows=[];
   }).finally(()=>{
     if(dead||turn!==catalogueTurn)return;
     catalogueLoad=null;
     refreshBrain(true);
     const input=bubble?.querySelector('[data-pet-question]');
     if(input?.value?.trim())previewAsk({target:input});
   });
   return catalogueLoad;
  }
  async function submitCandidate(input){
    const turn=++submitTurn,version=bubbleVersion,tier=knowledgeChoice(),text=input?.value?.trim();
    if(catalogueLoad)await catalogueLoad;
    if(knowledgeLoad)await knowledgeLoad;
    if(dead||turn!==submitTurn||version!==bubbleVersion||knowledgeChoice()!==tier||!menuOpen||!input||input.value.trim()!==text)return;
    if(text!==askText||!askChoices.length)previewAsk({target:input,flush:true});
    if(askChoices[askSelected])void useCandidate(askChoices[askSelected]);
  }
  const activeUse=createActivity({now,storage:()=>win.sessionStorage,hidden:()=>doc.hidden});
  // what it is doing: null (resting), a walk, or a jump; and the eased numbers
  let goal=null,rest='stand',speed=0,phase=0,follow=0,reel=0,reelDue=0,reelEvery=0,offFilm=null,filmAt=-Infinity,filmTick=0;const ch={leg:0,down:0,neck:9,head:0,alpha:1};
  const FILM=1000/24,STEP=1/60,watched=new Set();
  let geometry=null,
    dirty=true,
    layoutFrame=0,
    layoutTimer=0,
    layoutVersion=0,
    resizeWatch=null,
    layoutWatch=null,
    life=0,
    decisionPending=false,
    layoutAnimations=new WeakSet(),
    bubbleBox={w:250,h:120};
  const filmNow=()=>win.performance?.now?.()??now(),motionMedia=win.matchMedia?.('(prefers-reduced-motion: reduce)');let motionChange=null;
  const reduced=()=>menuOpen||['off','still'].includes(container.dataset.motionStyle)||customMotion!=='gentle'||!!motionMedia?.matches;
  const size=()=>custom?custom.size[0]*(SIZES[pet.size]||SIZES.medium)/SIZES.medium:SIZES[pet.size]||SIZES.medium,
    height=()=>custom?size()*custom.size[1]/custom.size[0]:size()*64/72,
    ground=()=>custom?height()*custom.ground/custom.size[1]:height()*60/64;
  const visible=()=>pet.enabled&&pet.roam!=='off'&&!(pet.brain?.hiddenUntil>now());
  function mount(){
   if(layer||dead)return;
   layer=doc.createElement('div');layer.className='pet-layer';
   layer.innerHTML=`<button type="button" class="pet" data-pose="stand" data-face="right" aria-haspopup="${Brain()||Parse()?'dialog':'menu'}" aria-expanded="false"></button>`;
   container.append(layer);node=layer.firstElementChild;
   node.addEventListener('pointerdown',down);node.addEventListener('click',click);node.addEventListener('keydown',key);
    for(const type of ['animationstart','animationend','animationcancel'])node.addEventListener(type,resetReels);
   win.addEventListener('scroll',invalidate,{passive:true,capture:true});win.addEventListener('resize',invalidate,{passive:true});
   // the workspace column scrolls inside the workspace
   container.addEventListener('scroll',invalidate,{passive:true,capture:true});
   for(const type of ['load','transitionrun','transitionend','transitioncancel','animationend','animationcancel'])container.addEventListener(type,invalidate,{passive:true,capture:true});
   doc.fonts?.addEventListener?.('loadingdone',invalidate);
   const mounted=++life;offFilm=root.ReserveMotion?.onFilmTick?.(onFilm)||null;
   motionChange=()=>{if(mounted!==life)return;dress();resetReels();invalidate();};motionMedia?.addEventListener?.('change',motionChange);
   // a bubble that grows (a preview line appears) keeps its bottom above the pet instead of growing down over it
   if(win.ResizeObserver)
     resizeWatch=new win.ResizeObserver(entries=>{
       if(mounted!==life)return;
       if(bubble&&entries?.some?.(entry=>entry.target===bubble)){measureBubble();placeBubble();}
       invalidate();
     });
   if(win.MutationObserver){
    layoutWatch=new win.MutationObserver(records=>{
     if(mounted!==life)return;
     for(const r of records)
       if(node?.contains(r.target)){
         if(r.type==='childList'){rig=null;resetReels();}else if(r.type==='attributes'&&['class','data-pose','data-face','data-lying','data-still','data-gear'].includes(r.attributeName))resetReels();
       }
     if(records.some(r=>r.type==='attributes'&&(r.target===container||r.target.contains?.(container))&&['class','style','data-motion-style','data-feature-motion'].includes(r.attributeName))){
       dress();
       resetReels();
     }
     if(records.some(changesPlaces))invalidate();
    });
    layoutWatch.observe(container,{subtree:true,childList:true,attributes:true,characterData:true,characterDataOldValue:true});
    for(let p=container.parentElement||container.getRootNode?.().host;p;p=p.parentElement)layoutWatch.observe(p,{attributes:true});
   }
   doc.addEventListener('pointermove',seen,{passive:true});doc.addEventListener('keydown',seen,{passive:true});
   for(const type of ['input','beforeinput','compositionstart','compositionend','pointerdown','pointerup','pointercancel','dragstart','dragend'])
     doc.addEventListener(type,activity,{passive:true,capture:true});
   // Geometry events follow modules immediately; input also checks for an unobserved position change.
   doc.addEventListener('visibilitychange',wake);win.addEventListener('pagehide',saveActivity);
   dress();home();place();paint();plan(1400);roll();
    if(Brain()){refreshBrain();checkSchedule();startBrain();}
  }
  function unmount(){
   if(!layer)return;offFilm?.();offFilm=null;closeBubble();stop();clearTimeout(node._cheer);releaseGrab?.();grab=null;goal=null;speed=0;life++;
   node.removeEventListener('pointerdown',down);node.removeEventListener('click',click);node.removeEventListener('keydown',key);
    for(const type of ['animationstart','animationend','animationcancel'])node.removeEventListener(type,resetReels);
   motionMedia?.removeEventListener?.('change',motionChange);motionChange=null;
    cancelPlaces();
    resizeWatch?.disconnect();
    layoutWatch?.disconnect();
    resizeWatch=layoutWatch=null;
    watched.clear();
    layoutAnimations=new WeakSet();
    geometry=null;
    dirty=true;
    rig=null;
   win.removeEventListener('scroll',invalidate,{capture:true});container.removeEventListener('scroll',invalidate,{capture:true});win.removeEventListener('resize',invalidate);
   for(const type of ['load','transitionrun','transitionend','transitioncancel','animationend','animationcancel'])container.removeEventListener(type,invalidate,{capture:true});
   doc.fonts?.removeEventListener?.('loadingdone',invalidate);
   doc.removeEventListener('pointermove',seen);doc.removeEventListener('keydown',seen);doc.removeEventListener('visibilitychange',wake);win.removeEventListener('pagehide',saveActivity);
   for(const type of ['input','beforeinput','compositionstart','compositionend','pointerdown','pointerup','pointercancel','dragstart','dragend'])doc.removeEventListener(type,activity,{capture:true});
   clearInterval(brainTick);brainTick=0;
    clearTimeout(reel);reel=0;reels.clear();reelsDirty=true;layer.remove();layer=node=drawingNode=customImage=null;customSource='';
  }
  function startBrain(){
    if(Brain()&&!doc.hidden&&!brainTick)brainTick=setInterval(()=>{refreshBrain(true);checkSchedule();offerBreak();offerStretch();maybeNudge();},60000);
  }
  function saveActivity(){activeUse.flush(now());}
  function seen(){
    if(!doc.hidden)activeUse.input(now());
    lastInput=now();
    scheduleFollow();
    if(!reel&&layer&&!doc.hidden&&(reelsDirty||reels.size))roll();
    if(rest==='sleep'&&!goal&&!menuOpen)settle('lie',4000);
  }
  function activity(event){
    scheduleFollow();
    const type=event.type;
    if(type==='pointerdown'&&!doc.hidden)activeUse.input(now());
    if(type==='compositionstart')composing=true;
    if(type==='compositionend'){composing=false;typingUntil=now()+5000;}
    if(type==='input'||type==='beforeinput')typingUntil=now()+5000;
    if(type==='pointerdown'||type==='dragstart')dragging=true;
    if(['pointerup','pointercancel','dragend'].includes(type))dragging=false;
  }
  function wake(){
    activeUse.visibility(now(),doc.hidden);
    drawCustom();
    if(doc.hidden){
      clearInterval(brainTick);
      brainTick=0;
      stop();
      clearTimeout(reel);
      reel=0;
      cancelPlaces();
      releaseGrab?.();
      if(grab){grab=null;goal=null;speed=0;node.dataset.grabbed='false';setPose('stand');}
      return;
    }
    if(layer){startBrain();refreshBrain(true);invalidate();resetReels();run();if(!goal&&!menuOpen)plan(900);roll();}
  }
  // THE PONY ON THE FILM CLOCK. Its little loops (the tail, the nod, the blink, breathing, the Zs) are CSS animations.
  // Left to run, each one makes Chrome draw the whole page at the screen's own rate (60 to 240 times a second: on a
  // battery that was most of an idle page's cost) to move a few pixels. Like the drawings (motion.js), they are paused
  // and set to the film's time instead: 24 frames a second while someone uses the page, 12 after, none while the tab is
  // hidden. A loop between two keyframes that say the same thing (a blink's long open stretch) is not written at all.
  // Only endless loops: a short one (a hop, the book appearing) plays as written. Reduced motion has none.
  // An answer's rows: its items, or for a clarifying question that picks nothing (several homeworks match) the choices
  // it offers to tap.
  const engineRows=c=>c?.items?.length?c.items:(Array.isArray(c?.choices)?c.choices.slice(0,3):[]);
  const reels=new Map();let reelsDirty=true,reelStarted=false;
  // The first reel waits until the page has drawn: reading every animation forces a full restyle, which on a slow
  // laptop cost a quarter second of the dashboard's start. The drawing simply plays as written until then.
  const FIRST_REEL_MS=1500;
  // While the art film runs at the reel's rate or faster, the reel's own timer waits half a film tick past the due, so
  // the film's tick nearest the due draws it (onFilm: at most half a tick early) and the page draws one frame for both;
  // the next frame is then due a whole period after that tick, so the reel follows the film's grid evenly. A reel faster
  // than the film (24 on a film on twos) keeps its own timer on time and shares the ticks that fall on its frames. With
  // no film the timer is the clock, on time.
  function scheduleReel(delay){
   const mounted=life,at=filmNow(),slack=delay>0&&filmTick>0&&delay>=filmTick-1&&at-filmAt<filmTick*1.5?filmTick/2:0;
   const id=setTimeout(()=>{if(mounted===life&&reel===id)roll();},delay+slack);reel=id;reel?.unref?.();reelDue=at+delay;reelEvery=delay;
  }
  function resetReels(){
    reelsDirty=true;
    if(custom||reduced()){clearTimeout(reel);reel=0;reels.clear();return;}
    if(node&&!dead&&!doc.hidden&&!reel)scheduleReel(reelStarted?0:FIRST_REEL_MS);
  }
  function restsOf(a){
   try{
    const timing=a.effect?.getTiming?.(),frames=a.effect?.getKeyframes?.();
    if(!timing||!frames||frames.length<2||!(timing.duration>0)||(timing.direction&&timing.direction!=='normal')||timing.iterationStart)return null;
    const skip=k=>k==='offset'||k==='computedOffset'||k==='easing'||k==='composite',list=[];
    const same=(x,y)=>{for(const k of new Set([...Object.keys(x),...Object.keys(y)]))if(!skip(k)&&x[k]!==y[k])return false;return true;};
    for(let i=0;i+1<frames.length;i++){const x=frames[i].computedOffset,y=frames[i+1].computedOffset;if(y>x&&same(frames[i],frames[i+1]))list.push([x,y]);}
    return list.length?{list,delay:timing.delay||0,duration:timing.duration}:null;
   }catch{return null;}
  }
  function roll(){
   clearTimeout(reel);reel=0;if(!node||dead||doc.hidden||menuOpen)return;if(roomBusy()){scheduleReel(1200);return;}
   if(custom||reduced()){reels.clear();reelsDirty=true;return;}
   reelStarted=true;
    // every state is read before any time is written, so Chrome restyles once a frame, not once a loop
    const t=now();
    if(reelsDirty){
     reelsDirty=false;let list=[];try{list=node.getAnimations?.({subtree:true})||[];}catch{reelsDirty=true;}
     const live=new Set();
     for(const a of list){
      if(!a.animationName||a.playState==='idle'||a.playState==='finished'||a.effect?.getTiming?.().iterations!==Infinity)continue;
      live.add(a);if(!reels.has(a)){try{a.pause();}catch{continue;}reels.set(a,{origin:t-(+a.currentTime||0),rests:restsOf(a),rest:-1});}
     }
     for(const a of [...reels.keys()])if(!live.has(a))reels.delete(a);
   }
    // A cancelled loop has no current time. Reading currentTime does not flush style (playState does, once per tick,
    // pulling the banner's restyles in between frames); these paused infinite loops never finish.
    for(const a of reels.keys())if(a.currentTime==null)reels.delete(a);
   for(const [a,r] of reels){
    const time=Math.max(0,t-r.origin);let at=-1;
    if(r.rests){const local=time-r.rests.delay;if(local>=0){const p=(local/r.rests.duration)%1;at=r.rests.list.findIndex(h=>p>=h[0]&&p<h[1]);}}
    if(at<0||at!==r.rest){try{a.currentTime=time;}catch{}}
    r.rest=at;
   }
   // 24 a second while the page is used, 12 after, 6 in the idle rest (a sleeping pony's breathing is slow), and after
   // two minutes without input it holds where it is until the next input (seen()), so an open page costs nothing.
   const quiet=now()-lastInput;if(!reels.size||quiet>=120000)return;
   scheduleReel(1000/(quiet<6000?24:quiet<25000?12:6));
  }
  // THE PONY ON THE ART FILM'S TICKS. While the drawings' film clock runs (motion.js: 24 or 12 a second), a reel or a step
  // that falls due before its next tick is drawn on this one, so the page draws one frame for both instead of two (each
  // frame costs the whole page's layering, hit test and commit). The pony's own timers stay for when no film runs (the
  // idle rest, a hidden tab, Still, Off, reduced motion, nothing living). A reel is drawn at most half a tick early (a
  // 6 a second reel on a 24 a second film never lands a whole tick early), and the pony never draws faster than its own
  // rate: a tick within half a tick of the last one it took is let go.
  function onFilm(t,fps){
   if(dead||!node||doc.hidden||menuOpen||!(fps>0))return;const at=filmNow(),tick=1000/fps;
   if(at-filmAt<tick/2)return;filmAt=at;filmTick=tick;
   if(reel&&at>=reelDue-Math.min(tick,reelEvery)/2)roll();
   // A walk frame drawn on a tick moves the pony's own 24 fps grid to that tick, so the next frame on its own timer comes
   // a whole frame later (not on the old grid, which on a film on twos made pairs 4-16 ms apart and then a 67-79 ms hold).
   if(film&&at>=next-Math.min(tick,FILM)+4){clearTimeout(film);film=0;next=at;frame();}
  }
  function refreshDrawing(){
   const selected=art.identity(personal||pet,getCustomPet()||hydratedPet),value=selected.pack;
   customMotion=selected.motion;
   if(value===custom&&drawingNode===node)return;
   custom=value;
   customSource='';
   rig=null;
   if(custom){
    ch.leg=ch.down=0;ch.neck=9;ch.head=0;
    if(!customImage||drawingNode!==node){
      customImage=doc.createElement('img');
      customImage.className='pet-svg';
      customImage.alt='';
      customImage.draggable=false;
      customImage.decoding='async';
      customImage.setAttribute('aria-hidden','true');
      node.replaceChildren(customImage);
    }
    customImage.width=custom.size[0];customImage.height=custom.size[1];
   }else{customImage=null;node.innerHTML=art.svg({title:companionName()});}
   drawingNode=node;resetReels();
  }
  function drawCustom(){
   if(!customImage||!node)return;const drawing=customDrawing(custom,pose,face,doc.hidden||reduced()),transform=drawing.mirror?'scaleX(-1)':'scaleX(1)';
   if(customSource!==drawing.src){customSource=drawing.src;customImage.src=drawing.src;}
   if(customImage.style.transform!==transform)customImage.style.transform=transform;
  }
  function dress(){
   if(!node)return;refreshDrawing();const c=art.COATS[pet.coat]||art.COATS.oat;
   node.style.setProperty('--pet-coat',c.coat);node.style.setProperty('--pet-shade',c.shade);node.style.setProperty('--pet-mane',c.mane);node.style.setProperty('--pet-muzzle',c.muzzle);
   node.style.setProperty('--pet-harness',art.HARNESS[pet.harness]||art.HARNESS.red);node.style.setProperty('--pet-size',size()+'px');
   node.style.width=custom?size()+'px':'';node.style.height=custom?height()+'px':'';node.style.aspectRatio=custom?`${size()} / ${height()}`:'';
    if(node.dataset.gear!==pet.gear){node.dataset.gear=pet.gear;resetReels();}
    const name=companionName();
    node.setAttribute('aria-label',`${name}, your companion. Open ${name}'s menu`);
    node.querySelector('svg')?.setAttribute('aria-label',name);
    const question=bubble?.querySelector('[data-pet-question]');
    if(question)question.setAttribute('aria-label','Ask '+name);
   if(bubble){
     bubble.setAttribute('aria-label',name);
     for(const label of bubble.querySelectorAll('[data-companion-ask]'))label.textContent='Ask '+name;
     const avatar=bubble.querySelector('[data-companion-art]');
     if(avatar){const markup=companionDrawing();if(avatar._drawing!==markup){avatar._drawing=markup;avatar.innerHTML=markup;}}
   }
    const still=String(reduced());
    if(node.dataset.still!==still){
      node.dataset.still=still;
      resetReels();
      if(still==='true'&&goal&&!goal.drop&&!grab){goal=null;speed=0;ch.leg=0;settle(focusing?'read':nudge(snapshot),30000);}
    }
   drawCustom();if(Number.isFinite(node._x)&&Number.isFinite(node._y))moveTo(node._x,node._y);
  }
  function setPose(value,facing){
    if(!node)return;
    pose=value;
    if(facing)face=facing;
    if(stepping)return;
    let changed=false;
    if(node.dataset.pose!==pose){node.dataset.pose=pose;changed=true;resetReels();}
    if(node.dataset.face!==face){node.dataset.face=face;changed=true;resetReels();}
    if(changed)drawCustom();
  }
  // ---- places to stand: the top edge of every module, inside the paddock, and the bottom of the window
  // A snapshot is measured on external changes and before decisions, never by a movement/easing frame. Keep the same drawn
  // outlines and hit tests; caching the rectangles must not turn words, controls, or unruled modules into ground.
  let sides=new WeakMap();const drawn=color=>!!color&&color!=='transparent'&&!/,\s*0\)$/.test(color);
  // These metadata writes cannot move a ledge. Other ARIA states can change CSS layout (or hit tests).
  const framed=()=>container.dataset.panelFrame!=='none';
  const cosmeticAttributes=new Set(['aria-label','aria-labelledby','aria-describedby','aria-controls','aria-activedescendant','aria-live','aria-atomic','aria-busy','title','tabindex']);
  function clockTick(r){
   const el=r.type==='characterData'?r.target.parentElement:r.target;if(!el?.closest?.('[data-rd-focus-clock]'))return false;
   let before,after;
   if(r.type==='characterData'){before=r.oldValue;after=r.target.textContent;}
   else if(r.type==='childList'){
     const added=[...r.addedNodes],removed=[...r.removedNodes];
     if(!added.length||!removed.length||[...added,...removed].some(n=>n.nodeType!==3))return false;
     before=removed.map(n=>n.textContent).join('');
     after=added.map(n=>n.textContent).join('');
   }
   // The toolbar clock uses tabular digits. Starting/ending a session, visibility and wider times still invalidate.
   return typeof before==='string'&&typeof after==='string'&&before.length===after.length&&/^\d{2,}:\d{2}$/.test(before)&&/^\d{2,}:\d{2}$/.test(after);
  }
  function changesPlaces(r){
   if(layer?.contains(r.target))return false;
   // A drawing's own parts never move a ledge: the art film's and frame loops' inline styles on SVG parts, and anything
   // inside the absolutely placed, pointer-events:none frames (busy() skips the same frames). Outer <svg> roots still count.
   if(r.type==='attributes'&&(r.target.ownerSVGElement||r.target.closest?.('.rd-frame, .chn-frames')))return false;
   if(r.type==='attributes')return !cosmeticAttributes.has(r.attributeName)&&!(r.attributeName==='aria-selected'&&r.target.matches?.('[data-quick-index]'));
   if(r.type==='childList'){const changed=[...r.addedNodes,...r.removedNodes];if(changed.length&&changed.every(n=>n===layer||layer?.contains(n)))return false;}
   return !clockTick(r);
  }
  function measurePlaces(){
   const width=win.innerWidth,height=win.innerHeight,rects=new Map(),places=new Map(),out=[];sides=new WeakMap();
   const rect=el=>{if(!rects.has(el))rects.set(el,el.getBoundingClientRect());return rects.get(el);};
   const floor={el:null,y:height-5,x0:14,x1:width-14,floor:true,shown:true};
   const read=el=>{
    if(!el)return floor;if(places.has(el))return places.get(el);if(!el.isConnected||underRoom(el))return null;
    const r=rect(el),side=sides.get(el);if(r.width<120||!side&&r.height<30){places.set(el,null);return null;}
    const inside=el.dataset.petLedge==='inside',y=inside?r.bottom-9:side==='bottom'?r.bottom:r.top+1;
    const l={el,inside,paddock:inside,y,x0:r.left+(inside?26:18),x1:r.right-(inside?26:18),shown:y>96&&y<height-6&&r.right>60&&r.left<width-60};places.set(el,l);return l;
   };
   const add=el=>{const l=read(el);if(l&&l.shown&&l.x1-l.x0>60)out.push(l);};
   for(const el of container.querySelectorAll('[data-pet-ledge]'))add(el);
   if(framed())for(const el of container.querySelectorAll('.rd-main > [data-arrange-key]'))add(el);
   let found=0;
   for(const el of container.querySelectorAll('.rd-main > [data-arrange-key] :is(section,header,li,details,summary,article,hr,div)')){
    if(found>=40)break;
    const r=rect(el);if(r.width<150||r.top>height-6||r.bottom<96)continue;
    const cs=win.getComputedStyle(el);
    const top=parseFloat(cs.borderTopWidth)>0&&cs.borderTopStyle!=='none'&&drawn(cs.borderTopColor),
      bottom=parseFloat(cs.borderBottomWidth)>0&&cs.borderBottomStyle!=='none'&&drawn(cs.borderBottomColor);
    if(!top&&!bottom)continue;
    sides.set(el,top?'top':'bottom');places.delete(el);add(el);found++;
   }
   out.push(floor);read(spot.ledge);if(goal?.type==='jump')read(goal.target.el);
   geometry={width,height,rects,places,all:out,floor};dirty=false;
   if(resizeWatch){
     const live=new Set([container,...rects.keys(),...(bubble?[bubble]:[])]);
     for(const el of watched)if(!live.has(el)){resizeWatch.unobserve(el);watched.delete(el);}
     for(const el of live)if(!watched.has(el)){resizeWatch.observe(el);watched.add(el);}
   }
   // A finite animation on a measured element or any ancestor (through shadow hosts) can still move a ledge: measure again
   // when it settles. One getAnimations() per tree (the document, the workspace's shadow root), not one per element: each
   // element's own call re-reads and re-sorts its whole tree's list (a third of a second of a dashboard's start). An
   // element's call keeps the animations whose target is that element and not its ::before/::after, so the same filter on
   // the tree's list finds exactly the same animations.
   const checked=new Set(),roots=new Set(),mounted=life;
   for(const el of rects.keys())
     for(let p=el;p&&!checked.has(p);p=p.parentElement||p.getRootNode?.().host){checked.add(p);const root=p.getRootNode?.();if(root)roots.add(root);}
   for(const root of roots)for(const a of root.getAnimations?.()||[]){
    const effect=a.effect;if(effect?.pseudoElement||!checked.has(effect?.target))continue;
    if(a.playState==='idle'||a.playState==='finished'||effect.getTiming?.().iterations===Infinity)continue;
    const done=a.finished;
    if(!done?.then||layoutAnimations.has(done))continue;
    layoutAnimations.add(done);
    const settled=()=>{if(mounted===life)invalidate();};
    done.then(settled,settled);
   }
   measureBubble();
  }
  // A room over the page (dashboard.js: the Review deck's, Grade impact's) hides the page under it: a ledge on that page
  // is no ledge while it is hidden (the companion stands on the floor, as when the room was a page of its own).
  const underRoom=el=>!!el?.closest?.('.rd-shell > .rd-workspace[aria-hidden="true"]');
  function ledgeFor(el){return el?(el.isConnected&&!underRoom(el)?geometry?.places.get(el)||null:null):geometry?.floor||null;}
  function ledges(){if(!geometry)measurePlaces();else if(dirty)invalidate();return geometry.all;}
  function cancelPlaces(){
    decisionPending=false;
    layoutVersion++;
    if(layoutFrame){if(win.requestAnimationFrame)win.cancelAnimationFrame?.(layoutFrame);else clearTimeout(layoutFrame);}
    clearTimeout(layoutTimer);
    clearTimeout(follow);
    layoutFrame=layoutTimer=follow=0;
  }
  // Let the changed click frame paint before reading its layout. Decisions and movement keep using the snapshot.
  // Window resize/scroll and the font set's loadingdone have targets that are not Nodes; only Nodes go to contains().
  // The drawn frames' own stroke loops end and cancel all the time under a moving pointer; they never move a ledge.
  function invalidate(event){
    if(/^(animation|transition)/.test(event?.type||'')&&event.target?.closest?.('.rd-frame, .chn-frames'))return;
    if(!node||dead||(event?.target?.nodeType&&layer?.contains(event.target)))return;
    dirty=true;
    if(menuOpen&&!['scroll','resize'].includes(event?.type))return;
    if(doc.hidden||layoutFrame||layoutTimer)return;
    const version=++layoutVersion,afterFrame=()=>{
      if(version!==layoutVersion||!node||dead||doc.hidden)return;
      layoutFrame=0;
      layoutTimer=setTimeout(()=>{if(version===layoutVersion)refreshPlaces();},0);
    };
    layoutFrame=win.requestAnimationFrame?win.requestAnimationFrame(afterFrame):setTimeout(afterFrame,16);
  }
  // While a room covers the page (the Focus room) or one of the rooms' moves is playing (they stamp data-ch-moving with
  // when it ends), the companion keeps still: its measuring, deciding and reel reading took the frames the move needed.
  // It catches up once the move is over, when the browser is idle.
  // (the Review deck's and Grade impact's full pages count as rooms too: the pony keeps still over them and while they fold)
  const roomBusy=()=>{
    try{
      return !!container.hasAttribute?.('data-ch-room')||Number(container.dataset?.chMoving||0)>Date.now()||!!container.querySelector?.('.gi-room:not([data-gi-away]), [data-review-deck]');
    }catch{return false;}
  };
  let placesLater=0;
  function refreshLater(){
    if(placesLater||dead)return;
    placesLater=setTimeout(()=>{
      const run=()=>{placesLater=0;if(!dead)refreshPlaces();};
      if(win.requestIdleCallback)win.requestIdleCallback(run,{timeout:1000});else run();
    },450);
    placesLater?.unref?.();
  }
  function refreshPlaces(){
    clearTimeout(layoutTimer);
    layoutTimer=0;
    if(!node||dead||doc.hidden)return;
    if(roomBusy()){if(spot.ledge&&underRoom(spot.ledge)&&!grab&&!goal)place();refreshLater();return;}
    measurePlaces();
    if(menuOpen){place();placeBubble();return;}
    if(decisionPending){decisionPending=false;decide(true);}
    if(!grab&&!goal&&Number.isFinite(node._x)&&Number.isFinite(node._y)){const here=current();if(!free(here,spot.u))moveOff(here);}
    place();
    if(bubble)placeBubble();
  }
  function scheduleFollow(){
    if(!node||dead||doc.hidden||menuOpen||follow)return;
    const mounted=life,id=setTimeout(()=>{if(mounted!==life||follow!==id)return;follow=0;followPlace();},500);
    follow=id;
  }
  function followPlace(){
    if(!node||grab||doc.hidden||layoutFrame||layoutTimer)return;if(!resizeWatch||!layoutWatch){invalidate();return;}if(film||!spot.ledge)return;
   const r=spot.ledge.getBoundingClientRect(),old=geometry?.rects.get(spot.ledge);if(!spot.ledge.isConnected||!old||['left','top','right','bottom'].some(k=>r[k]!==old[k]))invalidate();
  }
  // A SPOT IS FREE when nothing the student reads or uses is under the pony's body there: no words, no button, link or
  const current=()=>ledgeFor(spot.ledge)||ledgeFor(null);
  // field, no drawing. (It stood on top of an assignment's title, in the user's screenshot, 2026-10-15.) Asked only when
  // it chooses where to go, a handful of points under its outline, never on a frame.
  const USED='a,button,input,select,textarea,summary,label,[role=button],[role=link],[role=tab],svg,img,canvas,video';
  function busy(x,y){
   const at=(container.getRootNode?.()||doc).elementsFromPoint?.(x,y)||doc.elementsFromPoint?.(x,y)||[];
   let looked=0;
   for(const el of at){
    // the pony stands on the drawn outlines round modules and cards: those are its ground, not something it covers
    if(layer?.contains(el)||el.closest?.('.rd-frame, .chn-frames'))continue;if(++looked>4)break;
    if(el.matches?.(USED)||el.closest?.('svg'))return true;
    for(const n of el.childNodes||[]){
     if(n.nodeType!==3||!n.textContent.trim())continue;
     const range=doc.createRange?.();if(!range)return true;range.selectNodeContents(n);
     for(const b of range.getClientRects())if(x>=b.left-3&&x<=b.right+3&&y>=b.top-3&&y<=b.bottom+3)return true;
    }
   }
   return false;
  }
  function free(l,u){
   if(!l)return false;const s=size(),h=height(),x=l.x0+u;
   if(x-s*.4<4||x+s*.4>win.innerWidth-4)return false;
   for(const dx of [-.34,0,.34])for(const dy of [.22,.55,.85])if(busy(x+dx*s,custom?l.y-ground()+(1-dy)*h:l.y-dy*h))return false;
   return true;
  }
  // A free place on this ledge, as near to `near` as it can be (or anywhere on it); null if there is none.
  function freeOn(l,near){
   if(!l)return null;const span=l.x1-l.x0;if(span<70)return null;
   const tries=[];for(let i=0;i<9;i++)tries.push(clamp(14+Math.random()*(span-28),14,span-14));
   if(Number.isFinite(near))tries.sort((a,b)=>Math.abs(a-near)-Math.abs(b-near));
   return tries.find(u=>free(l,u))??null;
  }
  function home(){
   const all=ledges(),paddock=all.find(l=>l.paddock),target=pet.roam==='home'?(paddock||all[all.length-1]):(all.find(l=>!l.floor&&!l.paddock)||all[all.length-1]);
   spot={ledge:target.el,u:clamp((target.x1-target.x0)*(.25+Math.random()*.5),20,Math.max(20,target.x1-target.x0-20))};
  }
  function moveForRoam(before){
   if(!node||before===pet.roam||!['page','home'].includes(pet.roam))return false;
   releaseGrab?.();if(grab){grab=null;node.dataset.grabbed='false';}
   stop();cancelPlaces();clearTimeout(node._cheer);goal=null;speed=0;ch.leg=0;
   measurePlaces();home();place();rest=focusing?'read':'stand';setPose(rest);paint();if(bubble)placeBubble();
   if(!menuOpen){run();plan(1400);}return true;
  }
  // The pony stays on the thing it stands on, wherever that scrolls to.
  function place(){
   if(!node||grab||goal?.type==='jump')return;
   let l=ledgeFor(spot.ledge);
   if(!l){l=ledgeFor(null);spot={ledge:null,u:clamp(spot.u,20,l.x1-l.x0-20)};}
   spot.u=clamp(spot.u,6,Math.max(6,l.x1-l.x0-6));
   moveTo(l.x0+spot.u,l.y);
  }
  function moveTo(x,y){
    if(!node)return;
    node._x=x;
    node._y=y;
    if(stepping)return;
    const s=size(),value=`translate(${(x-s/2).toFixed(1)}px,${(y-ground()).toFixed(1)}px)`;
    if(node.style.transform!==value)node.style.transform=value;
    if(bubble&&!menuOpen)placeBubble();
  }
  // The pose is written onto the few parts that move, and only when a value changed. (Setting the numbers as
  // variables on the pony instead would restyle every shape of the drawing on every frame.)
  let rig=null;
  function parts(){
   if(rig&&rig.of===node)return rig;
   const q=sel=>node.querySelector(sel),all=sel=>[...node.querySelectorAll(sel)];
   return rig={
     of:node,
     up:q('.pet-up'),
     neck:q('.pet-neck'),
     head:q('.pet-head'),
     a:all('.pet-leg.lf,.pet-leg.lh2'),
     b:all('.pet-leg.lh,.pet-leg.lf2'),
     legs:all('.pet-legs'),
     tuck:all('.pet-tuck,.pet-tuck2'),
     shadow:q('.pet-shadow'),
     last:new Map()
   };
  }
  function put(el,prop,value){if(!el)return;const seen=rig.last.get(el)||rig.last.set(el,{}).get(el);if(seen[prop]!==value){seen[prop]=value;el.style[prop]=value;}}
  function paint(){
   if(!node)return;
   if(custom){const opacity=ch.alpha<.995?ch.alpha.toFixed(2):'';if(node.style.opacity!==opacity)node.style.opacity=opacity;return;}
   const p=parts(),leg=Math.sin(phase)*ch.leg,down=ch.down,bob=-Math.abs(Math.sin(phase))*ch.leg*.055;
   // in the air, held, or cheering, the stylesheet poses the legs and shadow itself
   const neck=ch.neck+(pose==='eat'?Math.sin(phase*2.4)*2.5:leg*.12),fold=(1-down/14.6).toFixed(3);
   const free=pose==='fall'||pose==='held'||pose==='cheer';
   put(p.up,'transform',`translateY(${(down+bob).toFixed(2)}px)`);
   put(p.neck,'transform',`rotate(${neck.toFixed(2)}deg)`);put(p.head,'transform',`rotate(${ch.head.toFixed(2)}deg)`);
   for(const el of p.a)put(el,'transform',free?'':`rotate(${leg.toFixed(2)}deg) scaleY(${fold})`);
   for(const el of p.b)put(el,'transform',free?'':`rotate(${(-leg).toFixed(2)}deg) scaleY(${fold})`);
   const standing=clamp((10-down)/2.5,0,1).toFixed(2),lyingDown=clamp((down-7)/3.5,0,1).toFixed(2);
   for(const el of p.legs)put(el,'opacity',standing);for(const el of p.tuck)put(el,'opacity',lyingDown);
   put(p.shadow,'transform',free?'':`scaleX(${(1+down/60).toFixed(3)})`);
   put(node,'opacity',ch.alpha<.995?ch.alpha.toFixed(2):'');
    const lying=String(down>5.5);if(node.dataset.lying!==lying){node.dataset.lying=lying;resetReels();}
  }
  // ---- deciding
  function stop(){clearTimeout(film);clearTimeout(timer);film=0;timer=0;debt=0;}
  function run(){if(!stepping&&!film&&node&&!dead&&!doc.hidden&&!menuOpen){last=filmNow();next=last+FILM;debt=0;film=setTimeout(frame,FILM);}}
  function plan(delay){clearTimeout(timer);timer=setTimeout(decide,delay);}
  function settle(as,ms){goal=null;rest=as;setPose(as);run();plan(ms);}
  function decide(measured=false){
   timer=0;if(!node||dead)return;
   if(doc.hidden)return;if(roomBusy()){plan(1500);return;}
   if(menuOpen||grab||goal){plan(2500);return;}
    if(dirty){decisionPending=true;invalidate();return;}if(!measured)measurePlaces();const data=Brain()?snapshot:info(),idle=now()-lastInput,here=current();
   if(focusing){settle('read',20000);return;}
   if(reduced()){settle(nudge(data),30000);return;}
   // its place has scrolled away or gone: come back to somewhere in view, quietly
   const gone=here.el&&!framed()&&!sides.has(here.el)&&here.el.matches?.('.rd-main > [data-arrange-key]');
   if(!here.shown||gone||!here.el&&pet.roam==='home'){
    const all=ledges(),to=pet.roam==='home'?all.find(l=>l.paddock):all.filter(l=>!l.paddock&&!l.floor)[0]||all[all.length-1];
    if(to&&(to.el!==here.el)){if(here.shown)jumpTo(to);else appear(to);return;}
   }
   // the same idle rest as the drawings (motion.js)
   if(idle>25000){settle('sleep',30000);return;}
   // standing on something the student reads or uses (a list refreshed under it): step off it first
   if(!free(here,spot.u)){moveOff(here);return;}
   // while someone is scrolling or typing, it keeps still: a walk then only draws the eye
   if(idle<2500){settle(rest==='lie'?'lie':nudge(data),4000+Math.random()*4000);return;}
   // Calmer than it was (walks were 40% of choices): mostly resting, a short walk now and then.
   const roll=Math.random();
   if(roll<.2)walk();
   else if(roll<.25&&pet.roam==='page'){
     const near=ledges().filter(l=>l.el!==here.el&&!l.paddock&&Math.abs(l.y-here.y)<360&&l.x0<node._x+420&&l.x1>node._x-420);
     const to=near[Math.floor(Math.random()*near.length)];
     if(to)jumpTo(to);else walk();
   }
   else if(roll<.7)settle(Brain()&&(thought.mood==='alert'||thought.mood==='sleepy')?nudge(data):'lie',14000+Math.random()*18000);
   else settle(nudge(data),8000+Math.random()*10000);
  }
  // A due item is carried as a small flag, not announced, unless reminders are fully on.
  function nudge(data){
    return Brain()?({alert:pet.nudges==='off'?'stand':'flag',sleepy:'sleep',happy:'cheer',calm:'stand'}[thought.mood]||'stand'):pet.nudges!=='off'&&data.next?.urgent&&now()>quietUntil?'flag':'stand';
  }
  // Off whatever it is standing on: the nearest free place on this ledge, else a free place on another one in view.
  function moveOff(here){
   const u=freeOn(here,spot.u);if(u!=null){if(reduced()){spot.u=u;return;}goal={type:'walk',to:u,max:26};rest='stand';run();return;}
   for(const other of ledges())if(other.el!==here.el){const to=freeOn(other);if(to!=null){jumpTo(other,to);return;}}settle('stand',6000);
  }
  function walk(){
   const l=current(),span=l.x1-l.x0;if(span<70){settle('stand',4000);return;}
   const to=freeOn(l);if(to==null){settle('stand',6000);return;}
   if(Math.abs(to-spot.u)<36){settle('stand',3500);return;}
   goal={type:'walk',to,max:Math.abs(to-spot.u)>420?58:26};rest='stand';run();
  }
  function jumpTo(target,u=target?freeOn(target):null){
   if(!target){settle('stand',3000);return;}
   if(u==null){settle('stand',6000);return;}
   place();goal={type:'jump',target,u,t:-.16,from:null};rest='stand';run();
  }
  function appear(target){
   spot={ledge:target.el,u:freeOn(target)??clamp((target.x1-target.x0)*(.2+Math.random()*.6),14,Math.max(14,target.x1-target.x0-14))};
   ch.alpha=0;ch.down=0;speed=0;goal=null;rest='stand';setPose('stand');place();run();plan(3500);
  }
  const ease=(key,to,rate,dt)=>{const d=to-ch[key];if(Math.abs(d)<.02){ch[key]=to;return false;}ch[key]+=d*Math.min(1,rate*dt);return true;};
  function frame(){
   // Retain the 60 Hz integrator in memory, including acceleration, braking and easing, but commit only one drawing
   film=0;if(!node||dead||doc.hidden||menuOpen)return;const t=filmNow();debt+=Math.max(0,(t-last)/1000);last=t;let busy=!!goal;
   // per film tick. Elapsed time survives a late callback; missed drawings are skipped, never replayed in a burst.
   stepping=true;try{while(debt+1e-9>=STEP){busy=step(STEP);debt=Math.max(0,debt-STEP);if(!busy){debt=0;break;}}}finally{stepping=false;}
   setPose(pose,face);if(!grab&&goal?.type!=='jump')place();else if(!grab)moveTo(node._x,node._y);paint();
   if(busy){next+=FILM;if(next<=t)next+=Math.floor((t-next)/FILM+1)*FILM;film=setTimeout(frame,Math.max(1,next-filmNow()));}
  }
  function step(dt){
   let busy=false;
   const want=POSE[goal?'stand':rest]||POSE.stand;
   if(goal?.type==='walk'){
    // get up first
    if(ch.down>.6){busy=true;}
    else{
     const dist=goal.to-spot.u,dir=dist>=0?1:-1,brake=Math.sqrt(2*90*Math.abs(dist))+2,target=Math.min(goal.max,brake);
     // turning: slow to a stop before setting off the other way
     if(Math.sign(speed)!==dir&&Math.abs(speed)>4)speed+=dir*220*dt;
     else speed=dir*Math.min(target,Math.abs(speed)+70*dt);
     const trot=Math.abs(speed)>40;
     // the legs turn over as fast as the ground passes under them, so the feet do not slide
     if(Math.abs(speed)>3)setPose(trot?'trot':'walk',speed>0?'right':'left');
     spot.u+=speed*dt;phase+=Math.abs(speed)*dt*(trot?15.5:21.9)/size();
     if(Math.abs(dist)<1.2||dir*(goal.to-spot.u)<=0){
       spot.u=goal.to;
       speed=0;
       goal=null;
       setPose('stand');
       const here=current();
       if(!free(here,spot.u))moveOff(here);
       if(!goal)plan(1800+Math.random()*3200);
     }
     busy=true;
    }
   }else if(goal?.type==='jump'){
    const g=goal;
    if(ch.down>.6&&g.t<0&&!g.from){ease('down',0,7,dt);busy=true;}
    else{
     if(!g.from){
       g.from={x:node._x,y:node._y};
       const l0=ledgeFor(g.target.el)||g.target;
       g.dur=clamp(Math.hypot(l0.x0+g.u-g.from.x,l0.y-g.from.y)/520,.42,.85);
       setPose('stand',l0.x0+g.u>g.from.x?'right':'left');
     }
     g.t+=dt/(g.t<0?1:g.dur);
     const l=ledgeFor(g.target.el)||g.target,end={x:l.x0+g.u,y:l.y};
     // a short crouch before it goes
     if(g.t<0){ch.down=3.2*(1-Math.abs(g.t)/.16);}
     else{
      const p=clamp(g.t,0,1),e=g.drop?p*p:p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2,lift=g.drop?0:clamp(Math.abs(end.x-g.from.x)*.22+Math.max(0,g.from.y-end.y)*.25+26,30,90);
      if(pose!=='fall')setPose('fall');ch.down=0;
      moveTo(g.from.x+(end.x-g.from.x)*e,g.from.y+(end.y-g.from.y)*e-lift*Math.sin(Math.PI*p));
      if(p>=1){spot={ledge:l.el,u:g.u};goal=null;ch.down=3.4;setPose('stand');const here=current();if(!free(here,spot.u))moveOff(here);place();if(!goal)plan(2600+Math.random()*2500);}
     }
     busy=true;
    }
   }
   if(custom)ch.down=0;
   else{
    if(!goal||goal.type==='walk'){
     if(ease('leg',goal&&ch.down<=.6?clamp(Math.abs(speed)/26,0,1)*(Math.abs(speed)>40?27:21):0,9,dt))busy=true;
     if(ease('down',want.down,goal?7:4.2,dt))busy=true;
    }
    if(ease('neck',goal?.type==='walk'&&ch.down<=.6?9:want.neck,5,dt))busy=true;
    if(ease('head',want.head,5,dt))busy=true;
    if(pose==='eat'){phase+=dt*4;busy=true;}
   }
   if(ease('alpha',1,3.2,dt))busy=true;
   return busy;
  }
  // ---- picking it up
  function down(event){
   if(!node||dead||doc.hidden||event.button!==undefined&&event.button!==0)return;releaseGrab?.();const held=node;
   // held from the first press, so a quick pull cannot slip off
   const start={x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};try{node.setPointerCapture?.(start.id);}catch{}
   const move=e=>{
    if(node!==held||dead||doc.hidden||e.pointerId!==start.id)return;
    if(!start.moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<7)return;
    if(!start.moved){
      start.moved=true;
      grab=start;
      stop();
      goal=null;
      speed=0;
      ch.leg=0;
      ch.down=0;
      paint();
      closeBubble();
      setPose('held');
      try{node.setPointerCapture?.(start.id);}catch{}
      node.dataset.grabbed='true';
    }
    moveTo(e.clientX,e.clientY+(custom?ground()-height()/2:size()*.42));
   };
   const up=e=>{
    if(e.pointerId!==start.id)return;
    release();if(node!==held||dead||doc.hidden||!start.moved)return;
    // set down on the nearest place at or below the feet
    node.dataset.grabbed='false';node._suppress=now()+350;grab=null;
    const x=node._x,y=node._y,under=ledges().filter(l=>x>=l.x0-10&&x<=l.x1+10&&l.y>=y-14).sort((a,b)=>a.y-b.y)[0]||ledgeFor(null);
    goal={type:'jump',target:under,u:clamp(x-under.x0,10,Math.max(10,under.x1-under.x0-10)),t:0,drop:true,from:{x,y},dur:clamp(Math.sqrt(Math.max(0,under.y-y))/38,.14,.6)};
    rest='stand';
    setPose('fall');
    run();
   };
   const release=()=>{
     held.removeEventListener('pointermove',move);
     held.removeEventListener('pointerup',up);
     held.removeEventListener('pointercancel',up);
     try{held.releasePointerCapture?.(start.id);}catch{}
     if(releaseGrab===release)releaseGrab=null;
   };
   releaseGrab=release;
   held.addEventListener('pointermove',move);held.addEventListener('pointerup',up);held.addEventListener('pointercancel',up);
  }
  function click(event){
    if(node._suppress&&now()<node._suppress){event.preventDefault();return;}
    if(nudgeOpen){snooze();return;}
    if(menuOpen)closeBubble();else openMenu();
  }
  function ask(){
    if(dead||!node)return false;
    if(nudgeOpen)closeBubble();
    if(node.dataset.pose==='sleep')setPose('stand');
    if(!menuOpen)openMenu();
    const input=bubble?.querySelector('[data-pet-question]');
    input?.focus();
    return !!input;
  }
  function key(event){if(event.key==='Escape'&&menuOpen){event.preventDefault();closeBubble();node.focus();}}
  // ---- what it says
  function measureBubble(){if(bubble)bubbleBox={w:bubble.offsetWidth||250,h:bubble.offsetHeight||120};}
  function placeBubble(){
   if(!bubble||!node)return;const vw=geometry?.width||win.innerWidth,w=bubbleBox.w,h=bubbleBox.h,s=size();
   const x=clamp(node._x-w/2,10,vw-w-10),above=node._y-(custom?ground():s)-h-6;
   bubble.style.transform=`translate(${x.toFixed(0)}px,${(above>70?above:node._y+(custom?height()-ground():0)+10).toFixed(0)}px)`;
   bubble.style.setProperty('--pet-tail-x',clamp(node._x-x,22,w-22).toFixed(0)+'px');bubble.dataset.below=String(above<=70);
  }
   function closeBubble(){
     bubbleVersion++;
     clearTimeout(sayTimer);
     clearTimeout(previewTimer);
     previewTimer=0;
     const ignored=exposed;
     exposed=[];
     nudgeOpen=false;
     scheduled=null;
     askChoices=[];
     askSelected=0;
     askText='';
     if(bubble){
       bubble.removeEventListener('click',onBubble);
       bubble.removeEventListener('submit',submitAsk);
       bubble.removeEventListener('keydown',askKey);
       bubble.removeEventListener('input',previewAsk);
       resizeWatch?.unobserve(bubble);
       watched.delete(bubble);
       bubble.remove();
       bubble=null;
     }
     if(menuOpen){menuOpen=false;node?.setAttribute('aria-expanded','false');dress();invalidate();run();plan(1500);}
     learn(ignored.map(s=>[s.kind,'ignored']));
   }
  function show(html,{menu=false,ms=0}={}){
   closeBubble();if(!layer)return;
   bubble=doc.createElement('div');bubble.className='pet-bubble';bubble.innerHTML=html;
   bubble.setAttribute('aria-label',companionName());
   if(menu){
     bubble.setAttribute('role','dialog');
     menuOpen=true;
     node.setAttribute('aria-expanded','true');
     goal=null;
     speed=0;
     stop();
     cancelPlaces();
     clearTimeout(node._cheer);
     clearTimeout(reel);
     reel=0;
     dress();
   }
   else{bubble.setAttribute('role','status');bubble.setAttribute('aria-live','polite');}
   layer.append(bubble);measureBubble();if(resizeWatch){resizeWatch.observe(bubble);watched.add(bubble);}placeBubble();
   bubble.addEventListener('click',onBubble);
    bubble.addEventListener('submit',submitAsk);bubble.addEventListener('keydown',askKey);bubble.addEventListener('input',previewAsk);
   if(ms)sayTimer=setTimeout(()=>{if(bubble&&!menuOpen)closeBubble();},ms);
  }
  function say(text,ms=5200){if(now()>=quietUntil&&visible()&&layer)show(`<p class="pet-say">${E(text)}</p>`,{ms});}
  function learn(events){
    const B=Brain();
    if(!B||!events.length)return;
    let learning=B.cleanLearning(pet.brain);
    for(const [kind,event]of events)learning=B.record(learning,kind,event);
    save({...pet,brain:learning},current=>{
      let next=B.cleanLearning(current.brain);
      for(const [kind,event]of events)next=B.record(next,kind,event);
      return {...current,brain:next};
    });
  }
  function expose(list,shown=true){exposed=list.slice(0,3);if(shown){if(exposed.some(s=>s.kind==='stretch'))activeUse.shown(now());learn(exposed.map(s=>[s.kind,'shown']));}}
  function suggestionItems(list,menu=true){
    return list.slice(0,menu?2:3).map(s=>`<button type="button" role="button" class="pet-item biscuit-suggestion" data-pet-action="suggestion" data-pet-suggestion="${E(s.id)}">${E(s.label)}</button>`).join('');
  }
   function refreshBrain(force=false){
     const B=Brain(),data=info();
     snapshot={
       ...data,
       biscuitMoreRules:moreRules(data),
       ...(catalogueRows?{catalogue:catalogueRows}:{}),
       ...(personal?{settings:personal.settings}:{}),
       companion:{name:companionName()},
       now:now(),
       pet:{name:companionName(),knowledge:pet.knowledge,treats:pet.treats,roam:pet.roam,nudges:pet.nudges},
       skills:pet.skills,
       activity:activeUse.snapshot(now()),
       focus:{...data.focus,running:focusing||!!data.focus?.running}
     };
     if(!B)return;
     const kinds=Object.entries(pet.brain?.kinds||{}).map(([k,v])=>[k,v.used,v.streak]),
       key=JSON.stringify({...snapshot,now:0,kinds,activity:{...snapshot.activity,active:Math.floor(snapshot.activity.active/60000)}});
     if(!force&&key===thoughtKey&&now()-thoughtAt<60000)return;
     thoughtKey=key;
     thoughtAt=now();
     thoughtVersion++;
     const before=thought.mood;
     thought=B.evaluate(snapshot,pet.brain);
     if(before!==thought.mood&&layer&&!focusing&&!grab&&!goal&&!menuOpen)plan(400);
   }
  function manners(){return {typing:composing||now()<typingUntil,dragging:dragging||!!grab,hidden:now()<quietUntil||doc.hidden||!visible()||menuOpen||!!bubble};}
  function maybeNudge(){
    if(engine){maybeEngineOffer();return;}
    const B=Brain(),top=thought.suggestions[0];
    if(!B||!top||claiming||pet.nudges!=='helpful')return;
    const state=manners(),
      ledger=pet.brain?.nudges,
      key=JSON.stringify([
        thoughtVersion,
        Math.floor(now()/60000),
        focusing,
        pet.brain?.hiddenUntil,
        ledger?.day,
        ledger?.count,
        ledger?.items?.length,
        ledger?.items?.at(-1),
        state
      ]);
    if(key===nudgeCheck)return;
    nudgeCheck=key;
    if(!B.canNudge(top,{...snapshot,now:now(),focus:{...snapshot.focus,running:focusing||!!snapshot.focus?.running}},pet.brain,state))return;
    const display=learning=>{
      if(!learning||dead)return;
      pet=clean({...pet,brain:learning});
      if(manners().typing||manners().dragging||manners().hidden||focusing)return;
      show(`<button type="button" class="pet-item" data-pet-action="quiet">${E(B.speech(top,{...snapshot,now:now()}))}</button>`,{ms:11000});
      nudgeOpen=true;
      expose([top]);
    };
    if(claimNudge){claiming=true;Promise.resolve(claimNudge(top,snapshot,state)).then(display).catch(()=>{}).finally(()=>{claiming=false;});}
    else{const learning=B.markNudge(pet.brain,top,snapshot);save({...pet,brain:learning});display(learning);}
  }
  function scheduleReturn(){
    clearTimeout(hideTimer);
    hideTimer=0;
    if(!dead&&pet.enabled&&pet.roam!=='off'&&pet.brain?.hiddenUntil>now())hideTimer=setTimeout(()=>{hideTimer=0;sync();},Math.min(2147483647,pet.brain.hiddenUntil-now()));
  }
  function snooze(minutes=60){
    closeBubble();
    const B=Brain();
    if(!B)return;
    const until=now()+Math.max(1,Math.min(1440,Number(minutes)||60))*60000;
    save({...pet,brain:{...B.cleanLearning(pet.brain),hiddenUntil:until}},current=>({...current,brain:{...B.cleanLearning(current.brain),hiddenUntil:until}}));
    unmount();
    scheduleReturn();
  }
   function offerBreak(){
     if(engine)return;
     if(pet.nudges!=='helpful'||pet.brain?.kinds?.break?.streak>=3)return;
     const hour=Ask()?Math.floor(Ask().calendar(snapshot.timeZone)(now()).minute/60):new Date(now()).getHours();
     if(pet.skills.night!==false&&(hour>=22||hour<7))return;
     if(!pendingBreak||!layer||focusing||manners().typing||manners().dragging||manners().hidden)return;
     const list=thought.suggestions.filter(s=>s.kind==='break');
     if(!list.length)return;
     pendingBreak=false;
     show(`<div class="pet-items">${suggestionItems(list,false)}</div>`,{ms:11000});
     expose(list);
   }
   function offerStretch(){
     if(engine)return;
     const state=manners(),stretch=thought.suggestions.find(s=>s.kind==='stretch');
     if(!layer||focusing||state.typing||state.dragging||state.hidden||pet.nudges!=='helpful'||pet.brain?.kinds?.stretch?.streak>=3||!stretch)return;
     show(`<div class="pet-items">${suggestionItems([stretch],false)}</div>`,{ms:11000});
     expose([stretch]);
   }
   function checkSchedule(){
     const A=Ask();
     if(!A||scheduleClaiming||!layer)return;
     const snap={...snapshot,now:now(),focus:{...snapshot.focus,running:focusing||!!snapshot.focus?.running}},
       state={...manners(),seen:[...offered]},
       offer=A.due(pet,snap,state);
     if(!offer||offered.has(JSON.stringify([offer.type,offer.id,offer.occurrence])))return;
     const display=claimed=>{
       if(!claimed||dead)return;
       pet=clean(claimed);
       if(manners().typing||manners().dragging||manners().hidden||focusing)return;
       offered.add(JSON.stringify([offer.type,offer.id,offer.occurrence]));
       if(offered.size>64)offered.delete(offered.values().next().value);
       const reminder=offer.action==='remind';
       show(`<p class="pet-say">${E(reminder?offer.data.text:offer.label)}</p><div class="pet-items"><button type="button" class="pet-item" data-pet-action="schedule-use">${reminder?'Done':E({focus:'Focus '+offer.data.minutes+' min',break:'Break '+offer.data.minutes+' min',plan:'Plan '+(offer.data.mode==='week'?'my week':offer.data.mode)}[offer.action])}</button><button type="button" class="pet-item" data-pet-action="schedule-later">${offer.type==='reminder'?'Later 10 min':'Skip'}</button></div>`);
       scheduled=offer;
     };
     if(claimOffer){scheduleClaiming=true;Promise.resolve(claimOffer(offer,snap,state)).then(display).catch(()=>{}).finally(()=>{scheduleClaiming=false;});}
     else{const next=A.markOffer(pet,offer,snap);save(next);display(next);}
   }
   function maybeEngineOffer(){
     if(claiming||scheduleClaiming||!layer||pet.nudges!=='helpful')return;
     const state=manners(),
       offer=engine.offer(offerSnapshot(),state,{
         ...snapshot.offerHistory,
         ...engineMemory,
         lastOffer:Math.max(engineMemory.lastOffer||0,snapshot.offerHistory?.lastOffer||0),
         brain:pet.brain
       });
     if(!offer||offer.kind==='reminder'||pet.brain?.nudges?.items?.includes('biscuit:'+offer.id))return;
     const display=claimed=>{
       if(!claimed||dead)return;
       pet=clean(claimed);
       engineMemory.lastOffer=now();
       if(manners().typing||manners().dragging||manners().hidden||focusing)return;
       show(`<div class="pet-items">${suggestionItems([offer],false)}</div>`,{ms:11000});
       expose([offer]);
     };
     if(claimEngineOffer){claiming=true;Promise.resolve(claimEngineOffer(offer,snapshot,state)).then(display).catch(()=>{}).finally(()=>{claiming=false;});}
     else{
       const brain=Brain()?.cleanLearning(pet.brain)||pet.brain;
       if(brain){
         brain.nudges||={day:'',count:0,items:[]};
         const day=Ask()?.calendar(snapshot.timeZone)(now()).day;
         if(brain.nudges.day!==day){brain.nudges.day=day;brain.nudges.count=0;}
         brain.nudges.count++;
         brain.nudges.items.push('biscuit:'+offer.id);
         void save({...pet,brain});
       }
       display({...pet,brain});
     }
   }
   function enginePreview(input){
     clearTimeout(previewTimer);
     previewTimer=0;
     if(!input||dead)return;
     refreshBrain();
     askText=input.value.trim();
     const world={...snapshot,now:now()};
     engineCard=(askText&&root.ReserveBiscuitControls?.featureControl?.(askText,world))||engine.evaluate(askText,world,engineSession);
     askChoices=askText?[{intent:engineCard.next.action,fields:engineCard.next.fields,preview:engineCard.message,engine:engineCard,line:askText}]:[];
     askSelected=0;
     updatePreview();
     const rows=bubble?.querySelector('[data-biscuit-rows]');
     if(rows){
       rows.innerHTML=engineRows(engineCard).map((v,i)=>`<button type="button" class="pet-item biscuit-row" data-pet-action="engine-row" data-pet-choice="${i}">${E(v.title)}${v.subtitle?`<small>${E(v.subtitle)}</small>`:''}</button>`).join('')+(engineCard.ai?`<button type="button" class="pet-item" data-pet-action="engine-ai">Ask AI</button>`:'');
       rows.hidden=!askText;
     }
   }
   function companionDrawing(){
     const markup=art.drawing(personal||pet,custom);
     return markup.startsWith('<svg ')?`<img class="pet-svg" src="${E('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup.replace(/class="[^"]*"/g,'').replace(/^<svg (?![^>]*xmlns=)/,'<svg xmlns="http://www.w3.org/2000/svg" ')))}" alt="" draggable="false">`:markup;
   }
   function askForm(value=''){const label='Ask '+companionName();return `<form class="biscuit-ask" data-pet-ask><label class="rd-field"><span style="display:flex;align-items:center;gap:8px"><span class="biscuit-ask-art" data-companion-art aria-hidden="true">${companionDrawing()}</span><span data-companion-ask>${E(label)}</span></span><input type="text" maxlength="240" data-pet-question aria-label="${E(label)}" value="${E(value)}" autocomplete="off" aria-controls="biscuit-preview"></label></form>`;}
   function updatePreview(){
     const line=bubble?.querySelector('[data-pet-preview]'),choice=askChoices[askSelected];
     if(line){
       const message=choice?.preview||'',value=choice?.engine?.answer?.value;
       if(value&&message.includes(value))
         line.innerHTML=E(message.slice(0,message.indexOf(value)))+'<strong>'+E(value)+'</strong>'+E(message.slice(message.indexOf(value)+value.length));
       else line.textContent=message;
       line.hidden=!choice;
       line.style.display=choice?'':'none';
       line.dataset.petChoice=String(askSelected);
     }
     const items=bubble?.querySelector('[data-pet-suggestions]');
     if(items){items.hidden=!!askChoices.length;items.style.display=askChoices.length?'none':'';}
   }
   function previewAsk(event){
     const input=event?.composedPath?.()[0]||event?.target;
     if(engine&&input?.hasAttribute?.('data-pet-question')){
       if(event?.flush)enginePreview(input);else{clearTimeout(previewTimer);previewTimer=setTimeout(()=>enginePreview(input),25);}
       return;
     }
     if(!input?.hasAttribute?.('data-pet-question')||!Parse())return;
     refreshBrain();
     const text=input.value.trim();
     if(catalogueLoad){
       askText=text;
       askChoices=[];
       askSelected=0;
       updatePreview();
       const line=bubble?.querySelector('[data-pet-preview]');
       if(line&&text){line.textContent='Loading installed choices\u2026';line.hidden=false;line.style.display='';}
       return;
     }
     const routine=/^every\s/i.test(text)&&Ask()?.parse(text,{...snapshot,now:now()});
     askText=text;
     askChoices=routine?.action==='routine'?[{intent:'routine',fields:routine.data,preview:routine.label}]:text?Parse().parse(text,{...snapshot,now:now()}):[];
     askSelected=0;
     updatePreview();
   }
   function askKey(event){
     if(!menuOpen||event.isComposing)return;
     const target=event.composedPath?.()[0]||event.target;
     if(event.key==='Escape'){event.preventDefault();event.stopPropagation?.();closeBubble();node?.focus({preventScroll:true});return;}
     const isInput=target?.hasAttribute?.('data-pet-question');
     if(!isInput){
       if(['ArrowDown','ArrowUp'].includes(event.key)){
         const buttons=[...bubble.querySelectorAll('[data-pet-suggestion]')].filter(b=>!b.disabled),index=buttons.indexOf(target),next=index+(event.key==='ArrowUp'?-1:1);
         if(index>=0){event.preventDefault();event.stopPropagation?.();(buttons[next]||bubble.querySelector('[data-pet-question]'))?.focus({preventScroll:true});}
       }
       return;
     }
     if(['ArrowDown','ArrowUp','Tab'].includes(event.key)){
       if(askChoices.length){
         event.preventDefault();
         event.stopPropagation?.();
         askSelected=(askSelected+(event.key==='ArrowUp'||event.key==='Tab'&&event.shiftKey?-1:1)+askChoices.length)%askChoices.length;
         updatePreview();
       }
       else if(event.key!=='Tab'){
         const buttons=[...bubble.querySelectorAll('[data-pet-suggestion]')].filter(b=>!b.disabled);
         if(buttons.length){event.preventDefault();event.stopPropagation?.();buttons[event.key==='ArrowUp'?buttons.length-1:0].focus({preventScroll:true});}
       }
       return;
     }
     if(event.key==='Enter'){
       event.preventDefault();
       event.stopPropagation?.();
       if(Parse())void submitCandidate(target);else legacySubmitAsk({preventDefault(){},target:target.closest('form')});
     }
   }
   function submitAsk(event){
     if(!event.target?.hasAttribute?.('data-pet-ask'))return;
     event.preventDefault();
     if(!Parse()){legacySubmitAsk(event);return;}
     const input=event.target.querySelector('[data-pet-question]');
     void submitCandidate(input);
   }
   function legacySubmitAsk(event){
     if(!event.target?.hasAttribute?.('data-pet-ask'))return;
     event.preventDefault();
     const input=event.target.querySelector('[data-pet-question]'),question=input?.value?.trim();
     if(!question||!Ask())return;
     refreshBrain();
     const result=Ask().parse(question,{...snapshot,now:now()});
     if(result.action==='fallback'){show(askForm(question)+`<p class="pet-say">${E(result.message)}</p>`,{menu:true});return;}
     if(result.choices?.length>1){
       const choices=result.choices;
       show(askForm(question)+`<div class="pet-items">${choices.map((v,i)=>`<button type="button" class="pet-item" data-pet-action="ask-choice" data-pet-choice="${i}">${E(v.label)}</button>`).join('')}</div>`,{menu:true});
       askChoices=choices;
       return;
     }
     closeBubble();
     void runAsk(result);
   }
   function afterSlip(message,{undo=false,reload=false,suggestions=[],choices=[]}={}){
    show(`<div class="biscuit-preview" role="status">${E(message)}</div><div class="pet-items">${choices.map((v,i)=>`<button type="button" class="pet-item biscuit-row" data-pet-action="engine-row" data-pet-choice="${i}">${E(v.title)}${v.subtitle?`<small>${E(v.subtitle)}</small>`:''}</button>`).join('')}${undo?'<button type="button" class="pet-item" data-pet-action="undo">Undo</button>':''}${reload?'<button type="button" class="pet-item" data-pet-action="reload">Reload</button>':''}${suggestions.map((line,i)=>`<button type="button" class="pet-item biscuit-suggestion" data-pet-action="example" data-pet-choice="${i}">${E(line)}</button>`).join('')}<button type="button" class="pet-item" data-pet-action="ask" data-companion-ask>Ask ${E(companionName())}</button></div>`,{menu:true});
    askChoices=suggestions.map(line=>({line}));bubble?.querySelector('.pet-item')?.focus({preventScroll:true});
   }
   async function undoChange(){
    if(commandBusy)return;const entry=undoChanges.at(-1);if(!entry){afterSlip('Nothing to undo.');return;}
    commandBusy=true;
    try{
      const result=await entry();
      if(result===false||result?.ok===false){afterSlip(result?.message||'Could not undo. Try again.',{undo:true});return;}
      undoChanges.pop();
      if(Object.hasOwn(result||{},'plan'))rememberAction(engineSession,'plan',{operation:'undo'},result);
      afterSlip(result?.message||'Undone.',{undo:!!undoChanges.length,reload:result?.reload});
    }catch{afterSlip('Could not undo. Try again.',{undo:true});}finally{commandBusy=false;}
   }
   function rememberLocalAction(intent,fields,result){if(!dead)rememberAction(engineSession,intent,fields,result);}
    async function useCandidate(choice){
    if(commandBusy)return;
    const fields=choice.fields||{};
    if(['none','chat'].includes(choice.intent)){if(choice.engine)engineCard=choice.engine;afterSlip(choice.preview,{choices:engineRows(choice.engine)});return;}
    if(choice.engine){
      engineSession.items=choice.engine.items;
      engineSession.query=choice.line;
      engineSession.itemId=fields.itemId||choice.engine.items[0]?.id||engineSession.itemId;
      engineSession.courseId=fields.courseId||choice.engine.items[0]?.courseId;
    }
    if(choice.intent==='undo'){closeBubble();await undoChange();return;}
    if(choice.intent==='help'||
      choice.intent==='navigate'&&['today','tdy','help'].includes(fields.tab)&&Object.keys(fields).every(key=>key==='tab')||
      choice.intent==='module'&&fields.key==='today'&&fields.action==='show'&&Object.keys(fields).every(key=>['key','action'].includes(key))){
      afterSlip('Try a line:',{suggestions:['Dark mode','Hide the clock','Go to the planner','Note: bring goggles','25 minute focus','Undo']});
      return;
    }
    const kind=choice.intent==='study'?
      ({quiz:'practice',fix:'fixes'}[fields.action]||fields.action):
      choice.intent==='pet'?
        fields.action:
        choice.intent==='open'?(exposed.find(s=>s.action==='open'&&(!fields.itemId||s.data?.itemId===fields.itemId))?.kind||'next'):choice.intent==='focus-control'?'focus':choice.intent;
    exposed=exposed.filter(s=>s.kind!==kind);
    closeBubble();
    const version=bubbleVersion,previous=clean(getPet());
    let ok=false,result=false,undo=null,before;
    commandBusy=true;
    try{
     const checkpoint=actions.checkpoint?.(choice.intent);before=checkpoint?.then?await checkpoint:checkpoint;
     if(choice.intent==='quiet'){
      if(Number.isFinite(fields.minutes)&&fields.minutes>0&&fields.minutes<=1440){
        const old=quietUntil,until=now()+fields.minutes*60000;
        quietUntil=until;
        const change=current=>({...current,brain:{...Brain().cleanLearning(current.brain),quietUntil:until}});
        const saved=await save(change(pet),change);
        ok=saved!==false;
        if(!ok)quietUntil=old;
        result={ok,undo:()=>{
          quietUntil=old;
          const restore=current=>({...current,brain:{...Brain().cleanLearning(current.brain),quietUntil:old}});
          return save(restore(pet),restore);
        }};
      }
     }else if(choice.intent==='pet'){result=await runPet(fields);ok=result!==false;}
     else if(choice.intent==='routine'){result=await runAsk({action:'routine',data:fields});ok=result!==false;}
     else{
      const action=actions[choice.intent]||
        (root.ReserveBiscuitRegistry?.execute?data=>root.ReserveBiscuitRegistry.execute(choice.intent,data,{snapshot,actions,now:now()}):null),
        data=choice.intent==='ai'?
          {question:fields.handoff?.wishes||fields.text,handoff:fields.handoff}:
          choice.intent==='focus'||choice.intent==='break'?
            {...fields,explicit:true}:
            choice.intent==='plan'?{...fields,mode:fields.endDate?'week':fields.date&&fields.date!==Ask()?.calendar(snapshot.timeZone)(now()).day?'tomorrow':'tonight'}:fields;
      result=action?await action(data):false;ok=!!action&&result!==false&&result?.ok!==false;
     }
     if(ok){
      undo=result?.undo||(before&&actions.changed?.(before));
      if(!undo&&(choice.intent==='pet'||choice.intent==='routine')){
        const current=clean(getPet()),keys=Object.keys(previous).filter(key=>JSON.stringify(previous[key])!==JSON.stringify(current[key]));
        if(keys.length)
          undo=()=>save({...pet,...Object.fromEntries(keys.map(key=>[key,previous[key]]))},value=>({...value,...Object.fromEntries(keys.map(key=>[key,previous[key]]))}));
      }
      if(undo){undoChanges.push(undo);if(undoChanges.length>20)undoChanges.shift();}
       rememberLocalAction(choice.intent,fields,result);
     }
    }catch{ok=false;}finally{commandBusy=false;}
    if(!dead)learn([[kind,ok?'used':'ignored']]);
    if(dead||version!==bubbleVersion&&menuOpen)return;
    if(choice.intent==='focus-status'&&ok&&typeof result==='string'){say(result);return;}
    if(ok&&undo)afterSlip(result?.message||choice.preview,{undo:true,reload:result?.reload});
    else if(result?.message)afterSlip(result.message,{reload:result.reload,suggestions:result.suggestions});
    else if(!ok&&choice.intent!=='ai')
      afterSlip(['setting','preset','navigate','bookmark','study','installed'].includes(choice.intent)?'That feature is off or unavailable. Check Make it yours \u2192 Features.':choice.intent==='break'?'No break started: a break comes after a focus session ends.':'Unavailable');
   }
   async function runPet(fields){
     if(fields.action==='treat')return treat();
     if(fields.action==='home'){const ok=await save({...pet,roam:'home'},current=>({...current,roam:'home'}));if(ok!==false)plan(300);return ok!==false;}
     if(fields.action==='hide'){snooze(fields.minutes);return true;}
     if(fields.action==='quiet'){return (await save({...pet,nudges:'quiet'},current=>({...current,nudges:'quiet'})))!==false;}
     if(fields.action==='off'){afterSlip('The Companion switch is in the extension popup \u2192 Companion.');return false;}
     if(fields.action==='settings'){if(!actions.settings)return false;return (await actions.settings())!==false;}
     return false;
   }
   async function runAsk(result){
     if(result.action==='remind'||result.action==='routine'){
       const key=result.action==='remind'?'reminders':'routines',limit=20,entry={...result.data,id:newId(),createdAt:now(),...(key==='routines'?{last:''}:{})};
       let added=false;
       const version=bubbleVersion;
       try{
         const ok=await save({...pet,[key]:[...pet[key],entry].slice(0,limit)},current=>{
           const list=key==='reminders'?Ask().cleanReminders(current[key],now()):Ask().cleanRoutines(current[key]);
           if(list.length>=limit)return current;
           added=true;
           return {...current,[key]:[...list,entry]};
         });
         const stored=ok!==false&&(added||pet[key].some(v=>v.id===entry.id));
         if(!dead&&stored&&version===bubbleVersion)say('Saved.');
         return stored;
       }catch{return false;}
     }
     try{await actions[result.action]?.(result.data);}catch{}
   }
   function useSchedule(later){
     const offer=scheduled;
     if(!offer)return;
     closeBubble();
     if(offer.type==='reminder'){
       const at=Number(offer.occurrence),
         change=current=>({...current,reminders:current.reminders.flatMap(r=>r.id!==offer.id||r.at!==at?[r]:later?[{...r,at:now()+600000}]:[])});
       void save(change(pet),change);
       return;
     }
     if(!later&&offer.action!=='remind')void runAsk(offer);
   }
  function summary(data){
   const n=data.todayOpen||0;
   if(data.next)return `<strong>Next:</strong> ${E(data.next.title)}<span class="pet-when">${E([data.next.course,data.next.when].filter(Boolean).join(' · '))}</span>`;
   return n?`${n} thing${n===1?'':'s'} left today.`:'Nothing due soon. Enjoy it.';
  }
  function legacyMenu(){
   const data=info(),lv=level(pet.xp),item=(action,label,extra='')=>`<button type="button" role="menuitem" class="pet-item" data-pet-action="${action}" ${extra}>${label}</button>`;
   show(`<div class="pet-head"><strong>${E(pet.name)}</strong><span>Level ${lv}${pet.streak>1?` · ${pet.streak} days in a row`:''}</span><span class="pet-meter" aria-hidden="true"><i style="width:${Math.round(levelProgress(pet.xp)*100)}%"></i></span></div>
<p class="pet-say">${summary(data)}</p>
<div class="pet-items">${data.next?item('open','Open it')+item('focus',focusing?'Timer is running':'Focus 25 min',focusing?'disabled':''):''}${item('feed',`Give a treat <span class="pet-count">${pet.treats}</span>`,pet.treats?'':'disabled')}${item('stay',pet.roam==='home'?'Let it roam':'Send it home')}${item('settings','Pet settings')}</div>`,{menu:true});
   bubble.querySelector('.pet-item:not([disabled])')?.focus({preventScroll:true});
  }
  function openMenu(){
   void loadKnowledge();
   refreshBrain();
   const offer=engine?.offer({...snapshot,now:now()},{},{brain:pet.brain}),list=engine?(offer&&offer.kind!=='reminder'?[offer]:[]):thought.suggestions.slice(0,2);
    show(`${askForm()}<button type="button" id="biscuit-preview" class="biscuit-preview" data-pet-preview data-pet-action="ask-choice" data-pet-choice="0" aria-live="polite" style="display:none" hidden></button>${engine?'<div class="biscuit-rows" data-biscuit-rows hidden></div>':''}<div class="pet-items biscuit-suggestions" data-pet-suggestions>${suggestionItems(list)}</div>`,{menu:true});expose(list);
   (bubble.querySelector('[data-pet-question]')||bubble.querySelector('.pet-item:not([disabled])'))?.focus({preventScroll:true});
   void loadCatalogue(true);
  }
  function treat(){
   if(!pet.treats||!node)return false;
   closeBubble();save(feed(pet));goal=null;speed=0;settle('eat',2600);
   clearTimeout(timer);timer=setTimeout(()=>{cheer();},2500);return true;
  }
  // pleased: two small hops, then back to what it was doing
  function cheer(ms=1300){
    if(!node)return;
    goal=null;
    speed=0;
    rest='stand';
    ch.down=0;
    setPose('cheer');
    run();
    plan(ms+600);
    clearTimeout(node._cheer);
    node._cheer=setTimeout(()=>{if(node&&pose==='cheer')setPose('stand');},ms);
  }
  function onBubble(event){
   const b=event.target.closest?.('[data-pet-action]');if(!b||b.disabled)return;
   const what=b.dataset.petAction;
   if(what==='engine-row'){
     const list=engineRows(engineCard),row=list[Number(b.dataset.petChoice)];
     if(row)void useCandidate({intent:row.action||'open',fields:row.fields,preview:'Open '+row.title,engine:{...engineCard,items:[row,...list.filter(v=>v!==row)]},line:askText});
     return;
   }
   if(what==='engine-ai'){if(engineCard?.ai)void useCandidate({intent:'ai',fields:engineCard.ai.fields,preview:'Ask AI'});return;}
   if(what==='undo'){void undoChange();return;}
   if(what==='reload'){actions.reload?.();return;}
   if(what==='ask'){openMenu();return;}
   if(what==='engine-row'){
     const list=engineRows(engineCard),row=list[Number(b.dataset.petChoice)];
     if(row)void useCandidate({intent:row.action||'open',fields:row.fields,preview:'Open '+row.title,engine:{...engineCard,items:[row,...list.filter(v=>v!==row)]},line:askText});
     return;
   }
   if(what==='example'){
     const line=askChoices[Number(b.dataset.petChoice)]?.line,choice=line&&Parse()?.parse(line,{...snapshot,now:now()})?.[0];
     if(choice)void useCandidate(choice);
     return;
   }
    if(what==='ask-choice'){
      const result=askChoices[Number(b.dataset.petChoice)];
      if(result?.intent)void useCandidate(result);else if(result){closeBubble();void runAsk(result);}
      return;
    }
    if(what==='schedule-use'||what==='schedule-later'){useSchedule(what==='schedule-later');return;}
   if(nudgeOpen||what==='quiet'){snooze();return;}
   if(what==='suggestion'){
     const s=exposed.find(s=>s.id===b.dataset.petSuggestion);
     if(!s)return;
     exposed=exposed.filter(e=>e!==s);
     closeBubble();
     const action=s.action==='pet'?runPet:actions[s.action];
     try{
       Promise.resolve(action?.(s.data)).then(ok=>{if(!dead)learn([[s.kind,action&&ok!==false?'used':'ignored']]);}).catch(()=>{if(!dead)learn([[s.kind,'ignored']]);});
     }catch{learn([[s.kind,'ignored']]);}
   }
   else if(what==='feed'){treat();}
   else if(what==='stay'){closeBubble();save({...pet,roam:pet.roam==='home'?'page':'home'});plan(300);}
   else if(what==='settings'){closeBubble();actions.settings?.();}
  }
  function save(nextPet,mutate){
    const before=pet;
    pet=clean(nextPet);
    const patch=Object.fromEntries(Object.entries(pet).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(before[key])));
    dress();
    moveForRoam(before.roam);
    return savePet?.(pet,patch,mutate);
  }
  // ---- called by the workspace
  // While a room's move plays (data-ch-moving), the companion's upkeep in a render (its brain, offers, nudges: the
  // Biscuit engine's offer among them) waits until the move has landed and the browser is idle. In the render that swaps
  // a room's page for Home it was an eighth of the fold's long task at 4x CPU, for a companion that keeps still then.
  let syncWait=0;
  function sync(){
   const until=layer&&!dead?Number(container.dataset?.chMoving||0)-Date.now():0;
   if(until>0){
     if(!syncWait)
       syncWait=setTimeout(()=>{const go=()=>{syncWait=0;if(!dead)sync();};if(win.requestIdleCallback)win.requestIdleCallback(go,{timeout:1000});else go();},until+40);
     return;
   }
   const outer=syncInfo;syncInfo={data:null};try{syncNow();}finally{syncInfo=outer;}
  }
  function syncNow(){
   if(dead)return;
   const before=pet.knowledge,roam=pet.roam,more=snapshot.biscuitMoreRules;
   pet=clean(getPet());
   personal=getData();
   hydrateCustom();
   void loadKnowledge();
   if(!visible()){unmount();scheduleReturn();return;}
    if(!layer)mount();else{dress();if(!container.contains(layer)){container.append(layer);rig=null;resetReels();}if(!moveForRoam(roam))invalidate();}
   refreshBrain();
   if(before!==pet.knowledge||more!==snapshot.biscuitMoreRules){const input=bubble?.querySelector('[data-pet-question]');if(input?.value?.trim())previewAsk({target:input,flush:true});}
   offerBreak();
   offerStretch();
   maybeNudge();
  }
  function celebrate(kind='done',{today,left}={}){
   const result=reward(clean(getPet()),kind,today);save(result.pet);
   if(!visible()||!layer)return result;
   if(kind==='focus'){closeBubble();pendingBreak=true;focusing=false;setFocus(false);settle('stand',2000);refreshBrain();offerBreak();return result;}
   closeBubble();cheer(1300);
   const line=result.leveled?`Level ${level(pet.xp)}! Something new is unlocked.`:kind==='focus'?'Good session. A treat for both of us.':left===0?'That was the last one for today.':left>0?`Done. ${left} left today.`:'Done. Nicely.';
   say(line,4200);
   return result;
  }
  function setFocus(running,details){
    const was=focusing;
    if(details)focusDetails=details;
    focusing=!!running&&focusDetails.phase!=='break';
    if(node){
      const left=Math.max(0,Math.ceil(((focusDetails.endsAt||0)-now())/1000)),tag=running&&focusDetails.fromPony?`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`:'';
      if(tag&&node.dataset.timeLeft!==tag)node.dataset.timeLeft=tag;else if(!tag)delete node.dataset.timeLeft;
    }
    if(was!==focusing&&layer&&!grab){if(focusing){goal=null;speed=0;if(!menuOpen){closeBubble();settle('read',20000);}}else if(!menuOpen)plan(400);}
  }
  function destroy(){dead=true;clearTimeout(syncWait);hydrationRevision++;catalogueTurn++;submitTurn++;knowledgeTurn++;clearTimeout(hideTimer);unmount();}
  hydrateCustom();void loadKnowledge();if(visible())mount();else scheduleReturn();
  return {sync,celebrate,setFocus,say,treat,ask,destroy,get pet(){return pet;}};
 }
 function rememberAction(session,intent,fields={},result={},depth=0){
   if(!session||typeof session!=='object'||result?.ok!==true||depth>1)return false;
   if(intent==='batch'){
     let remembered=false;
     for(const receipt of (Array.isArray(result.receipts)?result.receipts:[]).slice(0,6))
       remembered=rememberAction(session,receipt.action,receipt.fields,receipt.result,depth+1)||remembered;
     return remembered;
   }
   if(!['note','bookmark','reminder','plan'].includes(intent))return false;
   const validId=v=>
     (typeof v==='string'||typeof v==='number'&&Number.isFinite(v))&&
       String(v).trim()&&
       String(v).length<=256&&
       !/[\u0000-\u001f\u007f]/.test(String(v))&&
       !['__proto__','prototype','constructor'].includes(String(v))?
       String(v):
       '',
     keys={note:['id','title','text','courseId'],bookmark:['id','title','courseId','url'],reminder:['id','title','text','at','courseId'],plan:['id','title','itemId','courseId','startAt','endAt','minutes']}[intent],
     limits={id:256,itemId:256,title:300,text:intent==='reminder'?240:30000,courseId:256,url:2048},
     pick=value=>{
     if(!value||typeof value!=='object'||Array.isArray(value))return null;
     const out={};
     for(const key of keys){
       const v=value[key];
       if(['at','startAt','endAt','minutes'].includes(key)){if(Number.isFinite(v)&&v>=0&&v<=8640000000000000)out[key]=v;}
       else if(['id','itemId','courseId'].includes(key)){if(validId(v))out[key]=validId(v);}else if(typeof v==='string')out[key]=v.slice(0,limits[key]);
     }
     return Object.keys(out).length?out:null;
   };
   let planChanged=false;
  if(intent==='plan'&&Object.hasOwn(result,'plan')){
    const p=result.plan;
    if(p===null){delete session.lastPlan;planChanged=true;}
    else if(p&&
      Number.isSafeInteger(p.window?.start)&&
      Number.isSafeInteger(p.window?.end)&&
      p.window.end>p.window.start&&
      Array.isArray(p.itemIds)&&
      p.itemIds.length&&
      p.itemIds.length<=256&&
      p.itemIds.every(validId)&&
      new Set(p.itemIds.map(String)).size===p.itemIds.length&&
      Array.isArray(p.excludeIntervals)&&
      p.excludeIntervals.every(v=>
        Number.isSafeInteger(v.startAt)&&Number.isSafeInteger(v.endAt)&&v.endAt>v.startAt&&v.startAt>=p.window.start&&v.endAt<=p.window.end)){
      session.lastPlan={
        window:{start:p.window.start,end:p.window.end},
        itemIds:p.itemIds.map(String),
        excludeIntervals:p.excludeIntervals.map(v=>({startAt:v.startAt,endAt:v.endAt,...(validId(v.eventId)?{eventId:String(v.eventId)}:{})}))
      };
      const estimates=p.estimates;
      if(estimates&&typeof estimates==='object'&&!Array.isArray(estimates)&&Object.keys(estimates).length<=p.itemIds.length){
        const entries=Object.entries(estimates).filter(([key,value])=>
          validId(key)&&
            session.lastPlan.itemIds.includes(key)&&
            typeof value==='number'&&
            Number.isFinite(value)&&
            value>0&&
            value<=1440&&
            Math.round(value*60000)>0&&
            Number.isSafeInteger(Math.round(value*60000))&&
            Math.abs(value*60000-Math.round(value*60000))<=Number.EPSILON*Math.max(1,Math.abs(value*60000)));
        if(entries.length===Object.keys(estimates).length&&entries.length)session.lastPlan.estimates=Object.fromEntries(entries);
      }
      planChanged=true;
      session.lastItemId=session.lastPlan.itemIds[0];
    }
  }
  const before=pick(result.before),
    after=pick(result.after),
    targetId=validId(result.targetId)||validId(after?.id)||validId(before?.id),
    operation=typeof fields.operation==='string'?fields.operation.slice(0,40):'';
  if(!before&&!after){
    if(planChanged)session.lastAction={action:intent,...(operation?{operation}:{}),fields:{...(session.lastPlan||{}),...(operation?{operation}:{})}};
    return planChanged;
  }
  const committed={
    ...(operation?{operation}:{}),
    ...(targetId?{targetId,...(intent==='plan'?{blockId:targetId}:{})}:{}),
    ...(intent==='plan'&&after?Object.fromEntries(['startAt','endAt','minutes'].filter(key=>after[key]!==undefined).map(key=>[key,after[key]])):{})
  };
  session.lastAction={action:intent,...(operation?{operation}:{}),...(targetId?{targetId}:{}),fields:committed,...(before?{before}:{}),...(after?{after}:{})};
  if(targetId)session.lastItemId=targetId;
  if(after?.courseId||before?.courseId)session.lastCourseId=after?.courseId||before.courseId;
  return true;
 }
 const api={
   DEFAULTS,
   SIZES,
   ROAM,
   NUDGES,
   GEAR,
   KNOWLEDGE,
   LEVEL_XP,
   UNLOCKS,
   level,
   levelProgress,
   unlocked,
   clean,
   reward,
   feed,
   createActivity,
   customPose,
   customDrawing,
   rememberAction,
   create
 };
 root.ReservePets=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
