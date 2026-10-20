/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// Canvas's own menu bar (#header) in the workspace's hand-drawn style (canvas-nav.css). This only decorates: Canvas's
// links, badges, trays and keyboard behaviour stay Canvas's. Off with the popup's "Menu bar: Canvas original".
(function(root){
 'use strict';
 // The stored choice -> the bar's layout. 'drawn' (the default) is the drawer.
 const LAYOUTS={drawn:'drawer',shown:'column',top:'top'};
 const KEY='reserve:canvasNav',PALETTE='reserve:navPalette',LOGO='reserve:navLogo';
 // The drawings: ink lines over flat washes set a little off them, in the course art's palette. x-* parts move on hover.
 const DRAWINGS={
  account:'<path d="M10 37c1-7 5-10.5 10.6-10.5S30 30 31 37z" fill="#9DB4C8"/><g class="x-wave"><circle cx="21" cy="17" r="7.4" fill="#ECC5A0"/><path d="M13.6 14.4c1-4.6 4.3-7 8-6.8 3.8.2 6.6 2.9 7 6.6-2.4-1.2-4.6-3.4-5.6-5.4-1.6 2.8-5 4.8-9.4 5.6z" fill="#B98A55"/><path class="k" d="M12.6 16.4c-.1-4.8 3.1-8.2 7.4-8.3 4.4-.1 7.6 3.2 7.6 7.8 0 4.6-3.2 8.2-7.5 8.3-4.2 0-7.4-3.3-7.5-7.8z"/><path class="k" d="M13 13.8c4.3-.6 7.4-2.6 9-5.4 1 2.1 3.2 4.3 5.6 5.5"/><circle class="d" cx="17.6" cy="17.2" r=".9"/><circle class="d" cx="22.8" cy="17.2" r=".9"/><path class="h" d="M18.4 20.6c1 .8 2.4.8 3.4 0"/></g><path class="k" d="M8.6 36.4c1-6.8 5.3-10.6 11.4-10.6 6 0 10.4 3.8 11.4 10.6"/><path class="k" d="M16.6 26.4l3.4 4.6 3.4-4.6"/><path class="h" d="M12.4 32.6l1.6 3.4M27.8 32.4l-1.6 3.6"/>',
  dashboard:'<path d="M7.6 27.4a12.8 12.8 0 0 1 6-10.9l3 5.2a6.8 6.8 0 0 0-3 5.7z" fill="#B7CBA5"/><path d="M14.4 16.1a12.8 12.8 0 0 1 12.2 0l-3 5.2a6.8 6.8 0 0 0-6.2 0z" fill="#E6C478"/><path d="M27.4 16.5a12.8 12.8 0 0 1 6 10.9h-6a6.8 6.8 0 0 0-3-5.7z" fill="#DE9A7C"/><path class="k" d="M6.2 27.2c-.1-7.9 6.2-14 13.8-14.1 7.8-.1 14 6.1 14 14"/><path class="k" d="M12.6 27.2c0-4.2 3.2-7.4 7.4-7.4 4.3 0 7.4 3.3 7.4 7.4"/><path class="h" d="M8.4 20.6l2 1.2M13.2 15.4l1.2 2M20 13.6v2.2M26.8 15.4l-1.2 2M31.6 20.6l-2 1.2"/><path class="k" d="M4.6 27.6c10.2-.4 20.6-.4 30.8 0"/><path class="k" d="M8 27.8v4.4c8 .4 16 .4 24 0v-4.4"/><path class="h" d="M12 30.2h16"/><g class="x-needle"><path class="k" d="M20 27l7-8.6" style="stroke:#A9522F;stroke-width:2"/></g><circle cx="20" cy="27" r="2" fill="#2B2A27"/>',
  courses:'<path d="M7.4 30.6h27.2v5H7.4z" fill="#E6C478"/><path d="M9.6 9.6h6.6v21.4H9.6z" fill="#B7CBA5"/><path class="k" d="M6.4 30.2c9.4-.3 18.8-.3 28.2 0 .3 1.6.3 3.4 0 5-9.4.3-18.8.3-28.2 0-.3-1.6-.3-3.4 0-5z"/><path class="h" d="M9 32.6h22M30 30.4v4.6"/><path class="k" d="M8.8 8.8c2.2-.2 4.4-.2 6.6 0 .3 7.1.3 14.2 0 21.3-2.2.2-4.4.2-6.6 0-.3-7.1-.3-14.2 0-21.3z"/><path class="h" d="M8.9 12.4h6.4M8.9 26.4h6.4M10.6 15.6h3"/><g class="x-lean"><path d="M19 12.8l6.2-1.8 6.6 19-6.2 1.8z" fill="#DE9A7C"/><path class="k" d="M18.2 12.4l6.4-2 6.8 19.8-6.4 2z"/><path class="h" d="M19.4 16l6.2-2M23.6 28.4l6.2-2"/><path d="M27.4 10.6l1 4.2 1.4-1 .4 1.6" fill="none" stroke="#A9522F" stroke-width="1.2" stroke-linecap="round"/></g>',
  calendar:'<path d="M8.2 10.6h25v6H8.2z" fill="#DE9A7C"/><path d="M8.2 16.6h25v18H8.2z" fill="#FFFDF6"/><g><path class="k" d="M7 9.6c8.8-.3 17.4-.3 26 0 .3 8.4.3 16.8 0 25.2-5.6.3-11.2.3-16.6.1-1.8 0-3.6-.1-5.4-.1L7 34.8c-.3-8.4-.3-16.8 0-25.2z"/><path class="k" d="M7.1 15.8c8.6-.2 17.2-.2 25.8 0"/><path class="h" d="M11 20h2.4M16 20h2.4M21 20h2.4M26 20h2.4M11 24.4h2.4M16 24.4h2.4M26 24.4h2.4M11 28.8h2.4M16 28.8h2.4M21 28.8h2.4"/><path class="x-circle" pathLength="1" d="M20.2 22.6c1.6-1.2 3.8-.6 4 1.2.2 1.8-1.8 2.8-3.4 2.2-1.4-.6-1.6-2.4-.2-3.4" fill="none" stroke="#A9522F" stroke-width="1.1" stroke-linecap="round"/></g><g class="x-rings"><path class="k" d="M13 6.4c-1.4 0-1.6 3.2 0 4.2M27 6.4c-1.4 0-1.6 3.2 0 4.2"/><path class="h" d="M12.6 6.6v3.6M26.6 6.6v3.6"/></g>',
  inbox:'<path d="M10.4 14.8c0-3.6 2.4-6 5.6-6h11.4c3.4 0 5.6 2.6 5.6 6v9.8H10.4z" fill="#9DB4C8"/><path d="M10.4 14.8c0-3.4 2.2-5.8 5.2-6 3.2.2 5.6 2.6 5.6 6v9.6H10.4z" fill="#B9CCDB"/><path class="k" d="M9.4 24.2V14c0-3.6 2.6-6.2 6-6.2h11.4c3.4 0 6 2.6 6 6.2v10.4c-7.8.2-15.6.2-23.4-.2z"/><path class="k" d="M15.4 7.8c3.4 0 6 2.6 6 6.2v10.2"/><path class="h" d="M12.4 16.4h6.2M12.4 19h6.2"/><circle class="d" cx="19.6" cy="21.6" r=".7"/><path class="h" d="M24.2 12.6h5.8M24.2 15.4h5.8M24.2 18.2h3.6"/><path class="k" d="M19.6 24.4v11.2M21.8 24.4v11.2"/><path class="h" d="M14.6 35.8c2-.6 3.4-1.8 4.2-3.4M27.2 35.8c-2-.6-3.4-1.8-4.4-3.4M12.4 36c5.4-.4 10.6-.4 16 0" style="stroke:#7E9A6A;opacity:1;stroke-width:1"/><g class="x-flag"><path class="k" d="M33 21.6V12.2"/><path d="M33.2 12.2h5.2v4h-5.2z" fill="#C96442" stroke="#2B2A27" stroke-width="1" stroke-linejoin="round"/></g>',
  history:'<circle cx="21" cy="23" r="11.4" fill="#E6C478"/><circle cx="20.6" cy="22.6" r="8.2" fill="#FFFDF6"/><path class="k" d="M8.6 22c0-6.8 5.2-11.8 11.6-11.8 6.6.1 11.4 5.3 11.2 12-.1 6.4-5.4 11.4-11.8 11.2-6.2-.2-11-5.2-11-11.4z"/><path class="k" d="M12.2 22.2c0-4.6 3.5-8 7.9-8 4.5.1 7.8 3.6 7.6 8.2-.1 4.4-3.7 7.8-8 7.6-4.2-.1-7.5-3.6-7.5-7.8z"/><path class="k" d="M18.4 10.2V7.6h3.4v2.6M17 6.6c1.6-.4 4.6-.4 6.2 0"/><path class="h" d="M20 15.6v1.4M20 27.6v1.4M13.6 22.2H15M25.4 22.2h1.4M15.4 17.2l.9.9M24.6 26.8l-.9-.9"/><g class="x-hand"><path class="k" d="M20 22.2v-5.4" style="stroke:#A9522F;stroke-width:1.6"/></g><path class="k" d="M20 22.2l3.6 2"/><circle cx="20" cy="22.2" r="1.2" fill="#2B2A27"/>',
  studio:'<path d="M7.4 8.4h26.4v18H7.4z" fill="#B7CBA5"/><path d="M8 28.8h25v4H8z" fill="#2B2A27" opacity=".14"/><path class="k" d="M6.2 7.6c9.2-.3 18.4-.3 27.6 0 .3 6.2.3 12.2 0 18.4-9.2.3-18.4.3-27.6 0-.3-6.2-.3-12.2 0-18.4z"/><path class="h" d="M8.6 10.2h1.6M8.6 13.4h1.6M8.6 16.6h1.6M8.6 19.8h1.6M8.6 23h1.6M29.8 10.2h1.6M29.8 13.4h1.6M29.8 16.6h1.6M29.8 19.8h1.6M29.8 23h1.6"/><g class="x-play"><path d="M17 12.4l7.4 4.4-7.4 4.4z" fill="#DE9A7C" stroke="#2B2A27" stroke-width="1.2" stroke-linejoin="round"/></g><path class="k" d="M7.6 29.4c8.4-.3 16.8-.3 25.2 0"/><path class="h" d="M11 31.6h3.4M17 31.6h8M27.6 31.6h2.8"/><path class="k" d="M20 26v3.2M14 35.4l6-6.2 6 6.2"/>',
  help:'<path class="x-glow" d="M14.4 6.8c5.6-2.4 12.6.2 13.6 6.6.6 4-1.6 6.4-3 8.2-.8 1-1 2-1 3.4h-7.4c0-1.6-.4-2.6-1.4-3.6-1.6-1.8-3.4-4-3-7.6.4-3.4 1.4-5.6 2.2-7z" fill="#F2DC8E"/><path class="k" d="M16.6 24.6c0-1.6-.6-2.8-1.8-4-1.8-1.8-3.2-4-3-7.2.3-4.8 4-8.2 8.4-8.2 4.6 0 8.2 3.6 8.2 8.2 0 3-1.4 5.2-3.2 7-1.2 1.2-1.6 2.6-1.6 4.2"/><path class="k" d="M16.6 26.2c2.4.2 4.6.2 7 0M17 28.6c2.2.2 4.2.2 6.2 0M18.4 31c1.2.2 2.4.2 3.6 0"/><path d="M17.6 11.6c.4-1.6 1.6-2.4 3-2.4 1.6.1 2.6 1.2 2.6 2.6-.1 1.4-1.2 2-2 2.6-.6.4-.8.9-.8 1.6" fill="none" stroke="#2B2A27" stroke-width="1.3" stroke-linecap="round"/><circle class="d" cx="20.4" cy="18.6" r=".9"/><path class="x-rays" d="M6.4 12.6l2.4.4M9 5.6l1.8 1.8M33.6 12.6l-2.4.4M31 5.6l-1.8 1.8M20.2 1.6v2.2" fill="none" stroke="#C96442" stroke-width="1.1" stroke-linecap="round"/>'
 };
 const LINKS={global_nav_profile_link:'account',global_nav_dashboard_link:'dashboard',global_nav_courses_link:'courses',global_nav_calendar_link:'calendar',global_nav_conversations_link:'inbox',global_nav_history_link:'history',global_nav_help_link:'help'};
 // Canvas items are known by their link id; Studio is an external tool, known by its label. Others keep Canvas's icon.
 function kindOf(link){
  if(LINKS[link?.id])return LINKS[link.id];
  const label=String(link?.querySelector?.('.menu-item__text')?.textContent||'').trim().toLowerCase();
  return /\bstudio\b/.test(label)?'studio':'';
 }
 // The account drawing replaces only Canvas's default avatar, never a photo the student chose.
 function defaultAvatar(link){
  const img=link.querySelector('.ic-avatar img, img');
  return !img||/avatar-50\.png|\/images\/messages\/avatar|default[-_]?avatar/i.test(img.getAttribute('src')||'');
 }

 // A logo is drawn in ink when it is light marks on nothing (most schools' white logos), shown as drawn when it brings
 // its own ground or colours, and set on a plate of the school's own menu colour when its pixels cannot be read.
 function logoKind(pixels){
  let total=0,clear=0,light=0,dark=0;
  for(let i=0;i<pixels.length;i+=4){
   total++;const a=pixels[i+3];if(a<40){clear++;continue;}
   const l=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];if(l>205)light++;else if(l<90)dark++;
  }
  const solid=total-clear;if(!total||!solid)return 'framed';
  if(clear/total>.22&&light/solid>.6)return 'ink';
  if(clear/total>.22&&dark/solid>.6)return 'dark';
  return 'framed';
 }
 function logoURL(header){
  const mark=header.querySelector('.ic-app-header__logomark');if(!mark)return '';
  const match=/url\(\s*["']?(.*?)["']?\s*\)/.exec(root.getComputedStyle(mark).backgroundImage||'');
  return match?match[1]:'';
 }
 function readLogo(url){
  return new Promise(resolve=>{
   const img=new root.Image();img.crossOrigin='anonymous';img.decoding='async';
   const done=kind=>{clearTimeout(timer);resolve(kind);},timer=setTimeout(()=>done('plate'),4000);
   img.onerror=()=>done('plate');
   img.onload=()=>{
    try{
     const w=Math.max(1,Math.min(96,img.naturalWidth||96)),h=Math.max(1,Math.round(w*(img.naturalHeight||48)/(img.naturalWidth||96)));
     const canvas=root.document.createElement('canvas');canvas.width=w;canvas.height=Math.min(h,96);
     const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
     done(logoKind(ctx.getImageData(0,0,canvas.width,canvas.height).data));
    }catch{done('plate');}   // a logo served without CORS taints the canvas: it cannot be read, so it gets the plate
   };
   img.src=url;
  });
 }

 function frames(){
  const Art=root.ReserveCourseArt;if(!Art?.frame)return '';
  return '<span class="chn-frames" aria-hidden="true">'+Art.frame('home','folio-home',{id:'folio-home',name:'All courses'})+Art.frame('home','chn-item',{id:'chn-item',name:'Canvas'})+'</span>';
 }
 function decorate(header){
  const frame=frames();
  for(const link of header.querySelectorAll('.ic-app-header__menu-list-link')){
   if(frame&&!link.querySelector(':scope > .chn-frames'))link.insertAdjacentHTML('afterbegin',frame);
   for(const badge of link.querySelectorAll('.menu-item__badge'))if(!/\d/.test(badge.textContent||''))badge.dataset.chnEmpty='';else delete badge.dataset.chnEmpty;
   const kind=kindOf(link),box=link.querySelector('.menu-item-icon-container'),bare=!box&&link.querySelector(':scope > .menu-item__icon');
   if(!DRAWINGS[kind]||!box&&!bare||link.querySelector('.chn-ic')||kind==='account'&&!defaultAvatar(link))continue;
   const svg='<svg class="chn-ic" viewBox="0 0 40 40" aria-hidden="true" focusable="false">'+DRAWINGS[kind]+'</svg>';
   if(box){box.insertAdjacentHTML('afterbegin',svg);box.classList.add('chn-drawn');}
   else{bare.insertAdjacentHTML('beforebegin',svg);link.classList.add('chn-drawn-link');}
  }
 }

 // Back to Canvas's own bar on this page: everything decorate() and the logo added comes off.
 function undecorate(header){
  for(const node of header.querySelectorAll('.chn-ic, .chn-frames, .chn-logo-art'))node.remove();
  for(const node of header.querySelectorAll('.chn-drawn'))node.classList.remove('chn-drawn');
  for(const node of header.querySelectorAll('.chn-drawn-link'))node.classList.remove('chn-drawn-link');
  for(const node of header.querySelectorAll('[data-chn-empty]'))delete node.dataset.chnEmpty;
 }
 // The workspace's colours (accent, page colour, ink, motion) as the dashboard last showed them, so every Canvas page
 // matches; the dashboard refreshes them whenever they change.
 const VARS={accent:'--rd-accent',sidebar:'--rd-sidebar',sidebarSel:'--rd-sidebar-sel',ink:'--rd-ink',ink2:'--rd-ink-2',page:'--rd-bg',font:'--rd-ui-font'};
 const NAMES={accent:'--chn-accent',sidebar:'--chn-sidebar',sidebarSel:'--chn-sidebar-sel',ink:'--chn-ink',ink2:'--chn-ink2',font:'--chn-font'};
 const safe=value=>typeof value==='string'&&value.length<200&&!/[;{}<>]|url\(/i.test(value);
 function applyPalette(palette){
  const style=root.document.documentElement.style;
  for(const [key,name] of Object.entries(NAMES))if(safe(palette?.[key]))style.setProperty(name,palette[key]);
  root.document.documentElement.dataset.chnMotion=palette?.motion==='off'||palette?.motion==='still'?'off':'on';
 }
 function workspace(){return root.document.getElementById('reserve-companion-host')?.shadowRoot?.querySelector('.rd')||null;}
 function readPalette(rd){
  const cs=root.getComputedStyle(rd),palette={};
  for(const [key,name] of Object.entries(VARS)){const value=cs.getPropertyValue(name).trim();if(value)palette[key]=value;}
  palette.motion=rd.dataset.motionStyle||rd.dataset.motion||'gentle';
  // Canvas's own pages stay light, so a dark workspace lends the bar only its accent and motion.
  if(rd.dataset.theme==='dark')for(const key of ['sidebar','sidebarSel','ink','ink2','page'])delete palette[key];
  return palette;
 }

 function start(){
  if(root.top!==root||root.ReserveCanvasNav||!root.ReserveSite?.supported?.(root.location?.href))return;
  const html=root.document.documentElement;let saved={},header=null,observer=null,lastPalette='';
  root.ReserveCanvasNav={kindOf,logoKind};
  const store=root.chrome?.storage?.local;if(!store)return;
  store.get([KEY,PALETTE,LOGO,'reserve:enabled']).then(values=>{
   saved=values;if(values['reserve:enabled']===false)return;
   if(values[KEY]!=='original')enable(values[KEY]);
   // Chosen again in Make it yours or the popup: the bar changes on this page at once.
   root.chrome.storage.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes[KEY])apply(changes[KEY].newValue);});
  }).catch(()=>{});
  // canvas-nav.css comes with the page (manifest, document_start): a stylesheet linked from here arrived after the drawn
  // frames, which then showed unstyled for a moment on every page change. It is scoped to html.chn-nav, so it is inert until then.
  let undo=[];
  function enable(choice){
   html.classList.add('chn-nav');layout(choice);applyPalette(saved[PALETTE]);
   if(header){decorate(header);setLogo();drawer();topBar();}else watch();
  }
  function layout(choice){html.dataset.chnLayout=LAYOUTS[choice]||'drawer';if(html.dataset.chnLayout==='drawer')html.dataset.chnDrawer='closed';}
  // Each layout leaves an undo; a change runs them all, then sets up the new one with no motion at all for two frames
  // (data-chn-switching), so a column never turns into a row on screen.
  function apply(choice){
   if(choice==='original'){
    if(!html.classList.contains('chn-nav'))return;
    for(const step of undo.splice(0))try{step();}catch{}
    if(header)undecorate(header);html.classList.remove('chn-nav');delete html.dataset.chnLayout;return;
   }
   html.dataset.chnSwitching='true';
   if(!html.classList.contains('chn-nav'))enable(choice);
   else{for(const step of undo.splice(0))try{step();}catch{}layout(choice);if(header){drawer();topBar();}}
   root.requestAnimationFrame(()=>root.requestAnimationFrame(()=>{delete html.dataset.chnSwitching;}));
  }

  function found(){
   const next=root.document.getElementById('header');
   if(!next||!next.querySelector('.ic-app-header__menu-list-link'))return false;
   if(next!==header){header=next;setup();}
   decorate(header);return true;
  }
  function watch(){
   if(found())return;
   const pending=new MutationObserver(()=>{if(found())pending.disconnect();});
   pending.observe(root.document.documentElement,{childList:true,subtree:true});
   root.addEventListener('DOMContentLoaded',()=>{found();},{once:true});
  }
  function setup(){
   if(root.getComputedStyle(header).position==='static')header.style.position='relative';
   // The bar's column takes the page's own background, so it reads as part of whichever page it is on.
   const page=()=>{const bg=root.getComputedStyle(root.document.body||html).backgroundColor;if(safe(bg)&&!/rgba\(0, 0, 0, 0\)|transparent/.test(bg))header.style.setProperty('--chn-page',bg);};
   page();root.addEventListener('load',page,{once:true});
   const rootStyle=root.getComputedStyle(html);
   for(const [name,from] of [['--chn-school','--ic-brand-global-nav-bgd'],['--chn-school-logo','--ic-brand-global-nav-logo-bgd']]){const v=rootStyle.getPropertyValue(from).trim();if(safe(v)&&v)header.style.setProperty(name,v);}
   // Canvas re-renders parts of the bar (badges, the active item): decorate again, at most once a frame.
   let queued=false;
   observer?.disconnect();observer=new MutationObserver(()=>{if(queued)return;queued=true;root.requestAnimationFrame(()=>{queued=false;if(html.classList.contains('chn-nav'))decorate(header);});});
   observer.observe(header,{childList:true,subtree:true});
   setLogo();followWorkspace();drawer();topBar();
  }
  // THE DRAWER (the default; the user, 2026-10-15): the bar is used now and then, so it waits off the left edge and
  // Canvas's page takes the whole width. Reaching the window's left edge with the pointer, or tabbing into it, brings it
  // out, a card in the middle of the edge as tall as its items, and moves the page aside by its width so it covers
  // nothing. It goes when the pointer and focus have left it, but never while one of Canvas's trays is open.
  function drawer(){
   if(html.dataset.chnLayout!=='drawer'||header.dataset.chnDrawer)return;header.dataset.chnDrawer='true';
   const doc=root.document,edge=doc.createElement('div'),off=new AbortController(),signal=off.signal,watching=[];edge.className='chn-edge';edge.setAttribute('aria-hidden','true');(doc.body||html).append(edge);
   const trays=['nav-tray-portal','global_nav_tray_container'].map(id=>doc.getElementById(id)).filter(Boolean);
   const trayOpen=()=>trays.some(t=>t.childElementCount>0);
   let timer=0,pushed=0;
   // The page makes room beside the bar: it eases narrower as the bar comes out and wider as it goes, together with the
   // bar, so nothing of it is out of reach while the bar is out (the user, 2026-10-16) and nothing jumps (a width taken
   // all at once had the whole dashboard shrink and grow back in one step). The ease is canvas-nav.css's transition on
   // the page's margin; with reduced motion, or Motion off, it changes at once.
   function push(on){
    const page=doc.getElementById('wrapper');if(!page)return;
    const by=on?Math.round(header.getBoundingClientRect().width)+6:0;if(by===pushed)return;pushed=by;
    html.style.setProperty('--chn-push',by+'px');
   }
   const open=()=>{root.clearTimeout(timer);if(html.dataset.chnDrawer!=='open'){html.dataset.chnDrawer='open';push(true);}};
   const close=(ms=420)=>{root.clearTimeout(timer);timer=root.setTimeout(()=>{if(header.matches(':hover')||header.contains(doc.activeElement)||trayOpen())return;html.dataset.chnDrawer='closed';push(false);},ms);};
   edge.addEventListener('pointerenter',open,{signal});
   header.addEventListener('pointerenter',open,{signal});header.addEventListener('pointerleave',()=>close(),{signal});
   header.addEventListener('focusin',open,{signal});header.addEventListener('focusout',()=>close(120),{signal});
   for(const t of trays){const o=new MutationObserver(()=>{if(!trayOpen())close();});o.observe(t,{childList:true});watching.push(o);}
   undo.push(()=>{
    off.abort();for(const o of watching)o.disconnect();root.clearTimeout(timer);edge.remove();
    html.style.removeProperty('--chn-push');delete html.dataset.chnDrawer;delete html.dataset.chnMoving;delete header.dataset.chnDrawer;
   });
  }
  // ACROSS THE TOP (the user, 2026-10-15): on the dashboard the bar sits, centred, in the free stretch of the workspace's
  // toolbar between the search field and Tools; with names while they fit, as drawings alone (names on hover) when they
  // do not, and without the school's logo when even that is too wide. Where there is no such stretch (another Canvas page, Canvas's own dashboard, a narrow window) it is a strip
  // across the top of the page, which moves the page down. Its own outline and motion: nothing of the column's slide.
  function topBar(){
   if(html.dataset.chnLayout!=='top'||header.dataset.chnTop)return;header.dataset.chnTop='true';
   const dashboard=/^\/?$/.test(root.location?.pathname||'')&&new URLSearchParams(root.location?.search||'').get('reserve')!=='native';
   for(const link of header.querySelectorAll('.ic-app-header__menu-list-link'))if(!link.title){const name=link.querySelector('.menu-item__text')?.textContent.trim();if(name)link.title=name;}
   const waitUntil=Date.now()+(dashboard?9000:0),set=(name,value)=>html.style.setProperty(name,value);
   let queued=0,watched=null,sizes=null;
   const visible=node=>!!node&&node.getClientRects().length>0&&node.getBoundingClientRect().width>0;
   function fit(width){
    // measured with anything that still spills out of the bar, so a school's own Canvas styles cannot fool it
    for(const kind of ['full','icons','bare']){header.dataset.chnFit=kind;if(Math.max(header.offsetWidth,header.scrollWidth)<=width)return true;}
    return false;
   }
   function place(){
    if(queued===-1)return;queued=0;
    const rd=html.classList.contains('reserve-inline-active')?workspace():null,bar=rd?.querySelector('.rd-toolbar');
    if(visible(bar)){
     if(watched!==bar){watched=bar;try{sizes?.disconnect();sizes=new root.ResizeObserver(later);sizes.observe(bar);}catch{}}
     const before=[bar.querySelector('.rd-search'),bar.querySelector('.rd-workspace-tabs')].find(visible),tools=bar.querySelector('.rd-tools');
     if(before&&visible(tools)){
      const a=before.getBoundingClientRect(),b=tools.getBoundingClientRect(),left=a.right+16,room=b.left-16-left;
      html.dataset.chnPlace='toolbar';
      if(room>120&&fit(room)){
       set('--chn-bar-x',Math.round(left+(room-header.offsetWidth)/2+root.scrollX)+'px');
       set('--chn-bar-y',Math.round(a.top+a.height/2+root.scrollY)+'px');return;
      }
     }
    }
    if(dashboard&&!rd&&Date.now()<waitUntil){html.dataset.chnPlace='wait';root.setTimeout(later,600);return;}
    html.dataset.chnPlace='strip';fit(root.innerWidth-40);
   }
   function later(){if(!queued)queued=root.requestAnimationFrame(place);}   // -1 once undone: nothing more is placed
   place();
   const classes=new MutationObserver(later);classes.observe(html,{attributes:true,attributeFilter:['class']});
   root.addEventListener('resize',later,{passive:true});root.addEventListener('load',later,{once:true});
   undo.push(()=>{
    classes.disconnect();sizes?.disconnect();root.removeEventListener('resize',later);if(queued)root.cancelAnimationFrame?.(queued);queued=-1;
    delete html.dataset.chnPlace;delete header.dataset.chnFit;delete header.dataset.chnTop;html.style.removeProperty('--chn-bar-x');html.style.removeProperty('--chn-bar-y');
   });
  }
  // A logo that keeps its own look (framed, or on the school's plate) hangs in a drawn frame from a nail.
  function logoArt(){const mark=header.querySelector('.ic-app-header__logomark');if(mark&&!mark.querySelector(':scope > .chn-logo-art'))mark.insertAdjacentHTML('beforeend','<span class="chn-logo-art" aria-hidden="true"><svg class="chn-logo-hang" viewBox="0 0 40 14"><path d="M9 13.4L20 3l11 10.4" fill="none" stroke="#2B2A27" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="2.6" r="1.7" fill="#2B2A27"/></svg><svg class="chn-logo-edge" viewBox="0 0 100 60" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="M4.2 4.4C30 3.2 70 4.6 96.2 3.6C97 20 96.4 40 97 56.6C70 57.6 30 56.2 3.6 57.2C2.8 40 3.8 20 3.2 5.6"/><path class="re" vector-effect="non-scaling-stroke" d="M8 7.4C36 6.6 64 7.8 92 7"/><path class="re" vector-effect="non-scaling-stroke" d="M90 54C93 53.6 94.4 52 94.6 49"/></svg></span>');}
  function setLogo(){
   logoArt();
   const url=logoURL(header);if(!url){header.dataset.chnLogo='none';return;}
   const known=saved[LOGO];
   if(known?.url===url&&['ink','dark','framed','plate'].includes(known.kind)){header.dataset.chnLogo=known.kind;return;}
   header.dataset.chnLogo='wait';
   readLogo(url).then(kind=>{header.dataset.chnLogo=kind;store.set({[LOGO]:{url,kind}}).catch(()=>{});});
  }
  // On the dashboard: take the workspace's colours, and line the bar's top up with the workspace's top row.
  function followWorkspace(){
   let tries=0;const timer=root.setInterval(()=>{
    const rd=workspace();if(!rd&&++tries<30)return;root.clearInterval(timer);if(!rd)return;
    const sync=()=>{
     const palette=readPalette(rd),text=JSON.stringify(palette);
     if(text!==lastPalette){lastPalette=text;applyPalette(palette);if(text!==JSON.stringify(saved[PALETTE]))store.set({[PALETTE]:palette}).then(()=>{saved[PALETTE]=palette;}).catch(()=>{});}
     const bar=rd.querySelector('.rd-toolbar');
     if(bar&&root.scrollY===0&&bar.getClientRects().length){const top=Math.round(bar.getBoundingClientRect().top);if(top>=8&&top<=140)html.style.setProperty('--chn-top',top+'px');}
     // ...and its foot with the course sidebar's foot.
     const rail=rd.querySelector('.rd-course-rail');
     if(rail&&root.scrollY===0&&rail.getClientRects().length){const gap=Math.round(root.innerHeight-rail.getBoundingClientRect().bottom);if(gap>=4&&gap<=80)html.style.setProperty('--chn-bottom',gap+'px');}
    };
    let queued=0;const later=()=>{if(!queued)queued=root.setTimeout(()=>{queued=0;sync();},400);};
    sync();new MutationObserver(later).observe(rd,{attributes:true,attributeFilter:['style','data-motion-style','data-motion','data-accent','data-page-tint','data-theme']});
    root.addEventListener('resize',later,{passive:true});
   },1000);
  }
 }

 if(typeof module==='object'&&module.exports)module.exports={kindOf,logoKind,DRAWINGS};
 else start();
})(globalThis);
