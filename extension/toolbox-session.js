/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root){
  'use strict';

  const DEFAULT_ORIGIN=(globalThis.ReserveSite.origin());

  function codedError(message,code){
    const error=new Error(message);
    error.code=code;
    return error;
  }

  function cancelled(){
    return codedError('The toolbox session was closed before it finished loading.','cancelled');
  }

  function auth(message='Could not verify the signed-in Canvas account.'){
    return codedError(message,'auth');
  }

  function accountId(profile){
    if(!profile||profile.id==null||!/^\d+$/.test(String(profile.id)))throw auth();
    return String(profile.id);
  }

  function create({client,createStore,origin=DEFAULT_ORIGIN}={}){
    const controller=new AbortController();
    let dead=false;
    let pending=null;
    let store=null;
    let storeAccount=null;

    const alive=()=>!dead&&!controller.signal.aborted;
    const requireAlive=()=>{if(!alive())throw cancelled();};

    function discardStore(){
      if(!store)return;
      const previous=store;
      store=null;
      storeAccount=null;
      previous.destroy();
    }

    function validateCache(snapshot,id){
      if(snapshot==null)return null;
      if(
        typeof snapshot!=='object'||
        snapshot.origin!==origin||
        !snapshot.user||String(snapshot.user.id)!==id||
        !Array.isArray(snapshot.courses)||
        !Array.isArray(snapshot.assignments)
      )throw auth('Saved Canvas data belongs to a different account or site.');
      return snapshot;
    }

    function emptySnapshot(user){
      return {origin,user,courses:[],assignments:[],fetchedAt:null,partial:false};
    }

    function normalizeFailure(error){
      if(!alive()||error?.code==='cancelled'||error?.name==='AbortError')return cancelled();
      if(error?.code==='auth')return auth(error.message||undefined);
      return error;
    }

    function open(){
      if(pending)return pending;
      if(!alive())return Promise.reject(cancelled());

      const operation=(async()=>{
        try{
          if(!client||typeof client.profile!=='function'||typeof createStore!=='function')throw new Error('Toolbox session dependencies are unavailable.');

          const initialUser=await client.profile({signal:controller.signal});
          requireAlive();
          const initialId=accountId(initialUser);

          if(store&&storeAccount!==initialId)discardStore();
          if(!store){
            store=createStore({accountId:initialId,origin});
            storeAccount=initialId;
          }

          await store.load();
          requireAlive();
          const cached=validateCache(await store.readCache(),initialId);
          requireAlive();

          const finalUser=await client.profile({signal:controller.signal});
          requireAlive();
          const finalId=accountId(finalUser);
          if(finalId!==initialId)throw auth('Your Canvas account changed while the toolbox was loading.');

          return {user:finalUser,store,snapshot:cached||emptySnapshot(finalUser)};
        }catch(error){
          const failure=normalizeFailure(error);
          if(failure?.code==='auth')discardStore();
          throw failure;
        }
      })();

      pending=operation;
      const clear=()=>{if(pending===operation)pending=null;};
      operation.then(clear,clear);
      return operation;
    }

    function destroy(){
      if(dead)return;
      dead=true;
      controller.abort();
      discardStore();
    }

    return {open,destroy};
  }

  const api={create};
  root.ReserveToolboxSession=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
