'use strict';
/* Shared training/selection boundary. Reserved validation never enters any fitting head. */
const METHOD='short-majority-v1',TARGET=.65,count=line=>String(line||'').trim().split(/\s+/).filter(Boolean).length,isShort=row=>{const n=count(row.line);return n>=1&&n<=4;},isLong=row=>count(row.line)>=9;
const supplemental=row=>String(row.source||'').includes('biscuit-controls-training')||!!row.controlId&&String(row.source||'').includes('biscuit-short-r6-');
function validationSource(source){return /(?:^|[\\/])(?:tests[\\/])?validation(?:[\\/]|$)|biscuit-short-r6-validation|short-v-/i.test(String(source||''));}
function assertFitRows(rows){for(const row of rows){const world=typeof row.world==='string'?row.world:row.world?.base||row.world?.id;if(row.validationOnly||row.trainingPartition==='validation'||validationSource(row.source)||validationSource(world)||validationSource(row.snapshot?.id))throw Error('Reserved short validation is forbidden to fitting');}return rows;}
function mass(rows){let short=0,other=0;for(const row of rows){const weight=row.trainingWeight??1;if(!Number.isFinite(weight)||weight<=0)throw Error('Invalid fitting weight');if(isShort(row))short+=weight;else other+=weight;}return {short,other,share:short/(short+other)||0};}
const enabled=rows=>rows.some(r=>r.shortWeightPolicy===METHOD||String(r.source||'').includes('biscuit-short-r6-train'));
function balanceExamples(examples){
 if(!examples.length)return {short:0,other:0,share:null};let short=0,other=0;for(const ex of examples){if(!Number.isFinite(ex.weight??1)||(ex.weight??1)<=0)throw Error('Invalid example weight');if(ex.shortInput)short+=ex.weight??1;else other+=ex.weight??1;}if(!short)throw Error('Fitting head has no authored short examples');const factor=Math.max(1,TARGET*other/((1-TARGET)*short));for(const ex of examples)if(ex.shortInput)ex.weight=(ex.weight??1)*factor;return {short:short*factor,other,share:short*factor/(short*factor+other)};
}
function balanceHeads(data){const mass={};for(const key of ['action','kind','item','context'])mass[key]=balanceExamples(data[key]);for(const [key,examples]of Object.entries(data.details))mass['detail:'+key]=balanceExamples(examples);Object.defineProperty(data,'shortObjective',{value:{method:METHOD,target:TARGET,heads:mass},enumerable:true});return data;}
function weightRows(rows){
 assertFitRows(rows);if(rows.length&&rows.every(r=>r.shortWeightPolicy===METHOD)){if(mass(rows).share<TARGET-1e-12)throw Error('Short fitting mass lost its majority');return rows;}
 if(rows.some(r=>r.shortWeightPolicy))throw Error('Mixed weighted and unweighted short objective');const before=mass(rows);if(!before.short)throw Error('Short training examples required');const factor=Math.max(1,TARGET*before.other/((1-TARGET)*before.short));
 return rows.map(row=>({...row,trainingWeight:(row.trainingWeight??1)*(isShort(row)?factor:1),shortWeightPolicy:METHOD}));
}
function ambiguityCorrect(label,result){
 if(!label)return true;if(!result||result.action!=='none'||result.next&&result.next.action!=='none')return false;
 const items=result.items||[],allowed=new Set((label.options||[]).map(o=>String(o.itemId))),ids=items.map(item=>String(item.id||item.itemId||''));
 if(ids.length&&(ids.length<2||ids.length>3||ids.some(id=>!allowed.has(id))||new Set(ids).size!==ids.length))return false;
 return /\?|\b(?:which|what (?:would|should)|need (?:a|the|more))\b|(?:^|[.!]\s*)(?:please\s+)?(?:choose|select|name|specify|clarify|tell me|try (?:a|the))\b/i.test(String(result.message||''));
}
function selection(lengths){if(!lengths?.short?.count&&lengths?.short?.count!==undefined)throw Error('Short selection stratum is empty');return .65*(lengths.short?.top1Pct||0)+.35*(lengths.long?.top1Pct||0);}
function gate(baseline,candidate){
 const reasons=[],ratio=(value,n,d)=>value?.[d]?value[n]/value[d]:null;
 for(const name of ['short','long']){const a=baseline?.[name],b=candidate?.[name];if(!a||!b){reasons.push(name+' metrics missing');continue;}for(const key of ['top1Pct','actionAccuracyPct'])if(!Number.isFinite(a[key])||!Number.isFinite(b[key])||b[key]<a[key]||name==='short'&&key==='top1Pct'&&b[key]===a[key])reasons.push(name+' '+key+' gate');
  for(const key of ['top3Pct'])if(Number.isFinite(a[key])&&(!Number.isFinite(b[key])||b[key]<a[key]))reasons.push(name+' '+key+' gate');if(Number.isFinite(a.wrongToAIPct)&&(!Number.isFinite(b.wrongToAIPct)||b.wrongToAIPct>a.wrongToAIPct))reasons.push(name+' wrong-to-AI gate');
  for(const [label,x,y,n,d]of [['strict fields',a.byStep?.fields,b.byStep?.fields,'correct','eligible'],['routing',a.byStep?.routing,b.byStep?.routing,'correct','eligible'],['AI kind',a.byStep?.kind,b.byStep?.kind,'aiCorrect','aiEligible'],['compound',a.compound,b.compound,'correct','eligible'],['episode',a.episodes,b.episodes,'correct','eligible']]){const before=ratio(x,n,d),after=ratio(y,n,d);if(before!==null&&(after===null||after<before))reasons.push(name+' '+label+' gate');}
  const x=a.byStep?.context,y=b.byStep?.context;for(const [label,denominator]of [['precision','falsePositives'],['recall','falseNegatives']])if(x&&x.truePositives+x[denominator]>0&&(!y||y.truePositives+y[denominator]===0||y.truePositives/(y.truePositives+y[denominator])<x.truePositives/(x.truePositives+x[denominator])))reasons.push(name+' context '+label+' gate');
  if(a.subjectRelationship?.count&&(!b.subjectRelationship?.count||b.subjectRelationship.top1Pct<a.subjectRelationship.top1Pct))reasons.push(name+' subject relationship gate');
 }
 return {ok:!reasons.length,reasons,objective:selection(candidate),shortWeight:.65};
}
module.exports={METHOD,TARGET,count,isShort,isLong,supplemental,validationSource,assertFitRows,mass,enabled,balanceExamples,balanceHeads,weightRows,ambiguityCorrect,selection,gate};
