/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
// The school's Canvas address, shared by the popup and the welcome page. An address on instructure.com works at
// once. A school's own address (canvas.your-school.edu) first needs the browser's permission for that one site;
// background.js registers its scripts before it opens (see "School Canvas sites" there).
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
 // A saved address is not proof that its scripts are ready. Ask the worker to finish registration before opening.
 async function ready(value){
  const origin=Site().customSite(value);
  if(!origin){if(Site().supported(value))return;throw Error('Choose your school’s HTTPS Canvas address first.');}
  let timer;
  try{
   const reply=await Promise.race([
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('School registration took too long. Try again.')),10000);}),
    root.chrome.runtime.sendMessage({type:'ch-school-ready',origin})
   ]);
   if(!reply?.ok||reply.origin!==origin)throw Error(reply?.error||'School registration was not confirmed. Try again.');
  }catch(error){throw Error('Could not register your school’s Canvas site. '+String(error?.message||error||'Try again.'));}
  finally{clearTimeout(timer);}
 }
 // Wait for the welcome transition, capped at 1.8 seconds before tab creation.
 async function beforeTab(beforeOpen){
  let timer;
  try{await Promise.race([
   Promise.resolve().then(()=>beforeOpen()),
   new Promise(resolve=>{timer=setTimeout(resolve,1800);})
  ]);}finally{clearTimeout(timer);}
 }
 // Call straight from a click: the browser shows its permission prompt only for the student's own action, so
 // nothing is awaited before it. onAsk(host) runs just before the prompt. Resolves to {ok, origin, message}.
 async function open(value,{native=false,onAsk,defer=false,beforeOpen}={}){
  const text=String(value||'').trim();
  if(!Site().supported(text)){
   const origin=Site().customSite(text);
   if(!origin)return {ok:false,message:'Enter your school’s HTTPS Canvas address, such as https://your-school.instructure.com or https://canvas.your-school.edu.'};
   // The tour asks now and opens Canvas at its final step. Do not stage a
   // pending open, or the permission-added event would open a tab mid-tour.
   if(defer){
    onAsk?.(new URL(origin).host);
    if(!await root.chrome.permissions.request({permissions:['scripting'],origins:[origin+'/*']}))return {ok:false,message:'Not allowed, so Canvas Harness stays off on that site.'};
    const sites=(await local().get(SITES))[SITES];
    await local().set({[SITES]:[...new Set([...(Array.isArray(sites)?sites:[]),origin])],[SCHOOL]:origin,'reserve:enabled':true});
    await ready(origin);await list();return {ok:true,origin,message:''};
   }
   if(native){if(beforeOpen)await beforeTab(beforeOpen);await root.chrome.tabs.create({url:origin+'/'});return {ok:true,origin,message:''};}
   local().set({[PENDING]:origin,[SCHOOL]:origin,'reserve:enabled':true});
   onAsk?.(new URL(origin).host);
   if(!await root.chrome.permissions.request({permissions:['scripting'],origins:[origin+'/*']})){
    local().remove(PENDING);return {ok:false,message:'Not allowed, so Canvas Harness stays off on that site.'};
   }
   return {ok:true,origin,message:'Allowed. Opening Canvas…'};
  }
  const origin=new URL(text).origin;
  await local().set(native?{[SCHOOL]:origin}:{'reserve:enabled':true,[SCHOOL]:origin});
  if(!native&&Site().customSite(origin))await ready(origin);
  if(!defer){if(beforeOpen)await beforeTab(beforeOpen);await root.chrome.tabs.create({url:new URL('/?reserve='+(native?'native':'open'),origin).href});}
  return {ok:true,origin,message:''};
 }
 const api=Object.freeze({list,remove,saved,open,ready});root.ReserveSchool=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
