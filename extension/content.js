// Adapted from Gary Wu's pull request #47 to Canvas Harness.
/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(){
  'use strict';
  if(window.top!==window)return;
  const feature=id=>!globalThis.ReserveFeatures||globalThis.ReserveFeatures.enabled(id);
  let tries=0;
  (function boot(){
  if(!globalThis.ReserveSite||(globalThis.ReserveFeatures&&!globalThis.ReserveFeatureLoad)){if(++tries<=80)setTimeout(boot,tries<4?0:25);else console.warn('Canvas Harness page scripts did not load; reload Canvas.');return;}
  if(!globalThis.ReserveSite.supported(location.href)||globalThis.ReserveSite.vanillaPage(location)||globalThis.ReserveContentStarted||document.getElementById('reserve-companion-dock'))return;
  globalThis.ReserveContentStarted=true;
  const isDashboard=location.pathname==='/'||/^\/dashboard\/?$/.test(location.pathname);
  const params=new URLSearchParams(location.search);
  const startup=globalThis.ReserveStartup;
  const build='3.5.0';
  const stamp=()=>Math.round(globalThis.performance?.now?.()||0);
  let host,root,area,toolbar,resumeCover,statusLabel,dashboard,planner,session,snapshot,store,ready=false,wanted=true;
  let authorized=false,personalVerified=false,suspended=false,resumeGeneration=0,resumePending,verifiedAt=-Infinity,verifiedWall=-Infinity;
  let launchObserver,launchAttempt,bootStopped=false;
  // "Open at once" (off unless the owner turns it on) remembers which account to open: an id, nothing else.
  const HINT_KEY='reserve:lastAccount:'+location.origin;let ownerHint=null;
  const quickOpen=settings=>settings?.quickOpen==='on';
  if(isDashboard)try{Promise.resolve(chrome.storage.local.get(HINT_KEY)).then(found=>{const id=String(found?.[HINT_KEY]??'');if(/^\d+$/.test(id))ownerHint={id};}).catch(()=>{});}catch{}
  function stopWaiting(){launchObserver?.disconnect();launchObserver=null;if(launchAttempt)document.removeEventListener?.('DOMContentLoaded',launchAttempt);launchAttempt=null;}
  let manualOpen=false;
  let dashboardState,dashboardScroll=0,restoreScroll=false,nativeTools,pageAppearance,launchPending=true,launchAppearance=params.get('appearance')==='true';
  if(params.get('reserve')==='open'){const requested=params.get('workspace'),workspace=globalThis.ReserveFeatures?globalThis.ReserveFeatures.workspace(requested):requested,courseId=params.get('course');if(['work','hub','materials','inbox','grades'].includes(workspace)||/^\d+$/.test(courseId||''))dashboardState={workspace,courseId};}
  const hidden=new Map();
  const pageStyle=document.createElement('style');
  pageStyle.textContent='html.reserve-inline-active{scrollbar-width:none}html.reserve-inline-active::-webkit-scrollbar{display:none}html.reserve-inline-active :is(body,#application,#wrapper,#main,#not_right_side,#content-wrapper){scrollbar-width:none}html.reserve-inline-active :is(body,#application,#wrapper,#main,#not_right_side,#content-wrapper)::-webkit-scrollbar{display:none}html.reserve-inline-active :is(#footer,.ic-app-footer,footer[role=contentinfo]){display:none!important}html.reserve-inline-active.reserve-fit,html.reserve-inline-active.reserve-fit body{overflow-y:hidden!important}html.reserve-inline-active body{margin:0!important}html.reserve-inline-active #content-wrapper{max-width:none!important;width:100%!important}html.reserve-inline-active #content{width:100%!important;max-width:none!important;padding:0!important;box-sizing:border-box!important}html.reserve-inline-active #content-wrapper{flex:1 1 auto!important;min-width:0!important}html.reserve-inline-active #main{width:100%!important;min-width:0!important}html.reserve-inline-active #not_right_side{width:100%!important;min-width:0!important}html.reserve-inline-active #wrapper{max-width:none!important}html.reserve-inline-active #not_right_side{margin-right:0!important;padding-right:0!important}html.reserve-inline-active #right-side-wrapper,html.reserve-inline-active #right-side,html.reserve-inline-active #content>:not(#reserve-companion-host){display:none!important}#reserve-companion-host{min-width:0;width:100%}';
  const dock=document.createElement('div');dock.id='reserve-companion-dock';
  dock.style.cssText='position:fixed;bottom:16px;right:16px;z-index:1000';
  const dockRoot=dock.attachShadow({mode:'open'});
  dockRoot.innerHTML='<style>.reserve-dock-button{position:relative;display:inline-flex;align-items:center;vertical-align:middle;gap:7px;font:600 13.5px Literata,Georgia,serif;color:#141413;background:#FAF9F5;border:0;border-radius:14px;padding:8px 16px 8px 11px;box-shadow:2px 3px 0 #E3D9C6,0 8px 22px rgb(60 48 24 / .14);cursor:pointer;transition:transform 120ms cubic-bezier(.25,.1,.25,1),box-shadow 120ms cubic-bezier(.25,.1,.25,1),background-color 140ms}.reserve-dock-button::after{content:"";position:absolute;inset:-5px;border:14px solid transparent;pointer-events:none;background:color-mix(in srgb,#A9522F 70%,#141413);-webkit-mask-box-image:url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2790%27 height=%2790%27 viewBox=%270 0 90 90%27%3E%3Cpath fill=%27none%27 stroke=%27%23000%27 stroke-width=%273%27 stroke-linecap=%27round%27 d=%27M24 6.2C34 5.4 56 6.6 66 5.8C77 5.6 84.6 12 84.4 24C85 36 83.8 54 84.6 66C84.8 77.6 78 84.6 66 84.4C54 85 36 83.8 24 84.6C12.4 84.8 5.4 78 5.6 66C5 54 6.2 36 5.4 24C5.2 12.6 11.6 6 21.4 6.4C24 6.3 27 5.6 29.6 4.8%27/%3E%3C/svg%3E\") 30 30 30 30 stretch}.reserve-dock-button+.reserve-dock-button{margin-left:10px}.reserve-dock-button:hover{transform:translateY(-1px);background:#FFFDF8;box-shadow:2px 4px 0 #E3D9C6,0 10px 26px rgb(60 48 24 / .18)}.reserve-dock-button:active{transform:translateY(2px);background:#F1ECE0;box-shadow:0 1px 0 #E3D9C6,0 4px 12px rgb(60 48 24 / .14)}.reserve-dock-button:focus-visible{outline:3px solid #C96442;outline-offset:4px}.reserve-dock-button .dock-ic{width:22px;height:22px;flex:none;overflow:visible}.reserve-dock-button .k{fill:none;stroke:#2B2A27;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.reserve-dock-button[aria-busy=true]{cursor:progress;background:#F1ECE0;transform:translateY(1px)}.reserve-dock-button[aria-busy=true] .dock-ic{animation:dock-nod 900ms ease-in-out infinite}.reserve-dock-button[aria-busy=true] .dock-t::after{content:"";display:block;height:2px;margin-top:1px;border-radius:2px;background:#A9522F;transform-origin:left;animation:dock-line 1.1s ease-in-out infinite}@keyframes dock-nod{50%{transform:rotate(-8deg)}}@keyframes dock-line{0%{transform:scaleX(0)}60%{transform:scaleX(1)}100%{transform:scaleX(1);opacity:0}}@media(prefers-reduced-motion:reduce){.reserve-dock-button,.reserve-dock-button *{transition:none;animation:none!important}}</style><button class="reserve-dock-button" title="Show the Canvas Harness dashboard"><svg class="dock-ic" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M7.4 30.6h27.2v5H7.4z" fill="#E6C478"/><path d="M9.6 9.6h6.6v21.4H9.6z" fill="#B7CBA5"/><path d="M19 12.8l6.2-1.8 6.6 19-6.2 1.8z" fill="#DE9A7C"/><path class="k" d="M6.4 30.2c9.4-.3 18.8-.3 28.2 0 .3 1.6.3 3.4 0 5-9.4.3-18.8.3-28.2 0-.3-1.6-.3-3.4 0-5z"/><path class="k" d="M8.8 8.8c2.2-.2 4.4-.2 6.6 0 .3 7.1.3 14.2 0 21.3-2.2.2-4.4.2-6.6 0-.3-7.1-.3-14.2 0-21.3z"/><path class="k" d="M18.2 12.4l6.4-2 6.8 19.8-6.4 2z"/></svg><span class="dock-t">Canvas Harness</span></button>';
  // The dock button answers at once: it presses in and says it is opening, until the workspace or an error arrives.
  const dockButton=dockRoot.querySelector('button'),dockLabel=dockButton.querySelector('.dock-t')||dockButton,dockText=dockLabel.textContent;let dockTimer=0;
  function dockBusy(on){globalThis.clearTimeout?.(dockTimer);if(on){dockButton.setAttribute?.('aria-busy','true');dockLabel.textContent='Opening\u2026';dockTimer=globalThis.setTimeout?.(()=>dockBusy(false),12000);}else{dockButton.removeAttribute?.('aria-busy');dockLabel.textContent=dockText;}}
  // Literata (OFL, bundled: roman and italic) sets Canvas Harness's titles and reading
  // text. @font-face does not apply inside a shadow root, so both faces are
  // registered on the page's font set once; each downloads only when first used.
  function registerFont(){
    try{if(!document.fonts||[...document.fonts].some(face=>face.family.replace(/["']/g,'')==='Literata'))return;for(const [file,style] of [['fonts/literata-latin.woff2','normal'],['fonts/literata-latin-italic.woff2','italic']])document.fonts.add(new FontFace('Literata',`url(${chrome.runtime.getURL(file)}) format('woff2')`,{weight:'200 900',style,display:'swap'}));}catch{}
  }
  function restoreNative(){
    for(const [el,previous] of hidden)el.hidden=previous;
    hidden.clear();document.documentElement.classList.remove('reserve-inline-active','reserve-fit');
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
    if(!ready||!wanted||!authorized||suspended||bootStopped||!host||!snapshot||(!dashboard&&!planner)||(!planner&&dashboard?.isReady?.()===false)||document.visibilityState==='hidden')return;
    if(startup){if(manualOpen)startup.dismiss?.();else if(!startup.complete())return;}
    const content=host.parentElement;
    for(const el of [...content.children,document.getElementById('right-side')]){
      if(!el||el===host||el.contains(host)||hidden.has(el))continue;
      hidden.set(el,el.hidden);el.hidden=true;
    }
    document.documentElement.classList.add('reserve-inline-active');
    coverWorkspace(false);
    host.hidden=false;dock.hidden=true;
  }
  function showCanvas(remember=true){
    authorized=false;personalVerified=false;resumeGeneration++;
    dashboard?.closePersonalFiles?.();
    wanted=false;planner?.destroy();planner=null;
    if(host)host.hidden=true;coverWorkspace(false);restoreNative();dock.hidden=false;
    startup?.release();
    session?.destroy();session=null;
  }
  function setStatus(message){if(statusLabel)statusLabel.textContent=dashboard?'Canvas Harness '+build:message||'Canvas Harness '+build;dashboard?.setStatus(message);}
  function openAppearance(){if(!launchAppearance||!feature('customization'))return;const button=area?.querySelector('[data-rd-action="settings"]');if(button){launchAppearance=false;button.click();}}
  function resumePersonalFiles(){personalVerified=true;dashboard?.resumePersonalFiles?.();}
  function drawDashboard(){
    if(!area||!snapshot||!feature('dashboard'))return;
    if(dashboard)dashboardState=dashboard.getState();
    planner?.destroy();planner=null;dashboard?.destroy();
    // The dashboard's own command bar carries the Canvas dashboard switch (onNative) and its footer
    // the status (setStatus below), so this row folds away while the dashboard shows.
    toolbar.querySelector('[data-dashboard]').hidden=true;toolbar.hidden=true;
    dashboard=ReserveDashboard.mount(area,{snapshot,store,personalVerified,initialState:dashboardState,onPlanner:openPlanner,onNative:()=>showCanvas(),refresh:()=>session.refresh(),onAuthError:()=>{showCanvas();session?.verify();},onReady:()=>{openAppearance();reveal();},onRenderError:error=>{dashboard?.destroy();dashboard=null;showCanvas(false);setStatus(error.message);dockBusy(false);dockRoot.querySelector('button').title=error.message+' Click to retry.';}});

    if(personalVerified)dashboard?.resumePersonalFiles?.();else dashboard?.closePersonalFiles?.();
    reveal();
    if(restoreScroll){restoreScroll=false;requestAnimationFrame(()=>window.scrollTo({top:dashboardScroll,behavior:'instant'}));}
  }
  function openPlanner(options={page:'week'}){
    if(!snapshot||!area||!feature('dashboard')||options.page==='settings'&&!feature('customization')||options.page!=='settings'&&!feature(options.page==='grades'?'grades':'planner'))return;
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

    root=host.attachShadow({mode:'open'});
    const loadingHost=host;let loaded=0;
    const allSheets=startup?.styleFiles||['app.css','dashboard.css','workspace.css','refresh.css','subject-art.css','customize.css','media-frame.css','frame-editor.css','settings-dock.css','gpa.css','selection.css','responsive-layout.css','widgets.css','pet.css','scene-themes.css','course-links.css'];
    const sheets=globalThis.ReserveFeatures?.filterFiles(allSheets)||allSheets;
    if(!sheets.length)ready=true;
    for(const file of sheets){
      const link=document.createElement('link');link.rel='stylesheet';link.href=chrome.runtime.getURL(file);
      link.onload=()=>{if(host===loadingHost&&++loaded===sheets.length){ready=true;reveal();}};
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
    authorized=true;personalVerified=!meta?.unverified;if(!meta?.unverified){verifiedAt=stamp();verifiedWall=Date.now();}
    if(!meta?.unverified)try{
      const id=String(next.user?.id??''),on=quickOpen(verifiedStore.get().settings);
      if(on&&/^\d+$/.test(id)&&ownerHint?.id!==id){ownerHint={id};Promise.resolve(chrome.storage.local.set({[HINT_KEY]:id})).catch(()=>{});}
      else if(!on&&ownerHint){ownerHint=null;Promise.resolve(chrome.storage.local.remove(HINT_KEY)).catch(()=>{});}
    }catch{}
    makeHost();if(!host)return;
    if(planner)planner.updateSnapshot(next);
    else if(dashboard)dashboard.updateSnapshot(next);
    else{drawDashboard();if(launchPending){launchPending=false;const page=params.get('plan'),id=params.get('item');if(['week','assignments'].includes(page))openPlanner({page,id:/^(\d+|local-[\w-]+)$/.test(id||'')?id:null,hideGrades:store.get().settings.showGrades!==true});else if(dashboard?.isReady?.()!==false)openAppearance();}}
    if(personalVerified)resumePersonalFiles();else dashboard?.closePersonalFiles?.();
    if(meta.stale)setStatus('Saved view · Updating in the background…');
    reveal();
  }
  function start(){
    makeHost();
    if(session)return session.start();
    session=ReserveSession.createSession({client:ReserveAPI.createClient(),createStore:ReserveStorage.createStore,...(ownerHint?{prefetchedProfile:ownerHint,quickOpen}:{}),
      onSnapshot:receive,onStatus:setStatus,onError:(error,{clear})=>{
      if(clear){if(ownerHint){ownerHint=null;try{Promise.resolve(chrome.storage.local.remove(HINT_KEY)).catch(()=>{});}catch{}}dashboard?.destroy();dashboard=null;snapshot=null;store=null;showCanvas();dashboardState=undefined;dashboardScroll=0;restoreScroll=false;}
      else if(!dashboard&&!planner)showCanvas(false);
      dockBusy(false);dockRoot.querySelector('button').title=error.message+' Click to retry.';
    }});
    return session.start();
  }
  dockRoot.querySelector('button').addEventListener('click',()=>{
    dockBusy(true);
    if(!isDashboard||!feature('dashboard')){
      if(!feature('tools'))return;location.assign(globalThis.ReserveSite.origin()+'/?reserve=open');return;}
    startup?.release();manualOpen=true;wanted=true;
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
    dashboard?.closePersonalFiles?.();
    suspended=true;authorized=false;personalVerified=false;resumeGeneration++;resumePending=null;
    if(keepPlace){coverWorkspace(true);dock.hidden=true;}
    else{if(host)host.hidden=true;coverWorkspace(false);restoreNative();dock.hidden=false;}
    if(snapshot)session?.suspend();else{session?.destroy();session=null;}
    startup?.release();
  }
  function resumeWorkspace(){
    if(resumePending)return resumePending;
    if(!isDashboard||!wanted||!host||bootStopped||document.visibilityState==='hidden')return;
    if(!!document.querySelector('#login_form, #new_login, .ic-Login')||!(location.pathname==='/'||/^\/dashboard\/?$/.test(location.pathname))){showCanvas(false);return;}
    // A page that loaded while its tab was hidden and was never shown: a check finished moments ago opens it now,
    // and a first load still running carries on (it reveals itself). Only an older or interrupted check rechecks.
    // Both clocks must agree the check is recent: performance.now() stands still while the computer sleeps.
    if(!suspended){if(authorized&&snapshot&&(dashboard||planner)&&stamp()-verifiedAt<30000&&Math.abs(Date.now()-verifiedWall)<30000){reveal();return;}if(session&&verifiedAt===-Infinity){if(snapshot)reveal();return;}}
    suspended=false;manualOpen=true;const epoch=resumeGeneration;
    // With "Open at once" the workspace shows as the tab returns; the check below still runs and closes it on failure.
    try{if(snapshot&&session&&quickOpen(store?.get().settings)){authorized=true;reveal();}}catch{}
    const operation=(async()=>{
      if(!snapshot||!session){session?.destroy();session=null;return start();}
      const verified=await session.verify();
      if(epoch!==resumeGeneration||!wanted||suspended||bootStopped||document.visibilityState==='hidden')return;
      if(!verified){showCanvas(false);return;}
      // Lift the cover first; the refresh of what it shows (times, anything saved meanwhile) follows the first frame.
      authorized=true;resumePersonalFiles();reveal();
      const refresh=()=>{if(epoch===resumeGeneration&&!suspended&&wanted&&snapshot)dashboard?.updateSnapshot(snapshot);};
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(refresh,0));else refresh();
    })().catch(()=>{if(epoch===resumeGeneration)showCanvas(false);});
    resumePending=operation;operation.finally(()=>{if(resumePending===operation)resumePending=null;});return operation;
  }
  document.addEventListener('visibilitychange',()=>{
    // Leaving a tab while its first load still runs behind the opening cover keeps that load: the cover waits, unseen.
    if(document.visibilityState==='hidden'){if(startup?.active&&!manualOpen&&!suspended&&host?.hidden!==false)return;pauseWorkspace();}else resumeWorkspace();
  });
  window.addEventListener('pagehide',event=>{bootStopped=true;stopWaiting();pauseWorkspace();if(!event.persisted){planner?.destroy();dashboard?.destroy();session?.destroy();nativeTools?.destroy();pageAppearance?.destroy();}});
  window.addEventListener('pageshow',event=>{if(event.persisted){bootStopped=false;resumeWorkspace();}});
  startup?.onNative(()=>{if(!suspended)showCanvas(false);});
  function initialize(){
    if(globalThis.ReserveSite.vanillaPage(location))return;
    registerFont();
    pageAppearance=feature('native-appearance')?globalThis.ReserveNativePage?.create():null;if(pageAppearance){globalThis.ReservePageAppearance=pageAppearance;pageAppearance.start().catch(()=>{});}
    dockButton.hidden=!feature('dashboard');
    document.body.append(dock);
    if(!isDashboard||!feature('dashboard')){
      if(!feature('tools'))return;
      const button=document.createElement('button');button.className='reserve-dock-button';button.textContent='Tools';button.title='Quick open, Plan and Calculator · Ctrl K outside an editor';button.setAttribute('aria-label','Open Canvas Harness tools');dockRoot.append(button);
      const css=document.createElement('style');css.textContent='.rd-native-tools{position:fixed;inset:0 auto auto 0;width:0;min-height:0;padding:0;background:none}.reserve-tool-status{display:block;position:absolute;bottom:48px;right:0;width:260px;max-width:calc(100vw - 40px);padding:10px 13px;border:1px solid #dfe3e8;border-radius:9px;box-shadow:0 3px 15px #17212c10;background:#fff;color:#425062;font:12px/1.5 system-ui}.reserve-tool-status[hidden]{display:none}.reserve-dock-button+.reserve-dock-button{margin-left:6px}';dockRoot.append(css);
      nativeTools=globalThis.ReserveNativeTools?.create({button,dockRoot});return;
    }
    try{wanted=wanted&&params.get('reserve')!=='native'&&!!startup?.canReveal();}catch{wanted=false;startup?.release();}
    // Styles preload while the session verifies identity; no account data bypasses it.
    if(wanted)start();
  }
  Promise.all([startup?.preferences||chrome.storage.local.get('reserve:enabled'),globalThis.ReserveFeatureLoad]).then(([saved,loaded])=>{

    if(saved['reserve:enabled']===false||loaded?.ok===false||bootStopped)return;
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
})();
