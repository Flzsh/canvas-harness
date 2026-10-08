/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function(root){
  'use strict';
  // The caller keeps Canvas visible. This session only publishes verified data.
  function createSession({client,createStore,onSnapshot,onStatus=()=>{},onError=()=>{},maxAge=300000}){
    const controller=new AbortController();
    let store,user,current,dead=false,pending=null,starting=null;
    const alive=()=>!dead&&!controller.signal.aborted;
    function fail(error){
      if(!alive()||error.code==='cancelled')return;
      const clear=error.code==='auth';
      if(clear)current=null;
      onStatus(error.message||'Canvas could not refresh.');
      onError(error,{clear});
    }
    function refresh(){
      if(pending)return pending;
      if(!alive()||!store||!user)return Promise.resolve(null);
      const operation=(async()=>{
        onStatus(current?'Updating in the background…':'Adding your course information…');
        try{
          const next=await client.loadSnapshot({user,signal:controller.signal});
          if(!alive())return null;
          if(String(next.user?.id)!==String(user.id)){
            const error=Error('Your Canvas account changed. Reload Canvas to continue.');error.code='auth';throw error;
          }
          current=next;
          onSnapshot(next,store,{stale:false});
          onStatus(next.partial?'Some courses could not refresh. See the course notices.':'');
          try{await store.writeCache(next);}catch{if(alive())onStatus('Updated · This visit could not be saved for faster loading.');}
          return next;
        }catch(error){fail(error);return null;}
      })();
      pending=operation;
      operation.finally(()=>{if(pending===operation)pending=null;});
      return operation;
    }
    function start(){
      if(starting)return starting;
      starting=(async()=>{
        try{
          user=await client.profile({signal:controller.signal});
          if(!alive())return;
          store=createStore({accountId:String(user.id),origin:client.origin});
          await store.load();
          if(!alive())return;
          const cached=await store.readCache();
          if(!alive())return;
          const age=cached?Date.now()-Date.parse(cached.fetchedAt):Infinity;
          // Future/invalid timestamps and partial results always need a refresh.
          const fresh=!!cached&&Number.isFinite(age)&&age>=0&&age<maxAge&&!cached.partial;
          if(cached){current=cached;onSnapshot(cached,store,{stale:!fresh});onStatus(fresh?'':'Saved view · Updating in the background…');}
          if(!fresh)await refresh();
        }catch(error){fail(error);}
      })();
      return starting;
    }
    async function verify(){
      if(!alive()||!user)return;
      try{const next=await client.profile({signal:controller.signal});if(!alive())return;if(String(next.id)!==String(user.id)){const error=Error('Your Canvas account changed. Reload Canvas to continue.');error.code='auth';throw error;}await store?.load();return true;}catch(error){fail(error);return false;}
    }
    return {start,refresh,verify,destroy(){if(dead)return;dead=true;controller.abort();store?.destroy();},getSnapshot:()=>current};
  }
  root.ReserveSession={createSession};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.ReserveSession;
})(globalThis);
