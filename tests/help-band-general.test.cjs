'use strict';
// Help band cards for every student on any school's Canvas (owner, 2026-10-28): scansion when the materials ask for it,
// in any metre or script; grammar labels that match the dictionary entry, or "gaps" instead of a guess; a parser that
// drops a bad optional field and never the card; and layout that holds for long words, any script (Greek, Cyrillic,
// CJK, Arabic, Hebrew), long maths and narrow widths. No prompt wording tuned to one subject or case.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../extension/study-prompts.js'),Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js');
const {dom,storage,descendants}=require('./study-fixture.cjs');
const css=fs.readFileSync(path.join(__dirname,'../extension/study-band.css'),'utf8');
const json=v=>'```json\n'+JSON.stringify(v)+'\n```';
const all=(root,cls)=>descendants(root).filter(n=>String(n.className||'').split(' ').includes(cls));
const translate=lines=>S.parseDeliver(json({kind:'translate',title:'Passage',lines,gaps:[]}),'translate');
const line=(text,scan,extra={})=>({text,...(scan===undefined?{}:{scan}),words:[],note:'',check:'A check translation.',...extra});
const scanOf=(text,scan)=>{const r=translate([line(text,scan)]);assert.equal(r.ok,true,JSON.stringify(r.errors));return r.data.lines[0].scan;};
const aid=(data,extra={})=>({kind:data.kind,title:data.title,data,savedAt:100,progress:{},...extra});
function band(aids,options={}){const d=dom(),host=new d.Element('div'),env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:false})},view=Band.renderBand(host,aids,{env,scope:'https://school.instructure.com|7',store:UI.createStore(env),...options});return {...d,host,view,find:cls=>descendants(host).filter(n=>String(n.className).split(' ').includes(cls))};}

// ---- prompts: rules and placeholder shapes only ----
test('the translate and test prompts carry general rules only: no subject, text, language or length tuned to a case',()=>{
 for(const make of ['translate','test','auto']){const p=S.buildDeliver(make,{});
  // (The shared maths rule's "Greek letters" and "Chemical formulas" are notation, not a subject.)
  assert.doesNotMatch(p,/Ovid|Vergil|Virgil|Homer|Ovid|solum|solo\b|hexameter|pentameter|dactyl|iamb|Latin|Arabic|chemistry|equilibrium|"minutes":\d|50 minutes/i,make);}
 const t=S.buildDeliver('translate',{});
 assert.match(t,/"scan": only on the lines the materials ask the student to scan, or on every line when they ask about the metre; never otherwise\./);
 assert.match(t,/– long or stressed, ˘ short or unstressed, × either/,'marks for quantitative and stress metres alike');
 assert.match(t,/feet \(or the metre's own units\) split by " \| " and the main caesura or pause as " ‖ "/);
 assert.match(t,/not sure of a line's scansion, leave "scan" out and say so in "gaps"/);
 assert.match(t,/every label in its "form" \(gender, declension or class, conjugation and so on\) must match that entry/);
 assert.match(t,/When you are not sure of a form, leave "form" "" and name the word in "gaps"; never guess\./);
 assert.match(t,/when the headword is not obvious from the word, start with it and a colon/);
 assert.match(t,/"scan":"<only when asked to scan: syl– syl˘ … \| syl– … ‖ …>"/,'a placeholder shape, no metre in it');
 const q=S.buildDeliver('test',{});
 assert.match(q,/"minutes":<whole number>/);assert.match(q,/- "minutes": how long this practice set takes; when the materials give the real test's length, size the set to it\./);
});

// ---- scansion: any metre, any script; kept only when it reads as a scansion of its line ----
test('a scansion is read in any script and metre: syllables with their marks, feet and the main caesura',()=>{
 assert.deepEqual(scanOf('μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος','μῆ– νιν˘ ἄ˘ | ει– δε˘ θε˘ | ὰ– ‖ Πη– | λη– ϊ˘ ά˘ | δεω– Ἀ˘ χι˘ | λῆ– ος×').map(s=>s.q).join(''),'–˘˘–˘˘–––˘˘–˘˘–×');
 const ru=scanOf('Мой дядя самых честных правил,','Мой˘ дя– | дя˘ са– | мых˘ чест– | ных˘ пра– | вил˘');assert.equal(ru.length,9);assert.deepEqual(ru.filter(s=>s.end).map(s=>s.end),['|','|','|','|']);
 const ar=scanOf('قفا نبك من ذكرى حبيب ومنزل','قِ˘ فا– نَبْ– | كِ˘ مِنْ– ذِكْ– رى– | حَ˘ بي– بِنْ– | وَ˘ مَنْ– زِ˘ لِي–');assert.equal(ar[0].t,'قِ');assert.equal(ar.length,14);
 const zh=scanOf('春眠不覺曉，處處聞啼鳥。','春– 眠– | 不˘ 覺˘ 曉˘ ‖ 處˘ 處˘ | 聞– 啼– 鳥˘');assert.equal(zh.length,10);assert.equal(zh[4].end,'‖');
 const en=scanOf('The curfew tolls the knell of parting day','The˘ cur– | few˘ tolls– | the˘ knell– | of˘ par– | ting˘ day–');assert.deepEqual(en.slice(0,2),[{t:'The',q:'˘'},{t:'cur',q:'–',end:'|'}]);
 // Elision in ( ) inside the syllable it joins, a caesura at a foot's end, marks set apart by a space, || for ‖.
 const el=scanOf('arma virumque cano','ar– ma˘ vi˘ | rum– qu(e)˘ ca˘ ||| no–');assert.equal(el[4].t,'qu(e)');assert.equal(el[5].end,'|‖');
 assert.equal(scanOf('arma virumque cano','ar – ma ˘ vi ˘ | rum – que ˘ ca ˘ || no –').length,7);
 assert.equal(scanOf('arma virumque cano','– ˘ ˘ | – ˘ ˘ | –').length,7,'marks alone, about as many as the line has syllables');
});
test('a scansion that is not one of its line is dropped and the line and card stay',()=>{
 const text='arma virumque cano Troiae qui primus ab oris';
 for(const bad of ['<only when asked to scan: syl– syl˘ … | syl– … ‖ …>','',' ','ar ma vi rum que ca no',
  'ar– ma˘ vi˘ rum– que˘ ca˘ no– Tro– iae– qui˘ pri– mus˘ ab˘ o– ris×','nec– me˘ a˘ | ni– mi˘ fal˘ | lit– quam– | sint– ob– | scu– ra˘ se˘ | da– cri–',
  'ar– ma˘ vi˘ rum– que˘ ca˘ no– Tro– iae– | qui˘ pri– mus˘ ab˘ | o– ris×','– ˘ | –',42,{scan:'ar–'},['ar–'],'a'.repeat(701),'ar– <b>ma˘</b> | vi˘']){
  const r=translate([line(text,bad),line('second line')]);assert.equal(r.ok,true,JSON.stringify([bad,r.errors]));assert.equal(r.data.lines.length,2);assert.equal(r.data.lines[0].text,text);assert.equal('scan' in r.data.lines[0],false,JSON.stringify(bad));}
});

// ---- graceful parsing: a bad optional field goes, never the card ----
test('odd optional parts from any model leave the card whole: words, forms, notes, choices and minutes',()=>{
 const r=translate([line('one two three',undefined,{words:[{word:'one',means:'1',form:7},{word:'',means:'x'},{word:'two'},null,'three',{word:'three',means:'3',form:'plural'}],note:{text:'x'}}),line('four')]);
 assert.equal(r.ok,true,JSON.stringify(r.errors));assert.deepEqual(r.data.lines[0].words,[{word:'one',means:'1',form:''},{word:'three',means:'3',form:'plural'}]);assert.equal(r.data.lines[0].note,'');
 assert.equal(translate([line('x',undefined,{words:Array.from({length:30},(_,i)=>({word:'w'+i,means:'m'}))})]).data.lines[0].words.length,12,'more words than fit are left out');
 const q=(i,extra={})=>({title:'Skill '+i,q:'Question '+i+'?',answer:'A',steps:['**Step** one.'],...extra});
 const t=S.parseDeliver(json({kind:'test',title:'Test',minutes:'50',questions:[q(1,{choices:[{text:'first'},2,'',null,'third']}),q(2,{choices:['only one']}),q(3,{choices:'A, B'}),q(4),q(5)],gaps:[]}),'test');
 assert.equal(t.ok,true,JSON.stringify(t.errors));assert.equal(t.data.minutes,50,'a number written as text still counts');assert.deepEqual(t.data.questions[0].choices,['first','2','third']);
 assert.equal('choices' in t.data.questions[1],false,'one choice is not multiple choice');assert.equal('choices' in t.data.questions[2],false);
 assert.equal(S.parseDeliver(json({kind:'test',title:'Test',minutes:'about an hour',questions:[1,2,3,4,5].map(i=>q(i)),gaps:[]}),'test').data.minutes,0);
});

// ---- the card: scansion first in the open line, each part in its own direction ----
test('an opened line shows its scansion over its words: marks, feet, caesura, and text in its own direction',async()=>{
 const r=translate([line('قفا نبك من ذكرى حبيب ومنزل','قِ˘ فا– نَبْ– | كِ˘ مِنْ– ذِكْ– رى– | حَ˘ بي– بِنْ– ‖ وَ˘ مَنْ– زِ˘ لِي×',{words:[{word:'قفا',means:'stop',form:'imperative, dual'}]}),line('second line')]);assert.equal(r.ok,true);
 const f=band({t:aid(r.data)});await f.view.loaded;
 const body=f.find('ch-study-row-body')[0];assert.deepEqual(body.children.slice(0,2).map(n=>n.className),['ch-study-scan','ch-study-words'],'the scansion sits above the word list');
 const scan=f.find('ch-study-scan')[0];assert.equal(scan.dir,'auto');assert.equal(f.find('ch-study-line-text')[0].dir,'auto');assert.equal(descendants(f.find('ch-study-words')[0]).find(n=>n.tagName==='DT').dir,'auto');
 assert.equal(all(scan,'ch-scan-syl').length,14);assert.deepEqual(all(scan,'ch-scan-syl').map(n=>n.dataset.q).slice(-2),['short','either']);
 assert.deepEqual(all(scan,'ch-scan-bar').map(n=>n.dataset.bar),['foot','foot','cut']);assert.equal(all(scan,'ch-scan-foot').length,4,'a narrow card can wrap only after a rule');
 const gloss=descendants(f.find('ch-study-word')[0]).find(n=>n.tagName==='DD');assert.equal(gloss.textContent,'stop · imperative, dual');assert.equal(all(gloss,'ch-study-form')[0].textContent,' · imperative, dual');
 const plain=band({t:aid(translate([line('no scansion here'),line('nor here')]).data)});await plain.view.loaded;assert.equal(plain.find('ch-study-scan').length,0,'no scansion unless the AI gave one');
});

// ---- layout rules that hold for any script, long words, long maths and narrow widths ----
test('the word list is one aligned grid; words break only past the cap, CJK too; maths in choices is full size and never widens the card',()=>{
 assert.match(css,/\.ch-study-words\{display:grid;grid-template-columns:fit-content\(min\(10\.5em,40%\)\) minmax\(0,1fr\)/);
 assert.match(css,/\.ch-study-word\{display:contents\}/);
 assert.match(css,/\.ch-study-word dt\{[^}]*min-width:0;overflow-wrap:break-word;word-break:keep-all/,'a word breaks only when it is longer than the cap');
 assert.match(css,/\.ch-study-word dd\{min-width:0;[^}]*overflow-wrap:break-word\}/);
 assert.match(css,/ol\.ch-study-choices math\.ch-math:not\(\[display=block\]\)\{math-style:normal\}/);
 assert.match(css,/:is\(\.ch-study-choices,\.ch-study-quiz-q,\.ch-study-quiz-answer\) math\.ch-math:not\(\[display=block\]\)\{max-width:100%;overflow-x:auto;overflow-y:hidden/);
 assert.match(css,/ol\.ch-study-choices\{display:grid;gap:7px;/);assert.match(css,/\.ch-study-choices\+\.ch-study-answer-tag\{margin-top:11px\}/);
 assert.match(css,/\.ch-scan-q\{[^}]*color:transparent;[^}]*mask:url/,'the marks are drawn, the characters stay for copy and screen readers');
 assert.match(css,/\.ch-scan-foot\{display:inline-flex;flex-wrap:wrap;align-items:stretch;max-width:100%/);
 assert.match(css,/\.ch-study-line \.ch-study-line-text\{text-align:start\}/,'a right-to-left line starts at the right');
});
test('the tabs of a stack share one height: a row stretches, and one two-line title gives every tab room for two',async()=>{
 assert.match(css,/\.ch-help-band \.ch-band-tabs\{[^}]*display:flex;flex-wrap:wrap;align-items:stretch/);
 assert.match(css,/\.ch-help-band \.ch-band-tabs\[data-tall\] \.ch-band-lap-t\{min-height:2\.4em\}/);
 const q=i=>({title:'Skill '+i,q:'Question '+i+'?',answer:'A',steps:['**Step** one.']}),test_=n=>({v:1,kind:'test',title:'Test',headline:'Course: Test',size:'xl',grid:4,importance:1,questions:Array.from({length:n},(_,i)=>q(i+1)),gaps:[]});
 const one=band({p:aid(test_(4),{courseId:'5'})});await one.view.loaded;let list=one.find('ch-band-tabs')[0];
 for(const t of one.find('ch-band-lap-tab')){t.children[0].offsetHeight=14;t.children[1].offsetHeight=14;}one.view.measure();assert.equal(list.dataset.tall,undefined,'one-line titles keep one line');
 one.find('ch-band-lap-tab')[2].children[1].offsetHeight=28;one.view.measure();assert.equal(list.dataset.tall,'true','a two-line title gives every tab room for two');
 one.find('ch-band-lap-tab')[1].fire('click');assert.equal(list.dataset.tall,'true','a swap changes no tab height');
});
