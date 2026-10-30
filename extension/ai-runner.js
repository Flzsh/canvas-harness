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
 function create({canvas,results,account,adapter,docs=load('CanvasHarnessGoogleDocs','./google-docs.js'),now=()=>Date.now(),uuid=()=>root.crypto.randomUUID()}={}){
  async function step(run,{save,guard,signal,claimProvider}){
   await guard();const reader=run.snapshot?canvas.reader(run,signal):null;
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
    if(!result.error){run.sourceTexts||={};run.sourceTexts[result.id]=[run.sourceTexts[result.id],result.text].filter(Boolean).join('\n\n').slice(0,40000);}
    await save(run);
    return result;
   }
   if(run.state==='queued'){run.state='scanning';return save(run);}
   if(run.state==='scanning'){
    // If a worker died inside the GET scan it restarts that scan; no frozen snapshot is overwritten.
    if(run.kind==='ask'&&run.cachedBrief&&!['auto','test','reading','translate','examples'].includes(run.make)){run.snapshot={brief:run.cachedBrief,text:'',index:[],hash:''};}
    else run.snapshot=await canvas.scan(run,signal);
    await guard();
    await account.sync();
    const data=account.get();
    if(run.kind==='ask'){
     const brief=run.snapshot.brief||{text:'',refs:{}},
      refs=brief.refs||{},
      ref=Object.keys(refs).find(k=>run.itemId&&refs[k].id===String(run.itemId)),
      scrub=root.CanvasHarnessPrepareBrief?.scrub||(v=>String(v||''));
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
      if(pick?.first){run.made.push({card:pick.first,pick});pick.checked='first';delete pick.first;}
      run.pickIndex++;
      run.retries=0;
      run.state='gathering';
      return save(run);
     }
     if(response.status==='needs-you'&&response.needsYou?.action==='Try again'&&!(run.retries>=1)){
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
     if(response.status==='needs-you'&&run.phase==='deliver'&&(response.needsYou?.action==='Try again'||response.needsYou?.action==='Review draft'&&unsent)){
      run.errors.push((run.picks[run.pickIndex]?.make||'help')+': '+(response.needsYou.reason||'stopped'));
      run.pickIndex++;
      run.retries=0;
      run.state='gathering';
      return save(run);
     }
     if(response.status==='needs-you'){run.needsYou={...response.needsYou,resumeState:'awaiting-reply'};run.state='needs-you';return save(run);}
     if(response.status!=='reply')return {waiting:true};
     turn.reply=response.reply;turn.deliveryReceipt=response.receipt;run.handled=true;await save(run);
    }
    run.messages.push({role:'assistant',content:turn.reply});
    if(run.phase==='aid'){run.state='saving-aid';return save(run);}
    // Daily help: the picks lead to one deliverable each; a deliverable that cannot be read is left out, not shown.
    if(run.mode==='prepare'&&run.phase!=='deliver'){
     const picks=Study.parsePicks?.(turn.reply);
     if(picks?.ok&&picks.data.picks.length){run.picks=picks.data.picks;run.pickIndex=0;run.made=[];run.phase='deliver';run.state='gathering';return save(run);}
     if(picks?.ok){run.state='unchanged';run.progress='Nothing needs help today';return save(run);}
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
      if(first)run.made.push({card:checked.ok?checked.data:first,pick});
      run.pickIndex++;
      run.retries=0;
      run.state='gathering';
      return save(run);
     }
     const parsed=Study.parseDeliver(turn.reply,pick.make);
     // The AI asked for course files from the list: read them and ask once more, without the list.
     if(parsed.ok&&parsed.read){
      const asked=pick.asked?[]:parsed.read.filter(l=>pick.library?.[l]);
      if(asked.length){pick.asked=asked;run.retries=0;run.state='gathering';return save(run);}
      run.errors.push(pick.make+': asked for files it could not have');
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
       else{card=null;run.errors.push(pick.make+': every problem reused the assignment\'s questions, so none was kept');}
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
      if(card)run.made.push({card,pick});else if(!parsed.ok)run.errors.push(...parsed.errors.slice(0,4).map(e=>pick.make+': '+e));}
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
     if(!run.made.length){run.state='unchanged';run.progress=run.kind==='ask'?'Your AI could not make help for this item. Try Help with this again.':'Your AI could not make today\'s help. Try Daily AI help again.';return save(run);}
     // Sizes are quarters of the band (grid:4): the AI's size, else the kind's usual width (the Help card markup contract, math-render.js).
     const short=root.CanvasHarnessPrepareBrief?.courseName||(v=>String(v||'')),cards=run.made.map(({card,pick})=>{
      const ref=refs[pick.ref],row=index.get('assignment:'+ref?.courseId+':'+ref?.id),due=Date.parse(row?.item?.dueAt||''),course=short(row?.item?.courseName||'');
      return {
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
     });
     run.progress='Saving your cards';await save(run);run.cardCount=await results.saveCards(run,cards,refs,{ask:run.kind==='ask'});run.state='publishing';return save(run);
    }
    const pick=run.picks[run.pickIndex],ref=refs[pick.ref];if(!ref||ref.source){run.pickIndex++;return save(run);}
    const id='assignment:'+ref.courseId+':'+ref.id,row=index.get(id),sources=[],took=new Set(),linked=[],add=async(what,sid,label,max=14000)=>{
     took.add(sid);
     const result=await read({what,id:sid});
     if(!result.error&&String(result.text||'').trim())sources.push({label,text:String(result.text).slice(0,max)});
     for(const g of result.google||[])if(!linked.some(x=>x.id===g.id))linked.push(g);
    };
    run.progress='Reading '+ref.title;await save(run);
    if(row)await add('assignment',id,'Teacher instructions: '+ref.title);
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
    const library=pick.asked?
     []:
     [...index].filter(([fid,r])=>
      !took.has(fid)&&['pdf','file','page'].includes(r?.what)&&String(r.courseId)===String(ref.courseId)&&r.home!==true&&!r.item?.syllabus&&open(r)).sort((a,b)=>
      String(b[1].version||'').localeCompare(String(a[1].version||''))).slice(
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
     if(got.text)sources.push({label:'Google Doc: '+g.title,text:String(got.text).slice(0,14000)});else pick.unread.push({kind:g.kind,id:g.id,title:g.title,reason:got.error||'private'});
    }
    if(run.pasted&&pick.ref==='H1'){
     sources.push({label:'Pasted by the student'+(run.pastedTitle?': '+run.pastedTitle:''),text:String(run.pasted).slice(0,30000)});
     pick.unread=pick.unread.filter(u=>u.title!==run.pastedTitle);
    }
    if(pick.unread.length)
     sources.push({
      label:'Linked but not readable',
      text:pick.unread.map(u=>'"'+u.title+'" ('+(u.kind==='document'||u.kind==='published'?'Google Doc':u.kind==='presentation'?'Google Slides':'Google Sheet')+')').join('\n')+'\nIts text is not in these materials. Do not guess what it says; name it in gaps.'
     });
    sources.push({label:'Canvas brief (dates, other work, teacher messages)',text:run.snapshot.brief?.text||''});
    const names={test:'a practice test',reading:'a reading breakdown',translate:'translation help',examples:'worked examples',auto:'help for this item'};
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
 return {create};
});
