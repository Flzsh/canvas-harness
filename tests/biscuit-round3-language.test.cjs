'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Parse=require('../extension/biscuit-parse.js'),Planner=require('../extension/biscuit-planner.js');
const MIN=60000,now=Date.parse('2026-10-22T20:02:15Z'),at=Date.parse,snapshot=(extra={})=>({now,timeZone:'America/New_York',settings:{bedtime:'22:30'},courses:[{id:'course-a',name:'Geometry'},{id:'course-b',name:'Composition'}],assignments:[{id:'task-a',title:'Diagram Workbook',courseId:'course-a',estimate:25,dueAt:'2026-10-24T20:00:00Z'}],local:{},focus:{running:false},...extra}),running=()=>snapshot({focus:{running:true,minutes:25,endsAt:now+15*MIN}}),first=(line,s=snapshot())=>{const candidates=Parse.local(line,s);assert.ok(Array.isArray(candidates)&&candidates.length,line);assert.ok(candidates.length<=3);for(const c of candidates)assert.deepEqual(Object.keys(c).sort(),['fields','intent','preview']);return candidates[0];},freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
for(const [line,fields] of [
 ['less bright',{key:'theme',value:'dark'}],
 ['make this brighter',{key:'theme',value:'light'}],
 ['outside light theme pls the screen is difficult to read',{key:'theme',value:'light'}],
 ['put row density on comfortable',{key:'density',value:'comfortable'}],
 ['set course navigation to the left sidebar please, I need room for work',{key:'courseNavigation',value:'sidebar'}],
 ['meeting over show grades again just for me',{key:'showGrades',value:true}],
 ['switch bookmark visibility back on, I use it often',{key:'showBookmarks',value:true}]
])test('loose appearance and visibility: '+line,()=>{const c=first(line);assert.equal(c.intent,'setting');assert.deepEqual(c.fields,fields);});
for(const [line,fields] of [
 ['I am using a notebook now, disable the planner feature for a while',{id:'planner',on:false}],
 ['course hub feature off pls too much clutter',{id:'course-hub',on:false}],
 ['focus room is unavailable. activate that feature for later',{id:'focus-room',on:true}],
 ['turn off motion while I focus on the workbook',{id:'motion',on:false}],
 ['enable the materials feature first, I need a file',{id:'materials',on:true}],
 ['re-enable interface animations, I have finished presenting',{id:'motion',on:true}]
])test('feature requests retain their named feature: '+line,()=>{const c=first(line,running());assert.equal(c.intent,'feature');assert.deepEqual(c.fields,fields);});
for(const [line,fields] of [
 ['home is cramped hide the week widget while I work',{action:'hide',key:'week'}],
 ['notes card first on home before the clock please',{action:'top',key:'notes'}],
 ['the timer card on home is narrow. make that module full width',{action:'wide',key:'timer'}],
 ['unhide clock card on home please',{action:'show',key:'clock'}]
])test('module requests keep their home module: '+line,()=>{const c=first(line,running());assert.equal(c.intent,'module');assert.deepEqual(c.fields,fields);});
for(const [line,action,minutes] of [
 ['pause that','pause'],['hold my focus countdown','pause'],['unpause that focus timer','resume'],['end this focus session completely','stop'],
 ['10 more mins','adjust',10],['-5','adjust',-5],['5moremin','adjust',5],
 ['tack seven extra minutes onto this focus countdown','adjust',7],
 ['knock ten minutes off my focus timer, keep counting','adjust',-10]
])test('contextual timer controls: '+line,()=>{const c=first(line,running());assert.equal(c.intent,'focus-control');assert.deepEqual(c.fields,{action,...(minutes===undefined?{}:{minutes})});});
test('a paused timer supplies context without a running countdown',()=>{const c=first('unpause that',snapshot({focus:{running:false,paused:true,minutes:30}}));assert.deepEqual(c.fields,{action:'resume'});});
test('a finish-time question inspects focus without changing it',()=>{const s=freeze(running()),before=JSON.stringify(s),c=first('can you tell me if my current focus ends before I leave',s);assert.equal(c.intent,'focus-status');assert.deepEqual(c.fields,{});assert.equal(JSON.stringify(s),before);});
for(const line of ['pause that','10 more mins','the second card before I start writing','take a break','open Diagram Workbook and bookmark it'])test('loose commands defer when there is no safe single local action: '+line,()=>assert.equal(Parse.local(line,snapshot()),null));
for(const line of [
 'How do I pause my focus timer?','Can I hide the clock widget?','What happens if I turn off motion?',
 "I don't want to turn off motion",'Do not bookmark the workbook','Never hide the week widget',
 'if I pause my timer I will lose my place','why would I use dark mode?',
 'Explain the words "pause my timer"'
])test('questions, quotations, and negations do not become local changes: '+line,()=>assert.equal(Parse.local(line,running()),null));
test('explicit note capture preserves payload whitespace, spelling, quotes, and command words',()=>{
 const payload='"remind the group"\nKeep  TWO spaces; do not pause the timer.',c=first('save this sentence in my notes verbatim: '+payload);assert.equal(c.intent,'note');assert.equal(c.fields.text,payload);assert.ok(!/[\r\n]/.test(c.preview));
});
test('note-to-self and titled notes do not become reminders',()=>{assert.deepEqual(first('note to self label cabls before unplugging').fields,{text:'label cabls before unplugging'});assert.equal(first('make a note titled final check: listen to the last second').fields.text,'final check: listen to the last second');});
test('local bare note capture coexists with legacy bare-note reminders',()=>{assert.equal(first('note Buy Milk').intent,'note');assert.equal(Parse.parse('note Buy Milk',snapshot())[0].intent,'reminder');});
for(const [line,minutes,title] of [['12mins then ping me unplug the lamp',12,'unplug the lamp'],['25m from now remind me charge the light',25,'charge the light'],['in half an hour nudge me to stretch',30,'stretch']])test('relative reminder request: '+line,()=>{const c=first(line);assert.equal(c.intent,'reminder');assert.equal(c.fields.at,now+minutes*MIN);assert.equal(c.fields.title,title);});
test('leading clock reminders retain the requested day and exact title',()=>{const c=first('07:10 tmrw ping me Put The Form In My Bag');assert.equal(c.intent,'reminder');assert.equal(c.fields.date,'2026-10-23');assert.equal(c.fields.time,'07:10');assert.equal(c.fields.title,'Put The Form In My Bag');});
test('recurring reminders defer to the recurrence router',()=>assert.equal(Parse.local('every Sunday at 18:40 ping me to archive my work',snapshot()),null));
test('bookmark commands resolve direct names and leave pronouns for the parent',()=>{
 const file={id:'reference-file',title:'Angle Formula Sheet',courseId:'course-a'},s=snapshot({files:[file]});assert.equal(first('pin Angle Formula Sheet to bookmarks',s).fields.itemId,file.id);assert.deepEqual(first('keep that in my bookmarks, I will need it later',s).fields,{});assert.equal(first('Diagram Workbook needs a bookmark',s).fields.itemId,'task-a');
});
test('slots distinguish an elapsed departure budget from a start delay',()=>{
 const gap=Parse.slots('bus in 50 mins can you fit my work around that',snapshot()),delay=Parse.slots('start in 20 minutes for 30 minutes',snapshot());assert.equal(gap.endRelative,50);assert.equal(gap.startRelative,undefined);assert.equal(delay.startRelative,20);assert.equal(delay.budgetMinutes,30);assert.equal(delay.endRelative,undefined);
 const p=Planner.build(snapshot(),{text:'bus in 50 mins can you fit my work around that'});assert.equal(p.window.start,at('2026-10-22T20:05:00Z'));assert.equal(p.window.end,now+50*MIN);
});
test('a delayed start and its separate budget both reach the planner',()=>{const p=Planner.build(snapshot(),{text:'start in 20 minutes for 30 minutes'});assert.equal(p.window.start,at('2026-10-22T20:25:00Z'));assert.equal(p.window.end,at('2026-10-22T20:55:00Z'));});
for(const [line,start,end] of [
 ['rebuild tonight before 10','2026-10-22T20:05:00Z','2026-10-23T02:00:00Z'],
 ['plan until 20:15','2026-10-22T20:05:00Z','2026-10-23T00:15:00Z'],
 ['only free 6 to 8 tonight plan my work','2026-10-22T22:00:00Z','2026-10-23T00:00:00Z']
])test('planning windows respect starts and end boundaries: '+line,()=>{const p=Planner.build(snapshot(),{text:line});assert.equal(p.window.start,at(start));assert.equal(p.window.end,at(end));assert.ok(p.blocks.every(b=>b.start>=p.window.start&&b.end<=p.window.end));});
test('a budget and absolute end clip each other',()=>{const p=Planner.build(snapshot(),{minutes:90,end:at('2026-10-22T20:40:00Z')});assert.equal(p.window.end,at('2026-10-22T20:40:00Z'));assert.ok(p.totalMinutes<=35);assert.equal(Planner.build(snapshot(),{until:'17:00'}).window.end,at('2026-10-22T21:00:00Z'));});
test('rescheduling uses the new clause date and clock',()=>{const line='I intended 07:00 tomorrow for reading. move my 30 minute block to 20:00 tonight',slots=Parse.slots(line,snapshot()),p=Planner.build(snapshot(),{text:line});assert.equal(slots.date,'2026-10-22');assert.equal(slots.startMinute,1200);assert.equal(p.window.start,at('2026-10-23T00:00:00Z'));});
test('planning tonight overrides a background tomorrow mention',()=>{const line='tomorrow is packed line up tonights work before 10',slots=Parse.slots(line,snapshot()),p=Planner.build(snapshot(),{text:line});assert.equal(slots.date,'2026-10-22');assert.equal(p.window.start,at('2026-10-22T20:05:00Z'));assert.equal(p.window.end,at('2026-10-23T02:00:00Z'));});
test('a future deadline does not move the planning start to its day',()=>{const slots=Parse.slots('plan before tomorrow morning',snapshot()),p=Planner.build(snapshot(),{text:'plan before tomorrow morning'});assert.equal(slots.date,undefined);assert.equal(slots.boundaryDate,'2026-10-23');assert.equal(p.window.start,at('2026-10-22T20:05:00Z'));assert.equal(p.window.end,at('2026-10-23T02:30:00Z'));});
for(const source of ['busy','events','calendar','assignments'])test('after-event windows use loaded '+source+' end times',()=>{
 const event={id:'meal',title:'Family Dinner',start:'2026-10-22T18:30',end:'2026-10-22T19:15'},extra=source==='assignments'?{assignments:[...snapshot().assignments,event]}:{[source]:source==='calendar'?{events:[event]}:[event]},s=snapshot(extra),slots=Parse.slots('plan for one hour after dinner',s),p=Planner.build(s,{text:'plan for one hour after dinner'});assert.equal(slots.afterAt,at('2026-10-22T23:15:00Z'));assert.equal(slots.unresolvedEvent,undefined);assert.equal(p.window.start,at('2026-10-22T23:15:00Z'));assert.equal(p.window.end,at('2026-10-23T00:15:00Z'));
});
test('unknown event ends require a time and cannot write a plan',()=>{const s=freeze(snapshot()),before=JSON.stringify(s),slots=Parse.slots('one hour after dinner choose a study order',s),p=Planner.build(s,{text:'one hour after dinner choose a study order'}),data={tasks:{},toolbox:{}};assert.equal(slots.unresolvedEvent,'dinner');assert.equal(p.needsTime,true);assert.equal(p.unresolvedEvent,'dinner');assert.equal(p.blocks.length,0);assert.match(p.message,/what time.*dinner.*end/i);assert.equal(Planner.apply(data,p).ok,false);assert.deepEqual(data,{tasks:{},toolbox:{}});assert.equal(JSON.stringify(s),before);});
test('workItems merge with assignments while completed items stay excluded',()=>{const s=snapshot({workItems:[{id:'task-a',estimate:35},{id:'task-b',title:'Outline',courseId:'course-b',estimate:10},{id:'finished',title:'Finished',estimate:10,completed:true}]}),p=Planner.build(s);assert.equal(p.items.find(v=>v.itemId==='task-a').estimate,35);assert.ok(p.items.some(v=>v.itemId==='task-b'));assert.ok(!p.items.some(v=>v.itemId==='finished'));});
test('requested task duration is distinct from an available window budget',()=>{const s=snapshot(),budget=Planner.build(s,{itemId:'task-a',minutes:35}),requested=Planner.build(s,{itemId:'task-a',minutes:35,durationMinutes:35});assert.equal(budget.items[0].estimate,25);assert.equal(budget.totalMinutes,25);assert.equal(requested.items[0].estimate,35);assert.equal(requested.totalMinutes,35);assert.equal(requested.breakMinutes,5);assert.equal(requested.workMinutes+requested.remainingMinutes,35);});
test('explicit item order spans courses and excludes unrelated urgent work',()=>{const s=snapshot({assignments:[{id:'task-a',title:'First task',courseId:'course-a',estimate:20},{id:'task-b',title:'Second task',courseId:'course-b',estimate:10,missing:true},{id:'unrelated',title:'Other task',estimate:60,missing:true}]}),p=Planner.build(s,{itemId:'task-a',itemIds:['task-a','task-b'],courseId:'course-a',minutes:60});assert.deepEqual(p.items.map(v=>v.itemId),['task-a','task-b']);assert.deepEqual([...new Set(p.blocks.filter(v=>v.itemId).map(v=>v.itemId))],['task-a','task-b']);});
test('an otherwise impossible near deadline may override explicit order',()=>{const s=snapshot({assignments:[{id:'task-a',title:'First task',estimate:20},{id:'task-b',title:'Deadline task',estimate:10,dueAt:now+15*MIN}]}),p=Planner.build(s,{itemIds:['task-a','task-b'],minutes:60});assert.equal(p.items[0].itemId,'task-b');assert.ok(p.blocks.filter(v=>v.itemId==='task-b').every(v=>v.end<=now+15*MIN));});
test('an explicit empty or unknown target never picks an unrelated work item',()=>{for(const request of [{itemIds:[]},{itemIds:['unknown']},{itemId:'unknown'}]){const p=Planner.build(snapshot(),request);assert.deepEqual(p.items,[]);assert.equal(p.blocks.length,0);assert.equal(p.reviewSuggestion,undefined);}});
test('bounded planning intent stays separate from timer and explanation commands',()=>{assert.equal(Parse.planIntent('rebuild my evening before 10',snapshot()),true);assert.equal(Parse.planIntent('split my homework into study blocks',snapshot()),true);assert.equal(Parse.planIntent('how do I plan an evening?',snapshot()),false);assert.equal(Parse.planIntent('pause that',running()),false);});
