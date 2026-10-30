'use strict';
// Owner, 2026-10-26: "The ask button should be card specific where user ask about the card". A question asked on a
// card carries the card's key; the answer is saved about that card and shows inside it, never hiding it.
const {test}=require('node:test'),assert=require('node:assert/strict');
const Band=require('../extension/study-band.js');
const help=(key,itemId,savedAt,extra={})=>[key,{v:1,kind:'examples',itemId,courseId:'7',title:'Homework #7',item:'Homework #7',savedAt,data:{kind:'examples',title:'Homework #7',headline:'Calculus: Homework #7',size:'l',importance:1,problems:[{type:'Vectors',problem:'p',steps:['a','b'],answer:'x'}],gaps:[]},progress:{},prepare:true,...extra}];
const answer=(key,about,itemId,savedAt,question)=>[key,{v:1,kind:'ask',itemId,courseId:'7',title:'Why?',item:'Homework #7',savedAt,data:{kind:'ask',title:'Why?',headline:'Why?',size:'s',importance:2,points:[{text:'Because the determinant is multiplicative.',src:'Canvas'}],next:'',gaps:[]},progress:{},prepare:true,ask:true,question,...(about?{about}:{})}];

test('an answer asked on a card sits inside that card, oldest first, and never hides the card for its item',()=>{
 const aids=Object.fromEntries([help('prepare:run-a:0','12',1000),answer('ask:run-q2:0','prepare:run-a:0','12',3000,'And for 3×3?'),answer('ask:run-q1:0','prepare:run-a:0','12',2000,'Why is det(AB) = det A · det B?')]);
 const cards=Band.cardsFrom(aids);
 assert.deepEqual(cards.map(c=>c.key),['prepare:run-a:0'],'one card; the answers are inside it');
 assert.deepEqual(cards[0].answers.map(a=>a.aid.question),['Why is det(AB) = det A · det B?','And for 3×3?']);
});

test('an answer whose card is gone (archived or replaced) shows on its own; a question asked without a card is its own card as before',()=>{
 const gone=Band.cardsFrom(Object.fromEntries([help('prepare:run-a:0','12',1000,{progress:{archived:true}}),answer('ask:run-q1:0','prepare:run-a:0','12',2000,'Why?')]));
 assert.deepEqual(gone.map(c=>c.key),['ask:run-q1:0']);
 const loose=Band.cardsFrom(Object.fromEntries([help('prepare:run-a:0','12',1000),answer('ask:run-q1:0','','99',2000,'What is due?')]));
 assert.deepEqual(loose.map(c=>c.key).sort(),['ask:run-q1:0','prepare:run-a:0']);
});

test('the answers render folded at the top of their card: the question shows, tapping it opens the answer',()=>{
 const UI=require('../extension/study-ui.js'),{dom,storage,descendants}=require('./study-fixture.cjs'),d=dom(),host=new d.Element('div'),env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:false})};
 const all=(root,cls)=>descendants(root).filter(n=>String(n.className||'').split(' ').includes(cls)),text=n=>descendants(n).filter(x=>typeof x.textContent==='string'&&!x.children?.length).map(x=>x.textContent).join(' ');
 const aids=Object.fromEntries([help('prepare:run-a:0','12',1000),answer('ask:run-q1:0','prepare:run-a:0','12',2000,'Why is det(AB) = det A · det B?')]);
 const view=Band.renderBand(host,aids,{env,scope:'https://school.instructure.com|7',store:UI.createStore(env)});
 const card=all(host,'ch-band-card')[0],qa=all(card,'ch-band-answers')[0];
 assert.ok(qa,'the questions sit in the card');assert.equal(all(qa,'ch-study-count')[0].textContent,'Your questions · 1');
 const row=all(qa,'ch-study-row')[0],body=all(qa,'ch-study-row-body')[0];assert.equal(text(row),'Why is det(AB) = det A · det B?');assert.equal(row.getAttribute('aria-expanded'),'false');assert.equal(body.hidden,true);
 row.fire('click');assert.equal(row.getAttribute('aria-expanded'),'true');assert.equal(body.hidden,false);assert.match(text(body),/determinant is multiplicative/);
 row.fire('click');assert.equal(body.hidden,true,'tapping again folds it');
 view.destroy();
});

test('Ask on a card sends the card\'s key; CH keeps it on the run and saves the answer about that card',async()=>{
 const fs=require('fs'),src=fs.readFileSync(require.resolve('../extension/dashboard.js'),'utf8'),prep=fs.readFileSync(require.resolve('../extension/ai-prepare.js'),'utf8');
 assert.match(src,/cardKey:String\(extra\.card\.key\)/);assert.match(prep,/\{cardKey:message\.cardKey\}/);
 const Results=require('../extension/ai-results.js');let saved=null;
 const results=Results.create({external:{get:async()=>({}),set:async(key,map)=>{saved=map;}},now:()=>5000});
 await results.saveCards({id:'run-ask-1',scope:'https://school.instructure.com|9',question:'Why?',cardKey:'prepare:run-a:0',settings:{}},[{kind:'ask',title:'Why?',headline:'Why?',points:[{text:'Because.',src:'Canvas'}],gaps:[]}],{},{ask:true});
 const aid=Object.values(saved)[0];assert.equal(aid.about,'prepare:run-a:0');assert.equal(aid.question,'Why?');
});

// Owner picked A, 2026-10-27: the line under a card's title (count, minutes, what is missing) sits in the title line.
test('a card\'s count and missing-material note sit in its title line, between the title and the actions',()=>{
 const UI=require('../extension/study-ui.js'),{dom,storage,descendants}=require('./study-fixture.cjs'),d=dom(),host=new d.Element('div'),env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:false})};
 const all=(root,cls)=>descendants(root).filter(n=>String(n.className||'').split(' ').includes(cls));
 const [key,aid]=help('prepare:run-a:0','12',1000);aid.data.gaps=['The textbook section is not on Canvas.'];
 Band.renderBand(host,{[key]:aid},{env,scope:'https://school.instructure.com|7',store:UI.createStore(env),onAsk:async()=>true});
 const head=all(host,'ch-band-head')[0],kids=head.children.map(n=>String(n.className).split(' ')[0]);
 assert.deepEqual(kids,['ch-band-when','ch-band-headline','ch-study-meta','ch-band-acts']);
 const meta=head.children[2];assert.equal(all(meta,'ch-study-count').length,0,'one problem: no count pill (it says nothing)');assert.equal(all(meta,'ch-study-gap-note')[0].textContent,'The textbook section is not on Canvas.');
});
