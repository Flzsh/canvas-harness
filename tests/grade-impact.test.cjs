'use strict';
// Grade impact (extension/grade-impact.js): the graded work coming up on the Grades page and how far each piece can
// move its course grade, from the course's assignment groups (category weights when Canvas applies them).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const G=require('../extension/grade-impact.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..','extension',f),'utf8');
const NOW=Date.parse('2026-10-20T15:00:00Z');
const day=d=>new Date(NOW+d*864e5).toISOString();
const graded=(id,score,points)=>({id,name:'Done '+id,points_possible:points,submission:{score,workflow_state:'graded',submitted_at:day(-5)}});
const coming=(id,points,due,extra={})=>({id,name:'Coming '+id,points_possible:points,due_at:due,html_url:'https://school.instructure.com/courses/5/assignments/'+id,submission:{workflow_state:'unsubmitted'},...extra});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);

test('weighted categories: the grade now, and what one upcoming test can do to it',()=>{
 const m=G.model([
  {group_weight:50,assignments:[graded(1,40,50),coming(2,50,day(3))]},
  {group_weight:50,assignments:[graded(3,9,10)]}],true);
 close(m.current,85);
 const imp=m.impact(m.upcoming[0]);
 close(imp.at(0),65);close(imp.at(1),90);close(imp.swing,25);close(imp.at(.85),86.25);
});

test('without weights the grade is total points',()=>{
 const m=G.model([{group_weight:0,assignments:[graded(1,40,50),coming(2,10,day(3))]},{group_weight:0,assignments:[graded(3,9,10)]}],false);
 close(m.current,49/60*100);
 const imp=m.impact(m.upcoming[0]);close(imp.at(0),49/70*100);close(imp.at(1),59/70*100);
});

test('left out: work not counted, worth nothing, excused or already handed in; a category weighted 0 counts for nothing',()=>{
 const m=G.model([
  {group_weight:100,assignments:[graded(1,8,10),coming(2,10,day(2),{omit_from_final_grade:true}),coming(3,0,day(2)),
   coming(4,10,day(2),{submission:{excused:true}}),coming(5,10,day(2),{submission:{workflow_state:'submitted',submitted_at:day(-1)}}),coming(6,10,day(2))]},
  {group_weight:0,assignments:[graded(7,0,10)]}],true);
 assert.deepEqual(m.upcoming.map(u=>u.id),['6']);close(m.current,80);
});

test('rows: only dated work in the next three weeks (a day late still shows), biggest swing first',()=>{
 const m=G.model([{group_weight:100,assignments:[graded(1,45,50),coming(2,10,day(4)),coming(3,50,day(10)),coming(4,50,day(30)),coming(5,50,''),coming(6,50,day(-3)),coming(7,5,day(-.5))]}],true);
 assert.deepEqual(G.rows(m,{now:NOW}).map(r=>r.id),['3','2','7']);
});

test('the numbers are shown only when the estimate matches Canvas and no category drops scores',()=>{
 const m=G.model([{group_weight:100,assignments:[graded(1,9,10)]}],true);
 assert.equal(G.trusted(m,90.4),true);assert.equal(G.trusted(m,null),true);assert.equal(G.trusted(m,88),false);
 assert.equal(G.trusted(G.model([{group_weight:100,rules:{drop_lowest:1},assignments:[graded(1,9,10)]}],true),90),false);
 assert.equal(G.trusted(G.model([],true),90),false,'nothing graded yet: nothing to check against');
});

const helpers={E:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),formatDate:v=>v.slice(5,10)};
const course={id:'5',name:'Chemistry',shortName:'Chem',color:'#3366aa',score:85};
const ctx=showGrades=>({s:{showGrades},state:{courseId:'all'},courses:[course],now:NOW});
const ready=groups=>({get:()=>({state:'ready',model:G.model(groups,true)})});
const groups=[{group_weight:50,assignments:[graded(1,40,50),coming(2,50,day(3),{name:'Unit <3> test'})]},{group_weight:50,assignments:[graded(3,9,10)]}];

test('the section: the swing always, what 100/85/70% would make the grade only with Show grades on',()=>{
 const off=G.render(ctx(false),helpers,ready(groups));
 assert.match(off,/Coming up/);assert.match(off,/up to <b>25\.0<\/b> points/);assert.match(off,/Unit &lt;3&gt; test/);
 assert.doesNotMatch(off,/100% →/);assert.match(off,/Turn on Show grades/);
 const on=G.render(ctx(true),helpers,ready(groups));
 assert.match(on,/100% → 90\.0% · 85% → 86\.3% · 70% → 82\.5%/);
 const off_by=G.render({...ctx(true),courses:[{...course,score:70}]},helpers,ready(groups));
 assert.doesNotMatch(off_by,/100% →/,'an estimate that disagrees with Canvas shows the swing only');
 assert.match(G.render(ctx(true),helpers,{get:()=>({state:'loading'})}),/Reading each course/);
 assert.match(G.render(ctx(true),helpers,{get:()=>({state:'error'})}),/Nothing graded is due/);
});

test('loading: one request per course, kept for ten minutes; nothing after destroy',async()=>{
 const asked=[];let changes=0;
 const client={list:async p=>{asked.push(p);if(p.includes('/9/'))throw new Error('no');return groups;}};
 const loader=G.create({client,weighted:id=>id==='5',onChange:()=>changes++});
 loader.ensure(['5','9']);loader.ensure(['5']);
 await new Promise(r=>setImmediate(r));
 assert.equal(asked.length,2);assert.match(asked[0],/\/api\/v1\/courses\/5\/assignment_groups\?include\[\]=assignments&include\[\]=submission/);
 assert.equal(loader.get('5').state,'ready');close(loader.get('5').model.current,85);assert.equal(loader.get('9').state,'error');assert.equal(changes,2);
 loader.ensure(['5']);assert.equal(asked.length,2,'still fresh');
 const late=G.create({client,onChange:()=>changes++});late.ensure(['5']);late.destroy();
 await new Promise(r=>setImmediate(r));assert.equal(changes,2);
 assert.doesNotThrow(()=>G.create({}).ensure(['5']),'no client (the demo without one): nothing to read');
});

test('wiring: loaded before the views, read only on the Grades page, shown inside its layout',()=>{
 const scripts=JSON.parse(read('manifest.json')).content_scripts.flatMap(s=>s.js);
 assert.ok(scripts.indexOf('grade-impact.js')>scripts.indexOf('grades-view.js')&&scripts.indexOf('grade-impact.js')<scripts.indexOf('dashboard-view.js'));
 const dash=read('dashboard.js');
 assert.match(dash,/gradeImpact:workspace==='grades'\?gradeImpact\(ctx\):''/);
 assert.match(dash,/apply_assignment_group_weights===true/);assert.match(dash,/impact\?\.destroy\(\)/);
 assert.match(read('grades-view.js'),/\$\{c\.gradeImpact\|\|''\}<\/div>`/);
 assert.doesNotMatch(read('grade-impact.js'),/method:\s*['"](POST|PUT|DELETE)/i,'read-only');
});
