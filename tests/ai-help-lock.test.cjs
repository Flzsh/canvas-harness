'use strict';
// AI help (3.11): the 4.x AI is packaged but locked, off and out of sight, until the student adds the AI help add-on
// from the Market and agrees to its notice (ai-notice.html). These cases hold every part of that lock.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const F=require('../extension/features.js'),Unlocked=require('./ai-unlocked.cjs'),{fixture}=require('./dashboard-heading-fixture.cjs');
const ext=path.join(__dirname,'../extension'),source=file=>fs.readFileSync(path.join(ext,file),'utf8');
const load=(env,...files)=>{for(const file of files)vm.runInContext(source(file),env,{filename:file});return env;};
const environment=(extra={})=>vm.createContext({URL,URLSearchParams,console,structuredClone,...extra});
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=async(n=8)=>{for(let i=0;i<n;i++)await Promise.resolve();};
const tick=async(n=20)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
function event(){const listeners=[];return {listeners,addListener:f=>listeners.push(f),removeListener:f=>{const i=listeners.indexOf(f);if(i>=0)listeners.splice(i,1);},emit:(...a)=>listeners.map(f=>f(...a))};}
// What a student must never see while AI help is locked: its names and its controls.
const AI_TEXT=/\b(?:AI|Ask AI|Your AI|AI help|AI workspace|Use in AI|Help with this|study aids?)\b/;
const AI_FILES=/^(?:agent-(?!clock\.|home\.)|study-(?!kind\.)|ai-(?:api|canvas|context|delivery|engine|prepare|results|run|runner|source)|overnight|prepare-brief|google-docs|math-render)/;
const LOCKED=[undefined,'full','lite',{preset:'full'},{preset:'custom',custom:[...F.presets.full]},{preset:'custom',custom:['ai','tools','dashboard']},
 // a 3.10 student's saved choice with the old handoff on stays locked too (owner: lock all AI)
 {preset:'custom',custom:['dashboard','planner','tools','ai','pony']}];

test('saved choices that name AI help stay locked: no selection, file or list has it until the notice record is there',()=>{
 for(const prefs of LOCKED){
  const r=F.resolve(prefs);
  assert.equal(r.enabled.includes('ai'),false,JSON.stringify(prefs));assert.equal(r.aiUnlocked,false);
  assert.deepEqual(r.js.filter(file=>AI_FILES.test(file)),[],JSON.stringify(prefs));
  assert.ok(!r.css.includes('agent.css')&&!r.css.includes('study-band.css'));
  assert.ok(!F.listed(prefs).some(f=>f.id==='ai'),'the Features list leaves AI help out');
 }
 assert.ok(!F.listed().some(f=>f.id==='ai'),'a page without the record lists no AI help');
 const open=F.resolve(Unlocked.prefs());
 assert.equal(open.enabled.includes('ai'),true);assert.equal(open.aiUnlocked,true);
 for(const file of ['study-ui.js','study-band.js','agent-client.js','ai-source.js','ai-context.js'])assert.ok(open.js.includes(file),file);
 assert.ok(F.listed(Unlocked.prefs()).some(f=>f.id==='ai'&&f.name==='AI help'));
 // agreed from Lite: Custom with AI help added; from Custom: added to the student's own list
 assert.deepEqual(F.resolve(Unlocked.prefs('lite')).enabled.filter(id=>!F.presets.lite.includes(id)),['ai']);
 assert.equal(Unlocked.prefs({preset:'custom',custom:['math']}).custom.join(),'math,ai');
});

test('only the notice record, exactly, unlocks: forged, malformed or extra-field records are dropped',()=>{
 const good={version:1,acceptedAt:'2026-11-09T12:00:00.000Z',notice:1};
 for(const bad of [true,{},{...good,version:2},{...good,notice:2},{...good,acceptedAt:'yesterday'},{...good,acceptedAt:'2026-11-09'},{version:'1',acceptedAt:good.acceptedAt,notice:1},[good]]){
  const prefs={preset:'full',aiUnlock:bad};
  assert.equal(Object.hasOwn(F.normalize(prefs),'aiUnlock'),false,JSON.stringify(bad));
  assert.equal(F.resolve(prefs).enabled.includes('ai'),false,JSON.stringify(bad));
 }
 assert.deepEqual(plain(F.normalize({preset:'full',aiUnlock:{...good,owner:'x'}}).aiUnlock),good,'only the three fields are kept');
});

// the worker's write queue (features.js mutate), as popup, Make it yours and Biscuit reach it
function featureWorker(saved){
 const data=saved===undefined?{}:{[F.KEY]:structuredClone(saved)},env=environment({chrome:{storage:{local:{async get(k){return structuredClone({[k]:data[k]});},async set(v){Object.assign(data,structuredClone(v));}}}}});
 env.globalThis=env;load(env,'features.js');return {data,F:env.ReserveFeatures,get value(){return plain(data[F.KEY]);}};
}
test('ordinary feature writes keep the record they find and never make one; AI help left off locks it again',async()=>{
 const locked=featureWorker({preset:'full'});
 await locked.F.write({preset:'custom',custom:['ai','tools'],aiUnlock:Unlocked.record});
 assert.equal(Object.hasOwn(locked.value,'aiUnlock'),false,'a write cannot carry its own record');assert.equal(F.resolve(locked.value).enabled.includes('ai'),false);
 await assert.rejects(locked.F.change({id:'ai',on:true}),/Invalid feature choice/);
 const open=featureWorker(Unlocked.prefs());
 await open.F.change({id:'gpa',on:false});
 assert.deepEqual(open.value.aiUnlock,plain(Unlocked.record),'another switch keeps AI help');assert.equal(F.resolve(open.value).enabled.includes('ai'),true);
 await open.F.write({preset:'full'});assert.ok(open.value.aiUnlock,'Full keeps it on');
 await open.F.change({id:'ai',on:false});
 assert.equal(Object.hasOwn(open.value,'aiUnlock'),false,'switching AI help off removes the record');assert.equal(open.value.custom.includes('ai'),false);
 const lite=featureWorker(Unlocked.prefs());await lite.F.write({preset:'lite'});
 assert.equal(Object.hasOwn(lite.value,'aiUnlock'),false,'a preset without AI help locks it again');
 const tools=featureWorker(Unlocked.prefs());await tools.F.change({id:'tools',on:false});
 assert.equal(Object.hasOwn(tools.value,'aiUnlock'),false,'turning off what AI help needs locks it again');
});

test('Make it yours Features list shows AI help only once agreed, and its own switch off locks it again',async t=>{
 const env=environment(),data={[F.KEY]:{preset:'full'}},changed=event();
 env.chrome={storage:{local:{async get(k){return structuredClone({[k]:data[k]});},async set(v){Object.assign(data,structuredClone(v));}},onChanged:changed}};
 env.globalThis=env;load(env,'features.js','settings-dock.js');
 let state=null;env.ReserveAddonsPanel={mount(box,o){state=o;return {update(next){state={...state,...next};}};}};
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(){},removeEventListener(){}});return nodes.get(id);};
 const container={querySelector:s=>node(s.slice(1)),ownerDocument:{createElement:()=>({dataset:{},click(){},remove(){}})},append(){}};
 const features=env.ReserveSettingsDock.createFeatures(container,{store:null});
 await tick();
 assert.ok(state,'the list mounted');assert.ok(!state.catalog.some(row=>row.id==='ai'),'locked: no AI help row');assert.ok(!state.catalog.some(row=>AI_TEXT.test(row.name)));
 data[F.KEY]=Unlocked.prefs();changed.emit({[F.KEY]:{newValue:Unlocked.prefs()}},'local');await tick();
 assert.ok(state.catalog.some(row=>row.id==='ai'&&row.name==='AI help'),'agreed: AI help is a normal switch');
 features.destroy();
});

test('toggleFeatures and saveFeatures (Make it yours, Biscuit) cannot switch locked AI help on and lock it when off',async()=>{
 const env=environment(),data={[F.KEY]:{preset:'full'}};
 env.chrome={storage:{local:{async get(k){return structuredClone({[k]:data[k]});},async set(v){Object.assign(data,structuredClone(v));}}}};
 env.globalThis=env;load(env,'features.js','settings-dock.js');const D=env.ReserveSettingsDock;
 assert.throws(()=>D.toggleFeatures(env.ReserveFeatures.normalize({preset:'full'}),'ai',true),/Unknown feature/);
 const written=await D.saveFeatures({preset:'custom',custom:['ai','tools','dashboard'],aiUnlock:Unlocked.record});
 assert.equal(Object.hasOwn(plain(written),'aiUnlock'),false);assert.equal(F.resolve(data[F.KEY]).enabled.includes('ai'),false);
 data[F.KEY]=Unlocked.prefs();
 const next=D.toggleFeatures(env.ReserveFeatures.normalize(data[F.KEY]),'ai',false);
 assert.equal(Object.hasOwn(plain(next),'aiUnlock'),false);await D.saveFeatures(next);assert.equal(Object.hasOwn(data[F.KEY],'aiUnlock'),false);
});

// ---- the Market add-on (packs.js in the worker) ----
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const aiPayload=(id='ai-help')=>{const bytes=Buffer.from(JSON.stringify({feature:'ai'}));return [{id,name:'AI help',kind:'feature',file:'packs/'+id+'.json',size:bytes.length,sha256:hash(bytes)},bytes.toString('base64')];};
function packWorker(saved={}){
 const data=structuredClone(saved),opened=[];
 const chrome={storage:{local:{async get(keys){return structuredClone(keys===null?data:Object.fromEntries([].concat(keys).filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]])));},async set(values){Object.assign(data,structuredClone(values));},async remove(keys){for(const k of [].concat(keys))delete data[k];}}}};
 const env=vm.createContext({chrome,Blob,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,structuredClone,crypto:webcrypto,atob,btoa,setTimeout,clearTimeout,AbortSignal,importScripts(){},
  fetch:async url=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>String(url).includes('/profile')?{id:'7'}:[]})});
 require('./market-fixture.cjs').loadMarketSite(env);
 for(const file of ['features.js','core.js','custom-art.js','media-reference.js','media-store.js','workspace-arrange.js','customization-model.js','custom-kits.js','quick-pack.js','gpa-model.js','personal-work.js','page-preferences.js','storage.js','packs.js'])
  vm.runInContext(source(file),env,{filename:file});
 env.ReserveOpenAINotice=()=>{opened.push('ai-notice.html');};
 return {data,opened,api:env.ReservePacks,get prefs(){return data[F.KEY];}};
}
test('adding the AI help add-on turns nothing on: it is installed, AI help stays locked and its notice opens',async()=>{
 for(const saved of [undefined,{preset:'full'},{preset:'lite'},{preset:'custom',custom:['math','ai','tools']}]){
  const h=packWorker(saved===undefined?{}:{[F.KEY]:saved});
  await h.api.install(...aiPayload());
  assert.deepEqual(h.opened,['ai-notice.html'],'the notice opens');
  assert.equal(F.resolve(h.prefs).enabled.includes('ai'),false,'still locked');
  if(saved===undefined)assert.equal(h.prefs,undefined,'nothing saved');else assert.deepEqual(plain(h.prefs),plain(saved),'the saved choice is untouched');
  assert.equal(h.data['reserve:packs:receipts']['ai-help'].feature,'ai');
  const rows=plain(await h.api.installed());assert.equal(rows.find(r=>r.id==='ai-help')?.feature,'ai');
 }
});
test('removing the add-on after Agree deletes the record, switches AI help off and leaves the other choices',async()=>{
 const h=packWorker({[F.KEY]:{preset:'custom',custom:['math','gpa','tools']}});
 await h.api.install(...aiPayload());
 h.data[F.KEY]=F.unlockAI(h.data[F.KEY],Unlocked.record.acceptedAt);
 assert.equal(F.resolve(h.prefs).enabled.includes('ai'),true);
 await h.api.remove('ai-help');
 assert.equal(Object.hasOwn(h.prefs,'aiUnlock'),false);assert.equal(F.resolve(h.prefs).enabled.includes('ai'),false);
 assert.deepEqual(plain(h.prefs.custom),['math','gpa','tools']);
 assert.equal(Object.hasOwn(h.data['reserve:packs:receipts'],'ai-help'),false);
});
test('another feature add-on keeps an agreed AI help on through its install and removal',async()=>{
 const h=packWorker({[F.KEY]:Unlocked.prefs({preset:'custom',custom:['math','tools']})});
 const bytes=Buffer.from(JSON.stringify({feature:'pony'}));
 await h.api.install({id:'pony-pack',name:'Pony',kind:'feature',file:'packs/pony.json',size:bytes.length,sha256:hash(bytes)},bytes.toString('base64'));
 assert.ok(h.prefs.aiUnlock&&F.resolve(h.prefs).enabled.includes('pony')&&F.resolve(h.prefs).enabled.includes('ai'));
 await h.api.remove('pony-pack');assert.ok(h.prefs.aiUnlock&&F.resolve(h.prefs).enabled.includes('ai'));
});

// ---- the notice page ----
test('the notice page says exactly the approved words, loads only its own files and starts with Turn on disabled',()=>{
 const html=source('ai-notice.html'),text=html.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 for(const words of [
  'Before you turn on AI help',
  'AI help reads the Canvas coursework you choose (assignments, instructions, course files and announcements) and sends it to the AI chat site you pick, so it can help you understand and plan your work.',
  'By turning it on, you agree that:',
  "You will use AI help to learn, not to hand in work that isn't your own, and you will follow your school's and your teachers' rules about AI.",
  'You are responsible for how you use it. Canvas Harness and the people who make it are not responsible for any academic-honesty issue that comes from your use of AI help.',
  "What you send goes to the AI site you choose, under that site's own terms and privacy policy.",
  'I understand and agree','Turn on AI help','Not now'])assert.ok(text.includes(words),words);
 assert.equal(text.replace(/^AI help · Canvas Harness /,''),['Before you turn on AI help',
  'AI help reads the Canvas coursework you choose (assignments, instructions, course files and announcements) and sends it to the AI chat site you pick, so it can help you understand and plan your work.',
  'By turning it on, you agree that:',
  "You will use AI help to learn, not to hand in work that isn't your own, and you will follow your school's and your teachers' rules about AI.",
  'You are responsible for how you use it. Canvas Harness and the people who make it are not responsible for any academic-honesty issue that comes from your use of AI help.',
  "What you send goes to the AI site you choose, under that site's own terms and privacy policy.",
  'I understand and agree Turn on AI help Not now'].join(' '),'no other words on the page');
 assert.match(html,/<ol>[\s\S]*<\/ol>/);assert.equal((html.match(/<li>/g)||[]).length,3);
 assert.match(html,/<button id="turn-on" class="primary" type="button" disabled>Turn on AI help<\/button>/);
 assert.deepEqual([...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(m=>m[1]),['ai-notice.js']);assert.doesNotMatch(html,/<script>(?!<)/);
 assert.deepEqual([...html.matchAll(/<link\b[^>]*href="([^"]+)"/g)].map(m=>m[1]),['ai-notice.css']);
 const css=source('ai-notice.css');assert.doesNotMatch(css,/gradient|blur\(|backdrop-filter|box-shadow:\s*0\s+\d+px\s+\d+px/);assert.match(css,/Literata/);assert.match(css,/data-theme=dark/);assert.match(css,/#A9522F/i);
 const manifest=JSON.parse(source('manifest.json'));assert.ok(!JSON.stringify(manifest.web_accessible_resources).includes('ai-notice'),'not reachable from web pages');
 assert.equal(manifest.content_security_policy.extension_pages.includes("script-src 'self'"),true);
});
function noticePage({state={ok:true,installed:true,on:false},agree={ok:true,on:true}}={}){
 const nodes={},sent=[];let closed=0;
 const el=id=>nodes[id]||(nodes[id]={id,hidden:id==='status',disabled:id==='turn-on',checked:false,textContent:{'turn-on':'Turn on AI help','not-now':'Not now'}[id]||'',events:{},addEventListener(k,f){this.events[k]=f;}});
 const env=environment({document:{getElementById:el,documentElement:{dataset:{}}},window:{close(){closed++;}},
  chrome:{runtime:{sendMessage:async m=>{sent.push(plain(m));return m.op==='state'?state:agree;}},storage:{local:{get:async()=>({'reserve:appearance':{theme:'dark'}})}}}});
 env.globalThis=env;load(env,'ai-notice.js');
 return {el,sent,env,get closed(){return closed;}};
}
test('Turn on AI help is enabled only after the box is ticked, and Agree asks the worker once',async()=>{
 const p=noticePage();await tick();
 assert.equal(p.el('turn-on').disabled,true,'disabled before the box');
 p.el('agree').checked=true;p.el('agree').events.change();assert.equal(p.el('turn-on').disabled,false);
 p.el('agree').checked=false;p.el('agree').events.change();assert.equal(p.el('turn-on').disabled,true);
 await p.el('turn-on').events.click();assert.deepEqual(p.sent.map(m=>m.op),['state'],'no unlock without the box');
 p.el('agree').checked=true;p.el('agree').events.change();await p.el('turn-on').events.click();await tick();
 assert.deepEqual(p.sent,[{type:'ch-ai-notice',op:'state'},{type:'ch-ai-notice',op:'agree'}]);
 assert.equal(p.el('turn-on').hidden,true);assert.equal(p.el('status').hidden,false);assert.match(p.el('status').textContent,/AI help is on/);
 assert.equal(p.env.document.documentElement.dataset.theme,'dark','the student’s own dark theme');
});
test('Not now closes the notice and asks for nothing; without the add-on the box stays shut',async()=>{
 const p=noticePage();await tick();p.el('not-now').events.click();
 assert.equal(p.closed,1);assert.deepEqual(p.sent.map(m=>m.op),['state']);
 const none=noticePage({state:{ok:true,installed:false,on:false}});await tick();
 assert.equal(none.el('agree').disabled,true);assert.equal(none.el('turn-on').disabled,true);assert.match(none.el('status').textContent,/Market/);
});

// ---- the worker: the notice route, the live check on AI routes, and the lock following removal ----
function worker(saved={}){
 const store=structuredClone(saved),opened=[],changed=event();
 const runtime={id:'a'.repeat(32),onConnect:event(),onMessage:event(),onInstalled:event(),onStartup:event(),getURL:f=>'chrome-extension://'+'a'.repeat(32)+'/'+f,getManifest:()=>({})};
 const chrome={runtime,
  storage:{onChanged:changed,local:{get:async k=>(k===null?structuredClone(store):Object.hasOwn(store,k)?{[k]:structuredClone(store[k])}:{}),set:async o=>{Object.assign(store,structuredClone(o));changed.emit(Object.fromEntries(Object.keys(o).map(k=>[k,{newValue:o[k]}])),'local');},remove:async k=>{delete store[k];}},
   session:{get:async()=>({}),set:async()=>{}}},
  permissions:{contains:async()=>true,onAdded:event(),onRemoved:event()},
  scripting:{getRegisteredContentScripts:async()=>[],unregisterContentScripts:async()=>{},registerContentScripts:async()=>{},executeScript:async()=>[{documentId:'d'}]},
  tabs:{create:async t=>{opened.push(t.url);return {id:9};},get:async id=>({id,url:'https://school.instructure.com/'}),update:async()=>{},onRemoved:event()}};
 const fake={chrome,importScripts:()=>{},crypto:webcrypto,URL,Intl,setTimeout,clearTimeout,AbortSignal,TextEncoder,structuredClone,fetch:async()=>{throw Error('no network');}};
 fake.globalThis=fake;vm.runInNewContext(source('features.js'),fake);vm.runInNewContext(source('site.js'),fake);vm.runInNewContext(source('background.js'),fake);
 const ask=(message,sender)=>new Promise(resolve=>{const held=runtime.onMessage.emit(message,sender,resolve);if(!held.includes(true))resolve(undefined);});
 return {store,opened,chrome,runtime,ask,fake};
}
const NOTICE=s=>({id:'a'.repeat(32),url:'chrome-extension://'+'a'.repeat(32)+'/ai-notice.html',tab:{id:5}});
const CANVAS={id:'a'.repeat(32),url:'https://school.instructure.com/',frameId:0,tab:{id:4,index:2}};
test('Agree unlocks only from the notice page and only with the add-on installed',async()=>{
 const none=worker({[F.KEY]:{preset:'full'}});
 assert.match((await none.ask({type:'ch-ai-notice',op:'agree'},NOTICE())).error,/Market/);assert.equal(F.resolve(none.store[F.KEY]).enabled.includes('ai'),false);
 const h=worker({[F.KEY]:{preset:'full'},...Unlocked.packs()});await tick();
 for(const sender of [CANVAS,{...NOTICE(),url:NOTICE().url+'?x=1'},{id:'b'.repeat(32),url:NOTICE().url},{id:'a'.repeat(32),url:'chrome-extension://'+'a'.repeat(32)+'/popup.html'}])
  assert.equal((await h.ask({type:'ch-ai-notice',op:'agree'},sender)).ok,false,sender.url);
 assert.equal(F.resolve(h.store[F.KEY]).enabled.includes('ai'),false);
 assert.deepEqual(plain(await h.ask({type:'ch-ai-notice',op:'state'},NOTICE())),{ok:true,installed:true,on:false});
 const reply=await h.ask({type:'ch-ai-notice',op:'agree'},NOTICE());
 assert.equal(reply.ok,true);assert.equal(reply.on,true);
 const saved=h.store[F.KEY];assert.equal(saved.aiUnlock.version,1);assert.equal(saved.aiUnlock.notice,1);assert.ok(Number.isFinite(Date.parse(saved.aiUnlock.acceptedAt)));
 assert.equal(F.resolve(saved).enabled.includes('ai'),true);
 assert.equal((await h.ask({type:'ch-ai-notice',op:'agree',extra:1},NOTICE())).ok,false,'only the expected fields');
});
test('Use on the installed add-on opens the notice again; it needs the add-on',async()=>{
 const h=worker({[F.KEY]:{preset:'full'},...Unlocked.packs()});await tick();
 assert.equal((await h.ask({type:'ch-ai-notice',op:'open'},CANVAS)).ok,true);assert.deepEqual(h.opened,['chrome-extension://'+'a'.repeat(32)+'/ai-notice.html']);
 const none=worker({[F.KEY]:{preset:'full'}});assert.equal((await none.ask({type:'ch-ai-notice',op:'open'},CANVAS)).ok,false);assert.deepEqual(none.opened,[]);
 assert.equal((await h.ask({type:'ch-ai-notice',op:'open'},{id:'a'.repeat(32),url:'https://evil.example/',frameId:0,tab:{id:3}})).ok,false);
});
test('a record without the add-on is locked again by the worker, and AI ports close when it locks',async()=>{
 const h=worker({[F.KEY]:Unlocked.prefs()});await tick();
 assert.equal(Object.hasOwn(h.store[F.KEY],'aiUnlock'),false,'no add-on, no AI help');
 const g=worker({[F.KEY]:Unlocked.prefs(),...Unlocked.packs()});await tick();
 assert.ok(g.store[F.KEY].aiUnlock);
 const port={name:'ch-ai-source',sender:CANVAS,onMessage:event(),onDisconnect:event(),postMessage(){},disconnect(){this.disconnected=true;}};
 g.runtime.onConnect.emit(port);await tick();assert.notEqual(port.disconnected,true,'agreed: the AI source connects');
 await g.chrome.storage.local.set({'reserve:packs:receipts':{}});await tick();
 assert.equal(Object.hasOwn(g.store[F.KEY],'aiUnlock'),false,'removing the receipt locks it');assert.equal(port.disconnected,true,'the open AI port closes');
 const late={...port,disconnected:false};g.runtime.onConnect.emit(late);await tick();assert.equal(late.disconnected,true,'locked: no new AI port');
});
test('AI routes refuse while locked even for a page whose snapshot still says AI help',async()=>{
 const h=worker({[F.KEY]:Unlocked.prefs(),...Unlocked.packs()});await tick();
 // the page loaded while AI help was on; then the student switched it off in another tab
 h.store[F.KEY]=F.lockAI(h.store[F.KEY]);
 const reply=await h.ask({target:'ch-agent',op:'connections',scopeKey:'https://school.instructure.com|7'},CANVAS);
 assert.equal(reply.ok,false);assert.match(reply.error,/add-on is off/);
 const pdf=await h.ask({type:'ch-ai-pdf',base64:''},CANVAS);assert.equal(pdf.ok,false);
});

// ---- the engine (ai-prepare.js): no run starts or goes on, the alarm goes ----
function engineWorker(prefs){
 const store={[F.KEY]:prefs},calls=[],alarms=[],changed=event(),onMessage=event(),onAlarm=event();
 const runs=[{id:'run-a',scope:'https://school.instructure.com|7',state:'scanning'},{id:'run-b',scope:'https://school.instructure.com|7',state:'cards-ready'}];
 const chrome={runtime:{id:'x',onMessage,getURL:f=>'chrome-extension://x/'+f},alarms:{onAlarm,clear:async name=>{alarms.push('clear:'+name);},create:async name=>{alarms.push('create:'+name);}},
  storage:{onChanged:changed,local:{get:async k=>({[k]:structuredClone(store[k])}),set:async o=>{Object.assign(store,o);}}},tabs:{get:async()=>null}};
 const env=environment({chrome,indexedDB:{}});env.globalThis=env;load(env,'features.js');
 env.CanvasHarnessRunStore={create:()=>({all:async()=>runs,get:async id=>runs.find(r=>r.id===id)}),terminal:r=>['cards-ready','cancelled','failed'].includes(r.state)};
 env.CanvasHarnessAIEngine={create:()=>({recover:async o=>{calls.push('recover'+(o?.workerStart?':start':''));},cancel:async id=>{calls.push('cancel:'+id);return {};},start:async()=>{calls.push('start');return {};}}),settingsKey:()=>''};
 env.ReserveAccountWrites={run:(k,fn)=>fn()};
 load(env,'ai-prepare.js');env.CanvasHarnessPrepare.serve({api:null,pdf:null,requireFeature:async()=>{},verifyAccount:async()=>{},canvasSender:()=>true});
 const ask=(message,sender)=>new Promise(resolve=>{onMessage.emit(message,sender,resolve);});
 return {store,calls,alarms,changed,onAlarm,ask};
}
test('a locked worker resumes no run: leftovers are cancelled and the recovery alarm cleared, on start, alarm and lock',async()=>{
 const locked=engineWorker({preset:'full'});await tick();
 assert.deepEqual(locked.calls,['cancel:run-a']);assert.deepEqual(locked.alarms,['clear:ch-ai-recovery']);
 locked.onAlarm.emit({name:'ch-ai-recovery'});await tick();assert.ok(!locked.calls.includes('recover'),'the alarm resumes nothing');
 const reply=await locked.ask({target:'ch-ai-engine',op:'ask',scopeKey:'https://school.instructure.com|7',requestId:'abcdef1'},{id:'x',frameId:0,tab:{id:1},url:'https://school.instructure.com/'});
 assert.equal(reply.ok,false);assert.match(reply.error,/AI help is off/);assert.ok(!locked.calls.includes('start'));
 const write=await locked.ask({target:'ch-study-write',key:'reserve:study:https://school.instructure.com:7'},{id:'x',url:'chrome-extension://x/overnight.html'});
 assert.equal(write.ok,false,'the overnight folder page writes nothing while locked');
 const open=engineWorker(Unlocked.prefs());await tick();assert.deepEqual(open.calls,['recover:start']);
 open.store[F.KEY]=F.lockAI(open.store[F.KEY]);open.changed.emit({[F.KEY]:{newValue:open.store[F.KEY]}},'local');await tick();
 assert.ok(open.calls.includes('cancel:run-a'),'locking stops the running run');assert.ok(open.alarms.includes('clear:ch-ai-recovery'));
});

// ---- what the student sees while locked ----
const custom=(...ids)=>({preset:'custom',custom:ids});
function home(prefs,{reader=false}={}){
 return fixture({assignments:[{id:'501',course_id:'10',name:'Cell lab',due_at:'2026-10-18T15:00:00Z',points_possible:10,html_url:'https://school.instructure.com/courses/10/assignments/501',description:'<p>Write up the lab.</p>'}],
  initialState:reader?{selectedId:'501',readerOpen:true}:{},setup:({env,store})=>{
  load(env,'features.js');env.ReserveFeatures.apply(prefs);env.document.defaultView=env;
  load(env,'personal-work.js','workspace-arrange.js','customization-model.js','planner-model.js','planner-ui.js','widgets.js','quick-open.js','toolbox.js');
  for(const [id,name]of [['motion','ReserveMotion'],['course-art','ReserveCourseArt'],['customization','ReserveCustomizeUI']])if(!env.ReserveFeatures.enabled(id))delete env[name];
  Object.assign(store.get(),{tasks:{},customTasks:[],focus:{minutes:25,remaining:1500,endsAt:null},toolbox:{scratchpad:'Notes'},pet:{name:'Biscuit',xp:5}});
 }});
}
for(const [label,prefs]of [['Full',{preset:'full'}],['a 3.10 Custom choice with the old handoff on',custom('dashboard','planner','tools','ai','pony','customization')]])
 test('locked Home ('+label+') has no Help band, Help with this, Use in AI, AI module or AI tool',async t=>{
  const f=home(prefs,{reader:true});t.after(()=>f.dashboard.destroy());await flush();
  const html=f.container.innerHTML;
  for(const marker of ['data-help-band','help-this','notes-help','selection-ai','rd-study-tags','gallery-help','data-rd-key="ai-'])assert.ok(!html.includes(marker),marker);
  assert.doesNotMatch(f.container.textContent,AI_TEXT);
  const env=f.env;
  assert.ok(!plain(env.ReserveToolbox.sections()).some(([id])=>id==='ai'),'Tools has no AI tab');
  assert.ok(!env.ReserveQuickOpen.entries().some(x=>x.id==='tool:ai'||AI_TEXT.test(x.label)),'Quick open has no AI workspace');
  assert.equal(env.ReserveQuickOpen.search(env.ReserveQuickOpen.entries(),'AI').length,0);
  const c={s:{...f.store.get().settings,showHelp:true},personal:f.store.get(),courses:[],courseMap:new Map(),items:[],local:{}},gallery=env.ReserveWidgets.gallery(c,{E:String});
  assert.ok(!gallery.includes('gallery-help'),'Edit Home has no Help tile');assert.doesNotMatch(gallery.replace(/<[^>]+>/g,' '),AI_TEXT);
  assert.equal(env.ReserveWidgets.render('ai-today',c,{E:String,formatDate:()=>''}),'','an AI module shows nothing');
 });
test('agreed Home has the Help band host and the AI tool again',async t=>{
 const f=home(Unlocked.prefs(),{reader:true});t.after(()=>f.dashboard.destroy());await flush();
 // the same page the locked cases check: the markers are there once AI help is agreed to
 for(const marker of ['data-help-band','help-this'])assert.ok(f.container.innerHTML.includes(marker),marker);
 f.env.CanvasHarnessAISource={mount(){}};
 assert.ok(plain(f.env.ReserveToolbox.sections()).some(([id])=>id==='ai'));assert.ok(f.env.ReserveQuickOpen.entries().some(x=>x.id==='tool:ai'));
});
test('the extension popup lists AI help only once agreed',()=>{
 const popup=source('popup.js');
 assert.match(popup,/if\(feature\.id==='ai'\)row\.hidden=true;/);
 assert.match(popup,/Features\.aiUnlocked\?\.\(featurePrefs\)/);
});

// ---- Biscuit ----
const Engine=require('../extension/biscuit-engine.js');
const biscuit=(extra={})=>({now:Date.parse('2026-11-09T15:00:00Z'),timeZone:'UTC',ai:false,courses:[{id:'1',name:'Biology'}],assignments:[{id:'a1',title:'Cell lab',courseId:'1',dueAt:Date.parse('2026-11-10T15:00:00Z')}],...extra});
test('Biscuit offers, names and opens nothing of AI help while it is locked',()=>{
 for(const line of ['explain photosynthesis','ask ai about the cell lab','turn on your ai','turn on ai help','enable ai help','show help band','show help','where is ask ai','open ai workspace','use in ai','help me with the cell lab','write my essay','quiz me on cell lab','make me a flash card','check my work','open the help band','push help up','what is the ai panel']){
  const r=Engine.evaluate(line,biscuit(),{});
  assert.doesNotMatch(String(r.message),AI_TEXT,line);assert.notEqual(r.action,'ai',line);assert.ok(!r.ai,line);
  assert.ok(!(r.action==='feature'&&r.next?.fields?.id==='ai'),line);
  assert.ok(!['help','showHelp'].includes(r.next?.fields?.key),line);
 }
 assert.equal(Engine.evaluate('open cell lab',biscuit(),{}).action,'open','the rest of Biscuit is unchanged');
 const created=Engine.create();assert.notEqual(created.evaluate('explain photosynthesis',biscuit(),{}).action,'ai','every engine passes the check');
 assert.equal(Engine.evaluate('explain photosynthesis',biscuit({ai:true}),{}).action,'ai','agreed: Biscuit hands questions to AI help');
});
test('Biscuit learns the lock from Home: its snapshot says whether AI help is on',()=>{
 const widgets=source('widgets.js');assert.match(widgets,/ai:enabled\('ai'\)&&typeof askAI==='function',/);
 assert.match(widgets,/notHere=\{ok:false,message:'I could not find that here\.'\}/);
 assert.doesNotMatch(widgets,/unavailable\('Your AI'\)/);
});

test('the release audit holds the lock: a catalogue that would load or list AI help without the record fails it',()=>{
 const {lockAudit}=require('../scripts/release-audit.cjs');
 assert.deepEqual(JSON.parse(lockAudit(F)),[]);
 const leaky={...F,resolve:prefs=>{const r=F.resolve(prefs);return {...r,enabled:[...r.enabled,'ai'],js:[...r.js,'ai-source.js']};},listed:()=>F.catalogue};
 const problems=JSON.parse(lockAudit(leaky));
 assert.ok(problems.some(p=>/AI help is on without the notice record/.test(p)));assert.ok(problems.some(p=>/ai-source\.js loads/.test(p)));assert.ok(problems.some(p=>/feature list shows AI help/.test(p)));
});
