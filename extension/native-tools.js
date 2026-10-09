/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root){
 'use strict';
 const BASE=(globalThis.ReserveSite.origin());
 function context(snapshot,personal,pathname){
  // Hidden as on the dashboard: by hand, or not a class (NameCoach, College Counseling) and never shown by hand.
  const C=root.ReserveCore,s=personal.settings||{},all=(snapshot.courses||[]).map(C.normalizeCourse).filter(c=>/^\d+$/.test(c.id)),hidden=C.hiddenCourseIds(all,s),prefs=s.coursePrefs||{};
  const current=String(pathname||'').match(/^\/courses\/(\d+)(?:\/|$)/)?.[1];
  // Labels match the dashboard's (dashboard.js allCourses): a student's own name is final and never re-split, the teacher
  // shows unless that name already includes it, and the Canvas name and code stay searchable.
  const courses=all.filter(c=>!hidden.has(c.id)).map(c=>{const custom=String(prefs[c.id]?.name||''),label=C.courseLabel?.(c.name)||{},extra=v=>v&&!(custom&&custom.toLowerCase().includes(String(v).toLowerCase()))?v:'';return {...c,name:custom||c.name,originalName:c.name,shortName:custom||label.title||c.name,subject:extra(label.subject),teacher:extra(label.teacher),sub:extra(label.sub),courseSearch:[c.name,c.code].filter(Boolean).join(' ')};});
  // The current route is a useful shortcut even before a dashboard cache exists.
  if(current&&!hidden.has(current)&&!courses.some(c=>c.id===current))courses.unshift({id:current,name:'Current course',color:'#49745f'});
  const courseMap=new Map(courses.map(c=>[c.id,c]));
  const items=(snapshot.assignments||[]).map(raw=>{const course=courseMap.get(String(raw.course_id??raw.courseId));return course?C.normalizeAssignment(raw,course):null;}).filter(Boolean);
  const aiAssignmentId=String(pathname||'').match(/^\/courses\/\d+\/assignments\/(\d+)\/?$/)?.[1]||null;
  return {s,courses,allCourses:all.map(c=>courseMap.get(c.id)||c),items,aiAssignmentId,courseId:courseMap.has(current)?current:'all',cacheNotice:snapshot.fetchedAt?'Uses your saved dashboard information. Open Canvas Harness to refresh deadlines.':'Open the Canvas Harness dashboard once to make your other courses and assignments available here.'};
 }
 function dashboardURL({workspace,courseId,page,id,appearance}={}){
  const url=new URL(BASE+'/');url.searchParams.set('reserve','open');
  if(['work','hub','materials','inbox','grades'].includes(workspace))url.searchParams.set('workspace',workspace);
  if(/^\d+$/.test(courseId||''))url.searchParams.set('course',courseId);
  if(['week','assignments'].includes(page))url.searchParams.set('plan',page);
  if(/^(\d+|local-[\w-]+)$/.test(id||''))url.searchParams.set('item',id);
  if(appearance)url.searchParams.set('appearance','true');return url.href;
 }
 // A removable stylesheet reserves room without rewriting Canvas inline styles.
 function pageDock(doc=document){
  let sheet,padding;
  return {update({open,collapsed,width,height}){
   if(!open||collapsed){sheet?.remove();sheet=null;return;}
   if(!sheet){padding=root.getComputedStyle?.(doc.body)?.paddingRight||'0px';sheet=doc.createElement('style');sheet.dataset.reserveToolboxLayout='true';doc.head.append(sheet);}
   const w=Number.isFinite(width)&&width>=240?width+'px':'clamp(360px,29vw,460px)',h=Number.isFinite(height)&&height>=160?height+'px':'46dvh';
   sheet.textContent=`@media(min-width:901px){body{box-sizing:border-box!important;padding-right:calc(${padding} + ${w} + 36px)!important}}@media(max-width:900px){body{padding-bottom:calc(${h} + 30px)!important}}`;
  },destroy(){sheet?.remove();sheet=null;}};
 }
 // While the Tools dock is open, a focus session that has ended (or ends) is recorded once through ReserveCore.settleFocus,
 // as on the dashboard. One timeout waits for a running session's end; with no session there is no timer.
 function focusSettler(store,{setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now}={}){
  let timer=0;
  function check(){clearTimer(timer);timer=0;const f=store.get()?.focus,C=root.ReserveCore;if(!f?.endsAt||!C?.settleFocus)return;const left=f.endsAt-now();if(left>0){timer=setTimer(check,Math.min(left+50,864e5));return;}Promise.resolve(store.update(data=>{C.settleFocus(data,now());})).catch(()=>{});}
  return {check,stop(){clearTimer(timer);timer=0;}};
 }
 function create({button,dockRoot,client=root.ReserveAPI.createClient(),createStore=root.ReserveStorage.createStore,origin=BASE,pathname=()=>root.location.pathname,styleURL=file=>root.chrome.runtime.getURL(file),navigate=url=>root.open(url,'_blank','noopener,noreferrer')}){
  let session=root.ReserveToolboxSession.create({client,createStore,origin}),toolbox,area,verified,unsubscribe,focus,pending=null,dead=false,version=0,stylesPromise,styleNodes=[];
  const layout=pageDock(),label=button.textContent,status=document.createElement('span');status.className='reserve-tool-status';status.setAttribute('role','status');status.hidden=true;dockRoot.append(status);
  function notice(text){status.textContent=text;status.hidden=!text;}
  function clearView(){layout.destroy();focus?.stop();focus=null;toolbox?.destroy();toolbox=null;unsubscribe?.();unsubscribe=null;area?.remove();area=null;verified=null;button.hidden=false;}
  function styleReady(){
   if(stylesPromise)return stylesPromise;
   stylesPromise=Promise.all(['app.css','dashboard.css','workspace.css','refresh.css','gpa.css'].map(file=>new Promise((resolve,reject)=>{
    const link=document.createElement('link');link.rel='stylesheet';link.href=styleURL(file);styleNodes.push(link);
    const timer=setTimeout(()=>reject(Error('Toolbox styles could not load. Try opening it again.')),8000);
    link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);reject(Error('Toolbox styles could not load. Try opening it again.'));};dockRoot.append(link);
   }))).catch(error=>{stylesPromise=null;for(const link of styleNodes)link.remove();styleNodes=[];throw error;});return stylesPromise;
  }
  function appearance(){
   if(!area||!verified)return;const s=verified.store.get().settings||{},dark=s.theme==='dark';
   area.dataset.theme=dark?'dark':'light';area.dataset.font=s.font||'system';area.dataset.textSize=s.textSize||'standard';
   const accents={clay:['#A9522F','#E08A6A'],forest:['#367964','#9bd1b4'],indigo:['#5f5ccc','#bec8ff'],ocean:['#2f7185','#a3d4e5'],rose:['#9e4c6c','#efb0c0'],amber:['#956821','#e8c68b']};
   area.style.setProperty('--rd-accent',(accents[s.accent]||accents.clay)[dark?1:0]);
  }
  function launch(options){navigate(dashboardURL({...options,courseId:context(verified.snapshot,verified.store.get(),pathname()).courseId}));}
  async function open(next,source=button,keyboard=false){
   if(dead)return;if(toolbox?.isOpen()){toolbox.open(next,source);return;}if(pending)return pending;
   const token=++version;button.disabled=true;button.textContent='Opening…';notice('Checking your Canvas account…');
   pending=(async()=>{
    try{
     const [data]=await Promise.all([session.open(),styleReady()]);
     if(dead||token!==version)return;
     if(toolbox&&verified?.store===data.store&&String(verified.user.id)===String(data.user.id)){verified=data;appearance();toolbox.open(next,source);notice('');return;}
     clearView();verified=data;focus=focusSettler(data.store);area=document.createElement('div');area.className='rd rd-native-tools';area.dataset.input=keyboard?'keyboard':'pointer';dockRoot.append(area);appearance();
     area.addEventListener('pointerdown',()=>{area.dataset.input='pointer';},{passive:true});
     toolbox=root.ReserveToolbox.create({container:area,store:data.store,aiConfig:{client,user:data.user},onDockChange:state=>{layout.update(state);button.hidden=state.open;if(state.open)focus?.check();else focus?.stop();dockRoot.host?.toggleAttribute('data-reserve-tools',state.open);},getContext:()=>context(verified.snapshot,verified.store.get(),pathname()),
      onNavigate:workspace=>launch({workspace}),onPlanner:options=>launch(options),
      onRefresh:async()=>{
       const expected=verified;if(!expected)throw Error('Reopen Tools to verify your Canvas account.');
       const fresh=await client.loadSnapshot({user:expected.user});
       if(dead||verified!==expected||String(fresh.user?.id)!==String(expected.user.id))throw Error('Your Canvas session changed. Reopen Tools.');
       await expected.store.writeCache(fresh);expected.snapshot=fresh;toolbox?.update();
       if(fresh.partial)throw Error('Some courses could not refresh. Available grades have been updated.');
      },
      onPreview:id=>{if(/^local-[\w-]+$/.test(id)){launch({page:'assignments',id});return;}const item=context(data.snapshot,data.store.get(),pathname()).items.find(x=>x.id===id);if(item)navigate(item.url);}
     });
     unsubscribe=data.store.subscribe(()=>{appearance();if(toolbox?.isOpen())focus?.check();});toolbox.open(next,source);notice('');
    }catch(error){if(!dead&&token===version){clearView();notice(error.message||'Tools could not open. Try again.');}}
    finally{if(token===version){pending=null;button.disabled=false;button.textContent=label;}}
   })();return pending;
  }
  const onClick=()=>open(undefined,button);
  const onKey=event=>{
   if(event.defaultPrevented||!(event.ctrlKey||event.metaKey)||event.altKey||event.key.toLowerCase()!=='k'||toolbox?.isOpen())return;
   // Canvas rich-text editors use Ctrl+K for inserting links.
   if(event.composedPath().some(node=>node.matches?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog[open]')))return;
   event.preventDefault();open('quick',document.activeElement,true);
  };
  function suspend(){version++;pending=null;clearView();session.destroy();session=root.ReserveToolboxSession.create({client,createStore,origin});button.disabled=false;button.textContent=label;notice('');}
  // Opening a provider window must keep the AI draft and dock alive. Verify the Canvas
  // account again on return; destroy the session if it has actually changed.
  const onVisibility=()=>{if(document.visibilityState==='visible'&&verified){const expected=String(verified.user.id);client.profile().then(found=>{if(String(found.id)!==expected)suspend();}).catch(()=>suspend());}};
  button.addEventListener('click',onClick);document.addEventListener('keydown',onKey);document.addEventListener('visibilitychange',onVisibility);
  return {open,destroy(){if(dead)return;dead=true;suspend();session.destroy();button.removeEventListener('click',onClick);document.removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVisibility);status.remove();for(const link of styleNodes)link.remove();}};
 }
 root.ReserveNativeTools={create,context,dashboardURL,pageDock,focusSettler};if(typeof module!=='undefined'&&module.exports)module.exports=root.ReserveNativeTools;
})(globalThis);
