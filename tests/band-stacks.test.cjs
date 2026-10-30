'use strict';
// Help band widgets: sizes in quarters, lapped stacks (owner, 2026-10-28: "lap these cards together and let the user
// swap the card, leaving just the title"), raise-to-fit, tick to archive (with Undo), follow-up on a card.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js'),Tools=require('../extension/study-tools.js');
const {dom,storage,descendants}=require('./study-fixture.cjs');
const scope='https://school.instructure.com|7';
const ask=(headline,extra={})=>({v:1,kind:'ask',title:headline,headline,size:'s',grid:4,importance:1,points:[{text:headline+' first.',src:'Canvas'}],next:'Open it.',gaps:[],...extra});
const steps=headline=>({v:1,kind:'steps',title:'Today',headline,size:'l',importance:1,steps:[{text:'Chemistry: review',minutes:20,done:'Reviewed',src:'Canvas'},{text:'Ethics: read',minutes:30,done:'Read',src:'Canvas'},{text:'Latin: translate',minutes:40,done:'Done',src:'Canvas'}],handin:'',gaps:[]});
const aid=(data,extra={})=>({kind:data.kind,title:data.title,data,savedAt:100,progress:{},...extra});
// A five-problem worked set and a three-question practice test, as Daily AI help saves them (quarter sizes, grid:4).
const problem=(title,i)=>({title,problem:'Problem '+(i+1)+' about '+title.toLowerCase()+'.',steps:['Rule: **Set it up** Write what is known.','**Work it** Put the numbers in.','Check: **Check it** The units agree.'],answer:'Answer '+(i+1)});
const TITLES=['Writing equilibrium expressions','Calculating equilibrium constants','Reaction quotient and direction','ICE table with known concentration','ICE table with unknown equilibrium'];
const worked=(size='xl')=>({v:1,kind:'examples',title:'Equilibrium HW',headline:'Chemistry: Equilibrium HW',size,grid:4,importance:1,problems:TITLES.map(problem),gaps:[]});
const practice=(size='l')=>({v:1,kind:'test',title:'Unit 7 test',headline:'Chemistry: Unit 7 test',size,grid:4,importance:1,questions:['Rates','Orders','Half-life'].map((title,i)=>({title,q:'Question '+(i+1)+'?',answer:'Answer '+(i+1),steps:['**Step** One.','**Step** Two.']})),gaps:[]});
function band(aids,{env:extra,...options}={}){const d=dom(),host=new d.Element('div'),env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:!!options.reduced}),...extra},progress=[],asked=[],view=Band.renderBand(host,aids,{env,scope,store:UI.createStore(env),onProgress:(key,p)=>progress.push([key,p]),onAsk:async(text,extra)=>{asked.push({text,extra});return {ok:true};},...options});return {...d,host,view,env,progress,asked,find:cls=>descendants(host).filter(n=>String(n.className).split(' ').includes(cls))};}
const front=f=>f.find('ch-band-card').find(c=>c.dataset.front==='true');
const selected=f=>f.find('ch-band-lap-tab').map(t=>t.getAttribute('aria-selected'));

// ---- which cards lap ----
test('a big card with several problems laps them in order; big cards of one kind about one item lap; small and medium sit side by side',()=>{
 const set=Band.stacksFrom(Band.cardsFrom({w:aid(worked('xl'),{courseId:'5'})}));assert.equal(set.length,1);assert.equal(set[0].lapped,true);assert.equal(set[0].parts,true);assert.equal(set[0].size,'xl');
 assert.deepEqual(set[0].cards.map(c=>[c.part,c.view.title]),TITLES.map((t,i)=>[i,t]),'one card per problem, in the order they were written');
 assert.ok(set[0].cards.every(c=>c.view.problems.length===1&&c.data.problems.length===5&&c.key==='w'),'each part shows one problem; the saved card stays whole');
 const medium=Band.stacksFrom(Band.cardsFrom({w:aid(worked('m'),{courseId:'5'})}));assert.equal(medium.length,1);assert.equal(medium[0].lapped,false,'a medium set keeps its problems together');
 const big=Band.stacksFrom(Band.cardsFrom({a:aid(ask('MVC: practice 1.5',{size:'l'}),{courseId:'10',itemId:'7'}),b:aid(ask('MVC: practice 1.6',{size:'xl',importance:2}),{courseId:'10',itemId:'7'}),c:aid(steps('Chem: test prep first'))}));
 assert.deepEqual(big.map(s=>[s.kind,s.cards.length,s.size,s.lapped]),[['ask',2,'xl',true],['steps',1,'xl',false]]);assert.equal(big[0].cards[0].data.headline,'MVC: practice 1.5','most important in front');
 const small=Band.stacksFrom(Band.cardsFrom({a:aid(ask('MVC: practice 1.5'),{courseId:'10'}),b:aid(ask('MVC: practice 1.6',{size:'m'}),{courseId:'10'})}));
 assert.deepEqual(small.map(s=>[s.cards.length,s.size,s.lapped]),[[1,'s',false],[1,'m',false]],'small and medium cards of one kind fit side by side, so they never lap');
 assert.equal(Band.pack(small).length,1);
 const apart=Band.stacksFrom(Band.cardsFrom({a:aid(ask('Chem: quiz Tuesday',{size:'l'}),{courseId:'20'}),b:aid(ask('MVC: homework overdue',{size:'l'}),{courseId:'10'}),c:aid(ask('General tip',{size:'l'})),d:aid(ask('Another tip',{size:'l'}))}));
 assert.equal(apart.length,4,'other courses, or no course and no shared answer, never lap');
 const items=Band.stacksFrom(Band.cardsFrom({a:aid(ask('MVC: homework 1',{size:'l'}),{courseId:'10',itemId:'1'}),b:aid(ask('MVC: homework 2',{size:'l'}),{courseId:'10',itemId:'2'})}));
 assert.equal(items.length,2,'cards about different items of one course stay apart (review 2026-10-28)');
 const answer=Band.stacksFrom(Band.cardsFrom({x:aid(ask('Kind one',{kind:'example',size:'l'}),{runId:'q1',ask:true}),y:aid(ask('Kind two',{kind:'example',size:'l'}),{runId:'q1',ask:true})}));
 assert.deepEqual(answer.map(s=>s.cards.length),[2],'big cards of one kind from the same answer lap');
});
test('the stack takes the place of its most important card, and a stack ranks inside by importance',()=>{
 const stacks=Band.stacksFrom(Band.cardsFrom({later:aid(ask('Later',{size:'l',importance:2}),{courseId:'1',itemId:'3'}),first:aid(ask('First',{size:'l',importance:1}),{courseId:'1',itemId:'3'}),solo:aid(ask('Solo',{size:'s',importance:1}),{courseId:'2',savedAt:50})}));
 const pages=Band.pack(stacks);assert.deepEqual(pages.map(p=>p.map(s=>s.cards.map(c=>c.data.headline))),[[['First','Later'],['Solo']]]);
});

// ---- the lapped stack on the band ----
test('a lapped set is a tablist of its titles with the front card as the tabpanel; the cards behind are out of reach',async()=>{
 const f=band({w:aid(worked(),{courseId:'5',itemId:'9'})});await f.view.loaded;
 const lap=f.find('ch-band-lap')[0],list=f.find('ch-band-tabs')[0],tabs=f.find('ch-band-lap-tab'),cards=f.find('ch-band-card');
 assert.equal(lap.dataset.size,'xl');assert.equal(lap.dataset.lapped,'5');assert.equal(lap.dataset.parts,'true');
 assert.equal(list.getAttribute('role'),'tablist');assert.equal(list.getAttribute('aria-label'),'Chemistry: Equilibrium HW');assert.equal(tabs.length,5);assert.equal(cards.length,5);
 tabs.forEach((t,i)=>{assert.equal(t.getAttribute('role'),'tab');assert.equal(t.getAttribute('aria-label'),(i+1)+'. '+TITLES[i]);assert.equal(t.getAttribute('aria-controls'),cards[i].id);assert.equal(cards[i].getAttribute('role'),'tabpanel');assert.equal(cards[i].getAttribute('aria-labelledby'),t.id);
  assert.equal(t.children[0].textContent,String(i+1));assert.equal(t.children[1].textContent,TITLES[i],'the whole title, never cut in the markup');});
 assert.deepEqual(selected(f),['true','false','false','false','false']);assert.deepEqual(tabs.map(t=>t.tabIndex),[0,-1,-1,-1,-1]);
 assert.deepEqual(cards.map(c=>[c.dataset.front,c.inert,c.getAttribute('aria-hidden')]),[['true',false,'false'],...Array(4).fill(['false',true,'true'])]);
 assert.match(front(f).textContent,/Problem 1 about writing/);assert.match(front(f).textContent,/Problems · 5/,'the title line counts the whole set');
 assert.ok(cards.every(c=>c.children[0].children.some(n=>n.className==='ch-band-headline')),'every part keeps the card title line');
 const css=fs.readFileSync('extension/study-band.css','utf8');
 assert.match(css,/\.ch-band-deck\{[^}]*display:grid;grid-template:minmax\(0,auto\)\/minmax\(0,1fr\)\}/,'the deck is as tall as its tallest card');assert.match(css,/\.ch-band-deck>\.ch-band-card\{grid-area:1\/1;position:relative;inset:auto;min-height:0\}/,'every card in one cell, the front one in flow');assert.doesNotMatch(css,/\.ch-band-deck>\.ch-band-card\{position:absolute/,'no card leaves the flow (a 0 px deck, review 2026-10-28)');assert.match(css,/\.ch-band-deck>\.ch-band-card\[data-front=false\]\{visibility:hidden;pointer-events:none\}/,'the cards behind never cover the front card');
 assert.match(css,/\.ch-band-lap-t\{[^}]*-webkit-line-clamp:2;[^}]*white-space:normal/,'a long title wraps to two lines in its tab');assert.doesNotMatch(css,/\.ch-band-lap-t\{[^}]*text-overflow:ellipsis/,'never an ellipsis');
});
test('a tab, the arrow keys, Home and End, and Previous card / Next card bring a card to the front',async()=>{
 const f=band({w:aid(worked(),{courseId:'5'})});await f.view.loaded;let tabs=f.find('ch-band-lap-tab');
 tabs[2].fire('click');assert.deepEqual(selected(f),['false','false','true','false','false']);assert.match(front(f).textContent,/Problem 3 about reaction/);
 tabs[2].fire('keydown',{key:'ArrowRight'});assert.equal(f.document.activeElement,tabs[3],'focus follows the card in front');assert.deepEqual(selected(f),['false','false','false','true','false']);
 tabs[3].fire('keydown',{key:'End'});assert.equal(selected(f)[4],'true');tabs[4].fire('keydown',{key:'ArrowRight'});assert.equal(selected(f)[0],'true','the arrows go round');
 tabs[0].fire('keydown',{key:'ArrowLeft'});assert.equal(selected(f)[4],'true');tabs[4].fire('keydown',{key:'Home'});assert.equal(selected(f)[0],'true');
 tabs[0].fire('keydown',{key:'Enter'});assert.equal(selected(f)[0],'true','other keys leave the stack alone');
 const next=descendants(f.host).find(n=>n.tagName==='BUTTON'&&n.textContent==='Next card'),prev=descendants(f.host).find(n=>n.tagName==='BUTTON'&&n.textContent==='Previous card');
 next.fire('click');assert.equal(selected(f)[1],'true');prev.fire('click');prev.fire('click');assert.equal(selected(f)[4],'true');
 // The front card stays in front through a redraw (a new answer arriving, say) and a page flip back.
 f.view.update({w:aid(worked(),{courseId:'5'}),o:aid(ask('Other',{size:'s'}))});assert.equal(selected(f)[4],'true');tabs=f.find('ch-band-lap-tab');assert.match(front(f).textContent,/Problem 5/);
});
test('a swipe or drag turns the stack, a short one settles back; a touchpad swipe turns it once',async()=>{
 const f=band({w:aid(worked(),{courseId:'5'})});await f.view.loaded;const lap=f.find('ch-band-lap')[0];
 const on=(inside='')=>({closest:sel=>sel.split(',').some(s=>s.trim()===inside)?{}:null});
 const pointer=(type,x,extra={})=>lap.fire(type,{pointerId:1,isPrimary:true,button:0,pointerType:'touch',clientX:x,clientY:10,timeStamp:extra.t??0,target:on(),...extra});
 pointer('pointerdown',300);pointer('pointermove',280,{t:40});pointer('pointermove',220,{t:80});pointer('pointerup',220,{t:120});assert.equal(selected(f)[1],'true','dragged left: the next card');
 pointer('pointerdown',100);pointer('pointermove',130,{t:40});pointer('pointerup',140,{t:400});assert.equal(selected(f)[1],'true','a short slow drag settles back');
 pointer('pointerdown',100);pointer('pointermove',140,{t:20});pointer('pointerup',190,{t:60});assert.equal(selected(f)[0],'true','a fling right: the card before');
 pointer('pointerdown',100,{pointerType:'mouse',target:on()});pointer('pointermove',20,{t:20,pointerType:'mouse'});pointer('pointerup',20,{t:60,pointerType:'mouse'});assert.equal(selected(f)[0],'true','a mouse drag on the content leaves it to select text');
 pointer('pointerdown',100,{pointerType:'mouse',target:on('.ch-band-lap-bar')});pointer('pointermove',20,{t:20,pointerType:'mouse'});pointer('pointerup',20,{t:60,pointerType:'mouse'});assert.equal(selected(f)[1],'true','a mouse drag on the tabs turns it');
 pointer('pointerdown',100,{target:on('input')});pointer('pointermove',0,{t:20});pointer('pointerup',0,{t:40});assert.equal(selected(f)[1],'true','typing fields keep their gestures');
 const wheel=(x,t)=>lap.fire('wheel',{deltaX:x,deltaY:0,timeStamp:t,target:on()});
 wheel(40,1000);wheel(40,1016);assert.equal(selected(f)[2],'true');wheel(40,1032);wheel(40,1048);wheel(40,1300);assert.equal(selected(f)[2],'true','the rest of that swipe and its momentum are let go');
 wheel(70,1600);assert.equal(selected(f)[3],'true','a new swipe after a pause turns again');
 lap.fire('wheel',{deltaX:5,deltaY:80,timeStamp:2400,target:on()});assert.equal(selected(f)[3],'true','scrolling up and down is left alone');
});
test('what a part reveals is kept under its place in the set; Check my work and Done act on the whole card',async()=>{
 const a=aid(practice(),{courseId:'5',itemId:'31',prepare:true}),f=band({p:a});await f.view.loaded;f.find('ch-band-lap-tab')[1].fire('click');
 const show=descendants(front(f)).find(n=>n.tagName==='BUTTON'&&n.textContent==='Answer');assert.equal(show.getAttribute('aria-label'),'Show answer 2','named by its place in the set');show.fire('click');
 assert.deepEqual(f.progress.at(-1),['p',{revealed:{'question:1':true}}]);assert.match(front(f).textContent,/Answer 2/);
 f.view.update({p:a});f.find('ch-band-lap-tab')[0].fire('click');const first=descendants(front(f)).find(n=>n.className==='ch-study-quiz-answer');assert.equal(first.hidden,true,'question 1 is still folded');
 f.find('ch-band-lap-tab')[1].fire('click');assert.equal(descendants(front(f)).find(n=>n.className==='ch-study-quiz-answer').hidden,false,'question 2 stays revealed after a redraw');
 descendants(front(f)).find(n=>n.dataset?.act==='check').fire('click');const input=f.find('ch-band-drawer-input')[0];assert.ok(input,'the drawer opens on the front card');assert.equal(f.find('ch-band-numbers').length,0,'no number chips: the part is the number');
 input.value='6.93 s';input.fire('keydown',{key:'Enter',preventDefault(){},stopPropagation(){}});await new Promise(r=>setImmediate(r));assert.match(f.asked.at(-1).text,/^Check my work on number 2: 6\.93 s/);assert.match(f.asked.at(-1).extra.card.text,/Question 2\?/);assert.ok(!/Question 1\?/.test(f.asked.at(-1).extra.card.text),'the question asked about is the one in front');
 descendants(front(f)).find(n=>n.dataset?.act==='done').fire('click');assert.deepEqual(f.progress.at(-1),['p',{revealed:{'question:1':true},archived:true}],'Done ticks the whole set');
});
test('a stack swap animates the front card in and the old one out; parts of one card move only their content; reduced motion is instant',async()=>{
 const make=(reduced,aids)=>{const calls=[],d=dom(),proto=d.Element.prototype;proto.animate=function(frames,timing){calls.push({cls:this.className,frames,timing});return {finished:Promise.resolve(),cancel(){}};};proto.getAnimations=()=>[];proto.getBoundingClientRect=()=>({left:0,top:0,width:100,height:20});Object.defineProperty(proto,'isConnected',{get:()=>true,configurable:true});
  const host=new d.Element('div'),env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:reduced}),getComputedStyle:()=>({transform:'none',opacity:'1'})},view=Band.renderBand(host,aids,{env,scope,store:UI.createStore(env)});return {calls,host,view,tabs:()=>descendants(host).filter(n=>n.className==='ch-band-lap-tab')};};
 const onlyCompositor=list=>list.every(c=>c.frames.every(k=>Object.keys(k).every(p=>['transform','opacity','offset'].includes(p))));
 const parts=make(false,{w:aid(worked(),{courseId:'5'})});await parts.view.loaded;parts.calls.length=0;parts.tabs()[1].fire('click');
 const bodies=parts.calls.filter(c=>c.cls==='ch-band-body');assert.equal(parts.calls.length,4);assert.equal(bodies.length,4,'the content leaves and arrives (a move and a fade each); the title strip the parts share stays');
 assert.ok(bodies.every(c=>c.timing.duration>=100&&c.timing.duration<=320),bodies.map(c=>c.timing.duration).join());assert.ok(onlyCompositor(bodies),'transform and opacity only');
 const fades=bodies.filter(c=>c.frames.some(k=>'opacity' in k));assert.ok(fades.some(c=>c.timing.duration<=120&&!c.timing.delay),'the leaving layer clears fast');assert.ok(fades.some(c=>c.timing.delay>=50),'the arriving layer shows after it');
 assert.ok(bodies.filter(c=>c.frames.some(k=>'transform' in k)).every(c=>!c.timing.delay),'both start moving on the first frame');
 const cards=make(false,{c:aid(ask('Second card',{size:'l'}),{courseId:'6',runId:'r4'}),e:aid(ask('Third card',{size:'l'}),{courseId:'6',runId:'r4',savedAt:90})});await cards.view.loaded;cards.calls.length=0;cards.tabs()[1].fire('click');
 assert.equal(cards.calls.length,4);assert.ok(cards.calls.every(c=>String(c.cls).startsWith('ch-band-card')),'cards lapped together move as whole cards');assert.ok(onlyCompositor(cards.calls));
 cards.calls.length=0;cards.tabs()[0].fire('click');cards.tabs()[1].fire('click');assert.equal(cards.calls.length,8,'a new choice mid-slide starts from where the cards are');
 const still=make(true,{w:aid(worked(),{courseId:'5'})});await still.view.loaded;still.calls.length=0;still.tabs()[3].fire('click');assert.equal(still.calls.length,0,'reduced motion: instant');assert.equal(still.view.element.dataset.reducedMotion,'true');
 const css=fs.readFileSync('extension/study-band.css','utf8');assert.match(css,/prefers-reduced-motion:reduce\)\{\.ch-help-band :is\(\.ch-band-lap-tab/);assert.match(css,/\.ch-band-lap-tab\{[^}]*transition:translate [^}]*\}/,'the tabs rise and settle on translate, not layout');
});
test('tabs keep their order: titles that cannot share one row wrap onto the next, and choosing a tab never moves it',async()=>{
 const f=band({w:aid(worked(),{courseId:'5'})});await f.view.loaded;const style=()=>({setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}});
 const lap=f.find('ch-band-lap')[0],list=f.find('ch-band-tabs')[0],tabs=f.find('ch-band-lap-tab');lap.style=style();list.style=style();for(const t of tabs){t.style=style();t.children[0].scrollWidth=8;t.children[1].scrollWidth=190;}
 list.clientWidth=1500;f.view.measure();assert.equal(list.dataset.rows,undefined,'wide: one row');
 list.clientWidth=720;f.view.measure();assert.equal(list.dataset.rows,'2','three tabs fit a row, the other two wrap');assert.deepEqual(list.children.map(t=>t.dataset.lapTab),tabs.map(t=>t.dataset.lapTab),'1 to 5 in order');assert.ok(tabs.every(t=>!t.style.gridRow&&!t.style.zIndex),'no row is moved');
 tabs[4].fire('click');assert.deepEqual(list.children.map(t=>t.dataset.lapTab),tabs.map(t=>t.dataset.lapTab),'the tab clicked stays where it was');assert.equal(list.dataset.rows,'2');
 list.clientWidth=200;f.view.measure();assert.equal(list.dataset.rows,'5','a narrow band wraps each tab; no title is cut and there is no row limit');
 const css=fs.readFileSync('extension/study-band.css','utf8');assert.match(css,/\.ch-band-tabs\{[^}]*display:flex;flex-wrap:wrap/);
});

// ---- raise to fit ----
test('a card whose content does not fit takes the next size up while that helps, up to the whole band; past that it keeps Show all',async()=>{
 // The fixture has no layout: a card's content height is given per size, as a wider card would wrap it.
 const tall=(f,headline,table)=>{const s=descendants(f.find('ch-band-card').find(c=>c.textContent.includes(headline))).find(n=>n.className==='ch-band-scroll');Object.defineProperty(s,'scrollHeight',{get:()=>table[s.parentNode?.parentNode?.dataset?.size]??table.s,configurable:true});s.clientHeight=150;return s;};
 // A full page: a raise would push cards to another page, so the card keeps its size and Show all (review 2026-10-28).
 const full=band({a:aid(ask('Long answer')),b:aid(ask('Short',{importance:2})),c:aid(ask('Also short',{importance:2}),{savedAt:90}),d:aid(ask('Third short',{importance:2}),{savedAt:80})});await full.view.loaded;
 full.find('ch-band-page')[0].clientWidth=1200;tall(full,'Long answer',{s:420,m:300,l:150,xl:150});full.view.measure();
 assert.deepEqual(full.view.pages.map(p=>p.map(s=>s.cards[0].data.headline+':'+s.size)),[['Long answer:s','Short:s','Also short:s','Third short:s']],'nobody is pushed to page 2');
 assert.equal(full.find('ch-band-card').find(c=>c.textContent.includes('Long answer')).dataset.overflow,'true','it shows Show all instead');
 const f=band({a:aid(ask('Long answer')),b:aid(ask('Short',{importance:2}))});await f.view.loaded;
 const view=f.find('ch-band-page')[0];assert.deepEqual(f.view.pages.map(p=>p.map(s=>s.size)),[['s','s']]);
 view.clientWidth=1200;const heights={s:420,m:300,l:150,xl:150};tall(f,'Long answer',heights);f.view.measure();
 assert.deepEqual(f.view.pages.map(p=>p.map(s=>s.cards[0].data.headline+':'+s.size)),[['Long answer:l','Short:s']],'s to m to l, into the room the page has');
 assert.equal(f.find('ch-band-card').find(c=>c.textContent.includes('Long answer')).dataset.overflow,'false');
 heights.l=420;f.view.measure();assert.equal(f.view.pages[0][0].size,'l','what the student opens inside a card later never moves the page');assert.equal(f.find('ch-band-card').find(c=>c.textContent.includes('Long answer')).dataset.overflow,'true','it shows Show all instead');
 // Content as tall at any width (a list of short lines): the raise is taken back and Show all stays.
 const alone=band({x:aid(ask('Alone'))});await alone.view.loaded;const page=alone.find('ch-band-page')[0];page.clientWidth=1200;assert.equal(alone.find('ch-band-card')[0].dataset.fill,'2','a small card alone widens to half, never across the band');
 tall(alone,'Alone',{s:500,m:500,l:500,xl:500});alone.view.measure();assert.equal(alone.view.pages[0][0].size,'s','tried a size up, no better, so back to its own size');
 const card=alone.find('ch-band-card')[0];assert.equal(card.dataset.overflow,'true');assert.equal(descendants(card).find(n=>n.className==='ch-band-more').hidden,false,'Show all stays');
 alone.view.measure();assert.equal(alone.view.pages[0][0].size,'s','it is not tried again at this width');
 const xl=band({x:aid(ask('Whole band',{size:'xl'}))});await xl.view.loaded;xl.find('ch-band-page')[0].clientWidth=1200;tall(xl,'Whole band',{xl:500});xl.view.measure();assert.equal(xl.view.pages[0][0].size,'xl');assert.equal(descendants(xl.find('ch-band-card')[0]).find(n=>n.className==='ch-band-more').hidden,false,'an xl card that overflows keeps Show all');
 // Raises hold while the band is about as wide as when measured; a much wider band measures again.
 const g=band({a:aid(ask('Grows')),b:aid(ask('One',{importance:2}))});await g.view.loaded;const gp=g.find('ch-band-page')[0];gp.clientWidth=1200;tall(g,'Grows',{s:300,m:150,l:150,xl:150});g.view.measure();assert.equal(g.view.pages[0][0].size,'m');
 gp.clientWidth=1260;g.view.measure();assert.equal(g.view.pages[0][0].size,'m','a little wider keeps it');gp.clientWidth=1700;g.view.measure();assert.equal(g.view.pages[0][0].size,'m','much wider measures again and raises again while it does not fit');
 // A quarter under 280 px is too narrow to read: small cards take half (review 2026-10-28).
 const n=band({a:aid(ask('One')),b:aid(ask('Two',{importance:2})),c:aid(ask('Three',{importance:2}),{savedAt:90})});await n.view.loaded;n.find('ch-band-page')[0].clientWidth=1000;n.view.measure();
 assert.deepEqual(n.view.pages.map(p=>p.map(s=>s.size)),[['m','m'],['m']]);n.find('ch-band-page')[0].clientWidth=1600;n.view.measure();assert.deepEqual(n.view.pages.map(p=>p.map(s=>s.size)),[['s','s','s']],'s + s + s stays on one page when wide');
});
test('a large stack whose titles would need more rows of tabs takes the whole band',async()=>{
 const f=band({p:aid(practice('l'),{courseId:'5'})});await f.view.loaded;f.find('ch-band-page')[0].clientWidth=1000;assert.equal(f.view.pages[0][0].size,'l');
 const list=f.find('ch-band-tabs')[0];list.clientWidth=300;for(const t of f.find('ch-band-lap-tab')){t.children[0].scrollWidth=8;t.children[1].scrollWidth=150;}
 f.view.measure();assert.equal(f.view.pages[0][0].size,'xl');
});
test('a card keeps its content through a page flip, a drawer and a redraw, and builds it again when what it shows changes',async()=>{
 const f=band({a:aid(ask('First',{size:'l'})),b:aid(ask('Second',{size:'l',importance:2}))});await f.view.loaded;
 const scrollOf=h=>descendants(f.find('ch-band-card').find(c=>c.textContent.includes(h))).find(n=>n.className==='ch-band-scroll');
 const first=scrollOf('First');f.view.flip(1);assert.ok(scrollOf('Second'));f.view.flip(0);assert.equal(scrollOf('First'),first,'the same content comes back');
 descendants(f.host).find(n=>n.dataset?.act==='ask').fire('click');assert.equal(f.find('ch-band-card')[0].dataset.drawer,'ask');assert.equal(scrollOf('First'),first,'opening a drawer keeps it');
 const set={p:aid(practice(),{courseId:'5'})},g=band(set);await g.view.loaded;const front=()=>g.find('ch-band-card').find(c=>c.dataset.front==='true'),scroll=()=>descendants(front()).find(n=>n.className==='ch-band-scroll');
 const before=scroll();descendants(front()).find(n=>n.tagName==='BUTTON'&&n.textContent==='Answer').fire('click');g.view.update(set);assert.equal(scroll(),before,'what the student revealed is already on screen');
 g.view.update({p:aid(practice(),{courseId:'5'})});assert.notEqual(scroll(),before,'a new copy of the card is built again');
});
test('the pages beside the one shown are built ahead when the browser is idle',async()=>{
 const calls=[],real=UI.renderViewer;UI.renderViewer=function(...args){calls.push(args[1].data.headline);return real.apply(this,args);};
 try{const env={setTimeout:(fn)=>setTimeout(fn,0),clearTimeout,requestIdleCallback:fn=>setTimeout(()=>fn({timeRemaining:()=>40}),0)};
  const f=band({a:aid(ask('Page one',{size:'xl'})),b:aid(ask('Page two',{size:'xl',importance:2})),c:aid(ask('Page three',{size:'xl',importance:3}))},{env});await f.view.loaded;
  assert.ok(!calls.includes('Page two'));await new Promise(r=>setTimeout(r,20));assert.equal(calls.filter(h=>h==='Page two').length,1,'page 2 is built ahead');assert.ok(!calls.includes('Page three'),'only the pages beside');
  f.view.flip(1);assert.equal(calls.filter(h=>h==='Page two').length,1,'turning to it builds nothing');f.view.destroy();}
 finally{UI.renderViewer=real;}
});

// ---- ticks, follow-ups ----
test('the tick archives a card, saves it, and Undo brings it back',async()=>{
 const aids={a:aid(ask('Chem: quiz Tuesday')),c:aid(steps('Chem: test prep first'))},f=band(aids);await f.view.loaded;
 const card=f.find('ch-band-card').find(c=>/quiz Tuesday/.test(c.textContent)),tick=descendants(card).find(n=>n.dataset?.act==='done');tick.fire('click');
 assert.deepEqual(f.progress.at(-1),['a',{archived:true}]);assert.ok(!f.find('ch-band-card').some(c=>/quiz Tuesday/.test(c.textContent)&&c.dataset.done!=='true'));assert.equal(f.find('ch-band-status')[0].textContent,'Archived');
 const undo=f.find('ch-band-undo')[0];assert.equal(undo.hidden,false);undo.fire('click');assert.deepEqual(f.progress.at(-1),['a',{}]);assert.ok(f.find('ch-band-card').some(c=>/quiz Tuesday/.test(c.textContent)));
 assert.equal(Band.cardsFrom({x:aid(ask('gone'),{progress:{archived:true}})}).length,0,'archived aids stay out after reload');
});
test('Ask on a card carries that card and the card\'s item',async()=>{
 const f=band({a:aid(ask('Chem: kinetics test tomorrow'),{itemId:'96580',courseId:'7108',item:'Unit 1b Test-Kinetics',prepare:true})});await f.view.loaded;
 descendants(f.host).find(n=>n.dataset?.act==='ask').fire('click');assert.equal(f.find('ch-band-card')[0].dataset.drawer,'ask');
 const input=f.find('ch-band-drawer-input')[0];assert.equal(input.placeholder,'Ask about this card');input.value='What topics should I review?';input.fire('keydown',{key:'Enter',preventDefault(){},stopPropagation(){}});await new Promise(r=>setImmediate(r));
 assert.equal(f.asked.length,1);const {text,extra}=f.asked[0];assert.equal(text,'What topics should I review?');assert.equal(extra.itemId,'96580');assert.equal(extra.courseId,'7108');assert.match(extra.card.text,/Chem: kinetics test tomorrow/);assert.equal(extra.card.headline,'Chem: kinetics test tomorrow');
 assert.equal(f.find('ch-band-drawer').length,0,'the drawer folds after sending');
});
test('a Practice set button on a Prepare card becomes a question for the engine, not the old panel',async()=>{
 const data=ask('Chem: kinetics test tomorrow',{tools:[{id:Tools.IDS.practice,args:{action:'practice',itemId:'96580',courseId:'7108'},label:'Practice set'}]}),tools=[];
 const f=band({a:aid(data,{itemId:'96580',courseId:'7108',item:'Unit 1b Test-Kinetics',prepare:true})},{onTool:async tool=>{tools.push(tool);return {ok:true};}});await f.view.loaded;
 const chip=f.find('ch-band-tool').find(n=>n.textContent==='Practice set');assert.ok(chip);chip.fire('click');await new Promise(r=>setImmediate(r));
 assert.equal(tools.length,0);assert.equal(f.asked.length,1);assert.match(f.asked[0].text,/practice set for Unit 1b Test-Kinetics/i);assert.equal(f.asked[0].extra.itemId,'96580');
});
test('card text for follow-ups keeps the useful words and leaves out tools and sources',()=>{
 const text=Band.cardText({kind:'practice',headline:'Chem: quiz practice',items:[{q:'Which change speeds up reactions?',answer:1,why:'Faster collisions.',src:'Canvas'}],tools:[{label:'Open'}]});
 assert.match(text,/Chem: quiz practice/);assert.match(text,/Which change speeds up reactions\?/);assert.match(text,/Faster collisions/);assert.ok(!/Canvas|Open/.test(text));
});
