'use strict';
// Owner-approved 2026-10-28: translation help gets one hidden self-check. After the card reads, CH asks the same chat to
// check every headword, form label, meaning, check translation, romanisation and scansion against dictionary knowledge
// and the text, and to send the whole corrected card. CH keeps the checked card only when it reads and keeps the same
// lines; a diff, prose, a file request, a stop or anything else leaves the first card. The student sees one card.
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../extension/study-prompts.js'),Runner=require('../extension/ai-runner.js'),fence='```';
const json=v=>fence+'json\n'+(typeof v==='string'?v:JSON.stringify(v))+'\n'+fence;
const line=(n,text,form)=>({n:String(n),text,words:[{word:text.split(' ')[0],means:'meaning '+n,form}],note:'',check:'check '+n});
const FIRST={kind:'translate',title:'Lines 1-3',lines:[line(1,'alpha beta','nom. sg.'),line(2,'gamma delta','acc. pl.'),line(3,'epsilon zeta','dat. sg.')],gaps:[]};
const CHECKED={...FIRST,lines:[FIRST.lines[0],{...FIRST.lines[1],words:[{word:'gamma',means:'meaning 2',form:'gen. pl.'}]},{...FIRST.lines[2],words:[{word:'epsilon',means:'meaning 3',form:''}]}],gaps:['Line 3: the form of epsilon is uncertain.'],changed:['Line 2: gamma is genitive plural.','Line 3: removed a doubtful form.']};

function setup(make='translate',replies=[]){
 let saved=null;const turns=[],queue=[...replies];
 const adapter={deliver:async turn=>{turns.push(turn);const next=queue.shift();if(next&&typeof next==='object')return next;return {status:'reply',receipt:{status:'sent'},reply:next};}};
 const runner=Runner.create({canvas:{reader:()=>({cache:new Map(),read:async req=>({id:req.id,text:'Translate lines 1-3 of the passage: alpha beta / gamma delta / epsilon zeta.'})}),validate:async()=>{}},results:{saveCards:async(run,cards)=>{saved=cards;return cards.length;}},account:{get:()=>({settings:{timeZone:'UTC'},toolbox:{}}),sync:async()=>{}},adapter,now:()=>Date.parse('2026-10-28T16:00:00Z'),uuid:(()=>{let n=0;return ()=>'u'+(++n);})()});
 const run={id:'run-t',state:'gathering',mode:'prepare',phase:'deliver',picks:[{ref:'A1',make,focus:'',sources:[]}],pickIndex:0,made:[],errors:[],turns:[],messages:[],retries:0,refs:{A1:{id:'12',courseId:'7',title:'Homework'}},instructions:{standingText:''},settings:{},snapshot:{index:[['assignment:7:12',{id:'assignment:7:12',what:'assignment',title:'Homework',courseId:'7',item:{courseName:'Course'}}]],snapshot:{items:[]},brief:{text:'brief'}}};
 const ctx={save:async r=>r,guard:async()=>{},signal:new AbortController().signal,claimProvider:async()=>{}},seen=[];
 async function drive(){for(let i=0;i<30&&run.state!=='publishing';i++){await runner.step(run,ctx);seen.push(run.progress);}return run;}
 return {run,drive,turns,seen,saved:()=>saved};
}

test('a translation is checked once in the same chat; a checked card that keeps the lines replaces the first',async()=>{
 const f=setup('translate',[json(FIRST),json(CHECKED)]);await f.drive();
 assert.equal(f.turns.length,2,'one deliverable turn and one check turn');assert.equal(f.turns[0].fresh,true,'the deliverable opens its own chat');
 assert.equal(f.turns[1].fresh,undefined,'the check follows in the same chat');assert.equal(f.turns[1].text,S.buildCheck());
 assert.deepEqual(f.turns[1].messages.map(m=>m.role),['user','assistant','user'],'the API way carries the card it checks');
 assert.ok(f.seen.includes('Checking the translation'),'the progress line says it is checking');
 const card=f.saved()[0];assert.equal(f.saved().length,1,'the student sees one card');assert.equal(card.lines[1].words[0].form,'gen. pl.');assert.equal(card.lines[2].words[0].form,'','a doubtful form removed');assert.deepEqual(card.gaps,['Line 3: the form of epsilon is uncertain.']);
 assert.equal(card.changed,undefined,'the change list is not shown');assert.equal(f.run.picks[0].checked,'checked');assert.equal(f.run.picks[0].changed,2);assert.equal(f.run.picks[0].first,undefined);
});
test('a diff, prose, a file request or changed lines leave the first card',async()=>{
 const diff={kind:'translate',title:'Lines 1-3',lines:[CHECKED.lines[1]],gaps:[]},moved={...CHECKED,lines:[{...CHECKED.lines[0],text:'alpha beta!'},CHECKED.lines[1],CHECKED.lines[2]]},stripped={...FIRST,lines:FIRST.lines.map(l=>({...l,words:[]}))};
 for(const [name,reply] of [['diff',json(diff)],['prose','Everything checks out: line 2 should be genitive plural.'],['file request',json({read:['L1']})],['changed lines',json(moved)],['glosses dropped',json(stripped)],['another kind',json({kind:'test',title:'T',questions:[]})],['broken JSON',fence+'json\n{"kind":"translate","lines":[\n'+fence]]){
  const f=setup('translate',[json(FIRST),reply]);await f.drive();
  assert.equal(f.turns.length,2,name);assert.equal(f.saved().length,1,name);assert.equal(f.saved()[0].lines[1].words[0].form,'acc. pl.',name+': the first card stands');assert.equal(f.run.picks[0].checked,'first',name);
 }
});
test('a check turn that stops or needs the student leaves the first card: no retry, no question to the student',async()=>{
 for(const action of ['Try again','Review draft','Open chat']){
  const f=setup('translate',[json(FIRST),{status:'needs-you',receipt:{status:'target'},needsYou:{reason:'The AI stopped before answering',action}}]);await f.drive();
  assert.equal(f.run.state,'publishing',action);assert.equal(f.turns.length,2,action+': no fresh retry of the check');assert.equal(f.run.needsYou,undefined);
  assert.equal(f.saved()[0].lines[1].words[0].form,'acc. pl.');assert.equal(f.run.picks[0].checked,'first');assert.equal(f.run.checking,false);
 }
});
test('only translation help is checked: a practice test is kept on its first reply; an auto pick that becomes a translation is checked',async()=>{
 const q=i=>({title:'Skill '+i,q:'Q'+i+'?',answer:'a',steps:['**Lead** one.']});
 const t=setup('test',[json({kind:'test',title:'T',questions:[1,2,3,4,5].map(q),gaps:[]})]);await t.drive();
 assert.equal(t.turns.length,1);assert.equal(t.saved()[0].questions.length,5);assert.equal(t.run.picks[0].checked,undefined);
 const a=setup('auto',[json(FIRST),json(CHECKED)]);await a.drive();
 assert.equal(a.turns.length,2);assert.equal(a.saved()[0].kind,'translate');assert.equal(a.saved()[0].lines[1].words[0].form,'gen. pl.');
});
test('the check asks for every label, gloss, check translation and scan against the dictionary and the text, with general rules only',()=>{
 const p=S.buildCheck();
 for(const part of ['every headword, with its spelling, accents, diacritics or tone marks exactly as its dictionary entry has them','every form label (gender, case, number, declension or class, tense, mood, voice, person)','the sense that fits this line','read on its own as a translation of its line','any pronunciation or romanisation, and any "scan" (every letter of the line in exactly one syllable','Reply with the full corrected card in the same JSON shape: every line, each "text" exactly as it is, changing only what is wrong','"changed": a list of at most 8 short notes','set that "form" to "" or leave that "scan" out, and name it in "gaps"'])assert.ok(p.includes(part),part);
 assert.doesNotMatch(p,/Latin|Greek|German|Chinese|Homer|Goethe|hexameter|pinyin/i,'no language or text named');
 const ok=S.checkedTranslate(S.parseDeliver(json(FIRST),'translate').data,json(CHECKED));assert.equal(ok.ok,true);assert.deepEqual(ok.changed,CHECKED.changed);
 assert.equal(S.checkedTranslate(S.parseDeliver(json(FIRST),'translate').data,'no json').ok,false);
});
