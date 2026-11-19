// B2 audit (2026-11-14): Grade impact findings. Each test fails on the untouched 4.0.164 copy and passes with its patch.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Art=require('../extension/grade-impact-art.js'),G=require('../extension/grade-impact.js');
const ORIGIN='https://school.instructure.com',NOW=Date.parse('2026-10-20T15:00:00Z'),user={id:'9'};
const day=n=>new Date(NOW+n*864e5).toISOString(),tick=()=>new Promise(resolve=>setImmediate(resolve)),clone=value=>structuredClone(value);
const graded=(id,score,points)=>({id,name:'Done '+id,course_id:'5',grading_type:'points',points_possible:points,submission:{assignment_id:id,user_id:'9',score,workflow_state:'graded',submitted_at:day(-5),posted_at:day(-4)}});
const coming=(id,points,due)=>({id,name:'Coming '+id,course_id:'5',grading_type:'points',points_possible:points,due_at:due,submission:{assignment_id:id,user_id:'9',score:null,workflow_state:'unsubmitted',submitted_at:null}});
const group=(id,weight,assignments,name)=>({id,group_weight:weight,rules:{},assignments,name});
function envelope(groups,weighted,score){const rows=clone(groups);return {origin:ORIGIN,accountId:'9',courseId:'5',course:{id:'5',hide_final_grades:false,multiple_grading_periods_enabled:false,apply_assignment_group_weights:weighted,enrollments:[{type:'student',user_id:'9',computed_current_score:score}]},groups:rows.map(({assignments,...meta})=>meta),assignments:rows.flatMap(g=>g.assignments.map(a=>({...a,assignment_group_id:g.id})))};}
const course={id:'5',name:'Chemistry',shortName:'Chem',score:81.67,scoreScope:'overall',hideFinalGrades:false,gradingPeriodId:null};
const helpers={E:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),formatDate:(value,tz,o)=>o&&o.month?value.slice(5,10):'Fri',icon:()=>''};
const home=()=>({s:{showGrades:true,timeZone:'America/New_York',moduleSize:{impact:'m'}},state:{courseId:'all'},workspace:'work',workPage:'home',user,courses:[course],items:[],now:NOW,gradeImpactRevision:'r1'});
const roomOf=()=>({...home(),workspace:'grades',workPage:'',state:{courseId:'5'}});
function placed(run){const previous=global.ReserveWorkspaceArrange;global.ReserveWorkspaceArrange={snapshot:()=>({order:['impact']})};try{return run();}finally{if(previous===undefined)delete global.ReserveWorkspaceArrange;else global.ReserveWorkspaceArrange=previous;}}

test('a pretend assignment added under "Quizzes" with no name is called "Quiz", as the singular rule promises (not "Quizz")',async()=>{
 const data=envelope([group('1',0,[graded('1',40,50),coming('2',10,day(3))],'Homework'),group('2',0,[graded('3',9,10)],'Quizzes')],false,81.67);
 const loader=G.create({user,client:{loadGradeImpact:async()=>clone(data)},navigate:()=>true});loader.ensure(roomOf());await tick();
 try{
  placed(()=>{
   loader.ensure(home());loader.control.addOpen('5');loader.control.addDraft('group','2');
   const html=G.renderModule(home(),helpers,loader);
   assert.match(html,/data-gi-draft="name" value="" placeholder="Quiz"/,'the name field suggests "Quiz"');
   loader.control.addDraft('points','20');assert.ok(loader.control.addConfirm('5'));
   assert.equal(loader.pretend('5')[0].name,'Quiz');
   loader.control.addOpen('5');loader.control.addDraft('group','2');loader.control.addDraft('points','20');loader.control.addConfirm('5');
   assert.deepEqual(loader.pretend('5').map(p=>p.name),['Quiz','Quiz 2']);
  });
 }finally{loader.destroy();}
});

test('the weighing room\'s stage takes every listener it put on the dashboard off again when it is destroyed (pointercancel included)',()=>{
 const live=new Map(),add=(type,fn)=>{if(!live.has(type))live.set(type,[]);live.get(type).push(fn);},remove=(type,fn)=>{const list=live.get(type)||[],i=list.indexOf(fn);if(i>=0)list.splice(i,1);};
 const win={matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout,clearTimeout};
 const doc={defaultView:win,addEventListener(){},removeEventListener(){}};
 const container={ownerDocument:doc,dataset:{},closest:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener:add,removeEventListener:remove};
 const stage=Art.stage({container,api:{}});
 assert.ok((live.get('pointercancel')||[]).length,'the stage listens for a cancelled pointer while it lives');
 stage.destroy();
 assert.deepEqual([...live].filter(([,list])=>list.length).map(([type])=>type),[],'nothing of the destroyed stage is left on the dashboard');
});
