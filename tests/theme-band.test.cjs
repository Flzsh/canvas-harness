'use strict';
// The band of a .chtheme (theme-pack.js band, data-theme.js): one picture or video across the whole top of Home,
// painted like the packaged scenes' skies (scene-themes.js measureBand). Validator, media bounds and rendering.
const {test,after}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{createHash}=require('node:crypto');
const {createDOM,read}=require('./addons-fixture.cjs');
const globals=['ReserveCustomArt','ReserveCustomKits','ReserveMedia','ReserveMediaFrame','ReservePackCommon','ReserveThemePack'],saved=new Map(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
after(()=>{for(const [key,d]of saved)if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];});
const Theme=require('../extension/theme-pack.js'),Media=require('../extension/media-store.js'),Frame=require('../extension/media-frame.js');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const single=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'),gif=Buffer.concat([single.subarray(0,-1),single.subarray(19)]);
const hash=value=>createHash('sha256').update(value).digest('hex'),wire=(data,type)=>({type,data:Buffer.from(data).toString('base64'),sha256:hash(data)});
// a minimal MP4 container (ftyp, moov with a video track of the given size and duration, mdat)
function movie(width=4096,height=512,duration=12){
 const be=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;},box=(tag,...parts)=>{const body=Buffer.concat(parts);return Buffer.concat([be(body.length+8),Buffer.from(tag),body]);};
 const timing=Buffer.alloc(100);timing.writeUInt32BE(1000,12);timing.writeUInt32BE(duration*1000,16);const track=Buffer.alloc(84);track.writeUInt32BE(width*65536,76);track.writeUInt32BE(height*65536,80);const handler=Buffer.alloc(24);handler.write('vide',8);
 return Buffer.concat([box('ftyp',Buffer.from('isom'),be(0),Buffer.from('isom')),box('moov',box('mvhd',timing),box('trak',box('tkhd',track),box('mdia',box('hdlr',handler)))),box('mdat',Buffer.from([1]))]);
}
const palette={light:{bg:'#faf6ee',surface:'#fffcf6',ink:'#2b2420',muted:'#5f554c',line:'#e3d8c6',accent:'#9c3f2a'},dark:{bg:'#22201e',surface:'#2d2a27',ink:'#f1ebe2',muted:'#c2b8ab',line:'#45403a',accent:'#f0a58a'}};
const theme=(value={})=>({format:'chtheme',version:1,name:'Band',colors:palette,...value});
const imageBand=(band={})=>theme({band:{asset:'sky',...band},assets:{sky:wire(png,'image/png')}});
const videoBand=(band={},clip=movie())=>theme({band:{asset:'clip',stillAsset:'still',loop:{start:0,end:12},focus:{x:.9,y:.4},...band},assets:{clip:wire(clip,'video/mp4'),still:wire(png,'image/png')}});

// ---------------------------------------------------------------- validator
test('a band validates as an image, or as a video with its still, loop and focus, and round-trips portably',async()=>{
 for(const input of [imageBand(),imageBand({focus:{x:0,y:1}}),videoBand(),videoBand({still:4})]){const {pack}=await Theme.validate(input);assert.deepEqual(Theme.portable(pack),input);assert.equal(pack.band.asset,input.band.asset);}
 const {pack}=await Theme.validate(videoBand());assert.equal(pack.assets.clip.width,4096);assert.equal(pack.assets.clip.height,512);assert.equal(pack.assets.clip.animated,true);
 // a band beside a banner and a background, each with its own asset
 const both=theme({background:{asset:'sky',fit:'cover',position:'bottom'},banner:{asset:'sky',fit:'contain',position:'right'},band:{asset:'sky'},assets:{sky:wire(png,'image/png')}});assert.deepEqual(Theme.portable((await Theme.validate(both)).pack),both);
});

test('a band rejects a bad asset type, a moving picture without a still, and every field it does not take',async()=>{
 const font=theme({band:{asset:'face'},assets:{face:{type:'font/woff2',data:Buffer.from('wOF2').toString('base64'),sha256:hash(Buffer.from('wOF2'))}}});
 assert.match((await Theme.problems(font)).join('\n'),/\$\.band\.asset: unsupported asset type font\/woff2/);
 const noStill=videoBand();delete noStill.band.stillAsset;delete noStill.assets.still;assert.match((await Theme.problems(noStill)).join('\n'),/\$\.band\.still: a video, GIF or animated image needs a separate static still asset/);
 const movingGif=theme({band:{asset:'moving'},assets:{moving:wire(gif,'image/gif')}});assert.match((await Theme.problems(movingGif)).join('\n'),/\$\.band\.still:/);
 // a field this version does not know is left out and noted for the checker; the theme still installs (band level 2)
 for(const [key,value]of [['fit','cover'],['position','right'],['zoom',2],['height','tall'],['colour','#ffffff']]){const input=imageBand({[key]:value}),read=await Theme.validate(input);assert.deepEqual(read.pack.band,{asset:'sky'},key);assert.ok(read.band.notes.some(note=>note.path==='$.band.'+key&&note.kind==='ignored'),key);assert.deepEqual(await Theme.problems(input),[],key);}
 // the main picture stays strict (a broken loop or still fails); a focus out of range is clamped, a broken one falls back
 for(const change of [b=>b.loop={start:2,end:13},b=>b.loop={start:5,end:5},b=>b.still=13,b=>b.stillAsset='clip'])await assert.rejects(()=>{const input=videoBand();change(input.band);return Theme.validate(input);});
 {const far=videoBand();far.band.focus={x:1.2,y:.5};const read=await Theme.validate(far);assert.deepEqual(read.pack.band.focus,{x:1,y:.5});assert.ok(read.band.notes.some(note=>note.path==='$.band.focus'&&note.kind==='clamped'));}
 {const half=videoBand();half.band.focus={x:.5};const read=await Theme.validate(half);assert.equal(Object.hasOwn(read.pack.band,'focus'),false);assert.ok(read.band.notes.some(note=>note.path==='$.band.focus'&&note.kind==='fallback'));}
 await assert.rejects(()=>Theme.validate(imageBand({loop:{start:0,end:1}})),/loop is only valid for video/);
 await assert.rejects(()=>Theme.validate(theme({band:'sky',assets:{sky:wire(png,'image/png')}})),/\$\.band: expected a plain object/);
 await assert.rejects(()=>Theme.validate(theme({band:{asset:'missing'}})),/missing asset missing/);
});

test('a band video may be as wide as the scenes\' skies; everywhere else a pack video stays at 1920',async()=>{
 const wide=movie(4096,512);assert.equal((await Theme.validate(videoBand({},wide))).pack.assets.clip.width,4096);
 const banner=theme({banner:{asset:'clip',stillAsset:'still'},assets:{clip:wire(wide,'video/mp4'),still:wire(png,'image/png')}});assert.match((await Theme.problems(banner)).join('\n'),/\$\.assets\.clip: Media dimensions are too large/);
 for(const clip of [movie(4097,512),movie(4096,640),movie(2560,1080)])assert.match((await Theme.problems(videoBand({},clip))).join('\n'),/\$\.assets\.clip: Media dimensions are too large/);
 assert.equal((await Theme.validate(videoBand({},movie(2560,704)))).pack.assets.clip.height,704);
 assert.throws(()=>Media.inspectPortable(new Uint8Array(wide),'video/mp4'),/too large/);assert.equal(Media.inspectPortable(new Uint8Array(wide),'video/mp4',{},'band').width,4096);
 const reference={mediaId:'0f8fad5b-d9cb-469f-a165-70867728950e',name:'Band',type:'video/mp4',kind:'video',width:4096,height:512,duration:12,palette:[]};assert.equal(Media.cleanReference(reference,'band').width,4096);assert.throws(()=>Media.cleanReference(reference,'banner'),/too large/);
 // the browser decode step is asked for the band slot, with the band's loop
 const calls=[];await Theme.validate(videoBand(),{media:{async prepare(blob,slot,name,options){calls.push({slot,name,options});return {asset:{mediaId:'0f8fad5b-d9cb-469f-a165-70867728950e',name,type:blob.type,kind:blob.type.startsWith('video/')?'video':'image',width:blob.type.startsWith('video/')?4096:1,height:blob.type.startsWith('video/')?512:1,...(blob.type.startsWith('video/')?{duration:12}:{}),palette:[]},blob,...(blob.type.startsWith('video/')?{poster:new Blob([png],{type:'image/png'})}:{})};}}});
 assert.deepEqual(calls.find(c=>c.name==='clip'),{slot:'band',name:'clip',options:{loop:{start:0,end:12}}});assert.equal(calls.find(c=>c.name==='still').slot,'banner');
});

// ---------------------------------------------------------------- rendering
function bandFixture({mainTop=298,rdTop=50}={}){
 const document=createDOM('<html><body><main class="rd" data-motion-style="gentle"><div class="rd-shell"><div class="rd-workspace"><div class="rd-workspace-heading"><span class="rd-heading-art"></span></div><div class="rd-desk-toolbar"></div><div class="rd-main"></div></div></div></main></body></html>'),rd=document.querySelector('.rd'),root=document.createElement('div'),urls=new Map(),revoked=[],intersections=[],resizes=[],changes=[],mediaListeners=new Set(),winListeners=new Map(),stats={plays:0,pauses:0};let serial=0;
 const proto=Object.getPrototypeOf(rd);if(!Object.getOwnPropertyDescriptor(proto,'previousElementSibling'))Object.defineProperty(proto,'previousElementSibling',{configurable:true,get(){const list=this.parentNode?.children||[],at=list.indexOf(this);return at>0?list[at-1]:null;}});
 const geometry={rd:{top:rdTop},main:{top:mainTop,width:1304}};const rect=box=>({top:box.top,left:0,width:box.width??1366,height:100,right:box.width??1366,bottom:box.top+100});
 rd.getBoundingClientRect=()=>rect(geometry.rd);rd.querySelector('.rd-main').getBoundingClientRect=()=>rect(geometry.main);
 const create=document.createElement;document.createElement=tag=>{const el=create(tag);el.ownerDocument=document;el.getBoundingClientRect=()=>({width:400,height:100,left:0,top:20000,right:400,bottom:20100});if(tag==='video'){el.currentTime=0;el.readyState=1;el.play=()=>{stats.plays++;return Promise.resolve();};el.pause=()=>{stats.pauses++;};el.load=()=>{};}return el;};rd.ownerDocument=document;root.ownerDocument=document;
 document.body.append(root);root.append(rd);rd.insertBefore=function(node,before){node.remove();const at=this.childNodes.indexOf(before);this.childNodes.splice(at<0?this.childNodes.length:at,0,node);node.parentNode=this;return node;};
 const media={matches:false,addEventListener(type,fn){mediaListeners.add(fn);},removeEventListener(type,fn){mediaListeners.delete(fn);}},unexpected=()=>assert.fail('render must be synchronous without timers or IO');
 const env=vm.createContext({document,Blob,Uint8Array,ArrayBuffer,atob,ReserveMediaFrame:Frame,URL:{createObjectURL(blob){const url='blob:band-'+(++serial);urls.set(url,blob);return url;},revokeObjectURL(url){revoked.push(url);}},matchMedia:()=>media,getComputedStyle:el=>({display:el.hidden?'none':'block',visibility:'visible'}),
  addEventListener(type,fn){if(!winListeners.has(type))winListeners.set(type,new Set());winListeners.get(type).add(fn);},removeEventListener(type,fn){winListeners.get(type)?.delete(fn);},
  IntersectionObserver:class{constructor(fn){this.fn=fn;this.targets=new Set();intersections.push(this);}observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}disconnect(){this.targets.clear();}},
  ResizeObserver:class{constructor(fn){this.fn=fn;this.targets=new Set();this.live=true;resizes.push(this);}observe(el){this.targets.add(el);}unobserve(el){this.targets.delete(el);}disconnect(){this.targets.clear();this.live=false;}},
  MutationObserver:class{constructor(fn){this.fn=fn;changes.push(this);}observe(){}disconnect(){}},fetch:unexpected,setTimeout:unexpected,setInterval:unexpected,requestAnimationFrame:unexpected});document.defaultView=env;vm.runInContext(read('data-theme.js'),env);
 return {document,rd,root,env,urls,revoked,stats,geometry,resizes,winListeners,apply:(pack,options)=>env.ReserveDataTheme.apply(root,rd,pack,options),remove:()=>env.ReserveDataTheme.remove(rd),
  band:()=>rd.querySelector('.rd-data-theme-band'),css:()=>root.querySelector('style')?.textContent||'',
  fire(type){for(const fn of [...(winListeners.get(type)||[])])fn({type});},
  intersect(node,value){for(const observer of intersections)if(observer.targets.has(node))observer.fn([{target:node,isIntersecting:value}]);},
  reduce(value){media.matches=value;for(const fn of mediaListeners)fn();},motion(value){rd.setAttribute('data-motion-style',value);for(const observer of changes)observer.fn([]);}};
}

test('the band paints first in the dashboard, as tall as the strip above the desk, its height written on the band alone',async t=>{
 const {pack}=await Theme.validate(theme({background:{asset:'sky',fit:'cover'},band:{asset:'sky'},assets:{sky:wire(png,'image/png')}})),h=bandFixture();t.after(h.remove);assert.equal(h.apply(pack),true);
 const band=h.band();assert.ok(band);assert.equal(band.parentNode,h.rd);assert.equal(h.rd.childNodes.indexOf(band),0,'first in the dashboard, under everything');assert.equal(h.rd.childNodes[1].className,'rd-data-theme-background');
 assert.equal(band.hasAttribute('data-rd-keep'),true,'the dashboard keeps it across renders');assert.equal(band.getAttribute('aria-hidden'),'true');
 assert.equal(band.style['--rd-pack-band'],'248px');assert.equal(h.rd.style['--rd-pack-band'],undefined,'never on the root');
 const css=h.css();assert.match(css,/> \.rd-data-theme-band\{position:absolute;left:0;right:0;top:0;height:calc\(var\(--rd-pack-band,330px\) \+ 28px\);z-index:0;/);assert.match(css,/object-fit:cover;object-position:100% 50%;/);assert.match(css,/mask-image:linear-gradient\(90deg/);assert.match(css,/> \.rd-shell\{position:relative;z-index:1;\}/);
 // re-measured on each sync and when the window changes size; clamped 200-560 like the scenes' sky
 h.geometry.main.top=50+410;h.apply(pack);assert.equal(band.style['--rd-pack-band'],'410px');
 h.geometry.main.top=50+900;h.fire('resize');assert.equal(band.style['--rd-pack-band'],'560px');
 h.geometry.main.top=50+120;h.fire('resize');assert.equal(band.style['--rd-pack-band'],'200px');
 h.geometry.main.top=50+60;h.fire('resize');assert.equal(band.style['--rd-pack-band'],undefined,'no desk below the heading: the stylesheet default');
 // the boxes above the desk are watched, so a Help band that fills later moves the band too
 const observer=h.resizes.find(o=>o.targets.size);assert.ok(observer);assert.deepEqual([...observer.targets].map(el=>el.className).sort(),['rd-desk-toolbar','rd-workspace-heading']);
 h.geometry.main.top=50+333;observer.fn([]);assert.equal(band.style['--rd-pack-band'],'333px');
 assert.match(css,/object-position:100% 50%/);const {pack:focused}=await Theme.validate(theme({band:{asset:'sky',focus:{x:.25,y:.8}},assets:{sky:wire(png,'image/png')}}));h.apply(focused);assert.match(h.css(),/object-position:25% 80%;/);
});

test('while a band shows the heading is transparent and the slot banner gives way; without one the banner comes back',async t=>{
 const input=theme({background:{asset:'sky',fit:'cover'},banner:{asset:'sky',fit:'contain',position:'right',height:'tall'},band:{asset:'sky'},assets:{sky:wire(png,'image/png')}}),{pack}=await Theme.validate(input),h=bandFixture();t.after(h.remove);h.apply(pack);
 let css=h.css();assert.equal(h.rd.querySelector('.rd-data-theme-banner'),null,'no slot banner');assert.equal(h.rd.querySelector('.rd-heading-art').hasAttribute('data-rd-data-banner'),false);
 assert.doesNotMatch(css,/linear-gradient\(var\(--rd-bg\) calc\(100% - 28px\),transparent\)/,'the heading keeps no page colour');assert.match(css,/\.rd-workspace-heading\{background:none!important;box-shadow:none!important;\}/);
 assert.match(css,/\.rd-heading-art:not\(:has\(> \.ch-custom-banner\)\)\{display:none!important;\}/);assert.doesNotMatch(css,/--rd-band-h:220px/,'the banner height does not move the heading');
 // readability over the band follows the pack's own colours (variables), in both modes
 for(const part of ['.rd-toolbar{background:color-mix(in srgb,var(--rd-surface) 90%,transparent)','text-shadow:0 1px 0 color-mix(in srgb,var(--rd-bg) 85%,transparent)','.rd-glance-chip{background:color-mix(in srgb,var(--tone) 14%,var(--rd-surface))',':is(.rd-filter-group,.rd-week){background:color-mix(in srgb,var(--rd-surface) 90%,transparent)!important;}','.rd-arrange-guide > div:not(:empty){','.ch-help-band{background:color-mix(in srgb,var(--rd-surface) 94%,transparent)'])assert.ok(css.includes(part),part);
 h.apply(pack,{theme:'dark'});assert.match(h.root.querySelector('style').textContent,/--rd-surface:#2d2a27!important/);
 // the same theme without its band: banner in the slot, heading on the page colour
 const plain=structuredClone(input);delete plain.band;h.apply((await Theme.validate(plain)).pack);css=h.css();assert.equal(h.band(),null);assert.ok(h.rd.querySelector('.rd-data-theme-banner'));assert.match(css,/--rd-band-h:220px/);assert.doesNotMatch(css,/rd-data-theme-band\{/);
});

test('a band video loops its own clip, rests on its still for reduced motion, motion off and off screen',async t=>{
 const {pack}=await Theme.validate(videoBand({loop:{start:2,end:6}})),h=bandFixture();t.after(h.remove);h.apply(pack);const band=h.band(),video=band.querySelector('video'),img=band.querySelector('img');
 assert.ok(video&&img);assert.equal(video.loop,false,'a loop narrower than the clip is kept by seeking');assert.equal(video.muted,true);assert.equal(h.stats.plays,0,'nothing plays until it is seen');
 h.intersect(band,true);assert.equal(h.stats.plays,1);assert.equal(video.hidden,false);assert.equal(img.hidden,true);assert.ok(video.getAttribute('src'));assert.equal(video.currentTime,2);
 video.currentTime=6.2;video.dispatchEvent({type:'timeupdate'});assert.equal(video.currentTime,2,'kept inside its loop');
 const still=img.getAttribute('src');assert.equal(h.urls.get(still).type,'image/png','the still is the pack\'s still asset');
 h.reduce(true);assert.equal(video.hidden,true);assert.equal(img.hidden,false);assert.equal(img.getAttribute('src'),still);assert.equal(video.getAttribute('src'),null,'the decoder is let go');
 h.reduce(false);assert.equal(video.hidden,false);h.motion('off');assert.equal(video.hidden,true);h.motion('gentle');assert.equal(video.hidden,false);
 h.intersect(band,false);assert.equal(video.hidden,true);assert.equal(video.getAttribute('src'),null);
 h.intersect(band,true);h.rd.setAttribute('data-art-rest','');h.motion('gentle');assert.equal(video.hidden,true,'the idle rest (Graphics level, battery) holds it on its still');
 const whole=videoBand();const {pack:loopWhole}=await Theme.validate(whole);h.apply(loopWhole);assert.equal(h.band().querySelector('video').loop,false);
});

test('taking the theme away removes the band, its listeners, observers, styles and object URLs',async t=>{
 const {pack}=await Theme.validate(videoBand()),h=bandFixture();t.after(h.remove);h.apply(pack);const band=h.band();h.intersect(band,true);const urls=[...h.urls.keys()];
 assert.equal(h.winListeners.get('resize')?.size,1);
 h.remove();assert.equal(h.band(),null);assert.equal(band.parentNode,null);assert.equal(h.root.querySelector('style'),null);assert.deepEqual(h.revoked.sort(),urls.sort());assert.equal(h.winListeners.get('resize')?.size||0,0);assert.ok(h.resizes.every(o=>!o.targets.size));assert.equal(h.rd.hasAttribute('data-rd-data-theme'),false);
 assert.equal(band.querySelector('video').getAttribute('src'),null);
 // and a fresh theme without a band leaves no trace of the old one
 h.apply((await Theme.validate(theme({banner:{asset:'sky'},assets:{sky:wire(png,'image/png')}}))).pack);assert.equal(h.band(),null);assert.doesNotMatch(h.css(),/rd-data-theme-band/);
});

// ---------------------------------------------------------------- dark mode and clear parts (coordinator, 2026-11-07)
const darkBand=(dark,extra={})=>theme({band:{asset:'sky',dark},assets:{sky:wire(png,'image/png'),...extra}});
test('band.dark takes its own picture for dark mode under the same rules',async()=>{
 for(const input of [darkBand({asset:'night'},{night:wire(png,'image/png')}),darkBand({asset:'clip',stillAsset:'still',loop:{start:0,end:12}},{clip:wire(movie(),'video/mp4'),still:wire(png,'image/png')})])assert.deepEqual(Theme.portable((await Theme.validate(input)).pack),input);
 const noStill=darkBand({asset:'clip'},{clip:wire(movie(),'video/mp4')});assert.match((await Theme.problems(noStill)).join('\n'),/\$\.band\.dark\.still: a video, GIF or animated image needs a separate static still asset/);
 // the dark picture may bring its own look (focus and the rest); a field nobody knows is left out and noted
 {const input=darkBand({asset:'night',focus:{x:0,y:0}},{night:wire(png,'image/png')}),read=await Theme.validate(input);assert.deepEqual(read.pack.band.dark,{asset:'night',focus:{x:0,y:0}});assert.deepEqual(read.band.notes,[]);}
 for(const [key,value]of [['fit','cover'],['dark',{asset:'night'}],['position','left']]){const input=darkBand({asset:'night',[key]:value},{night:wire(png,'image/png')}),read=await Theme.validate(input);assert.deepEqual(read.pack.band.dark,{asset:'night'},key);assert.ok(read.band.notes.some(note=>note.path==='$.band.dark.'+key&&note.kind==='ignored'),key);}
 await assert.rejects(()=>Theme.validate(darkBand({asset:'night',loop:{start:0,end:1}},{night:wire(png,'image/png')})),/\$\.band\.dark\.loop: a loop is only valid for video/);
 await assert.rejects(()=>Theme.validate(darkBand({asset:'clip',stillAsset:'still',loop:{start:0,end:13}},{clip:wire(movie(),'video/mp4'),still:wire(png,'image/png')})),/\$\.assets\.clip: (?:Choose a valid video loop|Invalid media framing time)/);
 await assert.rejects(()=>Theme.validate(darkBand({asset:'face'},{face:{type:'font/woff2',data:Buffer.from('wOF2').toString('base64'),sha256:hash(Buffer.from('wOF2'))}})),/\$\.band\.dark\.asset: unsupported asset type/);
 await assert.rejects(()=>Theme.validate(darkBand('night',{night:wire(png,'image/png')})),/\$\.band\.dark: expected a plain object/);
 // a dark video is a band video: as wide as the band's
 const calls=[],input=darkBand({asset:'clip',stillAsset:'still'},{clip:wire(movie(4096,512),'video/mp4'),still:wire(png,'image/png')});await Theme.validate(input,{media:{async prepare(blob,slot,name,options){calls.push({slot,name,options});const video=blob.type.startsWith('video/');return {asset:{mediaId:'0f8fad5b-d9cb-469f-a165-70867728950e',name,type:blob.type,kind:video?'video':'image',width:video?4096:1,height:video?512:1,...(video?{duration:12}:{}),palette:[]},blob,...(video?{poster:new Blob([png],{type:'image/png'})}:{})};}}});
 assert.equal(calls.find(c=>c.name==='clip').slot,'band');
});

test('with band.dark the mode picks the picture; without it the one band shows in both modes',async t=>{
 const {pack}=await Theme.validate(theme({band:{asset:'clip',stillAsset:'still',dark:{asset:'night',stillAsset:'still'}},assets:{clip:wire(movie(),'video/mp4'),night:wire(movie(),'video/mp4'),still:wire(png,'image/png')}}));const h=bandFixture();t.after(h.remove);h.apply(pack,{theme:'light'});
 const bands=h.rd.querySelectorAll('.rd-data-theme-band'),light=bands.find(b=>!b.hasAttribute('data-rd-band')),dark=bands.find(b=>b.getAttribute('data-rd-band')==='dark');assert.equal(bands.length,2);assert.ok(light&&dark);
 assert.equal(light.hidden,false);assert.equal(dark.hidden,true);for(const b of bands)assert.equal(b.style['--rd-pack-band'],'248px');
 h.intersect(light,true);h.intersect(dark,true);assert.ok(light.querySelector('video').getAttribute('src'));assert.equal(dark.querySelector('video').getAttribute('src'),null,'the hidden picture never plays');
 h.apply(pack,{theme:'dark'});assert.equal(light.hidden,true);assert.equal(dark.hidden,false);h.intersect(dark,true);assert.ok(dark.querySelector('video').getAttribute('src'));assert.equal(light.querySelector('video').getAttribute('src'),null);assert.ok(h.urls.get(dark.querySelector('video').getAttribute('src')));
 assert.match(h.css(),/> \.rd-data-theme-band\[hidden\]\{display:none!important;\}/);
 h.remove();assert.equal(h.rd.querySelectorAll('.rd-data-theme-band').length,0);
 // one band, dark mode: the same picture, the title block's pool deeper and the greeting haloed
 const {pack:one}=await Theme.validate(imageBand()),g=bandFixture();t.after(g.remove);g.apply(one,{theme:'dark'});assert.equal(g.rd.querySelectorAll('.rd-data-theme-band').length,1);assert.equal(g.band().hidden,false);
 const css=g.css();assert.match(css,/--rd-bg:#22201e!important/);assert.match(css,/\.rd-course-heading::before\{content:""!important;display:block!important;[^}]*radial-gradient\(ellipse 100% 50% at 0 50%,color-mix\(in srgb,var\(--rd-bg\) 85%,transparent\)/);assert.match(css,/h1\{text-shadow:0 1px 2px color-mix\(in srgb,var\(--rd-bg\) 90%,transparent\)/);
 g.apply(one,{theme:'light'});assert.match(g.css(),/radial-gradient\(ellipse 100% 50% at 0 50%,color-mix\(in srgb,var\(--rd-bg\) 72%,transparent\)/);assert.doesNotMatch(g.css(),/h1\{text-shadow:0 1px 2px/);
});

test('a band with clear parts shows the page colour through them: nothing is painted under the picture',async t=>{
 const {pack}=await Theme.validate(imageBand()),h=bandFixture();t.after(h.remove);h.apply(pack);const css=h.css(),rule=/> \.rd-data-theme-band\{([^}]*)\}/.exec(css)[1],media=/> \.rd-data-theme-band > img,[^{]*\{([^}]*)\}/.exec(css)[1];
 assert.match(rule,/background:none;/);assert.doesNotMatch(rule,/background-color|background:(?!none)/);assert.match(media,/background:none;/);
 assert.match(css,/\.rd-workspace-heading\{background:none!important;/,'the heading lets it through too');
 for(const type of ['image/png','image/webp','image/svg+xml'])assert.ok(require('../extension/pack-common.js').imageTypes.includes(type));
});

test('Make it yours and the checker preview show the band, the dark one in the dark sample',async()=>{
 const make=require('../extension/make-your-own.js'),checker=require('../scripts/check-pack.cjs');
 const svg=mark=>Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 10"><rect width="80" height="10" fill="'+mark+'"/></svg>');
 const input=theme({band:{asset:'day',dark:{asset:'night'}},assets:{day:wire(svg('#ffeedd'),'image/svg+xml'),night:wire(svg('#112233'),'image/svg+xml')}}),{pack}=await Theme.validate(input);
 const html=make.preview(pack),[light,dark]=html.split('</section>');assert.match(light,/<figcaption>Band<\/figcaption>/);assert.match(light,/ffeedd/);assert.match(dark,/112233/);assert.match(light,/width="320" height="40"/);
 const page=checker.preview({pack,media:[],kind:'theme'});assert.equal((page.match(/class="band"/g)||[]).length,4);assert.match(page,/band\.dark still/);
});

// Owner, 2026-11-16 ("the banner theme shrinks then extend for no reason"): with the courses as the dock or across the top,
// Home scrolls inside its work area under a band that stays where it is. The band was measured where the desk stood on the
// screen, so after a scroll the next render (a selection, an archive) shrank it by the scroll, and a render back at the top
// grew it again. It is measured where the desk starts in the page.
test('the band keeps its height while the work area is scrolled (it measures the page, not the screen)',async t=>{
 const {pack}=await Theme.validate(imageBand()),h=bandFixture();t.after(h.remove);h.apply(pack);const band=h.band();
 h.geometry.main.top=50+410;h.fire('resize');assert.equal(band.style['--rd-pack-band'],'410px');
 const work=h.rd.querySelector('.rd-workspace');work.scrollTop=120;h.geometry.main.top=50+410-120;h.fire('resize');
 assert.equal(band.style['--rd-pack-band'],'410px','scrolled 120 px: the same band');
 work.scrollTop=0;h.geometry.main.top=50+410;h.fire('resize');assert.equal(band.style['--rd-pack-band'],'410px');
 // a real change of the desk's place still moves it
 h.geometry.main.top=50+450;h.fire('resize');assert.equal(band.style['--rd-pack-band'],'450px');
});
test('the packaged scenes measure their band the same way (scene-themes.js)',()=>{
 const src=read('scene-themes.js').replace(/\n\s*/g,'');
 assert.match(src,/for\(const el of within\.querySelectorAll\(BAND\)\)\{const r=el\.getBoundingClientRect\?\.\(\);if\(!r\|\|!\(r\.width>200\)\)continue;let y=r\.top-top;for\(let p=el\.parentElement;p&&p!==rd;p=p\.parentElement\)y\+=p\.scrollTop\|\|0;if\(y>80\)first=Math\.min\(first,y\);\}/);
});
