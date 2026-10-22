/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
(function(root){
 'use strict';
 const MAX_BYTES=32*1024*1024,WIDTH_KEY='reserve:pdf-width',APPEARANCE_KEY='reserve:appearance';
 const filePath=/^\/(?:(?:courses\/\d+|api\/v1(?:\/courses\/\d+)?)\/)?files\/(\d+)(?:\/(?:download|preview))?\/?$/;
 const pdfEvidence=/(?:\.pdf)(?:$|[?#\s"'(),;])|(?:^|[\s;,])application\/pdf(?:$|[\s;,])|(?:^|\s)PDF File/i;
 const attribute=(node,key)=>String(node?.getAttribute?.(key)??'');
 function pdfPage(value){
  try{
   const path=decodeURIComponent(new URL(value?.href||value,'https://school.instructure.com/').pathname);
   return /^\/(?:dashboard\/?)?$/.test(path)||/^\/files\/\d+(?:\/preview)?\/?$/.test(path)||/^\/courses\/\d+\/?$/.test(path)||
    /^\/courses\/\d+\/(?:files|modules|pages|announcements|discussion_topics)(?:\/|$)/.test(path)||
    /^\/courses\/\d+\/assignments\/(?:\d+|syllabus)(?:\/|$)/.test(path);
  }catch{return false;}
 }
 function moduleURL(value,origin){
  try{const url=new URL(value,origin);return url.origin===origin&&!url.username&&!url.password&&/^\/courses\/\d+\/modules\/items\/\d+\/?$/.test(url.pathname)?url:null;}
  catch{return null;}
 }
 function fileURL(value,origin){
  if(!value||typeof value!=='string')return null;
  try{
   const url=new URL(value,origin);
   if(url.origin!==origin||url.username||url.password)return null;
   // /files/ID, /courses/C/files/ID, and the Files page's own rows: /courses/C/files?preview=ID
   const id=url.pathname.match(filePath)?.[1]||(/\/files(?:\/folder\/[^?#]*)?\/?$/.test(url.pathname)&&/^\d+$/.test(url.searchParams.get('preview')||'')?url.searchParams.get('preview'):null);
   return id?{id,url}:null;
  }catch{return null;}
 }
 // A stable numeric id for a PDF on another website (annotations are stored per file id).
 function localId(path){let h=2166136261;for(const c of String(path)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return '99'+h;}
 function matchRemotePdf(el,origin){
  if(!el?.matches?.('a[href]'))return null;
  let url;try{url=new URL(el.href);}catch{return null;}
  if(url.protocol!=='https:'||url.origin===origin||url.username||url.password||!/\.pdf$/i.test(decodeURIComponent(url.pathname)))return null;
  const page=Number((url.hash.match(/page=(\d+)/)||[])[1]);url.hash='';
  const text=String(el.textContent||'').replace(/[↗\s]+$/,'').trim();
  return {element:el,remote:url.href,fileId:localId('remote:'+url.href),page:Number.isSafeInteger(page)&&page>0?page-1:null,
   name:(text?text.replace(/\.pdf$/i,'')+'.pdf':decodeURIComponent(url.pathname.split('/').pop())).slice(0,240),url:url.href,preview:false};
 }
 // A Canvas file link with no sign of its type (a title only): checked with Canvas when it is clicked.
 function matchCanvasFile(event,origin){
  if(!event||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.defaultPrevented)return null;
  let el;try{const target=event.composedPath?.()[0]||event.target;el=(target?.closest?target:target?.parentElement)?.closest?.('a[href]');}catch{return null;}
  if(!el||el.hasAttribute('download'))return null;
  let url;try{url=new URL(el.href);}catch{return null;}
  const id=url.origin===origin&&(url.pathname.match(/^\/(?:courses\/\d+\/)?files\/(\d+)(?:\/(?:preview|file_preview))?\/?$/)||[])[1];
  return id?{element:el,fileId:id}:null;
 }
 function matchPdfClick(event,origin){
  if(!event||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.defaultPrevented)return null;
  let el;
  try{
   for(const node of event.composedPath?.()||[event.target]){
    el=node?.closest?.('a[href],button,[role="button"],[data-pdf-file-id],[data-api-endpoint],[data-api-returntype],.file_preview_link,.inline_file_preview');
    if(el)break;
   }
  }catch{return null;}
  if(!el)return null;
  // An https .pdf link on another website opens in the reader too (the reader asks once for that site).
  const remote=matchRemotePdf(el,origin);if(remote)return remote;
  const labels=[attribute(el,'title'),attribute(el,'aria-label'),el.textContent||''].join(' '),rawHref=attribute(el,'href');
  const href=rawHref.startsWith('#')?rawHref:typeof el.href==='string'&&el.href||rawHref;
  if(el.hasAttribute?.('download')||el.getAttribute?.('download')!=null||attribute(el,'data-pdf-download')==='true'||
   /(?:^|\s)download(?:\s|$)/i.test(labels)||/(?:^|[\s_-])download(?:[\s_-]|$)/i.test(String(el.className||'')))return null;
  if(href&&!href.startsWith('#')){
   try{const url=new URL(href,origin);if(url.origin!==origin||url.username||url.password)return null;}catch{return null;}
  }
  const dashboardId=attribute(el,'data-pdf-file-id'),courseId=attribute(el,'data-pdf-course-id'),itemURL=moduleURL(href,origin);
  const row=el.closest?.('.context_module_item,.ef-item-row')||null;
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
   attribute(el,'type'),attribute(parent,'title'),attribute(parent,'data-filename'),
   attribute(row,'data-filename'),attribute(row,'data-content-type'),attribute(row,'data-mime-type')].join(' ');
  const sibling=parent?.querySelector?.('a[data-api-returntype="File"], a[href*="/files/"]')||null;
  const evidence=pdfEvidence.test(filename)||
   (sibling&&pdfEvidence.test([sibling.textContent,attribute(sibling,'title'),attribute(sibling,'href')].join(' ')));
  if(!evidence)return null;
  // Canvas's metadata endpoint provides an ID for download and inline-preview toggles.
  // Require that ID to resolve back to this exact authorized Canvas origin.
  // A "#" link resolves to the page it sits on (a file's own page names another file), so only real addresses count.
  const placeholder=!href||href.startsWith('#'),real=a=>{const v=attribute(a,'href');return v&&!v.startsWith('#')?[v,a.href]:[];};
  const paths=[...real(el),attribute(el,'data-api-endpoint'),
   attribute(parent,'data-api-endpoint'),...real(sibling),attribute(sibling,'data-api-endpoint')];
  let found=null;
  for(const value of paths){found=fileURL(value,origin);if(found)break;}
  if(!found&&placeholder&&/^\d+$/.test(dashboardId)&&/^\d+$/.test(courseId))found={id:dashboardId};
  if(!found&&itemURL){
   const type=attribute(row,'data-module-type')||attribute(row,'data-type');
   const id=attribute(el,'data-file-id')||attribute(row,'data-file-id')||
    (/^(?:file|attachment)$/i.test(type)||/\battachment\b/.test(String(row?.className||''))?attribute(row,'data-content-id'):'');
   if(/^\d+$/.test(id))found={id};
  }
  if(!found&&placeholder&&!itemURL&&/\bef-item-row\b/.test(String(row?.className||''))&&
   /\bef-name-col(?:__link)?\b/.test(String(el.className||''))&&!/folder/i.test(attribute(row,'data-type')||String(row.className||''))){
   const id=attribute(row,'data-id');if(/^\d+$/.test(id))found={id};
  }
  if(!found&&placeholder&&preview&&!itemURL){
   const id=attribute(el,'data-file-id')||attribute(el,'data-id')||attribute(parent,'data-file-id');
   if(/^\d+$/.test(id))found={id};
  }
  if(!found&&!itemURL)return null;
  const name=attribute(el,'data-pdf-name')||[attribute(el,'data-filename'),attribute(el,'data-display-name'),
   attribute(el,'title'),String(el.textContent||'').trim(),attribute(sibling,'title'),String(sibling?.textContent||'').trim()]
   .map(value=>value.replace(/^\s*PDF File\s*/i,'').trim()).find(value=>/\.pdf(?:$|[\s"'(),;])/i.test(value))||'Canvas PDF '+(found?.id||'document')+'.pdf';
  const originalURL=!placeholder?new URL(href,origin).href:fileURL(attribute(sibling,'href')||sibling?.href,origin)?.url.href||
   (found?origin+(/^\d+$/.test(courseId)?'/courses/'+courseId:'')+'/files/'+found.id:itemURL.href);
  return {element:el,originalURL,...(found?{fileId:found.id,url:origin+'/files/'+found.id+'/download'}:{moduleURL:itemURL.href,url:itemURL.href}),
   name:name.trim().slice(0,240),preview:Boolean(preview)};
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
   // Assignment pages keep the reader beside the instructions; anywhere else (Files, modules, pages) it fills the window.
   const splitPage=()=>!!site.vanillaPage?.(env.location);
   if(!env.document||!allowed())return null;
  const doc=env.document,model=env.ReservePdfModel||root.ReservePdfModel;
  if(!model)return null;
  // The fixed reader WAR is intentionally limited to Instructure Canvas.
  // Dynamic custom school sites must retain the native viewer until a
  // narrowly scoped per-origin reader exposure mechanism exists.
  const fixedReaderOrigin=/(?:^|\.)instructure\.com$/i.test(new URL(env.location.origin).hostname);
   let active=null,dead=false,replaying=false,notice=null,noticeTimer=null,openGeneration=0,closeSequence=0;
   const pending=new Set();
  const runtime=()=>env.chrome?.runtime;
  const persisted=async key=>{try{return (await env.chrome?.storage?.local?.get?.(key))?.[key];}catch{return undefined;}};
  const saveWidth=width=>{Promise.resolve(env.chrome?.storage?.local?.set?.({[WIDTH_KEY]:width})).catch(()=>{});};
  function cleanNotice(){
   if(noticeTimer!=null){env.clearTimeout?.(noticeTimer);noticeTimer=null;}
   notice?.remove?.();notice=null;
  }
  function inform(message){
   cleanNotice();
   if(!doc.body)return;
   notice=doc.createElement('div');notice.className='reserve-pdf-fallback';notice.setAttribute('role','status');
   notice.style.cssText='position:fixed;z-index:2147483050;bottom:20px;right:20px;max-width:min(480px,calc(100vw - 40px));padding:14px 18px;background:#fff9ea;color:#28231d;border:2px solid #9b6543;border-radius:8px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 8px 25px #1414132e';
   notice.textContent=message;doc.body.append(notice);
   noticeTimer=env.setTimeout?.(cleanNotice,10000);
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
   inform(message.includes('inst-fs')?message:message+' Returning to the original Canvas viewer.');
   // Replay the same Canvas click once, bypassing only our delegated listener.
   // This preserves Canvas's own inline preview handlers and link behavior.
   // opened from the page address (no link was clicked): Canvas's own preview is already there
   if(!state.trigger)return;
    replayClick(state.info);
   }
   function replayClick(info){
    replaying=true;
   try{
     if(info.element?.isConnected!==false&&typeof info.element?.click==='function')info.element.click();
     else env.location?.assign?.(info.originalURL||info.url);
   }finally{replaying=false;}
  }
   async function resolveModule(info){
    const task={abort:new AbortController()};let response;pending.add(task);
    try{
     const deadline=new Promise((_,reject)=>{task.reject=reject;task.timer=env.setTimeout?.(()=>{
      task.abort.abort();reject(Error('Canvas did not resolve this module file in time.'));
     },20000);});
     response=await Promise.race([env.fetch(info.moduleURL,{method:'GET',credentials:'same-origin',redirect:'follow',signal:task.abort.signal}),deadline]);
     const file=response?.ok&&fileURL(response.url,env.location.origin);
     if(!file)throw Error('Canvas did not resolve this module item to a file.');
     return {...info,fileId:file.id,url:env.location.origin+'/files/'+file.id+'/download'};
    }finally{
     env.clearTimeout?.(task.timer);task.abort.abort();pending.delete(task);
     try{void response?.body?.cancel?.()?.catch?.(()=>{});}catch{}
    }
   }
  async function verifyAccount(state){
   const response=await env.fetch(env.location.origin+'/api/v1/users/self/profile',{
    method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json+canvas-string-ids'},signal:state.abort.signal
   });
   if(!response.ok||!response.headers?.get?.('content-type')?.includes('json'))throw Error('Canvas sign-in could not be verified.');
   const accountId=String((await response.json()).id);
   if(!/^\d+$/.test(accountId))throw Error('Canvas returned an invalid account.');
   return accountId;
  }
  async function replyAccount(state,requestId){
   let result;
   try{result={accountId:await verifyAccount(state)};}
   catch(error){result={error:String(error?.message||error)};}
   if(state!==active||state.closed)return;
   try{state.frame.contentWindow.postMessage({type:'reserve-pdf-account-result',token:state.token,requestId,...result},state.extensionOrigin);}catch{}
  }
  async function openAI(state,message){
   if(!enabled('ai')||state!==active||state.closed)return;
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
    if(state!==active||state.closed||generation!==state.aiGeneration)return;
    state.status.textContent='AI setup unavailable: '+String(error.message||error);
    return;
   }
   if(state!==active||state.closed||generation!==state.aiGeneration)return;
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
   const dispose=()=>{state.ai?.destroy?.();state.ai=null;shell.remove();if(state.aiShell===shell){state.aiGeneration++;state.status.hidden=true;state.aiShell=null;state.panel.classList?.remove('has-ai');if(state.aiRestore!=null&&state.width===state.aiWidened&&state.aiWidened!==state.aiRestore)state.setWidth?.(state.aiRestore);state.aiRestore=null;}state.frame?.focus?.();};
   try{
    state.ai=env.CanvasHarnessAISource.mount({container:content,store,pdfHandoff:{
     origin:env.location.origin,accountId,fileId:state.info.fileId,name:state.info.name,text,page,endPage,appearance:state.appearance
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
  async function open(info){
    const generation=++openGeneration;info={...info,openGeneration:generation};
    if(info.moduleURL){
     // A newer click that gives up leaves the open reader in charge again, with its own fallback intact.
     const keep=()=>{if(active&&!active.closed)active.info.openGeneration=generation;};
     try{info=await resolveModule(info);}
     catch(error){if(!dead&&generation===openGeneration){keep();inform(String(error?.message||error));replayClick(info);}return;}
     if(dead||generation!==openGeneration)return;
     if(!enabled('pdf')||!allowed()){keep();replayClick(info);return;}
    }
    const state=active;
   if(state){
    let request=state.closeRequest;
    if(!request){
     let resolve;const promise=new Promise(done=>{resolve=done;});
     request=state.closeRequest={requestId:++closeSequence,promise,resolve};
      // A ready reader may still be saving; only its guarded result can release it.
      request.timer=env.setTimeout?.(()=>{if(!state.ready||!state.frame?.isConnected||!state.frame.contentWindow)settleClose(state,true);},2000);
    }
    sendClose(state);
     const closed=await request.promise;
     if(!closed){if(!dead&&generation===openGeneration&&active===state)state.info.openGeneration=generation;return;}
     if(dead||generation!==openGeneration||active)return;
   }
    if(!dead){if(enabled('pdf')&&allowed())mount(info);else replayClick(info);}
  }
  function mount(info){
   cleanNotice();hideSwitch();
   const currentRuntime=runtime();
   let readerURL,extensionOrigin;
   try{
    readerURL=new URL(currentRuntime.getURL('pdf-reader.html'));
    if(readerURL.protocol!=='chrome-extension:'||!readerURL.host)throw Error('Invalid extension URL.');
    // URL.origin is "null" for chrome-extension: under Node; derive scheme and host.
    extensionOrigin=readerURL.protocol+'//'+readerURL.host;
    }catch{inform('The PDF reader is unavailable. Opening the Canvas viewer.');replayClick(info);return;}
   const token=env.crypto?.randomUUID?.();
    if(typeof token!=='string'||token.length<16){inform('A secure PDF session could not be created.');replayClick(info);return;}
   readerURL.searchParams.set('parentOrigin',env.location.origin);readerURL.searchParams.set('token',token);
   const state={info,trigger:info.element,token,extensionOrigin,dispose:[],timers:[],abort:new AbortController(),
    width:model.clampWidth(undefined,env.innerWidth),appearance:{theme:'light'},closed:false,ready:false,sent:false,bytes:null,appearanceLoaded:false};
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
    const left=shift==='#wrapper'?(doc.getElementById?.('wrapper')?.getBoundingClientRect?.().left||0):0,room=env.innerWidth-state.width-left,fit=room>0&&room<900?Math.max(.4,Math.floor(room/900*1000)/1000):1;
    const kids=shift==='#wrapper'?target+'>*':target+'>body>*:not(#reserve-pdf-host)';
    scope.textContent=target+'{'+(shift==='#wrapper'?'width:auto!important;':'')+'margin-right:'+state.width+'px!important;transition:'+transition+'!important;}@media(prefers-reduced-motion:reduce){'+target+'{transition:none!important;}}'+(fit<1?kids+'{zoom:'+fit+'!important;}':'');
   };
   state.panel=panel;state.frame=frame;state.grip=grip;state.status=status;state.link=link;state.scope=scope;state.setWidth=width=>setWidth(width);
   active=state;doc.head.append(link,scope);doc.body.append(panel);setWidth(state.width);
   const watch=(target,name,fn,opts)=>{target.addEventListener(name,fn,opts);state.dispose.push(()=>target.removeEventListener(name,fn,opts));};
   let drag=null;
   const finishDrag=event=>{if(!drag||event?.pointerId!==drag.pointerId)return;const pointerId=drag.pointerId;drag=null;state.dragging=false;try{grip.releasePointerCapture?.(pointerId);}catch{}saveWidth(state.width);};
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
    if(state.closed||!state.ready||!state.bytes||!state.appearanceLoaded||state.sent)return;
    state.sent=true;const bytes=state.bytes==='reader'?null:state.bytes;state.bytes=null;
    for(const timer of state.timers)env.clearTimeout?.(timer);state.timers=[];
    try{frame.contentWindow.postMessage({type:'reserve-pdf-init',token,origin:env.location.origin,fileId:info.fileId,
     name:info.name,url:info.url,bytes,fetchInReader:!bytes,remote:info.remote||null,page:info.page??null,appearance:state.appearance,aiEnabled:enabled('ai')&&!!env.CanvasHarnessAISource?.mount},extensionOrigin,bytes?[bytes]:[]);status.hidden=true;}
    catch(error){fallback(state,error);}
   };
   watch(env,'message',event=>{
    if(state.closed||event.source!==frame.contentWindow||event.origin!==extensionOrigin)return;
    const data=event.data;
    if(!data||data.token!==token||typeof data.type!=='string')return;
    if(data.type==='reserve-pdf-ready'){state.ready=true;sendIfReady();sendClose(state);if(isFull())fullChanged();}
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
      if(name==='href'||name==='src'){let ok=false;try{const url=new URL(value,env.location.href);ok=name==='href'?/^(https?:|mailto:)$/.test(url.protocol):url.protocol==='https:'||url.protocol==='http:';}catch{}if(!ok)el.removeAttribute(attr.name);}
     }
     if(el.tagName==='A'){el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer');}
    }
    return copy;
   };
   const closeCard=()=>{card.hidden=true;assignTab.setAttribute('aria-expanded','false');};
   const fullChanged=()=>{
    if(state.closed)return;const on=isFull();if(!on)panel.classList.remove('is-maximized');
    panel.classList.toggle('is-full',isFull());assignTab.hidden=!isFull()||!splitPage();if(!isFull())closeCard();
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
   if(!splitPage()){panel.classList.add('is-maximized');panel.classList.add('is-full');}
   frame.src=readerURL.href;
   state.timers.push(env.setTimeout?.(()=>{if(!state.sent)fallback(state,Error('The PDF reader did not establish a secure connection.'));},20000));
   state.timers.push(env.setTimeout?.(()=>state.abort.abort(),25000));
   Promise.resolve(persisted(WIDTH_KEY)).then(value=>{if(!state.closed&&Number.isFinite(value)&&value>0)setWidth(value);});
   Promise.resolve(persisted(APPEARANCE_KEY)).then(value=>{if(!state.closed){state.appearance=value&&typeof value==='object'?value:{theme:'light'};panel.dataset.theme=model.theme(state.appearance);setWidth(state.width);state.appearanceLoaded=true;sendIfReady();}});
   // Canvas usually redirects a download to its file domain (canvas-user-content.com), which a Canvas page may
   // not read (CORS). The reader is an extension page with access to that domain: it fetches the file itself.
   if(info.remote){state.bytes='reader';env.setTimeout?.(sendIfReady,0);}
   else Promise.resolve(readVerifiedPdf({origin:env.location.origin,fileId:info.fileId,fetchImpl:env.fetch?.bind(env),signal:state.abort.signal}))
    .then(bytes=>{if(!state.closed){state.bytes=bytes;sendIfReady();}})
    .catch(error=>{if(state.closed)return;if(state.info.openGeneration===openGeneration&&/inst-fs/.test(String(error?.message))){state.bytes='reader';sendIfReady();}else fallback(state,error);});
   return state;
  }
  function delegated(event){
    if(!enabled('pdf')||dead||replaying||!fixedReaderOrigin||!allowed())return;
   const info=matchPdfClick(event,env.location?.origin||'');
   if(!info){
    const file=!canvasMode()&&matchCanvasFile(event,env.location?.origin||'');
    if(file){event.preventDefault?.();event.stopImmediatePropagation?.();void probeCanvasFile(file);}
    return;
   }
   if(canvasMode()&&!info.remote){if(info.fileId)env.setTimeout?.(()=>showSwitch(info,true),400);return;}
   event.preventDefault?.();event.stopImmediatePropagation?.();void open(info);
  }
  // A Canvas file link that does not say what it is: a PDF opens in the reader, anything else continues as the link.
  async function probeCanvasFile(file){
   const meta=await fileMeta(file.fileId);
   if(meta&&isPdf(meta)&&!dead){void open({element:file.element,fileId:file.fileId,name:String(meta.display_name||'Canvas PDF '+file.fileId+'.pdf').slice(0,240),url:env.location.origin+'/files/'+file.fileId+'/download',preview:false});return;}
   replaying=true;try{file.element?.click?.();}finally{replaying=false;}
  }
   async function fileMeta(id){
   try{const r=await env.fetch(env.location.origin+'/api/v1/files/'+id,{credentials:'same-origin',headers:{Accept:'application/json'}});return r.ok?await r.json():null;}catch{return null;}
  }
  const isPdf=meta=>/application\/pdf/i.test(meta?.['content-type']||'')||/\.pdf$/i.test(meta?.display_name||meta?.filename||'');
  // Canvas's own viewer or the Harness reader: the student can switch either way. Choosing Canvas's viewer holds for
  // this tab (sessionStorage) until "Open in Harness reader" is pressed.
  const MODE_KEY='ch-pdf-viewer';
  const canvasMode=()=>{try{return env.sessionStorage?.getItem(MODE_KEY)==='canvas';}catch{return false;}};
  const setMode=value=>{try{if(value==='canvas')env.sessionStorage.setItem(MODE_KEY,'canvas');else env.sessionStorage.removeItem(MODE_KEY);}catch{}};
  const closeCanvasPreview=()=>{doc.querySelector('.ef-file-preview-overlay .ef-file-preview-header-close, .ef-file-preview-overlay button[aria-label="Close"]')?.click?.();};
  function addressFileId(){
   let url;try{url=new URL(env.location.href);}catch{return null;}
   const id=url.searchParams.get('preview')&&/\/files(?:\/folder\/.*)?\/?$/.test(url.pathname)?url.searchParams.get('preview'):(url.pathname.match(/^\/(?:courses\/\d+\/)?files\/(\d+)\/?(?:file_preview)?\/?$/)||[])[1];
   return /^\d+$/.test(id||'')?id:null;
  }
  let switchButton=null,switchFor=null,switchSticky=false;
  function hideSwitch(){switchButton?.remove();switchButton=null;switchFor=null;switchSticky=false;}
  function showSwitch(info,sticky=false){
   if(dead||active||!doc.body||!/^\d+$/.test(String(info?.fileId||'')))return;
   // sticky: Canvas showed the file inside the page (no address of its own), so the button stays until closed
   sticky=sticky&&!addressFileId();
   if(switchFor===String(info.fileId)&&switchButton?.isConnected){switchSticky=switchSticky&&sticky;return;}
   hideSwitch();switchFor=String(info.fileId);switchSticky=sticky;
   const bar=doc.createElement('div');bar.className='reserve-pdf-switch';bar.setAttribute('role','region');bar.setAttribute('aria-label','Harness PDF reader');
   bar.style.cssText='position:fixed;z-index:2147483040;left:50%;bottom:84px;transform:translateX(-50%);display:flex;align-items:center;gap:2px;padding:4px;background:#fbfaf7;color:#23221f;border:1px solid #dcd7cc;border-radius:999px;box-shadow:0 10px 30px rgb(20 20 19 / .24),0 1px 3px rgb(20 20 19 / .12);font:600 13.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif';
   const go=doc.createElement('button');go.type='button';go.title='Switch back to the Harness reader to highlight, type and draw on this PDF';
   go.style.cssText='display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:9px 16px 9px 12px;background:#b5552e;color:#fff;font:inherit;cursor:pointer';
   go.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/></svg><span>Open in Harness reader</span>';
   const hide=doc.createElement('button');hide.type='button';hide.setAttribute('aria-label','Hide this button');hide.title='Hide';hide.textContent='×';
   hide.style.cssText='border:0;background:none;color:#6f6b62;font:400 21px/1 system-ui,sans-serif;width:32px;height:32px;border-radius:50%;cursor:pointer';
   go.addEventListener('click',()=>{
    setMode('reader');const id=String(info.fileId),name=info.name;hideSwitch();
    void open({element:null,fileId:id,name:name||'Canvas PDF '+id+'.pdf',url:env.location.origin+'/files/'+id+'/download',preview:true});
    env.setTimeout?.(closeCanvasPreview,600);
   });
   hide.addEventListener('click',hideSwitch);
   bar.append(go,hide);doc.body.append(bar);switchButton=bar;
  }
  // The reader's "Open in Canvas's viewer": close the reader and let Canvas show the same file.
  function toCanvasViewer(state){
   if(!state||state.closed||state.info.remote)return;
   const info=state.info;setMode('canvas');restore(state,false);
   if(info.element&&info.element.isConnected!==false&&typeof info.element.click==='function'){
    replaying=true;try{info.element.click();}finally{replaying=false;}
    env.setTimeout?.(()=>showSwitch(info,true),400);return;
   }
   // opened from the address: on a file page Canvas's viewer is right behind; on the Files page, bring its preview back
   let url;try{url=new URL(env.location.href);}catch{return;}
   if(addressFileId()===String(info.fileId)&&!url.searchParams.get('preview')){showSwitch(info);return;}
   if(/\/files(?:\/folder\/.*)?\/?$/.test(url.pathname)){url.searchParams.set('preview',info.fileId);env.location.assign(url.href);}
   else env.location.assign(env.location.origin+'/files/'+info.fileId);
  }
  // Landing on a PDF's own address (a file page, or the Files page with ?preview=ID) opens it in the reader too,
  // or, after the student chose Canvas's viewer, offers the way back.
  async function openFromAddress(){
   const id=addressFileId();
   if(!id){if(switchButton&&!switchSticky)hideSwitch();return;}
   if(active)return;
   const meta=await fileMeta(id);if(!meta||!isPdf(meta)||dead||active)return;
   const info={element:null,fileId:id,name:String(meta.display_name||'Canvas PDF '+id+'.pdf').slice(0,240),url:env.location.origin+'/files/'+id+'/download',preview:true};
   if(canvasMode()){showSwitch(info);return;}
   if(switchFor&&switchFor!==id)hideSwitch();
   await open(info);env.setTimeout?.(closeCanvasPreview,600);
  }

  doc.addEventListener('click',delegated,true);
  // Only a Files route can name a PDF in its own address; every other page keeps just the click listener.
  let hrefTimer=null;
  if(/^\/(?:courses\/\d+\/)?files(?:\/|$)/.test(env.location.pathname||'')){
   if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>void openFromAddress(),{once:true});else void openFromAddress();
   let lastHref=env.location.href;
   // the Files page changes ?preview= without a page load
   hrefTimer=env.setInterval?.(()=>{if(env.location.href!==lastHref){lastHref=env.location.href;void openFromAddress();}},700);
  }
   return {active:()=>active,destroy(){if(dead)return;dead=true;env.clearInterval?.(hrefTimer);hideSwitch();for(const task of pending){task.abort.abort();task.reject(Error('PDF loading was cancelled.'));}doc.removeEventListener('click',delegated,true);restore(active,false);cleanNotice();}};
 }
 const api=Object.freeze({create,matchPdfClick,readVerifiedPdf,localId,MAX_BYTES});
 root.ReservePdfHost=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
  if(root.document&&pdfPage(root.location)&&root.ReserveSite?.supported?.(root.location?.href)&&!root.ReservePdfHostController)
  root.ReservePdfHostController=create({root});
})(globalThis);
