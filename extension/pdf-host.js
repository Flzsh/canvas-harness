/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. */
(function(root){
 'use strict';
 const MAX_BYTES=32*1024*1024,WIDTH_KEY='reserve:pdf-width',APPEARANCE_KEY='reserve:appearance';
 const filePath=/(?:^|\/)files\/(\d+)(?:\/|$)/;
 const pdfEvidence=/(?:\.pdf)(?:$|[?#\s"'(),;])|(?:^|[\s;,])application\/pdf(?:$|[\s;,])/i;
 const attribute=(node,key)=>String(node?.getAttribute?.(key)??'');
 function fileURL(value,origin){
  if(!value||typeof value!=='string')return null;
  try{
   const url=new URL(value,origin);
   if(url.origin!==origin)return null;
   const id=url.pathname.match(filePath)?.[1];return id?{id,url}:null;
  }catch{return null;}
 }
 function matchPdfClick(event,origin){
  if(!event||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.defaultPrevented)return null;
  let el;try{el=event.target?.closest?.('a[href],button,[role="button"],[data-api-endpoint],[data-api-returntype],.file_preview_link,.inline_file_preview');}catch{return null;}
  if(!el)return null;
  const preview=/\b(?:file_preview_link|inline_file_preview|instructure_file_link)\b/i.test(String(el.className||''))||
   /^(?:true|1|pdf)$/i.test(attribute(el,'data-preview'))||attribute(el,'data-api-returntype')==='File';
  // Canvas preview toggles are frequently siblings of the actual download
  // anchor inside a shared holder; prefer that holder to the toggle itself.
  const parent=el.closest?.('.instructure_file_link_holder')||
   el.parentElement?.closest?.('.instructure_file_link_holder')||
   el.closest?.('.file_preview_link, .inline_file_preview')||null;
  const filename=[attribute(el,'data-filename'),attribute(el,'data-display-name'),attribute(el,'download'),
   attribute(el,'title'),attribute(el,'aria-label'),el.textContent||'',
   attribute(el,'href'),el.href||'',attribute(el,'data-content-type'),attribute(el,'data-mime-type'),
   attribute(el,'type'),attribute(parent,'title'),attribute(parent,'data-filename')].join(' ');
  const sibling=parent?.querySelector?.('a[data-api-returntype="File"], a[href*="/files/"]')||null;
  const evidence=pdfEvidence.test(filename)||
   (sibling&&pdfEvidence.test([sibling.textContent,attribute(sibling,'title'),attribute(sibling,'href')].join(' ')));
  if(!evidence)return null;
  // Canvas's metadata endpoint provides an ID for download and inline-preview toggles.
  // Require that ID to resolve back to this exact authorized Canvas origin.
  const paths=[attribute(el,'href'),el.href,attribute(el,'data-api-endpoint'),
   attribute(parent,'data-api-endpoint'),attribute(sibling,'href'),sibling?.href,attribute(sibling,'data-api-endpoint')];
  let found=null;
  for(const value of paths){found=fileURL(value,origin);if(found)break;}
  if(!found&&preview){
   const id=attribute(el,'data-file-id')||attribute(el,'data-id')||attribute(parent,'data-file-id');
   if(/^\d+$/.test(id))found={id};
  }
  if(!found)return null;
  const name=[attribute(el,'data-filename'),attribute(el,'data-display-name'),attribute(el,'download'),
   attribute(el,'title'),String(el.textContent||'').trim(),attribute(sibling,'title'),String(sibling?.textContent||'').trim()]
   .find(value=>/\.pdf(?:$|[\s"'(),;])/i.test(value))||'Canvas PDF '+found.id+'.pdf';
  return {element:el,fileId:found.id,name:name.trim().slice(0,240),url:origin+'/files/'+found.id+'/download',preview:Boolean(preview)};
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
  const site=env.ReserveSite;
  if(!env.document||!site?.supported?.(env.location?.href)||!site?.vanillaPage?.(env.location))return null;
  const doc=env.document,model=env.ReservePdfModel||root.ReservePdfModel;
  if(!model)return null;
  // The fixed reader WAR is intentionally limited to Instructure Canvas.
  // Dynamic custom school sites must retain the native viewer until a
  // narrowly scoped per-origin reader exposure mechanism exists.
  const fixedReaderOrigin=/(?:^|\.)instructure\.com$/i.test(new URL(env.location.origin).hostname);
  let active=null,dead=false,replaying=false,notice=null,noticeTimer=null,openGeneration=0,closeSequence=0;
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
   const message=String(error?.message||error||'The PDF could not be opened.');
   restore(state,false);
   inform(message.includes('inst-fs')?message:message+' Returning to the original Canvas viewer.');
   // Replay the same Canvas click once, bypassing only our delegated listener.
   // This preserves Canvas's own inline preview handlers and link behavior.
   replaying=true;
   try{
    if(state.trigger?.isConnected!==false&&typeof state.trigger?.click==='function')state.trigger.click();
    else env.location?.assign?.(state.info?.url);
   }finally{replaying=false;}
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
   if(state!==active||state.closed)return;
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
   const generation=++openGeneration,state=active;
   if(state){
    let request=state.closeRequest;
    if(!request){
     let resolve;const promise=new Promise(done=>{resolve=done;});
     request=state.closeRequest={requestId:++closeSequence,promise,resolve};
     request.timer=env.setTimeout?.(()=>settleClose(state,true),2000);
    }
    sendClose(state);
    if(!await request.promise||dead||generation!==openGeneration||active)return;
   }
   if(!dead)mount(info);
  }
  function mount(info){
   cleanNotice();
   const currentRuntime=runtime();
   let readerURL,extensionOrigin;
   try{
    readerURL=new URL(currentRuntime.getURL('pdf-reader.html'));
    if(readerURL.protocol!=='chrome-extension:'||!readerURL.host)throw Error('Invalid extension URL.');
    // URL.origin is "null" for chrome-extension: under Node; derive scheme and host.
    extensionOrigin=readerURL.protocol+'//'+readerURL.host;
   }catch{inform('The PDF reader is unavailable. Opening the Canvas viewer.');replaying=true;try{info.element.click?.();}finally{replaying=false;}return;}
   const token=env.crypto?.randomUUID?.();
   if(typeof token!=='string'||token.length<16){inform('A secure PDF session could not be created.');replaying=true;try{info.element.click?.();}finally{replaying=false;}return;}
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
    state.sent=true;const bytes=state.bytes;state.bytes=null;
    for(const timer of state.timers)env.clearTimeout?.(timer);state.timers=[];
    try{frame.contentWindow.postMessage({type:'reserve-pdf-init',token,origin:env.location.origin,fileId:info.fileId,
     name:info.name,url:info.url,bytes,appearance:state.appearance,aiEnabled:!!env.CanvasHarnessAISource?.mount},extensionOrigin,[bytes]);status.hidden=true;}
    catch(error){fallback(state,error);}
   };
   watch(env,'message',event=>{
    if(state.closed||event.source!==frame.contentWindow||event.origin!==extensionOrigin)return;
    const data=event.data;
    if(!data||data.token!==token||typeof data.type!=='string')return;
    if(data.type==='reserve-pdf-ready'){state.ready=true;sendIfReady();sendClose(state);}
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
   Promise.resolve(persisted(APPEARANCE_KEY)).then(value=>{if(!state.closed){state.appearance=value&&typeof value==='object'?value:{theme:'light'};panel.dataset.theme=model.theme(state.appearance);setWidth(state.width);state.appearanceLoaded=true;sendIfReady();}});
   Promise.resolve(readVerifiedPdf({origin:env.location.origin,fileId:info.fileId,fetchImpl:env.fetch?.bind(env),signal:state.abort.signal}))
    .then(bytes=>{if(!state.closed){state.bytes=bytes;sendIfReady();}}).catch(error=>fallback(state,error));
   return state;
  }
  function delegated(event){
   if(dead||replaying||!fixedReaderOrigin||!site.vanillaPage?.(env.location)||!site.supported?.(env.location?.href))return;
   const info=matchPdfClick(event,env.location?.origin||'');
   if(!info)return;
   event.preventDefault?.();event.stopImmediatePropagation?.();void open(info);
  }
  doc.addEventListener('click',delegated,true);
  return {active:()=>active,destroy(){if(dead)return;dead=true;doc.removeEventListener('click',delegated,true);restore(active,false);cleanNotice();}};
 }
 const api=Object.freeze({create,matchPdfClick,readVerifiedPdf,MAX_BYTES});
 root.ReservePdfHost=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root.document&&root.ReserveSite?.vanillaPage?.(root.location)&&root.ReserveSite?.supported?.(root.location?.href)&&!root.ReservePdfHostController)
  root.ReservePdfHostController=create({root});
})(globalThis);
