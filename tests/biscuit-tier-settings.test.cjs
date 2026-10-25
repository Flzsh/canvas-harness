'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../extension/storage.js'),P=require('../extension/pets.js'),Art=require('../extension/pet-art.js'),B=require('../extension/pony-brain.js'),A=require('../extension/pony-ask.js');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const flush=async()=>{for(let i=0;i<32;i++)await Promise.resolve();},backup=pet=>({format:'reserve-backup',version:1,data:{pet}});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function memory(){const data=new Map();let fail=false;return {data,fail:value=>{fail=value;},read:async key=>structuredClone(data.get(key)),write:async(key,value)=>{if(fail)throw Error('disk full');data.set(key,structuredClone(value));}};}
function pony(rules,options={}){return require('./biscuit-public-fixture.cjs').fixture({brain:B,ask:A,info:()=>({features:{'biscuit-more-rules':true}}),...options,initialPet:{nudges:'off',...options.initialPet}},{ReserveBiscuitRules:rules,...(options.engine?{ReserveBiscuitEngine:options.engine}:{})});}
function preview(rules,initialPet={},ready=new Set()){
 const evaluations=[],engine={create:()=>({offer:()=>null,evaluate:(text,snapshot)=>{evaluations.push({text,snapshot});return {message:snapshot.pet.knowledge+':'+ready.has(snapshot.pet.knowledge),next:{action:'chat',fields:{}},items:[]};}})};
 const f=pony(rules,{engine,parser:{parse:()=>[]},initialPet});f.node.emit('click');
 const input=new f.Element(),line=new f.Element(),suggestions=new f.Element();input.value='hello';input.setAttribute('data-pet-question','');input.parentNode=f.bubble;
 f.bubble.slots={'[data-pet-question]':input,'[data-pet-preview]':line,'[data-pet-suggestions]':suggestions};f.bubble.emit('input',{target:input});f.advance(30);
 return Object.assign(f,{input,line,evaluations});
}
test('knowledge defaults to Basic and cleaners accept only the three exact stored values',()=>{
 assert.equal(P.DEFAULTS.knowledge,'basic');assert.equal(P.clean().knowledge,'basic');assert.equal(S.validateBackup({format:'reserve-backup',version:1,data:{}}).pet.knowledge,'basic');
 for(const knowledge of ['basic','more','most']){assert.equal(P.clean({knowledge}).knowledge,knowledge);assert.equal(S.validateBackup(backup({knowledge})).pet.knowledge,knowledge);}
 for(const knowledge of [undefined,null,false,true,0,1,'Basic','MORE','Most','',' basic ','advanced',[],{},['most']]){
  assert.equal(P.clean({knowledge}).knowledge,'basic');assert.equal(S.validateBackup(backup({knowledge})).pet.knowledge,'basic');
 }
 const hostile=JSON.parse('{"__proto__":{"polluted":true}}');assert.equal(P.clean({knowledge:hostile}).knowledge,'basic');assert.throws(()=>S.validateBackup(backup({knowledge:hostile})),/unsafe key/i);
 const inherited=Object.create({knowledge:'most'});assert.equal(P.clean(inherited).knowledge,'basic');assert.equal(S.validateBackup(backup(inherited)).pet.knowledge,'basic');assert.equal(Object.prototype.polluted,undefined);
});
test('standalone browser storage cleans knowledge before any Companion code loads',()=>{
 const env=vm.createContext({Date,Intl,URL,structuredClone,TextEncoder});for(const file of ['site.js','gpa-model.js','workspace-arrange.js','customization-model.js','page-preferences.js','storage.js'])vm.runInContext(read(file),env,{filename:file});
 for(const knowledge of ['basic','more','most'])assert.equal(env.ReserveStorage.validateBackup(backup({knowledge})).pet.knowledge,knowledge);
 assert.equal(env.ReserveStorage.validateBackup(backup({knowledge:'unknown'})).pet.knowledge,'basic');
});
test('backup cleaning carries knowledge without changing names or installed companion references',()=>{
 const row={id:'moth',name:'Moon Moth',kind:'pet'},input={format:'reserve-backup',version:1,data:{pet:{name:'Pip',knowledge:'most'},settings:{makeYourOwn:{theme:null,pet:row,installed:{moth:row}}},tasks:{'1':{notes:'Keep this draft'}}}},before=structuredClone(input);
 for(const value of [input,JSON.stringify(input)]){const cleaned=S.validateBackup(value);assert.equal(cleaned.pet.knowledge,'most');assert.equal(cleaned.pet.name,'Pip');assert.equal(cleaned.tasks['1'].notes,'Keep this draft');assert.deepEqual(cleaned.settings.makeYourOwn,input.data.settings.makeYourOwn);}
 assert.deepEqual(input,before);
});
test('normal account backups carry the cleaned choice in both JSON and object imports',async t=>{
 const adapter=memory(),store=S.createStore({accountId:'roundtrip',adapter}),other=S.createStore({accountId:'other',adapter});t.after(()=>{store.destroy();other.destroy();});await store.load();await other.load();
 for(const knowledge of ['basic','more','most']){await store.update(data=>{data.pet.knowledge=knowledge;data.pet.name='Pip';});const exported=store.exportBackup();assert.equal(exported.data.pet.knowledge,knowledge);await store.update(data=>{data.pet.knowledge=knowledge==='basic'?'most':'basic';});for(const input of [JSON.stringify(exported),exported]){await store.importBackup(input);assert.equal(store.get().pet.knowledge,knowledge);assert.equal(store.get().pet.name,'Pip');}}
 const reloaded=S.createStore({accountId:'roundtrip',adapter});t.after(()=>reloaded.destroy());assert.equal((await reloaded.load()).pet.knowledge,'most');assert.equal((await other.load()).pet.knowledge,'basic');assert.equal(Object.hasOwn(adapter.data.get('reserve:appearance'),'knowledge'),false);
});
test('a failed preference write preserves knowledge, companion name and unrelated saved settings',async t=>{
 const adapter=memory(),store=S.createStore({accountId:'failure',adapter});t.after(()=>store.destroy());await store.load();await store.update(data=>{data.pet.knowledge='basic';data.pet.name='Pip';data.tasks['1']={notes:'Keep this draft'};});
 const before=store.get(),saved=structuredClone(adapter.data);adapter.fail(true);await assert.rejects(store.update(data=>{data.pet.knowledge='most';data.pet.name='Lost name';}),/disk full/);
 assert.deepEqual(store.get(),before);assert.deepEqual(adapter.data,saved);adapter.fail(false);assert.deepEqual(await store.load(),before);
});
test('disabled Companion loads nothing and Basic never requests a higher tier',async t=>{
 const calls=[],f=pony({load:tier=>{calls.push(tier);return Promise.resolve();}},{initialPet:{enabled:false,knowledge:'most'}});t.after(()=>f.controller.destroy());await flush();assert.deepEqual(calls,[]);
 f.setPet({knowledge:'basic'});await flush();assert.deepEqual(calls,[]);f.setPet({enabled:true});await flush();assert.deepEqual(calls,['basic']);
 f.controller.sync();f.setPet({name:'Pip'});await flush();assert.deepEqual(calls,['basic']);f.setPet({knowledge:'most'});await flush();assert.deepEqual(calls,['basic','most']);
});
test('a tier superseded before the lazy call begins never starts loading',async t=>{
 const calls=[],f=pony({load:tier=>{calls.push(tier);return Promise.resolve();}},{initialPet:{knowledge:'most'}});t.after(()=>f.controller.destroy());f.setPet({knowledge:'basic'});await flush();assert.deepEqual(calls,['basic']);
});
test('engine snapshot exposes the tier and an open preview refreshes when its pack is ready',async t=>{
 const pending=deferred(),ready=new Set(),calls=[],f=preview({load:tier=>{calls.push(tier);return pending.promise.then(()=>ready.add(tier));}},{name:'Pip',knowledge:'more'},ready);t.after(()=>f.controller.destroy());await flush();assert.deepEqual(calls,['more']);assert.equal(f.line.textContent,'more:false');
 assert.equal(f.evaluations.at(-1).snapshot.pet.knowledge,'more');assert.equal(f.evaluations.at(-1).snapshot.companion.name,'Pip');const input=f.input;pending.resolve();await flush();assert.equal(f.line.textContent,'more:true');assert.equal(f.input,input);
});
test('late higher-tier completion cannot replace the current Basic preview',async t=>{
 const pending=new Map(),ready=new Set(),f=preview({load:tier=>{const entry=deferred();pending.set(tier,entry);return entry.promise.then(()=>ready.add(tier));}},{knowledge:'most'},ready);t.after(()=>f.controller.destroy());await flush();f.setPet({knowledge:'basic'});await flush();assert.equal(f.line.textContent,'basic:false');
 pending.get('basic').resolve();await flush();assert.equal(f.line.textContent,'basic:true');const count=f.evaluations.length;pending.get('most').resolve();await flush();assert.equal(f.evaluations.length,count);assert.equal(f.line.textContent,'basic:true');
});
for(const disabled of [false,true])test('loading completion ignores a '+(disabled?'disabled':'destroyed')+' Companion controller',async t=>{
 const pending=deferred(),f=preview({load:()=>pending.promise},{knowledge:'most'});t.after(()=>f.controller.destroy());await flush();if(disabled)f.setPet({enabled:false});else f.controller.destroy();const count=f.evaluations.length;pending.resolve();await flush();assert.equal(f.evaluations.length,count);assert.equal(f.bubble,undefined);
});
test('a rejected pack load preserves settings and a later sync can retry it',async t=>{
 let count=0;const f=pony({load:()=>++count===1?Promise.reject(Error('unavailable')):Promise.resolve()},{initialPet:{knowledge:'most',name:'Pip'}});t.after(()=>f.controller.destroy());await flush();assert.equal(count,1);assert.equal(f.controller.pet.knowledge,'most');assert.equal(f.controller.pet.name,'Pip');f.controller.sync();await flush();assert.equal(count,2);assert.equal(f.controller.pet.knowledge,'most');
});
