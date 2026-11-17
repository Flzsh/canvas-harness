'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{req}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-10: one failed read of a course's quiz list (or its groups, late policy, nicknames) was kept for five minutes as an
// empty answer, so the student's own Refresh right after still left that course's practice quizzes off Home.
const response=(body,status=200)=>({ok:status>=200&&status<300,status,headers:{get:n=>n==='link'?'':'application/json'},json:async()=>body,text:async()=>JSON.stringify(body)});
test('B1-10 a quiz list that failed to load is asked for again on the next refresh',async()=>{
 let quizReads=0;const user={id:'9'};
 const client=req('api.js').createClient({retryDelays:[],fetchImpl:async url=>{
  const path=new URL(url).pathname;
  if(path==='/api/v1/users/self/profile')return response(user);
  if(path==='/api/v1/courses')return response([{id:'7',name:'Chemistry'}]);
  if(path==='/api/v1/courses/7/assignments')return response([]);
  if(path==='/api/v1/courses/7/quizzes')return ++quizReads===1?response({message:'busy'},500):response([{id:'5',title:'Practice quiz',quiz_type:'practice_quiz',due_at:'2026-11-06T20:00:00Z'}]);
  return response([]);
 }});
 const first=await client.loadSnapshot({user,verifiedAt:Date.now()});
 assert.equal(first.assignments.length,0,'the failed read leaves the quiz out this time');
 const second=await client.loadSnapshot({user,verifiedAt:Date.now()});
 assert.equal(quizReads,2,'the quiz list is read again');
 assert.deepEqual(second.assignments.map(a=>a.id),['quiz-5']);
});
test('B1-10 a refusal (a late policy students may not read) is still kept, not asked for on every refresh',async()=>{
 let policyReads=0;const user={id:'9'};
 const client=req('api.js').createClient({retryDelays:[],fetchImpl:async url=>{
  const path=new URL(url).pathname;
  if(path==='/api/v1/users/self/profile')return response(user);
  if(path==='/api/v1/courses')return response([{id:'7',name:'Chemistry'}]);
  if(path==='/api/v1/courses/7/late_policy'){policyReads++;return response({message:'not allowed'},403);}
  return response([]);
 }});
 await client.loadSnapshot({user,verifiedAt:Date.now()});await client.loadSnapshot({user,verifiedAt:Date.now()});
 assert.equal(policyReads,1);
});
