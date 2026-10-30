// Grade impact, answer first: the module's answer line, pretend ("custom") assignments in Canvas's categories, their
// storage on the device, and hidden grades.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Art=require('../extension/grade-impact-art.js'),G=require('../extension/grade-impact.js'),{createStore,validateBackup,cleanGradeImpact}=require('../extension/storage.js');
const ORIGIN='https://school.instructure.com',NOW=Date.parse('2026-10-20T15:00:00Z'),user={id:'9'};
const day=n=>new Date(NOW+n*864e5).toISOString(),tick=()=>new Promise(resolve=>setImmediate(resolve)),clone=value=>structuredClone(value);
const close=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-9,`${msg||''} ${a} ~= ${b}`);
const graded=(id,score,points,extra={})=>({id,name:'Done '+id,course_id:'5',grading_type:'points',points_possible:points,submission:{assignment_id:id,user_id:'9',score,workflow_state:'graded',submitted_at:day(-5),posted_at:day(-4)},...extra});
const coming=(id,points,due,extra={})=>({id,name:'Coming '+id,course_id:'5',grading_type:'points',points_possible:points,due_at:due,submission:{assignment_id:id,user_id:'9',score:null,workflow_state:'unsubmitted',submitted_at:null},...extra});
const group=(id,weight,assignments,rules={},name)=>({id,group_weight:weight,rules,assignments,...(name?{name}:{})});
function envelope(groups,weighted=true,score=85,extra={}){const rows=clone(groups);return {origin:ORIGIN,accountId:'9',courseId:'5',course:{id:'5',hide_final_grades:false,multiple_grading_periods_enabled:false,apply_assignment_group_weights:weighted,enrollments:[{type:'student',user_id:'9',computed_current_score:score}],...extra},groups:rows.map(({assignments,...meta})=>meta),assignments:rows.flatMap(g=>g.assignments.map(a=>({...a,assignment_group_id:g.id})))};}
const model=data=>G.model(data,{showGrades:true});
const course={id:'5',name:'Chemistry',shortName:'Chem',score:85,scoreScope:'overall',hideFinalGrades:false,gradingPeriodId:null};
const helpers={E:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),formatDate:(value,tz,o)=>o&&o.month?value.slice(5,10):'Fri',icon:()=>''};
const items=[{id:'2',courseId:'5',name:'Unit test',points:50,dueAt:day(3),state:'unsubmitted',assignmentGroup:{id:'1',name:'Tests'}},{id:'4',courseId:'5',name:'Lab quiz',points:10,dueAt:day(5),state:'unsubmitted',assignmentGroup:{id:'2',name:'Labs'}}];
const home=(showGrades=true,extra={})=>({s:{showGrades,timeZone:'America/New_York',moduleSize:{impact:'m'}},state:{courseId:'all'},workspace:'work',workPage:'home',user,courses:[{...course,...(extra.course||{})}],items,now:NOW,gradeImpactRevision:'r1',...extra});
const roomOf=(extra={})=>({...home(true,extra),workspace:'grades',workPage:'',state:{courseId:'5'}});
// the module is placed on Home for the length of each test (and as before for one call where a test asks)
const arranged=fn=>async()=>{const prev=global.ReserveWorkspaceArrange;global.ReserveWorkspaceArrange={snapshot:()=>({order:['impact']})};try{await fn();}finally{if(prev===undefined)delete global.ReserveWorkspaceArrange;else global.ReserveWorkspaceArrange=prev;}};
function placed(run){const previous=global.ReserveWorkspaceArrange;global.ReserveWorkspaceArrange={snapshot:()=>({order:['impact']})};try{return run();}finally{if(previous===undefined)delete global.ReserveWorkspaceArrange;else global.ReserveWorkspaceArrange=previous;}}
// (read on the Grades page, where the course is the room: Home only reads while the module is placed, and the stand-in
// arrangement is only there for the length of a call)
async function live(data,extra={}){const loader=G.create({user,client:{loadGradeImpact:async()=>clone(data)},navigate:()=>true,...extra});loader.ensure(roomOf(extra.context||{}));await tick();return loader;}
const ans=html=>(html.match(/<span class="gi-ans-t">([\s\S]*?)<\/span><\/p>/)?.[1]||'').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/ /g,' ');
const mod=(loader,c=home())=>placed(()=>{loader.ensure(c);return G.renderModule(c,helpers,loader);});
// Tests 50% (40/50 scored, a 50-point test coming), Labs 50% (9/10 scored, a 10-point quiz coming): Canvas says 85.
const named=(id,name)=>({name});
const two=()=>envelope([group('1',50,[graded('1',40,50),coming('2',50,day(3),{name:'Unit test'})],{},'Tests'),group('2',50,[graded('3',9,10),coming('4',10,day(5),{name:'Lab quiz'})],{},'Labs')]);

test('the answer: keep the band you are in, reach a band chosen on the ruler, out of reach with the best, and the result once a score is set',arranged(async()=>{
 const loader=await live(two());let html=mod(loader);
 // 65 + 25 f on the unit test: 80 needs 60%
 assert.equal(ans(html),'To keep your B: 30/50 (60%) on Unit test · Fri');assert.match(html,/data-gi-ans="keep"/);assert.match(html,/class="gi-row gi-row-named" data-rd-key="gi-row-2"/);
 assert.match(html,/data-gi-id="2" data-gi-pts="50" data-gi-day="[^"]*" data-gi-f="" data-gi-rest="0.6"/,'its knob rests, faint, at what the answer needs');assert.match(html,/gi-knob-rest gi-knob-need/);
 assert.match(html,/data-gi-id="4" data-gi-pts="10" data-gi-day="[^"]*" data-gi-f="" data-gi-rest="0.5"/,'other knobs rest at the middle');
 loader.control.setNeed('5',90);html=mod(loader);assert.equal(ans(html),'To reach an A: 50/50 (100%) on Unit test · Fri');assert.match(html,/data-gi-ans="reach"/);assert.match(html,/data-gi-band="90" role="button" tabindex="0" aria-pressed="true"/);
 loader.control.setNeed('5',90);assert.equal(ans(mod(loader)),'To keep your B: 30/50 (60%) on Unit test · Fri','pressing the chosen letter again goes back to the answer worked out for you');
 loader.control.setNeed('5',70);assert.equal(ans(mod(loader)),'To keep a C: 10/50 (20%) on Unit test · Fri','a lower band: keep it');loader.control.setNeed('5',70);
 loader.control.setWhatIf('5','2',1);html=mod(loader);assert.equal(ans(html),'With this score: 50/50 (100%) → 90.0 · an A');assert.match(html,/data-gi-ans="if"/);
 loader.control.setWhatIf('5','2',.7);assert.equal(ans(mod(loader)),'With this score: 35/50 (70%) → 82.5 · still a B');
 loader.control.setWhatIf('5','4',0);assert.equal(ans(mod(loader)),'With these scores: 35/50, 0/10 → 60.0 · a D','37.5 + 22.5');
 assert.match(loader.control.sayIf('5','4',1),/^With these scores: 35\/50, 10\/10 → /,'the line said while a knob is held');
 loader.destroy();
 // 55 + 25 f: an A cannot be reached (best 80.0); the D is kept with 20%
 const low=await live(envelope([group('1',50,[graded('1',20,50),coming('2',50,day(3),{name:'Unit test'})]),group('2',50,[graded('3',9,10)])],true,65),{context:{course:{score:65}}});
 assert.equal(ans(mod(low,home(true,{course:{score:65}}))),'To keep your D: 10/50 (20%) on Unit test · Fri');
 low.control.setNeed('5',90);html=mod(low,home(true,{course:{score:65}}));assert.equal(ans(html),'A is out of reach · best 80.0');assert.match(html,/data-gi-ans="out"/);low.destroy();
 // an F has no floor to keep: the next band up that the work can reach (45 + 25 f: a D with 60%)
 const f=await live(envelope([group('1',50,[graded('1',10,50),coming('2',50,day(3),{name:'Unit test'})]),group('2',50,[graded('3',8,10)])],true,50),{context:{course:{score:50}}});
 assert.equal(ans(mod(f,home(true,{course:{score:50}}))),'To reach a D: 30/50 (60%) on Unit test · Fri');f.destroy();
 // any score keeps it: 95 now, a 1-point quiz coming
 const holds=await live(envelope([group('1',50,[graded('1',95,100)]),group('2',50,[graded('3',95,100),coming('4',1,day(2),{name:'Pop quiz'})])],true,95),{context:{course:{score:95}}});
 html=mod(holds,home(true,{course:{score:95}}));assert.equal(ans(html),'Your A holds whatever you get on Pop quiz');assert.match(html,/data-gi-ans="holds"/);holds.destroy();
}));

test('pretend assignments in a weighted course: added in a category, scored like Canvas would, kept to the cap, removed with their ×',arranged(async()=>{
 const loader=await live(two()),m=model(two());
 placed(()=>{
  assert.equal(loader.control.addOpen('5'),true);let html=mod(loader);
  assert.match(html,/class="gi-addrow"[^>]*data-gi-add-form="5"/);assert.match(html,/role="radio" aria-checked="true"[^>]*data-gi-group="1" aria-label="Tests, 50%"/);assert.match(html,/data-gi-group="2" aria-label="Labs, 50%"/);
  assert.match(html,/data-gi-draft="points" value="100"/);assert.match(html,/placeholder="Test"/,'the name defaults by category');assert.doesNotMatch(html,/data-gi-action="add" /,'Add itself waits while its row is open');
  loader.control.addDraft('group','2');loader.control.addDraft('points','20');loader.control.addDraft('name','');
  const pid=loader.control.addConfirm('5');assert.match(pid,/^gp-[a-z0-9]{8}$/);
  assert.deepEqual(loader.pretend('5'),[{id:pid,group:'2',points:20,name:'Lab',score:null}]);
  html=mod(loader);assert.match(html,new RegExp(`class="gi-row gi-row-p gi-row-named" data-rd-key="gi-row-${pid}"`),'20 points in a 50% category of 10: the pretend lab moves the grade most, so the answer names it');assert.match(html,new RegExp(`data-gi-action="unpretend" data-gi-course="5" data-gi-pid="${pid}" aria-label="Remove Lab"`));
  assert.match(html,/Labs · 50%/,'its category and weight');assert.doesNotMatch(html,/class="gi-addrow"/);
  // unscored, it changes nothing: the pins and the answer are Canvas's own
  assert.match(html,/class="gi-poise" data-gi-v="85"/);assert.match(html,/class="gi-ghost" data-gi-on="0"/);
  // it counts in the answer: 40 + 50 (9 + 20 f) / 30 keeps the B from 75%
  assert.equal(ans(html),'To keep your B: 15/20 (75%) on Lab');
  // scored: it goes into the Labs category's sums. Canvas with that score posted: Labs (9+10)/(10+20), Tests 40/50.
  loader.control.setWhatIf('5',pid,.5);const posted=envelope([group('1',50,[graded('1',40,50)]),group('2',50,[graded('3',9,10),graded('9',10,20)])],true,0);
  const canvas=G.model({...posted,course:{...posted.course,enrollments:[{type:'student',user_id:'9',computed_current_score:71.67}]}},{showGrades:true});
  close(canvas.current,50*.8+50*19/30,'the same arithmetic as a posted score');close(m.project([],[{group:1,points:20,f:.5}]),canvas.current);
  html=mod(loader);assert.match(html,new RegExp(`class="gi-ghost" data-gi-on="1" data-gi-v="${(Math.round(canvas.current*10)/10)}"`));assert.equal(ans(html),`With this score: 10/20 (50%) → ${canvas.current.toFixed(1)} · a C`);
  assert.deepEqual(loader.pretend('5')[0].score,.5,'a pretend score stays with its assignment');
  // a pretend score and a Canvas what-if together
  loader.control.setWhatIf('5','2',1);close(loader.control.preview('5','2',1),m.project([['2',1]],[{group:1,points:20,f:.5}]));
  // Clear forgets both and keeps the pretend assignment
  loader.control.clear('5');assert.equal(loader.whatIfs('5').size,0);assert.deepEqual(loader.pretend('5').map(p=>p.score),[null]);
  // eight at most; the ninth is refused and Add is no longer offered
  for(let i=1;i<8;i++){loader.control.addOpen('5');loader.control.addConfirm('5');}
  assert.equal(loader.pretend('5').length,8);assert.equal(loader.control.addOpen('5'),false);assert.doesNotMatch(mod(loader),/data-gi-action="add"/);
  assert.deepEqual(loader.pretend('5').filter(p=>p.group==='1').map(p=>p.name),['Test','Test 2','Test 3','Test 4','Test 5','Test 6','Test 7'],'a name taken gets a number');
  // points must be a number from 0 to 10,000
  loader.control.removePretend('5',pid);loader.control.addOpen('5');for(const bad of ['0','-3','abc','10001','1e3']){loader.control.addDraft('points',bad);assert.equal(loader.control.addConfirm('5'),null,bad);}
  loader.control.addCancel();assert.equal(loader.pretend('5').some(p=>p.id===pid),false,'removed with its ×');
  // the model refuses invalid pretend arithmetic outright
  for(const x of [{group:9,points:10,f:1},{group:0,points:0,f:1},{group:0,points:10,f:1.2},{group:0,points:Infinity,f:1}])assert.equal(m.project([],[x]),null,JSON.stringify(x));
 });
 loader.destroy();
}));

test('pretend assignments in a points course: the category\'s points, not its weight; and none set keeps Canvas\'s grade exactly',arranged(async()=>{
 const data=envelope([group('1',0,[graded('1',40,50),coming('2',10,day(3))],{},'Homework'),group('2',0,[graded('3',9,10)],{},'Quizzes')],false,81.67);
 const loader=await live(data,{context:{course:{score:81.67}}}),m=model(data),c=home(true,{course:{score:81.67}});
 placed(()=>{
  loader.control.addOpen('5');let html=mod(loader,c);assert.match(html,/aria-label="Homework"/);assert.match(html,/aria-label="Quizzes"/);assert.doesNotMatch(html,/Homework · |<small>/,'no weights in a points course');
  loader.control.addDraft('group','2');loader.control.addDraft('points','30');loader.control.addDraft('name','Unit quiz');const pid=loader.control.addConfirm('5');
  assert.equal(loader.pretend('5')[0].name,'Unit quiz');
  // none set: exactly Canvas's own figure, not merely close
  assert.equal(m.project([],[]),m.current);assert.equal(loader.control.preview('5','2',0)!=null,true);
  html=mod(loader,c);assert.match(html,new RegExp(`class="gi-poise" data-gi-v="${Math.round(m.current*10)/10}"`));assert.match(html,/class="gi-ghost" data-gi-on="0"/);
  loader.control.setWhatIf('5',pid,.5);const expected=(49+15)/(60+30)*100;close(m.project([],[{group:1,points:30,f:.5}]),expected);
  assert.equal(ans(mod(loader,c)),`With this score: 15/30 (50%) → ${expected.toFixed(1)} · a C`);
 });
 loader.destroy();
 // every course and size: with no what-ifs and no pretend scores, the pin stands on Canvas's figure
 for(const env of [two(),data])for(const pretend of [[],[{id:'gp-aaaa1111',group:'2',points:40,name:'X',score:null}]]){const mm=model(env),{P}={P:s=>mm.project([...s].filter(([k])=>!k.startsWith('gp-')),[])};assert.equal(P(new Map()),mm.current);}
}));

test('pretend assignments are kept on this device per account and course, written behind the drawing and read back tomorrow',arranged(async()=>{
 const data={gradeImpact:{pretend:{}}};let notifies=0,quietSeen=null;
 const store={update:async fn=>{const draft=clone(data);fn(draft);Object.assign(data,cleanGradeImpact?{gradeImpact:cleanGradeImpact(draft.gradeImpact)}:draft);notifies++;quietSeen=loader.takeQuietSave();}};
 const loader=await live(two(),{store,saved:()=>data.gradeImpact});
 placed(()=>{loader.control.addOpen('5');loader.control.addDraft('name','Unit 4 test');loader.control.addConfirm('5');});
 await tick();await tick();
 assert.equal(notifies,1);assert.equal(quietSeen,true,'the write asks the dashboard not to redraw the page for it');assert.equal(loader.takeQuietSave(),false,'once');
 assert.deepEqual(data.gradeImpact.pretend['5'].map(p=>[p.group,p.points,p.name,p.score]),[['1',100,'Unit 4 test',null]]);
 // a run of key presses on its knob: the first writes, the rest are written once, as they stand, after it
 const pid=data.gradeImpact.pretend['5'][0].id;placed(()=>{for(const f of [.55,.6,.65,.7])loader.control.setWhatIf('5',pid,f);});
 for(let i=0;i<6;i++)await tick();assert.ok(notifies<=3,`${notifies} writes`);assert.equal(data.gradeImpact.pretend['5'][0].score,.7);
 loader.destroy();
 // tomorrow: a new page reads them back
 const again=await live(two(),{store,saved:()=>data.gradeImpact});assert.equal(again.pretend('5')[0].name,'Unit 4 test');assert.equal(again.pretend('5')[0].score,.7);
 assert.match(mod(again),/Unit 4 test/);again.destroy();
 // nothing is ever sent to Canvas: the client is only ever asked to read
 const calls=[];const reader=G.create({user,client:new Proxy({},{get:(t,k)=>(...a)=>{calls.push(k);return k==='loadGradeImpact'?Promise.resolve(clone(two())):undefined;}}),navigate:()=>true});
 placed(()=>reader.ensure(home()));await tick();placed(()=>{reader.control.addOpen('5');reader.control.addConfirm('5');reader.control.setWhatIf('5',reader.pretend('5')[0].id,1);});
 assert.deepEqual([...new Set(calls)],['loadGradeImpact']);reader.destroy();
}));

test('storage cleans pretend assignments the way it cleans GPA settings: per account, capped, named, nothing unknown',arranged(async()=>{
 const long='x'.repeat(90),rows=Array.from({length:11},(_,i)=>({id:'gp-row'+String(i).padStart(4,'0'),group:'12',points:50.456,name:i?`  Quiz\u0007 ${i}  `:long,score:i%2?.333:null,extra:'dropped'}));
 const clean=cleanGradeImpact({pretend:{'101':rows,'x':rows,'102':[{id:'bad',group:'1',points:5},{id:'gp-ok12',group:'abc',points:5},{id:'gp-ok34',group:'7',points:0},{id:'gp-ok56',group:'7',points:20001}]},other:1});
 assert.deepEqual(Object.keys(clean),['pretend']);assert.deepEqual(Object.keys(clean.pretend),['101'],'bad courses and empty lists are dropped');
 assert.equal(clean.pretend['101'].length,8,'eight at most');assert.equal(clean.pretend['101'][0].name.length,60,'names are cut to 60');assert.equal(clean.pretend['101'][1].name,'Quiz 1');
 assert.deepEqual(clean.pretend['101'][1],{id:'gp-row0001',group:'12',points:50.46,name:'Quiz 1',score:.333});
 for(const bad of [null,[],'x',{pretend:[]},{pretend:null}])assert.deepEqual(cleanGradeImpact(bad),{pretend:{}});
 // through the account's store: kept per account, carried by a backup, and the loader's own cleaning agrees
 const mem={},adapter={read:async k=>clone(mem[k]),write:async(k,v)=>{mem[k]=clone(v);}};
 const a=createStore({accountId:'1',adapter});await a.load();await a.update(d=>{d.gradeImpact={pretend:{'101':[{id:'gp-abcd1234',group:'5',points:40,name:'Final',score:1},{id:'nope'}]}};});
 assert.deepEqual(a.get().gradeImpact,{pretend:{'101':[{id:'gp-abcd1234',group:'5',points:40,name:'Final',score:1}]}});
 const b=createStore({accountId:'2',adapter});await b.load();assert.deepEqual(b.get().gradeImpact,{pretend:{}},'another account has its own');
 assert.deepEqual(validateBackup(a.exportBackup()).gradeImpact,a.get().gradeImpact);
 assert.deepEqual(G.cleanPretend(rows).map(r=>r.id),cleanGradeImpact({pretend:{1:rows}}).pretend['1'].map(r=>r.id));
}));

test('hidden grades: names, days and categories only; no answer, no number, no Add, no pretend row',arranged(async()=>{
 const loader=await live(two());placed(()=>{loader.control.addOpen('5');loader.control.addConfirm('5');});
 // (dates written in the names' labels are days, not grades: this formatter writes only the weekday)
 const html=placed(()=>{const c=home(false);loader.ensure(c);return G.renderModule(c,{...helpers,formatDate:()=>'Fri'},loader);});
 assert.match(html,/Unit test/);assert.match(html,/Fri · Tests/);assert.match(html,/Fri · Labs/);
 assert.doesNotMatch(html,/class="gi-ans"|data-gi-action="add"|gi-row-p|role="slider"|data-gi-band|gi-ghost|gi-poise/);
 const words=html.replace(/<(?:path|circle|rect)\b[^>]*>/g,'').replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi,(m,tag,attrs)=>' '+[...attrs.matchAll(/(aria-label|aria-valuetext|title)="([^"]*)"/g)].map(a=>a[2]).join(' ')+' ').replace(/<\/[a-z][a-z0-9]*>/gi,' ');
 assert.doesNotMatch(words,/\d/,words.match(/.{0,30}\d.{0,30}/)?.[0]);
 // and a course Canvas's numbers cannot be weighed for (drop rules here) offers no Add either
 const refused=await live(envelope([group('1',100,[graded('1',8,10),coming('2',10,day(3))],{drop_lowest:1})],true,80),{context:{course:{score:80}}});
 const r=mod(refused,home(true,{course:{score:80}}));assert.match(r,/Assignment group rules unsupported/);assert.doesNotMatch(r,/data-gi-action="add"|class="gi-ans"/);assert.equal(refused.control.addOpen('5'),false);refused.destroy();
 loader.destroy();
}));

test('the room shows the pretend assignments as pencilled weights with an ×, and has its own Add assignment beside Fold',arranged(async()=>{
 const loader=await live(two());loader.control.measure('room',1440,900);
 placed(()=>{loader.control.addOpen('5');loader.control.addDraft('name','Quiz <b>');loader.control.addConfirm('5');});
 const r=roomOf();loader.ensure(r);let html=G.render(r,helpers,loader);const pid=loader.pretend('5')[0].id;
 assert.match(html,new RegExp(`class="gi-wt gi-wt-p" data-rd-key="gi-wt-${pid}"`));assert.match(html,/stroke-dasharray="5 3.5"/);assert.match(html,/Quiz &lt;b&gt;/);assert.doesNotMatch(html,/Quiz <b>/);
 assert.match(html,new RegExp(`class="gi-x" role="button" tabindex="0" data-gi-action="unpretend" data-gi-course="5" data-gi-pid="${pid}"`));
 assert.match(html,/<div class="gi-head-tools">[\s\S]*data-gi-action="add"[\s\S]*Add assignment[\s\S]*data-gi-action="fold"/);
 placed(()=>loader.control.addOpen('5'));html=G.render(r,helpers,loader);assert.match(html,/class="gi-room-add"[\s\S]*data-gi-add-form="5"/);
 // its slider works the same: its dial carries the what-if, the slip says it, Clear keeps the weight
 loader.control.addCancel();loader.control.setWhatIf('5',pid,.8);html=G.render(r,helpers,loader);assert.match(html,new RegExp(`data-gi-weight="${pid}" data-gi-pts="[\\d.]+" data-gi-live="1" data-gi-k="1" data-gi-f="0.8" data-gi-dial="1"`));assert.match(html,/1 what-if/);
 loader.control.clear('5');html=G.render(r,helpers,loader);assert.match(html,new RegExp(`data-gi-weight="${pid}"`));assert.doesNotMatch(html,/d what-ifs?/);
 loader.destroy();
}));

test('the module\'s slider and add row by keys and pointer, with motion and without (the stage)',arranged(async()=>{
 // a stand-in DOM, as in grade-impact.test.cjs: every query answers, every animate() is counted
 for(const reduce of [true,false]){
  const animations=[],listeners={},rd={dataset:{}};
  const make=sel=>({sel,dataset:{giA:'20',giB:'220',giTy:'90',giF:'',giRest:'.5',giId:'2',giCourse:'5'},style:{},isConnected:true,classList:{contains:()=>false,add(){},remove(){}},textContent:'',animate(frames,options){const a={frames,options,finished:Promise.resolve(),cancel(){}};animations.push(a);return a;},
   querySelector:s=>make(s),querySelectorAll:s=>[make(s)],closest:s=>s==='.rd'?rd:make(s),getBoundingClientRect:()=>({left:0,top:0,width:400,height:300}),getAttribute:()=>null,setAttribute(){},removeAttribute(){},hasAttribute:()=>false,toggleAttribute(){},focus(){},contains:()=>true,dispatchEvent(){},matches:()=>false,setPointerCapture(){},releasePointerCapture(){},viewBox:{baseVal:{width:400}}});
  const win={matchMedia:()=>({matches:reduce}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},performance:{now:()=>0},innerHeight:900,MouseEvent:function(){}};
  const doc={defaultView:win,visibilityState:'visible',body:{},addEventListener:(type,fn)=>{listeners['doc-'+type]=fn;},removeEventListener(){}};
  const container={...make('container'),ownerDocument:doc,addEventListener:(type,fn)=>{listeners[type]=fn;},removeEventListener(){}};
  const loader=G.create({user,container,client:{loadGradeImpact:async()=>two()},navigate:()=>true});placed(()=>loader.ensure(home()));await tick();placed(()=>loader.ensure(home()));
  const slide={...make('.gi-slide'),closest:s=>s==='.gi-slide'?slide:['.gi-app','.gi-svg'].includes(s)?make(s):null};
  // a press on the track sets the knob there; letting go makes it a what-if
  listeners.pointerdown({target:slide,button:0,pointerId:1,clientX:170,preventDefault(){}});listeners.pointerup({pointerId:1});
  assert.equal(loader.whatIfs('5').get('2'),.75,'(170-20)/200');
  // keys: Home is 0%, Delete lets it go
  const key=k=>listeners['doc-keydown']({key:k,target:slide,composedPath:()=>[slide],preventDefault(){},stopPropagation(){}});
  slide.dataset.giF='.75';key('Home');assert.equal(loader.whatIfs('5').get('2'),0);key('Delete');assert.equal(loader.whatIfs('5').has('2'),false);
  // the add row: typed values are kept as the draft without a redraw; Escape closes the row and never folds a room
  placed(()=>loader.control.addOpen('5'));const field={...make('input'),dataset:{giDraft:'points'},value:'40',matches:s=>/input\[data-gi-draft\]/.test(s),closest:s=>s==='[data-gi-add-form]'?{...make('form'),dataset:{giAddForm:'5'},querySelectorAll:()=>[field]}:null};
  listeners.input({target:field,composedPath:()=>[field]});assert.equal(loader.adding('5').points,'40');
  listeners['doc-keydown']({key:'Enter',target:field,composedPath:()=>[field],preventDefault(){},stopPropagation(){}});assert.equal(loader.pretend('5')[0].points,40,'Enter in a field adds');
  if(reduce)assert.equal(animations.length,0,'reduced motion: nothing moves');else assert.ok(animations.length>0);
  loader.destroy();
 }
}));

test('a score shows its points beside the per cent, and a teacher\'s decimals are kept: 43.7/50 is 87%',arranged(async()=>{
 const loader=await live(two());
 // 65 + 25 x 0.874 = 86.85: 43.7 of the unit test's 50 points
 loader.control.setWhatIf('5','2',43.7/50);let html=mod(loader);
 assert.equal(ans(html),'With this score: 43.7/50 (87.4%) → 86.9 · still a B');
 assert.match(html,/Fri · 43\.7\/50 pts/,'the row says the points it was given');assert.match(html,/aria-valuetext="43\.7\/50\s\(87\.4%\) gives 86\.9"/);
 assert.match(html,/data-gi-id="2" data-gi-pts="50" data-gi-day="Fri" data-gi-f="0\.874"/,'kept to the tenth of a point');
 loader.control.setWhatIf('5','4',8.5/10);assert.equal(ans(mod(loader)),'With these scores: 43.7/50, 8.5/10 → 85.6 · still a B','Tests (40 + 43.7) / 100, Labs (9 + 8.5) / 20: 41.85 + 43.75');
 // a pretend assignment keeps its decimals on the device too
 assert.equal(cleanGradeImpact({pretend:{5:[{id:'gp-dec00001',group:'1',points:50,name:'Quiz',score:43.7/50}]}}).pretend['5'][0].score,.874);
}));
