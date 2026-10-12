/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(){
  'use strict';
  if(window.top!==window||!globalThis.ReserveSite.supported(location.href)||globalThis.ReserveContentStarted||document.getElementById('reserve-companion-dock'))return;
  globalThis.ReserveContentStarted=true;
  const isDashboard=location.pathname==='/'||/^\/dashboard\/?$/.test(location.pathname);
  const params=new URLSearchParams(location.search);
  const startup=globalThis.ReserveStartup;
  const build='2.22.4';
  // Local timings contain only milliseconds, never account or course data.
  // They make real startup measurable without delaying or storing the page.
  const stamp=()=>Math.round(globalThis.performance?.now?.()||0);
  const timing={bootstrap:Math.round(startup?.startedAt||0),controller:stamp()};
  let host,root,area,toolbar,resumeCover,statusLabel,dashboard,planner,session,snapshot,store,ready=false,wanted=true;
  let authorized=false,suspended=false,resumeGeneration=0,resumePending;
  let launchObserver,launchAttempt,bootStopped=false;
  // "Open at once" (off unless the owner turns it on) remembers which account to open: an id, nothing else.
  const HINT_KEY='reserve:lastAccount:'+location.origin;let ownerHint=null;
  const quickOpen=settings=>settings?.quickOpen==='on';
  if(isDashboard)try{Promise.resolve(chrome.storage.local.get(HINT_KEY)).then(found=>{const id=String(found?.[HINT_KEY]??'');if(/^\d+$/.test(id))ownerHint={id};}).catch(()=>{});}catch{}
  function mark(phase){
    if(timing[phase]===undefined)timing[phase]=stamp();
    // Network milestones distinguish time spent waiting for Canvas from local
    // rendering. Only numeric, page-local timing values are exposed.
    try{
      const navigation=globalThis.performance?.getEntriesByType?.('navigation')?.[0];
      for(const key of ['requestStart','responseStart','responseEnd'])if(navigation?.[key]>0)timing['navigation'+key[0].toUpperCase()+key.slice(1)]=Math.round(navigation[key]);
      if(phase==='profileEnd'){
        const profile=globalThis.performance?.getEntriesByName?.(location.origin+'/api/v1/users/self/profile','resource')?.find(entry=>entry.startTime>=timing.profileStart);
        for(const key of ['startTime','requestStart','responseStart','responseEnd'])if(profile?.[key]>0)timing['profile'+key[0].toUpperCase()+key.slice(1)]=Math.round(profile[key]);
      }
    }catch{} // Missing resource timings must never affect account verification.
    host?.setAttribute('data-reserve-startup-timing',JSON.stringify(timing));
  }
  function stopWaiting(){launchObserver?.disconnect();launchObserver=null;if(launchAttempt)document.removeEventListener?.('DOMContentLoaded',launchAttempt);launchAttempt=null;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>mark('parsed'),{once:true});
  else mark('parsed');
  let manualOpen=false;
  let dashboardState,dashboardScroll=0,restoreScroll=false,nativeTools,pageAppearance,launchPending=true;
  if(params.get('reserve')==='open'){const workspace=params.get('workspace'),courseId=params.get('course');if(['work','hub','materials','inbox','grades'].includes(workspace)||/^\d+$/.test(courseId||''))dashboardState={workspace,courseId};}
  const hidden=new Map();
  const pageStyle=document.createElement('style');
  pageStyle.textContent='html.reserve-inline-active #content-wrapper{max-width:none!important;width:100%!important}html.reserve-inline-active #content{width:100%!important;max-width:none!important;padding:8px 16px 20px!important;box-sizing:border-box!important}html.reserve-inline-active #content-wrapper{flex:1 1 auto!important;min-width:0!important}html.reserve-inline-active #main{width:100%!important;min-width:0!important}html.reserve-inline-active #not_right_side{width:100%!important;min-width:0!important}html.reserve-inline-active #wrapper{max-width:none!important}html.reserve-inline-active #not_right_side{margin-right:0!important;padding-right:0!important}html.reserve-inline-active #right-side-wrapper,html.reserve-inline-active #right-side,html.reserve-inline-active #content>:not(#reserve-companion-host){display:none!important}#reserve-companion-host{min-width:0;width:100%}';
  const dock=document.createElement('div');dock.id='reserve-companion-dock';
  dock.style.cssText='position:fixed;bottom:16px;right:16px;z-index:1000';
  const dockRoot=dock.attachShadow({mode:'open'});
  dockRoot.innerHTML='<style>.reserve-dock-button{font:600 13px system-ui;color:#fff;background:#A9522F;border:1px solid #ffffff66;border-radius:999px;padding:10px 16px;box-shadow:0 0 0 1px rgb(60 48 24 / .08),0 8px 24px rgb(60 48 24 / .16);cursor:pointer;transition:background-color 140ms cubic-bezier(.25,.1,.25,1)}.reserve-dock-button:hover{background:#8C4226}.reserve-dock-button:focus-visible{outline:3px solid #C96442;outline-offset:3px}@media(prefers-reduced-motion:reduce){.reserve-dock-button{transition:none}}</style><button class="reserve-dock-button" title="Show the Canvas Harness dashboard">Canvas Harness</button>';
  // Literata (OFL, bundled: roman and italic) sets Canvas Harness's titles and reading
  // text. @font-face does not apply inside a shadow root, so both faces are
  // registered on the page's font set once; each downloads only when first used.
  function registerFont(){
    try{if(!document.fonts||[...document.fonts].some(face=>face.family.replace(/["']/g,'')==='Literata'))return;for(const [file,style] of [['fonts/literata-latin.woff2','normal'],['fonts/literata-latin-italic.woff2','italic']])document.fonts.add(new FontFace('Literata',`url(${chrome.runtime.getURL(file)}) format('woff2')`,{weight:'200 900',style,display:'swap'}));}catch{}
  }
  function restoreNative(){
    for(const [el,previous] of hidden)el.hidden=previous;
    hidden.clear();document.documentElement.classList.remove('reserve-inline-active');
  }
  function coverWorkspace(checking){
    // Keep the enhanced page's place while its account is revalidated. Only a
    // static, nonprivate shell can show: no retained coursework, art or controls.
    if(checking&&resumeCover){const height=host?.getBoundingClientRect?.()?.height||0;resumeCover.style.minHeight=height>0?Math.ceil(height)+'px':'';}
    if(area){area.hidden=checking;area.inert=checking;}
    if(resumeCover)resumeCover.hidden=!checking;
    host?.setAttribute('data-reserve-verifying',String(checking));
  }
  function reveal(){
    if(!ready||!wanted||!authorized||suspended||bootStopped||!host||!snapshot||(!dashboard&&!planner)||document.visibilityState==='hidden')return;
    if(!manualOpen&&startup&&!startup.complete())return;
    const content=host.parentElement;
    for(const el of [...content.children,document.getElementById('right-side')]){
      if(!el||el===host||el.contains(host)||hidden.has(el))continue;
      hidden.set(el,el.hidden);el.hidden=true;
    }
    document.documentElement.classList.add('reserve-inline-active');
    coverWorkspace(false);
    host.hidden=false;dock.hidden=true;mark('visible');
  }
  function showCanvas(remember=true){
    authorized=false;resumeGeneration++;
    wanted=false;planner?.destroy();planner=null;
    if(host)host.hidden=true;coverWorkspace(false);restoreNative();dock.hidden=false;
    startup?.release();
    session?.destroy();session=null;
    if(remember){try{sessionStorage.setItem('reserve:native','true');}catch{}}
  }
  function setStatus(message){if(statusLabel)statusLabel.textContent=dashboard?'Canvas Harness '+build:message||'Canvas Harness '+build;dashboard?.setStatus(message);}
  function drawDashboard(){
    if(!area||!snapshot)return;
    if(dashboard)dashboardState=dashboard.getState();
    planner?.destroy();planner=null;dashboard?.destroy();
    // The dashboard's own command bar carries the Canvas dashboard switch (onNative) and its footer
    // the status (setStatus below), so this row folds away while the dashboard shows.
    toolbar.querySelector('[data-dashboard]').hidden=true;toolbar.hidden=true;
    dashboard=ReserveDashboard.mount(area,{snapshot,store,initialState:dashboardState,onPlanner:openPlanner,onNative:()=>showCanvas(),refresh:()=>session.refresh(),onAuthError:()=>{showCanvas();session?.verify();}});
    mark('mounted');
    reveal();
    if(restoreScroll){restoreScroll=false;requestAnimationFrame(()=>window.scrollTo({top:dashboardScroll,behavior:'instant'}));}
  }
  function openPlanner(options={page:'week'}){
    if(!snapshot||!area)return;
    dashboardState=dashboard?.getState()||dashboardState;dashboardScroll=window.scrollY;restoreScroll=true;
    dashboard?.destroy();dashboard=null;planner?.destroy();
    toolbar.hidden=false;toolbar.querySelector('[data-dashboard]').hidden=false;
    planner=ReserveApp.mount(area,{snapshot,store,embedded:true,hideGrades:options.hideGrades,initialPage:options.page||'week',initialId:options.id||null,onExit:drawDashboard,onAuthError:()=>{showCanvas();setStatus('Your session changed. Reload Canvas.');},refresh:()=>session.refresh()});
    reveal();host.scrollIntoView({block:'start',behavior:'instant'});
  }
  function makeHost(){
    if(host)return;
    const content=document.getElementById('content');if(!content)return;
    host=document.createElement('div');host.id='reserve-companion-host';host.hidden=true;
    host.setAttribute('data-reserve-build',build);
    mark('containers');
    root=host.attachShadow({mode:'open'});
    const loadingHost=host;let loaded=0;
    const sheets=startup?.styleFiles||['app.css','dashboard.css','workspace.css','refresh.css','subject-art.css','customize.css','settings-dock.css','gpa.css','selection.css','responsive-layout.css','widgets.css','pet.css'];
    for(const file of sheets){
      const link=document.createElement('link');link.rel='stylesheet';link.href=chrome.runtime.getURL(file);
      link.onload=()=>{if(host===loadingHost&&++loaded===sheets.length){ready=true;mark('styles');reveal();}};
      link.onerror=()=>{if(host===loadingHost)showCanvas(false);};root.append(link);
    }
    const css=document.createElement('style');css.textContent=':host([hidden]){display:none!important}.reserve-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;font:12px/1.5 system-ui;color:#5E5D59;padding:4px 0 12px}.reserve-toolbar div{display:flex;gap:8px}.reserve-toolbar button{font:600 12px system-ui;border:1px solid #D9D6CA;background:#fff;color:#3D3D3A;border-radius:999px;padding:8px 12px;cursor:pointer}.reserve-toolbar button:focus-visible{outline:2px solid #C96442;outline-offset:2px}.reserve-toolbar button[hidden],.reserve-toolbar[hidden]{display:none}'+
      ':host([data-reserve-verifying="true"]) .reserve-toolbar,.reserve-resume[hidden]{display:none!important}.reserve-workspace[hidden]{display:block!important;content-visibility:hidden!important}.reserve-resume{box-sizing:border-box;min-height:calc(100dvh - 90px);padding:20px clamp(16px,2vw,32px);background:#FAF9F5;color:#3D3D3A;font:14px/1.5 system-ui;color-scheme:light}.reserve-resume header{display:flex;align-items:center;gap:12px;padding-bottom:20px;border-bottom:1px solid #E8E6DC}.reserve-resume img{width:36px;height:36px;object-fit:contain}.reserve-resume strong{font-size:19px;font-weight:600}.reserve-resume button{margin-left:auto;padding:8px 12px;border:1px solid #D9D6CA;border-radius:8px;background:#fff;color:#5E5D59;font:inherit;cursor:pointer}.reserve-resume button:focus-visible{outline:2px solid #C96442;outline-offset:3px}.reserve-resume p{margin:20px 0;color:#78766F}.reserve-resume-grid{display:grid;grid-template-columns:minmax(120px,.7fr) repeat(3,minmax(0,1fr));gap:20px}.reserve-resume-grid>div{min-height:260px;border:1px solid #E8E6DC;border-radius:12px;padding:20px}.reserve-resume-grid i{display:block;max-width:75%;height:9px;margin:12px 0 30px;border-radius:4px;background:#E8E6DC}.reserve-resume-grid i:nth-child(even){max-width:50%}@media(max-width:900px){.reserve-resume-grid{grid-template-columns:140px 1fr}.reserve-resume-grid>div:nth-child(n+3){display:none}}@media(max-width:600px){.reserve-resume-grid{grid-template-columns:1fr}.reserve-resume-grid>div:first-child{display:none}}';root.append(css);
    toolbar=document.createElement('div');toolbar.className='reserve-toolbar';
    toolbar.innerHTML='<span role="status" aria-live="polite">Canvas Harness</span><div><button data-dashboard hidden>Back to dashboard</button><button data-native>Canvas dashboard</button></div>';
    statusLabel=toolbar.querySelector('span');
    toolbar.querySelector('[data-dashboard]').addEventListener('click',drawDashboard);
    toolbar.querySelector('[data-native]').addEventListener('click',()=>showCanvas());
    area=document.createElement('div');area.className='reserve-workspace';
    resumeCover=document.createElement('div');resumeCover.className='reserve-resume';resumeCover.hidden=true;
    resumeCover.innerHTML='<header><img src="'+chrome.runtime.getURL('icon.svg')+'" alt=""><strong>Canvas Harness</strong><button type="button" data-native>Canvas dashboard</button></header><p role="status" aria-live="polite">Checking your Canvas session…</p><div class="reserve-resume-grid" aria-hidden="true"><div><i></i><i></i><i></i></div><div><i></i><i></i><i></i></div><div><i></i><i></i><i></i></div><div><i></i><i></i><i></i></div></div>';
    resumeCover.querySelector('[data-native]').addEventListener('click',()=>showCanvas());
    root.append(toolbar,area,resumeCover);content.append(host);
    document.head.append(pageStyle);
  }
  function receive(next,verifiedStore,meta){
    if(!wanted||suspended||bootStopped||(!manualOpen&&startup&&!startup.canReveal()))return;
    if(store&&store!==verifiedStore){
      const sameOwner=String(snapshot?.user?.id)===String(next.user?.id);
      if(sameOwner&&dashboard)dashboardState=dashboard.getState();
      else if(!sameOwner){dashboardState=undefined;dashboardScroll=0;restoreScroll=false;}
      dashboard?.destroy();dashboard=null;planner?.destroy();planner=null;
    }
    snapshot=next;store=verifiedStore;
    authorized=true;
    if(!meta?.unverified)try{
      const id=String(next.user?.id??''),on=quickOpen(verifiedStore.get().settings);
      if(on&&/^\d+$/.test(id)&&ownerHint?.id!==id){ownerHint={id};Promise.resolve(chrome.storage.local.set({[HINT_KEY]:id})).catch(()=>{});}
      else if(!on&&ownerHint){ownerHint=null;Promise.resolve(chrome.storage.local.remove(HINT_KEY)).catch(()=>{});}
    }catch{}
    makeHost();if(!host)return;mark('verifiedData');
    if(planner)planner.updateSnapshot(next);
    else if(dashboard)dashboard.updateSnapshot(next);
    else{drawDashboard();if(launchPending){launchPending=false;const page=params.get('plan'),id=params.get('item');if(['week','assignments'].includes(page))openPlanner({page,id:/^(\d+|local-[\w-]+)$/.test(id||'')?id:null,hideGrades:store.get().settings.showGrades!==true});else if(params.get('appearance')==='true')area.querySelector('[data-rd-action="settings"]')?.click();}}
    if(meta.stale)setStatus('Saved view · Updating in the background…');
    reveal();
  }
  function start(){
    makeHost();
    if(session)return session.start();
    session=ReserveSession.createSession({client:ReserveAPI.createClient(),createStore:ReserveStorage.createStore,...(ownerHint?{prefetchedProfile:ownerHint,quickOpen}:{}),
      onSnapshot:receive,onStatus:setStatus,onTiming:mark,onError:(error,{clear})=>{
      if(clear){if(ownerHint){ownerHint=null;try{Promise.resolve(chrome.storage.local.remove(HINT_KEY)).catch(()=>{});}catch{}}dashboard?.destroy();dashboard=null;snapshot=null;store=null;showCanvas();dashboardState=undefined;dashboardScroll=0;restoreScroll=false;}
      else if(!dashboard&&!planner)showCanvas(false);
      dockRoot.querySelector('button').title=error.message+' Click to retry.';
    }});
    return session.start();
  }
  dockRoot.querySelector('button').addEventListener('click',()=>{
    if(!isDashboard){location.assign(globalThis.ReserveSite.origin()+'/?reserve=open');return;}
    startup?.release();manualOpen=true;wanted=true;
    try{sessionStorage.removeItem('reserve:native');}catch{}
    if(host&&!ready){host.remove();host=null;}
    makeHost();
    authorized=false;resumeGeneration++;
    session?.destroy();session=null;start();
  });
  document.addEventListener('pointerdown',event=>{
    // Do not move a Canvas control out from under a student who has started using it.
    if((!ready||!snapshot)&&wanted&&!startup?.active&&!event.composedPath().includes(dock))showCanvas(false);
  },{passive:true});
  function pauseWorkspace(){
    const keepPlace=wanted&&host&&!host.hidden&&ready&&snapshot&&(dashboard||planner);
    suspended=true;authorized=false;resumeGeneration++;resumePending=null;
    if(keepPlace){coverWorkspace(true);dock.hidden=true;}
    else{if(host)host.hidden=true;coverWorkspace(false);restoreNative();dock.hidden=false;}
    if(snapshot)session?.suspend();else{session?.destroy();session=null;}
    startup?.release();
  }
  function resumeWorkspace(){
    if(resumePending)return resumePending;
    if(!isDashboard||!wanted||!host||bootStopped||document.visibilityState==='hidden')return;
    if(!!document.querySelector('#login_form, #new_login, .ic-Login')||!(location.pathname==='/'||/^\/dashboard\/?$/.test(location.pathname))){showCanvas(false);return;}
    suspended=false;manualOpen=true;const epoch=resumeGeneration;
    // With "Open at once" the workspace shows as the tab returns; the check below still runs and closes it on failure.
    try{if(snapshot&&session&&quickOpen(store?.get().settings)){authorized=true;reveal();}}catch{}
    const operation=(async()=>{
      if(!snapshot||!session){session?.destroy();session=null;return start();}
      const verified=await session.verify();
      if(epoch!==resumeGeneration||!wanted||suspended||bootStopped||document.visibilityState==='hidden')return;
      if(!verified){showCanvas(false);return;}
      // Lift the cover first; the refresh of what it shows (times, anything saved meanwhile) follows the first frame.
      authorized=true;reveal();
      const refresh=()=>{if(epoch===resumeGeneration&&!suspended&&wanted&&snapshot)dashboard?.updateSnapshot(snapshot);};
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(refresh,0));else refresh();
    })().catch(()=>{if(epoch===resumeGeneration)showCanvas(false);});
    resumePending=operation;operation.finally(()=>{if(resumePending===operation)resumePending=null;});return operation;
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')pauseWorkspace();else resumeWorkspace();
  });
  window.addEventListener('pagehide',event=>{bootStopped=true;stopWaiting();pauseWorkspace();if(!event.persisted){planner?.destroy();dashboard?.destroy();session?.destroy();nativeTools?.destroy();pageAppearance?.destroy();}});
  window.addEventListener('pageshow',event=>{if(event.persisted){bootStopped=false;resumeWorkspace();}});
  startup?.onNative(()=>{if(!suspended)showCanvas(false);});
  function initialize(){
    registerFont();
    pageAppearance=globalThis.ReserveNativePage?.create();if(pageAppearance){globalThis.ReservePageAppearance=pageAppearance;pageAppearance.start().catch(()=>{});}
    document.body.append(dock);
    if(!isDashboard){
      const button=document.createElement('button');button.className='reserve-dock-button';button.textContent='Tools';button.title='Quick open, Plan and Calculator · Ctrl K outside an editor';button.setAttribute('aria-label','Open Canvas Harness tools');dockRoot.append(button);
      const css=document.createElement('style');css.textContent='.rd-native-tools{position:fixed;inset:0 auto auto 0;width:0;min-height:0;padding:0;background:none}.reserve-tool-status{display:block;position:absolute;bottom:48px;right:0;width:260px;max-width:calc(100vw - 40px);padding:10px 13px;border:1px solid #dfe3e8;border-radius:9px;box-shadow:0 3px 15px #17212c10;background:#fff;color:#425062;font:12px/1.5 system-ui}.reserve-tool-status[hidden]{display:none}.reserve-dock-button+.reserve-dock-button{margin-left:6px}';dockRoot.append(css);
      nativeTools=globalThis.ReserveNativeTools?.create({button,dockRoot});return;
    }
    try{wanted=wanted&&params.get('reserve')!=='native'&&(params.get('reserve')==='open'||sessionStorage.getItem('reserve:native')!=='true')&&!!startup?.canReveal();}catch{wanted=false;startup?.release();}
    // Styles preload while the session verifies identity; no account data bypasses it.
    if(wanted)start();
  }
  (startup?.preferences||chrome.storage.local.get('reserve:enabled')).then(saved=>{
    mark('enabledPreference');
    if(saved['reserve:enabled']===false||bootStopped)return;
    // Canvas's remaining scripts and markup do not need to block a verified
    // dashboard. Native course tools still initialize after parsing completes.
    launchAttempt=()=>{
      if(bootStopped)return;
      if(!document.head||!document.body||(isDashboard&&!document.getElementById('content'))||(!isDashboard&&document.readyState==='loading'))return;
      stopWaiting();
      // A page on the domain without a Canvas layout (an Instructure website) is left untouched.
      if(!globalThis.ReserveSite.canvasPage(document)){startup?.release();return;}
      try{initialize();}catch{showCanvas(false);}
    };
    document.addEventListener('DOMContentLoaded',launchAttempt,{once:true});
    if(typeof MutationObserver==='function'){
      launchObserver=new MutationObserver(()=>launchAttempt?.());
      launchObserver.observe(document.documentElement||document,{childList:true,subtree:true});
    }
    launchAttempt();
  }).catch(()=>showCanvas(false));
})();
