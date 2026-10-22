'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Core=require('../extension/core.js'),Storage=require('../extension/storage.js'),Plan=require('../extension/planner-model.js');
const copy=value=>structuredClone(value),deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};},at=Date.parse('2027-05-11T16:00:00Z');
let sequence=0;
async function fixture(t){
 const values=new Map(),listeners=new Map(),adapter={read:async key=>copy(values.get(key)),write:async(key,value)=>{values.set(key,copy(value));for(const listener of listeners.get(key)||[])listener();},subscribe:(key,listener)=>{if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(listener);return()=>listeners.get(key).delete(listener);}},owner={accountId:'review-undo-'+(++sequence),adapter},store=Storage.createStore(owner),other=Storage.createStore(owner);let captured,hold=null;
 t.after(()=>{hold?.release.resolve();store.destroy();other.destroy();});await store.load();await store.update(data=>{data.toolbox.scratchpad='Pack lunch';data.tasks['17']={notes:'Original assignment note'};});await other.load();
 const save=mutate=>{const pause=hold;hold=null;return store.update(mutate).then(async()=>{if(pause){pause.entered.resolve();await pause.release.promise;}return true;});},items=[{id:'17',name:'Chem Lab',courseId:'2',dueAt:'2027-05-14T20:00:00Z'}],courses=[{id:'2',name:'Chemistry'}],doc={addEventListener(){},removeEventListener(){},defaultView:{addEventListener(){},removeEventListener(){}}},container={ownerDocument:doc,querySelector:()=>null,querySelectorAll:()=>[]};
 class Clock extends Date{static now(){return at;}}
 const env=vm.createContext({console,Date:Clock,Intl,Promise,Map,Set,ReserveCore:Core,ReservePlanner:Plan,ReservePonyBrain:require('../extension/pony-brain.js'),ReservePonyAsk:require('../extension/pony-ask.js'),ReservePetArt:{},ReservePets:{clean:copy,create:options=>{captured=options;return {sync(){},setFocus(){},destroy(){}};}},setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){}}),file=path.resolve(__dirname,'..',process.env.CANVAS_REVIEW_WIDGETS||'extension/widgets.js');vm.runInContext(fs.readFileSync(file,'utf8'),env,{filename:file});
 const widgets=env.ReserveWidgets.create({container,store,save,rerender(){},getContext:()=>({s:store.get().settings,items,courses,local:store.get().tasks,now:at}),helpers:()=>({dayKey:Core.dayKey,complete:Core.isComplete}),appearance:({key,value})=>save(data=>{data.settings[key]=value;}),bookmark:({itemId})=>save(data=>{data.tasks[itemId].pinned=true;})});t.after(()=>widgets.destroy());widgets.sync();
 const actions=captured.actions,run=async(intent,request)=>{const before=await actions.checkpoint(intent);assert.equal(await actions[intent](request),true);return actions.changed(before);},pause=()=>{const gate={entered:deferred(),release:deferred()};hold=gate;t.after(()=>gate.release.resolve());return gate;};return {store,other,actions,run,pause};
}

test('review: note Undo preserves another tab assignment note saved before its serialized mutation',async t=>{
 const f=await fixture(t),before=await f.actions.checkpoint('note'),saving=f.actions.note({text:'bring goggles'});await f.other.update(data=>{data.tasks['17'].notes='Saved in the other tab';});assert.equal(await saving,true);assert.equal(f.store.get().toolbox.scratchpad,'Pack lunch\nbring goggles');assert.equal(f.store.get().tasks['17'].notes,'Saved in the other tab');const undo=f.actions.changed(before);assert.equal(typeof undo,'function');assert.equal(await undo(),true);const saved=await f.other.load();assert.equal(saved.toolbox.scratchpad,'Pack lunch');assert.equal(saved.tasks['17'].notes,'Saved in the other tab');
});

test('review: note Undo restores the fresh same-field value read by the serialized mutation',async t=>{
 const f=await fixture(t),before=await f.actions.checkpoint('note'),saving=f.actions.note({text:'bring goggles'});await f.other.update(data=>{data.toolbox.scratchpad='Pack books';});assert.equal(await saving,true);assert.equal(f.store.get().toolbox.scratchpad,'Pack books\nbring goggles');const undo=f.actions.changed(before);assert.equal(typeof undo,'function');assert.equal(await undo(),true);assert.equal((await f.other.load()).toolbox.scratchpad,'Pack books');
});

test('review: note Undo excludes another tab assignment note saved after commit and before completion',async t=>{
 const f=await fixture(t),gate=f.pause(),saving=f.run('note',{text:'bring goggles'});await gate.entered.promise;await f.other.update(data=>{data.tasks['17'].notes='Saved while the command finishes';});await f.store.sync();gate.release.resolve();const undo=await saving;assert.equal(typeof undo,'function');assert.equal(await undo(),true);const saved=await f.other.load();assert.equal(saved.toolbox.scratchpad,'Pack lunch');assert.equal(saved.tasks['17'].notes,'Saved while the command finishes');
});

for(const timing of ['before completion','after completion'])test('review: conditional note Undo keeps a same-field edit '+timing,async t=>{
 const f=await fixture(t);let undo;if(timing==='before completion'){const gate=f.pause(),saving=f.run('note',{text:'bring goggles'});await gate.entered.promise;await f.other.update(data=>{data.toolbox.scratchpad='A newer scratchpad';data.tasks['17'].notes='Keep this note too';});await f.store.sync();gate.release.resolve();undo=await saving;}else{undo=await f.run('note',{text:'bring goggles'});await f.other.update(data=>{data.toolbox.scratchpad='A newer scratchpad';data.tasks['17'].notes='Keep this note too';});}assert.equal(typeof undo,'function');const result=await undo();assert.equal(result.ok,false);assert.match(result.message,/newer edits are kept/);const saved=await f.other.load();assert.equal(saved.toolbox.scratchpad,'A newer scratchpad');assert.equal(saved.tasks['17'].notes,'Keep this note too');
});

for(const [intent,request,check] of [['plan',{itemId:'17',courseId:'2',date:'2027-05-13',minutes:40},data=>{assert.equal(data.tasks['17'].plannedDate,'');assert.equal(data.tasks['17'].estimate,0);}],['setting',{key:'textSize',value:'large'},data=>assert.equal(data.settings.textSize,'standard')],['bookmark',{itemId:'17'},data=>assert.equal(data.tasks['17'].pinned,false)]])test('review: '+intent+' Undo records its own mutation and preserves concurrent task notes',async t=>{
 const f=await fixture(t),gate=f.pause(),saving=f.run(intent,request);await gate.entered.promise;await f.other.update(data=>{data.tasks['17'].notes='Concurrent assignment note';});await f.store.sync();gate.release.resolve();const undo=await saving;assert.equal(typeof undo,'function');assert.equal(await undo(),true);const saved=await f.other.load();check(saved);assert.equal(saved.tasks['17'].notes,'Concurrent assignment note');
});

test('review: conditional plan Undo is atomic when one command field has a newer edit',async t=>{
 const f=await fixture(t),undo=await f.run('plan',{itemId:'17',courseId:'2',date:'2027-05-13',minutes:40});assert.equal(typeof undo,'function');await f.other.update(data=>{data.tasks['17'].estimate=55;data.tasks['17'].notes='A newer plan note';});const result=await undo();assert.equal(result.ok,false);const saved=await f.other.load();assert.equal(saved.tasks['17'].plannedDate,'2027-05-13');assert.equal(saved.tasks['17'].estimate,55);assert.equal(saved.tasks['17'].notes,'A newer plan note');
});

test('review: a command with no mutation never offers Undo for an unrelated edit',async t=>{
 const f=await fixture(t),before=await f.actions.checkpoint('note');await f.other.update(data=>{data.tasks['17'].notes='Independent note';});await f.store.sync();assert.equal(await f.actions.note({text:''}),false);assert.equal(f.actions.changed(before),null);assert.equal((await f.other.load()).tasks['17'].notes,'Independent note');
});
