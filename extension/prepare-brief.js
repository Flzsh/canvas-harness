/* Prepare's Canvas brief: what a friend checking the student's Canvas would look at, in plain text.
   Overdue work, the next 7 days with instructions, later dates in one line, feedback, announcements and events.
   Login details, passwords and e-mail addresses never leave the browser. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessPrepareBrief=api;
})(globalThis,function(root){
 'use strict';
 const DAY=864e5,LIMITS=Object.freeze({total:24000,instructions:1500,announcement:600,feedback:400,message:300,later:21,recent:10,files:8,undated:8,course:8000,courseMessage:2000});
 const ONLINE=new Set(['online_upload','online_text_entry','online_url','media_recording','online_quiz','discussion_topic','external_tool','student_annotation']);
 const HAND_IN={
   online_upload:'upload a file',
   online_text_entry:'type it in Canvas',
   online_url:'submit a link',
   media_recording:'record media',
   online_quiz:'Canvas quiz',
   discussion_topic:'discussion post',
   external_tool:'outside tool',
   student_annotation:'annotate in Canvas',
   on_paper:'on paper',
   none:'no submission',
   not_graded:'not graded'
 };
 const SECRET=/\b(?:(pass ?word|passcode|pass code|user ?name|log ?in|sign ?in|pin|access code|credentials?)\b\s*[:=]|(?:pass ?word|passcode|pass code|access code)\s+(?:is|was)\b)/i;
 // Remove what must never reach an AI: login lines, e-mail addresses and query strings that can carry tokens.
 // A long line is a paragraph that mentions a login, so only the value after the label goes.
 function scrub(value){
  return String(value??'').split(/\r?\n/).map(line=>
    !SECRET.test(line)?line:line.length>300?line.replace(new RegExp(SECRET.source+'\\s*\\S*','gi'),'[login details removed]'):'[login details removed]').join('\n')
   .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,'[email removed]')
   .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g,'$1')
   .replace(/(\[login details removed\]\n?)+/g,'[login details removed]\n').trim();
 }
 const plain=value=>
   String(value??'').replace(/<(br|p|li|div|h\d|tr)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(
     /&#39;|&apos;/g,
     "'").replace(
     /&quot;/g,
     '"').replace(
     /[ \t]+/g,
     ' ').replace(
     /\n\s*\n+/g,
     '\n').trim();
 const clip=(value,n)=>{const text=String(value??'').trim();return text.length>n?text.slice(0,n-1).trimEnd()+'…':text;};
 // A level tag in front marks a school's decorated name: "AP Chemistry-Rivera-Okafor" -> "Chemistry", the tag and the
 // teachers' names left out (the tags Biscuit's short names drop). Names without a tag stay whole ("Pre-Calculus").
 const LEVEL=/^(?:(?:CL|CP|AP|IB|HL|SL|Honors?)\s+)+/i;
 function courseName(name){
   const raw=String(name||'').trim(),text=LEVEL.test(raw)?raw.replace(LEVEL,'').replace(/-[A-Z][a-z'’]+(?:-[A-Z][a-z'’]+)*\s*$/,''):raw;
   return text.replace(/\s+\d{2}-\d{2}\s+(Fall|Spring|Winter|Summer)\s*$/i,'').trim()||String(name||'Course').trim();
 }
 function formatter(timeZone){
  let zone=timeZone||'UTC';try{new Intl.DateTimeFormat('en-US',{timeZone:zone});}catch{zone='UTC';}
  const day=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric'}),
    time=new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}),
    key=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
  const clean=v=>v.replace(/[  ]/g,' ');
  return {when:at=>clean(day.format(at)+', '+time.format(at)),dayKey:at=>key.format(at)};
 }
 function relative(at,now,fmt){
  const days=Math.round((Date.parse(fmt.dayKey(at))-Date.parse(fmt.dayKey(now)))/DAY);
  if(days===0)return at<now?'earlier today':'today';if(days===1)return 'tomorrow';if(days===-1)return 'yesterday';
  return days>0?'in '+days+' days':-days+' days ago';
 }
 const testLike=title=>/\b(test|quiz|exam|midterm|final|assessment)\b/i.test(title||'');
 function handIn(types){const list=(types||[]).map(t=>HAND_IN[t]||t).filter(Boolean);return list.length?list.join(' or '):'';}
 // With {course}, the brief Help reads for one item (AI plan step 3): that course's work with instructions, its
 // announcements and teachers' messages at up to 2,000 characters, newest first, calendar events of that course or of
 // none, other courses' open work as date lines only and no file list, in about 8,000 characters. The day's pick keeps
 // the whole brief.
 function build(input={},{course}={}){
  const now=Number.isFinite(input.now)?input.now:Date.parse(input.now)||Date.now(),fmt=formatter(input.timeZone);
  const one=course==null||course===''?'':String(course),
    mine=x=>!one||String(x?.courseId)===one,
    cap=one?LIMITS.course:LIMITS.total,
    newest=list=>one?list.slice().sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)):list;
  // The brief never carries scores; scrub() removes logins, e-mail addresses and tokens.
  const priv=value=>scrub(value);
  const courses=new Map((input.courses||[]).map(c=>[String(c.id),courseName(c.name)]));
  const label=item=>(courses.get(String(item.courseId))||'Course')+' · '+clip(priv(item.title,'title'),120);
  const open=i=>!i.submitted&&!i.graded&&!i.done,online=i=>(i.submissionTypes||[]).some(t=>ONLINE.has(t));
  const every=(input.items||[]).filter(i=>i&&i.title&&!i.excused).map(i=>({...i,at:Date.parse(i.due)})),
    listed=every.filter(mine),
    items=listed.filter(i=>Number.isFinite(i.at)).sort((a,b)=>a.at-b.at);
  const elsewhere=one?every.filter(i=>!mine(i)&&open(i)&&Number.isFinite(i.at)&&i.at<now+7*DAY&&i.at>now-2*DAY).sort((a,b)=>a.at-b.at):[];
  const overdue=items.filter(i=>open(i)&&i.at<now&&(online(i)?now-i.at<LIMITS.later*DAY:now-i.at<2*DAY));
  const soon=items.filter(i=>open(i)&&i.at>=now&&i.at<now+7*DAY),later=items.filter(i=>open(i)&&i.at>=now+7*DAY&&i.at<now+LIMITS.later*DAY);
  // Self-paced courses and undated work have no place on a calendar; open online work without a date still counts.
  const undated=listed.filter(i=>!Number.isFinite(i.at)&&open(i)&&online(i)).slice(0,LIMITS.undated);
  // Short refs ("A1") let a card point at an item without the AI handling Canvas IDs; CH maps them back.
  const refs={},refOf=new Map();
  for(const i of [...overdue,...soon,...later,...undated]){
    const ref='A'+(refOf.size+1);
    refOf.set(i,ref);
    refs[ref]={id:String(i.id),courseId:String(i.courseId),title:String(i.title||'').trim()};
  }
  const steps=i=>
    (i.checkpoints||[]).filter(c=>c.dueAt).map(c=>' · '+(/reply_to_entry/.test(c.tag)?'replies':/reply_to_topic/.test(c.tag)?'first post':'part')+' due '+fmt.when(Date.parse(c.dueAt))).join('');
  const facts=i=>
    (i.points?' · '+i.points+' pts':'')+
      (testLike(i.title)||i.quiz?' · test or quiz':'')+
      (handIn(i.submissionTypes)?' · '+handIn(i.submissionTypes)+(i.tool&&!i.quiz?' ('+clip(i.tool,60)+')':''):'')+
      (i.locked?' · locked in Canvas':'')+
      steps(i)+
      (i.postFirst?' · classmates\' posts stay hidden until the student posts':'')+
      (i.redo?' · the teacher asked for it again':'')+
      (i.missing?' · Canvas marks it missing':i.late?' · late':'');
  const line=i=>'- ['+refOf.get(i)+'] '+label(i)+' — due '+fmt.when(i.at)+' ('+relative(i.at,now,fmt)+')'+facts(i);
  const out=[],add=(title,rows)=>{if(rows.length)out.push(title+'\n'+rows.join('\n'));};
  out.push('Courses: '+[...new Set(courses.values())].join('; '));
  const missing=new Map();
  for(const u of (input.unavailable||[]).filter(mine)){
    const course=courses.get(String(u.courseId))||'Course',what=u.source==='frontPage'?'home page':String(u.source||'Canvas');
    missing.set(course,(missing.get(course)||new Set()).add(what));
  }
  add('Canvas would not show these, so nothing below covers them. Do not guess what they hold:',[...missing].map(([course,what])=>'- '+course+': '+[...what].join(', ')));
  add('Overdue and not handed in:',overdue.map(line));
  // A locked item's instructions stay hidden; "none posted" is only said when Canvas really has nothing to show.
  const week=limit=>soon.map(i=>{
    const text=clip(priv(i.text??plain(i.instructions)),limit);
    return line(i)+
      '\n  Instructions: '+
      (i.locked?
        'not visible while it is locked'+(i.lockedWhy?' ('+clip(priv(i.lockedWhy),200)+')':''):
        text?text.replace(/\n/g,'\n  '):i.unreadable?'posted as an image or video that cannot be read here':'none posted in Canvas');
  });
  const weekAt=out.length;add('Due in the next 7 days:',week(LIMITS.instructions));
  add('Later, within 3 weeks:',later.map(line));
  add('No due date:',undated.map(i=>'- ['+refOf.get(i)+'] '+label(i)+facts(i)));
  if(one)add('Other courses, due in the next 7 days (dates only):',elsewhere.map(i=>'- '+label(i)+' — due '+fmt.when(i.at)+' ('+relative(i.at,now,fmt)+')'));
  if(input.teacherFeedback===true)add('Teacher feedback from the last 2 weeks:',items.filter(i=>i.feedback&&now-i.at<14*DAY).map(i=>'- '+label(i)+': '+clip(priv(i.feedback),LIMITS.feedback)));
  const notes=(title,rows)=>{const i=out.length;add(title,rows);return out.length>i?i:-1;};
  const anns=limit=>
    newest((input.announcements||[]).filter(a=>mine(a)&&now-Date.parse(a.at)<LIMITS.recent*DAY)).map(a=>
      '- '+(courses.get(String(a.courseId))||'Course')+' · '+clip(priv(a.title,'title'),120)+' ('+fmt.when(Date.parse(a.at))+'): '+clip(priv(plain(a.text)),limit));
  const annTitle='Announcements from the last '+LIMITS.recent+' days:',annAt=notes(annTitle,anns(one?LIMITS.courseMessage:LIMITS.announcement));
  add('Calendar, next 14 days:',(input.events||[]).filter(e=>{
    const t=Date.parse(e.at);
    return t>=now&&t<now+14*DAY&&(!one||!e.courseId||mine(e));
  }).map(e=>'- '+(e.courseId&&courses.get(String(e.courseId))?courses.get(String(e.courseId))+' · ':'')+clip(priv(e.title,'title'),120)+' — '+fmt.when(Date.parse(e.at))));
  const msgs=limit=>
    newest((input.messages||[]).filter(m=>(!one||!m.courseId||mine(m))&&now-Date.parse(m.at)<7*DAY)).map(m=>
      '- '+clip(priv(m.subject,'title'),100)+' ('+fmt.when(Date.parse(m.at))+'): '+clip(priv(plain(m.text)),limit));
  const msgTitle='Messages from teachers, last 7 days:',msgAt=notes(msgTitle,msgs(one?LIMITS.courseMessage:LIMITS.message));
  // Files and pages the AI can ask Canvas Harness to open (refs F1..), for the courses with work coming up.
  const busy=new Set([...overdue,...soon].map(i=>String(i.courseId))),stamp=v=>Date.parse(v)||0,files=[];
  if(!one)
    for(const cid of busy)files.push(...(input.resources||[]).filter(r=>String(r.courseId)===cid&&r.title).sort((a,b)=>stamp(b.at)-stamp(a.at)).slice(0,LIMITS.files));
  add('Files and pages in those courses (newest first):',files.map((r,i)=>{
    const ref='F'+(i+1);
    refs[ref]={id:String(r.id),courseId:String(r.courseId),title:String(r.title).trim(),source:true};
    return '- ['+ref+'] '+(courses.get(String(r.courseId))||'Course')+' · '+clip(priv(r.title,'title'),120)+(stamp(r.at)?' ('+fmt.when(stamp(r.at)).split(',').slice(0,2).join(',')+')':'');
  }));
  if(!overdue.length&&!soon.length)out.push(one?'Nothing in this course is due in the next 7 days.':'Nothing is due in the next 7 days.');
  let text=out.join('\n\n');
  // A heavy week shortens each item's instructions first: teachers' messages come after them and must survive. In one
  // course's brief the messages are shortened next, before anything is cut.
  if(soon.length)for(const limit of [900,500,250,120]){if(text.length<=cap)break;out[weekAt]='Due in the next 7 days:\n'+week(limit).join('\n');text=out.join('\n\n');}
  if(one)
    for(const limit of [1000,600]){
      if(text.length<=cap)break;
      if(annAt>=0)out[annAt]=annTitle+'\n'+anns(limit).join('\n');
      if(msgAt>=0)out[msgAt]=msgTitle+'\n'+msgs(limit).join('\n');
      text=out.join('\n\n');
    }
  if(text.length>cap)text=text.slice(0,cap-40).trimEnd()+'\n[brief cut short to fit]';
  // busy: the courses with work overdue or due this week, for which the scan keeps a one-course brief
  return {text,refs,counts:{overdue:overdue.length,soon:soon.length,later:later.length},...(one?{}:{busy:[...busy]})};
 }
 return {build,scrub,courseName,LIMITS};
});
