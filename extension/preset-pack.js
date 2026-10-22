/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Version 1 data-only presets. apply returns a new account document; the installer owns exact undo receipts. */
(function(root){
 'use strict';
 const C=root.ReservePackCommon||(typeof module==='object'&&module.exports?require('./pack-common.js'):null),days=['mon','tue','wed','thu','fri','sat','sun'],kinds=['layout','planner','routines','settings'];
 const model=(global,file)=>{const value=C.dependency(global,file);if(!value)throw Error('Load '+file+'.js to use this preset kind');return value;},arrange=()=>model('ReserveWorkspaceArrange','workspace-arrange'),customize=()=>model('ReserveCustomization','customization-model'),planner=()=>model('ReservePlanner','planner-model'),ask=()=>model('ReservePonyAsk','pony-ask');
 const appearanceEnums={theme:['light','dark','system'],accent:['clay','forest','indigo','rose','ocean','amber'],motion:['gentle','still','off'],livingArt:['on','off'],readingFont:['book','interface'],greeting:['on','off'],quickOpen:['on','off'],density:['comfortable','compact'],font:['system','humanist','serif'],textSize:['standard','large']};
 function settings(value,c){
  const m=customize(),enums={...appearanceEnums,...m.enums},booleans=[...new Set([...Object.keys(m.defaults).filter(key=>typeof m.defaults[key]==='boolean'),'showGrades'])],input=c.record(value,[...Object.keys(enums),...booleans,'nightArt','pet'],'$.data'),out={};
  for(const [key,v]of Object.entries(input)){
   if(key==='pet'){
    const pet=c.record(v,['coat','harness'],'$.data.pet');out.pet={};const art=c.attempt('$.data.pet',()=>model('ReservePetArt','pet-art'));if(art){if(C.own(pet,'coat'))out.pet.coat=c.choice(pet.coat,Object.keys(art.COATS),'$.data.pet.coat');if(C.own(pet,'harness'))out.pet.harness=c.choice(pet.harness,Object.keys(art.HARNESS),'$.data.pet.harness');}if(!Object.keys(pet).length)c.add('$.data.pet','provide a coat or harness');
   }else if(key==='nightArt')out[key]=Math.round(c.number(v,'$.data.'+key,0,100));
   else if(booleans.includes(key)){if(typeof v!=='boolean')c.add('$.data.'+key,'expected a boolean');out[key]=v;}
   else if(key==='accent'&&typeof v==='string'&&/^#[a-f0-9]{6}$/i.test(v))out[key]=v.toLowerCase();
   else out[key]=c.choice(v,enums[key],'$.data.'+key);
  }
  return out;
 }
 function layout(value,c){
  const m=arrange(),input=c.record(value,['workspaceLayout','moduleSize'],'$.data',['workspaceLayout']);let count=0;
  function node(value,field,depth=0){
   if(++count>40||depth>5){c.add(field,'workspace layout exceeds the model depth or node limit');return 'work';}
   if(typeof value==='string'){if(!m.isKey(value))c.add(field,'unknown workspace module '+value);return value;}
   const input=c.record(value,['axis','children'],field,['axis','children']),axis=c.choice(input.axis,['x','y'],field+'.axis'),children=c.array(input.children,field+'.children',2,m.ALL.length+3).map((v,i)=>node(v,field+'.children['+i+']',depth+1));return {axis,children};
  }
  const out={workspaceLayout:node(input.workspaceLayout,'$.data.workspaceLayout')};c.attempt('$.data.workspaceLayout',()=>m.cleanLayout(out.workspaceLayout));
  if(C.own(input,'moduleSize')){
   const raw=input.moduleSize;if(!raw||typeof raw!=='object'||Array.isArray(raw)){c.add('$.data.moduleSize','expected a module size map');out.moduleSize={};}
   else{const sizes=c.record(raw,Object.keys(raw),'$.data.moduleSize');out.moduleSize={};for(const [key,size]of Object.entries(sizes)){if(!m.isKey(key))c.add('$.data.moduleSize.'+key,'unknown workspace module');out.moduleSize[key]=c.choice(size,Object.keys(m.SIZES),'$.data.moduleSize.'+key);}c.attempt('$.data.moduleSize',()=>m.cleanSizes(out.moduleSize));}
  }return out;
 }
 function weekTemplate(value,c){
  c.attempt('$.data',planner);const input=c.record(value,['days'],'$.data',['days']),inputDays=c.record(input.days,days,'$.data.days'),out={days:{}};let count=0;
  for(const key of Object.keys(inputDays))out.days[key]=c.array(inputDays[key],'$.data.days.'+key,0,8).map((value,i)=>{
   count++;const field='$.data.days.'+key+'['+i+']',block=c.record(value,['title','minutes','at'],field,['title','minutes']),title=c.text(block.title,field+'.title',200),minutes=c.number(block.minutes,field+'.minutes',10,240,true),out={title,minutes};
   if(C.own(block,'at')){if(typeof block.at!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(block.at))c.add(field+'.at','expected a 24-hour time HH:MM');out.at=block.at;}return out;
  });return out;
 }
 function routine(line,field,c,snapshot={now:1,timeZone:'UTC'}){const source=c.text(line,field,240),m=c.attempt(field,ask);if(!source||!m)return null;const result=c.attempt(field,()=>m.parse(source,snapshot));if(result?.action!=='routine'){c.add(field,'Biscuit does not understand this recurring routine');return null;}return result.data;}
 function routines(value,c){const input=c.record(value,['lines'],'$.data',['lines']),lines=c.array(input.lines,'$.data.lines',0,20).map((v,i)=>{routine(v,'$.data.lines['+i+']',c);return typeof v==='string'?v.trim():'';});return {lines};}
 function clean(source,c){
  const {input,pack}=C.header(source,'chpreset',['kind','data'],['kind','data'],c);pack.kind=c.choice(input.kind,kinds,'$.kind');const readers={layout,planner:weekTemplate,routines,settings};pack.data=typeof pack.kind==='string'&&C.own(readers,pack.kind)?c.attempt('$.data',()=>readers[pack.kind](input.data,c)):{};return pack;
 }
 async function validate(source,deps={}){const c=C.context(),pack=clean(source,c);c.record(deps,['media'],'deps');c.finish();return {pack,media:[]};}
 function checked(pack){const c=C.context(),out=clean(pack,c);c.finish();return out;}
 function validWeek(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw Error('Choose the target week as a valid YYYY-MM-DD date');return planner().mondayOf(value);}
 function apply(data,source,{week,modules,now=Date.now,timeZone}={}){
  const pack=checked(source);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Provide the account data document');const out=structuredClone(data);out.settings=out.settings||{};
  const ids=new Set([...(out.customTasks||[]).map(v=>v.id),...Object.keys(out.tasks||{}),...(out.pet?.routines||[]).map(v=>v.id)]),fresh=base=>{let id=base,n=1;while(ids.has(id))id=base+'-'+n++;ids.add(id);return id;};
  if(pack.kind==='layout'){
   const m=arrange(),available=modules===undefined?null:new Set(modules),keep=key=>m.PANELS.includes(key)||!available||available.has(key);let tree=pack.data.workspaceLayout;
   for(const key of m.leaves(tree))if(!keep(key))tree=m.prune(tree,key);out.settings.workspaceLayout=m.cleanLayout(tree);out.settings.workspaceOrder=m.leaves(tree).filter(key=>m.PANELS.includes(key));out.settings.workspaceMode=tree.axis==='y'&&tree.children.every(n=>typeof n==='string')?'stacked':'side-by-side';out.settings.moduleSize={...(out.settings.moduleSize||{})};for(const [key,size]of Object.entries(pack.data.moduleSize||{}))if(keep(key))out.settings.moduleSize[key]=size;
   out.settings.deskOrder=out.settings.workspaceMode==='stacked'?'stacked':out.settings.workspaceOrder[0]==='work'?'work-first':'context-first';out.settings.dashboardLayout=out.settings.workspaceMode==='stacked'?'list':'split';
  }else if(pack.kind==='planner'){
   const m=planner(),start=validWeek(week);out.customTasks=out.customTasks||[];out.tasks=out.tasks||{};
   for(let i=0;i<days.length;i++)for(const [index,block]of (pack.data.days[days[i]]||[]).entries()){
    const day=m.addDays(start,i),id=fresh('local-preset-'+day+'-'+index);m.addTask({name:block.title,day,estimate:block.minutes,...(block.at?{at:block.at}:{})},{id,nowISO:start+'T00:00:00.000Z'})(out);if(block.at)out.tasks[id].notes='At '+block.at;
   }
  }else if(pack.kind==='routines'){
   const c=C.context(),m=ask(),stamp=typeof now==='function'?now():now,zone=timeZone||out.settings.timeZone||root.ReserveSite?.timeZone()||'UTC';if(!Number.isFinite(stamp)||stamp<=0||stamp>8640000000000000)throw Error('Provide a valid current timestamp for new routines');const existing=out.pet?.routines||[],incoming=pack.data.lines.map((line,i)=>({...routine(line,'$.data.lines['+i+']',c,{now:stamp,timeZone:zone}),id:fresh('preset-routine-'+i),createdAt:stamp,last:''}));c.finish();const all=existing.concat(incoming),accepted=m.cleanRoutines(all);
   if(accepted.length!==all.length)throw Error('Biscuit can store '+accepted.length+' routines in this account; remove routines or apply a smaller preset');out.pet={...(out.pet||{}),routines:all};
  }else{
   const {pet,...settings}=pack.data,previous=arrange().snapshot(out.settings).layout;Object.assign(out.settings,settings);if(C.own(settings,'deskOrder'))arrange().resetCore(out.settings,previous);if(C.own(settings,'sceneTheme')&&out.settings.makeYourOwn)out.settings.makeYourOwn={...out.settings.makeYourOwn,theme:null};if(pet)out.pet={...(out.pet||{}),...pet};
  }return out;
 }
 function describe(source){
  const pack=checked(source);if(pack.kind==='layout'){const m=arrange();return ['Home layout: '+m.leaves(pack.data.workspaceLayout).map(key=>m.label(key)).join(', '),...Object.entries(pack.data.moduleSize||{}).map(([key,size])=>m.label(key)+': '+size)];}
  if(pack.kind==='planner')return days.flatMap(day=>(pack.data.days[day]||[]).map(block=>day+': '+block.title+' ('+block.minutes+' min'+(block.at?', '+block.at:'')+')'));
  if(pack.kind==='routines')return pack.data.lines.map(line=>'Routine: '+line);return Object.entries(pack.data).flatMap(([key,value])=>key==='pet'?Object.entries(value).map(([key,v])=>'Pet '+key+': '+v):[key+': '+String(value)]);
 }
 const api=Object.freeze({limits:C.limits,kinds:Object.freeze(kinds),validate,importPack:(file,deps={})=>C.importPack(file,'chpreset',validate,deps),problems:(source,deps={})=>C.problems(validate,source,deps),portable:C.portable,apply,describe});root.ReservePresetPack=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
