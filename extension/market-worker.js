/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
/* Market bridge installs and popup removals; local mutation verifies the Canvas profile only. */
(function(root){
 'use strict';
 const chrome=root.chrome,reconcile=()=>root.ReserveMarket.sync().catch(()=>{});
 chrome.runtime.onInstalled?.addListener(reconcile);
 chrome.runtime.onStartup?.addListener(reconcile);
 chrome.permissions?.onAdded?.addListener(reconcile);
 chrome.permissions?.onRemoved?.addListener(reconcile);
 void reconcile();
 function market(sender){
  if(sender?.id!==chrome.runtime.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||typeof sender.url!=='string'||/[\\%?#\s]/.test(sender.url)||/(?:^|\/)\.{1,2}(?:\/|$)/.test(sender.url))
   return false;
  try{const url=new URL(sender.url);return url.origin==='https://flzsh.github.io'&&url.pathname.startsWith('/canvas-harness-packs/')&&!url.username&&!url.password;}catch{return false;}
 }
 const popup=sender=>sender?.id===chrome.runtime.id&&!sender.tab&&sender.url===chrome.runtime.getURL('popup.html');
 const canvas=(sender,owner)=>root.ReserveMarketSite.sender(sender,owner);
 async function profile(origin){
  if(!await root.ReserveMarketSite.allowed(origin))throw Error('Invalid media account.');
  const response=await root.fetch(origin+
   '/api/v1/users/self/profile',{credentials:'include',redirect:'error',cache:'no-store',headers:{Accept:'application/json+canvas-string-ids'},signal:AbortSignal.timeout(15000)});
  if(!response.ok||response.redirected||!response.headers.get('content-type')?.includes('json'))throw Error('Canvas account changed.');
  return root.ReserveMarketSite.owner({origin,accountId:String((await response.json())?.id)});
 }
 async function featurePack(id){
  const receipts=(await chrome.storage.local.get('reserve:packs:receipts'))['reserve:packs:receipts'];
  return receipts?.[id]?.kind==='feature'&&!receipts[id].owner;
 }
 async function account(value){
  const owner=root.ReserveMarketSite.owner(value),current=await profile(owner.origin);
  if(current.accountId!==owner.accountId)throw Error('Canvas account changed.');
 }
 // Megapacks (megapack.js): asked by the student's Canvas page (the picker and Biscuit, with the account they belong to,
 // checked as every Canvas request is; state and Remove need none), by the popup, and by the Market page's bridge
 // (megapack-get with the row it read, and state), whose account is the one its tab was opened for.
 const MEGAPACK_PAGE='https://flzsh.github.io/canvas-harness-packs/megapack.html';
 async function megapack(message,sender){
  const M=root.ReserveMegapack;if(!M)throw Error('Megapacks are unavailable.');
  const fromMarket=market(sender),
    fromPopup=!fromMarket&&popup(sender)&&message.owner===undefined,
    fromCanvas=!fromMarket&&!fromPopup&&await canvas(sender,message.owner);
  const allowed=['type','id',...(fromCanvas?['owner']:[]),...(fromMarket&&message.type==='megapack-get'?['entry']:[])];
  if(!(fromMarket||fromPopup||fromCanvas)||
   !M.known(message.id)||
   Object.keys(message).some(k=>!allowed.includes(k))||
   fromMarket&&message.type==='megapack-remove'||
   fromMarket&&message.type==='megapack-get'&&message.entry===undefined||
   fromCanvas&&message.type==='megapack-get'&&message.owner===undefined)
   throw Error('Invalid megapack request.');
  if(fromMarket&&!await chrome.permissions?.contains({origins:['https://flzsh.github.io/*']}))throw Error('Market access is unavailable.');
  if(message.type==='megapack-state')return {ok:true,...await M.state(message.id)};
  if(message.type==='megapack-remove'){await M.remove(message.id);return {ok:true};}
  // the account the scene goes on for when the files are here (none from the popup: the download runs, no scene is put on)
  let owner=null;
  if(fromCanvas){owner=root.ReserveMarketSite.owner(message.owner);await account(owner);}
  else if(fromMarket){owner=await root.ReserveMarketSite.bound(sender.tab.id);await account(owner);}
  const result=await M.get(message.id,{...(fromMarket?{entry:message.entry}:{}),account:owner});
  // from Canvas: the Market opens at the card's own page beside the Canvas tab that asked, bound to that account as the
  // popup's "Open the market" binds its tab
  if(fromCanvas&&result.started){
   try{
    const tab=await chrome.tabs.create({url:'about:blank',active:true,...(Number.isInteger(sender.tab.windowId)?{windowId:sender.tab.windowId}:{}),openerTabId:sender.tab.id});
    try{await root.ReserveMarketSite.bind(tab.id,owner);}catch{}
    await chrome.tabs.update(tab.id,{url:MEGAPACK_PAGE});
   }catch{}
  }
  return {ok:true,state:result.state};
 }
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!['market-open','open-market','market-install','market-installed','market-list','market-remove','market-kit-remove','market-media-hold','market-media-migrate','market-local','market-catalogue','megapack-get','megapack-state','megapack-remove'].includes(message?.type))return;
  (async()=>{
   await root.ReserveMarketSite.ready();
   if(message.type.startsWith('megapack-'))return megapack(message,sender);
   if(message.type==='market-open'){
    if(!popup(sender)||message.url!=='https://flzsh.github.io/canvas-harness-packs/')throw Error('Invalid Market launch.');
    const owner=await profile(await root.ReserveMarketSite.selected()),tab=await chrome.tabs.create({url:'about:blank'});
    await root.ReserveMarketSite.bind(tab.id,owner);
    await chrome.tabs.update(tab.id,{url:message.url});
    return {ok:true,tab:{...tab,url:message.url}};
   }
   // "Get more" in Make it yours (a Canvas page, for its own account): the Market opens as the popup's "Open the market" opens
   // it, beside the Canvas tab and bound to that account. (The Market's site access is asked only from the popup's own click.)
   if(message.type==='open-market'){
    if(!message.owner||Object.keys(message).some(k=>!['type','owner'].includes(k))||!await canvas(sender,message.owner))throw Error('Invalid Market launch.');
    const owner=root.ReserveMarketSite.owner(message.owner);await account(owner);
    const tab=await chrome.tabs.create({url:'about:blank',active:true,...(Number.isInteger(sender.tab.windowId)?{windowId:sender.tab.windowId}:{}),openerTabId:sender.tab.id});
    await root.ReserveMarketSite.bind(tab.id,owner);
    await chrome.tabs.update(tab.id,{url:'https://flzsh.github.io/canvas-harness-packs/'});
    return {ok:true};
   }
   if(message.type==='market-list'){if(!popup(sender))throw Error('Invalid pack list request.');return {ok:true,packs:await root.ReservePacks.installed()};}
   if(message.type==='market-local'){
    const owner=message.owner;if(!await canvas(sender,owner)||!owner||typeof owner.accountId!=='string'||!/^\d+$/.test(owner.accountId))throw Error('Invalid local pack account.');
    if(!['install','remove','use','restore','backup'].includes(message.op))throw Error('Invalid local pack operation.');
    // Export reads only already account-bound local records and works offline.
    if(message.op==='backup')return {ok:true,market:await root.ReservePacks.exportAccountBackup({owner})};
    await account(owner);
    const options={
     owner,
     ...(message.week!==undefined?{week:message.week}:{}),
     ...(message.conflicts!==undefined?{conflicts:message.conflicts}:{}),
     ...(message.op==='restore'&&message.targetMedia!==undefined?{targetMedia:message.targetMedia}:{})
    };
    if(message.op==='install'){
     if(!['theme','pet','preset'].includes(message.kind)||typeof message.source!=='string')throw Error('Invalid local pack.');
     const name='local.'+{theme:'chtheme',pet:'chpet',preset:'chpreset'}[message.kind],size=new TextEncoder().encode(message.source).length;
     const row=await root.ReservePacks.installLocal({name,size,text:async()=>message.source},{...options,apply:message.apply!==false});
     return {ok:true,row};
    }
    if(message.op==='remove')return {ok:true,row:await root.ReservePacks.removeLocal(message.id,options)};
    if(message.op==='use')return {ok:true,row:await root.ReservePacks.useLocal(message.id,options)};
    if(message.op==='restore')return {ok:true,data:await root.ReservePacks.restoreBackup(message.backup,options)};
    throw Error('Invalid local pack operation.');
   }
   // Migration copies already stored bytes only; it needs no Canvas request.
   if(message.type==='market-media-migrate'){
    if(!await canvas(sender,message.owner)||!message.owner||typeof message.owner.accountId!=='string'||!/^\d+$/.test(message.owner.accountId))throw Error('Invalid media request.');
    const store=root.ReserveMedia.createPackStore(message.owner);try{await store.listKits();}finally{store.close();}return {ok:true};
   }
   if(['market-kit-remove','market-media-hold'].includes(message.type)){
    if(!message.owner||!await canvas(sender,message.owner))throw Error('Invalid media request.');if(message.type!=='market-media-hold'||message.op!=='release')await account(message.owner);
    if(message.type==='market-kit-remove'){
     const saved=(await chrome.storage.local.get('reserve:packs:receipts'))['reserve:packs:receipts']||{},
      entry=Object.entries(saved).find(([,p])=>
       p.kind==='kit'&&p.kitId===message.kitId&&p.owner?.origin===message.owner.origin&&p.owner?.accountId===message.owner.accountId);
     if(entry)
      await root.ReservePacks.remove(entry[0]);
     else{
      const store=root.ReserveMedia.createPackStore(message.owner);
      try{
       const kit=(await store.listKits()).find(kit=>kit.id===message.kitId);
       if(!kit)throw Error('Unknown market kit.');
       await store.removeKit(kit.id,{mediaIds:[...root.ReserveMedia.referenced({overviewArt:kit.appearance})],recheck:()=>account(message.owner)});
      }finally{store.close();}
     }
     return {ok:true};
    }
    await root.ReserveMarketHolds.handle(message,sender);return {ok:true};
   }
   // Make it yours (Settings) lists the features installed from the Market: asked by Canvas's page for its own account
   if(message.type==='market-catalogue'){
    const owner=message.owner;
    if(!owner||
     typeof owner.accountId!=='string'||
     !/^\d+$/.test(owner.accountId)||
     !await canvas(sender,owner)||
     message.kind!==undefined&&message.kind!=='feature'||
     Object.keys(message).some(k=>!['type','kind','owner'].includes(k)))
     throw Error('Invalid pack catalogue request.');
    await account(owner);
    const packs=await root.ReservePacks.installed({owner});
    return {
     ok:true,
     packs:packs.filter(pack=>!message.kind||pack.kind===message.kind).map(({id,name,kind,feature})=>
      ({id,name,kind,...(feature?{feature}:{}),source:'market',current:false}))
    };
   }
   if(message.type==='market-remove'){
    if(typeof message.id!=='string')throw Error('Invalid pack removal.');
    // Make it yours > Features (a Canvas page of the account) removes a feature add-on as the popup does
    if(!popup(sender)&&!(message.owner&&await canvas(sender,message.owner)&&await featurePack(message.id)))throw Error('Invalid pack removal.');
    if(!popup(sender))await account(message.owner);
    await root.ReservePacks.remove(message.id);return {ok:true};
   }
   if(!market(sender)||!await chrome.permissions?.contains({origins:['https://flzsh.github.io/*']}))throw Error('Market access is unavailable.');
   const owner=await root.ReserveMarketSite.bound(sender.tab.id);
   // The Market page is also told what this version's band kit reads (its level and block names), so it can say when a
   // theme's band needs a later Canvas Harness. A megapack counts as installed once ALL its files are on this machine (its
   // local record); one still coming down is named in "getting", so the bridge can show its progress.
   if(message.type==='market-installed'){
     await account(owner);
     const M=root.ReserveMegapack,mega=M?await M.installed():[],getting=M?await M.getting():[];
     return {
       ok:true,
       installed:[...(await root.ReservePacks.installed({marketOnly:true,owner})).map(pack=>pack.id),...mega],
       ...(getting.length?{getting}:{}),
       ...(root.ReserveBandKit?.capabilities?{band:root.ReserveBandKit.capabilities()}:{})
     };
   }
   await root.ReservePacks.install(message.entry,message.bytes,{owner});return {ok:true};
  })().then(reply,error=>reply({ok:false,reason:String(error?.message||'Pack request failed.').slice(0,240)}));return true;
 });
})(globalThis);
