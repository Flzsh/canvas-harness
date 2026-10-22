'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {createDOM,read}=require('./scene-dom-fixture.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture({motion='gentle',reduced=false,hidden=false}={}){
 const document=createDOM('<html><body><div id="host"><div id="shadow"><main class="rd"><div class="rd-rail-course"><span class="rd-rail-art"><svg></svg></span><i class="rd-frame"></i></div></main></div></div></body></html>');
 const host=document.getElementById('host'),shadow=document.getElementById('shadow'),rd=shadow.querySelector('.rd');shadow.host=host;
 const frames=new Map(),timers=new Map(),observers=[],intersections=[],windowEvents=new Map(),listeners=new Set(),messages=[];let sequence=0,plays=0,pauses=0,now=0,draws=0;
 const decorate=el=>{el.ownerDocument=document;el.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:300,right:1000,bottom:300});
  el.style.getPropertyValue=key=>el.style[key]||'';el.style.getPropertyPriority=()=>'';
  el.prepend=node=>{node.remove();node.parentNode=el;el.childNodes.unshift(node);};
  if(el.tagName==='VIDEO'){el.play=()=>{plays++;return Promise.resolve();};el.pause=()=>pauses++;el.load=()=>{};}
  if(el.tagName==='CANVAS')el.getContext=()=>new Proxy({},{get:(target,key)=>key in target?target[key]:key==='createRadialGradient'||key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{draws++;},set:(target,key,value)=>{target[key]=value;return true;}});return el;};
 const create=document.createElement;document.createElement=tag=>decorate(create(tag));for(const el of document.querySelectorAll('*'))decorate(el);
 const wrap=el=>{const add=el.addEventListener.bind(el),remove=el.removeEventListener.bind(el);el.addEventListener=(type,fn,...rest)=>{listeners.add(fn);add(type,fn,...rest);};el.removeEventListener=(type,fn,...rest)=>{listeners.delete(fn);remove(type,fn,...rest);};};
 wrap(document);wrap(document.documentElement);wrap(rd);host.hidden=hidden;rd.dataset.motionStyle=motion;document.visibilityState='visible';
 const mediaListeners=new Set(),media={matches:reduced,addEventListener:(type,fn)=>{listeners.add(fn);mediaListeners.add(fn);},removeEventListener:(type,fn)=>{listeners.delete(fn);mediaListeners.delete(fn);}};
 class Observer{constructor(fn){this.fn=fn;this.targets=[];observers.push(this);}observe(el,opts){this.targets.push({el,opts});}disconnect(){this.disconnected=true;}}
 const env=vm.createContext({document,URL,console,innerWidth:1200,innerHeight:800,devicePixelRatio:1,performance:{now:()=>now},chrome:{runtime:{getURL:file=>'chrome-extension://scene-test/'+file}},matchMedia:()=>media,
  MutationObserver:Observer,IntersectionObserver:class extends Observer{constructor(fn){super(fn);intersections.push(this);}},getComputedStyle:el=>({display:el.hidden?'none':'block',visibility:el.style.visibility||'visible'}),
  requestAnimationFrame:fn=>{const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  addEventListener:(type,fn)=>{listeners.add(fn);windowEvents.set(type,fn);},removeEventListener:(type,fn)=>{listeners.delete(fn);windowEvents.delete(type);}});
 vm.runInContext(read('scene-themes.js'),env,{filename:'scene-themes.js'});
 const flush=map=>{const entries=[...map];map.clear();if(map===frames)now+=1000/60;for(const [,fn]of entries)fn(now);};
 return {document,host,shadow,rd,env,api:env.ReserveSceneThemes,frames,timers,observers,intersections,media,messages,listeners,
  apply:id=>env.ReserveSceneThemes.apply(shadow,rd,id,{motionStyle:rd.dataset.motionStyle}),
  pointer:(x,y)=>windowEvents.get('pointermove')?.({clientX:x,clientY:y}),leave:()=>document.documentElement.dispatchEvent({type:'pointerleave'}),
  raf:()=>flush(frames),settle:()=>flush(timers),mutate:()=>{for(const o of observers)if(!o.disconnected)o.fn([]);},
  setReduced:value=>{media.matches=value;for(const fn of mediaListeners)fn({matches:value});},
  visibility:value=>{document.visibilityState=value;document.dispatchEvent({type:'visibilitychange'});},get draws(){return draws;},get plays(){return plays;},get pauses(){return pauses;}};
}
test('None and a disabled Scene feature create no scene assets or observers',()=>{
 const h=fixture(),before=h.shadow.innerHTML;h.apply('');assert.equal(h.shadow.innerHTML,before);assert.equal(h.observers.length,0);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
 h.env.ReserveFeatures={enabled:()=>false};h.apply('sea');assert.equal(h.shadow.innerHTML,before);assert.equal(h.observers.length,0);
});
test('visible names are exact and the four packaged styles and motifs are independent',()=>{
 const h=fixture();assert.deepEqual(plain(h.api.names),{starry:'Starry Night',sea:'Under the Sea',stars:'Starfield',blueprint:'Blueprint'});
 for(const [id,motifs]of Object.entries({starry:['moon','star','swirl','cypress','cottage','sunflower'],sea:['turtle','fish','coral','jelly','shell','ray'],stars:['giant','binary','galaxy','redgiant','cluster','nebula'],blueprint:['gear','divider','pendulum','rocket','orbit','bulb']})){
  h.rd.innerHTML=Array.from({length:6},()=>'<span class="rd-rail-art"><svg></svg></span>').join('');h.apply(id);h.apply(id);
  assert.equal(h.shadow.querySelectorAll('link').length,1);assert.equal(h.shadow.querySelector('link').getAttribute('href'),'chrome-extension://scene-test/themes/'+id+'/theme.css');
  assert.equal(h.rd.firstChild.className,'tk-sky');assert.deepEqual(h.rd.querySelectorAll('.tk-icon').map(icon=>icon.dataset.motif),motifs);
  assert.equal(h.rd.querySelector('iframe'),null);assert.equal(h.rd.querySelectorAll('svg').length,6);
 }
 h.api.remove();assert.equal(h.listeners.size,0);assert.equal(h.frames.size,0);assert.ok(h.observers.every(o=>o.disconnected));
});
for(const id of ['starry','sea','blueprint'])test(id+' video is local, muted and lazy; hidden and reduced motion show the poster',()=>{
 const h=fixture({hidden:true});h.apply(id);const video=h.rd.querySelector('video'),poster=h.rd.querySelector('.tk-poster');
 assert.equal(video.muted,true);assert.equal(video.loop,true);assert.equal(video.playsInline,true);assert.equal(video.getAttribute('src'),null);assert.equal(h.plays,0);assert.equal(poster.hidden,false);
 h.host.hidden=false;h.mutate();h.settle();assert.equal(video.getAttribute('src'),'chrome-extension://scene-test/themes/'+id+'/sky.mp4');assert.equal(h.plays,1);assert.equal(poster.hidden,true);
 h.visibility('hidden');assert.equal(video.autoplay,false);assert.equal(video.hidden,true);assert.equal(poster.hidden,false);assert.equal(h.rd.hasAttribute('data-scene-paused'),true);
 h.visibility('visible');assert.equal(h.plays,2);h.setReduced(true);assert.equal(video.hidden,true);assert.equal(poster.hidden,false);
 h.api.remove();assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);assert.equal(h.listeners.size,0);assert.equal(h.rd.hasAttribute('data-scene-paused'),false);
});
for(const motion of ['still','off'])test(motion+' does not start scene media or pointer animation',()=>{
 const h=fixture({motion});for(const id of ['starry','sea','blueprint','stars']){h.apply(id);assert.equal(h.plays,0);assert.equal(h.rd.querySelector('.tk-poster').hidden,false);h.raf();h.pointer(100,50);assert.equal(h.frames.size,0);}h.api.remove();
});
test('Starfield uses a local canvas, coalesces pointer work and pauses both drawing chains',()=>{
 const h=fixture();h.apply('stars');assert.equal(h.rd.querySelector('iframe'),null);assert.ok(h.rd.querySelector('.tk-sky canvas'));assert.ok(h.rd.querySelector('.tk-starframes'));h.raf();assert.ok(h.draws>0);
 const count=h.frames.size;h.pointer(100,40);h.pointer(200,50);assert.equal(h.frames.size,count+1,'input shares one frame');h.raf();assert.ok(h.frames.size<=3,'one sky, one frame-ring and one input chain at most');
 h.visibility('hidden');assert.equal(h.frames.size,0);const draws=h.draws;h.pointer(250,50);h.raf();assert.equal(h.draws,draws);assert.equal(h.rd.querySelector('.tk-poster').hidden,false);
 h.visibility('visible');assert.ok(h.frames.size>0);h.setReduced(true);h.raf();assert.equal(h.frames.size,0);h.api.remove();assert.equal(h.listeners.size,0);
});
test('scene sky outside the viewport rests while frame rings remain available',()=>{
 const h=fixture();h.apply('stars');h.raf();h.intersections[0].fn([{target:h.rd.querySelector('.tk-sky'),isIntersecting:false}]);h.raf();assert.equal(h.frames.size,0);assert.equal(h.rd.querySelector('.tk-poster').hidden,false);
 h.pointer(150,80);h.raf();assert.ok(h.frames.size<=1);h.intersections[0].fn([{target:h.rd,isIntersecting:false}]);assert.equal(h.frames.size,0);h.api.remove();
});
test('debounced rerenders restore sky and motifs without duplicates; None cancels pending work',()=>{
 const h=fixture();h.apply('sea');h.rd.innerHTML=Array.from({length:8},()=>'<span class="rd-rail-art"><svg></svg></span>').join('');h.mutate();h.mutate();assert.equal(h.timers.size,1);h.settle();
 assert.equal(h.rd.firstChild.className,'tk-sky');assert.deepEqual(h.rd.querySelectorAll('.tk-icon').map(icon=>icon.dataset.motif),['turtle','fish','coral','jelly','shell','ray','turtle','fish']);
 h.mutate();h.apply('');h.raf();h.settle();assert.equal(h.rd.querySelector('.tk-sky'),null);assert.equal(h.shadow.querySelector('link'),null);assert.equal(h.listeners.size,0);
});
test('motion and idle rest changes pause a live scene and resume with a fresh clock',()=>{
 const h=fixture();h.apply('stars');h.raf();h.rd.dataset.motionStyle='still';h.mutate();h.settle();h.raf();assert.equal(h.frames.size,0);
 h.rd.dataset.motionStyle='gentle';h.mutate();h.settle();assert.ok(h.frames.size>0);h.rd.setAttribute('data-art-rest','');h.mutate();h.settle();h.raf();assert.equal(h.frames.size,0);h.api.remove();
});
test('remove restores a previous theme and pause attribute; stale dashboards cannot remove the current scene',()=>{
 const h=fixture();h.rd.dataset.themeKit='previous';h.rd.setAttribute('data-scene-paused','');const before=h.shadow.innerHTML;h.apply('sea');h.api.remove({});h.api.apply(h.shadow,{},'');assert.equal(h.rd.dataset.themeKit,'sea');h.api.remove(h.rd);assert.equal(h.shadow.innerHTML,before);
});
test('Starfield pointer reach stays small and its optional document shares the local renderer',()=>{
 const source=read('scene-themes.js');assert.equal((source.match(/REACH\s*=\s*20\b/g)||[]).length,2);assert.doesNotMatch(source,/postMessage|sky\.html|sky\.js|data-ch-media/);
 assert.match(read('themes/stars/sky.html'),/<title>Starfield<\/title>/);assert.match(read('themes/stars/sky.html'),/src="\.\.\/\.\.\/scene-themes\.js"/);
 assert.match(read('themes/stars/sky.js'),/ReserveSceneThemes\?\.createStarSky/);assert.doesNotMatch(read('themes/stars/sky.js'),/fetch\(|https?:\/\//);
});
