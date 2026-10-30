/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),all=selector=>[...document.querySelectorAll(selector)];
 const manifest=chrome.runtime.getManifest(),school=$('school-url'),status=$('status'),enabled=$('enabled');
 // the school-address controls exist only in builds that can ask for a school's own Canvas site
 const publicBuild=(manifest.optional_host_permissions||[]).includes('https://*/*'),
   titles={look:'Look',menu:'Canvas menu bar',pony:'Pony',native:'Canvas pages',features:'Features',addons:'Installed add-ons'};
 const navNames={drawn:'From the left edge',shown:'Full height',top:'Across the top',original:'Canvas’s own'};
 const preferences=ReservePagePreferences.create();
 const Features=globalThis.ReserveFeatures,featureCatalogue=Features?.catalogue||[],featureControls=new Map();
 const featuresAvailable=Features&&Array.isArray(Features.catalogue)&&typeof Features.normalize==='function'&&typeof Features.resolve==='function';
 let featurePrefs,featureSaved,featureReady=false,featureLoading=false,featurePending=0,featureRevision=0,featureWrites=Promise.resolve();
 let origin='',lastRow=null,statusTimer=0,popupClosed=false;
 const MARKET_URL='https://flzsh.github.io/canvas-harness-packs/',PACKS_KEY='reserve:packs';
 let packInstalled=[],packLoading=false,packRevision=0,packWrites=Promise.resolve();const packPending=new Set();
 $('product-name').textContent=manifest.name;$('version').textContent=manifest.version_name||manifest.version;document.title=manifest.name;
 $('school-section').hidden=!publicBuild;
 // the drawn pictures: row icons, the real Biscuit on the Pony row, and the four menu-bar layouts
 const PopupArt=globalThis.ReservePopupArt;
 if(PopupArt){
  for(const [detail,name]of [['look','look'],['menu','menubar'],['native','pages']]){
    const svg=document.querySelector(`.setting-row[data-detail="${detail}"] svg`);
    if(svg)svg.outerHTML=PopupArt.icons[name];
  }
  for(const button of all('[data-nav]')){const svg=button.querySelector('svg');if(svg&&PopupArt.layouts[button.dataset.nav])svg.outerHTML=PopupArt.layouts[button.dataset.nav];}
 }
 {
   const svg=document.querySelector('.setting-row[data-detail="pony"] svg');
   if(svg){
     const mini=document.createElement('span');
     mini.className='pet row-pet';
     mini.dataset.pose='stand';
     mini.dataset.face='right';
     mini.dataset.gear='full';
     mini.setAttribute('aria-hidden','true');
     mini.innerHTML=ReservePetArt.svg();
     svg.replaceWith(mini);
   }
 }
 function notice(message,error=false){
   clearTimeout(statusTimer);
   status.textContent=message;
   status.hidden=!message;
   status.classList.toggle('error',error);
   if(message&&!error)statusTimer=setTimeout(()=>{status.hidden=true;status.textContent='';},3500);
 }
 function featureStatus(message=''){$('features-status').textContent=message;$('features-status').hidden=!message;}
 function featureError(message=''){$('features-error').textContent=message;$('features-error').hidden=!message;}
 function packStatus(message=''){$('addons-status').textContent=message;$('addons-status').hidden=!message;}
 function packError(message=''){$('addons-error').textContent=message;$('addons-error').hidden=!message;}
 function openMarket(){
  // The optional host request must run in the original click stack.
  const opening=globalThis.ReserveMarket?ReserveMarket.open(MARKET_URL):chrome.tabs.create({url:MARKET_URL});
  return opening.catch(()=>{if(!popupClosed)notice('Could not open the Market. Try again.',true);});
 }
 function drawAddons(){
  if(popupClosed)return;
  $('addons-panel').setAttribute('aria-busy',String(packLoading||packPending.size>0));
  const list=$('addons-list'),focused=document.activeElement?.dataset?.packRemove;list.replaceChildren();
  const labels={'course-art':'Course artwork',kit:'Artwork kit',feature:'Feature',theme:'Theme',pet:'Companion',preset:'Preset'};
  for(const row of packInstalled){
   const item=document.createElement('li'),text=document.createElement('span'),name=document.createElement('b'),kind=document.createElement('small'),remove=document.createElement('button');
   name.textContent=row.name;kind.textContent=labels[row.kind]||'Pack';text.append(name,kind);
   remove.type='button';
   remove.className='text-button';
   remove.dataset.packRemove=row.id;
   remove.textContent=packPending.has(row.id)?'Removing…':'Remove';
   remove.disabled=packPending.has(row.id);
   remove.setAttribute('aria-label','Remove '+row.name);
   remove.addEventListener('click',()=>removePack(row.id));item.append(text,remove);list.append(item);if(focused===row.id&&!remove.disabled)remove.focus();
  }
  $('addons-empty').hidden=packLoading||packInstalled.length>0;
 }
 async function refreshInstalled(){
  if(popupClosed)return;
  const turn=++packRevision;packLoading=true;packError();packStatus('Loading add-ons…');$('addons-retry').hidden=true;drawAddons();
  try{
   if(!globalThis.ReservePacks)throw Error('Pack support is unavailable.');
   const rows=await ReservePacks.installed();if(popupClosed||turn!==packRevision)return;
   packInstalled=rows.filter(row=>row&&typeof row.id==='string'&&typeof row.name==='string'&&['feature','course-art','kit','theme','pet','preset'].includes(row.kind));packStatus();
  }catch(error){if(!popupClosed&&turn===packRevision){packStatus();packError(error?.message||'Could not read installed packs. Try again.');$('addons-retry').hidden=false;}}
  finally{if(!popupClosed&&turn===packRevision){packLoading=false;drawAddons();}}
 }
 function removePack(id){
  if(popupClosed||packPending.has(id)||!packInstalled.some(row=>row.id===id))return;
  packPending.add(id);packError();drawAddons();
  packWrites=packWrites.catch(()=>{}).then(async()=>{
   try{
    await ReservePacks.remove(id);if(popupClosed)return;
    await refreshInstalled();packStatus('Pack removed. Reload Canvas to apply.');
    if(document.activeElement===document.body)$('addons-panel').querySelector('button')?.focus();
   }catch(error){if(!popupClosed)packError(error?.message||'Could not remove the pack. Try again.');}
   finally{packPending.delete(id);drawAddons();}
  });return packWrites;
 }
 $('market-open').addEventListener('click',openMarket);for(const button of all('.ap-market-open'))button.addEventListener('click',openMarket);
 $('addons-retry').addEventListener('click',refreshInstalled);
 function buildFeatures(){
  if(!featuresAvailable)return;
  const groups=new Map();
  for(const feature of featureCatalogue){
   let rows=groups.get(feature.group);
   if(!rows){
    const group=document.createElement('fieldset'),legend=document.createElement('legend');
    group.className='feature-group';legend.textContent=feature.group;rows=document.createElement('div');rows.className='rows drawn';
    group.append(legend,rows);$('feature-groups').append(group);groups.set(feature.group,rows);
   }
   const row=document.createElement('label'),name=document.createElement('span'),label=document.createElement('b'),input=document.createElement('input'),track=document.createElement('span');
   row.className='setting-row switch feature-switch';label.textContent=feature.label||feature.name;name.append(label);
   input.type='checkbox';input.id='feature-'+feature.id;input.dataset.feature=feature.id;input.setAttribute('role','switch');input.disabled=true;
   track.className='switch-track';track.setAttribute('aria-hidden','true');row.append(name,input,track);rows.append(row);featureControls.set(feature.id,input);
   input.addEventListener('change',()=>toggleFeature(feature.id,input.checked));
  }
 }
 function drawFeatures(){
  if(popupClosed)return;
  const effective=new Set(featureReady?Features.resolve(featurePrefs).enabled:[]);
  $('features-panel').setAttribute('aria-busy',String(featureLoading||featurePending>0));
  $('features-value').textContent=featureReady?({full:'Full',lite:'Lite',custom:'Custom'}[featurePrefs.preset]):featureLoading?'Loading…':'Unavailable';
  for(const input of all('[data-feature-preset]')){input.disabled=!featureReady;input.checked=featureReady&&input.value===featurePrefs.preset;}
  for(const [id,input]of featureControls){input.disabled=!featureReady;input.checked=effective.has(id);}
 }
 async function loadFeatures(){
  if(popupClosed)return;
  if(!featuresAvailable){featureError('Features are unavailable. Reload the extension and try again.');drawFeatures();return;}
  const turn=++featureRevision;featureLoading=true;featureReady=false;featureError();featureStatus('Loading features…');$('features-retry').hidden=true;drawFeatures();
  try{
   const saved=await chrome.storage.local.get(Features.KEY);if(popupClosed||turn!==featureRevision)return;
   featurePrefs=Features.normalize(saved[Features.KEY]);featureSaved=featurePrefs;featureReady=true;featureStatus();
  }catch{if(!popupClosed&&turn===featureRevision){featureStatus();featureError('Could not load features. Try again.');$('features-retry').hidden=false;}}
  finally{if(turn===featureRevision){featureLoading=false;drawFeatures();}}
 }
 function saveFeatures(value){
  if(!featureReady||popupClosed)return;
  const next=Features.normalize(value),turn=++featureRevision;
  featurePrefs=next;featurePending++;featureError();featureStatus('Saving features…');drawFeatures();
  // One write at a time; keep the same enabled controls and the latest optimistic choice.
  featureWrites=featureWrites.then(async()=>{
   if(popupClosed){featurePending--;return;}
   try{
    await Features.write(next);featureSaved=next;
    if(!popupClosed&&turn===featureRevision){featureError();featureStatus('Saved.');}
   }catch{if(!popupClosed&&turn===featureRevision){featurePrefs=featureSaved;featureStatus();featureError('Could not save features. Your saved choices are still active. Try again.');}}
   finally{featurePending--;drawFeatures();}
  });
  return featureWrites;
 }
 function toggleFeature(id,on){
  if(!featureReady||popupClosed)return;
  const selected=new Set(featurePrefs.preset==='custom'?featurePrefs.custom:Features.resolve(featurePrefs).enabled);
  if(on)selected.add(id);
  else{
   // An effective requirement can be switched off: remove all of its dependents too.
   const removed=new Set([id]);let size;
   do{size=removed.size;for(const feature of featureCatalogue)if(feature.needs?.some(need=>removed.has(need)))removed.add(feature.id);}while(size!==removed.size);
   for(const removedId of removed)selected.delete(removedId);
  }
  return saveFeatures({preset:'custom',custom:[...selected]});
 }
 buildFeatures();$('features-retry').addEventListener('click',loadFeatures);
 for(const input of all('[data-feature-preset]'))input.addEventListener('change',()=>{if(input.checked)saveFeatures({...featurePrefs,preset:input.value});});
 function editor(show=true){$('school-editor').hidden=!show;$('change-school').setAttribute('aria-expanded',String(show));if(show)school.focus();}
 // Values still being saved win over older saved ones, so a finishing save never moves a control back
 // under the keyboard (three quick arrow presses save the third value).
 const pending=new Map();
 function drawPreferences(saved){
  if(popupClosed)return;
  const data={...saved};for(const [key,item]of pending)data[key]=item.value;
  const settings=data,pet={enabled:data.pet},name='Biscuit',dark=settings.theme==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  $('look-value').textContent=(dark?'Dark':'Light')+' · '+({gentle:'lively drawings',still:'still drawings',off:'motion off'}[settings.motion]||'lively drawings');
  for(const input of all('[data-preference]')){
    input.disabled=false;
    if(input.type==='radio')input.checked=input.value===settings[input.dataset.preference];else input.value=settings[input.dataset.preference]??0;
  }
  $('night-art-control').hidden=!dark;$('night-art-value').textContent=(settings.nightArt||0)+'%';
  $('pet-enabled').checked=pet.enabled!==false;$('pet-enabled').disabled=false;
  $('pony-value').textContent=(pet.enabled!==false?'On':'Off')+' · '+name;$('pony-name').textContent=name;
  const art=$('pony-art');if(!art.firstChild)art.innerHTML=ReservePetArt.svg();art.dataset.gear=pet.gear||'full';
  const coat=ReservePetArt.COATS[pet.coat]||ReservePetArt.COATS.oat;
  for(const [part,color]of Object.entries(coat))if(part!=='label')art.style.setProperty('--pet-'+part,color);
  art.style.setProperty('--pet-harness',ReservePetArt.HARNESS[pet.harness]||ReservePetArt.HARNESS.red);
  const mini=document.querySelector('.row-pet');
  if(mini){
    for(const [part,color]of Object.entries(coat))if(part!=='label')mini.style.setProperty('--pet-'+part,color);
    mini.style.setProperty('--pet-harness',ReservePetArt.HARNESS[pet.harness]||ReservePetArt.HARNESS.red);
    mini.classList.toggle('is-off',pet.enabled===false);
  }
 }
 async function chooseSchool(value){
  let next;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error();next=url.origin;}catch{return;}
  if(next===origin)return;
  origin=next;$('school-host').textContent=new URL(next).host;
 }
 preferences.subscribe(drawPreferences);preferences.load().then(drawPreferences).catch(()=>notice('Could not load your choices. Try again.',true));
 function drawNav(value){
   const nav=Object.hasOwn(navNames,value)?value:'drawn';
   $('menu-value').textContent=navNames[nav];
   for(const button of all('[data-nav]'))button.setAttribute('aria-pressed',String(button.dataset.nav===nav));
 }
 chrome.storage.local.get(['reserve:enabled','reserve:canvasNav']).then(saved=>{
   enabled.checked=saved['reserve:enabled']!==false;
   enabled.disabled=false;
   drawNav(saved['reserve:canvasNav']);
 }).catch(()=>notice('Could not load settings. Try again.',true));
 const storedChanged=(changes,area)=>{
  if(popupClosed||area!=='local')return;
  if(Object.keys(changes).some(key=>key===PACKS_KEY||key.startsWith('reserve:market-media:')&&key.endsWith(':packs'))&&lastRow?.dataset.detail==='addons'&&!$('detail-view').hidden&&!packPending.size)
    void refreshInstalled();
  if(changes['reserve:canvasNav'])drawNav(changes['reserve:canvasNav'].newValue);if(changes['reserve:enabled'])enabled.checked=changes['reserve:enabled'].newValue!==false;
  if(featuresAvailable&&changes[Features.KEY]&&!featurePending){
   const next=Features.normalize(changes[Features.KEY].newValue);
   if(!featureReady||JSON.stringify(next)!==JSON.stringify(featurePrefs)){
    featureRevision++;featureLoading=false;featurePrefs=next;featureSaved=next;featureReady=true;featureError();featureStatus();$('features-retry').hidden=true;drawFeatures();
   }
  }
 };
 chrome.storage.onChanged.addListener(storedChanged);
 loadFeatures();
 enabled.addEventListener('change',async()=>{
   enabled.disabled=true;
   try{
     await chrome.storage.local.set({'reserve:enabled':enabled.checked});
     notice('Saved.');
   }catch{enabled.checked=!enabled.checked;notice('Could not save. Try again.',true);}finally{enabled.disabled=false;}
 });
 for(const row of all('[data-detail]'))row.addEventListener('click',()=>{
  if(row.hidden)return;
  lastRow=row;$('main-view').hidden=true;$('detail-view').hidden=false;$('detail-title').textContent=titles[row.dataset.detail];
  for(const panel of all('[data-panel]'))panel.hidden=panel.dataset.panel!==row.dataset.detail;
  if(row.dataset.detail==='addons')void refreshInstalled();
  $('back').focus();
 });
 function back(){if($('detail-view').hidden)return;$('detail-view').hidden=true;$('main-view').hidden=false;(lastRow&&!lastRow.hidden?lastRow:$('open')).focus();}
 $('back').addEventListener('click',back);document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();back();}});
 for(const button of all('[data-nav]'))button.addEventListener('click',async()=>{
  // Saves are short and queued; the control stays enabled so keyboard focus never drops.
  button.setAttribute('aria-busy','true');
  try{
    await chrome.storage.local.set({'reserve:canvasNav':button.dataset.nav});
    drawNav(button.dataset.nav);
    notice('Saved.');
  }catch{notice('Could not save. Try again.',true);}finally{button.removeAttribute('aria-busy');}
 });
 async function savePreference(input,patch){
  if(popupClosed)return;
  for(const [key,value]of Object.entries(patch))pending.set(key,{count:(pending.get(key)?.count||0)+1,value});
  input.setAttribute('aria-busy','true');let failed=false;
  try{await preferences.set(patch);if(!popupClosed)notice('Saved.');}catch{failed=true;if(!popupClosed)notice('Could not save. Try again.',true);}
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
   remove.addEventListener('click',async()=>{
     remove.disabled=true;
     try{
       await ReserveSchool.remove(site);
       notice('Removed. Canvas Harness no longer runs on '+name.textContent+'.');
       await loadSites();
     }catch{notice('Could not remove that site. Try again.',true);remove.disabled=false;}
   });
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
 $('welcome-tour').addEventListener('click',event=>{
   event.preventDefault();
   chrome.tabs.create({url:chrome.runtime.getURL('welcome.html')}).catch(()=>notice('Could not open the tour. Try again.',true));
 });
 $('reload-extension').addEventListener('click',()=>chrome.runtime.reload());
 const appearance=ReserveNativeAppearance.create({adapter:ReserveNativePage.browserAdapter(),media:matchMedia('(prefers-color-scheme: dark)'),apply:prefs=>{
  for(const select of all('[data-native]')){select.value=prefs[select.dataset.native];select.disabled=false;}
  $('native-value').textContent=prefs.theme==='original'?'Canvas’s own look':'Light · '+(prefs.readingWidth==='full'?'full width':'comfortable');
 },onError:error=>notice(error.message||'Appearance could not load.',true)});
 appearance.start().catch(error=>{if(error.code!=='cancelled')notice('Appearance could not load.',true);});
 for(const select of all('[data-native]'))
   select.addEventListener('change',()=>{
     select.disabled=true;
     appearance.set({[select.dataset.native]:select.value}).then(()=>notice('Saved.')).catch(error=>{
       select.value=appearance.get()[select.dataset.native];
       notice(error.message||'Appearance could not save.',true);
     }).finally(()=>{
       select.disabled=false;
     });
   });
 window.addEventListener('pagehide',()=>{
   popupClosed=true;
   appearance.destroy();
   preferences?.destroy();
   chrome.storage.onChanged.removeListener(storedChanged);
   clearTimeout(statusTimer);
 },{once:true});
})();
