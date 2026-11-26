'use strict';
// Soul Passage (themes/train): a sprite may move from its one picture. live-<land>.json may give a sprite `spin` (degrees a
// second), `swing` ([degrees, hz]) about a `pivot` (fractions of the cell), `squash` laid on after the turn, and `pulse`
// ([least, most, hz] of its light). scene-themes.js liveOf reads and bounds them; painter.js draws a turned sprite with its own
// program in a quad that holds the cell at any angle, and takes each pixel back through the turn into the cell. A sprite without
// the words is read and drawn exactly as before (checked against the painter of CH+ 4.2.2: tests/fixtures/sprite-motions-before.json).
// A sprite with frames may also have a `hit` ({frame, shake, flash, burst}): each time its loop reaches that frame, while it is in
// view and the land moves, the whole land jolts and flashes and specks fly from its middle; nothing of it at rest.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// (public tree: Soul Passage's downloaded files are not in the package. onDisk: packaged or named by the Market's version 4;
// dataPath: a downloaded data file's copy beside the tests; pictures of the downloaded kind are not read here)
const MARKET4=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/megapack-soul-passage-4.json'),'utf8')).files.map(f=>f.name);
const onDisk=f=>require('node:fs').existsSync(require('node:path').join(__dirname,'../extension/themes/train',f))||MARKET4.includes(f);
const dataPath=(d,f)=>{const p=require('node:path'),own=p.join(d,f);return require('node:fs').existsSync(own)?own:p.join(__dirname,'fixtures/megapack-train-data',f);};
const H=require('./painter-gl-fixture.cjs');
const ext=path.join(__dirname,'..','extension'),dir=path.join(ext,'themes','train');
const liveOf=require('../extension/scene-themes.js').liveOf;
const painterSrc=fs.readFileSync(path.join(dir,'painter.js'),'utf8');
const copy=v=>JSON.parse(JSON.stringify(v));
const BEFORE=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','sprite-motions-before.json'),'utf8'));
const near=(a,b,eps,what)=>assert.ok(Math.abs(a-b)<=eps,`${what}: ${a} vs ${b}`);
// the sprite's own phase as the painter has always worked it out (FNV-1a of its id, over 9973)
const phaseOld=id=>{let h=2166136261;for(const ch of String(id))h=Math.imul(h^ch.charCodeAt(0),16777619);return ((h>>>0)%9973)/9973;};
const one=more=>copy(liveOf({v:1,sprites:[{id:'s',frame:[0,0,84,34],at:[600,120],...more}]})).sprites[0];
// the painter's own maths (ReserveTrainPainter.motion), without WebGL
const motion=()=>require('node:vm').runInNewContext(painterSrc+';globalThis.ReserveTrainPainter.motion',{});

test('liveOf: a sprite\'s motions are kept within their bounds, given their defaults, and a wrong one is dropped, never thrown on',()=>{
 assert.deepEqual(one({spin:90,swing:[20,.5],pivot:[.3,.1],squash:[.7,1],pulse:[.4,1.2,.8]}),{...one({}),spin:90,swing:[20,.5],pivot:[.3,.1],squash:[.7,1],pulse:[.4,1.2,.8]});
 // defaults: the middle for a spin, the top middle (it hangs) for a swing alone, no squash
 assert.deepEqual([one({spin:-30}).pivot,one({spin:-30}).squash],[[.5,.5],[1,1]]);
 assert.deepEqual([one({swing:[12,.3]}).pivot,one({swing:[12,.3]}).squash],[[.5,0],[1,1]]);
 assert.deepEqual(one({spin:5,swing:[12,.3]}).pivot,[.5,.5],'with a spin the middle');
 // bounds
 assert.equal(one({spin:5000}).spin,720);assert.equal(one({spin:-5000}).spin,-720);
 assert.deepEqual(one({swing:[200,9]}).swing,[90,5]);assert.deepEqual(one({swing:[30,-2]}).swing,[30,0],'hz 0: a still tilt');
 assert.deepEqual(one({spin:1,pivot:[-1,3]}).pivot,[0,1]);assert.deepEqual(one({spin:1,squash:[0,9]}).squash,[.05,4]);
 assert.deepEqual(one({pulse:[-1,5,99]}).pulse,[0,2,10]);assert.deepEqual(one({pulse:[1.5,.5,0,7]}).pulse,[1.5,.5,0],'least may be above most; extra numbers are left');
 // dropped: not a number, not enough numbers, nothing to do; pivot and squash do nothing without a turn
 for(const bad of [{spin:'90'},{spin:NaN},{spin:null},{spin:0},{spin:Infinity},{spin:[90]},{swing:[30]},{swing:'x'},{swing:[0,1]},{swing:[-5,1]},{swing:{amp:3}},{swing:[30,'1']},
  {pulse:[1,2]},{pulse:['a',1,1]},{pulse:7},{pivot:[.2,.2]},{squash:[1,2]},{pivot:[.2,.2],squash:[1,2],spin:0,swing:[0,3]}]){
  const got=one(bad);for(const k of ['spin','swing','pivot','squash','pulse'])assert.ok(!(k in got),JSON.stringify(bad)+' keeps '+k);
 }
 assert.deepEqual(one({swing:[30,1],spin:'x'}).swing,[30,1],'a wrong spin leaves the swing');
 // never thrown on, whatever is in them
 for(const odd of [{spin:{}},{swing:[{},[]]},{pivot:'x',spin:3},{squash:[null,null],spin:3},{pulse:[1,2,{}]},{spin:-0},{swing:new Array(1000).fill(1)}])assert.doesNotThrow(()=>one(odd),JSON.stringify(odd).slice(0,60));
});

test('liveOf: a sprite without the words is read exactly as before, and every land\'s own file is',()=>{
 // the ship of the live file's spec, as liveOf has always read it: no key more
 const ship=copy(liveOf({v:1,sprites:[{id:'ship',frame:[0,0,96,64],frames:4,fps:5,layer:1.6,at:[1480,1690],scale:1,path:{vx:-9,bob:[2,.4]},shadow:[116,85,154,.5],stages:'all'}]})).sprites[0];
 assert.deepEqual(ship,{id:'ship',frame:[0,0,96,64],frames:4,cols:0,tween:false,cut:false,fps:5,layer:1.6,at:[1480,1690],scale:1,path:{vx:-9,vy:0,bob:[2,.4],loop:null},fixed:false,face:null,shadow:[116,85,154,.5],stages:['morning','noon','sunset','dusk','night']});
 const KEYS=['id','frame','frames','cols','tween','cut','fps','layer','at','scale','path','fixed','face','shadow','stages'];
 // (a land's own sprite gets a new key only for a word its file asks for: since 4.2.3 the Factory's fist asks for `hit`)
 const WORDS=['spin','swing','pivot','squash','pulse','hit'];
 for(const file of fs.readdirSync(dir).filter(n=>/^live-[a-z]+\.json$/.test(n))){const raw=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')),live=liveOf(raw);
  for(const sp of live.sprites){const own=WORDS.filter(w=>Object.hasOwn(raw.sprites.find(r=>r.id===sp.id)||{},w)),asked=own.some(w=>w==='spin'||w==='swing')?[...new Set([...own,'pivot','squash'])]:own;      // (a sprite that turns or rocks is given its pivot and squash)
  assert.deepEqual(Object.keys(sp).filter(k=>!asked.includes(k)),KEYS,file+' '+sp.id+': no new key on a sprite that does not ask for one');assert.deepEqual(Object.keys(sp).filter(k=>WORDS.includes(k)&&!asked.includes(k)),[],file+' '+sp.id+': only the words it asks for');}}
 const grip=liveOf(JSON.parse(fs.readFileSync(dataPath(dir,'live-mesa.json'),'utf8'))).sprites.find(sp=>sp.id==='grip');
 assert.equal(grip.hit.frame,34,'the hit of the fist is on the first frame after the slam');assert.ok(grip.hit.flash[0]<=.4,'a flash that does not white the hall out');
});

test('the maths: a sprite\'s phase, its angle at a time, its pulse, the way into the cell and back',()=>{
 const M=motion();
 for(const id of ['plane','plane2','grip','smoke3','a','x-y-9'])assert.equal(M.phase(id),phaseOld(id),'the phase of '+id+' is the one the painter always took');
 // spin: degrees a second from 360 x the phase; swing: a pendulum; both add; neither: 0
 near(M.angle({spin:90},2,.25),180+90,1e-9,'spin');near(M.angle({spin:-45},4,0),-180,1e-9,'spin backwards');
 near(M.angle({swing:[30,.5]},.5,0),30,1e-9,'swing at its height');near(M.angle({swing:[30,.5]},1.5,0),-30,1e-9,'and the other way');near(M.angle({swing:[30,.5]},0,.5),0,1e-9,'through the middle');
 near(M.angle({spin:10,swing:[30,.25]},1,0),10+30,1e-9,'both');assert.equal(M.angle({},3,.4),0);
 assert.equal(M.turns({spin:3}),true);assert.equal(M.turns({swing:[1,1]}),true);assert.equal(M.turns({pulse:[1,2,3]}),false);assert.equal(M.turns({}),false);
 // pulse: between least and most of the share
 near(M.pulse({pulse:[.3,1.4,.8]},(.25-.1)/.8,.1),1.4,1e-9,'most');near(M.pulse({pulse:[.3,1.4,.8]},(.75-.1)/.8,.1),.3,1e-9,'least');assert.equal(M.pulse({},5,.2),1,'no pulse: the share as it is');
 assert.deepEqual([...M.pivot({spin:1})],[.5,.5]);assert.deepEqual([...M.pivot({swing:[1,1]})],[.5,0]);assert.deepEqual([...M.pivot({spin:1,pivot:[.1,.9]})],[.1,.9]);
 // the shader's way back (uTurn) undoes the turn and the squash, at every angle
 for(let deg=-720;deg<=720;deg+=37)for(const sq of [[1,1],[.7,1],[2,.5],[.05,4]])for(const [x,y] of [[10,0],[0,-7],[-33,12.5]]){const f=M.forward(deg,sq,x,y),b=M.back(M.inverse(deg,sq),f[0],f[1]);near(b[0],x,1e-9,'x back at '+deg);near(b[1],y,1e-9,'y back at '+deg);}
 // + is clockwise on the screen (y runs down): a point to the right of the pivot goes below it at 90 degrees
 {const f=M.forward(90,[1,1],10,0);near(f[0],0,1e-9,'x');near(f[1],10,1e-9,'down');}
 // squash after the turn, along the screen: a wheel turned and squashed across stays as wide as the squash allows
 {const f=M.forward(90,[.7,1],0,-10);near(f[0],7,1e-9,'squashed across after the turn');}
});

test('the quad holds the turned cell at every angle, and only that much: a turned cell is never clipped',()=>{
 const M=motion();
 for(const [w,h] of [[67.2,27.2],[84,34],[20,120]])for(const pv of [[.5,.5],[.5,0],[0,0],[1,1],[.2,.9]])for(const sq of [[1,1],[.7,1],[2,.5]]){
  const q=M.quad(100,200,w,h,pv,sq),[bx,by,bw,bh]=q.box;let touch=0;
  near(q.pivot[0],100+pv[0]*w,1e-9,'pivot x');near(q.pivot[1],200+pv[1]*h,1e-9,'pivot y');
  for(let deg=0;deg<360;deg+=5)for(const [cx,cy] of [[0,0],[1,0],[0,1],[1,1],[.5,0],[0,.5],[1,.5],[.5,1]]){
   const f=M.forward(deg,sq,(cx-pv[0])*w,(cy-pv[1])*h),X=q.pivot[0]+f[0],Y=q.pivot[1]+f[1];
   assert.ok(X>=bx&&X<=bx+bw&&Y>=by&&Y<=by+bh,`${w}x${h} pivot ${pv} squash ${sq} at ${deg}: a corner at ${X},${Y} outside the box ${q.box}`);
   touch=Math.max(touch,Math.abs(f[0])/(bw/2),Math.abs(f[1])/(bh/2));
  }
  assert.ok(touch>.9,`the box is the circle's, not more (${touch})`);
 }
 // the plane (84 x 34) on its end: 84 tall, where its unturned quad was 34 / .86 tall; the turned box holds it
 const q=M.quad(0,0,84,34,[.5,.5],[1,1]),tall=Math.abs(M.forward(90,[1,1],42,0)[1]-M.forward(90,[1,1],-42,0)[1]);
 assert.ok(tall>34/.86&&q.box[3]>=tall,`on its end it is ${tall} tall; the old quad ${34/.86}, the new ${q.box[3]}`);
});

test('a sprite without the words is drawn exactly as before: the same quad, the same cell, every uniform, moving and at rest',async()=>{
 for(const [moving,want] of [[1,BEFORE.moving],[0,BEFORE.resting]]){
  const r=await H.paint(painterSrc,H.sceneOf(copy(liveOf(H.PLAIN)),{moving}),H.MOMENTS);
  assert.deepEqual(H.drawsOf(r.calls,'sprite'),want,'moving '+moving+': every sprite draw as CH+ 4.2.2 made it');
  assert.equal(r.calls.some(c=>c[0]==='use'&&c[1]==='spriteT'),false,'the turned program is never put in use');
  assert.equal(r.shaders.sprite,BEFORE.shader,'the plain sprite\'s shader is as it was');
 }
 assert.ok(BEFORE.moving.length>=30&&new Set(BEFORE.moving.map(d=>d.uniforms.uFlip[0])).size===2&&BEFORE.moving.some(d=>d.uniforms.uTw[0]>0)&&BEFORE.moving.some(d=>d.uniforms.uShadow[3]>0),'the fixture covers flips, dissolves and shadows');
});

// the plain sprites given motions: one spins in the window, one swings and pulses under the room, one spins facing the other way
// about its own pivot squashed, one with rows and a dissolve swings, one only pulses
const widthOf=Object.fromEntries(H.PLAIN.sprites.map(s=>[s.id,s.frame[2]*s.scale*H.sceneOf(null).k])),idOf=d=>Object.keys(widthOf).find(id=>Math.abs(widthOf[id]-d.uniforms.uQuad[2])<1e-9);
const MOVING={v:1,layers:[],sprites:H.PLAIN.sprites.map(s=>s.id==='plane'?{...s,spin:90}:s.id==='ship'?{...s,swing:[30,.5],pulse:[.3,1.4,.8]}:s.id==='kite'?{...s,spin:-45,pivot:[.25,.5],squash:[.7,1]}:s.id==='grip'?{...s,swing:[12,.3]}:s.id==='lamp'?{...s,pulse:[.2,1.8,1.5]}:s)};
test('a turned sprite: its own program, the quad that holds it, the turn of the painter\'s time about its pivot, its cell as before',async()=>{
 const live=copy(liveOf(MOVING)),byId=Object.fromEntries(live.sprites.map(s=>[s.id,s])),r=await H.paint(painterSrc,H.sceneOf(live),H.MOMENTS),M=r.motion;
 const turned=H.drawsOf(r.calls,'spriteT'),plain=H.drawsOf(r.calls,'sprite');
 assert.ok(turned.length>=15,'turned draws: '+turned.length);
 const seen=new Set();
 for(const d of turned){
  const U=d.uniforms,look=r.looks.find(l=>l.ms===d.ms).sprites.find(p=>p.x===U.uQuad[0]&&p.y===U.uQuad[1]&&p.turn!==undefined);assert.ok(look,'the painter\'s peek has it');
  const sp=byId[look.id],t=d.ms/1000,ph=phaseOld(sp.id),deg=M.angle(sp,t,ph),sq=sp.squash,pv=sp.pivot;seen.add(sp.id);
  near(look.turn,Math.round(deg*100)/100,1e-9,sp.id+' turn');
  U.uTurn.forEach((v,i)=>near(v,M.inverse(deg,sq)[i],1e-6,sp.id+' uTurn'));
  // the pivot: on the cell at its fractions; mirrored about the cell's middle when the sprite faces the other way
  const [qx,qy,qw,qh]=U.uQuad,cw=qw,ch=qh*.86,flip=U.uFlip[0]===1,px=qx+pv[0]*cw;
  near(U.uPivot[0],flip?2*(qx+qw/2)-px:px,1e-6,sp.id+' pivot x');near(U.uPivot[1],qy+pv[1]*ch,1e-6,sp.id+' pivot y');near(U.uPivot[2],pv[0]*cw,1e-9,'pivot in the cell');near(U.uPivot[3],pv[1]*ch,1e-9,'pivot in the cell');
  // the quad holds every corner of the turned cell (and its shadow's quad when it has one), as the peek says
  const [bx,by,bw,bh]=U.uRect;assert.deepEqual(look.box.map(v=>+v.toFixed(6)),U.uRect.map(v=>+v.toFixed(6)));
  for(const [cx,cy] of [[0,0],[1,0],[0,1],[1,1]]){const f=M.forward(deg,sq,(cx-pv[0])*cw,(cy-pv[1])*ch),X=U.uPivot[0]+(flip?-f[0]:f[0]),Y=U.uPivot[1]+f[1];assert.ok(X>=bx-1e-6&&X<=bx+bw+1e-6&&Y>=by-1e-6&&Y<=by+bh+1e-6,sp.id+' corner outside its quad');}
  // the cell and the dissolve as for any sprite: the frame of the time, from the sheet's rows
  const ff=t*sp.fps+ph*sp.frames,ft=Math.floor(ff)%sp.frames,cl=sp.cols>0?sp.cols:sp.frames,f2=(ft+1)%sp.frames;
  assert.deepEqual(U.uCell,[sp.frame[0]+(ft%cl)*sp.frame[2],sp.frame[1]+Math.floor(ft/cl)*sp.frame[3],sp.frame[2],sp.frame[3]]);
  assert.deepEqual(U.uCell2,[sp.frame[0]+(f2%cl)*sp.frame[2],sp.frame[1]+Math.floor(f2/cl)*sp.frame[3],sp.frame[2],sp.frame[3]]);
  near(U.uTw[0],sp.tween?ff-Math.floor(ff):0,1e-9,'dissolve');
  near(U.uShare[0],look.fade*M.pulse(sp,t,ph),.01,sp.id+' share');assert.equal(idOf(d),sp.id);
 }
 assert.deepEqual([...seen].sort(),['grip','kite','plane','ship'],'every turned sprite was drawn turned, in the window (plane, kite) and under the room');
 // where it stands and which cell it shows are as before: every draw it had as a plain sprite (the fixture) is there, turned
 for(const old of BEFORE.moving.filter(d=>seen.has(idOf(d))))assert.ok(turned.some(d=>d.ms===old.ms&&idOf(d)===idOf(old)&&String(d.uniforms.uQuad)===String(old.uniforms.uQuad)&&String(d.uniforms.uCell)===String(old.uniforms.uCell)),idOf(old)+' at '+old.ms+' ms: its unturned quad and cell as before');
 // the one that only pulses keeps the plain program and quad; its share breathes
 assert.equal(new Set(Object.values(widthOf).map(w=>w.toFixed(6))).size,H.PLAIN.sprites.length,'(every sprite of the scene has its own width)');
 const lamp=plain.filter(d=>idOf(d)==='lamp');assert.ok(lamp.length>=3);
 for(const d of lamp)near(d.uniforms.uShare[0],M.pulse(byId.lamp,d.ms/1000,phaseOld('lamp')),1e-9,'lamp share');
 assert.ok(new Set(lamp.map(d=>d.uniforms.uShare[0].toFixed(3))).size>=3,'and it changes');
 // the plain ones beside them: untouched (the same draws as their own in the fixture)
 const mine=plain.filter(d=>['boat','edge'].includes(idOf(d))),before=BEFORE.moving.filter(d=>['boat','edge'].includes(idOf(d)));
 assert.ok(before.length>=5);assert.deepEqual(mine,before,'the boat and the one wrapping at the edge are drawn as before, beside them');
});

test('a turned sprite stands still with the land: at rest every moment is the same turn and the same pulse',async()=>{
 const live=copy(liveOf(MOVING)),r=await H.paint(painterSrc,H.sceneOf(live,{moving:0}),H.MOMENTS),M=r.motion;
 const turned=H.drawsOf(r.calls,'spriteT'),byMoment=new Map();
 for(const d of turned){const key=d.uniforms.uQuad.join();(byMoment.get(key)||byMoment.set(key,[]).get(key)).push(d);}
 assert.ok(byMoment.size>=3);
 for(const list of byMoment.values()){assert.equal(list.length,H.MOMENTS.length,'drawn at every moment, in the same place');for(const d of list){assert.deepEqual(d.uniforms.uTurn,list[0].uniforms.uTurn);assert.deepEqual(d.uniforms.uShare,list[0].uniforms.uShare);}}
 // (at rest the time is 0: a spin rests at 360 x its phase, a swing at amplitude x sin(2 pi phase), as bob and frames rest)
 const plane=r.looks[0].sprites.find(p=>p.id==='plane');near(plane.turn,Math.round(M.angle({spin:90},0,phaseOld('plane'))*100)/100,1e-9,'plane at rest');
});

test('the turned sprite\'s shader: each pixel taken back into the cell, read inside the cell only; a shader that will not build leaves the sprite unturned, never the land',async()=>{
 const fsT=painterSrc.slice(painterSrc.indexOf('const FS_ST=`'),painterSrc.indexOf('`;',painterSrc.indexOf('const FS_ST=`')));
 assert.ok(fsT.includes('vec2 p=(uPivot.zw+vec2(dot(uTurn.xy,d),dot(uTurn.zw,d)))/cs;'),'back through the turn');
 assert.ok(fsT.includes('if(uFlip>.5)d.x=-d.x;'),'mirrored with the picture');
 assert.ok(fsT.includes('clamp(uCell.xy+p*uCell.zw,uCell.xy+.5,uCell.xy+uCell.zw-.5)'),'never a texel of the next cell');
 assert.ok(fsT.includes('float cover=clamp(min(e.x,e.y)+.5,0.,1.);'),'outside the cell: clear, over one soft pixel');
 assert.ok(painterSrc.includes('try{progs.spriteT=compile(VS,FS_ST);}catch{progs.spriteT=null;}'));
 assert.ok(painterSrc.includes('const tn=sp.spin||sp.swing?progs.spriteT:null'),'no turned program: drawn as a plain sprite');
 // (a GPU that will not build it: the land is painted, and the turned sprites are drawn unturned by the plain program)
 const r=await H.paint(painterSrc,H.sceneOf(copy(liveOf(MOVING))),H.MOMENTS,{refuse:/uTurn/});
 assert.equal(r.calls.some(c=>c[0]==='use'&&c[1]==='spriteT'),false);assert.ok(r.calls.some(c=>c[0]==='draw'&&c[1]==='land'),'the land is painted');
 const drawn=new Set(H.drawsOf(r.calls,'sprite').map(idOf));for(const id of ['plane','ship','kite','grip'])assert.ok(drawn.has(id),id+' drawn unturned');
});

// ---- a sprite's hit: at one frame of its loop the land jolts, flashes and throws specks (live hit {frame, shake, flash, burst}) ----
const FIST={id:'fist',frame:[0,0,84,34],frames:48,cols:8,fps:8,tween:1,layer:2,at:[2885,1433],scale:1.7,stages:'all',hit:{frame:33,shake:[6,.5],flash:[.8,.6],burst:{kind:'embers',count:60,speed:220,spread:140,life:1.1}}};
const hitOf=more=>copy(liveOf({v:1,sprites:[{...FIST,...more}]})).sprites[0];
test('liveOf: a sprite\'s hit is kept within its bounds on a sprite with frames, given its defaults, and dropped when it can do nothing',()=>{
 assert.deepEqual(hitOf({}).hit,FIST.hit);
 assert.deepEqual(hitOf({hit:{frame:99.4,shake:[99,9],flash:[9,9],burst:{kind:'dust',count:999,speed:1e6,spread:999,life:99}}}).hit,{frame:47,shake:[24,2],flash:[1.5,2],burst:{kind:'dust',count:120,speed:2000,spread:360,life:5}});
 assert.deepEqual(hitOf({hit:{frame:2.6,burst:{kind:'embers'}}}).hit,{frame:3,burst:{kind:'embers',count:24,speed:160,spread:360,life:1.2}},'a burst\'s defaults; the frame rounded');
 assert.deepEqual(hitOf({hit:{frame:-4,shake:[3,.2],flash:[0,1]}}).hit,{frame:0,shake:[3,.2]},'a flash of 0 is none');
 for(const bad of [{hit:7},{hit:[]},{hit:{shake:[3,.2]}},{hit:{frame:'33',shake:[3,.2]}},{hit:{frame:3}},{hit:{frame:3,shake:[0,1],flash:[1,0]}},{hit:{frame:3,burst:{kind:'lava'}}},{hit:{frame:3,burst:{kind:'dust',count:0}}},{hit:{frame:3,shake:[3]}},{frames:1,hit:{frame:0,shake:[3,.2]}}])
  assert.ok(!('hit' in hitOf(bad)),JSON.stringify(bad)+' keeps a hit');
 const odd={hit:{frame:3,shake:{},flash:'x',burst:{kind:'dust',count:{},speed:[],spread:null,life:'1'}}};
 assert.doesNotThrow(()=>hitOf(odd));assert.deepEqual(hitOf(odd).hit,{frame:3,burst:{kind:'dust',count:24,speed:160,spread:360,life:1.2}});
 assert.ok(!('hit' in one({})),'a sprite without one: no key');
});

test('the maths of a hit: when the loop reaches its frame, the jolt and the flash after it, a speck of its burst',()=>{
 const M=motion(),sp=hitOf({}),ph=phaseOld('fist'),at=m=>(33+48*m-ph*48)/8;
 // in step with the frame drawn: floor(t x fps + ph x frames) mod frames is the hit's frame exactly while the time since is under a frame
 for(const m of [1,7,30])for(const d of [0,.01,.124,.126,3,5.99]){const t=at(m)+d,since=M.hitSince(sp,t,ph),drawn=Math.floor(t*8+ph*48)%48;near(since,d,1e-6,'since at +'+d);assert.equal(drawn===33,since<1/8,'frame '+drawn+' and since '+since);}
 assert.equal(M.hitSince({...sp,fps:0},5,ph),-1,'a frozen loop never reaches it');assert.equal(M.hitSince({...sp,frames:1},5,ph),-1);assert.equal(M.hitSince({...sp,hit:undefined},5,ph),-1);
 // the jolt: straight down at once, quick knocks under an envelope, nothing after its seconds; the flash: all at once, falling back
 assert.deepEqual([...M.hitShake(sp.hit,0,6)].map(v=>+v.toFixed(9)),[0,6]);
 for(const since of [.5,.51,1,5.9])assert.deepEqual([...M.hitShake(sp.hit,since,6)],[0,0],'still at '+since);
 near(M.hitFlash(sp.hit,0,6),.8,1e-12,'flash at once');assert.equal(M.hitFlash(sp.hit,.6,6),0);assert.equal(M.hitFlash(sp.hit,-1,6),0);
 let last=Infinity;for(let since=0;since<.6;since+=.01){const f=M.hitFlash(sp.hit,since,6);assert.ok(f<=last+1e-12);last=f;}
 const knocks=[];for(let since=0;since<.5;since+=.005)knocks.push(M.hitShake(sp.hit,since,6)[1]);assert.ok(knocks.filter((v,i)=>i&&Math.sign(v)!==Math.sign(knocks[i-1])).length>=6,'a few quick knocks, not one sway');
 // never more often than the loop: a jolt or flash longer than the loop is over as it comes round
 assert.equal(M.hitFlash({flash:[1,2]},.99,1),M.hitFlash({flash:[1,1]},.99,1));near(M.hitFlash({flash:[1,2]},.999999,1),0,1e-9,'gone by the next hit');
 // a speck: out within the spread about straight up, slowing, fading to nothing by its life; embers rise, dust settles
 const b=sp.hit.burst;for(const r of [[0,0,0,0],[1,1,1,1],[.5,.3,.9,.2],[.1,.8,.4,.6]]){
  const a=M.burst(b,.02,r),z=M.burst(b,.5,r),end=M.burst(b,b.life,r),ang=Math.atan2(a.off[1],a.off[0])*180/Math.PI;
  assert.ok(Math.abs(ang+90)<=70+1,'within 140 degrees about up: '+ang);assert.ok(Math.hypot(...z.off)>Math.hypot(...a.off),'out');assert.ok(z.speed<a.speed,'slowing');
  assert.equal(a.alpha,1);assert.equal(end.alpha,0);assert.ok(z.size>=2.5&&z.size<=6);
  assert.ok(M.burst({...b,kind:'embers'},.8,r).off[1]<M.burst({...b,kind:'dust'},.8,r).off[1],'embers rise, dust settles');
 }
});

const HIT_LIVE={v:1,layers:[],sprites:[FIST,H.PLAIN.sprites.find(s=>s.id==='plane')]};
const AFTER=[-1,.02,.3,.7,1.5],hitMoments=()=>{const ph=phaseOld('fist'),t=(33+48*20-ph*48)/8;return AFTER.map(d=>(t+d)*1000);};
test('a hit on the page: the land jolts and flashes as the fist\'s loop reaches its frame, the specks fly, and all is gone after its time',async()=>{
 const ms=hitMoments(),live=copy(liveOf(HIT_LIVE)),r=await H.paint(painterSrc,H.sceneOf(live),ms),M=r.motion,sp=live.sprites[0],k=H.sceneOf(null).k;
 const all=H.statesOf(r.calls,'land'),land=all.filter(d=>d.uniforms.uTileRow[0]!==-9999),under=all.filter(d=>d.uniforms.uTileRow[0]===-9999),bursts=H.statesOf(r.calls,'burst');
 ms.forEach((m,i)=>{
  const since=M.hitSince(sp,m/1000,phaseOld('fist')),sh=M.hitShake(sp.hit,since,6),fl=M.hitFlash(sp.hit,since,6),here=land.filter(d=>d.ms===m),when='at +'+AFTER[i]+' s';
  near(since,(AFTER[i]+6)%6,1e-6,'the time since the hit '+when);assert.ok(here.length>=6,'the land drawn '+when);
  // the window's strips and the page's layers alike: one flash, one jolt (on top of the ride's own, none here)
  assert.ok(here.some(d=>d.uniforms.uTileRow[0]===0)&&here.some(d=>d.uniforms.uTileRow[0]===512));
  for(const d of here){near(d.uniforms.uHit?.[0]??0,fl,1e-6,'flash '+when);near(d.uniforms.uShake[0],sh[0]*k,1e-6,'jolt x '+when);near(d.uniforms.uShake[1],sh[1]*k,1e-6,'jolt y '+when);}
  for(const d of under.filter(d=>d.ms===m)){assert.equal(d.uniforms.uHit?.[0]??0,0,'the cabin\'s underside never flashes');assert.deepEqual(d.uniforms.uShake,[0,0],'nor jolts');}
  const bs=bursts.filter(d=>d.ms===m);assert.equal(bs.length>0,since<1.1,'specks '+when);for(const d of bs){assert.equal(d.count,60);near(d.uniforms.uSince[0],since,1e-6,'their time');}
  const fist=H.statesOf(r.calls,'sprite').find(d=>d.ms===m&&Math.abs(d.uniforms.uQuad[2]-84*1.7*k)<1e-9);assert.ok(fist,'the fist drawn '+when);
  if(AFTER[i]===.02)assert.deepEqual(fist.uniforms.uCell,[(33%8)*84,Math.floor(33/8)*34,84,34],'the hit comes with frame 33 drawn');
  const peekHit=r.looks[i].hit;if(peekHit)assert.equal(peekHit[0].frame,Math.floor(m/1000*8+phaseOld('fist')*48)%48);
 });
 // just after the hit (a fiftieth of a second): the land well jolted, the flash nearly whole; after their seconds: nothing at all
 const at=land.find(d=>d.ms===ms[1]);assert.ok(Math.hypot(...at.uniforms.uShake)>2*k&&at.uniforms.uHit[0]>.7,JSON.stringify(at.uniforms.uShake));
 assert.ok(land.filter(d=>d.ms===ms[3]||d.ms===ms[4]).every(d=>(d.uniforms.uHit?.[0]??0)===0&&d.uniforms.uShake[0]===0&&d.uniforms.uShake[1]===0));
 // the specks come from the fist's middle
 const b0=bursts.find(d=>d.ms===ms[1]),f0=r.looks[1].sprites.find(p=>p.id==='fist');near(b0.uniforms.uAt[0],f0.x+f0.w/2,1e-6,'from its middle x');near(b0.uniforms.uAt[1],f0.y+f0.h*.43,1e-6,'from its middle y');
});

test('no hit at all with the land at rest, for a sprite out of view, or on a land without one; specks cost nothing when none is alive',async()=>{
 const ms=hitMoments(),live=copy(liveOf(HIT_LIVE));
 const rest=await H.paint(painterSrc,H.sceneOf(live,{moving:0}),ms);
 assert.equal(rest.calls.some(c=>c[0]==='uniform1f'&&c[2]==='uHit'&&c[3]!==0),false,'no flash at rest');assert.equal(rest.calls.some(c=>c[0]==='use'&&c[1]==='burst'),false,'no specks');
 assert.ok(H.statesOf(rest.calls,'land').every(d=>d.uniforms.uShake[0]===0&&d.uniforms.uShake[1]===0),'no jolt');
 // the fist far off the canvas (a canvas of 600 px): its loop goes on, the land does not answer it
 const away=copy(liveOf({v:1,sprites:[{...FIST,at:[3500,1433]}]})),off=await H.paint(painterSrc,H.sceneOf(away),ms,{width:600});
 assert.equal(H.statesOf(off.calls,'sprite').length,0,'(it is not drawn)');assert.equal(off.calls.some(c=>c[0]==='uniform1f'&&c[2]==='uHit'),false);assert.equal(off.calls.some(c=>c[0]==='use'&&c[1]==='burst'),false);
 // a land without a hit: the flash is never set, the burst's program never used (and every call as before: see above)
 const plain=await H.paint(painterSrc,H.sceneOf(copy(liveOf(H.PLAIN))),H.MOMENTS);
 assert.equal(plain.calls.some(c=>/uHit/.test(c[2]||'')),false);assert.equal(plain.calls.some(c=>c[0]==='use'&&c[1]==='burst'),false);
 // the source: one flash for the whole land, set only when it changes; the burst drawn only while alive; nothing while at rest
 assert.ok(painterSrc.includes('{const f=o.hit||0;if(f!==hitSet){gl.uniform1f(u.uHit,f);hitSet=f;}}'));
 assert.ok(painterSrc.includes('if(hs>=0&&sp.hit.burst&&hs<sp.hit.burst.life)burstDraw('));
 assert.ok(painterSrc.includes('hs=sp.hit&&s.moving?MOTION.hitSince(sp,time,ph):-1'));
 assert.ok(painterSrc.includes('try{progs.burst=compile(VS_B,FS_P);}catch{progs.burst=null;}'),'a GPU that will not build the specks loses only them');
});
