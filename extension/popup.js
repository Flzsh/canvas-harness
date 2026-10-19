/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),all=selector=>[...document.querySelectorAll(selector)];
 const manifest=chrome.runtime.getManifest(),school=$('school-url'),status=$('status'),enabled=$('enabled');
 // the school-address controls exist only in builds that can ask for a school's own Canvas site
 const publicBuild=(manifest.optional_host_permissions||[]).includes('https://*/*'),titles={look:'Look',menu:'Canvas menu bar',pony:'Pony',native:'Canvas pages'};
 const navNames={drawn:'From the left edge',shown:'Full height',top:'Across the top',original:'Canvas’s own'};
 const preferences=ReservePagePreferences.create();
 let origin='',lastRow=null,statusTimer=0;
 $('product-name').textContent=manifest.name;$('version').textContent=manifest.version;document.title=manifest.name;
 $('school-section').hidden=!publicBuild;
 // the drawn pictures: row icons, the real Biscuit on the Pony row, and the four menu-bar layouts
 const PopupArt=globalThis.ReservePopupArt;
 if(PopupArt){
  for(const [detail,name]of [['look','look'],['menu','menubar'],['native','pages']]){const svg=document.querySelector(`.setting-row[data-detail="${detail}"] svg`);if(svg)svg.outerHTML=PopupArt.icons[name];}
  for(const button of all('[data-nav]')){const svg=button.querySelector('svg');if(svg&&PopupArt.layouts[button.dataset.nav])svg.outerHTML=PopupArt.layouts[button.dataset.nav];}
 }
 {const svg=document.querySelector('.setting-row[data-detail="pony"] svg');if(svg){const mini=document.createElement('span');mini.className='pet row-pet';mini.dataset.pose='stand';mini.dataset.face='right';mini.dataset.gear='full';mini.setAttribute('aria-hidden','true');mini.innerHTML=ReservePetArt.svg();svg.replaceWith(mini);}}
 function notice(message,error=false){clearTimeout(statusTimer);status.textContent=message;status.hidden=!message;status.classList.toggle('error',error);if(message&&!error)statusTimer=setTimeout(()=>{status.hidden=true;status.textContent='';},3500);}
 function editor(show=true){$('school-editor').hidden=!show;$('change-school').setAttribute('aria-expanded',String(show));if(show)school.focus();}
 // Values still being saved win over older saved ones, so a finishing save never moves a control back
 // under the keyboard (three quick arrow presses save the third value).
 const pending=new Map();
 function drawPreferences(saved){
  const data={...saved};for(const [key,item]of pending)data[key]=item.value;
  const settings=data,pet={enabled:data.pet},name='Biscuit',dark=settings.theme==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  $('look-value').textContent=(dark?'Dark':'Light')+' · '+({gentle:'lively drawings',still:'still drawings',off:'motion off'}[settings.motion]||'lively drawings');
  for(const input of all('[data-preference]')){input.disabled=false;if(input.type==='radio')input.checked=input.value===settings[input.dataset.preference];else input.value=settings[input.dataset.preference]??0;}
  $('night-art-control').hidden=!dark;$('night-art-value').textContent=(settings.nightArt||0)+'%';
  $('pet-enabled').checked=pet.enabled!==false;$('pet-enabled').disabled=false;
  $('pony-value').textContent=(pet.enabled!==false?'On':'Off')+' · '+name;$('pony-name').textContent=name;
  const art=$('pony-art');if(!art.firstChild)art.innerHTML=ReservePetArt.svg();art.dataset.gear=pet.gear||'full';
  const coat=ReservePetArt.COATS[pet.coat]||ReservePetArt.COATS.oat;
  for(const [part,color]of Object.entries(coat))if(part!=='label')art.style.setProperty('--pet-'+part,color);
  art.style.setProperty('--pet-harness',ReservePetArt.HARNESS[pet.harness]||ReservePetArt.HARNESS.red);
  const mini=document.querySelector('.row-pet');if(mini){for(const [part,color]of Object.entries(coat))if(part!=='label')mini.style.setProperty('--pet-'+part,color);mini.style.setProperty('--pet-harness',ReservePetArt.HARNESS[pet.harness]||ReservePetArt.HARNESS.red);mini.classList.toggle('is-off',pet.enabled===false);}
 }
 async function chooseSchool(value){
  let next;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error();next=url.origin;}catch{return;}
  if(next===origin)return;
  origin=next;$('school-host').textContent=new URL(next).host;
 }
 preferences.subscribe(drawPreferences);preferences.load().then(drawPreferences).catch(()=>notice('Could not load your choices. Try again.',true));
 function drawNav(value){const nav=Object.hasOwn(navNames,value)?value:'drawn';$('menu-value').textContent=navNames[nav];for(const button of all('[data-nav]'))button.setAttribute('aria-pressed',String(button.dataset.nav===nav));}
 chrome.storage.local.get(['reserve:enabled','reserve:canvasNav']).then(saved=>{enabled.checked=saved['reserve:enabled']!==false;enabled.disabled=false;drawNav(saved['reserve:canvasNav']);}).catch(()=>notice('Could not load settings. Try again.',true));
 const storedChanged=(changes,area)=>{if(area!=='local')return;if(changes['reserve:canvasNav'])drawNav(changes['reserve:canvasNav'].newValue);if(changes['reserve:enabled'])enabled.checked=changes['reserve:enabled'].newValue!==false;};
 chrome.storage.onChanged.addListener(storedChanged);
 enabled.addEventListener('change',async()=>{enabled.disabled=true;try{await chrome.storage.local.set({'reserve:enabled':enabled.checked});notice('Saved.');}catch{enabled.checked=!enabled.checked;notice('Could not save. Try again.',true);}finally{enabled.disabled=false;}});
 for(const row of all('[data-detail]'))row.addEventListener('click',()=>{
  lastRow=row;$('main-view').hidden=true;$('detail-view').hidden=false;$('detail-title').textContent=titles[row.dataset.detail];
  for(const panel of all('[data-panel]'))panel.hidden=panel.dataset.panel!==row.dataset.detail;
  $('back').focus();
 });
 function back(){if($('detail-view').hidden)return;$('detail-view').hidden=true;$('main-view').hidden=false;lastRow?.focus();}
 $('back').addEventListener('click',back);document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();back();}});
 for(const button of all('[data-nav]'))button.addEventListener('click',async()=>{
  // Saves are short and queued; the control stays enabled so keyboard focus never drops.
  button.setAttribute('aria-busy','true');try{await chrome.storage.local.set({'reserve:canvasNav':button.dataset.nav});drawNav(button.dataset.nav);notice('Saved.');}catch{notice('Could not save. Try again.',true);}finally{button.removeAttribute('aria-busy');}
 });
 async function savePreference(input,patch){
  for(const [key,value]of Object.entries(patch))pending.set(key,{count:(pending.get(key)?.count||0)+1,value});
  input.setAttribute('aria-busy','true');let failed=false;
  try{await preferences.set(patch);notice('Saved.');}catch{failed=true;notice('Could not save. Try again.',true);}
  finally{for(const key of Object.keys(patch)){const item=pending.get(key);if(item&&--item.count<=0)pending.delete(key);}input.removeAttribute('aria-busy');}
  if(failed||!pending.size)drawPreferences(preferences.get());
 }
 for(const input of all('[data-preference]'))input.addEventListener('change',()=>savePreference(input,{[input.dataset.preference]:input.type==='range'?Number(input.value):input.value}));
 $('night-art').addEventListener('input',()=>{$('night-art-value').textContent=$('night-art').value+'%';});
 $('pet-enabled').addEventListener('change',()=>savePreference($('pet-enabled'),{pet:$('pet-enabled').checked}));
 async function loadSites(){
  const sites=await ReserveSchool.list(),list=$('sites');list.replaceChildren();
  for(const site of sites){
   const item=document.createElement('li'),name=document.createElement('span'),remove=document.createElement('button');
   name.textContent=new URL(site).host;remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+name.textContent);
   remove.addEventListener('click',async()=>{remove.disabled=true;try{await ReserveSchool.remove(site);notice('Removed. Canvas Harness no longer runs on '+name.textContent+'.');await loadSites();}catch{notice('Could not remove that site. Try again.',true);remove.disabled=false;}});
   item.append(name,remove);list.append(item);
  }
  list.hidden=!sites.length;
 }
 loadSites().then(()=>chrome.tabs.query({active:true,currentWindow:true})).then(async tabs=>{
  const active=tabs?.[0]?.url,saved=await ReserveSchool.saved();
  school.value=ReserveSite.supported(active)?new URL(active).origin:saved||(!publicBuild?ReserveSite.origin():'');
  if(school.value)await chooseSchool(school.value);
 }).catch(()=>notice('Could not load your Canvas address.',true));
 $('change-school').addEventListener('click',()=>editor($('school-editor').hidden));
 school.addEventListener('change',()=>chooseSchool(school.value));
 async function openCanvas(){
  try{
   // Call directly in the user gesture: custom-site permission must precede any await.
   const result=await ReserveSchool.open(school.value,{onAsk:host=>notice('Your browser will ask to allow '+host+'.')});
   if(result.message)notice(result.message,!result.ok);
   if(!result.ok){editor();school.focus();}else{await chooseSchool(school.value);await loadSites();}
  }catch{notice('Could not open Canvas. Check the address and try again.',true);editor();}
 }
 $('open').addEventListener('click',openCanvas);$('school-editor').addEventListener('submit',event=>{event.preventDefault();openCanvas();});
 $('welcome-tour').addEventListener('click',event=>{event.preventDefault();chrome.tabs.create({url:chrome.runtime.getURL('welcome.html')}).catch(()=>notice('Could not open the tour. Try again.',true));});
 $('reload-extension').addEventListener('click',()=>chrome.runtime.reload());
 const appearance=ReserveNativeAppearance.create({adapter:ReserveNativePage.browserAdapter(),media:matchMedia('(prefers-color-scheme: dark)'),apply:prefs=>{
  for(const select of all('[data-native]')){select.value=prefs[select.dataset.native];select.disabled=false;}
  $('native-value').textContent=prefs.theme==='original'?'Canvas’s own look':'Light · '+(prefs.readingWidth==='full'?'full width':'comfortable');
 },onError:error=>notice(error.message||'Appearance could not load.',true)});
 appearance.start().catch(error=>{if(error.code!=='cancelled')notice('Appearance could not load.',true);});
 for(const select of all('[data-native]'))select.addEventListener('change',()=>{select.disabled=true;appearance.set({[select.dataset.native]:select.value}).then(()=>notice('Saved.')).catch(error=>{select.value=appearance.get()[select.dataset.native];notice(error.message||'Appearance could not save.',true);}).finally(()=>{select.disabled=false;});});
 window.addEventListener('pagehide',()=>{appearance.destroy();preferences?.destroy();chrome.storage.onChanged.removeListener(storedChanged);clearTimeout(statusTimer);},{once:true});
})();
