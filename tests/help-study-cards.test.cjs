'use strict';
// The Help card is the help itself (owner, 2026-10-25): a test gets a study sheet beside practice, homework a worked
// example of a similar problem; one card per assignment; a study card opens in full.
const {test}=require('node:test'),assert=require('node:assert/strict');
const Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js'),Study=require('../extension/study-prompts.js');
const {dom,storage,descendants}=require('./study-fixture.cjs');
const scope='https://school.instructure.com|7';
const study=(extra={})=>({v:1,kind:'study',size:'l',importance:1,headline:'Chem: kinetics test',title:'Kinetics test',minutes:40,sheet:[{heading:'Rate laws',facts:[{label:'Units of k',text:'second order: M⁻¹ s⁻¹',note:'rate = k[A]²'},{text:'Orders come from data.'}]}],tip:'Use kelvin.',practice:[{q:'Doubling [A] quadruples the rate. Order?',answer:'Second order',why:'2² = 4'},{q:'Half-life when k = 0.0231 per minute?',answer:'30.0 min',why:'0.693 ÷ 0.0231'}],gaps:[],...extra});
const example={v:1,kind:'example',size:'m',importance:1,headline:'Chem: limiting reagent',title:'Limiting reagent',problem:'4.0 g H2 with 40 g O2. Which runs out?',steps:[{text:'H2 = 2.0 mol; O2 = 1.25 mol.'},{text:'2.0 mol H2 needs 1.0 mol O2, so H2 runs out.'}],answer:'H2 runs out first.',yours:'Turn each mass into moles first.',gaps:[]};
const aid=(data,extra={})=>({kind:data.kind,title:data.title,data,savedAt:100,progress:{},...extra});
function band(aids){const d=dom(),host=new d.Element('div'),env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:false})},view=Band.renderBand(host,aids,{env,scope,store:UI.createStore(env)});return {...d,host,view};}
const all=(root,cls)=>descendants(root).filter(n=>String(n.className||'').split(' ').includes(cls));
const text=n=>descendants(n).filter(x=>x.nodeType===3||typeof x.textContent==='string'&&!x.children?.length).map(x=>x.textContent).join(' ');

test('the reader accepts a study card and an example in Ask and Prepare replies and keeps the AI\'s text as written',()=>{
 const wire=card=>{const {v,...rest}=card;return rest;},reply='```json\n'+JSON.stringify({cards:[wire(study()),wire(example)]})+'\n```';
 for(const parsed of [Study.parseAsk(reply),Study.parsePrepare(reply)]){assert.equal(parsed.ok,true,JSON.stringify(parsed.errors));assert.deepEqual(parsed.data.cards.map(c=>c.kind+':'+c.size),['study:l','example:m']);}
 const first=Study.parseAsk(reply).data.cards[0];assert.equal(first.practice[0].q,'Doubling [A] quadruples the rate. Order?');assert.equal(first.sheet[0].facts[0].text,'second order: M⁻¹ s⁻¹');
 assert.equal(Study.parseAsk(reply.replace('Doubling [A]','2. Doubling [A]')).data.cards[0].practice[0].q,'2. Doubling [A] quadruples the rate. Order?','CH does not rewrite the AI\'s words');
 const thin=Study.parseAsk('```json\n'+JSON.stringify({cards:[wire(study({practice:[{q:'Only one?',answer:'Yes'}]}))]})+'\n```');assert.equal(thin.ok,false,'a study card needs at least two practice questions');
});
test('the instructions ask for the help itself and not a plan',()=>{
 const at={now:Date.parse('2026-10-25T16:00:00Z'),timeZone:'America/New_York'},ask=Study.buildAsk({question:'Help me get ready for this test.',brief:'Courses: Chemistry',...at});
 assert.match(ask,/"study"/);assert.match(ask,/worked example of a similar problem/);assert.match(ask,/No "finish the worksheet"|no "finish the worksheet"/);assert.match(ask,/Do not number practice questions or steps: the card numbers them/);
 // Owner, 2026-10-28: all maths as LaTeX (the old "x², never ^ or _" line produced unreadable plain-text maths).
 assert.match(ask,/Mathematics is always LaTeX, never plain text/);assert.doesNotMatch(ask,/never \^ or _/);
 // Daily help: Prepare picks what to make; each deliverable prompt asks for the help itself.
 const pick=Study.buildPrepare({brief:'Courses: Chemistry',...at});assert.match(pick,/"picks"/);for(const make of Study.DELIVER_KINDS)assert.match(pick,new RegExp('"'+make+'"'));assert.doesNotMatch(pick,/"cards"/);
 for(const make of Study.DELIVER_KINDS){const m=Study.buildDeliver(make,{item:'Chemistry · Unit test',focus:'rates',sources:[{label:'Teacher instructions',text:'Study chapter 12.'}],...at});assert.match(m,/Give the help itself\. No study tips, reminders, schedules, summaries/);assert.match(m,/Study chapter 12\./);assert.match(m,new RegExp('"kind":"'+make+'"'));}
 for(const message of [ask,pick,...Study.DELIVER_KINDS.map(k=>Study.buildDeliver(k,{item:'x',...at}))]){assert.doesNotMatch(message,/Plan \(always\)/);assert.doesNotMatch(message,/kinetic|limiting reagent|equilibri|percussit|\bKc\b|ICE table|SO_?\{?3|SO₃|Latin|\[2 1; ?-1 3\]/i,'no subject example steers the AI');}
});
test('a study card shows the sheet beside practice, the AI\'s text as written, and answers only after Show answer',async()=>{
 const f=band({a:aid(study())});await f.view.loaded;
 const sheet=all(f.host,'ch-study-sheet')[0],quiz=all(f.host,'ch-study-quiz')[0];assert.ok(sheet&&quiz);
 assert.equal(all(sheet,'ch-study-fact').length,2);assert.equal(all(sheet,'ch-study-fact-text')[0].textContent,'second order: M⁻¹ s⁻¹');assert.equal(all(sheet,'ch-study-fact-note')[0].textContent,'rate = k[A]²');
 const answers=all(quiz,'ch-study-quiz-answer');assert.equal(answers.length,2);assert.ok(answers.every(a=>a.hidden),'answers start hidden');
 assert.equal(all(quiz,'ch-study-slip').length,2,'each question is its own slip');
 const show=descendants(quiz).find(n=>n.tagName==='BUTTON'&&n.textContent==='Answer');show.fire('click');
 assert.equal(answers[0].hidden,false);assert.match(answers[0].textContent,/Second order/);
});
test('a study card stays folded on its page; Show all opens it and Show less folds it again',async()=>{
 const f=band({a:aid(study())});await f.view.loaded;const card=all(f.host,'ch-band-card')[0];
 assert.notEqual(card.dataset.open,'true');assert.notEqual(f.view.element.dataset.grown,'true');
 const more=all(card,'ch-band-more')[0];more.fire('click');assert.equal(card.dataset.open,'true');assert.equal(f.view.element.dataset.grown,'true');
 more.fire('click');assert.equal(card.dataset.open,'false');
});
test('a worked example shows the similar problem, its steps, its answer and how to start yours',async()=>{
 const f=band({a:aid(example)});await f.view.loaded;
 assert.match(all(f.host,'ch-study-example')[0].textContent,/4\.0 g H2/);assert.equal(all(f.host,'ch-study-example-steps')[0].children.length,2);
 assert.match(all(f.host,'ch-study-example-answer')[0].textContent,/H2 runs out first/);assert.match(all(f.host,'ch-study-example-yours')[0].textContent,/moles first/);
});
test('one card per assignment: a newer answer about the same item replaces the older one',()=>{
 const older=aid(study({headline:'Chem: old plan'}),{itemId:'55',savedAt:100}),newer=aid(study(),{itemId:'55',savedAt:200}),other=aid(example,{itemId:'77',savedAt:50});
 const cards=Band.cardsFrom({a:older,b:newer,c:other});assert.deepEqual(cards.map(c=>c.key).sort(),['b','c']);
});
