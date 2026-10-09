/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root,factory){
  'use strict';
  const api=factory(root);
  root.ReserveDashboard=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  const CANVAS_ORIGIN=(globalThis.ReserveSite.origin());
  const DAY=86400000;
  const COURSE_COLORS=['#286452','#315f8f','#76549a','#a05252','#9a6a24','#34737a','#6c7443','#8a5573'];
  // Clay is the default (2.15). Light clay #A9522F carries text at 4.6:1 or better on every
  // surface and white text on it at 5.3:1; dark clay #E08A6A reads at 5:1 or better.
  const ACCENTS={clay:'#A9522F',forest:'#367964',indigo:'#5f5ccc',rose:'#9e4c6c',ocean:'#2f7185',amber:'#956821'};
  const DARK_ACCENTS={clay:'#E08A6A',forest:'#9bd1b4',indigo:'#bec8ff',rose:'#efb0c0',ocean:'#a3d4e5',amber:'#e8c68b'};
  const MOTION_STYLES=['gentle','still','off'];
  // Pointer actions whose render may animate: each takes a read-only snapshot first.
  const MOTION_ACTIONS=new Set(['course','workspace','open-materials','open-hub','course-section','overview-view','overview-all','grades','reader-tab','preview','glance','view','day','check-off','undo-check-off']);
  const Model=root.ReserveDashboardModel||(typeof module==='object'&&module.exports?require('./dashboard-model.js'):null);
  const View=root.ReserveDashboardView||(typeof module==='object'&&module.exports?require('./dashboard-view.js'):null);
  const Work=root.ReserveWorkModel||(typeof module==='object'&&module.exports?require('./work-model.js'):null);

  const stringValue=value=>value==null?'':String(value);
  const dateMs=value=>{if(value==null||value==='')return null;const ms=typeof value==='number'?value:Date.parse(value);return Number.isFinite(ms)?ms:null;};

  // Reconcile owned UI in place: focus, selection, scrolling and CSS transitions
  // belong to the existing nodes. Teacher HTML is an opaque, sanitized fragment.
  function patchUI(current,next){
    const nextValue=next.value;
    const key=node=>node.nodeType===1?(node.getAttribute('data-rd-key')||node.id||(node.getAttribute('data-rd-section')?'section:'+node.getAttribute('data-rd-section'):'')):'';
    const compatible=(a,b)=>a&&a.nodeType===b.nodeType&&a.nodeName===b.nodeName&&key(a)===key(b);
    if(current.nodeType!==1){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
    for(const attr of Array.from(current.attributes)){
      if(attr.name==='data-motion'||current.tagName==='DETAILS'&&attr.name==='open')continue;
      if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
    }
    for(const attr of Array.from(next.attributes)){if(current.tagName==='DETAILS'&&attr.name==='open')continue;if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);}
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
  function mount(target,{snapshot,store,demo=false,onPlanner=()=>{},onNative=null,refresh=async()=>{},status='',initialState,materialClient,onAuthError=()=>{}}={}){
    if(!target||typeof target.append!=='function')throw Error('ReserveDashboard needs a shadow root or element target.');
    if(!snapshot||!Array.isArray(snapshot.courses)||!Array.isArray(snapshot.assignments))throw Error('ReserveDashboard needs a Canvas snapshot.');
    if(!store||typeof store.get!=='function')throw Error('ReserveDashboard needs the account-bound Canvas Harness store.');

    const C=root.ReserveCore;
    const U=root.ReserveUI;
    const E=U?.escapeHTML||((value)=>stringValue(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])));
    if(!C?.normalizeCourse||!C?.normalizeAssignment)throw Error('ReserveCore must be loaded before ReserveDashboard.');

    const container=document.createElement('section');
    container.className='rd';
    container.setAttribute('aria-label','Canvas Harness Canvas dashboard');
    // One short staggered entrance per mount. CSS skips it for reduced motion.
    container.dataset.entrance='true';
    const entranceTimer=setTimeout(()=>{delete container.dataset.entrance;},1200);
    target.append(container);

    let currentSnapshot=snapshot;
    let externalStatus=stringValue(status);
    let transientStatus='';
    let refreshing=false;
    let destroyed=false;
    let focusTimer=0,focusSettling=false,focusDoneUntil=0;// syncFocus
    const stateKey=store.owner?`reserve:dashboard:${store.owner.origin}:${store.owner.accountId}`:'';
    let savedState;
    try{if(stateKey)savedState=JSON.parse(root.sessionStorage?.getItem(stateKey)||'null');}catch{}
    const bootState=initialState||savedState||{};
    let state=Model.cleanState(bootState);
    const courseMemory=Model.createCourseMemory(bootState.courseViews),restoredView=Model.cleanCourseView(bootState,state.courseId);
    let visibleLimit=state.limit;
    let personal=store.get()||{};
    let normalizedCache=null,gradeVisibilityOverride=(initialState?.gradeVisibilityOverride??savedState?.gradeVisibilityOverride)===false?false:null,gradeSaveVersion=0;
    let selectedId=restoredView.selectedId;
    let readerTab=restoredView.readerTab,customizeOpen=false,customizeCourseId='all',customizeStatus='',customizeBusy=false,customizeDrafts={},readerOpen=restoredView.readerOpen,gradeQuery='',gradeLimit=40;
    let pendingReaderScroll={courseId:state.courseId,id:selectedId,top:restoredView.readerScroll};
    const readerLayout=typeof root.ResizeObserver==='function'?new root.ResizeObserver(()=>{if(restoreReaderScroll())remember();}):null;
    const explicitWorkspace=initialState?.workspace||savedState?.workspace;
    let workspace=['work','materials','hub','inbox','grades'].includes(explicitWorkspace)?explicitWorkspace:'work';
    let deckCourseRequested='';
    let overviewMode='actionable',overviewQuery='',checkOffNotice=null;
    const checkingOff=new Set();
    const contentCache=new Map();
    const drafts=new Map();
    const stepDrafts=new Map();
    let draftTimer;
    const formatters=new Map();
    const resourceClient=materialClient||(!demo?root.ReserveAPI?.createClient():null);
    const materials=root.ReserveMaterialsUI?.create({store,user:snapshot.user,client:resourceClient,onChange:()=>render(),onAuthError,onCapture:draft=>toolbox?.capture(draft,container.querySelector(':focus'))});
    const hub=root.ReserveCourseHubUI?.create({store,user:snapshot.user,client:resourceClient,materials,onChange:()=>render(),onAuthError,onCapture:draft=>toolbox?.capture(draft,container.querySelector(':focus'))});
    const motion=root.ReserveMotion?.create(container);
    const settingsDock=root.ReserveCustomizeUI?.createDock({container,
      onOpen:()=>{if(drawerOpen())setDrawer(false,{focus:false});toolbox?.close({restoreFocus:false});customizeCourseId=state.courseId;},
      onChange:open=>{customizeOpen=open;render();}
    });
    const toolbox=root.ReserveToolbox?.create({container,store,materials,aiConfig:{client:resourceClient,user:snapshot.user,demo},getContext:()=>{
      const ctx=buildContext();return {...ctx,courseId:state.courseId,aiAssignmentId:workspace==='work'&&readerOpen?selectedId:null,
        aiResources:ctx.courses.map(c=>materials?.getCourse(c.id)?.raw).filter(Boolean),
        aiUpdates:ctx.courses.map(c=>({courseId:c.id,announcements:hub?.getCourse(c.id)?.announcements||[]}))};
    },
      onDockChange:({open,collapsed})=>{if(open)settingsDock?.close({restoreFocus:false});container.dataset.toolbox=open?(collapsed?'collapsed':'open'):'closed';container.getRootNode?.()?.host?.toggleAttribute('data-reserve-tools',open);},
      onNavigate:next=>{
        captureCourseView();workspace=next;
        if(['hub','materials'].includes(next)&&state.courseId==='all'){const ctx=buildContext();switchCourse(String(ctx.selected?.courseId||ctx.courses[0]?.id||'all'));}
        materials?.activate(state.courseId);render();
        if(next==='materials')materials?.load(state.courseId);if(next==='hub')hub?.loadCourse(state.courseId);if(next==='inbox')hub?.loadInbox();
      },
      onPreview:id=>{captureCourseView();workspace='work';const item=buildContext().items.find(x=>x.id===id);if(item&&state.courseId!=='all'&&state.courseId!==String(item.courseId))switchCourse('all');readerOpen=false;showPreview(id,{detail:0});},
      onPlanner:options=>openPlanner(options),onRefresh:()=>runRefresh({reportError:true})
    });


    // A running focus session turns "your week" into Home, where its card lives,
    // for the Tools dock (Quick open's Planner) and legacy reminder links alike.
    function openPlanner(options){onPlanner({...options,...(options?.page==='week'&&personal.focus?.endsAt?{page:'home'}:{}),hideGrades:settings().showGrades!==true});}

    function settings(){
      return gradeVisibilityOverride===null?(personal.settings||{}):{...personal.settings,showGrades:gradeVisibilityOverride};
    }

    // Dark is opt-in only. A saved "system" preference (the old default)
    // stays light even when the device itself uses a dark theme.
    function effectiveTheme(s){
      return s.theme==='dark'?'dark':'light';
    }

    function validColor(value,fallback){
      return /^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
    }

    let railTimer=0,railTop='',railBelow='';
    // The rail fills the screen below the toolbar and Appearance panel, so measure
    // again whenever they or .rd resize: accordion frames, rewrapping, late fonts or
    // sheets, a revealed host. Always after the frame, so the write can never resize
    // an observed box inside its own callback.
    const railLayout=typeof root.ResizeObserver==='function'?new root.ResizeObserver(()=>{root.clearTimeout(railTimer);railTimer=root.setTimeout(()=>{measureRail();keepFocusVisible();sheetCover();},0);}):null;
    // Phones: the open reader sheet (refresh.css section 16) covers the workspace below the command bar.
    // What it covers is inert, so Tab never lands behind it; the sheet stays non-modal (the bar above it,
    // Esc and Back to list still work). Every render and every resize past 600px sets or clears it (patchUI
    // strips attributes the markup does not carry, so it is re-applied after each patch).
    function sheetCover(){
      const workspaceNode=container.querySelector?.('.rd-workspace');if(!workspaceNode?.children)return;
      const covered=!destroyed&&readerOpen&&workspace==='work'&&phone()&&!!workspaceNode.querySelector?.('.rd-information > .rd-reader'),nodes=[];
      for(const node of workspaceNode.children){
        if(!node.classList?.contains('rd-main')){nodes.push(node);continue;}
        for(const part of node.children||[]){if(!part.classList?.contains('rd-information')){nodes.push(part);continue;}for(const piece of part.children||[])if(!piece.classList?.contains('rd-reader'))nodes.push(piece);}
      }
      for(const node of nodes){if(covered)node.setAttribute?.('inert','');else node.removeAttribute?.('inert');}
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
      const normalized=(currentSnapshot.courses||[]).map((raw,index)=>({...C.normalizeCourse(raw),defaultView:raw.default_view||raw.defaultView||'',_index:index})).filter(course=>/^\d+$/.test(course.id));
      // Hidden by hand, or not a class (NameCoach, College Counseling) and never shown by hand (ReserveCore.hiddenCourseIds).
      const hidden=C.hiddenCourseIds(normalized,s);
      normalized.sort((a,b)=>{
        const ai=order.indexOf(a.id),bi=order.indexOf(b.id);
        return (ai<0?order.length+a._index:ai)-(bi<0?order.length+b._index:bi);
      });
      const allCourses=normalized.map((course,index)=>{
        const pref=prefs[course.id]||{};
        // ownColor: the student chose this colour (it tints the paint of the row's frame); the default goes by position.
        const color=validColor(pref.color,COURSE_COLORS[index%COURSE_COLORS.length]),ownColor=validColor(pref.color,'')!=='';
        // Short labels come from the Canvas name; a student's own name is shown as typed.
        // A leading subject ("English: …") leads the line under the title ("Subject · Teacher").
        const label=C.courseLabel?.(course.name)||{title:course.name,teacher:'',sub:'',tag:'',subject:''},custom=pref.name||'';
        const extra=value=>custom&&value&&String(custom).toLowerCase().includes(value.toLowerCase())?'':value;
        return {...course,name:custom||course.name,originalName:course.name,shortName:custom||label.title||course.name,subject:extra(label.subject||''),teacher:extra(label.teacher),sub:extra(label.sub),tag:label.tag,courseSearch:[course.name,course.code].filter(Boolean).join(' '),color,ownColor,artPrefs:pref,artMotion:s.motion==='gentle'&&s.livingArt!=='off',image:safeCourseImage(pref.image)||safeCourseImage(course.image)};
      });
      const courseMap=new Map(allCourses.map(course=>[course.id,course]));
      const courses=allCourses.filter(course=>!hidden.has(course.id));
      const items=(currentSnapshot.assignments||[]).map(raw=>{
        const courseId=String(raw?.course_id??raw?.courseId??'');
        const course=courseMap.get(courseId);
        if(!course||hidden.has(courseId))return null;
        return {...C.normalizeAssignment(raw,course),courseSearch:course.courseSearch};
      }).filter(Boolean);
      // Search keeps the full Canvas name (teacher, cohort) even after a rename.
      items.push(...(root.ReservePersonalWork?.normalize(personal,courses)||[]).map(item=>({...item,courseSearch:courseMap.get(String(item.courseId))?.courseSearch||''})));
      return normalizedCache={courses,allCourses,courseMap,items};
    }

    function buildContext(){
      const s=settings();
      const {courses,allCourses,courseMap,items}=normalizeData(s);
      courseMemory.prune(courses.map(course=>course.id));
      if(state.courseId!=='all'&&!courses.some(x=>x.id===state.courseId))switchCourse('all',{rememberCurrent:false});
      const now=Date.now();
      const local=personal.tasks||{};
      const filtered=Model.filterAssignments(items,{...state,now,timeZone:s.timeZone,local,prioritizePins:false});
      const palette=effectiveTheme(s)==='dark'?DARK_ACCENTS:ACCENTS;
      const accent=palette[s.accent]||palette.clay;
      const retained=readerOpen?items.find(x=>x.id===selectedId&&x.personal&&(state.courseId==='all'||state.courseId===x.courseId)):null;
      const selected=retained||filtered.items.find(x=>x.id===selectedId)||filtered.items[0]||null;
      if(workspace==='work'&&selectedId!==(selected?.id||null)){selectedId=selected?.id||null;readerTab=selected?.personal?'plan':'details';readerOpen=false;}
      const insights=Work.insights(items,local,{now,timeZone:s.timeZone,courseId:state.courseId});
      // Rail badges and the heading summary reuse the Up next rules, so every
      // number matches the list a student sees after choosing it.
      const courseLoad=new Map(),glance={overdue:0,today:0,tomorrow:0};
      for(const item of Model.filterAssignments(items,{mode:'actionable',courseId:'all',now,timeZone:s.timeZone,local}).items){
        const id=String(item.courseId),due=dateMs(item.dueAt),load=courseLoad.get(id)||{open:0,overdue:0,next:null,then:null};
        load.open++;if(due!==null&&due<now)load.overdue++;courseLoad.set(id,load);
        // The rail's two earliest items come from the same list, so they agree with the count.
        const sooner=other=>!other||due!==null&&(dateMs(other.dueAt)??Infinity)>due;
        if(sooner(load.next)){load.then=load.next;load.next=item;}else if(sooner(load.then))load.then=item;
        if(due===null||(state.courseId!=='all'&&state.courseId!==id))continue;
        const distance=dayDistance(due,now,s.timeZone);
        if(due<now)glance.overdue++;if(distance===0)glance.today++;if(distance===1)glance.tomorrow++;
      }
      const overviewItems=workspace==='home'?Model.filterAssignments(items,{mode:overviewMode,query:overviewQuery,courseId:'all',now,timeZone:s.timeZone,local}).items:[];
      const deckCourse=courses.find(course=>course.id===(state.courseId==='all'?String(selected?.courseId||''):state.courseId))||courses[0]||null;
      // Each view filter shows the count its list would show once chosen (the same rules, the same search).
      const modeCounts=workspace==='work'?Object.fromEntries(['actionable','today','week','planned'].map(mode=>[mode,mode===state.mode&&!state.day?filtered.items.length:Model.filterAssignments(items,{...state,mode,day:'',now,timeZone:s.timeZone,local}).items.length])):{};
      if(!railTimer)railTimer=root.setTimeout?.(()=>measureRail(),0)||0;
      return {s,courses,allCourses,courseMap,items,filtered,now,accent,local,resourcePins:personal.resourcePins||[],insights,courseLoad,glance,modeCounts,unread:hub?.unreadCount?.()||0,selected,deckCourse,overviewItems,overviewMode,overviewQuery,checkOffNotice,theme:effectiveTheme(s),focusClock:C.focusClock?.(personal.focus,now)||''};
    }

    // Every course row in the rail is as tall as the tallest one's content (refresh.css section 3:
    // flex-basis --rd-rail-row-h, growing by equal shares of any spare height), so a course whose name
    // wraps ("Subject: Example Course") sets the rhythm instead of standing out.
    // A row's content is what its course button holds, top-aligned: measured from the button's top to its
    // lowest child, so the row's own (grown) height never feeds back. Written on .rd only when it changes;
    // returns true when it did. Runs right after each render's patch (before motion places the rail's
    // selection) and with every rail measurement (resize, late fonts).
    let railRowH='';
    function railRows(){
      const rail=container.querySelector?.('.rd-course-rail'),rows=rail?.querySelectorAll?.(':scope > .rd-rail-course');if(destroyed||!rows?.length||!root.getComputedStyle)return false;
      const px=(style,...names)=>names.reduce((sum,name)=>sum+(parseFloat(style[name])||0),0);let tallest=0;
      for(const row of rows){
        const button=row.querySelector('.rd-course-name');if(!button?.getClientRects?.().length)continue;
        const rs=root.getComputedStyle(row),bs=root.getComputedStyle(button),top=button.getBoundingClientRect().top;let bottom=top;
        for(const child of button.children){const cs=root.getComputedStyle(child);if(cs.position==='absolute'||!child.getClientRects().length)continue;bottom=Math.max(bottom,child.getBoundingClientRect().bottom+(parseFloat(cs.marginBottom)||0));}
        const content=bottom-top+px(bs,'paddingBottom','borderBottomWidth');
        tallest=Math.max(tallest,rs.boxSizing==='border-box'?content+px(rs,'paddingTop','paddingBottom','borderTopWidth','borderBottomWidth'):content);
      }
      if(!tallest)return false;
      const value=Math.ceil(tallest)+'px';if(value===railRowH)return false;
      container.style.setProperty('--rd-rail-row-h',railRowH=value);return true;
    }
    // After a render settles, record the rail column's page offset on .rd (render
    // never patches its own style) so the course rows can fill the first screen.
    // A hidden host has no boxes and a loading rail is not yet a flex column:
    // neither is measured (a 0 or partial offset would stick); retry briefly.
    function measureRail(tries=0){
      railTimer=0;const rail=container.querySelector('.rd-course-rail');if(destroyed||!rail)return;
      // A rail the layout hides (Course sidebar off, a narrow window, a closed phone drawer) has nothing to fill.
      const display=root.getComputedStyle(rail).display;if(display==='none')return;
      if(!rail.getClientRects().length||display!=='flex'){if(tries<20)railTimer=root.setTimeout(()=>measureRail(tries+1),100);return;}
      // A rewrap (a resize, late fonts) can change the tallest row: the selection surface follows the new rows.
      if(railRows())motion?.syncTabs(false);
      const top=Math.max(0,Math.round(rail.parentElement.getBoundingClientRect().top+(root.scrollY||0)))+'px';
      // Only a real change restyles .rd, so the observer settles instead of looping.
      if(top!==railTop)container.style.setProperty('--rd-rail-top',railTop=top);
      // --rd-status-h: what the page keeps below the shell (the status footer with its
      // margins, then the bottom padding, border and margin of .rd and every box around
      // it), so a short view can end at the fold. No heights of those boxes are read,
      // so the rail height never feeds back into it.
      // While the rail shows, the status line lives in its foot and the footer is visually hidden
      // (position:absolute, refresh.css section 3): then only the padding below the shell counts.
      const status=container.querySelector('.rd-status');if(!status)return;
      const edge=(node,...sides)=>{const style=root.getComputedStyle(node);return sides.reduce((sum,side)=>sum+(parseFloat(style[side])||0),0);};
      let below=root.getComputedStyle(status).position==='absolute'?0:status.getBoundingClientRect().height+edge(status,'marginTop','marginBottom');
      for(let node=container;node?.nodeType===1;node=node.parentElement||node.getRootNode?.()?.host)below+=edge(node,'paddingBottom','borderBottomWidth','marginBottom');
      below=Math.ceil(below)+'px';if(below!==railBelow)container.style.setProperty('--rd-status-h',railBelow=below);
    }

    function readingContent(item){
      if(!item?.description)return {html:'',links:[]};
      if(contentCache.has(item.id))return contentCache.get(item.id);
      const html=U.safeRichHTML(item.description);
      const template=document.createElement('template');template.innerHTML=html;
      const urls=new Set(),links=[];
      for(const anchor of template.content.querySelectorAll('a[href]')){
        try{const url=new URL(anchor.getAttribute('href'));if(url.username||url.password||!['https:','http:'].includes(url.protocol)||urls.has(url.href))continue;urls.add(url.href);links.push({url:url.href,label:anchor.textContent.trim()||url.pathname.split('/').filter(Boolean).pop()||url.hostname});}catch{}
        if(links.length>=12)break;
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
      courseMemory.remember(state.courseId,{...state,limit:visibleLimit,selectedId,readerTab,readerOpen,readerScroll:pending?pending.top:same?content.scrollTop:previous.selectedId===selectedId?previous.readerScroll:0});
    }
    function restoreReaderScroll(){
      if(destroyed||workspace!=='work'||!pendingReaderScroll)return false;
      if(pendingReaderScroll.courseId!==state.courseId||pendingReaderScroll.id!==selectedId){pendingReaderScroll=null;return false;}
      const reader=container.querySelector('.rd-reader-content');
      // First mount may precede stylesheet loading or Canvas revealing the host.
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
    function navigationState(){captureCourseView();return {...courseMemory.recall(state.courseId),workspace,overviewVersion:1,courseViews:courseMemory.serialize(),gradeVisibilityOverride:gradeVisibilityOverride===false?false:undefined};}
    function remember(){
      state=Model.cleanState({...state,limit:visibleLimit});
      try{if(stateKey)root.sessionStorage?.setItem(stateKey,JSON.stringify(navigationState()));}catch{}
    }

    function render({preserveFocus=true,tabMotion=false,motionTarget='',motionKind='workspace',direction=1,snapshot=null}={}){
      if(destroyed)return;
      const oldReader=container.querySelector('.rd-reader-content'),previousCourse=container.dataset.courseId;
      const readerScroll=oldReader?.getClientRects().length?oldReader.scrollTop:courseMemory.recall(previousCourse).readerScroll;
      const oldMaterialPage=container.querySelector('.rd-material-page');if(oldMaterialPage)materials?.rememberPageScroll(oldMaterialPage.dataset.materialCourse,oldMaterialPage.dataset.materialResource,oldMaterialPage.scrollTop);
      const previousSelected=container.querySelector('.rd-reader')?.dataset?.id;
      const disclosures=new Map(Array.from(container.querySelectorAll?.('details[data-rd-section]')||[]).map(el=>[el.dataset.rdSection,el.open]));
      let focus=null;
      if(preserveFocus){
        const active=container.querySelector(':focus');
        if(active?.id==='rd-material-title')focus={materialTitle:true};
        if(active?.tagName==='SUMMARY'&&active.parentElement?.dataset.rdSection)focus={section:active.parentElement.dataset.rdSection};
        if(active?.dataset?.rdField){focus={field:active.dataset.rdField,id:active.dataset.id,step:active.dataset.step,setting:active.dataset.setting,message:active.dataset.message,value:active.value,start:active.selectionStart,end:active.selectionEnd};}
        else if(active?.dataset?.rdAction){focus={action:active.dataset.rdAction,id:active.dataset.id,mode:active.dataset.mode,day:active.dataset.day,accent:active.dataset.accent,tab:active.dataset.tab,resource:active.dataset.resource,course:active.dataset.course,message:active.dataset.message,choice:active.dataset.value,entry:active.dataset.entry};}
        // The control itself: patchUI keeps it, so when it is still the same control and still shown, focus stays on it
        // (siblings that differ only by data-value or data-entry, like All | Unread or two Read more buttons, never trade places).
        if(focus&&!focus.materialTitle&&!focus.section)focus.node=active;
      }
      const ctx=buildContext();
      container.dataset.theme=ctx.theme;
      container.dataset.density=ctx.s.density==='compact'?'compact':'comfortable';
      container.dataset.font=['humanist','serif'].includes(ctx.s.font)?ctx.s.font:'system';
      container.dataset.textSize=ctx.s.textSize||'standard';
      container.dataset.layout=ctx.s.deskOrder==='stacked'?'list':'split';
      for(const key of Object.keys(root.ReserveCustomization.defaults))container.dataset[key]=String(ctx.s[key]??root.ReserveCustomization.defaults[key]);
      // Gentle (default), Still or Off; motion.js also treats a reduced-motion device as Off.
      container.dataset.motionStyle=MOTION_STYLES.includes(ctx.s.motion)?ctx.s.motion:'gentle';
      // Living drawings (default On): the course drawings keep moving once drawn (Gentle only).
      container.dataset.livingArt=ctx.s.livingArt==='off'?'off':'on';
      // Teacher text, announcements and messages: the book serif (default) or the interface sans.
      container.dataset.readingFont=ctx.s.readingFont==='interface'?'interface':'book';
      container.dataset.readerOpen=String(readerOpen);
      container.dataset.courses=String(ctx.s.showCourseStrip!==false);
      container.style.setProperty('--rd-accent',ctx.accent);
      const assignmentContent=readingContent(ctx.selected);
      const markup=View.render({...ctx,state,workspace,gradeQuery,gradeLimit,deckHeader:workspace==='work'?hub?.renderDeckHeader?.(ctx.deckCourse)||'':'',deckContent:workspace==='work'?hub?.renderDeck?.(ctx.deckCourse,{header:false})||'':'',hubContent:workspace==='hub'?hub?.renderHub(ctx.courseMap.get(state.courseId)):workspace==='inbox'?hub?.renderInbox(ctx.courses):'',materialLibrary:workspace==='materials'?materials?.renderLibrary(ctx.courseMap.get(state.courseId)):'',relatedMaterials:materials?.renderRelated(ctx.selected,assignmentContent.links)||'',readerTab,customizeOpen,customizeCourseId,customizeStatus,customizeBusy,customizeDrafts,user:currentSnapshot.user,demo,nativeSwitch:typeof onNative==='function',refreshing,visibleLimit,noteStatus:drafts.has(`notes:${ctx.selected?.id}`)?transientStatus.startsWith('Could not save:')?'Not saved. Retry above.':'Saving note…':ctx.local[ctx.selected?.id]?.notes?'Note saved on this device.':'Notes save automatically.',readerContent:assignmentContent,warning:renderWarning(),status:statusLabel(currentSnapshot,externalStatus,transientStatus)}, {E,icon,assignmentLink,formatDate,dueText,scoreText,gradePeriodLabel,dayKey,complete});
      const toolbar=container.querySelector('.rd-toolbar'),appearance=container.querySelector('.rd-appearance');
      if(toolbar&&appearance){
        // Keep the actual transitioning nodes connected through data renders.
        const template=document.createElement('template');template.innerHTML=markup;
        const nextToolbar=template.content.querySelector('.rd-toolbar'),nextAppearance=template.content.querySelector('.rd-appearance');
        const shell=container.querySelector('.rd-shell'),nextShell=template.content.querySelector('.rd-shell');
        if(shell&&nextShell){
          const workspaceNode=shell.querySelector('.rd-workspace'),nextWorkspace=nextShell.querySelector('.rd-workspace');
          patchUI(workspaceNode,nextWorkspace);
          const rail=shell.querySelector('.rd-course-rail'),nextRail=nextShell.querySelector('.rd-course-rail');
          if(rail&&nextRail)patchUI(rail,nextRail);else if(nextRail)shell.prepend(nextRail);else rail?.remove();
          nextShell.remove();
        }
        // Stable controls retain focus and let the grade switch finish its tween.
        const tools=toolbar.querySelector('.rd-tools');
        tools.querySelector('[data-setting="showGrades"]').checked=ctx.s.showGrades===true;
        tools.querySelector('[data-rd-action="settings"]').setAttribute('aria-expanded',String(customizeOpen));
        // While syncing, the refresh glyph gives way to the dotted ring (CSS on aria-busy).
        {const refreshButton=tools.querySelector('[data-rd-action="refresh"]');for(const name of ['aria-disabled','aria-busy'])if(refreshing)refreshButton.setAttribute(name,'true');else refreshButton.removeAttribute(name);}
        // Messages carries a muted unread numeral; the phone drawer button mirrors the drawer.
        {const unread=ctx.unread||0,badge=toolbar.querySelector('[data-rd-unread]'),said=toolbar.querySelector('[data-rd-unread-sr]');if(badge){badge.textContent=unread?String(unread):'';badge.hidden=!unread;}if(said)said.textContent=unread?`, ${unread} unread`:'';
         toolbar.querySelector('.rd-drawer-button')?.setAttribute('aria-expanded',String(container.dataset.drawer==='open'));
         // The command bar's search belongs to Assignments; it keeps the list's query (typed here or in the heading's copy).
         {const bar=toolbar.querySelector('.rd-bar-search'),field=bar?.querySelector('input');if(bar)bar.hidden=workspace!=='work';if(field&&field.value!==state.query)field.value=state.query;}
         // The phone reader sheet (refresh.css section 16) covers Canvas's chrome, as the dock does.
         container.getRootNode?.()?.host?.toggleAttribute?.('data-reserve-sheet',readerOpen&&workspace==='work');}
        nextToolbar.remove();
        for(const tab of toolbar.querySelectorAll('.t-tab')){const active=tab.dataset.tab===workspace;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
        patchUI(appearance.querySelector('.t-acc-panel-inner'),nextAppearance.querySelector('.t-acc-panel-inner'));
        nextAppearance.remove();
        for(const node of Array.from(container.childNodes)){if(node!==toolbar&&node!==appearance&&node!==shell&&!node.classList?.contains('rd-utility-dialog'))node.remove();}
        if(shell)for(const warning of Array.from(template.content.querySelectorAll('.rd-warning')))container.insertBefore(warning,shell);
        container.append(template.content);
      }else container.innerHTML=markup;
      container.dataset.courseId=state.courseId;container.dataset.workspace=workspace;
      settingsDock?.sync();
      sheetCover();railRows();
      toolbox?.update();syncFocus();
      motion?.syncTabs(tabMotion,false,snapshot);
      if(motionTarget)motion?.reveal(container.querySelector(motionTarget),{animate:tabMotion&&container.dataset.input==='pointer',kind:motionKind,direction,snapshot});
      for(const draft of drafts.values()){const field=container.querySelector(`[data-rd-field="${draft.field}"][data-id="${draft.id}"]`);if(field)field.value=draft.value;}
      for(const [id,value] of stepDrafts){const field=container.querySelector(`[data-rd-field="new-step"][data-id="${id}"]`);if(field)field.value=value;}
      for(const el of container.querySelectorAll?.('details[data-rd-section]')||[]){if(disclosures.has(el.dataset.rdSection))el.open=disclosures.get(el.dataset.rdSection);}
      const reader=container.querySelector('.rd-reader-content'),remembered=courseMemory.recall(state.courseId);
      if(workspace==='work'){
        const top=pendingReaderScroll?.courseId===state.courseId&&pendingReaderScroll.id===ctx.selected?.id?pendingReaderScroll.top:previousCourse===state.courseId&&previousSelected===ctx.selected?.id?readerScroll:remembered.selectedId===ctx.selected?.id?remembered.readerScroll:0;
        pendingReaderScroll=ctx.selected?{courseId:state.courseId,id:ctx.selected.id,top}:null;
        readerLayout?.disconnect();
        if(!restoreReaderScroll()&&reader&&pendingReaderScroll)readerLayout?.observe(reader);
      }
      remember();
      // Defer only secondary sources so assignments paint immediately. Mark the
      // target first: source notifications may synchronously rerender the shell.
      const deckId=workspace==='work'?ctx.deckCourse?.id||'':'';
      if(deckId!==deckCourseRequested){
        deckCourseRequested=deckId;
        if(deckId)Promise.resolve().then(()=>{if(!destroyed&&workspace==='work'&&deckCourseRequested===deckId)hub?.loadDeck?.(deckId);});
      }
      if(focus?.section){Array.from(container.querySelectorAll?.('details[data-rd-section]')||[]).find(el=>el.dataset.rdSection===focus.section)?.querySelector('summary')?.focus({preventScroll:true});}
      if(focus&&!focus.materialTitle&&!focus.section){
        const selector=(focus.field?`[data-rd-field="${focus.field}"]`:`[data-rd-action="${focus.action}"]`)+`${focus.id?`[data-id="${focus.id}"]`:''}${focus.setting?`[data-setting="${focus.setting}"]`:''}${focus.mode?`[data-mode="${focus.mode}"]`:''}${focus.day?`[data-day="${focus.day}"]`:''}${focus.accent?`[data-accent="${focus.accent}"]`:''}${focus.tab?`[data-tab="${focus.tab}"]`:''}${focus.choice!=null?`[data-value=${JSON.stringify(String(focus.choice))}]`:''}${focus.entry!=null?`[data-entry=${JSON.stringify(String(focus.entry))}]`:''}`;
        const kept=focus.node,same=kept?.isConnected!==false&&!!kept?.getClientRects?.().length&&(focus.field?kept.dataset?.rdField===focus.field:kept.dataset?.rdAction===focus.action)&&[['id','id'],['setting','setting'],['mode','mode'],['day','day'],['accent','accent'],['tab','tab'],['value','choice'],['entry','entry'],['step','step'],['message','message'],['resource','resource'],['course','course']].every(([key,was])=>(kept.dataset?.[key]??null)===(focus[was]??null));
        const active=same?kept:focus.step||focus.resource||focus.message?Array.from(container.querySelectorAll?.(selector)||[]).find(el=>focus.message?el.dataset.message===focus.message:focus.step?el.dataset.step===focus.step:el.dataset.resource===focus.resource&&el.dataset.course===focus.course):(matches=>matches.find(el=>el.getClientRects?.().length)||container.querySelector(selector))(Array.from(container.querySelectorAll?.(selector)||[]));
        if(active){if(focus.field==='new-step')active.value=focus.value;active.focus({preventScroll:true});if(typeof active.setSelectionRange==='function'&&focus.start!=null)active.setSelectionRange(focus.start,focus.end);}
      }
      const materialPage=container.querySelector('.rd-material-page');if(materialPage)materialPage.scrollTop=materials?.pageScroll(materialPage.dataset.materialCourse,materialPage.dataset.materialResource)||0;
      const requested=materials?.takeFocusRequest();let materialFocus;
      if(requested?.type==='title'||focus?.materialTitle)materialFocus=container.querySelector('#rd-material-title');
      if(requested?.type==='resource')materialFocus=Array.from(container.querySelectorAll?.('[data-rd-action="material-read"]')||[]).find(el=>el.dataset.resource===requested.id&&el.dataset.course===requested.courseId)||container.querySelector('[data-rd-field="material-query"]');
      // Teacher-material lists (Materials, the Course hub and its deck copy): a chapter link lands on its
      // chapter's head, "Show all" on the first item it revealed, "Show fewer" back on its own control.
      const hubRequest=hub?.takeFocusRequest?.(),list=['chapter','row','more'].includes(requested?.type)?requested:hubRequest;
      if(list?.type==='chapter')materialFocus=Array.from(container.querySelectorAll?.('.rd-chapter-head[data-chapter]')||[]).find(el=>el.dataset.chapter===list.id&&el.dataset.course===list.courseId);
      if(list?.type==='row')materialFocus=Array.from(container.querySelectorAll?.('[data-rd-row]')||[]).find(el=>el.dataset.rdRow===list.id)?.querySelector?.('.rd-row-open');
      if(list?.type==='more')materialFocus=Array.from(container.querySelectorAll?.(`[data-rd-action="${list.action}"]`)||[]).find(el=>(el.dataset.resource??el.dataset.entry)===list.id&&el.dataset.course===list.courseId);
      if(materialFocus){materialFocus.focus({preventScroll:true});if(requested?.type==='title'&&root.innerWidth<=1200)materialFocus.scrollIntoView({block:'start',behavior:'instant'});
        // The page glides to a chapter only for a pointer under Gentle motion; keyboard, Still, Off and reduced motion jump at once.
        if(list?.type==='chapter')materialFocus.scrollIntoView({block:'start',behavior:container.dataset.input==='pointer'&&container.dataset.motionStyle==='gentle'&&!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'smooth':'instant'});
        if(list?.type==='more')materialFocus.scrollIntoView({block:'nearest',behavior:'instant'});}
    }

    function updateFreshness(){
      if(destroyed||document.visibilityState==='hidden'||!container.getClientRects?.().length)return;
      // Calendar boundaries and countdowns advance while the page stays open.
      render();
    }

    // A planner focus session keeps counting on the Planner button. The toolbar
    // is never re-rendered, so only the clock's text changes each second; the
    // session ends here through the planner's own rule (ReserveCore.settleFocus).
    function syncFocus(){
      if(destroyed)return;const f=personal.focus,now=Date.now(),running=!!f?.endsAt,note='Focus session complete. Take a moment to breathe.';
      if(!running&&focusDoneUntil&&now>=focusDoneUntil){focusDoneUntil=0;if(transientStatus===note){transientStatus='';render();return;}}
      const text=running?C.focusClock?.(f,now)||'':focusDoneUntil?'Done':'',clock=container.querySelector('[data-rd-focus-clock]');
      if(clock&&clock.textContent!==text){clock.textContent=text;clock.hidden=!text;clock.parentElement?.setAttribute('aria-label',running?'Planner, focus session running':'Planner');}
      if(running&&now>=f.endsAt&&!focusSettling&&C.settleFocus){
        focusSettling=true;let settled=false;const ended=f.endsAt;
        // A session that ended long before this page opened is recorded quietly.
        store.update(data=>{settled=C.settleFocus(data,Date.now());}).then(()=>{if(settled&&!destroyed&&Date.now()-ended<60000){focusDoneUntil=Date.now()+8000;if(!transientStatus){transientStatus=note;render();}else syncFocus();}}).catch(()=>{}).finally(()=>{focusSettling=false;});
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
        if(result&&Array.isArray(result.courses)&&Array.isArray(result.assignments)){currentSnapshot=result;normalizedCache=null;contentCache.clear();}
        transientStatus='';
      }catch(error){
        transientStatus=`Refresh failed${error?.message?`: ${error.message}`:''}`;
        if(reportError)throw error;
      }finally{
        refreshing=false;
        render();
      }
    }

    function onInput(event){
      const field=event.target?.dataset?.rdField;
      if(field==='art-source'){const {course,kind}=event.target.dataset;if(validArtTarget(course)&&['banner','icon','border'].includes(kind))customizeDrafts[course+':'+kind]=event.target.value.slice(0,262144);return;}
      if(field?.startsWith('hub-')){hub?.input(field,field==='hub-unread'?event.target.checked:event.target.value,event.target.dataset);return;}
      if(field?.startsWith('material-')){materials?.input(field,event.target.value);return;}
      if(field==='new-step'&&/^(?:\d+|local-[\w-]+)$/.test(event.target.dataset.id||'')){stepDrafts.set(event.target.dataset.id,event.target.value.slice(0,300));return;}
      if(field==='overview-query'){overviewQuery=event.target.value.slice(0,200);render();return;}
      if(field==='grade-query'){gradeQuery=event.target.value.slice(0,200);gradeLimit=40;render();return;}
      if(field!=='query'){
        if(stageDraft(event.target)){if(field==='notes'){const label=container.querySelector('[data-rd-note-status]');if(label)label.textContent='Saving note…';}clearTimeout(draftTimer);draftTimer=setTimeout(flushDrafts,350);}
        return;
      }
      readerOpen=false;state.query=event.target.value.slice(0,200);
      visibleLimit=60;
      render({preserveFocus:true});
    }

    function onChange(event){
      const field=event.target?.dataset?.rdField;
      const id=event.target?.dataset?.id;
      if(/^local-[\w-]+$/.test(id||'')&&['progress','check-step','personal-name','personal-due','planned-date','estimate','notes'].includes(field)){selectedId=id;readerOpen=true;}
      if(field?.startsWith('hub-')){hub?.input(field,field==='hub-unread'?event.target.checked:event.target.value,event.target.dataset);return;}
      if(field?.startsWith('material-')){materials?.input(field,event.target.value);return;}
      if(field==='customize-course'){customizeCourseId=event.target.value;customizeStatus='';if(switchCourse(customizeCourseId)){if(workspace==='inbox')hub?.setCourse?.(state.courseId);materials?.activate(state.courseId);}render();if(workspace==='materials')materials?.load(state.courseId);if(workspace==='hub')hub?.loadCourse(state.courseId);return;}
      if(field==='art-upload'){uploadArtwork(event.target);return;}
      if(field==='art-setting'){
        const key=event.target.dataset.setting,value=event.target.value;
        if(['bannerFit','bannerPosition'].includes(key)&&validArtTarget(id))savePersonal(data=>{appearanceFor(data,id)[key]=value;});return;
      }
      if(field==='setting'){
        const key=event.target.dataset.setting;
        if(!['theme','accent','motion','livingArt','readingFont','greeting','font','density','textSize','dashboardLayout','showCourseStrip','showGrades','showRecentGrades',...Object.keys(root.ReserveCustomization.defaults)].includes(key))return;
        const value=event.target.type==='checkbox'?event.target.checked:event.target.value;
        if(key==='showGrades'){
          const version=++gradeSaveVersion;gradeVisibilityOverride=value===true;motion?.cancel();render();
          savePersonal(data=>{data.settings.showGrades=value===true;}).then(saved=>{if(version===gradeSaveVersion){if(saved)gradeVisibilityOverride=null;render();}});return;
        }
        savePersonal(data=>{data.settings[key]=value;});return;
      }
      if(/^(?:\d+|local-[\w-]+)$/.test(id||'')){
        if(['course-name','planned-date','estimate','notes','personal-name','personal-due'].includes(field)){const draft=stageDraft(event.target);if(draft)persistDraft(draft);return;}
        if(field==='course-color'&&/^\d+$/.test(id)){const value=event.target.value;savePersonal(data=>{const prefs=data.settings.coursePrefs||(data.settings.coursePrefs={});prefs[id]={...prefs[id],color:value};});return;}
        if(field==='course-visible'&&/^\d+$/.test(id)){const checked=event.target.checked;savePersonal(data=>{C.setCourseVisible(data.settings,id,checked);});return;}
        if(['progress','check-step'].includes(field)){
          const value=event.target.value,checked=event.target.checked,step=event.target.dataset.step;
          savePersonal(data=>{const task=data.tasks[id]||(data.tasks[id]={});if(field==='progress'){task.progress=value;if(value!=='done')task.checkedOff=false;}if(field==='check-step'){const entry=task.checklist?.find(x=>x.id===step);if(entry)entry.done=checked;}});return;
        }
      }
      // A pointer-chosen course (heading select, rail hidden) reads its snapshot before the switch.
      const snapshot=field==='course'&&container.dataset.input==='pointer'?motion?.snapshot?.(event.target)||null:null;
      if(field==='course'){switchCourse(event.target.value);if(workspace==='inbox')hub?.setCourse?.(state.courseId);}
      if(field==='mode'){readerOpen=false;state.mode=event.target.value;state.day='';visibleLimit=60;}
      // Keyboard select changes stay immediate.
      if(field==='course'||field==='mode'){render(snapshot?{tabMotion:true,motionTarget:'.rd-workspace',motionKind:'course',snapshot}:{});if(field==='course'){materials?.activate(state.courseId);if(workspace==='materials')materials?.load(state.courseId);if(workspace==='hub')hub?.loadCourse(state.courseId);}}
    }

    let tabAt=0;   // when Tab was last pressed (onKeydown): a focus loss right after it is the student tabbing on
    function onFocusout(event){
      // Some input methods report input and blur without a change event.
      if(['course-name','estimate','planned-date','notes','personal-name','personal-due'].includes(event.target?.dataset?.rdField))onChange(event);
      onHeaderFocusout(event);
      // Phones: Tab or Shift+Tab out of the open drawer closes it (it is non-modal), so focus never sits
      // under its scrim. Only a real destination counts: a lost window focus (no relatedTarget) keeps it open.
      const next=event.relatedTarget;
      if(next&&drawerOpen()&&event.target?.closest?.('.rd-course-rail')&&!container.querySelector('.rd-course-rail')?.contains?.(next)&&!next.closest?.('.rd-drawer-button'))setDrawer(false,{focus:false});
      // The reader sheet makes the Canvas Harness parts it covers inert, but Tab past its last control leaves Canvas Harness for the
      // page around it (Canvas's own links, which the sheet may cover) or for the browser: that closes the sheet, and
      // focus stays where Tab put it. Without a destination only a Tab counts (a lost window focus keeps it open).
      else if(readerOpen&&workspace==='work'&&phone()&&event.target?.closest?.('.rd-reader')&&(next?!container.contains?.(next):Date.now()-tabAt<400)){readerOpen=false;render({preserveFocus:false});}
    }

    function stageDraft(target){
      const field=target?.dataset?.rdField,id=target?.dataset?.id;
      if(!['course-name','planned-date','estimate','notes','personal-name','personal-due'].includes(field)||!/^(?:\d+|local-[\w-]+)$/.test(id||''))return null;
      if(field==='course-name'&&!/^\d+$/.test(id))return null;
      if(field.startsWith('personal-')&&!personal.customTasks?.some(x=>x.id===id))return null;
      const value=String(target.value||'').slice(0,field==='notes'?20000:field==='course-name'?100:field==='personal-name'?200:30),key=`${field}:${id}`,previous=drafts.get(key);
      if(previous?.value===value)return previous;
      const task=personal.tasks?.[id]||{},reminder=personal.customTasks?.find(x=>x.id===id),current=field==='personal-name'?reminder?.name:field==='personal-due'?reminder?.dueAt:field==='course-name'?personal.settings?.coursePrefs?.[id]?.name:field==='planned-date'?task.plannedDate:field==='notes'?task.notes:task.estimate;
      let unchanged=field==='estimate'?(current||0)===Math.min(1440,Math.max(0,Number(value)||0)):(current||'')===value;
      if(field==='personal-due'){try{unchanged=(current||null)===(value?U.wallTimeToISO(value,settings().timeZone||'America/New_York'):null);}catch{unchanged=false;}}
      if(!previous&&unchanged)return null;
      const draft={field,id,value,key,pending:null};drafts.set(key,draft);return draft;
    }

    function persistDraft(draft){
      if(draft.pending)return draft.pending;
      const {field,id,value}=draft;
      draft.pending=savePersonal(data=>{
        if(field==='personal-name'||field==='personal-due'){const reminder=data.customTasks.find(x=>x.id===id);if(!reminder)throw Error('This reminder is no longer available.');if(field==='personal-name'){if(!value.trim())throw Error('Give the reminder a title.');reminder.name=value.trim();}else reminder.dueAt=value?U.wallTimeToISO(value,settings().timeZone||'America/New_York'):null;return;}
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
      const saved=await savePersonal(data=>{const task=data.tasks[id]||(data.tasks[id]={});const steps=task.checklist||(task.checklist=[]);steps.push({id:root.crypto?.randomUUID?.()||`step-${Date.now()}-${steps.length}`,text,done:false});});
      const next=container.querySelector(`[data-rd-field="new-step"][data-id="${id}"]`);if(saved){stepDrafts.delete(id);if(next){next.value='';next.focus();}}
    }

    function showPreview(id,event,snapshot=null){
      const ctx=buildContext(),item=ctx.items.find(x=>x.id===String(id));
      if(!item)return;
      if(selectedId===String(id)&&readerOpen&&container.dataset.workspace==='work')return;
      if(!ctx.filtered.items.some(x=>x.id===item.id)){state.query='';state.day='';state.mode=C.isWorkComplete(item,personal.tasks?.[item.id])?'completed':item.personal&&personal.tasks?.[item.id]?.plannedDate===dayKey(Date.now(),settings().timeZone)?'planned':item.dueAt?'dated':'undated';}
      selectedId=String(id);readerOpen=true;readerTab=item.personal?'plan':'details';
      render({tabMotion:event.detail>0,motionTarget:'.rd-reader-content',motionKind:'reader',snapshot});
      const panel=container.querySelector('.rd-reader'),rect=panel?.getBoundingClientRect?.();
      // A desktop preview stays beside the list. Only reveal an offscreen pane.
      if(rect&&(rect.top<0||rect.top>root.innerHeight-100))panel.scrollIntoView({block:'start',behavior:'instant'});
      if(!event.detail)container.querySelector('#rd-reader-title')?.focus({preventScroll:true});
    }

    async function checkOff(id,done,event,snapshot=null){
      const item=buildContext().items.find(item=>item.id===id);
      if(!item||checkingOff.has(id))return;
      checkingOff.add(id);checkOffNotice=null;
      // A pointer check-off that removes the row plays its exit first, because
      // the store update re-renders the list synchronously.
      const ctx=buildContext();
      const leaves=done&&!Model.filterAssignments(ctx.items,{...state,now:ctx.now,timeZone:ctx.s.timeZone,local:{...ctx.local,[id]:{...ctx.local[id],checkedOff:true}}}).items.some(x=>x.id===id);
      const exit=leaves&&event.detail>0&&container.dataset.input==='pointer'?motion?.leave?.(container.querySelector(`.rd-assignment[data-preview-id="${id}"]`)):null;
      // The row that slides up under a resting cursor must not show a hover tick it never earned.
      if(exit)container.dataset.hoverHold='true';
      if(exit)await exit.finished;
      const saved=await savePersonal(data=>{data.tasks[id]={...data.tasks[id],checkedOff:done};});
      checkingOff.delete(id);
      if(!saved||destroyed){exit?.cancel();return;}
      checkOffNotice=done?{id,name:item.name}:null;
      // A departed row already closed its gap; a row that stays or returns
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
      const trigger=container.querySelector('.rd-drawer-button'),within=container.querySelector('.rd-course-rail')?.contains?.(container.getRootNode?.()?.activeElement);
      if(open)container.dataset.drawer='open';else delete container.dataset.drawer;
      trigger?.setAttribute('aria-expanded',String(open));
      // Like the Tools dock, the open drawer lifts the host's paint isolation so it covers Canvas's own chrome.
      container.getRootNode?.()?.host?.toggleAttribute?.('data-reserve-drawer',open);
      if(focus&&open)container.querySelector('.rd-drawer-close')?.focus({preventScroll:true});
      else if(focus&&(within||!container.contains?.(container.getRootNode?.()?.activeElement)))trigger?.focus({preventScroll:true});
    }
    // Back to the list: on a phone this closes the reader sheet; focus returns to the row it came from.
    function closePreview(){readerOpen=false;render();const previous=container.querySelector(`[data-rd-action="preview"][data-id="${selectedId}"]`);previous?.scrollIntoView({block:'nearest',behavior:'instant'});previous?.focus({preventScroll:true});}

    function onClick(event){
      const button=event.target.closest?.('[data-rd-action]');
      // FIRST for pointer motion: a read-only snapshot of what is painted, taken
      // before any state changes and handed to render. Keyboard clicks (detail 0) take none.
      const take=()=>event.detail>0?motion?.snapshot?.(event.target)||null:null;
      // Phones: the rail is a drawer. A click outside it (on the scrim) only closes it; a pick
      // inside closes it too and hands focus back to its trigger, never to a hidden tab.
      if(drawerOpen()){
        const inside=event.target.closest?.('.rd-course-rail');
        if(!inside&&!event.target.closest?.('.rd-drawer-button')){setDrawer(false);return;}
        if(inside&&['course','workspace','planner'].includes(button?.dataset?.rdAction)){setDrawer(false,{focus:false});Promise.resolve().then(()=>{if(!destroyed&&button.dataset.rdAction!=='planner')container.querySelector('.rd-drawer-button')?.focus({preventScroll:true});});}
      }
      if(!button){
        const row=event.target.closest?.('[data-preview-id]');
        if(row&&!event.target.closest?.('a,button,input,select,textarea,label,summary')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&!(event.button>0)&&!root.getSelection?.()?.toString())showPreview(row.dataset.previewId,event,take());
        return;
      }
      // Busy controls use aria-disabled so they keep keyboard focus while loading.
      if(!button||button.disabled||button.getAttribute?.('aria-disabled')==='true')return;
      const action=button.dataset.rdAction,snapshot=MOTION_ACTIONS.has(action)?take():null;
      if(handleCustomizeAction(action,button))return;
      if(action==='drawer'){setDrawer(!button.dataset.close&&container.dataset.drawer!=='open');return;}
      // Grades' inline "Show grades" runs the same path as the toolbar switch.
      if(action==='grades-visibility'){const value=settings().showGrades!==true,version=++gradeSaveVersion;gradeVisibilityOverride=value;motion?.cancel();render();savePersonal(data=>{data.settings.showGrades=value;}).then(saved=>{if(version===gradeSaveVersion){if(saved)gradeVisibilityOverride=null;render();}});return;}
      if(action.startsWith('hub-')){hub?.handle(action,button.dataset);return;}
      if(action.startsWith('material-')){materials?.handle(action,button.dataset);return;}
      if(action==='check-off'||action==='undo-check-off'){checkOff(String(button.dataset.id),action==='check-off',event,snapshot);return;}
      if(action==='overview-view'){overviewMode=button.dataset.mode==='completed'?'completed':'actionable';render({tabMotion:event.detail>0,motionTarget:'.rd-overview-work',motionKind:'filter',snapshot});return;}
      if(action==='overview-all'){captureCourseView();switchCourse('all');workspace='work';state.mode=overviewMode;state.query=overviewQuery;state.day='';readerOpen=false;render({tabMotion:event.detail>0,motionTarget:'.rd-workspace',snapshot});return;}
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
        if(rect&&(rect.top<0||rect.top>root.innerHeight-100))heading.scrollIntoView({block:'start',behavior:'instant'});return;
      }
      if(action==='workspace'||action==='open-materials'||action==='open-hub'){
        const tabMotion=event.detail>0;
        const nextWorkspace=action==='open-materials'?'materials':action==='open-hub'?'hub':['materials','hub','inbox','grades'].includes(button.dataset.tab)?button.dataset.tab:'work';
        if(action==='workspace'&&workspace===nextWorkspace)return;
        const order=['home','work','hub','materials','inbox','grades'],direction=order.indexOf(nextWorkspace)>=order.indexOf(workspace)?1:-1;
        captureCourseView();workspace=nextWorkspace;
        if(workspace==='inbox')hub?.setCourse?.('all');
        if(workspace==='materials'||workspace==='hub'){
          const ctx=buildContext();switchCourse(button.dataset.id||(state.courseId==='all'?String(ctx.selected?.courseId||ctx.courses[0]?.id||'all'):state.courseId));
          materials?.activate(state.courseId);render({tabMotion,motionTarget:'.rd-workspace',direction,snapshot});if(workspace==='materials')materials?.load(state.courseId);else hub?.loadCourse(state.courseId);
        }else{render({tabMotion,motionTarget:'.rd-workspace',direction,snapshot});if(workspace==='inbox')hub?.loadInbox();}
        if(action!=='workspace'||!button.classList?.contains('rd-workspace-tab')){container.querySelector('.rd-workspace-tab[aria-selected="true"]')?.focus({preventScroll:true});container.querySelector('.rd-page-heading')?.scrollIntoView({block:'nearest',behavior:'instant'});}

        return;
      }
      if(action==='capture'){toolbox?.open('plan',button);return;}
      if(action==='toolbox'){toolbox?.open(undefined,button);return;}
      if(action==='native'){if(drawerOpen())setDrawer(false,{focus:false});onNative?.();return;}
      if(action==='retry-save'){flushDrafts();return;}
      if(action==='add-step'){addStep(button.dataset.id);return;}
      if(action==='remove-step'){const id=button.dataset.id,step=button.dataset.step;if(/^(?:\d+|local-[\w-]+)$/.test(id||''))savePersonal(data=>{const task=data.tasks[id];if(task)task.checklist=(task.checklist||[]).filter(x=>x.id!==step);});return;}
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
      if(action==='accent'){const accent=button.dataset.accent;if(Object.hasOwn(ACCENTS,accent))savePersonal(data=>{data.settings.accent=accent;});return;}
      if(action==='advanced-settings'){openPlanner({page:'settings'});return;}
      if(action==='grades'){workspace='grades';render({tabMotion:event.detail>0,motionTarget:'.rd-workspace',snapshot});return;}
      if(action==='more-grades'){gradeLimit+=40;render();return;}
      if(action==='course'){
        // The snapshot only reads, so an early return needs no undo.
        if(!switchCourse(button.dataset.id))return;if(state.courseId==='all'&&!['home','grades','inbox'].includes(workspace))workspace='work';if(workspace==='inbox')hub?.setCourse?.(state.courseId);materials?.activate(state.courseId);render({tabMotion:event.detail>0,motionTarget:'.rd-workspace',motionKind:'course',snapshot});
        // A switch from deep in a long list starts the new course at its heading.
        const heading=container.querySelector('.rd-workspace-heading, .rd-page-heading, .rd-materials-header');if(heading&&heading.getBoundingClientRect().top<0)heading.scrollIntoView({block:'start',behavior:'instant'});
        if(workspace==='materials')materials?.load(state.courseId);if(workspace==='hub')hub?.loadCourse(state.courseId);return;}
      if(action==='reader-tab'){const next=button.dataset.tab==='plan'?'plan':'details';if(readerTab===next)return;readerTab=next;render({tabMotion:event.detail>0,motionTarget:'.rd-reader-body',motionKind:'section',direction:next==='plan'?1:-1,snapshot});return;}
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
        const theme=effectiveTheme(settings())==='dark'?'light':'dark';
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
        savePersonal(data=>{data.tasks[id]={...data.tasks[id],pinned:!data.tasks[id]?.pinned};});return;
      }
      if(action==='reset'){captureCourseView();state=Model.cleanState({});selectedId=null;readerTab='details';readerOpen=false;pendingReaderScroll=null;visibleLimit=60;render();return;}
      if(action==='glance'){
        // A summary chip filters to its view; choosing it again returns to Up next.
        const mode=['overdue','today','tomorrow'].includes(button.dataset.mode)?button.dataset.mode:'actionable';
        readerOpen=false;state.mode=state.mode===mode&&!state.day?'actionable':mode;state.day='';visibleLimit=60;
        render({tabMotion:event.detail>0,motionTarget:'.rd-work',motionKind:'filter',snapshot});return;
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

    function validArtTarget(id){return id==='all'||/^\d+$/.test(id||'')&&normalizeData(settings()).allCourses.some(c=>c.id===id);}
    function appearanceFor(data,id){return id==='all'?(data.settings.overviewArt||(data.settings.overviewArt={})):((data.settings.coursePrefs||(data.settings.coursePrefs={}))[id]||(data.settings.coursePrefs[id]={}));}
    async function uploadArtwork(input){
      const file=input.files?.[0],id=input.dataset.id,kind=input.dataset.kind;
      if(!file||customizeBusy||!validArtTarget(id)||!['banner','border','icon'].includes(kind))return;
      customizeBusy=true;customizeStatus='Checking artwork…';render();
      try{
        if(file.size>root.ReserveCustomArt.limits.fileBytes)throw Error('Choose an SVG smaller than 256 KiB.');
        const asset=root.ReserveCustomArt.importSVG(await file.text(),file.name);
        if(destroyed)return;
        const saved=await savePersonal(data=>{appearanceFor(data,id)[kind+'Art']=asset;});
        customizeStatus=saved?'Artwork saved. The page has updated.':transientStatus;
      }catch(error){customizeStatus=error?.message||'This SVG could not be loaded.';}
      finally{customizeBusy=false;if(!destroyed)render();}
    }
    function handleCustomizeAction(action,button){
      const id=button.dataset.id,kind=button.dataset.kind;
      if(action==='art-paste'&&validArtTarget(id)&&['banner','icon','border'].includes(kind)){
        if(customizeBusy)return true;
        try{const asset=root.ReserveCustomArt.importSVG(customizeDrafts[id+':'+kind]||'','Pasted '+kind+'.svg');customizeBusy=true;customizeStatus='Saving artwork…';render();savePersonal(data=>{appearanceFor(data,id)[kind+'Art']=asset;}).then(saved=>{customizeBusy=false;customizeStatus=saved?'Artwork saved. The page has updated.':transientStatus;if(saved)delete customizeDrafts[id+':'+kind];if(!destroyed)render();});}
        catch(error){customizeStatus=error.message;render();}return true;
      }
      if(action==='art-template'){
        if(!['banner','icon','border'].includes(kind))return true;
        const url=URL.createObjectURL(new Blob([root.ReserveCustomArt.template(kind)],{type:'image/svg+xml'}));
        const a=document.createElement('a');a.href=url;a.download='canvas-harness-'+kind+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
      }
      if(action==='art-remove'&&(validArtTarget(id)||/^\d+$/.test(id||'')&&Object.hasOwn(personal.settings.coursePrefs||{},id))&&['banner','border','icon'].includes(kind)){
        customizeStatus='Custom artwork removed.';savePersonal(data=>{delete appearanceFor(data,id)[kind+'Art'];});return true;
      }
      if(action==='course-reset'&&validArtTarget(id)){
        customizeStatus='Appearance reset. Work and bookmarks are unchanged.';
        savePersonal(data=>{if(id==='all')data.settings.overviewArt={};else delete data.settings.coursePrefs[id];});return true;
      }
      if(action==='layout-preset'||action==='layout-reset'){
        const preset=action==='layout-reset'?root.ReserveCustomization.defaults:root.ReserveCustomization.presets[button.dataset.value];
        if(preset)savePersonal(data=>{Object.assign(data.settings,preset);data.settings.dashboardLayout=preset.deskOrder==='stacked'?'list':'split';});return true;
      }
      if(action==='course-up'||action==='course-down'){
        const order=normalizeData(settings()).allCourses.map(c=>c.id),from=order.indexOf(id),to=from+(action==='course-up'?-1:1);
        if(from>=0&&to>=0&&to<order.length){[order[from],order[to]]=[order[to],order[from]];savePersonal(data=>{data.settings.courseOrder=order;});}return true;
      }
      return false;
    }

    async function savePersonal(change){
      try{await store.update(change);if(!drafts.size&&transientStatus.startsWith('Could not save:')){transientStatus='';render();}return true;}
      catch(error){transientStatus=`Could not save: ${error?.message||'Please try again.'}`;render();return false;}
    }

    function onKeydown(event){
      if(destroyed||!container.getClientRects?.().length)return;
      motion?.activity?.();if(event.key==='Tab')tabAt=Date.now();
      const enteringKeyboard=container.dataset.input!=='keyboard';container.dataset.input='keyboard';if(enteringKeyboard){motion?.cancel();motion?.syncTabs(false,true);}
      if(settingsDock?.handleKeydown(event))return;
      // Esc closes the phone drawer, then the phone reader sheet (focus returns to its row).
      if(event.key==='Escape'&&drawerOpen()){event.preventDefault();setDrawer(false);return;}
      if(event.key==='Escape'&&phone()&&readerOpen&&workspace==='work'&&(event.composedPath?.()[0]||event.target)?.dataset?.rdField!=='query'){event.preventDefault();closePreview();return;}
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
      if((event.key==='/'&&!typing&&!event.ctrlKey&&!event.metaKey&&!event.altKey)||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!typing)){
        // Assignments' search is rendered in the command bar and in the heading; the one on screen takes focus.
        event.preventDefault();const selector=workspace==='home'?'[data-rd-field="overview-query"]':workspace==='grades'?'[data-rd-field="grade-query"]':workspace==='materials'?'[data-rd-field="material-query"]':workspace==='inbox'?'[data-rd-field="hub-query"]':'[data-rd-field="query"]';
        const input=Array.from(container.querySelectorAll?.(selector)||[]).find(field=>field.getClientRects?.().length)||container.querySelector(selector);input?.focus();input?.select();
      }else if(event.key==='Escape'&&target?.dataset?.rdField==='query'&&state.query){event.preventDefault();state.query='';visibleLimit=60;render();}
    }

    const unsubscribe=typeof store.subscribe==='function'?store.subscribe(data=>{personal=data||store.get()||{};normalizedCache=null;render();}):()=>{};
    container.addEventListener('input',onInput);
    container.addEventListener('change',onChange);
    container.addEventListener('focusout',onFocusout);container.addEventListener('focusin',onHeaderFocusin);
    container.addEventListener('click',onClick);
    const onDisclosure=event=>{if(event.target?.dataset?.message&&event.target.open)hub?.readMessage(event.target.dataset.message);};
    container.addEventListener('toggle',onDisclosure,true);
    // Pointer and key input also keep the living drawings going: after two minutes with none,
    // motion.js lets them rest where they stand until the next input (the idle rest).
    const onPointerdown=()=>{container.dataset.input='pointer';motion?.activity?.();};
    container.addEventListener('pointerdown',onPointerdown);
    // Any real pointer movement ends the hover hold set by a check-off. (The course
    // drawings need no hover: they live on their own, motion.js.)
    const onPointermove=()=>{if(container.dataset.hoverHold)delete container.dataset.hoverHold;motion?.activity?.();};
    container.addEventListener('pointermove',onPointermove,{passive:true});
    document.addEventListener('keydown',onKeydown);
    // Capture the last scroll on normal navigation/reload without saving on
    // every scroll event or delaying departure from the page.
    root.addEventListener?.('pagehide',remember);
    const freshnessTimer=setInterval(updateFreshness,60000);
    render();
    // render() keeps the toolbar and Appearance nodes connected from here on.
    if(railLayout)for(const node of [container,...(container.querySelectorAll?.('.rd-toolbar,.rd-appearance')||[])])railLayout.observe(node);
    if(workspace==='materials')materials?.load(state.courseId);
    if(workspace==='hub')hub?.loadCourse(state.courseId);
    if(workspace==='inbox')hub?.loadInbox();

    return {
      getState(){return navigationState();},
      destroy(){
        if(destroyed)return;
        remember();
        flushDrafts();
        destroyed=true;
        readerLayout?.disconnect();railLayout?.disconnect();root.clearTimeout(railTimer);
        settingsDock?.destroy();materials?.destroy();hub?.destroy();motion?.destroy();toolbox?.destroy();
        clearInterval(freshnessTimer);clearInterval(focusTimer);clearTimeout(entranceTimer);
        unsubscribe?.();
        container.removeEventListener('input',onInput);
        container.removeEventListener('change',onChange);
        container.removeEventListener('focusout',onFocusout);container.removeEventListener('focusin',onHeaderFocusin);
        container.removeEventListener('click',onClick);
        container.removeEventListener('toggle',onDisclosure,true);
        container.removeEventListener('pointerdown',onPointerdown);container.removeEventListener('pointermove',onPointermove,{passive:true});
        document.removeEventListener('keydown',onKeydown);
        root.removeEventListener?.('pagehide',remember);
        container.remove();
      },
      updateSnapshot(next){
        if(next&&Array.isArray(next.courses)&&Array.isArray(next.assignments)){currentSnapshot=next;normalizedCache=null;contentCache.clear();}
        render();
      },
      setStatus(text){externalStatus=stringValue(text);if(!refreshing)transientStatus='';render();},
    };
  }

  return {mount,helpers:{patchUI,sameOriginLink,assignmentLink,gradePeriodLabel,filterAssignments:Model.filterAssignments,safeCourseImage,statusLabel,dateMs}};
});
