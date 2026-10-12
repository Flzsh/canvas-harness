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

 function create({container,getPet,savePet,info=()=>({}),actions={},now=()=>Date.now()}){
  const doc=container.ownerDocument||root.document,win=doc.defaultView||root,art=root.ReservePetArt,E=value=>root.ReserveUI?.escapeHTML?root.ReserveUI.escapeHTML(value):String(value).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
  let pet=clean(getPet()),layer=null,node=null,bubble=null,dead=false,raf=0,timer=0,last=0,act={type:'idle'},pose='stand',face='right';
  let spot={ledge:null,u:160},grab=null,menuOpen=false,focusing=false,quietUntil=0,lastInput=now(),sayTimer=0;
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
   dress();home();place();next(900);
  }
  function unmount(){
   if(!layer)return;closeBubble();cancel();
   win.removeEventListener('scroll',place,{capture:true});win.removeEventListener('resize',place);
   doc.removeEventListener('pointermove',seen);doc.removeEventListener('keydown',seen);doc.removeEventListener('visibilitychange',wake);
   layer.remove();layer=node=null;
  }
  function seen(){lastInput=now();if(pose==='sleep'&&act.type==='rest')next(400);}
  function wake(){if(!doc.hidden&&layer&&act.type==='idle')next(600);}
  function dress(){
   if(!node)return;const c=art.COATS[pet.coat]||art.COATS.oat;
   node.style.setProperty('--pet-coat',c.coat);node.style.setProperty('--pet-shade',c.shade);node.style.setProperty('--pet-mane',c.mane);node.style.setProperty('--pet-muzzle',c.muzzle);
   node.style.setProperty('--pet-harness',art.HARNESS[pet.harness]||art.HARNESS.red);node.style.setProperty('--pet-size',size()+'px');
   node.dataset.gear=pet.gear;node.setAttribute('aria-label',`${pet.name}, your pony. Open ${pet.name}'s menu`);
   node.dataset.still=String(reduced());
  }
  function setPose(value,facing){if(!node)return;pose=value;node.dataset.pose=value;if(facing){face=facing;node.dataset.face=facing;}}
  // ---- places to stand: the top edge of every panel on screen, the paddock, and the bottom of the window
  function ledges(){
   const vh=win.innerHeight,vw=win.innerWidth,out=[];
   for(const el of container.querySelectorAll('[data-pet-ledge],.rd-main > [data-arrange-key],.rd-board > [data-widget]')){
    const r=el.getBoundingClientRect();if(r.width<140||r.height<30)continue;
    const inside=el.dataset.petLedge==='inside',y=inside?r.bottom-8:r.top+1;
    if(y<90||y>vh-10)continue;
    out.push({el,inside,y,x0:Math.max(8,r.left+18),x1:Math.min(vw-8,r.right-18),paddock:inside});
   }
   out.push({el:null,y:vh-5,x0:14,x1:vw-14,floor:true});
   return out.filter(l=>l.x1-l.x0>60);
  }
  const ledgeOf=el=>ledges().find(l=>l.el===el)||null;
  function current(){return ledgeOf(spot.ledge)||ledgeOf(null);}
  function home(){
   const all=ledges(),paddock=all.find(l=>l.paddock),target=pet.roam==='home'?(paddock||all[all.length-1]):(all.find(l=>!l.floor&&!l.paddock)||all[all.length-1]);
   spot={ledge:target.el,u:clamp((target.x1-target.x0)*(.25+Math.random()*.5),20,target.x1-target.x0-20)};
  }
  function place(){
   if(!node||grab||act.type==='jump')return;
   let l=ledgeOf(spot.ledge);
   if(!l){l=ledgeOf(null);spot={ledge:null,u:clamp(spot.u,20,l.x1-l.x0-20)};}
   const u=clamp(spot.u,10,Math.max(10,l.x1-l.x0-10));
   moveTo(l.x0+u,l.y);
  }
  function moveTo(x,y){if(!node)return;const s=size(),w=s,h=s*64/72;node.style.transform=`translate(${(x-w/2).toFixed(1)}px,${(y-h*60/64).toFixed(1)}px)`;node._x=x;node._y=y;if(bubble)placeBubble();}
  // ---- what to do next
  function cancel(){win.cancelAnimationFrame?.(raf);clearTimeout(timer);raf=0;timer=0;}
  function next(delay=0){
   cancel();if(!node||dead)return;
   if(delay){act={type:'idle'};timer=setTimeout(()=>next(),delay);return;}
   if(doc.hidden||menuOpen||grab){act={type:'idle'};timer=setTimeout(()=>next(),2500);return;}
   const data=info(),idle=now()-lastInput;
   if(focusing){rest('read',20000);return;}
   if(reduced()||pet.roam==='home'&&!current()?.paddock&&ledges().some(l=>l.paddock)){if(!reduced()){hopTo(ledges().find(l=>l.paddock));return;}rest(nudgePose(data),30000);return;}
   if(idle>150000){rest('sleep',30000);return;}
   const roll=Math.random(),here=current(),others=ledges().filter(l=>l.el!==here.el&&(pet.roam==='page'||l.paddock));
   if(pet.roam==='home'&&here.paddock){if(roll<.55)walk();else rest(roll<.8?'lie':nudgePose(data),5000+Math.random()*9000);return;}
   if(roll<.42)walk();
   else if(roll<.56&&others.length)hopTo(others[Math.floor(Math.random()*others.length)]);
   else if(roll<.74)rest('lie',7000+Math.random()*12000);
   else rest(nudgePose(data),3500+Math.random()*6000);
  }
  // A due item is carried as a small flag, not announced, unless nudges are fully on.
  function nudgePose(data){return pet.nudges!=='off'&&data.next?.urgent&&now()>quietUntil?'flag':'stand';}
  function rest(as,ms){act={type:'rest'};setPose(as);place();timer=setTimeout(()=>next(),ms);}
  function walk(){
   const l=current(),span=l.x1-l.x0,to=clamp(20+Math.random()*(span-40),20,Math.max(20,span-20)),dist=to-spot.u;
   if(Math.abs(dist)<30){rest('stand',1800);return;}
   act={type:'walk',to,speed:Math.abs(dist)>260?92:38};setPose(act.speed>60?'trot':'walk',dist>0?'right':'left');last=0;raf=win.requestAnimationFrame(frame);
  }
  function hopTo(target){
   if(!target){rest('stand',2000);return;}
   const from={x:node._x,y:node._y},u=clamp((target.x1-target.x0)*(.2+Math.random()*.6),20,target.x1-target.x0-20);
   act={type:'jump',from,target,u,t:0,dur:clamp(Math.hypot(target.x0+u-from.x,target.y-from.y)/420,.45,1.1)};
   setPose('fall',target.x0+u>from.x?'right':'left');last=0;raf=win.requestAnimationFrame(frame);
  }
  function frame(ts){
   if(!node||dead)return;const dt=last?Math.min(.05,(ts-last)/1000):0;last=ts;
   if(act.type==='walk'){
    const dir=act.to>spot.u?1:-1;spot.u+=dir*act.speed*dt;
    if((act.to-spot.u)*dir<=0){spot.u=act.to;place();rest('stand',900+Math.random()*2200);return;}
    place();
   }else if(act.type==='jump'){
    act.t+=dt/act.dur;const l=ledgeOf(act.target.el)||act.target,end={x:l.x0+act.u,y:l.y},p=clamp(act.t,0,1),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const lift=Math.max(46,Math.abs(end.y-act.from.y)*.25+40),x=act.from.x+(end.x-act.from.x)*e,y=act.from.y+(end.y-act.from.y)*e-lift*Math.sin(Math.PI*p);
    const jumping=act;act={type:'air'};moveTo(x,y);act=jumping;
    if(p>=1){spot={ledge:l.el,u:act.u};act={type:'idle'};place();rest('stand',700);return;}
   }
   raf=win.requestAnimationFrame(frame);
  }
  // ---- picking it up
  function down(event){
   if(event.button!==undefined&&event.button!==0)return;
   const start={x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};
   const move=e=>{
    if(e.pointerId!==start.id)return;
    if(!start.moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<7)return;
    if(!start.moved){start.moved=true;grab=start;cancel();closeBubble();setPose('held');node.setPointerCapture?.(start.id);node.dataset.grabbed='true';}
    const jumping=act;act={type:'air'};moveTo(e.clientX,e.clientY+size()*.42);act=jumping;
   };
   const up=e=>{
    if(e.pointerId!==start.id)return;
    node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',up);
    if(!start.moved)return;
    node.dataset.grabbed='false';start.suppress=now()+350;grab=null;node._suppress=start.suppress;
    // set down on the nearest ledge at or below the feet
    const x=node._x,y=node._y,under=ledges().filter(l=>x>=l.x0-10&&x<=l.x1+10&&l.y>=y-14).sort((a,b)=>a.y-b.y)[0]||ledgeOf(null);
    act={type:'jump',from:{x,y},target:under,u:clamp(x-under.x0,10,under.x1-under.x0-10),t:0,dur:clamp((under.y-y)/700,.16,.6)};setPose('fall');last=0;raf=win.requestAnimationFrame(frame);
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
  function closeBubble(){clearTimeout(sayTimer);if(bubble){bubble.remove();bubble=null;}if(menuOpen){menuOpen=false;node?.setAttribute('aria-expanded','false');next(1200);}}
  function show(html,{menu=false,ms=0}={}){
   closeBubble();if(!layer)return;
   bubble=doc.createElement('div');bubble.className='pet-bubble';bubble.innerHTML=html;
   if(menu){bubble.setAttribute('role','menu');bubble.setAttribute('aria-label',pet.name);menuOpen=true;node.setAttribute('aria-expanded','true');cancel();setPose('stand');}
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
  function onBubble(event){
   const b=event.target.closest?.('[data-pet-action]');if(!b||b.disabled)return;
   const what=b.dataset.petAction,data=info();
   if(what==='open'&&data.next){closeBubble();actions.open?.(data.next);}
   else if(what==='focus'&&data.next){closeBubble();actions.focus?.(data.next);}
   else if(what==='feed'){closeBubble();save(feed(pet));cancel();act={type:'rest'};setPose('eat');timer=setTimeout(()=>{setPose('cheer');timer=setTimeout(()=>next(),1300);},2300);}
   else if(what==='stay'){closeBubble();save({...pet,roam:pet.roam==='home'?'page':'home'});next(200);}
   else if(what==='settings'){closeBubble();actions.settings?.();}
   else if(what==='quiet'){closeBubble();quietUntil=now()+3600000;next(200);}
  }
  function save(nextPet){pet=clean(nextPet);dress();savePet?.(pet);}
  // ---- called by the workspace
  function sync(){
   if(dead)return;pet=clean(getPet());
   if(!visible()){unmount();return;}
   if(!layer)mount();else{dress();if(!container.contains(layer))container.append(layer);place();}
   const data=info();
   // Said once for each thing that becomes urgent, and only when nudges are fully on.
   if(pet.nudges==='helpful'&&data.next?.urgent&&data.next.id&&pet.told!==String(data.next.id)&&now()>quietUntil&&!menuOpen&&!grab){
    save({...pet,told:String(data.next.id)});
    show(`<p class="pet-say"><strong>Due ${E(data.next.when||'soon')}:</strong> ${E(data.next.title)}</p><div class="pet-items"><button type="button" class="pet-item" data-pet-action="open">Open it</button><button type="button" class="pet-item" data-pet-action="quiet">Later</button></div>`,{ms:11000});
   }
  }
  function celebrate(kind='done',{today,left}={}){
   const result=reward(clean(getPet()),kind,today);save(result.pet);
   if(!visible()||!layer)return result;
   cancel();closeBubble();act={type:'rest'};setPose('cheer');
   const line=result.leveled?`Level ${level(pet.xp)}! Something new is unlocked.`:kind==='focus'?'Good session. A treat for both of us.':left===0?'That was the last one for today.':left>0?`Done. ${left} left today.`:'Done. Nicely.';
   say(line,4200);timer=setTimeout(()=>next(),2400);
   return result;
  }
  function setFocus(running){focusing=!!running;if(layer&&!grab&&!menuOpen)next(200);}
  function destroy(){dead=true;unmount();}
  if(visible())mount();
  return {sync,celebrate,setFocus,say,destroy,get pet(){return pet;}};
 }
 const api={DEFAULTS,SIZES,ROAM,NUDGES,GEAR,LEVEL_XP,UNLOCKS,level,levelProgress,unlocked,clean,reward,feed,create};
 root.ReservePets=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
