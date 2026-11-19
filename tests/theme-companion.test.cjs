'use strict';
// A theme pack may carry a companion, the band's abilities reach the Market page, and the checker reports the band.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),{webcrypto,createHash}=require('node:crypto');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),plain=v=>JSON.parse(JSON.stringify(v)),owner={origin:'https://school.instructure.com',accountId:'7'};
const svg='<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24"/></svg>',wire=(type,value)=>{const bytes=Buffer.from(value);return {type,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')};};
const pet=name=>({format:'chpet',version:1,name,size:[64,64],ground:60,faces:'right',poses:{stand:'body',walk:'body',sleep:'body'},assets:{body:wire('image/svg+xml',svg)}});
const colors={light:{bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#444444',line:'#cccccc',accent:'#0055aa'}};
const theme=(name,extra={})=>({format:'chtheme',version:1,name,colors,...extra});
const file=doc=>{const source=JSON.stringify(doc);return {name:'local.'+doc.format,size:Buffer.byteLength(source),text:async()=>source};};
// A real PNG of one flat colour, so the checker can measure what sits behind the greeting.
function png(w,h,[r,g,b]){
 const chunk=(tag,body)=>{const head=Buffer.alloc(4);head.writeUInt32BE(body.length);const data=Buffer.concat([Buffer.from(tag,'latin1'),body]),crc=Buffer.alloc(4);crc.writeUInt32BE(zlib.crc32(data)>>>0);return Buffer.concat([head,data,crc]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;const row=Buffer.alloc(1+w*3);for(let x=0;x<w;x++){row[1+x*3]=r;row[2+x*3]=g;row[3+x*3]=b;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(Array.from({length:h},()=>row)))),chunk('IEND',Buffer.alloc(0))]);
}
function harness(){
 const h=require('./market-pack-fixture.cjs').harness();
 return {env:h.env,api:h.api,art:h.env.ReservePetArt,store:h.store};
}
const unwrap=row=>row?.colors?row:row?.pack;

test('a theme keeps its companion through install, and it walks only while that theme is the one in use',async()=>{
 const h=harness();await h.store.load();
 const row=await h.api.installLocal(file(theme('Harbour',{companion:pet('Gull')})),{store:h.store}),saved=unwrap(await h.api.readLocal(row.id,{store:h.store}));
 assert.equal(saved.companion?.format,'chpet');assert.equal(saved.companion.name,'Gull');assert.ok(saved.companion.assets.body);
 const A=h.art,settings=h.store.get().settings,gift=A.themePack(row.id,saved.companion);assert.equal(gift,saved.companion);assert.equal(settings.makeYourOwn.theme.id,row.id);
 const on=A.identity({pet:{name:'Biscuit'},settings},gift);
 assert.equal(on.pack,gift,'the theme in use dresses Biscuit');assert.equal(on.kind,'pony');assert.equal(on.custom,false);assert.equal(on.id,null);assert.equal(on.name,'Biscuit');
 // A scene on top, another theme, or no theme: the companion is not shown.
 assert.equal(A.identity({pet:{},settings:{...plain(settings),sceneTheme:'sea'}},gift).pack,null);
 assert.equal(A.identity({pet:{},settings:{...plain(settings),makeYourOwn:{...plain(settings.makeYourOwn),theme:{id:'another',name:'Other'}}}},gift).pack,null);
 assert.equal(A.identity({pet:{},settings:{...plain(settings),makeYourOwn:{...plain(settings.makeYourOwn),theme:null}}},gift).pack,null);
 assert.equal(A.identity({pet:{}},gift).pack,null,'never outside an account');
 // A companion the student chose themselves wins.
 const mine=await h.api.installLocal(file(pet('Mine')),{store:h.store}),after=h.store.get().settings;
 if(after.makeYourOwn.pet?.id===mine.id){const chosen=A.identity({pet:{},settings:after},gift);assert.equal(chosen.id,mine.id);assert.notEqual(chosen.pack,gift);}
 // Removing the theme removes its companion with it.
 await h.api.removeLocal(row.id,{store:h.store});assert.equal(A.identity({pet:{},settings:h.store.get().settings},gift).pack,null);
 assert.equal(A.themePack('',gift),null);assert.equal(A.themePack(row.id,{format:'chtheme'}),null);assert.equal(A.themePack(row.id,null),null);
});

test('a companion that does not pass is left out and the theme still installs; the same file passes the portable round trip',async()=>{
 const h=harness();await h.store.load();
 const bad=await h.api.installLocal(file(theme('Plain',{companion:{format:'chpet',version:1,name:'Broken'}})),{store:h.store});assert.equal(unwrap(await h.api.readLocal(bad.id,{store:h.store})).companion,undefined);
 const good=await h.env.ReserveThemePack.validate(JSON.stringify(theme('Round',{companion:pet('Gull')}))),again=await h.env.ReserveThemePack.validate(JSON.stringify(h.env.ReserveThemePack.portable(good.pack)));
 assert.equal(again.pack.companion.name,'Gull');
});

test('the Market page is told what the band can do, as an object, and nothing when the worker has no band',async()=>{
 const K=require('../extension/band-kit.js'),abilities=K.capabilities();
 assert.equal(abilities.level,2);for(const key of ['draw','at','count','move','when','look','fit','edge','recipes'])assert.ok(Array.isArray(abilities[key])&&abilities[key].length,key);assert.equal(abilities.companion,true);
 assert.deepEqual(plain(abilities),JSON.parse(JSON.stringify(abilities)));
 const worker=read('market-worker.js').replace(/\n\s*/g,''),bridge=read('market-bridge.js').replace(/\n\s*/g,'');
 assert.match(worker,/market-installed'\)\{[^\n]*root\.ReserveBandKit\?\.capabilities\?\{band:root\.ReserveBandKit\.capabilities\(\)\}:\{\}/);
 assert.match(bridge,/Number\.isInteger\(reply\.band\.level\)[^\n]*\.\.\.\(band\?\{band\}:\{\}\)/);
});

test('the checker reports the level, what an older level cannot use, every note, a cut keep box and low contrast',async()=>{
 const Check=require('../scripts/check-pack.cjs'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch-band-')),run=async doc=>{const target=path.join(dir,'t.chtheme');fs.writeFileSync(target,JSON.stringify(doc));const out=[],err=[];const code=await Check.main([target],{out:line=>out.push(String(line)),error:line=>err.push(String(line))});return {code,out:out.join('\n'),err:err.join('\n')};};
 try{
  const asset=(buffer,type='image/png')=>({type,data:buffer.toString('base64'),sha256:createHash('sha256').update(buffer).digest('hex')});
  // White words-ground behind dark ink is fine; a white picture behind forced light words is not.
  const pale=asset(png(1600,900,[250,250,250])),old=await run(theme('Old',{band:{asset:'sky'},assets:{sky:pale}}));
  assert.equal(old.code,0,old.err);assert.match(old.out,/Band level needed: 1 /);assert.doesNotMatch(old.out,/cannot use/);assert.doesNotMatch(old.err,/low contrast/);assert.match(old.err,/not band shaped/);
  const next=await run(theme('Next',{minBand:2,band:{asset:'sky',keep:{x:.1,y:.05,w:.8,h:.9},text:'light',pieces:[{use:'snow'},{use:'from-the-future'},{draw:'star',move:['twinkle'],sparkle:9}],glow:true},assets:{sky:pale},companion:pet('Gull')}));
  assert.equal(next.code,0,next.err);assert.match(next.out,/Band level needed: 2 /);assert.match(next.out,/a version at band level 1 cannot use: /);assert.match(next.out,/Companion: Gull/);
  assert.match(next.err,/NOTE: \$\.band\.pieces\[1\]/);assert.match(next.err,/NOTE: \$\.band\.glow/);assert.match(next.err,/keep box is cut at [^\n]*1366x768/);assert.match(next.err,/low contrast at [^\n]*1366x768/);assert.doesNotMatch(next.err,/not band shaped/);
  const calm=await run(theme('Calm',{band:{asset:'sky',text:'auto'},assets:{sky:pale}}));assert.doesNotMatch(calm.err,/low contrast|not measured/);
  const held=await run(theme('Later',{minBand:9,band:{asset:'sky'},assets:{sky:pale}}));assert.equal(held.code,0,held.err);assert.match(held.out,/Band: left out here/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
