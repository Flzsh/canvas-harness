'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./pony-fixture.cjs'),B=require('../extension/pony-brain.js'),A=require('../extension/pony-ask.js');

// An offer Biscuit makes on its own (the evening plan, a next step) is one line: the line is the button that takes it,
// as with the stretch and break offers. It was once said and then repeated as its button, the same words twice.
test('an engine offer shows its line once, as the button that takes it',()=>{
 const offer={id:'plan-evening-2026-10-19',kind:'plan',label:'Want a plan for the time before bed?',action:'plan',data:{local:true},fields:{local:true},items:[],next:{action:'plan',fields:{local:true}},score:80};
 const f=fixture({brain:B,ask:A,engine:{create:()=>({offer:()=>offer})},initialPet:{nudges:'helpful',brain:B.cleanLearning(),skills:B.cleanSkills()}});
 f.advance(1000);f.advance(61000);
 const html=f.bubble?.html||'';
 assert.equal(html.split(offer.label).length-1,1,'the line appears once');
 assert.match(html,/<button[^>]*data-pet-action="suggestion"[^>]*data-pet-suggestion="plan-evening-2026-10-19">Want a plan for the time before bed\?<\/button>/);
 assert.doesNotMatch(html,/pet-say/,'no separate spoken copy of the line');
});
