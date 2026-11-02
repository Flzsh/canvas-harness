'use strict';
// AI plan step 7: say what was not made. A reading or translation whose text is missing is the AI's answer, never
// retried (a retry pushes it to invent the text); every pick left out gets a short reason, and the band says
// "Not made: <item>: <reason>" after Ready until the next run. Made-up content only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const Study=require('../extension/study-prompts.js'),Runner=require('../extension/ai-runner.js'),Band=require('../extension/study-band.js'),UI=require('../extension/study-ui.js');
const {dom,storage,descendants}=require('./study-fixture.cjs');
const fence='```',json=v=>fence+'json\n'+JSON.stringify(v)+'\n'+fence;
const missing='The article text is not in the materials; open it from the course page and paste it.';

test('only a reading or translation with no text and a gap is the AI declining; other empty kinds keep their one retry',()=>{
 const reading=Study.parseDeliver(json({kind:'reading',title:'R',thesis:'',points:[],terms:[],check:[],gaps:[missing]}),'reading');
 assert.equal(reading.ok,false,'no text, no card');assert.equal(reading.refused,true);assert.deepEqual(reading.gaps,[missing]);
 assert.equal(Study.parseDeliver(json({kind:'translate',title:'T',lines:[],gaps:['The passage is not in the materials.']}),'translate').refused,true);
 assert.equal(Study.parseDeliver(json({kind:'reading',title:'R',thesis:'',points:[],terms:[],check:[],gaps:[]}),'reading').refused,undefined,'no gap: a fault, retried');
 for(const [kind,field] of [['test','questions'],['examples','problems'],['outline','sections']])
  assert.equal(Study.parseDeliver(json({kind,title:'X',[field]:[],gaps:[missing]}),kind).refused,undefined,kind+' must have parts: it is retried');
});

test('picks that name nothing CH can make are a fault; no picks at all still means nothing needs help',()=>{
 assert.deepEqual(Study.parsePicks(json({picks:[]})),{ok:true,data:{picks:[]}});
 const bad=Study.parsePicks(json({picks:[{ref:'A1',make:'summary'},{ref:'F2',make:'test'}]}));
 assert.equal(bad.ok,false);assert.equal(bad.unusable,true);assert.match(bad.errors[0],/listed item/);
});

function runner(){
 const saved=[],runner=Runner.create({canvas:{reader:()=>({cache:new Map(),read:async r=>({id:r.id,text:'x'})}),validate:async()=>{}},results:{saveCards:async(run,cards)=>{saved.push(...cards);return cards.length;}},account:{get:()=>({settings:{timeZone:'UTC'},toolbox:{}}),sync:async()=>{}},adapter:{},now:()=>0,uuid:()=>'u'});
 const run={id:'run-n',kind:'ask',mode:'prepare',phase:'deliver',state:'awaiting-reply',picks:[{ref:'A1',make:'reading'}],pickIndex:0,made:[],retries:0,refs:{A1:{id:'5',courseId:'2',title:'Chapter 4 reading'}},snapshot:{index:[],brief:{text:''}},turns:[{id:'t1',reply:json({kind:'reading',title:'Chapter 4',thesis:'',points:[],terms:[],check:[],gaps:[missing]})}],turnIndex:0,messages:[{role:'user',content:'prompt'}],errors:[],settings:{}};
 return {runner,run,saved,ctx:{save:async r=>r,guard:async()=>{},signal:new AbortController().signal}};
}

test('a declined reading is not asked again: the run names it, makes nothing up, and does not tell the student to try again',async()=>{
 const f=runner();
 await f.runner.step(f.run,f.ctx);
 assert.equal(f.run.state,'gathering');assert.equal(f.run.pickIndex,1);assert.equal(f.run.picks[0].fix,undefined,'no retry was set up');
 assert.deepEqual(f.run.notMade,[{title:'Chapter 4 reading',reason:missing,refused:true}]);
 await f.runner.step(f.run,f.ctx);
 assert.equal(f.run.state,'unchanged');assert.equal(f.run.progress,'Your AI could not make help for this item.');assert.equal(f.saved.length,0);
 assert.equal(f.run.turns.length,1,'one message only');
});

test('a reply that still cannot be read after its one retry is named with CH\'s own short reason',async()=>{
 const f=runner();f.run.picks[0].fix=['earlier fault'];f.run.turns[0].reply='not json';
 await f.runner.step(f.run,f.ctx);
 assert.deepEqual(f.run.notMade,[{title:'Chapter 4 reading',reason:'Your AI\'s answer could not be read.'}]);
 await f.runner.step(f.run,f.ctx);assert.match(f.run.progress,/Try Help with this again\.$/,'a fault can be tried again');
});

function band(){const d=dom(),host=new d.Element('div'),timers=[],env={document:d.document,chrome:{storage:{local:storage()}},matchMedia:()=>({matches:false}),setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}},store=UI.createStore(env);
 const view=Band.renderBand(host,{},{env,scope:'https://canvas.test|7',store,timeZone:'UTC',now:()=>0,onProgress:()=>{},onPrepare:async()=>null});
 const has=cls=>n=>String(n.className||'').split(' ').includes(cls),line=()=>descendants(host).find(has('ch-prepare-status')),row=()=>descendants(host).find(has('ch-band-notmade'));
 return {view,timers,line,row,items:()=>row().hidden?[]:descendants(row()).filter(has('ch-band-notmade-item')).map(n=>n.textContent)};}
const notMade=[{title:'Chapter 4 reading',reason:missing},{title:'Lab 3',reason:'Your AI stopped before making it'}];

test('a run that left items out says so in a row of its own, one sentence each, and it stays until the next run',async()=>{
 const f=band();await f.view.loaded;
 f.view.prepare({id:'run-1',state:'gathering',revision:1,entry:'band'});assert.deepEqual(f.items(),[]);
 f.view.prepare({id:'run-1',state:'cards-ready',revision:2,entry:'band',made:1,progress:'Ready · 1 card',notMade});
 assert.deepEqual(f.items(),['Not made: Chapter 4 reading: '+missing,'Not made: Lab 3: Your AI stopped before making it.']);
 assert.equal(f.line().hidden,false,'Ready still has its moment');
 for(const fn of f.timers.splice(0))fn();
 assert.equal(f.line().hidden,true,'the status line goes as before');assert.equal(f.items().length,2,'the row stays');
 f.view.prepare({id:'run-1',state:'cards-ready',revision:2,entry:'band',made:1,progress:'Ready · 1 card',notMade});assert.equal(f.items().length,2,'the same status again changes nothing');
 f.view.prepare({id:'run-2',state:'scanning',revision:1,entry:'band'});assert.deepEqual(f.items(),[],'the next run clears it');
});

test('a run that made nothing says so too; a visit\'s run and a run with nothing left out stay quiet',async()=>{
 const f=band();await f.view.loaded;
 f.view.prepare({id:'run-3',state:'gathering',revision:1,entry:'band'});
 f.view.prepare({id:'run-3',state:'unchanged',revision:2,entry:'band',progress:'Your AI could not make today\'s help.',notMade:notMade.slice(0,1)});
 assert.deepEqual(f.items(),['Not made: Chapter 4 reading: '+missing]);
 f.view.prepare({id:'run-4',state:'unchanged',revision:2,entry:'visit',notMade});assert.deepEqual(f.items(),[]);
 const g=band();await g.view.loaded;g.view.prepare({id:'run-5',state:'gathering',revision:1,entry:'band'});g.view.prepare({id:'run-5',state:'cards-ready',revision:2,entry:'band',made:2,progress:'Ready · 2 cards'});
 assert.deepEqual(g.items(),[]);for(const fn of g.timers.splice(0))fn();assert.equal(g.line().hidden,true);
});
