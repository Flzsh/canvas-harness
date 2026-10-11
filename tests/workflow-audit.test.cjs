'use strict';

// Independent integration audit. Only browser/OS boundaries are doubled; the
// storage, upload, dashboard, source, panel, transport, router and tab controller
// under test are the current production files. All account/content data is fake.
// These checks do not certify a live Canvas login or a provider's current DOM.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),extension=path.join(root,'extension');
const read=file=>fs.readFileSync(path.join(extension,file),'utf8');
const manifest=JSON.parse(read('manifest.json'));
const multiOrigin=manifest.host_permissions.includes('https://*.instructure.com/*');
const ORIGIN=multiOrigin?'https://school.instructure.com':new URL(manifest.host_permissions[0].replace(/\/\*$/,'/')).origin;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const copy=value=>structuredClone(value);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
async function until(check,label){for(let n=0;n<100;n++){if(check())return;await tick();}throw Error('Audit fixture did not reach '+label);}
function context(files=[],extra={}){
 const env=vm.createContext({URL,Intl,Date,Object,TextEncoder,TextDecoder,Uint8Array,structuredClone,AbortController,AbortSignal,Response,
  crypto:crypto.webcrypto,setTimeout,clearTimeout,btoa:value=>Buffer.from(value,'binary').toString('base64'),atob:value=>Buffer.from(value,'base64').toString('binary'),
  addEventListener(){},removeEventListener(){},location:new URL(ORIGIN+'/'),...extra});
 for(const file of files)vm.runInContext(read(file),env,{filename:path.join(extension,file)});
 return env;
}
function panelAPI(){const env=context([],{module:{exports:{}}});vm.runInContext(read('ai-panel.js'),env,{filename:path.join(extension,'ai-panel.js')});return env.module.exports;}
const STORE_FILES=['site.js','core.js','personal-work.js','custom-art.js','workspace-arrange.js','customization-model.js','gpa-model.js','storage.js','quick-pack.js','quick-upload.js'];
function memory(){
 const values=new Map(),subscribers=new Map(),writes=[];
 const control={failNext:false,writeGate:null,readGate:null,writeEntered:0,readEntered:0};
 const adapter={
  async read(key){if(control.readGate){const gate=control.readGate;control.readGate=null;control.readEntered++;await gate.promise;}return copy(values.get(key));},
  async write(key,value){if(control.writeGate){const gate=control.writeGate;control.writeGate=null;control.writeEntered++;await gate.promise;}
   if(control.failNext){control.failNext=false;throw Error('AUDIT simulated storage failure');}
   values.set(key,copy(value));writes.push({key,value:copy(value)});for(const callback of subscribers.get(key)||[])callback();},
  subscribe(key,callback){if(!subscribers.has(key))subscribers.set(key,new Set());subscribers.get(key).add(callback);return()=>subscribers.get(key).delete(callback);}
 };
 return {adapter,values,writes,control};
}
async function stores(t,{accountId='7',origin=ORIGIN,env=context(STORE_FILES),disk=memory()}={}){
 const make=async(account=accountId,site=origin)=>{const store=env.ReserveStorage.createStore({accountId:account,origin:site,adapter:disk.adapter});t.after(()=>store.destroy());await store.load();return store;};
 const store=await make(),other=await make();return {env,disk,store,other,make};
}
const SVG=color=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color||'#264653'}"/></svg>`;
const courses=()=>[{id:'10',name:'Chemistry',course_code:'CHEM'},{id:'20',name:'English',course_code:'ENG'}];
function pack(env,parts){return env.CanvasHarnessPack.build({name:'Synthetic audit artwork',parts:parts.map(part=>({svg:SVG(),...part}))});}
function uploadFixture(t,f){const list=courses(),upload=f.env.CanvasHarnessQuickUpload.create({store:f.store,getCourses:()=>list});t.after(()=>upload.destroy());return upload;}
async function personalSeed(f){
 await f.store.update(d=>{
  d.settings.coursePrefs['10']={name:'My lab',color:'#123456',titleArt:f.env.ReserveCustomArt.importSVG(SVG('#abcdef'),'Synthetic title'),bannerFit:'contain',bannerPosition:'right'};
  d.tasks['1']={notes:'AUDIT_PRIVATE_NOTE',pinned:true,plannedDate:'2026-10-12',progress:'in-progress',estimate:35,checklist:[{id:'step',text:'AUDIT_PRIVATE_CHECKLIST',done:false}]};
  d.resourcePins=[{id:'file:10:24',courseId:'10',title:'AUDIT_PRIVATE_BOOKMARK',url:ORIGIN+'/courses/10/files/24',category:'PDF'}];
  d.customTasks=[{id:'local-audit',name:'AUDIT_PRIVATE_PLAN',courseId:'10',createdAt:'2026-10-11T12:00:00Z',dueAt:null}];
  d.gpa.courses['10']={credits:1,level:'honors',override:'A-'};
  d.toolbox.scratchpad='AUDIT_PRIVATE_SCRATCHPAD';d.toolbox.dockSize={width:520,height:680};
 });
}
const personalKeys=['tasks','resourcePins','customTasks','gpa','toolbox','focus'];
function assertPersonal(actual,expected){for(const key of personalKeys)assert.deepEqual(actual[key],expected[key],key+' must survive an artwork transaction');}

test('audit: two account views serialize artwork, plans, bookmarks and notes through a delayed write',async t=>{
 const f=await stores(t);await personalSeed(f);const u=uploadFixture(t,f);
 await u.review(pack(f.env,[{courseId:'10',slot:'banner',fit:'cover',position:'left'},{place:'overview',slot:'frame'}]));
 const gate=deferred();f.disk.control.writeGate=gate;
 const pending=u.apply();await until(()=>f.disk.control.writeEntered===1,'artwork write');
 const edit=f.other.update(d=>{d.tasks['1'].notes='AUDIT newer note';d.tasks['1'].pinned=false;d.tasks['1'].plannedDate='2026-10-13';d.toolbox.scratchpad='AUDIT newer scratchpad';d.settings.coursePrefs['10'].color='#654321';d.settings.textSize='large';});
 assert.equal(f.disk.control.writeEntered,1);gate.resolve();assert.equal((await pending).ok,true);await edit;
 const saved=await f.store.load(),title=copy(saved.settings.coursePrefs['10'].titleArt);
 assert.equal(saved.tasks['1'].notes,'AUDIT newer note');assert.equal(saved.tasks['1'].pinned,false);assert.equal(saved.tasks['1'].plannedDate,'2026-10-13');
 assert.equal(saved.settings.coursePrefs['10'].bannerFit,'cover');assert.equal(saved.settings.textSize,'large');assert.ok(saved.settings.overviewArt.borderArt);
 assert.equal((await u.undo()).ok,true);const undone=await f.store.load();assertPersonal(undone,saved);
 assert.deepEqual(undone.settings.coursePrefs['10'].titleArt,title);assert.equal(undone.settings.coursePrefs['10'].color,'#654321');assert.equal(undone.settings.coursePrefs['10'].bannerArt,undefined);
 const reopened=await f.make();assertPersonal(reopened.get(),undone);
});

test('audit: independent document runtimes use actual Web Locks to merge artwork and notes', {skip:typeof globalThis.navigator?.locks?.request!=='function'},async t=>{
 const navigator={locks:globalThis.navigator.locks},env=context(STORE_FILES,{navigator}),f=await stores(t,{env,accountId:'7007'});
 await personalSeed(f);const u=uploadFixture(t,f),second=context(STORE_FILES,{navigator});
 const remote=second.ReserveStorage.createStore({accountId:'7007',origin:ORIGIN,adapter:f.disk.adapter});t.after(()=>remote.destroy());await remote.load();
 await u.review(pack(env,[{courseId:'10',slot:'banner'}]));const gate=deferred();f.disk.control.writeGate=gate;
 const applying=u.apply();await until(()=>f.disk.control.writeEntered===1,'independent document artwork write');let entered=false;
 const editing=remote.update(d=>{entered=true;d.tasks['1'].notes='AUDIT independent document note';d.tasks['1'].plannedDate='2026-10-14';});
 await tick();assert.equal(entered,false,'the second runtime must wait on the shared account lock');gate.resolve();assert.equal((await applying).ok,true);await editing;
 const result=await f.store.load();assert.equal(result.tasks['1'].notes,'AUDIT independent document note');assert.equal(result.tasks['1'].plannedDate,'2026-10-14');assert.ok(result.settings.coursePrefs['10'].bannerArt);
 assert.equal((await u.undo()).ok,true);assert.equal((await remote.load()).tasks['1'].notes,'AUDIT independent document note');
});

test('audit: an invalid combined art and note update cannot partially commit or poison the next transaction',async t=>{
 const f=await stores(t);await personalSeed(f);const before=f.store.get(),writes=f.disk.writes.length;
 await assert.rejects(f.store.update(d=>{d.settings.coursePrefs['10'].bannerArt=f.env.ReserveCustomArt.importSVG(SVG());d.tasks['1'].notes='x'.repeat(20001);}),/20,000/);
 assert.equal(f.disk.writes.length,writes);assert.deepEqual(await f.store.load(),before);
 const u=uploadFixture(t,f);await u.review(pack(f.env,[{courseId:'10',slot:'icon'}]));assert.equal((await u.apply()).ok,true);
 assertPersonal(await f.store.load(),before);assert.equal((await u.undo()).ok,true);
});

test('audit: a failed pack write leaves task drafts intact and a later pack and undo remain usable',async t=>{
 const f=await stores(t);await personalSeed(f);const u=uploadFixture(t,f),before=f.store.get();
 await u.review(pack(f.env,[{place:'every-course',slot:'banner'},{place:'overview',slot:'icon'}]));f.disk.control.failNext=true;
 assert.equal((await u.apply()).ok,false);assert.deepEqual(await f.store.load(),before);
 await f.other.update(d=>{d.tasks['1'].notes='AUDIT note after error';});assert.equal((await u.apply()).ok,true);
 assert.equal((await u.undo()).ok,true);assert.equal((await f.store.load()).tasks['1'].notes,'AUDIT note after error');
});

test('audit: manual artwork after a pack makes undo atomic while unrelated plans and appearance remain',async t=>{
 const f=await stores(t);await personalSeed(f);const u=uploadFixture(t,f);
 await u.review(pack(f.env,[{courseId:'10',slot:'banner',fit:'cover'},{place:'overview',slot:'frame'}]));assert.equal((await u.apply()).ok,true);
 const applied=copy(f.store.get().settings.coursePrefs['10'].bannerArt);
 await f.other.update(d=>{d.settings.coursePrefs['10'].bannerArt=f.env.ReserveCustomArt.importSVG(SVG('#eeeeee'),'Manual edit');d.tasks['1'].notes='AUDIT manual note';d.settings.livingArt='off';});
 const before=await f.store.load(),writes=f.disk.writes.length,result=await u.undo();
 assert.equal(result.error.code,'undo-conflict');assert.deepEqual(await f.store.load(),before);assert.equal(f.disk.writes.length,writes);assert.equal(u.state.canUndo,true);
 await f.other.update(d=>{d.settings.coursePrefs['10'].bannerArt=applied;});assert.equal((await u.undo()).ok,true);
 const after=await f.store.load();assertPersonal(after,before);assert.equal(after.settings.livingArt,'off');
});

test('audit: artwork, caches, recovery and matching numeric IDs never transfer to another account or supported site',async t=>{
 const f=await stores(t);await personalSeed(f);const u=uploadFixture(t,f);
 await u.review(pack(f.env,[{place:'every-course',slot:'icon'}]));assert.equal((await u.apply()).ok,true);
 await f.store.writeCache({origin:ORIGIN,user:{id:'7'},courses:courses(),assignments:[{id:'1',name:'AUDIT_PRIVATE_CACHE'}]});
 await f.store.writeResourceCache({origin:ORIGIN,accountId:'7',courseId:'10',fetchedAt:'2026-10-11T12:00:00Z',frontPage:{body:'AUDIT_PRIVATE_MATERIAL'}});
 await f.store.saveRecovery();
 const sites=[ORIGIN,...(multiOrigin?['https://other-school.instructure.com']:[])];
 for(const site of sites){assert.equal(f.env.ReserveSite.supported(site),true);const fresh=await f.make(site===ORIGIN?'8':'7',site),data=fresh.get();
  assert.equal(data.settings.showGrades,false);assert.deepEqual(data.tasks,{});assert.deepEqual(data.settings.coursePrefs,{});assert.deepEqual(data.resourcePins,[]);
  assert.equal(await fresh.readCache(),null);assert.equal(await fresh.readRecovery(),null);assert.equal(await fresh.readResourceCache('10'),null);
  assert.throws(()=>f.env.ReserveStorage.validateBackup(f.store.exportBackup(),fresh.owner),/different Canvas account or site/);
 }
 if(!multiOrigin)assert.equal(f.env.ReserveSite.supported('https://other-school.instructure.com'),false);
});

// A minimal DOM boundary like the repository's dashboard interaction fixtures.
// The production dashboard renders and handles its real click/change events.
async function dashboardFixture(t,options={}){
 const events={},fields=new Map(),docEvents={},saved=new Map();let toolboxOptions;
 const element={className:'',dataset:{},style:{setProperty(){}},setAttribute(){},addEventListener:(name,fn)=>{events[name]=fn;},removeEventListener(){},
  querySelector:selector=>fields.get(selector)||null,querySelectorAll:()=>[],remove(){},innerHTML:''};
 const document={createElement:()=>element,addEventListener:(name,fn)=>{docEvents[name]=fn;},removeEventListener(){}};
 const env=context(STORE_FILES,{document,matchMedia:()=>({matches:false}),sessionStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  ReserveToolbox:{create(value){toolboxOptions=value;return {update(){},close(){},destroy(){},open(){}};}}});
 // Gesture/rendering geometry is outside this storage/selection audit.
 env.ReserveWorkspaceGestures={create:()=>({active:()=>false,sync(){},destroy(){},click(){return false;},action(){return false;},pointerdown(){},pointerup(){},pointercancel(){},contextmenu(){},pointermove(){},keydown(){return false;}})};
 for(const file of ['ui-utils.js','grades-view.js','customize-ui.js','dashboard-model.js','work-model.js','dashboard-view.js','dashboard.js','ai-context.js','ai-source.js'])vm.runInContext(read(file),env,{filename:path.join(extension,file)});
 const f=await stores(t,{env});await personalSeed(f);
 const snapshot={origin:ORIGIN,user:{id:'7'},courses:courses(),assignments:[{id:'1',course_id:'10',name:'Synthetic lab',description:'',due_at:new Date(Date.now()+86400000).toISOString(),submission_types:['online_upload'],submission:{workflow_state:'unsubmitted',score:12}},{id:'2',course_id:'20',name:'Synthetic essay',description:'',due_at:new Date(Date.now()+86400000).toISOString(),submission_types:['online_upload'],submission:{workflow_state:'unsubmitted'}}]};
 const before=copy(snapshot),view=env.ReserveDashboard.mount({append(){}},{snapshot,store:f.store,initialState:{workspace:'work',...options.initialState}});t.after(()=>view.destroy());
 const click=(action,data={})=>events.click({detail:0,target:{closest:selector=>selector==='[data-rd-action]'?{dataset:{rdAction:action,...data}}:null}});
 const change=(field,value,id='1')=>events.change({target:{dataset:{rdField:field,id},value}});
 const idle=async()=>{await f.store.update(()=>{});await tick();await tick();};
 return {...f,view,snapshot,before,element,events,click,change,idle,getContext:()=>toolboxOptions.getContext()};
}

test('audit: selected assignments archive and undo without losing material selection, notes, bookmarks or Canvas state',async t=>{
 const f=await dashboardFixture(t),before=f.store.get();
 f.click('select-item',{id:'1'});f.click('select-source',{source:'page:10:guide'});
 assert.deepEqual(copy(f.getContext().aiSelectedIds),['assignment:10:1','page:10:guide']);
 f.click('selection-archive');await f.idle();assert.equal(f.store.get().tasks['1'].checkedOff,true);
 assert.deepEqual(copy(f.getContext().aiSelectedIds),['page:10:guide']);assert.deepEqual(f.snapshot,f.before);
 f.click('selection-undo');await f.idle();const data=f.store.get();assert.equal(data.tasks['1'].checkedOff,false);
 assertPersonal(data,before);assert.deepEqual(copy(f.getContext().aiSelectedIds),['page:10:guide']);assert.deepEqual(f.snapshot,f.before);
});

test('audit: failed batch archive keeps exact AI selection and retries once storage is available',async t=>{
 const f=await dashboardFixture(t);f.click('select-item',{id:'1'});f.click('select-item',{id:'2'});const selected=copy(f.getContext().aiSelectedIds),before=f.store.get();
 f.disk.control.failNext=true;f.click('selection-archive');await f.idle();assert.deepEqual(f.store.get(),before);assert.deepEqual(copy(f.getContext().aiSelectedIds),selected);
 f.click('selection-archive');await f.idle();assert.equal(f.store.get().tasks['1'].checkedOff,true);assert.equal(f.store.get().tasks['2'].checkedOff,true);assert.deepEqual(copy(f.getContext().aiSelectedIds),[]);
});

test('audit regression: archive undo restores the state read by its transaction, including an earlier queued completion',async t=>{
 const f=await dashboardFixture(t),gate=deferred();f.disk.control.writeGate=gate;
 const external=f.other.update(d=>{d.tasks['1'].checkedOff=true;d.tasks['1'].notes='AUDIT completion in another tab';});
 await until(()=>f.disk.control.writeEntered===1,'other tab completion');f.click('select-item',{id:'1'});f.click('selection-archive');gate.resolve();await external;await f.idle();
 f.click('selection-undo');await f.idle();
 assert.equal(f.store.get().tasks['1'].notes,'AUDIT completion in another tab');
 assert.equal(f.store.get().tasks['1'].checkedOff,true,'undo must restore the actual pre-archive value, not the stale rendered value');
});

test('audit: progress ready/reopen and bookmark changes preserve selection and never edit Canvas submission',async t=>{
 const f=await dashboardFixture(t);f.click('select-item',{id:'1'});f.change('progress','done');await f.idle();
 assert.equal(f.store.get().tasks['1'].progress,'done');assert.equal(f.store.get().tasks['1'].checkedOff,false);
 assert.deepEqual(copy(f.getContext().aiSelectedIds),['assignment:10:1']);assert.deepEqual(f.snapshot,f.before);
 f.click('check-off',{id:'1'});await f.idle();assert.equal(f.store.get().tasks['1'].checkedOff,true);
 f.change('progress','in-progress');await f.idle();assert.equal(f.store.get().tasks['1'].checkedOff,false);assert.equal(f.store.get().tasks['1'].pinned,true);
 f.click('pin',{id:'1'});await f.idle();assert.equal(f.store.get().tasks['1'].pinned,false);
 assert.deepEqual(copy(f.getContext().aiSelectedIds),['assignment:10:1']);assert.equal(f.store.get().tasks['1'].notes,'AUDIT_PRIVATE_NOTE');
 assert.equal(f.store.get().tasks['1'].plannedDate,'2026-10-12');assert.deepEqual(f.snapshot,f.before);
});

function event(){const listeners=new Set();return {addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn),emit(...args){for(const fn of [...listeners])fn(...args);}};}
function portPair(name,sender,trace){
 const a={name,onMessage:event(),onDisconnect:event()},b={name,sender,onMessage:event(),onDisconnect:event()};let connected=true;
 a.postMessage=value=>{if(!connected)throw Error('Port closed');trace.push({direction:'request',name,value:copy(value)});queueMicrotask(()=>{if(connected)b.onMessage.emit(value);});};
 b.postMessage=value=>{if(!connected)throw Error('Port closed');trace.push({direction:'reply',name,value:copy(value)});queueMicrotask(()=>{if(connected)a.onMessage.emit(value);});};
 const disconnect=()=>{if(!connected)return;connected=false;a.onDisconnect.emit();b.onDisconnect.emit();};a.disconnect=disconnect;b.disconnect=disconnect;return {client:a,server:b};
}
function clock(){
 let now=0,next=0;const tasks=new Map();
 return {tasks,setTimeout(fn,ms){const id=++next;tasks.set(id,{fn,due:now+ms,ms});return id;},clearTimeout:id=>tasks.delete(id),
  async advance(ms){const end=now+ms;for(let n=0;n<500;n++){const entry=[...tasks].filter(([,task])=>task.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!entry){now=end;await tick();return;}const [id,task]=entry;now=task.due;tasks.delete(id);task.fn();await tick();}throw Error('Audit clock exceeded its bounded timer budget');}};
}

async function aiFixture(t){
 const time=clock(),trace=[],session=new Map(),tabs=new Map(),executions=[],permissionRequests=[],fetches=[],fileReads=[],downloads=[],pdfReads=[];let nextTab=100,currentAccount='7',grant=true,webResult={status:'injected',message:'Synthetic browser acknowledged insertion'};
 const extensionId='a'.repeat(32),extensionURL='chrome-extension://'+extensionId+'/';
 const runtime={id:extensionId,getURL:file=>extensionURL+file,onConnect:event(),onMessage:event(),connectNative(){throw Error('Legacy native connection must never be used');}};
 tabs.set(12,{id:12,url:ORIGIN+'/',windowId:5,status:'complete',incognito:false});
 const chrome={runtime,permissions:{contains:async()=>grant},storage:{session:{get:async key=>({[key]:copy(session.get(key))}),set:async values=>{for(const [key,value] of Object.entries(values))session.set(key,copy(value));}}},
  tabs:{get:async id=>{if(!tabs.has(id))throw Error('Synthetic tab closed');return {...tabs.get(id)};},create:async details=>{const tab={id:nextTab++,url:details.url,windowId:details.windowId,status:'complete',incognito:false};tabs.set(tab.id,tab);return {...tab};},update:async(id,details)=>{if(!tabs.has(id))throw Error('Synthetic tab closed');Object.assign(tabs.get(id),details);return {...tabs.get(id)};}},
  windows:{get:async()=>({id:5,type:'normal'}),update:async()=>({id:5,type:'normal'})},
  scripting:{executeScript:async details=>{executions.push(details);return [{frameId:0,result:copy(webResult)}];}},
  offscreen:{hasDocument:async()=>true}};
 const worker=context([],{chrome,setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,
  fetch:async(url,options)=>{fetches.push({url,options});return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:currentAccount})};}});
 worker.importScripts=(...files)=>{for(const file of files)vm.runInContext(read(file),worker,{filename:path.join(extension,file)});};
 vm.runInContext(read('background.js'),worker,{filename:path.join(extension,'background.js')});
 // The real offscreen request handler runs here. Its dedicated PDF worker is a
 // boundary double; the existing pdf-context tests exercise the actual parser.
 const offscreenEvent=event(),offscreen=context([],{chrome:{runtime:{id:extensionId,onMessage:offscreenEvent}},atob:value=>Buffer.from(value,'base64').toString('binary'),
  CanvasHarnessPDF:{extract:async(bytes,options)=>{pdfReads.push({bytes:copy(bytes),options:copy(options)});return {text:'AUDIT_SELECTED_PDF_TEXT',pages:1,totalPages:1,truncated:false,warnings:[]};}}});
 vm.runInContext(read('ai-offscreen.js'),offscreen,{filename:path.join(extension,'ai-offscreen.js')});
 runtime.sendMessage=message=>new Promise(resolve=>offscreenEvent.emit(message,{id:extensionId},resolve));
 const roleRuntime=(role)=>({...runtime,connect({name}){const sender={id:extensionId,tab:{id:12},frameId:role==='source'?0:1,url:role==='source'?ORIGIN+'/':extensionURL+'ai-panel.html'};
  const pair=portPair(name,sender,trace);runtime.onConnect.emit(pair.server);return pair.client;},
  sendMessage:message=>new Promise(resolve=>runtime.onMessage.emit(message,{id:extensionId,tab:{id:12},frameId:0,url:ORIGIN+'/'},resolve))});
 const frame={addEventListener(){},remove(){},focus(){}};
 const env=context(STORE_FILES.concat(['ai-context.js','ai-source.js']),{chrome:{runtime:roleRuntime('source')},document:{createElement:()=>frame},setInterval:()=>0,clearInterval(){},
  fetch:async(url,options)=>{downloads.push({url,options});return new Response('%PDF-audit',{headers:{'Content-Type':'application/pdf'}});}});
 const f=await stores(t,{env});await personalSeed(f);
 const ctx={courses:courses(),courseId:'10',aiAssignmentId:null,aiSelectedIds:['assignment:10:1'],items:[{id:'1',courseId:'10',name:'Synthetic lab',courseName:'Chemistry',description:'Teacher instructions'},{id:'2',courseId:'20',name:'Unselected essay',description:'AUDIT_UNSELECTED_CONTENT'}],s:{}};
 const client={origin:ORIGIN,profile:async()=>({id:currentAccount}),readAssignment:async(course,id)=>({id,course_id:course,name:'Synthetic lab',description:'<p>Teacher instructions</p>',rubric:[{description:'Explain observations',points:10}],submission:{body:'AUDIT_PRIVATE_SUBMISSION',score:12},score:12,grade:'AUDIT_PRIVATE_GRADE'}),
  readFile:async(course,id)=>{fileReads.push({course,id});return {id,filename:'Synthetic.pdf','content-type':'application/pdf',size:15};}};
 const mounted=env.CanvasHarnessAISource.mount({container:{append(){}},getContext:()=>ctx,store:f.store,client,user:{id:'7'}});t.after(()=>mounted.destroy());
 const api=panelAPI();let controller;
 const panelEnv={location:new URL(extensionURL+'ai-panel.html'),chrome:{runtime:roleRuntime('panel')},crypto:crypto.webcrypto,setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,btoa:value=>Buffer.from(value,'binary').toString('base64')};
 const transport=api.createTransport(panelEnv,{catalog:catalog=>controller?.setCatalog(catalog),disconnect:reason=>controller?.disconnected(reason)});
 controller=api.createController({transport,permissions:{request:async details=>{permissionRequests.push(copy(details));return grant;},contains:async()=>grant},clipboard:{writeText:async()=>{}},env:panelEnv});
 t.after(()=>{controller.dispose();transport.dispose();});await until(()=>controller.state.catalog,'initial Canvas catalog');
 return {...f,time,trace,session,tabs,executions,permissionRequests,fetches,fileReads,downloads,pdfReads,worker,chrome,controller,transport,ctx,client,mounted,
  setGrant:value=>{grant=value;},setAccount:value=>{currentAccount=value;},setWebResult:value=>{webResult=value;}};
}
const injectRequests=f=>f.trace.filter(x=>x.direction==='request'&&x.name==='ch-ai-panel'&&x.value.action==='web'&&x.value.op==='inject');

test('audit: real source to panel to background shares only selected instructions and excludes private plans and grades',async t=>{
 const f=await aiFixture(t),c=f.controller;c.setDraft('Explain the selected lab');
 assert.equal(f.executions.length,0);assert.equal(await c.inject(),true);assert.equal(f.executions.length,1);assert.equal(c.state.busy,'');
 const text=f.executions[0].args[0];assert.match(text,/Teacher instructions/);assert.match(text,/Explain observations/);assert.match(text,/Explain the selected lab/);
 assert.doesNotMatch(text,/AUDIT_(?:PRIVATE|UNSELECTED)/);assert.equal(f.executions[0].args[1].autoSend,false);
 assert.equal(f.executions[0].func,f.worker.CanvasHarnessInject.insertDraft);assert.equal(f.permissionRequests.length,1);
 assert.deepEqual(f.permissionRequests[0],{permissions:['scripting'],origins:['https://chatgpt.com/*']});
 assert.ok(f.fetches.every(call=>call.url===ORIGIN+'/api/v1/users/self/profile'));assert.doesNotMatch(JSON.stringify([...f.session]),/AUDIT_PRIVATE|Teacher instructions|selected lab/);
 assertPersonal(f.store.get(),(await f.make()).get());
});

test('audit: website denial, provider failure and success each leave Send reusable without automatic replay',async t=>{
 const f=await aiFixture(t),c=f.controller;c.setDraft('AUDIT question');f.setGrant(false);
 assert.equal(await c.inject(),false);assert.equal(f.fileReads.length,0);assert.equal(injectRequests(f).length,0);assert.equal(f.executions.length,0);assert.equal(c.state.busy,'');
 f.setGrant(true);f.setWebResult({status:'no-editor',message:'Synthetic composer unavailable'});assert.equal(await c.inject(),false);assert.equal(c.state.draft,'AUDIT question');assert.equal(c.state.busy,'');
 await tick();assert.equal(f.executions.length,1);
 f.setWebResult({status:'injected',message:'Synthetic ready'});assert.equal(await c.inject(),true);assert.equal(c.state.busy,'');
 c.setDraft('AUDIT second question');assert.equal(await c.inject(),true);assert.equal(f.executions.length,3);assert.equal(injectRequests(f).length,3);
});

test('audit: provider switching asks for only its access and sends solely on a fresh user action',async t=>{
 const f=await aiFixture(t),c=f.controller;c.setDraft('Synthetic question');c.setProvider('claude');await tick();assert.equal(f.executions.length,0);
 assert.equal(await c.inject(),true);assert.deepEqual(f.permissionRequests.at(-1),{permissions:['scripting'],origins:['https://claude.ai/*']});assert.equal(new URL(f.tabs.get(f.executions.at(-1).target.tabId).url).origin,'https://claude.ai');
 c.setProvider('gemini');await tick();assert.equal(f.executions.length,1);assert.equal(await c.inject(),true);assert.equal(new URL(f.tabs.get(f.executions.at(-1).target.tabId).url).origin,'https://gemini.google.com');
 assert.deepEqual(f.permissionRequests.at(-1),{permissions:['scripting'],origins:['https://gemini.google.com/*']});
});

test('audit: a collection timeout ignores its late reply and a subsequent explicit Send succeeds',async t=>{
 const f=await aiFixture(t),c=f.controller,gate=deferred();const readAssignment=f.client.readAssignment;let reads=0;
 f.client.readAssignment=async(...args)=>{reads++;if(reads===1)await gate.promise;return readAssignment(...args);};
 c.setDraft('Synthetic retry question');const pending=c.inject();await until(()=>reads===1,'pending assignment read');await f.time.advance(60000);
 assert.equal(await pending,false);assert.match(c.state.error,/timed out/);assert.equal(c.state.busy,'');assert.equal(f.executions.length,0);
 gate.resolve();await tick();await tick();assert.equal(f.executions.length,0);assert.equal(c.state.draft,'Synthetic retry question');
 assert.equal(await c.inject(),true);assert.equal(f.executions.length,1);assert.equal(c.state.busy,'');
});

test('audit regression: a timed-out Send revokes the background handoff before a delayed browser API recovers',async t=>{
 const f=await aiFixture(t),c=f.controller,gate=deferred();let focusing=false;
 const update=f.chrome.windows.update;f.chrome.windows.update=async(...args)=>{focusing=true;await gate.promise;return update(...args);};
 c.setDraft('AUDIT timed out draft');c.setAutoSend(true);const pending=c.inject();await until(()=>focusing,'delayed provider focus');
 await f.time.advance(60000);assert.equal(await pending,false);assert.match(c.state.error,/timed out/);assert.equal(c.state.busy,'');
 assert.equal(f.executions.length,0);gate.resolve();await tick();await tick();
 assert.equal(f.executions.length,0,'an expired request must not later paste or auto-send the preserved question');
});

test('audit: closing or changing selection during provider readiness prevents insertion after it recovers',async t=>{
 for(const action of ['close','selection']){
  const f=await aiFixture(t),c=f.controller,gate=deferred();let focusing=false;
  const update=f.chrome.windows.update;f.chrome.windows.update=async(...args)=>{focusing=true;await gate.promise;return update(...args);};
  c.setDraft('Synthetic cancelled question');const pending=c.inject();await until(()=>focusing,'provider readiness');
  if(action==='close')await c.close();else {f.ctx.aiSelectedIds=['assignment:20:2'];f.mounted.update();await tick();}
  gate.resolve();assert.equal(await pending,false);assert.equal(f.executions.length,0);assert.equal(c.state.busy,'');
 }
});

test('audit: a live Canvas account switch cannot send the already collected prompt to a provider',async t=>{
 const f=await aiFixture(t),c=f.controller;c.setDraft('Synthetic question');const read=f.client.readAssignment;
 f.client.readAssignment=async(...args)=>{const result=await read(...args);f.setAccount('8');return result;};
 assert.equal(await c.inject(),false);assert.equal(f.executions.length,0);assert.equal(injectRequests(f).length,0);assert.match(c.state.error,/account changed/);
});

test('audit regression: missing insertion code with permission already granted reports readiness rather than requesting access again',async t=>{
 const f=await aiFixture(t),c=f.controller;f.worker.CanvasHarnessInject=null;assert.equal(vm.runInContext('Boolean(globalThis.CanvasHarnessInject)',f.worker),false);c.setDraft('Synthetic code readiness question');
 assert.equal(await c.inject(),false);assert.equal(f.executions.length,0);assert.equal(c.state.busy,'');
 assert.equal([...f.tabs.values()].filter(tab=>tab.url.startsWith(f.chrome.runtime.getURL('ai-permission.html'))).length,0,'a missing script is not a missing permission');
 assert.match(c.state.error,/reload|unavailable|missing|code/i);
});

test('audit: the assignment PDF checkbox actually prevents downloads through the complete Send workflow',async t=>{
 const f=await aiFixture(t),c=f.controller,readAssignment=f.client.readAssignment;
 f.client.readAssignment=async(...args)=>({...await readAssignment(...args),description:'<p>Teacher instructions</p><a href="/courses/10/files/24">Synthetic PDF</a><a href="/courses/10/pages/guide">Other page</a>'});
 c.setAssignmentPdfs(false);c.setDraft('Synthetic PDF opt out');assert.equal(await c.inject(),true);assert.equal(f.fileReads.length,0);
 assert.match(f.executions[0].args[0],/Teacher instructions/);assert.doesNotMatch(f.executions[0].args[0],/Attached PDF|AUDIT_PRIVATE/);
 assert.equal(f.trace.find(x=>x.direction==='request'&&x.name==='ch-ai-panel'&&x.value.action==='collect').value.includeAssignmentPdfs,false);
});

test('audit: selected assignment PDFs cross the local offscreen boundary only when included, with hard limits',async t=>{
 const f=await aiFixture(t),c=f.controller,readAssignment=f.client.readAssignment;
 f.client.readAssignment=async(...args)=>({...await readAssignment(...args),description:'<p>Teacher instructions</p><a href="/courses/10/files/24">PDF</a><a href="/courses/20/files/25">Unselected other course</a><a href="/courses/10/pages/guide">Unselected page</a>'});
 c.setDraft('Explain this PDF');assert.equal(f.downloads.length,0);assert.equal(f.pdfReads.length,0);
 assert.equal(await c.inject(),true,JSON.stringify({error:c.state.error,issues:c.state.context?.issues}));assert.deepEqual(f.fileReads,[{course:'10',id:'24'}]);assert.equal(f.downloads.length,1);assert.equal(f.pdfReads.length,1);
 assert.equal(f.downloads[0].url,ORIGIN+'/files/24/download');assert.equal(f.downloads[0].options.credentials,'same-origin');assert.equal(f.downloads[0].options.referrerPolicy,'no-referrer');
 assert.deepEqual(f.pdfReads[0].options,{maxPages:20,maxChars:60000,timeoutMs:15000});assert.match(f.executions[0].args[0],/AUDIT_SELECTED_PDF_TEXT/);assert.doesNotMatch(f.executions[0].args[0],/AUDIT_PRIVATE|AUDIT_UNSELECTED_CONTENT/);
 c.setAssignmentPdfs(false);assert.equal(await c.inject(),true);assert.equal(f.downloads.length,1);assert.equal(f.pdfReads.length,1);assert.doesNotMatch(f.executions[1].args[0],/AUDIT_SELECTED_PDF_TEXT/);
 assert.doesNotMatch(JSON.stringify([...f.session]),/AUDIT_SELECTED_PDF_TEXT/);
});

test('audit: a failed automatic PDF read requires explicit review and can recover on a later Send',async t=>{
 const f=await aiFixture(t),c=f.controller,readAssignment=f.client.readAssignment,readFile=f.client.readFile;
 f.client.readAssignment=async(...args)=>({...await readAssignment(...args),description:'<p>Teacher instructions</p><a href="/courses/10/files/24">PDF</a>'});
 f.client.readFile=async(...args)=>({...await readFile(...args),size:2*1024*1024+1});c.setDraft('Synthetic PDF question');
 assert.equal(await c.inject(),false);assert.equal(f.downloads.length,0);assert.equal(f.pdfReads.length,0);assert.equal(f.executions.length,0);assert.equal(c.state.busy,'');
 assert.ok(c.state.context.issues.some(issue=>/2 MiB/.test(issue.reason)));assert.equal(c.state.draft,'Synthetic PDF question');
 f.client.readFile=readFile;assert.equal(await c.inject(),true,JSON.stringify({error:c.state.error,issues:c.state.context?.issues}));assert.equal(f.executions.length,1);assert.equal(f.pdfReads.length,1);assert.equal(c.state.context.issues.length,0);
});

test('audit: a manually attached local PDF remains memory-only and never sends before a click',async t=>{
 const f=await aiFixture(t),c=f.controller;
 assert.equal(await c.attach({name:'Synthetic.pdf',size:10,arrayBuffer:async()=>Buffer.from('%PDF-audit')}),true);
 assert.equal(f.executions.length,0);assert.equal(injectRequests(f).length,0);assert.equal(c.state.pdfs.length,1);assert.equal(f.pdfReads.length,1);
 assert.equal(await c.preview(),true);assert.equal(f.executions.length,0);assert.match(c.state.context.text,/AUDIT_SELECTED_PDF_TEXT/);
 assert.doesNotMatch(JSON.stringify(f.store.get()),/AUDIT_SELECTED_PDF_TEXT|Synthetic\.pdf/);assert.doesNotMatch(JSON.stringify([...f.session]),/AUDIT_SELECTED_PDF_TEXT/);
 assert.equal(await c.inject(),true);assert.match(f.executions[0].args[0],/AUDIT_SELECTED_PDF_TEXT/);assert.equal(c.state.busy,'');
});

test('audit: explicit local PDF size checks happen before byte reads or background extraction and never send',async t=>{
 const f=await aiFixture(t),c=f.controller;let reads=0;
 assert.equal(await c.attach({name:'Synthetic.pdf',size:2*1024*1024+1,arrayBuffer(){reads++;throw Error('Must not read');}}),false);
 assert.equal(reads,0);assert.equal(f.executions.length,0);assert.equal(f.trace.some(x=>x.direction==='request'&&x.value.action==='pdf'),false);assert.equal(c.state.busy,'');
 assert.equal(await c.attach({name:'Synthetic.pdf',size:5,arrayBuffer:async()=>{reads++;return Buffer.from('wrong');}}),false);
 assert.equal(reads,1);assert.equal(f.trace.some(x=>x.direction==='request'&&x.value.action==='pdf'),false);assert.equal(f.executions.length,0);
});

test('audit: real build entries contain neither runtime student data nor an installed legacy authentication backend',async t=>{
 const f=await stores(t);await personalSeed(f);const output=new Map(),files=fs.readdirSync(extension,{recursive:true}).filter(file=>fs.statSync(path.join(extension,file)).isFile());
 const fakeFS={...fs,mkdirSync(){},writeFileSync(file,value){output.set(path.resolve(file),Buffer.from(value));}};
 const buildContext=vm.createContext({Buffer,console:{log(){}},__dirname:path.join(root,'scripts'),require(name){
  if(name==='node:fs')return fakeFS;if(name==='node:path')return path;if(name==='node:crypto')return crypto;if(name==='node:zlib')return zlib;
  if(name==='./check.cjs')return {root,extension,files,manifest};throw Error('Unexpected build dependency '+name);
 }});
 vm.runInContext(fs.readFileSync(path.join(root,'scripts/build.cjs'),'utf8'),buildContext,{filename:path.join(root,'scripts/build.cjs')});
 const release=JSON.parse(output.get(path.join(root,'dist/release-manifest.json'))),installed=release.packages.find(pkg=>!pkg.file.includes('-source'));
 assert.ok(installed);assert.ok(installed.entries.some(entry=>entry.path==='manifest.json'));
 assert.ok(installed.entries.every(entry=>!/(?:^|\/)(?:companion|tests|preview|snapshots|backups|credentials|tokens)(?:\/|\.)/i.test(entry.path)));
 const archive=output.get(path.join(root,'dist',installed.file));let offset=0;const bodies=new Map();
 while(archive.readUInt32LE(offset)===0x04034b50){const size=archive.readUInt32LE(offset+18),nameLength=archive.readUInt16LE(offset+26),extra=archive.readUInt16LE(offset+28),start=offset+30+nameLength+extra;
  const name=archive.subarray(offset+30,offset+30+nameLength).toString();assert.ok(!bodies.has(name),'Duplicate ZIP entry: '+name);bodies.set(name,zlib.inflateRawSync(archive.subarray(start,start+size)));offset=start+size;}
 for(const [name,body] of bodies)assert.ok(!body.includes(Buffer.from('AUDIT_PRIVATE_')),'Student canary leaked into '+name);
 const installedManifest=JSON.parse(bodies.get('manifest.json'));
 assert.equal(installedManifest.externally_connectable,undefined);assert.ok(![...installedManifest.permissions,...(installedManifest.optional_permissions||[])].includes('nativeMessaging'));
 const executable=new Set([installedManifest.background.service_worker,...installedManifest.content_scripts.flatMap(script=>script.js||[])]);
 for(const html of ['ai-panel.html','ai-offscreen.html','ai-permission.html',installedManifest.action.default_popup])for(const match of bodies.get(html).toString().matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi))executable.add(match[1]);
 for(const name of executable){const code=bodies.get(name)?.toString();assert.ok(code,'Missing executable '+name);for(const call of code.matchAll(/\bimportScripts\(([^)]*)\)/g))for(const file of call[1].matchAll(/['"]([^'"]+\.js)['"]/g))executable.add(file[1]);
  assert.doesNotMatch(code,/\bconnectNative\s*\(|chrome\.identity\b|\/companion\//,name+' unexpectedly activates legacy authentication');}
});
