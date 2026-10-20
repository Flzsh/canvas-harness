/* Canvas Harness focus room backdrop (focus-scene.html). Draws the built-in scenes, shows the student's own photo or
   video, and plays the room's sounds: white, pink and brown noise and rain, all made here, plus a sound file of the
   student's own. Their files live in this extension's storage (IndexedDB) on this device. Only the focus room on a
   supported Canvas page can talk to it, and it only answers with what it stored. */
(function(){
 'use strict';
 const Model=globalThis.ReserveFocusRoomModel;
 const $=id=>document.getElementById(id);
 const canvas=$('scene'),photo=$('photo'),video=$('video'),own=$('own');
 // The page that framed this one. Inside the extension it must be a supported Canvas site; a local preview may use
 // its own origin (http://localhost or 127.0.0.1) and nothing else.
 const parentOrigin=(location.ancestorOrigins&&location.ancestorOrigins[0])||'';
 const LOCAL=/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
 const allowed=origin=>!!origin&&origin===parentOrigin&&(globalThis.ReserveSite?.supported?.(origin)||LOCAL.test(location.origin)&&LOCAL.test(origin));
 const tell=message=>{if(parentOrigin&&window.parent!==window)window.parent.postMessage({type:'reserve-focus-scene',...message},parentOrigin);};

 /* ---- the student's own files ---- */
 const DB='reserve-focus-room',STORE='media';
 let dbp=null;
 function db(){
  return dbp||(dbp=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));
 }
 async function run(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,mode),r=fn(t.objectStore(STORE));t.oncomplete=()=>resolve(r?.result);t.onerror=t.onabort=()=>reject(t.error||Error('Storage failed'));});}
 const read=kind=>run('readonly',s=>s.get(kind));
 const write=(kind,file)=>run('readwrite',s=>s.put({blob:file,name:String(file.name||kind).slice(0,120),type:file.type,size:file.size,at:Date.now()},kind));
 const remove=kind=>run('readwrite',s=>s.delete(kind));
 const urls={};
 async function urlFor(kind){
  if(urls[kind])return urls[kind];
  const rec=await read(kind).catch(()=>null);
  if(!rec?.blob){tell({op:'missing',kind});return '';}
  return urls[kind]=URL.createObjectURL(rec.blob);
 }
 function forget(kind){if(urls[kind]){URL.revokeObjectURL(urls[kind]);delete urls[kind];}}

 /* ---- scenes ---- */
 const g=canvas.getContext('2d');
 let scene='plain',theme='light',still=false,raf=0,last=0,W=0,H=0,ratio=1,parts=null;
 const rnd=(a,b)=>a+Math.random()*(b-a);
 function size(){
  ratio=Math.min(window.devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;
  canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);g.setTransform(ratio,0,0,ratio,0,0);parts=null;
 }
 function make(){
  // Every moving piece is placed once per size and scene, as fractions of the frame.
  const n=k=>Array.from({length:k});
  return {
   bokeh:n(26).map(()=>({x:rnd(0,1),y:rnd(.3,1),r:rnd(18,70),c:['246,193,119','232,168,124','156,207,216','235,188,186'][Math.floor(rnd(0,4))],a:rnd(.06,.2),d:rnd(0,6.28)})),
   rain:n(150).map(()=>({x:rnd(0,1),y:rnd(0,1),l:rnd(10,26),v:rnd(.55,1),a:rnd(.12,.32)})),
   drops:n(46).map(()=>({x:rnd(0,1),y:rnd(0,1),r:rnd(1.4,3.8),v:rnd(0,1)<.25?rnd(.004,.02):0})),
   stars:n(230).map(()=>({x:rnd(0,1),y:rnd(0,.72),r:rnd(.4,1.5),p:rnd(0,6.28),s:rnd(.6,2)})),
   clouds:n(4).map((_,i)=>({x:rnd(0,1),y:rnd(.12,.42),w:rnd(.18,.34),v:rnd(.004,.01)*(i%2?1:.7)})),
   motes:n(60).map(()=>({x:rnd(.08,.6),y:rnd(.1,.8),r:rnd(.6,1.8),p:rnd(0,6.28),v:rnd(.004,.012)})),
   glints:n(40).map(()=>({x:rnd(-.08,.08),y:rnd(0,1),p:rnd(0,6.28)}))
  };
 }
 const hill=(base,amp,phase,t=0)=>x=>H*base+Math.sin(x/W*6.2+phase+t)*amp+Math.sin(x/W*13.1+phase*2)*amp*.35;
 function ridge(f,color){g.beginPath();g.moveTo(0,H);for(let x=0;x<=W+8;x+=8)g.lineTo(x,f(x));g.lineTo(W,H);g.closePath();g.fillStyle=color;g.fill();}
 function linear(stops,y0=0,y1=H){const gr=g.createLinearGradient(0,y0,0,y1);stops.forEach((c,i)=>gr.addColorStop(i/(stops.length-1),c));return gr;}
 function glow(x,y,r,color,alpha){const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,`rgba(${color},${alpha})`);gr.addColorStop(1,`rgba(${color},0)`);g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);}
 const DRAW={
  rain(t){
   g.fillStyle=linear(['#1b2430','#283341','#39404c']);g.fillRect(0,0,W,H);
   for(const b of parts.bokeh){const x=b.x*W+Math.sin(t*.05+b.d)*6;glow(x,b.y*H,b.r,b.c,b.a);}
   g.strokeStyle='rgba(200,215,230,1)';g.lineCap='round';
   for(const d of parts.rain){const y=((d.y+t*d.v*.9)%1.1-.05)*H,x=(d.x*W+y*.12)%W;g.globalAlpha=d.a;g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+d.l*.12,y+d.l);g.stroke();}
   g.globalAlpha=1;
   for(const d of parts.drops){const y=((d.y+t*d.v)%1)*H,x=d.x*W;g.fillStyle='rgba(210,225,240,.22)';g.beginPath();g.arc(x,y,d.r,0,6.29);g.fill();g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.arc(x-d.r*.35,y-d.r*.35,d.r*.32,0,6.29);g.fill();}
   // the window: a frame and a cross bar, drawn a little loose
   g.strokeStyle='rgba(12,16,22,.75)';g.lineWidth=Math.max(10,W*.012);g.beginPath();g.moveTo(W*.5,-10);g.lineTo(W*.502,H+10);g.moveTo(-10,H*.46);g.lineTo(W+10,H*.458);g.stroke();
   g.lineWidth=Math.max(18,W*.02);g.strokeRect(0,0,W,H);
  },
  night(t){
   g.fillStyle=linear(['#0a0f24','#161d3c','#2a2847']);g.fillRect(0,0,W,H);
   for(const s of parts.stars){g.globalAlpha=.35+.65*Math.abs(Math.sin(t*s.s*.5+s.p));g.fillStyle='#f4f1e8';g.beginPath();g.arc(s.x*W,s.y*H,s.r,0,6.29);g.fill();}
   g.globalAlpha=1;
   const mx=W*.78,my=H*.22,mr=Math.max(22,Math.min(W,H)*.045);glow(mx,my,mr*5,'244,236,210',.16);
   g.fillStyle='#f3ecd6';g.beginPath();g.arc(mx,my,mr,0,6.29);g.fill();g.fillStyle='rgba(42,40,71,.18)';g.beginPath();g.arc(mx+mr*.3,my-mr*.15,mr*.28,0,6.29);g.arc(mx-mr*.35,my+mr*.3,mr*.18,0,6.29);g.fill();
   for(const c of parts.clouds){const x=((c.x+t*c.v)%1.4-.2)*W,y=c.y*H,w=c.w*W;g.fillStyle='rgba(120,130,170,.10)';g.beginPath();g.ellipse(x,y,w*.5,w*.09,0,0,6.29);g.ellipse(x+w*.18,y-w*.05,w*.28,w*.08,0,0,6.29);g.fill();}
   ridge(hill(.8,H*.03,1.2),'#131a31');ridge(hill(.88,H*.025,3.4),'#0b1021');
  },
  ocean(t){
   const horizon=H*.6;
   g.fillStyle=linear(['#4f5a92','#b9758a','#f1ae86'],0,horizon);g.fillRect(0,0,W,horizon);
   const sx=W*.62,sy=horizon-Math.min(W,H)*.06,sr=Math.max(26,Math.min(W,H)*.06);glow(sx,sy,sr*4,'255,214,165',.35);
   g.fillStyle='#ffd9a4';g.beginPath();g.arc(sx,sy,sr,0,6.29);g.fill();
   g.fillStyle=linear(['#45507f','#26305a','#161d3b'],horizon,H);g.fillRect(0,horizon,W,H-horizon);
   for(const s of parts.glints){const y=horizon+s.y*(H-horizon)*.7+4,w=(1-s.y)*sr*1.6+6;g.globalAlpha=.25+.5*Math.abs(Math.sin(t*1.3+s.p));g.fillStyle='#ffd9a4';g.fillRect(sx+s.x*W*(.3+s.y)-w/2,y,w,1.6);}
   g.globalAlpha=1;
   for(let i=0;i<7;i++){const y=horizon+(H-horizon)*(.08+i*.14),a=.06+i*.035,amp=2+i*1.6,len=W/(2.5-i*.2);g.strokeStyle=`rgba(225,232,250,${a})`;g.lineWidth=1+i*.25;g.beginPath();for(let x=0;x<=W+10;x+=10)g.lineTo(x,y+Math.sin(x/len*6.28+t*(.5+i*.08)+i)*amp);g.stroke();}
  },
  lamp(t){
   g.fillStyle=linear(['#1a1411','#241b15','#2c2119']);g.fillRect(0,0,W,H);
   const lx=W*.3,ly=H*.33;glow(lx,ly+H*.12,Math.max(W,H)*.55,'255,200,130',.28);glow(lx,ly+H*.05,Math.max(W,H)*.2,'255,214,160',.35);
   const desk=H*.74;g.fillStyle=linear(['#3b2b1f','#2a1e16'],desk,H);g.fillRect(0,desk,W,H-desk);g.strokeStyle='rgba(255,210,150,.25)';g.lineWidth=2;g.beginPath();g.moveTo(0,desk);g.lineTo(W,desk-2);g.stroke();
   // the lamp: a weighted base, a jointed arm, and a shade that points its light down at the desk
   const bx=lx-W*.07,ex=lx-W*.1,ey=ly+H*.2,sw=Math.max(60,W*.07),sh=Math.max(34,H*.06);
   const cone=g.createLinearGradient(0,ly+sh*.5,0,desk);cone.addColorStop(0,'rgba(255,214,160,.22)');cone.addColorStop(1,'rgba(255,214,160,0)');
   g.fillStyle=cone;g.beginPath();g.moveTo(lx-sw*.48,ly+sh*.5);g.lineTo(lx+sw*.48,ly+sh*.5);g.lineTo(lx+sw*1.6,desk);g.lineTo(lx-sw*1.6,desk);g.closePath();g.fill();
   g.strokeStyle='#120d0a';g.fillStyle='#120d0a';g.lineWidth=Math.max(5,W*.005);g.lineCap='round';g.lineJoin='round';
   g.beginPath();g.ellipse(bx,desk-3,sw*.55,Math.max(5,H*.012),0,0,6.29);g.fill();
   g.beginPath();g.moveTo(bx,desk-6);g.lineTo(ex,ey);g.lineTo(lx,ly-sh*.35);g.stroke();
   g.beginPath();g.arc(ex,ey,g.lineWidth*.9,0,6.29);g.fill();
   g.beginPath();g.moveTo(lx-sw*.16,ly-sh*.5);g.lineTo(lx+sw*.16,ly-sh*.5);g.lineTo(lx+sw*.5,ly+sh*.5);g.lineTo(lx-sw*.5,ly+sh*.5);g.closePath();g.fill();
   g.fillStyle='rgba(255,226,180,.9)';g.beginPath();g.ellipse(lx,ly+sh*.5,sw*.42,Math.max(3,sh*.1),0,0,6.29);g.fill();
   // a mug, and steam
   const mx=W*.68,my=desk-H*.07,mw=Math.max(34,W*.035),mh=Math.max(40,H*.07);
   g.fillStyle='#4a3527';g.fillRect(mx,my,mw,mh);g.strokeStyle='#4a3527';g.lineWidth=Math.max(5,mw*.14);g.beginPath();g.arc(mx+mw,my+mh*.45,mh*.22,-1.4,1.4);g.stroke();
   g.strokeStyle='rgba(255,236,210,.18)';g.lineWidth=2.4;
   for(let k=0;k<3;k++){g.beginPath();for(let s=0;s<=1;s+=.05){const y=my-6-s*H*.16,x=mx+mw*(.25+k*.25)+Math.sin(s*7+t*1.2+k*2)*8*s;s?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();}
   for(const m of parts.motes){const x=(m.x*W+Math.sin(t*.3+m.p)*14),y=((m.y-t*m.v)%1+1)%1*desk;g.fillStyle=`rgba(255,224,170,${.25+.35*Math.abs(Math.sin(t*.7+m.p))})`;g.beginPath();g.arc(x,y,m.r,0,6.29);g.fill();}
  },
  plain(){g.fillStyle=theme==='dark'?'#16191f':'#F3F1EA';g.fillRect(0,0,W,H);}
 };
 function frame(now){
  raf=0;
  if(document.hidden||!DRAW[scene])return;
  if(!parts)parts=make();
  if(still||scene==='plain'){DRAW[scene](12);return;}
  if(now-last>=33){last=now;DRAW[scene](now/1000);}
  raf=requestAnimationFrame(frame);
 }
 function draw(){if(raf)cancelAnimationFrame(raf);raf=0;g.clearRect(0,0,W,H);if(DRAW[scene])raf=requestAnimationFrame(frame);}
 async function show(next){
  scene=next;
  const media=next==='photo'||next==='video'?next:'';
  canvas.hidden=!DRAW[next];photo.hidden=media!=='photo';video.hidden=media!=='video';
  if(media!=='video'){video.pause();video.removeAttribute('src');video.load();}
  if(media){
   const url=await urlFor(media);if(scene!==next)return;
   if(!url){canvas.hidden=false;scene='plain';draw();return;}
   if(media==='photo')photo.src=url;
   else{if(video.src!==url)video.src=url;if(still)video.pause();else video.play().catch(()=>{});}
  }else photo.removeAttribute('src');
  draw();
 }

 /* ---- sound: noise made here, plus the student's own file ---- */
 let ac=null,master=null;const layers={};
 function buffer(kind){
  const len=ac.sampleRate*4,b=ac.createBuffer(1,len,ac.sampleRate),d=b.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,last=0;
  for(let i=0;i<len;i++){
   const w=Math.random()*2-1;
   if(kind==='pink'){b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926;}
   else if(kind==='brown'){last=(last+.02*w)/1.02;d[i]=last*3.5;}
   else d[i]=w*.4;
  }
  return b;
 }
 function audio(){
  if(ac)return ac;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  ac=new AC();master=ac.createGain();master.gain.value=0;master.connect(ac.destination);
  for(const kind of ['white','pink','brown','rain']){
   const src=ac.createBufferSource();src.buffer=buffer(kind==='rain'?'white':kind);src.loop=true;
   const gain=ac.createGain();gain.gain.value=0;let tail=src;
   if(kind==='rain'){const hp=ac.createBiquadFilter();hp.type='highpass';hp.frequency.value=900;const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=6500;
    // a slow swell before the level, so the rain comes and goes a little and is silent at zero
    const swell=ac.createGain(),lfo=ac.createOscillator(),depth=ac.createGain();swell.gain.value=.8;lfo.frequency.value=.08;depth.gain.value=.2;lfo.connect(depth);depth.connect(swell.gain);lfo.start();
    src.connect(hp);hp.connect(lp);lp.connect(swell);tail=swell;}
   tail.connect(gain);gain.connect(master);src.start();layers[kind]=gain;
  }
  const ownGain=ac.createGain();ownGain.gain.value=0;ac.createMediaElementSource(own).connect(ownGain);ownGain.connect(master);layers.own=ownGain;
  return ac;
 }
 const LEVEL={white:.35,pink:.6,brown:.9,rain:.7,own:1};
 async function sound(s){
  const on=!!s?.on&&Model.SOUNDS.some(k=>s[k]>0);
  if(!on){if(ac){master.gain.setTargetAtTime(0,ac.currentTime,.25);setTimeout(()=>{if(master.gain.value<.01){ac.suspend().catch(()=>{});own.pause();}},1200);}return;}
  if(!audio())return;
  await ac.resume().catch(()=>{});
  for(const k of Model.SOUNDS)layers[k].gain.setTargetAtTime((Number(s[k])||0)*LEVEL[k],ac.currentTime,.3);
  master.gain.setTargetAtTime(Math.max(0,Math.min(1,Number(s.volume)||0)),ac.currentTime,.3);
  if(s.own>0){const url=await urlFor('audio');if(url){if(own.src!==url)own.src=url;own.play().catch(()=>{});}}else own.pause();
 }

 /* ---- messages from the focus room ---- */
 window.addEventListener('message',async event=>{
  if(event.source!==window.parent||!allowed(event.origin))return;
  const m=event.data;if(!m||m.type!=='reserve-focus-room')return;
  if(m.op==='scene'){theme=m.theme==='dark'?'dark':'light';still=!!m.still;await show(Model.SCENES.includes(m.scene)?m.scene:'plain');}
  else if(m.op==='sound')sound(m.sound);
  else if(m.op==='store'&&Model.MEDIA[m.kind]&&m.file instanceof Blob){
   const problem=Model.checkMedia(m.kind,m.file);if(problem){tell({op:'error',kind:m.kind,message:problem});return;}
   try{await write(m.kind,m.file);forget(m.kind);tell({op:'stored',kind:m.kind,meta:{name:String(m.file.name||m.kind).slice(0,120),type:m.file.type,size:m.file.size}});
    if(scene===m.kind)show(scene);}
   catch{tell({op:'error',kind:m.kind,message:'The file could not be saved on this device.'});}
  }
  else if(m.op==='remove'&&Model.MEDIA[m.kind]){await remove(m.kind).catch(()=>{});forget(m.kind);if(m.kind==='audio')own.removeAttribute('src');if(scene===m.kind)show('plain');tell({op:'removed',kind:m.kind});}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){video.pause();}else{if(!video.hidden&&!still)video.play().catch(()=>{});draw();}});
 window.addEventListener('resize',()=>{size();draw();});
 size();tell({op:'ready'});
})();
