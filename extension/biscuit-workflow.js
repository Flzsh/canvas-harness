/* Shared request layout and actual proposal-state transitions. No labels or model access. */
(function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null);
 function layout(input,s={},session={}){
  const raw=String(input),Intent=load('ReserveBiscuitIntent','./biscuit-intent.js'),Details=load('ReserveBiscuitDetails','./biscuit-details.js'),guarded=/^\s*(?:if|unless|suppose|what if|how do|how can|can i|could i|should i|do not|don.t|dont|never)\b/i.test(raw),parts=Intent?.workflowParts?.(raw,{state:s,session,control:['setting','feature','module'].includes(session.workflowAction?.action)})||[{text:raw,start:0,end:raw.length}],note=!guarded&&parts.length===1?Intent?.literalNotePayload?.(raw,s,session):null;
  if(note)return {mode:'whole',reason:'literal-note',guarded,parts,work:[{text:raw,start:0,end:raw.length}],result:{action:'note',items:[],message:'Save note: '+note.text,next:{action:'note',fields:{operation:'create',...note},label:'Continue'}}};
  const related=part=>!!Intent?.workflowAdjunct?.(part.text),independent=parts.findIndex((part,i)=>i>0&&!related(part)),owned=!guarded&&independent<0&&!Intent?.literalNoteRequest?.(raw)&&(Details?.ownedAllocation?.(raw,s,session)||Details?.ownedPlan?.(raw,s,session));
  if(owned)return {mode:'whole',reason:'owned',guarded,parts,work:[{text:raw,start:0,end:raw.length}],result:owned};
  if(parts.length>1&&parts.length<=6)return {mode:'split',reason:'workflow',guarded,parts,work:independent>1?[{text:raw.slice(0,parts[independent-1].end)},...parts.slice(independent)]:parts};
  return {mode:'whole',reason:'unsplit',guarded,parts,work:[{text:raw,start:0,end:raw.length}]};
 }
 function advance(memory,result){
  const first=result.items?.[0],fields=result.next?.fields||{};if(first){memory.lastItemId=first.id;memory.itemId=first.id;memory.items=result.items;memory.lastCourseId=first.courseId;}const last=result.requests?.at(-1)||result;if(!last.ui)memory.workflowAction={action:last.action,fields:last.next?.fields||fields};return memory;
 }
 /* Extracted Engine.dispatch control prefix, kept in its original position after timer handling. */
 function controlPrefix(input,s={},session={},guarded=false){
  const raw=String(input),Intent=load('ReserveBiscuitIntent','./biscuit-intent.js'),Control=load('ReserveBiscuitControlRequest','./biscuit-control-request.js'),surface=Control?.surface?.(raw,s,session);if(surface)return surface;
  const goal=Intent?.requestGoal?.(raw)||raw,prior=session.workflowAction,mutating=!guarded&&!/^(?:if|unless|suppose|what|where|why|how|can i|could i|should i|do not|don.t|dont|never)\b/i.test(goal)&&!Intent?.negated?.(goal,'setting');
  if(mutating){const moduleScope=/\b(?:card|widget|module)\b|\bon home\b/i.test(goal)||prior?.action==='module'&&/\b(?:it|that|same|wide|first|top)\b/i.test(goal),module=moduleScope?Control?.resolve?.('module',goal,s,session,prior?.action==='module'?prior.fields:{}):null;if(module)return module;const settingScope=/\b(?:pet|companion|biscuit|theme|motion|density|spacing)\b/i.test(goal)&&/^(?:show|hide|set|make|turn|switch|put|keep|change)\b/i.test(goal)||prior?.action==='setting'&&/^(?:off|on|quiet|helpful|gentle|still|dark|light|keep|put)\b/i.test(goal),setting=settingScope?Control?.resolve?.('setting',goal,s,session,prior?.fields||{}):null;if(setting)return setting;}
  if(/^(?:open|show|show me|go to)\b.{0,20}\b(?:saved links(?: list)?|bookmarks(?: list)?)\b/i.test(goal)&&!Intent?.negated?.(goal,'bookmark'))return load('ReserveBiscuitControls','./biscuit-controls.js')?.propose?.('open bookmarks',s,session)||null;
  return null;
 }
 /* A conservative prefix receipt, never a full rules/model evaluator. Unsupported means stop. */
 function immediate(input,s={},session={}){
  const plan=layout(input,s,session);if(plan.result)return plan.result;if(plan.mode!=='whole')return null;const Intent=load('ReserveBiscuitIntent','./biscuit-intent.js');if(!plan.guarded&&Intent?.timerRequest?.(input,s,session))return null;return controlPrefix(input,s,session,plan.guarded);
 }
 const api={layout,advance,controlPrefix,immediate};root.ReserveBiscuitWorkflow=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
