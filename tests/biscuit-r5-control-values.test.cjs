'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Controls=require('../extension/biscuit-controls.js'),Request=require('../extension/biscuit-control-request.js');
const snapshot=()=>({now:1792684800000,settings:{showGrades:false},pet:{enabled:true,nudges:'helpful',xp:30,treats:5},courses:[],workItems:[]});
function expect(text,action,fields,s=snapshot(),session={},detail={}){
 const result=Request.resolve(action,text,s,session,detail);
 assert.ok(result,text);assert.equal(result.action,action,text);assert.equal(result.next.action,action,text);assert.deepEqual(result.next.fields,fields,text);assert.deepEqual(result.items,[],text);assert.equal(result.route,'local',text);assert.equal(result.routing.route,'local',text);return result;
}
function handoff(text,path,action='setting',detail={}){
 const result=Request.resolve(action,text,snapshot(),{},detail);
 assert.ok(result,text);assert.equal(result.action,'none',text);assert.equal(result.next.action,'none',text);assert.deepEqual(result.next.fields,{},text);assert.deepEqual(result.ui?.path,path,text);assert.equal(result.route,'local',text);return result;
}

test('motion requests emit the real setting key and supported finite values',()=>{
 for(const [text,value]of [['set animation to gentle','gentle'],['make the animation still','still'],['use less motion','still'],['turn motion off','off']]){
  const result=expect(text,'setting',{key:'motion',value});
  assert.ok(Object.hasOwn(Controls.DEFAULTS,result.next.fields.key));assert.ok(Controls.ENUMS.motion.includes(result.next.fields.value));
 }
});

test('legacy system theme requests use the existing choice handoff',()=>{
 for(const text of ['set the theme to system','make the interface automatic','follow the laptop theme']){
   const result=Request.resolve('setting',text,snapshot());assert.equal(result?.action,'none');assert.deepEqual(result?.next?.fields,{});assert.equal(result?.ui?.path,undefined);assert.match(result.message,/theme/i);
 }
});

test('supported appearance and grade visibility values remain executable and typed',()=>{
 for(const [text,key,value]of [['make the interface dark','theme','dark'],['make the interface light','theme','light'],['make the row spacing compact','density','compact'],['give the layout more breathing room','density','comfortable'],['hide my grades','showGrades',false],['show my scores','showGrades',true]]){
  const result=expect(text,'setting',{key,value});assert.ok(Object.hasOwn(Controls.DEFAULTS,key));
  if(Controls.ENUMS[key])assert.ok(Controls.ENUMS[key].includes(result.next.fields.value));else assert.equal(typeof result.next.fields.value,'boolean');
 }
});

test('companion roaming and size preserve Controls UI-only value handoffs',()=>{
 for(const [text,section,value]of [['let my pet roam everywhere','Where it goes','page'],['confine my companion to home','Where it goes','home'],['stop my pet wandering','Where it goes','off'],['make my companion small','Size','small'],['set pet size to medium','Size','medium'],['make my pet larger','Size','large']])handoff(text,['Make it yours','Pony',section,value]);
});

test('companion nudges distinguish supported executable values from the off handoff',()=>{
 expect('set pet nudges to helpful','setting',{key:'pet.nudges',value:'helpful'});
 expect('make companion tips quiet','setting',{key:'pet.nudges',value:'quiet'});
 handoff('turn pet nudges off',['Make it yours','Pony','Reminders','off']);
});

test('companion visibility retains the boolean setting contract',()=>{
 expect('show my pet','setting',{key:'pet.enabled',value:true});expect('hide my companion','setting',{key:'pet.enabled',value:false});
});

test('Home module operations respect the public required-panel handoff',()=>{
 for(const [text,key,action]of [['show Notes module on Home','notes','show'],['hide Clock module on Home','clock','hide'],['make Clock module wide','clock','wide'],['put Notes module first','notes','top']])expect(text,'module',{key,action});
 for(const key of ['work','reader'])for(const operation of ['show','hide','wide','top'])handoff('adjust this Home module',['Home',Controls.MODULES[key],'Size and place'],'module',{key,action:operation});
});

test('module metadata cannot introduce unknown keys or operations',()=>{
 for(const detail of [{key:'unknown-module',action:'hide'},{key:'constructor',action:'show'},{key:'__proto__',action:'wide'},{key:'notes',action:'erase'},{key:'notes',action:'constructor'},{key:'notes',action:'__proto__'}])assert.equal(Request.resolve('module','adjust this Home module',snapshot(),{},detail),null,JSON.stringify(detail));
});

test('feature dependency handoffs remain authoritative after contextual value inference',()=>{
 handoff('turn it off',['Make it yours','Features','Dashboard & assignments'],'feature',{id:'dashboard'});
 handoff('turn it off',['Make it yours','Features','Planner & home widgets'],'feature',{id:'planner'});
 handoff('turn it off',['Canvas Harness extension popup','Companion'],'feature',{id:'pony'});
 expect('turn it on','feature',{id:'focus-room',on:true},snapshot(),{},{id:'focus-room'});
 expect('turn it off','feature',{id:'grades',on:false},snapshot(),{},{id:'grades'});
 assert.equal(Request.resolve('feature','turn it on',snapshot(),{},{id:'unknown-feature'}),null);
});

test('unsupported values and inspection requests remain unhandled without mutating context',()=>{
 const s=snapshot(),session={lastItemId:'selected'},before=JSON.stringify({s,session});
 for(const text of ['set motion to turbo','set theme to sepia','set pet size to enormous','find the motion setting','open the theme preference','show the grade setting'])assert.equal(Request.resolve('setting',text,s,session),null,text);
 assert.equal(Request.resolve('ai','set the theme to system',s,session),null);
 for(const text of ['set the theme to system','turn motion off','hide my grades','make my pet larger'])Request.resolve('setting',text,s,session);
 assert.equal(JSON.stringify({s,session}),before);
});
