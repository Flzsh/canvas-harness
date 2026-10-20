'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Scenes=require('../extension/focus-scene-renderer.js'),Model=require('../extension/focus-room-model.js');
function fixture(){
 const events=new Map(),frames=new Map(),calls=[],layers=[];let n=0;
 const gradient={addColorStop(){}};
 const context=()=>new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:(...a)=>calls.push([k,...a])});
 const win={innerWidth:3840,innerHeight:2160,devicePixelRatio:2,matchMedia:()=>media,requestAnimationFrame:f=>{frames.set(++n,f);return n;},cancelAnimationFrame:n=>frames.delete(n),addEventListener:(k,f)=>events.set('win:'+k,f),removeEventListener:k=>events.delete('win:'+k)};
 const media={matches:false,addEventListener:(k,f)=>events.set('media:'+k,f),removeEventListener:k=>events.delete('media:'+k)};
 const doc={defaultView:win,hidden:false,createElement(){const layer={getContext:()=>context()};layers.push(layer);return layer;},addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)};
 const canvas={ownerDocument:doc,getContext:()=>context()},renderer=Scenes.create(canvas);
 const advance=t=>{const [id,f]=frames.entries().next().value;frames.delete(id);f(t);};
 return {renderer,canvas,calls,layers,events,frames,media,advance};
}
test('painted scenes retain their saved choices, cache texture once, and cap backing pixels on a 4K display',()=>{
 for(const scene of ['starry','lilies','ink']){
  assert.equal(Model.cleanRoom({scene}).scene,scene);
  const f=fixture();f.renderer.show({scene,theme:'light',still:false});
  assert.equal(f.layers.length,1);assert.ok(f.canvas.width*f.canvas.height<2505000);
  f.calls.length=0;f.advance(40);f.advance(80);assert.equal(f.layers.length,1,'brush texture is not rebuilt each frame');
  assert.ok(f.calls.some(([k])=>k==='drawImage'));
  assert.equal(f.renderer.supports(scene),true);assert.equal(f.renderer.supports('photo'),false);
  f.media.matches=true;f.events.get('media:change')();assert.equal(f.frames.size,0,'live preference changes stop motion immediately');
  f.renderer.destroy();assert.equal(f.events.size,0);assert.equal(f.frames.size,0);
 }
});
test('seeded brush layouts are repeatable when reopening a scene',()=>{
 const a=fixture(),b=fixture();
 for(const f of [a,b]){f.renderer.show({scene:'lilies',theme:'light',still:true});}
 // Compare the actual paper strokes, excluding object identity of drawImage's cached canvas.
 const strokes=f=>f.calls.filter(([k])=>['moveTo','lineTo','ellipse'].includes(k));
 assert.deepEqual(strokes(a),strokes(b));a.renderer.destroy();b.renderer.destroy();
});
test('the media frame handles scene messages without a stale drawing-table reference',async()=>{
 const events=new Map(),shown=[],messages=[];
 const element=()=>({hidden:false,pause(){},load(){},removeAttribute(){},play:()=>Promise.resolve()});
 const els={scene:element(),photo:element(),video:element(),own:element()};
 const parent={postMessage:(m,o)=>messages.push([m,o])},origin='https://wra.instructure.com';
 const env={ReserveFocusRoomModel:Model,ReserveSite:{supported:o=>o===origin},ReserveFocusSceneRenderer:{create:()=>({supports:s=>Model.SCENES.includes(s)&&!['photo','video','course'].includes(s),show:v=>shown.push(v)})},
  location:{origin:'chrome-extension://harness',ancestorOrigins:[origin]},document:{getElementById:id=>els[id],addEventListener(){}},window:{parent,addEventListener:(k,f)=>events.set(k,f)},URL,Blob};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../extension/focus-scene.js'),'utf8'),env);
 const receive=events.get('message');
 await receive({source:parent,origin,data:{type:'reserve-focus-room',op:'scene',scene:'plain',theme:'dark'}});
 assert.equal(els.scene.hidden,false);assert.equal(shown.at(-1).scene,'plain');assert.equal(shown.at(-1).theme,'dark');
 await receive({source:parent,origin,data:{type:'reserve-focus-room',op:'scene',scene:'ink'}});
 assert.equal(shown.at(-1).scene,'ink');
 const before=shown.length;await receive({source:parent,origin:'https://other.example',data:{type:'reserve-focus-room',op:'scene',scene:'rain'}});assert.equal(shown.length,before);
 assert.equal(messages[0][0].op,'ready');
});
test('the scene follows the session: the ink boat crosses as the round goes on, and a break arrives at the far shore',()=>{
 const f=fixture(),boatX=()=>{const c=f.calls.find(([k])=>k==='quadraticCurveTo');return c&&c[1];};
 f.renderer.show({scene:'ink',theme:'light',still:true});
 f.calls.length=0;f.renderer.session({progress:.1,brk:false,running:true});const early=boatX();
 f.calls.length=0;f.renderer.session({progress:.9,brk:false,running:true});const late=boatX();
 f.calls.length=0;f.renderer.session({progress:.2,brk:true,running:true});const rest=boatX();
 assert.ok(early<late,'the boat moves across');assert.ok(Math.abs(rest-late)<f.canvas.width,'a break shows the crossing done');assert.ok(rest>late);
 // a still scene is redrawn only when the story visibly moves
 f.calls.length=0;f.renderer.session({progress:.2001,brk:true,running:true});assert.equal(f.calls.length,0);
 f.renderer.destroy();
});
test('going into a break, an ink wash blooms once and fades; reduced motion skips it',()=>{
 const f=fixture(),fills=()=>f.calls.filter(([k])=>k==='fillRect').length;
 f.renderer.show({scene:'rain',theme:'dark',still:false});f.renderer.session({progress:.99,brk:false,running:true});
 f.advance(40);f.advance(80);f.calls.length=0;f.advance(120);const focus=fills();
 f.renderer.session({progress:0,brk:true,running:true});f.calls.length=0;f.advance(160);const wash=fills();
 assert.equal(wash,focus+2,'a warm break tint and the wash');
 for(let t=200;t<5000;t+=40)f.advance(t);
 f.calls.length=0;f.advance(5040);assert.equal(fills(),focus+1,'the wash is gone; the break tint stays');
 f.renderer.destroy();
});
