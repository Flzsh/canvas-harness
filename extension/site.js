/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function(root){
 'use strict';
 // A secure origin with no password, user name or port; '' for anything else.
 function secureOrigin(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.origin:'';}catch{return '';}
 }
 function instructure(value){
  const origin=secureOrigin(value);if(!origin)return false;
  const host=new URL(origin).hostname;
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+instructure\.com$/i.test(host)&&!notCanvas.test(host);
 }
 // Instructure's own websites share the domain but are not Canvas schools.
 const notCanvas=/^(?:www|community|status|developerdocs|docs|support|info)\.instructure\.com$/i;
 // Some schools run Canvas on their own address (canvas.school.edu). Such a site counts only after the
 // student adds it in the popup and the browser grants access to that one site; background.js then
 // registers the extension's scripts there and custom-site.js marks the page's origin as trusted.
 const trusted=new Set();
 function customSite(value){
  const origin=secureOrigin(value);if(!origin)return '';
  const host=new URL(origin).hostname;
  if(!host.includes('.')||/^[\d.]+$/.test(host)||host.startsWith('[')||/(?:^|\.)instructure\.com$/i.test(host))return '';
  return origin;
 }
 function trustSites(list){trusted.clear();for(const value of list||[]){const origin=customSite(value);if(origin)trusted.add(origin);}}
 function supported(value){return instructure(value)||trusted.has(secureOrigin(value));}
 // Every Canvas page layout wraps its content in #application (.ic-app); login pages are
 // recognized too. Other pages on the domain are left alone.
 function canvasPage(doc=root.document){
  try{return !!(doc?.getElementById?.('application')||doc?.querySelector?.('.ic-app, #login_form, #new_login, .ic-Login'));}catch{return false;}
 }
 // Assignment instructions, submission/feedback details and submit/upload views
 // belong entirely to Canvas. Match the pathname, irrespective of query/hash,
 // and include descendants (submissions/new, submissions/:user, etc.). The
 // assignment index and syllabus are still ordinary enhanced native pages.
 function pathOf(value){
  const pathname=typeof value?.pathname==='string'?value.pathname:new URL(value,root.location?.href||'https://school.instructure.com/').pathname;
  return decodeURIComponent(pathname);
 }
 function vanillaPage(value=root.location){
  try{return /^\/courses\/\d+\/assignments\/\d+(?:\/|$)/.test(pathOf(value));}catch{return false;}
 }
 function origin(){
  const value=root.location?.origin;
  if(supported(value))return new URL(value).origin;
  // The local demonstration has artificial data and no Canvas transport.
  if(value&&/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(value))return value;
  return 'https://school.instructure.com';
 }
 function timeZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}catch{return 'UTC';}}
 // Switched off on one assignment's pages (the switch on those pages, page-switch.js): "<course>/<assignment>" -> when,
 // in this site's own storage, so the next visit's very first frame already knows (chrome.storage answers too late for
 // that). Until switched back on; the 100 most recent are kept (about 2.5 KB). Storage that throws or holds anything
 // else means on.
 const PAGE_OFF='reserve:page-off',PAGE_OFF_CAP=100;
 function pageKey(value=root.location){
  try{const m=/^\/courses\/(\d+)\/assignments\/(\d+)(?:\/|$)/.exec(pathOf(value));return m?m[1]+'/'+m[2]:'';}catch{return '';}
 }
 function pageOffList(){
  try{
   const value=JSON.parse(root.localStorage?.getItem(PAGE_OFF)||'null');if(!value||typeof value!=='object'||Array.isArray(value))return {};
   const list={};for(const [key,at] of Object.entries(value))if(/^\d+\/\d+$/.test(key)&&Number.isFinite(at))list[key]=at;return list;
  }catch{return {};}
 }
 function pageOff(value=root.location){const key=pageKey(value);return !!key&&Object.hasOwn(pageOffList(),key);}
 function setPageOff(off,value=root.location,now=Date.now()){
  const key=pageKey(value);if(!key)return false;
  const list=pageOffList();if(off)list[key]=now;else delete list[key];
  const keys=Object.keys(list).sort((a,b)=>list[a]-list[b]);while(keys.length>PAGE_OFF_CAP)delete list[keys.shift()];
  try{if(keys.length)root.localStorage.setItem(PAGE_OFF,JSON.stringify(list));else root.localStorage.removeItem(PAGE_OFF);}catch{return false;}
  return pageOff(value)===!!off;
 }
 const api=Object.freeze({supported,customSite,trustSites,canvasPage,vanillaPage,origin,timeZone,PAGE_OFF,pageKey,pageOff,setPageOff});root.ReserveSite=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
