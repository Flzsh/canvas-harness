/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Welcome is an extension page. It never reads Canvas content or opens Canvas until the final button.
(function(){
 'use strict';

 const $=id=>document.getElementById(id);
 const all=selector=>Array.from(document.querySelectorAll(selector));
 const manifest=chrome.runtime.getManifest();
 const product=manifest.name||'Canvas Harness';
 const personal=/^CH\+/i.test(product)||!Array.isArray(manifest.optional_host_permissions);
 const stepNames=['intro',...(personal?[]:['school']),'navigation','appearance','companion'];
 const UI=ReserveWelcomeRoom.UI;
 const panels=stepNames.map(name=>document.querySelector('[data-step="'+name+'"]'));
 const status=$('status'),school=$('school-url'),tour=$('tour'),next=$('next'),back=$('back');
 const demo=$('menu-demo'),meadow=$('meadow'),petNode=$('tour-pet');
 const navNames={drawn:'From the left edge',shown:'Full height',top:'Across the top',original:'Canvas’s own'};
 const navDescriptions={
  drawn:'Move to the left edge to reveal the menu.',
  shown:'The whole menu stays in view on the left.',
  top:'Your menu runs across the top.',
  original:'Keep Canvas’s original dark menu.'
 };
 const stillMedia=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 let index=0,busy=false,nav='drawn',prefs=null,validatedOrigin='',schoolTouched=false,prefData=null,unsub=null;
 let filmTime=0,filmTimer=0,lastWall=0,finished=false,ponyWalk=null,ponyRig=null;
 const introLayer=$('intro-art');
 const introStart=$('intro-start'),footer=document.querySelector('.tour-footer');
 const finishLayer=$('finish-fx'),finishBoard=$('finish-board'),stage=$('room-stage'),schoolGo=$('school-go');
 const spotlight=$('school-spotlight'),schoolNote=$('school-note'),petSwitch=$('pet-switch');
 let schoolSpotlight=false;
 let travelling=false,roomReady=false,roomShot='',roomTimer=0,roomTime=0,roomWall=null,roomSuspended=false;
 const delays=new Map();
 let finishArt=null,finishFrame=0,finishWall=0,finishDraw=0,stampTimer=0,stampReset=0,openTimer=0,openResolve=null;
 let intro=null,motionReady=false,openingFrame=0,openingTime=0,openingWall=null,openingDraw=0,idleTimer=0,idleTime=0,idleWall=null;
 let introPointed=false,introFocused=false;
 let platePointed=null,plateFocused=null;
 const effects=new Map(),cues=new Map();
 const scenes=new Map();
 const sceneSteps={navigation:[['page','#page-scene']]};
 let activeScenes=[];
 const FILM_MS=1000/24,PEN='cubic-bezier(.45,.05,.25,1)',SETTLE='cubic-bezier(.2,.65,.3,1)';
 const clockNow=()=>window.performance?.now?.()??Date.now();

 $('product-name').textContent=product;
 back.innerHTML=UI.back.replace('{LABEL}','Back');
 for(const button of all('[data-nav-choice]'))button.insertAdjacentHTML('afterbegin',UI.layouts[button.dataset.navChoice]);
 petSwitch.innerHTML=UI.toggle;
 $('progress-band').innerHTML=UI.progress(stepNames.length-1);
 $('intro-title').textContent='Welcome to '+product;
 document.title='Welcome to '+product;
 school.setAttribute('aria-describedby','status');
 if(personal){
  const panel=document.querySelector('[data-step="school"]');
  panel.hidden=true;
  panel.inert=true;
 }

 function notice(message='',error=false){
  status.textContent=message;
  if(error)status.dataset.tone='error';else delete status.dataset.tone;
 }
 function current(){return stepNames[index];}
 function reduced(){return !!stillMedia?.matches||tour.dataset.still==='true';}

 // The controls and pony share a single 24 fps tour clock.
 // All WAAPI/CSS effects are paused and sampled here; hidden time never advances.
 function canMove(){return motionReady&&!finished&&!reduced()&&typeof tour.animate==='function';}
 function cancelEffects(scope){
  for(const [a,e] of effects)if(!scope||e.scope===scope){a.cancel();effects.delete(a);}
  for(const [key,cue] of cues)if(!scope||cue.scope===scope)cues.delete(key);
 }
 function play(node,frames,{duration=400,delay=0,iterations=1,easing=SETTLE,scope=current(),id='tour-motion'}={}){
  if(!node?.animate||!canMove())return null;
  const a=node.animate(frames,{duration,delay,iterations,easing,fill:'both'});
  a.id=id;a.pause();a.currentTime=0;
  effects.set(a,{node,scope,time:0,end:iterations===Infinity?Infinity:delay+duration*iterations});
  wakeFilm();return a;
 }
 function cue(key,delay,fn,scope=current()){
  if(!canMove()){fn();return;}
  cues.set(key,{at:filmTime+delay,fn,scope});wakeFilm();
 }
 function wakeFilm(){
  if(filmTimer||document.hidden||!canMove()||(!effects.size&&!cues.size&&!ponyWalk))return;
  lastWall=clockNow();filmTimer=setTimeout(tickFilm,FILM_MS);
 }
 function tickFilm(){
  filmTimer=0;if(document.hidden||!canMove())return;
  const now=clockNow(),delta=Math.max(0,now-lastWall);lastWall=now;filmTime+=delta;
  for(const [a,e] of effects){
   if(e.scope!=='global'&&e.scope!==current())continue;
   e.time+=delta;a.currentTime=Math.min(e.time,e.end);
   if(e.time>=e.end){a.cancel();effects.delete(a);}
  }
  if(ponyWalk)paintPony();
  for(const [key,item] of [...cues])if(filmTime>=item.at){cues.delete(key);item.fn();}
  wakeFilm();
 }
 function captureCSS(){
  if(!canMove())return;
  const live=new Set(panels[index].getAnimations?.({subtree:true})||[]);
  for(const [a,e] of effects)if(a.animationName&&e.scope===current()&&!live.has(a)){a.cancel();effects.delete(a);}
  for(const a of live){
   if(effects.has(a)||!a.animationName)continue;
   a.pause();a.currentTime=0;
   effects.set(a,{node:a.effect.target,scope:current(),time:0,end:a.effect.getComputedTiming().endTime});
  }
 }
 function syncMotion(){
  if(reduced())stopFinish();
  clearTimeout(filmTimer);filmTimer=0;
  tour.dataset.paused=String(!!document.hidden);
  pauseOpening();stopIntroIdle();
  syncScenes();syncRoom();
  if(!finished&&intro){
   if(reduced()&&openingPlays())skipOpening();
   if(!document.hidden&&!reduced()){
    if(openingPlays())wakeOpening();else wakeIntroIdle();
   }
   if(reduced()&&current()!=='intro')introLayer.hidden=true;
  }
  if(!canMove()){
   cancelEffects();ponyWalk=null;
   if(current()==='school')school.placeholder='https://your-school.instructure.com';
   if(current()==='companion')settlePony();
   return;
  }
  if(!document.hidden){captureCSS();wakeFilm();}
 }
 function svgMarkup(cls,body,box='0 0 300 18'){
  return '<svg class="'+cls+'" viewBox="'+box+'" preserveAspectRatio="none" aria-hidden="true">'+body+'</svg>';
 }
 function decorateControls(){
  for(const heading of all('h1,h2'))heading.insertAdjacentHTML?.('beforeend',svgMarkup('heading-underline','<path pathLength="1" d="M3 10q70-5 148-2t145-1"/>'));
  for(const button of all('button')){
   if(button===introStart||button.classList.contains('room-hit')||button.classList.contains('wr-strap-button')||button.classList.contains('wr-choice'))continue;
   button.insertAdjacentHTML?.('beforeend',svgMarkup('pen-outline','<path pathLength="1" d="M15 3q138-2 270 0 10 0 11 7l-1 40q0 7-12 7L14 56Q4 56 4 48L3 12Q3 3 15 3Z"/>','0 0 300 60'));
   if(button.dataset.themeChoice||button.dataset.navChoice)button.insertAdjacentHTML?.('beforeend',svgMarkup('choice-tick','<path pathLength="1" d="M3 12l6 6L22 3"/>','0 0 25 22'));
   button.addEventListener('pointerenter',()=>drawPen(button.querySelector('.pen-outline path'),250,'global'));
   button.addEventListener('focus',()=>drawPen(button.querySelector('.pen-outline path'),250,'global'));
  }
 }
 function drawPen(node,duration=500,scope=current(),delay=0){
  node?.setAttribute('pathLength','1');
  return play(node,[{strokeDasharray:'1',strokeDashoffset:1,opacity:0},{strokeDasharray:'1',strokeDashoffset:.98,opacity:1,offset:.02},{strokeDasharray:'1',strokeDashoffset:0,opacity:1}],{duration,delay,easing:PEN,scope,id:'tour-pen'});
 }
 function selectedTick(button,selected){
  if(selected&&!button.classList.contains('is-selected'))drawPen(button.querySelector('.choice-tick path'),350);
 }
 function stepEntrance(panel){
  if(!canMove())return;
  drawPen(panel.querySelector('.heading-underline path'),580);
  const pieces=[...panel.children].filter(n=>!/^H[12]$/.test(n.tagName));
  pieces.forEach((node,k)=>play(node,[{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,delay:110+k*75,id:'tour-stagger'}));
  captureCSS();
 }
 // The supplied picture owns its poses; only visible milliseconds drive it.
 function resizeIntro(){
  const ratio=window.innerWidth/window.innerHeight;
  introLayer.querySelector('svg')?.setAttribute('preserveAspectRatio',ratio<1.25||ratio>2.1?'xMidYMid meet':'xMidYMid slice');
  placeIntroStart();room.layout();placeOverlays();
 }
 function placeIntroStart(){
  const box=intro?.button.getBoundingClientRect();
  if(box)for(const key of ['left','top','width','height'])introStart.style[key]=box[key]+'px';
 }
 function hoverIntro(){
  if(!intro||introStart.disabled)return;
  intro.hover(introPointed||introFocused);placeIntroStart();
 }
 function pauseOpening(){
  cancelAnimationFrame(openingFrame);openingFrame=0;
  if(openingWall!==null)openingTime+=Math.max(0,clockNow()-openingWall);
  openingWall=null;
 }
 function wakeOpening(){
  if(openingFrame||!motionReady||finished||document.hidden||reduced()||!openingPlays())return;
  openingWall=clockNow();openingFrame=requestAnimationFrame(tickOpening);
 }
 function tickOpening(now){
  openingFrame=0;
  if(finished||document.hidden||reduced())return;
  openingTime+=Math.max(0,now-openingWall);openingWall=now;
  if(now-openingDraw>=15){
   openingDraw=now;
   if(openingTime>=intro.END*1000){skipOpening();return;}
   intro.setT(openingTime/1000);
   if(openingTime>=intro.READY*1000&&tour.dataset.opening==='true')revealIntro();
   placeIntroStart();
  }
  openingFrame=requestAnimationFrame(tickOpening);
 }
 function stopIntroIdle(){
  clearTimeout(idleTimer);idleTimer=0;
  if(idleWall!==null)idleTime+=Math.max(0,clockNow()-idleWall);
  idleWall=null;
 }
 function wakeIntroIdle(){
  if(idleTimer||!intro||!motionReady||finished||document.hidden||reduced()||current()!=='intro'||openingPlays())return;
  idleWall=clockNow();idleTimer=setTimeout(tickIntroIdle,125);
 }
 function tickIntroIdle(){
  idleTimer=0;
  if(finished||document.hidden||reduced()||current()!=='intro')return;
  idleTime+=Math.max(0,clockNow()-idleWall);idleWall=null;
  intro.idle(idleTime/1000);wakeIntroIdle();
 }
 function startOpening(){
  tour.dataset.opening='true';
  try{intro=ReserveWelcomeIntro.mount(introLayer);resizeIntro();}
  catch{intro=null;tour.dataset.opening='false';introLayer.hidden=true;introStart.classList.add('is-fallback');syncButtons();introStart.focus({preventScroll:true});notice('The welcome drawing could not load. You can still continue.',true);return;}
  if(reduced()){skipOpening();return;}
  intro.setT(0);placeIntroStart();openingDraw=clockNow();wakeOpening();
 }
 // READY enables the drawn Start while the picture finishes; END hands over to idle().
 function openingPlays(){return tour.dataset.opening==='true'||tour.dataset.opening==='reveal';}
 function revealIntro(){
  tour.dataset.opening='reveal';introLayer.classList.add('is-settled');
  syncButtons();placeIntroStart();introStart.focus({preventScroll:true});
 }
 function skipOpening(){
  if(!openingPlays())return;
  pauseOpening();intro.setT(intro.END);
  if(tour.dataset.opening==='true')revealIntro();
  tour.dataset.opening='false';placeIntroStart();wakeIntroIdle();
 }
 function wait(ms,motion=false){
  if(finished||(motion&&reduced()))return Promise.resolve();
  return new Promise(resolve=>{const id=setTimeout(()=>{delays.delete(id);resolve();},ms);delays.set(id,resolve);});
 }
 function hideIntro(){
  if(openingPlays()){pauseOpening();intro.setT(intro.END);tour.dataset.opening='false';}
  introPointed=false;introFocused=false;intro?.hover(false);
  stopIntroIdle();introLayer.classList.remove('is-restored');introLayer.classList.add('is-away');
  return wait(400,true).then(()=>{introLayer.hidden=true;});
 }
 // The drawing stays decorative. Its actual PC page is an accessible overlay,
 // placed from the same content rectangle after the camera settles.
 const room=ReserveWelcomeRoom.mount(stage,{theme:'light',reduced:reduced()}),pcContent=room.pcContent;
 document.querySelector('.tour-steps').append(pcContent);
 pcContent.append(document.querySelector('[data-step="school"]'),document.querySelector('[data-step="navigation"]'));
 $('school-start-page').innerHTML=ReserveWelcomeRoom.SCHOOLHOUSE;
 pcContent.hidden=true;pcContent.inert=true;
 function place(node,box){
  if(!box)return;
  for(const key of ['left','top','width','height'])node.style[key]=box[key]+'px';
 }
 function placeOverlays(){
  if(!roomReady)return;
  // the tour's text and controls grow with the window like the drawings do (1x at 1280x800, up to 1.6x)
  const ui=Math.max(1,Math.min(1.6,Math.min(innerWidth/1280,innerHeight/800)));document.documentElement.style.setProperty('--ui',ui.toFixed(3));
  footer.classList.toggle('is-pc',roomShot==='pc');
  if(roomShot!=='pc')for(const key of ['left','top','width','height'])footer.style[key]='';
  if(roomShot==='pc'){
   const content=room.rect('content'),address=room.rect('address'),go=room.rect('go');
   place(pcContent,content);
   place(footer,{left:content.left+18*ui,top:content.bottom-(18+44)*ui,width:content.width-36*ui,height:44*ui});
   place(school,address);place(schoolGo,go);
   const left=Math.min(address.left,go.left)-10,top=Math.min(address.top,go.top)-10;
   const right=Math.max(address.right,go.right)+10,bottom=Math.max(address.bottom,go.bottom)+10;
   place(spotlight,{left,top,width:right-left,height:bottom-top});
   schoolNote.style.left=address.left+24*ui+'px';schoolNote.style.top=bottom+30*ui+'px';
   schoolNote.style.maxWidth=Math.max(0,Math.min(360*ui,content.right-address.left-42))+'px';
   place($('address-loading'),{left:address.left,top:address.bottom-2,width:address.width,height:2});
  }else if(roomShot==='room'){
   for(const [theme,win,plate] of [['light','winL','plateL'],['dark','winR','plateR']]){
    place(document.querySelector('[data-theme-choice="'+theme+'"]'),room.rect(win));
    place(document.querySelector('[data-theme-continue="'+theme+'"]'),room.rect(plate));
   }
  }else if(roomShot==='meadow'){
   const title=room.rect('title'),pony=room.rect('pony'),height=window.innerHeight*.14,width=height*72/64;
   $('companion-title').style.left=title.x+'px';$('companion-title').style.top=title.y+'px';
   place($('pet-actor'),{left:pony.x-width/2,top:pony.y-height*60/64,width,height});
   if(!ponyWalk)$('pet-actor').style.filter=room.ponyLight(prefData?.pet!==false);
   const speech=document.querySelector('.tour-bubble'),bounds=speech.getBoundingClientRect();
   // the bubble's tail (30% along its foot) points at Biscuit's head; at night it is mirrored to open away from the signpost
   const flip=room.theme==='dark',hx=pony.x+width*.3,hy=pony.y-height*60/64+height*.04;speech.classList.toggle('is-flipped',flip);
   speech.style.left=Math.max(8,Math.min(hx-bounds.width*(flip?.7:.3),window.innerWidth-bounds.width-8))+'px';
   speech.style.top=Math.max(bounds.height+8,Math.min(hy-2,window.innerHeight-8))+'px';
   const toggle=document.querySelector('.pet-toggle');
   place(toggle,room.rect('toggle'));toggle.style.filter=room.litFilter(true);
   place(finishBoard,room.rect('finish'));
  }
 }
 function showSchoolSpotlight(){
  schoolSpotlight=true;
  $('school-note-text').textContent=validatedOrigin?'Change the address if you need to, then press Go.':"Paste your school's Canvas address, then press Go.";
  spotlight.hidden=schoolNote.hidden=false;
  spotlight.classList.remove('is-clearing');schoolNote.classList.remove('is-clearing');
  school.setAttribute('aria-describedby','school-note status');
 }
 async function clearSchoolSpotlight(){
  schoolSpotlight=false;syncButtons();
  spotlight.classList.add('is-clearing');schoolNote.classList.add('is-clearing');
  await wait(300,true);
  if(!schoolSpotlight){spotlight.hidden=schoolNote.hidden=true;school.setAttribute('aria-describedby','status');}
 }
 function stopRoomIdle(){
  clearTimeout(roomTimer);roomTimer=0;
  if(roomWall!==null)roomTime+=Math.max(0,clockNow()-roomWall);
  roomWall=null;
 }
 function wakeRoomIdle(){
  if(roomTimer||!roomReady||finished||document.hidden||reduced())return;
  roomWall=clockNow();roomTimer=setTimeout(tickRoomIdle,1000/12);
 }
 function tickRoomIdle(){
  roomTimer=0;
  if(finished||document.hidden||reduced())return;
  roomTime+=Math.max(0,clockNow()-roomWall);roomWall=null;
  room.idle(roomTime/1000);wakeRoomIdle();
 }
 function syncRoom(){
  stopRoomIdle();
  const suspended=!!document.hidden||finished||reduced();
  if(suspended){
   room.hover(null);
   if(!roomSuspended){
    room.setTheme(document.documentElement.dataset.theme||'light',{animate:false});
    if(roomReady&&travelling&&roomShot)room.go(roomShot,{animate:false});
   }
  }else wakeRoomIdle();
  roomSuspended=suspended;
 }
 function boardHover(button,cls){
  let pointed=false,focused=false;
  const paint=()=>stage.classList.toggle(cls,pointed||focused);
  button.addEventListener('pointerenter',()=>{pointed=true;paint();});
  button.addEventListener('pointerleave',()=>{pointed=false;paint();});
  button.addEventListener('focus',()=>{focused=true;paint();});
  button.addEventListener('blur',()=>{focused=false;paint();});
 }
 function paintPlateHover(){
  stage.classList.toggle('wr-plate-hover',[platePointed,plateFocused].some(button=>button&&!button.disabled&&!button.hidden&&!button.inert));
 }
 function syncPlateButtons(){
  const theme=document.documentElement.dataset.theme||'light';
  for(const button of all('[data-theme-continue]')){
   const active=themePicked&&current()==='appearance'&&button.dataset.themeContinue===theme;
   button.hidden=!active;button.inert=!active;
   if(!active&&document.activeElement===button)button.blur?.();   // focus leaves before the button is hidden
   button.setAttribute('aria-hidden',String(!active));
   button.setAttribute('tabindex',active?'0':'-1');
   button.disabled=!active||busy||travelling||finished;
  }
  paintPlateHover();
 }
 // Both signs name their mode until a window is clicked; then the clicked one reads Continue.
 let themePicked=false;
 function renderPlates(theme){
  room.plate(theme,themePicked);
  room.plate(theme==='light'?'dark':'light',false);
  syncPlateButtons();
 }
 // Each supplied scene mounts once, plays on visible time, then sleeps between idle samples.
 function pauseScenes(){
  for(const s of activeScenes){
   cancelAnimationFrame(s.frame);clearTimeout(s.timer);s.frame=0;s.timer=0;
   if(s.wall!==null)s.time+=Math.max(0,clockNow()-s.wall);
   s.wall=null;
  }
 }
 function sceneMoving(){return motionReady&&!finished&&!document.hidden&&!reduced();}
 function wakeScene(s){
  if(s.frame||s.timer||!sceneMoving())return;
  s.wall=clockNow();
  if(s.done)s.timer=setTimeout(()=>tickScene(s),1000/12);
  else s.frame=requestAnimationFrame(()=>tickScene(s));
 }
 function tickScene(s){
  s.frame=0;s.timer=0;
  if(!sceneMoving()||!activeScenes.includes(s))return;
  const now=clockNow();s.time+=Math.max(0,now-s.wall);s.wall=now;
  if(s.done)s.art.idle(s.time/1000);
  else if(now-s.draw>=15){
   s.draw=now;s.art.setT(Math.min(s.time/1000,s.art.END));
   if(s.time>=s.art.END*1000)s.done=true;
  }
  wakeScene(s);
 }
 function settleScene(s){
  s.time=Math.max(s.time,s.art.END*1000);s.done=true;s.art.setT(s.art.END);
 }
 function syncScenes(){
  pauseScenes();
  if(finished)return;
  for(const s of activeScenes){if(reduced())settleScene(s);else wakeScene(s);}
 }
 function enterScenes(){
  pauseScenes();
  activeScenes=[];
  if(finished)return;
  for(const [name,selector] of sceneSteps[current()]||[]){
   let s=scenes.get(name);
   try{
    if(s)settleScene(s);
    else{
     const el=document.querySelector(selector);
     s={name,el,art:ReserveWelcomeScenes[name].mount(el),time:0,wall:null,draw:clockNow(),frame:0,timer:0,done:false};
     scenes.set(name,s);
     if(reduced())settleScene(s);else s.art.setT(0);
    }
    nightScene(name,s.el);
    activeScenes.push(s);wakeScene(s);
   }catch{
    notice('The welcome drawing could not load. You can still continue.',true);
   }
  }
 }
 function validOrigin(value){
  try{
   const u=new URL(value);
   if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.'))return '';
   return u.origin;
  }catch{return '';}
 }
 function syncButtons(){
  const step=current(),pc=step==='school'||step==='navigation',locked=busy||travelling||finished;
  footer.hidden=step==='intro'||travelling;
  introStart.disabled=locked||step!=='intro'||tour.dataset.opening==='true';
  back.hidden=step==='intro'||(!personal&&index===1);
  back.disabled=locked||index<(personal?1:2);
  next.hidden=step!=='navigation';next.disabled=locked;
  const spotlightOn=step==='school'&&schoolSpotlight&&!travelling&&!finished;
  stage.classList.toggle('wr-no-go',!spotlightOn);
  school.disabled=locked;school.readOnly=!!validatedOrigin&&!schoolSpotlight;
  schoolGo.hidden=!spotlightOn;schoolGo.disabled=locked||!spotlightOn;
  finishBoard.disabled=locked;
  $('school-form').hidden=!pc||travelling;$('school-form').inert=!pc||travelling;
  pcContent.hidden=!pc||travelling;pcContent.inert=!pc||travelling;
  for(const button of all('[data-theme-choice],[data-nav-choice]'))button.disabled=locked;
  syncPlateButtons();
  $('pet-enabled').disabled=locked;
  const label='Next';
  next.innerHTML=UI.next.replace('{LABEL}',label);next.setAttribute('aria-label',label);
  $('step-count').textContent='Step '+Math.max(1,index)+' of '+(stepNames.length-1);
  $('progress-band').querySelectorAll('.wr-rivet').forEach((rivet,k)=>{
   rivet.classList.toggle('is-done',k<Math.max(1,index)-1);
   rivet.classList.toggle('is-current',k===Math.max(1,index)-1);
  });
 }
 // A save disables the controls for a moment; the control the keyboard was on gets focus back.
 let busyFocus=null;
 function setBusy(value){
  if(value&&!busy)busyFocus=document.activeElement;
  busy=value;syncButtons();
  if(value)return;
  const held=busyFocus;busyFocus=null;
  if(held?.isConnected&&!held.disabled&&!held.closest('[inert],[hidden]')&&(!document.activeElement||document.activeElement===document.body))held.focus({preventScroll:true});
 }
 function syncPanels(){
  stepNames.forEach((name,k)=>{
   const panel=panels[k],active=k===index&&!travelling;
   panel.classList.toggle('is-current',active);
   panel.classList.toggle('is-past',k<index);
   // a step being hidden never keeps focus; inert hides it from assistive technology too (aria-hidden over focus is refused)
   const held=document.activeElement;if(!active&&held&&held!==document.body&&(held===panel||panel.contains?.(held)))held.blur?.();
   panel.inert=!active;panel.removeAttribute?.('aria-hidden');
  });
 }
 async function showStep(target,afterSave=false){
  if(target<(personal?0:1)||target>=stepNames.length||travelling||finished||(busy&&!afterSave))return;
  const previous=index;
  cancelEffects(stepNames[previous]);pauseScenes();activeScenes=[];stopMenu();leavePony();
  platePointed=plateFocused=null;paintPlateHover();
  index=target;tour.dataset.currentStep=current();
  if(target===0){
   delete tour.dataset.roomShot;
   roomReady=false;stopRoomIdle();room.hover(null);
   introLayer.hidden=false;introLayer.classList.remove('is-away');introLayer.classList.add('is-settled','is-restored');
   intro?.setT(intro.END);syncPanels();syncButtons();notice();placeIntroStart();wakeIntroIdle();
   introStart.focus({preventScroll:true});return;
  }
  travelling=true;tour.dataset.travelling='true';
  stage.classList.remove('wr-go-hover','wr-finish-hover');room.hover(null);
  syncPanels();syncButtons();notice();
  const shot=current()==='appearance'?'room':current()==='companion'?'meadow':'pc';
  tour.dataset.roomShot=shot;
  const fade=previous===0?hideIntro():Promise.resolve();
  roomReady=true;
  const move=previous===0?(reduced()?room.go('pc',{animate:false}):room.enter()):roomShot===shot?Promise.resolve():room.go(shot,{animate:!reduced()});
  roomShot=shot;wakeRoomIdle();
  try{await Promise.all([move,fade]);}
  catch{notice('The room could not move. Try again.',true);}
  if(finished)return;
  travelling=false;tour.dataset.travelling='false';
  if(current()==='appearance')renderPlates(document.documentElement.dataset.theme||'light');
  if(current()==='school')showSchoolSpotlight();
  else{schoolSpotlight=false;spotlight.hidden=schoolNote.hidden=true;}
  placeOverlays();syncPanels();syncButtons();
  stepEntrance(panels[index]);enterScenes();
  if(current()==='navigation')replayMenu();
  if(current()==='companion')enterPony();
  if(current()==='school')school.focus({preventScroll:true});
  else panels[index].querySelector('h1,h2')?.focus({preventScroll:true});
 }

 function nightScene(name,el){
  if(document.documentElement.dataset.theme==='dark')ReserveWelcomeScenes.night(el,'dark',prefData?.nightArt??0);
  else ReserveWelcomeScenes.night(el,'light');
 }
 function renderNight(){
  for(const s of scenes.values())nightScene(s.name,s.el);
  if(finishArt)nightScene('finish',finishLayer);
 }
 function renderTheme(value,chosen=false){
  const theme=value==='dark'?'dark':'light';
  const root=document.documentElement;
  const changed=root&&root.dataset.theme!==theme;
  if(changed){
   const palette=['--paper','--background','--ink','--clay','--muted','--rule','--line','--card'];
   const colors=()=>{const s=getComputedStyle(root);return Object.fromEntries(palette.map(key=>[key,s.getPropertyValue(key)]));};
   for(const [a] of effects)if(a.id==='tour-nightfall'){a.cancel();effects.delete(a);}
   // In the room the drawing itself carries the change (the night spreads from the window); animating the page palette
   // on top restyles the whole drawing every frame, so there the palette switches at once (one restyle).
   const inRoom=current()==='appearance';
   if(inRoom)root.dataset.theme=theme;
   else{
    const before=canMove()?colors():null;
    root.dataset.theme=theme;
    if(before)play(root,[before,colors()],{duration:800,scope:'global',id:'tour-nightfall'});
   }
  }
  if(changed||chosen){
   room.setTheme(theme,{animate:!reduced()&&!document.hidden&&current()==='appearance'});
   placeOverlays();
  }
  renderNight();
  for(const button of all('[data-theme-choice]')){
   const selected=button.dataset.themeChoice===theme;
   selectedTick(button,selected);
   button.classList.toggle('is-selected',selected);
   button.setAttribute('aria-pressed',String(selected));
  }
  if(current()==='appearance'&&(changed||chosen))renderPlates(theme);
  else syncPlateButtons();
 }
 function renderPet(pet){
  const p=ReservePets.clean(pet),name=p.name||'Biscuit';
  if($('companion-title').textContent!=='Meet '+name)$('companion-title').textContent='Meet '+name;
  $('pet-bubble').textContent='Hi, I’m '+name+'!';
  $('pet-enabled').checked=p.enabled!==false;
  petSwitch.classList.toggle('is-on',$('pet-enabled').checked);
  meadow.setAttribute('aria-label',name+', your pony, walking onto the page');
  const coat=ReservePetArt.COATS[p.coat]||ReservePetArt.COATS.oat;
  petNode.style.setProperty('--pet-coat',coat.coat);
  petNode.style.setProperty('--pet-shade',coat.shade);
  petNode.style.setProperty('--pet-mane',coat.mane);
  petNode.style.setProperty('--pet-muzzle',coat.muzzle);
  petNode.style.setProperty('--pet-harness',ReservePetArt.HARNESS[p.harness]||ReservePetArt.HARNESS.red);
  petNode.dataset.gear=p.gear;
  if(!petNode.firstElementChild)petNode.innerHTML=ReservePetArt.svg({title:name});
  else petNode.querySelector('svg')?.setAttribute('aria-label',name);
 }
 function applyPreferences(data){
  const latest=data||prefs?.get?.();
  if(!latest)return;
  const wasEnabled=prefData?.pet!==false;
  prefData=latest;
  const motionOff=['off','still'].includes(latest.motion);
  tour.dataset.still=String(motionOff);
  renderTheme(latest.theme);
  renderPet({enabled:latest.pet});
  syncMotion();
  if(current()==='companion'&&wasEnabled!==(latest.pet!==false))setPonyEnabled(latest.pet!==false);
 }
 async function usePreferences(){
  if(!prefs){
   prefs=ReservePagePreferences.create();
   unsub=prefs.subscribe(applyPreferences);
  }
  applyPreferences(await prefs.load());
 }
 async function saveTheme(value){
  if(busy)return;
  if(!prefs){notice('Choose your Canvas school first.',true);return;}
  const before=prefData?.theme||'light';
  let saved=false;const pickedBefore=themePicked;
  themePicked=true;
  setBusy(true);
  renderTheme(value,true);
  try{
   await prefs.set({theme:value});
   applyPreferences(prefs.get());
   notice();
   saved=true;
  }catch{
   applyPreferences(prefs.get());
   renderTheme(before);
   themePicked=pickedBefore;if(current()==='appearance')renderPlates(before);
   notice('Could not save that theme. Try again.',true);
  }finally{setBusy(false);}
  if(saved&&current()==='appearance'&&!finished)document.querySelector('[data-theme-continue="'+value+'"]')?.focus({preventScroll:true});
 }
 function renderNav(value){
  const wanted=Object.hasOwn(navNames,value)?value:'drawn';
  if(wanted===nav&&demo.dataset.layout===wanted)return;
  const before=menuRects();
  stopMenu();
  nav=wanted;
  demo.dataset.layout=nav;
  demo.setAttribute('aria-label',navNames[nav]+' menu layout preview');
  $('nav-description').textContent=navDescriptions[nav];
  for(const button of all('[data-nav-choice]')){
   const selected=button.dataset.navChoice===nav;
   selectedTick(button,selected);
   button.classList.toggle('is-selected',selected);
   button.setAttribute('aria-pressed',String(selected));
  }
  if(current()==='navigation')animateMenuLayout(before);
  replayMenu();
 }
 function replayMenu(){
  stopMenu();
  if(current()!=='navigation'||!canMove())return;
  cue('menu-repeat',650,renderMenuArt);
 }
 function stopMenu(){
  for(const [a] of effects)if(/^tour-(menu-(pointer|drawer)|nav-hover)$/.test(a.id)){a.cancel();effects.delete(a);}
  cues.delete('menu-repeat');
 }
 function menuRects(){
  const nodes=[demo.querySelector('.demo-nav-surface'),demo.querySelector('.demo-page'),demo.querySelector('.demo-nav-mark'),...demo.querySelectorAll('.demo-icon')];
  return nodes.filter(n=>n?.getBoundingClientRect).map(node=>({node,rect:node.getBoundingClientRect()}));
 }
 function animateMenuLayout(before){
  for(const {node,rect} of before){
   const after=node.getBoundingClientRect();
   if(!after.width||!after.height)continue;
   // FLIP reads both layouts once; the in-betweens only composite transforms.
   play(node,[{transformOrigin:'0 0',transform:'translate('+(rect.left-after.left)+'px,'+(rect.top-after.top)+'px) scale('+(rect.width/after.width)+','+(rect.height/after.height)+')'},{transformOrigin:'0 0',transform:'none'}],{duration:520,id:'tour-menu-layout'});
  }
 }
 function renderMenuArt(){
  if(current()!=='navigation'||!canMove())return;
  const pointer=demo.querySelector('.demo-pointer'),bar=demo.querySelector('.demo-nav'),bounds=demo.getBoundingClientRect();
  const icons=[...demo.querySelectorAll('.demo-icon')];
  const locations=icons.map(node=>{const r=node.getBoundingClientRect();return [r.left-bounds.left+r.width*.6,r.top-bounds.top+r.height*.65];});
  const frames=[{offset:0,transform:'translate('+bounds.width*.57+'px,'+bounds.height*.68+'px)',opacity:0},{offset:.06,transform:'translate('+bounds.width*.57+'px,'+bounds.height*.68+'px)',opacity:1}];
  locations.forEach(([x,y],i)=>{const at=.2+i*.115;frames.push({offset:at,transform:'translate('+x+'px,'+y+'px)',opacity:1},{offset:at+.07,transform:'translate('+x+'px,'+y+'px)',opacity:1});});
  frames.push({offset:.9,transform:'translate('+bounds.width*.57+'px,'+bounds.height*.68+'px)',opacity:1},{offset:1,transform:'translate('+bounds.width*.57+'px,'+bounds.height*.68+'px)',opacity:0});
  // Offsets are real timeline beats, shared with the icons' delayed actions.
  play(pointer,frames,{duration:7000,easing:'linear',id:'tour-menu-pointer'});
  if(nav==='drawn'){
   play(bar,[{transform:'translateX(-110%)'},{transform:'translateX(-110%)',offset:.1,easing:SETTLE},{transform:'none',offset:.2},{transform:'none',offset:.8,easing:SETTLE},{transform:'translateX(-110%)',offset:.95},{transform:'translateX(-110%)'}],{duration:7000,easing:'linear',id:'tour-menu-drawer'});
  }
  const actions={
   // The x-* rig actions and pivots are the ones in canvas-nav.css. The SVG
   // drawings are copied intact in welcome.html because canvas-nav.js's browser
   // entry point mounts Canvas's live menu rather than exporting its drawings.
   '.x-needle':[{transform:'rotate(0deg)'},{transform:'rotate(-46deg)',offset:.3},{transform:'rotate(16deg)',offset:.65},{transform:'rotate(0deg)'}],
   '.x-lean':[{transform:'rotate(0deg)'},{transform:'rotate(-9deg)',offset:.45},{transform:'rotate(0deg)'}],
   '.x-rings':[{transform:'translateY(0)'},{transform:'translateY(-2px)',offset:.4},{transform:'translateY(.5px)',offset:.7},{transform:'translateY(0)'}],
   '.x-circle':[{strokeDashoffset:1},{strokeDashoffset:1,offset:.15},{strokeDashoffset:0}],
   '.x-flag':[{transform:'rotate(80deg)'},{transform:'rotate(-8deg)',offset:.55},{transform:'none'}],
   '.x-wave':[{transform:'rotate(0deg)'},{transform:'rotate(-14deg)',offset:.3},{transform:'rotate(10deg)',offset:.65},{transform:'rotate(0deg)'}]
  };
  icons.forEach((icon,i)=>{for(const [selector,keys] of Object.entries(actions)){const part=icon.querySelector(selector);if(part)play(part,keys,{duration:selector==='.x-rings'?520:900,delay:(.2+i*.115)*7000,easing:'ease-in-out',id:'tour-nav-hover'});}});
  cue('menu-repeat',10000,renderMenuArt);
 }
 async function saveNav(value){
  if(busy||!Object.hasOwn(navNames,value))return;
  const before=nav;
  renderNav(value);
  setBusy(true);
  try{
   await chrome.storage.local.set({'reserve:canvasNav':value});
   notice();
  }catch{
   renderNav(before);
   notice('Could not save that menu layout. Try again.',true);
  }finally{setBusy(false);}
 }
 async function savePet(value){
  if(busy||!prefs){notice('Choose your Canvas school first.',true);return;}
  const input=$('pet-enabled'),focused=document.activeElement===input,before=prefData?.pet!==false;
  setBusy(true);
  try{
   await prefs.set({pet:value});
   applyPreferences(prefs.get());
   notice();
  }catch{
   applyPreferences(prefs.get());
   $('pet-enabled').checked=before;
   petSwitch.classList.toggle('is-on',before);
   notice('Could not save your pony setting. Try again.',true);
  }finally{
   setBusy(false);
   if(focused&&!finished&&current()==='companion')input.focus({preventScroll:true});
  }
 }
 function leavePony(){
  ponyWalk=null;
  $('pet-actor').style.transition='none';
  $('pet-actor').style.filter='';
  for(const key of ['pony-arrived','pony-cheer','pony-rest','pony-exit'])cues.delete(key);
  meadow.classList.remove('is-arriving','is-arrived','is-off');
  petNode.dataset.pose='stand';
  resetRig();
 }
 function enterPony(){
  leavePony();
  placeOverlays();
  if(prefData?.pet===false||!canMove()){settlePony();return;}
  setPonyEnabled(true);
 }
 function rigParts(){
  if(ponyRig)return ponyRig;
  const q=s=>petNode.querySelector(s),qa=s=>[...petNode.querySelectorAll(s)];
  return ponyRig={up:q('.pet-up'),neck:q('.pet-neck'),head:q('.pet-head'),a:qa('.pet-leg.lf,.pet-leg.lh2'),b:qa('.pet-leg.lh,.pet-leg.lf2'),legs:qa('.pet-legs'),tuck:qa('.pet-tuck,.pet-tuck2')};
 }
 function resetRig(){
  const p=rigParts();
  for(const node of [p.up,p.neck,p.head,...p.a,...p.b])if(node)node.style.transform='';
  for(const node of p.legs)node.style.opacity='1';
  for(const node of p.tuck)node.style.opacity='0';
 }
 function paintPony(){
  if(!ponyWalk)return;
  const t=Math.max(0,filmTime-ponyWalk.start),phase=t/520*Math.PI*2;
  const ramp=Math.min(1,t/160,Math.max(0,(ponyWalk.duration-t)/180));
  const leg=Math.sin(phase)*22*ramp,bob=-Math.abs(Math.sin(phase))*22*.055*ramp,p=rigParts();
  if(p.up)p.up.style.transform='translateY('+bob.toFixed(2)+'px)';
  if(p.neck)p.neck.style.transform='rotate('+(9+leg*.12).toFixed(2)+'deg)';
  if(p.head)p.head.style.transform='rotate(0deg)';
  for(const n of p.a)n.style.transform='rotate('+leg.toFixed(2)+'deg) scaleY(1)';
  for(const n of p.b)n.style.transform='rotate('+(-leg).toFixed(2)+'deg) scaleY(1)';
  for(const n of p.legs)n.style.opacity='1';
  for(const n of p.tuck)n.style.opacity='0';
 }
 function settlePony(){
  ponyWalk=null;resetRig();petNode.dataset.pose='stand';
  const enabled=prefData?.pet!==false;
  meadow.classList.remove('is-arriving');meadow.classList.toggle('is-arrived',enabled);meadow.classList.toggle('is-off',!enabled);
  $('pet-actor').style.transform=enabled?'none':'translateX(65vw)';
  $('pet-actor').style.filter=room.ponyLight(enabled);
 }
 function setPonyEnabled(enabled){
  const actor=$('pet-actor'),bounds=meadow.getBoundingClientRect?.();
  const walking=!!ponyWalk;
  const box=actor.getBoundingClientRect?.();
  const interrupted=walking&&box?box.left-parseFloat(actor.style.left):null;
  for(const [a,e] of effects)if(e.node?.closest?.('#pet-actor')||/^tour-(pony|bubble)/.test(a.id)){a.cancel();effects.delete(a);}
  for(const key of ['pony-arrived','pony-cheer','pony-rest','pony-exit'])cues.delete(key);
  ponyWalk=null;resetRig();
  if(!canMove()){settlePony();return;}
  const w=bounds.width;
  const from=interrupted??(enabled?-w*.65:0),to=enabled?0:w*.65,delay=enabled?0:500,duration=enabled?1900:1500;
  // Start in the dark immediately; sample the filter on the same clock as the walk.
  actor.style.transition='none';
  actor.style.filter=room.ponyLight(!enabled);
  const fromLight=actor.style.filter,toLight=room.ponyLight(enabled);
  actor.style.filter=toLight;
  play(actor,[{filter:fromLight},{filter:toLight}],{duration,delay,easing:enabled?'ease-in':'ease-out',id:'tour-pony-light'});
  meadow.classList.remove('is-arrived','is-off');meadow.classList.add('is-arriving');
  actor.style.transform='translateX('+to+'px)';
  play(actor,[{transform:'translateX('+from+'px)'},{transform:'translateX('+to+'px)'}],{duration,delay,easing:'linear',id:'tour-pony-travel'});
  if(!enabled)play(rigParts().head,[{transform:'rotate(0deg)'},{transform:'rotate(18deg)',offset:.45},{transform:'rotate(0deg)'}],{duration:480,id:'tour-pony-wave'});
  petNode.dataset.pose=enabled?'walk':'stand';
  cue('pony-exit',delay,()=>{petNode.dataset.pose='trot';ponyWalk={start:filmTime,duration};captureCSS();});
  cue('pony-arrived',delay+duration,()=>{
   settlePony();
   if(enabled){
    play(rigParts().neck,[{transform:'rotate(9deg)'},{transform:'rotate(-5deg)',offset:.6},{transform:'rotate(9deg)'}],{duration:900,id:'tour-pony-look'});
    play(rigParts().head,[{transform:'rotate(0deg)'},{transform:'rotate(-8deg)',offset:.6},{transform:'rotate(0deg)'}],{duration:900,id:'tour-pony-look'});
    drawPen(document.querySelector('.bubble-outline path'),650);
    cue('pony-cheer',1100,()=>{
     petNode.dataset.pose='cheer';resetRig();captureCSS();
     cue('pony-rest',1320,()=>{petNode.dataset.pose='stand';captureCSS();});
    });
   }
   captureCSS();
  });
  captureCSS();
 }
 function releaseOpen(){
  clearTimeout(openTimer);openTimer=0;
  const resolve=openResolve;openResolve=null;resolve?.();
 }
 function stopFinish(){
  cancelAnimationFrame(finishFrame);finishFrame=0;
  clearTimeout(stampTimer);clearTimeout(stampReset);stampTimer=0;stampReset=0;
  finishBoard.classList.remove('is-stamped');finishLayer.hidden=true;releaseOpen();
 }
 function tickFinish(now){
  finishFrame=0;
  if(reduced()){stopFinish();return;}
  if(now-finishDraw>=1000/60-1e-7){
   finishDraw=now;
   const t=Math.min(Math.max(0,now-finishWall)/1000,finishArt.END);
   finishArt.setT(t);
   if(t>=finishArt.END){stopFinish();return;}
  }
  finishFrame=requestAnimationFrame(tickFinish);
 }
 function startFinish(){
  stopFinish();
  if(reduced())return;
  finishWall=clockNow();finishDraw=finishWall;finishLayer.hidden=false;
  try{
   finishArt=finishArt||ReserveWelcomeScenes.finish.mount(finishLayer);
   nightScene('finish',finishLayer);
   const box=finishBoard.getBoundingClientRect();
   finishArt.fire(box.left+box.width/2,box.top);finishArt.setT(0);
  }catch{stopFinish();return;}
  stampTimer=setTimeout(()=>{
   stampTimer=0;finishBoard.classList.add('is-stamped');
   stampReset=setTimeout(()=>{stampReset=0;finishBoard.classList.remove('is-stamped');},220);
  },Math.max(0,260-(clockNow()-finishWall)));
  finishFrame=requestAnimationFrame(tickFinish);
  // Permission and script registration may take time; count this pause from the click.
  return async()=>{
   if(reduced()||finishLayer.hidden)return;
   const remaining=1500-(clockNow()-finishWall);
   if(remaining<=0)return;
   return new Promise(resolve=>{openResolve=resolve;openTimer=setTimeout(releaseOpen,remaining);});
  };
 }

 function invalidSchool(message){
  if(!schoolSpotlight)showSchoolSpotlight();
  school.setAttribute('aria-invalid','true');
  notice(message,true);
  setBusy(false);school.focus();
 }
 // This function is intentionally synchronous through permissions.request. A browser
 // permission dialog must be initiated in the same click, before any await.
 function nextFromSchool(){
  if(busy||travelling||current()!=='school'||!schoolSpotlight)return;
  schoolTouched=true;setBusy(true);
  // Keep ReserveSchool's validation and user-gesture permission timing. The
  // deferred open approves this school now and leaves the tour in this tab.
  ReserveSchool.open(school.value,{defer:true,onAsk:host=>notice('Your browser will ask to allow '+host+'.')}).then(async result=>{
   if(!result.ok){invalidSchool(result.message);return;}
   school.removeAttribute('aria-invalid');
   validatedOrigin=result.origin;school.value=result.origin;school.readOnly=true;
   const loading=$('address-loading');loading.hidden=false;
   play(loading,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:300,id:'tour-address-loading'});
   await Promise.all([usePreferences(),wait(300,true),clearSchoolSpotlight()]);loading.hidden=true;
   if(!finished)await showStep(index+1,true);
  }).catch(error=>invalidSchool(error?.message||'Could not save the school address. Try again.')).finally(()=>setBusy(false));
 }
 function finish(){
  if(busy||travelling||finished)return;
  const origin=validOrigin(validatedOrigin);
  if(!origin){notice('Choose your Canvas school first.',true);return;}
  setBusy(true);
  const beforeOpen=startFinish();
  // The school helper waits for registered scripts before opening the approved origin.
  ReserveSchool.open(origin,{
   beforeOpen,
   onAsk:host=>notice('Your browser will ask for access to '+host+'.')
  }).then(result=>{
   if(!result.ok){stopFinish();notice(result.message||'Could not open Canvas.',true);}
   else{
    notice(result.message||'Opening Canvas…');
    finished=true;tour.dataset.finished='true';syncMotion();
   }
  }).catch(error=>{
   stopFinish();
   notice(error?.message||'Could not open Canvas. Check the address and try again.',true);
  }).finally(()=>setBusy(false));
 }
 function forward(){
  if(tour.dataset.opening==='true'){skipOpening();return;}
  if(busy||travelling||finished)return;
  if(current()==='school'){nextFromSchool();return;}
  if(index===stepNames.length-1){finish();return;}
  if(current()==='intro'&&personal&&!validatedOrigin){
   notice('Could not find your Canvas school. Open the extension’s settings to set it.',true);
   return;
  }
  showStep(index+1);
 }

 next.addEventListener('click',forward);
 introStart.addEventListener('click',forward);
 introStart.addEventListener('pointerenter',()=>{introPointed=true;hoverIntro();});
 introStart.addEventListener('pointerleave',()=>{introPointed=false;hoverIntro();});
 introStart.addEventListener('focus',()=>{introFocused=true;hoverIntro();});
 introStart.addEventListener('blur',()=>{introFocused=false;hoverIntro();});
 back.addEventListener('click',()=>{if(index>1||(personal&&index===1))showStep(index-1);});
 finishBoard.addEventListener('click',finish);
 schoolGo.addEventListener('click',event=>{event.preventDefault();nextFromSchool();});
 boardHover(schoolGo,'wr-go-hover');boardHover(finishBoard,'wr-finish-hover');
 $('school-form').addEventListener('submit',event=>{event.preventDefault();if(!busy)nextFromSchool();});
 school.addEventListener('input',()=>{schoolTouched=true;school.removeAttribute('aria-invalid');notice();});
 for(const button of all('[data-theme-choice]')){
  let pointed=false,focused=false;
  const paint=()=>room.hover(pointed||focused?button.dataset.themeChoice:null);
  button.addEventListener('pointerenter',()=>{pointed=true;paint();});
  button.addEventListener('pointerleave',()=>{pointed=false;paint();});
  button.addEventListener('focus',()=>{focused=true;paint();});
  button.addEventListener('blur',()=>{focused=false;paint();});
  button.addEventListener('click',()=>saveTheme(button.dataset.themeChoice));
 }
 for(const button of all('[data-theme-continue]')){
  button.addEventListener('pointerenter',()=>{platePointed=button;paintPlateHover();});
  button.addEventListener('pointerleave',()=>{if(platePointed===button)platePointed=null;paintPlateHover();});
  button.addEventListener('focus',()=>{plateFocused=button;paintPlateHover();});
  button.addEventListener('blur',()=>{if(plateFocused===button)plateFocused=null;paintPlateHover();});
  button.addEventListener('click',()=>{if(!button.disabled&&!button.hidden&&!button.inert&&current()==='appearance')forward();});
 }
 for(const button of all('[data-nav-choice]'))button.addEventListener('click',()=>saveNav(button.dataset.navChoice));
 $('pet-enabled').addEventListener('change',event=>{petSwitch.classList.toggle('is-on',event.target.checked);savePet(event.target.checked);});
 let skipClick=false;
 document.addEventListener('keydown',event=>{
  skipClick=false;
  if(tour.dataset.opening==='true'){
   event.preventDefault();event.stopImmediatePropagation?.();skipOpening();return;
  }
  if(travelling||finished||event.defaultPrevented||event.repeat||event.altKey||event.metaKey||event.ctrlKey)return;
  if(event.target.closest?.('button,input,textarea,select,[contenteditable]'))return;
  if(event.key==='ArrowLeft'||event.key==='PageUp'){
   if(index>1||(personal&&index===1)){event.preventDefault();showStep(index-1);}
  }else if(event.key==='ArrowRight'||event.key==='PageDown'){
   event.preventDefault();forward();
  }
 },true);
 document.addEventListener('pointerdown',event=>{
  skipClick=false;
  if(tour.dataset.opening==='true'){
   event.preventDefault();event.stopImmediatePropagation?.();skipClick=event.button===undefined||event.button===0;skipOpening();
  }
 },true);
 document.addEventListener('pointercancel',()=>{skipClick=false;},true);
 document.addEventListener('click',event=>{
  if(skipClick||tour.dataset.opening==='true'){
   event.preventDefault();event.stopImmediatePropagation?.();skipClick=false;skipOpening();
  }
 },true);
 document.addEventListener('visibilitychange',syncMotion);
 window.addEventListener('resize',resizeIntro);
 const storedChanged=(changes,area)=>{
  if(area==='local'&&changes['reserve:canvasNav'])renderNav(changes['reserve:canvasNav'].newValue);
 };
 chrome.storage.onChanged?.addListener(storedChanged);
 stillMedia?.addEventListener?.('change',syncMotion);
 window.addEventListener('pagehide',()=>{
  stopFinish();
  finished=true;stopRoomIdle();room.hover(null);pauseOpening();stopIntroIdle();syncScenes();
  for(const [id,resolve] of delays){clearTimeout(id);resolve();}delays.clear();clearTimeout(filmTimer);filmTimer=0;cancelEffects();ponyWalk=null;
  window.removeEventListener('resize',resizeIntro);
  document.removeEventListener?.('visibilitychange',syncMotion);
  stillMedia?.removeEventListener?.('change',syncMotion);
  unsub?.();prefs?.destroy();
  chrome.storage.onChanged?.removeListener(storedChanged);
 },{once:true});

 syncButtons();
 renderPet(ReservePets.DEFAULTS);
 decorateControls();
 tour.dataset.currentStep=current();
 startOpening();
 Promise.resolve().then(async()=>{
  try{await usePreferences();}
  finally{motionReady=true;syncMotion();}
  const savedNav=await chrome.storage.local.get('reserve:canvasNav');
  renderNav(savedNav['reserve:canvasNav']);
  await ReserveSchool.list();
  const saved=await ReserveSchool.saved();
  if(!personal){
   if(!schoolTouched)school.value=saved||'';
  }else{
   const origin=validOrigin(saved)||validOrigin(ReserveSite.origin());
   if(origin){validatedOrigin=origin;school.value=origin;school.readOnly=true;}
   else notice('Could not find a valid HTTPS Canvas address. Open the extension’s settings.',true);
  }
 }).catch(error=>{
  notice(error?.message||'The tour could not load your settings. Reopen it and try again.',true);
 });
})();
