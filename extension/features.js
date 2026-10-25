// Adapted from Gary Wu's pull request #47 to Canvas Harness.
/*! Canvas Harness 3.5 feature catalogue. Packaged files only; no account data. */
(function(root){
 'use strict';
 const KEY='reserve:features',HINT='reserve:features-hint';
 const feature=(id,name,group,js=[],css=[],needs=[])=>({id,name,label:name,group,files:{js,css},needs});
 const catalogue=[
  feature('dashboard','Dashboard & assignments','Study',['views.js','app.js','dashboard-model.js','work-model.js','dashboard-view.js','dashboard.js']),
  feature('deadline-changes','Deadline changes','Study',['deadline-model.js','deadline-changes.js'],[],['dashboard']),
  feature('planner','Planner & home widgets','Study',['planner-model.js','planner-ui.js','hand-in.js','widgets.js'],[],['dashboard']),
  feature('grades','Grades','Study',['grades-view.js'],[],['dashboard']),
  feature('materials','Materials library','Study',['materials-ui.js'],[],['dashboard']),
  feature('course-hub','Course hub & inbox','Study',['course-hub-model.js','course-hub-ui.js'],[],['dashboard','materials']),
  feature('course-files','My links & files','Study',['course-files.js','course-file-open.js','course-links-ui.js'],['course-links.css'],['course-hub','pdf']),
  feature('math','Math tools','Study',['math.js']),
  feature('gpa','GPA calculator','Study',['gpa-ui.js'],['gpa.css'],['tools']),
  feature('tools','Quick open & study tools','Study',['quick-open.js','toolbox-resize.js','toolbox.js','toolbox-session.js','native-tools.js']),
  feature('customization','Appearance editor','Personalize',['market-site.js','media-store.js','media-frame.js','frame-editor.js','custom-kits.js','pack-common.js','theme-pack.js','pet-pack.js','preset-pack.js','data-theme.js','packs.js','make-your-own.js','customize-ui.js','settings-dock.js'],['media-frame.css','frame-editor.css','settings-dock.css'],['dashboard']),
  feature('scene-themes','Scene themes','Personalize',['scene-themes.js'],['scene-themes.css'],['dashboard']),
  feature('arrange','Arrange the workspace','Personalize',['workspace-gestures.js'],[],['dashboard']),
  feature('course-art','Course artwork','Drawings',['subject-art-data.js','subject-art.js','generic-art.js','course-art.js'],['subject-art.css']),
  feature('quick-pack','Local artwork packs','Drawings',['quick-pack.js','quick-upload.js','quick-upload-ui.js'],[],['customization','course-art']),
  feature('pony','Pony companion','Drawings',['pet-art.js','agent-clock.js','biscuit-parse.js','pony-brain.js','pony-ask.js','pets.js'],['pet.css'],['planner']),
  feature('motion','Living drawings & motion','Drawings',['startup-art.js','motion.js'],['startup-art.css']),
  feature('canvas-nav','Drawn Canvas navigation','Canvas',['canvas-nav.js'],['canvas-nav.css']),
  feature('course-nav','Drawn course menu & modules','Canvas',['course-nav-art.js','course-nav.js','modules-page.js'],['course-nav.css','course-nav-art.css','modules-page.css']),
  feature('native-appearance','Native page appearance','Canvas',['native-appearance.js','native-page.js'],['native-page.css']),
  feature('pdf','PDF reader','Extras',['pdf-art.js','pdf-model.js','pdf-host.js'],['pdf-host.css']),
  feature('focus-room','Focus room','Extras',['focus-room.js'],[],['planner']),
  feature('review-deck','Review deck','Extras',['review-deck-model.js','review-deck.js'],[],['dashboard']),
  feature('grade-impact','Grade impact','Extras',['grade-impact.js'],[],['grades']),
  feature('play','Play & submission celebrations','Extras',['submit-celebrate.js']),
  feature('ai','AI context & handoff','Extras',['ai-context.js','ai-source.js'],[],['tools']),
 ];
 // Retained public modules keep their relative order; new helpers precede their consumers.
 const order=["site.js","core.js","api.js","personal-work.js","custom-art.js","workspace-arrange.js","workspace-gestures.js","media-reference.js","customization-model.js","backup-media.js","gpa-model.js","page-preferences.js","storage.js","quick-pack.js","quick-upload.js","quick-upload-ui.js","math.js","ui-utils.js","icons.js","subject-art-data.js","subject-art.js","generic-art.js","course-art.js","views.js","app.js","deadline-model.js","deadline-changes.js","session.js","dashboard-model.js","work-model.js","material-model.js","materials-ui.js","course-hub-model.js","course-files.js","course-file-open.js","course-links-ui.js","course-hub-ui.js","grade-impact.js","review-deck-model.js","review-deck.js","grades-view.js","market-site.js","media-store.js","media-frame.js","frame-editor.js","agent-clock.js","pony-ask.js","custom-kits.js","pack-common.js","theme-pack.js","pet-pack.js","preset-pack.js","data-theme.js","packs.js","make-your-own.js","customize-ui.js","dashboard-view.js","motion.js","quick-open.js","toolbox-resize.js","ai-context.js","ai-source.js","gpa-ui.js","toolbox.js","toolbox-session.js","native-appearance.js","native-page.js","native-tools.js","planner-model.js","pet-art.js","biscuit-parse.js","pony-brain.js","pets.js","planner-ui.js","hand-in.js","focus-room.js","widgets.js","settings-dock.js","scene-themes.js","dashboard.js","canvas-nav.js","course-nav-art.js","course-nav.js","modules-page.js","pdf-art.js","pdf-model.js","pdf-host.js","submit-celebrate.js","content.js"];
 const dashboardCSS=['app.css','dashboard.css','workspace.css','refresh.css','subject-art.css','customize.css','media-frame.css','frame-editor.css','settings-dock.css','gpa.css','selection.css','responsive-layout.css','widgets.css','pet.css','scene-themes.css','course-links.css'];
 const startupCSS=['startup.css','startup-art.css','canvas-nav.css','course-nav.css'];
 const nativeCSS=['app.css','dashboard.css','workspace.css','refresh.css','gpa.css'];
 // customize.css and widgets.css are core: besides the editor and the widgets they hold the dashboard's setting-driven layout (hidden columns, card styles,
 // arrange grips), which every preset needs. Only the editor's scripts belong to the Appearance editor.
 const core={js:['features.js','site.js','core.js','api.js','personal-work.js','custom-art.js','workspace-arrange.js','media-reference.js','customization-model.js','backup-media.js','gpa-model.js','page-preferences.js','storage.js','ui-utils.js','icons.js','session.js','material-model.js','content.js','startup.js','feature-loader.js'],css:['startup.css','app.css','dashboard.css','workspace.css','refresh.css','customize.css','selection.css','responsive-layout.css','widgets.css']};
 // Prepaint drawings must not wait for the worker. Other mandatory files stay
 // interleaved with optional files in the original main declaration's order.
 const staticJS=['startup-art.js','site.js','core.js','api.js','personal-work.js','custom-art.js','workspace-arrange.js','canvas-nav.js','course-nav-art.js','course-nav.js'];
 core.assets=['background.js','popup.html','icon.svg','account-writes.js','market.js','market-bridge.js','market-worker.js','market-holds.js','market-media.js'];
 catalogue.find(f=>f.id==='pdf').files.assets=['pdf-reader.html','pdf-reader.js','pdf-reader.css','pdf-art.css','vendor/pdfjs/pdf.mjs','vendor/pdfjs/pdf.worker.mjs'];
 catalogue.find(f=>f.id==='ai').files.assets=['ai-panel.html','ai-panel.js','ai-panel.css'];
 catalogue.find(f=>f.id==='play').files.assets=['submit-scenes.js','play-art.js','play-space.js','play-physics.js','play-tools.js','play-tools.css'];
 catalogue.find(f=>f.id==='scene-themes').files.assets=["themes/blueprint/blueprint-card.png","themes/blueprint/blueprint-panel.png","themes/blueprint/icon-bulb.png","themes/blueprint/icon-divider.png","themes/blueprint/icon-gear.png","themes/blueprint/icon-orbit.png","themes/blueprint/icon-pendulum.png","themes/blueprint/icon-rocket.png","themes/blueprint/poster.jpg","themes/blueprint/sky.mp4","themes/blueprint/theme.css","themes/sea/icon-coral.png","themes/sea/icon-fish.png","themes/sea/icon-jelly.png","themes/sea/icon-ray.png","themes/sea/icon-shell.png","themes/sea/icon-turtle.png","themes/sea/poster.jpg","themes/sea/sea-card.png","themes/sea/sea-panel.png","themes/sea/sky.mp4","themes/sea/theme.css","themes/starry/button.png","themes/starry/divider.png","themes/starry/frame-card.png","themes/starry/frame-panel.png","themes/starry/ground.png","themes/starry/icon-cottage.png","themes/starry/icon-cypress.png","themes/starry/icon-moon.png","themes/starry/icon-star.png","themes/starry/icon-sunflower.png","themes/starry/icon-swirl.png","themes/starry/pill-on.png","themes/starry/pill.png","themes/starry/poster.jpg","themes/starry/sheet.png","themes/starry/sky.mp4","themes/starry/theme.css","themes/stars/icon-binary.png","themes/stars/icon-cluster.png","themes/stars/icon-galaxy.png","themes/stars/icon-giant.png","themes/stars/icon-nebula.png","themes/stars/icon-redgiant.png","themes/stars/poster.jpg","themes/stars/sky.html","themes/stars/sky.js","themes/stars/stars-card.png","themes/stars/stars-panel.png","themes/stars/theme.css"];
 const ids=catalogue.map(f=>f.id),known=new Set(ids);
 const optIn=new Set(['focus-room','review-deck','grade-impact']);
 const presets={full:ids.filter(id=>!optIn.has(id)),lite:['dashboard','planner','grades','math','arrange','tools','gpa','native-appearance']};
 for(const entry of catalogue)entry.presets=[...(presets.full.includes(entry.id)?['full']:[]),...(presets.lite.includes(entry.id)?['lite']:[])];
 const unique=values=>[...new Set(Array.isArray(values)?values.filter(id=>known.has(id)):[])];
 function normalize(prefs){
  if(typeof prefs==='string')prefs={preset:prefs.toLowerCase()};
  prefs=prefs&&typeof prefs==='object'?prefs:{};
  const preset=['full','lite','custom'].includes(String(prefs.preset).toLowerCase())?String(prefs.preset).toLowerCase():'full';
  return {preset,custom:unique(prefs.custom??prefs.enabled??presets.full)};
 }
 function resolve(prefs){
  const clean=normalize(prefs),selected=new Set(),visit=id=>{
   if(selected.has(id)||!known.has(id))return;
   selected.add(id);for(const dep of catalogue.find(f=>f.id===id).needs)visit(dep);
  };
  for(const id of clean.preset==='custom'?clean.custom:presets[clean.preset])visit(id);
  const enabled=ids.filter(id=>selected.has(id));
  const files={js:new Set(core.js),css:new Set(core.css)};
  for(const f of catalogue)if(selected.has(f.id))for(const type of ['js','css'])for(const file of f.files[type])files[type].add(file);
  if(selected.has('customization'))for(const file of ['planner-model.js','pet-art.js','agent-clock.js','pony-ask.js'])files.js.add(file);
  const cssOrder=[...new Set([...startupCSS,...dashboardCSS,...catalogue.flatMap(f=>f.files.css)])];
  return {preset:clean.preset,enabled,js:order.filter(f=>files.js.has(f)),css:cssOrder.filter(f=>files.css.has(f)),startupJS:selected.has('motion')?['startup-art.js']:[]};
 }
 function readHint(){
  try{
   const value=JSON.parse(root.localStorage.getItem(HINT));
   if(value&&(typeof value==='object'||typeof value==='string'))return value;
  }catch{} // Unavailable, absent or malformed hints use extension storage instead.
 }
 const hint=readHint();let current=resolve(hint),earlySelection,revision=0;
 const earlyEffects=[];
 function clearNavHint(){if(!current.enabled.includes('canvas-nav'))try{root.localStorage?.removeItem('reserve:navEarly');}catch{}}
 clearNavHint();
 function apply(prefs){
  const motionWasEnabled=current.enabled.includes('motion');
  revision++;current=resolve(prefs);clearNavHint();
  const motionChanged=motionWasEnabled!==current.enabled.includes('motion');
  // The stored hint can differ from the worker's document-specific selection.
  // Revisit all prepaint effects in registration order (art before course menu).
  for(const effect of earlyEffects)effect(current,motionChanged);
  return current;
 }
 function enabled(id){return current.enabled.includes(id);}
 function early(id,start,stop){
  let started=false;
  const reconcile=(selection,motionChanged=false)=>{
   if(selection.enabled.includes(id)){
    if(!started){started=true;start();}
    // Navigation computes its motion flag from the current feature selection
    // at startup; refresh through the original lifecycle when Motion changes.
    else if(motionChanged&&(id==='canvas-nav'||id==='course-nav')){stop?.();start();}
   }
   else if(started){started=false;stop?.();}
  };
  earlyEffects.push(reconcile);
  if(earlyEffects.length===1)watchLoad();
  if(!root.document||!root.chrome?.storage?.local){reconcile(current);return;}
  // The synchronous hint only guesses the first frame. Every document confirms
  // it, even if no Canvas tab was open when extension preferences last changed.
  if(hint!==undefined)reconcile(current);
  // One read and ordered callbacks: course-nav-art must exist before course-nav.
  if(!earlySelection){
   const reading=revision;
   let previousHint;try{previousHint=root.localStorage.getItem(HINT);}catch{}
   earlySelection=Promise.resolve().then(()=>root.chrome.storage.local.get(KEY)).then(saved=>{
    const selection=revision===reading?apply(saved?.[KEY]):current;
    // An onChanged listener may already have mirrored a newer preference.
    try{if(root.localStorage.getItem(HINT)===previousHint)root.localStorage.setItem(HINT,JSON.stringify({preset:selection.preset,enabled:selection.enabled}));}catch{}
    return selection;
   },()=>current);
  }
  return earlySelection.then(reconcile);
 }
 // The worker can retain a page's selection across service-worker restarts,
 // so its reply is authoritative even after chrome.storage's early read.
 let confirmedLoad;
 function watchLoad(){
  if(root.ReserveSite?.vanillaPage?.(root.location))return;
  root.document?.addEventListener?.('reserve:features-ready',()=>{
  const load=root.ReserveFeatureLoad;
  if(!load||load===confirmedLoad)return;
  confirmedLoad=load;
  Promise.resolve(load).then(reply=>{
   if(reply?.ok&&typeof reply.preset==='string'&&Array.isArray(reply.enabled))apply({preset:reply.preset,enabled:reply.enabled});
  }).catch(()=>{});
  });
 }
 const owner=new Map(catalogue.flatMap(f=>[...f.files.js,...f.files.css].map(file=>[file,f.id])));
 function filterFiles(files){return files.filter(file=>!owner.has(file)||enabled(owner.get(file)));}
 function workspace(name){
  const need={home:'dashboard',work:'dashboard',assignments:'dashboard',plan:'planner',grades:'grades',materials:'materials',hub:'course-hub',inbox:'course-hub',calendar:'course-hub'}[name];
  if(need&&enabled(need))return name;
  return enabled('dashboard')?'work':null;
 }
 // All feature writers use the worker queue, including the popup and Biscuit.
 // Market uses run only around its final read/delta/publication, never a fetch.
 let featureWrites=Promise.resolve(),serving=false;
 function run(fn){const result=featureWrites.catch(()=>{}).then(fn);featureWrites=result.catch(()=>{});return result;}
 const conflict=()=>Object.assign(Error('Features have changed since then. Your newer choices are kept.'),{code:'feature-conflict'});
 function command(before,request,keepPony){
  if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(k=>!['id','on','preset'].includes(k)))throw Error('Invalid feature choice.');
  if(request.id?!known.has(request.id)||typeof request.on!=='boolean'||request.preset!==undefined:!['full','lite'].includes(request.preset)||request.on!==undefined)throw Error('Invalid feature choice.');
  let next;
  if(request.id){
   if(keepPony&&request.id==='pony'&&!request.on)throw Error('The Pony switch is in the extension popup → Pony.');
   const selected=new Set(before.preset==='custom'?before.custom:resolve(before).enabled);
   if(request.on)selected.add(request.id);else{const removed=new Set([request.id]);let size;do{size=removed.size;for(const row of catalogue)if(row.needs.some(id=>removed.has(id)))removed.add(row.id);}while(size!==removed.size);for(const id of removed)selected.delete(id);}
   next=normalize({preset:'custom',custom:[...selected]});
  }else next=normalize({...before,preset:request.preset});
  if(keepPony&&request.id&&!resolve(next).enabled.includes('pony'))throw Error('That also turns Biscuit off. Use Make it yours Features for that switch.');
  return next;
 }
 async function mutate(message){return run(async()=>{
  const local=root.chrome.storage.local,before=normalize((await local.get(KEY))[KEY]);
  if(Object.hasOwn(message,'expected')&&JSON.stringify(before)!==JSON.stringify(normalize(message.expected)))throw conflict();
  const value=message.op==='change'?command(before,message.request,message.keepPony===true):normalize(message.value);
  await local.set({[KEY]:value});return {before,value};
 });}
 async function sendWrite(message){
  if(typeof root.importScripts==='function'||!root.chrome?.runtime?.id||!root.chrome.runtime.sendMessage)return mutate(message);
  const reply=await root.chrome.runtime.sendMessage({type:'ch-feature-write',...message});
  if(!reply?.ok)throw Object.assign(Error(reply?.error||'Features could not be saved. Reload Canvas Harness.'),{code:reply?.code});return reply;
 }
 async function write(value,options={}){return (await sendWrite({op:'set',value,...(Object.hasOwn(options,'expected')?{expected:options.expected}:{})})).value;}
 const change=(request,{keepPony=false}={})=>sendWrite({op:'change',request,keepPony});
 function serveWrites({ready=()=>Promise.resolve()}={}){
  if(serving||!root.chrome?.runtime?.onMessage?.addListener)return;serving=true;
  root.chrome.runtime.onMessage.addListener((message,sender,reply)=>{
   if(message?.type!=='ch-feature-write')return;
   (async()=>{
    await ready();const runtime=root.chrome.runtime;
    let trusted=sender?.id===runtime.id&&!sender.tab&&sender.url===runtime.getURL('popup.html');
    if(!trusted&&sender?.id===runtime.id&&sender.frameId===0&&Number.isInteger(sender.tab?.id)&&typeof sender.url==='string'){
     try{const url=new URL(sender.url);trusted=url.protocol==='https:'&&!url.username&&!url.password&&root.ReserveSite?.supported(url.origin)===true;}catch{}
    }
    if(!trusted)throw Error('Invalid feature writer.');
    if(!['set','change'].includes(message.op)||Object.keys(message).some(k=>!['type','op','value','expected','request','keepPony'].includes(k))||message.op==='set'&&(!message.value||typeof message.value!=='object'||Array.isArray(message.value)))throw Error('Invalid feature choice.');
    return {ok:true,...await mutate(message)};
   })().then(reply,error=>reply({ok:false,error:String(error?.message||'Features could not be saved.'),...(error?.code?{code:error.code}:{})}));return true;
  });
 }
 const api={KEY,HINT,catalogue,presets,core,order,staticJS,dashboardCSS,startupCSS,nativeCSS,normalize,resolve,apply,enabled,early,filterFiles,workspace,run,write,change,serveWrites,get earlyReady(){return earlySelection;},get current(){return current;}};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ReserveFeatures=api;
})(globalThis);
