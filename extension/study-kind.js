/* Shared work facts for panel aid selection and Biscuit's legacy offers. Pure data in, facts out. */
(function(root){
 'use strict';
 const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{},text=values=>values.filter(value=>typeof value==='string').join(' ');
 const QUIZ=/\bquiz(?:zes)?\b/i,TEST=/\b(?:tests?|exams?)\b/i,FINAL=/\b(?:midterms?|final(?: exam)?)\b/i,LAB=/\b(?:labs?|laborator(?:y|ies))\b/i,DISCUSSION=/\b(?:discussions?|forums?)\b/i,ESSAY=/\b(?:essays?|papers?)\b/i;
 const SUBMISSION_QUIZ=/\bquizz?(?:es)?\b/i,SUBMISSION_DISCUSSION=/\bdiscussion\b/i,READ=/\bread(?:ing)?\b/i,READING=/\b(?:chapter|pages|article)\b|\bpp\.(?![a-z_])/i,NOTES=/\bnotes\b/i,RUBRIC=/\b(?:essays?|projects?|posters?|presentations?|reports?)\b/i;
 const OPEN_NOTES=/\b(?:open[\s\u2010-\u2015-]+notes?|notes?\s+(?:are\s+)?allowed|note[\s\u2010-\u2015-]+sheets?)\b/i,CLOSED_NOTES=/\b(?:closed[\s\u2010-\u2015-]+notes?|(?:no|without)\s+(?:a\s+)?notes?(?:[\s\u2010-\u2015-]+sheets?)?|notes?\s+(?:are\s+)?not\s+allowed|not[\s\u2010-\u2015-]+open[\s\u2010-\u2015-]+notes?)\b/i,QUIZ_TAKING=/\/quizzes\/\d+\/take(?:[/?#]|$)/i;
 const assessment=value=>QUIZ.test(value)||TEST.test(value),reading=value=>READ.test(value)||READING.test(value);
 const taking=value=>value.quizTaking===true||value.pageKind==='quiz-taking'||QUIZ_TAKING.test(text([value.url,value.pathname]));
 const originalKind=value=>typeof value.workKind==='string'?value.workKind:typeof value.kind==='string'?value.kind:'';
 const submissions=value=>text(Array.isArray(value)?value:[value]).replace(/_/g,' ');
 const timestamp=value=>typeof value==='number'?Number.isFinite(value)&&Math.abs(value)<=8640000000000000:typeof value==='string'&&!!value.trim()&&Number.isFinite(Date.parse(value));
 function legacyKind(explicit,types,name){
   if(['quiz','test','lab','discussion','essay','other'].includes(explicit))return explicit;
   if(SUBMISSION_QUIZ.test(types))return 'quiz';
   if(SUBMISSION_DISCUSSION.test(types))return 'discussion';
   const value=name+' '+types;
   return QUIZ.test(value)?'quiz':TEST.test(value)||FINAL.test(value)?'test':LAB.test(value)?'lab':DISCUSSION.test(value)?'discussion':ESSAY.test(value)?'essay':'other';
 }
 function classify(value,page){
   const v=object(value),
     original=originalKind(v),
     explicit=typeof v.kind==='string'?v.kind.toLowerCase():'',
     types=submissions(v.submissionTypes),
     name=text([v.title,v.name]),
     content=text([v.title,v.name,v.description]),
     kind=legacyKind(explicit,types,name),
     aidText=text([content,types,original]),
     rubric=explicit!=='reading'&&!['quiz','test','lab'].includes(legacyKind(explicit,types,''))&&RUBRIC.test(content)&&!assessment(content)&&!LAB.test(content)&&!READ.test(content),
     aid=assessment(aidText)||SUBMISSION_QUIZ.test(types)?'practice':LAB.test(aidText)?'lab':reading(aidText)||NOTES.test(aidText)?'reading':RUBRIC.test(aidText)?'rubric':'ask',
     noteText=content.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;|&#x0*a0;/gi,' '),
     notes=!taking(v)&&
       !taking(object(page))&&
       (['quiz','test'].includes(kind)||assessment(aidText)||FINAL.test(aidText)||SUBMISSION_QUIZ.test(types)?
         OPEN_NOTES.test(noteText)&&!CLOSED_NOTES.test(noteText):
         aid==='reading'&&reading(aidText));
   return {kind,reading:!['quiz','test','lab','essay'].includes(kind)&&reading(name),rubric,feedback:v.hasTeacherComments===true&&timestamp(v.gradedAt),aid,notes};
 }
 const inferKind=value=>classify(value).kind;
 function forSelection(items,{teacherFeedback=false}={}){
   if(!Array.isArray(items)||!items.length)return 'ask';
   let common='';
   for(const item of items){const facts=classify(item),aid=teacherFeedback===true&&facts.feedback?'fixes':facts.aid;if(aid==='ask'||common&&aid!==common)return 'ask';common=aid;}
   return common||'ask';
 }
 const level=value=>['middle school','high school','college'].includes(value)?value:'high school';
 const HELP_SHAPES=Object.freeze(['ask','practice','reading','lab','rubric','fixes','notes','steps','outline','message','summary','flashcards']),HELP_THRESHOLD=0.8,DAY=86400000;
 const line=value=>
   typeof value==='string'?
     value.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘]/g,"'").replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(
       /[_‐‑–—-]/g,
       ' ').replace(
       /\s+/g,
       ' ').trim():
     '',
   list=value=>Array.isArray(value)?value:[],
   stamp=value=>typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&value.trim()?Date.parse(value):NaN;
 const HELP_ASSESS=/\b(?:quiz(?:zes)?|tests?|exams?|examinations?|midterms?|final exams?|finals|assessments?|checkpoints?|(?:oral|knowledge|skills?|vocabulary|progress) checks?)\b|\bfinal$/,HELP_WRITE=/\b(?:essays?|papers?|drafts?|writing|written|reports?|write ups?|projects?|posters?|presentations?|compositions?|proposals?|portfolios?|rubrics?|reflections?|journals?|discussions?)\b/,HELP_READ=/\b(?:read|(?<!sight )reading|chapters?|articles?|pages? \d+|pp \d+|texts?|textbooks?|notes?|slides?|passages?|stor(?:y|ies)|poems?|manuals?|annotat(?:e|ion|ions|ing)|handbooks?|speeches|source packets?)\b/,HELP_PROBLEMS=/\b(?:problem sets?|worksheets?|exercises?|homework|problems?)\b/;
 const labWork=value=>/\b(?:labs?|laborator(?:y|ies)|experiments?|investigations?|practicals?|procedures?|apparatus|equipment|germination|filtration|titration|workshops?)\b/.test(value),
   reportWork=value=>/\b(?:reports?|write\s?ups?)\b/.test(value),
   helpTyped=c=>line(c.typed)||line(c.question),
   helpDue=v=>stamp(v.dueAt??v.due_at??v.due),
   helpBody=item=>line(text([item.instructions,item.description,item.body,item.text,item.rawText]));
 // Canvas's own submission names say how work is handed in, not what it is: "online_text_entry" is not a reading and
 // "on_paper" is not a paper, so they are matched as plain words for the route
 const SUBMIT={
   online_text_entry:'typed entry',
   online_upload:'file upload',
   online_url:'web link',
   media_recording:'recording',
   on_paper:'in person',
   external_tool:'outside tool',
   student_annotation:'annotation',
   discussion_topic:'discussion',
   online_quiz:'quiz',
   none:'',
   not_graded:''
 },
   submitWords=value=>list(value).map(v=>Object.hasOwn(SUBMIT,v)?SUBMIT[v]:v);
 const physicalWork=item=>{
   const type=line(text([item.type,item.workKind,item.kind])),body=helpBody(item);
   return labWork(type)||/\b(?:activity|setup|workshop)\b/.test(type)&&(body.match(/\b(?:attach|dampen|put|hang|mix|pour|assemble|weave|connect|heat|measure|observe|plant|record|fold|cut|sand|drill|glue|solder|sew|saw|paint|finish|build)\b/g)||[]).length>=2;
 };
 function helpItem(c){
   const w=object(c.biscuit||c.biscuitContext),items=list(c.items),id=c.itemId??w.itemId;
   return object(c.item||
     c.active||
     w.item||
     (id!=null?[...items,...list(w.items),...list(w.assignments)].find(v=>v&&String(v.id)===String(id)):null)||
     (items.length===1?items[0]:null));
 }
 function helpKey(context={}){
  const c=object(context),
    item=helpItem(c),
    type=line(text([item.type,item.workKind,item.kind,...submitWords(item.submissionTypes)])),
    title=line(text([item.title,item.name])),
    topic=type+' '+title;
  const key=v=>HELP_ASSESS.test(v)&&!/\bpre ?labs?\b/.test(v)?'assessment':labWork(v)?'lab':HELP_WRITE.test(v)?'writing':HELP_PROBLEMS.test(v)?'problems':HELP_READ.test(v)?'reading':'';
  const heading=title.includes(':')?title.split(':')[0]:'',
    headingKind=/^(?:websites?|presentations?|videos?|podcasts?|recordings?|posters?|models?)$/.test(heading)?'made':/^(?:practice|problem sets?|exercises?)$/.test(heading)?'problems':key(heading);
  const explicit=key(type.replace(/\b(?:notes?|assignments?|work|other|module|document)\b/g,''));
  return explicit==='reading'?
    'reading':
    reportWork(topic)?
      'writing':
      explicit||headingKind||key(title)||key(line(c.noteKind))||key(type)||line(item.type||item.workKind||item.kind||object(c.page).kind||c.page||'work').slice(0,60);
 }
 function helpFeedback(c,item){
  const w=object(c.biscuit||c.biscuitContext),
    f=c.feedback??item.feedback??w.feedback,
    record=object(f),
    now=stamp(c.now??w.now),
    returned=stamp(record.returnedAt??record.gradedAt??item.gradedAt),
    content=line(typeof f==='string'?f:text([record.text,...list(record.comments).map(v=>typeof v==='string'?v:object(v).text)])),
    dated=Number.isFinite(returned),
    future=dated&&Number.isFinite(now)&&returned>now,
    available=c.teacherFeedback!==false&&!future&&(!!content||f===true||item.hasTeacherComments===true&&dated);
  return {available,recent:available&&(!dated||!Number.isFinite(now)||now-returned<=7*DAY),dated};
 }
 function helpEvidence(c,item){
  const rubricValue=value=>
    value===true||
      typeof value==='string'&&!!line(value)||
      Array.isArray(value)&&value.some(rubricValue)||
      value&&typeof value==='object'&&!Array.isArray(value)&&['description','long_description','text','criteria','rows','ratings'].some(key=>rubricValue(value[key]));
  const rubricBody=helpBody(item).split(/[;.!?]+/).some(s=>/\b(?:rubric|scoring sheet|grading criteria|assessment criteria)\b|\b(?:requirements?|criteria)\s*:/.test(s)&&!/\b(?:no|without|not|unavailable|missing|absent)\b/.test(s));
  const draft=[c.draft,item.draft].some(value=>typeof value==='string'&&value.split(/[.!?;\r\n]+|<\/p>|<br\s*\/?\s*>/i).some(part=>{
    const s=line(part).replace(/^(?:(?:my |our )?(?:draft|answer|response|work)|text)\s*:\s*/,'');
    return /[\p{L}\p{N}]/u.test(s)&&!/^(?:draft|answer|response|work|untitled|tbd|todo|to do|placeholder|n\/a)$/.test(s)&&!/^(?:(?:note(?: to self)?|reminder|to ?do)\b|remember\b|(?:ask|check with|email|message|talk to)\s+(?:the |my |our )?(?:teacher|professor|tutor|instructor)\b|(?:ask|remind)\s+(?:me|myself|about|this|that)\b|(?:i|we)\s+(?:need|have|want)\s+to\s+(?:ask|remember|check with|email|message|talk to)\b)/.test(s);
  }));
  return {draft,rubric:!!(c.hasRubric===true||item.hasRubric===true||rubricValue(c.rubric)||rubricValue(item.rubric)||rubricBody)};
 }
 function helpSpelling(value){
  const words=['explain','practice','quiz','summary','summarize','checklist','rubric','feedback','procedure'];
  const near=(a,b)=>{
    if(Math.abs(a.length-b.length)>1)return false;
    let i=0;
    while(i<a.length&&a[i]===b[i])i++;
    if(i===a.length)return b.length-a.length<=1;
    if(a.length===b.length)return a.slice(i+1)===b.slice(i+1)||a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2);
    return a.length<b.length?a.slice(i)===b.slice(i+1):a.slice(i+1)===b.slice(i);
  };
  return value.replace(/\bexplane\b/g,'explain').replace(/\b[a-z]{3,12}\b/g,word=>{
    if(words.includes(word)||word==='practica'||word.length<4&&word!=='qiz')return word;
    const matches=words.filter(v=>near(word,v));
    return matches.length===1?matches[0]:word;
  });
 }
 function helpRequest(context={}){
  const c=object(context),
    item=helpItem(c),
    raw=helpSpelling(helpTyped(c)).replace(/[¿¡]/g,''),
    topic=line(text([item.type,item.workKind,item.kind,item.title,item.name,helpBody(item),c.noteKind])),
    feedback=helpFeedback(c,item).available,
    writing=reportWork(topic)||helpKey({...c,item})==='writing',
    lab=helpKey({...c,item})==='lab'||labWork(line(c.noteKind))||!['made','writing','reading','problems','assessment'].includes(helpKey({...c,item}))&&labWork(topic)||physicalWork(item),
    reading=HELP_READ.test(topic),
    {draft,rubric}=helpEvidence(c,item),
    blocked=new Set(),
    choices=[];
  if(!raw)return {shape:'',blocked};
  const social=raw.replace(/[^\p{L}\p{N}' ]/gu,' ').replace(/\s+/g,' ').trim();
  if(/^(?:(?:hi+|hello+|hey+|hiya|howdy|yo|good (?:morning|afternoon|evening))(?: there| biscuit)?|(?:thanks|thank you|thx|ty)(?: so much| for (?:your |the )?help)?|(?:goodbye|bye|see you|how are you|how's it going|what's up|sup|who are you|what can you do|(?:ask (?:this|that|it)|(?:my |a |one )?question)))$/.test(social))return {shape:'ask',blocked,confidence:0.99};
  if(reading&&/^(?:lost|words|vocab(?:ulary)?|gist|tl\s*dr|tldr|tl;dr|summary|summarise|summarize)$/.test(raw))return {shape:'reading',blocked,confidence:0.92};
  if(/^(?:setup|steps)[?!.]*$/.test(raw))return {shape:'steps',blocked,confidence:0.94};
  if(lab&&/^(?:first|next|order)[?!.]*$/.test(raw))return {shape:'lab',blocked,confidence:0.94};
  if(feedback&&/^redo[?!.]*$/.test(raw))return {shape:'fixes',blocked,confidence:0.94};
  if((writing||draft||rubric)&&/^check[?!.]*$/.test(raw))return {shape:'rubric',blocked,confidence:0.94};
  const retrieval=/\b(?:challenge me|ask me something|my ?turn|leave (?:a |some )?gaps?|fill (?:in )?(?:the )?blanks?|hide (?:my|the) (?:phrase |word )?list|answers? (?:after|later)|i try first|one \w+ at a time)\b/.test(raw)||/\b(?:give|make|show|send)\b.{0,65}\b(?:examples?|scenarios?|situations?|paragraphs?|formulas?|words?|sounds?)\b/.test(raw)&&/\b(?:let|where|i|me|us|we|answers?)\b.{0,45}\b(?:pick|choose|answer|try|identify|name|say|hidden|bottom|end)\b/.test(raw);
  let v=raw.replace(/\btl\s*;\s*dr\b/g,'tldr').replace(/\b(?:dont|dnt)\b/g,"don't").replace(/\b(?:cant|cannot)\b/g,"can't").replace(/\b(?:don't|do not|can't|couldn't|could not)\s+(?:really\s+)?(?:understand|get|follow|figure out)\b/g,'confused about').replace(/\b(?:instead of|rather than)\b/g,'not').replace(/\s+(?=(?:(?:and|so)\s+)?(?:can|could|would|will)\s+(?:you|u|we|i)\b)/g,';');
  // Waiting for the student's answer and adverbs inside narration do not retract an earlier request.
  v=v.replace(/\bmakes? no sense\b/g,'is confusing').replace(/\bwait(?=\s+(?:while|for|until|till)\b)/g,'pause').replace(/\bsorry(?=[\s,;]*(?:don't|do not)\s+include\b)/g,'').replace(/\bactually\b/g,(word,index,whole)=>{
   const before=whole.slice(0,index).trimEnd(),
     after=whole.slice(index+word.length).trimStart(),
     localized=/^(?:esquemas?|plan|planear|planificar|estructurar|organizar|preparer|faire|tarjetas?|fichas?|cartes?|pasos?|etapes?|practicar|practica|preguntame|examiname|interrogame|entrainement|entraine|interroge|teste|resumen|resume|resumir|resumer|guia|revisa|verifie|corrige|explicame|explique|hazme|ponme|dame|donne|pose|fais|faites)\b|^(?:请|帮我|给我|我要|提纲|大纲|口语提纲|演讲大纲|卡片|步骤|练习|考考我|测测我|总结|摘要|阅读指南|实验清单|检查|修改|解释)/.test(after);
   return !before||/[;,.!?]$/.test(before)||localized||/^(?:(?:just|please|only)\s+)*(?:quiz|explain|check|outline|summari[sz]e|make|give|help|repair|revise|write|email|show (?:me|us)|no|stop|cancel|don't|do not)\b/.test(after)?word:'really';
  });
  const procedural=lab&&!writing?'lab':'steps',strongest=values=>{
    const specific=values.filter(p=>p.rank>=2&&!p.generic),pool=specific.length?specific:values,rank=pool.length?Math.max(...pool.map(p=>p.rank)):0;
    return pool.filter(p=>p.rank===rank);
  };
  let pendingInstead=false;
  for(const clause of v.split(/([;,.!?]+|\b(?:but|however|actually|wait|hang on|hold on|scratch that|on second thought|i mean|sorry|never mind|nevermind|nvm)\b)/)){
   if(/^(?:actually|wait|hang on|hold on|scratch that|on second thought|i mean|sorry|never mind|nevermind|nvm)$/.test(clause)){choices.length=0;pendingInstead=false;continue;}
   const s=clause.trim();if(!s)continue;const candidates=[];
   const add=(shape,pattern,rank=3,details={})=>{
     if(shape)for(const m of s.matchAll(new RegExp(pattern.source,'g')))candidates.push({shape,start:m.index,end:m.index+m[0].length,rank,...details});
   };
   if(retrieval)add('practice',/\b(?:challenge|ask|give|show|send|make|be the|leave|fill|hide|my ?turn|i try first)\b/);
   add('practice',/\b(?:quiz(?:z)?|qz|test|drill)\s*(?:me|us|her|him|them|myself)\b|\bask\s+(?:me|us)\b.{0,35}\bquestions?\b/);
    add('practice',/\b(?:study|prepare|prep|review)\s+(?:me\s+)?for\s+(?:(?:my|our|the|a)\s+)?(?:quiz|test|exam)\b|\b(?:quiz|test|exam)\s+(?:is\s+)?(?:tomorrow|tonight|soon|today)\s+help\b/);
    add('practice',/\b(?:quiz|test|exam)\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|soon|today)\b.{0,35}\b(?:help|prep|study|cooked|worried|ready)\b/);
   add('practice',/\b(?:give|gimme|make|create|generate|set|send|want|need|try|do|have|get)\b.{0,65}\b(?:questions?|problems?|exercises?|flash\s*cards?|mock exams?|practice|practise)\b|\b(?:exam|test)\s+style\s+questions?\b|\b(?:more|similar|another|new)\s+(?:ones|problems?|questions?|examples?)\b/);
    add('practice',/\b(?:answers?|solutions?|answer key|reponses|respuestas)\b.{0,35}\b(?:hidden|bottom|end|later|separate|fin|final)\b|\b(?:hide|withhold)\b.{0,25}\b(?:answers?|solutions?)\b|\b(?:check|see|find out)\s+(?:if|what|whether|how much)\s+(?:i|we)\b.{0,35}\b(?:know|remember|get|understand|can do|can solve)\b/);
   add('practice',/\b(?:donne|pose|dame|ponme|hazme|crea)\b.{0,45}\b(?:questions?|preguntas?|exercices?|problemas?|situaciones|phrases a completer)\b/,3,{localized:true});
   add('practice',/\b(?:practice|practise|flash\s*cards?|drills?)\b/,1);
   if(/^(?:(?:please|pls|plz|can we|let's|lets|i want|i need)\s+)?(?:quiz|qz|questions|practice|practise|flash\s*cards?)(?:\s+(?:please|pls|plz|now))?$/.test(s))add('practice',/./);
   add('fixes',/\b(?:fix|correct|revise|repair|redo)\s+(?:my|our|this|these|those|the|it|them)\b|\bwhat\s+(?:(?:do|should|can)\s+(?:i|we)\s+|to\s+)(?:fix|change|edit|correct|revise)\b|\b(?:what (?:did|do) i (?:get|do) wrong|where did i go wrong)\b|\b(?:change|fix|revision|correction)\s+list\b/);
   if(feedback)add('fixes',/\b(?:repairing|revising|correcting|fixing|redoing)\b|\bhow (?:do|should|can) (?:i|we) (?:change|fix|revise|repair|correct)\b/,4);
   add('fixes',/\b(?:turn|break|make|convert|use|address|apply)\b.{0,65}\b(?:comments?|feedback|marked|corrections?)\b/);
   if(feedback){add('fixes',/\b(?:changes?|edits?|revisions?|to do|todo|next attempt|try again|marked)\b/,2);add('fixes',/\b(?:comments?|feedback|their notes|mistakes?)\b/,1);}
    add('fixes',/\b(?:returned feedback|teacher feedback)\b/,1);
    add('fixes',/\bfixes\b|\bwhat (?:are|should be) (?:my|our|the) (?:next )?(?:edits|fixes|changes)\b|\bwhat changes\b.{0,25}\b(?:redo|revision|fix) list\b/);
    add('fixes',/\bwhat do (?:the|these|their|my teacher's) comments\b.{0,30}\b(?:should|must|need to) change\b/);
    add('rubric',/\b(?:check|review|assess|evaluate|compare|score|grade|proofread|look (?:at|over))\b.{0,65}\b(?:draft|essay|writing|rubric|paper|work|photo|submission|answer|report|proposal|plan|outline|poster|presentation|text|slides?|against|points|requirements?|criteria|prompt)\b|\b(?:before i hand|before i submit|before i upload|which required|every bit covered|all the parts in)\b/,3,{check:true});
   add('rubric',/\bbefore (?:uploading|submitting|handing in)\b|\bmatch\b.{0,45}\b(?:draft(?:ed)?|written|work|proposal)\b.{0,45}\b(?:instructions?|requirements?|criteria|task sheet)\b/,4,{check:true});
   add('rubric',/\b(?:requirements?|criteria|rubric|scoring sheet)\b/,1);
    add('rubric',/\bwhat (?:required (?:pieces|parts|bits)|requirements?|criteria)\b.{0,35}\b(?:missing|missed|left|unmet)\b/,3,{check:true});
   if(draft||writing||rubric){add('rubric',/\b(?:check|review|look over)\s+(?:it|this|mine|that)\b/,3,{check:true});add('rubric',/\b(?:meet|meets|missing|missed|required pieces|covered|all the things|all the parts)\b/,2,{check:true});}
   add('reading',/\b(?:summari[sz]e|help (?:me|us) read|guide (?:me |us )?(?:through|for) (?:the |this |these )?(?:reading|chapter|text|article|source|speech|slides?|handbook)|(?:walk|guide|help|work)\b.{0,35}\bthrough\b.{0,30}\b(?:chapter|article|text|slides?|handbook|reading|argument|speech))\b/);
   add('reading',/\b(?:make|give|create|prepare)\b.{0,30}\b(?:guide|path|route)\b.{0,35}\b(?:readings?|excerpts?|texts?|articles?|slides?|stories|poems?)\b/,4);
   add('reading',/\b(?:reading (?:guide|path|plan)|summary|main (?:ideas|points)|key (?:terms|vocab(?:ulary)?))\b/,2);
   add('reading',/\b(?:guide|walk|help)(?: (?:me|us))?(?: (?:through|with))? (?:my|the|this|these|a) (?:close )?reading\b/);
    add('reading',/\b(?:understand|confused about)\s+(?:(?:the|this|my|a)\s+)?(?:reading|chapter|article|passage|poem|text|story|handbook)\b/);
    if(reading)add('reading',/\bwhere\b.{0,30}\b(?:look|focus)\b.{0,30}\b(?:each|every) (?:part|section|page)\b/);
    if(reading)add('reading',/\b(?:walk|guide)\s+(?:me|us)\s+through\s+(?:it|them|this|these|that)\b|\bline by line\b/);
    add('reading',/\b(?:break|divide|split)\b.{0,35}\b(?:section|reading|chapter|text)\b.{0,35}\bmain ideas\b|\bexplain\b.{0,30}\b(?:words|terms)\b.{0,25}\bas they appear\b/,4);
   if(reading||c.selectedText)add('reading',/\b(?:what|things?|something)\b.{0,25}\b(?:look|watch|notice|focus)\b.{0,50}\b(?:each|every|section|page|part|read|reading)\b|\b(?:as|while|before) (?:i |we )?read(?:ing)?\b|\b(?:section by section|page by page|help me read)\b/);
   add('reading',/\b(?:give|need|want|lay out)\b.{0,50}\b(?:guide|route|signposts?|main ideas)\b|\b(?:annotat\w*|guide)\b.{0,45}\b(?:each section|as i go|while i|reread|read|section|page)\b/);
    if(lab)add('lab',/\b(?:sequence|check off|tick off)\b/);
    if(lab)add('lab',/\b(?:pictures?|boxes|actions?|order)\b.{0,65}\btick\b|\b(?:lay out|order)\b.{0,60}\b(?:actions|partner does)\b/);
    add(procedural,/\b(?:check\s*list|procedure|order\b.{0,30}\b(?:actions|do|steps)|boxes to tick|what (?:do|should) (?:i|we) (?:bring|do first|do next))\b/,2);
    add(lab?'lab':'',/\b(?:materials|equipment|safety|at the bench)\b/,2);
    if(lab)add('lab',/\b(?:make|give|gimme|lay out)\b.{0,30}\b(?:list|checklist|procedure)\b|\bwhat order\b.{0,35}\bdo\b/);
    add('lab',/\b(?:(?:lab|laboratory|bench)\s+check\s*list|pre\s?lab)\b/,4);
    add('lab',/\blab\b.{0,30}\b(?:prep|prepare)\b/);
   add('message',/\b(?:e-?mail|message|msg|write to|text|dm)\b.{0,40}\b(?:teacher|professor|prof|mr|ms|mrs|dr|coach|counselor|group|partner|classmates?)\b|\b(?:write|send|draft)\b.{0,12}\b(?:teacher|professor|prof|instructor|coach|counselor|mr|ms|mrs|dr)\b.{0,12}\b(?:an? )?(?:e-?mail|message|note)\b|\b(?:ask(?:ing)?|request(?:ing)?|beg(?:ging)?)\b.{0,25}\bextension\b|\bextension\b.{0,25}\b(?:email|message|request|ask)\b|\bdraft (?:an? |the )?(?:e-?mail|message|note to)\b/);
   add('outline',/\boutline\b/);
   add('outline',/\b(?:planear|planificar|estructurar|organizar)\s+(?:mi|la|nuestra|una)\s+(?:respuesta|redaccion|ensayo|presentacion)\b|\b(?:preparer|prepare|faire|fais|faites|donne|donnez)(?: moi)?\s+(?:un|le|mon)\s+plan\b|(?:列|写|做|整理)(?:一[个份])?(?:口语|演讲|发言)?(?:提纲|大纲)/,3,{localized:true});
   add('message',/\bask (?:my |the |our )?(?:teacher|professor|prof|instructor|tutor|coach|counselor|mr|ms|mrs|dr)\b/);
   add('notes',/\bnotes? outline\b|\b(?:take|taking|set up|structure|organi[sz]e|start)\b.{0,15}\b(?:my )?notes\b|\bhelp me (?:take|write|make) (?:my )?notes\b/,4);
   if(feedback)add('fixes',/\b(?:do|get) better\b|\bnext time\b|\bimprove\b|\bwhat (?:to|should i) work on\b/,4);
    if(lab&&!writing)add('lab',/\b(?:what order|which order)\b/,4);
    add('steps',/\b(?:where|how)(?: do| should| can)? (?:i|we)(?: even| actually)? (?:start|begin)\b|\b(?:don'?t|do not|dunno) (?:know )?(?:how|where) to (?:start|begin)\b|\b(?:what are the steps|steps to|what comes before|order of (?:the )?steps)\b|\b(?:como|por donde) (?:empiezo|empezar|comienzo|arranco|arrancar|inicio|iniciar)\b|\b(?:par ou|comment) commencer\b|\bhow (?:long|much time) (?:will|would|does|should|is) (?:this|it|that)(?: take)?\b/,4);
   add('summary',/\b(?:summari[sz]e|summary|recap|sum (?:it|this|that) up|tl;?dr|tldr)\b.{0,30}\b(?:syllabus|announcements?|news|updates?|e-?mails?|messages?|what i missed)\b/,4);
   add('reading',/\bmain (?:idea|point)s? (?:of|in) (?:each|every)\b/,4);
    add('outline',/\b(?:outline|structure|organi[sz]e|plan)\s+(?:for\s+)?(?:my|the|this|an?)\s+(?:(?:discussion|oral|speaking|spoken|written)\s+)?(?:essay|paper|post|response|report|argument|writing|piece|speech|talk)\b/);
    add('outline',/\b(?:(?:oral|speaking|spoken|speech|talk)\s+(?:cue\s*(?:sheets?|cards?|notes?)|cues)|cue\s*sheets?)\b/,4);
    if(!feedback)add('steps',/\bwhat (?:do|should) (?:i|we) do first\b|\b(?:into|in) (?:small |smaller )?steps\b|\bstep by step plan\b|\bplan (?:this|the|my|our) project\b|\bto ?do list\b/);
   // Planning an output is distinct from checking it against supplied criteria.
    add('steps',/\b(?:break|divide|split)\b.{0,60}\b(?:into|in)\b.{0,25}\bsteps\b/);
    add('steps',/\b(?:(?:what(?: are)?|list|show(?: (?:me|us))?|give(?: (?:me|us))?) (?:the |my |these )?(?:(?:recording|journal|project|preparation) )?steps(?: (?:do|should) (?:i|we) (?:need|take|follow))?|(?:help (?:me|us) )?plan (?:my|the|this|our) (?:(?:practice|music|process|oral|speaking) )?(?:log|journal|recording|performance|presentation|preparation)|help (?:me|us) get started)\b/);
   if(!reading&&!HELP_READ.test(s))add('summary',/\b(?:summari[sz]e|summary|recap|sum (?:it|this|that) up|tl;?dr|tldr)\b/,4);
   add('summary',/\b(?:catch me up|what did i miss|what (?:changed|is new|'s new)|missed (?:class|school|days?))\b/);
   add('flashcards',/\bflash\s*cards?\b/,4);
    add('flashcards',/(?<!cue )\bcards\b/);
   add('ask',/\b(?:explain(?:ing)?|clarify|simplify|teach me|break (?:it|this|that) down|dumb (?:it|this) down|eli5|hint)\b/);
    // A setup request keeps its requested shape across every item type.
    add('steps',/\b(?:set(?:ting)? up|setup)\b/,3,{generic:candidates.some(p=>p.shape!=='steps'&&p.rank>=3)});
    add('steps',/\bsteps?\b/,3,{generic:true});
   // Localized choices use the same candidate ranking, negation and corrections as English.
   add('outline',/\besquemas?\b|\bplan\s+(?:de|du|pour)\s+(?:(?:un|le|mon|ce)\s+)?(?:discours|expose|dissertation|redaction|presentation)\b|(?:口语|演讲|发言)?(?:提纲|大纲)/,3,{localized:true});
   // Bare French/Spanish "plan" is a choice; English project/reading plans keep their own routes.
   if(/^(?:(?:just|only|please|no|not|without|un|le|mon|ce|pas|de|sans)\s+)*plan(?:\s+(?:please|instead|svp))?$/.test(s))add('outline',/\bplan\b/,3,{localized:true});
   add('flashcards',/\btarjetas?\b(?:\s+de\s+(?:estudio|repaso|memoria|practica))?|\bfichas? de (?:estudio|repaso)\b|\bcartes?\b(?: (?:de (?:revision|memorisation|vocabulaire)|memoire)\b)?|(?:单词|词汇|记忆|复习)卡(?:片)?|(?:练习|学习)?卡片/,4,{localized:true});
   add('steps',/\b(?:pasos?|etapes?)\b|步骤|一步一步/,3,{localized:true,generic:true});
   add('practice',/\b(?:practicar|practica|preguntame|examiname|interrogame|entrainement)\b|\bponme a prueba\b|\b(?:hazme|ponme|fais(?: moi)?)\s+(?:un\s+)?quiz\b|\b(?:entraine|interroge|teste)\s+moi\b|练习|考考我|测测我|(?:向我|对我)提问|问我问题/,3,{localized:true});
   add('summary',/\b(?:resumen|resumir|resumer)\b|\bresume\s+(?:esto|eso|ceci|cela|le|la|les)\b|总结|摘要|概括/,4,{localized:true});
   if(/^(?:(?:un|le|mon)\s+)?resume$/.test(s))add('summary',/\bresume\b/,4,{localized:true});
   add('reading',/\bguia de lectura\b|\bguide de lecture\b|阅读指南/,4,{localized:true});
   add('lab',/\blista de (?:verificacion (?:para el )?)?laboratorio\b|\bliste de verification (?:pour le |de )labo\b|实验清单/,4,{localized:true});
   add('rubric',/\b(?:revisa|revisar|verifica)\s+(?:mi|el|este)\s+(?:borrador|ensayo|trabajo|respuesta)\b|\bverifie\s+(?:mon|le|ce)\s+(?:brouillon|texte|travail|devoir)\b|检查(?:我的|这个|这份)?(?:草稿|作文|答案)/,3,{localized:true,check:true});
   add('fixes',/\bcorrige\s+(?:mi|la|esta|ma|mon)\s+(?:respuesta|borrador|travail|reponse|texte)\b|(?:修改|修正|改正)(?:我的|这个|这份)?(?:答案|草稿|作文)/,3,{localized:true});
   add('message',/\bmensaje\s+(?:al|a mi|para el)\s+(?:profesor|profesora|maestro|maestra)\b|\bmessage\s+(?:au|a mon|a ma)\s+(?:professeur|prof|enseignant|enseignante)\b|(?:给|向)老师(?:写|发)(?:一封)?(?:邮件|消息)/,3,{localized:true});
   add('ask',/\b(?:explicame|expliqueme|explique(?: moi)?)\b|解释|讲解/,3,{localized:true});
   add('ask',/\b(?:understand|confused|help me (?:learn|understand))\b/,2,{generic:true});
   add('ask',/\bin (?:plain|simple|simpler|normal) (?:words|english|language)\b/,2,{generic:true});
   add('ask',/\bdoes (?:that|this|it) mean\b/);
   add('ask',/\bwhat (?:do|would|will|should) i need\b.{0,25}\b(?:on (?:the|my|this|that) (?:final|test|exam|quiz|midterm)|to (?:get|pass|keep|have|end with) (?:an? |my )?(?:[abcdf][+-]?|grade|average|\d+)(?!\w))|\bwhat if i (?:get|got|score)\b|\b(?:raise|bring up|keep|pull up) my (?:grade|average|mark)\b/,4);
   add('ask',/\b(?:give|want|need)\b.{0,35}\b(?:explanation|meaning|hint)\b|\btell (?:me|us) (?:why|how|what)\b/);
   add('ask',/\b(?:what (?:does|is)|what's|whats|why|how (?:does|do|can|is|are)|difference between|meaning of|just tell me)\b/,/^(?:(?:please|so|ok|okay)\s+)*(?:what|what's|whats|why|how)\b/.test(s)?3:2);
   // Direct questions outrank incidental task words; explicit artifact requests still win.
    const question=/^(?:(?:please|pls|plz|so|ok|okay|and|then)\s+)*(?:(?:when|where|who|whose|which|what)\b|how\s+(?:many|much|often)\b|(?:can|could|would|will|should|may|might|must|do|does|did|is|are|am|was|were|has|have|had)\s+(?:i|we|this|that|it|there|the|my|our)\b).*/;
    const artifact=candidates.some(p=>
      p.shape!=='ask'&&
        (p.rank>=3&&(p.start===0&&!/^(?:do|does|did|is|are|am|was|were|has|have|had)\b/.test(s)||/\b(?:and|also|then|please)\s*$/.test(s.slice(0,p.start)))||
          p.check&&/^(?:do|does|did|is|are|am)\b/.test(s)&&!/^do (?:i|we) need to\b/.test(s)||
          /^(?:(?:please|pls|plz|so|ok|okay)\s+)*(?:can|could|may)\s+(?:i|we)\s+(?:please\s+)?(?:get(?!\s+better\b)|have(?!\s+to\b)|see|try(?!\s+again\b)|use)\b/.test(s)));
   if(!artifact)add('ask',question,5,{generic:true});
   candidates.sort((a,b)=>a.start-b.start||b.rank-a.rank||b.end-a.end);
   const processed=[],positive=[];
   for(const candidate of candidates){
    const previous=processed.filter(p=>(p.rank>=3||p.generic||p.denied)&&p.end<=candidate.start).at(-1),
      prefix=s.slice(previous?previous.end:0,candidate.start),
      command=[...prefix.matchAll(/\b(?:i|we)\s+(?:(?:only|just|really|now)\s+)*(?:want|need|prefer|would like)\b/g)].at(-1),
      local=command?prefix.slice(command.index+command[0].length):prefix,
      historical=/\b(?:used to|earlier|yesterday|(?:i|we|you) (?:asked|said|wanted|was going to|were going to)|the (?:word|heading|title)|called|named)\b/.test(prefix)&&!/\b(?:now|please|want|need|can|could)\b/.test(prefix);
    const ability=candidate.shape==='ask'&&
      (/\b(?:(?:i|we) (?:can|could|already)|so (?:i|we) can|so (?:i|we) have to|the type and)\s*$/.test(prefix)||retrieval&&(/\b(?:i|we)\s*$/.test(prefix)||/^\s+(?:my|our)\s+(?:choice|answer|reason)\b/.test(s.slice(candidate.end)))),
      practiceReview=candidate.shape==='fixes'&&retrieval&&!feedback;
    candidate.denied=/\b(?:don't|do not|can't|not|no|never|without)\b(?:\s+[\w']+){0,10}\s*$/.test(local)||
      /^\s*(?:please\s+)?(?:skip|avoid|stop)\b(?:\s+[\w']+){0,6}\s*$/.test(local)||
      !!(previous?.denied&&/^\s*(?:and|or)\s*$/.test(local))||
      candidate.localized&&
        (/\b(?:sin|sans|pas)\b(?:\s+[\w']+){0,10}\s*$/.test(local)||/(?:不要|别|不用|不需要|不想(?:要)?|不是要|并非要)[^;,.!?]{0,12}$/.test(local)||!!(previous?.denied&&/^\s*(?:(?:ni|y|o|et|ou)(?:\s+(?:de|des|du|el|los|las|le|la|les))?|和|或|或者|以及)\s*$/.test(local)));
    processed.push(candidate);if(historical||ability||practiceReview||candidate.shape==='practice'&&/\bwould\b.{0,40}\b(?:repeat|confusion|same)\b/.test(s.slice(candidate.end)))continue;
    if(candidates.some(other=>
      (other.rank>candidate.rank||other.rank===candidate.rank&&other.check&&!candidate.check)&&other.start<=candidate.start&&other.end>=candidate.end))
      continue;
    if(candidate.rank<3&&/\b(?:so|because|about|on)\b/.test(prefix))continue;
    if(candidate.denied){blocked.add(candidate.shape);for(let i=positive.length-1;i>=0;i--)if(positive[i].shape===candidate.shape)positive.splice(i,1);continue;}
    blocked.delete(candidate.shape);
    positive.push(candidate);
   }
   const instead=s.search(/\binstead\b/);
   if(instead>=0){
     const after=positive.filter(p=>p.start>instead),before=strongest(positive.filter(p=>p.end<=instead)),last=before.at(-1);
     if(after.length)positive.splice(0,positive.length,...after);else if(last)positive.splice(0,positive.length,...before.filter(p=>p.shape===last.shape));
     pendingInstead=true;
   }
   if(positive.length){if(pendingInstead)choices.length=0;pendingInstead=false;choices.push(...strongest(positive));}
  }
  if(/\b(?:actually|wait|scratch that|never mind|nevermind|nvm)\s*(?:no|stop|cancel|forget it)?$/.test(raw))return {shape:'',blocked:new Set(HELP_SHAPES)};
  const leading=strongest(choices.filter(v=>!blocked.has(v.shape))),chosen=leading.at(-1),check=leading.some(v=>v.shape==='rubric'&&v.check);
  if(new Set(leading.map(v=>v.shape)).size>1)return {shape:'',blocked,ambiguous:true,confidence:0.55,check};
  return {shape:chosen?.shape||'',blocked,confidence:chosen?.rank>=3?0.99:chosen?.rank===2?0.93:0.84,check};
 }
 function requestedHelp(context={}){return helpRequest(context).shape;}
 function inferHelp(context={}){
  const c=object(context),
    world=object(c.biscuit||c.biscuitContext),
    items=list(c.items),
    item=helpItem(c),
    page=line(typeof c.page==='object'?object(c.page).kind:c.page||c.pageKind||world.pageKind),
    typed=helpTyped(c),
    title=line(text([item.title,item.name])),
    type=line(text([item.type,item.workKind,item.kind,...submitWords(item.submissionTypes)])),
    body=helpBody(item),
    topic=type+' '+title,
    now=stamp(c.now??world.now),
    feedback=helpFeedback(c,item),
    request=helpRequest({...c,item}),
    key=helpKey({...c,item}),
    {draft,rubric}=helpEvidence(c,item),
    selected=!!line(c.selectedText),
    photos=list(c.photos);
  const found=(shape,confidence,reason,sources=[])=>({shape,sources:[...new Set(sources)],confidence,reason}),allow=shape=>!request.blocked.has(shape)&&shape!=='rubric';
  if(request.ambiguous)return found('ask',request.confidence,'The student requested equally specific kinds of help.',['typed']);
  if(request.shape)
    return found(
      request.shape,
      request.confidence,
      'The student asked for this help in their own words.',
      ['typed',...(selected?['selectedText']:[]),...(draft?['draft']:[]),...(photos.length?['photos']:[])]);
  // An unclear request is a request for clarification, even with a strong item or saved preference.
  const shortAnswer=/\b(?:one|two|three|[1-3])(?:\s*(?:or|to)\s*(?:two|three|[1-3]))?\s+sentences?\b|\b(?:short|brief)\s+(?:typed\s+)?(?:answers?|responses?)\b/.test(body)&&/\b(?:type|write|submit|answer|respond|text box|typed entry)\b/.test(body+' '+type);
  if(shortAnswer&&!['assessment','lab'].includes(key)&&!/\b(?:essays?|reports?|projects?|presentations?|slides?|recordings?|discussions?)\b/.test(topic)&&allow('ask'))return found('ask',0.94,'A short answer needs submission guidance and subject help.',['item.instructions','item.submissionTypes']);
  if(typed)return found('ask',0.55,'The request does not identify a specific kind of help.',['typed',...(selected?['selectedText']:[]),...(photos.length?['photos']:[])]);
  if(items.length>1&&!c.item&&!c.active&&!world.item&&c.itemId==null&&world.itemId==null){
   const decisions=items.map(v=>inferHelp({...c,item:v,items:[]})),shape=decisions[0].shape;
   return decisions.every(v=>v.shape===shape)&&allow(shape)?
     found(shape,Math.min(0.86,...decisions.map(v=>v.confidence)),'The selected work has the same purpose.',['items']):
     found('ask',0.4,'The selected materials could support different kinds of help.',['items']);
  }
  const saved=c.preference??object(c.preferences)[key],
    preference=typeof saved==='string'?saved:object(saved).shape,
    scope=object(saved),
    scoped=(!scope.key||scope.key===key)&&(!scope.kind||scope.kind===key)&&(!scope.itemId||String(scope.itemId)===String(item.id));
  if(HELP_SHAPES.includes(preference)&&scoped&&allow(preference))return found(preference,0.94,'Remembered correction for this kind of work.',['preference']);
  if(feedback.recent&&allow('fixes'))return found('fixes',feedback.dated?0.95:0.88,'Returned feedback on this work is available.',['feedback']);
  const report=reportWork(topic)||labWork(topic)&&/\b(?:write|submit|prepare|complete)\b.{0,45}\b(?:report|analysis|discussion|conclusion|write up)\b/.test(body);
  // Clear project and writing tasks may start with a plan; a rubric check needs the student's request.
  const made=/\b(?:projects?|posters?|presentations?|slides?|portfolios?|videos?|podcasts?|episodes?|recordings?|websites?|films?|models?|prototypes?|dioramas?|exhibits?)\b/.test(topic);
  if(made&&!draft&&!['lab','assessment','reading'].includes(key)&&allow('steps'))return found('steps',0.88,'Project work with no draft yet starts with its steps.',['item.title','item.instructions']);
  if(report&&key!=='reading'||rubric&&!['lab','assessment','reading'].includes(key)||key==='writing'){
   if(!draft&&!made&&(report||key==='writing')&&allow('outline'))
     return found('outline',0.88,'Written work with no draft yet starts with a plan.',['item.title','item.instructions',...(rubric?['rubric']:[])]);
  }
  if((/\b(?:announcements?|syllabus)\b/.test(type+' '+title)||/^(?:news|updates?|weekly updates?)\b/.test(title))&&!typed&&allow('summary'))return found('summary',0.86,'Announcements and course pages are summed up.',['item.title']);
  if((key==='lab'||physicalWork(item))&&allow('lab'))return found('lab',0.95,'The open work is a lab or experiment.',['item.type','item.title']);
  if(key==='assessment'&&allow('practice'))return found('practice',0.95,'The open work is an assessment.',['item.type','item.title']);
  const course=item.courseId??item.course_id??c.courseId??world.courseId,
    candidates=[c.nextAssessment,world.nextAssessment,...list(world.assignments),...items].filter(v=>v&&typeof v==='object'),
    related=candidates.filter(v=>{
    const other=v.courseId??v.course_id,until=helpDue(v)-now;
    return course!=null&&other!=null&&String(course)===String(other)&&HELP_ASSESS.test(line(text([v.title,v.name,v.type,v.kind])))&&until>=0&&until<=7*DAY;
  }).sort((a,b)=>helpDue(a)-helpDue(b)),next=related[0],due=helpDue(item),readingTask=key==='reading'||HELP_READ.test(topic);
  if(next&&(item.id||title||body)&&(!Number.isFinite(due)||due>=helpDue(next))&&allow('practice'))return found('practice',0.88,'A related assessment is coming within a week.',['nextAssessment','now']);
  if(/\b(?:from memory|without looking|without (?:looking at|seeing) the|recall|retriev\w*)\b/.test(body)&&allow('practice'))return found('practice',0.86,'The material asks the student to recall an answer.',['item.instructions']);
  if(readingTask&&allow('reading'))return found('reading',0.9,'The open material is a reading or course notes.',['item.title','page']);
  if(key==='problems'&&allow('ask'))return found('ask',0.88,'Help with a problem starts with an explanation or similar example.',['item.title']);
  const bodyShapes=[[/\b(?:conduct|perform|carry out|set up)\b.{0,35}\b(?:experiment|lab|investigation)\b|\b(?:measure|record|observe)\b.{0,45}\b(?:sample|temperature|trial|experiment)\b/,'lab'],[/\b(?:prepare|study|review|practice)\b.{0,30}\b(?:quiz|test|exam)\b/,'practice'],[/\b(?:read|reread|annotate|(?<!sight )reading)\b/,'reading'],[/\b(?:write|submit|draft|create|design)\b.{0,50}\b(?:essay|report|project|poster|presentation|proposal|paragraph|email)\b|\brubric\b/,'rubric']].filter(([pattern,shape])=>
    allow(shape)&&pattern.test(body));
  if(bodyShapes.length===1)return found(bodyShapes[0][1],0.84,'The instructions describe the work.',['item.instructions']);
  return found('ask',typed?0.55:0.4,'The available signals do not identify a more specific shape.',['page',...(typed?['typed']:[]),...(photos.length?['photos']:[])]);
 }
 const api={classify,inferKind,forSelection,level,inferHelp,requestedHelp,helpKey};
 Object.defineProperties(api,{HELP_SHAPES:{value:HELP_SHAPES},HELP_THRESHOLD:{value:HELP_THRESHOLD}});
 root.CanvasHarnessStudyKind=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
