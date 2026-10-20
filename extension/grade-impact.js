/* Canvas Harness grade impact: on the Grades page, the graded work coming up in the next three weeks and how much each
   piece can move its course grade, worked out from the course's assignment groups (the teacher's category weights
   when the course uses them, otherwise points). With Show grades on, and only when this estimate matches the grade
   Canvas reports, it also shows what the course grade becomes at 100%, 85% and 70% on it. Courses whose groups drop
   scores (rules) get the swing only. Read-only: one request per course, when the Grades page is opened. */
(function(root){
 'use strict';
 const DAYS=21,TTL=10*60000,MAX_ROWS=6;

 // groups: Canvas assignment_groups with assignments and the student's submission; weighted: the course applies weights.
 function model(groups,weighted){
  const g=(groups||[]).map(x=>({w:Number(x.group_weight)||0,earned:0,possible:0,rules:!!(x.rules&&Object.keys(x.rules).length)}));
  const upcoming=[];
  (groups||[]).forEach((x,i)=>{for(const a of x.assignments||[]){
   if(a.omit_from_final_grade||!(Number(a.points_possible)>0))continue;
   const s=a.submission||{};if(s.excused)continue;
   if(s.score!=null&&s.workflow_state==='graded'){g[i].earned+=Number(s.score);g[i].possible+=Number(a.points_possible);}
   else if(!s.submitted_at)upcoming.push({id:String(a.id),name:String(a.name||'Assignment'),due:a.due_at||'',points:Number(a.points_possible),group:i,url:a.html_url||''});
  }});
  const grade=over=>{let num=0,den=0;
   g.forEach((x,i)=>{const e=x.earned+(over?.group===i?over.earned:0),p=x.possible+(over?.group===i?over.possible:0);
    if(p<=0)return;if(weighted){if(x.w<=0)return;num+=x.w*e/p;den+=x.w;}else{num+=e;den+=p;}});
   return den>0?num/den*100:null;};
  // What the grade becomes with a fraction f of the points on one upcoming piece; the swing is 100% minus 0%.
  const impact=u=>{const lo=grade({group:u.group,earned:0,possible:u.points}),hi=grade({group:u.group,earned:u.points,possible:u.points});
   return lo==null||hi==null?null:{swing:hi-lo,at:f=>grade({group:u.group,earned:u.points*f,possible:u.points})};};
  return {current:grade(),upcoming,impact,rules:g.some(x=>x.rules)};
 }
 // The pieces due in the next DAYS days that can move the grade by at least 0.05 points, biggest first.
 function rows(m,{now=Date.now(),days=DAYS}={}){
  const end=now+days*864e5;
  return m.upcoming.filter(u=>{const d=Date.parse(u.due);return Number.isFinite(d)&&d>=now-864e5&&d<=end;})
   .map(u=>({...u,imp:m.impact(u)})).filter(u=>u.imp&&u.imp.swing>=.05).sort((a,b)=>b.imp.swing-a.imp.swing);
 }
 // Numbers are shown only when the estimate agrees with Canvas (within 0.6 points) and no group drops scores.
 const trusted=(m,canvasScore)=>m.current!=null&&!m.rules&&(canvasScore==null||!Number.isFinite(canvasScore)||Math.abs(m.current-canvasScore)<=.6);

 /* ---- loading, one course at a time, kept for ten minutes ---- */
 function create({client,weighted=()=>false,onChange=()=>{}}={}){
  const cache=new Map();let dead=false;
  function ensure(ids){
   if(!client?.list)return;
   for(const id of ids){
    const hit=cache.get(id);if(hit&&(hit.state==='loading'||Date.now()-hit.at<TTL))continue;
    cache.set(id,{state:'loading',at:Date.now()});
    client.list(`/api/v1/courses/${encodeURIComponent(id)}/assignment_groups?include[]=assignments&include[]=submission&per_page=100`)
     .then(groups=>{if(!dead){cache.set(id,{state:'ready',at:Date.now(),model:model(groups,weighted(id))});onChange();}},
      ()=>{if(!dead){cache.set(id,{state:'error',at:Date.now()});onChange();}});
   }
  }
  const get=id=>cache.get(id)||null;
  return {ensure,get,destroy(){dead=true;cache.clear();}};
 }

 /* ---- the Grades page section ---- */
 function render(c,h,loader){
  const {E,formatDate}=h,visible=c.s.showGrades===true,now=c.now||Date.now();
  const courses=c.courses.filter(course=>c.state.courseId==='all'||course.id===c.state.courseId);
  const pct=n=>`${(Math.round(n*10)/10).toFixed(1)}%`;
  let loading=0,all=[];
  for(const course of courses){
   const st=loader?.get(course.id);if(!st||st.state==='loading'){loading++;continue;}if(st.state!=='ready')continue;
   const nums=visible&&trusted(st.model,course.score);
   for(const r of rows(st.model,{now}))all.push({...r,course,nums,model:st.model});
  }
  all.sort((a,b)=>b.imp.swing-a.imp.swing);
  const list=all.slice(0,MAX_ROWS).map(r=>`<li class="rd-impact-row" style="--rd-course:${E(r.course.color)}"><div><a href="${E(r.url||'#')}"><strong>${E(r.name)}</strong></a><small>${E(r.course.shortName||r.course.name)} · ${r.due?E(formatDate(r.due,c.s.timeZone,{weekday:'short',month:'short',day:'numeric'})):''} · ${E(r.points)} pts</small>
${r.nums?`<small class="rd-impact-what">100% → ${pct(r.imp.at(1))} · 85% → ${pct(r.imp.at(.85))} · 70% → ${pct(r.imp.at(.7))}</small>`:''}</div><span class="rd-impact-swing" title="The difference between 0% and 100% on it">up to <b>${E((Math.round(r.imp.swing*10)/10).toFixed(1))}</b> points</span></li>`).join('');
  const note=!visible?'Turn on Show grades to see what different scores would make your grade.':all.some(r=>!r.nums)?'Some courses show only the swing: their estimate doesn\'t match Canvas closely enough, or a category drops scores.':'Worked out from each course\'s categories in Canvas.';
  return `<section class="rd-grade-sheet rd-impact" aria-labelledby="rd-grade-impact"><div class="rd-sheet-heading"><h2 id="rd-grade-impact">Coming up</h2><span>next ${DAYS} days</span></div>
${list?`<ul class="rd-impact-list">${list}</ul>`:`<p class="rd-grade-note">${loading?'Reading each course\'s categories…':'Nothing graded is due in the next three weeks.'}</p>`}
<p class="rd-grade-note">How much each piece can move its course grade. ${E(note)}</p></section>`;
 }
 const api={DAYS,model,rows,trusted,create,render};
 root.ReserveGradeImpact=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
