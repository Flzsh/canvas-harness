// Adapted from Gary Wu's pull request #44 to Canvas Harness.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../extension/review-deck-model.js'),UI=require('../extension/review-deck.js'),DAY='2026-10-20',ORIGIN='https://school.instructure.com';
const card=(front='term',back='answer',extra={})=>M.makeCard({front,back,course:'5',today:DAY,...extra});
function fixture(cards=[]){
 let data={settings:{reviewDecks:M.cleanDeck({cards})}},changed=0,writes=0,reads=0,auth=0,enabled=true,path='/dashboard',time=Date.parse(DAY+'T12:00:00Z');const exports=[],checkbox={disabled:false,checked:false};
 const context={user:{id:'7'},origin:ORIGIN,s:{timeZone:'UTC'},courses:[{id:'5',name:'Biology'},{id:'9',name:'Latin'}],items:[]};
 const store={owner:{accountId:'7',origin:ORIGIN},get(){reads++;return structuredClone(data);},async update(fn){writes++;if(store.before)await store.before();if(store.fail)throw Error('Storage full');const next=structuredClone(data);fn(next);if(!store.drop)data=next;return structuredClone(data);}};
 const container={querySelector(selector){return selector.includes('two-way')?checkbox:null;}};
 const ui=UI.create({container,store,getContext:()=>context,onChange:()=>changed++,onAuthError:()=>auth++,isEnabled:()=>enabled,isSelected:()=>true,getPath:()=>path,now:()=>time,onExport:payload=>exports.push(payload)});
 return {ui,store,context,exports,checkbox,action:(name,values={})=>ui.action('review-deck-'+name,values),input:(name,value)=>ui.input('review-deck-'+name,value),get data(){return structuredClone(data);},get changed(){return changed;},get writes(){return writes;},get reads(){return reads;},get auth(){return auth;},set enabled(value){enabled=value;},set path(value){path=value;},set time(value){time=value;},mutate(fn){fn(data);}};
}
const draft=(f,front='new front',back='new back')=>{f.input('front',front);f.input('back',back);f.input('editor-course','5');};

test('the controller renders synchronously, reads no storage while disabled, and never starts idle work',()=>{
 const source=fs.readFileSync(require.resolve('../extension/review-deck.js'),'utf8'),scope={ReserveReviewDeckModel:M,URL,Date,Intl,Map,Set,JSON,Promise};
 vm.runInNewContext(source,scope);let reads=0;const ui=scope.ReserveReviewDeck.create({store:{owner:{accountId:'7',origin:ORIGIN},get(){reads++;return {};},update:async()=>{}},getContext:()=>({})});assert.equal(ui.renderReviewDeck(),'');assert.equal(reads,0);ui.destroy();
 const f=fixture();assert.equal(typeof f.ui.renderReviewDeck(),'string');assert.equal(f.writes,0);f.enabled=false;const before=f.reads;assert.equal(f.ui.renderReviewDeck(),'');assert.equal(f.reads,before);
 assert.doesNotMatch(source,/setInterval\s*\(|fetch\s*\(|XMLHttpRequest|sendBeacon|chrome\.storage|chrome\.runtime/);f.ui.destroy();
});

test('quiz-taking and assessment-session routes deny rendering, reads and writes',async()=>{
 for(const path of ['/courses/5/quizzes/9/take','/courses/5/quizzes/9/resume','/courses/5/assessment_sessions/91','/assessment_sessions/']){const f=fixture();f.path=path;assert.equal(f.ui.renderReviewDeck(),'');draft(f);await f.action('save');assert.equal(f.reads,0);assert.equal(f.writes,0);f.ui.destroy();}
});

test('authoring text, paste text and search keep their nodes without key-by-key redraws',async()=>{
 const f=fixture();await f.action('new');const count=f.changed;draft(f,'The {{nucleus}}','note');f.input('two-way',true);f.input('front','The {{nucleus}} holds DNA');f.input('import-text','one\t1');f.input('query','needle');assert.equal(f.changed,count);assert.equal(f.checkbox.disabled,true);assert.equal(f.checkbox.checked,false);
 assert.match(f.ui.renderReviewDeck(),/The \{\{nucleus\}\} holds DNA/);f.ui.destroy();
});

test('editor, import, and search drafts remain available across tab switches',async()=>{
 const f=fixture();draft(f);f.input('import-text','one\t1');await f.action('tab',{tab:'import'});assert.match(f.ui.renderReviewDeck(),/one\t1/);await f.action('tab',{tab:'add'});assert.match(f.ui.renderReviewDeck(),/new front/);assert.equal(f.writes,0);f.ui.destroy();
});

test('storage rejection retains the authoring draft and exposes the failure; retry saves once',async()=>{
 const f=fixture();await f.action('new');draft(f);f.store.fail=true;await f.action('save');assert.equal(f.data.settings.reviewDecks.cards.length,0);assert.match(f.ui.renderReviewDeck(),/Storage full/);assert.equal(f.ui.getState().editor.front,'new front');
 f.store.fail=false;await f.action('save');assert.equal(f.data.settings.reviewDecks.cards.length,1);assert.equal(f.ui.getState().editor.front,'');assert.equal(f.data.settings.reviewDecks.cards[0].c,'5');f.ui.destroy();
});

test('a validator silently dropping a write cannot report success or clear the draft',async()=>{
 const f=fixture();await f.action('new');draft(f);f.store.drop=true;await f.action('save');assert.equal(f.data.settings.reviewDecks.cards.length,0);assert.equal(f.ui.getState().editor.front,'new front');assert.match(f.ui.renderReviewDeck(),/could not be confirmed/);f.ui.destroy();
});

test('new input typed during a successful save remains in the editor',async()=>{
 const f=fixture();await f.action('new');draft(f,'first front','first back');let resume;f.store.before=()=>new Promise(resolve=>{resume=resolve;});const pending=f.action('save');draft(f,'next front','next back');resume();await pending;
 assert.equal(f.data.settings.reviewDecks.cards[0].f,'first front');assert.equal(f.ui.getState().editor.front,'next front');assert.match(f.ui.renderReviewDeck(),/next back/);f.ui.destroy();
});

test('editing another card retains an unsaved new card and a changed card never overwrites another tab',async()=>{
 const c=card(),f=fixture([c]);draft(f,'unfinished','draft');await f.action('edit',{id:c.id});f.input('front','my edit');f.mutate(data=>data.settings.reviewDecks.cards[0].f='other tab');await f.action('save');assert.equal(f.data.settings.reviewDecks.cards[0].f,'other tab');assert.match(f.ui.renderReviewDeck(),/changed elsewhere/);assert.equal(f.ui.getState().editor.front,'my edit');await f.action('new');assert.equal(f.ui.getState().editor.front,'unfinished');f.ui.destroy();
});

test('an editor cannot resurrect a card deleted elsewhere',async()=>{
 const c=card(),f=fixture([c]);await f.action('edit',{id:c.id});f.input('front','kept edit');f.mutate(data=>data.settings.reviewDecks.cards=[]);await f.action('save');assert.equal(f.data.settings.reviewDecks.cards.length,0);assert.equal(f.ui.getState().editor.front,'kept edit');assert.match(f.ui.renderReviewDeck(),/deleted/);f.ui.destroy();
});

test('oversized authored cards are rejected while retaining their full text',async()=>{
 const f=fixture();await f.action('new');draft(f,'a'.repeat(1001),'answer');await f.action('save');assert.equal(f.writes,0);assert.equal(f.ui.getState().editor.front.length,1001);assert.match(f.ui.renderReviewDeck(),/1000 characters/);f.ui.destroy();
});

test('a full deck rejects an entire import and keeps the pasted text',async()=>{
 const f=fixture(Array.from({length:1999},(_,i)=>card('q'+i,'a',{id:'rc-card-'+i})));await f.action('tab',{tab:'import'});f.input('import-text','one\t1\ntwo\t2');await f.action('import');assert.equal(f.data.settings.reviewDecks.cards.length,1999);assert.equal(f.ui.getState().import.text,'one\t1\ntwo\t2');assert.match(f.ui.renderReviewDeck(),/1 spaces remain/);f.ui.destroy();
});

test('CSV import is atomic for malformed input and failed writes, then preserves multiline content',async()=>{
 const f=fixture();await f.action('tab',{tab:'import'});f.input('import-course','9');f.input('import-format','csv');f.input('import-two-way',true);f.input('import-text','"one\nline","say ""hello"""\ninvalid');await f.action('import');assert.equal(f.data.settings.reviewDecks.cards.length,0);assert.match(f.ui.renderReviewDeck(),/Line 3/);
 const text='"one\nline","say ""hello"""';f.input('import-text',text);f.store.fail=true;await f.action('import');assert.equal(f.ui.getState().import.text,text);f.store.fail=false;await f.action('import');const c=f.data.settings.reviewDecks.cards[0];assert.equal(c.f,'one\nline');assert.equal(c.b,'say "hello"');assert.equal(c.c,'9');assert.equal(c.two,true);assert.equal(f.ui.getState().import.text,'');f.ui.destroy();
});

test('new paste input entered during import survives the completed save and invalidates its old preview',async()=>{
 const f=fixture();f.input('import-text','first\tanswer');let resume;f.store.before=()=>new Promise(resolve=>{resume=resolve;});const pending=f.action('import');f.input('import-text','next\tdraft');resume();await pending;assert.equal(f.data.settings.reviewDecks.cards[0].f,'first');assert.equal(f.ui.getState().import.text,'next\tdraft');assert.equal(f.ui.getState().import.preview,null);f.ui.destroy();
});

test('file size is checked before reading and a late file read never replaces newer pasted text',async()=>{
 const f=fixture();f.input('import-text','existing\tdraft');let reads=0;await f.ui.readFile({size:M.LIMITS.importBytes+1,text:async()=>{reads++;return 'bad';}});assert.equal(reads,0);assert.equal(f.ui.getState().import.text,'existing\tdraft');let resume;const pending=f.ui.readFile({size:20,name:'cards.csv',text:()=>new Promise(resolve=>{resume=resolve;})});f.input('import-text','newer\tdraft');resume('one,two');await pending;assert.equal(f.ui.getState().import.text,'newer\tdraft');f.ui.destroy();
});

test('review failure leaves the same answer revealed and does not advance scheduling or counts',async()=>{
 const f=fixture([card()]);await f.action('start');await f.action('reveal');f.store.fail=true;await f.action('grade',{grade:'good'});assert.equal(f.ui.getState().session.index,0);assert.equal(f.ui.getState().session.revealed,true);assert.equal(f.ui.getState().session.count,0);assert.equal(f.data.settings.reviewDecks.cards[0].s.f.box,0);assert.match(f.ui.renderReviewDeck(),/Storage full/);
 f.store.fail=false;await f.action('grade',{grade:'good'});assert.equal(f.ui.getState().session.index,1);assert.equal(f.data.settings.reviewDecks.cards[0].s.f.last,DAY);f.ui.destroy();
});

test('Again adds one practice pass without scheduling or counting the answer twice',async()=>{
 const f=fixture([card()]);await f.action('start');await f.action('reveal');await f.action('grade',{grade:'again'});assert.equal(f.ui.getState().session.list.length,2);const before=f.writes;await f.action('reveal');await f.action('grade',{grade:'good'});assert.equal(f.writes,before);assert.equal(f.data.settings.reviewDecks.log[0].n,1);assert.equal(f.ui.getState().session.count,1);f.ui.destroy();
});

test('cloze answers remain hidden until revealed and do not enable reverse review',async()=>{
 const f=fixture([card('The {{nucleus}} holds DNA','',{twoWay:true})]);await f.action('start');assert.doesNotMatch(f.ui.renderReviewDeck(),/nucleus/);assert.match(f.ui.renderReviewDeck(),/aria-label="blank"/);await f.action('reveal');assert.match(f.ui.renderReviewDeck(),/<mark>nucleus<\/mark>/);assert.equal(f.ui.getState().session.list.length,1);f.ui.destroy();
});

test('both sides of a two-way card can be reviewed on the next day without a false conflict',async()=>{
 const c=card('front','back',{twoWay:true}),d=M.cleanDeck({cards:[c]});M.answer(d,c.id,'f','good','2026-10-19');const f=fixture(d.cards);await f.action('start');assert.deepEqual(f.ui.getState().session.list.map(e=>e.side),['f','b']);for(let i=0;i<2;i++){await f.action('reveal');await f.action('grade',{grade:'good'});}assert.equal(f.ui.getState().session.index,2);assert.equal(f.data.settings.reviewDecks.cards[0].s.b.last,DAY);assert.doesNotMatch(f.ui.renderReviewDeck(),/changed elsewhere/);f.ui.destroy();
});

test('course test dates cap every answer to today and do not queue the same card repeatedly',async()=>{
 const f=fixture([card()]);await f.action('tab',{tab:'settings'});f.input('test-course','5');f.input('test-date',DAY);await f.action('save-date');await f.action('start');await f.action('reveal');await f.action('grade',{grade:'easy'});assert.equal(f.data.settings.reviewDecks.cards[0].s.f.due,DAY);assert.equal(M.queue(f.data.settings.reviewDecks,DAY).length,0);f.ui.destroy();
});

test('day rollover and concurrent review changes keep the current answer available without writes',async()=>{
 const f=fixture([card()]);await f.action('start');await f.action('reveal');f.time=Date.parse('2026-10-21T12:00:00Z');await f.action('grade',{grade:'good'});assert.equal(f.writes,0);assert.equal(f.ui.getState().session.revealed,true);assert.match(f.ui.renderReviewDeck(),/day changed/);f.ui.destroy();
 const g=fixture([card()]);await g.action('start');await g.action('reveal');g.mutate(data=>M.answer(data.settings.reviewDecks,data.settings.reviewDecks.cards[0].id,'f','easy',DAY));await g.action('grade',{grade:'good'});assert.equal(g.ui.getState().session.index,0);assert.match(g.ui.renderReviewDeck(),/changed elsewhere/);g.ui.destroy();
});

test('account changes erase private drafts and prevent pending mutations from crossing accounts',async()=>{
 const f=fixture();draft(f,'private front','private back');let resume;f.store.before=()=>new Promise(resolve=>{resume=resolve;});const pending=f.action('save');f.context.user.id='8';resume();await pending;assert.equal(f.data.settings.reviewDecks.cards.length,0);assert.equal(f.ui.renderReviewDeck(),'');assert.equal(f.ui.getState(),null);assert.equal(f.auth,1);f.ui.destroy();
});

test('pause and delete do not claim success after storage failures',async()=>{
 const c=card(),f=fixture([c]);f.store.fail=true;await f.action('pause',{id:c.id});assert.equal(f.data.settings.reviewDecks.cards[0].paused,false);await f.action('delete',{id:c.id});await f.action('delete',{id:c.id});assert.equal(f.data.settings.reviewDecks.cards.length,1);assert.match(f.ui.renderReviewDeck(),/Storage full/);f.ui.destroy();
});

test('exports remain local and scoped by course, and all authored markup is escaped',async()=>{
 const f=fixture([card('<img src=x onerror=bad()>','<script>bad()</script>'),card('Latin','meaning',{course:'9'})]);const html=f.ui.renderReviewDeck();assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;img/);f.input('course','9');await f.action('export');assert.equal(f.exports.length,1);assert.equal(M.parseList(f.exports[0].text,{format:'tsv'}).cards[0].front,'Latin');f.ui.destroy();
});

test('event hooks and key handling stay scoped to the active deck and suppress repeated grades',async()=>{
 const f=fixture([card()]);assert.equal(f.ui.input({target:{dataset:{rdField:'review-deck-front'},value:'from event',type:'text'}}),true);assert.equal(f.ui.getState().editor.front,'from event');assert.equal(f.ui.input('other-field','x'),false);assert.equal(await f.ui.action('other-action'),false);await f.action('start');await f.action('reveal');let prevented=0;assert.equal(f.ui.keydown({key:'2',repeat:true,target:{tagName:'DIV'},preventDefault(){prevented++;}}),false);assert.equal(f.ui.keydown({key:'2',target:{tagName:'INPUT'},preventDefault(){prevented++;}}),false);assert.equal(prevented,0);assert.equal(f.ui.handleReviewDeckAction,f.ui.action);assert.equal(f.ui.handleReviewDeckInput,f.ui.input);f.ui.destroy();
});
