/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* The public site's trust boundary, shared by Market and account mutations. */
(function(root){
 'use strict';
 if(root.ReserveMarketSite)return;
 const fail=()=>{throw Error('Choose and allow your school’s Canvas site first.');};
 function origin(value){
  if(typeof value!=='string')return '';
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&url.origin===value?url.origin:'';}catch{return '';}
 }
 const ready=async()=>{await root.ReserveMarketReady?.();},bindingKey=id=>'reserve:market-tab:'+id,bindings=new Map();
 function owner(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!origin(value.origin)||typeof value.accountId!=='string'||!/^\d+$/.test(value.accountId))throw Error('A verified Canvas account is required.');
  return {origin:value.origin,accountId:value.accountId};
 }
 async function allowed(value){
  await ready();const site=origin(value),S=root.ReserveSite;if(!site||!S)return false;
  // A custom HTTPS address is not trusted merely because the sender names it.
  // It must still be registered by the student and permitted by the browser.
  if(S.customSite(site)){
   const saved=(await root.chrome.storage.local.get('reserve:sites'))['reserve:sites'];
   if(!Array.isArray(saved)||!saved.includes(site))return false;
   if(typeof root.chrome.permissions?.contains==='function')return !!await root.chrome.permissions.contains({origins:[site+'/*']}).catch(()=>false);
   // Content scripts cannot call chrome.permissions. custom-site.js has marked
   // only their own registered origin as supported; never trust a named host.
   return typeof root.importScripts!=='function'&&!!root.chrome.runtime?.id&&root.location?.origin===site&&S.supported(site);
  }
  return S.supported(site);
 }
 async function sender(sender,value){
  await ready();
  if(sender?.id!==root.chrome.runtime.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||typeof sender.url!=='string')return false;
  try{
   const url=new URL(sender.url);if(url.username||url.password||url.port||!await allowed(url.origin))return false;
   return value===undefined||owner(value).origin===url.origin;
  }catch{return false;}
 }
 async function bind(id,value){if(!Number.isInteger(id))fail();const identity=owner(value);if(!await allowed(identity.origin))fail();bindings.set(id,identity);await root.chrome.storage.session?.set({[bindingKey(id)]:identity});}
 async function bound(id){const value=root.chrome.storage.session?(await root.chrome.storage.session.get(bindingKey(id)))[bindingKey(id)]:bindings.get(id);if(!value)throw Error('Open the Market from the Canvas Harness popup on your Canvas tab.');const identity=owner(value);if(!await allowed(identity.origin))fail();return identity;}
 root.chrome?.tabs?.onRemoved?.addListener(id=>{bindings.delete(id);void root.chrome.storage.session?.remove?.(bindingKey(id));});
 async function selected(){
  await ready();const saved=(await root.chrome.storage.local.get('reserve:school'))['reserve:school'];let tabs=[];
  try{tabs=await root.chrome.tabs?.query({active:true,currentWindow:true})||[];}catch{}
  for(const tab of tabs)try{const url=new URL(tab.url);if(url.origin==='https://flzsh.github.io'&&url.pathname.startsWith('/canvas-harness-packs/'))return (await bound(tab.id)).origin;}catch(error){if(tab.url?.startsWith('https://flzsh.github.io/canvas-harness-packs/'))throw error;}
  const candidates=tabs.map(tab=>{try{return new URL(tab.url).origin;}catch{return '';}}).concat(saved);
  for(const candidate of candidates)if(await allowed(candidate))return candidate;
  fail();
 }
 const api=Object.freeze({origin,owner,ready,allowed,sender,selected,bind,bound});root.ReserveMarketSite=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
