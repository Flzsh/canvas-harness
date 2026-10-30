// Adapted from Gary Wu's pull request #47 to Canvas Harness.
// Make it yours keeps a small feature controller in every preset; the optional
// appearance editor shares its nonmodal dock and focus lifecycle.
(function(root){
 'use strict';

 const enabled=id=>!root.ReserveFeatures||root.ReserveFeatures.enabled(id);
 const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const SHORTCUTS=[['Ctrl / ⌘ + K','Open Tools and search'],['/','Search the current workspace'],['?','Open settings and keyboard shortcuts'],['B','Wake your companion and ask it something'],['Escape','Close the active dock or drawer'],['← / →, Home / End','Choose a focused workspace tab']];
 // The full editor's More tab adds the Home layout reset beside Reset appearance (`resetLayout`) and its
 // "Add from a file" section (`files`) under Backups.
 function preferencesPane(c,{resetLayout=false,files=''}={}){
  const s=c.s||{},
    p=c.personal||{},
    state=c.preferences||{},
    zones=[['America/New_York','Eastern time'],['America/Chicago','Central time'],['America/Denver','Mountain time'],['America/Los_Angeles','Pacific time'],['Asia/Shanghai','China standard time'],['Europe/London','London time'],['UTC','UTC']];
  if(s.timeZone&&!zones.some(([key])=>key===s.timeZone))zones.push([s.timeZone,s.timeZone]);
  const button=(action,label)=>`<button type="button" class="rd-button" data-rd-action="preferences-${action}"${state.busy?' disabled':''}>${E(label)}</button>`,summary=state.summary;
  return `<div class="cz-pane" data-pane="settings" role="tabpanel" aria-label="Settings"${['all','settings',undefined].includes(c.customizeTab)?'':' hidden'}><section class="cz-group" data-art="Daily preferences"><h3>Daily preferences</h3><label class="rd-field"><span>Display deadlines in</span><select data-rd-field="preferences-timezone"${state.busy?' disabled':''}>${zones.map(([key,label])=>`<option value="${E(key)}"${key===s.timeZone?' selected':''}>${E(label)}</option>`).join('')}</select></label><div class="cz-row">${button('export-calendar','Export calendar')}</div></section><section class="cz-group" data-art="Backups & portability" aria-label="Backups"><h3>Backups &amp; portability</h3><div class="cz-row">${button('export-backup','Export my backup')}<label class="rd-button">Import backup<input type="file" accept="application/json,.json" data-rd-field="preferences-backup"${state.busy?' disabled':''}></label>${button('recover-backup','Undo last restore')}</div>${state.status?`<p role="status">${E(state.status)}</p>`:''}${state.clearedScratchpad!==null&&state.clearedScratchpad!==undefined?button('undo-scratchpad','Undo scratchpad clear'):''}${summary?`<section class="cz-group"><h4>Review your backup</h4><p>Restore ${summary.tasks} personal tasks, ${summary.notes} assignment plans and ${summary.packs.length} installed packs and ${summary.media||0} saved media items for this account?</p>${summary.packs.length?`<ul>${summary.packs.map(row=>`<li>${E(row.name)} · ${E(row.kind)}</li>`).join('')}</ul>`:''}${summary.notice?`<p>${E(summary.notice)}</p>`:''}<p>This replaces your personal workspace. A recovery copy is saved before restoring.</p><div class="cz-row">${button('confirm-import','Restore workspace')}${button('cancel-import','Cancel')}</div></section>`:''}</section>${files}<section class="cz-group" data-art="Start over"><h3>Start over</h3><div class="cz-row">${button('reset-appearance','Reset appearance')}${resetLayout?`<button type="button" class="rd-button" data-rd-action="layout-reset">Reset layout</button>`:''}</div></section><section class="cz-group" data-art="Keyboard shortcuts"><h3>Keyboard shortcuts</h3>${SHORTCUTS.map(([key,label])=>`<p><kbd>${E(key)}</kbd> ${E(label)}</p>`).join('')}</section>${p.toolbox?.scratchpad?`<section class="cz-group" data-art="Saved scratchpad"><h3>Saved scratchpad</h3><textarea class="rd-textarea" readonly rows="6" aria-label="Saved scratchpad text">${E(p.toolbox.scratchpad)}</textarea><div class="cz-row">${button('copy-scratchpad','Copy text')}${button('clear-scratchpad','Clear scratchpad')}</div></section>`:''}</div>`;
 }
 function createPreferences({store,flush=async()=>{},calendar=()=>[],onChange=()=>{},download=(value,name,type='application/json')=>{
   const url=root.URL.createObjectURL(new root.Blob([typeof value==='string'?value:JSON.stringify(value)],{type})),a=root.document.createElement('a');
   a.href=url;
   a.download=name;
   a.click();
   root.setTimeout(()=>root.URL.revokeObjectURL(url),1000);
 }}){
  const state={busy:false,status:'',summary:null,clearedScratchpad:null};let dead=false,revision=0,pending=null;
  const notify=()=>{
    if(!dead)onChange();
  },storage=()=>root.ReserveStorage||(typeof module==='object'&&module.exports?require('./storage.js'):null),clear=()=>{revision++;pending=null;state.summary=null;};
  const valid=turn=>!dead&&turn===revision;
  async function settle(turn){
    const result=await flush();
    if(!valid(turn))return false;
    if(result===false||Array.isArray(result)&&result.includes(false))throw Error('Save your pending edits before continuing.');
    await store.update(()=>{});
    return valid(turn);
  }
  async function review(backup,turn=revision){
    const clean=storage().validateBackup(backup,store.owner),envelope=typeof backup==='string'?JSON.parse(backup):backup,addons=envelope.addons;
    if(addons!==undefined&&
      (!addons||
        addons.version!==1||
        !Array.isArray(addons.entries)||
        !Array.isArray(addons.kits)||
        !Array.isArray(addons.media)||
        addons.entries.length>250||
        addons.kits.length>100||
        addons.media.length>1200||
        addons.entries.some(e=>!e?.row||typeof e.row.name!=='string'||!e.row.name||e.row.name.length>120||!['feature','course-art','kit'].includes(e.row.kind))))
      throw Error('Invalid installed add-ons in backup.');
    if(typeof store.importBackup!=='function'&&(addons||Object.keys(clean.settings?.makeYourOwn?.installed||{}).length))
      throw Error('Pack-aware backup restore is unavailable. Reload Canvas Harness and try again.');
    if(addons){
      const P=root.ReservePacks;
      if(P?.validateCatalogue)
        await P.validateCatalogue(addons,{store,data:clean});
      else if(root.chrome?.runtime?.sendMessage){
        const reply=await root.chrome.runtime.sendMessage({type:'market-local',op:'review-catalogue',owner:store.owner,addons,data:clean});
        if(reply?.ok!==true)throw Error(reply?.reason||'Could not validate installed add-ons.');
      }
      else throw Error('Pack-aware backup review is unavailable. Reload Canvas Harness and try again.');
    }
    if(!valid(turn))return;
    pending={backup,clean};
    state.summary={
      tasks:clean.customTasks.length,
      notes:Object.keys(clean.tasks).length,
      packs:[...Object.values(clean.settings.makeYourOwn?.installed||{}),...(addons?.entries||[]).map(e=>e.row)],
      media:addons?.media.length||0,
      notice:envelope.courseFilesNotice||''
    };
  }
  async function change(file){
   if(dead||state.busy||!file)return;clear();const turn=revision;state.busy=true;state.status='Checking backup…';notify();
   try{
     if(!Number.isSafeInteger(file.size)||file.size<1||file.size>66500000||typeof file.text!=='function')throw Error('Choose a Canvas Harness backup file up to 66.5 MB.');
     const source=await file.text();
     if(dead||turn!==revision)return;
     await review(source,turn);
     state.status='';
   }
   catch(error){if(!dead&&turn===revision){pending=null;state.summary=null;state.status=error.message||'Could not review backup.';}}
   finally{if(!dead){state.busy=false;notify();}}
  }
  async function action(name){
   if(dead)return false;if(name==='cancel-import'){clear();state.status='';notify();return true;}if(state.busy)return true;
   if(!['export-backup','export-calendar','recover-backup','confirm-import','copy-scratchpad','clear-scratchpad','undo-scratchpad','reset-appearance'].includes(name))return false;
   state.busy=true;state.status='';notify();const turn=revision;
   try{
    if(name==='export-backup'){
      if(!await settle(turn))return true;
      const backup=typeof store.exportBackupWithPacks==='function'?await store.exportBackupWithPacks():await store.exportBackup();
      if(!valid(turn))return true;
      const zone=store.get().settings?.timeZone||'America/New_York',date=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now());
      download(backup,'CH-Plus-backup-'+date+'.json');
      state.status=backup.courseFilesNotice||'Personal workspace exported.';
    }
    if(name==='export-calendar'){
      if(!await settle(turn))return true;
      if(!valid(turn))return true;
      const items=calendar();
      if(!items.length)
        state.status='There are no upcoming deadlines to export.';
      else{
        const core=root.ReserveCore||(typeof module==='object'&&module.exports?require('./core.js'):null);
        download(core.exportICS(items),'CH-Plus-deadlines.ics','text/calendar;charset=utf-8');
        state.status='Prepared '+items.length+' upcoming deadlines. Import the file into your calendar.';
      }
    }
    if(name==='recover-backup'){
      clear();
      const reading=revision,backup=typeof store.readRecoveryBackup==='function'?await store.readRecoveryBackup():await store.readRecovery();
      if(dead||reading!==revision)return true;
      if(!backup)
        state.status='There is no previous restore to undo.';
      else await review(typeof backup==='string'||backup.format==='reserve-backup'?backup:{format:'reserve-backup',version:1,owner:store.owner,data:backup});
    }
    if(name==='confirm-import'&&pending){
      const draft=pending;
      if(!await settle(turn))return true;
      if(dead||turn!==revision||pending!==draft)return true;
      await store.saveRecovery();
      if(dead||turn!==revision||pending!==draft)return true;
      if(typeof store.importBackup==='function')await store.importBackup(draft.backup);else await store.replace(draft.clean);
      clear();
      state.status='Workspace restored. Undo last restore is available here.';
    }
    if(name==='copy-scratchpad'){
      if(!await settle(turn))return true;
      if(!root.navigator?.clipboard?.writeText)throw Error('Select the saved text and copy it.');
      await root.navigator.clipboard.writeText(store.get().toolbox?.scratchpad||'');
      state.status='Copied saved text.';
    }
    if(name==='clear-scratchpad'){
      if(!await settle(turn))return true;
      const before=store.get().toolbox?.scratchpad||'';
      await store.update(data=>{if(!valid(turn))return;data.toolbox??={};data.toolbox.scratchpad='';});
      state.clearedScratchpad=before||null;
      state.status='Scratchpad cleared.';
    }
    if(name==='undo-scratchpad'&&state.clearedScratchpad!==null){
      if(!await settle(turn))return true;
      await store.update(data=>{if(!valid(turn))return;if(data.toolbox?.scratchpad)throw Error('Your newer scratchpad text is kept.');data.toolbox??={};data.toolbox.scratchpad=state.clearedScratchpad;});
      state.clearedScratchpad=null;
      state.status='Scratchpad restored.';
    }
    if(name==='reset-appearance'){
      if(root.ReservePacks?.useInstalled)await root.ReservePacks.useInstalled('builtin:theme',{store});
      if(!valid(turn))return true;
      await store.update(data=>{
        if(!valid(turn))return;
        Object.assign(data.settings,{theme:'light',accent:'clay',density:'comfortable',font:'system',sceneTheme:''});
        if(data.settings.makeYourOwn)data.settings.makeYourOwn.theme=null;
      });
    }
   }catch(error){if(!dead)state.status=error.message||'Could not save.';}
   finally{if(!dead){state.busy=false;notify();}}return true;
  }
  async function setting(key,value){
    if(dead||state.busy||key!=='timeZone')return;
    try{
      new Intl.DateTimeFormat('en-US',{timeZone:value});
      await store.update(data=>{data.settings.timeZone=value;});
      state.status='';
    }catch(error){state.status=error.message||'Could not save time zone.';}
    notify();
  }
  // cancel() still bumps the revision (so an in-flight review or action stops), but only redraws when a backup review
  // was actually open: hiding the tab cancels every time, and an empty cancel cost a full dashboard render plus an AI
  // visit for no visible change (perf leaks-4).
  return {state,action,change,setting,cancel(){const had=!!pending||!!state.summary;clear();if(had)notify();},destroy(){dead=true;clear();}};
 }
 let featureWrites=Promise.resolve();
 function saveFeatures(value){
   const F=root.ReserveFeatures,next=F.normalize(value),write=featureWrites.then(async()=>{
     const reading=F.biscuitRevision;
     await root.chrome.storage.local.set({[F.KEY]:next});
     if(F.biscuitRevision===reading)F.applyBiscuitRules?.(next);
   });
   featureWrites=write.catch(()=>{});
   return write;
 }
 function toggleFeatures(prefs,id,on){
  const F=root.ReserveFeatures;if(!F.catalogue.some(f=>f.id===id)||typeof on!=='boolean')throw Error('Unknown feature.');
  const selected=new Set(prefs.preset==='custom'?prefs.custom:F.resolve(prefs).enabled);
  if(on)
    selected.add(id);
  else{
    const removed=new Set([id]);
    let size;
    do{size=removed.size;for(const item of F.catalogue)if(item.needs?.some(need=>removed.has(need)))removed.add(item.id);}while(size!==removed.size);
    for(const key of removed)selected.delete(key);
  }
  return F.normalize({preset:'custom',custom:[...selected]});
 }
 const featureLabels={
   dashboard:['Dashboard and assignments','dashboard'],
   'deadline-changes':['Deadline changes','planner'],
   planner:['Planner and Home modules','planner'],
   grades:['Grades','grades'],
   materials:['Materials library','materials'],
   'course-hub':['Course hub and inbox','hub'],
   'course-files':['My links & files','materials'],
   math:['Math tools','math'],
   gpa:['GPA estimates','gpa'],
   tools:['Quick open and tools','tools'],
   customization:['Appearance editor','customization'],
   'scene-themes':['Scene themes','art'],
   arrange:['Arrange the workspace','arrange'],
   'course-art':['Course artwork','art'],
   'quick-pack':['Artwork packs','upload'],
   pony:['Companion','pony'],
   motion:['Living drawings','living'],
   'canvas-nav':['Drawn menu bar','canvasnav'],
   'course-nav':['Drawn course menu','coursemenu'],
   'native-appearance':['Canvas pages','native'],
   pdf:['PDF reader','pdf'],
   ai:['Ask AI','ai'],
   play:['Play with this page','play'],
   'focus-room':['Focus room','planner'],
   'review-deck':['Review deck','tools'],
   'grade-impact':['Grade impact','grades']
 };
 featureLabels['biscuit-more-rules']=['Biscuit: more rules','pony'];
 function featuresPane(tab){return `<div class="cz-pane" data-pane="features" data-rd-key="features-pane" role="tabpanel" aria-label="Features"${tab==='features'?'':' hidden'}><div id="features-panel" aria-busy="false"></div><p id="features-status" hidden>Loading features\u2026</p><p id="features-error" role="alert" hidden></p><button id="features-retry" type="button" class="rd-text-button" hidden>Retry loading features</button><button id="features-reload" type="button" class="rd-button" hidden>Reload Canvas</button></div>`;}
 function render(c){
  if(enabled('customization')&&root.ReserveCustomizeUI?.render)return root.ReserveCustomizeUI.render(c);
  const tab=c.customizeTab==='settings'?'settings':'features';
  return `<div class="rd-appearance t-acc ch-settings-dock" data-open="${!!c.customizeOpen}" role="complementary" aria-labelledby="rd-appearance-title" ${c.customizeOpen?'':'inert aria-hidden="true"'}><div class="t-acc-panel" id="rd-appearance-panel" ${c.customizeOpen?'':'inert aria-hidden="true"'}><div class="t-acc-panel-inner"><section class="rd-customize ch-customize cz" aria-label="Customize workspace"><div class="rd-section-heading"><div><span class="ch-eyebrow">Your workspace</span><h2 id="rd-appearance-title">Make it yours</h2></div><button type="button" class="rd-button" data-rd-action="settings-close" aria-label="Close customization">Done</button></div><div class="cz-tabs" role="tablist" aria-label="Settings">${(c.featuresOnly?[['features','Features']]:[['features','Features'],['settings','Settings']]).map(([key,label])=>`<button type="button" class="cz-tab" data-rd-action="customize-tab" data-value="${key}" role="tab" aria-selected="${tab===key}">${label}</button>`).join('')}</div>${featuresPane(tab)}${c.featuresOnly?'':preferencesPane({...c,customizeTab:tab})}</section></div></div></div>`;
 }
 // Where each feature that has no place of its own on Home lives: the action that opens it, its data, and whether
 // the settings panel stays open (a settings tab) or closes so the feature can be seen.
 const OPENS={'focus-room':['room-open',{}],'review-deck':['workspace',{tab:'review'}],'grade-impact':['workspace',{tab:'grades'}],play:['play-open',{}],'biscuit-more-rules':['customize-tab',{value:'companion'},true]};
 function createFeatures(container,{store,getCustomPet=()=>null,close=()=>{}}={}){
  const F=root.ReserveFeatures,$=id=>container.querySelector('#'+id),catalogue=F?.catalogue||[],catalog=catalogue.map(({id,group})=>{
    const [name,icon]=featureLabels[id]||[id,'tools'];
    return {id,name,group,icon};
  });
  let dead=false,
    ready=false,
    loading=false,
    pending=0,
    revision=0,
    prefs,
    saved,
    instance=null,
    writes=Promise.resolve(),
    refreshAfterSave=false,
    companionKey='',
    companionPack=null,
    companionTurn=0,
    packRows=[],
    packTurn=0;
  const packPending=new Set();
  const error=(message='')=>{$('features-error').textContent=message;$('features-error').hidden=!message;};
  function draw(){
   if(dead)return;
   $('features-panel').setAttribute('aria-busy',String(loading||pending>0));$('features-status').hidden=!$('features-status').textContent;
   const effective=ready?F.resolve(prefs).enabled:[],changed=ready&&JSON.stringify(effective)!==JSON.stringify(F.current.enabled);
   $('features-reload').hidden=!changed;$('features-reload').disabled=!ready||pending>0;
   if(!ready||!root.ReserveAddonsPanel)return;
   const A=root.ReservePetArt,data=store?.get(),pack=getCustomPet()||companionPack,next=JSON.stringify(data?.settings?.makeYourOwn?.pet||null);
   if(next!==companionKey){
     companionKey=next;
     companionPack=null;
     const turn=++companionTurn;
     if(data&&A?.hydrate)Promise.resolve(A.hydrate(data,{store})).then(value=>{if(!dead&&turn===companionTurn){companionPack=value;draw();}}).catch(()=>{});
   }
   const state={
     catalog:catalog.map(row=>row.id==='pony'&&data&&A?.drawing?{...row,preview:A.drawing(data,pack)}:row),
     installed:packRows,
     packPending:[...packPending],
     prefs:{preset:prefs.preset,on:Object.fromEntries(catalogue.map(({id})=>[id,effective.includes(id)]))},
     changed
   };
   state.opens=Object.keys(OPENS);state.live=F.current?.enabled||[];
   if(instance)
     instance.update(state);
   else instance=root.ReserveAddonsPanel.mount($('features-panel'),{view:'features',...state,onOpen:openFeature,onPreset:preset=>{
     if(ready&&!dead)save({...prefs,preset});
   },onToggle:toggle,...(store?.owner?{onUse:id=>packAction('use',id),onReset:id=>packAction('reset',id),onRemove:id=>packAction('remove',id),onMarket:()=>openMarket()}: {})});
  }
  async function loadPacks(){
   if(dead||!store?.owner||typeof root.chrome?.runtime?.sendMessage!=='function')return;const turn=++packTurn;
   try{
     const reply=await root.chrome.runtime.sendMessage({type:'market-catalogue',owner:store.owner,kind:'feature'});
     if(dead||turn!==packTurn)return;
     if(reply?.ok!==true)throw Error(reply?.reason||'Could not load installed features.');
     packRows=(reply.packs||[]).filter(row=>row.kind==='feature');
     draw();
   }catch(e){if(!dead&&turn===packTurn){error(e.message);draw();}}
  }
  // The dashboard's own control does the work: a click on a short-lived button carrying the feature's action, so the
  // feature opens exactly as its own button would open it.
  function openFeature(id){
   const [action,data,stay]=OPENS[id]||[];if(!action||dead)return;
   if(!stay)close();
   const button=container.ownerDocument.createElement('button');button.type='button';button.hidden=true;button.dataset.rdAction=action;Object.assign(button.dataset,data);
   container.append(button);try{button.click();}finally{button.remove();}
  }
  async function openMarket(){
    try{
      const reply=await root.chrome.runtime.sendMessage({type:'open-market'});
      if(reply?.ok!==true)throw Error(reply?.reason||'Open the Canvas Harness extension popup and choose Add-ons.');
    }catch(e){if(!dead){error(e.message);draw();}}
  }
  async function packAction(op,id){
   if(dead||packPending.has(id)||!packRows.some(row=>row.id===id))return;packPending.add(id);error();draw();
   try{
     if(op==='reset'&&typeof root.ReservePacks?.resetInstalled==='function')
       await root.ReservePacks.resetInstalled(id,{store});
     else{
       const reply=await root.chrome.runtime.sendMessage(op==='remove'?{type:'market-remove',id,owner:store.owner}:{type:'market-local',op,id,owner:store.owner});
       if(reply?.ok!==true)throw Error(reply?.reason||'Could not change installed feature.');
     }
     if(dead)return;
     await store.sync?.();
     if(dead)return;
     await load();
     await loadPacks();
   }catch(e){if(!dead)error(e.message);}finally{packPending.delete(id);draw();}
  }
  async function load(){
   if(dead)return;
   if(!F||!root.ReserveAddonsPanel){$('features-status').textContent='';error('Features are unavailable. Reload the extension and try again.');draw();return;}
   const turn=++revision;loading=true;ready=false;error();$('features-retry').hidden=true;$('features-status').textContent='Loading features\u2026';draw();
   try{
     const data=await root.chrome.storage.local.get(F.KEY);
     if(dead||turn!==revision)return;
     prefs=F.normalize(data[F.KEY]);
     saved=prefs;
     ready=true;
     F.applyBiscuitRules?.(prefs);
     $('features-status').textContent='';
   }
   catch{if(!dead&&turn===revision){error('Could not load features. Try again.');$('features-status').textContent='';$('features-retry').hidden=false;}}
   finally{if(!dead&&turn===revision){loading=false;draw();}}
  }
  function save(value){
   const next=F.normalize(value),turn=++revision;prefs=next;pending++;error();$('features-status').textContent='Saving features\u2026';draw();
   writes=writes.then(async()=>{
    if(dead){pending--;return;}
    try{await saveFeatures(next);saved=next;if(!dead&&turn===revision){error();$('features-status').textContent='Saved.';}}
    catch{if(!dead){if(turn===revision)prefs=saved;error('Could not save features. Your saved choices are still active. Try again.');$('features-status').textContent='';}}
    finally{
     pending--;
     if(!dead&&!pending&&refreshAfterSave){
      refreshAfterSave=false;const reading=revision;
      try{
        const latest=await root.chrome.storage.local.get(F.KEY);
        if(!dead&&!pending&&reading===revision){prefs=F.normalize(latest[F.KEY]);saved=prefs;F.applyBiscuitRules?.(prefs);}
      }
      catch{if(!dead&&reading===revision){error('Could not confirm saved features. Try again.');$('features-retry').hidden=false;}}
     }
     draw();
    }
   });return writes;
  }
  function toggle(id,on){
   if(!ready||dead||!catalogue.some(f=>f.id===id))return;
   return save(toggleFeatures(prefs,id,on));
  }
  function changed(changes,area){
   if(dead||area!=='local'||!F)return;
   if(changes['reserve:packs']||changes['reserve:packs:receipts']||changes[F.KEY])void loadPacks();
   if(!changes[F.KEY])return;
   F.applyBiscuitRules?.(changes[F.KEY].newValue);
   if(pending){refreshAfterSave=true;return;}
   revision++;prefs=F.normalize(changes[F.KEY].newValue);saved=prefs;ready=true;loading=false;error();$('features-retry').hidden=true;$('features-status').textContent='';draw();
  }
  $('features-status').setAttribute('role','status');$('features-status').setAttribute('aria-live','polite');
  const retry=()=>load(),reload=()=>{if(ready&&!pending&&!dead)root.location.reload();};
  $('features-retry').addEventListener('click',retry);$('features-reload').addEventListener('click',reload);root.chrome?.storage?.onChanged?.addListener(changed);load();void loadPacks();
  return {sync:draw,destroy(){
    dead=true;
    revision++;
    companionTurn++;
    packTurn++;
    root.chrome?.storage?.onChanged?.removeListener(changed);
    $('features-retry')?.removeEventListener('click',retry);
    $('features-reload')?.removeEventListener('click',reload);
  }};
 }

 function createDock({container,store,getCustomPet,onOpen=()=>{},onChange=()=>{}}){
  const options={container,store,getCustomPet,onOpen,onChange};
  return enabled('customization')&&root.ReserveCustomizeUI?.retainClosedContent
   ?root.ReserveCustomizeUI.retainClosedContent(createDockController,options):createDockController(options);
 }

 function createDockController({container,store,getCustomPet,onOpen=()=>{},onChange=()=>{}}){
  if(root.ReserveSite?.vanillaPage(root.location))return null;
  let open=false,opener=null,destroyed=false,features=null;
  const panel=()=>container.querySelector('.rd-appearance.ch-settings-dock');
  const toolbarButton=()=>container.querySelector('.rd-toolbar [data-rd-action="settings"]');

  function sync(){
   container.dataset.settings=open?'open':'closed';
   container.getRootNode?.()?.host?.toggleAttribute?.('data-reserve-settings',open);
   toolbarButton()?.setAttribute('aria-expanded',String(open));
   const node=panel();
   if(!node)return;
   node.dataset.open=String(open);
   node.inert=!open;
   if(open)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden','true');
   if(open&&!node.querySelector('[data-pane="features"]')?.hidden&&node.querySelector('#features-panel')){
     if(!features)features=createFeatures(container,{store,getCustomPet,close:()=>close({restoreFocus:false})});else features.sync();
   }
   const inner=node.querySelector('.t-acc-panel');
   if(inner){
    inner.inert=!open;
    if(open)inner.removeAttribute('aria-hidden');else inner.setAttribute('aria-hidden','true');
   }
  }

  function show(source){
   if(destroyed)return;
   const candidate=source||container.querySelector(':focus')||toolbarButton();
   if(!open||(candidate&&!panel()?.contains(candidate)))opener=candidate;
   if(!open){
    // Handoff: the parent closes Tools before Settings becomes active.
    onOpen();
    open=true;
    onChange(true);
   }
   sync();
   panel()?.querySelector('[data-rd-action="settings-close"]')?.focus({preventScroll:true});
  }

  function close({restoreFocus=true}={}){
   if(destroyed||!open)return;
   open=false;
   onChange(false);
   sync();
   if(!restoreFocus)return;
   // A launcher inside the closed Tools dock or phone drawer may no longer be visible.
   const visible=opener?.checkVisibility?.({visibilityProperty:true})??
    (opener?root.getComputedStyle?.(opener)?.visibility!=='hidden':false);
   const valid=opener?.isConnected&&opener.getClientRects?.().length&&visible&&
    !opener.closest?.('[inert],.rd-utility-dialog');
   (valid?opener:toolbarButton())?.focus({preventScroll:true});
  }

  return {
   open:show,close,sync,
   toggle(source){if(open)close();else show(source);},
   handleKeydown(event){
    if(!open||event.defaultPrevented||event.key!=='Escape')return false;
    event.preventDefault();
    close();
    return true;
   },
   destroy(){
    if(destroyed)return;
    open=false;
    sync();
    features?.destroy();
    destroyed=true;
    opener=null;
   }
  };
 }

 // Keep feature recovery available even when Custom omits the dashboard scripts.
 function mountLauncher(dockRoot){
  const links=['app.css','dashboard.css','workspace.css','refresh.css','customize.css','widgets.css','addons-panel.css','settings-dock.css'].map(file=>{
    const link=root.document.createElement('link');
    link.rel='stylesheet';
    link.href=root.chrome.runtime.getURL(file);
    dockRoot.append(link);
    return link;
  });
  const container=root.document.createElement('div');container.className='rd ch-features-only';
  container.innerHTML=`<div class="rd-toolbar"><button type="button" class="reserve-dock-button" data-rd-action="settings" aria-expanded="false" aria-controls="rd-appearance-panel"><span class="ch-features-icon" aria-hidden="true">${root.ReserveAddonsArt?.presets.full||''}</span><span>Make it yours</span></button></div>${render({customizeOpen:false,featuresOnly:true})}`;dockRoot.append(container);
  const dock=createDock({container}),click=event=>{
    const button=event.target.closest('[data-rd-action]');
    if(button?.dataset.rdAction==='settings')dock?.toggle(button);else if(button?.dataset.rdAction==='settings-close')dock?.close();
  },keydown=event=>dock?.handleKeydown(event);
  container.addEventListener('click',click);root.document.addEventListener('keydown',keydown);dock?.sync();
  return {destroy(){
    dock?.destroy();
    container.removeEventListener('click',click);
    root.document.removeEventListener('keydown',keydown);
    container.remove();
    for(const link of links)link.remove();
  }};
 }
 const api={createDock,render,featuresPane,preferencesPane,createPreferences,mountLauncher,saveFeatures,toggleFeatures};
 root.ReserveSettingsDock=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
