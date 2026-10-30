const test = require('node:test'), assert = require('node:assert/strict');
const Study = require('../extension/study-prompts.js'), Kind = require('../extension/study-kind.js');
const wrap = value => '```chstudy\n' + JSON.stringify(value) + '\n```';
const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
const good = {
 steps: { v: 1, kind: 'steps', title: 'Science fair board: steps', steps: many(5, i => ({ text: 'Do part ' + (i + 1) + ' of the board.', done: 'Part ' + (i + 1) + ' is on the board', minutes: 20 + i * 5, due: i === 1 ? 'Checkpoint Oct 30' : '', src: 'Instructions' })), handin: 'Bring the board to the gym on Friday.', gaps: [] },
 outline: { v: 1, kind: 'outline', title: 'Argument essay: outline', thesis: 'Should cities ban cars from their centres, and why?', sections: ['Introduction', 'Body: first reason', 'Counterargument', 'Conclusion'].map((part, i) => ({ part, purpose: 'Do the job this part has for the reader.', words: 150, evidence: i === 1 ? [{ text: 'Source 2: traffic counts before and after', src: 'Source 2, p. 4' }] : [] })), gaps: ['How many sources are required?'] },
 message: { v: 1, kind: 'message', title: 'Extension request', to: 'your teacher', subject: 'History essay: extension request', body: 'Hello,\n\nI am working on the history essay due Friday. [your reason] Could I hand it in on Monday instead?\n\nThank you,\n[Your name]', asks: ['An extension to Monday'], gaps: ['Add your reason where it says [your reason].'] },
 summary: { v: 1, kind: 'summary', title: 'Algebra this week', points: many(4, i => ({ text: 'Point ' + (i + 1) + ' from the announcements.', src: 'Announcement ' + (i + 1) })), todo: [{ text: 'Finish worksheet 3.2.', due: 'Thursday', src: 'Announcement 2' }], gaps: [] },
 flashcards: { v: 1, kind: 'flashcards', title: 'Unit 2 terms', cards: many(10, i => ({ front: 'Term ' + (i + 1), back: 'What term ' + (i + 1) + ' means, as the notes say.', src: 'Notes' })), gaps: [] }
};
test('every new kind builds a one-turn message and reads a complete reply', () => {
 for (const [kind, reply] of Object.entries(good)) {
  const message = Study.build(kind, { course: 'Biology', item: 'Project', sources: [{ label: 'Instructions', text: 'Make a board.' }] });
  assert.match(message, /Reply with exactly one code block tagged chstudy/); assert.ok(!message.includes('${'), kind + ' has an unfilled placeholder');
  const read = Study.parse(wrap(reply), kind); assert.equal(read.ok, true, kind + ': ' + JSON.stringify(read.errors));
 }
 assert.equal(Study.parse(wrap(good.message), 'message').data.body.split('\n').length, 6);
});
test('the reader refuses replies that break the new rules', () => {
 const bad = (kind, change) => Study.parse(wrap({ ...structuredClone(good[kind]), ...change }), kind);
 assert.equal(bad('outline', { thesis: 'Cities should ban cars because they are loud.' }).ok, false);
 assert.equal(bad('message', { body: 'word '.repeat(150) }).ok, false);
 assert.equal(bad('flashcards', { cards: many(10, () => ({ front: 'Same', back: 'same', src: 'Notes' })) }).ok, false);
 assert.equal(bad('steps', { steps: good.steps.steps.map(({ minutes, ...step }) => step) }).ok, false);
 assert.equal(bad('summary', { points: good.summary.points.slice(0, 2) }).ok, false);
 assert.equal(Study.parseChosen(wrap(good.flashcards), ['ask', 'practice']).ok, false);
 assert.equal(Study.parseChosen(wrap(good.steps), ['ask', 'steps', 'outline']).ok, true);
});
test('the AI may pick message, flashcards and notes only when the student asked', () => {
 const choice = Study.buildChoice(['ask', 'steps', 'message', 'flashcards', 'notes', 'summary'], { item: 'Essay', sources: [] });
 for (const kind of ['message', 'flashcards', 'notes']) assert.match(choice, new RegExp(`Choose "${kind}" only when the student asks`));
 assert.match(choice, /: "steps"\./); assert.match(choice, /: "summary"\./);
});
test('the student\'s own words choose the new kinds', () => {
 const essay = { id: 1, title: 'Persuasive essay', type: 'assignment', instructions: 'Write 600 words.' }, news = { id: 2, title: 'Week 5 announcements', type: 'announcement' }, chapter = { id: 3, title: 'Chapter 4 reading', type: 'reading' };
 for (const [typed, item, shape] of [['can you email my teacher for an extension', essay, 'message'], ['outline my essay', essay, 'outline'], ['where do i start', essay, 'steps'], ['catch me up', news, 'summary'], ['summarize this', news, 'summary'], ['summarize this', chapter, 'reading'], ['make flashcards', chapter, 'flashcards'], ['quiz me', chapter, 'practice']])
  assert.equal(Kind.inferHelp({ typed, item }).shape, shape, typed);
});
