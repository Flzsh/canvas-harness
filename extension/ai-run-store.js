/* Durable run journal. Mutations, trigger claims and epochs share one IDB transaction. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessRunStore=api;
})(globalThis,function(root){
 'use strict';
 const terminal=r=>['cards-ready','cancelled','failed','unchanged','expired'].includes(r.state),copy=v=>structuredClone(v),queues=new WeakMap();
 function create({indexedDB=root.indexedDB,name='ch-ai-runs',now=()=>Date.now()}={}){
  let opening;
  function open(){
    return opening||=new Promise((resolve,reject)=>{
      if(!indexedDB)return reject(Error('Run storage is unavailable.'));
      const req=indexedDB.open(name,1);
      req.onupgradeneeded=()=>req.result.createObjectStore('journal');
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>resolve(req.result);
    });
  }
  async function transaction(mutator,write=true){
    const db=await open(),prior=queues.get(indexedDB)||Promise.resolve();
    const work=prior.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
      const tx=db.transaction('journal',write?'readwrite':'readonly'),store=tx.objectStore('journal'),req=store.get('v1');
      let result,error;
      req.onsuccess=()=>{
        try{
          const journal=req.result||{v:1,runs:{},claims:{},providers:{}};
          result=mutator(journal);
          if(result?.then)throw Error('Journal mutations must be synchronous.');
          if(write){prune(journal);store.put(journal,'v1');}
        }catch(e){error=e;tx.abort?.();}
      };
      tx.oncomplete=()=>error?reject(error):resolve(copy(result));
      tx.onerror=tx.onabort=()=>reject(error||tx.error||Error('Run persistence failed.'));
    }));
    queues.set(indexedDB,work);
    return work;
  }
  const all=()=>transaction(j=>Object.values(j.runs),false),get=id=>transaction(j=>j.runs[id]||null,false);
  async function start(input){return transaction(j=>{
   if(j.runs[input.id]){if(j.runs[input.id].scope!==input.scope)throw Error('Run belongs to another account.');return j.runs[input.id];}
   const key=input.scope+'|'+input.triggerKey,claimed=j.claims[key];if(claimed&&j.runs[claimed]?.state!=='failed')return j.runs[claimed];
   // A student's question never waits behind Prepare, never joins its queue and never counts toward its daily cap.
   if(input.kind==='ask'){
     const run={
       v:1,
       flow:'one-shot',
       ...copy(input),
       revision:1,
       createdAt:now(),
       updatedAt:now(),
       state:'queued',
       phase:'ask',
       readRound:0,
       aidIndex:0,
       turnIndex:0,
       turns:[],
       effects:[],
       resultKeys:[],
       progress:'Reading your question',
       lease:{epoch:0,expiresAt:0},
       errors:[],
       needsYou:null
     };
     for(const old of Object.values(j.runs))
       if(old.kind==='ask'&&old.scope===input.scope&&old.state==='needs-you'){
         old.state='expired';
         old.progress='Replaced by a newer question';
         old.needsYou=null;
         old.lease={...old.lease,epoch:old.lease.epoch+1,expiresAt:0};
         for(const [k,v]of Object.entries(j.providers))if(v?.runId===old.id)delete j.providers[k];
       }
     j.runs[run.id]=run;
     j.claims[key]=run.id;
     return run;
   }
   const active=Object.values(j.runs).find(r=>r.scope===input.scope&&r.kind!=='ask'&&!terminal(r)&&!r.blockedBy);
   const queued=active?.nextRunId&&j.runs[active.nextRunId];
   if(queued&&!terminal(queued)){Object.assign(queued,copy(input),{id:queued.id});j.claims[key]=queued.id;return queued;}
   const handled=Object.values(j.runs).filter(r=>r.scope===input.scope&&r.kind!=='ask'&&r.day===input.day&&r.handled),
     published=Object.values(j.runs).filter(r=>r.scope===input.scope&&r.day===input.day&&input.publishedRunIds?.includes(r.id)).length,
     dailyBase=Math.max(0,(input.accountDailyCount||0)-published);
   // The daily cap limits automatic runs; a run the student asked for always starts.
   if(input.entry!=='manual'&&dailyBase+handled.length>=input.settings.dailyCap)return {skipped:'cap'};
   const run={
     v:1,
     flow:'one-shot',
     ...copy(input),
     dailyBase,
     revision:1,
     createdAt:now(),
     updatedAt:now(),
     state:'queued',
     phase:'agent',
     readRound:0,
     aidIndex:0,
     turnIndex:0,
     turns:[],
     effects:[],
     resultKeys:[],
     progress:'Checking Canvas',
     lease:{epoch:0,expiresAt:0},
     errors:[],
     needsYou:null
   };
   if(active){run.blockedBy=active.id;active.nextRunId=run.id;}j.runs[run.id]=run;j.claims[key]=run.id;
   // Content is local and bounded; keep unfinished work and two weeks of history.
   for(const [id,r]of Object.entries(j.runs))
     if(terminal(r)&&r.updatedAt<now()-14*86400000){delete j.runs[id];for(const [k,v]of Object.entries(j.claims))if(v===id)delete j.claims[k];}
   return run;
  });}
  // Finished runs keep only the Canvas brief (a later Ask reuses it), not their prompts, and leave after two weeks; runs from the old
  // multi-turn flow that never finished expire after 12 hours.
  function prune(j){
    const at=now();
    for(const [id,r]of Object.entries(j.runs||{})){
      const age=at-Number(r.updatedAt||r.createdAt||at);
      if(!terminal(r)&&r.flow!=='one-shot'&&age>12*3600e3){r.state='expired';r.progress='Replaced by the new Prepare';r.needsYou=null;r.lease={...r.lease,expiresAt:0};delete r.nextRunId;}
      if(!terminal(r))continue;
      if(age>14*86400e3){
        delete j.runs[id];
        for(const [k,v]of Object.entries(j.claims||{}))if(v===id)delete j.claims[k];
        for(const [k,v]of Object.entries(j.providers||{}))if(v?.runId===id)delete j.providers[k];
        continue;
      }
      if(age>600e3){
        if(r.snapshot&&Object.keys(r.snapshot).some(k=>k!=='brief')){if(r.snapshot.brief)r.snapshot={brief:r.snapshot.brief};else delete r.snapshot;}
        delete r.messages;
        for(const t of r.turns||[])for(const [k,v]of Object.entries(t))if(k!=='deliveryReceipt'&&(JSON.stringify(v)?.length||0)>2000)delete t[k];
      }
    }
  }
  function mutate(id,epoch,fn){
    return transaction(j=>{
      const r=j.runs[id];
      if(!r)throw Error('Run not found.');
      if(epoch!==null&&(r.lease.epoch!==epoch||terminal(r)))throw Error('Run epoch stopped.');
      fn(r,j);
      r.revision++;
      r.updatedAt=now();
      return r;
    });
  }
  function acquire(id,executor,ttl=60000){
    return transaction(j=>{
      const r=j.runs[id];
      if(!r||terminal(r)||r.state==='needs-you')return null;
      if(r.blockedBy&&!terminal(j.runs[r.blockedBy]||{state:'failed'}))return null;
      if(r.kind!=='ask'&&
        r.entry!=='manual'&&
        !r.handled&&
        (r.dailyBase||0)+Object.values(j.runs).filter(x=>x.id!==id&&x.kind!=='ask'&&x.scope===r.scope&&x.day===r.day&&x.handled).length>=r.settings.dailyCap){
        r.state='unchanged';
        r.progress='Daily Prepare cap reached';
        return null;
      }
      if(r.lease.expiresAt>now()&&r.lease.executor!==executor)return null;
      delete r.blockedBy;
      r.lease={epoch:r.lease.epoch+1,executor,expiresAt:now()+ttl};
      return r;
    });
  }
  const release=(id,epoch)=>mutate(id,epoch,r=>{r.lease.expiresAt=0;});
  const cancel=id=>mutate(id,null,(r,j)=>{
    if(terminal(r))return;
    r.cancelRequestedAt=now();
    r.state='cancelled';
    r.progress='Stopped';
    r.lease={epoch:r.lease.epoch+1,expiresAt:0};
    delete r.nextRunId;
    for(const [k,v]of Object.entries(j.providers))if(v.runId===id)delete j.providers[k];
  });
  const claimProvider=(id,epoch,tabId)=>mutate(id,epoch,(r,j)=>{
    const key=String(tabId),prior=j.providers[key];
    if(prior&&prior.runId!==id&&!terminal(j.runs[prior.runId]||{state:'failed'}))throw Error('This chat is in use by another run.');
    j.providers[key]={runId:id,epoch};
  });
  return {start,get,all,mutate,acquire,release,cancel,claimProvider,transaction,terminal,async close(){(await open()).close();}};
 }
 return {create,terminal};
});
