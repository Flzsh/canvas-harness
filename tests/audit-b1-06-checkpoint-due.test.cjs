'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{req}=require('./audit-b1-fixture.cjs');
// Audit B1 (2026-11-14), see Desktop\Claude\opus-2026-11-13\B1-audit-home-and-pages.md.
// B1-06: a graded discussion with checkpoints (reply to the topic, reply to entries) has no due date of its own; Home
// called it undated, so it never reached Up next, Today, the week strip, the chips, the rail counts or the Planner.
test('B1-06 a discussion with checkpoints is dated by its next open checkpoint, as the AI already does',()=>{
 const Core=req('core.js');
 const item=Core.normalizeAssignment({id:'40',name:'Debate',due_at:null,has_sub_assignments:true,submission_types:['discussion_topic'],checkpoints:[{tag:'reply_to_entry',due_at:'2026-11-09T04:59:00Z'},{tag:'reply_to_topic',due_at:'2026-11-07T04:59:00Z'}]},{id:'7'});
 assert.equal(item.dueAt,'2026-11-07T04:59:00.000Z');
 assert.equal(item.checkpoints.length,2,'the checkpoints are kept as before');
 const plain=Core.normalizeAssignment({id:'41',name:'Plain',due_at:null},{id:'7'});
 assert.equal(plain.dueAt,null,'work without a date stays undated');
 const own=Core.normalizeAssignment({id:'42',name:'Own date',due_at:'2026-11-10T04:59:00Z',checkpoints:[{tag:'reply_to_topic',due_at:'2026-11-07T04:59:00Z'}]},{id:'7'});
 assert.equal(own.dueAt,'2026-11-10T04:59:00.000Z','an item\'s own due date wins');
});
