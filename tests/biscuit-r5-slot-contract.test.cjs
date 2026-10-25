'use strict';
/* Synthetic planning contracts. Default: active extension. Parent may explicitly select a staged JS module. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),Values=require('../extension/biscuit-values.js');
const ROOT=path.resolve(__dirname,'..'),ACTIVE=path.join(ROOT,'extension/biscuit-details.js');
function stagedModule(value){const filename=path.resolve(ROOT,value),relative=path.relative(ROOT,filename).replace(/\\/g,'/');if(relative==='..'||relative.startsWith('../')||path.isAbsolute(relative)||!filename.endsWith('.js')||/(?:^|\/)set5\/test(?:\/|$)/i.test(relative))throw Error('Staged module must be an explicitly selected workspace JS source');const context={module:{exports:{}},require:createRequire(ACTIVE)};vm.runInNewContext(fs.readFileSync(filename,'utf8'),context,{filename});return context.module.exports;}
const Details=process.env.BISCUIT_R5_DETAILS_MODULE?stagedModule(process.env.BISCUIT_R5_DETAILS_MODULE):require('../extension/biscuit-details.js'),NOW=Date.parse('2026-11-04T12:00:00Z'),at=value=>Date.parse(value),plain=value=>JSON.parse(JSON.stringify(value));
const rows=[{id:'work-amber',kind:'assignment',title:'Vector notes',courseId:'course-amber',dueAt:at('2026-11-09T18:00:00Z')},{id:'work-blue',kind:'assignment',title:'Field sketch',courseId:'course-blue',dueAt:at('2026-11-10T18:00:00Z')},{id:'work-other',kind:'assignment',title:'Chart review',courseId:'course-amber',dueAt:at('2026-11-11T18:00:00Z')},{id:'course-amber',kind:'course',title:'Orbit theory'},{id:'course-blue',kind:'course',title:'Design methods'},{id:'lookup-log',kind:'page',title:'Calibration log',courseId:'course-blue'}];
function state(patch={}){return {now:NOW,timeZone:'UTC',selectedItemId:'work-amber',activeCourseId:'course-amber',courses:[{id:'course-amber',name:'Orbit theory'},{id:'course-blue',name:'Design methods'}],...patch};}
function bridge(input,s=state()){const scope=Details.planAllocation(input).scope;return Details.planSlots(Values.slots(scope,s),s,scope);}
function plan(input,s=state(),session={},available=rows){return Details.resolve('plan',input,s,session,available,[],{});}

test('typed minute boundaries become an epoch window without fictitious slots.start/end',()=>{
 const s=state(),slots=Values.slots('tomorrow from 18:00 to 19:00',s);assert.equal(slots.start,undefined);assert.equal(slots.end,undefined);
 const result=Details.planSlots(slots,s);assert.equal(result.invalid,false);assert.equal(result.window,true);assert.equal(result.fields.startAt,at('2026-11-05T18:00:00Z'));assert.equal(result.fields.endAt,at('2026-11-05T19:00:00Z'));assert.deepEqual(plain(result.fields.window),{start:at('2026-11-05T18:00:00Z'),end:at('2026-11-05T19:00:00Z')});assert.equal(result.fields.minutes,undefined);
});
test('a pure availability window returns a local proposal without inventing a work item',()=>{
 const result=plan('I am free tomorrow from 18:00 to 19:00',state({selectedItemId:undefined}),{},[]);assert.equal(result.action,'plan');assert.equal(result.route,'local');assert.equal(result.next.fields.windowStart,at('2026-11-05T18:00:00Z'));assert.equal(result.next.fields.windowEnd,at('2026-11-05T19:00:00Z'));assert.equal(result.next.fields.itemId,undefined);assert.equal(result.next.fields.minutes,undefined);
});
test('a secondary lookup cannot replace the selected-work allocation clock, date or budget',()=>{
 const result=plan('Reserve 35 minutes for this work tomorrow starting at 18:00; then show Calibration log at 21:00 for 90 minutes');
 assert.equal(result.action,'plan');assert.equal(result.next.fields.itemId,'work-amber');assert.equal(result.next.fields.minutes,35);assert.equal(result.next.fields.startAt,at('2026-11-05T18:00:00Z'));assert.equal(result.next.fields.endAt,at('2026-11-05T18:35:00Z'));assert.doesNotMatch(result.next.fields.line,/Calibration|21:00|90 minutes/);assert.equal(result.next.fields.secondaryRequest,undefined);
});
test('an allocation after a lookup keeps its own selected-work reference and tomorrow date',()=>{
 const result=plan('Show Calibration log at 21:00 for 90 minutes; also reserve 35 minutes for selected work tomorrow at 18:00');
 assert.equal(result.next.fields.itemId,'work-amber');assert.equal(result.next.fields.minutes,35);assert.equal(result.next.fields.startAt,at('2026-11-05T18:00:00Z'));assert.equal(result.next.fields.endAt,at('2026-11-05T18:35:00Z'));assert.doesNotMatch(result.next.fields.line,/Calibration/);
});
test('a relative start is not treated as the duration budget in either quantity order',()=>{
 for(const input of ['In 20 minutes, reserve 35 minutes for this work','Reserve 35 minutes for this work starting in 20 minutes']){const result=bridge(input);assert.equal(result.invalid,false);assert.equal(result.roles.start,'relative');assert.equal(result.roles.duration,'budget');assert.equal(result.fields.minutes,35);assert.equal(result.fields.startAt,NOW+20*60000);assert.equal(result.fields.endAt,NOW+55*60000);assert.equal(result.window,false);}
});
test('a departure-relative bound stays an end constraint, not a duration or invented start',()=>{
 const result=plan('I have 35 minutes for Vector notes before leaving in 80 minutes');assert.equal(result.action,'plan');assert.equal(result.next.fields.minutes,35);assert.equal(result.next.fields.endAt,NOW+80*60000);assert.equal(result.next.fields.startAt,undefined);assert.equal(result.next.fields.itemId,'work-amber');
});
test('explicit availability end remains a window bound when a smaller study budget is stated',()=>{
 const result=bridge('Reserve 35 minutes tomorrow from 18:00 to 19:00');assert.equal(result.fields.minutes,35);assert.equal(result.fields.windowEnd,at('2026-11-05T19:00:00Z'));assert.equal(result.fields.endAt,result.fields.windowEnd);assert.equal(result.roles.end,'clock');
});
test('two allocations retain independent role sets rather than fusing their times or budgets',()=>{
 const result=Details.planAllocation('Reserve 25 minutes for this work tomorrow at 18:00; and reserve 40 minutes for another course on Friday at 20:00');assert.equal(result.allocations.length,2);
 const first=bridge(result.allocations[0].scope),second=bridge(result.allocations[1].scope);assert.equal(first.fields.minutes,25);assert.equal(first.fields.startAt,at('2026-11-05T18:00:00Z'));assert.equal(first.fields.endAt,at('2026-11-05T18:25:00Z'));assert.equal(second.fields.minutes,40);assert.equal(second.fields.startAt,at('2026-11-06T20:00:00Z'));assert.equal(second.fields.endAt,at('2026-11-06T20:40:00Z'));assert.equal(result.scope,result.allocations[0].scope);
});
test('and/then allocation boundaries preserve ranges and composite quantities inside each clause',()=>{
 const clauses=Details.planAllocation('Show the log at 22:00 and reserve one hour and thirty minutes for this work tomorrow between 18:00 and 20:00').allocations;assert.equal(clauses.length,1);const result=bridge(clauses[0].scope);assert.equal(result.fields.minutes,90);assert.equal(result.fields.windowStart,at('2026-11-05T18:00:00Z'));assert.equal(result.fields.windowEnd,at('2026-11-05T20:00:00Z'));
});
test('course-only allocation uses the selected grounded course without choosing one of its tasks',()=>{
 const result=plan('Reserve 30 minutes for this selected course tomorrow at 18:00',state({selectedItemId:'course-amber'}));assert.equal(result.action,'plan');assert.equal(result.next.fields.courseId,'course-amber');assert.equal(result.next.fields.itemId,undefined);assert.equal(result.next.fields.startAt,at('2026-11-05T18:00:00Z'));assert.deepEqual(plain(result.items.map(v=>v.id)),['course-amber']);
});
test('relative dates use the snapshot local date, not the host or UTC day',()=>{
 const s=state({now:at('2026-11-05T00:30:00Z'),timeZone:'America/New_York'}),result=bridge('Reserve 20 minutes tomorrow at 08:00',s);assert.equal(result.fields.date,'2026-11-05');assert.equal(result.fields.startAt,at('2026-11-05T13:00:00Z'));assert.equal(result.fields.endAt,at('2026-11-05T13:20:00Z'));
});
test('an overnight window advances only its end date',()=>{
 const result=bridge('I am free tomorrow from 23:30 to 00:15');assert.equal(result.invalid,false);assert.equal(result.fields.startAt,at('2026-11-05T23:30:00Z'));assert.equal(result.fields.endAt,at('2026-11-06T00:15:00Z'));assert.equal(result.fields.minutes,undefined);
});
test('explicit invalid/past clocks and unresolved event anchors fail without guessing a new day',()=>{
 const s=state({now:at('2026-03-08T05:00:00Z'),timeZone:'America/New_York'});assert.equal(bridge('Reserve 20 minutes today at 02:30',s).invalid,true);assert.equal(bridge('Reserve 20 minutes today at 09:00').invalid,true);
 const slots=Values.slots('Reserve 20 minutes tomorrow at 18:00',state());assert.equal(Details.planSlots({...slots,unresolvedEvent:'unavailable workshop'},state()).invalid,true);assert.equal(Details.planSlots({...slots,budgetMinutes:0},state()).invalid,true);
});
test('quoted lookup text and trailing privacy/preservation constraints retain their roles',()=>{
 const input='Open the page called "reserve 90 minutes tomorrow at 22:00"; then reserve 25 minutes for this work tomorrow at 18:00; without private grades; preserve assignment deadlines',scope=Details.planAllocation(input).scope;assert.doesNotMatch(scope,/90 minutes|22:00/);assert.match(scope,/without private grades/);assert.match(scope,/preserve assignment deadlines/);assert.equal(bridge(input).fields.minutes,25);
});
test('planning returns proposals only and does not mutate caller records or fabricate schema annotations',()=>{
 const s=state({showGrades:false,teacherFeedback:false,privacy:{grades:false,feedback:false}}),session={lastItemId:'work-amber'},before=JSON.stringify({s,session,rows}),result=plan('Reserve 90 seconds for this work tomorrow at 18:00',s,session);
 assert.equal(result.action,'plan');assert.equal(result.route,'local');assert.equal(result.next.fields.minutes,1.5);assert.equal(result.next.fields.endAt,at('2026-11-05T18:01:30Z'));for(const key of ['mutate','answer','secondaryRequest','manualNextStep','handoff'])assert.equal(result.next.fields[key],undefined);assert.equal(JSON.stringify({s,session,rows}),before);
});
