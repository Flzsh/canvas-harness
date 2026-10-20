/* Canvas Harness companion: where the pony goes and what it does. It walks along the tops of the panels and the
   bottom of the window, rests, can be picked up and set down, and helps with the day: it tells you what is next,
   studies beside a running timer, and is pleased when work is finished. It never scolds and nothing is lost by
   ignoring it. Only the student's own preferences and counters are stored. Creator: Flzsh. */
(function(root){
 'use strict';
 const DEFAULTS={enabled:true,name:'Biscuit',coat:'oat',harness:'red',gear:'full',roam:'page',size:'medium',nudges:'helpful',treats:1,fed:0,xp:0,streakDay:'',streak:0,best:0,told:''};
 const SIZES={small:46,medium:58,large:74};
 const ROAM=['page','home','off'],NUDGES=['helpful','quiet','off'],GEAR=['full','collar','none'];
 // What a level needs, and what it opens. Levels only go up.
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
  if(typeof v.name==='string'&&v.name.trim())out.name=v.name.trim().slice(0,24);
  if(art?.COATS[v.coat])out.coat=v.coat;if(art?.HARNESS[v.harness])out.harness=v.harness;
  if(GEAR.includes(v.gear))out.gear=v.gear;if(ROAM.includes(v.roam))out.roam=v.roam;if(SIZES[v.size])out.size=v.size;if(NUDGES.includes(v.nudges))out.nudges=v.nudges;
  out.treats=v.treats===undefined?DEFAULTS.treats:int(v.treats,99);out.fed=int(v.fed,1e6);out.xp=int(v.xp,1e6);out.streak=int(v.streak,10000);out.best=Math.max(out.streak,int(v.best,10000));
  if(typeof v.streakDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.streakDay))out.streakDay=v.streakDay;
  if(typeof v.told==='string')out.told=v.told.slice(0,140);
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

 // How the pony moves. Everything that changes over time is a number eased every frame, so there is no cut between
 // resting and walking: speed builds and falls away, the legs' swing grows with the speed, the body sinks when it
 // lies down and rises before it walks, and the neck swings to wherever the pose wants it.
 const POSE={stand:{down:0,neck:9,head:0},flag:{down:0,neck:6,head:-2},lie:{down:11.5,neck:10,head:0},sleep:{down:11.5,neck:44,head:18},read:{down:11.5,neck:29,head:14},eat:{down:0,neck:60,head:22}};
 function create({container,getPet,savePet,info=()=>({}),actions={},now=()=>Date.now()}){
  if(root.ReserveSite?.vanillaPage(root.location))return null;
  const doc=container.ownerDocument||root.document,win=doc.defaultView||root,art=root.ReservePetArt,E=value=>root.ReserveUI?.escapeHTML?root.ReserveUI.escapeHTML(value):String(value).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
  let pet=clean(getPet()),layer=null,node=null,bubble=null,dead=false,film=0,timer=0,last=0,next=0,debt=0,stepping=false,pose='stand',face='right';
  let spot={ledge:null,u:160},grab=null,releaseGrab=null,menuOpen=false,focusing=false,quietUntil=0,lastInput=now(),sayTimer=0,unseen=0;
  // what it is doing: null (resting), a walk, or a jump; and the eased numbers
  let goal=null,rest='stand',speed=0,phase=0,follow=0,reel=0;const ch={leg:0,down:0,neck:9,head:0,alpha:1};
  const FILM=1000/24,STEP=1/60,watched=new Set();let geometry=null,dirty=true,layoutFrame=0,layoutTimer=0,layoutVersion=0,resizeWatch=null,layoutWatch=null,life=0,decisionPending=false,layoutAnimations=new WeakSet(),bubbleBox={w:250,h:120};
  const filmNow=()=>win.performance?.now?.()??now();
  const reduced=()=>['off','still'].includes(container.dataset.motionStyle)||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const size=()=>SIZES[pet.size]||SIZES.medium;
  const visible=()=>pet.enabled&&pet.roam!=='off';
  function mount(){
   if(layer||dead)return;
   layer=doc.createElement('div');layer.className='pet-layer';
   layer.innerHTML=`<button type="button" class="pet" data-pose="stand" data-face="right" aria-haspopup="menu" aria-expanded="false"></button>`;
   container.append(layer);node=layer.firstElementChild;node.innerHTML=art.svg({title:pet.name});
   node.addEventListener('pointerdown',down);node.addEventListener('click',click);node.addEventListener('keydown',key);
    for(const type of ['animationstart','animationcancel'])node.addEventListener(type,resetReels);
   win.addEventListener('scroll',invalidate,{passive:true,capture:true});win.addEventListener('resize',invalidate,{passive:true});
   container.addEventListener('scroll',invalidate,{passive:true,capture:true});   // the workspace column scrolls inside the workspace
   for(const type of ['load','transitionrun','transitionend','transitioncancel','animationend','animationcancel'])container.addEventListener(type,invalidate,{passive:true,capture:true});
   doc.fonts?.addEventListener?.('loadingdone',invalidate);
   const mounted=++life;
   if(win.ResizeObserver)resizeWatch=new win.ResizeObserver(()=>{if(mounted===life)invalidate();});
    if(win.MutationObserver){layoutWatch=new win.MutationObserver(records=>{if(mounted!==life)return;for(const r of records)if(node?.contains(r.target)){if(r.type==='childList'){rig=null;resetReels();}else if(r.type==='attributes'&&['class','data-pose','data-face','data-lying','data-still','data-gear'].includes(r.attributeName))resetReels();}if(records.some(r=>!layer?.contains(r.target)&&!(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].length&&[...r.addedNodes,...r.removedNodes].every(n=>n===layer||layer?.contains(n)))))invalidate();});layoutWatch.observe(container,{subtree:true,childList:true,attributes:true,characterData:true});for(let p=container.parentElement||container.getRootNode?.().host;p;p=p.parentElement)layoutWatch.observe(p,{attributes:true});}
   doc.addEventListener('pointermove',seen,{passive:true});doc.addEventListener('keydown',seen,{passive:true});
   doc.addEventListener('visibilitychange',wake);
   // Modules move when the layout changes; keep the pony on the one it is standing on.
   follow=setInterval(followPlace,500);
   dress();home();place();paint();plan(1400);roll();
  }
  function unmount(){
   if(!layer)return;closeBubble();stop();clearTimeout(node._cheer);releaseGrab?.();grab=null;goal=null;speed=0;life++;
   node.removeEventListener('pointerdown',down);node.removeEventListener('click',click);node.removeEventListener('keydown',key);
    for(const type of ['animationstart','animationcancel'])node.removeEventListener(type,resetReels);
    cancelPlaces();resizeWatch?.disconnect();layoutWatch?.disconnect();resizeWatch=layoutWatch=null;watched.clear();layoutAnimations=new WeakSet();geometry=null;dirty=true;rig=null;
   win.removeEventListener('scroll',invalidate,{capture:true});container.removeEventListener('scroll',invalidate,{capture:true});win.removeEventListener('resize',invalidate);
   for(const type of ['load','transitionrun','transitionend','transitioncancel','animationend','animationcancel'])container.removeEventListener(type,invalidate,{capture:true});
   doc.fonts?.removeEventListener?.('loadingdone',invalidate);
   doc.removeEventListener('pointermove',seen);doc.removeEventListener('keydown',seen);doc.removeEventListener('visibilitychange',wake);
    clearInterval(follow);follow=0;clearTimeout(reel);reel=0;reels.clear();resetReels();layer.remove();layer=node=null;
  }
  function seen(){lastInput=now();if(!reel&&layer&&!doc.hidden)roll();if(rest==='sleep'&&!goal&&!menuOpen)settle('lie',4000);}
  function wake(){if(doc.hidden){stop();clearTimeout(reel);reel=0;cancelPlaces();releaseGrab?.();if(grab){grab=null;goal=null;speed=0;node.dataset.grabbed='false';setPose('stand');}return;}if(layer){invalidate();resetReels();run();if(!goal)plan(900);roll();}}
  // THE PONY ON THE FILM CLOCK. Its little loops (the tail, the nod, the blink, breathing, the Zs) are CSS animations.
  // Left to run, each one makes Chrome draw the whole page at the screen's own rate (60 to 240 times a second: on a
  // battery that was most of an idle page's cost) to move a few pixels. Like the drawings (motion.js), they are paused
  // and set to the film's time instead: 24 frames a second while someone uses the page, 12 after, none while the tab is
  // hidden. A loop between two keyframes that say the same thing (a blink's long open stretch) is not written at all.
  // Only endless loops: a short one (a hop, the book appearing) plays as written. Reduced motion has none.
  const reels=new Map();let reelsDirty=true;
  function resetReels(){reelsDirty=true;}
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
   clearTimeout(reel);reel=0;if(!node||dead||doc.hidden)return;
    const t=now();
   // every state is read before any time is written, so Chrome restyles once a frame, not once a loop
    if(reelsDirty){
     reelsDirty=false;let list=[];try{list=node.getAnimations?.({subtree:true})||[];}catch{reelsDirty=true;}
     const live=new Set();
     for(const a of list){
      if(!a.animationName||a.playState==='idle'||a.playState==='finished'||a.effect?.getTiming?.().iterations!==Infinity)continue;
      live.add(a);if(!reels.has(a)){try{a.pause();}catch{continue;}reels.set(a,{origin:t-(+a.currentTime||0),rests:restsOf(a),rest:-1});}
     }
     for(const a of [...reels.keys()])if(!live.has(a))reels.delete(a);
   }
    for(const a of reels.keys()){const state=a.playState;if(state==='idle'||state==='finished')reels.delete(a);}
   for(const [a,r] of reels){
    const time=Math.max(0,t-r.origin);let at=-1;
    if(r.rests){const local=time-r.rests.delay;if(local>=0){const p=(local/r.rests.duration)%1;at=r.rests.list.findIndex(h=>p>=h[0]&&p<h[1]);}}
    if(at<0||at!==r.rest){try{a.currentTime=time;}catch{}}
    r.rest=at;
   }
   // 24 a second while the page is used, 12 after, 6 in the idle rest (a sleeping pony's breathing is slow), and after
   // two minutes without input it holds where it is until the next input (seen()), so an open page costs nothing.
   const quiet=now()-lastInput;if(quiet>=120000)return;
   reel=setTimeout(roll,1000/(quiet<6000?24:quiet<25000?12:6));reel?.unref?.();
  }
  function dress(){
   if(!node)return;const c=art.COATS[pet.coat]||art.COATS.oat;
   node.style.setProperty('--pet-coat',c.coat);node.style.setProperty('--pet-shade',c.shade);node.style.setProperty('--pet-mane',c.mane);node.style.setProperty('--pet-muzzle',c.muzzle);
   node.style.setProperty('--pet-harness',art.HARNESS[pet.harness]||art.HARNESS.red);node.style.setProperty('--pet-size',size()+'px');
    if(node.dataset.gear!==pet.gear){node.dataset.gear=pet.gear;resetReels();}node.setAttribute('aria-label',`${pet.name}, your pony. Open ${pet.name}'s menu`);
    const still=String(reduced());if(node.dataset.still!==still){node.dataset.still=still;resetReels();}
  }
  function setPose(value,facing){if(!node)return;pose=value;if(facing)face=facing;if(stepping)return;if(node.dataset.pose!==pose){node.dataset.pose=pose;resetReels();}if(node.dataset.face!==face){node.dataset.face=face;resetReels();}}
  // ---- places to stand: the top edge of every module, inside the paddock, and the bottom of the window
  // A snapshot is measured on external changes and before decisions, never by a movement/easing frame. Keep the same drawn
  // outlines and hit tests; caching the rectangles must not turn words, controls, or unruled modules into ground.
  let sides=new WeakMap();const drawn=color=>!!color&&color!=='transparent'&&!/,\s*0\)$/.test(color);
  const framed=()=>container.dataset.panelFrame!=='none';
  function measurePlaces(){
   const width=win.innerWidth,height=win.innerHeight,rects=new Map(),places=new Map(),out=[];sides=new WeakMap();
   const rect=el=>{if(!rects.has(el))rects.set(el,el.getBoundingClientRect());return rects.get(el);};
   const floor={el:null,y:height-5,x0:14,x1:width-14,floor:true,shown:true};
   const read=el=>{
    if(!el)return floor;if(places.has(el))return places.get(el);if(!el.isConnected)return null;
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
    const top=parseFloat(cs.borderTopWidth)>0&&cs.borderTopStyle!=='none'&&drawn(cs.borderTopColor),bottom=parseFloat(cs.borderBottomWidth)>0&&cs.borderBottomStyle!=='none'&&drawn(cs.borderBottomColor);
    if(!top&&!bottom)continue;
    sides.set(el,top?'top':'bottom');places.delete(el);add(el);found++;
   }
   out.push(floor);read(spot.ledge);if(goal?.type==='jump')read(goal.target.el);
   geometry={width,height,rects,places,all:out,floor};dirty=false;
   if(resizeWatch){const live=new Set([container,...rects.keys(),...(bubble?[bubble]:[])]);for(const el of watched)if(!live.has(el)){resizeWatch.unobserve(el);watched.delete(el);}for(const el of live)if(!watched.has(el)){resizeWatch.observe(el);watched.add(el);}}
   const checked=new Set(),mounted=life;
   for(const el of rects.keys())for(let p=el;p&&!checked.has(p);p=p.parentElement||p.getRootNode?.().host){checked.add(p);for(const a of p.getAnimations?.()||[]){
    if(a.playState==='idle'||a.playState==='finished'||a.effect?.getTiming?.().iterations===Infinity)continue;const done=a.finished;if(!done?.then||layoutAnimations.has(done))continue;layoutAnimations.add(done);const settled=()=>{if(mounted===life)invalidate();};done.then(settled,settled);
   }}
   measureBubble();
  }
  function ledgeFor(el){return el?(el.isConnected?geometry?.places.get(el)||null:null):geometry?.floor||null;}
  function ledges(){if(!geometry)measurePlaces();else if(dirty)invalidate();return geometry.all;}
  function cancelPlaces(){decisionPending=false;layoutVersion++;if(layoutFrame){if(win.requestAnimationFrame)win.cancelAnimationFrame?.(layoutFrame);else clearTimeout(layoutFrame);}clearTimeout(layoutTimer);layoutFrame=layoutTimer=0;}
  // Let the changed click frame paint before reading its layout. Decisions and movement keep using the snapshot.
  function invalidate(event){if(!node||dead||layer?.contains(event?.target))return;dirty=true;if(doc.hidden||layoutFrame||layoutTimer)return;const version=++layoutVersion,afterFrame=()=>{if(version!==layoutVersion||!node||dead||doc.hidden)return;layoutFrame=0;layoutTimer=setTimeout(()=>{if(version===layoutVersion)refreshPlaces();},0);};layoutFrame=win.requestAnimationFrame?win.requestAnimationFrame(afterFrame):setTimeout(afterFrame,16);}
  function refreshPlaces(){clearTimeout(layoutTimer);layoutTimer=0;if(!node||dead||doc.hidden)return;measurePlaces();if(decisionPending){decisionPending=false;decide(true);}if(!grab&&!goal&&Number.isFinite(node._x)&&Number.isFinite(node._y)){const here=current();if(!free(here,spot.u))moveOff(here);}place();if(bubble)placeBubble();}
  function followPlace(){
    if(!node||grab||doc.hidden||layoutFrame||layoutTimer)return;if(!resizeWatch||!layoutWatch){invalidate();return;}if(film||!spot.ledge)return;
   const r=spot.ledge.getBoundingClientRect(),old=geometry?.rects.get(spot.ledge);if(!spot.ledge.isConnected||!old||['left','top','right','bottom'].some(k=>r[k]!==old[k]))invalidate();
  }
  const current=()=>ledgeFor(spot.ledge)||ledgeFor(null);
  // A SPOT IS FREE when nothing the student reads or uses is under the pony's body there: no words, no button, link or
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
   if(!l)return false;const s=size(),h=s*64/72,x=l.x0+u;
   if(x-s*.4<4||x+s*.4>win.innerWidth-4)return false;
   for(const dx of [-.34,0,.34])for(const dy of [.22,.55,.85])if(busy(x+dx*s,l.y-dy*h))return false;
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
  // The pony stays on the thing it stands on, wherever that scrolls to.
  function place(){
   if(!node||grab||goal?.type==='jump')return;
   let l=ledgeFor(spot.ledge);
   if(!l){l=ledgeFor(null);spot={ledge:null,u:clamp(spot.u,20,l.x1-l.x0-20)};}
   spot.u=clamp(spot.u,6,Math.max(6,l.x1-l.x0-6));
   moveTo(l.x0+spot.u,l.y);
  }
  function moveTo(x,y){if(!node)return;node._x=x;node._y=y;if(stepping)return;const s=size(),h=s*64/72,value=`translate(${(x-s/2).toFixed(1)}px,${(y-h*60/64).toFixed(1)}px)`;if(node.style.transform!==value)node.style.transform=value;if(bubble)placeBubble();}
  // The pose is written onto the few parts that move, and only when a value changed. (Setting the numbers as
  // variables on the pony instead would restyle every shape of the drawing on every frame.)
  let rig=null;
  function parts(){
   if(rig&&rig.of===node)return rig;
   const q=sel=>node.querySelector(sel),all=sel=>[...node.querySelectorAll(sel)];
   return rig={of:node,up:q('.pet-up'),neck:q('.pet-neck'),head:q('.pet-head'),a:all('.pet-leg.lf,.pet-leg.lh2'),b:all('.pet-leg.lh,.pet-leg.lf2'),legs:all('.pet-legs'),tuck:all('.pet-tuck,.pet-tuck2'),shadow:q('.pet-shadow'),last:new Map()};
  }
  function put(el,prop,value){if(!el)return;const seen=rig.last.get(el)||rig.last.set(el,{}).get(el);if(seen[prop]!==value){seen[prop]=value;el.style[prop]=value;}}
  function paint(){
   if(!node)return;const p=parts(),leg=Math.sin(phase)*ch.leg,down=ch.down,bob=-Math.abs(Math.sin(phase))*ch.leg*.055;
   const neck=ch.neck+(pose==='eat'?Math.sin(phase*2.4)*2.5:leg*.12),fold=(1-down/14.6).toFixed(3);
   // in the air, held, or cheering, the stylesheet poses the legs and shadow itself
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
  function run(){if(!stepping&&!film&&node&&!dead&&!doc.hidden){last=filmNow();next=last+FILM;debt=0;film=setTimeout(frame,FILM);}}
  function plan(delay){clearTimeout(timer);timer=setTimeout(decide,delay);}
  function settle(as,ms){goal=null;rest=as;setPose(as);run();plan(ms);}
  function decide(measured=false){
   timer=0;if(!node||dead)return;
   if(doc.hidden)return;
   if(menuOpen||grab||goal){plan(2500);return;}
    if(dirty){decisionPending=true;invalidate();return;}if(!measured)measurePlaces();const data=info(),idle=now()-lastInput,here=current();
   if(reduced()){settle(nudge(data),30000);return;}
   if(focusing){settle('read',20000);return;}
   // its place has scrolled away or gone: come back to somewhere in view, quietly
   const gone=here.el&&!framed()&&!sides.has(here.el)&&here.el.matches?.('.rd-main > [data-arrange-key]');
   if(!here.shown||gone||!here.el&&pet.roam==='home'){
    const all=ledges(),to=pet.roam==='home'?all.find(l=>l.paddock):all.filter(l=>!l.paddock&&!l.floor)[0]||all[all.length-1];
    if(to&&(to.el!==here.el)){if(here.shown)jumpTo(to);else appear(to);return;}
   }
   if(idle>25000){settle('sleep',30000);return;}   // the same idle rest as the drawings (motion.js)
   // standing on something the student reads or uses (a list refreshed under it): step off it first
   if(!free(here,spot.u)){moveOff(here);return;}
   // while someone is scrolling or typing, it keeps still: a walk then only draws the eye
   if(idle<2500){settle(rest==='lie'?'lie':nudge(data),4000+Math.random()*4000);return;}
   // Calmer than it was (walks were 40% of choices): mostly resting, a short walk now and then.
   const roll=Math.random();
   if(roll<.2)walk();
   else if(roll<.25&&pet.roam==='page'){const near=ledges().filter(l=>l.el!==here.el&&!l.paddock&&Math.abs(l.y-here.y)<360&&l.x0<node._x+420&&l.x1>node._x-420);const to=near[Math.floor(Math.random()*near.length)];if(to)jumpTo(to);else walk();}
   else if(roll<.7)settle('lie',14000+Math.random()*18000);
   else settle(nudge(data),8000+Math.random()*10000);
  }
  // A due item is carried as a small flag, not announced, unless reminders are fully on.
  function nudge(data){return pet.nudges!=='off'&&data.next?.urgent&&now()>quietUntil?'flag':'stand';}
  // Off whatever it is standing on: the nearest free place on this ledge, else a free place on another one in view.
  function moveOff(here){
   const u=freeOn(here,spot.u);if(u!=null){if(reduced()){spot.u=u;return;}goal={type:'walk',to:u,max:26};rest='stand';run();return;}
   const other=ledges().find(l=>l.el!==here.el&&!l.floor&&freeOn(l)!=null)||ledgeFor(null);jumpTo(other);
  }
  function walk(){
   const l=current(),span=l.x1-l.x0;if(span<70){settle('stand',4000);return;}
   const to=freeOn(l);if(to==null){settle('stand',6000);return;}
   if(Math.abs(to-spot.u)<36){settle('stand',3500);return;}
   goal={type:'walk',to,max:Math.abs(to-spot.u)>420?58:26};rest='stand';run();
  }
  function jumpTo(target){
   if(!target){settle('stand',3000);return;}
   const u=freeOn(target)??clamp((target.x1-target.x0)*(.2+Math.random()*.6),14,Math.max(14,target.x1-target.x0-14));
   place();goal={type:'jump',target,u,t:-.16,from:null};rest='stand';run();
  }
  function appear(target){
   spot={ledge:target.el,u:freeOn(target)??clamp((target.x1-target.x0)*(.2+Math.random()*.6),14,Math.max(14,target.x1-target.x0-14))};
   ch.alpha=0;ch.down=0;speed=0;goal=null;rest='stand';setPose('stand');place();run();plan(3500);
  }
  const ease=(key,to,rate,dt)=>{const d=to-ch[key];if(Math.abs(d)<.02){ch[key]=to;return false;}ch[key]+=d*Math.min(1,rate*dt);return true;};
  function frame(){
   film=0;if(!node||dead||doc.hidden)return;const t=filmNow();debt+=Math.max(0,(t-last)/1000);last=t;let busy=!!goal;
   // Retain the 60 Hz integrator in memory, including acceleration, braking and easing, but commit only one drawing
   // per film tick. Elapsed time survives a late callback; missed drawings are skipped, never replayed in a burst.
   stepping=true;try{while(debt+1e-9>=STEP){busy=step(STEP);debt=Math.max(0,debt-STEP);if(!busy){debt=0;break;}}}finally{stepping=false;}
   setPose(pose,face);if(!grab&&goal?.type!=='jump')place();else if(!grab)moveTo(node._x,node._y);paint();
   if(busy){next+=FILM;if(next<=t)next+=Math.floor((t-next)/FILM+1)*FILM;film=setTimeout(frame,Math.max(1,next-filmNow()));}
  }
  function step(dt){
   let busy=false;
   const want=POSE[goal?'stand':rest]||POSE.stand;
   if(goal?.type==='walk'){
    if(ch.down>.6){busy=true;}            // get up first
    else{
     const dist=goal.to-spot.u,dir=dist>=0?1:-1,brake=Math.sqrt(2*90*Math.abs(dist))+2,target=Math.min(goal.max,brake);
     if(Math.sign(speed)!==dir&&Math.abs(speed)>4)speed+=dir*220*dt;   // turning: slow to a stop before setting off the other way
     else speed=dir*Math.min(target,Math.abs(speed)+70*dt);
     const trot=Math.abs(speed)>40;
     if(Math.abs(speed)>3)setPose(trot?'trot':'walk',speed>0?'right':'left');
     // the legs turn over as fast as the ground passes under them, so the feet do not slide
     spot.u+=speed*dt;phase+=Math.abs(speed)*dt*(trot?15.5:21.9)/size();
     if(Math.abs(dist)<1.2||dir*(goal.to-spot.u)<=0){spot.u=goal.to;speed=0;goal=null;setPose('stand');const here=current();if(!free(here,spot.u))moveOff(here);if(!goal)plan(1800+Math.random()*3200);}
     busy=true;
    }
   }else if(goal?.type==='jump'){
    const g=goal;
    if(ch.down>.6&&g.t<0&&!g.from){ease('down',0,7,dt);busy=true;}
    else{
     if(!g.from){g.from={x:node._x,y:node._y};const l0=ledgeFor(g.target.el)||g.target;g.dur=clamp(Math.hypot(l0.x0+g.u-g.from.x,l0.y-g.from.y)/520,.42,.85);setPose('stand',l0.x0+g.u>g.from.x?'right':'left');}
     g.t+=dt/(g.t<0?1:g.dur);
     const l=ledgeFor(g.target.el)||g.target,end={x:l.x0+g.u,y:l.y};
     if(g.t<0){ch.down=3.2*(1-Math.abs(g.t)/.16);}                    // a short crouch before it goes
     else{
      const p=clamp(g.t,0,1),e=g.drop?p*p:p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2,lift=g.drop?0:clamp(Math.abs(end.x-g.from.x)*.22+Math.max(0,g.from.y-end.y)*.25+26,30,90);
      if(pose!=='fall')setPose('fall');ch.down=0;
      moveTo(g.from.x+(end.x-g.from.x)*e,g.from.y+(end.y-g.from.y)*e-lift*Math.sin(Math.PI*p));
      if(p>=1){spot={ledge:l.el,u:g.u};goal=null;ch.down=3.4;setPose('stand');const here=current();if(!free(here,spot.u))moveOff(here);place();if(!goal)plan(2600+Math.random()*2500);}
     }
     busy=true;
    }
   }
   if(!goal||goal.type==='walk'){
    if(ease('leg',goal&&ch.down<=.6?clamp(Math.abs(speed)/26,0,1)*(Math.abs(speed)>40?27:21):0,9,dt))busy=true;
    if(ease('down',want.down,goal?7:4.2,dt))busy=true;
   }
   if(ease('neck',goal?.type==='walk'&&ch.down<=.6?9:want.neck,5,dt))busy=true;
   if(ease('head',want.head,5,dt))busy=true;
   if(ease('alpha',1,3.2,dt))busy=true;
   if(pose==='eat'){phase+=dt*4;busy=true;}
   return busy;
  }
  // ---- picking it up
  function down(event){
   if(!node||dead||doc.hidden||event.button!==undefined&&event.button!==0)return;releaseGrab?.();const held=node;
   const start={x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};try{node.setPointerCapture?.(start.id);}catch{}   // held from the first press, so a quick pull cannot slip off
   const move=e=>{
    if(node!==held||dead||doc.hidden||e.pointerId!==start.id)return;
    if(!start.moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<7)return;
    if(!start.moved){start.moved=true;grab=start;stop();goal=null;speed=0;ch.leg=0;ch.down=0;paint();closeBubble();setPose('held');try{node.setPointerCapture?.(start.id);}catch{}node.dataset.grabbed='true';}
    moveTo(e.clientX,e.clientY+size()*.42);
   };
   const up=e=>{
    if(e.pointerId!==start.id)return;
    release();if(node!==held||dead||doc.hidden||!start.moved)return;
    node.dataset.grabbed='false';node._suppress=now()+350;grab=null;
    // set down on the nearest place at or below the feet
    const x=node._x,y=node._y,under=ledges().filter(l=>x>=l.x0-10&&x<=l.x1+10&&l.y>=y-14).sort((a,b)=>a.y-b.y)[0]||ledgeFor(null);
    goal={type:'jump',target:under,u:clamp(x-under.x0,10,Math.max(10,under.x1-under.x0-10)),t:0,drop:true,from:{x,y},dur:clamp(Math.sqrt(Math.max(0,under.y-y))/38,.14,.6)};rest='stand';setPose('fall');run();
   };
   const release=()=>{held.removeEventListener('pointermove',move);held.removeEventListener('pointerup',up);held.removeEventListener('pointercancel',up);try{held.releasePointerCapture?.(start.id);}catch{}if(releaseGrab===release)releaseGrab=null;};releaseGrab=release;
   held.addEventListener('pointermove',move);held.addEventListener('pointerup',up);held.addEventListener('pointercancel',up);
  }
  function click(event){if(node._suppress&&now()<node._suppress){event.preventDefault();return;}if(menuOpen)closeBubble();else openMenu();}
  function key(event){if(event.key==='Escape'&&menuOpen){event.preventDefault();closeBubble();node.focus();}}
  // ---- what it says
  function measureBubble(){if(bubble)bubbleBox={w:bubble.offsetWidth||250,h:bubble.offsetHeight||120};}
  function placeBubble(){
   if(!bubble||!node)return;const vw=geometry?.width||win.innerWidth,w=bubbleBox.w,h=bubbleBox.h,s=size();
   const x=clamp(node._x-w/2,10,vw-w-10),above=node._y-s-h-6;
   bubble.style.transform=`translate(${x.toFixed(0)}px,${(above>70?above:node._y+10).toFixed(0)}px)`;
   bubble.style.setProperty('--pet-tail-x',clamp(node._x-x,22,w-22).toFixed(0)+'px');bubble.dataset.below=String(above<=70);
  }
  function closeBubble(){clearTimeout(sayTimer);if(bubble){resizeWatch?.unobserve(bubble);watched.delete(bubble);bubble.remove();bubble=null;}if(menuOpen){menuOpen=false;node?.setAttribute('aria-expanded','false');plan(1500);}}
  function show(html,{menu=false,ms=0}={}){
   closeBubble();if(!layer)return;
   bubble=doc.createElement('div');bubble.className='pet-bubble';bubble.innerHTML=html;
   if(menu){bubble.setAttribute('role','menu');bubble.setAttribute('aria-label',pet.name);menuOpen=true;node.setAttribute('aria-expanded','true');if(goal?.type==='walk'){goal=null;speed=0;setPose('stand');}}   // it stops where it is, so the menu opens in place
   else{bubble.setAttribute('role','status');bubble.setAttribute('aria-live','polite');}
   layer.append(bubble);measureBubble();if(resizeWatch){resizeWatch.observe(bubble);watched.add(bubble);}placeBubble();
   bubble.addEventListener('click',onBubble);
   if(ms)sayTimer=setTimeout(()=>{if(bubble&&!menuOpen)closeBubble();},ms);
  }
  function say(text,ms=5200){if(visible()&&layer)show(`<p class="pet-say">${E(text)}</p>`,{ms});}
  function summary(data){
   const n=data.todayOpen||0;
   if(data.next)return `<strong>Next:</strong> ${E(data.next.title)}<span class="pet-when">${E([data.next.course,data.next.when].filter(Boolean).join(' · '))}</span>`;
   return n?`${n} thing${n===1?'':'s'} left today.`:'Nothing due soon. Enjoy it.';
  }
  function openMenu(){
   const data=info(),lv=level(pet.xp),item=(action,label,extra='')=>`<button type="button" role="menuitem" class="pet-item" data-pet-action="${action}" ${extra}>${label}</button>`;
   show(`<div class="pet-head"><strong>${E(pet.name)}</strong><span>Level ${lv}${pet.streak>1?` · ${pet.streak} days in a row`:''}</span><span class="pet-meter" aria-hidden="true"><i style="width:${Math.round(levelProgress(pet.xp)*100)}%"></i></span></div>
<p class="pet-say">${summary(data)}</p>
<div class="pet-items">${data.next?item('open','Open it')+item('focus',focusing?'Timer is running':'Focus 25 min',focusing?'disabled':''):''}${item('feed',`Give a treat <span class="pet-count">${pet.treats}</span>`,pet.treats?'':'disabled')}${item('stay',pet.roam==='home'?'Let it roam':'Send it home')}${item('settings','Pet settings')}</div>`,{menu:true});
   bubble.querySelector('.pet-item:not([disabled])')?.focus({preventScroll:true});
  }
  function treat(){
   if(!pet.treats||!node)return false;
   closeBubble();save(feed(pet));goal=null;speed=0;settle('eat',2600);
   clearTimeout(timer);timer=setTimeout(()=>{cheer();},2500);return true;
  }
  // pleased: two small hops, then back to what it was doing
  function cheer(ms=1300){if(!node)return;goal=null;speed=0;rest='stand';ch.down=0;setPose('cheer');run();plan(ms+600);clearTimeout(node._cheer);node._cheer=setTimeout(()=>{if(node&&pose==='cheer')setPose('stand');},ms);}
  function onBubble(event){
   const b=event.target.closest?.('[data-pet-action]');if(!b||b.disabled)return;
   const what=b.dataset.petAction,data=info();
   if(what==='open'&&data.next){closeBubble();actions.open?.(data.next);}
   else if(what==='focus'&&data.next){closeBubble();actions.focus?.(data.next);}
   else if(what==='feed'){treat();}
   else if(what==='stay'){closeBubble();save({...pet,roam:pet.roam==='home'?'page':'home'});plan(300);}
   else if(what==='settings'){closeBubble();actions.settings?.();}
   else if(what==='quiet'){closeBubble();quietUntil=now()+3600000;plan(300);}
  }
  function save(nextPet){pet=clean(nextPet);dress();savePet?.(pet);}
  // ---- called by the workspace
  function sync(){
   if(dead)return;pet=clean(getPet());
   if(!visible()){unmount();return;}
    if(!layer)mount();else{dress();if(!container.contains(layer)){container.append(layer);rig=null;resetReels();}invalidate();}
   const data=info();
   // Said once for each thing that becomes urgent, and only when reminders are fully on.
   if(pet.nudges==='helpful'&&data.next?.urgent&&data.next.id&&pet.told!==String(data.next.id)&&now()>quietUntil&&!menuOpen&&!grab){
    save({...pet,told:String(data.next.id)});
    show(`<p class="pet-say"><strong>Due ${E(data.next.when||'soon')}:</strong> ${E(data.next.title)}</p><div class="pet-items"><button type="button" class="pet-item" data-pet-action="open">Open it</button><button type="button" class="pet-item" data-pet-action="quiet">Later</button></div>`,{ms:11000});
   }
  }
  function celebrate(kind='done',{today,left}={}){
   const result=reward(clean(getPet()),kind,today);save(result.pet);
   if(!visible()||!layer)return result;
   closeBubble();cheer(1300);
   const line=result.leveled?`Level ${level(pet.xp)}! Something new is unlocked.`:kind==='focus'?'Good session. A treat for both of us.':left===0?'That was the last one for today.':left>0?`Done. ${left} left today.`:'Done. Nicely.';
   say(line,4200);
   return result;
  }
  function setFocus(running){const was=focusing;focusing=!!running;if(was!==focusing&&layer&&!grab&&!menuOpen&&!goal)plan(400);}
  function destroy(){dead=true;unmount();}
  if(visible())mount();
  return {sync,celebrate,setFocus,say,treat,destroy,get pet(){return pet;}};
 }
 const api={DEFAULTS,SIZES,ROAM,NUDGES,GEAR,LEVEL_XP,UNLOCKS,level,levelProgress,unlocked,clean,reward,feed,create};
 root.ReservePets=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
