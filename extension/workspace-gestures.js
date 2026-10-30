/* Direct manipulation of personal layout only. Original creator: Flzsh. */
(function(root){
 'use strict';
 const HOLD_MS=420,HOLD_DELAY_MS=250,RING_DELAY_MS=130,SLOP=8,ROW_GAP=18,ROW_UNIT=2;
 // The circle drawn round the pointer while a hold runs, as a hand would draw it: a pencil goes round once in ink
 // and overshoots where it began, a second looser pass follows in the accent colour, and three small marks fly
 // off when the thing lifts.
 const RING_PATH='M33 8.2C47.6 6.6 58.8 18.4 58 33.2C57.2 47.8 46 58.4 31.4 57.6C17.4 56.8 6.4 46.2 7.2 31.6C8 18.2 18.6 8 32.6 8.4C35.4 8.5 38.2 9.2 41 10.6';
 const RING_PATH_2='M29.4 5.4C45.4 3.8 60.6 16.6 60.6 32.6C60.6 49 48.4 61 32.2 60.6C16.8 60.2 4 48 4.6 32C5.2 18 14.6 7.4 27.6 5.8';
 const RING_SVG='<svg viewBox="0 0 64 64" width="64" height="64"><path class="rd-hold-paper" pathLength="1" d="'+RING_PATH+'"/><path class="rd-hold-second" pathLength="1" d="'+RING_PATH_2+'"/><path class="rd-hold-first" pathLength="1" d="'+RING_PATH+'"/>'+
  '<g class="rd-hold-marks"><path d="M52.6 7.6l4.6-5.4M59.4 14.2l6-2.4M46 3.2l1.4-5.6"/></g>'+
  '<g class="rd-hold-pencil" style="offset-path:path(\''+RING_PATH+'\')"><path class="rd-pencil-wood" d="M0 0L4.4 -1.5L1.5 -4.4z"/><path class="rd-pencil-body" d="M4.4 -1.5L14 -11.1L11.1 -14L1.5 -4.4z"/><path class="rd-pencil-end" d="M14 -11.1L16 -13.1L13.1 -16L11.1 -14z"/><path class="rd-pencil-lead" d="M0 0L1.7 -.6L.6 -1.7z"/></g></svg>';
 const spring=Array.from({length:25},(_,i)=>{const t=i/24,p=i===24?1:1-(1+9*t)*Math.exp(-9*t);return {offset:t,p};});
 function create({container,getSettings,getCourseIds=()=>[],onChange,onModeChange},M){
  const doc=container.ownerDocument||root.document,win=doc.defaultView||root;
  const raf=cb=>(win.requestAnimationFrame||((f)=>setTimeout(f,16)))(cb),caf=id=>(win.cancelAnimationFrame||clearTimeout)(id);
  let pending=null,drag=null,live=null,hud=null,ghost=null,slot=null,dead=false,saving=false,frame=0,revision=0,suppressUntil=0,observed=null,observedWidth=0;
  const animations=new Map(),panelSizes=new WeakMap();let layoutMemo=null;
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
   const animation=node.animate(
     spring.map(({offset,p})=>({offset,transform:`translate(${from.x+(to.x-from.x)*p}px,${from.y+(to.y-from.y)*p}px) scale(${from.s+(to.s-from.s)*p})`})),
     {duration:260,easing:'linear',fill:'both'});
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
   // The Assignments tab is the list beside the reader, whatever Home looks like.
   const fixed=container.dataset.workPage==='assignments';if(fixed)layout={axis:'x',children:['work','reader']};
   if(getSettings().showCourseInformation===false&&!drag)layout=M.prune(layout,'context');
   if(desk!==observed){observed=desk;observedWidth=0;layoutMemo=null;}
   const width=observedWidth||desk.clientWidth||desk.getBoundingClientRect().width,list=panels(),heights={};let measured=false;
   // Observer sizes are border-box heights, like offsetHeight. Unknown sizes are read before any style write.
   for(const node of list){const h=panelSizes.get(node)??(Number(node.offsetHeight)||0);heights[node.dataset.arrangeKey]=h;if(h>0)measured=true;}
   const fits=container.dataset.courseNavigation==='topbar',
     sizes=fixed?{reader:'l'}:getSettings().moduleSize||{},
     signature=JSON.stringify([layout,width,sizes,heights,fits,drag?.key||'']);
   if(layoutMemo?.desk===desk&&layoutMemo.signature===signature&&list.length===layoutMemo.list.length&&list.every((node,i)=>node===layoutMemo.list[i]))return;
   const spec=M.grid(layout,width,sizes);layoutMemo={desk,signature,list};
   // Written only when it changed, so an unchanged layout costs no restyle.
   const put=(node,name,value)=>{if(node.style.getPropertyValue?.(name)!==value)node.style.setProperty(name,value);};
   put(desk,'--rd-layout-columns',spec.columns);
   for(const node of list){const cell=spec.cells[node.dataset.arrangeKey];if(cell)put(node,'--rd-panel-column',cell.column);}
   // Column rewraps deliver fresh heights through ResizeObserver before paint, without a read-after-write flush.
   if(measured&&M.rows&&!fits){
    const placed=M.rows(spec.resolved,heights,{gap:ROW_GAP,unit:ROW_UNIT});
    put(desk,'--rd-layout-rows','none');if(desk.dataset.rows!=='measured')desk.dataset.rows='measured';
    // A module drawn down to its row's bottom edge keeps its own height; only its outline grows (widgets.css).
    for(const node of list){
      const key=node.dataset.arrangeKey,row=placed.cells[key];
      if(row)put(node,'--rd-panel-row',row);
      put(node,'--rd-panel-grow',placed.fill[key]&&node!==drag?.node?Math.max(0,placed.fill[key]-heights[key])+'px':'0px');
    }
   }else{
    put(desk,'--rd-layout-rows',fits?spec.fitRows:spec.rows);delete desk.dataset.rows;
    for(const node of list){const cell=spec.cells[node.dataset.arrangeKey];if(cell)put(node,'--rd-panel-row',cell.row);if(fits)put(node,'--rd-panel-grow','0px');}
   }
   watch(list);
  }
  // A module that grows or shrinks (a list loads, a note is typed) moves the ones below it.
  let watched=new Set();
  const sizeWatch=win.ResizeObserver?new win.ResizeObserver(entries=>{
   if(dead)return;let changed=false,widthChanged=false;
   for(const entry of entries){
     const node=entry.target,
       box=entry.borderBoxSize?.[0]||entry.borderBoxSize,
       cs=!box?win.getComputedStyle?.(node):null,
       px=(...names)=>names.reduce((n,k)=>n+(parseFloat(cs?.[k])||0),0);
    if(node===observed){
      const border=box?win.getComputedStyle?.(node):null,
        width=box?box.inlineSize-(parseFloat(border?.borderLeftWidth)||0)-(parseFloat(border?.borderRightWidth)||0):(entry.contentRect?.width||0)+px('paddingLeft','paddingRight');
      if(width!==observedWidth){observedWidth=width;changed=widthChanged=true;}
    }
    else if(watched.has(node)){
      const height=Math.round(box?.blockSize??((entry.contentRect?.height||0)+px('paddingTop','paddingBottom','borderTopWidth','borderBottomWidth')));
      if(panelSizes.get(node)!==height){panelSizes.set(node,height);changed=true;}
    }
   }
   if(changed){if(drag&&!widthChanged)return;if(drag)cancel();applyLayout();}
  }):null;
  function watch(list){
   if(!sizeWatch)return;const next=new Set([observed,...list].filter(Boolean));
   for(const node of watched)if(!next.has(node))sizeWatch.unobserve(node);
   for(const node of next)if(!watched.has(node))sizeWatch.observe(node,{box:'border-box'});
   watched=next;
  }
  function restore(smooth=true){
   if(!drag)return;
   const before=measure(drag.kind==='course'?cards():panels());
   if(drag.kind==='course')for(const node of drag.originalNodes){if(node.parentNode)node.parentNode.insertBefore(node,drag.foot||null);}
   else applyLayout();
   if(smooth)flip(before);
  }
  // Hold feedback is a hand-drawn circle that closes at the moment of the lift, not a tint over the panel.
  let ring=null;
  function drawRing(x,y){
   endRing();
   if(reduced())return;
   ring=make('rd-hold-ring');ring.setAttribute('aria-hidden','true');
   ring.style.left=x+'px';ring.style.top=y+'px';ring.style.setProperty('--rd-hold-draw',(HOLD_MS-RING_DELAY_MS)+'ms');
   ring.innerHTML=RING_SVG;
  }
  function endRing(done=false){
   if(!ring)return;const node=ring;ring=null;
   if(done&&!reduced()){node.dataset.done='true';setTimeout(()=>node.remove(),380);}else node.remove();
  }
  function clearPending(lifted=false){
    if(!pending)return;
    clearTimeout(pending.timer);
    clearTimeout(pending.feedbackTimer);
    clearTimeout(pending.ringTimer);
    endRing(lifted);
    pending.node.removeAttribute('data-hold');
    pending.head?.removeAttribute('data-hold');
    pending=null;
  }
  function source(target){
   if(!target?.closest||target.closest('a,input,textarea,select,label,summary,[contenteditable="true"]'))return null;
   const card=target.closest('[data-arrange-course]');
   if(card)return {node:card,head:card,kind:'course',key:card.dataset.arrangeCourse,label:card.querySelector('.rd-rail-name')?.textContent||'Course'};
   const head=target.closest('[data-arrange-head]');
   if(!head||target.closest('button:not([data-arrange-grip])'))return null;
   const key=head.dataset.arrangeHead,node=head.closest('[data-arrange-key]');
   if(!node||key!=='rail'&&(container.dataset.workspace!=='work'||container.dataset.workPage==='assignments'))return null;
   return {node,head,key,kind:key==='rail'?'rail':'panel',label:M.LABELS[key]};
  }
  function showHud(text){if(!hud){hud=make('rd-move-hud');hud.setAttribute('aria-hidden','true');}hud.textContent=text;}
  function cleanClone(node){
   const clone=node.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.setAttribute('inert','');clone.removeAttribute('data-lifted');clone.removeAttribute('data-hold');
   // ID references within drawings remain local to the drawing; prefix them so
   // an animated SVG on the page never acquires the preview's clip/mask definition.
   const nodes=[clone,...clone.querySelectorAll('*')],ids=new Map();
   for(const n of nodes)if(n.id){ids.set(n.id,'rd-lift-'+n.id);n.id='rd-lift-'+n.id;}
   for(const n of nodes)
     for(const attr of [...n.attributes]){
       let value=attr.value;
       for(const [id,replacement] of ids){value=value.split('url(#'+id+')').join('url(#'+replacement+')');if(value==='#'+id)value='#'+replacement;}
       if(value!==attr.value)n.setAttribute(attr.name,value);
     }
   return clone;
  }
  function lift(info,event,keyboard=false){
   const rect=info.node.getBoundingClientRect();
   for(const node of animations.keys())stopAnimation(node);
   clearPending(!keyboard);
   drag={
     ...info,
     pointerId:event.pointerId,
     keyboard,
     x:event.clientX??rect.left+rect.width/2,
     y:event.clientY??rect.top+24,
     startX:event.clientX??rect.left,
     startY:event.clientY??rect.top,
     rect,
     moved:false,
     drop:null,
     candidate:null,
     stable:measure(info.kind==='course'?cards():panels()),
     originalNodes:cards(),
     foot:container.querySelector('.rd-rail-foot'),
     originalNavigation:getSettings().courseNavigation||'sidebar'
   };
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
   {const desk=main()?.getBoundingClientRect?.();
    if(desk&&desk.width>0&&entries.length>1){
     const top=Math.max(desk.top,70),bottom=Math.min(desk.bottom,win.innerHeight-8);
     if(x>=desk.left-30&&x<=desk.right+30){
      if(y<=desk.top+12)return {type:'dock',key:drag.key,target:M.ROOT,edge:'top'};   // anywhere above the modules means a row across the top
      if(desk.bottom<=win.innerHeight-8&&y>=desk.bottom-10)return {type:'dock',key:drag.key,target:M.ROOT,edge:'bottom'};
     }
     if(y>=top&&y<=bottom){
      if(x>=desk.left-60&&x<=desk.left+10)return {type:'dock',key:drag.key,target:M.ROOT,edge:'left'};
      if(x>=desk.right-10&&x<=desk.right+60)return {type:'dock',key:drag.key,target:M.ROOT,edge:'right'};
     }
    }}
   for(const [node,original] of entries){
    const r={...original,left:original.left,top:original.top,right:original.right,bottom:original.bottom,width:original.width,height:original.height};
    // Stable targets avoid a moving-target loop while neighbours make room.
    r.bottom=Math.min(r.bottom,win.innerHeight-40);r.height=r.bottom-r.top;
    if(x<r.left-24||x>r.right+24||y<r.top-24||y>r.bottom+24)continue;
    if(drag.kind==='course')
      return {type:'course-move',key:drag.key,target:keyOf(node),position:(drag.originalNavigation==='topbar'?x<r.left+r.width/2:y<r.top+r.height/2)?'before':'after',ids:getCourseIds()};
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
  function textFor(c){
    return c.type==='swap'?
      `Swap ${M.LABELS[c.key]} with ${M.LABELS[c.target]}`:
      c.type==='dock'&&c.target===M.ROOT?`${M.LABELS[c.key]} ${({left:'as a column on the left',right:'as a column on the right',top:'as a full row at the top',bottom:'as a full row at the bottom'})[c.edge]}`:c.type==='dock'?`${M.LABELS[c.key]} ${({left:'to the left of',right:'to the right of',top:'above',bottom:'below'})[c.edge]} ${M.LABELS[c.target]}`:c.type==='course-move'?`${drag.label} ${c.position} ${cards().find(n=>keyOf(n)===c.target)?.querySelector('.rd-rail-name')?.textContent||'course'}`:c.type==='hide-context'?'Put course information away':`Courses ${c.value==='topbar'?'across the top':'on the left'}`;
  }
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
   if(c.type==='navigation'){
     const r=container.querySelector('.rd-shell').getBoundingClientRect();
     rect={left:r.left,top:r.top,width:c.value==='topbar'?r.width:220,height:c.value==='topbar'?100:Math.min(r.height,win.innerHeight-r.top-20)};
   }
   if(c.type==='hide-context')rect=hud.getBoundingClientRect();
   for(const [prop,value] of Object.entries({left:rect.left,top:rect.top,width:rect.width,height:Math.max(60,Math.min(rect.height,win.innerHeight-rect.top-16))}))
     slot.style[prop]=value+'px';
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
    if(moved){
      for(const [n,b] of drag.stable){
        drag.stable.set(n,{
          left:b.left-(horizontal?moved:0),
          right:b.right-(horizontal?moved:0),
          top:b.top-(horizontal?0:moved),
          bottom:b.bottom-(horizontal?0:moved),
          width:b.width,
          height:b.height
        });
      }
      frame=raf(paint);
    }
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
   pending.ringTimer=setTimeout(()=>{if(pending)drawRing(pending.x,pending.y);},RING_DELAY_MS);
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
  function keyboardStart(target){
    const info=source(target);
    if(!info)return false;
    lift(info,{target},true);
    drag.targets=(info.kind==='course'?cards():panels()).filter(n=>n!==info.node);
    drag.targetIndex=0;
    return true;
  }
  function keydown(event){
   if(drag&&event.key==='Escape'){event.preventDefault();cancel();return true;}
   if(drag?.keyboard){
    if(event.key==='Enter'||event.key===' '){event.preventDefault();void place();suppressUntil=Date.now()+400;return true;}
    if(event.key==='Tab'){
      event.preventDefault();
      drag.targetIndex=(drag.targetIndex+(event.shiftKey?-1:1)+drag.targets.length)%drag.targets.length;
      const node=drag.targets[drag.targetIndex];
      if(node){showHud(`Choose an edge of ${node.querySelector('.rd-rail-name')?.textContent||M.LABELS[keyOf(node)]} with the arrow keys`);announce(hud.textContent);}
      return true;
    }
    if(event.key.startsWith('Arrow')){
     event.preventDefault();const edge={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'top',ArrowDown:'bottom'}[event.key];
     if(drag.kind==='rail')preview({type:'navigation',value:edge==='top'||edge==='right'?'topbar':'sidebar'});
     else if(drag.kind==='course'){
      const ordered=cards(),at=ordered.indexOf(drag.node),delta=['left','top'].includes(edge)?-1:1,target=ordered[at+delta];
      if(target)preview({type:'course-move',key:drag.key,target:keyOf(target),position:delta<0?'before':'after',ids:getCourseIds()});
     }
     else {
       const target=drag.targets[drag.targetIndex];
       if(target)preview(['left','right'].includes(edge)?sideCommand(keyOf(target),edge):{type:'dock',key:drag.key,target:keyOf(target),edge});
     }
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
   for(const grip of all('[data-arrange-grip]'))grip.removeAttribute('aria-pressed');
  }
  function outsideUp(event){if(pending?.pointerId===event.pointerId)clearPending();}
  function lostCapture(event){if(drag&&!drag.keyboard&&drag.pointerId===event.pointerId)cancel();}
  const blur=()=>cancel();
  doc.addEventListener?.('pointerup',outsideUp);doc.addEventListener?.('lostpointercapture',lostCapture);win.addEventListener?.('blur',blur);
  function destroy(){
    dead=true;
    revision++;
    cancel({quiet:true});
    clearPending();
    clearVisuals();
    for(const animation of animations.values())animation.cancel();
    animations.clear();
    sizeWatch?.disconnect();
    doc.removeEventListener?.('pointerup',outsideUp);
    doc.removeEventListener?.('lostpointercapture',lostCapture);
    win.removeEventListener?.('blur',blur);
    live?.remove();
  }
  return {active:()=>!!drag,dragging:()=>!!drag,pointerdown,pointermove,pointerup,pointercancel,click,contextmenu,action,keydown,sync,destroy};
 }
 const api={HOLD_MS,HOLD_DELAY_MS,SLOP,create};root.ReserveWorkspaceGestures=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
