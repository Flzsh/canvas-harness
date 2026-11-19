'use strict';
// AI plan step 3: whole readings, rubrics and teacher messages reach Help. A file may give up to 30,000 characters, a
// page shortened by the privacy filter no longer ends a PDF, the item's instructions keep their warnings and rubric,
// materials are fitted so nothing important goes without a word, and Help reads its course's own brief with teachers'
// messages at up to 2,000 characters. Made-up content only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../extension/agent-data.js'),Runner=require('../extension/ai-runner.js'),Brief=require('../extension/prepare-brief.js');
const origin='https://school.instructure.com',user={id:'9'};
const fileResponse=bytes=>({ok:true,type:'basic',url:origin+'/files/55/download',headers:{get:key=>key==='content-type'?'application/pdf':key==='content-length'?String(bytes.length):null},body:{getReader(){let done=false;return {async read(){if(done)return {done:true};done=true;return {done:false,value:bytes};},async cancel(){},releaseLock(){}};}}});
const index=()=>new Map([['file:7:55',{id:'file:7:55',what:'pdf',courseId:'7',canvasId:'55',title:'Reading.pdf'}],['assignment:7:12',{id:'assignment:7:12',what:'assignment',courseId:'7',canvasId:'12',title:'Lab report'}]]);
function reader(pageTexts,{totalPages=pageTexts.length,assignment}={}){
 const client={origin,profile:async()=>user,readFile:async()=>({id:55,display_name:'Reading.pdf',size:100}),readAssignment:async()=>assignment};
 return D.createReader({index:index(),client,user,origin,fetchImpl:async()=>fileResponse(Uint8Array.from(Buffer.from('%PDF-1.7\n'))),parsePDF:async()=>({pageTexts,pages:pageTexts.length,totalPages,text:''})});
}
const pages=(n,size=1400)=>Array.from({length:n},(_,i)=>({page:i+1,text:'PAGE-'+(i+1)+' '+'w'.repeat(size)}));

test('a file read takes the limit Help asks for, within 12,000 to 30,000, and says which pages it holds',async()=>{
 const whole=await reader(pages(20),{totalPages:30}).read({what:'pdf',id:'file:7:55',limit:30000});
 assert.ok(whole.text.includes('PAGE-20 '),'all twenty extracted pages fit');assert.ok(whole.text.length<=30000);
 assert.deepEqual(whole.pagesRead,Array.from({length:20},(_,i)=>i+1));assert.equal(whole.totalPages,30);assert.equal(whole.truncated,true,'ten pages were never extracted');
 const usual=await reader(pages(20),{totalPages:20}).read({what:'pdf',id:'file:7:55'});
 assert.ok(usual.text.length<=12000);assert.equal(usual.truncated,true);assert.equal(usual.cutPage,usual.pagesRead.at(-1));assert.ok(!usual.text.includes('PAGE-12 '));
 assert.equal((await reader(pages(30,1400)).read({what:'pdf',id:'file:7:55',limit:1e9})).text.length<=30000,true,'never more than 30,000');
 assert.equal((await reader(pages(30,1400)).read({what:'pdf',id:'file:7:55',limit:5})).text.length<=12000,true,'never less than the usual 12,000');
 const fits=await reader(pages(3,200)).read({what:'pdf',id:'file:7:55',limit:30000});assert.equal(fits.truncated,false);
});

test('a page the privacy filter shortens no longer ends the read',async()=>{
 const r=await reader([{page:1,text:'First page of the reading.'},{page:2,text:'You scored 17 out of 20 points on Unit 2 and keep going.'},{page:3,text:'THIRD-PAGE says the thesis.'}]).read({what:'pdf',id:'file:7:55',limit:30000});
 assert.match(r.text,/THIRD-PAGE says the thesis/);assert.doesNotMatch(r.text,/17 out of 20/);assert.deepEqual(r.pagesRead,[1,2,3]);
});

test('an assignment read keeps its text and also gives its parts: warnings, body and rubric apart',async()=>{
 const r=await reader([],{assignment:{id:12,name:'Lab report',description:'<p>Write up the lab.</p><a href="https://example.org/spec.pdf">spec</a>',rubric:[{description:'Data table',long_description:'All four trials',points:10,ratings:[{description:'Complete',points:10}]}]}}).read({what:'assignment',id:'assignment:7:12'});
 assert.match(r.text,/Write up the lab/);assert.match(r.parts.body,/Write up the lab/);assert.match(r.parts.rubric,/Data table/);assert.match(r.parts.rubric,/10 possible points/);
 assert.ok(r.parts.warnings.some(w=>/^Source not available/.test(w)),'the outside link is a warning');assert.equal(r.parts.head,'Lab report');
});

const sentence=(i,word)=>'Students must '+word+' item '+i+' before the deadline. ';
test('long instructions keep their warnings and the whole rubric; the body is cut by requirement, never under 6,000',()=>{
 const rubric=Array.from({length:8},(_,i)=>'Row '+(i+1)+' RUBRIC-ROW '+'criteria '.repeat(180)).join('\n\n');
 const body=Array.from({length:900},(_,i)=>sentence(i,'finish')).join('');
 const {sources,cuts}=Runner.fitSources([{label:'Teacher instructions: Research paper',role:'instructions',text:'x',parts:{head:'Research paper',warnings:['Source not available: a link to example.org'],body,rubric}},{label:'Canvas brief',role:'brief',text:'BRIEF'}]);
 const text=sources[0].text;
 assert.equal((text.match(/RUBRIC-ROW/g)||[]).length,8,'every rubric row');assert.match(text,/Source not available/);assert.ok(text.length<=20000);
 assert.ok(text.indexOf('Source not available')<text.indexOf('Students must'),'warnings come before the body');
 assert.ok(text.length-rubric.length>=6000);assert.match(cuts[0],/shortened to their requirements/);assert.equal(sources[1].text,'BRIEF');
});

test('long files share the room; a cut PDF keeps whole pages from its start and its end and says which',()=>{
 const pdf=pages(20,1450).map(p=>'[Page '+p.page+']\n'+p.text).join('\n\n'),other='o'.repeat(29000);
 const {sources,cuts}=Runner.fitSources([{label:'Attached file: Reading.pdf',role:'file',text:pdf,info:{pagesRead:Array.from({length:20},(_,i)=>i+1),totalPages:34,truncated:true}},{label:'Course file: Notes.txt',role:'file',text:other},{label:'Canvas brief',role:'brief',text:'B'.repeat(6000)}]);
 const kept=sources[0].text,nums=[...kept.matchAll(/\[Page (\d+)\]/g)].map(m=>Number(m[1]));
 assert.ok(nums[0]===1&&nums.at(-1)===20,'its opening and its last page read');assert.ok(nums.length<20);
 for(const b of kept.split(/\n\n(?=\[Page )/))assert.match(b,/^\[Page \d+\]\nPAGE-\d+ w{1450}$/,'whole pages only');
 assert.match(cuts.find(c=>/Reading\.pdf/.test(c)),/^Attached file: Reading\.pdf: pages 1-\d+ and \d+-20 of 34 are here/);
 assert.match(cuts.find(c=>/Notes\.txt/.test(c)),/only its start and its end are here/);
 assert.equal(sources[2].text.length,6000,'the brief stays whole');
 const total=sources.reduce((n,s)=>n+s.text.length+s.label.length+64,0);assert.ok(total<=41000,String(total));
});

test('a 30,000-character paste still leaves the notes and the brief; the syllabus takes only what is left',()=>{
 const input=[{label:'Teacher instructions: Essay',role:'instructions',text:'Write the essay.'},{label:'Course syllabus',role:'course',text:'S'.repeat(5000)},{label:'Pasted by the student: prompt',role:'paste',text:'p'.repeat(30000)},{label:'Linked but not readable',role:'note',text:'"slides" (Google Slides)'},{label:'Canvas brief',role:'brief',text:'B'.repeat(7000)}];
 const roomy=Runner.fitSources(input,{budget:39000});assert.equal(roomy.sources.find(s=>s.role==='paste').text.length,30000,'the whole paste when it fits');assert.deepEqual(roomy.cuts,[]);
 const {sources,cuts}=Runner.fitSources(input,{budget:33000});
 assert.equal(sources.find(s=>s.role==='note').text,'"slides" (Google Slides)');assert.equal(sources.find(s=>s.role==='brief').text.length,7000);
 const paste=sources.find(s=>s.role==='paste').text;assert.ok(paste.length<30000&&paste.length>20000,String(paste.length));assert.ok(cuts.some(c=>/^Pasted by the student: prompt: only its start and its end/.test(c)));
 assert.equal(sources.find(s=>s.role==='course'),undefined,'no room left for the syllabus');assert.ok(!cuts.some(c=>/syllabus/i.test(c)),'no note for the syllabus');
});

test('Help\'s brief for one course: its messages whole up to 2,000 characters, newest first, other courses as dates only',()=>{
 const now=Date.parse('2026-11-02T16:00:00Z'),at=h=>new Date(now-h*36e5).toISOString(),due=h=>new Date(now+h*36e5).toISOString();
 const input={now,timeZone:'UTC',courses:[{id:1,name:'History'},{id:2,name:'Chemistry'}],
  items:[{id:10,courseId:1,title:'DBQ essay',due:due(30),instructions:'Use five documents.',submissionTypes:['online_upload']},{id:20,courseId:2,title:'Lab 4',due:due(40),instructions:'CHEM-INSTRUCTIONS',submissionTypes:['online_upload']}],
  announcements:[{courseId:1,title:'Test topics',at:at(5),text:'housekeeping '.repeat(55)+'TOPIC-LIST chapters 7 to 9.'},{courseId:2,title:'Goggles',at:at(2),text:'CHEM-ANNOUNCEMENT'}],
  messages:[{courseId:1,subject:'Essay length',at:at(1),text:'Keep it under 1,200 words. MESSAGE-END'},{courseId:2,subject:'Lab',at:at(1),text:'CHEM-MESSAGE'}],
  resources:[{id:'file:1:5',courseId:1,title:'Documents.pdf',at:at(30)}]};
 const whole=Brief.build(input),mine=Brief.build(input,{course:'1'}).text;
 assert.doesNotMatch(whole.text,/TOPIC-LIST/,'the day\'s brief keeps its 600');assert.deepEqual(whole.busy.sort(),['1','2']);
 assert.match(mine,/TOPIC-LIST chapters 7 to 9/);assert.match(mine,/MESSAGE-END/);assert.match(mine,/Use five documents/);
 assert.doesNotMatch(mine,/CHEM-(INSTRUCTIONS|ANNOUNCEMENT|MESSAGE)/);assert.match(mine,/Other courses, due in the next 7 days \(dates only\):\n- Chemistry · Lab 4 — due/);
 assert.doesNotMatch(mine,/Files and pages/);assert.ok(mine.startsWith('Courses: '));
 const many={...input,announcements:Array.from({length:12},(_,i)=>({courseId:1,title:'Note '+i,at:at(i+1),text:'NEWEST-'+i+' '+'z'.repeat(2100)}))};
 const capped=Brief.build(many,{course:'1'}).text;assert.ok(capped.length<=Brief.LIMITS.course);assert.match(capped,/NEWEST-0 /,'the newest first');assert.match(capped,/DBQ essay/);
});

test('a finished run drops its course briefs, reads and cache with the rest after ten minutes',async()=>{
 const Store=require('../extension/ai-run-store.js'),{fakeIndexedDB}=require('./fake-indexeddb.cjs');let clock=Date.parse('2026-11-02T16:00:00Z');const store=Store.create({indexedDB:fakeIndexedDB(),now:()=>clock});
 const scope='https://canvas.example|7',run=await store.start({scope,day:'2026-11-02',sourceTab:1,settings:{dailyCap:3},id:'run-w',triggerKey:'ask:abcdef',kind:'ask',question:'Help'});
 await store.mutate(run.id,null,r=>{r.snapshot={brief:{text:'BRIEF'},courseBriefs:{1:'ONE'},index:[]};r.reads={k:{text:'READ'}};r.cache=[['a','b']];r.state='cards-ready';});
 clock+=11*60e3;await store.start({scope,day:'2026-11-02',sourceTab:1,settings:{dailyCap:3},id:'run-x',triggerKey:'ask:ghijkl',kind:'ask',question:'Again'});
 const r=await store.get(run.id);assert.deepEqual(r.snapshot,{brief:{text:'BRIEF'}});assert.equal(r.reads,undefined);assert.equal(r.cache,undefined);
});

test('a read the AI asks for cannot set how much of a file is read',()=>{
 const fence='```',r=require('../extension/agent-prompts.js').parse(fence+'chagent\n'+JSON.stringify({v:1,read:[{what:'pdf',id:'file:7:55',limit:30000,pages:'1-2'}]})+'\n'+fence);
 assert.deepEqual(r.reads,[{what:'pdf',id:'file:7:55',pages:'1-2'}]);
});
