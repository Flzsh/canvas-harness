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
 function origin(){
  const value=root.location?.origin;
  if(supported(value))return new URL(value).origin;
  // The local demonstration has artificial data and no Canvas transport.
  if(value&&/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(value))return value;
  return 'https://school.instructure.com';
 }
 function timeZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}catch{return 'UTC';}}
 const api=Object.freeze({supported,customSite,trustSites,canvasPage,origin,timeZone});root.ReserveSite=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
