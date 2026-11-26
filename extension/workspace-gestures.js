/* Direct manipulation of personal layout only. Original creator: Flzsh. */
(function(root){
 'use strict';
 const HOLD_MS=420,HOLD_DELAY_MS=250,RING_DELAY_MS=130,SLOP=8,ROW_GAP=18,ROW_UNIT=2;
 // The gap between stacked modules with the course dock or the top bar: the desk's own gap there (customize.css gap:32px).
 const FIT_GAP=32;
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
  // The last desk's width and each module's last height, by its key: a desk drawn again starts from them (applyLayout).
  const keySizes=new Map();let lastWidth=0;
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
  // (the layout as drawn: Help on top while it has no place of its own yet)
  const drawnLayout=()=>M.drawn?M.drawn(getSettings()):M.snapshot(getSettings()).layout;
  // The desk's own column gap (32 px; 16 px on a phone; a theme may set its own), read when a desk is new and when its width
  // changes, never on the way in between: the grid works the gaps into every module's width (workspace-arrange.js grid).
  // (its side padding too, which a theme may give it: the modules share the width inside it)
  let deskGap=null,deskPad=0;
  const gapOf=desk=>{
    if(deskGap===null){
      const cs=win.getComputedStyle?.(desk),v=parseFloat(cs?.columnGap),pad=(parseFloat(cs?.paddingLeft)||0)+(parseFloat(cs?.paddingRight)||0);
      deskGap=Number.isFinite(v)&&v>=0?v:0;
      deskPad=pad>0?pad:0;
    }
    return deskGap;
  };
  function applyLayout(layout=drawnLayout()){
   const desk=main();if(!desk)return;
   // The Assignments tab is the list beside the reader, whatever Home looks like.
   const fixed=container.dataset.workPage==='assignments';if(fixed)layout={axis:'x',children:['work','reader']};
   // While dragging, a hidden course-information panel keeps its place only if it is actually drawn (Lite never draws it).
   if(getSettings().showCourseInformation===false&&(!drag||!panels().some(node=>node.dataset.arrangeKey==='context')))layout=M.prune(layout,'context');
   // A module the saved layout names but this page does not draw (its feature is off, an AI module that has gone) is
   // left out of this layout only, so the drawn ones share the width instead of standing beside an empty column. The
   // saved layout keeps it, and it comes back in its place when it is drawn again.
   {
     const drawn=new Set(panels().map(node=>node.dataset.arrangeKey));
     if(drawn.size)for(const key of M.leaves(layout))if(!drawn.has(key))layout=M.prune(layout,key)||layout;
   }
   // Home drawn again (a room folded back into its module, a page swapped for Home): the new desk and its modules have
   // no sizes yet, and reading them here laid the whole new page out inside the render, before the frame laid it out
   // again. They start from the sizes the last desk had (the same window, the same modules), so the writes below go in
   // before the first layout; the observer reports the real sizes after the frame's own layout and lays out again, in
   // that frame, only what differs. The first desk of all is still measured here.
   // (a desk drawn again keeps the last desk's gap, as it keeps its width, so nothing is read in the render; the observer reads
   // both again when the width changes, after the frame's own layout)
   if(desk!==observed){const was=observed;observed=desk;observedWidth=was&&lastWidth?lastWidth:0;layoutMemo=null;}
   const gap=gapOf(desk),width=Math.max(0,(observedWidth||desk.clientWidth||desk.getBoundingClientRect().width)-deskPad),list=panels(),heights={};
   let measured=false;
   lastWidth=width+deskPad;
   // Observer sizes are border-box heights, like offsetHeight. Unknown sizes are read before any style write.
   for(const node of list){
     const key=node.dataset.arrangeKey,h=panelSizes.get(node)??keySizes.get(key)??(Number(node.offsetHeight)||0);
     heights[key]=h;
     if(h>0){measured=true;keySizes.set(key,h);}
   }
   // a width chosen a moment ago (previewSize) is laid out at once, before its save comes back
   const saved=M.sizes?M.sizes(getSettings()):getSettings().moduleSize||{};
   if(sizeOverride){for(const [k,v] of Object.entries(sizeOverride))if((saved[k]||'m')===v)delete sizeOverride[k];if(!Object.keys(sizeOverride).length)sizeOverride=null;}
   const fits=['dock','topbar'].includes(container.dataset.courseNavigation),
     sizes=fixed?{reader:'l'}:sizeOverride?Object.fromEntries(Object.entries({...saved,...sizeOverride}).filter(([,v])=>v!=='m')):saved,
     signature=JSON.stringify([layout,width,sizes,heights,fits,drag?.key||'',gap]);
   if(layoutMemo?.desk===desk&&layoutMemo.signature===signature&&list.length===layoutMemo.list.length&&list.every((node,i)=>node===layoutMemo.list[i]))return;
   const spec=M.grid(layout,width,sizes,gap);layoutMemo={desk,signature,list};
   // Written only when it changed, so an unchanged layout costs no restyle.
   const put=(node,name,value)=>{if(node.style.getPropertyValue?.(name)!==value)node.style.setProperty(name,value);};
   put(desk,'--rd-layout-columns',spec.columns);
   // (each module's own box inside its columns: a few pixels of margin either side, customize.css)
   for(const node of list){
     const cell=spec.cells[node.dataset.arrangeKey];
     if(cell){put(node,'--rd-panel-column',cell.column);put(node,'--rd-panel-inset-l',(cell.inset?.[0]||0)+'px');put(node,'--rd-panel-inset-r',(cell.inset?.[1]||0)+'px');}
   }
   // Column rewraps deliver fresh heights through ResizeObserver before paint, without a read-after-write flush.
   // The course dock and the top bar use the same measured rows when a stack stands beside other modules: their CSS turns
   // the fitted fraction rows into automatic ones (responsive-layout.css), where a module stacked under a short one waited
   // for the tall module beside them. Without such a stack automatic rows already place every module right, and they keep
   // the fitted path of 4.0.164 (measured rows lay the desk out again whenever a module's height changes). They keep their
   // own look: the desk's 32 px gap between stacked modules, no outline drawn down to a row's end.
   const stacked=node=>!!node&&typeof node!=='string'&&(node.axis==='x'&&node.children.some(child=>child?.axis==='y')||node.children.some(stacked));
   if(measured&&M.rows&&(!fits||stacked(spec.resolved))){
    const placed=M.rows(spec.resolved,heights,fits?{gap:FIT_GAP,unit:ROW_UNIT,slack:0}:{gap:ROW_GAP,unit:ROW_UNIT});
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
      if(panelSizes.get(node)!==height){panelSizes.set(node,height);if(height>0&&node.dataset?.arrangeKey)keySizes.set(node.dataset.arrangeKey,height);changed=true;}
    }
   }
   // (the desk's gap and padding are read again here, after the frame's layout, where reading costs nothing: a theme that
   // changes them changes the modules' sizes too)
   if(changed){if(drag&&!widthChanged)return;if(drag)cancel();deskGap=null;applyLayout();}
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
   drag.offsetX=drag.x-rect.left;drag.offsetY=drag.y-rect.top;drag.seen=info.kind==='course'?undefined:scrolled();
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
   if(saved===false){
     if(command?.type==='size'&&sizeOverride){clearTimeout(overrideTimer);sizeOverride=null;layoutMemo=null;}
     applyLayout();
     announce('The change could not be saved. Your previous layout was restored.');
     return false;
   }
   applyLayout();if(before&&navigation===(getSettings().courseNavigation||'sidebar'))flip(before);announce(message);return true;
  }
  // What scrolls Home under a held module: the work area (course dock), the shell (top bar), or with the courses on the left
  // the work column when it scrolls by itself (dashboard.js reserve-fit, overflow auto). Looked at once per lift.
  function scrollArea(){
   if(!drag)return null;
   if(drag.area===undefined){const nav=container.dataset.courseNavigation,column=container.querySelector('.rd-shell > .rd-workspace');
    drag.area=drag.kind==='course'?null:nav==='dock'?column:nav==='topbar'?container.querySelector('.rd-shell'):column&&/(auto|scroll)/.test(win.getComputedStyle?.(column)?.overflowY||'')?column:null;}
   return drag.area;
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
     // (the bottom of what can be seen: the window's, or the scrolling column's when Home scrolls inside one)
     const area=scrollArea(),view=area&&area.scrollHeight>area.clientHeight+2?Math.min(win.innerHeight,area.getBoundingClientRect().bottom):win.innerHeight;
     const top=Math.max(desk.top,70),bottom=Math.min(desk.bottom,view-8);
     // (the desk's own edges begin where the modules end: a module's own edge, even the outermost one's, is the module's;
     // until 4.0.194 the last 10-12 px inside the outer modules made a whole column or row instead)
     if(x>=desk.left-30&&x<=desk.right+30){
      if(y<=desk.top+2)return {type:'dock',key:drag.key,target:M.ROOT,edge:'top'};   // anywhere above the modules means a row across the top
      if(desk.bottom<=view+1&&y>=desk.bottom-2)return {type:'dock',key:drag.key,target:M.ROOT,edge:'bottom'};
     }
     if(y>=top&&y<=bottom){
      if(x>=desk.left-60&&x<=desk.left+2)return {type:'dock',key:drag.key,target:M.ROOT,edge:'left'};
      if(x>=desk.right-2&&x<=desk.right+60)return {type:'dock',key:drag.key,target:M.ROOT,edge:'right'};
     }
    }}
   // The module under the pointer is the target; only in a gap the nearest one within 24 px (until 4.0.194 the first module in the
   // page's order within 24 px won, so the pointer on the top of a module just below another dropped "below" the one above).
   const boxOf=original=>{
     const r={...original,left:original.left,top:original.top,right:original.right,bottom:original.bottom,width:original.width,height:original.height};
     r.bottom=Math.min(r.bottom,win.innerHeight-40);
     r.height=r.bottom-r.top;
     return r;
   };
   const away=r=>Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom));
   const ranked=entries.map(([node,original])=>[node,original,away(boxOf(original))]).filter(([,,d])=>d<=24).sort((a,b)=>a[2]-b[2]);
   for(const [node,original] of ranked){
    // Stable targets avoid a moving-target loop while neighbours make room.
    const r=boxOf(original);
    if(drag.kind==='course')
      return {type:'course-move',key:drag.key,target:keyOf(node),position:(drag.originalNavigation==='topbar'?x<r.left+r.width/2:y<r.top+r.height/2)?'before':'after',ids:getCourseIds()};
    // Crossing into a neighbouring column means exchange places, even when
    // the pointer started near the top of its heading. Only a deliberate
    // vertical move to a top/bottom edge creates a stack.
    const dx=x-drag.startX,dy=y-drag.startY,edge=M.edgeAt(r,x,y);
    // A diagonal trip to a panel's bottom still means "below". Heading-to-
    // heading horizontal movement remains a swap, even near the top edge.
    const band=Math.min(90,Math.max(38,r.height*.22));
    // (the bottom band means below, from whichever side the module comes: until 4.0.194 only a module carried DOWN to it did,
    // and one brought up or across to a module's bottom exchanged places with it)
    if(y>=r.bottom-band&&(dy>56||Math.abs(dx)<=Math.abs(dy)*1.15||y>=r.bottom-band/2))return {type:'dock',key:drag.key,target:keyOf(node),edge:'bottom'};
    if(dy< -56&&y<=r.top+band)return {type:'dock',key:drag.key,target:keyOf(node),edge:'top'};
    const horizontal=Math.abs(dx)>Math.abs(dy)*1.15;
    if(horizontal||!edge||['left','right'].includes(edge)){
     // Across: the middle of a module exchanges places with it; its left or right third puts the module beside it, on that
     // side (until 4.0.194 anywhere across another column exchanged places, so a module carried to the far end of a row sent the one
     // there back to where it came from).
     const third=(x-r.left)/Math.max(1,r.width);
     if(third<.3||third>.7)return {type:'dock',key:drag.key,target:keyOf(node),edge:third<.3?'left':'right'};
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
  // the drop place's own short name, as the tag on it says it: where, never who
  function placeName(c){
    const name=k=>M.label?.(k)||M.LABELS[k]||'';
    return c.type==='swap'?
      `In place of ${name(c.target)}`:
      c.type==='dock'&&c.target===M.ROOT?
        ({left:'A column on the left',right:'A column on the right',top:'A row across the top',bottom:'A row across the bottom'})[c.edge]:
        c.type==='dock'?`${({left:'Left of',right:'Right of',top:'Above',bottom:'Below'})[c.edge]} ${name(c.target)}`:c.type==='hide-context'?'Put away':c.type==='navigation'?(c.value==='topbar'?'Across the top':'On the left'):'';
  }
  function preview(c){
   if(!drag||JSON.stringify(c)===JSON.stringify(drag.drop))return;
   const before=measure(drag.kind==='course'?cards():panels());
   for(const node of before.keys())stopAnimation(node);
   restore(false);drag.drop=c;
   if(!c){slot.hidden=true;flip(before);return;}
   if(c.type==='dock')applyLayout(M.dock(drawnLayout(),c.key,c.target,c.edge));
   if(c.type==='swap')applyLayout(M.swap(drawnLayout(),c.key,c.target));
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
   // The drop place is drawn: the pen outline round where the module will land, and its name on a kraft tag (customize.css).
   const label=textFor(c);slot.textContent='';slot.dataset.kind=drag.kind;slot.setAttribute('aria-label',label);
   if(drag.kind!=='course'){const tag=doc.createElement('span');tag.className='rd-snap-tag';tag.textContent=placeName(c);slot.append(tag);}
   if(drag.keyboard)showHud(`${label} · Enter to place`);announce(label);
  }
  // Where Home stands scrolled (its own column and the page): the places a module can go are measured at the lift, so a scroll
  // that is not the held module's own (the wheel, or the browser keeping its place while a preview changes heights above the
  // view) moves them by as much (until 4.0.194 they stayed where they had been, and a drop landed on the module that had been
  // there before the scroll).
  const scrolled=()=>{
    const shell=container.querySelector('.rd-shell'),column=container.querySelector('.rd-shell > .rd-workspace'),page=doc.scrollingElement;
    return (column?.scrollTop||0)+(shell?.scrollTop||0)+(page?.scrollTop||0);
  };
  function followScroll(){
   if(!drag||drag.kind==='course')return;const now=scrolled(),moved=now-(drag.seen??now);drag.seen=now;
   if(moved)for(const [n,b] of drag.stable)drag.stable.set(n,{...b,left:b.left,right:b.right,width:b.width,height:b.height,top:b.top-moved,bottom:b.bottom-moved});
  }
  function paint(){
   frame=0;if(!drag||drag.keyboard)return;
   stopAnimation(ghost);ghost.style.transform=`translate(${drag.x-drag.startX}px,${drag.y-drag.startY}px) scale(1.015)`;
   followScroll();
   const candidate=candidateAt(drag.x,drag.y);
   // A small boundary deadband stops the preview oscillating between corners.
   if(JSON.stringify(candidate)!==JSON.stringify(drag.drop)&&drag.drop&&drag.lastSnap&&Math.hypot(drag.x-drag.lastSnap.x,drag.y-drag.lastSnap.y)<20)return;
   if(JSON.stringify(candidate)!==JSON.stringify(drag.drop))drag.lastSnap={x:drag.x,y:drag.y};
   preview(candidate);
   // Scroll the course list or page gently when the held object reaches its edge.
   const rail=railNode(),horizontal=drag.kind==='course'&&drag.originalNavigation==='topbar';
   // With the course dock or the top bar the Canvas page does not scroll (startup.css reserve-fit): Home scrolls inside
   // its work area (dock) or its shell (top bar), so that is what a module held at the edge scrolls.
   // With the courses on the left, Home's work column scrolls by itself too on a wide window (dashboard.js reserve-fit when
   // its overflow is auto): it is that column a module held at the edge scrolls (until 4.0.194 the page was scrolled, which
   // could not move, so a place below the visible part of Home could not be reached). Looked at once per lift.
   const area=scrollArea();
   const scroller=horizontal?rail:drag.kind==='course'&&rail.scrollHeight>rail.clientHeight+2?rail:area&&area.scrollHeight>area.clientHeight+2?area:doc.scrollingElement;
   const r=scroller===doc.scrollingElement?{top:0,bottom:win.innerHeight,left:0,right:win.innerWidth}:scroller?.getBoundingClientRect();
   if(!r)return;
   const p=horizontal?drag.x:drag.y,low=horizontal?r.left:r.top,high=horizontal?r.right:r.bottom;
   const speed=p<low+52?-Math.ceil((low+52-p)/7):p>high-52?Math.ceil((p-high+52)/7):0;
   // (a module held anywhere past the edge of Home's scrolling column, down to the window's own edge, scrolls it as well)
   if(speed&&(p>=low-15&&p<=high+15||drag.kind!=='course'&&scroller===area)){
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
      if(drag.kind!=='course')drag.seen=scrolled();
      frame=raf(paint);
    }
   }
  }
  // A module's width, by hand: its right edge (the last 12 px inside it) or its bottom-right corner (24 px) is held and
  // pulled; the width steps through the three the menu has (Narrow, Normal, Wide), laid out live, its name on a kraft tag
  // by the pointer, saved when let go. Only the width: a module's height is its content's. Escape puts it back.
  const EDGE=12,CORNER=24,STEP_NAMES={s:'Narrow',m:'Normal',l:'Wide'};
  let sizing=null,grab=null,mark=null,sizeTag=null,hoverAt=null,hoverFrame=0;
  const unmark=()=>{if(grab||mark)showGrab(null);};
  function sizeZone(event){
   if(drag||pending||sizing||saving||dead||container.dataset.workspace!=='work'||container.dataset.workPage==='assignments')return null;
   const target=event.target;if(!target?.closest||target.closest('a,button,input,textarea,select,label,summary,iframe,[contenteditable="true"]'))return null;
   const node=target.closest('[data-arrange-key]'),desk=main();if(!node||!desk||node.parentNode!==desk||!M.isKey?.(node.dataset.arrangeKey))return null;
   const r=node.getBoundingClientRect(),x=event.clientX,y=event.clientY;if(!(r.width>0))return null;
   const corner=x>=r.right-CORNER&&y>=r.bottom-CORNER&&x<=r.right+1&&y<=r.bottom+1,edge=x>=r.right-EDGE&&x<=r.right+1&&y>=r.top+10&&y<=r.bottom+1;
   return corner||edge?{node,key:node.dataset.arrangeKey,edge:corner?'corner':'edge',rect:r,y}:null;
  }
  function showGrab(zone){
   const node=zone?.node||null,edge=zone?.edge||'';
   if(grab&&(grab.node!==node||grab.edge!==edge)){delete grab.node.dataset.sizeGrab;grab=null;}
   if(node&&!grab){node.dataset.sizeGrab=edge;grab={node,edge};}
   if(!node){mark?.remove();mark=null;return;}
   if(!mark){mark=make('rd-size-mark');mark.setAttribute('aria-hidden','true');}
   // (2026-11-23: the edge's mark stands where the pointer is. It stood at the module's middle, which on a tall module is
   // off the window: the student pointed at the edge and saw no mark at all.)
   const r=zone.rect,mid=Number.isFinite(zone.y)?zone.y:r.top+r.height/2;
   mark.dataset.edge=edge;
   mark.style.left=(r.right-(edge==='corner'?18:7))+'px';
   mark.style.top=(edge==='corner'?r.bottom-18:Math.max(r.top+12,Math.min(r.bottom-44,mid-14)))+'px';
  }
  // the module's width at each step, from the same arithmetic that lays the desk out
  function stepWidths(key){
   // (laid out as applyLayout lays it out: only the modules this page draws)
   let layout=drawnLayout();const here=new Set(panels().map(node=>node.dataset.arrangeKey));if(getSettings().showCourseInformation===false)here.delete('context');
   for(const k of M.leaves(layout))if(!here.has(k))layout=M.prune(layout,k)||layout;
   const desk=main(),
     saved={...(M.sizes?M.sizes(getSettings()):getSettings().moduleSize||{}),...(sizeOverride||{})},
     width=Math.max(0,(observedWidth||desk?.clientWidth||0)-deskPad),
     gap=deskGap??0;
   return Object.fromEntries((M.STEPS||['s','m','l']).map(step=>{
     const sizes=Object.fromEntries(Object.entries({...saved,[key]:step}).filter(([,v])=>v!=='m'));
     return [step,M.grid(layout,width,sizes,gap).boxes?.[key]?.w??0];
   }));
  }
  // (the step's name with the menu's own box drawing for it beside the word: widgets.js openMenu, the same three boxes)
  const SIZE_BOX={Narrow:[12,10],Normal:[9,16],Wide:[5,24]};
  function showSizeTag(x,y,text){if(!sizeTag){sizeTag=make('rd-size-tag');sizeTag.setAttribute('aria-hidden','true');}
   if(sizeTag._said!==text){
     sizeTag._said=text;
     sizeTag.textContent=text;
     const box=SIZE_BOX[text];
     if(box)sizeTag.insertAdjacentHTML?.('afterbegin',`<svg viewBox="0 0 34 24" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="31" height="21" rx="3.5"/><rect class="on" x="${box[0]}" y="5" width="${box[1]}" height="14" rx="2"/></svg>`);
   }
   sizeTag.style.left=x+14+'px';sizeTag.style.top=y-34+'px';}
  function sizeDown(event){
   const zone=sizeZone(event);if(!zone)return false;
   event.preventDefault?.();clearPending();
   const now=(M.sizes?M.sizes(getSettings()):getSettings().moduleSize||{})[zone.key]||'m';
   sizing={...zone,pointerId:event.pointerId,startX:event.clientX,startW:zone.rect.width,from:now,size:now,widths:stepWidths(zone.key)};
   try{container.setPointerCapture?.(event.pointerId);}catch{}
   container.dataset.sizing=zone.edge;
   showSizeTag(event.clientX,event.clientY,STEP_NAMES[now]);
   announce(`${M.label?.(zone.key)||M.LABELS[zone.key]}: ${STEP_NAMES[now]}. Move left or right, then let go. Escape cancels.`);
   return true;
  }
  function sizeMove(event){
   if(!sizing||event.pointerId!==sizing.pointerId)return false;event.preventDefault?.();
   const want=sizing.startW+(event.clientX-sizing.startX),w=sizing.widths;
   // the nearest step that really changes the width; among equal widths the one it has now
   let best=sizing.size,far=Math.abs(w[best]-want);for(const step of Object.keys(w)){const d=Math.abs(w[step]-want);if(d<far-2){best=step;far=d;}}
   showSizeTag(event.clientX,event.clientY,STEP_NAMES[best]);
   if(best!==sizing.size){
     sizing.size=best;
     const before=measure(panels());
     previewSize(sizing.key,best,{hold:true});
     flip(before);
     showGrab(null);
     announce(`${M.label?.(sizing.key)||M.LABELS[sizing.key]}: ${STEP_NAMES[best]}`);
   }
   return true;
  }
  function endSizing(){
    if(!sizing)return null;
    const s=sizing;
    sizing=null;
    try{if(container.hasPointerCapture?.(s.pointerId))container.releasePointerCapture(s.pointerId);}catch{}
    delete container.dataset.sizing;
    sizeTag?.remove();
    sizeTag=null;
    showGrab(null);
    return s;
  }
  function sizeUp(event){
   if(!sizing||event.pointerId!==sizing.pointerId)return false;event.preventDefault?.();suppressUntil=Date.now()+400;
   const s=endSizing();if(s.size===s.from){previewSize(s.key,s.from);return true;}
   void commit({type:'size',key:s.key,value:s.size},`${M.label?.(s.key)||M.LABELS[s.key]}: ${STEP_NAMES[s.size]}. Saved.`,null);return true;
  }
  function sizeCancel(){
    const s=endSizing();
    if(!s)return false;
    if(s.size!==s.from){const before=measure(panels());previewSize(s.key,s.from);flip(before);}
    announce('Width unchanged.');
    return true;
  }
  // Shift+Left / Shift+Right on a module's grip or its "..." button: one step narrower or wider.
  function sizeKey(event){
   if(drag||sizing||!event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight'].includes(event.key))return false;
   // (the page hears keys on the document: the element that has focus is the first in the event's path, not its target)
   const at=event.composedPath?.()[0]||event.target,tool=at?.closest?.('[data-arrange-grip],.rd-arrange-more'),node=tool?.closest?.('[data-arrange-key]');if(!node||node.parentNode!==main())return false;
   const key=node.dataset.arrangeKey;if(!M.isKey?.(key))return false;event.preventDefault?.();
   const steps=M.STEPS||['s','m','l'],
     now=(M.sizes?M.sizes(getSettings()):getSettings().moduleSize||{})[key]||'m',
     next=steps[Math.max(0,Math.min(steps.length-1,steps.indexOf(now)+(event.key==='ArrowRight'?1:-1)))];
   if(next===now){announce(`${M.label?.(key)||M.LABELS[key]} is already ${STEP_NAMES[now]}.`);return true;}
   const before=measure(panels());previewSize(key,next);flip(before);
   void commit({type:'size',key,value:next},`${M.label?.(key)||M.LABELS[key]}: ${STEP_NAMES[next]}. Saved.`,null);return true;
  }
  function pointerdown(event){
   if(event.isPrimary===false){cancel();sizeCancel();return false;}
   if(event.button===0&&!event.ctrlKey&&!event.metaKey&&sizeDown(event))return true;
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
   if(sizing)return sizeMove(event);
   // (where the pointer is over a module's edge or corner: looked at once a frame, not on every move)
   if(!drag&&!pending&&!event.buttons){
     hoverAt={target:event.target,clientX:event.clientX,clientY:event.clientY};
     if(!hoverFrame)hoverFrame=raf(()=>{hoverFrame=0;const at=hoverAt;hoverAt=null;if(at&&!drag&&!pending&&!sizing)showGrab(sizeZone(at));});
   }
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
   if(sizing)return sizeUp(event);
   if(pending&&pending.pointerId===event.pointerId){clearPending();return false;}
   if(!drag||drag.keyboard||drag.pointerId!==event.pointerId)return false;
   suppressUntil=Date.now()+650;event.preventDefault?.();
   if(!drag.moved){cancel({quiet:true});return true;}
   drag.x=event.clientX;drag.y=event.clientY;paint();void place();return true;
  }
  function pointercancel(event){
    if(sizing?.pointerId===event.pointerId){sizeCancel();return true;}
    if(pending?.pointerId===event.pointerId)clearPending();
    if(drag?.pointerId===event.pointerId){cancel();return true;}
    return false;
  }
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
   if(sizing&&event.key==='Escape'){event.preventDefault();sizeCancel();return true;}
   if(drag&&event.key==='Escape'){event.preventDefault();cancel();return true;}
   if(sizeKey(event))return true;
   if(drag?.keyboard){
    if(event.key==='Enter'||event.key===' '){event.preventDefault();void place();suppressUntil=Date.now()+400;return true;}
    if(event.key==='Tab'){
      event.preventDefault();
      drag.targetIndex=(drag.targetIndex+(event.shiftKey?-1:1)+drag.targets.length)%drag.targets.length;
      const node=drag.targets[drag.targetIndex];
      if(node){showHud(`Choose an edge of ${node.querySelector('.rd-rail-name')?.textContent||M.LABELS[keyOf(node)]} with the arrow keys`);announce(hud.textContent);
     // (a module chosen with Tab: Enter at once puts it in that module's place, as the middle of a module does by hand)
     if(drag.kind==='panel'){drag.drop=null;preview({type:'swap',key:drag.key,target:keyOf(node)});showHud(`${textFor(drag.drop)} · arrows for an edge · Enter to place`);}}return true;}
    if(event.key.startsWith('Arrow')){
     event.preventDefault();const edge={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'top',ArrowDown:'bottom'}[event.key];
     if(drag.kind==='rail')preview({type:'navigation',value:edge==='top'||edge==='right'?'topbar':'sidebar'});
     else if(drag.kind==='course'){
      const ordered=cards(),at=ordered.indexOf(drag.node),delta=['left','top'].includes(edge)?-1:1,target=ordered[at+delta];
      if(target)preview({type:'course-move',key:drag.key,target:keyOf(target),position:delta<0?'before':'after',ids:getCourseIds()});
     }else {const target=drag.targets[drag.targetIndex];if(target)preview({type:'dock',key:drag.key,target:keyOf(target),edge});}
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
   if(!type)return false;cancel({quiet:true});
   // A width picked a moment ago (previewSize) must not stay drawn over the widths Undo move gives back.
   if(type==='undo'&&sizeOverride){clearTimeout(overrideTimer);sizeOverride=null;layoutMemo=null;}
   void commit({type},type==='undo'?'Previous arrangement restored.':'Arrangement saved.');return true;
  }
  function contextmenu(event){if(!drag)return false;event.preventDefault();return true;}
  // A module's width (Narrow, Normal, Wide) is laid out the moment it is chosen: the press glides the modules at once
  // instead of waiting for the save and a whole render (widgets.js reflow). The save's settings take over when they
  // come; a save that never comes lets the override go after 3 s.
  let sizeOverride=null,overrideTimer=0;
  function previewSize(key,size,{hold=false}={}){
   if(dead||!Object.hasOwn(M.SIZES||{},size)||M.isKey&&!M.isKey(key))return false;
   sizeOverride={...(sizeOverride||{}),[key]:size};layoutMemo=null;if(!drag)applyLayout();
   // (held while an edge is being pulled: nothing is saved until it is let go)
   clearTimeout(overrideTimer);if(!hold)overrideTimer=setTimeout(()=>{if(dead||!sizeOverride)return;sizeOverride=null;layoutMemo=null;if(!drag)applyLayout();},3000);
   return true;
  }
  function sync(){
   if(drag&&!drag.node.isConnected)cancel({quiet:true});
   if(!drag)applyLayout();
   for(const grip of all('[data-arrange-grip]'))grip.removeAttribute('aria-pressed');
  }
  function outsideUp(event){if(pending?.pointerId===event.pointerId)clearPending();}
  function lostCapture(event){if(drag&&!drag.keyboard&&drag.pointerId===event.pointerId)cancel();if(sizing?.pointerId===event.pointerId)sizeCancel();}
  const blur=()=>{cancel();sizeCancel();};
  doc.addEventListener?.('pointerup',outsideUp);doc.addEventListener?.('lostpointercapture',lostCapture);win.addEventListener?.('blur',blur);
  // the edge mark is drawn where the module was: a scroll takes it away until the pointer moves again
  doc.addEventListener?.('scroll',unmark,{capture:true,passive:true});container.addEventListener?.('pointerleave',unmark);
  function destroy(){
    dead=true;
    revision++;
    cancel({quiet:true});
    endSizing();
    mark?.remove();
    mark=null;
    clearPending();
    clearVisuals();
    for(const animation of animations.values())animation.cancel();
    animations.clear();
    sizeWatch?.disconnect();
    doc.removeEventListener?.('pointerup',outsideUp);
    doc.removeEventListener?.('lostpointercapture',lostCapture);
    win.removeEventListener?.('blur',blur);
    doc.removeEventListener?.('scroll',unmark,{capture:true});
    container.removeEventListener?.('pointerleave',unmark);
    caf(hoverFrame);
    hoverFrame=0;
    live?.remove();
  }
  return {
    active:()=>!!drag,
    dragging:()=>!!drag,
    sizing:()=>!!sizing,
    pointerdown,
    pointermove,
    pointerup,
    pointercancel,
    click,
    contextmenu,
    action,
    keydown,
    sync,
    previewSize,
    destroy
  };
 }
 const api={HOLD_MS,HOLD_DELAY_MS,SLOP,create};root.ReserveWorkspaceGestures=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
