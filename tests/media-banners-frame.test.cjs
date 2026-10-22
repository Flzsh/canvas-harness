'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto'),{createDOM,settle}=require('./market-fixture.cjs');
const Frame=require('../extension/media-frame.js'),Model=require('../extension/customization-model.js');
const asset=(extra={})=>({mediaId:randomUUID(),name:'Mine.webp',type:'image/webp',kind:'image',width:1200,height:600,palette:[],...extra}),frame=(a=asset(),extra={})=>({asset:a,focus:{x:.83,y:.17},zoom:2,fit:'cover',height:'tall',...extra});
test('focus stays inside crops across portrait, square, wide and ultrawide slots at all zoom levels',()=>{
 for(const [w,h]of [[320,220],[400,400],[1200,140],[2000,90]])for(const [iw,ih]of [[400,1600],[2400,600],[800,800]])for(const zoom of [1,2,4])for(const x of [0,.1,.5,.9,1])for(const y of [0,.2,.5,.8,1]){
  const f=frame(asset(),{focus:{x,y},zoom}),g=Frame.layout(iw,ih,w,h,f);assert.ok(g.width>=w-1e-8&&g.height>=h-1e-8);assert.ok(g.left<=1e-8&&g.top<=1e-8);assert.ok(g.left+g.width>=w-1e-8&&g.top+g.height>=h-1e-8);assert.ok(g.pinX>=-1e-8&&g.pinX<=w+1e-8);assert.ok(g.pinY>=-1e-8&&g.pinY<=h+1e-8);
 }
 const centered=Frame.layout(2000,1000,1000,200,frame(asset(),{focus:{x:.5,y:.6},zoom:1}));assert.equal(centered.top,-200);assert.equal(centered.pinY,100);
});
test('fit whole keeps the complete picture and layout rejects nonfinite or empty boxes',()=>{
 const g=Frame.layout(600,1200,1200,200,frame(asset(),{fit:'contain',zoom:1}));assert.equal(g.width,100);assert.equal(g.height,200);assert.equal(g.left,550);
 for(const v of [0,-1,NaN,Infinity,'200'])assert.throws(()=>Frame.layout(v,600,1200,200,frame()));
});
test('render cleans asset metadata before writing attributes and rejects unsafe SVG',()=>{
 const html=Frame.render(frame({name:'Safe.svg',svg:'<svg viewBox="0 0 20 10"><rect width="20" height="10"/></svg>',width:'1" onload="alert(1)',height:'1" onclick="alert(1)',duration:'1" style="color:red'}));assert.doesNotMatch(html,/onload|onclick|color:red/);assert.match(html,/data-ch-width="1200"/);assert.throws(()=>Frame.render(frame({name:'Unsafe.svg',svg:'<svg><script>alert(1)</script></svg>'})));
});
test('settings reject malformed framing and preserve complete framed media and SVG across backup validation',()=>{
 const a=asset({kind:'video',type:'video/mp4',duration:20}),f=frame(a,{loop:{start:3,end:9},still:5});assert.deepEqual(Model.cleanAppearance({bannerArt:f,cardArt:f,backgroundArt:f}).bannerArt,f);
 for(const patch of [{focus:{x:NaN,y:.5}},{focus:{x:1.1,y:0}},{zoom:4.01},{zoom:'2'},{height:'huge'},{fit:'fill'},{loop:{start:10,end:2}},{loop:{start:0,end:21}},{still:21},{url:'https://bad.test/x'}])assert.throws(()=>Model.cleanAppearance({bannerArt:{...f,...patch}}));
 assert.throws(()=>Model.cleanAppearance({iconArt:f}));assert.throws(()=>Frame.clean({...f,loop:{start:0,end:1,url:'x'}}));
 const storage=require('../extension/storage.js'),owner={origin:'https://canvas.example',accountId:'43'},own=storage.createStore({...owner,adapter:{async read(){},async write(){}}}).exportBackup(),state=own.data;state.settings.overviewArt={bannerArt:f};state.settings.themeArt={bannerArt:f,backgroundArt:f};state.settings.coursePrefs={'7':{cardArt:f,backgroundArt:f}}; own.data=state;const result=storage.validateBackup(JSON.parse(JSON.stringify(own)),owner);assert.deepEqual(result.settings.overviewArt.bannerArt,f);assert.deepEqual(result.settings.themeArt.backgroundArt,f);assert.deepEqual(result.settings.coursePrefs['7'].cardArt,f);
});
function runtime(type='video/mp4'){
 const a=asset({type,kind:type.startsWith('video/')?'video':'image',...(type.startsWith('video/')?{duration:12}:{animated:true})}),f=frame(a,type.startsWith('video/')?{loop:{start:2,end:5},still:3}:{}),dom=createDOM('<html><body><div class="rd">'+Frame.render(f)+'</div></body></html>'),box=dom.querySelector('.rd'),node=box.querySelector('[data-ch-frame]'),live=node.querySelector('.ch-frame-live'),still=node.querySelector('.ch-frame-still'),observed=[],listeners=new Map(),reduced={matches:false,addEventListener:(k,fn)=>listeners.set('reduce',fn),removeEventListener:()=>listeners.delete('reduce')},urls=[],revoked=[];let playing=0,pauses=0,reads=0,motion=true;
 box.getBoundingClientRect=node.getBoundingClientRect=()=>{reads++;return {width:800,height:140,left:0,top:0,right:800,bottom:140};};live.currentTime=0;live.play=()=>{playing++;return Promise.resolve();};live.pause=()=>{pauses++;};live.load=()=>{};
 const env=vm.createContext({console,URL:{createObjectURL:()=>{const v='blob:test-'+urls.length;urls.push(v);return v;},revokeObjectURL:v=>revoked.push(v)},document:dom,matchMedia:()=>reduced,IntersectionObserver:class{constructor(fn){this.fn=fn;observed.push(this);}observe(){}unobserve(){}disconnect(){this.dead=true;}},ResizeObserver:class{observe(){}unobserve(){}disconnect(){}},MutationObserver:class{constructor(fn){listeners.set('mutation',fn);}observe(){}disconnect(){}},getComputedStyle:()=>({display:'block',visibility:'visible'}),addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)});
 vm.runInContext(fs.readFileSync(require.resolve('../extension/media-frame.js'),'utf8'),env);const controller=env.ReserveMediaFrame.createController(box,{async get(){return {asset:a,blob:new Blob(['movie'],{type:a.type}),poster:new Blob(['still'],{type:'image/webp'})};}},{motion:()=>motion,onError:error=>{throw error;}});
 return {controller,box,node,live,still,asset:a,frame:f,document:dom,observed,reduced,listeners,revoked,urls,get playing(){return playing;},get pauses(){return pauses;},get reads(){return reads;},set motion(value){motion=value;}};
}
test('visible video has one decoder, time loop and still while hidden, offscreen, reduced or Motion off',async()=>{
 const h=runtime();h.controller.sync();await settle();assert.equal(h.playing,0);assert.equal(h.still.hidden,false);assert.equal(h.node.querySelectorAll('video').length,1);
 const view=value=>h.observed[0].fn([{target:h.node,isIntersecting:value}]);view(true);assert.equal(h.playing,1);assert.equal(h.live.currentTime,2);assert.equal(h.still.hidden,true);const reads=h.reads;
 h.live.currentTime=5;h.live.dispatchEvent({type:'timeupdate'});assert.equal(h.live.currentTime,2);assert.equal(h.reads,reads);h.live.dispatchEvent({type:'ended'});assert.equal(h.live.currentTime,2);assert.equal(h.playing,2);
 view(false);assert.equal(h.still.hidden,false);assert.equal(h.live.hidden,true);view(true);h.document.hidden=true;h.document.dispatchEvent({type:'visibilitychange'});assert.equal(h.still.hidden,false);h.document.hidden=false;h.document.dispatchEvent({type:'visibilitychange'});assert.equal(h.still.hidden,true);
 h.reduced.matches=true;h.listeners.get('reduce')();assert.equal(h.still.hidden,false);h.reduced.matches=false;h.motion=false;h.controller.update();assert.equal(h.still.hidden,false);h.motion=true;h.controller.update();assert.equal(h.still.hidden,true);assert.equal(h.reads,reads);h.controller.destroy();assert.equal(h.revoked.length,h.urls.length);assert.ok(h.pauses>=4);
});
test('animated raster releases its live source while paused and detached loading cannot leak URLs',async()=>{
 const h=runtime('image/gif');h.controller.sync();await settle();h.observed[0].fn([{target:h.node,isIntersecting:true}]);assert.ok(h.live.src||h.live.getAttribute('src'));h.motion=false;h.controller.update();assert.equal(h.live.hasAttribute('src'),false);assert.equal(h.still.hidden,false);h.controller.destroy();assert.equal(h.revoked.length,h.urls.length);
 const gone=runtime();gone.controller.sync();gone.controller.destroy();await settle();assert.equal(gone.urls.length,0);
});

test('two visible placements of the same video share one active decoder and hand over on visibility change',async()=>{
 const h=runtime(),other=createDOM('<div>'+Frame.render(h.frame,{kind:'card'})+'</div>').querySelector('[data-ch-frame]'),second=other.querySelector('video');let plays=0;other.getBoundingClientRect=()=>({width:180,height:90,left:0,top:0,right:180,bottom:90});second.currentTime=0;second.play=()=>{plays++;return Promise.resolve();};second.pause=()=>{};second.load=()=>{};h.box.append(other);h.controller.sync();await settle();h.observed[0].fn([{target:h.node,isIntersecting:true},{target:other,isIntersecting:true}]);assert.equal(h.playing,1);assert.equal(plays,0);assert.equal(second.hasAttribute('src'),false);h.observed[0].fn([{target:h.node,isIntersecting:false}]);assert.equal(h.live.hasAttribute('src'),false);assert.equal(plays,1);assert.equal(other.querySelector('.ch-frame-still').hidden,true);h.controller.destroy();assert.equal(h.revoked.length,h.urls.length);
});
test('autoplay refusal shows the still and cannot start an observer retry loop',async()=>{
 const h=runtime();let attempts=0;h.live.play=()=>{attempts++;return Promise.reject(Error('Playback unavailable'));};h.controller.sync();await settle();h.observed[0].fn([{target:h.node,isIntersecting:true}]);await settle();assert.equal(attempts,1);assert.equal(h.still.hidden,false);assert.equal(h.live.hasAttribute('src'),false);for(let i=0;i<4;i++)h.listeners.get('mutation')();await settle();assert.equal(attempts,1);h.observed[0].fn([{target:h.node,isIntersecting:false}]);h.observed[0].fn([{target:h.node,isIntersecting:true}]);await settle();assert.equal(attempts,2);h.controller.destroy();
});
