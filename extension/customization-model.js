/* Canvas Harness — workspace preferences. Original creator: Flzsh. */
(function(root){
 'use strict';
 const enums={courseNavigation:['sidebar','topbar'],deskOrder:['context-first','work-first','stacked'],surfaceStyle:['paper','clean','contrast'],courseCardStyle:['sketch','rounded','minimal'],bannerSize:['compact','standard','large']};
 const defaults={courseNavigation:'sidebar',deskOrder:'context-first',surfaceStyle:'paper',courseCardStyle:'sketch',bannerSize:'standard',showCourseIcons:true,showDeadlinePreview:true,showBookmarks:true,showCourseInformation:true,showCourseStrip:true,showRecentGrades:false,density:'comfortable'};
 const artKeys=['bannerArt','borderArt','iconArt'];
 const presets={studio:{...defaults},study:{...defaults,deskOrder:'work-first',surfaceStyle:'clean',courseCardStyle:'rounded',bannerSize:'compact'},focus:{...defaults,courseNavigation:'topbar',deskOrder:'stacked',bannerSize:'compact',showCourseInformation:false,showDeadlinePreview:false}};
 function cleanAppearance(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid course appearance.');
  const out={bannerFit:'contain',bannerPosition:'right'};
  for(const [key,allowed] of Object.entries({bannerFit:['cover','contain'],bannerPosition:['left','center','right']})){
   if(value[key]!==undefined&&!allowed.includes(value[key]))throw Error(`Invalid ${key} setting in backup.`);
   if(value[key])out[key]=value[key];
  }
  for(const key of artKeys)if(value[key]!=null){
   const art=root.ReserveCustomArt||(typeof module==='object'&&module.exports?require('./custom-art.js'):null);
   if(!art)throw Error('Artwork support is unavailable. Reload Canvas Harness and try again.');
   out[key]=art.cleanAsset(value[key]);
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
  out.overviewArt=cleanAppearance(settings.overviewArt);
  return out;
 }
 function checkBudget(settings){
  const total=[settings.overviewArt,...Object.values(settings.coursePrefs||{})].reduce((sum,pref)=>sum+artKeys.reduce((n,key)=>n+new TextEncoder().encode(pref?.[key]?.svg||'').length,0),0);
  if(total>(root.ReserveCustomArt?.limits.totalBytes||2097152))throw Error('Course artwork is full. Remove an unused upload to stay below 2 MiB.');
 }
 const api={enums,defaults,artKeys,presets,cleanAppearance,cleanSettings,checkBudget};root.ReserveCustomization=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
