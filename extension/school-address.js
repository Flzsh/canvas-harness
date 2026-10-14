/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// The school's Canvas address, shared by the popup and the welcome page. An address on instructure.com works at
// once. A school's own address (canvas.your-school.edu) first needs the browser's permission for that one site;
// background.js then adds it and opens it (see "School Canvas sites" there).
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root){
 'use strict';
 const SITES='reserve:sites',PENDING='reserve:pendingSite',SCHOOL='reserve:school';
 const Site=()=>root.ReserveSite,local=()=>root.chrome.storage.local;
 // The added school sites the browser still allows; the page's ReserveSite trusts exactly these.
 async function list(){
  const saved=(await local().get(SITES))[SITES],sites=[];
  for(const value of Array.isArray(saved)?saved:[]){
   const origin=Site().customSite(value);
   if(origin&&!sites.includes(origin)&&await root.chrome.permissions.contains({origins:[origin+'/*']}).catch(()=>false))sites.push(origin);
  }
  Site().trustSites(sites);return sites;
 }
 async function remove(origin){
  await root.chrome.permissions.remove({origins:[origin+'/*']});
  const now=(await local().get(SITES))[SITES];
  await local().set({[SITES]:(Array.isArray(now)?now:[]).filter(x=>x!==origin)});
 }
 // The last address the student chose, to fill the field when the current tab is not Canvas.
 async function saved(){
  const value=(await local().get(SCHOOL))[SCHOOL];
  return typeof value==='string'&&(Site().supported(value)||Site().customSite(value))?new URL(value).origin:'';
 }
 // Call straight from a click: the browser shows its permission prompt only for the student's own action, so
 // nothing is awaited before it. onAsk(host) runs just before the prompt. Resolves to {ok, message}.
 async function open(value,{native=false,onAsk}={}){
  const text=String(value||'').trim();
  if(!Site().supported(text)){
   const origin=Site().customSite(text);
   if(!origin)return {ok:false,message:'Enter your school’s HTTPS Canvas address, such as https://your-school.instructure.com or https://canvas.your-school.edu.'};
   if(native){await root.chrome.tabs.create({url:origin+'/'});return {ok:true,message:''};}
   local().set({[PENDING]:origin,[SCHOOL]:origin,'reserve:enabled':true});
   onAsk?.(new URL(origin).host);
   if(!await root.chrome.permissions.request({permissions:['scripting'],origins:[origin+'/*']})){
    local().remove(PENDING);return {ok:false,message:'Not allowed, so Canvas Harness stays off on that site.'};
   }
   return {ok:true,message:'Allowed. Opening Canvas…'};
  }
  const origin=new URL(text).origin;
  await local().set(native?{[SCHOOL]:origin}:{'reserve:enabled':true,[SCHOOL]:origin});
  await root.chrome.tabs.create({url:new URL('/?reserve='+(native?'native':'open'),origin).href});
  return {ok:true,message:''};
 }
 const api=Object.freeze({list,remove,saved,open});root.ReserveSchool=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
