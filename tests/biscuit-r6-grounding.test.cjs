'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('../extension/biscuit-language.js'),S=require('../extension/biscuit-selection.js'),F=require('../extension/biscuit-facts.js'),D=require('../extension/biscuit-details.js'),V=require('../extension/biscuit-values.js');
const at=Date.parse,now=at('2027-02-03T12:00:00Z'),state=extra=>({now,timeZone:'UTC',...extra});
test('full course names retain specific subjects behind generic short names in a sixteen-course roster',()=>{
 const names=['Calculus','Geometry','Chemistry','Physics','Biology','English Literature','United States History','Spanish','Computer Science','Studio Art','Music','Physical Education','Economics','Engineering','French','Psychology'],courses=names.map((name,i)=>({id:'course-'+i,name,shortName:i<2?'MATH '+(i+1):'Section '+i})),s=state({courses,activeCourseId:'course-1'}),result=L.resolveCourses('derivatives',s);assert.equal(result.courseId,'course-0');assert.equal(L.resolveCourses('science chemistry',s).courseId,'course-2');assert.equal(L.resolveCourses('math',s).courseId,'course-1');
});
test('owned subject and topic metadata support unfamiliar course names and invalidate cached profiles',()=>{
 const course={id:'studio',name:'Inquiry Studio',subject:'chemistry',topics:['lumen calibration']},s=state({courses:[course,{id:'other',name:'History'}]});assert.equal(L.resolveCourses('science',s).courseId,'studio');const r=L.resolveCourses('lumen calibration notes',s);assert.equal(r.courseId,'studio');assert.equal(r.recognized,true);course.subject='literature';course.topics=['archival voices'];assert.equal(L.resolveCourses('science',s).matches.length,0);assert.equal(L.resolveCourses('archival voices',s).courseId,'studio');assert.equal(L.resolveCourses('lumen calibration',s).matches.length,0);
});
test('courseModules titles supply relationships without scanning private bodies or historical labels',()=>{
 const s=state({courses:[{id:'a',name:'Inquiry West'},{id:'b',name:'Inquiry East'}],courseModules:[{id:'module',courseId:'b',title:'Orbital gardens',body:'secretbodyterm'}],grades:[{id:'private',courseId:'a',title:'privateterm',score:98}]});assert.equal(L.resolveCourses('orbital gardens',s).courseId,'b');for(const q of ['secretbodyterm','privateterm'])assert.equal(L.resolveCourses(q,s,{expected:{courseId:'a'},pending:{courseId:'a'}}).matches.length,0);
});
function notices(){return [{id:'old',kind:'announcement',courseId:'a',title:'Materials briefing',text:'Meet on 2027-02-05 at 14:20 in room 302.',postedAt:now-40000,unread:false},{id:'revised',kind:'announcement',courseId:'a',title:'Materials briefing correction',text:'The replacement briefing is on 2027-02-06 at 15:40 in room 408. Bring the stamped map.',postedAt:now-30000,supersedes:'old',unread:true,repliesAllowed:false},{id:'final',kind:'announcement',courseId:'a',title:'Materials briefing final correction',text:'The briefing is on 2027-02-07 at 16:30 in room 501.',postedAt:now-20000,supersedesId:'revised',unread:true},{id:'bus',kind:'announcement',courseId:'a',title:'Bus check',text:'The bus leaves at 07:35.',postedAt:now-10000,unread:true},{id:'foreign',kind:'announcement',courseId:'b',title:'Materials briefing correction',text:'A different course notice.',supersedes:'old',postedAt:now-5000,unread:true}];}
test('supersession follows a scoped chain instead of the newest unrelated notice',()=>{
 const rows=notices(),s=state({activeCourseId:'a',selectedItemId:'old'}),result=S.sourceOrder('Show the current replacement announcement',rows,s);assert.equal(result[0].id,'final');assert.ok(!result.some(v=>v.id==='foreign'));assert.equal(S.order('Show the current replacement announcement',rows,s,{},'open/find')[0].id,'final');assert.equal(S.sourceOrder('Show the latest unread announcement',rows,s)[0].id,'bus');assert.equal(S.sourceOrder('Show the original announcement',rows,s)[0].id,'old');
});
test('source link aliases are recovered only for candidates already available to the caller',()=>{
 const raw=notices(),rows=raw.filter(v=>v.id!=='final').map(({supersedes,...v})=>v),s=state({activeCourseId:'a',selectedItemId:'old',announcements:raw}),result=S.sourceOrder('Open the corrected notice',rows,s);assert.equal(result[0].id,'revised');assert.ok(!result.some(v=>v.id==='final'));
});
test('unread selection uses unread and read state, never just a later timestamp',()=>{
 const rows=[{id:'one',kind:'message',courseId:'a',title:'Private check',sentAt:now-3000,read:false},{id:'two',kind:'message',courseId:'a',title:'New check',sentAt:now-1000,read:true},{id:'three',kind:'message',courseId:'a',title:'Another check',sentAt:now-2000,unread:true}];assert.equal(S.sourceOrder('Latest unread inbox message',rows,state({activeCourseId:'a'}))[0].id,'three');
});
test('facts preserve a disabled reply flag and the exact selected replacement source',()=>{
 const rows=notices().filter(v=>v.id!=='final'),s=state({activeCourseId:'a',selectedItemId:'old'}),r=F.resolve('Can I reply under the corrected announcement?',s,{},rows);assert.equal(r.items[0].id,'revised');assert.equal(r.next.fields.repliesAllowed,false);assert.equal(r.answer.value,'No');assert.equal(r.action,'find');
});
test('source dates and rooms are read from the replacement rather than its posting date',()=>{
 const rows=notices().filter(v=>v.id!=='final'),s=state({activeCourseId:'a',selectedItemId:'old'}),r=F.resolve('Where and when is the corrected announcement briefing?',s,{},rows);assert.equal(r.items[0].id,'revised');assert.equal(r.next.fields.startAt,at('2027-02-06T15:40:00Z'));assert.equal(r.next.fields.location,'room 408');assert.match(r.message,/stamped map/);assert.equal(r.next.fields.dueAt,undefined);
});
test('an approved inbox extension is not confused with a later partner message',()=>{
 const rows=[{id:'teacher',kind:'message',courseId:'a',title:'Individual decision',text:'Your approved extension for the optics journal is 2027-02-08 at 18:25 America/Chicago.',sentAt:now-3000},{id:'partner',kind:'message',courseId:'a',title:'Partner materials',text:'I cannot confirm an extension. I can meet at 17:50.',sentAt:now-1000}],r=F.resolve('What deadline did my approved extension inbox message give?',state({activeCourseId:'a'}),{},rows);assert.equal(r.items[0].id,'teacher');assert.equal(r.next.fields.approvedDueAt,at('2027-02-09T00:25:00Z'));assert.equal(r.next.fields.timeZone,'America/Chicago');
});
test('source retrieval and grade visibility retain their original boundaries',()=>{
 const rows=[...notices(),{id:'g',kind:'course-grade',courseId:'a',title:'Chemistry total',currentPercent:91}],s=state({activeCourseId:'a',showGrades:false});assert.equal(F.resolve('What is my grade?',s,{},rows).action,'none');assert.equal(F.resolve('Explain the reasoning behind the corrected announcement.',s,{},rows),null);assert.equal(F.resolve('Remind me about the corrected announcement tomorrow at 08:20.',s,{},rows),null);
});
function planning(){const block={id:'block-a',title:'Optics journal study',itemId:'work-a',courseId:'a',start:at('2027-02-04T14:00:00Z'),end:at('2027-02-04T14:30:00Z'),minutes:30},work={id:'work-a',kind:'assignment',courseId:'a',title:'Optics journal',dueAt:at('2027-02-10T21:00:00Z')},s=state({selectedItemId:'block-a',planner:[block]}),rows=[{...block,kind:'assignment'},work];return {block,work,s,rows};}
test('moving a block ignores reminder and focus durations in subsequent requests',()=>{
 const {s,rows}=planning(),r=D.resolve('plan','Move this block tomorrow at 16:10; then remind me 9 minutes before and start a 45-minute focus.',s,{},rows);assert.equal(r.next.fields.operation,'move');assert.equal(r.next.fields.startAt,at('2027-02-04T16:10:00Z'));assert.equal(r.next.fields.minutes,30);assert.equal(r.next.fields.endAt,at('2027-02-04T16:40:00Z'));assert.equal(r.next.fields.preserveCanvasDeadline,true);assert.equal(r.next.fields.leadMinutes,undefined);
});
test('clock-only corrections inherit the actual last action date and retain its duration',()=>{
 const {s,rows,block}=planning(),after={...block,startAt:at('2027-02-06T16:10:00Z'),endAt:at('2027-02-06T16:50:00Z'),minutes:40},session={lastItemId:block.id,lastAction:{action:'plan',fields:{operation:'move',blockId:block.id,startAt:after.startAt},before:block,after}},r=D.resolve('plan','Actually, shift that same block to 17:25.',s,session,rows);assert.equal(r.next.fields.startAt,at('2027-02-06T17:25:00Z'));assert.equal(r.next.fields.endAt,at('2027-02-06T18:05:00Z'));assert.equal(r.next.fields.minutes,40);assert.equal(s.planner[0].start,block.start);
});
test('duration-only followups use committed state and do not read historical label metadata',()=>{
 const {s,rows,block}=planning(),after={...block,startAt:at('2027-02-06T17:25:00Z'),endAt:at('2027-02-06T17:55:00Z')},session={lastItemId:block.id,lastAction:{action:'plan',fields:{operation:'move',blockId:block.id,startAt:after.startAt},after},expected:{startAt:now},coverageEvidence:{blockId:'bogus'},pending:{minutes:999}},r=D.resolve('plan','42 minutes for that block, actually; keep the start and reminder offset.',s,session,rows);assert.equal(r.next.fields.operation,'resize');assert.equal(r.next.fields.startAt,after.startAt);assert.equal(r.next.fields.endAt,at('2027-02-06T18:07:00Z'));assert.equal(r.next.fields.minutes,42);assert.equal(r.next.fields.preserveNotes,true);
});
test('relative block adjustments change only the requested dimension',()=>{
 const {s,rows}=planning(),longer=D.resolve('plan','Lengthen this block by 7 minutes.',s,{},rows),later=D.resolve('plan','Move this block 12 minutes later.',s,{},rows);assert.equal(longer.next.fields.minutes,37);assert.equal(longer.next.fields.startAt,at('2027-02-04T14:00:00Z'));assert.equal(later.next.fields.startAt,at('2027-02-04T14:12:00Z'));assert.equal(later.next.fields.minutes,30);assert.equal(later.next.fields.endAt,at('2027-02-04T14:42:00Z'));
});
test('explicit date corrections preserve a block clock and reject invalid target times',()=>{
 const {s,rows}=planning(),r=D.resolve('plan','Move this block to 2027-02-06.',s,{},rows);assert.equal(r.next.fields.startAt,at('2027-02-06T14:00:00Z'));assert.equal(D.resolve('plan','Move this block tomorrow at 25:10.',s,{},rows).action,'none');
});
test('owned after state must match the target before it can change a block',()=>{
 const {s,rows}=planning(),session={lastAction:{action:'plan',fields:{operation:'move',blockId:'other'},after:{id:'other',startAt:at('2027-02-07T18:00:00Z'),minutes:90}}},r=D.resolve('plan','Resize this block to 20 minutes.',s,session,rows);assert.equal(r.next.fields.startAt,at('2027-02-04T14:00:00Z'));assert.equal(r.next.fields.minutes,20);
});
test('quantity spans combine units while preserving independent durations and rejected alternatives',()=>{
 const q=V.quantities('one hour and fifteen minutes, then nine minutes before and twenty minutes focus');assert.deepEqual(q.map(v=>v.minutes),[75,9,20]);assert.deepEqual(V.quantities('not 12 minutes, use 18 minutes').map(v=>v.minutes),[18]);assert.equal(V.quantities('-3 minutes')[0].minutes,-3);
});
test('temporal clocks use the positive date and never treat a duration or ISO date as another clock',()=>{
 const t=D.temporal('not today, tomorrow at 16:45 for 30 minutes',state());assert.equal(t.date,'2027-02-04');assert.equal(t.clocks.length,1);assert.equal(t.clocks[0].at,at('2027-02-04T16:45:00Z'));const iso=D.temporal('on 2027-02-06 at 17:20 for 25 minutes',state());assert.equal(iso.clocks.length,1);assert.equal(iso.clocks[0].at,at('2027-02-06T17:20:00Z'));
});
