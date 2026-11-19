/* The agent loop owns no Canvas writes and keeps every turn in one transport conversation. */
(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAgentRuntime=api;
})(globalThis,function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null),
   Agent=load('CanvasHarnessAgent','./agent-prompts.js'),
   Study=load('CanvasHarnessStudy','./study-prompts.js'),
   Actions=load('CanvasHarnessAgentActions','./agent-actions.js'),
   running=new Map(),
   clone=v=>structuredClone(v),
   settingsKey=s=>JSON.stringify(Object.keys(s||{}).sort().map(k=>[k,s[k]])),
   accessKey=row=>JSON.stringify([row?.locked===true,row?.gradeAccess===true,Array.isArray(row?.teacherIds)?row.teacherIds.map(String).sort():[]]);
 // one round of reads shares 60,000 characters: a single long read keeps its full text, several split it fairly and keep
 // each one's start and end
 function fitReads(results){
   const ROUND=60000,total=results.reduce((n,r)=>n+(typeof r?.text==='string'?r.text.length:0),0);
   if(total<=ROUND)return results;
   const long=results.filter(r=>typeof r?.text==='string'),
     short=long.filter(r=>r.text.length<=ROUND/long.length),
     room=ROUND-short.reduce((n,r)=>n+r.text.length,0),
     share=Math.floor(room/Math.max(1,long.length-short.length));
   return results.map(r=>
     typeof r?.text!=='string'||r.text.length<=share||short.includes(r)?r:{...r,text:r.text.slice(0,Math.floor(share*0.7))+' … '+r.text.slice(-Math.floor(share*0.28))});
 }
 function boundedHistory(messages){
   const out=clone(messages),size=()=>out.reduce((n,m)=>n+m.content.length,0);
   if(size()<=140000)return out;
   for(let i=1;i<out.length-1&&size()>140000;i++)if(out[i].role==='assistant')out[i].content='Earlier assistant reply omitted after CH recorded its result.';
   for(let i=1;i<out.length-1&&size()>140000;i++)
     if(out[i].role==='user'&&out[i].content.length>2000)
       out[i].content='Earlier source excerpt (remaining text omitted):\n<<<READ>>>\n'+out[i].content.slice(0,1800).replaceAll('<<<','[source marker ').replaceAll('>>>',' ]')+'\n<<<END READ>>>';
   for(let i=1;i<out.length-1&&size()>140000;i++)if(out[i].role==='user')out[i].content='Earlier read results omitted for the transport message limit.';
   if(size()>140000)throw Error('This run exceeds the transport message limit.');
   return out;
 }
  function planError(value){
   const text=String(value?.message||value||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
   if(/quiz|assessment/i.test(text))return 'Return to Canvas outside the quiz, then try Improve with AI again.';
   if(/account|Canvas page changed|verified Canvas|session closed/i.test(text))return 'Reload Canvas with the original account, then try Improve with AI again.';
   if(/timed?\s*out|timeout/i.test(text))return 'Your AI timed out; try Improve with AI again.';
   if(/No answer tab|tab.*(?:closed|missing|removed)|sign.?in|signing in|no.editor|chat is not ready/i.test(text))return 'Open your chosen AI website and sign in, then try Improve with AI again.';
   if(/running|already.*run/i.test(text))return 'Finish or stop the current AI run, then try Improve with AI again.';
   if(/settings changed/i.test(text))return 'AI settings changed; try Improve with AI again.';
   if(/stopped|abort|cancel/i.test(text))return 'AI improvement stopped; try Improve with AI again.';
   if(/refus|cannot|can.t|unable|sorry/i.test(text)||!text)return 'Your AI did not return a plan; try Improve with AI again.';
   if(/transport message limit/i.test(text))return 'This plan is too large; shorten the planning window and try Improve with AI again.';
   if(!/^(?:Allow|Choose|Connect|Enable|Finish|Open|Plan|Reload|Return|Turn)\b|[;,:]\s*(?:try|choose|open|reload)\b|\btry Improve with AI/i.test(text))return 'AI improvement failed; check AI settings and try Improve with AI again.';
   const sentence=text.split(/(?<=[.!?])\s+/)[0].slice(0,240);return /[.!?]$/.test(sentence)?sentence:sentence+'.';
  }
  function create({
    store,
    scope,
    buildSnapshot,
    buildPlanSnapshot,
    createReader,
    createExecutor,
    transport,
    acquire=async()=>({}),
    release=async()=>{},
    now=()=>Date.now(),
    uuid=()=>root.crypto.randomUUID(),
    url=()=>root.location?.href||'',
    guard=()=>true,
    onStatus=()=>{},
    timeoutMs=30*60*1000+60000
  }={}){
  let owned=null;
  const blocked=()=>Actions.quiz(url())||!guard(),get=()=>Actions.state(store.get()),today=()=>Actions.day(now(),store.get().settings?.timeZone),clockNow=()=>{
    try{return new Date(now()).toLocaleString('en-US',{weekday:'long',hour:'numeric',minute:'2-digit',timeZone:store.get().settings?.timeZone||undefined});}catch{return '';}
  };
  const synchronize=()=>store.sync?store.sync():store.load?store.load():Promise.resolve();
  async function status(text){if(owned?.controller.signal.aborted)return;await store.update(data=>{Actions.state(data).status=text;});onStatus(text);}
  function check(task,data=store.get()){
    task.verify?.(data);
    if(!Actions.state(data).settings.on||settingsKey(Actions.state(data).settings)!==task.settingsKey){task.controller.abort();throw Error('Agent settings changed. Start a new run.');}
    if(task.controller.signal.aborted)throw Error('Request stopped.');
    if(running.get(scope)!==task||blocked())throw Error('The Canvas account or page changed.');
  }
  async function fresh(task){await synchronize();check(task);}
  async function exchange(task,context,kind){
    await fresh(task);
    const signal=task.controller.signal;
    let timer,abort;
    try{
      return await Promise.race([Promise.resolve().then(()=>{
        check(task);
        return transport({
          runId:context.runId,
          text:context.messages.at(-1).content,
          messages:boundedHistory(context.messages),
          kind,
          turn:context.turn,
          continue:context.turn>0,
          automatic:task.automatic,
          settings:clone(context.settings),
          signal
        });
      }),new Promise((_,reject)=>{
        abort=()=>reject(Error('Request stopped.'));
        signal.addEventListener('abort',abort,{once:true});
        timer=setTimeout(()=>{task.controller.abort();reject(Error('Your AI timed out.'));},timeoutMs);
        if(signal.aborted)abort();
      })]);
    }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
  async function run({automatic=false,question='',changeKey='',resume=false}={}){
   if(blocked())return {skipped:Actions.quiz(url())?'quiz':'account'};
   if(running.has(scope))return {skipped:'running'};
   await synchronize();
   if(blocked())return {skipped:Actions.quiz(url())?'quiz':'account'};
   if(running.has(scope))return {skipped:'running'};
   const settings=clone(get().settings),pending=get().pending;
   let saved=pending;
   try{
     if(typeof pending?.payload==='string')saved=JSON.parse(pending.payload);
   }catch{await store.update(data=>{delete Actions.state(data).pending;Actions.state(data).status='The pending run could not be restored.';});return {skipped:'invalid-pending'};}
   if(!settings.on)return {skipped:'off'};if(automatic&&!resume&&settings.everyDay!==true)return {skipped:'not-chosen'};
   if(saved&&!resume)return {skipped:'pending'};
   if(resume&&!saved)return {skipped:'no-pending'};
   if(saved&&(!saved.settings||settingsKey(saved.settings)!==settingsKey(settings))){
     await store.update(data=>{const s=Actions.state(data),run=s.runs.find(r=>r.id===saved.runId);delete s.pending;s.status='Agent settings changed. Start a new run.';if(run)run.status='stopped';});
     return {skipped:'settings-changed'};
   }
   const day=today(),daily=get().daily||{};
   if(!resume&&automatic&&(daily.day===day&&daily.count>=settings.dailyCap||changeKey&&(get().seenChanges||[]).includes(changeKey)))return {skipped:'cap-or-change'};
   const task={controller:new AbortController(),settingsKey:settingsKey(settings),automatic:saved?.automatic===true||!saved&&automatic},runId=saved?.runId||'run-'+uuid();
   running.set(scope,task);
   owned=task;
   let started=false,locked=false,context;
   const unsubscribe=store.subscribe?.(data=>{if(settingsKey(Actions.state(data||store.get()).settings)!==task.settingsKey)task.controller.abort();});
   try{
    await fresh(task);
    const claim=await acquire({runId,automatic:task.automatic,resume,settings:clone(settings)});
    if(claim?.skipped)return claim;
    locked=true;
    await fresh(task);
    const built=await buildSnapshot(String(question).slice(0,4000));await fresh(task);
    if(saved){
      if((saved.index||[]).some(([id,row])=>!built.index.has(id)||accessKey(row)!==accessKey(built.index.get(id)))){
        await store.update(data=>{const s=Actions.state(data),run=s.runs.find(r=>r.id===runId);delete s.pending;s.status='Canvas access changed. Start a new run.';if(run)run.status='stopped';});
        return {skipped:'access-changed'};
      }
      context={...clone(saved),built:{...built,text:saved.snapshot,index:new Map((saved.index||[]).map(([id])=>[id,built.index.get(id)]))}};
    }
    else{
     context={
       runId,
       settings:clone(settings),
       automatic:task.automatic,
       round:0,
       turn:0,
       phase:'agent',
       aidAt:0,
       aids:[],
       messages:[
         {
           role:'user',
           content:Agent.build({
             snapshot:built.text,
             wishes:settings.wishes,
             level:store.get().toolbox?.aiLevel,
             today:day,
             now:clockNow(),
             timeZone:store.get().settings?.timeZone||'America/New_York'
           })
         }
       ],
       snapshot:built.text,
       built
     };
     await store.update(data=>{
       check(task,data);
       const state=Actions.state(data),daily=state.daily||{};
       if(automatic){
         if(daily.day===day&&daily.count>=settings.dailyCap)throw Error('Daily automatic run cap reached.');
         if(changeKey&&(state.seenChanges||[]).includes(changeKey))throw Error('This change was already handled.');
         state.daily={day,count:(daily.day===day?daily.count||0:0)+1};
         if(changeKey)state.seenChanges=[...(state.seenChanges||[]),changeKey].slice(-100);
         state.lastVisitDay=day;
       }
      state.memory=Actions.expire(state.memory,day);
      state.runs=(state.runs||[]).filter(r=>r.at>=now()-14*86400000);
      state.runs.unshift({id:runId,at:now(),automatic,grades:settings.grades===true,status:'running',snapshot:built.text,actions:[],errors:[],answers:[]});
      state.baseline=built.baseline;
     });
    }
    started=true;
    const reader=createReader(context.built,task.controller.signal);
    if(saved?.cache)for(const [key,value]of saved.cache)reader.cache.set(key,value);
    const executor=createExecutor(context.built,reader,data=>{try{check(task,data);return true;}catch{return false;}});
    await status('Your AI is looking at your week');
    for(;;){check(task);const kind=context.phase==='aid'?context.aids[context.aidAt].action.kind:'agent',answer=await exchange(task,context,kind);await fresh(task);
     if(answer?.pending){
       const {built,...pending}=context;
       pending.index=Array.from(
         built.index,
         ([id,row])=>
           [
             id,
             {
               id:row.id,
               what:row.what,
               courseId:row.courseId,
               canvasId:row.canvasId,
               title:row.title,
               url:row.url,
               teacherIds:Array.isArray(row.teacherIds)?row.teacherIds.map(String):[],
               gradeAccess:row.gradeAccess===true,
               ...(row.slug?{slug:row.slug}:{}),
               ...(row.locked?{locked:true}:{}),
               ...(row.item?
                 {
                   item:{
                     id:row.item.id,
                     courseId:row.item.courseId,
                     name:row.item.name,
                     courseName:row.item.courseName,
                     dueAt:row.item.dueAt,
                     ...(id.startsWith('local:')?{description:String(row.item.description||'').slice(0,12000)}:{})
                   }
                 }:
                 {})
             }
           ]);
       pending.cache=Array.from(reader.cache);
       await store.update(data=>{
         check(task);
         Actions.state(data).pending={runId,payload:JSON.stringify(pending),...(answer.needsAllow?{needsAllow:true}:{})};
         const run=Actions.state(data).runs.find(r=>r.id===runId);
         if(run)run.status='waiting';
       });
       await status(answer.needsAllow?'Allow the prep folder':'Waiting for your AI');
       return {pending:true,runId,...(answer.needsAllow?{needsAllow:true}:{})};
     }
     if(answer?.status!=='answer'||typeof answer.text!=='string')throw Error(answer?.message||answer?.error||'Your AI did not return an answer.');task.consumed=true;
     context.messages.push({role:'assistant',content:answer.text});context.turn++;
     if(context.phase==='agent'){
      const parsed=Agent.parse(answer.text);
      await store.update(data=>{const run=Actions.state(data).runs.find(r=>r.id===runId);if(run)run.errors.push(...(parsed.errors||[]));});
      if(!parsed.ok)throw Error('Your AI returned an invalid chagent block.');
      if(parsed.kind==='read'){
        if(context.round>=Agent.LIMITS.rounds)throw Error('The agent exceeded its read round limit.');
        const results=[];
        for(const request of parsed.reads){
          check(task);
          await status('Reading '+(context.built.index.get(String(request.id))?.title||request.what)+(request.pages?' pp. '+request.pages:''));
          const result=await reader.read(request);
          if(result.fatal||/^(?:auth|account)$/.test(result.code||''))throw Object.assign(Error(result.error),{code:result.code});
          results.push(result);
          if(!result.error){
            context.sourceTexts||={};
            const before=context.sourceTexts[result.id]||'';
            context.sourceTexts[result.id]=before&&!before.includes(result.text)?(before+'\n\n'+result.text).slice(0,36000):before||result.text;
          }
          check(task);
        }
        context.round++;
        context.messages.push({role:'user',content:Agent.followUp({results:fitReads(results),round:context.round})});
        continue;
      }
      await fresh(task);/* Read aid dependencies before any local publication. */
      for(const action of parsed.actions.filter(a=>a.tool==='make_aid'))
        for(const id of action.sources?.length?action.sources:[action.itemId]){
          if(context.sourceTexts?.[id])continue;
          const row=context.built.index.get(String(id)),result=await reader.read({what:row?.what||'assignment',id});
          check(task);
          if(result.fatal||/^(?:auth|account)$/.test(result.code||''))throw Object.assign(Error(result.error),{code:result.code});
          if(!result.error){context.sourceTexts||={};context.sourceTexts[id]=result.text;}
        }
      const applied=await executor.apply(parsed.actions,runId);
      context.aids=applied.aids||[];
      context.phase='aid';
      context.aidAt=0;
     }else{const aid=context.aids[context.aidAt];await fresh(task);await executor.saveAid(aid.action,runId,aid.entryId,answer.text);check(task);context.aidAt++;}
     if(context.aidAt>=context.aids.length)break;
     while(context.aidAt<context.aids.length){
       const aid=context.aids[context.aidAt],action=aid.action,item=context.built.index.get(String(action.itemId)),sources=[];
       let error='';
       for(const id of action.sources?.length?action.sources:[action.itemId]){
         check(task);
         const row=context.built.index.get(String(id)),what=row?.what==='file'?'pdf':row?.what;
         const result=context.sourceTexts?.[id]?{text:context.sourceTexts[id]}:await reader.read({what:what||'assignment',id});
         check(task);
         if(result.fatal||/^(?:auth|account)$/.test(result.code||''))throw Object.assign(Error(result.error),{code:result.code});
         if(result.error){error='Aid source '+id+': '+result.error;break;}
         context.sourceTexts||={};
         context.sourceTexts[id]=result.text;
         sources.push({id,label:row?.title||String(id),text:result.text});
       }
      if(error){
        await store.update(data=>{
          check(task);
          const run=Actions.state(data).runs.find(r=>r.id===runId),entry=run?.actions.find(a=>a.id===aid.entryId);
          if(entry){entry.outcome='rejected';entry.error=error.slice(0,300);}else run?.errors.push(error.slice(0,300));
        });
        context.aidAt++;
        continue;
      }
      await status('Making '+action.kind);
      context.messages.push({
        role:'user',
        content:Study.build(action.kind,{
          now:now(),
          timeZone:store.get().settings?.timeZone||'America/New_York',
          level:store.get().toolbox?.aiLevel,
          course:item?.item?.courseName||item?.courseName||'',
          item:item?.item?.name||item?.title||'',
          due:item?.item?.dueAt||'',
          sources,
          privacy:item?.privacy,
          showGrades:settings.grades===true,
          wishes:Agent.aidRequest(action).wishes
        })
      });
      break;
     }
     if(context.aidAt>=context.aids.length)break;
    }
    check(task);
    await store.update(data=>{
      const state=Actions.state(data);
      delete state.pending;
      const run=state.runs.find(r=>r.id===runId);
      if(run){run.status='done';run.finishedAt=now();}
    });
    const count=get().runs.find(r=>r.id===runId)?.actions.filter(a=>a.outcome==='kept').length||0;
    await status('Done: '+count+' changes');
    return {ok:true,runId};
   }catch(error){
     const message=String(error?.message||error).slice(0,300);
     if(started)
       await store.update(data=>{
         const state=Actions.state(data),preserve=task.preservePending&&saved&&!task.consumed;
         if(!preserve)delete state.pending;
         const run=state.runs.find(r=>r.id===runId);
         if(run){
           run.status=preserve?'waiting':task.controller.signal.aborted?'stopped':'error';
           if(!preserve)run.errors.push(message);
           for(const entry of run.actions)if(!preserve&&entry.outcome==='pending'){entry.outcome='rejected';entry.error=message;}
         }
         state.status=preserve?'Waiting for your AI':run?.status==='stopped'?'Stopped':message;
       });
     return {ok:false,error:message,runId};
   }
   finally{unsubscribe?.();if(locked)await release({runId}).catch(()=>{});if(running.get(scope)===task)running.delete(scope);if(owned===task)owned=null;}
  }
  async function improvePlan({localPlan,timeoutMs=60000,signal,verify}={}){
   const fail=error=>({ok:false,error:planError(error)});
   if(blocked())return fail(Actions.quiz(url())?'quiz':'Canvas account changed');
   if(running.has(scope))return fail('AI run is running');
   const settings=clone(get().settings||{});if(settings.on!==true)return fail('Turn on Your AI in AI settings, then try Improve with AI again.');
   if(get().pending)return fail('Finish or stop the pending AI run, then try Improve with AI again.');
   if(!localPlan||!Array.isArray(localPlan.blocks)||!localPlan.blocks.some(b=>b&&b.kind!=='break'&&b.itemId!=null))return fail('Plan a work block first, then try Improve with AI.');
   if(typeof buildPlanSnapshot!=='function')return fail('Reload Canvas to load the planner, then try Improve with AI again.');
   const task={controller:new AbortController(),settingsKey:settingsKey(settings),automatic:false,verify},runId='plan-'+uuid();
   let timer,abort,unsubscribe,attempted=false,reason='AI improvement stopped; try Improve with AI again.';
   running.set(scope,task);owned=task;
   const deadline=new Promise((_,reject)=>{
     abort=()=>reject(Error(reason));
     task.controller.signal.addEventListener('abort',abort,{once:true});
     timer=setTimeout(()=>{reason='Your AI timed out; try Improve with AI again.';task.controller.abort();},Number.isFinite(timeoutMs)?Math.max(1,Math.min(timeoutMs,120000)):60000);
   });
   const within=promise=>Promise.race([promise,deadline]),cancel=()=>task.controller.abort();
   try{
    if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
    unsubscribe=store.subscribe?.(data=>{
      if(settingsKey(Actions.state(data||store.get()).settings)!==task.settingsKey){reason='AI settings changed; try Improve with AI again.';cancel();return;}
      try{verify?.(data||store.get());}catch(error){reason=String(error?.message||error);cancel();}
    });
    await within(fresh(task));if(get().pending)throw Error('Finish or stop the pending AI run, then try Improve with AI again.');
    const built=await within(Promise.resolve().then(()=>buildPlanSnapshot(localPlan)));await within(fresh(task));
    const text=Agent.planImprovement({localPlan,snapshot:built.text,wishes:settings.wishes}),messages=boundedHistory([{role:'user',content:text}]);
    const claimPromise=Promise.resolve().then(()=>{
      check(task);
      attempted=true;
      return acquire({runId,automatic:false,resume:false,settings:clone(settings),beforeSend:()=>check(task)});
    });
    void claimPromise.then(claim=>{if(task.controller.signal.aborted&&!claim?.skipped)void Promise.resolve().then(()=>release({runId})).catch(()=>{});},()=>{});
    const claim=await within(claimPromise);if(claim?.skipped)throw Error('AI run is running');await within(fresh(task));
    const answer=await within(Promise.resolve().then(()=>{
      check(task);
      return transport({
        runId,
        text,
        messages,
        kind:'agent',
        turn:0,
        continue:false,
        automatic:false,
        settings:clone(settings),
        signal:task.controller.signal,
        beforeSend:()=>check(task)
      });
    }));
    await within(fresh(task));
    if(answer?.pending)throw Error(answer.needsAllow?'Allow the prep folder in AI settings, then try Improve with AI again.':'Your AI is waiting for a folder reply; choose a connected website or API in AI settings and try again.');
    if(answer?.status!=='answer'||typeof answer.text!=='string')
      throw Error(answer?.message||answer?.error||(answer?.status==='no-editor'?'The chat is not ready. Finish signing in.':'Your AI did not return a plan; try Improve with AI again.'));
    const parsed=Agent.parsePlan(answer.text);if(!parsed.ok)throw Error(parsed.error);return {ok:true,reply:parsed.reply};
   }catch(error){return fail(error);}
   finally{
     clearTimeout(timer);
     unsubscribe?.();
     signal?.removeEventListener('abort',cancel);
     task.controller.signal.removeEventListener('abort',abort);
     task.controller.abort();
     if(attempted)void Promise.resolve().then(()=>release({runId})).catch(()=>{});
     if(running.get(scope)===task)running.delete(scope);
     if(owned===task)owned=null;
   }
  }
  async function stop({preservePending=false}={}){
    if(owned){owned.preservePending=preservePending;owned.controller.abort();}
    if(!owned&&!preservePending&&get().pending)
      await store.update(data=>{
        const state=Actions.state(data),run=state.runs.find(r=>r.id===state.pending?.runId);
        if(run)run.status='stopped';
        delete state.pending;
        state.status='Stopped';
      });
    return true;
  }
  return {run,improvePlan,stop,isRunning:()=>running.has(scope)};
 }
  return {create,planError,fitReads,boundedHistory};
});
