/* Prepare triggers/subscribes through the worker. Manual entries and Overnight retain their phase-one path. */
(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAgentClient=api;
})(globalThis,function(root){
 'use strict';
 const load=(name,file)=>root[name]||(typeof module==='object'&&module.exports?require(file):null),
   Data=load('CanvasHarnessAgentData','./agent-data.js'),
   Actions=load('CanvasHarnessAgentActions','./agent-actions.js'),
   Runtime=load('CanvasHarnessAgentRuntime','./agent-runtime.js'),
   UI=load('CanvasHarnessStudyUI','./study-ui.js'),
   Arrange=load('ReserveWorkspaceArrange','./workspace-arrange.js'),
   clients=new Map(),
   clone=v=>structuredClone(v);
 const INFO={
   context:'Course information and teacher links',
   work:'Upcoming assignments',
   reader:'Assignment instructions',
   week:'Planner cards for the week',
   timer:'Focus timer',
   clock:'Time and next deadline',
   notes:'Your notes',
   bookmarks:'Saved assignments and materials',
   grades:'Current course grades',
   messages:'Announcements and teacher updates',
   pet:'Companion'
 };
 function modules(data,at=Date.now()){
   const s=data.settings||{},
     visible=Arrange.snapshot(s).order,
     pins=data.toolbox?.agentPins||[],
     today=Actions.day(at,s.timeZone),
     dynamic=(Array.isArray(data.toolbox?.agent?.modules)?data.toolbox.agent.modules:[]).filter(m=>
       m&&!m.removed&&(!m.gradeAccess||data.toolbox?.agent?.settings?.grades===true)&&typeof m.id==='string'&&Arrange.dynamic?.(m.id)&&(!m.until||m.until>=today));
   return [
     ...Arrange.ALL.map(id=>
       ({
         id,
         title:Arrange.LABELS[id],
         shows:id==='pet'?(root.ReservePetArt?.identity?.(data)?.name||INFO[id]):INFO[id],
         visible:visible.includes(id)&&(id!=='context'||s.showCourseInformation!==false)&&(id!=='grades'||s.showGrades===true),
         pinned:pins.includes(id)||['work','reader'].includes(id)
       })),
     ...dynamic.map(m=>({id:m.id,title:String(m.title||'Your AI'),shows:String(m.why||m.show||'Study module'),visible:visible.includes(m.id),pinned:pins.includes(m.id)}))
   ];
 }
 function fingerprint(value){let n=2166136261;for(const c of JSON.stringify(value))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16);}
 function create(options){
   let opts={...options},alive=true,visiting=null,publicState=null,engineAttempt=null,engineVisit=null,engineAgain=false;
   const {store}=opts,origin=store.owner?.origin||root.location?.origin,account=String(opts.user?.id||store.owner?.accountId||''),scope=origin+'|'+account;
   if(!UI.storageKey(scope))throw Error('A verified Canvas account is required.');
   const unsubscribe=store.subscribe?.(()=>{publicState=null;});
  const now=()=>opts.now?.()??Date.now(),
    url=()=>opts.url?.()??root.location?.href??'',
    guard=()=>
      alive&&
        !Actions.quiz(url())&&
        String(store.owner?.accountId||account)===account&&
        (!store.owner?.origin||store.owner.origin===origin)&&
        String(opts.user?.id||account)===account&&
        (!opts.guard||opts.guard()),
    external=opts.external||
      {
        get:async key=>(await root.chrome.storage.local.get(key))[key],
        set:async(key,value,options={})=>
          request('local',{key,value,expected:options.expected,hadExpected:options.expected!==undefined,remove:value===undefined,...(options.runId?{runId:options.runId}:{})})
      };
  const releaseCanvas=root.CanvasHarnessCanvasBridge?.serve({scope,guard,env:root});
  const raw=()=>Actions.state(store.get()),request=async(op,payload={})=>{
    if(!guard()&&op!=='stop'&&op!=='finish')throw Error('Your AI is unavailable on this Canvas page.');
    if(opts.demo)throw Error('Your AI needs a verified Canvas session.');
    const reply=await (opts.request||((message)=>root.chrome.runtime.sendMessage(message)))({target:'ch-agent',op,scopeKey:scope,...payload});
    if(!reply?.ok)throw Error(reply?.error||'Your AI could not connect.');
    return reply.result;
  };
  async function buildSnapshot(question=''){
    const data=store.get(),
      state=Actions.state(data),
      aids=await external.get(UI.storageKey(scope))||{},
      grades=state.settings?.grades===true,
      hidden=new Set(grades?[]:state.gradePlans||[]),
      runs=(state.runs||[]).map(r=>{
      if(grades||!r.grades)return r;
      for(const entry of r.actions||[])if(entry.action?.tool==='plan'&&entry.createdId)hidden.add(entry.createdId);
      return {id:r.id,at:r.at,status:r.status,actions:(r.actions||[]).map(e=>({id:e.id,action:{tool:e.action?.tool},outcome:e.outcome})),answers:[]};
    });
    if(!grades){
      if(state.gradeNotes)data.toolbox.scratchpad='';
      data.customTasks=(data.customTasks||[]).filter(i=>!hidden.has(String(i.id)));
      for(const [key,aid]of Object.entries(aids))if(aid?.gradeAccess)delete aids[key];
    }
    const context=opts.getContext()||{},
      agentCourseStaff=await Data.loadCourseStaff({client:opts.client,user:{id:account},courses:context.courses||[]}),
      conversations=typeof Data.loadInbox==='function'?
        await Data.loadInbox({client:opts.client,user:{id:account},courses:context.courses||[],staff:agentCourseStaff,now:now()}):
        [],
      calendarEvents=typeof Data.loadCalendarEvents==='function'?
        await Data.loadCalendarEvents({client:opts.client,user:{id:account},courses:context.courses||[],now:now()}).catch(error=>{
      if(/^(?:auth|account|aborted|cancelled)$/.test(String(error?.code||'')))throw error;
      return [];
    }):[],
    aiResources=typeof opts.client?.loadCourseResources==='function'?
      await Promise.all((context.courses||[]).map(c=>
        opts.client.loadCourseResources(c.id,{user:{id:account},assignments:context.agentAssignments||context.items||[]}).catch(error=>{
      if(/^(?:auth|account|aborted|cancelled)$/.test(String(error?.code||'')))throw error;
      return null;
    }))):context.aiResources||[],rawItems=new Map((context.agentAssignments||[]).map(i=>[String(i.course_id??i.courseId)+':'+i.id,i]));
    return Data.build({
      context:{
        ...context,
        sourceErrors:opts.client?.sourceErrors?.()||context.sourceErrors||[],
        aiResources:aiResources.filter(Boolean),
        agentCourseStaff,
        calendarEvents,
        conversations,
        items:(context.items||[]).filter(i=>!hidden.has(String(i.id))).map(i=>{
      const raw=rawItems.get(i.courseId+':'+i.id);
      return raw?
        {
          ...i,
          submission:{user_id:raw.submission?.user_id,submission_comments:data.toolbox?.aiTeacherFeedback===true?raw.submission?.submission_comments||[]:[]},
          attachments:raw.attachments||i.attachments
        }:
        i;
    }),user:{id:account}},
    data,
    aids,
    memory:Actions.expire(state.memory,Actions.day(now(),data.settings?.timeZone)).filter(m=>grades||!m.gradeAccess),
    runs,
    baseline:state.baseline||{},
    modules:modules(data,now()),
    now:now(),
    grades,
    question
    });
  }
  const parsePDF=async(bytes,options={})=>{
    const base64=root.CanvasHarnessAISource?.base64?.(bytes)||(()=>{
      let binary='';
      for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return root.btoa(binary);
    })();
    const reply=await root.chrome.runtime.sendMessage({type:'ch-ai-pdf',base64,pages:options.pages,scopeKey:scope,agent:true});
    if(!reply?.ok)throw Error(reply?.error||'PDF could not be read.');
    return reply.result;
  };
  const createReader=(built,signal)=>
    Data.createReader({
      index:built.index,
      client:opts.client,
      user:{id:account},
      origin,
      signal,
      parsePDF:opts.parsePDF||parsePDF,
      fetchImpl:opts.fetchImpl,
      onStatus:()=>{}
    }),
    createExecutor=(built,reader,runGuard=()=>true)=>
      Actions.create({
        store,
        scope,
        index:built.index,
        modules:built.snapshot?.home||modules(store.get(),now()),
        reader,
        external,
        now,
        url,
        aidKeys:(built.snapshot?.aids||[]).map(a=>a.key),
        getLiveContext:()=>opts.getContext(),
        guard:data=>guard()&&runGuard(data),
        ...(opts.uuid?{uuid:opts.uuid}:{})
      });
  const settingsKey=s=>JSON.stringify(Object.keys(s||{}).sort().map(k=>[k,s[k]])),
    synchronize=()=>store.sync?store.sync():store.load?store.load():Promise.resolve();
  const planKey=plan=>settingsKey(Object.fromEntries(Object.entries(plan||{}).filter(([key])=>key!=='records'))),
    planningKey=(data,context)=>
      JSON.stringify([
        data.settings?.timeZone,
        data.settings?.bedtime,
        data.settings?.showGrades,
        context.s?.showGrades,
        context.showGrades,
        settingsKey(Actions.state(data).settings)
      ]),
    scheduleKey=data=>JSON.stringify([data.toolbox?.biscuitPlan??null,data.tasks||{}]);
  async function persistedSettings(expected){
    await synchronize();
    const settings=raw().settings;
    if(!settings.on||expected&&settingsKey(expected)!==settingsKey(settings))throw Error('Agent settings changed. Start a new run.');
    return clone(settings);
  }
  function buildPlanSnapshot(plan){
    const data=clone(store.get()),
      state=Actions.state(data),
      context=opts.getContext()||{},
      grades=state.settings?.grades===true&&
        data.settings?.showGrades===true&&
        (context.s?.showGrades===undefined||context.s.showGrades===true)&&
        (context.showGrades===undefined||context.showGrades===true),
      hidden=new Set((grades?[]:state.gradePlans||[]).map(String));
    if(!guard()||context.user?.id!=null&&String(context.user.id)!==account)throw Error('The Canvas account changed.');
    if(!grades){
      state.settings={...state.settings,grades:false};
      for(const run of state.runs||[])if(run.grades)for(const entry of run.actions||[])if(entry.action?.tool==='plan'&&entry.createdId)hidden.add(String(entry.createdId));
      if(state.gradeNotes)data.toolbox.scratchpad='';
      data.customTasks=(data.customTasks||[]).filter(i=>!hidden.has(String(i.id)));
      if(plan.blocks.some(b=>hidden.has(String(b.itemId))||hidden.has(String(b.itemId).replace(/^local:/,''))))
        throw Error('Enable grade display and AI grade access, or make a new plan without grade-based items.');
    }
    return Data.build({
      context:{...context,items:(context.items||[]).filter(i=>!hidden.has(String(i.id))),user:{id:account}},
      data,
      aids:context.studyAids||{},
      memory:Actions.expire(state.memory,Actions.day(now(),data.settings?.timeZone)).filter(m=>grades||!m.gradeAccess),
      runs:[],
      baseline:state.baseline||{},
      modules:modules(data,now()),
      now:now(),
      grades
    });
  }
  const runtime=Runtime.create({store,scope,now,url,guard,buildSnapshot,buildPlanSnapshot,createReader,createExecutor,transport:async({beforeSend,...turn})=>{
    const abort=()=>{void request('stop',{runId:turn.runId}).catch(()=>{});};
    turn.signal.addEventListener('abort',abort,{once:true});
    try{
      const settings=await persistedSettings(turn.settings);
      if(turn.signal.aborted)throw Error('Request stopped.');
      beforeSend?.();
      return await request('turn',{...turn,signal:undefined,settings});
    }finally{turn.signal.removeEventListener('abort',abort);}
  },acquire:async({beforeSend,...args})=>{
    const settings=await persistedSettings(args.settings);
    beforeSend?.();
    return request('begin',{...args,settings});
  },release:args=>request('finish',args)});
  async function improvePlan(localPlan){
    try{
      if(!guard())throw Error(Actions.quiz(url())?'quiz':'The Canvas account changed.');
      const planner=opts.planner||root.ReserveBiscuitPlanner||(()=>{try{return typeof module==='object'&&module.exports?require('./biscuit-planner.js'):null;}catch{return null;}})();
      if(typeof planner?.validate!=='function')throw Error('Reload Canvas to load the planner, then try Improve with AI again.');
      const plan=clone(localPlan),
        before=store.get(),
        context=opts.getContext()||{},
        zone=before.settings?.timeZone,
        day=Actions.day(now(),zone),
        start=new Date(plan?.window?.start).getTime();
      if(!Number.isFinite(start)||Actions.day(start,zone)!==day)throw Error('Choose Plan today to make a fresh plan, then try Improve with AI again.');
      const saved=before.toolbox?.biscuitPlan,signature=scheduleKey(before),preferences=planningKey(before,context);
      if(saved&&planKey(saved)!==planKey(plan))throw Error('Your plan changed; choose Plan today and try Improve with AI again.');
      const verify=(data=store.get())=>{
        const context=opts.getContext()||{};
        if(!guard())throw Error(Actions.quiz(url())?'quiz':'The Canvas account changed.');
        if(context.user?.id!=null&&String(context.user.id)!==account)throw Error('The Canvas account changed.');
        if(planningKey(data,context)!==preferences)throw Error('AI planning settings changed; try Improve with AI again.');
        if(Actions.day(now(),data.settings?.timeZone)!==day||scheduleKey(data)!==signature)throw Error('Your plan changed; choose Plan today and try Improve with AI again.');
      };
      verify(before);
      const result=await runtime.improvePlan({localPlan:plan,timeoutMs:opts.planTimeoutMs??60000,verify});
      if(!result.ok)return result;
      verify();
      let checked;
      try{checked=planner.validate(clone(result.reply),plan);}catch{throw Error('Your AI returned an invalid plan; try Improve with AI again.');}
      if(checked?.ok===false)throw Error('Your AI returned an invalid plan; try Improve with AI again.');
      const improved=checked?.plan||(checked?.window&&Array.isArray(checked.blocks)?checked:null);
      if(!improved)throw Error('Your AI returned an invalid plan; try Improve with AI again.');
      return {ok:true,plan:improved};
    }catch(error){return {ok:false,error:Runtime.planError(error)};}
  }
  function state(){
    if(unsubscribe&&publicState)return publicState;
    const s=raw();
    const value={
      settings:clone(s.settings),
      status:s.prepareStatus?.progress||s.status||'',
      ...(s.prepareStatus?{prepare:clone(s.prepareStatus)}:{}),
      snapshot:s.runs?.[0]?.snapshot||'',
      runs:(s.runs||[]).map(({id,at,status,actions,errors,answers})=>
        ({id,at,status,actions:(actions||[]).map(({id,action,why,outcome,error})=>({id,action,why,outcome,error})),errors:errors||[],answers:answers||[]})),
      memory:Actions.expire(s.memory,Actions.day(now(),store.get().settings?.timeZone)),
      today:s.today||[],
      questions:s.questions||[]
    };
    if(unsubscribe)publicState=value;
    return value;
  }
  // Every visit takes the store update, as before perf3: skipping it when a copy showed no change also changed when
  // Prepare runs were started and shown (the Help band's track came back on every load). A no-op update is still silent.
  async function init(){
    if(!guard())return;
    await synchronize();
    const connections=raw().wayMigrated===true?{}:await request('connections');
    await store.update(data=>{
      const s=Actions.state(data);
      Actions.migrateSettings(data,{apiSettings:connections?.apiSettings||{},overnightSettings:connections?.overnightSettings||{}});
      s.memory=Actions.expire(s.memory,Actions.day(now(),data.settings?.timeZone));
      root.CanvasHarnessAgentHome?.expire(data,Actions.day(now(),data.settings?.timeZone));
      s.runs=(s.runs||[]).filter(r=>r.at>=now()-14*86400000);
      if(!s.initialized)s.initialized=true;
    });
  }
  async function run(question='',provider){await init();if(provider)await settings({provider});await runtime.run({question});return state();}
  // Visits made while a Prepare start is in flight join it; the newest of them gets one trailing start, so a source change
  // is still sent but two starts never race on the same waiting run. The trailing start keeps the request id while the
  // triggerKey is unchanged, so the worker hands back the same run (even a failed one), as two visits at once did before.
  async function visit(){
    if(raw().settings?.way!=='overnight'&&(opts.engine===true||opts.engine!==false&&root.chrome?.runtime?.sendMessage)){
      if(engineVisit){engineAgain=true;return engineVisit;}
      const shared=engineVisit=(async()=>{
        try{
          for(;;){engineAgain=false;try{const result=await visitEngine();if(!engineAgain)return result;}catch(error){if(!engineAgain)throw error;}}
        }finally{engineVisit=null;}
      })();
      return shared;
    }
    if(visiting)return visiting;
    if(!guard()||opts.demo)return;
    visiting=(async()=>{
      await init();
      if(!guard()||raw().settings?.on===false)return;
      if(raw().pending){await runtime.run({resume:true});return;}
      const built=await buildSnapshot(),
        s=raw(),
        today=Actions.day(now(),store.get().settings?.timeZone),
        changeKey=built.baseline?.fingerprint||fingerprint(built.baseline),
        changed=Object.keys(s.baseline||{}).length&&changeKey!==(s.baseline?.fingerprint||fingerprint(s.baseline));
      if(s.settings?.everyDay===true&&(s.lastVisitDay!==today||changed))await runtime.run({automatic:true,changeKey:today+':'+changeKey});
      await store.update(data=>{
        const state=Actions.state(data);
        for(const run of state.runs||[])
          for(const entry of run.actions||[])
            if(entry.outcome==='kept'&&entry.action?.itemId){
              const row=built.index.get(String(entry.action.itemId)),item=row?.item,mine=data.tasks?.[String(item?.id||row?.canvasId||'')];
              if(item&&(mine?.checkedOff||mine?.progress==='done'||item.done||item.submission?.submitted_at))entry.outcome='done';
            }
        state.activity=(state.activity||[]).filter(at=>at>=now()-7*86400000);
        if(!state.activity.length||now()-state.activity.at(-1)>30*60000)state.activity.push(now());
        const f=data.focus;
        if(f?.completedAt&&state.focusSeen!==f.completedAt){
          state.focusSeen=f.completedAt;
          state.focusHistory=[...(state.focusHistory||[]).filter(r=>r.at>=now()-7*86400000),{at:f.completedAt,minutes:f.completedMinutes||f.minutes||0}];
        }
      });
    })();
    try{await visiting;return state();}finally{visiting=null;}
  }
  async function visitEngine(){
    await init();
    if(raw().settings?.way==='overnight')return visit();
    const ctx=opts.getContext()||{},
      day=Actions.day(now(),store.get().settings?.timeZone),
      triggerKey=day+
        ':'+
        fingerprint([ctx.courses,ctx.agentAssignments||ctx.items,ctx.aiResources,ctx.aiUpdates,ctx.calendarEvents,ctx.conversations,ctx.sourceRevision]);
    // A Canvas visit starts Prepare only for a student who chose Every day; otherwise it waits for a press.
    if(!guard()||raw().settings?.on!==true||raw().settings?.everyDay!==true)return;
    if(engineAttempt?.triggerKey!==triggerKey)engineAttempt={triggerKey,id:'run-'+(opts.uuid?.()||root.crypto.randomUUID())};
    const reply=await (opts.request||
      root.chrome.runtime.sendMessage.bind(root.chrome.runtime))({target:'ch-ai-engine',op:'start',scopeKey:scope,requestId:engineAttempt.id,triggerKey,day});
    if(!reply?.ok)throw Error(reply?.error||'Prepare could not be accepted.');
    if(!engineAgain)engineAttempt=null;
    return reply.result;
  }
  // The student asked for it: a fresh run now, whatever ran earlier today.
  async function prepareNow(){
    if(raw().settings?.way==='overnight')throw Error('Overnight Prepare runs from Tools, AI.');
    await init();
    if(!guard())throw Error('Your AI is unavailable on this Canvas page.');
    if(raw().settings?.on!==true)throw Error('Turn on Prepare in Tools, AI first.');
    const day=Actions.day(now(),store.get().settings?.timeZone),id='run-'+(opts.uuid?.()||root.crypto.randomUUID());
    const reply=await (opts.request||
      root.chrome.runtime.sendMessage.bind(root.chrome.runtime))({target:'ch-ai-engine',op:'start',scopeKey:scope,requestId:id,triggerKey:day+':manual:'+id.slice(4),day,entry:'manual'});
    if(!reply?.ok)throw Error(reply?.error||'Prepare could not be accepted.');
    return reply.result;
  }
  async function settings(patch){
    if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!['on','way','grades','everyDay','dailyCap','wishes','provider','allowActions'].includes(k)))
      throw Error('Invalid agent setting.');
    for(const k of ['on','grades','everyDay','allowActions'])if(k in patch&&typeof patch[k]!=='boolean')throw Error('Choose an agent switch.');
    if('way'in patch&&!['web','api','overnight'].includes(patch.way))throw Error('Choose an AI way.');
    if('dailyCap'in patch&&(!Number.isInteger(patch.dailyCap)||patch.dailyCap<0||patch.dailyCap>20))throw Error('Choose a daily cap from 0 to 20.');
    if('wishes'in patch&&(typeof patch.wishes!=='string'||patch.wishes.length>600))throw Error('Instructions exceed 600 characters.');
    if('provider'in patch&&(typeof patch.provider!=='string'||!['chatgpt','claude','gemini','grok','deepseek','kimi','qwen','zai'].includes(patch.provider)))throw Error('Unknown AI website.');
    if(Object.keys(patch).some(k=>patch[k]!==raw().settings[k]))await runtime.stop();
    await store.update(data=>{const s=Actions.state(data);s.settings={...s.settings,...patch};if('way'in patch)s.wayMigrated=true;if('everyDay'in patch)s.everyDayChosen=true;});
    return state();
  }
  async function dismiss(runId,actionId){
    if(!guard())throw Error('This Canvas page is unavailable.');
    await store.update(data=>{
      const s=Actions.state(data),q=s.questions?.find(q=>q.runId===runId&&q.actionId===actionId),entry=s.runs?.find(r=>r.id===runId)?.actions.find(e=>e.id===actionId);
      if(!q||q.answer||!entry)throw Error('Question is unavailable.');
      q.dismissed=true;
      entry.outcome='dismissed';
    });
    return state();
  }
  return {run,improvePlan,visit,prepareNow,state,settings,dismiss,stop:async()=>{
    await runtime.stop();
    await request('stop').catch(()=>{});
    if(root.chrome?.runtime?.sendMessage){
      const r=await root.chrome.runtime.sendMessage({target:'ch-ai-engine',op:'get',scopeKey:scope}).catch(()=>null);
      if(r?.result?.id)await root.chrome.runtime.sendMessage({target:'ch-ai-engine',op:'cancel',scopeKey:scope,runId:r.result.id}).catch(()=>{});
    }
    return state();
  },undo:async(runId,actionId)=>{
    const built=await buildSnapshot();
    await createExecutor(built,{cache:new Map()}).undo(runId,actionId);
    return state();
  },answer:async(runId,actionId,value)=>{
    if(!guard())throw Error('This Canvas page is unavailable.');
    await store.update(data=>{
      const s=Actions.state(data),question=s.questions?.find(q=>q.runId===runId&&q.actionId===actionId);
      if(!question||!question.choices.includes(value)||question.answer||question.dismissed)throw Error('Choose an available answer.');
      question.answer=value;
      const run=s.runs.find(r=>r.id===runId);
      if(run)run.answers.push({actionId,question:question.question,answer:value});
    });
    return state();
  },forget:async id=>{
    if(!guard())throw Error('This Canvas page is unavailable.');
    await store.update(data=>{const s=Actions.state(data);s.memory=(s.memory||[]).filter(m=>m.id!==id);});
    return state();
  },update(next){
    opts={...opts,...next};
    publicState=null;
  },destroy(){alive=false;releaseCanvas?.();unsubscribe?.();void runtime.stop({preservePending:true});clients.delete(scope);}};
 }
 function ensure(options){
   const origin=options.store.owner?.origin||root.location?.origin,id=String(options.user?.id||options.store.owner?.accountId||''),key=origin+'|'+id;
   let client=clients.get(key);
   if(client&&client.accountStore!==options.store){client.destroy();client=null;}
   if(client){client.update(options);return client;}
   client=create(options);
   Object.defineProperty(client,'accountStore',{value:options.store});
   clients.set(key,client);
   return client;
 }
 function stopAll(){for(const c of clients.values())c.destroy();clients.clear();}
 return {create,ensure,modules,fingerprint,stopAll};
});
