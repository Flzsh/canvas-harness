'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash,webcrypto}=require('node:crypto');
const globals=['ReserveCustomArt','ReserveCustomKits','ReservePackCommon','ReserveThemePack','ReservePetPack','ReservePresetPack','ReserveMedia','ReserveWorkspaceArrange','ReserveCustomization','ReservePlanner','ReservePetArt','ReservePonyAsk','CanvasHarnessAgentClock'],saved=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
after(()=>{for(const [key,d]of saved)if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];});
const C=require('../extension/pack-common.js'),Theme=require('../extension/theme-pack.js'),Pet=require('../extension/pet-pack.js'),Preset=require('../extension/preset-pack.js');
const dir=path.join(__dirname,'fixtures/make-your-own'),fixture=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')),copy=v=>structuredClone(v),hash=v=>createHash('sha256').update(v).digest('hex'),asset=(text,type='image/svg+xml')=>{const bytes=Buffer.from(text);return {type,data:bytes.toString('base64'),sha256:hash(bytes)};};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const preset=(kind,data)=>({format:'chpreset',version:1,name:'Preset',kind,data});

test('new pack codecs expose browser globals, CommonJS, importPack, collectors and 40 MB limits',()=>{
 for(const [name,api]of [['ReserveThemePack',Theme],['ReservePetPack',Pet],['ReservePresetPack',Preset]]){assert.equal(globalThis[name],api);assert.equal(api.limits.fileBytes,40000000);assert.ok(Object.isFrozen(api.limits));for(const key of ['validate','importPack','problems','portable'])assert.equal(typeof api[key],'function');}
 const context=vm.createContext({Blob,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,atob,btoa,ReserveCustomArt:require('../extension/custom-art.js'),ReserveMedia:require('../extension/media-store.js')});
 for(const name of ['custom-kits','pack-common','theme-pack','pet-pack','preset-pack'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension',name+'.js'),'utf8'),context,{filename:name+'.js'});
 assert.equal(typeof context.ReserveThemePack.validate,'function');assert.equal(typeof context.ReservePetPack.importPack,'function');assert.equal(typeof context.ReservePresetPack.apply,'function');
});

test('two tiny fixtures for every new format round-trip portable wire fields and import from local files',async()=>{
 for(const name of fs.readdirSync(dir).filter(name=>/\.(chtheme|chpet|chpreset)$/.test(name))){const input=fixture(name),before=copy(input),api={chtheme:Theme,chpet:Pet,chpreset:Preset}[input.format],result=await api.validate(input);assert.deepEqual(input,before);assert.deepEqual(api.portable(result.pack),input);assert.deepEqual(await api.problems(input),[]);const blob=new Blob([JSON.stringify(input)]);Object.defineProperty(blob,'name',{value:name});assert.deepEqual(api.portable((await api.importPack(blob)).pack),input);}
});

test('independent schema and contrast diagnostics include every offending field path',async()=>{
 const value=fixture('01-colors.chtheme');value.extra=true;value.colors.light.extra=true;value.colors.light.ink='#ffffff';value.colors.light.muted='#ffffff';value.colors.dark.bg='white';value.colors.dark.line='no';value.banner={asset:'missing',typo:'cover'};
 const problems=await Theme.problems(value),message=problems.join('\n');for(const field of ['$.extra','$.colors.light.extra','$.colors.light.ink','$.colors.light.muted','$.colors.dark.bg','$.colors.dark.line','$.banner.asset','$.banner.typo'])assert.ok(message.includes(field),message);assert.ok(problems.length>=8);assert.ok(Theme.contrast('#000000','#ffffff')>=21);
});

test('input has no accessors, prototype tricks, sparse arrays, hidden fields or injected SVG render fields',async()=>{
 let called=false;const value=fixture('02-svg.chtheme');Object.defineProperty(value.colors.light,'bg',{enumerable:true,get(){called=true;throw Error('getter ran');}});await assert.rejects(()=>Theme.validate(value),/data property|accessor/);assert.equal(called,false);
 for(const value of [Object.create({format:'chtheme'}),JSON.parse('{"format":"chtheme","version":1,"name":"x","colors":{},"__proto__":{}}')])await assert.rejects(()=>Theme.validate(value));
 const doc=fixture('02-svg.chtheme');doc.assets.tile.svg='<svg/>';doc.assets.tile.still='<svg/>';const errors=await Theme.problems(doc);assert.ok(errors.some(v=>v.includes('$.assets.tile.svg')));assert.ok(errors.some(v=>v.includes('$.assets.tile.still')));
 const sparse=fixture('01-static.chpet');delete sparse.size[0];await assert.rejects(()=>Pet.validate(sparse),/data property|enumerable/);
 const hidden=fixture('01-colors.chtheme');Object.defineProperty(hidden,'hidden',{value:true});await assert.rejects(()=>Theme.validate(hidden),/enumerable/);
});

test('all original hashes, including unreferenced assets, are checked before SVG or media preparation',async()=>{
 const value=fixture('02-svg.chtheme');value.assets.tile=asset('<svg onload="bad()"/>');value.assets.tile.sha256='0'.repeat(64);value.assets.unused=asset(png,'image/png');value.assets.unused.sha256='f'.repeat(64);let calls=0;
 const problems=await Theme.problems(value,{media:{async prepare(){calls++;throw Error('must not decode');}}});assert.equal(calls,0);assert.ok(problems.some(v=>v.includes('$.assets.tile.sha256')));assert.ok(problems.some(v=>v.includes('$.assets.unused.sha256')));
 const malformed=fixture('02-svg.chtheme');malformed.assets.tile.data='AA=A';await assert.rejects(()=>Theme.validate(malformed),/base64/);
 const noncanonical=fixture('02-svg.chtheme');noncanonical.assets.tile.data='AB==';await assert.rejects(()=>Theme.validate(noncanonical),/padding/);
 const independent=fixture('02-svg.chtheme');independent.unexpected=true;independent.assets.tile.sha256='0'.repeat(64);const all=await Theme.problems(independent);assert.ok(all.some(v=>v.includes('$.unexpected')));assert.ok(all.some(v=>v.includes('$.assets.tile.sha256')));
});

test('SVG sanitization creates internal stills without changing the wire document',async()=>{
 const input=fixture('02-motion.chpet'),before=copy(input),{pack,media}=await Pet.validate(input);assert.equal(media.length,0);assert.deepEqual(input,before);assert.ok(pack.assets.moving.svg.includes('animation'));assert.doesNotMatch(pack.assets.moving.still,/@keyframes|<animate/);assert.equal(C.animatedSVG(pack.assets.moving.still),false);assert.deepEqual(Pet.portable(pack),before);assert.equal(pack.poses.walk,'moving');await assert.rejects(()=>Pet.validate(pack),/unknown field/);await Pet.validate(Pet.portable(pack));
 const unsafe=fixture('01-static.chpet');unsafe.assets.tile=asset('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');await assert.rejects(()=>Pet.validate(unsafe),/script|SVG/);
 const invalidUTF=fixture('01-static.chpet');invalidUTF.assets.tile=asset(Buffer.from([255]));await assert.rejects(()=>Pet.validate(invalidUTF),/UTF-8/);
});

test('theme animation requires a distinct static still and still animation is refused',async()=>{
 const input=fixture('02-svg.chtheme'),moving=fixture('02-motion.chpet').assets.moving;input.assets.moving=moving;input.banner.asset='moving';await assert.rejects(()=>Theme.validate(input),/banner.still/);input.banner.still='tile';const {pack}=await Theme.validate(input);assert.equal(pack.banner.asset,'moving');assert.equal(pack.banner.still,'tile');input.banner.still='moving';await assert.rejects(()=>Theme.validate(input),/still asset.*animation/);
});

test('static CSS animation and transition resets do not require a theme still',async()=>{
 for(const css of ['.x{animation:none}','.x{transition:none}','.x{animation:none!important;-webkit-animation:none!important;transition:none!important}','.x{animation-name:none;animation-duration:2s}','.x{animation:0s ease 0s 1 normal none running}']){
  const input=fixture('01-colors.chtheme');input.assets={static:asset('<svg xmlns="http://www.w3.org/2000/svg"><style>'+css+'</style><rect class="x" width="10" height="10"/></svg>')};input.background={asset:'static'};const {pack}=await Theme.validate(input);assert.equal(C.animatedSVG(pack.assets.static.svg),false);assert.equal(C.animatedSVG(pack.assets.static.still),false);
 }
 for(const css of ['.x{animation:move 2s linear infinite}','.x{animation-name:none,move}','@keyframes move{to{opacity:.5}}','.x{transition:opacity 1s}'])assert.equal(C.animatedSVG('<svg><style>'+css+'</style></svg>'),true);
 assert.equal(C.animatedSVG('<svg><animate attributeName="opacity" dur="1s"/></svg>'),true);
});

test('valid raster media validates in Node without DOM and the prepare seam receives actual verified bytes',async()=>{
 const value=fixture('01-colors.chtheme');value.assets={photo:asset(png,'image/png')};value.background={asset:'photo'};const result=await Theme.validate(value);assert.equal(result.media.length,1);assert.equal(result.media[0].asset.width,1);assert.equal(result.media[0].asset.height,1);assert.deepEqual(Buffer.from(await result.media[0].blob.arrayBuffer()),png);assert.equal(result.pack.assets.photo.data,value.assets.photo.data);
 const calls=[],prepared={asset:{mediaId:webcrypto.randomUUID(),name:'photo',type:'image/png',kind:'image',width:1,height:1,palette:[]},blob:new Blob([png],{type:'image/png'})};const seam=await Theme.validate(value,{media:{async prepare(blob,slot,name){calls.push({bytes:Buffer.from(await blob.arrayBuffer()),slot,name});return prepared;}}});assert.equal(seam.media[0],prepared);assert.equal(calls.length,1);assert.equal(calls[0].slot,'banner');assert.equal(calls[0].name,'photo');assert.deepEqual(calls[0].bytes,png);
 const bad=copy(value);bad.assets.photo=asset('not an image','image/png');await assert.rejects(()=>Theme.validate(bad),/PNG|container/);
});

test('theme frame, font license, icon count and every color mode have strict schemas',async()=>{
 const doc=fixture('02-svg.chtheme');doc.frames.card.slice=[1,-1,2];doc.icons=Array(7).fill('tile');doc.title={asset:'tile',family:'Title',weight:700,license:'closed',url:'https://example.invalid'};const errors=await Theme.problems(doc),message=errors.join('\n');for(const key of ['slice','icons','title.asset','title.license','title.url'])assert.ok(message.includes(key),message);
 const font=fixture('01-colors.chtheme');font.assets={font:asset('not WOFF2','font/woff2')};font.title={asset:'font',family:'Sample',weight:700,license:'OFL-1.1'};await assert.rejects(()=>Theme.validate(font),/WOFF2/);
});

test('WOFF2 validation rejects truncated directories, fake streams and malformed optional block declarations',async()=>{
 const real=fs.readFileSync(path.join(__dirname,'../extension/fonts/literata-latin.woff2')),info=await C.inspectFont(real);assert.ok(info.tables>0);assert.ok(info.compressedStart>=48);assert.ok(info.streamSize>0);
 const fake=Buffer.alloc(49);fake.write('wOF2');fake.writeUInt32BE(0x10000,4);fake.writeUInt32BE(fake.length,8);fake.writeUInt16BE(1,12);fake.writeUInt32BE(32,16);fake.writeUInt32BE(1,20);await assert.rejects(()=>C.inspectFont(fake),/WOFF2/);
 const truncated=Buffer.alloc(52);fake.copy(truncated);truncated.writeUInt32BE(truncated.length,8);truncated[49]=1;await assert.rejects(()=>C.inspectFont(truncated),/WOFF2.*Brotli/);
 for(const change of [b=>{b[49]=128;},b=>{b[48]=0xda;},b=>b.writeUInt32BE(b.readUInt32BE(16)+4,16),b=>b.writeUInt32BE(b.length,20),b=>{b.writeUInt32BE(b.length+4,28);b.writeUInt32BE(1,32);b.writeUInt32BE(1,36);},b=>b.writeUInt32BE(1,32),b=>{b.writeUInt32BE(info.compressedStart,40);b.writeUInt32BE(4,44);}]){const bad=Buffer.from(real);change(bad);await assert.rejects(()=>C.inspectFont(bad),/WOFF2/);}
 const corrupt=Buffer.from(real);corrupt.fill(0,info.compressedStart,info.compressedStart+info.compressedLength);await assert.rejects(()=>C.inspectFont(corrupt),/WOFF2.*Brotli/);
 const metadata=Buffer.concat([real,Buffer.from([0])]);metadata.writeUInt32BE(metadata.length,8);metadata.writeUInt32BE(real.length,28);metadata.writeUInt32BE(1,32);metadata.writeUInt32BE(1,36);await assert.rejects(()=>C.inspectFont(metadata),/WOFF2.*metadata.*Brotli/);
});

test('pet geometry, required poses, pose names and fallbacks follow the actual companion vocabulary',async()=>{
 const input=fixture('01-static.chpet'),{pack}=await Pet.validate(input);for(const name of Pet.poses)assert.ok(Pet.pose(pack,name)?.svg);assert.equal(Pet.pose(pack,'trot'),Pet.pose(pack,'walk'));assert.equal(Pet.pose(pack,'lie'),Pet.pose(pack,'sleep'));assert.equal(Pet.pose(pack,'held'),Pet.pose(pack,'stand'));
 input.size=[31,129];input.ground=200;input.faces='up';delete input.poses.walk;input.poses.fly='tile';const errors=(await Pet.problems(input)).join('\n');for(const field of ['size[0]','size[1]','ground','faces','poses.walk','poses.fly'])assert.ok(errors.includes(field),errors);
});

test('file imports enforce extension, UTF-8, encoded file size and immutable inputs',async()=>{
 const doc=fixture('01-colors.chtheme');await assert.rejects(()=>Theme.importPack({name:'x.chpet',size:10,text:async()=>JSON.stringify(doc)}),/extension/);await assert.rejects(()=>Theme.importPack({size:40000001,text:async()=>''}),/40000000/);const invalid=new Blob([Buffer.from([255])]);await assert.rejects(()=>Theme.importPack(invalid),/UTF-8/);await assert.rejects(()=>Theme.validate('{'),/malformed JSON/);
});

test('actual arrangement model is strict and unavailable optional modules are skipped during pure application',async()=>{
 const value=fixture('01-layout.chpreset'),{pack}=await Preset.validate(value),data={settings:{moduleSize:{clock:'l'}},tasks:{},customTasks:[]},before=copy(data),applied=Preset.apply(data,pack,{modules:[]});assert.deepEqual(data,before);assert.notEqual(applied,data);assert.doesNotMatch(JSON.stringify(applied.settings.workspaceLayout),/timer/);assert.equal(applied.settings.moduleSize.timer,undefined);assert.equal(applied.settings.moduleSize.clock,'l');
 const actual=Preset.apply(data,pack,{modules:['timer']});assert.match(JSON.stringify(actual.settings.workspaceLayout),/timer/);assert.equal(actual.settings.moduleSize.timer,'s');assert.ok(Preset.describe(pack).some(v=>v.includes('Focus timer')));
 const bad=copy(value);bad.data.workspaceLayout.children.push('work');await assert.rejects(()=>Preset.validate(bad),/workspaceLayout/);bad.data.workspaceLayout={axis:'x',children:['context','work','reader'],style:'wide'};await assert.rejects(()=>Preset.validate(bad),/workspaceLayout.style/);
});

test('Planner templates create actual local cards in the selected week without altering existing cards',async()=>{
 const {pack}=await Preset.validate(fixture('02-planner.chpreset')),data={settings:{},tasks:{'local-old':{notes:'keep'}},customTasks:[{id:'local-old',name:'Existing'}]},before=copy(data),out=Preset.apply(data,pack,{week:'2026-10-21'});assert.deepEqual(data,before);assert.equal(out.customTasks.length,3);const monday=out.customTasks.find(v=>v.name==='Review notes');assert.ok(monday.id.startsWith('local-'));assert.equal(out.tasks[monday.id].plannedDate,'2026-10-19');assert.equal(out.tasks[monday.id].estimate,30);assert.equal(out.tasks[monday.id].notes,'At 19:00');assert.equal(out.customTasks.find(v=>v.name==='Write outline').courseId,'personal');assert.deepEqual(out.tasks['local-old'],before.tasks['local-old']);assert.equal(Preset.apply(out,pack,{week:'2026-10-21'}).customTasks.length,5);assert.throws(()=>Preset.apply(data,pack,{week:'2026-02-30'}),/valid/);assert.throws(()=>Preset.apply(data,pack),/week/);
 const bad=preset('planner',{days:{mon:[{title:'',minutes:9,at:'25:00',code:'bad'}],funday:[]}}),message=(await Preset.problems(bad)).join('\n');for(const field of ['funday','title','minutes','at','code'])assert.ok(message.includes(field),message);
});

test('routine presets use Biscuit parsing, preserve local learning and respect injected creation time and zone',async()=>{
 const now=Date.parse('2026-10-21T16:00:00Z'),value=preset('routines',{lines:['every sunday at 7pm plan my week','every weekday at 4pm focus 25 minutes']}),{pack}=await Preset.validate(value),data={settings:{timeZone:'America/New_York'},pet:{name:'Biscuit',xp:99,brain:{kinds:{}}}},before=copy(data),out=Preset.apply(data,pack,{now});assert.deepEqual(data,before);assert.equal(out.pet.xp,99);assert.equal(out.pet.name,'Biscuit');assert.equal(out.pet.routines[0].minute,1140);assert.deepEqual(out.pet.routines[0].days,[0]);assert.equal(out.pet.routines[0].createdAt,now);assert.equal(out.pet.routines[0].action,'plan');assert.equal(out.pet.routines[0].data.mode,'week');assert.equal(out.pet.routines[1].data.minutes,25);
 const twenty=preset('routines',{lines:Array.from({length:20},(_,i)=>'every day at 8am remind me to review '+i)});await Preset.validate(twenty);assert.equal(Preset.apply(data,twenty,{now:()=>now,timeZone:'UTC'}).pet.routines.length,20);await assert.rejects(()=>Preset.validate(preset('routines',{lines:Array(21).fill('every day focus')})),/20/);await assert.rejects(()=>Preset.validate(preset('routines',{lines:['fetch an external script']})),/Biscuit/);
});

test('settings validate model enums, preserve pet learning and clear the active custom theme for scene changes',async()=>{
 const value=preset('settings',{pageTint:'sage',courseNavigation:'dock',dockSize:'large',courseCardStyle:'minimal',bannerSize:'compact',showCourseIcons:false,pet:{coat:'ink',harness:'iris'},sceneTheme:'sea'}),{pack}=await Preset.validate(value),data={settings:{theme:'dark',makeYourOwn:{theme:{id:'custom'},installed:{}}},pet:{name:'Biscuit',brain:{kept:true},xp:100}},before=copy(data),out=Preset.apply(data,pack);assert.deepEqual(data,before);assert.equal(out.settings.theme,'dark');assert.equal(out.settings.makeYourOwn.theme,null);assert.equal(out.pet.coat,'ink');assert.equal(out.pet.harness,'iris');assert.deepEqual(out.pet.brain,{kept:true});assert.ok(Preset.describe(pack).includes('Pet coat: ink'));
 const bad=preset('settings',{dockSize:'huge',courseCardStyle:'other',pet:{coat:'unknown',harness:'unknown',xp:999},execute:'no'}),message=(await Preset.problems(bad)).join('\n');for(const field of ['dockSize','courseCardStyle','pet.coat','pet.harness','pet.xp','execute'])assert.ok(message.includes(field),message);
});
