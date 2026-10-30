/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Market data installs. The worker owns mutations; popup reads never fetch the market. */
(function(root){
 'use strict';
 const STORAGE_KEY='reserve:packs',RECEIPTS='reserve:packs:receipts',ORIGIN='https://flzsh.github.io',PATH='/canvas-harness-packs/',MAX=40000000,MARKET_KINDS=['kit','course-art','feature','theme','pet','preset'],UPDATE='Update Canvas Harness to add this';
 const own=(v,k)=>v!=null&&Object.hasOwn(v,k),clone=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),fail=message=>{throw Error(message);};
 let busy=false;
 const local=()=>root.chrome.storage.local,record=v=>v&&typeof v==='object'&&!Array.isArray(v),worker=()=>typeof root.importScripts==='function';
 function printable(v,max){return typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=max&&!/[\p{C}\u2028\u2029]/u.test(v);}
 function safeFile(file){
  if(!printable(file,2048)||!/^[\x21-\x7e]+$/.test(file)||/[\\%?#\s]/u.test(file)||/(?:^|\/)\.{1,2}(?:\/|$)/.test(file)||/\/\/[^/]*@/.test(file))fail('Invalid market file.');
  let url;try{url=new URL(file,ORIGIN+PATH);}catch{fail('Invalid market file.');}
  if(url.origin!==ORIGIN||!url.pathname.startsWith(PATH)||url.pathname===PATH||url.username||url.password||url.search||url.hash)fail('Invalid market file.');return file;
 }
 function metadata(value){
  const keys=['id','name','kind','file','size','sha256'];
  if(record(value)&&typeof value.kind==='string'&&!MARKET_KINDS.includes(value.kind))fail(UPDATE);
  if(!record(value)||
   Object.keys(value).length!==keys.length||
   keys.some(k=>!own(value,k))||
   !printable(value.id,100)||
   !/^[a-z0-9][a-z0-9._-]*$/i.test(value.id)||
   ['__proto__','constructor','prototype'].includes(value.id)||
   !printable(value.name,120)||
   !MARKET_KINDS.includes(value.kind)||
   !Number.isSafeInteger(value.size)||
   value.size<1||
   value.size>MAX||
   typeof value.sha256!=='string'||
   !/^([a-f0-9]{64})$/.test(value.sha256))
   fail('Invalid pack entry.');
  return {id:value.id,name:value.name,kind:value.kind,file:safeFile(value.file),size:value.size,sha256:value.sha256};
 }
 function decode64(value,max=MAX){
  if(typeof value!=='string'||!value.length||value.length>Math.ceil(max/3)*4||value.length%4)fail('Invalid pack bytes.');
  const end=value.length-(value.endsWith('==')?2:value.endsWith('=')?1:0),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for(let i=0;i<end;i++)if(alphabet.indexOf(value[i])<0)fail('Invalid pack bytes.');
  const padding=value.length-end;if(padding&&(alphabet.indexOf(value[end-1])&(padding===2?15:3)))fail('Invalid pack padding.');
  if(end<1||value.length/4*3-padding>max)fail('Pack exceeds 40 MB.');
  let binary;try{binary=root.atob(value);}catch{fail('Invalid pack bytes.');}return Uint8Array.from(binary,c=>c.charCodeAt(0));
 }
 function encode64(value){let out='';for(let i=0;i<value.length;i+=24576)out+=root.btoa(String.fromCharCode(...value.subarray(i,i+24576)));return out;}
 async function verified(entry,input){
  const bytes=typeof input==='string'?decode64(input):input instanceof ArrayBuffer&&input.byteLength<=MAX?new Uint8Array(input.slice(0)):fail('Invalid pack bytes.');
  if(bytes.byteLength!==entry.size)fail('Pack size mismatch.');
  const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),c=>c.toString(16).padStart(2,'0')).join('');if(hash!==entry.sha256)fail('Pack hash mismatch.');
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('Pack must use UTF-8.');}
 }
 async function installed(options={}){
  let identity=options.store?.owner||options.owner;if(!worker()&&!identity)return ((await remote('market-list',{})).packs||[]).filter(p=>MARKET_KINDS.includes(p?.kind));
  if(identity){identity=checkedOwner(identity);if(!await root.ReserveMarketSite.allowed(identity.origin))fail('Canvas site is not allowed.');}else try{identity=await owner();}catch{}
  const saved=await local().get([STORAGE_KEY,RECEIPTS]),
   receipts=saved[RECEIPTS]||{},
   legacy=Object.values(record(saved[STORAGE_KEY])?saved[STORAGE_KEY]:{}).filter(p=>{
   if(!record(p)||!printable(p.id,100)||!printable(p.name,120)||!MARKET_KINDS.includes(p.kind))return false;
   const r=receipts[p.id];return r?.kind==='feature'&&!r.owner||identity&&(r?.owner&&same(r.owner,identity)||r?.key===accountKey(identity));
  }).map(({id,name,kind,installedAt,catalogueId})=>
   ({id:options.marketOnly?catalogueId||id:id,name,kind,...(Number.isSafeInteger(installedAt)?{installedAt}:{})}));
  if(!identity)return legacy;const pool=root.ReserveMedia.createPackStore(identity);
  try{
   const portable=[];
   for(const row of pool.listPacks?await pool.listPacks():[]){
    if(!MARKET_KINDS.includes(row?.kind))continue;
    if(options.marketOnly){const doc=await pool.getPack(row.id);if(!doc?.market||doc.market.id!==row.id)continue;}
    portable.push(row);
   }
   return legacy.concat(portable);
  }finally{pool.close();}
 }
 async function remote(type,values){
  const reply=await root.chrome.runtime.sendMessage({type,...values});
  if(!reply?.ok)fail(reply?.reason||reply?.error||'Pack request failed.');
  return reply;
 }
 async function exclusive(fn){if(busy)fail('A pack operation is in progress.');busy=true;try{return await fn();}finally{busy=false;}}
 async function registry(){
  const saved=await local().get([STORAGE_KEY,RECEIPTS]);
  return {rows:record(saved[STORAGE_KEY])?saved[STORAGE_KEY]:{},receipts:record(saved[RECEIPTS])?saved[RECEIPTS]:{}};
 }
 async function rollbackExtraNow(change){
  if(!change)return;const names=[...new Set([...Object.keys(change.values),...change.drop])],current=await local().get(names),restore={},remove=[];
  for(const name of names){
   const owned=own(change.values,name)?own(current,name)&&same(current[name],change.values[name]):!own(current,name);
   if(!owned)continue;
   if(own(change.previous,name))restore[name]=change.previous[name];else if(own(current,name))remove.push(name);
  }
  if(Object.keys(restore).length)await local().set(restore);if(remove.length)await local().remove(remove);
 }
 async function rollbackExtra(change){if(!change)return;return change.features?root.ReserveFeatures.run(()=>rollbackExtraNow(change)):rollbackExtraNow(change);}
 async function commitExtra(extra,drop=[],featureAction){
  const F=root.ReserveFeatures,features=!!featureAction||own(extra,F.KEY)||drop.includes(F.KEY);
  const commit=async()=>{
   const values={...extra},removed=[...drop],saved=await local().get([...Object.keys(values),...removed,...(featureAction?[F.KEY]:[])]);
   if(featureAction){
    const current=preferenceState(saved,F.KEY);let selection;
    if(featureAction.op==='install'){
     // A choice made while profile verification awaited wins over this install.
     selection=same(current,featureAction.expected)?enableFeature(current,featureAction.feature):current;
     featureAction.receipt.previous=F.resolve(current.value).enabled.includes(featureAction.feature);
     featureAction.receipt.preferences={before:clone(current),after:clone(selection),...(!same(current,featureAction.expected)?{skipped:true}:{})};
    }else selection=featureUndo(featureAction.receipt,featureAction.later,saved);
    if(!same(selection,current)){if(selection.present)values[F.KEY]=selection.value;else removed.push(F.KEY);}
   }
   const change={values:clone(values),drop:[...new Set(removed)],previous:saved,features};
   try{
    if(Object.keys(values).length)await local().set(values);
    if(change.drop.length)await local().remove(change.drop);
   }catch(error){try{await rollbackExtraNow(change);}catch(rollback){throw Error(error.message+'; rollback failed: '+rollback.message);}throw error;}
   return change;
  };
  return features?F.run(commit):commit();
 }
 async function publish(r,extra={},drop=[],featureAction){return commitExtra({...extra,[STORAGE_KEY]:r.rows,[RECEIPTS]:r.receipts},drop,featureAction);}
 const preferenceState=(saved,key)=>({present:own(saved,key),...(own(saved,key)?{value:clone(saved[key])}:{})});
 function enableFeature(state,feature){
  const F=root.ReserveFeatures,prefs=F.normalize(state.value),enabled=F.resolve(prefs).enabled;
  if(enabled.includes(feature))return clone(state);
  return {present:true,value:{preset:'custom',custom:[...new Set([...(prefs.preset==='custom'?prefs.custom:enabled),feature])]}};
 }
 function featureUndo(receipt,later,saved){
  const F=root.ReserveFeatures,current=preferenceState(saved,F.KEY);if(receipt.devicePreferences===false)return current;
  if(!receipt.preferences){
   // Compatibility for older receipts: avoid overriding a later preset choice.
   const prefs=F.normalize(current.value),next=later.find(p=>p.kind==='feature'&&p.feature===receipt.feature);if(next)next.previous=receipt.previous;
   if(next||receipt.previous||prefs.preset!=='custom')return current;
   return {present:true,value:{preset:'custom',custom:prefs.custom.filter(id=>id!==receipt.feature)}};
  }
  let old=clone(receipt.preferences.after),next=clone(receipt.preferences.before);
  // Replay only a continuous chain of extension-owned choices. A different
  // before record marks an intervening choice by the student and ends the chain.
  for(const row of later.filter(p=>p.kind==='feature')){
   if(!row.preferences||!same(row.preferences.before,old))break;
   const previousAfter=clone(row.preferences.after);
   row.previous=F.resolve(next.value).enabled.includes(row.feature);
   row.preferences.before=clone(next);
   next=row.preferences.skipped?clone(next):enableFeature(next,row.feature);
   row.preferences.after=clone(next);
   old=previousAfter;
  }
  return same(current,old)?next:current;
 }
 async function canvas(origin,path){
  if(!await root.ReserveMarketSite.allowed(origin))fail('Canvas site is not allowed.');
  const response=await root.fetch(origin+path,{credentials:'include',redirect:'error',cache:'no-store',headers:{Accept:'application/json+canvas-string-ids'},signal:AbortSignal.timeout(15000)});
  if(!response.ok||response.redirected||!response.headers.get('content-type')?.includes('json'))fail('Sign in to Canvas.');
  return {data:await response.json(),link:response.headers.get('link')||''};
 }
 async function owner(origin){
  origin=origin||await root.ReserveMarketSite.selected();
  const {data}=await canvas(origin,'/api/v1/users/self/profile');
  if(!/^\d+$/.test(String(data?.id)))fail('Sign in to Canvas.');
  return {origin,accountId:String(data.id)};
 }
 async function confirmOwner(expected){const current=await owner(expected.origin);if(!same(current,expected))fail('Canvas account changed.');}
 const accountKey=owner=>'reserve:v1:'+owner.origin+':'+owner.accountId;
 const lock=(key,fn)=>root.ReserveAccountWrites?root.ReserveAccountWrites.run(key,fn):fn();
 async function courses(identity){
  const origin=identity.origin;
  const out=[],seen=new Set();let path='/api/v1/courses?per_page=100&enrollment_state=active';
  while(path){
   if(seen.has(path)||seen.size>=100)fail('Course list is incomplete.');
   seen.add(path);
   const result=await canvas(origin,path);
   if(!Array.isArray(result.data))fail('Course list is unavailable.');
   out.push(...result.data);
   const next=result.link.match(/<([^>]+)>\s*;\s*rel="next"/);
   path=null;
   if(next){const url=new URL(next[1],origin);if(url.origin!==origin||url.pathname!=='/api/v1/courses'||url.username||url.password||url.hash)fail('Invalid course page.');path=url.pathname+url.search;}
  }
  return out.filter(c=>/^\d+$/.test(String(c?.id))).map(c=>({id:String(c.id),name:String(c.name||''),originalName:String(c.name||''),code:String(c.course_code||'')}));
 }
 function at(value,path,create=false){let node=value;for(const key of path){if(!record(node[key])){if(!create)return {};node[key]={};}node=node[key];}return node;}
 function artPlan(source){
  const parsed=root.CanvasHarnessPack.parse(source);
  if(!parsed.ok||parsed.errors.length||parsed.skipped.length||parsed.warnings.length||parsed.parts.some(p=>p.errors.some(e=>e.code!=='replaced')))fail('Invalid course-art pack.');
  return root.CanvasHarnessPack.applyOrder(parsed).map(part=>({...part,asset:root.ReserveCustomArt.importSVG(part.svg,part.name)}));
 }
 function applyArt(data,parts,list){
  const changes=new Map();data.settings??={};data.settings.coursePrefs??={};data.settings.overviewArt??={};
  const labels=list.map(c=>({...c,name:data.settings.coursePrefs[c.id]?.name||c.name}));
  for(const part of parts){
   let paths;
   if(part.target.type==='overview')
    paths=[['overviewArt']];
   else if(part.target.type==='every-course')
    paths=list.map(c=>['coursePrefs',c.id]);
   else{const match=root.CanvasHarnessPack.matchCourse(part.target,labels);if(match.status!=='matched')fail('Course target is unresolved.');paths=[['coursePrefs',match.course.id]];}
   if(!paths.length)fail('No matching courses.');
   const values={
    [root.CanvasHarnessPack.SLOT_KEYS[part.slot]]:part.asset,
    ...(part.slot==='banner'?{...(part.fit?{bannerFit:part.fit}:{}),...(part.position?{bannerPosition:part.position}:{})}:{})
   };
   for(const path of paths){
    const pref=at(data.settings,path,true);
    for(const [key,value]of Object.entries(values)){
     const address=JSON.stringify([...path,key]),old=changes.get(address),beforeOwn=old?old.beforeOwn:own(pref,key);
     changes.set(address,{path,key,beforeOwn,...(beforeOwn?{before:clone(old?old.before:pref[key])}:{}),after:clone(value)});
     pref[key]=clone(value);
    }
   }
  }
  root.ReserveCustomization.checkBudget(data.settings);root.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data});return [...changes.values()];
 }
 async function importMedia(blob,slot,name){
  if(root.ReservePackMedia)return root.ReservePackMedia.prepare(blob,slot,name);
  if(root.document)return root.ReserveMedia.prepare(blob,slot,name);fail('Media decoder is unavailable.');
 }
 async function registryId(r,entry,identity){
  if(Object.values(r.rows).some(row=>
   (row.catalogueId||row.id)===entry.id&&(identity?accountReceipt(r.receipts[row.id],identity):!r.receipts[row.id]?.owner&&!r.receipts[row.id]?.key)))
   fail('Pack is already installed.');
  if(!own(r.rows,entry.id))return entry.id;
  return 'account-'+
   Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([identity,entry.id])))),n=>n.toString(16).padStart(2,'0')).join('');
 }
 async function install(value,input,options={}){
  if(!worker()){metadata(value);return remote('market-install',{entry:value,bytes:input instanceof ArrayBuffer?encode64(new Uint8Array(input)):input});}
  return exclusive(async()=>{
   const entry=metadata(value),source=await verified(entry,input);let feature,beforeFeature;if(entry.kind==='feature'){
    try{feature=JSON.parse(source);}catch{fail('Invalid feature pack.');}const F=root.ReserveFeatures;
    if(!record(feature)||
     !own(feature,'feature')||
     typeof feature.feature!=='string'||
     !F.catalogue.some(f=>f.id===feature.feature)||
     Object.keys(feature).some(k=>k!=='feature'&&(k!=='sceneTheme'||feature.feature!=='scene-themes'))||
     own(feature,'sceneTheme')&&!root.ReserveCustomization.enums.sceneTheme.includes(feature.sceneTheme))
     fail('Unknown feature.');
    beforeFeature=preferenceState(await local().get(F.KEY),F.KEY);
   }
   const bound=options.owner?checkedOwner(options.owner):null,identity=bound||((entry.kind!=='feature'||own(feature,'sceneTheme'))?await owner():null);if(bound)await confirmOwner(bound);
   if(['theme','pet','preset'].includes(entry.kind))
    return localInstall(source,{
     owner:identity,
     kind:entry.kind,
     id:entry.id,
     name:entry.name,
     market:{id:entry.id,sha256:entry.sha256},
     apply:entry.kind!=='preset',
     recheck:()=>confirmOwner(identity)
    });
   const r=await registry(),account=entry.kind!=='feature'||own(feature,'sceneTheme')?identity:null,id=await registryId(r,entry,account);if(Object.keys(r.rows).length>=50)fail('At most 50 packs.');
   const order=Math.max(0,...Object.values(r.receipts).map(p=>Number.isSafeInteger(p?.order)?p.order:0))+1,
    row={id,name:entry.name,kind:entry.kind,installedAt:Date.now(),...(id!==entry.id?{catalogueId:entry.id}:{})};
   r.rows[id]=row;
   if(entry.kind==='feature'){
    const doc=feature,F=root.ReserveFeatures;
    if(!record(doc)||
     !own(doc,'feature')||
     typeof doc.feature!=='string'||
     !F.catalogue.some(f=>f.id===doc.feature)||
     Object.keys(doc).some(k=>k!=='feature'&&(k!=='sceneTheme'||doc.feature!=='scene-themes'))||
     own(doc,'sceneTheme')&&!root.ReserveCustomization.enums.sceneTheme.includes(doc.sceneTheme))
     fail('Unknown feature.');
    const beforeSelection=beforeFeature,
     afterSelection=enableFeature(beforeSelection,doc.feature),
     previous=F.resolve(beforeSelection.value).enabled.includes(doc.feature);
    const receipt=r.receipts[id]={kind:'feature',order,feature:doc.feature,previous,preferences:{before:beforeSelection,after:afterSelection}},
     featureAction={op:'install',receipt,expected:beforeSelection,feature:doc.feature};
    if(own(doc,'sceneTheme')){
     await withTarget({owner:identity,preview:true},async t=>{
      const before=await documents(t.pool),docs=clone(before);
      docs.forEach(d=>cleanReceipt(d.receipt,d.kind));
      const receipt=r.receipts[id];
      receipt.owner=identity;
      receipt.applications=[];
      let data=t.data;
      const previous=clone(data);
      makeState(data).theme=null;
      data.settings.sceneTheme=doc.sceneTheme;
      data=recordApplication(previous,data,{receipt},scenePaths,history(docs,r,identity));
      await confirmOwner(identity);
      await publishLocal(t,before,docs,data,{[STORAGE_KEY]:r.rows,[RECEIPTS]:r.receipts},[],featureAction);
     });
    }
    else{if(bound)await confirmOwner(bound);await publish(r,{},[],featureAction);}
   }else if(entry.kind==='kit'){
    const imported=await root.ReserveCustomKits.importKit({name:'market.chkit',size:entry.size,text:async()=>source},{media:{prepare:importMedia}}),
     store=root.ReserveMedia.createPackStore(identity);
    try{
     await confirmOwner(identity);
     await store.putMany(imported.media,{kit:imported.kit});
     r.receipts[id]={kind:'kit',order,owner:identity,kitId:imported.kit.id,mediaIds:imported.media.map(m=>m.asset.mediaId)};
     try{await confirmOwner(identity);await publish(r);}catch(error){await store.removeKit(imported.kit.id,{mediaIds:r.receipts[id].mediaIds});throw error;}
    }finally{store.close();}
   }else{
    const parts=artPlan(source),list=await courses(identity),key=accountKey(identity);await confirmOwner(identity);
    await lock(key,async()=>{
     const data=clone((await local().get(key))[key]||{version:1,settings:{coursePrefs:{},overviewArt:{}}}),
      before=clone(data.settings||{}),
      changes=applyArt(data,parts,list);
     r.receipts[id]={
      kind:'course-art',
      order,
      key,
      changes,
      containers:changes.map(c=>c.path).filter((p,i,a)=>a.findIndex(q=>same(q,p))===i).map(path=>({path,existed:record(at(before,path.slice(0,-1))[path.at(-1)])}))
     };
     await confirmOwner(identity);
     await publish(r,{[key]:data});
    });
   }return row;
  });
 }
 async function remove(id){
  if(!worker())return remote('market-remove',{id});
  return exclusive(async()=>{
   const r=await registry();
   if(typeof id!=='string')fail('Unknown pack.');
   if(!own(r.rows,id))return localRemove(id,{owner:await owner()});
   const original=clone(r),
    receipt=r.receipts[id],
    later=Object.entries(r.receipts).filter(([key,p])=>key!==id&&p?.order>receipt?.order).sort((a,b)=>a[1].order-b[1].order).map(([,p])=>p);
   let identity;
   if(receipt?.kind==='kit'||receipt?.kind==='feature'&&receipt.owner)
    await confirmOwner(identity=checkedOwner(receipt.owner));
   else if(receipt?.kind==='course-art'&&receipt.key!==accountKey(identity=await owner()))fail('Canvas account changed.');
   delete r.rows[id];
   delete r.receipts[id];
   if(receipt?.kind==='feature'){
    const featureAction={op:'remove',receipt,later};
    if(receipt.owner)
     await withTarget({owner:receipt.owner,preview:true},async t=>{
      const before=await documents(t.pool),docs=clone(before);
      docs.forEach(d=>cleanReceipt(d.receipt,d.kind));
      const doc=sceneHistory(receipt),data=undoApplications(t.data,doc,history(docs,r,t.identity));
      await confirmOwner(t.identity);
      await publishLocal(t,before,docs,data,{[STORAGE_KEY]:r.rows,[RECEIPTS]:r.receipts},[],featureAction);
     });
    else await publish(r,{},[],featureAction);
   }else if(receipt?.kind==='course-art')await lock(receipt.key,async()=>{
    const saved=await local().get(receipt.key),data=clone(saved[receipt.key]);
    if(data?.settings){
     for(const change of receipt.changes){
      const next=later.filter(p=>p.kind==='course-art'&&p.key===receipt.key).flatMap(p=>p.changes).find(c=>same(c.path,change.path)&&c.key===change.key);
      if(next){
       if(next.beforeOwn&&same(next.before,change.after)){next.beforeOwn=change.beforeOwn;if(change.beforeOwn)next.before=clone(change.before);else delete next.before;}
       continue;
      }
     const pref=at(data.settings,change.path);
     if(own(pref,change.key)&&same(pref[change.key],change.after)){if(change.beforeOwn)pref[change.key]=clone(change.before);else delete pref[change.key];}
    }
     for(const c of receipt.containers||[]){
      const next=later.filter(p=>p.kind==='course-art'&&p.key===receipt.key).flatMap(p=>p.containers||[]).find(x=>same(x.path,c.path));
      if(next){if(!c.existed)next.existed=false;}
      else if(!c.existed){
       const parent=at(data.settings,c.path.slice(0,-1)),pref=parent[c.path.at(-1)];
       if(record(pref)&&!Object.keys(pref).length)delete parent[c.path.at(-1)];
      }
     }
    }if(data)root.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data});await confirmOwner(identity);await publish(r,data?{[receipt.key]:data}:{});
   });
   else if(receipt?.kind==='kit'){
    const store=root.ReserveMedia.createPackStore(receipt.owner);
    try{
     await publish(r);
     try{await store.removeKit(receipt.kitId,{mediaIds:receipt.mediaIds||[]});}catch(error){await publish(original);throw error;}
    }finally{store.close();}
   }else await publish(r);
  });
 }
 const kinds=['theme','pet','preset'],
  formats={chtheme:'theme',chpet:'pet',chpreset:'preset'},
  rowOf=({id,name,kind})=>({id,name,kind}),
  sizeOf=v=>new TextEncoder().encode(typeof v==='string'?v:JSON.stringify(v)).length;
 function displayName(value){let name='';for(const char of value){if(name.length+char.length>120)break;name+=char;}return name.trimEnd();}
 function checkedOwner(value){return root.ReserveMarketSite.owner(value);}
 function optionsOwner(options){
  const identity=checkedOwner(options.store?.owner||options.owner);
  if(options.owner&&!same(identity,checkedOwner(options.owner)))fail('Canvas account changed.');
  return identity;
 }
 function validId(id){return printable(id,100)&&/^[a-z0-9][a-z0-9._-]*$/i.test(id)&&!['__proto__','constructor','prototype'].includes(id);}
 async function localFile(file){
  const ext=typeof file?.name==='string'?file.name.match(/\.(chtheme|chpet|chpreset)$/i):null;
  if(!ext||!Number.isSafeInteger(file.size)||file.size<1||file.size>MAX||typeof file.text!=='function')fail('Choose a .chtheme, .chpet or .chpreset file up to 40 MB.');
  let source;
  try{source=typeof file.arrayBuffer==='function'?new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()):await file.text();}catch{fail('Pack must use UTF-8.');}
  if(typeof source!=='string'||sizeOf(source)!==file.size||sizeOf(source)>MAX)fail('Invalid local pack size.');
  return {source,kind:formats[ext[1].toLowerCase()]};
 }
 function validator(kind){
  const api=root[{theme:'ReserveThemePack',pet:'ReservePetPack',preset:'ReservePresetPack'}[kind]];
  if(!api?.validate)fail('Pack validation is unavailable. Reload Canvas Harness.');
  return api;
 }
 async function validateSource(source,kind){
  if(typeof source!=='string'||sizeOf(source)>MAX)fail('Pack exceeds 40 MB.');
  let wire;
  try{wire=JSON.parse(source);}catch{fail('Invalid pack JSON.');}
  if(!kind||formats[wire?.format]!==kind)fail('Pack format does not match its kind.');
  return validator(kind).validate(source,{media:{prepare:importMedia}});
 }
 async function target(options){
  const identity=optionsOwner(options);
  if(!await root.ReserveMarketSite.allowed(identity.origin))fail('Canvas site is not allowed.');
  let store=options.store;
  if(store&&(!store.get||!store.update||!store.sync))fail('A verified account store is required.');
  if(!store)
   store=root.ReserveStorage.createStore({...identity,adapter:{read:async key=>(await local().get(key))[key],write:(key,value)=>local().set({[key]:value})}});
  return {identity,store,created:!options.store,pool:root.ReserveMedia.createPackStore(identity)};
 }
 async function documents(pool){const out=[];for(const row of await pool.listPacks()){const doc=await pool.getPack(row.id);if(!doc)fail('Saved pack is missing.');out.push(doc);}return out;}
 function makeState(data){data.settings??={};data.settings.makeYourOwn??={theme:null,pet:null,installed:{}};return data.settings.makeYourOwn;}
 // Arrays of personal cards and routines are addressed by stable IDs. Removing
 // a preset can therefore keep a card the student added or edited afterwards.
 function address(data,path,create=false){
  let node=data;
  for(const key of path.slice(0,-1)){
   if(Array.isArray(node)){let next=node.find(v=>record(v)&&v.id===key);if(!next){if(!create)return null;next={id:key};node.push(next);}node=next;}
   else{if(!record(node?.[key])&&!Array.isArray(node?.[key])){if(!create)return null;node[key]={};}node=node[key];}
  }
  const key=path.at(-1);
  if(Array.isArray(node)){
   const index=node.findIndex(v=>record(v)&&v.id===key);
   return {has:index>=0,value:index<0?undefined:node[index],set(v){if(index<0)node.push(clone(v));else node[index]=clone(v);},drop(){if(index>=0)node.splice(index,1);}};
  }
  if(!record(node))return null;
  return {has:own(node,key),value:node[key],set:v=>{node[key]=clone(v);},drop:()=>{delete node[key];}};
 }
 function changesBetween(before,after){
  const changes=[],add=path=>{
   const a=address(before,path),b=address(after,path);
   if(!!a?.has===!!b?.has&&(!a?.has||same(a.value,b.value)))return;
   changes.push({path,beforeOwn:!!a?.has,...(a?.has?{before:clone(a.value)}:{}),afterOwn:!!b?.has,...(b?.has?{after:clone(b.value)}:{})});
  };
  for(const key of new Set([...Object.keys(before.settings||{}),...Object.keys(after.settings||{})]))
   if(key==='moduleSize'){for(const id of new Set([...Object.keys(before.settings?.moduleSize||{}),...Object.keys(after.settings?.moduleSize||{})]))add(['settings','moduleSize',id]);}
   else if(key!=='makeYourOwn')add(['settings',key]);
  for(const key of ['theme','pet'])add(['settings','makeYourOwn',key]);
  for(const key of new Set([...Object.keys(before.tasks||{}),...Object.keys(after.tasks||{})]))add(['tasks',key]);
  for(const rootKey of ['customTasks'])for(const id of new Set([...(before[rootKey]||[]),...(after[rootKey]||[])].map(v=>v.id)))add([rootKey,id]);
  for(const key of new Set([...Object.keys(before.pet||{}),...Object.keys(after.pet||{})])){
   if(key==='routines'){for(const id of new Set([...(before.pet?.routines||[]),...(after.pet?.routines||[])].map(v=>v.id)))add(['pet','routines',id]);}else add(['pet',key]);
  }
  return changes;
 }
 const allowedSettings=new Set([
  'sceneTheme',
  'nightArt',
  ...Object.keys(root.ReserveCustomization?.defaults||{}),
  'theme',
  'accent',
  'motion',
  'livingArt',
  'readingFont',
  'greeting',
  'quickOpen',
  'density',
  'font',
  'textSize',
  'dashboardLayout',
  'showGrades',
  'showCourseStrip',
  'showRecentGrades'
 ]);
 function receiptPath(path){
  if(!Array.isArray(path)||path.length<2||path.length>3||path.some(k=>typeof k!=='string'||!k.length||k.length>100||['__proto__','constructor','prototype'].includes(k)))return false;
  if(path[0]==='settings')
   return path.length===3?
    path[1]==='makeYourOwn'&&['theme','pet'].includes(path[2])||path[1]==='moduleSize'&&root.ReserveWorkspaceArrange.isKey(path[2]):
    allowedSettings.has(path[1])&&!['coursePrefs','overviewArt'].includes(path[1]);
  if(path[0]==='tasks')return path.length===2&&/^(?:\d+|local-[\w-]+)$/.test(path[1]);
  if(path[0]==='customTasks')return path.length===2&&/^local-[\w-]+$/.test(path[1]);
  return path[0]==='pet'&&(path.length===3?path[1]==='routines':['coat','harness','name','enabled','size'].includes(path[1]));
 }
 function cleanReceipt(receipt,kind){
  if(!record(receipt)||Object.keys(receipt).some(k=>!['kind','applications'].includes(k))||receipt.kind!==kind||!Array.isArray(receipt.applications))fail('Invalid pack receipt.');
  for(const app of receipt.applications){
   if(!record(app)||Object.keys(app).some(k=>!['order','changes'].includes(k))||!Number.isSafeInteger(app.order)||app.order<1||!Array.isArray(app.changes))fail('Invalid pack receipt.');
   const paths=new Set();
   for(const change of app.changes){
    if(!record(change)||
     Object.keys(change).some(k=>!['path','beforeOwn','before','afterOwn','after'].includes(k))||
     !receiptPath(change.path)||
     typeof change.beforeOwn!=='boolean'||
     typeof change.afterOwn!=='boolean'||
     own(change,'before')!==change.beforeOwn||
     own(change,'after')!==change.afterOwn||
     paths.has(JSON.stringify(change.path)))
     fail('Invalid pack undo path.');
    paths.add(JSON.stringify(change.path));
   }
  }
  return receipt;
 }
 const scenePaths=[['settings','makeYourOwn','theme'],['settings','sceneTheme']];
 function sceneHistory(receipt){
  const checked=cleanReceipt({kind:'feature',applications:receipt.applications},'feature');
  if(receipt.feature!=='scene-themes'||checked.applications.some(a=>a.changes.some(c=>!scenePaths.some(p=>same(p,c.path)))))fail('Invalid scene pack receipt.');
  return {receipt:checked};
 }
 function history(docs,r,identity){return docs.concat(Object.values(r.receipts).filter(p=>p?.kind==='feature'&&p.owner&&same(p.owner,identity)).map(sceneHistory));}
 async function availableModules(data){
  const A=root.ReserveWorkspaceArrange,F=root.ReserveFeatures;
  if(!A)return [];
  let selection;
  if(F?.resolve){const saved=await local().get(F.KEY);selection=new Set(F.resolve(saved[F.KEY]).enabled);}
  const enabled=id=>!selection||selection.has(id),
   out=A.ALL.filter(key=>A.PANELS.includes(key)||enabled('planner')&&(!['context','messages'].includes(key)||enabled('course-hub'))&&(key!=='grades'||enabled('grades'))&&(key!=='pet'||enabled('pony')));
  return out;
 }
 function writtenPaths(doc,pack,options){
  if(doc.kind==='theme')return [['settings','makeYourOwn','theme'],['settings','sceneTheme'],['settings','nightArt']];
  if(doc.kind==='pet')return [['settings','makeYourOwn','pet']];
  if(pack.kind==='layout')
   return ['workspaceLayout','workspaceOrder','workspaceMode','deskOrder','dashboardLayout'].map(k=>
    ['settings',k]).concat(Object.keys(pack.data.moduleSize||{}).filter(k=>!options.modules||options.modules.includes(k)).map(k=>
    ['settings','moduleSize',k]));
  if(pack.kind==='settings')
   return Object.keys(pack.data).flatMap(k=>k==='pet'?Object.keys(pack.data.pet).map(k=>['pet',k]):[['settings',k]]).concat(own(pack.data,'deskOrder')?
    ['workspaceLayout','workspaceOrder','workspaceMode','workspaceUndo'].map(k=>['settings',k]):
    []);
  return [];
 }
 function checkedData(data){
  data=root.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data});
  return root.ReservePagePreferences.apply(data,root.ReservePagePreferences.fromData(data));
 }
 function recordApplication(before,data,doc,paths,docs){
  data=checkedData(data);
  const changes=changesBetween(before,data);
  for(const path of paths)
   if(!changes.some(c=>same(c.path,path))){
    const a=address(before,path),b=address(data,path);
    if(a?.has||b?.has)changes.push({path,beforeOwn:!!a?.has,...(a?.has?{before:clone(a.value)}:{}),afterOwn:!!b?.has,...(b?.has?{after:clone(b.value)}:{})});
   }
  const order=Math.max(0,...docs.flatMap(d=>d.receipt.applications.map(a=>a.order)))+1;
  if(!Number.isSafeInteger(order))fail('Pack history is full. Remove an older pack before applying another.');
  doc.receipt.applications.push({order,changes});
  return data;
 }
 function applyPack(data,doc,pack,options,docs){
  data=checkedData(data);
  const before=clone(data);
  if(doc.kind==='theme'){makeState(data).theme=rowOf(doc);data.settings.sceneTheme='';data.settings.nightArt=0;}
  else if(doc.kind==='pet')
   makeState(data).pet=rowOf(doc);
  else{const next=validator('preset').apply(data,pack,{week:options.week,modules:options.modules});if(!record(next))fail('Preset could not be applied.');data=next;}
  return recordApplication(before,data,doc,writtenPaths(doc,pack,options),docs);
 }
 const matchesChange=(current,change,side)=>!!current?.has===change[side+'Own']&&(!change[side+'Own']||same(current.value,change[side]));
 function editedPlannerCards(data,app,later){
  const keep=new Set(),laterChanges=later.flatMap(a=>a.changes);
  for(const card of app.changes.filter(c=>c.path[0]==='customTasks'&&!c.beforeOwn&&c.afterOwn)){
   const id=card.path[1],state=app.changes.find(c=>c.path[0]==='tasks'&&c.path[1]===id);
   if(!state||!address(data,card.path)?.has)continue;
   // A Planner card is one logical object split between these two branches.
   // Keep both if either the title/date or its notes/checklist/progress changed.
   for(const change of [card,state]){
    const expected=laterChanges.filter(c=>same(c.path,change.path)).at(-1)||change;
    if(!matchesChange(address(data,change.path),expected,'after'))keep.add(id);
   }
  }return keep;
 }
 function undoApplications(data,doc,docs){
  for(const app of [...doc.receipt.applications].sort((a,b)=>b.order-a.order)){
   const later=docs.flatMap(d=>d.receipt.applications).filter(a=>a!==app&&a.order>app.order).sort((a,b)=>a.order-b.order),keep=editedPlannerCards(data,app,later);
   for(const change of app.changes){
    if(['tasks','customTasks'].includes(change.path[0])&&keep.has(change.path[1]))continue;
    const next=later.flatMap(a=>a.changes).find(c=>same(c.path,change.path));
    if(next){
     if(next.beforeOwn===change.afterOwn&&(!next.beforeOwn||same(next.before,change.after))){
      next.beforeOwn=change.beforeOwn;
      if(change.beforeOwn)next.before=clone(change.before);else delete next.before;
     }
     continue;
    }
    const current=address(data,change.path);
    if(matchesChange(current,change,'after')){const dest=current||address(data,change.path,true);if(change.beforeOwn)dest.set(change.before);else dest.drop();}
   }doc.receipt.applications=doc.receipt.applications.filter(a=>a!==app);
  }return data;
 }
 // Publication uses path deltas, never a captured account/appearance replacement.
 function documentChanges(before,after,path=[]){
  if(same(before,after))return [];
  if(record(before)&&record(after))
   return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(key=>documentChanges(before[key],after[key],[...path,key]));
  if(Array.isArray(before)&&Array.isArray(after)&&(same(path,['customTasks'])||same(path,['pet','routines']))){
   const ids=new Set([...before,...after].map(v=>v.id));
   return [...ids].flatMap(id=>documentChanges(before.find(v=>v.id===id),after.find(v=>v.id===id),[...path,id]));
  }
  return [
   {path,beforeOwn:before!==undefined,...(before!==undefined?{before:clone(before)}:{}),afterOwn:after!==undefined,...(after!==undefined?{after:clone(after)}:{})}
  ];
 }
 function applyChanges(data,changes,undo=false){
  for(const change of changes){
   const current=address(data,change.path);
   if(undo&&!matchesChange(current,change,'after'))continue;
   const side=undo?'before':'after',dest=current||address(data,change.path,true);
   if(change[side+'Own'])dest.set(change[side]);else dest.drop();
  }
  return data;
 }
 const preferencePath=key=>key==='pet'?['pet','enabled']:['settings',key];
 async function writeAppearance(delta){
  const P=root.ReservePagePreferences;if(typeof P.run!=='function')fail('The appearance writer is unavailable. Reload Canvas Harness.');
  return P.run(async()=>{
   const saved=await local().get(P.KEY),beforeOwn=own(saved,P.KEY),before=saved[P.KEY],after=record(before)?clone(before):{};Object.assign(after,P.patch(delta));
   if(before==null||Array.isArray(before.chosen))after.chosen=[...new Set([...(before?.chosen||[]),...Object.keys(delta)])];
   const change={beforeOwn,before:clone(before),after,fields:Object.keys(delta)};
   try{await local().set({[P.KEY]:after});}catch(error){await undoAppearanceNow(change);throw error;}
   return change;
  });
 }
 async function undoAppearanceNow(change){
  const P=root.ReservePagePreferences;
   const saved=await local().get(P.KEY),current=saved[P.KEY];
   if(same(current,change.after)){if(change.beforeOwn)await local().set({[P.KEY]:change.before});else await local().remove(P.KEY);return;}
   if(!record(current))return;const next=clone(current);let changed=false;
   for(const field of change.fields)
    if(own(current,field)===own(change.after,field)&&same(current[field],change.after[field])){
     if(own(change.before||{},field))next[field]=clone(change.before[field]);else delete next[field];
     changed=true;
     if(Array.isArray(next.chosen)&&!change.before?.chosen?.includes(field))next.chosen=next.chosen.filter(key=>key!==field);
    }
   if(changed)await local().set({[P.KEY]:next});
 }
 async function undoAppearance(change){if(change)return root.ReservePagePreferences.run(()=>undoAppearanceNow(change));}
 async function publishLocal(t,before,after,data,extra={},drop=[],featureAction,transaction={}){
  root.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data});
  const P=root.ReservePagePreferences,
   base=t.snapshot||t.store.get(),
   previousPreferences=P.fromData(base),
   nextPreferences=P.fromData(data),
   preferenceDelta=Object.fromEntries(Object.keys(nextPreferences).filter(key=>!same(previousPreferences[key],nextPreferences[key])).map(key=>
    [key,nextPreferences[key]]));
  const personalChanges=documentChanges(base,data).filter(change=>!Object.keys(nextPreferences).some(key=>same(change.path,preferencePath(key)))),
   removed=before.filter(d=>!after.some(p=>p.id===d.id)),
   put=after.filter(d=>!before.some(p=>p.id===d.id&&same(p,d))),
   key=accountKey(t.identity),
   indexKey='reserve:market-media:'+JSON.stringify([t.identity.origin,t.identity.accountId])+':packs',
   previousIndex=await local().get(indexKey),
   previousAccount=await local().get(key);
  let appearanceChange=null,documentsWritten=false,extraChange=null,accountChanges=[];
  try{
   await confirmOwner(t.identity);if(put.length||removed.length){documentsWritten=true;await t.pool.updatePacks({put,remove:removed.map(d=>d.id)});}
   await confirmOwner(t.identity);
   if(personalChanges.length)
    await t.store.update(d=>{
     const initial=clone(d);
     applyChanges(d,personalChanges);
     accountChanges=documentChanges(initial,d).filter(change=>!Object.keys(nextPreferences).some(key=>same(change.path,preferencePath(key))));
    },{accountWriteLease:t.accountWriteLease});
   if(Object.keys(preferenceDelta).length)appearanceChange=await writeAppearance(preferenceDelta);
   if(Object.keys(extra).length||drop.length||featureAction)extraChange=await commitExtra(extra,drop,featureAction);
   await t.store.sync();await transaction.complete?.();
  }catch(error){
   let rollback;
   try{
    if(documentsWritten){
     const restore=[],drop=[];
     for(const doc of put){
      const current=await t.pool.getPack(doc.id);
      if(same(current,doc)){const original=before.find(p=>p.id===doc.id);if(original)restore.push(original);else drop.push(doc.id);}
     }
     for(const doc of removed)if(!await t.pool.getPack(doc.id))restore.push(doc);
     if(restore.length||drop.length)await t.pool.updatePacks({put:restore,remove:drop,order:before.map(doc=>doc.id)});
     if(!own(previousIndex,indexKey)){
      const current=(await local().get(indexKey))[indexKey];
      if(current?.version===1&&Array.isArray(current.documents)&&!current.documents.length)await local().remove(indexKey);
     }
    }
    // Account writes remain inside the shared account queue. Conditional path
    // rollback leaves unrelated notes, cards and concurrent choices untouched.
    const raw=(await local().get(key))[key];
    if(accountChanges.some(change=>matchesChange(address(raw||{},change.path),change,'after')))
     await t.store.update(d=>applyChanges(d,accountChanges,true),{accountWriteLease:t.accountWriteLease});
    // Undo any canonicalization footprint only if no independent account
    // value differs from the precise pre-publication baseline.
    if(accountChanges.length){
     const current=(await local().get(key))[key];
     if(same(current,P.personal(base))){if(own(previousAccount,key))await local().set({[key]:previousAccount[key]});else await local().remove(key);}
    }
    await undoAppearance(appearanceChange);
    await rollbackExtra(extraChange);
   }catch(e){rollback=e;}
   await t.store.sync().catch(()=>{});if(rollback)throw Error(error.message+'; rollback failed: '+rollback.message);throw error;
  }
 }
 async function previewData(identity){
  const P=root.ReservePagePreferences,
   key=accountKey(identity),
   saved=await local().get([key,P.KEY]),
   data=checkedData(saved[key]||{}),
   value=saved[P.KEY],
   current=await P.read({read:async key=>saved[key]}),
   chosen=value&&typeof value==='object'&&Array.isArray(value.chosen)?value.chosen.filter(k=>own(current,k)):null;
  if(value==null||chosen){const older=P.fromData(data);for(const key of chosen||[])older[key]=current[key];return P.apply(data,older);}
  return P.apply(data,current);
 }
 async function withTarget(options,fn){
  const t=await target(options);
  try{
   return await lock(accountKey(t.identity),async lease=>{
    t.accountWriteLease=lease;
    await confirmOwner(t.identity);
    if(options.preview)t.data=await previewData(t.identity);else await t.store.sync();
    t.snapshot=clone(options.preview?t.data:t.store.get());
    return fn(t);
   });
  }finally{t.pool.close();if(t.created)t.store.destroy();}
 }
 async function localInstall(source,options){
  const imported=await validateSource(source,options.kind);
  return withTarget(options,async t=>{
   const before=await documents(t.pool),docs=clone(before),r=await registry(),id=options.id||'local-'+root.crypto.randomUUID();
   if(!validId(id)||docs.some(d=>d.id===id))fail('Pack is already installed.');
   if(docs.length>=50)fail('At most 50 packs.');
   docs.forEach(d=>cleanReceipt(d.receipt,d.kind));
   const doc={
    id,
    name:options.name||displayName(imported.pack.name),
    kind:options.kind,
    installedAt:Date.now(),
    source,
    ...(options.market?{market:clone(options.market)}:{}),
    receipt:{kind:options.kind,applications:[]}
   };
   docs.push(doc);
   let data=t.store.get();
   makeState(data).installed[id]=rowOf(doc);
   if(options.apply!==false)data=applyPack(data,doc,imported.pack,{...options,modules:options.modules||await availableModules(data)},history(docs,r,t.identity));
   await options.recheck?.();
   await publishLocal(t,before,docs,data);
   return rowOf(doc);
  });
 }
 async function localUse(id,options){
  return withTarget(options,async t=>{
   const before=await documents(t.pool),docs=clone(before),r=await registry(),doc=docs.find(p=>p.id===id);
   if(!doc)fail('Unknown pack.');
   docs.forEach(d=>cleanReceipt(d.receipt,d.kind));
   const imported=await validateSource(doc.source,doc.kind),previous=t.store.get();
   let data=applyPack(previous,doc,imported.pack,{...options,modules:options.modules||await availableModules(previous)},history(docs,r,t.identity));
   makeState(data).installed[id]=rowOf(doc);
   await publishLocal(t,before,docs,data);
   return rowOf(doc);
  });
 }
 async function localRemove(id,options){
  return withTarget(options,async t=>{
   const before=await documents(t.pool),docs=clone(before),r=await registry(),receipts=clone(r.receipts),doc=docs.find(p=>p.id===id);
   if(!doc)fail('Unknown pack.');
   docs.forEach(d=>cleanReceipt(d.receipt,d.kind));
   let data=undoApplications(t.store.get(),doc,history(docs,r,t.identity));
   delete makeState(data).installed[id];
   for(const kind of ['theme','pet'])if(data.settings.makeYourOwn[kind]?.id===id)data.settings.makeYourOwn[kind]=null;
   await publishLocal(t,before,docs.filter(d=>d.id!==id),data,same(receipts,r.receipts)?{}:{[RECEIPTS]:r.receipts});
   return rowOf(doc);
  });
 }
 async function localRequest(op,values,options){
  const identity=optionsOwner(options),reply=await remote('market-local',{op,owner:identity,...values});
  if(options.store)await options.store.sync();
  return reply.row||reply.data;
 }
 async function installLocal(file,options={}){
  optionsOwner(options);
  const {source,kind}=await localFile(file);
  return worker()?exclusive(()=>localInstall(source,{...options,kind})):localRequest('install',{source,kind,week:options.week,apply:options.apply!==false},options);
 }
 async function useLocal(id,options={}){
  optionsOwner(options);
  if(!validId(id))fail('Invalid pack id.');
  return worker()?exclusive(()=>localUse(id,options)):localRequest('use',{id,week:options.week},options);
 }
 async function removeLocal(id,options={}){
  optionsOwner(options);
  if(!validId(id))fail('Invalid pack id.');
  return worker()?exclusive(()=>localRemove(id,options)):localRequest('remove',{id},options);
 }
 async function readLocal(id,options={}){
  const identity=optionsOwner(options);
  if(!validId(id))fail('Invalid pack id.');
  if(!await root.ReserveMarketSite.allowed(identity.origin))fail('Canvas site is not allowed.');
  const pool=root.ReserveMedia.createPackStore(identity);
  try{const doc=await pool.getPack(id);if(!doc)fail('Unknown pack.');return {...rowOf(doc),pack:(await validateSource(doc.source,doc.kind)).pack};}finally{pool.close();}
 }
 const accountReceipt=(receipt,identity)=>record(receipt)&&(receipt.key===accountKey(identity)||record(receipt.owner)&&same(receipt.owner,identity));
 function fields(value,allowed,label){if(!record(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('Invalid '+label+'.');}
 function validateUndoValues(data,applications){
  for(const app of applications)
   for(const change of app.changes)
    for(const field of ['before','after'])
     if(own(change,field)){
      const probe=clone(data),dest=address(probe,change.path,true);
      dest.set(change[field]);
      root.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data:probe});
     }
 }
 function cleanMarketBackup(value,identity,data){
  if(value===undefined)return;
  fields(value,['version','rows','receipts'],'Market backup');
  if(value.version!==1||
   !record(value.rows)||
   !record(value.receipts)||
   Object.keys(value.rows).length>50||
   Object.keys(value.rows).length!==Object.keys(value.receipts).length||
   sizeOf(value)>6500000)
   fail('Invalid Market backup.');
  const out=clone(value),orders=new Set();
  for(const [id,row]of Object.entries(out.rows)){
   fields(row,['id','name','kind','installedAt','catalogueId'],'Market row');const r=out.receipts[id];
   if(!validId(id)||
    row.id!==id||
    !printable(row.name,120)||
    !['kit','course-art','feature'].includes(row.kind)||
    !Number.isSafeInteger(row.installedAt)||
    row.installedAt<0||
    row.catalogueId!==undefined&&!validId(row.catalogueId)||
    !record(r)||
    r.kind!==row.kind||
    !accountReceipt(r,identity)||
    !Number.isSafeInteger(r.order)||
    r.order<1||
    orders.has(r.order))
    fail('Invalid account Market receipt.');
   orders.add(r.order);
   if(r.kind==='kit'){
    fields(r,['kind','order','owner','kitId','mediaIds'],'kit receipt');
    if(!same(checkedOwner(r.owner),identity)||
     !/^([a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})$/i.test(r.kitId)||
     !Array.isArray(r.mediaIds)||
     r.mediaIds.length>4||
     new Set(r.mediaIds).size!==r.mediaIds.length||
     r.mediaIds.some(id=>typeof id!=='string'||!/^([a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})$/i.test(id)))
     fail('Invalid kit receipt.');
   }else if(r.kind==='feature'){
    fields(r,['kind','order','owner','feature','applications','devicePreferences'],'scene receipt');
    if(!same(checkedOwner(r.owner),identity)||r.feature!=='scene-themes'||r.devicePreferences!==false)fail('Device feature choices cannot be restored from an account backup.');
    const checked=sceneHistory(r);
    validateUndoValues(data,checked.receipt.applications);
   }else{
    fields(r,['kind','order','key','changes','containers'],'course artwork receipt');
    if(r.key!==accountKey(identity)||!Array.isArray(r.changes)||r.changes.length>4000||!Array.isArray(r.containers)||r.containers.length>2000)fail('Invalid artwork receipt.');
    const seen=new Set(),path=p=>Array.isArray(p)&&(p.length===1&&['overviewArt','themeArt'].includes(p[0])||p.length===2&&p[0]==='coursePrefs'&&/^\d+$/.test(p[1]));
    for(const c of r.changes){
     fields(c,['path','key','beforeOwn','before','after'],'artwork undo');
     const id=JSON.stringify([c.path,c.key]);
     if(!path(c.path)||
      !['bannerArt','cardArt','backgroundArt','borderArt','titleArt','iconArt','bannerFit','bannerPosition'].includes(c.key)||
      typeof c.beforeOwn!=='boolean'||
      own(c,'before')!==c.beforeOwn||
      !own(c,'after')||
      seen.has(id))
      fail('Invalid artwork undo path.');
     seen.add(id);
     for(const field of ['before','after'])
      if(own(c,field)){
       const probe=clone(data);
       at(probe.settings,c.path,true)[c.key]=clone(c[field]);
       root.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data:probe});
      }
    }
    const containers=new Set();
    for(const c of r.containers){
     fields(c,['path','existed'],'artwork container');
     const id=JSON.stringify(c.path);
     if(!path(c.path)||typeof c.existed!=='boolean'||containers.has(id)||!r.changes.some(change=>same(change.path,c.path)))fail('Invalid artwork container.');
     containers.add(id);
    }
   }
  }
  if(Object.keys(out.receipts).some(id=>!own(out.rows,id)))fail('Incomplete Market backup.');return out;
 }
 async function exportAccountBackup(options={}){
  const identity=optionsOwner(options);if(!worker()){const reply=await remote('market-local',{op:'backup',owner:identity});return reply.market;}
  const saved=await registry(),rows={},receipts={};for(const [id,receipt]of Object.entries(saved.receipts))if(accountReceipt(receipt,identity)){
   if(!own(saved.rows,id))fail('Saved Market receipt is incomplete.');rows[id]=clone(saved.rows[id]);receipts[id]=clone(receipt);
   if(receipt.kind==='feature'){delete receipts[id].previous;delete receipts[id].preferences;receipts[id].devicePreferences=false;}
  }
  if(!Object.keys(rows).length)return;
  const data=options.store?.get?.()||
   root.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data:(await local().get(accountKey(identity)))[accountKey(identity)]||{}});
  return cleanMarketBackup({version:1,rows,receipts},identity,data);
 }
 function remapMedia(value,mapping){
  if(Array.isArray(value))return value.map(v=>remapMedia(v,mapping));
  if(!record(value))return value;
  return Object.fromEntries(Object.entries(value).map(([key,v])=>
   [
    key,
    key==='mediaId'&&mapping.mediaIds[v]?
     mapping.mediaIds[v]:
     key==='kitId'&&mapping.kitIds[v]?mapping.kitIds[v]:key==='mediaIds'&&Array.isArray(v)?v.map(id=>mapping.mediaIds[id]||id):remapMedia(v,mapping)
   ]));
 }
 function mergeMarketBackup(current,backup,identity,docs){
  const next=clone(current);for(const [id,receipt]of Object.entries(next.receipts))if(accountReceipt(receipt,identity)){delete next.receipts[id];delete next.rows[id];}
  for(const [id,original]of Object.entries(backup.rows)){
   let key=id;
   while(own(next.rows,key)||docs.some(doc=>doc.id===key))key='restored-'+root.crypto.randomUUID();
   const row={...clone(original),id:key};
   if(key!==id)row.catalogueId=original.catalogueId||id;
   next.rows[key]=row;
   next.receipts[key]=clone(backup.receipts[id]);
  }
  if(Object.keys(next.rows).length>50)fail('At most 50 installed Market packs.');return next;
 }
 async function restoreBackup(input,options={}){
  const identity=optionsOwner(options);if(!worker()){
   let conflicts,targetMedia=options.targetMedia;if(sizeOf(input)>66500000)fail('Backup exceeds 66.5 MB.');const backup=typeof input==='string'?JSON.parse(input):input,codec=root.ReserveBackupMedia;
   if(targetMedia===undefined&&codec?.capture)targetMedia=await codec.capture({owner:identity,settings:options.store?.get?.().settings||{}});
   if(backup.media){if(!codec?.capture)fail('Artwork backup support is unavailable. Reload Canvas Harness.');conflicts=root.ReserveMediaReference.backupConflicts(backup.media,targetMedia);}
   return localRequest('restore',{backup,...(targetMedia?{targetMedia}:{}),...(conflicts?{conflicts}:{})},options);
  }
  return exclusive(async()=>{
   if(sizeOf(input)>66500000)fail('Backup exceeds 66.5 MB.');let backup;try{backup=typeof input==='string'?JSON.parse(input):clone(input);}catch{fail('Invalid backup JSON.');}
   let conflicts=options.conflicts;
   if(conflicts!==undefined){
    fields(conflicts,['mediaIds','kitIds'],'media collision hints');
    for(const [key,max]of [['mediaIds',2000],['kitIds',200]])
     if(!Array.isArray(conflicts[key])||
      conflicts[key].length>max||
      new Set(conflicts[key]).size!==conflicts[key].length||
      conflicts[key].some(id=>typeof id!=='string'||!/^([a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})$/i.test(id)))
      fail('Invalid media collision hints.');
   }
   let data=root.ReserveStorage.validateBackup(backup,identity),market=cleanMarketBackup(backup.market,identity,data);const docs=[],ids=new Set(),orders=new Set();
   for(const value of backup.packs||[]){
    const doc=root.ReserveMedia.cleanPackDocument(value);if(ids.has(doc.id))fail('Duplicate pack in backup.');ids.add(doc.id);await validateSource(doc.source,doc.kind);
    if(doc.market){
     const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(doc.source))),n=>n.toString(16).padStart(2,'0')).join('');
     if(hash!==doc.market.sha256)fail('Backup Market source hash mismatch.');
    }
    cleanReceipt(doc.receipt,doc.kind);
    validateUndoValues(data,doc.receipt.applications);
    for(const app of doc.receipt.applications){if(orders.has(app.order))fail('Duplicate pack receipt order.');orders.add(app.order);}
    docs.push(doc);
   }
   for(const receipt of Object.values(market?.receipts||{}))
    if(receipt.kind==='feature')for(const app of receipt.applications){if(orders.has(app.order))fail('Duplicate pack receipt order.');orders.add(app.order);}
   const installed=makeState(data).installed;if(Object.keys(installed).length!==docs.length||docs.some(d=>!same(rowOf(d),installed[d.id])))fail('Backup pack references are incomplete.');
   let decoded;
   if(backup.media!==undefined){
    const codec=root.ReserveBackupMedia;
    if(!codec?.decode)fail('Artwork backup support is unavailable. Reload Canvas Harness.');
    decoded=await codec.decode(backup.media,{settings:data.settings,inspect:root.ReserveMedia.inspectPortable});
   }
   for(const receipt of Object.values(market?.receipts||{}))if(receipt.kind==='kit'){
    const kit=decoded?.kits.find(row=>row.id===receipt.kitId),assets=new Set(decoded?.assets.map(row=>row.asset.mediaId)||[]);
    if(!kit||receipt.mediaIds.some(id=>!assets.has(id)||!root.ReserveMedia.referenced({overviewArt:kit.appearance}).has(id)))fail('Backup Market kit references are incomplete.');
   }
   const references=root.ReserveMediaReference,undoAssets=references.undoMediaReferences(market?.receipts,identity);
   if(decoded)for(const asset of undoAssets)if(!decoded.assets.some(row=>same(row.asset,asset)))fail('Backup undo media is missing or inconsistent.');
   return withTarget(options,async t=>{
    const before=await documents(t.pool),originalRegistry=await registry(),originalAssets=new Map();let stage,targetStage;
    for(const pref of [t.snapshot.settings.themeArt,t.snapshot.settings.overviewArt,...Object.values(t.snapshot.settings.coursePrefs||{})])
     for(const key of references.slots){
      const value=references.asset(pref?.[key]);
      if(!value?.mediaId)continue;
      const asset=references.cleanReference(value,key.slice(0,-3)),previous=originalAssets.get(asset.mediaId);
      if(previous&&!same(previous,asset))fail('Destination media reference metadata conflicts.');
      originalAssets.set(asset.mediaId,asset);
     }
    for(const asset of references.undoMediaReferences(originalRegistry.receipts,identity)){
     const previous=originalAssets.get(asset.mediaId);
     if(previous&&!same(previous,asset))fail('Destination media reference metadata conflicts.');
     originalAssets.set(asset.mediaId,asset);
    }
    try{
     if(options.targetMedia!==undefined&&originalAssets.size){
      const codec=root.ReserveBackupMedia;if(!codec?.decode)fail('Artwork backup support is unavailable. Reload Canvas Harness.');
      const target=await codec.decode(options.targetMedia,{inspect:root.ReserveMedia.inspectPortable}),
       assets=target.assets.filter(row=>originalAssets.has(row.asset.mediaId));
      for(const row of assets)if(!same(row.asset,originalAssets.get(row.asset.mediaId)))fail('Destination media does not match the original account.');
      if(assets.length)targetStage=await t.pool.stageBackup({version:1,assets,kits:[]},{accountWriteLease:t.accountWriteLease,preserveIds:true});
     }
     // These original IDs must remain reservable if account publication fails.
     // A page-supplied, checked copy bridges Canvas-origin IndexedDB to the worker.
     if(originalAssets.size){
      const view=root.ReserveMedia.createStore(identity);
      try{
       for(const [id,asset]of originalAssets){const saved=await view.get(id);if(!saved||!same(saved.asset,asset))fail('Destination media is unavailable. Import this backup from its Canvas page.');}
      }finally{view.close();}
     }
     if(decoded){
      stage=await t.pool.stageBackup(decoded,{accountWriteLease:t.accountWriteLease,conflicts});
      data=remapMedia(data,stage);
      market=market&&remapMedia(market,stage);
      for(let i=0;i<docs.length;i++)docs[i]=remapMedia(docs[i],stage);
     }
     // Legacy backups without an embedded media payload remain usable on the
     // original device, but may never publish dangling references elsewhere.
     for(const id of root.ReserveMedia.referenced(data.settings))
      if(!await t.pool.get(id)){const view=root.ReserveMedia.createStore(identity);try{if(!await view.get(id))fail('Backup media is missing.');}finally{view.close();}}
     for(const receipt of Object.values(market?.receipts||{}))if(receipt.kind==='kit'){
      const kit=(await t.pool.listKits()).find(kit=>kit.id===receipt.kitId);
      if(!kit||receipt.mediaIds.some(id=>!root.ReserveMedia.referenced({overviewArt:kit.appearance}).has(id)))fail('Backup Market kit references are incomplete.');
      for(const id of receipt.mediaIds)if(!await t.pool.get(id))fail('Backup kit media is missing.');
     }
     for(const asset of references.undoMediaReferences(market?.receipts,identity)){
      const saved=await t.pool.get(asset.mediaId);
      if(!saved||!same(saved.asset,asset))fail('Backup undo media is missing.');
     }
     const next=market?mergeMarketBackup(await registry(),market,identity,docs):null;
     await publishLocal(t,before,docs,data,next?{[STORAGE_KEY]:next.rows,[RECEIPTS]:next.receipts}:{},[],undefined,{complete:async()=>{
      await stage?.commit({finalize:false});
      await targetStage?.commit({finalize:false});
      stage?.seal();
      targetStage?.seal();
     }});
     return t.store.get();
    }catch(error){
     let rollback;
     for(const pending of [stage,targetStage])if(pending)try{await pending.rollback();}catch(e){rollback=e;}
     if(rollback)throw Error(error.message+'; media rollback failed: '+rollback.message);
     throw error;
    }
   });
  });
 }
 const api=Object.freeze({STORAGE_KEY,installed,install,remove,installLocal,useLocal,removeLocal,readLocal,exportAccountBackup,restoreBackup});
 root.ReservePacks=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
