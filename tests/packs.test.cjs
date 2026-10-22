'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const KEY='reserve:packs',RECEIPTS='reserve:packs:receipts',ACCOUNT='reserve:v1:https://school.instructure.com:7';
const hash=data=>createHash('sha256').update(data).digest('hex'),svg='<svg viewBox="0 0 20 20"><circle r="4"/></svg>';
const kit=(assets={})=>({version:1,name:'Library',assets,accent:'clay',font:'system',bannerSize:'standard',bannerFit:'contain',bannerPosition:'right',titlePlacement:'separate'});
const payload=(kind,value,id='library')=>{const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value));return [{id,name:'Library <text>',kind,file:'files/'+id+(kind==='kit'?'.chkit':kind==='course-art'?'.chpack':'.json'),size:bytes.length,sha256:hash(bytes)},bytes.toString('base64')];};
function harness(saved={}){
 const data=structuredClone(saved),writes=[],media={media:[],kits:[],meta:[]},calls=[];let state=structuredClone(media),env;
 const adapter={async transact(fn,write){if(write&&h.failMedia)throw Error('Media disk full');const next=structuredClone(state),result=fn(next);if(write)state=next;return result;},close(){}};
 const h={data,writes,calls,fail:false,failMedia:false,profile:'7',get media(){return state;},gate:null};
 const chrome={storage:{local:{async get(keys){if(h.gate)await h.gate;return structuredClone(keys===null?data:Object.fromEntries([].concat(keys).filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]])));},async set(values){if(h.fail)throw Error('Disk full');writes.push(structuredClone(values));Object.assign(data,structuredClone(values));}}}};
 env=vm.createContext({chrome,Blob,URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,structuredClone,crypto:webcrypto,atob,btoa,setTimeout,clearTimeout,AbortSignal,importScripts(){},fetch:async(url,options)=>{calls.push({url:String(url),options});return {ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>String(url).includes('/profile')?{id:h.profile}:[{id:'10',name:'Biology'},{id:'20',name:'Latin'}]};}});
 require('./market-fixture.cjs').loadMarketSite(env);
 for(const file of ['features.js','core.js','custom-art.js','media-reference.js','media-store.js','workspace-arrange.js','customization-model.js','custom-kits.js','quick-pack.js','gpa-model.js','personal-work.js','page-preferences.js','storage.js'])vm.runInContext(read(file),env,{filename:file});
 const real=env.ReserveMedia;env.ReserveMedia={...real,createPackStore:owner=>real.createStore(owner,{adapter})};
 assert.ok(fs.existsSync(path.join(__dirname,'../extension/packs.js')),'packs.js must implement validated reversible installs');vm.runInContext(read('packs.js'),env,{filename:'packs.js'});
 return Object.assign(h,{env,api:env.ReservePacks});
}
test('kits use the real import codec and local kit store; removal deletes only their own kit',async()=>{
 const h=harness(),asset=Buffer.from(svg),p=payload('kit',kit({bannerArt:{name:'Banner.svg',type:'image/svg+xml',data:asset.toString('base64'),sha256:hash(asset)}}));
 await h.api.install(...p);assert.equal(h.media.kits.length,1);assert.match(h.media.kits[0].kit.appearance.bannerArt.svg,/<circle/);assert.deepEqual(plain(await h.api.installed()).map(({installedAt,...row})=>row),[{id:'library',name:'Library <text>',kind:'kit'}]);
 assert.ok(Number.isSafeInteger((await h.api.installed())[0].installedAt));assert.equal(h.calls.every(c=>c.url.startsWith('https://school.instructure.com/')),true);
 await h.api.remove('library');assert.equal(h.media.kits.length,0);assert.deepEqual(h.data[KEY],{});assert.deepEqual(h.data[RECEIPTS],{});
});
test('worker revalidates kit schema, nested hashes and SVG even with a matching outer hash',async()=>{
 for(const doc of [{...kit(),code:'alert(1)'},kit({bannerArt:{name:'x',type:'image/svg+xml',data:Buffer.from(svg).toString('base64'),sha256:'0'.repeat(64)}}),kit({bannerArt:{name:'x',type:'image/svg+xml',data:Buffer.from('<svg onload="bad()"/>').toString('base64'),sha256:hash(Buffer.from('<svg onload="bad()"/>'))}})]){
  const h=harness();await assert.rejects(h.api.install(...payload('kit',doc)));assert.equal(h.writes.length,0);assert.equal(h.media.kits.length,0);
 }
});
test('feature packs only enable catalogue ids, use Custom, and restore the prior switch',async()=>{
 const h=harness({'reserve:features':{preset:'lite'}});await h.api.install(...payload('feature',{feature:'pony'}));assert.equal(h.data['reserve:features'].preset,'custom');assert.equal(h.env.ReserveFeatures.resolve(h.data['reserve:features']).enabled.includes('pony'),true);
 await h.api.remove('library');assert.equal(h.env.ReserveFeatures.resolve(h.data['reserve:features']).enabled.includes('pony'),false);assert.equal(h.env.ReserveFeatures.resolve(h.data['reserve:features']).enabled.includes('math'),true);assert.equal(h.calls.length,0);
 for(const doc of [{feature:'unknown'},{feature:'https://evil.test/code.js'},{feature:'pony',code:'alert(1)'},{feature:false},['pony']]){const bad=harness();await assert.rejects(bad.api.install(...payload('feature',doc)));assert.equal(bad.writes.length,0);}
 const on=harness({'reserve:features':{preset:'full'}});await on.api.install(...payload('feature',{feature:'pony'}));await on.api.remove('library');assert.equal(on.env.ReserveFeatures.resolve(on.data['reserve:features']).enabled.includes('pony'),true);
});

for(const initial of [{preset:'full',custom:['math']},{preset:'lite',custom:['math']},{preset:'custom',custom:['math']}])test('an already enabled feature preserves the exact '+initial.preset+' preference record',async()=>{
 const h=harness({'reserve:features':initial}),before=structuredClone(initial);await h.api.install(...payload('feature',{feature:'math'}));assert.deepEqual(h.data['reserve:features'],before);await h.api.remove('library');assert.deepEqual(h.data['reserve:features'],before);
});
test('enabling a missing feature restores the exact Full/Lite record and dormant Custom selection',async()=>{
 const original={preset:'lite',custom:['math']},h=harness({'reserve:features':original});await h.api.install(...payload('feature',{feature:'pony'}));assert.equal(h.data['reserve:features'].preset,'custom');await h.api.remove('library');assert.deepEqual(h.data['reserve:features'],original);
});
test('feature removal keeps a subsequent student preset and Custom choice',async()=>{
 for(const chosen of [{preset:'full',custom:['math']},{preset:'lite',custom:['gpa']},{preset:'custom',custom:['math','pony','gpa']}]){const h=harness({'reserve:features':{preset:'custom',custom:['math']}});await h.api.install(...payload('feature',{feature:'pony'}));h.data['reserve:features']=structuredClone(chosen);await h.api.remove('library');assert.deepEqual(h.data['reserve:features'],chosen);}
});
for(const order of [['first','second'],['second','first']])test('different feature receipts replay exact preferences through '+order.join('/')+' removal',async()=>{
 const initial={preset:'custom',custom:['math']},h=harness({'reserve:features':initial});await h.api.install(...payload('feature',{feature:'dashboard'},'first'));await h.api.install(...payload('feature',{feature:'planner'},'second'));for(const id of order)await h.api.remove(id);assert.deepEqual(h.data['reserve:features'],initial);
});
test('overlapping feature receipts survive out-of-order removal and worker restarts',async()=>{
 const h=harness({'reserve:features':{preset:'custom',custom:['math']}});await h.api.install(...payload('feature',{feature:'pony'},'first'));await h.api.install(...payload('feature',{feature:'pony'},'second'));
 await h.api.remove('first');assert.equal(h.env.ReserveFeatures.resolve(h.data['reserve:features']).enabled.includes('pony'),true);
 const resumed=harness(h.data);await resumed.api.remove('second');assert.deepEqual(plain(resumed.data['reserve:features']),{preset:'custom',custom:['math']});
});
test('course-art validates every SVG, matches real courses, installs and removes atomically',async()=>{
 const original={version:1,settings:{coursePrefs:{'10':{name:'Bio',iconArt:{name:'Old.svg',svg:'<svg/>'}}},overviewArt:{}},tasks:{'1':{notes:'kept'}}},h=harness({[ACCOUNT]:original});
 const text='<?ch-pack version="1" name="Art"?>\n<?ch-art course="Biology" slot="icon"?>\n'+svg+'\n<?ch-art place="overview" slot="banner" fit="cover"?>\n'+svg+'\n<?ch-end parts="2"?>';
 await h.api.install(...payload('course-art',text));assert.match(h.data[ACCOUNT].settings.coursePrefs['10'].iconArt.svg,/<circle/);assert.equal(h.data[ACCOUNT].settings.overviewArt.bannerFit,'cover');assert.deepEqual(h.data[ACCOUNT].tasks,{'1':{notes:'kept'}});
 await h.api.remove('library');assert.deepEqual(h.data[ACCOUNT],original);
 for(const source of [text.replace(svg,'<svg onload="bad()"/>'),text.replace('Biology','Unknown'),text.replace('parts="2"','parts="3"')]){const bad=harness({[ACCOUNT]:original});await assert.rejects(bad.api.install(...payload('course-art',source)));assert.deepEqual(bad.data,{[ACCOUNT]:original});}
});
test('course-art undo preserves manual edits and rebases overlapping later packs',async()=>{
 const original={settings:{coursePrefs:{},overviewArt:{}}},h=harness({[ACCOUNT]:original}),pack=body=>'<?ch-pack version="1"?><?ch-art place="overview" slot="icon"?><svg>'+body+'</svg><?ch-end parts="1"?>';
 await h.api.install(...payload('course-art',pack('<circle r="2"/>'),'first'));await h.api.install(...payload('course-art',pack('<circle r="3"/>'),'second'));await h.api.remove('first');assert.match(h.data[ACCOUNT].settings.overviewArt.iconArt.svg,/r="3"/);await h.api.remove('second');assert.deepEqual(h.data[ACCOUNT],original);
 await h.api.install(...payload('course-art',pack('<circle r="2"/>')));h.data[ACCOUNT].settings.overviewArt.iconArt={name:'Manual',svg:'<svg/>'};await h.api.remove('library');assert.equal(h.data[ACCOUNT].settings.overviewArt.iconArt.name,'Manual');
});
test('removing an older art pack preserves a manual edit made before a later pack',async()=>{
 const h=harness({[ACCOUNT]:{settings:{coursePrefs:{},overviewArt:{}}}}),pack=n=>'<?ch-pack version="1"?><?ch-art place="overview" slot="icon"?><svg><circle r="'+n+'"/></svg><?ch-end parts="1"?>';await h.api.install(...payload('course-art',pack(2),'first'));h.data[ACCOUNT].settings.overviewArt.iconArt={name:'Manual',svg:'<svg/>'};await h.api.install(...payload('course-art',pack(3),'second'));await h.api.remove('first');await h.api.remove('second');assert.deepEqual(h.data[ACCOUNT].settings.overviewArt.iconArt,{name:'Manual',svg:'<svg/>'});
});
test('size, hash, metadata, canonical base64 and market file restrictions are checked independently',async()=>{
 const good=payload('feature',{feature:'math'});
 for(const change of [{kind:'script'},{size:0},{size:40000001},{size:good[0].size+1},{sha256:'0'.repeat(64)},{file:'https://evil.test/a.json'},{file:'../a.json'},{file:'files/%2fsecret'},{file:'files/%252e%252e/a'},{file:'a?download=1'},{file:'a#x'},{file:'files/..\\a'},{file:'https://user@flzsh.github.io/canvas-harness-packs/a'},{id:'__proto__'},{extra:'code'}]){const h=harness();await assert.rejects(h.api.install({...good[0],...change},good[1]));assert.equal(h.writes.length,0);}
 for(const bytes of [good[1]+'!',good[1].replace(/=+$/,''),{},[]]){const h=harness();if(bytes===good[1])continue;await assert.rejects(h.api.install(good[0],bytes));assert.equal(h.writes.length,0);}
});
test('50-pack cap, duplicates, concurrent operations and failed writes leave no partial installs',async()=>{
 const rows=Object.fromEntries(Array.from({length:50},(_,i)=>['p'+i,{id:'p'+i,name:'Pack',kind:'feature',installedAt:i}])),full=harness({[KEY]:rows});await assert.rejects(full.api.install(...payload('feature',{feature:'math'})));assert.equal(full.writes.length,0);
 const h=harness();let release;h.gate=new Promise(resolve=>release=resolve);const first=h.api.install(...payload('feature',{feature:'math'}));await assert.rejects(h.api.install(...payload('feature',{feature:'pony'},'other')),/progress|busy|time/i);release();h.gate=null;await first;await assert.rejects(h.api.install(...payload('feature',{feature:'math'})));assert.equal(Object.keys(h.data[KEY]).length,1);
 for(const [kind,value]of [['kit',kit()],['feature',{feature:'math'}],['course-art','<?ch-pack version="1"?><?ch-art place="overview" slot="icon"?>'+svg+'<?ch-end parts="1"?>']]){const bad=harness();bad.fail=true;await assert.rejects(bad.api.install(...payload(kind,value)));assert.deepEqual(bad.data,{});assert.equal(bad.media.kits.length,0);assert.equal(bad.media.media.length,0);}
});
test('numeric pack ids preserve actual installation order when undoing overlapping changes',async()=>{
 const h=harness({'reserve:features':{preset:'custom',custom:['math']}});await h.api.install(...payload('feature',{feature:'pony'},'2'));await h.api.install(...payload('feature',{feature:'pony'},'1'));await h.api.remove('2');assert.equal(h.env.ReserveFeatures.resolve(h.data['reserve:features']).enabled.includes('pony'),true);await h.api.remove('1');assert.deepEqual(plain(h.data['reserve:features']),{preset:'custom',custom:['math']});
});
test('removing a feature pack preserves a dependent installed pack and restores implicit selections',async()=>{
 const h=harness({'reserve:features':{preset:'custom',custom:['math']}});await h.api.install(...payload('feature',{feature:'dashboard'},'base'));await h.api.install(...payload('feature',{feature:'planner'},'dependent'));await h.api.remove('base');assert.equal(h.env.ReserveFeatures.resolve(h.data['reserve:features']).enabled.includes('planner'),true);await h.api.remove('dependent');assert.deepEqual(plain(h.data['reserve:features']),{preset:'custom',custom:['math']});
 const implicit=harness({'reserve:features':{preset:'custom',custom:['planner']}});await implicit.api.install(...payload('feature',{feature:'dashboard'}));await implicit.api.remove('library');assert.deepEqual(plain(implicit.data['reserve:features']),{preset:'custom',custom:['planner']});
});
test('real media rules prepare imported kit images, rollback bytes, and retain referenced media on removal',async()=>{
 function image(h){const real=h.env.ReserveMedia;h.env.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8Array([50,80,90,255])})}),toBlob:fn=>fn(new Blob(['clean'],{type:'image/webp'}))})};h.env.createImageBitmap=async()=>({width:1,height:1,close(){}});h.env.ReservePackMedia={prepare:real.prepare};}
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'),doc=kit({bannerArt:{name:'Image.png',type:'image/png',data:bytes.toString('base64'),sha256:hash(bytes)}}),h=harness();image(h);await h.api.install(...payload('kit',doc));assert.equal(h.media.media.length,1);assert.equal(await h.media.media[0].blob.text(),'clean');await h.api.remove('library');assert.equal(h.media.media.length,0);
 const fail=harness();image(fail);fail.fail=true;await assert.rejects(fail.api.install(...payload('kit',doc)));assert.equal(fail.media.media.length,0);assert.equal(fail.media.kits.length,0);assert.deepEqual(fail.data,{});
 const keep=harness();image(keep);await keep.api.install(...payload('kit',doc));const ref=keep.media.media[0].asset;keep.data[ACCOUNT]={settings:{overviewArt:{bannerArt:ref}}};await keep.api.remove('library');assert.equal(keep.media.media.length,1);assert.equal(keep.media.kits.length,0);
});
test('kit removal failure restores its exact registry and receipt without losing the kit',async()=>{
 const h=harness();await h.api.install(...payload('kit',kit()));const original=structuredClone(h.data);h.failMedia=true;await assert.rejects(h.api.remove('library'));assert.deepEqual(h.data,original);assert.equal(h.media.kits.length,1);
});
test('course art refuses the combined personal-data budget without breaking existing notes',async()=>{
 const data={settings:{coursePrefs:{},overviewArt:{}},tasks:Object.fromEntries(Array.from({length:199},(_,i)=>[String(i),{notes:'n'.repeat(19800)}]))},h=harness({[ACCOUNT]:data});h.env.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data});const source='<?ch-pack version="1"?><?ch-art place="overview" slot="icon"?><svg><desc>'+'x'.repeat(100000)+'</desc></svg><?ch-end parts="1"?>';await assert.rejects(h.api.install(...payload('course-art',source)),/too large|full/i);assert.deepEqual(h.data,{[ACCOUNT]:data});
});
test('art removal refuses an oversized restored account while retaining its row and undo receipt',async()=>{
 const data={settings:{coursePrefs:{},overviewArt:{iconArt:{name:'Old',svg:'<svg><desc>'+'x'.repeat(100000)+'</desc></svg>'}}},tasks:Object.fromEntries(Array.from({length:194},(_,i)=>[String(i),{notes:'n'.repeat(19800)}]))},h=harness({[ACCOUNT]:data});h.env.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data});const source='<?ch-pack version="1"?><?ch-art place="overview" slot="icon"?>'+svg+'<?ch-end parts="1"?>';await h.api.install(...payload('course-art',source));for(let i=194;i<199;i++)h.data[ACCOUNT].tasks[String(i)]={notes:'n'.repeat(19800)};h.env.ReserveStorage.validateBackup({format:'reserve-backup',version:1,data:h.data[ACCOUNT]});const before=structuredClone(h.data);await assert.rejects(h.api.remove('library'),/too large|full/i);assert.deepEqual(h.data,before);
});
