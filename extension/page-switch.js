/*! Canvas Harness: the switch on an assignment's own pages (instructions, submitting, submission details, feedback). */
// Off: Canvas Harness lets go of this assignment's pages at once and on every visit until it is switched back on: the drawn menu
// bar, the PDF reader and the after-submit scene and tray stop, nothing of Canvas Harness is drawn there but this switch, nothing
// is asked of Canvas, and nothing reloads the page (site.js pageOff, read by features.js before the first frame). The worker is still asked
// once, as on every Canvas page: the add-ons' files come and stay asleep, so switching back on needs no reload. The switch
// itself is the one thing of ours left there, in the page's own flow at the top (never fixed, never near Submit), so it can be
// turned on again.
// Static and on its own: it works when an add-on, the worker or the loader does not.
(function(root){
 'use strict';
 const doc=root.document,site=root.ReserveSite;
 if(root.top!==root||!doc||root.ReservePageSwitch||!site?.supported?.(root.location?.href)||!site.vanillaPage(root.location))return;
 // (tools: Multitask's Open beside and Tools, multitask.js, 4.2)
 const PARTS=['canvas-nav','pdf','play','tools'];
 let name='Canvas Harness';try{name=root.chrome?.runtime?.getManifest?.()?.short_name||name;}catch{}
 const BOOKS='<svg class="ic" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M7.4 30.6h27.2v5H7.4z" fill="#E6C478"/><path d="M9.6 9.6h6.6v21.4H9.6z" fill="#B7CBA5"/><path d="M19 12.8l6.2-1.8 6.6 19-6.2 1.8z" fill="#DE9A7C"/><path class="k" d="M6.4 30.2c9.4-.3 18.8-.3 28.2 0 .3 1.6.3 3.4 0 5-9.4.3-18.8.3-28.2 0-.3-1.6-.3-3.4 0-5z"/><path class="k" d="M8.8 8.8c2.2-.2 4.4-.2 6.6 0 .3 7.1.3 14.2 0 21.3-2.2.2-4.4.2-6.6 0-.3-7.1-.3-14.2 0-21.3z"/><path class="k" d="M18.2 12.4l6.4-2 6.8 19.8-6.4 2z"/></svg>';
 const KNOB='<svg class="kn" viewBox="0 0 38 22" aria-hidden="true" focusable="false"><path class="wash" d="M10.4 4.6c6-.4 12-.4 18 0 3.8.2 6.8 3 6.8 6.6s-3 6.6-6.8 6.8c-6 .4-12 .4-18 0-3.8-.2-6.8-3.2-6.8-6.8s3-6.4 6.8-6.6z"/><path class="line" d="M9 3.6c6.2-.4 12.4-.4 18.6 0 4 .2 7 3.2 7 7s-3 6.8-7 7c-6.2.4-12.4.4-18.6 0-4-.2-7-3.2-7-7s3-6.8 7-7z"/><g class="knob"><path d="M5.6 10.6c-.1-2.6 1.9-4.7 4.6-4.6 2.5 0 4.5 2 4.4 4.6-.1 2.6-2.1 4.6-4.6 4.5-2.5 0-4.5-2-4.4-4.5z"/><path class="glint" d="M8.4 8.5c.7-.5 1.5-.5 2.2 0"/></g></svg>';
 // The dock button's pen frame (content.js), the toolbar's drawn knob (dashboard-view.js), Canvas's own page stays light.
 const PEN='url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2790%27 height=%2790%27 viewBox=%270 0 90 90%27%3E%3Cpath fill=%27none%27 stroke=%27%23000%27 stroke-width=%273%27 stroke-linecap=%27round%27 d=%27M24 6.2C34 5.4 56 6.6 66 5.8C77 5.6 84.6 12 84.4 24C85 36 83.8 54 84.6 66C84.8 77.6 78 84.6 66 84.4C54 85 36 83.8 24 84.6C12.4 84.8 5.4 78 5.6 66C5 54 6.2 36 5.4 24C5.2 12.6 11.6 6 21.4 6.4C24 6.3 27 5.6 29.6 4.8%27/%3E%3C/svg%3E") 30 30 30 30 stretch';
 const CSS=':host{all:initial;display:flex;align-items:center;gap:12px;flex:0 1 auto;min-width:0;margin:0 0 0 auto;padding:6px 2px 6px 14px;color:#141413;font:13px/1.3 "Segoe UI",Lato,system-ui,sans-serif}'
  +':host([data-place=content]){margin:0 0 14px;padding:0;justify-content:flex-end}:host([hidden]){display:none}'
  +'.sw{position:relative;flex:none;display:inline-flex;align-items:center;gap:8px;margin:4px;padding:5px 8px 5px 9px;border:0;border-radius:12px;background:#FAF9F5;color:inherit;font:600 13px/1.2 Literata,Georgia,"Palatino Linotype",serif;white-space:nowrap;cursor:pointer;box-shadow:2px 3px 0 #E3D9C6;transition:transform 120ms cubic-bezier(.25,.1,.25,1),box-shadow 120ms cubic-bezier(.25,.1,.25,1),background-color 140ms}'
  +'.sw::after{content:"";position:absolute;inset:-4px;border:13px solid transparent;pointer-events:none;background:color-mix(in srgb,#A9522F 70%,#141413);-webkit-mask-box-image:'+PEN+'}'
  +'.sw:hover{transform:translateY(-1px);background:#FFFDF8;box-shadow:2px 4px 0 #E3D9C6}.sw:active{transform:translateY(1px);background:#F1ECE0;box-shadow:0 1px 0 #E3D9C6}.sw:focus-visible{outline:3px solid #C96442;outline-offset:5px}'
  +'.ic{width:20px;height:20px;flex:none;overflow:visible;transition:opacity 160ms,filter 160ms}.ic .k{fill:none;stroke:#2B2A27;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}'
  +'.kn{display:block;width:38px;height:22px;flex:none;overflow:visible}.kn .wash{fill:color-mix(in srgb,#141413 12%,#FAF9F5);transition:fill 180ms ease}.kn .line{fill:none;stroke:#141413;stroke-width:1.3;stroke-linejoin:round}'
  +'.kn .knob{transition:transform 220ms cubic-bezier(.3,1.5,.5,1)}.kn .knob path{fill:#FFFDF8;stroke:#141413;stroke-width:1.3}.kn .knob .glint{fill:none;stroke-width:.8;opacity:.6}'
  +'.sw[aria-checked=true] .wash{fill:var(--chn-accent,#C96442)}.sw[aria-checked=true] .knob{transform:translateX(17px)}.sw[aria-checked=false] .ic{opacity:.62;filter:grayscale(1)}'
  +'.note{flex:0 1 auto;min-width:0;max-width:27ch;color:#5E5D59}.sw[aria-checked=false]+.note{display:none}'
  +'@media(prefers-reduced-motion:reduce){*{transition:none!important}}';
 let host=null,shadow=null,button=null,out=false,stopWaiting=null;
 const features=()=>root.ReserveFeatures;
 const off=()=>{try{return site.pageOff(root.location);}catch{return false;}};
 // Shown while Canvas Harness has something of its own here (the drawn menu, the PDF reader or the after-submit scene), or while it
 // is off here (the way back). Not while "On Canvas" is off everywhere: then nothing of ours belongs on Canvas at all.
 const everywhereOff=()=>{try{return root.localStorage?.getItem(features()?.OFFHINT||'reserve:off')==='1';}catch{return false;}};
 function wanted(){
  if(everywhereOff())return false;
  if(off())return true;
  const chosen=features()?.chosen;
  return !chosen||!chosen.off&&PARTS.some(id=>chosen.enabled.includes(id));
 }
 function render(){
  if(!host)return;
  // "On Canvas" switched off while the page is open: the switch leaves the page with everything else of ours (not kept there
  // hidden); switched on again, it is put back in its place, with no reload either way
  if(everywhereOff()){takeOut();return;}
  if(out){out=false;if(!place()){wait();return;}}
  const show=wanted();host.hidden=!show;if(!show)return;
  const on=!off();
  if(button.getAttribute('aria-checked')!==String(on))button.setAttribute('aria-checked',String(on));
 }
 function place(){
  // the end of Canvas's breadcrumb row; where that row is not shown (a narrow window), the top of the page's content
  const crumbs=doc.querySelector('.ic-app-nav-toggle-and-crumbs');
  if(crumbs&&crumbs.getClientRects().length){host.removeAttribute('data-place');crumbs.append(host);return true;}
  const content=doc.getElementById('content');
  if(content){host.setAttribute('data-place','content');content.prepend(host);return true;}
  return false;
 }
 function takeOut(){
  if(out)return;
  out=true;stopWaiting?.();
  try{host.remove();}catch{}
 }
 function press(){
  const now=!off();
  try{site.setPageOff(now,root.location);}catch{}
  try{features()?.refresh?.();}catch{}
  render();
 }
 // Canvas's breadcrumb row and the page's content not there yet when the page is ready: one observer looks for them for
 // a few seconds at most (a cheap lookup per batch of changes; placing only once one of them is there), then lets go.
 const WAIT=8000;
 function wait(){
  let observer=null,timer=0;
  stopWaiting?.();
  const done=()=>{observer?.disconnect();observer=null;root.clearTimeout?.(timer);timer=0;if(stopWaiting===done)stopWaiting=null;};
  const look=()=>{if(!doc.querySelector('.ic-app-nav-toggle-and-crumbs')&&!doc.getElementById('content'))return;if(place()){done();render();}};
  try{observer=new root.MutationObserver(look);observer.observe(doc.documentElement||doc.body,{childList:true,subtree:true});}catch{observer=null;}
  if(observer){timer=root.setTimeout?.(done,WAIT)||0;stopWaiting=done;}
 }
 let waiting=false;
 function mount(){
  if(host||!doc.body)return;
  // "On Canvas" off: nothing of ours on this page at all, not even this switch hidden; it comes once the page is on again
  if(everywhereOff()){if(!waiting){waiting=true;try{features()?.onApply?.(()=>{if(waiting&&!everywhereOff()){waiting=false;mount();}});}catch{}}return;}
  host=doc.createElement('reserve-page-switch');host.hidden=true;
  shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML='<style>'+CSS+'</style><button type="button" class="sw" role="switch" aria-checked="true" aria-describedby="ps-note">'+BOOKS+'<span class="t"></span>'+KNOB+'</button><span class="note" id="ps-note">Submitting, or the page acting up? Switch this off.</span>';
  button=shadow.querySelector('.sw');button.querySelector('.t').textContent=name+' on this page';
  button.addEventListener('click',press);
  try{features()?.onApply?.(render);}catch{}
  // switched in another tab: this page follows at once (also while the switch is still waiting for its place)
  root.addEventListener?.('storage',event=>{if(event.key===site.PAGE_OFF||event.key===null){try{features()?.refresh?.();}catch{}render();}});
  if(place())render();else wait();
 }
 root.ReservePageSwitch={mount,render,get host(){return host;}};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(globalThis);
