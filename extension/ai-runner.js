/* One checkpointed Prepare step. Pages never own this loop or its conversation. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAIRunner=api;
})(globalThis,function(root){
 'use strict';
 const load=(n,p)=>root[n]||(typeof require==='function'?require(p):null),
   Agent=load('CanvasHarnessAgent','./agent-prompts.js'),
   Study=load('CanvasHarnessStudy','./study-prompts.js'),
   Runtime=load('CanvasHarnessAgentRuntime','./agent-runtime.js'),
   Band=load('CanvasHarnessStudyBand','./study-band.js');
 // The brief's rule holds for every source: login lines and e-mail addresses in a teacher's text never reach the AI.
 const scrub=v=>load('CanvasHarnessPrepareBrief','./prepare-brief.js')?.scrub?.(v)??String(v??'');
 // A long syllabus or home page: its opening, then the lines that name this item, so a schedule near the end still arrives.
 const named=(text,title,max)=>{
   if(text.length<=max)return text;
   const words=s=>new Set(String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]),wanted=[...words(title)],own=wanted.length?text.split(/\n+/).filter(line=>{
     const has=words(line);
     return wanted.filter(w=>has.has(w)).length>=Math.min(2,wanted.length);
   }).join('\n').slice(0,Math.floor(max/2)):'';
   return text.slice(0,max-own.length-1)+'\n'+own;
 };
 // Help's materials fitted to the prompt's room (budget under material()'s 42,000: marking a source can lengthen it), so
 // nothing that matters is lost without a word. In order of claim: notes on what could not be read (never cut; the caller
 // keeps their room); the item's instructions (warnings, the body cut by requirement and never under about 6,000, then the
 // rubric whole; with a rubric up to 20,000, else 14,000); the brief; the student's paste (up to 30,000); the item's files,
 // course files and Google Docs (short ones whole, long ones share the rest evenly; a PDF keeps whole pages, its opening
 // and the last pages read); the syllabus and home page with whatever is left. Each cut instruction, file or paste comes
 // back in cuts, one line saying what is here, for the "Could not be read" note. Pure: sources are not changed.
 function fitSources(sources,{budget=41000,title='',smartCut=load('ReserveCore','./core.js')?.smartCut}={}){
  const list=(sources||[]).map(s=>({...s,text:String(s.text||'')})),cost=s=>s.text.length+String(s.label||'').length+64,cuts=[];let left=budget;
  const pagesOf=text=>text.split(/\n\n(?=\[Page \d+\]\n)/),pageNo=block=>Number(/^\[Page (\d+)\]/.exec(block)?.[1])||0;
  const spans=nums=>{
    const out=[];
    for(const n of nums){const last=out.at(-1);if(last&&n===last[1]+1)last[1]=n;else out.push([n,n]);}
    return out.map(([a,b])=>a===b?String(a):a+'-'+b);
  };
  const said=list=>list.length>1?list.slice(0,-1).join(', ')+' and '+list.at(-1):list[0]||'';
  const name=s=>String(s.label||'This source');
  // A long text keeps its start and its end; a PDF keeps whole pages (about two thirds of the room from the start).
  function shorten(s,room){
   const text=s.text,info=s.info||{},total=Number(info.totalPages)||0;
   if(room<400){cuts.push(name(s)+': there was no room for its text; it is not in these materials.');return '';}
   if(/^\[Page \d+\]\n/.test(text)){
    const blocks=pagesOf(text),head=[],tail=[];let used=0;
    for(const b of blocks){if(used+b.length+2>room*.66&&head.length)break;head.push(b);used+=b.length+2;}
    for(const b of blocks.slice(head.length).reverse()){if(used+b.length+2>room)break;tail.unshift(b);used+=b.length+2;}
    let kept=[...head,...tail];if(kept.join('\n\n').length>room)kept=[kept[0].slice(0,Math.max(0,room-1))];
    const nums=kept.map(pageNo).filter(Boolean),all=blocks.map(pageNo).filter(Boolean),lastRead=all.at(-1)||0;
    if(nums.length<all.length||info.truncated||total>lastRead)cuts.push(name(s)+': pages '+said(spans(nums))+' of '+(total||lastRead)+' are here; the other pages are not in these materials.');
    return kept.join('\n\n');
   }
   if(text.length<=room){if(info.truncated)cuts.push(name(s)+': only its first part is here; the rest is not in these materials.');return text;}
   cuts.push(name(s)+': only its start and its end are here; the middle is not in these materials.');
   const head=Math.floor(room*.7);return text.slice(0,head)+'\n…\n'+text.slice(-(room-head-3));
  }
  for(const s of list.filter(s=>s.role==='note'))left-=cost(s);
  // the item's instructions
  for(const s of list.filter(s=>s.role==='instructions')){
   const cap=s.parts?.rubric?20000:14000;
   if(s.parts){
     const {head='',warnings=[],body='',rubric=''}=s.parts,
       fixed=[head,...warnings,rubric].filter(Boolean).join('\n\n'),
       room=Math.max(6000,cap-fixed.length-4),
       cut=body.length>room&&typeof smartCut==='function'?smartCut(body,room):body.slice(0,room);
    s.text=[head,...warnings,cut,rubric].filter(Boolean).join('\n\n');
    if(cut.length<body.length)cuts.push(name(s)+': the instructions are shortened to their requirements; the rest is not in these materials.');
   }
   else if(s.text.length>cap){
     s.text=typeof smartCut==='function'?smartCut(s.text,cap):s.text.slice(0,cap);
     cuts.push(name(s)+': the instructions are shortened to their requirements; the rest is not in these materials.');
   }
   left-=cost(s);
  }
  for(const s of list.filter(s=>s.role==='brief')){if(cost(s)>left-2000)s.text=s.text.slice(0,Math.max(0,left-2000-String(s.label||'').length-64));left-=cost(s);}
  for(const s of list.filter(s=>s.role==='paste')){
    const room=Math.max(0,Math.min(30000,left-String(s.label||'').length-64));
    if(s.text.length>room)s.text=shorten(s,room);
    left-=cost(s);
  }
  // files share what is left: short ones whole, long ones evenly
  const files=list.filter(s=>s.role==='file').sort((a,b)=>a.text.length-b.text.length);
  files.forEach((s,i)=>{
    const share=Math.floor(Math.max(0,left)/(files.length-i))-String(s.label||'').length-64;
    s.text=s.text.length>share||s.info?.truncated?shorten(s,Math.max(0,share)):s.text;
    left-=cost(s);
  });
  for(const s of list.filter(s=>s.role==='course')){
    const room=Math.min(5000,Math.max(0,left-String(s.label||'').length-64));
    s.text=room<400?'':named(s.text,title,room);
    if(s.text)left-=cost(s);
  }
  return {sources:list.filter(s=>s.text.trim()||s.role==='brief'),cuts};
 }
 function create({canvas,results,account,adapter,docs=load('CanvasHarnessGoogleDocs','./google-docs.js'),now=()=>Date.now(),uuid=()=>root.crypto.randomUUID()}={}){
  async function step(run,{save,guard,signal,claimProvider}){
   await guard();const reader=run.snapshot?canvas.reader(run,signal):null;
   // A deliverable is saved the moment it is made, at its place in the run's order, so Stop, a settings change or a newer
   // run never loses it; a step replayed after a restart writes the same card to the same key.
   async function keep(card,pick){
    const refs=run.refs||{},
      ref=refs[pick.ref],
      row=new Map(run.snapshot.index).get('assignment:'+ref?.courseId+':'+ref?.id),
      due=Date.parse(row?.item?.dueAt||''),
      short=root.CanvasHarnessPrepareBrief?.courseName||(v=>String(v||'')),
      course=short(row?.item?.courseName||'');
    // Sizes are quarters of the band (grid:4): the AI's size, else the kind's usual width (the Help card markup contract, math-render.js).
    const shown={
      ...card,
      ...(pick.unread?.length?{unread:pick.unread}:{}),
      kind:pick.make==='auto'?card.kind:pick.make,
      size:Study.SIZES?.includes(card.size)?card.size:Study.DELIVER_SIZE?.[card.kind]||'xl',
      grid:4,
      importance:Number.isFinite(due)&&due-now()<36e5*36?1:2,
      headline:(course?course.split(':')[0].trim()+': ':'')+String(ref?.title||card.title||'').split(/\s+/).slice(0,8).join(' '),
      title:card.title||ref?.title||'',
      ref:pick.ref
    };
    await guard();await results.saveCards(run,[shown],refs,{ask:run.kind==='ask',at:run.made.length});run.made.push({card,pick});run.cardCount=run.made.length;
   }
   // What a pick did not become, for the band to say: the item and a short reason (the AI's own words when it said
   // what is missing, which is an answer, not a fault).
   const notMade=(pick,reason,refused=false)=>{
     run.notMade=[
       ...(run.notMade||[]),
       {title:String(run.refs?.[pick?.ref]?.title||'This item').slice(0,80),reason:String(reason||'').trim().slice(0,320),...(refused?{refused:true}:{})}
     ].slice(-6);
   };
   async function read(request){
     const key=JSON.stringify(request);
     if(run.reads?.[key])return run.reads[key];
     await guard();
     const result=await reader.read(request);
     await guard();
     if(result.fatal)throw Error(result.error);
     run.reads||={};
     run.reads[key]=result;
     run.cache=[...reader.cache];
     await save(run);
     return result;
   }
   // A test of the way to the AI, over the road cards take: no Canvas data and no cards, one word out and the same word back in the form cards use.
   if(run.check&&run.state==='queued'){
     run.word='READY-'+uuid().slice(0,8);
     run.sentAt=now();
     run.mode='ask';
     run.messages=[{role:'user',content:'This is a connection test from a study app. Reply with only this, in one ```json code block: {"ready":"'+run.word+'"}'}];
     run.state='asking';
     run.progress='Testing your AI';
     return save(run);
   }
   if(run.state==='queued'){run.state='scanning';return save(run);}
   if(run.state==='scanning'){
    // If a worker died inside the GET scan it restarts that scan; no frozen snapshot is overwritten.
    if(run.kind==='ask'&&run.cachedBrief&&!['auto','test','reading','translate','examples'].includes(run.make)){run.snapshot={brief:run.cachedBrief,text:'',index:[],hash:''};}
    else run.snapshot=await canvas.scan(run,signal);
    await guard();
    await account.sync();
    const data=account.get();
    if(run.kind==='ask'){const brief=run.snapshot.brief||{text:'',refs:{}},refs=brief.refs||{},ref=Object.keys(refs).find(k=>run.itemId&&refs[k].id===String(run.itemId));
     const focus=ref?'['+ref+'] '+refs[ref].title:run.itemTitle?scrub(run.itemTitle)+(run.itemText?'\nIts instructions: '+scrub(run.itemText).slice(0,4000):''):'';
     // Help with this item, or the items Help with… picked (up to three): one deliverable each from the item's own
     // materials, of the kind asked for or the kind the AI chooses.
     const asked=(Array.isArray(run.items)&&run.items.length?run.items:run.itemId?[{itemId:run.itemId,courseId:run.courseId,itemTitle:run.itemTitle}]:[]).slice(0,3);
     if(['auto','test','reading','translate','examples'].includes(run.make)&&asked.length){
       const index=run.snapshot.index||[];
       run.refs={...refs};
       run.picks=asked.map((it,i)=>{
         const own=Object.keys(refs).find(k=>refs[k].id===String(it.itemId)),
           known=it.courseId?null:index.find(([,r])=>r?.what==='assignment'&&String(r.canvasId)===String(it.itemId))?.[1],
           key=own||'H'+(i+1);
         if(!own)run.refs[key]={id:String(it.itemId),courseId:String(it.courseId||known?.courseId||''),title:String(it.itemTitle||known?.title||'This assignment')};
         return {ref:key,make:run.make,focus:String(run.question||'').slice(0,240),sources:[]};
       });
       run.mode='prepare';
       run.phase='deliver';
       run.pickIndex=0;
       run.made=[];
       run.state='gathering';
       return save(run);
     }
     run.mode='ask';run.refs=refs;if(!ref&&run.itemId&&run.itemTitle)run.refs={...refs,Q1:{id:String(run.itemId),courseId:String(run.courseId||''),title:run.itemTitle}};
     run.messages=[
       {
         role:'user',
         content:Study.buildAsk({
           now:now(),
           timeZone:data.settings.timeZone,
           level:data.toolbox?.aiLevel,
           question:run.question,
           focus:focus+(!ref&&run.itemId&&run.itemTitle?' (ref Q1)':''),
           card:run.card,
           brief:brief.text,
           wishes:run.instructions.standingText
         })
       }
     ];
     run.state='asking';run.progress='Asking your AI';return save(run);}
    // No course to look at (a break, or an account with no student enrollment): there is nothing to ask the AI about.
    if(Array.isArray(run.snapshot.snapshot?.courses)&&!run.snapshot.snapshot.courses.length){run.state='unchanged';run.progress='Nothing needs help today';return save(run);}
    // Nothing new since the last visit skips an automatic run; a run the student clicked for always asks.
    if(run.entry!=='manual'&&run.day===data.toolbox?.agent?.lastVisitDay&&run.snapshot.baseline.fingerprint===data.toolbox?.agent?.baseline?.fingerprint){
      run.state='unchanged';
      run.progress='Ready';
      return save(run);
    }
    run.instructions.perKindWishes=run.instructions.perKindWishes||{};
    run.mode='prepare';run.refs=run.snapshot.brief?.refs||{};
    run.messages=[
      {
        role:'user',
        content:Study.buildPrepare({
          now:now(),
          timeZone:data.settings.timeZone,
          level:data.toolbox?.aiLevel,
          brief:run.snapshot.brief?.text||'',
          wishes:run.instructions.standingText
        })
      }
    ];
    run.state='asking';run.progress='Asking your AI';return save(run);
   }
   if(run.state==='asking'){
    await canvas.validate?.(run,Object.values(run.reads||{}).filter(r=>!r.error).map(r=>r.id),signal);await guard();
    // A cut emoji leaves half a character; some AI APIs refuse the whole request for it.
    run.messages.at(-1).content=String(run.messages.at(-1).content).toWellFormed?.()??run.messages.at(-1).content;
    const kind=run.mode==='prepare'||run.mode==='ask'?'prepare':run.phase==='aid'?run.aids[run.aidIndex].action.kind:'agent';
    // Each deliverable opens its own chat; the hidden check of a translation follows in the chat that made it.
    const turn={
      id:'turn-'+uuid(),
      requestHash:canvas.hash?.(run.messages.at(-1).content)||'',
      text:run.messages.at(-1).content,
      messages:Runtime.boundedHistory(run.messages),
      expectedKind:kind,
      ...(run.phase==='deliver'&&!run.checking?{fresh:true}:{})
    };
    run.turns.push(turn);
    run.turnIndex=run.turns.length-1;
    run.state='awaiting-reply';
    return save(run);
   }
   if(run.state==='awaiting-reply'){
    const turn=run.turns[run.turnIndex];
    if(!turn.reply){
      const response=await adapter.deliver(turn,async receipt=>{
        turn.deliveryReceipt=receipt;
        if(['sent','dispatch-intent','send-intent'].includes(receipt.status))run.handled=true;
        await save(run);
      },{run,signal,guard,claimProvider});
      await guard();
     // The hidden check never asks anything of the student: if its turn stops or needs them, the first card stands.
     if(run.checking&&response.status==='needs-you'){
       const pick=run.picks[run.pickIndex];
       run.checking=false;
       if(pick?.first){await keep(pick.first,pick);pick.checked='first';delete pick.first;}
       run.pickIndex++;
       run.retries=0;
       run.state='gathering';
       return save(run);
     }
     // (manual: a closed or sleeping chat, or a usage limit: nothing is sent again on its own)
     if(response.status==='needs-you'&&response.needsYou?.action==='Try again'&&!response.needsYou.manual&&!(run.retries>=1)){
       run.retries=(run.retries||0)+1;
       run.turns.push({id:'turn-'+uuid(),requestHash:turn.requestHash,text:turn.text,messages:turn.messages,expectedKind:turn.expectedKind,fresh:true});
       run.turnIndex=run.turns.length-1;
       run.progress='Asking again';
       return save(run);
     }
     // A deliverable the AI stops on twice is left out; the day's other picks still get made.
     // Daily help: a deliverable whose chat never took the message (nothing was sent) gets one fresh chat; after that it is left out.
     const unsent=['target','staged'].includes(response.receipt?.status||turn.deliveryReceipt?.status);
     if(response.status==='needs-you'&&run.phase==='deliver'&&response.needsYou?.action==='Review draft'&&unsent&&!(run.retries>=1)){
       run.retries=(run.retries||0)+1;
       run.turns.push({id:'turn-'+uuid(),requestHash:turn.requestHash,text:turn.text,messages:turn.messages,expectedKind:turn.expectedKind,fresh:true});
       run.turnIndex=run.turns.length-1;
       run.progress='Asking again';
       return save(run);
     }
     // A usage limit ends Help with what is made, saying so in the AI's own words; with nothing made the student decides.
     if(response.status==='needs-you'&&response.needsYou?.limit&&run.phase==='deliver'&&run.made?.length){
       run.stopNote=(root.CanvasHarnessProviders?.get?.(run.provider)?.label||'Your AI')+' stopped: '+String(response.needsYou.said||response.needsYou.reason).slice(0,300);
       run.errors.push('limit: '+String(response.needsYou.reason).slice(0,160));
       run.pickIndex=run.picks.length;
       run.retries=0;
       run.state='gathering';
       return save(run);
     }
     if(response.status==='needs-you'&&run.phase==='deliver'&&!response.needsYou?.limit&&(response.needsYou?.action==='Try again'||response.needsYou?.action==='Review draft'&&unsent)){
       run.errors.push((run.picks[run.pickIndex]?.make||'help')+': '+(response.needsYou.reason||'stopped'));
       notMade(run.picks[run.pickIndex],response.needsYou.manual?String(response.needsYou.reason||'The AI tab was closed').replace(/\.?$/,'.'):'Your AI stopped before making it.');
       run.pickIndex++;
       run.retries=0;
       run.state='gathering';
       return save(run);
     }
     if(response.status==='needs-you'){run.needsYou={...response.needsYou,at:now(),resumeState:'awaiting-reply'};run.state='needs-you';return save(run);}
     if(response.status!=='reply')return {waiting:true};
     turn.reply=response.reply;turn.deliveryReceipt=response.receipt;run.handled=true;await save(run);
    }
    if(run.check){
      const name=root.CanvasHarnessProviders?.get?.(run.provider)?.label||'Your AI';
      run.progress=String(turn.reply).includes(run.word)?name+' replied in '+Math.max(1,Math.round((now()-run.sentAt)/1000))+' s':name+' answered, but not in the form cards need';
      run.state='unchanged';
      return save(run);
    }
    run.messages.push({role:'assistant',content:turn.reply});
    if(run.phase==='aid'){run.state='saving-aid';return save(run);}
    // Daily help: the picks lead to one deliverable each; a deliverable that cannot be read is left out, not shown.
    if(run.mode==='prepare'&&run.phase!=='deliver'){
      const picks=Study.parsePicks?.(turn.reply);
      if(picks?.ok&&picks.data.picks.length){run.picks=picks.data.picks;run.pickIndex=0;run.made=[];run.phase='deliver';run.state='gathering';return save(run);}
      if(picks?.ok){run.state='unchanged';run.progress='Nothing needs help today';return save(run);}
      if(picks?.unusable){
        run.state='needs-you';
        run.needsYou={reason:'The reply could not be read as cards',action:'Try again',resumeState:'awaiting-reply'};
        run.errors.push(...picks.errors);
        return save(run);
      }
    }
    if(run.mode==='prepare'&&run.phase==='deliver'){const pick=run.picks[run.pickIndex];
     // The hidden self-check of translation help: the checked card replaces the first only when it reads and keeps the
     // same lines; a diff, prose, a file request or anything else leaves the first card. The student sees one card.
     if(run.checking){
       run.checking=false;
       const first=pick.first,checked=first&&Study.checkedTranslate?Study.checkedTranslate(first,turn.reply):{ok:false};
       delete pick.first;
       pick.checked=checked.ok?'checked':'first';
       if(checked.ok)pick.changed=checked.changed?.length||0;
       if(first)await keep(checked.ok?checked.data:first,pick);
       run.pickIndex++;
       run.retries=0;
       run.state='gathering';
       return save(run);
     }
     const parsed=Study.parseDeliver(turn.reply,pick.make);
     // A reading or translation whose text is not in the materials: the AI said what is missing. Its answer stands; no retry.
     if(parsed.refused){notMade(pick,parsed.gaps[0],true);run.errors.push(pick.make+': '+parsed.gaps[0]);run.pickIndex++;run.retries=0;run.state='gathering';return save(run);}
     // The AI asked for course files from the list: read them and ask once more, without the list.
     if(parsed.ok&&parsed.read){
       const asked=pick.asked?[]:parsed.read.filter(l=>pick.library?.[l]);
       if(asked.length){pick.asked=asked;run.retries=0;run.state='gathering';return save(run);}
       run.errors.push(pick.make+': asked for files it could not have');
       notMade(pick,'Your AI asked for files instead of making it.');
     }
     // A reply that cannot be read, a reading with quotes that are not in the materials, or worked examples that reuse
     // the assignment's own questions get one fresh try told exactly what was wrong; quotes still not found after it are
     // left off the card, and problems that still reuse a question are left out of it.
     else{
       const asked=String(run.messages[0]?.content||''),
         materials=asked.slice(Math.max(0,asked.indexOf('<<<SOURCE '))),
         unfound=parsed.ok&&parsed.data.kind==='reading'?Study.unfoundQuotes(parsed.data,materials):[],
         copied=parsed.ok&&parsed.data.kind==='examples'&&Study.copiedProblems?Study.copiedProblems(parsed.data,materials):[];
      const problems=!parsed.ok?
        parsed.errors.slice(0,3):
        [
          ...(unfound.length?['These quotes are not in the materials word for word: '+unfound.slice(0,3).map(q=>'"'+q.slice(0,90)+'"').join('; ')+'. Copy quotes exactly from the reading, or use "".']:[]),
          ...copied.map(c=>c.text)
        ].slice(
          0,
          3);
      if(problems.length&&!pick.fix){pick.fix=problems;run.retries=0;run.state='gathering';return save(run);}
      let card=parsed.ok?parsed.data:null;
      if(card&&unfound.length){for(const p of card.points)if(unfound.includes(String(p.quote||'').trim()))p.quote='';run.errors.push(pick.make+': quotes not in the materials were left off');}
      if(card&&copied.length){
        const drop=new Set(copied.map(c=>c.index));
        if(drop.size<card.problems.length){card.problems=card.problems.filter((_,i)=>!drop.has(i));run.errors.push(pick.make+': problems that reused the assignment\'s questions were left off');}
        else{card=null;run.errors.push(pick.make+': every problem reused the assignment\'s questions, so none was kept');notMade(pick,'Every problem repeated the assignment\'s own questions.');}
      }
      // A translation gets one hidden check in the same chat before it is kept.
      if(card&&card.kind==='translate'&&Study.buildCheck){
        pick.first=card;
        run.messages.push({role:'user',content:Study.buildCheck()});
        run.checking=true;
        run.progress='Checking the translation'+(run.picks.length>1?' · '+(run.pickIndex+1)+' of '+run.picks.length:'');
        run.state='asking';
        return save(run);
      }
      if(card)await keep(card,pick);else if(!parsed.ok){run.errors.push(...parsed.errors.slice(0,4).map(e=>pick.make+': '+e));notMade(pick,'Your AI\'s answer could not be read.');}}
     run.pickIndex++;run.retries=0;run.state='gathering';return save(run);}
    if(run.mode==='prepare'||run.mode==='ask'){
      const parsed=run.mode==='ask'?Study.parseAsk(turn.reply):Study.parsePrepare(turn.reply);
      if(!parsed.ok){
        run.state='needs-you';
        run.needsYou={reason:'The reply could not be read as cards',action:'Try again',resumeState:'awaiting-reply'};
        run.errors.push(...parsed.errors.slice(0,6));
        return save(run);
      }
     run.progress='Saving your cards';await save(run);run.cardCount=await results.saveCards(run,parsed.data.cards,run.refs,{ask:run.mode==='ask'});run.state='publishing';return save(run);}
    const parsed=Agent.parse(turn.reply);
    if(!parsed.ok){
      run.state='needs-you';
      run.needsYou={reason:'Review the AI reply or import a corrected reply',action:'Read reply',resumeState:'awaiting-reply'};
      run.errors.push(...parsed.errors);
      return save(run);
    }
    if(parsed.kind==='read'){if(run.readRound>=Agent.LIMITS.rounds)throw Error('The read round limit was reached.');run.requests=parsed.reads;run.readAt=0;run.readResults=[];run.state='reading';}
    else{run.actions=parsed.actions;run.actionIndex=0;run.aids=[];run.state='applying';}
    return save(run);
   }
   if(run.state==='reading'){
    if(run.readAt<run.requests.length){
      const req=run.requests[run.readAt],row=new Map(run.snapshot.index).get(req.id);
      run.progress='Reading '+(row?.title||req.what)+' · '+(run.readAt+1)+' of '+run.requests.length;
      await save(run);
      run.readResults.push(await read(req));
      run.readAt++;
      return save(run);
    }
    run.readRound++;run.messages.push({role:'user',content:Agent.followUp({results:Runtime.fitReads(run.readResults),round:run.readRound})});run.state='asking';return save(run);
   }
   if(run.state==='gathering'){
    const refs=run.refs||{},index=new Map(run.snapshot.index),data=account.get();
    if(run.pickIndex>=run.picks.length){
     // Nothing made because the text is missing: asking again cannot help, so the line does not ask for it.
     if(!run.made.length){
       const missing=run.notMade?.length&&run.notMade.every(n=>n.refused);
       run.state='unchanged';
       run.progress=run.kind==='ask'?'Your AI could not make help for this item.'+(missing?'':' Try Help with this again.'):'Your AI could not make today\'s help.'+(missing?'':' Try Daily AI help again.');
       return save(run);
     }
     // Each card was saved as it was made (keep); what is left is to say so.
     run.cardCount=run.made.length;run.state='publishing';return save(run);
    }
    const pick=run.picks[run.pickIndex],ref=refs[pick.ref];if(!ref||ref.source){run.pickIndex++;return save(run);}
    const id='assignment:'+ref.courseId+':'+ref.id,row=index.get(id),sources=[],took=new Set(),linked=[],unreadable=[],add=async(what,sid,label,max=14000)=>{
      took.add(sid);
      const course=/^Course (?:syllabus|home page)$/.test(label),file=what==='pdf',result=await read({what,id:sid,...(file?{limit:30000}:{})}),parts=result.parts;
     // Each source says what it is, so the fit below knows what it may cut and how; files say which pages they hold.
     if(!result.error&&String(result.text||'').trim())
       sources.push({
         label,
         role:what==='assignment'?'instructions':course?'course':'file',
         text:course?named(scrub(result.text),ref.title,max):scrub(result.text),
         ...(parts?{parts:{head:scrub(parts.head||''),warnings:(parts.warnings||[]).map(scrub),body:scrub(parts.body||''),rubric:scrub(parts.rubric||'')}}:{}),
         ...(file?{info:{pagesRead:result.pagesRead,totalPages:result.totalPages,truncated:result.truncated===true}}:{})
       });
     else if(!course)unreadable.push(result.error||label);
     for(const g of result.google||[])if(!linked.some(x=>x.id===g.id))linked.push(g);
    };
    run.progress='Reading '+ref.title;await save(run);
    if(row)await add('assignment',id,'Teacher instructions: '+ref.title);else unreadable.push(ref.title+': its instructions could not be read from Canvas.');
    const open=r=>r&&(!r.locked||r.linked===true&&r.hiddenOnly===true);
    // The item's attached files and pages are listed on its snapshot entry, not on its index record.
    const entry=(run.snapshot.snapshot?.items||[]).find(i=>i?.id===id)||row||{};
    for(const fid of [...(entry.files||[]),...(entry.pages||[])].slice(0,4)){const r=index.get(fid);if(open(r))await add(r.what,fid,(r.what==='page'?'Page: ':'Attached file: ')+(r.title||'file'));}
    // The course home page and syllabus name the units and textbook the item belongs to.
    for(const [hid,r] of index)
      if(r?.what==='page'&&String(r.courseId)===String(ref.courseId)&&(r.home===true||r.item?.syllabus)&&open(r))await add('page',hid,r.item?.syllabus?'Course syllabus':'Course home page',5000);
    for(const fr of pick.sources||[]){
      const f=refs[fr],r=f&&index.get(f.id);
      if(open(r)&&!sources.some(s=>s.label.endsWith(r.title||'')))await add(r.what,f.id,'Course file: '+(r.title||'file'));
    }
    // Course files the AI asked for from the list; the list is offered once per item.
    for(const lid of pick.asked||[]){const fid=pick.library?.[lid],r=fid&&index.get(fid);if(open(r)&&!took.has(fid))await add(r.what,fid,'Course file: '+(r.title||'file'));}
    // The item's neighbours in its module come first, said to be beside it; then the course's newest files and pages.
    const near=(row?.neighbours||entry.neighbours||[]).filter(fid=>!took.has(fid)&&open(index.get(fid))&&['pdf','file','page','discussion'].includes(index.get(fid)?.what));
    const library=pick.asked?
      []:
      [
        ...near.map(fid=>[fid,{...index.get(fid),folderPath:'same module as this item'}]),
        ...[...index].filter(([fid,r])=>
          !near.includes(fid)&&!took.has(fid)&&['pdf','file','page'].includes(r?.what)&&String(r.courseId)===String(ref.courseId)&&r.home!==true&&!r.item?.syllabus&&open(r)).sort((a,b)=>
          String(b[1].version||'').localeCompare(String(a[1].version||'')))
      ].slice(
        0,
        40);
    if(!pick.asked)pick.library=Object.fromEntries(library.map(([fid],i)=>['L'+(i+1),fid]));
    // Google Docs the item links: read with the student's Google session where this install may; the rest stay on the card
    // as unread, so the student can paste them. A pasted text is the student's copy of one of them.
    pick.unread=[];
    for(const g of linked.slice(0,3)){
      const key=JSON.stringify({what:'google',id:g.id});
      let got=run.reads?.[key];
      if(!got){got=docs?await docs.read(g).catch(()=>({error:'private'})):{error:'paste'};run.reads||={};run.reads[key]=got;}
      if(got.text)sources.push({label:'Google Doc: '+g.title,role:'file',text:String(got.text).slice(0,30000)});else pick.unread.push({kind:g.kind,id:g.id,title:g.title,reason:got.error||'private'});
    }
    // (the paste belongs to the run's one item, whatever ref it has: H1, or the brief's A ref when the item is listed there)
    if(run.pasted&&run.pickIndex===0){
      sources.push({label:'Pasted by the student'+(run.pastedTitle?': '+run.pastedTitle:''),role:'paste',text:String(run.pasted)});
      pick.unread=pick.unread.filter(u=>u.title!==run.pastedTitle);
    }
    if(pick.unread.length)
      sources.push({
        label:'Linked but not readable',
        role:'note',
        text:pick.unread.map(u=>'"'+u.title+'" ('+(u.kind==='document'||u.kind==='published'?'Google Doc':u.kind==='presentation'?'Google Slides':'Google Sheet')+')').join('\n')+'\nIts text is not in these materials. Do not guess what it says; name it in gaps.'
      });
    // Fitted to the prompt's room. What the item names but could not be read, and what had to be cut, is said aloud, so
    // the AI cannot fill it in from the title. The brief is the item's course's own when the scan made one.
    const notes=[...new Set(unreadable)],
      fit=fitSources(
        [...sources,{label:'Canvas brief (dates, other work, teacher messages)',role:'brief',text:run.snapshot.courseBriefs?.[String(ref.courseId)]??run.snapshot.brief?.text??''}],
        {budget:41000-notes.join('\n').length-2000,title:ref.title}),
      lines=[...notes,...fit.cuts];
    sources.length=0;sources.push(...fit.sources.filter(s=>s.role!=='brief').map(({label,text})=>({label,text})));
    if(lines.length)sources.push({label:'Could not be read',text:lines.join('\n')+'\nTheir text is not in these materials. Do not guess what they say; name them in gaps.'});
    sources.push(...fit.sources.filter(s=>s.role==='brief').map(({label,text})=>({label,text})));
    const names={test:'a practice test',reading:'a reading breakdown',translate:'translation help',examples:'worked examples',outline:'an outline',auto:'help for this item'};
    run.progress='Making '+(names[pick.make]||'help')+' · '+(run.pickIndex+1)+' of '+run.picks.length;
    run.messages=[
      {
        role:'user',
        content:Study.buildDeliver(pick.make,{
          now:now(),
          timeZone:data.settings.timeZone,
          level:data.toolbox?.aiLevel,
          item:(row?.item?.courseName?row.item.courseName+' · ':'')+ref.title,
          due:row?.item?.dueAt?new Date(row.item.dueAt).toLocaleString('en-US',{timeZone:data.settings.timeZone||'UTC',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'',
          focus:pick.focus,
          sources,
          library:library.map(([,r])=>({title:r.title||'file',where:r.folderPath||''})),
          maxChars:42000,
          wishes:Study.noteText(run.instructions,pick.make,ref.id),
          fix:pick.fix,
          avoid:run.more?run.card:''
        })
      }
    ];
    run.state='asking';return save(run);
   }
   if(run.state==='applying'){
    run.progress='Preparing your cards';
    if(run.actionIndex<run.actions.length){
     const a=run.actions[run.actionIndex];
     if(a.tool==='make_aid')for(const id of a.sources?.length?a.sources:[a.itemId]){const row=new Map(run.snapshot.index).get(id);await read({what:row?.what||'assignment',id});}
     const id=run.id+'-effect-'+run.actionIndex;
     let effect=run.effects.find(e=>e.id===id);
     if(!effect){effect={id,status:'intent',actionIndex:run.actionIndex};run.effects.push(effect);await save(run);}
     await guard();
     await canvas.validate?.(run,[a.itemId,a.fileId,...(a.sources||[]),...(a.items||[]).map(i=>i.itemId)],signal);
     await guard();
     const result=await results.apply(run,run.actionIndex,reader);
     await guard();
     effect.status='applied';
     effect.entryId=result.entryId;
     if(a.tool==='make_aid'&&result.entryId&&result.outcome!=='rejected')run.aids.push({action:a,entryId:result.entryId});
     run.actionIndex++;
     return save(run);
    }
    run.phase='aid';run.state='making-aid';return save(run);
   }
   if(run.state==='making-aid'){
    if(run.aidIndex>=run.aids.length){run.state='publishing';return save(run);}
    const action=run.aids[run.aidIndex].action,index=new Map(run.snapshot.index),item=index.get(action.itemId),sources=[];
    for(const id of action.sources?.length?action.sources:[action.itemId]){
      const row=index.get(id),result=await read({what:row?.what||'assignment',id});
      if(result.error)throw Error('An aid source is unavailable. Refresh Canvas.');
      sources.push({id,label:row?.title||id,text:result.text});
    }
    const data=account.get();run.progress='Making your '+(action.kind==='reading'?'reading guide':action.kind==='practice'?'practice set':action.kind);
    run.messages.push({
      role:'user',
      content:Study.build(action.kind,{
        now:now(),
        timeZone:data.settings.timeZone,
        level:data.toolbox?.aiLevel,
        course:item?.item?.courseName||'',
        item:item?.title||'',
        due:item?.item?.dueAt||'',
        sources,
        privacy:item?.privacy,
        showGrades:run.settings.grades===true,
        wishes:run.instructions.perKindWishes[action.kind]||''
      })+
        '\nTask metadata: '+
        JSON.stringify({focus:action.focus||'',precedence:'Safety/privacy and access restrictions first; current request and Prepare standing instructions next; per-kind preferences next; defaults last.'})
    });
    run.state='asking';
    return save(run);
   }
   if(run.state==='saving-aid'){
     const turn=run.turns[run.turnIndex],aid=run.aids[run.aidIndex],parsed=Study.parse(turn.reply,aid.action.kind);
     if(!parsed.ok){
       run.state='needs-you';
       run.needsYou={reason:'Review the study reply or import a corrected reply',action:'Read reply',resumeState:'awaiting-reply'};
       run.errors.push(...parsed.errors);
       return save(run);
     }
     await guard();
     await canvas.validate?.(run,aid.action.sources||[aid.action.itemId],signal);
     await guard();
     await results.saveAid(run,aid,turn.reply,reader);
     await guard();
     run.aidIndex++;
     run.state='making-aid';
     return save(run);
   }
   if(run.state==='publishing'){
    await guard();
    await results.ensure(run);
    await account.sync();
    const result=account.get().toolbox.agent.runs.find(r=>r.id===run.id),
      entries=result?.actions||[],
      count=run.mode==='prepare'||run.mode==='ask'?
        run.cardCount||0:
        Band.cardsFrom(Band.agentAids({runs:result?[result]:[]})).length+entries.filter(e=>e.outcome==='kept'&&e.action.tool==='make_aid').length;
    run.progress='Ready · '+count+(count===1?' card':' cards');await results.publish(run);await guard();run.state='cards-ready';return save(run);
   }
   throw Error('Unknown Prepare checkpoint.');
  }
  return {step,archive:run=>results.expire(run)};
 }
 return {create,fitSources};
});
