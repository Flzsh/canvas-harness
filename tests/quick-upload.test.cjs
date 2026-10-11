'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Pack=require('../extension/quick-pack.js');
const Art=require('../extension/custom-art.js');
const Storage=require('../extension/storage.js');
const Core=require('../extension/core.js');
const modelPath=path.join(__dirname,'../extension/quick-upload.js');
const Upload=fs.existsSync(modelPath)?require(modelPath):{};
const ORIGIN='https://school.instructure.com';
const svg=(color='#123456')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/></svg>`;
const pack=parts=>Pack.build({name:'Test pack',parts:parts.map(p=>({svg:svg(),...p}))});
const courses=()=>[{id:'101',name:'Astronomy',code:'AST100'},{id:'102',name:'Biology Lab',code:'BIO-LAB'}];
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
async function fixture(list=courses()){
 const values=new Map(),control={writes:0,fail:false,holdRead:null,holdWrite:null};
 const adapter={read:async key=>{if(control.holdRead){const gate=control.holdRead;control.holdRead=null;await gate.promise;}return structuredClone(values.get(key));},write:async(key,value)=>{if(control.holdWrite){const gate=control.holdWrite;control.holdWrite=null;await gate.promise;}if(control.fail)throw Error('Disk full');control.writes++;values.set(key,structuredClone(value));}};
 const store=Storage.createStore({accountId:'1',origin:ORIGIN,adapter});await store.load();
 const other=Storage.createStore({accountId:'1',origin:ORIGIN,adapter});await other.load();
 const env={store,other,control,list,onChanges:[]};
 env.upload=Upload.create({store,getCourses:()=>env.list,onChange:s=>env.onChanges.push(s)});
 return env;
}
const group=(u,index=1)=>u.state.groups.find(g=>g.partIndexes.includes(index));

test('a failing UI subscriber cannot turn a persisted pack into failure or lose its undo',async()=>{
 const f=await fixture();f.store.subscribe(()=>{throw Error('Rendering failed');});
 await f.upload.review(pack([{course:'Astronomy',slot:'icon'}]));
 const result=await f.upload.apply();assert.equal(result.ok,true);assert.equal(f.upload.state.canUndo,true);
 assert.ok(f.store.get().settings.coursePrefs['101'].iconArt);
 assert.equal((await f.upload.undo()).ok,true);assert.equal(f.store.get().settings.coursePrefs['101'].iconArt,undefined);
});

test('standalone browser and CommonJS exports share the controller API',async()=>{
 assert.equal(typeof Upload.create,'function');
 const context=vm.createContext({TextEncoder,structuredClone});
 for(const file of ['quick-pack.js','workspace-arrange.js','custom-art.js','customization-model.js','quick-upload.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),context);
 const state={settings:{coursePrefs:{},overviewArt:{}}};
 const controller=context.CanvasHarnessQuickUpload.create({store:{get:()=>structuredClone(state),update:async fn=>{fn(state);return structuredClone(state);}},getCourses:()=>courses()});
 await controller.review(pack([{course:'Astronomy',slot:'icon'}]));
 assert.equal(controller.state.canApply,true);
 assert.equal((await controller.apply()).ok,true);
 assert.equal(state.settings.coursePrefs['101'].iconArt.name,'Astronomy icon');
});

test('review validates every SVG and exposes metadata without writing',async()=>{
 const f=await fixture();
 await f.store.update(d=>{d.settings.coursePrefs['101']={name:'My Astronomy',bannerArt:Art.importSVG(svg('#ff0000'),'old')};});
 const before=f.store.get(),writes=f.control.writes;
 const text=pack([{course:'Astronomy',slot:'banner',name:'<unsafe label>'},{course:'Astronomy',slot:'icon',svg:'<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'}]);
 const state=await f.upload.review(text);
 assert.equal(state.name,'Test pack');assert.equal(state.canApply,true);
 assert.equal(group(f.upload).courseId,'101');
 assert.equal(state.parts[0].replaces,true);assert.equal(state.parts[0].asset.name,'<unsafe label>');
 assert.deepEqual(state.parts[0].asset,Art.importSVG(svg(),'<unsafe label>'));
 assert.equal(state.parts[1].asset,null);assert.equal(state.parts[1].errors[0].code,'invalid-svg');
 assert.deepEqual(f.store.get(),before);assert.equal(f.control.writes,writes);
 state.parts[0].asset.svg='<svg><script/></svg>';
 const result=await f.upload.apply();assert.equal(result.ok,true);
 assert.equal(result.applied.length,1);assert.equal(result.notApplied.find(p=>p.index===2).reason,'invalid-svg');
 assert.equal(f.store.get().settings.coursePrefs['101'].bannerArt.svg,Art.importSVG(svg()).svg);
});

test('exact matches beat word matches, display names and normalized Canvas codes work',async()=>{
 const f=await fixture([Core.normalizeCourse({id:101,name:'AP Biology - Section 3',course_code:'APBIO-3'}),Core.normalizeCourse({id:102,name:'Biology Lab',course_code:'BIO-LAB'})]);
 await f.store.update(d=>{d.settings.coursePrefs['101']={name:'Bio (per. 3)'};});
 for(const [name,id] of [['Bio per 3','101'],['APBIO 3','101'],['Biology Lab','102'],['Section AP Biology','101']]){
  await f.upload.review(pack([{course:name,slot:'icon'}]));assert.equal(group(f.upload).courseId,id);
 }
});

test('ambiguity and missing targets stay separate until one group choice resolves all its parts',async()=>{
 const f=await fixture([{id:'101',name:'Biology Section A'},{id:'102',name:'Biology Section B'}]);
 await f.upload.review(pack([{course:'Biology',slot:'icon'},{course:'BIOLOGY!',slot:'frame'},{course:'Unlisted class',slot:'banner'}]));
 assert.equal(f.upload.state.groups.length,2);assert.equal(group(f.upload).status,'ambiguous');
 assert.deepEqual(group(f.upload).candidates.map(c=>c.id),['101','102']);
 assert.equal(f.upload.state.unresolved.length,2);assert.equal(f.upload.state.canApply,false);
 f.upload.choose(group(f.upload).key,'102');
 assert.equal(f.upload.state.canApply,false);assert.equal(f.upload.state.unresolved.length,1);
 const refused=await f.upload.apply();assert.equal(refused.ok,false);assert.equal(refused.error.code,'unresolved-target');
 assert.equal(f.store.get().settings.coursePrefs['102'],undefined);
 f.upload.includeGroup(f.upload.state.groups[1].key,false);
 assert.equal(f.upload.state.canApply,true);
 const result=await f.upload.apply();assert.equal(result.applied.length,2);
 assert.equal(result.unresolved.length,0);assert.equal(result.notApplied.find(p=>p.index===3).reason,'excluded-group');
 assert.ok(f.store.get().settings.coursePrefs['102'].borderArt);assert.equal(f.store.get().settings.coursePrefs['101'],undefined);
});

test('id targets share choices and fallback names can resolve missing ids',async()=>{
 const f=await fixture();
 await f.upload.review(pack([{courseId:'999',course:'Astronomy',slot:'banner'},{courseId:'999',course:'Alias',slot:'frame'}]));
 assert.equal(f.upload.state.groups.length,1);assert.equal(group(f.upload).courseId,'101');
 f.upload.choose(group(f.upload).key,'102');
 assert.equal((await f.upload.apply()).applied.length,2);
 assert.ok(f.store.get().settings.coursePrefs['102'].bannerArt);
});

test('selection excludes a part or entire group and changing a target recomputes replacements',async()=>{
 const f=await fixture();await f.store.update(d=>{d.settings.coursePrefs['102']={iconArt:Art.importSVG(svg('#ffffff'))};});
 await f.upload.review(pack([{course:'Astronomy',slot:'icon'},{course:'Astronomy',slot:'frame'},{place:'overview',slot:'banner'}]));
 f.upload.choose(group(f.upload).key,'102');assert.equal(f.upload.state.parts[0].replaces,true);
 f.upload.includePart(2,false);f.upload.includeGroup(group(f.upload,3).key,false);
 const result=await f.upload.apply();assert.equal(result.applied.length,1);
 assert.equal(result.notApplied.find(p=>p.index===2).reason,'excluded-part');
 assert.equal(result.notApplied.find(p=>p.index===3).reason,'excluded-group');
 assert.equal(f.store.get().settings.coursePrefs['102'].borderArt,undefined);
 assert.equal(f.store.get().settings.overviewArt.bannerArt,undefined);
});

test('every-course precedes named targets and different names resolving to a real slot use the last part',async()=>{
 const f=await fixture();
 await f.upload.review(pack([{course:'Astronomy',slot:'banner',svg:svg('#111111')},{place:'every-course',slot:'banner',svg:svg('#222222')},{courseId:'101',slot:'banner',svg:svg('#333333')},{place:'overview',slot:'icon'}]));
 assert.equal(f.upload.state.parts[0].status,'replaced');assert.equal(f.upload.state.parts[0].targets[0].replacedBy,3);
 assert.equal(f.upload.state.parts[1].status,'partial');
 const result=await f.upload.apply();assert.equal(result.applied.length,3);
 assert.equal(f.store.get().settings.coursePrefs['101'].bannerArt.svg,Art.importSVG(svg('#333333')).svg);
 assert.equal(f.store.get().settings.coursePrefs['102'].bannerArt.svg,Art.importSVG(svg('#222222')).svg);
 assert.ok(result.notApplied.some(p=>p.index===2&&p.courseId==='101'&&p.reason==='replaced'));
});

test('parser duplicate replacement and invalid parts remain visible alongside unknown future parts',async()=>{
 const f=await fixture();
 const text=`<?ch-pack version="1"?><?ch-art course="Astronomy" slot="icon"?>${svg()}<?ch-art course="Astronomy" slot="icon"?>${svg('#999999')}<?ch-art course="Astronomy" slot="title"?>${svg()}<?ch-theme?>{"theme":"dark"}<?ch-art course="Astronomy" slot="frame" fit="cover"?>${svg()}`;
 await f.upload.review(text);
 assert.equal(f.upload.state.parts[0].status,'replaced');assert.equal(f.upload.state.parts[2].errors[0].code,'bad-slot');
 assert.equal(f.upload.state.parsed.skipped[0].kind,'theme');
 assert.ok(f.upload.state.warnings.some(w=>w.code==='no-end'));assert.ok(f.upload.state.warnings.some(w=>w.code==='skipped'));
 assert.equal(f.upload.state.parts[3].warnings[0].code,'option-ignored');
 const result=await f.upload.apply();assert.equal(result.applied.length,2);assert.equal(result.notApplied.find(p=>p.index===4).reason,'unknown-kind');
 assert.equal(f.store.get().settings.theme,'system');
});

test('3 MiB UTF-8 limit and pack errors block storage, including multibyte text',async()=>{
 const f=await fixture();
 for(const [input,code] of [[null,'not-text'],[svg(),'not-a-pack'],['<?ch-pack version="999"?>','newer-version'],['é'.repeat(1572865),'too-large']]){
  const state=await f.upload.review(input);assert.equal(state.canApply,false);assert.equal(state.errors[0].code,code);
  assert.equal((await f.upload.apply()).ok,false);
 }
 assert.equal(f.control.writes,0);
});

test('a candidate exceeding the real total artwork budget is blocked before confirmation',async()=>{
 const f=await fixture(Array.from({length:10},(_,i)=>({id:String(101+i),name:'Class '+i})));
 const large=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="0" y="20">${'x'.repeat(230000)}</text></svg>`;
 await f.upload.review(pack([{place:'every-course',slot:'banner',svg:large}]));
 assert.equal(f.upload.state.budget.ok,false);assert.ok(f.upload.state.errors.some(e=>e.code==='budget-exceeded'));
 assert.equal(f.upload.state.canApply,false);assert.equal((await f.upload.apply()).ok,false);assert.equal(f.control.writes,0);
 f.upload.includeGroup(group(f.upload).key,false);assert.equal(f.upload.state.budget.ok,true);
});

test('one atomic write rebases art on current settings and preserves other account data',async()=>{
 const f=await fixture();
 await f.store.update(d=>{d.settings.coursePrefs['101']={name:'Astronomy',titleArt:Art.importSVG(svg('#eeeeee'),'title'),bannerFit:'cover',bannerPosition:'left'};d.tasks['7']={notes:'Notes'};d.gpa.weighted=true;d.gpa.courses['101']={credits:1,level:'honors',override:'A'};d.toolbox.scratchpad='Draft';});
 await f.upload.review(pack([{course:'Astronomy',slot:'banner'},{place:'overview',slot:'frame'}]));
 await f.other.update(d=>{d.settings.theme='dark';d.settings.coursePrefs['101'].color='#abcdef';d.tasks['8']={notes:'New task'};});
 const before=await f.other.load(),writes=f.control.writes;
 const result=await f.upload.apply();assert.equal(result.ok,true);assert.equal(f.control.writes,writes+1);
 const saved=await f.store.load();assert.equal(saved.settings.theme,'dark');assert.equal(saved.settings.coursePrefs['101'].color,'#abcdef');
 assert.deepEqual(saved.settings.coursePrefs['101'].titleArt,before.settings.coursePrefs['101'].titleArt);
 assert.equal(saved.settings.coursePrefs['101'].bannerFit,'cover');assert.equal(saved.settings.coursePrefs['101'].bannerPosition,'left');
 for(const key of ['tasks','gpa','toolbox','focus','customTasks','resourcePins'])assert.deepEqual(saved[key],before[key]);
 const otherAccount=Storage.createStore({accountId:'2',origin:ORIGIN,adapter:{read:async()=>null,write:async()=>{throw Error('unexpected');}}});
 assert.equal((await otherAccount.load()).settings.coursePrefs['101'],undefined);
});

test('a budget exceeded by subsequent artwork rejects the whole rebased transaction',async()=>{
 const f=await fixture();const large=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>${'x'.repeat(240000)}</text></svg>`;
 await f.upload.review(pack([{course:'Astronomy',slot:'banner',svg:large}]));assert.equal(f.upload.state.canApply,true);
 await f.other.update(d=>{for(let i=0;i<8;i++)d.settings.coursePrefs[String(200+i)]={bannerArt:Art.importSVG(large)};});
 const before=await f.other.load(),writes=f.control.writes;
 const result=await f.upload.apply();assert.equal(result.ok,false);assert.equal(result.error.code,'budget-exceeded');
 assert.deepEqual(await f.store.load(),before);assert.equal(f.control.writes,writes);
});

test('course membership or matching labels changed after review require a new review',async()=>{
 const f=await fixture();
 for(const change of [()=>{f.list=courses().slice(1);},()=>{f.list=[...courses(),{id:'103',name:'New class'}];},()=>{f.list=[{id:'101',name:'Physics'},courses()[1]];}]){
  f.list=courses();await f.upload.review(pack([{course:'Astronomy',slot:'icon'}]));change();
  const result=await f.upload.apply();assert.equal(result.ok,false);assert.equal(result.error.code,'courses-changed');assert.equal(f.control.writes,0);
 }
 f.list=courses();await f.upload.review(pack([{course:'Astronomy',slot:'icon'}]));
 await f.other.update(d=>{d.settings.coursePrefs['101']={name:'Renamed'};});
 assert.equal((await f.upload.apply()).error.code,'courses-changed');
});

test('course checks also run after a queued transaction reads latest storage',async()=>{
 const f=await fixture();await f.upload.review(pack([{course:'Astronomy',slot:'icon'}]));
 const gate=deferred();f.control.holdRead=gate;
 const pending=f.upload.apply();await new Promise(r=>setImmediate(r));f.list=courses().slice(1);gate.resolve();
 const result=await pending;assert.equal(result.error.code,'courses-changed');assert.equal(f.control.writes,0);
});

test('storage failure writes no partial art and retains the previous successful pack undo',async()=>{
 const f=await fixture();await f.upload.review(pack([{course:'Astronomy',slot:'icon'}]));await f.upload.apply();
 const before=f.store.get();await f.upload.review(pack([{course:'Astronomy',slot:'banner'},{place:'overview',slot:'frame'}]));
 f.control.fail=true;const failed=await f.upload.apply();assert.equal(failed.error.code,'storage-error');assert.deepEqual(f.store.get(),before);
 assert.equal(f.upload.state.canUndo,true);f.control.fail=false;assert.equal((await f.upload.undo()).ok,true);
 assert.equal(f.store.get().settings.coursePrefs['101'].iconArt,undefined);
});

test('undo restores only the last pack changed slots and banner options while preserving later unrelated edits',async()=>{
 const f=await fixture();const old=Art.importSVG(svg('#eeeeee'),'old');
 await f.store.update(d=>{d.settings.coursePrefs['101']={bannerArt:old,bannerFit:'contain',bannerPosition:'right',iconArt:old};});
 await f.upload.review(pack([{course:'Astronomy',slot:'icon'}]));await f.upload.apply();
 const firstIcon=f.store.get().settings.coursePrefs['101'].iconArt;
 await f.upload.review(pack([{course:'Astronomy',slot:'banner',fit:'cover',position:'left'},{place:'overview',slot:'frame'}]));await f.upload.apply();
 await f.other.update(d=>{d.settings.theme='dark';d.settings.coursePrefs['101'].color='#123456';d.settings.coursePrefs['102']={iconArt:old};d.tasks['7']={notes:'After apply'};});
 assert.equal((await f.upload.undo()).ok,true);const saved=await f.store.load();
 assert.deepEqual(saved.settings.coursePrefs['101'].bannerArt,old);assert.equal(saved.settings.coursePrefs['101'].bannerFit,'contain');assert.equal(saved.settings.coursePrefs['101'].bannerPosition,'right');
 assert.deepEqual(saved.settings.coursePrefs['101'].iconArt,firstIcon);assert.deepEqual(saved.settings.coursePrefs['102'].iconArt,old);
 assert.equal(saved.settings.overviewArt.borderArt,undefined);assert.equal(saved.settings.theme,'dark');assert.equal(saved.tasks['7'].notes,'After apply');assert.equal(f.upload.state.canUndo,false);
});

test('undo conflicts reject atomically and preserve the receipt for retry',async()=>{
 const f=await fixture();await f.upload.review(pack([{course:'Astronomy',slot:'banner',fit:'cover'},{place:'overview',slot:'icon'}]));await f.upload.apply();
 const applied=f.store.get().settings.coursePrefs['101'].bannerArt;
 await f.other.update(d=>{d.settings.coursePrefs['101'].bannerArt=Art.importSVG(svg('#ffffff'),'Manual');});
 const before=await f.other.load(),writes=f.control.writes;
 const result=await f.upload.undo();assert.equal(result.error.code,'undo-conflict');assert.equal(result.conflicts[0].key,'bannerArt');assert.equal(f.upload.state.canUndo,true);
 assert.deepEqual(await f.store.load(),before);assert.equal(f.control.writes,writes);
 await f.other.update(d=>{d.settings.coursePrefs['101'].bannerArt=applied;});
 f.control.fail=true;assert.equal((await f.upload.undo()).error.code,'storage-error');assert.equal(f.upload.state.canUndo,true);
 f.control.fail=false;assert.equal((await f.upload.undo()).ok,true);
});

test('prototype-looking names and ids cannot poison target maps or course preferences',async()=>{
 const f=await fixture([{id:'101',name:'__proto__'},{id:'102',name:'constructor'},{id:'__proto__',name:'Hostile id'}]);
 await f.upload.review(pack([{course:'__proto__',slot:'icon'},{course:'constructor',slot:'frame'},{courseId:'__proto__',slot:'banner'}]));
 assert.equal(f.upload.state.groups.length,3);assert.equal(f.upload.state.parts[2].status,'unresolved');
 assert.throws(()=>f.upload.choose(group(f.upload,3).key,'__proto__'),/course|choice/i);
 assert.equal((await f.upload.apply()).ok,false);
 f.upload.includeGroup(group(f.upload,3).key,false);
 assert.equal((await f.upload.apply()).applied.length,2);assert.equal(Object.hasOwn(f.store.get().settings.coursePrefs,'__proto__'),false);
 assert.equal({}.iconArt,undefined);assert.ok(f.store.get().settings.coursePrefs['101'].iconArt);
});

test('a newer review supersedes stale asynchronous course lookup and destroy silences completion',async()=>{
 const f=await fixture();const gate=deferred();let calls=0,notifications=0;
 const u=Upload.create({store:f.store,getCourses:()=>++calls===1?gate.promise:courses(),onChange:()=>{notifications++;}});
 const stale=u.review(pack([{course:'Astronomy',slot:'icon'}]));
 await u.review(pack([{course:'Biology Lab',slot:'frame'}]));gate.resolve(courses());await stale;
 assert.equal(u.state.parts[0].slot,'frame');assert.equal(group(u).courseId,'102');
 const gate2=deferred(),u2=Upload.create({store:f.store,getCourses:()=>gate2.promise,onChange:()=>{notifications++;}});
 const pending=u2.review(pack([{course:'Astronomy',slot:'banner'}]));u2.destroy();const count=notifications;gate2.resolve(courses());await pending;
 assert.equal(notifications,count);assert.equal(u2.state.phase,'destroyed');assert.equal((await u2.apply()).error.code,'destroyed');assert.equal(f.control.writes,0);
});

test('double apply is guarded and resetting or reviewing during a write cannot change its selection',async()=>{
 const f=await fixture();await f.upload.review(pack([{course:'Astronomy',slot:'icon'}]));
 const gate=deferred();f.control.holdWrite=gate;const pending=f.upload.apply();await new Promise(r=>setImmediate(r));
 assert.equal((await f.upload.apply()).error.code,'busy');
 f.upload.includePart(1,false);f.upload.reset();await f.upload.review(pack([{course:'Biology Lab',slot:'frame'}]));
 gate.resolve();assert.equal((await pending).ok,true);assert.equal(f.control.writes,1);assert.ok(f.store.get().settings.coursePrefs['101'].iconArt);
 assert.equal(f.store.get().settings.coursePrefs['102'],undefined);
});

test('destroy before a queued mutator prevents writing and an already dispatched write emits no stale updates',async()=>{
 for(const stage of ['holdRead','holdWrite']){
  const f=await fixture();await f.upload.review(pack([{course:'Astronomy',slot:'icon'}]));
  const gate=deferred();f.control[stage]=gate;const pending=f.upload.apply();await new Promise(r=>setImmediate(r));
  f.upload.destroy();const changes=f.onChanges.length;gate.resolve();const result=await pending;
  assert.equal(f.onChanges.length,changes);assert.equal(f.upload.state.phase,'destroyed');
  assert.equal(f.control.writes,stage==='holdRead'?0:1);
  assert.equal(result.ok,stage==='holdWrite');
 }
});

test('the real astronomy pack validates, previews all three slots and applies to a fake course',async()=>{
 const f=await fixture();const text=fs.readFileSync(path.join(__dirname,'../skills/canvas-harness-art/examples/astronomy/astronomy.chpack'),'utf8');
 await f.upload.review(text);assert.equal(f.upload.state.parts.length,3);assert.equal(f.upload.state.errors.length,0);
 assert.ok(f.upload.state.parts.every(p=>p.asset&&p.errors.length===0));assert.equal(f.upload.state.canApply,true);
 const result=await f.upload.apply();assert.equal(result.applied.length,3);
 const pref=f.store.get().settings.coursePrefs['101'];assert.ok(pref.bannerArt.svg);assert.ok(pref.iconArt.svg);assert.ok(pref.borderArt.svg);
});

test('overwriting a real banner slot retains options supplied by an earlier every-course part',async()=>{
 const f=await fixture();
 await f.upload.review(pack([{course:'Astronomy',slot:'banner',svg:svg('#aaaaaa')},{place:'every-course',slot:'banner',fit:'cover',position:'left'}]));
 const result=await f.upload.apply();assert.equal(result.ok,true);
 const pref=f.store.get().settings.coursePrefs['101'];assert.equal(pref.bannerFit,'cover');assert.equal(pref.bannerPosition,'left');
 assert.equal(pref.bannerArt.svg,Art.importSVG(svg('#aaaaaa')).svg);
 assert.deepEqual(result.applied.find(p=>p.index===2&&p.courseId==='101').fields,['bannerFit','bannerPosition']);
 assert.equal((await f.upload.undo()).ok,true);assert.equal(f.store.get().settings.coursePrefs['101'].bannerFit,'contain');assert.equal(f.store.get().settings.coursePrefs['101'].bannerPosition,'right');
});

test('undo remains usable after failed course lookup or during an asynchronous review',async()=>{
 for(const mode of ['failed','pending']){
  const f=await fixture(),gate=deferred();let loading=false;
  const u=Upload.create({store:f.store,getCourses:()=>loading?(mode==='failed'?Promise.reject(Error('No courses')):gate.promise):courses()});
  await u.review(pack([{course:'Astronomy',slot:'icon'}]));await u.apply();loading=true;
  const pending=u.review(pack([{course:'Astronomy',slot:'banner'}]));if(mode==='failed')await pending;
  assert.equal((await u.undo()).ok,true);assert.equal(f.store.get().settings.coursePrefs['101'].iconArt,undefined);
  gate.resolve(courses());await pending;assert.equal(u.state.canApply,false);assert.equal(u.state.canUndo,false);
 }
});

test('undo also validates the total budget and keeps its receipt when restoring would overflow',async()=>{
 const f=await fixture(),large=Art.importSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>${'x'.repeat(240000)}</text></svg>`);
 await f.store.update(d=>{for(let i=0;i<8;i++)d.settings.coursePrefs[String(101+i)]={bannerArt:large};});
 await f.upload.review(pack([{course:'Astronomy',slot:'banner'}]));await f.upload.apply();
 await f.other.update(d=>{d.settings.coursePrefs['999']={bannerArt:large};});
 const before=await f.other.load(),writes=f.control.writes;const result=await f.upload.undo();
 assert.equal(result.error.code,'budget-exceeded');assert.deepEqual(await f.store.load(),before);assert.equal(f.control.writes,writes);assert.equal(f.upload.state.canUndo,true);
});

test('failed writes report selected destinations as not applied instead of leaving an empty report',async()=>{
 const f=await fixture();await f.upload.review(pack([{course:'Astronomy',slot:'icon'},{course:'Unlisted',slot:'frame'}]));
 f.upload.includeGroup(group(f.upload,2).key,false);
 f.control.fail=true;const result=await f.upload.apply();assert.equal(result.ok,false);assert.equal(result.applied.length,0);
 assert.equal(result.notApplied.find(p=>p.index===1).reason,'storage-error');assert.equal(result.notApplied.find(p=>p.index===2).reason,'excluded-group');assert.equal(result.unresolved.length,0);
});

test('reset cancels a pending review while retaining the last successful undo',async()=>{
 const f=await fixture(),gate=deferred();let pendingCourses=false;
 const u=Upload.create({store:f.store,getCourses:()=>pendingCourses?gate.promise:courses()});
 await u.review(pack([{course:'Astronomy',slot:'icon'}]));await u.apply();pendingCourses=true;
 const pending=u.review(pack([{course:'Astronomy',slot:'banner'}]));u.reset();gate.resolve(courses());await pending;
 assert.equal(u.state.phase,'idle');assert.equal(u.state.parts.length,0);assert.equal(u.state.canUndo,true);assert.equal((await u.undo()).ok,true);
});

test('returned reports and notification snapshots cannot mutate retained controller state',async()=>{
 const f=await fixture();
 const u=Upload.create({store:f.store,getCourses:courses,onChange:state=>{if(state.parts[0]?.asset)state.parts[0].asset.svg='unsafe';if(state.report)state.report.applied.length=0;}});
 await u.review(pack([{course:'Astronomy',slot:'icon'}]));const result=await u.apply();result.applied.length=0;
 assert.equal(u.state.report.applied.length,1);assert.ok(f.store.get().settings.coursePrefs['101'].iconArt.svg.startsWith('<svg'));
 const undo=await u.undo();undo.applied.length=0;assert.equal(u.state.report.applied.length,1);
 await u.review(pack([{course:'Astronomy',slot:'banner'}]));f.control.fail=true;
 const failed=await u.apply();failed.error.code='tampered';assert.equal(u.state.error.code,'storage-error');
});

test('async-only getters cannot commit a stale course list in a synchronous store mutator',async()=>{
 const f=await fixture(),u=Upload.create({store:f.store,getCourses:async()=>courses()});
 await u.review(pack([{course:'Astronomy',slot:'icon'}]));assert.equal(u.state.canApply,true);
 const result=await u.apply();assert.equal(result.error.code,'courses-unavailable');assert.equal(f.control.writes,0);assert.equal(u.state.canApply,false);
});
