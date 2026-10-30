/* Prepare's Canvas brief: what a friend checking the student's Canvas would look at, in plain text.
   Overdue work, the next 7 days with instructions, later dates in one line, feedback, announcements and events.
   Login details, passwords and e-mail addresses never leave the browser. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CanvasHarnessPrepareBrief=api;
})(globalThis,function(root){
 'use strict';
 const DAY=864e5,LIMITS=Object.freeze({total:24000,instructions:1500,announcement:600,feedback:400,message:300,later:21,recent:10,files:8});
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
 const SECRET=/\b(pass ?word|passcode|pass code|user ?name|log ?in|sign ?in|pin|access code|credentials?)\b\s*[:=]/i;
 // Remove what must never reach an AI: login lines, e-mail addresses and query strings that can carry tokens.
 function scrub(value){
  return String(value??'').split(/\r?\n/).map(line=>SECRET.test(line)?'[login details removed]':line).join('\n')
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
 // "CL Biology-Rivera-Okafor" -> "Biology"; keeps names that have no class/teacher decoration.
 function courseName(name){
   const text=String(name||'').trim().replace(/^CL\s+/,'').replace(/-[A-Z][a-z'’]+(?:-[A-Z][a-z'’]+)*\s*$/,'');
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
 function build(input={}){
  const now=Number.isFinite(input.now)?input.now:Date.parse(input.now)||Date.now(),fmt=formatter(input.timeZone);
  // The brief never carries scores; scrub() removes logins, e-mail addresses and tokens.
  const priv=value=>scrub(value);
  const courses=new Map((input.courses||[]).map(c=>[String(c.id),courseName(c.name)]));
  const label=item=>(courses.get(String(item.courseId))||'Course')+' · '+clip(priv(item.title,'title'),120);
  const items=(input.items||[]).filter(i=>i&&i.title&&!i.excused).map(i=>({...i,at:Date.parse(i.due)})).filter(i=>Number.isFinite(i.at)).sort((a,b)=>a.at-b.at);
  const open=i=>!i.submitted&&!i.graded&&!i.done,online=i=>(i.submissionTypes||[]).some(t=>ONLINE.has(t));
  const overdue=items.filter(i=>open(i)&&i.at<now&&(online(i)?now-i.at<LIMITS.later*DAY:now-i.at<2*DAY));
  const soon=items.filter(i=>open(i)&&i.at>=now&&i.at<now+7*DAY),later=items.filter(i=>open(i)&&i.at>=now+7*DAY&&i.at<now+LIMITS.later*DAY);
  // Short refs ("A1") let a card point at an item without the AI handling Canvas IDs; CH maps them back.
  const refs={},refOf=new Map();
  for(const i of [...overdue,...soon,...later]){
    const ref='A'+(refOf.size+1);
    refOf.set(i,ref);
    refs[ref]={id:String(i.id),courseId:String(i.courseId),title:String(i.title||'').trim()};
  }
  const line=i=>
    '- ['+
      refOf.get(i)+
      '] '+
      label(i)+
      ' — due '+
      fmt.when(i.at)+
      ' ('+
      relative(i.at,now,fmt)+
      ')'+
      (i.points?' · '+i.points+' pts':'')+
      (testLike(i.title)?' · test or quiz':'')+
      (handIn(i.submissionTypes)?' · '+handIn(i.submissionTypes):'')+
      (i.missing?' · Canvas marks it missing':i.late?' · late':'');
  const out=[],add=(title,rows)=>{if(rows.length)out.push(title+'\n'+rows.join('\n'));};
  out.push('Courses: '+[...new Set(courses.values())].join('; '));
  add('Overdue and not handed in:',overdue.map(line));
  add('Due in the next 7 days:',soon.map(i=>{
    const text=clip(priv(plain(i.instructions)),LIMITS.instructions);
    return line(i)+(text?'\n  Instructions: '+text.replace(/\n/g,'\n  '):'\n  Instructions: none posted in Canvas');
  }));
  add('Later, within 3 weeks:',later.map(line));
  if(input.teacherFeedback===true)add('Teacher feedback from the last 2 weeks:',items.filter(i=>i.feedback&&now-i.at<14*DAY).map(i=>'- '+label(i)+': '+clip(priv(i.feedback),LIMITS.feedback)));
  add(
    'Announcements from the last '+LIMITS.recent+' days:',
    (input.announcements||[]).filter(a=>now-Date.parse(a.at)<LIMITS.recent*DAY).map(a=>
      '- '+(courses.get(String(a.courseId))||'Course')+' · '+clip(priv(a.title,'title'),120)+' ('+fmt.when(Date.parse(a.at))+'): '+clip(priv(plain(a.text)),LIMITS.announcement)));
  add('Calendar, next 14 days:',(input.events||[]).filter(e=>{
    const t=Date.parse(e.at);
    return t>=now&&t<now+14*DAY;
  }).map(e=>'- '+(e.courseId&&courses.get(String(e.courseId))?courses.get(String(e.courseId))+' · ':'')+clip(priv(e.title,'title'),120)+' — '+fmt.when(Date.parse(e.at))));
  add(
    'Messages from teachers, last 7 days:',
    (input.messages||[]).filter(m=>now-Date.parse(m.at)<7*DAY).map(m=>
      '- '+clip(priv(m.subject,'title'),100)+' ('+fmt.when(Date.parse(m.at))+'): '+clip(priv(plain(m.text)),LIMITS.message)));
  // Files and pages the AI can ask Canvas Harness to open (refs F1..), for the courses with work coming up.
  const busy=new Set([...overdue,...soon].map(i=>String(i.courseId))),stamp=v=>Date.parse(v)||0,files=[];
  for(const cid of busy)files.push(...(input.resources||[]).filter(r=>String(r.courseId)===cid&&r.title).sort((a,b)=>stamp(b.at)-stamp(a.at)).slice(0,LIMITS.files));
  add('Files and pages in those courses (newest first):',files.map((r,i)=>{
    const ref='F'+(i+1);
    refs[ref]={id:String(r.id),courseId:String(r.courseId),title:String(r.title).trim(),source:true};
    return '- ['+ref+'] '+(courses.get(String(r.courseId))||'Course')+' · '+clip(priv(r.title,'title'),120)+(stamp(r.at)?' ('+fmt.when(stamp(r.at)).split(',').slice(0,2).join(',')+')':'');
  }));
  if(!overdue.length&&!soon.length)out.push('Nothing is due in the next 7 days.');
  let text=out.join('\n\n');if(text.length>LIMITS.total)text=text.slice(0,LIMITS.total-40).trimEnd()+'\n[brief cut short to fit]';
  return {text,refs,counts:{overdue:overdue.length,soon:soon.length,later:later.length}};
 }
 return {build,scrub,courseName,LIMITS};
});
