/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function(root){
 'use strict';
 function supported(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+instructure\.com$/i.test(u.hostname)&&!notCanvas.test(u.hostname);}catch{return false;}
 }
 // Instructure's own websites share the domain but are not Canvas schools.
 const notCanvas=/^(?:www|community|status|developerdocs|docs|support|info)\.instructure\.com$/i;
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
 const api=Object.freeze({supported,canvasPage,origin,timeZone});root.ReserveSite=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
