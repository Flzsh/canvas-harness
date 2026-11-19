'use strict';
// Band audit U3 (2026-11-18) fixes: a later band level can grow the pack without failing this version's install
// (minBand holds what it cannot read beside the band too); an asset only the band named is dropped, not an error,
// whatever the reader did with the part naming it; a dark look made only of keys this version does not know is left
// out, not a failed install; what the reader passes over inside keep/focus/shade/fade/edge/pivot is noted; note paths
// carry no control characters; the piece renderer's sprite cache is held to 48 MB; and the Market band gate.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash,webcrypto}=require('node:crypto');
const Theme=require('../extension/theme-pack.js'),K=require('../extension/band-kit.js'),P=require('../extension/band-pieces.js');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const hash=v=>createHash('sha256').update(v).digest('hex'),wire=(d,type)=>({type,data:Buffer.from(d).toString('base64'),sha256:hash(d)});
const palette={light:{bg:'#faf6ee',surface:'#fffcf6',ink:'#2b2420',muted:'#5f554c',line:'#e3d8c6',accent:'#9c3f2a'}};
const theme=(v={})=>({format:'chtheme',version:1,name:'Band',colors:palette,...v}),sky=wire(png,'image/png');
const paths=(notes,kind)=>notes.filter(n=>n.kind===kind).map(n=>n.path);
test('minBand above this level holds a new top-level key and a new asset type with the band; without minBand they still fail',async()=>{
 const later=theme({minBand:K.level+1,bandSound:{asset:'x'},band:{asset:'sky',layers:[{asset:'x'}]},assets:{sky,x:{type:'image/jxl',data:'AAAA',sha256:'0'.repeat(64)}}});
 const read=await Theme.validate(later);assert.equal(read.pack.band,undefined);assert.equal(read.band.held,true);
 assert.deepEqual(paths(read.band.notes,'held').sort(),['$.assets.x','$.band','$.bandSound']);assert.deepEqual(Object.keys(read.pack.assets||{}),[]);
 const now={...later};delete now.minBand;assert.match((await Theme.problems(now)).join('\n'),/\$\.bandSound: unknown field/);
});
test('an asset only the band named is dropped when the part naming it was not read, whatever the reader did with it',async()=>{
 for(const band of [{asset:'sky',pieces:{far:{draw:{asset:'far'}}}},{asset:'sky',variants:{winter:{when:{months:[1]},asset:'far'}}},{asset:'sky',keep:{x:0,y:0,w:1,h:1,mask:'far'}}]){
  const read=await Theme.validate(theme({band,assets:{sky,far:wire(png,'image/png')}}));assert.deepEqual(Object.keys(read.pack.assets),['sky']);assert.ok(paths(read.band.notes,'dropped').includes('$.assets.far'));
 }
 assert.match((await Theme.problems(theme({band:{asset:'sky'},assets:{sky,stray:wire(png,'image/png')}}))).join('\n'),/assets\.stray is not used/,'an asset nothing ever named is still an error');
});
test('a dark look of keys this version does not know is left out with a note; a dark picture stays strict',async()=>{
 const read=await Theme.validate(theme({band:{asset:'sky',dark:{tint:'#102030'}},assets:{sky}}));assert.deepEqual(read.pack.band.dark,{});assert.deepEqual(paths(read.band.notes,'ignored'),['$.band.dark.tint']);
 await assert.rejects(()=>Theme.validate(theme({band:{asset:'sky',dark:{asset:'missing'}},assets:{sky}})),/missing asset/);
 await assert.rejects(()=>Theme.validate(theme({band:{asset:'sky',dark:'night'},assets:{sky}})),/expected a plain object/);
});
test('what the reader passes over inside keep, focus, shade, fade, edge and pivot is noted; note paths carry no control characters',()=>{
 const seen=K.clean({asset:'sky',keep:{x:0,y:0,w:1,h:1,r:2},focus:{x:1,y:.5,z:1},shade:{color:'#000000',blur:3},fade:{color:'bg',side:'top'},edge:12,times:{['a\u001b]0;x\u0007']:[1,2]},pieces:[{draw:'dot',pivot:{x:.5,y:1,z:0}}]},{picture:v=>({asset:v.asset})});
 for(const p of ['$.band.keep.r','$.band.focus.z','$.band.shade.blur','$.band.fade.side','$.band.pieces[0].pivot.z'])assert.ok(seen.notes.some(n=>n.path===p),p);
 assert.ok(seen.notes.some(n=>n.path==='$.band.edge'&&n.kind==='fallback'));
 assert.ok(seen.notes.every(n=>!/[\u0000-\u001f\u007f-\u009f]/.test(n.path)));assert.ok(seen.notes.some(n=>n.path.startsWith('$.band.times.a�')));
});
test('the sprite cache keeps 48 MB of pixels or what one frame draws, whichever is more, and does not grow as colours change',()=>{
 const canvas=()=>{const el={style:{},width:300,height:150,setAttribute(){},remove(){}};el.getContext=()=>new Proxy({canvas:el},{get(t,k){if(k in t)return t[k];if(k==='createImageData')return (w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)});if(/^create.*Gradient$/.test(k))return()=>({addColorStop(){}});return()=>{};},set(t,k,v){t[k]=v;return true;}});return el;};
 const doc={createElement:canvas},win={devicePixelRatio:2,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){}};doc.defaultView=win;const host={ownerDocument:doc,appendChild(){}};
 const mount=P.mount(host),view={w:1366,h:304},art={x:-2100,y:0,w:3466,h:304};
 const piece=(i,k)=>({draw:[{kind:'shape',name:K.shapes[i%18]},{kind:'shape',name:K.shapes[(i+5)%18]}],at:{type:'all'},count:400,size:[.74,.74],color:[0,1,2,3].map(c=>'#'+((i*4+c)*9973+k*7919&0xffffff).toString(16).padStart(6,'0')),look:i%2?'light':'drawn',seed:i*7919+13,index:i});
 let first=0,made=0;const count=doc.createElement;doc.createElement=tag=>{made++;return count(tag);};
 for(let k=0;k<12;k++){mount.set({pieces:Array.from({length:32},(_,i)=>piece(i,k)),art,view,graphics:'xhigh',moving:true,quiet:[],colors:palette.light,image:()=>null});mount.frame(1+k);first||=mount.cacheBytes;assert.ok(mount.cacheBytes<=Math.max(48e6,first)+852*852*4,'held '+mount.cacheBytes+' after step '+k);}
 made=0;mount.frame(20);mount.frame(21);assert.equal(made,0,'a frame with nothing changed draws no sprite anew');
 mount.destroy();assert.equal(mount.cacheBytes,0);
});
test('the Market band gate: a theme row\'s "bands" copy is chosen by level, the plain file otherwise; BAND matches the kit',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../extension/market-bridge.js'),'utf8');assert.equal(Number(/const BAND=(\d+);/.exec(source)?.[1]),K.level,'the bridge reads the band level the kit reads');
 const ORIGIN='https://flzsh.github.io',PAGE=ORIGIN+'/canvas-harness-packs/',plain=Buffer.from('plain'),banded=Buffer.from('banded'),files={'p.chtheme':plain,'b.chtheme':banded};
 async function add(bands){
  files['packs.json']=Buffer.from(JSON.stringify({packs:[{id:'t',name:'T',kind:'theme',file:'p.chtheme',size:plain.length,sha256:hash(plain),bands}]}));const sent=[];let click;
  const res=u=>{const b=files[u.slice(PAGE.length)];let done=false;return {ok:true,url:u,redirected:false,headers:{get:()=>String(b.length)},body:{getReader:()=>({read:async()=>done?{done:true}:(done=true,{done:false,value:new Uint8Array(b)}),cancel:async()=>{},releaseLock(){}})}};};
  const ctx=vm.createContext({URL,TextDecoder,Uint8Array,btoa,crypto:webcrypto,location:{href:PAGE,origin:ORIGIN},window:{postMessage(){}},document:{body:null,addEventListener:(t,f)=>{if(t==='click')click=f;},contains:()=>true},fetch:async u=>res(u),chrome:{runtime:{sendMessage:async m=>{if(m.type==='market-install')sent.push(m);return m.type==='market-installed'?{ok:true,installed:[]}:{ok:true};}}}});
  vm.runInContext(source,ctx);await click({isTrusted:true,target:{nodeType:1,disabled:false,closest(){return this;},getAttribute:()=>'t'},preventDefault(){},stopImmediatePropagation(){}});for(let i=0;i<20;i++)await new Promise(setImmediate);
  return sent[0]&&{file:sent[0].entry.file,keys:Object.keys(sent[0].entry).sort()};
 }
 const copy={level:K.level,file:'b.chtheme',size:banded.length,sha256:hash(banded)};
 assert.deepEqual(await add([copy]),{file:'b.chtheme',keys:['file','id','kind','name','sha256','size']});
 assert.equal((await add([{...copy,level:K.level+1}]))?.file,'p.chtheme','a copy for a later level: the plain file');
 assert.equal((await add([{...copy,file:'https://evil.example/b.chtheme'},'x',null,{...copy,sha256:'z'}]))?.file,'p.chtheme','unusable copies: the plain file');
 assert.equal((await add(undefined))?.file,'p.chtheme');
});
test('the phone picture takes over below 2.5:1 by default: a phone or an upright tablet, never a 1366 laptop with Help open (3.5:1)',()=>{
 const hooks={picture:v=>({asset:v.asset})},band=K.clean({asset:'sky',narrow:{asset:'tall'}},hooks).band,shown=ratio=>K.resolve(band,{mode:'light',month:6,ratio});
 for(const ratio of [3.52,3.73,3.96,2.6])assert.notEqual(shown(ratio).narrowOn,true,'a band '+ratio+' times as wide as tall keeps the wide picture');
 for(const ratio of [.72,1.3,2.4])assert.equal(shown(ratio).narrowOn,true,'a band '+ratio+' times as wide as tall takes the narrow picture');
 assert.equal(K.resolve(K.clean({asset:'sky',narrowBelow:4,narrow:{asset:'tall'}},hooks).band,{mode:'light',month:6,ratio:3.5}).narrowOn,true,'a pack may still ask for 4');
});
