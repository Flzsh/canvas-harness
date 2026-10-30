/* Background authority for accepted Prepare runs. Alarms only resume persisted work. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAIEngine=api;
})(globalThis,function(root){
 'use strict';
 const load=(n,p)=>root[n]||(typeof require==='function'?require(p):null),
   Store=load('CanvasHarnessRunStore','./ai-run-store.js'),
   clone=v=>structuredClone(v),
   settingsKey=s=>JSON.stringify(Object.keys(s||{}).sort().map(k=>[k,s[k]]));
 function create({
   store=Store.create(),
   authorize,
   checkLocal=async()=>{},
   runnerFor,
   alarm,
   notify=async()=>{},
   now=()=>Date.now(),
   uuid=()=>root.crypto.randomUUID(),
   schedule=(fn,delay)=>setTimeout(fn,delay),
   executor='worker-'+uuid(),
   onError=()=>{}
 }={}){
  const active=new Map(),controllers=new Map(),listeners=new Set();let disposed=false;
  const broadcast=async run=>{
    for(const listener of listeners)try{Promise.resolve(listener(clone(run))).catch(onError);}catch{}
    try{await notify(run);}catch(error){onError(error);}
  };
  async function guard(id,epoch){
    const r=await store.get(id);
    if(disposed||!r||r.lease.epoch!==epoch||Store.terminal(r)||r.cancelRequestedAt)throw Error('Run epoch stopped.');
    await checkLocal(r);
    const latest=await store.get(id);
    if(latest.lease.epoch!==epoch||Store.terminal(latest)||disposed)throw Error('Run epoch stopped.');
    return latest;
  }
  async function execute(id){
   if(disposed||active.has(id))return active.get(id);
   const task=(async()=>{
     let run=await store.acquire(id,executor);
     if(!run){const after=await store.get(id);if(after&&Store.terminal(after))await broadcast(after);return;}
     const epoch=run.lease.epoch,controller=new AbortController();
     controllers.set(id,controller);
     let waiting=false;
    // A whole-Canvas scan can outlast the 60 s lease; keep it alive while this executor is working.
    let beating=true;
    const beat=()=>{
      if(!beating||disposed)return;
      void store.mutate(id,epoch,r=>{r.lease={...r.lease,expiresAt:now()+60000};}).then(()=>{if(beating)schedule(beat,20000);},()=>{beating=false;});
    };
    schedule(beat,20000);
    const check=()=>guard(id,epoch),save=async value=>{
      await check();
      const next=await store.mutate(id,epoch,r=>{const lease=r.lease;Object.assign(r,clone(value));r.lease={...lease,expiresAt:now()+60000};});
      value.revision=next.revision;
      value.updatedAt=next.updatedAt;
      value.lease=next.lease;
      await broadcast(next);
      return next;
    };
    try{
     await check();const runner=await runnerFor(run,{guard:check,signal:controller.signal});
     while(!disposed&&!Store.terminal(run)&&run.state!=='needs-you'){
      await authorize(run);
      await check();
      const result=await runner.step(run,{save,guard:check,signal:controller.signal,claimProvider:tab=>store.claimProvider(id,epoch,tab)});
      if(result?.waiting){waiting=true;break;}
      run=await store.get(id);
     }
    }catch(error){
     const current=await store.get(id);
     if(current?.lease.epoch===epoch&&!Store.terminal(current)&&!disposed){
       if(error.code==='canvas-page-unavailable'){waiting=true;run=await store.mutate(id,epoch,r=>{r.progress='Waiting for Canvas';});}
       else if(/settings changed|account changed|quiz|privacy changed/i.test(String(error.message||error))){run=await store.cancel(id);}
       else run=await store.mutate(id,epoch,(r,j)=>{
         r.errors.push(String(error.message||error).slice(0,300));
         r.progress=String(error.message||error).slice(0,160);
         if(!r.handled){r.state='failed';delete j.claims[r.scope+'|'+r.triggerKey];}
         else{r.needsYou={reason:r.progress,action:/Canvas instructions changed/i.test(r.progress)?'Refresh Canvas':'Read reply',resumeState:r.state};r.state='needs-you';}
       });
       await broadcast(run);
     }
    }finally{
     beating=false;
     controller.abort();
     controllers.delete(id);
     const current=await store.get(id);
     if(current?.lease.epoch===epoch&&!Store.terminal(current))await store.release(id,epoch).catch(onError);
     if(waiting&&!disposed&&current?.lease.epoch===epoch&&!Store.terminal(current)&&current.state!=='needs-you'){
       const key=[current.state,current.turnIndex,current.turns[current.turnIndex]?.deliveryReceipt?.status].join(':'),
         delay=current.observationKey===key?current.observationDelay||1000:1000;
       await store.mutate(id,epoch,r=>{r.observationKey=key;// While the same step keeps waiting (a long reply), each look comes later, up to every 15 s: ChatGPT rate-limits frequent reads.
 r.observationDelay=delay===1000?2000:delay<5000?5000:Math.min(15000,delay+5000);});schedule(()=>{void execute(id).catch(onError);},delay);}
     if(current?.nextRunId&&Store.terminal(current)&&!disposed)schedule(()=>{void execute(current.nextRunId).catch(onError);},1000);
     await reconcileAlarms();
    }
   })();active.set(id,task);try{return await task;}finally{if(active.get(id)===task)active.delete(id);}
  }
  async function reconcileAlarms(){
    if(!alarm)return;
    const unfinished=(await store.all()).some(r=>!Store.terminal(r)&&r.state!=='needs-you');
    if(unfinished)await alarm.create('ch-ai-recovery',{delayInMinutes:1});else await alarm.clear('ch-ai-recovery');
  }
  async function start(input){
   if(!input||
     !/^run-[\w-]{1,90}$/.test(input.id)||
     !/^https:\/\/[a-z0-9.-]+\|\d+$/i.test(input.scope)||
     !root.ReserveSite?.supported?.(input.scope.split('|')[0])||
     typeof input.triggerKey!=='string'||
     input.triggerKey.length>300)
     throw Error('Invalid Prepare request.');
   const consent=await authorize(input);if(consent.settings?.way==='overnight')throw Error('Overnight keeps its existing path.');
   const settings=clone(consent.settings||input.settings);
   if(settings?.on!==true||typeof settings.wishes!=='string'||settings.wishes.length>600)throw Error('Review Prepare settings.');
   if(input.kind!=='ask'&&input.entry!=='manual'&&settings.everyDay!==true)return {skipped:'not-chosen'};
   const wishes=consent.perKindWishes||{};
   if(Object.values(wishes).some(v=>typeof v!=='string'||v.length>600))throw Error('Review your study instructions.');
   const notes=(Array.isArray(consent.notes)?consent.notes:[]).filter(n=>n&&typeof n.text==='string'&&n.text.length<=400&&['card','kind','all'].includes(n.scope)).slice(-40).map(n=>
     ({scope:n.scope,kind:String(n.kind||''),itemId:String(n.itemId||''),text:n.text}));
   const ask=input.kind==='ask';
   if(ask){
     const id=v=>v===undefined||v===''||typeof v==='string'&&/^[\w:.-]{1,60}$/.test(v);
     if(typeof input.question!=='string'||
       !input.question.trim()||
       input.question.length>2000||
       !id(input.itemId)||
       !id(input.courseId)||
       input.card!==undefined&&(typeof input.card!=='string'||input.card.length>6000)||
       input.itemText!==undefined&&(typeof input.itemText!=='string'||input.itemText.length>6000)||
       input.itemTitle!==undefined&&(typeof input.itemTitle!=='string'||input.itemTitle.length>300)||
       input.pasted!==undefined&&(typeof input.pasted!=='string'||input.pasted.length>30000)||
       input.items!==undefined&&
         (!Array.isArray(input.items)||
           input.items.length>3||
           input.items.some(it=>!it||!it.itemId||!id(it.itemId)||!id(it.courseId)||it.itemTitle!==undefined&&(typeof it.itemTitle!=='string'||it.itemTitle.length>300))))
       throw Error('Invalid question.');
   }
   // A question reuses today's Canvas brief when Prepare already built one, so it starts without a new scan.
   const cached=ask?
     (await store.all()).filter(r=>r.scope===input.scope&&r.day===input.day&&r.snapshot?.brief?.text).sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.snapshot.brief:
     null;
   const prepared={
     ...input,
     ...(cached?{cachedBrief:clone(cached)}:{}),
     sourcePolicy:consent.sourcePolicy||input.sourcePolicy,
     kind:ask?'ask':'prepare',
     entry:input.entry||'visit',
     way:settings.way,
     provider:settings.provider||'chatgpt',
     settings,
     instructions:{standingText:settings.wishes,perKindWishes:clone(wishes),notes},
     consent:{key:'reserve:v1:'+input.scope.replace('|',':'),settingsKey:settingsKey(settings)},
     connectionRevision:consent.connectionRevision,
     accountDailyCount:consent.daily?.day===input.day?consent.daily.count||0:0,
     publishedRunIds:consent.publishedRunIds||[]
   };
   const accepted=await store.start(prepared);
   // Older runs waiting on the student are retired only when this one was accepted (a capped visit replaces nothing).
   if(!accepted.skipped)
     for(const r of await store.all())
       if(r.id!==accepted.id&&
         r.scope===input.scope&&
         (r.kind==='ask')===ask&&
         (r.state==='needs-you'&&(r.day!==input.day||r.triggerKey!==input.triggerKey)||r.state==='expired'&&r.expiryNeedsCard)){
    const expired=r.state==='expired'?r:await store.mutate(r.id,null,v=>{
      v.state='expired';
      v.progress=ask?'Replaced by a newer question':'Replaced by a newer Prepare';
      v.expiryNeedsCard=true;
      v.lease={epoch:v.lease.epoch+1,expiresAt:0};
    });
    controllers.get(r.id)?.abort();
    const archive=await runnerFor(expired,{guard:async()=>{if(disposed)throw Error('Stopped');await checkLocal(prepared);},signal:new AbortController().signal});
    await archive.archive?.(expired);
    await store.mutate(r.id,null,v=>{delete v.expiryNeedsCard;});
    await broadcast(expired);
   }
   // Acceptance is returned only after the IDB transaction's oncomplete.
   // Two visits can accept the same waiting run; only the one that still finds it waiting resumes it.
   if(!accepted.skipped){
     await reconcileAlarms();
     if(accepted.state==='needs-you'&&!accepted.turns[accepted.turnIndex]?.reply){
       await authorize(accepted);
       await store.mutate(accepted.id,null,r=>{if(r.state==='needs-you'&&r.needsYou){r.state=r.needsYou.resumeState;r.needsYou=null;}});
     }
     void execute(accepted.id).catch(onError);
   }
   return accepted;
  }
  async function cancel(id){
    const target=await store.get(id);
    if(!target)throw Error('Run not found.');
    let run=target;
    for(const pending of await store.all())
      if(pending.scope===target.scope&&!Store.terminal(pending)){
        const stopped=await store.cancel(pending.id);
        controllers.get(pending.id)?.abort();
        await broadcast(stopped);
        if(pending.id===id)run=stopped;
      }
    await reconcileAlarms();
    return run;
  }
  async function recover({workerStart=false}={}){for(const r of await store.all())if(!Store.terminal(r)&&r.state!=='needs-you'){
   if(workerStart&&!active.has(r.id))await store.mutate(r.id,null,current=>{current.lease={epoch:current.lease.epoch+1,expiresAt:0};});
   void execute(r.id).catch(onError);
  }await reconcileAlarms();}
  async function importReply(id,turnId,text){
    const r=await store.get(id);
    await authorize(r);
    if(r.state!=='needs-you'||r.turns[r.turnIndex]?.id!==turnId||typeof text!=='string'||!text.trim()||text.length>140000)throw Error('Choose the current blocked turn and its reply.');
    const kind=r.turns[r.turnIndex].expectedKind,
      parsed=kind==='prepare'?
        load('CanvasHarnessStudy','./study-prompts.js').parsePrepare(text):
        kind==='agent'?load('CanvasHarnessAgent','./agent-prompts.js').parse(text):load('CanvasHarnessStudy','./study-prompts.js').parse(text,r.turns[r.turnIndex].expectedKind);
    if(!parsed.ok)throw Error(parsed.errors.join(' '));
    const run=await store.mutate(id,null,current=>{
      if(current.state!=='needs-you'||current.turns[current.turnIndex]?.id!==turnId)throw Error('This blocked turn changed or stopped.');
      current.turns[current.turnIndex].reply=text;
      current.state='awaiting-reply';
      current.needsYou=null;
      current.lease={epoch:current.lease.epoch+1,expiresAt:0};
    });
    void execute(id).catch(onError);
    return run;
  }
  // The student's "Try again" after the AI stopped before answering: the same message goes out in a fresh chat.
  async function retry(id){
    const r=await store.get(id);
    await authorize(r);
    if(r.state!=='needs-you'||r.needsYou?.action!=='Try again')throw Error('There is nothing to try again.');
    const run=await store.mutate(id,null,current=>{
      if(current.state!=='needs-you')throw Error('This run changed.');
      const last=current.turns[current.turnIndex];
      current.retries=(current.retries||0)+1;
      current.turns.push({id:'turn-'+uuid(),requestHash:last.requestHash,text:last.text,messages:last.messages,expectedKind:last.expectedKind,fresh:true});
      current.turnIndex=current.turns.length-1;
      current.state='awaiting-reply';
      current.needsYou=null;
      current.progress='Asking again';
      current.lease={epoch:current.lease.epoch+1,expiresAt:0};
    });
    void execute(id).catch(onError);
    return run;
  }
  return {start,get:store.get,verifyEpoch:guard,subscribe(fn){
    listeners.add(fn);
    return()=>listeners.delete(fn);
  },cancel,importReply,retry,recover,reconcileAlarms,execute,store,async dispose(){
    disposed=true;
    for(const c of controllers.values())c.abort();
    listeners.clear();
    await Promise.allSettled([...active.values()]);
  }};
 }
 return {create,settingsKey};
});
