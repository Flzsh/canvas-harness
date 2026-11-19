/* Canvas Harness API: background-only account settings, secrets and request budget. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAPI=api;})(globalThis,function(){
 'use strict';
 const ORIGINS=Object.freeze({anthropic:'https://api.anthropic.com',openai:'https://api.openai.com',google:'https://generativelanguage.googleapis.com'}),
   OPTIONAL=[...Object.values(ORIGINS).map(origin=>origin+'/*'),'https://*/*'];
 function owner(scope){
   const [origin,id]=String(scope||'').split('|');
   try{const url=new URL(origin);if(url.protocol==='https:'&&url.origin===origin&&/^\d+$/.test(id))return origin+':'+id;}catch{}
   throw Error('A verified Canvas account is required.');
 }
 function config(input={}){
   const provider=input.provider||'anthropic';
   if(!['anthropic','openai','google','compatible'].includes(provider))throw Error('Choose an API provider.');
   let baseUrl='';
   if(provider==='compatible'){
     let url;
     try{url=new URL(input.baseUrl);}catch{throw Error('Enter an HTTPS base address.');}
     if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Enter an HTTPS base address.');
     baseUrl=url.href.replace(/\/+$/,'');
   }
   const dailyLimit=input.dailyLimit??20;
   if(!Number.isSafeInteger(dailyLimit)||dailyLimit<0||dailyLimit>100000)throw Error('Choose a daily limit from 0 to 100000.');
   const model=typeof input.model==='string'?input.model.trim():provider==='anthropic'?'claude-opus-5-5':'';
   if(model.length>200||/[\x00-\x1f]/.test(model))throw Error('Choose a model.');
   return {way:input.way==='api'?'api':'web',provider,baseUrl,model,dailyLimit};
 }
 const origin=input=>input.provider==='compatible'?new URL(config(input).baseUrl).origin:ORIGINS[input.provider||'anthropic'];
 const day=now=>{const date=new Date(now);return [date.getFullYear(),date.getMonth()+1,date.getDate()].join('-');};
 function history(payload){
   if(payload.messages===undefined)return;
   const rows=payload.messages;
   if(!Array.isArray(rows)||!rows.length||rows.length>40)throw Error('Choose a message history with 1 to 40 messages.');
   let total=0;
   const messages=[];
   for(const row of rows){
     if(!row||Array.isArray(row)||!['user','assistant'].includes(row.role)||typeof row.content!=='string'||!row.content.trim()||(total+=row.content.length)>140000)
       throw Error('Message history must contain user or assistant text, up to 140,000 characters in total.');
     messages.push({role:row.role,content:row.content});
   }
   if(rows.at(-1).role!=='user'||rows.at(-1).content!==payload.text)throw Error('The latest user message must match the context text.');
   return messages;
 }
 function create({local,permissions,provider,indexedDB=globalThis.indexedDB,fetch:fetcher=globalThis.fetch,now=()=>Date.now()}){
  const queues=new Map(),active=new Map(),modelLists=new Map();let opened;
  const keys=scope=>{const account=owner(scope);return {settings:'reserve:api:'+account,secret:cfg=>'reserve:api-key:'+account+':'+cfg.provider+':'+(cfg.baseUrl||origin(cfg))};};
  function serial(key,fn){
    const next=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(fn);
    queues.set(key,next);
    next.finally(()=>{if(queues.get(key)===next)queues.delete(key);}).catch(()=>{});
    return next;
  }
  const check=signal=>{if(signal?.aborted)throw Error('Request stopped.');};
  const storageError=()=>Error('API key storage is unavailable.');
  function open(){
    return opened||=new Promise((resolve,reject)=>{
      if(!indexedDB){reject(storageError());return;}
      const request=indexedDB.open('ch-api-secrets',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('keys'))request.result.createObjectStore('keys');};
      request.onerror=request.onblocked=()=>{opened=null;reject(storageError());};
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opened=null;};resolve(db);};
    });
  }
  async function secretValue(op,name,value){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('keys',op==='get'?'readonly':'readwrite'),store=tx.objectStore('keys'),request=op==='put'?store.put(value,name):store[op](name);
      tx.oncomplete=()=>resolve(request.result);
      tx.onerror=tx.onabort=()=>reject(storageError());
    });
  }
  async function migrate(){
    const names=local.getKeys?await local.getKeys():Object.keys(await local.get(null));
    for(const name of names.filter(name=>name.startsWith('reserve:api-key:'))){
      const key=(await local.get(name))[name];
      if(typeof key==='string'&&key)await secretValue('put',name,key);
      await local.remove(name);
    }
    if(names.includes('reserve:api-legacy-keys'))await local.remove('reserve:api-legacy-keys');
  }
  const ready=migrate();ready.catch(()=>{});
  async function writeSecret(name,key,signal){check(signal);for(const task of active.get(name)||[])task.abort();modelLists.delete(name);await secretValue('put',name,key);}
  async function record(scope){await ready;const key=keys(scope).settings;return (await local.get(key))[key]||{};}
  const revision=saved=>Number.isSafeInteger(saved.revision)?saved.revision:0;
  function view(saved){
    const cfg=config(saved),profile=saved.profiles?.[keysFor(cfg)];
    return {...cfg,revision:revision(saved),last4:typeof profile?.last4==='string'?profile.last4.slice(-4):'',hasKey:profile?.hasKey===true};
  }
  const keysFor=cfg=>cfg.provider+':'+(cfg.baseUrl||origin(cfg));
  async function get(scope){return view(await record(scope));}
  async function allowed(cfg){if(!await permissions?.contains({origins:[origin(cfg)+'/*']}))throw Error('Enable API access for this provider.');}
  async function save(scope,input,{signal}={}){
    const k=keys(scope);
    return serial(k.settings,async()=>{
      check(signal);
      const previous=await record(scope),cfg=config({...view(previous),...input});
      if(cfg.way==='api')await allowed(cfg);
      check(signal);
      const profiles={...previous.profiles},name=keysFor(cfg);
      if(typeof input.key==='string'&&input.key){
        const key=input.key.trim();
        if(key.length<8||key.length>4096||/[\s\x00-\x1f]/.test(key))throw Error('Enter a valid API key.');
        if(cfg.model.includes(key)||cfg.baseUrl.includes(key))throw Error('Choose a model and provider address.');
        await writeSecret(k.secret(cfg),key,signal);
        profiles[name]={hasKey:true,last4:key.slice(-4)};
      }
      const saved={...cfg,profiles,revision:revision(previous)+1};
      await local.set({[k.settings]:saved});
      return view(saved);
    }).catch(error=>{
      if(input.key&&String(error?.message).includes(String(input.key).trim()))throw Error('API settings could not be saved.');
      throw error;
    });
  }
  async function remove(scope,{signal}={}){
    const k=keys(scope);
    return serial(k.settings,async()=>{
      check(signal);
      const previous=await record(scope),cfg=config(previous),secret=k.secret(cfg);
      for(const task of active.get(secret)||[])task.abort();
      await secretValue('delete',secret);
      modelLists.delete(secret);
      const profiles={...previous.profiles};
      delete profiles[keysFor(cfg)];
      const saved={...cfg,profiles,revision:revision(previous)+1};
      await local.set({[k.settings]:saved});
      return view(saved);
    });
  }
  async function call(scope,op,payload={},options={}){
   if(options.beforeSend!==undefined&&typeof options.beforeSend!=='function')throw Error('Choose an asynchronous send guard.');
   payload={
     ...payload,
     ...(payload.messages!==undefined?{messages:history(payload)}:{}),
     ...(Array.isArray(payload.photos)?{photos:payload.photos.map(photo=>photo&&{dataUrl:photo.dataUrl})}:{})
   };
   const k=keys(scope),saved=await record(scope),cfg=config(saved);
   check(options.signal);
   if(op!=='models'&&options.revision!==revision(saved))throw Error('API settings changed. Review the message again.');
   if(cfg.way!=='api')throw Error('Turn API on first.');
   await allowed(cfg);
   check(options.signal);
   if(op!=='models'&&!cfg.model)throw Error('Choose a model.');
   if(op!=='models'&&(typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>2100000))throw Error('Choose some context to send, up to 2,100,000 characters.');
   if(!Array.isArray(payload.photos||[])||
     (payload.photos||[]).length>6||
     (payload.photos||[]).some(photo=>typeof photo?.dataUrl!=='string'||photo.dataUrl.length>12*1024*1024||!/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo.dataUrl)))
     throw Error('Choose up to six supported photos.');
   const secret=k.secret(cfg),key=await secretValue('get',secret);check(options.signal);if(typeof key!=='string'||!key)throw Error('Save an API key first.');
   const transportOptions={...options,models:modelLists.get(secret)||[]};if(op!=='models')provider.validate(cfg,key,payload,transportOptions);
   const controller=new AbortController(),abort=()=>controller.abort();
   options.signal?.addEventListener('abort',abort,{once:true});
   if(options.signal?.aborted)controller.abort();
   let tasks=active.get(secret);
   if(!tasks)active.set(secret,tasks=new Set());
   tasks.add(controller);
   let reservation='',dispatched=false,sendGuardError=null;
   const current=async()=>{
     const latest=await record(scope);
     if(revision(latest)!==revision(saved)||JSON.stringify(config(latest))!==JSON.stringify(cfg))throw Error('API settings changed. Review the message again.');
   };
   const safeFetch=async(url,init)=>{
     const signal=init.signal?AbortSignal.any([controller.signal,init.signal]):controller.signal;
     check(signal);
     if(new URL(url).origin!==origin(cfg))throw Error('Provider address changed.');
     let response;
     await serial(k.settings,async()=>{
       check(signal);
       await current();
       await allowed(cfg);
       try{await options.beforeSend?.();}catch(error){sendGuardError=error;throw error;}
       check(signal);
       dispatched=true;
       response=fetcher(url,{...init,signal});
       response.catch?.(()=>{});
     });
     return response;
   };
   // Only an answer request counts toward the daily limit, once per send: estimates, model lists and the provider's own retry are free.
   try{
     if(op==='generate')
       await serial(k.settings,async()=>{
         check(controller.signal);
         await current();
         await allowed(cfg);
         check(controller.signal);
         const usageKey=k.settings+':usage',usage=(await local.get(usageKey))[usageKey]||{},today=day(now()),count=usage.day===today?Number(usage.count)||0:0;
         if(count>=cfg.dailyLimit)throw Error('Daily API request limit reached.');
         check(controller.signal);
         await local.set({[usageKey]:{day:today,count:count+1}});
         reservation=today;
       });
     check(controller.signal);
     const result=await provider[op](cfg,key,payload,{...transportOptions,signal:controller.signal,fetch:safeFetch});
     check(controller.signal);
     await current();
     if(op==='models')modelLists.set(secret,result);
     return result;
   }
   catch(error){
     if(controller.signal.aborted)throw Error('Request stopped.');
     if(sendGuardError)error=sendGuardError;
     const message=String(error?.message||'The provider request failed.');
     throw Error(message.includes(key)?'The provider request failed.':message);
   }
   finally{
     tasks.delete(controller);
     if(!tasks.size)active.delete(secret);
     options.signal?.removeEventListener('abort',abort);
     if(reservation&&!dispatched)
       await serial(k.settings,async()=>{
         const usageKey=k.settings+':usage',usage=(await local.get(usageKey))[usageKey];
         if(usage?.day===reservation)await local.set({[usageKey]:{...usage,count:Math.max(0,(Number(usage.count)||0)-1)}});
       });
   }
  }
  return {
    get,
    save,
    remove,
    models:(scope,options)=>call(scope,'models',{},options),
    estimate:(scope,payload,options)=>call(scope,'estimate',payload,options),
    generate:(scope,payload,options)=>call(scope,'generate',payload,options)
  };
 }
 return {create,owner,config,origin,OPTIONAL};
});
