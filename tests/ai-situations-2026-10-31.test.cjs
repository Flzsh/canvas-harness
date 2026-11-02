'use strict';
// The AI pipeline across different Canvas setups. Every test runs the real client, scan and runner over a fake Canvas
// (ai-situations-fixture.cjs) and judges the prompt the AI would get: does the data arrive, does the run go on when one piece fails, and is the AI told what is missing instead of being left to guess.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness,reply,task,origin,scope,now,at}=require('./ai-situations-fixture.cjs'),API=require('../extension/api.js'),Bridge=require('../extension/ai-canvas-bridge.js'),Brief=require('../extension/prepare-brief.js'),C=require('../extension/ai-context.js');
const SOURCES=p=>p.slice(p.indexOf('<<<SOURCE ')),UNREAD=/<<<SOURCE \d+: Could not be read>>>\n([\s\S]*?)<<<END/,refused={status:'unauthorized',errors:[{message:'user not authorized to perform that action'}]},signedOut={status:'unauthenticated',errors:[{message:'user authorization required'}]},student={type:'student',enrollment_state:'active'};
const sample=(id,name)=>({id,name,teachers:[{id:'2'}],enrollments:[student]}),two=[sample('1','Sample Science'),sample('2','Sample History')];
const guide=(extra={})=>({id:'55',display_name:'Guide.txt',size:90,course_id:'1','content-type':'text/plain',...extra});

// [situation, an older test that also covers it ('' = none), where it is pinned]. `old:` names a test in another file; a name
// without a prefix is a test below. 'open:' rows are not fixed: see the note.
const SITUATIONS=[
 ['Custom Canvas domain (canvas.school.edu)','','open: not yet tried on a school address outside instructure.com'],
 ['Link to the same Canvas through its other host name','','open: same reason, an absolute link on another host reads as external'],
 ['Student in another time zone, with the zone set','','the brief and the clock line use the student\'s own time zone'],
 ['Student in another time zone, zone left at the default','','open: settings.timeZone defaults to Eastern; following the browser or the Canvas profile changes every date in the extension, so it needs a decision of its own'],
 ['Non-English Canvas: translated error replies','','a translated 401 with a live session costs one piece; a translated signed-out session still stops'],
 ['Non-English course text','','Spanish, Arabic, Hebrew and Chinese text reach the prompt unchanged'],
 ['RTL and CJK text','','Spanish, Arabic, Hebrew and Chinese text reach the prompt unchanged'],
 ['New Quizzes (LTI) with a generic title','','a New Quiz or classic quiz is marked as a test even when its title does not say so'],
 ['New Quizzes while the student is taking one','','open: taking happens on the normal assignment address inside a frame; telling that from reading needs a design decision'],
 ['Assignment Enhancements student view','','none needed: the pipeline reads the API, never that page; only the PDF side card reads it and falls back to #content'],
 ['External tools: Turnitin, Google Assignments, McGraw-Hill, Pearson, Cengage, Khan, Gradescope','','outside-tool work names its tool in the brief and says its content is not in the materials'],
 ['File-only assignment','','a file-only assignment reaches the prompt through any link form Canvas writes'],
 ['Empty description, nothing attached','','an empty item says so instead of leaving only its title'],
 ['Instructions on a module page','','a page in the item\'s module is offered, and read when the AI asks for it'],
 ['Instructions in the syllabus, near the end of a long one','','the syllabus lines that name the item arrive even from far down a long syllabus'],
 ['Instructions in an announcement','','instructions posted only in an announcement reach the prompt'],
 ['Instructions in a linked Google Doc','old:Help reads the Doc the assignment links into its materials; Slides it cannot read are named, never guessed, and','Google and Office 365 links are named as unread'],
 ['Instructions in a linked Office 365 or OneDrive document','','Google and Office 365 links are named as unread'],
 ['Discussion that requires a post first','','a discussion prompt kept on its topic reaches the prompt, and classmates stay out until the student posts'],
 ['Discussion checkpoints with no date on the item','','checkpoint dates stand in for a discussion with no due date of its own'],
 ['Peer reviews','','open: GET /courses/:id/peer_reviews is not a documented Canvas route, so real Canvas likely answers 404 and the list is empty; the documented route is per assignment, one more GET each'],
 ['Locked and unlock-dated items','','a locked item is never called empty, and its reason reaches the brief'],
 ['Module prerequisites','old:module requirements and order are visible to the agent','a locked item is never called empty, and its reason reaches the brief'],
 ['Teacher hid Files, Pages, Modules, Syllabus, Quizzes or Announcements: 401','','a hidden tab costs one piece, whichever of 401, 403 or 404 Canvas answers'],
 ['Teacher hid Files, Pages, Modules, Syllabus, Quizzes or Announcements: 403 or 404','','a hidden tab costs one piece, whichever of 401, 403 or 404 Canvas answers'],
 ['Assignments list refused for one course','','one course that cannot be read is named and the others carry on'],
 ['Grades tab hidden, totals hidden, muted scores','old:normalizeCourse respects hide_final_grades even if score fields are present','no score reaches a prompt with grades off, hidden totals, muted scores or pass/fail'],
 ['Modules-only course with Files and Pages hidden','','a modules-only course with Files and Pages hidden still offers its module files'],
 ['Pages-only course with no assignments','','a pages-only course runs and says nothing is due'],
 ['Rate limit 403 with X-Rate-Limit-Remaining','','a rate-limit 403 is retried through the page bridge, which must pass the header on'],
 ['Rate limit that does not clear','','a rate limit that does not clear costs that piece and says so'],
 ['Pagination','old:pagination loads later assignments and never sends a write request','long courses page through Link headers into the brief'],
 ['No courses at all','','no course at all asks no AI; a question still goes'],
 ['Fifteen courses','','fifteen heavy courses fit: every item and every announcement survive, within the request ceiling'],
 ['Future course not open yet (access_restricted_by_date)','','a course that is not open yet is left out without one request'],
 ['Drop rules','old:drop rules, unknown rules, grade overrides, invalid weights and extra credit refuse every calculation',''],
 ['Pass/fail','','no score reaches a prompt with grades off, hidden totals, muted scores or pass/fail'],
 ['Letter grades only','old:restrict_quantitative_data',''],
 ['Observer or TA with no student enrollment','','no course at all asks no AI; a question still goes'],
 ['Huge syllabus','','the syllabus lines that name the item arrive even from far down a long syllabus'],
 ['Assignments with no due date','','undated online work is in the brief and can be helped with; undated in-class rows stay out'],
 ['Very long course names','','long and odd names do not break the run'],
 ['Emoji and odd characters','','a cut emoji leaves no half character in a prompt'],
 ['Broken HTML','','broken HTML finishes quickly and keeps its words'],
 ['Tables, equations, images or video as the only instructions','old:equations, image descriptions, embedded videos and table cells reach the AI as text','picture-only and equation-only instructions are not called empty in the brief'],
 ['Attachment too big, scanned, a slide deck or deleted','','each kind of unreadable file is named to the AI'],
 ['File hidden in Files but linked from the assignment','','a file hidden in Files survives the check before sending'],
 ['File or page linked through ?preview=, /wiki/ or a module item','','every link form Canvas writes reaches the file or page'],
 ['Link to another course, a teacher\'s own files, a quiz or a tool','','links out of reach on the same Canvas are named'],
 ['Passwords and access codes in instructions','','login lines and e-mail addresses in an item\'s own text never reach the AI'],
 ['Resubmission requested','','a redo request brings submitted work back'],
 ['Inbox, calendar, nicknames or groups turned off','old:the Inbox loads through the existing summary read and a failure only leaves it empty','side features turned off do not stop a run'],
 ['To-do dates on ungraded pages and discussions','','open: these live only in the Planner API, which is not read here; a new endpoint is a feature, not a fix'],
];

test('the situation table stays honest: at least 40 rows, and every test it names exists',()=>{
 assert.ok(SITUATIONS.length>=40);const here=fs.readFileSync(__filename,'utf8').replace(/\\'/g,"'");
 const old=[...fs.readdirSync(__dirname).filter(f=>/\.test\.cjs$/.test(f)&&f!==path.basename(__filename)).map(f=>fs.readFileSync(path.join(__dirname,f),'utf8'))].join('\n').replace(/\\'/g,"'");
 for(const [name,before,pinned]of SITUATIONS){assert.equal(typeof name,'string');
  if(before)assert.ok(before.startsWith('old:')&&old.includes(before.slice(4)),name+': '+before);
  if(pinned&&!/^(?:open:|none needed:)/.test(pinned))assert.ok(here.includes("test('"+pinned),name+': '+pinned);}
});

// ---- One piece fails, the run goes on ----
for(const [status,body]of [[401,refused],[403,{}],[404,{message:'That page has been disabled for this course'}]])test('a hidden tab costs one piece, whichever of 401, 403 or 404 Canvas answers: '+status,async()=>{
 for(const [piece,match]of [['files',/\/courses\/1\/files\?/],['pages',/\/courses\/1\/pages\?/],['modules',/\/courses\/1\/modules\?/],['announcements',/\/api\/v1\/announcements/],['syllabus',/\/api\/v1\/courses\/1\?include/]]){
  const h=harness({assignments:{1:[task()]},routes:[{match,status,body}]}),{run,prompt}=await h.prepare();
  assert.equal(run.state,'awaiting-reply',piece);assert.match(prompt,/Finish the sample task/,piece);assert.match(prompt,new RegExp('Canvas would not show these[^\\n]*\\n- Sample Science: '+piece),piece);
 }
 for(const match of [/\/quizzes\?/,/\/assignment_groups\?/,/\/late_policy/,/\/peer_reviews/,/\/tabs\?/]){const {run,prompt}=await harness({assignments:{1:[task({peer_reviews:true})]},routes:[{match,status,body}]}).prepare();assert.equal(run.state,'awaiting-reply',String(match));assert.match(prompt,/Finish the sample task/);assert.doesNotMatch(prompt,/Canvas would not show/,'a side list is not worth a line');}
});
test('a section the teacher hid is told to the AI but is no fault on the student\'s screen',()=>{
 const read=name=>require('node:fs').readFileSync(require('node:path').join(__dirname,'../extension',name),'utf8');
 assert.match(read('api.js'),/\['403','404'\]\.includes\(String\(error\?\.code\)\)\?\{hidden:true\}/,'the reader still records it, marked');
 assert.match(read('course-hub-ui.js'),/filter\(error=>!error\.hidden&&/,'the hub leaves it out');
 assert.match(read('materials-ui.js'),/const faults=raw=>\(raw\?\.errors\|\|\[\]\)\.filter\(e=>!e\.hidden\)/,'Materials leaves it out');
});
test('a translated 401 with a live session costs one piece; a translated signed-out session still stops',async()=>{
 const said={status:'no autorizado',errors:[{message:'usuario no autorizado'}]};
 const live=harness({assignments:{1:[task()]},routes:[{match:/\/courses\/1\/files\?/,status:401,body:said}]});assert.match((await live.prepare()).prompt,/Sample Science: files/);
 const gone=harness({assignments:{1:[task()]},routes:[{match:/\/profile|\/courses\/1\/files\?/,status:401,body:said}]});await assert.rejects(gone.prepare(),e=>e.code==='auth');
});
test('a session that really ended still stops the run, in the reply\'s own words or through the profile',async()=>{
 await assert.rejects(harness({assignments:{1:[task()]},routes:[{match:/\/courses\/1\/files\?/,status:401,body:signedOut}]}).prepare(),e=>e.code==='auth');
 const client=API.createClient({origin,retryDelays:[],fetchImpl:async()=>reply({},{status:401})});await assert.rejects(client.list('/api/v1/courses'),e=>e.code==='auth');
 const profile=API.createClient({origin,retryDelays:[],fetchImpl:async()=>reply(refused,{status:401})});await assert.rejects(profile.profile(),e=>e.code==='auth');
});
test('many refused pieces check the session once, and the check counts toward the request ceiling',async()=>{
 const profiles=w=>w.calls.filter(c=>/profile/.test(c)).length,calm=harness({assignments:{1:[task()]}}),h=harness({assignments:{1:[task()]},routes:[{match:/\/courses\/1\/(?:files|pages|modules)\?/,status:401,body:refused}]});await calm.prepare();await h.prepare();assert.equal(profiles(h),profiles(calm)+1);
 let gets=0;const tight=API.createClient({origin,retryDelays:[],requestLimit:1,fetchImpl:async()=>{gets++;return reply(refused,{status:401});}});await assert.rejects(tight.list('/api/v1/courses/1/files?per_page=100'),e=>e.code==='limit');assert.equal(gets,1,'no second GET past the ceiling');
 const client=API.createClient({origin,retryDelays:[],fetchImpl:async url=>/profile/.test(url)?reply({id:'7'},{url}):reply(refused,{status:401,url})});await assert.rejects(client.list('/api/v1/courses/1/files?per_page=100'),e=>e.code==='403');assert.deepEqual(client.sourceErrors().map(e=>[e.courseId,e.source,e.code]),[['1','files','403']]);
});
test('one course that cannot be read is named and the others carry on',async()=>{
 for(const status of [403,404,500]){const h=harness({courses:two,assignments:{1:[task()]},routes:[{match:/\/courses\/2\/assignments\?/,status,body:{}}]}),{run,prompt,brief}=await h.prepare();assert.equal(run.state,'awaiting-reply');assert.match(prompt,/Finish the sample task/);assert.match(brief,/would not show these[^\n]*\n- Sample History: assignments/);}
});
test('a whole Canvas that cannot be read stops with the reason instead of asking the AI about nothing',async()=>{
 await assert.rejects(harness({courses:two,routes:[{match:/\/assignments\?/,status:500,body:{}}]}).prepare(),/Canvas is incomplete/);
});
test('a course that is not open yet is left out without one request',async()=>{
 const h=harness({courses:[sample('1','Sample Science'),{id:'2',access_restricted_by_date:true}],assignments:{1:[task()]},routes:[{match:/\/courses\/2\b/,status:401,body:refused}]}),{run,brief}=await h.prepare();
 assert.equal(run.state,'awaiting-reply');assert.ok(!h.calls.some(c=>/\/courses\/2\b/.test(c)),'no read of a closed course');assert.match(brief,/^Courses: Sample Science\n/);assert.doesNotMatch(brief,/would not show|undefined/);
 assert.equal((await harness({courses:[{id:'2',access_restricted_by_date:true}]}).client.loadSnapshot()).partial,false);
});
test('side features turned off do not stop a run',async()=>{
 const h=harness({assignments:{1:[task()]},routes:[{match:/conversations/,status:401,body:refused},{match:/calendar_events/,status:403,body:{}},{match:/course_nicknames/,status:401,body:refused},{match:/users\/self\/groups/,status:404,body:{}},{match:/enrollment_type=student&include\[\]=teachers/,status:500,body:{}}]}),{run,prompt}=await h.prepare();
 assert.equal(run.state,'awaiting-reply');assert.match(prompt,/Finish the sample task/);
});
test('a rate-limit 403 is retried through the page bridge, which must pass the header on',async()=>{
 let listener,sent=0;const env={chrome:{runtime:{id:'x',onMessage:{addListener:fn=>{listener=fn;},removeListener(){}}}},document:{},location:{origin,href:origin+'/'},setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'latin1').toString('base64')};
 Bridge.serve({env,scope,fetchImpl:async url=>++sent===1?reply('',{status:403,headers:{'x-rate-limit-remaining':'0.0'},url}):reply([{id:'1'}],{url})});
 const chrome={tabs:{query:async()=>[{id:1}],get:async id=>({id,url:origin+'/'}),sendMessage:(id,message)=>new Promise(resolve=>listener(message,{id:'x'},resolve))}},read=Bridge.createFetch({chrome,run:{scope,sourceTab:1},atob:s=>Buffer.from(s,'base64').toString('latin1')});
 const waits=[],client=API.createClient({origin,fetchImpl:read,retryDelays:[7],wait:async ms=>{waits.push(ms);}});assert.deepEqual(await client.list('/api/v1/courses/1/assignments?per_page=100'),[{id:'1'}]);assert.deepEqual(waits,[7]);assert.equal(sent,2);
});
test('a rate limit that does not clear costs that piece and says so',async()=>{
 const h=harness({retryDelays:[1,1],assignments:{1:[task()]},routes:[{match:/\/courses\/1\/files\?/,status:403,body:'403 Forbidden (Rate Limit Exceeded)',headers:{'content-type':'text/plain','x-rate-limit-remaining':'0'}}]}),{run,brief}=await h.prepare();
 assert.equal(run.state,'awaiting-reply');assert.match(brief,/Sample Science: files/);assert.equal(h.calls.filter(c=>/\/courses\/1\/files\?/.test(c)).length,3,'first try and two retries');
});
test('long courses page through Link headers into the brief',async()=>{
 const rows=Array.from({length:250},(_,i)=>task({id:String(1000+i),name:'Task '+i,due_at:at(i<245?-90:9),description:''})),link=n=>({link:'<'+origin+'/api/v1/courses/1/assignments?per_page=100&page='+n+'>; rel="next",<'+origin+'/api/v1/courses/1/assignments?per_page=100&page=3>; rel="last"'});
 const h=harness({routes:[{match:/\/courses\/1\/assignments\?.*page=3/,body:rows.slice(200)},{match:/\/courses\/1\/assignments\?.*page=2/,body:rows.slice(100,200),headers:link(3)},{match:/\/courses\/1\/assignments\?/,body:rows.slice(0,100),headers:link(2)}]}),{run,brief}=await h.prepare();
 assert.equal(Object.keys(run.snapshot.brief.refs).length,5);assert.match(brief,/Task 249/);
});
test('no course at all asks no AI; a question still goes',async()=>{
 const none=await harness({courses:[]}).prepare();assert.equal(none.run.state,'unchanged');assert.equal(none.run.progress,'Nothing needs help today');assert.equal(none.run.turns.length,0);
 assert.equal((await harness({courses:[]}).ask('What is a mole?')).run.state,'awaiting-reply');
});
test('a pages-only course runs and says nothing is due',async()=>{
 const {run,brief}=await harness({pages:{1:[{url:'week-1',title:'Week 1',body:'<p>Read chapter 1.</p>'}]}}).prepare();assert.equal(run.state,'awaiting-reply');assert.match(brief,/Nothing is due in the next 7 days/);
});
test('fifteen heavy courses fit: every item and every announcement survive, within the request ceiling',async()=>{
 const courses=Array.from({length:15},(_,i)=>sample(String(i+1),'Sample Course '+(i+1))),assignments={},announcements={};
 for(const c of courses){assignments[c.id]=[0,1,2].map(k=>task({id:String(100+Number(c.id)*10+k),course_id:c.id,name:'Task '+c.id+'-'+k,description:'<p>'+'Read and annotate the assigned pages. '.repeat(50)+'</p>'}));announcements[c.id]=[{id:'9'+c.id,title:'Test moved '+c.id,message:'<p>The test moved to Friday.</p>',posted_at:at(-1),author:{id:'2'},context_code:'course_'+c.id}];}
 const h=harness({courses,assignments,announcements}),{brief}=await h.prepare();
 assert.ok(brief.length<=Brief.LIMITS.total);assert.doesNotMatch(brief,/cut short/);assert.equal((brief.match(/Test moved \d+/g)||[]).length,15);assert.equal((brief.match(/\[A\d+\]/g)||[]).length,45);assert.ok(h.calls.length<1200);
});

// ---- The brief says what is true ----
test('undated online work is in the brief and can be helped with; undated in-class rows stay out',async()=>{
 const rows=[...Array.from({length:12},(_,i)=>task({id:String(30+i),name:'Self-paced unit '+i,due_at:null})),task({id:'50',name:'Class participation',due_at:null,submission_types:['none']}),task({id:'51',name:'Handed in',due_at:null,submission:{submitted_at:at(-1),workflow_state:'submitted'}})],h=harness({assignments:{1:rows}}),{brief,run}=await h.prepare();
 assert.match(brief,/No due date:\n- \[A1\] Sample Science · Self-paced unit 0 · 10 pts · upload a file/);assert.equal((brief.match(/Self-paced unit/g)||[]).length,8,'at most eight');assert.doesNotMatch(brief,/Class participation|Handed in/);assert.equal(run.snapshot.brief.refs.A1.id,'30');
 const help=await h.help('30');assert.match(help.prompt,/The item: Sample Science · Self-paced unit 0\n/,'no invented date');
});
test('a locked item is never called empty, and its reason reaches the brief',async()=>{
 const {brief}=await harness({assignments:{1:[task({description:null,locked_for_user:true,lock_explanation:'<p>This assignment is part of <b>Unit 2</b>. Complete that module first.</p>'})]}}).prepare();
 assert.match(brief,/locked in Canvas\n  Instructions: not visible while it is locked \(This assignment is part of Unit 2 ?\. Complete that module first ?\.\)/);assert.doesNotMatch(brief,/none posted/);
 const help=await harness({assignments:{1:[task({description:null,locked_for_user:true})]}}).help('21');assert.match(help.prompt.match(UNREAD)[1],/Sample task: This source is locked or unavailable/);assert.match(help.prompt,/Do not guess what they say/);
});
test('picture-only and equation-only instructions are not called empty in the brief',async()=>{
 const first=async description=>(await harness({assignments:{1:[task({description})]}}).prepare()).brief;
 assert.match(await first('<img src="/courses/1/files/9/preview" alt="">'),/Instructions: posted as an image or video that cannot be read here/);assert.match(await first('<video src="https://cdn.example/a.mp4"></video>'),/posted as an image or video/);
 assert.match(await first('<p><img class="equation_image" alt="LaTeX: x^2+1" data-equation-content="x^2+1" src="/equation_images/x"></p>'),/Instructions: \\\(x\^2\+1\\\)/);
 assert.match(await first('<iframe title="Lab video" src="https://www.youtube.com/embed/abc?si=token"></iframe>'),/\[Embedded: Lab video https:\/\/www\.youtube\.com\/embed\/abc\]/);
 assert.match(await first('<table><tr><td>Part A</td><td>Graph the data</td></tr></table>'),/Part A \| Graph the data/);assert.match(await first('<img src="/x.png" alt="Label the nucleus">'),/\[Image: Label the nucleus\]/);
 assert.match(await first(''),/Instructions: none posted in Canvas/,'really empty stays empty');
});
test('the brief keeps a comparison the teacher wrote: text it already cleaned is not stripped again',async()=>{
 const {brief}=await harness({assignments:{1:[task({description:'<p>Keep x &lt; 3 and y &gt; 2, then &#8220;round&#8221; it.</p>'})]}}).prepare();assert.match(brief,/Keep x < 3 and y > 2, then “round” it\./);
});
test('an empty item says so instead of leaving only its title',async()=>{
 const {prompt}=await harness({assignments:{1:[task({description:null,name:'Reading check'})]}}).help('21');assert.match(SOURCES(prompt),/Reading check\n\nThe teacher posted no instructions for this item in Canvas\./);
});
test('a discussion prompt kept on its topic reaches the prompt, and classmates stay out until the student posts',async()=>{
 const raw=task({description:null,submission_types:['discussion_topic'],group_category_id:'3',discussion_topic:{id:'40',message:'<p>Post your claim about the river.</p>',require_initial_post:true,user_can_see_posts:false}}),h=harness({assignments:{1:[raw]}});
 assert.match((await h.prepare()).brief,/Instructions: Post your claim about the river\./);assert.match(SOURCES((await h.help('21')).prompt),/Teacher instructions: Sample task>>>\nSample task\n\nPost your claim about the river\./);
});
test('checkpoint dates stand in for a discussion with no due date of its own',async()=>{
 const h=harness({assignments:{1:[task({due_at:null,has_sub_assignments:true,submission_types:['discussion_topic'],checkpoints:[{tag:'reply_to_topic',due_at:at(1)},{tag:'reply_to_entry',due_at:at(3)}]})]}}),{brief}=await h.prepare();
 assert.match(brief,/Due in the next 7 days:\n- \[A1\] Sample Science · Sample task — due Thu, Oct 22, 12:00 PM \(tomorrow\)/);assert.ok(h.calls.some(c=>/\/assignments\?.*include\[\]=checkpoints/.test(c)),'the list asks Canvas for them');
});
test('a redo request brings submitted work back',async()=>{
 const {brief}=await harness({assignments:{1:[task({submission:{workflow_state:'graded',submitted_at:at(-3),redo_request:true}})]}}).prepare();assert.match(brief,/\[A1\] Sample Science · Sample task[^\n]*the teacher asked for it again/);
});
test('a New Quiz or classic quiz is marked as a test even when its title does not say so',async()=>{
 for(const extra of [{is_quiz_lti_assignment:true,submission_types:['external_tool'],external_tool_tag_attributes:{url:'https://sample.quiz-lti-iad-prod.instructure.com/lti/launch'}},{submission_types:['external_tool'],external_tool_tag_attributes:{url:'https://sample.quiz-lti-iad-prod.instructure.com/lti/launch'}},{is_quiz_assignment:true,submission_types:['online_quiz']}]){const {brief}=await harness({assignments:{1:[task({name:'Unit 6 check',...extra})]}}).prepare();assert.match(brief,/Unit 6 check[^\n]*· test or quiz/);assert.doesNotMatch(brief,/quiz-lti/,'not its launch address');}
});
test('outside-tool work names its tool in the brief and says its content is not in the materials',async()=>{
 for(const [url,host]of [['https://lti.turnitin.com/launch','lti.turnitin.com'],['https://assignments.google.com/lti/a','assignments.google.com'],['https://newconnect.mheducation.com/lti','newconnect.mheducation.com'],['https://mylabmastering.pearson.com/lti','mylabmastering.pearson.com'],['https://ng.cengage.com/lti','ng.cengage.com'],['https://www.khanacademy.org/lti','khanacademy.org'],['https://www.gradescope.com/auth/lti','gradescope.com']]){
  const h=harness({assignments:{1:[task({description:'',submission_types:['external_tool'],external_tool_tag_attributes:{url}})]}}),{brief}=await h.prepare(),{prompt}=await h.help('21');
  assert.ok(brief.includes('outside tool ('+host+')'),host);assert.ok(SOURCES(prompt).includes('Source not available: this work is done in '+host+'; what is there is not in these materials.'),host);
 }
 const unnamed=await harness({assignments:{1:[task({description:'',submission_types:['external_tool']})]}}).help('21');assert.match(SOURCES(unnamed.prompt),/this work is done in an outside tool/);
});
test('hyphenated course names stay whole; a name that carries its teachers still shortens',()=>{
 for(const name of ['Pre-Calculus','Pre-Algebra','Anglo-Saxon History','Non-Western Art','Spanish-English Translation'])assert.equal(Brief.courseName(name),name);assert.equal(Brief.courseName('AP Sample-Doe-Roe'),'Sample');assert.equal(Brief.courseName('Honors Sample'),'Sample');assert.equal(Brief.courseName('Capstone Seminar'),'Capstone Seminar');
});
test('Spanish, Arabic, Hebrew and Chinese text reach the prompt unchanged',async()=>{
 for(const words of ['Escribe un párrafo sobre el río.','اكتب مقالة عن النهر','כתבו חיבור על הנהר','写一篇关于河流的短文']){const h=harness({courses:[sample('1',words)],assignments:{1:[task({name:words,description:'<p>'+words+'</p>'})]}}),{brief}=await h.prepare(),{prompt}=await h.help('21');assert.ok(brief.includes('Instructions: '+words),words);assert.ok(SOURCES(prompt).includes(words),words);}
});
test('the brief and the clock line use the student\'s own time zone',async()=>{
 for(const [zone,due,shown]of [['Asia/Tokyo','2026-10-23T15:30:00Z','Sat, Oct 24, 12:30 AM'],['Asia/Kolkata','2026-10-23T15:30:00Z','Fri, Oct 23, 9:00 PM'],['America/Los_Angeles','2026-10-24T03:59:00Z','Fri, Oct 23, 8:59 PM'],['Australia/Sydney','2026-10-23T13:30:00Z','Sat, Oct 24, 12:30 AM']]){const h=harness({zone,assignments:{1:[task({due_at:due})]}}),{brief,prompt}=await h.prepare();assert.ok(brief.includes('due '+shown),zone);assert.ok(prompt.includes('Student time zone: '+zone),zone);assert.ok((await h.help('21')).prompt.includes('— due '+shown),zone);}
});
test('a cut emoji leaves no half character in a prompt',async()=>{
 const name='😀'.repeat(200),h=harness({courses:[sample('1',name)],assignments:{1:[task({name})]}}),half=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
 assert.doesNotMatch((await h.prepare()).prompt,half);assert.doesNotMatch((await h.help('21')).prompt,half);
});
test('long and odd names do not break the run',async()=>{
 const name='2026-27 Fall Semester — Advanced Placement Sample Studies and Composition — Section 003 (Mon/Wed/Fri 8:00-9:15) ™ <b> & "quoted" '.repeat(2),h=harness({courses:[sample('1',name)],assignments:{1:[task({name:'Task: "A" & <B> ™ '+'x'.repeat(240)})]}});
 assert.equal((await h.prepare()).run.state,'awaiting-reply');assert.equal((await h.help('21')).run.state,'awaiting-reply');
});
test('odd Canvas rows do not crash a run',async()=>{
 const h=harness({courses:[{id:'1',name:null,course_code:null,teachers:null,enrollments:null}],assignments:{1:[task({name:null}),task({id:'22',rubric:null,submission_types:null,description:123,due_at:'not-a-date',lock_explanation:null,discussion_topic:{},checkpoints:[{}],points_possible:null}),task({id:'23',submission:null,external_tool_tag_attributes:{url:'not a url'}})]},modules:{1:[{id:'5',name:null,items:null},{id:'6',items:[{},{type:'Page'},{type:'File'}]}]},announcements:{1:[{id:'8',title:null,message:null,posted_at:null,author:null}]},pages:{1:[{url:null,title:null}]},files:{1:[{id:'9'},{id:null}]}});
 assert.equal((await h.prepare()).run.state,'awaiting-reply');assert.equal((await h.help('22')).run.state,'awaiting-reply');
});
test('broken HTML finishes quickly and keeps its words',async()=>{
 const body='<table><tr><td>Part A<td><b>Part <i>B</table><p>Do the <a href="/courses/1/pages/x">rest'.repeat(2000),h=harness({assignments:{1:[task({description:body})]}}),started=Date.now(),{prompt}=await h.help('21');assert.match(prompt,/Part A/);assert.ok(Date.now()-started<5000,'a pathological page must not hang');
});

// ---- A Help card is made from what is really there ----
test('the syllabus lines that name the item arrive even from far down a long syllabus',async()=>{
 const body='<p>'+'General course policy text goes here for many lines. '.repeat(10000)+'</p><table><tr><td>Week 9 reading</td><td>Chapters 11 and 12, the river delta model</td></tr></table>',h=harness({assignments:{1:[task({name:'Week 9 reading',description:''})]},syllabus:{1:body}}),{prompt}=await h.help('21');
 assert.ok(body.length>500000);assert.match(prompt,/Chapters 11 and 12, the river delta model/);assert.ok(prompt.length<60000);
});
test('instructions posted only in an announcement reach the prompt',async()=>{
 const {prompt}=await harness({assignments:{1:[task({description:''})]},announcements:{1:[{id:'8',title:'Sample task directions',message:'<p>Answer questions 4 to 9 from the handout.</p>',posted_at:at(-1),author:{id:'2'},context_code:'course_1'}]}}).help('21');assert.match(prompt,/Answer questions 4 to 9/);
});
test('a page in the item\'s module is offered, and read when the AI asks for it',async()=>{
 const h=harness({assignments:{1:[task({name:'Lab 3',description:''})]},modules:{1:[{id:'5',name:'Unit 3',items:[{id:'900',type:'Page',title:'Lab 3 directions',page_url:'lab-3-directions'},{id:'901',type:'Assignment',title:'Lab 3',content_id:'21'}]}]},pages:{1:[{url:'lab-3-directions',title:'Lab 3 directions',body:'<p>Measure the river flow twice.</p>',updated_at:at(-1)}]}}),{run,prompt}=await h.help('21');
 assert.match(prompt,/L1: Lab 3 directions/);assert.doesNotMatch(prompt,/Measure the river flow/);run.turns[run.turnIndex].reply='```json\n{"read":["L1"]}\n```';await h.step(run);await h.drive(run);assert.match(run.messages[0].content,/Course file: Lab 3 directions>>>\nMeasure the river flow twice\./);
});
test('a modules-only course with Files and Pages hidden still offers its module files',async()=>{
 const h=harness({assignments:{1:[task({description:''})]},modules:{1:[{id:'5',name:'Unit 1',items:[{id:'901',type:'File',title:'Guide.txt',content_id:'55'},{id:'903',type:'Page',title:'Directions',page_url:'directions'}]}]},files:{1:[guide()]},pages:{1:[{url:'directions',title:'Directions',body:'<p>Use the blue form.</p>'}]},routes:[{match:/\/courses\/1\/(?:files|pages)\?/,status:404,body:{message:'That page has been disabled for this course'}}]}),{run,prompt}=await h.help('21');
 assert.equal(run.state,'awaiting-reply');assert.match(prompt,/Course files you can ask for[\s\S]*Guide\.txt/);assert.match(prompt,/Course files you can ask for[\s\S]*Directions/);
});
test('a file-only assignment reaches the prompt through any link form Canvas writes',async()=>{
 for(const href of ['/courses/1/files/55?wrap=1','/courses/1/files/55/download?wrap=1',origin+'/courses/1/files/55/download?download_frd=1','/courses/1/files/55/preview','/files/55/download']){const {prompt}=await harness({assignments:{1:[task({description:'<a class="instructure_file_link" href="'+href+'">Guide.txt</a>'})]},files:{1:[guide()]},bodies:{55:'Bring the signed form.'}}).help('21');assert.match(prompt,/Attached file: Guide\.txt>>>\nBring the signed form\./,href);}
});
test('every link form Canvas writes reaches the file or page',async()=>{
 for(const href of ['/courses/1/files?preview=55','/courses/1/files/folder/unit-1?preview=55','/courses/1/files/folder/unit%201/week%202?preview=55&amp;x=1']){const {prompt}=await harness({assignments:{1:[task({description:'<a href="'+href+'">Guide</a>'})]},files:{1:[guide()]},bodies:{55:'Bring the signed form.'}}).help('21');assert.match(prompt,/Bring the signed form/,href);}
 const page={pages:{1:[{url:'lab-rules',title:'Lab rules',body:'<p>Bring goggles.</p>'}]},modules:{1:[{id:'5',name:'Unit 1',items:[{id:'900',type:'Page',title:'Lab rules',page_url:'lab-rules'}]}]}};
 for(const href of ['/courses/1/wiki/lab-rules','/courses/1/modules/items/900','/courses/1/pages/lab-rules?module_item_id=900']){const {prompt}=await harness({assignments:{1:[task({description:'<a href="'+href+'">Rules</a>'})]},...page}).help('21');assert.match(prompt,/Bring goggles/,href);}
 assert.deepEqual(C.links('<a href="/courses/1/files/folder/x?preview=55">a</a><a href="/courses/1/files?preview=56">b</a><a href="/courses/1/wiki/lab-rules">c</a><a href="/courses/1/files">all</a>',origin,'1').map(l=>l.fileId||l.slug),['55','56','lab-rules'],'the panel path finds them too');
});
test('each kind of unreadable file is named to the AI',async()=>{
 const attached=name=>'<a href="/courses/1/files/55">'+name+'</a>',ask=async(file,bodies={},parsePDF)=>(await harness({assignments:{1:[task({description:attached(file.display_name)})]},files:{1:[guide(file)]},bodies,parsePDF}).help('21')).prompt.match(UNREAD)[1];
 assert.match(await ask({display_name:'Textbook.pdf',size:9000000}),/Textbook\.pdf: This file exceeds the 2 MiB limit/);
 assert.match(await ask({display_name:'Slides.pptx','content-type':'application/vnd.ms-powerpoint'},{55:{text:'PK binary slides',type:'application/vnd.ms-powerpoint'}}),/Slides\.pptx: Only text PDFs/);
 assert.match(await ask({display_name:'Scan.pdf'},{55:'%PDF-1.4 scanned'},async()=>({text:'',pageTexts:[{page:1,text:'  '}]})),/Scan\.pdf: No readable text/);
 assert.match((await harness({assignments:{1:[task({description:attached('Gone.pdf')})]}}).help('21')).prompt.match(UNREAD)[1],/Gone\.pdf/);
});
test('a file Canvas refuses with a 401 is named and the Help run goes on',async()=>{
 const {run,prompt}=await harness({assignments:{1:[task({description:'<a href="/courses/1/files/55">Guide.txt</a>'})]},files:{1:[guide()]},routes:[{match:/\/courses\/1\/files\/55$/,status:401,body:refused}]}).help('21');assert.equal(run.state,'awaiting-reply');assert.match(prompt.match(UNREAD)[1],/Guide\.txt: This source is locked or unavailable/);
});
test('a file hidden in Files survives the check before sending',async()=>{
 const {run,prompt}=await harness({assignments:{1:[task({description:'<a href="/courses/1/files/55">Guide.txt</a>'})]},files:{1:[guide({hidden:true})]},bodies:{55:'Bring the signed form.'}}).help('21');assert.equal(run.state,'awaiting-reply');assert.match(prompt,/Bring the signed form/);
});
test('Help on an item its course could not list says the instructions were not read',async()=>{
 const {prompt}=await harness({courses:two,assignments:{1:[task()]},routes:[{match:/\/courses\/2\/assignments\?/,status:403,body:{}}]}).help('77','2','Essay on trade');assert.match(prompt.match(UNREAD)[1],/Essay on trade: its instructions could not be read from Canvas/);
});
test('Google and Office 365 links are named as unread',async()=>{
 const {prompt}=await harness({assignments:{1:[task({description:'<p>See <a href="https://docs.google.com/document/d/abcdefghijklmnopqrstuvwxyz1234/edit">the brief</a>, <a href="https://sample.sharepoint.com/:w:/s/class/Eabc">the rubric</a> and <a href="https://1drv.ms/w/s!abc">notes</a>.</p>'})]}}).help('21'),text=SOURCES(prompt);
 for(const name of ['the brief','the rubric','notes'])assert.ok(text.includes('Source not available: '+name+': external source content not available in Canvas.'),name);assert.match(text,/Linked but not readable>>>\n"the brief" \(Google Doc\)/);
});
test('links out of reach on the same Canvas are named',async()=>{
 const {prompt}=await harness({assignments:{1:[task({description:'<a href="/courses/999/files/55">Old guide</a> <a href="/users/5/files/56/download?verifier=abc">Teacher file</a> <a href="/courses/1/quizzes/3">Practice quiz</a> <a href="/courses/1/external_tools/9">Video tool</a> <a href="/courses/1/grades">Grades</a>'})]}}).help('21'),text=SOURCES(prompt);
 for(const name of ['Old guide','Teacher file','Practice quiz','Video tool'])assert.ok(text.includes('Source not available: '+name+': linked content could not be read.'),name);assert.doesNotMatch(text,/Source not available: Grades/,'a menu link is not a source');assert.doesNotMatch(text,/verifier/);
});
test('login lines and e-mail addresses in an item\'s own text never reach the AI',async()=>{
 const secrets='<p>Log in to the publisher site.</p><p>Username: class123</p><p>Password: hunter2-secret</p><p>Access code: ABCD-1234</p><p>Questions go to teacher@example.org</p><p>Do exercises 1 to 5.</p>',h=harness({assignments:{1:[task({description:'<a href="/courses/1/files/55">Guide.txt</a>'+secrets})]},files:{1:[guide()]},bodies:{55:'Password: file-secret\nBring the form.'}}),{prompt}=await h.help('21'),brief=(await h.prepare()).prompt;
 for(const text of [prompt,brief]){for(const leak of ['class123','hunter2-secret','ABCD-1234','teacher@example.org','file-secret'])assert.ok(!text.includes(leak),leak);assert.match(text,/Do exercises 1 to 5/);}
 const paragraph=Brief.scrub('Week 3 notes. '.repeat(30)+'The sign in: alpha screen is step two, and the rest of this paragraph must stay.');assert.doesNotMatch(paragraph,/alpha/);assert.match(paragraph,/^Week 3 notes\.[\s\S]*the rest of this paragraph must stay\.$/);
});
test('no score reaches a prompt with grades off, hidden totals, muted scores or pass/fail',async()=>{
 const h=harness({courses:[{...sample('1','Sample Science'),hide_final_grades:true,enrollments:[{...student,computed_current_score:88.25,computed_current_grade:'B+'}]}],assignments:{1:[task({submission:{score:7.25,grade:'C',workflow_state:'graded',submitted_at:at(-1)}}),task({id:'22',name:'Muted',grading_type:'pass_fail',submission:{score:3.75,grade:'complete',posted_at:null}})]}}),text=(await h.prepare()).prompt+(await h.help('22')).prompt;
 for(const leak of ['88.25','7.25','3.75','B+'])assert.ok(!text.includes(leak),leak);
});
test('every Canvas call in a whole run is a GET on the read list',async()=>{
 const h=harness({assignments:{1:[task({description:'<a href="/courses/1/files/55">Guide.txt</a>'})]},files:{1:[guide()]},bodies:{55:'Bring the form.'}});await h.prepare();await h.help('21');assert.ok(h.calls.length>20);assert.ok(h.calls.every(c=>/^\/(?:api\/v1\/|files\/\d+\/download)/.test(c)));
});

// From the live stress test of 2026-11-01: each of these went wrong in front of a real AI.
test('a paragraph of requirements stays whole when a long syllabus is shortened',async()=>{
 const body='<p>'+'Attendance, grading, and classroom expectations are described in the student handbook. '.repeat(900)+'</p><p>Project 2: implement a hash map in C. Handle collisions by chaining. Resize when the load factor passes 0.75. The autograder runs valgrind, and any leak loses 15 points. Late work loses 10 percent per day.</p>';
 const {prompt}=await harness({assignments:{1:[task({name:'Project 2',description:''})]},syllabus:{1:body}}).help('21');assert.match(prompt,/Handle collisions by chaining/);assert.ok((prompt.match(/\[Excerpts; source shortened\]/g)||[]).length<=1);assert.doesNotMatch(prompt,/\[Excerpts;\n/);
});
test('"the password is x" is taken out as well, on a page the AI reads',async()=>{
 const h=harness({assignments:{1:[task({name:'Reading 3',description:'See the page.'})]},modules:{1:[{id:'5',name:'Unit',items:[{id:'900',type:'Page',title:'Notes',page_url:'notes'},{id:'901',type:'Assignment',title:'Reading 3',content_id:'21'}]}]},pages:{1:[{url:'notes',title:'Notes',body:'<p>Read this.</p><p>The class portal password is riverbank42.</p>',updated_at:at(-1)}]}}),{run}=await h.help('21');run.turns[run.turnIndex].reply='```json\n{"read":["L1"]}\n```';await h.step(run);await h.drive(run);assert.doesNotMatch(run.messages[0].content,/riverbank42/);assert.match(run.messages[0].content,/Read this\./);
});
test('a discussion tells Help both its dates and that the first post comes before classmates can be seen',async()=>{
 const {prompt}=await harness({assignments:{1:[task({due_at:null,description:null,has_sub_assignments:true,submission_types:['discussion_topic'],checkpoints:[{tag:'reply_to_topic',due_at:at(1)},{tag:'reply_to_entry',due_at:at(3)}],discussion_topic:{id:'40',message:'<p>Take a side.</p>',require_initial_post:true,user_can_see_posts:false}})]}}).help('21');
 assert.match(prompt,/first post due Thu, Oct 22/);assert.match(prompt,/replies due Sat, Oct 24/);assert.match(prompt,/hidden until the student posts/);
});
test('Help can plan a piece of the student\'s own work, and its plan is a card',()=>{
 const Study=require('../extension/study-prompts.js');assert.ok(Study.DELIVER_KINDS.includes('outline'));
 const r=Study.parseDeliver('```json\n'+JSON.stringify({kind:'outline',title:'Lab 4 report',size:'m',thesis:'How does temperature change catalase activity?',sections:[{part:'Analysis',purpose:'12 of 40: the largest share.',example:'1.6 at 37 C against 0.3 at 60 C: what happened?',src:'Source 1',timing:'',words:0,evidence:[]},{part:'Data table and graph',purpose:'10 of 40.',example:'Four temperatures, one rate each.',src:'Source 1',timing:'',words:0,evidence:[]},{part:'Conclusion',purpose:'4 of 40: answer the question.',example:'Does the peak support your hypothesis?',src:'Source 1',timing:'',words:0,evidence:[]}],gaps:[]})+'\n```','auto');assert.equal(r.ok,true,String(r.errors));assert.equal(r.data.kind,'outline');assert.equal(r.data.sections.length,3);
});
