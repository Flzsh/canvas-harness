// Adapted from Gary Wu's pull request #47 to Canvas Harness.
'use strict';
// Canvas on a school's own address (canvas.school.edu): added by the student, allowed by the browser one site
// at a time, and given the same scripts as *.instructure.com.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ext=path.join(__dirname,'../extension'),read=f=>fs.readFileSync(path.join(ext,f),'utf8');
const manifest=JSON.parse(read('manifest.json'));
// Values made inside the vm have other prototypes, so compare them as JSON.
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const tick=async(n=20)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
function event(){const listeners=[];return {listeners,addListener:f=>listeners.push(f),removeListener:f=>{const i=listeners.indexOf(f);if(i>=0)listeners.splice(i,1);},emit:(...a)=>listeners.map(f=>f(...a))};}
function freshSite(){const ctx={URL,Intl,location:{origin:'https://canvas.school.edu'}};ctx.globalThis=ctx;vm.runInNewContext(read('site.js'),ctx);return {ctx,Site:ctx.ReserveSite};}

test('a school address counts only after it is trusted, and never by lookalike',()=>{
 const {Site}=freshSite();
 assert.equal(Site.supported('https://canvas.school.edu/courses/1'),false);
 Site.trustSites(['https://canvas.school.edu']);
 assert.equal(Site.supported('https://canvas.school.edu/courses/1'),true);
 for(const bad of ['http://canvas.school.edu/','https://canvas.school.edu:8443/','https://u:p@canvas.school.edu/','https://evil.canvas.school.edu/','https://canvas.school.edu.evil.example/'])
  assert.equal(Site.supported(bad),false,bad);
 Site.trustSites([]);assert.equal(Site.supported('https://canvas.school.edu/'),false);
 assert.equal(Site.supported('https://school.instructure.com/'),true);
});

test('only a plain secure web address can be added as a school site',()=>{
 const {Site}=freshSite();
 assert.equal(Site.customSite('https://canvas.school.edu/login?x=1'),'https://canvas.school.edu');
 for(const bad of ['http://canvas.school.edu','https://localhost','https://10.0.0.5','https://[::1]','https://school.instructure.com','https://instructure.com','https://canvas.school.edu:444','not a url',''])
  assert.equal(Site.customSite(bad),'',bad);
});

test('custom-site.js trusts only the page it runs on',()=>{
 const {ctx,Site}=freshSite();vm.runInNewContext(read('custom-site.js'),ctx);
 assert.equal(Site.supported('https://canvas.school.edu/'),true);assert.equal(Site.supported('https://other.school.edu/'),false);
 assert.equal(Site.origin(),'https://canvas.school.edu');
});

function background({saved=[],granted=[]}={}){
 const store={'reserve:sites':saved},perms=new Set(granted),registered=new Map(),opened=[];
 const runtime={id:'a'.repeat(32),onConnect:event(),onMessage:event(),onInstalled:event(),onStartup:event(),getURL:f=>'chrome-extension://'+'a'.repeat(32)+'/'+f,getManifest:()=>manifest};
 const chrome={runtime,
  storage:{onChanged:event(),local:{get:async k=>({[k]:store[k]}),set:async o=>{Object.assign(store,o);},remove:async k=>{delete store[k];}}},
  permissions:{contains:async q=>q.origins.every(o=>perms.has(o)),onAdded:event(),onRemoved:event()},
  scripting:{getRegisteredContentScripts:async()=>[...registered.values()],unregisterContentScripts:async({ids})=>ids.forEach(id=>registered.delete(id)),registerContentScripts:async list=>list.forEach(s=>registered.set(s.id,s))},
  tabs:{create:async t=>opened.push(t.url),get:async id=>({id,url:'https://canvas.school.edu/'})}};
 const fake={ReserveFeatures:require('../extension/features.js'),chrome,importScripts:()=>{},crypto:crypto.webcrypto,URL,Intl,setTimeout,clearTimeout,AbortSignal,TextEncoder,fetch:async()=>{throw Error('no network');}};
 fake.globalThis=fake;vm.runInNewContext(read('site.js'),fake);vm.runInNewContext(read('background.js'),fake);
 return {store,perms,registered,opened,chrome,fake};
}
function registration(h,origin='https://canvas.school.edu',sender={id:h.chrome.runtime.id,url:h.chrome.runtime.getURL('welcome.html'),frameId:0}){
 const replies=[],held=h.chrome.runtime.onMessage.emit({type:'ch-school-ready',origin},sender,r=>replies.push(r));return {replies,held};
}

test('registered custom schools receive the same ordered feature loader and document-scoped Lite modules',async()=>{
 const origin='https://canvas.school.edu',h=background({saved:[origin],granted:[origin+'/*']}),calls=[];
 h.store['reserve:features']={preset:'lite'};
 h.chrome.scripting.executeScript=async options=>{calls.push(options);return [{documentId:'custom-document'}];};
 const reply=await new Promise(resolve=>h.chrome.runtime.onMessage.emit({target:'ch-features',op:'load'},
  {id:h.chrome.runtime.id,url:origin+'/dashboard',tab:{id:31},frameId:0,documentId:'custom-document'},resolve));
 assert.equal(reply.ok,true);assert.equal(reply.preset,'lite');
 const files=calls.flatMap(call=>call.files||[]),F=require('../extension/features.js');
 same(files,F.resolve('lite').js.filter(file=>!F.staticJS.includes(file)));
 assert.ok(files.includes('dashboard.js'));assert.ok(!files.includes('pets.js'));assert.ok(!files.includes('pdf-host.js'));
 for(const call of calls.filter(call=>call.files||call.args))same(call.target,{tabId:31,documentIds:['custom-document']});
});
function gate(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

test('school registration acknowledgement waits for its serialized registration, without opening a tab',async()=>{
 const h=background({saved:['https://canvas.school.edu'],granted:['https://canvas.school.edu/*']}),first=gate(),second=gate();let calls=0;
 const register=h.chrome.scripting.registerContentScripts;
 h.chrome.scripting.registerContentScripts=async list=>{const n=++calls;await (n===1?first:second).promise;return register(list);};
 h.chrome.storage.onChanged.emit({'reserve:sites':{}},'local');await tick();assert.equal(calls,1);
 const request=registration(h);assert.ok(request.held.includes(true),'the reply channel stays open');await tick();
 assert.equal(calls,1,'a message cannot overlap the storage-triggered registration');same(request.replies,[]);same(h.opened,[]);
 first.resolve();await tick();assert.equal(calls,2);same(request.replies,[],'the earlier registration is not this request\'s acknowledgement');
 second.resolve();await tick();same(request.replies,[{ok:true,origin:'https://canvas.school.edu'}]);same(h.opened,[]);
 assert.equal(h.registered.size,manifest.content_scripts.length);
});

test('registration failures are returned to the caller and do not poison the next request',async()=>{
 const h=background({saved:['https://canvas.school.edu'],granted:['https://canvas.school.edu/*']}),register=h.chrome.scripting.registerContentScripts;
 h.chrome.scripting.registerContentScripts=async()=>{throw Error('registration blocked');};
 const failed=registration(h);await tick();assert.equal(failed.replies[0]?.ok,false);assert.match(failed.replies[0]?.error||'',/registration blocked/);same(h.opened,[]);
 h.chrome.scripting.registerContentScripts=register;
 const retry=registration(h);await tick();same(retry.replies,[{ok:true,origin:'https://canvas.school.edu'}]);
});

test('a permission-added open stops when script registration fails',async()=>{
 const h=background();h.store['reserve:pendingSite']='https://canvas.school.edu';h.perms.add('https://canvas.school.edu/*');
 h.chrome.scripting.registerContentScripts=async()=>{throw Error('registration blocked');};
 await assert.rejects(h.chrome.permissions.onAdded.emit({origins:['https://canvas.school.edu/*']})[0],/registration blocked/);same(h.opened,[]);
});

test('registration acknowledgement requires a saved, permitted site and working scripting support',async()=>{
 for(const options of [{granted:['https://canvas.school.edu/*']},{saved:['https://canvas.school.edu']},{saved:['https://canvas.school.edu'],granted:['https://canvas.school.edu/*'],unavailable:true}]){
  const h=background(options);if(options.unavailable)delete h.chrome.scripting;
  const request=registration(h);await tick();assert.equal(request.replies[0]?.ok,false,JSON.stringify(options));assert.ok(request.replies[0]?.error);same(h.opened,[]);
 }
});

test('only this extension\'s top-level welcome and popup can request registration for a validated origin',async()=>{
 const h=background({saved:['https://canvas.school.edu'],granted:['https://canvas.school.edu/*']}),id=h.chrome.runtime.id,url=h.chrome.runtime.getURL('welcome.html');let calls=0;
 const register=h.chrome.scripting.registerContentScripts;h.chrome.scripting.registerContentScripts=async list=>{calls++;return register(list);};
 for(const sender of [{id,url:'https://canvas.school.edu/',frameId:0},{id:'b'.repeat(32),url,frameId:0},{id,url:h.chrome.runtime.getURL('ai-panel.html'),frameId:0},{id,url:'chrome-extension://'+'b'.repeat(32)+'/welcome.html',frameId:0},{id,url,frameId:1},{id,url:url+'?other=1',frameId:0}]){
  const request=registration(h,'https://canvas.school.edu',sender);await tick();assert.equal(request.replies[0]?.ok,false,JSON.stringify(sender));
 }
 for(const origin of ['https://canvas.school.edu/courses/1','http://canvas.school.edu','https://school.instructure.com','https://user:pass@canvas.school.edu','not a url']){
  const request=registration(h,origin);await tick();assert.equal(request.replies[0]?.ok,false,origin);
 }
 assert.equal(calls,0,'invalid requests cannot start registration');
 const request=registration(h,'https://canvas.school.edu',{id,url:h.chrome.runtime.getURL('popup.html')});await tick();assert.equal(request.replies[0]?.ok,true);assert.equal(calls,1);
});

test('allowing a school site registers the same scripts there, marked as trusted, and opens it',async()=>{
 const h=background();
 h.store['reserve:pendingSite']='https://canvas.school.edu';h.perms.add('https://canvas.school.edu/*');
 h.chrome.permissions.onAdded.emit({origins:['https://canvas.school.edu/*'],permissions:['scripting']});await tick(60);
 same(h.store['reserve:sites'],['https://canvas.school.edu']);assert.equal(h.store['reserve:pendingSite'],undefined);
 same(h.opened,['https://canvas.school.edu/?reserve=open']);
 const scripts=[...h.registered.values()];assert.equal(scripts.length,manifest.content_scripts.length);
 manifest.content_scripts.forEach((entry,i)=>{
  const s=scripts[i];same(s.matches,['https://canvas.school.edu/*']);assert.equal(s.runAt,entry.run_at);assert.equal(s.allFrames,false);
  same(s.js.filter(f=>f!=='custom-site.js'),entry.js);assert.equal(s.js[s.js.indexOf('site.js')+1],'custom-site.js');
  same(s.css,entry.css);
 });
 assert.equal(h.fake.ReserveSite.supported('https://canvas.school.edu/'),true);
});

test('a permission granted for something else does not add a site',async()=>{
 const h=background();h.perms.add('https://chatgpt.com/*');
 h.chrome.permissions.onAdded.emit({origins:['https://chatgpt.com/*'],permissions:['scripting']});await tick(80);
 same(h.store['reserve:sites'],[]);assert.equal(h.registered.size,0);same(h.opened,[]);
});

test('taking access away in the browser removes the scripts and the trust',async()=>{
 const h=background({saved:['https://canvas.school.edu'],granted:['https://canvas.school.edu/*']});
 h.chrome.runtime.onInstalled.emit({});await tick(40);assert.equal(h.registered.size,manifest.content_scripts.length);
 h.perms.delete('https://canvas.school.edu/*');h.chrome.permissions.onRemoved.emit({origins:['https://canvas.school.edu/*']});await tick(40);
 assert.equal(h.registered.size,0);assert.equal(h.fake.ReserveSite.supported('https://canvas.school.edu/'),false);
});

test('a saved site whose access is gone is not trusted when the worker wakes',async()=>{
 const h=background({saved:['https://canvas.school.edu','https://lms.other.edu'],granted:['https://lms.other.edu/*']});await tick(20);
 assert.equal(h.fake.ReserveSite.supported('https://canvas.school.edu/'),false);assert.equal(h.fake.ReserveSite.supported('https://lms.other.edu/'),true);
});

test('the AI source on a school site connects once the saved list loads, keeping its first messages',async()=>{
 const h=background({saved:['https://canvas.school.edu'],granted:['https://canvas.school.edu/*']});
 const port={name:'ch-ai-source',sender:{id:'a'.repeat(32),frameId:0,tab:{id:4},url:'https://canvas.school.edu/'},onMessage:event(),onDisconnect:event(),postMessage(){},disconnect(){this.disconnected=true;}};
 h.chrome.runtime.onConnect.emit(port);
 port.onMessage.emit({kind:'catalog',data:{scopeKey:'https://canvas.school.edu|7|1|1',sources:[],courses:[]}});
 await tick(20);assert.notEqual(port.disconnected,true);
 const panel={name:'ch-ai-panel',sent:[],sender:{id:'a'.repeat(32),frameId:1,tab:{id:4},url:'chrome-extension://0f6c2a8e-1b2c-4d5e-8f90-123456789abc/ai-panel.html'},onMessage:event(),onDisconnect:event(),postMessage(m){this.sent.push(m);},disconnect(){this.disconnected=true;}};
 h.chrome.runtime.onConnect.emit(panel);await tick();
 assert.notEqual(panel.disconnected,true);assert.equal(panel.sent[0]?.kind,'catalog');
});

test('an unknown site cannot open an AI source',async()=>{
 const h=background();
 const port={name:'ch-ai-source',sender:{id:'a'.repeat(32),frameId:0,tab:{id:4},url:'https://not-added.school.edu/'},onMessage:event(),onDisconnect:event(),postMessage(){},disconnect(){this.disconnected=true;}};
 h.chrome.runtime.onConnect.emit(port);await tick(20);assert.equal(port.disconnected,true);
});

test('a first install opens the welcome page; an update does not',async()=>{
 const h=background();
 h.chrome.runtime.onInstalled.emit({reason:'update'});await tick(20);assert.equal(h.opened.filter(u=>u.endsWith('welcome.html')).length,0);
 h.chrome.runtime.onInstalled.emit({reason:'install'});await tick(20);same(h.opened.filter(u=>u.endsWith('welcome.html')),['chrome-extension://'+'a'.repeat(32)+'/welcome.html']);
});

function school({worker,sendMessage,timers={setTimeout,clearTimeout}}={}){
 const store=worker?.store||{},asked=[],opened=worker?.opened||[],sent=[],operations=[];let grant=true;
 const local=worker?.chrome.storage.local||{get:async k=>({[k]:store[k]}),set:o=>{Object.assign(store,o);return Promise.resolve();},remove:k=>{delete store[k];return Promise.resolve();}};
 const chrome={storage:{local:Object.fromEntries(Object.entries(local).map(([key,fn])=>[key,(...args)=>{operations.push(key);return fn(...args);}]))},
  permissions:{request:q=>{operations.push('request');asked.push(q);if(grant&&worker)q.origins.forEach(o=>worker.perms.add(o));return Promise.resolve(grant);},contains:async q=>worker?q.origins.every(o=>worker.perms.has(o)):true,remove:async()=>true},
  runtime:{sendMessage:message=>{sent.push(message);if(sendMessage)return sendMessage(message);if(worker)return new Promise(resolve=>worker.chrome.runtime.onMessage.emit(message,{id:worker.chrome.runtime.id,url:worker.chrome.runtime.getURL('welcome.html'),frameId:0},resolve));return Promise.resolve({ok:true,origin:message.origin});}},
  tabs:{create:async t=>{operations.push('tabs.create');opened.push(t.url);}}};
 const ctx={URL,Intl,chrome,...timers};ctx.globalThis=ctx;vm.runInNewContext(read('site.js'),ctx);vm.runInNewContext(read('school-address.js'),ctx);
 return {School:ctx.ReserveSchool,store,asked,opened,sent,operations,deny:()=>{grant=false;}};
}

test('the welcome page and popup open an instructure.com school at once and remember it',async()=>{
 const h=school(),r=await h.School.open('https://my-school.instructure.com/courses/4');
 assert.equal(r.ok,true);same(h.opened,['https://my-school.instructure.com/?reserve=open']);assert.equal(h.asked.length,0);
 assert.equal(r.origin,'https://my-school.instructure.com');same(h.sent,[]);
 assert.equal(h.store['reserve:school'],'https://my-school.instructure.com');assert.equal(await h.School.saved(),'https://my-school.instructure.com');
});

test('a school\'s own address asks the browser in the same click, for that one site only',async()=>{
 const h=school();let asked='';
 const pending=h.School.open('https://canvas.my-college.edu/login',{onAsk:host=>{asked=host;}});
 assert.equal(h.asked.length,1,'the permission request is made before anything is awaited');
 same(h.asked[0],{permissions:['scripting'],origins:['https://canvas.my-college.edu/*']});assert.equal(asked,'canvas.my-college.edu');
 const r=await pending;assert.equal(r.ok,true);assert.equal(h.store['reserve:pendingSite'],'https://canvas.my-college.edu');
 assert.equal(r.origin,'https://canvas.my-college.edu');
 assert.equal(h.opened.length,0,'the background opens it once the site is added');
});

test('a refused or invalid address changes nothing',async()=>{
 const h=school();h.deny();
 const r=await h.School.open('https://canvas.my-college.edu');assert.equal(r.ok,false);assert.equal(h.store['reserve:pendingSite'],undefined);
 for(const bad of ['','not a url','http://canvas.my-college.edu','https://localhost']){const x=await h.School.open(bad);assert.equal(x.ok,false,bad);}
 assert.equal(h.opened.length,0);
});

test('the tour can approve and register a custom school without opening Canvas until its final step',async()=>{
 const h=school(),pending=h.School.open('https://canvas.my-college.edu',{defer:true});
 assert.equal(h.asked.length,1,'permission precedes the first await');
 assert.equal(h.store['reserve:pendingSite'],undefined);assert.equal((await pending).ok,true);
 same(h.store['reserve:sites'],['https://canvas.my-college.edu']);same(h.opened,[]);
 assert.equal(h.store['reserve:school'],'https://canvas.my-college.edu');
 await h.School.open('https://canvas.my-college.edu');same(h.opened,['https://canvas.my-college.edu/?reserve=open']);assert.equal(h.asked.length,1);
 const b=background();await tick();b.store['reserve:sites']=['https://canvas.my-college.edu'];b.perms.add('https://canvas.my-college.edu/*');
 b.chrome.storage.onChanged.emit({'reserve:sites':{newValue:b.store['reserve:sites']}},'local');await tick(40);
 assert.equal(b.registered.size,manifest.content_scripts.length);same(b.opened,[]);
});
test('deferred tour setup validates, remembers instructure schools, and leaves no state when permission is denied',async()=>{
 const h=school();assert.equal((await h.School.open('https://school.instructure.com',{defer:true})).ok,true);same(h.opened,[]);assert.equal(await h.School.saved(),'https://school.instructure.com');
 const denied=school();denied.deny();assert.equal((await denied.School.open('https://canvas.my-college.edu',{defer:true})).ok,false);same(denied.store,{});same(denied.opened,[]);
});

test('deferred custom setup requests permission first and waits for actual registration before returning its origin',async()=>{
 const b=background(),wait=gate(),register=b.chrome.scripting.registerContentScripts;let started=false,done=false;
 b.chrome.scripting.registerContentScripts=async list=>{started=true;await wait.promise;return register(list);};
 const h=school({worker:b}),pending=h.School.open('https://canvas.my-college.edu/login?next=1',{defer:true}).then(r=>{done=true;return r;});
 same(h.operations,['request'],'permission is the first asynchronous operation, before any storage read or write');
 const added=b.chrome.permissions.onAdded.emit({origins:['https://canvas.my-college.edu/*'],permissions:['scripting']});
 await tick();assert.equal(started,true);assert.equal(done,false);same(h.opened,[]);assert.equal(h.store['reserve:pendingSite'],undefined);
 same(h.sent,[{type:'ch-school-ready',origin:'https://canvas.my-college.edu'}]);
 wait.resolve();const result=await pending;assert.equal(result.ok,true);assert.equal(result.origin,'https://canvas.my-college.edu');
 await Promise.all(added);assert.equal(b.registered.size,manifest.content_scripts.length);same(h.opened,[]);
});

test('deferred custom setup propagates worker registration failure without opening or staging a tab',async()=>{
 const b=background();b.chrome.scripting.registerContentScripts=async()=>{throw Error('registration blocked');};
 const h=school({worker:b});await assert.rejects(h.School.open('https://canvas.my-college.edu',{defer:true}),/registration blocked/);
 same(h.store['reserve:sites'],['https://canvas.my-college.edu']);assert.equal(h.store['reserve:pendingSite'],undefined);same(h.opened,[]);
});

test('the final custom school open waits for a fresh registration and stops on registration failure',async()=>{
 const wait=gate();
 const b=background({saved:['https://canvas.my-college.edu'],granted:['https://canvas.my-college.edu/*']}),register=b.chrome.scripting.registerContentScripts;
 b.chrome.scripting.registerContentScripts=async list=>{await wait.promise;return register(list);};
 const final=school({worker:b});await final.School.list();let done=false;
 const pending=final.School.open('https://canvas.my-college.edu').then(r=>{done=true;return r;});await tick();assert.equal(done,false);same(final.opened,[]);
 wait.resolve();assert.equal((await pending).origin,'https://canvas.my-college.edu');same(final.opened,['https://canvas.my-college.edu/?reserve=open']);
 b.chrome.scripting.registerContentScripts=async()=>{throw Error('registration blocked');};
 await assert.rejects(final.School.open('https://canvas.my-college.edu'),/registration blocked/);assert.equal(final.opened.length,1);
});

test('school readiness skips built-in sites, validates addresses, and rejects failed or mismatched acknowledgements',async()=>{
 const h=school();assert.equal(typeof h.School.ready,'function');await h.School.ready('https://school.instructure.com');same(h.sent,[]);
 await assert.rejects(h.School.ready('http://canvas.school.edu'),/HTTPS|address/);same(h.sent,[]);
 for(const reply of [{ok:false,error:'registration blocked'},undefined,{ok:true,origin:'https://other.school.edu'}]){
  const failed=school({sendMessage:async()=>reply});await assert.rejects(failed.School.ready('https://canvas.school.edu'),reply?.error?/registration blocked/:/registr|confirm/i);same(failed.opened,[]);
 }
 const unavailable=school({sendMessage:async()=>{throw Error('worker unavailable');}});await assert.rejects(unavailable.School.ready('https://canvas.school.edu'),/worker unavailable/);
});

test('a missing registration acknowledgement times out and clears its timer without opening Canvas',async()=>{
 const timers=new Map(),cleared=[];let id=0;
 const h=school({sendMessage:()=>new Promise(()=>{}),timers:{setTimeout:(fn,ms)=>{assert.ok(ms>0&&ms<=30000,'registration has a bounded wait');timers.set(++id,fn);return id;},clearTimeout:key=>{cleared.push(key);timers.delete(key);}}});
 const pending=h.School.open('https://canvas.my-college.edu',{defer:true});const failed=assert.rejects(pending,/registr.*(?:long|tim|respond)|(?:long|tim|respond).*registr/i);
 await tick();assert.equal(timers.size,1);same(h.opened,[]);[...timers.values()][0]();await failed;assert.equal(timers.size,0);same(cleared,[1]);same(h.opened,[]);
});

test('successful and failed acknowledgements clear their timeout',async()=>{
 for(const reply of [{ok:true,origin:'https://canvas.school.edu'},{ok:false,error:'registration blocked'}]){
  const cleared=[],h=school({sendMessage:async()=>reply,timers:{setTimeout:()=>42,clearTimeout:id=>cleared.push(id)}});
  assert.equal(typeof h.School.ready,'function');if(reply.ok)await h.School.ready('https://canvas.school.edu');else await assert.rejects(h.School.ready('https://canvas.school.edu'),/registration blocked/);
  same(cleared,[42]);
 }
});

test('built-in direct open waits for beforeOpen before creating the tab',async()=>{
 const h=school(),finish=gate();let calls=0;
 const pending=h.School.open('https://my-school.instructure.com/courses/4',{beforeOpen:async()=>{calls++;h.operations.push('beforeOpen');await finish.promise;}});
 await tick();assert.equal(calls,1);same(h.opened,[]);same(h.operations,['set','beforeOpen']);
 finish.resolve();assert.equal((await pending).ok,true);
 same(h.operations,['set','beforeOpen','tabs.create']);same(h.opened,['https://my-school.instructure.com/?reserve=open']);
});

test('trusted custom open registers scripts before beforeOpen and tabs.create',async()=>{
 const origin='https://canvas.my-college.edu',b=background({saved:[origin],granted:[origin+'/*']}),readyGate=gate(),openGate=gate();
 const register=b.chrome.scripting.registerContentScripts;let registered=false,calls=0;
 b.chrome.scripting.registerContentScripts=async scripts=>{await readyGate.promise;await register(scripts);registered=true;};
 const h=school({worker:b});await h.School.list();
 const pending=h.School.open(origin,{beforeOpen:async()=>{calls++;assert.equal(registered,true);h.operations.push('beforeOpen');await openGate.promise;}});
 await tick();assert.equal(calls,0);same(h.opened,[]);same(h.sent,[{type:'ch-school-ready',origin}]);
 readyGate.resolve();await tick();assert.equal(calls,1);same(h.opened,[]);
 openGate.resolve();assert.equal((await pending).ok,true);
 assert.ok(h.operations.indexOf('beforeOpen')>h.operations.indexOf('set'));
 same(h.operations.slice(-2),['beforeOpen','tabs.create']);same(h.opened,[origin+'/?reserve=open']);
});

test('native direct opens on built-in and untrusted custom origins wait for beforeOpen',async()=>{
 for(const [value,url,prior] of [
  ['https://school.instructure.com/course','https://school.instructure.com/?reserve=native',['set']],
  ['https://canvas.my-college.edu/login','https://canvas.my-college.edu/',[]]
 ]){
  const h=school(),finish=gate();let calls=0;
  const pending=h.School.open(value,{native:true,beforeOpen:()=>{calls++;h.operations.push('beforeOpen');return finish.promise;}});
  await tick();assert.equal(calls,1);same(h.opened,[]);same(h.operations,[...prior,'beforeOpen']);same(h.asked,[]);same(h.sent,[]);
  finish.resolve();assert.equal((await pending).ok,true);same(h.opened,[url]);same(h.operations,[...prior,'beforeOpen','tabs.create']);
 }
});

test('beforeOpen has an 1800 ms cap and cleans its timer when the callback never settles',async()=>{
 const timers=new Map(),cleared=[];let id=0;
 const h=school({timers:{setTimeout:(fn,ms)=>{assert.equal(ms,1800);timers.set(++id,fn);return id;},clearTimeout:key=>{cleared.push(key);timers.delete(key);}}});
 const pending=h.School.open('https://school.instructure.com',{beforeOpen:()=>new Promise(()=>{})});
 await tick();assert.equal(timers.size,1);same(h.opened,[]);
 [...timers.values()][0]();assert.equal((await pending).ok,true);
 same(cleared,[1]);assert.equal(timers.size,0);same(h.opened,['https://school.instructure.com/?reserve=open']);
});

test('beforeOpen resolves or rejects with timer cleanup, and errors prevent the tab',async()=>{
 for(const [callback,error] of [
  [async()=>{},''],
  [async()=>{throw Error('transition rejected');},'transition rejected'],
  [()=>{throw Error('transition threw');},'transition threw']
 ]){
  const cleared=[],timerIds=[];
  const h=school({timers:{setTimeout:(fn,ms)=>{assert.equal(ms,1800);timerIds.push(timerIds.length+1);return timerIds.length;},clearTimeout:id=>cleared.push(id)}});
  const pending=h.School.open('https://school.instructure.com',{beforeOpen:callback});
  if(error)await assert.rejects(pending,new RegExp(error));else assert.equal((await pending).ok,true);
  same(timerIds,[1]);same(cleared,[1]);same(h.opened,error?[]:['https://school.instructure.com/?reserve=open']);
 }
});

test('beforeOpen never runs for defer or background-owned permission opens',async()=>{
 let calls=0;const beforeOpen=()=>{calls++;throw Error('should not run');},h=school();
 assert.equal((await h.School.open('https://school.instructure.com',{defer:true,beforeOpen})).ok,true);
 assert.equal((await h.School.open('https://canvas.my-college.edu',{defer:true,beforeOpen})).ok,true);
 same(h.opened,[]);assert.equal(calls,0);
 const untrusted=school(),pending=untrusted.School.open('https://canvas.other.edu',{beforeOpen});
 assert.equal(untrusted.asked.length,1,'permission request is still the first awaited action');
 assert.equal((await pending).ok,true);same(untrusted.operations,['set','request']);same(untrusted.opened,[]);assert.equal(calls,0);
 const denied=school();denied.deny();assert.equal((await denied.School.open('https://canvas.other.edu',{beforeOpen})).ok,false);
 assert.equal(calls,0);same(denied.opened,[]);
});


test('explicit course file backups load only on a granted custom Canvas site',async()=>{
 const origin='https://canvas.school.edu',h=background({saved:[origin],granted:[origin+'/*']}),calls=[];
 h.chrome.scripting.executeScript=async options=>{calls.push(options);return [];};
 const who={id:h.chrome.runtime.id,url:origin+'/dashboard',tab:{id:31},frameId:0,documentId:'custom-files'};
 const request=sender=>new Promise(resolve=>h.chrome.runtime.onMessage.emit({target:'ch-course-files',op:'load'},sender,resolve));
 assert.equal((await request(who)).ok,true);same(calls[0].files,['course-files.js']);same(calls[0].target,{tabId:31,documentIds:['custom-files']});
 assert.equal((await request({...who,url:'https://not-granted.school.edu/dashboard'})).ok,false);assert.equal(calls.length,1);
});
