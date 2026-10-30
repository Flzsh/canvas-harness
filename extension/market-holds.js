/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Worker-owned media reservations survive worker restarts, but not their document. */
(function(root){
 'use strict';
 const chrome=root.chrome,KEY='reserve:market-holds',OWNERS='reserve:market-hold-owners',UUID=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
 let pending=Promise.resolve(),fallback={};
 const queue=fn=>{if(root.ReserveAccountWrites)return root.ReserveAccountWrites.run(KEY,fn);const task=pending.catch(()=>{}).then(fn);pending=task;return task;};
 const records=async()=>chrome.storage.session?(await chrome.storage.session.get(KEY))[KEY]||{}:JSON.parse(JSON.stringify(fallback)),save=async value=>{
  if(chrome.storage.session)await chrome.storage.session.set({[KEY]:value});else fallback=JSON.parse(JSON.stringify(value));
 };
 const validOwner=o=>!!root.ReserveMarketSite?.origin(o?.origin)&&typeof o.accountId==='string'&&/^\d+$/.test(o.accountId),
  sameOwner=(a,b)=>a?.origin===b?.origin&&a?.accountId===b?.accountId;
 const context=sender=>({tabId:sender.tab.id,documentId:sender.documentId||null,url:sender.url}),
  sameDocument=(a,b)=>a.tabId===b.tabId&&(a.documentId||b.documentId?a.documentId===b.documentId:a.url===b.url);
 async function release(owner,token,indexedOnly=false){
  if(indexedOnly){const key='reserve:market-media:'+JSON.stringify([owner.origin,owner.accountId])+':index';if((await chrome.storage.local.get(key))[key]===undefined)return;}
  const store=root.ReserveMedia.createPackStore(owner);
  try{await store.release(token);}finally{store.close();}
 }
 async function live(record,token){
  try{
   const result=await chrome.tabs.sendMessage(record.tabId,{target:'ch-market-holds-live',tokens:[token]},record.documentId?{documentId:record.documentId}:{frameId:0});
   return Array.isArray(result?.tokens)&&result.tokens.includes(token);
  }catch{return false;}
 }
 function reconcile(tabId=null,removed=false){return queue(async()=>{
  const saved=await records();
  let changed=false;
  for(const [token,row]of Object.entries(saved)){
   if(tabId!==null&&row.tabId!==tabId)continue;
   if(removed||!await live(row,token)){await release(row.owner,token,true);delete saved[token];changed=true;}
  }
  if(tabId===null){
   const owners=(await chrome.storage.local.get(OWNERS))[OWNERS]||[];
   for(const owner of owners.filter(validOwner)){
    const key='reserve:market-media:'+JSON.stringify([owner.origin,owner.accountId])+':index',
     pool=(await chrome.storage.local.get(key))[key],
     orphaned=new Set((Array.isArray(pool?.media)?pool.media:[]).flatMap(row=>Array.isArray(row.holds)?row.holds:[]).filter(token=>
      typeof token==='string'&&UUID.test(token)&&!Object.hasOwn(saved,token)));
    for(const token of orphaned)await release(owner,token);
   }
  }
  if(changed)await save(saved);
 });}
 const ready=reconcile();ready.catch(()=>{});
 async function handle(message,sender){
  if(!validOwner(message.owner)||
   !await root.ReserveMarketSite.sender(sender,message.owner)||
   !['reserve','release'].includes(message.op)||
   typeof message.token!=='string'||
   !UUID.test(message.token)||
   message.op==='reserve'&&(!Array.isArray(message.ids)||message.ids.length>1000||message.ids.some(id=>typeof id!=='string'||!UUID.test(id))))
   throw Error('Invalid media hold.');
  await ready;
  return queue(async()=>{
   const saved=await records(),previous=saved[message.token],who=context(sender);
   if(previous&&(!sameOwner(previous.owner,message.owner)||!sameDocument(previous,who)))throw Error('Media hold belongs to another document.');
   if(message.op==='release'){if(!previous)return;await release(previous.owner,message.token);delete saved[message.token];await save(saved);return;}
   const owners=(await chrome.storage.local.get(OWNERS))[OWNERS]||[];
   if(!owners.some(owner=>sameOwner(owner,message.owner)))await chrome.storage.local.set({[OWNERS]:[...owners,message.owner]});
   saved[message.token]={owner:message.owner,...who};
   await save(saved);
   const store=root.ReserveMedia.createPackStore(message.owner);
   try{
    await store.reserve(new Set(message.ids),message.token);
   }catch(error){try{await store.release(message.token);delete saved[message.token];await save(saved);}catch{}throw error;}finally{store.close();}
  });
 }
 chrome.tabs?.onRemoved?.addListener(tabId=>{void reconcile(tabId,true).catch(()=>{});});
 chrome.tabs?.onUpdated?.addListener((tabId,change)=>{if(change.url||change.status==='loading')void reconcile(tabId).catch(()=>{});});
 root.ReserveMarketHolds=Object.freeze({ready,handle,reconcile});
})(globalThis);
