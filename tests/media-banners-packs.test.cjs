'use strict';
const {test,after}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{createHash,randomUUID}=require('node:crypto');
const {createDOM,read}=require('./market-fixture.cjs');
const globals=['ReserveCustomArt','ReserveCustomKits','ReserveMedia','ReserveMediaFrame','ReservePackCommon','ReserveThemePack'],saved=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
after(()=>{for(const [key,d]of saved)if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];});
const Kits=require('../extension/custom-kits.js'),Theme=require('../extension/theme-pack.js'),Frame=require('../extension/media-frame.js');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const single=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'),gif=Buffer.concat([single.subarray(0,-1),single.subarray(19)]);
const hash=value=>createHash('sha256').update(value).digest('hex'),wire=(data,type)=>({type,data:Buffer.from(data).toString('base64'),sha256:hash(data)}),copy=value=>JSON.parse(JSON.stringify(value));
const framing={focus:{x:.8,y:.25},zoom:2,fit:'cover',height:'tall'},videoFrame={...framing,loop:{start:2,end:6},still:4};
const file=(value,name='look.chkit')=>{const out=new Blob([JSON.stringify(value)]);Object.defineProperty(out,'name',{value:name});return out;};
function movie(duration=12){
 const be=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;},box=(tag,...parts)=>{const body=Buffer.concat(parts);return Buffer.concat([be(body.length+8),Buffer.from(tag),body]);};
 const timing=Buffer.alloc(100);timing.writeUInt32BE(1000,12);timing.writeUInt32BE(duration*1000,16);const track=Buffer.alloc(84);track.writeUInt32BE(400*65536,76);track.writeUInt32BE(200*65536,80);const handler=Buffer.alloc(24);handler.write('vide',8);
 return Buffer.concat([box('ftyp',Buffer.from('isom'),be(0),Buffer.from('isom')),box('moov',box('mvhd',timing),box('trak',box('tkhd',track),box('mdia',box('hdlr',handler)))),box('mdat',Buffer.from([1]))]);
}
const mp4=movie(),ref=(type='video/mp4')=>({mediaId:randomUUID(),name:'Local art',type,kind:type.startsWith('video/')?'video':'image',width:type==='image/gif'?1:400,height:type==='image/gif'?1:200,...(type.startsWith('video/')?{duration:12}:{}),...(type==='image/gif'?{animated:true}:{}),palette:[]});
function codec(calls=[]){return {async prepare(blob,slot,name,options){calls.push({slot,name,options});const asset={...ref(blob.type),name,...(blob.type==='image/png'?{width:1,height:1}:{})};return {asset,blob,...(asset.kind==='video'||asset.animated?{poster:new Blob([png],{type:'image/png'})}:{})};}};}
function theme(value={}){return {format:'chtheme',version:1,name:'Framed',colors:{light:{bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#555555',line:'#cccccc',accent:'#0055aa'}},...value};}
function videoTheme(){return theme({banner:{asset:'clip',stillAsset:'poster',...videoFrame},background:{asset:'clip',stillAsset:'poster',...videoFrame},assets:{clip:wire(mp4,'video/mp4'),poster:wire(png,'image/png')}});}

test('kits preserve wrapped SVG, card/background slots, media bytes, posters and framing across two exports',async()=>{
 const a=ref(),blob=new Blob([mp4],{type:a.type}),poster=new Blob([png],{type:'image/png'}),store={async get(id){assert.equal(id,a.mediaId);return {asset:a,blob,poster};}};
 const svg={name:'shape.svg',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle r="4"/></svg>'},appearance={bannerArt:{asset:a,...videoFrame},cardArt:{asset:svg,...framing},backgroundArt:{asset:a,...videoFrame}};
 const kit=await Kits.capture('Framed kit',appearance,{},store),first=JSON.parse(await (await Kits.exportKit(kit,store)).text()),calls=[],imported=await Kits.importKit(file(first),{media:codec(calls)});
 assert.deepEqual(first.assets.bannerArt.frame,videoFrame);assert.equal(first.assets.bannerArt.poster.sha256,hash(png));assert.equal(first.assets.bannerArt.data,mp4.toString('base64'));assert.deepEqual(imported.kit.appearance.cardArt,kit.appearance.cardArt);
 assert.deepEqual({...imported.kit.appearance.bannerArt,asset:null},{asset:null,...videoFrame});assert.notEqual(imported.kit.appearance.bannerArt.asset.mediaId,a.mediaId);assert.equal(calls[0].options.still,4);assert.deepEqual(calls[0].options.loop,{start:2,end:6});
 assert.deepEqual(Buffer.from(await imported.media[0].poster.arrayBuffer()),png);const local={async get(id){return imported.media.find(row=>row.asset.mediaId===id);}},second=JSON.parse(await (await Kits.exportKit(imported.kit,local)).text());assert.deepEqual(second,first);
});

test('animated kit artwork retains its animated reference and original still bytes',async()=>{
 const a=ref('image/gif'),blob=new Blob([gif],{type:a.type}),poster=new Blob([png],{type:'image/png'}),store={async get(){return {asset:a,blob,poster};}},kit=await Kits.capture('Animation',{cardArt:{asset:a,...framing}},{},store),doc=JSON.parse(await (await Kits.exportKit(kit,store)).text());
 const imported=await Kits.importKit(file(doc),{media:codec()});assert.equal(imported.kit.appearance.cardArt.asset.animated,true);assert.equal(imported.media[0].blob.type,'image/gif');assert.deepEqual(Buffer.from(await imported.media[0].blob.arrayBuffer()),gif);assert.deepEqual(Buffer.from(await imported.media[0].poster.arrayBuffer()),png);
});

test('kit poster hashes and frame schema fail before invoking any media decoder',async()=>{
 const a=ref(),store={async get(){return {asset:a,blob:new Blob([mp4],{type:a.type}),poster:new Blob([png],{type:'image/png'})};}},kit=await Kits.capture('Clip',{bannerArt:{asset:a,...videoFrame}},{},store),doc=JSON.parse(await (await Kits.exportKit(kit,store)).text());
 for(const change of [d=>d.assets.bannerArt.poster.sha256='0'.repeat(64),d=>d.assets.bannerArt.frame.zoom=4.01,d=>d.assets.bannerArt.frame.focus.x=-.01,d=>d.assets.bannerArt.frame.loop={start:6,end:2},d=>d.assets.bannerArt.frame.url='https://invalid.example/']){const bad=copy(doc),calls=[];change(bad);await assert.rejects(()=>Kits.importKit(file(bad),{media:codec(calls)}));assert.equal(calls.length,0);}
});

test('kit export preflights poster base64 before reading large media blobs',async()=>{
 const a=ref(),blob=new Blob([new Uint8Array(28500000)],{type:a.type}),poster=new Blob([new Uint8Array(2000000)],{type:'image/png'});blob.arrayBuffer=poster.arrayBuffer=async()=>assert.fail('oversized transport must fail before reading bytes');
 await assert.rejects(()=>Kits.capture('Oversized',{bannerArt:{asset:a,...videoFrame}},{},{async get(){return {asset:a,blob,poster};}}),/encoded|limit|byte/i);
});

test('theme video still times and independent still resources survive portable validation',async()=>{
 const input=videoTheme(),{pack}=await Theme.validate(input);assert.deepEqual(Theme.portable(pack),input);assert.equal(pack.assets.clip.width,400);assert.equal(pack.assets.clip.height,200);assert.equal(pack.assets.clip.duration,12);assert.equal(pack.assets.clip.animated,true);
 const calls=[];await Theme.validate(input,{media:codec(calls)});assert.equal(calls.find(call=>call.name==='clip').options.still,4);assert.deepEqual(calls.find(call=>call.name==='clip').options.loop,{start:2,end:6});
});

test('theme rejects untrusted framing, out-of-duration selections and animated still resources',async()=>{
 for(const change of [d=>d.banner.focus={x:1.01,y:.5},d=>d.banner.zoom=0,d=>d.banner.height='huge',d=>d.banner.loop={start:2,end:13},d=>d.banner.still=13,d=>d.banner.stillAsset='clip',d=>d.banner.loop={start:5,end:5}]){const input=videoTheme();change(input);await assert.rejects(()=>Theme.validate(input));}
 const image=theme({banner:{asset:'picture',still:0},assets:{picture:wire(png,'image/png')}});await assert.rejects(()=>Theme.validate(image),/still|video/i);
 const animated=theme({banner:{asset:'moving',stillAsset:'poster',...framing},assets:{moving:wire(gif,'image/gif'),poster:wire(png,'image/png')}}),{pack}=await Theme.validate(animated);assert.deepEqual(Theme.portable(pack),animated);animated.assets.poster=wire(gif,'image/gif');await assert.rejects(()=>Theme.validate(animated),/still.*animation/i);
});

test('theme checks every resource hash before media decoding and preserves legacy still IDs',async()=>{
 const input=videoTheme(),calls=[];input.assets.poster.sha256='0'.repeat(64);await assert.rejects(()=>Theme.validate(input,{media:codec(calls)}),/hash mismatch/i);assert.equal(calls.length,0);
 const legacy=videoTheme();legacy.banner={asset:'clip',still:'poster',fit:'cover',position:'right'};legacy.background={asset:'clip',still:'poster',fit:'tile',position:'top'};assert.deepEqual(Theme.portable((await Theme.validate(legacy)).pack),legacy);
});

function renderFixture(){
 const document=createDOM('<html><body><main class="rd" data-motion-style="gentle"><span class="rd-heading-art"></span></main></body></html>'),rd=document.querySelector('.rd'),root=document.createElement('div'),urls=new Map(),revoked=[],intersections=[],resizes=[],changes=[],mediaListeners=new Set(),stats={plays:0,pauses:0,layouts:0};let serial=0,box={width:400,height:100,left:0,top:20000,right:400,bottom:20100};
 const create=document.createElement;document.createElement=tag=>{const el=create(tag);el.ownerDocument=document;el.getBoundingClientRect=()=>{stats.layouts++;return box;};if(tag==='video'){el.currentTime=0;el.readyState=1;el.play=()=>{stats.plays++;return Promise.resolve();};el.pause=()=>{stats.pauses++;};el.load=()=>{};}return el;};rd.ownerDocument=document;root.ownerDocument=document;
 document.body.append(root);root.append(rd);rd.insertBefore=function(node,before){node.remove();const at=this.childNodes.indexOf(before);this.childNodes.splice(at<0?this.childNodes.length:at,0,node);node.parentNode=this;return node;};
 const media={matches:false,addEventListener(type,fn){mediaListeners.add(fn);},removeEventListener(type,fn){mediaListeners.delete(fn);}},unexpected=()=>assert.fail('render must be synchronous without timers or IO');
 const env=vm.createContext({document,Blob,Uint8Array,ArrayBuffer,atob,ReserveMediaFrame:Frame,URL:{createObjectURL(blob){const url='blob:frame-'+(++serial);urls.set(url,blob);return url;},revokeObjectURL(url){revoked.push(url);}},matchMedia:()=>media,getComputedStyle:el=>({display:el.hidden?'none':'block',visibility:'visible'}),
  IntersectionObserver:class{constructor(fn){this.fn=fn;this.targets=new Set();intersections.push(this);}observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}disconnect(){this.targets.clear();}},
  ResizeObserver:class{constructor(fn){this.fn=fn;this.targets=new Set();resizes.push(this);}observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}disconnect(){this.targets.clear();}},
  MutationObserver:class{constructor(fn){this.fn=fn;changes.push(this);}observe(){}disconnect(){}},fetch:unexpected,setTimeout:unexpected,setInterval:unexpected,requestAnimationFrame:unexpected});document.defaultView=env;vm.runInContext(read('data-theme.js'),env);
 return {document,rd,root,env,urls,revoked,stats,apply:pack=>env.ReserveDataTheme.apply(root,rd,pack),remove:()=>env.ReserveDataTheme.remove(rd),
  intersect(node,value){for(const observer of intersections)if(observer.targets.has(node))observer.fn([{target:node,isIntersecting:value}]);},
  resize(value,{notify=true,visualScale=1}={}){box={...value,width:value.width*visualScale,height:value.height*visualScale};if(notify)for(const observer of resizes)observer.fn([...observer.targets].map(target=>({target,contentRect:value})));},
  visibility(value){document.hidden=value;document.dispatchEvent({type:'visibilitychange'});},reduce(value){media.matches=value;for(const fn of mediaListeners)fn();},motion(value){rd.setAttribute('data-motion-style',value);for(const observer of changes)observer.fn([]);}};
}

test('a reused theme clip hands one decoder between visible banner and background placements',async t=>{
 const {pack}=await Theme.validate(videoTheme());pack.background.fit='tile';const h=renderFixture();t.after(h.remove);h.rd.querySelector('.rd-heading-art').setAttribute('aria-hidden','true');assert.equal(h.apply(pack),true);const background=h.rd.querySelector('.rd-data-theme-background'),banner=h.rd.querySelector('.rd-data-theme-banner');assert.equal(background.querySelectorAll('video').length,1);assert.equal(banner.querySelectorAll('video').length,1);assert.equal(h.stats.plays,0);
 h.intersect(background,true);assert.equal(h.stats.plays,1);assert.equal(background.querySelector('video').hidden,false);assert.equal(banner.querySelector('video').hidden,true);h.intersect(banner,true);assert.equal(h.stats.plays,2);assert.equal(background.querySelector('video').hidden,true);assert.equal(background.querySelector('video').getAttribute('src'),null);assert.equal(banner.querySelector('video').hidden,false);h.intersect(banner,false);assert.equal(h.stats.plays,3);assert.equal(background.querySelector('video').hidden,false);assert.equal(banner.querySelector('video').hidden,true);assert.equal(banner.querySelector('video').getAttribute('src'),null);
 h.visibility(true);assert.equal(background.querySelector('video').hidden,true);h.visibility(false);h.reduce(true);assert.equal(background.querySelector('img').hidden,false);h.reduce(false);h.motion('off');assert.equal(background.querySelector('video').hidden,true);const before={...h.stats};h.motion('off');assert.deepEqual(h.stats,before);
});

test('different theme video resources pause independently off screen',async t=>{
 const input=videoTheme();input.background.asset='other';input.assets.other=wire(mp4,'video/mp4');const {pack}=await Theme.validate(input),h=renderFixture();t.after(h.remove);h.apply(pack);const background=h.rd.querySelector('.rd-data-theme-background'),banner=h.rd.querySelector('.rd-data-theme-banner');h.intersect(background,true);h.intersect(banner,true);assert.equal(h.stats.plays,2);h.intersect(banner,false);assert.equal(background.querySelector('video').hidden,false);assert.equal(banner.querySelector('video').getAttribute('src'),null);
});

test('local banner and background art override imported theme slots and release their decoder',async t=>{
 const {pack}=await Theme.validate(videoTheme()),h=renderFixture();t.after(h.remove);h.apply(pack);const background=h.rd.querySelector('.rd-data-theme-background'),banner=h.rd.querySelector('.rd-data-theme-banner'),slot=h.rd.querySelector('.rd-heading-art');h.intersect(banner,true);const ownBanner=h.document.createElement('span');ownBanner.className='ch-custom-banner';slot.append(ownBanner);h.apply(pack);assert.equal(h.rd.querySelector('.rd-data-theme-banner'),null);assert.equal(banner.querySelector('video').getAttribute('src'),null);assert.equal(slot.querySelector('.ch-custom-banner'),ownBanner);assert.equal(slot.hasAttribute('data-rd-data-banner'),false);
 h.intersect(background,true);const ownBackground=h.document.createElement('span');ownBackground.className='ch-frame-background';h.rd.append(ownBackground);h.apply(pack);assert.equal(background.hidden,true);assert.equal(background.querySelector('video').getAttribute('src'),null);ownBackground.remove();ownBanner.remove();h.apply(pack);assert.equal(background.hidden,false);assert.ok(h.rd.querySelector('.rd-data-theme-banner'));
});

test('theme height changes the parent slot layout only when explicitly selected',async t=>{
 const {pack}=await Theme.validate(videoTheme()),h=renderFixture();t.after(h.remove);h.apply(pack);assert.match(h.root.querySelector('style').textContent,/--rd-band-h:220px/);assert.match(h.root.querySelector('style').textContent,/height:220px!important/);delete pack.banner.height;h.apply(pack);assert.doesNotMatch(h.root.querySelector('style').textContent,/--rd-band-h:/);
});

test('theme layout follows focus at two aspect ratios and loop events never measure layout',async t=>{
 const input=videoTheme();delete input.background;const {pack}=await Theme.validate(input),h=renderFixture();t.after(h.remove);h.apply(pack);const node=h.rd.querySelector('.rd-data-theme-banner'),video=node.querySelector('video'),length=(value,size)=>parseFloat(value)*(String(value).endsWith('%')?size/100:1),bounds=(width,height)=>[length(video.style.width,width),length(video.style.height,height),length(video.style.left,width),length(video.style.top,height)];assert.deepEqual(bounds(400,100),[800,400,-400,-50]);
 h.resize({width:800,height:200},{notify:false});assert.deepEqual(bounds(800,200),[1600,800,-800,-100]);
 h.resize({width:100,height:200,left:0,top:0,right:100,bottom:200},{visualScale:.42});assert.deepEqual(bounds(100,200),[800,400,-590,0]);h.intersect(node,true);assert.equal(video.currentTime,2);const layouts=h.stats.layouts;video.currentTime=6.1;video.dispatchEvent({type:'timeupdate'});assert.equal(video.currentTime,2);assert.equal(h.stats.layouts,layouts);
 const resources=[...h.urls.keys()];h.remove();assert.deepEqual(h.revoked,resources);assert.equal(video.getAttribute('src'),null);
});

test('theme backgrounds follow a container resize after hydration without waiting for observer delivery',async t=>{
 const input=videoTheme();delete input.banner;const {pack}=await Theme.validate(input),h=renderFixture();t.after(h.remove);h.apply(pack);const node=h.rd.querySelector('.rd-data-theme-background');h.resize({width:800,height:200},{notify:false});
 for(const child of node.children){const length=(value,size)=>parseFloat(value)*(String(value).endsWith('%')?size/100:1);assert.deepEqual([length(child.style.width,800),length(child.style.height,200),length(child.style.left,800),length(child.style.top,200)],[1600,800,-800,-100]);}
});
