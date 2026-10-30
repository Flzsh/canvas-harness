'use strict';
const {test}=require('node:test');
test('supplied strict reader checks: good, truncated, chatter, counts, types, kind and lab',()=>{
// The strict reader on hand-made replies: a good one, a cut-off one, chatter around the block, and miscounted types.
const assert = require('assert'), S = require('../extension/study-prompts.js');
const q = (type, i) => type === 'mc' ? { type, q: `Question ${i}?`, choices: ['a', 'b', 'c', 'd'], answer: 1, why: 'Because.', miss: ['x', '', 'y', 'z'], src: 'p. 1', level: 1 }
  : type === 'tf' ? { type, q: `Statement ${i}.`, answer: false, why: 'Because.', src: 'p. 2', level: 2 } : { type, q: `Short ${i}?`, answer: 'A short answer.', why: 'Because.', src: 'p. 1', level: 2 };
const good = { v: 1, kind: 'practice', title: 'Practice', items: ['mc', 'mc', 'mc', 'mc', 'mc', 'short', 'short', 'short', 'tf', 'tf'].map(q), gaps: [] };
const wrap = o => '```chstudy\n' + JSON.stringify(o) + '\n```';
let r = S.parse(wrap(good), 'practice'); assert.ok(r.ok, r.errors?.join('; ')); assert.equal(r.data.items.length, 10);
r = S.parse('Sure! Here you go:\n' + wrap(good) + '\nLet me know if you want more.', 'practice'); assert.ok(r.ok);   // chatter is ignored by the reader (the score reports it)
r = S.parse('```chstudy\n' + JSON.stringify(good).slice(0, 400), 'practice'); assert.ok(!r.ok); assert.match(r.errors[0], /cut off|valid JSON/);
r = S.parse(wrap({ ...good, items: [...good.items,good.items[0]] }), 'practice'); assert.ok(!r.ok); assert.ok(r.errors.some(e => /Questions: expected 1 to 10/.test(e)));
r = S.parse(wrap({ ...good, items: good.items.slice(0,6) }), 'practice'); assert.ok(r.ok); // variable mix and default six are valid
r = S.parse(wrap(good), 'reading'); assert.ok(!r.ok); assert.ok(r.errors.some(e => /not a reading/.test(e)));
r = S.parse('no block here', 'lab'); assert.ok(!r.ok);
const lab = { v: 1, kind: 'lab', title: 'Lab', materials: ['String'], safety: [], steps: [{ text: 'Tie the mass.', src: '1' }], tables: [{ title: 'Length', columns: ['Length (m)', 'Period (s)'], rows: 5 }], prelab: [{ q: 'What changes?', answer: 'The length.', src: 'Q' }, { q: 'Two?', answer: 'Two trials.', src: 'Q' }, { q: 'Three?', answer: 'x', src: 'Q' }], gaps: ['No safety notes in the handout: ask your teacher'] };
r = S.parse(wrap(lab), 'lab'); assert.ok(r.ok, r.errors?.join('; '));
// the worked examples share no topic with a test case (a close example gets copied)
for (const k of Object.values(S.KINDS)) for (const w of ['Columbian', 'crystal violet', 'pendulum', 'respiration', 'quadratic', 'hippocampus']) assert.ok(!k.example.toLowerCase().includes(w.toLowerCase()), w);


});

test('practice and flashcards preserve bounded setup, accept legacy replies and reject malformed setup',()=>{
 const assert=require('node:assert/strict'),S=require('../extension/study-prompts.js'),{practice,wrap}=require('./study-fixture.cjs');
 const flashcards={v:1,kind:'flashcards',title:'Terms',cards:Array.from({length:8},(_,i)=>({front:'Term '+i,back:'Meaning '+i,src:'general knowledge'})),gaps:[]};
 for(const data of [practice(),flashcards]){
  const read=before=>S.parse(wrap({...data,before}),data.kind);
  assert.equal(Object.hasOwn(S.parse(wrap(data),data.kind).data,'before'),false);assert.equal(read('').data.before,'');
  const setup='Check LockDown Browser tonight.\nPractise for 45 minutes without going back.',result=read(setup);
  assert.equal(result.ok,true,result.errors?.join('; '));assert.equal(result.data.before,setup.replace('\n',' '));
  assert.equal(read('x'.repeat(240)).ok,true);
  for(const invalid of [null,42,{},[],false,'x'.repeat(241),'one\ntwo\nthree','one\rtwo\rthree'])assert.equal(read(invalid).ok,false,JSON.stringify(invalid));
  const chosen=S.parseChosen(wrap({...data,before:setup}),['practice','flashcards']);assert.equal(chosen.ok,true);assert.equal(chosen.data.before,result.data.before);
 }
});

test('Help contracts keep course facts sourced, allow labelled textbook help, and scale short work',()=>{
 const assert=require('node:assert/strict'),S=require('../extension/study-prompts.js');
 for(const message of [S.build('ask',{sources:[]}),S.buildChoice(['practice','flashcards','steps','reading','ask'],{sources:[]})]){
  assert.match(message,/Course facts .*come only from the material/);assert.match(message,/"src":"general knowledge"/);
  assert.match(message,/never present it as the teacher's words/);
  assert.match(message,/Leave the remaining graded deliverable to them/);assert.match(message,/single directly requested value, conversion or time is allowed/);assert.match(message,/current task only; mention another item only when it changes/);
  assert.doesNotMatch(message,/every answer is supported by the material/);
 }
 for(const kind of ['practice','flashcards']){const message=S.build(kind,{sources:[]});assert.match(message,/Optional "before"/);assert.match(message,/only when "How it is handed in" names LockDown Browser, a time limit, no going back, or how attempts count/);assert.match(message,/Otherwise "before" is ""/);assert.equal(JSON.parse(S.KINDS[kind].example).before,'');}
 assert.match(S.build('steps',{sources:[]}),/short post or answer gets 3 to 4 steps, well under an hour/);
 assert.match(S.build('steps',{sources:[]}),/replies in their own step with their own date/);
 assert.match(S.build('ask',{sources:[]}),/Point 1 answers the question with its key value/);
 assert.match(S.buildChoice(['reading','ask'],{sources:[]}),/short typed answer or pass\/fail check-in, choose "ask"/);
});
