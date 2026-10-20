'use strict';
// The review deck: its rules (making cards, pasted lists, fill in the blank, two-way cards, the daily queue, the waits,
// the before-test boost, the numbers), how it is stored, and how it is wired into Harness.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const M=require('../extension/review-model.js');
const {createStore,validateBackup}=require('../extension/storage.js');
const ext=path.join(__dirname,'..','extension'),read=f=>fs.readFileSync(path.join(ext,f),'utf8');
const DAY='2026-10-20';
const deckOf=(...cards)=>M.cleanDeck({cards});
const card=(front,back,extra={})=>M.makeCard({front,back,course:'5',today:DAY,...extra});

test('cards are cleaned: sides, courses, ids and limits',()=>{
 const c=card('mitosis','cell division',{twoWay:true});
 assert.match(c.id,/^rc-/);assert.equal(c.c,'5');assert.equal(c.two,true);assert.deepEqual(c.s,{f:{box:0,due:'',lapses:0},b:{box:0,due:'',lapses:0}});
 assert.equal(M.cleanCard({...c,id:'x'}),null,'a made-up id is dropped');
 assert.equal(M.cleanCard({...c,f:''}),null);assert.equal(M.cleanCard({...c,b:''}),null,'a plain card needs a back');
 assert.equal(M.cleanCard({...c,c:'javascript:'}).c,'personal');
 assert.equal(M.cleanCard({...c,f:'x'.repeat(5000)}).f.length,1000);
 const cloze=card('The {{nucleus}} holds DNA','',{twoWay:true});assert.ok(cloze);assert.equal(cloze.two,false,'a fill-in-the-blank card is one-way');assert.ok(!cloze.s.b);
 assert.equal(M.cleanCard({...c,src:{url:'javascript:alert(1)',title:'x'}}).src,undefined,'only https sources');
 const many=M.cleanDeck({cards:Array.from({length:2100},()=>card('a','b'))});assert.equal(many.cards.length,2000);
 assert.deepEqual(M.cleanDeck({settings:{newPerDay:99,maxReviews:2}}).settings,{newPerDay:50,maxReviews:10});
 assert.equal(M.checkCard('',''),'Write the front of the card.');
 assert.match(M.checkCard('The {{nucleus','x'),/two braces/);assert.match(M.checkCard('term',''),/Write the back/);assert.equal(M.checkCard('The {{nucleus}}',''),'');
});

test('a pasted list: tabs, dashes, colons and equals; fill-in-the-blank sentences stay whole; bad lines are named',()=>{
 const p=M.parseList('mitosis – cell division\nATP: energy carrier\nRate law = rate = k[A]\nThe {{Arrhenius}} equation: relates k and T\n\\(x^2\\)\tsquare\n\nno separator here\nfront only - ');
 assert.deepEqual(p.cards,[{front:'mitosis',back:'cell division'},{front:'ATP',back:'energy carrier'},{front:'Rate law',back:'rate = k[A]'},{front:'The {{Arrhenius}} equation: relates k and T',back:''},{front:'\\(x^2\\)',back:'square'}]);
 assert.deepEqual(p.problems.map(x=>x.line),[7,8]);
 assert.equal(M.exportText([{f:'a\tb',b:'c\nd'},{f:'e',b:'f'}]),'a b\tc d\ne\tf','export is one front<TAB>back line per card');
 assert.deepEqual(M.clozeParts('The {{nucleus}} holds {{DNA}}.'),[{text:'The '},{hidden:'nucleus'},{text:' holds '},{hidden:'DNA'},{text:'.'}]);
});

test('the day: due cards first, then new ones up to the limit; a two-way card asks back-first only after front-first',()=>{
 const a=card('a','1'),b=card('b','2',{twoWay:true}),c=card('c','3'),d=card('d','4');
 a.s.f={box:2,due:'2026-10-19',lapses:0};c.s.f={box:3,due:'2026-10-25',lapses:0};
 const deck=deckOf(a,b,c,d);deck.settings.newPerDay=1;
 assert.deepEqual(M.queue(deck,DAY).map(x=>[x.id===a.id?'a':x.id===b.id?'b':'?',x.side,x.fresh]),[['a','f',false],['b','f',true]]);
 b.s.f={box:1,due:'2026-10-21',lapses:0};
 const q=M.queue(deckOf(a,b,c,d),DAY).map(x=>[x.id===b.id?'b':x.id===d.id?'d':'a',x.side]);
 assert.deepEqual(q,[['a','f'],['b','b'],['d','f']].slice(0,q.length),'back-first joins once front-first was seen');
 const paused=deckOf({...a,paused:true});assert.equal(M.queue(paused,DAY).length,0,'paused cards wait');
});

test('waits: Good 1, 2, 4, 8, 16, 32, 64 days; Easy skips one; Again tomorrow',()=>{
 const deck=deckOf(card('a','1')),id=deck.cards[0].id,walk=[];
 for(let i=0;i<8;i++){walk.push(M.answer(deck,id,'f','good',DAY));}
 assert.deepEqual(walk,['2026-10-21','2026-10-22','2026-10-24','2026-10-28','2026-11-05','2026-11-21','2026-12-23','2026-12-23']);
 assert.equal(M.answer(deck,id,'f','again',DAY),'2026-10-21');assert.equal(deck.cards[0].s.f.box,1);assert.equal(deck.cards[0].s.f.lapses,1);
 assert.equal(M.answer(deck,id,'f','easy',DAY),'2026-10-24','Easy from the first wait jumps to the third');
 assert.deepEqual(M.preview(deck,id,'f',DAY),{again:'2026-10-21',good:'2026-10-28',easy:'2026-11-05'});
 assert.equal(M.answer(deck,'nope','f','good',DAY),null);assert.equal(M.answer(deck,id,'f','maybe',DAY),null);
 const log=deck.log.find(e=>e.d===DAY);assert.equal(log.n,1);assert.equal(log.r,9);assert.equal(log.w,1);
});

test('before a test: that course comes first and nothing waits past the test day',()=>{
 const items=[{courseId:'7',name:'Unit 3 Test',dueAt:'2026-10-23T14:00:00Z',submissionTypes:['on_paper']},{courseId:'5',name:'Lab report',dueAt:'2026-10-22T14:00:00Z',submissionTypes:['online_upload']},
  {courseId:'9',name:'Reading check',dueAt:'2026-10-24T14:00:00Z',submissionTypes:['online_quiz']},{courseId:'8',name:'Final exam',dueAt:'2026-12-10T14:00:00Z',submissionTypes:[]}];
 const tests=M.testsAhead(items,DAY,v=>v.slice(0,10));
 assert.deepEqual(tests,{7:'2026-10-23',9:'2026-10-24'},'tests and quizzes in the next 14 days, by name or quiz type');
 const x=card('x','1'),y=card('y','2',{course:'7'});
 assert.deepEqual(M.queue(deckOf(x,y),DAY,{tests}).map(q=>q.id),[y.id,x.id],'the course with a test comes first');
 const deck=deckOf(y),id=deck.cards[0].id;deck.cards[0].s.f={box:4,due:DAY,lapses:0};
 assert.equal(M.answer(deck,id,'f','easy',DAY,{tests}),'2026-10-23','capped at the test day');
 assert.equal(M.stats(deckOf(card('y','2',{course:'7'})),DAY,{tests}).boosted.join(),'7');
});

test('the day finishes once, and the numbers add up',()=>{
 const a=card('a','1'),b=card('b','2',{course:'personal'});a.s.f={box:5,due:'2026-10-22',lapses:0};
 const deck=deckOf(a,b);
 assert.equal(M.finishDay(deck,DAY),false,'nothing answered yet');
 M.answer(deck,deck.cards[1].id,'f','good',DAY);
 assert.equal(M.finishDay(deck,DAY),true);assert.equal(M.finishDay(deck,DAY),false,'a treat once a day');
 deck.log.unshift({d:'2026-10-19',n:2,r:0,w:0,done:true},{d:'2026-10-18',n:1,r:0,w:0,done:true});
 const st=M.stats(deck,DAY);
 assert.equal(st.streak,3);assert.equal(st.total,2);assert.equal(st.learned,1);assert.equal(st.due,0);
 assert.deepEqual(st.ahead.slice(0,2).map(x=>x.n),[1,1]);assert.equal(st.today.done,true);
});

test('the deck is stored with personal data and survives a backup',async()=>{
 const mem=new Map(),adapter={read:async k=>mem.get(k),write:async(k,v)=>{mem.set(k,structuredClone(v));}};
 const store=createStore({accountId:'7',origin:'https://school.instructure.com',adapter});await store.load();
 await store.update(d=>{d.reviewDeck={cards:[card('a','1'),{id:'junk'}],settings:{newPerDay:5}};});
 const saved=store.get();assert.equal(saved.reviewDeck.cards.length,1);assert.equal(saved.reviewDeck.settings.newPerDay,5);
 const restored=validateBackup(store.exportBackup(),store.owner);assert.equal(restored.reviewDeck.cards[0].f,'a');
});

test('wired in: scripts, stylesheet, Home module, reader, hub, pony, focus room and Shift+R; nothing written to Canvas',()=>{
 const manifest=JSON.parse(read('manifest.json')),js=manifest.content_scripts.find(c=>c.js.includes('dashboard.js')).js;
 assert.ok(js.indexOf('review-model.js')<js.indexOf('storage.js'));assert.ok(js.indexOf('review-deck.js')<js.indexOf('widgets.js'));
 for(const w of manifest.web_accessible_resources)assert.ok(w.resources.includes('review-deck.css'));
 for(const f of ['startup.js','content.js'])assert.match(read(f),/'focus-room\.css','review-deck\.css'/);
 assert.match(read('workspace-arrange.js'),/const EXTRA=\['today','week','timer','review',/);
 const widgets=read('widgets.js');
 assert.match(widgets,/if\(deck&&event\.key==='R'&&event\.shiftKey/);assert.match(widgets,/if\(deck&&action==='review-add'\)/);
 assert.match(read('pets.js'),/gain=\{done:10,focus:6,review:4,plan:2\}/);
 assert.match(read('dashboard-view.js'),/action\('review-add',icon\('plus'\)\+'<span>Add card<\/span>'/);
 // Always-visible ways in: each course's page and hub heading, the toolbar (with the count due) and the focus room.
 assert.equal((read('course-hub-ui.js').match(/root\.ReserveReviewDeck\?\.current\?\.courseButton\?\.\(id\)/g)||[]).length,2,'course page and hub headings');
 assert.match(read('dashboard-view.js'),/action\('review-start',icon\('book'\)\+`<span>Cards<\/span>/);
 assert.match(read('focus-room.js'),/class="fr-icon fr-cards" data-rd-action="review-start"/);
 assert.match(read('focus-room.js'),/<option value="review:deck"/);
 const ui=read('review-deck.js');
 assert.doesNotMatch(ui+read('review-model.js'),/fetch\(|XMLHttpRequest|sendBeacon|chrome\.runtime\.sendMessage/,'the deck reads and sends nothing');
 assert.match(ui,/root\.ReserveMath\.renderText\(t\)/,'math through Harness\'s safe renderer');
});
