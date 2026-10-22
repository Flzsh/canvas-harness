/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
// Decorate Canvas's existing course links; Canvas owns their content and layout.
(function(root){
 'use strict';
 let stop=()=>{};
 function load(){
 const Art=root.ReserveCourseNavArt,KEY='reserve:appearance';
 const eligible=()=>root.top===root&&root.ReserveSite?.supported(root.location?.href)&&!root.ReserveSite.vanillaPage(root.location)&&/^\/courses\/[^/]+(?:\/|$)/.test(root.location.pathname);
 if(!Art||!eligible())return;
 // At once, before Canvas paints its menu: the drawn layout from the first frame (course-nav.css comes with the page).
 root.document.documentElement.classList.add('reserve-course-nav');
 let stopped=false,cleanup=()=>{};
 stop=()=>{
  stopped=true;root.document.removeEventListener('DOMContentLoaded',start);
  cleanup();root.document.documentElement.classList.remove('reserve-course-nav');
  delete root.document.documentElement.dataset.cnMotion;
 };

 function kindOf(link){
  for(const node of [link,link.closest('li')])for(const name of node?.classList||[]){
   if(Object.prototype.hasOwnProperty.call(Art.map,name))return Art.map[name];
  }
  return 'tool';
 }
 function start(){
  if(stopped)return;
  // the early class (set at load) is taken back if this turned out not to be a course page with a course menu
  const drop=()=>{if(!root.ReserveCourseNav)root.document.documentElement.classList.remove('reserve-course-nav');};
  if(!eligible()||root.ReserveCourseNav){drop();return;}
  const doc=root.document,menu=doc.querySelector('#left-side #section-tabs, nav[aria-label="Courses Navigation Menu"] #section-tabs');
  if(!menu){drop();return;}
  const html=doc.documentElement;
  const api=root.ReserveCourseNav={kindOf};
  html.classList.add('reserve-course-nav');
  let sheetsReady=0;
  const opening=new Set(),timers=new Set(),sheets=[],decorated=new Set();
  const finishOpening=link=>{if(stopped)return;const timer=root.setTimeout(()=>{timers.delete(timer);if(!stopped)link.classList.remove('cn-opening');},1100);timers.add(timer);};
  for(const file of ['course-nav-art.css']){
   const sheet=doc.createElement('link');sheet.rel='stylesheet';sheet.href=root.chrome.runtime.getURL(file);
   sheet.onload=()=>{if(!stopped&&++sheetsReady===1){for(const link of opening)finishOpening(link);opening.clear();}};
   sheets.push(sheet);
   (doc.head||html).append(sheet);
  }
  let external=null;
  function art(parent,name,svg){
   const span=doc.createElement('span');span.className=name;span.setAttribute('aria-hidden','true');span.innerHTML=svg;
   parent.prepend(span);return span;
  }
  function decorate(link){
   if(stopped||!menu.contains(link)||!link.closest('li'))return;
   decorated.add(link);
   if(!link.classList.contains('cn-i')){
    const name=kindOf(link),icon=art(link,'cn-icon',Art.icons[name]||Art.icons.tool);
    icon.dataset.cnIcon=name;link.classList.add('cn-i');
   }
   const current=link.classList.contains('active');
   if(current&&!link.classList.contains('is-current')){
    link.classList.add('is-current','cn-opening');art(link,'cn-tab',Art.tab);
    // The supplied CSS handles hover/focus. Release the load action once so
    // subsequent interactions can replay it, with no repeating timer or loop.
    if(sheetsReady===1)finishOpening(link);else opening.add(link);
   }else if(!current&&link.classList.contains('is-current')){
    opening.delete(link);link.classList.remove('is-current','cn-opening');link.querySelector(':scope > .cn-tab')?.remove();
   }
   for(const badge of link.querySelectorAll('.nav-badge'))if(!badge.querySelector(':scope > .cn-seal'))art(badge,'cn-seal',Art.seal);
  }
  function rule(){
   const first=[...menu.querySelectorAll('li a')].find(link=>[link,link.closest('li')].some(node=>[...node.classList].some(name=>name.startsWith('context_external_tool_'))))?.closest('li')||null;
   if(first===external)return;
   external?.classList.remove('cn-external-start');first?.classList.add('cn-external-start');external=first;
  }
  for(const link of menu.querySelectorAll('li a'))decorate(link);
  rule();
  const observer=new root.MutationObserver(records=>{
   if(stopped)return;
   const links=new Set();let changedItems=false;
   for(const record of records){
    const owner=record.target.closest?.('a');if(owner)links.add(owner);
    for(const node of record.addedNodes){
     if(node.nodeType!==1||node.matches('.cn-icon, .cn-tab, .cn-seal'))continue;
     if(node.matches('a'))links.add(node);
     for(const link of node.querySelectorAll('li a, a'))links.add(link);
     changedItems=true;
    }
    if(record.removedNodes.length)changedItems=true;
   }
   for(const link of links)decorate(link);
   if(changedItems)rule();
  });
  observer.observe(menu,{childList:true,subtree:true});

  // The menu stays light in either theme: it sits on Canvas's own page, which Canvas Harness never
  // darkens (native-appearance resolves to original or light), just as Canvas's own menu does.
  // Only the device motion preference applies here.
  function appearance(value){
   if(stopped)return;
   html.dataset.cnMotion=root.ReserveFeatures?.enabled('motion')===false||['still','off'].includes(value?.motion)?'off':'on';
  }
  appearance();
  const storage=root.chrome?.storage;let revision=0;
  const changed=(changes,area)=>{
   if(area==='local'&&changes[KEY]){revision++;appearance(changes[KEY].newValue);}
  };
  storage?.onChanged?.addListener(changed);
  cleanup=()=>{
   observer.disconnect();storage?.onChanged?.removeListener?.(changed);
   for(const timer of timers)root.clearTimeout(timer);timers.clear();opening.clear();
   for(const sheet of sheets){sheet.onload=null;sheet.remove();}
   for(const link of decorated){
    for(const node of link.querySelectorAll('.cn-icon, .cn-tab, .cn-seal'))node.remove();
    link.classList.remove('cn-i','is-current','cn-opening');
   }
   external?.classList.remove('cn-external-start');
   if(root.ReserveCourseNav===api)delete root.ReserveCourseNav;
  };
  const reading=revision;
  try{Promise.resolve(storage?.local?.get(KEY)).then(values=>{if(revision===reading)appearance(values?.[KEY]);}).catch(()=>{});}catch{}
 }
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 }
 if(root.ReserveFeatures)root.ReserveFeatures.early('course-nav',load,()=>stop());else load();
})(globalThis);
