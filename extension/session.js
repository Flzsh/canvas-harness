/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function(root){
  'use strict';
  // The caller keeps Canvas visible. This session only publishes verified data.
  // A partial snapshot (some courses failed) stays fresh for a shorter time, so a
  // course that keeps failing does not reload every course on each tab return.
  function createSession({
    client,
    createStore,
    onSnapshot,
    onStatus=()=>{},
    onError=()=>{},
    onTiming=()=>{},
    maxAge=300000,
    partialMaxAge=60000,
    prefetchedProfile=null,
    quickOpen=null
  }){
    let controller=new AbortController(),generation=0,paused=false;
    let store,user,current,dead=false,pending=null,starting=null,checking=null;
    // When the account was last confirmed with Canvas (start, or a return to the tab).
    let verifiedAt=0;
    const alive=(epoch=generation)=>!dead&&!paused&&epoch===generation&&!controller.signal.aborted;
    function isFresh(value){
      const age=value?Date.now()-Date.parse(value.fetchedAt):Infinity;
      return !!value&&Number.isFinite(age)&&age>=0&&age<(value.partial?Math.min(partialMaxAge,maxAge):maxAge);
    }
    function phase(name){try{onTiming(name);}catch{}}
    function fail(error,epoch=generation){
      if(!alive(epoch)||error.code==='cancelled')return;
      const clear=error.code==='auth';
      if(clear)current=null;
      onStatus(error.message||'Canvas could not refresh.');
      onError(error,{clear});
    }
    function refresh(){
      if(pending)return pending;
      if(!alive()||!store||!user)return Promise.resolve(null);
      const epoch=generation,signal=controller.signal;
      const operation=(async()=>{
        onStatus(current?'Updating in the background…':'Adding your course information…');
        try{
          const next=await client.loadSnapshot({user,signal,verifiedAt});
          if(!alive(epoch))return null;
          if(String(next.user?.id)!==String(user.id)){
            const error=Error('Your Canvas account changed. Reload Canvas to continue.');error.code='auth';throw error;
          }
          let deadlineWarning='';
          try{await root.ReserveDeadlineChanges?.record(store,next,{current:()=>alive(epoch)});}catch{deadlineWarning='Deadline changes could not be saved on this device.';}
          if(!alive(epoch))return null;
          current=next;
          onSnapshot(next,store,{stale:false});
          if(!alive(epoch))return null;
          onStatus([next.partial?'Some courses could not refresh. See the course notices.':'',deadlineWarning].filter(Boolean).join(' '));
          try{await store.writeCache(next);}catch{if(alive(epoch))onStatus('Updated · This visit could not be saved for faster loading.');}
          return next;
        }catch(error){fail(error,epoch);return null;}
      })();
      pending=operation;
      operation.finally(()=>{if(pending===operation)pending=null;});
      return operation;
    }
    function start(){
      if(starting)return starting;
      if(!alive())return Promise.resolve(null);
      const epoch=generation,signal=controller.signal;
      let shownEarly=false;
      starting=(async()=>{
        try{
          // The startup guard may have an early identity hint. Begin a fresh Canvas
          // verification now, and load only that hinted account's scoped cache
          // in parallel. No cached content is published before verification.
          phase('profileStart');
          const verifying=Promise.resolve(client.profile({signal})).then(profile=>{if(alive(epoch))phase('profileEnd');return profile;});
          const candidate=prefetchedProfile
            ? await Promise.race([verifying,Promise.resolve(prefetchedProfile).then(
              hint=>/^\d+$/.test(String(hint?.id??''))?hint:verifying,
              ()=>verifying
            )])
            : await verifying;
          if(!alive(epoch))return;
          store=createStore({accountId:String(candidate.id),origin:client.origin});
          const cachedLoad=(async()=>{
            // Preferences and courses occupy independent account-scoped keys.
            // Load together; publish only after both and verification finish.
            phase('storageStart');
            const [,cached]=await Promise.all([
              Promise.resolve(store.load()).then(value=>{phase('preferencesLoaded');return value;}),
              Promise.resolve(store.readCache()).then(value=>{phase('cacheLoaded');phase(value?'cacheHit':'cacheMiss');return value;})
            ]);
            return alive(epoch)?cached:null;
          })();
          // An owner who turned on "Open at once" sees their saved view while Canvas answers. It closes again if
          // the answer names another account or does not come.
          if(prefetchedProfile&&quickOpen){
            const saved=await cachedLoad;
            if(!alive(epoch))return;
            if(saved&&quickOpen(store.get()?.settings)){shownEarly=true;current=saved;onSnapshot(saved,store,{stale:true,unverified:true});if(!alive(epoch))return;}
          }
          const [verified,cached]=await Promise.all([verifying,cachedLoad]);
          if(!alive(epoch))return;
          if(String(verified.id)!==String(candidate.id)){
            const error=Error('Your Canvas account changed. Reload Canvas to continue.');error.code='auth';throw error;
          }
          user=verified;verifiedAt=Date.now();
          // Future/invalid timestamps need a refresh; partial results only after partialMaxAge.
          const fresh=isFresh(cached);
          if(cached){current=cached;onSnapshot(cached,store,{stale:!fresh});if(!alive(epoch))return;onStatus(fresh?'':'Saved view · Updating in the background…');}
          if(!fresh)await refresh();
        }catch(error){
          if(shownEarly&&!user&&alive(epoch)&&error.code!=='cancelled'){current=null;onStatus(error.message||'Canvas could not confirm your account.');onError(error,{clear:true});}
          else fail(error,epoch);
        }
      })();
      return starting;
    }
    function suspend(){
      if(dead||paused)return;
      paused=true;generation++;controller.abort();pending=null;checking=null;
    }
    function verify(){
      if(dead||!user)return Promise.resolve(false);
      if(checking)return checking;
      if(paused){controller=new AbortController();paused=false;}
      const epoch=generation,signal=controller.signal;
      const operation=(async()=>{
        try{
          const next=await client.profile({signal});
          if(!alive(epoch))return false;
          if(String(next.id)===String(user.id))verifiedAt=Date.now();
          if(String(next.id)!==String(user.id)){const error=Error('Your Canvas account changed. Reload Canvas to continue.');error.code='auth';throw error;}
          await store?.load();
          if(!alive(epoch))return false;
          // Suspending aborts an in-flight course refresh. After fresh identity
          // verification, reopen immediately and resume stale data in parallel.
          if(current&&!isFresh(current))refresh();
          return true;
        }catch(error){fail(error,epoch);return false;}
      })();
      checking=operation;operation.finally(()=>{if(checking===operation)checking=null;});return operation;
    }
    return {start,refresh,verify,suspend,destroy(){if(dead)return;dead=true;generation++;controller.abort();store?.destroy();},getSnapshot:()=>current};
  }
  root.ReserveSession={createSession};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.ReserveSession;
})(globalThis);
