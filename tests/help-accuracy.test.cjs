'use strict';
// Owner, 2026-10-26: weaker models (medium effort, Instant, the free model) must be held back from wrong facts,
// invented content and filler. The instructions put accuracy first; a reading's quotes are checked against the
// materials, and a reply that fails gets one fresh try told exactly what was wrong.
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../extension/study-prompts.js'),Runner=require('../extension/ai-runner.js'),fence='```';
const READING='Reason is not merely a tool for achieving goals determined by desires. Following Kant, the author argues that practical reason lets us evaluate, justify and revise our goals by moral principles, which makes autonomy and human dignity possible.';

test('every kind of help is told accuracy comes first, to check each answer another way, and never to invent quotes or file contents',()=>{
 for(const make of ['test','reading','translate','examples','auto']){const p=S.buildDeliver(make,{item:'Course · Item',sources:[{label:'Teacher instructions',text:'Do it.'}]});
  assert.match(p,/Accuracy comes first\. Work out every answer in full before you write it, then check it another way/,make);assert.match(p,/fewer correct items beat more doubtful ones/,make);assert.match(p,/Never invent quotes, page numbers, data, names or what a file says/,make);assert.doesNotMatch(p,/Fix them in this answer/,make);}
 assert.match(S.buildDeliver('examples',{}),/the last step checks the answer/);assert.match(S.buildDeliver('test',{}),/for a calculation the last step checks the answer/);
 assert.match(S.buildDeliver('reading',{}),/copied word for word from the reading in the materials[^\n]*"quote" is ""/);
 const fixed=S.buildDeliver('reading',{fix:['These quotes are not in the materials word for word: "x".']});assert.match(fixed,/Your last answer for this item had these problems\. Fix them in this answer:\n- These quotes are not in the materials/);
});

test('a quote counts when it is in the materials word for word: case, curly quotes, an ellipsis and the page after it do not matter',()=>{
 const mat='<<<SOURCE 1: Reading>>>\n'+READING+'\n<<<END SOURCE 1>>>';
 assert.deepEqual(S.unfoundQuotes({points:[{text:'a',quote:'“Reason is not merely a tool for achieving goals,” p. 3'},{text:'b',quote:'practical reason lets us evaluate … revise our goals (pp. 4–5)'},{text:'c',quote:''},{text:'d',quote:'Reason is the slave of the passions'},{text:'e',quote:'autonomy and human dignity possible'}]},mat),['Reason is the slave of the passions']);
});

function setup(){
 let saved=null;const runner=Runner.create({canvas:{reader:()=>({cache:new Map(),read:async req=>({id:req.id,text:req.id.startsWith('file')?READING:'Read the article and come ready to discuss.'})}),validate:async()=>{}},results:{saveCards:async(run,cards)=>{saved=cards;return cards.length;}},account:{get:()=>({settings:{timeZone:'UTC'},toolbox:{}}),sync:async()=>{}},adapter:{},now:()=>Date.parse('2026-10-26T16:00:00Z'),uuid:()=>'x'});
 const run={id:'run-q',state:'gathering',mode:'prepare',phase:'deliver',picks:[{ref:'A1',make:'reading',focus:'',sources:['F1']}],pickIndex:0,made:[],errors:[],turns:[],messages:[],refs:{A1:{id:'12',courseId:'7',title:'Homework for Monday'},F1:{id:'file:7:55',source:true,title:'Article.pdf'}},instructions:{standingText:''},settings:{},
  snapshot:{index:[['assignment:7:12',{id:'assignment:7:12',what:'assignment',title:'Homework for Monday',courseId:'7',item:{courseName:'Ethics'}}],['file:7:55',{id:'file:7:55',what:'pdf',title:'Article.pdf',courseId:'7',canvasId:'55'}]],snapshot:{items:[]},brief:{text:'brief'}}};
 const ctx={save:async r=>r,guard:async()=>{},signal:new AbortController().signal},reply=text=>{run.turns.push({id:'turn-'+run.turns.length,reply:fence+'json\n'+text+'\n'+fence});run.turnIndex=run.turns.length-1;run.state='awaiting-reply';};
 return {runner,run,ctx,reply,saved:()=>saved};
}
const reading=quote=>JSON.stringify({kind:'reading',title:'Article',thesis:'Reason does more than serve desire.',points:Array.from({length:5},(_,i)=>({text:'Claim '+(i+1)+' of the argument and why.',quote:i===0?quote:'practical reason lets us evaluate, justify and revise our goals'})),terms:[{term:'Reason',means:'The power to justify goals.'},{term:'Autonomy',means:'Setting one\'s own law.'},{term:'Dignity',means:'Worth beyond price.'}],check:[{q:'What is reason for?',answer:'Revising goals.'},{q:'Why Kant?',answer:'Autonomy.'},{q:'What follows?',answer:'Dignity.'}],gaps:[]});

test('a reading with a quote that is not in the materials gets one fresh try told which quote; still not found, the quote is left off and the point stays',async()=>{
 const {runner,run,ctx,reply,saved}=setup();
 await runner.step(run,ctx);assert.equal(run.state,'asking');assert.doesNotMatch(run.messages[0].content,/Fix them/);
 reply(reading('Reason is the slave of the passions'));await runner.step(run,ctx);
 assert.equal(run.state,'gathering');assert.equal(run.pickIndex,0,'the same item again');assert.match(run.picks[0].fix[0],/not in the materials word for word: "Reason is the slave of the passions"/);
 await runner.step(run,ctx);assert.equal(run.state,'asking');assert.match(run.messages[0].content,/Fix them in this answer:\n- These quotes are not in the materials word for word: "Reason is the slave of the passions"/);
 reply(reading('Reason is the slave of the passions'));await runner.step(run,ctx);assert.equal(run.pickIndex,1,'no third try');
 await runner.step(run,ctx);const card=saved()[0];assert.equal(card.points.length,5);assert.equal(card.points[0].quote,'');assert.equal(card.points[1].quote,'practical reason lets us evaluate, justify and revise our goals');assert.match(run.errors.join(' '),/quotes not in the materials were left off/);
});

test('a reading whose quotes are all in the materials is kept on the first try; an unreadable reply gets one fresh try, then is left out',async()=>{
 const a=setup();await a.runner.step(a.run,a.ctx);a.reply(reading('Reason is not merely a tool for achieving goals'));await a.runner.step(a.run,a.ctx);assert.equal(a.run.pickIndex,1);assert.equal(a.run.picks[0].fix,undefined);
 const b=setup();await b.runner.step(b.run,b.ctx);b.reply('not json');await b.runner.step(b.run,b.ctx);assert.equal(b.run.pickIndex,0);assert.match(b.run.picks[0].fix[0],/no readable JSON/);
 await b.runner.step(b.run,b.ctx);assert.match(b.run.messages[0].content,/Fix them in this answer:\n- The reply has no readable JSON/);b.reply('still not json');await b.runner.step(b.run,b.ctx);assert.equal(b.run.pickIndex,1);assert.match(b.run.errors.join(' '),/reading: The reply has no readable JSON/);
});
