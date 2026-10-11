/* Canvas Harness — Quick upload review and atomic artwork transactions.
 * Browser: CanvasHarnessQuickUpload; CommonJS: require('./quick-upload.js').
 * create({store,getCourses,onChange?}) requires the existing account-bound store
 * (get/update). getCourses returns the current ALL courses, including hidden
 * ones. Review accepts an async getter; committing requires a synchronous
 * current list inside the store's synchronous mutator, so membership cannot be
 * checked against a stale list while a transaction is queued.
 *
 * state and onChange(state) are detached snapshots. review(text) -> Promise<state>;
 * choose(key,id|null), includeGroup(key,bool), includePart(index,bool), reset()
 * -> state. Unknown keys/ids throw; selection/reset/review are inert during a
 * write. apply()/undo() -> Promise<{ok,error?,applied,notApplied,unresolved,
 * conflicts?}>. Parse/validation/storage failures are returned, not thrown.
 *
 * Undo is one in-memory receipt for the last successful pack. Any changed
 * affected field causes an atomic undo-conflict; unrelated fields survive.
 * Failed apply/undo and reset/review retain that receipt. destroy() invalidates
 * pending work and stops notifications. A storage write already dispatched
 * cannot be cancelled: it completes atomically, without reviving destroyed UI.
 * Names/raw pack SVGs are untrusted data. Only part.asset has passed importSVG;
 * previews must use ReserveCustomArt.render or an isolated image, never HTML.
 */
(function(root){
 'use strict';
 const common=typeof module==='object'&&module.exports;
 const Pack=root.CanvasHarnessPack||(common?require('./quick-pack.js'):null);
 const Art=root.ReserveCustomArt||(common?require('./custom-art.js'):null);
 const Custom=root.ReserveCustomization||(common?require('./customization-model.js'):null);
 const clone=value=>structuredClone(value);
 const own=(value,key)=>value!=null&&Object.hasOwn(value,key);
 const bytes=text=>new TextEncoder().encode(text).length;
 const issue=(code,message)=>({code,message});
 function failure(code,message,extra={}){return Object.assign(new Error(message),{code,...extra});}
 function same(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>own(b,k)&&same(a[k],b[k]));
 }
 // Numeric Canvas ids are the only keys that may reach coursePrefs. Match labels
 // retain accents and follow the reference parser; grade/task fields never enter
 // review state. Map is used for all untrusted target names.
 function normalizeCourses(courses,settings={}){
  if(!Array.isArray(courses))throw failure('courses-unavailable','The current course list is unavailable. Review again when it has loaded.');
  return courses.filter(c=>c&&/^\d+$/.test(String(c.id))).map(c=>{
   const id=String(c.id),pref=own(settings.coursePrefs,id)?settings.coursePrefs[id]:null;
   const originalName=String(c.originalName??c.name??'');
   return {id,originalName,name:String(pref?.name||c.name||originalName),code:String(c.code??c.course_code??'')};
  });
 }
 function fingerprint(courses){
  return JSON.stringify(courses.map(c=>[c.id,c.originalName,c.name,c.code]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 }
 function groupKey(target,index){
  if(!target)return 'invalid:'+index;
  if(target.type!=='course')return target.type;
  return target.id?'course:#'+target.id:'course:'+Pack.normalizeName(target.names?.[0]);
 }
 function grouped(parts,courses){
  const byKey=new Map();
  for(const part of parts){
   part.groupKey=groupKey(part.target,part.index);
   let group=byKey.get(part.groupKey);
   if(!group){group={key:part.groupKey,target:clone(part.target),included:true,partIndexes:[],parts:[],courseId:null,course:null,candidates:[],status:'invalid'};byKey.set(group.key,group);}
   group.partIndexes.push(part.index);group.parts.push(part);
   if(group.target?.type==='course')group.target.names=[...new Set([...group.target.names,...part.target.names])];
  }
  for(const group of byKey.values()){
   if(!group.target)continue;
   if(group.target.type!=='course'){group.status=group.target.type;continue;}
   const match=Pack.matchCourse(group.target,courses);
   group.status=match.status;group.candidates=match.candidates||[];
   if(match.status==='matched'){group.course=match.course;group.courseId=match.course.id;}
  }
  return [...byKey.values()];
 }
 function appearance(settings,target){
  return target.type==='overview'?(settings.overviewArt||{}):(own(settings.coursePrefs,target.courseId)?settings.coursePrefs[target.courseId]:{})||{};
 }
 function putAppearance(settings,target){
  if(target.type==='overview')return settings.overviewArt||(settings.overviewArt={});
  const prefs=settings.coursePrefs||(settings.coursePrefs={});
  if(!own(prefs,target.courseId))prefs[target.courseId]={};
  return prefs[target.courseId];
 }
 const slotAddress=(target,key)=>JSON.stringify([target.type,target.courseId||'',key]);
 function budget(settings){
  const total=[settings.overviewArt,...Object.values(settings.coursePrefs||{})].reduce((sum,pref)=>sum+Custom.artKeys.reduce((n,key)=>n+bytes(pref?.[key]?.svg||''),0),0);
  try{Custom.checkBudget(settings);return {ok:true,bytes:total,limit:Art.limits.totalBytes};}
  catch(error){return {ok:false,bytes:total,limit:Art.limits.totalBytes,error:issue('budget-exceeded',error.message)};}
 }
 // Pure candidate construction: all-course parts first, other parts in pack
 // order. Record the final owner of EACH field (including banner options), so
 // overriding a banner without options leaves earlier/current options intact.
 function plan(settings,parsed,parts,groups,courses){
  const candidate=clone(settings),byGroup=new Map(groups.map(g=>[g.key,g])),owners=new Map(),touched=new Map(),outcomes=[],notApplied=[];
  const unresolved=groups.filter(g=>g.included&&g.target?.type==='course'&&!g.courseId&&g.parts.some(p=>p.included&&!p.errors.length)).map(g=>({key:g.key,target:clone(g.target),status:g.status,candidates:clone(g.candidates),partIndexes:[...g.partIndexes]}));
  const reason=part=>{
   const group=byGroup.get(part.groupKey);
   if(!group.included)return 'excluded-group';
   if(!part.included)return 'excluded-part';
   if(part.errors.length)return part.errors[0].code;
   if(!part.asset)return 'invalid-svg';
   if(group.target.type==='course'&&!group.courseId)return 'unresolved-target';
   if(group.target.type==='every-course'&&!courses.length)return 'no-courses';
   return null;
  };
  for(const part of parts){
   part.targets=[];part.replaces=false;part.replacement=false;
   const why=reason(part);
   if(why){part.status=why==='replaced'?'replaced':why==='unresolved-target'?'unresolved':why.startsWith('excluded')?'excluded':'error';notApplied.push({index:part.index,slot:part.slot,reason:why});}
   else part.status='ready';
  }
  const ordered=[...parts.filter(p=>p.target?.type==='every-course'),...parts.filter(p=>p.target?.type!=='every-course')];
  for(const part of ordered){
   if(reason(part))continue;
   const group=byGroup.get(part.groupKey);
   const destinations=group.target.type==='overview'?[{type:'overview'}]:group.target.type==='every-course'?[...new Set(courses.map(c=>c.id))].map(courseId=>({type:'course',courseId})):[{type:'course',courseId:group.courseId}];
   const key=Pack.SLOT_KEYS[part.slot];
   for(const target of destinations){
    const before=appearance(settings,target),pref=putAppearance(candidate,target);
    const outcome={index:part.index,slot:part.slot,...target,replaces:!!before[key],status:'ready',fields:[],replacedBy:null};
    part.targets.push(outcome);outcomes.push(outcome);part.replaces ||=outcome.replaces;part.replacement=part.replaces;
    const values={[key]:part.asset};
    if(part.slot==='banner'){if(part.fit)values.bannerFit=part.fit;if(part.position)values.bannerPosition=part.position;}
    for(const [field,value] of Object.entries(values)){
     const address=slotAddress(target,field);
     if(!touched.has(address))touched.set(address,{...target,key:field,beforeOwn:own(before,field),before:clone(before[field])});
     pref[field]=clone(value);owners.set(address,outcome);
    }
   }
  }
  const applied=[];
  for(const outcome of outcomes){
   const artKey=Pack.SLOT_KEYS[outcome.slot],fields=[artKey,...(outcome.slot==='banner'?['bannerFit','bannerPosition']:[])];
   outcome.fields=fields.filter(key=>owners.get(slotAddress(outcome,key))===outcome);
   const finalArt=owners.get(slotAddress(outcome,artKey));
   if(finalArt!==outcome){outcome.replacedBy=finalArt.index;notApplied.push({index:outcome.index,slot:outcome.slot,type:outcome.type,...(outcome.courseId?{courseId:outcome.courseId}:{}),reason:'replaced',replacedBy:finalArt.index});}
   outcome.status=outcome.fields.includes(artKey)?'ready':outcome.fields.length?'partial':'replaced';
   if(outcome.fields.length)applied.push({index:outcome.index,slot:outcome.slot,type:outcome.type,...(outcome.courseId?{courseId:outcome.courseId}:{}),fields:[...outcome.fields],replaces:outcome.replaces});
  }
  for(const part of parts){
   if(!part.targets.length)continue;
   const statuses=part.targets.map(t=>t.status);
   part.status=statuses.every(s=>s==='ready')?'ready':statuses.every(s=>s==='replaced')?'replaced':'partial';
  }
  for(const skipped of parsed.skipped)notApplied.push({index:skipped.index,kind:skipped.kind,reason:skipped.reason});
  notApplied.sort((a,b)=>a.index-b.index);
  const changes=[...touched.values()].map(change=>({...change,after:clone(appearance(candidate,change)[change.key])})).filter(change=>!change.beforeOwn||!same(change.before,change.after));
  return {settings:candidate,changes,applied,notApplied,unresolved,budget:budget(candidate)};
 }
 function create({store,getCourses,onChange}={}){
  if(!Pack||!Art||!Custom)throw Error('Quick upload modules are unavailable. Reload Canvas Harness.');
  if(typeof store?.get!=='function'||typeof store?.update!=='function'||typeof getCourses!=='function')throw Error('Quick upload requires an account store and a current course getter.');
  let revision=0,destroyed=false,busy=false,receipt=null,baseSettings=null,reviewFingerprint=null,invalidated=null;
  const blank=()=>({phase:'idle',name:'',parsed:null,parts:[],groups:[],courses:[],warnings:[],errors:[],error:null,budget:null,canApply:false,canUndo:!!receipt,unresolved:[],report:null});
  let state=blank();
  const snapshot=()=>clone(state);
  function emit(){state.canUndo=!!receipt&&!busy&&!destroyed;if(!destroyed&&typeof onChange==='function'){try{onChange(snapshot());}catch{/* A UI listener cannot change a storage transaction's result. */}}return snapshot();}
  function current(token){if(destroyed)throw failure('destroyed','Quick upload has been closed.');if(token!==revision)throw failure('stale','This review has been superseded.');}
  function recompute(){
   state.errors=[...(state.parsed?.errors||[])];
   if(!state.parsed?.ok||baseSettings===null){if(invalidated)state.errors.push(invalidated);state.canApply=false;state.budget=null;state.unresolved=[];return;}
   const candidate=plan(baseSettings,state.parsed,state.parts,state.groups,state.courses);
   state.budget=candidate.budget;state.unresolved=candidate.unresolved;
   if(!candidate.budget.ok)state.errors.push(candidate.budget.error);
   if(invalidated)state.errors.push(invalidated);
   state.canApply=!busy&&!destroyed&&!state.errors.length&&!candidate.unresolved.length&&candidate.applied.length>0&&state.phase==='review';
  }
  function failResult(error,extra={}){
   return {ok:false,error:issue(error.code||'storage-error',error.message||String(error)),applied:[],notApplied:[],unresolved:clone(state.unresolved),...extra};
  }
  function rejected(candidate,error){
   const result=failResult(error);
   if(candidate){result.notApplied=clone([...candidate.notApplied,...candidate.applied.map(p=>({...p,reason:result.error.code}))]).sort((a,b)=>a.index-b.index);result.unresolved=clone(candidate.unresolved);}
   return result;
  }
  function guardWrite(){if(destroyed)return failResult(failure('destroyed','Quick upload has been closed.'));if(busy)return failResult(failure('busy','A Quick upload transaction is already running.'));return null;}
  async function review(text){
   if(destroyed||busy)return snapshot();
   const token=++revision;invalidated=null;baseSettings=null;reviewFingerprint=null;state=blank();state.phase='reviewing';
   // Parser enforces type/UTF-8/part limits before any lookup or SVG work.
   state.parsed=Pack.parse(text);state.name=state.parsed.name;state.warnings=clone(state.parsed.warnings);emit();
   if(!state.parsed.ok){if(token===revision&&!destroyed){state.phase='review';recompute();emit();}return snapshot();}
   try{
    const rawCourses=await getCourses();current(token);
    baseSettings=clone(store.get().settings);state.courses=normalizeCourses(rawCourses,baseSettings);reviewFingerprint=fingerprint(state.courses);
    state.parts=state.parsed.parts.map(parsedPart=>{
     const part={...clone(parsedPart),included:true,asset:null};
     if(part.svg!==null){try{part.asset=Art.importSVG(part.svg,part.name);}catch(error){part.errors.push(issue('invalid-svg',error.message));}}
     return part;
    });
    state.groups=grouped(state.parts,state.courses);state.phase='review';recompute();emit();
   }catch(error){if(token===revision&&!destroyed){invalidated=issue(error.code||'review-error',error.message);state.phase='review';state.error=invalidated;state.errors=[invalidated];state.canApply=false;emit();}}
   return snapshot();
  }
  function editable(){return !destroyed&&!busy&&state.phase==='review'&&state.parsed?.ok&&baseSettings!==null;}
  function selectGroup(key){const group=state.groups.find(g=>g.key===key);if(!group)throw failure('invalid-group','Unknown Quick upload target.');return group;}
  function choose(key,courseId){
   if(!editable())return snapshot();
   const group=selectGroup(key);if(group.target?.type!=='course')throw failure('invalid-choice','Only a named course target can be changed.');
   const id=courseId==null?null:String(courseId),found=id===null?[]:state.courses.filter(c=>c.id===id);
   if(id!==null&&(!/^\d+$/.test(id)||found.length!==1))throw failure('invalid-choice','Choose one current Canvas course.');
   group.courseId=id;group.course=found[0]||null;group.status=id===null?'none':'chosen';state.error=null;recompute();return emit();
  }
  function includeGroup(key,included){if(!editable())return snapshot();selectGroup(key).included=!!included;state.error=null;recompute();return emit();}
  function includePart(index,included){
   if(!editable())return snapshot();const part=state.parts.find(p=>p.index===Number(index));
   if(!part)throw failure('invalid-part','Unknown Quick upload piece.');part.included=!!included;state.error=null;recompute();return emit();
  }
  // A synchronous fresh getter is necessary here because ReserveStorage.update
  // does not await its mutator. Fail safely instead of committing a Promise's
  // earlier cached course list. Async reviews remain useful during loading.
  function transactionCourses(settings){
   const courses=getCourses();
   if(courses&&typeof courses.then==='function'){Promise.resolve(courses).catch(()=>{});throw failure('courses-unavailable','The current course getter must be synchronous when confirming a pack.');}
   return normalizeCourses(courses,settings);
  }
  async function apply(){
   const guarded=guardWrite();if(guarded)return guarded;
   if(state.phase!=='review'||!state.parsed?.ok||!baseSettings)return failResult(failure('no-review','Review a valid pack before confirming it.'));
   if(state.unresolved.length)return rejected(plan(baseSettings,state.parsed,state.parts,state.groups,state.courses),failure('unresolved-target','Choose a course for each included target, or uncheck that target before applying.'));
   if(!state.canApply)return rejected(plan(baseSettings,state.parsed,state.parts,state.groups,state.courses),state.errors[0]||failure('nothing-to-apply','There are no selected, resolved artwork pieces to apply.'));
   const token=revision,selection=clone({parsed:state.parsed,parts:state.parts,groups:state.groups}),expected=reviewFingerprint;
   busy=true;state.phase='applying';state.canApply=false;state.error=null;emit();let candidate;
   try{
    await store.update(next=>{
     current(token);
     const courses=transactionCourses(next.settings);
     if(fingerprint(courses)!==expected)throw failure('courses-changed','Your courses or their matching names changed. Review the pack again before applying it.');
     candidate=plan(next.settings,selection.parsed,selection.parts,selection.groups,courses);
     if(candidate.unresolved.length)throw failure('unresolved-target','Choose a course for each included target, or uncheck that target before applying.');
     if(!candidate.budget.ok)throw failure('budget-exceeded',candidate.budget.error.message);
     if(!candidate.applied.length)throw failure('nothing-to-apply','No artwork can be applied to the current courses.');
     // Only art and explicit banner options change. Never replace settings or
     // the account data object, and never touch titleArt.
     for(const change of candidate.changes)putAppearance(next.settings,change)[change.key]=clone(change.after);
    });
    receipt=candidate.changes.length?clone(candidate.changes):null;
    const result={ok:true,applied:clone(candidate.applied),notApplied:clone(candidate.notApplied),unresolved:clone(candidate.unresolved)};
    if(!destroyed&&token===revision){state.parts=selection.parts;state.groups=selection.groups;state.report=clone(result);state.phase='applied';state.budget=candidate.budget;state.error=null;state.errors=[];state.canApply=false;}
    return result;
   }catch(error){
    const result=rejected(candidate||plan(baseSettings,selection.parsed,selection.parts,selection.groups,state.courses),error);
    if(!destroyed&&token===revision){state.phase='review';state.error=clone(result.error);
     if(['courses-changed','courses-unavailable','budget-exceeded'].includes(result.error.code))invalidated=clone(result.error);
     recompute();state.report=clone(result);
    }
    return result;
   }finally{busy=false;if(!destroyed&&token===revision){recompute();emit();}}
  }
  async function undo(){
   const guarded=guardWrite();if(guarded)return guarded;
   if(!receipt)return failResult(failure('nothing-to-undo','There is no successful pack to undo.'));
   // Undo cancels an in-progress review, but never another write.
   const token=++revision,changes=clone(receipt),previousPhase=state.phase;
   busy=true;state.phase='undoing';state.canApply=false;state.error=null;emit();
   try{
    await store.update(next=>{
     current(token);
     const conflicts=changes.filter(change=>{const pref=appearance(next.settings,change);return !own(pref,change.key)||!same(pref[change.key],change.after);}).map(({type,courseId,key})=>({type,...(courseId?{courseId}:{}),key}));
     if(conflicts.length)throw failure('undo-conflict','Artwork or banner options changed after the pack. Undo was not applied.',{conflicts});
     const candidate=clone(next.settings);
     for(const change of changes){const pref=putAppearance(candidate,change);if(change.beforeOwn)pref[change.key]=clone(change.before);else delete pref[change.key];}
     const total=budget(candidate);if(!total.ok)throw failure('budget-exceeded',total.error.message);
     for(const change of changes){const pref=putAppearance(next.settings,change);if(change.beforeOwn)pref[change.key]=clone(change.before);else delete pref[change.key];}
    });
    receipt=null;const result={ok:true,applied:changes.map(({type,courseId,key})=>({type,...(courseId?{courseId}:{}),key})),notApplied:[],unresolved:[]};
    if(!destroyed&&token===revision){baseSettings=null;reviewFingerprint=null;invalidated=null;state=blank();state.phase='undone';state.report=clone(result);}
    return result;
   }catch(error){const result=failResult(error,error.conflicts?{conflicts:error.conflicts}:{});if(!destroyed&&token===revision){state.phase=previousPhase==='reviewing'?'idle':previousPhase;state.error=clone(result.error);state.report=clone(result);}return result;}
   finally{busy=false;if(!destroyed&&token===revision){recompute();emit();}}
  }
  function reset(){if(destroyed||busy)return snapshot();++revision;baseSettings=null;reviewFingerprint=null;invalidated=null;state=blank();return emit();}
  function destroy(){if(destroyed)return;++revision;destroyed=true;state=blank();state.phase='destroyed';state.canUndo=false;onChange=null;}
  return {get state(){return snapshot();},review,choose,includeGroup,includePart,apply,undo,reset,destroy};
 }
 const api=Object.freeze({create,normalizeCourses,groupKey});root.CanvasHarnessQuickUpload=api;if(common)module.exports=api;
})(globalThis);
