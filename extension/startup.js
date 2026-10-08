/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(){
  'use strict';
  const dashboardPath=()=>location.pathname==='/'||location.pathname==='/dashboard'||location.pathname==='/dashboard/';
  if(window.top!==window||!globalThis.ReserveSite.supported(location.href)||!dashboardPath()||globalThis.ReserveStartup)return;
  // No identity or course data belongs in this prepaint guard. Only display preferences.
  const deadline=performance.now()+2500,subscribers=new Set();
  let state='pending',shell,observer,timer;
  const loginPage=()=>!!document.querySelector('#login_form, #new_login, .ic-Login');
  function cleanup(){
    clearTimeout(timer);observer?.disconnect();
    document.removeEventListener('pointerdown',interact,true);
    document.removeEventListener('keydown',interact,true);
    window.removeEventListener('pagehide',release);
    document.documentElement?.classList.remove('reserve-startup-active');
    shell?.remove();shell=null;
  }
  function release(){
    if(state==='native')return;
    state='native';cleanup();
    for(const fn of subscribers){try{fn();}catch{}}
    subscribers.clear();
  }
  function canReveal(){
    if(state==='native')return false;
    if(!dashboardPath()||loginPage()||(state!=='complete'&&performance.now()>=deadline)){release();return false;}
    return state==='active'||state==='complete';
  }
  function complete(){
    if(!canReveal())return false;
    state='complete';cleanup();subscribers.clear();return true;
  }
  function interact(event){
    if(shell&&(event.composedPath().includes(shell)||shell.contains(event.target)))return;
    release();
  }
  function activate(){
    if(state!=='pending')return;
    if(performance.now()>=deadline||!dashboardPath()||loginPage()){release();return;}
    if(!document.documentElement)return;
    shell=document.createElement('section');shell.id='reserve-startup-shell';
    shell.setAttribute('aria-label','Canvas Harness is opening');
    const header=document.createElement('header'),brand=document.createElement('strong'),escape=document.createElement('a');
    brand.textContent='Canvas Harness';escape.textContent='Canvas dashboard';escape.href=location.pathname+'?reserve=native';
    escape.addEventListener('click',event=>{
      event.preventDefault();
      try{sessionStorage.setItem('reserve:native','true');}catch{}
      release();
    });
    header.append(brand,escape);
    const message=document.createElement('p');message.textContent='Opening your workspace…';message.setAttribute('role','status');
    const layout=document.createElement('div');layout.className='reserve-startup-layout';layout.setAttribute('aria-hidden','true');
    for(const kind of ['rail','work','information']){
      const panel=document.createElement('div');panel.className='reserve-startup-'+kind;
      for(let i=0;i<4;i++){const line=document.createElement('i');panel.append(line);}
      layout.append(panel);
    }
    shell.append(header,message,layout);document.documentElement.append(shell);
    // If the bundled prepaint CSS failed, never apply the native-content gate.
    if(getComputedStyle(shell).getPropertyValue('--reserve-startup-ready').trim()!=='1'){release();return;}
    state='active';document.documentElement.classList.add('reserve-startup-active');
  }
  globalThis.ReserveStartup={canReveal,complete,release,
    get active(){return state==='active';},
    onNative(fn){if(state==='native')fn();else if(state!=='complete')subscribers.add(fn);}
  };
  timer=setTimeout(release,2500);
  document.addEventListener('pointerdown',interact,true);
  document.addEventListener('keydown',interact,true);
  window.addEventListener('pagehide',release);
  // Manifest CSS is inert until the preference read succeeds; storage failure is native.
  globalThis.ReserveStartup.preferences=Promise.resolve().then(()=>chrome.storage.local.get('reserve:enabled')).then(saved=>{
    if(state==='native')return saved;
    const params=new URLSearchParams(location.search);
    let native;
    try{native=sessionStorage.getItem('reserve:native')==='true';}catch{release();return saved;}
    if(saved['reserve:enabled']===false||params.get('reserve')==='native'||(native&&params.get('reserve')!=='open')){release();return saved;}
    observer=new MutationObserver(()=>{
      try{if(loginPage()||!dashboardPath())release();else if(state==='pending')activate();}catch{release();}
    });
    observer.observe(document.documentElement||document,{childList:true,subtree:true});
    activate();return saved;
  }).catch(()=>{release();return {'reserve:enabled':false};});
})();
