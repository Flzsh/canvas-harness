/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function(root,factory){
  'use strict';
  const api=factory();
  root.ReserveNativeAppearance=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const enums={
    theme:['original','light','dark','system'],
    readingWidth:['comfortable','full'],
    textSize:['standard','large'],
    accent:['clay','forest','indigo','ocean','rose','amber'],
  };
  const keys=Object.keys(enums);

  function defaults(){
    return {theme:'original',readingWidth:'comfortable',textSize:'standard',accent:'clay'};
  }

  // Canvas Harness 2.15 made Clay the default link accent. Canvas-page preferences
  // saved before it hold accent 'forest' (the old default), so a stored forest
  // with no version becomes clay exactly once; the version (2) lives in a sibling
  // storage key, because patchValues rejects unknown preference keys. Any other
  // accent, and a Forest chosen again later, is kept.
  const VERSION=2;
  function migrate(value,version){
    const current=Number.isInteger(version)?version:1;
    if(current>=VERSION)return {value,version:current,changed:false};
    const moved=value!==null&&typeof value==='object'&&!Array.isArray(value)&&value.accent==='forest';
    return {value:moved?{...value,accent:'clay'}:value,version:VERSION,changed:moved};
  }

  function patchValues(value){
    if(value===null||typeof value!=='object'||Array.isArray(value))throw new Error('Appearance preferences must be an object.');
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==Object.prototype&&prototype!==null)throw new Error('Appearance preferences must be a plain object.');
    const result={};
    for(const key of Reflect.ownKeys(value)){
      if(typeof key!=='string'||!Object.prototype.hasOwnProperty.call(enums,key))throw new Error('Unknown appearance preference: '+String(key)+'.');
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value')||!enums[key].includes(descriptor.value)){
        throw new Error('Invalid '+key+' preference. Choose '+enums[key].join(', ')+'.');
      }
      result[key]=descriptor.value;
    }
    return result;
  }

  function normalize(value){
    return value==null?defaults():{...defaults(),...patchValues(value)};
  }

  function resolveTheme(prefs,dark){
    const theme=normalize(prefs).theme;
    return theme==='system'?(dark===true?'dark':'light'):theme;
  }

  function same(left,right){return keys.every(key=>left[key]===right[key]);}
  function cancelled(){const error=new Error('The native appearance controller was destroyed.');error.code='cancelled';return error;}

  function create({adapter,apply,media,onError=()=>{}}={}){
    if(!adapter||['read','write','subscribe'].some(name=>typeof adapter[name]!=='function')||typeof apply!=='function'){
      throw new Error('Native appearance requires a read/write/subscribe adapter and an apply callback.');
    }
    let current=defaults(),ready=false,dead=false,startPromise=null,queue=Promise.resolve();
    let unsubscribeAdapter=null,listeningToMedia=false,lastTheme=null,publication=0;
    let incomingRevision=0,initialIncoming=null,activeWrite=null;
    const listeners=new Set();
    const get=()=>({...current});
    const requireAlive=()=>{if(dead)throw cancelled();};

    function report(error){
      if(dead)return;
      try{onError(error instanceof Error?error:new Error(String(error)));}catch{}
    }

    function readPreferences(value){
      try{return normalize(value);}catch(error){report(error);return defaults();}
    }

    function publish(prefs){
      if(dead)return;
      const effectiveTheme=resolveTheme(prefs,media?.matches===true);
      if(lastTheme===effectiveTheme&&same(current,prefs))return;
      current={...prefs};lastTheme=effectiveTheme;
      const version=++publication;
      try{apply(get(),effectiveTheme);}catch(error){report(error);}
      for(const listener of [...listeners]){
        if(dead||version!==publication)break;
        if(!listeners.has(listener))continue;
        try{listener(get(),effectiveTheme);}catch(error){report(error);}
      }
    }

    // Subscription payloads are whole stored values; null means removal/reset.
    // A notification observed after a read or write began takes precedence over
    // that operation's completion, so old async work cannot repaint newer data.
    function receive(value){
      if(dead)return;
      const prefs=readPreferences(value);
      if(dead)return;
      incomingRevision++;
      if(!ready){initialIncoming=prefs;return;}
      if(activeWrite&&same(prefs,activeWrite.prefs)){
        // Adapters can echo our write before their promise settles. Hold this
        // echo until success, so a rejected write never publishes its draft.
        activeWrite.echoRevision=incomingRevision;
        return;
      }
      publish(prefs);
    }

    function mediaChanged(){
      if(!dead&&ready&&current.theme==='system')publish(current);
    }

    function start(){
      if(dead)return Promise.reject(cancelled());
      if(startPromise)return startPromise;
      startPromise=Promise.resolve().then(async()=>{
        requireAlive();
        try{
          const unsubscribe=adapter.subscribe(receive);
          if(typeof unsubscribe==='function'){
            if(dead)unsubscribe();else unsubscribeAdapter=unsubscribe;
          }
        }catch(error){report(error);}
        requireAlive();
        if(typeof media?.addEventListener==='function'){
          try{media.addEventListener('change',mediaChanged);listeningToMedia=true;}catch(error){report(error);}
        }
        requireAlive();
        let loaded=defaults();
        try{
          const value=await adapter.read();
          requireAlive();
          loaded=readPreferences(value);
        }catch(error){requireAlive();report(error);}
        requireAlive();
        ready=true;
        publish(initialIncoming||loaded);
        initialIncoming=null;
        requireAlive();
        return get();
      });
      return startPromise;
    }

    function set(patch){
      if(dead)return Promise.reject(cancelled());
      let delta;
      try{delta=patchValues(patch);}catch(error){return Promise.reject(error);}
      const operation=queue.then(async()=>{
        await start();
        requireAlive();
        const next=normalize({...current,...delta});
        if(same(next,current))return get();
        const writing={prefs:next,revision:incomingRevision,echoRevision:null};
        activeWrite=writing;
        try{
          await adapter.write({...next});
          requireAlive();
          if(incomingRevision===writing.revision||incomingRevision===writing.echoRevision)publish(next);
          requireAlive();
          return get();
        }catch(error){requireAlive();report(error);throw error;}
        finally{if(activeWrite===writing)activeWrite=null;}
      });
      // A failed operation rejects its own caller but cannot poison the queue.
      queue=operation.then(()=>{},()=>{});
      return operation;
    }

    // Subscribers receive defensive (prefs, effectiveTheme) copies on change,
    // including the first settled load; registration itself has no side effect.
    function subscribe(listener){
      if(typeof listener!=='function')throw new Error('Appearance subscriber must be a function.');
      if(dead)return ()=>{};
      listeners.add(listener);
      return ()=>listeners.delete(listener);
    }

    function destroy(){
      if(dead)return;
      dead=true;publication++;listeners.clear();initialIncoming=null;
      if(unsubscribeAdapter){try{unsubscribeAdapter();}catch{}unsubscribeAdapter=null;}
      if(listeningToMedia){try{media.removeEventListener('change',mediaChanged);}catch{}listeningToMedia=false;}
      // Restoring native page styles belongs to the DOM adapter, not this model.
    }

    return {start,get,set,subscribe,destroy};
  }

  return {defaults,normalize,resolveTheme,migrate,VERSION,create};
});
