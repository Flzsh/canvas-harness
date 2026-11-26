'use strict';
require('../extension/site.js');
// The 4.2 Planner: days from today with work carried forward, repeating tasks, deadlines with a time, importance, the
// saved data of every earlier build still loading, and the page it draws. (Sample data only.)
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const P=require('../extension/planner-model.js'),{createStore,validateBackup}=require('../extension/storage.js'),Personal=require('../extension/personal-work.js');
const ext=f=>path.join(__dirname,'..','extension',f);
const TODAY='2026-11-22';   // a Sunday
const item=(id,name,extra={})=>({id,name,courseId:'personal',courseName:'Personal',courseColor:'#7c718d',personal:true,dueAt:null,...extra});
const list=(items,local,today=TODAY)=>P.entries(items,local,{dayOf:v=>new Date(v).toISOString().slice(0,10),isDone:(i,m)=>m.checkedOff===true||m.progress==='done',today});

test('a repeat lands on its days: weekly, every other week, weekdays, daily, every other day, monthly',()=>{
 const wk=P.cleanRepeat({every:'week',days:[3,1,1,9]});assert.deepEqual(wk,{every:'week',interval:1,days:[1,3]});
 assert.equal(P.nextOn(wk,'2026-11-22'),'2026-11-23');assert.equal(P.nextOn(wk,'2026-11-24'),'2026-11-25');
 const two=P.cleanRepeat({every:'week',interval:2,days:[1]});assert.equal(P.onRepeat(two,'2026-11-23','2026-11-30'),false);assert.equal(P.onRepeat(two,'2026-11-23','2026-12-07'),true);
 assert.equal(P.nextOn({every:'weekdays',interval:1},'2026-11-21'),'2026-11-23');
 const other=P.cleanRepeat({every:'day',interval:2});assert.equal(P.onRepeat(other,'2026-11-22','2026-11-23'),false);assert.equal(P.onRepeat(other,'2026-11-22','2026-11-24'),true);
 const month=P.cleanRepeat({every:'month'});assert.equal(P.onRepeat(month,'2026-10-31','2026-11-30'),true,'the 31st falls on a short month\'s last day');assert.equal(P.onRepeat(month,'2026-11-05','2026-12-05'),true);
 assert.equal(P.cleanRepeat({every:'year'}),null);assert.equal(P.cleanRepeat({every:'week',days:[]}),null);assert.equal(P.cleanRepeat('daily'),null);
 assert.equal(P.repeatLabel(wk),'Every Mon, Wed');assert.equal(P.repeatLabel({every:'weekdays',interval:1}),'Every weekday');assert.equal(P.repeatLabel(other),'Every other day');assert.equal(P.repeatKey(two),'week/2:1');
});

test('work past its day is carried to today once, never left behind on the day it was missed',()=>{
 const items=[item('local-a','Old reading'),item('local-b','Today thing'),item('local-c','Done earlier'),{id:'41',name:'Canvas essay',courseId:'7',courseName:'English',courseColor:'#335',personal:false,dueAt:'2026-11-20T23:00:00.000Z'}];
 const l=list(items,{'local-a':{plannedDate:'2026-11-18'},'local-b':{plannedDate:TODAY},'local-c':{plannedDate:'2026-11-18',checkedOff:true}});
 const view=P.range(l,TODAY,'2026-11-16',7),day=k=>view.days.find(d=>d.key===k);
 assert.deepEqual(day(TODAY).carried.map(e=>e.id),['local-a','41'],'oldest first');
 assert.ok(!day('2026-11-18').all.some(e=>e.id==='local-a'),'not on the day it was left on');
 assert.ok(day('2026-11-18').all.some(e=>e.id==='local-c'),'finished work stays on its day');
 assert.ok(!day('2026-11-20').all.some(e=>e.id==='41'));
 assert.equal(day(TODAY).open,3);assert.deepEqual(view.overdue,[],'no "from before" tray while today is shown');
 const later=P.range(l,TODAY,'2026-11-29',7);assert.deepEqual(later.overdue.map(e=>e.id),['local-a','41'],'another week shows them in the tray');assert.ok(later.days.every(d=>!d.carried.length));
 // the Home module's week (Monday to Sunday) keeps its shape
 const b=P.board(l,TODAY,0);assert.equal(b.days.length,7);assert.equal(b.days[0].key,'2026-11-16');assert.ok(Array.isArray(b.waiting)&&Array.isArray(b.someday)&&Array.isArray(b.overdue));
});

test('a repeating task shows its next days as echoes, moves on when ticked, keeps the ticked day, and undoes',()=>{
 const data={customTasks:[{id:'local-p',name:'Piano',courseId:'personal',dueAt:null,createdAt:'2026-11-01T00:00:00.000Z',repeat:{every:'week',interval:1,days:[1,4]}}],tasks:{'local-p':{plannedDate:'2026-11-23',estimate:30,checkedOff:false,progress:'not-started',checklist:[]}}};
 const items=()=>Personal.normalize(data,[]);
 let l=list(items(),data.tasks),view=P.range(l,TODAY,TODAY,7),on=k=>view.days.find(d=>d.key===k).all.filter(e=>e.id==='local-p');
 assert.equal(on('2026-11-23')[0].echo,undefined);assert.equal(on('2026-11-26')[0].echo,true);assert.equal(on('2026-11-24').length,0);
 assert.equal(view.days.find(d=>d.key==='2026-11-26').minutes,30,'an echo counts in its day\'s load');
 P.complete('local-p','2026-11-23')(data);assert.equal(data.tasks['local-p'].plannedDate,'2026-11-26');assert.deepEqual(data.tasks['local-p'].repeatLog,[{day:'2026-11-23'}]);
 l=list(items(),data.tasks,'2026-11-23');view=P.range(l,'2026-11-23','2026-11-23',7);
 const ticked=view.days[0].all.find(e=>e.id==='local-p');assert.equal(ticked.done,true);assert.equal(ticked.logged,true);
 P.uncomplete('local-p')(data);assert.equal(data.tasks['local-p'].plannedDate,'2026-11-23');assert.equal(data.tasks['local-p'].repeatLog.length,0);
 // a missed daily task does not pile up: done late, its next day is today
 data.customTasks[0].repeat={every:'day',interval:1};data.tasks['local-p'].plannedDate='2026-11-18';P.complete('local-p',TODAY)(data);assert.equal(data.tasks['local-p'].plannedDate,TODAY);
 P.complete('local-p',TODAY,{skip:true})(data);assert.equal(data.tasks['local-p'].plannedDate,'2026-11-23');assert.equal(data.tasks['local-p'].repeatLog.at(-1).skip,true);
 // ticked as a whole on another surface (checkedOff on the series): the next day reads open
 data.tasks['local-p']={plannedDate:'2026-11-18',checkedOff:true,progress:'not-started'};l=list(items(),data.tasks);const e=l.find(x=>x.id==='local-p');assert.equal(e.done,false);assert.equal(e.planned,TODAY);
 P.setRepeat('local-p',null)(data);assert.equal(data.customTasks[0].repeat,undefined);
});

test('a quick add is saved with its deadline time in the student\'s zone, its repeat, its importance and its time',()=>{
 const data={customTasks:[],tasks:{}};
 const essay=P.parseQuick('essay due fri 5pm 45m !',TODAY);P.addTask(essay,{id:'local-e',nowISO:'2026-11-22T12:00:00.000Z',zone:'America/New_York'})(data);
 assert.equal(data.customTasks[0].dueAt,'2026-11-27T22:00:00.000Z');assert.equal(data.tasks['local-e'].plannedDate,'','a deadline is not a planned day');assert.equal(data.tasks['local-e'].estimate,45);assert.equal(data.tasks['local-e'].priority,'high');
 const piano=P.parseQuick('every mon piano 30 min',TODAY);P.addTask(piano,{id:'local-p',nowISO:'2026-11-22T12:00:00.000Z',zone:'America/New_York'})(data);
 assert.deepEqual(data.customTasks[1].repeat,{every:'week',interval:1,days:[1]});assert.equal(data.tasks['local-p'].plannedDate,'2026-11-23');
 const call=P.parseQuick('call mom tmr 4:30pm',TODAY);P.addTask(call,{id:'local-c',nowISO:'2026-11-22T12:00:00.000Z'})(data);assert.equal(data.tasks['local-c'].plannedTime,'16:30');assert.equal(data.tasks['local-c'].plannedDate,'2026-11-23');
 assert.equal(P.instant('2026-03-08','03:30','America/New_York'),'2026-03-08T07:30:00.000Z','after the clocks spring forward');
 assert.equal(P.instant('2026-11-01','01:30','America/New_York').slice(0,13),'2026-11-01T05','the first 1:30 of the fall-back night');
 assert.throws(()=>P.addTask({name:'x',at:'25:00'},{id:'local-x'}),/time/i);
 P.plan('local-c','2026-11-25','')(data);assert.equal(data.tasks['local-c'].plannedTime,undefined);P.plan('local-c','')(data);assert.equal(data.tasks['local-c'].plannedDate,'');
 P.priority('local-e','')(data);assert.equal(data.tasks['local-e'].priority,undefined);P.remove('local-e')(data);assert.equal(data.customTasks.some(t=>t.id==='local-e'),false);assert.equal(data.tasks['local-e'],undefined);
});

test('saved planner data from every earlier build loads unchanged; the new fields survive a save and a backup',async()=>{
 // a 4.0.190 record: planned days, a time, lengths, steps, a personal task with a source, a Canvas assignment's plan
 const old={format:'reserve-backup',version:1,data:{settings:{},customTasks:[{id:'local-1',name:'Outline the lab write-up',courseId:'101',dueAt:null,createdAt:'2026-11-10T12:00:00.000Z'},{id:'local-2',name:'Pack gym bag',courseId:'personal',dueAt:null,createdAt:'2026-11-10T12:00:00.000Z'}],
  tasks:{'local-1':{pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:45,plannedDate:'2026-11-23',plannedTime:'16:00',checklist:[{id:'a',text:'Intro',done:true}]},'local-2':{pinned:false,checkedOff:false,progress:'not-started',notes:'',estimate:0,plannedDate:'2026-11-19',checklist:[]},'10103':{pinned:true,checkedOff:false,progress:'in-progress',notes:'n',estimate:60,plannedDate:'2026-11-24',checklist:[]}}}};
 const data=validateBackup(JSON.parse(JSON.stringify(old)));
 assert.deepEqual(data.tasks['local-1'],old.data.tasks['local-1']);assert.deepEqual(data.tasks['10103'],old.data.tasks['10103']);assert.equal(data.customTasks.length,2);
 const items=[...Personal.normalize(data,[{id:'101',name:'Chemistry',color:'#286452'}]),{id:'10103',name:'Titration lab report',courseId:'101',courseName:'Chemistry',personal:false,dueAt:'2026-11-25T04:59:00.000Z'}];
 const l=list(items,data.tasks),view=P.range(l,TODAY,TODAY,7),day=k=>view.days.find(d=>d.key===k);
 assert.deepEqual(day('2026-11-23').all.map(e=>[e.id,e.plannedTime,e.estimate,e.steps]),[['local-1','16:00',45,1]]);
 assert.deepEqual(day('2026-11-24').all.map(e=>e.id),['10103']);assert.deepEqual(day(TODAY).carried.map(e=>e.id),['local-2'],'old work past its day comes to today');
 assert.deepEqual(P.migrate(JSON.parse(JSON.stringify(data))).tasks,data.tasks,'migration changes nothing in old data');
 // the 4.2 fields: kept by the store and by a backup; a shape a later build might write is dropped, never refused
 const adapter=(()=>{const m={};return {read:async k=>structuredClone(m[k]),write:async(k,v)=>{m[k]=structuredClone(v);}};})(),store=createStore({accountId:'1',adapter});await store.load();
 await store.update(s=>{s.customTasks.push({id:'local-r',name:'Piano',courseId:'personal',dueAt:null,createdAt:'2026-11-22T12:00:00.000Z',repeat:{every:'week',interval:1,days:[1]}},{id:'local-z',name:'Odd',courseId:'personal',dueAt:null,createdAt:'2026-11-22T12:00:00.000Z',repeat:{every:'fortnight-ish'}});s.tasks['local-r']={plannedDate:'2026-11-23',repeatLog:[{day:'2026-11-16'},{day:'bad'},{day:'2026-11-09',skip:true}],priority:'high'};s.tasks['local-z']={plannedDate:'',priority:'urgent'};});
 const saved=await createStore({accountId:'1',adapter}).load();
 assert.deepEqual(saved.customTasks.find(t=>t.id==='local-r').repeat,{every:'week',interval:1,days:[1]});assert.equal(saved.customTasks.find(t=>t.id==='local-z').repeat,undefined);assert.equal(saved.customTasks.find(t=>t.id==='local-z').name,'Odd');
 assert.deepEqual(saved.tasks['local-r'].repeatLog,[{day:'2026-11-16'},{day:'2026-11-09',skip:true}]);assert.equal(saved.tasks['local-r'].priority,'high');assert.equal(saved.tasks['local-z'].priority,undefined);
 const back=validateBackup({format:'reserve-backup',version:1,data:saved});assert.deepEqual(back.customTasks.find(t=>t.id==='local-r').repeat,saved.customTasks.find(t=>t.id==='local-r').repeat);assert.deepEqual(back.tasks['local-r'],saved.tasks['local-r']);
 const m=P.migrate({customTasks:[{id:'local-q',name:'q',repeat:{every:'week',days:[]}}],tasks:{'local-q':{plannedDate:'nope',plannedTime:'10:00',priority:'x',repeatLog:'?'}}});
 assert.equal(m.customTasks[0].repeat,undefined);assert.deepEqual(m.tasks['local-q'],{plannedDate:''});
});

// The page, drawn in a sandbox of its own (loaded into the suite's process, planner-model and widgets would register
// their Biscuit sources there and change other tests).
function page(){
 const sandbox={console,Intl,Date,Math,JSON,Number,String,Object,Array,Set,Map,RegExp,Error};sandbox.globalThis=sandbox;vm.createContext(sandbox);
 for(const file of ['site.js','core.js','planner-model.js','widgets.js','planner-ui.js'])vm.runInContext(fs.readFileSync(ext(file),'utf8'),sandbox,{filename:file});
 const Core=sandbox.ReserveCore,NOW=Date.parse('2026-11-22T17:00:00Z'),course={id:'7',name:'Chemistry',color:'#286452'};
 const h={E:v=>String(v??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';'),dayKey:(v,tz)=>Core.dayKey(v,tz),complete:Core.isComplete,formatDate:(v,tz,o)=>new Intl.DateTimeFormat('en-US',{timeZone:tz,...o}).format(new Date(v))};
 const items=[Core.normalizeAssignment({id:'17',name:'Gas laws',due_at:'2026-11-24T20:00:00Z',submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}},course),item('local-a','Flashcards'),item('local-o','Old thing'),item('local-r','Piano',{repeat:{every:'week',interval:1,days:[1,4]}}),item('local-w','Whenever thing')];
 const local={'local-a':{plannedDate:'2026-11-23',estimate:30,plannedTime:'16:00'},'local-o':{plannedDate:'2026-11-19'},'local-r':{plannedDate:'2026-11-23',estimate:20}};
 const c={now:NOW,s:{timeZone:'America/New_York'},local,courses:[course],courseMap:new Map([['7',course]]),items,personal:{}};
 return {UI:sandbox.ReservePlannerUI,c,h};
}
test('the page: the chosen day (today first), work past its day in the folded Overdue line, a reading line for a draft, a day view',()=>{
 // (4.2.13: the day's page and the calendar replace the rows; work left on a day already gone is no longer carried to today:
 // it stays on its day and is counted in the one Overdue line, whose list holds it)
 const {UI,c,h}=page();
 const html=UI.render(c,h,{drafts:{'':{text:'chem essay due fri 5pm 45m',ignore:[]}}});
 const days=[...html.matchAll(/data-rd-key="pc-(\d{4}-\d{2}-\d{2})"/g)].map(m=>m[1]);assert.equal(days[0],'2026-11-16','the calendar starts on the Monday of the week with today');assert.ok(days.includes(TODAY));
 assert.match(html,/<em class="rd-plan-today">Today<\/em>/);assert.match(html,/aria-label="Overdue: 1"/);
 const pg=html.slice(html.indexOf('<section class="rd-plan-page"'),html.indexOf('<section class="rd-plan-cal"'));
 assert.doesNotMatch(pg,/data-plan-id="local-o"/,'the work left on Thursday is not on today');assert.doesNotMatch(html,/Carried over|from Thu/);
 assert.equal((html.match(/data-plan-id="local-o"/g)||[]).length,1,'it stands once: on its own day');
 assert.match(html,/data-rd-key="pe-local-r@2026-11-26"[^>]*data-echo="true"/,'Thursday\'s echo of the repeat');
 const chips=[...html.matchAll(/data-kind="(\w+)"[^>]*>(?:<svg[\s\S]*?<\/svg>|<b[^>]*>!<\/b>)<span>([^<]*)<\/span>/g)].map(m=>m[1]+':'+m[2]);
 assert.deepEqual(chips,['date:Due Fri, Nov 27','time:5:00 PM','duration:45 min','course:Chemistry']);
 assert.match(html,/value="chem essay due fri 5pm 45m"/,'the draft survives a redraw');
 assert.match(html,/<span>No date<\/span><b>1<\/b>/);assert.doesNotMatch(html,/Still open from before/);
 // no standing description beside a control: the help sentence is for screen readers only
 assert.match(html,/<p class="rd-sr-only" id="rd-plan-help">/);assert.doesNotMatch(html,/placeholder="Add a task[^"]+"/);
 const taken=UI.render(c,h,{drafts:{'':{text:'chem essay due fri 5pm',ignore:['time']}}});assert.match(taken,/data-kind="time" data-field-day="" data-off="true"/);
 // a 4.2 "day" view: Month with that day chosen (its page at the left)
 const day=UI.render(c,h,{mode:'day',day:'2026-11-23'});
 assert.match(day,/data-mode="month"/);assert.match(day,/<h2 id="rd-plan-day-title"[^>]*>Mon, Nov 23<\/h2>/);assert.match(day,/data-rd-key="pc-2026-11-23"[^>]*aria-selected="true"/);
 const empty=UI.render({...c,items:[],local:{},__plan:null},h,{});assert.match(empty,/Nothing today/);
 const emptyDay=UI.render({...c,items:[],local:{},__plan:null},h,{mode:'day',day:'2026-11-25'});assert.match(emptyDay,/Nothing on Wednesday/);
});

test('the reading line: a day only implied by a time is shown but cannot be taken back; a day\'s own field shows its day',()=>{
 const {UI,c,h}=page(),r=UI.reading('call mom at 5',{today:'2026-11-22',now:12*60,courses:c.courses,ignore:[],tz:'America/New_York',formatDate:h.formatDate});
 assert.deepEqual(JSON.parse(JSON.stringify(r.chips.map(x=>[x.kind,x.text,!!x.quiet]))),[['date','Today',true],['time','5:00 PM',false]]);
 const col=UI.reading('read notes 20m',{today:'2026-11-22',now:12*60,courses:[],ignore:[],tz:'America/New_York',formatDate:h.formatDate,fieldDay:'2026-11-24'});
 assert.equal(col.parsed.day,'2026-11-24');assert.deepEqual(JSON.parse(JSON.stringify(col.chips.map(x=>x.kind))),['date','duration']);assert.equal(col.chips[0].quiet,true);
});

// Biscuit (the local, no-network companion) shares the reader where it is natural: an own task it adds goes under the
// course a word of its title means, as a quick add does; Biscuit's title, day, length and time are kept as it read them.
test('a task Biscuit adds is filed under the course its title names, title kept word for word',async()=>{
 const Core=require('../extension/core.js'),Controls=require('../extension/biscuit-controls.js');
 const disk=new Map(),adapter={read:async k=>structuredClone(disk.get(k)),write:async(k,v)=>{disk.set(k,structuredClone(v));}},store=createStore({accountId:'planner-42',adapter});await store.load();
 let captured;const doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]},save=fn=>store.update(fn).then(()=>true);
 const env=vm.createContext({console,Date,Intl,Map,Set,Promise,URL,ReserveCore:Core,ReservePlanner:P,ReserveBiscuitControls:Controls,ReserveFeatures:{enabled:()=>true},ReservePetArt:{},ReservePets:{clean:v=>({...v}),create:o=>{captured=o;return {sync(){},setFocus(){},destroy(){}};}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
 vm.runInContext(fs.readFileSync(ext('widgets.js'),'utf8'),env,{filename:'widgets.js'});
 const w=env.ReserveWidgets.create({container,store,save,rerender(){},getContext:()=>({s:store.get().settings,personal:store.get(),items:[],courses:[{id:'101',name:'CL Chemistry-Section A'},{id:'106',name:'CL English: American Lit'}],local:store.get().tasks,now:Date.now()}),helpers:()=>({dayKey:Core.dayKey,complete:Core.isComplete})});w.sync();
 assert.notEqual((await captured.actions.task({name:'Chem lab writeup tomorrow',day:'2026-11-23',estimate:60}))?.ok,false);
 assert.notEqual((await captured.actions.task({name:'Buy poster board',day:'',estimate:30}))?.ok,false);
 const [a,b]=store.get().customTasks;assert.equal(a.name,'Chem lab writeup tomorrow');assert.equal(a.courseId,'101');assert.equal(store.get().tasks[a.id].plannedDate,'2026-11-23');assert.equal(store.get().tasks[a.id].estimate,60);
 assert.equal(b.courseId,'personal');w.destroy?.();
});

test('Week or Month is remembered with the student\'s data; data without it opens on Month',async()=>{
 // (4.2.13: the default is Month; 4.2.12's "list" and 4.2's "day" read as Month; Week saved stays Week)
 const {UI,c,h}=page();
 assert.match(UI.render(c,h,{}),/data-mode="month"/,'old data: Month');
 for(const v of ['day','list','month','nonsense'])assert.match(UI.render({...c,personal:{toolbox:{planner:{view:v}}},__plan:null},h,{}),/data-mode="month"/,v);
 assert.match(UI.render({...c,personal:{toolbox:{planner:{view:'week'}}},__plan:null},h,{}),/data-mode="week"/,'a saved Week stays Week');
 assert.match(UI.render({...c,personal:{toolbox:{planner:{view:'day'}}},__plan:null},h,{mode:'week'}),/data-mode="week"/,'a choice made on the page wins');
 const adapter=(()=>{const m={};return {read:async k=>structuredClone(m[k]),write:async(k,v)=>{m[k]=structuredClone(v);}};})(),store=createStore({accountId:'2',adapter});await store.load();
 await store.update(s=>{s.toolbox={...s.toolbox,planner:{view:'day'}};});
 const saved=await createStore({accountId:'2',adapter}).load();assert.equal(saved.toolbox.planner.view,'day');
 assert.equal(validateBackup({format:'reserve-backup',version:1,data:saved}).toolbox.planner.view,'day','kept by a backup');
});
test('a long word in a narrow day breaks only between its syllables, with a hyphen, and only when it must',()=>{
 // (4.2.13: the day's page; its row's title ends in an ellipsis rather than wrapping, and keeps the soft hyphens)
 const {UI,c,h}=page(),html=UI.render({...c,items:[...c.items,item('local-m','Microcontroller wiring diagram')],local:{...c.local,'local-m':{plannedDate:'2026-11-24'}},__plan:null},h,{day:'2026-11-24'});
 assert.match(html,/<span>Micro­con­trol­ler wiring diagram<\/span>/);
 assert.match(html,/aria-label="Microcontroller wiring diagram"/,'read aloud whole');
 assert.match(UI.render(c,h,{day:'2026-11-23'}),/<span>Flashcards<\/span>/,'a word of ten letters or fewer is left alone');
 assert.match(fs.readFileSync(ext('widgets.css'),'utf8'),/\.rd \.rd-plan-title > span \{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\}/);
});

test('a repeating task put away on Home (Archive) is that day done; the next days still show, and the Planner carries on from it',()=>{
 const data={customTasks:[{id:'local-h',name:'Piano',courseId:'personal',dueAt:null,createdAt:'2026-11-01T00:00:00.000Z',repeat:{every:'week',interval:1,days:[0,2]}}],tasks:{'local-h':{plannedDate:'2026-11-22',checkedOff:true,progress:'not-started',estimate:30,checklist:[]}}};
 const items=()=>Personal.normalize(data,[]);
 let l=list(items(),data.tasks,'2026-11-22'),v=P.range(l,'2026-11-22','2026-11-22',7),on=k=>v.days.find(d=>d.key===k).all.filter(e=>e.id==='local-h');
 assert.equal(on('2026-11-22')[0].done,true,'done on the day it was put away');assert.equal(on('2026-11-24')[0]?.echo,true,'Tuesday still shows');
 l=list(items(),data.tasks,'2026-11-24');assert.equal(l[0].planned,'2026-11-24');assert.equal(l[0].done,false,'two days later the series is open on its next day');
 P.complete('local-h','2026-11-24')(data);assert.deepEqual(data.tasks['local-h'].repeatLog,[{day:'2026-11-22'},{day:'2026-11-24'}],'the archived day and the ticked day are both in the log');assert.equal(data.tasks['local-h'].plannedDate,'2026-11-29');assert.equal(data.tasks['local-h'].checkedOff,false);
});
