'use strict';
// Request/transaction fixture for the real media-store IndexedDB adapter.
function indexedMemory(){
 const tables=new Map();let opened=false;
 const db={objectStoreNames:{contains:name=>tables.has(name)},createObjectStore(name){tables.set(name,new Map());return {createIndex(){}};},close(){},transaction(names,mode){
  const state=new Map(names.map(name=>[name,structuredClone(tables.get(name))]));let pending=0,scheduled=false,aborted=false;
  const tx={objectStore(name){const rows=state.get(name),request=fn=>{pending++;const r={};queueMicrotask(()=>{if(aborted)return;try{r.result=fn();r.onsuccess?.();}catch(error){tx.error=error;tx.abort();return;}pending--;complete();});return r;};return {index:()=>({getAll:owner=>request(()=>[...rows.values()].filter(row=>row.owner===owner))}),put:row=>request(()=>rows.set(row.key,structuredClone(row))),delete:key=>request(()=>rows.delete(key))};},abort(){if(aborted)return;aborted=true;queueMicrotask(()=>tx.onabort?.());}};
  function complete(){if(scheduled||aborted||pending)return;scheduled=true;queueMicrotask(()=>{scheduled=false;if(aborted||pending)return;if(mode==='readwrite')for(const [name,rows]of state)tables.set(name,rows);tx.oncomplete?.();});}
  return tx;
 }};
 // Other databases the worker opens (the AI run journal) get their own empty memory, so they never share the media tables.
 const others=new Map();
 return {async databases(){return opened?[{name:'reserve-media-v1',version:2}]:[];},open(name='reserve-media-v1'){const request={};if(name!=='reserve-media-v1'){let other=others.get(name);const fresh=!other;if(!other){other=indexedMemory();others.set(name,other);}const inner=other.open();queueMicrotask(()=>{});return inner;}const upgrade=!opened;opened=true;queueMicrotask(()=>{request.result=db;if(upgrade)request.onupgradeneeded?.();request.onsuccess?.();});return request;},tables};
}
async function bounded(promise,label,milliseconds=2500){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' did not settle')),milliseconds);})]);}finally{clearTimeout(timer);}}
module.exports={indexedMemory,bounded};
