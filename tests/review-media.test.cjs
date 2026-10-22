'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
const {createDOM,settle,deferred}=require('./market-fixture.cjs'),{fixture:dashboard}=require('./dashboard-heading-fixture.cjs');
const Frame=require('../extension/media-frame.js'),Customization=require('../extension/customization-model.js'),CustomArt=require('../extension/custom-art.js');
const owned=new Set(['course-art.js','data-theme.js','media-store.js']),source=file=>fs.readFileSync(path.join(__dirname,'..',process.env.CH_REVIEW_MEDIA_ORIGINALS==='1'&&owned.has(file)?'.review-originals':'extension',file),'utf8');
const load=(env,file)=>vm.runInContext(source(file),env,{filename:file}),plain=value=>JSON.parse(JSON.stringify(value));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const ref=(extra={})=>({mediaId:webcrypto.randomUUID(),name:'Course artwork.webp',kind:'image',type:'image/webp',width:1,height:1,palette:[],...extra});
function webp(){
 const chunk=(tag,body)=>{const size=Buffer.alloc(4);size.writeUInt32LE(body.length);return Buffer.concat([Buffer.from(tag),size,body,Buffer.alloc(body.length%2)]);},pixels=Buffer.from([48,1,0,157,1,42,1,0,1,0]);
 const body=Buffer.concat([chunk('VP8X',Buffer.from([2,0,0,0,0,0,0,0,0,0])),chunk('ANIM',Buffer.alloc(6)),...Array.from({length:2},()=>chunk('ANMF',Buffer.concat([Buffer.alloc(16),chunk('VP8 ',pixels)])))]),size=Buffer.alloc(4);size.writeUInt32LE(body.length+4);return Buffer.concat([Buffer.from('RIFF'),size,Buffer.from('WEBP'),body]);
}
function mp4(){
 const integer=n=>{const bytes=Buffer.alloc(4);bytes.writeUInt32BE(n);return bytes;},box=(tag,...parts)=>{const body=Buffer.concat(parts);return Buffer.concat([integer(body.length+8),Buffer.from(tag),body]);};
 const timing=Buffer.alloc(100),track=Buffer.alloc(84),handler=Buffer.alloc(24);timing.writeUInt32BE(1000,12);timing.writeUInt32BE(1000,16);track.writeUInt32BE(65536,76);track.writeUInt32BE(65536,80);handler.write('vide',8);
 return Buffer.concat([box('ftyp',Buffer.from('isom'),integer(0),Buffer.from('isom')),box('moov',box('mvhd',timing),box('trak',box('tkhd',track),box('mdia',box('hdlr',handler)))),box('mdat',Buffer.from([1]))]);
}
const svg={name:'Course.svg',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M0 0L100 50"/></svg>'};
for(const [name,asset]of [['photo',ref()],['video',ref({name:'Course.mp4',kind:'video',type:'video/mp4',duration:8})],['SVG',svg]])test('saved framed '+name+' mounts after Full changes to Custom with course artwork and no editor',t=>{
 const saved=plain(Customization.cleanAppearance({bannerArt:{...Frame.resolve(asset),zoom:2}}));let h;
 assert.doesNotThrow(()=>{h=dashboard({setup({env,store}){
  load(env,'features.js');assert.ok(env.ReserveFeatures.resolve('full').js.includes('media-frame.js'));
  const selection=env.ReserveFeatures.apply({preset:'custom',custom:['dashboard','course-art']});assert.equal(selection.js.includes('media-frame.js'),false);assert.equal(selection.js.includes('media-store.js'),false);
  env.ReserveCustomArt=CustomArt;load(env,'course-art.js');store.get().settings.coursePrefs['10']=plain(saved);
 }});});t.after(()=>h?.dashboard.destroy());assert.ok(h.container.querySelector('.rd-course-heading'));assert.deepEqual(plain(h.store.get().settings.coursePrefs['10']),saved);
 const markup=h.env.ReserveCourseArt.scene({id:'10',artPrefs:saved,artMotion:true});assert.ok(markup);assert.doesNotMatch(markup,/data-ch-frame/);
 if(name==='SVG')assert.match(markup,/reserve-custom-art--banner/);else assert.match(markup,/<svg class="rd-art"/);
});
test('framed media uses the saved asset when only the frame renderer is absent',()=>{
 const env=vm.createContext({Blob,URL,ReserveCustomArt:CustomArt});load(env,'media-reference.js');load(env,'media-store.js');load(env,'course-art.js');
 for(const asset of [ref(),ref({kind:'video',type:'video/mp4',duration:8})]){const value=Frame.resolve(asset),before=plain(value),markup=env.ReserveCourseArt.scene({id:'10',artPrefs:{bannerArt:value}}),doc=createDOM('<div>'+markup+'</div>'),img=doc.querySelector('img');assert.ok(img);assert.equal(img.dataset.chMedia,asset.mediaId);assert.equal(img.dataset.chPoster,asset.kind==='video'?'true':undefined);assert.deepEqual(plain(value),before);}
});
function runtime({intersection=true,reduced=false}={}){
 const document=createDOM('<html><body><div id="host"><div id="root"><main class="rd" data-theme="light" data-motion-style="gentle"><span class="rd-heading-art" aria-hidden="true"><svg></svg></span><span class="rd-title-art" aria-hidden="true"></span></main></div></div></body></html>');
 const host=document.getElementById('host'),root=document.getElementById('root'),rd=root.querySelector('.rd'),urls=new Map(),revoked=[],intersections=[],mutations=[],windowEvents=new Map(),mediaListeners=new Set(),media={matches:reduced,addEventListener:(type,fn)=>mediaListeners.add(fn),removeEventListener:(type,fn)=>mediaListeners.delete(fn)};let serial=0,decodes=0,closed=0;
 root.host=host;document.hidden=false;document.visibilityState='visible';
 const decorate=node=>{
  node.ownerDocument=document;node.rect={width:600,height:140,left:0,top:0,right:600,bottom:140};node.getBoundingClientRect=()=>node.rect;
  node.insertBefore=(child,before)=>{if(child===before)return child;child.remove();const at=node.childNodes.indexOf(before);child.parentNode=node;node.childNodes.splice(at<0?node.childNodes.length:at,0,child);return child;};
  if(['IMG','VIDEO'].includes(node.tagName))for(const key of ['src','poster'])Object.defineProperty(node,key,{get(){return this.getAttribute(key)||'';},set(value){this.setAttribute(key,value);}});
  if(node.tagName==='VIDEO'){node.plays=node.pauses=node.loads=0;node.currentTime=0;node.readyState=2;node.play=()=>{node.plays++;return Promise.resolve();};node.pause=()=>node.pauses++;node.load=()=>node.loads++;}
  if(node.tagName==='CANVAS'){node.getContext=()=>({drawImage(){},getImageData:()=>({data:new Uint8Array([60,90,120,255])})});node.toBlob=fn=>fn(new Blob([png],{type:'image/png'}));}
  return node;
 };
 const create=document.createElement;document.createElement=tag=>decorate(create(tag));for(const node of document.querySelectorAll('*'))decorate(node);
 const env=vm.createContext({document,Blob,URL:{createObjectURL(blob){const url='blob:review-media-'+(++serial);urls.set(url,blob);return url;},revokeObjectURL:url=>revoked.push(url)},TextEncoder,Uint8Array,ArrayBuffer,atob,btoa,crypto:webcrypto,setTimeout,clearTimeout,console,innerWidth:1000,innerHeight:800,
  createImageBitmap:async()=>{decodes++;return {width:1,height:1,close(){closed++;}};},matchMedia:()=>media,
  getComputedStyle:node=>({display:node.hidden||node.style.display==='none'?'none':'block',visibility:node.style.visibility||'visible'}),
  MutationObserver:class{constructor(fn){this.fn=fn;mutations.push(this);}observe(){}disconnect(){this.dead=true;}},
  addEventListener(type,fn){if(!windowEvents.has(type))windowEvents.set(type,new Set());windowEvents.get(type).add(fn);},removeEventListener:(type,fn)=>windowEvents.get(type)?.delete(fn)});
 if(intersection)env.IntersectionObserver=class{constructor(fn){this.fn=fn;this.targets=new Set();intersections.push(this);}observe(node){this.targets.add(node);}unobserve(node){this.targets.delete(node);}disconnect(){this.dead=true;this.targets.clear();}};
 document.defaultView=env;load(env,'media-reference.js');load(env,'media-store.js');load(env,'data-theme.js');load(env,'course-art.js');
 return {env,document,root,host,rd,urls,revoked,intersections,mediaListeners,mutations,get decodes(){return decodes;},get closed(){return closed;},
  intersect(node,value){for(const observer of intersections)if(!observer.dead&&observer.targets.has(node))observer.fn([{target:node,isIntersecting:value}]);},
  reduce(value){media.matches=value;for(const fn of mediaListeners)fn({matches:value});},mutate(){for(const observer of mutations)if(!observer.dead)observer.fn([]);},
  visibility(value){document.hidden=value;document.visibilityState=value?'hidden':'visible';document.dispatchEvent({type:'visibilitychange'});},
  resize(){for(const fn of windowEvents.get('resize')||[])fn();},
  released(){assert.equal(revoked.length,urls.size);assert.equal(new Set(revoked).size,urls.size);for(const url of urls.keys())assert.ok(revoked.includes(url));}};
}
const themeAsset=(type,bytes)=>({type,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')}),colors={light:{bg:'#ffffff',surface:'#ffffff',ink:'#111111',muted:'#555555',line:'#cccccc',accent:'#0055aa'}};
function theme({video=true,banner=false}={}){return {format:'chtheme',version:1,name:'Local media',colors,background:{asset:'live',still:'poster',fit:'cover',position:'center'},...(banner?{banner:{asset:'live',still:'poster',fit:'contain',position:'right'}}:{}),assets:{live:themeAsset(video?'video/mp4':'image/webp',video?mp4():webp()),poster:themeAsset('image/png',png)}};}
function applyTheme(t,h,pack){h.env.ReserveDataTheme.apply(h.root,h.rd,pack);t.after(()=>h.env.ReserveDataTheme.remove(h.rd));return h.rd.querySelector('.rd-data-theme-background');}
test('unframed theme video offscreen inside a visible dashboard pauses and drops its decoder source',t=>{
 const h=runtime(),pack=theme(),bg=applyTheme(t,h,pack),video=bg.querySelector('video'),poster=bg.querySelector('img'),live=video.src,still=poster.src,plays=video.plays,loads=video.loads;assert.ok(live);assert.equal(plays,1);
 h.intersect(h.rd,true);h.intersect(bg,false);assert.equal(h.rd.hidden,false);assert.equal(video.src,'');assert.equal(video.preload,'none');assert.equal(video.hidden,true);assert.equal(poster.hidden,false);assert.equal(poster.src,still);assert.equal(video.pauses,1);assert.equal(video.loads,loads+1);
 h.intersect(bg,false);assert.equal(video.pauses,1);assert.equal(video.loads,loads+1);h.intersect(bg,true);assert.equal(video.src,live);assert.equal(video.plays,plays+1);assert.equal(h.urls.size,2);
 h.env.ReserveDataTheme.remove(h.rd);h.released();assert.ok(h.intersections.every(observer=>observer.dead));
});
test('unframed placements of the same theme video hand over one decoder as each leaves view',t=>{
 const h=runtime(),bg=applyTheme(t,h,theme({banner:true})),banner=h.rd.querySelector('.rd-data-theme-banner'),backgroundVideo=bg.querySelector('video'),bannerVideo=banner.querySelector('video');
 assert.equal([backgroundVideo,bannerVideo].filter(video=>video.hasAttribute('src')).length,1);assert.ok(bannerVideo.src);assert.equal(backgroundVideo.src,'');h.intersect(banner,false);assert.equal(bannerVideo.src,'');assert.ok(backgroundVideo.src);h.intersect(bg,false);assert.equal(backgroundVideo.src,'');h.intersect(banner,true);assert.ok(bannerVideo.src);assert.equal(h.urls.size,2);
 h.env.ReserveDataTheme.remove(h.rd);h.released();
});
test('unframed animated theme pictures use a static poster when their placement is offscreen',t=>{
 const h=runtime(),bg=applyTheme(t,h,theme({video:false})),img=bg.querySelector('img'),live=img.src;assert.equal(h.urls.get(live).type,'image/webp');h.intersect(h.rd,true);h.intersect(bg,false);assert.equal(h.urls.get(img.src).type,'image/png');assert.notEqual(img.src,live);h.intersect(bg,true);assert.equal(img.src,live);assert.equal(h.urls.size,2);
 h.env.ReserveDataTheme.remove(h.rd);h.released();
});
test('unframed theme motion changes release decoder sources immediately and reuse cached URLs',t=>{
 const h=runtime(),pack=theme(),bg=applyTheme(t,h,pack),video=bg.querySelector('video'),live=video.src;
 for(const [stop,resume]of [[()=>h.reduce(true),()=>h.reduce(false)],[()=>{h.rd.dataset.motionStyle='off';h.mutate();},()=>{h.rd.dataset.motionStyle='gentle';h.mutate();}],[()=>h.visibility(true),()=>h.visibility(false)]]){stop();assert.equal(video.src,'');assert.equal(bg.querySelector('img').hidden,false);resume();assert.equal(video.src,live);assert.equal(video.hidden,false);assert.equal(h.urls.size,2);}
 h.env.ReserveDataTheme.remove(h.rd);h.released();
});
test('theme scroll fallback stops an unframed offscreen placement without IntersectionObserver',t=>{
 const h=runtime({intersection:false}),bg=applyTheme(t,h,theme()),video=bg.querySelector('video');bg.rect={width:600,height:140,left:0,top:900,right:600,bottom:1040};h.document.dispatchEvent({type:'scroll'});assert.equal(video.src,'');bg.rect.top=0;bg.rect.bottom=140;h.resize();assert.ok(video.src);h.env.ReserveDataTheme.remove(h.rd);h.released();
});
async function title(t,h,{delayed,missingPoster=false}={}){
 const input=new Blob([webp()],{type:'image/webp'}),row=await h.env.ReserveMedia.prepare(input,'title','Small animated title.webp');assert.equal(row.asset.animated,true);assert.equal(row.blob,input);assert.ok(row.poster);assert.equal(h.closed,1);
 if(missingPoster)delete row.poster;
 const markup=h.env.ReserveCourseArt.title({id:'10',artPrefs:{titleArt:row.asset},artMotion:true}),holder=h.rd.querySelector('.rd-title-art');holder.innerHTML=markup;const node=holder.querySelector('[data-ch-media]');Object.defineProperty(node,'src',{get(){return this.getAttribute('src')||'';},set(value){this.setAttribute('src',value);}});node.getBoundingClientRect=()=>node.rect||({width:100,height:50,left:0,top:0,right:100,bottom:50});
 const errors=[],controller=h.env.ReserveMedia.createController(h.rd,{get:()=>delayed?delayed.promise:Promise.resolve(row)},{motion:()=>h.rd.dataset.motionStyle==='gentle',onError:error=>errors.push(error)});t.after(()=>controller.destroy());return {row,node,controller,errors};
}
test('uploaded animated WebP titles use their static poster for live Motion and reduced-motion changes',async t=>{
 const h=runtime(),{row,node,controller}=await title(t,h);controller.sync();await settle();h.intersect(node,true);const live=node.src;assert.equal(h.urls.get(live),row.blob);
 h.rd.dataset.motionStyle='off';h.mutate();const still=node.src;assert.equal(h.urls.get(still),row.poster);assert.notEqual(still,live);h.rd.dataset.motionStyle='gentle';h.mutate();assert.equal(node.src,live);h.reduce(true);assert.equal(node.src,still);h.reduce(false);assert.equal(node.src,live);h.visibility(true);assert.equal(node.src,still);h.visibility(false);assert.equal(node.src,live);assert.equal(h.urls.size,2);assert.equal(h.decodes,1);
 controller.destroy();h.released();assert.equal(node.src,'');assert.equal(h.mediaListeners.size,0);
});
test('uploaded animated titles stay still until visible and return to the poster offscreen',async t=>{
 const h=runtime(),{row,node,controller}=await title(t,h);controller.sync();await settle();assert.equal(h.urls.get(node.src),row.poster);h.intersect(node,true);assert.equal(h.urls.get(node.src),row.blob);h.intersect(h.rd,true);h.intersect(node,false);assert.equal(h.urls.get(node.src),row.poster);h.intersect(node,true);assert.equal(h.urls.get(node.src),row.blob);assert.equal(h.urls.size,2);controller.destroy();h.released();
});
test('animated title scroll fallback checks initial visibility and follows scroll and resize',async t=>{
 const h=runtime({intersection:false}),{row,node,controller}=await title(t,h);node.rect={width:100,height:50,left:0,top:900,right:100,bottom:950};controller.sync();await settle();assert.equal(h.urls.get(node.src),row.poster);node.rect.top=0;node.rect.bottom=50;h.document.dispatchEvent({type:'scroll'});assert.equal(h.urls.get(node.src),row.blob);node.rect.top=900;node.rect.bottom=950;h.resize();assert.equal(h.urls.get(node.src),row.poster);controller.destroy();h.released();
});
test('removing hydrated animated titles releases both URLs exactly once',async t=>{
 const h=runtime(),{node,controller}=await title(t,h);controller.sync();await settle();h.intersect(node,true);node.remove();controller.sync();assert.equal(node.src,'');h.released();controller.destroy();h.released();
});
test('removed or destroyed title hydration never creates orphan object URLs',async t=>{
 for(const remove of [true,false]){const h=runtime(),pending=deferred(),{row,node,controller}=await title(t,h,{delayed:pending});controller.sync();if(remove){node.remove();controller.sync();}else controller.destroy();pending.resolve(row);await settle();assert.equal(h.urls.size,0);assert.equal(node.src,'');controller.destroy();h.released();}
});
test('animated title records without a static poster fail safely without attaching live animation',async t=>{
 const h=runtime(),{node,controller,errors}=await title(t,h,{missingPoster:true});controller.sync();await settle();assert.equal(node.src,'');assert.equal(errors.length,1);assert.match(errors[0].message,/missing/i);controller.destroy();h.released();
});
