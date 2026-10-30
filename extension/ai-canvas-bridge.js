/* Bounded Canvas GET commands, executed in a verified same-origin content script. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessCanvasBridge=api;
})(globalThis,function(root){
 'use strict';
 let channel=0;
 const SITE=(globalThis.ReserveSite?.origin?.()||'https://school.instructure.com'),MAX_JSON=4*1024*1024,MAX_FILE=2*1024*1024;
 const unavailable=()=>Object.assign(Error('Waiting for the verified Canvas page to return.'),{code:'canvas-page-unavailable'});
 function target(value,origin=SITE){
   const u=new URL(value,origin);
   if(u.origin!==SITE||origin!==SITE||u.username||u.password||u.hash||!/^\/api\/v1\/|^\/files\/\d+\/download$/.test(u.pathname))throw Error('Only Canvas GET reads are allowed.');
   return u;
 }
 function serve({env=root,scope,guard=()=>true,fetchImpl=env.fetch?.bind(env)}={}){
  const runtime=env.chrome?.runtime;if(!runtime?.onMessage||!env.document||env.location?.origin!==SITE)return()=>{};
  const pending=new Map();
  function check(){if(!guard()||env.location.origin!==SITE||/\/quizzes\/[^/?#]+\/(?:take|resume)(?:[/?#]|$)|\/assessment_sessions\//i.test(env.location.href))throw unavailable();}
  async function read(message){
    check();
    if(message.scope!==scope)throw Object.assign(Error('Your Canvas account changed.'),{code:'account'});
    if(message.op==='probe')return {origin:SITE,accountId:scope.split('|')[1]};
   const url=target(message.url),limit=url.pathname.startsWith('/api/')?MAX_JSON:MAX_FILE,controller=new AbortController();
   if(pending.size>=16)throw unavailable();
   pending.set(message.id,controller);
   const timer=env.setTimeout(()=>controller.abort(),15000);
   // A file download is the one read that follows Canvas's redirect to its signed file host, as the page's PDF reader
   // does: cookies stay with Canvas (same-origin), no referrer is sent, and the signed address is not returned.
   const file=/^\/files\/\d+\/download$/.test(url.pathname);
   try{
     const response=await fetchImpl(url.href,{
       method:'GET',
       credentials:'same-origin',
       redirect:file?'follow':message.redirect==='manual'?'manual':'error',
       ...(file?{referrerPolicy:'no-referrer'}:{}),
       cache:'no-store',
       headers:{Accept:url.pathname.startsWith('/api/')?'application/json+canvas-string-ids':'application/pdf,text/plain'},
       signal:controller.signal
     });
     check();
    if(file){
      let final=null;
      try{final=response.url?new URL(response.url):null;}catch{}
      if(final&&final.protocol!=='https:'||final&&final.origin===SITE&&/^\/(?:login|logout|saml|oauth|login_sessions)(?:\/|$)/i.test(final.pathname))
        throw Object.assign(Error('Sign in to Canvas.'),{code:'auth'});
      if(response.type==='opaqueredirect'||response.type==='opaque')throw Error('Canvas redirected this read.');
    }
    else if(response.url&&new URL(response.url).origin!==SITE||response.type==='opaqueredirect'||response.redirected)throw Error('Canvas redirected this read.');
    if(Number(response.headers.get('content-length'))>limit)throw Error('Canvas read exceeds its byte limit.');let bytes;
    if(response.body?.getReader){
      const reader=response.body.getReader(),chunks=[];
      let size=0;
      try{
        for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limit)throw Error('Canvas read exceeds its byte limit.');chunks.push(next.value);}
        bytes=new Uint8Array(size);
        let at=0;
        for(const part of chunks){bytes.set(part,at);at+=part.length;}
      }finally{await Promise.resolve(reader.cancel?.()).catch(()=>{});reader.releaseLock?.();}
    }
    else bytes=new TextEncoder().encode(await response.text());
    if(bytes.length>limit)throw Error('Canvas read exceeds its byte limit.');
    check();
    let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {
      status:response.status,
      url:file?url.href:response.url||url.href,
      type:file?'basic':response.type||'basic',
      headers:Object.fromEntries(['content-type','content-length','link','location','retry-after'].map(k=>[k,response.headers.get(k)||''])),
      base64:env.btoa(binary)
    };
   }finally{env.clearTimeout(timer);pending.delete(message.id);}
  }
  const listener=(message,sender,reply)=>{
    if(message?.target!=='ch-ai-canvas-read')return;
    if(sender.id!==runtime.id||sender.tab||message.scope!==scope){reply({ok:false,code:'account',error:'A verified Canvas account is required.'});return;}
   if(message.op==='cancel'){pending.get(message.id)?.abort();reply({ok:true});return;}
   read(message).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message,code:error.code||'network'}));return true;};
  runtime.onMessage.addListener(listener);return()=>{runtime.onMessage.removeListener(listener);for(const c of pending.values())c.abort();pending.clear();};
 }
 function createFetch({chrome=root.chrome,run,fetchImpl=root.fetch?.bind(root),atob=root.atob?.bind(root)}={}){
  const scope=run.scope,origin=scope.split('|')[0];let route,sequence=0;const prefix=root.crypto?.randomUUID?.()||'channel-'+(++channel);
  // A sleeping or frozen tab can leave a message unanswered forever; every page message has a deadline.
  const ask=(id,message,ms)=>new Promise((resolve,reject)=>{
    const timer=(root.setTimeout||setTimeout)(()=>reject(unavailable()),ms);
    Promise.resolve().then(()=>chrome.tabs.sendMessage(id,message)).then(value=>{
      (root.clearTimeout||clearTimeout)(timer);
      resolve(value);
    },error=>{(root.clearTimeout||clearTimeout)(timer);reject(error);});
  });
  async function select(){
    const listed=await chrome.tabs.query({url:origin+'/*'}),ids=[...new Set([run.sourceTab,...listed.map(t=>t.id)].filter(Number.isInteger))],candidates=[];
   for(const id of ids){
     const tab=await chrome.tabs.get(id).catch(()=>null);
     if(tab?.url&&new URL(tab.url).origin===origin&&!tab.discarded&&!tab.frozen&&tab.status!=='unloaded')candidates.push(id);
   }
   const replies=await Promise.all(candidates.map(id=>ask(id,{target:'ch-ai-canvas-read',op:'probe',scope},4000).then(reply=>({id,reply}),()=>({id}))));
   for(const {id,reply} of replies){if(id===run.sourceTab&&reply?.code==='account')throw Object.assign(Error('Your Canvas account changed.'),{code:'account'});}
   const usable=replies.filter(({reply})=>reply?.ok&&reply.result?.origin===origin&&String(reply.result.accountId)===scope.split('|')[1]);
   const chosen=usable.find(({id})=>id===run.sourceTab)||usable[0];if(chosen)return {tabId:chosen.id};
   if(candidates.length||Number.isInteger(run.sourceTab))throw unavailable();return {fallback:true};
  }
  const read=async(value,options={})=>{
    const url=target(value,origin);
    if(options.method&&options.method!=='GET')throw Error('Canvas writes are forbidden.');
    if(options.signal?.aborted)throw Object.assign(Error('Read stopped.'),{code:'cancelled'});
   try{
     const selected=await (route||=select());
     if(selected.fallback){
       const response=await fetchImpl(url.href,{...options,method:'GET',credentials:'include',redirect:options.redirect==='manual'?'manual':'error'});
       if(response.url&&new URL(response.url).origin!==origin)throw Error('Canvas redirected this read.');
       return response;
     }
    const id=prefix+'-read-'+(++sequence),abort=()=>{void chrome.tabs.sendMessage(selected.tabId,{target:'ch-ai-canvas-read',op:'cancel',scope,id}).catch(()=>{});};
    options.signal?.addEventListener('abort',abort,{once:true});
    let envelope;
    try{
      envelope=await ask(selected.tabId,{target:'ch-ai-canvas-read',op:'read',scope,id,url:url.href,redirect:options.redirect},30000);
    }catch{route=undefined;throw unavailable();}finally{options.signal?.removeEventListener('abort',abort);}
    if(!envelope?.ok&&(!envelope?.code||envelope.code==='canvas-page-unavailable'))route=undefined;
    if(!envelope?.ok)throw Object.assign(Error(envelope?.error||'Waiting for Canvas.'),{code:envelope?.code||'canvas-page-unavailable'});
    if(options.signal?.aborted)throw Object.assign(Error('Read stopped.'),{code:'cancelled'});
    const r=envelope.result,binary=atob(r.base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    if(bytes.length>(url.pathname.startsWith('/api/')?MAX_JSON:MAX_FILE))throw Error('Canvas read exceeds its byte limit.');
    return {
      status:r.status,
      ok:r.status>=200&&r.status<300,
      url:r.url,
      type:r.type,
      headers:{get:k=>r.headers[k.toLowerCase()]||null},
      text:async()=>new TextDecoder().decode(bytes),
      json:async()=>JSON.parse(new TextDecoder().decode(bytes)),
      body:{getReader(){
      let done=false;
      return {async read(){if(done)return {done:true};done=true;return {done:false,value:bytes};},async cancel(){done=true;},releaseLock(){}};
    }}};
   }catch(error){if(error.code==='canvas-page-unavailable')read.unavailable=error;throw error;}
  };return read;
 }
 return {serve,createFetch};
});
