'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),ACTUAL=path.join(ROOT,'extension'),SOURCE=ACTUAL,changed=new Set();
function load(){
 const env=vm.createContext({Intl,URL,URLSearchParams}),cache=new Map();
 function source(name){
  assert.match(name,/^[a-z][a-z0-9/-]*\.(?:js|json)$/);assert.ok(!name.includes('..'));
  if(name.endsWith('.json')){assert.equal(name,'biscuit-rules/school-language.json','Only the real packaged language dictionary is permitted');return JSON.parse(fs.readFileSync(path.join(ACTUAL,name),'utf8'));}
  if(cache.has(name))return cache.get(name).exports;
  const file=path.join(changed.has(name)?SOURCE:ACTUAL,name),module={exports:{}};cache.set(name,module);
  const fn=new vm.Script('(function(module,exports,require){\n'+fs.readFileSync(file,'utf8')+'\n})',{filename:file}).runInContext(env);
  fn(module,module.exports,request=>{assert.ok(request.startsWith('./'),'Only runtime relative dependencies');return source(request.slice(2));});return module.exports;
 }
 return {source,get C(){return source('biscuit-control-request.js');},get S(){return source('biscuit-selection.js');},get R(){return source('biscuit-registry.js');},get F(){return source('biscuit-facts.js');},get E(){return source('biscuit-engine.js');}};
}
const plain=value=>JSON.parse(JSON.stringify(value)),fields=r=>r?.next?.fields||{},ids=r=>Array.from(r||[],x=>x.id),courses=[{id:'A',name:'Lantern Inquiry'},{id:'B',name:'River Archive'}];
const state=extra=>({now:Date.UTC(2031,3,7,12),timeZone:'UTC',courses:plain(courses),settings:{},features:[],...extra});
const row=(id,kind,title,extra={})=>({id,kind,title,courseId:'A',text:'Loaded material.',fields:{itemId:id},...extra});
const control=(id,title,text,extra={})=>row(id,'page',title,{text,pageType:'control',...extra});
function fact(h,line,s,session={}){return h.F.resolve(line,s,session,h.R.entries(s));}
function noMutation(r,line){assert.ok(!['setting','feature','module'].includes(r?.action),line);}
function attachmentScene(extra={}){
 const f=row('paper-a','file','Copper Fold Chart.pdf',{filename:'Copper Fold Chart.pdf'}),other=row('paper-b','file','Linen Drift Table.csv');
 const m=row('mail-a','message','Workshop reply',{attachmentIds:[f.id],unread:true});
 return state({selectedItemId:m.id,messages:[m],files:[f,other],...extra});
}
const tinyPack=label=>({schemaVersion:1,tier:'basic',features:{charMax:0},patterns:[],models:{action:{labels:[label],scale:1,weights:{bias:[4]}},item:{labels:['yes'],scale:1,weights:{bias:[0],title:[1]}}}});



test('a finite focus directive behind an unpunctuated narrative owns only its action clause',()=>{
 const h=load(),I=h.source('biscuit-intent.js');for(const [line,goal]of [['Attention negotiations complete start a seventeen minute focus round.','start a seventeen minute focus round.'],['My notebook is finally organized start the break clock for four minutes.','start the break clock for four minutes.'],['The kettle rang park the timer right where the countdown is.','park the timer right where the countdown is.']])assert.equal(I.requestGoal(line),goal,line);
});
test('reported, conditional, negated and literal timer instructions stay outside finite recovery',()=>{
 const h=load(),I=h.source('biscuit-intent.js');for(const line of ['I start the timer every morning.','The teacher said start a seventeen minute focus round.','I plan to start a seventeen minute focus round.','If the bell rings pause the timer.','Do not start a seventeen minute focus round.','Note: start a seventeen minute focus round.','Explain why I start the timer.','The note reads "start a seventeen minute focus round".'])assert.ok(!/^start a seventeen|^pause the|^park the/.test(I.requestGoal(line)),line);
});
test('a recovered local focus request does not require an invented assignment target',()=>{
 const h=load(),s=state(),I=h.source('biscuit-intent.js'),line='Attention negotiations complete start a seventeen minute focus round.',goal=I.requestGoal(line),r=h.source('biscuit-details.js').resolve('focus',goal,s,{},h.R.entries(s));assert.equal(r?.action,'focus');assert.equal(fields(r).minutes,17);assert.equal(fields(r).itemId,undefined);
});
test('parking a running countdown preserves its current remaining time',()=>{
 const h=load(),s=state({focus:{running:true,endsAt:Date.UTC(2031,3,7,12,12),mode:'focus'}}),I=h.source('biscuit-intent.js'),line='The kettle rang park the timer right where the countdown is.',goal=I.requestGoal(line);assert.equal(I.choose(line,s,{},'open/find',.95),'focus-control');const r=h.source('biscuit-details.js').resolve('focus-control',goal,s,{},h.R.entries(s));assert.equal(r?.action,'focus-control');assert.equal(fields(r).action,'pause');assert.equal(fields(r).minutes,undefined);
});
test('finite study-block removal remains local and retains the underlying coursework',()=>{
 const h=load(),I=h.source('biscuit-intent.js');for(const line of ['The meeting moved scratch the selected study block.','My afternoon changed take the selected study slot off today.'])assert.equal(I.choose(line,state(),{},'open/find',.99),'plan',line);
});


test('the real dispatcher uses recovered duration operands and pause semantics',()=>{
 const h=load(),s=state(),line='Attention negotiations complete start a seventeen minute focus round.',r=h.E.create({pack:tinyPack('open/find')}).evaluate(line,s,{});assert.equal(r.action,'focus');assert.equal(fields(r).minutes,17);assert.equal(fields(r).itemId,undefined);
 s.focus={running:true,endsAt:s.now+12*60000,mode:'focus'};const paused=h.E.create({pack:tinyPack('open/find')}).evaluate('The kettle rang park the timer right where the countdown is.',s,{});assert.equal(paused.action,'focus-control');assert.equal(fields(paused).action,'pause');
});
