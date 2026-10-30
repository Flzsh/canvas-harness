'use strict';
// Owner, 2026-10-28, on the Help cards: "extremely text heavy", equations "not in LaTeX form", plain grey prose with
// nothing to guide the eye, Latin line numbers drawn over the text, and a practice set squeezed into five columns.
// The instructions now ask for an outline the renderer can mark up (bold 2-5 word leads, Rule:/Check:/Watch:/Tip:
// tags, at most two key terms), all maths in LaTeX ($...$, $$...$$) with doubled JSON backslashes, tight per-kind
// budgets, line numbers in their own field, quarter sizes s/m/l/xl and titled parts that the band laps into one stack.
// Contract with the renderer: the Help card markup (math-render.js).
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../extension/study-prompts.js'),ReserveMath=require('../extension/math.js');
const at={now:Date.parse('2026-10-28T16:00:00Z'),timeZone:'America/New_York'};
const B=String.fromCharCode(92),fence='```';
const json=v=>fence+'json\n'+(typeof v==='string'?v:JSON.stringify(v))+'\n'+fence;
const deliver=make=>S.buildDeliver(make,{item:'Course · Item',focus:'the item',sources:[{label:'Teacher instructions',text:'Do the set.'}],...at});
const ask=()=>S.buildAsk({question:'Help me with this.',brief:'Courses: A course',...at});
const every=()=>[...[...S.DELIVER_KINDS,'auto'].map(deliver),ask(),S.build('study',{sources:[],...at}),S.build('example',{sources:[],...at}),S.buildChoice(['ask','steps','practice'],{sources:[],...at})];
// Words from the owner's screenshots and earlier tests: none may steer the AI as a subject example.
const SUBJECT=/kinetic|limiting reagent|equilibri|percussit|\bKc\b|ICE table|SO_?\{?3|SO₃|Latin|Gallia|matrix A\b|\[2 1; ?-1 3\]/i;

test('every Help prompt asks for LaTeX maths with doubled JSON backslashes, shown with placeholders only',()=>{
 for(const m of every()){
  assert.match(m,/Mathematics is always LaTeX, never plain text: inline between single dollar signs \$\.\.\.\$, a line on its own between \$\$\.\.\.\$\$/);
  assert.ok(m.includes('$'+B+B+'frac{a}{b}$'),'the fraction is shown as the JSON form, backslash doubled');
  assert.ok(m.includes(B+B+'begin{bmatrix} a & b '+B+B+B+B+' c & d '+B+B+'end{bmatrix}'),'a matrix row break is four backslashes in JSON');
  assert.ok(m.includes(B+B+'rightleftharpoons')&&m.includes(B+B+'mathrm{X_{2}Y}(g)'),'chemistry is LaTeX too, with placeholder species');
  assert.match(m,/every backslash is written twice/);assert.match(m,/Titles and headlines stay plain words, without maths/);assert.match(m,/Never use \$ for money/);
  assert.doesNotMatch(m,/x², s⁻¹, H₂O|never \^ or _/,'the old plain-character maths rule is gone');
  assert.doesNotMatch(m,SUBJECT,'no subject example steers the AI');
 }
 const tex=S.buildDeliver('examples',{item:'x',...at}).match(/That covers ([^\n]*?)Never write maths/)[1];
 for(const span of tex.match(/\$\$[^$]+\$\$|\$[^$]+\$/g)){const body=JSON.parse('"'+span.replace(/^\$+|\$+$/g,'')+'"');assert.ok(ReserveMath.convert(body,span.startsWith('$$')),'renders: '+body);}
});

test('cards are written as a scannable outline: bold leads, the five tags, two key terms, the answer apart',()=>{
 for(const m of [deliver('test'),deliver('examples'),deliver('auto'),ask()]){
  assert.match(m,/A step is one line: a lead of 2 to 5 words in \*\*bold\*\*, then one short sentence of at most 15 words besides its maths, as "\*\*<lead>\*\* <sentence>"/);
  for(const tag of ['Rule: ','Check: ','Watch: ','Tip: '])assert.ok(m.includes('"'+tag+'"'),tag);
  assert.match(m,/Bold only the lead and at most two key terms in a step; never bold a whole sentence or the answer/);
  assert.match(m,/never restates the problem, the assignment or the instructions/);
 }
 for(const make of ['test','examples'])assert.match(deliver(make),/A result goes in its "answer" field: the value alone with its units, in one short line\. Do not end with a step that only restates the result; the step that computes it and the Check step may show the value\./);
 assert.doesNotMatch(deliver('test'),/not repeated in the steps/,'the check may show the value it checks');assert.match(ask(),/Do not end with a step that only restates the result; the step that computes it and the Check step may show the value/);
 assert.doesNotMatch(deliver('reading'),/A result goes in its "answer" field/,'a reading has no answer field');
 assert.match(ask(),/that point starts "Answer: "/);
 assert.match(deliver('examples'),/the last step checks the answer by substituting it back, estimating or checking the units, and starts "Check: "/);
 assert.match(deliver('test'),/for a calculation the last step checks the answer and starts "Check: "/);
 for(const make of ['test','examples'])assert.match(deliver(make),/"steps":\["Rule: \*\*<lead>\*\* <one short sentence>","\*\*<lead>\*\* <one move with its numbers>","\*\*<lead>\*\* <the next move>","Check: \*\*<lead>\*\* <one short sentence>"\]/,'the skeleton shows two moves');
 assert.match(ask(),/\{"text":"\*\*<lead>\*\* <one move with its numbers>"\},\{"text":"\*\*<lead>\*\* <the next move>"\}/);
});

test('each kind has a strict, plain budget and short fields instead of walls of text',()=>{
 const words={test:900,reading:700,translate:1500,examples:650};
 for(const [make,n] of Object.entries(words)){assert.match(deliver(make),new RegExp('Keep the whole reply under '+n+' words'));assert.match(deliver('auto'),new RegExp('If you choose "'+make+'" \\(keep the whole reply under '+n+' words\\)'));}
 assert.match(deliver('auto'),/Keep the whole reply under the word limit given for the kind you choose/);
 const t=deliver('test'),e=deliver('examples'),r=deliver('reading'),tr=deliver('translate');
 assert.match(t,/6 to 8 new questions/);assert.match(t,/"q" \(the question with only the data it needs, at most 35 words plus its maths/);assert.match(t,/steps" \(the worked solution in 2 to 6 steps in the step format below, one move each: as many as the solution has moves, never merging or skipping a move to save a step; Rule, Watch and Check lines count toward the 6/);assert.match(t,/a step starts "Watch: " where students often slip, only when it replaces no move/);assert.match(t,/Never fewer than 5: replace a question you cannot make certainly right with one you can verify instead of dropping it/);
 assert.match(e,/2 to 4 new problems/);assert.match(e,/"problem" \(only the given data and what to find, at most 40 words plus its maths\)/);assert.match(e,/"steps" \(2 to 6 in the step format below, each one move with its numbers: as many as the solution has moves, never merging or skipping a move/);assert.match(e,/when the assignment has only one kind, give two of it at rising difficulty, with titles that say how they differ/);assert.match(e,/In a practice test or worked examples, write one you can verify in its place, so the count stays in its range/);
 assert.match(r,/"thesis": the author's main claim in one plain sentence, at most 25 words/);assert.match(r,/4 to 7 steps of the argument/);assert.match(r,/at most 30 words in all/);
 assert.match(tr,/"note" is "" or one line in the step format naming the construction that makes the line hard \(at most 20 words/);
 assert.match(ask(),/A study card holds a sheet of at most 160 words, its tip and 4 practice questions, at most 400 words in all; an example at most 150 words\. Study and example cards open in full on tap: the size words above are for the folded card\. The whole reply under 550 words/);
 assert.match(ask(),/Then 4 practice questions like the test's, easiest first, each with its answer \(the result alone\) and working in at most 15 words/);assert.match(ask(),/in 2 to 6 steps \(one move each, never merged or skipped\)/);
});

test('line numbers live in their own field and quotes cite the real page or line',()=>{
 const tr=deliver('translate');
 assert.match(tr,/"n" is the entry's line number in the passage \("12", or "12-13" when it spans lines\) when the passage numbers its lines: count every line, even where the book prints a number only every few lines; leave "n" out for unnumbered prose\. "text" is the original exactly, without any line number/);
 assert.match(tr,/"lines":\[\{"n":"<line number, only when the passage numbers its lines, or the reference of a numbered passage>","text":"<the original line>"/);
 assert.match(deliver('reading'),/then the page as "p\. 4" or the line as "l\. 12" when the text numbers them/);
 const read=S.parseDeliver(json({kind:'translate',title:'Lines',lines:[{n:'7',text:'a b',words:[],note:'',check:'c'},{n:112,text:'d',words:[],note:'',check:'e'},{n:'112 – 113',text:'f',words:[],note:'',check:'g'},{n:'seven',text:'h',words:[],note:'',check:'i'},{text:'j',words:[],note:'',check:'k'}],gaps:[]}),'translate');
 assert.equal(read.ok,true,JSON.stringify(read.errors));assert.deepEqual(read.data.lines.map(l=>l.n),['7','112','112-113',undefined,undefined]);
 assert.deepEqual(S.unfoundQuotes({points:[{text:'a',quote:'arma virumque cano, l. 1'},{text:'b',quote:'troiae qui primus ab oris (ll. 1-2)'}]},'Arma virumque cano, Troiae qui primus ab oris'),[]);
});

test('sizes are quarters of the band with a word budget each, proposed by the AI and stamped grid:4',()=>{
 for(const m of [...S.DELIVER_KINDS,'auto'].map(deliver))assert.match(m,/"size": how wide each card must be to show its largest single part[^\n]*"s" a quarter of the Help band \(about 45 words\), "m" half \(90\), "l" three quarters \(135\), "xl" the full width \(180\)/);
 for(const make of S.DELIVER_KINDS)assert.match(deliver(make),/"size":"<s\|m\|l\|xl>"/);
 assert.match(ask(),/"size" is the card's width in the Help band: "s" a quarter \(at most 45 words\), "m" half \(90\), "l" three quarters \(135\), "xl" the full width \(180\)/);
 assert.deepEqual([...S.SIZES],['s','m','l','xl']);assert.deepEqual({...S.QUARTER_WORDS},{s:45,m:90,l:135,xl:180});
 const problems=[{title:'First kind',problem:'p',steps:['**Lead one** a.','Check: **Lead two** b.'],answer:'x'},{title:'Second kind',problem:'q',steps:['a','b'],answer:'y'}];
 const xl=S.parseDeliver(json({kind:'examples',title:'T',size:'xl',problems,gaps:[]}),'examples');assert.equal(xl.ok,true,JSON.stringify(xl.errors));assert.equal(xl.data.size,'xl');assert.equal(xl.data.grid,4);
 for(const size of [undefined,'<s|m|l|xl>','wide'])for(const [make,card] of [['examples',{kind:'examples',title:'T',problems,gaps:[]}],['reading',{kind:'reading',title:'R',thesis:'x',points:[{text:'**A b** c.',quote:''}],terms:[],check:[{q:'q',answer:'a'}],gaps:[]}]]){
  const got=S.parseDeliver(json({...card,...(size?{size}:{})}),make);assert.equal(got.ok,true,make+' '+JSON.stringify(got.errors));assert.equal(got.data.size,S.DELIVER_SIZE[make]);assert.equal(got.data.grid,4);}
 // Ask cards: quarter sizes, xl accepted, a card over its budget moves up a size (all the way to xl).
 const card=(extra={})=>({kind:'ask',size:'s',importance:1,headline:'A course: answer',title:'Answer',points:[{text:'Answer: one two three.'}],next:'Do it.',gaps:[],...extra});
 const a=S.parseAsk(json({cards:[card({size:'xl'})]}));assert.equal(a.ok,true,JSON.stringify(a.errors));assert.equal(a.data.cards[0].size,'xl');assert.equal(a.data.cards[0].grid,4);
 const long=S.parseAsk(json({cards:[card({points:[{text:Array(70).fill('word').join(' ')},{text:Array(70).fill('word').join(' ')}]})]}));assert.equal(long.ok,true,JSON.stringify(long.errors));assert.equal(long.data.cards[0].size,'xl');
 // Saved cards: old thirds stay thirds (no grid), new cards keep their stamp.
 const wrap=v=>fence+'chstudy\n'+JSON.stringify(v)+'\n'+fence,old={v:1,kind:'ask',title:'Old',size:'l',headline:'Old answer',importance:2,points:[{text:'Kept.',src:'Notes'}],next:'Next.',gaps:[]};
 const reread=S.parse(wrap(old),'ask');assert.equal(reread.ok,true);assert.equal(reread.data.size,'l');assert.equal(Object.hasOwn(reread.data,'grid'),false);
 assert.equal(S.parse(wrap({...old,size:'xl'}),'ask').data.size,'s','xl is not a thirds size: the legacy fallback applies');
 const fresh=S.parse(wrap({...old,size:'xl',grid:4}),'ask');assert.equal(fresh.data.size,'xl');assert.equal(fresh.data.grid,4);
});

test('a multi-part help is one card whose titled parts become the lapped cards of one stack',()=>{
 assert.match(deliver('test'),/"title" \(2 to 5 words naming the skill it practises; no two alike\)/);assert.match(deliver('test'),/CH shows each question as its own card in a stack where only the titles show, so a title must say what is inside/);
 assert.match(deliver('examples'),/"title" \(the kind of problem in 2 to 5 words; no two alike\)/);assert.match(deliver('examples'),/CH shows each problem as its own card in a stack where only the titles show/);
 assert.match(ask(),/Cards of the same kind about one item are lapped into one stack in which only their titles show: give each a distinct "title" of 2 to 5 words that says what is inside, and the same "ref"/);
 const q=i=>({title:'Skill '+i,q:'Question '+i+'?',answer:String(i),steps:['**Do it** now.','Check: **Look back** fine.']});
 const t=S.parseDeliver(json({kind:'test',title:'Unit test',size:'l',minutes:30,questions:[1,2,3,4,5].map(q),gaps:[]}),'test');assert.equal(t.ok,true,JSON.stringify(t.errors));
 assert.deepEqual(t.data.questions.map(x=>x.title),['Skill 1','Skill 2','Skill 3','Skill 4','Skill 5']);assert.deepEqual(t.data.questions[0].steps,['**Do it** now.','Check: **Look back** fine.'],'the markup is kept as written');
 const parts=S.partCards(t.data);assert.equal(parts.length,5);assert.deepEqual(parts.map(p=>[p.title,p.partIndex,p.partCount,p.questions.length]),[1,2,3,4,5].map(i=>['Skill '+i,i-1,5,1]));assert.equal(parts[0].cardTitle,'Unit test');assert.equal(parts[0].size,'l');
 // Older cards: examples with "type" only, test questions without titles, string or object steps.
 const old=S.parseDeliver(json({kind:'examples',title:'E',problems:[{type:'Old kind',problem:'p',steps:[{text:'one'},'two'],answer:'a'},{type:'Other kind',problem:'q',steps:['a','b'],answer:'b'}],gaps:[]}),'examples');
 assert.equal(old.ok,true,JSON.stringify(old.errors));assert.deepEqual(old.data.problems.map(p=>[p.type,p.title]),[['Old kind','Old kind'],['Other kind','Other kind']]);assert.deepEqual(old.data.problems[0].steps,['one','two']);
 const fresh=S.parseDeliver(json({kind:'examples',title:'E',problems:[{title:'New kind',problem:'p',steps:['a','b'],answer:'a'},{title:'Next kind',problem:'q',steps:['a','b'],answer:'b'}],gaps:[]}),'examples');assert.deepEqual(fresh.data.problems.map(p=>[p.type,p.title]),[['New kind','New kind'],['Next kind','Next kind']]);
 assert.deepEqual(S.partCards({kind:'test',title:'T',questions:[{q:'a',answer:'b',steps:['c']},{q:'d',answer:'e',steps:['f']}]}).map(p=>p.title),['Question 1','Question 2']);
 assert.deepEqual(S.partCards({kind:'reading',title:'R'}),[{kind:'reading',title:'R'}],'a card without parts is its own stack');
 // An AI that sends the parts as separate same-kind cards still gives one card for the item.
 const split=S.parseDeliver(json({cards:[{kind:'examples',title:'E',problems:[{title:'A',problem:'p',steps:['a','b'],answer:'x'}]},{kind:'examples',title:'E',problems:[{title:'B',problem:'q',steps:['a','b'],answer:'y'}]}]}),'examples');
 assert.equal(split.ok,true,JSON.stringify(split.errors));assert.deepEqual(split.data.problems.map(p=>p.title),['A','B']);
});

test('TeX survives JSON: doubled backslashes parse, and a reply that forgot is restored to what the AI typed, never corrupted',()=>{
 const d=String.raw;
 const good=d`{"kind":"examples","title":"E","size":"l","problems":[{"title":"Two by two product","problem":"Find $AB$ for $$A=\\begin{bmatrix} 2 & 1 \\\\ 0 & 3 \\end{bmatrix}$$","steps":["Rule: **Row times column** $c_{ij}=\\sum_{k} a_{ik}b_{kj}$.","Check: **Size check** $\\det(AB)=\\det A \\cdot \\det B$."],"answer":"$\\frac{1}{2}$"},{"title":"Other","problem":"$\\sqrt{x}$","steps":["a","b"],"answer":"$\\theta \\times \\nu$"}],"gaps":[]}`;
 const p=S.parseDeliver(json(good),'examples');assert.equal(p.ok,true,JSON.stringify(p.errors));
 assert.equal(p.data.problems[0].problem,'Find $AB$ for $$A='+B+'begin{bmatrix} 2 & 1 '+B+B+' 0 & 3 '+B+'end{bmatrix}$$');assert.equal(p.data.problems[0].answer,'$'+B+'frac{1}{2}$');
 // A model that typed single backslashes: \( \[ \c \s fail JSON.parse; \f \b \r \n \t would silently become control characters.
 const bad=d`{"kind":"examples","title":"E","problems":[{"title":"Single slashes","problem":"Find $AB$ for $$A=\begin{bmatrix} 2 & 1 \\ 0 & 3 \end{bmatrix}$$","steps":["Rule: **Use it** \(\frac{a}{b}\) and \[\sqrt{x}\].","**Greek** $\beta + \nu \neq \rho \cdot \tau$, $\left( x \right)$, $\text{m} \times \theta \to \tan x$."],"answer":"$\frac{1}{2}$"},{"title":"Other","problem":"p","steps":["line one\nline two\tend","x²"],"answer":"y"}],"gaps":[]}`;
 assert.throws(()=>JSON.parse(bad));const r=S.parseDeliver(json(bad),'examples');assert.equal(r.ok,true,JSON.stringify(r.errors));
 assert.equal(r.data.problems[0].problem,'Find $AB$ for $$A='+B+'begin{bmatrix} 2 & 1 '+B+B+' 0 & 3 '+B+'end{bmatrix}$$','the matrix and its row break come through');
 assert.equal(r.data.problems[0].steps[0],'Rule: **Use it** '+B+'('+B+'frac{a}{b}'+B+') and '+B+'['+B+'sqrt{x}'+B+'].');
 assert.equal(r.data.problems[0].steps[1],'**Greek** $'+['beta + ','nu ','neq ','rho ','cdot ','tau$, $'].map(w=>B+w).join('')+B+'left( x '+B+'right)$, $'+B+'text{m} '+B+'times '+B+'theta '+B+'to '+B+'tan x$.');
 assert.equal(r.data.problems[0].answer,'$'+B+'frac{1}{2}$');
 assert.equal(JSON.parse(S.texJSON(bad)).problems[1].steps[0],'line one\nline two\tend','real newline and tab escapes before ordinary words stay');assert.equal(r.data.problems[1].steps[1],'x²');
 const strings=[];JSON.stringify(r.data,(k,v)=>{if(typeof v==='string')strings.push(v);return v;});
 assert.ok(strings.every(v=>!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)),'no control characters (a lost \\f, \\b, \\r, \\n or \\t)');
 for(const text of [r.data.problems[0].problem,r.data.problems[0].answer]){const tex=text.match(/\$\$([^$]+)\$\$|\$([^$]+)\$/);assert.ok(ReserveMath.convert(tex[1]||tex[2],!!tex[1]),'renders: '+text);}
 // The same repair serves Ask cards and the legacy reader.
 const askReply=d`{"cards":[{"kind":"example","size":"l","importance":1,"headline":"A course: worked example","title":"One kind","problem":"$\frac{3}{4}$ of $8$?","steps":[{"text":"Rule: **Multiply** $\frac{3}{4} \times 8$."},{"text":"Check: **Estimate** about $6$."}],"answer":"$6$","yours":"Start the same way.","gaps":[]}]}`;
 const a=S.parseAsk(json(askReply));assert.equal(a.ok,true,JSON.stringify(a.errors));assert.equal(a.data.cards[0].steps[0].text,'Rule: **Multiply** $'+B+'frac{3}{4} '+B+'times 8$.');
 assert.equal(S.texJSON('{"a":"plain \\n text"}'),'{"a":"plain \\n text"}','plain JSON is unchanged');
});

test('a reply that still cannot be read gets one retry told exactly what to fix',()=>{
 const cut=S.parseDeliver(fence+'json\n{"kind":"test","title":"T","questions":[{"q":"a"'+'\n'+fence,'test');assert.equal(cut.ok,false);assert.match(cut.errors[0],/^The reply has no readable JSON\. It was cut off before the end: keep the whole reply within its word limit\./);
 // The retry names the real fault (sealed test 2026-10-28: "write every backslash twice" for a missing key misled it).
 const broken=S.parseDeliver(json('{"kind":"test" "title":"T"}'),'test');assert.match(broken.errors[0],/^The reply has no readable JSON\. The JSON breaks at character 16 of 27, after "kind": a comma or \} was expected, but a text in quotes came\. There: "…\{"kind":"test" ⟨here⟩"title"/);assert.doesNotMatch(broken.errors[0],/backslash/);
 assert.equal(S.parseDeliver('not json','test').errors[0],'The reply has no readable JSON.');
});

test('Daily help saves the AI\'s quarter size with grid:4, or the kind\'s usual width when it gave none',async()=>{
 const Runner=require('../extension/ai-runner.js');
 for(const [size,want] of [['m','m'],[undefined,'l'],['<s|m|l|xl>','l']]){
  let saved=null;const runner=Runner.create({canvas:{reader:()=>({cache:new Map(),read:async req=>({id:req.id,text:'Solve the set.'})}),validate:async()=>{}},results:{saveCards:async(run,cards)=>{saved=cards;return cards.length;}},account:{get:()=>({settings:{timeZone:'UTC'},toolbox:{}}),sync:async()=>{}},adapter:{},now:()=>Date.parse('2026-10-28T16:00:00Z'),uuid:()=>'x'});
  const run={id:'run-s',state:'gathering',mode:'prepare',phase:'deliver',picks:[{ref:'A1',make:'examples',focus:'',sources:[]}],pickIndex:0,made:[],errors:[],turns:[],messages:[],refs:{A1:{id:'12',courseId:'7',title:'Homework'}},instructions:{standingText:''},settings:{},snapshot:{index:[['assignment:7:12',{id:'assignment:7:12',what:'assignment',title:'Homework',courseId:'7',item:{courseName:'Course'}}]],snapshot:{items:[]},brief:{text:'brief'}}};
  const ctx={save:async r=>r,guard:async()=>{},signal:new AbortController().signal};
  await runner.step(run,ctx);assert.equal(run.state,'asking');assert.match(run.messages[0].content,/"size":"<s\|m\|l\|xl>"/);
  run.turns.push({id:'t',reply:json({kind:'examples',title:'Set',...(size?{size}:{}),problems:[{title:'One kind',problem:'p',steps:['**A** b.','Check: **C** d.'],answer:'x'},{title:'Two kind',problem:'q',steps:['a','b'],answer:'y'}],gaps:[]})});run.turnIndex=0;run.state='awaiting-reply';
  await runner.step(run,ctx);await runner.step(run,ctx);assert.equal(saved.length,1,JSON.stringify(run.errors));assert.equal(saved[0].size,want,String(size));assert.equal(saved[0].grid,4);assert.deepEqual(saved[0].problems.map(p=>p.title),['One kind','Two kind']);
 }
});

test('the engine fixture still routes every deliver prompt by its first sentence',()=>{
 const src=fs.readFileSync(path.join(__dirname,'ai-engine-fixture.cjs'),'utf8'),route=new RegExp(/a study tool for a \[a-z \]\+ student\\\. Make \(a full practice test\|a breakdown\|line-by-line help\|worked solutions\|the help that saves\)/.source);
 assert.ok(src.includes('/a study tool for a [a-z ]+ student\\. Make (a full practice test|a breakdown|line-by-line help|worked solutions|the help that saves)/'),'the fixture routes on this pattern');
 const pattern=/a study tool for a [a-z ]+ student\. Make (a full practice test|a breakdown|line-by-line help|worked solutions|the help that saves)/;
 for(const make of [...S.DELIVER_KINDS,'auto'])assert.match(deliver(make),pattern,make);assert.ok(route);
});

// Review 2026-10-28: a study card filled to every stated maximum still parses; TeX that starts like a JSON escape
// survives a single backslash; code goes between backticks.
test('a study card filled to every field maximum the Ask prompt states parses',()=>{
 const w=(n,word='term')=>Array.from({length:n},(_,i)=>word+i).join(' ');
 const sheet=[0,1,2,3].map(i=>({heading:w(6,'h'+i),facts:[{label:w(6,'l'+i),text:w(20,'f'+i),note:w(12,'n'+i)}]})).slice(0,3);
 const card={kind:'study',size:'xl',importance:1,headline:'Chem: unit 7 test',title:'Unit 7',ref:'A1',minutes:40,sheet,tip:w(20,'tip'),practice:[0,1,2,3].map(i=>({q:w(30,'q'+i).slice(0,200),answer:'4 mol',why:w(15,'why'+i)})),gaps:[]};
 const text=json({cards:[card]});
 const r=S.parseAsk(text);assert.ok(r.ok,JSON.stringify(r.errors));
});
test('TeX after a single backslash survives JSON: \\ne, \\nu, \\textdegree, and anything inside dollar signs',()=>{
 const bs=String.fromCharCode(92),raw='{"a":"$x '+bs+'ne y$ and $'+bs+'nu$ and '+bs+'textdegree, line'+bs+'nnext"}',a=JSON.parse(S.texJSON(raw)).a;
 assert.equal(a,'$x '+bs+'ne y$ and $'+bs+'nu$ and '+bs+'textdegree, line\nnext');
 assert.match(deliver('examples'),/Code, commands, program variables and spreadsheet formulas go between backticks, never between dollar signs/);
});
