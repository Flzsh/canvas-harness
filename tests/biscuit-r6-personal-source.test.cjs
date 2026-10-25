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


const personalScene=()=>{const canvas=row('canvas-a','assignment','Copper Reflection',{dueAt:Date.UTC(2031,3,9,12)}),local=row('local-a','assignment',canvas.title,{dueAt:Date.UTC(2031,3,8,12)});return state({assignments:[canvas],personalTasks:[local]});};
test('explicit personal todo provenance disambiguates a duplicate school title',()=>{
 for(const line of ['Mark my personal Copper Reflection todo done.','Check off Copper Reflection in my planner now.','Complete my local task Copper Reflection.']){const h=load(),s=personalScene(),rows=h.R.entries(s),r=h.S.reference(line,rows,s,{}, {actor:'complete'});assert.equal(r.row?.id,'local-a',line);assert.equal(r.explicit,true);}
});
test('without personal provenance identical titles retain their ambiguity',()=>{const h=load(),s=personalScene(),r=h.S.reference('Complete Copper Reflection.',h.R.entries(s),s,{}, {actor:'complete'});assert.equal(r.row,null);assert.equal(r.explicit,true);});
test('an explicit missing local owner cannot mutate the identically titled Canvas item',()=>{const h=load(),s=personalScene();s.personalTasks=[];const r=h.S.reference('Complete my personal Copper Reflection todo.',h.R.entries(s),s,{}, {actor:'complete'});assert.equal(r.row,null);assert.equal(r.explicit,true);});
test('a personal word inside the exact assignment title is title text rather than origin permission',()=>{const h=load(),s=personalScene();s.assignments[0].title='Personal Reflection';s.personalTasks[0].title='Other task';const r=h.S.reference('Complete my Personal Reflection.',h.R.entries(s),s,{}, {actor:'complete'});assert.equal(r.row?.id,'canvas-a');});
test('real learned and legacy completion dispatch agree on an explicitly local copy',()=>{for(const pack of [undefined,tinyPack('complete')]){const h=load(),s=personalScene(),r=h.E.create(pack?{pack}:{}).evaluate('Mark my personal Copper Reflection todo done.',s,{});assert.equal(r.action,'complete');assert.equal(fields(r).itemId,'local-a');}});
test('a trailing confusion rationale does not replace a confident recorded-fact lookup',()=>{const h=load(),I=h.source('biscuit-intent.js'),s=state();assert.equal(I.choose('Meeting entrance please; I keep mixing it with the conference room.',s,{},'open/find',.94),'open/find');assert.equal(I.choose('I keep mixing these concepts; explain the distinction.',s,{},'open/find',.94),'ai');assert.equal(I.choose('I do not understand the reasoning in this notice.',s,{},'open/find',.94),'ai');});
test('a quoted or reported completion command cannot become a finite request',()=>{const h=load(),I=h.source('biscuit-intent.js'),s=personalScene();for(const line of ['I said mark my task done.','I plan to mark my task done.','I would mark my task done if it were finished.','The note reads "mark my task done".'])assert.notEqual(I.choose(line,s,{},'open/find',.95),'complete',line);});
test('a positive embedded completion directive keeps its own object after past-tense background',()=>{const h=load(),I=h.source('biscuit-intent.js'),s=personalScene(),line='I packed both printed copies mark my personal Copper Reflection todo done.';assert.equal(I.choose(line,s,{},'open/find',.95),'complete');});


test('personal work provenance also survives the actual workItems provider normalization',()=>{
 const h=load(),s=personalScene();s.workItems=[{...s.personalTasks[0],kind:'personal',courseId:''}];s.personalTasks=[];const r=h.E.create({pack:tinyPack('complete')}).evaluate('Mark my personal Copper Reflection task complete.',s,{});assert.equal(r.action,'complete');assert.equal(fields(r).itemId,'local-a');
});
