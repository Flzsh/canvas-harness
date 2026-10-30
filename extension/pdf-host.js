// PDF mark-up tools adapted from HarryX081125's work, issue #53.
// Adapted from Gary Wu's pull request #47 to Canvas Harness.
/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
(function(root){
 'use strict';
 const MAX_BYTES=32*1024*1024,WIDTH_KEY='reserve:pdf-width',APPEARANCE_KEY='reserve:appearance';
 const filePath=/^\/(?:(?:courses\/\d+|api\/v1(?:\/courses\/\d+)?)\/)?files\/(\d+)(?:\/(?:download|preview|file_preview))?\/?$/;
 const filesPath=/^\/(?:courses\/\d+\/)?files(?:\/folder(?:\/.*)?)?\/?$/;
 const pdfEvidence=/(?:\.pdf)(?:$|[?#\s"'(),;])|(?:^|[\s;,])application\/pdf(?:$|[\s;,])|(?:^|\s)PDF File\b/i;
 const attribute=(node,key)=>String(node?.getAttribute?.(key)??'');
 function pdfPage(value){
   try{
     const path=decodeURIComponent(new URL(value?.href||value,'https://school.instructure.com/').pathname);
     return /^\/(?:dashboard\/?)?$/.test(path)||
       filesPath.test(path)||
       /^\/files\/\d+(?:\/(?:preview|file_preview))?\/?$/.test(path)||
       /^\/courses\/\d+\/?$/.test(path)||
       /^\/courses\/\d+\/(?:files|modules|pages|announcements|discussion_topics)(?:\/|$)/.test(path)||
       /^\/courses\/\d+\/assignments\/(?:\d+|syllabus)(?:\/|$)/.test(path);
   }catch{return false;}
 }
 function moduleURL(value,origin){
   try{const url=new URL(value,origin);return url.origin===origin&&!url.username&&!url.password&&/^\/courses\/\d+\/modules\/items\/\d+\/?$/.test(url.pathname)?url:null;}catch{return null;}
 }
 function fileURL(value,origin){
  if(!value||typeof value!=='string')return null;
  try{
   const url=new URL(value,origin);
   if(url.origin!==origin||url.username||url.password)return null;
   const id=url.pathname.match(filePath)?.[1]||(filesPath.test(url.pathname)&&/^\d+$/.test(url.searchParams.get('preview')||'')?url.searchParams.get('preview'):null);
   return id?{id,url}:null;
  }catch{return null;}
 }
 function clickElement(event){
  if(!event||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.defaultPrevented)return null;
  try{
   for(const node of event.composedPath?.()||[event.target]){
    const el=(node?.closest?node:node?.parentElement)?.closest?.('a[href],button,[role="button"],[data-pdf-file-id],[data-api-endpoint],[data-api-returntype],.file_preview_link,.inline_file_preview');
    if(el)return el;
   }
  }catch{}
  return null;
 }
 function nativeDownload(el){
  const labels=[attribute(el,'title'),attribute(el,'aria-label'),el?.textContent||''].join(' ');
  return el?.hasAttribute?.('download')||el?.getAttribute?.('download')!=null||attribute(el,'data-pdf-download')==='true'||
   /(?:^|\s)download(?:\s|$)/i.test(labels)||/(?:^|[\s_-])download(?:[\s_-]|$)/i.test(String(el?.className||''));
 }
 function matchRemotePdf(el,origin){
  if(String(el?.tagName||'').toUpperCase()!=='A'||nativeDownload(el))return null;
  try{
   const url=new URL(el.href||attribute(el,'href'),origin);
   if(url.protocol!=='https:'||url.origin===origin||url.username||url.password||!/\.pdf$/i.test(decodeURIComponent(url.pathname)))return null;
   const originalURL=url.href,page=Number(new URLSearchParams(url.hash.slice(1)).get('page'));url.hash='';
   const text=String(el.textContent||'').replace(/[\s\u2197]+$/,'').trim(),name=text?text.replace(/\.pdf$/i,'')+'.pdf':decodeURIComponent(url.pathname.split('/').pop());
   return {element:el,originalURL,remote:url.href,url:url.href,page:Number.isSafeInteger(page)&&page>0?page-1:null,name:name.slice(0,240),preview:false};
  }catch{return null;}
 }
 async function remoteFileId(value,crypto=root.crypto){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password)throw Error('A secure PDF address is required.');
  url.hash='';
  if(!crypto?.subtle?.digest)throw Error('A secure PDF identity could not be created.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url.href));
  return 'remote-'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 }
 function matchCanvasFile(event,origin){
  const el=clickElement(event);
  if(String(el?.tagName||'').toUpperCase()!=='A'||nativeDownload(el))return null;
  const href=attribute(el,'href');if(!href||href.startsWith('#'))return null;
  const file=fileURL(el.href||href,origin);
  if(!file||/\/(?:download)\/?$/.test(file.url.pathname)||file.url.pathname.startsWith('/api/'))return null;
  return {element:el,fileId:file.id,originalURL:file.url.href,url:origin+'/files/'+file.id+'/download',metadata:true,preview:false};
 }
 function matchPdfClick(event,origin){
  const el=clickElement(event);if(!el||nativeDownload(el))return null;
  const remote=matchRemotePdf(el,origin);if(remote)return remote;
  const rawHref=attribute(el,'href');
  const href=rawHref.startsWith('#')?rawHref:typeof el.href==='string'&&el.href||rawHref;
  if(href&&!href.startsWith('#')){
   try{const url=new URL(href,origin);if(url.origin!==origin||url.username||url.password)return null;}catch{return null;}
  }
  const dashboardId=attribute(el,'data-pdf-file-id'),courseId=attribute(el,'data-pdf-course-id'),itemURL=moduleURL(href,origin),row=el.closest?.('.context_module_item,.ef-item-row')||null;
  if(itemURL){
    const type=attribute(row,'data-module-type')||attribute(row,'data-type');
    if(type&&!/^(?:file|attachment)$/i.test(type)||/\b(?:wiki_page|assignment|discussion_topic|quiz|external_url|external_tool)\b/.test(String(row?.className||'')))return null;
  }
  const preview=/\b(?:file_preview_link|inline_file_preview|instructure_file_link)\b/i.test(String(el.className||''))||
   /^(?:true|1|pdf)$/i.test(attribute(el,'data-preview'))||attribute(el,'data-api-returntype')==='File';
  // Canvas preview toggles are frequently siblings of the actual download
  // anchor inside a shared holder; prefer that holder to the toggle itself.
  const parent=el.closest?.('.instructure_file_link_holder')||
   el.parentElement?.closest?.('.instructure_file_link_holder')||
   el.closest?.('.file_preview_link, .inline_file_preview')||null;
  if(!href&&!preview&&!dashboardId)return null;
  const filename=[attribute(el,'data-pdf-name'),attribute(el,'data-pdf-mime'),attribute(el,'data-filename'),attribute(el,'data-display-name'),
   attribute(el,'title'),attribute(el,'aria-label'),el.textContent||'',
   attribute(el,'href'),el.href||'',attribute(el,'data-content-type'),attribute(el,'data-mime-type'),
   attribute(el,'type'),attribute(parent,'title'),attribute(parent,'data-filename'),attribute(row,'data-filename'),attribute(row,'data-content-type'),attribute(row,'data-mime-type')].join(' ');
  const sibling=parent?.querySelector?.('a[data-api-returntype="File"], a[href*="/files/"]')||null;
  const evidence=pdfEvidence.test(filename)||
   (sibling&&pdfEvidence.test([sibling.textContent,attribute(sibling,'title'),attribute(sibling,'href')].join(' ')));
  if(!evidence)return null;
  // Canvas's metadata endpoint provides an ID for download and inline-preview toggles.
  // Require that ID to resolve back to this exact authorized Canvas origin.
  // A "#" link resolves to the page it sits on (a file's own page names another file), so only real addresses count.
  const real=a=>{const v=attribute(a,'href');return v&&!v.startsWith('#')?[v,a.href]:[];};
  const paths=[...real(el),attribute(el,'data-api-endpoint'),
   attribute(parent,'data-api-endpoint'),...real(sibling),attribute(sibling,'data-api-endpoint')];
  let found=null;
  for(const value of paths){found=fileURL(value,origin);if(found)break;}
  if(!found&&/^\d+$/.test(dashboardId)&&/^\d+$/.test(courseId))found={id:dashboardId};
  if(!found&&itemURL){
    const type=attribute(row,'data-module-type')||attribute(row,'data-type'),
      id=attribute(el,'data-file-id')||attribute(row,'data-file-id')||(/^(?:file|attachment)$/i.test(type)||/\battachment\b/.test(String(row?.className||''))?attribute(row,'data-content-id'):'');
    if(/^\d+$/.test(id))found={id};
  }
  if(!found&&
    !itemURL&&
    /\bef-item-row\b/.test(String(row?.className||''))&&
    /\bef-name-col(?:__link)?\b/.test(String(el.className||''))&&
    !/folder/i.test(attribute(row,'data-type')||String(row.className||''))){
    const id=attribute(row,'data-id');
    if(/^\d+$/.test(id))found={id};
  }
  if(!found&&preview&&!itemURL){
   const id=attribute(el,'data-file-id')||attribute(el,'data-id')||attribute(parent,'data-file-id');
   if(/^\d+$/.test(id))found={id};
  }
  if(!found&&!itemURL)return null;
  const names=[attribute(el,'data-pdf-name'),attribute(el,'data-filename'),attribute(el,'data-display-name'),
   attribute(el,'title'),String(el.textContent||'').trim(),attribute(sibling,'title'),String(sibling?.textContent||'').trim()]
   .map(value=>value.replace(/^\s*PDF File\s*/i,'').trim());
  const moduleName=/\bPDF File\b/i.test(filename)?names.find(Boolean):'';
  const name=names[0]||names.find(value=>/\.pdf(?:$|[\s"'(),;])/i.test(value))||(moduleName?moduleName+'.pdf':'Canvas PDF '+(found?.id||'document')+'.pdf');
  const originalURL=href&&!href.startsWith('#')?
    new URL(href,origin).href:
    fileURL(attribute(sibling,'href')||sibling?.href,origin)?.url.href||(found?origin+(/^\d+$/.test(courseId)?'/courses/'+courseId:'')+'/files/'+found.id:itemURL.href);
  return {
    element:el,
    originalURL,
    ...(found?{fileId:found.id,url:origin+'/files/'+found.id+'/download'}:{moduleURL:itemURL.href,url:itemURL.href}),
    name:name.trim().slice(0,240),
    preview:Boolean(preview)
  };
 }
 async function readVerifiedPdf({origin,fileId,fetchImpl,signal,maxBytes=MAX_BYTES}){
  let target;
  try{target=new URL('/files/'+String(fileId)+'/download',origin);}catch{throw Error('Invalid Canvas file URL.');}
  if(!/^https:$/.test(target.protocol)||target.origin!==origin||!(/^\d+$/.test(String(fileId))))throw Error('Only secure same-origin Canvas files may be read.');
  if(typeof fetchImpl!=='function')throw Error('Canvas file fetching is unavailable.');
  let response;
  try{response=await fetchImpl(target.href,{method:'GET',credentials:'same-origin',redirect:'follow',referrerPolicy:'no-referrer',signal});}
  catch(error){
   if(signal?.aborted)throw Error('PDF loading was cancelled.');
   if(error instanceof TypeError)throw Error('Canvas may redirect this file to its inst-fs storage host. Browser CORS blocked the read; opening the original Canvas viewer.');
   throw error;
  }
  if(!response?.ok||response.type==='opaque'||response.type==='opaqueredirect')throw Error('Canvas denied this PDF download; opening the original viewer.');
  if(response.url){
   try{if(new URL(response.url).protocol!=='https:')throw Error('Insecure redirected PDF URL.');}
   catch{throw Error('Canvas returned an invalid PDF download URL.');}
  }
  const length=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(length)&&length>maxBytes)throw Error('PDF exceeds the 32 MiB reading limit. Open it in Canvas.');
  const reader=response.body?.getReader?.();
  if(!reader)throw Error('Canvas did not provide a bounded PDF stream. Open it in Canvas.');
  const chunks=[];let size=0;
  try{
   while(true){
    const {done,value}=await reader.read();if(done)break;
    if(!(value instanceof Uint8Array))throw Error('Invalid Canvas PDF byte stream.');
    size+=value.byteLength;
    if(size>maxBytes){await reader.cancel?.();throw Error('PDF exceeds the 32 MiB reading limit. Open it in Canvas.');}
    chunks.push(value);
   }
  }finally{reader.releaseLock?.();}
  if(size<5)throw Error('Canvas returned an empty or invalid PDF.');
  const bytes=new Uint8Array(size);let cursor=0;
  for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.byteLength;}
  if(String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-')throw Error('The downloaded file is not a PDF. Opening it in Canvas.');
  return bytes.buffer;
 }
 function create({root:env=root}={}){
  const enabled=id=>!env.ReserveFeatures||env.ReserveFeatures.enabled(id);
  if(!enabled('pdf'))return null;
  const site=env.ReserveSite;
  const allowed=()=>site?.supported?.(env.location?.href)&&pdfPage(env.location);
  if(!env.document||!allowed())return null;
  const doc=env.document,model=env.ReservePdfModel||root.ReservePdfModel;
  if(!model)return null;
  // The fixed reader WAR is intentionally limited to Instructure Canvas.
  // Dynamic custom school sites must retain the native viewer until a
  // narrowly scoped per-origin reader exposure mechanism exists.
  const fixedReaderOrigin=/(?:^|\.)instructure\.com$/i.test(new URL(env.location.origin).hostname);
  let active=null,dead=false,replaying=false,notice=null,noticeTimer=null,noticeOwner=null,openGeneration=0,closeSequence=0,localReadSequence=0;
  let switchButton=null,switchInfo=null,switchSticky=false,hrefTimer=null,addressReady=null,viewerMode='reader';
  const pending=new Set(),noticeDownloads=new Set();
  const runtime=()=>env.chrome?.runtime;
  const persisted=async key=>{try{return (await env.chrome?.storage?.local?.get?.(key))?.[key];}catch{return undefined;}};
  const saveWidth=width=>{Promise.resolve(env.chrome?.storage?.local?.set?.({[WIDTH_KEY]:width})).catch(()=>{});};
  function cleanNotice(){
   if(noticeTimer!=null){env.clearTimeout?.(noticeTimer);noticeTimer=null;}
   notice?.remove?.();notice=null;noticeOwner=null;
   for(const url of noticeDownloads)(env.URL||root.URL).revokeObjectURL(url);noticeDownloads.clear();
  }
  function inform(message,file=null){
   cleanNotice();
   if(!doc.body)return;
   notice=doc.createElement('div');notice.className='reserve-pdf-fallback';notice.setAttribute('role','status');
   notice.style.cssText='position:fixed;z-index:2147483050;bottom:20px;right:20px;max-width:min(480px,calc(100vw - 40px));padding:14px 18px;background:#fff9ea;color:#28231d;border:2px solid #9b6543;border-radius:8px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 8px 25px #1414132e';
   notice.textContent=message;doc.body.append(notice);
   if(file){
    noticeOwner=file.owner;const shown=notice,button=doc.createElement('button');button.type='button';button.textContent='Download saved PDF';button.style.marginLeft='8px';notice.append(button);
    button.addEventListener('click',async()=>{
     const task={info:file,abort:new AbortController(),reject:()=>{}};pending.add(task);button.disabled=true;
     try{
      await verifyAccount(task);if(dead||shown!==notice||task.abort.signal.aborted||!allowed())return;
      const urls=env.URL||root.URL,url=urls.createObjectURL(file.blob),link=doc.createElement('a');
      noticeDownloads.add(url);
      link.href=url;
      link.download=file.name||'Saved document.pdf';
      doc.body.append(link);
      link.click();
      link.remove();
      env.setTimeout?.(()=>{if(noticeDownloads.delete(url))urls.revokeObjectURL(url);},60000);
     }catch(error){if(!task.abort.signal.aborted&&shown===notice)inform(String(error?.message||error));}
     finally{task.abort.abort();pending.delete(task);button.disabled=false;}
    });
   }else noticeTimer=env.setTimeout?.(cleanNotice,10000);
  }
  function restore(state,focus=true){
   if(!state||state.closed)return;
   state.closed=true;
   const request=state.closeRequest;state.closeRequest=null;if(request)env.clearTimeout?.(request.timer);request?.resolve(false);
   state.abort.abort();
   for(const timer of state.timers)env.clearTimeout?.(timer);
   for(const dispose of state.dispose)try{dispose();}catch{}
   state.ai?.destroy?.();state.ai=null;
   state.aiShell?.remove?.();state.frame?.remove?.();state.panel?.remove?.();
   state.link?.remove?.();state.scope?.remove?.();
   if(active===state)active=null;
   if(focus&&state.trigger?.isConnected!==false)state.trigger?.focus?.({preventScroll:true});
  }
  function fallback(state,error){
   if(!state||state!==active||state.closed)return;
   if(state.info.openGeneration!==openGeneration){if(state.closeRequest)settleClose(state,true);else restore(state,false);return;}
   const message=String(error?.message||error||'The PDF could not be opened.');
   restore(state,false);
   if(state.info.local){inform(message,state.info);return;}
   inform(state.info.remote?message+' Opening the original link.':message.includes('inst-fs')?message:message+' Returning to the original Canvas viewer.');
   // Replay the same Canvas click once, bypassing only our delegated listener.
   // This preserves Canvas's own inline preview handlers and link behavior.
   replayClick(state.info);
  }
  function replayClick(info){
   if(info.local){inform('Open this saved PDF from its signed-in Canvas account.');return;}
    if(info.addressHref||info.canvasVisible)return;
   replaying=true;
   try{
    if(info.element?.isConnected!==false&&typeof info.element?.click==='function')info.element.click();
    else env.location?.assign?.(info.originalURL||info.url);
   }finally{replaying=false;}
  }
  // This reader takes the click from the Modules page, so a module PDF it opened counts as opened here, as it does in
  // Canvas's viewer; modules-page.js keeps its own account and eligibility checks.
  function moduleOpened(info){
   const row=info.element?.closest?.('li.context_module_item'),item=/^context_module_item_(\d+)$/.exec(row?.id||'')?.[1]||/\/modules\/items\/(\d+)\/?$/.exec(info.moduleURL||'')?.[1];
   if(item)Promise.resolve().then(()=>env.ReserveModulesPage?.progress?.opened(item)).catch(()=>{});
  }
  async function resolveModule(info){
   const task={abort:new AbortController()};let response;pending.add(task);
   try{
    const deadline=new Promise((_,reject)=>{task.reject=reject;task.timer=env.setTimeout?.(()=>{task.abort.abort();reject(Error('Canvas did not resolve this module file in time.'));},20000);});
    response=await Promise.race([env.fetch(info.moduleURL,{method:'GET',credentials:'same-origin',redirect:'follow',signal:task.abort.signal}),deadline]);
    const file=response?.ok&&fileURL(response.url,env.location.origin);
    if(!file)throw Error('Canvas did not resolve this module item to a file.');
    return {...info,fileId:file.id,url:env.location.origin+'/files/'+file.id+'/download'};
   }finally{env.clearTimeout?.(task.timer);task.abort.abort();pending.delete(task);try{void response?.body?.cancel?.()?.catch?.(()=>{});}catch{}}
  }
   async function fileMeta(info){
    const task={abort:new AbortController()};pending.add(task);
    try{
     const deadline=new Promise((_,reject)=>{task.reject=reject;task.timer=env.setTimeout?.(()=>{task.abort.abort();reject(Error('Canvas did not identify this file in time.'));},15000);});
     return await Promise.race([(async()=>{
      const response=await env.fetch(env.location.origin+
        '/api/v1/files/'+
        info.fileId,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json+canvas-string-ids'},signal:task.abort.signal});
      if(!response?.ok||!response.headers?.get?.('content-type')?.includes('json'))throw Error('Canvas did not identify this file.');
      const meta=await response.json();
      if(!meta||typeof meta!=='object'||Array.isArray(meta)||meta.id!=null&&String(meta.id)!==info.fileId)throw Error('Canvas returned a different file.');
      const isPdf=/^application\/pdf(?:\s*;|$)/i.test(meta['content-type']||meta.content_type||'')||/\.pdf$/i.test(meta.display_name||'')||/\.pdf$/i.test(meta.filename||'');
      return isPdf?{...info,metadata:false,name:String(meta.display_name||meta.filename||'Canvas PDF '+info.fileId+'.pdf').slice(0,240)}:null;
     })(),deadline]);
    }finally{env.clearTimeout?.(task.timer);task.abort.abort();pending.delete(task);}
   }
  async function verifyAccount(state){
   const response=await env.fetch(env.location.origin+'/api/v1/users/self/profile',{
    method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json+canvas-string-ids'},signal:state.abort.signal
   });
   if(!response.ok||!response.headers?.get?.('content-type')?.includes('json'))throw Error('Canvas sign-in could not be verified.');
   const accountId=String((await response.json()).id);
   if(!/^\d+$/.test(accountId))throw Error('Canvas returned an invalid account.');
   if(state.info?.local&&(env.location.origin!==state.info.owner.origin||accountId!==state.info.owner.accountId))throw Error('Your Canvas account changed. Reopen the saved file from its own account.');
   return accountId;
  }
  async function replyAccount(state,requestId){
   let result;
   try{result={accountId:await verifyAccount(state)};}
   catch(error){if(state.info.local){fallback(state,error);return;}result={error:String(error?.message||error)};}
   if(state!==active||state.closed)return;
   try{state.frame.contentWindow.postMessage({type:'reserve-pdf-account-result',token:state.token,requestId,...result},state.extensionOrigin);}catch{}
  }
  async function openAI(state,message){
   if(state.info.local||state.info.remote||!enabled('ai')||state!==active||state.closed)return;
   const generation=state.aiGeneration=(state.aiGeneration||0)+1;
   const text=typeof message.text==='string'?message.text.trim():'';
   const page=message.page,endPage=message.endPage??message.page;
   if(!text||text.length>100000||!Number.isSafeInteger(page)||page<0||!Number.isSafeInteger(endPage)||endPage<page){state.status.textContent='Choose text from a PDF page to ask AI.';return;}
   if(!env.CanvasHarnessAISource?.mount){state.status.textContent='AI setup is unavailable here. Reload Canvas Harness.';return;}
   // Use the exact Canvas self-profile verification that the existing AI
   // background repeats before sharing context. Never infer the account from
   // the filename or stale extension storage.
   state.status.hidden=false;state.status.textContent='Checking your Canvas sign-in for AI…';
   let accountId;
   try{accountId=await verifyAccount(state);}catch(error){
    if(!enabled('ai')||state!==active||state.closed||generation!==state.aiGeneration)return;
    state.status.textContent='AI setup unavailable: '+String(error.message||error);
    return;
   }
   if(!enabled('ai')||state!==active||state.closed||generation!==state.aiGeneration)return;
   state.ai?.destroy?.();state.aiShell?.remove?.();
   const shell=doc.createElement('section');shell.className='reserve-pdf-ai-shell';shell.setAttribute('role','dialog');
   shell.setAttribute('aria-label','Ask AI about selected PDF text');
   const header=doc.createElement('header');header.className='reserve-pdf-ai-heading';
   const label=doc.createElement('strong');label.textContent='Ask AI · '+state.info.name+' · '+(endPage===page?'page '+(page+1):'pages '+(page+1)+'–'+(endPage+1));
   // The panel inside has its own close (×); the heading only names the file and page it is about.
   const content=doc.createElement('div');content.className='reserve-pdf-ai-body';header.append(label);shell.append(header,content);state.panel.append(shell);
   // A sidebar of the reader, not a box over it: the reader narrows beside it, and the split widens to make room
   // (back to the width it had when the sidebar closes, unless the student has dragged it since).
   state.panel.classList?.add('has-ai');if(state.aiRestore==null)state.aiRestore=state.width;
   const before=state.aiRestore,wide=Math.min(Math.round(env.innerWidth*.86),before+400);
   if(wide>state.width)state.setWidth?.(wide);state.aiWidened=state.width;
   let settings={toolbox:{aiAutoSend:false}};
   const store={get:()=>settings,update:async mutate=>{mutate(settings);return settings;}};
   const dispose=()=>{
     state.ai?.destroy?.();
     state.ai=null;
     shell.remove();
     if(state.aiShell===shell){
       state.aiGeneration++;
       state.status.hidden=true;
       state.aiShell=null;
       state.panel.classList?.remove('has-ai');
       if(state.aiRestore!=null&&state.width===state.aiWidened&&state.aiWidened!==state.aiRestore)state.setWidth?.(state.aiRestore);
       state.aiRestore=null;
     }
     state.frame?.focus?.();
   };
   try{
    state.ai=env.CanvasHarnessAISource.mount({container:content,store,pdfHandoff:{
     origin:env.location.origin,accountId,fileId:state.info.fileId,name:state.info.name,text,page,endPage,appearance:state.appearance,
     ...(message.intent==='practice'||message.intent==='reading'?{intent:message.intent}:{})
    },onClose:dispose});
    if(!state.ai)throw Error('The existing AI panel could not be started.');
    state.aiShell=shell;state.status.hidden=true;content.querySelector('iframe')?.focus?.();
   }catch(error){dispose();state.status.textContent=String(error.message||error);}
  }
  function settleClose(state,ok){
   const request=state.closeRequest;if(!request)return;
   state.closeRequest=null;env.clearTimeout?.(request.timer);
   if(ok)restore(state,false);request.resolve(ok);
  }
  function sendClose(state){
   const request=state.closeRequest;if(!request)return;
   if(!state.frame?.isConnected||!state.frame.contentWindow){settleClose(state,true);return;}
   if(!state.ready||request.sent)return;
   request.sent=true;
   try{state.frame.contentWindow.postMessage({type:'reserve-pdf-request-close',token:state.token,requestId:request.requestId},state.extensionOrigin);}
   catch{settleClose(state,true);}
  }
  function requestClose(state){
   let request=state.closeRequest;
   if(!request){
    let resolve;const promise=new Promise(done=>{resolve=done;});
    request=state.closeRequest={requestId:++closeSequence,promise,resolve};
    // A ready reader may still be saving; only its guarded result can release it.
    request.timer=env.setTimeout?.(()=>{if(!state.ready||!state.frame?.isConnected||!state.frame.contentWindow)settleClose(state,true);},2000);
   }
   sendClose(state);return request.promise;
  }
  function closeLocal(owner){
   if(owner?.origin===noticeOwner?.origin&&String(owner?.accountId)===noticeOwner?.accountId)cleanNotice();
   for(const task of pending)if(task.info?.local&&owner?.origin===task.info.owner.origin&&String(owner?.accountId)===task.info.owner.accountId)task.abort.abort();
   const state=active;
   if(!state?.info.local||owner?.origin!==state.info.owner.origin||String(owner?.accountId)!==state.info.owner.accountId)return Promise.resolve(false);
   state.retiring=true;state.panel.hidden=true;state.scope.textContent='';
   return requestClose(state);
  }
  async function open(info){
   if(info.openSignal?.aborted)return;
   ++localReadSequence;
   const generation=++openGeneration;info={...info,openGeneration:generation};
    if(info.moduleURL||info.metadata||info.remote){
     // A newer click that gives up leaves the open reader in charge again, with its own fallback intact.
     const keep=()=>{if(active&&!active.closed)active.info.openGeneration=generation;};
     const original=info,href=env.location.href;
     try{
      if(info.moduleURL)info=await resolveModule(info);
      else if(info.metadata)info=await fileMeta(info);
      else info={...info,fileId:await remoteFileId(info.remote,env.crypto?.subtle?env.crypto:root.crypto)};
     }catch(error){
       if(!dead&&generation===openGeneration){
         keep();
         if(!original.metadata)inform(String(error?.message||error));
         if(!original.metadata||env.location.href===href)replayClick(original);
       }
       return;
     }
     if(dead||generation!==openGeneration)return;
     if(!info){keep();if(env.location.href===href)replayClick(original);return;}
     if((original.metadata||info.remote)&&env.location.href!==href){keep();return;}
     if(!enabled('pdf')||!allowed()){keep();replayClick(info);return;}
    }
   let state=active;
   const differentOwner=state?.info.local&&info.local&&(state.info.owner.origin!==info.owner.origin||state.info.owner.accountId!==info.owner.accountId);
   // A retired reader's failed save must not block a different account that openLocal has verified.
   if(state?.retiring&&differentOwner){restore(state,false);state=null;}
   if(state){
    const closed=await requestClose(state);
    if(info.openSignal?.aborted){if(!dead&&generation===openGeneration&&active===state)state.info.openGeneration=generation;return;}
    if(!closed){
     if(!dead&&generation===openGeneration&&active===state&&state.retiring&&differentOwner)restore(state,false);
     else{
       if(!dead&&generation===openGeneration&&active===state){
         state.info.openGeneration=generation;
         if(state.retiring&&info.local&&info.owner.origin===state.info.owner.origin&&info.owner.accountId===state.info.owner.accountId){
           state.retiring=false;
           state.panel.hidden=false;
           state.setWidth(state.width);
         }
       }
       return;
     }
    }
    if(dead||generation!==openGeneration||active)return;
   }
    if(!dead&&!info.openSignal?.aborted){
     if(info.addressHref&&info.addressHref!==env.location.href)return;
     if((info.local||enabled('pdf'))&&allowed())return mount(info);else replayClick(info);
    }
  }
  async function openLocal({blob,id,name,owner,element}={}){
   if(dead||!allowed())throw Error('Open this saved PDF on its Canvas site.');
   let origin;
   try{
     const parsed=new URL(owner?.origin);
     if(parsed.protocol!=='https:'||parsed.origin!==owner.origin||parsed.username||parsed.password)throw Error();
     origin=parsed.origin;
   }catch{throw Error('A valid Canvas account origin is required.');}
   const accountId=String(owner?.accountId||'');
   if(origin!==env.location.origin||!/^\d+$/.test(accountId))throw Error('This saved file belongs to another Canvas site or account.');
   if(!/^cf-[\w-]{4,60}$/.test(String(id||'')))throw Error('This saved PDF link is invalid.');
   const BlobType=env.Blob||root.Blob;
   if(typeof BlobType!=='function'||!(blob instanceof BlobType)||blob.size<5)throw Error('The saved file is not a PDF.');
   if(blob.size>MAX_BYTES)throw Error('PDF exceeds the 32 MiB reading limit. Download the saved file to open it.');
   const sequence=++localReadSequence,info={local:true,fileId:String(id),owner:Object.freeze({origin,accountId}),blob,name:String(name||blob.name||'Saved document.pdf'),element};
   const task={info,abort:new AbortController(),reject:()=>{}};pending.add(task);
   const timer=env.setTimeout?.(()=>task.abort.abort(),15000);
   try{
    await verifyAccount(task);
    const bytes=await blob.arrayBuffer();
    if(task.abort.signal.aborted||dead||sequence!==localReadSequence)return false;
    if(bytes.byteLength!==blob.size||String.fromCharCode(...new Uint8Array(bytes,0,5))!=='%PDF-')throw Error('The saved file is not a PDF.');
    return Boolean(await open({...info,bytes,openSignal:task.abort.signal}));
   }finally{env.clearTimeout?.(timer);task.abort.abort();pending.delete(task);}
  }
  function mount(info){
   if(info.openSignal?.aborted)return;
   cleanNotice();hideSwitch();
   const currentRuntime=runtime();
   let readerURL,extensionOrigin;
   try{
    readerURL=new URL(currentRuntime.getURL('pdf-reader.html'));
    if(readerURL.protocol!=='chrome-extension:'||!readerURL.host)throw Error('Invalid extension URL.');
    // URL.origin is "null" for chrome-extension: under Node; derive scheme and host.
    // The frame loads from the dynamic URL (use_dynamic_url), but its messages carry the extension's real origin.
     extensionOrigin=readerURL.protocol+'//'+(/^[a-p]{32}$/.test(String(currentRuntime.id||''))?currentRuntime.id:readerURL.host);
   }catch{
     inform(info.local?'The PDF reader is unavailable. Download the saved file to open it.':'The PDF reader is unavailable. Opening the Canvas viewer.');
     if(!info.local){replaying=true;try{info.element?.click?.();}finally{replaying=false;}}
     return;
   }
   const token=env.crypto?.randomUUID?.();
   if(typeof token!=='string'||token.length<16){inform('A secure PDF session could not be created.');if(!info.local){replaying=true;try{info.element?.click?.();}finally{replaying=false;}}return;}
   readerURL.searchParams.set('parentOrigin',env.location.origin);readerURL.searchParams.set('token',token);
   const state={info,trigger:info.element,token,extensionOrigin,dispose:[],timers:[],abort:new AbortController(),
    width:model.clampWidth(undefined,env.innerWidth),
    appearance:{theme:'light'},
    closed:false,
    ready:false,
    sent:false,
    bytes:null,
    fetchInReader:Boolean(info.remote),
    appearanceLoaded:false
   };
   if(info.local){
    const urls=env.URL||root.URL;let url;
    try{url=urls.createObjectURL(info.blob);}catch{inform('The saved PDF could not be opened. Download it to open it.');return;}
    info.url=url;state.dispose.push(()=>urls.revokeObjectURL(url));
   }
   const node=(tag,cls)=>{const el=doc.createElement(tag);if(cls)el.className=cls;return el;};
   const panel=node('aside','reserve-pdf-host');panel.id='reserve-pdf-host';panel.setAttribute('aria-label','Canvas PDF reader');
   const divider=node('div','reserve-pdf-divider');divider.setAttribute('aria-hidden','true');
   divider.innerHTML=env.ReservePdfArt?.divider||'';
   const grip=node('div','reserve-pdf-grip');grip.setAttribute('role','separator');grip.setAttribute('aria-orientation','vertical');
   grip.setAttribute('aria-label','Resize the PDF reader');grip.setAttribute('tabindex','0');
   grip.innerHTML=env.ReservePdfArt?.grip||'';
   const frame=node('iframe','reserve-pdf-frame');frame.title='Canvas PDF document reader';frame.referrerPolicy='no-referrer';
   const status=node('div','reserve-pdf-status');status.setAttribute('role','status');status.textContent='Loading PDF…';
   panel.append(frame,divider,grip,status);
   const link=node('link');link.rel='stylesheet';link.href=currentRuntime.getURL('pdf-host.css');
   const scope=node('style');scope.setAttribute('data-reserve-pdf-shift','');
   const shift=doc.getElementById?.('wrapper')?'#wrapper':'html';
   const setWidth=width=>{
    if(state.closed)return;
    state.width=model.clampWidth(width,env.innerWidth);
    panel.style.width=state.width+'px';
    grip.setAttribute('aria-valuemin',String(Math.round(Math.min(380,env.innerWidth*.75))));
    grip.setAttribute('aria-valuemax',String(Math.round(env.innerWidth*.75)));
    grip.setAttribute('aria-valuenow',String(state.width));
    const target=shift==='#wrapper'?'html:has(>body>#reserve-pdf-host) #wrapper':'html:has(>body>#reserve-pdf-host)';
    // the page eases to a new width from the keyboard; while the grip is dragged it follows the pointer exactly
    const transition=state.dragging||['off','still'].includes(state.appearance.motion)?'none':'margin-right 220ms ease,margin-left 220ms ease,margin-top 220ms ease';
    // Too narrow for Canvas's own layout, the page shrinks as a whole instead of reflowing (a title one letter per line):
    // what is left keeps a 900px layout, zoomed to fit, never below 40%.
    const left=shift==='#wrapper'?(doc.getElementById?.('wrapper')?.getBoundingClientRect?.().left||0):0,
      room=env.innerWidth-state.width-left,
      fit=room>0&&room<900?Math.max(.4,Math.floor(room/900*1000)/1000):1;
    const kids=shift==='#wrapper'?target+'>*':target+'>body>*:not(#reserve-pdf-host)';
    scope.textContent=target+
      '{'+
      (shift==='#wrapper'?'width:auto!important;':'')+
      'margin-right:'+
      state.width+
      'px!important;transition:'+
      transition+
      '!important;}@media(prefers-reduced-motion:reduce){'+
      target+
      '{transition:none!important;}}'+
      (fit<1?kids+'{zoom:'+fit+'!important;}':'');
   };
   state.panel=panel;state.frame=frame;state.grip=grip;state.status=status;state.link=link;state.scope=scope;state.setWidth=width=>setWidth(width);
   active=state;doc.head.append(link,scope);doc.body.append(panel);setWidth(state.width);
   const watch=(target,name,fn,opts)=>{target.addEventListener(name,fn,opts);state.dispose.push(()=>target.removeEventListener(name,fn,opts));};
   let drag=null;
   const finishDrag=event=>{
     if(!drag||event?.pointerId!==drag.pointerId)return;
     const pointerId=drag.pointerId;
     drag=null;
     state.dragging=false;
     try{grip.releasePointerCapture?.(pointerId);}catch{}
     saveWidth(state.width);
   };
   watch(grip,'pointerdown',event=>{
    if(event.button!==0||event.isPrimary===false||drag)return;event.preventDefault?.();
    drag={pointerId:event.pointerId,x:event.clientX,width:state.width};state.dragging=true;
    try{grip.setPointerCapture?.(event.pointerId);}catch{}
   });
   watch(grip,'pointermove',event=>{if(drag&&event.pointerId===drag.pointerId)setWidth(drag.width+drag.x-event.clientX);});
   watch(grip,'pointerup',finishDrag);watch(grip,'pointercancel',finishDrag);watch(grip,'lostpointercapture',finishDrag);
   watch(grip,'keydown',event=>{
    let width=state.width;
    if(event.key==='ArrowLeft')width+=event.shiftKey?50:20;
    else if(event.key==='ArrowRight')width-=event.shiftKey?50:20;
    else if(event.key==='Home')width=0.01;
    else if(event.key==='End')width=env.innerWidth;
    else return;
    event.preventDefault?.();setWidth(width);saveWidth(state.width);
   });
   watch(frame,'error',()=>fallback(state,Error('The reader could not load at this school address.')));
   watch(env,'resize',()=>setWidth(state.width),{passive:true});
   watch(env,'pagehide',()=>restore(state,false),{once:true});
   const sendIfReady=()=>{
    if(state.closed||!state.ready||!state.bytes&&!state.fetchInReader||!state.appearanceLoaded||state.sent)return;
    state.sent=true;const bytes=state.bytes;state.bytes=null;
    for(const timer of state.timers)env.clearTimeout?.(timer);state.timers=[];
    try{frame.contentWindow.postMessage({type:'reserve-pdf-init',token,origin:env.location.origin,fileId:info.fileId,
      name:info.name,url:info.url,bytes,appearance:state.appearance,...(info.local?{local:true,accountId:info.owner.accountId}:{}),
      ...(info.remote?{remote:info.remote,page:info.page,fetchInReader:true}:{}),aiEnabled:!info.local&&!info.remote&&enabled('ai')&&!!env.CanvasHarnessAISource?.mount},
      extensionOrigin,
      bytes?[bytes]:[]);
      status.hidden=true;
    }
    catch(error){fallback(state,error);}
   };
   watch(env,'message',event=>{
    if(state.closed||event.source!==frame.contentWindow||event.origin!==extensionOrigin)return;
    const data=event.data;
    if(!data||data.token!==token||typeof data.type!=='string')return;
    if(data.type==='reserve-pdf-ready'){state.ready=true;sendIfReady();sendClose(state);}
    else if(data.type==='reserve-pdf-opened')moduleOpened(state.info);
    else if(data.type==='reserve-pdf-close')restore(state,true);
    else if(data.type==='reserve-pdf-close-result'){
     const request=state.closeRequest;
     if(!request||data.requestId!==request.requestId||typeof data.ok!=='boolean')return;
     settleClose(state,data.ok);
    }
    else if(data.type==='reserve-pdf-account'&&Number.isSafeInteger(data.requestId)&&data.requestId>=0)void replyAccount(state,data.requestId);
    else if(data.type==='reserve-pdf-error')fallback(state,Error(String(data.message||'The PDF reader could not display the file.')));
    else if(data.type==='reserve-pdf-ai')void openAI(state,data);
    else if(data.type==='reserve-pdf-fullscreen')toggleFullscreen();
    else if(data.type==='reserve-pdf-canvas')toCanvasViewer(state);
   });
   // Full screen: the reader panel itself fills the screen (or, if the browser refuses, the window). Canvas's own
   // assignment details stay at hand as a card (a copy of Canvas's page content, shown in Canvas's page).
   const assignTab=node('button','reserve-pdf-assignment-tab');assignTab.type='button';assignTab.hidden=true;
   assignTab.innerHTML=(env.ReserveCourseNavArt?.icons?.assignments||'')+'<span>Assignment</span>';assignTab.setAttribute('aria-expanded','false');
   const card=node('section','reserve-pdf-assignment-card');card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-label','Assignment details');
   panel.append(assignTab,card);
   const isFull=()=>panel.classList.contains('is-maximized');
   // A copy of Canvas's assignment text to read beside the PDF: words, links and pictures only. No scripts, inline
   // handlers, embeds, forms or frames; links only http(s)/mailto, pictures only http(s); no ids (Canvas's page keeps its own).
   const CLIP='<svg viewBox="0 0 22 40"><path d="M7 30V8.6C7 5.4 9 3.4 11.4 3.4S15.6 5.4 15.6 8.4V31.6C15.6 35.8 13.4 37.6 10.6 37.6S5.4 35.8 5.4 31.8V12.2" fill="none" stroke="#6F7F8C" stroke-width="2.4" stroke-linecap="round"/><path d="M7 30V8.6C7 5.4 9 3.4 11.4 3.4S15.6 5.4 15.6 8.4V31.6" fill="none" stroke="#C9D6DF" stroke-width="1" stroke-linecap="round" opacity=".9"/></svg>';
   const CROSS='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.2 5.6C8.4 8.6 11.6 11.8 14.8 14.6M14.6 5.2C11.6 8.4 8.6 11.6 5.4 14.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
   const cleanCopy=(source,title='')=>{
    const copy=source.cloneNode(true);
    // what Canvas hides (display:none, screen-reader-only text, hidden data) is left out, matched node for node
    const shown=[...source.querySelectorAll('*')],copies=[...copy.querySelectorAll('*')];
    for(let k=shown.length-1;k>=0;k--){
     const el=shown[k],style=env.getComputedStyle?.(el);
     if(el.hidden||el.matches?.('.screenreader-only,.sr-only,.hidden,[aria-hidden="true"]:not(svg,i)')||style&&(style.display==='none'||style.visibility==='hidden'))copies[k]?.remove();
    }
    const heading=[...copy.querySelectorAll('h1,h2')].find(h=>h.textContent.trim()===title.trim());heading?.remove();
    for(const el of copy.querySelectorAll('script,style,link,meta,iframe,frame,frameset,object,embed,applet,form,input,button,textarea,select,option,template,svg foreignObject,base'))el.remove();
    for(const el of [copy,...copy.querySelectorAll('*')]){
     for(const attr of [...(el.attributes||[])]){
      const name=attr.name.toLowerCase(),value=String(attr.value||'').trim();
      if(name.startsWith('on')||name==='id'||name==='style'||name==='srcset'||name==='formaction'||name==='action'||name==='xlink:href'){el.removeAttribute(attr.name);continue;}
      if(name==='href'||name==='src'){
        let ok=false;
        try{const url=new URL(value,env.location.href);ok=name==='href'?/^(https?:|mailto:)$/.test(url.protocol):url.protocol==='https:'||url.protocol==='http:';}catch{}
        if(!ok)el.removeAttribute(attr.name);
      }
     }
     if(el.tagName==='A'){el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer');}
    }
    return copy;
   };
   const closeCard=()=>{card.hidden=true;assignTab.setAttribute('aria-expanded','false');};
   const fullChanged=()=>{
    if(state.closed)return;const on=isFull();if(!on)panel.classList.remove('is-maximized');
    panel.classList.toggle('is-full',isFull());assignTab.hidden=!isFull();if(!isFull())closeCard();
    try{frame.contentWindow?.postMessage({type:'reserve-pdf-fullscreen-state',token,on:isFull()},extensionOrigin);}catch{}
   };
   // "Full screen" fills the browser window with the reader (not the browser's full-screen mode); Escape or the
   // button brings the split back.
   function toggleFullscreen(){panel.classList.toggle('is-maximized');fullChanged();}
   watch(doc,'keydown',event=>{if(event.key==='Escape'&&panel.classList.contains('is-maximized')){panel.classList.remove('is-maximized');fullChanged();}});
   watch(assignTab,'click',()=>{
    if(!card.hidden){closeCard();return;}
    const source=doc.querySelector('#assignment_show')||doc.querySelector('#content');card.replaceChildren();
    const head=node('header','reserve-pdf-assignment-head'),title=node('strong'),close=node('button'),clip=node('span','reserve-pdf-assignment-clip');
    clip.setAttribute('aria-hidden','true');clip.innerHTML=CLIP;close.innerHTML=CROSS;
    title.textContent=(doc.querySelector('#assignment_show .title, #assignment_show h1, h1')?.textContent||'Assignment').trim();
    close.type='button';close.setAttribute('aria-label','Close assignment details');close.addEventListener('click',closeCard);head.append(title,close);
    const body=node('div','reserve-pdf-assignment-body');
    if(source)body.append(cleanCopy(source,title.textContent));
    else body.textContent='The assignment details are on the Canvas page behind the reader.';
    card.append(clip,head,body);card.hidden=false;assignTab.setAttribute('aria-expanded','true');close.focus();
   });
   frame.src=readerURL.href;
   state.timers.push(env.setTimeout?.(()=>{if(!state.sent)fallback(state,Error('The PDF reader did not establish a secure connection.'));},20000));
   state.timers.push(env.setTimeout?.(()=>state.abort.abort(),25000));
   Promise.resolve(persisted(WIDTH_KEY)).then(value=>{if(!state.closed&&Number.isFinite(value)&&value>0)setWidth(value);});
   Promise.resolve(persisted(APPEARANCE_KEY)).then(value=>{
     if(!state.closed){
       state.appearance=value&&typeof value==='object'?value:{theme:'light'};
       panel.dataset.theme=model.theme(state.appearance);
       setWidth(state.width);
       state.appearanceLoaded=true;
       sendIfReady();
     }
   });
   if(info.remote)sendIfReady();
   else Promise.resolve(info.local?
     info.bytes:
     readVerifiedPdf({origin:env.location.origin,fileId:info.fileId,fetchImpl:env.fetch?.bind(env),signal:state.abort.signal}))
    .then(bytes=>{if(!state.closed){state.bytes=bytes;sendIfReady();}}).catch(error=>fallback(state,error));
   return state;
  }
  function delegated(event){
   if(!enabled('pdf')||dead||replaying||!fixedReaderOrigin||!allowed())return;
   const info=matchPdfClick(event,env.location?.origin||'')||(!canvasMode()&&matchCanvasFile(event,env.location?.origin||''));
   if(!info)return;
   if(canvasMode()&&!info.remote){if(info.fileId)showSwitch(info,true);return;}
   event.preventDefault?.();event.stopImmediatePropagation?.();void open(info);
  }
  const MODE_KEY='reserve:pdf-viewer';
  function canvasMode(){try{return env.sessionStorage?.getItem(MODE_KEY)==='canvas'||viewerMode==='canvas';}catch{return viewerMode==='canvas';}}
  function setMode(value){viewerMode=value;try{if(value==='canvas')env.sessionStorage?.setItem(MODE_KEY,'canvas');else env.sessionStorage?.removeItem(MODE_KEY);}catch{}}
  function filesRoute(){try{return /^\/(?:courses\/\d+\/)?files(?:\/|$)/.test(new URL(env.location.href).pathname);}catch{return false;}}
  function addressFile(){
   try{
    const url=new URL(env.location.href);
    if(!filesPath.test(url.pathname)&&!/^\/(?:courses\/\d+\/)?files\/\d+(?:\/(?:preview|file_preview))?\/?$/.test(url.pathname))return null;
    return fileURL(url.href,env.location.origin);
   }catch{return null;}
  }
  function hideSwitch(){switchButton?.remove?.();switchButton=null;switchInfo=null;switchSticky=false;}
  function showSwitch(info,sticky=false){
   if(dead||active||!fixedReaderOrigin||!allowed()||!enabled('pdf')||!doc.body||!/^\d+$/.test(String(info?.fileId||'')))return;
   if(switchInfo?.fileId===info.fileId&&switchButton?.isConnected){switchSticky=sticky&&!addressFile();return;}
   hideSwitch();switchInfo=info;switchSticky=sticky&&!addressFile();
   const bar=doc.createElement('div');bar.className='reserve-pdf-switch reserve-pdf-assignment-head';bar.setAttribute('role','region');bar.setAttribute('aria-label','Harness PDF reader');
   bar.style.cssText='position:fixed;z-index:2147483040;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;flex-wrap:wrap;gap:10px;max-width:calc(100vw - 40px);padding:8px 12px;background:#fffdf8;color:#141413;border:1.6px solid #141413;border-radius:6px;box-shadow:3px 4px 0 rgb(20 20 19 / .12);font:600 14px/1.3 Lato,system-ui,sans-serif';
   const go=doc.createElement('button');go.className='rd-text-button';go.type='button';go.textContent='Open in Harness reader';
   go.style.cssText='border:0;border-bottom:1.6px solid #141413;border-radius:0;padding:8px 2px;background:none;color:inherit;font:inherit;cursor:pointer';
   const hide=doc.createElement('button');hide.className='rd-text-button';hide.type='button';hide.textContent='Hide';hide.setAttribute('aria-label','Hide reader button');
   hide.style.cssText='border:0;border-radius:0;padding:8px 2px;background:none;color:#5e5d59;font:inherit;cursor:pointer';
   go.addEventListener('click',()=>{
    if(dead||!fixedReaderOrigin||!allowed()||!enabled('pdf'))return;
    const address=addressFile();if(address&&address.id!==info.fileId){openFromAddress();return;}
    setMode('reader');hideSwitch();void open({...info,element:null,canvasVisible:!info.addressHref||Boolean(address),addressHref:address?env.location.href:undefined});
   });
   hide.addEventListener('click',hideSwitch);bar.append(go,hide);doc.body.append(bar);switchButton=bar;
  }
  function toCanvasViewer(state){
   if(state!==active||state.closed||!state.ready||!state.sent||state.info.local||state.info.remote)return;
   const info=state.info;setMode('canvas');++openGeneration;++localReadSequence;restore(state,false);
   replayClick(info);showSwitch({...info,canvasVisible:true},true);
  }
  function openFromAddress(){
   if(dead||!fixedReaderOrigin||!enabled('pdf')||!allowed()||!filesRoute()){hideSwitch();return;}
   const file=addressFile();
   if(!file){if(switchButton&&!switchSticky)hideSwitch();if(active?.info.addressHref)void requestClose(active);return;}
   if(active?.info.fileId===file.id)return;
   const info={element:null,fileId:file.id,originalURL:file.url.href,url:env.location.origin+'/files/'+file.id+'/download',metadata:true,preview:true,addressHref:env.location.href};
   if(canvasMode()){
    if(switchInfo?.fileId===file.id)return;
    const generation=openGeneration,href=env.location.href;
    void fileMeta(info).then(found=>{if(found&&!dead&&generation===openGeneration&&env.location.href===href&&allowed()&&enabled('pdf'))showSwitch(found);}).catch(()=>{});
   }else void open(info);
  }
  doc.addEventListener('click',delegated,true);
  if(fixedReaderOrigin&&filesRoute()){
   if(doc.readyState==='loading'){
    addressReady=()=>{doc.removeEventListener('DOMContentLoaded',addressReady);addressReady=null;openFromAddress();};doc.addEventListener('DOMContentLoaded',addressReady,{once:true});
   }else openFromAddress();
   let lastHref=env.location.href;
   hrefTimer=env.setInterval?.(()=>{
    if(!filesRoute()){env.clearInterval?.(hrefTimer);hrefTimer=null;hideSwitch();return;}
    if(env.location.href!==lastHref){lastHref=env.location.href;openFromAddress();}
   },700);
  }
  return {active:()=>active,openLocal,closeLocal,destroy(){
    if(dead)return;
    dead=true;++localReadSequence;
    env.clearInterval?.(hrefTimer);
    if(addressReady)doc.removeEventListener('DOMContentLoaded',addressReady);
    hideSwitch();
    for(const task of pending){task.abort.abort();task.reject(Error('PDF loading was cancelled.'));}
    doc.removeEventListener('click',delegated,true);
    restore(active,false);
    cleanNotice();
  }};
 }
  const api=Object.freeze({create,matchPdfClick,matchCanvasFile,readVerifiedPdf,remoteFileId,MAX_BYTES});
 root.ReservePdfHost=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document&&pdfPage(root.location)&&root.ReserveSite?.supported?.(root.location?.href)&&!root.ReservePdfHostController)
  root.ReservePdfHostController=create({root});
})(globalThis);
