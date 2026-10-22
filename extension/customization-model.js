/* Canvas Harness — workspace preferences. Original creator: Flzsh. */
(function(root){
 'use strict';
 const arrange=root.ReserveWorkspaceArrange||(typeof module==='object'&&module.exports?require('./workspace-arrange.js'):null);
 const enums={sceneTheme:['','starry','sea','stars','blueprint'],dockSize:['small','medium','large'],pageTint:['paper','accent','sky','sage','lilac','blush','sand','snow'],courseNavigation:['sidebar','topbar','dock'],deskOrder:['context-first','work-first','stacked'],surfaceStyle:['paper','clean','contrast'],courseCardStyle:['sketch','rounded','minimal'],bannerSize:['compact','standard','large'],panelFrame:['pen','stitch','card','line','none']};
 const defaults={sceneTheme:'',dockSize:'medium',nightArt:0,pageTint:'paper',courseNavigation:'sidebar',deskOrder:'context-first',surfaceStyle:'paper',courseCardStyle:'sketch',bannerSize:'standard',showCourseIcons:true,showDeadlinePreview:true,showBookmarks:true,showCourseInformation:true,showCourseStrip:true,showRecentGrades:false,density:'comfortable',panelFrame:'pen',moduleSize:{},workspaceOrder:['context','work','reader'],workspaceMode:'side-by-side',workspaceLayout:null,workspaceUndo:null};
 const artKeys=['bannerArt','cardArt','backgroundArt','borderArt','iconArt','titleArt'];
 const presets={studio:{...defaults},study:{...defaults,deskOrder:'work-first',workspaceOrder:['work','reader','context'],surfaceStyle:'clean',courseCardStyle:'rounded',bannerSize:'compact'},focus:{...defaults,courseNavigation:'topbar',deskOrder:'work-first',workspaceOrder:['work','reader','context'],bannerSize:'compact',showCourseInformation:false,showDeadlinePreview:false}};
 function cleanAppearance(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid course appearance.');
  const out={bannerFit:'contain',bannerPosition:'right'};
  for(const [key,allowed] of Object.entries({bannerFit:['cover','contain'],bannerPosition:['left','center','right'],titlePlacement:['separate','banner']})){
   if(value[key]!==undefined&&!allowed.includes(value[key]))throw Error(`Invalid ${key} setting in backup.`);
   if(value[key])out[key]=value[key];
  }
  for(const key of artKeys)if(value[key]!=null){
   const art=root.ReserveCustomArt||(typeof module==='object'&&module.exports?require('./custom-art.js'):null);
   if(!art)throw Error('Artwork support is unavailable. Reload Canvas Harness and try again.');
   const media=root.ReserveMediaReference||(typeof module==='object'&&module.exports?require('./media-reference.js'):null),slot=key.replace('Art',''),clean=asset=>{
    if(asset&&typeof asset==='object'&&Object.hasOwn(asset,'mediaId')){if(!media?.cleanReference)throw Error('Local artwork support is unavailable. Reload Canvas Harness and try again.');return media.cleanReference(asset,slot);}return art.cleanAsset(asset);
   };
   if(value[key]&&typeof value[key]==='object'&&Object.hasOwn(value[key],'asset')){if(!['banner','card','background'].includes(slot)||!media?.cleanFrame)throw Error('Invalid framed artwork slot.');out[key]=media.cleanFrame(value[key],clean);}else out[key]=clean(value[key]);
  }
  return out;
 }
 function cleanSettings(settings){
  const out={...defaults};
  for(const [key,allowed] of Object.entries(enums)){
   if(settings[key]!==undefined&&!allowed.includes(settings[key]))throw Error(`Invalid ${key} setting in backup.`);
   if(settings[key]!==undefined)out[key]=settings[key];
  }
  for(const key of Object.keys(defaults).filter(key=>typeof defaults[key]==='boolean')){
   if(settings[key]!==undefined&&typeof settings[key]!=='boolean')throw Error(`Invalid ${key} setting in backup.`);
   if(settings[key]!==undefined)out[key]=settings[key];
  }
  if(settings.nightArt!==undefined){const n=Number(settings.nightArt);if(!Number.isFinite(n)||n<0||n>100)throw Error('Invalid nightArt setting in backup.');out.nightArt=Math.round(n);}
  if(!arrange)throw Error('Workspace arrangement is unavailable. Reload Canvas Harness and try again.');
  Object.assign(out,arrange.cleanSaved(settings));
  out.overviewArt=cleanAppearance(settings.overviewArt);out.themeArt=cleanAppearance(settings.themeArt);
  return out;
 }
 function checkBudget(settings){
  const total=[settings.themeArt,settings.overviewArt,...Object.values(settings.coursePrefs||{})].reduce((sum,pref)=>sum+artKeys.reduce((n,key)=>n+new TextEncoder().encode((pref?.[key]?.asset||pref?.[key])?.svg||'').length,0),0);
  if(total>(root.ReserveCustomArt?.limits.totalBytes||2097152))throw Error('Course artwork is full. Remove an unused upload to stay below 2 MiB.');
 }
 const api={enums,defaults,artKeys,presets,cleanAppearance,cleanSettings,checkBudget};root.ReserveCustomization=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
