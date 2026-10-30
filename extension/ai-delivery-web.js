/* Prepare delivery: persist evidence before clicks; reconciliation never resends an uncertain turn. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessDeliveryWeb=api;
})(globalThis,function(root){
 'use strict';
 // ChatGPT keeps every finished turn in its chat record. Read it with the signed-in session from the extension itself
 // (no page script), so the answer is found even while the chat tab sleeps. Only the text of the assistant's final
 // answer after this turn's marker is returned; the session token is used for these reads and never kept.
 function answerAfter(mapping,turnId){
  const text=m=>(m?.content?.parts||[]).filter(p=>typeof p==='string').join(''),marker='[[Canvas Harness agent '+turnId+']]',nodes=mapping&&typeof mapping==='object'?mapping:{};
  let node=Object.values(nodes).find(n=>n?.message?.author?.role==='user'&&text(n.message).includes(marker)),answer='';
  for(let i=0;i<40&&node;i++){
    const next=(node.children||[]).map(c=>nodes[c]).filter(Boolean).at(-1);
    if(!next||next.message?.author?.role==='user')break;
    const m=next.message;
    if(m?.author?.role==='assistant'&&m.content?.content_type==='text'&&m.status==='finished_successfully'&&m.end_turn!==false&&text(m).trim())answer=text(m);
    node=next;
  }
  return answer.replace(/<\/?escape>/g,'').trim().slice(0,60000);
 }
 // The AI's turn has begun once anything (thinking, a tool call) follows this turn's marker.
 function replyBegun(mapping,turnId){
   const text=m=>(m?.content?.parts||[]).filter(p=>typeof p==='string').join(''),
     marker='[[Canvas Harness agent '+turnId+']]',
     nodes=mapping&&typeof mapping==='object'?mapping:{},
     node=Object.values(nodes).find(n=>n?.message?.author?.role==='user'&&text(n.message).includes(marker));
   return !!node&&(node.children||[]).some(c=>nodes[c]?.message&&nodes[c].message.author?.role!=='user');
 }
 // detail: {reply} when the answer is there, {stopped:true} when ChatGPT finished the turn without one (thinking only).
 async function chatRecord({fetch=root.fetch?.bind(root),conversationURL,turnId,since=0,opened=since,timeout=10000,detail=false}){
  const origin='https://chatgpt.com',get=async(pathname,token)=>{
    const res=await Promise.race([
      fetch(origin+pathname,{credentials:'include',headers:token?{authorization:'Bearer '+token}:{}}).catch(()=>null),
      new Promise(r=>setTimeout(()=>r(null),timeout))
    ]);
    return res?.ok?res.json().catch(()=>null):null;
  };
  const none=detail?{}:'';if(typeof fetch!=='function'||!/^turn-[\w-]+$/.test(String(turnId||'')))return none;
  const session=await get('/api/auth/session'),token=session?.accessToken;if(typeof token!=='string'||!token)return none;
  let id='';try{id=/^\/c\/([\w-]{8,80})\/?$/.exec(new URL(conversationURL||origin).pathname)?.[1]||'';}catch{}
  const stamp=t=>typeof t==='number'?t*1000:Date.parse(t)||0;
  // A chat seen only at its temporary local address: the list of the newest chats (ids and times, no messages) names the
  // one created when this chat was sent (opened), and only that chat is read. With no chat created then, nothing is read.
  let ids=id&&!id.startsWith('local-')?[id]:[];
  if(!ids.length){
    const at=Number(opened)||0,
      near=((await get('/backend-api/conversations?offset=0&limit=6&order=updated',token))?.items||[]).filter(c=>
        /^[\w-]{8,80}$/.test(String(c?.id||''))&&stamp(c.update_time)>=since-60000&&stamp(c.create_time)>=at-120000&&stamp(c.create_time)<=at+600000);
    if(at&&near.length)ids=[String(near.sort((a,b)=>Math.abs(stamp(a.create_time)-at)-Math.abs(stamp(b.create_time)-at))[0].id)];
  }
  for(const conversation of ids){
    const read=async()=>(await get('/backend-api/conversation/'+encodeURIComponent(conversation),token))?.mapping,mapping=await read(),answer=answerAfter(mapping,turnId);
    if(answer)return detail?{reply:answer}:answer;
   if(detail&&replyBegun(mapping,turnId)&&(await get('/backend-api/conversation/'+encodeURIComponent(conversation)+'/stream_status',token))?.status==='COMPLETE'){
     const late=answerAfter(await read(),turnId);
     return late?{reply:late}:{stopped:true};
   }}
  return none;
 }
 // Claude keeps its chat record behind its own API: the reply after this turn's marker, read with the signed-in
 // session from the extension, so the answer is found even while the Claude tab sleeps.
 async function claudeRecord({fetch=root.fetch?.bind(root),conversationURL,turnId,timeout=10000}){
  const origin='https://claude.ai',get=async pathname=>{
    const res=await Promise.race([fetch(origin+pathname,{credentials:'include'}).catch(()=>null),new Promise(r=>setTimeout(()=>r(null),timeout))]);
    return res?.ok?res.json().catch(()=>null):null;
  };
  if(typeof fetch!=='function'||!/^turn-[\w-]+$/.test(String(turnId||'')))return {};
  let id='';try{id=/^\/chat\/([\w-]{8,80})\/?$/.exec(new URL(conversationURL||origin).pathname)?.[1]||'';}catch{}if(!id)return {};
  const marker='[[Canvas Harness agent '+turnId+']]',
    said=m=>(Array.isArray(m?.content)?m.content.filter(c=>c?.type==='text'&&typeof c.text==='string').map(c=>c.text).join(''):'')||(typeof m?.text==='string'?m.text:''),
    orgs=await get('/api/organizations');
  for(const org of (Array.isArray(orgs)?orgs:[]).slice(0,4)){
   if(!/^[\w-]{8,80}$/.test(String(org?.uuid||'')))continue;
   const messages=(await get('/api/organizations/'+org.uuid+'/chat_conversations/'+id+'?tree=True&rendering_mode=messages'))?.chat_messages;
   if(!Array.isArray(messages))continue;
   const asked=messages.find(m=>m?.sender==='human'&&said(m).includes(marker));if(!asked)return {};
   const reply=messages.filter(m=>m?.sender==='assistant'&&(m.parent_message_uuid===asked.uuid||Number(m.index)>Number(asked.index))).sort((a,b)=>
     Number(a.index)-Number(b.index))[0];
   if(!reply?.stop_reason)return {};const answer=said(reply).replace(/<\/?escape>/g,'').trim().slice(0,60000);return answer?{reply:answer}:{stopped:true};
  }
  return {};
 }
 function create({
   chrome=root.chrome,
   inject=root.CanvasHarnessInject,
   providers=root.CanvasHarnessProviders,
   now=()=>Date.now(),
   fetch=root.fetch?.bind(root),
   scriptTimeout=20000
 }={}){
  const blocked=(receipt,message,action='Open chat')=>({status:'needs-you',receipt,needsYou:{reason:message,action}});
  async function step(turn,checkpoint,{run,guard,claimProvider}={}){
   await guard();
   const provider=providers.get(run.provider);
   if(!provider||!await chrome.permissions.contains({permissions:['scripting'],origins:Array.from(provider.origins)}))
     return blocked(turn.deliveryReceipt,'Allow access to your AI website','Review settings');
   let receipt=turn.deliveryReceipt;
   // A sent (or being sent) Prepare or Ask on ChatGPT: the chat record answers first, whatever state the tab is in.
   const sentAt=Number(receipt?.sentAt||receipt?.intentAt||0);
   if(['send-intent','sent'].includes(receipt?.status)&&turn.expectedKind==='prepare'&&['chatgpt','claude'].includes(run.provider)&&sentAt&&now()-sentAt>15000){
    // A tab frozen before the send was confirmed still shows, in its address, which chat the message went to.
    let where=receipt.conversationURL;
    if(receipt.status==='send-intent'&&receipt.tabId!=null){
      const open=await chrome.tabs.get(receipt.tabId).catch(()=>null);
      try{const u=new URL(open?.url||'');if(u.origin===receipt.origin&&/^\/(?:c|chat)\/[\w-]{8,}/.test(u.pathname))where=open.url;}catch{}
    }
    // The chat this turn went to was opened by the run's latest turn that started a new chat (this one, or the one this
    // follow-up continues); that send time picks the chat out of the newest chats when its address is not known yet.
    let first=run.turnIndex;
    while(first>0&&!run.turns[first]?.fresh)first--;
    const openedBy=first===run.turnIndex?receipt:run.turns[first]?.deliveryReceipt,opened=Number(openedBy?.intentAt||openedBy?.sentAt||sentAt);
    const record=run.provider==='claude'?
      await claudeRecord({fetch,conversationURL:where,turnId:turn.id}):
      await chatRecord({fetch,conversationURL:where,turnId:turn.id,since:sentAt,opened,detail:true});
    await guard();
    if(record.reply)return {status:'reply',receipt:{...receipt,conversationURL:where},reply:record.reply};
    if(record.stopped)return blocked(receipt,'Your AI stopped without an answer','Try again');
   }
   const initial=url=>{const p=new URL(url).pathname;return ['','/','/new','/app'].includes(p.replace(/\/$/,''));};
   if(!receipt){
    // CH's chats stay out of the student's chat history: ChatGPT's temporary chat, Claude's incognito chat (the local
    // switch ch-ai-temporary-chat set to false turns this off).
    const away={chatgpt:'?temporary-chat=true',claude:'?incognito'}[run.provider];
    let temp=!!away;
    try{if(away&&(await chrome.storage.local.get('ch-ai-temporary-chat'))['ch-ai-temporary-chat']===false)temp=false;}catch{}
    // The local test switch ch-ai-test-model opens ChatGPT chats on that model (for checking weaker models).
    let model='';
    try{if(run.provider==='chatgpt')model=String((await chrome.storage.local.get('ch-ai-test-model'))['ch-ai-test-model']||'');}catch{}
    const base=temp?provider.url+away:provider.url,chatURL=/^[\w.-]{2,40}$/.test(model)?base+(base.includes('?')?'&':'?')+'model='+model:base;
    // A fresh turn (a retry after the AI stopped) starts a new chat in the same tab instead of following the last one.
    const previous=turn.fresh?null:run.turns.slice(0,run.turnIndex).at(-1)?.deliveryReceipt;let tab,bound=previous?.conversationURL;
    if(previous){
      receipt={v:1,tabId:previous.tabId,origin:previous.origin,conversationURL:bound,status:'target',at:now()};
      await checkpoint(receipt);
      try{tab=await chrome.tabs.get(previous.tabId);}catch{return blocked(receipt,'Open the original chat');}
     // A new chat gets its own address only after the first message is sent; follow it once the earlier turn is found there.
     if(tab?.url&&tab.url!==bound&&initial(bound)&&!initial(tab.url)&&new URL(tab.url).origin===previous.origin&&!tab.pendingUrl){
       const prior=run.turns[run.turnIndex-1];
       await guard();
       const seen=await chrome.scripting.executeScript({
         target:{tabId:tab.id,frameIds:[0]},
         world:'ISOLATED',
         func:inject.inspectTurn,
         args:[{id:run.provider,origin:previous.origin,expectedURL:tab.url,turnId:prior.id,text:prior.text,kind:prior.expectedKind,after:0,answerId:prior.id}]
       });
       await guard();
       if(seen?.[0]?.result?.status==='sent'){bound=tab.url;receipt={...receipt,conversationURL:bound};await checkpoint(receipt);}
     }
     if(!tab||tab.url!==bound||tab.pendingUrl&&tab.pendingUrl!==bound)return blocked(receipt,'Return to the original chat');}
    else{
     const key=(run.kind==='ask'?'ch-ai-ask:v1:':'ch-ai-prepare:v1:')+run.scope+':'+run.provider,saved=(await chrome.storage.session.get(key))[key];
     if(saved?.origin===new URL(provider.url).origin)try{tab=await chrome.tabs.get(saved.tabId);}catch{}
     // Each run starts its own new chat. A tab another unfinished run still holds keeps its chat; this run opens its own.
     if(tab)try{await guard();await claimProvider(tab.id);}catch(error){if(!/in use by another run/i.test(String(error?.message||error)))throw error;tab=null;}
     if(tab&&(turn.fresh||temp?tab.url!==chatURL:!(tab.url&&initial(tab.url)))){tab=await chrome.tabs.update(tab.id,{url:chatURL});bound=chatURL;}
     else if(tab)bound=tab.url;
     if(!tab){
       const canvas=await chrome.tabs.get(run.sourceTab),window=await chrome.windows.get(canvas.windowId);
       if(window.type!=='normal')return blocked(null,'Open a normal browser window');
       tab=await chrome.tabs.create({url:chatURL,active:false,windowId:canvas.windowId,openerTabId:run.sourceTab});
       bound=chatURL;
       await chrome.storage.session.set({[key]:{sourceTab:run.sourceTab,provider:run.provider,tabId:tab.id,origin:new URL(provider.url).origin}});
     }
    }
    await guard();
    await claimProvider(tab.id);
    receipt={v:1,tabId:tab.id,origin:new URL(provider.url).origin,conversationURL:bound||tab.url,status:'target',at:now()};
    await checkpoint(receipt);
   }
   let tab;try{tab=await chrome.tabs.get(receipt.tabId);}catch{return blocked(receipt,'Open the original chat');}
   // A tab that is still loading its chat page gets up to a minute before it counts as moved away.
   const pending=tab.pendingUrl||'',loading=tab.status==='loading'||!tab.url||pending&&pending!==tab.url;
   let pendingOrigin='';
   try{pendingOrigin=pending?new URL(pending).origin:'';}catch{}
   if(loading&&receipt.status==='target'&&now()-Number(receipt.at||0)<60000&&(!pending||pendingOrigin===receipt.origin))return {status:'waiting',receipt};
   if(!tab?.url||new URL(tab.url).origin!==receipt.origin||tab.pendingUrl&&tab.pendingUrl!==tab.url)return blocked(receipt,'Open the original chat');
   // A temporary local chat address ("/c/local-…") is replaced by the real one; the turn check below confirms it.
   const temporary=url=>{try{return new URL(url).pathname.startsWith('/c/local-');}catch{return false;}};
   // ChatGPT drops the test switch's ?model= once the chat opens; the address is the same chat without it.
   const same=(a,b)=>{try{const x=new URL(a),y=new URL(b);x.searchParams.delete('model');y.searchParams.delete('model');return x.href===y.href;}catch{return a===b;}};
   if(!same(tab.url,receipt.conversationURL)&&!initial(receipt.conversationURL)&&!temporary(receipt.conversationURL))return blocked(receipt,'Return to the original chat');
   const args={id:run.provider,origin:receipt.origin,expectedURL:tab.url,turnId:turn.id,text:turn.text,kind:turn.expectedKind,after:0,answerId:turn.id};
   // A sleeping (frozen) tab never runs a page script; after a while that counts as waiting, not as an answer.
   const asleep={asleep:true},execute=async(func,arg)=>{
     await guard();
     const result=await Promise.race([
       chrome.scripting.executeScript({target:{tabId:receipt.tabId,frameIds:[0]},world:'ISOLATED',func,args:[arg]}),
       new Promise(r=>setTimeout(()=>r(asleep),scriptTimeout))
     ]);
     await guard();
     return result===asleep?asleep:result?.[0]?.result;
   };
   const moved=async()=>{
     const latest=await chrome.tabs.get(receipt.tabId).catch(()=>null);
     try{return !!latest?.url&&latest.url!==args.expectedURL&&new URL(latest.url).origin===receipt.origin;}catch{return false;}
   };
   let evidence=await execute(inject.inspectTurn,args);if(evidence?.asleep)return {status:'waiting',receipt};
   if(evidence?.status==='needs-you'&&evidence.message==='Open the original chat'&&await moved())return {status:'waiting',receipt};
   if(!same(tab.url,receipt.conversationURL)&&evidence?.status!=='sent')return blocked(receipt,'Return to the original chat');
   if(evidence?.status==='needs-you'&&!(receipt.status==='target'&&evidence.message==='Review the existing draft'))
     return blocked(receipt,evidence.message,/draft/i.test(evidence.message)?'Review draft':'Open chat');
   if(evidence?.status==='sent'){
    receipt={...receipt,status:'sent',conversationURL:tab.url,sentAt:receipt.sentAt||now()};await checkpoint(receipt);
    const reply=await execute(inject.readStudyBlock,args);if(reply?.asleep)return {status:'waiting',receipt};
    const cards=value=>{
      try{
        const raw=String(value||'').replace(/<\/?escape>/g,''),open=raw.indexOf('{'),close=raw.lastIndexOf('}');
        return open>=0&&close>open&&Array.isArray(JSON.parse(raw.slice(open,close+1))?.cards);
      }catch{return false;}
    };
    if(reply?.status==='answer'&&(args.kind!=='prepare'||cards(reply.text)))return {status:'reply',receipt,reply:reply.text};
    if(reply?.status==='answer')return {status:'reply',receipt,reply:reply.text};
    if(reply?.status==='stopped'&&await moved())return {status:'waiting',receipt};
    if(reply?.status==='provider-error'&&reply.message==='The AI stopped before answering')return blocked(receipt,reply.message,'Try again');
    if(['provider-error','stopped','unreadable'].includes(reply?.status))return blocked(receipt,reply.message||'The reply could not be read','Read reply');
    if(now()-receipt.sentAt>30*60*1000)return blocked(receipt,'The AI reply is taking longer than expected','Read reply');
    return {status:'waiting',receipt};
   }
   // Even if Send threw or the worker vanished before it clicked, never replay this intent.
   if(['send-intent','sent'].includes(receipt.status)){
    if(now()-(receipt.intentAt||receipt.sentAt)>15000)return blocked(receipt,'Send could not be confirmed. Review the chat','Review draft');
    return {status:'waiting',receipt};
   }
   // A fresh chat in a background tab can take a while to show its composer (and longer while ChatGPT is busy).
   if(evidence?.status!=='ready'&&now()-receipt.at>(receipt.status==='staged'?90000:45000))return blocked(receipt,evidence?.message||'Review the chat composer','Review draft');
   if(receipt.status!=='staged'){
    await guard();
    const staged=await chrome.scripting.executeScript({
      target:{tabId:receipt.tabId,frameIds:[0]},
      world:'ISOLATED',
      func:inject.insertDraft,
      args:[turn.text,{...args,autoSend:false,consent:run.consent}]
    });
    await guard();
    const result=staged?.[0]?.result;
    if(result?.status==='needs-you')return blocked(receipt,result.message,'Review draft');
    if(result?.status==='no-editor'&&result.retryable&&!/did not keep the inserted text/i.test(result.message||''))return {status:'waiting',receipt};
    if(result?.status!=='injected')return blocked(receipt,result?.message||'Review the chat composer','Review draft');
    receipt={...receipt,status:'staged'};await checkpoint(receipt);return {status:'waiting',receipt};
   }
   if(evidence?.status!=='ready')return {status:'waiting',receipt};
   receipt={...receipt,status:'send-intent',intentAt:now()};await checkpoint(receipt);await guard();
   const clicked=await execute(inject.inspectTurn,{...args,mode:'click',consent:run.consent,runId:run.id,epoch:run.lease.epoch});
   if(clicked?.status==='needs-you')return blocked(receipt,clicked.message,'Review draft');
   return {status:'waiting',receipt};
  }
  return {deliver:step,observe:step,recover:step,cancel:async()=>({stoppedLocally:true,remoteMayContinue:true})};
 }
 return {create,chatRecord,claudeRecord,answerAfter,replyBegun};
});
