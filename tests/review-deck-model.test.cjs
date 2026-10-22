// Adapted from Gary Wu's pull request #44 to Canvas Harness.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../extension/review-deck-model.js');
const DAY='2026-10-20',card=(front='term',back='definition',extra={})=>M.makeCard({front,back,course:'5',today:DAY,...extra}),deckOf=(...cards)=>M.cleanDeck({cards});

test('review cards retain text, course, cloze, two-way state and independent histories',()=>{
 const c=card('mitosis','cell division',{twoWay:true});assert.match(c.id,/^rc-/);assert.equal(c.c,'5');assert.equal(c.two,true);
 assert.deepEqual(c.s,{f:{box:0,due:'',lapses:0,first:'',last:''},b:{box:0,due:'',lapses:0,first:'',last:''}});
 assert.equal(M.cleanCard({...c,id:'x'}),null);assert.equal(M.cleanCard({...c,f:''}),null);assert.equal(M.cleanCard({...c,b:''}),null);assert.equal(M.cleanCard({...c,c:'javascript:'}),null);
 assert.equal(M.makeCard({front:'x'.repeat(1001),back:'answer'}),null);
 const cloze=card('The {{nucleus}} holds {{DNA}}.','',{twoWay:true});assert.equal(cloze.two,false);assert.equal(cloze.s.b,undefined);
 assert.deepEqual(M.clozeParts(cloze.f),[{text:'The '},{hidden:'nucleus'},{text:' holds '},{hidden:'DNA'},{text:'.'}]);
});

test('cloze validation rejects incomplete or nested blanks even beside a valid blank',()=>{
 for(const front of ['The {{nucleus','{{ok}} and {{broken','{{a {{b}}}}','{{}}'])assert.match(M.checkCard(front,'note'),/two braces/);
 assert.equal(M.checkCard('The {{nucleus}}',''),'');assert.match(M.checkCard('term',''),/Write the back/);
 assert.equal(M.checkCard('Set {x, y}','a set'),'');
});

test('deck validation rejects oversized, duplicated and invalid data instead of dropping it',()=>{
 const c=card();assert.throws(()=>M.cleanDeck({cards:[{...c,f:'x'.repeat(1001)}]}),/invalid/);
 assert.throws(()=>M.cleanDeck({cards:[c,c]}),/duplicated/);assert.throws(()=>M.cleanDeck({cards:Array.from({length:2001},()=>c)}),/2000/);
 assert.throws(()=>M.cleanDeck({settings:{newPerDay:51}}),/Invalid/);assert.throws(()=>M.cleanDeck({settings:{maxReviews:2}}),/Invalid/);
 assert.throws(()=>M.cleanDeck({testDates:{5:'2026-02-30'}}),/date/);assert.throws(()=>M.cleanDeck({version:2}),/Invalid/);
 assert.throws(()=>M.cleanDeck({cards:[{...c,s:{f:{first:'2026-10-22',last:DAY}}}]}),/history order/);
 assert.deepEqual(M.cleanDeck(),{version:1,cards:[],settings:{newPerDay:10,maxReviews:100},testDates:{},log:[]});
});

test('calendar dates reject rollover and add days across leap years and year boundaries',()=>{
 assert.equal(M.validDay('2026-02-30'),false);assert.equal(M.validDay('2024-02-29'),true);assert.equal(M.addDays('2024-02-28',1),'2024-02-29');assert.equal(M.addDays('2026-12-31',1),'2027-01-01');assert.throws(()=>M.addDays('garbage',1),/Invalid/);
});

test('plain imports retain the original separators and identify unreadable physical lines',()=>{
 const p=M.parseList('mitosis – cell division\nATP: energy carrier\nRate law = rate = k[A]\nThe {{Arrhenius}} equation: relates k and T\n\\(x^2\\)\tsquare\n\nno separator here\nfront only - ',{format:'text'});
 assert.deepEqual(p.cards,[{front:'mitosis',back:'cell division'},{front:'ATP',back:'energy carrier'},{front:'Rate law',back:'rate = k[A]'},{front:'The {{Arrhenius}} equation: relates k and T',back:''},{front:'\\(x^2\\)',back:'square'}]);
 assert.equal(p.ok,false);assert.deepEqual(p.problems.map(e=>e.line),[7,8]);
});

test('CSV imports support headers, escaped quotes, commas and multiline fields',()=>{
 const p=M.parseList('\uFEFFFront,Back\r\n"say ""hello"", please","line one\r\nline two"\r\n"The {{nucleus}}",',{format:'csv'});
 assert.equal(p.ok,true);assert.deepEqual(p.cards,[{front:'say "hello", please',back:'line one\nline two'},{front:'The {{nucleus}}',back:''}]);
 const bad=M.parseList('"front\ncontinued",back\n"open,quote',{format:'csv'});assert.equal(bad.ok,false);assert.equal(bad.problems[0].line,3);
});

test('CSV and TSV export round trips tabs, newlines and quotes without flattening text',()=>{
 const cards=[card('term','definition'),card('a\tb','c\nd'),card('a "quote", comma','answer'),card('The {{DNA}}','')];
 for(const format of ['csv','tsv']){const p=M.parseList(M.exportText(cards,{format}),{format});assert.equal(p.ok,true);assert.deepEqual(p.cards,cards.map(c=>({front:c.f,back:c.b})));}
 assert.equal(M.parseList('word,meaning').format,'csv');assert.equal(M.parseList('word\tmeaning').format,'tsv');
 assert.equal(M.parseList('The {{salt, water}} mixture').format,'text');
});

test('malformed quotes, extra columns and oversized sides reject an import atomically',()=>{
 for(const value of ['"front","back"trailing','"unclosed,back','front,back,extra']){const p=M.parseList(value,{format:'csv'});assert.equal(p.ok,false);assert.ok(p.problems.length);}
 assert.equal(M.parseList('"'+ 'a'.repeat(1001)+'",answer',{format:'csv'}).ok,false);
 const p=M.parseList('valid\tanswer\n'+ 'a'.repeat(1001)+'\tanswer',{format:'tsv'});assert.equal(p.ok,false);assert.equal(p.problems[0].line,2);
});

test('import capacity and UTF-8 byte limits reject rather than truncate',()=>{
 const input=Array.from({length:2001},(_,i)=>'q'+i+'\ta').join('\n');let p=M.parseList(input);assert.equal(p.ok,false);assert.equal(p.cards.length,0);assert.match(p.problems[0].message,/2001/);
 p=M.parseList('one\t1\ntwo\t2',{remaining:1});assert.equal(p.ok,false);assert.equal(p.cards.length,0);assert.match(p.problems[0].message,/1 spaces/);
 p=M.parseList('é'.repeat(Math.floor(M.LIMITS.importBytes/2)+1));assert.equal(p.ok,false);assert.match(p.problems[0].message,/bytes/);
});

test('the daily queue prioritizes due cards then new sides within the daily budgets',()=>{
 const a=card('a','1'),b=card('b','2',{twoWay:true}),c=card('c','3'),d=card('d','4');a.s.f={...a.s.f,box:2,due:'2026-10-19'};c.s.f={...c.s.f,box:3,due:'2026-10-25'};
 const deck=deckOf(a,b,c,d);deck.settings.newPerDay=1;assert.deepEqual(M.queue(deck,DAY),[{id:a.id,side:'f',fresh:false},{id:b.id,side:'f',fresh:true}]);
 deck.log.push({d:DAY,n:1,r:100,w:0,done:false});assert.deepEqual(M.queue(deck,DAY),[]);assert.equal(M.queue(deckOf({...a,paused:true}),DAY).length,0);
});

test('a two-way reverse side waits until the day after the forward side was first answered',()=>{
 const deck=deckOf(card('a','1',{twoWay:true})),id=deck.cards[0].id;M.answer(deck,id,'f','good',DAY);assert.equal(M.queue(deck,DAY).length,0);assert.equal(M.answer(deck,id,'b','good',DAY),null);
 assert.deepEqual(M.queue(deck,'2026-10-21').map(e=>e.side),['f','b']);M.answer(deck,id,'f','good','2026-10-21');M.answer(deck,id,'b','good','2026-10-21');assert.equal(M.queue(deck,'2026-10-21').length,0);
});

test('Good follows the original waits, Easy skips a box and Again returns tomorrow',()=>{
 const deck=deckOf(card()),id=deck.cards[0].id;let day=DAY;
 for(const step of [1,2,4,8,16,32,64,64]){const due=M.answer(deck,id,'f','good',day);assert.equal(due,M.addDays(day,step));day=due;}
 assert.equal(M.answer(deck,id,'f','again',day),M.addDays(day,1));assert.equal(deck.cards[0].s.f.box,1);assert.equal(deck.cards[0].s.f.lapses,1);
 day=M.addDays(day,1);assert.equal(M.answer(deck,id,'f','easy',day),M.addDays(day,4));
 assert.equal(M.answer(deck,'absent','f','good',day),null);assert.equal(M.answer(deck,id,'b','good',day),null);assert.equal(M.answer(deck,id,'f','maybe',day),null);
});

test('answering the same side twice today cannot change its history or daily counts',()=>{
 const deck=deckOf(card()),id=deck.cards[0].id;M.answer(deck,id,'f','good',DAY);const before=structuredClone(deck);assert.equal(M.answer(deck,id,'f','again',DAY),null);assert.deepEqual(deck,before);
});

test('test metadata comes only from upcoming assignment names or quiz submission types',()=>{
 const tests=M.testsAhead([{courseId:'7',name:'Unit 3 Test',dueAt:'2026-10-23T14:00:00Z',submissionTypes:['on_paper']},{courseId:'5',name:'Lab report',dueAt:'2026-10-22T14:00:00Z',submissionTypes:['online_upload']},{courseId:'9',name:'Reading check',dueAt:'2026-10-24T14:00:00Z',submissionTypes:['online_quiz']},{courseId:'8',name:'Final exam',dueAt:'2026-12-10T14:00:00Z'},{courseId:'4',name:'Old test',dueAt:'2026-10-19T14:00:00Z'}],DAY,v=>v.slice(0,10));
 assert.deepEqual(tests,{7:'2026-10-23',9:'2026-10-24'});assert.deepEqual(M.testsAhead([{courseId:'5',name:'Quiz',dueAt:'bad'}],DAY,()=>{throw Error('bad date');}),{});
});

test('existing long waits are capped for a newly entered test without mutating their history',()=>{
 const a=card('a','1'),b=card('b','2',{course:'7'});b.s.f={...b.s.f,box:6,due:'2026-12-10',first:'2026-10-01',last:'2026-10-19'};
 const deck=deckOf(a,b),before=structuredClone(deck);assert.deepEqual(M.queue(deck,DAY,{tests:{7:DAY}}).map(e=>e.id),[b.id,a.id]);assert.deepEqual(deck,before);
 assert.deepEqual(M.queue(deck,DAY,{tests:{7:'2026-10-19'}}).map(e=>e.id),[a.id]);assert.deepEqual(deck,before);
});

test('all grades cap to the test day including a test today, and reviewed sides stay out for that day',()=>{
 for(const grade of ['again','good','easy']){const deck=deckOf(card()),id=deck.cards[0].id;deck.testDates['5']=DAY;assert.deepEqual(M.preview(deck,id,'f',DAY),{again:DAY,good:DAY,easy:DAY});assert.equal(M.answer(deck,id,'f',grade,DAY),DAY);assert.equal(M.queue(deck,DAY).length,0);}
 const deck=deckOf(card()),id=deck.cards[0].id;assert.equal(M.answer(deck,id,'f','easy',DAY,{tests:{5:'2026-10-19'}}),'2026-10-22');
});

test('a test date change does not resurrect a side already answered today or rewrite past due history',()=>{
 const deck=deckOf(card()),id=deck.cards[0].id;M.answer(deck,id,'f','easy',DAY);const before=structuredClone(deck.cards[0].s.f);deck.testDates['5']=DAY;
 assert.equal(M.queue(deck,DAY).length,0);assert.deepEqual(deck.cards[0].s.f,before);deck.testDates['5']='2026-10-19';assert.equal(M.queue(deck,'2026-10-21').length,0);assert.deepEqual(deck.cards[0].s.f,before);
});

test('manual and Canvas dates use the nearest active test; course filtering happens before limits',()=>{
 const deck=deckOf(card('a','1'),card('b','2',{course:'7'}));deck.testDates['5']='2026-10-24';assert.deepEqual(M.activeTests(deck,DAY,{5:'2026-10-22',7:'2026-10-21',9:'2026-12-01'}),{5:'2026-10-22',7:'2026-10-21'});
 deck.settings.newPerDay=1;assert.deepEqual(M.queue(deck,DAY,{course:'7'}).map(e=>e.id),[deck.cards[1].id]);
});

test('an explicitly scheduled test caps long waits even when it is more than fourteen days away',()=>{
 const c=card(),deck=deckOf(c);deck.cards[0].s.f={box:6,due:DAY,lapses:0,first:'2026-10-01',last:'2026-10-19'};deck.testDates['5']='2026-11-30';assert.equal(M.answer(deck,c.id,'f','easy',DAY),'2026-11-30');
});

test('finishing a partial course does not finish the whole day, and statistics reflect real histories',()=>{
 const deck=deckOf(card('a','1'),card('b','2',{course:'7'}));assert.equal(M.finishDay(deck,DAY),false);M.answer(deck,deck.cards[0].id,'f','good',DAY);assert.equal(M.finishDay(deck,DAY),false);
 M.answer(deck,deck.cards[1].id,'f','good',DAY);assert.equal(M.finishDay(deck,DAY),true);assert.equal(M.finishDay(deck,DAY),false);
 deck.log.unshift({d:'2026-10-19',n:2,r:0,w:0,done:true},{d:'2026-10-18',n:1,r:0,w:0,done:true});const st=M.stats(deck,DAY);assert.equal(st.total,2);assert.equal(st.due,0);assert.equal(st.streak,3);assert.equal(st.today.reviewed,2);assert.equal(st.ahead[0].n,2);assert.equal(st.today.done,true);
});
