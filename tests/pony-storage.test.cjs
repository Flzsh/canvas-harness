'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../extension/storage.js'),NOW=Date.now(),DAY=86400000;
const SKILLS={deadline:true,focus:true,planner:true,wellbeing:true,inbox:true,reminders:true,night:true};
const clean=(pet,storage=S)=>storage.validateBackup({format:'reserve-backup',version:1,data:{pet}}).pet;
const reminder=(id='reminder-1',extra={})=>({id,text:'Bring the lab notebook',at:NOW+DAY,createdAt:NOW-1000,...extra});
const routine=(id='routine-1',extra={})=>({id,name:'After class',days:[1,2,3,4,5],minute:960,action:'focus',data:{minutes:25},createdAt:NOW-1000,last:'',...extra});
const json=value=>JSON.parse(JSON.stringify(value));
function memory(){const data=new Map();return {data,read:async key=>structuredClone(data.get(key)),write:async(key,value)=>{data.set(key,structuredClone(value));}};}
function browserStorage(){
 class Clock extends Date{static now(){return NOW;}}
 const env=vm.createContext({Date:Clock,Intl,URL,structuredClone,TextEncoder});
 for(const name of ['require','ReservePonyBrain','ReservePonyAsk'])Object.defineProperty(env,name,{get(){throw Error(name+' is unavailable before the pony scripts load');}});
 for(const file of ['site.js','gpa-model.js','workspace-arrange.js','customization-model.js','page-preferences.js','storage.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),env,{filename:file});
 return env.ReserveStorage;
}

test('new and legacy accounts get independent enabled skills and empty schedules',async()=>{
 const adapter=memory(),a=S.createStore({accountId:'1',adapter}),b=S.createStore({accountId:'2',adapter});
 try{
  for(const store of [a,b]){const data=await store.load();assert.deepEqual(data.pet.skills,SKILLS);assert.deepEqual(data.pet.reminders,[]);assert.deepEqual(data.pet.routines,[]);}
  assert.deepEqual(clean({name:'Biscuit'}).skills,SKILLS);
  const snapshot=a.get();snapshot.pet.skills.focus=false;snapshot.pet.reminders.push(reminder());
  assert.deepEqual(a.get().pet.skills,SKILLS);assert.deepEqual(b.get().pet.reminders,[]);
 }finally{a.destroy();b.destroy();}
});

test('skills keep own public boolean values and hostile backup keys are rejected',()=>{
 const skills=JSON.parse('{"deadline":false,"focus":"false","planner":0,"quiz":false,"labprep":false,"reading":"false","inbox":false,"reminders":true,"night":null,"extra":false,"__proto__":{"focus":false},"constructor":false,"prototype":true}');
 assert.throws(()=>clean({skills}),/unsafe key/i);assert.deepEqual(clean({skills:{deadline:false,focus:'false',planner:0,quiz:false,labprep:false,reading:'false',inbox:false,reminders:true,night:null,extra:false}}).skills,{...SKILLS,deadline:false,inbox:false});
 assert.deepEqual(clean({skills:Object.create({deadline:false,focus:false})}).skills,SKILLS);
 assert.equal(Object.prototype.focus,undefined);
});

test('malformed schedule containers reset without becoming scalar pet fields or changing learning',()=>{
 const brain={kinds:{next:{shown:1,used:2,ignored:0,streak:0}},nudges:{day:'2026-10-20',count:1,items:['7']},hiddenUntil:0};
 for(const value of [undefined,null,false,17,'bad',[],{}]){
  const result=clean({name:'Biscuit',brain,skills:value,reminders:value,routines:value});
  assert.deepEqual(result.skills,SKILLS);assert.deepEqual(result.reminders,[]);assert.deepEqual(result.routines,[]);
  assert.deepEqual(result.brain,{...brain,quietUntil:0});assert.equal(result.name,'Biscuit');
 }
});

test('standalone browser storage keeps reminders through the inclusive 24-hour overdue boundary',()=>{
 const storage=browserStorage(),input={reminders:[reminder('future',{at:NOW+1}),reminder('due',{at:NOW}),reminder('overdue',{at:NOW-DAY}),reminder('expired',{at:NOW-DAY-1})]};
 const result=json(clean(input,storage));
 assert.deepEqual(result.reminders.map(row=>row.id),['future','due','overdue']);
 assert.deepEqual(result.skills,SKILLS);
 assert.deepEqual(json(clean({routines:[routine()]},storage)).routines,[routine()]);
});

test('reminder records retain only allowed fields without mutating their source',()=>{
 const row=Object.freeze(reminder('reminder-1',{text:'x'.repeat(240),extra:{private:'discard'}})),rows=Object.freeze([row]);
 const result=clean({reminders:rows}).reminders;
 assert.deepEqual(result,[reminder('reminder-1',{text:'x'.repeat(240)})]);
 assert.equal(row.extra.private,'discard');assert.notEqual(result[0],row);
});

test('reminders reject invalid identifiers, empty text, and invalid timestamps',()=>{
 const invalid=[null,[],{},...['','   ','x'.repeat(81),'__proto__','constructor','prototype','bad\u0000id'].map(id=>reminder(id)),
  ...['','  ',false,12].map(text=>reminder('bad',{text})),
  ...[0,-1,NaN,Infinity,8640000000000001,'1800000000000',null].flatMap(value=>[reminder('bad',{at:value}),reminder('bad',{createdAt:value})])];
 assert.deepEqual(clean({reminders:invalid}).reminders,[]);
 assert.equal(clean({reminders:[reminder('x'.repeat(80))]}).reminders[0].id.length,80);
});

test('storage and pure ask cleaners agree on text normalization and representable timestamps',()=>{
 const Ask=require('../extension/pony-ask.js');
 const reminders=[reminder('normalized',{text:'  Bring\n the\tbook\u0000 now  '}),reminder('long',{text:'x'.repeat(241)}),reminder('invalid-time',{at:8640000000000001})];
 const expectedReminders=[reminder('normalized',{text:'Bring the book now'}),reminder('long',{text:'x'.repeat(240)})];
 assert.deepEqual(clean({reminders}).reminders,expectedReminders);assert.deepEqual(Ask.cleanReminders(reminders,NOW),expectedReminders);
 const routines=[routine('normalized',{name:'  After\n class  ',action:'remind',data:{text:'  Bring\n the\tbook\u0000 now  '}}),
  routine('long',{name:'x'.repeat(241),action:'remind',data:{text:'x'.repeat(241)}}),routine('invalid-time',{createdAt:8640000000000001})];
 const expectedRoutines=[routine('normalized',{name:'After class',action:'remind',data:{text:'Bring the book now'}}),
  routine('long',{name:'x'.repeat(240),action:'remind',data:{text:'x'.repeat(240)}})];
 assert.deepEqual(clean({routines}).routines,expectedRoutines);assert.deepEqual(Ask.cleanRoutines(routines),expectedRoutines);
});

test('reminders count only valid unique IDs toward their limit of twenty',()=>{
 const valid=Array.from({length:1000},(_,n)=>reminder('reminder-'+n));
 const rows=[reminder('reminder-0',{text:''}),valid[0],reminder('reminder-0',{text:'duplicate'}),...valid.slice(1)];
 const result=clean({reminders:rows}).reminders;
 assert.equal(result.length,20);assert.deepEqual(result.map(row=>row.id),Array.from({length:20},(_,n)=>'reminder-'+n));
 assert.equal(result[0].text,'Bring the lab notebook');
});

test('routines retain each supported action, deduplicate weekdays and discard unrelated fields',()=>{
 const rows=[routine('focus',{name:'x'.repeat(240),days:[6,0,6,1],minute:0,data:{minutes:15,mode:'week',text:'unused',extra:1},extra:true}),
  routine('break',{action:'break',minute:1439,data:{minutes:10,extra:true}}),
  routine('plan',{action:'plan',data:{mode:'tomorrow',minutes:25}}),
  routine('remind',{action:'remind',data:{text:'x'.repeat(240),mode:'tonight'}})];
 const before=structuredClone(rows),result=clean({routines:rows}).routines;
 assert.deepEqual(result,[routine('focus',{name:'x'.repeat(240),days:[6,0,1],minute:0,data:{minutes:15}}),
  routine('break',{action:'break',minute:1439,data:{minutes:10}}),routine('plan',{action:'plan',data:{mode:'tomorrow'}}),
  routine('remind',{action:'remind',data:{text:'x'.repeat(240)}})]);
 assert.deepEqual(rows,before);
});

test('routines require valid action-specific data without coercing minutes, modes or text',()=>{
 const invalid=[...['focus','break','plan','remind'].flatMap(action=>[undefined,null,[],{},false].map(data=>routine('bad',{action,data}))),
  ...[0,5,10,15.5,26,90,'25',NaN,Infinity].map(minutes=>routine('bad',{data:{minutes}})),
  ...[0,25,45,60,'5',Infinity].map(minutes=>routine('bad',{action:'break',data:{minutes}})),
  ...['today','Tomorrow',true,0].map(mode=>routine('bad',{action:'plan',data:{mode}})),
  ...['','  ',25,false].map(text=>routine('bad',{action:'remind',data:{text}}))];
 assert.deepEqual(clean({routines:invalid}).routines,[]);
 for(const minutes of [15,25,45,60])assert.equal(clean({routines:[routine('focus',{data:{minutes}})]}).routines[0].data.minutes,minutes);
 for(const minutes of [5,10,15])assert.equal(clean({routines:[routine('break',{action:'break',data:{minutes}})]}).routines[0].data.minutes,minutes);
 for(const mode of ['tonight','tomorrow','week'])assert.equal(clean({routines:[routine('plan',{action:'plan',data:{mode}})]}).routines[0].data.mode,mode);
});

test('routines require bounded identifiers, names, valid weekdays, integer minutes and positive creation times',()=>{
 const invalid=[null,[],{},...['',' ','x'.repeat(81),'__proto__','constructor','prototype','bad\u007fid'].map(id=>routine(id)),
  ...['',' ',true].map(name=>routine('bad',{name})),
  ...[undefined,null,[],['1'],[-1,7,2.5],{}].map(days=>routine('bad',{days})),
  ...[-1,1440,30.5,'60',NaN,Infinity,null].map(minute=>routine('bad',{minute})),
  ...[0,-1,NaN,Infinity,8640000000000001,'1800000000000',null].map(createdAt=>routine('bad',{createdAt})),
  routine('bad',{action:'open'})];
 assert.deepEqual(clean({routines:invalid}).routines,[]);
 assert.deepEqual(clean({routines:[routine('mixed',{days:[1,'2',-1,7,2.5,2,1]})]}).routines[0].days,[1,2]);
});

test('routine delivery markers preserve real calendar days and reset impossible dates',()=>{
 for(const last of ['2024-02-29','2026-10-20',''])assert.equal(clean({routines:[routine('day',{last})]}).routines[0].last,last);
 for(const last of ['2026-02-29','2026-02-30','2026-13-01','2026-00-01','2026-10-00','2026-1-01','yesterday',null,17,undefined])
  assert.equal(clean({routines:[routine('day',{last})]}).routines[0].last,'');
});

test('routines count only valid unique IDs toward their limit of twenty',()=>{
 const rows=Array.from({length:1000},(_,n)=>routine('routine-'+n));
 const result=clean({routines:[routine('routine-0',{data:{}}),rows[0],routine('routine-0',{name:'duplicate'}),...rows.slice(1)]}).routines;
 assert.equal(result.length,20);assert.deepEqual(result.map(row=>row.id),Array.from({length:20},(_,n)=>'routine-'+n));
 assert.equal(result[0].name,'After class');
});

test('prototype keys in records and nested data reject the backup without changing input or prototypes',()=>{
 const hostile=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true}}');
 const row=Object.assign(reminder(),hostile),entry=Object.assign(routine(),hostile);
 Object.assign(entry.data,hostile);
 const before=JSON.stringify({row,entry});assert.throws(()=>clean({reminders:[row],routines:[entry]}),/unsafe key/i);assert.equal(JSON.stringify({row,entry}),before);assert.equal(Object.prototype.polluted,undefined);
 const inherited=Object.create(reminder()),inheritedRoutine=Object.create(routine());
 assert.deepEqual(clean({reminders:[inherited],routines:[inheritedRoutine]}).reminders,[]);
 assert.deepEqual(clean({routines:[inheritedRoutine]}).routines,[]);
});

test('skills and schedules reload and round-trip only in their own account and Canvas origin',async()=>{
 const adapter=memory(),a=S.createStore({accountId:'1',adapter}),b=S.createStore({accountId:'2',adapter}),other=S.createStore({accountId:'1',origin:'https://other.instructure.com',adapter});
 try{
  await Promise.all([a.load(),b.load(),other.load()]);
  await a.update(data=>{data.pet.skills={focus:false,night:false,labprep:false,reading:false,rubric:false,feedback:false,inbox:false};data.pet.reminders=[reminder()];data.pet.routines=[routine()];data.settings.theme='dark';});
  const reload=S.createStore({accountId:'1',adapter});
  try{
   const loaded=(await reload.load()).pet,backup=S.validateBackup(reload.exportBackup(),reload.owner).pet;
   assert.deepEqual(loaded.skills,{...SKILLS,focus:false,night:false,inbox:false});assert.deepEqual(loaded.reminders,[reminder()]);assert.deepEqual(loaded.routines,[routine()]);
   assert.deepEqual(backup,loaded);
   assert.throws(()=>S.validateBackup(reload.exportBackup(),b.owner),/different Canvas account/);
   assert.throws(()=>S.validateBackup(reload.exportBackup(),other.owner),/different Canvas account/);
  }finally{reload.destroy();}
  for(const store of [b,other]){const data=await store.load();assert.equal(data.settings.theme,'dark');assert.deepEqual(data.pet.skills,SKILLS);assert.deepEqual(data.pet.reminders,[]);assert.deepEqual(data.pet.routines,[]);}
  const appearance=adapter.data.get('reserve:appearance');for(const key of ['skills','reminders','routines'])assert.ok(!Object.hasOwn(appearance,key));
  const personal=adapter.data.get('reserve:v1:'+a.owner.origin+':1');assert.deepEqual(personal.pet.reminders,[reminder()]);assert.deepEqual(personal.pet.routines,[routine()]);
 }finally{a.destroy();b.destroy();other.destroy();}
});

test('queued edits to skills and schedules preserve one another',async()=>{
 const adapter=memory(),store=S.createStore({accountId:'queued',adapter});
 try{
  await store.load();
  await Promise.all([store.update(data=>{data.pet.skills.focus=false;}),store.update(data=>{data.pet.reminders=[reminder()];}),store.update(data=>{data.pet.routines=[routine()];})]);
  const pet=store.get().pet;assert.equal(pet.skills.focus,false);assert.deepEqual(pet.reminders,[reminder()]);assert.deepEqual(pet.routines,[routine()]);
 }finally{store.destroy();}
});

test('public wellbeing and inbox switches survive standalone storage while study-only skills are discarded',()=>{
 const disabled={wellbeing:false,labprep:false,reading:false,rubric:false,feedback:false,inbox:false};assert.deepEqual(json(clean({skills:disabled},browserStorage())).skills,{...SKILLS,wellbeing:false,inbox:false});assert.deepEqual(Object.keys(SKILLS),Object.keys(require('../extension/pony-brain.js').SKILLS));
});
