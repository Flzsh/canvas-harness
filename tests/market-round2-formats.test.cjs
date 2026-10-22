'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const Theme=require('../extension/theme-pack.js'),Pet=require('../extension/pet-pack.js'),Engine=require('../extension/pets.js'),C=require('../extension/pack-common.js'),checker=require('../scripts/check-pack.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/make-your-own',name),'utf8')),asset=(b,type)=>({type,data:Buffer.from(b).toString('base64'),sha256:createHash('sha256').update(b).digest('hex')});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'),gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
const animatedGIF=Buffer.concat([gif.subarray(0,-1),gif.subarray(19,-1),Buffer.from([59])]);
const chunk=(tag,b)=>{const n=Buffer.alloc(4);n.writeUInt32LE(b.length);return Buffer.concat([Buffer.from(tag),n,b,Buffer.alloc(b.length%2)]);},riff=b=>{const n=Buffer.alloc(4);n.writeUInt32LE(b.length+4);return Buffer.concat([Buffer.from('RIFF'),n,Buffer.from('WEBP'),b]);};
const webp=riff(chunk('VP8 ',Buffer.from([0x30,1,0,0x9d,1,0x2a,1,0,1,0]))),animatedWebp=riff(Buffer.concat([chunk('VP8X',Buffer.from([2,0,0,0,0,0,0,0,0,0])),chunk('ANIM',Buffer.alloc(6)),chunk('ANMF',Buffer.concat([Buffer.alloc(16),webp.subarray(12)]))]));
function pet(bytes=gif,type='image/gif'){const p=read('01-static.chpet');p.assets={tile:asset(bytes,type)};return p;}
test('accent contrast names the surface pair and measured ratio in every palette',async()=>{
 for(const mode of ['light','dark']){const p=read('01-colors.chtheme');p.colors[mode].accent=p.colors[mode].surface;await assert.rejects(()=>Theme.validate(p),new RegExp('colors\\.'+mode+'\\.accent.*colors\\.'+mode+'\\.surface.*1\\.00:1.*3:1'));}
});
test('every GIF and animated WebP theme needs a static still in either position',async()=>{
 for(const [bytes,type]of [[gif,'image/gif'],[animatedGIF,'image/gif'],[animatedWebp,'image/webp']])for(const key of ['background','banner']){const p=read('01-colors.chtheme');p.assets={moving:asset(bytes,type)};p[key]={asset:'moving'};await assert.rejects(()=>Theme.validate(p),new RegExp(key+'\\.still'));p.assets.still=asset(png,'image/png');p[key].still='still';await Theme.validate(p);}
 for(const key of ['background','banner']){const p=read('01-colors.chtheme');p.assets={static:asset(webp,'image/webp')};p[key]={asset:'static'};await Theme.validate(p);}
});
test('theme and pet reject unused assets and missing references with useful paths',async()=>{
 for(const [api,p]of [[Theme,read('02-svg.chtheme')],[Pet,read('01-static.chpet')]]){p.assets.unused=p.assets.tile;await assert.rejects(()=>api.validate(p),/assets\.unused is not used/);delete p.assets.unused;delete p.assets.tile;await assert.rejects(()=>api.validate(p),/missing asset tile/);}
});
test('raster pets preserve their original animation and use stand first frame with reduced motion',async()=>{
 for(const [b,type]of [[png,'image/png'],[webp,'image/webp'],[gif,'image/gif'],[animatedGIF,'image/gif'],[animatedWebp,'image/webp']]){const p=pet(b,type),{pack}=await Pet.validate(p);assert.deepEqual(Pet.portable(pack),p);const drawing=Engine.customDrawing(pack,'walk');assert.equal(drawing.src,'data:'+type+';base64,'+p.assets.tile.data);assert.equal(drawing.width,p.size[0]);const still=Engine.customDrawing(pack,'walk','right',true);if(C.inspectMedia(b,type).animated){assert.equal(still.pose,'stand');assert.notEqual(still.src,drawing.src);assert.equal(C.inspectMedia(Buffer.from(still.src.split(',')[1],'base64'),type).animated,false);}else assert.equal(still.src,drawing.src);}
 const p=pet(animatedGIF),svg=read('01-static.chpet').assets.tile;p.assets.stand=svg;p.poses.stand='stand';const {pack}=await Pet.validate(p);assert.match(Engine.customDrawing(pack,'walk','right',true).src,/^data:image\/svg\+xml/);assert.equal(Engine.customDrawing(pack,'walk','right',true).pose,'stand');
});
test('pet raster bounds are 2 MiB and four times each size dimension',async()=>{
 const p=pet(png,'image/png');p.assets.tile=asset(Buffer.concat([png,Buffer.alloc(2*1024*1024-png.length+1)]),'image/png');await assert.rejects(()=>Pet.validate(p),/2097152|2 MiB/);
 const padding=Buffer.alloc(2097152-png.length);padding.writeUInt32BE(padding.length-12);padding.write('paDd',4);await Pet.validate(pet(Buffer.concat([png.subarray(0,-12),padding,png.subarray(-12)]),'image/png'));
 const edge=Buffer.from(png);edge.writeUInt32BE(288,16);edge.writeUInt32BE(256,20);await Pet.validate(pet(edge,'image/png'));
 for(const [w,h]of [[289,1],[1,257]]){const b=Buffer.from(png);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);await assert.rejects(()=>Pet.validate(pet(b,'image/png')),/4.*size|dimensions/);}
 for(const field of ['size','ground']){const p=pet();if(field==='size')p.size[0]=64.5;else p.ground=.5;await assert.rejects(()=>Pet.validate(p),/integer/);}
});
test('offset animated WebP stand stills keep the full drawing box and contain only a static frame',async()=>{
 const extended=Buffer.from([2,0,0,0,3,0,0,3,0,0]),frame=Buffer.alloc(16);frame[0]=1;frame[3]=1;
 const b=riff(Buffer.concat([chunk('VP8X',extended),chunk('ANIM',Buffer.from([0,0,255,255,0,0])),chunk('ANMF',Buffer.concat([frame,webp.subarray(12)]))])),{pack}=await Pet.validate(pet(b,'image/webp')),url=Engine.customDrawing(pack,'walk','right',true).src;
 const svg=decodeURIComponent(url.split(',')[1]);assert.match(svg,/viewBox="0 0 4 4"/);assert.match(svg,/<image x="2" y="2" width="1" height="1"/);const data=/href="data:image\/webp;base64,([^"]+)"/.exec(svg)[1];assert.equal(C.inspectMedia(Buffer.from(data,'base64'),'image/webp').animated,false);
 frame[0]=2;const bad=riff(Buffer.concat([chunk('VP8X',extended),chunk('ANMF',Buffer.concat([frame,webp.subarray(12)]))]));await assert.rejects(()=>Pet.validate(pet(bad,'image/webp')),/first frame exceeds|frame exceeds its picture/);
});
test('WebP replacement frames clear the background inside their rectangle',async()=>{
 const extended=Buffer.from([18,0,0,0,3,0,0,3,0,0]),frame=Buffer.alloc(16);frame[0]=1;frame[3]=1;frame[15]=2;
 const b=riff(Buffer.concat([chunk('VP8X',extended),chunk('ANIM',Buffer.from([0,0,255,255,0,0])),chunk('ANMF',Buffer.concat([frame,chunk('ALPH',Buffer.from([0,0])),webp.subarray(12)]))])),{pack}=await Pet.validate(pet(b,'image/webp')),svg=decodeURIComponent(Engine.customDrawing(pack,'stand','right',true).src.split(',')[1]);
 assert.match(svg,/<path[^>]+fill-rule="evenodd"/);assert.match(svg,/M2 2h1v1h-1z/);assert.doesNotMatch(svg,/<rect width="100%" height="100%"/);
 const full=Buffer.alloc(16);full[15]=2;const bytes=riff(Buffer.concat([chunk('VP8X',Buffer.from([18,0,0,0,0,0,0,0,0,0])),chunk('ANIM',Buffer.from([0,0,255,255,0,0])),chunk('ANMF',Buffer.concat([full,chunk('ALPH',Buffer.from([0,0])),webp.subarray(12)]))])),result=await Pet.validate(pet(bytes,'image/webp'));assert.match(Engine.customDrawing(result.pack,'stand','right',true).src,/^data:image\/webp;base64,/);
});
test('APNG stand stills use the first animation frame when the default image is excluded',async()=>{
 const {pack}=await Pet.validate(read('04-animated-png.chpet')),still=Engine.customDrawing(pack,'walk','right',true);
 assert.equal(still.pose,'stand');assert.deepEqual(Buffer.from(still.src.split(',')[1],'base64'),png);
 const b=Buffer.from(read('04-animated-png.chpet').assets.tile.data,'base64'),chunks={};for(let at=8;at<b.length;){const end=at+b.readUInt32BE(at)+12;chunks[b.toString('ascii',at+4,at+8)]=b.subarray(at,end);at=end;}const included=Buffer.concat([png.subarray(0,33),chunks.acTL,chunks.fcTL,png.subarray(33)]),result=await Pet.validate(pet(included,'image/png'));assert.deepEqual(Buffer.from(Engine.customDrawing(result.pack,'stand','right',true).src.split(',')[1],'base64'),png);
 const empty=await Pet.validate(read('05-animated-png-empty.chpet'));assert.deepEqual(Buffer.from(Engine.customDrawing(empty.pack,'stand','right',true).src.split(',')[1],'base64'),png);
});
test('format guides constrain names, asset IDs, title fonts and background/banner geometry',async()=>{
 let p=read('01-colors.chtheme');p.name='x'.repeat(41);await assert.rejects(()=>Theme.validate(p),/name/);
 p=read('02-svg.chtheme');p.assets['bad id']=p.assets.tile;p.icons.push('bad id');await assert.rejects(()=>Theme.validate(p),/asset ID/);
 p=read('01-colors.chtheme');p.assets={icon:asset(gif,'image/gif')};p.icons=['icon'];await assert.rejects(()=>Theme.validate(p),/icons.*unsupported asset type/);
 p=read('02-svg.chtheme');p.background={asset:'tile',fit:'tile',position:'top'};await Theme.validate(p);p.background.position='left';await assert.rejects(()=>Theme.validate(p),/background.position/);delete p.background;p.banner.position='top';await assert.rejects(()=>Theme.validate(p),/banner.position/);
 p=read('01-colors.chtheme');p.assets={font:asset(fs.readFileSync(path.join(__dirname,'../extension/fonts/literata-latin.woff2')),'font/woff2')};p.title={asset:'font',family:'Title',weight:99,license:'OFL-1.1'};await assert.rejects(()=>Theme.validate(p),/title.weight/);p.title.weight=900;await Theme.validate(p);
});
test('raster pet previews expose moving poses and static reduced-motion stand images',async()=>{
 const p=pet(animatedGIF),result=await checker.validate(p),html=checker.preview(result);assert.match(html,/data:image\/gif;base64,/);assert.match(html,/<source media="\(prefers-reduced-motion: reduce\)"/);const stand=Engine.customDrawing(result.pack,'stand','right',true);assert.ok(html.includes(stand.src));
 const ui=require('../extension/make-your-own.js').preview(result.pack);assert.match(ui,/<source media="\(prefers-reduced-motion: reduce\)"/);assert.ok(ui.includes(stand.src));
});
test('shipped checker rejects invalid round-two fixtures with the extension diagnostics',async()=>{
 const bundled=new Function('require','module','exports',require('../scripts/skill-check.cjs').bundle()),mod={exports:{}};bundled(require,mod,mod.exports);
 for(const [name,message]of [['accent.chtheme',/accent.*surface/],['gif-still.chtheme',/background.still/],['unused.chpet',/assets.unused is not used/],['missing.chpet',/missing asset tile/]]){const source=fs.readFileSync(path.join(__dirname,'fixtures/make-your-own/invalid',name),'utf8');await assert.rejects(()=>mod.exports.validate(source),message);}
 for(const name of ['03-raster.chpet','03-gif.chtheme'])await mod.exports.validate(read(name));
});
