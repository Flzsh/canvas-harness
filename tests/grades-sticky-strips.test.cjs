'use strict';
// Grades page, 1401 px and wider: the Course grades sheet follows the scroll (position: sticky) beside the long Scored
// work list. On All courses the Grade impact strips sit under the tables in the same grid, and at the bottom of the page
// the sticky sheet slid over them, words on words (seen at 1440x900). The layout now names itself when the strips are in
// it, and the sticky rule leaves that layout alone. Without the strips nothing changes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('../extension/api.js');
const Grades=require('../extension/grades-view.js');
const ORIGIN='https://school.instructure.com',NOW=Date.parse('2026-10-20T15:00:00Z');
const context=(showGrades=true,extra={})=>({s:{showGrades,timeZone:'America/New_York'},state:{courseId:'all'},workspace:'grades',user:{id:'9'},courses:[{id:'5',name:'Chemistry',score:83}],items:[],now:NOW,...extra});
const helpers={E:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),formatDate:value=>String(value).slice(5,10),icon:()=>'',scoreText:c=>c.score+'%',gradePeriodLabel:()=>'Overall grade',assignmentLink:item=>`${ORIGIN}/courses/${item.courseId}/assignments/${item.id}`,number:v=>String(v)};
const layoutTag=html=>(html.match(/<div class="rd-grade-layout[^"]*">/)||[''])[0];

test('the grade layout says when the Grade impact strips are in it',t=>{
 const before=globalThis.ReserveGradeImpact;t.after(()=>{globalThis.ReserveGradeImpact=before;});
 globalThis.ReserveGradeImpact={render:()=>'<section class="rd-grade-sheet ch-impact"><p>strips</p></section>'};
 const withStrips=Grades.render({...context(),gradeImpact:{}},helpers);
 assert.match(withStrips,/strips/);
 assert.match(layoutTag(withStrips),/rd-grade-layout--with-strips/);
 const hidden=Grades.render({...context(false),gradeImpact:{}},helpers);
 assert.doesNotMatch(hidden,/ch-impact/);assert.doesNotMatch(layoutTag(hidden),/with-strips/);
 const none=Grades.render({...context()},helpers);
 assert.ok(layoutTag(none),'the layout is still drawn');assert.doesNotMatch(layoutTag(none),/with-strips/);
});

test('the sticky Course grades sheet is not sticky in a layout that holds the strips',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../extension/refresh.css'),'utf8');
 const sticky=[...css.matchAll(/([^{}]*rd-grade-layout[^{}]*)\{[^}]*position:\s*sticky/g)].map(m=>m[1].trim());
 assert.ok(sticky.length>=1,'the wide-screen sticky rule is still there');
 for(const selector of sticky)assert.match(selector,/:not\(\.rd-grade-layout--with-strips\)/,selector);
});
