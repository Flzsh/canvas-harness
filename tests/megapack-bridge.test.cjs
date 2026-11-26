'use strict';
// The Market bridge's side of megapacks (extension/market-bridge.js): the kind "megapack" with the protocol's row
// fields, a trusted click sending megapack-get with the checked row (no pack file downloaded), {megapack:1} once after
// load, "getting" progress at most 4 a second, then "added" or "failed"; other kinds keep working as before.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const file=path.join(__dirname,'../extension/market-bridge.js'),source=fs.readFileSync(file,'utf8'),ORIGIN='https://flzsh.github.io',BASE=ORIGIN+'/canvas-harness-packs/',PAGE=BASE+'megapack.html';
const tick=()=>new Promise(setImmediate),plain=v=>JSON.parse(JSON.stringify(v));
const ROW={id:'soul-passage',name:'Soul Passage',kind:'megapack',file:'megapacks/soul-passage/1.json',size:44020,sha256:'687430e114225b6cd8df8c493ca301ff84bf2fbeb5f50a17beea04cc1d1ffabe',bytes:33695184,scene:'train',engine:1,needs:'4.2.0'};
const KIT={id:'ocean',name:'Ocean kit',kind:'kit',file:'files/ocean.chpack',size:3,sha256:'039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81'};// sha256 of [1,2,3]
class Element{constructor(parent=null,id=null){this.nodeType=1;this.parentElement=parent;this.id=id;}getAttribute(name){return name==='data-ch-pack'?this.id:null;}closest(){for(let e=this;e;e=e.parentElement)if(e.id!==null)return e;return null;}}
function harness(options={}){
 const listeners=[],posts=[],sent=[],requests=[],waits=[],root=new Element(),button=new Element(root,options.id||'soul-passage'),states=[...(options.states||[])];
 const location={href:options.href||PAGE,get origin(){return new URL(this.href).origin;}};
 const document={readyState:options.readyState,documentElement:root,contains(node){for(let e=node;e;e=e.parentElement)if(e===root)return true;return false;},addEventListener(type,fn,capture){listeners.push({surface:'document',type,fn,capture});},createElement(){throw Error('The bridge must not create its own UI');}};
 const window={location,document,addEventListener(type,fn,o){listeners.push({surface:'window',type,fn,o});},postMessage(message,origin){posts.push({message:plain(message),origin,at:waits.length});}};
 const reply=message=>{
  if(options.send)return options.send(message,states);
  if(message.type==='market-installed')return {ok:true,installed:options.installed||[],...(options.getting?{getting:options.getting}:{})};
  if(message.type==='megapack-get')return {ok:true,state:options.first||'getting'};
  if(message.type==='megapack-state')return states.length?states.shift():{ok:true,state:'here'};
  return {ok:true};
 };
 const chrome={runtime:{sendMessage(message){sent.push(plain(message));return Promise.resolve().then(()=>reply(message));},...(options.version?{getManifest:()=>({version:options.version})}:{})}};
 const fetch=async(url,init)=>{url=String(url);requests.push(url);const body=url.endsWith('/packs.json')?JSON.stringify(options.catalog||[ROW]):new Uint8Array([1,2,3]);const r=new Response(body);Object.defineProperty(r,'url',{value:url});return r;};
 // the bridge waits 250 ms between state asks: recorded, and let go at once
 const setTimeout=(fn,ms)=>{waits.push(ms);setImmediate(fn);return 0;};
 vm.runInNewContext(source,{window,document,location,chrome,fetch,URL,TextDecoder,TextEncoder,Uint8Array,ArrayBuffer,crypto:webcrypto,btoa:v=>Buffer.from(v,'binary').toString('base64'),console,setTimeout},{filename:file});
 const click=(target=button,trusted=true)=>{const event={target,isTrusted:trusted,preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};return {event,done:Promise.all(listeners.filter(l=>l.type==='click').map(l=>l.fn(event)))};};
 const load=()=>{for(const l of listeners.filter(l=>l.type==='load'))l.fn({});};
 return {listeners,posts,sent,requests,waits,button,click,load,messages:()=>posts.map(p=>p.message)};
}
const gets=h=>h.sent.filter(m=>m.type==='megapack-get');
const getting=(done,total=ROW.bytes)=>({ok:true,state:'getting',done,total,at:1});

test('a trusted click on a megapack sends megapack-get with the checked row; no pack file is downloaded',async()=>{
 const h=harness({catalog:[{...ROW,untrusted:'dropped'}],states:[getting(0),getting(1000),{ok:true,state:'here'}]});await tick();
 await h.click().done;
 assert.deepEqual(gets(h),[{type:'megapack-get',id:'soul-passage',entry:ROW}]);
 assert.deepEqual(h.requests,[BASE+'packs.json'],'only packs.json is read here; the worker fetches the manifest and files');
 assert.equal(h.sent.some(m=>m.type==='market-install'),false);
 assert.deepEqual(h.messages().filter(m=>m.id),[{ch:'market',id:'soul-passage',state:'getting',done:0,total:ROW.bytes},{ch:'market',id:'soul-passage',state:'getting',done:1000,total:ROW.bytes},{ch:'market',id:'soul-passage',state:'added',reason:''}]);
 for(const p of h.posts)assert.equal(p.origin,ORIGIN);
});
test('progress: the worker is asked every 250 ms (at most 4 messages a second); an unchanged state is not posted again',async()=>{
 const states=[getting(0),getting(0),getting(0),getting(5e6),getting(5e6),getting(9e6),getting(ROW.bytes),{ok:true,state:'here'}],h=harness({states});await tick();await h.click().done;
 assert.ok(h.waits.length>=states.length&&h.waits.every(ms=>ms===250),'every ask waits 250 ms: '+JSON.stringify(h.waits));
 const posted=h.messages().filter(m=>m.state==='getting');assert.deepEqual(posted.map(m=>m.done),[0,5e6,9e6,ROW.bytes]);
 // at most one "getting" between two waits: never more than 4 in any second
 const per=new Map();for(const p of h.posts.filter(p=>p.message.state==='getting'))per.set(p.at,(per.get(p.at)||0)+1);assert.ok([...per.values()].every(n=>n<=1));
 assert.deepEqual(h.messages().at(-1),{ch:'market',id:'soul-passage',state:'added',reason:''});
 assert.equal(h.sent.filter(m=>m.type==='megapack-state').length,states.length);
});
test('a failed download, a removed one, a refused ask and a reloaded extension end in "failed" with plain text',async()=>{
 const reason='A file from the Market did not match its check. Try again later.';
 let h=harness({states:[getting(10),{ok:true,state:'failed',reason,done:10,total:ROW.bytes}]});await tick();await h.click().done;assert.deepEqual(h.messages().at(-1),{ch:'market',id:'soul-passage',state:'failed',reason});
 h=harness({states:[{ok:true,state:'none'}]});await tick();await h.click().done;assert.deepEqual(h.messages().at(-1),{ch:'market',id:'soul-passage',state:'failed',reason:'The download stopped.'});
 h=harness({send:m=>m.type==='megapack-get'?{ok:false,reason:'Market access is unavailable.'}:{ok:true,installed:[]}});await tick();await h.click().done;assert.deepEqual(h.messages().at(-1),{ch:'market',id:'soul-passage',state:'failed',reason:'Market access is unavailable.'});
 h=harness({send:m=>{if(m.type==='megapack-state')throw Error('Extension context invalidated.');return m.type==='megapack-get'?{ok:true,state:'getting'}:{ok:true,installed:[]};}});await tick();await h.click().done;
 assert.deepEqual(h.messages().at(-1),{ch:'market',id:'soul-passage',state:'failed',reason:'Canvas Harness was just updated or reloaded. Reload this page, then Add again.'});
});
test('a click while the files are coming down does nothing; the next click after the end asks again',async()=>{
 let release;const gate=new Promise(r=>{release=r;});
 const h=harness({send:async(m,states)=>{if(m.type==='megapack-get')return {ok:true,state:'getting'};if(m.type==='megapack-state'){await gate;return {ok:true,state:'here'};}return {ok:true,installed:[]};}});await tick();
 const first=h.click();for(let i=0;i<10;i++)await tick();const second=h.click();await second.done;assert.ok(second.event.prevented);assert.equal(gets(h).length,1);
 release();await first.done;assert.deepEqual(h.messages().at(-1).state,'added');await h.click().done;assert.equal(gets(h).length,2);
 assert.deepEqual(h.messages().at(-1).state,'added','already here: "added" at once');
});
test('already here: the answer "here" posts "added" at once',async()=>{const h=harness({first:'here'});await tick();await h.click().done;assert.deepEqual(h.messages().filter(m=>m.id),[{ch:'market',id:'soul-passage',state:'added',reason:''}]);assert.equal(h.sent.filter(m=>m.type==='megapack-state').length,0);});
test('a newer engine, a scene this version has no code for, or more bytes than this version takes: "Update Canvas Harness to add this", nothing asked of the worker',async()=>{
 for(const patch of [{engine:2},{scene:'castle'},{bytes:80000001}]){const h=harness({catalog:[{...ROW,...patch}]});await tick();await h.click().done;assert.equal(gets(h).length,0);assert.deepEqual(h.messages().at(-1),{ch:'market',id:'soul-passage',state:'failed',reason:'Update Canvas Harness to add this'});}
});
test('a row needing a newer Canvas Harness than this one: "Update Canvas Harness to add this"; one this version meets is asked for (public)',async()=>{
 for(const [version,needs,ok] of [['4.2.0','4.2.0',true],['4.2.0','4.1.0',true],['4.10.0','4.9.0',true],['4.2.0','4.2.1',false],['4.2.0','5.0.0',false],['4.9.0','4.10.0',false]]){
  const h=harness({version,catalog:[{...ROW,needs}],states:[{ok:true,state:'here'}]});await tick();await h.click().done;
  if(ok){assert.equal(gets(h).length,1,version+' / '+needs);assert.equal(h.messages().at(-1).state,'added');}
  else{assert.equal(gets(h).length,0,version+' / '+needs);assert.deepEqual(h.messages().at(-1),{ch:'market',id:'soul-passage',state:'failed',reason:'Update Canvas Harness to add this'});}
 }
});
test('each row limit is checked here too; a malformed megapack row stops the catalogue as any malformed row does',async()=>{
 for(const patch of [{size:200001},{size:0},{bytes:0},{bytes:'1'},{sha256:'A'.repeat(64)},{needs:'next'},{needs:4},{file:'megapacks/soul-passage/1.json?x'},{file:'megapacks/other/1.json'},{file:'../megapacks/soul-passage/1.json'},{file:'megapacks/soul-passage/0.json'},{engine:0},{engine:1.5},{scene:'Train!'},{name:''},{id:'Soul_Passage',file:'megapacks/Soul_Passage/1.json'}]){
  const h=harness({id:patch.id||'soul-passage',catalog:[{...ROW,...patch}]});await tick();await h.click().done;assert.equal(gets(h).length,0,JSON.stringify(patch));
  assert.deepEqual(h.messages().at(-1),{ch:'market',id:patch.id||'soul-passage',state:'failed',reason:'Invalid market catalog entry'},JSON.stringify(patch));
 }
 const h=harness({id:'ocean',catalog:[KIT,{...ROW,size:0}]});await tick();await h.click().done;assert.equal(h.messages().at(-1).state,'failed');
});
test('a megapack row bigger than this version takes leaves every other add working',async()=>{
 const h=harness({id:'ocean',catalog:[{...ROW,bytes:80000001},KIT]});await tick();await h.click().done;assert.notEqual(h.messages().at(-1).state,'failed',JSON.stringify(h.messages().at(-1)));
});
test('other kinds are unchanged beside a megapack row: a kit still installs from its file',async()=>{
 const h=harness({id:'ocean',catalog:[ROW,KIT]});await tick();await h.click().done;
 assert.deepEqual(h.sent.filter(m=>m.type==='market-install').map(m=>m.entry),[KIT]);assert.equal(gets(h).length,0);assert.deepEqual(h.messages().at(-1),{ch:'market',id:'ocean',state:'added',reason:''});
});
test('{megapack:1} is posted once after load, to the page origin only',async()=>{
 const later=harness({readyState:'loading'});await tick();assert.equal(later.messages().filter(m=>'megapack' in m).length,0);later.load();later.load();
 assert.deepEqual(later.posts.filter(p=>'megapack' in p.message),[{message:{ch:'market',megapack:1},origin:ORIGIN,at:0}]);
 const now=harness({readyState:'complete'});await tick();assert.deepEqual(now.messages().filter(m=>'megapack' in m),[{ch:'market',megapack:1}]);
 const outside=harness({readyState:'complete',href:'https://evil.example/canvas-harness-packs/megapack.html'});await tick();assert.deepEqual(outside.posts,[]);
 assert.equal(Number(/const MEGAPACK=(\d+)/.exec(source)?.[1]),Number(/ENGINE=(\d+)/.exec(fs.readFileSync(path.join(__dirname,'../extension/megapack.js'),'utf8'))?.[1]),'the bridge tells the engine the worker has');
});
test('on load: installed passes the worker\'s list through; a download already coming down is followed to its end',async()=>{
 const h=harness({installed:['soul-passage','ocean'],getting:['soul-passage','../bad',42],states:[getting(100),{ok:true,state:'here'}]});for(let i=0;i<20;i++)await tick();
 assert.deepEqual(h.messages()[0],{ch:'market',installed:['soul-passage','ocean']});
 assert.deepEqual(h.messages().filter(m=>m.id),[{ch:'market',id:'soul-passage',state:'getting',done:100,total:ROW.bytes},{ch:'market',id:'soul-passage',state:'added',reason:''}]);
 assert.deepEqual(h.sent.filter(m=>m.type==='megapack-state').map(m=>m.id),['soul-passage','soul-passage']);
});
