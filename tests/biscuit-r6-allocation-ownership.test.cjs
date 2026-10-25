'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),D=require('../extension/biscuit-details.js'),R=require('../extension/biscuit-registry.js'),S=require('../extension/biscuit-selection.js');
const now=Date.parse('2026-10-24T12:00:00Z'),A={id:'authored-observation',title:'Estuary Observation',courseId:'science',minutes:20},B={id:'authored-comparison',title:'Archive Comparison',courseId:'history',minutes:15},state=extra=>({now,timeZone:'UTC',assignments:[A,B],...extra}),fields=card=>card?.next?.fields;
test('a fully named multi-course allocation does not need an unrelated current pointer',()=>{
 const s=state(),result=D.ownedAllocation('Plan Estuary Observation and Archive Comparison tomorrow from 15:10 to 16:10.',s,{}),f=fields(result);
 assert.equal(result?.action,'plan');assert.deepEqual(f.itemIds,[A.id,B.id]);assert.deepEqual(result.items.map(row=>row.itemId),[A.id,B.id]);assert.equal(f.startAt,f.window.start);assert.equal(f.endAt,f.window.end);assert.equal(f.windowStart,f.window.start);assert.equal(f.windowEnd,f.window.end);assert.equal(f.preserveCanvasDeadline,true);assert.equal(f.respectExistingCommitments,true);
});
test('single named allocation exposes one consistent planning window to all actual consumers',()=>{
 const result=D.ownedAllocation('Plan Estuary Observation tomorrow from 15:10 to 16:10.',state(),{}),f=fields(result);assert.equal(result?.action,'plan');assert.equal(f.startAt,f.window.start);assert.equal(f.endAt,f.window.end);assert.equal(f.windowStart,f.window.start);assert.equal(f.windowEnd,f.window.end);
});
test('a newly requested allocation outranks a learned block-resize label',()=>{
 const s=state({selectedItemId:A.id}),rows=R.entries(s),result=D.resolve('plan','Reserve this assignment for 17 minutes tomorrow at 16:10.',s,{},rows,rows,{operation:'resize'});
 assert.equal(result?.action,'plan');assert.equal(fields(result).itemId,A.id);assert.equal(fields(result).operation,'schedule-study');assert.equal(fields(result).minutes,17);assert.equal(fields(result).blockId,undefined);
});
test('an explicit block resize remains an actual owned block change',()=>{
 const block={id:'authored-study-block',itemId:A.id,title:'Estuary study block',minutes:25,startAt:now+3600000,endAt:now+5100000},s=state({planner:[block]}),rows=R.entries(s),result=D.resolve('plan','Resize that block to 17 minutes.',s,{lastAction:{action:'plan',fields:{blockId:block.id}}},rows,rows,{operation:'schedule-study'});
 assert.equal(result?.action,'plan');assert.equal(fields(result).operation,'resize');assert.equal(fields(result).blockId,block.id);assert.equal(fields(result).minutes,17);
});
test('named multi-work planning still rejects a conflicting canonical identity',()=>{
 const s=state({assignments:[A,{...A,title:'Conflicting work'},B]}),result=D.ownedAllocation('Plan Estuary Observation and Archive Comparison tomorrow from 15:10 to 16:10.',s,{});assert.equal(result,null);
});
test('a read-only question cannot create a fully named multi-work allocation',()=>{
 assert.equal(D.ownedAllocation('How would I plan Estuary Observation and Archive Comparison tomorrow from 15:10 to 16:10?',state(),{}),null);
});
test('a duplicate loaded title can use the actual active course while other distinct named work remains selected',()=>{
 const twin={...A,id:'authored-other-estuary',courseId:'history'},s=state({assignments:[A,twin,B],activeCourseId:'science'}),rows=R.entries(s),ref=S.reference('Schedule Estuary Observation.',rows,s,{});assert.equal(ref.row?.id,A.id);
 const result=D.ownedAllocation('Plan Estuary Observation and Archive Comparison tomorrow from 15:10 to 16:10.',s,{});assert.deepEqual(fields(result)?.itemIds,[A.id,B.id]);
});
test('an active course cannot resolve conflicting copies of one canonical ID',()=>{
 const s=state({assignments:[A,{...A,title:'Conflicting work'},B],activeCourseId:'science'}),ref=S.reference('Schedule Estuary Observation.',R.entries(s),s,{});assert.equal(ref.row,null);
});
test('a local module title is not an explicitly named academic focus target',()=>{
 const s=state({modules:[{id:'authored-local-timer',title:'timer'}]}),ref=S.reference('Put estuary observation on a timer.',R.entries(s),s,{});assert.ok(ref.named.every(row=>row.id!=='authored-local-timer'));
});
test('bound pronouns remain conversational before into and as complements',()=>{
 const rows=R.entries(state()),memory={lastItemId:A.id};for(const input of ['Fit 17 minutes for that into tomorrow at 16:10.','Keep that as a saved link.','Go back to that.'])assert.equal(S.reference(input,rows,state(),memory,{actor:'plan'}).row?.id,A.id,input);
});
test('a prior event can be referred to by its room without a guessed replacement',()=>{
 const event={id:'authored-help-event',title:'Study room',kind:'event',startAt:now+3600000},s=state({calendarEvents:[event]}),ref=S.reference('Warn me ten minutes before that room opens.',R.entries(s),s,{lastItemId:event.id});assert.equal(ref.row?.id,event.id);assert.equal(ref.explicit,true);
});
test('Undo of the last block uses the owned block instead of a missing result ordinal',()=>{
 const block={id:'authored-last-block',itemId:A.id,title:'Study slot',minutes:25,startAt:now+3600000,endAt:now+5100000},s=state({planner:[block]}),result=D.ownedPlan('Undo that last block move.',s,{lastItemId:block.id,lastAction:{action:'plan',fields:{blockId:block.id},before:{...block,startAt:now+1800000,endAt:now+3300000},after:block}});assert.equal(result?.action,'plan');assert.equal(fields(result).blockId,block.id);assert.equal(fields(result).operation,'undo');
});
