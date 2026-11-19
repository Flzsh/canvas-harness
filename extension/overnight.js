/* Canvas Harness: local folder handoff. Handles and import receipts stay in the extension's IndexedDB. */
(function(root){
 'use strict';
 const Study=root.CanvasHarnessStudy||(typeof module==='object'&&module.exports?require('./study-prompts.js'):null),
   Kind=root.CanvasHarnessStudyKind||(typeof module==='object'&&module.exports?require('./study-kind.js'):null),
   UI=root.CanvasHarnessStudyUI||(typeof module==='object'&&module.exports?require('./study-ui.js'):null),
   queues=new Map();
 const day=now=>{
   const d=new Date(now);
   return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 },schedule=path=>'Every day at 21:00, answer the newest unanswered Canvas Harness request in the folder '+path+' (prep-DATE.json gets prep-DATE.answers.json; agent-DATE.json gets agent-DATE.actions.json).';
 function owner(scope){const key=UI.storageKey(scope);if(!key)throw Error('A verified Canvas account is required.');return key;}
 function agentMessages(rows){
   if(!Array.isArray(rows)||!rows.length||rows.length>40)throw Error('Choose an agent history with 1 to 40 messages.');
   let total=0;
   const result=[];
   for(const row of rows){
     if(!row||Array.isArray(row)||!['user','assistant'].includes(row.role)||typeof row.content!=='string'||!row.content.trim()||(total+=row.content.length)>140000)
       throw Error('Agent history must contain user or assistant text, up to 140,000 characters in total.');
     result.push({role:row.role,content:row.content});
   }
   if(result.at(-1).role!=='user')throw Error('An agent request must end with a user message.');
   return result;
 }
 function agentSuffix(runId){
   const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_:.-';
   let value=0n;
   for(const char of runId)value=value*66n+BigInt(alphabet.indexOf(char));
   return '-run-'+runId.length+'-'+value.toString(36);
 }
 function agentText(data,kind){
   const tag=kind==='agent'?'chagent':'chstudy',answer=data.text??data.answer??data;
   let raw;
   if(typeof answer==='string'){
     if(answer.length>140000)throw Error('Agent answers are too large.');
     const match=answer.match(new RegExp('```\\s*'+tag+'\\s*\\n([\\s\\S]*?)```','i'));
     raw=match?match[1].trimEnd():answer.trim();
   }
   else raw=JSON.stringify(answer);
   if(typeof raw!=='string'||raw.length>140000)throw Error('Agent answers are too large.');
   let parsed;
   try{parsed=JSON.parse(raw);}catch{throw Error('The agent answer is not valid JSON.');}
   if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||parsed.v!==1||(kind==='agent'?Array.isArray(parsed.read)===Array.isArray(parsed.actions):parsed.kind!==kind))
     throw Error('The agent answer does not match the requested kind.');
   const text='```'+tag+'\n'+raw+'\n```';
   if(text.length>140000)throw Error('Agent answers are too large.');
   return text;
 }
 function createDB(env=root){
   let opened;
   const open=()=>opened||=new Promise((resolve,reject)=>{
     if(!env.indexedDB){reject(Error('Prep folder storage is unavailable.'));return;}
     const request=env.indexedDB.open('ch-overnight',1);
     request.onupgradeneeded=()=>request.result.createObjectStore('accounts');
     request.onerror=request.onblocked=()=>{opened=null;reject(Error('Prep folder storage is unavailable.'));};
     request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opened=null;};resolve(db);};
   });
   async function use(mode,key,value){
     const db=await open();
     return new Promise((resolve,reject)=>{
       const tx=db.transaction('accounts',mode),store=tx.objectStore('accounts'),request=mode==='readonly'?store.get(key):store.put(value,key);
       tx.oncomplete=()=>resolve(request.result);
       tx.onerror=tx.onabort=()=>reject(Error('Prep folder storage is unavailable.'));
     });
   }
   return {get:key=>use('readonly',key),put:(key,value)=>use('readwrite',key,value)};
 }
 async function buildItems({catalog,collect,wishes={},now=Date.now(),uuid=()=>root.crypto.randomUUID()}){
   const result=[];
   for(const source of catalog.sources||[]){
     const due=Date.parse(source.due),kind=Kind.forSelection([source],{teacherFeedback:catalog.teacherFeedback===true});
     if(source.kind!=='assignment'||source.done||source.locked||source.personal||!Number.isFinite(due)||due<now||due-now>2*86400000||kind==='ask')continue;
     const ids=[source.id];
     if(kind==='fixes')
       for(const feedback of catalog.sources)if(feedback.kind==='feedback'&&feedback.assignmentId===source.assignmentId&&feedback.courseId===source.courseId)ids.push(feedback.id);
     const context=await collect({ids,all:false,includeAssignmentPdfs:true});
     if(context.omitted?.length)throw Error(source.title+': '+context.omitted.map(row=>row.title+': '+row.reason).join('; '));
     const course=source.courseName||catalog.courses?.find(c=>String(c.id)===source.courseId)?.name||'',item=source.title||'',date=source.due;
     result.push({
       id:uuid(),
       kind,
       course,
       item,
       due:date,
       message:Study.build(kind,{level:Kind.level(catalog.level),course,item,due:date,sources:context.sources||[],wishes:wishes[kind]||''}),
       itemId:String(source.assignmentId||source.id),
       courseId:String(source.courseId||'')
     });
   }
   return result;
 }
 function create({env=root,db=createDB(env),now=()=>Date.now()}={}){
  const store=UI.createStore(env),read=async scope=>({after:'20:00',enabled:false,preps:{},agents:{},errors:[],...await db.get(owner(scope))});
  function serial(scope,fn){
    owner(scope);
    const key='folder-files',work=()=>fn();
    if(env.navigator?.locks)return env.navigator.locks.request('ch-overnight:'+key,work);
    const next=(queues.get(key)||Promise.resolve()).catch(()=>{}).then(work);
    queues.set(key,next);
    next.finally(()=>{if(queues.get(key)===next)queues.delete(key);}).catch(()=>{});
    return next;
  }
  const save=(scope,value)=>db.put(owner(scope),value),
    view=r=>
      ({
        enabled:r.enabled,
        after:r.after,
        folder:r.handle?.name||'',
        path:r.path||'',
        schedule:r.handle?schedule(r.path||'<path>'):'',
        needsAllow:r.needsAllow===true,
        errors:r.errors||[]
      });
  async function configure(scope,settings){
    return serial(scope,async()=>{
      const r=await read(scope);
      if(Object.hasOwn(settings,'enabled'))r.enabled=settings.enabled===true;
      if(Object.hasOwn(settings,'after')){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.after))throw Error('Choose a time.');r.after=settings.after;}
      if(Object.hasOwn(settings,'path')){
        if(typeof settings.path!=='string'||settings.path.length>2000||/[\u0000-\u001f]/.test(settings.path))throw Error('Enter a folder path.');
        r.path=settings.path.trim();
      }
      await save(scope,r);
      return view(r);
    });
  }
  async function choose(scope,handle){
    if(!handle||handle.kind&&handle.kind!=='directory'||typeof handle.getFileHandle!=='function')throw Error('Choose a prep folder.');
    return serial(scope,async()=>{
      const r=await read(scope);
      if(r.handle&&!(await r.handle.isSameEntry?.(handle))){r.preps={};r.agents={};r.path='';r.errors=[];}
      r.handle=handle;
      r.needsAllow=false;
      r.allowDay='';
      r.requestDay='';
      await save(scope,r);
      return view(r);
    });
  }
  async function allow(scope){
    return serial(scope,async()=>{
      const r=await read(scope);
      if(!r.handle)throw Error('Choose a prep folder.');
      if(r.requestDay!==day(now())){r.needsAllow=await r.handle.requestPermission({mode:'readwrite'})!=='granted';r.requestDay=day(now());await save(scope,r);}
      return view(r);
    });
  }
  async function json(handle,name){const file=await (await handle.getFileHandle(name)).getFile();if(file.size>16000000)throw Error('Prep answers are too large.');return JSON.parse(await file.text());}
  async function imports(scope,r){
    let name,answers;
    for(const candidate of Object.keys(r.preps).filter(name=>!r.preps[name].imported&&r.preps[name].written!==false).sort().reverse()){
      try{
        answers=await json(r.handle,candidate.replace(/\.json$/,'.answers.json'));
        name=candidate;
        break;
      }catch(error){
        if(error.name==='NotFoundError')continue;
        if(!(error instanceof SyntaxError)&&error.name!=='SyntaxError'&&error.message!=='Prep answers are too large.')throw error;
        r.preps[candidate].errors=[{item:candidate,reasons:[error.message]}];
        r.errors=Object.values(r.preps).flatMap(prep=>prep.errors||[]);
        r.preps[candidate].imported=true;
        await save(scope,r);
        return true;
      }
    }
    if(!name)return false;
   const receipt=r.preps[name],errors=[],known=new Map(receipt.items.map(item=>[item.id,item])),seen=new Set();
   if(answers?.v!==1||answers.kind!=='canvas-harness-answers'||!Array.isArray(answers.items))
     errors.push({item:name,reasons:['Expected v:1, kind:canvas-harness-answers and an items array.']});
   else for(const answer of answers.items){
     const item=known.get(answer?.id);
     if(!item)continue;
     if(seen.has(item.id)){errors.push({item:item.item,reasons:['Duplicate answer id.']});continue;}
     seen.add(item.id);
     const parsed=Study.parse(answer.answer,item.kind);
     if(!parsed.ok){errors.push({item:item.item,reasons:parsed.errors});continue;}
     await store.save(scope,{
       v:1,
       kind:item.kind,
       itemId:item.itemId,
       courseId:item.courseId,
       title:parsed.data.title,
       item:item.item,
       savedAt:now(),
       data:parsed.data,
       progress:{},
       overnight:true
     });
   }
   receipt.imported=true;receipt.errors=errors;r.errors=Object.values(r.preps).flatMap(prep=>prep.errors||[]);await save(scope,r);return true;
  }
  async function writePrep(scope,r,name,build){
    let receipt=r.preps[name],prep=receipt?.pending;
    if(prep){
      try{
        const existing=await json(r.handle,name);
        if(JSON.stringify(existing)===JSON.stringify(prep)){receipt.written=true;delete receipt.pending;await save(scope,r);return false;}
        throw Error('The prep file changed. Choose another folder.');
      }catch(error){if(!['NotFoundError','SyntaxError'].includes(error.name))throw error;}
    }
    else{
      const items=await build();
      if(!Array.isArray(items))throw Error('Prep items are unavailable.');
      const ids=new Set();
      for(const item of items)
        if(!item||
          typeof item.id!=='string'||
          !item.id||
          ids.has(item.id)||
          !Object.hasOwn(UI.LABELS,item.kind)||
          ['course','item','due','message','itemId','courseId'].some(key=>typeof item[key]!=='string')||
          !ids.add(item.id))
          throw Error('Invalid prep item.');
      try{await r.handle.getFileHandle(name);throw Error('A prep file already exists for today.');}catch(error){if(error.name!=='NotFoundError')throw error;}
      prep={v:1,kind:'canvas-harness-prep',created:new Date(now()).toISOString(),items:items.map(({id,kind,course,item,due,message})=>({id,kind,course,item,due,message}))};
      receipt=r.preps[name]={items:items.map(({id,kind,item,itemId,courseId})=>({id,kind,item,itemId,courseId})),imported:false,written:false,pending:prep};
      await save(scope,r);
    }
    const writer=await (await r.handle.getFileHandle(name,{create:true})).createWritable();
    try{await writer.write(JSON.stringify(prep,null,2)+'\n');await writer.close();}catch(error){await writer.abort?.();throw error;}
    receipt.written=true;
    delete receipt.pending;
    await save(scope,r);
    return true;
  }
  async function visit(scope,{force=false,canPrepare=true,build}={}){
    return serial(scope,async()=>{
      const r=await read(scope),result={prepared:false,imported:false,allow:false,needPrepare:false,...view(r)};
      if(!r.enabled||!r.handle)return result;
      try{
        if(await r.handle.queryPermission({mode:'readwrite'})!=='granted')throw Object.assign(Error('Allow the prep folder'),{name:'NotAllowedError'});
        r.needsAllow=false;
        result.needsAllow=false;
        result.imported=await imports(scope,r);
        const date=day(now()),name='prep-'+date+'.json',d=new Date(now()),after=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
        result.needPrepare=canPrepare&&(!r.preps[name]||r.preps[name].written===false)&&(force||after>=r.after);
        if(result.needPrepare&&(build||r.preps[name]?.pending)){
          result.prepared=await writePrep(scope,r,name,build);
          result.needPrepare=false;
          if(!result.imported)result.imported=await imports(scope,r);
        }
        await save(scope,r);
        result.errors=r.errors;
        return result;
      }catch(error){
        if(['NotAllowedError','SecurityError'].includes(error.name)){
          r.needsAllow=true;
          result.needsAllow=true;
          if(r.allowDay!==day(now())){r.allowDay=day(now());result.allow=true;}
          await save(scope,r);
          return result;
        }
        throw error;
      }
    });
  }
  async function agentGate(r){
    let permission='unavailable';
    if(r.handle?.queryPermission)try{permission=await r.handle.queryPermission({mode:'readwrite'});}catch{permission='denied';}
    if(!['granted','prompt','denied'].includes(permission))permission='unavailable';
    return {
      enabled:r.enabled===true,
      folder:r.handle?.name||'',
      permission,
      ready:r.enabled===true&&Boolean(r.handle)&&permission==='granted',
      needsAllow:Boolean(r.handle)&&permission!=='granted'
    };
  }
  async function agentFile(handle,name,check){
    check();
    const entry=await handle.getFileHandle(name);
    check();
    const file=await entry.getFile();
    check();
    if(file.size>1048576)throw Error('Agent files are too large.');
    const text=await file.text();
    check();
    if(typeof text!=='string'||text.length>1048576)throw Error('Agent files are too large.');
    return text;
  }
  async function absent(handle,name,check){
    check();
    try{await handle.getFileHandle(name);}catch(error){check();if(error.name==='NotFoundError')return;throw error;}
    check();
    throw Error('An agent file already exists without a matching receipt. Choose another folder.');
  }
  async function agent(scope,{messages,runId,kind='agent',turn=0,signal,canContinue,beforeSend}={}){
   messages=Array.isArray(messages)?messages.map(row=>row&&typeof row==='object'&&!Array.isArray(row)?{role:row.role,content:row.content}:row):messages;
   return serial(scope,async()=>{
    if(signal!==undefined&&(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))
      throw Error('Choose an AbortSignal for the agent request.');
    if(canContinue!==undefined&&typeof canContinue!=='function')throw Error('Choose a synchronous agent continuation check.');
    if(beforeSend!==undefined&&typeof beforeSend!=='function')throw Error('Choose an asynchronous send guard.');
    const check=()=>{
      if(signal?.aborted)throw Object.assign(Error('Request stopped.'),{name:'AbortError'});
      const live=canContinue===undefined?true:canContinue();
      if(typeof live!=='boolean')throw Error('The agent continuation check must return a boolean synchronously.');
      if(!live||signal?.aborted)throw Object.assign(Error('Request stopped.'),{name:'AbortError'});
    },publish=result=>{check();return result;};
    check();
    messages=agentMessages(messages);
    if(typeof runId!=='string'||!/^[\w:.-]{1,160}$/.test(runId))throw Error('Choose a valid agent run id.');
    if(!['agent','practice','reading','notes','lab','rubric','fixes','steps','outline','message','summary','flashcards'].includes(kind)||!Number.isSafeInteger(turn)||turn<0||turn>=40)
      throw Error('Choose an agent kind and a turn from 0 to 39.');
    const fresh=async()=>{check();await beforeSend?.();check();};
    await fresh();
    const r=await read(scope);
    check();
    const gate=await agentGate(r);
    check();
    if(!gate.ready)return publish({pending:true,...gate});
    const persist=async()=>{await fresh();await save(scope,r);check();};
    try{if(r.needsAllow){r.needsAllow=false;await persist();}
     const records=r.agents||(r.agents={}),
       names=Object.keys(records),
       initial=names.find(name=>records[name].runId===runId&&records[name].turn===0),
       existing=names.find(name=>records[name].runId===runId&&records[name].turn===turn),
       date=initial?records[initial].day:day(now()),
       canonical='agent-'+date,
       suffixed=canonical+agentSuffix(runId),
       stem=initial?initial.replace(/\.json$/,''):records[canonical+'.json']?suffixed:canonical;
     if(turn>0&&!initial)throw Error('Start this agent run at turn 0.');if(initial&&stem!==canonical&&stem!==suffixed)throw Error('The agent request does not match its receipt. Start a new run.');
     const name=stem+(turn?'-'+turn:'')+'.json',actions=name.replace(/\.json$/,'.actions.json'),request={v:1,kind:'canvas-harness-agent',runId,messages},expected=JSON.stringify(request,null,2)+'\n';
     let receipt=records[name];
     if(existing&&existing!==name||
       receipt&&(receipt.runId!==runId||receipt.turn!==turn||receipt.kind!==kind||receipt.day!==date||JSON.stringify(receipt.messages)!==JSON.stringify(messages)))
       throw Error('The agent request does not match its receipt. Start a new run.');
     if(!receipt){
       if(turn>0&&!names.some(name=>records[name].runId===runId&&records[name].turn===turn-1&&typeof records[name].answer==='string'))throw Error('Read the previous agent turn before continuing.');
       await absent(r.handle,name,check);
       await absent(r.handle,actions,check);
       check();
       receipt=records[name]={runId,turn,kind,day:date,messages,written:false};
       await persist();
     }
     let present;
     try{
       present=await agentFile(r.handle,name,check);
     }catch(error){check();if(error.name!=='NotFoundError')throw error;if(receipt.written)throw Error('The agent request file was removed. Choose another folder.');}
     if(present!==expected){
      if(receipt.written||present!==undefined&&present!=='')throw Error('The agent request file changed. Choose another folder.');
      await absent(r.handle,actions,check);
      check();
      const handle=await r.handle.getFileHandle(name,{create:true});
      check();
      const current=await handle.getFile();
      check();
      if(current.size>0)throw Error('The agent request file changed. Choose another folder.');
      let writer;
      const abortWriter=async()=>{try{await writer?.abort?.();}catch{}},abort=()=>{void abortWriter();};
      signal?.addEventListener('abort',abort,{once:true});
      try{
        await fresh();
        writer=await handle.createWritable();
        await fresh();
        await writer.write(expected);
        await fresh();
        await writer.close();
        check();
      }catch(error){await abortWriter();check();throw error;}finally{signal?.removeEventListener('abort',abort);}
     }
     check();if(!receipt.written){receipt.written=true;await persist();}if(typeof receipt.answer==='string')return publish({status:'answer',text:receipt.answer});
     let raw;
     try{raw=await agentFile(r.handle,actions,check);}catch(error){check();if(error.name==='NotFoundError')return publish({pending:true});throw error;}
     let data;
     try{data=JSON.parse(raw);}catch{throw Error('The agent actions file is not valid JSON.');}
     if(!data||typeof data!=='object'||Array.isArray(data)||data.v!==1||data.runId!==runId||(data.turn===undefined?turn!==0:data.turn!==turn))
       throw Error('The agent actions do not match this run and turn.');
     check();receipt.answer=agentText(data,kind);await persist();return publish({status:'answer',text:receipt.answer});
    }catch(error){
      check();
      if(['NotAllowedError','SecurityError'].includes(error.name)){r.needsAllow=true;await persist();return publish({pending:true,...gate,permission:'denied',ready:false,needsAllow:true});}
      throw error;
    }
   });
  }
  return {configure,choose,allow,visit,agent,agentStatus:async scope=>agentGate(await read(scope)),status:async scope=>view(await read(scope))};
 }
 const api={create,createDB,buildItems,day,schedule};root.CanvasHarnessOvernight=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
