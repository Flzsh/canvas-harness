/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
if(typeof module==='object'&&module.exports&&!globalThis.ReserveSite)require('./site.js');
(function(root,factory){const api=factory(root);root.ReserveGradesView=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis,function(root){
  'use strict';
  function render(c,h){
    const {E,icon,scoreText,gradePeriodLabel,assignmentLink,formatDate}=h;
    const visible=c.s.showGrades===true;
    const courses=c.courses.filter(course=>c.state.courseId==='all'||course.id===c.state.courseId);
    const query=(c.gradeQuery||'').trim().toLocaleLowerCase();
    const scored=c.items.filter(item=>(Number.isFinite(item.score)||item.grade)&&item.state!=='excused'&&courses.some(course=>course.id===item.courseId))
      .filter(item=>!query||`${item.name} ${item.courseName} ${item.courseSearch||''}`.toLocaleLowerCase().includes(query))
      .sort((a,b)=>(Date.parse(b.gradedAt||b.updatedAt||b.dueAt)||0)-(Date.parse(a.gradedAt||a.updatedAt||a.dueAt)||0));
    const number=value=>E(new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value));
    // Short course labels; the full Canvas name stays in the tooltip.
    const short=course=>course?.shortName||course?.name||'',detail=course=>[course?.subject,course?.teacher,course?.sub].filter(Boolean).join(' · ');
    const full=course=>course.originalName&&course.originalName!==course.name?`${course.name} · ${course.originalName}`:course.name;
    const courseOf=item=>courses.find(course=>course.id===item.courseId);
    const courseRows=courses.map(course=>{
      const hidden=course.hideFinalGrades||course.scoreScope==='hidden';
      const unavailable=!Number.isFinite(course.score)&&!course.grade;
      // A hidden grade is a faint dash: no number reaches the markup or its label.
      const label=!visible?'Hidden':hidden?'Hidden by Canvas':unavailable?'Not available':(course.grade&&Number.isFinite(course.score)?course.grade+' · ':'')+scoreText(course);
      return `<tr style="--rd-course:${E(course.color)};--rd-course-ink:${E(root.ReserveCore?.courseInk?.(course.color)||course.color)}"><th scope="row"><a href="${globalThis.ReserveSite.origin()}/courses/${E(course.id)}/grades">${root.ReserveCourseArt?.mini?.(course,{place:'grades'})||''}<span title="${E(full(course))}">${E(short(course))}${detail(course)?`<small>${E(detail(course))}</small>`:''}</span>${icon('external')}</a></th><td class="rd-grade-value${!visible||hidden||unavailable?' rd-grade-unavailable':''}">${!visible||unavailable?`<span aria-hidden="true">—</span><span class="rd-sr-only">${E(label)}</span>`:E(label)}</td><td class="rd-grade-period">${hidden?'Hidden by Canvas':E(gradePeriodLabel(course))}</td></tr>`;
    }).join('');
    // The line under the title says where the numbers come from; its quiet button runs the toolbar switch.
    // Its words name what it will do (Show / Hide grades), so it is a plain button, not a pressed toggle.
    return `<div class="rd-page-heading"><div><h1>Grades</h1><p class="rd-grade-privacy">${c.state.courseId==='all'?'Your courses':E(short(courses[0])||'Your course')} · As reported by Canvas${!visible?' · Grades are hidden':''} <button type="button" class="rd-text-button" data-rd-action="grades-visibility">${visible?'Hide grades':'Show grades'}</button></p></div><a class="rd-button rd-button--outline" href="${globalThis.ReserveSite.origin()}/grades">Canvas gradebooks <span aria-hidden="true">↗</span></a></div>
      <div class="rd-grade-layout"><section class="rd-grade-sheet" aria-labelledby="rd-course-grades"><div class="rd-sheet-heading"><h2 id="rd-course-grades">Course grades</h2><span>${courses.length} course${courses.length===1?'':'s'}</span></div>
      <table class="rd-grade-table"><thead><tr><th scope="col">Course</th><th scope="col">Grade</th><th scope="col">Period</th></tr></thead><tbody>${courseRows}</tbody></table>${courses.length?'':'<p class="rd-grade-note">No visible courses. You can change course visibility in Appearance.</p>'}<p class="rd-grade-note">Open a course for its complete gradebook, feedback and grading rules.</p></section>
      <section class="rd-grade-sheet" aria-labelledby="rd-scored-work"><div class="rd-sheet-heading"><h2 id="rd-scored-work">Scored work</h2><span>${scored.length} loaded</span></div><div class="rd-grade-search"><label class="rd-search">${icon('search')}<span class="rd-sr-only">Search scored work</span><input type="search" data-rd-field="grade-query" value="${E(c.gradeQuery||'')}" placeholder="Find an assignment or course" aria-label="Search scored work" maxlength="200"></label></div>
      <div class="rd-scored-list">${scored.slice(0,c.gradeLimit||40).map(item=>`<a class="rd-scored-row" href="${E(assignmentLink(item))}"><span><strong>${E(item.name)}</strong><small>${E(short(courseOf(item))||item.courseName)}${item.gradedAt?' · graded '+E(formatDate(item.gradedAt,c.s.timeZone,{month:'short',day:'numeric'})):item.updatedAt?' · updated '+E(formatDate(item.updatedAt,c.s.timeZone,{month:'short',day:'numeric'})):''}${item.gradeMatchesCurrentSubmission===false?' · Earlier submission':''}${item.redoRequested?' · Resubmission requested':item.missing?' · Missing':''}</small></span><span class="rd-scored-value">${visible?`${Number.isFinite(item.score)?number(item.score):E(item.grade)}${Number.isFinite(item.score)&&Number.isFinite(item.points)?`<small> / ${number(item.points)}</small>`:''}`:'<small>Hidden</small>'}${icon('arrow')}</span></a>`).join('')||`<p class="rd-grade-note">${query?'No scored work matches your search.':'No scored assignments were returned for these courses.'}</p>`}</div>
      ${scored.length>(c.gradeLimit||40)?'<button class="rd-load-more" data-rd-action="more-grades">Show more scored work</button>':''}<p class="rd-grade-note">Loaded assignment results may span grading periods. Canvas gradebooks contain the full history.</p></section></div>`;
  }
  return {render};
});
