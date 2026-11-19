'use strict';
// The band kit (band-kit.js reads and fits, band-pieces.js draws, data-theme.js places): a band is a picture plus an
// ordered list of pieces, each one built from small blocks. The reader is tolerant: what it does not know is left out
// and noted, the theme still installs, and a band written for the first version renders exactly as it did.
const {test,after}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{createHash}=require('node:crypto');
const {createDOM,read}=require('./addons-fixture.cjs');
const before=new Set(Object.keys(globalThis));after(()=>{for(const key of Object.keys(globalThis))if(!before.has(key)&&key.startsWith('Reserve'))delete globalThis[key];});
const Theme=require('../extension/theme-pack.js'),Frame=require('../extension/media-frame.js'),K=require('../extension/band-kit.js'),Pieces=require('../extension/band-pieces.js');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'),gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
const zlib=require('node:zlib');let shade=0;
// a new, different 1x1 picture each time
const pic=()=>{const chunk=(tag,body)=>{const head=Buffer.alloc(4);head.writeUInt32BE(body.length);const data=Buffer.concat([Buffer.from(tag),body]),sum=Buffer.alloc(4);sum.writeUInt32BE(zlib.crc32(data)>>>0);return Buffer.concat([head,data,sum]);};return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',Buffer.from([0,0,0,1,0,0,0,1,8,0,0,0,0])),chunk('IDAT',zlib.deflateSync(Buffer.from([0,++shade%256]))),chunk('IEND',Buffer.alloc(0))]);};
const hash=value=>createHash('sha256').update(value).digest('hex'),wire=(data,type)=>({type,data:Buffer.from(data).toString('base64'),sha256:hash(data)});
function movie(width=4096,height=512,duration=12){
 const be=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;},box=(tag,...parts)=>{const body=Buffer.concat(parts);return Buffer.concat([be(body.length+8),Buffer.from(tag),body]);};
 const timing=Buffer.alloc(100);timing.writeUInt32BE(1000,12);timing.writeUInt32BE(duration*1000,16);const track=Buffer.alloc(84);track.writeUInt32BE(width*65536,76);track.writeUInt32BE(height*65536,80);const handler=Buffer.alloc(24);handler.write('vide',8);
 return Buffer.concat([box('ftyp',Buffer.from('isom'),be(0),Buffer.from('isom')),box('moov',box('mvhd',timing),box('trak',box('tkhd',track),box('mdia',box('hdlr',handler)))),box('mdat',Buffer.from([1]))]);
}
const palette={light:{bg:'#faf6ee',surface:'#fffcf6',ink:'#2b2420',muted:'#5f554c',line:'#e3d8c6',accent:'#9c3f2a'},dark:{bg:'#22201e',surface:'#2d2a27',ink:'#f1ebe2',muted:'#c2b8ab',line:'#45403a',accent:'#f0a58a'}};
const theme=(value={})=>({format:'chtheme',version:1,name:'Band',colors:palette,...value});
const imageBand=(band={},assets={})=>theme({band:{asset:'sky',...band},assets:{sky:wire(png,'image/png'),...assets}});
// a 16:9 picture (a video with its still, so the size is known without decoding)
const tallBand=(band={},assets={})=>theme({band:{asset:'clip',stillAsset:'still',loop:{start:0,end:12},...band},assets:{clip:wire(movie(1600,900),'video/mp4'),still:wire(png,'image/png'),...assets}});
const hooks={picture:value=>({asset:value.asset}),image:id=>id==='leaf'};
const paths=(notes,kind)=>notes.filter(note=>!kind||note.kind===kind).map(note=>note.path);
const svg='<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24"/></svg>',pet=name=>({format:'chpet',version:1,name,size:[64,64],ground:60,faces:'right',poses:{stand:'body',walk:'body',sleep:'body'},assets:{body:wire(svg,'image/svg+xml')}});

// ---------------------------------------------------------------- the reader
test('what the reader does not know is left out and noted; a piece with an invented block is skipped, the rest stays',()=>{
 const raw={asset:'a',hologram:{depth:3},edge:'wormhole',text:'neon',pieces:[{use:'snow'},{draw:'plasma-ribbon-9000',move:['fall']},'petals',{use:'no-such-recipe'},{draw:'leaf',move:[{type:'teleport'}]},{type:'leaves'},{draw:{asset:'leaf'},at:{x:.5,y:.5}},{draw:{asset:'gone'}},{draw:'leaf',when:{time:'brunch'}},{draw:'leaf',move:['fall',{type:'sway',amount:99999}],count:99999}]};
 const seen=K.clean(raw,hooks);
 assert.equal(seen.band.pieces.length,5,'snow, petals, leaves, the pack picture and the clamped leaf');assert.equal(seen.needs.level,2);
 assert.deepEqual(paths(seen.notes,'ignored'),['$.band.hologram']);
 assert.deepEqual(paths(seen.notes,'skipped'),['$.band.pieces[1].draw','$.band.pieces[3].use','$.band.pieces[4].move','$.band.pieces[7].draw','$.band.pieces[8].when']);
 assert.deepEqual(paths(seen.notes,'fallback').sort(),['$.band.edge','$.band.text']);
 assert.deepEqual(paths(seen.notes,'clamped').sort(),['$.band.pieces[9].count','$.band.pieces[9].move[1].amount']);
 assert.equal(Object.hasOwn(seen.band,'hologram'),false);assert.equal(Object.hasOwn(seen.band,'text'),false);
 // the creator's own words are kept for the round trip, without the keys nobody reads
 assert.equal(seen.source.pieces.length,10);assert.deepEqual(seen.source.pieces[1],raw.pieces[1]);assert.equal(Object.hasOwn(seen.source,'hologram'),false);
 // a picture alone is still level 1, and needs nothing
 const plainBand=K.clean({asset:'a',focus:{x:.5,y:.5}},hooks);assert.equal(plainBand.needs.level,1);assert.deepEqual(plainBand.needs.uses,[]);assert.deepEqual(plainBand.notes,[]);
 // the old short spellings: a name, {type}, and "effects"
 const sugar=K.clean({asset:'a',effects:[{type:'snow'}],pieces:['petals',{type:'leaves'}]},hooks);assert.deepEqual(sugar.notes,[]);assert.equal(sugar.band.pieces.length,3);
});

test('recipes are data: a recipe with overrides, a pack\'s own recipe, a group placed with a point, numbers kept in range',()=>{
 const seen=K.clean({asset:'a',recipes:{camp:[{draw:'lantern',at:{x:.1,y:.5},move:['swing']},{draw:'glow',at:{x:.1,y:.55}}],mysnow:{use:'snow',density:.2}},pieces:[{use:'camp',at:{x:.7,y:.4},scale:.5},{use:'mysnow',color:'accent'},{use:'snow',density:5000,size:-4}]},hooks);
 const [lamp,glow,mine,heavy]=seen.band.pieces;assert.equal(seen.band.pieces.length,4);
 assert.deepEqual(lamp.draw,[{kind:'shape',name:'lantern'}]);assert.deepEqual(lamp.at,{type:'point',x:.05,y:.25,rel:true,o:{x:.7,y:.4}});assert.equal(lamp.scale,.5);
 assert.deepEqual(glow.draw,[{kind:'light',name:'glow'}]);assert.deepEqual(glow.at.o,{x:.7,y:.4});
 assert.equal(mine.density,.2);assert.deepEqual(mine.color,['accent']);assert.deepEqual(mine.draw,[{kind:'shape',name:'flake'}]);
 assert.equal(heavy.density,60);assert.deepEqual(heavy.size,[.002,.002]);assert.deepEqual(paths(seen.notes,'clamped'),['$.band.pieces[2].density','$.band.pieces[2].size']);
 // every built-in recipe is made of blocks this version knows, and is listed in what the version says it can do
 const can=K.capabilities();for(const name of Object.keys(K.recipes)){const one=K.clean({asset:'a',pieces:[{use:name}]},hooks);assert.deepEqual(one.notes,[],name);assert.ok(one.band.pieces.length>=1,name);assert.ok(can.recipes.includes(name),name);}
 assert.equal(can.level,2);assert.equal(can.companion,true);for(const slot of ['draw','at','count','move','when','look','fit','edge','recipes'])assert.ok(Array.isArray(can[slot])&&can[slot].length>0,slot);
 for(const name of ['flake','glow','wash','image'])assert.ok(can.draw.includes(name),name);for(const name of ['hours','fade','times','months','days','weeks','mode'])assert.ok(can.when.includes(name),name);
 assert.deepEqual(JSON.parse(JSON.stringify(can)),can,'plain data, safe to hand to a page');
});

test('what an older version would leave out is named block by block',()=>{
 const seen=K.clean({asset:'a',keep:{x:.2,y:.2,w:.5,h:.5},pieces:[{use:'snow'},{use:'fireflies',when:{hours:[20,5],fade:20}}]},hooks);
 assert.equal(seen.needs.level,2);const lost=K.older(seen.needs,1);for(const name of ['keep','pieces','recipe:snow','recipe:fireflies','when:hours','when:fade','draw:flake','move:fall'])assert.ok(lost.includes(name),name);
 assert.deepEqual(K.older(seen.needs,2),[]);
});

// ---------------------------------------------------------------- the day
test('hours may wrap midnight and fade in and out; clock strings, a pack\'s own times, and an unknown time name',()=>{
 const night={hours:[22,2],fade:30};
 assert.deepEqual([12,21.75,22,23.5,1.9,16].map(hour=>K.presence(night,{hour})),[0,.5,1,1,1,0]);assert.ok(Math.abs(K.presence(night,{hour:2.2})-.59375)<1e-9);
 const seen=K.clean({asset:'a',times:{tea:['15:00','17:00'],bad:'x'},pieces:[{use:'snow',when:{hours:['21:30','06:15'],fade:45}},{use:'rain',when:{time:'night'}},{use:'rain',when:{time:'brunch'}},{use:'petals',when:{time:'tea'}},{use:'fireflies',variants:[{when:{time:'night'},opacity:1},{when:{time:'nope'},opacity:.2}]}]},hooks);
 assert.equal(seen.band.pieces.length,4,'the piece that names an unknown time is left out');
 assert.deepEqual(paths(seen.notes,'skipped').sort(),['$.band.pieces[2].when','$.band.pieces[4].variants[1]','$.band.times.bad']);
 assert.deepEqual(seen.band.pieces[0].when,{hours:[21.5,6.25],fade:45});assert.deepEqual(seen.band.pieces[2].when.spans,[[15,17]]);
 assert.equal(K.timed(seen.band),true);assert.equal(K.timed(K.clean({asset:'a',pieces:[{use:'snow'}]},hooks).band),false);
 for(const name of ['when:hours','when:fade','times','piece variants'])assert.ok(seen.needs.uses.includes(name),name);
 const names=hour=>K.resolve(seen.band,{mode:'light',hour,month:6,ratio:5}).pieces.map(piece=>piece.draw[0].name);
 assert.deepEqual(names(16),['petal','glow'],'tea time: petals, and the fireflies that have no hours of their own');
 assert.deepEqual(names(23),['flake','drop','glow']);assert.deepEqual(names(3),['flake','drop','glow'],'past midnight the night goes on');assert.deepEqual(names(12),['glow']);
 // half way through a fade the piece is there at half strength
 const half=K.resolve(K.clean({asset:'a',pieces:[{use:'snow',when:night}]},hooks).band,{mode:'light',hour:21.75,ratio:5}).pieces;assert.equal(half.length,1);assert.equal(half[0].presence,.5);
});

test('variants pick the picture by month, width and mode; the first match wins',()=>{
 const seen=K.clean({asset:'day',narrow:{asset:'tall'},dark:{asset:'night',focus:{x:.2,y:.2}},variants:[{when:{months:[12,1,2]},asset:'winter'},{when:{months:[1]},asset:'january'},{when:{season:'monsoon'},asset:'never'}]},hooks);
 assert.deepEqual(paths(seen.notes,'skipped'),['$.band.variants[2].when']);assert.equal(seen.band.variants.length,2);
 const pick=env=>K.resolve(seen.band,{mode:'light',ratio:5,month:6,...env});
 assert.equal(pick({}).asset,'day');assert.equal(pick({month:1}).asset,'winter');assert.equal(pick({mode:'dark'}).asset,'night');assert.deepEqual(pick({mode:'dark'}).focus,{x:.2,y:.2});
 assert.equal(pick({ratio:2}).asset,'tall');assert.equal(pick({ratio:2}).narrowOn,true);assert.equal(pick({ratio:4.2}).asset,'day','4:1 is the default switch');
});

// ---------------------------------------------------------------- fitting
test('a keep box always fits; a band-shaped picture covers; a tall picture gets a default box',()=>{
 const art={w:1600,h:900},view={w:1366,h:304},keep={x:.3,y:.2,w:.4,h:.6},f=K.fit(art,view,{focus:{x:.5,y:.5},keep}),cover=Math.max(view.w/art.w,view.h/art.h);
 assert.ok(f.scale<cover);assert.ok(f.kept>.99);assert.ok(f.gap.left>1&&f.gap.right>1);
 // the box is inside the band: left edge, right edge, top and bottom
 const box={l:f.x+keep.x*f.w,r:f.x+(keep.x+keep.w)*f.w,t:f.y+keep.y*f.h,b:f.y+(keep.y+keep.h)*f.h};assert.ok(box.l>=-.5&&box.r<=view.w+.5&&box.t>=-.5&&box.b<=view.h+.5,JSON.stringify(box));
 for(const size of K.sizes){const g=K.fit(art,{w:size.w,h:size.h},{focus:{x:.5,y:.5},keep});assert.ok(g.kept>.75,size.name+' '+g.kept);}   // never below half of the filling size, so a tall box may lose a little on the widest window
 const wide=K.fit({w:4096,h:512},view,{focus:{x:1,y:.5}});assert.deepEqual([wide.gap.left,wide.gap.right,wide.gap.top,wide.gap.bottom].map(Math.round),[0,0,0,0]);
 assert.equal(K.autoKeep({w:4096,h:512}),null);assert.equal(K.autoKeep({w:1,h:1}),null);const auto=K.autoKeep(art);assert.equal(auto.h,.56);assert.ok(Math.abs(auto.w-.5985)<1e-9&&Math.abs(auto.x+auto.w/2-.5)<1e-9&&Math.abs(auto.y+auto.h/2-.5)<1e-9,JSON.stringify(auto));
 assert.deepEqual(K.report(K.clean({asset:'a',keep:{x:.4,y:.3,w:.2,h:.4}},hooks).band,art),[]);
 assert.equal(K.sizes.length,5);assert.deepEqual(K.sizes.map(size=>size.name),['390x844','1280x720','1366x768','1920x1080','2560x1440']);
});

// ---------------------------------------------------------------- the pieces
test('Graphics sets how much is drawn: none on Low, half on Medium, more on Extra high; reduced motion keeps only stills',()=>{
 const pieces=K.resolve(K.clean({asset:'a',pieces:[{use:'snow'},{use:'fireflies'},{use:'petals'},{use:'rain'}]},hooks).band,{mode:'light',ratio:5}).pieces,base={pieces,art:{x:0,y:0,w:1366,h:300},view:{w:1366,h:300},quiet:[],colors:palette.light};
 const plan=(graphics,moving=true,more={})=>Pieces.plan({...base,graphics,moving,...more}),count=p=>p.layers.reduce((sum,layer)=>sum+layer.n,0);
 const low=plan('low'),medium=plan('medium'),high=plan('high'),top=plan('xhigh');
 assert.equal(low.layers.length,0);assert.equal(low.still,true);assert.equal(high.layers.length,4);assert.ok(Math.abs(count(medium)*2-count(high))<=4,count(medium)+' '+count(high));assert.ok(count(top)>count(high));
 for(const graphics of ['medium','high','xhigh']){const still=plan(graphics,false);assert.equal(still.still,true);assert.ok(still.layers.every(layer=>!layer.flows.length),'nothing that falls or crosses');assert.ok(count(still)<count(plan(graphics)));}
 // an unknown Graphics word draws like High; the greeting's box travels with every drawn layer
 assert.equal(count(plan('ultra')),count(high));const quiet=[{x:20,y:105,w:321,h:37}];assert.deepEqual(plan('high',true,{quiet}).layers[0].quiet,quiet);
 // the same input gives the same plan: nothing is random between frames
 assert.deepEqual(JSON.parse(JSON.stringify(plan('high').layers.map(layer=>[layer.n,layer.seed,layer.mode]))),JSON.parse(JSON.stringify(plan('high').layers.map(layer=>[layer.n,layer.seed,layer.mode]))));
});

// ---------------------------------------------------------------- the theme file
test('a theme with band blocks installs, keeps its own words for sharing, and drops the assets nothing reads',async()=>{
 const input=imageBand({pieces:[{use:'snow'},{draw:{asset:'leaf'},at:{x:.5,y:.5}},{draw:{asset:'gone'}},{draw:'plasma-ribbon-9000',move:['fall']}],shimmer:true},{leaf:wire(pic(),'image/png'),unused:wire(pic(),'image/png')});
 const seen=await Theme.validate(input);assert.deepEqual(await Theme.problems(input),[]);
 assert.equal(seen.band.level,2);assert.equal(seen.band.needs.level,2);assert.equal(seen.band.held,false);
 assert.deepEqual(Object.keys(seen.pack.assets).sort(),['leaf','sky']);assert.deepEqual(paths(seen.band.notes,'dropped'),['$.assets.unused']);
 assert.deepEqual(paths(seen.band.notes,'skipped'),['$.band.pieces[2].draw','$.band.pieces[3].draw']);assert.deepEqual(paths(seen.band.notes,'ignored'),['$.band.shimmer']);
 const {shimmer,...kept}=input.band;assert.deepEqual(Theme.portable(seen.pack).band,kept,'the invented block is still in the file a student shares');
 // a font or a video is not a picture a piece may draw
 const font=imageBand({pieces:[{draw:{asset:'clip'}}]},{clip:wire(movie(640,360),'video/mp4')}),odd=await Theme.validate(font);assert.deepEqual(paths(odd.band.notes,'skipped'),['$.band.pieces[0].draw']);assert.deepEqual(Object.keys(odd.pack.assets),['sky']);
});

test('minBand: a version that reads a lower level installs the theme without its band',async()=>{
 const input=imageBand({pieces:[{use:'snow'}]},{extra:wire(pic(),'image/png')});input.minBand=99;
 const seen=await Theme.validate(input);assert.equal(seen.band.held,true);assert.equal(Object.hasOwn(seen.pack,'band'),false);assert.equal(seen.pack.minBand,99);assert.deepEqual(Object.keys(seen.pack.assets||{}),[]);
 assert.deepEqual(paths(seen.band.notes,'held'),['$.band']);assert.deepEqual(await Theme.problems(input),[]);
 const fits=imageBand({pieces:[{use:'snow'}]});fits.minBand=2;const ok=await Theme.validate(fits);assert.equal(ok.band.held,false);assert.ok(ok.pack.band);assert.equal(Theme.portable(ok.pack).minBand,2);
 // a minBand that is not a whole number from 1 is left out, and the theme still installs
 for(const bad of [0,-1,1.5,'2',null]){const wrong=imageBand();wrong.minBand=bad;const read=await Theme.validate(wrong);assert.equal(Object.hasOwn(read.pack,'minBand'),false,String(bad));assert.deepEqual(paths(read.band.notes,'ignored'),['$.minBand']);assert.ok(read.pack.band);}
});

test('a theme may carry a companion: the pet reader decides, and one that fails is left out without failing the theme',async()=>{
 const input=imageBand();input.companion=pet('Wren');
 const seen=await Theme.validate(input);assert.equal(seen.pack.companion?.name,'Wren');assert.deepEqual(seen.band.notes,[]);
 const shared=Theme.portable(seen.pack);assert.equal(shared.companion.format,'chpet');assert.equal(shared.companion.name,'Wren');assert.deepEqual(Object.keys(shared.companion.assets),['body']);
 for(const broken of [{format:'chpet',version:1,name:'x'},{...pet('Loud'),sound:'bark.mp3'},'crow',[pet('A')]]){const bad=imageBand();bad.companion=broken;const read=await Theme.validate(bad);assert.equal(Object.hasOwn(read.pack,'companion'),false);assert.deepEqual(paths(read.band.notes,'skipped'),['$.companion']);assert.deepEqual(await Theme.problems(bad),[]);}
 // a companion needs no band
 const alone=theme({companion:pet('Solo')});assert.equal((await Theme.validate(alone)).pack.companion.name,'Solo');
});

// ---------------------------------------------------------------- rendering
function kitFixture({kit=true,mainTop=298,rdTop=50}={}){
 const document=createDOM('<html><body><main class="rd" data-motion-style="gentle"><div class="rd-shell"><div class="rd-workspace"><div class="rd-workspace-heading"><span class="rd-heading-art"></span><div class="rd-course-heading"><h1>Good evening</h1><p><span class="rd-heading-detail">2 due</span><span class="rd-heading-date">Monday</span></p></div></div><div class="rd-desk-toolbar"></div><div class="rd-main"></div></div></div></main></body></html>'),rd=document.querySelector('.rd'),root=document.createElement('div');
 const urls=new Map(),intersections=[],resizes=[],changes=[],mediaListeners=new Set(),winListeners=new Map(),stats={plays:0,pauses:0},intervals=[],cleared=[],frames=[],images=[],calls=new Map(),sets=[],mounts=[],clock={hour:12,minute:0,month:6,day:1},picture={w:1600,h:900,paint:()=>[40,80,120,255]};let serial=0,destroys=0;
 const proto=Object.getPrototypeOf(rd);
 if(!Object.getOwnPropertyDescriptor(proto,'previousElementSibling'))Object.defineProperty(proto,'previousElementSibling',{configurable:true,get(){const list=this.parentNode?.children||[],at=list.indexOf(this);return at>0?list[at-1]:null;}});
 const insertBefore=function(node,before){node.remove();const at=this.childNodes.indexOf(before);this.childNodes.splice(at<0?this.childNodes.length:at,0,node);node.parentNode=this;return node;};
 const geometry={rd:{top:rdTop},main:{top:mainTop,width:1304}};const rect=box=>({top:box.top,left:0,width:box.width??1366,height:100,right:box.width??1366,bottom:box.top+100});
 rd.getBoundingClientRect=()=>rect(geometry.rd);rd.querySelector('.rd-main').getBoundingClientRect=()=>rect(geometry.main);
 const at=(left,top,width,height)=>()=>({left,top:geometry.rd.top+top,width,height,right:left+width,bottom:geometry.rd.top+top+height});
 document.querySelector('h1').getBoundingClientRect=at(20,105,321,37);document.querySelector('.rd-heading-date').getBoundingClientRect=at(20,146,120,16);
 const context=el=>el.context||(el.context=new Proxy({canvas:el},{get(target,key){if(key in target)return target[key];if(key==='getImageData')return (x,y,w,h)=>{const data=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++)data.set(picture.paint((i+.5)/w,(j+.5)/h),(j*w+i)*4);return {data};};if(typeof key==='string'&&/^create.*Gradient$/.test(key))return()=>({addColorStop(){}});if(key==='measureText')return()=>({width:0});return()=>{calls.set(key,(calls.get(key)||0)+1);};},set(target,key,value){target[key]=value;return true;}}));
 const create=document.createElement;document.createElement=tag=>{const el=create(tag);el.ownerDocument=document;el.insertBefore=insertBefore;el.getBoundingClientRect=()=>({width:400,height:100,left:0,top:20000,right:400,bottom:20100});if(tag==='video'){el.currentTime=0;el.readyState=1;el.play=()=>{stats.plays++;return Promise.resolve();};el.pause=()=>{stats.pauses++;};el.load=()=>{};}if(tag==='canvas')el.getContext=()=>context(el);return el;};rd.ownerDocument=document;root.ownerDocument=document;
 document.body.append(root);root.append(rd);rd.insertBefore=insertBefore;
 class Clock extends Date{getHours(){return Math.floor(clock.hour);}getMinutes(){return Math.round((clock.hour%1)*60)+clock.minute;}getMonth(){return clock.month-1;}getDay(){return clock.day;}getFullYear(){return clock.year??super.getFullYear();}getDate(){return clock.date??super.getDate();}}
 class Picture{constructor(){this.naturalWidth=0;this.naturalHeight=0;images.push(this);}}
 const media={matches:false,addEventListener(type,fn){mediaListeners.add(fn);},removeEventListener(type,fn){mediaListeners.delete(fn);}},unexpected=()=>assert.fail('the band needs no timeout and no network');
 const env=vm.createContext({document,Blob,Uint8Array,ArrayBuffer,atob,ReserveMediaFrame:Frame,Date:Clock,Image:Picture,devicePixelRatio:1,URL:{createObjectURL(blob){const url='blob:band-'+(++serial);urls.set(url,blob);return url;},revokeObjectURL(){}},matchMedia:()=>media,getComputedStyle:el=>({display:el.hidden?'none':'block',visibility:'visible'}),
  addEventListener(type,fn){if(!winListeners.has(type))winListeners.set(type,new Set());winListeners.get(type).add(fn);},removeEventListener(type,fn){winListeners.get(type)?.delete(fn);},
  IntersectionObserver:class{constructor(fn){this.fn=fn;this.targets=new Set();intersections.push(this);}observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}disconnect(){this.targets.clear();}},
  ResizeObserver:class{constructor(fn){this.fn=fn;this.targets=new Set();resizes.push(this);}observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}disconnect(){this.targets.clear();}},
  MutationObserver:class{constructor(fn){this.fn=fn;changes.push(this);}observe(){}disconnect(){}},fetch:unexpected,setTimeout:unexpected,
  setInterval(fn,ms){intervals.push({fn,ms,id:intervals.length+1});return intervals.length;},clearInterval(id){cleared.push(id);},requestAnimationFrame(fn){frames.push(fn);return frames.length;},cancelAnimationFrame(){}});document.defaultView=env;
 if(kit){
  vm.runInContext(read('band-kit.js'),env);vm.runInContext(read('band-pieces.js'),env);const real=env.ReserveBandPieces;
  env.ReserveBandPieces={...real,mount(host){const made=real.mount(host);mounts.push(made);return {set(next){sets.push(next);return made.set(next);},destroy(){destroys++;return made.destroy();},frame:t=>made.frame(t),get canvas(){return made.canvas;},get layers(){return made.layers;},get running(){return made.running;}};}};
 }
 vm.runInContext(read('data-theme.js'),env);
 const bands=()=>rd.childNodes.filter(node=>/rd-data-theme-band/.test(node.className||''));
 return {document,rd,root,env,stats,geometry,resizes,intervals,cleared,frames,images,calls,sets,mounts,clock,picture,bands,get destroys(){return destroys;},
  apply:(pack,options)=>env.ReserveDataTheme.apply(root,rd,pack,options),remove:()=>env.ReserveDataTheme.remove(rd),css:()=>root.querySelector('style')?.textContent||'',
  shown:()=>bands().filter(node=>!node.hidden),last:()=>sets[sets.length-1],
  signature:()=>bands().map(node=>({hidden:!!node.hidden,style:JSON.stringify(node.style),kids:node.childNodes.map(kid=>({tag:kid.tagName,cls:kid.className,hidden:!!kid.hidden,style:JSON.stringify(kid.style)}))})),
  fire(type){for(const fn of [...(winListeners.get(type)||[])])fn({type});},tick(){for(const timer of intervals)if(!cleared.includes(timer.id))timer.fn();},
  load(){for(const img of images.splice(0)){img.naturalWidth=picture.w;img.naturalHeight=picture.h;img.onload?.();}},
  intersect(node,value){for(const observer of intersections)if(observer.targets.has(node))observer.fn([{target:node,isIntersecting:value}]);},
  reduce(value){media.matches=value;for(const fn of mediaListeners)fn();},changed(){for(const observer of changes)observer.fn([]);}};
}

test('a band written for the first version renders exactly as before: same rules, same nodes, no canvas, no timer, no picture read',async()=>{
 const dark={asset:'night'},clip2={clip2:wire(movie(4096,512,10),'video/mp4'),still2:wire(pic(),'image/png')};
 const video=(band={},assets={})=>theme({band:{asset:'clip',stillAsset:'still',loop:{start:0,end:12},focus:{x:.9,y:.4},...band},assets:{clip:wire(movie(),'video/mp4'),still:wire(png,'image/png'),...assets}});
 const packs=[imageBand(),imageBand({focus:{x:.25,y:.8}}),imageBand({dark},{night:wire(pic(),'image/png')}),video(),video({dark:{asset:'clip2',stillAsset:'still2',loop:{start:0,end:10}}},clip2),video({still:4})];
 for(const [index,input]of packs.entries()){
  const read=await Theme.validate(input);assert.equal(read.band.needs.level,1,'pack '+index);assert.deepEqual(read.band.notes,[],'pack '+index);
  for(const mode of ['light','dark']){
   const old=kitFixture({kit:false}),now=kitFixture();old.apply(read.pack,{theme:mode});now.apply(read.pack,{theme:mode});const label='pack '+index+' '+mode;
   assert.equal(now.css(),old.css(),label);assert.deepEqual(now.signature(),old.signature(),label);assert.deepEqual(now.stats,old.stats,label);
   assert.equal(now.mounts.length,0,label);assert.equal(now.intervals.length,0,label);assert.equal(now.frames.length,0,label);assert.equal(now.images.length,0,label);
   // and after the window changes size
   for(const h of [old,now]){h.geometry.main.top=50+410;h.fire('resize');}assert.deepEqual(now.signature(),old.signature(),label+' resized');assert.equal(now.css(),old.css(),label+' resized');
   old.remove();now.remove();assert.equal(now.bands().length,0,label);
  }
 }
});

test('a band of blocks: the picture is fitted to its keep box, one canvas draws the pieces, and an invented block changes nothing else',async t=>{
 const keep={x:.3,y:.2,w:.4,h:.6},input=tallBand({focus:{x:.9,y:.4},keep,pieces:[{use:'snow'},{draw:'plasma-ribbon-9000',move:['fall']},'petals']}),{pack}=await Theme.validate(input),h=kitFixture();t.after(h.remove);
 assert.equal(h.apply(pack),true);const [band]=h.bands();assert.ok(band);assert.equal(h.bands().length,1);h.intersect(band,true);
 const set=h.last();assert.ok(set,'the pieces were handed to the canvas');assert.equal(set.pieces.length,2);assert.equal(set.graphics,'high');assert.equal(set.moving,true);assert.equal(set.view.h,248+28);
 const f=K.fit({w:1600,h:900},set.view,{focus:{x:.9,y:.4},keep});for(const key of ['x','y','w','h'])assert.ok(Math.abs(set.art[key]-f[key])<.01,key);
 const kids=band.childNodes.filter(kid=>kid.tagName==='VIDEO'||kid.tagName==='IMG');assert.ok(kids.length>=2);
 for(const kid of kids.filter(kid=>!/rd-data-theme-edge/.test(kid.className||''))){assert.equal(kid.style.position,'absolute');assert.equal(kid.style.objectFit,'fill');assert.ok(Math.abs(parseFloat(kid.style.width)-f.w)<1,kid.style.width);assert.ok(Math.abs(parseFloat(kid.style.left)-f.x)<1,kid.style.left);}
 assert.equal(h.mounts.length,1);const canvas=band.childNodes.find(kid=>/rd-data-theme-pieces/.test(kid.className||''));assert.ok(canvas,'one canvas, inside the band');assert.equal(canvas.hidden,false);
 assert.deepEqual(JSON.parse(JSON.stringify(set.quiet)),[{x:20,y:105,w:321,h:57}],'the greeting and the date');
 assert.equal(h.intervals.length,0,'no clock for a band that names no hours');assert.ok(h.frames.length>=1,'a moving band asks for frames');
 // a frame draws without a fault
 h.mounts[0].frame(1200);assert.ok([...h.calls.values()].reduce((a,b)=>a+b,0)>20,'something was drawn');
 // the picture's side colours fill what it does not cover, once its still has been read
 assert.equal(h.images.length,1);h.load();assert.match(JSON.stringify(band.style),/linear-gradient\(180deg,#285078/);
 // reduced motion: stills only, no frame loop; back again
 const frames=h.frames.length;h.reduce(true);assert.equal(h.last().moving,false);assert.equal(h.mounts[0].running,false);h.reduce(false);assert.equal(h.last().moving,true);assert.ok(h.frames.length>frames);
 // Graphics Low: nothing is drawn, the canvas hides
 h.rd.setAttribute('data-graphics','low');h.changed();assert.equal(h.last().graphics,'low');assert.equal(canvas.hidden,true);assert.equal(h.mounts[0].running,false);
 h.rd.setAttribute('data-graphics','medium');h.changed();assert.equal(h.last().graphics,'medium');assert.equal(canvas.hidden,false);
 // scrolled out of view the band rests
 h.intersect(band,false);assert.equal(h.last().moving,false);h.intersect(band,true);assert.equal(h.last().moving,true);
 // the same canvas all along; gone with the theme
 assert.equal(h.mounts.length,1);assert.equal(h.destroys,0);h.remove();assert.equal(h.destroys,1);assert.equal(h.bands().length,0);
});

test('a tall picture with no keep box finds its own: a default at first, then where the picture has its detail',async t=>{
 const input=tallBand(),{pack}=await Theme.validate(input),h=kitFixture();t.after(h.remove);
 // detail on the left third: bright stripes on a flat ground
 h.picture.paint=(x,y)=>x<.33&&Math.floor(y*24)%2?[250,240,200,255]:[30,40,60,255];
 h.apply(pack);const [band]=h.bands(),node=band.childNodes.find(kid=>kid.tagName==='VIDEO'),art={w:1600,h:900},view={w:parseFloat(band.style['--rd-pack-band'])?1366:1366,h:248+28};
 const first=K.fit(art,view,{focus:{x:1,y:.5},keep:K.autoKeep(art)});assert.equal(node.style.position,'absolute');assert.ok(Math.abs(parseFloat(node.style.left)-first.x)<1,node.style.left+' '+first.x);
 assert.equal(h.images.length,1,'the still is read once');h.load();
 const w=96,hh=54,data=new Uint8ClampedArray(w*hh*4);for(let j=0;j<hh;j++)for(let i=0;i<w;i++)data.set(h.picture.paint((i+.5)/w,(j+.5)/hh),(j*w+i)*4);
 const seen={...K.detail(data,w,hh),size:art},keep=K.autoKeep(art,seen),then=K.fit(art,view,{focus:{x:1,y:seen.y??.5},keep});
 assert.ok(keep.x<.2,'the box moved to the detail: '+JSON.stringify(keep));assert.ok(Math.abs(parseFloat(node.style.left)-then.x)<1,node.style.left+' '+then.x);
 h.fire('resize');assert.equal(h.images.length,0,'and not read again');
});

test('narrow art below 2.5:1, a month\'s picture, and the dark look each show one picture at a time',async t=>{
 const input=imageBand({narrow:{asset:'tall'},dark:{asset:'night'},variants:[{when:{months:[12,1,2]},asset:'winter'}]},{tall:wire(pic(),'image/png'),night:wire(movie(4096,512,8),'video/mp4'),nightStill:wire(pic(),'image/png'),winter:wire(pic(),'image/png')});
 input.band.dark={asset:'night',stillAsset:'nightStill',loop:{start:0,end:8}};const {pack}=await Theme.validate(input),h=kitFixture();t.after(h.remove);
 h.apply(pack);assert.equal(h.shown().length,1);const base=h.shown()[0];assert.equal(base.getAttribute('data-rd-band'),null);assert.equal(h.intervals.length,1,'months are read from the clock');assert.equal(h.intervals[0].ms,60000);
 h.geometry.rd.width=420;h.geometry.main.width=400;h.fire('resize');assert.equal(h.shown().length,1);const tall=h.shown()[0];assert.notEqual(tall,base);assert.equal(tall.getAttribute('data-rd-band'),'more');assert.equal(h.rd.childNodes.indexOf(tall),0,'under everything');
 delete h.geometry.rd.width;h.geometry.main.width=1304;h.fire('resize');assert.deepEqual(h.shown(),[base]);
 h.clock.month=1;h.tick();assert.equal(h.shown().length,1);assert.notEqual(h.shown()[0],base);assert.notEqual(h.shown()[0],tall);h.clock.month=6;h.tick();assert.deepEqual(h.shown(),[base]);
 h.apply(pack,{theme:'dark'});assert.equal(h.shown().length,1);assert.ok(h.shown()[0].childNodes.some(kid=>kid.tagName==='VIDEO'),'the night clip');
 h.remove();assert.equal(h.bands().length,0);assert.deepEqual(h.cleared,[1]);
});

test('a band that names hours changes on the minute, without a new canvas and without restarting what moves',async t=>{
 const input=imageBand({pieces:[{use:'snow'},{use:'fireflies',when:{hours:[20,5],fade:30}}]}),{pack}=await Theme.validate(input),h=kitFixture();t.after(h.remove);
 h.apply(pack);assert.equal(h.intervals.length,1);assert.equal(h.last().pieces.length,1,'noon: snow alone');const sets=h.sets.length;
 h.tick();assert.equal(h.sets.length,sets,'nothing changed, nothing is fed again');
 h.clock.hour=19.75;h.tick();assert.equal(h.last().pieces.length,2);assert.equal(h.last().pieces[1].presence,.5,'half way in');
 h.clock.hour=23;h.tick();assert.equal(h.last().pieces[1].presence??1,1);h.clock.hour=4;h.tick();assert.equal(h.last().pieces.length,2,'after midnight');
 h.clock.hour=9;h.tick();assert.equal(h.last().pieces.length,1);assert.equal(h.mounts.length,1);assert.equal(h.destroys,0);
 // the snow kept its seed and its place in the list through every change: its motion never restarts
 const seeds=new Set(h.sets.map(set=>set.pieces[0].seed));assert.equal(seeds.size,1);
});

test('text, shade and fade become rules for the words on the band; text "auto" reads the picture behind the greeting',async t=>{
 const input=imageBand({text:'light',shade:{color:'#102030',strength:.5},fade:{color:'#faf6ee'}}),{pack}=await Theme.validate(input),h=kitFixture();t.after(h.remove);
 h.apply(pack);let css=h.css();assert.match(css,/:is\(h1,\.rd-heading-date,\.rd-heading-detail\)\{color:#FBF8F1!important;/);assert.match(css,/\.rd-course-heading::before\{background:radial-gradient\(ellipse 100% 50% at 0 50%,rgba\(16, ?32, ?48, ?0?\.5\)/);assert.match(css,/> \.rd-data-theme-band::after\{content:"";/);
 h.apply(pack,{theme:'dark'});css=h.css();assert.doesNotMatch(css,/color:#FBF8F1!important/,'the dark palette already writes in light ink');assert.match(css,/rd-course-heading::before\{background:radial-gradient/);
 const auto=(await Theme.validate(tallBand({text:'auto',keep:{x:.1,y:.1,w:.8,h:.8}}))).pack,dim=kitFixture(),bright=kitFixture();t.after(dim.remove);t.after(bright.remove);
 dim.picture.paint=()=>[12,16,30,255];dim.apply(auto);assert.doesNotMatch(dim.css(),/color:#FBF8F1!important/,'not before the picture is read');dim.load();assert.match(dim.css(),/color:#FBF8F1!important/,'a dark picture under dark ink: light words');
 bright.picture.paint=()=>[240,236,220,255];bright.apply(auto);bright.load();assert.doesNotMatch(bright.css(),/color:#FBF8F1!important/);assert.doesNotMatch(bright.css(),/color:#1F1D1A!important/,'dark ink on a light picture stays the theme\'s own');
});
test('a pool with its own colour, or beside a band that keeps its left end, starts inside the page column and feathers in',async()=>{
 // the page column clips at its left edge and its top (responsive-layout.css): a pool reaching past them ends in a hard line
 const inside=/[.]rd-course-heading::before[{]inset:0 auto -22px 0!important;width:min[(]572px,100%[)]!important;height:auto!important;-webkit-mask:linear-gradient[(]90deg,transparent,#000 36px[)]!important;mask:linear-gradient[(]90deg,transparent,#000 36px[)]!important;[}]/;
 const css=async band=>{const {pack}=await Theme.validate(imageBand(band)),h=kitFixture();try{h.apply(pack);return h.css();}finally{h.remove();}};
 assert.match(await css({shade:{color:'#102030',strength:.5}}),inside,"a shade of the pack's own");
 assert.match(await css({text:'light'}),inside,'the pool that comes with turned words');
 assert.match(await css({fade:{left:0}}),inside,'the band keeps its left end');
 assert.match(await css({fade:{left:.5}}),inside);
 const plain=await css({pieces:['snow']});assert.doesNotMatch(plain,inside,'the page-coloured pool beside the usual fade stays as it was');assert.match(plain,/[.]rd-course-heading::before[{]content:""!important;[^}]*inset:auto auto -22px -48px!important;/);
 assert.doesNotMatch(await css({fade:{color:'#faf6ee'}}),inside,'a foot colour alone changes nothing at the left');
 assert.doesNotMatch(await css({fade:{left:1}}),inside,'the usual fade, given in full');
});
test('fade takes a colour for the band\'s foot, a left amount, or both; a left amount outside 0-1 never passes as given',()=>{
 const a=K.clean({asset:'a',fade:'#112233'},hooks).band.fade;assert.equal(String(a.color).toLowerCase(),'#112233');assert.equal(a.left,undefined);
 const b=K.clean({asset:'a',fade:{left:.25}},hooks);assert.deepEqual(b.band.fade,{left:.25});assert.ok(b.needs.uses.includes('fade:left'));
 const c=K.clean({asset:'a',fade:{color:'#445566',left:0}},hooks).band.fade;assert.equal(c.left,0);assert.equal(String(c.color).toLowerCase(),'#445566');
 const d=K.clean({asset:'a',fade:{left:7}},hooks);assert.ok(d.band.fade===undefined||d.band.fade.left<=1);assert.ok(d.notes.length>0);
});
// ---------------------------------------------------------------- the governor
test('the governor: a machine that cannot keep up gets fewer loose items, then every other frame, and gets them back; placed things, stills and slow screens are left alone',()=>{
 let now=0,perFrame=0,queued=null,drawn=0;const paint=new Proxy(function(){},{get:(target,key)=>key==='drawImage'?()=>{drawn++;}:key in target?target[key]:()=>paint,set:(target,key,value)=>{target[key]=value;return true;}});
 const win={devicePixelRatio:1,performance:{now:()=>now},requestAnimationFrame:callback=>{queued=callback;return 1;},cancelAnimationFrame:()=>{queued=null;},addEventListener(){},removeEventListener(){}};
 const element=()=>({style:{},setAttribute(){},getContext:()=>paint,getBoundingClientRect:()=>({left:0,top:0,right:1366,bottom:300}),remove(){},width:0,height:0}),doc={defaultView:win,createElement:element},host={ownerDocument:doc,appendChild(){}};
 const pieces=K.resolve(K.clean({asset:'a',pieces:[{use:'snow'},{draw:'lantern',at:{x:.5,y:.5}},{draw:'leaf',count:2,at:'all'}]},hooks).band,{mode:'light',ratio:5}).pieces,state={pieces,art:{x:0,y:0,w:1366,h:300},view:{w:1366,h:300},quiet:[],colors:palette.light,graphics:'high',moving:true};
 const band=Pieces.mount(host);band.set(state);assert.equal(band.running,true);assert.equal(band.thin,1);
 // the engine's own drawing "takes" perFrame ms (the clock moves while it draws); every lateEvery-th frame arrives a whole frame late
 paint.clearRect=()=>{now+=typeof perFrame==='function'?perFrame():perFrame;};const ups=[];let ticks=0;
 const step=(count,lateEvery=0,gap=16.7)=>{for(let i=0;i<count;i++){const callback=queued,before=band.thin;queued=null;now+=gap*(lateEvery&&i%lateEvery===lateEvery-1?2:1);callback(now);ticks++;if(band.thin>before)ups.push(ticks);}};
 const frameCount=()=>{drawn=0;band.frame(1);return drawn;};
 perFrame=1;step(200);assert.equal(band.thin,1,'a fast machine is left alone');const full=frameCount();assert.ok(full>20,String(full));
 // slow drawing: nothing on the first bad window, a fifth less on the second, then down to three in ten, then every other frame
 perFrame=12;step(100);assert.ok(Math.abs(band.thin-.8)<1e-9,String(band.thin));step(800);assert.ok(Math.abs(band.thin-.3)<1e-9,String(band.thin));assert.equal(band.everyOther,true);
 const few=frameCount();assert.ok(few<full*.5&&few>=3,few+' of '+full);assert.equal(frameCount(),few,'the same ones every frame');
 perFrame=1;step(4000);assert.equal(band.everyOther,false);assert.equal(band.thin,1,'they come back');assert.equal(frameCount(),full);
 // cheap script time but late frames (the drawing is rasterised after the script returns): the same answer
 step(450,8);assert.ok(band.thin<=.5,String(band.thin));
 // a screen that is simply slower (30 a second, every frame on time) is not a slow machine
 step(6000,0,33.4);assert.equal(band.thin,1,'a steady slow screen gets everything');assert.equal(band.everyOther,false);
 // nor is a screen that changes its rate: 120 a second to 60 (on battery), 60 to 30 (a saver mode), or back and forth
 step(600,0,8.3);step(1200,0,16.7);assert.equal(band.thin,1,'120 to 60');step(1200,0,33.4);assert.equal(band.thin,1,'60 to 30');
 for(let i=0;i<12;i++){step(360,0,i%2?16.7:8.3);assert.equal(band.thin,1,'rate flip '+i);}assert.equal(band.everyOther,false);
 // while frames that really drop (one in three arrives a whole frame late) still thin it, at any rate
 step(450,3,8.3);assert.ok(band.thin<=.5,String(band.thin));perFrame=1;step(6000,0,8.3);assert.equal(band.thin,1);assert.equal(band.everyOther,false);
 // a machine that can carry seven in ten but not more: it settles there, and each failed try doubles the wait before the next
 ups.length=0;perFrame=()=>band.thin>.7?12:1;step(10000);assert.ok(band.thin>.5&&band.thin<.75,String(band.thin));assert.ok(ups.length>=5,String(ups));
 const gaps=ups.slice(1).map((at,i)=>at-ups[i]);assert.ok(Math.max(...gaps.slice(-2))>=2*gaps[0],String(gaps));
 // a still is not governed: no loop runs
 band.set({...state,moving:false});assert.equal(band.running,false);band.destroy();
});

// ---------------------------------------------------------------- limits (a pack is data from anyone)
test('a pack cannot ask for work without end: nested recipes, nested scale, paint and tiles all have a ceiling',()=>{
 // recipes that use recipes: each gives at most 32 pieces, so four levels of twelve cost no more than one
 const leaf={draw:'dot',at:{x:.5,y:.5}},twelve=x=>Array.from({length:12},()=>x),uses=Array.from({length:32},()=>({use:'a'})),recipes={d:twelve(leaf),c:twelve({use:'d'}),b:twelve({use:'c'}),a:twelve({use:'b'})};
 const from=process.hrtime.bigint(),nested=K.clean({asset:'a',recipes,pieces:uses,dark:{pieces:uses},variants:Array.from({length:6},(_,i)=>({when:{hours:[i,i+1]},pieces:uses}))},hooks),ms=Number(process.hrtime.bigint()-from)/1e6;
 assert.equal(nested.band.pieces.length,32);assert.ok(paths(nested.notes,'clamped').includes('$.band.recipes.c'),String(paths(nested.notes,'clamped')));assert.ok(ms<500,Math.round(ms)+' ms');
 // scale multiplies down a chain of recipes and still ends between .05 and 20
 const grown=K.clean({asset:'a',recipes:{big:{draw:'glow',density:30,scale:20},bigger:[{use:'big',scale:20}]},pieces:[{use:'bigger',scale:20},{use:'big',scale:20}]},hooks).band.pieces;assert.deepEqual(grown.map(piece=>piece.scale),[20,20]);
 // paint: a loose layer of band-sized things is held to the band four times over, and the others keep their share
 const view={w:1366,h:300},state=(pieces,more={})=>({pieces:K.resolve(K.clean({asset:'a',pieces},hooks).band,{mode:'light',ratio:5}).pieces,art:{x:0,y:0,...view},view,quiet:[],colors:palette.light,graphics:'xhigh',moving:true,...more}),layout=(pieces,more)=>Pieces.plan(state(pieces,more)).layers.map(layer=>layer.n);
 const alone=layout([{use:'snow'}])[0],greedy=layout([{draw:'glow',count:400,size:4,scale:20,at:'all'},{use:'snow'}]);assert.ok(greedy[0]>=1&&greedy[0]<=4,String(greedy));assert.equal(greedy[1],alone,'snow keeps its own');
 const wide=layout([{draw:{asset:'leaf'},count:400,at:'all',size:1},{use:'snow'}],{image:()=>({naturalWidth:3520,naturalHeight:440})});assert.ok(wide[0]<=4,String(wide));assert.equal(wide[1],alone);
 assert.deepEqual(layout([{draw:{asset:'leaf'},count:40,at:'all',size:.1}],{image:()=>({naturalWidth:120,naturalHeight:90})}),[40],'small pictures are all there');
 // tiles: a sheet of haze or ribbon is laid at most 128 times across, however small the pack makes it
 let drawn=0;const paint=new Proxy(function(){},{get:(target,key)=>key==='drawImage'?()=>{drawn++;}:key==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4)}):key in target?target[key]:()=>paint,set:(target,key,value)=>{target[key]=value;return true;}});
 const win={devicePixelRatio:2,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},addEventListener(){},removeEventListener(){}},element=()=>({style:{},setAttribute(){},getContext:()=>paint,getBoundingClientRect:()=>({left:0,top:0,right:1366,bottom:300}),remove(){},width:0,height:0});
 const band=Pieces.mount({ownerDocument:{defaultView:win,createElement:element},appendChild(){}}),tiles=pieces=>{band.set({...state(pieces),graphics:'high'});drawn=0;band.frame(1);return drawn;};
 const usual=tiles([{use:'fog'}]);assert.ok(usual>=1&&usual<=4,String(usual));
 const tiny=tiles([{draw:'haze',at:'all',size:.002,scale:.05,move:['pan']}]);assert.ok(tiny>=100&&tiny<=130,String(tiny));
 const ribbon=tiles([{draw:'ribbon',at:'top',size:.002,scale:.05,color:['#6df0c2','#7aa8ff']}]);assert.ok(ribbon>=100&&ribbon<=130,String(ribbon));band.destroy();
});

test('a piece picture is drawn only up to 12 million pixels, and all of a band\'s piece pictures together up to 48 million',async t=>{
 const names=['p1','p2','p3','p4','p5'],assets=Object.fromEntries(names.map(name=>[name,wire(pic(),'image/png')])),{pack}=await Theme.validate(tallBand({pieces:names.map((asset,i)=>({draw:{asset},at:{x:.1+i*.2,y:.5},size:.2}))},assets));
 const shown=(w,tall)=>{const h=kitFixture();t.after(h.remove);h.picture.w=w;h.picture.h=tall;assert.equal(h.apply(pack),true);h.intersect(h.bands()[0],true);h.mounts[0].frame(1);assert.ok(h.images.length>=5,'the pictures are asked for when first drawn');h.load();return names.filter(name=>h.last().image(name)).length;};
 assert.equal(shown(1600,900),5);assert.equal(shown(4000,3001),0,'each one is over 12 million');assert.equal(shown(4000,2750),4,'the fifth would take them past 48 million together');
});
test('piece pictures of another hour are let go: each is read when it shows, and the 48 million pixels are what shows now',async t=>{
 // five pictures of 12 million pixels, one for each four hours: held together the fifth would be refused
 const names=['p1','p2','p3','p4','p5'],assets=Object.fromEntries(names.map(name=>[name,wire(pic(),'image/png')])),{pack}=await Theme.validate(tallBand({pieces:names.map((asset,i)=>({draw:{asset},at:{x:.5,y:.5},size:.2,when:{hours:[i*4,i*4+4]}}))},assets));
 const h=kitFixture();t.after(h.remove);h.picture.w=4000;h.picture.h=3000;h.clock.hour=1;assert.equal(h.apply(pack),true);h.intersect(h.bands()[0],true);
 for(const [i,name]of names.entries()){h.clock.hour=i*4+1;h.tick();h.mounts[0].frame(1);h.load();assert.ok(h.last().image(name),name+' shows at '+(i*4+1));assert.equal(h.last().pieces.length,1);}
 h.clock.hour=1;h.tick();h.mounts[0].frame(1);assert.equal(h.images.length,1,'the first picture was let go, so it is read again');h.load();assert.ok(h.last().image('p1'));
});

// ---------------------------------------------------------------- weekdays (still level 2: a level only adds names)
test('when.days: weekdays by number or name on the student\'s clock, cut at midnight; an unknown day leaves only that piece out',()=>{
 const dot=when=>({draw:'dot',at:{x:.5,y:.5},when}),read=K.clean({asset:'a',pieces:[dot({days:['mon','Friday',0]}),dot({days:['someday']}),dot({days:[7]}),dot({days:3,hours:[22,2],fade:30}),dot({days:[]})]},hooks);
 assert.equal(read.band.pieces.length,2);assert.deepEqual(read.band.pieces[0].when.days,[0,1,5]);assert.deepEqual(read.band.pieces[1].when.days,[3]);
 assert.deepEqual(paths(read.notes,'skipped'),['$.band.pieces[1].when','$.band.pieces[2].when','$.band.pieces[4].when']);
 assert.equal(read.needs.level,2);assert.ok(read.needs.uses.includes('when:days'));assert.equal(K.since('when:days'),2);assert.deepEqual(K.older(read.needs,2),[]);
 const can=K.capabilities();assert.equal(can.level,2);assert.ok(can.when.includes('days'),'the Market page is told by name');
 const late=read.band.pieces[1].when;assert.equal(K.presence(late,{day:3,hour:23}),1);assert.equal(K.presence(late,{day:3,hour:21.75}),.5,'the hours still fade');assert.equal(K.presence(late,{day:4,hour:1}),0,'after midnight it is Thursday');assert.equal(K.presence(late,{day:3,hour:1}),1);
 for(const day of [0,1,5])assert.equal(K.presence(read.band.pieces[0].when,{day}),1);for(const day of [2,3,4,6])assert.equal(K.presence(read.band.pieces[0].when,{day}),0);
 // a weekday look: the variant holds all day, and a band that names days looks at the clock
 const week=K.clean({asset:'a',variants:[{when:{days:['sat','sun']},asset:'weekend'}]},hooks).band;assert.equal(K.timed(week),true);
 assert.equal(K.resolve(week,{day:6,hour:12}).asset,'weekend');assert.equal(K.resolve(week,{day:0,hour:23.9}).asset,'weekend');assert.equal(K.resolve(week,{day:1,hour:0}).asset,'a');
});
test('a pack\'s weekday picture follows the student\'s clock, looked at on the minute',async t=>{
 const {pack}=await Theme.validate(imageBand({variants:[{when:{days:['sat','sun']},asset:'weekend'}]},{weekend:wire(pic(),'image/png')})),h=kitFixture();t.after(h.remove);
 h.clock.day=5;h.apply(pack);assert.equal(h.intervals.length,1,'weekdays are read from the clock');const weekday=h.shown()[0];assert.equal(weekday.getAttribute('data-rd-band'),null);
 h.clock.day=6;h.tick();assert.equal(h.shown().length,1);assert.notEqual(h.shown()[0],weekday,'Saturday');h.clock.day=1;h.tick();assert.deepEqual(h.shown(),[weekday],'Monday');
});

// ---------------------------------------------------------------- odd and even weeks (still level 2)
test('when.weeks: "odd" or "even" weeks of the year on the student\'s clock; anything else leaves only that piece or variant out',()=>{
 const dot=when=>({draw:'dot',at:{x:.5,y:.5},when}),read=K.clean({asset:'a',pieces:[dot({weeks:'odd'}),dot({days:['thu'],weeks:'even'}),dot({weeks:'Odd'}),dot({weeks:1}),dot({weeks:['odd']}),dot({weeks:''}),dot({weeks:'fortnight'})]},hooks);
 assert.equal(read.band.pieces.length,2);assert.equal(read.band.pieces[0].when.weeks,'odd');assert.deepEqual(read.band.pieces[1].when,{days:[4],weeks:'even'});
 assert.deepEqual(paths(read.notes,'skipped'),['$.band.pieces[2].when','$.band.pieces[3].when','$.band.pieces[4].when','$.band.pieces[5].when','$.band.pieces[6].when']);
 assert.equal(read.needs.level,2);assert.ok(read.needs.uses.includes('when:weeks'));assert.equal(K.since('when:weeks'),2);assert.deepEqual(K.older(read.needs,2),[]);
 assert.ok(K.capabilities().when.includes('weeks'),'the Market page is told by name');
 // presence follows env.week: odd 45, even 46 (a band read without a week counts as week 1)
 const odd=read.band.pieces[0].when,even=read.band.pieces[1].when;
 assert.equal(K.presence(odd,{week:45}),1);assert.equal(K.presence(odd,{week:46}),0);assert.equal(K.presence(odd,{week:53}),1);assert.equal(K.presence(odd,{}),1);
 assert.equal(K.presence(even,{day:4,week:46}),1);assert.equal(K.presence(even,{day:4,week:45}),0);assert.equal(K.presence(even,{day:3,week:46}),0,'and the day still has to hold');assert.equal(K.presence(even,{day:4}),0);
 // a look by the week: an unknown "weeks" leaves that variant out; the band looks at the clock
 const looks=K.clean({asset:'a',variants:[{when:{weeks:'sometimes'},asset:'b'},{when:{weeks:'even'},asset:'c'}]},hooks);
 assert.deepEqual(paths(looks.notes,'skipped'),['$.band.variants[0].when']);assert.equal(looks.band.variants.length,1);assert.equal(K.timed(looks.band),true);
 assert.equal(K.resolve(looks.band,{week:46}).asset,'c');assert.equal(K.resolve(looks.band,{week:45}).asset,'a');
 assert.equal(K.timed(K.clean({asset:'a',pieces:[dot({weeks:'odd'})]},hooks).band),true,'a piece that names weeks looks at the clock');
});
test('week(date) is the ISO 8601 week of the local date: Monday starts it, week 1 holds the first Thursday',()=>{
 const at=(y,m,d)=>K.week(new Date(y,m-1,d));
 assert.equal(at(2026,11,12),46);assert.equal(at(2026,1,1),1);assert.equal(at(2027,1,1),53);
 assert.equal(at(2026,11,8),45,'a Sunday ends its week');assert.equal(at(2026,11,9),46,'a Monday starts the next');
 assert.equal(at(2026,12,31),53);assert.equal(at(2027,1,4),1);assert.equal(at(2025,12,29),1,'a late December Monday can be week 1 of the next year');assert.equal(at(2026,11,1),44,'the day the clocks change');
 assert.equal(at(2027,12,31),52);assert.equal(at(2028,1,3),1);
});
test('a pack\'s odd or even week picture follows the student\'s clock (the ISO week of the local date), looked at on the minute',async t=>{
 const {pack}=await Theme.validate(imageBand({variants:[{when:{weeks:'even'},asset:'other'}]},{other:wire(pic(),'image/png')})),h=kitFixture();t.after(h.remove);
 Object.assign(h.clock,{year:2026,month:11,date:5,day:4});h.apply(pack);assert.equal(h.intervals.length,1,'weeks are read from the clock');const odd=h.shown()[0];
 Object.assign(h.clock,{date:12});h.tick();assert.equal(h.shown().length,1);assert.notEqual(h.shown()[0],odd,'Thursday of week 46');
 Object.assign(h.clock,{date:19});h.tick();assert.deepEqual(h.shown(),[odd],'week 47');
});
