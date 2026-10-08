/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
'use strict';
const enabled=document.getElementById('enabled'),status=document.getElementById('status');
chrome.storage.local.get('reserve:enabled').then(saved=>enabled.checked=saved['reserve:enabled']!==false);
enabled.addEventListener('change',async()=>{try{await chrome.storage.local.set({'reserve:enabled':enabled.checked});status.textContent='Saved. Reload Canvas to apply.';}catch{status.textContent='Could not save this setting. Try again.';}});
const school=document.getElementById('school-url');
chrome.tabs.query({active:true,currentWindow:true}).then(tabs=>{const url=tabs[0]?.url;if(ReserveSite.supported(url))school.value=new URL(url).origin;}).catch(()=>{});
async function openCanvas(native){
 try{
  const value=school.value.trim();
  if(!ReserveSite.supported(value)){status.textContent='Enter your school’s HTTPS Canvas address on instructure.com.';school.focus();return;}
  if(!native)await chrome.storage.local.set({'reserve:enabled':true});
  await chrome.tabs.create({url:new URL('/?reserve='+ (native?'native':'open'),value).href});
 }catch{status.textContent='Could not open Canvas. Check the school address and try again.';}
}
document.getElementById('open').addEventListener('click',()=>openCanvas(false));
document.getElementById('canvas').addEventListener('click',()=>openCanvas(true));

// Match device is offered only to someone who already chose it: Canvas Harness never switches to dark on its own.
const appearance=ReserveNativeAppearance.create({adapter:ReserveNativePage.browserAdapter(),media:matchMedia('(prefers-color-scheme: dark)'),apply:prefs=>{for(const select of document.querySelectorAll('[data-native]')){select.value=prefs[select.dataset.native];select.disabled=false;}for(const option of document.querySelectorAll('option[value="system"]'))option.hidden=prefs.theme!=='system';},onError:error=>{status.textContent=error.message||'Appearance could not load.';}});
appearance.start().catch(error=>{if(error.code!=='cancelled')status.textContent='Appearance could not load.';});
for(const select of document.querySelectorAll('[data-native]'))select.addEventListener('change',()=>{select.disabled=true;appearance.set({[select.dataset.native]:select.value}).then(()=>{status.textContent='Saved. Applies to open Canvas pages with this version loaded.';}).catch(error=>{select.value=appearance.get()[select.dataset.native];status.textContent=error.message||'Appearance could not be saved.';}).finally(()=>{select.disabled=false;});});
window.addEventListener('pagehide',()=>appearance.destroy(),{once:true});
