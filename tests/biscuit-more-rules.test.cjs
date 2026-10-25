'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),F=require('../extension/features.js'),B=require('../extension/pony-brain.js'),A=require('../extension/pony-ask.js'),{fixture}=require('./biscuit-public-fixture.cjs');
const ID='biscuit-more-rules',plain=value=>JSON.parse(JSON.stringify(value)),flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();},deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function companion({on=true,knowledge='basic',globalOn=!on,load=()=>Promise.resolve(),features,actions={},evaluate}={}){
 const calls=[],snapshots=[],previews=[],sessions=[],data={features:features??F.catalogue.map(row=>({...row,on:row.id===ID?on:true})),catalogue:[{id:'moth',name:'Moon Moth',kind:'pet',current:true}]};
 const loader={load:tier=>{calls.push(tier);return load(tier);}},brain={...B,evaluate:(snapshot,...args)=>{snapshots.push(plain(snapshot));return B.evaluate(snapshot,...args);}};
 const engine={create:()=>({offer:()=>null,evaluate:(text,snapshot,session)=>{previews.push(plain(snapshot));sessions.push(plain(session));return evaluate?evaluate(text,snapshot,session):{message:(snapshot.biscuitMoreRules?'full:':'basic:')+snapshot.pet.knowledge,next:{action:'chat',fields:{}},items:[]};}})};
 const f=fixture({brain,ask:A,engine,parser:{parse:()=>[]},actions,initialPet:{knowledge,name:'Pip',nudges:'off'},info:()=>data},{ReserveBiscuitEngine:engine,ReserveBiscuitRules:loader,ReserveFeatures:{enabled:()=>globalOn}});
 return Object.assign(f,{calls,snapshots,previews,sessions,data,on(value){data.features.find(row=>row.id===ID).on=value;f.controller.sync();},open(text='hello'){if(f.bubble)f.node.emit('click');f.node.emit('click');const input=new f.Element(),line=new f.Element(),suggestions=new f.Element();input.value=text;input.setAttribute('data-pet-question','');input.parentNode=f.bubble;f.bubble.slots={'[data-pet-question]':input,'[data-pet-preview]':line,'[data-pet-suggestions]':suggestions};f.bubble.emit('input',{target:input});f.advance(30);return {input,line};}});
}
for(const knowledge of ['more','most'])test('switch off requests only Basic while preserving stored '+knowledge+' and the owner catalogue',async t=>{
 const f=companion({on:false,knowledge,globalOn:true});t.after(()=>f.controller.destroy());await flush();assert.deepEqual(f.calls,['basic']);assert.equal(f.snapshots.at(-1).biscuitMoreRules,false);assert.equal(f.snapshots.at(-1).pet.knowledge,knowledge);assert.equal(f.controller.pet.knowledge,knowledge);assert.equal(f.controller.pet.name,'Pip');assert.deepEqual(f.snapshots.at(-1).catalogue,f.data.catalogue);
 f.setPet({knowledge:knowledge==='more'?'most':'more'});await flush();assert.deepEqual(f.calls,['basic']);
});
test('Basic under the enabled add-on still requests Basic only despite conflicting global flags',async t=>{
 const f=companion({on:true,knowledge:'basic',globalOn:false});t.after(()=>f.controller.destroy());await flush();f.controller.sync();await flush();assert.deepEqual(f.calls,['basic']);assert.equal(f.snapshots.at(-1).biscuitMoreRules,true);assert.equal(f.snapshots.at(-1).pet.knowledge,'basic');
});
test('restoring the add-on and changing the choice load the current saved tier without resetting it',async t=>{
 const f=companion({on:false,knowledge:'most'});t.after(()=>f.controller.destroy());await flush();f.on(true);await flush();f.setPet({knowledge:'more'});await flush();f.on(false);await flush();f.on(true);await flush();
 assert.deepEqual(f.calls,['basic','most','more','basic','more']);assert.equal(f.controller.pet.knowledge,'more');assert.equal(f.controller.pet.name,'Pip');assert.equal(f.snapshots.at(-1).biscuitMoreRules,true);
});
test('a switch disabled before the lazy callback starts never requests a larger pack',async t=>{
 const f=companion({on:true,knowledge:'most'});t.after(()=>f.controller.destroy());f.on(false);await flush();assert.deepEqual(f.calls,['basic']);assert.equal(f.snapshots.at(-1).biscuitMoreRules,false);
});
test('switching off immediately refreshes the open preview and ignores a late larger-pack completion',async t=>{
 const pending=new Map(),f=companion({on:true,knowledge:'most',load:tier=>{const value=deferred();pending.set(tier,value);return value.promise;}});t.after(()=>f.controller.destroy());const {line,input}=f.open();await flush();assert.equal(line.textContent,'full:most');
 f.on(false);await flush();assert.deepEqual(f.calls,['most','basic']);assert.equal(line.textContent,'basic:most');assert.equal(f.previews.at(-1).biscuitMoreRules,false);assert.equal(input.value,'hello');
 pending.get('basic').resolve();await flush();const count=f.previews.length;pending.get('most').resolve();await flush();assert.equal(f.previews.length,count);assert.equal(line.textContent,'basic:most');assert.equal(f.controller.pet.knowledge,'most');
});
test('an explicit compatibility feature map can disable larger rules without consulting globals',async t=>{
 const f=companion({knowledge:'most',features:{[ID]:false},globalOn:true});t.after(()=>f.controller.destroy());await flush();assert.deepEqual(f.calls,['basic']);assert.equal(f.snapshots.at(-1).biscuitMoreRules,false);
});
for(const features of [[],{},[{id:'pony',on:true}],[{id:ID}],{[ID]:undefined},{[ID]:'true'}])test('snapshots without an explicit More rules opt-in load only Basic: '+JSON.stringify(features),async t=>{
 const f=companion({features,knowledge:'most',globalOn:true});t.after(()=>f.controller.destroy());await flush();assert.deepEqual(f.calls,['basic']);assert.equal(f.controller.pet.knowledge,'most');assert.equal(f.snapshots.at(-1).biscuitMoreRules,false);
});
async function enter(f,text='hello'){const {input}=f.open(text);await flush();f.bubble.emit('keydown',{target:input,key:'Enter',preventDefault(){},stopPropagation(){}});await flush();}
for(const intent of ['note','bookmark','reminder','plan'])test('successful '+intent+' commands expose only their actual bounded result metadata in the next engine session',async t=>{
 const at=Date.UTC(2026,9,22,18),before={id:'actual-'+intent,title:'Original title',text:'Original text',courseId:'7',url:'https://example.edu/entry',at,startAt:at,endAt:at+60000,grades:{secret:'PRIVATE_GRADE'},settings:{secret:'PRIVATE_STORE'},tasks:{secret:'PRIVATE_STORE'}},after={...before,title:'Saved title',text:'Saved text',at:at+60000,endAt:at+120000};
 const operation={note:'delete',bookmark:'delete',reminder:'cancel',plan:'remove-block'}[intent],fields={operation,itemId:'work-7',courseId:'7',...(intent==='note'?{}:{targetId:'requested-'+intent})},keys={note:['id','title','text','courseId'],bookmark:['id','title','courseId','url'],reminder:['id','title','text','at','courseId'],plan:['id','title','courseId','startAt','endAt']}[intent],pick=value=>Object.fromEntries(keys.map(key=>[key,value[key]]));
 const result={ok:true,before,after,message:'Saved.',undo:async()=>({ok:true})},expected={action:intent,operation,targetId:before.id,fields:{operation,targetId:before.id,...(intent==='plan'?{blockId:before.id,startAt:after.startAt,endAt:after.endAt}:{})},before:pick(before),after:pick(after)};
 const f=companion({actions:{[intent]:async()=>result,checkpoint:()=>({tasks:{secret:'CHECKPOINT_STORE'},grades:{secret:'CHECKPOINT_GRADE'}})},evaluate:()=>({message:'Local command',next:{action:intent,fields},items:[{id:'work-7',title:'Loaded item',courseId:'7'}]})});t.after(()=>f.controller.destroy());
 await enter(f);before.title='A later source mutation';before.text='A later source mutation';after.courseId='99';f.open('follow up');await flush();const session=f.sessions.at(-1);assert.deepEqual(session.lastAction,expected);assert.equal(session.itemId,'work-7');assert.equal(session.courseId,'7');assert.doesNotMatch(JSON.stringify(session.lastAction),/PRIVATE_|CHECKPOINT_/);
});
test('failed writes and successful results without local metadata preserve the prior lastAction',async t=>{
 let result={ok:true,before:{id:'scratchpad',text:'Actual original'},message:'Saved.',undo:async()=>({ok:true})};
 const f=companion({actions:{note:async()=>{if(result instanceof Error)throw result;return result;},checkpoint:()=>({tasks:{notes:'PRIVATE_CHECKPOINT'},grades:{score:99}}),changed:()=>null},evaluate:()=>({message:'Local note',next:{action:'note',fields:{operation:'delete',itemId:'work-7'}},items:[{id:'work-7',courseId:'7'}]})});t.after(()=>f.controller.destroy());
 await enter(f);f.open('inspect');await flush();const original=plain(f.sessions.at(-1).lastAction);
 for(const value of [false,{ok:false,before:{id:'failed',text:'Not saved'}},Error('disk full'),{ok:true,original:{id:'invented',text:'Not result.before'},before:{settings:{private:true}},after:{grades:{score:99}}}]){result=value;await enter(f);f.open('inspect');await flush();assert.deepEqual(f.sessions.at(-1).lastAction,original);assert.equal(f.sessions.at(-1).itemId,'work-7');}
});
test('lastAction bounds note text and titles and rejects nested snapshots and nonlocal result metadata',async t=>{
 let action='note';const result={ok:true,before:{id:'scratchpad',title:'t'.repeat(500),text:'x'.repeat(40000),grades:{score:99}},after:[{id:'not-an-object'}],message:'Saved.',undo:async()=>({ok:true})};
 const f=companion({actions:{note:async()=>result,focus:async()=>({ok:true,before:{id:'private-focus',text:'Do not retain'}})},evaluate:()=>({message:'Local action',next:{action,fields:action==='note'?{operation:'delete'}:{minutes:25}},items:[]})});t.after(()=>f.controller.destroy());await enter(f);f.open('inspect');await flush();const previous=plain(f.sessions.at(-1).lastAction);assert.equal(previous.before.text.length,30000);assert.equal(previous.before.title.length,300);assert.equal(Object.hasOwn(previous.before,'grades'),false);assert.equal(Object.hasOwn(previous,'after'),false);
 action='focus';await enter(f);f.open('inspect');await flush();assert.deepEqual(f.sessions.at(-1).lastAction,previous);
});
