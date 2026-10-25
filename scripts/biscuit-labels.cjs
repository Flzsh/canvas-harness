'use strict';
/* Frozen training-derived vocabulary. No fixture reads, predictions or evaluator dependency. */
const { isDeepStrictEqual }=require('node:util');
const ACTIONS=Object.freeze(['open/find','plan','complete','setting','feature','module','navigate','reminder','note','bookmark','focus','focus-control','ai','chat','none']);
const HELP_KINDS=Object.freeze(['ask','practice','reading','lab','rubric','fixes','notes','steps','outline','message','summary','flashcards']);
const ALIASES=Object.freeze({
 open:'open/find',find:'open/find',search:'open/find',due:'open/find',
 study:'open/find',practice:'open/find',quiz:'open/find',lab:'open/find',reading:'open/find',rubric:'open/find',fixes:'open/find',fix:'open/find',review:'open/find',ready:'open/find',notes:'open/find',inbox:'open/find',
 settings:'setting',appearance:'setting',preset:'setting',quiet:'setting',pet:'setting',undo:'setting',
 features:'feature',skill:'feature',toggle:'feature',play:'navigate',remind:'reminder',routine:'reminder',
 break:'focus-control',stretch:'focus-control','focus-status':'focus-control',pause:'focus-control',resume:'focus-control',stop:'focus-control',
 help:'chat',smalltalk:'chat',greeting:'chat',fallback:'none',unavailable:'none',clarify:'none',clarification:'none',unknown:'none'
});
const normalizeAction=value=>{const key=String(value||'none').trim().toLowerCase();return Object.prototype.hasOwnProperty.call(ALIASES,key)?ALIASES[key]:key;};
const owns=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>structuredClone(value);
const equal=isDeepStrictEqual;
const token=value=>String(value).replace(/([a-z])([A-Z])/g,'$1-$2').trim().toLowerCase().replace(/[ _]+/g,'-');
const kindToken=value=>typeof value==='string'&&/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)&&!['none','choice','local','ai'].includes(value);
function labelError(){throw new Error('Invalid selected pipeline labels');}
function stringSet(value,kind=false,empty=true){
 if(!Array.isArray(value)||!empty&&!value.length||value.some(item=>typeof item!=='string'||!item.trim()||item!==item.trim()||kind&&!kindToken(item))||new Set(value).size!==value.length)labelError();
 return [...value].sort();
}
function helpLabel(value){
 if(value===null||value==='none')return {mode:null,kinds:[]};
 if(typeof value==='string'){if(!kindToken(value))labelError();return {mode:value==='ask'?'ask':'build',kinds:[value]};}
 if(Array.isArray(value)){const kinds=stringSet(value,true,false);return {mode:kinds.every(kind=>kind==='ask')?'ask':kinds.includes('ask')?'plausible':'build',kinds};}
 if(!record(value)||!Object.keys(value).length||Object.keys(value).some(key=>!['kind','kinds','mode','plausibleKinds'].includes(key)))labelError();
 const hasKind=owns(value,'kind'),hasKinds=owns(value,'kinds'),plausible=owns(value,'plausibleKinds'),mode=value.mode;
 if(owns(value,'mode')&&!['ask','build','choice'].includes(mode))labelError();
 if(plausible){
  if(hasKind||hasKinds||mode==='choice')labelError();
  const kinds=stringSet(value.plausibleKinds,true,false);
  if(mode&&kinds.some(kind=>(kind==='ask'?'ask':'build')!==mode))labelError();
  return helpLabel(kinds);
 }
 if(mode==='choice'||!mode&&hasKinds&&value.kinds?.length){
  if(hasKind&&value.kind!==null)labelError();
  const kinds=stringSet(value.kinds,true,false);if(kinds.includes('ask'))labelError();return {mode:'choice',kinds};
 }
 if(hasKinds&&stringSet(value.kinds).length)labelError();
 if(mode==='ask'){if(hasKind&&value.kind!=='ask')labelError();return {mode:'ask',kinds:['ask']};}
 if(!hasKind||value.kind!==null&&typeof value.kind!=='string')labelError();
 const result=helpLabel(value.kind);if(mode&&result.mode!==mode||result.mode===null&&(mode||hasKinds))labelError();return result;
}
function pipelineLabels(row){
 const labels={};
 for(const key of ['route','context','help']){
  const declarations=[row.expected,row].filter(value=>record(value)&&owns(value,key)).map(value=>{
   if(key==='route'){if(!['local','ai'].includes(value[key]))labelError();return value[key];}
   return key==='context'?stringSet(value[key]):helpLabel(value[key]);
  });
  if(declarations.length>1&&!equal(declarations[0],declarations[1]))labelError();
  if(declarations.length)labels[key]=declarations[0];
 }
 if(labels.route==='local'&&(labels.context?.length||labels.help?.mode!==undefined&&labels.help.mode!==null)||labels.route==='ai'&&labels.help?.mode===null)labelError();
 return labels;
}
function conflict(){throw new Error('Conflicting canonical label declarations');}
function put(value,key,next){if(owns(value,key)&&!equal(value[key],next))conflict();value[key]=next;}
function rename(value,key,aliases,transform=value=>value){
 const names=[key,...aliases].filter(name=>owns(value,name));if(!names.length)return;
 const next=transform(value[names[0]]);if(names.some(name=>!equal(transform(value[name]),next)))conflict();
 value[key]=next;for(const name of aliases)delete value[name];
}
function canonicalHelp(value){
 if(typeof value==='string')return value.trim().toLowerCase()==='ask for a plain answer'?'ask':value;
 if(Array.isArray(value))return value.map(canonicalHelp);
 if(record(value))return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,['kind','kinds','plausibleKinds'].includes(key)?canonicalHelp(entry):entry]));
 return value;
}
const FOCUS=Object.freeze({continue:'resume',end:'stop',cancel:'stop',done:'stop',hold:'pause',extend:'adjust',add:'adjust',increase:'adjust',subtract:'adjust',shorten:'adjust',reduce:'adjust',cut:'adjust',remove:'adjust','set-remaining':'set-remaining'});
const NEGATIVE=new Set(['subtract','shorten','reduce','cut','remove']);
const POSITIVE=new Set(['extend','add','increase']);
function focusFields(fields,rawAction){
 const names=['action','command','control','operation'].filter(key=>owns(fields,key));
 if(!names.length&&['pause','resume','stop','focus-status','break'].includes(rawAction))fields.action=rawAction==='focus-status'?'status':rawAction;
 const declarations=names.map(key=>({key,verb:token(fields[key])}));
 const actions=declarations.map(value=>FOCUS[value.verb]||value.verb);
 if(actions.length&&actions.some(action=>action!==actions[0]))conflict();
 if(actions.length)fields.action=actions[0];
 const signs=new Set(declarations.map(value=>NEGATIVE.has(value.verb)?-1:POSITIVE.has(value.verb)?1:0).filter(Boolean));
 if(owns(fields,'subtractMinutes'))signs.add(-1);if(owns(fields,'addMinutes'))signs.add(1);if(signs.size>1)conflict();
 const sign=[...signs][0];
 if(sign&&declarations.some(value=>value.key==='action'&&value.verb==='adjust')&&typeof fields.minutes==='number'&&fields.minutes!==0&&Math.sign(fields.minutes)!==sign)conflict();
 const amounts=['minutes','subtractMinutes','addMinutes'].filter(key=>owns(fields,key)).map(key=>{
  const amount=fields[key];if(typeof amount!=='number'||!Number.isFinite(amount))throw new Error('Invalid focus duration label');return sign?Math.abs(amount)*sign:amount;
 });
 if(amounts.length&&amounts.some(amount=>amount!==amounts[0]))conflict();
 if(amounts.length)fields.minutes=amounts[0];
 if((owns(fields,'subtractMinutes')||owns(fields,'addMinutes'))&&!owns(fields,'action'))fields.action='adjust';
 for(const key of ['command','control','operation','subtractMinutes','addMinutes'])delete fields[key];
}
const TABS=new Set(['home','courses','course','planner','calendar','market','settings','notes','bookmarks','inbox','people','grades','files','announcements']);
function canonicalFields(action,rawAction,fields){
 if(!record(fields))throw new Error('Invalid expected fields');
 if(action==='focus-control')focusFields(fields,rawAction);
 if(action==='reminder'){rename(fields,'title',['text']);rename(fields,'at',['remindAt']);}
 if(action==='setting'){
  const direct=['showGrades','theme'].filter(key=>owns(fields,key));if(direct.length>1)conflict();
  if(direct.length){const key=direct[0];put(fields,'key',key);put(fields,'value',fields[key]);delete fields[key];}
  if(fields.key==='pet.roam'&&fields.value==='panel')fields.value='home';
  if(fields.key==='reducedMotion'&&typeof fields.value==='boolean'){fields.key='motionStyle';fields.value=fields.value?'still':'gentle';}
 }
 if(action==='feature'){
  rename(fields,'id',['key','feature']);rename(fields,'on',['enabled','value']);
  if(owns(fields,'on')&&typeof fields.on!=='boolean')throw new Error('Invalid feature toggle label');
 }
 if(action==='module'){
  rename(fields,'key',['moduleId','module']);
  if(owns(fields,'visible')){if(typeof fields.visible!=='boolean')throw new Error('Invalid module visibility label');put(fields,'action',fields.visible?'show':'hide');delete fields.visible;}
  if(['full','wide','full-width'].includes(fields.width)&&(!owns(fields,'action')||fields.action==='wide')){put(fields,'action','wide');delete fields.width;}
  if(['first','top'].includes(fields.position)&&(!owns(fields,'action')||fields.action==='top')){put(fields,'action','top');delete fields.position;}
 }
 if(action==='navigate')rename(fields,'tab',['view','destination'].filter(key=>typeof fields[key]==='string'&&TABS.has(fields[key])));
 return fields;
}
function itemTargets(action,fields){
 const operation=token(fields.operation||'');
 return ['open/find','complete','focus','bookmark'].includes(action)||action==='plan'&&!/block|^(?:move|resize|remove|undo|replan)$/.test(operation);
}
function convertExpected(source,inheritedAction){
 if(!record(source))throw new Error('Invalid expected label');
 const expected=clone(source);let rawAction=owns(expected,'action')?String(expected.action).trim().toLowerCase():inheritedAction;
 if(['batch','compound'].includes(rawAction)&&record(expected.fields)&&owns(expected.fields,'steps')){
  put(expected,'steps',expected.fields.steps);delete expected.fields.steps;if(!Object.keys(expected.fields).length)delete expected.fields;
 }
 rename(expected,'actions',['operations','steps'],values=>{
  if(!Array.isArray(values)||values.length<2)throw new Error('Compound expectations require at least two actions');
  return values.map(value=>{const step=convertExpected(value);if(owns(step,'actions')||typeof step.action!=='string'||!ACTIONS.includes(step.action))throw new Error('Invalid compound action');pipelineLabels({expected:step});return step;});
 });
 if(owns(expected,'actions')){
  const first=expected.actions[0];if(!owns(expected,'action')||['batch','compound'].includes(rawAction)){rawAction=first.action;expected.action=first.action;}
  if(normalizeAction(rawAction)!==first.action)conflict();
  if(!owns(expected,'itemId')&&owns(first,'itemId'))expected.itemId=first.itemId;
  if(!owns(expected,'fields')&&owns(first,'fields'))expected.fields=clone(first.fields);
  if(owns(expected,'ordered')&&typeof expected.ordered!=='boolean')throw new Error('Invalid compound ordering');
 }else if(owns(expected,'ordered'))throw new Error('Compound ordering requires explicit actions');
 const action=normalizeAction(rawAction);
 if(owns(expected,'action'))expected.action=action;
 if(!owns(expected,'fields')&&['pause','resume','stop','focus-status','break'].includes(rawAction))expected.fields={};
 if(owns(expected,'fields'))canonicalFields(action,rawAction,expected.fields);
 const fields=record(expected.fields)?expected.fields:{};
 if(itemTargets(action,fields)){
  rename(expected,'itemId',['targetId','assignmentId'],value=>String(value));
  rename(fields,'itemId',['targetId','assignmentId'],value=>String(value));
  if(owns(fields,'itemId')&&fields.itemId!=='')put(expected,'itemId',fields.itemId);
 }else if(action==='reminder'&&['','create','add','schedule'].includes(token(fields.operation||''))){
  rename(expected,'itemId',['assignmentId'],value=>String(value));
  rename(fields,'itemId',['assignmentId'],value=>String(value));
  if(owns(fields,'itemId')&&fields.itemId!=='')put(expected,'itemId',fields.itemId);
 }
 if(owns(expected,'itemId'))expected.itemId=String(expected.itemId);
 if(owns(expected,'help'))expected.help=canonicalHelp(expected.help);
 if(owns(expected,'alternatives')){
  if(!Array.isArray(expected.alternatives))throw new Error('Invalid expected alternatives');
  expected.alternatives=expected.alternatives.map(value=>convertExpected(value,rawAction));
  if(owns(expected,'actions')&&expected.alternatives.some(value=>!owns(value,'actions')))throw new Error('Compound alternatives must declare complete actions');
 }
 if(owns(expected,'actions')){
  const first=expected.actions[0];for(const key of ['itemId','fields'])if(owns(expected,key)&&owns(first,key)&&!equal(expected[key],first[key]))conflict();
  for(const key of ['itemId','fields'])if(owns(expected,key)&&!owns(first,key))first[key]=clone(expected[key]);
 }
 return expected;
}
function convertRow(source,options={}){
 if(!record(source))throw new Error('Invalid fixture row');
 const row=options.shareWorld?{...source}:clone(source);row.expected=convertExpected(source.expected);
 if(owns(row,'help'))row.help=canonicalHelp(row.help);
 let labels=pipelineLabels(row);
 if(!owns(labels,'route')){
  const variants=[row.expected,...(row.expected.alternatives||[])].flatMap(value=>value.actions||[value]),routes=variants.map(value=>value.action===undefined?undefined:value.action==='ai'?'ai':'local');
  if(routes[0]&&routes.every(route=>route===routes[0]))row.expected.route=routes[0];
  labels=pipelineLabels(row);
 }
 if(labels.route==='local')for(const [key,value] of [['context',[]],['help',null]])if(!owns(labels,key))row.expected[key]=value;
 pipelineLabels(row);return row;
}
function convertFixture(data){
 if(Array.isArray(data))return data.map(convertRow);
 if(!record(data))throw new Error('Invalid fixture');
 const converted=clone(data);
 for(const key of ['situations','offers'])if(owns(data,key)){
  if(!Array.isArray(data[key]))throw new Error('Invalid fixture rows');converted[key]=data[key].map(convertRow);
 }
 return converted;
}
function mergeRequirements(base,patch){
 if(!record(base)||!record(patch))return clone(patch);
 return Object.fromEntries([...new Set([...Object.keys(base),...Object.keys(patch)])].map(key=>[key,owns(patch,key)?mergeRequirements(base[key],patch[key]):clone(base[key])]));
}
function expectedVariants(expected){
 if(!record(expected)||owns(expected,'alternatives')&&!Array.isArray(expected.alternatives))throw new Error('Invalid expected alternatives');
 return [expected,...(expected.alternatives||[]).map(value=>{
  if(!record(value))throw new Error('Invalid expected alternative');
  return {...expected,...value,...(owns(expected,'fields')&&owns(value,'fields')?{fields:mergeRequirements(expected.fields,value.fields)}:{})};
 })].map(value=>{const out=clone(value);delete out.alternatives;return out;});
}
function fieldPaths(fields,prefix=[]){
 if(!record(fields))throw new Error('Invalid expected fields');
 return Object.entries(fields).flatMap(([key,value])=>record(value)&&Object.keys(value).length?fieldPaths(value,[...prefix,key]):[[...prefix,key]]);
}
/* Only explicit expected actions label a workflow. Session queues and alternatives never supply missing steps. */
function compoundVariants(expected){
 const variants=expectedVariants(expected),compound=variants.some(value=>owns(value,'actions'));
 if(!compound)return null;
 for(const value of variants){
  if(!Array.isArray(value.actions)||value.actions.length<2||owns(value,'ordered')&&typeof value.ordered!=='boolean')throw new Error('Invalid compound expectation');
  for(const step of value.actions){
   if(!record(step)||owns(step,'actions')||typeof step.action!=='string'||!ACTIONS.includes(normalizeAction(step.action)))throw new Error('Invalid compound action');
   for(const variant of expectedVariants(step)){if(owns(variant,'actions')||!ACTIONS.includes(normalizeAction(variant.action))||owns(variant,'fields')&&!record(variant.fields))throw new Error('Invalid compound alternative');pipelineLabels({expected:variant});}
  }
 }
 return variants;
}
function episodeLabel(row){
 const tags=Array.isArray(row.tags)?row.tags:[],ids=[row.episodeId,row.session?.episodeId,...tags.filter(value=>typeof value==='string'&&value.startsWith('episode:')).map(value=>value.slice(8))].filter(value=>value!==undefined),turns=[row.turn,row.session?.turn].filter(value=>value!==undefined);
 if(!ids.length&&!turns.length)return null;
 if(!ids.length||!turns.length||ids.some(value=>typeof value!=='string'||!value.trim()||value!==value.trim()||value!==ids[0])||turns.some(value=>!Number.isInteger(value)||value<1||value>3||value!==turns[0]))throw new Error('Invalid three-turn episode labels');
 return {id:ids[0],turn:turns[0]};
}
function workflowCoverage(row){
 const session=row.evaluationSession||row.session,explicit=!!compoundVariants(row.expected),tags=Array.isArray(row.tags)?row.tags:[],partial=tags.some(value=>typeof value==='string'&&(/^(?:compound|workflow):/.test(value)||/^family:(?:compound|workflow)$/.test(value)))||Array.isArray(session?.pendingOperations)&&session.pendingOperations.length>0||owns(session||{},'workflow');
 return {eligible:explicit||partial,fullyLabelled:explicit,partial:!explicit&&partial};
}
function inferenceSession(value){
 if(Array.isArray(value))return value.map(inferenceSession);
 if(!record(value))return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!['expected','coverageEvidence','pendingOperations'].includes(key)).map(([key,entry])=>[key,inferenceSession(entry)]));
}
module.exports=Object.freeze({LABEL_VERSION:1,ACTIONS,HELP_KINDS,ALIASES,normalizeAction,kindToken,pipelineLabels,convertRow,convertFixture,expectedVariants,fieldPaths,compoundVariants,episodeLabel,workflowCoverage,inferenceSession});
