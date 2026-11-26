'use strict';
require('../extension/site.js');
// "Put it in my planner" on a Help card and "This week" in Help's band and on the Planner page (4.2): the drawer shows the
// plan as tasks, the student changes and removes rows, and only Add puts them in the planner; Undo takes them back. The
// week's findings act, dismiss and undo. All of it with Help off and no AI: nothing is ever sent (no message, no fetch,
// no question to the AI). Sample data and made-up card replies only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Band=require('../extension/study-band.js'),H=require('../extension/help-plan.js'),P=require('../extension/planner-model.js'),Personal=require('../extension/personal-work.js');
const {dom,descendants,tick}=require('./study-fixture.cjs');
delete globalThis.ReserveHelpPlan;
const ext=f=>path.join(__dirname,'..','extension',f);
const ZONE='America/New_York',NOW=Date.parse('2026-11-22T15:00:00Z');   // Sunday 22 November 2026, 10:00 AM
const COURSES=[{id:'101',name:'Chemistry'},{id:'102',name:'English'}];
const dayIn=v=>new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(typeof v==='number'?v:Date.parse(v));
const canvas=(id,name,dueAt,extra={})=>({id,name,courseId:'101',courseName:'Chemistry',courseColor:'#286452',dueAt,personal:false,points:20,submissionTypes:['online_upload'],...extra});
const STUDY={v:1,kind:'study',title:'Unit 4 Test',size:'xl',grid:4,headline:'Unit 4 Test',importance:1,minutes:80,sheet:[{heading:'Mole ratios',facts:[{text:'Use the balanced equation'}]},{heading:'Limiting reagent',facts:[{text:'Compare ratios'}]},{heading:'Percent yield',facts:[{text:'actual over theoretical'}]}],tip:'',practice:[{q:'How many moles?',answer:'2 mol',why:'1:1'}],gaps:[]};
const ASK={v:1,kind:'ask',title:'Answer',headline:'Start here',size:'s',grid:4,importance:1,points:[{text:'Read the question.'}],next:'Go on.',gaps:[]};
const aid=(data,extra={})=>({v:1,kind:data.kind,itemId:'501',courseId:'101',item:'Unit 4 Test: Stoichiometry',dueAt:'2026-11-27T17:00:00Z',title:data.title,savedAt:NOW-60000,day:'2026-11-22',data,progress:{},prepare:true,...extra});
// The student's saved data and the planner bridge over it, as the dashboard makes it (help-plan.js bridge).
function student(items=[]){
 const data={customTasks:[],tasks:{},toolbox:{}},saves=[];
 const read=()=>({list:P.entries([...items,...Personal.normalize(data,COURSES)],data.tasks,{dayOf:dayIn,isDone:(i,m)=>m.checkedOff===true||m.progress==='done',today:'2026-11-22'}),items,toolbox:data.toolbox,customTasks:data.customTasks,courses:COURSES,now:NOW,zone:ZONE});
 let n=0;const bridge=H.bridge({read,save:async change=>{change(data);saves.push(1);return true;},newId:()=>'local-u'+(n++)});
 return {data,bridge,saves,read};
}
// Nothing may be sent: a message to the extension, a fetch, a question to the AI.
function watch(){const sent=[],before=globalThis.fetch;globalThis.fetch=(...a)=>{sent.push(['fetch',a]);throw Error('no network');};
 const env={chrome:{runtime:{sendMessage:(...a)=>{sent.push(['message',a]);return Promise.resolve({ok:false});},onMessage:{addListener(){},removeListener(){}}}}};
 return {sent,env,restore(){globalThis.fetch=before;},onAsk:(...a)=>{sent.push(['ask',a]);return {ok:false,message:'no'};}};}
function band(aids,{planner,help=true}={}){
 const d=dom(),host=new d.Element('div'),w=watch(),view=Band.renderBand(host,aids,{env:{document:d.document,...w.env},planner,timeZone:()=>ZONE,now:()=>NOW,...(help?{onAsk:w.onAsk}:{})});
 const all=()=>descendants(host),by=cls=>all().filter(n=>String(n.className).split(' ').includes(cls));
 return {host,view,w,all,by,acts:()=>by('ch-band-acts')[0]?.children.map(n=>n.dataset.act),press:act=>all().find(n=>n.dataset?.act===act&&n.tagName==='BUTTON').fire('click'),text:()=>host.textContent};
}

test('the card: "Put it in my planner" is on a card that holds a plan, never on one that does not, and only where a planner is given',async()=>{
 const s=student(),f=band({a:aid(STUDY)},{planner:s.bridge});await f.view.loaded;
 assert.deepEqual(f.acts(),['ask','plan','done'],'the study sheet has it, before Done');
 const label=f.all().find(n=>n.dataset?.act==='plan');assert.equal(label.textContent,'Put it in my planner','a drawing and its name');
 for(const data of [ASK,{...ASK,kind:'examples',problems:[{title:'x',problem:'p',steps:['s'],answer:'a'}]},{...ASK,kind:'reading',points:[{text:'p'}]},{...STUDY,sheet:[],practice:[]}]){
  const other=band({b:aid(data)},{planner:s.bridge});await other.view.loaded;assert.ok(!other.all().some(n=>n.dataset?.act==='plan'),'no plan in a '+data.kind+' card: no button');other.view.destroy();other.w.restore();}
 for(const data of [{...STUDY,kind:'steps',steps:[{text:'Read the lab',minutes:20}]},{...STUDY,kind:'test',questions:[{title:'x',q:'q',answer:'a',steps:['s']}]},{...STUDY,kind:'outline',sections:[{part:'Introduction'}]}]){
  const other=band({b:aid(data)},{planner:s.bridge});await other.view.loaded;assert.ok(other.all().some(n=>n.dataset?.act==='plan'),data.kind+' card: the button');other.view.destroy();other.w.restore();}
 const none=band({a:aid(STUDY)});await none.view.loaded;assert.ok(!none.all().some(n=>n.dataset?.act==='plan'),'no planner given: no button');
 const done=band({a:aid(STUDY,{progress:{archived:true}})},{planner:s.bridge});await done.view.loaded;assert.ok(!done.all().some(n=>n.dataset?.act==='plan'),'a ticked card: no button');
 for(const x of [f,none,done]){x.view.destroy();x.w.restore();}
});

test('the drawer: the plan as rows first; days, names and lengths changed and a row removed; Add puts exactly those in the planner; Undo takes them back; nothing is sent',async()=>{
 const s=student(),f=band({a:aid(STUDY)},{planner:s.bridge});await f.view.loaded;
 f.press('plan');
 const rows=()=>f.by('ch-band-plan-row');assert.equal(rows().length,4);assert.equal(s.data.customTasks.length,0,'nothing is added by opening it');
 assert.match(f.by('ch-band-plan-head')[0].textContent,/^Before Fri, Nov 27 \u00b7 4 sessions \u00b7 1 h 15 min$/);
 const [day0,title0,len0]=rows()[0].children;assert.equal(day0.tagName,'SELECT');assert.deepEqual(day0.children.map(o=>o.value),['','2026-11-22','2026-11-23','2026-11-24','2026-11-25','2026-11-26'],'only days before the due date (or none)');
 assert.equal(title0.value,'Study: Mole ratios \u00b7 Unit 4 Test: Stoichiometry');assert.equal(title0.maxLength,80);
 // change the first row, then remove the third
 title0.value='Mole ratios flashcards';title0.fire('input',{stopPropagation(){}});day0.value='2026-11-23';day0.fire('change',{stopPropagation(){}});len0.value='45';len0.fire('change',{stopPropagation(){}});
 rows()[2].children[3].fire('click');assert.equal(rows().length,3);assert.equal(rows()[0].children[1].value,'Mole ratios flashcards','a change survives the redraw');
 const add=f.all().find(n=>String(n.className).includes('ch-band-plan-add'));assert.equal(add.textContent,'Add 3 to my planner');
 await add.fire('click');await tick();
 assert.deepEqual(s.data.customTasks.map(t=>[t.name,t.courseId]),[['Mole ratios flashcards','101'],['Study: Limiting reagent \u00b7 Unit 4 Test: Stoichiometry','101'],['Practice: 1 question \u00b7 Unit 4 Test: Stoichiometry','101']]);
 assert.deepEqual([s.data.tasks['local-u0'].plannedDate,s.data.tasks['local-u0'].estimate],['2026-11-23',45]);
 assert.match(f.text(),/Added 3 to your planner\./);
 // Undo
 f.press('back');await tick();assert.deepEqual(s.data.customTasks,[]);assert.match(f.text(),/Taken out of your planner\./);assert.equal(rows().length,4,'the plan shows again, made afresh');
 // added again, closed and opened: it says they are in the planner and offers to take them out
 await f.all().find(n=>String(n.className).includes('ch-band-plan-add')).fire('click');await tick();assert.equal(s.data.customTasks.length,4);
 f.press('plan');f.press('plan');assert.match(f.text(),/In your planner: 4 tasks\./);assert.equal(f.all().find(n=>n.dataset?.act==='back').textContent,'Take them out');
 f.press('back');await tick();assert.equal(s.data.customTasks.length,0);
 assert.deepEqual(f.w.sent,[],'no message, no fetch, no question to the AI');f.view.destroy();f.w.restore();
});

test('Help off and no AI at all: the same card still goes into the planner, and nothing is sent',async()=>{
 const s=student(),f=band({a:aid(STUDY)},{planner:s.bridge,help:false});await f.view.loaded;
 assert.deepEqual(f.acts(),['plan','done'],'no Ask (no AI), the planner is still there');f.press('plan');
 await f.all().find(n=>String(n.className).includes('ch-band-plan-add')).fire('click');await tick();assert.equal(s.data.customTasks.length,4);assert.deepEqual(f.w.sent,[]);
 f.view.destroy();f.w.restore();
});

test('an odd plan in the drawer: no due date, a full planner, a plan of 40 parts; its notes show and nothing is put on a full day',async()=>{
 const s=student();for(const d of ['2026-11-22','2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27','2026-11-28'])for(let i=0;i<4;i++){const id='local-f'+d.slice(8)+i;s.data.customTasks.push({id,name:'Busy '+i,courseId:'personal',dueAt:null,createdAt:'2026-11-20T00:00:00.000Z'});s.data.tasks[id]={plannedDate:d,estimate:30,checklist:[],notes:''};}
 const forty={...STUDY,minutes:600,sheet:Array.from({length:40},(_,i)=>({heading:'Topic '+(i+1),facts:[]}))};
 const f=band({a:aid(forty,{dueAt:undefined})},{planner:s.bridge});await f.view.loaded;f.press('plan');
 const notes=f.by('ch-band-plan-note').map(n=>n.textContent);assert.ok(notes.includes('No due date: spread over the next week.'));assert.ok(notes.some(t=>/parts made into 8 sessions\./.test(t)));assert.ok(notes.some(t=>/^No room for 8 sessions: pick a day or leave them without one\.$/.test(t)));
 const rows=f.by('ch-band-plan-row');assert.equal(rows.length,8);assert.ok(rows.every(r=>r.children[0].value===''),'no day');assert.ok(rows[0].children[0].children.slice(1).every(o=>/ \u00b7 full$/.test(o.textContent)),'every day is marked full');
 f.view.destroy();f.w.restore();
});

test('This week in Help: the findings under the bar, each with its one action and Dismiss; a done action says so and Undo puts it back; nothing is sent',async()=>{
 const items=[canvas('801','Unit 4 Test','2026-11-27T17:00:00Z')],s=student(items),f=band({a:aid(ASK)},{planner:s.bridge});await f.view.loaded;
 const row=()=>f.by('ch-band-week')[0];assert.equal(row().hidden,false);
 assert.deepEqual(f.by('ch-band-week-item').map(n=>n.children[0].textContent),['Nothing planned for Unit 4 Test on Friday.']);
 const act=()=>f.all().find(n=>String(n.className).includes('ch-band-week-act'));assert.equal(act().textContent,'Add a session on Thu');
 await act().fire('click');await tick();assert.deepEqual(s.data.customTasks.map(t=>t.name),['Study for Unit 4 Test']);assert.equal(s.data.tasks['local-u0'].plannedDate,'2026-11-26');
 f.view.setWeek(s.bridge.findings());assert.deepEqual(f.by('ch-band-week-item').map(n=>n.children[0].textContent),['Added a session on Thu.']);
 await act().fire('click');await tick();assert.deepEqual(s.data.customTasks,[],'Undo');f.view.setWeek(s.bridge.findings());assert.equal(f.by('ch-band-week-item').length,1);
 await f.all().find(n=>n.className==='ch-band-week-dismiss').fire('click');await tick();assert.deepEqual(Object.keys(s.data.toolbox.helpPlan.dismissed),['prep:801:2026-11-27']);
 f.view.setWeek(s.bridge.findings());assert.deepEqual(f.by('ch-band-week-item').map(n=>n.children[0].textContent),['Dismissed.']);
 f.view.setWeek([]);assert.deepEqual(f.by('ch-band-week-item').map(n=>n.children[0].textContent),['Dismissed.'],'the done line stays a moment');
 assert.deepEqual(f.w.sent,[]);f.view.destroy();f.w.restore();
 const quiet=band({a:aid(ASK)},{planner:student().bridge});await quiet.view.loaded;assert.equal(quiet.by('ch-band-week')[0].hidden,true,'nothing to say: no row');quiet.view.destroy();quiet.w.restore();
 const off=band({a:aid(ASK)});await off.view.loaded;off.view.setWeek([{key:'x',kind:'heavy',text:'Too much',action:null}]);assert.equal(off.by('ch-band-week')[0].hidden,true,'no planner: no row');off.view.destroy();off.w.restore();
});

// ---- the Planner page ------------------------------------------------------------------------------------------------
function page({withHelp=true}={}){
 const sandbox={console,Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map,RegExp,Error,Promise};sandbox.globalThis=sandbox;vm.createContext(sandbox);
 for(const file of ['site.js','core.js','personal-work.js','planner-model.js',...(withHelp?['help-plan.js']:[]),'widgets.js','planner-ui.js'])vm.runInContext(fs.readFileSync(ext(file),'utf8'),sandbox,{filename:file});
 const Core=sandbox.ReserveCore,course={id:'101',name:'Chemistry',color:'#286452'};
 const h={E:v=>String(v??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';'),dayKey:(v,tz)=>Core.dayKey(v,tz),complete:Core.isComplete,formatDate:(v,tz,o)=>new Intl.DateTimeFormat('en-US',{timeZone:tz,...o}).format(new Date(v))};
 const test=Core.normalizeAssignment({id:'17',name:'Unit 4 Test',due_at:'2026-11-27T17:00:00Z',submission_types:['online_quiz'],submission:{workflow_state:'unsubmitted'}},course);
 const data={customTasks:[],tasks:{},toolbox:{}};
 const ctx=()=>({now:NOW,s:{timeZone:ZONE},local:data.tasks,courses:[course],courseMap:new Map([['101',course]]),items:[test,...sandbox.ReservePersonalWork.normalize(data,[course])],personal:{toolbox:data.toolbox},__plan:null});
 return {UI:sandbox.ReservePlannerUI,h,data,ctx};
}
// (4.2.13: no advice stands on the page: the calendar's heading has one quiet button "Your week" with the count of its
// findings; its card lists them, each with its one action and its Dismiss; the line that says it was done stands in the card)
test('This week on the Planner: the findings behind one button with their count, each with its drawn action and Dismiss; without help-plan.js no button',()=>{
 const {UI,h,ctx}=page(),html=UI.render(ctx(),h,{});
 assert.doesNotMatch(html,/rd-plan-check"|data-rd-action="plan-check-act"/,'no advice on the page');
 assert.match(html,/<button type="button" class="rd-button rd-plan-tool rd-plan-week-btn" data-rd-action="plan-week-open" aria-expanded="false" aria-haspopup="true"><svg[\s\S]*?<\/svg><span>Your week<\/span><b>1<\/b><\/button>/);
 const open=UI.render(ctx(),h,{weekOpen:true});
 assert.match(open,/<li class="rd-plan-finding" data-rd-key="adv-prep:17:2026-11-27" data-advice-place="week"><p>Nothing planned for Unit 4 Test on Friday\.<\/p><span class="rd-plan-advice"><button type="button" class="rd-button rd-plan-check-act" data-rd-action="plan-check-act" data-key="prep:17:2026-11-27" aria-label="Nothing planned for Unit 4 Test on Friday\. Add a session on Thu"><svg class="rd-plan-ic"/);
 assert.match(open,/<span>Add a session on Thu<\/span><\/button><button type="button" class="rd-plan-x" data-rd-action="plan-check-dismiss" data-key="prep:17:2026-11-27" aria-label="Dismiss: Nothing planned for Unit 4 Test on Friday\." title="Dismiss">/);
 const plain=page({withHelp:false});assert.doesNotMatch(plain.UI.render(plain.ctx(),plain.h,{}),/plan-week-open|rd-plan-advice/);
});
test('This week on the Planner: Add a session adds one task before the test, the line says so with Undo, Undo takes it back; Dismiss and its Undo; nothing is sent',async()=>{
 // (the page runs in a sandbox with no fetch, no chrome and no document: anything that tried to send would throw here)
 const {UI,h,data,ctx}=page(),renders=[];
 const container={dataset:{},addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],ownerDocument:null};
 const ui=UI.create({container,store:{get:()=>data},save:change=>{change(data);return Promise.resolve(true);},rerender:()=>renders.push(1),getContext:ctx,helpers:()=>h});
 // (the button sits in Your week's card)
 const press=(action,key)=>ui.click({target:{closest:sel=>sel==='[data-rd-action]'?{dataset:{rdAction:action,...(key?{key}:{})},closest:s=>s==='[data-advice-place]'?{dataset:{advicePlace:'week'}}:null}:sel==='.rd-plan-weekbox'?{}:null}});
 assert.equal(press('plan-check-act','prep:17:2026-11-27'),true);await tick();
 assert.deepEqual(data.customTasks.map(t=>[t.name,t.courseId]),[['Study for Unit 4 Test','101']]);const id=data.customTasks[0].id;assert.equal(data.tasks[id].plannedDate,'2026-11-26');assert.equal(data.tasks[id].estimate,30);
 let html=UI.render(ctx(),h,ui.ui);assert.match(html,/<div class="rd-plan-pop rd-plan-weekpop" id="rd-plan-week-pop" role="group" aria-label="Your week"><p class="rd-plan-advice" data-done="true" data-rd-key="adv-done"><span>Added a session on Thu\.<\/span><button type="button" class="rd-text-button" data-rd-action="plan-check-undo" >Undo<\/button><\/p>/);
 assert.doesNotMatch(html,/Nothing planned for/,'the finding is settled');
 press('plan-check-undo');await tick();assert.equal(data.customTasks.length,0);html=UI.render(ctx(),h,ui.ui);assert.match(html,/Nothing planned for Unit 4 Test on Friday\./);
 press('plan-check-dismiss','prep:17:2026-11-27');await tick();assert.deepEqual(Object.keys(data.toolbox.helpPlan.dismissed),['prep:17:2026-11-27']);
 html=UI.render(ctx(),h,ui.ui);assert.match(html,/<span>Dismissed\.<\/span>/);assert.doesNotMatch(html,/Nothing planned for/);
 press('plan-check-undo');await tick();assert.equal(Object.keys(data.toolbox.helpPlan.dismissed).length,0);
 assert.equal(press('plan-check-act','prep:does-not-exist'),true,'a finding gone since: nothing happens');assert.equal(data.customTasks.length,0);
 assert.ok(renders.length>=3,'the page is drawn again after each');ui.destroy();
});
