'use strict';
// How a Help card presents the AI's text (owner, 2026-10-28): maths as MathML, steps as an outline with drawn marks,
// key terms on a wash, the answer first and set apart, More steps for long solutions, line numbers that never touch
// the text. Presentation only: the AI's words are never rewritten.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const UI=require('../extension/study-ui.js'),M=require('../extension/math-render.js');
const {dom,descendants}=require('./study-fixture.cjs');
const css=fs.readFileSync(path.join(__dirname,'../extension/study-band.css'),'utf8');
const all=(root,cls)=>descendants(root).filter(n=>String(n.className||'').split(' ').includes(cls));
// A page that can build MathML and inline styles (the shared test DOM can do neither, which is the fallback case).
function page({mathml=true}={}){
 const d=dom(),make=d.document.createElement;
 d.document.createElement=tag=>{const n=make(tag);n.style={props:{},setProperty(k,v){this.props[k]=String(v);}};return n;};
 if(mathml)d.document.createElementNS=(ns,tag)=>{const n=new d.Element(tag);n.namespaceURI=ns;return n;};
 return d;}
function card(kind,data,options={}){const d=page(options),host=new d.Element('div');UI.renderViewer(host,{kind,title:data.title||'Card',data:{v:1,kind,gaps:[],...data},progress:{}},{env:{document:d.document},embedded:true});return host;}
const maths=root=>descendants(root).filter(n=>n.tagName==='MATH');

const equilibrium={title:'Equilibrium',problems:[
 {title:'Writing equilibrium expressions',problem:'Write $K_c$ for $$\\ce{2SO2(g) + O2(g) <=> 2SO3(g)}$$',steps:[
  'Rule: **Products over reactants** Each **concentration** is raised to its coefficient.',
  '**Write the powers** $$K_c = \\frac{[\\mathrm{SO_3}]^2}{[\\mathrm{SO_2}]^2[\\mathrm{O_2}]}$$',
  'Watch: **Leave out solids** Pure solids and liquids never appear.',
  '**Count the coefficients** The powers are $2$, $2$ and $1$.',
  'Check: **Match the equation** Every power equals its coefficient.'],answer:'Answer: $K_c = \\frac{[\\mathrm{SO_3}]^2}{[\\mathrm{SO_2}]^2[\\mathrm{O_2}]}$'},
 {title:'Matrix products',problem:'Find $AB$.',steps:['**Row by column** Multiply each row of $A$ by each column of $B$.','**Add the products** $2 \\cdot 0 + 1 \\cdot 1 = 1$'],answer:'$$AB = \\begin{bmatrix} 1 & 6 \\\\ 3 & -10 \\end{bmatrix}$$'}]};

test('maths in a step, a problem and an answer is MathML; a folded row keeps its maths in the line',()=>{
 const host=card('examples',equilibrium),ex=all(host,'ch-study-example');
 const steps=all(ex[0],'ch-study-example-steps')[0],second=steps.children[1];
 const block=all(second,'ch-math-block')[0];assert.ok(block,'a display formula in a step has its own centred block');
 const math=maths(block)[0];assert.equal(math.namespaceURI,M.NS);assert.equal(math.getAttribute('display'),'block');assert.match(math.getAttribute('aria-label'),/K_c|Kc|K/);
 const head=descendants(ex[0]).find(n=>n.tagName==='BUTTON'&&String(n.className).includes('ch-study-row'));
 assert.equal(all(head,'ch-math-block').length,0,'a row head never holds a display block (it would break the two-line clamp)');assert.equal(maths(head).length,2);
 const matrix=all(ex[1],'ch-study-example-answer')[0];assert.ok(all(matrix,'ch-math-block').length,'a matrix answer is a centred block');
 assert.ok(descendants(matrix).some(n=>n.tagName==='MTABLE'),'the matrix is an mtable');
 assert.match(css,/\.ch-study-aid \.ch-math-block\{display:block;max-width:100%;[^}]*overflow-x:auto;overflow-y:hidden;text-align:center/,'wide maths scrolls inside its block, never the card');
});
test('steps are an outline: number, drawn mark with a name, the lead and the lighter detail; the answer comes first',()=>{
 const host=card('examples',equilibrium),ex=all(host,'ch-study-example')[0],body=all(ex,'ch-study-row-body')[0];
 assert.equal(body.children[0].className,'ch-study-example-answer ch-result','the result is first in the open problem');
 const answerMark=all(body.children[0],'ch-mark')[0];assert.equal(answerMark.dataset.mark,'answer');assert.equal(answerMark.getAttribute('role'),'img');assert.equal(answerMark.getAttribute('aria-label'),'Answer');
 assert.doesNotMatch(body.children[0].textContent,/Answer:/,'the Answer: tag is drawn, not printed');
 const [rule,two,watch]=all(ex,'ch-study-example-steps')[0].children;
 assert.equal(rule.dataset.mark,'rule');assert.equal(all(rule,'ch-mark')[0].getAttribute('aria-label'),'Rule');
 assert.equal(all(rule,'ch-step-lead')[0].textContent,'Products over reactants');
 assert.equal(all(rule,'ch-step-detail')[0].textContent,'Each concentration is raised to its coefficient.');
 assert.equal(all(rule,'ch-term')[0].textContent,'concentration','a later bold word is a key term');
 assert.equal(watch.dataset.mark,'watch');assert.equal(all(watch,'ch-mark')[0].getAttribute('aria-label'),'Watch out');
 assert.equal(two.dataset.mark,undefined);assert.equal(all(two,'ch-step-lead')[0].textContent,'Write the powers');
 assert.match(css,/ol\.ch-steps>li\.ch-step\{[^}]*display:grid;grid-template-columns:1\.25em 15px minmax\(0,1fr\)/,'number, mark and text each have a column');
 assert.equal(rule.children[0].className,'ch-mark','the mark sits in its own column, not inside the lead');assert.equal(two.children[0].className,'ch-mark-slot','a step without a mark keeps the slot, so every lead starts on one edge');
 assert.match(css,/ol\.ch-steps>li\.ch-step>:is\(\.ch-mark,\.ch-mark-slot\)\{grid-column:2;/);
 assert.match(css,/\.ch-step-detail\{display:block;[^}]*color:var\(--rd-muted/,'the detail is lighter, under the lead');
});
test('five steps or more show three and a More steps button that opens the rest in place and closes it again',()=>{
 const host=card('examples',equilibrium),ex=all(host,'ch-study-example')[0];
 assert.equal(all(ex,'ch-study-example-steps')[0].children.length,3);
 const rest=all(ex,'ch-steps-rest')[0],inner=rest.children[0],list=all(rest,'ch-steps-rest-list')[0],more=all(ex,'ch-steps-more')[0];
 assert.equal(list.children.length,2);assert.equal(list.getAttribute('start'),'4','screen readers count on from 4');
 assert.equal(rest.dataset.open,'false');assert.equal(inner.inert,true);assert.equal(more.tagName,'BUTTON');assert.equal(more.type,'button');
 assert.equal(more.getAttribute('aria-expanded'),'false');assert.equal(more.getAttribute('aria-controls'),rest.id);assert.equal(more.textContent,'More steps');
 more.fire('click');assert.equal(rest.dataset.open,'true');assert.equal(inner.inert,false);assert.equal(more.getAttribute('aria-expanded'),'true');assert.equal(more.textContent,'Fewer steps');
 more.fire('click');assert.equal(rest.dataset.open,'false');assert.equal(inner.inert,true);assert.equal(more.textContent,'More steps');
 const short=card('examples',{...equilibrium,problems:[equilibrium.problems[1],equilibrium.problems[1]]});assert.equal(all(short,'ch-steps-more').length,0,'two steps need no button');
 // The rest opens by grid rows (0fr to 1fr): no height is animated frame by frame and nothing jumps.
 assert.match(css,/\.ch-steps-rest\{display:grid;grid-template-rows:0fr;transition:grid-template-rows/);assert.match(css,/\.ch-steps-rest\[data-open=true\]\{grid-template-rows:1fr\}/);
});
test('previews clamp: a folded problem or question shows two lines; the only problem on a card shows in full',()=>{
 assert.match(css,/\.ch-study-row>span\{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden\}/);
 assert.match(css,/\.ch-study-example-problem\{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden\}/);
 const host=card('examples',{...equilibrium,problems:[equilibrium.problems[0]]}),ex=all(host,'ch-study-example')[0];
 assert.equal(ex.dataset.solo,'true');assert.equal(ex.dataset.open,'true');assert.equal(all(ex,'ch-study-row').length,0,'nothing to unfold');assert.equal(all(ex,'ch-study-row-body')[0].hidden,false);
 const test1=card('test',{title:'T',questions:[{title:'Equilibrium constant',q:'Find $K$.',answer:'$4$',steps:['**Divide** $8/2$']}]});
 assert.equal(all(test1,'ch-study-slip')[0].dataset.solo,'true');assert.equal(all(test1,'ch-study-up-label')[0].textContent,'Equilibrium constant');
});
test('a passage in two columns: numbers in their own column, the passage\'s own numbers as marks, reading down each column',()=>{
 const lines=[1,3,8,9,112].map((n,i)=>({n:String(n),text:['nec me animi fallit','percussit thyrso laudis','avia Pieridum peragro','iuvat integros accedere','unde prius nulli'][i],words:[],note:i===1?'Watch: **Ablative of means** thyrso tells how.':'',check:'A check.'}));
 const host=card('translate',{title:'Lines',lines}),ol=all(host,'ch-study-lines')[0],rows=all(host,'ch-study-row');
 assert.equal(ol.dataset.numbers,'source');assert.deepEqual(rows.map(r=>r.dataset.n),['1','3','8','9','112']);
 assert.deepEqual(rows.map(r=>r.textContent),lines.map(l=>l.text),'the line text is exactly the line, never its number');
 assert.equal(ol.style.props['--ch-num-ch'],'3','the number column fits three digits');assert.deepEqual(all(host,'ch-study-line').map(li=>li.dataset.colStart||''),['','','3','2','3'],'the line that starts each column in the two- and three-column layouts');
 assert.equal(all(host,'ch-study-line-note')[0].children[0].dataset.mark,'watch','a tagged note wears its mark');
 const check=descendants(host).filter(n=>n.tagName==='BUTTON'&&n.textContent==='Check')[4];assert.equal(check.getAttribute('aria-label'),'Show the translation of line 112');
 // A range like 112-113 widens the column; numbers copied into the text by an older reply move into the column.
 const range=card('translate',{title:'L',lines:[{n:'112-113',text:'a',words:[],note:'',check:'b'},{text:'c',words:[],note:'',check:'d'}]});assert.equal(all(range,'ch-study-lines')[0].style.props['--ch-num-ch'],'7');
 const old=card('translate',{title:'L',lines:['12 Arma virumque cano','13 Troiae qui primus','14 Italiam fato'].map(text=>({text,words:[],note:'',check:'x'}))});
 assert.deepEqual(all(old,'ch-study-row').map(r=>[r.dataset.n,r.textContent]),[['12','Arma virumque cano'],['13','Troiae qui primus'],['14','Italiam fato']]);
 const plain=card('translate',{title:'L',lines:['Gallia est omnis','divisa in partes'].map(text=>({text,words:[],note:'',check:'x'}))});
 assert.equal(all(plain,'ch-study-lines')[0].dataset.numbers,'order');assert.deepEqual(all(plain,'ch-study-row').map(r=>r.dataset.n),['1','2']);
 // The CSS: a real number column (also while hovered), the chevron in its own column, and columns that read downward.
 assert.match(css,/\.ch-study-aid \.ch-study-line>button\.ch-study-row,\.ch-study-aid \.ch-study-line>button\.ch-study-row:hover\{grid-template-columns:minmax\(calc\(var\(--ch-num-ch,2\) \* \.5em \+ 4px\),max-content\) minmax\(0,1fr\) 10px/);
 assert.match(css,/\.ch-study-aid button\.ch-study-row,\.ch-study-aid button\.ch-study-row:hover\{position:relative;display:grid;grid-template-columns:minmax\(0,1fr\) 10px;[^}]*padding:0;/);
 assert.doesNotMatch(css,/padding:0 16px 0 0/,'hover no longer drops the number gutter');
 assert.match(css,/ch-study-row::after\{content:"\\203A";position:static;grid-column:-2\/-1/);
 assert.match(css,/@container \(min-width:640px\)\{\.ch-band-card \.ch-study-aid ol\.ch-study-lines\{display:block;columns:2;column-gap:28px\}[^\n]*\[data-col-start~="2"\]\{break-before:column\}\}/,'columns flow on their own: an opened line pushes only its own column');
 assert.match(css,/@container \(min-width:1000px\)\{[^\n]*\[data-col-start~="2"\]\{break-before:auto\}[^\n]*\[data-col-start~="3"\]\{break-before:column\}\}/);assert.doesNotMatch(css,/--ch-rows-2/,'no shared grid rows');
 assert.doesNotMatch(css,/\.ch-study-line\[data-open="true"\]\{grid-column:1\/-1\}/,'an opened line stays in its column, so the order holds');
});
test('the AI\'s words are kept: old replies get marks and clean leads only, money stays text, unknown TeX shows as code',()=>{
 const host=card('example',{title:'E',problem:'Costs are $5 and $10.',steps:[{text:'Check: units cancel.'},{text:'Set up the table of initial amounts: write the starting concentration of each species in moles per litre.'},{text:'Work out the change in each concentration from the balanced equation and its coefficients, then add.'}],answer:'$\\weird{x}$',yours:'Start with **moles**.'});
 assert.equal(all(host,'ch-study-example')[0].textContent,'A similar problemCosts are $5 and $10.');
 const [check,colon,long]=all(host,'ch-study-example-steps')[0].children;
 assert.equal(check.dataset.mark,'check');assert.equal(check.dataset.lead,'none');assert.equal(all(check,'ch-step-detail')[0].textContent,'units cancel.');
 assert.equal(all(colon,'ch-step-lead')[0].textContent,'Set up the table of initial amounts');assert.match(all(colon,'ch-step-detail')[0].textContent,/^write the starting/);
 assert.equal(long.dataset.lead,'none','no clean split: the step stays as written');assert.equal(long.textContent,'Work out the change in each concentration from the balanced equation and its coefficients, then add.');
 assert.equal(all(host,'ch-math-raw')[0].textContent,'\\weird{x}');assert.equal(all(all(host,'ch-study-example-yours')[0],'ch-term')[0].textContent,'moles');
 // Without MathML building the maths reads in its plain form, never as raw TeX.
 const flat=card('examples',equilibrium,{mathml:false});assert.equal(maths(flat).length,0);assert.ok(all(flat,'ch-math-plain').length>3);
 // The study sheet's common mistake wears the Watch mark instead of a printed label.
 const study=card('study',{title:'S',sheet:[{heading:'Rules',facts:[{text:'$K_c$ uses concentrations'}]}],tip:'Adding solids to $K$.',practice:[{q:'a',answer:'b'},{q:'c',answer:'d'}]});
 const tip=all(study,'ch-study-tip')[0];assert.equal(tip.children[0].getAttribute('aria-label'),'Watch out');assert.doesNotMatch(tip.textContent,/Watch out/);
 assert.equal(maths(all(study,'ch-study-fact-text')[0]).length,1);
});

// Review 2026-10-28: every text field of every kind is presented the same way: no raw TeX, no stars on a card.
test('maths and markup are presented in every kind\'s text fields, never printed raw',()=>{
 const T='$x^{2}$ and **a b**',src='p1';
 const samples={lab:{materials:[{text:T,src}],safety:[T],steps:[{text:T,src}],tables:[],prelab:[]},rubric:{requirements:[{text:T,src}],criteria:[{name:'Claim',points:'4',checks:[{text:T,src}],up:T,src}]},
  notes:{sections:[{heading:'One',src,prompts:[T]}],terms:[{term:'x',src}],summary:T},fixes:{fixes:[{for:'rewrite',text:T,why:T,src}],keep:[{text:T,src}]},steps:{steps:[{text:T,done:T,minutes:5,src}],handin:T},
  outline:{thesis:T,sections:[{part:'One',purpose:T,evidence:[{text:T,src}]}]},summary:{points:[{text:T,src}],todo:[{text:T,due:'',src}]},message:{to:'Teacher',subject:'Q',body:T,asks:[T]},ask:{points:[{text:T,src}],next:T}};
 for(const [kind,data] of Object.entries(samples)){const host=card(kind,{title:'K',...data}),text=host.textContent;assert.ok(!text.includes('$'),kind+' prints a dollar sign: '+text);assert.ok(!text.includes('**'),kind+' prints stars');assert.ok(maths(host).length>0,kind+' shows MathML');}
});
test('a folded row opens and closes by a measured reveal; the unfold plays only when the student opens it',()=>{
 assert.match(css,/\.ch-study-aid \.ch-study-row-fold\{display:grid;grid-template-rows:0fr;transition:grid-template-rows/);assert.match(css,/\.ch-study-aid \.ch-study-row-fold\[data-open=true\]\{grid-template-rows:1fr\}/);
 assert.match(css,/\.ch-study-row-body\[data-opening\]:not\(\[hidden\]\)\{[^}]*animation:ch-unfold/);assert.doesNotMatch(css,/\.ch-study-row-body:not\(\[hidden\]\)\{[^}]*animation/,'a redraw never replays it');
 const host=card('examples',{title:'E',problems:equilibrium.problems}),ex=all(host,'ch-study-example')[0],row=all(ex,'ch-study-row')[0],fold=all(ex,'ch-study-row-fold')[0],body=all(ex,'ch-study-row-body')[0];
 assert.equal(fold.dataset.open,'false');assert.equal(body.hidden,true);row.fire('click');assert.equal(fold.dataset.open,'true');assert.equal(body.hidden,false);row.fire('click');assert.equal(fold.dataset.open,'false');assert.equal(body.hidden,true,'without motion it folds at once');
});
