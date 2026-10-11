/* Direct manipulation of personal layout only. Original creator: Flzsh. */
(function(root){
 'use strict';
 const HOLD_MS=420,HOLD_DELAY_MS=250,SLOP=8;
 const spring=Array.from({length:25},(_,i)=>{const t=i/24,p=i===24?1:1-(1+9*t)*Math.exp(-9*t);return {offset:t,p};});
 function create({container,getSettings,getCourseIds=()=>[],onChange,onModeChange},M){
  const doc=container.ownerDocument||root.document,win=doc.defaultView||root;
  const raf=cb=>(win.requestAnimationFrame||((f)=>setTimeout(f,16)))(cb),caf=id=>(win.cancelAnimationFrame||clearTimeout)(id);
  let pending=null,drag=null,live=null,hud=null,ghost=null,slot=null,dead=false,saving=false,frame=0,revision=0,suppressUntil=0,observed=null,observedWidth=0;
  const animations=new Map();
  const reduced=()=>['off','still'].includes(container.dataset.motionStyle)||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const all=sel=>Array.from(container.querySelectorAll(sel));
  const main=()=>container.querySelector('.rd-main.rd-desk');
  const panels=()=>all('.rd-main > [data-arrange-key]');
  const railNode=()=>container.querySelector('.rd-shell')?.querySelector('.rd-course-rail');
  const cards=()=>Array.from(railNode()?.children||[]).filter(node=>node.dataset.arrangeCourse!==undefined);
  const keyOf=node=>node?.dataset?.arrangeCourse||node?.dataset?.arrangeKey;
  const make=cls=>{const el=doc.createElement('div');el.className=cls;(container.querySelector('.rd-toolbar')||container).append(el);return el;};
  function announce(text){if(!live){live=make('rd-arrange-live rd-sr-only');live.setAttribute('role','status');live.setAttribute('aria-live','polite');}live.textContent=text;}
  function measure(nodes){return new Map(nodes.map(node=>[node,node.getBoundingClientRect()]));}
  function stopAnimation(node){animations.get(node)?.cancel();animations.delete(node);}
  function animate(node,from,to,done){
   stopAnimation(node);
   if(reduced()||!node.animate){done?.();return;}
   const animation=node.animate(spring.map(({offset,p})=>({offset,transform:`translate(${from.x+(to.x-from.x)*p}px,${from.y+(to.y-from.y)*p}px) scale(${from.s+(to.s-from.s)*p})`})),{duration:260,easing:'linear',fill:'both'});
   animations.set(node,animation);animation.finished.then(()=>{if(animations.get(node)===animation){animations.delete(node);animation.cancel();done?.();}},()=>{});
  }
  function flip(before){
   // Measure the current presentation before cancelling interrupted springs.
   for(const [node,old] of before){stopAnimation(node);const r=node.getBoundingClientRect();if(node===drag?.node)continue;
    if(Math.abs(old.left-r.left)+Math.abs(old.top-r.top)>1)animate(node,{x:old.left-r.left,y:old.top-r.top,s:1},{x:0,y:0,s:1});
   }
  }
  function applyLayout(layout=M.snapshot(getSettings()).layout){
   const desk=main();if(!desk)return;
   if(getSettings().showCourseInformation===false&&!drag)layout=M.prune(layout,'context');
   const spec=M.grid(layout,desk.clientWidth||desk.getBoundingClientRect().width);
   desk.style.setProperty('--rd-layout-columns',spec.columns);desk.style.setProperty('--rd-layout-rows',spec.rows);
   for(const node of panels()){const cell=spec.cells[node.dataset.arrangeKey];if(cell){node.style.setProperty('--rd-panel-column',cell.column);node.style.setProperty('--rd-panel-row',cell.row);}}
  }
  function restore(smooth=true){
   if(!drag)return;
   const before=measure(drag.kind==='course'?cards():panels());
   if(drag.kind==='course')for(const node of drag.originalNodes){if(node.parentNode)node.parentNode.insertBefore(node,drag.foot||null);}
   else applyLayout();
   if(smooth)flip(before);
  }
  function clearPending(){if(!pending)return;clearTimeout(pending.timer);clearTimeout(pending.feedbackTimer);pending.node.removeAttribute('data-hold');pending.head?.removeAttribute('data-hold');pending=null;}
  function source(target){
   if(!target?.closest||target.closest('a,input,textarea,select,label,summary,[contenteditable="true"]'))return null;
   const card=target.closest('[data-arrange-course]');
   if(card)return {node:card,head:card,kind:'course',key:card.dataset.arrangeCourse,label:card.querySelector('.rd-rail-name')?.textContent||'Course'};
   const head=target.closest('[data-arrange-head]');
   if(!head||target.closest('button:not([data-arrange-grip])'))return null;
   const key=head.dataset.arrangeHead,node=head.closest('[data-arrange-key]');
   if(!node||key!=='rail'&&container.dataset.workspace!=='work')return null;
   return {node,head,key,kind:key==='rail'?'rail':'panel',label:M.LABELS[key]};
  }
  function showHud(text){if(!hud){hud=make('rd-move-hud');hud.setAttribute('aria-hidden','true');}hud.textContent=text;}
  function cleanClone(node){
   const clone=node.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.setAttribute('inert','');clone.removeAttribute('data-lifted');clone.removeAttribute('data-hold');
   // ID references within drawings remain local to the drawing; prefix them so
   // an animated SVG on the page never acquires the preview's clip/mask definition.
   const nodes=[clone,...clone.querySelectorAll('*')],ids=new Map();
   for(const n of nodes)if(n.id){ids.set(n.id,'rd-lift-'+n.id);n.id='rd-lift-'+n.id;}
   for(const n of nodes)for(const attr of [...n.attributes]){let value=attr.value;for(const [id,replacement] of ids){value=value.split('url(#'+id+')').join('url(#'+replacement+')');if(value==='#'+id)value='#'+replacement;}if(value!==attr.value)n.setAttribute(attr.name,value);}
   return clone;
  }
  function lift(info,event,keyboard=false){
   const rect=info.node.getBoundingClientRect();
   for(const node of animations.keys())stopAnimation(node);
   clearPending();
   drag={...info,pointerId:event.pointerId,keyboard,x:event.clientX??rect.left+rect.width/2,y:event.clientY??rect.top+24,startX:event.clientX??rect.left,startY:event.clientY??rect.top,rect,moved:false,drop:null,candidate:null,stable:measure(info.kind==='course'?cards():panels()),originalNodes:cards(),foot:container.querySelector('.rd-rail-foot'),originalNavigation:getSettings().courseNavigation||'sidebar'};
   drag.offsetX=drag.x-rect.left;drag.offsetY=drag.y-rect.top;
   // A course card is moved in the DOM while previewing. Capture on the stable
   // workspace, otherwise that move releases capture and cancels the gesture.
   drag.capture=container;
   if(!keyboard)try{drag.capture.setPointerCapture(event.pointerId);}catch{}
   ghost=make('rd-lift-ghost'+(info.kind==='course'?' rd-lift-course':''));ghost.style.width=rect.width+'px';ghost.style.height=Math.min(rect.height,Math.max(160,win.innerHeight*.58))+'px';
   const clone=cleanClone(info.node);
   if(info.kind==='course'){
    // Keep the real rail styling context: the subject frame sits behind the
    // text inside the card's stacking context, not behind the floating sheet.
    const rail=doc.createElement('div');rail.className='rd-course-rail rd-lift-rail-context';
    rail.style.setProperty('--rd-rail-row-h',rect.height+'px');
    rail.append(clone);ghost.append(rail);
   }else ghost.append(clone);
   ghost.style.left=rect.left+'px';ghost.style.top=rect.top+'px';
   slot=make('rd-snap-preview');slot.setAttribute('aria-hidden','true');slot.hidden=true;
   info.node.dataset.lifted='true';container.dataset.arrangeDragging=info.kind;container.dataset.arranging='true';
   if(keyboard)showHud('Arrow keys choose a place · Tab changes panel · Enter places · Esc cancels');
   announce(`${info.label} lifted. ${keyboard?'Use arrow keys, Tab, and Enter.':'Drag to a highlighted space, then release.'} Escape cancels.`);
   animate(ghost,{x:0,y:0,s:1},{x:0,y:0,s:1.015});
  }
  function sideCommand(target,edge){
   const rect=[...drag.stable].find(([node])=>keyOf(node)===target)?.[1];
   return rect&&Math.abs(rect.left-drag.rect.left)<24?{type:'dock',key:drag.key,target,edge}:{type:'swap',key:drag.key,target};
  }
  function clearVisuals(){
   if(ghost){stopAnimation(ghost);ghost.remove();}ghost=null;slot?.remove();slot=null;hud?.remove();hud=null;
   for(const node of all('[data-lifted]'))node.removeAttribute('data-lifted');
   delete container.dataset.arrangeDragging;container.dataset.arranging='false';
  }
  function releaseCapture(d){try{if(d.capture?.hasPointerCapture?.(d.pointerId))d.capture.releasePointerCapture(d.pointerId);}catch{}}
  function cancel({quiet=false}={}){
   clearPending();if(!drag)return false;
   const d=drag;suppressUntil=Date.now()+650;restore();drag=null;releaseCapture(d);caf(frame);frame=0;clearVisuals();if(!quiet)announce('Move cancelled. Your layout is unchanged.');return true;
  }
  async function commit(command,message,before=measure([...panels(),...cards()])){
   const token=++revision,navigation=getSettings().courseNavigation||'sidebar';
   let saved=false;try{saved=await onChange(command);}catch{}
   if(dead||token!==revision)return false;
   if(saved===false){applyLayout();announce('The change could not be saved. Your previous layout was restored.');return false;}
   applyLayout();if(before&&navigation===(getSettings().courseNavigation||'sidebar'))flip(before);announce(message);return true;
  }
  function candidateAt(x,y){
   if(!drag)return null;
   if(drag.kind==='rail'){
    const r=container.querySelector('.rd-shell').getBoundingClientRect();
    if(y>=r.top-55&&y<r.top+100&&x>r.left+100&&x<r.right)return {type:'navigation',value:'topbar'};
    if(x>=r.left-20&&x<r.left+150&&y>r.top+50&&y<win.innerHeight-30)return {type:'navigation',value:'sidebar'};
    return null;
   }
   const entries=[...drag.stable].filter(([node])=>node!==drag.node);
   for(const [node,original] of entries){
    const r={...original,left:original.left,top:original.top,right:original.right,bottom:original.bottom,width:original.width,height:original.height};
    // Stable targets avoid a moving-target loop while neighbours make room.
    r.bottom=Math.min(r.bottom,win.innerHeight-40);r.height=r.bottom-r.top;
    if(x<r.left-24||x>r.right+24||y<r.top-24||y>r.bottom+24)continue;
    if(drag.kind==='course')return {type:'course-move',key:drag.key,target:keyOf(node),position:(drag.originalNavigation==='topbar'?x<r.left+r.width/2:y<r.top+r.height/2)?'before':'after',ids:getCourseIds()};
    // Crossing into a neighbouring column means exchange places, even when
    // the pointer started near the top of its heading. Only a deliberate
    // vertical move to a top/bottom edge creates a stack.
    const dx=x-drag.startX,dy=y-drag.startY,edge=M.edgeAt(r,x,y);
    // A diagonal trip to a panel's bottom still means "below". Heading-to-
    // heading horizontal movement remains a swap, even near the top edge.
    const band=Math.min(90,Math.max(38,r.height*.22));
    if(dy>56&&y>=r.bottom-band)return {type:'dock',key:drag.key,target:keyOf(node),edge:'bottom'};
    if(dy< -56&&y<=r.top+band)return {type:'dock',key:drag.key,target:keyOf(node),edge:'top'};
    const horizontal=Math.abs(dx)>Math.abs(dy)*1.15;
    if(horizontal||!edge||['left','right'].includes(edge)){
     const sameColumn=Math.abs(original.left-drag.rect.left)<24;
     if(sameColumn&&(horizontal||['left','right'].includes(edge)))return {type:'dock',key:drag.key,target:keyOf(node),edge:x<r.left+r.width/2?'left':'right'};
     return {type:'swap',key:drag.key,target:keyOf(node)};
    }
    return {type:'dock',key:drag.key,target:keyOf(node),edge};
   }
   if(drag.key==='context'&&hud){const r=hud.getBoundingClientRect();if(x>=r.left&&x<=r.right&&y>=r.top-35&&y<=r.bottom+20)return {type:'hide-context'};}
   return null;
  }
  function textFor(c){return c.type==='swap'?`Swap ${M.LABELS[c.key]} with ${M.LABELS[c.target]}`:c.type==='dock'?`${M.LABELS[c.key]} ${({left:'to the left of',right:'to the right of',top:'above',bottom:'below'})[c.edge]} ${M.LABELS[c.target]}`:c.type==='course-move'?`${drag.label} ${c.position} ${cards().find(n=>keyOf(n)===c.target)?.querySelector('.rd-rail-name')?.textContent||'course'}`:c.type==='hide-context'?'Put course information away':`Courses ${c.value==='topbar'?'across the top':'on the left'}`;}
  function preview(c){
   if(!drag||JSON.stringify(c)===JSON.stringify(drag.drop))return;
   const before=measure(drag.kind==='course'?cards():panels());
   for(const node of before.keys())stopAnimation(node);
   restore(false);drag.drop=c;
   if(!c){slot.hidden=true;flip(before);return;}
   if(c.type==='dock')applyLayout(M.dock(M.snapshot(getSettings()).layout,c.key,c.target,c.edge));
   if(c.type==='swap')applyLayout(M.swap(M.snapshot(getSettings()).layout,c.key,c.target));
   if(c.type==='course-move'){
    const target=cards().find(n=>keyOf(n)===c.target);if(target)target.parentNode.insertBefore(drag.node,c.position==='before'?target:target.nextSibling);
   }
   flip(before);slot.hidden=false;
   let rect=drag.node.getBoundingClientRect();
   if(c.type==='navigation'){const r=container.querySelector('.rd-shell').getBoundingClientRect();rect={left:r.left,top:r.top,width:c.value==='topbar'?r.width:220,height:c.value==='topbar'?100:Math.min(r.height,win.innerHeight-r.top-20)};}
   if(c.type==='hide-context')rect=hud.getBoundingClientRect();
   for(const [prop,value] of Object.entries({left:rect.left,top:rect.top,width:rect.width,height:Math.max(60,Math.min(rect.height,win.innerHeight-rect.top-16))}))slot.style[prop]=value+'px';
   const label=textFor(c);slot.textContent='';slot.dataset.kind=drag.kind;slot.setAttribute('aria-label',label);
   if(drag.keyboard)showHud(`${label} · Enter to place`);announce(label);
  }
  function paint(){
   frame=0;if(!drag||drag.keyboard)return;
   stopAnimation(ghost);ghost.style.transform=`translate(${drag.x-drag.startX}px,${drag.y-drag.startY}px) scale(1.015)`;
   const candidate=candidateAt(drag.x,drag.y);
   // A small boundary deadband stops the preview oscillating between corners.
   if(JSON.stringify(candidate)!==JSON.stringify(drag.drop)&&drag.drop&&drag.lastSnap&&Math.hypot(drag.x-drag.lastSnap.x,drag.y-drag.lastSnap.y)<20)return;
   if(JSON.stringify(candidate)!==JSON.stringify(drag.drop))drag.lastSnap={x:drag.x,y:drag.y};
   preview(candidate);
   // Scroll the course list or page gently when the held object reaches its edge.
   const rail=railNode(),horizontal=drag.kind==='course'&&drag.originalNavigation==='topbar';
   const scroller=horizontal?rail:drag.kind==='course'&&rail.scrollHeight>rail.clientHeight+2?rail:doc.scrollingElement;
   const r=scroller===doc.scrollingElement?{top:0,bottom:win.innerHeight,left:0,right:win.innerWidth}:scroller?.getBoundingClientRect();
   if(!r)return;
   const p=horizontal?drag.x:drag.y,low=horizontal?r.left:r.top,high=horizontal?r.right:r.bottom;
   const speed=p<low+52?-Math.ceil((low+52-p)/7):p>high-52?Math.ceil((p-high+52)/7):0;
   if(speed&&p>=low-15&&p<=high+15){
    const property=horizontal?'scrollLeft':'scrollTop',old=scroller[property];scroller[property]+=Math.max(-14,Math.min(14,speed));const moved=scroller[property]-old;
    if(moved){for(const [n,b] of drag.stable){drag.stable.set(n,{left:b.left-(horizontal?moved:0),right:b.right-(horizontal?moved:0),top:b.top-(horizontal?0:moved),bottom:b.bottom-(horizontal?0:moved),width:b.width,height:b.height});}frame=raf(paint);}
   }
  }
  function pointerdown(event){
   if(event.isPrimary===false){cancel();return false;}
   if(saving||event.button!==0||event.ctrlKey||event.metaKey)return false;
   if(drag?.keyboard){cancel();return false;}
   const info=source(event.target);if(!info)return false;
   cancel({quiet:true});pending={...info,x:event.clientX,y:event.clientY,pointerId:event.pointerId,event};
   // A normal click has no progress animation. Every move requires its own hold;
   // releasing never switches the rest of the workspace into an unlocked mode.
   pending.feedbackTimer=setTimeout(()=>{if(pending)info.node.dataset.hold='true';},HOLD_DELAY_MS);
   pending.timer=setTimeout(()=>{if(pending){lift(info,event);suppressUntil=Date.now()+800;}},HOLD_MS);return true;
  }
  function pointermove(event){
   if(pending&&pending.pointerId===event.pointerId){
    const distance=Math.hypot(event.clientX-pending.x,event.clientY-pending.y);
    if(distance>SLOP){clearPending();return false;}
   }
   if(!drag||drag.keyboard||drag.pointerId!==event.pointerId)return false;
   event.preventDefault?.();drag.x=event.clientX;drag.y=event.clientY;drag.moved ||= Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>SLOP;
   if(!frame)frame=raf(paint);return true;
  }
  async function place(){
   if(!drag)return;const d=drag,c=d.drop;
   if(!c){cancel();return;}
   const from=ghost.getBoundingClientRect(),label=textFor(c);
   // Commit the visible preview, never restore the old layout on the way there.
   // Remove the clone BEFORE rendering: a cloned rail must not participate in
   // sidebar measurements while the account-bound storage write is pending.
   drag=null;releaseCapture(d);caf(frame);frame=0;clearVisuals();saving=true;
   if(c.type==='navigation')container.dataset.courseNavigation=c.value;
   let target=d.kind==='course'?cards().find(n=>keyOf(n)===d.key):container.querySelector('[data-arrange-key="'+d.key+'"]');
   if(target){stopAnimation(target);const to=target.getBoundingClientRect();
    const limit=d.kind==='rail'?24:180,clamp=n=>Math.max(-limit,Math.min(limit,n));
    animate(target,{x:clamp(from.left-to.left),y:clamp(from.top-to.top),s:1},{x:0,y:0,s:1});
   }
   const ok=await commit(c,label+'. Saved. Undo is available.',null);
   saving=false;if(dead)return;
   if(!ok){
    stopAnimation(target);
    if(d.kind==='course')for(const node of d.originalNodes)node.parentNode?.insertBefore(node,d.foot||null);
    if(c.type==='navigation')container.dataset.courseNavigation=d.originalNavigation;
    applyLayout();
   }
   target=d.kind==='course'?cards().find(n=>keyOf(n)===d.key):container.querySelector('[data-arrange-key="'+d.key+'"]');
   target?.querySelector('[data-arrange-grip],.rd-course-name')?.focus?.({preventScroll:true});
  }
  function pointerup(event){
   if(pending&&pending.pointerId===event.pointerId){clearPending();return false;}
   if(!drag||drag.keyboard||drag.pointerId!==event.pointerId)return false;
   suppressUntil=Date.now()+650;event.preventDefault?.();
   if(!drag.moved){cancel({quiet:true});return true;}
   drag.x=event.clientX;drag.y=event.clientY;paint();void place();return true;
  }
  function pointercancel(event){if(pending?.pointerId===event.pointerId)clearPending();if(drag?.pointerId===event.pointerId){cancel();return true;}return false;}
  function click(event){
   if(Date.now()>suppressUntil){if(!drag&&event.target?.closest?.('[data-arrange-grip]')){event.preventDefault?.();return event.detail===0?keyboardStart(event.target):true;}return false;}
   event.preventDefault?.();event.stopImmediatePropagation?.();return true;
  }
  function keyboardStart(target){const info=source(target);if(!info)return false;lift(info,{target},true);drag.targets=(info.kind==='course'?cards():panels()).filter(n=>n!==info.node);drag.targetIndex=0;return true;}
  function keydown(event){
   if(drag&&event.key==='Escape'){event.preventDefault();cancel();return true;}
   if(drag?.keyboard){
    if(event.key==='Enter'||event.key===' '){event.preventDefault();void place();suppressUntil=Date.now()+400;return true;}
    if(event.key==='Tab'){event.preventDefault();drag.targetIndex=(drag.targetIndex+(event.shiftKey?-1:1)+drag.targets.length)%drag.targets.length;const node=drag.targets[drag.targetIndex];if(node){showHud(`Choose an edge of ${node.querySelector('.rd-rail-name')?.textContent||M.LABELS[keyOf(node)]} with the arrow keys`);announce(hud.textContent);}return true;}
    if(event.key.startsWith('Arrow')){
     event.preventDefault();const edge={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'top',ArrowDown:'bottom'}[event.key];
     if(drag.kind==='rail')preview({type:'navigation',value:edge==='top'||edge==='right'?'topbar':'sidebar'});
     else if(drag.kind==='course'){
      const ordered=cards(),at=ordered.indexOf(drag.node),delta=['left','top'].includes(edge)?-1:1,target=ordered[at+delta];
      if(target)preview({type:'course-move',key:drag.key,target:keyOf(target),position:delta<0?'before':'after',ids:getCourseIds()});
     }else {const target=drag.targets[drag.targetIndex];if(target)preview(['left','right'].includes(edge)?sideCommand(keyOf(target),edge):{type:'dock',key:drag.key,target:keyOf(target),edge});}
     return true;
    }
   }
   if((event.key===' '||event.key==='Enter'&&event.altKey)&&event.target?.closest?.('[data-arrange-grip]')){event.preventDefault();return keyboardStart(event.target);}
   if(event.altKey&&event.key===' '&&event.target?.closest?.('[data-arrange-course]')){event.preventDefault();return keyboardStart(event.target);}
   return false;
  }
  function action(button){
   const kind=button?.dataset?.rdAction;
   const type={'arrange-undo':'undo','arrange-reset':'reset','arrange-restore':'restore-context','arrange-hide':'hide-context'}[kind];
   if(!type)return false;cancel({quiet:true});void commit({type},type==='undo'?'Previous arrangement restored.':'Arrangement saved.');return true;
  }
  function contextmenu(event){if(!drag)return false;event.preventDefault();return true;}
  function sync(){
   if(drag&&!drag.node.isConnected)cancel({quiet:true});
   if(!drag)applyLayout();
   const desk=main();if(observer&&desk!==observed){if(observed)observer.unobserve(observed);if(desk)observer.observe(desk);observed=desk;}
   for(const grip of all('[data-arrange-grip]'))grip.removeAttribute('aria-pressed');
  }
  const observer=win.ResizeObserver?new win.ResizeObserver(entries=>{const width=entries[0]?.contentRect.width||0;if(Math.abs(width-observedWidth)<1)return;observedWidth=width;if(drag)cancel();applyLayout();}):null;
  function outsideUp(event){if(pending?.pointerId===event.pointerId)clearPending();}
  function lostCapture(event){if(drag&&!drag.keyboard&&drag.pointerId===event.pointerId)cancel();}
  const blur=()=>cancel();
  doc.addEventListener?.('pointerup',outsideUp);doc.addEventListener?.('lostpointercapture',lostCapture);win.addEventListener?.('blur',blur);
  function destroy(){dead=true;revision++;cancel({quiet:true});clearPending();clearVisuals();for(const animation of animations.values())animation.cancel();animations.clear();observer?.disconnect();doc.removeEventListener?.('pointerup',outsideUp);doc.removeEventListener?.('lostpointercapture',lostCapture);win.removeEventListener?.('blur',blur);live?.remove();}
  return {active:()=>!!drag,dragging:()=>!!drag,pointerdown,pointermove,pointerup,pointercancel,click,contextmenu,action,keydown,sync,destroy};
 }
 const api={HOLD_MS,HOLD_DELAY_MS,SLOP,create};root.ReserveWorkspaceGestures=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
