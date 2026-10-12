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
  const doc=container.ownerDocument||root.document,win=doc.defaultView||root,art=root.ReservePetArt,E=value=>root.ReserveUI?.escapeHTML?root.ReserveUI.escapeHTML(value):String(value).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
  let pet=clean(getPet()),layer=null,node=null,bubble=null,dead=false,raf=0,timer=0,last=0,pose='stand',face='right';
  let spot={ledge:null,u:160},grab=null,menuOpen=false,focusing=false,quietUntil=0,lastInput=now(),sayTimer=0,unseen=0;
  // what it is doing: null (resting), a walk, or a jump; and the eased numbers
  let goal=null,rest='stand',speed=0,phase=0,follow=0;const ch={leg:0,down:0,neck:9,head:0,alpha:1};
  const reduced=()=>['off','still'].includes(container.dataset.motionStyle)||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const size=()=>SIZES[pet.size]||SIZES.medium;
  const visible=()=>pet.enabled&&pet.roam!=='off';
  function mount(){
   if(layer||dead)return;
   layer=doc.createElement('div');layer.className='pet-layer';
   layer.innerHTML=`<button type="button" class="pet" data-pose="stand" data-face="right" aria-haspopup="menu" aria-expanded="false"></button>`;
   container.append(layer);node=layer.firstElementChild;node.innerHTML=art.svg({title:pet.name});
   node.addEventListener('pointerdown',down);node.addEventListener('click',click);node.addEventListener('keydown',key);
   win.addEventListener('scroll',place,{passive:true,capture:true});win.addEventListener('resize',place,{passive:true});
   doc.addEventListener('pointermove',seen,{passive:true});doc.addEventListener('keydown',seen,{passive:true});
   doc.addEventListener('visibilitychange',wake);
   // Modules move when the layout changes; keep the pony on the one it is standing on.
   follow=setInterval(()=>{if(!raf&&!grab&&!doc.hidden)place();},500);
   dress();home();place();paint();plan(1400);
  }
  function unmount(){
   if(!layer)return;closeBubble();stop();
   win.removeEventListener('scroll',place,{capture:true});win.removeEventListener('resize',place);
   doc.removeEventListener('pointermove',seen);doc.removeEventListener('keydown',seen);doc.removeEventListener('visibilitychange',wake);
   clearInterval(follow);follow=0;layer.remove();layer=node=null;
  }
  function seen(){lastInput=now();if(rest==='sleep'&&!goal&&!menuOpen)settle('lie',4000);}
  function wake(){if(!doc.hidden&&layer){place();if(goal)run();else plan(900);}}
  function dress(){
   if(!node)return;const c=art.COATS[pet.coat]||art.COATS.oat;
   node.style.setProperty('--pet-coat',c.coat);node.style.setProperty('--pet-shade',c.shade);node.style.setProperty('--pet-mane',c.mane);node.style.setProperty('--pet-muzzle',c.muzzle);
   node.style.setProperty('--pet-harness',art.HARNESS[pet.harness]||art.HARNESS.red);node.style.setProperty('--pet-size',size()+'px');
   node.dataset.gear=pet.gear;node.setAttribute('aria-label',`${pet.name}, your pony. Open ${pet.name}'s menu`);
   node.dataset.still=String(reduced());
  }
  function setPose(value,facing){if(!node)return;pose=value;node.dataset.pose=value;if(facing&&facing!==face){face=facing;node.dataset.face=facing;}}
  // ---- places to stand: the top edge of every module, inside the paddock, and the bottom of the window
  function ledgeFor(el){
   const vw=win.innerWidth;
   if(!el)return {el:null,y:win.innerHeight-5,x0:14,x1:vw-14,floor:true,shown:true};
   if(!el.isConnected)return null;
   const r=el.getBoundingClientRect();if(r.width<120||r.height<30)return null;
   const inside=el.dataset.petLedge==='inside',y=inside?r.bottom-9:r.top+1;
   return {el,inside,paddock:inside,y,x0:r.left+(inside?26:18),x1:r.right-(inside?26:18),shown:y>96&&y<win.innerHeight-6&&r.right>60&&r.left<vw-60};
  }
  function ledges(){
   const out=[];
   for(const el of container.querySelectorAll('[data-pet-ledge],.rd-main > [data-arrange-key]')){const l=ledgeFor(el);if(l&&l.shown&&l.x1-l.x0>60)out.push(l);}
   out.push(ledgeFor(null));return out;
  }
  const current=()=>ledgeFor(spot.ledge)||ledgeFor(null);
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
  function moveTo(x,y){if(!node)return;const s=size(),h=s*64/72;node.style.transform=`translate(${(x-s/2).toFixed(1)}px,${(y-h*60/64).toFixed(1)}px)`;node._x=x;node._y=y;if(bubble)placeBubble();}
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
   const lying=String(down>5.5);if(node.dataset.lying!==lying)node.dataset.lying=lying;
  }
  // ---- deciding
  function stop(){win.cancelAnimationFrame?.(raf);clearTimeout(timer);raf=0;timer=0;}
  function run(){if(!raf&&node&&!dead){last=0;raf=win.requestAnimationFrame(frame);}}
  function plan(delay){clearTimeout(timer);timer=setTimeout(decide,delay);}
  function settle(as,ms){goal=null;rest=as;setPose(as);run();plan(ms);}
  function decide(){
   timer=0;if(!node||dead)return;
   if(doc.hidden)return;
   if(menuOpen||grab||goal){plan(2500);return;}
   const data=info(),idle=now()-lastInput,here=current();
   if(reduced()){settle(nudge(data),30000);return;}
   if(focusing){settle('read',20000);return;}
   // its place has scrolled away or gone: come back to somewhere in view, quietly
   if(!here.shown||!here.el&&pet.roam==='home'){
    const all=ledges(),to=pet.roam==='home'?all.find(l=>l.paddock):all.filter(l=>!l.paddock&&!l.floor)[0]||all[all.length-1];
    if(to&&(to.el!==here.el)){if(here.shown)jumpTo(to);else appear(to);return;}
   }
   if(idle>150000){settle('sleep',30000);return;}
   const roll=Math.random();
   if(roll<.4)walk();
   else if(roll<.45&&pet.roam==='page'){const near=ledges().filter(l=>l.el!==here.el&&!l.paddock&&Math.abs(l.y-here.y)<360&&l.x0<node._x+420&&l.x1>node._x-420);if(near.length)jumpTo(near[Math.floor(Math.random()*near.length)]);else walk();}
   else if(roll<.72)settle('lie',9000+Math.random()*14000);
   else settle(nudge(data),5000+Math.random()*7000);
  }
  // A due item is carried as a small flag, not announced, unless reminders are fully on.
  function nudge(data){return pet.nudges!=='off'&&data.next?.urgent&&now()>quietUntil?'flag':'stand';}
  function walk(){
   const l=current(),span=l.x1-l.x0;if(span<70){settle('stand',4000);return;}
   const to=clamp(14+Math.random()*(span-28),14,span-14);
   if(Math.abs(to-spot.u)<36){settle('stand',3500);return;}
   goal={type:'walk',to,max:Math.abs(to-spot.u)>420?58:26};rest='stand';run();
  }
  function jumpTo(target){
   if(!target){settle('stand',3000);return;}
   const u=clamp((target.x1-target.x0)*(.2+Math.random()*.6),14,Math.max(14,target.x1-target.x0-14));
   goal={type:'jump',target,u,t:-.16,from:null};rest='stand';run();
  }
  function appear(target){
   spot={ledge:target.el,u:clamp((target.x1-target.x0)*(.2+Math.random()*.6),14,Math.max(14,target.x1-target.x0-14))};
   ch.alpha=0;ch.down=0;speed=0;goal=null;rest='stand';setPose('stand');place();run();plan(3500);
  }
  const ease=(key,to,rate,dt)=>{const d=to-ch[key];if(Math.abs(d)<.02){ch[key]=to;return false;}ch[key]+=d*Math.min(1,rate*dt);return true;};
  function frame(ts){
   raf=0;if(!node||dead)return;const dt=last?Math.min(.05,(ts-last)/1000):.016;last=ts;let busy=false;
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
     if(Math.abs(dist)<1.2||dir*(goal.to-spot.u)<=0){spot.u=goal.to;speed=0;goal=null;setPose('stand');plan(1800+Math.random()*3200);}
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
      if(p>=1){spot={ledge:l.el,u:g.u};goal=null;ch.down=3.4;setPose('stand');place();plan(2600+Math.random()*2500);}
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
   if(!grab&&goal?.type!=='jump')place();
   paint();
   if(busy)raf=win.requestAnimationFrame(frame);
  }
  // ---- picking it up
  function down(event){
   if(event.button!==undefined&&event.button!==0)return;
   const start={x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};
   const move=e=>{
    if(e.pointerId!==start.id)return;
    if(!start.moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<7)return;
    if(!start.moved){start.moved=true;grab=start;stop();goal=null;speed=0;ch.leg=0;ch.down=0;paint();closeBubble();setPose('held');node.setPointerCapture?.(start.id);node.dataset.grabbed='true';}
    moveTo(e.clientX,e.clientY+size()*.42);
   };
   const up=e=>{
    if(e.pointerId!==start.id)return;
    node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',up);
    if(!start.moved)return;
    node.dataset.grabbed='false';node._suppress=now()+350;grab=null;
    // set down on the nearest place at or below the feet
    const x=node._x,y=node._y,under=ledges().filter(l=>x>=l.x0-10&&x<=l.x1+10&&l.y>=y-14).sort((a,b)=>a.y-b.y)[0]||ledgeFor(null);
    goal={type:'jump',target:under,u:clamp(x-under.x0,10,Math.max(10,under.x1-under.x0-10)),t:0,drop:true,from:{x,y},dur:clamp(Math.sqrt(Math.max(0,under.y-y))/38,.14,.6)};rest='stand';setPose('fall');run();
   };
   node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);node.addEventListener('pointercancel',up);
  }
  function click(event){if(node._suppress&&now()<node._suppress){event.preventDefault();return;}if(menuOpen)closeBubble();else openMenu();}
  function key(event){if(event.key==='Escape'&&menuOpen){event.preventDefault();closeBubble();node.focus();}}
  // ---- what it says
  function placeBubble(){
   if(!bubble||!node)return;const vw=win.innerWidth,w=bubble.offsetWidth||250,h=bubble.offsetHeight||120,s=size();
   const x=clamp(node._x-w/2,10,vw-w-10),above=node._y-s-h-6;
   bubble.style.transform=`translate(${x.toFixed(0)}px,${(above>70?above:node._y+10).toFixed(0)}px)`;
   bubble.style.setProperty('--pet-tail-x',clamp(node._x-x,22,w-22).toFixed(0)+'px');bubble.dataset.below=String(above<=70);
  }
  function closeBubble(){clearTimeout(sayTimer);if(bubble){bubble.remove();bubble=null;}if(menuOpen){menuOpen=false;node?.setAttribute('aria-expanded','false');plan(1500);}}
  function show(html,{menu=false,ms=0}={}){
   closeBubble();if(!layer)return;
   bubble=doc.createElement('div');bubble.className='pet-bubble';bubble.innerHTML=html;
   if(menu){bubble.setAttribute('role','menu');bubble.setAttribute('aria-label',pet.name);menuOpen=true;node.setAttribute('aria-expanded','true');if(goal?.type==='walk'){goal.to=spot.u+Math.sign(speed)*Math.min(18,Math.abs(speed)*.3);}}
   else{bubble.setAttribute('role','status');bubble.setAttribute('aria-live','polite');}
   layer.append(bubble);placeBubble();
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
   if(!layer)mount();else{dress();if(!container.contains(layer))container.append(layer);place();}
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
