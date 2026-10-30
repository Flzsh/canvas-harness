/* Shared learned-context admission, exact top-three ordering and threshold policy. */
(function(root){
 'use strict';
 const list=value=>Array.isArray(value)?value:[],
  id=value=>String(value??''),
  privateKinds=new Set(['grade','feedback','course-grade']),
  nonMaterial=new Set(['setting','feature','tab','home-module','action','plan-block','market-item','reminder']),
  load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null);
 function enabled(features={}){
  const value=features?.learnedContext;
  if(value===undefined||value===false)return false;
  if(value!==true)throw new TypeError('features.learnedContext must be a boolean');
  return true;
 }
 function uiReferenceEnabled(features={}){
  if(!Object.hasOwn(features,'uiSourceReference'))return false;
  const value=features.uiSourceReference;
  if(typeof value!=='boolean')throw new TypeError('features.uiSourceReference must be a boolean');
  if(value&&features.learnedContext!==true)throw new TypeError('UI source reference requires learned context');
  return value;
 }
 const grades=s=>s.showGrades!==false&&s.settings?.showGrades!==false&&s.privacy?.grades!==false&&(s.showGrades===true||s.settings?.showGrades===true),
  feedback=s=>s.teacherFeedback!==false&&s.settings?.teacherFeedback!==false&&s.privacy?.teacherFeedback!==false&&s.privacy?.feedback!==false;
 function privacySafe(row,s){
  if(!row||typeof row!=='object')return false;
  const privateRow=privateKinds.has(row.kind)||row.gradeAccess===true;
  return (!privateRow||grades(s))&&(!(['grade','feedback'].includes(row.kind)||row.gradeAccess===true)||feedback(s));
 }
 function materialText(row){return privateKinds.has(row.kind)||row.gradeAccess===true?'':String(row.text??row.body??row.description??row.instructions??'');}
 function material(row,text){
  return !!id(row.id)&&
   typeof row.kind==='string'&&
   !!row.kind&&
   typeof row.title==='string'&&
   !!row.title.trim()&&
   !nonMaterial.has(row.kind)&&
   row.available!==false&&
   row.unavailable!==true&&
   row.loaded!==false&&
   row.placeholder!==true&&
   text.trim().length>0;
 }
 function prepare(input,s={},session={},fullRegistryEntries=[],kind='ask',features={}){
  const featureRows=list(fullRegistryEntries).filter(row=>privacySafe(row,s)),result=candidates=>{
   const value={featureRows,candidates};
   if(features.conversationEvidence===true){
    const Learn=load('ReserveBiscuitLearn','./biscuit-learn.js');
    if(typeof Learn?.sourceInput!=='function')throw new Error('Conversation source feature binder unavailable');
    value.featureInput=Learn.sourceInput(input,s,session,featureRows,features);
   }
   else if(Object.hasOwn(features,'conversationEvidence')&&typeof features.conversationEvidence!=='boolean')throw new TypeError('features.conversationEvidence must be a boolean');
   return value;
  };
  if(!String(input??'').trim()||s.ai===false)return result([]);
  const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js');
  if(typeof Selection?.sourceScope!=='function'||typeof Selection?.sourceExcluded!=='function')throw new Error('Learned context exclusion policy unavailable');
  const scope=Selection.sourceScope(input,featureRows,s,session);
  if(typeof scope?.excluded?.has!=='function')throw new Error('Learned context exclusion scope unavailable');
  /* Positive/active-course hints stay learned evidence. Only explicit negative scope gates
     candidates. Every material role can be scored for every Help condition. */
  const excluded=typeof Selection.sourceExcluder==='function'?Selection.sourceExcluder(input,s):row=>Selection.sourceExcluded(input,row,s),candidates=[],seen=new Map();
  for(const row of featureRows){
   if(!material(row,materialText(row))||scope.excluded.has(id(row.courseId))||excluded(row))continue;
   const key=id(row.id);
   if(seen.has(key)){if(seen.get(key)!==row)throw new Error('Ambiguous learned context source ID');continue;}
   seen.set(key,row);
   candidates.push(row);
  }
  return result(candidates);
 }
 const lexical=(a,b)=>a<b?-1:a>b?1:0;
 function compare(a,b){
  return b.score-a.score||
   lexical(id(a.row.kind),id(b.row.kind))||
   lexical(id(a.row.courseId),id(b.row.courseId))||
   lexical(id(a.row.id),id(b.row.id))||
   (a.ordinal??0)-(b.ordinal??0);
 }
 function select(topScores,{logitThreshold,limit=3}={}){
  if(typeof logitThreshold!=='number'||Number.isNaN(logitThreshold)||!Number.isInteger(limit)||limit<0)return [];
  return list(topScores).filter(value=>Number.isFinite(value.score)&&value.score>=logitThreshold).sort(compare).slice(0,Math.min(3,limit));
 }
 /* Fixed source-bound method version: bump for any admission/order/selection change.
    Parent provenance hashes bind the actual source; the browser never reads or hashes files. */
 const policy=Object.freeze({schemaVersion:1,id:'biscuit-admitted-material-context',version:'1.1.0',maxSources:3,topKInvariant:true,prepare,compare,select});
 function threshold(thresholds={}){
  if(Object.hasOwn(thresholds,'contextLogit'))return typeof thresholds.contextLogit==='number'&&Number.isFinite(thresholds.contextLogit)?thresholds.contextLogit:null;
  const value=thresholds.context;
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)return null;
  return value===0?-Infinity:value===1?Infinity:Math.log(value/(1-value));
 }
 /* Navigation is a separate opt-in decision. It never changes context admission,
    calibration, feature universes or prompts. Only the current user request may
    claim reference/container ownership. Historical text arrives exclusively via
    prepare's Learn.sourceInput projection, and is used only for lexical evidence. */
 const uiStop=new Set('explain explanation understand question answer summary summarize summarise shorter longer paragraph sentence original example practice general different simple please could would using think there these those something makes means help prepare create generate write rewrite revise improve outline notes flashcards reading material source loaded selected current previous earlier about'.split(' '));
 const sourceKey=row=>id(row.kind)+'\0'+id(row.courseId)+'\0'+id(row.id);
 function uiReferenceGate(input,featureInput,s,session,featureRows,Learn){
  const Selection=load('ReserveBiscuitSelection','./biscuit-selection.js');
  if(typeof Selection?.reference!=='function'||
   typeof Selection?.sourceIntent!=='function'||
   typeof Selection?.sourceOrder!=='function'||
   typeof Selection?.role!=='function'||
   typeof Learn.content!=='function')
   return null;
  try{
   const reference=Selection.reference(input,featureRows,s,session,{actor:'ai'});if(reference?.explicit&&!reference.row)return null;
   const sources=Selection.sourceOrder(input,featureRows,s,session),intent=Selection.sourceIntent(input);if(intent?.explicit&&!sources?.length)return null;
   const role=Selection.role(input,featureRows,s,session,'open/find',{sources}),seen=new Map(),ambiguous=new Set();
   for(const row of featureRows){const key=id(row.id);if(seen.has(key)&&seen.get(key)!==row)ambiguous.add(key);else seen.set(key,row);}
   const query=[...new Set(Learn.content(featureInput).filter(word=>word.length>=4&&!uiStop.has(word)))],owner=reference?.explicit?sourceKey(reference.row):null;
   const current=reference?.owner==='current'&&!reference.explicit?reference.row:null,
    currentKey=current?sourceKey(current):null,
    currentText=Selection.referenceText?.(input)||input,
    currentQuery=[...new Set(Learn.content(currentText).filter(word=>word.length>=4&&!/^(?:explain|please|could|would|question|answer|understand|something|general|idea)$/.test(word)))],
    currentWords=current?new Set(Learn.content(current.title+' '+materialText(current))):null,
    currentGrounded=!!current&&( /\b(?:this|that|these|those|it|its|selected|current|loaded)\b/i.test(currentText)||currentQuery.filter(word=>currentWords.has(word)).length>=2);
   const accept=(row,x)=>{
    if(ambiguous.has(id(row.id))||owner&&sourceKey(row)!==owner)return false;
    if(role&&(!list(role.kinds).includes(Selection.kindOf?.(row)||row.kind)||role.test&&!role.test(row)||role.ids?.size&&!role.ids.has(id(row.id))))return false;
    if(owner||currentGrounded&&sourceKey(row)===currentKey)return true;
    /* These t:/d: features are exact title/body hits already computed by Learn.
       Page/last/alias/course state, fuzzy similarity and a large model bias are
       insufficient by themselves. Two distinct content words are required. */
    let hits=0;for(const word of query)if(x['t:'+word]>0||x['d:'+word]>0)if(++hits>=2)return true;return false;
   };accept.currentKey=currentGrounded?currentKey:null;return accept;
  }catch{return null;}
 }
 function scoreAndSelect(input,s={},session={},options={}){
  const useUI=uiReferenceEnabled(options.features),itemModel=options.uiReferenceModel;
  const empty=reason=>({selected:[],featureRows:[],admitted:0,scored:0,reason}),
   {Learn,model,kind='ask',owned,ranked=[]}=options,
   logitThreshold=threshold(options.thresholds);
  if(!model||typeof model.weights!=='object'||model.weights===null||Array.isArray(model.weights)||logitThreshold===null)return empty('model-or-threshold-unavailable');
  if(typeof Learn?.score!=='function'||typeof Learn?.itemFeatures!=='function'||typeof Learn?.context!=='function')return empty('scoring-unavailable');
  let prepared;
  try{prepared=policy.prepare(input,s,session,options.rows,kind,options.features);}catch{return empty('admission-unavailable');}
  const {featureRows,candidates}=prepared,featureInput=Object.hasOwn(prepared,'featureInput')?prepared.featureInput:input,featureView=Object.hasOwn(prepared,'featureInput')?{featureInput}:{};
  if(!candidates.length)return {...empty('no-admitted-material'),featureRows,...featureView};
  const reused=owned?owned.reuse(ranked,featureInput,s,session,featureRows,'ai'):Learn.reuseRank?.(ranked,featureInput,s,session,featureRows,'ai'),
   context=reused?.prepared||
    Object.assign(Learn.prepareContext?.(featureInput,s,session,featureRows)||Learn.context(featureInput,s,session,featureRows),{action:'ai'}),
   top=[];
  let scored=0;
  /* No second itemFeatures/context pass and no retained bag cache. Item scoring
     is limited to grounded candidates, and stops as soon as context admits any
     source. Some prefix work is possible for nonempty context; measure it. */
  let possible=useUI&&typeof options.onUIReference==='function'&&itemModel&&typeof itemModel.weights==='object'&&itemModel.weights!==null&&!Array.isArray(itemModel.weights),
   gate,
   best=null,
   runner=-Infinity,
   preferred=null;
  for(let ordinal=0;ordinal<candidates.length;ordinal++){
   const row=candidates[ordinal],x=reused?.features(row)||Learn.itemFeatures(featureInput,row,s,session,reused?.rows||featureRows,context,true);let score;
   if(possible&&typeof Learn.scoreWithHelp==='function')
    score=Learn.scoreWithHelp(model,x,kind,row);
   else{const cx=possible?{...x}:x;cx['help:'+kind]=1;cx['help:'+kind+'|'+row.kind]=1;score=Learn.score(model,cx,true);}
   if(!Number.isFinite(score))continue;
   scored++;top.push({row,score,ordinal});top.sort(policy.compare);if(top.length>policy.maxSources)top.pop();
   if(score>=logitThreshold){possible=false;gate=null;best=null;runner=-Infinity;}else if(possible){
    if(gate===undefined)gate=uiReferenceGate(input,featureInput,s,session,featureRows,Learn);if(!gate)possible=false;
    else if(gate(row,x)){
     const itemScore=Learn.score(itemModel,x,true);
     if(Number.isFinite(itemScore)){
      if(gate.currentKey===sourceKey(row))preferred=row;
      if(!best||itemScore>best.score){runner=best?best.score:runner;best={row,score:itemScore};}else runner=Math.max(runner,itemScore);
     }
    }
   }
  }
  const selected=policy.select(top,{logitThreshold,limit:3});
  /* A numerical tie abstains rather than falling through to ID/order sorting.
     This is relative ordering, not calibrated confidence or a probability. */
  if(!selected.length&&preferred)
   options.onUIReference(preferred);
  else if(!selected.length&&best&&(runner===-Infinity||best.score-runner>Number.EPSILON*8*Math.max(1,Math.abs(best.score),Math.abs(runner))))
   options.onUIReference(best.row);
  return {selected,featureRows,...featureView,admitted:candidates.length,scored,reason:top.length?'scored':'no-finite-scores'};
 }
 const api={enabled,uiReferenceEnabled,privacySafe,materialText,material,policy,threshold,scoreAndSelect};
 root.ReserveBiscuitContextSelector=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
