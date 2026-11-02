'use strict';
// Developer tools (extension/developer.js): read-only, counts only, nothing about coursework in what it shows or copies.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ext=path.join(__dirname,'../extension'),source=fs.readFileSync(path.join(ext,'developer.js'),'utf8');
const F=require('../extension/features.js'),D=require('../extension/developer.js');
const MARK='zebrafinch';
const BASE='chrome-extension://abcdefghijklmnop/';
// a fresh copy of the file in its own context, with an extension address, so the capture part can be driven
function captured(){const env=vm.createContext({chrome:{runtime:{getURL:p=>BASE+p}},performance:{now:()=>1234.5},module:{exports:{}}});vm.runInContext(source,env);return env.module.exports;}
const fullIds=F.resolve({preset:'full'}).enabled;
const input=(over={})=>({manifest:{version:'4.0.92'},userAgent:'Mozilla/5.0 Chrome/141.0 Safari/537.36 Edg/141.0',offset:300,now:Date.parse('2026-11-02T08:00:00Z'),
 features:{preset:'full',enabled:fullIds,full:fullIds},settings:{defaults:{},enums:{},values:{}},cache:null,courses:6,items:84,speed:{open:640,renders:[18,20,41]},storage:{personal:800000,cache:1200000,materials:300000,changes:0},errors:[],dropped:0,...over});

test('Developer tools is off by default, outside Full and Lite, and brings Tools with it when chosen',()=>{
 for(const preset of ['full','lite']){const r=F.resolve({preset});assert.ok(!r.enabled.includes('developer'),preset);assert.ok(!r.js.includes('developer.js'),preset);}
 const mine=F.resolve({preset:'custom',custom:['developer']});assert.ok(mine.enabled.includes('developer'));assert.ok(mine.enabled.includes('tools'));assert.ok(mine.js.includes('developer.js'));
 assert.equal(F.catalogue.find(f=>f.id==='developer').group,'Extras');
});

test('every script in the catalogue is in the load order, so none is dropped without a word',()=>{
 const startup=new Set(F.resolve({preset:'full'}).startupJS); // (Motion's startup drawing loads on its own, before the page)
 for(const f of F.catalogue)for(const file of f.files.js)if(!startup.has(file))assert.ok(F.order.includes(file),f.id+': '+file);
 assert.equal(F.order.indexOf('developer.js'),F.order.indexOf('site.js')+1,'right after site.js, so it sees errors from everything after');
});

test('no coursework, account or address reaches the rows or the report',()=>{
 const settings={defaults:{note:'',accent:'#c96442',density:'comfortable',showHelp:true,sceneTheme:''},enums:{sceneTheme:['','sea']},values:{note:MARK,accent:MARK,density:MARK,showHelp:false,sceneTheme:'sea',name:MARK}};
 const cache={fetchedAt:'2026-11-02T07:50:00Z',partial:true,errors:[{code:'403',message:MARK,courseName:MARK},{code:MARK+'-very-long-code',message:MARK}]};
 const f=D.facts(input({settings,cache,manifest:{version:'4.0.92',name:MARK},userAgent:MARK,user:{name:MARK,id:'99'},host:MARK+'.instructure.com',courses:[MARK],items:[MARK]}));
 for(const text of [JSON.stringify(f),JSON.stringify(D.rows(f)),D.report(f)]){assert.ok(!text.includes(MARK),text);assert.ok(!text.includes('reserve:v1'));assert.ok(!text.includes('instructure'));}
 assert.match(D.report(f),/^### Canvas Harness report\n\n```text\n[\s\S]*\n```\n$/);
});

test('an open item\'s ids are shown in the panel only, never in the facts or the report',()=>{
 const item=D.itemOf({reader:'456',items:[{id:'456',courseId:'123'}],pathname:'/'});assert.deepEqual({...item},{course:'123',assignment:'456'});
 assert.deepEqual({...D.itemOf({pathname:'/courses/77/assignments/88/submissions'})},{course:'77',assignment:'88'});assert.deepEqual({...D.itemOf({pathname:'/courses/77'})},{course:'77',assignment:null});
 assert.equal(D.itemOf({reader:'abc',pathname:'/courses/x1'}),null,'ids that are not all digits are never shown');
 const f=D.facts(input({ctx:{items:[{id:'456',courseId:'123'}]}}));for(const text of [JSON.stringify(f),D.report(f)]){assert.ok(!/\b456\b|\b123\b/.test(text));}
});

test('settings: a switch or a fixed choice shows its value, anything else only its name',()=>{
 const f=D.facts(input({settings:{defaults:{showHelp:true,sceneTheme:'',accent:'#c96442',bedtime:'22:30',density:'comfortable'},enums:{sceneTheme:['','sea']},values:{showHelp:false,sceneTheme:'sea',accent:'#000000',bedtime:'23:10',density:'comfortable'}}}));
 assert.deepEqual(JSON.parse(JSON.stringify(f.settings)),[{name:'showHelp',value:false},{name:'sceneTheme',value:'sea'},{name:'accent'},{name:'bedtime'}]);
 assert.ok(D.rows(f).find(([n])=>n==='Settings')[1].includes('showHelp=false'));
});

test('Canvas failure codes: a plain code counts, a strange or missing one is other, and the message is never read',()=>{
 const trap={get message(){throw Error('read the message');},code:'404'};
 const f=D.facts(input({cache:{fetchedAt:'2026-11-02T07:56:00Z',errors:[trap,{code:'403'},{code:'4 03 <b>'},{},{code:'403'}]}}));
 assert.deepEqual({...f.canvas.codes},{404:1,403:2,other:2});assert.equal(f.canvas.synced,4);
 assert.ok(D.rows(f).find(([n])=>n==='Canvas')[1].includes('synced 4 min ago'));
});

test('errors: only this extension\'s own files, only trusted events, never the message; the twenty-first goes uncounted',()=>{
 const X=captured(),E=X._errors;E.reset();
 E.onError({isTrusted:true,filename:'https://school.instructure.com/dist/main.js',lineno:4,error:{name:'TypeError'}});
 E.onError({isTrusted:false,filename:BASE+'dashboard.js',lineno:9,error:{name:'TypeError'}});
 assert.equal(E.list().length,0,'a page error and an untrusted event leave nothing');
 E.onError({isTrusted:true,filename:BASE+'dashboard.js',lineno:1204,message:MARK,error:{name:'TypeError',message:MARK}});E.onError({isTrusted:true,filename:BASE+'dashboard.js',lineno:1204,error:{name:'TypeError'}});
 E.onError({isTrusted:true,filename:BASE+'core.js',lineno:7,error:{name:'Not an <error>'}});
 assert.deepEqual(JSON.parse(JSON.stringify(E.list())),[{type:'TypeError',file:'dashboard.js',line:1204,count:2},{type:'Error',file:'core.js',line:7,count:1}]);
 assert.ok(!JSON.stringify(E.list()).includes(MARK));
 for(let i=0;i<30;i++)E.onError({isTrusted:true,filename:BASE+'api.js',lineno:100+i,error:{name:'RangeError'}});assert.equal(E.list().length,20);
 const f=D.facts(input({errors:E.list(),dropped:12}));assert.ok(D.rows(f).find(([n])=>n==='Errors')[1].at(-1).startsWith('+'));assert.ok(D.report(f).split('\n').filter(l=>l.includes('Error')).length<=2,'the report lists at most ten, on one row');
 E.reset();E.onRejection({isTrusted:true,reason:{name:'TypeError',stack:`TypeError: ${MARK}\n    at go (${BASE}../../evil<script>.js:1:1)\n    at run (${BASE}storage.js:431:9)`}});
 assert.deepEqual(JSON.parse(JSON.stringify(E.list())),[{type:'TypeError',file:'storage.js',line:431,count:1}],'a spoofed line gives only a file shape and a number');
});

test('speed: median, worst, a 200 render cap, and open fixed at the first render',()=>{
 const X=captured();X._errors.reset();for(let i=1;i<=250;i++)X.rendered(i);
 const f=D.facts(input({speed:{open:1234.5,renders:Array.from({length:200},(_,i)=>i+51)}}));assert.deepEqual({...f.speed},{open:1235,median:151,worst:250,renders:200});
 assert.equal(D.facts(input({speed:{open:0,renders:[]}})).speed.renders,0);assert.deepEqual(D.rows(D.facts(input({speed:{renders:[]}}))).find(([n])=>n==='Speed')[1],['no renders yet']);
});

test('works with and without the study features: Full, Lite, Custom with and without them',()=>{
 for(const prefs of [{preset:'full'},{preset:'lite'},{preset:'custom',custom:['tools','developer','ai']},{preset:'custom',custom:['tools','developer']}]){
  const r=F.resolve(prefs),f=D.facts(input({features:{preset:r.preset,enabled:r.enabled,full:fullIds}}));assert.equal(D.rows(f).length,7);assert.ok(D.report(f).includes('Features'));
 }
 assert.ok(D.rows(D.facts(input({features:{preset:'custom',enabled:[...fullIds.filter(id=>id!=='pony'),'developer'],full:fullIds}}))).find(([n])=>n==='Features')[1].join(' ').includes('Full +developer -pony'));
});

test('the file reaches nothing beyond four shared globals and has nothing of the newer study features in it',()=>{
 const names=new Set(source.match(/\b(?:Reserve|CanvasHarness)[A-Za-z]+/g));for(const n of names)assert.ok(['ReserveFeatures','ReserveUI','ReserveSite','ReserveCustomization','ReserveDeveloper'].includes(n),n);
 assert.doesNotMatch(source,/\b(ai|agent|study|overnight|biscuit)\b/i);assert.doesNotMatch(source,/CH\+|reserve:dev|Reserve(Timing|Debug|Trace|Perf)|performance\.mark|console\.time/);
 for(const line of source.split('\n'))assert.ok(Buffer.byteLength(line)<3500);
});

test('the panel acts only on a real press: an untrusted click returns before anything is copied',()=>{
 const flat=source.replace(/\s+/g,''); // (the public trees spread long lines; whitespace is not what is tested)
 for(const text of ['functiononClick(event){if(!event.isTrusted)return;','copy(report(facts(input())))','/^\\d{1,15}$/.test(b.dataset.value'])assert.ok(flat.includes(text),text);
 assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|sendMessage|localStorage|chrome\.storage/,'nothing is sent and nothing is saved');
});

test('store.sizes gives numbers by area name, null when the adapter cannot tell, and never a key',async()=>{
 const {createStore}=require('../extension/storage.js'),state={},keys=[];
 const adapter={read:async k=>structuredClone(state[k]),write:async(k,v)=>{state[k]=structuredClone(v);},subscribe:()=>()=>{},bytes:async k=>{keys.push(k);if(k.endsWith(':materials'))throw Error('no');return k.endsWith(':cache')?1200:k.length;}};
 const store=createStore({accountId:'1',adapter});await store.load();const sizes=await store.sizes();
 assert.deepEqual(Object.keys(sizes),['personal','cache','materials','changes']);assert.equal(sizes.cache,1200);assert.equal(sizes.materials,null);assert.ok(Number.isFinite(sizes.personal));
 assert.ok(!JSON.stringify(sizes).includes('reserve'));assert.equal(keys.length,4);
 const plain=createStore({accountId:'1',adapter:{read:async()=>null,write:async()=>{},subscribe:()=>()=>{}}});await plain.load();assert.deepEqual({...await plain.sizes()},{personal:null,cache:null,materials:null,changes:null});
});
