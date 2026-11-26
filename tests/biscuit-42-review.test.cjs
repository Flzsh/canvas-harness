'use strict';
// biscuit-42 round 2: the independent review's failing tests (review-42b: biscuit-mend-reminder.test.cjs and
// biscuit-week-edge.test.cjs), made real tests on this build. A typo fix never rewrites a real word or the words a
// reminder or a note keeps; an assignment's score is never said as a course percent; "is X due next week" is not shown
// as "Turned in?"; and work due at exactly Monday 00:00 belongs to next week on the card as in the sentence.
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('./biscuit-42/world.cjs');
const Engine=require('../extension/biscuit-engine.js'),Answer=require('../extension/biscuit-answer.js'),Controls=require('../extension/biscuit-controls.js');
const engine=Engine.create();
function ask(line,s=W.world()){const card=(Controls.featureControl?.(line,s))||engine.evaluate(line,s,{});return {card,answer:Answer.build(card,s,{},{line,previous:null})};}

for(const [line,pick,want] of [
 ['pls remind me to email the grader tomorrow at 4pm',c=>c.next?.fields?.title,'email the grader'],
 ['can you remind me to ask about the finale tomorrow at 4pm',c=>c.next?.fields?.title,'ask about the finale'],
 ['make a note that the grader wants a printed copy',c=>c.next?.fields?.text,'that the grader wants a printed copy']
])test('keeps the student\'s words: '+line,()=>assert.equal(pick(ask(line).card),want));

test('"i have to email the grader tomorrow" is not answered with a grade, and a score is never said as "31%" for 31 / 40',()=>{
 assert.doesNotMatch(String(ask('i have to email the grader tomorrow').card.message),/grade: \d+%/);
 const {card,answer}=ask('i need to email the grade');assert.doesNotMatch(String(card.message),/\b31%/);assert.doesNotMatch(String(answer.value?.text||''),/^31%$/);
});

test('a real word is never mended into another real word; slips still are',()=>{
 const M=require('../extension/biscuit-mind.js'),s=W.world();
 for(const word of ['grader','finale','teaches','planned','graders'])assert.equal(M.mend('the '+word+' is here',s),'the '+word+' is here',word);
 for(const [typed,want] of [['biologyy grade','biology grade'],['quizz tomorrow','quiz tomorrow'],['algebr grade','algebra grade']])assert.equal(M.mend(typed,s),want,typed);
});

function worldWith(rows){const s=W.world(),base=s.assignments[0],list=rows.map(([id,title,at])=>({...base,id,title,name:title,dueAt:new Date(at).toISOString(),missing:false,submitted:false,done:false,state:'unsubmitted',workKind:'assignment',kind:'assignment'}));s.assignments=list;s.workItems=list;s.planner=list;return s;}

test('work due at exactly Monday 00:00 is not "due this week", on the card as in the sentence',()=>{
 // now: Tuesday 8 Dec 2026 4:10 PM New York; this week ends at Monday 14 Dec 00:00 New York
 const s=worldWith([['x1','Lab write-up',W.wall(2026,12,10,23,59)],['x2','Reading quiz corrections',W.wall(2026,12,14,0,0)]]);
 const {card,answer}=ask('whats due this week',s);
 assert.doesNotMatch(String(card.message),/Reading quiz corrections/);
 assert.deepEqual((answer.rows||[]).map(r=>r.name),['Lab write-up']);
 const next=ask('whats due next week',s);assert.ok((next.answer.rows||[]).some(r=>r.name==='Reading quiz corrections'),'and it is next week\'s');
});

test('"is the dbq due next week" answered Yes is shown as Due next week?: Yes, not "Turned in?"',()=>{
 const {card,answer}=ask('is the dbq due next week');
 assert.match(String(card.message),/^Yes\. DBQ Practice/);assert.notEqual(answer.value?.label,'Turned in?');assert.equal(answer.value?.label,'Due next week?');
});
