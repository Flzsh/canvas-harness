/* Structured selection evidence shared by fitting and local inference. */
(function(root){
 'use strict';
 const list=v=>Array.isArray(v)?v:[],
   words=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[],
   stamp=v=>typeof v==='number'?v:Date.parse(v),
   own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k),
   cache=new WeakMap(),
   bodyCache=new WeakMap(),
   itemCache=new WeakMap();
 function bodyWords(row){
   const raw=row.text||row.description||row.body||row.instructions||'',old=bodyCache.get(row);
   if(old?.raw===raw)return old.words;
   const value={raw,words:new Set(words(raw))};
   bodyCache.set(row,value);
   return value.words;
 }
 const concepts={
   latest:/\b(?:latest|newest|newer|recent|recently|last|updated|update|changed|change|correction|corrected|replacement|replaces|supersed)\w*\b/i,
   unread:/\b(?:unread|not read|haven.t read|have not read)\b/i,
   early:/\b(?:first|earlier|earliest|starting|start|begin|next|soonest|sooner|priority|primero)\b/i,
   short:/\b(?:quick|quickest|short|shortest|little|only|fit|possible|minutes|mins|ratito)\b/i,
   complete:/\b(?:check off|mark.*(?:done|complete)|finished|done|completed)\b/i,
   course:/\b(?:class|course|subject)\b/i,
   page:/\b(?:this|that|current|open|selected|here|it|these)\b/i,
   notPage:/\b(?:other|instead|rather|not this|not that|replacement|newer|different)\b/i,
   initial:/\b(?:initial|first|opening|main).*\b(?:post|discussion)|\bpost.*\b(?:first|before)\b/i,
   reply:/\b(?:repl(?:y|ies)|respond|response)\b/i,
   review:/\b(?:review|completed|posted|returned|previous|feedback|comments?)\b/i,
   policy:/\b(?:policy|rule|allowed|permitted|available|window|limit|attempts?|tries|remaining|left)\b/i,
   personal:/\b(?:personal|own|my list|to.do|locally|local|check off)\b/i,
   control:/\b(?:control|menu|button|option|setting|panel|preferences|where.*choose|show.*option|bring.*control)\b/i,
   negative:/\b(?:not|without|don.t|no|never|except|rather)\b/i,
   practice:/\b(?:practi[cs]e|quiz me|test me|let me|i have to|myself|new.*(?:question|example|scenario)|fresh|imaginary)\b/i,
   generation:/\b(?:explain|unpack|summari[sz]e|rewrite|draft|invent|generate|compose|teach|interpret|diagnose|understand|why)\b/i
 };
 const timeProps=['postedAt','updatedAt','dueAt','startAt','estimate','minutes'],timeSides=['Max','Min'];
 const props=['unread','read','locked','lockAt','unlockAt','availableFrom','availableUntil','dueAt','replyDueAt','initialPostDueAt','postedAt','updatedAt','supersedesId','submissionTypes','allowedExtensions','attemptsAllowed','attemptsUsed','attemptsRemaining','timeLimit','timeLimitMinutes','pointsPossible','currentPercent','weight','requirements','prerequisites','submissionStatus','submittedAt','wordCount','groupId','members','appointmentSlots','appointments','url','teacher','authorName','downloadUrl','practiceQuizId','externalTool','outcome','rubric','assignmentId','parentId','itemId','minutes','estimate','generated','manual','completed','done','score','startAt','endAt','location','status'];
  /* Candidate additions emit finite learned evidence, never scores or destinations. */
  const metadataProps=['scope','sourceScope','visibility','pageType','gradeAccess','feedback','teacherComments','submissionComments','correctAnswersAvailableAt','answerReleaseAt','attempt','attemptId','attemptNumber','returned','reviewAvailable','recipientGroupId','recipientGroupIds','contextItemId','sourceItemId','controlForId','controlId','controlPageId','composerId','composerPageId','attachmentIds','fileIds','attachments','practiceId','practiceItemId','practicePageId','approvalId','approvalMessageId','extensionApproved','approvedDueAt','approvalStatus'],
    metadataSet=new Set(metadataProps),
    capCache=new WeakMap(),
    emptyRows=Object.freeze([]),
    kindSet=new Set('course assignment file page quiz discussion announcement grade feedback course-grade submission teacher person group canvas-module rubric syllabus event message note bookmark reminder link setting feature tab home-module action market-item aid peer-review'.split(' ')),
    sourceKinds={
      courses:'course',
      assignments:'assignment',
      workItems:'assignment',
      personalTasks:'assignment',
      tasks:'assignment',
      planner:'assignment',
      files:'file',
      materials:'file',
      pages:'page',
      quizzes:'quiz',
      discussions:'discussion',
      announcements:'announcement',
      grades:'grade',
      feedback:'feedback',
      courseGrades:'course-grade',
      courseTotals:'course-grade',
      submissions:'submission',
      teachers:'teacher',
      people:'person',
      groups:'group',
      canvasModules:'canvas-module',
      rubrics:'rubric',
      syllabi:'syllabus',
      events:'event',
      calendarEvents:'event',
      messages:'message',
      inbox:'message',
      notes:'note',
      bookmarks:'bookmark',
      reminders:'reminder',
      links:'link',
      marketItems:'market-item'
    };
  props.push(...metadataProps);
  const enumKey=v=>typeof v==='string'?words(v).join('-'):'',present=v=>v!==undefined&&v!==null&&v!==''&&v!==false&&(typeof v!=='object'||Object.keys(v).length>0),capKind=row=>{
    const raw=row.kind||row.type,k=raw==='material'?'file':raw==='planner'?'assignment':raw;
    return kindSet.has(k)?k:'other';
  },
  gradesHidden=s=>s.showGrades===false||s.settings?.showGrades===false||s.privacy?.grades===false,
  feedbackHidden=s=>s.teacherFeedback===false||s.settings?.teacherFeedback===false||s.privacy?.teacherFeedback===false||s.privacy?.feedback===false,
  totalScope=row=>
    ['course-total','course-grade','overall','overall-grade'].includes(enumKey(row.scope))||capKind(row)==='course-grade'||(capKind(row)==='grade'&&!present(row.scope)&&row.currentPercent!==undefined),
  privateRow=(row,s)=>gradesHidden(s)&&(row.gradeAccess===true||['grade','feedback','course-grade'].includes(capKind(row))||totalScope(row))||feedbackHidden(s)&&capKind(row)==='feedback';
  function evidenceProperty(row,p,s){return own(row,p)&&(!metadataSet.has(p)||!privateRow(row,s)&&(!feedbackHidden(s)||!['feedback','teacherComments','submissionComments'].includes(p)));}
  function propertyValue(p,v){
    if(!metadataSet.has(p))return typeof v==='boolean'||typeof v==='string'&&v.length<32&&!/[:/]/.test(v)?v:undefined;
    if(typeof v==='boolean')return v;
    const n=enumKey(v),
      values=p==='pageType'?['control','menu','composer','settings','preferences','attempt-review','quiz-review','returned-attempt','attempt-results','completed-attempt','practice']:['scope','sourceScope','visibility'].includes(p)?['course-total','course-grade','course','assignment','item','individual','personal','public','private']:p==='approvalStatus'?['approved','granted','pending','requested','denied','rejected','declined']:[];
    return values.includes(n)?n:undefined;
  }
  function capabilities(row,s){
    const out=new Set();
    if(privateRow(row,s))return out;
    const kind=capKind(row),
      scope=enumKey(row.sourceScope||row.visibility||row.scope),
      pageType=enumKey(row.pageType),
      total=totalScope(row),
      approval=enumKey(row.approvalStatus);
    if(total)out.add('course-total');
    if(!total&&
      (kind==='grade'||row.gradeAccess===true||row.earnedScore!==undefined||row.enteredScore!==undefined)&&
      ['score','earnedScore','enteredScore','earnedGrade','currentScore'].some(k=>row[k]!==undefined&&row[k]!==null))
      out.add('earned-grade');
    if(!feedbackHidden(s)&&(kind==='feedback'||['feedback','teacherComments','submissionComments'].some(k=>present(row[k]))))out.add('comments');
    if(['attempt-review','quiz-review','returned-attempt','attempt-results','completed-attempt'].includes(pageType)||
      row.reviewAvailable===true||
      row.returned===true||
      row.completed===true&&(kind==='quiz'||['correctAnswersAvailableAt','answerReleaseAt','attemptId','attemptNumber','attempt'].some(k=>row[k]!==undefined&&row[k]!==null)))
      out.add('attempt-review');
    if(['setting','feature','tab','home-module','action'].includes(kind)||/(?:^|-)(?:control|menu|composer|settings|preferences)(?:-|$)/.test(pageType))out.add('control');
    if(present(row.recipientGroupId)||list(row.recipientGroupIds).length)out.add('group-recipients');
    if(row.practice===true||row.graded===false||pageType==='practice')out.add('practice');
    if(['syllabus','rubric'].includes(kind)||present(row.scoringPolicy)||present(row.policy))out.add('policy');
    if(typeof row.extensionApproved==='boolean'||row.approvedDueAt!==undefined&&row.approvedDueAt!==null||['approved','granted','pending','requested','denied','rejected','declined'].includes(approval)){
      out.add('approval');
      if(['denied','rejected','declined'].includes(approval))
        out.add('approval-denied');
      else if(row.extensionApproved===false||['pending','requested'].includes(approval))
        out.add('approval-pending');
      else if(row.extensionApproved===true||['approved','granted'].includes(approval)||Number.isFinite(stamp(row.approvedDueAt)))out.add('approval-granted');
    }
    const scopes={public:'public',private:'private',personal:'personal',individual:'personal',course:'course','course-total':'course',assignment:'item',item:'item'};
    if(own(scopes,scope))out.add('scope-'+scopes[scope]);
    return out;
  }
  const operations={
    retrieve:/\b(?:open|reopen|find|fetch|locate|retrieve|pull up|bring up|take me|show|display|read|get)\b/i,
    inspect:/\b(?:inspect|check|view|look|what|which|where|when|who|does|is|are|how many|how much)\b/i,
    compose:/\b(?:compose|composer|recipients|draft|write)\b/i,
    review:/\b(?:review|returned|posted comments|original words|word for word)\b/i,
    compare:/\b(?:compare|contrast|difference|versus|vs)\b/i,
    change:/\b(?:change|edit|adjust|set|remove|delete|reset|enable|disable)\b/i,
    generate:/\b(?:explain|interpret|rewrite|rephrase|invent|generate|teach|summari[sz]e|brainstorm)\b/i,
    plan:/\b(?:plan|schedule|allocate|reserve|replan)\b/i
  },
    relationCues={
      attachment:/\b(?:attachments?|attached|handouts?|download|printable|templates?|files?)\b/i,
      practice:/\b(?:practice|practise|rehearsal|self[- ]check|sandbox|ungraded)\b/i,
      approval:/\b(?:approval|approved|extension|personal date|individual date|extra day)\b/i,
      control:/\b(?:controls?|menu|button|options?|settings?|preferences?|composer|compose|help with this)\b/i,
      recipients:/\b(?:recipients?|group message|message.{0,35}group|group.{0,35}(?:message|composer|compose))\b/i,
      comments:/\b(?:feedback|comments?|teacher.{0,25}(?:wrote|typed|said|note)|original (?:words|note)|word for word)\b/i,
      'course-total':/\b(?:course total|class total|current total|overall|class average|course average|current percentage)\b/i,
      'earned-grade':/\b(?:earned|score|mark|points|grade)\b/i,
      review:/\b(?:returned|review|completed attempt|submitted attempt|posted comments|answers)\b/i,
      policy:/\b(?:policy|policies|rule|rules|criterion|criteria|rubric|requirements|procedure)\b/i,
      source:/\b(?:original (?:source|reading|text)|source page|passage|reading itself)\b/i
    },
    linkFields={
      attachment:['attachmentIds','fileIds','attachments'],
      practice:['practiceQuizId','practiceItemId','practiceId','practicePageId'],
      approval:['approvalId','approvalMessageId'],
      control:['controlId','controlPageId','composerId','composerPageId'],
      recipients:['recipientGroupId','recipientGroupIds']
    };
   /* Phrase data extends existing operation/relation labels; forms describe speech structure only. */
   const phraseTable=data=>Object.fromEntries(Object.entries(data).map(([key,value])=>[key,value.split('|').map(v=>' '+words(v).join(' ')+' ')])),
     operationPhrases=phraseTable({
       retrieve:'bring me|pull up|abre|abrir|busca|buscar|muestra|mostrar|trae|ouvre|ouvrir|trouve|trouver|montre|montrer|affiche|afficher|lis|lire',
       inspect:'look at|view|ver|revisa|voir|regarde|consulte',
       compose:'formulate|wording|redacta|redactar|escribe|escribir|redige|ecris|ecrire',
       review:'revisa|revisar|repasa|revoir|relis',
       compare:'distinguish|compara|comparar|comparer|distingue',
       change:'match|follow|sync|adjust|cambia|cambiar|ajusta|ajustar|change|changer|ajuste|regle',
       generate:'unpack|clarify|infer|invent|explica|explicar|explicame|interpreta|inventa|explique|expliquer|interprete|invente'
     }),
     relationPhrases=phraseTable({
       attachment:'handout|archivo|archivos|adjunto|adjuntos|fichier|fichiers|piece jointe',
       practice:'ensayo|practica|practicar|exercice|entrainement',
       approval:'aprobacion|aprobado|prorroga|autorisation|approuve|prolongation',
       control:'compositor|controles|configuracion|menu|parametres|reglages',
       recipients:'destinatarios|destinataires',
       comments:'comentario|comentarios|retroalimentacion|commentaire|commentaires',
       'course-total':'promedio general|total del curso|moyenne generale|moyenne du cours',
       'earned-grade':'puntos obtenidos|nota obtenida|points obtenus|note obtenue',
       review:'intento completado|respuestas publicadas|tentative terminee|reponses publiees',
       policy:'regla|reglas|politica|criterio|criterios|regle|regles|consignes|bareme',
       source:'lectura original|texto original|texte original|source originale'
     }),
     phraseHas=(table,key,goal)=>(table[key]||[]).some(v=>goal.includes(v));
   const formSignals={
     reason:/\b(?:reasoning|inference|infer|conclusion|follows|supports?|assumes?|implies|meaning|means?|why|explain|interpret|unpack|por que|porque|razonamiento|se sigue|implica|significa|explica|explicar|pourquoi|raisonnement|explique|expliquer)\b/,
     literal:/\b(?:exact|exacta|exactas|exacto|exactos|exacte|exactes|exacts|original|verbatim|literal|posted|recorded|word for word|policy|rule|rules|requirements|instructions|deadline|due|points|attempts|status|publicado|palabras|regla|consignes|mots)\b/,
     novel:/\b(?:new|fresh|invent|imagine|make up|nuevo|nueva|nuevos|nuevas|inventa|crea|nouveau|nouvelle|invente)\b/,
     quiet:/\b(?:quiet|hush|mute|silence|silent|silencieux|silencieuse|silencia|silenciar|calla|without nudges|without interruptions|sin avisos|sans interruptions)\b/,
     alerts:/\b(?:alerts?|nudges?|reminders?|pings?|notifications?|interrupting|interruptions?|suggestions?|avisos|recordatorios|rappels)\b/,
     appearance:/\b(?:theme|colors?|colours?|spacing|rows?|lettering|font|motion|mascot|companion|pet|tema|espacio|filas|letras|movimiento|couleurs|lignes|espacement|police|mouvement)\b/,
     adjust:/\b(?:change|match|follow|sync|automatic|compact|comfortable|larger|bigger|smaller|hide|cover|less|more space|cambia|ajusta|menos|mas|ajuste|regle|automatique|plus grand|moins)\b/,
     surface:/\b(?:panel|tab|menu|settings|preferences|composer|list|market|folder|course|class|curso|cours|vista|pestana|parametres|liste|dossier|affichage)\b/,
     saved:/\b(?:saved|existing|upcoming|queued|already|guardados|guardadas|existantes|deja|enregistres)\b/
   };
   function operationForms(input,s,session){
     const c=capabilityPrepared(input,s,session),normalized=' '+words(c.goal).join(' ')+' ',q=normalized.trim().split(' ').filter(Boolean),out={};
     let masked=normalized,known=false,exact=false,partial=false,course=false;
     const matches=[];
     for(const row of c.byId.values()){
       const kind=capKind(row),labels=kind==='course'?[row.title,row.name,row.shortName,row.code,row.course_code,...list(row.aliases)]:[row.title||row.name];
       for(const label of labels){
         const name=words(label).join(' ');
         if(name.length<3)continue;
         const equal=normalized.trim()===name,mention=normalized.includes(' '+name+' '),overlap=q.length<=4&&q.length>0&&q.every(w=>name.split(' ').includes(w));
         if(kind==='course'){if(mention)course=true;continue;}
         if(mention||overlap){known=true;exact=exact||equal;partial=partial||!equal;if(mention&&(equal||name.split(' ').length>=2))matches.push(name);}
       }
     }
     for(const name of matches.sort((a,b)=>b.length-a.length))masked=masked.split(' '+name+' ').join(' entity ');
     const text=masked.trim().replace(/^(?:(?:please|pls|porfa|por favor|s il vous plait|svp)\s+)+/,'').replace(/^(?:(?:can|could|would|will) (?:you|u)|puedes|podrias|peux tu|pouvez vous)\s+/,''),
       access=/^(?:open|reopen|find|fetch|locate|retrieve|pull up|bring up|take me|show|display|read|inspect|view|list|check|get me|go to|navigate|switch to|abre|abrir|busca|buscar|muestra|mostrar|trae|ver|llevame|ir a|ouvre|ouvrir|trouve|trouver|montre|montrer|affiche|afficher|lis|lire|va au|aller au)\b/.test(text),
       signal=Object.fromEntries(Object.entries(formSignals).map(([key,re])=>[key,re.test(text)])),
       product=/\b(?:ideas?|examples?|questions?|story|explanation|wording|scenario|poem|practice|caption|explicacion|ejemplo|explication|exemple)\b/.test(text),
       nominal=q.length<=6&&known&&!access&&!signal.novel&&!signal.adjust&&!signal.reason,
       remind=/\b(?:remind me|notify me|ping me|recuerdame|avisame|rappelle moi|rappelle nous|previens moi)\b/.test(text),
       data=signal.literal||c.cues.some(v=>['comments','course-total','earned-grade','policy'].includes(v)),
       flags={
         accessReasoning:access&&signal.reason,
         accessLiteral:access&&signal.literal,
         novelOutput:signal.novel&&(product||c.ops.includes('generate')||c.ops.includes('compose')),
         quietAlerts:signal.quiet&&signal.alerts,
         preferenceChange:signal.adjust&&signal.appearance,
         surfaceAccess:access&&signal.surface,
         savedCollection:signal.saved&&(signal.alerts||signal.surface),
         reminderCreation:remind,
         courseAccess:access&&course,
         courseData:course&&data,
         knownExactTitle:exact,
         knownPartialTitle:partial,
         nominalKnown:nominal,
         nominalQuestion:nominal&&/\?/.test(input),
         selfAuthoredFollowup:/\b(?:i|we) (?:will|shall|can|need to|want to) (?:write|explain|compose|type|send|choose|draft)\b/.test(words(input).join(' '))
       };
     const selectedAnchor=c.anchors.find(v=>v.role==='selected');
     for(const [key,value]of Object.entries(flags))if(value){out['sem:form:'+key]=1;if(selectedAnchor)out['sem:form:'+key+'|selectedKind:'+capKind(selectedAnchor.row)]=1;}
     return out;
   }
   function linkIds(value){
     const out=[];
     for(const v of (Array.isArray(value)?value:[value]).slice(0,32)){
       const k=v&&typeof v==='object'?(v.id??v.itemId??v.fileId??v.contentId??v.pageId??v.groupId):v;
       if((typeof k==='string'||typeof k==='number')&&String(k))out.push(String(k));
     }
     return out;
   }
  function capabilityPrepared(input,s,session,rows=emptyRows,fresh=false){
    const selectedId=String(s.selectedItemId||s.itemId||s.page?.itemId||''),
      recentId=String(session.itemId||session.lastItemId||session.lastResult?.next?.fields?.itemId||session.lastResult?.items?.[0]?.id||''),
      key=String(input)+'\0'+selectedId+'\0'+recentId+'\0'+Number(gradesHidden(s))+'\0'+Number(feedbackHidden(s));
    let entries=capCache.get(s);
    if(!entries){entries=new Map();capCache.set(s,entries);}
    const refs=Object.keys(sourceKinds).map(k=>s[k]);
    let shared=fresh?null:entries.get(key);
    if(!shared||!refs.every((v,i)=>v===shared.refs[i])){
      const Intent=root.ReserveBiscuitIntent||(typeof module==='object'&&module.exports?require('./biscuit-intent.js'):null),
        goal=Intent?.targetText?.(input)||Intent?.requestSpan?.(input)||String(input),
        aliasGoal=' '+words(goal).join(' ')+' ',
        ops=Object.keys(operations).filter(k=>operations[k].test(goal)||phraseHas(operationPhrases,k,aliasGoal)),
        cues=Object.keys(relationCues).filter(k=>relationCues[k].test(goal)||phraseHas(relationPhrases,k,aliasGoal));
      shared={refs,goal,ops:ops.length?ops:['unspecified'],cues,views:new WeakMap()};
      if(entries.size>=8)entries.delete(entries.keys().next().value);
      if(!fresh)entries.set(key,shared);
    }
    const viewKey=Array.isArray(rows)&&rows.length?rows:emptyRows;
    const saved=shared.views.get(viewKey);
    if(saved&&saved.rows.length===viewKey.length&&saved.rows.every((row,i)=>row===viewKey[i]))return saved.prepared;
    const all=[];
    for(const [field,kind]of Object.entries(sourceKinds))for(const r of list(s[field]))if(r&&typeof r==='object')all.push(r.kind?r:{...r,kind});
    for(const r of list(rows))if(r&&typeof r==='object')all.push(r);
    const byId=new Map(),caps=new WeakMap(),edges=new Map(),available=new Set();
    for(const r of all){
      if(privateRow(r,s))continue;
      const id=String(r.id??'');
      if(id)byId.set(id,r);
      const cap=capabilities(r,s);
      caps.set(r,cap);
      for(const k of cap)available.add(k);
    }
    const edge=(role,from,to)=>{
      if(!from||!to||from===to)return;
      const put=(id,other,direction)=>{let set=edges.get(id);if(!set){set=new Map();edges.set(id,set);}set.set(role+'\0'+other+'\0'+direction,{role,other,direction});};
      put(to,from,'out');
      put(from,to,'in');
    };
    for(const r of all){
      if(privateRow(r,s))continue;
      const id=String(r.id??'');
      if(!id)continue;
      for(const [role,fields]of Object.entries(linkFields))for(const field of fields)for(const target of linkIds(r[field]))edge(role,id,target);
      const cap=caps.get(r)||capabilities(r,s);
      if(cap.has('approval'))for(const field of ['assignmentId','parentId'])for(const target of linkIds(r[field]))edge('approval',id,target);
      if(cap.has('control')){
        for(const field of ['contextItemId','sourceItemId','controlForId','assignmentId','parentId'])for(const target of linkIds(r[field]))edge('control',id,target);
        for(const target of linkIds(r.groupId))edge('recipients',id,target);
      }
    }
    const anchors=[];
    for(const [role,id]of [['selected',selectedId],['recent',recentId]])if(id&&byId.has(id))anchors.push({role,id,row:byId.get(id)});
    const normalized=' '+words(input).join(' ')+' ',
      named=[...byId.values()].map(row=>({row,name:words(row.title||row.name).join(' ')})).filter(v=>v.name.split(' ').length>=2&&normalized.includes(' '+v.name+' ')).sort((a,b)=>
        b.name.length-a.name.length).slice(
        0,
        4);
    for(const {row}of named)anchors.push({role:'named',id:String(row.id),row});
    const prepared={...shared,byId,caps,edges,anchors,available};
    shared.views.set(viewKey,{rows:viewKey.slice(),prepared});
    return prepared;
  }
  function capabilityAction(input,s,session){
    const c=capabilityPrepared(input,s,session),out={};
    for(const op of c.ops)out['sem:op:'+op]=1;
    for(const cue of c.cues)out['sem:request:'+cue]=1;
    for(const cap of c.available){out['sem:available:'+cap]=1;for(const cue of c.cues)out['sem:request:'+cue+'|available:'+cap]=1;}
    for(const a of c.anchors){
      const kind=capKind(a.row),cap=c.caps.get(a.row)||capabilities(a.row,s);
      out['sem:anchor:'+a.role+'|kind:'+kind]=1;
      for(const k of cap){
        out['sem:anchor:'+a.role+'|cap:'+k]=1;
        for(const cue of c.cues)out['sem:request:'+cue+'|anchor:'+a.role+'|cap:'+k]=1;
        for(const op of c.ops)out['sem:op:'+op+'|anchor:'+a.role+'|cap:'+k]=1;
      }
    }
    return out;
  }
  function capabilityItem(input,row,s,session,rows,preparedView){
    if(privateRow(row,s))return {};
    const c=preparedView||capabilityPrepared(input,s,session,rows),out={},kind=capKind(row),cap=c.caps.get(row)||capabilities(row,s);
    out['sem:cap:kind:'+kind]=1;
    for(const k of cap){out['sem:cap:'+k]=1;out['sem:cap:'+k+'|kind:'+kind]=1;}
    for(const op of c.ops){out['sem:op:'+op+'|kind:'+kind]=1;for(const k of cap){out['sem:op:'+op+'|cap:'+k]=1;out['sem:op:'+op+'|kind:'+kind+'|cap:'+k]=1;}}
    for(const cue of c.cues){out['sem:request:'+cue+'|kind:'+kind]=1;for(const k of cap)out['sem:request:'+cue+'|cap:'+k]=1;}
    for(const e of c.edges.get(String(row.id))?.values()||[])
      for(const a of c.anchors)
        if(a.id===e.other){
          const suffix=e.role+'|anchor:'+a.role+'|dir:'+e.direction;
          out['sem:link:'+suffix]=1;
          out['sem:link:'+e.role+'|kind:'+kind]=1;
          for(const k of cap)out['sem:link:'+e.role+'|cap:'+k]=1;
          for(const op of c.ops)out['sem:op:'+op+'|link:'+suffix]=1;
          for(const cue of c.cues)out['sem:request:'+cue+'|link:'+suffix]=1;
        }
    return out;
  }
  function selected(s,session={}){
    const id=String(s.selectedItemId||s.itemId||s.page?.itemId||session.lastItemId||'');
    if(!id)return null;
    for(const a of Object.values(s))if(Array.isArray(a)){const row=a.find(v=>v&&String(v.id)===id);if(row)return row;}
    return null;
  }
 function text(row){return [row?.title,row?.name,row?.text,row?.body,row?.description,row?.instructions].filter(v=>typeof v==='string').join(' ');}
 function prepared(input,s,session,rows,fresh=false){
   let views=cache.get(s);
   if(!views){views=new WeakMap();cache.set(s,views);}
   let m=views.get(rows);
   if(!m){m=new Map();views.set(rows,m);}
   const key=JSON.stringify([String(input),String(s.selectedItemId||s.itemId||s.page?.itemId||session.lastItemId||'')]),hit=fresh?null:m.get(key);
   if(hit&&hit.rows.length===rows.length&&hit.rows.every((row,i)=>row===rows[i]))return hit.out;
   const namedText=words(input).join(' '),
     q=[...new Set(words(input))],
     cues=Object.fromEntries(Object.entries(concepts).filter(([,re])=>re.test(input)).map(([k])=>[k,1])),
     out={q,cues,cueKeys:Object.keys(cues),page:selected(s,session),stats:{},related:new Set(),named:new Set()};
  for(const r of rows){
    for(const k of timeProps){
      const v=(k==='estimate'||k==='minutes')?Number(r[k]):stamp(r[k]);
      if(Number.isFinite(v)){
        const group=String(r.kind)+'|'+String(r.courseId||''),at=out.stats[group]||={};
        at[k+'Max']=Math.max(at[k+'Max']??-Infinity,v);
        at[k+'Min']=Math.min(at[k+'Min']??Infinity,v);
      }
    }
    const name=words(r.title).join(' ');
    if(name.length>2&&namedText.includes(name))out.named.add(String(r.id));
  }
  if(out.page)
    for(const [k,v]of Object.entries(out.page)){if(/Id$/.test(k)&&typeof v==='string')out.related.add(v);if(/Ids$/.test(k)&&Array.isArray(v))for(const id of v)out.related.add(String(id));}
  if(m.size>8)m.delete(m.keys().next().value);
  if(!fresh)m.set(key,{rows:rows.slice(),out});
  return out;
 }
 function abstractFeatures(input,s){
   const V=root.ReserveBiscuitValues||(typeof module==='object'&&module.exports?require('./biscuit-values.js'):null),
     Language=root.ReserveBiscuitLanguage||(typeof module==='object'&&module.exports?require('./biscuit-language.js'):null),
     raw=String(input),
     quantity=(V?V.normalize(raw):raw).replace(/\b\d{1,2}:\d{2}\s*(?:[ap]m)?\b/gi,' clocktime ').replace(/\b\d+(?:\.\d+)?\s*(?:minutes?|mins?|m|hours?|hrs?|h)\b/gi,' durationvalue '),
     tokens=words(quantity),
     names=[],
     seen=new Set(),
     kinds={
       courses:'course',
       assignments:'assignment',
       workItems:'assignment',
       personalTasks:'assignment',
       planner:'assignment',
       files:'file',
       materials:'file',
       pages:'page',
       notes:'note',
       announcements:'announcement',
       discussions:'discussion',
       quizzes:'quiz',
       teachers:'teacher',
       events:'event',
       calendarEvents:'event',
       rubrics:'rubric',
       grades:'grade',
       courseGrades:'grade',
       courseTotals:'grade',
       feedback:'feedback',
       people:'person',
       groups:'group',
       inbox:'message',
       messages:'message'
     },
     hidden=s.showGrades===false||s.settings?.showGrades===false||s.privacy?.grades===false;
  for(const [field,kind]of Object.entries(kinds)){
    if(hidden&&['grade','feedback'].includes(kind))continue;
    for(const v of list(s[field])){
      const labels=kind==='course'?[v.name,v.shortName,v.nickname,v.course_code,...(Language?.courseAliases?.(v)||[])]:[v.title,v.name];
      for(const label of labels){
        const a=words(label),key=a.join(' ');
        if(!a.length||
          seen.has(key)||
          a.length===1&&a[0].length<4||
          a.length===1&&['notes','grades','grade','score','scores','settings','files','pages','home','clock','week','timer','today','work','reading','practice','quiz','rubric','course','feedback','assignment','task','module'].includes(a[0]))
          continue;
        seen.add(key);
        names.push({a,kind});
      }
    }
  }
  names.sort((a,b)=>b.a.length-a.a.length);
  let changed=words(quantity).join(' ')!==words(raw).join(' ');
  const outTokens=[];
  for(let i=0;i<tokens.length;){
    const hit=names.find(n=>n.a.every((v,j)=>tokens[i+j]===v));
    if(hit){outTokens.push('entity_'+hit.kind);i+=hit.a.length;changed=true;}else outTokens.push(tokens[i++]);
  }
  const out={};
  if(changed){for(const w of outTokens)out['w:abstract:'+w]=1;for(let i=1;i<outTokens.length;i++)out['b:abstract:'+outTokens[i-1]+' '+outTokens[i]]=1;}
  return out;
 }
 function actionFeatures(input,s={},session={}){
   const out={},row=selected(s,session),q=words(input),hidden=s.showGrades===false||s.settings?.showGrades===false||s.privacy?.grades===false;
   if(hidden){out['sem:gradesOff']=1;for(const w of new Set(q))out['sem:gradesOff|'+w]=1;}
   for(const [k,re]of Object.entries(concepts))if(re.test(input))out['sem:cue:'+k]=1;
   if(row){
     out['sem:length:'+Math.min(3,Math.floor(q.length/4))+'|'+(row.kind||row.type||'item')]=1;
     const sourceText=text(row),
       genres={transcript:/\b(?:transcript|recording|seminar|mini.lesson|lecture)\b/i,worked:/\b(?:worked example|public worked|study card|public example)\b/i,criterion:/(?:criterion|criteria|rubric|markscheme)\s*:/i,draft:/\b(?:my draft|student draft|draft paragraph|personal journal)\b/i,control:/\b(?:control|setting|preference|choices|menu|switch)\b/i,practice:/\b(?:practice card|self.check|sandbox|exercise)\b/i};
     for(const [genre,re]of Object.entries(genres))if(re.test(sourceText)){out['sem:genre:'+genre]=1;for(const w of q)out['sem:genre:'+genre+'|'+w]=1;}
     const pageWords=new Set(words(sourceText));
     for(const w of pageWords)out['sem:page:'+w]=.6;
     for(const k of props)if(evidenceProperty(row,k,s))out['sem:pageHas:'+k]=1;
     for(const k of ['kind','type','workKind'])if(typeof row[k]==='string')out['sem:pageType:'+row[k]]=1;
     for(const w of q)if(pageWords.has(w))out['sem:pageOverlap:'+w]=1;
     out['sem:shortPageQuestion']=q.length<4&&/\?/.test(input)?1:0;
   }
   const query=new Set(q),matches=[];
   let maxTitle=0,maxBody=0,bestKind='';
   for(const [field,array]of Object.entries(s))
     if(Array.isArray(array))
       for(const v of array){
         if(!v||typeof v!=='object')continue;
         const title=words(v.title||v.name),
           hits=title.filter(w=>w.length>2&&query.has(w)).length,
           bodySet=bodyWords(v),
           bodyHits=q.filter(w=>w.length>3&&bodySet.has(w)).length;
         const ratio=hits/Math.max(1,title.length);
         if(ratio>maxTitle){maxTitle=ratio;bestKind=v.kind||field;}
         maxBody=Math.max(maxBody,bodyHits/Math.max(1,q.filter(w=>w.length>3).length));
         if(hits>=2||title.length===1&&hits===1)matches.push({v,field,hits,ratio:hits/Math.max(1,title.length)});
       }
   for(const cut of [.2,.4,.6,.8,1]){if(maxTitle>=cut)out['sem:groundTitle>'+cut]=1;if(maxBody>=cut)out['sem:groundBody>'+cut]=1;}
   if(bestKind){out['sem:groundKind:'+bestKind]=1;out['sem:groundShort:'+Math.min(3,Math.floor(q.length/3))+'|'+bestKind]=1;}
   matches.sort((a,b)=>b.hits-b.hits||b.ratio-a.ratio);
   for(const {v,field}of matches.slice(0,2)){
     out['sem:matchedSource:'+field]=1;
     for(const p of props)if(evidenceProperty(v,p,s))out['sem:matchedHas:'+p]=1;
     for(const w of new Set(words(text(v))))out['sem:matchedWord:'+w]=.4;
   }
   Object.assign(out,abstractFeatures(input,s));
   if(session.lastAction)out['sem:history:'+String(session.lastAction.action||session.lastAction.type||'')]=1;
   Object.assign(out,capabilityAction(input,s,session),operationForms(input,s,session));
   return out;
 }
 function legacyItemFeatures(input,row,s={},session={},rows=[]){
   const c=prepared(input,s,session,rows),
     out={},
     cueKeys=c.cueKeys,
     kind=String(row.kind),
     stats=c.stats[kind+'|'+String(row.courseId||'')]||{},
     types=new Set(words([row.kind,row.workKind,row.type].join(' '))),
     body=itemCache.get(row)||new Set(words(text(row)));
   if(!itemCache.has(row))itemCache.set(row,body);
   for(const k of cueKeys){out['sem:cue:'+k+'|'+kind]=1;for(const p of props)if(evidenceProperty(row,p,s)&&row[p]!==undefined&&row[p]!==null)out['sem:'+k+'|has:'+p]=1;}
  for(const p of props)
    if(evidenceProperty(row,p,s)&&row[p]!==undefined&&row[p]!==null){
      out['sem:has:'+p]=1;
      const v=propertyValue(p,row[p]);
      if(v!==undefined){out['sem:prop:'+p+'='+v]=1;for(const k of cueKeys)out['sem:'+k+'|'+p+'='+v]=1;}
    }
  for(const p of timeProps){
    const v=(p==='estimate'||p==='minutes')?Number(row[p]):stamp(row[p]);
    if(!Number.isFinite(v))continue;
    for(const side of timeSides)if(v===stats[p+side]){out['sem:extreme:'+p+side]=1;for(const k of cueKeys)out['sem:'+k+'|'+p+side]=1;}
    if(p==='dueAt')out['sem:dueFuture']=v>=s.now?1:0;
  }
  for(const w of c.q){for(const t of types)out['sem:q:'+w+'|type:'+t]=1;if(body.has(w))out['sem:match:'+w+'|'+kind]=1;}
  out['sem:pageLink']=c.related.has(String(row.id))?1:0;
  out['sem:named']=c.named.has(String(row.id))?1:0;
  out['sem:supersedesPage']=String(row.supersedesId||'')===String(c.page?.id||'')&&!!row.supersedesId?1:0;
  out['sem:pageNamed']=!!c.page&&String(row.id)===String(c.page.id)&&c.named.has(String(row.id))?1:0;
  if(row.assignmentId){const target=rows.find(v=>String(v.id)===String(row.assignmentId));if(target)out['sem:relatedNamed']=c.named.has(String(target.id))?1:0;}
  Object.assign(out,capabilityItem(input,row,s,session,rows));
  return out;
 }
 /* Owned requests cache plain snapshot metadata only for one synchronous scoring view.
    Public itemFeatures calls retain their original allocation and traversal path.
    The general semantic cache is keyed by row-array identity and ordered row identities,
    rather than row count; equal-sized different universes must never share statistics. */
 const itemRequests=new WeakMap();
 const requestState=(s,session)=>
   JSON.stringify([
     s.now,
     s.selectedItemId,
     s.itemId,
     s.page?.itemId,
     session.lastItemId,
     session.itemId,
     session.lastResult?.next?.fields?.itemId,
     session.lastResult?.items?.[0]?.id,
     gradesHidden(s),
     feedbackHidden(s)
   ]);
 function prepareItems(input,s={},session={},rows=[]){
  const token={},firstById=new Map();for(const row of rows){const id=String(row.id);if(!firstById.has(id))firstById.set(id,row);}
  itemRequests.set(token,{
    input:String(input),
    s,
    session,
    rows,
    state:requestState(s,session),
    semantic:prepared(input,s,session,rows,true),
    capability:capabilityPrepared(input,s,session,rows,true),
    records:new WeakMap(),
    firstById,
    cueKinds:new Map(),
    queryTypes:new Map()
  });
  return token;
 }
 function staticItem(row,s){
  const properties=[];for(const p of props)if(evidenceProperty(row,p,s)&&row[p]!==undefined&&row[p]!==null)properties.push({name:p,value:propertyValue(p,row[p])});
  const times=[];for(const p of timeProps){const value=(p==='estimate'||p==='minutes')?Number(row[p]):stamp(row[p]);if(Number.isFinite(value))times.push({name:p,value});}
  return {kind:String(row.kind),types:[...new Set(words([row.kind,row.workKind,row.type].join(' ')))],body:new Set(words(text(row))),properties,times};
 }
 function itemFeatures(input,row,s={},session={},rows=[],request){
  const owned=itemRequests.get(request);
  if(!owned||owned.input!==String(input)||owned.s!==s||owned.session!==session||owned.rows!==rows||owned.state!==requestState(s,session))
    return legacyItemFeatures(input,row,s,session,rows);
  let record=owned.records.get(row);
  if(!record){record=staticItem(row,s);owned.records.set(row,record);}
  const c=owned.semantic,out={},cueKeys=c.cueKeys,kind=record.kind,stats=c.stats[kind+'|'+String(row.courseId||'')]||{};
  let cueNames=owned.cueKinds.get(kind);if(!cueNames){cueNames=cueKeys.map(k=>'sem:cue:'+k+'|'+kind);owned.cueKinds.set(kind,cueNames);}
  for(let i=0;i<cueKeys.length;i++){const k=cueKeys[i];out[cueNames[i]]=1;for(const property of record.properties)out['sem:'+k+'|has:'+property.name]=1;}
  for(const property of record.properties){const p=property.name,v=property.value;out['sem:has:'+p]=1;if(v!==undefined){out['sem:prop:'+p+'='+v]=1;for(const k of cueKeys)out['sem:'+k+'|'+p+'='+v]=1;}}
  for(const time of record.times){
    const p=time.name,v=time.value;
    for(const side of timeSides)if(v===stats[p+side]){out['sem:extreme:'+p+side]=1;for(const k of cueKeys)out['sem:'+k+'|'+p+side]=1;}
    if(p==='dueAt')out['sem:dueFuture']=v>=s.now?1:0;
  }
  const typeKey=JSON.stringify(record.types);
  let queryTypes=owned.queryTypes.get(typeKey);
  if(!queryTypes){queryTypes=c.q.map(w=>record.types.map(t=>'sem:q:'+w+'|type:'+t));owned.queryTypes.set(typeKey,queryTypes);}
  for(let i=0;i<c.q.length;i++){const w=c.q[i];for(const key of queryTypes[i])out[key]=1;if(record.body.has(w))out['sem:match:'+w+'|'+kind]=1;}
  out['sem:pageLink']=c.related.has(String(row.id))?1:0;
  out['sem:named']=c.named.has(String(row.id))?1:0;
  out['sem:supersedesPage']=String(row.supersedesId||'')===String(c.page?.id||'')&&!!row.supersedesId?1:0;
  out['sem:pageNamed']=!!c.page&&String(row.id)===String(c.page.id)&&c.named.has(String(row.id))?1:0;
  if(row.assignmentId){const target=owned.firstById.get(String(row.assignmentId));if(target)out['sem:relatedNamed']=c.named.has(String(target.id))?1:0;}
  Object.assign(out,capabilityItem(input,row,s,session,rows,owned.capability));
  return out;
 }
 const api={actionFeatures,itemFeatures,prepareItems,abstractFeatures,selected,text,concepts};
 root.ReserveBiscuitSemantics=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
