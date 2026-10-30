/* Existing validators/inverses, with deterministic effects and target-side reconciliation. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessAIResults=api;
})(globalThis,function(root){
 'use strict';
 const load=(n,p)=>root[n]||(typeof require==='function'?require(p):null),
   Actions=load('CanvasHarnessAgentActions','./agent-actions.js'),
   Data=load('CanvasHarnessAgentData','./agent-data.js'),
   UI=load('CanvasHarnessStudyUI','./study-ui.js'),
   token=(id,n=0)=>Data.hash(id)+Data.hash(id+':effect')+String(n).padStart(4,'0'),
   entryId=id=>'a-'+token(id);
 function create({store,external,now=()=>Date.now(),url=()=>'',guard=()=>true}={}){
  const rowOf=(data,id)=>Actions.state(data).runs.find(r=>r.id===id);
  async function ensure(run){
    await store.update(data=>{
      const s=Actions.state(data);
      if(!s.runs.some(r=>r.id===run.id))
        s.runs.unshift({
          id:run.id,
          at:run.createdAt,
          automatic:true,
          grades:run.settings.grades===true,
          status:'running',
          snapshot:run.snapshot.text,
          actions:[],
          answers:[],
          errors:[]
        });
    });
  }
  function executor(run,id,reader){
    let n=0;
    return Actions.create({
      store,
      scope:run.scope,
      index:new Map(run.snapshot.index),
      modules:run.snapshot.snapshot.home,
      reader,
      external,
      now,
      url,
      guard,
      aidIdentity:true,
      uuid:()=>token(id,n++)
    });
  }
  async function reconcile(run,entry){
    if(entry.outcome!=='pending'||!entry.inverse)return;
    const inverse=JSON.parse(entry.inverse);
    if(inverse.target!=='external')return;
    const before=await external.get(inverse.key),
      value=structuredClone(before||inverse.empty),
      equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),
      at=(v,path)=>path.reduce((x,k)=>x?.[k],v),
      patches=inverse.patches;
   if(!patches.every(p=>equal(at(value,p.path),p.after))){
     if(!patches.every(p=>equal(at(value,p.path),p.before)))throw Error('This saved tool changed during recovery.');
     for(const p of patches){
       let node=value;
       for(const key of p.path.slice(0,-1))node=node[key];
       if(p.has===false)delete node[p.path.at(-1)];else node[p.path.at(-1)]=structuredClone(p.after);
     }
     await external.set(inverse.key,value,{expected:before,runId:run.id});
   }
   await store.update(d=>{rowOf(d,run.id).actions.find(e=>e.id===entry.id).outcome='kept';});entry.outcome='kept';
  }
  async function apply(run,index,reader){
    await ensure(run);
    const action=run.actions[index],id=run.id+'-effect-'+index,existing=rowOf(store.get(),run.id)?.actions.find(e=>e.effectId===id||e.id===entryId(id));
   if(existing){await reconcile(run,existing);return {entryId:existing.id,action,outcome:existing.outcome};}
   if(!run.settings.allowActions){
    if(action.tool==='make_aid'){
      const e={id:entryId(id),effectId:id,action,why:action.why,outcome:'pending'};
      await store.update(d=>rowOf(d,run.id).actions.push(e));
      return {action,entryId:e.id,outcome:'pending'};
    }
    const ex=executor(run,id,reader);
    let error='';
    try{ex.check(action,store.get(),{runId:run.id,plannedAids:run.actions.filter(a=>a.tool==='make_aid')});}catch(e){error=String(e.message||e);}
    const entry={id:entryId(id),effectId:id,action,why:action.why,outcome:error?'rejected':'card',...(error?{error}:{})};
    await store.update(d=>rowOf(d,run.id).actions.push(entry));
    return {action,entryId:entry.id,outcome:entry.outcome};
   }
   const result=await executor(run,id,reader).apply([action],run.id);
   const entry=rowOf(store.get(),run.id).actions.find(e=>e.id===entryId(id));
   return result.aids?.[0]||{action,entryId:entry?.id,outcome:entry?.outcome};
  }
  async function saveAid(run,aid,text,reader){
   await store.sync();const entry=rowOf(store.get(),run.id).actions.find(e=>e.id===aid.entryId);if(entry?.outcome==='kept')return;
   // A target mutation may commit before its run outcome. Its persisted inverse is the reconciliation receipt.
   const inverse=entry?.inverse?JSON.parse(entry.inverse):null;
   if(inverse?.target==='external'){
    const target=await external.get(inverse.key),patches=inverse.patches||[],equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    if(patches.length&&patches.every(p=>{let v=target;for(const k of p.path)v=v?.[k];return equal(v,p.after);})){
     await store.update(d=>{rowOf(d,run.id).actions.find(e=>e.id===aid.entryId).outcome='kept';});return;
    }
    if(!patches.every(p=>{let v=target;for(const k of p.path)v=v?.[k];return equal(v,p.before);}))throw Error('A saved aid changed during recovery. Review it before continuing.');
   }
   return executor(run,run.id+'-aid-'+run.aidIndex,reader).saveAid(aid.action,run.id,aid.entryId,text);
  }
  async function publish(run){
    await store.update(data=>{
      const s=Actions.state(data),r=rowOf(data,run.id);
      if(r?.publishedAt)return;
      if(r){r.status='done';r.finishedAt=now();r.publishedAt=now();}
      s.baseline=run.snapshot.baseline;
      s.lastVisitDay=run.day;
      s.daily={day:run.day,count:(s.daily?.day===run.day?s.daily.count||0:0)+1};
      s.seenChanges=[...new Set([...(s.seenChanges||[]),run.triggerKey])].slice(-100);
      s.status=run.progress;
    });
  }
  async function expire(run){
    await store.update(data=>{
      const s=Actions.state(data);
      let r=rowOf(data,run.id);
      if(!r){r={id:run.id,at:run.createdAt,automatic:true,grades:run.settings.grades===true,actions:[],answers:[],errors:[]};s.runs.unshift(r);}
      r.status='expired';
      r.actions=r.actions.filter(a=>!String(a.id).startsWith('expired-'));
    });
  }
  // Prepare's cards are saved like any study aid, so the Help band shows them with no special path. A card that
  // names a brief ref gets CH's own buttons for that item (never IDs written by the AI). Each card keeps its day, its
  // place in the AI's order and what CH knew about its item, so the band can show each day's help and rank it.
  function itemTools(card,ref){
   const Tools=load('CanvasHarnessStudyTools','./study-tools.js'),ids=Tools?.IDS;if(!ids||!ref||card.kind!=='ask')return [];
   const args={itemId:String(ref.id),courseId:String(ref.courseId)},test=/\b(test|quiz|exam|midterm|final|assessment)\b/i.test(ref.title||'');
   return [
     ...(test?[{id:ids.practice,args:{action:'practice',...args},label:'Practice set'}]:[]),
     {id:ids.canvas,args,label:'Open'},
     {id:ids.focus,args:{action:'start',minutes:25,...args},label:'Focus 25'}
   ].slice(
     0,
     3);
  }
  const validDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
  // What the run's Canvas snapshot says about a card's item: due, worth, kind and whether it is handed in. The band
  // prefers the live Canvas data; these keep a card rankable when that is not at hand. Never scores.
  function factsOf(run,ref){
   if(!ref||ref.source)return null;
   const id='assignment:'+ref.courseId+':'+ref.id,
     row=(run.snapshot?.snapshot?.items||[]).find(i=>i?.id===id),
     item=new Map(Array.isArray(run.snapshot?.index)?run.snapshot.index:[]).get(id)?.item,
     out={};
   const due=row?.dueAt??item?.dueAt;if(typeof due==='string'&&Number.isFinite(Date.parse(due)))out.dueAt=due;
   if(Number.isFinite(row?.points))out.points=row.points;
   const weight=Number(row?.assignmentGroup?.weight??row?.assignmentGroup?.groupWeight);
   if(Number.isFinite(weight)&&weight>0)out.weight=weight;
   if(typeof row?.kind==='string'&&row.kind)out.kind=row.kind.slice(0,24);if(row?.done===true)out.done=true;
   return Object.keys(out).length?out:null;
  }
  async function saveCards(run,cards,refs={},{ask=false}={}){
   const key=UI.storageKey(run.scope),day=validDay(run.day)?run.day:'',Writes=load('CanvasHarnessStudyWrites','./study-writes.js');
   const covered=new Set(cards.map(c=>c?.ref&&Object.hasOwn(refs,c.ref)?String(refs[c.ref].id):'').filter(Boolean));
   for(let attempt=0;;attempt++){
    const before=await external.get(key),map=structuredClone(before||{});
    // Earlier days' help stays, so each day's help can be found again. A new run replaces only the same day's earlier
    // cards for the items it covers again; ticked cards stay on their day.
    if(!ask)
      for(const [k,aid] of Object.entries(map)){
        if(aid?.prepare===true&&!aid.ask&&aid.runId!==run.id&&!aid.progress?.archived&&day&&aid.day===day&&aid.itemId&&covered.has(String(aid.itemId)))delete map[k];
      }
    // Answers to questions stay until archived; beyond twelve in one day the oldest of that day give way.
    else{
      const asks=Object.entries(map).filter(([,aid])=>aid?.ask===true&&!aid.progress?.archived&&(aid.day||'')===day).sort((a,b)=>(a[1].savedAt||0)-(b[1].savedAt||0));
      for(const [k] of asks.slice(0,Math.max(0,asks.length+cards.length-12)))delete map[k];
    }
    // More on a card adds the new questions or problems to that card instead of a card of its own.
    const more=ask&&run.more===true&&typeof run.cardKey==='string'?map[run.cardKey]:null,
      field=more&&cards.length===1&&more.data?.kind===cards[0].kind?{test:'questions',examples:'problems'}[cards[0].kind]:'';
    if(field&&Array.isArray(more.data[field])&&Array.isArray(cards[0][field])&&cards[0][field].length){
      map[run.cardKey]={...more,savedAt:now(),data:{...more.data,[field]:[...more.data[field],...cards[0][field]].slice(0,30),added:cards[0][field].length}};
    }
    else cards.forEach((card,i)=>{const ref=card.ref&&Object.hasOwn(refs,card.ref)?refs[card.ref]:null,tools=itemTools(card,ref);
     const facts=factsOf(run,ref),{dueAt,...known}=facts||{};
     map[(ask?'ask:':'prepare:')+run.id+':'+i]={
       v:1,
       kind:card.kind,
       itemId:ref?String(ref.id):'',
       courseId:ref?String(ref.courseId):'',
       title:card.headline||card.title||'Prepare',
       item:ref?.title||'',
       savedAt:now()+i,
       ...(day?{day}:{}),
       rank:i+1,
       ...(dueAt||card.dueAt?{dueAt:dueAt||card.dueAt}:{}),
       ...(Object.keys(known).length?{facts:known}:{}),
       data:{...card,...(tools.length?{tools}:{})},
       progress:{},
       prepare:true,
       ...(ask?{ask:true,question:String(run.question||'').slice(0,200),...(typeof run.cardKey==='string'&&run.cardKey?{about:run.cardKey}:{})}:{}),
       runId:run.id,
       ref:ref?card.ref:'',
       ...(run.settings?.grades===true?{gradeAccess:true}:{})
     };});
    // Real help for an item retires that item's older to-do style cards (archived, so they can still be brought back).
    const helped=new Set(cards.filter(c=>['test','reading','translate','examples'].includes(c.kind)&&c.ref&&refs[c.ref]).map(c=>String(refs[c.ref].id)));
    for(const [k,old] of Object.entries(map))
      if(old?.runId!==run.id&&old?.itemId&&helped.has(String(old.itemId))&&['ask','steps','summary','plan','study','example'].includes(old.kind)&&!old.progress?.archived)
        map[k]={...old,progress:{...(old.progress||{}),archived:true}};
    if(Writes?.trim)Writes.trim(map);
    try{await external.set(key,map,{expected:before,runId:run.id});return cards.length;}
    catch(error){if(attempt>=2)throw error;}
   }
  }
  return {apply,saveAid,saveCards,publish,ensure,expire};
 }
 return {create};
});
