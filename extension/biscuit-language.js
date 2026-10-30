/* Course-aware language uses packaged data and loaded metadata; bounded alias edits require explicit retrieval. */
(function(root){
 'use strict';
 const DATA_FILE='biscuit-rules/school-language.json',
   node=typeof module==='object'&&module.exports,
   list=v=>Array.isArray(v)?v:[],
   id=v=>String(v??''),
   clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim(),
   words=v=>clean(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[\p{L}\p{N}]+(?:[&/][\p{L}\p{N}]+)*\/?/gu)||[],
   key=v=>words(v).join(' '),
   escape=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),
   stamp=v=>typeof v==='number'?v:Date.parse(v),
   empty={schemaVersion:1,subjects:[]};
 function create(data=empty){
  if(data.schemaVersion!==1||!Array.isArray(data.subjects))throw Error('Invalid school language data');
  const subjects=new Map(),
    dictionary=new Map(),
    topics=new Map(),
    everyday=new Map(),
    qualifiers=new Map(),
    namesStop=new Set(data.nameStop||[]),
    queryStop=new Set(data.queryStop||[]),
    kinds=new Set(data.evidenceKinds||[]),
    profiles=new WeakMap(),
    titles=new WeakMap(),
    views=new WeakMap(),
    itemRequests=new WeakMap();
  let maxPhrase=1,maxTopic=1,maxEveryday=1,maxQualifier=1;
  const add=(index,phrase,value)=>{
    const k=key(phrase);
    if(k){if(!index.has(k))index.set(k,[]);if(!index.get(k).some(v=>v.id===value.id&&v.kind===value.kind))index.get(k).push(value);}
    return words(k).length;
  };
  for(const subject of data.subjects){if(!subject.id||subjects.has(subject.id))throw Error('Duplicate or missing school subject');subjects.set(subject.id,subject);}
  function ancestors(subjectId,seen=new Set()){
    if(seen.has(subjectId))return seen;
    const subject=subjects.get(subjectId);
    if(!subject)throw Error('Unknown school subject: '+subjectId);
    seen.add(subjectId);
    for(const parent of subject.parents||[])ancestors(parent,seen);
    return seen;
  }
  const ancestry=new Map([...subjects].map(([k])=>[k,ancestors(k)]));
  for(const subject of subjects.values()){
    for(const name of new Set([subject.label,...list(subject.names)]))maxPhrase=Math.max(maxPhrase,add(dictionary,name,{id:subject.id,kind:'subject'}));
    for(const alias of list(subject.abbr))maxPhrase=Math.max(maxPhrase,add(dictionary,alias,{id:subject.id,kind:'abbreviation'}));
    for(const topic of list(subject.topics))maxTopic=Math.max(maxTopic,add(topics,topic,{id:subject.id,kind:'topic'}));
  }
  for(const [full,aliases]of Object.entries(data.everyday||{}))
    for(const alias of aliases){everyday.set(key(alias),words(full));maxEveryday=Math.max(maxEveryday,words(alias).length);}
  for(const q of data.qualifiers||[])
    for(const alias of q.aliases){qualifiers.set(key(alias),[{id:q.id,kind:'level'}]);maxQualifier=Math.max(maxQualifier,words(alias).length);}
  const prefix=(data.prefixes||[]).map(v=>escape(v).replace(/\s+/g,'\\s+')).sort((a,b)=>b.length-a.length).join('|'),
    suffix=(data.suffixes||[]).map(v=>escape(v).replace(/\s+/g,'\\s+')).sort((a,b)=>b.length-a.length).join('|'),
    prefixRE=prefix?new RegExp('^(?:'+prefix+')(?=$|[\\s:./_\\-])\\s*[:./_\\-]*\\s*','iu'):null,
    suffixRE=suffix?new RegExp('(?:[\\s,|\\-]+|\\()(?:'+suffix+')\\)?$','iu'):null;
  function scan(tokens,index,max){
    const out=[];
    for(let i=0;i<tokens.length;i++)
      for(let n=Math.min(max,tokens.length-i);n>0;n--){
        const phrase=tokens.slice(i,i+n).join(' '),targets=index.get(phrase);
        if(targets){out.push({phrase,index:i,length:n,targets});i+=n-1;break;}
      }
    return out;
  }
  function everydayTokens(input){
    const tokens=words(input),out=[];
    for(let i=0;i<tokens.length;i++){
      let hit=false;
      for(let n=Math.min(maxEveryday,tokens.length-i);n>0;n--){
        const replacement=everyday.get(tokens.slice(i,i+n).join(' '));
        if(replacement){out.push(...replacement);i+=n-1;hit=true;break;}
      }
      if(!hit)out.push(tokens[i]);
    }
    return out;
  }
  function analyze(input){
    const raw=String(input??'').slice(0,4096),
      tokens=words(raw),
      references=scan(tokens,dictionary,maxPhrase).filter(v=>!queryStop.has(v.phrase)||v.phrase.length>2||new RegExp('(?:^|\\W)'+escape(v.phrase.toUpperCase())+'(?:$|\\W)').test(raw)),
      topicReferences=scan(tokens,topics,maxTopic),
      levels=[...new Set([...scan(tokens,qualifiers,maxQualifier).flatMap(v=>v.targets.map(x=>x.id)),...references.flatMap(v=>data.aliasQualifiers?.[v.phrase]||[])])],
      normalized=everydayTokens(raw);
    return {input:raw,tokens,text:normalized.join(' '),normalized, references,topicReferences,levels};
  }
  function shortCourseName(course){
   if(!course||typeof course!=='object')course={name:course};
   const nickname=[course.nickname,course.nickName,course.shortName].map(clean).find(Boolean);
   if(nickname)return nickname;
   const original=clean(course.name||course.title||course.courseName||course.course_code||course.code),
     trimTail=value=>
       value.replace(/\s*[([](?:[\s-]*)[)\]]/g,'').replace(/\s*[([]?\b(?:section|sec|period|block|semester|sem|term|quarter|qtr)\.?\s*[-:#]?\s*[\p{L}\p{N}]+[)\]]?\s*$/iu,'').replace(/\s*[([](?:s[12]|q[1-4]|t[1-4]|20\d{2}(?:[-/](?:20)?\d{2})?)[)\]]\s*$/i,'').replace(/\s*[-–—|]\s*(?:s[12]|q[1-4]|t[1-4]|0\d|20\d{2})\s*$/i,'').replace(/[\s:–—|_-]+$/,'').trim();
   let name=original.replace(/[\u00ae\u2122]/g,'').replace(/\b(20\d{2})\s*[-/]\s*(?:20)?\d{2}\b/g,' ').replace(/\b(?:fall|spring|summer|winter|autumn)\s*20\d{2}\b/gi,' ').replace(/\b20\d{2}\s*(?:fall|spring|summer|winter|autumn)\b/gi,' ');
   for(let n=0;n<4;n++)name=trimTail(name);
   for(const teacher of [course.teacher,course.teacherName,...list(course.teachers).map(v=>typeof v==='string'?v:v?.name)]){
     const full=clean(teacher);
     if(!full)continue;
     for(const part of new Set([full,full.replace(/^(?:mr|mrs|ms|dr|prof)\.?\s+/i,''),full.split(/\s+/).at(-1)])){
       if(part.length<3)continue;
       name=name.replace(new RegExp('(?:\\s*[-–—|:/]\\s*|\\s*\\()(?:'+escape(part)+')\\)?\\s*$','iu'),'');
     }
   }
   name=name.replace(/\s*[-–—|]\s*(?:(?:teacher|instructor|professor)\s*:\s*|(?:mr|mrs|ms|dr|prof)\.?\s+).+$/iu,'');for(let n=0;n<4;n++)name=trimTail(name);
   const code=/^(?:[\p{L}]{2,8})\s*[-:]?\s*\d{2,4}[a-z]?(?:\s*[-.:–—|]\s*|\s+)(?:\d{1,2}\s*[-:–—|]\s*)?(?=\p{L})/iu;
   for(let n=0;n<8;n++){const next=name.replace(code,'').replace(prefixRE||/$^/,'').replace(/^[\s:–—|_-]+/,'').trim();if(next===name)break;name=next;}
   for(let n=0;n<4;n++){const next=trimTail(name.replace(suffixRE||/$^/,''));if(next===name)break;name=next;}
   name=name.replace(/\s*[([](?:[\s-]*)[)\]]/g,'').replace(/\s+/g,' ').trim();
   return name||original;
  }
  /* Bounded value templates retain strings/numbers only, never course/snapshot objects.
     The full existing signature is the key. Public profiles get fresh mutable containers;
     the same-object WeakMap hit remains first, including its existing mutation semantics. */
  const profileValues=new Map();let profileValueSize=0;
  function profileValueEligible(course){
   try{
     const prototype=Object.getPrototypeOf(course),constructor=prototype&&Object.getOwnPropertyDescriptor(prototype,'constructor');
     if(prototype!==null&&(!constructor||typeof constructor.value!=='function'||constructor.value.name!=='Object'||constructor.value.prototype!==prototype))return false;
     const fields=['id','courseId','course_id','name','title','courseName','nickname','nickName','shortName','course_code','code','teacher','teacherName'],descriptors=Object.getOwnPropertyDescriptors(course);
     for(const field of fields){
       const d=descriptors[field];
       if(!d)continue;
       if(!Object.hasOwn(d,'value')||d.value!=null&&typeof d.value!=='string'&&(!['id','courseId','course_id'].includes(field)||typeof d.value!=='number'))return false;
       if(String(d.value??'').includes('\u0001'))return false;
     }
    for(const field of ['teachers','aliases','subject','subjects','topics']){
      const d=descriptors[field];
      if(!d)continue;
      if(!Object.hasOwn(d,'value'))return false;
      const value=d.value;
      if(value==null||typeof value==='string')continue;
      if(!Array.isArray(value))return false;
      for(const property of Object.values(Object.getOwnPropertyDescriptors(value)))if(!Object.hasOwn(property,'value'))return false;
      for(const entry of value){
        if(typeof entry==='string')continue;
        if(field!=='teachers'||!entry||typeof entry!=='object')return false;
        const parent=Object.getPrototypeOf(entry),ctor=parent&&Object.getOwnPropertyDescriptor(parent,'constructor');
        if(parent!==null&&(!ctor||typeof ctor.value!=='function'||ctor.value.name!=='Object'||ctor.value.prototype!==parent))return false;
        for(const property of Object.values(Object.getOwnPropertyDescriptors(entry)))
          if(!Object.hasOwn(property,'value')||property.value!==null&&typeof property.value==='object'||typeof property.value==='function')return false;
        if(entry.name!=null&&typeof entry.name!=='string')return false;
      }
    }
    return true;}catch{return false;}
  }
  function profileFromValue(value,course){
    const courseId=id(course.id??course.courseId??course.course_id);
    return {
      id:courseId,
      courseId,
      name:value.name,
      shortName:value.shortName,
      aliases:new Map(value.aliases),
      subjects:new Set(value.subjects),
      ancestors:new Set(value.ancestors),
      topicNames:value.topicNames.slice(),
      levels:value.levels.slice(),
      course
    };
  }
  function rememberProfileValue(signature,profile){
   const value={
     name:profile.name,
     shortName:profile.shortName,
     aliases:[...profile.aliases].map(pair=>Object.freeze(pair)),
     subjects:[...profile.subjects],
     ancestors:[...profile.ancestors],
     topicNames:profile.topicNames.slice(),
     levels:profile.levels.slice()
   },
     strings=[value.name,value.shortName,...value.aliases.map(pair=>pair[0]),...value.subjects,...value.ancestors,...value.topicNames,...value.levels];
   if(strings.some(part=>typeof part!=='string')||value.aliases.some(pair=>typeof pair[1]!=='number'))return;
   const size=signature.length+strings.reduce((sum,part)=>sum+part.length,0)+value.aliases.length*8;
   if(size>32768)return;
   for(const key of ['aliases','subjects','ancestors','topicNames','levels'])Object.freeze(value[key]);
   Object.freeze(value);
   while(profileValues.size>=256||profileValueSize+size>1048576){
     const oldest=profileValues.keys().next().value;
     if(oldest===undefined)break;
     profileValueSize-=profileValues.get(oldest).size;
     profileValues.delete(oldest);
   }
   profileValues.set(signature,{value,size});
   profileValueSize+=size;
  }
  function courseProfile(course){
   const signature=[
     course.name,
     course.title,
     course.courseName,
     course.nickname,
     course.nickName,
     course.shortName,
     course.course_code,
     course.code,
     course.teacher,
     course.teacherName,
     JSON.stringify(course.teachers||[]),
     JSON.stringify(course.aliases||[]),
     JSON.stringify(course.subject||''),
     JSON.stringify(course.subjects||[]),
     JSON.stringify(course.topics||[])
   ].join('\u0001'),
     cached=profiles.get(course);
   if(cached?.signature===signature)return cached.profile;
   const eligible=profileValueEligible(course),saved=eligible&&profileValues.get(signature);
   if(saved){const profile=profileFromValue(saved.value,course);profiles.set(course,{signature,profile});return profile;}
   const courseId=id(course.id??course.courseId??course.course_id),
     shortName=shortCourseName(course),
     name=clean(course.name||course.title||course.courseName||shortName),
     aliases=new Map(),
     put=(value,strength=1)=>{
     const k=key(value);
     if(k&&!queryStop.has(k)&&!/^\d+$/.test(k))aliases.set(k,Math.max(strength,aliases.get(k)||0));
   },
   sources=[
     shortName,
     name,
     course.nickname,
     course.nickName,
     course.shortName,
     ...(Array.isArray(course.aliases)?course.aliases:[course.aliases])
   ].map(clean).filter(Boolean);
   for(const value of sources){
     put(value,1);
     const tokens=words(value),meaningful=tokens.filter(w=>!namesStop.has(w)&&!queryStop.has(w)&&!/^\d+$/.test(w));
     for(const w of meaningful){put(w,meaningful.length===1?1:.75);if(w.length>=5&&/^[a-z]+$/.test(w))for(let n=3;n<=Math.min(6,w.length-1);n++)put(w.slice(0,n),.55);}
     if(meaningful.length>1){
       const initials=meaningful.map(w=>[...w][0]).join('');
       if(initials.length>=2&&initials.length<=10){
         put(initials,.8);
         for(const q of scan(words(name),qualifiers,maxQualifier))if(['ap','ib'].includes(q.targets[0].id))put(q.targets[0].id+initials,.8);
       }
       const syllables=meaningful.map(w=>/^[a-z]+$/.test(w)?(w.match(/^[^aeiou]*[aeiou]+[^aeiou]?/i)?.[0]||w.slice(0,3)):w);
       if(syllables.every(w=>w.length>=2))put(syllables.join(' '),.65);
     }
   }
   for(const value of [course.course_code,course.code]){put(value,1);put(clean(value).replace(/\s+/g,''),1);}
   const splitCode=value=>clean(value).replace(/([\p{L}])(\d)/gu,'$1 $2'),
     metadata=[course.subject,...list(course.subjects)].filter(v=>typeof v==='string'),
     detected=[shortName,name,course.course_code,course.code,...metadata].filter(Boolean).flatMap(value=>scan(words(splitCode(value)),dictionary,maxPhrase)),
     ownSubjects=new Set(detected.flatMap(v=>v.targets.map(t=>t.id))),
     allSubjects=new Set();
   for(const subject of ownSubjects)for(const parent of ancestry.get(subject)||[])allSubjects.add(parent);
   for(const value of metadata)if(!scan(words(value),dictionary,maxPhrase).length)put(value,.75);
   const topicNames=(Array.isArray(course.topics)?course.topics:[course.topics]).filter(v=>typeof v==='string').map(key).filter(Boolean),
     levels=[...new Set(scan(words(name+' '+clean(course.course_code||course.code)),qualifiers,maxQualifier).flatMap(v=>v.targets.map(t=>t.id)))],
     profile={id:courseId,courseId,name,shortName,aliases,subjects:ownSubjects,ancestors:allSubjects,topicNames,levels,course};
   if(eligible)rememberProfileValue(signature,profile);
   profiles.set(course,{signature,profile});
   return profile;
  }
  function courseAliases(course){return [...courseProfile(typeof course==='object'&&course?course:{name:course}).aliases.keys()];}
  function titleProfile(row){
    const title=clean(row.title||row.name),cached=titles.get(row);
    if(cached?.title===title)return cached;
    const tokens=everydayTokens(title),terms=new Set(tokens.filter(w=>!queryStop.has(w)&&!/^\d+$/.test(w))),result={title,tokens,terms};
    titles.set(row,result);
    return result;
  }
  function courseIndex(s={},rows=[]){
   const courses=new Map(),courseSources=[...list(s.courses),...rows.filter(v=>v.kind==='course')];
   for(const course of courseSources){
     const courseId=id(course.id??course.courseId??course.course_id);
     if(!courseId||courses.has(courseId))continue;
     courses.set(courseId,courseProfile(course));
   }
   const aliases=new Map();
   let maxAlias=1;
   for(const profile of courses.values())
     for(const [phrase,strength]of profile.aliases){
       if(!aliases.has(phrase))aliases.set(phrase,[]);
       aliases.get(phrase).push({id:profile.id,kind:'name',strength});
       maxAlias=Math.max(maxAlias,words(phrase).length);
     }
   const items=[],seen=new Set(),addItem=(row,kind,inherited)=>{
     if(!row||typeof row!=='object'||!kinds.has(kind))return;
     const courseId=id(row.courseId??row.course_id??inherited);
     if(!courses.has(courseId))return;
     const title=clean(row.title||row.name);
     if(!title)return;
     const rowId=id(row.id??row.itemId),dedup=courseId+'\u0001'+rowId+'\u0001'+title;
     if(seen.has(dedup))return;
     seen.add(dedup);
     items.push({row,id:rowId,courseId,kind,...titleProfile(row)});
   };
   for(const row of rows)addItem(row,row.kind==='course-module'?'canvas-module':row.kind);
   for(const [field,kind]of Object.entries({
     workItems:'assignment',
     assignments:'assignment',
     modules:'module',
     canvasModules:'canvas-module',
     courseModules:'canvas-module',
     quizzes:'quiz',
     discussions:'discussion',
     pages:'page',
     files:'file'
   }))
     for(const row of list(s[field])){
       addItem(row,kind);
       if(kind==='module'||kind==='canvas-module')for(const child of list(row.items))addItem(child,child.type==='Module'?'module':'assignment',row.courseId??row.course_id);
     }
   for(const course of list(s.courses))
     for(const [field,kind]of [['modules','module'],['assignments','assignment']])
       for(const row of list(course[field])){addItem(row,kind,course.id);if(kind==='module')for(const child of list(row.items))addItem(child,'assignment',course.id);}
   return {courses,aliases,maxAlias,items};
  }
  /* Only an explicit short retrieval can request repair. Edits use raw own
     aliases only. Existing exact derived/subject/topic/work evidence is a
     handoff to its original owner, never a new fuzzy alias or course. */
  const retrievalNouns=[
   ['homework',['assignment'],['homework']],['assignment',['assignment']],['assignments',['assignment']],['work',['assignment']],
   ['worksheet',['assignment'],['worksheet']],['project',['assignment'],['project']],['presentation',['assignment'],['presentation']],
   ['reading',['assignment'],['reading']],['essay',['assignment'],['essay']],['vocabulary',['assignment'],['vocabulary']],
   ['practice',['assignment'],['practice']],['lab report',['assignment'],['lab','lab report']],['lab',['assignment'],['lab','lab report']],
   ['quiz',['assignment','quiz'],['quiz']],['exam',['assignment','quiz'],['exam']],
   ['file',['file']],['files',['file']],['page',['page']],['pages',['page']],['syllabus',['syllabus']],
   ['announcement',['announcement']],['announcements',['announcement']],['annc',['announcement']],['message',['message']],['messages',['message']],['inbox',['message']],
   ['discussion',['discussion']],['discussions',['discussion']]
  ];
  const retrievalStops=new Set(('course courses class classes outside shared collab group groups linked external online a an the my our your this that it its same selected current previous prior first second third last next other all any only actual original latest newest new old due today tomorrow tonight yesterday not no never dont do does did rather instead than except excluding without ignore unless if suppose what why how who when where can could would should will may note notes write jot record save add make create draft compose send reply forward remind reminder focus timer plan schedule complete mark remove delete set turn hide enable disable explain summarize summarise summary translate help steps ai guide walkthrough fix fixes outline flashcards summarize summarise').split(' '));
  function oneAliasEdit(a,b){
   if(a===b||Math.abs(a.length-b.length)>1)return false;
   if(a.length===b.length){
     const different=[];
     for(let i=0;i<a.length;i++)if(a[i]!==b[i])different.push(i);
     return different.length===1||different.length===2&&different[1]===different[0]+1&&a[different[0]]===b[different[1]]&&a[different[1]]===b[different[0]];
   }
   const shorter=a.length<b.length?a:b,longer=a.length<b.length?b:a;
   let i=0;
   while(i<shorter.length&&shorter[i]===longer[i])i++;
   return shorter.slice(i)===longer.slice(i+1);
  }
  function courseAliasCandidates(request,rows=[]){
   return list(rows).filter(row=>
     !(row.kind==='assignment'&&row.itemId&&id(row.itemId)!==id(row.id)&&Number.isFinite(stamp(row.startAt??row.start))&&Number.isFinite(stamp(row.endAt??row.end)))&&
       (!request.courseId||id(row.courseId)===request.courseId)&&
       request.kinds.includes(row.kind)&&
       (!request.work||row.kind!=='assignment'||(()=>{
    const typed=everydayTokens(row.workKind||row.genre||'').join(' ');if(typed&&typed!=='assignment')return request.work.includes(typed);
    const title=' '+everydayTokens(row.title).join(' ')+' ';return request.work.some(word=>title.includes(' '+word+' '));
   })()));
  }
  function courseAliasRequest(input,s={},rows=[]){
   const raw=String(input??'').trim();
   if(!raw||raw.length>160||words(raw).length>6||/^(?:take|go|jump|bring)\s+(?:me\s+)?(?:to|into|up)\b/i.test(raw)||/["'\u2018\u2019\u201c\u201d`]/u.test(raw))return null;
   let text=raw.toLowerCase().replace(/\s*[.!?]$/,'').replace(/^(?:please|pls)\s+/,'').replace(/\s+(?:please|pls)$/,'').replace(/^(?:open|find|show|read|retrieve)\s+(?:me\s+)?(?:the\s+)?/,'').replace(
     /\s+(?:due|deadline|points|attempts|tries)$/,
     '');
   if(!/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(text)||words(text).some(word=>retrievalStops.has(word)))return null;
   const nouns=new Map(retrievalNouns.map(([noun,kinds,work])=>[noun,{noun,kinds,work}]));
   for(const [full,aliases]of Object.entries(data.everyday||{})){const target=nouns.get(key(full));if(target)for(const alias of aliases)nouns.set(key(alias),target);}
   let request=null,alias='';for(const [phrase,value]of [...nouns].sort((a,b)=>b[0].length-a[0].length)){
    if(text.endsWith(' '+phrase)){alias=text.slice(0,-phrase.length-1).trim();request=value;break;}
    if(text.startsWith(phrase+' ')){alias=text.slice(phrase.length+1).replace(/^(?:for|in|from)\s+/,'').trim();request=value;break;}
   }
   if(!request||!alias||alias.split(/\s+/).some(word=>retrievalStops.has(word)))return null;
   const aliases=new Map(),courses=new Map(),aliasKey=value=>clean(value).toLowerCase();
   for(const course of list(s.courses)){
    const courseId=id(course?.id??course?.courseId??course?.course_id);if(!courseId)continue;courses.set(courseId,course);
    const own=[
      course.name,
      course.title,
      course.courseName,
      course.nickname,
      course.nickName,
      course.shortName,
      course.course_code,
      course.code,
      ...(Array.isArray(course.aliases)?course.aliases:[course.aliases])
    ];
    for(const value of own){
      if(typeof value!=='string')continue;
      const name=aliasKey(value);
      if(!name)continue;
      if(!aliases.has(name))aliases.set(name,new Set());
      aliases.get(name).add(courseId);
    }
   }
   const exact=aliases.get(alias),targets=new Set(exact||[]),evidence=[],relationshipEvidence=[];
   if(exact)evidence.push(alias);
   else {
    /* Exact existing evidence outranks a proposed edit, but never uses score,
       active/last course, a teacher, a generic noun or file count as proof. */
    const teacherTerms=new Set();
    for(const course of courses.values())
      for(const teacher of [course.teacher,course.teacherName,...list(course.teachers).map(value=>typeof value==='string'?value:value?.name)])
        if(typeof teacher==='string'){teacherTerms.add(key(teacher));for(const word of words(teacher))teacherTerms.add(word);}
    const lexical=value=>clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(),
      contains=value=>(' '+lexical(value)+' ').includes(' '+alias+' '),
      references=analyze(alias).references.filter(reference=>reference.phrase===alias);
    if(alias===key(alias)&&!nouns.has(alias)&&!teacherTerms.has(alias)){
     for(const [courseId,course]of courses){
      const names=[course.name,course.title,course.courseName].filter(value=>typeof value==='string').map(name=>
        words(shortCourseName({name,teacher:course.teacher,teacherName:course.teacherName,teachers:course.teachers})).filter(word=>!teacherTerms.has(word)).join(' ')),
        profile=courseProfile({
          id:courseId,
          name:names[0]||'',
          aliases:[...names.slice(1),...(Array.isArray(course.aliases)?course.aliases:[course.aliases])].filter(value=>typeof value==='string'),
          nickname:course.nickname,
          nickName:course.nickName,
          shortName:course.shortName,
          course_code:course.course_code,
          code:course.code,
          subject:course.subject,
          subjects:course.subjects,
          topics:course.topics
        });
      if(profile.aliases.has(alias))relationshipEvidence.push({courseId,kind:'derived-alias',phrase:alias});
      if(references.some(reference=>reference.targets.some(target=>profile.ancestors.has(target.id))))relationshipEvidence.push({courseId,kind:'subject',phrase:alias});
      if((Array.isArray(course.topics)?course.topics:[course.topics]).some(value=>typeof value==='string'&&lexical(value)===alias))
        relationshipEvidence.push({courseId,kind:'topic',phrase:alias});
     }
     for(const row of courseAliasCandidates(request,rows))
       if(courses.has(id(row.courseId))&&
         ['assignment','quiz','discussion'].includes(row.kind)&&
         [row.title,row.text,row.body,row.description,row.instructions].some(value=>typeof value==='string'&&contains(value)))
         relationshipEvidence.push({courseId:id(row.courseId),kind:'work',phrase:alias,targetKey:JSON.stringify([id(row.courseId),row.kind,id(row.id)])});
    }
    if(relationshipEvidence.length)for(const proof of relationshipEvidence)targets.add(proof.courseId);
    else if(/^[a-z]{2,32}$/.test(alias))for(const [name,ids]of aliases)if(/^[a-z]{2,32}$/.test(name)&&oneAliasEdit(alias,name)){evidence.push(name);for(const courseId of ids)targets.add(courseId);}
   }
   const courseIds=[...targets],status=courseIds.length>1?'ambiguous':courseIds.length===1?exact?'exact':relationshipEvidence.length?'relationship':'typo':'unknown';
   if(status==='unknown'&&alias.split(/\s+/).length>1)return null;
   return {
     ...request,
     kinds:request.kinds.slice(),
     ...(request.work?{work:request.work.slice()}:{}),
     alias,
     status,
     courseId:courseIds.length===1?courseIds[0]:'',
     courseIds,
     evidence,
     relationshipEvidence,
     alternatives:courseIds.map(courseId=>({courseId,name:clean(courses.get(courseId)?.nickname||courses.get(courseId)?.name||courseId)}))
   };
  }
  function prepareView(s={},rows=[]){const token={};views.set(token,{s,rows:rows.slice(),index:courseIndex(s,rows)});return token;}
  function prepare(input,s={},session={},rows=[],view){
   const cached=views.get(view),
     index=cached?.s===s&&cached.rows.length===rows.length&&cached.rows.every((row,i)=>row===rows[i])?cached.index:courseIndex(s,rows),
     analysis=analyze(input),
     direct=scan(analysis.tokens,index.aliases,index.maxAlias).filter(v=>
       !queryStop.has(v.phrase)||v.phrase.length>2||new RegExp('(?:^|\\W)'+escape(v.phrase.toUpperCase())+'(?:$|\\W)').test(analysis.input)),
     query=[...new Set(analysis.normalized.filter(w=>!queryStop.has(w)&&!/^\d+$/.test(w)))],
     page=id(s.selectedItemId||s.itemId||s.page?.itemId),
     lastItem=id(session.lastItemId||session.itemId||session.lastResult?.next?.fields?.itemId||session.lastResult?.items?.[0]?.id),
     open=id(s.activeCourseId||s.currentCourseId||s.courseId||s.page?.courseId||index.items.find(v=>v.id===page)?.courseId),
     last=id(session.lastCourseId||
       session.courseId||
       session.lastAction?.fields?.courseId||
       session.lastResult?.next?.fields?.courseId||
       session.lastResult?.items?.[0]?.courseId||
       index.items.find(v=>v.id===lastItem)?.courseId),
     now=stamp(s.now),
     rowEvidence=new Map(),
     titleEvidence=new Map(),
     due=new Map();
   for(const item of index.items){
     const hits=query.filter(w=>item.terms.has(w)).length,coverage=hits/Math.max(1,query.length);
     if(hits){
       const evidence={id:item.id,courseId:item.courseId,kind:item.kind,title:item.title,coverage};
       rowEvidence.set(item.courseId+'\u0001'+item.id,evidence);
       const current=titleEvidence.get(item.courseId);
       if(!current||coverage>current.coverage)titleEvidence.set(item.courseId,evidence);
     }
     const when=stamp(item.row.dueAt??item.row.due_at??item.row.startAt),left=(when-now)/86400000;
     if(Number.isFinite(left)&&left>=0&&!item.row.done&&!item.row.completed){const soon=1/(1+left);due.set(item.courseId,Math.max(due.get(item.courseId)||0,soon));}
   }
   const matches=[];
   for(const profile of index.courses.values()){
     let name=0,nameExact=0;
     for(const reference of direct)
       for(const target of reference.targets)
         if(target.id===profile.id){
           name=Math.max(name,target.strength);
           if(reference.phrase===key(profile.shortName)||reference.phrase===key(profile.name)||reference.phrase===key(profile.course.nickname||profile.course.nickName))
             nameExact=1;
         }
    let abbreviation=0,subject=0,topic=0;
    const evidence=[];
    for(const reference of analysis.references){
      const targets=reference.targets.filter(v=>profile.ancestors.has(v.id));
      if(targets.length){
        if(targets.some(v=>v.kind==='abbreviation'))abbreviation=1;else subject=1;
        evidence.push({kind:targets.some(v=>v.kind==='abbreviation')?'abbreviation':'subject',phrase:reference.phrase,subjects:targets.map(v=>v.id)});
      }
    }
    for(const reference of analysis.topicReferences){
      const targets=reference.targets.filter(v=>profile.ancestors.has(v.id));
      if(targets.length){topic=1;evidence.push({kind:'topic',phrase:reference.phrase,subjects:targets.map(v=>v.id)});}
    }
    for(const phrase of profile.topicNames)if((' '+analysis.text+' ').includes(' '+phrase+' ')){topic=1;evidence.push({kind:'topic',phrase,source:'course-metadata'});}
    const title=titleEvidence.get(profile.id),titleMatch=title?.coverage||0;
    if(!(name||abbreviation||subject||topic||titleMatch))continue;
    const levelMatch=analysis.levels.length?analysis.levels.filter(v=>profile.levels.includes(v)).length/analysis.levels.length:0,
      levelMismatch=analysis.levels.length&&profile.levels.length?analysis.levels.some(v=>!profile.levels.includes(v)):false;
    if(title)evidence.push({kind:'title',...title});
    const active=profile.id===open?1:0,
      recent=profile.id===last?1:0,
      soon=due.get(profile.id)||0,
      semantic=5*nameExact+2*name+2.5*abbreviation+2*subject+3.5*topic+4*titleMatch+levelMatch-3*Number(levelMismatch),
      score=semantic+.35*active+.25*recent+.1*soon;
    matches.push({
      id:profile.id,
      courseId:profile.id,
      name:profile.name,
      shortName:profile.shortName,
      subjects:[...profile.subjects],
      nameMatch:name,
      nameExact,
      abbreviation,
      subject,
      topic,
      titleEvidence:titleMatch,
      moduleEvidence:title&&['module','canvas-module'].includes(title.kind)?titleMatch:0,
      assignmentEvidence:title&&['assignment','quiz','discussion','planner'].includes(title.kind)?titleMatch:0,
      levelMatch,
      levelMismatch:Number(levelMismatch),
      active,
      last:recent,
      soon,
      semantic,
      score,
      evidence
    });
   }
   matches.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
   const top=matches[0],
     ambiguous=matches.length>1&&Math.abs(top.score-matches[1].score)<.08,
     recognized=!!(analysis.references.length||analysis.topicReferences.length||direct.length||titleEvidence.size||matches.some(v=>v.topic)),
     byCourse=new Map(matches.map(v=>[v.id,v]));
   return {
     ...analysis,
     index,
     matches,
     byCourse,
     rowEvidence,
     recognized,
     hasReference:recognized,
     ambiguous,
     needsClarification:ambiguous,
     unknownSingle:analysis.tokens.length===1&&!recognized,
     courseId:top&&!ambiguous?top.id:'',
     preferredCourseId:top?.id||'',
     alternatives:matches.slice(1)
   };
  }
  function resolveCourses(input,s={},session={},rows=[]){
    const p=prepare(input,s,session,rows);
    return {
      courseId:p.courseId,
      preferredCourseId:p.preferredCourseId,
      matches:p.matches,
      alternatives:p.alternatives,
      ambiguous:p.ambiguous,
      needsClarification:p.needsClarification,
      recognized:p.recognized,
      unknownSingle:p.unknownSingle,
      message:!p.matches.length?
        (p.recognized?'No matching course is loaded.':'Which course or item do you mean?'):
        p.ambiguous?'Which course do you mean: '+p.matches.slice(0,3).map(v=>v.shortName).join(' or ')+'?':''
    };
  }
  function normalize(input,s,session={},rows=[]){
    const a=analyze(input),p=s?prepare(input,s,session,rows):null,out=[];
    for(let i=0;i<a.tokens.length;i++){
      const reference=a.references.find(v=>v.index===i);
      if(reference){
        const candidates=[...new Set(reference.targets.filter(v=>!p||p.matches.some(c=>p.index.courses.get(c.id)?.ancestors.has(v.id))).map(v=>v.id))];
        if(candidates.length===1){out.push(...words(subjects.get(candidates[0]).label));i+=reference.length-1;continue;}
      }
      let found=false;
      for(let n=Math.min(maxEveryday,a.tokens.length-i);n>0;n--){
        const replacement=everyday.get(a.tokens.slice(i,i+n).join(' '));
        if(replacement){out.push(...replacement);i+=n-1;found=true;break;}
      }
      if(!found)out.push(a.tokens[i]);
    }
    return out.join(' ');
  }
  function actionFeatures(input,s={},session={}){
    const a=analyze(input),out={};
    for(const w of a.normalized)out['lang:w:'+w]=1;
    for(let i=1;i<a.normalized.length;i++)out['lang:b:'+a.normalized[i-1]+' '+a.normalized[i]]=1;
    for(const ref of a.references)for(const target of ref.targets){out['lang:subject:'+target.id]=1;if(target.kind==='abbreviation')out['lang:abbreviation']=1;}
    if(a.topicReferences.length)out['lang:topic']=1;
    for(const q of a.levels)out['lang:level:'+q]=1;
    return out;
  }
  function legacyItemFeatures(input,row,s={},session={},rows=[],prepared){
    const p=prepared?.language||prepared?.byCourse&&prepared||prepare(input,s,session,rows),
      courseId=id(row.kind==='course'?row.id:row.courseId??row.course_id),
      match=p.byCourse.get(courseId),
      out={};
    if(p.unknownSingle)out['lang:unknownSingle']=1;
    if(p.recognized&&!match)out['lang:courseMismatch']=1;
    if(p.ambiguous)out['lang:ambiguous']=1;
    if(match){
      for(const [name,value]of Object.entries({
        course:1,
        name:match.nameMatch,
        exact:match.nameExact,
        abbreviation:match.abbreviation,
        subject:match.subject,
        topic:match.topic,
        title:match.titleEvidence,
        module:match.moduleEvidence,
        assignment:match.assignmentEvidence,
        level:match.levelMatch,
        levelMismatch:match.levelMismatch,
        active:match.active,
        last:match.last,
        soon:match.soon
      })){
        if(value){out['lang:'+name]=value;out['lang:'+name+':'+(row.kind||'item')]=value;}
      }
      const title=p.rowEvidence.get(courseId+'\u0001'+id(row.id));
      if(title)out['lang:itemTitle']=title.coverage;
      if(p.preferredCourseId===courseId)out['lang:preferred']=1;
    }
    return out;
  }
  /* Private synchronous request templates; public calls retain fresh objects and getter traversal. */
  function prepareItems(prepared,s,session,rows){
    const token={};
    if(prepared?.byCourse&&prepared?.rowEvidence)itemRequests.set(token,{prepared,s,session,rows,templates:new Map()});
    return token;
  }
  function itemFeatures(input,row,s={},session={},rows=[],prepared,request){
   const state=itemRequests.get(request),p=prepared?.language||prepared?.byCourse&&prepared;
   if(!state||state.s!==s||state.session!==session||state.rows!==rows||state.prepared!==p||typeof row.kind!=='string')
     return legacyItemFeatures(input,row,s,session,rows,prepared);
   const courseId=id(row.kind==='course'?row.id:row.courseId??row.course_id),kind=row.kind||'item',key=JSON.stringify([courseId,kind]);let template=state.templates.get(key);
   if(!template){
     const match=p.byCourse.get(courseId),base={};
     if(p.unknownSingle)base['lang:unknownSingle']=1;
     if(p.recognized&&!match)base['lang:courseMismatch']=1;
     if(p.ambiguous)base['lang:ambiguous']=1;
    if(match)
      for(const [name,value]of Object.entries({
        course:1,
        name:match.nameMatch,
        exact:match.nameExact,
        abbreviation:match.abbreviation,
        subject:match.subject,
        topic:match.topic,
        title:match.titleEvidence,
        module:match.moduleEvidence,
        assignment:match.assignmentEvidence,
        level:match.levelMatch,
        levelMismatch:match.levelMismatch,
        active:match.active,
        last:match.last,
        soon:match.soon
      })){
        if(value){base['lang:'+name]=value;base['lang:'+name+':'+kind]=value;}
      }
    template={base,matched:!!match,preferred:p.preferredCourseId===courseId};state.templates.set(key,template);
   }
   const out={...template.base};
   if(template.matched){const title=p.rowEvidence.get(courseId+'\u0001'+id(row.id));if(title)out['lang:itemTitle']=title.coverage;if(template.preferred)out['lang:preferred']=1;}
   return out;
  }
  return {
    data,
    words,
    analyze,
    normalize,
    everydayTokens,
    shortName:shortCourseName,
    shortCourseName,
    courseAliases,
    courseIndex,
    courseAliasRequest,
    courseAliasCandidates,
    prepareView,
    prepare,
    prepareItems,
    resolveCourses,
    actionFeatures,
    itemFeatures
  };
 }
 let current=create(node?require('./'+DATA_FILE):root.ReserveBiscuitLanguageData||empty),pending=null;
 const api={DATA_FILE,create,configure(data){
   current=create(data);
   return api;
 },load(read){
   if(pending)return pending;
   if(!read&&node)return Promise.resolve(api);
   if(!read&&!root.chrome?.runtime?.getURL)return Promise.reject(Error('A packaged school-language reader is required'));
   const reader=read||(()=>fetch(root.chrome.runtime.getURL(DATA_FILE)).then(response=>{if(!response.ok)throw Error('School language data could not load');return response.json();}));
   pending=Promise.resolve().then(()=>reader(DATA_FILE)).then(data=>api.configure(data)).finally(()=>{pending=null;});
   return pending;
 },get ready(){return current.data.subjects.length>0;}};
 for(const name of ['words','analyze','normalize','everydayTokens','shortName','shortCourseName','courseAliases','courseIndex','courseAliasRequest','courseAliasCandidates','prepareView','prepare','prepareItems','resolveCourses','actionFeatures','itemFeatures'])api[name]=(...args)=>current[name](...args);
 root.ReserveBiscuitLanguage=api;
 if(node)module.exports=api;
})(globalThis);
