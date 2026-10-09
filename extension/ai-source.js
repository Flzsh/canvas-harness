/* Canvas Harness: explicitly selected course context. No AI credentials or chat history here. */
(function(root){
 'use strict';
 const MAX_BYTES=2*1024*1024;
 const C=()=>root.CanvasHarnessContext;
 function create({getContext,store,client,user,demo=false,parsePDF,fetchImpl=root.fetch?.bind(root)}){
  const origin=store.owner?.origin||client?.origin||root.location?.origin,accountId=String(user?.id||store.owner?.accountId||'');
  const resources=new Map(),updates=new Map(),freshAssignments=new Map();
  let dead=false;
  const scopeKey=()=>{const ctx=getContext();return [origin,accountId,ctx.courseId||'all',ctx.aiAssignmentId||''].join('|');};
  function assertScope(key){if(dead||key!==scopeKey())throw Error('The Canvas view changed. Review the sources for the new page.');}
  async function verify(signal){
   if(demo)return;
   if(!client?.profile||!accountId)throw Error('Reopen Canvas Harness to verify your Canvas account.');
   const found=await client.profile({signal});
   if(String(found.id)!==accountId)throw Error('Your Canvas account changed. Reopen Canvas Harness before sharing context.');
  }
  function current(){
   const ctx=getContext(),extra=ctx.aiResources||[],news=ctx.aiUpdates||[];
   const items=(ctx.items||[]).map(x=>freshAssignments.get(String(x.courseId)+':'+String(x.id))||x);
   for(const item of freshAssignments.values())if(!items.some(x=>String(x.id)===String(item.id)&&String(x.courseId)===String(item.courseId)))items.push(item);
   // The panel filters the catalog by course. Explicitly choosing a different
   // course must not lose its selected sources when another list is loaded.
   const raw=C().catalog({...ctx,items,courseId:'all'},{origin,resources:[...new Map([...extra,...resources.values()].map(r=>[String(r.courseId),r])).values()],updates:[...new Map([...news,...updates.values()].map(r=>[String(r.courseId),r])).values()]});
   return {ctx,...raw};
  }
  function summary(){
   const {ctx,sources,active}=current();
   return {scopeKey:scopeKey(),courseId:ctx.courseId||'all',active:active?{id:active.id,title:active.title,courseName:active.courseName,courseId:active.courseId}:null,
    courses:(ctx.courses||[]).map(c=>({id:String(c.id),name:c.shortName||c.name})),
    sources:sources.map(({id,title,kind,courseName,courseId,url,text,size})=>({id,title,kind,courseName,courseId,url,loaded:typeof text==='string',size})),
    demo,theme:ctx.s?.theme==='dark'||ctx.s?.theme==='system'&&root.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light',motion:ctx.s?.motion||'gentle'};
  }
  async function readAssignment(courseId,id,signal){
   const data=await client.readAssignment(courseId,id,{user:{id:accountId},signal});
   const course=getContext().courses.find(c=>String(c.id)===String(courseId));
   // Select instructional fields only; never the submission, score, or student list.
   const item={id:String(data.id),courseId:String(courseId),name:data.name,description:data.description,rubric:data.rubric,dueAt:data.due_at,courseName:course?.shortName||course?.name||'',url:origin+'/courses/'+courseId+'/assignments/'+id};
   freshAssignments.set(String(courseId)+':'+String(id),item);return C().assignment(item,origin);
  }
  async function catalog({signal}={}){
   const key=scopeKey(),ctx=getContext();
   // Native assignment routes need not have a dashboard cache yet.
   if(ctx.aiAssignmentId&&!current().active&&client?.readAssignment&&/^\d+$/.test(String(ctx.courseId))){
    await verify(signal);await readAssignment(String(ctx.courseId),String(ctx.aiAssignmentId),signal);assertScope(key);
   }
   return summary();
  }
  async function loadCourse(courseId,{signal}={}){
   const key=scopeKey(),id=String(courseId);
   if(!getContext().courses.some(c=>String(c.id)===id))throw Error('Choose an available course.');
   await verify(signal);
   if(!client?.loadCourseResources)throw Error('Course materials are unavailable on this page.');
   const raw=await client.loadCourseResources(id,{user:{id:accountId},signal});assertScope(key);
   if(!demo&&(raw.origin!==origin||String(raw.accountId)!==accountId))throw Error('The course materials belong to another Canvas session.');
   resources.set(id,raw);
   if(client.loadCourseUpdates){const news=await client.loadCourseUpdates(id,{user:{id:accountId},signal});assertScope(key);updates.set(id,news);}
   await verify(signal);assertScope(key);return summary();
  }
  async function download(file,{signal}={}){
   if(Number(file.size)>MAX_BYTES)throw Error('Larger than 2 MiB. Choose a smaller document.');
   let url;try{url=new URL(file.url,origin);}catch{throw Error('No readable download link was provided.');}
   if(url.origin!==origin||url.username||url.password||!/^\/(?:courses\/\d+\/)?files\/\d+(?:\/download)?\/?$/.test(url.pathname))throw Error('This file uses an external download. Download it in Canvas and attach the small PDF here.');
   const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,15000);
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   try{
    const response=await fetchImpl(url.href,{method:'GET',credentials:'same-origin',redirect:'error',signal:controller.signal});
    if(!response.ok||response.redirected||response.type==='opaqueredirect')throw Error('Canvas did not allow a direct file read.');
    if(Number(response.headers.get('content-length'))>MAX_BYTES)throw Error('Larger than 2 MiB. Choose a smaller document.');
    const reader=response.body?.getReader();if(!reader)throw Error('This browser cannot read the file safely.');
    const chunks=[];let length=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BYTES){await reader.cancel();throw Error('Larger than 2 MiB. Choose a smaller document.');}chunks.push(value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const type=response.headers.get('content-type')||'';
    if(bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-'){
     if(!parsePDF)throw Error('PDF reading is unavailable. Reload the extension.');
     return await parsePDF(bytes,{signal:controller.signal});
    }
    if(/^text\/plain(?:;|$)/i.test(type))return {text:new TextDecoder().decode(bytes).slice(0,60000),truncated:bytes.length>60000,warnings:[]};
    throw Error('Only text PDFs and plain-text files can be included. Open other documents in Canvas.');
   }catch(error){
    if(controller.signal.aborted)throw Error('File reading was cancelled or took too long.');
    if(error instanceof TypeError)throw Error('Canvas redirected or blocked this download. Download it in Canvas and attach the small PDF here.');
    throw error;
   }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async function material(source,signal){
   if(source.kind==='assignment'&&client?.readAssignment&&!demo)return readAssignment(source.courseId,source.assignmentId,signal);
   if(source.kind==='page'&&client?.readCoursePage){
    const html=await client.readCoursePage(source.courseId,source.slug,{user:{id:accountId},signal});
    return {...source,text:C().plain(html),links:C().links(html,origin,source.courseId)};
   }
   if(source.kind==='file'){
    if(!client?.readFile)throw Error(demo?'PDF download is not available in this artificial preview.':'File reading is unavailable.');
    const file=await client.readFile(source.courseId,source.fileId,{user:{id:accountId},signal});
    const result=await download(file,{signal});
    return {...source,title:file.display_name||file.filename||source.title,text:result.text,truncated:result.truncated,warnings:result.warnings||[]};
   }
   return source;
  }
  async function collect({ids=[],all=false,signal}={}){
   const key=scopeKey();await verify(signal);assertScope(key);
   const {sources,active}=current(),byId=new Map(sources.map(s=>[s.id,s]));
   if(!Array.isArray(ids)||ids.length>30||ids.some(id=>typeof id!=='string'||!byId.has(id)))throw Error('The source selection changed. Review it before sharing.');
   if(all&&!active)throw Error('Open an assignment to gather all of its linked materials.');
   const queue=(all?[active]:ids.map(id=>byId.get(id))).map(source=>({source,depth:0})),seen=new Set(),resolved=[];
   while(queue.length&&resolved.length<C().MAX_SOURCES){
    if(signal?.aborted)throw Error('Context gathering cancelled.');assertScope(key);
    const {source,depth}=queue.shift();if(seen.has(source.id))continue;seen.add(source.id);
    let read;try{read=await material(source,signal);}catch(error){
     if(signal?.aborted||error.code==='auth'||error.code==='cancelled')throw error;
     read={...source,text:'',error:String(error.message||'This source could not be read.')};
    }
    assertScope(key);resolved.push(read);
    if(all&&depth<2)for(const link of read.links||[]){
     const id=link.kind==='page'?'page:'+link.courseId+':'+link.slug:'file:'+link.courseId+':'+link.fileId;
     if(!seen.has(id))queue.push({source:byId.get(id)||{...link,id,title:link.kind==='page'?link.slug.replace(/-/g,' '):'Linked document '+link.fileId,courseName:source.courseName,text:null},depth:depth+1});
    }
   }
   await verify(signal);assertScope(key);
   const result=C().bundle(resolved);if(queue.length)result.omitted.push({title:'Additional linked materials',reason:'The 30-source limit was reached.'});
   for(const s of resolved)for(const warning of s.warnings||[])result.omitted.push({title:s.title,reason:warning});
   return {...result,scopeKey:key};
  }
  return {summary,catalog,loadCourse,collect,verify,destroy(){dead=true;resources.clear();updates.clear();freshAssignments.clear();}};
 }
 function base64(bytes){let value='';for(let i=0;i<bytes.length;i+=16384)value+=String.fromCharCode(...bytes.subarray(i,i+16384));return root.btoa(value);}
 function mount({container,getContext,store,client,user,demo=false,onClose=()=>{}}){
  let frame,port,dead=false,lastSignature='';
  const runtime=root.chrome?.runtime,preview=demo&&!runtime?.id&&/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(root.location?.origin||'');
  async function parsePDF(bytes){
   if(!runtime?.id)throw Error('Install the extension to read PDFs locally.');
   const response=await runtime.sendMessage({type:'ch-ai-pdf',base64:base64(bytes)});if(!response?.ok)throw Error(response?.error||'PDF text could not be read.');return response.result;
  }
  const source=create({getContext,store,client,user,demo,parsePDF});
  const send=message=>{if(dead)return;if(preview)frame?.contentWindow?.postMessage({type:'ch-ai-reply',reply:message},root.location.origin);else try{port?.postMessage(message);}catch{}};
  async function request(message){
   const {id,action}=message||{};if(typeof id!=='string'||id.length>100)return;
   if(action==='close'){onClose();send({id,ok:true,result:{}});return;}
   try{
    let result;if(action==='catalog')result=await source.catalog();
    else if(action==='load-course')result=await source.loadCourse(message.courseId);
    else if(action==='collect')result=await source.collect(message);
    else if(preview)throw Error('This artificial preview cannot connect accounts or open AI chats. Install Canvas Harness to use this feature.');
    else return;
    send({id,ok:true,result});
   }catch(error){send({id,ok:false,error:String(error.message||'Context could not be loaded.')});}
  }
  function onPreview(event){if(preview&&event.origin===root.location.origin&&event.source===frame.contentWindow&&event.data?.type==='ch-ai-request')request(event.data.request);}
  frame=document.createElement('iframe');frame.className='rd-ai-frame';frame.title='AI study workspace';frame.referrerPolicy='no-referrer';
  frame.src=runtime?.id?runtime.getURL('ai-panel.html'):new URL('../extension/ai-panel.html?preview=1',root.location.href).href;
  if(preview)root.addEventListener('message',onPreview);
  else if(runtime?.id){
   port=runtime.connect({name:'ch-ai-source'});
   port.onMessage.addListener(message=>{if(message.kind==='source-request')request(message);});
   port.onDisconnect.addListener(()=>{port=null;});
  }
  container.append(frame);
  function update(){
   if(dead)return;try{
    const data=source.summary(),signature=JSON.stringify(data);
    if(signature!==lastSignature){lastSignature=signature;send({kind:'catalog',data});}
   }catch{}
  }
  frame.addEventListener('load',()=>{lastSignature='';update();});
  update();
  // Metadata only. Requests fetch text explicitly; no chat or credentials cross into this document.
  const timer=root.setInterval(update,1200);
  return {update,focus(){frame.focus();},destroy(){dead=true;root.clearInterval(timer);root.removeEventListener('message',onPreview);source.destroy();port?.disconnect();frame.remove();}};
 }
 root.CanvasHarnessAISource={create,mount,base64,MAX_BYTES};
 if(typeof module==='object'&&module.exports)module.exports=root.CanvasHarnessAISource;
})(globalThis);
