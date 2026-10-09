'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../extension/ai-context.js');
const {create}=require('../extension/ai-source.js');
const origin='https://school.instructure.com',user={id:'7'};
function fixture(overrides={}){
 const ctx={courses:[{id:'10',name:'Chemistry'},{id:'20',name:'English'}],courseId:'10',aiAssignmentId:'1',items:[{id:'1',courseId:'10',name:'Lab',courseName:'Chemistry',description:'Read the guide.'}],s:{}};
 const calls=[],client={profile:async()=>user,readAssignment:async()=>{
  calls.push('assignment');return {id:'1',course_id:'10',name:'Lab',description:'<p>Compare the trials.</p><a href="/courses/10/pages/guide">Guide</a><a href="/courses/20/pages/private">Other course</a>',submission:{body:'Private answer'},rubric:[{description:'Use observations'}]};},
  readCoursePage:async(course,slug)=>{calls.push(course+':'+slug);return '<p>Use three trials.</p>';},...overrides};
 return {ctx,calls,client,source:create({getContext:()=>ctx,store:{owner:{origin,accountId:'7'}},client,user})};
}
test('Inject all includes fresh instructions and linked same-course pages, not unrelated grades or work',async()=>{
 const f=fixture();const result=await f.source.collect({all:true,ids:[]});
 assert.deepEqual(f.calls,['assignment','10:guide']);assert.equal(result.included.length,2);
 assert.match(result.text,/Use three trials/);assert.match(result.text,/Use observations/);assert.ok(!result.text.includes('Private answer'));
});
test('an account change during collection rejects the complete result',async()=>{
 let reads=0;const f=fixture({profile:async()=>({id:++reads===1?'7':'8'})});
 await assert.rejects(f.source.collect({ids:['assignment:10:1']}),/account changed/);
});
test('a navigation during a pending source read discards the old context',async()=>{
 const f=fixture();f.client.readAssignment=async()=>{f.ctx.aiAssignmentId=null;return {id:'1',name:'Old page',description:'Do not share stale text'};};
 await assert.rejects(f.source.collect({all:true}),/view changed/);
});
test('home requires choices, and rejects unknown IDs rather than looking up arbitrary resources',async()=>{
 const f=fixture();f.ctx.aiAssignmentId=null;
 assert.equal((await f.source.collect({ids:[]})).text,'');
 await assert.rejects(f.source.collect({all:true}),/Open an assignment/);
 await assert.rejects(f.source.collect({ids:['file:20:999']}),/selection changed/);
 assert.deepEqual(f.calls,[]);
});
test('failed linked reads are reported and never masquerade as extracted text',async()=>{
 const f=fixture({readCoursePage:async()=>{throw Error('Page locked');}});
 const result=await f.source.collect({all:true});assert.equal(result.included.length,1);
 assert.equal(result.omitted[0].reason,'Page locked');assert.ok(!result.text.includes('Page locked'));
});
test('oversized PDFs are skipped before any download request',async()=>{
 const f=fixture({readAssignment:async()=>({id:'1',name:'Lab',description:'<a href="/courses/10/files/24">PDF</a>'}),readFile:async()=>({id:'24',size:3*1024*1024,url:origin+'/files/24/download'})});
 const result=await f.source.collect({all:true});assert.match(result.omitted[0].reason,/2 MiB/);
});
test('malformed URLs and files owned by another course are not followed',()=>{
 const links=globalThis.CanvasHarnessContext.links('<a href="/courses/20/files/24/download">x</a><a href="/courses/10/pages/%E0%A4%A">bad encoding</a><a href="/files/25">allowed reference</a>',origin,'10');
 assert.equal(links.length,1);assert.equal(links[0].fileId,'25');
});
test('explicitly loading another course makes its sources selectable without changing the active assignment',async()=>{
 const f=fixture({loadCourseResources:async id=>({origin,accountId:'7',courseId:id,frontPage:{body:'Selected English reading'}})});
 const catalog=await f.source.loadCourse('20');assert.equal(catalog.active.id,'assignment:10:1');
 assert.ok(catalog.sources.some(s=>s.id==='home:20'));
 const result=await f.source.collect({ids:['home:20']});assert.match(result.text,/Selected English reading/);
});
