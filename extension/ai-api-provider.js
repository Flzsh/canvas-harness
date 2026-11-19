/* Canvas Harness provider transport. Keys are used only in provider headers. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAPIProvider=api;
})(globalThis,function(){
 'use strict';
 const HOSTS={anthropic:'https://api.anthropic.com',openai:'https://api.openai.com',google:'https://generativelanguage.googleapis.com'};
 const redact=(value,key)=>key?String(value||'').split(key).join('[redacted]'):String(value||'');
 function history(payload,key){
  if(payload.messages===undefined)return [{role:'user',content:redact(payload.text,key)}];
  const rows=payload.messages;
  if(!Array.isArray(rows)||!rows.length||rows.length>40)throw Error('Choose a message history with 1 to 40 messages.');
  let total=0;
  const result=[];
  for(const row of rows){
   if(!row||Array.isArray(row)||!['user','assistant'].includes(row.role)||typeof row.content!=='string'||!row.content.trim()||(total+=row.content.length)>140000)
    throw Error('Message history must contain user or assistant text, up to 140,000 characters in total.');
   result.push({role:row.role,content:redact(row.content,key)});
  }
  if(rows.at(-1).role!=='user'||rows.at(-1).content!==payload.text)throw Error('The latest user message must match the context text.');
  return result;
 }
 function base(cfg){
  if(HOSTS[cfg.provider])return HOSTS[cfg.provider]+(cfg.provider==='google'?'/v1beta':'/v1');
  let url;
  try{url=new URL(cfg.baseUrl);}catch{throw Error('Enter an HTTPS base address.');}
  if(cfg.provider!=='compatible'||url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Enter an HTTPS base address.');
  return url.origin+(url.pathname==='/'?'/v1':url.pathname.replace(/\/+$/,''));
 }
 const origin=cfg=>new URL(base(cfg)).origin;
 function headers(cfg,key,fallback){
  const result={'content-type':'application/json'};
  if(cfg.provider==='anthropic'){Object.assign(result,{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'});if(fallback)result['anthropic-beta']='server-side-fallback-2026-07-01';}
  else if(cfg.provider==='google')result['x-goog-api-key']=key;else result.Authorization='Bearer '+key;
  return result;
 }
 function images(cfg,model){
  const explicit=model?.images??model?.capabilities?.vision??model?.capabilities?.image_input;
  const modalities=model?.input_modalities||model?.inputModalities||model?.architecture?.input_modalities;
  if(typeof explicit==='boolean')return explicit;
  if(Array.isArray(modalities))return modalities.includes('image');
  const id=String(model?.id||cfg.model||'');
  if(/embedding|audio|transcrib|tts|image|moderation/i.test(id))return false;
  return cfg.provider==='anthropic'?/^claude-/.test(id):cfg.provider==='google'?/^gemini-/.test(id):cfg.provider==='openai'?/^(?:gpt-(?:4o|4\.1|4-turbo|5|6)|o[134](?:-|$))/.test(id):false;
 }
 function content(cfg,key,payload,options){
  const messages=history(payload,key),photos=payload.photos||[];
  if(photos.length&&!images(cfg,(options.models||[]).find(model=>model.id===cfg.model)))throw Error('This model cannot take images.');
  const files=photos.map(photo=>{
   const match=/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo?.dataUrl||'');
   if(!match)throw Error('Choose a supported photo.');
   return {mime:match[1],data:match[2],url:photo.dataUrl};
  });
  return {messages,files};
 }
 function body(cfg,key,payload,options){
  const {messages,files}=content(cfg,key,payload,options),last=messages.length-1;
  if(cfg.provider==='anthropic')
   return {
    model:cfg.model,
    max_tokens:16000,
    messages:messages.map((row,i)=>
     ({role:row.role,content:[{type:'text',text:row.content},...(i===last?files.map(file=>({type:'image',source:{type:'base64',media_type:file.mime,data:file.data}})):[])]})),
    output_config:{effort:'medium'},
    fallbacks:'default'
   };
  if(cfg.provider==='google')
   return {
    contents:messages.map((row,i)=>
     ({role:row.role==='assistant'?'model':'user',parts:[{text:row.content},...(i===last?files.map(file=>({inlineData:{mimeType:file.mime,data:file.data}})):[])]})),
    generationConfig:{maxOutputTokens:16000}
   };
  if(cfg.provider==='openai')
   return {
    model:cfg.model,
    input:messages.map((row,i)=>
     ({role:row.role,content:row.role==='assistant'?row.content:[{type:'input_text',text:row.content},...(i===last?files.map(file=>({type:'input_image',image_url:file.url})):[])]})),
    max_output_tokens:16000,
    store:false
   };
  return {
   model:cfg.model,
   messages:messages.map((row,i)=>
    ({role:row.role,content:i===last&&files.length?[{type:'text',text:row.content},...files.map(file=>({type:'image_url',image_url:{url:file.url}}))]:row.content})),
   max_tokens:16000
  };
 }
 function validate(cfg,key,payload,options={}){
  const address=base(cfg);
  if(!cfg.model)throw Error('Choose a model.');
  if(address.includes(key)||decodeURIComponent(address).includes(key)||String(cfg.model).includes(key))throw Error('Choose a model and provider address.');
  encodeURIComponent(cfg.model);
  content(cfg,key,payload,options);
 }
 const mapped={401:'API key problem.',403:'API key problem.',402:'Check API billing.',404:'Model not available.',413:'The request is too large.',429:'The provider is rate limited.',500:'The provider is unavailable.',529:'The provider is unavailable.'};
 const token=(value,key)=>{const text=String(value||'');return text&&!text.includes(key)&&/^[\w.:-]{1,80}$/.test(text)?text:'';};
 async function session(cfg,key,options,work){
  if(typeof key!=='string'||!key)throw Error('Save an API key first.');
  const address=base(cfg);
  if(address.includes(key)||String(cfg.model||'').includes(key))throw Error('Choose a model and provider address.');
  const controller=new AbortController(),abort=()=>controller.abort(),timeout=setTimeout(abort,options.timeoutMs??60000);
  options.signal?.addEventListener('abort',abort,{once:true});
  if(options.signal?.aborted)abort();
  const sleep=options.sleep||((ms,signal)=>new Promise((resolve,reject)=>{
   const timer=setTimeout(done,ms);
   function done(){signal.removeEventListener('abort',stop);resolve();}
   function stop(){clearTimeout(timer);signal.removeEventListener('abort',stop);reject(Error('Request stopped.'));}
   if(signal.aborted)stop();else signal.addEventListener('abort',stop,{once:true});
  }));
  const check=()=>{if(controller.signal.aborted)throw Error(options.signal?.aborted?'Request stopped.':'The request timed out.');};
  async function request(url,method='GET',data,fallback=cfg.provider==='anthropic'){
   let retried=false,betaRetried=false;
   for(;;){
    check();
    if(decodeURIComponent(url).includes(key))throw Error('Choose a model and provider address.');
    let response,json;
    try{
     response=await (options.fetch||
      globalThis.fetch)(url,{method,headers:headers(cfg,key,fallback),...(data?{body:JSON.stringify(data)}:{}),credentials:'omit',redirect:'error',signal:controller.signal});
     check();
     json=await response.json();
     check();
    }catch(error){check();if(/^(Daily API request limit reached\.|API settings changed\.|Provider address changed\.|Enable API access for this provider\.)/.test(error?.message||''))throw error;throw Error('The provider request failed.');}
    if(response.ok)return json;
    const error=json?.error||{},type=token(error.type||error.status||json?.type,key);
    if(response.status===400&&fallback&&!betaRetried&&String(error.message||'').includes('anthropic-beta')){
     fallback=false;
     betaRetried=true;
     if(data){data={...data};delete data.fallbacks;}
     continue;
    }
    if(!retried&&[429,500,529].includes(response.status)){
     retried=true;
     const after=response.headers?.get('retry-after');
     let delay=1000;
     if(response.status===429&&after){
      const seconds=Number(after);
      delay=Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(after)-(options.now?.()??Date.now()));
      if(!Number.isFinite(delay))delay=1000;
     }
     if(delay>=60000)throw Error(mapped[response.status]);
     await sleep(delay,controller.signal);
     check();
     continue;
    }
    throw Error(mapped[response.status]||('Provider error'+(type?': '+type:'.')));
   }
  }
  try{
   return await work(request,address,check);
  }catch(error){check();throw Error(redact(error?.message||'The provider request failed.',key));}finally{clearTimeout(timeout);options.signal?.removeEventListener('abort',abort);}
 }
 const refusal=category=>({status:'refusal',message:'The AI declined this request'+(category?' ('+category+')':'')});
 const cut=()=>({status:'max_tokens',message:'The answer was cut off',retryable:true});
 function answer(cfg,key,json){
  let text='';
  if(cfg.provider==='anthropic'){
   if(json.stop_reason==='refusal')return refusal(token(json.stop_details?.category,key));
   if(json.stop_reason==='max_tokens')return cut();
   text=(json.content||[]).filter(block=>block.type==='text').map(block=>block.text||'').join('\n');
  }
  else if(cfg.provider==='google'){
   const candidate=json.candidates?.[0];
   if(json.promptFeedback?.blockReason||['SAFETY','RECITATION','BLOCKLIST','PROHIBITED_CONTENT','SPII'].includes(candidate?.finishReason))return refusal();
   if(candidate?.finishReason==='MAX_TOKENS')return cut();
   text=(candidate?.content?.parts||[]).filter(part=>part.thought!==true&&typeof part.text==='string').map(part=>part.text).join('\n');
  }
  else if(cfg.provider==='openai'){
   if(json.status==='incomplete'&&json.incomplete_details?.reason==='max_output_tokens')return cut();
   const parts=(json.output||[]).filter(item=>item.type==='message').flatMap(item=>item.content||[]);
   if(parts.some(part=>part.type==='refusal')||json.incomplete_details?.reason==='content_filter')return refusal();
   if(json.status==='failed'||json.error)throw Error('The provider request failed.');
   text=parts.filter(part=>part.type==='output_text').map(part=>part.text||'').join('\n');
  }
  else{
   const choice=json.choices?.[0];
   if(choice?.finish_reason==='length')return cut();
   if(choice?.finish_reason==='content_filter'||choice?.message?.refusal)return refusal();
   text=typeof choice?.message?.content==='string'?choice.message.content:'';
  }
  if(!text.trim())throw Error('The provider returned no text.');return {status:'answer',text:redact(text,key)};
 }
 // All operations accept (config, key, payload, options). Only options.fetch performs I/O.
 async function models(cfg,key,_payload={},options={}){
  return session(cfg,key,options,async(request,address)=>{
   const result=[],seen=new Set();
   let url=address+'/models';
   for(let page=0;page<100&&url;page++){
    if(seen.has(url))throw Error('The model list could not be read.');
    seen.add(url);
    const json=await request(url),rows=cfg.provider==='google'?json.models:json.data;
    if(!Array.isArray(rows))throw Error('The model list could not be read.');
    for(const row of rows){
     if(cfg.provider==='google'&&!row.supportedGenerationMethods?.includes('generateContent'))continue;
     const id=String(cfg.provider==='google'?row.name?.replace(/^models\//,''):row.id||'');
     if(!id||id.includes(key)||id.length>200)continue;
     result.push({id,label:redact(row.display_name||row.displayName||id,key),images:images(cfg,{...row,id})});
    }
    url=cfg.provider==='google'&&json.nextPageToken?
     address+'/models?pageToken='+encodeURIComponent(json.nextPageToken):
     cfg.provider==='anthropic'&&json.has_more&&json.last_id?address+'/models?after_id='+encodeURIComponent(json.last_id):'';
    if(url.includes(key))throw Error('The model list could not be read.');
   }
   return result;
  });
 }
 async function estimate(cfg,key,payload,options={}){
  if(cfg.provider!=='anthropic')return {tokens:Math.ceil(history(payload,key).reduce((sum,row)=>sum+row.content.length,0)/4)};
  const data=body(cfg,key,payload,options);
  delete data.max_tokens;
  delete data.fallbacks;
  delete data.output_config;
  return session(cfg,key,options,async(request,address)=>{
   const json=await request(address+'/messages/count_tokens','POST',data,false);
   if(!Number.isSafeInteger(json.input_tokens)||json.input_tokens<0)throw Error('The token estimate is unavailable.');
   return {tokens:json.input_tokens};
  });
 }
 async function generate(cfg,key,payload,options={}){
  const data=body(cfg,key,payload,options),
   path=cfg.provider==='anthropic'?
    '/messages':
    cfg.provider==='google'?'/models/'+encodeURIComponent(String(cfg.model||'').replace(/^models\//,''))+':generateContent':cfg.provider==='openai'?'/responses':'/chat/completions';
  return session(cfg,key,options,async(request,address)=>answer(cfg,key,await request(address+path,'POST',data)));
 }
 return {origin,models,estimate,generate,images,validate};
});
