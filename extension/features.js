/*! Canvas Harness 3.2 feature catalogue. Packaged files only; no account data. */
(function(root){
 'use strict';
 const KEY='reserve:features',HINT='reserve:features-hint';
 const feature=(id,name,group,js=[],css=[],needs=[])=>({id,name,label:name,group,files:{js,css},needs});
 const catalogue=[
  feature('dashboard','Dashboard & assignments','Study',['views.js','app.js','dashboard-model.js','work-model.js','dashboard-view.js','dashboard.js']),
  feature('planner','Planner & home widgets','Study',['planner-model.js','planner-ui.js','widgets.js'],[],['dashboard']),
  feature('grades','Grades','Study',['grades-view.js'],[],['dashboard']),
  feature('materials','Materials library','Study',['materials-ui.js'],[],['dashboard']),
  feature('course-hub','Course hub & inbox','Study',['course-hub-model.js','course-hub-ui.js'],[],['dashboard','materials']),
  feature('math','Math tools','Study',['math.js']),
  feature('gpa','GPA calculator','Study',['gpa-ui.js'],['gpa.css'],['tools']),
  feature('tools','Quick open & study tools','Study',['quick-open.js','toolbox-resize.js','toolbox.js','toolbox-session.js','native-tools.js']),
  feature('customization','Appearance editor','Personalize',['customize-ui.js','settings-dock.js'],['settings-dock.css'],['dashboard']),
  feature('arrange','Arrange the workspace','Personalize',['workspace-gestures.js'],[],['dashboard']),
  feature('course-art','Course artwork','Drawings',['subject-art-data.js','subject-art.js','generic-art.js','course-art.js'],['subject-art.css']),
  feature('quick-pack','Local artwork packs','Drawings',['quick-pack.js','quick-upload.js','quick-upload-ui.js'],[],['customization','course-art']),
  feature('pony','Pony companion','Drawings',['pet-art.js','pets.js'],['pet.css'],['planner']),
  feature('motion','Living drawings & motion','Drawings',['startup-art.js','motion.js'],['startup-art.css']),
  feature('canvas-nav','Drawn Canvas navigation','Canvas',['canvas-nav.js'],['canvas-nav.css']),
  feature('course-nav','Drawn course menu & modules','Canvas',['course-nav-art.js','course-nav.js','modules-page.js'],['course-nav.css','course-nav-art.css','modules-page.css']),
  feature('native-appearance','Native page appearance','Canvas',['native-appearance.js','native-page.js'],['native-page.css']),
  feature('pdf','PDF reader','Extras',['pdf-art.js','pdf-model.js','pdf-host.js'],['pdf-host.css']),
  feature('ai','AI context & handoff','Extras',['ai-context.js','ai-source.js'],[],['tools']),
 ];
 // Permitted 3.1 main declaration, retained as the single ordering authority.
 const order=["site.js","core.js","api.js","personal-work.js","custom-art.js","workspace-arrange.js","workspace-gestures.js","customization-model.js","gpa-model.js","page-preferences.js","storage.js","quick-pack.js","quick-upload.js","quick-upload-ui.js","math.js","ui-utils.js","icons.js","subject-art-data.js","subject-art.js","generic-art.js","course-art.js","views.js","app.js","session.js","dashboard-model.js","work-model.js","material-model.js","materials-ui.js","course-hub-model.js","course-hub-ui.js","grades-view.js","customize-ui.js","dashboard-view.js","motion.js","quick-open.js","toolbox-resize.js","ai-context.js","ai-source.js","gpa-ui.js","toolbox.js","toolbox-session.js","native-appearance.js","native-page.js","native-tools.js","planner-model.js","pet-art.js","pets.js","planner-ui.js","widgets.js","settings-dock.js","dashboard.js","canvas-nav.js","course-nav-art.js","course-nav.js","modules-page.js","pdf-art.js","pdf-model.js","pdf-host.js","content.js"];
 const dashboardCSS=['app.css','dashboard.css','workspace.css','refresh.css','subject-art.css','customize.css','settings-dock.css','gpa.css','selection.css','responsive-layout.css','widgets.css','pet.css'];
 const startupCSS=['startup.css','startup-art.css','canvas-nav.css','course-nav.css'];
 const nativeCSS=['app.css','dashboard.css','workspace.css','refresh.css','gpa.css'];
 // customize.css and widgets.css are core: besides the editor and the widgets they hold the dashboard's setting-driven layout (hidden columns, card styles,
 // arrange grips), which every preset needs. Only the editor's scripts belong to the Appearance editor.
 const core={js:['features.js','site.js','core.js','api.js','personal-work.js','custom-art.js','workspace-arrange.js','customization-model.js','gpa-model.js','page-preferences.js','storage.js','ui-utils.js','icons.js','session.js','material-model.js','content.js','startup.js','feature-loader.js'],css:['startup.css','app.css','dashboard.css','workspace.css','refresh.css','customize.css','selection.css','responsive-layout.css','widgets.css']};
 // Prepaint drawings must not wait for the worker. Other mandatory files stay
 // interleaved with optional files in the original main declaration's order.
 const staticJS=['startup-art.js','site.js','core.js','api.js','personal-work.js','custom-art.js','workspace-arrange.js','canvas-nav.js','course-nav-art.js','course-nav.js'];
 const ids=catalogue.map(f=>f.id),known=new Set(ids);
 const presets={full:ids.slice(),lite:['dashboard','planner','grades','math','arrange','tools','gpa','native-appearance']};
 for(const entry of catalogue)entry.presets=['full',...(presets.lite.includes(entry.id)?['lite']:[])];
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
 function apply(prefs){
  const motionWasEnabled=current.enabled.includes('motion');
  revision++;current=resolve(prefs);
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
 const api={KEY,HINT,catalogue,presets,core,order,staticJS,dashboardCSS,startupCSS,nativeCSS,normalize,resolve,apply,enabled,early,filterFiles,workspace,get earlyReady(){return earlySelection;},get current(){return current;}};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ReserveFeatures=api;
})(globalThis);
