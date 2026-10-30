// Adapted from Gary Wu's pull request #47 to Canvas Harness.
/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(){
  'use strict';
  const dashboardPath=()=>location.pathname==='/'||location.pathname==='/dashboard'||location.pathname==='/dashboard/';
  if(window.top!==window||
    !globalThis.ReserveSite.supported(location.href)||
    globalThis.ReserveSite.vanillaPage(location)||
    !dashboardPath()||
    globalThis.ReserveStartup)
    return;
  // Preferences alone decide whether to cover Canvas. The controller performs
  // the one fresh account check before opening any owner's saved workspace.
  // The cover waits up to 8s for Canvas (a slow school network often needs more than 2-3s); only then does Canvas show.
  // Dark mode without a light flash: storage is asynchronous, so the last known theme is kept as a tiny hint in this
  // origin's localStorage and read at once; the saved setting then confirms or corrects it (and refreshes the hint).
  const HINT='reserve:startup-theme',darkClass=on=>document.documentElement?.classList.toggle('reserve-startup-dark',on);
  try{if(localStorage.getItem(HINT)==='dark')darkClass(true);}catch{}
  try{
    globalThis.chrome?.storage?.local?.get('reserve:appearance').then(saved=>{
      const dark=saved?.['reserve:appearance']?.theme==='dark';
      darkClass(dark);
      try{if(dark)localStorage.setItem(HINT,'dark');else localStorage.removeItem(HINT);}catch{}
    }).catch(()=>{});
  }catch{}
  // A short start-up log on <html> (times and step names only, no data): a page that stayed on Canvas says why.
  const note=msg=>{
    try{
      const html=document.documentElement,caller=(new Error().stack||'').split('\n').slice(2,5).map(l=>(l.match(/at (\S+)/)||[])[1]).filter(Boolean).join('<');
      html?.setAttribute('data-ch-startup-log',((html.getAttribute('data-ch-startup-log')||'')+Math.round(performance.now())+' '+msg+(caller?' <'+caller:'')+'; ').slice(-2000));
    }catch{}
  };
  globalThis.ReserveStartupNote=note;
  const startedAt=performance.now(),subscribers=new Set();let deadline=startedAt+8000;
  // The eight seconds count only while the page can be seen. A tab opened in the background waits, unseen,
  // for its student; when it is shown it gets its eight seconds again (the CSS release switches restart too).
  const expired=()=>!featuresLoading&&performance.now()>=deadline&&document.visibilityState!=='hidden';
  const allSheets=['app.css','dashboard.css','workspace.css','refresh.css','subject-art.css','customize.css','media-frame.css','frame-editor.css','settings-dock.css','gpa.css','selection.css','responsive-layout.css','widgets.css','pet.css','scene-themes.css','agent.css','study-band.css','course-links.css','focus-room.css','review-deck.css','grade-impact.css'];
  let sheets=allSheets,state='pending',shell,artNode,observer,timer,preloaded=false,featuresSelected=false,featuresLoading=false;
  // Why Canvas showed: 'student' (Canvas's page used, or "Canvas dashboard" chosen), 'deadline' (eight seconds in view),
  // 'no-cover' (the cover's styles were missing). The last two leave the start running; anything else stops it.
  let releasedBy='';
  function waitForFeatures(loading){
    if(state!=='pending'&&state!=='active')return;
    featuresLoading=loading;document.documentElement?.classList.toggle('reserve-features-loading',loading);clearTimeout(timer);
    if(!loading){deadline=performance.now()+8000;timer=setTimeout(expire,8000);}
  }
  function setFeatures(prefs,selected=false){
    if(featuresSelected&&!selected)return;
    if(selected)featuresSelected=true;
    globalThis.ReserveFeatures?.apply(prefs);
    sheets=globalThis.ReserveFeatures?.filterFiles(allSheets)||allSheets;
    if(globalThis.ReserveFeatures&&!globalThis.ReserveFeatures.enabled('dashboard'))release();
    for(const link of [...preloadLinks])
      if(!sheets.some(file=>link.href===chrome.runtime.getURL(file))){link.remove();preloadLinks.splice(preloadLinks.indexOf(link),1);}
  }
  function refreshArt(){
    if(artNode){artNode.innerHTML=globalThis.ReserveFeatures?.enabled('motion')===false?'':globalThis.ReserveStartupArt||'';artNode.hidden=!artNode.innerHTML;}
  }
  const preloadLinks=[];
  const loginPage=()=>!!document.querySelector('#login_form, #new_login, .ic-Login');
  // Once the page body has its main content (or finished parsing) without a Canvas layout, it is not Canvas.
  const notCanvas=()=>(!!document.getElementById('content')||document.readyState!=='loading')&&!globalThis.ReserveSite.canvasPage(document);
  function cleanup(){
    clearTimeout(timer);observer?.disconnect();
    for(const link of preloadLinks)link.remove();preloadLinks.length=0;
    document.removeEventListener('pointerdown',interact,true);
    document.removeEventListener('keydown',interact,true);
    document.removeEventListener('visibilitychange',shown);
    window.removeEventListener('pagehide',leave);
    document.documentElement?.classList.remove('reserve-startup-active','reserve-startup-dark','reserve-features-loading');
    shell?.remove();shell=null;
  }
  function release(reason=''){
    if(state==='native')return;
    note('release from '+state+(reason?' by '+reason:'')+(document.visibilityState==='hidden'?' (hidden)':''));
    state='native';releasedBy=reason;cleanup();
    for(const fn of subscribers){try{fn(reason);}catch{}}
    subscribers.clear();
  }
  function leave(){release();}
  function canReveal(){
    if(state==='native')return false;
    if(!dashboardPath()||loginPage()){release();return false;}
    if(state!=='complete'&&expired()){release('deadline');return false;}
    return state==='active'||state==='complete';
  }
  // A reveal the student asked for (the Canvas Harness button, or a returning tab after its account check) lifts the cover
  // without the deadline: the controller has already decided to show the workspace.
  function dismiss(){
    if(state!=='pending'&&state!=='active')return;
    state='complete';cleanup();subscribers.clear();
  }
  function expire(){if(!featuresLoading&&(state==='pending'||state==='active')&&document.visibilityState!=='hidden')release('deadline');}
  function shown(){
    if(document.visibilityState==='hidden'||(state!=='pending'&&state!=='active'))return;
    deadline=performance.now()+8000;clearTimeout(timer);timer=setTimeout(expire,8000);
    const html=document.documentElement;
    if(state==='active'&&html?.classList.contains('reserve-startup-active')){
      html.classList.remove('reserve-startup-active');
      globalThis.getComputedStyle?.(shell)?.animationName;
      html.classList.add('reserve-startup-active');
    }
  }
  function complete(){
    if(!canReveal()){note('complete refused');return false;}
    state='complete';cleanup();subscribers.clear();return true;
  }
  // Using Canvas itself while the cover waits hands the page to Canvas: a click on Canvas's page, or typing into a
  // field. A click on Canvas's menu bar, Tab, arrows and shortcuts do not.
  function interact(event){
    const path=event.composedPath?.()||[];
    if(shell&&(path.includes(shell)||shell.contains(event.target)))return;
    if(path.some(node=>node?.id==='header'))return;
    if(event.type==='keydown'){const t=event.target;if(!(t?.isContentEditable||/^(input|textarea|select)$/i.test(t?.tagName||'')))return;}
    release('student');
  }
  function prepare(){
    if(state!=='active')return;
    // Preload only extension-local styles. These links do not apply CSS to the
    // Canvas document; the guarded shadow host loads the actual styles later.
    if(!preloaded&&document.head){
      preloaded=true;
      for(const file of sheets){
        try{
          const link=document.createElement('link');link.rel='preload';link.as='style';
          link.href=chrome.runtime.getURL(file);link.fetchPriority='low';
          document.head.append(link);preloadLinks.push(link);
        }catch{} // The main controller still loads and validates each stylesheet.
      }
    }
  }
  function activate(){
    if(state!=='pending')return;
    if(!dashboardPath()||loginPage()){release();return;}
    if(expired()){release('deadline');return;}
    if(!document.documentElement)return;
    shell=document.createElement('section');shell.id='reserve-startup-shell';
    shell.setAttribute('aria-label','Canvas Harness is opening');
    const header=document.createElement('header'),brand=document.createElement('strong'),escape=document.createElement('a');
    brand.textContent='Canvas Harness';escape.textContent='Canvas dashboard';escape.href=location.pathname+'?reserve=native';
    escape.addEventListener('click',event=>{
      event.preventDefault();
      release('student');   // for this visit only: the next visit to the dashboard opens Canvas Harness again
    });
    header.append(brand,escape);
    const message=document.createElement('p');message.textContent='Syncing Canvas…';message.setAttribute('role','status');
    const art=document.createElement('div');art.className='reserve-startup-art';art.setAttribute('aria-hidden','true');
    artNode=art;refreshArt();
    shell.append(header,art,message);document.documentElement.append(shell);
    // If the bundled prepaint CSS failed, never apply the native-content gate.
    if(getComputedStyle(shell).getPropertyValue('--reserve-startup-ready').trim()!=='1'){release('no-cover');return;}
    state='active';document.documentElement.classList.add('reserve-startup-active');note('active');prepare();
  }
  globalThis.ReserveStartup={canReveal,complete,dismiss,release,startedAt,setFeatures,refreshArt,
    get active(){return state==='active';},
    get releasedBy(){return releasedBy;},
    get styleFiles(){return sheets;},
    onNative(fn){if(state==='native')fn(releasedBy);else if(state!=='complete')subscribers.add(fn);}
  };
  timer=setTimeout(expire,8000);
  document.addEventListener('pointerdown',interact,true);
  document.addEventListener('keydown',interact,true);
  document.addEventListener('visibilitychange',shown);
  window.addEventListener('pagehide',leave);
  // Manifest CSS is inert until the preference read succeeds; storage failure is native.
  globalThis.ReserveStartup.preferences=Promise.resolve(globalThis.ReserveFeatures?.earlyReady).then(()=>chrome.storage.local.get(['reserve:enabled','reserve:features'])).then(saved=>{
    setFeatures(saved['reserve:features']);
    if(state==='native')return saved;
    const params=new URLSearchParams(location.search);
    // Choosing Canvas's dashboard is for that visit only (?reserve=native); an older tab-long choice is forgotten.
    try{sessionStorage.removeItem('reserve:native');}catch{}
    if(saved['reserve:enabled']===false||params.get('reserve')==='native'){release();return saved;}
    observer=new MutationObserver(()=>{
      try{if(loginPage()||!dashboardPath()||notCanvas())release();else if(state==='pending')activate();else prepare();}catch{release();}
    });
    document.addEventListener('DOMContentLoaded',()=>{if(notCanvas())release();},{once:true});
    observer.observe(document.documentElement||document,{childList:true,subtree:true});
    activate();return saved;
  }).catch(()=>{release();return {'reserve:enabled':false};});
})();
