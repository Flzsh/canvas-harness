'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{createHash}=require('node:crypto');
const {createDOM,read}=require('./market-fixture.cjs');
const light={bg:'#F6F1E7',surface:'#FFFDF8',ink:'#1B1A18',muted:'#5E5D59',line:'#D9D6CA',accent:'#7A5BA8'};
const dark={bg:'#14121A',surface:'#1E1B26',ink:'#F1EDF6',muted:'#B9B2C6',line:'#3A3546',accent:'#C9A8F0'};
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0L100 100"/></svg>';
const moving='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>path{animation:drift 4s infinite}@keyframes drift{to{opacity:.5}}</style><path d="M0 0L100 100"/></svg>';
function asset(type,data,extra={}){const bytes=Buffer.from(data);return {type,data:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex'),...extra};}
function pack(extra={}){return {format:'chtheme',version:1,name:'Night garden',colors:{light:{...light},dark:{...dark}},...extra};}
function illustrated(extra={}){return pack({background:{asset:'sky',still:'poster',fit:'cover',position:'top'},banner:{asset:'banner',fit:'contain',position:'right'},frames:{panel:{asset:'frame',slice:[24,20,18,16]},card:{asset:'frame',slice:[8,7,6,5]}},title:{asset:'font',family:'A name never used as CSS',weight:700,license:'OFL-1.1'},icons:['icon','second'],assets:{sky:asset('video/mp4','video'),poster:asset('image/png','poster'),banner:asset('image/svg+xml',svg,{svg}),frame:asset('image/svg+xml',svg,{svg}),font:asset('font/woff2','font'),icon:asset('image/svg+xml',svg,{svg}),second:asset('image/png','second')},...extra});}
const markup='<div class="rd-course-heading"><span class="rd-heading-art"><svg class="native-banner"></svg></span><h1>Your work</h1></div><div class="rd-rail-course"><span class="rd-rail-art"><svg class="rd-mini"></svg></span><span class="rd-frame"><svg></svg></span></div><div class="rd-widget"><h2>Today</h2></div><div class="rd-empty-art"><svg class="rd-mini" width="60" height="48"></svg></div>';
function fixture({hidden=false,reduced=false,motion='gentle',html=markup,font=true}={}){
 const document=createDOM('<html><body><div id="host"><div id="shadow"><main class="rd">'+html+'</main></div></div></body></html>');
 const host=document.getElementById('host'),root=document.getElementById('shadow'),rd=root.querySelector('.rd');root.host=host;
 const urls=new Map(),revoked=[],listeners=new Set(),observers=[],intersections=[],faces=[],stats={styles:0,attrs:0,plays:0,pauses:0,loads:0};let serial=0;
 const decorate=el=>{
  el.ownerDocument=document;el.getBoundingClientRect=()=>({width:60,height:48,left:0,top:0,right:60,bottom:48});
  const set=el.setAttribute.bind(el),remove=el.removeAttribute.bind(el),text=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'textContent');
  el.setAttribute=(key,value)=>{stats.attrs++;set(key,value);};el.removeAttribute=key=>{stats.attrs++;remove(key);};
  if(el.tagName==='STYLE')Object.defineProperty(el,'textContent',{get(){return text.get.call(this);},set(value){stats.styles++;text.set.call(this,value);}});
  el.style.getPropertyValue=key=>el.style[key]||'';el.style.getPropertyPriority=()=>'';
  el.insertBefore=(node,before)=>{if(node===before)return node;node.remove();const at=el.childNodes.indexOf(before);node.parentNode=el;el.childNodes.splice(at<0?el.childNodes.length:at,0,node);return node;};
  el.prepend=node=>el.insertBefore(node,el.firstChild);el.before=node=>el.parentNode?.insertBefore(node,el);
  Object.defineProperty(el,'nextSibling',{get(){const p=this.parentNode;return p?.childNodes[p.childNodes.indexOf(this)+1]||null;}});
  if(el.tagName==='VIDEO'){el.play=()=>{stats.plays++;return Promise.resolve();};el.pause=()=>stats.pauses++;el.load=()=>stats.loads++;}
  return el;
 };
 const create=document.createElement;document.createElement=tag=>decorate(create(tag));for(const el of document.querySelectorAll('*'))decorate(el);
 const listen=target=>{const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);target.addEventListener=(type,fn,options)=>{const entry={target,type,fn};listeners.add(entry);add(type,fn,options);};target.removeEventListener=(type,fn,options)=>{for(const entry of listeners)if(entry.target===target&&entry.type===type&&entry.fn===fn)listeners.delete(entry);remove(type,fn,options);};};
 listen(document);document.hidden=hidden;document.visibilityState=hidden?'hidden':'visible';rd.dataset.motionStyle=motion;rd.dataset.theme='light';
 const mediaListeners=new Set(),media={matches:reduced,addEventListener(type,fn){mediaListeners.add(fn);},removeEventListener(type,fn){mediaListeners.delete(fn);}};
 class Observer{constructor(fn){this.fn=fn;this.targets=[];observers.push(this);}observe(target,options){this.targets.push({target,options});}disconnect(){this.disconnected=true;}}
 const unexpected=()=>{throw Error('The theme renderer must not schedule work or fetch assets');};
 const env=vm.createContext({document,Blob,Uint8Array,ArrayBuffer,atob,console,URL:{createObjectURL(blob){const url='blob:theme-'+(++serial);urls.set(url,blob);return url;},revokeObjectURL(url){revoked.push(url);}},
  matchMedia:()=>media,MutationObserver:Observer,IntersectionObserver:class extends Observer{constructor(fn){super(fn);intersections.push(this);}},
  getComputedStyle:el=>({display:el.hidden||el.style.display==='none'?'none':'block',visibility:el.style.visibility||'visible'}),
  fetch:unexpected,setTimeout:unexpected,setInterval:unexpected,requestAnimationFrame:unexpected,
  ReserveThemePack:{validate:unexpected}});
 if(font){env.FontFace=class{constructor(family,source,descriptors){Object.assign(this,{family,source,descriptors});faces.push(this);}load(){throw Error('No asynchronous font loading in render');}};document.fonts=new Set();}
 document.defaultView=env;
 vm.runInContext(read('data-theme.js'),env,{filename:'data-theme.js'});
 const apply=(value,options={})=>env.ReserveDataTheme.apply(root,rd,value,options);
 return {document,host,root,rd,env,api:env.ReserveDataTheme,apply,urls,revoked,listeners,observers,intersections,faces,stats,mediaListeners,
  css:()=>root.querySelector('style')?.textContent||'',
  visibility(value){document.hidden=value;document.visibilityState=value?'hidden':'visible';document.dispatchEvent({type:'visibilitychange'});},
  reduce(value){media.matches=value;for(const fn of mediaListeners)fn({matches:value});},
  mutate(){for(const observer of observers)if(!observer.disconnected&&!intersections.includes(observer))observer.fn([{target:rd,type:'attributes',attributeName:'data-art-rest'}]);},
  intersect(value){for(const observer of intersections)if(!observer.disconnected)observer.fn([{target:rd,isIntersecting:value}]);}};
}
function images(h){return h.rd.querySelectorAll('img');}
function background(h){return h.rd.querySelector('.rd-data-theme-background');}
function cleanup(t,h){t.after(()=>h.api.remove(h.rd));return h;}

test('tiled raster backgrounds repeat their active image and keep motion event driven',t=>{
 const h=cleanup(t,fixture()),p=pack({background:{asset:'tile',fit:'tile',position:'top'},assets:{tile:asset('image/png','tile')}});h.apply(p);assert.match(h.css(),/background-repeat:repeat/);const node=background(h),url=node.querySelector('img').getAttribute('src');assert.equal(node.style.backgroundImage,'url("'+url+'")');assert.equal(h.listeners.size,0);
});

function tiledMovie(type='video/mp4'){return pack({background:{asset:'movie',still:'poster',fit:'tile',position:'top'},assets:{movie:asset(type,'movie'),poster:asset('image/png','poster')}});}
for(const type of ['video/mp4','video/webm'])test('tiled '+type+' backgrounds synchronously create a bounded 2x2 grid with shared sources',t=>{
 const h=cleanup(t,fixture()),p=tiledMovie(type);h.rd.getBoundingClientRect=()=>assert.fail('video tiling needs no layout measurement');assert.equal(h.apply(p),true);const bg=background(h),cells=bg.querySelectorAll('.rd-data-theme-tile'),videos=bg.querySelectorAll('video'),posters=bg.querySelectorAll('img');assert.equal(cells.length,4);assert.equal(videos.length,4);assert.equal(posters.length,4);assert.equal(h.urls.size,2);assert.equal(h.stats.plays,4);assert.match(h.css(),/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(h.css(),/grid-template-rows:repeat\(2,minmax\(0,1fr\)\)/);assert.match(h.css(),/\.rd-data-theme-tile > video\{[^}]*object-fit:cover;object-position:top/);assert.match(h.css(),/\.rd-data-theme-tile > \[hidden\][^{]*\{display:none!important/);assert.doesNotMatch(h.css(),/object-fit:tile/);
 const live=videos[0].getAttribute('src'),still=posters[0].getAttribute('src');assert.notEqual(live,still);for(const cell of cells){const video=cell.querySelector('video'),poster=cell.querySelector('img');assert.equal(video.getAttribute('src'),live);assert.equal(video.poster,still);assert.equal(video.muted,true);assert.equal(video.defaultMuted,true);assert.equal(video.loop,true);assert.equal(video.playsInline,true);assert.equal(video.controls,false);assert.equal(video.preload,'metadata');assert.equal(video.hidden,false);assert.equal(poster.getAttribute('src'),still);assert.equal(poster.hidden,true);}
});
test('every video tile pauses and resumes together through existing motion events without repeat work',t=>{
 const h=cleanup(t,fixture()),p=tiledMovie();h.apply(p);const cells=background(h).querySelectorAll('.rd-data-theme-tile'),counts=cells.map(cell=>{const video=cell.querySelector('video'),count={plays:0,pauses:0},play=video.play,pause=video.pause;video.play=()=>{count.plays++;return play();};video.pause=()=>{count.pauses++;pause();};return count;});let turns=0;
 const check=live=>{for(const cell of cells){assert.equal(cell.querySelector('video').hidden,!live);assert.equal(cell.querySelector('video').autoplay,live);assert.equal(cell.querySelector('img').hidden,live);}},transition=(pause,resume)=>{pause();check(false);turns++;for(const count of counts)assert.equal(count.pauses,turns);const before={plays:h.stats.plays,pauses:h.stats.pauses,loads:h.stats.loads,styles:h.stats.styles};pause();assert.deepEqual({plays:h.stats.plays,pauses:h.stats.pauses,loads:h.stats.loads,styles:h.stats.styles},before);resume();check(true);for(const count of counts)assert.equal(count.plays,turns);};
 transition(()=>h.visibility(true),()=>h.visibility(false));transition(()=>h.reduce(true),()=>h.reduce(false));transition(()=>h.intersect(false),()=>h.intersect(true));transition(()=>{h.host.hidden=true;h.mutate();},()=>{h.host.hidden=false;h.mutate();});transition(()=>{h.host.style.visibility='hidden';h.mutate();},()=>{h.host.style.visibility='visible';h.mutate();});transition(()=>{h.rd.setAttribute('data-art-rest','');h.mutate();},()=>{h.rd.removeAttribute('data-art-rest');h.mutate();});for(const motionStyle of ['still','off'])transition(()=>h.apply(p,{motionStyle}),()=>h.apply(p,{motionStyle:'gentle'}));assert.equal(h.urls.size,2);assert.equal(background(h).querySelectorAll('video').length,4);
});
for(const mode of ['hidden','reduced','off'])test('initially '+mode+' video tiles show four equivalent stills and defer all moving sources',t=>{
 const h=cleanup(t,fixture({hidden:mode==='hidden',reduced:mode==='reduced',motion:mode==='off'?'off':'gentle'})),p=tiledMovie();h.apply(p);const cells=background(h).querySelectorAll('.rd-data-theme-tile');assert.equal(cells.length,4);assert.equal(h.stats.plays,0);for(const cell of cells){const video=cell.querySelector('video'),poster=cell.querySelector('img');assert.equal(video.getAttribute('src'),null);assert.equal(video.hidden,true);assert.equal(video.autoplay,false);assert.equal(video.preload,'none');assert.equal(poster.hidden,false);assert.equal(poster.getAttribute('src'),video.poster);}if(mode==='hidden')h.visibility(false);else if(mode==='reduced')h.reduce(false);else h.apply(p,{motionStyle:'gentle'});assert.equal(h.stats.plays,4);for(const cell of cells){assert.equal(cell.querySelector('video').hidden,false);assert.equal(cell.querySelector('img').hidden,true);}
});
test('tile refresh and dashboard replacement retain exactly four decoders and both object URLs',t=>{
 const h=cleanup(t,fixture()),p=tiledMovie();h.apply(p);const bg=background(h),videos=[...bg.querySelectorAll('video')],posters=[...bg.querySelectorAll('img')],before={...h.stats},urls=[...h.urls.keys()],listeners=h.listeners.size,observers=h.observers.length;h.apply(p);h.apply(JSON.parse(JSON.stringify(p)));assert.deepEqual(h.stats,before);assert.equal(background(h),bg);assert.deepEqual([...bg.querySelectorAll('video')],videos);assert.deepEqual([...bg.querySelectorAll('img')],posters);bg.remove();h.apply(p);assert.equal(h.stats.plays,before.plays+4);assert.equal(h.stats.pauses,before.pauses+4);h.rd.innerHTML=markup;h.apply(p);assert.equal(background(h),bg);assert.deepEqual([...h.rd.querySelectorAll('video')],videos);assert.deepEqual([...h.urls.keys()],urls);assert.equal(h.listeners.size,listeners);assert.equal(h.observers.length,observers);
});
test('removing tiled video releases all four native sources, listeners and shared URLs exactly once',t=>{
 const h=cleanup(t,fixture());h.rd.setAttribute('data-rd-data-theme','previous');const before=h.root.innerHTML;h.apply(tiledMovie());const videos=[...background(h).querySelectorAll('video')],posters=[...background(h).querySelectorAll('img')],urls=[...h.urls.keys()];h.api.remove(h.rd);assert.equal(h.root.innerHTML,before);assert.equal(h.stats.pauses,4);assert.equal(h.stats.loads,4);for(const video of videos){assert.equal(video.getAttribute('src'),null);assert.equal(video.autoplay,false);}for(const poster of posters)assert.equal(poster.getAttribute('src'),null);assert.deepEqual(h.revoked,urls);assert.equal(h.listeners.size,0);assert.equal(h.mediaListeners.size,0);assert.ok(h.observers.every(o=>o.disconnected));const after={...h.stats};h.visibility(true);h.reduce(true);h.mutate();h.intersect(false);h.api.remove(h.rd);assert.deepEqual(h.stats,after);assert.deepEqual(h.revoked,urls);
});
test('animated image tiles repeat their still counterpart without creating video decoders',t=>{
 const h=cleanup(t,fixture()),p=pack({background:{asset:'tile',fit:'tile'},assets:{tile:asset('image/svg+xml',moving,{svg:moving,still:svg})}});h.apply(p);const bg=background(h),img=bg.querySelector('img'),live=img.getAttribute('src');assert.equal(bg.style.backgroundImage,'url("'+live+'")');h.reduce(true);const still=img.getAttribute('src');assert.notEqual(still,live);assert.equal(bg.style.backgroundImage,'url("'+still+'")');h.reduce(false);assert.equal(bg.style.backgroundImage,'url("'+live+'")');assert.equal(bg.querySelectorAll('video').length,0);assert.equal(h.urls.size,2);
});

test('CJS exports the synchronous browser API and an absent pack does no work',()=>{
 const api=require('../extension/data-theme.js');assert.equal(typeof api.apply,'function');assert.equal(typeof api.remove,'function');
 const h=fixture(),before=h.root.innerHTML;assert.equal(h.apply(null),false);h.api.remove(h.rd);assert.equal(h.root.innerHTML,before);assert.equal(h.urls.size,0);assert.equal(h.listeners.size,0);assert.equal(h.observers.length,0);
});
test('palette tokens reach the real dashboard surfaces and keep the saved inline accent intact',t=>{
 const h=cleanup(t,fixture());h.rd.style.setProperty('--rd-accent','#123456');assert.equal(h.apply(pack()),true);
 const css=h.css();for(const [name,value]of Object.entries(light))assert.ok(css.includes('--rd-'+name+':'+value+'!important'),name);
 for(const name of ['surface-2','surface-3','sidebar','sidebar-hover','sidebar-sel','tint','row-hover','control-line','control','ink-2','faint','line-strong','soft','accent-deep','mark'])assert.ok(css.includes('--rd-'+name+':'),name);
 assert.equal(h.rd.style.getPropertyValue('--rd-accent'),'#123456');assert.match(css,/color-scheme:light/);assert.equal(h.listeners.size,0);
 h.apply(pack(),{theme:'dark'});assert.ok(h.css().includes('--rd-bg:#14121A!important'));assert.ok(h.css().includes('--rd-accent:#C9A8F0!important'));assert.match(h.css(),/color-scheme:dark/);
 h.api.remove(h.rd);assert.equal(h.rd.style.getPropertyValue('--rd-accent'),'#123456');assert.equal(h.root.querySelector('style'),null);
});
test('a one-palette theme supplies its available palette in either dashboard mode',t=>{
 const h=cleanup(t,fixture()),p=pack({colors:{dark}});h.apply(p,{theme:'light'});assert.ok(h.css().includes('--rd-surface:#1E1B26!important'));assert.match(h.css(),/color-scheme:dark/);
 h.rd.dataset.theme='dark';h.apply(p);assert.ok(h.css().includes('--rd-ink:#F1EDF6!important'));
});
test('background, banner and motifs are isolated images or muted local videos',async t=>{
 const h=cleanup(t,fixture()),p=illustrated();h.apply(p);
 const bg=background(h),video=bg.querySelector('video'),banner=h.rd.querySelector('.rd-data-theme-banner');assert.ok(bg);assert.ok(video);assert.ok(banner.querySelector('img'));
 assert.equal(bg.getAttribute('aria-hidden'),'true');assert.equal(bg.hasAttribute('data-rd-keep'),true);assert.equal(video.muted,true);assert.equal(video.loop,true);assert.equal(video.playsInline,true);assert.equal(video.controls,false);
 for(const el of images(h))if(el.getAttribute('src'))assert.match(el.getAttribute('src'),/^blob:theme-\d+$/);
 assert.equal(h.rd.querySelector('iframe,object,embed,canvas'),null);assert.equal(h.rd.querySelectorAll('svg').length,4,'the pack never inserts SVG markup into the dashboard');
 assert.ok([...h.urls.values()].some(blob=>blob.type==='image/svg+xml'));assert.ok([...h.urls.values()].some(blob=>blob.type==='video/mp4'));
 const bannerURL=banner.querySelector('img').getAttribute('src');assert.equal(await h.urls.get(bannerURL).text(),svg);
});
test('frame rules use validated nine-slice geometry on Home panels and course cards',async t=>{
 const h=cleanup(t,fixture()),p=illustrated();p.assets.frame=asset('image/svg+xml',moving,{svg:moving,still:svg});h.apply(p);
 const css=h.css();for(const selector of ['.rd-widget','.rd-course-information','.rd-work-column','.rd-information','[role="tabpanel"]','.rd-rail-all','.rd-rail-course','.rd-frame','.rd-course-card'])assert.ok(css.includes(selector),selector);
 assert.match(css,/border-image-slice:24 20 18 16/);assert.match(css,/border-image-width:24px 20px 18px 16px/);assert.match(css,/border-image-slice:8 7 6 5/);assert.match(css,/border-image-repeat:stretch/);
 const frameURL=/border-image-source:url\("(blob:[^"]+)"\)/.exec(css)[1];assert.equal(await h.urls.get(frameURL).text(),svg,'frame SVG uses the prevalidated still copy');
});
test('validated asset IDs and finite slices have no extra renderer-specific length or size caps',t=>{
 const id='frame-'+('a'.repeat(200)),wide='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50000 40000"><path d="M0 0L50000 40000"/></svg>',h=cleanup(t,fixture()),p=pack({frames:{panel:{asset:id,slice:[12000,15000,12000,15000]}},assets:{[id]:asset('image/svg+xml',wide,{svg:wide})}});
 assert.equal(h.apply(p),true);assert.match(h.css(),/border-image-slice:12000 15000 12000 15000/);assert.ok(!h.css().includes(id));
});
test('headings use one generated FontFace family and the font is released on remove',t=>{
 const h=cleanup(t,fixture()),p=illustrated();p.title.family='Student " family; never a selector';h.apply(p);assert.equal(h.faces.length,1);
 const face=h.faces[0];assert.match(face.family,/^[A-Za-z][A-Za-z0-9]*$/);assert.equal(Buffer.from(face.source).toString(),'font');assert.equal(face.descriptors.weight,'700');assert.equal(h.document.fonts.has(face),true);
 assert.ok(h.css().includes(face.family));assert.ok(h.css().includes('h1'));assert.ok(h.css().includes('h6'));assert.ok(!h.css().includes(p.title.family));h.apply(p);assert.equal(h.faces.length,1);
 h.api.remove(h.rd);assert.equal(h.document.fonts.size,0);
});
test('font weights accepted by the validator retain the complete CSS numeric range',t=>{
 const h=cleanup(t,fixture());for(const weight of [1,1000]){const p=illustrated();p.title.weight=weight;h.apply(p);assert.equal(h.faces.at(-1).descriptors.weight,String(weight));assert.ok(h.css().includes('font-weight:'+weight+'!important'));}
});
test('font APIs can be unavailable without blocking the rest of the theme',t=>{
 const h=cleanup(t,fixture({font:false}));assert.equal(h.apply(illustrated()),true);assert.ok(background(h));assert.ok(h.css().includes('--rd-bg:#F6F1E7!important'));
});
test('motifs occupy scene slots, cycle through images and leave uploaded course art alone',t=>{
 const html=markup+'<span class="rd-rail-art"><img class="uploaded" src="blob:upload"></span><span class="rd-rail-art"><svg></svg></span><div class="rd-dock"><svg class="rd-mini"></svg></div>',h=cleanup(t,fixture({html}));h.apply(illustrated());
 const arts=h.rd.querySelectorAll('.rd-rail-art');assert.equal(arts[0].querySelectorAll('.rd-data-theme-icon').length,1);assert.equal(arts[1].querySelector('.rd-data-theme-icon'),null);assert.equal(arts[2].querySelectorAll('.rd-data-theme-icon').length,1);
 assert.equal(arts[1].querySelector('img').getAttribute('src'),'blob:upload');assert.equal(h.rd.querySelector('.rd-dock .rd-data-theme-icon'),null);
 const mini=h.rd.querySelector('.rd-empty-art .rd-data-theme-icon');assert.ok(mini);assert.equal(mini.style.width,'60px');assert.equal(mini.style.height,'48px');assert.equal(mini.alt,'');
 h.api.remove(h.rd);assert.equal(h.rd.querySelector('.rd-data-theme-icon'),null);assert.ok(h.rd.querySelector('.uploaded'));assert.equal(h.rd.querySelector('.rd-empty-art svg').hasAttribute('data-rd-data-motif'),false);
});
test('unchanged and equivalent validated packs reuse stylesheet, blobs, fonts and listeners without DOM writes',t=>{
 const h=cleanup(t,fixture()),p=illustrated();h.apply(p);const style=h.root.querySelector('style'),bg=background(h),before={...h.stats},urls=h.urls.size,listeners=h.listeners.size,observers=h.observers.length;
 h.apply(p);h.apply(JSON.parse(JSON.stringify(p)));assert.equal(h.root.querySelector('style'),style);assert.equal(background(h),bg);assert.equal(h.urls.size,urls);assert.equal(h.faces.length,1);assert.equal(h.listeners.size,listeners);assert.equal(h.observers.length,observers);assert.deepEqual(h.stats,before);
});
test('post-render reapply restores persistent media and decorates new DOM without accumulating old nodes',t=>{
 const h=cleanup(t,fixture()),p=illustrated();h.apply(p);const bg=background(h),style=h.root.querySelector('style'),oldBanner=h.rd.querySelector('.rd-data-theme-banner'),oldMini=h.rd.querySelector('.rd-empty-art svg'),listeners=h.listeners.size,urls=h.urls.size;
 h.rd.innerHTML=markup;for(const el of h.rd.querySelectorAll('*')){el.ownerDocument=h.document;el.getBoundingClientRect=()=>({width:60,height:48});const p=Object.getPrototypeOf(el);if(!p.insertBefore)p.insertBefore=function(node,before){node.remove();const at=this.childNodes.indexOf(before);node.parentNode=this;this.childNodes.splice(at<0?this.childNodes.length:at,0,node);return node;};}
 h.apply(p);assert.equal(background(h),bg);assert.equal(h.root.querySelector('style'),style);assert.equal(h.rd.querySelectorAll('.rd-data-theme-banner').length,1);assert.equal(h.rd.querySelectorAll('.rd-data-theme-icon').length,2);assert.equal(h.listeners.size,listeners);assert.equal(h.urls.size,urls);
 assert.equal(oldBanner.parentNode,null);assert.equal(oldBanner.querySelector('img').getAttribute('src'),null);assert.equal(oldMini.hasAttribute('data-rd-data-motif'),false);h.apply(p);assert.equal(h.rd.querySelectorAll('.rd-data-theme-icon').length,2);
});
test('a detached persistent video resumes when the parent puts the dashboard DOM back',t=>{
 const h=cleanup(t,fixture()),p=illustrated();h.apply(p);const bg=background(h),plays=h.stats.plays;bg.remove();h.apply(p);assert.equal(background(h),bg);assert.equal(h.stats.plays,plays+1);
});
test('animated SVG images swap to still sources while hidden, reduced, still, off or resting',async t=>{
 const h=cleanup(t,fixture()),p=pack({background:{asset:'sky'},assets:{sky:asset('image/svg+xml',moving,{svg:moving,still:svg})}});h.apply(p);const img=background(h).querySelector('img'),live=img.getAttribute('src');assert.equal(await h.urls.get(live).text(),moving);
 h.visibility(true);const still=img.getAttribute('src');assert.notEqual(still,live);assert.equal(await h.urls.get(still).text(),svg);const before={...h.stats};h.visibility(true);assert.deepEqual(h.stats,before);
 h.visibility(false);assert.equal(img.getAttribute('src'),live);h.reduce(true);assert.equal(img.getAttribute('src'),still);h.reduce(false);assert.equal(img.getAttribute('src'),live);
 for(const motionStyle of ['still','off']){h.apply(p,{motionStyle});assert.equal(img.getAttribute('src'),still);}h.apply(p,{motionStyle:'gentle'});assert.equal(img.getAttribute('src'),live);
 h.rd.setAttribute('data-art-rest','');h.mutate();assert.equal(img.getAttribute('src'),still);h.rd.removeAttribute('data-art-rest');h.mutate();assert.equal(img.getAttribute('src'),live);
});
test('initially hidden video shows its still without attaching a moving source, and pauses only on transitions',t=>{
 const h=cleanup(t,fixture({hidden:true}));h.apply(illustrated());const bg=background(h),video=bg.querySelector('video'),poster=bg.querySelector('img');assert.equal(video.getAttribute('src'),null);assert.equal(video.hidden,true);assert.equal(poster.hidden,false);assert.equal(h.stats.plays,0);
 h.visibility(false);assert.equal(video.hidden,false);assert.equal(poster.hidden,true);assert.match(video.getAttribute('src'),/^blob:/);assert.equal(h.stats.plays,1);
 h.visibility(true);assert.equal(video.hidden,true);assert.equal(poster.hidden,false);assert.equal(video.autoplay,false);assert.equal(h.stats.pauses,1);h.visibility(true);assert.equal(h.stats.pauses,1);h.visibility(false);assert.equal(h.stats.plays,2);
});
test('explicit still references also stop animated raster images and video banners',t=>{
 const h=cleanup(t,fixture()),p=pack({background:{asset:'gif',still:'poster'},banner:{asset:'movie',still:'poster'},assets:{gif:asset('image/gif','GIF89a\x01\x00\x01\x00'),poster:asset('image/png','poster'),movie:asset('video/webm','movie')}});h.apply(p);const gif=background(h).querySelector('img'),live=gif.getAttribute('src'),video=h.rd.querySelector('.rd-data-theme-banner video');assert.ok(video);assert.equal(h.stats.plays,1);
 h.reduce(true);assert.notEqual(gif.getAttribute('src'),live);assert.equal(video.hidden,true);assert.equal(h.rd.querySelector('.rd-data-theme-banner img').hidden,false);h.reduce(false);assert.equal(gif.getAttribute('src'),live);assert.equal(video.hidden,false);
});
test('hidden ancestors, paused settings and offscreen dashboards stop media through events',t=>{
 const h=cleanup(t,fixture());h.apply(illustrated());const video=background(h).querySelector('video');h.host.hidden=true;h.mutate();assert.equal(video.hidden,true);h.host.hidden=false;h.mutate();assert.equal(video.hidden,false);
 h.rd.dataset.motionStyle='still';h.mutate();assert.equal(video.hidden,true);h.rd.dataset.motionStyle='gentle';h.mutate();assert.equal(video.hidden,false);
 h.intersect(false);assert.equal(video.hidden,true);h.intersect(true);assert.equal(video.hidden,false);h.host.style.visibility='hidden';h.mutate();assert.equal(video.hidden,true);
});
test('removing a theme restores original DOM and markers and frees media, fonts, URLs, styles and observers',t=>{
 const h=cleanup(t,fixture());h.rd.setAttribute('data-rd-data-theme','previous');h.rd.querySelector('.rd-heading-art').setAttribute('data-rd-data-banner','previous-banner');const before=h.root.innerHTML;
 h.apply(illustrated());const videos=h.rd.querySelectorAll('video'),count=h.urls.size;h.api.remove(h.rd);assert.equal(h.root.innerHTML,before);assert.equal(h.listeners.size,0);assert.equal(h.mediaListeners.size,0);assert.equal(h.document.fonts.size,0);assert.equal(h.revoked.length,count);assert.equal(new Set(h.revoked).size,count);assert.ok(h.observers.every(o=>o.disconnected));
 for(const video of videos)assert.equal(video.getAttribute('src'),null);h.api.remove(h.rd);h.visibility(true);h.reduce(true);h.mutate();assert.equal(h.revoked.length,count);
});
test('replacement frees the old pack and a stale container cannot remove the active theme',t=>{
 const h=cleanup(t,fixture());h.apply(illustrated());const oldURLs=[...h.urls.keys()],oldStyle=h.root.querySelector('style');h.apply(pack());assert.ok(oldURLs.every(url=>h.revoked.includes(url)));assert.equal(oldStyle.parentNode,null);assert.equal(background(h),null);assert.equal(h.listeners.size,0);assert.equal(h.document.fonts.size,0);
 h.api.remove({});assert.ok(h.root.querySelector('style'));assert.equal(h.apply(null),false);assert.equal(h.root.querySelector('style'),null);
});
test('malformed data cannot introduce CSS or resource URLs and leaves an active theme intact',t=>{
 const h=cleanup(t,fixture());h.apply(pack());const style=h.root.querySelector('style'),before=h.root.innerHTML;
 const changes=[p=>p.colors.light.bg='red; } body { display:none',p=>p.background.fit='cover;position:fixed',p=>p.banner.position='url(https://evil.test)',p=>p.frames.panel.slice=[1,2,3,'4; color:red'],p=>p.frames.card.slice=[1,2,3,Infinity],p=>p.frames.card.slice=[1,2,3,-1],p=>p.assets.sky.type='text/html',p=>p.assets.banner.data='https://evil.test/x.svg',p=>p.assets.banner.sha256='not-a-hash',p=>p.background.asset='constructor',p=>p.title.weight='700; color:red',p=>p.title.license='Proprietary'];
 for(const change of changes){const p=illustrated();change(p);assert.throws(()=>h.apply(p),{name:'TypeError'});assert.equal(h.root.querySelector('style'),style);assert.equal(h.root.innerHTML,before);}
 assert.throws(()=>h.apply(pack(),{theme:'dark;display:none'}),{name:'TypeError'});assert.throws(()=>h.apply(pack(),{motionStyle:'always;'}),{name:'TypeError'});
});
test('a failed FontFace allocation releases new resources without disturbing the previous theme',t=>{
 const h=cleanup(t,fixture());h.apply(pack());const before=h.root.innerHTML;h.env.FontFace=class{constructor(){throw Error('Bad font');}};assert.throws(()=>h.apply(illustrated()),/Bad font/);assert.equal(h.root.innerHTML,before);assert.equal(h.document.fonts.size,0);assert.equal(h.urls.size,h.revoked.length);
});
test('raw wire SVG without internal copies stays an isolated blob image',async t=>{
 const h=cleanup(t,fixture()),p=pack({background:{asset:'wire'},assets:{wire:asset('image/svg+xml',svg)}});h.apply(p);const url=background(h).querySelector('img').getAttribute('src');assert.equal(await h.urls.get(url).text(),svg);assert.equal(h.listeners.size,0);
});
test('a validated single-frame GIF remains usable without a still reference',t=>{
 const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64'),h=cleanup(t,fixture()),p=pack({background:{asset:'gif'},assets:{gif:asset('image/gif',gif)}});assert.equal(h.apply(p),true);const img=background(h).querySelector('img'),url=img.getAttribute('src');h.visibility(true);assert.equal(img.getAttribute('src'),url);assert.equal(h.listeners.size,0);
});
