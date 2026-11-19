/* Every study writer commits leaf changes through the worker's per-key queue. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessStudyWrites=api;
})(globalThis,function(root){
 'use strict';
 const queues=new WeakMap(),
  plain=v=>v&&typeof v==='object'&&!Array.isArray(v),
  same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),
  clone=v=>v===undefined?undefined:structuredClone(v);
 function merge(current,before,after){
  if(same(before,after))return clone(current);
  if(same(current,before)||same(current,after))return clone(after);
  if(plain(before)&&plain(after)&&plain(current)){
   const value=clone(current);
   for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
    if(['__proto__','constructor','prototype'].includes(key))throw Error('Invalid study field.');
    if(same(before[key],after[key]))continue;
    const next=merge(current[key],before[key],after[key]);
    if(next===undefined)delete value[key];else value[key]=next;
   }
   return value;
  }
  throw Error('This study entry changed. Review it before saving.');
 }
 // What a study map keeps (owner, 2026-10-28: "I should be able to know each day's AI content"). Help cards (Daily AI
 // help and Help with… answers, ticked or not) stay by day: everything from the 30 days before the newest card. Other
 // saved aids keep the newest 40, as before. Near the size a write may have, the oldest card of either kind goes first.
 const HELP_DAYS=30,LOOSE=40,BUDGET=900000,DAY=864e5;
 const helpCard=aid=>plain(aid)&&(aid.prepare===true||aid.ask===true);
 function trim(map){
  if(!plain(map))return map;const at=k=>Number(map[k]?.savedAt)||0,oldest=(a,b)=>at(a)-at(b)||(a<b?-1:a>b?1:0),keys=Object.keys(map).filter(k=>!k.startsWith('$'));
  const loose=keys.filter(k=>!helpCard(map[k])).sort(oldest);while(loose.length>LOOSE)delete map[loose.shift()];
  const help=keys.filter(k=>helpCard(map[k])).sort(oldest),cutoff=help.length?at(help.at(-1))-HELP_DAYS*DAY:-Infinity;
  while(help.length&&at(help[0])<cutoff)delete map[help.shift()];
  let size=JSON.stringify(map).length;if(size<=BUDGET)return map;
  const rest=[...help,...loose].sort(oldest),newest=help.at(-1);
  for(const k of rest){if(size<=BUDGET)break;if(k===newest)continue;size-=JSON.stringify(k).length+JSON.stringify(map[k]).length+2;delete map[k];}
  return map;
 }
 function create({local=root.chrome?.storage?.local,serial=root.ReserveAccountWrites?.run}={}){
  function queued(key,work){
   if(serial)return serial(key,work);
   let map=queues.get(local);
   if(!map)queues.set(local,map=new Map());
   const p=(map.get(key)||Promise.resolve()).catch(()=>{}).then(work);
   map.set(key,p);
   return p;
  }
  async function commit(key,before,after,{guard=async()=>{},current=()=>true}={}){
   if(!/^reserve:study:https:\/\/[^/?#]+:\d+$/.test(key)||JSON.stringify(after??null).length>1100000)throw Error('Invalid study update.');
   return queued(key,async()=>{
   await guard();
   await guard();
   const latest=(await local.get(key))[key],value=merge(latest??{},before??{},after);
   if(!current())throw Error('Study update stopped.');
   if(plain(value))trim(value);
   if(value===undefined)await local.remove(key);else await local.set({[key]:value});
   return {value};
  });}
  return {commit};
 }
 function pageCommit(env,key,before,after){
  return env.chrome.runtime.sendMessage({target:'ch-study-write',key,before,value:after,remove:after===undefined}).then(reply=>{
   if(!reply?.ok)throw Error(reply?.error||'Study storage is unavailable.');
   return reply.result;
  });
 }
 return {create,merge,pageCommit,trim,HELP_DAYS,LOOSE,BUDGET};
});
