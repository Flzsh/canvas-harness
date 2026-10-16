/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
'use strict';
document.getElementById('reload-extension').addEventListener('click',()=>chrome.runtime.reload());
const enabled=document.getElementById('enabled'),status=document.getElementById('status');
chrome.storage.local.get('reserve:enabled').then(saved=>enabled.checked=saved['reserve:enabled']!==false);
// Canvas's own menu bar, drawn to match the workspace (canvas-nav.js) or left as Canvas draws it.
const menuBar=document.getElementById('canvas-nav');
chrome.storage.local.get('reserve:canvasNav').then(saved=>{menuBar.value=['original','shown','top'].includes(saved['reserve:canvasNav'])?saved['reserve:canvasNav']:'drawn';}).catch(()=>{});
menuBar.addEventListener('change',async()=>{try{await chrome.storage.local.set({'reserve:canvasNav':menuBar.value});status.textContent='Saved. Reload Canvas to apply.';}catch{status.textContent='Could not save this setting. Try again.';}});
enabled.addEventListener('change',async()=>{try{await chrome.storage.local.set({'reserve:enabled':enabled.checked});status.textContent='Saved. Reload Canvas to apply.';}catch{status.textContent='Could not save this setting. Try again.';}});
const school=document.getElementById('school-url'),siteList=document.getElementById('sites');
// School Canvas addresses outside instructure.com that the student added and the browser still allows (school-address.js).
async function loadSites(){
 const sites=await ReserveSchool.list();siteList.replaceChildren();
 for(const origin of sites){
  const item=document.createElement('li'),name=document.createElement('span'),remove=document.createElement('button');
  name.textContent=new URL(origin).host;remove.type='button';remove.className='secondary';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+name.textContent);
  remove.addEventListener('click',async()=>{try{await ReserveSchool.remove(origin);status.textContent='Removed. Canvas Harness no longer runs on '+name.textContent+'.';loadSites();}catch{status.textContent='Could not remove that site. Try again.';}});
  item.append(name,remove);siteList.append(item);
 }
 siteList.hidden=!sites.length;return sites;
}
// The field starts with the Canvas tab you are on, or else the address you chose last time.
loadSites().catch(()=>{}).then(()=>chrome.tabs.query({active:true,currentWindow:true})).then(async tabs=>{const url=tabs?.[0]?.url;school.value=ReserveSite.supported(url)?new URL(url).origin:school.value||await ReserveSchool.saved();}).catch(()=>{});
async function openCanvas(native){
 try{
  const result=await ReserveSchool.open(school.value,{native,onAsk:host=>{status.textContent='Your browser will ask to let Canvas Harness use '+host+'. It asks for that site only.';}});
  if(result.message)status.textContent=result.message;if(!result.ok)school.focus();
 }catch{status.textContent='Could not open Canvas. Check the school address and try again.';}
}
document.getElementById('open').addEventListener('click',()=>openCanvas(false));
document.getElementById('canvas').addEventListener('click',()=>openCanvas(true));

// Match device is offered only to someone who already chose it: Canvas Harness never switches to dark on its own.
const appearance=ReserveNativeAppearance.create({adapter:ReserveNativePage.browserAdapter(),media:matchMedia('(prefers-color-scheme: dark)'),apply:prefs=>{for(const select of document.querySelectorAll('[data-native]')){select.value=prefs[select.dataset.native];select.disabled=false;}for(const option of document.querySelectorAll('option[value="system"]'))option.hidden=prefs.theme!=='system';},onError:error=>{status.textContent=error.message||'Appearance could not load.';}});
appearance.start().catch(error=>{if(error.code!=='cancelled')status.textContent='Appearance could not load.';});
for(const select of document.querySelectorAll('[data-native]'))select.addEventListener('change',()=>{select.disabled=true;appearance.set({[select.dataset.native]:select.value}).then(()=>{status.textContent='Saved. Applies to open Canvas pages with this version loaded.';}).catch(error=>{select.value=appearance.get()[select.dataset.native];status.textContent=error.message||'Appearance could not be saved.';}).finally(()=>{select.disabled=false;});});
window.addEventListener('pagehide',()=>appearance.destroy(),{once:true});
