'use strict';
// What the wide Canvas benchmark (2026-10-23) found missing, pinned one by one: tag meaning kept as text, lock reasons,
// optional work, module rules, the syllabus, calendar events, big work further out and peer reviews still to give.
const {test}=require('node:test'),assert=require('node:assert/strict');
globalThis.ReserveUI||={escapeHTML:s=>String(s)};
const D=require('../extension/agent-data.js'),C=require('../extension/ai-context.js'),Core=require('../extension/core.js');
const now=Date.parse('2026-10-21T16:00:00Z'),course={id:'7',name:'Chemistry',teachers:[{id:'4'}]};
const build=(context,extra={})=>D.build({now,context:{user:{id:'9'},courses:[course],items:[],...context},data:{settings:{timeZone:'America/New_York'}},...extra});
const assignment=raw=>Core.normalizeAssignment({id:'12',name:'Work',due_at:'2026-10-23T03:59:00Z',submission_types:['online_upload'],...raw},course);

test('equations, image descriptions, embedded videos and table cells reach the AI as text',()=>{
 const html='<p>Solve <img class="equation_image" alt="LaTeX: x^2+3x-4=0" data-equation-content="x^2+3x-4=0"> by factoring.</p><img alt="Label the nucleus" src="/x.png"><iframe title="Photosynthesis" src="https://www.youtube.com/embed/abc?si=token"></iframe><table><tr><td>Thesis</td><td>20</td></tr></table>';
 const help=C.plain(html),agent=JSON.stringify(build({items:[assignment({description:html})]}).snapshot.items[0]);
 for(const text of [help,agent]){assert.match(text,/x\^2\+3x-4=0/);assert.match(text,/Label the nucleus/);assert.match(text,/youtube\.com\/embed\/abc/);assert.doesNotMatch(text,/token/);assert.match(text,/Thesis \| 20/);}
});
test('locked work says why, and work that does not count is marked optional',()=>{
 const rows=build({items:[assignment({id:'12',locked_for_user:true,lock_explanation:'<p>Finish <b>Unit 2</b> first.</p>'}),assignment({id:'13',omit_from_final_grade:true})]}).snapshot.items;
 assert.equal(rows.find(r=>r.id.endsWith(':12')).lockedBecause,'Finish Unit 2 first.');
 assert.equal(rows.find(r=>r.id.endsWith(':13')).optional,true);
});
test('module requirements and order are visible to the agent',()=>{
 const r=build({aiResources:[{courseId:'7',modules:[{id:5,name:'Unit 5',require_sequential_progress:true,prerequisite_module_ids:[4],items:[{type:'Page',title:'Notes',page_url:'notes',completion_requirement:{type:'must_view'}},{type:'Quiz',title:'Check',content_id:9,completion_requirement:{type:'min_score',min_score:80}}]}]}]}).snapshot.resources.find(x=>x.what==='module');
 assert.equal(r.inOrder,true);assert.deepEqual(r.after,['4']);assert.deepEqual(r.items.map(x=>x.needs),['view it','score at least 80']);
});
test('the syllabus is readable by the agent without another Canvas request',async()=>{
 const built=build({aiResources:[{courseId:'7',syllabusBody:'<p>Late work is accepted for three days.</p>'}]}),syllabus=built.snapshot.resources.find(x=>x.title==='Course syllabus');
 assert.ok(syllabus);
 const read=await D.createReader({index:built.index,client:{origin:'https://school.instructure.com'},user:{id:'9'}}).read({what:syllabus.what,id:syllabus.id});
 assert.match(read.text,/three days/);
});
test('Help adds the syllabus rules for late work, not the whole syllabus',()=>{
 const item=assignment({due_at:'2026-10-20T03:59:00Z',submission:{missing:true}}),{sources}=C.catalog({courses:[course],items:[item],s:{showGrades:false}},{origin:'https://school.instructure.com',resources:[{courseId:'7',syllabusBody:'<p>Welcome to chemistry.</p><p>Late work is accepted for three days.</p>'}],updates:[]});
 const pack=C.contextSources(sources,sources.find(s=>s.kind==='assignment'),{now}),policy=pack.find(s=>s.relationship==='Course policies (syllabus)');
 assert.match(policy.text,/three days/);assert.doesNotMatch(policy.text,/Welcome/);
});
test('class events from the course calendar inside the window reach the plan; others do not',()=>{
 const events=[{id:1,title:'Unit 4 test',start_at:'2026-10-23T13:00:00Z',context_code:'course_7'},{id:2,title:'Far away',start_at:'2026-12-23T13:00:00Z',context_code:'course_7'},{id:3,title:'Other course',start_at:'2026-10-23T13:00:00Z',context_code:'course_8'},{id:4,title:'Deleted',start_at:'2026-10-23T13:00:00Z',context_code:'course_7',workflow_state:'deleted'}];
 assert.deepEqual(build({calendarEvents:events}).snapshot.events.map(e=>e.title),['Unit 4 test']);
});
test('calendar events load with one GET per ten courses and stop on an account change',async()=>{
 const calls=[],client={origin:'https://school.instructure.com',profile:async()=>({id:'9'}),list:async path=>{calls.push(path);return [{id:1,title:'Trip',start_at:'2026-10-24T13:00:00Z',context_code:'course_7'},{id:2,title:'Stranger',context_code:'course_99'}];}};
 const courses=Array.from({length:12},(_,i)=>({id:String(i+1)})),rows=await D.loadCalendarEvents({client,user:{id:'9'},courses,now});
 assert.equal(calls.length,2);assert.ok(calls.every(p=>p.startsWith('/api/v1/calendar_events?type=event&')));assert.deepEqual(rows.map(r=>r.title),['Trip']);
 await assert.rejects(D.loadCalendarEvents({client:{...client,profile:async()=>({id:'10'})},user:{id:'9'},courses,now}),/account changed/);
});
test('big work up to five weeks out and peer reviews still to give stay in view',()=>{
 const rows=build({items:[assignment({id:'20',name:'Science fair project',points_possible:200,due_at:'2026-11-20T03:59:00Z'}),assignment({id:'21',name:'Worksheet',points_possible:5,due_at:'2026-11-20T03:59:00Z'}),assignment({id:'22',name:'Essay draft',due_at:'2026-10-19T03:59:00Z',peer_reviews:true,peer_reviews_assign_at:'2026-10-20T03:59:00Z',submission:{workflow_state:'submitted',submitted_at:'2026-10-18T03:59:00Z'}})]}).snapshot.items.map(r=>r.id.split(':').pop());
 assert.ok(rows.includes('20'));assert.ok(!rows.includes('21'));assert.ok(rows.includes('22'));
});
test('only recent verified staff Inbox messages are labelled teacher; peers, old and archived ones are not',()=>{
 const at=d=>new Date(now+d*86400000).toISOString(),conversations=[{id:1,subject:'Group',last_message:'I will do the slides.',last_message_at:at(-1),context_code:'course_7',participants:[{id:'9'},{id:'50'}]},{id:2,subject:'For tomorrow',last_message:'Bring your signed form.',last_message_at:at(-2),workflow_state:'unread',context_code:'course_7',participants:[{id:'9'},{id:'4'}]},{id:3,subject:'Old',last_message:'Last month.',last_message_at:at(-30),participants:[{id:'4'}]},{id:4,subject:'Archived',last_message:'Gone.',last_message_at:at(-1),workflow_state:'archived',participants:[{id:'4'}]}];
 conversations[1].instructionMessages=[{author_id:4,created_at:at(-2),message:'Bring your signed form.'}];conversations[2].instructionMessages=[{author_id:4,created_at:at(-30),message:'Last month.'}];conversations[3].instructionMessages=[{author_id:4,created_at:at(-1),message:'Gone.'}];
 const messages=build({conversations}).snapshot.messages,m=messages.filter(x=>x.from==='teacher');
 assert.equal(messages.find(x=>x.subject==='Group'),undefined,'a classmate message never reaches the AI');
 assert.deepEqual(m.map(x=>[x.subject,x.from]),[['Teacher Inbox instruction','teacher']]);assert.equal(m[0].unread,true);assert.equal(m[0].courseId,'7');
});
test('with grades hidden, score sentences in Inbox messages are withheld',()=>{
 const m=build({conversations:[{id:1,subject:'Quiz',last_message:'You scored 7 out of 10 on the quiz. Bring your notes tomorrow.',last_message_at:new Date(now-3600000).toISOString(),context_code:'course_7',participants:[{id:'4'}],instructionMessages:[{author_id:4,created_at:new Date(now-3600000).toISOString(),message:'You scored 7 out of 10 on the quiz. Bring your notes tomorrow.'}]}]}).snapshot.messages;
 assert.doesNotMatch(m[0].text,/7 out of 10/);assert.match(m[0].text,/Bring your notes/);
});
test('the Inbox loads through the existing summary read and a failure only leaves it empty',async()=>{
 const calls=[];assert.equal((await D.loadInbox({client:{origin:'https://school.instructure.com',listInbox:async o=>{calls.push(o);return {conversations:[{id:1}]};}},user:{id:'9'}})).length,1);assert.equal(calls.length,1);
 assert.deepEqual(await D.loadInbox({client:{origin:'https://school.instructure.com',listInbox:async()=>{throw Error('network');}},user:{id:'9'}}),[]);
 await assert.rejects(D.loadInbox({client:{origin:'https://school.instructure.com',listInbox:async()=>{throw Object.assign(Error('changed'),{code:'account'});}},user:{id:'9'}}),/changed/);
});
test('a graded discussion asked for as a discussion is read as its assignment',async()=>{
 const raw={id:'31',name:'Forum: the environment',submission_types:['discussion_topic'],due_at:'2026-10-23T03:59:00Z',description:'<p>Post 150 words, reply to two classmates.</p>'},built=build({items:[Core.normalizeAssignment(raw,course)]}),row=built.snapshot.items[0];
 const read=await D.createReader({index:built.index,client:{origin:'https://school.instructure.com',readAssignment:async()=>raw},user:{id:'9'}}).read({what:'discussion',id:row.id});
 assert.equal(read.error,undefined);assert.match(read.text,/reply to two classmates/);
});
