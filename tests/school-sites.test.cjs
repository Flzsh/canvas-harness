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
  storage:{local:{get:async k=>({[k]:store[k]}),set:async o=>{Object.assign(store,o);},remove:async k=>{delete store[k];}}},
  permissions:{contains:async q=>q.origins.every(o=>perms.has(o)),onAdded:event(),onRemoved:event()},
  scripting:{getRegisteredContentScripts:async()=>[...registered.values()],unregisterContentScripts:async({ids})=>ids.forEach(id=>registered.delete(id)),registerContentScripts:async list=>list.forEach(s=>registered.set(s.id,s))},
  tabs:{create:async t=>opened.push(t.url),get:async id=>({id,url:'https://canvas.school.edu/'})}};
 const fake={chrome,importScripts:()=>{},crypto:crypto.webcrypto,URL,Intl,setTimeout,clearTimeout,AbortSignal,TextEncoder,fetch:async()=>{throw Error('no network');}};
 fake.globalThis=fake;vm.runInNewContext(read('site.js'),fake);vm.runInNewContext(read('background.js'),fake);
 return {store,perms,registered,opened,chrome,fake};
}

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
 h.chrome.runtime.onConnect.emit(panel);
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

function school(){
 const store={},asked=[],opened=[];let grant=true;
 const chrome={storage:{local:{get:async k=>({[k]:store[k]}),set:o=>{Object.assign(store,o);return Promise.resolve();},remove:k=>{delete store[k];return Promise.resolve();}}},
  permissions:{request:q=>{asked.push(q);return Promise.resolve(grant);},contains:async()=>true,remove:async()=>true},tabs:{create:async t=>opened.push(t.url)}};
 const ctx={URL,Intl,chrome};ctx.globalThis=ctx;vm.runInNewContext(read('site.js'),ctx);vm.runInNewContext(read('school-address.js'),ctx);
 return {School:ctx.ReserveSchool,store,asked,opened,deny:()=>{grant=false;}};
}

test('the welcome page and popup open an instructure.com school at once and remember it',async()=>{
 const h=school(),r=await h.School.open('https://my-school.instructure.com/courses/4');
 assert.equal(r.ok,true);same(h.opened,['https://my-school.instructure.com/?reserve=open']);assert.equal(h.asked.length,0);
 assert.equal(h.store['reserve:school'],'https://my-school.instructure.com');assert.equal(await h.School.saved(),'https://my-school.instructure.com');
});

test('a school\'s own address asks the browser in the same click, for that one site only',async()=>{
 const h=school();let asked='';
 const pending=h.School.open('https://canvas.my-college.edu/login',{onAsk:host=>{asked=host;}});
 assert.equal(h.asked.length,1,'the permission request is made before anything is awaited');
 same(h.asked[0],{permissions:['scripting'],origins:['https://canvas.my-college.edu/*']});assert.equal(asked,'canvas.my-college.edu');
 const r=await pending;assert.equal(r.ok,true);assert.equal(h.store['reserve:pendingSite'],'https://canvas.my-college.edu');
 assert.equal(h.opened.length,0,'the background opens it once the site is added');
});

test('a refused or invalid address changes nothing',async()=>{
 const h=school();h.deny();
 const r=await h.School.open('https://canvas.my-college.edu');assert.equal(r.ok,false);assert.equal(h.store['reserve:pendingSite'],undefined);
 for(const bad of ['','not a url','http://canvas.my-college.edu','https://localhost']){const x=await h.School.open(bad);assert.equal(x.ok,false,bad);}
 assert.equal(h.opened.length,0);
});
