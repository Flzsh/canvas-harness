/* Interpret a requested value using the same finite control dictionaries as the UI. */
(function(root){
 'use strict';
 const load=(n,p)=>root[n]||(typeof module==='object'&&module.exports?require(p):null),
   norm=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(),
   card=(action,fields,message)=>({action,items:[],message,next:{action,fields,label:'Continue'},route:'local',routing:{route:'local',reason:'control-value'}});
 function manualControl(message){return {...card('none',{},'Apply this change manually after the requested condition; it has not been scheduled. '+message),clarify:true,manual:true};}
 function deferredControl(result,input){
   if(!['setting','feature','module'].includes(result?.action))return result;
   const I=load('ReserveBiscuitIntent','./biscuit-intent.js'),
     view=I?.workflowMask?.(String(input))||String(input),
     later=[...view.matchAll(/\b(?:after(?:wards?)?|when|once(?=\s+(?:i|we|you|it|the|my|this|that)\b)|later|tomorrow|tonight)\b/gi)].some(m=>
       !/\bfor\s*$/i.test(view.slice(Math.max(0,m.index-20),m.index)));
   return later?manualControl(result.message):result;
 }
 function settingContinuation(input,s,session,previous){
   const key=previous?.action==='setting'&&previous.fields?.key;
   if(typeof key!=='string'||!key||key.length>256)return null;
   const I=load('ReserveBiscuitIntent','./biscuit-intent.js'),raw=String(input),goal=I?.requestGoal?.(raw)||raw;
   if(/^\s*(?:if|unless|suppose|what if|do not|don.t|dont|never)\b/i.test(raw)||/^(?:if|unless|suppose|what if|do not|don.t|dont|never)\b/i.test(goal))return null;
   const m=/^(?:(?:turn|switch)\s+(?:it|them|that|this)(?:\s+back)?\s+(on|off)|(enable|disable|show|hide)\s+(?:it|them|that|this))(?=\s*(?:again\b|back\b|now\b|please\b|pls\b|for\b|before\b|after(?:wards?)?\b|when\b|once\b|later\b|tomorrow\b|tonight\b|[.!?]|$))/i.exec(goal);
   if(!m)return null;
   const value=m[1]||(/^(?:enable|show)$/i.test(m[2])?'on':'off'),C=load('ReserveBiscuitControls','./biscuit-controls.js');
   return deferredControl(C?.propose?.('set '+key.replace(/^pet\./,'pet ')+' to '+value,s,session)||null,raw);
 }

 // Trim only a terminal UI adjunct. Values retain their original spelling,
 // punctuation and numeric representation for Controls' consumer validation.
 function controlCore(value){
   let core=String(value).trim();
   for(let pass=0;pass<4;pass++){
     const before=core;
     core=core.replace(/[\s,.!?\p{So}\p{Sk}\uFE0F\u200D]+$/gu,'').replace(/(?:\s+(?:again|now|please|pls|for now))+$/i,'').replace(/\s+(?:using|via|with)\s+(?:its|the|this|that)\s+(?:switch|toggle|control|button)$/i,'').replace(/\s+(?:on|in|from)\s+(?:(?:my|the|this)\s+)?(?:screen|display|view)$/i,'').trim();
     if(core===before)break;
   }
   return core;
 }
 function controlCommands(input){
  const I=load('ReserveBiscuitIntent','./biscuit-intent.js'),raw=String(input),goal=I?.requestSpan?.(raw)||I?.requestGoal?.(raw)||raw,view=I?.workflowMask?.(goal)||goal;
  if(I?.literalNoteRequest?.(raw)||
    (I?.workflowParts?.(raw)?.length||1)>1||
    /^\s*(?:if|unless|suppose|what if|do not|don.t|dont|never|remind|note\s*:|write down|save\s+(?:a\s+)?note)\b/i.test(raw)||
    /^\s*(?:if|unless|suppose|what|why|how|when|where|which|should|would|could|can|may|might|do not|don.t|dont|never)\b/i.test(goal))
    return [];
  const commands=[...view.matchAll(/\b(?:turn|switch|enable|disable|start|stop|show|hide|unhide|make|move|put|widen|adjust|bring back)\b/gi)].filter(value=>
    !/\b(?:its|the|that|a|my|this)\s*$/i.test(view.slice(0,value.index)));
  if(commands.length>1)return [];
  const at=commands[0]?.index??0,
    tail=view.slice(at),
    purpose=/\s+(?:for|while|during|before|after(?:wards?)?|when|once(?=\s+(?:i|we|you|it|the|my|this|that)\b)|later|tomorrow|tonight|because|so(?: that)?)\b/i.exec(tail),
    end=purpose?at+purpose.index:goal.length;
  if(!commands.length)return [{text:controlCore(goal.slice(0,end)),nominal:true}];
  const prefix=view.slice(0,at);if(/\b(?:to|not|never|without|instead of|rather than|don.t|dont|can|could|would|should|might|may|must|will)\s*$/i.test(prefix)||/\b(?:if|unless|whether|suppose|said|says|asked|asks|told|reads|quote|quoted)\b[^.!?;]*$/i.test(prefix))return [];
  const command=goal.slice(at,end);if((I?.workflowMask?.(command)||command)!==command)return [];return [{text:controlCore(command),nominal:false}];
 }
 function finiteControl(action,input,s,session,detail){
  const C=load('ReserveBiscuitControls','./biscuit-controls.js'),I=load('ReserveBiscuitIntent','./biscuit-intent.js'),commands=controlCommands(input);
  if(commands.length!==1)return null;
  const {text,nominal}=commands[0],n=norm(text).replace(action==='module'?/\s+(?:on|from|to)\s+home$/:/$^/,'');
  if(!n||I?.negated?.(text,action))return null;
  if(action==='feature'){
   let target,value,m;
   if((m=/^(?:turn|switch)\s+(on|off)\s+(.+)$/.exec(n))){value=m[1];target=m[2];}
   else if((m=/^(?:turn|switch)\s+(.+?)(?:\s+back)?\s+(on|off)$/.exec(n))){target=m[1];value=m[2];}
   else if((m=/^(enable|disable|start showing|stop showing|start|stop|show|hide|unhide)\s+(.+)$/.exec(n))){target=m[2];value=/^(?:enable|start|start showing|show|unhide)$/.test(m[1])?'on':'off';}
   else if(nominal&&(m=/^(.+?\s+feature)\s+(on|off)$/.exec(n))){target=m[1];value=m[2];}else return null;
   target=target.replace(/^(?:the|my)\s+/,'').replace(/^installed\s+/,'').replace(/\s+feature$/,'');
   const catalogue=load('ReserveFeatures','./features.js')?.catalogue||[],
     features=[...catalogue,...(Array.isArray(s.features)?s.features:[])].filter(v=>typeof v?.id==='string'&&typeof v?.name==='string'),
     named=features.filter(v=>[v.id,v.name,v.name.replace(/&/g,' and '),String(v.id).replace(/([a-z])([A-Z])/g,'$1 $2')].some(name=>norm(name)===target)),
     ids=new Set(named.map(v=>v.id));
   if(!ids.size&&/^(?:it|that|this)$/.test(target)&&catalogue.some(v=>v.id===detail.id))ids.add(detail.id);
   if(ids.size!==1)return null;
   return deferredControl(C?.propose?.('turn '+value+' '+[...ids][0]+' feature',s,session)??null,input);
  }
  if(action==='module'){
   const names=C?.MODULES||{},keys=Object.keys(names),has=key=>Object.prototype.hasOwnProperty.call(names,key);let operation,target,m;
   if((m=/^(show|hide|unhide|remove|bring back|stop showing|start showing)\s+(.+)$/.exec(n))){operation=/^(?:hide|remove|stop showing)$/.test(m[1])?'hide':'show';target=m[2];}
   else if((m=/^(?:make|widen)\s+(.+?)(?:\s+(?:wide|wider|full width))?$/.exec(n))&&/\b(?:wide|wider|widen|full width)\b/.test(n)){operation='wide';target=m[1];}
   else if((m=/^(?:put|move|make)\s+(.+?)\s+(?:first|(?:to|at) (?:the )?top)$/.exec(n))){operation='top';target=m[1];}
   else if(/^adjust\s+(?:this|that|the)\s+home\s+(?:module|widget|panel)$/.test(n)&&has(detail.key)&&['show','hide','wide','top'].includes(detail.action)){operation=detail.action;target=detail.key;}
   else if(nominal&&/\b(?:module|widget|panel)\b/.test(n)&&(m=/^(.+?)\s+(wide|wider|full width|first|top|visible|hidden|on|off)$/.exec(n))){
     target=m[1];
     operation=/^(?:wide|wider|full width)$/.test(m[2])?'wide':/^(?:first|top)$/.test(m[2])?'top':/^(?:hidden|off)$/.test(m[2])?'hide':'show';
   }
   else return null;
   if(/^(?:(?:this|that|the|same)\s+)*(?:same\s+)?(?:home\s+)?(?:module|widget|panel|card)$/.test(target)){
     const prior=session.workflowAction?.action==='module'?session.workflowAction:session.lastAction?.action==='module'?session.lastAction:null,key=prior?.fields?.key;
     if(!has(key))return null;
     target=key;
   }
   target=target.replace(/\s+(?:on|from|to)\s+home$/,'').replace(/^(?:the|my|existing)\s+/,'').replace(/\b(?:home module|home widget|module|widget|panel)\b/g,' ').replace(/\s+/g,' ').trim();
   // A location adjunct can follow the operator, e.g. "first on Home".
   const matches=keys.filter(key=>[key,names[key]].some(name=>norm(name)===target));
   if(matches.length!==1)return null;
   const key=matches[0];
   return deferredControl(C?.propose?.(operation==='wide'?'make '+key+' module wide':operation==='top'?'put '+key+' module first':operation+' '+key+' module on Home',s,session)??null,input);
  }
  return null;
 }

 function namedSetting(input,s,session){
   const I=load('ReserveBiscuitIntent','./biscuit-intent.js'),
     C=load('ReserveBiscuitControls','./biscuit-controls.js'),
     raw=String(input),
     goal=I?.requestGoal?.(raw)||raw,
     view=I?.workflowMask?.(goal)||goal;
   if((I?.workflowParts?.(raw)?.length||1)>1||
     /^\s*(?:if|unless|suppose|what if|do not|don.t|dont|never)\b/i.test(raw)||
     I?.literalNoteRequest?.(raw)||
     /\b(?:not|without|instead of|rather than)\b/i.test(view)||
     I?.negated?.(goal,'setting'))
     return null;
   const nominal=!/^(?:set|change|switch|turn|enable|disable|show|hide|unhide|make|apply)\b/i.test(goal),n=norm(goal);
   if(nominal){
     const named=Object.keys(C?.DEFAULTS||{}).some(key=>(C.names?.(key)||[]).some(name=>n.startsWith(name+' '))),
       valued=Object.values(C?.ENUMS||{}).some(values=>values.some(value=>value&&n.startsWith(norm(value)+' ')));
     if(!named&&!valued)return null;
   }
   const purpose=/\s+(?:for|while|during|before|after(?:wards?)?|when|once(?=\s+(?:i|we|you|it|the|my|this|that)\b)|later|tomorrow|tonight|because|so(?: that)?|(?:please|pls)[, ]+(?=(?:i|we)\b)|(?=(?:i|we)\s+(?:need|want)\b))\b/i.exec(view),
     core=controlCore(goal.slice(0,purpose?.index??goal.length));
   if(view!==goal||/\b(?:then|finally|luego|puis|ensuite)\b|\bnext\s+(?:turn|set|change|show|hide|open|find|enable|disable|make|move|put)\b/i.test(I?.workflowMask?.(raw)||raw))return null;
   if(purpose&&/\b(?:then|next|finally|luego|puis|ensuite)\b/i.test(view.slice(purpose.index)))return null;
   let result=C?.propose?.(core,s,session);
  if(result)return deferredControl(result,raw);
  {
    const m=/^(?:(enable|disable|show|hide|unhide)\s+(.+)|(?:turn|switch)\s+(on|off)\s+(.+)|(?:turn|switch)\s+(.+?)\s+(on|off))$/i.exec(core);
    if(m){const target=m[2]||m[4]||m[5],value=m[3]||m[6]||(/^(?:enable|show|unhide)$/i.test(m[1])?'on':'off');result=C?.propose?.('set '+target+' to '+value,s,session);}
  }
  return result?.action==='setting'?deferredControl(result,raw):null;
 }
 function resolve(action,input,s={},session={},detail={}){
   if(!['setting','feature','module'].includes(action))return null;
   const text=String(input),
     C=load('ReserveBiscuitControls','./biscuit-controls.js'),
     I=load('ReserveBiscuitIntent','./biscuit-intent.js'),
     request=I?.requestSpan?.(text)||I?.requestGoal?.(text)||text,
     n=norm(request),
     selected=load('ReserveBiscuitSemantics','./biscuit-semantics.js')?.selected?.(s,session),
     context=norm(selected?.title||selected?.name),
     inspect=/^(?:open|find|fetch|locate|retrieve|inspect|display|list|read|where|which)\b/i.test(request)||/\b(?:show|tell)\s+me\s+where\b/i.test(request)||/\b(?:bring|find|open|where|locate|inspect|show)\b.{0,45}\b(?:control|setting|option|preference|chooser|box|menu|panel|page)\b/i.test(request)&&!/\b(?:change|set|make|switch|turn)\b/i.test(request);
   if(I?.conditionalControl?.(text,{control:true}))return manualControl(text);
   if(inspect)return null;
  // Controls' public parser owns finite-value validation and non-executable handoffs.
  const setting=(key,value)=>deferredControl(C?.propose?.('set '+key.replace(/^pet\./,'pet ')+' to '+String(value),s,session)??null,input);
  if(action==='setting'&&load('ReserveBiscuitIntent','./biscuit-intent.js')?.quietRequest?.(input)){
    const V=load('ReserveBiscuitValues','./biscuit-values.js'),minutes=V.slots(input,s).minutes;
    if(Number.isFinite(minutes)&&minutes>0&&minutes<=1440){
      const until=s.now+minutes*60000;
      return card(
        'setting',
        {key:'pet.quietUntil',value:until,operation:'quiet-reminders',until,preserveReminderIds:(s.reminders||s.pet?.reminders||[]).map(v=>v.id)},
        'Keep alerts quiet for '+minutes+' min; saved reminders stay in place.');
    }
  }
  if(action==='setting'&&detail.key){
    const continued=settingContinuation(input,s,session,{action:'setting',fields:detail});
    if(continued)return continued;
    const match=/^(off|on|quiet|helpful|gentle|still|dark|light|system|\d+(?:\.\d+)?)\b/i.exec(norm(request));
    if(match)return setting(detail.key,/^\d/.test(match[1])?Number(match[1]):match[1]);
  }
  if(action==='setting'||/\b(?:pet|companion|biscuit)\b/i.test(text)&&/pet|companion/.test(context)){
   if(/\b(?:show|unhide|hide|cover|display|turn|switch)\b.{0,35}\b(?:grades?|scores?|marks?)\b/i.test(text)&&!/^\s*(?:why|how|what|where|when|can i)\b/i.test(text))return setting('showGrades',!/\b(?:hide|cover|stop showing|turn.*off|switch.*off|no grades|off|false)\b/i.test(text));
   const pet=/\b(?:pet|companion|biscuit)\b/.test(n)||/pet|companion/.test(context);if(pet){
    if(/\b(?:roam|roaming|wander|wandering|walk|walking|confine|home only|only.*home)\b/.test(n)){
      const value=/\b(?:stop|no wandering|completely|off|not walking)\b/.test(n)?'off':/\bhome\b/.test(n)?'home':/\b(?:page|everywhere)\b/.test(n)?'page':null;
      if(value)return setting('pet.roam',value);
    }
    if(/\b(?:size|small|smaller|large|larger|medium|bigger)\b/.test(n)&&/\b(?:make|size|set|change|grow|shrink|be)\b/.test(n)){
      const value=/\b(?:small|smaller|shrink)\b/.test(n)?'small':/\b(?:large|larger|bigger|grow)\b/.test(n)?'large':/\bmedium\b/.test(n)?'medium':null;
      if(value)return setting('pet.size',value);
    }
    if(/\b(?:nudges?|tips|interruptions|reminders)\b/.test(n)&&/\b(?:quiet|off|silent|helpful|on|stop)\b/.test(n))return setting('pet.nudges',/\b(?:quiet|silent)\b/.test(n)?'quiet':/\b(?:off|stop)\b/.test(n)?'off':'helpful');
    if(/\b(?:appear|reappear|return|show|hide|visible|invisible|disappear|come back)\b/.test(n)&&!/\b(?:roam|wander|walking|settings)\b/.test(n))return setting('pet.enabled',!/\b(?:hide|invisible|disappear|off)\b/.test(n));
   }
   if(/\b(?:rows?|spacing|padding|density|layout)\b/.test(n)&&/\b(?:compact|comfortable|breathing room|more space|mas espacio|pack)\b/.test(n))return setting('density',/\b(?:compact|pack)\b/.test(n)?'compact':'comfortable');
   if(/\b(?:interface|theme|appearance|page|system|laptop)\b/.test(n)&&/\b(?:dark|light|system|automatic|follow)\b/.test(n)){const value=/\b(?:system|automatic|follow)\b/.test(n)?'system':/\bdark\b/.test(n)?'dark':'light';return setting('theme',value);}
   if(/\b(?:motion|animation|moving)\b/.test(n)&&/\b(?:still|off|gentle|less|stop)\b/.test(n))return setting('motion',/\b(?:still|less|stop)\b/.test(n)?'still':/\boff\b/.test(n)?'off':'gentle');
  }
  if(action==='module'||action==='feature')return finiteControl(action,input,s,session,detail);
  return null;
 }
 function surface(input,s={},session={}){
  const raw=String(input),
    C=load('ReserveBiscuitControls','./biscuit-controls.js'),
    intent=load('ReserveBiscuitIntent','./biscuit-intent.js'),
    prior=session.workflowAction,
    page=load('ReserveBiscuitSemantics','./biscuit-semantics.js')?.selected?.(s,session),
    controls=Array.isArray(page?.controls)?page.controls:[];
  if(intent?.conditionalControl?.(raw,{controls,control:['setting','feature','module'].includes(prior?.action)}))return manualControl(raw);
  const continued=settingContinuation(raw,s,session,prior);
  if(continued)return continued;
  if(!controls.length)return namedSetting(raw,s,session);
  const inherited=['setting','module','feature'].includes(prior?.action)?String(prior.fields?.key||prior.fields?.id||'').split('.').at(-1):'',
    parts=(intent?.workflowParts?.(raw,{controls,controlKey:inherited})||[{text:raw}]).map(v=>v.text),
    results=[];
  let activeKey=inherited;
  const open=()=>
    ({
      action:'find',
      items:[{...page,id:String(page.id),title:page.title||page.name,kind:page.kind||'page'}],
      message:(page.title||page.name)+': review the loaded controls and make the change there.',
      next:{action:'open',fields:{itemId:String(page.id),url:page.url||'',kind:page.kind||'page'},label:'Open controls'},
      route:'local',
      routing:{route:'local',reason:'loaded-control-surface'},
      ...(['setting','feature','module'].includes(prior?.action)?{clarify:true,manual:true}:{})
    });
  const contextText=' '+norm(raw)+' ',mentions=controls.some(c=>{
    const key=norm(String(c.key||'').replace(/([a-z])([A-Z])/g,'$1 $2')),label=norm(c.label);
    return key&&contextText.includes(' '+key+' ')||label&&contextText.includes(' '+label+' ');
  }),
  knownValue=controls.some(c=>
    [...(c.availableValues||[]),...(Object.hasOwn(c,'value')?[c.value]:[])].some(v=>['string','number','boolean'].includes(typeof v)&&contextText.includes(' '+(v===''?'none':norm(v))+' '))),
  shortValue=norm(raw).split(' ').length<=2&&knownValue,
  scopedValues=knownValue&&/\b(?:compare|comparing|comparison|both|choices|chooser|choosing|first|then|second|third|next|afterward|primero|luego|despues)\b/i.test(raw);
  if(!mentions&&!shortValue&&!scopedValues&&!(inherited&&knownValue)&&!/\b(?:controls?|settings?|look|options?|buttons?|panels?|pet|companion|biscuit|modules?|widgets?)\b/i.test(raw))return null;
  if(intent?.literalNoteRequest?.(raw))return null;
  const request=intent?.requestGoal?.(raw)||raw;
  if(/^\s*(?:if|unless|suppose|what if|how (?:do|can|could|would) i|can i|could i|should i)\b/i.test(raw)||/^(?:if|unless|suppose|what if|how (?:do|can|could|would) i|can i|could i|should i)\b/i.test(request))return open();
  const firstScope=(intent?.requestGoal?.(parts[0]||raw)||parts[0]||raw).replace(/\b(?:for|so that|before|after)\b[\s\S]*$/i,''),firstText=' '+norm(parts[0]||raw)+' ';
  if(/\b(?:compare|comparing|comparison|chooser|choices|options|inspect|before choosing|choose after|seeing)\b/i.test(firstScope)&&!/^\s*(?:set|apply|enable|disable|turn|switch|change|hide|widen|move|put)\b/i.test(firstScope))return open();
  if(/^show\b/i.test(firstScope)&&controls.some(c=>(c.availableValues||[]).filter(v=>typeof v==='string'&&v&&firstText.includes(' '+norm(v)+' ')).length>1))return open();
  for(const part of parts){
    if(intent?.conditionalControl?.(part,{controls,controlKey:activeKey})){results.push(manualControl(part));continue;}
    const text=norm(part);
    if(/^(?:no|not|without|don.t want|do not want|instead of|rather than)\b/.test(text))continue;
    const goal=(intent?.requestGoal?.(part)||part).replace(/\b(?:for|so that|before|after)\b[\s\S]*$/i,'');
    if(/\b(?:compare|comparing|comparison|chooser|choices|options|inspect|find|open|where|before choosing|before i choose|choose after|show both|both show|seeing|look at|form first|list)\b/i.test(goal)&&!/^\s*(?:set|apply|enable|disable|turn|switch|change|hide|widen|move|put)\b/i.test(goal)){
      if(!results.length)return open();
      results.push({...open(),clarify:true,manual:true});
      continue;
    }
   let result=null,chosenKey='';
   const named=controls.filter(c=>{
     const key=norm(String(c.key||'').replace(/([a-z])([A-Z])/g,'$1 $2')),label=norm(c.label);
     return key&&(' '+text+' ').includes(' '+key+' ')||label&&(' '+text+' ').includes(' '+label+' ');
   }).map(c=>c.key),
   keys=[...new Set(controls.map(c=>c.key))],
   scoped=named.length?controls.filter(c=>named.includes(c.key)):activeKey?controls.filter(c=>String(c.key).split('.').at(-1)===activeKey):keys.length===1?controls:[];
   for(const c of scoped){
     const ops=Array.isArray(c.availableOperations)?c.availableOperations:[],key=String(c.key||''),label=norm(c.label||key);
     if(!key||!ops.length)continue;
     chosenKey=key;
    const finite=[...new Set([...(Array.isArray(c.availableValues)?c.availableValues:[]),...controls.filter(v=>v.key===c.key&&Object.hasOwn(v,'value')).map(v=>v.value)])],
      values=finite.filter(v=>typeof v==='string'||typeof v==='number').map(value=>({value,index:(' '+text+' ').indexOf(' '+(value===''?'none':norm(value))+' ')})).filter(v=>
        v.index>=0&&!/\b(?:not|no|without|instead of|rather than)\s*$/.test(text.slice(Math.max(0,v.index-35),v.index))).sort((a,b)=>
        a.index-b.index),
      bool=/\b(?:off|false|disable|disabled|hide|hidden|desactiva|desactive)\b/i.exec(text),
      yes=/\b(?:on|true|enable|enabled|show|visible|restore|activa|active)\b/i.exec(text),
      value=finite.every(v=>typeof v==='boolean')&&finite.length?
        (bool&&(!yes||bool.index<yes.index)?false:yes?true:undefined):
        values[0]?.value??(finite.includes('on')&&finite.includes('off')?(bool&&(!yes||bool.index<yes.index)?'off':yes?'on':undefined):undefined);
    if(ops.includes('set')||finite.length&&(ops.includes('reset')||ops.includes('inspect'))){
      if(value!==undefined&&(!intent?.negated?.(part,'setting'))){
        result=C?.propose?.('set '+(/^pet(?:-value)?:/.test(c.inventoryId||'')?'pet ':'')+key.replace(/^pet\./,'pet ').replace(/([a-z])([A-Z])/g,'$1 $2')+' to '+(value===''?'none':String(value)),s,session);
        if(result?.action==='setting'||result?.ui)break;
        result=null;
      }
    }
    if(ops.includes('enable')&&ops.includes('disable')&&typeof value==='boolean'&&!intent?.negated?.(part,'feature')){
      result=C?.propose?.('turn '+(value?'on':'off')+' '+key+' feature',s,session);
      if(result?.action==='feature'||result?.ui)break;
      result=null;
    }
    if(ops.includes('wide')&&ops.includes('show')){
      const m=/\b(show|hide|widen|wide|top|first)\b/i.exec(part),operation=m?({widen:'wide',first:'top'})[m[1].toLowerCase()]||m[1].toLowerCase():null;
      if(operation&&ops.includes(operation)&&!intent?.negated?.(part,'module')){
        result=C?.propose?.(operation==='wide'?'make '+key+' module wide':operation==='top'?'put '+key+' module first':operation+' '+key+' module on Home',s,session);
        if(result?.action==='module'||result?.ui)break;
        result=null;
      }
    }
   }
   if(!result)continue;activeKey=chosenKey||activeKey;results.push(deferredControl(result,part));
  }
  if(!results.length)return open();
  if(results.length===1)return results[0];
  return {
    ...results[0],
    requests:results,
    next:{
      ...results[0].next,
      action:'batch',
      fields:{
        ...results[0].next.fields,
        steps:results.map(v=>({...v.next,message:v.message,...(v.ui||v.clarify||v.next?.action==='none'?{manual:true,...(v.ui?{ui:v.ui}:{})}:{})}))
      },
      label:'Review changes'
    },
    message:results.map(v=>v.message).join(' ')
  };
 }
 const api={resolve,surface};root.ReserveBiscuitControlRequest=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
