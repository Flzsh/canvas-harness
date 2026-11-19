'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Kind=require('../extension/study-kind.js');
const item={title:'Current work',type:'assignment'};
for(const [typed,shape,extra]of [
 ["Can you match what I've drafted to the instructions and tell me what I still need to add before sending it?",'rubric',{}],
 ['Before uploading the files, can you compare what I have with the task sheet?','rubric',{}],
 ['Could you make a guide to the two readings that keeps events straight and explains the repeated symbols?','reading',{}],
 ['Can you walk me through repairing the missing-row issue and what it does to my conclusion?','fixes',{feedback:{text:'Repair the missing row.'}}],
 ['How do I change this comparison so it answers her comment?','fixes',{feedback:{text:'Explain the comparison.'}}],
 ['Do not make a guide to the readings; quiz me.','practice',{}],
 ['Before uploading I wanted a check; actually, just the setup.','steps',{}]
])test('section C request variant: '+typed,()=>{const decision=Kind.inferHelp({item,typed,...extra});assert.equal(decision.shape,shape);assert.ok(decision.confidence>=Kind.HELP_THRESHOLD);});
