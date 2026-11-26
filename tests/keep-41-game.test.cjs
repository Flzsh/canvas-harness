'use strict';
// 4.2.0: the companion game of 4.1.0 (treats, fed, XP and with it the level, the streak, the best run, the streak's day, the
// last line told) is gone from what a student sees, but an update from 4.1.0 must not lose it. A record saved by 4.1.0 keeps
// every one of those fields, exactly as saved, through loading, the student's next saves, the pet's own cleaning and a
// backup made and restored by 4.2.0. A record without them never gains them.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStore,validateBackup}=require('../extension/storage.js'),Pets=require('../extension/pets.js');
const origin='https://school.instructure.com',key='reserve:v1:'+origin+':1';
function harness(seed={}){
 const data=structuredClone(seed),listeners=new Set();
 const local={async get(k){return {[k]:structuredClone(data[k])};},async set(values){const changes={};for(const [k,value] of Object.entries(values)){changes[k]={newValue:structuredClone(value)};data[k]=structuredClone(value);}for(const fn of listeners)fn(changes,'local');}};
 const adapter={read:async k=>(await local.get(k))[k],write:async(k,value)=>local.set({[k]:value}),subscribe(k,fn){const handle=(changes,area)=>{if(area==='local'&&changes[k])fn();};listeners.add(handle);return ()=>listeners.delete(handle);}};
 return {data,adapter};
}
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
// the companion as Canvas Harness 4.1.0 saved it (its own field names and bounds: pets.js DEFAULTS and clean() of 4.1.0)
const GAME={treats:6,fed:14,xp:265,streak:5,streakDay:'2026-11-20',best:11,told:'Nice work on the lab.'};
const SAVED_41={settings:{theme:'light'},tasks:{},pet:{enabled:true,name:'Maple',knowledge:'most',coat:'sage',harness:'gold',gear:'full',roam:'page',size:'medium',nudges:'helpful',...GAME,brain:null,skills:{},reminders:[],routines:[]}};

test('the pet\'s own cleaning keeps 4.1.0\'s game fields as saved and never adds them to a companion without them',()=>{
 const clean=Pets.clean(SAVED_41.pet);
 for(const [field,value] of Object.entries(GAME))assert.equal(clean[field],value,field);
 assert.deepEqual(Pets.clean(clean),clean,'cleaning again changes nothing');
 const fresh=Pets.clean({name:'Oats'});for(const field of Pets.RETIRED)assert.equal(Object.hasOwn(fresh,field),false,field);
});

test('a record saved by 4.1.0 keeps the game fields through loading and the student\'s next saves',async()=>{
 const h=harness({[key]:structuredClone(SAVED_41)}),store=createStore({origin,accountId:'1',adapter:h.adapter});
 await store.load();
 for(const [field,value] of Object.entries(GAME))assert.equal(store.get().pet[field],value,'loaded '+field);
 await store.update(data=>{data.tasks['9']={notes:'Kept'};data.pet.name='Biscuit';});await settle();
 const stored=h.data[key];
 assert.equal(stored.tasks['9'].notes,'Kept');assert.equal(stored.pet.name,'Biscuit');
 for(const [field,value] of Object.entries(GAME))assert.equal(stored.pet[field],value,'stored after a save: '+field);
 store.destroy();
});

test('a backup made by 4.2.0 from such a record restores with the game fields',async()=>{
 const h=harness({[key]:structuredClone(SAVED_41)}),store=createStore({origin,accountId:'1',adapter:h.adapter});
 await store.load();
 const backup=store.exportBackup(),data=validateBackup(backup,{origin,accountId:'1'});
 for(const [field,value] of Object.entries(GAME))assert.equal(data.pet[field],value,'backup '+field);
 store.destroy();
});
