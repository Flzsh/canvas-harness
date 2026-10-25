'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Registry=require('../extension/biscuit-registry.js');
test('all loaded Canvas source families are searchable without a fetch',()=>{
 const names=['submissions','rubrics','quizzes','discussions','feedback','calendarEvents','peerReviews','people','canvasModules','inbox','groups','syllabi','courseGrades','marketItems'],s={settings:{showGrades:true}};
 for(const name of names)s[name]=[{id:name,title:name,description:'Loaded '+name}];const rows=Registry.entries(s);for(const name of names)assert.ok(rows.some(r=>r.id===name),name);
});
test('course totals and returned feedback respect explicit privacy denial',()=>{
 const secret={id:'private',title:'PRIVATE',currentPercent:82,teacherComments:'SECRET'},s={settings:{showGrades:true},showGrades:false,courseGrades:[secret],feedback:[secret]};assert.ok(!Registry.entries(s).some(r=>r.title==='PRIVATE'));
 const visible={...s,showGrades:true,teacherFeedback:false};assert.ok(!Registry.entries(visible).some(r=>r.kind==='feedback'));
});
test('structured facts remain available for precise local answers',()=>{
 const row=Registry.entries({quizzes:[{id:'q',title:'Checkpoint',attemptsRemaining:2,notesAllowed:true,replyDueAt:123}]}).find(r=>r.id==='q');assert.match(row?.text||'',/attempts remaining: 2/i);assert.match(row.text,/notes allowed: true/i);
});
test('hidden grade metadata is removed recursively from source rows and action fields',()=>{
 const s={showGrades:false,settings:{showGrades:true},assignments:[{id:'a',title:'Public task',fields:{itemId:'a',nested:{score:88,entered_score:73,submission_comments:[{comment:'SECRET'}],rubric_assessment:{criterion:{score:4}},teacherComments:'SECRET',keep:'safe'}},metadata:{earnedGrade:91,keep:'safe'}}]},row=Registry.entries(s).find(r=>r.id==='a'),sent=JSON.stringify(row);
 assert.ok(!sent.includes('SECRET'));assert.ok(!sent.includes('88'));assert.ok(!sent.includes('91'));assert.ok(!sent.includes('73'));assert.ok(!sent.includes('rubric_assessment'));assert.equal(row.fields.nested.keep,'safe');assert.equal(s.assignments[0].fields.nested.score,88);
});
