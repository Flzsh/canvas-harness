'use strict';
// Fixes from the sealed live test (2026-10-28: 12 real ChatGPT replies, graded). Every fix is general: the format rules
// carry no subject, text or language, the parser keeps the AI's words (it may drop a bad optional part, never the card),
// and the card shows what the AI wrote. Case material appears only here, in the tests.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../extension/study-prompts.js'),M=require('../extension/math-render.js'),Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js');
const {dom,storage,descendants}=require('./study-fixture.cjs');
const css=fs.readFileSync(path.join(__dirname,'../extension/study-band.css'),'utf8'),fence='```';
const json=v=>fence+'json\n'+(typeof v==='string'?v:JSON.stringify(v))+'\n'+fence;
const all=(root,cls)=>descendants(root).filter(n=>String(n.className||'').split(' ').includes(cls));
const aid=(data,extra={})=>({kind:data.kind,title:data.title,data:{v:1,importance:1,headline:'Course: '+data.title,...data},savedAt:100,progress:{},...extra});
function band(aids,options={},extra={}){const d=dom(),host=new d.Element('div'),env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:false}),...extra},view=Band.renderBand(host,aids,{env,scope:'https://school.instructure.com|7',store:UI.createStore(env),...options});return {host,view,find:cls=>all(host,cls)};}
const deliver=make=>S.buildDeliver(make,{item:'Course · Item',focus:'the item',sources:[{label:'Teacher instructions',text:'Do the set.'}],now:Date.parse('2026-10-28T16:00:00Z'),timeZone:'UTC'});
const problem=(title,extra={})=>({title,problem:'Given data for '+title+'.',steps:['**Do it** now.','Check: **Look back** fine.'],answer:'x',...extra});

// ---- 1. code inside worked steps keeps its lines ----
test('fenced code in a step keeps its line breaks and indentation; the prose around it stays one line',()=>{
 const code='def count(s):\n    if not s:\n        return 0\n    return 1 + count(s[1:])';
 const step='**Write the function**   in   one   pass. '+fence+'python\n'+code+'\n'+fence;
 const r=S.parseDeliver(json({kind:'examples',title:'Set',problems:[problem('First kind',{steps:['Rule: **Base case** stop   at   empty.',step]}),problem('Second kind')],gaps:[]}),'examples');
 assert.equal(r.ok,true,JSON.stringify(r.errors));
 assert.equal(r.data.problems[0].steps[1],'**Write the function** in one pass. '+fence+'python\n'+code+'\n'+fence,'code lines kept exactly, prose spaces folded');
 assert.equal(r.data.problems[0].steps[0],'Rule: **Base case** stop at empty.','a step without code is one line as before');
 const t=S.parseDeliver(json({kind:'test',title:'T',questions:[1,2,3,4,5].map(i=>({title:'Skill '+i,q:'Q'+i+'?',answer:'a',steps:[i===1?step:'**One** move.']})),gaps:[]}),'test');
 assert.equal(t.data.questions[0].steps[0].includes('\n    if not s:\n        return 0'),true,'test solutions too');
 // A raw line break typed inside a string (code pasted as is) reads as the escape it stands for.
 const raw=fence+'json\n{"kind":"examples","title":"Set","problems":[{"title":"A","problem":"p","steps":["**Lead** x '+fence+'py\nfor i in range(3):\n    print(i)\n'+fence+'","b"],"answer":"x"},{"title":"B","problem":"q","steps":["a","b"],"answer":"y"}],"gaps":[]}\n'+fence;
 const rr=S.parseDeliver(raw,'examples');assert.equal(rr.ok,true,JSON.stringify(rr.errors));assert.match(rr.data.problems[0].steps[0],/\nfor i in range\(3\):\n {4}print\(i\)\n/);
});
test('the maths splitter reads a fenced block as code with its language; inline code is unchanged',()=>{
 const parts=M.split('**Fix it** '+fence+'python\ndef f(n):\n    return n\n'+fence+' then `n // 10` and $x^{2}$');
 assert.deepEqual(parts.map(p=>Object.keys(p).sort().join()),['text','block,code,lang','text','code','text','display,source,tex']);
 assert.deepEqual(parts[1],{code:'def f(n):\n    return n',block:true,lang:'python'});assert.deepEqual(parts[3],{code:'n // 10'});
 assert.deepEqual(M.split(fence+'x = 1'+fence),[{code:'x = 1'}],'three backticks on one line stay an inline span');
 assert.equal(M.plain('a '+fence+'\ny = 2\n'+fence),'a y = 2');
});
test('a step\'s code block is drawn as code with its lines, under the step\'s sentence',async()=>{
 const code='def f(n):\n    if n == 0:\n        return 1\n    return n * f(n - 1)';
 const f=band({e:aid({kind:'examples',title:'Recursion',size:'m',grid:4,problems:[problem('Fix the bug',{steps:['Rule: **Base case** One call stops.','**Correct it** Return one. '+fence+'python\n'+code+'\n'+fence]}),problem('Trace it')],gaps:[]})});await f.view.loaded;
 const pre=f.find('ch-code-block');assert.equal(pre.length,1);assert.equal(pre[0].tagName,'PRE');assert.equal(pre[0].dataset.lang,'python');assert.equal(pre[0].children[0].tagName,'CODE');
 assert.equal(pre[0].textContent,code,'every line and its indentation, no language word, no backticks');assert.equal(pre[0].getAttribute('dir'),'ltr');
 assert.equal(pre[0].parentNode.className,'ch-step-detail','it sits in the step, after its sentence');assert.match(pre[0].parentNode.textContent,/^Return one\./);
 assert.match(css,/pre\.ch-code-block\{[^}]*overflow-x:auto;[^}]*white-space:pre;/,'lines never wrap or widen the card: a wide one scrolls inside its slip');
 assert.match(css,/pre\.ch-code-block\{[^}]*border-radius:4px 7px 5px 6px\/6px 4px 7px 5px;[^}]*box-shadow:1\.3px 1\.7px 0/,'a drawn slip, not a plain box');
 for(const make of ['test','examples','auto'])assert.match(deliver(make),/Code of several lines goes after the step's sentence as one fenced block: three backticks and the language name, a line break, the code with its own line breaks and indentation/);
});

// ---- 2. multiple choice: the answer names its choice ----
test('the answer names its choice: exact or plainly the same text, or its letter; never a guess between choices',()=>{
 const c=['The first option','The $8$ option','Both cost the same','Not enough data'];
 assert.equal(S.choiceIndex('The $8$ option',c),1);assert.equal(S.choiceIndex('  the 8   option. ',c),1,'case, spacing, maths dollars and a closing stop aside');assert.equal(S.choiceIndex('**Both cost the same**',c),2);
 for(const [a,i] of [['B',1],['(c)',2],['D.',3],['B) The $8$ option',1],['A. The first option',0]])assert.equal(S.choiceIndex(a,c),i,a);
 for(const a of ['B. The first option','The 8 option; 2.25 each','8 option','E','','Not enough information'])assert.equal(S.choiceIndex(a,c),-1,a);
 assert.equal(S.choiceIndex('Same',['Same','same','Other']),-1,'two choices that read alike: no guess');assert.equal(S.choiceIndex('A',['A','B','C']),0,'a choice whose text is a letter matches as text');
 const q=(answer,choices)=>({title:'Skill',q:'Which?',choices,answer,steps:['**Lead** x.']});
 const t=S.parseDeliver(json({kind:'test',title:'T',questions:[q('The $8$ option',c),q('8-notebook package; 2.25 dollars each',c),q('B',c),{title:'Short',q:'Why?',answer:'Because',steps:['a']},q('x',['only'])],gaps:[]}),'test');
 assert.equal(t.ok,true,JSON.stringify(t.errors));assert.deepEqual(t.data.questions.map(x=>x.right),[1,undefined,1,undefined,undefined]);
 assert.equal(t.data.questions[1].answer,'8-notebook package; 2.25 dollars each','an unmatched answer stays as the AI wrote it');
 const p=deliver('test');assert.match(p,/"answer" \(the final answer alone, with units; for multiple choice, the correct choice's text copied exactly as it stands in "choices", character for character/);
 assert.match(p,/"answer":"<the final answer alone; for multiple choice, the right choice exactly as written in choices>"/);
});
test('an opened answer marks the choice it names; an answer that names none is shown as text with no mark',async()=>{
 const q=(answer,extra={})=>({title:'Skill',q:'Which one?',choices:['One','Two','Three','Four'],answer,steps:['**Lead** x.'],...extra});
 // With timers the card can move, so the tap draws the mark in.
 const f=band({t:aid({kind:'test',title:'Quiz',size:'m',grid:4,questions:[q('Three',{right:2}),q('Two, because of the rule'),q('four')],gaps:[]})},{},{setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,5)),clearTimeout});await f.view.loaded;
 const rows=f.find('ch-study-row'),choices=f.find('ch-study-choices');assert.equal(choices.length,3);
 assert.ok(choices.every(ol=>ol.children.every(li=>li.dataset.right===undefined)),'nothing is marked before the answer opens');
 const open=i=>{rows[i].fire('click');descendants(f.find('ch-study-row-body')[i]).find(n=>n.tagName==='BUTTON'&&n.textContent==='Answer').fire('click');};
 open(0);const marked=choices[0].children.filter(li=>li.dataset.right==='true');assert.equal(marked.length,1);assert.equal(marked[0].textContent.startsWith('Three'),true);
 assert.equal(all(marked[0],'ch-mark')[0].dataset.mark,'answer');assert.equal(all(marked[0],'ch-mark')[0].getAttribute('aria-label'),'Answer');assert.equal(marked[0].dataset.drawn,'now','drawn in on the tap');
 open(1);assert.equal(choices[1].children.filter(li=>li.dataset.right).length,0,'no single choice named: no mark');assert.match(all(f.host,'ch-study-quiz-result')[1].textContent,/Two, because of the rule/);
 open(2);assert.equal(choices[2].children[3].dataset.right,'true','a card saved before "right" existed is matched the same way');
 // Reopened later (already revealed): marked, but not drawn in again.
 const again=band({t:aid({kind:'test',title:'Quiz',size:'m',grid:4,questions:[q('Three',{right:2}),q('One')],gaps:[]},{progress:{revealed:{'question:0':true}}})});await again.view.loaded;
 const li=again.find('ch-study-choices')[0].children[2];assert.equal(li.dataset.right,'true');assert.equal(li.dataset.drawn,undefined);
 assert.match(css,/ol\.ch-study-choices>li\[data-right=true\]::after\{[^}]*background:var\(--ch-result-wash\)/);assert.match(css,/@media \(prefers-reduced-motion:no-preference\)\{\.ch-study-aid ol\.ch-study-choices>li\[data-right=true\]\[data-drawn=now\]::after\{animation:ch-right-sweep/);
});

// ---- 3. choices follow the maths rule ----
test('the maths rule names every field, the choices of a multiple-choice question included',()=>{
 for(const p of [...S.DELIVER_KINDS,'auto'].map(deliver).concat(S.buildAsk({question:'q',brief:'b'})))assert.match(p,/The rule holds in every field, the choices of a multiple-choice question included\./);
 assert.match(deliver('test'),/each at most 12 words and written by the same maths rule as the question, so a formula, symbol or species in a choice is LaTeX too/);
});

// ---- 4. an unreadable reply's retry names the real fault ----
test('an unreadable reply says where its JSON breaks and what was expected there, not "write every backslash twice"',()=>{
 const q=i=>JSON.stringify({title:'Skill '+i,q:'Q'+i,answer:'$2\\,\\mathrm{m}$',steps:['**Lead** one.','Check: **Back** two.']});
 const lost=q(3).replace('"steps":[','').replace(/\]\}$/,'}');
 const reply=json('{"kind":"test","title":"T","minutes":20,"questions":['+[q(1),q(2),lost,q(4),q(5)].join(',')+'],"gaps":[]}');
 const r=S.parseDeliver(reply,'test');assert.equal(r.ok,false);
 assert.match(r.errors[0],/^The reply has no readable JSON\. The JSON breaks at character \d+ of \d+, in "questions" item 3, after "answer": a text value stands where a field name should be; "steps":\[ seems to be missing before it\. There: "…[\s\S]*⟨here⟩"\*\*Lead\*\* one/);
 assert.doesNotMatch(r.errors[0],/backslash/);assert.ok(r.errors[0].length<=300,'fits the retry line');
 const f=S.jsonFault('{"a":[1,2 3]}');assert.equal(f.expected,'array');assert.equal(f.at,10);
 assert.match(S.parseDeliver(json('{"kind":"test","questions":[{"q":"a"} {"q":"b"}]}'),'test').errors[0],/The JSON breaks at character 39 of 49, after "questions" item 1: a comma or \] was expected, but "\{" came/);
 assert.match(S.parseDeliver(fence+'json\n{"kind":"test","title":"T","questions":[{"q":"a'+'\n'+fence,'test').errors[0],/It was cut off before the end/);
 assert.equal(S.jsonFault('{"a":"x \\s y","b":[true,null,-1.5e3]}'),null,'a TeX backslash is not a fault');
 // The runner's one retry carries it (buildDeliver keeps a fix line up to 300 characters).
 assert.ok(S.buildDeliver('test',{fix:r.errors}).includes('- '+r.errors[0]));
});

// ---- 5. a tag after a leading bold label ----
test('a Rule/Watch/Tip tag right after a leading bold label is drawn; the label stays as the lead and nothing is reworded',async()=>{
 const line=(text,note)=>({text,words:[],note,check:'A check.'});
 const f=band({t:aid({kind:'translate',title:'Lines',lines:[line('one two','**Lead words** Rule: the construction here.'),line('three four','**Label** some words and later Watch: not a tag.'),line('five six','Tip: **Lead** as asked.')],gaps:[]})});await f.view.loaded;
 const notes=f.find('ch-study-line-note');
 assert.equal(all(notes[0],'ch-mark')[0].dataset.mark,'rule');assert.equal(notes[0].textContent,'Lead words the construction here.');assert.equal(descendants(notes[0]).find(n=>n.tagName==='STRONG').textContent,'Lead words');
 assert.equal(all(notes[1],'ch-mark').length,0,'a tag later in the line is the AI\'s text, not a tag');assert.equal(notes[1].textContent,'Label some words and later Watch: not a tag.');
 assert.equal(all(notes[2],'ch-mark')[0].dataset.mark,'tip');
 assert.match(deliver('translate'),/a tag "Rule: ", "Watch: " or "Tip: ", when used, is the very first thing in the note, before its bold lead, as "Rule: \*\*<lead>\*\* <sentence>"; nothing, not even a bold label, comes before the tag/);
});

// ---- 6. passage references in "n" ----
test('"n" may carry a numbered passage\'s reference; the card shows it once per passage',async()=>{
 const line=(n,text)=>({...(n===undefined?{}:{n}),text,words:[],note:'',check:'c'});
 const r=S.parseDeliver(json({kind:'translate',title:'Passages',lines:[line('1.1','a'),line('1.1','b'),line('2.4','c'),line('2.17','d'),line('3:16','e'),line('12a','f'),line('1.1-2','g'),line('seven','h'),line('a very long reference 1','i'),line('','j'),line(7,'k')],gaps:[]}),'translate');
 assert.equal(r.ok,true,JSON.stringify(r.errors));assert.deepEqual(r.data.lines.map(l=>l.n),['1.1','1.1','2.4','2.17','3:16','12a','1.1-2',undefined,undefined,undefined,'7']);
 const f=band({t:aid({kind:'translate',title:'Passages',lines:[line('1.1','a'),line('1.1','b'),line('1.1','c'),line('2.4','d'),line('2.4','e')],gaps:[]})});await f.view.loaded;
 const rows=f.find('ch-study-row');assert.deepEqual(rows.map(b=>b.dataset.n),['1.1',undefined,undefined,'2.4',undefined]);
 assert.deepEqual(f.find('ch-study-line').map(li=>li.dataset.cont),[undefined,'true','true',undefined,'true']);
 assert.equal(f.find('ch-study-answer-tag')[1].getAttribute('aria-label'),'Show the translation of line 1.1','the button still names its passage');
 const p=deliver('translate');assert.match(p,/When the selection is made of separately numbered passages \(sections, chapters, verses or sayings\) instead of numbered lines, "n" is the reference of the passage the entry belongs to, written as the text writes it \("<book>\.<chapter>\.<verse>" style, at most 16 characters\), on every entry of that passage\./);
});

// ---- 7. scansion keeps every letter ----
test('a scansion that loses a letter of its line is dropped and the card stays; restored or added sounds are allowed',()=>{
 const scan=(text,s)=>{const r=S.parseDeliver(json({kind:'translate',title:'L',lines:[{text,scan:s,words:[],note:'',check:'c'},{text:'next',words:[],note:'',check:'d'}],gaps:[]}),'translate');assert.equal(r.ok,true,JSON.stringify(r.errors));assert.equal(r.data.lines.length,2);return r.data.lines[0].scan;};
 assert.ok(scan('arma virumque cano','ar– ma˘ vi˘ | rum– que˘ ca˘ | no–'));
 assert.equal(scan('arma virumque cano','ar– ma˘ vi˘ | rum– qu˘ ca˘ | no–'),undefined,'one letter lost: no scan');
 assert.equal(scan('arma virumque cano','ar– ma˘ | rum– que˘ ca˘ | no–'),undefined,'a syllable lost');
 assert.ok(scan('arma virumque cano','ar– ma˘ vi˘ | rum– qu(e)˘ ca˘ | no–'),'elided letters in ( ) count as the line\'s');
 assert.ok(scan('ab d’ illo tum','ab– d’(e) il˘ | lo– tum–'),'letters the text leaves out, restored in ( ), are free');
 const joined=scan('ab d’ illo tum','ab– d’ il˘ | lo– tum–');assert.equal(joined[1].t,'d’il','an elided word joins the next syllable across the space');
 assert.ok(scan('ab illo tum','a– b‿il˘ | lo– tum–'),'a tie ‿ across a word boundary');
 assert.equal(scan('ab illo tum','ab– il˘ | lo– tum– tum˘ tum˘ tum˘ tum˘'),undefined,'many added letters: not this line');
 const t=deliver('translate');assert.match(t,/Divide the syllables as the metre reads the line, across word boundaries: a consonant that ends one word may open the next word's syllable, and a syllable that joins two words is written as one unit, without a space inside it\. Every letter of the line appears in exactly one syllable, none left out and none written twice; letters lost to elision stay, in \( \) inside the syllable they join/);
});

// ---- 8. worked examples never reuse the assignment's questions ----
const MATERIALS='<<<SOURCE 1: Teacher instructions: Set 4>>>\nSet 4. Show all work. 40 points.\nRound answers to 2 decimal places and show 3 steps.\nPart A – Rates (8 pts)\nA shop raises a price from 4.00 to 5.00 dollars. Daily sales fall from 300 to 200.\nA1. Find the rate of change.\nB1. When average income in a town rises by 10%, the number of rides demanded falls by 5%. Classify the good.\nQ3. Trace this function.\n'+'def mystery(n):\n    if n <= 1:\n        return 1\n    return n + mystery(n // 2)\n'+'<<<END SOURCE 1>>>\n<<<SOURCE 2: Canvas brief (dates, other work, teacher messages)>>>\nUse g = 9.8 and round to 2 places. Quiz on 12 and 15 November with 20 questions in 45 minutes.\n<<<END SOURCE 2>>>\n';
test('a problem that repeats a question\'s code, wording or numbers is named; new data, common numbers alone and the brief are not',()=>{
 const card=problems=>({kind:'examples',problems:problems.map((p,i)=>({title:'K'+i,problem:p,steps:['a','b'],answer:'x'}))});
 const hit=S.copiedProblems(card(['Income rises 10%, so demand for the rides falls 5%. Classify it.','Trace `f(3)`.\n'+fence+'python\ndef mystery(n):\n    if n <= 1:\n        return 1\n    return n + mystery(n // 2)\n'+fence,'Sales fall from 300 to 200 in a week.','A price rises from 6 to 9 dollars; sales fall from 120 to 90.']),MATERIALS);
 assert.deepEqual(hit.map(h=>[h.index,h.labels]),[[0,['B1']],[1,['Q3']],[2,['Part A']]]);
 assert.equal(hit[0].text,'Problem 1 reuses the assignment\'s question B1 (its numbers 10, 5); make a new problem with new data instead.');assert.match(hit[1].text,/question Q3 \(its code\)/);
 const clean=S.copiedProblems(card(['A cart moves 10 m in 5 s. Find its speed.','Take g = 9.8 and round to 2 places; a ball falls 20 m.','The quiz has 20 questions in 45 minutes; how long per question?','Write `count(s)` without loops.','Round answers to 2 decimal places in all 3 parts of a new tank problem.']),MATERIALS);
 assert.deepEqual(clean,[],'small numbers without the question\'s words, a constant, the instructions around the questions and the brief never count');
 assert.deepEqual(S.copiedProblems({kind:'test',questions:[{q:'When average income in a town rises by 10%, the number of rides demanded falls by 5%.'}]},MATERIALS),[],'only worked examples are checked');
 assert.match(deliver('examples'),/Never solve the assignment's own questions, and never reuse their data: no problem repeats a question's sentence, its set of numbers or its code with only a name or one value changed\./);
});
test('worked examples that reuse a question get one retry naming it; a problem still copied after it is left out, the rest kept',async()=>{
 const Runner=require('../extension/ai-runner.js');let saved=null;
 const runner=Runner.create({canvas:{reader:()=>({cache:new Map(),read:async req=>({id:req.id,text:MATERIALS.split('\n').slice(1,9).join('\n')})}),validate:async()=>{}},results:{saveCards:async(run,cards)=>{saved=cards;return cards.length;}},account:{get:()=>({settings:{timeZone:'UTC'},toolbox:{}}),sync:async()=>{}},adapter:{},now:()=>Date.parse('2026-10-28T16:00:00Z'),uuid:()=>'x'});
 const make=()=>({id:'run-e',state:'gathering',mode:'prepare',phase:'deliver',picks:[{ref:'A1',make:'examples',focus:'',sources:[]}],pickIndex:0,made:[],errors:[],turns:[],messages:[],refs:{A1:{id:'12',courseId:'7',title:'Set 4'}},instructions:{standingText:''},settings:{},snapshot:{index:[['assignment:7:12',{id:'assignment:7:12',what:'assignment',title:'Set 4',courseId:'7',item:{courseName:'Course'}}]],snapshot:{items:[]},brief:{text:'brief'}}});
 const ctx={save:async r=>r,guard:async()=>{},signal:new AbortController().signal};
 const reply=(run,problems)=>{run.turns.push({id:'t'+run.turns.length,reply:json({kind:'examples',title:'Set',problems:problems.map((p,i)=>({title:'Kind '+i,problem:p,steps:['**A** b.','Check: **C** d.'],answer:'x'})),gaps:[]})});run.turnIndex=run.turns.length-1;run.state='awaiting-reply';};
 const copy='Income rises 10%, so demand for the rides falls 5%. Classify it.',fresh=['A cart moves 10 m in 5 s.','A tank fills at 3 L per minute.'];
 let run=make();await runner.step(run,ctx);reply(run,[copy,...fresh]);await runner.step(run,ctx);
 assert.equal(run.pickIndex,0,'the same item again');assert.deepEqual(run.picks[0].fix,['Problem 1 reuses the assignment\'s question B1 (its numbers 10, 5); make a new problem with new data instead.']);
 await runner.step(run,ctx);assert.match(run.messages[0].content,/Fix them in this answer:\n- Problem 1 reuses the assignment's question B1/);
 reply(run,[copy,...fresh]);await runner.step(run,ctx);assert.equal(run.pickIndex,1,'no third try');await runner.step(run,ctx);
 assert.deepEqual(saved[0].problems.map(p=>p.problem),fresh,'the copied problem is left out, the card stays');assert.match(run.errors.join(' '),/problems that reused the assignment's questions were left off/);
 saved=null;run=make();await runner.step(run,ctx);reply(run,fresh);await runner.step(run,ctx);await runner.step(run,ctx);assert.equal(run.picks[0].fix,undefined,'new problems: no retry');assert.equal(saved[0].problems.length,2);
});
