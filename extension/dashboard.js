/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
// Adapted from Gary Wu's pull request #47 to Canvas Harness.
(function(root,factory){
  'use strict';
  const api=factory(root);
  root.ReserveDashboard=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  const CANVAS_ORIGIN=(globalThis.ReserveSite.origin());
  const DAY=86400000;
  const SVG_NS='http://www.w3.org/2000/svg';
  // Clay is the default (2.15). Light clay #A9522F carries text at 4.6:1 or better on every
  const COURSE_COLORS=['#286452','#315f8f','#76549a','#a05252','#9a6a24','#34737a','#6c7443','#8a5573'];
  // surface and white text on it at 5.3:1; dark clay #E08A6A reads at 5:1 or better.
  const ACCENTS={clay:'#A9522F',forest:'#367964',indigo:'#5f5ccc',rose:'#9e4c6c',ocean:'#2f7185',amber:'#956821'};
  const DARK_ACCENTS={clay:'#E08A6A',forest:'#9bd1b4',indigo:'#bec8ff',rose:'#efb0c0',ocean:'#a3d4e5',amber:'#e8c68b'};
  // Pointer actions whose render may animate: each takes a read-only snapshot first.
  const MOTION_STYLES=['gentle','still','off'];
  const MOTION_ACTIONS=new Set(['course','workspace','open-materials','open-hub','course-section','overview-view','overview-all','grades','reader-tab','preview','glance','view','day','check-off','undo-check-off']);
  const Model=root.ReserveDashboardModel||(typeof module==='object'&&module.exports?require('./dashboard-model.js'):null);
  const View=root.ReserveDashboardView||(typeof module==='object'&&module.exports?require('./dashboard-view.js'):null);
  const Work=root.ReserveWorkModel||(typeof module==='object'&&module.exports?require('./work-model.js'):null);
  const Arrange=root.ReserveWorkspaceArrange||(typeof module==='object'&&module.exports?require('./workspace-arrange.js'):null);
  const StudyUI=root.CanvasHarnessStudyUI||(typeof module==='object'&&module.exports?require('./study-ui.js'):null);
  const Band=root.CanvasHarnessStudyBand||(typeof module==='object'&&module.exports?require('./study-band.js'):null);

  const enabled=id=>!globalThis.ReserveFeatures||globalThis.ReserveFeatures.enabled(id);
  const workspaceEnabled=name=>View.workspaceEnabled(name);
  const resolveWorkspace=name=>workspaceEnabled(name)?name:'work';

  const stringValue=value=>value==null?'':String(value);
  function pinHomeCommand(data,command){
    const keys=command?.type==='restore-context'?
      ['context']:
      ['add','move','shift','dock','swap'].includes(command?.type)?[command.key,...(command.type==='swap'?[command.target]:[])]:command?.type==='mode'?Arrange.PANELS:[];
    if(!keys.length)return;
    const pins=new Set(Array.isArray(data.toolbox?.agentPins)?data.toolbox.agentPins:[]);
    for(const key of keys)if(Arrange.isKey(key))pins.add(key);
    data.toolbox={...data.toolbox,agentPins:[...pins]};
  }
  // Reconcile owned UI in place: focus, selection, scrolling and CSS transitions
  const dateMs=value=>{if(value==null||value==='')return null;const ms=typeof value==='number'?value:Date.parse(value);return Number.isFinite(ms)?ms:null;};
  // belong to the existing nodes. Teacher HTML is an opaque, sanitized fragment.
  // Inside a preserved heading only the search field and the at-a-glance chips follow the state.
  function patchLive(heading,next){
    const search='label.rd-work-search',chips='[data-rd-key="glance"]',body=heading.querySelector(':scope>.rd-course-heading');
    for(const selector of [search,chips]){
      const now=heading.querySelector(selector),wanted=next.querySelector(selector);
      if(now&&wanted)patchUI(now,wanted);
      else if(now)now.remove();
      else if(wanted){
        if(selector===search)heading.append(wanted);
        else{const line=body?.querySelector(':scope>p');if(line)line.append(wanted);else body?.append(wanted);}
      }
    }
  }
  // Same rule as storage.js same(): plain objects and arrays by value, anything else by its JSON; no JSON copies of
  // large notes or artwork.
  function sameData(a,b){
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    if(Array.isArray(a)&&a.length!==b.length)return false;
    const kind=Object.prototype.toString.call(a);
    if(kind!==Object.prototype.toString.call(b))return false;
    if(kind!=='[object Object]'&&kind!=='[object Array]')return JSON.stringify(a)===JSON.stringify(b);
    const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameData(a[key],b[key]));
  }
  // The AI engine rewrites the Prepare status on every visit (ai-prepare.js notify), often changing only its revision
  // counter. Nothing the dashboard draws reads that status, so a change confined to the counter needs no render
  // (perf interaction-2). Progress, state, phase or step changes differ here and go to prepareStatusOnly below; any
  // other change renders.
  function prepareRevisionOnly(before,after){
    const x=before?.toolbox?.agent?.prepareStatus,y=after?.toolbox?.agent?.prepareStatus;
    if(!x||!y||typeof x!=='object'||typeof y!=='object'||x.revision===y.revision)return false;
    const mask=d=>({...d,toolbox:{...d.toolbox,agent:{...d.toolbox.agent,prepareStatus:{...d.toolbox.agent.prepareStatus,revision:0}}}});
    return sameData(mask(before),mask(after));
  }
  // A running Prepare or Help question saves its progress, state, phase and step in the account record at every step
  // (ai-prepare.js notify). Only the AI panel's status line shows it (agent-client.js state(), refreshed by
  // toolbox.update()); the Help band follows the run through 'ch-ai-run'. So a change confined to that status refreshes
  // the toolbox instead of redrawing the whole dashboard (perf leaks-2). Keys may come back in any order.
  function prepareStatusOnly(before,after){
    const a=before?.toolbox?.agent,b=after?.toolbox?.agent;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||sameData(a.prepareStatus,b.prepareStatus))return false;
    const sameBut=(x,y,skip)=>{
      const keys=Object.keys(x).filter(key=>key!==skip);
      return keys.length===Object.keys(y).filter(key=>key!==skip).length&&keys.every(key=>Object.hasOwn(y,key)&&sameData(x[key],y[key]));
    };
    return sameBut(before,after,'toolbox')&&sameBut(before.toolbox,after.toolbox,'agent')&&sameBut(a,b,'prepareStatus');
  }
  function patchUI(current,next){
    const nextValue=next.value;
    const key=node=>node.nodeType===1?(node.getAttribute('data-rd-key')||node.id||(node.getAttribute('data-rd-section')?'section:'+node.getAttribute('data-rd-section'):'')):'';
    const compatible=(a,b)=>a&&a.nodeType===b.nodeType&&a.nodeName===b.nodeName&&key(a)===key(b);
    if(current.nodeType!==1){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
    // A drawing that already is the wanted one (same attributes, same children in order) would be walked to change
    // nothing: rail frames, minis and icons are most of a render's nodes (perf interaction-4). Any difference, including
    // one other code wrote on it, still takes the full patch below.
    if(current.localName==='svg'&&current.namespaceURI===SVG_NS&&current.isEqualNode?.(next))return;
    if(current.hasAttribute('data-help-band')&&next.hasAttribute('data-help-band'))return;
    // Only hydrated media owns its children; editor wrappers share the frame id attribute.
    // The placeholder retains the connected heading and its running art film.
    const framedMedia=current.hasAttribute('data-ch-frame')&&next.hasAttribute('data-ch-frame')&&current.dataset.chFrameId&&current.dataset.chFrameId===next.dataset.chFrameId;
    if(next.hasAttribute('data-rd-preserve-heading')&&current.classList.contains('rd-workspace-heading')){patchLive(current,next);return;}
    // Placement belongs to the layout controller; retain it on keyed nodes so unchanged renders need no layout pass.
    const desk=current.classList.contains('rd-desk')&&next.classList.contains('rd-desk'),panel=current.getAttribute('data-arrange-key');
    if(desk||panel&&panel===next.getAttribute('data-arrange-key')){
      for(const name of desk?['--rd-layout-columns','--rd-layout-rows']:['--rd-panel-column','--rd-panel-row','--rd-panel-grow']){
        const value=current.style?.getPropertyValue?.(name);
        if(value)next.style.setProperty(name,value);
      }
      if(desk&&current.hasAttribute('data-rows'))next.setAttribute('data-rows',current.getAttribute('data-rows'));
    }
    // A selection surface keeps the geometry motion.js wrote on it, so a render that leaves the selection in place
    // needs no new snap.
    // A drawing's part that motion.js moves through its custom properties (a living loop, a frame ornament's loop on the
    // film clock) keeps them the same way: the inline --rd-tf/--rd-op and the transform/opacity that read them. A render
    // that dropped them left the loop running on nothing, so the part stood still until something drew it again, and
    // whether it moved depended on when the last render happened.
    if(current.style?.length&&current.style.cssText.includes('--rd-')){
      for(const name of Array.from(current.style))
        if((name.startsWith('--rd-sel-')||name.startsWith('--rd-echo-')||name==='--rd-tf'||name==='--rd-op')&&!next.style.getPropertyValue(name))
          next.style.setProperty(name,current.style.getPropertyValue(name));
      for(const [name,value] of [['transform','var(--rd-tf)'],['opacity','var(--rd-op)']])
        if(current.style.getPropertyValue(name)===value&&!next.style.getPropertyValue(name))next.style.setProperty(name,value);
    }
    for(const attr of Array.from(current.attributes)){
      if(attr.name==='data-motion'||current.tagName==='DETAILS'&&attr.name==='open')continue;
      if(['src','poster'].includes(attr.name)&&current.dataset?.chMedia&&current.dataset.chMedia===next.dataset?.chMedia)continue;
      if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
    }
    for(const attr of Array.from(next.attributes)){
      if(current.tagName==='DETAILS'&&attr.name==='open')continue;
      if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
    }
    // Feature controls own their connected subtree across dashboard refreshes and tab changes.
    if(framedMedia)return;
    // A feature's own drawn place (data-rd-own) keeps the subtree it hung there; only its attributes follow the render.
    if(current.hasAttribute('data-rd-own')&&current.getAttribute('data-rd-own')===next.getAttribute('data-rd-own'))return;
    if(current.getAttribute('data-rd-key')==='features-pane'||current.hasAttribute('data-agent-viewer')&&current.getAttribute('data-agent-viewer')===next.getAttribute('data-agent-viewer'))return;
    if(current.tagName==='INPUT'){if(current.value!==next.value)current.value=next.value;current.checked=next.checked;return;}
    if(current.tagName==='TEXTAREA'){if(current.value!==next.value)current.value=next.value;return;}
    if(current.classList.contains('rd-rich-text')){if(current.innerHTML!==next.innerHTML)current.innerHTML=next.innerHTML;return;}
    const keyed=new Map(Array.from(current.childNodes).filter(key).map(node=>[key(node),node]));
    let cursor=current.firstChild;
    for(const desired of Array.from(next.childNodes)){
      const existing=key(desired)?keyed.get(key(desired)):cursor;
      if(compatible(existing,desired)){
        if(existing!==cursor)current.insertBefore(existing,cursor);
        patchUI(existing,desired);cursor=existing.nextSibling;
      }else{current.insertBefore(desired,cursor);}
    }
    while(cursor){const rest=cursor.nextSibling;cursor.remove();cursor=rest;}
    if(current.tagName==='SELECT'&&current.value!==nextValue)current.value=nextValue;
  }

  function createCourseDock(container,{env=root,save=()=>{},menu=()=>{}}={}){
    let dock=null,items=[],tabId='',observer=null,drag=null,nearFrame=0;
    const num=(v,d)=>{const n=Number(v);return Number.isFinite(n)?n:d;};
    // Its place: dockShift -1..1 of the room either side of the middle of the workspace.
    const room=()=>{
      const r=(container.querySelector('.rd-shell')||container).getBoundingClientRect(),
        view=env.innerWidth||r.right,
        left=Math.max(0,r.left),
        right=Math.min(view,r.right),
        w=dock?.getBoundingClientRect?.().width||0;
      return {left,right,half:Math.max(0,(right-left-w)/2-8)};
    };
    const place=shift=>{const {half}=room();container.style.setProperty('--rd-dock-shift',Math.round(shift*half)+'px');};
    const layout=()=>{
      if(!dock)return;
      const {left,right}=room();
      container.style.setProperty('--rd-dock-center',(left+right)/2+'px');
      container.style.setProperty('--rd-dock-available',Math.max(36,right-left)+'px');
      place(drag?.shift??num(container.dataset.dockShift,0));
    };
    // Pressing the empty shelf moves the dock along the bottom (it settles in the middle when let go near it); the
    // shelf's top edge resizes it. Arrows show where the press would grab, only while the pointer is there.
    const edgeOf=ev=>{
      if(!dock||ev.target.closest?.('.rd-dock-it,.rd-dock-menu'))return '';
      const r=dock.getBoundingClientRect(),top=r.top+num(env.getComputedStyle?.(dock)?.getPropertyValue?.('--rd-dock-headroom')?.replace('px',''),80);
      return ev.clientY<top-2?'':ev.clientY<top+9?'size':'move';
    };
    const hover=ev=>{if(drag)return;const edge=edgeOf(ev);if(edge)dock.dataset.grab=edge;else delete dock.dataset.grab;};
    const down=ev=>{
      if(ev.button!==0)return;
      const edge=edgeOf(ev);
      if(!edge)return;
      ev.preventDefault();
      dock.setPointerCapture?.(ev.pointerId);
      drag={edge,x:ev.clientX,y:ev.clientY,shift:num(container.dataset.dockShift,0),scale:num(container.dataset.dockScale,1),half:room().half};
      dock.dataset.grab=edge;
      dock.dataset.dragging='true';
    };
    const move=ev=>{
      if(!drag)return;
      if(drag.edge==='move'){
        const s=drag.half?Math.max(-1,Math.min(1,(drag.shift*drag.half+ev.clientX-drag.x)/drag.half)):0;
        drag.shiftNow=Math.abs(s)<.06?0:Math.round(s*100)/100;
        place(drag.shiftNow);
      }
      else{const s=Math.max(.7,Math.min(1.5,drag.scale*(1+(drag.y-ev.clientY)/140)));drag.scaleNow=Math.round(s*100)/100;container.style.setProperty('--rd-dock-scale',String(drag.scaleNow));}
    };
    const up=ev=>{
      if(!drag)return;
      const d=drag;
      drag=null;
      delete dock.dataset.dragging;
      dock.releasePointerCapture?.(ev.pointerId);
      if(d.edge==='move'&&d.shiftNow!=null){container.dataset.dockShift=String(d.shiftNow);save({dockShift:d.shiftNow});}
      if(d.edge==='size'&&d.scaleNow!=null){container.dataset.dockScale=String(d.scaleNow);save({dockScale:d.scaleNow});}
    };
    // A right-click on the dock opens its card; a click elsewhere or Escape closes it.
    const context=ev=>{if(!dock)return;ev.preventDefault();menu(true);};
    const outside=ev=>{
      if(!container.querySelector('.rd-dock-menu'))return;
      const path=ev.composedPath?.()||[];
      if(!path.some(n=>n?.classList?.contains?.('rd-dock-menu')||n?.classList?.contains?.('rd-dock')))menu(false);
    };
    const escape=ev=>{if(ev.key==='Escape'&&container.querySelector('.rd-dock-menu')){menu(false);dock?.querySelector('.rd-dock-it[tabindex="0"]')?.focus?.({preventScroll:true});}};
    // Hovering a course plays its drawing once (Lively); the parts move from rest back to rest.
    const play=ev=>{
      const it=ev.target.closest?.('.rd-dock-it');
      if(!it||container.dataset.dockLively==='false'||container.dataset.motionStyle==='off'||env.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
      const M=root.ReserveMotion,svg=it.querySelector('svg.rd-mini');
      if(!M?.loopSpec||!svg||svg.dataset.playing)return;
      const C=M.cycleOf?.(svg)||6,rigs=M.rigsOf?.(svg);
      let longest=0;
      for(const g of svg.querySelectorAll('g.art-loop')){
        const spec=M.loopSpec(g,C,rigs),frames=M.loopFrames(spec,1,{node:g});
        if(!frames.length)continue;
        const t=Math.min(1600,spec.period*1000);
        longest=Math.max(longest,t);
        try{g.animate(frames,{duration:t,iterations:1,easing:'linear'});}catch{}
      }
      if(longest){svg.dataset.playing='true';env.setTimeout?.(()=>{delete svg.dataset.playing;},longest);}
    };
    // Hide until near: the dock waits below the window's edge until the pointer comes within reach of it.
    const near=ev=>{
      if(container.dataset.dockHide!=='true'||!dock||nearFrame)return;
      nearFrame=env.requestAnimationFrame?.(()=>{
        nearFrame=0;
        const show=ev.clientY>(env.innerHeight||0)-110||dock.contains?.(container.getRootNode?.().activeElement);
        if(show)dock.dataset.near='true';else delete dock.dataset.near;
      })||0;
    };
    const resize=()=>layout();
    const rove=el=>{if(!items.includes(el))return;tabId=el.dataset.id;for(const item of items){const index=item===el?0:-1;if(item.tabIndex!==index)item.tabIndex=index;}};
    const focus=ev=>rove(ev.target.closest?.('.rd-dock-it'));
    const click=ev=>rove(ev.target.closest?.('.rd-dock-it'));
    const listeners={focusin:focus,click,pointermove:hover,pointerdown:down,pointerup:up,pointercancel:up,contextmenu:context,pointerover:play};
    // The size slider moves the dock as it slides; the setting is saved when it is let go (change).
    const slide=ev=>{
      const t=ev.target;
      if(t?.dataset?.setting!=='dockScale')return;
      const v=Math.max(.7,Math.min(1.5,Number(t.value)||1));
      t.style.setProperty('--v',String((v-.7)/.8));
      container.style.setProperty('--rd-dock-scale',String(v));
    };
    const docListeners={pointermove:ev=>{move(ev);near(ev);},pointerdown:outside,keydown:escape,input:slide};
    function detach(){
      if(dock){
        for(const [name,fn] of Object.entries(listeners))dock.removeEventListener(name,fn);
        for(const [name,fn] of Object.entries(docListeners))container.removeEventListener(name,fn,true);
        env.removeEventListener?.('resize',resize);
      }
      if(nearFrame)env.cancelAnimationFrame?.(nearFrame);
      nearFrame=0;
      drag=null;
      observer?.disconnect();
      observer=null;
      dock=null;
      items=[];
    }
    function sync(){
      const next=container.querySelector('.rd-dock');
      if(next!==dock){
        detach();
        dock=next;
        tabId='';
        if(dock){
          for(const [name,fn] of Object.entries(listeners))dock.addEventListener(name,fn);
          for(const [name,fn] of Object.entries(docListeners))container.addEventListener(name,fn,true);
          env.addEventListener?.('resize',resize);
          if(typeof env.ResizeObserver==='function'){
            let last='';
            observer=new env.ResizeObserver(entries=>{const size=entries.map(e=>e.contentRect?.width).join(',');if(size!==last){last=size;resize();}});
            observer.observe(container);
          }
          layout();
        }
      }
      if(!dock)return;
      items=Array.from(dock.querySelectorAll('.rd-dock-it'));
      const active=container.getRootNode?.()?.activeElement||env.document?.activeElement,chosen=items.find(el=>el.getAttribute('aria-pressed')==='true');
      rove(items.includes(active)?active:items.find(el=>el.dataset.id===tabId)||chosen||items[0]);
    }
    function keydown(ev){
      const it=(ev.composedPath?.()[0]||ev.target)?.closest?.('.rd-dock-it');
      if(!items.includes(it)||ev.altKey||ev.ctrlKey||ev.metaKey)return false;
      const key=ev.key;
      if(['ArrowLeft','ArrowRight','Home','End'].includes(key)){
        ev.preventDefault();
        const index=items.indexOf(it),next=key==='Home'?0:key==='End'?items.length-1:(index+(key==='ArrowRight'?1:-1)+items.length)%items.length;
        rove(items[next]);
        items[next].focus({preventScroll:true});
        items[next].scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'instant'});
        return true;
      }
      if(key==='Enter'||key===' '){ev.preventDefault();if(!ev.repeat)it.click();return true;}
      return false;
    }
    return {sync,keydown,destroy:detach};
  }

  function sameOriginLink(value,fallback='/'){
    try{
      const url=new URL(value||fallback,CANVAS_ORIGIN+'/');
      if(url.origin!==CANVAS_ORIGIN||url.username||url.password)return CANVAS_ORIGIN+fallback;
      return `${CANVAS_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }catch{return CANVAS_ORIGIN+fallback;}
  }

  function assignmentFallback(item){
    return `/courses/${encodeURIComponent(stringValue(item?.courseId))}/assignments/${encodeURIComponent(stringValue(item?.id))}`;
  }

  function assignmentLink(item){
    return sameOriginLink(item?.url,assignmentFallback(item));
  }

  function gradePeriodLabel(course){
    if(course?.scoreScope==='hidden')return 'Grade hidden';
    if(course?.scoreScope==='current-period')return course.gradingPeriodTitle?`${course.gradingPeriodTitle} grade`:'Current period grade';
    return 'Overall grade';
  }

  function complete(item){
    if(root.ReserveCore?.isComplete)return root.ReserveCore.isComplete(item);
    if(item?.state==='excused')return true;
    if(item?.missing===true||item?.redoRequested===true)return false;
    return item?.state==='submitted'||item?.state==='graded';
  }

  function safeCourseImage(value){
    if(typeof value!=='string'||!value.trim())return '';
    const text=value.trim();
    if(/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(text)&&text.length<400000)return text;
    try{
      const url=new URL(text,CANVAS_ORIGIN+'/');
      return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';
    }catch{return '';}
  }

  function statusLabel(snapshot,externalStatus='',transientStatus='',now=Date.now()){
    if(transientStatus)return String(transientStatus);
    if(externalStatus)return String(externalStatus);
    const fetched=dateMs(snapshot?.fetchedAt);
    if(fetched===null)return 'Update time unavailable';
    const diff=Math.max(0,now-fetched);
    if(diff<60000)return 'Updated just now';
    if(diff<3600000)return `Updated ${Math.floor(diff/60000)} min ago`;
    if(diff<DAY)return `Updated ${Math.floor(diff/3600000)} hr ago`;
    return `Updated ${Math.floor(diff/DAY)} d ago`;
  }

  // onNative (content.js): shows Canvas's own dashboard; with it the command bar ends in a quiet
  // "Canvas dashboard" switch (the phone drawer lists it), so the host needs no row of its own.
  function mount(target,{
    snapshot,
    store,
    demo=false,
    personalVerified=true,
    onPlanner=()=>{},
    onNative=null,
    refresh=async()=>{},
    status='',
    initialState,
    materialClient,
    onAuthError=()=>{},
    onReady=()=>{},
    onRenderError=null
  }={}){
    if(!enabled('dashboard'))return null;
    if(!target||typeof target.append!=='function')throw Error('ReserveDashboard needs a shadow root or element target.');
    if(!snapshot||!Array.isArray(snapshot.courses)||!Array.isArray(snapshot.assignments))throw Error('ReserveDashboard needs a Canvas snapshot.');
    if(!store||typeof store.get!=='function')throw Error('ReserveDashboard needs the account-bound Canvas Harness store.');

    const C=root.ReserveCore;
    const U=root.ReserveUI;
    const E=U?.escapeHTML||((value)=>stringValue(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])));
    if(!C?.normalizeCourse||!C?.normalizeAssignment)throw Error('ReserveCore must be loaded before ReserveDashboard.');

    const container=document.createElement('section');
    container.className='rd';
    // A write of an unchanged value still queues a MutationRecord, and every observer of the dashboard wakes for it (the
    // pony re-measured the whole page after each render: 15-25 ms). A render writes only the values that change.
    const setAttr=(el,name,value)=>{value=String(value);if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value);};
    const setData=(key,value)=>{value=String(value);if(container.dataset[key]!==value)container.dataset[key]=value;};
    const setVar=(name,value)=>{value=String(value);if(container.style.getPropertyValue?.(name)!==value)container.style.setProperty(name,value);};
    const setProp=(el,name,value)=>{if(el&&el[name]!==value)el[name]=value;};
    if(!personalVerified)container.dataset.chLinksPending='true';
    // One short staggered entrance per mount. CSS skips it for reduced motion.
    container.setAttribute('aria-label','Canvas Harness Canvas dashboard');
    container.dataset.entrance='true';
    const entranceTimer=setTimeout(()=>{delete container.dataset.entrance;},1200);
    target.append(container);

    let currentSnapshot=snapshot;
    let externalStatus=stringValue(status);
    let transientStatus='';
    let refreshing=false;
    let destroyed=false,rendering=false,mounted=false,sourceFrame=0,pendingRender=null,agentController=null,shownPage='';
    // When the last whole render read the clock, and the next moment the clock alone changes the page (updateFreshness).
    let renderedAt=0,timeBoundary=null;
    const studyScope=store.owner?store.owner.origin+'|'+store.owner.accountId:'';
    const studyStore=enabled('ai')&&enabled('tools')&&StudyUI&&root.chrome?.storage?.local?StudyUI.createStore(root):null;
    const studyKey=studyStore?.key(studyScope)||'';
    // studyBandSignature: the Help cards' content (no progress), made once per study read; render never stringifies cards.
    let studyAids={},studyRevision=0,studySignature='[]',studyBandSignature='',helpBand=null,helpBandHost=null,helpBandSignature='',askHelpNow=null,
      // Ask the AI about one assignment (and any selected text); Help shows the progress, then the cards.
      helpWithItem=context=>{
        if(!askHelpNow||!helpBand)return toolbox?.helpWith(context);
        const picked=String(context?.selectedText||'').replace(/\s+/g,' ').trim().slice(0,600);
        helpBand.setOpen?.(true);
        helpBand.element?.scrollIntoView?.({block:'nearest',behavior:'smooth'});
        return askHelpNow(picked?'Help me with this part: "'+picked+'"':'Make the help for this item.',context?.itemId?{itemId:String(context.itemId),...(picked?{}:{make:'auto'})}:{}).then(result=>{
          if(result?.run)helpBand?.prepare?.(result.run);else if(result?.ok===false){transientStatus=result.message;updateStatus();}
          return result?.ok===true;
        });
      };
    function readStudy(){
      if(destroyed||!studyKey)return;
      const revision=++studyRevision;
      studyStore.list(studyScope).then(aids=>{
        if(destroyed||revision!==studyRevision)return;
        const signature=JSON.stringify(Object.entries(aids).flatMap(([key,aid])=>{
          const label=StudyUI.tagLabel(aid),review=aid?.kind==='practice'&&aid.review;
          return [
            ...(Band&&aid?.data?[[key,{...aid,progress:undefined}]]:[]),
            ...(label&&(aid.itemId||review)?
              [
                [
                  key,
                  String(aid.itemId||''),
                  aid.courseId?String(aid.courseId):'',
                  label,
                  ...(review?[aid.title,review,Object.entries(aid.progress?.practice?.answers||{}).filter(([,a])=>a?.correct===false).map(([i])=>i)]:[])
                ]
              ]:
              [])
          ];
        }));
        studyAids=aids;studyBandSignature=Band?JSON.stringify(Object.entries(aids).filter(([,aid])=>aid?.data).map(([key,aid])=>[key,{...aid,progress:undefined}])):'';
        if(signature===studySignature)return;
        studySignature=signature;scheduleRender();
      }).catch(()=>{});
    }
    function studyChanged(changes,area){if(area==='local'&&studyKey&&Object.hasOwn(changes||{},studyKey))readStudy();}
    root.chrome?.storage?.onChanged?.addListener?.(studyChanged);
    function biscuitRulesChanged(){scheduleRender();}
    root.document?.addEventListener?.('reserve:biscuit-rules',biscuitRulesChanged);
    const beforePaint=fn=>root.requestAnimationFrame?root.requestAnimationFrame(fn):root.setTimeout(fn,0);
    const cancelPaint=id=>root.requestAnimationFrame?root.cancelAnimationFrame?.(id):root.clearTimeout(id);
    // A failed visit only changes the status line (and the refresh button's title): written in place, no whole render.
    function visitAgent(){
      if(destroyed||!agentController)return;
      void agentController.visit().catch(error=>{if(!destroyed){transientStatus=error?.message||'Your AI could not run.';updateStatus();}});
    }
    function sourceChange(){scheduleRender();visitAgent();}
    // (a render asked for by data or a timer, not by the student's own press: while a room is up it waits, see below)
    let sourcing=false;
    function scheduleRender(options=null){
      if(destroyed)return;
      if(options)pendingRender={...pendingRender,...options};
      if(!sourceFrame)
        sourceFrame=beforePaint(()=>{
          sourceFrame=0;
          sourcing=true;
          try{render();}catch(error){if(!mounted&&onRenderError)onRenderError(error);else throw error;}finally{sourcing=false;}
        });
    }
    function consumeSources(){if(sourceFrame)cancelPaint(sourceFrame);sourceFrame=0;}
    // While the Focus room covers the dashboard (data-ch-room="open"), everything behind it is hidden: renders wait (the
    // widgets, and with them the room, still sync), and one render brings the page up to date a moment after the room
    // has folded away, when the browser is idle. A whole-dashboard render in the middle of the room's moves was each
    // move's longest frame.
    let roomHeld=false;
    // the Help band host's height, kept current by a ResizeObserver (never read in a render), for the hold above
    let bandHeight=0,bandWatch=null,bandWatched=null;
    // (one observer for the dashboard's life, moved to each new host: never one more per page swap)
    function watchBand(host){
      if(!host||host===bandWatched||typeof root.ResizeObserver!=='function')return;
      bandWatch??=new root.ResizeObserver(entries=>{
        for(const e of entries){
          if(e.target!==bandWatched||e.target.style?.minHeight)continue;
          const h=Math.round(e.borderBoxSize?.[0]?.blockSize??e.contentRect?.height??0);
          if(h>0)bandHeight=h;
        }
      });
      if(bandWatched)bandWatch.unobserve?.(bandWatched);bandWatched=host;bandWatch.observe(host,{box:'border-box'});
    }
    function holdBand(host){
      const free=()=>{if(!destroyed&&host.isConnected)host.style.removeProperty('min-height');};
      root.setTimeout(()=>{if(typeof root.requestIdleCallback==='function')root.requestIdleCallback(free,{timeout:1000});else free();},1500);
    }
    function holdForRoom(options){
      consumeSources();if(options)pendingRender={...pendingRender,...options};
      if(!roomHeld&&typeof root.MutationObserver==='function'){
        roomHeld=true;
        const watch=new root.MutationObserver(()=>{if(container.dataset.chRoom==='open')return;watch.disconnect();roomHeld=false;
        // (once the fold and the module's settle have played out, data-ch-moving: an idle moment inside a compositor-run
        // fold came at once, and the whole render landed in the middle of the settle)
        const later=()=>{
          if(destroyed)return;
          const until=Number(container.dataset.chMoving||0)-Date.now();
          if(until>0){root.setTimeout(()=>{if(typeof root.requestIdleCallback==='function')root.requestIdleCallback(later,{timeout:1500});else later();},until+40);return;}
          scheduleRender();
        };
        if(typeof root.requestIdleCallback==='function')root.requestIdleCallback(later,{timeout:1500});else root.setTimeout(later,600);});
        watch.observe(container,{attributes:true,attributeFilter:['data-ch-room']});
      }
      // the look the room follows (Motion, light or dark) still comes through at once
      // (read from the settings alone: building the whole page's context here cost each of the room's moves a long frame)
      try{
        const ctx={s:settings()};
        ctx.theme=effectiveTheme(ctx.s);
        container.dataset.theme=ctx.theme;
        container.dataset.motionStyle=MOTION_STYLES.includes(ctx.s.motion)?ctx.s.motion:'gentle';
        container.dataset.featureMotion=enabled('motion')?'on':'off';
        container.dataset.livingArt=ctx.s.livingArt==='off'?'off':'on';
      }catch{}
      // the room only: the timer and the room's own sync (the whole board's sync cloned the store several times and worked
      // out every day and date on Home, in each press in the room)
      try{if(board?.syncRoom)board.syncRoom();else board?.sync();}catch{}
    }
    // ---- The rooms over the page: the Review deck's reading room and Grade impact's weighing room ----
    // Each is a layer of its own over the workspace column (.rd-roomlayer, in the column's grid area of .rd-shell), never
    // a page in place of Home: swapping the page styled, laid out and painted Home's ~2,700 elements and ~3,000 drawn
    // paths in one task (0.45-1.3 s at 4x CPU). The page under a room stays laid out and painted, and data-workspace and
    // its markup never change while the room is up. Once the room has grown over it, the page goes see-through and is
    // hidden from assistive technology, as under the Focus room (opacity and aria-hidden, never inert), and the room keeps
    // Tab inside itself. While a room is up the dashboard's renders wait and the room alone is redrawn; what the page
    // missed is drawn once the room has folded away, when the browser is idle. A fold is the room shrinking into its
    // module on the compositor: the page is back from its first frame, and the layer goes behind the page once the fold
    // has played and out of it when the browser is idle. A pointer resting on (or the keyboard reaching) a way in builds
    // the room ahead of time, behind the page and see-through, its drawing going in a share per frame: the press only
    // shows it.
    const ROOM_NAMES={review:'Review deck',impact:'Grade impact'},drawn=new WeakMap();
    let room=null,roomStale=false,roomFrame=0,bootRoom=null,homeAria=null;const spares=new Map(),leavingRooms=new Set();
    // where the student is, as Biscuit and the saved state see it: a room that is up is the page it used to be
    const here=()=>room?.kind==='review'?'review':room?.kind==='impact'?'grades':workspace;
    const hereCourse=()=>room?.kind==='impact'?room.course:state.courseId;
    // how long the move under way still plays (a stamp further off than any move lasts is a clock that jumped: none)
    const movingLeft=()=>{const ms=Number(container.dataset.chMoving||0)-Date.now();return ms>0&&ms<8000?ms:0;};
    // The rooms' own place in the shell (.rd-roomhost, see-through to presses, in the column's grid area), made once with
    // the page: a room put straight into the shell, or taken out of it, restyled the whole shell (its :has() rule), a
    // quarter of a second at 4x CPU in the press.
    function roomShell(make=true){
      const shell=container.querySelector(':scope > .rd-shell');
      if(!shell)return null;
      let host=shell.querySelector(':scope > .rd-roomhost');
      if(!host&&make){host=document.createElement('div');host.className='rd-roomhost';host.dataset.rdKeep='true';shell.append(host);}
      return host;
    }
    const homeColumn=()=>container.querySelector(':scope > .rd-shell > .rd-workspace');
    function roomContext(course,ctx=buildContext()){
      return {
        ...ctx,
        state:{...state,courseId:String(course)},
        workspace:'grades',
        workPage:'',
        gradeImpact,
        gradeImpactRevision:currentSnapshot.fetchedAt,
        user:currentSnapshot.user
      };
    }
    function roomMarkup(kind,course,ctx=null){
      if(kind==='review')return reviewDeck?.renderReviewDeck()||'';
      if(kind==='impact'&&gradeImpact&&root.ReserveGradeImpact?.render)
        return root.ReserveGradeImpact.render(
          ctx||roomContext(course),
          {E,icon,assignmentLink,formatDate,dueText,scoreText,gradePeriodLabel,dayKey,complete},
          gradeImpact)||
          '';
      return '';
    }
    // A room's section that is a spare or on its way out is no room to anything that looks for one (the deck's and Grade
    // impact's own code, Biscuit, the keys): the deck's loses its name, Grade impact's is marked away, until it is shown.
    function setAway(section,kind,away){
      if(!section)return;
      if(kind==='review'){
        if(away&&section.hasAttribute('data-review-deck')){section.removeAttribute('data-review-deck');section.setAttribute('data-rv-away','');}
        else if(!away&&section.hasAttribute('data-rv-away')){section.removeAttribute('data-rv-away');section.setAttribute('data-review-deck','');}
      }
      else if(away)section.setAttribute('data-gi-away','');else section.removeAttribute('data-gi-away');
    }
    const firstLeaving=shell=>shell.querySelector(':scope > .rd-roomlayer[data-state="leaving"], :scope > .rd-roomlayer[data-state="gone"]');
    function makeLayer(kind,html=''){
      const layer=document.createElement('div');layer.className='rd-roomlayer';layer.dataset.rdKeep='true';layer.dataset.room=kind;layer.dataset.state='spare';
      layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label',ROOM_NAMES[kind]);layer.setAttribute('aria-hidden','true');
      layer.innerHTML=html;setAway(layer.firstElementChild,kind,true);return layer;
    }
    // a drawing that goes in a share per frame (a slow frame halves the next share), unseen; finish() puts the rest in
    function fillShares(svg){
      const rest=[...(svg?.children||[])];if(rest.length<2||!root.requestAnimationFrame)return null;for(const n of rest)n.remove();
      const size=n=>(n.getElementsByTagName?.('*').length||0)+1;let share=700,last=0,stop=false;
      const step=t=>{
        if(stop)return;
        const gap=last?t-last:16;
        last=t;
        share=gap>34?Math.max(250,share/2):gap<20?Math.min(1400,share*1.25):share;
        let spent=0;
        while(rest.length&&(spent===0||spent+size(rest[0])<=share)){const n=rest.shift();spent+=size(n);svg.append(n);}
        if(rest.length)root.requestAnimationFrame(step);else stop=true;
      };
      root.requestAnimationFrame(step);
      return {finish(){stop=true;for(const n of rest.splice(0))svg.append(n);},cancel(){stop=true;rest.length=0;}};
    }
    // A layer made and put in place, out of sight. Grade impact's drawing is made for the room's size: the layer goes in
    // first and is measured the way the room measures itself, so the room is not drawn again in the frame it is shown.
    function newLayer(kind,course,shell){
      const layer=makeLayer(kind,'');shell.insertBefore(layer,firstLeaving(shell));
      if(kind==='impact')
        try{
          const top=layer.getBoundingClientRect().top,w=layer.clientWidth;
          gradeImpact.presize?.(w,Math.round(Math.min(1100,Math.max(780,(root.innerHeight||900)-Math.max(0,top)-12))));
        }catch{}
      let html='';try{html=roomMarkup(kind,course);}catch{html='';}
      const t=document.createElement('template');t.innerHTML=html;if(!t.content.firstElementChild){layer.remove();return null;}
      setAway(t.content.firstElementChild,kind,true);layer.append(t.content);drawn.set(layer,html);return layer;
    }
    function dropSpare(kind){const s=spares.get(kind);if(!s)return;spares.delete(kind);root.clearTimeout(s.timer);s.fill?.cancel();s.layer.remove();}
    function buildSpare(kind,course=''){
      if(destroyed||!mounted||room||container.dataset.chRoom||(kind==='review'?!reviewDeck:!gradeImpact))return;course=String(course||'');
      const old=spares.get(kind);
      if(old&&old.course===course&&old.layer.isConnected){
        root.clearTimeout(old.timer);
        old.timer=root.setTimeout(()=>dropSpare(kind),30000);
        if(kind==='review')reviewDeck?.prebuild?.(old.layer.firstElementChild);
        return;
      }
      dropSpare(kind);const shell=roomShell(),column=homeColumn();if(!shell||!column)return;
      const layer=newLayer(kind,course,shell),section=layer?.firstElementChild;if(!section)return;
      const fill=kind==='impact'?fillShares(section.querySelector(':scope > svg')):null;
      // the page under it becomes a layer of its own now, so hiding it and showing it again are compositor-only
      column.style.setProperty('will-change','opacity');
      spares.set(kind,{kind,course,layer,fill,timer:root.setTimeout(()=>dropSpare(kind),30000)});
      if(kind==='review')reviewDeck?.prebuild?.(section);
    }
    // While a room is up the toolbar marks its tab (the Review deck's, Grades for Grade impact) and the course rail marks
    // its course (Grade impact's), as they did when the room was a page: only those few attributes change, never
    // data-workspace or the page's markup; when the room goes, the page's own marks come back.
    function markRoom(){
      const pageTab=workspace==='work'&&workPage==='assignments'?'assignments':workspace,
        tabNow=room?(room.kind==='review'?'review':'grades'):pageTab,
        courseNow=room?.kind==='impact'?room.course:state.courseId;
      for(const tab of container.querySelector(':scope > .rd-toolbar')?.querySelectorAll('.rd-workspace-tabs .t-tab')||[]){
        const on=tab.dataset.tab===tabNow;
        if(tab.getAttribute('aria-selected')!==String(on))tab.setAttribute('aria-selected',String(on));
        if(tab.tabIndex!==(on?0:-1))tab.tabIndex=on?0:-1;
      }
      const rail=container.querySelector(':scope > .rd-shell > .rd-course-rail');if(!rail)return;
      for(const row of rail.querySelectorAll('.rd-rail-course[data-arrange-course]')){
        const on=String(row.dataset.arrangeCourse===String(courseNow));
        if(row.getAttribute('data-selected')!==on)row.setAttribute('data-selected',on);
      }
      const all=rail.querySelector('.rd-rail-all'),pressed=String(courseNow==='all');
      if(all&&all.hasAttribute('aria-pressed')&&all.getAttribute('aria-pressed')!==pressed)all.setAttribute('aria-pressed',pressed);
    }
    // (at a room's open and fold the marks change a frame after the move's busiest frame: 13-41 ms of style at 4x CPU)
    let markFrame=0;
    function markLater(){
      if(markFrame)return;
      const go=()=>{markFrame=0;if(!destroyed)markRoom();};
      if(root.requestAnimationFrame)markFrame=root.requestAnimationFrame(()=>root.setTimeout(go,0));else go();
    }
    function hideHome(){
      const column=homeColumn();
      if(!column||!room)return;
      column.style.setProperty('opacity','0');
      if(homeAria===null)homeAria=column.getAttribute('aria-hidden')||'';
      if(column.getAttribute('aria-hidden')!=='true')column.setAttribute('aria-hidden','true');
    }
    function showHome(){
      const column=homeColumn();
      if(!column)return;
      column.style.removeProperty('opacity');
      if(homeAria!==null){if(homeAria)column.setAttribute('aria-hidden',homeAria);else column.removeAttribute('aria-hidden');homeAria=null;}
    }
    // Shown: a room grown from its module (the sheet covers the column) hides the page at once; one opened by a tab or a
    // link fades in over the page, which is hidden once it is covered.
    function openRoom(kind,course='',{fade=false}={}){
      if(destroyed)return false;course=String(course||'');
      if(room){if(room.kind===kind&&room.course===course)return true;dropRoom();}
      const shell=roomShell(),column=homeColumn();if(!shell||!column)return false;
      for(const k of [...spares.keys()])if(k!==kind||spares.get(k).course!==course||!spares.get(k).layer.isConnected)dropSpare(k);
      const spare=spares.get(kind);let layer;
      if(spare){spares.delete(kind);root.clearTimeout(spare.timer);spare.fill?.finish();layer=spare.layer;}
      else{layer=newLayer(kind,course,shell);if(!layer)return false;}
      room={kind,course,layer};column.style.setProperty('will-change','opacity');
      // (with the courses across the top the page itself scrolls: the room stands where the window is)
      if(container.dataset.courseNavigation==='topbar'){
        const r=shell.getBoundingClientRect(),top=Math.max(0,-r.top);
        layer.style.top=top+'px';
        layer.style.bottom='auto';
        layer.style.height=`calc(100dvh - ${Math.round(Math.max(0,r.top))}px)`;
      }
      setAway(layer.firstElementChild,kind,false);layer.dataset.state='open';layer.removeAttribute('aria-hidden');
      renderRoomNow(true);markLater();
      const lvl=container.dataset.featureMotion==='off'?'off':container.dataset.motionStyle||'gentle',r=room;
      if(fade&&lvl!=='off'&&layer.animate&&!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
        const a=layer.animate([{opacity:0},{opacity:1}],{duration:200,easing:'ease-out'});
        a.finished.then(()=>{if(room===r)hideHome();},()=>{});
      }
      else hideHome();
      return true;
    }
    // the room alone is redrawn (the dashboard's own renders wait while it is up)
    function scheduleRoomRender(){if(roomFrame||destroyed)return;roomFrame=beforePaint(()=>{roomFrame=0;renderRoomNow();});}
    function renderRoomNow(shown=false){
      if(roomFrame){cancelPaint(roomFrame);roomFrame=0;}
      if(destroyed||!room)return;const r=room;let html='',ctx=null;
      try{if(r.kind==='impact')ctx=roomContext(r.course);html=roomMarkup(r.kind,r.course,ctx);}catch{html='';}
      // a room that can no longer be drawn (its feature turned off, a course Grade impact cannot weigh) gives way to its page
      if(!html){
        dropRoom();
        if(r.kind==='impact'&&workspaceEnabled('grades')){savedWorkspace=null;captureCourseView();workspace='grades';switchCourse(r.course,{rememberCurrent:false});}
        render();
        return;
      }
      // (a room drawn ahead of time that is still what it would be drawn as now is only shown)
      // (the room's own redraws in place, later, make what was drawn ahead of time no guide)
      const ahead=drawn.get(r.layer);drawn.delete(r.layer);if(shown&&ahead===html){if(r.kind==='impact')gradeImpact?.ensure(ctx);return;}
      const t=document.createElement('template');t.innerHTML=html;const next=t.content.firstElementChild,section=r.layer.firstElementChild;
      if(section&&next&&section.nodeName===next.nodeName&&section.getAttribute('data-rd-key')===next.getAttribute('data-rd-key'))patchUI(section,next);else r.layer.replaceChildren(t.content);
      if(r.kind==='impact')gradeImpact?.ensure(ctx);
    }
    // The room's own way out: it folds into its module (the deck's and Grade impact's code play the fold) while the page
    // under it is back at once; the module takes in what changed in the room.
    function foldRoom(){
      if(!room)return false;const r=room;room=null;if(roomFrame){cancelPaint(roomFrame);roomFrame=0;}
      r.layer.dataset.state='leaving';r.layer.setAttribute('aria-hidden','true');setAway(r.layer.firstElementChild,r.kind,true);leavingRooms.add(r);
      showHome();markLater();
      // (a module that could not be redrawn alone waits for the page's catch-up)
      try{if(r.kind==='review'){if(reviewDeck?.redrawModule?.()===false)roomStale=true;}else gradeImpact?.redraw?.();}catch{roomStale=true;}
      const left=movingLeft;
      const behind=()=>{if(destroyed)return;const ms=left();if(ms>0){root.setTimeout(behind,ms+20);return;}r.layer.dataset.state='gone';
        const gone=()=>{r.layer.remove();leavingRooms.delete(r);catchUp();};
        if(typeof root.requestIdleCallback==='function')root.requestIdleCallback(gone,{timeout:1500});else root.setTimeout(gone,300);};
      root.setTimeout(behind,Math.max(480,left()));
      return true;
    }
    // Any other way out (another page, a course, a tab): the room is gone at once.
    function dropRoom(){
      for(const k of [...spares.keys()])dropSpare(k);
      if(!room)return false;const r=room;room=null;if(roomFrame){cancelPaint(roomFrame);roomFrame=0;}
      r.layer.remove();showHome();markRoom();catchUp();return true;
    }
    // what the page missed while a room was up, drawn once the room has folded away and the browser is idle
    function catchUp(){
      if(!roomStale||destroyed||room)return;
      const later=()=>{
        if(destroyed||room||!roomStale)return;
        const until=movingLeft();
        if(until>0||leavingRooms.size){
          root.setTimeout(()=>{if(typeof root.requestIdleCallback==='function')root.requestIdleCallback(later,{timeout:1500});else later();},Math.max(until,0)+60);
          return;
        }
        roomStale=false;
        scheduleRender();
      };
      if(typeof root.requestIdleCallback==='function')root.requestIdleCallback(later,{timeout:1500});else root.setTimeout(later,600);
    }
    function holdForRooms(){
      consumeSources();roomStale=true;
      // the look the room follows (Motion, light or dark) still comes through at once
      try{
        const s=settings();
        container.dataset.theme=effectiveTheme(s);
        container.dataset.motionStyle=MOTION_STYLES.includes(s.motion)?s.motion:'gentle';
        container.dataset.featureMotion=enabled('motion')?'on':'off';
        container.dataset.livingArt=s.livingArt==='off'?'off':'on';
      }catch{}
      scheduleRoomRender();
    }
    // A change in a room is drawn in the room; one that lands while a room folds away waits for the page's catch-up.
    function roomChanged(kind){if(room?.kind===kind){scheduleRoomRender();return;}if(leavingRooms.size){roomStale=true;catchUp();return;}scheduleRender();}
    // the room keeps Tab inside itself
    function roomTab(event){
      if(event.key!=='Tab'||!room||event.defaultPrevented||container.dataset.chRoom)return false;const target=event.composedPath?.()[0]||event.target;
      const list=[...room.layer.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]')].filter(n=>
        n.tabIndex>=0&&!n.disabled&&!n.hidden&&!n.closest('[hidden],[inert],[aria-hidden="true"]:not(.rd-roomlayer)')&&n.getClientRects().length);
      if(!list.length)return false;const first=list[0],end=list[list.length-1],inside=room.layer.contains(target)&&list.includes(target);
      if(inside&&!(event.shiftKey?target===first:target===end))return false;
      event.preventDefault();(event.shiftKey?end:first).focus({preventScroll:true});return true;
    }
    // A press on a room that is folding away lands on what is under it (the room let presses through without a rule on
    // each of its drawn shapes: pointer-events on the room restyled all of them in the fold's first frame).
    function throughRoom(event){
      const t=event.composedPath?.()[0]||event.target,layer=t?.closest?.('.rd-roomlayer');if(!layer||layer.dataset.state==='open'||!container.contains(layer))return;
      event.stopImmediatePropagation();if(event.cancelable)event.preventDefault();if(event.type!=='click')return;
      const under=(container.getRootNode?.()?.elementsFromPoint?.(event.clientX,event.clientY)||[]).find(n=>container.contains(n)&&!n.closest?.('.rd-roomlayer:not([data-state="open"])'));
      const node=under?.closest?.('button,a[href],summary,[data-rd-action],[data-gi-action],[data-gi-band]')||under;if(!node)return;node.focus?.({preventScroll:true});node.click?.();
    }
    // A pointer resting on a way into a room, or the keyboard reaching one, builds the room ahead of time; focus never goes
    // into a room that is not up (the keyboard passes over it).
    function roomWayIn(event){
      if(destroyed)return;const t=event.composedPath?.()[0]||event.target;if(!container.contains(t))return;
      const layer=t?.closest?.('.rd-roomlayer');
      if(layer){
        if(event.type==='focusin'&&layer.dataset.state!=='open'){
          const back=event.relatedTarget&&container.contains(event.relatedTarget)&&!event.relatedTarget.closest?.('.rd-roomlayer')?event.relatedTarget:null;
          if(back)back.focus({preventScroll:true});else t.blur?.();
        }
        return;
      }
      // (not while a move plays: focus put back on the opener by a fold is no student reaching for the room)
      if(room||movingLeft()>0)return;const way=t?.closest?.('[data-rv-grow],[data-rd-action="review-deck-open"],.rd-workspace-tab[data-tab="review"],[data-gi-open]');if(!way)return;
      if(way.hasAttribute('data-gi-open'))spareLater('impact',way.getAttribute('data-gi-open'));else spareLater('review');
    }
    // (built when the browser is idle, never in the pointer's own event: a press that comes first builds the room itself)
    let spareWait=0,spareAsk=null;
    function spareLater(kind,course=''){
      spareAsk={kind,course:String(course||'')};const old=spares.get(kind);if(old&&old.course===spareAsk.course&&old.layer.isConnected){buildSpare(kind,course);return;}
      // (never while a move plays: a room growing is built when it lands, and a spare made in the middle of the grow was
      // that move's longest frame)
      if(spareWait)return;const go=()=>{spareWait=0;const ask=spareAsk;spareAsk=null;if(ask&&!destroyed&&!room&&!movingLeft())buildSpare(ask.kind,ask.course);};
      spareWait=typeof root.requestIdleCallback==='function'?root.requestIdleCallback(go,{timeout:400}):root.setTimeout(go,60);
    }
    function render(options={}){
      if(destroyed)return;if(rendering){scheduleRender(options);return;}
      if(mounted&&container.dataset.chRoom==='open'&&typeof root.MutationObserver==='function'&&container.querySelector(':scope > .fr-room')){holdForRoom(options);return;}
      // While a room is up, renders asked for by data or timers wait (the room alone is redrawn) and so does everything
      // during a room's move; a press on the page around the room (the toolbar: Make it yours, Show grades) still draws
      // the page, which then stays hidden under the room, and the room after it.
      if(mounted&&room&&(sourcing||movingLeft()>0)){holdForRooms();return;}
      consumeSources();const next={...pendingRender,...options};pendingRender=null;rendering=true;
      // The clock is read before buildContext reads its own, so a moment that passes during the render is drawn
      // again on the next minute tick, never skipped (updateFreshness). A render that throws leaves no time on record.
      const started=Date.now();renderedAt=0;timeBoundary=null;
      try{renderNow(next);renderedAt=started;}finally{rendering=false;}
      // The page's answer to an input is drawn: drawings held for it go on once it has painted (motion.js busy).
      motion?.answered?.();
      if(!mounted){mounted=true;onReady();}
      // (the page's patch takes the hiding off the column: it goes back on at once, and the room follows the page)
      if(room){homeColumn()?.style.setProperty('will-change','opacity');hideHome();markRoom();renderRoomNow();}
      // a link to the Review deck opens its room over Home once Home is drawn
      if(bootRoom&&!destroyed){const kind=bootRoom;bootRoom=null;openRoom(kind,'',{fade:true});}
    }
    // syncFocus
    let focusTimer=0,focusSettling=false,focusDoneUntil=0;
    const stateKey=store.owner?`reserve:dashboard:${store.owner.origin}:${store.owner.accountId}`:'';
    let savedState;
    try{if(stateKey)savedState=JSON.parse(root.sessionStorage?.getItem(stateKey)||'null');}catch{}
    const bootState=initialState||savedState||{};
    let state=Model.cleanState(bootState);
    const courseMemory=Model.createCourseMemory(bootState.courseViews),restoredView=Model.cleanCourseView(bootState,state.courseId);
    let visibleLimit=state.limit;
    let personal=store.get()||{},personalRevision=0,companionPack=null,companionKey='',companionTurn=0;
    let bandFactsMemo=[null,null,null],
      normalizedCache=null,
      gradeVisibilityOverride=(initialState?.gradeVisibilityOverride??savedState?.gradeVisibilityOverride)===false?false:null,
      gradeSaveVersion=0;
    let selectedId=restoredView.selectedId;
    let readerTab=restoredView.readerTab,
      customizeTab='all',
      customizeOpen=false,
      canvasNav='drawn',
      customizeCourseId='all',
      customizeStatus='',
      customizeBusy=false,
      customizeDrafts={},
      readerOpen=restoredView.readerOpen,
      gradeQuery='',
      gradeLimit=40;
    let quickPackDraft='',quickPackFileName='',quickPackError='',quickPackLoading=false,quickPackRead=0;
    let pendingReaderScroll={courseId:state.courseId,id:selectedId,top:restoredView.readerScroll};
    const readerLayout=typeof root.ResizeObserver==='function'?new root.ResizeObserver(()=>{if(restoreReaderScroll())remember();}):null;
    const explicitWorkspace=initialState?.workspace||savedState?.workspace;
    // Keep an unavailable saved destination until the student chooses a different workspace.
    let workspace=resolveWorkspace(explicitWorkspace==='assignments'?'work':explicitWorkspace),workPage=explicitWorkspace==='assignments'?'assignments':'home';
    // the Review deck is a room over Home, never a page of its own: a link to it opens Home with the room over it
    if(workspace==='review'){bootRoom='review';workspace='work';workPage='home';}
    let savedWorkspace=['plan','materials','hub','inbox','grades','review'].includes(explicitWorkspace)&&workspace!==explicitWorkspace?explicitWorkspace:null;
    let deckCourseRequested='';
    const headingCache={};
    let overviewMode='actionable',overviewQuery='',checkOffNotice=null,dockMenu=false;
    const checkingOff=new Set();
    const selectionIds=new Set();let archiveUndo=null,archiving=false;
    const selectionOptions={isSelected:id=>selectionIds.has(id)};
    const contentCache=new Map();
    const drafts=new Map();
    const stepDrafts=new Map();
    let draftTimer;
    const formatters=new Map();
    const reviewDeck=root.ReserveFeatures?.enabled('review-deck')===true?
      root.ReserveReviewDeck?.create({
        container,
        store,
        getContext:()=>({...buildContext(),user:currentSnapshot.user,origin:currentSnapshot.origin}),
        onChange:()=>roomChanged('review'),
        isEnabled:()=>enabled('review-deck'),
        isSelected:()=>room?.kind==='review',
        onAuthError,
        onRoom:tab=>tab==='review'&&openRoom('review','',{fade:!container.querySelector('.rv-fly .rv-flysheet')}),
        onGrow:()=>buildSpare('review')
      }):
      null;
    const resourceClient=materialClient||(!demo?root.ReserveAPI?.createClient():null);
    const gradeImpact=root.ReserveFeatures?.enabled('grade-impact')===true?
      root.ReserveGradeImpact?.create({
        client:resourceClient,
        user:currentSnapshot.user,
        container,
        navigate:request=>gradeImpactNavigate(request),
        onChange:()=>roomChanged('impact'),
        onAuthError,
        store,
        saved:()=>personal.gradeImpact
      }):
      null;
    const materials=enabled('materials')?
      root.ReserveMaterialsUI?.create({
        store,
        user:snapshot.user,
        client:resourceClient,
        getAssignments:()=>currentSnapshot.assignments,
        ...selectionOptions,
        onChange:sourceChange,
        onAuthError,
        onCapture:draft=>toolbox?.capture(draft,container.querySelector(':focus'))
      }):
      null;
    const courseFiles=enabled('course-files')&&store.owner?root.ReserveCourseFiles?.create({store}):null;
    const courseFileOpen=courseFiles?root.ReserveCourseFileOpen?.create({store,files:courseFiles,container}):null;
    const ownFiles=courseFiles?
      root.ReserveCourseLinksUI?.create({files:courseFiles,onChange:sourceChange,onOpen:(course,id)=>courseFileOpen?.open(course,id,container.querySelector(':focus'))}):
      null;
    const hub=enabled('course-hub')?
      root.ReserveCourseHubUI?.create({
        store,
        user:snapshot.user,
        client:resourceClient,
        ...selectionOptions,
        materials,
        ownFiles,
        onChange:sourceChange,
        onAuthError,
        onCapture:draft=>toolbox?.capture(draft,container.querySelector(':focus'))
      }):
      null;
    let customKits=[],kitName='',kitsLoaded=false,frameWrites=Promise.resolve(),makeWrites=Promise.resolve();
    const mediaStore=store.owner&&root.ReserveMedia?root.ReserveMedia.createStore(store.owner):null;
    const mediaController=mediaStore?root.ReserveMedia.createController(container,mediaStore,{motion:()=>enabled('motion')&&settings().motion==='gentle',onError:error=>{
      customizeStatus=error.message;
      scheduleRender();
    }}):null;
    const frameController=mediaStore?root.ReserveMediaFrame?.createController(container,mediaStore,{motion:()=>enabled('motion')&&settings().motion==='gentle',onError:error=>{
      customizeStatus=error.message;
      scheduleRender();
    }}):null;
    const frameEditor=root.ReserveFrameEditor?.create(container,{read:(id,kind)=>{
      const pref=id==='theme'?settings().themeArt:id==='all'?settings().overviewArt:settings().coursePrefs?.[id];
      return pref?.[kind+'Art'];
    },save:(...args)=>{
      const task=frameWrites.catch(()=>{}).then(()=>saveFraming(...args));
      frameWrites=task;
      return task;
    },shape:frameShape,onError:error=>{customizeStatus=error.message;scheduleRender();}});
    const quickUpload=enabled('quick-pack')&&enabled('customization')&&enabled('course-art')?
      root.CanvasHarnessQuickUpload?.create({store,getCourses:()=>normalizeData(settings()).allCourses,onChange:sourceChange}):
      null;
    // Deadline changes (PR #52): moved, added or removed due dates seen across refreshes; optional, Lite leaves it out.
    const deadlineChanges=enabled('deadline-changes')?root.ReserveDeadlineChanges?.create({container,store,onChange:sourceChange,getTimeZone:()=>settings().timeZone}):null;
    const makeOwn=enabled('customization')?
      root.ReserveMakeYourOwn?.create({
        store,
        quickPack:quickUpload?file=>uploadQuickPack(file):null,
        kitImport:file=>runKit('kit-import',{dataset:{},files:[file]}),
        onChange:sourceChange
      }):
      null;
    const preferences=root.ReserveSettingsDock?.createPreferences?.({store,flush:async()=>{
      const drafts=await flushDrafts();
      if(drafts.includes(false))return false;
      return board?.flush?.();
    },onChange:sourceChange,calendar:()=>{
      const c=buildContext();
      return c.items.filter(item=>!root.ReserveCore.isWorkComplete(item,c.local[item.id])&&item.dueAt&&Date.parse(item.dueAt)>=Date.now()).map(item=>{
        const text=document.createElement('template');
        text.innerHTML=item.description||'';
        return {...item,description:text.content?.textContent||'',url:item.personal?(root.ReservePersonalWork.safeSource(item.source)?.url||CANVAS_ORIGIN+'/'):item.url};
      });
    }});
    const motion=enabled('motion')?root.ReserveMotion?.create(container):null;
    const courseDock=createCourseDock(container,{save:patch=>savePersonal(data=>{Object.assign(data.settings,patch);}),menu:open=>{
      if(dockMenu===open)return;
      dockMenu=open;
      render();
    }});
    const settingsDock=root.ReserveSettingsDock?.createDock({container,store,getCustomPet:()=>makeOwn?.state.pet||companionPack,
      onOpen:()=>{if(drawerOpen())setDrawer(false,{focus:false});toolbox?.close({restoreFocus:false});customizeCourseId=state.courseId;},
      onChange:open=>{customizeOpen=open;makeOwn?.setOpen?.(open);if(!open)preferences?.cancel();render();}
    });
    const arrange=enabled('arrange')&&(!root.ReserveFeatures||root.ReserveWorkspaceGestures?.create)?
      Arrange?.createController({container,getSettings:settings,getCourseIds:()=>normalizeData(settings()).allCourses.map(course=>String(course.id)),
      onChange:command=>savePersonal(data=>{Arrange.change(data.settings,command);pinHomeCommand(data,command);}),
      onModeChange:open=>{
        if(open){settingsDock?.close({restoreFocus:false});toolbox?.close({restoreFocus:false});workspace='work';}
        render();
      }
    // Added Home modules (week, timer, clock, notes...) and the companion: widgets.js draws and runs them.
    }):null;
    const board=(enabled('planner')||enabled('ai')&&enabled('tools'))?
      root.ReserveWidgets?.create({
        container,
        store,
        previewSize:(key,size)=>arrange?.previewSize?.(key,size)===true,
        getCustomPet:()=>makeOwn?.state.pet||companionPack,
        getCatalogue:packCatalogue,
        loadCatalogue:async()=>{
      await makeOwn?.loadCatalogue?.();
      return packCatalogue();
    },installed:installedCommand,studyStore,studyScope,openHelp:()=>{
      goWorkspace('work');
      render();
      helpBand?.setOpen(true);
      container.querySelector('[data-help-band]')?.scrollIntoView?.({block:'nearest'});
      return !!helpBand;
    },save:change=>savePersonal(change),rerender:()=>render(),getContext:()=>{
      const c=buildContext();
      return {
        ...c,
        studyAids,
        pageKind:room?room.kind==='impact'?'course':'dashboard':readerOpen?'assignment':state.courseId!=='all'?'course':'dashboard',
        biscuitData:{
          courseId:hereCourse(),
          itemId:!room&&readerOpen?selectedId:null,
          files:c.courses.flatMap(course=>materials?.getItems(course.id)||[]),
          pages:[...(materials?.getPages?.()||[]),...c.courses.flatMap(course=>{
        const x=hub?.getCourse(course.id);
        const raw=materials?.getCourse(course.id)?.raw;
        return [
          ...(raw?.pages||[]).map(p=>({...p,id:p.page_id||p.url||p.title,courseId:course.id})),
          ...(raw?.frontPage?[{...raw.frontPage,id:'front:'+course.id,courseId:course.id}]:[]),
          ...(raw?.syllabusBody?[{id:'syllabus:'+course.id,title:course.name+' syllabus',body:raw.syllabusBody,courseId:course.id,url:'/courses/'+course.id+'/assignments/syllabus'}]:[])
        ];
      })],
      modules:c.courses.flatMap(course=>
        (materials?.getCourse(course.id)?.raw?.modules||[]).flatMap(m=>
          [{...m,courseId:course.id,text:(m.items||[]).map(i=>i.title).join(' ')},...(m.items||[]).map(i=>({...i,courseId:course.id}))])),
      announcements:c.courses.flatMap(course=>(hub?.getCourse(course.id)?.announcements||[]).map(a=>({...a,courseId:course.id}))),
      messages:hub?.getMessages?.()||[]
        },
      unreadAnnouncements:c.courses.reduce((n,course)=>n+(hub?.getCourse(course.id)?.announcements||[]).filter(x=>x.unread).length,0)
      };
    },
      helpers:()=>({E,icon,assignmentLink,formatDate,dueText,scoreText,gradePeriodLabel,dayKey,complete}),
      appearance:({key,value})=>saveAppearance(key,value),
      layoutPreset:({preset})=>saveLayoutPreset(preset),
      navigate:request=>navigateBiscuit(request),
      bookmark:request=>bookmarkItem(request.itemId,true),
      openCourseFile:(course,id)=>courseFileOpen?.open(course,id,container.querySelector(':focus')),preview:id=>{
        const undo=rememberBiscuitView();
        workspace='work';
        showPreview(String(id),{detail:0,target:container,preventDefault(){}});
        return {ok:true,undo};
      },
      openSettings:tab=>{
        customizeTab=tab||'all';
        settingsDock?.open();
      },
      startTick:()=>syncFocus(),
      go:tab=>goWorkspace(tab),
      closeSettings:()=>settingsDock?.close({restoreFocus:false}),
      askAI:(question,handoff)=>toolbox?.askAI(question,handoff),
      helpWith:context=>helpWithItem(context),
      studyAI:(kind,itemId)=>toolbox?.studyAI(kind,itemId),
      openAid:(key,options)=>toolbox?.openAid(key,options),
      announcements:()=>{
        const course=buildContext().courses.find(c=>(hub?.getCourse(c.id)?.announcements||[]).some(x=>x.unread));
        if(!course||!workspaceEnabled('hub'))return false;
        switchCourse(String(course.id));
        goWorkspace('hub');
        hub?.loadCourse(course.id);
        return true;
      }}):null;
    // The Planner is a workspace of its own; older entry points that asked for the week land there.
    function selectWorkspace(action,button,event={},snapshot){
        const tabMotion=event.detail>0;
        const nextWorkspace=action==='open-materials'?'materials':action==='open-hub'?'hub':['plan','materials','hub','inbox','grades','review'].includes(button.dataset.tab)?button.dataset.tab:'work';
        // The Review deck is a room over the page: its tab (or the module's way in) shows it, the room's own way out folds
        // it away, and another page closes it first.
        // (the tab: the room grows out of it on a sheet, and the sheet stays over the room until its drawing is in)
        if(nextWorkspace==='review'){
          if(room?.kind!=='review'){
            const hook=!!button?.dataset?.rvGo;
            if(!hook&&!room&&reviewDeck?.growFromTab?.())return;
            if(openRoom('review','',{fade:!hook||!container.querySelector('.rv-fly .rv-flysheet')})&&!hook)reviewDeck?.shown?.();
          }
          return;
        }
        if(room){if(button?.dataset?.rvGo&&room.kind==='review'){foldRoom();return;}dropRoom();}
        const nextPage=action==='workspace'&&nextWorkspace==='work'?(button.dataset.tab==='assignments'?'assignments':'home'):workPage;
        if(action==='workspace'&&workspace===nextWorkspace&&workPage===nextPage)return;
        const order=['home','work','assignments','plan','hub','materials','inbox','grades','review'],
          place=(w,p)=>order.indexOf(w==='work'&&p==='assignments'?'assignments':w),
          direction=place(nextWorkspace,nextPage)>=place(workspace,workPage)?1:-1;
        savedWorkspace=null;captureCourseView();workspace=nextWorkspace;workPage=nextPage;if(workPage==='assignments')board?.close();
        if(workspace==='inbox')hub?.setCourse?.('all');
        if(workspace==='materials'||workspace==='hub'){
          const ctx=buildContext();switchCourse(button.dataset.id||(state.courseId==='all'?String(ctx.selected?.courseId||ctx.courses[0]?.id||'all'):state.courseId));
          materials?.activate(state.courseId);
          render({tabMotion,motionTarget:'.rd-workspace',direction,snapshot,resetWorkspaceScroll:true});
          if(workspace==='materials')materials?.load(state.courseId);else hub?.loadCourse(state.courseId);
        }else{render({tabMotion,motionTarget:'.rd-workspace',direction,snapshot,resetWorkspaceScroll:true});if(workspace==='inbox')hub?.loadInbox();}
        if(action!=='workspace'||!button.classList?.contains('rd-workspace-tab')){
          container.querySelector('.rd-workspace-tab[aria-selected="true"]')?.focus({preventScroll:true});
          container.querySelector('.rd-workspace-heading')?.scrollIntoView({block:'nearest',behavior:'instant'});
        }

        return;
    }
    function selectDashboardCourse(id,event={},snapshot){
        // The snapshot only reads, so an early return needs no undo.
        // A switch from deep in a long list starts the new course at its heading.
        if(room)dropRoom();
        if(!switchCourse(id))return;
        if(state.courseId==='all'&&!['home','grades','inbox','review'].includes(workspace))workspace='work';
        if(workspace==='inbox')hub?.setCourse?.(state.courseId);
        materials?.activate(state.courseId);
        render({tabMotion:event.detail>0,motionTarget:'.rd-workspace',motionKind:'course',snapshot});
        const heading=container.querySelector('.rd-workspace-heading, .rd-page-heading, .rd-materials-header');
        if(heading&&above(heading.getBoundingClientRect()))heading.scrollIntoView({block:'start',behavior:'instant'});
        if(workspace==='materials')materials?.load(state.courseId);if(workspace==='hub')hub?.loadCourse(state.courseId);return;
    }
    // Grade impact grows a Home module or a Grades strip into the weighing room (one course opened on Grades) and folds
    // it back. No tab motion: the room plays its own, and places focus itself (Fold on opening, the opener on folding).
    function gradeImpactNavigate({to,courseId}={}){
      const id=String(courseId??'all');if(!['room','grades','home'].includes(to)||to==='room'&&!/^\d+$/.test(id))return false;
      if(to!=='home'&&!workspaceEnabled('grades'))return false;
      // the room is a layer over the page it grew from (Home's module, a course's strip on Grades); its way back folds it
      // away over that page (a course opened on Grades itself, from the rail or a link, is still that page)
      if(to==='room'&&mounted&&openRoom('impact',id))return true;
      if(to!=='room'&&room?.kind==='impact')return foldRoom();
      if(room)dropRoom();
      savedWorkspace=null;captureCourseView();workspace=to==='home'?'work':'grades';if(to==='home')workPage='home';
      if(state.courseId!==id&&!switchCourse(id,{rememberCurrent:false}))return false;
      materials?.activate(state.courseId);render({motionTarget:'.rd-workspace',resetWorkspaceScroll:true,preserveFocus:false});return true;
    }
    function bookmarkItem(id,on){
      id=String(id);if(!buildContext().items.some(item=>String(item.id)===id))return false;
      return savePersonal(data=>{data.tasks[id]={...data.tasks[id],pinned:on===undefined?!data.tasks[id]?.pinned:on};});
    }
    function syncCompanion(){
      const A=root.ReservePetArt;
      if(!enabled('pony')||!A?.identity||!A?.hydrate||container.dataset.chLinksPending)return;
      const selected=A.identity(personal),key=JSON.stringify([selected.id,selected.name]);
      if(key===companionKey)return;
      companionKey=key;
      companionPack=null;
      const turn=++companionTurn;
      if(!selected.id||A.identity(personal,makeOwn?.state.pet).pack)return;
      Promise.resolve(A.hydrate(personal,{store})).then(pack=>{
        if(destroyed||turn!==companionTurn||container.dataset.chLinksPending)return;
        if(!pack){companionKey='';return;}
        companionPack=pack;
        scheduleRender();
      }).catch(()=>{
        if(!destroyed&&turn===companionTurn)companionKey='';
      });
    }
    function packCatalogue(){
      const s=settings(),data=store.get(),P=root.ReservePacks,rows=makeOwn?.state.catalogue||Object.values(s.makeYourOwn?.installed||{}),out=rows.map(row=>{
        const options={target:state.courseId},
          current=row.kind==='course-art'&&Array.isArray(row.pieces)?
            row.pieces.some(piece=>P?.isCurrent?.(row,data,{...options,piece:piece.id,slot:piece.slot})):
            P?.isCurrent?.(row,data,options)??(row.current||['pet','theme'].includes(row.kind)&&s.makeYourOwn?.[row.kind]?.id===row.id);
        return {id:row.key||row.id,name:row.name,kind:row.kind==='feature'&&row.sceneTheme?'scene':row.kind==='course-art'?'art':row.kind,current,installed:true};
      });
      const builtins=[
        {id:'builtin:pet',name:personal.pet?.name||'Biscuit',kind:'pet',current:!s.makeYourOwn?.pet},
        ...['light','dark'].map(id=>({id:'builtin:mode:'+id,name:({light:'Light',dark:'Dark'})[id],kind:'theme',current:!s.makeYourOwn?.theme&&!s.sceneTheme&&(s.theme==='dark'?'dark':'light')===id})),
        ...['starry','sea','stars','blueprint'].map(id=>
          ({id:'builtin:scene:'+id,name:({starry:'Starry Night',sea:'Under the Sea',stars:'Starfield',blueprint:'Blueprint'})[id],kind:'scene',current:!s.makeYourOwn?.theme&&s.sceneTheme===id})),
        ...['studio','study','focus'].map(id=>({id:'builtin:layout:'+id,name:id[0].toUpperCase()+id.slice(1)+' layout',kind:'preset'}))
      ];
      return [...out,...builtins.filter(row=>!out.some(item=>item.kind===row.kind&&item.name.toLowerCase()===row.name.toLowerCase()))];
    }
    async function installedCommand(request={}){
      const revision=personalRevision;if(destroyed||container.dataset.chLinksPending)return {ok:false,message:'Wait for Canvas to verify this account.'};
      if(makeOwn?.loadCatalogue)await makeOwn.loadCatalogue({previews:request.action==='use'});
      if(destroyed||revision!==personalRevision||container.dataset.chLinksPending)return {ok:false,message:'Wait for Canvas to verify this account.'};
      const rows=packCatalogue(),fits=row=>!request.kind||row.kind===request.kind||request.kind==='theme'&&row.kind==='scene';
      if(request.action==='list')return {ok:true,message:rows.filter(row=>row.installed&&fits(row)).map(row=>row.name).join(', ')||'No matching packs are installed. Use Get more in Make it yours.'};
      if(request.action==='name'){
        const active=rows.filter(row=>row.current&&fits(row));
        return {ok:true,message:request.kind==='pet'?(root.ReservePetArt?.identity?.(store.get(),makeOwn?.state.pet)?.name||'Biscuit'):active.map(row=>row.name).join(', ')||'The built-in choice is active.'};
      }
      if(!enabled('customization'))return {ok:false,message:'Appearance editor is off. Turn it on in Make it yours → Features.'};
      const row=rows.find(row=>row.id===request.id&&fits(row));if(request.action!=='use'||!row)return {ok:false,message:'That choice is no longer installed.'};
      const builtin=async pending=>{const ok=await pending;return {ok:!!ok,message:ok?'Using '+row.name+'.':'Could not change '+row.name+'.'};};
      if(row.id==='builtin:pet')return builtin(savePersonal(data=>{data.settings.makeYourOwn.pet=null;}));
      if(row.id.startsWith('builtin:mode:')){
        if(root.ReservePacks?.useInstalled)await root.ReservePacks.useInstalled('builtin:theme',{store});
        if(destroyed||revision!==personalRevision||container.dataset.chLinksPending)return {ok:false,message:'Wait for Canvas to verify this account.'};
        return builtin(savePersonal(data=>{data.settings.makeYourOwn.theme=null;data.settings.sceneTheme='';data.settings.theme=row.id.slice(13);}));
      }
      if(row.id.startsWith('builtin:scene:'))return builtin(saveAppearance('sceneTheme',row.id.slice(14)));
      if(row.id.startsWith('builtin:layout:'))return builtin(saveLayoutPreset(row.id.slice(15)));
      const pack=makeOwn?.state.catalogue?.find(item=>(item.key||item.id)===row.id);
      if(pack?.pack?.format==='chpreset'&&pack.pack.kind==='planner'&&!makeOwn.state.week){
        customizeTab='layout';
        settingsDock?.open();
        await makeOwn.action('use',row.id);
        return {ok:true,message:'Choose a week and review '+row.name+' in Make it yours before applying it.'};
      }
      if(!root.ReservePacks?.useInstalled)return {ok:false,message:'Pack selection is unavailable. Reload Canvas Harness.'};
      await root.ReservePacks.useInstalled(row.id,{store,target:state.courseId||'all',week:makeOwn?.state.week});
      makeOwn?.sync();
      if(makeOwn?.loadCatalogue)await makeOwn.loadCatalogue();
      render();
      return {ok:true,message:'Using '+row.name+'.'};
    }
    function navigateBiscuit(request){
      const tab={planner:'plan',messages:'inbox','course-hub':'hub',assignments:'work',home:'work',materials:'materials',grades:'grades'}[request.tab];
      if(!request.courseId&&!tab||tab&&!workspaceEnabled(tab))return false;
      if(request.courseId&&!buildContext().courses.some(course=>String(course.id)===String(request.courseId)))return false;
      const undo=rememberBiscuitView();
      if(request.courseId)selectDashboardCourse(String(request.courseId));else selectWorkspace('workspace',{dataset:{tab:{planner:'plan',messages:'inbox','course-hub':'hub'}[request.tab]||request.tab}});
      return {ok:true,undo};
    }
    function rememberBiscuitView(){
      const before={
        state:JSON.parse(JSON.stringify(state)),
        workspace,
        workPage,
        selectedId,
        readerTab,
        readerOpen,
        visibleLimit,
        savedWorkspace,
        pendingReaderScroll,
        top:container.querySelector('.rd-workspace')?.scrollTop||0
      };
      return ()=>{
        state=before.state;
        workspace=before.workspace;
        workPage=before.workPage;
        selectedId=before.selectedId;
        readerTab=before.readerTab;
        readerOpen=before.readerOpen;
        visibleLimit=before.visibleLimit;
        savedWorkspace=before.savedWorkspace;
        pendingReaderScroll=before.pendingReaderScroll;
        if(workspace==='inbox')hub?.setCourse?.(state.courseId);
        materials?.activate(state.courseId);
        render();
        const node=container.querySelector('.rd-workspace');
        if(node)node.scrollTop=before.top;
        return true;
      };
    }

    function goWorkspace(tab){
      if(!workspaceEnabled(tab))return;
      if(tab==='review'){if(room?.kind!=='review'&&openRoom('review','',{fade:true}))reviewDeck?.shown?.();return;}
      if(room)dropRoom();
      savedWorkspace=null;
      if(destroyed||workspace===tab&&(tab!=='work'||workPage==='home'))return;
      captureCourseView();
      workspace=tab;
      if(tab==='work')workPage='home';
      render({motionTarget:'.rd-workspace'});
      container.querySelector('.rd-workspace-tab[aria-selected="true"]')?.focus({preventScroll:true});
    }
    const aiContext=()=>{
      if(destroyed)return null;
      const ctx=buildContext();
      return {
        ...ctx,
        agentAssignments:currentSnapshot.assignments,
        agentCourses:currentSnapshot.courses,
        courseId:hereCourse(),
        aiAssignmentId:!room&&workspace==='work'&&readerOpen?selectedId:null,
        aiSelectedIds:selectionIds.size?[...selectionIds]:undefined,
        biscuitContext:board?.biscuitContext?.(),
        pageKind:room?here():readerOpen?readerTab==='plan'?'notes':'assignment':workspace,
        now:Date.now(),
        aiResources:ctx.courses.map(c=>materials?.getCourse(c.id)?.raw).filter(Boolean),
        aiUpdates:ctx.courses.map(c=>({courseId:c.id,announcements:hub?.getCourse(c.id)?.announcements||[]}))};
    };
    if(enabled('ai')&&enabled('tools'))agentController=root.CanvasHarnessAgentClient?.ensure({getContext:aiContext,store,client:resourceClient,user:snapshot.user,demo})||null;
    const toolbox=enabled('tools')?root.ReserveToolbox?.create({container,store,materials,aiConfig:{client:resourceClient,user:snapshot.user,demo},getContext:aiContext,
      onDockChange:({open,collapsed})=>{
        if(open)settingsDock?.close({restoreFocus:false});
        container.dataset.toolbox=open?(collapsed?'collapsed':'open'):'closed';
        container.getRootNode?.()?.host?.toggleAttribute('data-reserve-tools',open);
      },
      onNavigate:next=>{
        if(!workspaceEnabled(next))return;savedWorkspace=null;
        captureCourseView();workspace=next;
        if(['hub','materials'].includes(next)&&state.courseId==='all'){const ctx=buildContext();switchCourse(String(ctx.selected?.courseId||ctx.courses[0]?.id||'all'));}
        materials?.activate(state.courseId);render();
        if(next==='materials')materials?.load(state.courseId);if(next==='hub')hub?.loadCourse(state.courseId);if(next==='inbox')hub?.loadInbox();
      },
      onPreview:id=>{
        captureCourseView();
        workspace='work';
        const item=buildContext().items.find(x=>x.id===id);
        if(item&&state.courseId!=='all'&&state.courseId!==String(item.courseId))switchCourse('all');
        readerOpen=false;
        showPreview(id,{detail:0});
      },
      onPlanner:options=>openPlanner(options),onRefresh:()=>runRefresh({reportError:true}),onCustomize:()=>settingsDock?.open()
    // A running focus session turns "your week" into Home, where its card lives,
    }):null;
    // for the toolbar button and the Tools dock (Quick open's Planner) alike.
    function openPlanner(options){
      if(options?.page==='week'&&!enabled('planner')||options?.page==='grades'&&!enabled('grades')||options?.page==='settings'&&!enabled('customization'))return;
      if(options?.page==='week'&&root.ReservePlannerUI){goWorkspace('plan');return;}
      onPlanner({...options,...(options?.page==='week'&&personal.focus?.endsAt?{page:'home'}:{}),hideGrades:settings().showGrades!==true});
    }

    function settings(){
      return {
        ...personal.settings,
        ...(gradeVisibilityOverride===null?{}:{showGrades:gradeVisibilityOverride}),
        ...(!enabled('grades')?{showGrades:false}:{}),
        ...(!enabled('motion')?{motion:'off',livingArt:'off'}:{}),
        ...(!enabled('course-hub')?{showCourseInformation:false}:{}),
        ...(!enabled('course-art')&&!(enabled('scene-themes')&&['starry','sea','stars','blueprint'].includes(personal.settings.sceneTheme))?{courseCardStyle:'rounded',showCourseIcons:false}:{})
      };
    }

    // Saved dark/system preferences render in the original light palette.
    // Course drawings retain their authored colors.
    // Dark only when chosen in Make it yours (never from the system: the user, 2026-10). 'system' from older saves is light.
    function effectiveTheme(s){
      const wanted=s.theme==='dark'?'dark':'light',colors=makeOwn?.state.theme?.colors,adjusted=s.makeYourOwn?.adjustments?.['pack:'+s.makeYourOwn?.theme?.id]?.colors;
      return colors&&!colors[wanted]&&!adjusted?.[wanted]?(colors.light?'light':'dark'):wanted;
    }
    // ARTWORK AT NIGHT (dark theme): 0-49 the drawings are chalk on the dark page (brightest at 0), 50-100 they stay on
    // paper, dimmed (least at 100). Sets data-night and the numbers refresh.css reads; light mode carries none of it.
    function applyNight(value){
      const v=Math.max(0,Math.min(100,Math.round(Number(value)||0))),style=container.style;
      if(container.dataset.theme!=='dark'){
        delete container.dataset.night;
        for(const name of ['--rd-chalk','--rd-night-wash','--rd-night-b'])if(style.getPropertyValue?.(name)!=='')style.removeProperty?.(name);
        return;
      }
      const mix=(a,b,k)=>'#'+[0,2,4].map(i=>Math.round(parseInt(a.slice(1+i,3+i),16)*(1-k)+parseInt(b.slice(1+i,3+i),16)*k).toString(16).padStart(2,'0')).join('');
      if(v<50){const k=v/50;setData('night','chalk');setVar('--rd-chalk',mix('#D2C8B2','#8C8474',k));setVar('--rd-night-wash',String(+(0.78-0.2*k).toFixed(3)));}
      else{const k=(v-50)/50;const b=0.46+0.24*k;setData('night','paper');setVar('--rd-chalk','#A89F8C');setVar('--rd-night-b',String(+b.toFixed(3)));}
    }

    let sceneActive=false;

    function validColor(value,fallback){
      return /^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
    }

    let railTimer=0,railRetry=false,railSelectionFrame=0,railTop='',railBelow='',railDirty=true,railSignature='',railNodes=[],railStatusInline=true;
    const railWatched=new Set(),railSizes=new WeakMap();
    function queueRail(){
      if(destroyed)return;
      railDirty=true;
      if(railRetry&&railTimer){root.clearTimeout(railTimer);railTimer=0;}
      railRetry=false;
      if(!railTimer)railTimer=root.setTimeout(()=>{railTimer=0;measureRail();keepFocusVisible();sheetCover();},0);
    }
    // The rail fills the screen below the toolbar and Appearance panel, so measure
    // again whenever they or .rd resize: accordion frames, rewrapping, late fonts or
    // sheets, a revealed host. Always after the frame, so the write can never resize
    // an observed box inside its own callback.
    const railLayout=typeof root.ResizeObserver==='function'?new root.ResizeObserver(entries=>{
      if(destroyed)return;
      let changed=false;
      for(const entry of entries){
        const box=entry.borderBoxSize?.[0]||entry.borderBoxSize,
          size=[box?.inlineSize??entry.contentRect?.width,box?.blockSize??entry.contentRect?.height].join(','),
          old=railSizes.get(entry.target);
        if(old!==size){railSizes.set(entry.target,size);changed=true;}
      }
      if(changed)queueRail();
    }):null;
    function watchRail(){
      const nodes=[container.querySelector('.rd-course-rail'),container.querySelector('.rd-shell'),container.querySelector('.rd-shell > .rd-workspace')];
      if(nodes.some((node,i)=>node!==railNodes[i])){railNodes=nodes;railDirty=true;}
      if(!railLayout)return;
      const next=new Set([container,...(container.querySelectorAll?.('.rd-toolbar,.rd-appearance,.rd-shell,.rd-workspace,.rd-course-rail,.rd-course-name,.rd-rail-text,.rd-status')||[])]);
      for(let node=container.parentElement||container.getRootNode?.()?.host;node?.nodeType===1;node=node.parentElement||node.getRootNode?.()?.host)next.add(node);
      for(const node of railWatched)if(!next.has(node)){railLayout.unobserve?.(node);railWatched.delete(node);}
      for(const node of next)if(!railWatched.has(node)){railWatched.add(node);railLayout.observe(node);}
    }
    const railAncestors=typeof root.MutationObserver==='function'?new root.MutationObserver(records=>{
      if(records.some(record=>record.attributeName!=='class'||(record.oldValue||'').replace(/\breserve-fit\b/g,'').trim()!==(record.target.getAttribute('class')||'').replace(/\breserve-fit\b/g,'').trim()))
        queueRail();
    }):null;
    if(railAncestors)
      for(let node=container.parentElement||container.getRootNode?.()?.host;node?.nodeType===1;node=node.parentElement||node.getRootNode?.()?.host)
        railAncestors.observe(node,{attributes:true,attributeOldValue:true,childList:true,attributeFilter:['class','style','hidden']});
    // Phones: the open reader sheet (refresh.css section 16) covers the workspace below the command bar.
    root.addEventListener?.('resize',queueRail);document.fonts?.addEventListener?.('loadingdone',queueRail);
    // What it covers is inert, so Tab never lands behind it; the sheet stays non-modal (the bar above it,
    // Esc and Back to list still work). Every render and every resize past 600px sets or clears it (patchUI
    // strips attributes the markup does not carry, so it is re-applied after each patch).
    function sheetCover(){
      const workspaceNode=container.querySelector?.('.rd-workspace');if(!workspaceNode?.children)return;
      const covered=!destroyed&&readerOpen&&workspace==='work'&&phone()&&!!workspaceNode.querySelector?.('.rd-information > .rd-reader'),nodes=[];
      for(const node of workspaceNode.children){
        if(!node.classList?.contains('rd-main')){nodes.push(node);continue;}
        for(const part of node.children||[]){
          if(!part.classList?.contains('rd-information')){nodes.push(part);continue;}
          for(const piece of part.children||[])if(!piece.classList?.contains('rd-reader'))nodes.push(piece);
        }
      }
      for(const node of nodes){const has=node.hasAttribute?.('inert');if(covered){if(!has)node.setAttribute?.('inert','');}else if(has!==false)node.removeAttribute?.('inert');}
    }
    // Wide and narrow layouts each show their own copy of the course-information
    // header; when a resize or zoom hides the focused copy, focus follows to the shown one.
    // The browser drops focus from a copy that becomes display:none before any
    // callback runs, so remember the header control that last had focus and
    // forget it when focus leaves it on purpose (Tab, or a click while visible).
    let headerFocus=null;
    const onHeaderFocusin=event=>{headerFocus=event.target?.closest?.('.rd-deck-header')?event.target:null;};
    const onHeaderFocusout=event=>{if(event.target===headerFocus&&event.target.getClientRects?.().length)headerFocus=null;};
    function keepFocusVisible(){
      const lost=headerFocus,active=container.getRootNode?.()?.activeElement,header=lost?.closest?.('.rd-deck-header');
      if(!header||!lost.isConnected||(active&&active!==lost)||lost.getClientRects().length)return;
      const controls=el=>Array.from(el.querySelectorAll('a[href],button')),twin=Array.from(container.querySelectorAll('.rd-deck-header')).find(el=>el!==header&&el.getClientRects().length);
      if(twin)controls(twin)[controls(header).indexOf(lost)]?.focus({preventScroll:true});
    }
    function normalizeData(s){
      if(normalizedCache)return normalizedCache;
      const order=Array.isArray(s.courseOrder)?s.courseOrder.map(String):[];
      const prefs=s.coursePrefs&&typeof s.coursePrefs==='object'?s.coursePrefs:{};
      // Hidden by hand, or not a class (name tools, counseling groups) and never shown by hand (ReserveCore.hiddenCourseIds).
      const normalized=(currentSnapshot.courses||[]).map((raw,index)=>
        ({...C.normalizeCourse(raw),defaultView:raw.default_view||raw.defaultView||'',_index:index})).filter(course=>
        /^\d+$/.test(course.id));
      const hidden=C.hiddenCourseIds(normalized,s);
      normalized.sort((a,b)=>{
        const ai=order.indexOf(a.id),bi=order.indexOf(b.id);
        return (ai<0?order.length+a._index:ai)-(bi<0?order.length+b._index:bi);
      });
      const allCourses=normalized.map((course,index)=>{
        // ownColor: the student chose this colour (it tints the paint of the row's frame); the default goes by position.
        const pref=prefs[course.id]||{};
        // Short labels come from the Canvas name; a student's own name is shown as typed.
        const color=validColor(pref.color,COURSE_COLORS[index%COURSE_COLORS.length]),ownColor=validColor(pref.color,'')!=='';
        // A leading subject ("English: …") leads the line under the title ("Subject · Teacher").
        const label=C.courseLabel?.(course.name)||{title:course.name,teacher:'',sub:'',tag:'',subject:''},custom=pref.name||'';
        const extra=value=>custom&&value&&String(custom).toLowerCase().includes(value.toLowerCase())?'':value;
        return {
          ...course,
          name:custom||course.name,
          originalName:course.name,
          shortName:custom||label.title||course.name,
          subject:extra(label.subject||''),
          teacher:extra(label.teacher),
          sub:extra(label.sub),
          tag:label.tag,
          courseSearch:[course.name,course.code].filter(Boolean).join(' '),
          color,
          ownColor,
          image:safeCourseImage(pref.image)||safeCourseImage(course.image),
          artPrefs:{...s.themeArt,...pref},
          artMotion:enabled('motion')&&s.motion==='gentle'&&s.livingArt!=='off'
        };
      });
      const courseMap=new Map(allCourses.map(course=>[course.id,course]));
      const courses=allCourses.filter(course=>!hidden.has(course.id));
      const items=(currentSnapshot.assignments||[]).map(raw=>{
        const courseId=String(raw?.course_id??raw?.courseId??'');
        const course=courseMap.get(courseId);
        if(!course||hidden.has(courseId))return null;
        return {...C.normalizeAssignment(raw,course),courseSearch:course.courseSearch};
      // Search keeps the full Canvas name (teacher, cohort) even after a rename.
      }).filter(Boolean);
      items.push(...(root.ReservePersonalWork?.normalize(personal,courses)||[]).map(item=>
        ({...item,courseSearch:courseMap.get(String(item.courseId))?.courseSearch||''})));
      return normalizedCache={courses,allCourses,courseMap,items};
    }

    // Canvas's menu bar choice (canvas-nav.js): shown in Make it yours, changed there or in the popup.
    const NAV_CHOICES=['drawn','shown','top','original'];
    function navChanged(changes,area){
      const next=area==='local'?changes?.['reserve:canvasNav']?.newValue:undefined;
      if(next===undefined)return;
      const value=NAV_CHOICES.includes(next)?next:'drawn';
      if(value!==canvasNav){canvasNav=value;if(customizeOpen&&!destroyed)sourceChange();}
    }
    try{
      root.chrome?.storage?.local?.get?.('reserve:canvasNav')?.then?.(saved=>navChanged({'reserve:canvasNav':{newValue:saved?.['reserve:canvasNav']??'drawn'}},'local'))?.catch?.(()=>{});
      root.chrome?.storage?.onChanged?.addListener?.(navChanged);
    }catch{}
    function buildContext(){
      const s=settings();
      const {courses,allCourses,courseMap,items}=normalizeData(s);
      courseMemory.prune(courses.map(course=>course.id));
      if(state.courseId!=='all'&&!courses.some(x=>x.id===state.courseId))switchCourse('all',{rememberCurrent:false});
      const now=Date.now();
      const local=personal.tasks||{};
      const filtered=Model.filterAssignments(items,{...state,now,timeZone:s.timeZone,local,prioritizePins:false});
      const palette=effectiveTheme(s)==='dark'?DARK_ACCENTS:ACCENTS;
      const accent=/^#[\da-f]{6}$/i.test(s.accent)?s.accent:palette[s.accent]||palette.clay;
      const retained=readerOpen?items.find(x=>x.id===selectedId&&x.personal&&(state.courseId==='all'||state.courseId===x.courseId)):null;
      const selected=retained||filtered.items.find(x=>x.id===selectedId)||filtered.items[0]||null;
      if(workspace==='work'&&selectedId!==(selected?.id||null)){selectedId=selected?.id||null;readerTab=selected?.personal?'plan':'details';readerOpen=false;}
      // Rail badges and the heading summary reuse the Up next rules, so every
      const insights=Work.insights(items,local,{now,timeZone:s.timeZone,courseId:state.courseId});
      // number matches the list a student sees after choosing it.
      const courseLoad=new Map(),glance={overdue:0,today:0,tomorrow:0};
      for(const item of Model.filterAssignments(items,{mode:'actionable',courseId:'all',now,timeZone:s.timeZone,local}).items){
        const id=String(item.courseId),due=dateMs(item.dueAt),load=courseLoad.get(id)||{open:0,overdue:0,next:null,then:null};
        // The rail's two earliest items come from the same list, so they agree with the count.
        load.open++;if(due!==null&&due<now)load.overdue++;courseLoad.set(id,load);
        const sooner=other=>!other||due!==null&&(dateMs(other.dueAt)??Infinity)>due;
        if(sooner(load.next)){load.then=load.next;load.next=item;}else if(sooner(load.then))load.then=item;
        if(due===null||(state.courseId!=='all'&&state.courseId!==id))continue;
        const distance=dayDistance(due,now,s.timeZone);
        if(due<now)glance.overdue++;if(distance===0)glance.today++;if(distance===1)glance.tomorrow++;
      }
      const overviewItems=workspace==='home'?Model.filterAssignments(items,{mode:overviewMode,query:overviewQuery,courseId:'all',now,timeZone:s.timeZone,local}).items:[];
      // Each view filter shows the count its list would show once chosen (the same rules, the same search).
      const deckCourse=courses.find(course=>course.id===(state.courseId==='all'?String(selected?.courseId||''):state.courseId))||courses[0]||null;
      const modeCounts=workspace==='work'?
        Object.fromEntries(['actionable','today','week','planned'].map(mode=>
          [mode,mode===state.mode&&!state.day?filtered.items.length:Model.filterAssignments(items,{...state,mode,day:'',now,timeZone:s.timeZone,local}).items.length])):
        {};
      return {
        dockMenu,
        s,
        courses,
        allCourses,
        courseMap,
        items,
        filtered,
        now,
        accent,
        local,
        deadlineChanges:deadlineChanges?.summary(),
        resourcePins:personal.resourcePins||[],
        insights,
        courseLoad,
        glance,
        modeCounts,
        unread:hub?.unreadCount?.()||0,
        selected,
        deckCourse,
        overviewItems,
        overviewMode,
        overviewQuery,
        checkOffNotice,
        selectionIds,
        archiveUndo,
        archiving,
        theme:effectiveTheme(s),
        focusClock:C.focusClock?.(personal.focus,now)||''
      };
    }

    // Every course row in the rail is as tall as the tallest one's content (refresh.css section 3:
    // flex-basis --rd-rail-row-h, growing by equal shares of any spare height), so a course whose name
    // wraps ("Subject: Example Course") sets the rhythm instead of standing out.
    // A row's content is what its course button holds, top-aligned: measured from the button's top to its
    // lowest child, so the row's own (grown) height never feeds back. offsetTop/offsetHeight are layout
    // coordinates: bounding client rects include the scale/translation of active rail-drag and FLIP motion,
    // which would temporarily corrupt the shared row height. Only write when the natural height changes.
    let railRowH='';
    function railRows(rail,css,top){
      const rows=rail?.querySelectorAll?.(':scope > .rd-rail-course');if(destroyed||!rows?.length||!root.getComputedStyle)return false;
      // Both the button and its children may be static-positioned under the row; their offsetParent can
      const px=(style,...names)=>names.reduce((sum,name)=>sum+(parseFloat(style[name])||0),0);let tallest=0;
      // be the row instead of the button. Accumulate offsets to the layout root and subtract them.
      const offsets=new Map(),layoutTop=node=>{
        if(offsets.has(node))return offsets.get(node);
        let top=0;
        for(let part=node;part;part=part.offsetParent){const y=part.offsetTop;if(!Number.isFinite(y))return null;top+=y;}
        offsets.set(node,top);
        return top;
      };
      for(const row of rows){
        const button=row.querySelector('.rd-course-name');if(!button?.getClientRects?.().length)continue;
        const rs=css(row),bs=css(button),top=layoutTop(button);if(top===null)continue;let bottom=top;
        for(const child of button.children){const cs=css(child);if(cs.position==='absolute'||!child.getClientRects().length)continue;
          const y=layoutTop(child),height=child.offsetHeight;if(y!==null&&Number.isFinite(height))bottom=Math.max(bottom,y+height+(parseFloat(cs.marginBottom)||0));}
        // A course set's rail inset (course-sets.js, --rd-set-inset: padding that keeps its text off its frame's drawing)
        // is that row's own: it never sets the height the rows share, nor whether they share one. The row holds it
        // itself (its floor is its own content, scripts/course-sets.cjs railCss).
        const content=bottom-top+px(bs,'paddingBottom','borderBottomWidth')-(parseFloat(bs.getPropertyValue?.('--rd-set-inset'))||0);
        tallest=Math.max(tallest,rs.boxSizing==='border-box'?content+px(rs,'paddingTop','paddingBottom','borderTopWidth','borderBottomWidth'):content);
      }
      // Rows share one height only while they all fit on the first screen. When they cannot, each row keeps
      if(!tallest)return false;
      // its own height ('auto'), so one long course name does not make every course tall and push the rest
      // out of view. Only content heights, the window and the rail's other rows are read: never the rows'
      // own (grown) height, so the choice cannot feed back into itself.
      const railStyle=css(rail);let others=0,gaps=0;
      for(const child of Array.from(rail.children||[])){
        if(child.matches?.('.rd-rail-course')){gaps+=px(css(child),'marginTop','marginBottom');continue;}
        if(child.getClientRects?.().length&&css(child).position!=='absolute')others+=child.offsetHeight||0;
      }
      const view=root.innerHeight||0,room=view-Math.min(parseFloat(top)||150,view*.45)-18-px(railStyle,'paddingTop','paddingBottom','borderTopWidth','borderBottomWidth')-others-12-gaps;
      return !view||Math.ceil(tallest)*rows.length<=room?Math.ceil(tallest)+'px':'auto';
    }
    // After a render settles, record the rail column's page offset on .rd (render
    // never patches its own style) so the course rows can fill the first screen.
    // A hidden host has no boxes and a loading rail is not yet a flex column:
    // neither is measured (a 0 or partial offset would stick); retry briefly.
    function measureRail(tries=0,syncSelection=true){
      // One read phase; even Canvas's document class waits until every style and box has been read.
      if(destroyed||!railDirty)return;if(railTimer)root.clearTimeout(railTimer);railTimer=0;railRetry=false;railDirty=false;
      const styles=new Map(),css=node=>{if(!styles.has(node))styles.set(node,root.getComputedStyle(node));return styles.get(node);};
      const fitted=['dock','topbar'].includes(container.dataset.courseNavigation),
        column=container.querySelector?.('.rd-shell > .rd-workspace'),
        fits=!!column&&typeof root.getComputedStyle==='function'&&(/(auto|scroll)/.test(css(column)?.overflowY||'')||fitted&&css(column)?.overflowY==='hidden'),
        classes=root.document?.documentElement?.classList;
      const rail=container.querySelector('.rd-shell .rd-course-rail'),display=rail&&typeof root.getComputedStyle==='function'?css(rail).display:'none';
      const anchor=fitted?container.querySelector('.rd-shell'):rail;
      const status=container.querySelector('.rd-status');railStatusInline=!!status&&(typeof root.getComputedStyle!=='function'||css(status).position!=='absolute');
      let top='',rowHeight=false,below='',retry=false;
      if(anchor&&(fitted||display!=='none')&&typeof anchor.getClientRects==='function'){
        if(!anchor.getClientRects().length||!fitted&&display!=='flex')retry=true;
        else{
          top=Math.max(0,Math.round((fitted?anchor:anchor.parentElement).getBoundingClientRect().top+(root.scrollY||0)))+'px';if(!fitted)rowHeight=railRows(rail,css,top);
          const edge=(node,...sides)=>{const style=css(node);return sides.reduce((sum,side)=>sum+(parseFloat(style[side])||0),0);};
          let height=railStatusInline?status.getBoundingClientRect().height+edge(status,'marginTop','marginBottom'):0;
          for(let node=container;node?.nodeType===1;node=node.parentElement||node.getRootNode?.()?.host)height+=edge(node,'paddingBottom','borderBottomWidth','marginBottom');
          below=Math.ceil(height)+'px';
        }
      }
      // Writes never repeat for an unchanged value, and cannot interrupt the read phase.
      if(classes?.contains?.('reserve-fit')!==fits)root.document?.documentElement?.classList?.toggle?.('reserve-fit',fits);
      const rowsChanged=!!rowHeight&&rowHeight!==railRowH;if(rowsChanged)container.style.setProperty('--rd-rail-row-h',railRowH=rowHeight);
      if(top&&top!==railTop)container.style.setProperty('--rd-rail-top',railTop=top);
      if(status&&below&&below!==railBelow)container.style.setProperty('--rd-status-h',railBelow=below);
      // Ordinary renders leave a pending hidden/loading retry alone; only that retry or an invalidation reads again.
      if(rowsChanged&&syncSelection&&!railSelectionFrame)railSelectionFrame=beforePaint(()=>{railSelectionFrame=0;if(!destroyed)motion?.syncTabs(false);});
      if(retry&&tries<20){railRetry=true;railTimer=root.setTimeout(()=>{railTimer=0;railRetry=false;railDirty=true;measureRail(tries+1);},100);}
    }

    function readingContent(item){
      if(!item?.description)return {html:'',links:[]};
      if(contentCache.has(item.id))return contentCache.get(item.id);
      const sourceTemplate=document.createElement('template'),evidence=new Map();sourceTemplate.innerHTML=item.description;
      for(const anchor of sourceTemplate.content.querySelectorAll('a[href]')){
        try{
          const url=new URL(anchor.getAttribute('href'),CANVAS_ORIGIN+'/');
          if(url.username||url.password||!['https:','http:'].includes(url.protocol))continue;
          const names=['download','data-filename','data-file-name','data-pdf-name','title','aria-label'].map(name=>anchor.getAttribute(name)).concat(anchor.textContent.trim()),
            filename=names.find(name=>/\.pdf$/i.test(String(name||'').trim())),
            mime=['type','data-content-type','data-mime-type','data-mime','data-pdf-mime'].some(name=>/^application\/pdf(?:\s*;|$)/i.test(String(anchor.getAttribute(name)||'').trim())),
            download=anchor.hasAttribute('download')||
              ['title','aria-label'].map(name=>anchor.getAttribute(name)).concat(anchor.textContent).some(label=>/^\s*download(?:\s|$)/i.test(String(label||'')))||
              /(?:^|[\s_-])download(?:[\s_-]|$)/i.test(anchor.getAttribute('class')||'');
          const records=evidence.get(url.href)||[];
          records.push({name:filename||names.find(name=>String(name||'').trim())||'',pdf:!!filename||mime,download});
          evidence.set(url.href,records);
        }catch{}
      }
      const html=U.safeRichHTML(item.description);
      const template=document.createElement('template');template.innerHTML=html;
      const urls=new Set(),links=[];
      for(const anchor of template.content.querySelectorAll('a[href]')){
        try{
          const url=new URL(anchor.getAttribute('href'));
          if(url.username||url.password||!['https:','http:'].includes(url.protocol))continue;
          const source=evidence.get(url.href)?.shift(),
            label=anchor.textContent.trim()||url.pathname.split('/').filter(Boolean).pop()||url.hostname,
            file=url.origin===CANVAS_ORIGIN&&url.pathname.match(/^\/(?:courses\/(\d+)\/)?files\/(\d+)(?:\/(?:download|preview))?\/?$/),
            courseId=file?.[1]||String(item.courseId||''),
            pdf=file&&/^\d+$/.test(courseId)&&(source?.pdf||/\.pdf$/i.test(label))?{fileId:file[2],courseId,name:source?.name||label}:null;
          if(source?.download)anchor.setAttribute('data-pdf-download','true');
          if(pdf)for(const [name,value] of [['file-id',pdf.fileId],['course-id',pdf.courseId],['name',pdf.name],['mime','application/pdf']])anchor.setAttribute('data-pdf-'+name,value);
          if(urls.has(url.href)||links.length>=12)continue;
          urls.add(url.href);
          links.push({url:url.href,label,...(source?.download?{download:true}:{}),...(pdf?{pdf}:{})});
        }catch{}
      }
      // A stand-alone attachment paragraph is represented once in Linked materials.
      for(const paragraph of template.content.querySelectorAll('p')){
        const anchors=paragraph.querySelectorAll('a[href]');
        if(anchors.length===1&&urls.has(anchors[0].getAttribute('href'))&&paragraph.textContent.trim()===anchors[0].textContent.trim())paragraph.remove();
      }
      const content={html:template.innerHTML,links};contentCache.set(item.id,content);return content;
    }

    function formatDate(value,timeZone,options){
      const ms=dateMs(value);
      if(ms===null)return 'No due date';
      try{
        const key=JSON.stringify([timeZone,options]);
        if(!formatters.has(key))formatters.set(key,new Intl.DateTimeFormat('en-US',{timeZone:timeZone||'America/New_York',...options}));
        return formatters.get(key).format(new Date(ms));
      }
      catch{return new Intl.DateTimeFormat('en-US',options).format(new Date(ms));}
    }

    function dayKey(value,timeZone){
      if(dateMs(value)===null)return null;
      return formatDate(value,timeZone,{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$1-$2');
    }

    function dayDistance(value,now,timeZone){
      const due=dayKey(value,timeZone),today=dayKey(now,timeZone);
      if(!due||!today)return null;
      return Math.round((Date.parse(`${due}T12:00:00Z`)-Date.parse(`${today}T12:00:00Z`))/DAY);
    }

    function dueText(item,ctx){
      const due=dateMs(item.dueAt);
      if(due===null)return 'No due date';
      const diff=dayDistance(due,ctx.now,ctx.s.timeZone);
      const time=formatDate(due,ctx.s.timeZone,{hour:'numeric',minute:'2-digit'});
      const olderYear=dayKey(due,ctx.s.timeZone)?.slice(0,4)!==dayKey(ctx.now,ctx.s.timeZone)?.slice(0,4);
      const date=formatDate(due,ctx.s.timeZone,{month:'short',day:'numeric',...(olderYear?{year:'numeric'}:{})});
      if(!C.isWorkComplete(item,ctx.local[item.id])&&due<ctx.now)return `Overdue · ${date}, ${time}`;
      if(diff===0)return `Today · ${time}`;
      if(diff===1)return `Tomorrow · ${time}`;
      return `${date} · ${time}`;
    }

    function scoreText(course){
      if(course.hideFinalGrades||course.scoreScope==='hidden')return '—';
      if(Number.isFinite(course.score))return `${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(course.score)}%`;
      return course.grade||'—';
    }

    function icon(name){return typeof root.ReserveIcon==='function'?root.ReserveIcon(name,'rd-icon'):'';}

    function renderWarning(){
      const saveWarning=transientStatus.startsWith('Could not save:')?`<div class="rd-warning" role="alert"><span>${E(transientStatus)} ${drafts.size?'Your text is kept here.':'Your work has not been changed. Try the action again.'}</span>${drafts.size?'<button type="button" class="rd-button" data-rd-action="retry-save">Retry save</button>':''}</div>`:'';
      if(currentSnapshot.partial!==true)return saveWarning;
      const errors=Array.isArray(currentSnapshot.errors)?currentSnapshot.errors:[];
      const names=errors.map(error=>error?.courseName).filter(Boolean).slice(0,3);
      return saveWarning+`<div class="rd-warning" role="note">${icon('warning')}<div><strong>Some Canvas data is incomplete.</strong><span>${errors.length} course${errors.length===1?'':'s'} did not fully load${names.length?`: ${E(names.join(', '))}`:''}. Refresh when Canvas is available.</span></div></div>`;
    }

    function captureCourseView(){
      const previous=courseMemory.recall(state.courseId),reader=container.querySelector('.rd-reader'),content=reader?.querySelector('.rd-reader-content');
      const same=container.dataset.courseId===state.courseId&&reader?.dataset.id===selectedId&&content?.getClientRects().length;
      const pending=pendingReaderScroll?.courseId===state.courseId&&pendingReaderScroll.id===selectedId?pendingReaderScroll:null;
      courseMemory.remember(state.courseId,{
        ...state,
        limit:visibleLimit,
        selectedId,
        readerTab,
        readerOpen,
        readerScroll:pending?pending.top:same?content.scrollTop:previous.selectedId===selectedId?previous.readerScroll:0
      });
    }
    function restoreReaderScroll(){
      if(destroyed||workspace!=='work'||!pendingReaderScroll)return false;
      if(pendingReaderScroll.courseId!==state.courseId||pendingReaderScroll.id!==selectedId){pendingReaderScroll=null;return false;}
      // First mount may precede stylesheet loading or Canvas revealing the host.
      const reader=container.querySelector('.rd-reader-content');
      // Keep the requested position until the pane has a real, styled layout.
      if(!reader?.getClientRects().length||!root.getComputedStyle(container).getPropertyValue('--rd-line').trim())return false;
      reader.scrollTop=pendingReaderScroll.top;pendingReaderScroll=null;
      readerLayout?.disconnect();return true;
    }
    function switchCourse(id,{rememberCurrent=true}={}){
      id=String(id);if(id===state.courseId)return false;
      if(id!=='all'&&!normalizeData(settings()).courses.some(course=>course.id===id))return false;
      if(rememberCurrent)captureCourseView();
      const next=courseMemory.recall(id,{...state,courseId:id,query:'',limit:60});
      state=Model.cleanState(next);visibleLimit=next.limit;selectedId=next.selectedId;readerTab=next.readerTab;readerOpen=next.readerOpen;
      pendingReaderScroll={courseId:id,id:selectedId,top:next.readerScroll};return true;
    }
    function navigationState(preserveDisabled=false){
      captureCourseView();
      return {
        ...courseMemory.recall(state.courseId),
        ...(room?.kind==='impact'?{courseId:room.course}:{}),
        workspace:preserveDisabled&&savedWorkspace?savedWorkspace:room?here():workspace==='work'&&workPage==='assignments'?'assignments':workspace,
        overviewVersion:1,
        courseViews:courseMemory.serialize(),
        gradeVisibilityOverride:gradeVisibilityOverride===false?false:undefined
      };
    }
    function remember(){
      state=Model.cleanState({...state,limit:visibleLimit});
      try{if(stateKey)root.sessionStorage?.setItem(stateKey,JSON.stringify(navigationState(true)));}catch{}
    }

    // The view's arguments. The panel-only form (renderPanel) leaves out the page's own HTML parts, which it never shows.
    function viewArgs(ctx,assignmentContent,panel=false){
      return {
        ...ctx,
        state,
        workspace,
        workPage:workspace==='work'?workPage:'',
        gradeImpact,
        gradeImpactRevision:currentSnapshot.fetchedAt,
        reviewDeck,
        reviewDeckHTML:!panel&&workspace==='review'?reviewDeck?.renderReviewDeck()||'':'',
        gradeQuery,
        gradeLimit,
        arrangeOpen:!!arrange?.active(),
        boardEditing:!!board?.editing(),
        planUI:board?.planUI()||{},
        customizeTab,
        canvasNav,
        personal:{focus:personal.focus,pet:personal.pet,toolbox:personal.toolbox},
        studyAids,
        hasLayoutUndo:!!ctx.s.workspaceUndo,
        deckHeader:!panel&&workspace==='work'?hub?.renderDeckHeader?.(ctx.deckCourse,{arrange:enabled('arrange')})||'':'',
        deckContent:!panel&&workspace==='work'?hub?.renderDeck?.(ctx.deckCourse,{header:false})||'':'',
        hubContent:panel?'':workspace==='hub'?hub?.renderHub(ctx.courseMap.get(state.courseId),{sharedHeading:true}):workspace==='inbox'?hub?.renderInbox(ctx.courses):'',
        materialLibrary:!panel&&workspace==='materials'?materials?.renderLibrary(ctx.courseMap.get(state.courseId),{sharedHeading:true}):'',
        relatedMaterials:panel?'':materials?.renderRelated(ctx.selected,assignmentContent.links)||'',
        readerTab,
        customizeOpen,
        customizeCourseId,
        customizeStatus,
        customizeBusy,
        customizeDrafts,
        customKits,
        kitName,
        preferences:preferences?.state,
        makeOwn:makeOwn?{...makeOwn.state,pet:makeOwn.state.pet||companionPack}:companionPack?{pet:companionPack}:null,
        quickUpload:quickUpload?.state,
        quickPackDraft,
        quickPackFileName,
        quickPackError,
        quickPackLoading,
        user:currentSnapshot.user,
        demo,
        nativeSwitch:typeof onNative==='function',
        refreshing,
        visibleLimit,
        noteStatus:drafts.has(`notes:${ctx.selected?.id}`)?
          transientStatus.startsWith('Could not save:')?'Not saved. Retry above.':'Saving note…':
          ctx.local[ctx.selected?.id]?.notes?'Note saved on this device.':'Notes save automatically.',
        readerContent:assignmentContent,
        warning:panel?'':renderWarning(),
        status:statusLabel(currentSnapshot,externalStatus,transientStatus)
      };
    }
    // A Make it yours tab shows another page of the panel and changes nothing else on the page, so only the panel is
    // redrawn: a whole render patched and then measured about 3,000 nodes for it (0.2-0.3 s on a real Canvas page).
    // Anything else waiting to render, or a course that vanished (buildContext switches course), takes the whole render.
    function renderPanel(){
      if(destroyed||rendering||pendingRender||sourceFrame||!mounted||!View.renderCustomization)return false;
      const inner=container.querySelector('.rd-appearance .t-acc-panel-inner');if(!inner)return false;
      const course=state.courseId,ctx=buildContext();if(state.courseId!==course)return false;
      const template=document.createElement('template');template.innerHTML=View.renderCustomization(viewArgs(ctx,{html:'',links:[]},true));
      const next=template.content.querySelector('.rd-appearance .t-acc-panel-inner');if(!next)return false;
      const sections=new Map(Array.from(inner.querySelectorAll?.('details[data-rd-section]')||[]).map(el=>[el.dataset.rdSection,el.open]));
      rendering=true;try{patchUI(inner,next);}finally{rendering=false;}
      // What a whole render does for the panel after its patch: media and frame previews, saved kits, the Features
      // mount, unsaved text and open sections.
      mediaController?.sync();frameController?.sync();frameEditor?.sync();
      if(customizeOpen&&!kitsLoaded&&mediaStore){
        kitsLoaded=true;
        mediaStore.listKits().then(kits=>{if(!destroyed){customKits=kits;if(!renderPanel())scheduleRender();}}).catch(error=>{
          if(!destroyed){customizeStatus=error.message;scheduleRender();}
        });
      }
      settingsDock?.sync();
      for(const draft of drafts.values()){const field=container.querySelector(`[data-rd-field="${draft.field}"][data-id="${draft.id}"]`);if(field)field.value=draft.value;}
      for(const [id,value] of stepDrafts){const field=container.querySelector(`[data-rd-field="new-step"][data-id="${id}"]`);if(field)field.value=value;}
      for(const el of inner.querySelectorAll?.('details[data-rd-section]')||[])if(sections.has(el.dataset.rdSection))setProp(el,'open',sections.get(el.dataset.rdSection));
      return true;
    }
    // A page swap (a room growing out of its module or folding back into it, Home and Assignments, a tab's page): the
    // control that started it (Fold, the module's opener) has focus and sits on the page that goes. Removed with focus
    // inside it, after the new page had gone in, the old page made the browser restyle the whole new page right there
    // to move focus (Chrome's focus fix-up): 0.4-0.6 s of the fold's long frame at 4x CPU, against 33 ms for the removal
    // itself. Focus is let go first, while the page is still as it was drawn; the swap's own focus code then places it
    // (the opener, Fold, the tab). Every other render leaves focus where it is.
    const pageOf=()=>workspace+'|'+(workspace==='work'?workPage:'')+'|'+(workspace==='grades'?state.courseId:'');
    function releasePageFocus(){
      const page=pageOf(),was=shownPage;shownPage=page;if(!mounted||!was||was===page)return false;
      const column=container.querySelector('.rd-shell > .rd-workspace'),active=container.getRootNode?.()?.activeElement;
      if(active&&active!==column&&column?.contains?.(active)&&!active.closest?.('.rd-workspace-heading'))active.blur?.();
      return true;
    }
    function renderNow({preserveFocus=true,tabMotion=false,motionTarget='',motionKind='workspace',direction=1,snapshot=null,resetWorkspaceScroll=false}={}){
      if(destroyed)return;
      // whether a room's move is playing, read once as the render starts (a long render must not outlast its own answer)
      const moving=Number(container.dataset.chMoving||0)>Date.now();
      const oldReader=container.querySelector('.rd-reader-content'),previousCourse=container.dataset.courseId;
      const readerScroll=oldReader?.getClientRects().length?oldReader.scrollTop:courseMemory.recall(previousCourse).readerScroll;
      const oldMaterialPage=container.querySelector('.rd-material-page');
      if(oldMaterialPage)materials?.rememberPageScroll(oldMaterialPage.dataset.materialCourse,oldMaterialPage.dataset.materialResource,oldMaterialPage.scrollTop);
      const previousSelected=container.querySelector('.rd-reader')?.dataset?.id;
      const disclosures=new Map(Array.from(container.querySelectorAll?.('details[data-rd-section]')||[]).map(el=>[el.dataset.rdSection,el.open]));
      let focus=null;
      if(preserveFocus){
        const active=container.querySelector(':focus');
        if(active?.id==='rd-material-title')focus={materialTitle:true};
        if(active?.tagName==='SUMMARY'&&active.parentElement?.dataset.rdSection)focus={section:active.parentElement.dataset.rdSection};
        if(active?.dataset?.rdField){
          focus={
            course:active.dataset.course,
            place:active.dataset.place,
            file:active.dataset.file,
            field:active.dataset.rdField,
            id:active.dataset.id,
            step:active.dataset.step,
            setting:active.dataset.setting,
            message:active.dataset.message,
            value:active.value,
            start:active.selectionStart,
            end:active.selectionEnd
          };
        }
        else if(active?.dataset?.rdAction){
          focus={
            place:active.dataset.place,
            file:active.dataset.file,
            action:active.dataset.rdAction,
            id:active.dataset.id,
            mode:active.dataset.mode,
            day:active.dataset.day,
            accent:active.dataset.accent,
            tab:active.dataset.tab,
            resource:active.dataset.resource,
            course:active.dataset.course,
            message:active.dataset.message,
            choice:active.dataset.value,
            entry:active.dataset.entry
          };
        }
        // The control itself: patchUI keeps it, so when it is still the same control and still shown, focus stays on it
        // (siblings that differ only by data-value or data-entry, like All | Unread or two Read more buttons, never trade places).
        if(focus&&!focus.materialTitle&&!focus.section)focus.node=active;
      }
      syncCompanion();
      // Read synchronous deck/material state before markup. Notifications here are already represented below.
      const ctx=buildContext();
      const deckId=enabled('course-hub')&&hub&&workspace==='work'?ctx.deckCourse?.id||'':'';
      if(deckId!==deckCourseRequested){deckCourseRequested=deckId;if(deckId)hub?.loadDeck?.(deckId);ctx.unread=hub?.unreadCount?.()||0;}
      // Later notifications (including any microtask chain) share one rAF after the task, before paint.
      consumeSources();
      setData('featureMotion',enabled('motion')?'on':'off');setData('arrange',arrange?'on':'off');
      const dataTheme=enabled('customization')&&!ctx.s.sceneTheme?makeOwn?.state.theme:null;
      const scene=!dataTheme&&enabled('scene-themes')&&root.ReserveSceneThemes&&['starry','sea','stars','blueprint'].includes(ctx.s.sceneTheme)?ctx.s.sceneTheme:'';
      setData('theme',ctx.theme);applyNight(ctx.s.nightArt);
      setData('density',ctx.s.density==='compact'?'compact':'comfortable');
      setData('font',['humanist','serif'].includes(ctx.s.font)?ctx.s.font:'system');
      setData('textSize',ctx.s.textSize||'standard');
      setData('layout',ctx.s.deskOrder==='stacked'?'list':'split');
      setData('workspaceMode',Arrange?.snapshot(ctx.s).mode||'side-by-side');
      setData('arranging',String(!!arrange?.active()));
      for(const [key,value] of Object.entries(root.ReserveCustomization?.defaults||{})){
        const shown=ctx.s[key]??value;
        if(shown===null||typeof shown!=='object')setData(key,String(shown));
      }
      setVar('--rd-dock-scale',String(Number(ctx.s.dockScale)||1));
      // Gentle (default), Still or Off; motion.js also treats a reduced-motion device as Off.
      setData('boardEditing',String(!!board?.editing()));
      // Living drawings (default On): the course drawings keep moving once drawn (Gentle only).
      setData('motionStyle',MOTION_STYLES.includes(ctx.s.motion)?ctx.s.motion:'gentle');
      // Teacher text, announcements and messages: the book serif (default) or the interface sans.
      setData('livingArt',ctx.s.livingArt==='off'?'off':'on');
      setData('readingFont',ctx.s.readingFont==='interface'?'interface':'book');
      setData('readerOpen',String(readerOpen));
      setData('courses',String(ctx.s.showCourseStrip!==false));
      if(scene||dataTheme){if(container.style.getPropertyValue?.('--rd-accent')!=='')container.style.removeProperty('--rd-accent');}else setVar('--rd-accent',ctx.accent);
      const assignmentContent=readingContent(ctx.selected);
       const markup=View.render(
         viewArgs(ctx,assignmentContent),
         {E,icon,assignmentLink,formatDate,dueText,scoreText,gradePeriodLabel,dayKey,complete},
         {headingCache,reuseHeading:!!container.querySelector('.rd-shell > .rd-workspace-heading, .rd-shell > .rd-workspace > .rd-workspace-heading')?.isConnected});
      const toolbar=container.querySelector('.rd-toolbar'),appearance=container.querySelector('.rd-appearance');
      // A swapped page starts at its top: the column's scroll is reset while the old page is still laid out. Read after
      // the swap, the offset laid the whole new page out inside the render, before the room's own measuring did it again.
      const swapped=releasePageFocus();let scrollReset=false;
      if(swapped&&resetWorkspaceScroll){const column=container.querySelector('.rd-shell > .rd-workspace');if(column?.scrollTop)column.scrollTop=0;scrollReset=true;}
      if(toolbar){
        // Keep the actual transitioning nodes connected through data renders.
        const template=document.createElement('template');template.innerHTML=markup;
        if(Object.keys(studyAids).length)StudyUI?.renderTags(template.content,studyAids,{env:root});
        const nextToolbar=template.content.querySelector('.rd-toolbar'),nextAppearance=template.content.querySelector('.rd-appearance');
        // The live region and its observed box stay connected across data renders too.
        const shell=container.querySelector('.rd-shell'),
          nextShell=template.content.querySelector('.rd-shell'),
          footer=container.querySelector('.rd-status'),
          nextFooter=template.content.querySelector('.rd-status');
        if(footer&&nextFooter){patchUI(footer,nextFooter);nextFooter.remove();}
        if(shell&&nextShell){
          const workspaceNode=shell.querySelector('.rd-workspace'),nextWorkspace=nextShell.querySelector('.rd-workspace');
          const heading=shell.querySelector('.rd-workspace-heading'),nextHeading=nextShell.querySelector('.rd-workspace-heading');
          if(nextHeading?.parentElement===nextShell){
            if(heading&&heading.getAttribute('data-rd-key')===nextHeading.getAttribute('data-rd-key')){
              patchUI(heading,nextHeading);
              if(heading.parentElement!==shell||shell.firstElementChild!==heading)shell.prepend(heading);
            }
            else{heading?.remove();shell.prepend(nextHeading);}
          }
          else if(heading?.parentElement===shell)workspaceNode.prepend(heading);
          patchUI(workspaceNode,nextWorkspace);
          const rail=shell.querySelector('.rd-course-rail,.rd-dock'),nextRail=nextShell.querySelector('.rd-course-rail,.rd-dock');
          if(rail&&nextRail&&rail.nodeName===nextRail.nodeName)patchUI(rail,nextRail);else{rail?.remove();if(nextRail)shell.insertBefore(nextRail,workspaceNode);}
          // The dock's card (right-click the dock) sits beside the dock.
          const dockCard=shell.querySelector(':scope > .rd-dock-menu'),nextDockCard=nextShell.querySelector(':scope > .rd-dock-menu');
          if(dockCard&&nextDockCard)
            patchUI(dockCard,nextDockCard);
          else{dockCard?.remove();if(nextDockCard)shell.insertBefore(nextDockCard,shell.querySelector(':scope > .rd-dock')||workspaceNode);}
          nextShell.remove();
        }
        // Stable controls retain focus and let the grade switch finish its tween.
        const tools=toolbar.querySelector('.rd-tools');
        const deadlineButton=tools.querySelector('[data-rd-action="deadline-changes"]'),nextDeadline=nextToolbar?.querySelector('[data-rd-action="deadline-changes"]');
        if(deadlineButton&&nextDeadline)patchUI(deadlineButton,nextDeadline);else if(nextDeadline)tools.prepend(nextDeadline);else deadlineButton?.remove();
        const gradeSwitch=tools.querySelector('[data-setting="showGrades"]');if(gradeSwitch)gradeSwitch.checked=ctx.s.showGrades===true;
        // While syncing, the refresh glyph gives way to the dotted ring (CSS on aria-busy).
        setAttr(tools.querySelector('[data-rd-action="settings"]'),'aria-expanded',String(customizeOpen));
        {
          const refreshButton=tools.querySelector('[data-rd-action="refresh"]');
          for(const name of ['aria-disabled','aria-busy'])if(refreshing)setAttr(refreshButton,name,'true');else refreshButton.removeAttribute(name);
        }
        // Messages carries a muted unread numeral; the phone drawer button mirrors the drawer.
        {
          const unread=ctx.unread||0,badge=toolbar.querySelector('[data-rd-unread]'),said=toolbar.querySelector('[data-rd-unread-sr]');
          if(badge){setProp(badge,'textContent',unread?String(unread):'');setProp(badge,'hidden',!unread);}
          if(said)setProp(said,'textContent',unread?`, ${unread} unread`:'');
         // The command bar's search belongs to Assignments; it keeps the list's query (typed here or in the heading's copy).
         setAttr(toolbar.querySelector('.rd-drawer-button'),'aria-expanded',String(container.dataset.drawer==='open'));
         {const bar=toolbar.querySelector('.rd-bar-search'),field=bar?.querySelector('input');if(bar)setProp(bar,'hidden',workspace!=='work');if(field&&field.value!==state.query)field.value=state.query;}
         // The phone reader sheet (refresh.css section 16) covers Canvas's chrome, as the dock does.
         container.getRootNode?.()?.host?.toggleAttribute?.('data-reserve-sheet',readerOpen&&workspace==='work');}
        nextToolbar.remove();
        for(const tab of toolbar.querySelectorAll('.t-tab')){
          const active=tab.dataset.tab===(workspace==='work'&&workPage==='assignments'?'assignments':workspace);
          setAttr(tab,'aria-selected',String(active));
          setProp(tab,'tabIndex',active?0:-1);
        }
        if(appearance&&nextAppearance){patchUI(appearance.querySelector('.t-acc-panel-inner'),nextAppearance.querySelector('.t-acc-panel-inner'));
        setAttr(appearance,'data-open',String(customizeOpen));
        const panel=appearance.querySelector('.t-acc-panel');setProp(panel,'inert',!customizeOpen);
        if(customizeOpen)panel.removeAttribute('aria-hidden');else setAttr(panel,'aria-hidden','true');
        nextAppearance.remove();}
        // The polite live region ("3 items shown.") stays connected and only its words follow the list: putting a new
        // copy in each render was a change every observer of the page woke for. It is known by its own marker.
        const isLive=node=>node?.nodeType===1&&node.hasAttribute?.('data-rd-list-live');
        const liveNode=Array.from(container.childNodes).find(isLive),
          nextLive=Array.from(template.content.childNodes).find(isLive),
          keptLive=liveNode&&nextLive?liveNode:null;
        if(keptLive){patchUI(keptLive,nextLive);nextLive.remove();}
        for(const node of Array.from(container.childNodes)){
          if(node!==toolbar&&
            node!==appearance&&
            node!==shell&&
            node!==footer&&
            node!==keptLive&&
            !node.classList?.contains('rd-utility-dialog')&&
            !node.classList?.contains('pet-layer')&&
            !node.hasAttribute?.('data-rd-keep'))
            node.remove();
        }
        if(shell)for(const warning of Array.from(template.content.querySelectorAll('.rd-warning')))container.insertBefore(warning,shell);
        container.append(template.content);
      }else{container.innerHTML=markup;if(Object.keys(studyAids).length)StudyUI?.renderTags(container,studyAids,{env:root});}
      setData('courseId',state.courseId);setData('workspace',workspace);setData('workPage',workspace==='work'?workPage:'');
      if(enabled('review-deck')&&reviewDeck||gradeImpact)roomShell();
       if(scene){
         root.ReserveSceneThemes.apply(container.getRootNode?.()||
           target,container,scene,{motionStyle:container.dataset.motionStyle,theme:ctx.theme,adjustments:lookSelection(ctx.s).layer});
         sceneActive=true;
       }
      else if(sceneActive){root.ReserveSceneThemes?.remove(container);sceneActive=false;}
       if(dataTheme)
         root.ReserveDataTheme?.apply(container.getRootNode?.()||
           target,container,dataTheme,{theme:ctx.theme,motionStyle:container.dataset.motionStyle,adjustments:lookSelection(ctx.s).layer});
      else root.ReserveDataTheme?.remove(container);
      mediaController?.sync();frameController?.sync();frameEditor?.sync();
      // The saved kits are drawn only in the Make it yours panel: when they arrive, the panel alone is redrawn.
      if(customizeOpen&&!kitsLoaded&&mediaStore){
        kitsLoaded=true;
        mediaStore.listKits().then(kits=>{if(!destroyed){customKits=kits;if(!renderPanel())scheduleRender();}}).catch(error=>{
          if(!destroyed){customizeStatus=error.message;scheduleRender();}
        });
      }
      settingsDock?.sync();
      if(ctx.s.courseNavigation==='dock'&&container.dataset.drawer==='open')setDrawer(false,{focus:false});
      courseDock.sync();
      // The Help band keeps its last height across a page swap: a new host (Home drawn again after a room folds) starts at
      // that height in its first frame, so the module row under it does not jump 24 px when the band's content comes in
      // a moment later; the hold is let go once the band has had time to fill (idle, after 1.5 s)
      {
        const host=container.querySelector('[data-help-band]');
        if(host&&host!==helpBandHost&&bandHeight>0&&!host.hidden&&!host.style?.minHeight){host.style.minHeight=bandHeight+'px';holdBand(host);}
        watchBand(host);
      }
      arrange?.sync();
      board?.sync();
      const bandHost=container.querySelector('[data-help-band]');
      // What the band ranks by: live items with the student's own done marks (checked off, progress done), kept while
      // neither the items nor the marks change.
      const bandFacts=()=>{
        const items=normalizeData(settings()).items,tasks=personal?.tasks||{};
        if(bandFactsMemo[0]===items&&bandFactsMemo[1]===tasks)return bandFactsMemo[2];
        const out=items.map(it=>{const t=tasks[it?.id];return t&&(t.checkedOff===true||t.progress==='done')?{...it,checkedOff:t.checkedOff===true,progress:t.progress}:it;});
        bandFactsMemo=[items,tasks,out];
        return out;
      };
      if(bandHost&&Band){
        const agent=personal.toolbox?.agent,grades=ctx.s.showGrades===true&&agent?.settings?.grades===true;
        // The band's signature: the study read's (made once per read), whether grade cards show, and the agent runs' ids,
        // states and action outcomes. Card bodies are not stringified on every render.
        const runs=(agent?.runs||[]).filter(run=>grades||!run?.grades),
          cards={...Object.fromEntries(Object.entries(studyAids).filter(([,aid])=>grades||!aid?.gradeAccess)),...Band.agentAids({...agent,runs})},
          signature=(grades?'g':'')+'|'+studyBandSignature+'|'+runs.map(run=>String(run?.id)+':'+String(run?.status)+':'+(run?.actions||[]).map(e=>String(e?.outcome||'')).join(',')).join(';');
        setProp(bandHost,'hidden',ctx.s.showHelp===false);
        // One question, one answer: the engine reuses today's Canvas brief and saves the answer as Help cards.
        const askHelp=askHelpNow=async(text,extra={})=>{const runtime=root.chrome?.runtime;if(!runtime?.sendMessage||!studyScope)return {ok:false,message:'Help needs a signed-in Canvas page.'};
         const items=buildContext().items||[],
           open=workspace==='work'&&readerOpen&&selectedId?items.find(x=>String(x.id)===String(selectedId)):null,
           item=extra.itemId?items.find(x=>String(x.id)===String(extra.itemId))||null:open;
         const plain=v=>
           String(v||'').replace(/<(br|p|li|div|h\d|tr)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
         let day;
         try{day=new Intl.DateTimeFormat('en-CA',{timeZone:settings().timeZone||undefined,year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now());}catch{day=new Date().toISOString().slice(0,10);}
         const card=extra.card?(String(extra.card.headline||'')+'\n'+String(extra.card.text||'')).trim().slice(0,6000):'',
           about=item?
             {itemId:String(item.id),courseId:String(item.courseId),itemTitle:String(item.name||'').slice(0,300),itemText:plain(item.description).slice(0,6000)}:
             extra.itemId?
               {itemId:String(extra.itemId),courseId:String(extra.courseId||''),itemTitle:String(extra.itemTitle||'').slice(0,300)}:
               state.courseId&&state.courseId!=='all'?{courseId:String(state.courseId)}:{};
         const reply=await Promise.resolve(runtime.sendMessage({
           target:'ch-ai-engine',
           op:'ask',
           scopeKey:studyScope,
           requestId:String(root.crypto?.randomUUID?.()||Date.now()).replace(/[^\w-]/g,''),
           day,
           question:text,
           ...about,
           ...(card?{card}:{}),
           ...(card&&/^[\w:.-]{1,120}$/.test(String(extra.card.key||''))?{cardKey:String(extra.card.key)}:{}),
           ...(typeof extra.pasted==='string'&&extra.pasted.trim()?{pasted:extra.pasted.slice(0,30000),pastedTitle:String(extra.pastedTitle||'').slice(0,160)}:{}),
           ...(['auto','test','reading','translate','examples'].includes(extra.make)&&(about.itemId||Array.isArray(extra.items)&&extra.items.length)?{make:extra.make}:{}),
           ...(extra.more===true?{more:true}:{}),
           ...(Array.isArray(extra.items)&&extra.items.length?
             {items:extra.items.slice(0,3).map(it=>({itemId:String(it.itemId||''),courseId:String(it.courseId||''),itemTitle:String(it.itemTitle||'').slice(0,300)}))}:
             {})
         })).catch(error=>
           ({ok:false,error:String(error?.message||error)}));
         return reply?.ok?{ok:true,status:'Asking your AI',run:reply.result||null}:{ok:false,message:reply?.error||'Help is unavailable here. Your question is kept.'};};
        if(bandHost!==helpBandHost){
          helpBand?.destroy();
          helpBandHost=bandHost;
          helpBandSignature=signature;
          helpBand=Band.renderBand(bandHost,cards,{env:root,scope:studyScope,store:studyStore,timeZone:()=>settings().timeZone,itemFacts:bandFacts,onPrepare:()=>{
            if(!agentController?.prepareNow)throw Error('Turn on Your AI in Tools first.');
            return agentController.prepareNow();
          },onPrepareSettings:()=>toolbox?.open('ai'),prepareChoice:()=>{
            const a=personal?.toolbox?.agent;
            return {show:!!agentController&&!demo&&a?.settings?.on!==false&&a?.everyDayChosen!==true,cap:a?.settings?.dailyCap??3};
          },onPrepareChoice:everyDay=>{
            if(!agentController?.settings)throw Error('Turn on Your AI in Tools first.');
            return agentController.settings({everyDay});
          },onPrepareReply:run=>toolbox?.openPrepareReply(run),onAsk:(text,extra)=>askHelp(text,extra),helpItems:()=>{
            const s=settings(),{courses,items}=normalizeData(s),now=Date.now(),day=new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:s.timeZone||undefined});
            return Model.filterAssignments(items,{mode:'actionable',courseId:'all',now,timeZone:s.timeZone,local:personal.tasks||{}}).items.filter(i=>!i.personal&&/^[\w:.-]{1,60}$/.test(String(i.id))).slice(
              0,
              14).map(i=>
              ({
                id:String(i.id),
                courseId:String(i.courseId),
                title:String(i.name||''),
                course:String(courses.find(c=>String(c.id)===String(i.courseId))?.name||''),
                when:dateMs(i.dueAt)!==null?day.format(dateMs(i.dueAt)):''
              }));
          },onDocsAccess:()=>Promise.resolve(root.chrome?.runtime?.sendMessage({target:'ch-ai-engine',op:'docs-access',scopeKey:studyScope})).catch(()=>{}),onProgress:async(key,progress)=>{
            const saved=await studyStore.progress(studyScope,key,progress);
            if(saved)studyAids[key]=saved;
          },onTool:tool=>root.CanvasHarnessStudyTools.execute(tool,{scopeKey:studyScope,context:buildContext(),snapshot:buildContext()}),onError:error=>{
            transientStatus=String(error.message||error);
            updateStatus();
          }});
        }
        else if(signature!==helpBandSignature){helpBandSignature=signature;helpBand.update(cards);}else helpBand.refresh?.();
      }else if(helpBand){helpBand.destroy();helpBand=null;helpBandHost=null;helpBandSignature='';}
      // Reset before motion measures the shared column.
      gradeImpact?.ensure({...ctx,workspace,workPage:workspace==='work'?workPage:'',state,user:currentSnapshot.user,gradeImpactRevision:currentSnapshot.fetchedAt});
      if(resetWorkspaceScroll&&!scrollReset){const column=container.querySelector('.rd-shell > .rd-workspace');if(column?.scrollTop)column.scrollTop=0;}
      // Arrange has now installed the final layout. Measure its layout before motion paints a drag spring
      // and before the next timer/frame, so course rows cannot linger at a compressed intermediate size.
      const signature=JSON.stringify([
        ctx.courses,
        Array.from(ctx.courseLoad),
        ctx.s,
        workspace,
        workPage,
        readerOpen,
        customizeOpen,
        ctx.unread,
        container.dataset.arranging,
        container.dataset.boardEditing,
        container.dataset.drawer,
        renderWarning()
      ]);
      if(signature!==railSignature){railSignature=signature;railDirty=true;}
      watchRail();sheetCover();measureRail(0,false);
      updateStatus();toolbox?.update();syncFocus();
      if(railSelectionFrame){cancelPaint(railSelectionFrame);railSelectionFrame=0;}
      // the tab bar's pill (it measures every surface) waits while a room's move plays (data-ch-moving): in the render that
      // swaps a room's page for Home it was a quarter of a second at 4x CPU in the middle of the fold. The swap itself
      // (a room growing out of its module or folding back: motionTarget set, no tab motion) waits too: its offsets were
      // read over the whole new page in the fold's long frame.
      if(!tabMotion&&moving)syncTabsLater();else motion?.syncTabs(tabMotion,false,snapshot);
      if(motionTarget)motion?.reveal(container.querySelector(motionTarget),{animate:tabMotion&&container.dataset.input==='pointer',kind:motionKind,direction,snapshot});
      for(const draft of drafts.values()){const field=container.querySelector(`[data-rd-field="${draft.field}"][data-id="${draft.id}"]`);if(field)field.value=draft.value;}
      for(const [id,value] of stepDrafts){const field=container.querySelector(`[data-rd-field="new-step"][data-id="${id}"]`);if(field)field.value=value;}
      for(const el of container.querySelectorAll?.('details[data-rd-section]')||[]){if(disclosures.has(el.dataset.rdSection))setProp(el,'open',disclosures.get(el.dataset.rdSection));}
      const reader=container.querySelector('.rd-reader-content'),remembered=courseMemory.recall(state.courseId);
      if(workspace==='work'){
        const top=pendingReaderScroll?.courseId===state.courseId&&pendingReaderScroll.id===ctx.selected?.id?
          pendingReaderScroll.top:
          previousCourse===state.courseId&&previousSelected===ctx.selected?.id?readerScroll:remembered.selectedId===ctx.selected?.id?remembered.readerScroll:0;
        pendingReaderScroll=ctx.selected?{courseId:state.courseId,id:ctx.selected.id,top}:null;
        readerLayout?.disconnect();
        if(!restoreReaderScroll()&&reader&&pendingReaderScroll)readerLayout?.observe(reader);
      }
      remember();
      if(focus?.section){Array.from(container.querySelectorAll?.('details[data-rd-section]')||[]).find(el=>el.dataset.rdSection===focus.section)?.querySelector('summary')?.focus({preventScroll:true});}
      if(focus&&!focus.materialTitle&&!focus.section){
        const selector=(focus.field?`[data-rd-field="${focus.field}"]`:`[data-rd-action="${focus.action}"]`)+`${focus.id?`[data-id="${focus.id}"]`:''}${focus.setting?`[data-setting="${focus.setting}"]`:''}${focus.mode?`[data-mode="${focus.mode}"]`:''}${focus.day?`[data-day="${focus.day}"]`:''}${focus.accent?`[data-accent="${focus.accent}"]`:''}${focus.tab?`[data-tab="${focus.tab}"]`:''}${focus.choice!=null?`[data-value=${JSON.stringify(String(focus.choice))}]`:''}${focus.entry!=null?`[data-entry=${JSON.stringify(String(focus.entry))}]`:''}`;
        const ownFocus=String(focus.field||focus.action||'').startsWith('hub-own-'),
          ownSuffix=ownFocus?`[data-course="${focus.course}"][data-place="${focus.place}"]${focus.file?`[data-file="${focus.file}"]`:''}`:'';
        const kept=focus.node,
          same=kept?.isConnected!==false&&
            !!kept?.getClientRects?.().length&&
            (focus.field?kept.dataset?.rdField===focus.field:kept.dataset?.rdAction===focus.action)&&
            [['id','id'],['setting','setting'],['mode','mode'],['day','day'],['accent','accent'],['tab','tab'],['value','choice'],['entry','entry'],['step','step'],['message','message'],['resource','resource'],['course','course'],['place','place'],['file','file']].every(([key,was])=>
              (kept.dataset?.[key]??null)===(focus[was]??null));
        const active=same?
          kept:
          ownFocus?
            container.querySelector(selector+ownSuffix):
            focus.step||focus.resource||focus.message?
              Array.from(container.querySelectorAll?.(selector)||[]).find(el=>
                focus.message?
                  el.dataset.message===focus.message:
                  focus.step?el.dataset.step===focus.step:el.dataset.resource===focus.resource&&el.dataset.course===focus.course):
              (matches=>matches.find(el=>el.getClientRects?.().length)||container.querySelector(selector))(Array.from(container.querySelectorAll?.(selector)||[]));
        if(active){
          if(focus.field==='new-step')active.value=focus.value;
          active.focus({preventScroll:true});
          if(typeof active.setSelectionRange==='function'&&focus.start!=null)active.setSelectionRange(focus.start,focus.end);
        }
        else if(focus.action==='arrange-menu')container.querySelector('.rd-toolbar [data-rd-action="arrange"]')?.focus({preventScroll:true});
      }
      const materialPage=container.querySelector('.rd-material-page');
      if(materialPage)materialPage.scrollTop=materials?.pageScroll(materialPage.dataset.materialCourse,materialPage.dataset.materialResource)||0;
      const requested=materials?.takeFocusRequest();let materialFocus;
      if(requested?.type==='title'||focus?.materialTitle)materialFocus=container.querySelector('#rd-material-title');
      // Teacher-material lists (Materials, the Course hub and its deck copy): a chapter link lands on its
      if(requested?.type==='resource')
        materialFocus=Array.from(container.querySelectorAll?.('[data-rd-action="material-read"]')||[]).find(el=>el.dataset.resource===requested.id&&el.dataset.course===requested.courseId)||
          container.querySelector('[data-rd-field="material-query"]');
      // chapter's head, "Show all" on the first item it revealed, "Show fewer" back on its own control.
      const hubRequest=hub?.takeFocusRequest?.(),list=['chapter','row','more'].includes(requested?.type)?requested:hubRequest;
      if(list?.type==='chapter')materialFocus=Array.from(container.querySelectorAll?.('.rd-chapter-head[data-chapter]')||[]).find(el=>el.dataset.chapter===list.id&&el.dataset.course===list.courseId);
      if(list?.type==='row')materialFocus=Array.from(container.querySelectorAll?.('[data-rd-row]')||[]).find(el=>el.dataset.rdRow===list.id)?.querySelector?.('.rd-row-open');
      if(list?.type==='more')
        materialFocus=Array.from(container.querySelectorAll?.(`[data-rd-action="${list.action}"]`)||[]).find(el=>(el.dataset.resource??el.dataset.entry)===list.id&&el.dataset.course===list.courseId);
      if(list?.type==='own')
        materialFocus=Array.from(container.querySelectorAll?.(list.field?`[data-rd-field="${list.field}"]`:`[data-rd-action="${list.action}"]`)||[]).find(el=>
          el.dataset.course===list.courseId&&el.dataset.place===list.place&&(!list.file||el.dataset.file===list.file));
      // The page glides to a chapter only for a pointer under Gentle motion; keyboard, Still, Off and reduced motion jump at once.
      if(materialFocus){materialFocus.focus({preventScroll:true});if(requested?.type==='title'&&root.innerWidth<=1200)materialFocus.scrollIntoView({block:'start',behavior:'instant'});
        if(list?.type==='chapter')
          materialFocus.scrollIntoView({
            block:'start',
            behavior:container.dataset.input==='pointer'&&container.dataset.motionStyle==='gentle'&&!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'smooth':'instant'
          });
        if(list?.type==='more')materialFocus.scrollIntoView({block:'nearest',behavior:'instant'});}
      // A render made while a room's move plays (the page swap of a room growing or folding) counts the move from its
      // own end: on a slow machine the swap alone outlasted the room's stamp, and the frame that drew it then measured
      // the tabs, the surfaces and the art film it was meant to leave for later.
      if(moving&&swapped){const t=Date.now()+400;if(!(Number(container.dataset.chMoving)>=t))container.dataset.chMoving=String(t);}
    }

    function updateStatus(){
      const text=statusLabel(currentSnapshot,externalStatus,transientStatus),line=container.querySelector('.rd-status [role="status"]');
      if(line&&line.textContent!==text){line.textContent=text;if(railStatusInline)queueRail();}
      const button=container.querySelector('[data-rd-action="refresh"]'),
        synced=/^Updated (.+)$/.exec(text),
        failed=/^Refresh failed/.test(text),
        title=refreshing?'Syncing with Canvas…':synced?'Synced with Canvas · '+synced[1]:failed?text+' · click to try again':text||'Refresh Canvas data';
      if(button){
        if(button.getAttribute('title')!==title)button.setAttribute('title',title);
        if(failed&&!refreshing){if(button.getAttribute('data-tone')!=='danger')button.setAttribute('data-tone','danger');}else if(button.hasAttribute('data-tone'))button.removeAttribute('data-tone');
      }
    }

    // On Home and the course pages the clock alone changes what is drawn only at known moments: an hour turning in the
    // account's zone or this computer's (the greeting, and every calendar day: Today, Tomorrow, the week, plans, "Updated
    // yesterday"), 24 hours before a due time (Due within 24 hours), just after it (Overdue, Up next, the clock's next
    // due), 14 days after it (the work leaves the list) and a minute before an "Updated" date. Between those moments the
    // minute tick only rewrites the status line: a whole render there froze the banner for 0.3-0.7 s every minute on a
    // real Canvas page (owner's Edge, 2026-10-28; perf loops-2). The clock's time and countdown keep their own 15 s tick
    // (widgets.js) and the focus clock its 1 s tick (syncFocus). No page goes longer than FRESH_MS without a whole render,
    // for anything these moments miss; the other workspaces (Materials' "Saved 5 min ago", the Planner's two-minute undo
    // list) render every minute as before.
    const FRESH_MS=600000;
    // Zones sit whole minutes from UTC, so a local hour turns when the local minute count reaches 60. A minute that
    // cannot be read counts as now: the next tick renders, as before.
    function hourAfter(at,minute){return Number.isInteger(minute)&&minute>=0&&minute<60?Math.floor(at/60000)*60000+(60-minute)*60000:at+1;}
    function timeBoundaryAfter(after){
      const s=settings();let next=after+FRESH_MS;
      const take=at=>{if(at>after&&at<next)next=at;};
      take(hourAfter(after,Number(formatDate(after,s.timeZone,{minute:'numeric'}))));take(hourAfter(after,new Date(after).getMinutes()));
      for(const item of normalizeData(s).items){
        const due=dateMs(item.dueAt),updated=dateMs(item.updatedAt);
        if(due!==null){take(due-DAY);take(due+1);take(due+14*DAY+1);}
        if(updated!==null)take(updated-60000);
      }
      return next;
    }
    // True while a whole render would draw this Home or course page just as it stands.
    function timeSettled(){
      if(workspace!=='work'||!renderedAt||rendering||sourceFrame)return false;
      const now=Date.now();
      // A clock set back, or a page left this long, renders.
      if(now<renderedAt||now-renderedAt>=FRESH_MS)return false;
      if(timeBoundary===null)timeBoundary=timeBoundaryAfter(renderedAt);
      return now<timeBoundary;
    }
    // A whole render once a minute never lands in a move or in a room: while a move plays (data-ch-moving), a room is up
    // (the Focus room, the Review deck's or Grade impact's page) it waits, and then it runs when the browser is idle.
    let freshWait=0;
    function updateFreshness(){
      // Calendar boundaries and countdowns advance while the page stays open.
      if(destroyed||document.visibilityState==='hidden'||!container.getClientRects?.().length||freshWait)return;
      if(timeSettled()){updateStatus();return;}
      const busy=()=>Number(container.dataset.chMoving||0)>Date.now()||!!container.dataset.chRoom||!!room||!!container.querySelector('.gi-room:not([data-gi-away]), [data-review-deck]');
      if(busy()||typeof root.requestIdleCallback==='function'){
        const go=()=>{
          freshWait=0;
          if(destroyed||document.visibilityState==='hidden')return;
          if(Number(container.dataset.chMoving||0)>Date.now()||container.dataset.chRoom){freshWait=root.setTimeout(()=>{freshWait=0;updateFreshness();},2000);return;}
          if(room){holdForRooms();return;}
          render();
        };
        freshWait=typeof root.requestIdleCallback==='function'?root.requestIdleCallback(go,{timeout:5000}):root.setTimeout(go,1000);return;
      }
      render();
    }

    // A planner focus session keeps counting on the Planner button. The toolbar
    // is never re-rendered, so only the clock's text changes each second; the
    // session ends here through the planner's own rule (ReserveCore.settleFocus).
    function syncFocus(){
      if(destroyed||!enabled('planner'))return;const f=personal.focus,now=Date.now(),running=!!f?.endsAt,note='Focus session complete. Take a moment to breathe.';
      if(!running&&focusDoneUntil&&now>=focusDoneUntil){focusDoneUntil=0;if(transientStatus===note){transientStatus='';render();return;}}
      const text=running?C.focusClock?.(f,now)||'':focusDoneUntil?'Done':'',clock=container.querySelector('[data-rd-focus-clock]');
      if(clock&&clock.textContent!==text){clock.textContent=text;clock.hidden=!text;clock.parentElement?.setAttribute('aria-label',running?'Planner, focus session running':'Planner');}
      if(running&&now>=f.endsAt&&!focusSettling&&C.settleFocus){
        // A session that ended long before this page opened is recorded quietly.
        focusSettling=true;let settled=false;const ended=f.endsAt;
        store.update(data=>{settled=C.settleFocus(data,Date.now());}).then(()=>{
          if(settled&&!destroyed&&Date.now()-ended<60000){board?.finished('focus');focusDoneUntil=Date.now()+8000;if(!transientStatus){transientStatus=note;render();}else syncFocus();}
        }).catch(()=>{}).finally(()=>{
          focusSettling=false;
        });
      }
      const ticking=running||!!focusDoneUntil;
      if(ticking&&!focusTimer)focusTimer=setInterval(syncFocus,1000);else if(!ticking&&focusTimer){clearInterval(focusTimer);focusTimer=0;}
    }

    async function runRefresh({reportError=false}={}){
      if(refreshing){if(reportError)throw Error('Canvas is already refreshing. Try again when it finishes.');return;}
      refreshing=true;
      transientStatus='Refreshing Canvas…';
      render();
      try{
        const result=await refresh();
        if(result&&Array.isArray(result.courses)&&Array.isArray(result.assignments)){currentSnapshot=result;normalizedCache=null;contentCache.clear();visitAgent();}
        transientStatus='';
      }catch(error){
        transientStatus=`Refresh failed${error?.message?`: ${error.message}`:''}`;
        if(reportError)throw error;
      }finally{
        refreshing=false;
        render();
      }
    }

    function fieldEnabled(target){
      const field=target?.dataset?.rdField,key=target?.dataset?.setting;
      if(container.dataset.chLinksPending&&(field?.startsWith('preferences-')||field?.startsWith('make-')))return false;
      if(field?.startsWith('hub-own-'))return !container.dataset.chLinksPending&&enabled('course-files')&&enabled('course-hub');
      if(field?.startsWith('make-'))return enabled('customization');
      if(field==='legacy-image')return !container.dataset.chLinksPending&&enabled('customization')&&enabled('course-art');
      if(field==='setting'){if(key==='showGrades')return enabled('grades');if(!enabled('customization'))return false;
        const feature={
          sceneTheme:'scene-themes',
          motion:'motion',
          livingArt:'motion',
          nightArt:'course-art',
          bannerSize:'course-art',
          showCourseIcons:'course-art',
          courseCardStyle:'course-art',
          showCourseInformation:'course-hub',
          showRecentGrades:'grades',
          deskOrder:'arrange',
          dashboardLayout:'arrange',
          courseNavigation:'arrange',
          dockSize:'arrange'
        }[key];
        return !feature||enabled(feature);
      }
      if(field?.startsWith('quick-pack-'))return enabled('customization')&&enabled('course-art')&&enabled('quick-pack');
      if(field?.startsWith('kit-')||field?.startsWith('art-')||field==='customize-course')return enabled('customization')&&enabled('course-art');
      if(field==='pet')return enabled('customization')&&enabled('pony');
      if(['course-name','course-color','course-visible'].includes(field))return enabled('customization');
      if(field==='canvas-nav')return enabled('customization')&&enabled('canvas-nav');
      if(field?.startsWith('hub-'))return enabled('course-hub');
      if(field?.startsWith('material-'))return enabled('materials');
      if(field==='grade-query')return enabled('grades');
      return true;
    }
    function onInput(event){
      if(!fieldEnabled(event.target))return;
      if(event.target?.dataset?.setting==='nightArt'){
        applyNight(event.target.value);
        const out=event.target.closest?.('.cz-night')?.querySelector('output');
        if(out)out.textContent=event.target.value+'%';
        return;
      }
      const field=event.target?.dataset?.rdField;
      if(field==='hub-own-files')return;
      if(field==='make-week'){makeOwn?.week(event.target.value);return;}
      if(board?.input(event))return;
      if(field?.startsWith('review-deck-')){reviewDeck?.input(event);return;}
      if(field==='quick-pack-source'){quickPackDraft=event.target.value.slice(0,3145728);quickPackFileName='';quickPackError='';return;}
      if(field==='kit-name'){kitName=event.target.value.slice(0,40);return;}
      if(field==='art-source'){
        const {course,kind}=event.target.dataset;
        if(validArtTarget(course)&&['banner','card','background','icon','border','title'].includes(kind))customizeDrafts[course+':'+kind]=event.target.value.slice(0,262144);
        return;
      }
      if(field?.startsWith('hub-')){hub?.input(field,field==='hub-unread'?event.target.checked:event.target.value,event.target.dataset);return;}
      if(field?.startsWith('material-')){materials?.input(field,event.target.value);return;}
      if(field==='new-step'&&/^(?:\d+|local-[\w-]+)$/.test(event.target.dataset.id||'')){stepDrafts.set(event.target.dataset.id,event.target.value.slice(0,300));return;}
      // A search keeps its query at once and draws the list before the next paint (focus and caret are restored then),
      // so keys that queued behind a long render share one render instead of one each (perf interaction-3).
      if(field==='overview-query'){overviewQuery=event.target.value.slice(0,200);scheduleRender();return;}
      if(field==='grade-query'){gradeQuery=event.target.value.slice(0,200);gradeLimit=40;scheduleRender();return;}
      if(field!=='query'){
        if(stageDraft(event.target)){
          if(field==='notes'){const label=container.querySelector('[data-rd-note-status]');if(label)label.textContent='Saving note…';}
          clearTimeout(draftTimer);
          draftTimer=setTimeout(flushDrafts,350);
        }
        return;
      }
      readerOpen=false;state.query=event.target.value.slice(0,200);
      visibleLimit=60;
      scheduleRender({preserveFocus:true});
    }

    function onChange(event){
      if(!fieldEnabled(event.target))return;
      const field=event.target?.dataset?.rdField;
      if(field==='preferences-backup'){const file=event.target.files?.[0];event.target.value='';void preferences?.change(file);return;}
      if(field==='preferences-timezone'){void preferences?.setting('timeZone',event.target.value);return;}
      if(field==='hub-own-files'){const files=Array.from(event.target.files||[]);event.target.value='';void hub?.input(field,files,event.target.dataset);return;}
      if(field==='make-file'){const file=event.target.files?.[0];event.target.value='';void makeOwn?.choose(file);return;}
      if(field==='make-week'){makeOwn?.week(event.target.value);return;}
      if(field==='legacy-image'){const file=event.target.files?.[0];event.target.value='';void replaceLegacyImage(event.target.dataset.id,file);return;}
      if(['make-color','make-part','make-motion','make-pose'].includes(field)){
        const node=event.target,
          patch=field==='make-color'?
            {colors:{[node.dataset.mode]:{[node.dataset.color]:node.value}}}:
            field==='make-part'?
              {
                parts:{
                  [node.dataset.part]:node.checked,
                  ...(node.dataset.part==='frames'?{panel:node.checked,card:node.checked}:['panel','card'].includes(node.dataset.part)&&node.checked?{frames:true}:{})
                }
              }:
              field==='make-pose'?{poses:{[node.dataset.pose]:node.checked}}:{motion:node.value},
          id=node.dataset.id;
        makeWrites=makeWrites.catch(()=>{}).then(()=>makeOwn?.action('adjust',id,{patch}));return;
      }
      if(field==='pet'&&event.target.dataset.key==='name'){const value=event.target.value;void savePersonal(data=>{data.pet.name=value;},'name');return;}
      if((field==='pet'||field==='pet-skill')&&(!board||!enabled('planner'))){
        const key=event.target.dataset.key,value=event.target.type==='checkbox'?event.target.checked:event.target.value;
        if(field==='pet-skill'&&Object.hasOwn(root.ReservePonyBrain?.SKILLS||{},key))void savePersonal(data=>{data.pet.skills={...data.pet.skills,[key]:value===true};});
        else if(['enabled','name','knowledge','size','roam','nudges','coat','harness','gear'].includes(key))void savePersonal(data=>{data.pet[key]=value;});return;
      }
      if(board?.change(event))return;
      if(field?.startsWith('review-deck-')){reviewDeck?.change(event);return;}
      const id=event.target?.dataset?.id;
      if(/^local-[\w-]+$/.test(id||'')&&['progress','check-step','personal-name','personal-due','planned-date','estimate','notes'].includes(field)){selectedId=id;readerOpen=true;}
      if(field?.startsWith('hub-')){hub?.input(field,field==='hub-unread'?event.target.checked:event.target.value,event.target.dataset);return;}
      if(field?.startsWith('material-')){materials?.input(field,event.target.value);return;}
      if(field==='customize-course'){
        if(!validArtTarget(event.target.value))return;
        customizeCourseId=event.target.value;customizeStatus='';render();return;
      }
      if(field==='quick-pack-file'){void uploadQuickPack(event.target.files?.[0]);return;}
      if(field==='quick-pack-course'){try{quickUpload?.choose(event.target.dataset.group,event.target.value||null);}catch(error){quickPackError=error.message;render();}return;}
      if(field==='quick-pack-group'){quickUpload?.includeGroup(event.target.dataset.group,event.target.checked);return;}
      if(field==='quick-pack-part'){quickUpload?.includePart(Number(event.target.dataset.index),event.target.checked);return;}
      if(field==='kit-import'){void runKit('kit-import',event.target);return;}
      if(field==='art-upload'){void uploadArtwork(event.target);return;}
      if(field==='art-setting'){
        const key=event.target.dataset.setting,value=event.target.value;
        if(['bannerFit','bannerPosition','titlePlacement'].includes(key)&&validArtTarget(id))savePersonal(data=>{appearanceFor(data,id)[key]=value;});
        // A course's drawing (course-art.js choices); Automatic ('') goes back to the one its name picks.
        else if(key==='subjectArt'&&id!=='all'&&id!=='theme'&&validArtTarget(id)&&(value===''||root.ReserveCourseArt?.choices?.().some(x=>x.id===value)))
          savePersonal(data=>{const pref=appearanceFor(data,id);if(value)pref.subjectArt=value;else delete pref.subjectArt;});
        return;
      }
      // Canvas's menu bar is stored where canvas-nav.js and the popup read it; every open Canvas page follows at once.
      if(field==='canvas-nav'){
        const value=event.target.value;
        if(!NAV_CHOICES.includes(value))return;
        canvasNav=value;
        root.chrome?.storage?.local?.set?.({'reserve:canvasNav':value})?.catch?.(()=>{});
        return;
      }
      if(field==='setting'){
        const key=event.target.dataset.setting;
        if(![
          'theme',
          'accent',
          'motion',
          'livingArt',
          'readingFont',
          'greeting',
          'font',
          'density',
          'textSize',
          'dashboardLayout',
          'showCourseStrip',
          'showGrades',
          'showRecentGrades',
          ...Object.keys(root.ReserveCustomization?.defaults||{})
        ].includes(key))
          return;
        const value=event.target.dataset.onoff==='true'?
          (event.target.checked?'on':'off'):
          event.target.type==='checkbox'?
            event.target.checked:
            key==='nightArt'?
              Math.max(0,Math.min(100,Math.round(Number(event.target.value)||0))):
              key==='dockScale'?Math.max(.7,Math.min(1.5,Math.round((Number(event.target.value)||1)*100)/100)):event.target.value;
        void saveAppearance(key,value);return;
      }
      if(/^(?:\d+|local-[\w-]+)$/.test(id||'')){
        if(['course-name','planned-date','estimate','notes','personal-name','personal-due'].includes(field)){const draft=stageDraft(event.target);if(draft)persistDraft(draft);return;}
        if(field==='course-color'&&/^\d+$/.test(id)){
          const value=event.target.value;
          savePersonal(data=>{const prefs=data.settings.coursePrefs||(data.settings.coursePrefs={});prefs[id]={...prefs[id],color:value};});
          return;
        }
        if(field==='course-visible'&&/^\d+$/.test(id)){const checked=event.target.checked;savePersonal(data=>{C.setCourseVisible(data.settings,id,checked);});return;}
        if(['progress','check-step'].includes(field)){
          const value=event.target.value,checked=event.target.checked,step=event.target.dataset.step;
          savePersonal(data=>{
            const task=data.tasks[id]||(data.tasks[id]={});
            if(field==='progress'){task.progress=value;if(value!=='done')task.checkedOff=false;}
            if(field==='check-step'){const entry=task.checklist?.find(x=>x.id===step);if(entry)entry.done=checked;}
          });
          return;
        }
      }
      // A pointer-chosen course (heading select, rail hidden) reads its snapshot before the switch.
      const snapshot=field==='course'&&container.dataset.input==='pointer'?motion?.snapshot?.(event.target)||null:null;
      if(field==='course'){switchCourse(event.target.value);if(workspace==='inbox')hub?.setCourse?.(state.courseId);}
      if(field==='mode'){readerOpen=false;state.mode=event.target.value;state.day='';visibleLimit=60;}
      // Keyboard select changes stay immediate.
      if(field==='course'||field==='mode'){
        render(snapshot?{tabMotion:true,motionTarget:'.rd-workspace',motionKind:'course',snapshot}:{});
        if(field==='course'){materials?.activate(state.courseId);if(workspace==='materials')materials?.load(state.courseId);if(workspace==='hub')hub?.loadCourse(state.courseId);}
      }
    }

    // when Tab was last pressed (onKeydown): a focus loss right after it is the student tabbing on
    let tabAt=0;
    function onFocusout(event){
      // Some input methods report input and blur without a change event.
      if(['course-name','estimate','planned-date','notes','personal-name','personal-due'].includes(event.target?.dataset?.rdField))onChange(event);
      // Phones: Tab or Shift+Tab out of the open drawer closes it (it is non-modal), so focus never sits
      onHeaderFocusout(event);
      // under its scrim. Only a real destination counts: a lost window focus (no relatedTarget) keeps it open.
      const next=event.relatedTarget;
      // The reader sheet makes the Canvas Harness parts it covers inert, but Tab past its last control leaves Canvas Harness for the
      if(next&&drawerOpen()&&event.target?.closest?.('.rd-course-rail')&&!container.querySelector('.rd-shell .rd-course-rail')?.contains?.(next)&&!next.closest?.('.rd-drawer-button'))
        setDrawer(false,{focus:false});
      // page around it (Canvas's own links, which the sheet may cover) or for the browser: that closes the sheet, and
      // focus stays where Tab put it. Without a destination only a Tab counts (a lost window focus keeps it open).
      else if(readerOpen&&workspace==='work'&&phone()&&event.target?.closest?.('.rd-reader')&&(next?!container.contains?.(next):Date.now()-tabAt<400)){
        readerOpen=false;
        render({preserveFocus:false});
      }
    }

    function stageDraft(target){
      const field=target?.dataset?.rdField,id=target?.dataset?.id;
      if(!['course-name','planned-date','estimate','notes','personal-name','personal-due'].includes(field)||!/^(?:\d+|local-[\w-]+)$/.test(id||''))return null;
      if(field==='course-name'&&!/^\d+$/.test(id))return null;
      if(field.startsWith('personal-')&&!personal.customTasks?.some(x=>x.id===id))return null;
      const value=String(target.value||'').slice(0,field==='notes'?20000:field==='course-name'?100:field==='personal-name'?200:30),key=`${field}:${id}`,previous=drafts.get(key);
      if(previous?.value===value)return previous;
      const task=personal.tasks?.[id]||{},
        reminder=personal.customTasks?.find(x=>x.id===id),
        current=field==='personal-name'?
          reminder?.name:
          field==='personal-due'?reminder?.dueAt:field==='course-name'?personal.settings?.coursePrefs?.[id]?.name:field==='planned-date'?task.plannedDate:field==='notes'?task.notes:task.estimate;
      let unchanged=field==='estimate'?(current||0)===Math.min(1440,Math.max(0,Number(value)||0)):(current||'')===value;
      if(field==='personal-due'){try{unchanged=(current||null)===(value?U.wallTimeToISO(value,settings().timeZone||'America/New_York'):null);}catch{unchanged=false;}}
      if(!previous&&unchanged)return null;
      const draft={field,id,value,key,pending:null};drafts.set(key,draft);return draft;
    }

    function persistDraft(draft){
      if(draft.pending)return draft.pending;
      const {field,id,value}=draft;
      draft.pending=savePersonal(data=>{
        if(field==='personal-name'||field==='personal-due'){
          const reminder=data.customTasks.find(x=>x.id===id);
          if(!reminder)throw Error('This reminder is no longer available.');
          if(field==='personal-name'){if(!value.trim())throw Error('Give the reminder a title.');reminder.name=value.trim();}
          else reminder.dueAt=value?U.wallTimeToISO(value,settings().timeZone||'America/New_York'):null;
          return;
        }
        if(field==='course-name'){const prefs=data.settings.coursePrefs||(data.settings.coursePrefs={});prefs[id]={...prefs[id],name:value};return;}
        const task=data.tasks[id]||(data.tasks[id]={});
        if(field==='planned-date')task.plannedDate=value;
        if(field==='estimate')task.estimate=Math.min(1440,Math.max(0,Number(value)||0));
        if(field==='notes')task.notes=value;
      }).then(saved=>{
        draft.pending=null;
        if(saved&&drafts.get(draft.key)===draft)drafts.delete(draft.key);
        if(saved&&!drafts.size&&transientStatus.startsWith('Could not save:'))transientStatus='';
        render();return saved;
      });
      return draft.pending;
    }

    function flushDrafts(){clearTimeout(draftTimer);return Promise.all([...drafts.values()].map(persistDraft));}

    async function addStep(id){
      if(!/^(?:\d+|local-[\w-]+)$/.test(id||''))return;
      const input=container.querySelector(`[data-rd-field="new-step"][data-id="${id}"]`),text=input?.value.trim().slice(0,300);
      if(!text)return;
      stepDrafts.set(id,input.value);
      if((personal.tasks?.[id]?.checklist?.length||0)>=100){transientStatus='This plan already has 100 steps.';render();return;}
      const saved=await savePersonal(data=>{
        const task=data.tasks[id]||(data.tasks[id]={});
        const steps=task.checklist||(task.checklist=[]);
        steps.push({id:root.crypto?.randomUUID?.()||`step-${Date.now()}-${steps.length}`,text,done:false});
      });
      const next=container.querySelector(`[data-rd-field="new-step"][data-id="${id}"]`);if(saved){stepDrafts.delete(id);if(next){next.value='';next.focus();}}
    }

    function showPreview(id,event,snapshot=null){
      const ctx=buildContext(),item=ctx.items.find(x=>x.id===String(id));
      if(!item)return;
      if(selectedId===String(id)&&readerOpen&&container.dataset.workspace==='work')return;
      if(!ctx.filtered.items.some(x=>x.id===item.id)){
        state.query='';
        state.day='';
        state.mode=C.isWorkComplete(item,personal.tasks?.[item.id])?
          'completed':
          item.personal&&personal.tasks?.[item.id]?.plannedDate===dayKey(Date.now(),settings().timeZone)?'planned':item.dueAt?'dated':'undated';
      }
      selectedId=String(id);readerOpen=true;readerTab=item.personal?'plan':'details';
      render({tabMotion:event.detail>0,motionTarget:'.rd-reader-content',motionKind:'reader',snapshot});
      // A desktop preview stays beside the list. Only reveal an offscreen pane.
      const panel=container.querySelector('.rd-reader'),rect=panel?.getBoundingClientRect?.();
      if(rect&&(rect.top<0||rect.top>root.innerHeight-100))panel.scrollIntoView({block:'start',behavior:'instant'});
      if(!event.detail)container.querySelector('#rd-reader-title')?.focus({preventScroll:true});
    }

    function toggleSelection(id){
      if(archiving)return;
      if(selectionIds.has(id))selectionIds.delete(id);
      else if(selectionIds.size<30)selectionIds.add(id);
      else {transientStatus='Select up to 30 items at a time.';}
      render();toolbox?.update();
    }
    async function archiveSelection(undo=false){
      if(archiving)return;const ctx=buildContext();
      const chosen=undo?archiveUndo:ctx.items.filter(x=>selectionIds.has('assignment:'+x.courseId+':'+x.id)).map(x=>({id:x.id,key:'assignment:'+x.courseId+':'+x.id,previous:undefined}));
      if(!chosen?.length)return;archiving=true;render();
      const saved=await savePersonal(data=>{
        for(const x of chosen){
          const task={...data.tasks[x.id]};
          if(!undo)x.previous=task.checkedOff;
          if(undo&&x.previous===undefined)delete task.checkedOff;else task.checkedOff=undo?x.previous:true;
          data.tasks[x.id]=task;
        }
      });
      archiving=false;if(!saved||destroyed){render();return;}
      if(undo)archiveUndo=null;else {archiveUndo=chosen;for(const x of chosen)selectionIds.delete(x.key);}
      render();toolbox?.update();
    }
    async function checkOff(id,done,event,snapshot=null){
      const item=buildContext().items.find(item=>item.id===id);
      if(!item||checkingOff.has(id))return;
      // A pointer check-off that removes the row plays its exit first, because
      checkingOff.add(id);checkOffNotice=null;
      // the store update re-renders the list synchronously.
      const ctx=buildContext();
      const leaves=done&&
        !Model.filterAssignments(ctx.items,{...state,now:ctx.now,timeZone:ctx.s.timeZone,local:{...ctx.local,[id]:{...ctx.local[id],checkedOff:true}}}).items.some(x=>
          x.id===id);
      // The row that slides up under a resting cursor must not show a hover tick it never earned.
      const exit=leaves&&event.detail>0&&container.dataset.input==='pointer'?motion?.leave?.(container.querySelector(`.rd-assignment[data-preview-id="${id}"]`)):null;
      if(exit)container.dataset.hoverHold='true';
      if(exit)await exit.finished;
      const saved=await savePersonal(data=>{data.tasks[id]={...data.tasks[id],checkedOff:done};});
      checkingOff.delete(id);
      if(!saved||destroyed){exit?.cancel();return;}
      checkOffNotice=done?{id,name:item.name}:null;
      // A departed row already closed its gap; a row that stays or returns
      if(done)board?.finished('done',id);
      // gets a short entrance of its own instead of replaying the whole list.
      render(exit?{}:{tabMotion:event.detail>0,motionTarget:`.rd-assignment[data-preview-id="${id}"]`,motionKind:'filter',snapshot});
      exit?.cancel();
      const next=done?container.querySelector('[data-rd-action="undo-check-off"][data-id="'+id+'"]'):container.querySelector('[data-rd-action="check-off"][data-id="'+id+'"]');
      if(!event.detail)next?.focus({preventScroll:true});
    }

    // The phone drawer (refresh.css section 16): the course rail slides in over a scrim. It is
    // non-modal; Esc, the scrim, its close button and any pick close it. Focus moves into it
    // on open and back to its trigger on close.
    const phone=()=>!!root.matchMedia?.('(max-width: 600px)')?.matches;
    const drawerOpen=()=>container.dataset.drawer==='open'&&phone();
    function setDrawer(open,{focus=true}={}){
      const trigger=container.querySelector('.rd-drawer-button'),within=container.querySelector('.rd-shell .rd-course-rail')?.contains?.(container.getRootNode?.()?.activeElement);
      if(open)container.dataset.drawer='open';else delete container.dataset.drawer;
      // Like the Tools dock, the open drawer lifts the host's paint isolation so it covers Canvas's own chrome.
      trigger?.setAttribute('aria-expanded',String(open));queueRail();
      container.getRootNode?.()?.host?.toggleAttribute?.('data-reserve-drawer',open);
      if(focus&&open)container.querySelector('.rd-drawer-close')?.focus({preventScroll:true});
      else if(focus&&(within||!container.contains?.(container.getRootNode?.()?.activeElement)))trigger?.focus({preventScroll:true});
    }
    // Back to the list: on a phone this closes the reader sheet; focus returns to the row it came from.
    // Scrolled past: on desktop the workspace column scrolls by itself (the page does not: refresh.css), so a heading
    // is out of sight once it is above the column's top; on phones, above the window's.
    function above(rect){
      const column=container.querySelector('.rd-shell > .rd-workspace'),scrolls=!!column&&column.scrollHeight>column.clientHeight+1;
      return rect.top<(scrolls?column.getBoundingClientRect().top:0)-1;
    }
    function closePreview(){
      readerOpen=false;
      render();
      const previous=container.querySelector(`[data-rd-action="preview"][data-id="${selectedId}"]`);
      previous?.scrollIntoView({block:'nearest',behavior:'instant'});
      previous?.focus({preventScroll:true});
    }

    function actionEnabled(action,button){
      if(container.dataset.chLinksPending&&(action?.startsWith('preferences-')||action?.startsWith('make-')))return false;
      if(action?.startsWith('hub-own-'))return !container.dataset.chLinksPending&&enabled('course-files')&&enabled('course-hub');
      if(action?.startsWith('make-'))return enabled('customization');
      const feature={
        'deadline-changes':'deadline-changes',
        planner:'planner',
        grades:'grades',
        'more-grades':'grades',
        'grades-visibility':'grades',
        'hidden-courses':'customization',
        accent:'customization',
        theme:'customization',
        'course-up':'customization',
        'course-down':'customization',
        'layout-preset':'arrange',
        'layout-reset':'arrange',
        toolbox:'tools',
        capture:'tools',
        'selection-ai':'ai',
        'select-source':'ai',
        'open-hub':'course-hub',
        'open-materials':'materials'
      }[action];
      if(feature&&!enabled(feature))return false;
      if(action==='customize-tab')return ['features','settings'].includes(button?.dataset.value)||enabled('customization')&&(root.ReserveCustomizeUI?.tabs()||[]).some(([key])=>key===button?.dataset.value);
      if(action?.startsWith('layout-'))return enabled('customization')&&enabled('arrange');
      if(action?.includes('capture')&&!enabled('tools'))return false;
      if(['selection-ai','capture','toolbox'].includes(action)&&!enabled('tools'))return false;
      if(action?.startsWith('quick-pack-'))return enabled('customization')&&enabled('course-art')&&enabled('quick-pack');
      if(action?.startsWith('kit-')||action?.startsWith('art-')||action==='course-reset')return enabled('customization')&&enabled('course-art')&&!!root.ReserveCustomArt;
      if(action?.startsWith('hub-'))return enabled('course-hub');
      if(action?.startsWith('material-'))return enabled('materials');
      if(action?.startsWith('arrange-'))return enabled('arrange');
      if(action==='open-aid')return enabled('ai')&&enabled('tools');
      if(action==='workspace'||action==='course-section')return workspaceEnabled(button.dataset.tab);
      return true;
    }
    function onClick(event){
      const candidate=event.target.closest?.('[data-rd-action]');
      if(candidate&&!actionEnabled(candidate.dataset.rdAction,candidate))return;
      if(candidate?.dataset.rdAction?.startsWith('preferences-')){void preferences?.action(candidate.dataset.rdAction.slice(12));return;}
      if(candidate?.dataset.rdAction==='customize-tab'){
        customizeTab=candidate.dataset.value||'layout';
        if(!renderPanel())render();
        container.querySelector('.cz-tab[aria-selected="true"]')?.focus({preventScroll:true});
        return;
      }
      if(candidate?.dataset.rdAction==='hidden-courses')customizeTab='courses';
      if(arrange?.click(event))return;
      if(board?.click(event))return;
      // FIRST for pointer motion: a read-only snapshot of what is painted, taken
      const button=event.target.closest?.('[data-rd-action]');
      // before any state changes and handed to render. Keyboard clicks (detail 0) take none.
      // Phones: the rail is a drawer. A click outside it (on the scrim) only closes it; a pick
      const take=()=>event.detail>0?motion?.snapshot?.(event.target)||null:null;
      // inside closes it too and hands focus back to its trigger, never to a hidden tab.
      if(drawerOpen()){
        const inside=event.target.closest?.('.rd-course-rail');
        if(!inside&&!event.target.closest?.('.rd-drawer-button')){setDrawer(false);return;}
        if(inside&&['course','workspace','planner'].includes(button?.dataset?.rdAction)){
          setDrawer(false,{focus:false});
          Promise.resolve().then(()=>{if(!destroyed&&button.dataset.rdAction!=='planner')container.querySelector('.rd-drawer-button')?.focus({preventScroll:true});});
        }
      }
      if(!button){
        const row=event.target.closest?.('[data-preview-id]');
        if(row&&!event.target.closest?.('a,button,input,select,textarea,label,summary')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&!(event.button>0)&&!root.getSelection?.()?.toString())
          showPreview(row.dataset.previewId,event,take());
        return;
      }
      // Busy controls use aria-disabled so they keep keyboard focus while loading.
      if(!button||button.disabled||button.getAttribute?.('aria-disabled')==='true')return;
      // (the Review tab opens a room over the page: no page motion, so no snapshot of the page to read)
      const action=button.dataset.rdAction,snapshot=MOTION_ACTIONS.has(action)&&!room&&!(action==='workspace'&&button.dataset.tab==='review')?take():null;
      // a way to another page from outside a room closes the room first
      if(room&&!room.layer.contains(button)&&['open-materials','open-hub','overview-all','grades','preview','course-section','native'].includes(action))dropRoom();
      if(arrange?.action(button))return;
      if(action==='drawer'){setDrawer(!button.dataset.close&&container.dataset.drawer!=='open');return;}
      // Grades' inline "Show grades" runs the same path as the toolbar switch.
      if(action==='grades-visibility'){
        const value=settings().showGrades!==true,version=++gradeSaveVersion;
        gradeVisibilityOverride=value;
        motion?.cancel();
        render();
        savePersonal(data=>{data.settings.showGrades=value;}).then(saved=>{if(version===gradeSaveVersion){if(saved)gradeVisibilityOverride=null;render();}});
        return;
      }
      if(handleCustomizeAction(action,button))return;
      if(action.startsWith('review-deck-')){void reviewDeck?.action(action,button.dataset);return;}
      if(action.startsWith('hub-')){hub?.handle(action,button.dataset);return;}
      if(action.startsWith('material-')){materials?.handle(action,button.dataset);return;}
      if(action==='select-item'){const item=buildContext().items.find(x=>x.id===String(button.dataset.id));if(item)toggleSelection('assignment:'+item.courseId+':'+item.id);return;}
      if(action==='select-source'){const id=button.dataset.source;if(typeof id==='string'&&/^(?:assignment|page|file|home|syllabus|announcement):/.test(id))toggleSelection(id);return;}
      if(action==='selection-clear'){selectionIds.clear();render();toolbox?.update();return;}
      if(action==='selection-ai'){toolbox?.open('ai',button);return;}
      if(action==='deadline-changes'){deadlineChanges?.open(button);return;}
      if(action==='help-this'){helpWithItem({itemId:button.dataset.id,page:readerTab==='plan'?'notes':'assignment',selectedText:root.getSelection?.()?.toString()||''});return;}
      if(action==='open-aid'){toolbox?.openAid(button.dataset.aidKey);return;}
      if(action==='selection-archive'||action==='selection-undo'){void archiveSelection(action==='selection-undo');return;}
      if(action==='check-off'||action==='undo-check-off'){checkOff(String(button.dataset.id),action==='check-off',event,snapshot);return;}
      if(action==='overview-view'){
        overviewMode=button.dataset.mode==='completed'?'completed':'actionable';
        render({tabMotion:event.detail>0,motionTarget:'.rd-overview-work',motionKind:'filter',snapshot});
        return;
      }
      if(action==='overview-all'){
        captureCourseView();
        switchCourse('all');
        workspace='work';
        state.mode=overviewMode;
        state.query=overviewQuery;
        state.day='';
        readerOpen=false;
        render({tabMotion:event.detail>0,motionTarget:'.rd-workspace',snapshot});
        return;
      }
      if(action==='course-section'){
        const id=String(button.dataset.id),next=button.dataset.tab;
        if(!normalizeData(settings()).courses.some(course=>course.id===id)||!['work','hub','materials','inbox'].includes(next))return;
        captureCourseView();switchCourse(id);workspace=next;
        if(next==='work'){state.query='';state.mode='actionable';state.day='';readerOpen=false;}
        materials?.activate(id);
        if(next==='inbox')hub?.setCourse?.(id);
        render({tabMotion:event.detail>0,motionTarget:'.rd-workspace',snapshot});
        if(next==='hub')hub?.loadCourse(id);if(next==='materials')materials?.load(id);if(next==='inbox')hub?.loadInbox();
        container.querySelector('.rd-workspace-tab[aria-selected="true"]')?.focus({preventScroll:true});
        const heading=container.querySelector('.rd-page-heading, .rd-workspace-heading'),rect=heading?.getBoundingClientRect?.();
        if(rect&&(above(rect)||rect.top>root.innerHeight-100))heading.scrollIntoView({block:'start',behavior:'instant'});
        return;
      }
      if(action==='workspace'||action==='open-materials'||action==='open-hub'){selectWorkspace(action,button,event,snapshot);return;}
      if(action==='capture'){toolbox?.open('plan',button);return;}
      if(action==='toolbox'){toolbox?.open(undefined,button);return;}
      if(action==='native'){if(drawerOpen())setDrawer(false,{focus:false});onNative?.();return;}
      if(action==='retry-save'){flushDrafts();return;}
      if(action==='add-step'){addStep(button.dataset.id);return;}
      if(action==='remove-step'){
        const id=button.dataset.id,step=button.dataset.step;
        if(/^(?:\d+|local-[\w-]+)$/.test(id||''))savePersonal(data=>{const task=data.tasks[id];if(task)task.checklist=(task.checklist||[]).filter(x=>x.id!==step);});
        return;
      }
      if(action==='planner'){openPlanner({page:'week'});return;}
      if(action==='settings'){settingsDock?.toggle(button);return;}
      if(action==='settings-close'){settingsDock?.close();return;}
      // The rail's "2 hidden": Make it yours opens at "Course names, colors & visibility", where a hidden course can be shown again.
      if(action==='hidden-courses'){
        if(drawerOpen())setDrawer(false,{focus:false});
        settingsDock?.open(button);
        const section=Array.from(container.querySelectorAll?.('details[data-rd-section]')||[]).find(el=>el.dataset?.rdSection==='courses');
        if(section){section.open=true;section.querySelector?.('summary')?.focus?.();section.scrollIntoView?.({block:'nearest'});}
        return;
      }
       if(action==='accent'){const accent=button.dataset.accent;if(Object.hasOwn(ACCENTS,accent)||/^#[\da-f]{6}$/i.test(accent))void saveAppearance('accent',accent);return;}
      if(action==='grades'){workspace='grades';render({tabMotion:event.detail>0,motionTarget:'.rd-workspace',snapshot});return;}
      if(action==='more-grades'){gradeLimit+=40;render();return;}
      if(action==='course'){
        if(room?.kind==='impact'&&room.layer.contains(button)){
          dropRoom();
          savedWorkspace=null;
          captureCourseView();
          workspace='grades';
          switchCourse(String(button.dataset.id||'all'));
          render({motionTarget:'.rd-workspace',resetWorkspaceScroll:true});
          return;
        }
        selectDashboardCourse(button.dataset.id,event,snapshot);
        return;
      }
      if(action==='reader-tab'){
        const next=button.dataset.tab==='plan'?'plan':'details';
        if(readerTab===next)return;
        readerTab=next;
        render({tabMotion:event.detail>0,motionTarget:'.rd-reader-body',motionKind:'section',direction:next==='plan'?1:-1,snapshot});
        return;
      }
      if(action==='preview'){
        if(workspace==='home'){captureCourseView();switchCourse('all');workspace='work';}showPreview(button.dataset.id,event,snapshot);return;
      }
      if(action==='close-preview'){closePreview();return;}
      if(action==='schedule'){
        const id=button.dataset.id,day=button.dataset.day;if(!/^(?:\d+|local-[\w-]+)$/.test(id||''))return;
        if(day&&Model.cleanState({day}).day!==day)return;
        savePersonal(data=>{data.tasks[id]={...data.tasks[id],plannedDate:day};});return;
      }
      if(action==='plan'){openPlanner({page:'assignments',id:String(button.dataset.id)});return;}
      if(action==='refresh'){runRefresh();return;}
      if(action==='theme'){
        const theme='light';
        savePersonal(data=>{data.settings.theme=theme;});return;
      }
      if(action==='bookmark-remove-resource'){
        const id=String(button.dataset.id),courseId=String(button.dataset.course);
        if(!buildContext().courses.some(course=>String(course.id)===courseId))return;
        savePersonal(data=>{data.resourcePins=(data.resourcePins||[]).filter(item=>!(String(item.id)===id&&String(item.courseId)===courseId));});return;
      }
      if(action==='pin'){
        const id=String(button.dataset.id);
        if(!/^(?:\d+|local-[\w-]+)$/.test(id))return;
        void bookmarkItem(id);return;
      }
      if(action==='reset'){
        captureCourseView();
        state=Model.cleanState({});
        selectedId=null;
        readerTab='details';
        readerOpen=false;
        pendingReaderScroll=null;
        visibleLimit=60;
        render();
        return;
      }
      if(action==='glance'){
        // A summary chip filters to its view; choosing it again returns to Up next.
        const mode=['overdue','today','tomorrow'].includes(button.dataset.mode)?button.dataset.mode:'actionable';
        const fromOtherWorkspace=workspace!=='work';
        if(fromOtherWorkspace){captureCourseView();workspace='work';workPage='assignments';board?.close();}
        readerOpen=false;state.mode=!fromOtherWorkspace&&state.mode===mode&&!state.day?'actionable':mode;state.day='';visibleLimit=60;
        render({tabMotion:event.detail>0,motionTarget:fromOtherWorkspace?'.rd-workspace':'.rd-work',motionKind:fromOtherWorkspace?'workspace':'filter',snapshot,resetWorkspaceScroll:fromOtherWorkspace});
        return;
      }
      if(action==='view'||action==='day'){readerOpen=false;
        if(action==='view'&&state.mode===button.dataset.mode&&!state.day)return;
        state.day=action==='day'?(state.day===button.dataset.day?'':button.dataset.day):'';
        state.mode=action==='view'?button.dataset.mode:'actionable';visibleLimit=60;render({tabMotion:event.detail>0,motionTarget:'.rd-work',motionKind:'filter',snapshot});
        return;
      }
      if(action==='show-dated'){state.mode='dated';state.day='';visibleLimit=60;render();return;}
      if(action==='more'){visibleLimit+=60;render();}
    }

    // Personal appearance lives in the existing account-scoped store and shares
    // the private dock. Legacy course names, colors, images and art stay intact.
    function validArtTarget(id){return id==='all'||id==='theme'||/^\d+$/.test(id||'')&&normalizeData(settings()).allCourses.some(course=>course.id===id);}
    function appearanceFor(data,id){
      return id==='theme'?
        (data.settings.themeArt||(data.settings.themeArt={})):
        id==='all'?
          (data.settings.overviewArt||(data.settings.overviewArt={})):
          ((data.settings.coursePrefs||(data.settings.coursePrefs={}))[id]||(data.settings.coursePrefs[id]={}));
    }
    async function uploadArtwork(input){
      const file=input.files?.[0],id=input.dataset.id,kind=input.dataset.kind;
      if(!enabled('customization')||!enabled('course-art')||!root.ReserveCustomArt||!file||customizeBusy||!validArtTarget(id)||!['banner','card','background','icon','border','title'].includes(kind))return;
      let hold=null;customizeBusy=true;customizeStatus='';render();
      try{
        const svg=file.type==='image/svg+xml'||(!file.type&&/\.svg$/i.test(file.name));let asset,framing;
        if(svg){if(file.size>root.ReserveCustomArt.limits.fileBytes)throw Error('Choose an SVG smaller than 256 KiB.');asset=root.ReserveCustomArt.importSVG(await file.text(),file.name);}
        else{
          if(!mediaStore)throw Error('Local media storage is unavailable.');
          const item=await root.ReserveMedia.prepare(file,kind,file.name);
          if(destroyed)return;
          hold=root.crypto.randomUUID();
          await mediaStore.putMany([item],{...mediaOptions(),hold});
          asset=item.asset;
          framing=item.framing;
        }
        if(destroyed)return;
        if(['banner','card','background'].includes(kind)&&root.ReserveMediaFrame)asset={...root.ReserveMediaFrame.resolve(asset,{bannerFit:'cover',bannerPosition:'center'}),...framing};
        const saved=await savePersonal(data=>{appearanceFor(data,id)[kind+'Art']=asset;});
        customizeStatus=saved?'':transientStatus;
      }catch(error){customizeStatus=error?.message||'This SVG could not be loaded.';}
      finally{if(hold)await mediaStore.release(hold).catch(()=>{});customizeBusy=false;if(!destroyed)render();else mediaStore?.close();}
    }
    function frameShape(id,kind,view,frame){
      const selector=kind==='banner'?'.rd-heading-art,.rd-banner-art':kind==='card'?'.rd-rail-art,.rd-dock-tile':'.rd-shell',
        target=Array.from(container.querySelectorAll(selector)).find(node=>(node.dataset.chArtId||node.closest?.('[data-ch-art-id]')?.dataset.chArtId)===id)||
          container.querySelector(kind==='background'?'.rd-shell':'.ch-art-preview'),
        box=target?.getBoundingClientRect?.();
      if(!box?.width||!box?.height)return null;
      if(kind==='banner')return {width:view==='narrow'?Math.min(360,box.width):Math.max(960,box.width),height:({small:90,medium:140,tall:220})[frame.height]};
      if(kind==='card')return {width:box.width,height:box.height};
      return view==='narrow'?{width:390,height:Math.max(600,Math.min(844,box.height))}:{width:Math.max(960,box.width),height:box.height};
    }
    async function saveFraming(id,kind,value){
      if(destroyed||!validArtTarget(id)||!['banner','card','background'].includes(kind))return;if(customizeBusy)throw Error('Artwork is busy. Try again.');
      const pref=id==='theme'?settings().themeArt:id==='all'?settings().overviewArt:settings().coursePrefs?.[id],before=pref?.[kind+'Art'];if(!before)return;
      let frame=root.ReserveMediaFrame.clean(value),hold=null;customizeBusy=true;
      try{const old=root.ReserveMediaFrame.resolve(before,pref),changed=old.still!==frame.still||JSON.stringify(old.loop)!==JSON.stringify(frame.loop);
        if(changed&&frame.asset.kind==='video'){
          const row=await mediaStore.get(frame.asset.mediaId);
          if(!row)throw Error('Saved media is missing.');
          const item=await root.ReserveMedia.prepare(row.blob,kind,row.asset.name,{loop:frame.loop,still:frame.still});
          if(destroyed)return;
          hold=root.crypto.randomUUID();
          await mediaStore.putMany([item],{...mediaOptions(),hold});
          frame={...frame,asset:item.asset,...item.framing};
        }
        if(destroyed)return;const saved=await savePersonal(data=>{appearanceFor(data,id)[kind+'Art']=frame;});customizeStatus=saved?'':transientStatus;
      }catch(error){customizeStatus=error.message;throw error;}finally{if(hold)await mediaStore.release(hold).catch(()=>{});customizeBusy=false;if(!destroyed)render();}
    }
    function artworkTarget(event){
      if(!enabled('customization')||!enabled('course-art')||customizeBusy)return null;
      const node=event.target?.closest?.('[data-ch-art-id],.ch-art-slot');
      if(node){
        const id=node.dataset.chArtId||node.querySelector?.('[data-rd-field="art-upload"]')?.dataset.id,kind=node.dataset.chArtKind||node.dataset.kind;
        if(validArtTarget(id)&&['banner','card','background'].includes(kind))return {id,kind};
      }
      const banner=event.target?.closest?.('.rd-course-heading,.rd-course-banner,.rd-heading-art,.rd-banner-art');if(banner&&validArtTarget(state.courseId))return {id:state.courseId,kind:'banner'};
      const card=event.target?.closest?.('.rd-rail-course,.rd-dock-it,.rd-rail-all');
      if(card){const id=card.dataset.arrangeCourse||card.dataset.id||(card.classList.contains('rd-rail-all')?'all':null);if(validArtTarget(id))return {id,kind:'card'};}
      if(event.type==='paste'&&!event.target?.closest?.('input,textarea,[contenteditable="true"]')&&customizeOpen&&['art','courses'].includes(customizeTab))return {id:customizeCourseId,kind:'banner'};
      return null;
    }
    function mediaFile(event){
      const transfer=event.clipboardData||event.dataTransfer,files=Array.from(transfer?.files||[]);
      if(files.length)return files;
      return Array.from(transfer?.items||[]).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);
    }
    function onArtworkPaste(event){
      const target=artworkTarget(event),files=mediaFile(event);
      if(!target||!files.length)return;
      event.preventDefault();
      if(files.length!==1){customizeStatus='Choose one picture or video.';render();return;}
      void uploadArtwork({files,dataset:target});
    }
    async function pasteArtwork(id,kind){
      if(customizeBusy||!validArtTarget(id)||!['banner','card','background'].includes(kind))return;
      try{
        if(!root.navigator?.clipboard?.read)throw Error('Paste a picture with Ctrl+V.');
        const items=await root.navigator.clipboard.read(),files=[];
        for(const item of items){const type=item.types.find(type=>/^image\/(?:png|jpeg|webp|avif|gif|svg\+xml)$|^video\/(?:mp4|webm)$/.test(type));if(type)files.push(await item.getType(type));}
        if(destroyed)return;
        if(files.length!==1)throw Error('Copy one picture or video first.');
        await uploadArtwork({files,dataset:{id,kind}});
      }catch(error){if(!destroyed){customizeStatus=error.message||'Paste a picture with Ctrl+V.';render();}}
    }
    function packBusy(){return makeOwn?.state.busy||quickPackLoading||['reviewing','applying','undoing'].includes(quickUpload?.state.phase);}
    async function reviewQuickPack(text){
      if(!quickUpload||packBusy())return;
      ++quickPackRead;quickPackError='';
      await quickUpload.review(text);
      if(!destroyed)container.querySelector('.ch-pack-review')?.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
    async function uploadQuickPack(file){
      if(!file||!quickUpload||packBusy())return;
      const token=++quickPackRead;quickPackLoading=true;quickPackError='';quickPackFileName=file.name;render();
      try{
        if(file.size>3145728)throw Error('Choose a pack no larger than 3 MiB.');
        const text=await file.text();if(destroyed||token!==quickPackRead)return;
        quickPackDraft=text;quickPackLoading=false;await reviewQuickPack(text);
      }catch(error){if(!destroyed&&token===quickPackRead)quickPackError=error?.message||'The pack could not be read.';}
      finally{if(!destroyed){quickPackLoading=false;render();}}
    }
    function packDropTarget(event){
      if(!enabled('customization'))return null;
      return event.target?.closest?.('[data-make-drop]')||(enabled('course-art')&&enabled('quick-pack')?event.target?.closest?.('[data-quick-pack-drop]'):null);
    }
    function onPackDragover(event){
      const art=artworkTarget(event);if(art&&Array.from(event.dataTransfer?.types||[]).includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';return;}
      const node=packDropTarget(event);if(!node||!Array.from(event.dataTransfer?.types||[]).includes('Files'))return;
      event.preventDefault();event.dataTransfer.dropEffect=packBusy()?'none':'copy';node.dataset.over=String(!packBusy());
    }
    function onPackDragleave(event){const node=packDropTarget(event);if(node&&!node.contains(event.relatedTarget))delete node.dataset.over;}
    function onPackDrop(event){
      const art=artworkTarget(event);
      if(art){event.preventDefault();const files=mediaFile(event);if(files.length!==1){customizeStatus='Choose one picture or video.';render();return;}void uploadArtwork({files,dataset:art});return;}
      const node=packDropTarget(event);if(!node)return;event.preventDefault();delete node.dataset.over;
      const files=Array.from(event.dataTransfer?.files||[]);if(files.length!==1){quickPackError='Choose one artwork pack at a time.';render();return;}
      if(node.hasAttribute('data-make-drop'))void makeOwn?.choose(files[0]);else void uploadQuickPack(files[0]);
    }
    function mediaOptions(){return {usedIds:()=>root.ReserveMedia.referenced(settings()),confirm:async()=>!destroyed&&root.confirm('Remove oldest unused media?')};}
    function download(blob,name){
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;
      a.download=name;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    async function runKit(action,button){
      if(customizeBusy||!mediaStore||!root.ReserveCustomKits)return;
      const id=button.dataset.id||customizeCourseId,file=button.files?.[0];if(action==='kit-import'&&!file)return;
      if(['kit-save','kit-use'].includes(action)&&!validArtTarget(id))return;
      let hold=null;customizeBusy=true;customizeStatus='';render();
      try{
        if(action==='kit-save'){
          const s=settings(),appearance=id==='theme'?s.themeArt:id==='all'?s.overviewArt:s.coursePrefs?.[id];
          const selected=Object.fromEntries([...root.ReserveCustomization.artKeys,'bannerFit','bannerPosition','titlePlacement'].filter(key=>appearance?.[key]!==undefined).map(key=>[key,appearance[key]])),
            kit=await root.ReserveCustomKits.capture(kitName,selected,{accent:s.accent,font:s.font,bannerSize:s.bannerSize},mediaStore);
          if(destroyed)return;
          await mediaStore.saveKit(kit,mediaOptions());
          await root.ReservePacks?.registerKit?.(kit.id,{store});
          kitName='';
        }
        else if(action==='kit-import'){
          const imported=await root.ReserveCustomKits.importKit(file);
          if(destroyed)return;
          await mediaStore.putMany(imported.media,{...mediaOptions(),kit:imported.kit});
          await root.ReservePacks?.registerKit?.(imported.kit.id,{store});
        }
        else{const kit=customKits.find(k=>k.id===button.dataset.kit);if(!kit)return;
          if(action==='kit-remove')await mediaStore.removeKit(kit.id);
          if(action==='kit-export'){const blob=await root.ReserveCustomKits.exportKit(kit,mediaStore);if(!destroyed)download(blob,kit.name.replace(/[^\w -]/g,'_')+'.chkit');}
          if(action==='kit-use'){
            const refs=root.ReserveMedia.referenced({overviewArt:kit.appearance});
            if(refs.size){hold=root.crypto.randomUUID();await mediaStore.reserve(refs,hold);}
            if(destroyed)return;
            const saved=await savePersonal(data=>{
              const pref=appearanceFor(data,id);
              for(const key of [...root.ReserveCustomization.artKeys,'bannerFit','bannerPosition','titlePlacement'])delete pref[key];
              Object.assign(pref,structuredClone(kit.appearance));
              Object.assign(data.settings,{accent:kit.accent,font:kit.font,bannerSize:kit.bannerSize});
            });
            if(!saved)throw Error(transientStatus);
          }
        }
        if(!destroyed)customKits=await mediaStore.listKits();
      }catch(error){customizeStatus=error?.message||'This kit could not be read.';}
      finally{if(hold)await mediaStore.release(hold).catch(()=>{});customizeBusy=false;if(!destroyed)render();else mediaStore.close();}
    }
    async function replaceLegacyImage(id,file){
      if(!file||customizeBusy||!/^\d+$/.test(id||'')||!validArtTarget(id))return;customizeBusy=true;customizeStatus='';render();let bitmap;
      try{
        if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>12000000)throw Error('Choose a PNG, JPG or WebP image up to 12 MB.');
        bitmap=await root.createImageBitmap(file);
        if(destroyed||container.dataset.chLinksPending)return;
        const canvas=document.createElement('canvas'),ratio=Math.min(1,900/bitmap.width,600/bitmap.height);
        canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
        canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
        let image=canvas.toDataURL('image/jpeg',.82);
        if(image.length>=400000)image=canvas.toDataURL('image/jpeg',.55);
        if(image.length>=400000)throw Error('This image is too detailed. Choose a smaller image.');
        await savePersonal(data=>{appearanceFor(data,id).image=image;});
      }
      catch(error){if(!destroyed)customizeStatus=error.message||'Could not save image.';}
      finally{bitmap?.close();customizeBusy=false;if(!destroyed)render();}
    }

    function handleCustomizeAction(action,button){
      if(!board&&enabled('pony')&&action==='pet-routine-remove'){void savePersonal(data=>{data.pet.routines=(data.pet.routines||[]).filter(r=>r.id!==button.dataset.id);});return true;}
      if(!board&&enabled('pony')&&action==='pet-reset-learning'){void savePersonal(data=>{data.pet.brain=null;});return true;}
      if(!board&&action==='board-frame'){void saveAppearance('panelFrame',button.dataset.value);return true;}
      if(action==='legacy-image-remove'){
        if(!customizeBusy&&!container.dataset.chLinksPending&&enabled('customization')&&enabled('course-art')&&/^\d+$/.test(button.dataset.id||'')&&validArtTarget(button.dataset.id))
          void savePersonal(data=>{delete appearanceFor(data,button.dataset.id).image;});
        return true;
      }
      if(action.startsWith('make-')){
        void makeOwn?.action(action.slice(5),button.dataset.id,{target:button.dataset.target,piece:button.dataset.piece,slot:button.dataset.slot});
        return true;
      }
      if(action.startsWith('kit-')){void runKit(action,button);return true;}
      if(customizeBusy&&(action.startsWith('art-')||action==='course-reset'))return true;
      const id=button.dataset.id,kind=button.dataset.kind;
      if(action==='art-clipboard'){void pasteArtwork(id,kind);return true;}
      if(action==='quick-pack-review'){void reviewQuickPack(quickPackDraft);return true;}
      if(action==='quick-pack-apply'){if(!packBusy()){quickPackError='';void quickUpload?.apply();}return true;}
      if(action==='quick-pack-undo'){if(!packBusy()){quickPackError='';void quickUpload?.undo();}return true;}
      if(action==='quick-pack-reset'){if(!packBusy()){++quickPackRead;quickPackDraft='';quickPackFileName='';quickPackError='';quickUpload?.reset();}return true;}
      if(action==='art-paste'&&validArtTarget(id)&&['banner','card','background','icon','border','title'].includes(kind)){
        if(customizeBusy)return true;
        try{
          let asset=root.ReserveCustomArt.importSVG(customizeDrafts[id+':'+kind]||'','Pasted '+kind+'.svg');
          if(['banner','card','background'].includes(kind)&&root.ReserveMediaFrame)asset=root.ReserveMediaFrame.resolve(asset);
          customizeBusy=true;customizeStatus='Saving artwork…';render();
          savePersonal(data=>{appearanceFor(data,id)[kind+'Art']=asset;}).then(saved=>{
            customizeBusy=false;customizeStatus=saved?'Artwork saved. The page has updated.':transientStatus;
            if(saved)delete customizeDrafts[id+':'+kind];if(!destroyed)render();
          });
        }catch(error){customizeStatus=error.message;render();}return true;
      }
      if(action==='art-template'){
        if(!['banner','card','background','icon','border','title'].includes(kind))return true;
        const url=URL.createObjectURL(new Blob([root.ReserveCustomArt.template(kind)],{type:'image/svg+xml'}));
        const a=document.createElement('a');a.href=url;a.download='canvas-harness-'+kind+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
      }
      if(action==='art-remove'&&(validArtTarget(id)||/^\d+$/.test(id||'')&&Object.hasOwn(personal.settings.coursePrefs||{},id))&&['banner','card','background','icon','border','title'].includes(kind)){
        customizeStatus='Custom artwork removed.';void savePersonal(data=>{delete appearanceFor(data,id)[kind+'Art'];});return true;
      }
      if(action==='course-reset'&&validArtTarget(id)){
        customizeStatus='Course artwork reset. Your name, color and other preferences are kept.';
        void savePersonal(data=>{
          const pref=appearanceFor(data,id);
          for(const key of [...(root.ReserveCustomization?.artKeys||[]),'bannerFit','bannerPosition','titlePlacement','subjectArt'])delete pref[key];
        });return true;
      }
      if(action==='layout-preset'||action==='layout-reset'){
        void saveLayoutPreset(action==='layout-reset'?'studio':button.dataset.value);return true;
      }
      if(action==='course-up'||action==='course-down'){
        const order=normalizeData(settings()).allCourses.map(course=>course.id),from=order.indexOf(id),to=from+(action==='course-up'?-1:1);
        if(from>=0&&to>=0&&to<order.length){[order[from],order[to]]=[order[to],order[from]];void savePersonal(data=>{data.settings.courseOrder=order;});}return true;
      }
      return false;
    }

    function lookSelection(s=settings()){
      if(root.ReserveMakeYourOwn?.activeLook)return root.ReserveMakeYourOwn.activeLook(makeOwn?.state,s);
      const own=s.makeYourOwn||{},id=!s.sceneTheme&&own.theme?.id,key=id?'pack:'+id:s.sceneTheme?'builtin:scene:'+s.sceneTheme:null;return {key,layer:own.adjustments?.[key]||{}};
    }
    function saveAppearance(key,value){
      if(!fieldEnabled({dataset:{rdField:'setting',setting:key}}))return Promise.resolve(false);
      if(key==='theme'&&['light','dark'].includes(value)&&makeOwn?.state.theme&&!makeOwn.state.theme.colors?.[value]){
        if(!makeOwn.action)return Promise.resolve(false);
        const look=lookSelection();
        makeWrites=makeWrites.catch(()=>{}).then(async()=>{
          if(!look.layer.colors?.[value])await makeOwn.action('adjust',look.key,{patch:{colors:{[value]:{bg:value==='dark'?'#1f1e1d':'#faf9f5',accent:value==='dark'?DARK_ACCENTS.clay:ACCENTS.clay}}}});
          if(!settings().makeYourOwn?.adjustments?.[look.key]?.colors?.[value])return false;
          return savePersonal(data=>{data.settings.theme=value;});
        });
        return makeWrites;
      }
      const look=lookSelection();
      if(key==='accent'&&look.key){
        const color=Object.hasOwn(ACCENTS,value)?ACCENTS[value]:value,mode=settings().theme==='dark'?'dark':'light';
        makeWrites=makeWrites.catch(()=>{}).then(()=>makeOwn?.action('adjust',look.key,{patch:{colors:{[mode]:{accent:color}}}}));
        return makeWrites;
      }
      if(key==='sceneTheme'&&root.ReservePacks?.useInstalled)
        return root.ReservePacks.useInstalled(value?'builtin:scene:'+value:'builtin:theme',{store}).then(()=>{makeOwn?.sync();render();return true;}).catch(error=>{
          transientStatus='Could not save: '+(error?.message||'Please try again.');
          render();
          return false;
        });
        if(key==='showGrades'){
          const version=++gradeSaveVersion;gradeVisibilityOverride=value===true;motion?.cancel();render();
          return savePersonal(data=>{data.settings.showGrades=value===true;}).then(saved=>{
            if(version===gradeSaveVersion){if(saved)gradeVisibilityOverride=null;render();}
            return saved;
          });
        }
        return savePersonal(data=>{
          if(key==='sceneTheme'&&value&&data.settings.makeYourOwn)delete data.settings.makeYourOwn.theme;
          if(!Arrange){
            data.settings[key]=value;
            if(key==='deskOrder')data.settings.dashboardLayout=value==='stacked'?'list':'split';
            if(key==='dashboardLayout')data.settings.deskOrder=value==='list'?'stacked':'context-first';
            return;
          }
          const before=Arrange.snapshot(data.settings);
          if(key==='courseNavigation'){Arrange.change(data.settings,{type:'navigation',value});return;}
          if(key==='showCourseInformation'){const command={type:value?'restore-context':'hide-context'};Arrange.change(data.settings,command);pinHomeCommand(data,command);return;}
          data.settings[key]=value;
          if(key==='deskOrder'||key==='dashboardLayout'){
            if(key==='dashboardLayout')data.settings.deskOrder=value==='list'?'stacked':'context-first';
            data.settings.dashboardLayout=data.settings.deskOrder==='stacked'?'list':'split';
            Arrange.resetCore(data.settings,before.layout);
            pinHomeCommand(data,{type:'mode'});
            if(JSON.stringify(Arrange.snapshot(data.settings))!==JSON.stringify(before))data.settings.workspaceUndo=before;
          }
        });
    }
    function saveLayoutPreset(name){
      if(!enabled('customization')||!enabled('arrange'))return Promise.resolve(false);
        const model=root.ReserveCustomization;
        // Presets control layout only. Recent grades, spacing, AI and course art
        const preset=model?.presets[name];
        // remain the user's explicit choices until they edit those settings.
        const keys=['courseNavigation','dockSize','deskOrder','surfaceStyle','courseCardStyle','bannerSize','showCourseIcons','showDeadlinePreview','showBookmarks','showCourseInformation','showCourseStrip'];
        if(preset)return savePersonal(data=>{
          const before=Arrange?.snapshot(data.settings);
          for(const key of keys)if(fieldEnabled({dataset:{rdField:'setting',setting:key}})&&Object.hasOwn(preset,key))data.settings[key]=preset[key];
          data.settings.dashboardLayout=data.settings.deskOrder==='stacked'?'list':'split';
          if(Arrange){
            Arrange.resetCore(data.settings,before.layout);
            pinHomeCommand(data,{type:'mode'});
            if(JSON.stringify(Arrange.snapshot(data.settings))!==JSON.stringify(before))data.settings.workspaceUndo=before;
          }
        });return Promise.resolve(false);
    }

    async function savePersonal(change,petField){
      // The store stays silent when a save leaves the data as it was (storage.js update), so a control the store
      // cleaned back to the saved value still gets its redraw here: a fresh notify replaces `personal`.
      const personalBefore=personal;
      try{await store.update(data=>{
        const previous=JSON.parse(JSON.stringify(data.pet||{})),
          shownName=root.ReservePetArt?.identity?.(data,makeOwn?.state.pet)?.name||previous.name,
          s=data.settings,
          old={font:s.font,panelFrame:s.panelFrame,courseCardStyle:s.courseCardStyle},
          look=lookSelection(s),
          petId=s.makeYourOwn?.pet?.id;
        change(data);
        const layer=key=>{
          const own=data.settings.makeYourOwn||(data.settings.makeYourOwn={theme:null,pet:null,installed:{}});
          own.adjustments??={};
          return own.adjustments[key]??={};
        };
        // A pack can display a different name even when the personal name is unchanged.
        if(petId&&data.settings.makeYourOwn?.pet?.id===petId)
          for(const key of ['name','size','roam','nudges','enabled','skills','routines','coat','harness','gear'])
            if(JSON.stringify(previous[key])!==JSON.stringify(data.pet?.[key])||key==='name'&&petField==='name'&&shownName!==data.pet?.name){
              const custom=layer('pack:'+petId);
              custom.pet??={};
              custom.pet[key]=data.pet[key];
            }
        if(look.key&&lookSelection(data.settings).key===look.key)
          for(const [key,part]of [['font','title'],['panelFrame','panel'],['courseCardStyle','card']])if(old[key]!==data.settings[key]){const custom=layer(look.key);custom.parts??={};custom.parts[part]=false;}
      });
      if(personal===personalBefore&&typeof store.subscribe==='function')scheduleRender();
      if(!drafts.size&&transientStatus.startsWith('Could not save:')){transientStatus='';render();}
      return true;
      }
      catch(error){transientStatus=`Could not save: ${error?.message||'Please try again.'}`;render();return false;}
    }

    let tabsWait=0;
    function syncTabsLater(){
      if(tabsWait)return;const idle=fn=>typeof root.requestIdleCallback==='function'?root.requestIdleCallback(fn,{timeout:800}):root.setTimeout(fn,200);
      const go=()=>{
        if(destroyed){tabsWait=0;return;}
        const until=Number(container.dataset.chMoving||0)-Date.now();
        if(until>0){tabsWait=root.setTimeout(()=>{tabsWait=idle(go);},until+30);return;}
        tabsWait=0;
        motion?.syncTabs(false);
      };
      tabsWait=idle(go);
    }
    // Keyboard use marked a moment later: once any move on screen (data-ch-moving) has landed and the browser is idle.
    // A pointer press in between keeps the pointer look (onPointerdown sets it; the waiting mark then does nothing).
    let keyboardWait=0;
    function keyboardLater(){
      if(keyboardWait||container.dataset.input==='keyboard')return;const asked=container.dataset.input||'';
      const idle=fn=>typeof root.requestIdleCallback==='function'?root.requestIdleCallback(fn,{timeout:1500}):root.setTimeout(fn,400);
      const go=()=>{
        if(destroyed){keyboardWait=0;return;}
        const until=Math.max(container.dataset.chRoom?400:0,Number(container.dataset.chMoving||0)-Date.now());
        if(until>0){keyboardWait=root.setTimeout(()=>{keyboardWait=idle(go);},until+40);return;}
       keyboardWait=0;
       if((container.dataset.input||'')!==asked||container.dataset.input==='keyboard')return;
       container.dataset.input='keyboard';
       motion?.cancel({preserveArt:true});
       motion?.syncTabs(false,true);
      };
      keyboardWait=idle(go);
    }
    function onKeydown(event){
      if(destroyed||!container.getClientRects?.().length)return;
      const input=event.composedPath?.()[0]||event.target;pointerTurn++;
      if(roomTab(event))return;
      if(input?.closest?.('.ch-band-drawer, .ch-band-sheet'))return;
      // The Focus room covers everything while it is open (data-ch-room): its keys are its own, and nothing under it
      // (the Review deck's Space and 1/2/3, its Escape) may hear them, even when a click on the scene left focus on the body.
      // Escape alone, the key that closes a room, never marks keyboard use: marking it restyles every element on the page
      // (.rd[data-input=keyboard] *), some 0.17 s on its own even once the fold has landed (0.67 s at 4x CPU). Tab and the
      // other keys still mark it, a moment later.
      if(container.dataset.chRoom){if(event.key==='Tab')tabAt=Date.now();if(event.key!=='Escape')keyboardLater();board?.keydown(event);return;}
      if(!container.dataset.chLinksPending&&hub?.keydown?.(event))return;
      motion?.activity?.();motion?.busy?.();if(event.key==='Tab')tabAt=Date.now();
      // The first key after the mouse marks keyboard use and restyles the tabs (some five thousand elements). While a
      // full-page room (Grade impact, the Review deck) is up, its own key (Escape folds it) goes first and the restyle waits
      // until the browser is idle after the move.
      // A room still growing counts as up (Escape then takes its sheet back into the module), and Escape, the rooms' own
      // key, never marks keyboard use at all (as with the Focus room above).
      if(container.dataset.input!=='keyboard'){
        if(room||container.querySelector('.gi-room:not([data-gi-away]), [data-review-deck]')||Number(container.dataset.chMoving||0)>Date.now()){if(event.key!=='Escape')keyboardLater();}
        else{container.dataset.input='keyboard';motion?.cancel({preserveArt:true});motion?.syncTabs(false,true);}
      }
      if(arrange?.keydown(event))return;
      if(reviewDeck?.keydown(event))return;
      if(board?.keydown(event))return;
      if(settingsDock?.handleKeydown(event))return;
      // Esc closes the phone drawer, then the phone reader sheet (focus returns to its row).
      if(courseDock.keydown(event))return;
      if(event.key==='Escape'&&drawerOpen()){event.preventDefault();setDrawer(false);return;}
      if(event.key==='Escape'&&phone()&&readerOpen&&workspace==='work'&&(event.composedPath?.()[0]||event.target)?.dataset?.rdField!=='query'){
        event.preventDefault();
        closePreview();
        return;
      }
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&toolbox){event.preventDefault();toolbox.open('quick',container.querySelector(':focus'));return;}
      // Workspace tabs only: the Tools dock's tabs share .t-tab but handle their own keys.
      // Alt/Ctrl/Cmd chords stay the browser's (Alt+Left is Back).
      const tab=(event.composedPath?.()[0]||event.target)?.closest?.('.rd-workspace-tab');
      if(tab&&container.contains(tab)&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
        event.preventDefault();const tabs=Array.from(container.querySelectorAll('.rd-workspace-tab')),index=tabs.indexOf(tab);
        const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
        tabs[next]?.click();tabs[next]?.focus({preventScroll:true});return;
      }
      const target=event.composedPath?.()[0]||event.target;
      if(event.key==='Enter'&&target?.dataset?.rdField==='new-step'){event.preventDefault();addStep(target.dataset.id);return;}
      const typing=target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||'');
      if(event.key==='?'&&!typing&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();customizeTab='settings';settingsDock?.open();return;}
      if(event.key.toLowerCase()==='b'&&!typing&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&board?.askPet?.()){event.preventDefault();return;}
      if((event.key==='/'&&!typing&&!event.ctrlKey&&!event.metaKey&&!event.altKey)||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!typing&&enabled('tools'))){
        // Assignments' search is rendered in the command bar and in the heading; the one on screen takes focus.
        event.preventDefault();
        const selector=workspace==='home'?'[data-rd-field="overview-query"]':workspace==='grades'?'[data-rd-field="grade-query"]':workspace==='materials'?'[data-rd-field="material-query"]':workspace==='inbox'?'[data-rd-field="hub-query"]':'[data-rd-field="query"]';
        const input=Array.from(container.querySelectorAll?.(selector)||[]).find(field=>field.getClientRects?.().length)||container.querySelector(selector);
        input?.focus();
        input?.select();
      }else if(event.key==='Escape'&&target?.dataset?.rdField==='query'&&state.query){event.preventDefault();state.query='';visibleLimit=60;render();}
    }

    // A revision-only change keeps `personal` as it is (equal in everything the dashboard reads), so savePersonal still
    // sees that no notify replaced it and redraws a control the store cleaned back. Any other Prepare-status-only change
    // does the same and refreshes the AI panel's status line instead; the refresh waits a microtask so every store
    // subscriber (the AI client clears its cached state in one) has run first.
    // A grade the reading room draws itself (it saves, then brings its own page up to date) needs no whole-page render.
    const unsubscribe=typeof store.subscribe==='function'?store.subscribe(data=>{
      const next=data||store.get()||{};
      if(prepareRevisionOnly(personal,next))return;
      if(mounted&&prepareStatusOnly(personal,next)){Promise.resolve().then(()=>{if(!destroyed)toolbox?.update();});return;}
      personal=next;
      normalizedCache=null;
      const quietDeck=reviewDeck?.takeQuietSave?.(),quietImpact=gradeImpact?.takeQuietSave?.();
      if(quietDeck||quietImpact)return;
      scheduleRender();
    }):()=>{};
    container.addEventListener('dragover',onPackDragover);
    container.addEventListener('dragleave',onPackDragleave);
    container.addEventListener('drop',onPackDrop);
    container.addEventListener('paste',onArtworkPaste);
    container.addEventListener('input',onInput);
    container.addEventListener('change',onChange);
    container.addEventListener('focusout',onFocusout);container.addEventListener('focusin',onHeaderFocusin);
    container.addEventListener('click',onClick);
    // The rooms' own listeners sit on the dashboard's shadow root, ahead of every listener inside it (a press on a room
    // that is folding away is passed on before anything in the room hears it); the document's are left alone.
    const rootOf=container.getRootNode?.(),roomScope=rootOf&&rootOf.nodeType===11?rootOf:null,ROOM_PRESSES=['pointerdown','mousedown','pointerup','mouseup','click','dblclick'];
    for(const type of ROOM_PRESSES)roomScope?.addEventListener?.(type,throughRoom,true);
    roomScope?.addEventListener?.('pointerover',roomWayIn,{capture:true,passive:true});roomScope?.addEventListener?.('focusin',roomWayIn,true);
    const onDisclosure=event=>{if(event.target?.dataset?.message&&event.target.open)hub?.readMessage(event.target.dataset.message);};
    container.addEventListener('toggle',onDisclosure,true);
    // Pointer and key input also keep the living drawings going: after two minutes with none,
    // motion.js lets them rest where they stand until the next input (the idle rest).
    // The first press after the keyboard marks pointer use, which restyles every element on the page (.rd[data-input]):
    // a press on a way into a room, in a room, or while a move plays marks it once the move has played and the browser is
    // idle (half a second of the open's first frame at 4x CPU); a key pressed meanwhile keeps the keyboard's.
    let pointerTurn=0;
    function pointerLater(){
      const turn=++pointerTurn,idle=fn=>typeof root.requestIdleCallback==='function'?root.requestIdleCallback(fn,{timeout:1500}):root.setTimeout(fn,400);
      const go=()=>{
        if(destroyed||turn!==pointerTurn)return;
        const until=movingLeft();
        if(until>0){root.setTimeout(()=>idle(go),until+40);return;}
        if(container.dataset.input!=='pointer')container.dataset.input='pointer';
      };
      idle(go);
    }
    function pointerUse(event){
      if(container.dataset.input==='pointer')return;const t=event.composedPath?.()[0]||event.target;
      if(room||movingLeft()>0||t?.closest?.('.rd-roomlayer,[data-rv-grow],[data-rd-action="review-deck-open"],[data-gi-open],[data-rd-action="room-open"],.rd-workspace-tab[data-tab="review"]'))
        pointerLater();
      else{pointerTurn++;container.dataset.input='pointer';}
    }
    const onPointerdown=event=>{pointerUse(event);motion?.activity?.();motion?.busy?.();arrange?.pointerdown(event);};
    // Scrolling is input too, but it never holds the drawings: they keep playing while the page scrolls.
    const onWheel=()=>{motion?.activity?.();};
    container.addEventListener('pointerdown',onPointerdown);container.addEventListener('wheel',onWheel,{passive:true});
    const onArrangePointerUp=event=>arrange?.pointerup(event),
      onArrangePointerCancel=event=>arrange?.pointercancel(event),
      onArrangeContext=event=>arrange?.contextmenu(event);
    container.addEventListener('pointerup',onArrangePointerUp);
    container.addEventListener('pointercancel',onArrangePointerCancel);
    // Any real pointer movement ends the hover hold set by a check-off. (The course
    container.addEventListener('contextmenu',onArrangeContext);
    // drawings need no hover: they live on their own, motion.js.)
    const onPointermove=event=>{if(container.dataset.hoverHold)delete container.dataset.hoverHold;motion?.activity?.();arrange?.pointermove(event);};
    container.addEventListener('pointermove',onPointermove);
    // Capture the last scroll on normal navigation/reload without saving on
    document.addEventListener('keydown',onKeydown);
    // every scroll event or delaying departure from the page.
    root.addEventListener?.('pagehide',remember);
    // Synchronous cache/loading notifications are already included in the first complete markup.
    const freshnessTimer=setInterval(updateFreshness,60000);
    readStudy();
    if(workspace==='materials')materials?.load(state.courseId);
    if(workspace==='hub')hub?.loadCourse(state.courseId);
    if(workspace==='inbox')hub?.loadInbox();
    // Startup notifications share one complete pre-paint frame.
    visitAgent();
    if(root.requestAnimationFrame)scheduleRender();else render();

    return {
      isReady(){return mounted;},
      getState(){return navigationState(true);},
      closePersonalFiles(){
        personalRevision++;
        companionTurn++;
        companionKey='';
        companionPack=null;
        container.dataset.chLinksPending='true';
        preferences?.cancel();
        settingsDock?.close({restoreFocus:false});
        makeOwn?.setOpen?.(false);
        courseFileOpen?.close();
      },
      resumePersonalFiles(){delete container.dataset.chLinksPending;makeOwn?.setOpen?.(customizeOpen);scheduleRender();},
      destroy(){
        if(destroyed)return;
        remember();
        flushDrafts();
        destroyed=true;
        consumeSources();
        pendingRender=null;
        root.chrome?.storage?.onChanged?.removeListener?.(navChanged);
        root.chrome?.storage?.onChanged?.removeListener?.(studyChanged);
        root.document?.removeEventListener?.('reserve:biscuit-rules',biscuitRulesChanged);
        if(sceneActive){root.ReserveSceneThemes?.remove(container);sceneActive=false;}
        personalRevision++;companionTurn++;root.ReserveDataTheme?.remove(container);makeOwn?.destroy();preferences?.destroy();
        readerLayout?.disconnect();
        railLayout?.disconnect();
        railAncestors?.disconnect();
        root.clearTimeout(railTimer);
        if(railSelectionFrame)cancelPaint(railSelectionFrame);
        root.removeEventListener?.('resize',queueRail);document.fonts?.removeEventListener?.('loadingdone',queueRail);
        frameEditor?.destroy();frameController?.destroy();mediaController?.destroy();courseDock.destroy();
        if(!customizeBusy)mediaStore?.close();
        for(const type of ROOM_PRESSES)roomScope?.removeEventListener?.(type,throughRoom,true);
        roomScope?.removeEventListener?.('pointerover',roomWayIn,true);
        roomScope?.removeEventListener?.('focusin',roomWayIn,true);
        for(const k of [...spares.keys()])dropSpare(k);if(roomFrame)cancelPaint(roomFrame);room=null;
        ++quickPackRead;
        reviewDeck?.destroy();
        gradeImpact?.destroy();
        deadlineChanges?.destroy();
        quickUpload?.destroy();
        arrange?.destroy();
        board?.destroy();
        settingsDock?.destroy();
        materials?.destroy();
        hub?.destroy();
        ownFiles?.destroy();
        courseFiles?.destroy();
        courseFileOpen?.destroy();
        motion?.destroy();
        toolbox?.destroy();
        clearInterval(freshnessTimer);clearInterval(focusTimer);clearTimeout(entranceTimer);
        // The Help band's runtime message listener would otherwise keep it, its host and this whole detached dashboard
        // alive (about 9,900 nodes per remount, perf leaks-7).
        helpBand?.destroy();helpBand=null;helpBandHost=null;helpBandSignature='';
        unsubscribe?.();
        container.removeEventListener('dragover',onPackDragover);
        container.removeEventListener('dragleave',onPackDragleave);
        container.removeEventListener('drop',onPackDrop);
        container.removeEventListener('paste',onArtworkPaste);
        container.removeEventListener('input',onInput);
        container.removeEventListener('change',onChange);
        container.removeEventListener('focusout',onFocusout);container.removeEventListener('focusin',onHeaderFocusin);
        container.removeEventListener('click',onClick);
        container.removeEventListener('toggle',onDisclosure,true);
        container.removeEventListener('pointerdown',onPointerdown);container.removeEventListener('wheel',onWheel,{passive:true});container.removeEventListener('pointermove',onPointermove);
        container.removeEventListener('pointerup',onArrangePointerUp);container.removeEventListener('pointercancel',onArrangePointerCancel);container.removeEventListener('contextmenu',onArrangeContext);
        document.removeEventListener('keydown',onKeydown);bandWatch?.disconnect();
        root.removeEventListener?.('pagehide',remember);
        container.remove();
      },
      updateSnapshot(next){
        if(destroyed)return;
        // The same snapshot again keeps its caches and AI visit; only the clock can have moved (updateFreshness).
        // A companion drawing whose first read failed is still asked for again here (it returns at once otherwise).
        if(next&&next===currentSnapshot){syncCompanion();if(!timeSettled())scheduleRender();return;}
        if(next&&Array.isArray(next.courses)&&Array.isArray(next.assignments)){currentSnapshot=next;normalizedCache=null;contentCache.clear();visitAgent();}
        scheduleRender();
      },
      setStatus(text){
        const next=stringValue(text);
        if(destroyed||next===externalStatus)return;
        const warning=!refreshing&&transientStatus.startsWith('Could not save:');
        externalStatus=next;
        if(!refreshing)transientStatus='';
        updateStatus();
        if(warning)scheduleRender();
      },
    };
  }

  return {
    mount,
    helpers:{
      patchUI,
      createCourseDock,
      sameOriginLink,
      assignmentLink,
      gradePeriodLabel,
      filterAssignments:Model.filterAssignments,
      safeCourseImage,
      statusLabel,
      dateMs,
      pinHomeCommand
    }
  };
});
