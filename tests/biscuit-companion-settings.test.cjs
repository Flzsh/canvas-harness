'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Core=require('../extension/core.js'),Storage=require('../extension/storage.js'),Plan=require('../extension/planner-model.js'),Controls=require('../extension/biscuit-controls.js');
const copy=value=>structuredClone(value),now=Date.parse('2026-10-27T16:00:00Z');
async function fixture(t){
 const disk=new Map(),writes=[],disabled=new Set(),adapter={read:async key=>copy(disk.get(key)),write:async(key,value)=>{writes.push(key);disk.set(key,copy(value));}},owner={accountId:'biscuit-companion-settings',adapter},store=Storage.createStore(owner);await store.load();
 let captured;const doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]},save=fn=>store.update(fn).then(()=>true);
 const env=vm.createContext({console,Date,Intl,Map,Set,Promise,URL,ReserveCore:Core,ReservePlanner:Plan,ReserveBiscuitControls:Controls,ReserveFeatures:{enabled:id=>!disabled.has(id)},ReservePetArt:{},ReservePets:{clean:copy,create:options=>{captured=options;return {sync(){},setFocus(){},destroy(){}};}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/widgets.js'),'utf8'),env,{filename:'widgets.js'});
 const widgets=env.ReserveWidgets.create({container,store,save,rerender(){},getContext:()=>({s:store.get().settings,personal:store.get(),items:[],courses:[],local:store.get().tasks,now}),helpers:()=>({dayKey:Core.dayKey,complete:Core.isComplete}),appearance:({key,value})=>save(data=>{data.settings[key]=value;})});widgets.sync();t.after(()=>{widgets.destroy();store.destroy();});
 assert.equal(typeof captured?.actions?.setting,'function');
 return {store,writes,disabled,actions:captured.actions,propose:text=>{const result=Controls.propose(text,{now,timeZone:'UTC',settings:store.get().settings,courses:[],workItems:[]});assert.equal(result?.action,'setting',text);return result.next.fields;},reload:async()=>{const fresh=Storage.createStore(owner);try{await fresh.load();return fresh.get();}finally{fresh.destroy();}}};
}
for(const [text,key,initial,value] of [
 ['reset bedtime','bedtime','21:45','22:30'],['reset biscuit offers','biscuitOffers',false,true],
 ['set bedtime to 00:00','bedtime','22:30','00:00'],['set bedtime to 23:59','bedtime','22:30','23:59'],['set bedtime to 9:45 pm','bedtime','22:30','21:45'],
 ['set biscuit offers to off','biscuitOffers',true,false],['set biscuit offers to on','biscuitOffers',false,true]
])test('proposed '+text+' executes, persists and survives reload',async t=>{
 const f=await fixture(t);await f.store.update(d=>{d.settings[key]=initial;});const fields=f.propose(text);assert.deepEqual(fields,{key,value});const before=f.writes.length;
 assert.equal(await f.actions.setting(fields),true);assert.ok(f.writes.length>before,text+' did not write');assert.equal(f.store.get().settings[key],value);assert.equal((await f.reload()).settings[key],value);
});
test('invalid bedtime and Biscuit offer executor payloads reject without any storage writes',async t=>{
 const f=await fixture(t),original=copy(f.store.get()),count=f.writes.length;
 for(const value of ['24:00','23:60','0:00','00:0','00:00 ',' 00:00','12:00Z','00:00\n','00:00\r\n','',undefined,null,0,false,{},[]]){const result=await f.actions.setting({key:'bedtime',value});assert.equal(result?.ok,false,JSON.stringify(value));assert.deepEqual(f.store.get(),original);assert.equal(f.writes.length,count);}
 for(const value of ['off','false',0,1,null,{},[]]){const result=await f.actions.setting({key:'biscuitOffers',value});assert.equal(result?.ok,false,JSON.stringify(value));assert.deepEqual(f.store.get(),original);assert.equal(f.writes.length,count);}
 for(const text of ['set bedtime to 24:00','set bedtime to 23:60'])assert.equal(Controls.propose(text,{now,settings:f.store.get().settings}).action,'none',text);
 assert.deepEqual(await f.reload(),original);
});
for(const feature of ['pony','customization'])test('turning off '+feature+' blocks both proposed companion settings before storage',async t=>{
 const f=await fixture(t),original=copy(f.store.get()),count=f.writes.length;f.disabled.add(feature);
 for(const text of ['set bedtime to 00:00','set biscuit offers to off']){const fields=f.propose(text),result=await f.actions.setting(fields);assert.equal(result?.ok,false,text);assert.match(result.message,/off/i);assert.deepEqual(f.store.get(),original);assert.equal(f.writes.length,count);}
 assert.deepEqual(await f.reload(),original);
});
