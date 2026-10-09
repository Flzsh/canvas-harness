/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(){
  'use strict';
  if(window.top!==window||!globalThis.ReserveSite.supported(location.href)||document.getElementById('reserve-companion-dock'))return;
  const isDashboard=location.pathname==='/'||/^\/dashboard\/?$/.test(location.pathname);
  const params=new URLSearchParams(location.search);
  const startup=globalThis.ReserveStartup;
  let host,root,area,toolbar,statusLabel,dashboard,planner,session,snapshot,store,ready=false,wanted=true,lastCheck=0;
  let manualOpen=false;
  let dashboardState,dashboardScroll=0,restoreScroll=false,nativeTools,pageAppearance,launchPending=true;
  if(params.get('reserve')==='open'){const workspace=params.get('workspace'),courseId=params.get('course');if(['work','hub','materials','inbox','grades'].includes(workspace)||/^\d+$/.test(courseId||''))dashboardState={workspace,courseId};}
  const hidden=new Map();
  const pageStyle=document.createElement('style');
  pageStyle.textContent='html.reserve-inline-active #content-wrapper{max-width:none!important;width:100%!important}html.reserve-inline-active #content{width:100%!important;max-width:none!important;padding:8px 16px 20px!important;box-sizing:border-box!important}html.reserve-inline-active #content-wrapper{flex:1 1 auto!important;min-width:0!important}html.reserve-inline-active #main{width:100%!important;min-width:0!important}html.reserve-inline-active #not_right_side{width:100%!important;min-width:0!important}html.reserve-inline-active #wrapper{max-width:none!important}html.reserve-inline-active #not_right_side{margin-right:0!important;padding-right:0!important}html.reserve-inline-active #right-side-wrapper,html.reserve-inline-active #content>[hidden]{display:none!important}#reserve-companion-host{min-width:0;width:100%}';
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
  function reveal(){
    if(!ready||!wanted||!host||!snapshot||(!dashboard&&!planner)||document.visibilityState==='hidden')return;
    if(!manualOpen&&startup&&!startup.complete())return;
    const content=host.parentElement;
    for(const el of [...content.children,document.getElementById('right-side')]){
      if(!el||el===host||el.contains(host)||hidden.has(el))continue;
      hidden.set(el,el.hidden);el.hidden=true;
    }
    document.documentElement.classList.add('reserve-inline-active');
    host.hidden=false;dock.hidden=true;
  }
  function showCanvas(remember=true){
    wanted=false;planner?.destroy();planner=null;
    if(host)host.hidden=true;restoreNative();dock.hidden=false;
    startup?.release();
    if(!snapshot){session?.destroy();session=null;}
    if(remember){try{sessionStorage.setItem('reserve:native','true');}catch{}}
  }
  function setStatus(message){if(statusLabel)statusLabel.textContent=dashboard?'Canvas Harness 2.17.2':message||'Canvas Harness 2.17.2';dashboard?.setStatus(message);}
  function drawDashboard(){
    if(!area||!snapshot)return;
    if(dashboard)dashboardState=dashboard.getState();
    planner?.destroy();planner=null;dashboard?.destroy();
    // The dashboard's own command bar carries the Canvas dashboard switch (onNative) and its footer
    // the status (setStatus below), so this row folds away while the dashboard shows.
    toolbar.querySelector('[data-dashboard]').hidden=true;toolbar.hidden=true;
    dashboard=ReserveDashboard.mount(area,{snapshot,store,initialState:dashboardState,onPlanner:openPlanner,onNative:()=>showCanvas(),refresh:()=>session.refresh(),onAuthError:()=>{showCanvas();session?.verify();}});
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
    root=host.attachShadow({mode:'open'});
    const loadingHost=host;let loaded=0;
    const sheets=['app.css','dashboard.css','workspace.css','refresh.css','subject-art.css','customize.css','gpa.css'];
    for(const file of sheets){
      const link=document.createElement('link');link.rel='stylesheet';link.href=chrome.runtime.getURL(file);
      link.onload=()=>{if(host===loadingHost&&++loaded===sheets.length){ready=true;reveal();}};
      link.onerror=()=>{if(host===loadingHost)showCanvas(false);};root.append(link);
    }
    const css=document.createElement('style');css.textContent=':host([hidden]){display:none!important}.reserve-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;font:12px/1.5 system-ui;color:#5E5D59;padding:4px 0 12px}.reserve-toolbar div{display:flex;gap:8px}.reserve-toolbar button{font:600 12px system-ui;border:1px solid #D9D6CA;background:#fff;color:#3D3D3A;border-radius:999px;padding:8px 12px;cursor:pointer}.reserve-toolbar button:focus-visible{outline:2px solid #C96442;outline-offset:2px}.reserve-toolbar button[hidden],.reserve-toolbar[hidden]{display:none}';root.append(css);
    toolbar=document.createElement('div');toolbar.className='reserve-toolbar';
    toolbar.innerHTML='<span role="status" aria-live="polite">Canvas Harness</span><div><button data-dashboard hidden>Back to dashboard</button><button data-native>Canvas dashboard</button></div>';
    statusLabel=toolbar.querySelector('span');
    toolbar.querySelector('[data-dashboard]').addEventListener('click',drawDashboard);
    toolbar.querySelector('[data-native]').addEventListener('click',()=>showCanvas());
    area=document.createElement('div');root.append(toolbar,area);content.append(host);
    document.head.append(pageStyle);
  }
  function receive(next,verifiedStore,meta){
    if(!wanted||(!manualOpen&&startup&&!startup.canReveal()))return;
    snapshot=next;store=verifiedStore;
    makeHost();if(!host)return;
    if(planner)planner.updateSnapshot(next);
    else if(dashboard)dashboard.updateSnapshot(next);
    else{drawDashboard();if(launchPending){launchPending=false;const page=params.get('plan'),id=params.get('item');if(['week','assignments'].includes(page))openPlanner({page,id:/^(\d+|local-[\w-]+)$/.test(id||'')?id:null,hideGrades:store.get().settings.showGrades!==true});else if(params.get('appearance')==='true')area.querySelector('[data-rd-action="settings"]')?.click();}}
    if(meta.stale)setStatus('Saved view · Updating in the background…');
    reveal();
  }
  function start(){
    makeHost();
    if(session)return session.start();
    session=ReserveSession.createSession({client:ReserveAPI.createClient(),createStore:ReserveStorage.createStore,onSnapshot:receive,onStatus:setStatus,onError:(error,{clear})=>{
      if(clear){dashboard?.destroy();dashboard=null;snapshot=null;store=null;showCanvas();dashboardState=undefined;dashboardScroll=0;restoreScroll=false;}
      else if(!dashboard&&!planner)showCanvas(false);
      dockRoot.querySelector('button').title=error.message+' Click to retry.';
    }});
    return session.start();
  }
  dockRoot.querySelector('button').addEventListener('click',()=>{
    if(!isDashboard){location.assign((globalThis.ReserveSite.origin()+"/?reserve=open"));return;}
    startup?.release();manualOpen=true;wanted=true;
    try{sessionStorage.removeItem('reserve:native');}catch{}
    if(host&&!ready){host.remove();host=null;}
    makeHost();
    if(snapshot){drawDashboard();return;}
    session?.destroy();session=null;start();
  });
  document.addEventListener('pointerdown',event=>{
    // Do not move a Canvas control out from under a student who has started using it.
    if((!ready||!snapshot)&&wanted&&!startup?.active&&!event.composedPath().includes(dock))showCanvas(false);
  },{passive:true});
  document.addEventListener('visibilitychange',async()=>{
    if(!host||!snapshot)return;
    if(document.visibilityState==='hidden'){host.hidden=true;restoreNative();return;}
    if(Date.now()-lastCheck<30000){reveal();return;}
    if(await session.verify()){lastCheck=Date.now();dashboard?.updateSnapshot(snapshot);reveal();}
  });
  window.addEventListener('pagehide',event=>{if(!event.persisted){planner?.destroy();dashboard?.destroy();session?.destroy();nativeTools?.destroy();pageAppearance?.destroy();}});
  startup?.onNative(()=>showCanvas(false));
  (startup?.preferences||chrome.storage.local.get('reserve:enabled')).then(saved=>{
    if(saved['reserve:enabled']===false)return;
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
  }).catch(()=>showCanvas(false));
})();
