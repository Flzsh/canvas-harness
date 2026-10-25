'use strict';
/* Capability filtering is label-based. Request wording never determines eligibility. */
const I=require('./biscuit-control-inventory.cjs');
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const normalizeAction=action=>({find:'open/find',open:'open/find',skill:'feature'})[action]||action;
function capabilities(inventory=I.extract()){
 return {inventory,byId:new Map(inventory.controls.map(c=>[c.id,c])),settings:new Map(inventory.controls.filter(c=>c.family==='setting').map(c=>[c.key,c])),pets:new Map(inventory.controls.filter(c=>c.family==='pet').map(c=>[c.key,c])),features:new Set(inventory.controls.filter(c=>c.family==='feature').map(c=>c.key)),modules:new Set(inventory.controls.filter(c=>c.family==='home-module').map(c=>c.key))};
}
function helpDeclared(value){return value!==undefined&&value!==null&&value!=='none'&&(!Array.isArray(value)||value.length>0);}
function operationReasons(operation,caps){
 const reasons=new Set();if(!record(operation))return reasons;
 const action=normalizeAction(operation.action),fields=record(operation.fields)?operation.fields:{};
 if(action==='ai'||operation.route==='ai'||Array.isArray(operation.context)&&operation.context.length)reasons.add('ai-required');
 if(helpDeclared(operation.help))reasons.add('help-kind-required');
 if(action==='setting'&&typeof fields.key==='string'){
  if(fields.key==='showHelp')reasons.add('help-control');
  else if(/^(?:ai|agent)(?:[A-Z.-]|$)/.test(fields.key)||['provider','dailyCap','allowActions','way','wishes'].includes(fields.key))reasons.add('ai-control');
  else {const pet=fields.key.startsWith('pet.'),key=pet?fields.key.slice(4):fields.key,control=(pet?caps.pets:caps.settings).get(key);
   if(!control)reasons.add('absent-public-setting');
   else if(Object.hasOwn(fields,'value')&&control.values?.length&&!control.values.includes(fields.value))reasons.add('absent-public-setting-value');
  }
 }
 if(action==='feature'){
  const key=fields.id??fields.key??fields.skill;
  if(key==='ai')reasons.add('ai-control');else if(typeof key==='string'&&!caps.features.has(key)&&!caps.byId.has('pet-skill:'+key))reasons.add('absent-public-feature');
 }
 if(action==='module'&&typeof fields.key==='string'){
  if(fields.key==='help')reasons.add('help-control');else if(!caps.modules.has(fields.key))reasons.add('absent-public-module');
 }
 if(action==='navigate'&&['ai','help','today-help'].includes(fields.tab))reasons.add(fields.tab==='ai'?'ai-control':'help-control');
 for(const key of ['actions','operations','steps','alternatives'])if(Array.isArray(operation[key]))for(const child of operation[key])for(const reason of operationReasons(child,caps))reasons.add(reason);
 if(action==='batch'&&Array.isArray(fields.steps))for(const child of fields.steps)for(const reason of operationReasons(child,caps))reasons.add(reason);
 return reasons;
}
function rowReasons(row,caps=capabilities()){
 const reasons=operationReasons(row.expected,caps);
 if(row.route==='ai')reasons.add('ai-required');if(helpDeclared(row.help))reasons.add('help-kind-required');
 if(row.shortAmbiguity?.options?.some(option=>option.action==='ai'))reasons.add('ai-required');
 const ids=new Set([...(typeof row.controlId==='string'?[row.controlId]:[]),...(row.tags||[]).filter(tag=>tag.startsWith('control:')).map(tag=>tag.slice(8))]);
 for(const id of ids){
  if(/^(?:feature|toolbox):ai$|^setting:(?:ai|agent)|^button:(?:ai-|agent-|study-ui)/.test(id))reasons.add('ai-control');
  else if(/^(?:home:help|setting:showHelp|toolbox:help)$/.test(id))reasons.add('help-control');
  else if(!caps.byId.has(id))reasons.add('absent-public-control');
 }
 const controlUI=row.controlUI||row.expected?.ui;
 if(controlUI?.path){
  if(controlUI.path.some(part=>/^(?:AI|Help)$/.test(part)))reasons.add(controlUI.path.includes('AI')?'ai-control':'help-control');
  const control=caps.byId.get(row.controlId);
  if(control){const expected=I.proposalFor(control,row.operation||'request');if(!expected.ui?.path||JSON.stringify(controlUI.path)!==JSON.stringify(expected.ui.path))reasons.add('public-ui-path-changed');}
 }
 return [...reasons].sort();
}
function filterRows(rows,caps=capabilities(),{includeUnavailable=false}={}){
 const kept=[],reasonCounts={},exclusiveReasons={},combinations={};let removed=0;
 for(const row of rows){const reasons=rowReasons(row,caps).filter(reason=>!includeUnavailable||['ai-required','help-kind-required','ai-control','help-control'].includes(reason));if(!reasons.length){kept.push(row);continue;}removed++;for(const reason of reasons)reasonCounts[reason]=(reasonCounts[reason]||0)+1;exclusiveReasons[reasons[0]]=(exclusiveReasons[reasons[0]]||0)+1;const combination=reasons.join(' + ');combinations[combination]=(combinations[combination]||0)+1;}
 return {rows:kept,filtering:{input:rows.length,kept:kept.length,removed,reasonCounts,exclusiveReasons,combinations,note:includeUnavailable?'Only AI/help labels are excluded; absent controls and original reference UI paths stay in the denominator without relabelling.':'reasonCounts overlap; exclusiveReasons and combinations each sum to removed. A changed exact public UI path is excluded, never relabelled.'}};
}
module.exports={capabilities,normalizeAction,helpDeclared,operationReasons,rowReasons,filterRows};
