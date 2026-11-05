'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../extension/storage.js'),P=require('../extension/pets.js'),Art=require('../extension/pet-art.js'),B=require('../extension/pony-brain.js'),A=require('../extension/pony-ask.js');
const {createDOM}=require('./addons-fixture.cjs'),{fixture:dashboard}=require('./dashboard-heading-fixture.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const flush=async()=>{for(let i=0;i<32;i++)await Promise.resolve();},backup=pet=>({format:'reserve-backup',version:1,data:{pet}});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function memory(){const data=new Map();let fail=false;return {data,fail:value=>{fail=value;},read:async key=>structuredClone(data.get(key)),write:async(key,value)=>{if(fail)throw Error('disk full');data.set(key,structuredClone(value));}};}
function editor(pet={},settings={}){
 const env=vm.createContext({ReservePets:P,ReservePetArt:Art,ReservePonyBrain:B,ReserveFeatures:{enabled:()=>true}});
 for(const file of ['workspace-arrange.js','customization-model.js','make-your-own.js','customize-ui.js'])vm.runInContext(read(file),env,{filename:file});
 const input={s:settings,personal:{pet},allCourses:[],courses:[],customizeOpen:true,customizeTab:'pet'},before=plain(input);
 const document=createDOM('<html><body>'+env.ReserveCustomizeUI.render(input)+'</body></html>');assert.deepEqual(plain(input),before);return document;
}
function pony(rules,options={}){
 const file=path.join(__dirname,'pony-fixture.cjs'),module={exports:{}};
 const injectedVM={...vm,createContext:value=>vm.createContext({...value,ReserveBiscuitRules:rules})};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,exports:module.exports,__dirname,require:name=>name==='node:vm'?injectedVM:require(name)},{filename:file});
 return module.exports.fixture({brain:B,ask:A,...options,initialPet:{nudges:'off',...options.initialPet}});
}
function preview(rules,initialPet={},ready=new Set()){
 const evaluations=[],engine={create:()=>({offer:()=>null,evaluate:(text,snapshot)=>{evaluations.push({text,snapshot});return {message:snapshot.pet.knowledge+':'+ready.has(snapshot.pet.knowledge),next:{action:'chat',fields:{}},items:[]};}})};
 const f=pony(rules,{engine,parser:{parse:()=>[]},initialPet});f.node.emit('click');
 const input=new f.Element(),line=new f.Element(),suggestions=new f.Element();input.value='hello';input.setAttribute('data-pet-question','');input.parentNode=f.bubble;
 f.bubble.slots={'[data-pet-question]':input,'[data-pet-preview]':line,'[data-pet-suggestions]':suggestions};f.bubble.emit('input',{target:input});f.advance(30);
 return Object.assign(f,{input,line,evaluations});
}
function settingsFlow(t,planner){
 const f=dashboard({courseId:'all',setup:({env,store})=>{
  env.ReserveFeatures={enabled:id=>planner||id!=='planner'};env.ReservePonyBrain=B;env.ReservePonyAsk=A;
  for(const file of ['workspace-arrange.js','customization-model.js','settings-dock.js','planner-model.js','planner-ui.js','pet-art.js','pets.js','customize-ui.js','widgets.js'])vm.runInContext(read(file),env,{filename:file});
  env.ReservePets={...env.ReservePets,create:()=>({sync(){},setFocus(){},destroy(){}})};
  vm.runInContext(read('dashboard.js'),env,{filename:'dashboard.js'});
  const data=store.get();Object.assign(data,{tasks:{'1':{notes:'Keep this draft'}},customTasks:[],toolbox:{scratchpad:''},focus:{minutes:25,remaining:1500,endsAt:null},pet:{name:'Pip',knowledge:'most',enabled:true,nudges:'off'}});Object.assign(data.settings,plain(env.ReserveCustomization.defaults));
 }});t.after(()=>f.dashboard.destroy());f.click('settings');
 const tab=f.container.querySelector('[data-rd-action="customize-tab"][data-value="pet"]');assert.ok(tab);f.container.events.get('click')({target:tab,detail:0,preventDefault(){}});
 return {...f,choose(value){const target=f.container.querySelector('[data-rd-field="pet"][data-key="knowledge"][value="'+value+'"]');assert.ok(target);target.value=value;target.checked=true;f.container.events.get('change')({target});}};
}

test('knowledge defaults to Full; Lite stays Lite, and every older tier and bad value is Full',()=>{
 assert.equal(P.DEFAULTS.knowledge,'most');assert.equal(P.clean().knowledge,'most');assert.equal(S.validateBackup({format:'reserve-backup',version:1,data:{}}).pet.knowledge,'most');
 assert.equal(P.clean({knowledge:'lite'}).knowledge,'lite');assert.equal(S.validateBackup(backup({knowledge:'lite'})).pet.knowledge,'lite');
 for(const knowledge of ['basic','more','most',undefined,null,false,true,0,1,'Basic','MORE','Most','Lite','',' basic ','advanced',[],{},['lite']]){
  assert.equal(P.clean({knowledge}).knowledge,'most');assert.equal(S.validateBackup(backup({knowledge})).pet.knowledge,'most');
 }
 // (the public backup check refuses a "__proto__" key outright instead of cleaning it)
 const polluted=JSON.parse('{"__proto__":{"polluted":true}}');assert.equal(P.clean({knowledge:polluted}).knowledge,'most');assert.throws(()=>S.validateBackup(backup({knowledge:polluted})),/unsafe key/);
 const inherited=Object.create({knowledge:'lite'});assert.equal(P.clean(inherited).knowledge,'most');assert.equal(S.validateBackup(backup(inherited)).pet.knowledge,'most');assert.equal(Object.prototype.polluted,undefined);
});
test('standalone browser storage cleans knowledge before any Companion code loads',()=>{
 const env=vm.createContext({Date,Intl,URL,structuredClone,TextEncoder});for(const file of ['site.js','gpa-model.js','workspace-arrange.js','customization-model.js','page-preferences.js','storage.js'])vm.runInContext(read(file),env,{filename:file});
 assert.equal(env.ReserveStorage.validateBackup(backup({knowledge:'lite'})).pet.knowledge,'lite');
 for(const knowledge of ['basic','more','most','unknown'])assert.equal(env.ReserveStorage.validateBackup(backup({knowledge})).pet.knowledge,'most');
});
test('backup cleaning carries knowledge without changing names or installed companion references',()=>{
 const row={id:'moth',name:'Moon Moth',kind:'pet'},input={format:'reserve-backup',version:1,data:{pet:{name:'Pip',knowledge:'most'},settings:{makeYourOwn:{theme:null,pet:row,installed:{moth:row}}},tasks:{'1':{notes:'Keep this draft'}}}},before=structuredClone(input);
 for(const value of [input,JSON.stringify(input)]){const cleaned=S.validateBackup(value);assert.equal(cleaned.pet.knowledge,'most');assert.equal(cleaned.pet.name,'Pip');assert.equal(cleaned.tasks['1'].notes,'Keep this draft');assert.deepEqual(cleaned.settings.makeYourOwn,input.data.settings.makeYourOwn);}
 assert.deepEqual(input,before);
});
test('normal account backups carry the cleaned choice in both JSON and object imports',async t=>{
 const adapter=memory(),store=S.createStore({accountId:'roundtrip',adapter}),other=S.createStore({accountId:'other',adapter});t.after(()=>{store.destroy();other.destroy();});await store.load();await other.load();
 for(const knowledge of ['lite','most']){await store.update(data=>{data.pet.knowledge=knowledge;data.pet.name='Pip';});const exported=store.exportBackup();assert.equal(exported.data.pet.knowledge,knowledge);await store.update(data=>{data.pet.knowledge=knowledge==='lite'?'most':'lite';});for(const input of [JSON.stringify(exported),exported]){await store.importBackup(input);assert.equal(store.get().pet.knowledge,knowledge);assert.equal(store.get().pet.name,'Pip');}}
 const reloaded=S.createStore({accountId:'roundtrip',adapter});t.after(()=>reloaded.destroy());assert.equal((await reloaded.load()).pet.knowledge,'most');assert.equal((await other.load()).pet.knowledge,'most');assert.equal(Object.hasOwn(adapter.data.get('reserve:appearance'),'knowledge'),false);
});
test('a failed preference write preserves knowledge, companion name and unrelated saved settings',async t=>{
 const adapter=memory(),store=S.createStore({accountId:'failure',adapter});t.after(()=>store.destroy());await store.load();await store.update(data=>{data.pet.knowledge='lite';data.pet.name='Pip';data.tasks['1']={notes:'Keep this draft'};});
 const before=store.get(),saved=structuredClone(adapter.data);adapter.fail(true);await assert.rejects(store.update(data=>{data.pet.knowledge='most';data.pet.name='Lost name';}),/disk full/);
 assert.deepEqual(store.get(),before);assert.deepEqual(adapter.data,saved);adapter.fail(false);assert.deepEqual(await store.load(),before);
});
test('Companion offers exactly Full and Lite and selects the saved or default choice',()=>{
 for(const [knowledge,shown] of [[undefined,'most'],['most','most'],['lite','lite']]){
  const document=editor({name:'Pip',...(knowledge?{knowledge}:{})}),group=document.querySelector('[role="radiogroup"][aria-label="How much Biscuit knows"]');assert.ok(group);
  const inputs=group.querySelectorAll('input');assert.deepEqual(inputs.map(node=>[node.dataset.rdField,node.dataset.key,node.value]),['most','lite'].map(value=>['pet','knowledge',value]));
  assert.deepEqual(group.querySelectorAll('strong').map(node=>node.textContent),['Full','Lite']);assert.equal(group.querySelectorAll('small').length,0);assert.equal(inputs.find(node=>node.checked).value,shown);assert.equal(document.querySelector('[aria-label="Companion name"]').value,'Pip');
 }
});
// 4.0: the knowledge control inside a Market catalogue picker is not tested here: this Make your own has no catalogue picker
for(const planner of [true,false])test('knowledge settings save through the '+(planner?'board':'dashboard fallback')+' change handler',async t=>{
 const f=settingsFlow(t,planner);for(const knowledge of ['lite','most']){f.choose(knowledge);await flush();assert.equal(f.store.get().pet.knowledge,knowledge);assert.equal(f.store.get().pet.name,'Pip');assert.equal(f.store.get().tasks['1'].notes,'Keep this draft');}
 const before=plain(f.store.get());f.store.update=async()=>{throw Error('disk full');};f.choose('lite');await flush();assert.deepEqual(plain(f.store.get()),before);
});
test('no rules load until Biscuit is opened, and opening loads them once',async t=>{
 const calls=[],f=pony({load:tier=>{calls.push(tier);return Promise.resolve();}},{initialPet:{knowledge:'most'}});t.after(()=>f.controller.destroy());await flush();f.controller.sync();await flush();assert.deepEqual(calls,[]);
 f.node.emit('click');await flush();assert.deepEqual(calls,['most']);f.controller.sync();f.setPet({name:'Pip'});await flush();assert.deepEqual(calls,['most']);
});
test('disabled Companion and Lite load no rules; Full loads once and only once',async t=>{
 const calls=[],f=pony({load:tier=>{calls.push(tier);return Promise.resolve();}},{initialPet:{knowledge:'lite'}});t.after(()=>f.controller.destroy());f.node.emit('click');await flush();assert.deepEqual(calls,[]);
 f.setPet({enabled:false,knowledge:'most'});await flush();assert.deepEqual(calls,[]);f.setPet({knowledge:'lite',enabled:true});await flush();assert.deepEqual(calls,[]);
 f.controller.sync();f.setPet({name:'Pip'});await flush();assert.deepEqual(calls,[]);f.setPet({knowledge:'most'});await flush();assert.deepEqual(calls,['most']);f.controller.sync();await flush();assert.deepEqual(calls,['most']);
});
test('Full superseded by Lite before the lazy call begins never starts loading',async t=>{
 const calls=[],f=pony({load:tier=>{calls.push(tier);return Promise.resolve();}},{initialPet:{knowledge:'most'}});t.after(()=>f.controller.destroy());f.node.emit('click');f.setPet({knowledge:'lite'});await flush();assert.deepEqual(calls,[]);
});
test('engine snapshot exposes the tier and an open preview refreshes when its pack is ready',async t=>{
 const pending=deferred(),ready=new Set(),calls=[],f=preview({load:tier=>{calls.push(tier);return pending.promise.then(()=>ready.add(tier));}},{name:'Pip',knowledge:'most'},ready);t.after(()=>f.controller.destroy());await flush();assert.deepEqual(calls,['most']);assert.equal(f.line.textContent,'most:false');
 assert.equal(f.evaluations.at(-1).snapshot.pet.knowledge,'most');assert.equal(f.evaluations.at(-1).snapshot.companion.name,'Pip');const input=f.input;pending.resolve();await flush();assert.equal(f.line.textContent,'most:true');assert.equal(f.input,input);
});
test('a late Full completion cannot replace the current Lite preview',async t=>{
 const pending=new Map(),ready=new Set(),f=preview({load:tier=>{const entry=deferred();pending.set(tier,entry);return entry.promise.then(()=>ready.add(tier));}},{knowledge:'most'},ready);t.after(()=>f.controller.destroy());await flush();f.setPet({knowledge:'lite'});await flush();assert.equal(f.line.textContent,'lite:false');
 const count=f.evaluations.length;pending.get('most').resolve();await flush();assert.equal(f.evaluations.length,count);assert.equal(f.line.textContent,'lite:false');
});
for(const disabled of [false,true])test('loading completion ignores a '+(disabled?'disabled':'destroyed')+' Companion controller',async t=>{
 const pending=deferred(),f=preview({load:()=>pending.promise},{knowledge:'most'});t.after(()=>f.controller.destroy());await flush();if(disabled)f.setPet({enabled:false});else f.controller.destroy();const count=f.evaluations.length;pending.resolve();await flush();assert.equal(f.evaluations.length,count);assert.equal(f.bubble,undefined);
});
test('a rejected pack load preserves settings and a later sync can retry it',async t=>{
 let count=0;const f=pony({load:()=>++count===1?Promise.reject(Error('unavailable')):Promise.resolve()},{initialPet:{knowledge:'most',name:'Pip'}});t.after(()=>f.controller.destroy());f.node.emit('click');await flush();assert.equal(count,1);assert.equal(f.controller.pet.knowledge,'most');assert.equal(f.controller.pet.name,'Pip');f.controller.sync();await flush();assert.equal(count,2);assert.equal(f.controller.pet.knowledge,'most');
});
